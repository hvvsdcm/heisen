import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {
 root,chromeExe,packaged,exec,sleep,settleMs,within,poll,processes,idleCheck,idleChecks,memory,waitExit,
 windowProbe,server,urls,startFixtures,configureHeisen,launchChrome,chromeTabs,chromeLoaded,visitChrome,
 prepareChrome,sampleChrome,launchHeisen,closeHeisen,rpc,heisenLoaded,visitHeisen,prepareHeisen,sampleHeisen,
 forcedQuits,launchFailures,compileResponsibilityTool,safariMemory,
} from './bench-lib.ts';
import type {Memory,State,Product,WindowProbe} from './bench-lib.ts';
import {attachOnlyLocalUI} from './electron-util.ts';

// Full run: HEISEN_EXECUTABLE=/path/to/Heisen.app/Contents/MacOS/Heisen HEISEN_BENCH_LABEL=before node --import tsx tests/performance-safari.ts
// Smoke only: HEISEN_BENCH_RUNS=1 HEISEN_BENCH_TABS=3 HEISEN_BENCH_IDLE_MIN=1 HEISEN_BENCH_LEAK_SECONDS=1
// before/after are separate invocations of this identical harness; never compare different settings.
const label=process.env.HEISEN_BENCH_LABEL??'after';
assert.match(label,/^[a-zA-Z0-9_-]+$/,'Label must be a filename-safe identifier');
const runs=Number(process.env.HEISEN_BENCH_RUNS??3),tabCount=Number(process.env.HEISEN_BENCH_TABS??20);
const idleMin=Number(process.env.HEISEN_BENCH_IDLE_MIN??10),leakSeconds=Number(process.env.HEISEN_BENCH_LEAK_SECONDS??180);
assert.ok(Number.isInteger(runs)&&runs>=1&&runs<=100,'Invalid run count');
assert.ok(Number.isInteger(tabCount)&&tabCount>=1&&tabCount<=20,'Invalid tab count');
assert.ok(Number.isFinite(idleMin)&&idleMin>0&&idleMin<=1440,'Invalid idle duration');
assert.ok(Number.isFinite(leakSeconds)&&leakSeconds>0&&leakSeconds<=3600,'Invalid leak duration');
const smoke=runs===1&&tabCount===3&&idleMin===1;
const executable=path.resolve(process.env.HEISEN_EXECUTABLE??packaged);
const out=path.resolve(root,`docs/evidence/performance-safari-${label}.json`);
const safariBundle=await fs.realpath('/Applications/Safari.app'),safariExe=path.join(safariBundle,'Contents/MacOS/Safari');
const safariMainPaths=[safariExe,'/Applications/Safari.app/Contents/MacOS/Safari'];
function isSafariMain(command:string){return safariMainPaths.some(exe=>command===exe||command.startsWith(exe+' '));}
const idleSleepSettings={afterMin:5,afterMinOnBattery:5};
type BenchProduct=Product|'Safari';
type Metrics={coldVisibleMs:number|null;restoredVisibleMs:number|null;activeLoadedMs:number|null;restoredRssKiB:number|null;allVisitedRssKiB:number|null;idleRssKiB:number|null;leakRssKiB:number|null};
type Sample=Metrics&{product:BenchProduct;run:number;version:string;launchAttempts:number;restored?:Memory|null;allVisited?:Memory|null;idle?:Memory|null;leak?:Memory|null;sleepingTabs?:number|null;capturedWebTabs?:number;sleepSupported?:boolean;idleSleepSettings?:unknown;leakState?:unknown};
const samples:Sample[]=[];
let safariSkipped:string|null=process.env.HEISEN_BENCH_SKIP_SAFARI==='1'?'HEISEN_BENCH_SKIP_SAFARI=1':null;
let safariMemoryUnavailable:string|null=null,responsibilityTool:string|undefined;
const powerChecks:{at:string;phase:string;raw:string}[]=[];
async function acPower(phase:string){
 const {stdout}=await exec('/usr/bin/pmset',['-g','batt']);
 powerChecks.push({at:new Date().toISOString(),phase,raw:stdout.trim()});
 // A short plumbing-only smoke is not performance evidence and may run on battery.
 if(!smoke)assert.match(stdout,/AC Power/,'Connect AC power before benchmarking');
}

