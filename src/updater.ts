import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash,verify} from 'node:crypto';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {RELEASE_PUBLIC_KEY} from './release-key.ts';

export type Target='mac-arm64'|'mac-x64'|'win-x64'|'win-arm64';
type ReleaseFile={name:string;bytes:number;sha256:string};
export type Latest={version:string;publishedAt:string;expiresAt:string;minMacOS?:string;files:Partial<Record<Target,ReleaseFile>>;windows?:{status:string};notes?:string;sig:string};
export type UpdateState={status:'idle'|'checking'|'upToDate'|'available'|'downloading'|'ready'|'error'|'disabled';version?:string;progress?:number;error?:string;checkedAt?:number};
type AppLifecycle={relaunch:(options:{execPath:string})=>void;quit:()=>void};
type Command=(file:string,args:string[])=>Promise<string>;
type Dependencies={version:string;target:Target;dir:string;baseURL:string;publicKey:string;packaged:boolean;execPath:string;changed:()=>void;fetchImpl?:typeof fetch;app?:AppLifecycle;run?:Command};
const exec=promisify(execFile);
const run:Command=async(file,args)=>{
 const result=await exec(file,args,{timeout:120000,maxBuffer:1024*1024,encoding:'utf8'});
 // codesign writes display metadata to stderr, unlike PlistBuddy and sw_vers.
 return (file==='/usr/bin/codesign'&&args[0]==='-dv'?result.stderr:result.stdout).trim();
};
const TARGETS:Target[]=['mac-arm64','mac-x64','win-x64','win-arm64'];
const SIGNATURE_ERROR='업데이트 서명이 올바르지 않습니다.';
const BUNDLE_ID='com.heisen.browser';
const CLOCK_SKEW_MS=5*60*1000;

