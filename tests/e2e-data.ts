import {_electron as electron,type ElectronApplication,type Page} from 'playwright';
import {expect} from 'playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as sleep} from 'node:timers/promises';
import {deriveKey,encryptV10} from '../src/chromium-crypto.ts';
import {makeChromeProfile,CHROME_FIXTURE} from './fixtures/chrome-profile.ts';
import {readLibrary} from './lib.ts';
// T3: Own → Heisen migration, first-run wizard with Chrome import (passwords/cookies/bookmarks/history, autosync), CSV import, autofill menu, save prompts,
// strong-password suggestion, password manager off, sign-up settings, password copy.
type Vault={id:string;origin:string;username:string;updatedAt?:number;password?:string;signup?:{by:string}};
type Prompt={id:string;tabId:number;kind:string;origin:string;username:string;at:number;password?:string};
type State={active:number;route:string;tabs:{id:number;url:string;taskId?:string}[];bookmarks:{url:string}[];history:{url:string}[];providers:{id:string;connected:boolean}[];settings:{model:string;importOffered:boolean;onboarded:boolean;vault:boolean;signup:{emails:string[];mode:string}};vault:Vault[];importSources:{browser:string;profile:string;lastSync:number;needsAuth?:boolean}[];passwordPrompts:Prompt[];activePasswords:number;signupPresets:{id:string;name:string;length:number}[];tasks:{id:string;status:string}[]};
type Heisen={heisen:{call(method:string,args:unknown):Promise<unknown>}};
// Main-process globals installed by spy(): recorded dialog messages and popped-up menus.
type Spies={__dialogs:string[];__menus:Electron.Menu[]};
const root=path.resolve('.'),packaged=!!process.env.HEISEN_EXECUTABLE;
const profile=path.join(root,'.test-data'),legacy=path.join(root,'.test-data-legacy'),importRoot=path.join(root,'.test-data-import'),scratch=path.join(root,'.test-data-csv');
for(const dir of [profile,legacy,importRoot,scratch])await fs.rm(dir,{recursive:true,force:true});
await fs.mkdir(profile,{recursive:true});await fs.mkdir(scratch,{recursive:true});
const HOME='heisen://newtab',FIXTURE_HOST='localhost',CHROME_PASS='fixture-pass',LEGACY_PASS='legacy-pass';
const tag=randomBytes(4).toString('hex');
const LEGACY_SECRETS={openai:{key:'sk-legacy-test'},vault:[{id:'v-legacy',origin:'https://legacy.example',username:'kim',password:'legacy-pw-'+tag}],'claude-code':{connected:true}};
const SYNC_LOGIN={username:'bob',password:'synced-pw-'+tag},CSV_LOGIN={username:'csv-user',password:'csv-pw-'+tag},CSV_OTHER={username:'other-user',password:'other-pw-'+tag};
const NEW_LOGIN={username:'new-user',password:'new-pw-'+tag},UPDATED_PASSWORD='new-pw-2-'+tag,NEVER_LOGIN={username:'never-user',password:'never-pw-'+tag};
const OFF_LOGIN={username:'off-user',password:'off-pw-'+tag},PRESET_PASSWORD='Preset-'+tag+'-Pw7';
// Generated passwords are added when they appear.
const ALL_PASSWORDS=[LEGACY_SECRETS.vault[0].password,CHROME_FIXTURE.login.password,SYNC_LOGIN.password,CSV_LOGIN.password,CSV_OTHER.password,NEW_LOGIN.password,UPDATED_PASSWORD,NEVER_LOGIN.password,OFF_LOGIN.password,PRESET_PASSWORD];
// Fixture server. The host is `localhost` so cookies imported for the Chrome fixture host reach it; it listens on IPv4 loopback only.
const LOGIN='<title>Login fixture</title><h1>Sign in</h1><form action="/done" method="post"><input name="username" autocomplete="username" aria-label="Username"><input type="password" name="password" aria-label="Password"><button type="submit" id="submit">Sign in</button></form>';
// Sign-up form: a minlength attribute plus Korean requirement text (hence the charset), and a confirmation field.
const SIGNUP='<meta charset="utf-8"><title>Signup fixture</title><h1>Sign up</h1><form action="/done" method="post"><input type="email" name="email" aria-label="Email"><input type="password" name="password" autocomplete="new-password" aria-label="Password" minlength="10"><input type="password" name="confirm" autocomplete="new-password" aria-label="Confirm"><p>10~16자, 대문자·숫자·특수문자 포함</p><button id="submit" type="submit">Sign up</button></form>';
const hanging:http.ServerResponse[]=[];let modelCalls=0;
const server=http.createServer(async(req,res)=>{
 const route=(req.url||'').split('?')[0];
 if(route==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'heisen-test-model',name:'Local test model'}]}));return;}
 if(route==='/v1/chat/completions'){
  for await(const _ of req);
  // Local mock model: open the login page in a task tab, then keep the next turn pending so the task (and its tab) stay alive.
  if(modelCalls++>0){hanging.push(res);return;}
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'test',object:'chat.completion',created:Date.now(),model:'heisen-test-model',choices:[{index:0,message:{role:'assistant',content:null,tool_calls:[{id:'c1',type:'function',function:{name:'web_open',arguments:JSON.stringify({url:base+'/login?task=1'})}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));return;
 }
 if(route==='/echo-cookie'){const cookie=String(req.headers.cookie||'');const signed=cookie.split(/;\s*/).includes(`${CHROME_FIXTURE.cookie.name}=${CHROME_FIXTURE.cookie.value}`);res.setHeader('Content-Type','text/html');res.end(`<title>Cookie echo</title><pre id="cookie">${cookie.replace(/[<&]/g,'')}</pre><p id="session">${signed?'Signed in':'Signed out'}</p>`);return;}
 if(route==='/done'){for await(const _ of req);res.setHeader('Content-Type','text/html');res.end('<title>Signed in</title><h1>Signed in</h1>');return;}
 res.setHeader('Content-Type','text/html');res.end(route==='/signup'?SIGNUP:LOGIN);
});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address();assert.ok(address&&typeof address==='object');const base=`http://${FIXTURE_HOST}:${address.port}`;
// Same server under a second origin, for checks that need an origin without the never-save entry `base` gets in step 7.
const altBase=`http://127.0.0.1:${address.port}`;
const baseEnv:Record<string,string>={...process.env as Record<string,string>,HEISEN_TEST_BACKGROUND:process.env.HEISEN_TEST_VISIBLE==='1'?'0':'1',HEISEN_DATA_DIR:profile,HEISEN_BETA_URL:'skip'};delete baseEnv.ELECTRON_RUN_AS_NODE;
for(const k of ['HEISEN_LEGACY_DIR','HEISEN_IMPORT_ROOT','HEISEN_TEST_KEYCHAIN'])delete baseEnv[k];
const errors:string[]=[];let app!:ElectronApplication,page!:Page;
async function launch(env:Record<string,string>){
 const options=packaged?{executablePath:path.resolve(process.env.HEISEN_EXECUTABLE!),args:[],env,timeout:45000}:{args:[root],env,timeout:45000};
 app=await electron.launch(options);page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));app.process().stderr?.on('data',b=>{if(/Error|ERR_/.test(b.toString()))process.stderr.write(b);});
 await page.getByRole('textbox',{name:'주소창'}).waitFor();
}
const rpc=<T=unknown>(m:string,a:object={})=>page.evaluate(([m,a])=>{const ui=window as unknown as Heisen;return ui.heisen.call(m,a);},[m,a] as const) as Promise<T>;
const state=()=>rpc<State>('state');
// Runs code in the main world of the tab whose URL is exactly `url`.
const inPage=<T=unknown>(url:string,code:string)=>app.evaluate(({webContents},[url,code])=>{const wc=webContents.getAllWebContents().find(w=>w.getURL()===url);if(!wc)throw new Error('No tab at '+url);return wc.executeJavaScript(code);},[url,code] as const) as Promise<T>;
const loaded=(url:string)=>expect.poll(()=>inPage<string>(url,'document.readyState').catch(()=>'missing'),{timeout:15000}).toBe('complete');
// Trusted mouse click (down + up) at the centre of `selector`, sent as native input to the tab's webContents.
const click=(url:string,selector:string)=>app.evaluate(async({webContents},[url,selector])=>{
 const wc=webContents.getAllWebContents().find(w=>w.getURL()===url);if(!wc)throw new Error('No tab at '+url);
 const r:{x:number;y:number}=await wc.executeJavaScript(`(()=>{const b=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)};})()`);
 wc.sendInputEvent({type:'mouseDown',x:r.x,y:r.y,button:'left',clickCount:1});wc.sendInputEvent({type:'mouseUp',x:r.x,y:r.y,button:'left',clickCount:1});
},[url,selector] as const);
const fields=(url:string)=>inPage<[string,string]>(url,"[document.querySelector('[name=username]').value,document.querySelector('[name=password]').value]");
// Auto-answers dialog.showMessageBox with button 1, turns off Touch ID and records native menus instead of showing them.
const spy=()=>app.evaluate(({dialog,systemPreferences,Menu})=>{
 const g=globalThis as typeof globalThis&Spies;g.__dialogs=[];g.__menus=[];
 dialog.showMessageBox=(async(...a:{message:string}[])=>{g.__dialogs.push(a[a.length-1].message);return {response:1,checkboxChecked:false};}) as unknown as typeof dialog.showMessageBox;
 systemPreferences.canPromptTouchID=()=>false;
 Menu.prototype.popup=function(this:Electron.Menu){g.__menus.push(this);};
});
const dialogs=()=>app.evaluate(()=>(globalThis as typeof globalThis&Spies).__dialogs.slice());
const menus=()=>app.evaluate(()=>(globalThis as typeof globalThis&Spies).__menus.map(m=>m.items.map(i=>i.type==='separator'?'-':i.label)));
// Decrypts one secrets.json entry with the app's own safeStorage.
async function secret<T>(name:string):Promise<T|undefined>{const values=JSON.parse(await fs.readFile(path.join(profile,'secrets.json'),'utf8'));if(!values[name])return undefined;return JSON.parse(await app.evaluate(({safeStorage},b64)=>safeStorage.decryptString(Buffer.from(b64,'base64')),values[name] as string));}
function hashes(dir:string,out:Record<string,string>={},rel=''):Promise<Record<string,string>>{
 return (async()=>{for(const e of await fs.readdir(path.join(dir,rel),{withFileTypes:true})){const p=path.join(rel,e.name),full=path.join(dir,p);if(e.isDirectory())await hashes(dir,out,p);else{const st=await fs.lstat(full);out[p]=createHash('sha256').update(st.isSymbolicLink()?'link:'+await fs.readlink(full):await fs.readFile(full)).digest('hex')+':'+st.mode+':'+st.mtimeMs;}}return out;})();
}
const exists=(file:string)=>fs.access(file).then(()=>true,()=>false);
// Chrome stores times as microseconds since 1601-01-01.
const chromeTime=(ms:number)=>BigInt(ms)*1000n+11644473600000000n;
let chromeProfile='';
try{
 if(packaged){
  // Packaged builds ignore the legacy/import/keychain hooks; start from an empty profile that never offers an import (no real browser profile is read).
  await fs.writeFile(path.join(profile,'library.json'),JSON.stringify({settings:{importOffered:true,onboarded:true}}));
  for(const name of ['Own migration','first-run wizard','Chrome import','imported cookie session','autosync'])console.log(`SKIP ${name} (packaged: HEISEN_LEGACY_DIR / HEISEN_IMPORT_ROOT / HEISEN_TEST_KEYCHAIN are dev-only)`);
 }else{
  // 1. Fake Own userData (same layout as tests/migrate.test.ts) + fake Chrome profile under a fake Application Support root.
  const put=async(rel:string,text:string)=>{const file=path.join(legacy,rel);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,text);};
  await put('library.json',JSON.stringify({bookmarks:[{id:'b1',title:'Legacy one',url:'https://legacy-one.example/'},{id:'b2',title:'Legacy two',url:'https://legacy-two.example/'}],tabs:[{url:'own://newtab',title:'새 탭',pinned:false}],activeTab:0,settings:{provider:'local',model:'legacy-model'}}));
  const ownKey=deriveKey(LEGACY_PASS);await put('secrets.json',JSON.stringify(Object.fromEntries(Object.entries(LEGACY_SECRETS).map(([k,v])=>[k,encryptV10(JSON.stringify(v),ownKey).toString('base64')]))));
  await put('Partitions/browser/Cache/legacy-cache-entry','cache');await put('GPUCache/legacy-gpu','gpu cache');await put('.workspace/t/a.txt','workspace file');
  await put('Local State','{"legacy-marker":true}');await put('claude-code/settings.json','{"theme":"dark"}');
  const legacyBefore=await hashes(legacy);
  chromeProfile=makeChromeProfile(importRoot,{password:CHROME_PASS,host:FIXTURE_HOST}).profile;
  await launch({...baseEnv,HEISEN_LEGACY_DIR:legacy,HEISEN_IMPORT_ROOT:importRoot,HEISEN_TEST_KEYCHAIN:JSON.stringify({'Own Safe Storage':LEGACY_PASS,'Chrome Safe Storage':CHROME_PASS})});
  const record=JSON.parse(await fs.readFile(path.join(profile,'migration.json'),'utf8'));
  assert.equal(record.status,'done');assert.equal(record.secrets,'migrated');assert.equal(record.from,legacy);assert.equal('claudeSecureStorageDir' in record,false);assert.equal(await secret('claude-code'),undefined);
  let s=await state();
  assert.deepEqual(s.bookmarks.map(b=>b.url),['https://legacy-one.example/','https://legacy-two.example/']);
  assert.ok(s.tabs.some(t=>t.url===HOME),JSON.stringify(s.tabs));assert.ok(!s.tabs.some(t=>t.url.startsWith('own:')),JSON.stringify(s.tabs));
  assert.equal(s.settings.model,'legacy-model');assert.equal(s.providers.find(p=>p.id==='openai')?.connected,true);
  assert.equal(s.vault.length,1);assert.equal(s.vault[0].username,'kim');assert.ok(!('password' in s.vault[0]));
  const legacySecrets=JSON.parse(await fs.readFile(path.join(legacy,'secrets.json'),'utf8')),newSecrets=JSON.parse(await fs.readFile(path.join(profile,'secrets.json'),'utf8'));
  assert.deepEqual(Object.keys(newSecrets).sort(),[...Object.keys(legacySecrets).filter(k=>k!=='claude-code'),'sealKey'].sort());for(const k of Object.keys(legacySecrets).filter(k=>k!=='claude-code'))assert.notEqual(newSecrets[k],legacySecrets[k],`${k} not re-encrypted`);
  assert.deepEqual(await secret('openai'),LEGACY_SECRETS.openai);
  assert.equal((await fs.readFile(path.join(profile,'library.json'))).subarray(0,4).toString(),'HSN1');
  assert.deepEqual((await readLibrary(app,profile)).bookmarks.map(b=>b.url),['https://legacy-one.example/','https://legacy-two.example/']);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(profile,'launch.json'),'utf8')),{agentApi:false});
  assert.equal(await exists(path.join(profile,'library.json.v0')),true);
  assert.equal(await exists(path.join(profile,'Partitions/browser/Cache/legacy-cache-entry')),false);assert.equal(await exists(path.join(profile,'GPUCache/legacy-gpu')),false);
  assert.ok(!(await fs.readFile(path.join(profile,'Local State'),'utf8').catch(()=>'')).includes('legacy-marker'),'root Local State copied');
  assert.equal(await fs.readFile(path.join(profile,'.workspace/t/a.txt'),'utf8'),'workspace file');assert.equal(await fs.readFile(path.join(profile,'claude-code/settings.json'),'utf8'),'{"theme":"dark"}');
  console.log('PASS Own migration: 2 bookmarks, new tab → heisen://newtab, openai connected, vault 1 (re-encrypted secrets), legacy Claude credential removed, caches + root Local State not copied');
  // 2. First-run wizard: it opens by itself. Step 1 keeps the password manager on, step 2 imports the fixture Chrome profile with every
  // item (cookies are on by default), step 3 sets the default sign-up email.
  const wizard=page.getByRole('dialog',{name:'Heisen 시작'});await wizard.waitFor({timeout:15000});
  const counter=wizard.locator('.onboarding-step');
  assert.equal(await wizard.getByRole('checkbox',{name:'비밀번호 저장 및 자동 완성'}).isChecked(),true);
  await expect(wizard.getByRole('button',{name:'다음'})).toBeEnabled({timeout:15000});await expect(counter).toHaveText('1/3');
  await page.screenshot({path:path.join(root,'docs','onboarding.png')});
  await wizard.getByRole('button',{name:'다음'}).click();await expect(counter).toHaveText('2/3');
  assert.equal(await wizard.getByRole('checkbox',{name:'Google Chrome',exact:true}).isChecked(),true);
  for(const name of ['북마크','저장된 비밀번호','방문 기록','쿠키'])assert.equal(await wizard.getByRole('checkbox',{name,exact:true}).isChecked(),true,`${name} not checked by default`);
  await wizard.getByRole('button',{name:'가져오기',exact:true}).click();
  await wizard.locator('.import-result').waitFor({timeout:30000});
  const lines=(await wizard.locator('.import-result p').allTextContents()).map(t=>t.trim());
  // Fixture: 1 valid login (blacklisted/android skipped), 2 cookies (partitioned/expired skipped), 4 unique http(s) bookmarks, 2 visible history rows.
  const imported=/^Google Chrome: 비밀번호 1개 · 쿠키 (\d+)개 · 북마크 4개 · 방문 기록 2개$/.exec(lines[0]??'');assert.equal(lines.length,1,lines.join(' | '));assert.ok(imported&&Number(imported[1])>=2,lines.join(' | '));
  await wizard.getByRole('button',{name:'다음'}).click();await expect(counter).toHaveText('3/3');
  assert.equal(await wizard.getByRole('combobox',{name:'비밀번호'}).inputValue(),'generate');
  await wizard.getByRole('textbox',{name:'기본 이메일'}).fill('tester@example.com');
  await wizard.getByRole('button',{name:'완료'}).click();await wizard.waitFor({state:'hidden'});
  await expect.poll(async()=>(await state()).settings.onboarded).toBe(true);
  s=await state();
  assert.equal(s.settings.importOffered,true);assert.equal(s.settings.vault,true);assert.deepEqual(s.settings.signup.emails,['tester@example.com']);assert.equal(s.settings.signup.mode,'generate');
  assert.equal(s.vault.length,2);assert.ok(s.vault.some(v=>v.origin===`https://${FIXTURE_HOST}`&&v.username===CHROME_FIXTURE.login.username),JSON.stringify(s.vault));
  assert.equal(s.bookmarks.length,6);assert.ok(s.history.some(h=>h.url===`https://${FIXTURE_HOST}/newer`));
  assert.deepEqual(s.importSources.map(i=>[i.browser,i.profile]),[['chrome','Default']]);
  console.log(`PASS first-run wizard: opened by itself (1/3 → 2/3 → 3/3), vault on → ${lines[0]} (cookies on by default) → default email tester@example.com; vault 2, bookmarks 6, onboarded + importOffered saved`);
  // 3. The imported cookies are sent to the fixture server: the signed-in session carries over.
  await rpc('tab.new',{url:base+'/echo-cookie'});await loaded(base+'/echo-cookie');
  const echoed=await inPage<string>(base+'/echo-cookie',"document.getElementById('cookie').textContent");
  assert.ok(echoed.includes(`${CHROME_FIXTURE.plainCookie.name}=${CHROME_FIXTURE.plainCookie.value}`),echoed);
  assert.equal(await inPage(base+'/echo-cookie',"document.getElementById('session').textContent"),'Signed in',`encrypted session cookie not sent: ${echoed}`);
  assert.ok(!echoed.includes(CHROME_FIXTURE.partitionedCookie.value)&&!echoed.includes(CHROME_FIXTURE.expiredCookie.value),echoed);
  console.log('PASS imported cookies: fixture server received the decrypted session cookie + plain cookie (Signed in)');
  await app.close();
  assert.deepEqual(await hashes(legacy),legacyBefore,'Own folder changed');
  console.log(`PASS Own folder untouched (${Object.keys(legacyBefore).length} files, sha256/mode/mtime identical)`);
 }
 // Second launch (dev) / only launch (packaged). In dev the keychain map no longer has Chrome's entry, so autosync can only use the stored key.
 const recordBefore=packaged?'':await fs.readFile(path.join(profile,'migration.json'),'utf8');
 if(!packaged)await fs.writeFile(path.join(legacy,'.workspace/t/after.txt'),'added after migration');
 await launch(packaged?baseEnv:{...baseEnv,HEISEN_LEGACY_DIR:legacy,HEISEN_IMPORT_ROOT:importRoot,HEISEN_TEST_KEYCHAIN:JSON.stringify({'Own Safe Storage':LEGACY_PASS})});
 if(!packaged)assert.equal(await exists(path.join(profile,'library.json.v0')),false,'authenticated reopen must remove the plaintext library backup');
 await spy();
 let s=await state();
 if(!packaged){
  assert.equal(await fs.readFile(path.join(profile,'migration.json'),'utf8'),recordBefore);assert.equal(await exists(path.join(profile,'.workspace/t/after.txt')),false);
  assert.equal(s.settings.onboarded,true);await sleep(1500);assert.equal(await page.getByRole('dialog',{name:'Heisen 시작'}).count(),0);assert.equal(await page.getByRole('dialog',{name:'북마크 및 설정 가져오기'}).count(),0);
  console.log('PASS restart: no second migration (migration.json unchanged, new Own file not copied), wizard not shown again');
  // 4. Autosync: a new row in Chrome's Login Data is picked up with the stored key, without any dialog.
  const before=s.vault.length,lastSync=s.importSources[0].lastSync,file=path.join(chromeProfile,'Login Data');
  const db=new DatabaseSync(file);db.prepare('INSERT INTO logins VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(`https://${FIXTURE_HOST}/sync`,'','username',SYNC_LOGIN.username,'password',encryptV10(SYNC_LOGIN.password,deriveKey(CHROME_PASS)),'',`https://${FIXTURE_HOST}/`,chromeTime(Date.now()),0,0);db.close();
  const later=new Date(Date.now()+5000);await fs.utimes(file,later,later);
  assert.equal(await rpc('import.sync'),true);
  s=await state();assert.equal(s.vault.length,before+1);assert.ok(s.vault.some(v=>v.username===SYNC_LOGIN.username));
  assert.ok(!s.importSources[0].needsAuth);assert.ok(s.importSources[0].lastSync>lastSync);assert.deepEqual(await dialogs(),[]);
  assert.ok((await secret<Record<string,string>>('importKeys'))?.chrome,'stored Chrome key missing');
  console.log(`PASS autosync: new Login Data row → vault ${before}→${s.vault.length} using the stored key (no keychain entry, 0 dialogs)`);
 }
 // 5. CSV import through a stubbed file dialog.
 const csv=path.join(scratch,'passwords.csv');
 await fs.writeFile(csv,`name,url,username,password,note\r\nFixture,${base}/login,${CSV_LOGIN.username},${CSV_LOGIN.password},\r\n"Other, site",https://other.example/,${CSV_OTHER.username},"${CSV_OTHER.password}","note"\r\n`);
 await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=(async()=>({canceled:false,filePaths:[file]})) as unknown as typeof dialog.showOpenDialog;},csv);
 let count=(await state()).vault.length;
 assert.deepEqual(await rpc('import.csv'),{added:2,updated:0});
 s=await state();assert.equal(s.vault.length,count+2);assert.ok(s.vault.some(v=>v.origin===base&&v.username===CSV_LOGIN.username),JSON.stringify(s.vault));
 console.log('PASS CSV import: {added:2,updated:0}');
 // 6. Autofill: a trusted click on the username field shows the saved accounts as a native menu; choosing one fills both fields.
 const login1=base+'/login?n=1';await rpc('tab.new',{url:login1});await loaded(login1);
 await click(login1,'[name=username]');
 await expect.poll(async()=>(await menus()).length,{timeout:5000}).toBe(1);
 const labels=(await menus())[0];assert.deepEqual(labels,[CSV_LOGIN.username,'-','비밀번호 관리…']);
 await app.evaluate(()=>{(globalThis as typeof globalThis&Spies).__menus[0].items[0].click();});await expect.poll(()=>fields(login1)).toEqual([CSV_LOGIN.username,CSV_LOGIN.password]);
 console.log(`PASS autofill: field click → menu [${labels.join(', ')}] → fill writes username + password in the page`);
 await expect.poll(async()=>(await state()).activePasswords).toBe(1);
 await page.getByRole('button',{name:'저장된 비밀번호'}).click();
 await expect.poll(async()=>(await menus()).length).toBe(2);assert.equal((await menus())[1][0],CSV_LOGIN.username);
 console.log('PASS key icon "저장된 비밀번호" → same account menu');
 // 7. Save / update / never prompts after a trusted submit click.
 const submit=async(url:string,v:{username:string;password:string})=>{await inPage(url,`document.querySelector('[name=username]').value=${JSON.stringify(v.username)};document.querySelector('[name=password]').value=${JSON.stringify(v.password)};true`);await click(url,'#submit');await loaded(new URL(url).origin+'/done');};
 count=(await state()).vault.length;
 await submit(login1,NEW_LOGIN);
 await expect.poll(async()=>(await state()).passwordPrompts.length).toBe(1);
 s=await state();const prompt=s.passwordPrompts[0];
 assert.equal(prompt.kind,'save');assert.equal(prompt.username,NEW_LOGIN.username);assert.equal(prompt.origin,base);assert.ok(!('password' in prompt));assert.ok(!JSON.stringify(s).includes(NEW_LOGIN.password),'password in UI state');
 const infobar=page.getByRole('alert').filter({hasText:'비밀번호를 저장하시겠습니까?'});await infobar.waitFor();
 await infobar.getByRole('button',{name:'저장',exact:true}).click();
 await expect.poll(async()=>(await state()).vault.length).toBe(count+1);assert.equal((await state()).passwordPrompts.length,0);
 const savedAt=(await state()).vault.find(v=>v.origin===base&&v.username===NEW_LOGIN.username)!.updatedAt!;
 console.log('PASS save prompt: kind save without password → 저장 → vault +1');
 const login3=base+'/login?n=3';await rpc('tab.navigate',{url:login3});await loaded(login3);
 await submit(login3,{username:NEW_LOGIN.username,password:UPDATED_PASSWORD});
 await expect.poll(async()=>(await state()).passwordPrompts[0]?.kind).toBe('update');
 await page.getByRole('alert').filter({hasText:'비밀번호를 업데이트하시겠습니까?'}).getByRole('button',{name:'업데이트'}).click();
 await expect.poll(async()=>(await state()).passwordPrompts.length).toBe(0);
 s=await state();assert.equal(s.vault.length,count+1);assert.ok(s.vault.find(v=>v.origin===base&&v.username===NEW_LOGIN.username)!.updatedAt!>savedAt);
 assert.equal((await secret<{origin:string;username:string;password:string}[]>('vault'))!.find(v=>v.origin===base&&v.username===NEW_LOGIN.username)!.password,UPDATED_PASSWORD);
 console.log('PASS update prompt: same username, new password → 업데이트 → entry replaced (no duplicate)');
 const login4=base+'/login?n=4';await rpc('tab.navigate',{url:login4});await loaded(login4);
 await submit(login4,NEVER_LOGIN);
 await expect.poll(async()=>(await state()).passwordPrompts[0]?.kind).toBe('save');
 await page.getByRole('alert').getByRole('button',{name:'사용 안함'}).click();
 await expect.poll(async()=>(await state()).passwordPrompts.length).toBe(0);
 await expect.poll(async()=>(await readLibrary(app,profile)).neverSave,{timeout:5000}).toEqual([base]);
 const login5=base+'/login?n=5';await rpc('tab.navigate',{url:login5});await loaded(login5);
 await submit(login5,{username:'never-user-2',password:NEVER_LOGIN.password+'-2'});await sleep(1500);
 assert.equal((await state()).passwordPrompts.length,0,'prompt shown for a never-save origin');assert.equal((await state()).vault.length,count+1);
 console.log('PASS 사용 안함: origin added to neverSave, later submits on it show no prompt');
 // 7b. 강력한 비밀번호 사용 on a sign-up form (altBase: base is never-save now, which skips the username adoption). The generated password
 // fits the form's rules (minlength 10 + "10~16자, 대문자·숫자·특수문자"), fills both fields and is saved at once without a username.
 const signupURL=altBase+'/signup';await rpc('tab.navigate',{url:signupURL});await loaded(signupURL);
 let menuCount=(await menus()).length;await click(signupURL,'[name=password]');
 await expect.poll(async()=>(await menus()).length,{timeout:5000}).toBe(menuCount+1);
 const strongMenu=(await menus()).at(-1)!;assert.deepEqual(strongMenu,['강력한 비밀번호 사용','-','비밀번호 관리…']);
 count=(await state()).vault.length;
 await app.evaluate(()=>{(globalThis as typeof globalThis&Spies).__menus.at(-1)!.items[0].click();});
 const pairCode="[document.querySelector('[name=password]').value,document.querySelector('[name=confirm]').value]";
 await expect.poll(async()=>(await inPage<[string,string]>(signupURL,pairCode))[0].length,{timeout:5000}).toBeGreaterThan(0);
 const [strong,confirmed]=await inPage<[string,string]>(signupURL,pairCode);ALL_PASSWORDS.push(strong);
 assert.ok(confirmed===strong,'confirmation field differs');assert.ok(strong.length>=10&&strong.length<=16,`length ${strong.length}`);
 for(const [re,what] of [[/[A-Z]/,'uppercase'],[/[2-9]/,'digit'],[/[-_.:!]/,'symbol']] as const)assert.ok(re.test(strong),`no ${what}`);
 assert.ok(!/[lIO01o]/.test(strong),'ambiguous character');
 await expect.poll(async()=>(await state()).vault.filter(v=>v.origin===altBase&&v.signup?.by==='user').map(v=>v.username)).toEqual(['']);assert.equal((await state()).vault.length,count+1);
 assert.ok((await secret<{origin:string;username:string;password:string}[]>('vault'))!.find(v=>v.origin===altBase&&v.username==='')!.password===strong,'vault holds another password');
 await inPage(signupURL,"document.querySelector('[name=email]').value='strong@example.com';true");await click(signupURL,'#submit');await loaded(altBase+'/done');await sleep(1500);
 s=await state();assert.equal(s.passwordPrompts.length,0,'save prompt for the suggested password');assert.equal(s.vault.length,count+1);
 assert.deepEqual(s.vault.filter(v=>v.origin===altBase&&v.signup?.by==='user').map(v=>v.username),['strong@example.com']);
 console.log(`PASS 강력한 비밀번호 사용: new-password field → menu [${strongMenu.join(', ')}] → ${strong.length} chars (upper/digit/symbol, no l I O 0 1 o) in both fields, saved without a username; submit adopted strong@example.com without a prompt`);
 // 7c. Password manager off: no key icon, field menu or save prompt on a site with a saved account; turned back on, the key icon returns.
 const login6=altBase+'/login?n=6';await rpc('tab.navigate',{url:login6});await loaded(login6);
 await expect.poll(async()=>(await state()).activePasswords).toBe(1);
 await rpc('vault.toggle',{enabled:false});
 s=await state();assert.equal(s.settings.vault,false);assert.equal(s.activePasswords,0);await expect(page.getByRole('button',{name:'저장된 비밀번호'})).toHaveCount(0);
 menuCount=(await menus()).length;await click(login6,'[name=username]');await sleep(1500);assert.equal((await menus()).length,menuCount,'menu shown with the password manager off');
 await submit(login6,OFF_LOGIN);await sleep(1500);s=await state();assert.equal(s.passwordPrompts.length,0,'prompt shown with the password manager off');assert.equal(s.vault.length,count+1);
 await rpc('vault.toggle',{enabled:true});await expect.poll(async()=>(await state()).activePasswords).toBe(1);await expect(page.getByRole('button',{name:'저장된 비밀번호'})).toHaveCount(1);
 console.log('PASS vault off: activePasswords 0, no key icon, field click → no menu, submit → no prompt; back on → key icon again');
 // 8. Task-owned tab: the same click shows no menu.
 await rpc('auth.save',{provider:'local',baseURL:base+'/v1'});await rpc('settings.save',{provider:'local',model:'heisen-test-model'});
 const userTab=(await state()).active,taskURL=base+'/login?task=1';const task=await rpc<{id:string}>('task.start',{prompt:'Open the fixture login.',urls:[taskURL]});
 await expect.poll(async()=>(await state()).tabs.find(t=>t.taskId===task.id&&t.url===taskURL)?.id,{timeout:20000}).toBeTruthy();
 await loaded(taskURL);const taskTab=(await state()).tabs.find(t=>t.taskId===task.id)!.id;
 await rpc('tab.select',{id:taskTab});await expect.poll(async()=>(await state()).active).toBe(taskTab);
 const menusBefore=(await menus()).length;await click(taskURL,'[name=username]');await sleep(1500);
 assert.equal((await menus()).length,menusBefore,'menu shown in a task tab');assert.deepEqual(await fields(taskURL),['','']);
 await rpc('task.cancel',{id:task.id});for(const r of hanging.splice(0))r.destroy();await rpc('tab.select',{id:userTab});
 console.log('PASS task tab: field click shows no autofill menu');
 // 9. Copy from the password manager: confirmation dialog (Touch ID off) → clipboard holds the password.
 const clipboardBefore=await app.evaluate(({clipboard})=>clipboard.readText());
 try{
  await rpc('route',{route:'vault'});
  const dialogCount=(await dialogs()).length;
  await page.locator('.library-row').filter({hasText:CSV_LOGIN.username}).getByRole('button',{name:'비밀번호 복사'}).click();
  await expect.poll(async()=>(await dialogs()).length).toBe(dialogCount+1);assert.equal((await dialogs()).at(-1),'비밀번호를 복사할까요?');
  await expect.poll(()=>app.evaluate(({clipboard})=>clipboard.readText())).toBe(CSV_LOGIN.password);
 }finally{await app.evaluate(({clipboard},text)=>clipboard.writeText(text),clipboardBefore);}
 console.log('PASS 비밀번호 복사: confirmation "비밀번호를 복사할까요?" → clipboard = password (clipboard restored afterwards)');
 // 10. Settings → 자동 완성 및 비밀번호: the 자동 회원가입 block lists the wizard's email; an added email, preset mode and a preset go
 // through the UI (the preset password only in secrets.json); the block is hidden while the password manager is off.
 const copied=page.getByRole('status').filter({hasText:'복사됨'});await expect(copied).toBeVisible();await copied.getByRole('button',{name:'닫기'}).click();await expect(copied).toHaveCount(0);
 await rpc('route',{route:'settings'});await page.getByRole('button',{name:'자동 완성 및 비밀번호'}).click();
 const signupBlock=page.locator('.signup-settings');await expect(signupBlock.getByRole('heading',{name:'자동 회원가입'})).toBeVisible();
 await signupBlock.getByRole('textbox',{name:'이메일 추가'}).fill('second@example.com');await signupBlock.getByRole('button',{name:'추가',exact:true}).click();
 // Each change sends the whole setting as rendered, so wait for the new row before the next change.
 const emails=[...(packaged?[]:['tester@example.com']),'second@example.com'];await expect(signupBlock.locator('.library-row b')).toHaveText(emails.map(e=>e===emails[0]?e+'기본':e));
 await signupBlock.getByRole('combobox',{name:'비밀번호'}).selectOption('preset');await expect.poll(async()=>(await state()).settings.signup.mode).toBe('preset');
 assert.deepEqual((await state()).settings.signup.emails,emails);
 await signupBlock.getByRole('button',{name:'세트 추가'}).click();
 const presetModal=page.getByRole('dialog',{name:'비밀번호 세트 추가'});await presetModal.waitFor();
 await presetModal.getByRole('textbox',{name:'이름'}).fill('기본');await presetModal.getByLabel('비밀번호').fill(PRESET_PASSWORD);
 await presetModal.getByRole('button',{name:'저장'}).click();await presetModal.waitFor({state:'hidden'});
 await expect.poll(async()=>(await state()).signupPresets.map(p=>[p.name,p.length])).toEqual([['기본',PRESET_PASSWORD.length]]);
 assert.ok((await secret<{name:string;password:string}[]>('signupPresets'))?.[0]?.password===PRESET_PASSWORD,'preset not in secrets.json');
 await signupBlock.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(root,'docs','signup-settings.png')});
 // The switch is controlled by app state (vault.toggle round trip), so click and wait instead of Playwright's check()/uncheck().
 const vaultSwitch=page.getByRole('checkbox',{name:'비밀번호 저장 및 자동 완성'});
 await vaultSwitch.click();await expect(signupBlock).toHaveCount(0);await expect(vaultSwitch).not.toBeChecked();
 await vaultSwitch.click();await expect(signupBlock).toHaveCount(1);await expect(vaultSwitch).toBeChecked();
 await rpc('route',{route:'vault'});
 console.log(`PASS 자동 회원가입 settings: emails [${emails.join(', ')}], mode preset, preset 기본 (${PRESET_PASSWORD.length}자) via 세트 추가; block hidden while the switch is off; screenshot docs/signup-settings.png`);
 // 11. No password ever reaches the UI state.
 const json=JSON.stringify(await state());const leaked=ALL_PASSWORDS.filter(p=>json.includes(p));assert.deepEqual(leaked,[],'password in UI state');
 assert.ok(!JSON.stringify(await readLibrary(app,profile)).includes(CSV_LOGIN.password),'password in library.json');
 console.log(`PASS UI state contains none of ${ALL_PASSWORDS.length} known passwords (vault ${(await state()).vault.length} entries)`);
 // 12. Screenshot: password manager with the import dialog (dev only — packaged import.sources would scan the real Application Support).
 if(packaged)console.log('SKIP docs/passwords.png (packaged: import dialog would scan real browser folders)');
 else{
  await page.getByRole('button',{name:'가져오기',exact:true}).click();
  const modal=page.getByRole('dialog',{name:'북마크 및 설정 가져오기'});await modal.waitFor();await expect(modal.getByLabel('가져올 위치')).toBeEnabled();
  await page.screenshot({path:path.join(root,'docs','passwords.png')});
  await modal.getByRole('button',{name:'취소'}).click();await modal.waitFor({state:'hidden'});
  console.log('PASS screenshot docs/passwords.png');
 }
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('ALL DATA CHECKS PASSED');
}finally{
 await app?.close().catch(()=>{});for(const r of hanging)r.destroy();server.closeAllConnections();server.close();
 for(const dir of [legacy,importRoot,scratch])await fs.rm(dir,{recursive:true,force:true});
}
