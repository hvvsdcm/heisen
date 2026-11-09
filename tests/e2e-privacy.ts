import {_electron as electron,type ElectronApplication,type Page} from 'playwright';
import {expect} from 'playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import https from 'node:https';
import {once} from 'node:events';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {FiltersEngine,Request} from '@ghostery/adblocker';
import {readLibrary} from './lib.ts';
import {hostHash,LISTS} from '../src/safebrowsing.ts';

// Local network observations, public RPC and real page/toolbar interactions. No production security bypasses.
type Tab={id:number;url:string;readable:boolean;reader:boolean;protected:boolean;loading:boolean;privacy:{blocked:number;cookies:number;params:number;hosts:string[]};block?:{kind:string;canProceed:boolean}};
type State={active:number;tabs:Tab[];settings:{privacy:{ads:boolean;trackers:boolean;thirdPartyCookies:string};reader:{size:number;theme:string}}};
type Ui={heisen:{call(method:string,args:unknown):Promise<unknown>}};
type Observation={site:string;url:string;headers:http.IncomingHttpHeaders};
const root=path.resolve('.'),work=await fs.mkdtemp(path.join(os.tmpdir(),'heisen-privacy-')),profile=path.join(work,'profile');
const requests:Observation[]=[],errors:string[]=[];
let app:ElectronApplication|undefined,page:Page,base='',third='';
const servers:http.Server[]=[];
const paragraph='READER-FIXTURE-WORD Privacy protects people who read and explore the web. This original fixture describes a quiet public library where readers choose books, compare sources, and keep their personal notes private. Every chapter explains why a browser should preserve useful content while removing unrelated scripts and navigation. The article contains complete sentences and enough meaningful text for readability detection, rather than repeated links or a short application screen. Visitors can follow the source link after reading and return to the original document without losing their place.';
const article=`<!doctype html><html lang="en"><head><title>A private reading room</title></head><body><nav>Unrelated navigation</nav><article><h1>A private reading room</h1>${Array.from({length:8},(_,i)=>`<p>Chapter ${i+1}. ${paragraph}</p>`).join('')}<p><a id="reader-link" href="/landing?reader=1">Visit the original source</a></p><script>window.fixtureScript=true</script></article></body></html>`;
function handler(site:string):http.RequestListener{return (req,res)=>{
 const url=new URL(req.url||'/',site==='A'?base:third),route=url.pathname;requests.push({site,url:req.url||'/',headers:req.headers});
 res.setHeader('Cache-Control','no-store');res.setHeader('Accept-CH','Sec-CH-UA-Platform-Version, Sec-CH-UA-Model');res.setHeader('Content-Type','text/html; charset=utf-8');
 if(route==='/cookie-set'||route==='/login')res.setHeader('Set-Cookie','b=1; SameSite=None; Secure; Path=/');
 if(route==='/page'){
  // Cookie and referrer requests use fetch so the image/script-only fixture filters cannot hide cookie failures.
  res.end(`<title>Privacy fixture</title><meta name="referrer" content="unsafe-url"><img src="${third}/pixel.png"><script src="${third}/t.js"></script><a id="go" href="${third}/landing?utm_source=x&gclid=abc&keep=1">Cross site</a><a id="same" href="/landing?gclid=abc&keep=1">Same site</a><button id="popup" onclick="window.open('${third}/login','login','width=400,height=400')">Login</button><script>window.done=false;(async()=>{await fetch('${third}/cookie-set',{mode:'no-cors',credentials:'include'});await fetch('${third}/cookie-echo',{mode:'no-cors',credentials:'include'});await fetch('${third}/ref',{mode:'no-cors'});window.done=true})()</script>`);return;
 }
 if(route==='/storage'){res.end(`<title>Storage access parent</title><iframe src="${base}/frame"></iframe>`);return;}
 if(route==='/frame'){res.end('<title>Storage access frame</title><button id="sa" onclick="document.requestStorageAccess().then(()=>document.title=\'granted\',e=>document.title=\'denied: \'+e.name)">Access storage</button>');return;}
 if(route==='/login'){res.end('<title>Popup login</title><script>setTimeout(()=>window.close(),300)</script>');return;}
 if(route==='/article'){res.end(article);return;}
 if(route==='/tracker'){res.end(`<title>Real filter fixture</title><script src="${third}${url.searchParams.get('path')}"></script>`);return;}
 if(route.endsWith('.js')){res.setHeader('Content-Type','application/javascript');res.end('window.trackerArrived=true');return;}
 res.end('<title>Privacy landing</title><p>Local privacy fixture</p>');
};}
async function listen(server:http.Server){servers.push(server);server.listen(0,'127.0.0.1');await once(server,'listening');const addr=server.address();assert.ok(addr&&typeof addr==='object');return addr.port;}
const rpc=<T=unknown>(method:string,args:object={})=>page.evaluate(([m,a])=>(window as unknown as Ui).heisen.call(m,a),[method,args] as const) as Promise<T>;
const state=()=>rpc<State>('state');
async function active(){const s=await state(),t=s.tabs.find(t=>t.id===s.active);assert.ok(t,'active tab missing');return t;}
async function contentsId(){const url=(await active()).url;return app!.evaluate(({webContents},url)=>{const wc=webContents.getAllWebContents().find(w=>w.getURL()===url);if(!wc)throw new Error('No contents at '+url);return wc.id;},url);}
async function inActive<T=unknown>(code:string,gesture=false){const id=await contentsId();return app!.evaluate(({webContents},[id,code,gesture])=>webContents.fromId(id)!.executeJavaScript(code,gesture),[id,code,gesture] as const) as Promise<T>;}
const observations=(site:string,route:string)=>requests.filter(r=>r.site===site&&r.url.split('?')[0]===route);
function latest(site:string,route:string){const r=observations(site,route).at(-1);assert.ok(r,`missing ${site} ${route}`);return r;}
async function navigate(url:string){await rpc('tab.navigate',{url});await expect.poll(async()=>(await active()).loading).toBe(false);}
async function privacyPage(){await navigate(base+'/page?private=secret');await expect.poll(()=>inActive('window.done')).toBe(true);}
async function reloadPrivacy(){const before=observations('B','/cookie-echo').length;await rpc('tab.command',{name:'reload'});await expect.poll(()=>observations('B','/cookie-echo').length).toBeGreaterThan(before);await expect.poll(()=>inActive('window.done')).toBe(true);}
async function siteProtection(protect:boolean){const before=observations('B','/cookie-echo').length;await rpc('privacy.site',{site:'localhost',protect});await expect.poll(()=>observations('B','/cookie-echo').length).toBeGreaterThan(before);await expect.poll(()=>inActive('window.done')).toBe(true);assert.equal((await active()).protected,protect);}
const cookieJar=(host:string)=>app!.evaluate(async({session},host)=>(await session.fromPartition('persist:browser').cookies.get({domain:host})).filter(c=>c.name==='b'),host);
const readerViews=()=>app!.evaluate(({BrowserWindow,WebContentsView})=>BrowserWindow.getAllWindows().flatMap(w=>w.contentView.children).filter(v=>v instanceof WebContentsView&&v.webContents.getURL().startsWith('data:text/html')).map(v=>(v as Electron.WebContentsView).webContents.id));
async function inReader<T=unknown>(code:string){const ids=await readerViews();assert.equal(ids.length,1);return app!.evaluate(({webContents},[id,code])=>webContents.fromId(id)!.executeJavaScript(code,true),[ids[0],code] as const) as Promise<T>;}
try{
 await fs.mkdir(profile);await fs.writeFile(path.join(profile,'library.json'),JSON.stringify({settings:{importOffered:true,onboarded:true,defaultBrowserAsked:true}}));
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',path.join(work,'key.pem'),'-out',path.join(work,'cert.pem'),'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'pipe'});
 const tls={key:await fs.readFile(path.join(work,'key.pem')),cert:await fs.readFile(path.join(work,'cert.pem'))};
 const portA=await listen(https.createServer(tls,handler('A'))),portB=await listen(https.createServer(tls,handler('B'))),portHttp=await listen(http.createServer(handler('HTTP')));
 base=`https://localhost:${portA}`;third=`https://127.0.0.1:${portB}`;
 // Seed the real isolated on-disk list before startup; fresh metadata prevents network feed refreshes during the test.
 await fs.mkdir(path.join(profile,'safebrowsing'));const db=new DatabaseSync(path.join(profile,'safebrowsing','safebrowsing.sqlite'));
 try{
  db.exec('CREATE TABLE hosts(hash INTEGER PRIMARY KEY,lists INTEGER NOT NULL); CREATE TABLE meta(id TEXT PRIMARY KEY,etag TEXT,at INTEGER,count INTEGER); PRAGMA user_version=1;');
  const insert=db.prepare('INSERT INTO hosts VALUES(?,?)');insert.setReadBigInts(true);insert.run(hostHash('danger.heisen.test'),1);
  for(const {id} of LISTS)db.prepare('INSERT INTO meta VALUES(?,NULL,?,1)').run(id,Date.now());
 }finally{db.close();}
 const filters=path.join(work,'filters.txt');await fs.writeFile(filters,`|${third}/pixel.png$image,third-party\n|${third}/t.js$script,third-party\n`);
 const env:Record<string,string>={...process.env as Record<string,string>,HEISEN_TEST_BACKGROUND:process.env.HEISEN_TEST_VISIBLE==='1'?'0':'1',HEISEN_DATA_DIR:profile,HEISEN_BETA_URL:'skip',HEISEN_TEST_FILTERS:filters};delete env.ELECTRON_RUN_AS_NODE;
 const args=[`--host-resolver-rules=MAP cert.heisen.test:443 127.0.0.1:${portA}, MAP danger.heisen.test:443 127.0.0.1:${portA}, MAP http-only.heisen.test:443 127.0.0.1:${portHttp}, MAP http-only.heisen.test:80 127.0.0.1:${portHttp}`,'--no-proxy-server'];
 app=await electron.launch({...(process.env.HEISEN_EXECUTABLE?{executablePath:path.resolve(process.env.HEISEN_EXECUTABLE),args}:{args:[root,...args]}),env,timeout:45000,colorScheme:null});page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.getByRole('textbox',{name:'주소창'}).waitFor();await app.evaluate('globalThis.__name=(fn)=>fn');
 const packaged=await app.evaluate(({app})=>app.isPackaged);assert.equal(packaged,!!process.env.HEISEN_EXECUTABLE);
 // Trust only the two fixture hosts; cert.heisen.test remains untrusted for the certificate interstitial.
 await app.evaluate(({session})=>session.fromPartition('persist:browser').setCertificateVerifyProc((req,cb)=>cb(req.hostname==='localhost'||req.hostname==='127.0.0.1'?0:-3)));
 assert.equal((await state()).settings.privacy.ads,false,'ads must be opt-in');assert.equal((await state()).settings.privacy.trackers,true);assert.equal((await state()).settings.privacy.thirdPartyCookies,'block');
 await privacyPage();
 if(packaged)console.log('SKIP development-only deterministic tracker filters in packaged runtime');
 else{assert.equal(observations('B','/pixel.png').length,0);assert.equal(observations('B','/t.js').length,0);assert.equal((await active()).privacy.blocked,2);assert.deepEqual((await active()).privacy.hosts,['127.0.0.1']);console.log('PASS tracker blocking: two requests cancelled before reaching the server, per-tab host/count');}
 assert.equal((await cookieJar('127.0.0.1')).length,0);assert.equal(latest('B','/cookie-echo').headers.cookie,undefined);assert.ok((await active()).privacy.cookies>=1);
 assert.equal(latest('B','/ref').headers.referer,base+'/');
 await page.getByRole('button',{name:'사이트 정보',exact:true}).click();const info=page.getByRole('dialog',{name:'사이트 정보'});await expect(info).toContainText('localhost');await expect(info).toContainText('교차 사이트 쿠키 차단');await expect(info.getByRole('checkbox',{name:'이 사이트 보호'})).toBeChecked();await page.keyboard.press('Escape');await expect(info).toHaveCount(0);
 await expect.poll(async()=>(await active()).readable).toBe(false);await expect(page.getByRole('button',{name:'읽기 도구',exact:true})).toHaveCount(0);
 const firstId=(await active()).id;await rpc('tab.new',{url:base+'/landing'});assert.deepEqual((await active()).privacy,{blocked:0,cookies:0,params:0,hosts:[]});await rpc('tab.close',{id:(await active()).id});await rpc('tab.select',{id:firstId});
 await navigate(third+'/cookie-set');assert.equal((await cookieJar('127.0.0.1')).length,1);await privacyPage();assert.equal(latest('B','/cookie-echo').headers.cookie,undefined);
 await siteProtection(false);assert.match(latest('B','/cookie-echo').headers.cookie||'',/b=1/);if(!packaged){assert.ok(observations('B','/pixel.png').length>0);assert.ok(observations('B','/t.js').length>0);}
 await siteProtection(true);assert.equal(latest('B','/cookie-echo').headers.cookie,undefined);console.log('PASS cookie request/response blocking, first-party cookies, site exception and restoration, popover and per-tab counters');
 // The shipped binary filter is the source of truth; source text is not shipped in assets/filters.
 const engine=FiltersEngine.deserialize(await fs.readFile(path.join(root,'assets/filters/easyprivacy.bin')));
 const tracker=['/piwik.js','/matomo.js','/analytics.js'].find(p=>engine.match(Request.fromRawDetails({url:third+p,type:'script',sourceUrl:base+'/tracker'})).match);assert.ok(tracker,'shipped EasyPrivacy needs a known local generic tracker fixture');
 await navigate(base+'/tracker?path='+encodeURIComponent(tracker));assert.equal(observations('B',tracker).length,0);assert.equal((await active()).privacy.blocked,1);
 await rpc('prefs.save',{privacy:{trackers:false}});await navigate(base+'/tracker?path='+encodeURIComponent(tracker));assert.equal(observations('B',tracker).length,1);assert.equal((await active()).privacy.blocked,0);await rpc('prefs.save',{privacy:{trackers:true}});console.log('PASS shipped EasyPrivacy rule and trackers preference');
 await privacyPage();
 // Electron's reduced UA does not reliably negotiate high-entropy hints on a self-signed fixture.
 // Supply known network headers through CDP, then observe the actual server to avoid a vacuous absence check.
 const hintWc=await contentsId(),hints={'sec-ch-ua-platform-version':'"15.0.0"','sec-ch-ua-model':'"privacy-fixture"'};
 await app.evaluate(async({webContents},[id,headers])=>{const dbg=webContents.fromId(id)!.debugger;dbg.attach('1.3');await dbg.sendCommand('Network.enable');await dbg.sendCommand('Network.setExtraHTTPHeaders',{headers});},[hintWc,hints] as const);
 try{
  await reloadPrivacy();for(const name of Object.keys(hints))assert.equal(latest('A','/page').headers[name],undefined);
  await rpc('prefs.save',{privacy:{clientHints:false}});await reloadPrivacy();for(const [name,value] of Object.entries(hints))assert.equal(latest('A','/page').headers[name],value);
 }finally{await app.evaluate(({webContents},id)=>webContents.fromId(id)!.debugger.detach(),hintWc);await rpc('prefs.save',{privacy:{clientHints:true}});}
 console.log('PASS high-entropy Client Hints stripping/opt-out with supplied network headers and cross-site origin-only Referer');
 await inActive("document.querySelector('#go').click()",true);await expect.poll(async()=>(await active()).url).toBe(third+'/landing?keep=1');assert.equal(latest('B','/landing').url,'/landing?keep=1');await expect.poll(async()=>(await active()).privacy.params).toBe(1);
 await privacyPage();await inActive("document.querySelector('#same').click()",true);await expect.poll(async()=>(await active()).url).toBe(base+'/landing?gclid=abc&keep=1');assert.equal((await active()).privacy.params,0);
 await rpc('prefs.save',{privacy:{stripParams:false}});await privacyPage();await inActive("document.querySelector('#go').click()",true);await expect.poll(async()=>(await active()).url).toBe(third+'/landing?utm_source=x&gclid=abc&keep=1');assert.equal(latest('B','/landing').url,'/landing?utm_source=x&gclid=abc&keep=1');await rpc('prefs.save',{privacy:{stripParams:true}});console.log('PASS cross-site tracking parameter stripping, same-site preservation, preference opt-out');
 // Reverse the pair for Storage Access so it cannot pass using the later popup's grant.
 await navigate(base+'/cookie-set');await inActive('document.body.click()',true);await navigate(third+'/storage');assert.ok(!(await rpc<string[]>('privacy.grants')).includes('127.0.0.1|localhost'));
 const storageWc=await contentsId();await app.evaluate(async({webContents},id)=>{const frame=webContents.fromId(id)!.mainFrame.frames.find(f=>f.url.includes('/frame'));if(!frame)throw new Error('Storage frame missing');await frame.executeJavaScript("document.querySelector('#sa').click()",true);},storageWc);
 await expect.poll(()=>app!.evaluate(({webContents},id)=>webContents.fromId(id)!.mainFrame.frames.find(f=>f.url.includes('/frame'))?.executeJavaScript('document.title'),storageWc)).toBe('granted');
 assert.ok((await rpc<string[]>('privacy.grants')).includes('127.0.0.1|localhost'));await inActive(`fetch('${base}/cookie-echo',{mode:'no-cors',credentials:'include'}).then(()=>true)`);assert.match(latest('A','/cookie-echo').headers.cookie||'',/b=1/);console.log('PASS Storage Access request grants a visited third party independently of popup grants');
 await privacyPage();assert.ok(!(await rpc<string[]>('privacy.grants')).includes('localhost|127.0.0.1'));const popupCreated=app.waitForEvent('window');await inActive("document.querySelector('#popup').click()",true);const popup=await popupCreated;await expect.poll(()=>popup.isClosed()).toBe(true);await expect.poll(()=>app!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length)).toBe(1);
 await reloadPrivacy();assert.match(latest('B','/cookie-echo').headers.cookie||'',/b=1/);await expect.poll(async()=>(await readLibrary(app!,profile)).privacy.grants['localhost|127.0.0.1']).toBeGreaterThan(Date.now());console.log('PASS real login popup close grants cross-site cookies and persists expiry');
 await navigate(base+'/article');await expect.poll(async()=>(await active()).readable,{timeout:3000}).toBe(true);const readerButton=page.getByRole('button',{name:'읽기 도구',exact:true});await expect(readerButton).toBeVisible();const original=await contentsId();
 assert.equal(await rpc('reader.toggle'),true);await expect(readerButton).toHaveAttribute('aria-pressed','true');assert.equal((await active()).reader,true);assert.match(await inReader<string>('document.body.innerText'),/READER-FIXTURE-WORD/);assert.equal(await inReader('document.querySelector("script")===null'),true);assert.match(await inReader<string>('document.querySelector(\'meta[http-equiv="Content-Security-Policy"]\').content'),/script-src 'none'/);
 assert.equal(await app.evaluate(({BrowserWindow,WebContentsView},id)=>BrowserWindow.getAllWindows().flatMap(w=>w.contentView.children).some(v=>v instanceof WebContentsView&&v.webContents.id===id&&v.getVisible()),original),false);
 await rpc('reader.set',{size:22,theme:'sepia'});await expect.poll(()=>inReader('getComputedStyle(document.documentElement).fontSize')).toBe('22px');await expect.poll(()=>inReader('getComputedStyle(document.body).backgroundColor')).toBe('rgb(244, 236, 216)');
 await inReader("document.querySelector('#reader-link').click()");await expect.poll(async()=>(await active()).url).toBe(base+'/landing?reader=1');assert.equal((await active()).reader,false);assert.deepEqual(await readerViews(),[]);
 await navigate(base+'/article');assert.equal(await rpc('reader.toggle'),true);assert.equal(await rpc('reader.toggle'),false);assert.deepEqual(await readerViews(),[]);assert.equal((await active()).reader,false);
 assert.equal(await rpc('reader.toggle'),true);await navigate(base+'/landing');assert.equal((await active()).reader,false);assert.deepEqual(await readerViews(),[]);console.log('PASS Reader detection, sanitized isolated view/CSP, original view hidden, preferences, link navigation, toggle and navigation cleanup');
 await navigate('https://cert.heisen.test/');assert.equal((await active()).block?.kind,'cert');assert.equal((await active()).block?.canProceed,false);await expect(page.getByRole('heading',{name:'인증서를 확인할 수 없음'})).toBeVisible();await expect(page.locator('.page-block').getByRole('button',{name:'계속',exact:true})).toHaveCount(0);
 await assert.rejects(async()=>rpc('tab.block',{id:(await active()).id,action:'proceed'}),/계속할 수 없습니다/);await page.getByRole('button',{name:'뒤로 가기',exact:true}).click();console.log('PASS self-signed certificate interstitial has no proceed UI or RPC bypass');
 await navigate('http://http-only.heisen.test/');assert.equal((await active()).block?.kind,'http');assert.equal(observations('HTTP','/').length,0);await expect(page.getByRole('heading',{name:'안전하지 않은 연결'})).toBeVisible();await page.locator('.page-block').getByRole('button',{name:'계속',exact:true}).click();await expect.poll(()=>observations('HTTP','/').length).toBeGreaterThan(0);await expect.poll(async()=>(await active()).block).toBeUndefined();assert.equal((await active()).url,'http://http-only.heisen.test/');console.log('PASS HTTP fallback requires explicit consent before plaintext request');
 await navigate('https://danger.heisen.test/');assert.equal((await active()).block?.kind,'danger');await expect(page.getByRole('heading',{name:'위험한 사이트'})).toBeVisible();await expect(page.locator('.page-block').getByRole('button',{name:'계속',exact:true})).not.toBeVisible();await page.locator('.page-block summary').click();await expect(page.locator('.page-block').getByRole('button',{name:'계속',exact:true})).toBeVisible();await page.getByRole('button',{name:'뒤로 가기',exact:true}).click();
 await rpc('tab.new',{url:'https://danger.heisen.test/',incognito:true});assert.equal((await active()).block?.kind,'danger');assert.equal((await active()).block?.canProceed,false);await expect(page.locator('.page-block').getByRole('button',{name:'계속',exact:true})).toHaveCount(0);await assert.rejects(async()=>rpc('tab.block',{id:(await active()).id,action:'proceed'}),/계속할 수 없습니다/);console.log('PASS seeded danger list interstitial, details-gated proceed and private-tab prohibition');
 assert.deepEqual(errors,[],'toolbar renderer errors');console.log('ALL PRIVACY CHECKS PASSED');
}finally{
 try{await app?.close();}finally{for(const server of servers){server.closeAllConnections();server.close();}await fs.rm(work,{recursive:true,force:true});}
}
