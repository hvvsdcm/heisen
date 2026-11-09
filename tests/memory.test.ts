import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomBytes} from 'node:crypto';
import {Dreaming,MemoryStore,NAME,slug} from '../src/memory.ts';
import {ModelNotConnectedError} from '../src/completion.ts';
import {nextRun} from '../src/routines.ts';
import {initSealed,isSealed,sealedReadText,sealedWrite,SealError} from '../src/sealed.ts';
import {Data} from '../src/data.ts';
import type {Secrets} from '../src/data.ts';

const key=randomBytes(32).toString('base64');
initSealed({get:()=>key} as unknown as Secrets);
const user={author:'user'} as const;
type Legacy={id:string;title:string;text:string;url?:string;at:number};
async function fixture(t:TestContext,legacy:Legacy[]=[]){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'heisen-memory-'));t.after(()=>fs.rm(temp,{recursive:true,force:true}));
 const root=path.join(temp,'memory');let cleared=0;
 const deps={legacy:()=>legacy,clearLegacy:()=>{cleared++;legacy=[];}};
 const store=new MemoryStore(root,deps);await store.load();return {temp,root,store,deps,cleared:()=>cleared};
}

test('writes sealed markdown and full snapshot revisions with author metadata',async t=>{
 const {root,store,deps}=await fixture(t),text='# 여행\n\n비밀 내용';
 const first=await store.write('trip',text,user),second=await store.write('trip',text+' 수정',{author:'agent',taskId:'task-1'});
 assert.match(first.id,/^[0-9a-z]+-[0-9a-f]{6}$/);assert.equal(first.before,null);assert.equal(first.after,text);
 assert.equal(second.before,text);assert.equal(second.after,text+' 수정');assert.equal(second.taskId,'task-1');
 assert.deepEqual(await store.history('trip'),[second,first]);
 const disk=await fs.readFile(path.join(root,'trip.md'));assert.ok(isSealed(disk));assert.equal(disk.includes(Buffer.from('비밀 내용')),false);
 assert.deepEqual(JSON.parse((await sealedReadText(path.join(root,'history',second.id+'.json')))! ),second);
 const expected={name:'trip',title:'여행',bytes:Buffer.byteLength(text+' 수정'),updatedAt:second.at,author:'agent'};assert.deepEqual(store.list(),[expected]);
 const reloaded=new MemoryStore(root,deps);await reloaded.load();assert.equal(await reloaded.read('trip'),text+' 수정');assert.deepEqual(reloaded.list(),[expected]);
 if(process.platform!=='win32'){assert.equal((await fs.stat(root)).mode&0o777,0o700);assert.equal((await fs.stat(path.join(root,'trip.md'))).mode&0o777,0o600);}
});
test('revert uses any revision before snapshot and appends a user revision',async t=>{
 const {store}=await fixture(t);const first=await store.write('note','first',user),second=await store.write('note','second',{author:'agent'});await store.write('note','third',{author:'dreaming',dreamId:'dream-1'});
 const reverted=await store.revert(second.id);assert.equal(await store.read('note'),'first');assert.equal(reverted.before,'third');assert.equal(reverted.after,'first');assert.equal(reverted.revertOf,second.id);assert.equal(reverted.author,'user');assert.equal((await store.history()).length,4);
 const removed=await store.revert(first.id);assert.equal(removed.after,null);assert.equal(await store.read('note'),null);assert.equal((await store.history()).length,5);
});
test('delete keeps history and reverting deletion restores a memory after reload',async t=>{
 const {store,root,deps}=await fixture(t);await store.write('note','# Original\nbody',user);
 const deleted=await store.delete('note',{author:'dreaming',dreamId:'dream-2'});assert.equal(deleted.before,'# Original\nbody');assert.equal(deleted.after,null);assert.equal(deleted.dreamId,'dream-2');assert.deepEqual(store.list(),[]);await assert.rejects(fs.stat(path.join(root,'note.md')),{code:'ENOENT'});
 const reloaded=new MemoryStore(root,deps);await reloaded.load();const restored=await reloaded.revert(deleted.id);assert.equal(restored.revertOf,deleted.id);assert.equal(await reloaded.read('note'),'# Original\nbody');assert.equal((await reloaded.history('note')).length,3);
});
test('identical writes have no persisted revision and preserve metadata',async t=>{
 const {store,root}=await fixture(t);await store.write('same','text',user);const entries=store.list(),original=await fs.readFile(path.join(root,'same.md'));
 const noop=await store.write('same','text',{author:'agent',taskId:'task'});assert.equal(noop.id,'');assert.equal(noop.before,noop.after);assert.deepEqual(store.list(),entries);assert.equal((await store.history()).length,1);assert.deepEqual(await fs.readFile(path.join(root,'same.md')),original);
});
test('search is case insensitive with one-based lines, five matches per file and a file limit',async t=>{
 const {store}=await fixture(t);await store.write('one','# Heading\nALPHA\nalpha\nAlpha\nalpha\nalpha\nalpha',user);await store.write('two','second ALPHA',user);await store.write('other','unrelated',user);
 const results=store.search('aLpHa');assert.deepEqual(results.map(result=>result.name),['two','one']);assert.deepEqual(results[1].lines.map(line=>line.line),[2,3,4,5,6]);assert.equal(results[1].title,'Heading');assert.equal(results[0].lines[0].text,'second ALPHA');assert.equal(store.search('alpha',1).length,1);assert.deepEqual(store.search('absent'),[]);assert.deepEqual(store.search(''),[]);assert.deepEqual(store.search('alpha',0),[]);
});
test('context and snapshots are isolated from callers and use the first heading',async t=>{
 const {store}=await fixture(t);await store.write('a','intro\n# First\n# Second',user);await store.write('b','plain body',user);
 assert.equal(store.contextFor(['a','missing','b']),'First\nintro\n# First\n# Second\n\nb\nplain body');assert.equal(store.contextFor(['a'],8),'First\nin');assert.equal(store.list()[0].title,'b');
 const snapshot=store.texts();snapshot.set('a','tampered');snapshot.delete('b');const list=store.list();list[0].title='tampered';assert.equal(await store.read('a'),'intro\n# First\n# Second');assert.equal(store.list()[0].title,'b');
});
test('names reject traversal, trailing spaces, case collisions and Windows devices',async t=>{
 const {store}=await fixture(t);
 for(const name of ['', '../outside','/absolute','a/b','a\\b','.hidden',' space','space ','a\n','a'.repeat(81),'CON','nul.txt']){await assert.rejects(store.write(name,'text',user),/이름/);await assert.rejects(store.read(name),/이름/);}
 await store.write('Note','text',user);await assert.rejects(store.write('note','other',user),/대소문자/);assert.equal(await store.read('Note'),'text');
 for(const value of ['../ a/b : c','', '   ...','한글 제목', 'a'.repeat(200),'😀','CON','CON.'+'x'.repeat(76),'CON.'+'𐐀'.repeat(76), '𐐀'.repeat(100)]){const name=slug(value);assert.ok(NAME.test(name));assert.ok(!/\s$/.test(name));assert.ok(Buffer.byteLength(name+'.md')<=255);}
 assert.equal(slug('...'),'메모');await assert.rejects(store.revert('../outside'),/ID/);
});
test('text limits and rejected operations do not poison the write queue',async t=>{
 const {store}=await fixture(t);for(const text of ['', ' \n\t'])await assert.rejects(store.write('note',text,user),/내용을 입력하세요/);
 await assert.rejects(store.write('note','x'.repeat(60001),user),/60,000/);await store.write('note','한'.repeat(60000),user);assert.equal(store.list()[0].bytes,180000);
 await assert.rejects(store.delete('missing',user),/찾을 수/);await store.write('next','still writable',user);assert.equal(await store.read('next'),'still writable');
});
test('concurrent writes serialize their full before snapshots and history limits',async t=>{
 const {store}=await fixture(t);const results=await Promise.all(Array.from({length:12},(_,i)=>store.write('note',String(i),user)));
 for(let i=0;i<results.length;i++)assert.equal(results[i].before,i===0?null:String(i-1));assert.equal(await store.read('note'),'11');assert.deepEqual((await store.history('note',3)).map(rev=>rev.after),['11','10','9']);assert.deepEqual(await store.history('other'),[]);assert.deepEqual(await store.history(undefined,0),[]);
});
test('migration preserves titles, URLs, timestamps, unique names and runs only once',async t=>{
 const legacy=[{id:'1',title:'Travel',text:'one',url:'https://example.test',at:10},{id:'2',title:'travel',text:'two',at:20},{id:'3',title:'../',text:'three',at:30}];
 const {store,root,cleared}=await fixture(t,legacy);assert.equal(cleared(),1);assert.deepEqual(store.list().map(entry=>entry.name),['메모','travel-2','Travel']);assert.equal(await store.read('Travel'),'# Travel\n\nhttps://example.test\n\none');assert.deepEqual((await store.history()).map(rev=>rev.at),[30,20,10]);
 let legacyCalls=0,clearCalls=0;const again=new MemoryStore(root,{legacy:()=>{legacyCalls++;return legacy;},clearLegacy:()=>{clearCalls++;}});await again.load();await again.load();assert.equal(legacyCalls,0);assert.equal(clearCalls,0);assert.equal((await again.history()).length,3);assert.ok(await fs.stat(path.join(root,'.migrated')));
});
test('interrupted migration resumes assigned names without duplicate files or revisions',async t=>{
 const {root}=await fixture(t);await fs.unlink(path.join(root,'.migrated'));const legacy=[{id:'1',title:'same',text:'one',at:10},{id:'2',title:'same',text:'two',at:20}];let attempts=0;
 const deps={legacy:()=>legacy,clearLegacy:()=>{if(++attempts===1)throw new Error('save failed');}};
 await assert.rejects(new MemoryStore(root,deps).load(),/save failed/);const retry=new MemoryStore(root,deps);await retry.load();assert.deepEqual(retry.list().map(entry=>entry.name),['same-2','same']);assert.equal((await retry.history()).length,2);await assert.rejects(fs.stat(path.join(root,'.migration.json')),{code:'ENOENT'});
});
test('plaintext and tampered memory bodies fail closed on load',async t=>{
 const {root,store,deps}=await fixture(t);await store.write('secret','sensitive data',user);const file=path.join(root,'secret.md'),body=await fs.readFile(file);body[32]^=1;await fs.writeFile(file,body);
 await assert.rejects(new MemoryStore(root,deps).load(),SealError);await fs.writeFile(file,'plaintext');await assert.rejects(new MemoryStore(root,deps).load(),SealError);
});
test('damaged history is logged and skipped but cannot be reverted',async t=>{
 const {root,store,deps}=await fixture(t);const first=await store.write('note','one',user),second=await store.write('note','two',{author:'agent'});const file=path.join(root,'history',first.id+'.json'),body=await fs.readFile(file);body[16]^=1;await fs.writeFile(file,body);
 const log=t.mock.method(console,'error',()=>{});assert.deepEqual(await store.history(),[second]);assert.equal(log.mock.callCount(),1);await assert.rejects(store.revert(first.id),SealError);assert.equal(await store.read('note'),'two');
 const reloaded=new MemoryStore(root,deps);await reloaded.load();assert.equal(reloaded.list()[0].author,'agent');assert.equal(log.mock.callCount(),2);
});
test('filename authentication rejects copying memory bodies or history under another name',async t=>{
 const {root,store,deps}=await fixture(t);const revision=await store.write('note','secret',user);await fs.copyFile(path.join(root,'note.md'),path.join(root,'other.md'));await assert.rejects(new MemoryStore(root,deps).load(),SealError);
 const other='abc-123456';await fs.copyFile(path.join(root,'history',revision.id+'.json'),path.join(root,'history',other+'.json'));await assert.rejects(store.revert(other),SealError);
});
test('symlink files, staging files and store directories cannot redirect writes',async t=>{
 const {root,temp,store,deps}=await fixture(t),outside=path.join(temp,'outside');await fs.writeFile(outside,'untouched');
 await fs.symlink(outside,path.join(root,'bad.md'));await assert.rejects(store.write('bad','text',user),/링크/);await fs.unlink(path.join(root,'bad.md'));
 await fs.symlink(outside,path.join(root,'bad.md.tmp'));await assert.rejects(store.write('bad','text',user),/링크/);assert.equal(await fs.readFile(outside,'utf8'),'untouched');
 const link=path.join(temp,'linked');await fs.symlink(root,link,'dir');await assert.rejects(new MemoryStore(link,deps).load(),/링크/);
});
test('failed history persistence restores the prior body and leaves the cache unchanged',async t=>{
 const {root,store}=await fixture(t);await store.write('note','one',user);await fs.rename(path.join(root,'history'),path.join(root,'saved-history'));await fs.writeFile(path.join(root,'history'),'not a directory');
 await assert.rejects(store.write('note','two',user));assert.equal(await store.read('note'),'one');assert.equal(await sealedReadText(path.join(root,'note.md')),'one');
 await fs.unlink(path.join(root,'history'));await fs.rename(path.join(root,'saved-history'),path.join(root,'history'));await store.write('note','three',user);assert.equal((await store.history()).length,2);
});
test('2,000-file cap rejects new memories but permits updates and reclaiming deleted slots',async t=>{
 const {root,store}=await fixture(t);
 for(let batch=0;batch<2000;batch+=50)await Promise.all(Array.from({length:50},(_,i)=>sealedWrite(path.join(root,`note-${batch+i}.md`),'body')));
 await store.load();assert.equal(store.list().length,2000);await assert.rejects(store.write('overflow','body',user),/2,000/);await store.write('note-0','updated',user);await store.delete('note-1',user);await store.write('replacement','body',user);assert.equal(store.list().length,2000);
});

