// Shared macOS benchmark instrumentation. Entry points own orchestration and evidence output.
import {_electron as electron, chromium} from 'playwright';
import type {Browser, ElectronApplication, Page} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {spawn, execFile} from 'node:child_process';
import type {ChildProcess} from 'node:child_process';
import type {AddressInfo} from 'node:net';
import {promisify} from 'node:util';
import {readLibrary as readSealedLibrary} from './lib.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const chromeBundle='/Applications/Google Chrome.app',chromeExe=path.join(chromeBundle,'Contents/MacOS/Google Chrome');
const packaged=path.join(root,`release-test/Heisen-darwin-${process.arch}/Heisen.app/Contents/MacOS/Heisen`);
const exec=promisify(execFile);
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
const timeoutMs=60_000, settleMs=3_000;
type Product='Chrome'|'Heisen';
type ProcessRow={pid:number;ppid:number;rssKiB:number;cpuPercent:number;command:string};
type Memory={rssKiB:number;processes:ProcessRow[];sampledAfterReadyMs:number};
type Sample={product:Product;run:number;tabs:number;launchAttempts:number;visibleMs:number;activeLoadedMs?:number;restored?:Memory;allVisited?:Memory;loadedFixturePages?:number;fixtureRequestsBeforeVisits?:string[];version:string};
type State={active:number;tabs:{id:number;url:string;sleeping?:boolean;sleepReason?:string|null}[];settings?:{sleep?:unknown}};
type LaunchInventory={existingPids:Set<number>;bundlePrefix:string};
type HeisenWindow=Window&{heisen:{call:<T>(method:string,args:object)=>Promise<T>}};
const idleChecks:{at:string;loadAverage:number[];backgroundProcesses:{pid:number;cpuPercent:number;command:string}[]}[]=[];
const forcedQuits:{product:Product|'Safari';at:string;error:string}[]=[];
const launchFailures:{at:string;profile:string;phase:'prepare'|'sample';attempt:number;error:string;main:unknown;stderr:string}[]=[];
let heisenExe:string|undefined,heisenBundle='';