async function sampleChromium(product:Product,run:number,temp:string,leakUrl:string):Promise<Sample>{
 const coldProfile=path.join(temp,`${product}-${run}-cold`),profile=path.join(temp,`${product}-${run}-restore`);
 await fs.mkdir(coldProfile);await fs.mkdir(profile);
 const cold=product==='Chrome'?await sampleChrome(coldProfile,run,0):await sampleHeisen(coldProfile,run,0);
 if(product==='Chrome')await prepareChrome(profile);else await prepareHeisen(profile);
 await sleep(1000);await idleCheck();
 const row:Sample={product,run,version:cold.version,launchAttempts:cold.launchAttempts,coldVisibleMs:cold.visibleMs,restoredVisibleMs:null,activeLoadedMs:null,restoredRssKiB:null,allVisitedRssKiB:null,idleRssKiB:null,leakRssKiB:null};
 if(product==='Chrome'){
  const app=await launchChrome(profile,['--restore-last-session']);row.launchAttempts++;
  try{
   const shown=await app.visible;assert.equal(shown.pid,app.child.pid);row.restoredVisibleMs=shown.at-app.before;
   const first=(await chromeTabs(app)).find(t=>t.url===urls[0])!;
   await chromeLoaded(app,first.targetId,urls[0]);row.activeLoadedMs=performance.now()-app.before;
   let at=performance.now();await sleep(settleMs);row.restored=await memory(app.child.pid!,profile,at,app.inventory);
   await visitChrome(app);at=performance.now();await sleep(settleMs);row.allVisited=await memory(app.child.pid!,profile,at,app.inventory);
   const cdp=await app.browser.newBrowserCDPSession();
   try{
    await within('Chrome select first',cdp.send('Target.activateTarget',{targetId:first.targetId}));
    await acPower(`${product}-${run}-idle-start`);at=performance.now();await sleep(idleMin*60_000);await acPower(`${product}-${run}-idle-end`);
    row.idle=await memory(app.child.pid!,profile,at,app.inventory);
    const leak=await within('Chrome leak tab',cdp.send('Target.createTarget',{url:leakUrl}));
    await within('Chrome activate leak',cdp.send('Target.activateTarget',{targetId:leak.targetId}));await chromeLoaded(app,leak.targetId,leakUrl);
    await within('Chrome return to first',cdp.send('Target.activateTarget',{targetId:first.targetId}));
    at=performance.now();await sleep(leakSeconds*1000);row.leak=await memory(app.child.pid!,profile,at,app.inventory);
    row.leakState={targetExists:(await within('Chrome leak target status',cdp.send('Target.getTargets'))).targetInfos.some(t=>t.targetId===leak.targetId)};
   }finally{await cdp.detach();}
  }finally{await app.close();}
 }else{
  const {app,page:initialPage,before,inventory,visible,attempt}=await launchHeisen(profile,'sample');row.launchAttempts+=attempt;
  try{
   const shown=await visible;assert.equal(shown.pid,app.process().pid);row.restoredVisibleMs=shown.at-before;
   await initialPage.getByRole('textbox',{name:'주소창'}).waitFor();
   const page=await attachOnlyLocalUI(app,initialPage);
   await page.getByRole('textbox',{name:'주소창'}).waitFor();
   await heisenLoaded(app,urls[0]);row.activeLoadedMs=performance.now()-before;
   let state=await poll('Heisen restored tab state',()=>rpc<State>(page,'state'),s=>s.tabs.length===urls.length);
   const first=state.tabs.find(t=>t.url===urls[0])!;assert.equal(state.active,first.id);
   let at=performance.now();await sleep(settleMs);row.restored=await memory(app.process().pid!,profile,at,inventory);
   await visitHeisen(app,page);at=performance.now();await sleep(settleMs);row.allVisited=await memory(app.process().pid!,profile,at,inventory);
   await rpc(page,'tab.select',{id:first.id});
   state=await rpc<State>(page,'state');const originalSleep=state.settings?.sleep;
   row.sleepSupported=originalSleep!==undefined;row.idleSleepSettings=originalSleep===undefined?null:idleSleepSettings;
   if(originalSleep!==undefined)await rpc(page,'prefs.save',{sleep:idleSleepSettings});
   const capturedWebTabs=()=>app.evaluate(({webContents})=>webContents.getAllWebContents().filter(w=>/^https?:/.test(w.getURL())&&w.isBeingCaptured()).length);
   assert.equal(await capturedWebTabs(),0,'Heisen web tabs must not be captured at idle-start');
   await acPower(`${product}-${run}-idle-start`);at=performance.now();await sleep(idleMin*60_000);await acPower(`${product}-${run}-idle-end`);
   row.idle=await memory(app.process().pid!,profile,at,inventory);
   state=await rpc<State>(page,'state');row.sleepingTabs=originalSleep===undefined?null:state.tabs.filter(t=>t.sleeping).length;
   row.capturedWebTabs=await capturedWebTabs();
   assert.equal(row.capturedWebTabs,0,'Heisen web tabs must not be captured at idle-end');
   // The accelerated sleep policy applies only to idle, never to the leak observation.
   if(originalSleep!==undefined)await rpc(page,'prefs.save',{sleep:originalSleep});
   const leakId=await rpc<number>(page,'tab.new',{url:leakUrl});await heisenLoaded(app,leakUrl);await rpc(page,'tab.select',{id:first.id});
   at=performance.now();await sleep(leakSeconds*1000);row.leak=await memory(app.process().pid!,profile,at,inventory);
   const leak=(await rpc<State>(page,'state')).tabs.find(t=>t.id===leakId);
   row.leakState={exists:!!leak,sleeping:leak?.sleeping??null,sleepReason:leak?.sleepReason??null};
  }finally{await closeHeisen(app);}
 }
 row.restoredRssKiB=row.restored?.rssKiB??null;row.allVisitedRssKiB=row.allVisited?.rssKiB??null;
 row.idleRssKiB=row.idle?.rssKiB??null;row.leakRssKiB=row.leak?.rssKiB??null;
 await fs.rm(coldProfile,{recursive:true,force:true});await fs.rm(profile,{recursive:true,force:true});
 return row;
}

