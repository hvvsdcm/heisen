import {_electron as electron,type ElectronApplication,type Page} from 'playwright';
import {expect} from 'playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startBetaStub} from './beta-stub.ts';
import type {BetaInfo} from '../src/beta.ts';
type Heisen={heisen:{call(method:string,args:unknown):Promise<unknown>}};
type State={beta:BetaInfo;tabs:{id:number}[]};
type LoginSpy={betaStartURL:string;betaOpenFails:boolean};
// Closed-beta gate end to end against tests/beta-stub.ts: system-browser handoff, loopback callback, invite code, saved session, offline grace, revoked session,
// sign-out from settings and the development-only HEISEN_BETA_URL=skip bypass.
const root=path.resolve('.'),profile=path.join(root,'.test-beta');await fs.rm(profile,{recursive:true,force:true});await fs.mkdir(profile,{recursive:true});
await fs.writeFile(path.join(profile,'library.json'),JSON.stringify({settings:{importOffered:true,onboarded:true}}));
const CODES=['HSN-BETA-7K2Q','HSN-BETA-9M4R'],FIRST='tester@example.com',SECOND='second@example.com';
const stub=await startBetaStub({codes:CODES});
const errors:string[]=[];let app:ElectronApplication|undefined;let page!:Page;
async function launch(betaURL:string){
 const env:Record<string,string>={...process.env as Record<string,string>,HEISEN_TEST_BACKGROUND:process.env.HEISEN_TEST_VISIBLE==='1'?'0':'1',HEISEN_DATA_DIR:profile,HEISEN_BETA_URL:betaURL};delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch(process.env.HEISEN_EXECUTABLE?{executablePath:path.resolve(process.env.HEISEN_EXECUTABLE),args:[],env,timeout:45000}:{args:[root],env,timeout:45000});
 page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
 // Like the dialog spies in e2e-data.ts, replace the Electron API only in this test process; production has no capture hook.
 await app.evaluate('globalThis.__name=(fn)=>fn');
 await app.evaluate(({shell})=>{const g=globalThis as typeof globalThis&LoginSpy;g.betaStartURL='';g.betaOpenFails=false;shell.openExternal=async(url:string)=>{g.betaStartURL=url;if(g.betaOpenFails)throw new Error('test openExternal failure');};});
}
async function relaunch(betaURL:string){await app?.close();await launch(betaURL);}
// The preload bridge is not typed for the test process; the result shape is whatever the main process registered for the method.
const rpc=<T=unknown>(m:string,a:object={})=>page.evaluate(([m,a])=>{const ui=window as unknown as Heisen;return ui.heisen.call(m,a);},[m,a] as const) as Promise<T>;
const beta=async()=>(await rpc<State>('state')).beta;
const gate=()=>page.getByRole('dialog',{name:'Heisen 로그인',exact:true});
const addressBar=()=>page.getByRole('textbox',{name:'주소창'});
async function beginSignIn(){
 await app!.evaluate(()=>{(globalThis as typeof globalThis&LoginSpy).betaStartURL='';});
 const start=gate().getByRole('button',{name:'Google 계정으로 계속',exact:true});await expect(start).toBeEnabled();await start.click();
 await expect.poll(()=>app!.evaluate(()=>(globalThis as typeof globalThis&LoginSpy).betaStartURL)).not.toBe('');
 const url=new URL(await app!.evaluate(()=>(globalThis as typeof globalThis&LoginSpy).betaStartURL));
 assert.equal(url.origin,stub.url);assert.equal(url.pathname,'/auth/start');assert.equal(url.searchParams.get('client'),'app');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.match(url.searchParams.get('code_challenge')!,/^[\w-]{43}$/);
 const port=Number(url.searchParams.get('redirect_port'));assert.ok(port>=1024&&port<=65535);
 assert.equal(await app!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),1,'sign-in must not create an embedded browser');
 return {url,callback:`http://127.0.0.1:${port}/callback`,state:url.searchParams.get('state')!};
}
async function signIn(email:string){
 const {url,callback,state}=await beginSignIn();await expect(gate().getByText('브라우저에서 로그인을 마치세요.',{exact:true})).toBeVisible();
 // Drive the external browser's HTTP flow without launching the user's real default browser. This stub has no cookies.
 const login=await fetch(url);assert.equal(new URL(login.url).pathname,'/stub/login');assert.match(await login.text(),/name="email"/);
 const result=await fetch(stub.url+'/stub/login',{method:'POST',body:new URLSearchParams({email,state}),redirect:'manual'});assert.equal(result.status,302);
 const target=new URL(result.headers.get('location')!);assert.equal(target.origin+target.pathname,callback);assert.equal(target.searchParams.get('state'),state);
 const complete=await fetch(target,{redirect:'manual'});assert.equal(complete.status,302);assert.equal(complete.headers.get('location'),stub.url+'/auth/app/complete');await complete.text();
 const landing=await fetch(complete.headers.get('location')!);assert.match(await landing.text(),/로그인이 끝났습니다. Heisen 앱으로 돌아가세요./);
 await expect(gate()).toContainText(email+' 계정으로 로그인됨');await expect.poll(async()=>(await beta()).status).toBe('invite');
 await assert.rejects(fetch(callback,{signal:AbortSignal.timeout(2000)}));
}
async function redeem(code:string){const input=gate().getByLabel('초대 코드');await input.fill(code);await expect(input).toHaveValue(code);const confirm=gate().getByRole('button',{name:'확인',exact:true});await expect(confirm).toBeEnabled();await confirm.click();}
async function openAbout(){await rpc('route',{route:'settings'});await page.getByRole('heading',{name:'설정',exact:true}).waitFor();await page.getByRole('button',{name:'Heisen 정보',exact:true}).click();}
try{
 await launch(stub.url);
 await expect(gate()).toBeVisible();await expect(gate().getByRole('button',{name:'Google 계정으로 계속',exact:true})).toBeEnabled();
 await expect(gate()).not.toContainText(/베타|초대/);
 await assert.rejects(rpc('tab.new',{url:'https://example.com'}),/로그인이 필요/);
 let state=await rpc<State>('state');assert.equal(state.beta.status,'signed_out');assert.equal(state.tabs.length,0);assert.equal(state.beta.server,stub.url);
 console.log('PASS 1 empty profile: gate dialog shown, signed_out, tab.new refused while gated, no tabs');

 let pending=await beginSignIn();
 assert.equal((await fetch(pending.callback.replace('/callback','/favicon.ico'))).status,404);
 assert.equal((await fetch(pending.callback,{method:'POST'})).status,405);assert.equal((await beta()).busy,true);
 await gate().getByRole('button',{name:'취소',exact:true}).click();await expect.poll(async()=>(await beta()).busy).toBe(false);
 assert.equal((await beta()).error,undefined);await assert.rejects(fetch(pending.callback,{signal:AbortSignal.timeout(2000)}));
 pending=await beginSignIn();const previous=pending.callback;await rpc('beta.signIn');await assert.rejects(fetch(previous,{signal:AbortSignal.timeout(2000)}));await rpc('beta.cancel');
 for(const query of ['code=unused&state=wrong','error=access_denied']){
  pending=await beginSignIn();const denied=await fetch(pending.callback+'?'+query+'&state='+pending.state,{redirect:'manual'});
  assert.equal(denied.status,200);assert.equal(denied.headers.get('location'),null);assert.match(await denied.text(),/로그인하지 못했습니다. Heisen에서 다시 시도하세요./);
  await expect.poll(async()=>(await beta()).busy).toBe(false);assert.equal((await beta()).error,query.startsWith('code')?'로그인 응답이 올바르지 않습니다. 다시 시도하세요.':'로그인이 취소되었습니다.');
  await assert.rejects(fetch(pending.callback,{signal:AbortSignal.timeout(2000)}));
 }
 await app!.evaluate(()=>{(globalThis as typeof globalThis&LoginSpy).betaOpenFails=true;});
 pending=await beginSignIn();await expect.poll(async()=>(await beta()).busy).toBe(false);assert.equal((await beta()).error,'서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.');
 await assert.rejects(fetch(pending.callback,{signal:AbortSignal.timeout(2000)}));await app!.evaluate(()=>{(globalThis as typeof globalThis&LoginSpy).betaOpenFails=false;});
 pending=await beginSignIn();await relaunch(stub.url);await assert.rejects(fetch(pending.callback,{signal:AbortSignal.timeout(2000)}));
 console.log('PASS loopback lifecycle: non-callback 404, GET only, cancel/replacement/stop close listener, state/error response, opener rejection');

 await signIn(FIRST);await expect(gate().getByLabel('초대 코드')).toBeFocused();
 await page.screenshot({path:path.join(root,'docs/beta-gate.png')});
 console.log('PASS 2 Google button → external URL → loopback code → PKCE exchange; invite step for '+FIRST+', no embedded sign-in window; docs/beta-gate.png');

 await redeem('HSN-WXYZ-2345');await expect(gate().locator('.error-text')).toHaveText('초대 코드가 올바르지 않습니다.');
 await redeem(CODES[0]);await expect(gate()).toHaveCount(0);await expect(addressBar()).toBeVisible();
 state=await rpc<State>('state');assert.equal(state.beta.status,'active');assert.equal(state.beta.email,FIRST);assert.ok(state.tabs.length>=1);
 const stored=await fs.readFile(path.join(profile,'secrets.json'),'utf8');assert.equal(stub.tokens.length,1);
 for(const token of stub.tokens){assert.ok(!stored.includes(token),'session token stored in plaintext');assert.ok(!JSON.stringify(state).includes(token),'session token exposed to the renderer');}
 console.log('PASS 3 wrong code → error, valid code → gate gone, address bar shown, active; token absent from secrets.json plaintext and UI state');

 let mark=stub.requests.length;await relaunch(stub.url);
 await expect(addressBar()).toBeVisible();await expect(gate()).toHaveCount(0);
 await expect.poll(()=>stub.requests.slice(mark)).toEqual(['GET /api/me']);await expect.poll(async()=>(await beta()).online).toBe(true);
 assert.equal((await beta()).status,'active');
 console.log('PASS 4 restart with saved session: no gate, address bar immediately, exactly one /api/me check');

 stub.setDown(true);mark=stub.requests.length;await relaunch(stub.url);
 await expect(addressBar()).toBeVisible();await expect.poll(async()=>(await beta()).online).toBe(false);
 assert.equal((await beta()).status,'active');assert.ok(stub.requests.slice(mark).includes('GET /api/me'));await expect(gate()).toHaveCount(0);
 await openAbout();await expect(page.getByText(FIRST,{exact:true})).toBeVisible();await expect(page.getByText(/^오프라인 · 마지막 확인 /)).toBeVisible();
 console.log('PASS 5 server down (503) within the 7-day grace: unlocked, 설정 > Heisen 정보 shows 오프라인');

 stub.setDown(false);stub.revokeAll();await relaunch(stub.url);
 await expect(gate()).toBeVisible();await expect.poll(async()=>(await beta()).status).toBe('signed_out');
 await expect(gate().locator('.error-text')).toHaveText('세션이 만료되었거나 해지되었습니다. 다시 로그인하세요.');
 await assert.rejects(rpc('tab.new',{url:'https://example.com'}),/로그인이 필요/);assert.equal((await beta()).email,undefined);
 console.log('PASS 6 revoked session: /api/me 401 → gate signed_out with error, saved session removed, RPC gated again');

 await signIn(SECOND);
 await redeem(CODES[0]);await expect(gate().locator('.error-text')).toHaveText('사용 횟수를 초과한 초대 코드입니다.');
 await redeem(CODES[1]);await expect(gate()).toHaveCount(0);
 await openAbout();await expect(page.getByText(SECOND,{exact:true})).toBeVisible();await expect(page.getByText(/^오프라인/)).toHaveCount(0);
 mark=stub.requests.length;await page.getByRole('button',{name:'로그아웃',exact:true}).click();
 await expect(gate()).toBeVisible();await expect(gate().getByRole('button',{name:'Google 계정으로 계속',exact:true})).toBeVisible();
 state=await rpc<State>('state');assert.equal(state.beta.status,'signed_out');assert.equal(state.beta.email,undefined);assert.deepEqual(stub.requests.slice(mark),['POST /api/logout']);
 console.log('PASS 7 second account: used code → exhausted, fresh code → unlocked; 설정 > Heisen 정보 > 로그아웃 → gate, server session revoked');

 mark=stub.requests.length;await relaunch('skip');
 await expect(addressBar()).toBeVisible();await expect(gate()).toHaveCount(0);assert.equal((await beta()).status,'active');assert.equal(stub.requests.length,mark);
 console.log('PASS 8 HEISEN_BETA_URL=skip: no gate even while signed out, no beta server requests');

 assert.equal(errors.length,0,errors.join('\n'));
 console.log('ALL BETA CHECKS PASSED');
}finally{await app?.close();await stub.close();}
