import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {root,chromeExe,packaged,exec,sleep,settleMs,idleCheck,idleChecks,forcedQuits,launchFailures,
 configureHeisen,startFixtures,server,prepareChrome,prepareHeisen,sampleChrome,sampleHeisen} from './bench-lib.ts';
import type {Product,Sample} from './bench-lib.ts';

// Run from any directory: node --import tsx tests/performance-chrome.ts
const out=path.resolve(root,'docs/evidence/performance-chrome.json');
const runs=5,samples:Sample[]=[];
let heisenExe:string|undefined;
const median=(values:number[])=>{assert.equal(values.length,runs);return [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];};
const summarize=(product:Product)=>{
 const cold=samples.filter(s=>s.product===product&&s.tabs===0),restored=samples.filter(s=>s.product===product&&s.tabs===20);
 return {coldVisibleMs:median(cold.map(s=>s.visibleMs)),restoredVisibleMs:median(restored.map(s=>s.visibleMs)),activeLoadedMs:median(restored.map(s=>s.activeLoadedMs!)),restoredRssKiB:median(restored.map(s=>s.restored!.rssKiB)),allVisitedRssKiB:median(restored.map(s=>s.allVisited!.rssKiB))};
};

await fs.access(chromeExe);
assert.equal(process.platform,'darwin','This benchmark measures macOS ps RSS');
await idleCheck();
if(process.env.HEISEN_EXECUTABLE){heisenExe=path.resolve(process.env.HEISEN_EXECUTABLE);await fs.access(heisenExe);}
else if(await fs.access(packaged).then(()=>true,()=>false))heisenExe=packaged;
else await exec('npm',['run','build'],{cwd:root,maxBuffer:8*1024*1024});
await configureHeisen(heisenExe);
const temp=await fs.mkdtemp(path.join(os.tmpdir(),'heisen-chrome-bench-'));
try{
 await startFixtures();
 for(let run=1;run<=runs;run++)for(const tabs of [0,20] as const){
  // Alternate browser order to reduce systematic cache/thermal/order bias.
  const order:Product[]=run%2?['Chrome','Heisen']:['Heisen','Chrome'];
  for(const product of order){
   await idleCheck();
   const profile=path.join(temp,`${product}-${tabs}-${run}`);await fs.mkdir(profile);
   if(tabs){if(product==='Chrome')await prepareChrome(profile);else await prepareHeisen(profile);}
   await sleep(1000);await idleCheck();
   const row=product==='Chrome'?await sampleChrome(profile,run,tabs):await sampleHeisen(profile,run,tabs);
   samples.push(row);console.log(JSON.stringify({...row,restored:row.restored?.rssKiB,allVisited:row.allVisited?.rssKiB}));
   await fs.rm(profile,{recursive:true,force:true});await sleep(500);
  }
 }
 const medians={Chrome:summarize('Chrome'),Heisen:summarize('Heisen')};
 const ratios=Object.fromEntries(Object.keys(medians.Chrome).map(key=>{const k=key as keyof typeof medians.Chrome;return [k,medians.Heisen[k]/medians.Chrome[k]];}));
 const buildFile=heisenExe?path.resolve(heisenExe,'../../Resources/app.asar'):path.join(root,'dist/main.mjs');
 const evidence={
  at:new Date().toISOString(),
  machine:{platform:os.platform(),release:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()},
  build:{heisenExecutable:heisenExe??'node_modules/electron (development build)',heisenCodeSha256:createHash('sha256').update(await fs.readFile(buildFile)).digest('hex'),chromeExecutable:chromeExe},
  method:{
   runs,settleMs,
   fixture:'20 distinct same-origin loopback HTML URLs; title/h1/p only; Cache-Control: no-store; derived from tests/performance.ts',
   profiles:'Fresh isolated profile for every browser/workload/run. For restoration BOTH browsers visit all 20 URLs, select /page/0, wait 1 s, and quit cleanly before timed relaunch. Chrome uses --restore-last-session.',
   timing:'Window visible (both products, identical signal): host performance.now() from immediately before launch until an osascript JXA probe (started before the launch, polling every ~5 ms + query time) sees CGWindowListCopyWindowInfo(OnScreenOnly) report a layer-0 window >=100x100 owned by a newly started process of the measured app bundle; the owning PID must equal the launched browser PID. Active tab loaded: /page/0 location.href + document.readyState === "complete" (Chrome via Runtime.evaluate over a per-tab DevTools WebSocket; Heisen via Electron webContents executeJavaScript + !isLoadingMainFrame), polled every 20 ms. Upper bounds, not compositor first-paint timestamps.',
   memory:'ps -axo pid,ppid,rss,%cpu,command; sum RSS KiB of root and all descendants plus unique-profile processes and new app-bundle processes absent from the pre-launch PID inventory (including reparented crash reporters). Same sampler for both; unlike performance.ts Electron-only workingSetSize, this is OS RSS (shared pages double-counted, not unique footprint). Sample 3 s after both window observation and active load, then 3 s after all 20 tabs have been selected and loaded.',
   order:'5 runs; browser order alternates by run; same server, sequential browser lifetimes; 1 s after session preparation and 0.5 s after cleanup.',
   idleMachine:'Quiet-test window: before every launch, no project test/build/dev-Electron process and no Playwright browser started after the benchmark began. Processes already running at benchmark start (user release/ Heisen, user Google Chrome, Claude/Grok/Discord, another session\'s long-lived headless Playwright browser) are background, left running and recorded with ps CPU% and load averages in idleChecks. Not a fully idle OS claim.',
   asymmetries:[
    'Each browser uses its own restore policy: Heisen creates a page view only for the selected tab; Chrome creates all 20 tab targets and loads them by its own scheduler. loadedFixturePages = distinct fixture URLs the server received from launch until the restored-memory sample (3 s after active load). Visits: Heisen tab.select RPC; Chrome CDP Target.activateTarget; each visit waits for readyState complete.',
    'Launch path differs: Heisen via Playwright electron.launch (adds --inspect=0 --remote-debugging-port=0 and a loader script); Chrome via child_process.spawn with --remote-debugging-port=0 then Playwright connectOverCDP(noDefaults). The visible-window signal is OS-level for both, but launcher overhead differs. Load detection goes through different automation channels.',
    'Heisen uses an unfused test package when present (otherwise dev build), not hardened release fuses; Chrome is the installed production build.',
    'Heisen bypasses first-run onboarding/import with settings.importOffered/onboarded; Chrome --no-first-run --no-default-browser-check. Both isolated profiles use mock keychain.',
    '0 saved tabs opens each product default new-tab/home UI, not identical UI. OS file caches are not flushed; this is fresh-profile process launch, not cold disk boot.',
    'One machine, tiny local same-origin pages, no extensions/sign-in, no real-world site or general speed/battery claim. RSS can double-count shared pages.',
    'launchFailures: Heisen launches under Playwright whose main process created no window within 60 s; each is recorded with app.isReady()/window diagnostics, killed, and retried once in the same profile (the retry is the measured launch). Chrome launches had no retry path.'
   ]
  },
  idleChecks,forcedQuits,launchFailures,samples,medians,
  ratios:{definition:'Heisen / Chrome (lower is better for all metrics); raw division of unrounded medians',values:ratios}
 };
 await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({out,medians,ratios},null,2));
}finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await fs.rm(temp,{recursive:true,force:true});}
