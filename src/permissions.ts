import {randomUUID} from 'node:crypto';
import type {Session,WebContents} from 'electron';
import type {Windows} from './windows.ts';
import type {Data} from './data.ts';
import {registerRpc,registerState} from './rpc.ts';
export type PromptKind='geolocation'|'notifications'|'camera'|'microphone'|'clipboard-read';
export type PermissionRequest={id:string;tabId:number;origin:string;topOrigin:string;kinds:PromptKind[]};
const AUTO:Record<string,true>={fullscreen:true,'clipboard-sanitized-write':true,pointerLock:true,mediaKeySystem:true};
const MEDIA:Record<string,PromptKind>={video:'camera',audio:'microphone'};
function kindsOf(permission:string,media:readonly string[]=[]):PromptKind[]{
 if(permission==='media')return [...new Set(media.map(m=>MEDIA[m]).filter(Boolean))];
 if(permission==='geolocation'||permission==='geolocation-approximate')return ['geolocation'];
 if(permission==='notifications'||permission==='clipboard-read')return [permission];
 return [];
}
function webOrigin(url:string|undefined){try{const u=new URL(String(url));return /^https?:$/.test(u.protocol)?u.origin:undefined;}catch{return undefined;}}
// Existing origin-only entries represent same-origin top-level grants. Cross-site
// frames use an unambiguous pair; HTTP(S) origins cannot contain a newline.
export function permissionKey(origin:string,topOrigin:string):string{return origin===topOrigin?origin:origin+'\n'+topOrigin;}
export class Permissions {
 private pending:PermissionRequest[]=[];private callbacks=new Map<string,(allow:boolean)=>void>();private watched=new WeakSet<WebContents>();
 private privateDecisions=new WeakMap<Session,Record<string,Record<string,'allow'|'block'>>>();
 constructor(private windows:Windows,private data:Data,private changed:()=>void){}
 install():void{
  this.windows.sessions.configureSessions(ses=>{
  if(ses!==this.windows.sessions.session)this.privateDecisions.set(ses,{});
  ses.setPermissionRequestHandler((wc,permission,callback,details)=>{
   const browser=this.windows.byContents(wc),tab=browser?.tabForContents(wc);
   if(tab?.taskId)return callback(false);
   if(permission==='storage-access'||permission==='top-level-storage-access')return callback(permission==='storage-access'&&!!tab&&browser?.shield?.storageAccess(wc,details.requestingUrl)===true);
   if(AUTO[permission])return callback(true);
   const kinds=kindsOf(permission,'mediaTypes' in details?details.mediaTypes:[]),origin=webOrigin(details.requestingUrl),topOrigin=webOrigin(wc.getURL());
   if(!tab||!kinds.length||!origin||!topOrigin)return callback(false);
   const known=this.stored(permissionKey(origin,topOrigin),kinds,ses);if(known!==undefined)return callback(known);
   const id=randomUUID();this.pending.push({id,tabId:tab.id,origin,topOrigin,kinds});this.callbacks.set(id,callback);this.watch(wc,tab.id);this.changed();
  });
  ses.setPermissionCheckHandler((wc,permission,requestingOrigin,details)=>{
   if(wc&&this.windows.tabForContents(wc)?.taskId)return false;
   if(permission==='top-level-storage-access')return false;
   if(permission==='storage-access')return !!wc&&!!this.windows.tabForContents(wc)&&this.windows.byContents(wc)?.shield?.hasGrant(ses,wc.getURL(),requestingOrigin)===true;
   if(AUTO[permission])return true;
   const kinds=kindsOf(permission,details.mediaType?[details.mediaType]:[]),origin=webOrigin(requestingOrigin),topOrigin=webOrigin(wc?wc.getURL():details.embeddingOrigin);
   return !!origin&&!!topOrigin&&kinds.length>0&&this.stored(permissionKey(origin,topOrigin),kinds,ses)===true;
  });
  });
  registerRpc({
   'permission.decide':a=>{
    const req=this.pending.find(r=>r.id===a.id);if(!req||!this.windows.current().tabs.has(req.tabId))return false;const allow=a.allow===true,ses=this.windows.byTab(req.tabId)?.tabs.get(req.tabId)?.view?.webContents.session;if(!ses){this.settle(req,false);return false;}
    const decisions=this.privateDecisions.get(ses)??this.data.state.permissions,site=decisions[permissionKey(req.origin,req.topOrigin)]||={};for(const k of req.kinds)site[k]=allow?'allow':'block';if(ses===this.windows.sessions.session)this.data.save();
    this.settle(req,allow);
    for(const r of this.pending.filter(r=>r.origin===req.origin&&r.topOrigin===req.topOrigin&&this.windows.byTab(r.tabId)?.tabs.get(r.tabId)?.view?.webContents.session===ses)){const known=this.stored(permissionKey(r.origin,r.topOrigin),r.kinds,ses);if(known!==undefined)this.settle(r,known);}
    this.changed();return true;
   },
   'permission.reset':a=>{
    if(typeof a.origin!=='string'||!Object.hasOwn(this.data.state.permissions,a.origin))return false;
    delete this.data.state.permissions[a.origin];this.data.save();this.changed();return true;
   },
  });
  registerState('permissionRequests',()=>{const browser=this.windows.current();return this.pending.filter(r=>browser.tabs.has(r.tabId));});
  registerState('sitePermissions',()=>this.data.state.permissions);
 }
 // true when every kind is allowed, false when any kind is blocked, undefined when the user still has to answer.
 private stored(origin:string,kinds:PromptKind[],ses:Session):boolean|undefined{
  const saved=Object.hasOwn(this.data.state.permissions,origin)?this.data.state.permissions[origin]:{},privateSites=this.privateDecisions.get(ses),site=privateSites?(Object.hasOwn(privateSites,origin)?privateSites[origin]:{}):saved;
  if(kinds.some(k=>saved[k]==='block'||site[k]==='block'))return false;
  return kinds.every(k=>site[k]==='allow')?true:undefined;
 }
 private settle(req:PermissionRequest,allow:boolean){
  this.pending=this.pending.filter(r=>r!==req);const cb=this.callbacks.get(req.id);this.callbacks.delete(req.id);cb?.(allow);
 }
 private drop(tabId:number){
  const gone=this.pending.filter(r=>r.tabId===tabId);if(!gone.length)return;
  for(const r of gone)this.settle(r,false);this.changed();
 }
 private watch(wc:WebContents,tabId:number){
  if(this.watched.has(wc))return;this.watched.add(wc);
  wc.on('did-start-navigation',details=>{if(details.isMainFrame&&!details.isSameDocument)this.drop(tabId);});
  wc.once('destroyed',()=>this.drop(tabId));
 }
}
