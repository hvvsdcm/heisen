import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {cliInstallTargets,isWindows} from '../platform.ts';

const exec=promisify(execFile);
export type InstallResult={path:string;pathHint:boolean};
export type InstallOptions={user?:boolean};
function sourceFor(bundle:string):string{
 const resolved=path.resolve(bundle),file=isWindows?'heisen.cmd':'heisen';
 const launcher=path.basename(resolved)==='heisen.mjs'?path.join(path.dirname(resolved),file):path.resolve(path.dirname(resolved),'..','build','cli',file);
 return isWindows||fs.existsSync(launcher)?launcher:resolved;
}
function shimFor(bundle:string):string{
 const launcher=sourceFor(bundle);
 if(/[\r\n"\x00]/.test(launcher))throw new Error('CLI 경로가 올바르지 않습니다.');
 // Transfer batch execution without CALL's second expansion of user arguments.
 return `@echo off\r\nrem Heisen CLI shim\r\nsetlocal DisableDelayedExpansion\r\n"${launcher.replace(/%/g,'%%')}" %*\r\n`;
}
function matches(target:string,bundle:string):boolean{
 try{
  const stat=fs.lstatSync(target);
  return isWindows?stat.isFile()&&fs.readFileSync(target,'utf8')===shimFor(bundle):stat.isSymbolicLink()&&path.resolve(path.dirname(target),fs.readlinkSync(target))===sourceFor(bundle);
 }catch{return false;}
}
async function updateWindowsPath(dir:string,add:boolean):Promise<void>{
 const literal=dir.replace(/'/g,"''");
 const script=`$ErrorActionPreference='Stop'; $dir='${literal}'; $old=[Environment]::GetEnvironmentVariable('Path','User'); $parts=@($old -split ';' | Where-Object { $_ -and $_.TrimEnd('\\') -ine $dir.TrimEnd('\\') }); ${add?'$parts += $dir; ':''}[Environment]::SetEnvironmentVariable('Path',($parts -join ';'),'User')`;
 await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:15000});
}
export function cliInstalled(bundle:string):boolean{
 return cliInstallTargets().some(target=>matches(path.join(target.dir,target.file),bundle));
}
export async function installCli(bundle:string,options:InstallOptions={}):Promise<InstallResult>{
 const source=sourceFor(bundle);
 if(!fs.statSync(source).isFile())throw new Error('CLI 실행 파일을 찾을 수 없습니다.');
 const targets=cliInstallTargets().filter(target=>!options.user||isWindows||target.dir===path.join(os.homedir(),'.local','bin'));
 let lastError:unknown;
 for(const target of targets){
  const file=path.join(target.dir,target.file);
  try{
   fs.mkdirSync(target.dir,{recursive:true});
   if(!matches(file,bundle)){
    let existing:fs.Stats|undefined;
    try{existing=fs.lstatSync(file);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
    if(isWindows){
     if(existing&&(!existing.isFile()||!fs.readFileSync(file,'utf8').startsWith('@echo off\r\nrem Heisen CLI shim\r\n')))throw new Error(`기존 파일을 덮어쓸 수 없습니다: ${file}`);
     if(existing)fs.writeFileSync(file,shimFor(bundle));else fs.writeFileSync(file,shimFor(bundle),{flag:'wx'});
    }else{
     if(existing&&!existing.isSymbolicLink())throw new Error(`기존 파일을 덮어쓸 수 없습니다: ${file}`);
     if(existing)fs.unlinkSync(file);
     fs.symlinkSync(source,file);
    }
   }
   if(isWindows)await updateWindowsPath(target.dir,true);
   const onPath=(process.env.PATH||'').split(path.delimiter).some(dir=>path.resolve(dir||'.')===path.resolve(target.dir));
   return {path:file,pathHint:!isWindows&&!onPath};
  }catch(error){
   lastError=error;
   const code=(error as NodeJS.ErrnoException).code;
   if(code!=='EACCES'&&code!=='EPERM'&&code!=='EROFS')throw error;
  }
 }
 throw new Error(`CLI를 설치할 수 없습니다.${lastError instanceof Error?' '+lastError.message:''}`);
}
export async function uninstallCli(bundle:string):Promise<{removed:string[]}>{
 const removed:string[]=[];
 for(const target of cliInstallTargets()){
  const file=path.join(target.dir,target.file);
  if(!matches(file,bundle))continue;
  fs.unlinkSync(file);removed.push(file);
  if(isWindows)await updateWindowsPath(target.dir,false);
 }
 return {removed};
}
