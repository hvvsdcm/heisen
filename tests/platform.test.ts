import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {bundledCliPath,chromiumRoots,cliInstallTargets,controlSocketPath,dataRoot,defaultBrowserRegistry,dockerCandidates,helperCommand,helperPath,isMac,isWindows,markDownloaded,unprotectDpapi} from '../src/platform.ts';
import {stringArrayPlist} from '../src/browser-util.ts';

const exec=promisify(execFile);
test('controlSocketPath uses a profile-specific socket or Windows pipe',()=>{
 assert.equal(isMac,process.platform==='darwin');assert.equal(isWindows,process.platform==='win32');
 const profile=path.join(os.tmpdir(),'heisen-platform');
 const socket=controlSocketPath(profile);
 if(isWindows){
  const hash=createHash('sha256').update(path.win32.resolve(profile).toLowerCase()).digest('hex').slice(0,32);
  assert.equal(socket,'\\\\.\\pipe\\heisen-'+hash);
  assert.match(socket,/^\\\\\.\\pipe\\heisen-[a-f0-9]{32}$/);
 }else{
  assert.equal(socket,path.join(profile,'run','heisen.sock'));
  assert.notEqual(socket,controlSocketPath(path.join(profile,'other')));
 }
});
test('Windows control pipes distinguish profiles and normalize path spelling',()=>{
 const root='C:\\Users\\Alice\\Heisen';
 assert.notEqual(controlSocketPath(root,'win32'),controlSocketPath(root+'-dev','win32'));
 assert.equal(controlSocketPath(root,'win32'),controlSocketPath('c:/users/alice/HEISEN/.','win32'));
});
test('dataRoot honors profile overrides and platform resource paths follow the shared CLI contract',async()=>{
 assert.equal(dataRoot({HEISEN_DATA_DIR:'relative profile',APPDATA:'ignored'}),path.resolve('relative profile'));
 const roaming=path.join(os.tmpdir(),'roaming');
 assert.equal(dataRoot({APPDATA:roaming}),isWindows?path.join(roaming,'Heisen'):path.join(os.homedir(),'Library','Application Support','Heisen'));
 assert.equal(dataRoot({}),isWindows?path.join(os.homedir(),'AppData','Roaming','Heisen'):path.join(os.homedir(),'Library','Application Support','Heisen'));
 assert.equal(dataRoot(),dataRoot(process.env));
 const root=path.join(os.tmpdir(),'Heisen','Resources','app.asar'),dev=path.join(os.tmpdir(),'heisen-source');
 assert.equal(bundledCliPath(root,true),path.join(path.dirname(root),'cli','heisen.mjs'));
 assert.equal(bundledCliPath(dev,false),path.join(dev,'dist','cli.mjs'));
 const helper='heisen-computer'+(isWindows?'.ps1':'');
 assert.equal(helperPath('computer',root,true),path.join(path.dirname(root),'helpers',helper));
 assert.equal(helperPath('computer',dev,false),isWindows?path.join(dev,'helpers','computer','windows',helper):path.join(dev,'build','helpers',helper));
 for(const [appRoot,packaged] of [[root,true],[dev,false]] as const){
  const file=helperPath('computer',appRoot,packaged);
  assert.deepEqual(helperCommand('computer',appRoot,packaged),isWindows?{command:'powershell.exe',args:['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',file]}:{command:file,args:[]});
 }
 const roots=chromiumRoots();
 if(isWindows){
  assert.deepEqual(cliInstallTargets(),[{dir:path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'Heisen','bin'),file:'heisen.cmd'}]);
  assert.deepEqual(dockerCandidates(),[path.join(process.env.ProgramFiles||'C:\\Program Files','Docker','Docker','resources','bin','docker.exe')]);
  assert.equal(roots.base,process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'));
  assert.deepEqual(roots.dirs,{chrome:['Google/Chrome/User Data'],chromium:['Chromium/User Data'],brave:['BraveSoftware/Brave-Browser/User Data'],edge:['Microsoft/Edge/User Data'],vivaldi:['Vivaldi/User Data'],arc:[],dia:[],comet:[],aside:[],helium:[],opera:[]});
 }else{
  assert.deepEqual(cliInstallTargets(),[{dir:'/usr/local/bin',file:'heisen'},{dir:path.join(os.homedir(),'.local','bin'),file:'heisen'}]);
  assert.deepEqual(dockerCandidates(),['/opt/homebrew/bin/docker','/usr/local/bin/docker','/Applications/Docker.app/Contents/Resources/bin/docker']);
  assert.equal(roots.base,path.join(os.homedir(),'Library','Application Support'));
  assert.deepEqual(roots.dirs,{chrome:['Google/Chrome'],chromium:['Chromium'],brave:['BraveSoftware/Brave-Browser'],edge:['Microsoft Edge'],vivaldi:['Vivaldi'],arc:['Arc/User Data'],dia:['Dia/User Data'],comet:['Comet'],aside:['Aside/User Data','Aside'],helium:['net.imput.helium'],opera:['com.operasoftware.Opera']});
  await assert.rejects(unprotectDpapi(Buffer.alloc(0)),/DPAPI는 Windows에서만 사용할 수 있습니다\./);
 }
});
test('Windows helper launch and CLI shim use packaged scripts and development staging',async()=>{
 const script=`
  import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
  Object.defineProperty(process,'platform',{value:'win32'});
  // Test the module loading boundary: static imports would run before the platform override.
  const platform=await import(${JSON.stringify(new URL('../src/platform.ts',import.meta.url).href)});
  const {cliInstalled}=await import(${JSON.stringify(new URL('../src/cli/install.ts',import.meta.url).href)});
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'heisen-windows-contract-'));
  process.env.LOCALAPPDATA=root;
  try{
   for(const packaged of [true,false]){
    const appRoot=path.join(root,'Heisen % ! &',packaged?'Resources/app.asar':'source');
    const helper=packaged?path.join(path.dirname(appRoot),'helpers','heisen-computer.ps1'):path.join(appRoot,'helpers','computer','windows','heisen-computer.ps1');
    assert.equal(platform.helperPath('computer',appRoot,packaged),helper);
    assert.deepEqual(platform.helperCommand('computer',appRoot,packaged),{command:'powershell.exe',args:['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper]});
    const bundle=platform.bundledCliPath(appRoot,packaged);
    const launcher=packaged?path.join(path.dirname(bundle),'heisen.cmd'):path.join(appRoot,'build','cli','heisen.cmd');
    const target=platform.cliInstallTargets()[0],file=path.join(target.dir,target.file);
    await fs.mkdir(target.dir,{recursive:true});
    await fs.writeFile(file,'@echo off\\r\\nrem Heisen CLI shim\\r\\nsetlocal DisableDelayedExpansion\\r\\n"'+launcher.replace(/%/g,'%%')+'" %*\\r\\n');
    assert.equal(cliInstalled(bundle),true);
    await fs.writeFile(file,'@echo off\\r\\nrem Heisen CLI shim\\r\\nnode "'+bundle+'" %*\\r\\n');
    assert.equal(cliInstalled(bundle),false);
   }
  }finally{await fs.rm(root,{recursive:true,force:true});}
 `;
 await exec(process.execPath,['--import','tsx','--input-type=module','-e',script],{timeout:10000});
});
test('defaultBrowserRegistry registers per-user HTTP, HTTPS and HTML handlers with quoted commands',()=>{
 const exe='C:\\Program Files\\Heisen\\Heisen.exe',rows=defaultBrowserRegistry(exe);
 assert.equal(rows.length,12);
 assert.ok(rows.every(row=>row.key.startsWith('HKCU\\')&&row.type==='REG_SZ'));
 assert.deepEqual(rows.filter(row=>row.key.endsWith('\\URLAssociations')).map(({name,value})=>({name,value})),[{name:'http',value:'HeisenHTML'},{name:'https',value:'HeisenHTML'}]);
 assert.deepEqual(rows.filter(row=>row.key.endsWith('\\FileAssociations')).map(({name,value})=>({name,value})),[{name:'.htm',value:'HeisenHTML'},{name:'.html',value:'HeisenHTML'}]);
 assert.deepEqual(rows.find(row=>row.key==='HKCU\\Software\\RegisteredApplications'),{key:'HKCU\\Software\\RegisteredApplications',name:'Heisen',type:'REG_SZ',value:'Software\\Clients\\StartMenuInternet\\Heisen\\Capabilities'});
 const command=rows.find(row=>row.key==='HKCU\\Software\\Classes\\HeisenHTML\\shell\\open\\command');
 assert.equal(command?.name,'');assert.equal(command?.value,`"${exe}" "%1"`);
 assert.equal(defaultBrowserRegistry('C:\\x\\Heisen.exe').find(row=>row.key==='HKCU\\Software\\Classes\\HeisenHTML\\shell\\open\\command')?.value,'"C:\\x\\Heisen.exe" "%1"');
 assert.equal(rows.find(row=>row.key.endsWith('\\HeisenHTML\\DefaultIcon'))?.value,`"${exe}",0`);
 assert.equal(rows.find(row=>row.key==='HKCU\\Software\\Clients\\StartMenuInternet\\Heisen\\shell\\open\\command')?.value,`"${exe}"`);
});
test('markDownloaded writes macOS quarantine and source metadata or Windows Mark-of-the-Web',{skip:!isMac&&!isWindows},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'heisen-platform-'));
 try{
  const file=path.join(dir,'download.txt'),now=1700000000000,froms=['https://example.com/file','https://example.com/page'];
  await fs.writeFile(file,'download');
  await markDownloaded(file,froms,now);
  if(isMac){
   const {stdout}=await exec('/usr/bin/xattr',['-p','com.apple.quarantine',file]);
   assert.match(stdout.trim(),new RegExp(`^0083;${Math.floor(now/1000).toString(16)};Heisen;[A-F0-9-]{36}$`));
   const metadata=await exec('/usr/bin/xattr',['-p','-x','com.apple.metadata:kMDItemWhereFroms',file]);
   assert.deepEqual(Buffer.from(metadata.stdout.replace(/\s/g,''),'hex'),stringArrayPlist(froms));
  }else{
   assert.equal(await fs.readFile(file+':Zone.Identifier','utf8'),'[ZoneTransfer]\r\nZoneId=3\r\nReferrerUrl=https://example.com/page\r\nHostUrl=https://example.com/file\r\n');
   await markDownloaded(file,[],now);
   assert.equal(await fs.readFile(file+':Zone.Identifier','utf8'),'[ZoneTransfer]\r\nZoneId=3\r\n');
  }
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
