import fs from 'node:fs';
import path from 'node:path';
import {isIP} from 'node:net';
import {createHash} from 'node:crypto';
import {domainToASCII} from 'node:url';
import {DatabaseSync,type StatementSync} from 'node:sqlite';
import type {WebContents} from 'electron';
import type {Data} from './data.ts';
import type {ShieldRule} from './shield.ts';

// Array indices are persisted membership bits: keep existing entries in this order.
export const LISTS=[
 {id:'blp-malware',url:'https://blocklistproject.github.io/Lists/alt-version/malware-nl.txt',license:'Unlicense',name:'Block List Project · malware'},
 {id:'blp-phishing',url:'https://blocklistproject.github.io/Lists/alt-version/phishing-nl.txt',license:'Unlicense',name:'Block List Project · phishing'},
 {id:'blp-scam',url:'https://blocklistproject.github.io/Lists/alt-version/scam-nl.txt',license:'Unlicense',name:'Block List Project · scam'},
 {id:'blp-ransomware',url:'https://blocklistproject.github.io/Lists/alt-version/ransomware-nl.txt',license:'Unlicense',name:'Block List Project · ransomware'},
 {id:'blp-fraud',url:'https://blocklistproject.github.io/Lists/alt-version/fraud-nl.txt',license:'Unlicense',name:'Block List Project · fraud'},
 {id:'phdb-active',url:'https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt',license:'MIT',name:'Phishing.Database'},
] as const;
export const NEVER_BLOCK=['heisen.dev','localhost'];
const PERIOD=12*60*60*1000,MAX_BYTES=64*1024*1024;
const hostKey=(host:string)=>host.toLowerCase().replace(/\.$/,'');
/** Hash a canonical host without rounding its signed 64-bit SQLite key. */
export function hostHash(host:string):bigint{return createHash('sha256').update(host).digest().readBigInt64BE(0);}
function validHost(input:string):string|null{
 const value=hostKey(input);if(!value||/[\s/@:#?\\]/.test(value))return null;
 const host=domainToASCII(value);if(!host||host.length>253||!host.includes('.'))return null;
 if(isIP(host))return host;
 if(/^[\d.]+$/.test(host))return null;
 return host.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))?host:null;
}
export function parseDomains(text:string):string[]{
 const hosts=new Set<string>();
 for(const line of text.split(/\r?\n/)){
  const raw=line.split('#',1)[0].trim().replace(/^0\.0\.0\.0\s+/,'');
  const host=validHost(raw);if(host)hosts.add(host);
 }
 return [...hosts];
}
export function candidates(input:string):string[]{
 const host=hostKey(input);if(isIP(host.replace(/^\[|\]$/g,'')))return [host];
 const labels=host.split('.'),out:string[]=[];for(let i=0;i<labels.length-1;i++)out.push(labels.slice(i).join('.'));return out;
}
function exempt(host:string):boolean{
 if(NEVER_BLOCK.some(name=>host===name||host.endsWith('.'+name))||host.endsWith('.local')||!host.includes('.'))return true;
 const ip=host.replace(/^\[|\]$/g,'');
 if(isIP(ip)===4){const [a,b]=ip.split('.').map(Number);return a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168;}
 if(isIP(ip)===6){
  if(ip==='::'||ip==='::1'||/^(?:fc|fd|fe[89ab])/.test(ip))return true;
  const mapped=/^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/.exec(ip);
  if(mapped){const a=parseInt(mapped[1],16),b=parseInt(mapped[2],16);return exempt(`${a>>8}.${a&255}.${b>>8}.${b&255}`);}
 }
 return false;
}
export class SafeBrowsing {
 private db:DatabaseSync;private lookup:StatementSync;private allowed=new Map<number,string>();private watched=new WeakSet<WebContents>();
 private pending?:Promise<void>;private controller?:AbortController;private closed=false;
 private initial?:NodeJS.Timeout;private hourly?:NodeJS.Timeout;
 private updatedAt=0;private hosts=0;
 constructor(private root:string,private data:Data,private fetchImpl:typeof fetch=fetch){
  fs.mkdirSync(root,{recursive:true,mode:0o700});this.db=new DatabaseSync(path.join(root,'safebrowsing.sqlite'));
  const version=Number(this.db.prepare('PRAGMA user_version').get()?.user_version??0);
  if(version<1){
   const legacy=this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('hosts','sources')").get();
   this.db.exec('BEGIN');
   try{
    this.db.exec('DROP TABLE IF EXISTS hosts; DROP TABLE IF EXISTS sources; CREATE TABLE hosts(hash INTEGER PRIMARY KEY,lists INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS meta(id TEXT PRIMARY KEY,etag TEXT,at INTEGER,count INTEGER); DELETE FROM meta; PRAGMA user_version=1; COMMIT');
   }catch(error){this.db.exec('ROLLBACK');this.db.close();throw error;}
   if(legacy)this.db.exec('VACUUM');
  }
  this.lookup=this.db.prepare('SELECT lists FROM hosts WHERE hash=?');
  this.updatedAt=Number(this.db.prepare('SELECT max(at) AS at FROM meta').get()?.at??0);this.hosts=Number(this.db.prepare('SELECT count(*) AS count FROM hosts').get()?.count??0);
 }
 check(input:string):{listed:boolean;list?:string}{
  const host=hostKey(input);if(this.closed||!this.data.state.settings.safeBrowsing.enabled||exempt(host))return {listed:false};
  for(const name of candidates(host)){
   const row=this.lookup.get(hostHash(name));if(!row)continue;
   const lists=Number(row.lists),index=LISTS.findIndex((_,i)=>(lists&(1<<i))!==0);
   if(index!==-1)return {listed:true,list:LISTS[index].id};
  }
  return {listed:false};
 }
 allowOnce(wc:WebContents,host:string):void{
  this.allowed.set(wc.id,hostKey(host));
  if(this.watched.has(wc))return;this.watched.add(wc);
  wc.on('did-start-navigation',details=>{
   if(!details.isMainFrame||details.isSameDocument)return;
   let host:string|undefined;try{host=hostKey(new URL(details.url).hostname);}catch{}
   if(host!==this.allowed.get(wc.id))this.allowed.delete(wc.id);
  });
  wc.once('destroyed',()=>this.allowed.delete(wc.id));
 }
 isAllowed(wcId:number,host:string):boolean{return this.allowed.get(wcId)===hostKey(host);}
 update(force=false):Promise<void>{
  if(this.closed)return Promise.resolve();
  if(!this.pending)this.pending=this.refresh(force).finally(()=>{this.pending=undefined;});
  return this.pending;
 }
 private async refresh(force:boolean):Promise<void>{
  for(const [index,list] of LISTS.entries()){
   if(this.closed)return;
   const meta=this.db.prepare('SELECT etag,at FROM meta WHERE id=?').get(list.id);
   if(!force&&meta&&Date.now()-Number(meta.at)<PERIOD)continue;
   const controller=new AbortController();this.controller=controller;
   try{
    const response=await this.fetchImpl(list.url,{headers:meta?.etag?{'If-None-Match':String(meta.etag)}:{},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)]),credentials:'omit',referrerPolicy:'no-referrer',redirect:'error'});
    if(this.closed)return;
    if(response.status===304){
     if(!meta)throw new Error('304 without cached list');
     const at=Date.now(),update=this.db.prepare('UPDATE meta SET at=? WHERE id=?');update.setReadBigInts(true);update.run(at,list.id);this.updatedAt=at;continue;
    }
    if(response.status!==200)throw new Error(`HTTP ${response.status}`);
    if(Number(response.headers.get('content-length'))>MAX_BYTES)throw new Error('List exceeds size limit');
    if(!response.body)throw new Error('Missing list body');
    const reader=response.body.getReader(),decoder=new TextDecoder(),parts:string[]=[];let bytes=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_BYTES)throw new Error('List exceeds size limit');parts.push(decoder.decode(value,{stream:true}));}parts.push(decoder.decode());}
    finally{await reader.cancel();reader.releaseLock();}
    if(this.closed)return;
    const hosts=parseDomains(parts.join(''));if(!hosts.length)throw new Error('Empty or invalid list');
    this.db.exec('BEGIN');
    try{
     const bit=1<<index;
     // Clear only this feed's membership: a host in another feed must stay blocked.
     const clear=this.db.prepare('UPDATE hosts SET lists=lists&~? WHERE lists&?');clear.setReadBigInts(true);clear.run(bit,bit);
     this.db.exec('DELETE FROM hosts WHERE lists=0');
     const insert=this.db.prepare('INSERT INTO hosts(hash,lists) VALUES(?,?) ON CONFLICT(hash) DO UPDATE SET lists=lists|excluded.lists');
     // run() also reads lastInsertRowid, which is the full 64-bit host hash.
     insert.setReadBigInts(true);
     for(const host of hosts)insert.run(hostHash(host),bit);
     const saveMeta=this.db.prepare('INSERT INTO meta(id,etag,at,count) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET etag=excluded.etag,at=excluded.at,count=excluded.count');
     saveMeta.setReadBigInts(true);saveMeta.run(list.id,response.headers.get('etag'),Date.now(),hosts.length);
     this.db.exec('COMMIT');
     this.updatedAt=Number(this.db.prepare('SELECT max(at) AS at FROM meta').get()?.at??0);this.hosts=Number(this.db.prepare('SELECT count(*) AS count FROM hosts').get()?.count??0);
    }catch(error){this.db.exec('ROLLBACK');throw error;}
   }catch(error){controller.abort();if(!this.closed)console.error(`Safe browsing update (${list.id}) failed:`,error instanceof Error?error.message:String(error));}
   finally{if(this.controller===controller)this.controller=undefined;}
  }
 }
 schedule():void{
  if(this.closed||this.hourly)return;
  this.initial=setTimeout(()=>{void this.update();},15000);this.initial.unref();
  this.hourly=setInterval(()=>{void this.update();},60*60*1000);this.hourly.unref();
 }
 status():{updatedAt:number;hosts:number}{
  if(this.closed)return {updatedAt:0,hosts:0};
  return {updatedAt:this.updatedAt,hosts:this.hosts};
 }
 rule(onBlock:(wcId:number,url:string,list:string)=>void,canBypass:(wcId:number)=>boolean=()=>true):ShieldRule{return {before:d=>{
  if(d.resourceType!=='mainFrame'&&d.resourceType!=='subFrame')return;
  let url:URL;try{url=new URL(d.url);}catch{return;}
  if(url.protocol!=='http:'&&url.protocol!=='https:')return;
  const result=this.check(url.hostname);if(!result.listed||d.resourceType==='mainFrame'&&d.webContentsId!==undefined&&this.isAllowed(d.webContentsId,url.hostname)&&canBypass(d.webContentsId))return;
  if(d.resourceType==='mainFrame'&&d.webContentsId!==undefined)onBlock(d.webContentsId,d.url,LISTS.find(l=>l.id===result.list)?.name??result.list!);
  return {cancel:true};
 }};}
 close():void{
  if(this.closed)return;this.closed=true;clearTimeout(this.initial);clearInterval(this.hourly);this.controller?.abort();this.allowed.clear();this.db.close();
 }
}
