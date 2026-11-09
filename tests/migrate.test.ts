import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {deriveKey,encryptV10,keychainReader} from '../src/chromium-crypto.ts';
import {MIGRATION_FILE,needsMigration,legacyRunning,copyFilter,rewriteLibrary,migrateFromOwn,runMigration,type MigrationDeps} from '../src/migrate.ts';
const SECRETS={openai:{key:'sk-legacy-test'},vault:[{id:'v1',origin:'https://example.com',username:'kim',password:'hunter2'}],'claude-code':{connected:true}};
function fixture(){
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'heisen-migrate-test-'));const legacy=path.join(base,'Own'),root=path.join(base,'Heisen');
  const put=(rel:string,text:string)=>{const file=path.join(legacy,rel);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};
  put('library.json',JSON.stringify({bookmarks:[{id:'b1',title:'Example',url:'https://example.com/'}],tabs:[{url:'own://newtab',title:'새 탭',pinned:false},{url:'https://example.com/',title:'Example',pinned:true}],settings:{provider:'openai',model:''}}));
  const key=deriveKey('legacy-pass');put('secrets.json',JSON.stringify(Object.fromEntries(Object.entries(SECRETS).map(([k,v])=>[k,encryptV10(JSON.stringify(v),key).toString('base64')]))));
  put('Partitions/browser/Cache/x','cache');put('Partitions/browser/Code Cache/js/y','code cache');put('Partitions/browser/Cookies','cookies');put('.workspace/t/a.txt','workspace file');
  put('Local State','{}');put('Cookies','app ui cookies');put('runtime-images.json','{}');put('claude-code/settings.json','{"theme":"dark"}');
  const aes=randomBytes(32);
  const encrypt=(s:string)=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',aes,iv);const enc=Buffer.concat([c.update(s,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),enc]);};
  const decrypt=(b:Buffer)=>{const d=createDecipheriv('aes-256-gcm',aes,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString();};
  const deps=(over:Partial<MigrationDeps>={}):MigrationDeps=>({legacyRoot:legacy,root,readKeychain:keychainReader({HEISEN_TEST_KEYCHAIN:JSON.stringify({'Own Safe Storage':'legacy-pass'})},false),confirmSecrets:async()=>true,encrypt,legacyRunning:()=>legacyRunning(legacy),askLegacyRunning:async()=>{throw new Error('unexpected prompt');},askFailed:async()=>{throw new Error('unexpected failure prompt');},...over});
  return {base,legacy,root,deps,decrypt,close:()=>fs.rmSync(base,{recursive:true,force:true})};
}
function hashes(dir:string){
  const out:Record<string,string>={};
  const walk=(d:string)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())walk(p);else{const st=fs.lstatSync(p);out[path.relative(dir,p)]=createHash('sha256').update(st.isSymbolicLink()?'link:'+fs.readlinkSync(p):fs.readFileSync(p)).digest('hex')+':'+st.mode+':'+st.mtimeMs;}}};
  walk(dir);return out;
}
const exists=(root:string,rel:string)=>fs.existsSync(path.join(root,rel));
function taskDb(file:string,workspaces:Record<string,string>){
  fs.rmSync(file,{force:true});
  const db=new DatabaseSync(file);db.exec('PRAGMA journal_mode=WAL; CREATE TABLE tasks(id TEXT PRIMARY KEY, data TEXT NOT NULL); CREATE TABLE journal(id TEXT PRIMARY KEY, task_id TEXT, epoch INTEGER, tool TEXT, args TEXT, state TEXT, result TEXT);');
  for(const [id,workspace] of Object.entries(workspaces))db.prepare('INSERT INTO tasks VALUES (?,?)').run(id,JSON.stringify({id,prompt:'p',status:'done',workspace,artifacts:[{path:'a.txt',bytes:14}]}));
  db.close();
}
function taskWorkspaces(file:string){const db=new DatabaseSync(file);try{return Object.fromEntries(db.prepare('SELECT id,data FROM tasks').all().map(r=>[String(r.id),JSON.parse(String(r.data)).workspace]));}finally{db.close();}}
test('copy filter skips caches at any depth and app-session files at the root only',()=>{
  const f=copyFilter('/x/Own');
  assert.equal(f('/x/Own'),true);
  for(const p of ['/x/Own/Partitions/browser/Cache','/x/Own/Partitions/browser/Code Cache/js','/x/Own/GPUCache','/x/Own/a/b/blob_storage/c','/x/Own/Crashpad','/x/Own/Local State','/x/Own/SingletonLock','/x/Own/.runtime','/x/Own/secrets.json','/x/Own/library.json','/x/Own/migration.json','/x/Own/Cookies'])assert.equal(f(p),false,p);
  for(const p of ['/x/Own/Partitions/browser/Cookies','/x/Own/Partitions/browser/Local Storage','/x/Own/.workspace/t/a.txt','/x/Own/claude-code/settings.json','/x/Own/tasks.sqlite','/x/Own/Partitions/browser/IndexedDB'])assert.equal(f(p),true,p);
});
test('fresh migration copies data, re-encrypts secrets, and leaves Own untouched',async()=>{
  const t=fixture();try{
    fs.mkdirSync(t.root,{recursive:true});fs.writeFileSync(path.join(t.root,'Local State'),'heisen-own');
    const before=hashes(t.legacy);assert.equal(needsMigration(t.root,t.legacy),true);
    const record=await migrateFromOwn(t.deps());
    assert.equal(record.status,'done');assert.equal(record.secrets,'migrated');assert.equal(record.from,t.legacy);assert.equal('claudeSecureStorageDir' in record,false);assert.equal(record.error,undefined);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(t.root,MIGRATION_FILE),'utf8')),record);
    if(process.platform!=='win32'){assert.equal(fs.statSync(path.join(t.root,MIGRATION_FILE)).mode&0o777,0o600);assert.equal(fs.statSync(path.join(t.root,'secrets.json')).mode&0o777,0o600);}
    for(const rel of ['Partitions/browser/Cookies','.workspace/t/a.txt','claude-code/settings.json'])assert.equal(fs.readFileSync(path.join(t.root,rel),'utf8'),fs.readFileSync(path.join(t.legacy,rel),'utf8'),rel);
    for(const rel of ['Partitions/browser/Cache','Partitions/browser/Code Cache','Cookies','runtime-images.json','secrets.own.json','library.json.own'])assert.equal(exists(t.root,rel),false,rel);
    assert.equal(fs.readFileSync(path.join(t.root,'Local State'),'utf8'),'heisen-own');
    const library=JSON.parse(fs.readFileSync(path.join(t.root,'library.json'),'utf8'));
    assert.deepEqual(library.tabs.map((x:any)=>x.url),['heisen://newtab','https://example.com/']);assert.equal(library.bookmarks.length,1);assert.equal(library.settings.provider,'openai');
    const secrets=JSON.parse(fs.readFileSync(path.join(t.root,'secrets.json'),'utf8'));
    assert.deepEqual(Object.fromEntries(Object.entries(secrets).map(([k,v])=>[k,JSON.parse(t.decrypt(Buffer.from(String(v),'base64')))])),SECRETS);
    assert.ok(!fs.readFileSync(path.join(t.root,'secrets.json'),'utf8').includes('sk-legacy-test'));
    assert.deepEqual(hashes(t.legacy),before);
    assert.equal(needsMigration(t.root,t.legacy),false);
  }finally{t.close();}
});
test('second launch does not migrate again even after Own changes',async()=>{
  const t=fixture();try{
    await migrateFromOwn(t.deps());fs.writeFileSync(path.join(t.legacy,'.workspace/t/a.txt'),'changed in Own');
    assert.equal(needsMigration(t.root,t.legacy),false);
    fs.rmSync(path.join(t.root,MIGRATION_FILE));assert.equal(needsMigration(t.root,t.legacy),false,'existing Heisen library also blocks migration');
    assert.equal(fs.readFileSync(path.join(t.root,'.workspace/t/a.txt'),'utf8'),'workspace file');
    assert.equal(needsMigration(t.root,path.join(t.base,'missing')),false);
  }finally{t.close();}
});
test('interrupted copy is redone from the start on the next launch',async()=>{
  const t=fixture();try{
    const put=(rel:string,text:string)=>{fs.mkdirSync(path.dirname(path.join(t.root,rel)),{recursive:true});fs.writeFileSync(path.join(t.root,rel),text);};
    put('.workspace/t/a.txt','partial');put('Partitions/browser/Cookies','partial');put('secrets.json.tmp','partial');put('library.json.own','{broken');
    assert.equal(needsMigration(t.root,t.legacy),true);
    const record=await migrateFromOwn(t.deps());
    assert.equal(record.status,'done');assert.equal(record.secrets,'migrated');
    assert.equal(fs.readFileSync(path.join(t.root,'.workspace/t/a.txt'),'utf8'),'workspace file');assert.equal(fs.readFileSync(path.join(t.root,'Partitions/browser/Cookies'),'utf8'),'cookies');
    assert.equal(JSON.parse(fs.readFileSync(path.join(t.root,'library.json'),'utf8')).tabs[0].url,'heisen://newtab');assert.equal(exists(t.root,'library.json.own'),false);
    assert.equal(needsMigration(t.root,t.legacy),false);
  }finally{t.close();}
});
test('running Own blocks the copy until it quits or the user declines',async()=>{
  const t=fixture();try{
    fs.symlinkSync(`${os.hostname()}-${process.pid}`,path.join(t.legacy,'SingletonLock'));assert.equal(legacyRunning(t.legacy),true);
    const before=hashes(t.legacy);const answers:string[]=[];
    const record=await migrateFromOwn(t.deps({askLegacyRunning:async()=>{answers.push('asked');return answers.length<2?'retry':'decline';}}));
    assert.equal(answers.length,2);assert.equal(record.status,'declined');assert.equal(record.secrets,'none');
    assert.deepEqual(fs.readdirSync(t.root),[MIGRATION_FILE]);assert.equal(needsMigration(t.root,t.legacy),false);assert.deepEqual(hashes(t.legacy),before);
    fs.rmSync(path.join(t.legacy,'SingletonLock'));fs.symlinkSync('host-2147483646',path.join(t.legacy,'SingletonLock'));assert.equal(legacyRunning(t.legacy),false,'stale lock pid');
    fs.rmSync(path.join(t.legacy,'SingletonLock'));fs.symlinkSync('no-pid-here',path.join(t.legacy,'SingletonLock'));assert.equal(legacyRunning(t.legacy),false,'malformed lock');
    fs.rmSync(path.join(t.legacy,'SingletonLock'));assert.equal(legacyRunning(t.legacy),false,'no lock');
    fs.rmSync(t.root,{recursive:true});let running=true,asked=0;
    const retried=await migrateFromOwn(t.deps({legacyRunning:()=>running,askLegacyRunning:async()=>{asked++;running=false;return 'retry';}}));
    assert.equal(asked,1);assert.equal(retried.status,'done');assert.equal(exists(t.root,'.workspace/t/a.txt'),true);
  }finally{t.close();}
});
test('declined or failed keychain access keeps the Own secrets file aside',async()=>{
  const cases:[string,Partial<MigrationDeps>,string|undefined][]=[
    ['declined',{confirmSecrets:async()=>false},undefined],
    ['missing item',{readKeychain:keychainReader({HEISEN_TEST_KEYCHAIN:'{}'},false)},'KEYCHAIN_NOT_FOUND'],
    ['wrong password',{readKeychain:keychainReader({HEISEN_TEST_KEYCHAIN:JSON.stringify({'Own Safe Storage':'other-pass'})},false)},'string'],
    ['dialog failure',{confirmSecrets:async()=>{throw new Error('dialog closed');}},'dialog closed'],
  ];
  for(const [name,over,error] of cases){
    const t=fixture();try{
      const record=await migrateFromOwn(t.deps(over));
      assert.equal(record.status,'done',name);assert.equal(record.secrets,'kept-legacy',name);assert.equal('claudeSecureStorageDir' in record,false,name);
      if(error==='string')assert.equal(typeof record.error,'string',name);else assert.equal(record.error,error,name);
      assert.equal(exists(t.root,'secrets.json'),false,name);
      assert.equal(fs.readFileSync(path.join(t.root,'secrets.own.json'),'utf8'),fs.readFileSync(path.join(t.legacy,'secrets.json'),'utf8'),name);
      if(process.platform!=='win32')assert.equal(fs.statSync(path.join(t.root,'secrets.own.json')).mode&0o777,0o600,name);
      assert.equal(JSON.parse(fs.readFileSync(path.join(t.root,'library.json'),'utf8')).tabs[0].url,'heisen://newtab',name);
    }finally{t.close();}
  }
  const t=fixture();try{
    fs.rmSync(path.join(t.legacy,'secrets.json'));
    const record=await migrateFromOwn(t.deps({confirmSecrets:async()=>{throw new Error('should not ask');}}));
    assert.equal(record.secrets,'none');assert.equal(exists(t.root,'secrets.json'),false);assert.equal(exists(t.root,'secrets.own.json'),false);
  }finally{t.close();}
});
test('rewriteLibrary only changes the old new-tab URL',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'heisen-migrate-lib-'));try{
    const file=path.join(dir,'library.json');fs.writeFileSync(file,JSON.stringify({tabs:[{url:'own://newtab'},{url:'own://newtab/x'},{url:'https://a.test/own://newtab'}],history:[{url:'own://newtab'}]}));
    rewriteLibrary(file);const out=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.deepEqual(out.tabs.map((x:any)=>x.url),['heisen://newtab','own://newtab/x','https://a.test/own://newtab']);assert.equal(out.history[0].url,'own://newtab');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('copied tasks point their workspaces at the new root and the Own database stays byte-identical',async()=>{
  const t=fixture();try{
    const legacyDb=path.join(t.legacy,'tasks.sqlite');
    taskDb(legacyDb,{t:path.join(t.legacy,'.workspace','t'),elsewhere:'/somewhere/else/.workspace/x',sibling:t.legacy+'-old/.workspace/y'});
    const before=hashes(t.legacy);
    const record=await migrateFromOwn(t.deps());assert.equal(record.status,'done');
    assert.deepEqual(taskWorkspaces(path.join(t.root,'tasks.sqlite')),{t:path.join(t.root,'.workspace','t'),elsewhere:'/somewhere/else/.workspace/x',sibling:t.legacy+'-old/.workspace/y'});
    assert.equal(fs.readFileSync(path.join(t.root,'.workspace/t/a.txt'),'utf8'),'workspace file');
    assert.deepEqual(hashes(t.legacy),before);
    assert.equal(taskWorkspaces(legacyDb).t,path.join(t.legacy,'.workspace','t'));
  }finally{t.close();}
});
test('a failed migration asks again until it succeeds',async()=>{
  const t=fixture();try{
    fs.writeFileSync(path.join(t.legacy,'tasks.sqlite'),'not a database');const messages:string[]=[];
    const record=await runMigration(t.deps({askFailed:async message=>{messages.push(message);assert.equal(exists(t.root,'library.json'),false);assert.equal(exists(t.root,MIGRATION_FILE),false);taskDb(path.join(t.legacy,'tasks.sqlite'),{t:path.join(t.legacy,'.workspace','t')});return 'retry';}}));
    assert.equal(messages.length,1);assert.equal(typeof messages[0],'string');assert.ok(messages[0].length>0);
    assert.equal(record.status,'done');assert.equal(record.secrets,'migrated');
    assert.deepEqual(taskWorkspaces(path.join(t.root,'tasks.sqlite')),{t:path.join(t.root,'.workspace','t')});
    assert.equal(needsMigration(t.root,t.legacy),false);
  }finally{t.close();}
});
test('skipping a failed migration records an explicit decline',async()=>{
  const t=fixture();try{
    fs.writeFileSync(path.join(t.legacy,'tasks.sqlite'),'not a database');const before=hashes(t.legacy);let asked=0;
    const record=await runMigration(t.deps({askFailed:async()=>{asked++;return 'skip';}}));
    assert.equal(asked,1);assert.equal(record.status,'declined');assert.equal(record.secrets,'none');assert.equal(typeof record.error,'string');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(t.root,MIGRATION_FILE),'utf8')),record);
    assert.equal(exists(t.root,'library.json'),false);assert.equal(exists(t.root,'tasks.sqlite'),false);
    assert.equal(needsMigration(t.root,t.legacy),false);assert.deepEqual(hashes(t.legacy),before);
  }finally{t.close();}
});
