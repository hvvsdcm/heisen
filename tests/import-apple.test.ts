import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {execFileSync} from 'node:child_process';
import {registerHooks} from 'node:module';
import type {Data,Secrets} from '../src/data.ts';
import type {BrowserWindow,Session} from 'electron';
import {chromiumRoots} from '../src/platform.ts';
import {detectSources,withCopy,type ImportedCookie} from '../src/importer.ts';
import {parsePlistXml,readSafariBookmarks,readSafariHistory,firefoxProfiles,readFirefoxBookmarks,readFirefoxHistory,readFirefoxCookies,fullDiskAccessDenied} from '../src/importer-apple.ts';
function fixture(t:test.TestContext){const root=fs.mkdtempSync(path.join(os.tmpdir(),'heisen-apple-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
const PLIST=`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>Children</key><array>
<dict><key>WebBookmarkType</key><string>WebBookmarkTypeList</string><key>Children</key><array>
<dict><key>WebBookmarkType</key><string>WebBookmarkTypeLeaf</string><key>URLString</key><string>https://example.test/?a=1&amp;b=2</string><key>URIDictionary</key><dict><key>title</key><string>한글 &amp; &#x1f600;</string></dict></dict>
<dict><key>WebBookmarkType</key><string>WebBookmarkTypeLeaf</string><key>URLString</key><string>javascript:alert(1)</string></dict>
</array></dict>
<dict><key>WebBookmarkType</key><string>WebBookmarkTypeLeaf</string><key>URLString</key><string>https://example.test/?a=1&amp;b=2</string></dict>
<dict><key>WebBookmarkType</key><string>WebBookmarkTypeLeaf</string><key>URLString</key><string>http://other.test/</string></dict>
</array></dict></plist>`;
function safariFixture(home:string){
 const dir=path.join(home,'Library','Safari');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'Bookmarks.plist'),PLIST);
 const db=new DatabaseSync(path.join(dir,'History.db'));db.exec(`CREATE TABLE history_items(id INTEGER PRIMARY KEY,url TEXT);CREATE TABLE history_visits(history_item INTEGER,title TEXT,visit_time REAL);
 INSERT INTO history_items VALUES (1,'https://example.test/'),(2,'http://older.test/'),(3,'file:///private/secret');
 INSERT INTO history_visits VALUES (1,'Old title',1),(1,'Latest title',100.25),(2,NULL,0),(3,'Private',200);`);db.close();return dir;
}
function firefoxFixture(base:string){
 const profile=path.join(base,'Profiles','default');fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(path.join(base,'profiles.ini'),'[Profile0]\nName=Firefox fixture\nIsRelative=1\nPath=Profiles/default\nDefault=1\n');
 const db=new DatabaseSync(path.join(profile,'places.sqlite'));db.exec(`CREATE TABLE moz_places(id INTEGER PRIMARY KEY,url TEXT,title TEXT,last_visit_date INTEGER);
 CREATE TABLE moz_bookmarks(id INTEGER PRIMARY KEY,type INTEGER,fk INTEGER,title TEXT);
 INSERT INTO moz_places VALUES (1,'https://example.test/','Newest',1700000000123456),(2,'http://older.test/','Older',1600000000000000),(3,'place:sort=8','Query',1800000000000000),(4,'https://unvisited.test/',NULL,NULL);
 INSERT INTO moz_bookmarks VALUES (1,1,1,'Bookmark'),(2,1,1,'Duplicate'),(3,2,2,'Folder'),(4,1,3,'Query'),(5,1,4,NULL);`);db.close();
 const cookies=new DatabaseSync(path.join(profile,'cookies.sqlite'));cookies.exec(`CREATE TABLE moz_cookies(host TEXT,name TEXT,value TEXT,path TEXT,expiry INTEGER,isSecure INTEGER,isHttpOnly INTEGER,sameSite INTEGER,originAttributes TEXT);
 INSERT INTO moz_cookies VALUES ('.example.test','secure','secret','/account',2000000000,1,1,2,''),('example.test','lax','light','/',2000000000,0,0,1,''),('example.test','none','','/',2000000000,1,0,0,''),('example.test','expired','old','/',1,0,0,0,''),('example.test','container','private','/',2000000000,1,0,0,'^userContextId=1'),('example.test','partition','private','/',2000000000,1,0,0,'^partitionKey=%28https%2Cother.test%29');`);cookies.close();return profile;
}
test('plist token scanner handles types, entities, empty tags, comments and safe dict keys',()=>{
 const value=parsePlistXml(`<plist version="1.0"><dict><!-- note --><key>text</key><string>&lt;&gt;&amp;&quot;&apos;&#65;&#x1f600;</string><key>values</key><array><integer>-42</integer><real>1.25e2</real><true/><false></false><string/><dict/><array/><date>2020-01-02T03:04:05Z</date><data> aGVs\nbG8= </data></array><key>__proto__</key><string>safe</string></dict></plist>`) as Record<string,unknown>;
 assert.equal(value.text,'<>&"\'A😀');assert.equal(value.__proto__,'safe');assert.equal(Object.getPrototypeOf(value),Object.prototype);
 assert.deepEqual(value.values,[-42,125,true,false,'',{},[],new Date('2020-01-02T03:04:05Z'),Buffer.from('hello')]);
 assert.ok(parsePlistXml(PLIST));
 for(const xml of ['<plist><dict><key>x</key></dict></plist>','<plist><string>&unknown;</string></plist>','<plist><array></dict></plist>','<plist><integer>NaN</integer></plist>','<plist><real/></plist>','<plist><date>bad</date></plist>','<plist><uid>1</uid></plist>','<plist><string>ok</string></plist>junk','<!DOCTYPE plist [<!ENTITY x SYSTEM "file:///etc/passwd">]><plist><string>&x;</string></plist>'])assert.throws(()=>parsePlistXml(xml),/Invalid plist/);
});
test('Safari bookmarks convert binary plists and flatten unique web leaves',{skip:process.platform!=='darwin'},async t=>{
 const home=fixture(t),dir=safariFixture(home);assert.deepEqual(await readSafariBookmarks(home),[{title:'한글 & 😀',url:'https://example.test/?a=1&b=2'},{title:'',url:'http://other.test/'}]);
 execFileSync('/usr/bin/plutil',['-convert','binary1',path.join(dir,'Bookmarks.plist')]);
 assert.equal((await readSafariBookmarks(home)).length,2);assert.deepEqual(await readSafariBookmarks(path.join(home,'missing')),[]);
});
test('Safari history uses latest visit titles, Apple epoch, limits and WAL snapshots',t=>{
 const home=fixture(t),dir=safariFixture(home),file=path.join(dir,'History.db');
 assert.deepEqual(readSafariHistory(home),[{title:'Latest title',url:'https://example.test/',at:978307300250},{title:'',url:'http://older.test/',at:978307200000}]);
 assert.equal(readSafariHistory(home,1).length,1);assert.deepEqual(readSafariHistory(home,0),[]);assert.deepEqual(readSafariHistory(path.join(home,'missing')),[]);
 const db=new DatabaseSync(file);try{db.exec("PRAGMA journal_mode=WAL;PRAGMA wal_autocheckpoint=0;INSERT INTO history_visits VALUES (1,'WAL title',500)");const before=fs.readFileSync(file),wal=fs.readFileSync(file+'-wal');assert.equal(readSafariHistory(home,1)[0].title,'WAL title');assert.deepEqual(fs.readFileSync(file),before);assert.deepEqual(fs.readFileSync(file+'-wal'),wal);}finally{db.close();}
});
test('Firefox profiles honor relative/absolute paths, names and Default ordering',t=>{
 const base=fixture(t),absolute=path.join(base,'absolute');for(const dir of ['relative','absolute','another'])fs.mkdirSync(path.join(base,dir));
 fs.writeFileSync(path.join(base,'profiles.ini'),`;comment\r\n[General]\r\nStartWithLastProfile=1\r\n[Profile0]\r\nName=Work\r\nIsRelative=1\r\nPath=relative\r\n[Profile1]\r\nName=Primary\r\nIsRelative=0\r\nPath=${absolute}\r\nDefault=1\r\n[Profile2]\nPath=missing\n[Profile3]\nPath=another\n[Profile4]\nPath=relative\n[Install123]\nDefault=relative\n`);
 assert.deepEqual(firefoxProfiles(base),[{dir:absolute,name:'Primary',path:absolute},{dir:'relative',name:'Work',path:path.join(base,'relative')},{dir:'another',name:'another',path:path.join(base,'another')}]);assert.deepEqual(firefoxProfiles(path.join(base,'missing')),[]);
});
test('Firefox places readers filter internal URLs, duplicate bookmarks and unvisited pages',t=>{
 const root=fixture(t),profile=firefoxFixture(root);
 assert.deepEqual(readFirefoxBookmarks(profile),[{title:'Bookmark',url:'https://example.test/'},{title:'',url:'https://unvisited.test/'}]);
 assert.deepEqual(readFirefoxHistory(profile),[{title:'Newest',url:'https://example.test/',at:1700000000123.456},{title:'Older',url:'http://older.test/',at:1600000000000}]);assert.equal(readFirefoxHistory(profile,1).length,1);
 const file=path.join(profile,'places.sqlite'),db=new DatabaseSync(file);try{db.exec("PRAGMA journal_mode=WAL;PRAGMA wal_autocheckpoint=0;UPDATE moz_places SET title='WAL history' WHERE id=1");assert.equal(readFirefoxHistory(profile)[0].title,'WAL history');}finally{db.close();}
 assert.deepEqual(readFirefoxBookmarks(path.join(root,'missing')),[]);assert.deepEqual(readFirefoxHistory(path.join(root,'missing')),[]);
});
test('Firefox cookies preserve domain/security/SameSite and omit expired or isolated jars',t=>{
 const root=fixture(t),profile=firefoxFixture(root),read=readFirefoxCookies(profile,1700000000000);
 assert.equal(read.failed,0);assert.equal(read.items.length,3);assert.deepEqual(read.items[0],{url:'https://example.test/account',name:'secure',value:'secret',domain:'.example.test',path:'/account',secure:true,httpOnly:true,expirationDate:2000000000,sameSite:'strict'});
 assert.deepEqual(read.items.map(c=>c.sameSite),['strict','lax','no_restriction']);assert.equal(read.items[1].domain,undefined);assert.equal(read.items[1].secure,false);
 assert.deepEqual(readFirefoxCookies(profile,2100000000000),{items:[],failed:0});assert.deepEqual(readFirefoxCookies(path.join(root,'missing')),{items:[],failed:0});
 const db=new DatabaseSync(path.join(profile,'cookies.sqlite'));try{db.exec("ALTER TABLE moz_cookies DROP COLUMN sameSite;ALTER TABLE moz_cookies DROP COLUMN originAttributes");}finally{db.close();}assert.equal(readFirefoxCookies(profile,1700000000000).items[0].sameSite,'unspecified');
});
test('source discovery exposes capabilities and never hides Safari permission denials',t=>{
 const home=fixture(t),base=path.join(home,'Library','Application Support');fs.mkdirSync(base,{recursive:true});safariFixture(home);firefoxFixture(process.platform==='win32'?path.join(base,'Mozilla','Firefox'):path.join(base,'Firefox'));
 const roots={...chromiumRoots(),base},sources=detectSources(roots),firefox=sources.find(s=>s.browser==='firefox');assert.equal(firefox?.kind,'firefox');assert.deepEqual(firefox?.can,{passwords:false,cookies:true});
 if(process.platform==='darwin'){
  assert.deepEqual(sources.find(s=>s.browser==='safari')?.can,{passwords:false,cookies:false});const original=fs.statSync;
  t.mock.method(fs,'statSync',((file:fs.PathLike,...args:unknown[])=>{if(file===path.join(home,'Library','Safari','Bookmarks.plist'))throw Object.assign(new Error('denied'),{code:'EPERM'});return Reflect.apply(original,fs,[file,...args]);}) as typeof fs.statSync);
  assert.ok(detectSources(roots).some(s=>s.browser==='safari'));
 }
});
test('permission classification is limited to OS permission errors',()=>{
 assert.equal(fullDiskAccessDenied({code:'EPERM'}),true);assert.equal(fullDiskAccessDenied({code:'EACCES'}),true);for(const error of [null,'EPERM',{code:1},{code:'ENOENT'},new Error('EPERM')])assert.equal(fullDiskAccessDenied(error),false);
});
test('SQLite temporary copies are removed even when a reader fails',t=>{
 const root=fixture(t),file=path.join(root,'bad.sqlite');fs.writeFileSync(file,'not sqlite');let copyDir='';const original=fs.mkdtempSync;
 t.mock.method(fs,'mkdtempSync',((...args:Parameters<typeof fs.mkdtempSync>)=>{const dir=Reflect.apply(original,fs,args);copyDir=String(dir);return dir;}) as typeof fs.mkdtempSync);
 assert.throws(()=>withCopy(file,db=>db.prepare('SELECT * FROM missing').all()));assert.ok(copyDir);assert.equal(fs.existsSync(copyDir),false);
});
test('import RPC integrates Firefox/Safari without keychain and exposes FDA settings',{skip:process.platform!=='darwin'},async t=>{
 const home=fixture(t),base=path.join(home,'Library','Application Support');fs.mkdirSync(base,{recursive:true});safariFixture(home);firefoxFixture(path.join(base,'Firefox'));
 // Intentionally exercise the Electron module boundary with an in-process RPC transport, not a real app/profile.
 const electronUrl='data:text/javascript,'+encodeURIComponent('export const handlers={};export const ipcMain={handle:(name,fn)=>handlers[name]=fn};export const dialog={},clipboard={},systemPreferences={},shell={openExternal:async url=>url};');
 const hooks=registerHooks({resolve(specifier,context,next){return specifier==='electron'?{url:electronUrl,shortCircuit:true}:next(specifier,context);}});t.after(()=>hooks.deregister());
 const {Passwords}=await import('../src/passwords.ts'),{installRpc,registerRpc,callerWindow}=await import('../src/rpc.ts'),electron=await import(electronUrl);
 const state={bookmarks:[],history:[],imports:[],settings:{vault:false}},cookies:ImportedCookie[]=[];let saved=0;
 const data={state,save:()=>saved++} as unknown as Data,secrets={get:()=>{throw new Error('Unexpected secret/keychain access');}} as unknown as Secrets;
 const win={isDestroyed:()=>false,webContents:{mainFrame:{url:'heisen://ui'}}} as unknown as BrowserWindow;
 const passwords=new Passwords({data,secrets,win,appSupport:base,changed:()=>{},session:{cookies:{set:async(c:ImportedCookie)=>{cookies.push(c);},flushStore:async()=>{}}} as unknown as Session,readKeychain:async()=>{throw new Error('Unexpected keychain');},confirmKeychain:async()=>{throw new Error('Unexpected keychain prompt');}});
 const second={isDestroyed:()=>false,webContents:{mainFrame:{url:'heisen://ui'}}} as unknown as BrowserWindow;
 passwords.install();installRpc('heisen://ui',m=>m!=='test.denied',wc=>wc===win.webContents?win:wc===second.webContents?second:undefined);const event={sender:win.webContents,senderFrame:win.webContents.mainFrame};
 const rpc=(method:string,args={})=>electron.handlers['heisen:rpc'](event,{method,args});
 const gates=[Promise.withResolvers<void>(),Promise.withResolvers<void>()];
 registerRpc({'test.caller':async a=>{const before=callerWindow();await gates[a.index].promise;assert.equal(callerWindow(),before);return before===win?'first':'second';},'test.denied':()=>true});
 const dispatch=electron.handlers['heisen:rpc'];
 const firstCall=rpc('test.caller',{index:0}),secondCall=dispatch({sender:second.webContents,senderFrame:second.webContents.mainFrame},{method:'test.caller',args:{index:1}});
 gates[1].resolve();assert.equal(await secondCall,'second');gates[0].resolve();assert.equal(await firstCall,'first');
 assert.equal(callerWindow(),undefined);
 await assert.rejects(dispatch({sender:{},senderFrame:win.webContents.mainFrame},{method:'test.caller'}),/Unauthorized caller/);
 Reflect.set(win.webContents.mainFrame,'url','https://untrusted.example/');
 await assert.rejects(rpc('test.caller',{index:0}),/Unauthorized caller/);
 Reflect.set(win.webContents.mainFrame,'url','heisen://ui');
 await assert.rejects(dispatch({sender:win.webContents,senderFrame:{url:'heisen://ui'}},{method:'test.caller'}),/Unauthorized caller/);
 await assert.rejects(rpc('test.denied'),/로그인이 필요/);
 const sources=await rpc('import.sources');assert.deepEqual(sources.find((s:{browser:string})=>s.browser==='firefox').can,{passwords:false,cookies:true});
 assert.equal(await rpc('import.openFullDisk'),'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
 const result=await rpc('import.run',{browser:'firefox',profile:'Profiles/default',items:['passwords','cookies','bookmarks','history']});assert.deepEqual(result,{cookies:{imported:3,failed:0},bookmarks:2,history:2});assert.equal(cookies.length,3);assert.equal(state.imports.length,0);assert.equal(saved,1);
 assert.deepEqual(await rpc('import.run',{browser:'safari',profile:'.',items:['passwords','cookies']}),{});
 const safari=await rpc('import.run',{browser:'safari',profile:'.',items:['bookmarks','history']});assert.equal(safari.bookmarks,2);assert.equal(safari.history,2);
 const original=fs.openSync;t.mock.method(fs,'openSync',((file:fs.PathLike,...args:unknown[])=>{if(file===path.join(home,'Library','Safari','Bookmarks.plist'))throw Object.assign(new Error('denied'),{code:'EPERM'});return Reflect.apply(original,fs,[file,...args]);}) as typeof fs.openSync);
 await assert.rejects(rpc('import.run',{browser:'safari',profile:'.',items:['bookmarks']}),{message:'시스템 설정 > 개인정보 보호 및 보안 > 전체 디스크 접근 권한에서 Heisen을 허용하세요.'});
});