async function sampleSafari(run:number,leakUrl:string):Promise<Sample|null>{
 const existingPids=new Set((await processes()).map(p=>p.pid));
 assert.ok(!(await processes()).some(p=>isSafariMain(p.command)),'Safari를 종료한 뒤 실행하세요');
 const reservation=net.createServer();await new Promise<void>(resolve=>reservation.listen(0,'127.0.0.1',resolve));
 const address=reservation.address();assert.ok(address&&typeof address==='object');const port=address.port;
 await new Promise<void>(resolve=>reservation.close(()=>resolve()));
 const driver=spawn('/usr/bin/safaridriver',['-p',String(port)],{stdio:['ignore','ignore','pipe']});
 let stderr='',spawnError:Error|undefined;driver.stderr!.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-8192);});driver.on('error',error=>{spawnError=error;});
 const endpoint=`http://127.0.0.1:${port}`;let sessionId:string|undefined,ownedPid:number|undefined;
 let probe:WindowProbe|undefined;
 async function wd<T>(method:string,route:string,body?:object):Promise<T>{
  const res=await fetch(endpoint+route,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60_000)});
  const data=await res.json() as {value:T&{error?:string;message?:string}};
  if(!res.ok||data.value?.error)throw new Error(`Safari WebDriver ${res.status}: ${data.value?.message??JSON.stringify(data.value)}`);
  return data.value;
 }
 try{
  await within('Safari driver status',poll('Safari driver status',async()=>{
   if(spawnError)throw spawnError;if(driver.exitCode!==null||driver.signalCode!==null)throw new Error(`safaridriver exited: ${stderr}`);
   try{return (await fetch(endpoint+'/status',{signal:AbortSignal.timeout(1000)})).ok;}catch{return false;}
  },Boolean),30_000);
  probe=await windowProbe(safariBundle,existingPids);const before=performance.now(),visible=probe();visible.catch(()=>{});
  let session:{sessionId:string;capabilities:{browserVersion:string}};
  try{session=await wd('POST','/session',{capabilities:{alwaysMatch:{browserName:'safari'}}});}
  catch(error){
   if(/allow remote automation|remote automation.*(?:disabled|not enabled)|enable.*remote automation/i.test(String(error))){safariSkipped=String(error);return null;}
   throw error;
  }
  sessionId=session.sessionId;const route=`/session/${sessionId}`,shown=await visible;ownedPid=shown.pid;
  const row:Sample={product:'Safari',run,version:session.capabilities.browserVersion,launchAttempts:1,coldVisibleMs:shown.at-before,restoredVisibleMs:null,activeLoadedMs:null,restoredRssKiB:null,allVisitedRssKiB:null,idleRssKiB:null,leakRssKiB:null};
  const initial=await wd<string>('GET',route+'/window');let first='';
  for(const url of urls){
   const {handle}=await wd<{handle:string}>('POST',route+'/window/new',{type:'tab'});if(!first)first=handle;
   await wd('POST',route+'/window',{handle});await wd('POST',route+'/url',{url});
   await poll('Safari complete '+url,()=>wd('POST',route+'/execute/sync',{script:'return location.href+" "+document.readyState',args:[]}),value=>value===url+' complete');
  }
  // Keep exactly N fixture tabs: remove only the initial automation-session blank tab.
  await wd('POST',route+'/window',{handle:initial});await wd('DELETE',route+'/window');await wd('POST',route+'/window',{handle:first});
  let at=performance.now();await sleep(settleMs);row.allVisited=responsibilityTool?await safariMemory(ownedPid,existingPids,at,responsibilityTool):null;
  await acPower(`Safari-${run}-idle-start`);at=performance.now();await sleep(idleMin*60_000);await acPower(`Safari-${run}-idle-end`);
  row.idle=responsibilityTool?await safariMemory(ownedPid,existingPids,at,responsibilityTool):null;
  const {handle}=await wd<{handle:string}>('POST',route+'/window/new',{type:'tab'});
  await wd('POST',route+'/window',{handle});await wd('POST',route+'/url',{url:leakUrl});
  await poll('Safari leak complete',()=>wd('POST',route+'/execute/sync',{script:'return document.readyState',args:[]}),value=>value==='complete');
  await wd('POST',route+'/window',{handle:first});at=performance.now();await sleep(leakSeconds*1000);
  row.leak=responsibilityTool?await safariMemory(ownedPid,existingPids,at,responsibilityTool):null;
  row.leakState={targetExists:(await wd<string[]>('GET',route+'/window/handles')).includes(handle)};
  row.allVisitedRssKiB=row.allVisited?.rssKiB??null;row.idleRssKiB=row.idle?.rssKiB??null;row.leakRssKiB=row.leak?.rssKiB??null;
  return row;
 }finally{
  probe?.cancel();
  try{
   if(sessionId)await wd('DELETE',`/session/${sessionId}`).catch(error=>{forcedQuits.push({product:'Safari',at:new Date().toISOString(),error:String(error)});});
   // Safari was required absent at entry. Never quit an unrelated, pre-existing Safari.
   ownedPid??=(await processes()).find(p=>!existingPids.has(p.pid)&&isSafariMain(p.command))?.pid;
   if(ownedPid&&(await processes()).some(p=>p.pid===ownedPid)){
    await exec('/usr/bin/osascript',['-e','tell application "Safari" to quit'],{timeout:30_000});
    await poll('owned Safari exit',async()=>!(await processes()).some(p=>p.pid===ownedPid),Boolean);
   }
  }finally{if(driver.exitCode===null&&driver.signalCode===null)driver.kill('SIGTERM');if(!spawnError)await waitExit(driver);}
 }
}

