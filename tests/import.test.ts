import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,pbkdf2Sync,createCipheriv,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {deriveKey,decryptV10,encryptV10,decryptV10Gcm,chromiumDecryptor,localStateKey,keychainReader,isTestKeychain} from '../src/chromium-crypto.ts';
import {makeChromeProfile,CHROME_FIXTURE} from './fixtures/chrome-profile.ts';
import {BROWSERS,detectSources,readLogins,readCookies,readBookmarks,readHistory,parsePasswordCsv,mergeLogins,type BrowserId,type VaultEntry} from '../src/importer.ts';
function tempRoot(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'heisen-import-test-'));return {root,close:()=>fs.rmSync(root,{recursive:true,force:true})};}
const macRoots=(base:string)=>({base,dirs:Object.fromEntries(BROWSERS.map(b=>[b.id,b.dirs])) as Record<BrowserId,string[]>});
function encryptGcm(plain:Buffer|string,key:Buffer):Buffer{
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);
  return Buffer.concat([Buffer.from('v10'),nonce,cipher.update(plain),cipher.final(),cipher.getAuthTag()]);
}
test('deriveKey matches Chromium macOS PBKDF2 parameters',()=>{const key=deriveKey('peanuts');assert.equal(key.length,16);assert.equal(key.toString('hex'),pbkdf2Sync('peanuts','saltysalt',1003,16,'sha1').toString('hex'));assert.notEqual(deriveKey('other').toString('hex'),key.toString('hex'));});
test('v10 values round-trip and reject the wrong key',()=>{const key=deriveKey('peanuts'),wrong=deriveKey('walnuts');const enc=encryptV10('비밀번호 hunter2',key);assert.equal(enc.subarray(0,3).toString(),'v10');assert.equal((enc.length-3)%16,0);assert.equal(decryptV10(enc,key)?.toString(),'비밀번호 hunter2');assert.equal(decryptV10(new Uint8Array(enc),key)?.toString(),'비밀번호 hunter2');assert.equal(decryptV10(encryptV10(Buffer.alloc(0),key),key)?.length,0);assert.throws(()=>decryptV10(enc,wrong));assert.equal(decryptV10(Buffer.from('v11abcdef'),key),null);assert.equal(decryptV10(Buffer.from('plain'),key),null);assert.equal(decryptV10(Buffer.alloc(0),key),null);});
test('keychainReader uses the test map only in development builds',async()=>{const env={HEISEN_TEST_KEYCHAIN:JSON.stringify({'Chrome Safe Storage':'peanuts',Broken:1})};assert.equal(isTestKeychain(env,false),true);assert.equal(isTestKeychain(env,true),false);assert.equal(isTestKeychain({},false),false);const read=keychainReader(env,false);assert.equal(await read('Chrome Safe Storage'),'peanuts');await assert.rejects(read('Brave Safe Storage'),{message:'KEYCHAIN_NOT_FOUND'});await assert.rejects(read('Broken'),{message:'KEYCHAIN_NOT_FOUND'});await assert.rejects(read('toString'),{message:'KEYCHAIN_NOT_FOUND'});assert.notEqual(keychainReader(env,true),read);assert.equal(keychainReader(env,true),keychainReader({},false));});
test('makeChromeProfile writes an encrypted Chrome profile',()=>{const t=tempRoot();try{
  const host='login.example.test',key=deriveKey('fixture-pass'),f=CHROME_FIXTURE;
  const {appSupport,profile}=makeChromeProfile(t.root,{password:'fixture-pass',host});
  assert.equal(appSupport,t.root);assert.equal(profile,path.join(t.root,'Google','Chrome','Default'));
  for(const file of ['Preferences','Login Data','Cookies','Bookmarks','History'])assert.ok(fs.existsSync(path.join(profile,file)),file);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(t.root,'Google','Chrome','Local State'),'utf8')),{profile:{info_cache:{Default:{name:'사용자 1'}}}});
  const logins=new DatabaseSync(path.join(profile,'Login Data'),{readOnly:true});
  const rows=logins.prepare('SELECT origin_url,username_value,password_value,blacklisted_by_user,scheme FROM logins ORDER BY rowid').all();logins.close();
  assert.equal(rows.length,3);assert.equal(rows[0].origin_url,`https://${host}${f.login.path}`);assert.equal(rows[0].username_value,f.login.username);
  assert.equal(decryptV10(rows[0].password_value as Uint8Array,key)?.toString(),f.login.password);
  assert.throws(()=>decryptV10(rows[0].password_value as Uint8Array,deriveKey('not-the-pass')));
  assert.equal(rows[1].blacklisted_by_user,1);assert.match(String(rows[2].origin_url),/^android:\/\//);
  const history=new DatabaseSync(path.join(profile,'History'),{readOnly:true});
  const urls=history.prepare('SELECT url,hidden FROM urls').all();history.close();assert.equal(urls.length,3);assert.equal(urls.filter(u=>u.hidden===1).length,1);
  const bookmarks=JSON.parse(fs.readFileSync(path.join(profile,'Bookmarks'),'utf8'));assert.equal(bookmarks.roots.bookmark_bar.children[1].children[1].children[0].url,'https://deep.example/');
}finally{t.close();}});
test('fixture cookies carry the SHA256(host_key) prefix for meta version 24',()=>{const t=tempRoot();try{
  const host='cookie.example.test',key=deriveKey('fixture-pass'),f=CHROME_FIXTURE;
  const {profile}=makeChromeProfile(t.root,{password:'fixture-pass',host});
  const db=new DatabaseSync(path.join(profile,'Cookies'),{readOnly:true,readBigInts:true});
  const version=Number(db.prepare("SELECT value FROM meta WHERE key='version'").get()?.value);
  const rows=db.prepare('SELECT host_key,top_frame_site_key,name,value,encrypted_value,expires_utc,has_expires FROM cookies ORDER BY rowid').all();db.close();
  assert.equal(version,24);assert.equal(rows.length,4);
  const values=new Map<string,string>();
  for(const row of rows){
    const encrypted=row.encrypted_value as Uint8Array;
    if(!encrypted.length){values.set(String(row.name),String(row.value));continue;}
    const plain=decryptV10(encrypted,key);assert.ok(plain);
    const hostHash=createHash('sha256').update(String(row.host_key)).digest();
    assert.ok(plain.subarray(0,32).equals(hostHash),`${row.name} prefix`);
    values.set(String(row.name),plain.subarray(32).toString());
  }
  assert.deepEqual(Object.fromEntries(values),{[f.cookie.name]:f.cookie.value,[f.plainCookie.name]:f.plainCookie.value,[f.partitionedCookie.name]:f.partitionedCookie.value,[f.expiredCookie.name]:f.expiredCookie.value});
  assert.equal(rows[0].host_key,'.'+host);assert.notEqual(rows[2].top_frame_site_key,'');
  const nowChrome=BigInt(Date.now())*1000n+11644473600000000n;assert.ok((rows[0].expires_utc as bigint)>nowChrome);assert.ok((rows[3].expires_utc as bigint)<nowChrome);assert.equal(rows[3].has_expires,1n);
}finally{t.close();}});
const importCopies=()=>fs.readdirSync(os.tmpdir()).filter(name=>name.startsWith('heisen-import-')&&!name.startsWith('heisen-import-test-'));
test('BROWSERS lists supported browsers and Chromium keychain services',()=>{
  assert.deepEqual(BROWSERS.map(b=>b.id),['chrome','chromium','brave','edge','vivaldi','arc','dia','comet','aside','helium','opera','safari','firefox']);
  assert.equal(BROWSERS.find(b=>b.id==='helium')?.service,'Helium Storage Key');assert.deepEqual(BROWSERS.find(b=>b.id==='aside')?.dirs,['Aside/User Data','Aside']);
  for(const b of BROWSERS.filter(b=>b.kind==='chromium'&&b.id!=='helium'))assert.match(b.service,/ Safe Storage$/);
});
test('detectSources finds Chrome profiles from Local State and a root-level Opera profile',()=>{const t=tempRoot();try{
  assert.deepEqual(detectSources(macRoots(t.root)),[]);
  const {profile}=makeChromeProfile(t.root,{password:'fixture-pass',host:'detect.example.test'}),chromeRoot=path.dirname(profile);
  let sources=detectSources(macRoots(t.root));
  assert.equal(sources.length,1);assert.deepEqual(sources[0],{browser:'chrome',name:'Google Chrome',service:'Chrome Safe Storage',kind:'chromium',can:{passwords:true,cookies:true},root:chromeRoot,profiles:[{dir:'Default',name:'사용자 1',path:profile}]});
  // Listed profiles without Preferences/Login Data are skipped; Default stays first; names fall back to the folder.
  fs.writeFileSync(path.join(chromeRoot,'Local State'),JSON.stringify({profile:{info_cache:{'Profile 10':{name:'업무'},'Profile 2':{},Default:{name:'사용자 1'},Missing:{name:'없음'},'../escape':{name:'x'}}}}));
  for(const dir of ['Profile 10','Profile 2'])fs.mkdirSync(path.join(chromeRoot,dir));
  fs.writeFileSync(path.join(chromeRoot,'Profile 10','Preferences'),'{}');fs.writeFileSync(path.join(chromeRoot,'Profile 2','Login Data'),'');
  assert.deepEqual(detectSources(macRoots(t.root))[0].profiles.map(p=>[p.dir,p.name]),[['Default','사용자 1'],['Profile 2','Profile 2'],['Profile 10','업무']]);
  const opera=path.join(t.root,'com.operasoftware.Opera');fs.mkdirSync(opera);fs.writeFileSync(path.join(opera,'Local State'),'not json');fs.writeFileSync(path.join(opera,'Login Data'),'');
  fs.mkdirSync(path.join(t.root,'BraveSoftware','Brave-Browser'),{recursive:true});fs.writeFileSync(path.join(t.root,'BraveSoftware','Brave-Browser','Local State'),'{}');
  sources=detectSources(macRoots(t.root));
  assert.deepEqual(sources.map(s=>s.browser),['chrome','opera']);assert.deepEqual(sources[1].profiles,[{dir:'.',name:'Opera',path:opera}]);
}finally{t.close();}});
test('readLogins decrypts normal rows from a temporary copy and skips blacklisted and android rows',()=>{const t=tempRoot();try{
  const host='login.example.test',f=CHROME_FIXTURE,key=deriveKey('fixture-pass'),before=importCopies().length;
  const {profile}=makeChromeProfile(t.root,{password:'fixture-pass',host});
  const result=readLogins(profile,chromiumDecryptor(key));
  assert.equal(result.failed,0);assert.equal(result.items.length,1);
  const [login]=result.items;assert.equal(login.origin,`https://${host}`);assert.equal(login.username,f.login.username);assert.equal(login.password,f.login.password);
  assert.ok(Math.abs(login.createdAt-Date.now())<60000,'createdAt is Unix ms');
  assert.equal(importCopies().length,before,'temporary copies are removed');
  const wrong=readLogins(profile,chromiumDecryptor(deriveKey('other-pass')));assert.deepEqual(wrong,{items:[],failed:1});
  // Login Data For Account (Google account store) is read too; the newer duplicate wins.
  fs.copyFileSync(path.join(profile,'Login Data'),path.join(profile,'Login Data For Account'));
  const account=new DatabaseSync(path.join(profile,'Login Data For Account'));
  account.prepare('UPDATE logins SET password_value=?, date_created=? WHERE username_value=?').run(encryptV10('newer-pw',key),BigInt(Date.now()+3600000)*1000n+11644473600000000n,f.login.username);
  account.prepare('INSERT INTO logins VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('http://other.example.test:8080/a','','','bob','',encryptV10('bob-pw',key),'','http://other.example.test:8080/',BigInt(Date.now())*1000n+11644473600000000n,0,0);
  account.prepare('INSERT INTO logins VALUES (?,?,?,?,?,?,?,?,?,?,?)').run('https://basic.example.test/','','','carol','',encryptV10('basic-pw',key),'','https://basic.example.test/',BigInt(Date.now())*1000n+11644473600000000n,0,1);
  account.close();
  const merged=readLogins(profile,chromiumDecryptor(key));
  assert.equal(merged.failed,0);assert.deepEqual(merged.items.map(i=>[i.origin,i.username,i.password]).sort(),[['http://other.example.test:8080','bob','bob-pw'],[`https://${host}`,f.login.username,'newer-pw']]);
  assert.deepEqual(readLogins(path.join(t.root,'missing'),chromiumDecryptor(key)),{items:[],failed:0});
}finally{t.close();}});
test('readCookies strips the host hash and skips partitioned and expired cookies',()=>{const t=tempRoot();try{
  const host='cookie.example.test',f=CHROME_FIXTURE,key=deriveKey('fixture-pass'),before=importCopies().length;
  const {profile}=makeChromeProfile(t.root,{password:'fixture-pass',host});
  const result=readCookies(profile,chromiumDecryptor(key));
  assert.equal(result.failed,0);assert.equal(result.items.length,2);
  const [sid,theme]=result.items;
  assert.equal(typeof sid.expirationDate,'number');assert.ok(sid.expirationDate!>Date.now()/1000+86000&&sid.expirationDate!<Date.now()/1000+86500);
  assert.deepEqual({...sid,expirationDate:0},{url:`https://${host}/`,name:f.cookie.name,value:f.cookie.value,domain:'.'+host,path:'/',secure:true,httpOnly:true,expirationDate:0,sameSite:'lax'});
  assert.deepEqual(theme,{url:`http://${host}/`,name:f.plainCookie.name,value:f.plainCookie.value,path:'/',secure:false,httpOnly:false,sameSite:'unspecified'});
  assert.equal(importCopies().length,before,'temporary copies are removed');
  // A later clock expires the persistent cookie; the session cookie stays.
  assert.deepEqual(readCookies(profile,chromiumDecryptor(key),Date.now()+2*86400000).items.map(c=>c.name),[f.plainCookie.name]);
  assert.deepEqual(readCookies(profile,chromiumDecryptor(deriveKey('other-pass'))),{items:[theme],failed:1});
  // A value whose SHA256(host_key) prefix does not match its row is rejected; the Network/Cookies location is used when Cookies is absent.
  const db=new DatabaseSync(path.join(profile,'Cookies'));
  db.prepare("UPDATE cookies SET host_key='.wrong.example.test' WHERE name=?").run(f.cookie.name);db.close();
  fs.mkdirSync(path.join(profile,'Network'));fs.renameSync(path.join(profile,'Cookies'),path.join(profile,'Network','Cookies'));
  assert.deepEqual(readCookies(profile,chromiumDecryptor(key)),{items:[theme],failed:1});
  assert.deepEqual(readCookies(path.join(t.root,'missing'),chromiumDecryptor(key)),{items:[],failed:0});
}finally{t.close();}});
test('readBookmarks flattens folders and keeps unique web URLs only',()=>{const t=tempRoot();try{
  const host='bookmark.example.test',{profile}=makeChromeProfile(t.root,{password:'fixture-pass',host});
  assert.deepEqual(readBookmarks(profile),[{title:'Example',url:`https://${host}/`},{title:'Docs',url:`https://${host}/docs`},{title:'Deep',url:'https://deep.example/'},{title:'Mobile',url:'http://mobile.example/'}]);
  assert.deepEqual(readBookmarks(path.join(t.root,'missing')),[]);
}finally{t.close();}});
test('readHistory returns visible web pages newest first with Unix ms times',()=>{const t=tempRoot();try{
  const host='history.example.test',{profile}=makeChromeProfile(t.root,{password:'fixture-pass',host});
  const db=new DatabaseSync(path.join(profile,'History'));
  db.prepare('INSERT INTO urls(url,title,visit_count,typed_count,last_visit_time,hidden) VALUES (?,?,?,?,?,?)').run('chrome://settings/','Settings',1,0,BigInt(Date.now()+1000)*1000n+11644473600000000n,0);db.close();
  const items=readHistory(profile);
  assert.deepEqual(items.map(i=>[i.title,i.url]),[['Newer',`https://${host}/newer`],['Older',`https://${host}/older`]]);
  assert.ok(Math.abs(items[0].at-Date.now())<60000);assert.ok(Math.abs(items[1].at-(Date.now()-86400000))<60000);
  assert.deepEqual(readHistory(profile,1).map(i=>i.title),['Newer']);
  assert.deepEqual(readHistory(path.join(t.root,'missing')),[]);
}finally{t.close();}});
test('parsePasswordCsv maps Apple, Chrome, Firefox, 1Password and Bitwarden exports',()=>{
  const pairs=(text:string)=>parsePasswordCsv(text).map(i=>[i.origin,i.username,i.password]);
  // Apple Passwords/Safari: BOM, CRLF, quoted comma, doubled quote and a line break inside Notes.
  assert.deepEqual(pairs('\ufeffTitle,URL,Username,Password,Notes,OTPAuth\r\nExample,https://www.example.com/login,alice,"pa,ss""word","line 1\r\nline 2",\r\nNo password,https://empty.example.com/,bob,,,\r\n'),[['https://www.example.com','alice','pa,ss"word']]);
  // Chrome: android rows and later duplicates.
  assert.deepEqual(pairs('name,url,username,password,note\nexample.com,https://example.com/a,alice,old,\napp,android://hash@com.example.app/,droid,pw,\nexample.com,https://example.com/b,alice,new,\n'),[['https://example.com','alice','new']]);
  const firefox=parsePasswordCsv('"url","username","password","httpRealm","formActionOrigin","guid","timeCreated","timeLastUsed","timePasswordChanged"\n"http://localhost:8080","dev","devpw",,"http://localhost:8080","{guid}","1700000000000","1700000000000","1700000000000"\n"javascript:alert(1)","x","y",,,"{g2}","1","1","1"\n');
  assert.deepEqual(firefox,[{origin:'http://localhost:8080',username:'dev',password:'devpw',createdAt:1700000000000}]);
  assert.deepEqual(pairs('Title,Url,Username,Password,OTPAuth,Favorite,Archived,Tags,Notes\nGitHub,https://github.com/login,octo,gh-pw,,false,false,,\n'),[['https://github.com','octo','gh-pw']]);
  assert.deepEqual(pairs('folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp\n,,login,Multi,,,0,"androidapp://com.x,https://multi.example.com/",multi,multi-pw,\n,,note,Secure note,text,,0,,,,\n'),[['https://multi.example.com','multi','multi-pw']]);
  assert.deepEqual(pairs('URL,USERNAME,PASSWORD\nhttps://case.example.com,u,p'),[['https://case.example.com','u','p']]);
  assert.throws(()=>parsePasswordCsv('a,b,c\n1,2,3\n'),/CSV/);assert.throws(()=>parsePasswordCsv(''),/CSV/);
});
test('mergeLogins adds new accounts, updates changed passwords and leaves identical ones',()=>{
  const existing:VaultEntry[]=[{id:'keep',origin:'https://a.test',username:'u',password:'same'},{id:'change',origin:'https://b.test',username:'u',password:'old',source:'heisen',updatedAt:1}];
  const snapshot=structuredClone(existing);
  const result=mergeLogins(existing,[{origin:'https://a.test',username:'u',password:'same',createdAt:5},{origin:'https://b.test',username:'u',password:'new',createdAt:5},{origin:'https://c.test',username:'',password:'c-pw',createdAt:5},{origin:'https://c.test',username:'',password:'c-pw',createdAt:6}],'chrome',1234);
  assert.equal(result.added,1);assert.equal(result.updated,1);assert.deepEqual(existing,snapshot,'input is not mutated');
  assert.deepEqual(result.list[0],existing[0]);assert.deepEqual(result.list[1],{id:'change',origin:'https://b.test',username:'u',password:'new',source:'chrome',updatedAt:1234});
  assert.equal(result.list.length,3);const added=result.list[2];assert.match(added.id,/^[0-9a-f-]{36}$/);assert.deepEqual({...added,id:''},{id:'',origin:'https://c.test',username:'',password:'c-pw',source:'chrome',updatedAt:1234});
  assert.deepEqual(mergeLogins(result.list,[{origin:'https://c.test',username:'',password:'c-pw',createdAt:7}],'chrome'),{list:result.list,added:0,updated:0});
});
test('Windows v10 AES-256-GCM authenticates the nonce, ciphertext and tag',()=>{
  const key=randomBytes(32),plain='Windows 비밀번호',encrypted=encryptGcm(plain,key),decrypt=chromiumDecryptor(key);
  assert.equal(decryptV10Gcm(encrypted,key)?.toString(),plain);
  assert.equal(decrypt(encrypted)?.toString(),plain);
  const carrier=Buffer.concat([Buffer.alloc(7),encrypted,Buffer.alloc(5)]);
  assert.equal(decryptV10Gcm(new Uint8Array(carrier.buffer,carrier.byteOffset+7,encrypted.length),key)?.toString(),plain);
  assert.equal(decryptV10Gcm(encryptGcm(Buffer.alloc(0),key),key)?.length,0);
  assert.throws(()=>decryptV10Gcm(encrypted,randomBytes(32)));
  assert.equal(chromiumDecryptor(randomBytes(32))(encrypted),null);
  for(const offset of [3,15,encrypted.length-1]){
    const damaged=Buffer.from(encrypted);damaged[offset]^=1;
    assert.throws(()=>decryptV10Gcm(damaged,key));assert.equal(decrypt(damaged),null);
  }
  for(const unsupported of [Buffer.alloc(0),Buffer.from('plain'),Buffer.from('v10'),Buffer.concat([Buffer.from('v10'),Buffer.alloc(27)]),Buffer.concat([Buffer.from('v20'),encrypted.subarray(3)])]){
    assert.equal(decryptV10Gcm(unsupported,key),null);assert.equal(decrypt(unsupported),null);
  }
  assert.equal(chromiumDecryptor(deriveKey('mac'))(encryptV10('mac unchanged',deriveKey('mac')))?.toString(),'mac unchanged');
});
test('Local State unwraps only the DPAPI-prefixed key and reports app-bound encryption',async()=>{const t=tempRoot();try{
  const file=path.join(t.root,'Local State'),key=randomBytes(32),protectedKey=Buffer.from('synthetic DPAPI payload');let calls=0;
  const unprotect=async(blob:Buffer)=>{calls++;assert.deepEqual(blob,protectedKey);return key;};
  const encrypted_key=Buffer.concat([Buffer.from('DPAPI'),protectedKey]).toString('base64');
  fs.writeFileSync(file,JSON.stringify({os_crypt:{encrypted_key,app_bound_encrypted_key:'must not be unwrapped'}}));
  assert.deepEqual(await localStateKey(file,unprotect),{key,appBound:true});assert.equal(calls,1);
  fs.writeFileSync(file,JSON.stringify({os_crypt:{encrypted_key}}));
  assert.deepEqual(await localStateKey(file,unprotect),{key,appBound:false});assert.equal(calls,2);
  fs.writeFileSync(file,JSON.stringify({os_crypt:{app_bound_encrypted_key:''}}));
  assert.deepEqual(await localStateKey(file,unprotect),{appBound:true});assert.equal(calls,2);
  fs.writeFileSync(file,'{}');
  assert.deepEqual(await localStateKey(file,unprotect),{appBound:false});assert.equal(calls,2);
  for(const invalid of ['',17,'not base64!',Buffer.from('APPBnot-DPAPI').toString('base64'),Buffer.from('DPAPI').toString('base64')]){
    fs.writeFileSync(file,JSON.stringify({os_crypt:{encrypted_key:invalid}}));
    await assert.rejects(localStateKey(file,unprotect));assert.equal(calls,2);
  }
  fs.writeFileSync(file,JSON.stringify({os_crypt:{encrypted_key}}));
  await assert.rejects(localStateKey(file,async()=>Buffer.alloc(16)),/길이/);
  await assert.rejects(localStateKey(file,async()=>{throw new Error('DPAPI denied');}),/DPAPI denied/);
  fs.writeFileSync(file,'not json');await assert.rejects(localStateKey(file,unprotect));assert.equal(calls,2);
}finally{t.close();}});
test('Windows roots detect Chrome and Edge profiles without macOS-only browser paths',()=>{const t=tempRoot();try{
  const roots={base:t.root,dirs:{chrome:['Google/Chrome/User Data'],chromium:['Chromium/User Data'],brave:['BraveSoftware/Brave-Browser/User Data'],edge:['Microsoft/Edge/User Data'],vivaldi:['Vivaldi/User Data'],arc:[],dia:[],comet:[],aside:[],helium:[],opera:[]}};
  for(const browser of ['chrome','edge'] as const){
    const root=path.join(t.root,roots.dirs[browser][0]);fs.mkdirSync(path.join(root,'Default'),{recursive:true});
    fs.writeFileSync(path.join(root,'Default','Preferences'),'{}');
    fs.writeFileSync(path.join(root,'Local State'),JSON.stringify({profile:{info_cache:{Default:{name:browser}}}}));
  }
  const macOpera=path.join(t.root,'com.operasoftware.Opera');fs.mkdirSync(macOpera);fs.writeFileSync(path.join(macOpera,'Login Data'),'');
  const sources=detectSources(roots);
  assert.deepEqual(sources.map(s=>[s.browser,s.profiles[0].name]),[['chrome','chrome'],['edge','edge']]);
  for(const source of sources)assert.equal(source.profiles[0].path,path.join(source.root,'Default'));
}finally{t.close();}});
test('Windows imports v10 logins and Network cookies, counts v20 failures without bypassing them',()=>{const t=tempRoot();try{
  const host='windows.example.test',key=randomBytes(32),decrypt=chromiumDecryptor(key),f=CHROME_FIXTURE;
  const {profile}=makeChromeProfile(t.root,{password:'fixture-pass',host});
  const logins=new DatabaseSync(path.join(profile,'Login Data'));
  logins.prepare('UPDATE logins SET password_value=? WHERE username_value=?').run(encryptGcm('windows-password',key),f.login.username);logins.close();
  assert.deepEqual(readLogins(profile,decrypt).items.map(l=>l.password),['windows-password']);
  fs.mkdirSync(path.join(profile,'Network'));fs.copyFileSync(path.join(profile,'Cookies'),path.join(profile,'Network','Cookies'));
  const cookies=new DatabaseSync(path.join(profile,'Network','Cookies'));
  cookies.prepare('UPDATE cookies SET encrypted_value=? WHERE name=?').run(encryptGcm(Buffer.concat([createHash('sha256').update('.'+host).digest(),Buffer.from('windows-cookie')]),key),f.cookie.name);
  cookies.close();
  const read=readCookies(profile,decrypt);assert.equal(read.failed,0);assert.equal(read.items.find(c=>c.name===f.cookie.name)?.value,'windows-cookie');
  // The stale root-level Cookies still has a macOS CBC value and must not be selected.
  const v20=Buffer.concat([Buffer.from('v20'),encryptGcm('app-bound secret',key).subarray(3)]);
  const lockedLogins=new DatabaseSync(path.join(profile,'Login Data'));
  lockedLogins.prepare('UPDATE logins SET password_value=? WHERE username_value=?').run(v20,f.login.username);lockedLogins.close();
  assert.deepEqual(readLogins(profile,decrypt),{items:[],failed:1});
  const lockedCookies=new DatabaseSync(path.join(profile,'Network','Cookies'));
  lockedCookies.prepare('UPDATE cookies SET encrypted_value=? WHERE name=?').run(v20,f.cookie.name);lockedCookies.close();
  const blocked=readCookies(profile,decrypt);assert.equal(blocked.failed,1);assert.deepEqual(blocked.items.map(c=>c.name),[f.plainCookie.name]);
  const mixed=new DatabaseSync(path.join(profile,'Login Data'));
  mixed.prepare('INSERT INTO logins SELECT origin_url,action_url,username_element,?,password_element,?,submit_element,signon_realm,date_created,blacklisted_by_user,scheme FROM logins WHERE username_value=?').run('v10-user',encryptGcm('readable',key),f.login.username);mixed.close();
  const partial=readLogins(profile,decrypt);assert.equal(partial.failed,1);assert.deepEqual(partial.items.map(l=>[l.username,l.password]),[['v10-user','readable']]);
}finally{t.close();}});