// Every automation call gets a deadline: a hung CDP/Electron call must fail the run, not stall it.
async function within<T>(label:string,work:Promise<T>,ms=timeoutMs):Promise<T>{
 let timer:NodeJS.Timeout|undefined;
 try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error(`Timed out: ${label}`)),ms);})]);}
 finally{clearTimeout(timer);}
}
async function poll<T>(label:string,read:()=>Promise<T>,accept:(value:T)=>boolean):Promise<T>{
 const deadline=performance.now()+timeoutMs;
 do{const value=await within(label,read());if(accept(value))return value;await sleep(20);}while(performance.now()<deadline);
 throw new Error(`Timed out: ${label}`);
}
async function processes():Promise<ProcessRow[]>{
 const {stdout}=await exec('/bin/ps',['-axo','pid=,ppid=,rss=,%cpu=,command='],{maxBuffer:8*1024*1024});
 return stdout.trim().split('\n').map(line=>{const m=line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(.*)$/);if(!m)throw new Error(`Unexpected ps row: ${line}`);return {pid:+m[1],ppid:+m[2],rssKiB:+m[3],cpuPercent:+m[4],command:m[5]};});
}
// PIDs alive when the benchmark starts (user apps, other sessions' long-lived browsers) are background, never blockers.
let backgroundPids:Set<number>|undefined;
async function idleCheck(){
 const rows=await processes();backgroundPids??=new Set(rows.map(p=>p.pid));
 const relevant=rows.filter(p=>p.pid!==process.pid&&/Electron|playwright|Heisen Helper|Google Chrome|tests\/(?:e2e-|desktop)|scripts\/(?:build|package)\.mjs/.test(p.command));
 // Blockers: project tests/builds/dev Electron (not the user's release/ app) and Playwright browsers started after the benchmark began.
 const blockers=relevant.filter(p=>!p.command.includes('/release/')&&(
  p.command.includes(root)||/tests\/(?:e2e-|desktop)|scripts\/(?:build|package)\.mjs/.test(p.command)||(/ms-playwright/.test(p.command)&&!backgroundPids!.has(p.pid))
 ));
 assert.equal(blockers.length,0,`Wait for competing tests/builds before benchmarking:\n${blockers.map(p=>`${p.pid} ${p.command}`).join('\n')}`);
 idleChecks.push({at:new Date().toISOString(),loadAverage:os.loadavg(),backgroundProcesses:relevant.map(({pid,cpuPercent,command})=>({pid,cpuPercent,command}))});
}
async function memory(pid:number,profile:string,readyAt:number,inventory:LaunchInventory):Promise<Memory>{
 const rows=await processes(),ids=new Set([pid]);
 // Crashpad can reparent to launchd and use a shared database rather than --user-data-dir.
 // Include new processes from this exact app bundle, excluding every pre-launch PID.
 for(const p of rows)if(p.command.includes(profile)||(!inventory.existingPids.has(p.pid)&&p.command.startsWith(inventory.bundlePrefix)))ids.add(p.pid);
 let changed=true;
 while(changed){changed=false;for(const p of rows)if(ids.has(p.ppid)&&!ids.has(p.pid)){ids.add(p.pid);changed=true;}}
 const selected=rows.filter(p=>ids.has(p.pid));
 assert.ok(selected.some(p=>p.pid===pid),'Browser exited before RSS sample');
 return {rssKiB:selected.reduce((sum,p)=>sum+p.rssKiB,0),processes:selected,sampledAfterReadyMs:performance.now()-readyAt};
}
async function waitExit(child:ChildProcess){
 await poll('owned browser exit',async()=>child.exitCode!==null||child.signalCode!==null,Boolean);
}
// Same visibility signal for both products: macOS window server reports an on-screen, layer-0, >=100x100 window
// owned by a process (absent before launch) whose app bundle is the measured bundle. No Screen Recording permission needed.
const windowProbeSource=`ObjC.import('CoreGraphics');ObjC.import('AppKit');ObjC.import('Foundation');ObjC.import('stdlib');
const out=$.NSFileHandle.fileHandleWithStandardOutput;
const write=s=>out.writeData($(s+'\\n').dataUsingEncoding($.NSUTF8StringEncoding));
write('ready');
const req=JSON.parse($.NSString.alloc.initWithDataEncoding($.NSFileHandle.fileHandleWithStandardInput.availableData,$.NSUTF8StringEncoding).js);
const excluded=new Set(req.exclude);let polls=0;
while(true){
 const list=ObjC.castRefToObject($.CGWindowListCopyWindowInfo($.kCGWindowListOptionOnScreenOnly,$.kCGNullWindowID));
 for(let i=0;i<list.count;i++){
  const w=list.objectAtIndex(i),pid=w.objectForKey('kCGWindowOwnerPID').js,b=w.objectForKey('kCGWindowBounds');
  if(w.objectForKey('kCGWindowLayer').js!==0||excluded.has(pid)||b.objectForKey('Width').js<100||b.objectForKey('Height').js<100)continue;
  const app=$.NSRunningApplication.runningApplicationWithProcessIdentifier(pid);
  if(app.js&&app.bundleURL.js&&(app.bundleURL.path.js===req.bundle||app.bundleURL.URLByResolvingSymlinksInPath.path.js===req.bundle)){write(JSON.stringify({pid,polls}));$.exit(0);}
 }
 polls++;$.NSThread.sleepForTimeInterval(0.005);
}`;
// Starts the probe (not timed), then returns `go`: call it immediately before launch; resolves to host time of the first matching window.
async function windowProbe(bundle:string,exclude:Set<number>):Promise<WindowProbe>{
 const probe=spawn('/usr/bin/osascript',['-l','JavaScript','-e',windowProbeSource],{stdio:['pipe','pipe','pipe']});
 let buffer='',stderr='';const lines:{at:number;text:string}[]=[];let wake:(()=>void)|undefined,cancelPending:((error:Error)=>void)|undefined;
 probe.stderr!.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-4096);});
 probe.stdout!.on('data',chunk=>{buffer+=String(chunk);let i;while((i=buffer.indexOf('\n'))>=0){lines.push({at:performance.now(),text:buffer.slice(0,i)});buffer=buffer.slice(i+1);}wake?.();});
 const next=()=>new Promise<{at:number;text:string}>((resolve,reject)=>{
  const timer=setTimeout(()=>{probe.kill();reject(new Error(`Window probe timeout: ${stderr}`));},timeoutMs);
  cancelPending=error=>{clearTimeout(timer);reject(error);};
  const take=()=>{const line=lines.shift();if(!line)return false;clearTimeout(timer);wake=undefined;resolve(line);return true;};
  if(!take())wake=()=>{take();};
 });
 assert.equal((await next()).text,'ready');
 return Object.assign(()=>{probe.stdin!.end(JSON.stringify({bundle,exclude:[...exclude]})+'\n');return next().then(line=>({at:line.at,...JSON.parse(line.text) as {pid:number;polls:number}}));},
  {cancel:()=>{probe.kill();cancelPending?.(new Error('Window probe cancelled'));}});
}
const requests:string[]=[];
// Same tiny deterministic fixture as performance.ts, but 20 distinct URLs/titles.
const server=http.createServer((req,res)=>{
 if(req.url==='/leak'){
  requests.push(req.url);res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');
  res.end('<title>Leak fixture</title><script>const hold=[];const t=setInterval(()=>{hold.push(new Uint8Array(16<<20).fill(1));if(hold.length>=48)clearInterval(t);},250);</script>');return;
 }
 const match=req.url?.match(/^\/page\/(\d+)$/);
 if(!match||+match[1]>=urls.length){res.writeHead(404);res.end();return;}
 requests.push(req.url!);res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');
 res.end(`<title>Benchmark fixture ${match[1]}</title><h1>Saved tab fixture ${match[1]}</h1><p>Deterministic local page.</p>`);
});
let urls:string[]=[];

