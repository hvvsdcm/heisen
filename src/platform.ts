import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {quarantineValue,stringArrayPlist} from './browser-util.ts';

const exec=promisify(execFile);
export const isWindows=process.platform==='win32',isMac=process.platform==='darwin';
export type ChromiumBrowserId='chrome'|'chromium'|'brave'|'edge'|'vivaldi'|'arc'|'dia'|'comet'|'aside'|'helium'|'opera';

export function dataRoot(env:NodeJS.ProcessEnv=process.env):string{
 if(env.HEISEN_DATA_DIR)return path.resolve(env.HEISEN_DATA_DIR);
 return isWindows?path.join(env.APPDATA||path.join(os.homedir(),'AppData','Roaming'),'Heisen'):path.join(os.homedir(),'Library','Application Support','Heisen');
}
export function controlSocketPath(profileRoot:string,platform:NodeJS.Platform=process.platform):string{
 return platform==='win32'?'\\\\.\\pipe\\heisen-'+createHash('sha256').update(path.win32.resolve(profileRoot).toLowerCase()).digest('hex').slice(0,32):path.join(profileRoot,'run','heisen.sock');
}
export function cliInstallTargets():{dir:string;file:string}[]{
 return isWindows?[{dir:path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'Heisen','bin'),file:'heisen.cmd'}]:[{dir:'/usr/local/bin',file:'heisen'},{dir:path.join(os.homedir(),'.local','bin'),file:'heisen'}];
}
export function bundledCliPath(appRoot:string,packaged:boolean):string{
 return packaged?path.join(path.dirname(appRoot),'cli','heisen.mjs'):path.join(appRoot,'dist','cli.mjs');
}
export function helperPath(name:'computer',appRoot:string,packaged:boolean):string{
 const file=`heisen-${name}${isWindows?'.ps1':''}`;
 return packaged?path.join(path.dirname(appRoot),'helpers',file):isWindows?path.join(appRoot,'helpers','computer','windows',file):path.join(appRoot,'build','helpers',file);
}
export function helperCommand(name:'computer',appRoot:string,packaged:boolean):{command:string;args:string[]}{
 const file=helperPath(name,appRoot,packaged);
 return isWindows?{command:'powershell.exe',args:['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file]}:{command:file,args:[]};
}
export function dockerCandidates():string[]{
 return isWindows?[path.join(process.env.ProgramFiles||'C:\\Program Files','Docker','Docker','resources','bin','docker.exe')]:['/opt/homebrew/bin/docker','/usr/local/bin/docker','/Applications/Docker.app/Contents/Resources/bin/docker'];
}
export function chromiumRoots():{base:string;dirs:Record<ChromiumBrowserId,string[]>}{
 if(isWindows)return {base:process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),dirs:{chrome:['Google/Chrome/User Data'],chromium:['Chromium/User Data'],brave:['BraveSoftware/Brave-Browser/User Data'],edge:['Microsoft/Edge/User Data'],vivaldi:['Vivaldi/User Data'],arc:[],dia:[],comet:[],aside:[],helium:[],opera:[]}};
 return {base:path.join(os.homedir(),'Library','Application Support'),dirs:{chrome:['Google/Chrome'],chromium:['Chromium'],brave:['BraveSoftware/Brave-Browser'],edge:['Microsoft Edge'],vivaldi:['Vivaldi'],arc:['Arc/User Data'],dia:['Dia/User Data'],comet:['Comet'],aside:['Aside/User Data','Aside'],helium:['net.imput.helium'],opera:['com.operasoftware.Opera']}};
}
export async function unprotectDpapi(blob:Buffer):Promise<Buffer>{
 if(!isWindows)throw new Error('DPAPI는 Windows에서만 사용할 수 있습니다.');
 const {stdout}=await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Add-Type -AssemblyName System.Security; [Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String('${blob.toString('base64')}'),$null,'CurrentUser'))`],{timeout:30000,encoding:'utf8'});
 return Buffer.from(stdout.trim(),'base64');
}
export async function markDownloaded(file:string,froms:string[],now=Date.now()):Promise<void>{
 if(isMac){
  const attrs=[['-w','com.apple.quarantine',quarantineValue(now,randomUUID())],...froms.length?[['-w','-x','com.apple.metadata:kMDItemWhereFroms',stringArrayPlist(froms).toString('hex')]]:[]];
  await Promise.all(attrs.map(args=>exec('/usr/bin/xattr',[...args,file]).catch(e=>console.error('Download attribute failed',(e as Error).message))));
 }else if(isWindows){
  await fs.writeFile(file+':Zone.Identifier',`[ZoneTransfer]\r\nZoneId=3\r\n${froms[1]?`ReferrerUrl=${froms[1]}\r\n`:''}${froms[0]?`HostUrl=${froms[0]}\r\n`:''}`).catch(e=>console.error('Download attribute failed',(e as Error).message));
 }
}
export function killTree(pid:number,signal:NodeJS.Signals='SIGTERM'):void{
 if(isWindows)execFile('taskkill',['/PID',String(pid),'/T','/F'],{windowsHide:true},error=>{if(error)console.error('Process termination failed',error.message);});
 else process.kill(-pid,signal);
}
export function defaultBrowserRegistry(exe:string):{key:string;name:string;type:'REG_SZ'|'REG_DWORD';value:string}[]{
 const client='Software\\Clients\\StartMenuInternet\\Heisen',capabilities=client+'\\Capabilities',progId='Software\\Classes\\HeisenHTML';
 const values:[string,string,string][]=[
  ['Software\\RegisteredApplications','Heisen',capabilities],
  [client,'','Heisen'],
  [capabilities,'ApplicationName','Heisen'],
  [capabilities,'ApplicationDescription','Heisen'],
  [capabilities+'\\URLAssociations','http','HeisenHTML'],
  [capabilities+'\\URLAssociations','https','HeisenHTML'],
  [capabilities+'\\FileAssociations','.htm','HeisenHTML'],
  [capabilities+'\\FileAssociations','.html','HeisenHTML'],
  [client+'\\shell\\open\\command','',`"${exe}"`],
  [progId,'','Heisen HTML Document'],
  [progId+'\\DefaultIcon','',`"${exe}",0`],
  [progId+'\\shell\\open\\command','',`"${exe}" "%1"`],
 ];
 return values.map(([key,name,value])=>({key:'HKCU\\'+key,name,type:'REG_SZ',value}));
}
