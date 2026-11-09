import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {EventEmitter,once} from 'node:events';
import {DatabaseSync} from 'node:sqlite';
import {Store,sealedCodec,type Codec} from '../src/store.ts';
import {Data,Secrets} from '../src/data.ts';
import {migrateAuth,rewriteTaskPaths} from '../src/migrate.ts';
import {Engine} from '../src/engine.ts';
import {readFile,writeFile} from '../src/files.ts';
import {Decoder,encode,MAX_FRAME,originOf,type Task} from '../src/protocol.ts';
const TEST_KEY=Buffer.alloc(32,7),TEST_CODEC=sealedCodec(TEST_KEY);
async function fixture(codec:Codec|null=TEST_CODEC){const root=await fs.mkdtemp(path.join(os.tmpdir(),'heisen-test-'));const store=new Store(path.join(root,'tasks.sqlite'),codec??undefined);const task:Task={id:'test',prompt:'test',urls:['https://example.com'],allowedOrigins:['https://example.com'],epoch:1,status:'running',createdAt:new Date().toISOString(),workspace:root,tainted:true,events:[],sources:[],artifacts:[],approvedHashes:[]};store.save(task);const engine=new Engine(root,store,async()=>({ok:true}),()=>{});engine.tasks.set(task.id,task);return {root,store,task,engine,close:async()=>{store.close();await fs.rm(root,{recursive:true,force:true});}};}
function journalPayloads(db:DatabaseSync):string{
 return JSON.stringify(db.prepare('SELECT id,args,result FROM journal').all().map(row=>({args:row.args===null?null:TEST_CODEC.open(row.args as Uint8Array,'journal:args:'+row.id),result:row.result===null?null:TEST_CODEC.open(row.result as Uint8Array,'journal:result:'+row.id)})));
}
test('native framing accepts fragmentation and rejects oversized or non-object messages',()=>{
 const d=new Decoder();const values:any[]=[];d.on('message',v=>values.push(v));const b=encode({kind:'test',text:'한글'});for(const byte of b)d.push(Buffer.from([byte]));assert.equal(values[0].text,'한글');
 const header=Buffer.alloc(4);header.writeUInt32LE(MAX_FRAME+1);assert.throws(()=>new Decoder().push(header),/Invalid message/);assert.throws(()=>new Decoder().push(encode([1,2])),/Expected object/);
});
test('URL policy rejects local file, JavaScript and embedded credentials',()=>{assert.equal(originOf('https://example.com/a'),'https://example.com');for(const u of ['file:///etc/passwd','javascript:alert(1)','https://u:p@example.com'])assert.throws(()=>originOf(u));});
test('workspace access rejects traversal and symlinks for reading and writing',async()=>{const f=await fixture();try{await writeFile(f.root,'nested/output.txt','works');assert.equal(await readFile(f.root,'nested/output.txt'),'works');await assert.rejects(readFile(f.root,'../outside'));await fs.symlink('/tmp',path.join(f.root,'link'));await assert.rejects(writeFile(f.root,'link/escape','bad'),/심볼릭/);await fs.symlink('/etc/passwd',path.join(f.root,'passwd'));await assert.rejects(readFile(f.root,'passwd'),/심볼릭/);}finally{await f.close();}});
test('restart records uncertain pending effects and does not replay them',async()=>{const f=await fixture();f.store.start('pending',f.task,'web_click',{ref:'e1'});f.store.close();const store=new Store(path.join(f.root,'tasks.sqlite'),TEST_CODEC);try{assert.equal(store.journal('test')[0].state,'UNKNOWN');const task=store.all()[0];assert.equal(task.status,'interrupted');assert.equal(task.epoch,2);const engine=new Engine(f.root,store,async()=>{throw new Error('must not run');},()=>{});await assert.rejects(engine.resume('test'),/불확실/);}finally{store.close();await fs.rm(f.root,{recursive:true,force:true});}});
test('unknown commands and outside origins never reach browser callback',async()=>{const f=await fixture();try{const signal=new AbortController().signal;await assert.rejects(f.engine.tool(f.task,'shell',{command:'echo unsafe'},signal),/허용되지/);await assert.rejects(f.engine.tool(f.task,'web_open',{url:'https://outside.test'},signal),/사이트 범위/);assert.ok(f.store.journal('test').every(j=>j.state==='FAILED'));}finally{await f.close();}});
test('generated code waits for approval and rejects changes after approval',async()=>{const f=await fixture();try{await writeFile(f.root,'script.py','print("reviewed")');const result=f.engine.tool(f.task,'code_run',{path:'script.py',language:'python'},new AbortController().signal);const caught=assert.rejects(result,/승인 후 코드가 변경/);while(!f.task.approval)await new Promise(r=>setTimeout(r,10));assert.equal(f.task.status,'awaiting_approval');assert.match(f.task.approval.detail,/reviewed/);await writeFile(f.root,'script.py','print("changed")');f.engine.approve('test',f.task.approval.id,true);await caught;}finally{await f.close();}});
test('cancellation invalidates in-flight browser result and records UNKNOWN',async()=>{const f=await fixture();let resolve!:(v:any)=>void;const engine=new Engine(f.root,f.store,async(_t,m)=>m==='epoch'?{}:new Promise(r=>{resolve=r;}),()=>{});engine.tasks.set('test',f.task);try{const controller=new AbortController();const p=engine.tool(f.task,'web_open',{url:'https://example.com'},controller.signal);const caught=assert.rejects(p,/Cancelled/);engine.cancel('test');controller.abort();resolve({tabId:1});await caught;assert.equal(f.task.epoch,2);assert.equal(f.store.journal('test')[0].state,'UNKNOWN');}finally{await f.close();}});
test('completion requires real evidence and successful code execution',async()=>{const f=await fixture();const signal=new AbortController().signal;try{await assert.rejects(f.engine.tool(f.task,'task_finish',{summary:'done',artifactPaths:[],sourceIds:[]},signal),/결과 파일이나 출처/);await assert.rejects(f.engine.tool(f.task,'task_finish',{summary:'done',artifactPaths:['missing.md'],sourceIds:[]},signal),/ENOENT/);await writeFile(f.root,'result.md','verified artifact');f.task.codeExitCode=1;await assert.rejects(f.engine.tool(f.task,'task_finish',{summary:'done',artifactPaths:['result.md'],sourceIds:[]},signal),/성공하지/);f.task.codeExitCode=0;const result=await f.engine.tool(f.task,'task_finish',{summary:'done',artifactPaths:['result.md'],sourceIds:[]},signal);assert.equal(result.verifiedArtifacts[0].sha256.length,64);}finally{await f.close();}});
test('deleting a running task removes its row and journal, keeps other tasks, and is not written back by the settling run',async()=>{
 // tsconfig lib predates Promise.withResolvers, so the executor form captures the resolvers.
 const f=await fixture();let opened!:()=>void,release!:(v:unknown)=>void;const openCalled=new Promise<void>(r=>{opened=r;});
 const engine=new Engine(f.root,f.store,async(_t,m)=>{if(m==='epoch')return {};opened();return new Promise(r=>{release=r;});},()=>{});
 const other:Task={...f.task,id:'other',status:'completed',events:[{time:new Date().toISOString(),type:'completed',text:'done'}]};
 f.task.demo=true;f.task.events.push({time:new Date().toISOString(),type:'info',text:'event'});engine.tasks.set('test',f.task);engine.tasks.set('other',other);f.store.save(f.task);f.store.save(other);f.store.start('other-call',other,'file_list',{});
 const db=new DatabaseSync(path.join(f.root,'tasks.sqlite'));const count=(sql:string,id:string)=>db.prepare(sql).all(id).length;
 try{
  const run=engine.run(f.task);await openCalled;assert.equal(count('SELECT 1 FROM journal WHERE task_id=?','test'),1);
  assert.equal(engine.delete('test'),f.task);assert.equal(f.task.status,'cancelled');release({tabId:1});await run;
  assert.equal(count('SELECT 1 FROM tasks WHERE id=?','test'),0);assert.equal(count('SELECT 1 FROM journal WHERE task_id=?','test'),0);
  assert.ok(!engine.tasks.has('test'));assert.throws(()=>engine.get('test'),/찾을 수 없습니다/);
  assert.deepEqual(f.store.all().map(t=>t.id),['other']);assert.deepEqual(f.store.all()[0],other);assert.equal(f.store.journal('other').length,1);assert.equal(engine.get('other'),other);
 }finally{db.close();await f.close();}
});
async function loginFixture(username:string|null){
 const f=await fixture();f.task.tainted=false;const calls:{method:string;args:Record<string,unknown>}[]=[];const approvals=new EventEmitter();
 const engine=new Engine(f.root,f.store,async(_t,method,args)=>{calls.push({method,args});if(method==='loginInfo')return {origin:'https://example.com',username};if(method==='login')return {ok:true,username,password:'hunter2-secret'};return {ok:true};},()=>{if(f.task.approval)approvals.emit('requested');});engine.tasks.set('test',f.task);
 const logins=()=>calls.filter(c=>c.method==='login').length;
 const db=new DatabaseSync(path.join(f.root,'tasks.sqlite'));const journalText=()=>journalPayloads(db);
 return {...f,engine,calls,approvals,logins,journalText,close:async()=>{db.close();await f.close();}};
}
test('web_login waits for approval, fills once and never returns the password',async()=>{const f=await loginFixture('user@example.com');const signal=new AbortController().signal;try{
 const requested=once(f.approvals,'requested');const pending=f.engine.tool(f.task,'web_login',{tabId:1},signal);await requested;
 assert.equal(f.task.status,'awaiting_approval');assert.equal(f.task.approval!.title,'저장된 비밀번호 사용');assert.equal(f.task.approval!.detail,'https://example.com\nuser@example.com');assert.equal(f.logins(),0);
 f.engine.approve('test',f.task.approval!.id,true);const result=await pending;
 assert.deepEqual(result,{ok:true,username:'user@example.com'});assert.equal(f.logins(),1);assert.deepEqual(f.calls.find(c=>c.method==='login')!.args,{tabId:1,origin:'https://example.com'});assert.equal(f.task.tainted,true);
 for(const text of [JSON.stringify(result),JSON.stringify(f.task),f.journalText()])assert.ok(!text.includes('hunter2-secret'));
 await f.engine.tool(f.task,'web_login',{tabId:1},signal);assert.equal(f.task.approval,undefined);assert.equal(f.logins(),2);
}finally{await f.close();}});
test('web_login rejection never fills credentials',async()=>{const f=await loginFixture('user@example.com');try{const requested=once(f.approvals,'requested');const pending=f.engine.tool(f.task,'web_login',{tabId:1},new AbortController().signal);const caught=assert.rejects(pending,/거절/);await requested;f.engine.approve('test',f.task.approval!.id,false);await caught;assert.equal(f.logins(),0);assert.equal(f.task.status,'running');assert.equal(f.store.journal('test')[0].state,'FAILED');}finally{await f.close();}});
test('web_login without a saved password fails before approval',async()=>{const f=await loginFixture(null);const signal=new AbortController().signal;try{await assert.rejects(f.engine.tool(f.task,'web_login',{tabId:1},signal),/저장된 비밀번호가 없습니다/);await assert.rejects(f.engine.tool(f.task,'web_login',{tabId:'1'},signal),/Invalid tab/);assert.equal(f.task.approval,undefined);assert.equal(f.logins(),0);}finally{await f.close();}});
async function signupFixture(email:string|null,existing=false){
 const f=await fixture();f.task.tainted=false;const calls:{method:string;args:Record<string,unknown>}[]=[];const approvals=new EventEmitter();const info={origin:'https://example.com',email,mode:'generate',existing};
 const engine=new Engine(f.root,f.store,async(_t,method,args)=>{calls.push({method,args});if(method==='signupInfo')return {...info};if(method==='signup')return {ok:true,email:info.email,filled:{email:true,password:true},attempt:1,password:'gen-secret-xyz'};return {ok:true};},()=>{if(f.task.approval)approvals.emit('requested');});engine.tasks.set('test',f.task);
 const signups=()=>calls.filter(c=>c.method==='signup').length;
 const db=new DatabaseSync(path.join(f.root,'tasks.sqlite'));const journalText=()=>journalPayloads(db);
 return {...f,engine,calls,approvals,info,signups,journalText,close:async()=>{db.close();await f.close();}};
}
test('web_signup waits for approval, fills and never returns the password',async()=>{const f=await signupFixture('new@example.com');const signal=new AbortController().signal;try{
 const requested=once(f.approvals,'requested');const pending=f.engine.tool(f.task,'web_signup',{tabId:1},signal);await requested;
 assert.equal(f.task.status,'awaiting_approval');assert.equal(f.task.approval!.title,'자동 회원가입');assert.equal(f.task.approval!.detail,'https://example.com\nnew@example.com\n생성된 비밀번호');assert.equal(f.signups(),0);
 f.engine.approve('test',f.task.approval!.id,true);const result=await pending;
 assert.deepEqual(result,{ok:true,email:'new@example.com',filled:{email:true,password:true},attempt:1});assert.equal(f.signups(),1);assert.deepEqual(f.calls.find(c=>c.method==='signup')!.args,{tabId:1,origin:'https://example.com'});assert.equal(f.task.tainted,true);
 for(const text of [JSON.stringify(result),JSON.stringify(f.task),f.journalText()])assert.ok(!text.includes('gen-secret-xyz'));
 await f.engine.tool(f.task,'web_signup',{tabId:1},signal);assert.equal(f.task.approval,undefined);assert.equal(f.signups(),2);
}finally{await f.close();}});
test('web_signup approval covers the aliased and plain default email of one origin',async()=>{const f=await signupFixture('new+examplecom@example.com');f.info.mode='preset';const signal=new AbortController().signal;try{
 const requested=once(f.approvals,'requested');const pending=f.engine.tool(f.task,'web_signup',{tabId:1},signal);await requested;
 assert.equal(f.task.approval!.detail,'https://example.com\nnew+examplecom@example.com\n지정한 비밀번호 세트');f.engine.approve('test',f.task.approval!.id,true);await pending;
 f.info.email='new@example.com';await f.engine.tool(f.task,'web_signup',{tabId:1},signal);assert.equal(f.task.approval,undefined);assert.equal(f.signups(),2);
 f.info.email='other@example.com';const again=once(f.approvals,'requested');const second=f.engine.tool(f.task,'web_signup',{tabId:1},signal);const caught=assert.rejects(second,/거절/);await again;f.engine.approve('test',f.task.approval!.id,false);await caught;assert.equal(f.signups(),2);
}finally{await f.close();}});
test('web_signup rejection never fills',async()=>{const f=await signupFixture('new@example.com');try{const requested=once(f.approvals,'requested');const pending=f.engine.tool(f.task,'web_signup',{tabId:1},new AbortController().signal);const caught=assert.rejects(pending,/거절/);await requested;f.engine.approve('test',f.task.approval!.id,false);await caught;assert.equal(f.signups(),0);assert.equal(f.task.status,'running');assert.equal(f.store.journal('test')[0].state,'FAILED');}finally{await f.close();}});
test('web_signup without a default email or with a saved account fails before approval',async()=>{const signal=new AbortController().signal;
 const none=await signupFixture(null);try{await assert.rejects(none.engine.tool(none.task,'web_signup',{tabId:1},signal),/기본 이메일/);await assert.rejects(none.engine.tool(none.task,'web_signup',{tabId:'1'},signal),/Invalid tab/);assert.equal(none.task.approval,undefined);assert.equal(none.signups(),0);}finally{await none.close();}
 const saved=await signupFixture('new@example.com',true);try{await assert.rejects(saved.engine.tool(saved.task,'web_signup',{tabId:1},signal),/이미 저장된 계정/);assert.equal(saved.task.approval,undefined);assert.equal(saved.signups(),0);}finally{await saved.close();}
});
test('engine credential approval pins the original origin even when the page moves while waiting',async()=>{
 for(const action of ['login','signup'] as const){
  const f=await fixture();let currentOrigin='https://example.com',filled=0;
  const approvals=new EventEmitter(),engine=new Engine(f.root,f.store,async(_task,method,args)=>{
   if(method===action+'Info')return {origin:currentOrigin,username:'user@example.com',email:'user@example.com',mode:'generate',existing:false};
   if(method===action){
    if(args.origin!==currentOrigin)throw new Error('Approved origin changed');
    filled++;return {ok:true};
   }
   return {ok:true};
  },()=>{if(f.task.approval)approvals.emit('requested');});engine.tasks.set(f.task.id,f.task);
  try{
   const requested=once(approvals,'requested'),pending=engine.tool(f.task,'web_'+action,{tabId:1},new AbortController().signal);
   const rejected=assert.rejects(pending,/Approved origin changed/);await requested;
   currentOrigin='https://other.test';engine.approve(f.task.id,f.task.approval!.id,true);
   await rejected;assert.equal(filled,0);assert.equal(f.store.journal(f.task.id)[0].state,'FAILED');
  }finally{await f.close();}
 }
});
test('plaintext tasks, journal and audit migrate atomically and retain a backup for one launch',async()=>{
 const f=await fixture(null),file=path.join(f.root,'tasks.sqlite');
 f.task.status='completed';f.task.prompt='private legacy prompt';f.store.save(f.task);
 f.store.start('finished',f.task,'web_observe',{query:'private query'});f.store.finish('finished','DONE',{text:'private result'});
 f.store.start('pending',f.task,'web_click',{ref:'e1'});
 f.store.audit({actor:'task',taskId:f.task.id,tool:'web_observe',origin:'https://private.example',summary:'private audit',state:'ok'});
 f.store.close();await fs.writeFile(file+'.v0','stale backup');
 let store:Store|undefined;
 try{
  store=new Store(file,TEST_CODEC);
  const db=new DatabaseSync(file),backup=new DatabaseSync(file+'.v0');
  try{
   assert.equal(db.prepare('PRAGMA user_version').get()!.user_version,1);
   assert.equal(backup.prepare('PRAGMA user_version').get()!.user_version,0);
   assert.equal(JSON.parse(String(backup.prepare('SELECT data FROM tasks').get()!.data)).prompt,'private legacy prompt');
   if(process.platform!=='win32')assert.equal((await fs.stat(file+'.v0')).mode&0o777,0o600);
   const task=db.prepare('SELECT id,data FROM tasks').get()!;assert.equal(Buffer.from(task.data as Uint8Array).subarray(0,4).toString(),'HSN1');
   assert.deepEqual(JSON.parse(TEST_CODEC.open(task.data as Uint8Array,'tasks:data:'+task.id)),f.task);
   for(const row of db.prepare('SELECT id,args,result FROM journal').all()){
    assert.equal(Buffer.from(row.args as Uint8Array).subarray(0,4).toString(),'HSN1');
    assert.deepEqual(JSON.parse(TEST_CODEC.open(row.args as Uint8Array,'journal:args:'+row.id)),row.id==='finished'?{query:'private query'}:{ref:'e1'});
    if(row.id==='finished'){assert.equal(Buffer.from(row.result as Uint8Array).subarray(0,4).toString(),'HSN1');assert.deepEqual(JSON.parse(TEST_CODEC.open(row.result as Uint8Array,'journal:result:'+row.id)),{text:'private result'});}
    else assert.equal(row.result,null);
   }
   const audit=db.prepare('SELECT id,origin,summary FROM audit').get()!;
   assert.equal(Buffer.from(audit.origin as Uint8Array).subarray(0,4).toString(),'HSN1');
   assert.equal(TEST_CODEC.open(audit.summary as Uint8Array,'audit:summary:'+audit.id),'private audit');
   assert.deepEqual(store.all(),[f.task]);assert.equal(store.audits()[0].origin,'https://private.example');
   assert.equal(store.journal(f.task.id).find(row=>row.id==='pending')!.state,'UNKNOWN');
  }finally{db.close();backup.close();}
  store.close();store=undefined;
  assert.throws(()=>new Store(file),/봉인된 작업 DB/);
  await fs.access(file+'.v0');
  store=new Store(file,TEST_CODEC);assert.deepEqual(store.all(),[f.task]);await assert.rejects(fs.access(file+'.v0'),{code:'ENOENT'});
 }finally{store?.close();await fs.rm(f.root,{recursive:true,force:true});}
});
test('failed sealing rolls back every payload and version without losing its backup',async()=>{
 const f=await fixture(null),file=path.join(f.root,'tasks.sqlite');f.task.status='completed';f.store.save(f.task);f.store.start('call',f.task,'web_observe',{});f.store.close();
 let calls=0;const codec:Codec={open:TEST_CODEC.open,seal:(text,aad)=>{if(++calls===2)throw new Error('seal failed');return TEST_CODEC.seal(text,aad);}};
 try{
  assert.throws(()=>new Store(file,codec),/seal failed/);
  const db=new DatabaseSync(file);
  try{assert.equal(db.prepare('PRAGMA user_version').get()!.user_version,0);assert.deepEqual(JSON.parse(String(db.prepare('SELECT data FROM tasks').get()!.data)),f.task);assert.equal(db.prepare('SELECT args FROM journal').get()!.args,'{}');}finally{db.close();}
  await fs.access(file+'.v0');
  const store=new Store(file,TEST_CODEC);try{assert.deepEqual(store.all(),[f.task]);}finally{store.close();}
 }finally{await fs.rm(f.root,{recursive:true,force:true});}
});
test('audit seals private fields, truncates summaries, orders and limits reads, and clears',async()=>{
 const f=await fixture(),file=path.join(f.root,'tasks.sqlite'),db=new DatabaseSync(file);
 try{
  f.store.audit({actor:'mcp',taskId:'test',tool:'web_observe',origin:'https://private.example',summary:'가'.repeat(2001),state:'ok'});
  const first=f.store.audits()[0];assert.equal(first.summary,'가'.repeat(2000));assert.equal(first.taskId,'test');assert.equal(first.origin,'https://private.example');assert.equal(first.actor,'mcp');assert.equal(first.state,'ok');assert.ok(first.id);assert.ok(first.at<=Date.now());
  db.prepare('UPDATE audit SET at=1 WHERE id=?').run(first.id);
  f.store.audit({actor:'cli',tool:'status',summary:'denied',state:'denied'});
  const rows=f.store.audits();assert.equal(rows.length,2);assert.equal(rows[0].summary,'denied');assert.equal(rows[0].taskId,undefined);assert.equal(rows[0].origin,undefined);assert.deepEqual(f.store.audits(1),[rows[0]]);assert.deepEqual(f.store.audits(0),[]);
  const raw=db.prepare('SELECT origin,summary FROM audit WHERE id=?').get(first.id)!;
  assert.equal(Buffer.from(raw.origin as Uint8Array).subarray(0,4).toString(),'HSN1');assert.equal(Buffer.from(raw.summary as Uint8Array).subarray(0,4).toString(),'HSN1');
  f.store.clearAudit();assert.deepEqual(f.store.audits(),[]);assert.equal(db.prepare('SELECT count(*) AS n FROM audit').get()!.n,0);
 }finally{db.close();await f.close();}
});
test('new task and journal writes bind sealed payloads to their row and column',async()=>{
 const f=await fixture(),db=new DatabaseSync(path.join(f.root,'tasks.sqlite'));
 try{
  f.store.start('call',f.task,'web_observe',{query:'new query'});f.store.finish('call','DONE',{text:'new result'});
  const task=db.prepare('SELECT data FROM tasks WHERE id=?').get(f.task.id)!,journal=db.prepare('SELECT args,result FROM journal WHERE id=?').get('call')!;
  assert.deepEqual(JSON.parse(TEST_CODEC.open(task.data as Uint8Array,'tasks:data:test')),f.task);
  assert.deepEqual(JSON.parse(TEST_CODEC.open(journal.args as Uint8Array,'journal:args:call')),{query:'new query'});
  assert.deepEqual(JSON.parse(TEST_CODEC.open(journal.result as Uint8Array,'journal:result:call')),{text:'new result'});
  assert.throws(()=>TEST_CODEC.open(task.data as Uint8Array,'tasks:data:other'));
  assert.throws(()=>TEST_CODEC.open(journal.args as Uint8Array,'journal:result:call'));
  assert.throws(()=>sealedCodec(Buffer.alloc(32,8)).open(task.data as Uint8Array,'tasks:data:test'));
 }finally{db.close();await f.close();}
});
test('corrupt or swapped task and audit payloads are skipped without exposing their contents',async(t)=>{
 const f=await fixture(),db=new DatabaseSync(path.join(f.root,'tasks.sqlite')),errors:unknown[][]=[];
 t.mock.method(console,'error',(...args:unknown[])=>{errors.push(args);});
 try{
  f.store.save({...f.task,id:'other'});
  db.prepare('UPDATE tasks SET data=(SELECT data FROM tasks WHERE id=?) WHERE id=?').run('test','other');
  assert.deepEqual(f.store.all().map(task=>task.id),['test']);
  const blob=Buffer.from(db.prepare('SELECT data FROM tasks WHERE id=?').get('test')!.data as Uint8Array);blob[blob.length-1]^=1;
  db.prepare('UPDATE tasks SET data=? WHERE id=?').run(blob,'test');
  assert.deepEqual(f.store.allRows(),[]);
  f.store.audit({actor:'task',tool:'web_open',origin:'https://private.example',summary:'private summary',state:'error'});
  db.exec('UPDATE audit SET summary=origin');assert.deepEqual(f.store.audits(),[]);
  assert.equal(errors.length,4);assert.ok(!JSON.stringify(errors).includes('private'));
 }finally{db.close();await f.close();}
});
test('auth migration updates all sealed task rows beyond the visible window and preserves other providers',async()=>{
 const f=await fixture(),secrets=new Secrets(path.join(f.root,'secrets.json'),{encryptString:text=>Buffer.from(text),decryptString:blob=>blob.toString(),isEncryptionAvailable:()=>true});
 const data=await Data.open(f.root,secrets);
 try{
  for(let i=0;i<35;i++)f.store.save({...f.task,id:'legacy-'+i,status:'completed',provider:'claude-code',model:'old'});
  f.store.save({...f.task,id:'current',provider:'openai',model:'keep'});
  data.state.settings.provider='claude-code';data.state.settings.model='old';secrets.set('claude-code',{connected:true});secrets.set('chatgpt',{access:'incomplete'});
  assert.equal(f.store.all().length,30);assert.equal(f.store.allRows().length,37);
  migrateAuth(data,secrets,f.store);
  assert.equal(secrets.has('claude-code'),false);assert.equal(secrets.has('chatgpt'),false);assert.equal(data.state.settings.provider,'claude-subscription');assert.equal(data.state.settings.model,'');
  const migrated=f.store.allRows().filter(task=>task.id.startsWith('legacy-'));assert.equal(migrated.length,35);for(const task of migrated){assert.equal(task.provider,'claude-subscription');assert.equal(task.model,'');}
  assert.equal(f.store.allRows().find(task=>task.id==='current')!.model,'keep');
  secrets.set('chatgpt',{access:'valid',refresh:'valid'});migrateAuth(data,secrets,f.store);assert.equal(secrets.has('chatgpt'),true);
  const db=new DatabaseSync(path.join(f.root,'tasks.sqlite'));
  try{for(const row of db.prepare('SELECT data FROM tasks').all())assert.equal(Buffer.from(row.data as Uint8Array).subarray(0,4).toString(),'HSN1');}finally{db.close();}
 }finally{await data.flush();await f.close();}
});
test('workspace rewriting leaves sealed databases untouched',async()=>{
 const f=await fixture(),file=path.join(f.root,'tasks.sqlite'),db=new DatabaseSync(file);
 try{
  const before=db.prepare('SELECT data FROM tasks').get()!.data;
  rewriteTaskPaths(file,f.root,path.join(f.root,'moved'));
  assert.deepEqual(db.prepare('SELECT data FROM tasks').get()!.data,before);assert.equal(f.store.all()[0].workspace,f.root);
 }finally{db.close();await f.close();}
});
