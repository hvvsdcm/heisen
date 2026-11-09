import {BaseWindow,BrowserWindow,Menu,WebContentsView,dialog,shell,type Session,type WebContents} from 'electron';
import {testBackground,testWindowOptions,showWindow,focusWindow,quietWindow} from './test-background.ts';
import {randomUUID} from 'node:crypto';
import type {Data} from './data.ts';
import type {Shield} from './shield.ts';
import {HttpsFirst,upgradable,type Block} from './https-first.ts';
import type {Sessions,PendingLoad} from './sessions.ts';
import {Reader} from './reader.ts';
import {originOf,textArg,type Task} from './protocol.ts';
import {registerRpc} from './rpc.ts';
import {windows,type Windows} from './windows.ts';
import {HOME,omnibox,externalScheme,sameOriginBlob,closeSelection,moveTab,stepZoom,zoomKey,insertAfterOpener,shortcutIndex,cycleIndex,pushClosed,popupSize,popupLabel,popupStripHtml,POPUP_STRIP} from './browser-util.ts';
import {attachContextMenu} from './context-menu.ts';
import {ensureDebugger,releaseDebugger,click,typeText,selectAll,pressKey,wheel,KEYS,type InputStyle} from './input.ts';
import {pageScript,sensitiveSetup,snapshotScript,targetScript,markdownScript,screenCheckScript,fillLoginScript,signupScanScript,fillSignupScript,markUploadScript,unmarkUploadScript,selectOptionScript,type Snapshot} from './page-scripts.ts';
import {parseRules,type PasswordRules} from './password-rules.ts';
import {SwipeNavigator} from './gestures.ts';
import {setTimeout as sleep} from 'node:timers/promises';
export {HOME};
const HIDDEN='Heisen 창이 화면에 보이지 않아 입력할 수 없습니다.';
const MASK='••••••••';
const VAULT_OFF='비밀번호 관리자가 꺼져 있습니다.',NO_EMAIL='기본 이메일이 설정되어 있지 않습니다.';
const webOrigin=(url:string)=>{try{return originOf(url);}catch{return null;}};
export function agentAllowed(data:Data,url:string):void{
 if(url===HOME)return;
 if(data.state.settings.agentSites[originOf(url)]==='block')throw new Error('사용자가 이 사이트의 에이전트 조작을 차단했습니다.');
}
// Net error number of a rejected loadURL (e.g. -107 ERR_SSL_PROTOCOL_ERROR), 0 when absent.
const netError=(e:unknown)=>e&&typeof e==='object'&&'errno' in e?Number(e.errno):0;
// Replaces every occurrence of each secret in every string of an agent-bound result (snapshot, markdown, login info).
function redact(value:unknown,secrets:string[]):unknown{
 if(typeof value==='string')return secrets.reduce((s,secret)=>s.split(secret).join(MASK),value);
 if(Array.isArray(value))return value.map(v=>redact(v,secrets));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,redact(v,secrets)]));
 return value;
}
export function address(value:string){return omnibox(value).url;}
export type TabPrivacy={blocked:number;cookies:number;params:number;hosts:Record<string,number>};
export const emptyPrivacy=():TabPrivacy=>({blocked:0,cookies:0,params:0,hosts:{}});
export type Tab={id:number;title:string;url:string;loading:boolean;pinned:boolean;incognito?:boolean;favicon?:string;taskId?:string;epoch?:number;origins?:string[];error?:string;block?:Block;openerId?:number;find?:{text:string;active:number;matches:number};agentAt?:number;snapshotId?:string;view?:WebContentsView;ready?:Promise<void>;lastActiveAt?:number;hiddenAt?:number;sleptAt?:number;sleepReason?:'idle'|'leak'|'pressure';history?:{entries:Electron.NavigationEntry[];index:number;scroll:{x:number;y:number;url:string}};privacy?:TabPrivacy;readable?:boolean;reader?:WebContentsView};
export type AgentMethod='snapshot'|'click'|'type'|'press'|'scroll'|'select'|'markdown'|'screenshot'|'upload'|'login'|'loginInfo'|'signup'|'signupInfo'|'wait'|'navigate'|'tabs';
export type Observation=Snapshot&{loading:boolean};
// Sign-up settings and storage (Signup.install): the default email for an attempt (alias on the first only), a password for the inferred
// rules that skips presets already tried (throws when no preset fits), and the vault record of what was filled.
export type SignupProvider={
 mode():'generate'|'preset';
 email(origin:string,attempt:number):string|null;
 password(rules:PasswordRules,tried:string[]):{password:string;preset?:{id:string;name:string}};
 record(e:{origin:string;username:string;password:string;preset?:string;by:'agent'|'user'}):void;
};
export class Browser {
 tabs=new Map<number,Tab>();active=0;epochs=new Map<string,number>();sidebar=232;panel=0;modal=false;route='home';top=124;closed:{url:string;title:string;index:number;pinned:boolean}[]=[];popups=new Set<BaseWindow>();private findIds=new WeakMap<Tab,number>();
 vaultLookup:(origin:string)=>{username:string;password:string}[]=()=>[];private agentQueues=new WeakMap<Tab,Promise<unknown>>();private agentTimers=new WeakMap<Tab,NodeJS.Timeout>();
 // Password manager switch (Autofill.install) and sign-up provider (Signup.install).
 vaultEnabled:()=>boolean=()=>true;signup?:SignupProvider;
 taskBusy:(taskId:string)=>boolean=()=>true;
 shield?:Shield;
 popupClosed:(topSite:string,popupUrl:string,session:Session)=>void=()=>{};
 onViewDestroy:(tab:Tab)=>void=()=>{};
 reader:Reader;
 private popupOwner=new WeakMap<BaseWindow,number>();private popupPages=new WeakMap<BaseWindow,WebContents>();
 // Passwords filled into a tab (agent login, autofill), kept until the tab leaves that origin or closes.
 private filled=new Map<number,{origin:string;values:Set<string>}>();
 // Agent sign-up password fills per tab on one origin and the presets used, reset like filled.
 private signupTries=new Map<number,{origin:string;attempts:number;tried:string[]}>();
 // Pages with an external-app prompt open; further requests from them are dropped until it closes.
 private prompting=new WeakSet<WebContents>();
 constructor(public win:BrowserWindow,public data:Data,public readonly changed:()=>void,public httpsFirst:HttpsFirst,public sessions:Sessions){
  win.on('resize',()=>this.layout());win.on('closed',()=>{
   for(const p of [...this.popups])if(!p.isDestroyed())p.destroy();
   for(const tab of this.tabs.values()){this.onViewDestroy(tab);clearTimeout(this.agentTimers.get(tab));const wc=tab.view?.webContents;delete tab.view;if(wc&&!wc.isDestroyed())wc.close();}
   this.tabs.clear();this.filled.clear();this.signupTries.clear();this.epochs.clear();
   this.sessions.clearIncognito(()=>windows.all().some(b=>[...b.tabs.values()].some(t=>t.incognito)),new Set(windows.all().flatMap(b=>[...b.popups])));
  });
  win.on('leave-full-screen',()=>{for(const t of this.tabs.values())if(t.view)void this.releaseFullscreen(t.view);});
  new SwipeNavigator(this,win).install();
  this.reader=new Reader(this,data,changed);this.onViewDestroy=tab=>this.reader.onViewDestroy(tab);this.reader.install();
 }
 publicTabs(){return [...this.tabs.values()].map(({view,ready,agentAt,snapshotId,history,reader,privacy,...t})=>({...t,agent:!!agentAt&&Date.now()-agentAt<8000,zoom:view?Math.round(view.webContents.getZoomFactor()*1000)/1000:1,sleeping:t.url!==HOME&&!view,canBack:view?view.webContents.navigationHistory.canGoBack():!!history&&history.index>0,canForward:view?view.webContents.navigationHistory.canGoForward():!!history&&history.index<history.entries.length-1,sleptAt:t.sleptAt??null,sleepReason:t.sleepReason??null,readable:!!t.readable,reader:!!reader,privacy:privacy?{blocked:privacy.blocked,cookies:privacy.cookies,params:privacy.params,hosts:Object.entries(privacy.hosts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([h])=>h)}:null,site:this.shield?.siteOf(t.url)??null,protected:this.shield?.protectedSite(t.url)??true}));}
 // Session tabs. A blob: page exists only while its site's document lives, so it is saved as the page it came from (earlier entry in
 // the tab, else the opener tab) or left out.
 save(){
  // Late renderer events from a closed window must not erase the last session.
  if(this.win.isDestroyed())return;
  const rows:{url:string;title:string;pinned:boolean}[]=[];let active=-1;
  for(const browser of windows.all())for(const t of browser.tabs.values()){
   if(t.taskId||t.incognito)continue;const page=/^blob:/i.test(t.url)?browser.blobSource(t):{url:t.url,title:t.title};if(!page)continue;
   if(browser===this&&t.id===this.active)active=rows.length;rows.push({...page,pinned:t.pinned});
  }
  this.data.state.tabs=rows;this.data.state.activeTab=active>=0?active:Math.min(this.data.state.activeTab||0,Math.max(0,rows.length-1));this.data.save();this.changed();
 }
 private blobSource(tab:Tab){
  const wc=tab.view?.webContents,history=wc&&!wc.isDestroyed()?wc.navigationHistory:undefined,entries=history?.getAllEntries()??tab.history?.entries??[];
  for(let i=history?history.getActiveIndex():tab.history?.index??-1;i>=0;i--)if(/^https?:/i.test(entries[i].url))return {url:entries[i].url,title:entries[i].title||entries[i].url};
  const opener=tab.openerId===undefined?undefined:this.tabs.get(tab.openerId);
  return opener&&/^https?:/i.test(opener.url)?{url:opener.url,title:opener.title}:undefined;
 }
 async restore(){
  this.sidebar=this.data.state.settings.sidebarCollapsed?0:232;
  const saved=this.data.state.tabs.slice(0,300);const selected=Math.min(this.data.state.activeTab||0,Math.max(0,saved.length-1));
  for(const t of saved){const id=windows.nextTabId();this.tabs.set(id,{id,title:t.title||t.url,url:t.url,loading:false,pinned:t.pinned,hiddenAt:Date.now(),privacy:emptyPrivacy()});}
  const ids=[...this.tabs.keys()],target=ids[selected];this.setOrder([...ids.filter(k=>this.tabs.get(k)!.pinned),...ids.filter(k=>!this.tabs.get(k)!.pinned)]);
  if(!this.tabs.size)await this.create();else await this.select(target);
 }
 async create(url=HOME,active=true,owner?:{id:string;epoch:number;origins:string[]},pinned=false,openerId?:number,index?:number,incognito=false){
  incognito=openerId===undefined?incognito:!!this.tabs.get(openerId)?.incognito;if(incognito)this.sessions.privateSession();
  const id=windows.nextTabId();const tab:Tab={id,title:url===HOME?(incognito?'시크릿 탭':'새 탭'):url,url,loading:false,pinned,...(incognito?{incognito:true}:{}),...(owner?{taskId:owner.id,epoch:owner.epoch,origins:owner.origins}:{}),...(openerId!==undefined?{openerId}:{})};
  tab.privacy=emptyPrivacy();if(!active)tab.hiddenAt=Date.now();
  const entries=[...this.tabs],pins=entries.filter(([,t])=>t.pinned).length;let at=index===undefined?insertAfterOpener(entries.map(([k])=>k),openerId,k=>this.tabs.get(k)?.openerId):Math.max(0,Math.min(entries.length,index));
  at=pinned?Math.min(at,pins):Math.max(at,pins);
  if(at>=entries.length)this.tabs.set(id,tab);else{entries.splice(at,0,[id,tab]);this.tabs.clear();for(const [k,t] of entries)this.tabs.set(k,t);}
  if(active){this.hidePrevious(id);this.active=id;tab.lastActiveAt=Date.now();this.route=url===HOME?'home':'page';}
  this.save();if(active||owner)await this.ensureLoaded(tab);this.layout();return tab;
 }
 // Rebuilds the tab map in the given order (Map iteration order is the tab strip order).
 private setOrder(ids:number[]){const tabs=ids.map(k=>this.get(k));this.tabs.clear();for(const t of tabs)this.tabs.set(t.id,t);}
 private async ensureLoaded(tab:Tab){
  if(tab.url===HOME||this.win.isDestroyed())return;if(tab.ready)return tab.ready;if(tab.view)return;
  this.makeView(tab);this.layout();const wc=tab.view!.webContents;
  // A URL that turns into a download is not a page error.
  tab.ready=(async()=>{
   const pending:PendingLoad={urls:new Set()},url=tab.url;this.sessions.navDownloads.set(wc,pending);
   try{
    const history=tab.history;
    if(history){
     try{await wc.navigationHistory.restore(history);}catch{if(!wc.isDestroyed())await wc.loadURL(url);}
     // Chromium's serialized pageState can lag behind DOM scrolling while occluded.
     // Apply the live checkpoint after loading, without waiting for a visible frame; a failed scroll is not a page error.
     if(!wc.isDestroyed())await this.run(wc,1001,({x,y,url})=>{if(location.href===url)scrollTo({left:x,top:y,behavior:'instant'});},history.scroll).catch(()=>{});
    }else await wc.loadURL(url);
   }
   catch(e){if(await this.becameDownload(wc,pending,url,e))delete tab.error;else if(!wc.isDestroyed()&&!tab.block)tab.error=(e as Error).message;}
   finally{delete tab.history;delete tab.sleptAt;delete tab.sleepReason;if(this.sessions.navDownloads.get(wc)===pending)this.sessions.navDownloads.delete(wc);delete tab.ready;if(!this.win.isDestroyed())this.save();}
  })();return tab.ready;
 }
 private makeView(tab:Tab){
  // Pages without their own background paint on this colour; Chrome's canvas is white whatever the OS appearance.
  const view=new WebContentsView({webPreferences:{session:tab.incognito?this.sessions.privateSession():this.sessions.session,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,backgroundThrottling:true}});tab.view=view;this.win.contentView.addChildView(view);view.setBackgroundColor('#ffffff');
  const wc=view.webContents;wc.setWindowOpenHandler(d=>this.openPolicy(tab,false,wc,d));
  // window.close() destroys a page without going through the tab-strip command.
  // Explicit close and sleep detach tab.view first, so they must not close the tab twice.
  wc.once('destroyed',()=>{this.httpsFirst.forget(wc.id);if(tab.view===view&&this.tabs.get(tab.id)===tab&&!this.win.isDestroyed())this.close(tab.id);});
  // Password-field tracking starts with the document, before any agent call reads the page.
  if(!tab.taskId)wc.on('dom-ready',()=>{wc.executeJavaScriptInIsolatedWorld(1001,[{code:pageScript(sensitiveSetup)}]).catch(()=>{});});
  wc.on('did-finish-load',()=>{if(!tab.taskId&&/^https?:/i.test(wc.getURL()))void this.reader.probe(tab,wc);});
  wc.on('did-start-navigation',d=>{if(d.isMainFrame&&!d.isSameDocument){this.reader.onViewDestroy(tab);this.changed();}});
  attachContextMenu(wc,{win:this.win,openTab:(u,a)=>void this.create(u,a,undefined,false,tab.id),search:t=>void this.create('https://www.google.com/search?q='+encodeURIComponent(t),true,undefined,false,tab.id),saveAs:u=>this.saveAs(wc,u)});
  wc.setVisualZoomLevelLimits(1,5).catch(()=>{});
  wc.on('zoom-changed',(_e,dir)=>{this.zoom(tab.id,dir==='in'?'in':'out');});
  wc.on('found-in-page',(_e,r)=>{if(!r.finalUpdate||!tab.find||this.findIds.get(tab)!==r.requestId)return;tab.find={text:tab.find.text,active:r.activeMatchOrdinal,matches:r.matches};this.changed();});
  wc.on('did-navigate',(_e,url)=>{const key=zoomKey(url);if(key)wc.setZoomFactor(this.data.state.zoom[key]??1);wc.setVisualZoomLevelLimits(1,5).catch(()=>{});if(tab.find){wc.stopFindInPage('clearSelection');delete tab.find;this.findIds.delete(tab);this.changed();}});
  wc.on('will-navigate',(event,url)=>{
   if(/^https?:/i.test(url)){if(tab.taskId&&!tab.origins?.includes(originOf(url)))event.preventDefault();return;}
   if(!tab.taskId&&sameOriginBlob(url,wc.getURL()))return;
   event.preventDefault();if(!tab.taskId)void this.openExternal(wc,url);
  });
  wc.on('will-redirect',(event,url)=>{if(tab.taskId&&!tab.origins?.includes(originOf(url)))event.preventDefault();});
  wc.on('did-start-loading',()=>{tab.loading=true;delete tab.error;delete tab.block;this.layout();this.changed();});wc.on('did-stop-loading',()=>{tab.loading=false;this.changed();});
  wc.on('page-title-updated',(_e,title)=>{tab.title=title;this.save();});wc.on('page-favicon-updated',(_e,icons)=>{tab.favicon=icons.find(u=>/^https:/.test(u));this.changed();});
  const navigated=()=>{tab.url=wc.getURL();tab.title=wc.getTitle()||tab.url;const origin=webOrigin(tab.url),kept=this.filled.get(tab.id),tries=this.signupTries.get(tab.id);if(kept&&kept.origin!==origin)this.filled.delete(tab.id);if(tries&&tries.origin!==origin)this.signupTries.delete(tab.id);if(!tab.incognito)this.data.visit(tab.url,tab.title);this.save();};wc.on('did-navigate',()=>{tab.privacy=emptyPrivacy();navigated();});wc.on('did-navigate-in-page',navigated);
  wc.on('did-fail-load',(_e,code,description,url,main)=>{if(main&&code!==-3&&!tab.block){const block=this.httpsFirst.blockFor(wc.id,url,code,description);if(block)this.block(tab,block);else{tab.error=description;tab.loading=false;this.layout();this.changed();}}});
  wc.on('render-process-gone',()=>{this.reader.onViewDestroy(tab);tab.error='페이지 프로세스가 종료되었습니다. 새로고침해 주세요.';this.changed();});
  wc.debugger.on('detach',()=>{if(tab.taskId&&tab.view===view){tab.error='제어 연결이 해제되었습니다.';this.changed();}});
 }
 private openPolicy(tab:Tab,popup:boolean,opener:WebContents,details:Electron.HandlerDetails):Electron.WindowOpenHandlerResponse{
  const {url,disposition,features}=details;if(tab.taskId)return {action:'deny'};
  const blank=url===''||url==='about:blank';if(!(/^https?:/i.test(url)||blank||sameOriginBlob(url,opener.getURL()))){void this.openExternal(opener,url);return {action:'deny'};}
  if(blank&&!(disposition==='new-window'&&(features||popup)))return {action:'deny'};
  if(disposition==='background-tab'){void this.create(url,false,undefined,false,this.tabs.has(tab.id)?tab.id:undefined,undefined,!!tab.incognito);return {action:'deny'};}
  if(disposition==='new-window'&&(features||popup)){const webPreferences={session:opener.session,webSecurity:true,allowRunningInsecureContent:false};return {action:'allow',overrideBrowserWindowOptions:{...popupSize(features),backgroundColor:'#ffffff',show:true,...testWindowOptions(),webPreferences},createWindow:options=>this.openPopup(tab,details,options,webPreferences)};}
  void this.create(url,true,undefined,false,this.tabs.has(tab.id)?tab.id:undefined,undefined,!!tab.incognito);return {action:'deny'};
 }
 // A popup is a Heisen-built container: a strip view showing the page main frame's real origin (popupLabel) above the page view, so a
 // page cannot draw a fake address bar. Parsed window.open features (frame=no, alwaysOnTop, fullscreen, left/top…) never reach it.
 // Electron's typings omit options.webContents: the opener-linked guest it created, which createWindow must return. It is absent only for
 // browser-initiated new windows (shift+click), loaded here.
 private openPopup(tab:Tab,{url,features,referrer,postBody}:Electron.HandlerDetails,{webContents:guest}:Electron.BrowserWindowConstructorOptions&{webContents?:WebContents},webPreferences:Electron.WebPreferences):WebContents{
  const {width,height}=popupSize(features),child=new BaseWindow({width,height:height+POPUP_STRIP,backgroundColor:'#ffffff',show:true,...testWindowOptions()});
  const strip=new WebContentsView({webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}}),stripWc=strip.webContents;
  const view=guest?new WebContentsView({webContents:guest}):new WebContentsView({webPreferences:{...webPreferences,nodeIntegration:false,contextIsolation:true,sandbox:true}}),wc=view.webContents;
  strip.setBackgroundColor('#303030');view.setBackgroundColor('#ffffff');child.contentView.addChildView(strip);child.contentView.addChildView(view);
  // HTML fullscreen gives the page the whole window; the strip returns with the window chrome.
  let full=false;const layout=()=>{if(child.isDestroyed())return;const [w,h]=child.getContentSize(),top=full?0:POPUP_STRIP;strip.setVisible(!full);strip.setBounds({x:0,y:0,width:w,height:POPUP_STRIP});view.setBounds({x:0,y:top,width:w,height:Math.max(1,h-top)});};
  layout();child.on('resize',layout);wc.on('enter-html-full-screen',()=>{full=true;layout();});wc.on('leave-html-full-screen',()=>{full=false;layout();});
  void stripWc.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(popupStripHtml)).catch(()=>{});
  // Text goes in as JSON string literals; the OS title is the origin alone and the page cannot retitle the window.
  const refresh=()=>{
   if(child.isDestroyed()||wc.isDestroyed()||stripWc.isDestroyed())return;let frame='null';try{frame=wc.mainFrame.origin;}catch{/* frame disposed mid-navigation: shown as opaque until the next event */}
   const {warning,origin}=popupLabel(frame,wc.getURL());child.setTitle(origin);
   stripWc.executeJavaScript(`document.getElementById('w').textContent=${JSON.stringify(warning)};document.getElementById('v').textContent=${JSON.stringify(origin)};`).catch(()=>{});
  };
  refresh();wc.on('did-navigate',refresh);wc.on('did-navigate-in-page',refresh);wc.on('did-frame-navigate',(_e,_url,_code,_status,main)=>{if(main)refresh();});wc.on('dom-ready',refresh);wc.on('page-title-updated',e=>e.preventDefault());
  // The container and the page end together: closing the container closes the page (unload runs; a cancelled 'close' would also cancel
  // app quit), and a destroyed page (window.close(), opener gone) takes the container with it.
  wc.once('destroyed',()=>{if(!child.isDestroyed())child.destroy();});
  child.on('closed',()=>{if(!wc.isDestroyed())wc.close();if(!stripWc.isDestroyed())stripWc.close();});
  child.on('focus',()=>{if(!wc.isDestroyed())wc.focus();});
  this.adoptPopup(child,wc,tab);
  if(!guest)void wc.loadURL(url,{httpReferrer:referrer,...(postBody?{postData:postBody.data,extraHeaders:`content-type: ${postBody.contentType}${postBody.boundary?'; boundary='+postBody.boundary:''}`}:{})}).catch(()=>{});
  return wc;
 }
 // Chrome's external protocol prompt (mailto, tel, zoommtg…). 항상 허용 is remembered per origin and scheme; task tabs never get here.
 private async openExternal(wc:WebContents,url:string){
  const scheme=externalScheme(url);if(!scheme||this.prompting.has(wc))return;
  const origin=webOrigin(wc.getURL()),key='external:'+scheme,site=origin&&Object.hasOwn(this.data.state.permissions,origin)?this.data.state.permissions[origin]:undefined,incognito=wc.session!==this.sessions.session,remembered=origin+'\n'+key;
  if(site?.[key]==='block')return;
  if(!(incognito?this.sessions.externalPermissions.get(wc.session)?.has(remembered):site?.[key]==='allow')){
   this.prompting.add(wc);let answer:Electron.MessageBoxReturnValue;
   try{answer=await dialog.showMessageBox(this.popupFor(wc)??BrowserWindow.fromWebContents(wc)??this.win,{type:'question',message:`${scheme} 앱을 여시겠습니까?`,detail:origin??'',buttons:['열기','취소'],defaultId:1,cancelId:1,...(origin?{checkboxLabel:'항상 허용'}:{})});}
   finally{this.prompting.delete(wc);}
   if(answer.response!==0)return;
   if(origin&&answer.checkboxChecked){if(incognito){let known=this.sessions.externalPermissions.get(wc.session);if(!known)this.sessions.externalPermissions.set(wc.session,known=new Set());known.add(remembered);}else{(this.data.state.permissions[origin]||={})[key]='allow';this.data.save();this.changed();}}
  }
  await shell.openExternal(url).catch(()=>{});
 }
 private adoptPopup(child:BaseWindow,wc:WebContents,tab:Tab){
  if(testBackground){quietWindow(child);showWindow(child);}
  this.popups.add(child);this.popupOwner.set(child,tab.id);this.popupPages.set(child,wc);const ses=wc.session;this.sessions.popupSessions.set(child,ses);
  wc.once('destroyed',()=>this.httpsFirst.forget(wc.id));
  let last=wc.getURL();wc.on('did-navigate',(_e,url)=>{last=url;});
  child.on('closed',()=>{this.popups.delete(child);const top=this.tabs.get(tab.id)?.url;if(top&&/^https?:/i.test(last))this.popupClosed(top,last,ses);});
  attachContextMenu(wc,{win:child,openTab:(u,a)=>void this.create(u,a,undefined,false,this.tabs.has(tab.id)?tab.id:undefined,undefined,!!tab.incognito),search:t=>void this.create('https://www.google.com/search?q='+encodeURIComponent(t),true,undefined,false,this.tabs.has(tab.id)?tab.id:undefined,undefined,!!tab.incognito),saveAs:u=>this.saveAs(wc,u)});
  wc.setWindowOpenHandler(d=>this.openPolicy(tab,true,wc,d));
  wc.on('will-navigate',(event,url)=>{if(/^https?:/i.test(url)||sameOriginBlob(url,wc.getURL()))return;event.preventDefault();void this.openExternal(wc,url);});
  wc.setVisualZoomLevelLimits(1,5).catch(()=>{});
 }
 private hidePrevious(id:number){const prev=this.tabs.get(this.active);if(!prev||prev.id===id)return;if(prev.find)this.stopFind(prev.id);prev.hiddenAt=Date.now();void this.pauseVideos(prev);}
 async select(id:number){const t=this.get(id);this.hidePrevious(id);this.active=id;t.lastActiveAt=Date.now();delete t.hiddenAt;this.route=t.url===HOME?'home':'page';this.layout();this.save();await this.ensureLoaded(t);if(this.active===id)void this.resumeVideos(t);}
 isPrompting(wc:WebContents){return this.prompting.has(wc);}
 hasPopupOf(tabId:number){for(const p of this.popups)if(!p.isDestroyed()&&this.popupOwner.get(p)===tabId)return true;return false;}
 popupFor(wc:WebContents){for(const p of this.popups)if(!p.isDestroyed()&&this.popupPages.get(p)===wc)return p;return undefined;}
 async formDirty(tab:Tab):Promise<boolean>{
  const wc=tab.view?.webContents;if(!wc)return false;if(wc.isDestroyed())return true;
  let timer:NodeJS.Timeout|undefined;
  try{return await Promise.race([this.run(wc,1001,()=>{
   const edited=[...document.querySelectorAll('input,textarea,select')].some(el=>{
    if(el instanceof HTMLSelectElement)return [...el.options].some(o=>o.selected!==o.defaultSelected);
    const i=el as HTMLInputElement;if(i.type==='checkbox'||i.type==='radio')return i.checked!==i.defaultChecked;
    if(['hidden','submit','button'].includes(i.type))return false;if(i.type==='file')return !!i.files?.length;
    return i.value!==i.defaultValue;
   });const ce=document.activeElement;return edited||!!(ce&&(ce as HTMLElement).isContentEditable);
  }).catch(()=>true),new Promise<boolean>(resolve=>{timer=setTimeout(()=>resolve(true),1000);})]);}
  finally{clearTimeout(timer);}
 }
 private async pauseVideos(tab:Tab){
  await sleep(0);const wc=tab.view?.webContents;if(this.active===tab.id||!this.data.state.settings.energy.pauseHiddenVideo||!wc||wc.isDestroyed())return;
  await this.run(wc,1001,()=>{const g=globalThis as typeof globalThis&{__heisenPaused?:Set<HTMLVideoElement>},set=(g.__heisenPaused??=new Set<HTMLVideoElement>());for(const v of document.querySelectorAll('video'))if(!v.paused&&v.muted){v.pause();set.add(v);}}).catch(()=>{});
 }
 private async resumeVideos(tab:Tab){
  const wc=tab.view?.webContents;if(!wc||wc.isDestroyed())return;
  await this.run(wc,1001,()=>{const g=globalThis as typeof globalThis&{__heisenPaused?:Set<HTMLVideoElement>},set=g.__heisenPaused;if(set){for(const v of set)if(v.isConnected)void v.play().catch(()=>{});set.clear();}}).catch(()=>{});
 }
 async sleep(id:number,reason:'idle'|'leak'|'pressure'):Promise<boolean>{
  const tab=this.tabs.get(id),view=tab?.view;if(!tab||!view)return false;const wc=view.webContents;
  // Recheck after the asynchronous DOM probe: selection, task state and navigation
  // can change while the sleeper is examining another tab.
  const protectedNow=()=>this.tabs.get(id)!==tab||tab.view!==view||this.active===id||tab.url===HOME||!!tab.ready||tab.loading||wc.isDestroyed()||wc.isLoading()||wc.isCurrentlyAudible()||wc.isBeingCaptured()||wc.isDevToolsOpened()||this.isPrompting(wc)||this.hasPopupOf(id)||!!tab.taskId&&this.taskBusy(tab.taskId)||tab.agentAt!==undefined&&Date.now()-tab.agentAt<600_000;
  if(protectedNow()||await this.formDirty(tab)||protectedNow())return false;
  // Hidden renderers need not commit their latest scroll offset to pageState.
  // Do not discard the renderer if its live position cannot be captured.
  const scroll=await this.run(wc,1001,()=>({x:scrollX,y:scrollY,url:location.href})).catch(()=>null);
  if(!scroll||protectedNow()||wc.getURL()!==scroll.url)return false;
  const entries=wc.navigationHistory.getAllEntries(),index=wc.navigationHistory.getActiveIndex();this.stopFind(id);this.onViewDestroy(tab);
  if(entries.length)tab.history={entries,index,scroll};else delete tab.history;
  this.win.contentView.removeChildView(view);delete tab.view;wc.close();tab.loading=false;tab.readable=false;delete tab.snapshotId;tab.sleptAt=Date.now();tab.sleepReason=reason;this.changed();return true;
 }
 show(route:string){this.route=route;this.layout();this.changed();}
 layout(){if(this.win.isDestroyed())return;const [width,height]=this.win.getContentSize();for(const t of this.tabs.values()){if(!t.view||t.view.webContents.isDestroyed())continue;const visible=t.id===this.active&&this.route==='page'&&!this.modal&&!t.block&&!t.error,b={x:this.sidebar,y:this.top,width:Math.max(1,width-this.sidebar-this.panel),height:Math.max(1,height-this.top)};t.view.setBounds(b);if(t.reader){t.reader.setBounds(b);t.reader.setVisible(visible);}t.view.setVisible(visible&&!t.reader);}}
 // A page that leaves HTML fullscreen during the window's enter animation is still told it is fullscreen (Electron answers it only on the
 // next page resize), and the window returns to its old size, so the page stays fullscreen and document.exitFullscreen() never settles.
 // Once the window is out of fullscreen, a one-pixel resize makes Electron resend the page's real state.
 private async releaseFullscreen(view:WebContentsView){
  const wc=view.webContents;if(wc.isDestroyed()||!await this.run(wc,1001,()=>!!document.fullscreenElement).catch(()=>false)||wc.isDestroyed())return;
  const b=view.getBounds();view.setBounds({...b,height:Math.max(1,b.height-1)});await sleep(50);this.layout();
 }
 get(id:number){const t=this.tabs.get(id);if(!t)throw new Error('탭을 찾을 수 없습니다.');return t;}
 danger(wcId:number,url:string,list:string):void{
  for(const tab of this.tabs.values())if(tab.view?.webContents.id===wcId){this.block(tab,{kind:'danger',url,host:new URL(url).hostname,detail:list,list});return;}
 }
 canBypassDanger(wcId:number):boolean{
  for(const tab of this.tabs.values())if(tab.view?.webContents.id===wcId)return !tab.taskId&&!tab.incognito&&tab.agentAt===undefined;
  return false;
 }
 private block(tab:Tab,block:Block){
  tab.block={...block,canProceed:!tab.taskId&&(block.kind==='http'||block.kind==='danger'&&!tab.incognito&&tab.agentAt===undefined)};tab.loading=false;tab.url=block.url;
  tab.error=`${block.kind==='http'?'안전하지 않은 연결':block.kind==='danger'?'위험한 사이트':'인증서를 확인할 수 없음'} · ${block.host} · ${block.detail}`;
  this.reader.onViewDestroy(tab);this.layout();this.changed();
 }
 async resolveBlock(id:number,action:unknown):Promise<boolean>{
  const tab=this.get(id),block=tab.block;if(!block)return false;
  if(action==='back'){
   delete tab.block;delete tab.error;const wc=tab.view?.webContents;
   if(wc&&wc.navigationHistory.canGoBack())wc.navigationHistory.goBack();else await this.navigate(id,HOME);
   this.layout();this.changed();return true;
  }
  if(action!=='proceed')throw new Error('Invalid action');
  if(tab.taskId||block.canProceed===false)throw new Error('이 탭에서는 계속할 수 없습니다.');
  if(block.kind==='http')this.httpsFirst.allow(block.host);
  else if(block.kind==='danger'&&!tab.incognito&&tab.agentAt===undefined)this.sessions.safeBrowsing.allowOnce(tab.view!.webContents,block.host);
  else throw new Error('이 탭에서는 계속할 수 없습니다.');
  await this.navigate(id,block.url);return true;
 }
 async navigate(id:number,input:string,task?:Task){
  const tab=this.get(id);if(task)this.check(task,id);let {url,fallback}=omnibox(input);if(url===HOME){this.reader.onViewDestroy(tab);delete tab.block;delete tab.error;tab.url=HOME;this.route='home';this.layout();this.save();return;}
  if(fallback&&this.httpsFirst.allowed(new URL(fallback).hostname)){url=fallback;fallback=undefined;}
  if(tab.taskId&&!task)throw new Error('에이전트 탭은 작업을 중단한 뒤 새 탭에서 탐색해 주세요.');if(tab.ready)await tab.ready;if(!tab.view)await this.ensureLoaded(tab);if(!tab.view)this.makeView(tab);if(task)this.check(task,id);
  const wc=tab.view!.webContents,before={url:tab.url,route:this.route},pending:PendingLoad={urls:new Set()};const loading=url;tab.url=url;this.route='page';this.httpsFirst.forget(wc.id);
  if(fallback&&upgradable(fallback,new Set())===url)this.httpsFirst.upgraded.set(wc.id,{from:fallback,to:url,at:Date.now()});
  this.layout();
  this.sessions.navDownloads.set(wc,pending);
  try{
   try{await wc.loadURL(url);}catch(e){if(wc.isDestroyed())throw e;if(tab.block)return;const block=this.httpsFirst.blockFor(wc.id,url,netError(e),(e as Error).message);if(!block)throw e;this.block(tab,block);}
  }catch(e){
   // Like Chrome, a URL that turns into a download leaves the tab on its page without an error.
   if(!await this.becameDownload(wc,pending,loading,e))throw e;
   tab.url=before.url;delete tab.error;if(this.active===id&&this.route==='page')this.route=before.route;this.layout();
  }finally{if(this.sessions.navDownloads.get(wc)===pending)this.sessions.navDownloads.delete(wc);}
  this.save();
 }
 // A navigation that turns into a download rejects loadURL with ERR_ABORTED (-3) or ERR_FAILED (-2), sometimes just before will-download.
 private async becameDownload(wc:WebContents,pending:PendingLoad,url:string,error:unknown){
  const errno=netError(error);if(wc.isDestroyed()||(errno!==-2&&errno!==-3))return false;
  if(!pending.urls.has(url))await new Promise<void>(resolve=>{const timer=setTimeout(resolve,1000);pending.wake=()=>{clearTimeout(timer);resolve();};});
  return pending.urls.has(url);
 }
 close(id:number){
  const tab=this.get(id),order=[...this.tabs.keys()];if(!tab.taskId&&!tab.incognito&&tab.url!==HOME)this.closed=pushClosed(this.closed,{url:tab.url,title:tab.title,index:order.indexOf(id),pinned:tab.pinned});
  const next=this.active===id?closeSelection(order,id,k=>this.tabs.get(k)?.openerId):undefined;
  this.onViewDestroy(tab);if(tab.view){const view=tab.view,wc=view.webContents;this.win.contentView.removeChildView(view);delete tab.view;if(wc&&!wc.isDestroyed())wc.close();}this.tabs.delete(id);this.filled.delete(id);this.signupTries.delete(id);clearTimeout(this.agentTimers.get(tab));
  if(tab.incognito)this.sessions.clearIncognito(()=>windows.all().some(b=>[...b.tabs.values()].some(t=>t.incognito)),new Set(windows.all().flatMap(b=>[...b.popups])));
  // Like Chrome, the closed tab's children inherit its opener.
  for(const t of this.tabs.values())if(t.openerId===id){if(tab.openerId===undefined)delete t.openerId;else t.openerId=tab.openerId;}
  if(this.active===id){if(next!==undefined)void this.select(next);else void this.create();}this.save();
 }
 async reopenClosed(){const c=this.closed.pop();if(!c)return undefined;return this.create(c.url,true,undefined,c.pinned,undefined,c.index);}
 move(id:number,index:number){this.get(id);this.setOrder(moveTab([...this.tabs.keys()],id,index,k=>this.get(k).pinned));this.save();}
 // Chrome's tab context menu at window CSS coordinates. 다른 탭/오른쪽 탭 닫기 keep pinned and task tabs, as Chrome keeps pinned ones.
 tabMenu(id:number,x:number,y:number){
  const tab=this.get(id),order=[...this.tabs.keys()],i=order.indexOf(id);
  const closable=(ids:number[])=>ids.filter(k=>{const t=this.get(k);return !t.pinned&&!t.taskId;});
  const others=closable(order.filter(k=>k!==id)),right=closable(order.slice(i+1));
  const closeAll=(ids:number[])=>{if(ids.includes(this.active)&&this.tabs.has(id))void this.select(id);for(const k of ids)if(this.tabs.has(k))this.close(k);};
  const run=(p:Promise<unknown>)=>void p.catch(()=>{});
  Menu.buildFromTemplate([
   {id:'tab-new-right',label:'새 탭(오른쪽에)',click:()=>run(this.create(HOME,true,undefined,false,undefined,[...this.tabs.keys()].indexOf(id)+1,!!tab.incognito))},
   {id:'tab-new-incognito',label:'새 시크릿 탭',click:()=>run(this.create(HOME,true,undefined,false,undefined,[...this.tabs.keys()].indexOf(id)+1,true))},{type:'separator'},
   {id:'tab-reload',label:'새로고침',click:()=>run(this.command('reload',id))},
   {id:'tab-duplicate',label:'복제',click:()=>run(this.duplicate(id))},
   {id:'tab-pin',label:tab.pinned?'고정 해제':'고정',enabled:!tab.taskId,click:()=>run(this.command('pin',id))},{type:'separator'},
   {id:'tab-close',label:'탭 닫기',click:()=>{if(this.tabs.has(id))this.close(id);}},
   {id:'tab-close-others',label:'다른 탭 닫기',enabled:others.length>0,click:()=>closeAll(others)},
   {id:'tab-close-right',label:'오른쪽 탭 닫기',enabled:right.length>0,click:()=>closeAll(right)},{type:'separator'},
   {id:'tab-reopen',label:'닫은 탭 다시 열기',enabled:this.closed.length>0,click:()=>run(this.reopenClosed())},
  ]).popup({window:this.win,x:Math.round(x)||0,y:Math.round(y)||0});
 }
 async selectIndex(n:number){const ids=[...this.tabs.keys()];const i=shortcutIndex(n,ids.length);if(i>=0)await this.select(ids[i]);}
 async cycle(delta:1|-1){const ids=[...this.tabs.keys()];const i=cycleIndex(ids.indexOf(this.active),ids.length,delta);if(i>=0&&ids[i]!==this.active)await this.select(ids[i]);}
 async duplicate(id:number){const t=this.get(id);return this.create(t.url,true,undefined,!t.taskId&&t.pinned,undefined,[...this.tabs.keys()].indexOf(id)+1,!!t.incognito);}
 zoom(id:number,dir:'in'|'out'|'reset'){
  const tab=this.get(id),wc=tab.view?.webContents,key=zoomKey(tab.url);if(!wc||!key)return 1;
  const factor=stepZoom(wc.getZoomFactor(),dir);for(const t of this.tabs.values())if(t.view&&!!t.incognito===!!tab.incognito&&zoomKey(t.url)===key)t.view.webContents.setZoomFactor(factor);
  if(!tab.incognito){if(factor===1)delete this.data.state.zoom[key];else this.data.state.zoom[key]=factor;this.data.save();}this.changed();return factor;
 }
 find(id:number,text:string){const tab=this.get(id),wc=tab.view?.webContents;if(!wc)return false;if(!text)return this.stopFind(id);tab.find={text,active:0,matches:0};this.findIds.set(tab,wc.findInPage(text,{findNext:true}));this.changed();return true;}
 findNext(forward:boolean){const tab=this.get(this.active),wc=tab.view?.webContents;if(!wc||!tab.find?.text)return false;this.findIds.set(tab,wc.findInPage(tab.find.text,{forward,findNext:false}));return true;}
 stopFind(id:number){const tab=this.get(id);if(!tab.find)return true;tab.view?.webContents.stopFindInPage('keepSelection');delete tab.find;this.findIds.delete(tab);this.changed();return true;}
 toggleDevTools(id:number){const wc=this.get(id).view?.webContents;if(!wc)return false;if(wc.isDevToolsOpened())wc.closeDevTools();else wc.openDevTools({mode:'detach'});return true;}
 print(id:number){const wc=this.get(id).view?.webContents;if(!wc)return false;wc.print({},()=>{});return true;}
 tabForContents(wc:WebContents){for(const t of this.tabs.values())if(t.view?.webContents===wc)return t;const p=this.popupFor(wc),id=p&&this.popupOwner.get(p);return id===undefined?undefined:this.tabs.get(id);}
 // Explicit Save As always uses Electron's save dialog, regardless of the download preference.
 saveAs(wc:WebContents,url:string){this.sessions.askWhere.add(url);wc.downloadURL(url);}
 // A pinned tab moves to the end of the pinned group, an unpinned one to the start of the unpinned tabs (Chrome).
 async command(name:string,id=this.active){const tab=this.get(id),wc=tab.view?.webContents;if(name==='back'&&wc?.navigationHistory.canGoBack())wc.navigationHistory.goBack();if(name==='forward'&&wc?.navigationHistory.canGoForward())wc.navigationHistory.goForward();if(name==='reload')wc?wc.reload():await this.ensureLoaded(tab);if(name==='stop')wc?.stop();if(name==='pin'){tab.pinned=!tab.pinned;this.setOrder(moveTab([...this.tabs.keys()],id,tab.pinned?Infinity:0,k=>this.get(k).pinned));this.save();}if(name==='bookmark'){const found=this.data.state.bookmarks.find(b=>b.url===tab.url);if(found)this.data.state.bookmarks=this.data.state.bookmarks.filter(b=>b!==found);else if(/^https?:/.test(tab.url))this.data.state.bookmarks.push({id:randomUUID(),title:tab.title,url:tab.url});this.save();}}
 agentAllowed(url:string):void{agentAllowed(this.data,url);}
 check(task:Task,tabId?:number){if(this.epochs.get(task.id)!==task.epoch)throw new Error('취소되었거나 만료된 실행입니다.');if(tabId===undefined)return;const tab=this.get(tabId);if(tab.taskId!==task.id||tab.epoch!==task.epoch)throw new Error('작업 소유 탭이 아닙니다.');this.agentAllowed(tab.view?.webContents.getURL()||tab.url);if(tab.block)throw new Error('차단된 페이지입니다: '+tab.block.kind);if(tab.error)throw new Error(tab.error);if(!task.allowedOrigins.includes(originOf(tab.view?.webContents.getURL()??tab.url)))throw new Error('허용된 사이트 범위를 벗어났습니다.');return tab;}
 async tool(task:Task,method:string,args:any):Promise<any>{
  if(method==='epoch'){const current=this.epochs.get(task.id)||0;if(task.epoch<current)throw new Error('Stale epoch');this.epochs.set(task.id,task.epoch);return {ok:true};}
  this.check(task);
  if(method==='open'){this.agentAllowed(args.url);if(!task.allowedOrigins.includes(originOf(args.url)))throw new Error('허용되지 않은 사이트입니다.');const tab=await this.create(args.url,false,{id:task.id,epoch:task.epoch,origins:task.allowedOrigins});this.check(task,tab.id);return {tabId:tab.id,url:tab.url};}
  if(method==='tabs')return [...this.tabs.values()].filter(t=>t.taskId===task.id&&t.epoch===task.epoch).map(t=>({tabId:t.id,...this.masked(t.id,{title:t.title,url:t.url}),active:t.id===this.active,loading:t.loading}));
  const tab=this.check(task,args.tabId)!;await this.ensureLoaded(tab);this.check(task,tab.id);const wc=tab.view!.webContents;
  if(method==='observe')return this.observe(tab.id);
  if(method==='loginInfo')return this.loginInfo(wc);
  if(method==='login')return this.fillLogin(tab,wc,String(args.origin));
  if(method==='signupInfo')return this.signupInfo(tab,wc);
  if(method==='signup')return this.fillSignup(tab,wc,String(args.origin));
  if(method==='markdown'){const result=await this.run(wc,1001,markdownScript);this.check(task,tab.id);return redact(result,this.secretsFor(tab,wc));}
  if(method==='navigate'){
   this.agentAllowed(args.url);if(!task.allowedOrigins.includes(originOf(args.url)))throw new Error('허용되지 않은 사이트입니다.');
   await this.navigate(tab.id,args.url,task);await this.awaitLoaded(tab.id);
  }else{
   if(method!=='click'&&method!=='fill'&&method!=='press'&&method!=='scroll'&&method!=='select'&&method!=='wait')throw new Error('지원하지 않는 브라우저 명령입니다.');
   await this.showTab(tab,wc);this.check(task,tab.id);
   // Task debuggers stay attached: unexpected detachment invalidates the tab in makeView.
   await this.act(tab,wc,method==='fill'?'type':method,args,args.snapshot,task.allowedOrigins,()=>this.check(task,tab.id));
  }
  this.check(task,tab.id);await this.settle(wc);this.check(task,tab.id);
  const s=await this.agentSnapshot(tab,wc);this.check(task,tab.id);return {ok:true,...redact(s,this.secretsFor(tab,wc)) as Observation};
 }
 async observe(id:number):Promise<Observation>{const tab=this.get(id);if(tab.incognito)throw new Error('탭을 찾을 수 없습니다.');await this.ensureLoaded(tab);if(tab.block)throw new Error('차단된 페이지입니다: '+tab.block.kind);if(!tab.view)throw new Error('웹 페이지를 먼저 여세요.');const wc=tab.view.webContents;return redact(await this.agentSnapshot(tab,wc),this.secretsFor(tab,wc)) as Observation;}
 private async awaitLoaded(id:number){await sleep(100);for(let i=0;i<150&&this.get(id).loading;i++)await sleep(100);}
 async openForAgent(url:string,active:boolean){
  this.agentAllowed(url);
  const tab=await this.create(url,false);tab.agentAt=Date.now();await this.ensureLoaded(tab);if(active)await this.select(tab.id);return tab;
 }
 // External agent (MCP) access to the user's own tabs. Calls on one tab run one at a time. The active tab is left alone except for
 // click/type/press/scroll/screenshot: a hidden view gets no input events and captures empty (verified), so those select the tab first.
 async agent(tabId:number,method:AgentMethod,args:any={}):Promise<unknown>{
  const tab=this.get(tabId);if(tab.incognito)throw new Error('탭을 찾을 수 없습니다.');if(tab.taskId)throw new Error('작업 탭은 다룰 수 없습니다.');
  this.agentAllowed(tab.view?.webContents.getURL()||tab.url);
  const run=(this.agentQueues.get(tab)??Promise.resolve()).catch(()=>{}).then(async()=>{const out=await this.agentStep(tab,method,args);const wc=tab.view?.webContents;return method==='screenshot'||!wc||wc.isDestroyed()?out:redact(out,this.secretsFor(tab,wc));});
  this.agentQueues.set(tab,run);return run;
 }
 private async agentStep(tab:Tab,method:AgentMethod,args:any):Promise<unknown>{
  if(!this.tabs.has(tab.id))throw new Error('탭을 찾을 수 없습니다.');
  this.agentAllowed(tab.view?.webContents.getURL()||tab.url);
  await this.ensureLoaded(tab);
  if(!this.tabs.has(tab.id))throw new Error('탭을 찾을 수 없습니다.');
  this.agentAllowed(tab.view?.webContents.getURL()||tab.url);
  if(tab.block)throw new Error('차단된 페이지입니다: '+tab.block.kind);
  tab.agentAt=Date.now();
  const url=new URL(tab.url),danger=this.sessions.safeBrowsing.check(url.hostname);
  if(danger.listed){this.danger(tab.view?.webContents.id??-1,tab.url,danger.list!);throw new Error('차단된 페이지입니다: danger');}
  const wc=tab.view?.webContents;if(!wc||wc.isDestroyed())throw new Error('웹 페이지를 먼저 여세요.');
  clearTimeout(this.agentTimers.get(tab));this.agentTimers.set(tab,setTimeout(()=>this.changed(),8100));this.changed();
  try{
   switch(method){
    case 'snapshot':return await this.agentSnapshot(tab,wc);
    case 'markdown':return await this.run(wc,1001,markdownScript);
    case 'screenshot':{await this.showTab(tab,wc);await this.screenGuard(tab,wc);const image=await wc.capturePage();if(image.isEmpty())throw new Error('화면을 캡처할 수 없습니다.');return (image.getSize().width>1280?image.resize({width:1280}):image).toPNG().toString('base64');}
    case 'loginInfo':return this.loginInfo(wc);
    case 'login':return await this.fillLogin(tab,wc,typeof args.origin==='string'?args.origin:undefined);
    case 'signupInfo':return this.signupInfo(tab,wc);
    case 'signup':return await this.fillSignup(tab,wc,typeof args.origin==='string'?args.origin:undefined);
    case 'click':case 'type':case 'press':case 'scroll':await this.showTab(tab,wc);await this.act(tab,wc,method,args,tab.snapshotId);break;
    case 'select':case 'upload':case 'wait':await this.act(tab,wc,method,args,tab.snapshotId);break;
    default:throw new Error('지원하지 않는 브라우저 명령입니다.');
   }
   await this.settle(wc);return await this.agentSnapshot(tab,wc);
  }finally{releaseDebugger(wc);}
 }
 private style():InputStyle{return this.data.state.settings.agent.humanize?'human':'fast';}
 private async act(tab:Tab,wc:WebContents,method:'click'|'type'|'press'|'scroll'|'select'|'upload'|'wait',args:any,snapshotId:string|undefined,origins?:string[],beforeKey?:()=>void):Promise<void>{
  const style=this.style();beforeKey?.();
  switch(method){
   case 'click':{const p=await this.target(wc,{snapshot:snapshotId,ref:String(args.ref),method:'click',origins});beforeKey?.();await click(wc,p.x,p.y,style);break;}
   case 'type':{await this.target(wc,{snapshot:snapshotId,ref:String(args.ref),method:'fill',origins});beforeKey?.();await selectAll(wc,style);await typeText(wc,String(args.text??''),style,beforeKey);if(args.submit===true){beforeKey?.();await pressKey(wc,'Enter',style);}break;}
   case 'press':{if(!Object.hasOwn(KEYS,args.key))throw new Error('지원하지 않는 키입니다.');await pressKey(wc,args.key,style);break;}
   case 'scroll':{if(args.direction!=='up'&&args.direction!=='down')throw new Error('지원하지 않는 스크롤 방향입니다.');const amount=Math.max(1,Math.min(10000,Number(args.amount)||600)),{width,height}=tab.view!.getBounds(),zoom=wc.getZoomFactor();await wheel(wc,width/2/zoom,height/2/zoom,args.direction==='down'?amount:-amount,style);break;}
   case 'select':{const r=await this.run(wc,1001,selectOptionScript,{snapshot:snapshotId,ref:String(args.ref),value:String(args.value??'')},true);if('error' in r)throw new Error(r.error);break;}
   case 'upload':await this.upload(wc,tab,String(args.ref),String(args.path));break;
   case 'wait':{
    const until=Date.now()+Math.min(30000,Math.max(100,Number(args.timeoutMs)||10000));
    while(Date.now()<until){
     beforeKey?.();
     if(args.load===true&&wc.isLoading()){await sleep(100);continue;}
     if(typeof args.text==='string'&&args.text){const hit=await this.run(wc,1001,(t:string)=>!!document.body&&document.body.innerText.includes(t),args.text);if(!hit){await sleep(100);continue;}}
     return;
    }
    throw new Error('기다리는 조건이 충족되지 않았습니다.');
   }
  }
 }
 private async showTab(tab:Tab,wc:WebContents){
  this.reader.close(tab);
  if(this.modal)throw new Error('열려 있는 대화상자를 닫은 뒤 다시 시도하세요.');
  if(this.active!==tab.id||this.route!=='page')await this.select(tab.id);
  if(await this.pageVisible(wc))return;
  if(this.win.isMinimized())this.win.restore();this.win.showInactive();
  if(!await this.pageVisible(wc))throw new Error(HIDDEN);
 }
 // document.visibilityState read from the isolated world; polls up to 1.5 s after a tab switch or window restore.
 private async pageVisible(wc:WebContents){for(let i=0;i<30;i++){if(await this.run(wc,1001,()=>document.visibilityState)==='visible')return true;await sleep(50);}return false;}
 private async agentSnapshot(tab:Tab,wc:WebContents):Promise<Observation>{const s=await this.run(wc,1001,snapshotScript);tab.snapshotId=s.snapshot;return {...s,loading:wc.isLoading()};}
 // Waits for a navigation the action started: up to 5 s once loading begins, 100 ms if it never does.
 private settle(wc:WebContents){return new Promise<void>(resolve=>{let started=wc.isLoading();const start=()=>{started=true;};const done=()=>{clearTimeout(quiet);clearTimeout(limit);wc.off('did-start-loading',start);wc.off('did-stop-loading',done);resolve();};const quiet=setTimeout(()=>{if(!started)done();},100),limit=setTimeout(done,5000);wc.on('did-start-loading',start);wc.on('did-stop-loading',done);});}
 private async upload(wc:WebContents,tab:Tab,ref:string,file:string){
  await ensureDebugger(wc);const nonce=randomUUID();
  const {root}=await wc.debugger.sendCommand('DOM.getDocument',{depth:0});
  const mark=await this.run(wc,1001,markUploadScript,{snapshot:tab.snapshotId,ref,nonce});if('error' in mark)throw new Error(mark.error);
  try{const {nodeId}=await wc.debugger.sendCommand('DOM.querySelector',{nodeId:root.nodeId,selector:`[data-heisen-upload="${nonce}"]`});if(!nodeId)throw new Error('파일 입력란을 찾을 수 없습니다.');await wc.debugger.sendCommand('DOM.setFileInputFiles',{files:[file],nodeId});}
  finally{await this.run(wc,1001,unmarkUploadScript,nonce).catch(()=>{});}
 }
 private loginInfo(wc:WebContents){if(!this.vaultEnabled())throw new Error(VAULT_OFF);const origin=originOf(wc.getURL());return {origin,username:this.vaultLookup(origin)[0]?.username??null};}
 private async fillLogin(tab:Tab,wc:WebContents,expected?:string){
  if(!this.vaultEnabled())throw new Error(VAULT_OFF);
  const origin=originOf(wc.getURL());if(expected!==undefined&&origin!==expected)throw new Error('페이지 주소가 바뀌어 입력하지 않았습니다.');
  const account=this.vaultLookup(origin)[0];if(!account)throw new Error('이 사이트에 저장된 비밀번호가 없습니다.');
  const r=await this.run(wc,1002,fillLoginScript,{origin,username:account.username,password:account.password},true);if('error' in r)throw new Error(r.error);
  this.rememberSecret(tab.id,account.password);
  return {ok:true as const,username:account.username};
 }
 // Sign-up preflight for the approval: this attempt's email and whether the vault already holds an account under the default email
 // (aliased or not). Accounts this tab's earlier attempts saved on the origin do not count, so a retry is not refused.
 private signupInfo(tab:Tab,wc:WebContents){
  if(!this.vaultEnabled())throw new Error(VAULT_OFF);
  const origin=originOf(wc.getURL()),p=this.signup,tries=this.signupTries.get(tab.id),attempts=tries?.origin===origin?tries.attempts:0;
  const emails=p?[p.email(origin,0),p.email(origin,1)]:[];
  return {origin,email:p?p.email(origin,attempts):null,mode:p?p.mode():'generate' as const,existing:attempts===0&&this.vaultLookup(origin).some(v=>!!v.username&&emails.includes(v.username))};
 }
 // Fills the default email and a password the provider picks for the form's inferred rules, and saves it to the vault at once (D10).
 // At most 3 password fills per tab and origin; retries use the plain email and skip presets already tried. A page that asks only for
 // the email (two-step sign-up) gets the email alone, which is not an attempt and saves nothing.
 private async fillSignup(tab:Tab,wc:WebContents,expected?:string){
  const origin=originOf(wc.getURL());if(expected!==undefined&&origin!==expected)throw new Error('페이지 주소가 바뀌어 입력하지 않았습니다.');
  if(!this.vaultEnabled())throw new Error(VAULT_OFF);
  const p=this.signup;if(!p)throw new Error(NO_EMAIL);
  let tries=this.signupTries.get(tab.id);if(tries?.origin!==origin){tries={origin,attempts:0,tried:[]};this.signupTries.set(tab.id,tries);}
  if(tries.attempts>=3)throw new Error('같은 사이트에서 3번 시도했습니다.');
  const email=p.email(origin,tries.attempts);if(!email)throw new Error(NO_EMAIL);
  const scan=await this.run(wc,1001,signupScanScript);if(!scan.found)throw new Error('가입 양식을 찾을 수 없습니다.');
  const pick=scan.passwordFields?p.password(parseRules(scan.rules),tries.tried):undefined;
  const r=await this.run(wc,1002,fillSignupScript,{origin,email,password:pick?.password},true);if('error' in r)throw new Error(r.error);
  if(pick&&r.filled.password){
   this.rememberSecret(tab.id,pick.password);tries.attempts++;if(pick.preset)tries.tried.push(pick.preset.id);
   p.record({origin,username:scan.username||email,password:pick.password,preset:pick.preset?.name,by:'agent'});
  }
  return {ok:true as const,email,filled:r.filled,preset:pick?.preset?.name,attempt:tries.attempts};
 }
 // Masks known secrets of the tab's current origin in an agent-bound value (e.g. tab titles and URLs).
 masked<T>(tabId:number,value:T):T{const tab=this.tabs.get(tabId),wc=tab?.view?.webContents;return !tab||!wc||wc.isDestroyed()?value:redact(value,this.secretsFor(tab,wc)) as T;}
 // Records a password filled into the tab's current page so agent output from that origin masks it.
 rememberSecret(tabId:number,password:string){
  const wc=this.tabs.get(tabId)?.view?.webContents,origin=wc&&!wc.isDestroyed()?webOrigin(wc.getURL()):null;if(!origin||password.length<4)return;
  let kept=this.filled.get(tabId);if(kept?.origin!==origin){kept={origin,values:new Set()};this.filled.set(tabId,kept);}
  kept.values.add(password);
 }
 // Saved passwords for the page's origin plus passwords filled into this tab there; 4+ characters, longest first.
 private secretsFor(tab:Tab,wc:WebContents){
  const origin=webOrigin(wc.getURL());if(!origin)return [];
  const kept=this.filled.get(tab.id),all=new Set(this.vaultLookup(origin).map(v=>v.password));
  if(kept?.origin===origin)for(const v of kept.values)all.add(v);
  return [...all].filter(s=>s.length>=4).sort((a,b)=>b.length-a.length);
 }
 // Refuses a capture while a password is readable on screen. Known secrets stay in the main process: the page reports its text and
 // visible field values, and the comparison happens here.
 private async screenGuard(tab:Tab,wc:WebContents){
  const page=await this.run(wc,1001,screenCheckScript),secrets=this.secretsFor(tab,wc);
  if(page.revealed||secrets.some(s=>page.text.includes(s)||page.values.some(v=>v.includes(s))))throw new Error('비밀번호가 화면에 표시되어 있어 스크린샷을 찍을 수 없습니다.');
 }
 private async target(wc:WebContents,a:Parameters<typeof targetScript>[0]){const point=await this.run(wc,1001,targetScript,a,true);if('error' in point)throw new Error(point.error);return point;}
 private run<A,R>(wc:WebContents,world:number,fn:(arg:A)=>R,arg?:A,userGesture=false):Promise<R>{return wc.executeJavaScriptInIsolatedWorld(world,[{code:(world===1001?pageScript(sensitiveSetup)+';':'')+pageScript(fn,arg)}],userGesture);}
}

