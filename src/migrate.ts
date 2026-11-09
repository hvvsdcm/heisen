import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {deriveKey,decryptV10} from './chromium-crypto.ts';
import type {Data,Secrets} from './data.ts';
import type {Store} from './store.ts';
export const MIGRATION_FILE='migration.json';
export type MigrationRecord={status:'done'|'declined';from:string;at:string;secrets:'migrated'|'kept-legacy'|'none';error?:string};
export type MigrationDeps={legacyRoot:string;root:string;readKeychain:(service:string,account?:string)=>Promise<string>;confirmSecrets:()=>Promise<boolean>;encrypt:(plain:string)=>Buffer;legacyRunning:()=>boolean;askLegacyRunning:()=>Promise<'retry'|'decline'>;askFailed:(message:string)=>Promise<'retry'|'skip'>};
const ANY_DEPTH:Record<string,true>={'Cache':true,'Code Cache':true,'GPUCache':true,'DawnGraphiteCache':true,'DawnWebGPUCache':true,'GrShaderCache':true,'ShaderCache':true,'CacheStorage':true,'ScriptCache':true,'Crashpad':true,'blob_storage':true};
const ROOT_ONLY:Record<string,true>={'SingletonLock':true,'SingletonSocket':true,'SingletonCookie':true,'DevToolsActivePort':true,'Local State':true,'Preferences':true,'Network Persistent State':true,'Cookies':true,'Cookies-journal':true,'Session Storage':true,'Local Storage':true,'IndexedDB':true,'WebStorage':true,'Shared Dictionary':true,'Trust Tokens':true,'TransportSecurity':true,'DIPS':true,'secrets.json':true,'.runtime':true,'runtime-images.json':true,[MIGRATION_FILE]:true,'library.json':true};
export function needsMigration(root:string,legacyRoot:string):boolean{return fs.existsSync(path.join(legacyRoot,'library.json'))&&!fs.existsSync(path.join(root,MIGRATION_FILE))&&!fs.existsSync(path.join(root,'library.json'));}
export function legacyRunning(legacyRoot:string):boolean{
  try{const pid=Number(/-(\d+)$/.exec(fs.readlinkSync(path.join(legacyRoot,'SingletonLock')))?.[1]);if(!Number.isSafeInteger(pid)||pid<=0)return false;process.kill(pid,0);return true;}
  catch{return false;}
}
export function copyFilter(legacyRoot:string):(src:string)=>boolean{
  return src=>{const parts=path.relative(legacyRoot,src).split(path.sep).filter(Boolean);if(parts.some(p=>Object.hasOwn(ANY_DEPTH,p)))return false;return !(parts.length===1&&Object.hasOwn(ROOT_ONLY,parts[0]));};
}
function writeAtomic(file:string,text:string){fs.writeFileSync(file+'.tmp',text,{mode:0o600});fs.renameSync(file+'.tmp',file);}
export function rewriteLibrary(file:string):void{
  const library=JSON.parse(fs.readFileSync(file,'utf8'));
  if(Array.isArray(library?.tabs))for(const tab of library.tabs)if(tab&&tab.url==='own://newtab')tab.url='heisen://newtab';
  writeAtomic(file,JSON.stringify(library));
}
// Tasks store their workspace as an absolute path under the profile root; point the copied rows at the new root.
export function rewriteTaskPaths(file:string,legacyRoot:string,root:string):void{
  if(!fs.existsSync(file))return;
  const prefix=legacyRoot+path.sep;const db=new DatabaseSync(file);
  try{
    if(db.prepare('PRAGMA user_version').get()!.user_version===1)return;
    db.exec('BEGIN IMMEDIATE');
    try{
      if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='tasks'").get()){
        const update=db.prepare('UPDATE tasks SET data=? WHERE id=?');
        for(const row of db.prepare('SELECT id,data FROM tasks').all()){const task=JSON.parse(String(row.data));if(typeof task?.workspace==='string'&&task.workspace.startsWith(prefix)){task.workspace=path.join(root,task.workspace.slice(prefix.length));update.run(JSON.stringify(task),row.id as string);}}
      }
      db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  }finally{db.close();}
}
async function migrateSecrets(deps:MigrationDeps):Promise<{secrets:MigrationRecord['secrets'];error?:string}>{
  const legacy=path.join(deps.legacyRoot,'secrets.json');if(!fs.existsSync(legacy))return {secrets:'none'};
  try{
    const values:unknown=JSON.parse(fs.readFileSync(legacy,'utf8'));if(!values||typeof values!=='object'||Array.isArray(values))throw new Error('secrets.json 형식이 올바르지 않습니다.');
    if(!await deps.confirmSecrets())throw new Error('declined');
    const key=deriveKey(await deps.readKeychain('Own Safe Storage','Own'));const out:Record<string,string>={};
    for(const [name,value] of Object.entries(values)){if(typeof value!=='string')throw new Error('secrets.json 형식이 올바르지 않습니다.');const plain=decryptV10(Buffer.from(value,'base64'),key)?.toString('utf8');if(plain===undefined)throw new Error('복호화할 수 없는 값이 있습니다.');JSON.parse(plain);out[name]=deps.encrypt(plain).toString('base64');}
    writeAtomic(path.join(deps.root,'secrets.json'),JSON.stringify(out));
    return {secrets:'migrated'};
  }catch(e){
    const target=path.join(deps.root,'secrets.own.json');fs.copyFileSync(legacy,target);fs.chmodSync(target,0o600);
    const message=e instanceof Error?e.message:String(e);return {secrets:'kept-legacy',error:message==='declined'?undefined:message};
  }
}
function writeRecord(deps:MigrationDeps,r:Omit<MigrationRecord,'from'|'at'>):MigrationRecord{const full:MigrationRecord={...r,from:deps.legacyRoot,at:new Date().toISOString()};writeAtomic(path.join(deps.root,MIGRATION_FILE),JSON.stringify(full));return full;}
export async function migrateFromOwn(deps:MigrationDeps):Promise<MigrationRecord>{
  const {legacyRoot,root}=deps;fs.mkdirSync(root,{recursive:true,mode:0o700});
  while(deps.legacyRunning())if(await deps.askLegacyRunning()==='decline')return writeRecord(deps,{status:'declined',secrets:'none'});
  for(const suffix of ['-wal','-shm'])fs.rmSync(path.join(root,'tasks.sqlite'+suffix),{force:true});
  fs.cpSync(legacyRoot,root,{recursive:true,force:true,verbatimSymlinks:true,filter:copyFilter(legacyRoot)});
  rewriteTaskPaths(path.join(root,'tasks.sqlite'),legacyRoot,root);
  const secrets=await migrateSecrets(deps);
  const staged=path.join(root,'library.json.own');fs.copyFileSync(path.join(legacyRoot,'library.json'),staged);fs.chmodSync(staged,0o600);rewriteLibrary(staged);fs.renameSync(staged,path.join(root,'library.json'));
  return writeRecord(deps,{status:'done',secrets:secrets.secrets,...(secrets.error?{error:secrets.error}:{})});
}
// A failed migration is retried or explicitly skipped before Heisen creates its own library.json, so it is never silently dropped.
// Skipping drops a partially copied task database: its rows may still point at the Own workspace.
export async function runMigration(deps:MigrationDeps):Promise<MigrationRecord>{
  for(;;){
    try{return await migrateFromOwn(deps);}
    catch(e){
      const error=e instanceof Error?e.message:String(e);if(await deps.askFailed(error)==='retry')continue;
      for(const suffix of ['','-wal','-shm'])fs.rmSync(path.join(deps.root,'tasks.sqlite'+suffix),{force:true});
      return writeRecord(deps,{status:'declined',secrets:'none',error});
    }
  }
}
// Migrate every persisted task through its codec, not only Store's 30-task window.
export function migrateAuth(data:Data,secrets:Secrets,store:Store):void{
  if(secrets.has('claude-code'))secrets.delete('claude-code');
  const chatgpt=secrets.get<Record<string,unknown>>('chatgpt');if(chatgpt&&(typeof chatgpt.access!=='string'||typeof chatgpt.refresh!=='string'))secrets.delete('chatgpt');
  if(data.state.settings.provider==='claude-code'){data.state.settings.provider='claude-subscription';data.state.settings.model='';data.save();}
  for(const task of store.allRows())if(task.provider==='claude-code'){task.provider='claude-subscription';task.model='';store.save(task);}
}
