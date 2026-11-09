import {app,type Session,type WebContents} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {FiltersEngine,Request} from '@ghostery/adblocker';
import {emptyPrivacy,type Browser,type Tab} from './browser.ts';
import type {Windows} from './windows.ts';
import type {Data} from './data.ts';
import {registerRpc,registerState} from './rpc.ts';
import {textArg} from './protocol.ts';
import {siteOf,crossSite,stripTracking,grantKey,cookieBlocked,pruneGrants,CLIENT_HINT_HEADERS,stripHeaders,trimReferrer} from './privacy-util.ts';

// Electron keeps only the last listener for each webRequest event. Shield owns these
// listeners on every web session; other protections must compose through rules.
export type ShieldRule={before?(d:Electron.OnBeforeRequestListenerDetails):{cancel?:boolean;redirectURL?:string}|undefined;headers?(d:Electron.OnHeadersReceivedListenerDetails):Record<string,string[]>|undefined};
type RequestContext=Pick<Electron.OnBeforeRequestListenerDetails,'url'|'resourceType'|'frame'|'webContents'|'initiatorOrigin'>;
const GRANT_MS=30*24*60*60*1000;
export class Shield {
 rules:ShieldRule[]=[];
 private trackers?:FiltersEngine;private ads?:FiltersEngine;private extra?:FiltersEngine;
 private privateGrants=new WeakMap<Session,Record<string,number>>();
 private bumpTimers=new Map<number,NodeJS.Timeout>();
 private watched=new WeakSet<WebContents>();private pendingParams=new Map<number,number>();
 constructor(private windows:Windows,private data:Data,private changed:()=>void,private filtersDir:string){}
 attachBrowser(browser:Browser):void{browser.shield=this;browser.popupClosed=(top,url,ses)=>this.grant(top,url,ses);}
 install():void{
  const rss=process.memoryUsage().rss;
  this.trackers=this.load('easyprivacy');this.refresh();
  if(!app.isPackaged&&process.env.HEISEN_TEST_FILTERS)this.extra=FiltersEngine.parse(fs.readFileSync(process.env.HEISEN_TEST_FILTERS,'utf8'),{loadCosmeticFilters:false});
  console.log(`Shield filters: +${Math.round((process.memoryUsage().rss-rss)/1048576)} MiB`);
  this.data.state.privacy.grants=pruneGrants(this.data.state.privacy.grants,Date.now());
  this.windows.sessions.configureSessions(ses=>this.attach(ses));
  registerRpc({
   'privacy.site':a=>{this.setSite(textArg(a.site,253),a.protect===true);return true;},
   'privacy.grants':()=>Object.keys(pruneGrants(this.data.state.privacy.grants,Date.now())),
  });
  registerState('privacyOff',()=>Object.keys(this.data.state.privacy.sites));
 }
 refresh():void{if(this.data.state.settings.privacy.ads)this.ads??=this.load('easylist');else this.ads=undefined;}
 private load(name:string):FiltersEngine{return FiltersEngine.deserialize(fs.readFileSync(path.join(this.filtersDir,name+'.bin')));}
 siteOf(url:string):string|null{return siteOf(url);}
 protectedSite(url:string):boolean{const site=siteOf(url);return !site||this.data.state.privacy.sites[site]?.protect!==false;}
 private attach(ses:Session):void{
  if(ses!==this.windows.sessions.session)this.privateGrants.set(ses,{});
  // Keep Chromium's storage partitioning/isolation defaults. Cross-site network
  // cookies are stripped here without injecting into page scripts.
  const filter={urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']};
  ses.webRequest.onBeforeRequest(filter,(d,cb)=>{
   for(const rule of this.rules){const out=rule.before?.(d);if(out&&(out.cancel||out.redirectURL)){cb(out);return;}}
   cb(this.before(d));
  });
  ses.webRequest.onBeforeSendHeaders(filter,(d,cb)=>cb({requestHeaders:this.requestHeaders(d,ses)}));
  ses.webRequest.onHeadersReceived(filter,(d,cb)=>{
   let headers=d.responseHeaders;
   for(const rule of this.rules){const out=rule.headers?.(headers===d.responseHeaders?d:{...d,responseHeaders:headers});if(out)headers=out;}
   cb({responseHeaders:this.responseHeaders(d,headers,ses)});
  });
 }
 private context(d:RequestContext):{tab?:Tab;topUrl?:string;protected:boolean}{
  const wc=d.webContents&&!d.webContents.isDestroyed()?d.webContents:undefined;
  const tab=wc?this.windows.tabForContents(wc):undefined;
  // During navigation frame.top still names the old document. The destination
  // (including each redirect and popup login) is first-party, not that old page.
  let topUrl=d.resourceType==='mainFrame'?d.url:undefined;
  if(!topUrl){try{topUrl=d.frame?.top?.url;}catch{/* A detached frame has no live top. */}}
  if(!siteOf(topUrl))topUrl=wc?.getURL();
  if(!siteOf(topUrl))topUrl=d.initiatorOrigin;
  return {tab,topUrl,protected:this.protectedSite(topUrl||'')};
 }
 private before(d:Electron.OnBeforeRequestListenerDetails):Electron.CallbackResponse{
  const ctx=this.context(d),settings=this.data.state.settings.privacy;
  if(d.webContents&&ctx.tab)this.watch(d.webContents,ctx.tab);
  if(!ctx.protected)return {};
  if(d.resourceType==='mainFrame'&&ctx.topUrl&&settings.stripParams&&(!siteOf(d.referrer)||crossSite(siteOf(d.referrer),siteOf(d.url)))){
   const stripped=stripTracking(d.url);
   if(stripped.removed.length){
    if(ctx.tab&&d.webContents)this.pendingParams.set(d.webContents.id,(this.pendingParams.get(d.webContents.id)||0)+1);
    return {redirectURL:stripped.url};
   }
  }
  if(d.resourceType==='mainFrame')return {};
  const engines=[settings.trackers?this.trackers:undefined,settings.ads?this.ads:undefined,this.extra];
  if(!engines.some(Boolean))return {};
  const req=Request.fromRawDetails({url:d.url,type:d.resourceType,sourceUrl:ctx.topUrl,requestId:String(d.id),tabId:ctx.tab?.id??0});
  for(const engine of engines){
   if(!engine)continue;const match=engine.match(req);
   if(match.match){
    if(ctx.tab){const pv=ctx.tab.privacy??=emptyPrivacy();pv.blocked++;pv.hosts[req.hostname]=(pv.hosts[req.hostname]||0)+1;this.bump(ctx.tab);}
    return match.redirect?{redirectURL:match.redirect.dataUrl}:{cancel:true};
   }
  }
  return {};
 }
 private blocked(d:RequestContext,topUrl:string|undefined,ses:Session):boolean{
  return cookieBlocked({requestUrl:d.url,topUrl,policy:this.data.state.settings.privacy.thirdPartyCookies,grants:this.grantsFor(ses),sites:this.data.state.privacy.sites,now:Date.now()});
 }
 private requestHeaders(d:Electron.OnBeforeSendHeadersListenerDetails,ses:Session):Record<string,string>{
  const ctx=this.context(d);let headers=d.requestHeaders;if(!ctx.protected)return headers;
  if(this.blocked(d,ctx.topUrl,ses)){
   const stripped=stripHeaders(headers,['cookie']);headers=stripped.headers;
   if(stripped.removed&&ctx.tab){(ctx.tab.privacy??=emptyPrivacy()).cookies++;this.bump(ctx.tab);}
  }
  if(this.data.state.settings.privacy.clientHints)headers=stripHeaders(headers,CLIENT_HINT_HEADERS).headers;
  for(const name of Object.keys(headers))if(name.toLowerCase()==='referer'){
   const ref=trimReferrer(headers[name],d.url);if(ref!==undefined)headers={...headers,[name]:ref};break;
  }
  return headers;
 }
 private responseHeaders(d:Electron.OnHeadersReceivedListenerDetails,headers:Record<string,string[]>|undefined,ses:Session):Record<string,string[]>|undefined{
  const ctx=this.context(d);if(!headers||!ctx.protected||!this.blocked(d,ctx.topUrl,ses))return headers;
  let result=headers,removed=false;
  for(const name of Object.keys(headers))if(name.toLowerCase()==='set-cookie'){if(result===headers)result={...headers};delete result[name];removed=true;}
  if(removed&&ctx.tab){(ctx.tab.privacy??=emptyPrivacy()).cookies++;this.bump(ctx.tab);}
  return result;
 }
 storageAccess(wc:WebContents,requestingUrl:string):boolean{
  const tab=this.windows.tabForContents(wc);if(!tab||tab.taskId||wc.isDestroyed())return false;
  const top=siteOf(wc.getURL()),third=siteOf(requestingUrl);if(!top||!third||!crossSite(top,third))return false;
  // Private browsing never consults or persists the regular profile's history/grants.
  const visited=wc.session===this.windows.sessions.session?this.data.state.history.some(h=>siteOf(h.url)===third):this.hasGrant(wc.session,wc.getURL(),requestingUrl);
  if(!visited)return false;this.grant(wc.getURL(),requestingUrl,wc.session);return true;
 }
 hasGrant(ses:Session,topUrl:string,thirdUrl:string):boolean{
  const top=siteOf(topUrl),third=siteOf(thirdUrl);return !!top&&!!third&&crossSite(top,third)&&this.grantsFor(ses)[grantKey(top,third)]>Date.now();
 }
 private grantsFor(ses:Session):Record<string,number>{
  if(ses===this.windows.sessions.session)return this.data.state.privacy.grants;
  let grants=this.privateGrants.get(ses);if(!grants){grants={};this.privateGrants.set(ses,grants);}return grants;
 }
 private grant(topUrl:string,url:string,ses:Session):void{
  const top=siteOf(topUrl),third=siteOf(url);if(!top||!third||!crossSite(top,third))return;
  const grants=this.grantsFor(ses),now=Date.now();for(const key of Object.keys(grants))if(grants[key]<=now)delete grants[key];
  grants[grantKey(top,third)]=now+GRANT_MS;if(ses===this.windows.sessions.session)this.data.save();this.changed();
 }
 private setSite(site:string,protect:boolean):void{
  // RPC accepts the canonical site shown by publicTabs, not URLs or object keys.
  if(siteOf('https://'+site)!==site||/[/?#@]/.test(site))throw new Error('Invalid site');
  if(protect)delete this.data.state.privacy.sites[site];else this.data.state.privacy.sites[site]={protect:false};
  this.data.save();for(const browser of this.windows.all())for(const tab of browser.tabs.values())if(siteOf(tab.url)===site&&tab.view&&!tab.view.webContents.isDestroyed())tab.view.webContents.reload();this.changed();
 }
 private watch(wc:WebContents,tab:Tab):void{
  if(this.watched.has(wc))return;this.watched.add(wc);const id=wc.id;
  // Browser resets privacy in its earlier did-navigate listener. Flush afterwards,
  // including documents with no subresources (which have no later request).
  wc.on('did-navigate',()=>{const count=this.pendingParams.get(id);this.pendingParams.delete(id);if(count){(tab.privacy??=emptyPrivacy()).params+=count;this.bump(tab);}});
  wc.on('did-stop-loading',()=>this.pendingParams.delete(id));
  wc.once('destroyed',()=>{this.pendingParams.delete(id);const timer=this.bumpTimers.get(tab.id);if(timer){clearTimeout(timer);this.bumpTimers.delete(tab.id);}});
 }
 private bump(tab:Tab):void{
  if(this.bumpTimers.has(tab.id))return;
  const timer=setTimeout(()=>{this.bumpTimers.delete(tab.id);if(this.windows.byTab(tab.id))this.changed();},500);timer.unref();this.bumpTimers.set(tab.id,timer);
 }
}