assert.equal(process.platform,'darwin','This benchmark uses macOS RSS and window visibility');
await fs.access(executable);await fs.access(chromeExe);await idleCheck();await acPower('start');await configureHeisen(executable);
if(!safariSkipped)assert.ok(!(await processes()).some(p=>isSafariMain(p.command)),'Safari를 종료한 뒤 실행하세요');
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'heisen-safari-bench-'));
try{
 const base=await startFixtures(tabCount);
 if(!safariSkipped){try{responsibilityTool=await compileResponsibilityTool(temp);}catch(error){safariMemoryUnavailable=String(error);}}
 for(let run=1;run<=runs;run++){
  // A three-product rotation balances first/middle/last positions over the default three runs.
  const products:BenchProduct[]=['Chrome','Heisen','Safari'],offset=(run-1)%products.length;
  const order=[...products.slice(offset),...products.slice(0,offset)];
  for(const product of order){
   if(product==='Safari'&&safariSkipped)continue;
   await idleCheck();await acPower(`${product}-${run}-start`);
   const row=product==='Safari'?await sampleSafari(run,base+'/leak'):await sampleChromium(product,run,temp,base+'/leak');
   if(row){samples.push(row);console.log(JSON.stringify({...row,restored:row.restored?.rssKiB,allVisited:row.allVisited?.rssKiB,idle:row.idle?.rssKiB,leak:row.leak?.rssKiB}));}
   await sleep(500);
  }
 }
 const keys:(keyof Metrics)[]=['coldVisibleMs','restoredVisibleMs','activeLoadedMs','restoredRssKiB','allVisitedRssKiB','idleRssKiB','leakRssKiB'];
 const medians={} as Record<BenchProduct,Metrics|null>;
 for(const product of ['Chrome','Heisen','Safari'] as const){
  const rows=samples.filter(s=>s.product===product);if(!rows.length){medians[product]=null;continue;}
  assert.equal(rows.length,runs);const metrics={} as Metrics;
  for(const key of keys){const values=rows.map(r=>r[key]);if(values.some(v=>v===null)){metrics[key]=null;continue;}const sorted=(values as number[]).sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);metrics[key]=sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
  medians[product]=metrics;
 }
 const ratios:Record<string,Metrics>={};
 for(const product of ['Chrome','Safari'] as const){const values={} as Metrics;for(const key of keys){const numerator=medians.Heisen?.[key],denominator=medians[product]?.[key];values[key]=numerator!=null&&denominator!=null&&denominator>0?numerator/denominator:null;}ratios[`Heisen/${product}`]=values;}
 const heisenCodeSha256=createHash('sha256').update(await fs.readFile(path.resolve(executable,'../../Resources/app.asar'))).digest('hex');
 const evidence={at:new Date().toISOString(),label,heisenCodeSha256,
  machine:{platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()},
  build:{heisenExecutable:executable,heisenCodeSha256,chromeExecutable:chromeExe,safariBundle},
  method:{runs,tabCount,settleMs,idleMin,leakSeconds,smoke,powerPolicy:'AC required except 1-run/3-tab/1-minute plumbing smoke; raw power readings retained',safariSkipped,safariMemoryUnavailable,
   fixture:'Identical same-origin loopback title/h1/p pages with Cache-Control:no-store. /leak retains 16 MiB every 250 ms, capped at 48 allocations (768 MiB). No external assets.',
   profiles:'New isolated Chrome/Heisen cold and restore profiles per run. Both visit all fixture tabs, select /page/0, wait 1 s, quit, then restore. Safari uses a fresh WebDriver automation session, never personal data; Safari must be closed first.',
   timing:'Host performance.now from launch (Safari POST /session) to identical prestarted JXA CGWindowList on-screen layer-0 >=100x100 window signal. Active loaded waits for location and readyState complete. Fresh-profile process launch, not flushed disk caches or compositor first paint.',
   memory:'ps RSS KiB, root/descendants plus unique-profile and newly started app-bundle processes. Safari root plus new processes whose responsibility_get_pid_responsible_for_pid equals the Safari PID, including reparented WebKit XPC. Shared pages may be double-counted. Full process rows retained. Swift unavailable => Safari RSS null, never a partial main-process-only value.',
   idle:{selected:'/page/0',heisenSleepOverride:idleSleepSettings,scope:'Only the idle phase on builds exposing settings.sleep; baseline lacks this feature. Original settings restored before leak. This is an explicit five-minute policy, not shipping defaults.',automation:'For both baseline and current Heisen, disable Playwright root auto-attachment and reattach only the local UI before visiting restored tabs. capturedWebTabs counts HTTP(S) WebContents with isBeingCaptured() at idle-end; require zero at idle-start and idle-end.',powerChecks},
   leak:'Open /leak, wait readyState complete, return to /page/0, wait leakSeconds. Record actual sleep/target state, no sleep assertion. Burst allocation may plateau before watchdog samples; idle phase may already have unloaded background tabs.',
   order:'Sequential browser lifetimes, rotating Chrome/Heisen/Safari order per run; 1 s after session preparation, 0.5 s after cleanup.',
   idleMachine:'Reject competing project builds/tests/dev Electron; record existing user-app background CPU and OS load, without terminating them. Not a fully idle OS claim.',
   asymmetries:['Safari restoration metrics are null: WebDriver does not safely restore personal sessions. Safari cold startup is session creation to visible automation window.','Heisen uses Playwright Electron with unfused package and onboarding bypass; Chrome uses installed build with CDP/no-first-run/mock keychain; Safari uses safaridriver. Launcher overhead differs.','Cold Chrome/Heisen default new-tab UI differs; all-visited memory is sampled after every fixture is loaded, not an equal renderer count.','Three/default repeated trials of tiny local pages on one machine are not a real-world speed, battery, or general leak claim.','HEISEN_BENCH_LABEL identifies before/after runs; compare only matching machine/workload settings and use build hashes to identify code.','Short smoke durations exercise plumbing, not sleep or leak efficacy.'],
  },idleChecks,forcedQuits,launchFailures,samples,medians,ratios:{definition:'Heisen / comparator; unrounded medians; null when unavailable',values:ratios}};
 await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({out,medians,ratios,safariSkipped},null,2));
}finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await fs.rm(temp,{recursive:true,force:true});}
