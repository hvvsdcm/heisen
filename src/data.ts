import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {SleepSettings} from './sleep-util.js';
import {initSealed,migrateToSealed,sealedReadText,sealedWrite,dropBackup,SealError} from './sealed.js';
export type Routine={id:string;name:string;prompt:string;urls:string[];cron:string;zone:string;enabled:boolean;next:number;lastTask?:string;lastError?:string;mode:string;kind?:string;targetTask?:string};
export type Library={bookmarks:{id:string;title:string;url:string}[];history:{title:string;url:string;at:number}[];
 // legacy: emptied by MemoryStore/SkillStore migration
 memory:{id:string;title:string;text:string;url?:string;at:number}[];skills:{id:string;title:string;prompt:string}[];
 routines:Routine[];tabs:{url:string;title:string;pinned:boolean}[];activeTab?:number;permissions:Record<string,Record<string,'allow'|'block'>>;zoom:Record<string,number>;imports:{browser:string;profile:string;name:string;lastSync:number;needsAuth?:boolean}[];neverSave:string[];privacy:{sites:Record<string,{protect:boolean}>;grants:Record<string,number>};settings:{provider:string;model:string;theme:string;sidebar:number;sidebarCollapsed?:boolean;bookmarkBar:boolean;importOffered:boolean;vault:boolean;onboarded:boolean;agent:{humanize:boolean};agentApi:{enabled:boolean;port:number};cli:{socket:boolean;pageScripts:boolean};dreaming:{enabled:boolean;cron:string;zone:string;next:number;last?:number};computer:{enabled:boolean;apps:string[]};signup:{mode:'generate'|'preset';emails:string[];alias:boolean};sleep:SleepSettings;energy:{batterySaver:boolean;pauseHiddenVideo:boolean};privacy:{trackers:boolean;ads:boolean;thirdPartyCookies:'block'|'allow';stripParams:boolean;clientHints:boolean};reader:{size:number;theme:'auto'|'light'|'sepia'|'dark'};https:{allowed:string[]};safeBrowsing:{enabled:boolean};downloads:{askWhere:boolean};agentSites:Record<string,'allow'|'block'>;background:boolean;defaultBrowserAsked:boolean};hostId:string};
