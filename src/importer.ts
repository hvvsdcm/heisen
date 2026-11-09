import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {chromiumRoots,isWindows,type ChromiumBrowserId} from './platform.ts';
import {firefoxProfiles,fullDiskAccessDenied,importFileExists} from './importer-apple.ts';
export type BrowserId=ChromiumBrowserId|'safari'|'firefox';
export type BrowserDef={id:BrowserId;name:string;service:string;dirs:string[];kind:'chromium'|'safari'|'firefox';can:{passwords:boolean;cookies:boolean}};
export const BROWSERS:BrowserDef[]=[
  {id:'chrome',name:'Google Chrome',service:'Chrome Safe Storage',dirs:['Google/Chrome'],kind:'chromium',can:{passwords:true,cookies:true}},
  {id:'chromium',name:'Chromium',service:'Chromium Safe Storage',dirs:['Chromium'],kind:'chromium',can:{passwords:true,cookies:true}},
  {id:'brave',name:'Brave',service:'Brave Safe Storage',dirs:['BraveSoftware/Brave-Browser'],kind:'chromium',can:{passwords:true,cookies:true}},
  {id:'edge',name:'Microsoft Edge',service:'Microsoft Edge Safe Storage',dirs:['Microsoft Edge'],kind:'chromium',can:{passwords:true,cookies:true}},
  {id:'vivaldi',name:'Vivaldi',service:'Vivaldi Safe Storage',dirs:['Vivaldi'],kind:'chromium',can:{passwords:true,cookies:true}},
  {id:'arc',name:'Arc',service:'Arc Safe Storage',dirs:['Arc/User Data'],kind:'chromium',can:{passwords:true,cookies:true}},
  {id:'dia',name:'Dia',service:'Dia Safe Storage',dirs:['Dia/User Data'],kind:'chromium',can:{passwords:true,cookies:true}},
  {id:'comet',name:'Comet',service:'Comet Safe Storage',dirs:['Comet'],kind:'chromium',can:{passwords:true,cookies:true}},
  {id:'aside',name:'Aside',service:'Aside Safe Storage',dirs:['Aside/User Data','Aside'],kind:'chromium',can:{passwords:true,cookies:true}},
  {id:'helium',name:'Helium',service:'Helium Storage Key',dirs:['net.imput.helium'],kind:'chromium',can:{passwords:true,cookies:true}},
  {id:'opera',name:'Opera',service:'Opera Safe Storage',dirs:['com.operasoftware.Opera'],kind:'chromium',can:{passwords:true,cookies:true}},
  {id:'safari',name:'Safari',service:'',dirs:[],kind:'safari',can:{passwords:false,cookies:false}},
  {id:'firefox',name:'Firefox',service:'',dirs:[],kind:'firefox',can:{passwords:false,cookies:true}},
];
export type ProfileInfo={dir:string;name:string;path:string};
export type SourceInfo={browser:BrowserId;name:string;service:string;root:string;profiles:ProfileInfo[];kind:BrowserDef['kind'];can:BrowserDef['can']};
// modifiedAt: last password change (Unix ms); falls back to createdAt when the source has no such date.
export type ImportedLogin={origin:string;username:string;password:string;createdAt:number;modifiedAt?:number};
export type VaultEntry={id:string;origin:string;username:string;password:string;source?:string;updatedAt?:number;signup?:{by:'agent'|'user';preset?:string;at:number}};
export type ImportedCookie={url:string;name:string;value:string;domain?:string;path:string;secure:boolean;httpOnly:boolean;expirationDate?:number;sameSite:'unspecified'|'no_restriction'|'lax'|'strict'};
const webOrigin=(url:string)=>{try{const u=new URL(url);return u.protocol==='http:'||u.protocol==='https:'?u.origin:null;}catch{return null;}};
const isWebUrl=(url:unknown):url is string=>typeof url==='string'&&webOrigin(url)!==null;
const loginKey=(origin:string,username:string)=>origin+'\n'+username;
// Keeps one login per origin+username; a later or equally recent createdAt wins.
function dedupeLogins(items:ImportedLogin[]):ImportedLogin[]{const map=new Map<string,ImportedLogin>();for(const item of items){const key=loginKey(item.origin,item.username),prev=map.get(key);if(!prev||item.createdAt>=prev.createdAt)map.set(key,item);}return [...map.values()];}
// Profiles are listed in Local State's info_cache; Default first, then natural folder order. A root holding Login Data itself (Opera) is its own profile.
export function detectSources(roots=chromiumRoots(),locations={
  safariHome:path.basename(roots.base)==='Application Support'?path.resolve(roots.base,'../..'):roots.base,
  firefoxBase:isWindows?path.join(roots.base===chromiumRoots().base?(process.env.APPDATA||path.join(os.homedir(),'AppData','Roaming')):roots.base,'Mozilla','Firefox'):path.join(roots.base,'Firefox'),
}):SourceInfo[]{
  const sources:SourceInfo[]=[];
  for(const def of BROWSERS){
    if(def.kind!=='chromium'){
      if(def.kind==='safari'&&process.platform!=='darwin')continue;
      const root=def.kind==='safari'?locations.safariHome:locations.firefoxBase;
      let profiles:ProfileInfo[];
      if(def.kind==='safari'){
        let present=false;try{present=importFileExists(path.join(root,'Library','Safari','Bookmarks.plist'));}catch(e){if(!fullDiskAccessDenied(e))throw e;present=true;}
        profiles=present?[{dir:'.',name:'Safari',path:root}]:[];
      }else profiles=firefoxProfiles(root);
      if(profiles.length)sources.push({browser:def.id,name:def.name,service:def.service,kind:def.kind,can:def.can,root,profiles});
      continue;
    }
    const root=roots.dirs[def.id as ChromiumBrowserId].map(dir=>path.join(roots.base,dir)).find(dir=>fs.existsSync(path.join(dir,'Local State'))||fs.existsSync(path.join(dir,'Login Data')));if(!root)continue;
    const profiles:ProfileInfo[]=[];
    if(fs.existsSync(path.join(root,'Login Data')))profiles.push({dir:'.',name:def.name,path:root});
    let cache:Record<string,{name?:unknown}>={};
    try{const state=JSON.parse(fs.readFileSync(path.join(root,'Local State'),'utf8'));const info=state?.profile?.info_cache;if(info&&typeof info==='object')cache=info;}catch{}
    const dirs=Object.keys(cache).sort((a,b)=>a==='Default'?-1:b==='Default'?1:a.localeCompare(b,undefined,{numeric:true}));
    for(const dir of dirs){
      const full=path.join(root,dir);if(path.dirname(full)!==root||!(fs.existsSync(path.join(full,'Preferences'))||fs.existsSync(path.join(full,'Login Data'))))continue;
      const name=cache[dir]?.name;profiles.push({dir,name:typeof name==='string'&&name?name:dir,path:full});
    }
    if(profiles.length)sources.push({browser:def.id,name:def.name,service:def.service,kind:def.kind,can:def.can,root,profiles});
  }
  return sources;
}
// Chrome may hold the database open and locked; read a private copy (with its WAL/journal) and always delete it.
export function withCopy<T>(dbPath:string,fn:(db:DatabaseSync)=>T):T{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'heisen-import-'));
  try{
    const copy=path.join(dir,'db');fs.copyFileSync(dbPath,copy);
    for(const suffix of ['-wal','-journal'])if(fs.existsSync(dbPath+suffix))fs.copyFileSync(dbPath+suffix,copy+suffix);
    const db=new DatabaseSync(copy);
    try{return fn(db);}finally{db.close();}
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
export function readLogins(profilePath:string,decrypt:(b:Uint8Array)=>Buffer|null):{items:ImportedLogin[];failed:number}{
  const items:ImportedLogin[]=[];let failed=0;
  for(const file of ['Login Data','Login Data For Account']){
    const dbPath=path.join(profilePath,file);if(!fs.existsSync(dbPath))continue;
    withCopy(dbPath,db=>{
      // Older Login Data schemas (and test fixtures) lack date_password_modified; 0 also means "never changed".
      const hasModified=db.prepare("SELECT 1 FROM pragma_table_info('logins') WHERE name='date_password_modified'").get()!==undefined;
      const modified=hasModified?'(CASE WHEN date_password_modified>0 THEN date_password_modified ELSE date_created END)':'date_created';
      for(const row of db.prepare(`SELECT origin_url, username_value, password_value, (date_created/1000 - 11644473600000) AS created, (${modified}/1000 - 11644473600000) AS modified FROM logins WHERE blacklisted_by_user = 0 AND scheme = 0`).all()){
        const origin=webOrigin(String(row.origin_url));if(!origin)continue;
        const blob=row.password_value as Uint8Array|null;if(!blob||!blob.length)continue;
        const plain=decrypt(blob);if(!plain){failed++;continue;}
        items.push({origin,username:String(row.username_value??''),password:plain.toString('utf8'),createdAt:Number(row.created),modifiedAt:Number(row.modified)});
      }
    });
  }
  return {items:dedupeLogins(items),failed};
}
const SAME_SITE=new Map<number,ImportedCookie['sameSite']>([[-1,'unspecified'],[0,'no_restriction'],[1,'lax'],[2,'strict']]);
export function readCookies(profilePath:string,decrypt:(b:Uint8Array)=>Buffer|null,nowMs=Date.now()):{items:ImportedCookie[];failed:number}{
  const dbPath=[path.join(profilePath,'Network','Cookies'),path.join(profilePath,'Cookies')].find(file=>fs.existsSync(file));if(!dbPath)return {items:[],failed:0};
  return withCopy(dbPath,db=>{
    const items:ImportedCookie[]=[];let failed=0;
    const meta=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'").get()?db.prepare("SELECT value FROM meta WHERE key='version'").get():undefined;
    const version=Number(meta?.value??0);
    const columns=new Set(db.prepare('PRAGMA table_info(cookies)').all().map(c=>String(c.name)));
    const persistent=columns.has('has_expires')?'has_expires':'is_persistent',top=columns.has('top_frame_site_key')?'top_frame_site_key':"''";
    for(const row of db.prepare(`SELECT host_key, name, value, encrypted_value, path, (expires_utc/1000000 - 11644473600) AS expires, is_secure, is_httponly, ${persistent} AS persistent, samesite, ${top} AS top FROM cookies`).all()){
      if(String(row.top??'')!=='')continue;
      const isPersistent=Number(row.persistent)!==0,expires=Number(row.expires);if(isPersistent&&expires<=nowMs/1000)continue;
      const host=String(row.host_key),encrypted=row.encrypted_value as Uint8Array|null;let value=String(row.value??'');
      if(encrypted&&encrypted.length){
        let plain=decrypt(encrypted);if(!plain){failed++;continue;}
        if(version>=24){if(plain.length<32||!plain.subarray(0,32).equals(createHash('sha256').update(host).digest())){failed++;continue;}plain=plain.subarray(32);}
        value=plain.toString('utf8');
      }
      const secure=Number(row.is_secure)!==0,cookiePath=String(row.path||'/');
      items.push({url:`${secure?'https':'http'}://${host.replace(/^\./,'')}${cookiePath}`,name:String(row.name),value,...(host.startsWith('.')?{domain:host}:{}),path:cookiePath,secure,httpOnly:Number(row.is_httponly)!==0,...(isPersistent?{expirationDate:expires}:{}),sameSite:SAME_SITE.get(Number(row.samesite))??'unspecified'});
    }
    return {items,failed};
  });
}
type BookmarkNode={type?:unknown;name?:unknown;url?:unknown;children?:unknown};
export function readBookmarks(profilePath:string):{title:string;url:string}[]{
  const file=path.join(profilePath,'Bookmarks');if(!fs.existsSync(file))return [];
  const roots=JSON.parse(fs.readFileSync(file,'utf8'))?.roots??{},seen=new Set<string>(),out:{title:string;url:string}[]=[];
  const walk=(node:BookmarkNode|undefined)=>{
    if(!node||typeof node!=='object')return;
    if(node.type==='url'&&isWebUrl(node.url)&&!seen.has(node.url)){seen.add(node.url);out.push({title:typeof node.name==='string'?node.name:'',url:node.url});}
    if(Array.isArray(node.children))for(const child of node.children)walk(child);
  };
  for(const root of ['bookmark_bar','other','synced'])walk(roots[root]);
  return out;
}
export function readHistory(profilePath:string,limit=2000):{title:string;url:string;at:number}[]{
  const dbPath=path.join(profilePath,'History');if(!fs.existsSync(dbPath))return [];
  return withCopy(dbPath,db=>db.prepare("SELECT url, title, (last_visit_time/1000 - 11644473600000) AS at FROM urls WHERE hidden = 0 AND (url LIKE 'http://%' OR url LIKE 'https://%') ORDER BY last_visit_time DESC LIMIT ?").all(limit).map(row=>({title:String(row.title??''),url:String(row.url),at:Number(row.at)})));
}
// RFC 4180: quoted fields may hold commas, doubled quotes and CR/LF line breaks; records end at LF or CRLF.
function parseCsv(text:string):string[][]{
  const rows:string[][]=[];let row:string[]=[],field='',quoted=false,i=0;
  if(text.charCodeAt(0)===0xfeff)i=1;
  for(;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;continue;}
    if(c==='"')quoted=true;
    else if(c===',')row.push(field),field='';
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}
    else field+=c;
  }
  if(field!==''||row.length){row.push(field);rows.push(row);}
  return rows.filter(r=>r.some(v=>v!==''));
}
// Header names from Apple Passwords/Safari, Chrome, Firefox, 1Password and Bitwarden exports, matched case-insensitively.
const CSV_COLUMNS={url:['url','login_uri'],username:['username','login_username'],password:['password','login_password'],created:['timecreated']};
export function parsePasswordCsv(text:string):ImportedLogin[]{
  const [header,...rows]=parseCsv(text);
  const names=(header??[]).map(h=>h.trim().toLowerCase()),col=(keys:string[])=>names.findIndex(n=>keys.includes(n));
  const url=col(CSV_COLUMNS.url),username=col(CSV_COLUMNS.username),password=col(CSV_COLUMNS.password),created=col(CSV_COLUMNS.created);
  if(url<0||password<0)throw new Error('비밀번호 CSV 형식을 인식할 수 없습니다.');
  const items:ImportedLogin[]=[];
  for(const row of rows){
    const raw=(row[url]??'').trim(),pass=row[password]??'';if(!raw||!pass)continue;
    // Bitwarden joins several URIs of one item with commas.
    const origin=webOrigin(raw)??raw.split(',').map(u=>webOrigin(u.trim())).find(Boolean);if(!origin)continue;
    const time=created<0?0:Number(row[created]);
    items.push({origin,username:username<0?'':row[username]??'',password:pass,createdAt:Number.isFinite(time)?time:0});
  }
  return dedupeLogins(items);
}
export function mergeLogins(existing:VaultEntry[],incoming:ImportedLogin[],source:string,now=Date.now()):{list:VaultEntry[];added:number;updated:number}{
  const list=existing.map(entry=>({...entry})),index=new Map(list.map(entry=>[loginKey(entry.origin,entry.username),entry]));let added=0,updated=0;
  for(const item of incoming){
    const key=loginKey(item.origin,item.username),entry=index.get(key);
    if(!entry){const created:VaultEntry={id:randomUUID(),origin:item.origin,username:item.username,password:item.password,source,updatedAt:now};list.push(created);index.set(key,created);added++;}
    else if(entry.password!==item.password){entry.password=item.password;entry.source=source;entry.updatedAt=now;updated++;}
  }
  return {list,added,updated};
}
