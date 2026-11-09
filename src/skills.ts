import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {inflateRawSync,crc32} from 'node:zlib';
import {parse,stringify} from 'yaml';

export type SkillMeta={id:string;name:string;description:string;source:{kind:'git'|'zip'|'folder'|'local'|'legacy';ref?:string};hash:string;installedAt:number;enabled:boolean;approved:boolean;permissions:{tools:string[];sites:string[];scripts:string[]};files:number;bytes:number;error?:string};
type Deps={review:(meta:SkillMeta,body:string)=>Promise<boolean>;legacy:()=>{id:string;title:string;prompt:string}[];clearLegacy:()=>void};
type File={name:string;data:Buffer};
const MAX_FILES=500,MAX_BYTES=20*1024*1024,MAX_SKILLS=20,MAX_SCRIPTS=2*1024*1024;
const exec=promisify(execFile);
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0;
const digest=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const missing=(error:unknown)=>error instanceof Error&&'code' in error&&error.code==='ENOENT';
const clone=(meta:SkillMeta):SkillMeta=>structuredClone(meta);
function segment(name:string):boolean{return !!name&&name!=='.'&&name!=='..'&&!/[\\/<>:"|?*\x00-\x1f]/.test(name)&&!/[. ]$/.test(name)&&! /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)&&Buffer.byteLength(name)<=200;}
function strings(value:unknown,label:string):string[]{
 if(value===undefined)return [];
 if(!Array.isArray(value)||value.some(v=>typeof v!=='string'||!v.trim()))throw new Error(`${label} 형식이 올바르지 않습니다.`);
 return [...new Set(value as string[])];
}
export function parseSkill(text:string):{name:string;description:string;tools:string[];sites:string[];body:string}{
 const match=/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
 if(!match)throw new Error('SKILL.md에 frontmatter가 없습니다.');
 const meta=parse(match[1],{maxAliasCount:100});
 if(!meta||typeof meta!=='object'||Array.isArray(meta)||typeof meta.name!=='string'||!meta.name.trim())throw new Error('SKILL.md에 name이 없습니다.');
 const name=meta.name.trim();if(!segment(name))throw new Error('스킬 이름이 올바르지 않습니다.');
 const body=text.slice(match[0].length).trim();
 if(meta.description!==undefined&&typeof meta.description!=='string')throw new Error('description 형식이 올바르지 않습니다.');
 const description=meta.description?.trim()||body.split(/\r?\n\s*\r?\n/)[0].slice(0,200);
 const tools=strings(typeof meta['allowed-tools']==='string'?meta['allowed-tools'].trim().split(/\s+/).filter(Boolean):meta['allowed-tools'],'allowed-tools');
 return {name,description,tools,sites:strings(meta.sites??meta.metadata?.sites,'sites'),body};
}
export function tokens(text:string):Set<string>{return new Set(text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu)||[]);}
function relative(name:string):string{
 if(!name||name.startsWith('/')||name.includes('\\')||name.split('/').some(part=>!segment(part)))throw new Error('안전하지 않은 스킬 경로입니다.');
 return name;
}
async function regular(file:string,max:number):Promise<Buffer>{
 const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('심볼릭 링크와 특수 파일은 허용되지 않습니다.');
 if(stat.size>max)throw new Error('스킬 크기 제한을 초과했습니다.');
 const handle=await fs.open(file,constants.O_RDONLY|(constants.O_NOFOLLOW||0));
 try{const current=await handle.stat();if(!current.isFile()||current.size>max)throw new Error('스킬 크기 제한을 초과했습니다.');
  // A bounded read also handles a file growing after stat without allocating its new size.
  const data=Buffer.alloc(current.size+1);let length=0;
  while(length<data.length){const read=await handle.read(data,length,data.length-length,null);if(!read.bytesRead)break;length+=read.bytesRead;}
  if(length!==current.size)throw new Error('읽는 동안 스킬이 변경되었습니다.');return data.subarray(0,length);
 }finally{await handle.close();}
}
async function collect(root:string):Promise<File[]>{
 const files:File[]=[];let bytes=0,entries=0;
 async function walk(dir:string,prefix:string){
  const stat=await fs.lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('심볼릭 링크는 허용되지 않습니다.');
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
   if(entry.isSymbolicLink())throw new Error('심볼릭 링크는 허용되지 않습니다.');
   if(entry.name==='.git'||entry.name==='node_modules')continue;
   const name=relative(prefix+entry.name);if(++entries>MAX_FILES*2)throw new Error('스킬 파일 수 제한을 초과했습니다.');
   if(entry.isDirectory())await walk(path.join(dir,entry.name),name+'/');
   else{if(!entry.isFile())throw new Error('특수 파일은 허용되지 않습니다.');if(files.length>=MAX_FILES)throw new Error('스킬 파일 수 제한을 초과했습니다.');
    const data=await regular(path.join(dir,entry.name),MAX_BYTES-bytes);bytes+=data.length;files.push({name,data});}
  }
 }
 await walk(root,'');return files.sort((a,b)=>compare(a.name,b.name));
}
function snapshot(files:File[]){
 const skill=files.find(f=>f.name==='SKILL.md');if(!skill)throw new Error('SKILL.md를 찾을 수 없습니다.');
 const parsed=parseSkill(skill.data.toString('utf8'));
 return {...parsed,hash:digest(files.map(f=>`${f.name}\0${digest(f.data)}\n`).join('')),files:files.length,bytes:files.reduce((sum,f)=>sum+f.data.length,0),permissions:{tools:parsed.tools,sites:parsed.sites,scripts:files.filter(f=>/^scripts\/.*\.(py|js|mjs)$/.test(f.name)).map(f=>f.name)}};
}
async function writeFiles(root:string,files:File[]){
 await fs.mkdir(root,{recursive:true,mode:0o700});
 for(const file of files){const target=path.join(root,file.name);await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});await fs.writeFile(target,file.data,{flag:'wx',mode:0o600});}
}
// Parse ZIP metadata before writing anything. Never hand archive-controlled paths or links to a shell extractor.
// ZIP64, encrypted and exotic-compression archives are rejected rather than partially extracted.
async function unzip(source:string,destination:string){
 const archive=await regular(source,MAX_BYTES*MAX_SKILLS+4*1024*1024);
 let end=-1;for(let i=archive.length-22;i>=Math.max(0,archive.length-65557);i--)if(archive.readUInt32LE(i)===0x06054b50&&i+22+archive.readUInt16LE(i+20)===archive.length){end=i;break;}
 if(end<0)throw new Error('ZIP 형식이 올바르지 않습니다.');
 const count=archive.readUInt16LE(end+10),size=archive.readUInt32LE(end+12),start=archive.readUInt32LE(end+16);
 if(archive.readUInt16LE(end+4)||archive.readUInt16LE(end+6)||archive.readUInt16LE(end+8)!==count||count===65535||start+size!==end||count>MAX_FILES*MAX_SKILLS)throw new Error('지원하지 않거나 너무 큰 ZIP입니다.');
 const files:File[]=[];const names=new Set<string>();let cursor=start,total=0;
 for(let n=0;n<count;n++){
  if(cursor+46>end||archive.readUInt32LE(cursor)!==0x02014b50)throw new Error('ZIP 형식이 올바르지 않습니다.');
  const flags=archive.readUInt16LE(cursor+8),method=archive.readUInt16LE(cursor+10),crc=archive.readUInt32LE(cursor+16),compressed=archive.readUInt32LE(cursor+20),length=archive.readUInt32LE(cursor+24);
  const nameLength=archive.readUInt16LE(cursor+28),extra=archive.readUInt16LE(cursor+30),comment=archive.readUInt16LE(cursor+32),attributes=archive.readUInt32LE(cursor+38),offset=archive.readUInt32LE(cursor+42);
  if(cursor+46+nameLength+extra+comment>end)throw new Error('ZIP 형식이 올바르지 않습니다.');
  const raw=archive.subarray(cursor+46,cursor+46+nameLength),name=raw.toString('utf8'),directory=name.endsWith('/'),safe=relative(directory?name.slice(0,-1):name),mode=(attributes>>>16)&0xf000;
  if(!Buffer.from(name).equals(raw)||names.has(safe.toLowerCase())||(mode!==0&&mode!==0x8000&&mode!==0x4000)||(attributes&0x400)||((attributes&0x10)!==0&&!directory)||(mode===0x4000&&!directory)||(directory&&length!==0))throw new Error('ZIP 링크 또는 중복 경로는 허용되지 않습니다.');
  names.add(safe.toLowerCase());total+=length;
  if(flags&1||![0,8].includes(method)||length>MAX_BYTES||total>MAX_BYTES*MAX_SKILLS||offset+30>start||archive.readUInt32LE(offset)!==0x04034b50)throw new Error('지원하지 않거나 너무 큰 ZIP입니다.');
  const localName=archive.readUInt16LE(offset+26),localExtra=archive.readUInt16LE(offset+28),dataStart=offset+30+localName+localExtra;
  if(dataStart+compressed>start||!archive.subarray(offset+30,offset+30+localName).equals(raw)||archive.readUInt16LE(offset+6)!==flags||archive.readUInt16LE(offset+8)!==method)throw new Error('ZIP 헤더가 일치하지 않습니다.');
  const packed=archive.subarray(dataStart,dataStart+compressed),data=method===0?packed:inflateRawSync(packed,{maxOutputLength:Math.max(1,length)});
  if(data.length!==length||crc32(data)!==crc)throw new Error('ZIP 내용이 손상되었습니다.');
  if(!directory)files.push({name:safe,data});cursor+=46+nameLength+extra+comment;
 }
 if(cursor!==end)throw new Error('ZIP 형식이 올바르지 않습니다.');
 // Ancestors must be directories, never another archive member's regular file.
 const fileNames=new Set(files.map(f=>f.name.toLowerCase()));
 for(const file of files){const parts=file.name.toLowerCase().split('/');parts.pop();while(parts.length){if(fileNames.has(parts.join('/')))throw new Error('ZIP 경로가 충돌합니다.');parts.pop();}}
 await writeFiles(destination,files);
}
async function candidates(root:string):Promise<string[]>{
 const found:string[]=[];
 async function hasSkill(dir:string){try{await fs.lstat(path.join(dir,'SKILL.md'));return true;}catch(error){if(missing(error))return false;throw error;}}
 if(await hasSkill(root))return [root];
 async function children(dir:string){
  for(const entry of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>compare(a.name,b.name))){
   if(entry.isSymbolicLink())throw new Error('심볼릭 링크는 허용되지 않습니다.');
   if(entry.name==='.git'||entry.name==='node_modules'||!entry.isDirectory())continue;
   const child=path.join(dir,entry.name);if(await hasSkill(child))found.push(child);
  }
 }
 await children(root);
 try{const stat=await fs.lstat(path.join(root,'skills'));if(stat.isSymbolicLink())throw new Error('심볼릭 링크는 허용되지 않습니다.');if(stat.isDirectory())await children(path.join(root,'skills'));}catch(error){if(!missing(error))throw error;}
 const unique=[...new Set(found)];if(unique.length>MAX_SKILLS)throw new Error('스킬은 한 번에 20개까지 설치할 수 있습니다.');
 if(!unique.length)throw new Error('SKILL.md를 찾을 수 없습니다.');return unique;
}
async function checkout(source:string,destination:string,temp:string){
 // Real empty paths work with Git for Windows too; device names are not portable config files.
 // Ignore inherited Git configuration, templates, hooks and credential helpers.
 const config=path.join(temp,'gitconfig'),hooks=path.join(temp,'hooks');
 await fs.writeFile(config,'',{flag:'wx',mode:0o600});await fs.mkdir(hooks,{mode:0o700});
 const env:NodeJS.ProcessEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.toUpperCase().startsWith('GIT_')));
 Object.assign(env,{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:config,GIT_TERMINAL_PROMPT:'0',GIT_LFS_SKIP_SMUDGE:'1',GIT_TEMPLATE_DIR:hooks});
 const flags=['-c',`core.hooksPath=${hooks}`,'-c','credential.helper=','-c','protocol.ext.allow=never','-c','core.symlinks=true'];
 try{
  await exec('git',[...flags,'clone','--depth','1','--no-checkout','--template=', '--',source,destination],{env,timeout:120000,maxBuffer:1024*1024});
  await exec('git',[...flags,'-C',destination,'checkout','--force','HEAD'],{env,timeout:120000,maxBuffer:1024*1024});
 }catch(error){if(missing(error))throw new Error('git이 필요합니다.');const stderr=error instanceof Error&&'stderr' in error&&typeof error.stderr==='string'?error.stderr:'git 설치에 실패했습니다.';throw new Error(stderr.slice(0,500));}
}