// Register once; resolve the caller before awaiting so concurrent windows stay isolated.
export function installBrowserRpc(registry:Windows){
 registerRpc({
  'chrome.top':a=>{const b=registry.current();b.top=Math.max(92,Math.min(176,Number(a.top)||124));b.layout();return true;},
  'tab.reopen':async()=>(await registry.current().reopenClosed())?.id??null,
  'tab.selectIndex':async a=>{await registry.current().selectIndex(Number(a.n));return true;},
  'tab.cycle':async a=>{if(a.delta!==1&&a.delta!==-1)throw new Error('Invalid delta');await registry.current().cycle(a.delta);return true;},
  'tab.duplicate':async a=>{const b=registry.current();return (await b.duplicate(a.id===undefined?b.active:Number(a.id))).id;},
  'tab.move':a=>{registry.current().move(Number(a.id),Number(a.index));return true;},
  'tab.menu':a=>{registry.current().tabMenu(Number(a.id),Number(a.x),Number(a.y));return true;},
  'tab.block':a=>registry.current().resolveBlock(Number(a.id),a.action),
  'safebrowsing.update':async()=>{const b=registry.current();await b.sessions.safeBrowsing.update(true);b.changed();return true;},
  'download.keep':a=>registry.current().sessions.keep(String(a.id)),
  'download.discard':a=>registry.current().sessions.discard(String(a.id)),
  'tab.zoom':a=>{if(!['in','out','reset'].includes(a.dir))throw new Error('Invalid zoom');const b=registry.current();return b.zoom(a.id===undefined?b.active:Number(a.id),a.dir);},
  'find.start':a=>{const b=registry.current();return b.find(b.active,textArg(a.text,1000));},
  'find.next':a=>registry.current().findNext(a.forward!==false),
  'find.stop':()=>{const b=registry.current();return b.stopFind(b.active);},
  'reader.toggle':a=>{const b=registry.current();return b.reader.toggle(a.id===undefined?b.active:Number(a.id));},
  'reader.set':a=>{registry.current().reader.set(a);return true;},
 });
}
