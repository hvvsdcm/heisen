import {registerAuditRpc} from './audit-view.ts';
import {app,BrowserWindow,safeStorage,shell,dialog,clipboard,systemPreferences,session} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {Data,Secrets,readLaunch} from './data.ts';
import {type Browser,installBrowserRpc,HOME,address,agentAllowed} from './browser.ts';
import {Windows,windows,setWindows} from './windows.ts';
import {Sessions} from './sessions.ts';
import {applyIdentity} from './identity.ts';
import {Permissions} from './permissions.ts';
import {Passwords} from './passwords.ts';
import {Autofill} from './autofill.ts';
import {Signup} from './signup.ts';
import {Auth,providers} from './auth.ts';
import {HeisenEngine} from './models.ts';
import {Store,sealedCodec} from './store.ts';
import {Routines,nextRun} from './routines.ts';
import {AgentApi} from './agent-api.ts';
import {Control} from './control.ts';
import {cliInstalled,installCli,uninstallCli} from './cli/install.ts';
import {MemoryStore,Dreaming,slug} from './memory.ts';
import {SkillStore,type SkillMeta} from './skills.ts';
import {complete} from './completion.ts';
import {ComputerUse} from './computer.ts';
import {readFile,safePath} from './files.ts';
import {originOf,textArg,type Task} from './protocol.ts';
import {registerRpc,registerState,installRpc,collectState} from './rpc.ts';
import {installMenu} from './menu.ts';
import {needsMigration,runMigration,legacyRunning} from './migrate.ts';
import {keychainReader,isTestKeychain} from './chromium-crypto.ts';
import {Beta} from './beta.ts';
import {betaServer} from './beta-util.ts';
import {enableTestBackground} from './test-background.ts';
import {dockerCandidates,chromiumRoots,bundledCliPath} from './platform.ts';
import {TabSleeper} from './sleeper.ts';
import {Shield} from './shield.ts';
import {HttpsFirst} from './https-first.ts';
import {SafeBrowsing} from './safebrowsing.ts';
import {Updater} from './updater.ts';
import {installTray,refreshTray} from './tray.ts';
import {isDefaultBrowser,registerDefaultBrowser,squirrelStartup} from './platform-app.ts';
const dist=path.dirname(fileURLToPath(import.meta.url));const root=path.dirname(dist);
export type SecurityPatch=Partial<Pick<Data['state']['settings'],'https'|'safeBrowsing'|'downloads'|'agentSites'>>;
// Pure validation stays independent of Electron startup so malformed patches cannot
// partially weaken another security group.
export function securityPatch(input:unknown):SecurityPatch{
 const invalid=()=>{throw new Error('보안 설정이 올바르지 않습니다.');};
 const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
 if(!object(input))return invalid();
 const patch:SecurityPatch={};
 for(const [group,value] of Object.entries(input)){
  if(!object(value))return invalid();
  const keys=Object.keys(value);
  if(group==='safeBrowsing'||group==='downloads'){
   const key=group==='safeBrowsing'?'enabled':'askWhere';
   if(keys.length!==1||keys[0]!==key||typeof value[key]!=='boolean')return invalid();
   if(group==='safeBrowsing')patch.safeBrowsing={enabled:value[key] as boolean};else patch.downloads={askWhere:value[key] as boolean};
  }else if(group==='https'){
   if(keys.length!==1||keys[0]!=='allowed'||!Array.isArray(value.allowed)||value.allowed.length>500)return invalid();
   const allowed:string[]=[];
   for(const host of value.allowed){
    if(typeof host!=='string'||!host.length||host.length>253||/[\s/\\:@?#%]/.test(host))return invalid();
    let canonical:string;try{canonical=new URL('http://'+host).hostname.toLowerCase().replace(/\.$/,'');}catch{return invalid();}
    if(canonical.length>253||!canonical.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))return invalid();
    allowed.push(canonical);
   }
   patch.https={allowed:[...new Set(allowed)]};
  }else if(group==='agentSites'){
   if(keys.length>500)return invalid();
   const sites:Record<string,'allow'|'block'>={};
   for(const [origin,policy] of Object.entries(value)){
    if(policy!=='allow'&&policy!=='block')return invalid();
    // Require the serialized origin, not a path/credential URL whose policy
    // would silently fail to match agentAllowed's origin lookup.
    let canonical:string;try{canonical=originOf(origin);}catch{return invalid();}
    if(canonical!==origin)return invalid();
    sites[canonical]=policy;
   }
   patch.agentSites=sites;
  }else return invalid();
 }
 return patch;
}
export function browsingSince(range:unknown,now=Date.now()):number{
 if(range===undefined||range==='all')return 0;
 const durations={hour:36e5,day:864e5,week:6048e5,month:2419200e3};
 if(typeof range!=='string'||!Object.hasOwn(durations,range))throw new Error('삭제 기간이 올바르지 않습니다.');
 return now-durations[range as keyof typeof durations];
}
app.enableSandbox();
// Only the staged HEISEN_UNFUSED package has this marker; shipped builds ignore test environment switches.
const testBuild=app.isPackaged&&(()=>{try{return JSON.parse(fs.readFileSync(path.join(app.getAppPath(),'package.json'),'utf8')).heisenTestBuild===true;}catch{return false;}})();
if((!app.isPackaged||testBuild)&&process.env.HEISEN_TEST_BACKGROUND==='1')enableTestBackground();
// Heisen offers no device chooser; without this, requestDevice waits on the OS Bluetooth service and never settles.
app.commandLine.appendSwitch('disable-blink-features','WebBluetooth');
app.on('web-contents-created',(_event,wc)=>{
 wc.setWindowOpenHandler(()=>({action:'deny'}));
 wc.on('will-attach-webview',event=>event.preventDefault());
 wc.on('select-bluetooth-device',(event,_devices,callback)=>{event.preventDefault();callback('');});
 // The app UI uses the default session; web tabs and reader views use isolated
 // browser partitions and install their own navigation/open policies.
 if(wc.session===session.defaultSession){
  const uiURL=pathToFileURL(path.join(dist,'index.html')).href;
  wc.on('will-navigate',(event,url)=>{if(url!==uiURL)event.preventDefault();});
  wc.on('will-frame-navigate',event=>{if(!event.isMainFrame||event.url!==uiURL)event.preventDefault();});
  wc.on('will-redirect',event=>event.preventDefault());
 }
});
app.setName('Heisen');if(process.env.HEISEN_DATA_DIR)app.setPath('userData',path.resolve(process.env.HEISEN_DATA_DIR));else app.setPath('userData',path.join(app.getPath('appData'),'Heisen'));
// Isolated profiles (tests, HEISEN_DATA_DIR) must never touch the login keychain.
if(process.env.HEISEN_DATA_DIR)app.commandLine.appendSwitch('use-mock-keychain');
// After a crash soon after launch, AppKit's open-application handler shows a modal "reopen windows?" alert before 'ready',
// so an unattended launch never gets a window. Heisen restores its own tabs, not AppKit windows: isolated profiles skip that
// restoration (registration domain, this process only; must run before the app finishes launching).
if(process.env.HEISEN_DATA_DIR&&process.platform==='darwin')systemPreferences.registerDefaults({ApplePersistenceIgnoreState:true});
// Chrome 136 policy: remote debugging only with a non-default profile.
const debugRefused=app.isPackaged&&!process.env.HEISEN_DATA_DIR&&(app.commandLine.hasSwitch('remote-debugging-port')||app.commandLine.hasSwitch('remote-debugging-pipe'));
// With the MCP server on, keep rendering while the window is covered so agents can drive tabs; read before ready because switches apply only at startup.
if(readLaunch(app.getPath('userData')).agentApi)app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
// Keep Chromium's process isolation and background throttling defaults. Renderer
// limits and speculative disable-features switches trade away security/site compatibility.
const installing=squirrelStartup();
const single=!installing&&!debugRefused&&app.requestSingleInstanceLock();if(!single)app.quit();
let data:Data;let engine:HeisenEngine;let store:Store;let timer:NodeJS.Timeout;let agentApi:AgentApi;let control:Control;let beta:Beta;let sleeper:TabSleeper;
let safeBrowsing:SafeBrowsing;
let computer:ComputerUse;
let selectedTask='';let quitting=false;let pendingPublish:NodeJS.Timeout|undefined;
let tray:Electron.Tray|undefined;let trayCounts='';let backgroundReady=false;let cachedDefault=false;let checkingDefault=false;let defaultCheckedAt=0;
const trayActions={newWindow:()=>{void windows.create({url:HOME}).catch(e=>console.error('Window open failed',e));},show:()=>{void windows.open().catch(e=>console.error('Window open failed',e));},quit:()=>app.quit()};
function syncTray(){
 if(!backgroundReady||quitting)return;
 if(!data.state.settings.background){tray?.destroy();tray=undefined;trayCounts='';return;}
 if(!tray)tray=installTray(trayActions);
 let tasks=0;for(const task of engine.tasks.values())if(task.status==='running'||task.status==='awaiting_approval')tasks++;
 const routines=data.state.routines.filter(r=>r.enabled).length,key=tasks+':'+routines;
 if(key!==trayCounts){refreshTray(tray,trayActions,{tasks,routines});trayCounts=key;}
}
async function refreshDefault(){
 if(checkingDefault||quitting||Date.now()-defaultCheckedAt<30_000)return;checkingDefault=true;defaultCheckedAt=Date.now();
 try{const value=await isDefaultBrowser();if(value!==cachedDefault){cachedDefault=value;changed();}}catch(error){console.error('Default browser check failed',error);}finally{checkingDefault=false;}
}
const pendingUrls:string[]=[];let urlsReady=false;let openingUrls=false;
function queueUrl(value:string):boolean{
 if(value.length>4096||!/^https?:\/\//i.test(value))return false;
 try{const url=new URL(value);if(url.username||url.password)return false;pendingUrls.push(url.href);}catch{return false;}
 void drainUrls();return true;
}
async function drainUrls(){
 if(!urlsReady||openingUrls||quitting)return;openingUrls=true;
 try{while(pendingUrls.length&&!quitting){const url=pendingUrls.shift()!;try{await windows.open(url);}catch(error){console.error('URL open failed',error);}}}finally{openingUrls=false;}
}
app.on('open-url',(event,url)=>{event.preventDefault();queueUrl(url);});
for(const arg of process.argv.slice(1))queueUrl(arg);
function changed(){if(pendingPublish)return;pendingPublish=setTimeout(()=>{pendingPublish=undefined;syncTray();for(const b of windows?.all()??[])b.win.webContents.send('heisen:changed');},60);}
function toggleSidebar(){data.state.settings.sidebarCollapsed=!data.state.settings.sidebarCollapsed;for(const b of windows.all()){b.sidebar=data.state.settings.sidebarCollapsed?0:232;b.layout();}data.save();changed();}
function messageBox(options:Electron.MessageBoxOptions){const win=windows?.focusedWindow();return win?dialog.showMessageBox(win,options):dialog.showMessageBox(options);}
app.on('second-instance',(_event,argv)=>{let routed=false;for(const arg of argv.slice(1))routed=queueUrl(arg)||routed;if(!routed&&windows&&!quitting)void windows.open().catch(e=>console.error('Window open failed',e));});
app.on('activate',()=>{if(windows&&!quitting)void windows.open().catch(e=>console.error('Window open failed',e));});
app.on('window-all-closed',()=>{if(!data?.state.settings.background||quitting)app.quit();});
app.on('before-quit',event=>{if(quitting)return;quitting=true;tray?.destroy();tray=undefined;clearInterval(timer);computer?.stop('quit');safeBrowsing?.close();sleeper?.stop();control?.stop();agentApi?.stop();beta?.stop();if(engine)for(const t of engine.tasks.values())engine.cancel(t.id);if(data){event.preventDefault();void data.flush().catch(e=>console.error('Library save failed',e.message)).finally(()=>app.quit());}});
if(single)void app.whenReady().then(async()=>{
 session.defaultSession.setPermissionCheckHandler(()=>false);
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 session.defaultSession.setDevicePermissionHandler(()=>false);
 const userData=app.getPath('userData');const legacyRoot=(!app.isPackaged&&process.env.HEISEN_LEGACY_DIR)?path.resolve(process.env.HEISEN_LEGACY_DIR):(process.env.HEISEN_DATA_DIR?undefined:path.join(app.getPath('appData'),'Own'));
 if(legacyRoot&&needsMigration(userData,legacyRoot))await runMigration({legacyRoot,root:userData,readKeychain:keychainReader(process.env,app.isPackaged),confirmSecrets:isTestKeychain(process.env,app.isPackaged)?async()=>true:async()=>(await dialog.showMessageBox({type:'question',message:'Own에 저장된 비밀번호와 AI 계정 연결을 가져올까요?',detail:"키체인 창이 열리면 '허용'을 누르세요.",buttons:['가져오기','건너뛰기'],defaultId:0,cancelId:1})).response===0,encrypt:s=>safeStorage.encryptString(s),legacyRunning:()=>legacyRunning(legacyRoot),askLegacyRunning:async()=>(await dialog.showMessageBox({type:'warning',message:'Own을 종료한 뒤 계속하세요.',buttons:['다시 확인','옮기지 않음'],defaultId:0,cancelId:1})).response===1?'decline':'retry',askFailed:async message=>{console.error('Own migration failed',message);return (await dialog.showMessageBox({type:'error',message:'이전 데이터를 가져오지 못했습니다.',detail:message,buttons:['다시 시도','건너뛰기'],defaultId:0,cancelId:1})).response===1?'skip':'retry';}});
 const secrets=new Secrets(path.join(userData,'secrets.json'),safeStorage);data=await Data.open(userData,secrets);
 // While gated the tab view stays hidden (modal), so a 401 mid-session covers open tabs until sign-in succeeds.
 beta=new Beta(secrets,{...betaServer(process.env,app.isPackaged,testBuild),parent:()=>windows.focusedWindow()!,version:app.getVersion(),changed:()=>{for(const b of windows?.all()??[])if(!b.modal&&beta.info().status!=='active'){b.modal=true;b.layout();}changed();}});
 registerState('beta',()=>beta.info());
 fs.mkdirSync(path.join(data.root,'.runtime'),{recursive:true,mode:0o700});fs.copyFileSync(path.join(root,'runtime-images.json'),path.join(data.root,'runtime-images.json'));
 const docker=dockerCandidates().find(p=>fs.existsSync(p))||'docker';fs.writeFileSync(path.join(data.root,'.runtime/config.json'),JSON.stringify({docker}),{mode:0o600});
 const authTabs=new WeakMap<object,number>(),authOpening=new WeakMap<object,Promise<void>>();
 const openAuth=async(url:string)=>{const u=new URL(url);if(u.protocol!=='https:')throw new Error('인증 링크가 올바르지 않습니다.');const attempt=auth.attempt;if(attempt?.status!=='pending')return;const opening=authOpening.get(attempt);if(opening)return opening;const id=authTabs.get(attempt),owner=id===undefined?undefined:windows.byTab(id);if(owner&&id!==undefined){await owner.select(id);return;}
  const pending=(async()=>{const browser=windows.focused()??await windows.open();const tab=await browser.create(HOME);authTabs.set(attempt,tab.id);if(attempt.status!=='pending'){browser.close(tab.id);authTabs.delete(attempt);if(auth.attempt===attempt)browser.show('settings');return;}await browser.navigate(tab.id,url);})();authOpening.set(attempt,pending);try{await pending;}finally{authOpening.delete(attempt);}
 };
 store=new Store(path.join(data.root,'tasks.sqlite'),sealedCodec());
 registerAuditRpc({store,changed,registerRpc});
 const auth=new Auth(data,secrets,openAuth,()=>{const attempt=auth.attempt;if(attempt&&attempt.status!=='pending'){const id=authTabs.get(attempt);authTabs.delete(attempt);const browser=id===undefined?windows.focused():windows.byTab(id);if(id!==undefined&&browser?.tabs.has(id))browser.close(id);browser?.show('settings');}changed();},store);
 const uiURL=pathToFileURL(path.join(dist,'index.html')).href;
 safeBrowsing=new SafeBrowsing(path.join(data.root,'safebrowsing'),data);registerState('safeBrowsing',()=>safeBrowsing.status());
 const sessions=new Sessions(data,changed,safeBrowsing);
 const httpsFirst=new HttpsFirst(data);sessions.configureSessions(applyIdentity);
 sessions.configureSessions(ses=>{
  ses.setDevicePermissionHandler(()=>false);
  ses.on('select-hid-device',(event,_details,callback)=>{event.preventDefault();callback();});
  ses.on('select-usb-device',(event,_details,callback)=>{event.preventDefault();callback();});
  ses.on('select-serial-port',(event,_ports,_wc,callback)=>{event.preventDefault();callback('');});
 });
 setWindows(new Windows({data,changed,httpsFirst,sessions,uiURL,preload:path.join(dist,'preload.cjs'),beforeShow:configureWindow,quitting:()=>quitting}));installBrowserRpc(windows);
 // Epochs pin each task to its starting window, including tools invoked after awaits or focus changes.
 const taskWindows=new Map<string,Browser>();
 engine=new HeisenEngine(data.root,store,async(task:Task,method:string,args:any)=>{
  // Cancellation revokes epochs without reopening a window or retaining an owner.
  if(method==='epoch'&&!['running','awaiting_approval'].includes(task.status)){taskWindows.delete(task.id);for(const b of windows.all())if(b.epochs.has(task.id))await b.tool(task,method,args);return {ok:true};}
  let browser=taskWindows.get(task.id);
  if(browser?.win.isDestroyed()){taskWindows.delete(task.id);browser=undefined;}
  if(!browser){browser=windows.byTab(Number(args?.tabId))??(windows.all().length?windows.current():await windows.open(undefined,{inactive:true}));if(['running','awaiting_approval'].includes(task.status))taskWindows.set(task.id,browser);}
  if(browser.win.isDestroyed())throw new Error('탭을 찾을 수 없습니다.');
  return browser.tool(task,method,args);
 },changed,auth,data);
 engine.agentAllowed=url=>agentAllowed(data,url);
 app.on('certificate-error',(event,wc,url,error,cert,callback,isMainFrame)=>httpsFirst.certificateError(event,wc,url,error,cert,callback,isMainFrame));
 const memory=new MemoryStore(path.join(data.root,'memory'),{legacy:()=>data.state.memory,clearLegacy:()=>{data.state.memory=[];data.save();}});
 await memory.load();engine.memory=memory;
 const dreaming=new Dreaming(memory,data,(system,user,signal)=>complete(auth,data,{system,user,signal}),changed);
 async function reviewSkill(meta:SkillMeta){
  return (await messageBox({type:'question',message:`스킬 "${meta.name}"을(를) 사용할까요?`,detail:[meta.description,'도구: '+(meta.permissions.tools.join(', ')||'없음'),'사이트: '+(meta.permissions.sites.join(', ')||'없음'),'스크립트: '+(meta.permissions.scripts.join(', ')||'없음'),`파일 ${meta.files}개 · ${Math.ceil(meta.bytes/1024)} KB`,'출처: '+(meta.source.ref||meta.source.kind)].join('\n'),buttons:['취소','허용'],defaultId:0,cancelId:0})).response===1;
 }
 const skills=new SkillStore(path.join(data.root,'skills'),{review:reviewSkill,legacy:()=>data.state.skills,clearLegacy:()=>{data.state.skills=[];data.save();}});
 await skills.load();engine.skills=skills;
 computer=new ComputerUse({data,appRoot:app.getAppPath(),packaged:app.isPackaged,confirm:async(message,detail)=>(await messageBox({type:'question',message,detail,buttons:['취소','허용'],defaultId:0,cancelId:0})).response===1,changed,logDir:path.join(data.root,'computer')});
 engine.computer=computer;
 computer.onStop=(reason,taskId)=>{
  if(reason!=='task'){
   store.audit({actor:'task',taskId,tool:'computer_stop',summary:reason,state:reason==='crash'?'error':'ok'});
   for(const task of engine.tasks.values())engine.cancel(task.id);
  }
 };
 registerState('computer',()=>computer.status());
 async function attachments(prompt:string,input:{skillId?:string;memoryIds?:string[]}){
  const picked=[...new Set([...(input.skillId?[textArg(input.skillId,100)]:[]),...skills.pick(prompt).map(s=>s.id)])].slice(0,3);
  const attached=await skills.bodies(picked);
  return {attached,context:[...attached.map(s=>`## 스킬: ${s.name}\n${s.text}`),memory.contextFor(input.memoryIds||[])].filter(Boolean).join('\n\n')};
 }
 async function start(input:{prompt:string;urls?:string[];memoryIds?:string[];skillId?:string;demo?:boolean;mode?:string}){
  const owner=windows.all().length?windows.current():undefined;
  const prompt=textArg(input.prompt,12000),urls=(input.urls||[]).map((u:unknown)=>{originOf(u);return String(u);}),{attached,context}=await attachments(prompt,input);
  const task=await engine.start(prompt,urls,!!input.demo,{provider:data.state.settings.provider,model:data.state.settings.model,mode:input.mode==='deep'?'deep':'normal',context},async task=>{
   await skills.copyScripts(attached.map(s=>s.id),task.workspace);task.skills=attached.map(({id,name})=>({id,name}));
   if(owner)taskWindows.set(task.id,owner);
  });
  selectedTask=task.id;changed();return task;
 }
 async function continueTask(input:{id:string;prompt:string;urls?:string[];memoryIds?:string[];skillId?:string;mode?:string}){
  const id=textArg(input.id,100),prompt=textArg(input.prompt,12000),task=engine.get(id);
  if(['running','awaiting_approval'].includes(task.status))throw new Error('진행 중인 작업이 끝난 뒤 이어가세요.');
  const urls=(input.urls||[]).slice(0,12).map((u:unknown)=>{originOf(u);return String(u);}),{attached,context}=await attachments(prompt,input);
  await skills.copyScripts(attached.map(s=>s.id),task.workspace);
  const result=await engine.continueTask(id,prompt,{provider:data.state.settings.provider,model:data.state.settings.model,mode:input.mode==='deep'?'deep':'normal',context,urls});
  task.skills=attached.map(({id,name})=>({id,name}));engine.persist(task);return result;
 }
 const noTarget='연결된 대화가 없어 루틴을 일시 정지했습니다.';
 const routines=new Routines(data,async r=>{if(r.kind==='heartbeat'){if(!r.targetTask||!engine.tasks.has(r.targetTask)){r.enabled=false;throw new Error(noTarget);}return continueTask({...r,id:r.targetTask});}return start(r);},id=>['running','awaiting_approval'].includes(engine.tasks.get(id)?.status||''),changed);
 const cliBundle=bundledCliPath(app.getAppPath(),app.isPackaged);
 const updater=await Updater.register({changed,registerRpc,registerState});
 registerState('defaultBrowser',()=>cachedDefault);registerState('packaged',()=>app.isPackaged);
 registerState('platform',()=>process.platform);
 await refreshDefault();app.on('browser-window-focus',()=>{void refreshDefault();});
 function state(){const browser=windows.current();return {version:app.getVersion(),chromium:process.versions.chrome,tabs:browser.publicTabs(),active:browser.active,route:browser.route,bookmarks:data.state.bookmarks,history:data.state.history.slice(0,500),downloads:sessions.downloads,memory:memory.list().map(m=>({id:m.name,title:m.title,at:m.updatedAt,author:m.author,bytes:m.bytes})),dreams:dreaming.list(),skills:skills.list().map(s=>({id:s.id,title:s.name,description:s.description,enabled:s.enabled,approved:s.approved,source:s.source.kind,error:s.error})),routines:data.state.routines,settings:data.state.settings,providers:auth.list(),attempt:auth.attempt,tasks:[...engine.tasks.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(t=>({id:t.id,prompt:t.prompt,status:t.status,createdAt:t.createdAt,mode:t.mode})),task:selectedTask?engine.publicTask(engine.get(selectedTask)):null};}
 function clearHistory(){data.state.history=[];data.save();changed();}
 function savePrefs(input:unknown){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid preference');
  const settings=data.state.settings,patch:{sleep?:Partial<typeof settings.sleep>;energy?:Partial<typeof settings.energy>;privacy?:Partial<typeof settings.privacy>;reader?:Partial<typeof settings.reader>}={};
  const ranges:Record<string,readonly [number,number,boolean]>={afterMin:[0,1440,false],afterMinOnBattery:[0,1440,false],budgetMiB:[0,65536,true],leakFloorMiB:[1,65536,false],leakRateMiBPerMin:[1,100000,false],size:[14,32,true]};
  // Validate the whole request before applying any group (including reader).
  for(const [group,value] of Object.entries(input)){
   if(!['sleep','energy','privacy','reader'].includes(group)||!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid preference');
   const key=group as keyof typeof patch,allowed=settings[key],picked:Record<string,unknown>={};
   for(const [name,v] of Object.entries(value)){
    if(!Object.hasOwn(allowed,name))throw new Error('Invalid preference');
    const original=allowed[name as keyof typeof allowed],range=ranges[name];
    if(typeof original==='boolean'){if(typeof v!=='boolean')throw new Error('Invalid preference');}
    else if(range){if(typeof v!=='number'||!Number.isFinite(v)||v<range[0]||v>range[1]||range[2]&&!Number.isInteger(v))throw new Error('Invalid preference');}
    else if(name==='thirdPartyCookies'){if(v!=='block'&&v!=='allow')throw new Error('Invalid preference');}
    else if(name==='theme'){if(v!=='auto'&&v!=='light'&&v!=='sepia'&&v!=='dark')throw new Error('Invalid preference');}
    else throw new Error('Invalid preference');
    picked[name]=v;
   }
   // Each property's type/range was checked against its group above.
   patch[key]=picked;
  }
  if(patch.sleep)Object.assign(settings.sleep,patch.sleep);
  if(patch.energy)Object.assign(settings.energy,patch.energy);
  if(patch.privacy)Object.assign(settings.privacy,patch.privacy);
  if(patch.reader){const current=windows.current();current.reader.set(patch.reader);for(const b of windows.all())if(b!==current)b.reader.refresh();}
  data.save();windows.focused()?.shield?.refresh();changed();
 }
 registerRpc({
  'state':()=>({...state(),...collectState()}),
  'about.licenses':async()=>{const error=await shell.openPath(path.join(app.isPackaged?process.resourcesPath:app.getAppPath(),app.isPackaged?'THIRD_PARTY_NOTICES.txt':'THIRD_PARTY_NOTICES.md'));if(error)throw new Error('라이선스 파일을 열 수 없습니다. '+error);return true;},
  'computer.status':()=>computer.status(),
  'computer.toggle':async a=>{await computer.setEnabled(a.enabled===true);return computer.status();},
  'computer.apps':()=>computer.runningApps(),
  'computer.allow':async a=>{await computer.allow(textArg(a.app,200));return computer.status();},
  'computer.disallow':a=>{computer.disallow(textArg(a.app,200));return computer.status();},
  'computer.permissions':()=>computer.permissions(),
  'computer.requestPermission':async a=>{await computer.requestPermission(a.kind);return computer.status();},
  'computer.openPermission':async a=>{
   if(a.kind!=='screen'&&a.kind!=='accessibility')throw new Error('권한 종류가 올바르지 않습니다.');
   if(process.platform==='darwin')await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?'+(a.kind==='screen'?'Privacy_ScreenCapture':'Privacy_Accessibility'));
   else if(process.platform==='win32')await shell.openExternal('ms-settings:privacy');
   else throw new Error('지원하지 않는 플랫폼입니다.');
   return true;
  },
  'computer.stop':()=>{computer.stop('user');return computer.status();},
  'sidebar.toggle':()=>{toggleSidebar();return true;},
  // The beta gate keeps the tab view hidden whatever the renderer asks for.
  'layout':a=>{const browser=windows.current();browser.sidebar=data.state.settings.sidebarCollapsed?0:232;browser.panel=Math.max(0,Math.min(520,Number(a.panel)||0));browser.modal=!!a.modal||beta.info().status!=='active';browser.layout();return true;},
  'route':a=>{if(!['home','page','chat','chats','routines','history','bookmarks','downloads','memory','skills','vault','settings','activity'].includes(a.route))throw new Error('Invalid route');windows.current().show(a.route);return true;},
  // Typed input keeps the original HTTP URL for the HTTPS-First interstitial; invalid input fails before a tab opens.
  'window.new':async a=>(await windows.create({url:a.url?textArg(a.url,4096):HOME})).win.id,
  'tab.new':async a=>{const browser=windows.current(),incognito=a.incognito===true;if(!a.url)return (await browser.create(HOME,true,undefined,false,undefined,undefined,incognito)).id;const input=textArg(a.url,4096),url=address(input);if(a.background===true)return (await browser.create(url,false,undefined,false,undefined,undefined,incognito)).id;const tab=await browser.create(HOME,true,undefined,false,undefined,undefined,incognito);await browser.navigate(tab.id,input);return tab.id;},
  'tab.select':async a=>{await windows.current().select(Number(a.id));return true;},
  'tab.close':a=>{windows.current().close(Number(a.id));return true;},
  'tab.navigate':async a=>{const browser=windows.current();await browser.navigate(browser.active,textArg(a.url,4096));return true;},
  'tab.command':async a=>{if(!['back','forward','reload','stop','pin','bookmark'].includes(a.name))throw new Error('Invalid command');const browser=windows.current();await browser.command(a.name,a.id===undefined?browser.active:Number(a.id));return true;},
  'task.start':a=>start(a),
  'task.continue':a=>continueTask(a),
  'task.select':a=>{const id=textArg(a.id,100);engine.get(id);selectedTask=id;changed();return true;},
  'task.cancel':a=>{engine.cancel(textArg(a.id,100));return true;},
  'task.delete':async a=>{
   const id=textArg(a.id,100);engine.get(id);
   if((await messageBox({type:'question',message:'이 대화를 삭제할까요?',buttons:['삭제','취소'],defaultId:1,cancelId:1})).response!==0)return false;
   const task=engine.delete(id);taskWindows.delete(id);if(selectedTask===task.id)selectedTask='';
   for(const browser of windows.all()){browser.epochs.delete(task.id);for(const t of [...browser.tabs.values()])if(t.taskId===task.id&&browser.tabs.has(t.id))browser.close(t.id);}
   let paused=false;for(const r of data.state.routines)if(r.kind==='heartbeat'&&r.targetTask===task.id&&r.enabled){r.enabled=false;r.lastError=noTarget;paused=true;}
   if(paused)data.save();changed();
   const workspaces=path.join(userData,'.workspace'),dir=path.resolve(task.workspace);
   if(dir.startsWith(workspaces+path.sep)&&fs.existsSync(dir))await shell.trashItem(dir).catch(()=>{throw new Error('작업 폴더를 휴지통으로 옮기지 못했습니다.');});
   return true;
  },
  'task.resume':a=>engine.resume(textArg(a.id,100)),
  'task.approve':a=>{engine.approve(textArg(a.id,100),textArg(a.approvalId,100),a.approved===true);return true;},
  'artifact.read':a=>readFile(engine.get(textArg(a.id,100)).workspace,textArg(a.path,500)),
  'artifact.reveal':async a=>{const file=await safePath(engine.get(textArg(a.id,100)).workspace,textArg(a.path,500));shell.showItemInFolder(file);return true;},
  'workspace.reveal':a=>{shell.showItemInFolder(engine.get(textArg(a.id,100)).workspace);return true;},
  'settings.save':a=>{if(!providers.some(p=>p.id===a.provider))throw new Error('Invalid provider');data.state.settings.provider=a.provider;data.state.settings.model=textArg(a.model||'',200);data.save();changed();return true;},
  'prefs.save':a=>{savePrefs(a);return true;},
  'settings.security':a=>{const patch=securityPatch(a);Object.assign(data.state.settings,patch);data.save();changed();return true;},
  'background.toggle':a=>{if(typeof a.enabled!=='boolean')throw new Error('Invalid preference');data.state.settings.background=a.enabled;data.save();syncTray();changed();if(!a.enabled&&!windows.all().length)app.quit();return true;},
  'defaultBrowser.set':async()=>{const result=await registerDefaultBrowser();data.state.settings.defaultBrowserAsked=true;data.save();defaultCheckedAt=0;await refreshDefault();changed();return result;},
  'auth.begin':a=>auth.begin(textArg(a.provider,50)),
  'auth.cancel':()=>{auth.cancel();return true;},
  'auth.answer':a=>{auth.answer(textArg(a.id,100),textArg(a.text,10000));return true;},
  'auth.save':a=>{auth.save(textArg(a.provider,50),textArg(a.key||'',10000),a.baseURL?textArg(a.baseURL,4096):undefined);return true;},
  'auth.disconnect':async a=>{await auth.disconnect(textArg(a.provider,50));return true;},
  'auth.models':a=>auth.models(textArg(a.provider,50)),
  'auth.open':async()=>{if(auth.attempt?.status==='pending'&&auth.attempt.url)await openAuth(auth.attempt.url);return true;},
  'routine.save':a=>routines.save(a),
  'routine.run':async a=>{await routines.run(textArg(a.id,100));return true;},
  'routine.toggle':a=>{const r=data.state.routines.find(r=>r.id===a.id);if(r)r.enabled=!r.enabled;data.save();changed();return true;},
  'routine.delete':a=>{data.state.routines=data.state.routines.filter(r=>r.id!==a.id);data.save();changed();return true;},
  'memory.list':()=>memory.list(),
  'memory.read':a=>memory.read(textArg(a.name,80)),
  'memory.write':async a=>{const revision=await memory.write(textArg(a.name,80),textArg(a.text,60000),{author:'user'});changed();return revision;},
  'memory.capture':async()=>{const browser=windows.current(),t=browser.get(browser.active);if(t.incognito)throw new Error('시크릿 탭은 저장할 수 없습니다.');const snap=await browser.observe(t.id);const revision=await memory.write(slug(snap.title),'# '+snap.title+'\n\n'+snap.url+'\n\n'+snap.text,{author:'user'});changed();return revision;},
  'memory.delete':async a=>{const revision=await memory.delete(textArg(a.name,80),{author:'user'});changed();return revision;},
  'memory.search':a=>memory.search(textArg(a.query,1000)),
  'memory.history':a=>memory.history(a.name===undefined?undefined:textArg(a.name,80)),
  'memory.revert':async a=>{const revision=await memory.revert(textArg(a.id,40));changed();return revision;},
  'memory.dreams':()=>dreaming.list(),
  'memory.dream':()=>dreaming.run('manual'),
  'memory.settings':a=>{const cron=textArg(a.cron,200),zone=textArg(a.zone,100),next=nextRun(cron,zone);Object.assign(data.state.settings.dreaming,{enabled:a.enabled===true,cron,zone,next});data.save();changed();return true;},
  'skills.list':()=>skills.list(),
  'skills.install':async a=>{try{return await skills.install(textArg(a.source,4096));}finally{changed();}},
  'skills.create':async a=>{const skill=await skills.create({name:textArg(a.name,80),description:textArg(a.description,500),body:textArg(a.body,10000)});changed();return skill;},
  'skills.remove':async a=>{await skills.remove(textArg(a.id,100));changed();return true;},
  'skills.enable':async a=>{try{return await skills.setEnabled(textArg(a.id,100),a.enabled===true);}finally{changed();}},
  'skills.body':a=>skills.body(textArg(a.id,100)),
  'skills.pickFolder':async()=>{const result=await dialog.showOpenDialog(windows.current().win,{properties:['openDirectory']});return result.canceled?null:result.filePaths[0];},
  'bookmark.delete':a=>{data.state.bookmarks=data.state.bookmarks.filter(b=>b.id!==a.id);data.save();changed();return true;},
  'history.clear':()=>{clearHistory();return true;},
  'browsing.clear':async a=>{
   const since=browsingSince(a.range);
   // Electron has no time-range storage/cache API. Scope site data to origins
   // visited in the range, before removing that history; HTTP cache is global.
   if(a.cookies===true){
    if(!since)await sessions.session.clearStorageData();
    else{
     const origins=[...new Set(data.state.history.filter(h=>h.at>=since).flatMap(h=>{try{return [originOf(h.url)];}catch{return [];}}))];
     if(origins.length){
      await sessions.session.clearData({dataTypes:['cookies','localStorage','indexedDB','serviceWorkers','fileSystems','webSQL','backgroundFetch'],origins});
      await Promise.all(origins.map(origin=>sessions.session.clearStorageData({origin,storages:['cachestorage']})));
     }
    }
   }
   if(a.cache===true)await sessions.session.clearCache();
   if(a.history===true){data.state.history=since?data.state.history.filter(h=>h.at<since):[];sessions.downloads=since?sessions.downloads.filter(d=>d.at<since):[];data.save();changed();}
   return true;
  },
  'download.reveal':a=>{const d=sessions.downloads.find(d=>d.id===a.id);if(d?.state==='completed'&&d.path)shell.showItemInFolder(d.path);return true;},
  'mcp.enable':()=>agentApi.enable(),
  'mcp.disable':()=>{agentApi.disable();return true;},
  'mcp.rotate':()=>agentApi.rotate(),
  'mcp.copy':a=>{clipboard.writeText(agentApi.config(a.format));return true;},
  'cli.toggle':async a=>{data.state.settings.cli.socket=a.enabled===true;data.save();if(data.state.settings.cli.socket)await control.start();else control.stop();changed();return true;},
  'cli.pageScripts':a=>{data.state.settings.cli.pageScripts=a.enabled===true;data.save();changed();return true;},
  'agent.humanize':a=>{data.state.settings.agent={...data.state.settings.agent,humanize:a.enabled===true};data.save();changed();return true;},
  'cli.install':async a=>{const result=await installCli(cliBundle,{user:a.user===true});changed();return result;},
  'cli.uninstall':async()=>{const result=await uninstallCli(cliBundle);changed();return result;},
  'cli.copy':a=>{if(a.format!=='claude')throw new Error('Invalid CLI format');const quoted=process.platform==='win32'?'"'+cliBundle.replace(/"/g,'""')+'"':"'"+cliBundle.replace(/'/g,"'\\''")+"'";clipboard.writeText(`claude mcp add heisen -- node ${quoted} mcp`);return true;},
  'beta.signIn':async()=>{await beta.signIn();return true;},
  'beta.cancel':()=>{beta.cancel();return true;},
  'beta.redeem':async a=>{await beta.redeem(textArg(a.code,40));return true;},
  'beta.retry':async()=>{await beta.retry();return true;},
  'beta.signOut':async()=>{await beta.signOut();return true;}
 });
 installRpc(uiURL,m=>beta.allows(m),wc=>windows.all().find(b=>b.win.webContents===wc)?.win);
 const shortcut=(name:string)=>{const win=windows.focusedWindow();if(win){win.webContents.focus();win.webContents.send('heisen:shortcut',name);}};
 let initialized=false;let autofill:Autofill;let signup:Signup;let shield:Shield;
 function configureWindow(win:BrowserWindow){
  const browser=windows.of(win)!;browser.modal=beta.info().status!=='active';browser.taskBusy=id=>['running','awaiting_approval'].includes(engine.tasks.get(id)?.status||'');
  win.once('closed',()=>{for(const [id,owner] of taskWindows)if(owner===browser)taskWindows.delete(id);});
  if(initialized){autofill.attach(browser);browser.signup=signup.provider();shield.attachBrowser(browser);return;}
  initialized=true;
  new Permissions(windows,data,changed).install();
  sleeper=new TabSleeper(windows,data,changed);sleeper.install();
  shield=new Shield(windows,data,changed,path.join(app.getAppPath(),'dist','filters'));shield.rules.push(safeBrowsing.rule((wcId,url,list)=>{for(const b of windows.all())b.danger(wcId,url,list);},wcId=>windows.all().some(b=>b.canBypassDanger(wcId))),httpsFirst.rule());shield.install();shield.attachBrowser(browser);
  const appSupport=(!app.isPackaged&&process.env.HEISEN_IMPORT_ROOT)?path.resolve(process.env.HEISEN_IMPORT_ROOT):chromiumRoots().base;
  const passwords=new Passwords({data,secrets,session:sessions.session,get win(){return windows.current().win;},changed,appSupport,readKeychain:keychainReader(process.env,app.isPackaged),confirmKeychain:isTestKeychain(process.env,app.isPackaged)?async()=>true:async name=>(await messageBox({type:'question',message:`${name}에서 가져올까요?`,detail:"키체인 창이 열리면 '허용'을 누르세요.",buttons:['가져오기','취소'],defaultId:0,cancelId:1})).response===0});passwords.install();autofill=new Autofill({windows,passwords,data,changed});autofill.install();autofill.attach(browser);signup=new Signup({data,secrets,passwords,changed});signup.install();browser.signup=signup.provider();
  agentApi=new AgentApi(secrets,data,{windows,passwords,address,store,agentAllowed:url=>agentAllowed(data,url),startTask:(prompt,urls)=>start({prompt,urls}),listTasks:()=>[...engine.tasks.values()].map(t=>({id:t.id,prompt:t.prompt,status:t.status,result:t.result})),cancelTask:id=>engine.cancel(id),confirm:async(message,detail)=>(await messageBox({type:'question',message,detail,buttons:['취소','허용'],defaultId:0,cancelId:0})).response===1,version:app.getVersion()},changed);
  registerState('mcp',()=>agentApi.info());
  control=new Control({profile:data.root,version:app.getVersion(),chromium:process.versions.chrome,agentApi,browser:()=>windows.focused(),openWindow:()=>windows.open(),startTask:start,continueTask,engine,data,routines,memory,dreaming,skills,computer,changed});
  control.register('computer',{status:()=>computer.status()});
  engine.onPersist=task=>{if(!['running','awaiting_approval'].includes(task.status))taskWindows.delete(task.id);control.notify(task);};
  registerState('cli',()=>({...control.info(),installed:cliInstalled(cliBundle)}));
  installMenu({windows,data,changed,shortcut,newChat:()=>{selectedTask='';windows.focused()?.show('chat');},toggleSidebar});
 }
 // Deciding the gate before the UI loads means its first state read already shows the gate or the browser, never a spinner flash.
 beta.start();
 const first=await windows.create();if(quitting||first.win.isDestroyed())return;
 changed();
 // Tabs, routines and the MCP server start only once the beta gate unlocks (immediately with a valid session or HEISEN_BETA_URL=skip).
 await beta.ready();if(quitting)return;
 backgroundReady=true;syncTray();
 safeBrowsing.schedule();
 updater.schedule();
 timer=setInterval(()=>{void routines.tick();void dreaming.tick().catch(error=>console.error('Memory dreaming failed',error));},15000);
 // Restore puts saved tabs in place synchronously, then waits on the active page's load; the window is already visible.
 const restoring=first.win.isDestroyed()?Promise.resolve():first.restore();changed();void agentApi.restore();void control.start();
 void restoring.then(()=>{if(!quitting)changed();},e=>{if(!quitting)console.error('Tab restore failed',e);});
 urlsReady=true;void drainUrls();
}).catch(e=>{if(quitting)return;console.error(e);dialog.showErrorBox('Heisen을 시작할 수 없습니다.',String(e));app.quit();});