function dreamData(){
 let saves=0;const settings={provider:'local',model:'test-model',dreaming:{enabled:false,cron:'0 4 * * *',zone:'Asia/Seoul',next:0,last:undefined as number|undefined}};
 return {data:{state:{settings},save:()=>{saves++;}} as unknown as Data,settings,saves:()=>saves};
}
test('dreaming applies a full plan with sealed reports, revision diffs and reversible history',async t=>{
 const {store,root}=await fixture(t);for(const name of ['a','b','c'])await store.write(name,name,user);
 const before=store.texts(),{data,settings}=dreamData();let notifications=0;
 const dreaming=new Dreaming(store,data,async(system,prompt,signal)=>{
  assert.equal(system.split('\n')[0],'HEISEN_DREAMING');assert.match(prompt,/=== a ===\na/);assert.ok(signal instanceof AbortSignal);
  return {model:'fake-model',text:'```json\n'+JSON.stringify({changes:[{name:'a',action:'update',text:'summary',reason:'merge'},{name:'b',action:'delete',reason:'duplicate'},{name:'new',action:'create',text:'new fact',reason:'extract'}]})+'\n```'};
 },()=>{notifications++;});
 const report=await dreaming.run('manual');assert.equal(report.status,'applied');assert.equal(report.model,'fake-model');assert.equal(settings.dreaming.last,report.at);assert.ok(settings.dreaming.next>Date.now());assert.equal(notifications,1);
 assert.deepEqual([...store.texts()],[['a','summary'],['c','c'],['new','new fact']]);
 const revisions=(await store.history()).filter(rev=>rev.dreamId===report.id);assert.equal(revisions.length,3);
 for(const change of report.changes){const revision=revisions.find(rev=>rev.id===change.revisionId)!;assert.equal(revision.author,'dreaming');assert.equal(revision.name,change.name);assert.equal(revision.before,before.get(change.name)??null);assert.equal(revision.after,store.texts().get(change.name)??null);}
 const file=path.join(root,'dreams',report.id+'.json');assert.ok(isSealed(await fs.readFile(file)));assert.deepEqual(JSON.parse((await sealedReadText(file))!),report);
 const reloaded=new Dreaming(store,data,async()=>{throw new Error('unused');},()=>{});assert.deepEqual(reloaded.list(),[report]);
 report.changes[0].reason='external mutation';assert.equal(dreaming.list()[0].changes[0].reason,'merge');const list=reloaded.list();list[0].changes.length=0;assert.equal(reloaded.list()[0].changes.length,3);
 for(const revision of revisions)await store.revert(revision.id);assert.deepEqual([...store.texts()].sort(),[...before].sort());assert.ok((await store.history()).filter(rev=>rev.revertOf).every(rev=>rev.author==='user'));
});
test('dreaming rejects malformed JSON and entire invalid plans without any memory changes',async t=>{
 const good={name:'a',action:'update',text:'changed',reason:'summary'};
 const cases:[string,unknown,'failed'|'rejected'][]=[
  ['no JSON','not JSON','failed'],['broken JSON','{\"changes\":[}','failed'],['root array','[]','failed'],
  ['unknown update',{changes:[good,{name:'missing',action:'update',text:'x',reason:''}]},'rejected'],
  ['unknown delete',{changes:[good,{name:'missing',action:'delete',reason:''}]},'rejected'],
  ['existing create',{changes:[good,{name:'b',action:'create',text:'x',reason:''}]},'rejected'],
  ['case collision',{changes:[good,{name:'B',action:'create',text:'x',reason:''}]},'rejected'],
  ['duplicate name',{changes:[good,{name:'a',action:'delete',reason:''}]},'rejected'],
  ['traversal',{changes:[good,{name:'../outside',action:'create',text:'x',reason:''}]},'rejected'],
  ['trailing space',{changes:[good,{name:'bad ',action:'create',text:'x',reason:''}]},'rejected'],
  ['unknown action',{changes:[{...good,action:'execute'}]},'rejected'],
  ['unknown field',{changes:[{...good,command:'shell'}]},'rejected'],
  ['unknown root field',{changes:[],command:'shell'},'rejected'],
  ['delete text',{changes:[{name:'a',action:'delete',text:'x',reason:''}]},'rejected'],
  ['empty text',{changes:[{...good,text:' \n'}]},'rejected'],
  ['missing text',{changes:[{name:'a',action:'update',reason:''}]},'rejected'],
  ['long text',{changes:[{...good,text:'x'.repeat(60001)}]},'rejected'],
  ['long reason',{changes:[{...good,reason:'x'.repeat(301)}]},'rejected'],
  ['missing reason',{changes:[{name:'a',action:'update',text:'x'}]},'rejected'],
  ['too many changes',{changes:Array.from({length:51},()=>good)},'rejected'],
  ['non-array changes',{changes:{}},'rejected'],['null item',{changes:[null]},'rejected']
 ];
 for(const [name,value,status] of cases)await t.test(name,async t=>{
  const {store}=await fixture(t);await store.write('a','one',user);await store.write('b','two',user);const before=store.texts(),history=await store.history(),{data}=dreamData();
  const dreaming=new Dreaming(store,data,async()=>({text:typeof value==='string'?value:JSON.stringify(value),model:'fake'}),()=>{});
  const report=await dreaming.run('manual');assert.equal(report.status,status);assert.ok(report.error);assert.deepEqual(store.texts(),before);assert.deepEqual(await store.history(),history);assert.deepEqual(dreaming.list(),[report]);
 });
});
test('dreaming refuses majority deletion but allows exactly half',async t=>{
 const {store}=await fixture(t);for(const name of ['a','b','c','d'])await store.write(name,name,user);const {data}=dreamData();
 let names=['a','b','c'];const dreaming=new Dreaming(store,data,async()=>({model:'fake',text:JSON.stringify({changes:names.map(name=>({name,action:'delete',reason:'duplicate'}))})}),()=>{});
 const history=await store.history();assert.equal((await dreaming.run('manual')).status,'rejected');assert.equal(store.list().length,4);assert.deepEqual(await store.history(),history);
 names=['a','b'];assert.equal((await dreaming.run('manual')).status,'applied');assert.equal(store.list().length,2);
});
test('dreaming refuses fewer than two memories without calling a model',async t=>{
 const {store}=await fixture(t),{data}=dreamData();let calls=0;const dreaming=new Dreaming(store,data,async()=>{calls++;return {text:'',model:''};},()=>{});
 for(const count of [0,1]){if(count)await store.write('only','body',user);const report=await dreaming.run('manual');assert.equal(report.status,'rejected');assert.equal(report.error,'정리할 메모리가 없습니다.');}assert.equal(calls,0);
});
test('dreaming guards overlapping manual and scheduled runs and releases the guard after failure',async t=>{
 const {store}=await fixture(t);await store.write('a','one',user);await store.write('b','two',user);const {data,settings}=dreamData();
 let release!:()=>void,entered!:()=>void,calls=0;const ready=new Promise<void>(resolve=>{entered=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
 const dreaming=new Dreaming(store,data,async()=>{calls++;entered();await gate;throw new Error('provider failed');},()=>{});
 const active=dreaming.run('manual');await ready;await assert.rejects(dreaming.run('manual'),/이미 실행/);settings.dreaming.enabled=true;settings.dreaming.next=0;
 await dreaming.tick();assert.equal(calls,1);release();assert.equal((await active).status,'failed');assert.equal((await dreaming.run('manual')).status,'failed');assert.equal(calls,2);
});
test('dreaming skips concurrently edited and created memories but applies unaffected changes',async t=>{
 const {store}=await fixture(t);for(const name of ['a','b','c'])await store.write(name,name,user);const {data}=dreamData();
 const dreaming=new Dreaming(store,data,async()=>{
  await store.write('a','user edit',user);await store.write('New','user creation',user);
  return {model:'fake',text:JSON.stringify({changes:[{name:'a',action:'update',text:'stale',reason:'summarize'},{name:'b',action:'delete',reason:'duplicate'},{name:'new',action:'create',text:'stale create',reason:'extract'}]})};
 },()=>{});
 const report=await dreaming.run('manual');assert.equal(report.status,'applied');assert.equal(await store.read('a'),'user edit');assert.equal(await store.read('New'),'user creation');assert.equal(await store.read('b'),null);
 for(const index of [0,2]){assert.match(report.changes[index].reason,/동시 변경으로 건너뜀/);assert.equal(report.changes[index].revisionId,undefined);}assert.ok(report.changes[1].revisionId);
});
test('applyDream compares snapshots atomically behind queued writes and records no-op without an id',async t=>{
 const {store}=await fixture(t);await store.write('a','old',user);const edit=store.write('a','new',user),stale=store.applyDream('a','old','stale','dream-id');
 await edit;assert.equal(await stale,null);assert.equal(await store.read('a'),'new');
 const create=store.write('Note','user body',user),collision=store.applyDream('note',null,'dream body','dream-id');await create;assert.equal(await collision,null);
 const same=await store.applyDream('a','new','new','dream-id');assert.equal(same?.id,'');assert.equal((await store.history()).length,3);
});
test('dreaming omits largest bodies over the prompt limit and rejects edits to omitted names',async t=>{
 const {store}=await fixture(t);for(let i=0;i<4;i++)await store.write('large-'+i,'x'.repeat(60000),user);await store.write('small','keep',user);const {data}=dreamData();
 const dreaming=new Dreaming(store,data,async(_system,prompt)=>{
  assert.match(prompt,/Excluded names: \["large-0"\]/);assert.doesNotMatch(prompt,/=== large-0 ===/);assert.match(prompt,/=== small ===\nkeep/);assert.ok(prompt.length<201000);
  return {model:'fake',text:JSON.stringify({changes:[{name:'large-0',action:'delete',reason:'not supplied'}]})};
 },()=>{});assert.equal((await dreaming.run('manual')).status,'rejected');assert.equal(store.list().length,5);
});
test('dreaming defaults off, schedules once per cron occurrence and skips disconnected reports',async t=>{
 const {store,root}=await fixture(t);await store.write('a','one',user);await store.write('b','two',user);const {data,settings,saves}=dreamData();let calls=0;
 const dreaming=new Dreaming(store,data,async()=>{calls++;throw new ModelNotConnectedError();},()=>{});
 const now=Date.UTC(2026,0,1);await dreaming.tick(now);assert.equal(calls,0);assert.equal(saves(),0);
 settings.dreaming.enabled=true;await dreaming.tick(now);assert.equal(calls,1);assert.equal(settings.dreaming.next,nextRun(settings.dreaming.cron,settings.dreaming.zone,now));assert.equal(settings.dreaming.last,undefined);
 assert.deepEqual(dreaming.list(),[]);assert.deepEqual(await fs.readdir(path.join(root,'dreams')),[]);assert.equal('lastError' in settings.dreaming,false);
 await dreaming.tick(now);assert.equal(calls,1);await dreaming.run('manual');assert.equal(calls,2);assert.deepEqual(dreaming.list(),[]);
});
test('dreaming keeps the latest 50 reports across reload and skips corrupt report files',async t=>{
 const {store,root}=await fixture(t);await store.write('a','one',user);await store.write('b','two',user);const {data}=dreamData(),complete=async()=>({model:'fake',text:'{\"changes\":[]}'});
 const dreaming=new Dreaming(store,data,complete,()=>{});for(let i=0;i<51;i++)assert.equal((await dreaming.run('manual')).status,'applied');
 assert.equal(dreaming.list().length,50);assert.equal((await fs.readdir(path.join(root,'dreams'))).length,51);
 const reloaded=new Dreaming(store,data,complete,()=>{});assert.equal(reloaded.list().length,50);
 const newest=reloaded.list()[0];await fs.writeFile(path.join(root,'dreams',newest.id+'.json'),'corrupt');const log=t.mock.method(console,'error',()=>{});
 const recovered=new Dreaming(store,data,complete,()=>{});assert.equal(recovered.list().length,50);assert.ok(!recovered.list().some(report=>report.id===newest.id));assert.equal(log.mock.callCount(),1);
});
test('data defaults keep dreaming and privileged features off and merge saved settings',async t=>{
 const {temp}=await fixture(t),secrets={get:()=>key} as unknown as Secrets,data=await Data.open(temp,secrets);
 try{
  assert.deepEqual(data.state.settings.dreaming,{enabled:false,cron:'0 4 * * *',zone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',next:0});
  assert.deepEqual(data.state.settings.cli,{socket:false,pageScripts:false});assert.deepEqual(data.state.settings.computer,{enabled:false,apps:[]});
 }finally{await data.flush();}
 await sealedWrite(path.join(temp,'library.json'),JSON.stringify({settings:{dreaming:{enabled:true,cron:'0 5 * * *',last:123},cli:{socket:true},computer:{apps:['com.apple.TextEdit']}}}));
 const restored=await Data.open(temp,secrets);
 try{
  assert.deepEqual(restored.state.settings.dreaming,{enabled:true,cron:'0 5 * * *',zone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',next:0,last:123});
  assert.deepEqual(restored.state.settings.cli,{socket:true,pageScripts:false});assert.deepEqual(restored.state.settings.computer,{enabled:false,apps:['com.apple.TextEdit']});
 }finally{await restored.flush();}
});
