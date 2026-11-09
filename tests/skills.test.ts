import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {crc32,deflateRawSync} from 'node:zlib';
import {SkillStore,parseSkill,tokens,type SkillMeta} from '../src/skills.ts';

const exec=promisify(execFile);
const markdown=(name='research',body='Use the saved sources.',extra='')=>`---\nname: ${name}\ndescription: research sources compare\n${extra}---\n${body}`;
async function fixture(t:TestContext,review:(meta:SkillMeta,body:string)=>Promise<boolean>=async()=>true){
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'heisen-skills-test-'));t.after(()=>fs.rm(temp,{recursive:true,force:true}));
 const root=path.join(temp,'store'),store=new SkillStore(root,{review,legacy:()=>[],clearLegacy:()=>{}});await store.load();
 return {temp,root,store};
}
async function folder(root:string,files:Record<string,string|Buffer>){
 await fs.mkdir(root,{recursive:true});for(const [name,data] of Object.entries(files)){await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.writeFile(path.join(root,name),data);}return root;
}
// Tiny ZIP fixture writer: permits deliberately invalid names/modes and header mismatches.
function zip(entries:{name:string;body?:string|Buffer;mode?:number;deflate?:boolean;localName?:string}[]){
 const local:Buffer[]=[],central:Buffer[]=[];let offset=0;
 for(const entry of entries){const name=Buffer.from(entry.name),localName=Buffer.from(entry.localName??entry.name),body=Buffer.from(entry.body??''),data=entry.deflate?deflateRawSync(body):body;
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(entry.deflate?8:0,8);header.writeUInt32LE(crc32(body),14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(body.length,22);header.writeUInt16LE(localName.length,26);
  const record=Buffer.alloc(46);record.writeUInt32LE(0x02014b50);record.writeUInt16LE(0x314,4);record.writeUInt16LE(20,6);record.writeUInt16LE(0x800,8);record.writeUInt16LE(entry.deflate?8:0,10);record.writeUInt32LE(crc32(body),16);record.writeUInt32LE(data.length,20);record.writeUInt32LE(body.length,24);record.writeUInt16LE(name.length,28);record.writeUInt32LE(((entry.mode??0o100644)*65536)>>>0,38);record.writeUInt32LE(offset,42);
  local.push(header,localName,data);central.push(record,name);offset+=header.length+localName.length+data.length;
 }
 const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,directory,end]);
}

