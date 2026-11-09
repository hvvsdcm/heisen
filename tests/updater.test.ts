import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {canonical,verifyManifest,newer,currentTarget,Updater} from '../src/updater.ts';
import type {Latest,Target} from '../src/updater.ts';
import {RELEASE_PUBLIC_KEY} from '../src/release-key.ts';

const keys=generateKeyPairSync('ed25519'),publicKey=(keys.publicKey.export({type:'spki',format:'der'}) as Buffer).subarray(-32).toString('base64');
const payload=Buffer.from('signed release fixture'),digest=createHash('sha256').update(payload).digest('hex');
const expiresAt=new Date(Date.now()+14*24*60*60*1000).toISOString();
function manifest(version='0.5.0',target:Target='mac-arm64'):Omit<Latest,'sig'>{
 return {version,publishedAt:'2026-11-07T00:00:00.000Z',expiresAt,files:{[target]:{name:`Heisen-${version}-${target}${target.startsWith('mac-')?'.dmg':'-Setup.exe'}`,bytes:payload.length,sha256:digest}},windows:{status:target.startsWith('win-')?'available':'planned'}};
}
function signed(value:object):string{return JSON.stringify({...value,sig:sign(null,Buffer.from(canonical(value)),keys.privateKey).toString('base64')});}
type HarnessOptions=Partial<ConstructorParameters<typeof Updater>[0]>;
async function harness(t:test.TestContext,options:HarnessOptions={},latest=manifest(),body:Uint8Array=payload){
 const root=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'heisen-updater-'))),requests:{url:string;options?:RequestInit}[]=[];
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const deps:ConstructorParameters<typeof Updater>[0]={version:'0.4.0',target:'mac-arm64',dir:path.join(root,'updates'),baseURL:'https://heisen.dev',publicKey,packaged:true,execPath:path.join(root,'Heisen.app','Contents','MacOS','Heisen'),changed:()=>{},fetchImpl:async(input,options)=>{const url=String(input);requests.push({url,options});return new Response(url.endsWith('latest.json')?signed(latest):body as BodyInit,{headers:url.endsWith('latest.json')?{etag:'"release"'}:{}});},...options};
 const updater=new Updater(deps);t.after(()=>updater.stop());return {root,deps,updater,requests};
}

test('canonical preserves server JSON semantics and the cross-repository vector',async t=>{
 const vector={z:[{b:2,a:'한글'},undefined,null],a:{z:undefined,b:true,a:'line\nquote"'},numbers:{'10':10,'2':2,'01':1}};
 const expected='{"a":{"a":"line\\nquote\\\"","b":true},"numbers":{"2":2,"10":10,"01":1},"z":[{"a":"한글","b":2},null,null]}';
 assert.equal(canonical(vector),expected);
 // The publisher path is runtime-selected so CI can supply a separately checked-out heisen-web.
 const publisher=path.join(process.env.HEISEN_WEB_ROOT??fileURLToPath(new URL('../../heisen-web/',import.meta.url)),'scripts','publish-release.mjs');
 try{await fs.access(publisher);}catch{t.diagnostic('Sibling publisher absent; the pinned canonical vector still runs.');return;}
 const server=await import(pathToFileURL(publisher).href);
 assert.equal(server.canonical(vector),expected);assert.equal(server.canonical(manifest()),canonical(manifest()));
 const published=server.signManifest(manifest(),keys.privateKey);
 assert.deepEqual(verifyManifest(JSON.stringify(published),publicKey),published);
});

