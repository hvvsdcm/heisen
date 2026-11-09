import type {Data} from './data.ts';
import type {ShieldRule} from './shield.ts';
import {upgradeHostExcluded} from './browser-util.ts';

const hostKey=(hostname:string)=>hostname.toLowerCase().replace(/\.$/,'');
export function upgradable(url:string,allowed:ReadonlySet<string>):string|null{
 try{const u=new URL(url);if(u.protocol!=='http:'||u.username||u.password||u.port||upgradeHostExcluded(u.hostname)||allowed.has(hostKey(u.hostname)))return null;u.protocol='https:';return u.href;}catch{return null;}
}
export function connectionError(errno:number):boolean{return errno<=-100&&errno>=-199;}
export function certError(errno:number):boolean{return errno<=-200&&errno>=-299;}
export type Block={kind:'http'|'cert'|'danger';url:string;detail:string;host:string;fingerprint?:string;list?:string;canProceed?:boolean};
export class HttpsFirst {
 readonly upgraded=new Map<number,{from:string;to:string;at:number}>();
 readonly lastCert=new Map<number,{url:string;fingerprint:string}>();
 constructor(private data:Data){}
 allowed(host:string):boolean{return this.data.state.settings.https.allowed.includes(hostKey(host));}
 rule():ShieldRule{return {before:d=>{
  if(d.resourceType!=='mainFrame'){
   // Chromium also blocks active mixed content. Deny any remaining plaintext
   // subresource (including display content) under a secure document.
   if(/^http:|^ws:/i.test(d.url)){
    let top:string|undefined;try{top=d.frame?.top?.url;}catch{/* Detached frame. */}
    if(/^https:/i.test(top||d.initiatorOrigin||d.webContents?.getURL()||''))return {cancel:true};
   }
   return;
  }
  const to=upgradable(d.url,new Set(this.data.state.settings.https.allowed));
  if(to){if(d.webContentsId!==undefined)this.upgraded.set(d.webContentsId,{from:d.url,to,at:Date.now()});return {redirectURL:to};}
  if(d.webContentsId!==undefined&&this.upgraded.get(d.webContentsId)?.to!==d.url)this.upgraded.delete(d.webContentsId);
 }};}
 allow(host:string):void{const key=hostKey(host);if(!this.allowed(key)){this.data.state.settings.https.allowed.push(key);this.data.save();}}
 certificateError(_event:Electron.Event,wc:Electron.WebContents,url:string,_error:string,cert:Electron.Certificate,callback:(trusted:boolean)=>void,isMainFrame=true):void{
  if(isMainFrame)this.lastCert.set(wc.id,{url,fingerprint:cert.fingerprint});
  // Electron exposes no authoritative HSTS query. Never override certificate
  // verification, including for remembered hosts, private tabs or automation.
  callback(false);
 }
 blockFor(wcId:number,url:string,errno:number,description:string):Block|null{
  let u:URL;try{u=new URL(url);}catch{return null;}
  if(certError(errno))return {kind:'cert',url,host:u.host,detail:description,fingerprint:this.lastCert.get(wcId)?.url===url?this.lastCert.get(wcId)?.fingerprint:undefined,canProceed:false};
  const upgrade=this.upgraded.get(wcId);
  if(connectionError(errno)&&upgrade?.to===url&&Date.now()-upgrade.at<=5000)return {kind:'http',url:upgrade.from,host:hostKey(new URL(upgrade.from).hostname),detail:description,canProceed:true};
  return null;
 }
 forget(wcId:number):void{this.upgraded.delete(wcId);this.lastCert.delete(wcId);}
}