export class Data {
 private timer?:NodeJS.Timeout;private dirty=false;private writing?:Promise<void>;lastError?:string;
 state:Library;private constructor(public root:string,saved:any){this.state={bookmarks:[],history:[],memory:[],skills:[],routines:[],tabs:[],permissions:{},zoom:{},imports:[],neverSave:[],hostId:'urn:uuid:'+randomUUID(),...saved,privacy:{sites:{},grants:{},...saved.privacy},settings:{provider:'chatgpt',model:'',theme:'dark',sidebar:232,sidebarCollapsed:false,bookmarkBar:true,importOffered:false,vault:true,onboarded:false,background:true,defaultBrowserAsked:false,...saved.settings,agent:{humanize:false,...saved.settings?.agent},agentApi:{enabled:false,port:0,...saved.settings?.agentApi},cli:{socket:false,pageScripts:false,...saved.settings?.cli},dreaming:{enabled:false,cron:'0 4 * * *',zone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',next:0,...saved.settings?.dreaming},computer:{enabled:false,apps:[],...saved.settings?.computer},signup:{mode:'generate',emails:[],alias:false,...saved.settings?.signup},sleep:{afterMin:30,afterMinOnBattery:10,budgetMiB:0,watchdog:true,leakFloorMiB:1024,leakRateMiBPerMin:50,...saved.settings?.sleep},energy:{batterySaver:true,pauseHiddenVideo:true,...saved.settings?.energy},privacy:{trackers:true,ads:false,thirdPartyCookies:'block',stripParams:true,clientHints:true,...saved.settings?.privacy},reader:{size:18,theme:'auto',...saved.settings?.reader},https:{allowed:[],...saved.settings?.https},safeBrowsing:{enabled:true,...saved.settings?.safeBrowsing},downloads:{askWhere:false,...saved.settings?.downloads},agentSites:{...saved.settings?.agentSites}}};}
 static async open(root:string,secrets:Secrets):Promise<Data>{
  fs.mkdirSync(root,{recursive:true,mode:0o700});initSealed(secrets);
  const file=path.join(root,'library.json'),result=await migrateToSealed(file);
  let saved={},recovered=false;
  try{saved=JSON.parse((await sealedReadText(file))??'{}');}catch(e){
   if(!(e instanceof SealError))throw e;
   recovered=true;
   const backup=file+'.v0';
   if(fs.existsSync(backup))saved=JSON.parse(fs.readFileSync(backup,'utf8'));
   else fs.renameSync(file,file+'.corrupt-'+Date.now());
  }
  // Keep the only good copy until a later startup authenticates the recovered file.
  if(result==='already'&&!recovered)await dropBackup(file);
  const data=new Data(root,saved);data.writeLaunch();data.save();return data;
 }
 save(){this.dirty=true;if(this.timer)return;this.timer=setTimeout(()=>{this.timer=undefined;void this.flush().catch(e=>{this.lastError=String(e.message);});},160);this.timer.unref();}
 async flush(){clearTimeout(this.timer);this.timer=undefined;while(this.writing)await this.writing.catch(()=>{});if(!this.dirty)return;this.dirty=false;const text=JSON.stringify(this.state);const file=path.join(this.root,'library.json');this.writing=(async()=>{await sealedWrite(file,text);this.writeLaunch();this.lastError=undefined;})();try{await this.writing;}catch(e){this.dirty=true;throw e;}finally{this.writing=undefined;}if(this.dirty)await this.flush();}
 private writeLaunch(){const file=path.join(this.root,'launch.json'),want=JSON.stringify({agentApi:this.state.settings.agentApi.enabled===true});try{if(fs.readFileSync(file,'utf8')===want)return;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}fs.writeFileSync(file+'.tmp',want,{mode:0o600});fs.renameSync(file+'.tmp',file);}
 visit(url:string,title:string){if(!/^https?:/.test(url))return;this.state.history=this.state.history.filter(h=>h.url!==url);this.state.history.unshift({url,title,at:Date.now()});this.state.history=this.state.history.slice(0,2000);this.save();}
}
export function readLaunch(root:string):{agentApi:boolean}{try{return {agentApi:JSON.parse(fs.readFileSync(path.join(root,'launch.json'),'utf8')).agentApi===true};}catch{return {agentApi:false};}}
export interface Cipher {encryptString(s:string):Buffer;decryptString(b:Buffer):string;isEncryptionAvailable():boolean}
export class Secrets {
 private values:Record<string,string>={};
 private cache=new Map<string,any>();
 constructor(private file:string,private cipher:Cipher){try{this.values=JSON.parse(fs.readFileSync(file,'utf8'));}catch{}}
 get<T=any>(key:string):T|undefined{const value=this.values[key];if(!value)return undefined;if(!this.cipher.isEncryptionAvailable())throw new Error('OS 보안 저장소를 사용할 수 없습니다.');if(this.cache.has(key))return structuredClone(this.cache.get(key));const decoded=JSON.parse(this.cipher.decryptString(Buffer.from(value,'base64')));this.cache.set(key,decoded);return structuredClone(decoded);}
 set(key:string,value:unknown){if(!this.cipher.isEncryptionAvailable())throw new Error('OS 보안 저장소를 사용할 수 없습니다.');this.values[key]=this.cipher.encryptString(JSON.stringify(value)).toString('base64');this.cache.set(key,structuredClone(value));this.save();}
 delete(key:string){delete this.values[key];this.cache.delete(key);this.save();}
 has(key:string){return !!this.values[key];}
 private save(){fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.values),{mode:0o600});fs.renameSync(this.file+'.tmp',this.file);}
}