// Byte-for-byte JSON semantics shared with heisen-web/scripts/publish-release.mjs.
export function canonical(value:unknown):string{
 return JSON.stringify(value,(_key,item)=>{
  if(item===null||typeof item!=='object'||Array.isArray(item))return item;
  return Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]]));
 });
}
function versionParts(value:string):number[]{
 if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value))throw new Error('올바르지 않은 업데이트 버전입니다.');
 const parts=value.split('.').map(Number);if(parts.some(n=>!Number.isSafeInteger(n)))throw new Error('올바르지 않은 업데이트 버전입니다.');return parts;
}
export function newer(candidate:string,current:string):boolean{
 const a=versionParts(candidate),b=versionParts(current);
 for(let i=0;i<3;i++)if(a[i]!==b[i])return a[i]>b[i];return false;
}
function object(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function base64(value:string,bytes:number):Buffer{
 const decoded=Buffer.from(value,'base64');if(decoded.length!==bytes||decoded.toString('base64')!==value)throw new Error(SIGNATURE_ERROR);return decoded;
}
function fresh(expiresAt:unknown,now=Date.now()):void{
 if(typeof expiresAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(expiresAt))throw new Error('업데이트 만료 시간이 올바르지 않습니다.');
 const expiry=Date.parse(expiresAt);
 if(!Number.isFinite(expiry)||new Date(expiry).toISOString()!==expiresAt.replace(/(:\d{2})Z$/,'$1.000Z'))throw new Error('업데이트 만료 시간이 올바르지 않습니다.');
 if(now>expiry+CLOCK_SKEW_MS)throw new Error('업데이트 정보가 만료되었습니다. 다시 확인하세요.');
}
export function verifyManifest(text:string,publicKeyB64:string):Latest{
 let raw:unknown;try{raw=JSON.parse(text);}catch{throw new Error(SIGNATURE_ERROR);}
 if(!object(raw)||typeof raw.sig!=='string')throw new Error(SIGNATURE_ERROR);
 const {sig,...rest}=raw;
 try{
  const key=Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),base64(publicKeyB64,32)]);
  if(!verify(null,Buffer.from(canonical(rest),'utf8'),{key,format:'der',type:'spki'},base64(sig,64)))throw new Error(SIGNATURE_ERROR);
 }catch{throw new Error(SIGNATURE_ERROR);}
 if(typeof rest.version!=='string'||typeof rest.publishedAt!=='string'||!Number.isFinite(Date.parse(rest.publishedAt))||!object(rest.files))throw new Error('업데이트 정보가 올바르지 않습니다.');
 fresh(rest.expiresAt);
 versionParts(rest.version);
 if(rest.minMacOS!==undefined&&(typeof rest.minMacOS!=='string'||!/^\d+(?:\.\d+){0,2}$/.test(rest.minMacOS)))throw new Error('최소 macOS 버전이 올바르지 않습니다.');
 if(rest.notes!==undefined&&typeof rest.notes!=='string')throw new Error('업데이트 설명이 올바르지 않습니다.');
 if(rest.windows!==undefined&&(!object(rest.windows)||!['planned','available'].includes(String(rest.windows.status))))throw new Error('Windows 업데이트 정보가 올바르지 않습니다.');
 for(const [target,file] of Object.entries(rest.files)){
  if(!TARGETS.includes(target as Target)||!object(file))throw new Error('업데이트 파일 정보가 올바르지 않습니다.');
  const name=`Heisen-${rest.version}-${target}${target.startsWith('mac-')?'.dmg':'-Setup.exe'}`;
  if(file.name!==name||!Number.isSafeInteger(file.bytes)||Number(file.bytes)<=0||typeof file.sha256!=='string'||!/^[\da-f]{64}$/.test(file.sha256))throw new Error('업데이트 파일 정보가 올바르지 않습니다.');
 }
 return raw as Latest;
}
export function currentTarget():Target{
 if(!['darwin','win32'].includes(process.platform)||!['arm64','x64'].includes(process.arch))throw new Error('지원하지 않는 업데이트 플랫폼입니다.');
 return `${process.platform==='darwin'?'mac':'win'}-${process.arch}` as Target;
}
function bundlePath(execPath:string):string{
 const bundle=path.resolve(execPath,'../../..');
 if(!bundle.endsWith('.app')||path.resolve(execPath)!==path.join(bundle,'Contents','MacOS','Heisen'))throw new Error('설치된 Heisen 앱 경로가 올바르지 않습니다.');
 if(execPath.includes('/AppTranslocation/'))throw new Error('응용 프로그램 폴더로 옮긴 뒤 다시 시도하세요');
 return bundle;
}
async function exists(file:string):Promise<boolean>{try{await fs.lstat(file);return true;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}}
async function plist(bundle:string,key:string,command:Command):Promise<string>{return command('/usr/libexec/PlistBuddy',['-c',`Print :${key}`,path.join(bundle,'Contents','Info.plist')]);}
async function identity(bundle:string,command:Command,version?:string,team?:string):Promise<void>{
 if(!(await fs.lstat(bundle)).isDirectory()||await fs.realpath(bundle)!==bundle)throw new Error('업데이트 앱 경로가 올바르지 않습니다.');
 if(await plist(bundle,'CFBundleIdentifier',command)!==BUNDLE_ID||await plist(bundle,'CFBundleExecutable',command)!=='Heisen')throw new Error('업데이트 앱 식별자가 올바르지 않습니다.');
 if(version&&await plist(bundle,'CFBundleShortVersionString',command)!==version)throw new Error('업데이트 앱 버전이 일치하지 않습니다.');
 await command('/usr/bin/codesign',['--verify','--deep','--strict',...(team?[`-R=anchor apple generic and certificate leaf[subject.OU] = "${team}"`]:[]),bundle]);
}
async function teamIdentifier(bundle:string,command:Command):Promise<string|undefined>{
 const metadata=await command('/usr/bin/codesign',['-dv',bundle]);
 const team=/^TeamIdentifier=(.*)$/m.exec(metadata)?.[1].trim();
 if(!team||team==='not set')return undefined;
 if(!/^[A-Z0-9]{10}$/.test(team))throw new Error('설치된 앱 서명자를 확인할 수 없습니다.');
 return team;
}
async function verifyFile(file:string,expected:ReleaseFile):Promise<void>{
 const handle=await fs.open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{
  const stat=await handle.stat();if(!stat.isFile()||stat.size!==expected.bytes)throw new Error('업데이트 파일 크기가 일치하지 않습니다.');
  const hash=createHash('sha256');for await(const chunk of handle.createReadStream({autoClose:false}))hash.update(chunk);
  if(hash.digest('hex')!==expected.sha256)throw new Error('업데이트 파일 SHA-256이 일치하지 않습니다.');
 }finally{await handle.close();}
}

