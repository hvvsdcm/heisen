import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {Data,Secrets,readLaunch} from '../src/data.ts';
import {SEAL_MAGIC,SealError,initSealed,sealedKey,isSealed,seal,open,sealedWrite,sealedRead,sealedReadText,migrateToSealed,dropBackup,sealText,openText} from '../src/sealed.ts';

function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'heisen-sealed-')),key=randomBytes(32);
 const cipher={isEncryptionAvailable:()=>true,encryptString(s:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);const enc=Buffer.concat([c.update(s,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),enc]);},decryptString(b:Buffer){const d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString();}};
 const secrets=new Secrets(path.join(root,'secrets.json'),cipher),opened:Data[]=[];
 return {root,secrets,cipher,async data(){const data=await Data.open(root,secrets);opened.push(data);return data;},async close(){try{for(const data of opened)await data.flush();}finally{fs.rmSync(root,{recursive:true,force:true});}}};
}

test('seal keys are stored in Secrets, reused, and invalid keys fail closed',async()=>{
 const f=fixture();try{
  initSealed(f.secrets);const original=Buffer.from(sealedKey());
  assert.equal(original.length,32);
  assert.equal(f.secrets.get('sealKey'),original.toString('base64'));
  assert.ok(!fs.readFileSync(path.join(f.root,'secrets.json'),'utf8').includes(original.toString('base64')));
  initSealed(new Secrets(path.join(f.root,'secrets.json'),f.cipher));assert.deepEqual(sealedKey(),original);
  f.secrets.set('sealKey',Buffer.alloc(31).toString('base64'));
  assert.throws(()=>initSealed(f.secrets),/봉인 키가 올바르지/);
  assert.throws(()=>sealedKey(),/봉인 키가 준비되지/);
 }finally{await f.close();}
});

test('AES-GCM authenticates headers, nonce, tag, ciphertext, key and associated data',()=>{
 const key=randomBytes(32),text='방문 기록과 비밀 메모',blob=seal(text,'library.json',key);
 assert.deepEqual(blob.subarray(0,4),SEAL_MAGIC);assert.equal(isSealed(blob),true);
 assert.equal(open(blob,'library.json',key).toString(),text);
 assert.notDeepEqual(seal(text,'library.json',key),blob);
 assert.throws(()=>open(blob,'other.json',key),SealError);
 assert.throws(()=>open(blob,'library.json',randomBytes(32)),SealError);
 for(const offset of [0,4,16,32]){const damaged=Buffer.from(blob);damaged[offset]^=1;assert.throws(()=>open(damaged,'library.json',key),SealError);}
 for(const length of [0,4,16,31])assert.throws(()=>open(blob.subarray(0,length),'library.json',key),SealError);
 assert.equal(open(seal('','empty',key),'empty',key).length,0);
});

test('sealed files round trip and reject renaming, plaintext and tampering',async()=>{
 const f=fixture();try{
  initSealed(f.secrets);const file=path.join(f.root,'private.json'),renamed=path.join(f.root,'other.json');
  assert.equal(await sealedRead(file),null);assert.equal(await sealedReadText(file),null);
  const bytes=Buffer.from([0,1,127,128,255]);await sealedWrite(file,bytes);assert.deepEqual(await sealedRead(file),bytes);
  await sealedWrite(file,'민감한 기록');assert.equal(await sealedReadText(file),'민감한 기록');
  assert.equal(fs.existsSync(file+'.tmp'),false);
  if(process.platform!=='win32')assert.equal(fs.statSync(file).mode&0o777,0o600);
  fs.copyFileSync(file,renamed);await assert.rejects(sealedRead(renamed),SealError);
  const damaged=fs.readFileSync(file);damaged[16]^=1;fs.writeFileSync(file,damaged);await assert.rejects(sealedRead(file),SealError);
  fs.writeFileSync(file,'plain');await assert.rejects(sealedRead(file),/봉인되지 않은/);
  assert.equal(openText(sealText('작업 데이터','tasks:data:1'),'tasks:data:1'),'작업 데이터');
 }finally{await f.close();}
});

