import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {EventEmitter} from 'node:events';
import type {WebContents} from 'electron';
import {SafeBrowsing,LISTS,NEVER_BLOCK,hostHash,parseDomains,candidates} from '../src/safebrowsing.ts';
import type {Data} from '../src/data.ts';

function fixture(t:test.TestContext,fetchImpl:typeof fetch){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'heisen-safe-'));
 const data={state:{settings:{safeBrowsing:{enabled:true}}}} as Data;
 const safe=new SafeBrowsing(root,data,fetchImpl);
 t.after(()=>{safe.close();fs.rmSync(root,{recursive:true,force:true});});
 return {root,data,safe};
}
function request(url:string,resourceType='mainFrame',webContentsId=1){return {url,resourceType,webContentsId} as Electron.OnBeforeRequestListenerDetails;}
function contents(id=1):WebContents{return Object.assign(new EventEmitter(),{id}) as unknown as WebContents;}

test('parses domain lists without accepting URLs, wildcards, malformed labels or hosts-file aliases',()=>{
 assert.deepEqual(parseDomains('# comment\n\n0.0.0.0 EVIL.Example.COM.\r\nevil.example.com\nsafe.example # comment\nbücher.example\nhttps://evil.test\n*.evil.test\nuser@evil.test\nevil.test:80\n0.0.0.0 bad.test alias.test\n-bad.test\nbad-.test\nbad..test\nbad_test\ncom\n999.999.999.999\n'),['evil.example.com','safe.example','xn--bcher-kva.example']);
 assert.deepEqual(candidates('A.B.C.D.'),['a.b.c.d','b.c.d','c.d']);assert.deepEqual(candidates('localhost'),[]);assert.deepEqual(candidates('8.8.8.8'),['8.8.8.8']);
});
test('host hashes use the first SHA-256 bytes as exact signed 64-bit integers',()=>{
 assert.equal(hostHash('abc'),BigInt.asIntN(64,0xba7816bf8f01cfean));
 assert.equal(hostHash('hello'),0x2cf24dba5fb0a30en);
});
test('stores only integer hashes and membership bits with stable list precedence',async t=>{
 const {safe,root}=fixture(t,async()=>new Response('abc.test\nhello.test'));
 await safe.update();
 const db=new DatabaseSync(path.join(root,'safebrowsing.sqlite'));
 try{
 assert.equal(db.prepare('PRAGMA user_version').get()?.user_version,1);
 assert.deepEqual(db.prepare('PRAGMA table_info(hosts)').all().map(row=>[row.name,row.type,row.pk]),[['hash','INTEGER',1],['lists','INTEGER',0]]);
 assert.equal(db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE name='sources'").get()?.count,0);
 const lookup=db.prepare('SELECT hash,lists,typeof(hash) AS type FROM hosts WHERE hash=?');lookup.setReadBigInts(true);
 for(const host of ['abc.test','hello.test']){
  const row=lookup.get(hostHash(host));assert.equal(row?.hash,hostHash(host));assert.equal(row?.lists,63n);assert.equal(row?.type,'integer');
  assert.deepEqual(safe.check(host),{listed:true,list:LISTS[0].id});
 }
 assert.equal(safe.status().hosts,2);
 }finally{db.close();}
});
test('migrates legacy text tables, reclaims pages and refetches without stale ETags',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'heisen-safe-migrate-'));
 let safe:SafeBrowsing|undefined,offline:SafeBrowsing|undefined,migrated:DatabaseSync|undefined;
 // after hooks run in registration order; close every handle before removing files.
 t.after(()=>{migrated?.close();offline?.close();safe?.close();fs.rmSync(root,{recursive:true,force:true});});
 const file=path.join(root,'safebrowsing.sqlite'),db=new DatabaseSync(file);
 try{
 db.exec('CREATE TABLE hosts(host TEXT PRIMARY KEY,list TEXT NOT NULL) WITHOUT ROWID; CREATE TABLE sources(list TEXT NOT NULL,host TEXT NOT NULL,PRIMARY KEY(list,host)) WITHOUT ROWID; CREATE TABLE meta(id TEXT PRIMARY KEY,etag TEXT,at INTEGER,count INTEGER)');
 db.prepare('INSERT INTO hosts VALUES(?,?)').run('legacy.test',LISTS[0].id);
 db.prepare('INSERT INTO sources VALUES(?,?)').run(LISTS[0].id,'legacy.test');
 for(const list of LISTS)db.prepare('INSERT INTO meta VALUES(?,?,?,?)').run(list.id,'"stale"',Date.now(),1);
 // Leave free pages behind to prove the one-time migration actually compacts the file.
 db.exec('CREATE TABLE padding(value BLOB); INSERT INTO padding VALUES(zeroblob(1048576)); DROP TABLE padding');
 }finally{db.close();}
 const oldSize=fs.statSync(file).size,calls:RequestInit[]=[];
 const data={state:{settings:{safeBrowsing:{enabled:true}}}} as Data;
 safe=new SafeBrowsing(root,data,async(_url,options)=>{calls.push(options!);return new Response('fresh.test',{headers:{etag:'"new"'}});});
 assert.deepEqual(safe.status(),{updatedAt:0,hosts:0});assert.equal(safe.check('legacy.test').listed,false);assert.ok(fs.statSync(file).size<oldSize);
 await safe.update();assert.equal(calls.length,LISTS.length);for(const call of calls)assert.deepEqual(call.headers,{});
 assert.deepEqual(safe.check('fresh.test'),{listed:true,list:LISTS[0].id});safe.close();
 offline=new SafeBrowsing(root,data,async()=>{throw new Error('must not refetch');});
 assert.equal(offline.status().hosts,1);assert.equal(offline.check('fresh.test').listed,true);await offline.update();
 migrated=new DatabaseSync(file);
 assert.equal(migrated.prepare('PRAGMA freelist_count').get()?.freelist_count,0);
 assert.equal(migrated.prepare('SELECT count(*) AS count FROM meta WHERE etag=?').get('"new"')?.count,LISTS.length);
});
test('downloads only fixed feeds, caches ETags for twelve hours and reopens fully offline',async t=>{
 const calls:{url:string;options:RequestInit|undefined}[]=[];let cached=false;
 const fetcher:typeof fetch=async(url,options)=>{calls.push({url:String(url),options});return cached?new Response(null,{status:304}):new Response('evil.example.com\n',{headers:{etag:'"fixture"'}});};
 const {root,data,safe}=fixture(t,fetcher);assert.deepEqual(safe.status(),{updatedAt:0,hosts:0});assert.deepEqual(safe.check('evil.example.com'),{listed:false});
 await safe.update();assert.equal(calls.length,LISTS.length);assert.deepEqual(calls.map(c=>c.url),LISTS.map(l=>l.url));
 assert.equal(safe.check('evil.example.com').listed,true);assert.equal(safe.check('sub.evil.example.com').listed,true);assert.equal(safe.check('example.com').listed,false);assert.equal(safe.check('notevil.example.com').listed,false);
 assert.equal(safe.status().hosts,1);assert.ok(safe.status().updatedAt>0);
 safe.allowOnce(contents(),'EVIL.EXAMPLE.COM.');assert.equal(safe.isAllowed(1,'evil.example.com'),true);assert.equal(safe.isAllowed(1,'sub.evil.example.com'),false);
 await safe.update();assert.equal(calls.length,LISTS.length);cached=true;await safe.update(true);assert.equal(calls.length,LISTS.length*2);
 for(const call of calls.slice(LISTS.length)){assert.deepEqual(call.options?.headers,{'If-None-Match':'"fixture"'});assert.equal(call.options?.credentials,'omit');assert.equal(call.options?.redirect,'error');assert.ok(call.options?.signal);}
 safe.close();const offline=new SafeBrowsing(root,data,async()=>{throw new Error('offline');});
 try{assert.equal(offline.check('evil.example.com').listed,true);assert.equal(offline.isAllowed(1,'evil.example.com'),false);}
 finally{offline.close();}
});
test('never blocks trusted names or local addresses, and respects the setting',async t=>{
 const {safe,root,data}=fixture(t,async()=>new Response('evil.test'));
 const db=new DatabaseSync(path.join(root,'safebrowsing.sqlite'));
 const hosts=[...NEVER_BLOCK,'x.heisen.dev','x.localhost','printer.local','10.0.0.1','127.0.0.2','172.16.1.2','172.31.255.254','192.168.1.2','169.254.1.2','[::1]','[fd00::1]','[fe80::1]','[::ffff:7f00:1]','evil.test','heisen.dev.evil.test'];
 const insert=db.prepare('INSERT INTO hosts VALUES(?,?)');insert.setReadBigInts(true);
 for(const host of hosts)insert.run(hostHash(host),1);db.close();
 for(const host of hosts.slice(0,-2))assert.equal(safe.check(host).listed,false,host);
 assert.equal(safe.check('evil.test').listed,true);assert.equal(safe.check('heisen.dev.evil.test').listed,true);
 data.state.settings.safeBrowsing.enabled=false;assert.equal(safe.check('evil.test').listed,false);
});
test('overlapping memberships survive source removal and stale rows are removed',async t=>{
 let phase=0;
 const {safe}=fixture(t,async url=>new Response(String(url)===LISTS[0].url?(phase?'replacement.test':'shared.test\nremoved.test'):(phase===2?'other.test':'shared.test')));
 await safe.update();assert.deepEqual(safe.check('shared.test'),{listed:true,list:LISTS[0].id});assert.equal(safe.status().hosts,2);phase=1;await safe.update(true);
 assert.deepEqual(safe.check('shared.test'),{listed:true,list:LISTS[1].id});assert.equal(safe.check('removed.test').listed,false);assert.equal(safe.check('replacement.test').listed,true);assert.equal(safe.status().hosts,2);
 phase=2;await safe.update(true);assert.equal(safe.check('shared.test').listed,false);assert.deepEqual(safe.check('other.test'),{listed:true,list:LISTS[1].id});assert.equal(safe.status().hosts,2);
});
test('offline, invalid, empty and oversized responses preserve last good data and ETags',async t=>{
 t.mock.method(console,'error',()=>{});let mode='good';
 const {safe,root}=fixture(t,async()=>{if(mode==='offline')throw new Error('offline');if(mode==='status')return new Response('failure',{status:503});if(mode==='oversize')return new Response('evil.test',{headers:{'content-length':String(65*1024*1024)}});return new Response(mode==='good'?'evil.test':'# unavailable',{headers:{etag:mode}});});
 await safe.update();const before=safe.status();
 for(const failure of ['offline','status','oversize','empty']){mode=failure;await safe.update(true);assert.deepEqual(safe.status(),before);assert.equal(safe.check('evil.test').listed,true);}
 const db=new DatabaseSync(path.join(root,'safebrowsing.sqlite'));assert.equal(db.prepare('SELECT etag FROM meta LIMIT 1').get()?.etag,'good');db.close();
});
test('transaction failure rolls back membership, hosts and metadata',async t=>{
 t.mock.method(console,'error',()=>{});let body='evil.test';const {safe,root}=fixture(t,async()=>new Response(body));await safe.update();
 const db=new DatabaseSync(path.join(root,'safebrowsing.sqlite'));db.exec("CREATE TRIGGER reject_update BEFORE INSERT ON meta BEGIN SELECT RAISE(ABORT,'fixture'); END");
 body='new.test';await safe.update(true);assert.equal(safe.check('evil.test').listed,true);assert.equal(safe.check('new.test').listed,false);db.close();
});
test('expired metadata refreshes while concurrent updates share one request sequence',async t=>{
 let count=0;const {safe,root}=fixture(t,async()=>{count++;return new Response('evil.test');});
 const first=safe.update();assert.equal(first,safe.update(true));await first;assert.equal(count,LISTS.length);
 const db=new DatabaseSync(path.join(root,'safebrowsing.sqlite'));db.prepare('UPDATE meta SET at=?').run(Date.now()-13*60*60*1000);db.close();await safe.update();assert.equal(count,LISTS.length*2);
});
test('Shield blocks frames, only warns for main frames and never extends user exceptions to agents',async t=>{
 const {safe}=fixture(t,async()=>new Response('evil.test'));await safe.update();const blocked:unknown[]=[];
 const rule=safe.rule((...args)=>blocked.push(args),id=>id===1);
 assert.deepEqual(rule.before?.(request('https://evil.test/secret?q=private')),{cancel:true});assert.deepEqual(blocked,[[1,'https://evil.test/secret?q=private',LISTS[0].name]]);
 assert.deepEqual(rule.before?.(request('https://evil.test/frame','subFrame')),{cancel:true});assert.equal(blocked.length,1);
 assert.equal(rule.before?.(request('https://evil.test/a.js','script')),undefined);assert.equal(rule.before?.(request('file:///evil.test')),undefined);
 safe.allowOnce(contents(),'evil.test');assert.equal(rule.before?.(request('https://evil.test')),undefined);
 assert.deepEqual(rule.before?.(request('https://evil.test','mainFrame',2)),{cancel:true});assert.equal(blocked.length,2);
 assert.deepEqual(rule.before?.(request('https://sub.evil.test')),{cancel:true});
 assert.deepEqual(rule.before?.(request('https://evil.test','subFrame')),{cancel:true});
 assert.deepEqual(safe.rule(()=>{}).before?.(request('https://evil.test','mainFrame',3)),{cancel:true});
});
test('allow once stays in its tab until navigation away and never survives destruction',async t=>{
 const {safe}=fixture(t,async()=>new Response('evil.test'));await safe.update();const wc=contents(),rule=safe.rule(()=>{});
 safe.allowOnce(wc,'evil.test');
 wc.emit('did-start-navigation',{isMainFrame:true,isSameDocument:false,url:'https://evil.test/'});
 assert.equal(rule.before?.(request('https://evil.test/')),undefined);
 wc.emit('did-start-navigation',{isMainFrame:false,isSameDocument:false,url:'https://elsewhere.test/'});
 wc.emit('did-start-navigation',{isMainFrame:true,isSameDocument:true,url:'https://evil.test/#fragment'});
 assert.equal(safe.isAllowed(1,'evil.test'),true);
 wc.emit('did-start-navigation',{isMainFrame:true,isSameDocument:false,url:'https://elsewhere.test/'});
 assert.deepEqual(rule.before?.(request('https://evil.test/')),{cancel:true});
 safe.allowOnce(wc,'evil.test');assert.equal(wc.listenerCount('did-start-navigation'),1);
 wc.emit('destroyed');assert.equal(safe.isAllowed(1,'evil.test'),false);
});
test('closing aborts an in-flight update, stops schedules, and is idempotent',async t=>{
 let signal:AbortSignal|undefined;const {safe}=fixture(t,async(_url,options)=>{signal=options?.signal??undefined;return await new Promise<Response>((_resolve,reject)=>signal?.addEventListener('abort',()=>reject(new Error('closed')),{once:true}));});
 safe.schedule();safe.schedule();const update=safe.update();safe.close();safe.close();await update;assert.equal(signal?.aborted,true);await safe.update();assert.deepEqual(safe.status(),{updatedAt:0,hosts:0});
});
