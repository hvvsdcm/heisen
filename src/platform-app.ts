import {app,nativeImage,shell} from 'electron';
import path from 'node:path';
import {execFile,execFileSync,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {defaultBrowserRegistry,isMac,isWindows} from './platform.ts';

const exec=promisify(execFile);
// Local HTML navigation is intentionally unsupported; advertise web protocols only.
const registry=defaultBrowserRegistry(process.execPath).filter(row=>!row.key.endsWith('\\FileAssociations'));
export function windowChrome():Partial<Electron.BrowserWindowConstructorOptions>{
 return isMac?{titleBarStyle:'hiddenInset',trafficLightPosition:{x:18,y:13}}:isWindows?{titleBarStyle:'hidden',titleBarOverlay:{color:'#272727',symbolColor:'#e6e6e6',height:40}}:{};
}
export function squirrelStartup():boolean{
 if(!isWindows)return false;
 const event=process.argv[1];if(!['--squirrel-install','--squirrel-updated','--squirrel-uninstall','--squirrel-obsolete'].includes(event))return false;
 if(event==='--squirrel-obsolete')return true;
 try{
  if(event==='--squirrel-uninstall'){
   for(const args of [['delete','HKCU\\Software\\RegisteredApplications','/v','Heisen','/f'],...['HKCU\\Software\\Clients\\StartMenuInternet\\Heisen','HKCU\\Software\\Classes\\HeisenHTML'].map(key=>['delete',key,'/f'])]){
    try{execFileSync('reg.exe',args,{stdio:'pipe',timeout:10000,windowsHide:true});}catch(error){console.error('Browser registration removal failed',error);}
   }
  }else for(const row of registry)execFileSync('reg.exe',['add',row.key,...(row.name?['/v',row.name]:['/ve']),'/t',row.type,'/d',row.value,'/f'],{stdio:'pipe',timeout:10000,windowsHide:true});
  const child=spawn(path.resolve(path.dirname(process.execPath),'..','Update.exe'),[event==='--squirrel-uninstall'?'--removeShortcut':'--createShortcut',path.basename(process.execPath)],{detached:true,stdio:'ignore',windowsHide:true});
  child.on('error',error=>console.error('Shortcut update failed',error));child.unref();
 }catch(error){console.error('Browser installation failed',error);}
 return true;
}
export async function registerDefaultBrowser():Promise<'done'|'settings-opened'|'unsupported'>{
 if(!app.isPackaged)return 'unsupported';
 if(isMac){const http=app.setAsDefaultProtocolClient('http'),https=app.setAsDefaultProtocolClient('https');return http&&https?'done':'unsupported';}
 if(isWindows){for(const row of registry)await exec('reg.exe',['add',row.key,...(row.name?['/v',row.name]:['/ve']),'/t',row.type,'/d',row.value,'/f'],{timeout:10000,windowsHide:true});await shell.openExternal('ms-settings:defaultapps');return 'settings-opened';}
 return 'unsupported';
}
export async function isDefaultBrowser():Promise<boolean>{
 if(!app.isPackaged)return false;
 if(isMac)return app.isDefaultProtocolClient('http')&&app.isDefaultProtocolClient('https');
 if(isWindows){
  for(const scheme of ['http','https']){
   try{const {stdout}=await exec('reg.exe',['query',`HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\${scheme}\\UserChoice`,'/v','ProgId'],{timeout:10000,windowsHide:true});if(!/^\s*ProgId\s+REG_SZ\s+HeisenHTML\s*$/im.test(stdout))return false;}catch{return false;}
  }
  return true;
 }
 return false;
}
export function trayImage():Electron.NativeImage{
 const image=nativeImage.createFromPath(path.join(app.getAppPath(),'dist','brand','mark.png')).resize({width:18,height:18});image.setTemplateImage(false);return image;
}