type WindowShown={at:number;pid:number;polls:number};
type WindowProbe={():Promise<WindowShown>;cancel:()=>void};
type ChromeApp={browser:Browser;child:ChildProcess;before:number;close:()=>Promise<void>;inventory:LaunchInventory;visible:Promise<WindowShown>;endpoint:string};
async function launchChrome(profile:string,args:string[]):Promise<ChromeApp>{
 const existingPids=new Set((await processes()).map(p=>p.pid));
 const inventory:LaunchInventory={existingPids,bundlePrefix:path.resolve(chromeExe,'../..')+path.sep};
 const go=await windowProbe(chromeBundle,existingPids);
 const before=performance.now(),visible=go();
 const child=spawn(chromeExe,[`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--use-mock-keychain','--remote-debugging-port=0',...args],{stdio:['ignore','ignore','pipe']});
 let stderr='';
 const endpoint=await new Promise<string>((resolve,reject)=>{
  const timer=setTimeout(()=>{reject(new Error(`Chrome CDP timeout: ${stderr}`));child.kill('SIGTERM');},timeoutMs);
  child.once('error',e=>{clearTimeout(timer);reject(e);});
  child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Chrome exited ${code}: ${stderr}`));});
  child.stderr!.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-16_384);const m=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timer);resolve(m[1]);}});
 });
 let browser:Browser;
 try{browser=await chromium.connectOverCDP(endpoint,{timeout:timeoutMs,noDefaults:true});}
 catch(e){child.kill('SIGTERM');await waitExit(child);throw e;}
 const close=async()=>{
  try{await within('Chrome Browser.close',(async()=>{const cdp=await browser.newBrowserCDPSession();await cdp.send('Browser.close');await waitExit(child);})(),30_000);}
  catch(e){forcedQuits.push({product:'Chrome',at:new Date().toISOString(),error:String(e)});child.kill('SIGKILL');await waitExit(child);}
  finally{await within('Chrome CDP disconnect',browser.close(),10_000).catch(()=>{});}
 };
 return {browser,child,before,close,inventory,visible,endpoint};
}
type CdpReply={id:number;result?:{result?:{value?:unknown}}};
async function chromeTabs(app:ChromeApp){
 const cdp=await app.browser.newBrowserCDPSession();
 try{return await poll('Chrome fixture tab targets',async()=>(await cdp.send('Target.getTargets')).targetInfos.filter(t=>t.type==='page'&&urls.includes(t.url)),tabs=>tabs.length===urls.length);}
 finally{await cdp.detach();}
}
// A direct DevTools socket per tab target: Playwright never attaches to restored tabs that Chrome had not loaded when it connected.
async function chromeLoaded(app:ChromeApp,targetId:string,url:string){
 const ws=new WebSocket(`ws://${new URL(app.endpoint).host}/devtools/page/${targetId}`);
 const pending=new Map<number,(reply:CdpReply)=>void>();let nextId=0;
 ws.onmessage=event=>{const reply:CdpReply=JSON.parse(String(event.data));pending.get(reply.id)?.(reply);pending.delete(reply.id);};
 try{
  await within('Chrome tab socket '+url,new Promise<void>((resolve,reject)=>{ws.onopen=()=>resolve();ws.onerror=()=>reject(new Error('Chrome tab socket failed '+url));}));
  // Errors (no execution context yet during the load) read as not ready.
  await poll('Chrome complete document '+url,()=>new Promise<unknown>(resolve=>{
   const id=++nextId;pending.set(id,reply=>resolve(reply.result?.result?.value));
   ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression:'location.href+" "+document.readyState',returnByValue:true}}));
  }),value=>value===`${url} complete`);
 }finally{ws.close();}
}
async function visitChrome(app:ChromeApp){
 const tabs=await chromeTabs(app),cdp=await app.browser.newBrowserCDPSession();
 try{for(const url of urls){const {targetId}=tabs.find(t=>t.url===url)!;await within('Chrome activate '+url,cdp.send('Target.activateTarget',{targetId}));await chromeLoaded(app,targetId,url);}}
 finally{await cdp.detach();}
}
async function prepareChrome(profile:string){
 const app=await launchChrome(profile,urls);
 try{
  await app.visible;await visitChrome(app);
  const cdp=await app.browser.newBrowserCDPSession();
  await within('Chrome activate first tab',cdp.send('Target.activateTarget',{targetId:(await chromeTabs(app)).find(t=>t.url===urls[0])!.targetId}));await cdp.detach();await sleep(1000);
 }finally{await app.close();}
 const prefs=JSON.parse(await fs.readFile(path.join(profile,'Default/Preferences'),'utf8'));
 assert.equal(prefs.profile?.exit_type,'Normal','Chrome session must be saved by a clean quit');
}
async function sampleChrome(profile:string,run:number,tabs:number):Promise<Sample>{
 const requestStart=requests.length,app=await launchChrome(profile,tabs?['--restore-last-session']:['chrome://newtab/']);
 try{
  const shown=await app.visible;assert.equal(shown.pid,app.child.pid);const visibleMs=shown.at-app.before;
  const row:Sample={product:'Chrome',run,tabs,launchAttempts:1,visibleMs,version:app.browser.version()};
  if(tabs){
   // /page/0 was the selected tab at quit; the window may be occluded, so visibilityState is not checked.
   await chromeLoaded(app,(await chromeTabs(app)).find(t=>t.url===urls[0])!.targetId,urls[0]);row.activeLoadedMs=performance.now()-app.before;
   const readyAt=performance.now();await sleep(settleMs);row.restored=await memory(app.child.pid!,profile,readyAt,app.inventory);
   row.fixtureRequestsBeforeVisits=[...new Set(requests.slice(requestStart))];row.loadedFixturePages=row.fixtureRequestsBeforeVisits.length;
   await visitChrome(app);
   const visitedAt=performance.now();await sleep(settleMs);row.allVisited=await memory(app.child.pid!,profile,visitedAt,app.inventory);
  }
  return row;
 }finally{await app.close();}
}
// A launch whose main process never creates a window within 60 s is recorded with diagnostics and retried once in the same profile.
async function launchHeisen(profile:string,phase:'prepare'|'sample'){
 const env:Record<string,string>={...process.env as Record<string,string>,HEISEN_DATA_DIR:profile,HEISEN_BETA_URL:'skip'};delete env.ELECTRON_RUN_AS_NODE;
 for(let attempt=1;;attempt++){
  const existingPids=new Set((await processes()).map(p=>p.pid));
  const go=await windowProbe(heisenBundle,existingPids);
  const before=performance.now(),visible=go();
  // Launch diagnostics below must win over a probe timeout; the sample still awaits `visible` and sees its rejection.
  visible.catch(()=>{});
  const app=await electron.launch({...(heisenExe?{executablePath:heisenExe,args:[]}:{args:[root]}),env,timeout:timeoutMs,colorScheme:null});
  let stderr='';app.process().stderr?.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-8192);});
  try{
   // tsx keeps function names with __name; functions evaluated in Electron need the same helper.
   await within('Heisen __name helper',app.evaluate('globalThis.__name=(fn)=>fn'));
   const page=await app.firstWindow({timeout:timeoutMs});
   const inventory:LaunchInventory={existingPids,bundlePrefix:path.join(heisenBundle,'Contents')+path.sep};
   return {app,page,before,inventory,visible,attempt};
  }catch(e){
   const main=await within('Heisen main state',app.evaluate(({app,BrowserWindow})=>({ready:app.isReady(),windows:BrowserWindow.getAllWindows().map(w=>({url:w.webContents.getURL(),visible:w.isVisible()}))})),5000).catch(err=>String(err));
   await closeHeisen(app);
   const failure={at:new Date().toISOString(),profile:path.basename(profile),phase,attempt,error:String(e),main,stderr};
   if(attempt>=2)throw new Error(`Heisen launch failed: ${JSON.stringify(failure)}`);
   launchFailures.push(failure);console.log(JSON.stringify({launchFailure:failure}));
  }
 }
}
// The measured window is over; a quit that does not finish in 30 s is recorded and the process is killed.
async function closeHeisen(app:ElectronApplication){
 try{await within('Heisen close',app.close(),30_000);}
 catch(e){forcedQuits.push({product:'Heisen',at:new Date().toISOString(),error:String(e)});app.process().kill('SIGKILL');}
}
async function rpc<T>(page:Page,method:string,args:object={}):Promise<T>{
 return within('Heisen RPC '+method,page.evaluate(([m,a])=>{
  // The app preload owns this typed IPC bridge (same boundary as e2e-browser.ts).
  const ui=window as unknown as HeisenWindow;return ui.heisen.call<T>(m,a);
 },[method,args] as const));
}
async function heisenLoaded(app:ElectronApplication,url:string){
 await poll('Heisen complete document '+url,()=>app.evaluate(async({webContents},url)=>{
  const wc=webContents.getAllWebContents().find(w=>w.getURL()===url);
  return !!wc&&!wc.isLoadingMainFrame()&&await wc.executeJavaScript('document.readyState === "complete"');
 },url),Boolean);
}
async function visitHeisen(app:ElectronApplication,page:Page){
 // The window can appear before the saved tabs are restored into the published state.
 const state=await poll('Heisen restored tabs',()=>rpc<State>(page,'state'),s=>s.tabs.length===urls.length);
 for(const url of urls){const tab=state.tabs.find(t=>t.url===url);assert.ok(tab);await rpc(page,'tab.select',{id:tab.id});await heisenLoaded(app,url);}
}
async function prepareHeisen(profile:string){
 // Baseline performance.ts profile shape; then actually load/quit, matching Chrome's session preparation.
 await fs.writeFile(path.join(profile,'library.json'),JSON.stringify({settings:{importOffered:true,onboarded:true},activeTab:0,tabs:urls.map((url,i)=>({url,title:`Saved tab ${i}`,pinned:false}))}));
 const {app,page,visible}=await launchHeisen(profile,'prepare');
 try{
  await visible;await visitHeisen(app,page);
  const state=await rpc<State>(page,'state');await rpc(page,'tab.select',{id:state.tabs.find(t=>t.url===urls[0])!.id});await sleep(1000);
  const saved=await readLibrary(app,profile);
  assert.equal(saved.tabs.length,urls.length,'Heisen session must keep all saved tabs');
 }finally{await closeHeisen(app);}
}
async function sampleHeisen(profile:string,run:number,tabs:number):Promise<Sample>{
 if(!tabs)await fs.writeFile(path.join(profile,'library.json'),JSON.stringify({settings:{importOffered:true,onboarded:true},tabs:[]}));
 const requestStart=requests.length,{app,page,before,inventory,visible,attempt}=await launchHeisen(profile,'sample');
 try{
  const shown=await visible;assert.equal(shown.pid,app.process().pid);const visibleMs=shown.at-before;
  const row:Sample={product:'Heisen',run,tabs,launchAttempts:attempt,visibleMs,version:await within('Heisen version',app.evaluate(({app})=>`${app.getVersion()} (Electron ${process.versions.electron}, Chromium ${process.versions.chrome})`))};
  if(tabs){
   await heisenLoaded(app,urls[0]);row.activeLoadedMs=performance.now()-before;
   const state=await poll('Heisen restored tabs',()=>rpc<State>(page,'state'),s=>s.tabs.length===urls.length);assert.equal(state.tabs.find(t=>t.id===state.active)?.url,urls[0]);
   const readyAt=performance.now();await sleep(settleMs);row.restored=await memory(app.process().pid!,profile,readyAt,inventory);
   row.fixtureRequestsBeforeVisits=[...new Set(requests.slice(requestStart))];row.loadedFixturePages=row.fixtureRequestsBeforeVisits.length;
   await visitHeisen(app,page);
   const visitedAt=performance.now();await sleep(settleMs);row.allVisited=await memory(app.process().pid!,profile,visitedAt,inventory);
  }
  return row;
 }finally{await closeHeisen(app);}
}