test('release key is the supplied raw Ed25519 key; valid signatures verify',()=>{
 assert.equal(RELEASE_PUBLIC_KEY,'deecOtoAHXes+zaHSBNXNMAb0XK0D/uE3o1q2TIh7xw=');
 const text=signed(manifest());assert.equal(verifyManifest(text,publicKey).version,'0.5.0');
 assert.equal(Buffer.from(RELEASE_PUBLIC_KEY,'base64').length,32);
});
test('invalid, missing, tampered and malformed signatures fail closed',()=>{
 const text=signed(manifest());
 for(const bad of [text.replace('0.5.0','9.5.0'),JSON.stringify(manifest()),'{',JSON.stringify({...manifest(),sig:'!'.repeat(88)}),JSON.stringify({...JSON.parse(text),sig:Buffer.alloc(64).toString('base64')})])assert.throws(()=>verifyManifest(bad,publicKey),/서명/);
 assert.throws(()=>verifyManifest(text,RELEASE_PUBLIC_KEY),/서명/);assert.throws(()=>verifyManifest(text,publicKey+'\n'),/서명/);
});
test('signed manifests require a valid ISO expiry and allow only five minutes of clock skew',t=>{
 const now=Date.parse('2026-11-07T12:00:00.000Z');t.mock.timers.enable({apis:['Date'],now});
 const latest=manifest(),{expiresAt:_,...missing}=latest;
 for(const value of [missing,...[null,42,'','tomorrow','2026-11-08','2026-02-30T12:00:00.000Z'].map(expiresAt=>({...latest,expiresAt}))])assert.throws(()=>verifyManifest(signed(value),publicKey),/만료 시간/);
 for(const offset of [1,0,-5*60*1000])assert.equal(verifyManifest(signed({...latest,expiresAt:new Date(now+offset).toISOString()}),publicKey).version,latest.version);
 assert.equal(verifyManifest(signed({...latest,expiresAt:'2026-11-07T12:00:00Z'}),publicKey).version,latest.version);
 assert.throws(()=>verifyManifest(signed({...latest,expiresAt:new Date(now-5*60*1000-1).toISOString()}),publicKey),/만료되었/);
 const text=JSON.parse(signed(latest));text.expiresAt='2099-01-01T00:00:00.000Z';
 assert.throws(()=>verifyManifest(JSON.stringify(text),publicKey),/서명/);
});
test('signed but unsafe metadata is rejected before any filesystem operation',()=>{
 for(const patch of [{name:'../Heisen.app'},{name:'%2fetc%2fpasswd'},{bytes:-1},{bytes:1.5},{bytes:Number.MAX_SAFE_INTEGER+1},{sha256:'x'.repeat(64)}]){
  const latest=manifest();Object.assign(latest.files['mac-arm64']!,patch);assert.throws(()=>verifyManifest(signed(latest),publicKey),/파일/);
 }
 assert.throws(()=>verifyManifest(signed({...manifest(),version:'1.0.0-beta'}),publicKey),/버전/);
 assert.throws(()=>verifyManifest(signed({...manifest(),minMacOS:'13; echo bad'}),publicKey),/macOS/);
});
test('version comparison is numeric and rejects ambiguous versions',()=>{
 assert.equal(newer('1.10.0','1.9.9'),true);assert.equal(newer('2.0.0','1.99.99'),true);
 assert.equal(newer('0.5.0','0.5.0'),false);assert.equal(newer('0.4.9','0.5.0'),false);
 for(const value of ['01.2.3','1.2','1.2.3.4','1.2.3-beta','1.2.NaN','999999999999999999.0.0'])assert.throws(()=>newer(value,'0.4.0'));
 if(['darwin','win32'].includes(process.platform))assert.match(currentTarget(),/^(mac|win)-(arm64|x64)$/);
});
test('check announces availability but never downloads or installs without a click',async t=>{
 let quit=0;const h=await harness(t,{app:{quit:()=>{quit++;},relaunch:()=>{quit++;}}});
 await h.updater.check();assert.equal(h.updater.state().status,'available');assert.equal(h.requests.length,1);
 await h.updater.install();assert.equal(quit,0);assert.equal(h.requests.length,1);
 assert.equal(h.requests[0].options?.redirect,'error');assert.equal(h.requests[0].options?.credentials,'omit');
 const copy=h.updater.state();copy.status='ready';assert.equal(h.updater.state().status,'available');
});
test('same version, absent target and disabled builds have appropriate states',async t=>{
 for(const [options,latest,expected] of [[{version:'0.5.0'},manifest(),'upToDate'],[{},manifest('0.5.0','win-x64'),'upToDate'],[{packaged:false},manifest(),'disabled'],[{publicKey:''},manifest(),'disabled']] as const){
  const h=await harness(t,options,latest);await h.updater.check();await h.updater.download();await h.updater.install();assert.equal(h.updater.state().status,expected);assert.equal(h.requests.length,expected==='disabled'?0:1);
 }
});
test('downgrade and replay below the highest verified version are refused',async t=>{
 const h=await harness(t,{},manifest('0.3.0'));await h.updater.check();assert.equal(h.updater.state().status,'error');assert.match(h.updater.state().error!,/이전 버전/);
 let version='0.6.0';const replay=await harness(t,{fetchImpl:async()=>new Response(signed(manifest(version)))});
 await replay.updater.check();assert.equal(replay.updater.state().version,'0.6.0');version='0.5.0';await replay.updater.check();assert.match(replay.updater.state().error!,/이전 버전/);
});
test('minimum macOS version is enforced',async t=>{
 const h=await harness(t,{run:async()=> '12.7.6'},{...manifest(),minMacOS:'13'});await h.updater.check();assert.equal(h.updater.state().status,'error');assert.match(h.updater.state().error!,/macOS 13/);
 const supported=await harness(t,{run:async()=> '13.0'},{...manifest(),minMacOS:'13'});await supported.updater.check();assert.equal(supported.updater.state().status,'available');
});
test('ETags only reuse verified manifests and force bypasses conditional requests',async t=>{
 let calls=0;const headers:Headers[]=[];
 const h=await harness(t,{fetchImpl:async(_input,options)=>{headers.push(new Headers(options?.headers));return ++calls===1?new Response(signed(manifest()),{headers:{etag:'"signed"'}}):new Response(null,{status:304});}});
 await h.updater.check();await h.updater.check();assert.equal(h.updater.state().status,'available');assert.equal(headers[1].get('if-none-match'),'"signed"');
 await h.updater.check(true);assert.equal(headers[2].has('if-none-match'),false);
 const empty=await harness(t,{fetchImpl:async()=>new Response(null,{status:304})});await empty.updater.check();assert.equal(empty.updater.state().status,'error');
});
test('cached 304 manifests, downloads and installs recheck expiry after waiting',async t=>{
 const now=Date.parse('2026-11-07T12:00:00.000Z');t.mock.timers.enable({apis:['Date'],now});
 for(const stage of ['check','download','install'] as const){
  t.mock.timers.setTime(now);
  const latest={...manifest(),expiresAt:new Date(now).toISOString()};let calls=0,commands=0;
  const h=await harness(t,{run:async()=>{commands++;return '';},app:{quit:()=>assert.fail('quit'),relaunch:()=>assert.fail('relaunch')},fetchImpl:async input=>{
   calls++;return String(input).endsWith('.json')?(calls===1?new Response(signed(latest),{headers:{etag:'"expiry"'}}):new Response(null,{status:304})):new Response(payload);
  }},latest);
  await h.updater.check();assert.equal(h.updater.state().status,'available');
  if(stage==='install'){await h.updater.download();assert.equal(h.updater.state().status,'ready');}
  const before=calls;t.mock.timers.setTime(now+5*60*1000+1);await h.updater[stage]();
  assert.equal(h.updater.state().status,'error');assert.match(h.updater.state().error!,/만료되었/);
  assert.equal(calls,before+(stage==='check'?1:0));assert.equal(commands,0);
 }
});
test('network errors, oversized manifests and non-HTTPS origins fail closed',async t=>{
 for(const options of [{fetchImpl:async()=>{throw new Error('offline');}},{fetchImpl:async()=>new Response('x'.repeat(65537))},{fetchImpl:async()=>new Response(null,{status:302})},{baseURL:'http://heisen.dev'}]){
  const h=await harness(t,options);await h.updater.check();assert.equal(h.updater.state().status,'error');await h.updater.install();
 }
});
test('download verifies bytes and digest, writes privately, and leaves only the verified file',async t=>{
 const h=await harness(t);await h.updater.check();await h.updater.download();assert.equal(h.updater.state().status,'ready');assert.equal(h.updater.state().progress,100);
 const [folder]=await fs.readdir(h.deps.dir),dir=path.join(h.deps.dir,folder),files=await fs.readdir(dir);assert.deepEqual(files,['Heisen-0.5.0-mac-arm64.dmg']);
 assert.deepEqual(await fs.readFile(path.join(dir,files[0])),payload);if(process.platform!=='win32')assert.equal((await fs.stat(dir)).mode&0o077,0);
 await h.updater.check(true);assert.equal(h.updater.state().status,'ready');assert.equal(h.requests.length,2);
});
test('tampered payload, truncated bytes and oversized streams are rejected and removed',async t=>{
 for(const [body,message] of [[Buffer.alloc(payload.length),/SHA-256/],[payload.subarray(1),/크기/],[Buffer.concat([payload,Buffer.from('!')]),/크기/]] as const){
  const h=await harness(t,{},manifest(),body);await h.updater.check();await h.updater.download();assert.equal(h.updater.state().status,'error');assert.match(h.updater.state().error!,message);assert.deepEqual(await fs.readdir(h.deps.dir),[]);
 }
});
test('declared size mismatch fails even when streamed payload would be correct',async t=>{
 const h=await harness(t,{fetchImpl:async input=>new Response(String(input).endsWith('.json')?signed(manifest()):payload,{headers:String(input).endsWith('.json')?{}:{'content-length':'1'}})});
 await h.updater.check();await h.updater.download();assert.equal(h.updater.state().status,'error');assert.match(h.updater.state().error!,/크기/);assert.deepEqual(await fs.readdir(h.deps.dir),[]);
});
test('install rehashes the file immediately before use and refuses post-download tampering',async t=>{
 let calls=0;const h=await harness(t,{app:{quit:()=>{calls++;},relaunch:()=>{calls++;}},run:async()=>{calls++;return '';}});
 await h.updater.check();await h.updater.download();const [dir]=await fs.readdir(h.deps.dir);await fs.writeFile(path.join(h.deps.dir,dir,'Heisen-0.5.0-mac-arm64.dmg'),Buffer.alloc(payload.length));
 await h.updater.install();assert.equal(h.updater.state().status,'error');assert.match(h.updater.state().error!,/SHA-256/);assert.equal(calls,0);
});
test('concurrent checks and downloads are single flight',async t=>{
 const h=await harness(t);await Promise.all([h.updater.check(),h.updater.check()]);await Promise.all([h.updater.download(),h.updater.download()]);assert.equal(h.requests.length,2);assert.equal(h.updater.state().status,'ready');
});

