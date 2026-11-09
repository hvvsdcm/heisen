import {dialog,clipboard,systemPreferences,shell,type BrowserWindow,type Session} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Data,Secrets} from './data.ts';
import {deriveKey,chromiumDecryptor,localStateKey,type KeychainReader} from './chromium-crypto.ts';
import {chromiumRoots,isWindows,unprotectDpapi} from './platform.ts';
import type {ImportedLogin,SourceInfo,VaultEntry} from './importer.ts';
import type * as ImporterModule from './importer.ts';
import {originOf,textArg} from './protocol.ts';
import {registerRpc,registerState} from './rpc.ts';
export type ImportItem='passwords'|'cookies'|'bookmarks'|'history';
export type ImportResult={passwords?:{added:number;updated:number;failed:number};cookies?:{imported:number;failed:number};bookmarks?:number;history?:number;note?:string};
type Deps={data:Data;secrets:Secrets;session:Session;win:BrowserWindow;changed:()=>void;appSupport:string;readKeychain:KeychainReader;confirmKeychain:(browserName:string)=>Promise<boolean>};
const ITEMS:readonly string[]=['passwords','cookies','bookmarks','history'];
const APP_BOUND_NOTE='Chrome 127 이상의 비밀번호·쿠키는 CSV 가져오기를 사용하세요.';
// Readers pull in node:sqlite; load them only when an import or sync actually runs.
const importer=()=>import('./importer.ts');
const isEntry=(v:any):v is VaultEntry=>!!v&&typeof v.id==='string'&&typeof v.origin==='string'&&typeof v.username==='string'&&typeof v.password==='string';
// Deleted logins, kept in the encrypted store so syncs and imports do not bring them back.
type Tombstone={origin:string;username:string;deletedAt:number};
const isTombstone=(v:any):v is Tombstone=>!!v&&typeof v.origin==='string'&&typeof v.username==='string'&&typeof v.deletedAt==='number';
const loginKey=(origin:string,username:string)=>origin+'\n'+username;
const UNDO_MS=10000;
// Same origin, or same scheme and port with hosts that differ only by a leading "www.".
export function originMatches(saved:string,origin:string):boolean{
 if(saved===origin)return true;
 try{const a=new URL(saved),b=new URL(origin);return a.protocol===b.protocol&&a.port===b.port&&a.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'');}catch{return false;}
}
// Latest write time of the login databases, including SQLite side files that change before the main file does.
function loginsModified(profilePath:string):number{
 let latest=0;
 for(const file of ['Login Data','Login Data For Account'])for(const suffix of ['','-wal','-journal'])latest=Math.max(latest,fs.statSync(path.join(profilePath,file+suffix),{throwIfNoEntry:false})?.mtimeMs??0);
 return latest;
}
export class Passwords {
 private busy=false;private syncing?:Promise<void>;
 // Recently deleted entries (main process only), restorable by vault.restore until the undo window ends.
 private deleted=new Map<string,{entry:VaultEntry;timer:NodeJS.Timeout}>();
 constructor(private deps:Deps){}
 install():void{
  const {data}=this.deps;
  registerRpc({
   'import.sources':async()=>(await importer()).detectSources({...chromiumRoots(),base:this.deps.appSupport}).map(s=>({browser:s.browser,name:s.name,kind:s.kind,can:s.can,profiles:s.profiles.map(p=>({dir:p.dir,name:p.name}))})),
   'import.openFullDisk':()=>shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'),
   'import.run':a=>this.run(a),
   'import.csv':()=>this.csv(),
   'import.forget':a=>this.forget(textArg(a.browser,50),textArg(a.profile,500)),
   'import.sync':async()=>{await this.autosync();return true;},
   'vault.save':async a=>{const origin=originOf(a.url);const {mergeLogins}=await importer();this.save(mergeLogins(this.list(),[{origin,username:textArg(a.username,500),password:textArg(a.password,4096),createdAt:Date.now()}],'heisen').list);return true;},
   'vault.delete':a=>this.remove(textArg(a.id,100)),
   'vault.restore':a=>this.restore(textArg(a.id,100)),
   'vault.copy':a=>this.copy(textArg(a.id,100)),
  });
  registerState('vault',()=>this.list().map(({password,...v})=>v));
  registerState('importSources',()=>data.state.imports);
  setTimeout(()=>void this.autosync().catch(e=>console.error('Password sync failed',e)),10000).unref();
 }
 list():VaultEntry[]{const raw=this.deps.secrets.get<unknown>('vault');return Array.isArray(raw)?raw.filter(isEntry):[];}
 // Saving an entry again (manually, or from a source changed after the deletion) retires its tombstone.
 save(list:VaultEntry[]):void{
  const {secrets}=this.deps;secrets.set('vault',list);
  const tombstones=this.tombstones(),present=new Set(list.map(v=>loginKey(v.origin,v.username))),kept=tombstones.filter(t=>!present.has(loginKey(t.origin,t.username)));
  if(kept.length!==tombstones.length)secrets.set('vaultTombstones',kept);
  this.deps.changed();
 }
 private tombstones():Tombstone[]{const raw=this.deps.secrets.get<unknown>('vaultTombstones');return Array.isArray(raw)?raw.filter(isTombstone):[];}
 private remove(id:string):boolean{
  const list=this.list(),entry=list.find(v=>v.id===id);if(!entry)return false;
  const key=loginKey(entry.origin,entry.username);
  this.deps.secrets.set('vaultTombstones',[...this.tombstones().filter(t=>loginKey(t.origin,t.username)!==key),{origin:entry.origin,username:entry.username,deletedAt:Date.now()}]);
  this.save(list.filter(v=>v.id!==id));
  clearTimeout(this.deleted.get(id)?.timer);
  this.deleted.set(id,{entry,timer:setTimeout(()=>this.deleted.delete(id),UNDO_MS).unref()});
  return true;
 }
 private restore(id:string):boolean{
  const held=this.deleted.get(id);if(!held)return false;
  clearTimeout(held.timer);this.deleted.delete(id);
  const list=this.list(),key=loginKey(held.entry.origin,held.entry.username);
  // A login saved for the same account during the undo window wins.
  if(!list.some(v=>loginKey(v.origin,v.username)===key))this.save([...list,held.entry]);
  return true;
 }
 // Imported rows for deleted logins are skipped unless the source changed the password after the deletion.
 private merge(m:typeof ImporterModule,items:ImportedLogin[],source:string){
  const deletedAt=new Map(this.tombstones().map(t=>[loginKey(t.origin,t.username),t.deletedAt]));
  const live=deletedAt.size?items.filter(i=>{const at=deletedAt.get(loginKey(i.origin,i.username));return at===undefined||(i.modifiedAt??i.createdAt)>at;}):items;
  return m.mergeLogins(this.list(),live,source);
 }
 matches(origin:string):VaultEntry[]{return this.list().filter(v=>originMatches(v.origin,origin)).sort((a,b)=>(b.updatedAt??0)-(a.updatedAt??0));}
 // Sign-up passwords are saved the moment they are filled (agent web_signup, manual strong-password suggestion); a retry on the same
 // account replaces the password. Synchronous, so a storage failure reaches the caller.
 record(e:{origin:string;username:string;password:string;preset?:string;by:'agent'|'user'}):void{
  const list=this.list(),now=Date.now(),signup={by:e.by,preset:e.preset,at:now},entry=list.find(v=>originMatches(v.origin,e.origin)&&v.username===e.username);
  if(entry)Object.assign(entry,{password:e.password,source:'signup',updatedAt:now,signup});
  else list.push({id:randomUUID(),origin:e.origin,username:e.username,password:e.password,source:'signup',updatedAt:now,signup});
  this.save(list);
 }
 // A suggested password was saved without a username; the form submit that uses it fills the username in silently, replacing any
 // older entry for that account.
 adoptUsername(origin:string,password:string,username:string):boolean{
  const list=this.list(),entry=list.find(v=>originMatches(v.origin,origin)&&v.password===password&&v.username===''&&!!v.signup);if(!entry)return false;
  entry.username=username;entry.updatedAt=Date.now();
  this.save(list.filter(v=>v===entry||!(v.origin===entry.origin&&v.username===username)));return true;
 }
 // Re-reads Login Data for every previously imported profile whose databases changed since lastSync. Adds and updates only; never deletes.
 autosync():Promise<void>{return this.syncing??=this.sync().finally(()=>{this.syncing=undefined;});}
 private async sync(){
  const {data,changed}=this.deps;if(!data.state.settings.vault)return;
  const due=data.state.imports.filter(i=>!i.needsAuth);if(!due.length)return;
  const m=await importer();const sources=m.detectSources({...chromiumRoots(),base:this.deps.appSupport});let dirty=false;
  for(const entry of due){
   if(entry.needsAuth)continue;
   const profile=sources.find(s=>s.browser===entry.browser&&s.kind==='chromium')?.profiles.find(p=>p.dir===entry.profile);
   if(!profile||loginsModified(profile.path)<=entry.lastSync)continue;
   const key=this.storedKey(entry.browser);
   if(key){
    const read=m.readLogins(profile.path,chromiumDecryptor(key));
    if(read.items.length||!read.failed){const merged=this.merge(m,read.items,entry.browser);if(merged.added||merged.updated)this.save(merged.list);entry.lastSync=Date.now();dirty=true;continue;}
    // Nothing decrypted: the key rotated or the browser switched to app-bound encryption.
    this.setKey(entry.browser,undefined);
   }
   for(const i of data.state.imports)if(i.browser===entry.browser)i.needsAuth=true;dirty=true;
  }
  if(dirty){data.save();changed();}
 }
 async run(a:any):Promise<ImportResult|null>{
  const items:string[]=Array.isArray(a.items)?[...new Set<string>(a.items)]:[];
  if(!items.length||items.some(i=>!ITEMS.includes(i)))throw new Error('Invalid import items');
  if(this.busy)throw new Error('가져오는 중입니다.');
  this.busy=true;
  try{
   const {data,changed,session}=this.deps;const m=await importer();
   const source=m.detectSources({...chromiumRoots(),base:this.deps.appSupport}).find(s=>s.browser===a.browser),profile=source?.profiles.find(p=>p.dir===a.profile);
   if(!source||!profile)throw new Error('가져올 프로필을 찾을 수 없습니다.');
   const result:ImportResult={};
   // Keep node:sqlite readers out of Electron startup; load this platform reader only for an import.
   const apple=source.kind==='chromium'?undefined:await import('./importer-apple.ts');
   let key=source.kind==='chromium'?this.storedKey(source.browser):undefined,appBound=false;const stored=!!key;
   if(source.kind==='chromium'&&(isWindows||!key)&&(items.includes('passwords')||items.includes('cookies'))){
    const loaded=await this.sourceKey(source);if(!loaded)return null;
    key=loaded.key;appBound=loaded.appBound;
   }
   let decrypt=key?chromiumDecryptor(key):()=>null;
   // Some profiles have v20 rows even when Local State no longer advertises the app-bound key.
   const readValue=(blob:Uint8Array)=>{
    if(isWindows&&blob[0]===0x76&&blob[1]===0x32&&blob[2]===0x30){appBound=true;return null;}
    return decrypt(blob);
   };
   if(source.can.passwords&&items.includes('passwords')){
    let read=m.readLogins(profile.path,readValue);
    if(!isWindows&&stored&&!read.items.length&&read.failed){
     this.setKey(source.browser,undefined);const loaded=await this.sourceKey(source);if(!loaded)return null;
     key=loaded.key;decrypt=key?chromiumDecryptor(key):()=>null;read=m.readLogins(profile.path,readValue);
    }
    if(appBound&&!read.items.length&&read.failed)result.note=APP_BOUND_NOTE;
    const merged=this.merge(m,read.items,source.browser);if(merged.added||merged.updated)this.save(merged.list);
    data.state.imports=data.state.imports.filter(i=>!(i.browser===source.browser&&i.profile===profile.dir));
    data.state.imports.push({browser:source.browser,profile:profile.dir,name:source.name,lastSync:Date.now(),...(isWindows&&!read.items.length&&read.failed?{needsAuth:true}:{})});
    result.passwords={added:merged.added,updated:merged.updated,failed:read.failed};
   }
   if(source.can.cookies&&items.includes('cookies')){
    const read=source.kind==='firefox'?apple!.readFirefoxCookies(profile.path):m.readCookies(profile.path,readValue);let imported=0,failed=read.failed;
    if(appBound&&!read.items.length&&read.failed)result.note=APP_BOUND_NOTE;
    for(let i=0;i<read.items.length;i+=100)for(const r of await Promise.allSettled(read.items.slice(i,i+100).map(c=>session.cookies.set(c))))r.status==='fulfilled'?imported++:failed++;
    await session.cookies.flushStore();
    result.cookies={imported,failed};
   }
   if(items.includes('bookmarks')){
    const have=new Set(data.state.bookmarks.map(b=>b.url));let added=0;
    const read=source.kind==='safari'?await apple!.readSafariBookmarks(profile.path):source.kind==='firefox'?apple!.readFirefoxBookmarks(profile.path):m.readBookmarks(profile.path);
    for(const b of read)if(!have.has(b.url)){have.add(b.url);data.state.bookmarks.push({id:randomUUID(),title:b.title||b.url,url:b.url});added++;}
    result.bookmarks=added;
   }
   if(items.includes('history')){
    const read=source.kind==='safari'?apple!.readSafariHistory(profile.path):source.kind==='firefox'?apple!.readFirefoxHistory(profile.path):m.readHistory(profile.path),byUrl=new Map(data.state.history.map(h=>[h.url,h]));
    for(const h of read){const prev=byUrl.get(h.url);if(!prev||h.at>prev.at)byUrl.set(h.url,h);}
    data.state.history=[...byUrl.values()].sort((x,y)=>y.at-x.at).slice(0,2000);
    result.history=read.length;
   }
   data.save();changed();return result;
  }catch(e){
   if(a.browser==='safari'&&(await import('./importer-apple.ts')).fullDiskAccessDenied(e))throw new Error('시스템 설정 > 개인정보 보호 및 보안 > 전체 디스크 접근 권한에서 Heisen을 허용하세요.');
   throw e;
  }finally{this.busy=false;}
 }
 private async csv():Promise<{added:number;updated:number}|null>{
  const picked=await dialog.showOpenDialog(this.deps.win,{properties:['openFile'],filters:[{name:'CSV',extensions:['csv']}]});
  if(picked.canceled||!picked.filePaths[0])return null;
  const text=await fs.promises.readFile(picked.filePaths[0],'utf8');const m=await importer();
  const merged=this.merge(m,m.parsePasswordCsv(text),'csv');if(merged.added||merged.updated)this.save(merged.list);
  return {added:merged.added,updated:merged.updated};
 }
 private forget(browser:string,profile:string):boolean{
  const {data,changed}=this.deps;const before=data.state.imports.length;
  data.state.imports=data.state.imports.filter(i=>!(i.browser===browser&&i.profile===profile));if(data.state.imports.length===before)return false;
  if(!data.state.imports.some(i=>i.browser===browser)&&this.storedKey(browser))this.setKey(browser,undefined);
  data.save();changed();return true;
 }
 private async copy(id:string):Promise<boolean>{
  const entry=this.list().find(v=>v.id===id);if(!entry)throw new Error('저장된 비밀번호를 찾을 수 없습니다.');
  if(systemPreferences.canPromptTouchID()){try{await systemPreferences.promptTouchID('저장된 비밀번호를 복사하려고 합니다');}catch{return false;}}
  else if((await dialog.showMessageBox(this.deps.win,{type:'question',message:'비밀번호를 복사할까요?',buttons:['취소','복사'],defaultId:1,cancelId:0})).response!==1)return false;
  clipboard.writeText(entry.password);
  setTimeout(()=>void clipboard.readText().then(text=>{if(text===entry.password)clipboard.clear();}),60000).unref();
  return true;
 }
 // Source encryption keys per browser, kept in the encrypted store for later syncs.
 private keys():Record<string,string>{return this.deps.secrets.get<Record<string,string>>('importKeys')||{};}
 private storedKey(browser:string):Buffer|undefined{const k=this.keys()[browser];return k?Buffer.from(k,'base64'):undefined;}
 private setKey(browser:string,key:Buffer|undefined){const keys=this.keys();if(key)keys[browser]=key.toString('base64');else delete keys[browser];this.deps.secrets.set('importKeys',keys);}
 private async sourceKey(source:SourceInfo):Promise<{key?:Buffer;appBound:boolean}|undefined>{
  if(isWindows){
   const loaded=await localStateKey(path.join(source.root,'Local State'),unprotectDpapi);
   if(!loaded.key&&!loaded.appBound)throw new Error(`${source.name}의 암호화 키를 찾을 수 없습니다.`);
   this.setKey(source.browser,loaded.key);
   if(loaded.key)for(const i of this.deps.data.state.imports)if(i.browser===source.browser)delete i.needsAuth;
   return loaded;
  }
  if(!await this.deps.confirmKeychain(source.name))return undefined;
  let password:string;
  try{password=await this.deps.readKeychain(source.service);}
  catch(e){throw new Error(e instanceof Error&&e.message==='KEYCHAIN_NOT_FOUND'?`${source.name}의 키체인 항목을 찾을 수 없습니다.`:'키체인 접근이 거부되었습니다.');}
  const key=deriveKey(password);this.setKey(source.browser,key);
  for(const i of this.deps.data.state.imports)if(i.browser===source.browser)delete i.needsAuth;
  return {key,appBound:false};
 }
}
