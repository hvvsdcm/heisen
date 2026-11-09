import {_electron as electron,type ElectronApplication,type Page} from 'playwright';
import {expect} from 'playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {hostHash,LISTS} from '../src/safebrowsing.ts';
import {isSealed} from '../src/sealed.ts';
import type {AuditRow} from '../src/store.ts';
import {readLibrary,readTaskAudit} from './lib.ts';

// Complement e2e-privacy.ts: no HTTP-consent, certificate or private danger-page duplication.
// Only real RPCs, local fixtures and Electron inspection; no production test hooks.
type Ui={heisen:{call(method:string,args:unknown):Promise<unknown>}};
type Tab={id:number;url:string;loading:boolean;block?:{kind:string}};
type Download={id:string;name:string;state:string;path:string;danger?:string};
type State={active:number;route:string;tabs:Tab[];downloads:Download[];history:{url:string;at:number}[];settings:{safeBrowsing:{enabled:boolean};cli:{socket:boolean}};cli:{enabled:boolean;path:string};tasks:{id:string;status:string}[];task?:{events:{type:string;text:string}[]}};
type Observation={tabId:number;snapshot:string;elements:{ref:string;name:string}[]};
type ToolResult={isError?:boolean;content:{type:string;text?:string}[]};
type McpInfo={url:string;token:string};
const root=path.resolve('.'),work=await fs.mkdtemp(path.join(os.tmpdir(),'hs-sec-')),profile=path.join(work,'p'),downloads=path.join(work,'downloads');
const errors:string[]=[],cspErrors:string[]=[],modelErrors:string[]=[],modelResults:string[]=[];
const hits=new Map<string,number>(),servers:http.Server[]=[];
const PASSWORD='vault-secret-'+randomBytes(16).toString('hex'),MEMORY='memory-secret-'+randomBytes(16).toString('hex');
const PAYMENT_NAMES=['Card','Verification','Expiry','카드 번호','Security code'];
const payment='<meta charset="utf-8"><title>Payment fixture</title><input autocomplete="section-checkout billing cc-number" aria-label="Card"><input name="cvc" aria-label="Verification"><input id="expiry" aria-label="Expiry"><input aria-label="카드 번호"><input aria-label="Security code">';
const payload=Buffer.from('Harmless security regression fixture, not an executable.\n');
let app:ElectronApplication|undefined,page!:Page,base='',blockedBase='',dangerBase='',mcp:McpInfo,rid=0,modelStep=0,observation:Observation|undefined,taskTab=0;
async function bounded<T>(label:string,operation:Promise<T>,timeout=15000):Promise<T>{
 let timer:NodeJS.Timeout|undefined;
 try{return await Promise.race([operation,new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timed out')),timeout);})]);}finally{clearTimeout(timer);}
}
const rpc=<T=unknown>(method:string,args:object={})=>bounded('RPC '+method,page.evaluate(([m,a])=>(window as unknown as Ui).heisen.call(m,a),[method,args] as const) as Promise<T>,30000);
const state=()=>rpc<State>('state');
const audits=()=>rpc<AuditRow[]>('audit.list',{limit:1000});
async function active(){const s=await state(),tab=s.tabs.find(t=>t.id===s.active);assert.ok(tab,'active tab missing');return tab;}
async function navigate(url:string){await rpc('tab.navigate',{url});await expect.poll(async()=>(await active()).loading,{timeout:15000}).toBe(false);}
const inPage=<T=unknown>(url:string,code:string,gesture=false)=>bounded('Fixture script '+code,app!.evaluate(({webContents},[url,code,gesture])=>{const wc=webContents.getAllWebContents().find(w=>w.getURL()===url);if(!wc)throw new Error('No fixture tab at '+url);return wc.executeJavaScript(code,gesture);},[url,code,gesture] as const) as Promise<T>);
async function exists(file:string){try{await fs.access(file);return true;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return false;throw e;}}
async function listen(server:http.Server){servers.push(server);server.listen(0,'127.0.0.1');await once(server,'listening');const addr=server.address();assert.ok(addr&&typeof addr==='object');return addr.port;}
async function mcpCall<T>(method:string,params?:object):Promise<T>{
 const response=await fetch(mcp.url+'/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+mcp.token},body:JSON.stringify({jsonrpc:'2.0',id:++rid,method,...(params?{params}:{})})});
 assert.equal(response.status,200);const body=await response.json();assert.equal(body.error,undefined,JSON.stringify(body));return body.result;
}
const tool=(name:string,args:object)=>mcpCall<ToolResult>('tools/call',{name,arguments:args});
async function waitTask(id:string,status:string){await expect.poll(async()=>{const s=await state(),actual=s.tasks.find(t=>t.id===id)?.status;if(actual==='failed'&&status!=='failed')throw new Error(JSON.stringify(s.task?.events));return actual;},{timeout:45000}).toBe(status);}
async function launch(){
 const env:Record<string,string>={...process.env as Record<string,string>,HEISEN_TEST_BACKGROUND:process.env.HEISEN_TEST_VISIBLE==='1'?'0':'1',HEISEN_DATA_DIR:profile,HEISEN_BETA_URL:'skip'};delete env.ELECTRON_RUN_AS_NODE;
 const args=['--host-resolver-rules=MAP danger.heisen.test 127.0.0.1','--no-proxy-server'];
 app=await electron.launch({...(process.env.HEISEN_EXECUTABLE?{executablePath:path.resolve(process.env.HEISEN_EXECUTABLE),args}:{args:[root,...args]}),env,timeout:45000,colorScheme:null});
 page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(/Content Security Policy|violates.*directive/i.test(message.text()))cspErrors.push(message.text());});
 await page.getByRole('textbox',{name:'주소창'}).waitFor();await app.evaluate('globalThis.__name=(fn)=>fn');
 // Capture violations before all UI scripts on a reload, not just after app startup.
 await page.addInitScript(()=>{const g=window as typeof window&{securityViolations:string[]};g.securityViolations=[];document.addEventListener('securitypolicyviolation',e=>g.securityViolations.push(e.violatedDirective+': '+e.blockedURI));});
 await page.reload();await page.getByRole('textbox',{name:'주소창'}).waitFor();
 await app.evaluate(({app},dir)=>app.setPath('downloads',dir),downloads);
}
async function closeApp(){
 const current=app;if(!current)return;app=undefined;
 try{await bounded('Electron shutdown',current.close(),10000);}
 catch(error){const process=current.process();if(process.exitCode===null){const exited=once(process,'exit');process.kill('SIGKILL');await bounded('Electron forced shutdown',exited,5000);}throw error;}
}
async function noCspViolations(){assert.deepEqual(await page.evaluate(()=>(window as typeof window&{securityViolations:string[]}).securityViolations),[],'UI CSP violations');assert.deepEqual(cspErrors,[],'UI CSP console errors');}
async function scanSecrets(dir:string):Promise<number>{
 let count=0;for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())count+=await scanSecrets(file);else if(entry.isFile()){const bytes=await fs.readFile(file);for(const secret of [PASSWORD,MEMORY])for(const encoding of ['utf8','utf16le'] as const)assert.ok(!bytes.includes(Buffer.from(secret,encoding)),`plaintext ${encoding} secret in ${path.relative(profile,file)}`);count++;}}return count;
}
try{
 await fs.mkdir(profile);await fs.mkdir(downloads);
 const port=await listen(http.createServer(async(req,res)=>{
  const route=new URL(req.url||'/','http://fixture').pathname;hits.set(route,(hits.get(route)||0)+1);res.setHeader('Cache-Control','no-store');
  try{
   if(route==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'security-fixture',name:'Security fixture'}]}));return;}
   if(route==='/v1/chat/completions'){
    let raw='';for await(const chunk of req)raw+=chunk;const last=JSON.parse(raw).messages.at(-1);
    if(last.role==='tool'){
     modelResults.push(last.content);const wrapped=/^<<<UNTRUSTED id=([a-f0-9]{16}) source="[^"]+">>>\n([\s\S]*)\n<<<END \1>>>$/.exec(last.content);assert.ok(wrapped,'missing tool-result trust boundary');
     const out=JSON.parse(wrapped[2]);if(out.tabId)taskTab=out.tabId;if(out.snapshot)observation=out;
    }
    const steps:(()=>[string,object])[]=[()=>['web_open',{url:base+'/payment'}],()=>['web_observe',{tabId:taskTab}],...PAYMENT_NAMES.map(name=>():[string,object]=>{const field=observation?.elements.find(e=>e.name===name);assert.ok(field,'missing payment field '+name);return ['web_fill',{tabId:taskTab,snapshot:observation!.snapshot,ref:field.ref,text:'4111111111111111'}];}),()=>['file_write',{path:'security-result.md',content:'Payment input refused.'}],()=>['task_finish',{summary:'Payment fields refused.',artifactPaths:['security-result.md'],sourceIds:[]}]];
    assert.ok(modelStep<steps.length,'unexpected model request');const [name,args]=steps[modelStep++]();res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({id:'security',object:'chat.completion',created:Math.floor(Date.now()/1000),model:'security-fixture',choices:[{index:0,message:{role:'assistant',content:null,tool_calls:[{id:'security-'+modelStep,type:'function',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));return;
   }
   if(route==='/keep.exe'||route==='/discard.dmg'||route==='/discard.terminal'){res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="'+route.slice(1)+'"','Content-Length':payload.length});res.end(payload);return;}
   if(route==='/listed-restored'){res.setHeader('Content-Type','text/html');res.end('<title>Allowed main frame</title><iframe src="/listed-frame"></iframe>');return;}
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end(route==='/payment'?payment:'<title>Security fixture</title><p>Local security fixture</p>');
  }catch(error){modelErrors.push(String(error));res.writeHead(500).end('Fixture failure');}
 }));base='http://127.0.0.1:'+port;dangerBase='http://danger.heisen.test:'+port;
 let blockedHits=0;blockedBase='http://127.0.0.1:'+await listen(http.createServer((_req,res)=>{blockedHits++;res.end('<title>Agent blocked fixture</title>');}));
 const old={url:base+'/old-history',title:'Older history',at:Date.now()-3*3600000};
 await fs.writeFile(path.join(profile,'library.json'),JSON.stringify({settings:{importOffered:true,onboarded:true,defaultBrowserAsked:true},history:[old]}));
 await fs.mkdir(path.join(profile,'safebrowsing'));const db=new DatabaseSync(path.join(profile,'safebrowsing','safebrowsing.sqlite'));
 try{db.exec('CREATE TABLE hosts(hash INTEGER PRIMARY KEY,lists INTEGER NOT NULL); CREATE TABLE meta(id TEXT PRIMARY KEY,etag TEXT,at INTEGER,count INTEGER); PRAGMA user_version=1;');const insert=db.prepare('INSERT INTO hosts VALUES(?,?)');insert.setReadBigInts(true);insert.run(hostHash('danger.heisen.test'),1);for(const {id} of LISTS)db.prepare('INSERT INTO meta VALUES(?,NULL,?,1)').run(id,Date.now());}finally{db.close();}
 await launch();
 const initial=await state();assert.equal(initial.cli.enabled,false);assert.equal(initial.settings.cli.socket,false);
 if(process.platform==='darwin'){
  assert.equal(await exists(initial.cli.path),false);assert.equal(await exists(path.join(profile,'run','heisen.token')),false);
  await rpc('cli.toggle',{enabled:true});const cli=(await state()).cli;assert.equal(cli.enabled,true);
  assert.equal((await fs.stat(cli.path)).isSocket(),true);assert.equal((await fs.stat(cli.path)).mode&0o777,0o600);assert.equal((await fs.stat(path.dirname(cli.path))).mode&0o777,0o700);assert.equal((await fs.stat(path.join(profile,'run','heisen.token'))).mode&0o777,0o600);
  const socket=net.createConnection(cli.path);try{await once(socket,'connect');}finally{socket.destroy();}
  await rpc('cli.toggle',{enabled:false});await expect.poll(()=>exists(cli.path)).toBe(false);assert.equal(await exists(path.join(profile,'run','heisen.token')),false);
  console.log('PASS control socket: disabled by default, live socket 0600/token 0600/directory 0700, disabled cleanup');
 }else console.log('PASS control socket disabled by default; SKIP macOS socket mode checks on '+process.platform);

 const csp=await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');assert.ok(csp);
 for(const directive of ["default-src 'self'","script-src 'self'","connect-src 'none'","frame-src 'none'","object-src 'none'","base-uri 'none'"])assert.ok(csp.split(';').some(s=>s.trim()===directive),directive);
 assert.ok(!/unsafe-eval|script-src[^;]*unsafe-inline|img-src[^;]*\shttp:/.test(csp));
 const uiURL=page.url(),uiId=await app!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.id);
 const preferences=await app!.evaluate(({webContents},id)=>(webContents.fromId(id)! as Electron.WebContents&{getLastWebPreferences():Electron.WebPreferences}).getLastWebPreferences(),uiId);assert.equal(preferences.sandbox,true);assert.equal(preferences.contextIsolation,true);assert.equal(preferences.nodeIntegration,false);assert.equal(preferences.webviewTag,false);
 await app!.evaluate(({webContents},id)=>{const wc=webContents.fromId(id)!;wc.once('will-frame-navigate',event=>{(globalThis as typeof globalThis&{securityNavDenied:boolean}).securityNavDenied=event.defaultPrevented;});},uiId);
 await page.evaluate(url=>{location.href=url;},base+'/ui-escape');
 await expect.poll(()=>app!.evaluate(()=>(globalThis as typeof globalThis&{securityNavDenied:boolean}).securityNavDenied)).toBe(true);assert.equal(page.url(),uiURL);assert.equal(hits.get('/ui-escape')||0,0);
 // Chromium leaves a cancelled renderer navigation pending in automation. Reload
 // the unchanged trusted UI before testing APIs that wait for document loading.
 await noCspViolations();await page.reload();await page.getByRole('textbox',{name:'주소창'}).waitFor();
 const windowsBefore=await app!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length);
 assert.equal(await page.evaluate(url=>window.open(url)===null,base+'/ui-popup'),true);assert.equal(await app!.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length),windowsBefore);assert.equal(hits.get('/ui-popup')||0,0);
 // The UI disables webviewTag. Exercise both the DOM attempt and the global attach veto,
 // whose Electron event cannot naturally fire while that first layer remains disabled.
 const veto=await app!.evaluate(({webContents},id)=>{let prevented=false;const event={preventDefault(){prevented=true;}};webContents.fromId(id)!.emit('will-attach-webview',event,{},{src:'https://example.invalid'});return prevented;},uiId);assert.equal(veto,true);
 await page.evaluate(url=>{const view=document.createElement('webview');view.setAttribute('src',url);document.body.append(view);},base+'/ui-webview');
 assert.equal(await app!.evaluate(({webContents})=>webContents.getAllWebContents().filter(w=>w.getType()==='webview').length),0);assert.equal(hits.get('/ui-webview')||0,0);await page.evaluate(()=>document.querySelector('webview')!.remove());
 for(const name of ['camera','microphone','geolocation'] as const)assert.equal(await bounded('UI permission '+name,page.evaluate(async name=>(await navigator.permissions.query({name:name as PermissionName})).state,name)),'denied');
 await noCspViolations();console.log('PASS UI navigation/window/webview guards, denied UI permissions, strict UI CSP without violations');

 await navigate(base+'/downloads');
 for(const [name,action] of [['keep.exe','keep'],['discard.dmg','discard'],['discard.terminal','discard']] as const){
  await app!.evaluate(({webContents},[url,file])=>webContents.getAllWebContents().find(w=>w.getURL()===url)!.downloadURL(file),[base+'/downloads',base+'/'+name] as const);
  await expect.poll(async()=>(await state()).downloads.find(d=>d.name===name)?.state).toBe('dangerous');
  const row=(await state()).downloads.find(d=>d.name===name)!;assert.equal(row.path,'');assert.equal(row.danger,'type');const holding=path.join(profile,'downloads-pending',row.id),target=path.join(downloads,name);
  await expect.poll(async()=>{try{return (await fs.readdir(holding)).length;}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return 0;throw e;}}).toBeGreaterThan(0);assert.equal(await exists(target),false,'unapproved file escaped staging');
  if(process.platform==='darwin')assert.equal((await fs.stat(holding)).mode&0o777,0o700);
  assert.equal(await rpc('download.'+action,{id:row.id}),true);
  if(action==='keep'){await expect.poll(async()=>(await state()).downloads.find(d=>d.id===row.id)?.state).toBe('completed');assert.equal((await state()).downloads.find(d=>d.id===row.id)!.path,target);assert.deepEqual(await fs.readFile(target),payload);}
  else{assert.ok(!(await state()).downloads.some(d=>d.id===row.id));assert.equal(await exists(target),false);}
  await expect.poll(()=>exists(holding)).toBe(false);
 }
 console.log('PASS dangerous .exe/.dmg/.terminal downloads stay staged; keep completes exact bytes, discard removes staged files');

 assert.equal((await state()).settings.safeBrowsing.enabled,true);await navigate(dangerBase+'/listed-on');assert.equal((await active()).block?.kind,'danger');assert.equal(hits.get('/listed-on')||0,0);
 await rpc('settings.security',{safeBrowsing:{enabled:false}});assert.equal((await state()).settings.safeBrowsing.enabled,false);await navigate(dangerBase+'/listed-off');assert.equal((await active()).block,undefined);assert.equal(hits.get('/listed-off'),1);
 await rpc('settings.security',{safeBrowsing:{enabled:true}});await navigate(dangerBase+'/listed-restored');assert.equal((await active()).block?.kind,'danger');assert.equal(hits.get('/listed-restored')||0,0);
 console.log('PASS settings.security toggles Safe Browsing live: block → real request → block');
 const allowedTab=(await active()).id;
 await rpc('tab.block',{id:allowedTab,action:'proceed'});await expect.poll(async()=>(await active()).loading).toBe(false);
 assert.equal((await active()).block,undefined);assert.equal(hits.get('/listed-restored'),1);assert.equal(hits.get('/listed-frame')||0,0,'allow once must not authorize even same-origin subframes');
 const otherTab=await rpc<number>('tab.new',{url:dangerBase+'/other-tab'});
 await expect.poll(async()=>(await active()).block?.kind).toBe('danger');assert.equal(hits.get('/other-tab')||0,0);
 await rpc('tab.close',{id:otherTab});await rpc('tab.select',{id:allowedTab});
 await navigate(base+'/left-danger');await navigate(dangerBase+'/listed-return');
 assert.equal((await active()).block?.kind,'danger');assert.equal(hits.get('/listed-return')||0,0);
 console.log('PASS Safe Browsing allow once is tab-scoped, refuses subframes and expires on main-frame navigation away');

 await navigate(base+'/agent-source');const source=(await active()).id;
 await rpc('settings.security',{agentSites:{[blockedBase]:'block'}});mcp=await rpc<McpInfo>('mcp.enable');await mcpCall('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'security-e2e',version:'1'}});
 const blockedMessage='사용자가 이 사이트의 에이전트 조작을 차단했습니다.';
 for(const [name,args] of [['open_tab',{url:blockedBase+'/blocked'}],['navigate',{tabId:source,url:blockedBase+'/blocked'}]] as const){const result=await tool(name,args);assert.equal(result.isError,true);assert.equal(result.content[0].text,blockedMessage);}
 const blockedTask=await rpc<{id:string}>('task.start',{prompt:'Read blocked security fixture',urls:[blockedBase+'/blocked'],demo:true});await waitTask(blockedTask.id,'failed');assert.ok((await state()).task?.events.some(e=>e.type==='error'&&e.text===blockedMessage));assert.equal(blockedHits,0);
 const blockedAudit=await audits();assert.ok(blockedAudit.some(a=>a.actor==='task'&&a.taskId===blockedTask.id&&a.tool==='web_open'&&a.state==='denied'&&a.origin===blockedBase));for(const tool of ['open_tab','navigate'])assert.ok(blockedAudit.some(a=>a.actor==='mcp'&&a.tool===tool&&a.state==='denied'&&a.origin===blockedBase));
 const addressBar=page.getByRole('textbox',{name:'주소창'});await addressBar.fill('heisen://activity');await addressBar.press('Enter');await expect.poll(async()=>(await state()).route).toBe('activity');await expect(page.getByRole('heading',{name:'에이전트 활동',exact:true})).toBeVisible();await expect(page.locator('.activity-row').filter({hasText:'web_open'}).getByRole('img',{name:'차단',exact:true})).toBeVisible();await expect(page.locator('.activity-row').filter({hasText:'navigate'})).toContainText(blockedBase);
 await rpc('settings.security',{agentSites:{}});const allowed=await tool('open_tab',{url:blockedBase+'/unblocked'});assert.notEqual(allowed.isError,true);assert.ok(blockedHits>0);console.log('PASS live agent site block refuses task/MCP navigation before network, records audit.list rows and renders heisen://activity');

 await rpc('auth.save',{provider:'local',baseURL:base+'/v1'});await rpc('settings.save',{provider:'local',model:'security-fixture'});
 const task=await rpc<{id:string}>('task.start',{prompt:'Check payment field refusal',urls:[base+'/payment']});await waitTask(task.id,'completed');assert.deepEqual(modelErrors,[]);
 const journal=(await readTaskAudit(app!,profile,task.id)).journal.filter(j=>j.tool==='web_fill');assert.equal(journal.length,PAYMENT_NAMES.length);for(const row of journal){assert.equal(row.state,'FAILED');assert.deepEqual(row.result,{error:'결제 정보 입력은 지원하지 않습니다.'});}
 assert.equal(modelResults.filter(text=>text.includes('결제 정보 입력은 지원하지 않습니다.')).length,PAYMENT_NAMES.length);assert.deepEqual(await inPage(base+'/payment',"Array.from(document.querySelectorAll('input')).map(i=>i.value)"),PAYMENT_NAMES.map(()=>''));assert.equal((await audits()).filter(a=>a.taskId===task.id&&a.tool==='web_fill'&&a.state==='denied').length,PAYMENT_NAMES.length);
 console.log('PASS real agent task refuses autocomplete/name/id/Korean-label payment fields; empty DOM, failed journal and denied audit rows');

 await rpc('tab.select',{id:source});
 await navigate(base+'/recent-history');await expect.poll(async()=>(await state()).history.some(h=>h.url===base+'/recent-history')).toBe(true);assert.ok((await state()).history.some(h=>h.url===old.url&&h.at===old.at));
 await rpc('browsing.clear',{range:'hour',history:true});const history=(await state()).history;assert.deepEqual(history,[{url:old.url,title:old.title,at:old.at}]);await expect.poll(async()=>(await readLibrary(app!,profile)).history).toEqual([old]);console.log('PASS browsing.clear hour removes recent history while preserving the older persisted row');

 await rpc('vault.save',{url:base,username:'security-user',password:PASSWORD});await rpc('memory.write',{name:'Security regression',text:'# Security regression\n\n'+MEMORY});assert.equal(await rpc('memory.read',{name:'Security regression'}),'# Security regression\n\n'+MEMORY);
 const secrets=JSON.parse(await fs.readFile(path.join(profile,'secrets.json'),'utf8'));assert.equal(typeof secrets.vault,'string');const vault=JSON.parse(await app!.evaluate(({safeStorage},value)=>safeStorage.decryptString(Buffer.from(value,'base64')),secrets.vault as string));assert.ok(vault.some((v:{password:string})=>v.password===PASSWORD),'vault fixture must really be persisted');
 assert.ok(isSealed(await fs.readFile(path.join(profile,'library.json'))));assert.ok(isSealed(await fs.readFile(path.join(profile,'memory','Security regression.md'))));const revisions=await fs.readdir(path.join(profile,'memory','history'));assert.ok(revisions.length>0);for(const file of revisions)assert.ok(isSealed(await fs.readFile(path.join(profile,'memory','history',file))));
 await rpc('mcp.disable');await noCspViolations();assert.deepEqual(errors,[],'UI renderer errors');await closeApp();
 const scanned=await scanSecrets(profile);assert.ok(scanned>0);
 await launch();assert.equal(await rpc('memory.read',{name:'Security regression'}),'# Security regression\n\n'+MEMORY);assert.equal((await state()).cli.enabled,false);await noCspViolations();assert.deepEqual(errors,[],'UI renderer errors after restart');
 console.log(`PASS sealed password/memory persistence: ${scanned} profile files have no UTF-8/UTF-16 plaintext secret; memory survives restart`);
 await navigate(base+'/devices');
 // Bluetooth is disabled app-wide rather than waiting on an OS device chooser.
 assert.equal(await page.evaluate(()=>typeof (navigator as Navigator&{bluetooth?:unknown}).bluetooth),'undefined');
 assert.equal(await inPage(base+'/devices','typeof navigator.bluetooth'),'undefined');
 console.log('PASS Web Bluetooth unavailable in UI and web tabs');
 // Device chooser cancellation is exercised in the real secure-context loopback page.
 for(const [name,request] of [['USB','navigator.usb.requestDevice({filters:[]})'],['HID','navigator.hid.requestDevice({filters:[]})'],['Serial','navigator.serial.requestPort()']] as const){
  console.log('CHECK '+name+' device request');
  const result=await inPage<string>(base+'/devices',`(async()=>{try{const value=await ${request};return Array.isArray(value)&&value.length===0?'EMPTY':'GRANTED';}catch(e){return e.name;}})()`,true);
  assert.ok(name==='HID'?result==='EMPTY'||result==='NotFoundError':result==='NotFoundError',`${name} request was not denied: ${result}`);
  console.log('PASS '+name+' device request denied: '+result);
 }
 console.log('ALL SECURITY CHECKS PASSED');
}catch(error){console.error('SECURITY CHECK FAILED',error);throw error;}finally{
 try{await closeApp();}finally{for(const server of servers){server.closeAllConnections();server.close();}await fs.rm(work,{recursive:true,force:true});}
}