test('frontmatter parses YAML, tools, sites, CRLF and paragraph fallback',()=>{
 assert.deepEqual(parseSkill('---\r\nname: 자료조사\r\nallowed-tools: web_read code_run\r\nmetadata:\r\n  sites: [example.com]\r\n---\r\n첫 문단\r\n\r\n다음 문단'),{name:'자료조사',description:'첫 문단',tools:['web_read','code_run'],sites:['example.com'],body:'첫 문단\r\n\r\n다음 문단'});
 assert.deepEqual(parseSkill(markdown('research','body','allowed-tools: [web_read, code_run]\nsites: [a.test]\n')).tools,['web_read','code_run']);
 assert.equal(parseSkill(`---\nname: long\n---\n${'a'.repeat(250)}\n\nsecond`).description.length,200);
 assert.equal(parseSkill('---\nname: empty\n---').body,'');
});
test('invalid frontmatter and unsafe names fail closed',()=>{
 for(const text of ['plain','---\ndescription: none\n---\nbody','---\nname: 5\n---\nbody','---\nname: [x]\n---\nbody',markdown('../escape'),markdown('research','body','allowed-tools: [1]\n'),markdown('research','body','sites: example.com\n'),markdown('research','body','name: duplicate\n')])assert.throws(()=>parseSkill(text));
 assert.throws(()=>parseSkill('---\nname: safe\ndescription: &a [*a]\n---\nbody'));
});
test('tokens are Unicode, lowercase, unique and at least two characters',()=>{
 assert.deepEqual([...tokens('A aa AA 한 한국 자료 12 1 Café café')],['aa','한국','자료','12','café']);
});
test('folder installation reviews permissions and hashes sorted content, excluding dependencies',async t=>{
 const reviews:SkillMeta[]=[];const {store,temp,root}=await fixture(t,async(meta,body)=>{reviews.push(meta);assert.equal(body,'Use the saved sources.');return true;});
 const source=await folder(path.join(temp,'package'),{'SKILL.md':markdown('research',undefined,'allowed-tools: [web_read, code_run]\nsites: [example.com]\n'),'scripts/z.py':'print(1)','scripts/nested/a.mjs':'console.log(1)','scripts/data.txt':'data','node_modules/ignored.js':'ignored','.git/config':'ignored'});
 const [meta]=await store.install(source);assert.equal(meta.source.kind,'folder');assert.equal(meta.approved,true);assert.equal(meta.enabled,true);assert.equal(meta.files,4);
 assert.deepEqual(meta.permissions,{tools:['web_read','code_run'],sites:['example.com'],scripts:['scripts/nested/a.mjs','scripts/z.py']});assert.equal(reviews[0].approved,false);
 const lines=[];for(const name of ['SKILL.md','scripts/data.txt','scripts/nested/a.mjs','scripts/z.py'])lines.push(`${name}\0${createHash('sha256').update(await fs.readFile(path.join(source,name))).digest('hex')}\n`);
 assert.equal(meta.hash,createHash('sha256').update(lines.join('')).digest('hex'));assert.equal(await store.verify(meta.id),true);await assert.rejects(fs.stat(path.join(root,meta.id,'node_modules')));
 const list=store.list();list[0].permissions.tools.push('bad');assert.equal(store.list()[0].permissions.tools.includes('bad'),false);
});
test('denied packages remain installed and enabling reviews them again',async t=>{
 let approved=false,calls=0;const {store,temp}=await fixture(t,async()=>{calls++;return approved;});
 const source=await folder(path.join(temp,'package'),{'SKILL.md':markdown()});const [meta]=await store.install(source);
 assert.equal(meta.error,'권한 미승인');assert.equal(meta.enabled,false);assert.deepEqual(await store.bodies([meta.id]),[]);assert.equal(await store.body(meta.id),'Use the saved sources.');
 approved=true;assert.equal((await store.setEnabled(meta.id,true)).approved,true);assert.equal(calls,2);await store.setEnabled(meta.id,false);await store.setEnabled(meta.id,true);assert.equal(calls,2);
});
test('same name replacement preserves id and always requires fresh approval',async t=>{
 let approved=true,calls=0;const {store,temp}=await fixture(t,async()=>{calls++;return approved;});const source=await folder(path.join(temp,'package'),{'SKILL.md':markdown()});
 const [first]=await store.install(source);approved=false;await fs.writeFile(path.join(source,'SKILL.md'),markdown('Research','new body'));const [second]=await store.install(source);
 assert.equal(second.id,first.id);assert.notEqual(second.hash,first.hash);assert.equal(calls,2);assert.equal(second.approved,false);assert.equal(store.list().length,1);assert.equal(await store.body(second.id),'new body');
});
test('installation snapshots source before review and rolls back a thrown review',async t=>{
 const {store,temp}=await fixture(t);const source=await folder(path.join(temp,'package'),{'SKILL.md':markdown()});let review=0;
 const replacement=new SkillStore(path.join(temp,'other'),{review:async()=>{review++;await fs.writeFile(path.join(source,'SKILL.md'),markdown('research','changed during review'));if(review===2)throw new Error('review failed');return true;},legacy:()=>[],clearLegacy:()=>{}});await replacement.load();
 const [first]=await replacement.install(source);assert.equal(await replacement.body(first.id),'Use the saved sources.');await assert.rejects(replacement.install(source),/review failed/);assert.equal(await replacement.body(first.id),'Use the saved sources.');assert.deepEqual(store.list(),[]);
});
test('discovers direct and skills child packages, with root package taking precedence',async t=>{
 const {store,temp}=await fixture(t);const source=await folder(path.join(temp,'bundle'),{'one/SKILL.md':markdown('one'),'skills/two/SKILL.md':markdown('two')});
 assert.deepEqual((await store.install(source)).map(m=>m.name),['one','two']);await fs.writeFile(path.join(source,'SKILL.md'),markdown('root'));assert.deepEqual((await store.install(source)).map(m=>m.name),['root']);
});
test('missing packages and more than twenty candidates are rejected before review',async t=>{
 let calls=0;const {store,temp}=await fixture(t,async()=>{calls++;return true;});const source=await folder(path.join(temp,'bundle'),{});await assert.rejects(store.install(source),/SKILL.md를 찾을 수 없습니다/);
 for(let i=0;i<21;i++)await folder(path.join(source,`skill-${i}`),{'SKILL.md':markdown(`skill-${i}`)});await assert.rejects(store.install(source),/20개/);assert.equal(calls,0);
});
test('folder symlinks, including a SKILL.md link and package directory link, are rejected',async t=>{
 const {store,temp}=await fixture(t);const source=await folder(path.join(temp,'package'),{'SKILL.md':markdown()});const outside=await folder(path.join(temp,'outside'),{'secret.txt':'secret'});
 await fs.symlink(path.join(outside,'secret.txt'),path.join(source,'leak'));await assert.rejects(store.install(source),/링크/);await fs.rm(path.join(source,'leak'));await fs.rm(path.join(source,'SKILL.md'));await fs.symlink(path.join(outside,'secret.txt'),path.join(source,'SKILL.md'));await assert.rejects(store.install(source),/링크/);
 const bundle=await folder(path.join(temp,'bundle'),{});await fs.symlink(source,path.join(bundle,'linked'));await assert.rejects(store.install(bundle),/링크/);assert.deepEqual(store.list(),[]);
});
test('per-package 500-file and 20 MiB limits reject before review',async t=>{
 const {store,temp}=await fixture(t);const source=await folder(path.join(temp,'package'),{'SKILL.md':markdown()});
 for(let i=0;i<500;i++)await fs.writeFile(path.join(source,`file-${i}`),'x');await assert.rejects(store.install(source),/파일 수/);
 await fs.rm(source,{recursive:true});await folder(source,{'SKILL.md':markdown()});const big=await fs.open(path.join(source,'big'),'w');await big.truncate(20*1024*1024);await big.close();await assert.rejects(store.install(source),/크기/);
});
test('ZIP installation accepts stored and deflated files and wrapper folders',async t=>{
 const {store,temp}=await fixture(t);const file=path.join(temp,'skill.zip');await fs.writeFile(file,zip([{name:'package/SKILL.md',body:markdown(),deflate:true},{name:'package/scripts/run.py',body:'print(1)'}]));
 const [meta]=await store.install(file);assert.equal(meta.source.kind,'zip');assert.equal(meta.files,2);assert.equal(await store.verify(meta.id),true);
});
test('ZIP traversal, absolute paths, backslashes and symlinks are rejected before writes',async t=>{
 const {store,temp}=await fixture(t);const file=path.join(temp,'bad.zip');
 for(const name of ['../escape','/absolute','C:/absolute','package/../../escape','package\\escape','package/./escape','package//escape']){
  await fs.writeFile(file,zip([{name:'SKILL.md',body:markdown()},{name,body:'bad'}]));await assert.rejects(store.install(file),/경로/);
 }
 for(const mode of [0o120777,0o010644,0o060644]){await fs.writeFile(file,zip([{name:'SKILL.md',body:markdown()},{name:'scripts/link',body:'../../outside',mode}]));await assert.rejects(store.install(file),/링크/);}
 assert.deepEqual(store.list(),[]);await assert.rejects(fs.stat(path.join(temp,'escape')));
});
test('ZIP header mismatches, duplicate paths, prefix conflicts, corruption and size bombs fail closed',async t=>{
 const {store,temp}=await fixture(t);const file=path.join(temp,'bad.zip');
 const bad=[zip([{name:'SKILL.md',localName:'../oops',body:markdown()}]),zip([{name:'SKILL.md',body:markdown()},{name:'skill.md',body:'duplicate'}]),zip([{name:'SKILL.md',body:markdown()},{name:'scripts',body:'file'},{name:'scripts/run.py',body:'x'}]),Buffer.from('not a zip')];
 const corrupt=zip([{name:'SKILL.md',body:markdown()}]);corrupt[30+'SKILL.md'.length]^=1;bad.push(corrupt);
 const oversized=zip([{name:'SKILL.md',body:markdown()}]);const central=oversized.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));oversized.writeUInt32LE(20*1024*1024+1,central+24);bad.push(oversized);
 for(const archive of bad){await fs.writeFile(file,archive);await assert.rejects(store.install(file));}assert.deepEqual(store.list(),[]);
});
test('tampering disables attachment and requires rehash plus fresh permission review',async t=>{
 let calls=0;const {store,temp,root}=await fixture(t,async meta=>{calls++;if(calls===2)assert.deepEqual(meta.permissions.tools,['code_run']);return true;});
 const source=await folder(path.join(temp,'package'),{'SKILL.md':markdown()});const [meta]=await store.install(source);
 await fs.writeFile(path.join(root,meta.id,'SKILL.md'),markdown('research','edited','allowed-tools: [code_run]\n'));assert.deepEqual(await store.bodies([meta.id]),[]);assert.equal(store.list()[0].error,'변경됨');assert.equal(store.list()[0].approved,false);assert.deepEqual(store.pick('research sources'),[]);
 const updated=await store.setEnabled(meta.id,true);assert.notEqual(updated.hash,meta.hash);assert.equal(updated.error,undefined);assert.equal(calls,2);assert.equal((await store.bodies([meta.id]))[0].text,'edited');
});
test('modification during reapproval and removed files remain disabled',async t=>{
 const {temp,root}=await fixture(t);let mutate=false,id='';const store=new SkillStore(root,{review:async()=>{if(mutate)await fs.writeFile(path.join(root,id,'SKILL.md'),markdown('research','raced'));return true;},legacy:()=>[],clearLegacy:()=>{}});await store.load();
 const source=await folder(path.join(temp,'package'),{'SKILL.md':markdown()});[ {id} ]=await store.install(source);await fs.writeFile(path.join(root,id,'SKILL.md'),markdown('research','edited'));mutate=true;
 assert.equal((await store.setEnabled(id,true)).error,'변경됨');assert.deepEqual(await store.bodies([id]),[]);await fs.rm(path.join(root,id,'SKILL.md'));await assert.rejects(store.setEnabled(id,true));assert.equal(store.list()[0].enabled,false);
});
test('auto-attach is deterministic, scores unique tokens, caps three and excludes disabled skills',async t=>{
 const {store}=await fixture(t);
 const z=await store.create({name:'zeta',description:'research sources compare',body:'z'});await store.create({name:'alpha',description:'research sources',body:'a'});await store.create({name:'beta',description:'research sources',body:'b'});await store.create({name:'gamma',description:'research sources',body:'g'});await store.create({name:'single',description:'research',body:'s'});
 assert.deepEqual(store.pick('research research sources compare',50).map(m=>m.name),['zeta','alpha','beta']);assert.deepEqual(store.pick('research').map(m=>m.name),[]);await store.setEnabled(z.id,false);assert.deepEqual(store.pick('research sources').map(m=>m.name),['alpha','beta','gamma']);assert.equal(store.pick('research sources',1).length,1);
});
test('manual bodies honor input order, deduplicate, cap three and truncate each body',async t=>{
 const {store}=await fixture(t);const ids=[];for(let i=0;i<4;i++)ids.push((await store.create({name:`skill-${i}`,description:'manual only',body:'x'.repeat(12000)})).id);
 const result=await store.bodies([ids[2],ids[2],ids[0],ids[1],ids[3]]);assert.deepEqual(result.map(m=>m.id),[ids[2],ids[0],ids[1]]);assert.ok(result.every(m=>m.text.length===10000));
});
test('scripts are copied as data, never executed, and repeated identical copies are safe',async t=>{
 const {store,temp}=await fixture(t);const marker=path.join(temp,'executed');const script=`require('node:fs').writeFileSync(${JSON.stringify(marker)},'executed')`;
 const source=await folder(path.join(temp,'package'),{'SKILL.md':markdown(),'scripts/run.js':script,'scripts/nested/data.txt':'support','references/private.txt':'not copied'});const [meta]=await store.install(source);const workspace=await folder(path.join(temp,'workspace'),{});
 await store.copyScripts([meta.id],workspace);await store.copyScripts([meta.id],workspace);assert.equal(await fs.readFile(path.join(workspace,'skills/research/run.js'),'utf8'),script);assert.equal(await fs.readFile(path.join(workspace,'skills/research/nested/data.txt'),'utf8'),'support');await assert.rejects(fs.stat(marker));await assert.rejects(fs.stat(path.join(workspace,'skills/research/references')));
});
test('script copy rejects workspace symlinks, conflicts and cumulative size above two MiB',async t=>{
 const {store,temp}=await fixture(t);const source=await folder(path.join(temp,'package'),{'SKILL.md':markdown(),'scripts/run.py':'print(1)'});const [meta]=await store.install(source);const workspace=await folder(path.join(temp,'workspace'),{}),outside=await folder(path.join(temp,'outside'),{});
 await fs.symlink(outside,path.join(workspace,'skills'));await assert.rejects(store.copyScripts([meta.id],workspace),/링크/);await fs.rm(path.join(workspace,'skills'));await folder(path.join(workspace,'skills/research'),{'run.py':'other'});await assert.rejects(store.copyScripts([meta.id],workspace),/다른 스크립트/);
 for(const [name,size] of [['first',1024*1024],['second',1024*1024+1]] as const){const dir=await folder(path.join(temp,name),{'SKILL.md':markdown(name),'scripts/big.py':Buffer.alloc(size)});await store.install(dir);}
 const largeIds=store.list().filter(m=>m.name!=='research').map(m=>m.id);const clean=await folder(path.join(temp,'clean'),{});await assert.rejects(store.copyScripts(largeIds,clean),/2 MB/);await assert.rejects(fs.stat(path.join(clean,'skills')));
});
test('tampered or denied scripts are not copied',async t=>{
 const {store,temp,root}=await fixture(t,async()=>false);const source=await folder(path.join(temp,'package'),{'SKILL.md':markdown(),'scripts/run.py':'print(1)'});const [meta]=await store.install(source);const workspace=await folder(path.join(temp,'workspace'),{});await store.copyScripts([meta.id],workspace);await assert.rejects(fs.stat(path.join(workspace,'skills')));
 const local=await store.create({name:'local',description:'local',body:'body'});await folder(path.join(root,local.id,'scripts'),{'run.py':'changed'});await store.copyScripts([local.id],workspace);assert.equal(store.list().find(m=>m.id===local.id)?.error,'변경됨');await assert.rejects(fs.stat(path.join(workspace,'skills')));
});
test('migration preserves duplicate prompts, clears legacy only after persistence and is idempotent',async t=>{
 const {temp}=await fixture(t);const root=path.join(temp,'migrating');let legacy=[{id:'old-1',title:'Saved',prompt:'first'},{id:'old-2',title:'saved',prompt:'second'},{id:'old-3',title:'../unsafe',prompt:'third'}],clears=0,reviews=0;
 const deps={review:async()=>{reviews++;return false;},legacy:()=>legacy,clearLegacy:()=>{clears++;legacy=[];}};const store=new SkillStore(root,deps);await store.load();
 assert.equal(clears,1);assert.equal(reviews,0);assert.deepEqual(store.list().map(m=>m.name),['Saved','saved-2','.._unsafe']);assert.ok(store.list().every(m=>m.source.kind==='legacy'&&m.approved&&m.enabled));assert.deepEqual(await Promise.all(store.list().map(m=>store.body(m.id))),['first','second','third']);const ids=store.list().map(m=>m.id);
 const again=new SkillStore(root,deps);await again.load();assert.deepEqual(again.list().map(m=>m.id),ids);assert.deepEqual(legacy,[]);assert.equal(await fs.readFile(path.join(root,'.migrated'),'utf8'),'1');
});
test('migration recovers after legacy clearing fails without duplicating saved prompts',async t=>{
 const {temp}=await fixture(t);const root=path.join(temp,'migration-failure');let fail=true,legacy=[{id:'one',title:'one',prompt:'body'}];const deps={review:async()=>true,legacy:()=>legacy,clearLegacy:()=>{if(fail)throw new Error('save failed');legacy=[];}};
 const store=new SkillStore(root,deps);await assert.rejects(store.load(),/save failed/);assert.equal(store.list().length,1);fail=false;const next=new SkillStore(root,deps);await next.load();assert.equal(next.list().length,1);assert.deepEqual(legacy,[]);
});
test('partial migration resumes using legacy IDs and does not overwrite existing names',async t=>{
 const {temp}=await fixture(t);const root=path.join(temp,'partial');let legacy=[{id:'one',title:'same',prompt:'body'},{id:'two',title:'same',prompt:'second'}];const deps={review:async()=>true,legacy:()=>legacy,clearLegacy:()=>{legacy=[];}};
 const store=new SkillStore(root,deps);await store.load();const first=store.list()[0];await store.remove(store.list()[1].id);await fs.rm(path.join(root,'.migrated'));legacy=[{id:'one',title:'same',prompt:'body'},{id:'two',title:'same',prompt:'second'}];const next=new SkillStore(root,deps);await next.load();assert.equal(next.list().length,2);assert.equal(next.list()[0].id,first.id);assert.deepEqual(next.list().map(m=>m.name),['same','same-2']);
});
test('local creation and deletion persist across reloads; serialized replacements retain one ID',async t=>{
 const {store,root}=await fixture(t);const [a,b]=await Promise.all([store.create({name:'same',description:'first',body:'first'}),store.create({name:'same',description:'second',body:'second'})]);assert.equal(a.id,b.id);assert.equal(store.list().length,1);
 const next=new SkillStore(root,{review:async()=>false,legacy:()=>[],clearLegacy:()=>{}});await next.load();assert.equal(await next.body(a.id),'second');await next.remove(a.id);assert.deepEqual(next.list(),[]);await assert.rejects(fs.stat(path.join(root,a.id)));await assert.rejects(next.body('../escape'));
});
test('git installs use isolated configuration and never execute checkout hooks or filters',async t=>{
 const {store,temp}=await fixture(t);const repo=await folder(path.join(temp,'repository.git'),{'SKILL.md':markdown(),'.gitattributes':'SKILL.md filter=malicious'}),hooks=await folder(path.join(temp,'hooks'),{}),marker=path.join(temp,'hook-ran');
 await fs.writeFile(path.join(hooks,'post-checkout'),`#!/bin/sh\ntouch '${marker}'\n`,{mode:0o700});
 await exec('git',['init',repo]);await exec('git',['-C',repo,'add','.']);await exec('git',['-C',repo,'-c','user.name=Test','-c','user.email=test@example.com','-c',`core.hooksPath=${os.devNull}`,'commit','-m','fixture']);
 const config=path.join(temp,'gitconfig');await fs.writeFile(config,`[core]\n hooksPath = ${hooks}\n[filter "malicious"]\n smudge = touch '${marker}'\n`);
 const previous=process.env.GIT_CONFIG_GLOBAL;process.env.GIT_CONFIG_GLOBAL=config;
 try{const [meta]=await store.install(pathToFileURL(repo).href);assert.equal(meta.source.kind,'git');assert.equal(meta.approved,true);assert.equal(await store.body(meta.id),'Use the saved sources.');await assert.rejects(fs.stat(marker));}
 finally{if(previous===undefined)delete process.env.GIT_CONFIG_GLOBAL;else process.env.GIT_CONFIG_GLOBAL=previous;}
});
