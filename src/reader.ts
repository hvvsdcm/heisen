import {app,nativeTheme,WebContentsView,type WebContents} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import type {Browser,Tab} from './browser.ts';
import type {Data} from './data.ts';
import type {Article} from './readable.ts';
const UNAVAILABLE='읽기 도구를 사용할 수 없습니다.';
const THEMES={light:{fg:'#1d1d1f',bg:'#ffffff',muted:'#6e6e73',link:'#0066cc'},sepia:{fg:'#5b4636',bg:'#f4ecd8',muted:'#8a7a66',link:'#7a5230'},dark:{fg:'#e5e5e7',bg:'#1c1c1e',muted:'#98989d',link:'#6cb4ff'}};
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export class Reader {
 private probeCode?:string;private extractCode?:string;
 private probes=new WeakMap<Tab,object>();private opening=new WeakMap<Tab,object>();
 private css=new WeakMap<WebContentsView,string>();private updates=new WeakMap<WebContentsView,Promise<void>>();
 constructor(private browser:Browser,private data:Data,private changed:()=>void){}
 install(){
  const update=()=>{if(this.data.state.settings.reader.theme==='auto')this.refresh();};
  nativeTheme.on('updated',update);
  this.browser.win.once('closed',()=>{nativeTheme.off('updated',update);for(const tab of this.browser.tabs.values())this.onViewDestroy(tab);});
 }
 private current(tab:Tab,wc:WebContents){return !this.browser.win.isDestroyed()&&this.browser.tabs.get(tab.id)===tab&&tab.view?.webContents===wc&&!wc.isDestroyed();}
 async probe(tab:Tab,wc:WebContents):Promise<void>{
  const token={};this.probes.set(tab,token);await sleep(300);
  const current=()=>this.probes.get(tab)===token&&this.current(tab,wc)&&!tab.taskId&&!tab.error&&/^https?:/i.test(wc.getURL());
  if(!current())return;let readable=false;
  try{this.probeCode??=fs.readFileSync(path.join(app.getAppPath(),'dist','readable-probe.js'),'utf8');readable=!!await wc.executeJavaScriptInIsolatedWorld(1001,[{code:this.probeCode+';__heisenReadable.probe()'}]);}catch{}
  if(current()){this.probes.delete(tab);tab.readable=readable;this.changed();}
 }
 async toggle(id:number):Promise<boolean>{
  const tab=this.browser.get(id);if(tab.reader||this.opening.has(tab)){this.close(tab);return false;}return this.open(id);
 }
 async open(id:number):Promise<boolean>{
  const tab=this.browser.get(id),wc=tab.view?.webContents;
  if(tab.reader)return true;
  if(!wc||!this.current(tab,wc)||tab.taskId||tab.error||!/^https?:/i.test(wc.getURL())||wc.isLoadingMainFrame()||this.opening.has(tab))throw new Error(UNAVAILABLE);
  const token={},url=wc.getURL();this.opening.set(tab,token);let view:WebContentsView|undefined;
  const current=()=>this.opening.get(tab)===token&&this.current(tab,wc);
  try{
   this.extractCode??=fs.readFileSync(path.join(app.getAppPath(),'dist','readable.js'),'utf8');
   const article=await wc.executeJavaScriptInIsolatedWorld(1001,[{code:this.extractCode+`;(()=>{
    const article=__heisenReadable.extract();if(!article)return null;
    const doc=new DOMParser().parseFromString(article.content,'text/html'),heading=doc.querySelector('h1,h2');
    const normalize=text=>text.normalize('NFC').replace(/\\s+/g,' ').trim();
    // Readability may retain the source title, and converts retained h1s to h2s.
    if(heading&&normalize(article.title)&&normalize(heading.textContent)===normalize(article.title)){
     heading.remove();article.content=doc.body.innerHTML;
    }
    return article;
   })()`}]) as Article|null;
   if(!current())return false;if(!article)throw new Error(UNAVAILABLE);
   const encoded='data:text/html;charset=utf-8,'+encodeURIComponent(this.html(article,url));if(encoded.length>1_900_000)throw new Error(UNAVAILABLE);
   // This view is deliberately not a Browser tab: agent/MCP operations always target the original page.
   view=new WebContentsView({webPreferences:{session:wc.session,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,backgroundThrottling:true}});
   const vwc=view.webContents;view.setBackgroundColor(THEMES[this.theme()].bg);vwc.setWindowOpenHandler(()=>({action:'deny'}));
   vwc.on('will-navigate',(e,target)=>{e.preventDefault();if(/^https?:/i.test(target)&&this.browser.tabs.get(id)===tab){this.close(tab);void this.browser.navigate(id,target).catch(()=>{});}});
   vwc.on('will-redirect',e=>e.preventDefault());
   const owned=view;vwc.once('destroyed',()=>{this.css.delete(owned);this.updates.delete(owned);if(tab.reader===owned)this.close(tab);});
   this.browser.win.contentView.addChildView(view);tab.reader=view;this.browser.layout();
   await vwc.loadURL(encoded);if(!current()||tab.reader!==view)return false;await this.apply(view);
   if(!current()||tab.reader!==view)return false;this.changed();return true;
  }catch(e){
   if(!current())return false;if(view&&tab.reader===view)this.close(tab);throw new Error(UNAVAILABLE,{cause:e});
  }finally{if(this.opening.get(tab)===token)this.opening.delete(tab);}
 }
 close(tab:Tab):void{
  this.opening.delete(tab);const view=tab.reader;if(!view)return;delete tab.reader;
  if(!this.browser.win.isDestroyed())this.browser.win.contentView.removeChildView(view);
  this.css.delete(view);this.updates.delete(view);if(!view.webContents.isDestroyed())view.webContents.close();
  this.browser.layout();if(!this.browser.win.isDestroyed()&&!tab.view?.webContents.isDestroyed())this.changed();
 }
 onViewDestroy(tab:Tab):void{this.probes.delete(tab);tab.readable=false;this.close(tab);}
 set(patch:{size?:unknown;theme?:unknown}):void{
  if(!patch||typeof patch!=='object'||Array.isArray(patch)||Object.keys(patch).some(k=>k!=='size'&&k!=='theme'))throw new Error('Invalid preference');
  const {size,theme}=patch;
  if(size!==undefined&&(typeof size!=='number'||!Number.isInteger(size)||size<14||size>32)||theme!==undefined&&(typeof theme!=='string'||!['auto','light','sepia','dark'].includes(theme)))throw new Error('Invalid preference');
  const settings=this.data.state.settings.reader;if(size!==undefined)settings.size=size as number;if(theme!==undefined)settings.theme=theme as typeof settings.theme;
  this.data.save();this.refresh();this.changed();
 }
 private theme():'light'|'sepia'|'dark'{const theme=this.data.state.settings.reader.theme;return theme==='auto'?(nativeTheme.shouldUseDarkColors?'dark':'light'):theme;}
 refresh(){for(const tab of this.browser.tabs.values())if(tab.reader)void this.apply(tab.reader).catch(e=>{if(tab.reader&&!tab.reader.webContents.isDestroyed())console.error('Reader style failed',e);});}
 private apply(view:WebContentsView):Promise<void>{
  // Serialize replacements so rapid preference changes never leave stale styles or orphan CSS keys.
  const update=(this.updates.get(view)??Promise.resolve()).catch(()=>{}).then(async()=>{
   const wc=view.webContents;if(wc.isDestroyed())return;const colors=THEMES[this.theme()],size=this.data.state.settings.reader.size;
   // insertCSS can precede document styles; outrank the template's :root/html defaults.
   view.setBackgroundColor(colors.bg);const previous=this.css.get(view),key=await wc.insertCSS(`html:root{--fg:${colors.fg};--bg:${colors.bg};--muted:${colors.muted};--link:${colors.link};font-size:${size}px}`);
   if(wc.isDestroyed())return;this.css.set(view,key);if(previous)await wc.removeInsertedCSS(previous);
  });this.updates.set(view,update);return update;
 }
 private html(a:Article,url:string):string{
  return `<!doctype html><html lang="${escape(a.lang||'')}" dir="${escape(a.dir||'ltr')}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'"><meta name="referrer" content="strict-origin-when-cross-origin"><base href="${escape(url)}"><title>${escape(a.title)}</title><style>:root{--fg:#1d1d1f;--bg:#fff;--muted:#6e6e73;--link:#0066cc}html{font-size:18px}body{margin:0;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard",sans-serif;line-height:1.65;-webkit-font-smoothing:antialiased}body>article{max-width:40rem;margin:0 auto;padding:56px 24px 96px}h1{font-size:1.75em;line-height:1.25;margin:0 0 .5em}.meta{color:var(--muted);font-size:.85em;margin:0 0 2em}img,video{max-width:100%;height:auto}pre{overflow:auto;padding:12px;background:rgba(127,127,127,.12);border-radius:8px}a{color:var(--link)}figcaption{color:var(--muted);font-size:.85em}</style></head><body><article><h1>${escape(a.title)}</h1>${a.byline||a.siteName?`<p class="meta">${escape([a.byline,a.siteName].filter(Boolean).join(' · '))}</p>`:''}${a.content}</article></body></html>`;
 }
}