test('migration preserves plaintext backup and authenticates against the final basename',async()=>{
 const f=fixture();try{
  initSealed(f.secrets);const file=path.join(f.root,'library.json'),plain='{"history":[]}';
  assert.equal(await migrateToSealed(file),'missing');fs.writeFileSync(file,plain);
  assert.equal(await migrateToSealed(file),'sealed');assert.equal(await sealedReadText(file),plain);
  assert.equal(fs.readFileSync(file+'.v0','utf8'),plain);assert.equal(fs.existsSync(file+'.sealing'),false);
  const encrypted=fs.readFileSync(file);assert.equal(await migrateToSealed(file),'already');assert.deepEqual(fs.readFileSync(file),encrypted);
  await dropBackup(file);await dropBackup(file);assert.equal(fs.existsSync(file+'.v0'),false);
 }finally{await f.close();}
});

test('Data.open seals existing library and drops backup only on the next successful open',async()=>{
 const f=fixture();try{
  const file=path.join(f.root,'library.json'),history=[{title:'비밀',url:'https://private.test/',at:1}];
  fs.writeFileSync(file,JSON.stringify({history,settings:{agentApi:{enabled:true}}}));
  const first=await f.data();assert.deepEqual(first.state.history,history);assert.ok(isSealed(fs.readFileSync(file)));
  assert.equal(fs.existsSync(file+'.v0'),true);assert.deepEqual(readLaunch(f.root),{agentApi:true});await first.flush();
  const second=await f.data();assert.deepEqual(second.state.history,history);assert.equal(fs.existsSync(file+'.v0'),false);
 }finally{await f.close();}
});

test('security defaults merge with saved settings without losing A2 settings',async()=>{
 const f=fixture();try{
  const fresh=await f.data(),settings=fresh.state.settings;
  assert.deepEqual(settings.https,{allowed:[]});assert.deepEqual(settings.safeBrowsing,{enabled:true});assert.deepEqual(settings.downloads,{askWhere:false});
  assert.deepEqual(settings.agentSites,{});assert.equal(settings.background,true);assert.equal(settings.defaultBrowserAsked,false);
  assert.equal(settings.sleep.afterMin,30);assert.equal(settings.energy.batterySaver,true);assert.equal(settings.privacy.trackers,true);assert.equal(settings.privacy.ads,false);assert.equal(settings.reader.size,18);
  await fresh.flush();
  await sealedWrite(path.join(f.root,'library.json'),JSON.stringify({privacy:{sites:{'example.test':{protect:false}}},settings:{https:{allowed:['example.test']},safeBrowsing:{enabled:false},downloads:{askWhere:true},agentSites:{'example.test':'allow'},background:false,defaultBrowserAsked:true,sleep:{afterMin:5},energy:{pauseHiddenVideo:false},privacy:{ads:true},reader:{theme:'sepia'}}}));
  const saved=await f.data(),s=saved.state.settings;
  assert.deepEqual(s.https.allowed,['example.test']);assert.equal(s.safeBrowsing.enabled,false);assert.equal(s.downloads.askWhere,true);assert.deepEqual(s.agentSites,{'example.test':'allow'});
  assert.equal(s.background,false);assert.equal(s.defaultBrowserAsked,true);assert.equal(s.sleep.afterMin,5);assert.equal(s.sleep.afterMinOnBattery,10);
  assert.deepEqual(s.energy,{batterySaver:true,pauseHiddenVideo:false});assert.equal(s.privacy.ads,true);assert.equal(s.privacy.stripParams,true);assert.deepEqual(s.reader,{size:18,theme:'sepia'});
  assert.deepEqual(saved.state.privacy,{sites:{'example.test':{protect:false}},grants:{}});
 }finally{await f.close();}
});

