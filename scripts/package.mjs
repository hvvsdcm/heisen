import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const project=process.cwd();const scratch=path.resolve(project,'../../work/heisen/package');
// Windows installers are built on Windows (or with Wine and Mono on macOS/Linux).
const platform=process.env.HEISEN_PLATFORM??(process.platform==='win32'?'win32':'darwin');
// HEISEN_UNFUSED=1 builds release-test/ with stock fuses so Playwright can use --inspect and remote debugging.
const unfused=process.env.HEISEN_UNFUSED==='1';const entitlements=path.join(project,'assets/entitlements.plist');
const stage=path.join(scratch,'app');
const output=path.join(project,unfused?'release-test':'release');
// --dry-run prints the signing/notarization plan only: no staging, keychain access or uploads.
const dryRun=process.argv.includes('--dry-run');
const developerIdentity=process.env.HEISEN_SIGN_IDENTITY?.trim();
const notaryProfile=process.env.HEISEN_NOTARY_PROFILE?.trim();
// Local/ad-hoc signatures have no Apple Team ID: dyld needs this exception to load Electron.
// Developer ID uses the least-privilege checked-in plist and same-team library validation.
const signingEntitlements=developerIdentity?entitlements:path.join(scratch,'local-entitlements.plist');
const windowsSign=process.env.HEISEN_WIN_SIGN?.trim();
if(platform==='darwin'&&notaryProfile&&!developerIdentity)throw new Error('HEISEN_NOTARY_PROFILE requires HEISEN_SIGN_IDENTITY (Developer ID Application).');
if(platform==='darwin'&&developerIdentity&&!developerIdentity.startsWith('Developer ID Application: '))throw new Error('HEISEN_SIGN_IDENTITY must name a Developer ID Application certificate.');
// HEISEN_WIN_SIGN contains signtool parameters only, not "signtool sign".
if(platform==='win32'&&windowsSign&&!windowsSign.startsWith('/'))throw new Error('HEISEN_WIN_SIGN must contain signtool parameters, starting with / (not signtool sign).');
// Both Windows signing dependencies debug-log raw parameters, which can include /p.
// Disable their debug output before importing them; never surface their raw errors.
if(platform==='win32'&&windowsSign)delete process.env.DEBUG;
const redact=text=>[developerIdentity,notaryProfile,windowsSign].filter(Boolean).reduce((s,value)=>s.replaceAll(value,'[REDACTED]'),String(text));
function signingCommand(command,args){
 if(dryRun){console.log([command,...args].map(arg=>JSON.stringify(redact(arg))).join(' '));return '';}
 try{return execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024});}
 catch(error){throw new Error(`${path.basename(command)} failed (${error.status??error.code}): ${redact(error.stderr??'')}`);}
}
// A stable local identity preserves Safe Storage keychain approvals across rebuilds.
// Explicit Developer ID never falls back to local/ad-hoc when signing fails.
const signingKeychain=path.join(os.homedir(),'Library/Keychains/heisen-signing.keychain-db');
let identity=developerIdentity||'-',keychainArgs=[];
if(platform==='darwin'&&!developerIdentity&&!dryRun){
 try{
  const pw=(await fs.readFile(path.join(os.homedir(),'.heisen-signing/keychain-password'),'utf8')).trim();
  execFileSync('/usr/bin/security',['unlock-keychain','-p',pw,signingKeychain],{stdio:'pipe'});
  identity=execFileSync('/usr/bin/security',['find-certificate','-c','Heisen Local Signing','-Z',signingKeychain],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).match(/SHA-1 hash: ([0-9A-F]{40})/)[1];
  keychainArgs=['--keychain',signingKeychain];
 }catch{console.warn('Heisen Local Signing identity not found; signing ad-hoc. The keychain will ask again after every rebuild.');}
}
const sign=(target,runtime=true)=>signingCommand('/usr/bin/codesign',['--force','--sign',identity,...keychainArgs,...(runtime?['--options','runtime','--entitlements',signingEntitlements]:[]),developerIdentity?'--timestamp':'--timestamp=none',target]);
function notarize(dmg,bundle){
 if(!notaryProfile)return;
 const response=signingCommand('/usr/bin/xcrun',['notarytool','submit',dmg,'--keychain-profile',notaryProfile,'--wait','--output-format','json']);
 if(!dryRun){
  const result=JSON.parse(response);
  if(result.status!=='Accepted'){
   if(result.id)console.error(redact(signingCommand('/usr/bin/xcrun',['notarytool','log',result.id,'--keychain-profile',notaryProfile])));
   throw new Error(`Notarization was not accepted (${redact(result.status)}).`);
  }
 }
 signingCommand('/usr/bin/xcrun',['stapler','staple',dmg]);
 signingCommand('/usr/bin/xcrun',['stapler','staple',bundle]);
 signingCommand('/usr/sbin/spctl',['-a','-vv','-t','install',bundle]);
}
if(dryRun){
 const {version}=JSON.parse(await fs.readFile('package.json','utf8'));
 for(const arch of platform==='win32'?['x64','arm64']:['arm64','x64']){
  if(platform==='win32'){
   console.log(windowsSign?`packager.windowsSign: ${JSON.stringify({signWithParams:'[REDACTED]',hashes:['sha256']})}`:'Windows signing disabled (HEISEN_WIN_SIGN unset).');
   console.log(windowsSign?'createWindowsInstaller.signWithParams: [REDACTED]':'Windows installer signing disabled.');
   continue;
  }
  const bundle=path.join(output,`Heisen-darwin-${arch}`,'Heisen.app'),dmg=path.join(output,`Heisen-${version}-mac-${arch}.dmg`);
  console.log('Inside-out signing: all loose Mach-O files, nested bundles deepest first, then the app (representative paths below).');
  for(const target of ['Contents/Resources/helpers/heisen-computer','Contents/Frameworks/Electron Framework.framework/Libraries/libEGL.dylib','Contents/Frameworks/Heisen Helper (Renderer).app','Contents/Frameworks/Electron Framework.framework',''])sign(path.join(bundle,target));
  signingCommand('/usr/bin/codesign',['--verify','--deep','--strict',bundle]);
  if(developerIdentity)sign(dmg,false);
  notarize(dmg,bundle);
  console.log('SHA256SUMS.txt is written after stapling.');
 }
 process.exit(0);
}
const {packager}=await import('@electron/packager');
const {flipFuses,FuseVersion,FuseV1Options}=await import('@electron/fuses');
// Keep the system-Node CLI and native helpers outside ASAR at platform.ts's resource paths.
await fs.rm('build/cli',{recursive:true,force:true});await fs.mkdir('build/cli',{recursive:true,mode:0o755});
await fs.copyFile('dist/cli.mjs','build/cli/heisen.mjs');
for(const file of ['heisen','heisen.cmd'])await fs.copyFile(path.join('helpers/cli',file),path.join('build/cli',file));
await fs.mkdir('build/helpers',{recursive:true,mode:0o755});
if(platform==='win32')await fs.copyFile('helpers/computer/windows/heisen-computer.ps1','build/helpers/heisen-computer.ps1');
for(const dir of ['build/cli','build/helpers'])await fs.chmod(dir,0o755);
for(const file of ['heisen','heisen.mjs','heisen.cmd'])await fs.chmod(path.join('build/cli',file),file==='heisen.cmd'?0o644:0o755);
await fs.chmod(path.join('build/helpers',platform==='win32'?'heisen-computer.ps1':'heisen-computer'),platform==='win32'?0o644:0o755);
await fs.rm(scratch,{recursive:true,force:true});await fs.mkdir(stage,{recursive:true});
if(platform==='darwin'&&!developerIdentity){
 await fs.copyFile(entitlements,signingEntitlements);
 execFileSync('/usr/libexec/PlistBuddy',['-c','Add :com.apple.security.cs.disable-library-validation bool true',signingEntitlements],{stdio:'pipe'});
}
const metadata=JSON.parse(await fs.readFile('package.json','utf8'));
await fs.writeFile(path.join(stage,'package.json'),JSON.stringify({name:metadata.name,productName:'Heisen',version:metadata.version,type:'module',main:'dist/main.mjs',...(unfused?{heisenTestBuild:true}:{})}));
await fs.cp('dist',path.join(stage,'dist'),{recursive:true,filter:p=>!p.endsWith('.map')&&!p.endsWith('build-inputs.json')});
await fs.copyFile('runtime-images.json',path.join(stage,'runtime-images.json'));
const fuseOptions={version:FuseVersion.V1,resetAdHocDarwinSignature:false,[FuseV1Options.RunAsNode]:false,[FuseV1Options.EnableNodeOptionsEnvironmentVariable]:false,[FuseV1Options.EnableNodeCliInspectArguments]:false,[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]:true,[FuseV1Options.OnlyLoadAppFromAsar]:true,[FuseV1Options.EnableCookieEncryption]:true};
const apps=await packager({dir:stage,out:output,name:'Heisen',appBundleId:'com.heisen.browser',appVersion:metadata.version,overwrite:true,platform,arch:platform==='win32'?['x64','arm64']:['arm64','x64'],electronVersion:'45.2.3',icon:path.join(project,platform==='win32'?'assets/heisen.ico':'assets/heisen.icns'),prune:false,asar:true,extraResource:['build/cli','build/helpers'],...platform==='win32'?{
 win32metadata:{CompanyName:'Heisen',FileDescription:'Heisen',ProductName:'Heisen',OriginalFilename:'Heisen.exe',InternalName:'Heisen'},
 // Flip before packager signs the executable; changing it afterwards invalidates Authenticode.
 afterExtract:unfused?[]:[async({buildPath})=>{await flipFuses(path.join(buildPath,'electron.exe'),fuseOptions);}],
 ...(windowsSign?{windowsSign:{signWithParams:windowsSign,hashes:['sha256']}}:{})
}:{protocols:[{name:'Web URL',schemes:['http','https']}],extendInfo:{NSLocationUsageDescription:'사이트 권한을 요청할 때 사용합니다.',NSLocationWhenInUseUsageDescription:'사이트 권한을 요청할 때 사용합니다.'},usageDescription:{Camera:'사이트 권한을 요청할 때 사용합니다.',Microphone:'사이트 권한을 요청할 때 사용합니다.'}}}).catch(error=>{
 if(platform==='win32'&&windowsSign)throw new Error('Windows packaging/signing failed; check HEISEN_WIN_SIGN and certificate availability. Signing diagnostics are suppressed to protect credentials.');
 throw error;
});
const keepLocale=/^(?:Base|en|ko)(?:_(?:FEMININE|MASCULINE|NEUTER))?\.lproj$/;
async function walk(dir,visit){for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(await visit(p,e)!==false&&e.isDirectory())await walk(p,visit);}}
async function isMachO(p){const h=await fs.open(p);try{const b=Buffer.alloc(4);await h.read(b,0,4,0);return [0xfeedfacf,0xcffaedfe,0xcafebabe,0xbebafeca].includes(b.readUInt32BE(0));}finally{await h.close();}}
const checksums=[];
const createWindowsInstaller=platform==='win32'?(await import('electron-winstaller')).createWindowsInstaller:null;
for(const p of apps){
 // Keep readable notices outside ASAR and inside the app/installer, before signing.
 const resources=platform==='darwin'?path.join(p,'Heisen.app','Contents','Resources'):path.join(p,'resources');
 await fs.copyFile(path.join(project,'THIRD_PARTY_NOTICES.md'),path.join(resources,'THIRD_PARTY_NOTICES.txt'));
 for(const file of ['LICENSE','LICENSES.chromium.html'])await fs.copyFile(path.join(p,file),path.join(resources,file));
 if(platform==='win32'){
  // Chromium ships ~55 UI locales; Heisen is English/Korean only.
  const locales=path.join(p,'locales');for(const name of await fs.readdir(locales)){if(name.endsWith('.pak')&&name!=='en-US.pak'&&name!=='ko.pak')await fs.rm(path.join(locales,name));}
  const arch=path.basename(p).slice('Heisen-win32-'.length),filename=`Heisen-${metadata.version}-win-${arch}-Setup.exe`,installerDir=path.join(output,'installer-'+arch);
  await createWindowsInstaller({appDirectory:p,outputDirectory:installerDir,authors:'Heisen',exe:'Heisen.exe',title:'Heisen',name:'Heisen',description:'Heisen',setupExe:filename,setupIcon:path.join(project,'assets/heisen.ico'),iconUrl:'https://heisen.dev/brand/heisen.ico',noMsi:true,noDelta:true,...(windowsSign?{signWithParams:windowsSign}:{})}).catch(error=>{
   if(windowsSign)throw new Error('Windows installer signing failed; check HEISEN_WIN_SIGN and certificate availability. Signing diagnostics are suppressed to protect credentials.');
   throw error;
  });
  const installer=path.join(output,filename);await fs.rename(path.join(installerDir,filename),installer);
  const hash=createHash('sha256');for await(const chunk of createReadStream(installer))hash.update(chunk);
  const checksum=`${hash.digest('hex')}  ${filename}`;checksums.push(checksum);console.log(checksum);
  continue;
 }
 const bundle=path.join(p,'Heisen.app');
 // Chromium ships ~55 UI locales; Heisen is English/Korean only.
 await walk(bundle,async(f,e)=>{if(e.isDirectory()&&f.endsWith('.lproj')){if(!keepLocale.test(e.name))await fs.rm(f,{recursive:true});return false;}});
 if(!unfused)await flipFuses(bundle,fuseOptions);
 // Inside-out: loose Mach-O files (including Resources/helpers/heisen-computer), then nested bundles deepest first, then the app. Bundle main executables are signed with their bundle.
 const loose=[],bundles=[];
 await walk(path.join(bundle,'Contents'),async(f,e)=>{if(e.isDirectory()){if(/\.(?:app|framework)$/.test(e.name))bundles.push(f);return;}
  if(!e.isFile()||/\/Contents\/MacOS\/[^/]+$/.test(f)||/\/([^/]+)\.framework\/Versions\/[^/]+\/\1$/.test(f))return;if(await isMachO(f))loose.push(f);});
 const depth=f=>f.split(path.sep).length;
 for(const f of [...loose.sort((a,b)=>depth(b)-depth(a)),...bundles.sort((a,b)=>depth(b)-depth(a)),bundle])sign(f);
 execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',bundle],{stdio:'inherit'});console.log(bundle);
 const arch=path.basename(p).slice('Heisen-darwin-'.length);
 const filename=`Heisen-${metadata.version}-mac-${arch}.dmg`,dmg=path.join(output,filename),dmgStage=path.join(scratch,`dmg-${arch}`);
 await fs.mkdir(dmgStage,{recursive:true});
 try{
  execFileSync('/usr/bin/ditto',[bundle,path.join(dmgStage,'Heisen.app')]);
  await fs.symlink('/Applications',path.join(dmgStage,'Applications'));
  execFileSync('/usr/bin/hdiutil',['create','-volname','Heisen','-srcfolder',dmgStage,'-ov','-format','UDZO',dmg],{stdio:'inherit'});
 }finally{await fs.rm(dmgStage,{recursive:true,force:true});}
 if(developerIdentity)sign(dmg,false);
 notarize(dmg,bundle);
 const hash=createHash('sha256');for await(const chunk of createReadStream(dmg))hash.update(chunk);
 const checksum=`${hash.digest('hex')}  ${filename}`;checksums.push(checksum);console.log(checksum);
}
await fs.writeFile(path.join(output,'SHA256SUMS.txt'),`${checksums.join('\n')}\n`);
