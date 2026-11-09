import fs from 'node:fs';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {withCopy,type ProfileInfo,type ImportedCookie} from './importer.ts';
const exec=promisify(execFile);
const webUrl=(value:unknown):value is string=>{if(typeof value!=='string')return false;try{return ['http:','https:'].includes(new URL(value).protocol);}catch{return false;}};
export function fullDiskAccessDenied(e:unknown):boolean{return !!e&&typeof e==='object'&&'code' in e&&(e.code==='EPERM'||e.code==='EACCES');}
// Unlike existsSync, a denied Safari path must not silently disappear from the import dialog.
export function importFileExists(file:string):boolean{
 try{fs.statSync(file);return true;}catch(e){if(fullDiskAccessDenied(e))throw e;if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}
}
// Token scan only: no DTD/entity expansion or external resources are evaluated.
type PlistTag={name:string;end:boolean;empty:boolean};
export function parsePlistXml(xml:string):unknown{
 let pos=0;
 const invalid=():never=>{throw new Error('Invalid plist XML');};
 const space=()=>{while(pos<xml.length&&xml[pos].trim()==='')pos++;};
 const tag=():PlistTag=>{
  space();
  while(xml.startsWith('<?',pos)||xml.startsWith('<!--',pos)||xml.startsWith('<!DOCTYPE',pos)){
   const closing=xml.startsWith('<?',pos)?'?>':xml.startsWith('<!--',pos)?'-->':'>';
   const end=xml.indexOf(closing,pos);if(end<0)invalid();
   // Internal subsets are unnecessary for plutil output and are deliberately unsupported.
   if(closing==='>'&&xml.slice(pos,end).includes('['))invalid();
   pos=end+closing.length;space();
  }
  if(xml[pos++]!=='<')invalid();const start=pos;let quote='';
  while(pos<xml.length){const c=xml[pos];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;pos++;}
  if(pos===xml.length)invalid();let body=xml.slice(start,pos++).trim();const end=body.startsWith('/'),empty=body.endsWith('/');
  if(end)body=body.slice(1);if(empty)body=body.slice(0,-1).trim();
  let n=0;while(n<body.length&&body[n].trim()!=='')n++;const name=body.slice(0,n);
  if(!name||(name!=='plist'&&n!==body.length))invalid();return {name,end,empty};
 };
 const text=()=>{
  const end=xml.indexOf('<',pos);if(end<0)invalid();const raw=xml.slice(pos,end);pos=end;let value='';
  for(let i=0;i<raw.length;i++){
   if(raw[i]!=='&'){value+=raw[i];continue;}
   const end=raw.indexOf(';',i+1);if(end<0)invalid();const entity=raw.slice(i+1,end),named:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};
   if(Object.hasOwn(named,entity))value+=named[entity];
   else if(entity.startsWith('#')){
    const hex=entity[1]==='x',digits=entity.slice(hex?2:1),radix=hex?16:10;
    if(!digits||[...digits].some(c=>!(hex?'0123456789abcdef':'0123456789').includes(c.toLowerCase())))invalid();
    const code=parseInt(digits,radix);if(code<=0||code>0x10ffff||(code>=0xd800&&code<=0xdfff))invalid();value+=String.fromCodePoint(code);
   }else invalid();i=end;
  }
  return value;
 };
 const close=(name:string)=>{const t=tag();if(!t.end||t.empty||t.name!==name)invalid();};
 const value=(t:PlistTag):unknown=>{
  if(t.end)invalid();const {name,empty}=t;
  if(name==='dict'||name==='array'){
   const array:unknown[]=[],dict:Record<string,unknown>={};if(empty)return name==='dict'?dict:array;
   while(true){const child=tag();if(child.end){if(child.name!==name||child.empty)invalid();break;}
    if(name==='array')array.push(value(child));
    else{if(child.name!=='key')invalid();const key=child.empty?'':text();if(!child.empty)close('key');Object.defineProperty(dict,key,{value:value(tag()),enumerable:true,writable:true,configurable:true});}
   }
   return name==='dict'?dict:array;
  }
  if(!['string','integer','real','true','false','date','data'].includes(name))invalid();
  const raw=empty?'':text();if(!empty)close(name);
  if(name==='string')return raw;
  if(name==='true'||name==='false'){if(raw.trim())invalid();return name==='true';}
  if(name==='data')return Buffer.from(raw.split('').filter(c=>c.trim()!=='').join(''),'base64');
  if(name==='date'){const date=new Date(raw);if(!Number.isFinite(date.getTime()))invalid();return date;}
  const number=Number(raw);if(!raw.trim()||!Number.isFinite(number)||(name==='integer'&&!Number.isInteger(number)))invalid();return number;
 };
 const root=tag();if(root.name!=='plist'||root.end||root.empty)invalid();const result=value(tag());close('plist');space();if(pos!==xml.length)invalid();return result;
}
export async function readSafariBookmarks(home:string):Promise<{title:string;url:string}[]>{
 const file=path.join(home,'Library','Safari','Bookmarks.plist');if(!importFileExists(file))return [];
 // Surface the OS permission code before plutil turns it into a numeric exit status.
 const fd=fs.openSync(file,'r');fs.closeSync(fd);
 const {stdout}=await exec('/usr/bin/plutil',['-convert','xml1','-o','-',file],{encoding:'utf8',maxBuffer:32*1024*1024});
 const out:{title:string;url:string}[]=[],seen=new Set<string>();
 const walk=(value:unknown)=>{
  if(!value||typeof value!=='object')return;const node=value as Record<string,unknown>;
  if(node.WebBookmarkType==='WebBookmarkTypeLeaf'&&webUrl(node.URLString)&&!seen.has(node.URLString)){
   const uri=node.URIDictionary as {title?:unknown}|undefined;seen.add(node.URLString);out.push({title:typeof uri?.title==='string'?uri.title:'',url:node.URLString});
  }
  if(Array.isArray(node.Children))for(const child of node.Children)walk(child);
 };
 walk(parsePlistXml(stdout));return out;
}
export function readSafariHistory(home:string,limit=2000):{title:string;url:string;at:number}[]{
 const file=path.join(home,'Library','Safari','History.db');if(!importFileExists(file))return [];
 return withCopy(file,db=>db.prepare("SELECT i.url,v.title,MAX(v.visit_time) AS visited FROM history_visits v JOIN history_items i ON v.history_item=i.id WHERE i.url LIKE 'http://%' OR i.url LIKE 'https://%' GROUP BY i.id ORDER BY visited DESC LIMIT ?").all(limit).filter(r=>webUrl(r.url)).map(r=>({title:String(r.title??''),url:String(r.url),at:(Number(r.visited)+978307200)*1000})));
}
export function firefoxProfiles(base:string):ProfileInfo[]{
 const file=path.join(base,'profiles.ini');if(!importFileExists(file))return [];
 const sections:{section:string;fields:Record<string,string>}[]=[];let current:typeof sections[number]|undefined;
 for(const raw of fs.readFileSync(file,'utf8').split('\n')){
  const line=raw.trim();if(!line||line.startsWith(';')||line.startsWith('#'))continue;
  if(line.startsWith('[')&&line.endsWith(']')){current={section:line.slice(1,-1),fields:Object.create(null)};sections.push(current);continue;}
  const eq=line.indexOf('=');if(current&&eq>0)current.fields[line.slice(0,eq).trim()]=line.slice(eq+1).trim();
 }
 const seen=new Set<string>();return sections.filter(s=>s.section.startsWith('Profile')&&s.fields.Path).sort((a,b)=>Number(b.fields.Default==='1')-Number(a.fields.Default==='1')).flatMap(({fields:f})=>{
  const full=f.IsRelative==='0'?path.normalize(f.Path):path.resolve(base,f.Path);if(seen.has(full)||!fs.existsSync(full))return [];seen.add(full);return [{dir:f.Path,name:f.Name||f.Path,path:full}];
 });
}
export function readFirefoxBookmarks(profilePath:string):{title:string;url:string}[]{
 const file=path.join(profilePath,'places.sqlite');if(!importFileExists(file))return [];
 return withCopy(file,db=>{const seen=new Set<string>();return db.prepare("SELECT b.title,p.url FROM moz_bookmarks b JOIN moz_places p ON b.fk=p.id WHERE b.type=1 AND (p.url LIKE 'http://%' OR p.url LIKE 'https://%') ORDER BY b.id").all().filter(r=>{if(!webUrl(r.url)||seen.has(r.url))return false;seen.add(r.url);return true;}).map(r=>({title:String(r.title??''),url:String(r.url)}));});
}
export function readFirefoxHistory(profilePath:string,limit=2000):{title:string;url:string;at:number}[]{
 const file=path.join(profilePath,'places.sqlite');if(!importFileExists(file))return [];
 return withCopy(file,db=>db.prepare("SELECT url,title,last_visit_date FROM moz_places WHERE last_visit_date>0 AND (url LIKE 'http://%' OR url LIKE 'https://%') ORDER BY last_visit_date DESC LIMIT ?").all(limit).filter(r=>webUrl(r.url)).map(r=>({title:String(r.title??''),url:String(r.url),at:Number(r.last_visit_date)/1000})));
}
export function readFirefoxCookies(profilePath:string,nowMs=Date.now()):{items:ImportedCookie[];failed:number}{
 const file=path.join(profilePath,'cookies.sqlite');if(!importFileExists(file))return {items:[],failed:0};
 return withCopy(file,db=>{
  const columns=new Set(db.prepare('PRAGMA table_info(moz_cookies)').all().map(r=>String(r.name)));
  const attrs=columns.has('originAttributes')?'originAttributes':"''",sameSite=columns.has('sameSite')?'sameSite':'-1';
  const items:ImportedCookie[]=[];let failed=0;
  const sameSites:Record<number,ImportedCookie['sameSite']>={0:'no_restriction',1:'lax',2:'strict'};
  for(const r of db.prepare(`SELECT host,name,value,path,expiry,isSecure,isHttpOnly,${sameSite} AS sameSite,${attrs} AS attrs FROM moz_cookies`).all()){
   // Container/private/partitioned cookies cannot be safely flattened into the default cookie jar.
   if(String(r.attrs??''))continue;const expiry=Number(r.expiry);if(expiry<=nowMs/1000)continue;
   const host=String(r.host),secure=Number(r.isSecure)!==0,cookiePath=String(r.path||'/'),url=`${secure?'https':'http'}://${host.replace(/^\./,'')}${cookiePath}`;
   if(!webUrl(url)||!Number.isFinite(expiry)){failed++;continue;}
   items.push({url,name:String(r.name),value:String(r.value??''),...(host.startsWith('.')?{domain:host}:{}),path:cookiePath,secure,httpOnly:Number(r.isHttpOnly)!==0,expirationDate:expiry,sameSite:sameSites[Number(r.sameSite)]??'unspecified'});
  }
  return {items,failed};
 });
}