// These tests execute the real rename/rollback code exclusively in temporary directories.
// macOS tools are injected, so no disk image is mounted and no installed app is touched.
async function macHarness(t:test.TestContext,failAt?:'codesign'|'relaunch'|'identifier',signer?:{current:string;replacement?:string;displayError?:boolean}){
 const calls:{file:string;args:string[]}[]=[];let relaunch=0,quit=0;
 const h=await harness(t);const bundle=path.dirname(path.dirname(path.dirname(h.deps.execPath)));
 await fs.mkdir(path.dirname(h.deps.execPath),{recursive:true});await fs.writeFile(h.deps.execPath,'old');
 h.deps.app={relaunch:()=>{if(failAt==='relaunch')throw new Error('relaunch failed');relaunch++;},quit:()=>{quit++;}};
 h.deps.run=async(file,args)=>{
  calls.push({file,args});
  if(file==='/usr/bin/ditto'){await fs.mkdir(path.join(args[1],'Contents','MacOS'),{recursive:true});await fs.writeFile(path.join(args[1],'Contents','MacOS','Heisen'),'new');}
  if(file==='/usr/libexec/PlistBuddy'){
   if(args[1]==='Print :CFBundleIdentifier')return failAt==='identifier'&&args[2].includes('.Heisen-update-')?'evil.app':'com.heisen.browser';
   if(args[1]==='Print :CFBundleExecutable')return 'Heisen';
   if(args[1]==='Print :CFBundleShortVersionString')return await fs.readFile(path.join(path.dirname(args[2]),'MacOS','Heisen'),'utf8')==='old'?'0.4.0':'0.5.0';
  }
  if(file==='/usr/bin/codesign'){
   if(args[0]==='-dv'){if(signer?.displayError)throw new Error('codesign display failed');return `Executable=${bundle}/Contents/MacOS/Heisen\nTeamIdentifier=${signer?.current??'not set'}\n`;}
   const requirement=args.find(arg=>arg.startsWith('-R='));
   if(requirement&&requirement!==`-R=anchor apple generic and certificate leaf[subject.OU] = "${signer?.replacement}"`)throw new Error('code failed to satisfy specified code requirement(s)');
  }
  if(file==='/usr/bin/codesign'&&failAt==='codesign'&&args.at(-1)!.includes('.Heisen-update-'))throw new Error('codesign failed');
  return '';
 };
 const updater=new Updater(h.deps);t.after(()=>updater.stop());await updater.check();await updater.download();
 return {...h,updater,bundle,calls,lifecycle:()=>({relaunch,quit})};
}
test('mac install verifies the staged app then swaps, relaunches, and retains the old app',async t=>{
 const h=await macHarness(t);await h.updater.install();assert.deepEqual(h.lifecycle(),{relaunch:1,quit:1});
 assert.equal(await fs.readFile(h.deps.execPath,'utf8'),'new');assert.equal(await fs.readFile(path.join(h.bundle+'.old','Contents','MacOS','Heisen'),'utf8'),'old');
 const attach=h.calls.find(c=>c.file==='/usr/bin/hdiutil'&&c.args[0]==='attach');assert.ok(attach?.args.includes('-readonly'));assert.ok(attach?.args.includes('-nobrowse'));
 const verify=h.calls.findIndex(c=>c.file==='/usr/bin/codesign'&&c.args.at(-1)!.includes('.Heisen-update-'));const detach=h.calls.findIndex(c=>c.file==='/usr/bin/hdiutil'&&c.args[0]==='detach');assert.ok(verify>=0&&detach>verify);
 await h.updater.install();assert.deepEqual(h.lifecycle(),{relaunch:1,quit:1});
 if(process.platform==='darwin'){await Updater.cleanupOld(h.deps.execPath,h.deps.run);await assert.rejects(fs.access(h.bundle+'.old'));}
});
test('mac replacements must satisfy the running app Team ID requirement',async t=>{
 for(const replacement of ['ABCDE12345','ZYXWV98765','not set']){
  const h=await macHarness(t,undefined,{current:'ABCDE12345',replacement});await h.updater.install();
  const display=h.calls.find(c=>c.file==='/usr/bin/codesign'&&c.args[0]==='-dv');
  assert.deepEqual(display?.args,['-dv',h.bundle]);
  const verification=h.calls.find(c=>c.file==='/usr/bin/codesign'&&c.args.at(-1)!.includes('.Heisen-update-'));
  assert.deepEqual(verification?.args.slice(0,-1),['--verify','--deep','--strict','-R=anchor apple generic and certificate leaf[subject.OU] = "ABCDE12345"']);
  if(replacement==='ABCDE12345'){
   assert.deepEqual(h.lifecycle(),{relaunch:1,quit:1});assert.equal(await fs.readFile(h.deps.execPath,'utf8'),'new');
  }else{
   assert.equal(h.updater.state().status,'error');assert.match(h.updater.state().error!,/requirement/);
   assert.deepEqual(h.lifecycle(),{relaunch:0,quit:0});assert.equal(await fs.readFile(h.deps.execPath,'utf8'),'old');await assert.rejects(fs.access(h.bundle+'.old'));
  }
 }
});
test('mac ad-hoc signing retains verification without a Team ID requirement',async t=>{
 const h=await macHarness(t);await h.updater.install();assert.deepEqual(h.lifecycle(),{relaunch:1,quit:1});
 for(const call of h.calls.filter(c=>c.file==='/usr/bin/codesign'&&c.args[0]==='--verify'))assert.deepEqual(call.args.slice(0,-1),['--verify','--deep','--strict']);
});
test('mac unreadable or malformed signing identity fails closed before mounting',async t=>{
 for(const signer of [{current:'ABCDE12345',displayError:true},{current:'ABCDE12345" or true'}]){
  const h=await macHarness(t,undefined,signer);await h.updater.install();
  assert.equal(h.updater.state().status,'error');assert.deepEqual(h.lifecycle(),{relaunch:0,quit:0});
  assert.equal(h.calls.some(c=>c.file==='/usr/bin/hdiutil'),false);assert.equal(await fs.readFile(h.deps.execPath,'utf8'),'old');
 }
});
test('mac signature/identity failures leave the current app intact; relaunch failure rolls back',async t=>{
 for(const failure of ['codesign','identifier','relaunch'] as const){
  const h=await macHarness(t,failure);await h.updater.install();assert.equal(h.updater.state().status,'error');assert.deepEqual(h.lifecycle(),{relaunch:0,quit:0});assert.equal(await fs.readFile(h.deps.execPath,'utf8'),'old');await assert.rejects(fs.access(h.bundle+'.old'));
  assert.ok(h.calls.some(c=>c.file==='/usr/bin/hdiutil'&&c.args[0]==='detach'));
 }
});
test('mac translocation paths and pre-existing backups are never overwritten',async t=>{
 const translocated=await harness(t,{execPath:'/private/var/folders/test/AppTranslocation/Test/Heisen.app/Contents/MacOS/Heisen',app:{quit:()=>assert.fail('quit'),relaunch:()=>assert.fail('relaunch')}});
 await translocated.updater.check();await translocated.updater.download();await translocated.updater.install();assert.match(translocated.updater.state().error!,/응용 프로그램/);
 const h=await macHarness(t);await fs.mkdir(h.bundle+'.old');await fs.writeFile(path.join(h.bundle+'.old','keep'),'backup');await h.updater.install();assert.match(h.updater.state().error!,/백업/);assert.equal(await fs.readFile(path.join(h.bundle+'.old','keep'),'utf8'),'backup');assert.equal(await fs.readFile(h.deps.execPath,'utf8'),'old');
});