async function configureHeisen(executable?:string){
 heisenExe=executable;
 heisenBundle=await fs.realpath(executable?path.resolve(executable,'../../..'):path.join(root,'node_modules/electron/dist/Electron.app'));
}
async function startFixtures(count=20){
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 urls=Array.from({length:count},(_,i)=>`${base}/page/${i}`);
 return base;
}
// The baseline predates sealed storage; only HSN1 files need the running app's keychain.
async function readLibrary(app:ElectronApplication,profile:string){
 const bytes=await fs.readFile(path.join(profile,'library.json'));
 return bytes.subarray(0,4).toString()==='HSN1'
  ? readSealedLibrary(app,profile)
  : JSON.parse(bytes.toString()) as {tabs:unknown[]};
}
export {root,chromeBundle,chromeExe,packaged,exec,sleep,timeoutMs,settleMs,within,poll,processes,idleCheck,idleChecks,
 memory,waitExit,windowProbeSource,windowProbe,requests,server,urls,configureHeisen,startFixtures,
 launchChrome,chromeTabs,chromeLoaded,visitChrome,prepareChrome,sampleChrome,launchHeisen,closeHeisen,rpc,
 heisenLoaded,visitHeisen,prepareHeisen,sampleHeisen,forcedQuits,launchFailures};