test('launch.json contains only agentApi and changes only when that boolean changes',async()=>{
 const f=fixture();try{
  const data=await f.data(),file=path.join(f.root,'launch.json');assert.deepEqual(readLaunch(f.root),{agentApi:false});
  await data.flush();const original=fs.statSync(file,{bigint:true});
  data.state.settings.theme='light';data.save();await data.flush();const unchanged=fs.statSync(file,{bigint:true});
  assert.equal(unchanged.ino,original.ino);assert.equal(unchanged.mtimeNs,original.mtimeNs);
  data.state.settings.agentApi.enabled=true;data.save();await data.flush();assert.deepEqual(JSON.parse(fs.readFileSync(file,'utf8')),{agentApi:true});
  data.state.settings.agentApi.enabled=false;data.save();await data.flush();assert.deepEqual(readLaunch(f.root),{agentApi:false});
  if(process.platform!=='win32')assert.equal(fs.statSync(file).mode&0o777,0o600);
  assert.equal(fs.existsSync(file+'.tmp'),false);
 }finally{await f.close();}
});

test('readLaunch fails closed on absent, malformed and non-boolean settings',async()=>{
 const f=fixture();try{
  assert.deepEqual(readLaunch(f.root),{agentApi:false});const file=path.join(f.root,'launch.json');
  for(const value of ['{','null','{}','{"agentApi":"true"}','{"agentApi":1}']){fs.writeFileSync(file,value);assert.deepEqual(readLaunch(f.root),{agentApi:false});}
  fs.writeFileSync(file,'{"agentApi":true,"other":"ignored"}');assert.deepEqual(readLaunch(f.root),{agentApi:true});
 }finally{await f.close();}
});

test('corrupt library recovers from backup without discarding it before a good restart',async()=>{
 const f=fixture();try{
  const file=path.join(f.root,'library.json'),history=[{title:'복구',url:'https://restore.test/',at:1}];
  fs.writeFileSync(file,JSON.stringify({history}));const first=await f.data();await first.flush();
  const corrupt=fs.readFileSync(file);corrupt[16]^=1;fs.writeFileSync(file,corrupt);
  const recovered=await f.data();assert.deepEqual(recovered.state.history,history);assert.equal(fs.existsSync(file+'.v0'),true);
  await recovered.flush();assert.deepEqual(JSON.parse((await sealedReadText(file))!).history,history);
  const reopened=await f.data();assert.deepEqual(reopened.state.history,history);assert.equal(fs.existsSync(file+'.v0'),false);
 }finally{await f.close();}
});

test('corrupt library without backup is preserved and replaced with sealed defaults',async()=>{
 const f=fixture();try{
  const file=path.join(f.root,'library.json'),first=await f.data();await first.flush();
  const corrupt=fs.readFileSync(file);corrupt[16]^=1;fs.writeFileSync(file,corrupt);
  const recovered=await f.data();assert.deepEqual(recovered.state.history,[]);
  const copies=fs.readdirSync(f.root).filter(name=>name.startsWith('library.json.corrupt-'));assert.equal(copies.length,1);assert.deepEqual(fs.readFileSync(path.join(f.root,copies[0])),corrupt);
  await recovered.flush();assert.deepEqual(JSON.parse((await sealedReadText(file))!).history,[]);
 }finally{await f.close();}
});

test('unavailable OS encryption aborts opening without migrating plaintext',async()=>{
 const f=fixture();try{
  const file=path.join(f.root,'library.json'),plain='{"history":[]}';fs.writeFileSync(file,plain);
  const unavailable=new Secrets(path.join(f.root,'secrets.json'),{...f.cipher,isEncryptionAvailable:()=>false});
  await assert.rejects(Data.open(f.root,unavailable),/OS 보안 저장소/);assert.equal(fs.readFileSync(file,'utf8'),plain);assert.equal(fs.existsSync(file+'.v0'),false);
 }finally{await f.close();}
});

test('concurrent flush persists the latest state in a sealed library',async()=>{
 const f=fixture();try{
  const data=await f.data();data.state.history=[{title:'a',url:'https://a.test/',at:1}];data.save();const first=data.flush();
  data.state.history=[{title:'b',url:'https://b.test/',at:2}];data.save();const second=data.flush(),third=data.flush();
  await third;assert.equal(JSON.parse((await sealedReadText(path.join(f.root,'library.json')))!).history[0].url,'https://b.test/');await Promise.all([first,second]);
 }finally{await f.close();}
});