export class Updater {
 private value:UpdateState;private manifest?:Latest;private manifestText?:string;private etag?:string;private highest:string;
 private downloaded?:string;private busy=false;private installing=false;private initial?:NodeJS.Timeout;private periodic?:NodeJS.Timeout;
 private fetchImpl:typeof fetch;private command:Command;
 constructor(private deps:Dependencies){
  this.value={status:!deps.packaged||!deps.publicKey?'disabled':'idle'};this.highest=deps.version;
  this.fetchImpl=deps.fetchImpl??fetch;this.command=deps.run??run;
 }
 state():UpdateState{return {...this.value};}
 private set(value:UpdateState):void{this.value=value;this.deps.changed();}
 private fail(error:unknown):void{this.set({status:'error',checkedAt:this.value.checkedAt,error:error instanceof Error?error.message:String(error)});}
 private enabled():boolean{return this.deps.packaged&&!!this.deps.publicKey;}
 private url(name:string):string{
  const base=new URL(this.deps.baseURL);if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw new Error('업데이트 서버는 HTTPS 원본이어야 합니다.');
  return new URL('/dl/'+name,base).href;
 }
 private async compatible(manifest:Latest):Promise<void>{
  fresh(manifest.expiresAt);
  if(newer(this.highest,manifest.version))throw new Error('이전 버전으로 업데이트할 수 없습니다.');
  if(this.deps.target.startsWith('mac-')&&manifest.minMacOS){
   const actual=(await this.command('/usr/bin/sw_vers',['-productVersion'])).split('.').map(Number),minimum=manifest.minMacOS.split('.').map(Number);
   if(!actual.length||actual.some(n=>!Number.isSafeInteger(n)))throw new Error('macOS 버전을 확인할 수 없습니다.');
   for(let i=0;i<3;i++){if((actual[i]??0)>(minimum[i]??0))break;if((actual[i]??0)<(minimum[i]??0))throw new Error(`macOS ${manifest.minMacOS} 이상이 필요합니다.`);}
  }
 }
 async check(force=false):Promise<void>{
  if(!this.enabled()){this.set({status:'disabled'});return;}
  if(this.busy||this.installing||this.value.status==='ready')return;
  this.busy=true;this.set({status:'checking'});
  try{
   const response=await this.fetchImpl(this.url('latest.json'),{headers:!force&&this.etag?{'If-None-Match':this.etag}:{},signal:AbortSignal.timeout(10000),redirect:'error',credentials:'omit',referrerPolicy:'no-referrer'});
   let text:string;
   if(response.status===304){if(!this.manifestText)throw new Error('캐시된 업데이트 정보가 없습니다.');text=this.manifestText;}
   else{
    if(response.status!==200||!response.body)throw new Error(`업데이트 확인 실패 (HTTP ${response.status})`);
    const chunks:Uint8Array[]=[];let bytes=0;const reader=response.body.getReader();
    try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>65536)throw new Error('업데이트 정보가 너무 큽니다.');chunks.push(value);}}finally{await reader.cancel();reader.releaseLock();}
    text=Buffer.concat(chunks).toString('utf8');
   }
   const manifest=verifyManifest(text,this.deps.publicKey);await this.compatible(manifest);
   this.manifest=manifest;this.manifestText=text;this.highest=manifest.version;
   if(response.status===200)this.etag=response.headers.get('etag')??undefined;
   this.set({status:manifest.files[this.deps.target]&&newer(manifest.version,this.deps.version)?'available':'upToDate',version:manifest.version,checkedAt:Date.now()});
  }catch(error){this.fail(error);}finally{this.busy=false;}
 }
 async download():Promise<void>{
  if(!this.enabled()||this.busy||this.installing||this.value.status!=='available'||!this.manifest)return;
  const manifest=this.manifest,file=manifest.files[this.deps.target];if(!file)return;
  this.busy=true;let temp:string|undefined;
  this.set({status:'downloading',version:manifest.version,progress:0,checkedAt:this.value.checkedAt});
  try{
   await this.compatible(manifest);
   await fs.mkdir(this.deps.dir,{recursive:true,mode:0o700});
   temp=await fs.mkdtemp(path.join(this.deps.dir,'release-'));const part=path.join(temp,file.name+'.part');
   const response=await this.fetchImpl(this.url(file.name),{signal:AbortSignal.timeout(30*60*1000),redirect:'error',credentials:'omit',referrerPolicy:'no-referrer'});
   if(response.status!==200||!response.body)throw new Error(`업데이트 다운로드 실패 (HTTP ${response.status})`);
   const length=response.headers.get('content-length');if(length!==null&&Number(length)!==file.bytes){await response.body.cancel();throw new Error('업데이트 파일 크기가 일치하지 않습니다.');}
   const handle=await fs.open(part,'wx',0o600),reader=response.body.getReader(),hash=createHash('sha256');let bytes=0,last=Date.now();
   try{
    for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>file.bytes)throw new Error('업데이트 파일 크기가 일치하지 않습니다.');await handle.writeFile(value);hash.update(value);
     if(Date.now()-last>=500){last=Date.now();this.set({...this.value,progress:Math.floor(bytes/file.bytes*100)});}
    }
    if(bytes!==file.bytes)throw new Error('업데이트 파일 크기가 일치하지 않습니다.');
    if(hash.digest('hex')!==file.sha256)throw new Error('업데이트 파일 SHA-256이 일치하지 않습니다.');
    await handle.sync();
   }finally{await reader.cancel().finally(()=>{reader.releaseLock();});await handle.close();}
   this.downloaded=path.join(temp,file.name);await fs.rename(part,this.downloaded);temp=undefined;
   this.set({...this.value,status:'ready',progress:100});
  }catch(error){this.downloaded=undefined;this.fail(error);}finally{if(temp)await fs.rm(temp,{recursive:true,force:true});this.busy=false;}
 }
 // Only the user-facing update.install RPC calls this; scheduling never installs or downloads.
 async install():Promise<void>{
  if(!this.enabled()||this.busy||this.installing||this.value.status!=='ready'||!this.downloaded||!this.manifestText)return;
  this.busy=true;this.installing=true;
  try{
   const manifest=verifyManifest(this.manifestText,this.deps.publicKey),file=manifest.files[this.deps.target];
   if(!file||!newer(manifest.version,this.deps.version))throw new Error('이전 버전으로 업데이트할 수 없습니다.');
   await this.compatible(manifest);await verifyFile(this.downloaded,file);
   // Electron's app export exists only in the Electron runtime; Node unit tests inject lifecycle methods.
   const app=this.deps.app??(await import('electron')).app;
   if(this.deps.target.startsWith('mac-'))await this.installMac(this.downloaded,manifest.version,app);
   else{
    // Wait for successful process creation, not installer completion; Squirrel waits for us to exit.
    const child=spawn(this.downloaded,['--silent'],{detached:true,stdio:'ignore',windowsHide:true});
    await new Promise<void>((resolve,reject)=>{child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});app.quit();
   }
  }catch(error){this.installing=false;this.fail(error);}finally{this.busy=false;}
 }
 private async installMac(dmg:string,version:string,app:AppLifecycle):Promise<void>{
  const bundle=bundlePath(this.deps.execPath),parent=path.dirname(bundle),old=bundle+'.old';
  await identity(bundle,this.command,this.deps.version);
  const team=await teamIdentifier(bundle,this.command);
  try{await fs.access(parent,constants.W_OK);}catch{throw new Error('설치 폴더에 쓸 수 없습니다');}
  if(await exists(old))throw new Error('이전 업데이트 백업이 남아 있습니다. 앱을 다시 시작한 뒤 시도하세요.');
  const staging=await fs.mkdtemp(path.join(parent,'.Heisen-update-')),replacement=path.join(staging,'Heisen.app');
  const mount=await fs.mkdtemp(path.join(path.dirname(dmg),'mnt-'));let attached=false,backedUp=false,swapped=false;
  try{
   // Treat even a failed attach as potentially mounted; detach before removing the mount directory.
   attached=true;await this.command('/usr/bin/hdiutil',['attach','-nobrowse','-readonly','-noautoopen','-mountpoint',mount,dmg]);
   await this.command('/usr/bin/ditto',[path.join(mount,'Heisen.app'),replacement]);
   await identity(replacement,this.command,version,team);
   await this.command('/usr/bin/hdiutil',['detach',mount]);attached=false;
   // Both renames are within one filesystem. Roll back on every failure; never delete the backup here.
   await fs.rename(bundle,old);backedUp=true;
   await fs.rename(replacement,bundle);swapped=true;
   app.relaunch({execPath:path.join(bundle,'Contents','MacOS','Heisen')});app.quit();
  }catch(error){
   if(backedUp){
    try{if(swapped)await fs.rename(bundle,replacement);await fs.rename(old,bundle);}
    catch(rollback){throw new Error(`업데이트 복구 실패. 이전 앱은 ${old}에 보관되어 있습니다: ${String(rollback)} (원인: ${String(error)})`);}
   }
   throw error;
  }finally{
   if(attached){try{await this.command('/usr/bin/hdiutil',['detach',mount]);attached=false;}catch{/* Leave a still-mounted directory intact. */}}
   if(!attached)await fs.rmdir(mount).catch(()=>{});
   await fs.rm(staging,{recursive:true,force:true});
  }
 }
 schedule():void{
  if(this.initial||this.periodic||!this.enabled())return;
  this.initial=setTimeout(()=>{void this.check();this.periodic=setInterval(()=>{void this.check();},6*60*60*1000);this.periodic.unref();},120000);this.initial.unref();
 }
 stop():void{clearTimeout(this.initial);clearInterval(this.periodic);this.initial=undefined;this.periodic=undefined;}
 // Call only after the replacement has successfully reached app.ready. An unsuccessful launch keeps .old.
 static async cleanupOld(execPath:string,command:Command=run):Promise<void>{
  if(process.platform!=='darwin')return;
  try{
   const bundle=bundlePath(execPath),old=bundle+'.old';if(!await exists(old))return;
   await identity(bundle,command);await identity(old,command);
   const current=await plist(bundle,'CFBundleShortVersionString',command),previous=await plist(old,'CFBundleShortVersionString',command);
   if(newer(current,previous))await fs.rm(old,{recursive:true});
  }catch(error){console.error('Update backup retained:',error instanceof Error?error.message:String(error));}
 }
 // Three main.ts lines: import, register after app.ready, schedule after beta.ready.
 // Electron cannot be statically imported here: the same module verifies releases in plain Node tests.
 static async register(deps:{changed:()=>void;registerState:(key:string,get:()=>unknown)=>void;registerRpc:(methods:Record<string,()=>unknown>)=>void}):Promise<Updater>{
  const {app}=await import('electron');
  if(app.isPackaged)await Updater.cleanupOld(process.execPath);
  const updater=new Updater({version:app.getVersion(),target:currentTarget(),dir:path.join(app.getPath('userData'),'updates'),baseURL:'https://heisen.dev',publicKey:RELEASE_PUBLIC_KEY,packaged:app.isPackaged,execPath:process.execPath,changed:deps.changed,app});
  deps.registerState('update',()=>updater.state());
  deps.registerRpc({'update.check':()=>updater.check(true),'update.download':()=>updater.download(),'update.install':()=>updater.install()});
  app.once('before-quit',()=>updater.stop());return updater;
 }
}
