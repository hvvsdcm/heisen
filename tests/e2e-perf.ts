import {_electron as electron,type ElectronApplication,type Page} from 'playwright';
import {expect} from 'playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {once} from 'node:events';
import {createRequire} from 'node:module';
import {setTimeout as sleep} from 'node:timers/promises';
import {attachOnlyLocalUI} from './electron-util.ts';

type Tab={id:number;url:string;title:string;sleeping:boolean;sleepReason:'idle'|'leak'|'pressure'|null;sleptAt:number|null;hiddenAt?:number;canBack:boolean;canForward:boolean;taskId?:string;loading:boolean;error?:string};
type State={active:number;tabs:Tab[];tasks:{id:string;status:string}[];task?:{events:unknown[]}};
type Usage={kiB:number|null;shared:number};
type Contents={id:number;url:string;captured:boolean;audible:boolean;loading:boolean};
const root=path.resolve('.'),profile=path.join(root,'.test-perf');
await fs.rm(profile,{recursive:true,force:true});await fs.mkdir(profile,{recursive:true});
await fs.writeFile(path.join(profile,'library.json'),JSON.stringify({settings:{importOffered:true,onboarded:true,sleep:{afterMin:0,watchdog:false,budgetMiB:65536}}}));
let stage=0;const fixtureErrors:string[]=[];
let releaseTask!:()=>void;const taskChecked=new Promise<void>(resolve=>{releaseTask=resolve;});
const server=http.createServer((req,res)=>{void handle(req,res).catch(e=>{fixtureErrors.push(String(e));res.writeHead(500).end();});});
async function handle(req:http.IncomingMessage,res:http.ServerResponse){
 const route=(req.url||'').split('?')[0];res.setHeader('Cache-Control','no-store');
 if(route==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'heisen-test-model',name:'Local test model'}]}));return;}
 if(route==='/v1/chat/completions'){
  for await(const _ of req);
  const index=stage++,steps:[string,object][]=[['web_open',{url:base+'/p/9'}],['file_write',{path:'result.md',content:'# Performance fixture\nTask tab stayed loaded.'}],['task_finish',{summary:'Task tab verified.',artifactPaths:['result.md'],sourceIds:[]}]];
  // Hold a real running task while the sleeper is exercised; finish with verified evidence.
  if(index===1)await taskChecked;
  assert.ok(index<steps.length,'unexpected extra model request');const [name,args]=steps[index];
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'perf-'+index,object:'chat.completion',created:Date.now(),model:'heisen-test-model',choices:[{index:0,message:{role:'assistant',content:null,tool_calls:[{id:'c'+index,type:'function',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));return;
 }
 res.setHeader('Content-Type','text/html; charset=utf-8');
 // Keep real, incompressible allocations resident by touching every page. Otherwise
 // macOS can compress/page out a hidden fixture before working-set sampling sees it.
 // Allocation is capped at 512 MiB; closing the tab stops the fixture's timer.
 if(route==='/leak'){res.end('<title>Leak fixture</title><p>Bounded growing allocation</p><script>window.hold=[];setInterval(()=>{if(hold.length<32){const bytes=new Uint8Array(16<<20);for(let i=0;i<bytes.length;i+=65536)crypto.getRandomValues(bytes.subarray(i,i+65536));hold.push(bytes);}for(const bytes of hold)for(let i=0;i<bytes.length;i+=4096)bytes[i]^=1;},250);</script>');return;}
 if(route==='/audio'){res.end('<title>Audio fixture</title><p>Audible oscillator fixture</p>');return;}
 if(/^\/p\/\d+$/.test(route)){res.end(`<title>Page ${route.slice(3)}</title><p>Performance fixture ${route}</p><input id="f" aria-label="Entry"><div style="height:4000px"></div>`);return;}
 res.writeHead(404).end();
}
server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();assert.ok(address&&typeof address==='object');const base='http://127.0.0.1:'+address.port;
const env:Record<string,string>={...process.env as Record<string,string>,HEISEN_TEST_BACKGROUND:process.env.HEISEN_TEST_VISIBLE==='1'?'0':'1',HEISEN_DATA_DIR:profile,HEISEN_BETA_URL:'skip'};delete env.ELECTRON_RUN_AS_NODE;
let app:ElectronApplication|undefined,ui:Page|undefined;const errors:string[]=[];
const rpc=<T=unknown>(method:string,args:object={})=>app!.evaluate(({BrowserWindow},[method,args])=>{
 const win=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('file:'));if(!win)throw new Error('No local UI window');
 // Use the actual preload/IPC path, including its sender checks, rather than private app objects.
 return win.webContents.executeJavaScript(`window.heisen.call(${JSON.stringify(method)},${JSON.stringify(args)})`);
},[method,args] as const) as Promise<T>;
const state=()=>rpc<State>('state');
const tab=async(id:number)=>{const found=(await state()).tabs.find(t=>t.id===id);assert.ok(found,'missing tab '+id);assert.equal(found.error,undefined);return found;};
const open=(route:string)=>rpc<number>('tab.new',{url:base+route});
const select=(id:number)=>rpc('tab.select',{id});
const tick=()=>rpc('perf.tick');
const prefs=(args:object)=>rpc('prefs.save',args);
const inUrl=<T=unknown>(url:string,code:string,gesture=false)=>app!.evaluate(({webContents},[url,code,gesture])=>{
 const wc=webContents.getAllWebContents().find(w=>w.getURL()===url);if(!wc)throw new Error('No contents at '+url);return wc.executeJavaScript(code,gesture);
},[url,code,gesture] as const) as Promise<T>;
const contents=()=>app!.evaluate(({webContents})=>webContents.getAllWebContents().filter(w=>/^https?:/.test(w.getURL())).map(w=>({id:w.id,url:w.getURL(),captured:w.isBeingCaptured(),audible:w.isCurrentlyAudible(),loading:w.isLoading()}))) as Promise<Contents[]>;
const usage=(id:number)=>rpc<Usage>('tab.usage',{id});
const power=(event:'on-ac'|'on-battery')=>app!.evaluate(({powerMonitor},event)=>{powerMonitor.emit(event);},event);
async function uncaptured(){const rows=await contents();assert.ok(rows.length);assert.ok(rows.every(w=>!w.captured),'Web targets must not be attached/captured: '+JSON.stringify(rows));}
async function slept(id:number,reason:Tab['sleepReason']){const t=await tab(id);assert.equal(t.sleeping,true,JSON.stringify(t));assert.equal(t.sleepReason,reason);assert.ok(t.sleptAt&&t.sleptAt<=Date.now());await expect.poll(async()=>(await contents()).some(w=>w.url===t.url)).toBe(false);assert.deepEqual(await usage(id),{kiB:null,shared:0});}
async function loaded(id:number){const t=await tab(id);assert.equal(t.sleeping,false,JSON.stringify(t));assert.ok((await contents()).some(w=>w.url===t.url&&!w.loading),'loaded contents missing: '+t.url);}
async function closeOthers(keep:number){await select(keep);for(const t of (await state()).tabs)if(t.id!==keep)await rpc('tab.close',{id:t.id});}

try{
 // Explicit executablePath avoids Playwright's loader switches (in particular disabling
 // background throttling/BFCache). Keep the same Chromium defaults as the shipped app.
 const executablePath=process.env.HEISEN_EXECUTABLE?path.resolve(process.env.HEISEN_EXECUTABLE):createRequire(import.meta.url)('electron') as string;
 app=await electron.launch({executablePath,args:process.env.HEISEN_EXECUTABLE?[]:[root],env,timeout:45000,colorScheme:null});
 app.process().stderr?.on('data',b=>{if(/Error|ERR_/.test(String(b)))process.stderr.write(b);});
 ui=await app.firstWindow();await ui.getByRole('textbox',{name:'주소창'}).waitFor();
 await app.evaluate('globalThis.__name=(fn)=>fn');
 ui=await attachOnlyLocalUI(app,ui);
 ui.on('pageerror',e=>errors.push(e.message));await ui.getByRole('textbox',{name:'주소창'}).waitFor();
 await app.evaluate(({powerMonitor})=>{powerMonitor.emit('on-ac');powerMonitor.emit('thermal-state-change',{state:'nominal'});});
 await expect.poll(async()=>(await state()).tabs.length).toBeGreaterThan(0);

 // Real elapsed idle threshold; no clock, eligibility, metric or isBeingCaptured mocks.
 const A=await open('/p/1'),B=await open('/p/2');await inUrl(base+'/p/2','scrollTo(0,500)');await expect.poll(()=>inUrl(base+'/p/2','scrollY')).toBe(500);
 const C=await open('/p/3');await rpc('tab.navigate',{url:base+'/p/4'});await rpc('tab.navigate',{url:base+'/p/6'});await rpc('tab.command',{name:'back'});
 await expect.poll(async()=>(await tab(C)).url).toBe(base+'/p/4');await select(A);await uncaptured();
 const before=await contents();const oldIds=before.filter(w=>[base+'/p/2',base+'/p/4'].includes(w.url)).map(w=>w.id);assert.equal(oldIds.length,2);
 await prefs({sleep:{afterMin:0.02}});await sleep(2000);await tick();await slept(B,'idle');await slept(C,'idle');await loaded(A);
 assert.ok((await contents()).every(w=>!oldIds.includes(w.id)),'slept WebContents IDs survived');
 await select(B);await expect.poll(async()=>(await tab(B)).sleeping,{timeout:3000}).toBe(false);await expect.poll(()=>inUrl(base+'/p/2','scrollY'),{timeout:3000}).toBe(500);
 assert.ok((await contents()).find(w=>w.url===base+'/p/2'&&!oldIds.includes(w.id)),'restore must create a fresh WebContents');
 await select(C);assert.equal((await tab(C)).canBack,true);assert.equal((await tab(C)).canForward,true);assert.equal(await inUrl(base+'/p/4','document.title'),'Page 4');
 await rpc('tab.command',{name:'back'});await expect.poll(async()=>(await tab(C)).url).toBe(base+'/p/3');assert.equal(await inUrl(base+'/p/3','document.title'),'Page 3');
 await rpc('tab.command',{name:'forward'});await expect.poll(async()=>(await tab(C)).url).toBe(base+'/p/4');await rpc('tab.command',{name:'forward'});await expect.poll(async()=>(await tab(C)).url).toBe(base+'/p/6');
 console.log('PASS idle sleep destroys WebContents; selection restores page, scroll, back and forward history');
 await prefs({sleep:{afterMin:0}});await closeOthers(A);
 const liveUsage=await usage(A);assert.ok(liveUsage.kiB!==null&&liveUsage.kiB>10000,JSON.stringify(liveUsage));assert.ok(liveUsage.shared>=1);
 console.log('PASS tab.usage reports live renderer memory and null for sleeping tabs');

 const D=await open('/p/5');await inUrl(base+'/p/5',"document.getElementById('f').value='x'");
 // Audio-only playback isolates the audible guard from Chromium's own hidden-video
 // suspension policy; require genuine isCurrentlyAudible(), never mock eligibility.
 const audio=await open('/audio');await inUrl(base+'/audio','window.audio=new AudioContext();window.tone=audio.createOscillator();const gain=audio.createGain();gain.gain.value=0.01;tone.connect(gain);gain.connect(audio.destination);tone.start();audio.resume()',true);
 await expect.poll(async()=>(await contents()).find(w=>w.url===base+'/audio')?.audible,{timeout:10000}).toBe(true);
 await select(A);await prefs({sleep:{afterMin:0.02}});await sleep(2000);await uncaptured();await tick();
 await loaded(A);await loaded(D);await loaded(audio);assert.equal(await inUrl(base+'/p/5',"document.getElementById('f').value"),'x');
 assert.equal((await contents()).find(w=>w.url===base+'/audio')?.audible,true);
 // Pressure uses the same exclusion rules, independently of the idle threshold.
 const eligible=await open('/p/7');await select(A);await prefs({sleep:{budgetMiB:1}});await tick();await slept(eligible,'pressure');await loaded(A);await loaded(D);await loaded(audio);
 await prefs({sleep:{budgetMiB:65536,afterMin:0}});await closeOthers(A);
 console.log('PASS active, audible and dirty-form tabs survive idle and memory pressure');

 await rpc('auth.save',{provider:'local',baseURL:base+'/v1'});await rpc('settings.save',{provider:'local',model:'heisen-test-model'});
 await prefs({sleep:{afterMin:0.02}});const task=await rpc<{id:string}>('task.start',{prompt:'Open the performance fixture.',urls:[base+'/p/9']});
 await expect.poll(async()=>(await state()).tabs.some(t=>t.taskId===task.id&&!t.loading),{timeout:20000}).toBe(true);
 const taskTab=(await state()).tabs.find(t=>t.taskId===task.id)!;await select(A);await sleep(2000);await uncaptured();
 for(let i=0;i<2;i++){assert.equal((await state()).tasks.find(t=>t.id===task.id)?.status,'running');await tick();await loaded(taskTab.id);await sleep(250);}
 releaseTask();
 await expect.poll(async()=>{const s=await state(),status=s.tasks.find(t=>t.id===task.id)?.status;assert.notEqual(status,'failed',JSON.stringify(s.task));return status;},{timeout:20000}).toBe('completed');
 await tick();await slept(taskTab.id,'idle');await prefs({sleep:{afterMin:0}});await closeOthers(A);
 console.log('PASS a genuinely running task tab stays loaded through repeated ticks and sleeps after completion');

 await prefs({sleep:{afterMin:0,watchdog:true,leakFloorMiB:200,leakRateMiBPerMin:20}});
 const L=await open('/leak');await select(A);await uncaptured();const samples:Usage[]=[];
 // Hidden timers are throttled in an unmodified Chromium. Allow the bounded 16 MiB
 // x 32 fixture time to grow rather than disabling throttling or faking RSS samples.
 for(let i=0;i<35&&!(await tab(L)).sleeping;i++){await sleep(1000);samples.push(await usage(L));await tick();}
 assert.equal((await tab(L)).sleeping,true,'watchdog did not reclaim growing fixture: '+JSON.stringify(samples));await slept(L,'leak');await loaded(A);
 await select(L);await uncaptured();const activeSamples:Usage[]=[];
 // A visible active tab can still be OS-occluded (the test window is unfocused),
 // so Chromium's normal throttling can make allocation take longer than 8 s.
 // Keep the minimum protection window and both real allocation/RSS floors.
 for(let i=0;i<35;i++){
  await sleep(1000);activeSamples.push(await usage(L));await tick();await loaded(L);
  if(i>=7&&await inUrl<number>(base+'/leak','hold.length*16')>=200&&activeSamples.some(s=>s.kiB!==null&&s.kiB>=200*1024))break;
 }
 assert.ok(await inUrl<number>(base+'/leak','hold.length*16')>=200,'active leak fixture did not grow past the configured floor');
 assert.ok(activeSamples.some(s=>s.kiB!==null&&s.kiB>=200*1024),'no active sample reached the leak floor');
 await prefs({sleep:{watchdog:false}});await closeOthers(A);
 console.log('PASS real growing renderer triggers leak watchdog; active growing renderer is protected');

 // The installed powerMonitor listeners are the plan's test seam. Current policy
 // deliberately treats afterMin=0 as a global idle-sleep opt-out (including battery).
 const battery=await open('/p/10');await select(A);await prefs({sleep:{afterMin:60,afterMinOnBattery:0.02},energy:{batterySaver:true}});await sleep(2000);
 await power('on-ac');await tick();await loaded(battery);
 await power('on-battery');await tick();await slept(battery,'idle');
 await select(battery);await select(A);await prefs({sleep:{afterMin:0}});await sleep(2000);await tick();await loaded(battery);
 await prefs({sleep:{afterMin:60},energy:{batterySaver:false}});await tick();await loaded(battery);
 await power('on-ac');await prefs({energy:{batterySaver:true}});await tick();await loaded(battery);
 await app.evaluate(({powerMonitor})=>{powerMonitor.emit('thermal-state-change',{state:'serious'});});await tick();await slept(battery,'idle');
 await app.evaluate(({powerMonitor})=>{powerMonitor.emit('thermal-state-change',{state:'nominal'});});
 console.log('PASS AC/battery/thermal thresholds, battery-saver opt-out and globally disabled idle sleep');
 await uncaptured();assert.equal(app.windows().length,1,'only the local UI may be tracked by Playwright');assert.deepEqual(errors,[]);assert.deepEqual(fixtureErrors,[]);
 console.log('ALL PERF CHECKS PASSED');
}finally{
 releaseTask();
 try{await app?.close();}finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await fs.rm(profile,{recursive:true,force:true});}
}