export type {Product,ProcessRow,Memory,Sample,State,LaunchInventory,WindowShown,WindowProbe,ChromeApp};

// WebKit XPC services reparent to launchd: parent-PID trees alone undercount Safari.
export async function compileResponsibilityTool(directory:string){
 const source=path.join(directory,'responsible.swift'),binary=path.join(directory,'responsible');
 await fs.writeFile(source,`import Foundation
@_silgen_name("responsibility_get_pid_responsible_for_pid") func responsible(_ pid: pid_t) -> pid_t
for arg in CommandLine.arguments.dropFirst() { if let p = Int32(arg) { print("\\(p) \\(responsible(p))") } }
`);
 await exec('/usr/bin/swiftc',['-O',source,'-o',binary],{timeout:60_000,maxBuffer:1024*1024});
 return binary;
}
export async function safariMemory(pid:number,existingPids:Set<number>,readyAt:number,tool:string):Promise<Memory>{
 const rows=await processes(),candidates=rows.filter(p=>p.pid===pid||!existingPids.has(p.pid));
 const {stdout}=await exec(tool,candidates.map(p=>String(p.pid)),{timeout:10_000,maxBuffer:1024*1024});
 const responsible=new Map(stdout.trim().split('\n').map(line=>line.split(' ').map(Number) as [number,number]));
 const selected=candidates.filter(p=>p.pid===pid||responsible.get(p.pid)===pid);
 assert.ok(selected.some(p=>p.pid===pid),'Safari exited before RSS sample');
 return {rssKiB:selected.reduce((sum,p)=>sum+p.rssKiB,0),processes:selected,sampledAfterReadyMs:performance.now()-readyAt};
}