export class SkillStore{
 private items:SkillMeta[]=[];
 private pending:Promise<unknown>=Promise.resolve();
 constructor(private root:string,private deps:Deps){}
 private serial<T>(work:()=>Promise<T>):Promise<T>{const result=this.pending.then(work);this.pending=result.catch(()=>{});return result;}
 private item(id:string){const meta=this.items.find(m=>m.id===id);if(!meta)throw new Error('스킬을 찾을 수 없습니다.');return meta;}
 private async save(){const temp=path.join(this.root,`.index-${randomUUID()}`);try{await fs.writeFile(temp,JSON.stringify(this.items,null,2),{mode:0o600,flag:'wx'});await fs.rename(temp,path.join(this.root,'index.json'));}finally{await fs.rm(temp,{force:true});}}
 async load():Promise<void>{return this.serial(async()=>{
  await fs.mkdir(this.root,{recursive:true,mode:0o700});
  try{const saved=JSON.parse((await regular(path.join(this.root,'index.json'),MAX_BYTES)).toString());
   if(!Array.isArray(saved)||saved.some(m=>!m||typeof m.id!=='string'||!/^[0-9a-f-]{36}$/.test(m.id)||typeof m.name!=='string'||!segment(m.name)||typeof m.description!=='string'||typeof m.hash!=='string'||typeof m.enabled!=='boolean'||typeof m.approved!=='boolean'||!m.source||!['git','zip','folder','local','legacy'].includes(m.source.kind)||!m.permissions||!Array.isArray(m.permissions.tools)||!Array.isArray(m.permissions.sites)||!Array.isArray(m.permissions.scripts))||new Set(saved.map(m=>m.id)).size!==saved.length)throw new Error('스킬 목록이 손상되었습니다.');
   this.items=saved;
  }catch(error){if(!missing(error))throw error;this.items=[];}
  let migrated=false;try{await regular(path.join(this.root,'.migrated'),100);migrated=true;}catch(error){if(!missing(error))throw error;}
  if(!migrated){for(const legacy of this.deps.legacy()){
    if(this.items.some(m=>m.source.kind==='legacy'&&m.source.ref===legacy.id))continue;
    let base=legacy.title.replace(/[\\/<>:"|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').trim()||'스킬';
    while(Buffer.byteLength(base)>180)base=base.slice(0,-1);if(!segment(base))base='스킬';
    let name=base,suffix=2;while(this.items.some(m=>m.name.toLowerCase()===name.toLowerCase()))name=`${base}-${suffix++}`;
    await this.createInternal({name,description:legacy.prompt.slice(0,200),body:legacy.prompt},{kind:'legacy',ref:legacy.id});
   }
   await fs.writeFile(path.join(this.root,'.migrated'),'1',{mode:0o600,flag:'wx'});
  }
  this.deps.clearLegacy();
 });}
 list():SkillMeta[]{return this.items.map(clone);}
 private async publish(files:File[],source:SkillMeta['source'],approved:boolean,review:boolean):Promise<SkillMeta>{
  const info=snapshot(files),old=this.items.find(m=>m.name.toLowerCase()===info.name.toLowerCase());
  const meta:SkillMeta={id:old?.id||randomUUID(),name:info.name,description:info.description,source,hash:info.hash,installedAt:Date.now(),enabled:approved,approved,permissions:info.permissions,files:info.files,bytes:info.bytes};
  const stage=await fs.mkdtemp(path.join(this.root,'.install-')),target=path.join(this.root,meta.id),backup=path.join(this.root,`.old-${randomUUID()}`);let backed=false;
  try{await writeFiles(stage,files);
   if(review){meta.approved=meta.enabled=await this.deps.review(clone(meta),info.body);if(!meta.approved)meta.error='권한 미승인';}
   // The reviewed bytes, not the mutable source directory, are published.
   if(snapshot(await collect(stage)).hash!==meta.hash)throw new Error('검토 중 스킬이 변경되었습니다.');
   if(old){await fs.rename(target,backup);backed=true;}
   await fs.rename(stage,target);
   const previous=this.items;this.items=[...this.items.filter(m=>m.id!==meta.id),meta];
   try{await this.save();}catch(error){this.items=previous;await fs.rm(target,{recursive:true,force:true});if(backed){await fs.rename(backup,target);backed=false;}throw error;}
   if(backed){await fs.rm(backup,{recursive:true,force:true});backed=false;}
   return clone(meta);
  }catch(error){if(backed){await fs.rename(backup,target);backed=false;}throw error;}
  finally{await fs.rm(stage,{recursive:true,force:true});}
 }
 async install(source:string):Promise<SkillMeta[]>{return this.serial(async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'heisen-skill-'));
  try{let kind:SkillMeta['source']['kind'],root:string;let stat;
   try{stat=await fs.lstat(source);}catch(error){if(!missing(error))throw error;}
   if(stat?.isSymbolicLink())throw new Error('심볼릭 링크는 허용되지 않습니다.');
   if(stat?.isDirectory()){kind='folder';root=path.resolve(source);}
   else if(/\.zip$/i.test(source)){kind='zip';root=path.join(temp,'archive');await unzip(source,root);}
   else if(/^(https?:\/\/|ssh:\/\/|git@)/.test(source)||/\.git$/.test(source)){kind='git';root=path.join(temp,'repository');await checkout(source,root,temp);}
   else throw new Error('폴더, ZIP 또는 git URL을 선택하세요.');
   const packages:File[][]=[];for(const dir of await candidates(root)){const files=await collect(dir);snapshot(files);packages.push(files);}
   const installed:SkillMeta[]=[];for(const files of packages)installed.push(await this.publish(files,{kind,ref:source},false,true));return installed;
  }finally{await fs.rm(temp,{recursive:true,force:true});}
 });}
 private async createInternal(input:{name:string;description:string;body:string},source:SkillMeta['source']):Promise<SkillMeta>{
  if(typeof input.name!=='string'||typeof input.description!=='string'||typeof input.body!=='string')throw new Error('스킬 형식이 올바르지 않습니다.');
  const data=Buffer.from(`---\n${stringify({name:input.name,description:input.description})}---\n${input.body}`);if(data.length>MAX_BYTES)throw new Error('스킬 크기 제한을 초과했습니다.');
  return this.publish([{name:'SKILL.md',data}],source,true,false);
 }
 async create(input:{name:string;description:string;body:string}):Promise<SkillMeta>{return this.serial(()=>this.createInternal(input,{kind:'local'}));}
 async remove(id:string):Promise<void>{return this.serial(async()=>{this.item(id);await fs.rm(path.join(this.root,id),{recursive:true,force:true});this.items=this.items.filter(m=>m.id!==id);await this.save();});}
 private async checked(meta:SkillMeta){
  try{const files=await collect(path.join(this.root,meta.id)),info=snapshot(files);if(info.hash===meta.hash)return {files,info};}catch{}
  meta.enabled=false;meta.approved=false;meta.error='변경됨';await this.save();return null;
 }
 async verify(id:string):Promise<boolean>{return this.serial(async()=>!!await this.checked(this.item(id)));}
 async setEnabled(id:string,enabled:boolean):Promise<SkillMeta>{return this.serial(async()=>{
  const meta=this.item(id);if(!enabled){meta.enabled=false;await this.save();return clone(meta);}
  let info;
  try{info=snapshot(await collect(path.join(this.root,id)));}
  catch(error){meta.enabled=false;meta.approved=false;meta.error='변경됨';await this.save();throw error;}
  if(info.hash!==meta.hash){meta.enabled=false;meta.approved=false;meta.error='변경됨';await this.save();}
  if(!meta.approved){const candidate:SkillMeta={...meta,name:info.name,description:info.description,hash:info.hash,files:info.files,bytes:info.bytes,permissions:info.permissions};
   if(this.items.some(m=>m.id!==id&&m.name.toLowerCase()===candidate.name.toLowerCase()))throw new Error('같은 이름의 스킬이 있습니다.');
   const approved=await this.deps.review(clone(candidate),info.body);
   if(snapshot(await collect(path.join(this.root,id))).hash!==info.hash){meta.enabled=false;meta.approved=false;meta.error='변경됨';await this.save();return clone(meta);}
   Object.assign(meta,candidate,{approved,enabled:approved,error:approved?undefined:'권한 미승인'});
  }else{meta.enabled=true;delete meta.error;}
  await this.save();return clone(meta);
 });}
 async body(id:string):Promise<string>{return this.serial(async()=>{const meta=this.item(id);return snapshot(await collect(path.join(this.root,meta.id))).body;});}
 pick(prompt:string,max=3):SkillMeta[]{
  const words=tokens(prompt);return this.items.filter(m=>m.enabled&&m.approved).map(meta=>({meta,score:[...tokens(meta.name+' '+meta.description)].filter(word=>words.has(word)).length})).filter(m=>m.score>=2).sort((a,b)=>b.score-a.score||compare(a.meta.name,b.meta.name)).slice(0,Math.max(0,Math.min(3,Math.floor(max)||0))).map(m=>clone(m.meta));
 }
 async bodies(ids:string[]):Promise<{id:string;name:string;text:string}[]>{return this.serial(async()=>{
  const result:{id:string;name:string;text:string}[]=[];for(const id of [...new Set(ids)].slice(0,3)){const meta=this.items.find(m=>m.id===id);if(!meta?.enabled||!meta.approved)continue;const checked=await this.checked(meta);if(checked)result.push({id,name:meta.name,text:checked.info.body.slice(0,10000)});}return result;
 });}
 async copyScripts(ids:string[],workspace:string):Promise<void>{return this.serial(async()=>{
  const copies:File[]=[];let bytes=0;
  for(const id of [...new Set(ids)].slice(0,3)){const meta=this.items.find(m=>m.id===id);if(!meta?.enabled||!meta.approved)continue;const checked=await this.checked(meta);if(!checked)continue;
   for(const file of checked.files.filter(f=>f.name.startsWith('scripts/'))){bytes+=file.data.length;if(bytes>MAX_SCRIPTS)throw new Error('스킬 스크립트는 합계 2 MB 이하여야 합니다.');copies.push({name:relative(`${meta.name}/${file.name.slice(8)}`),data:file.data});}
  }
  if(!copies.length)return;
  const workspaceStat=await fs.lstat(workspace);if(!workspaceStat.isDirectory()||workspaceStat.isSymbolicLink())throw new Error('작업 폴더가 올바르지 않습니다.');
  const root=path.join(workspace,'skills');
  async function directory(dir:string){try{await fs.mkdir(dir,{mode:0o700});}catch(error){if(!(error instanceof Error&&'code' in error&&error.code==='EEXIST'))throw error;}const stat=await fs.lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink())throw new Error('심볼릭 링크는 허용되지 않습니다.');}
  await directory(root);
  // Copy only; execution remains exclusively Engine.code_run's approved, network-disabled Docker path.
  for(const file of copies){let parent=root;const parts=file.name.split('/');for(const part of parts.slice(0,-1)){parent=path.join(parent,part);await directory(parent);}
   const target=path.join(root,file.name);try{const existing=await regular(target,MAX_SCRIPTS);if(existing.equals(file.data))continue;throw new Error('작업 폴더에 다른 스크립트가 있습니다.');}catch(error){if(!missing(error))throw error;}
   await fs.writeFile(target,file.data,{flag:'wx',mode:0o600});
  }
 });}
}
