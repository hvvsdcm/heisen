import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {transformSync} from 'esbuild';
import * as browserUtil from '../src/browser-util.ts';
import * as sleepUtil from '../src/sleep-util.ts';
import type {Browser as BrowserType,Tab} from '../src/browser.ts';
import type {Windows as WindowsType} from '../src/windows.ts';
import type {Data} from '../src/data.ts';
import type {Sessions} from '../src/sessions.ts';
import type {HttpsFirst} from '../src/https-first.ts';
import type {TabSleeper as SleeperType} from '../src/sleeper.ts';
import type {Task} from '../src/protocol.ts';
import type {Reader as ReaderType} from '../src/reader.ts';
import type {WebContentsView} from 'electron';
import {setImmediate as settle} from 'node:timers/promises';
const require=createRequire(import.meta.url);
// Exercise the actual classes with Electron's process/window boundary replaced.
// Like security-settings.test.ts, use the app's TS compiler without starting main.
function load<T>(file:string,deps:Record<string,unknown>):T{
 const code=transformSync(fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8'),{loader:'ts',format:'cjs',target:'es2022'}).code;
 const module={exports:{}};new Function('module','exports','require',code)(module,module.exports,(id:string)=>id.startsWith('node:')?require(id):deps[id]??{});return module.exports as T;
}
class FakeWindow extends EventEmitter{
 destroyed=false;shown=0;inactive=0;focused=0;
 webContents=Object.assign(new EventEmitter(),{setWindowOpenHandler(){},getURL:()=>''});
 static getFocusedWindow(){return null;}
 isDestroyed(){return this.destroyed;}async loadURL(){}show(){this.shown++;}showInactive(){this.inactive++;}focus(){this.focused++;}isMinimized(){return false;}restore(){}
 destroy(){this.destroyed=true;this.emit('closed');}
}
function fixture(){
 let registry:WindowsType;
 const reader=class{install(){}onViewDestroy(){}};
 const background=load('test-background.ts',{'electron':{}});
 const {Browser}=load('browser.ts',{'electron':{BrowserWindow:FakeWindow},'./test-background.ts':background,'./browser-util.ts':browserUtil,'./windows.ts':{get windows(){return registry;}},'./reader.ts':{Reader:reader},'./gestures.ts':{SwipeNavigator:class{install(){}}}}) as {Browser:typeof BrowserType};
 const ensureLoaded=Reflect.get(Browser.prototype,'ensureLoaded') as (this:BrowserType,tab:Tab)=>Promise<void>;
 // These are renderer effects, not session persistence behavior.
 Browser.prototype.layout=()=>{};
 Reflect.set(Browser.prototype,'ensureLoaded',async()=>{});
 Reflect.set(Browser.prototype,'pauseVideos',async()=>{});
 Reflect.set(Browser.prototype,'resumeVideos',async()=>{});
 const {Windows}=load<{Windows:typeof WindowsType}>('windows.ts',{'electron':{BaseWindow:FakeWindow,BrowserWindow:FakeWindow},'./test-background.ts':background,'./browser.ts':{Browser,HOME:browserUtil.HOME},'./platform-app.ts':{windowChrome:()=>({})},'./rpc.ts':{callerWindow:()=>undefined}});
 const data={state:{tabs:[] as {url:string;title:string;pinned:boolean}[],activeTab:0,settings:{sidebarCollapsed:false}},save(){}};
 const sessions={clearIncognito(){},privateSession(){}};let quitting=false;
 registry=new Windows({data:data as unknown as Data,sessions:sessions as unknown as Sessions,httpsFirst:{} as HttpsFirst,changed(){},beforeShow(){},uiURL:'file:///test',preload:'',quitting:()=>quitting});
 return {registry,data,Browser,ensureLoaded,quit:()=>{quitting=true;}};
}
test('zero-window reopen restores all saved tabs before any save; explicit URL is appended',async()=>{
 const f=fixture(),a=await f.registry.create({url:browserUtil.HOME});
 await a.create('https://one.test',false);await a.create('https://two.test',false);const saved=structuredClone(f.data.state.tabs);
 a.win.destroy();assert.deepEqual(f.data.state.tabs,saved);
 const b=await f.registry.open();assert.deepEqual([...b.tabs.values()].map(t=>t.url),saved.map(t=>t.url));assert.deepEqual(f.data.state.tabs,saved);
 b.win.destroy();const c=await f.registry.open('https://three.test');assert.equal(c.tabs.size,4);assert.equal(f.data.state.tabs.length,4);
});
test('closing one window immediately saves only surviving windows; late saves cannot erase last session',async()=>{
 const f=fixture(),a=await f.registry.create({url:'https://a.test'}),b=await f.registry.create({url:'https://b.test'});
 a.win.destroy();assert.deepEqual(f.data.state.tabs.map(t=>t.url),['https://b.test']);a.save();assert.equal(f.data.state.tabs.length,1);
 b.win.destroy();b.save();assert.deepEqual(f.data.state.tabs.map(t=>t.url),['https://b.test']);
});
test('quit does not shrink the saved aggregate as windows are destroyed',async()=>{
 const f=fixture(),a=await f.registry.create({url:'https://a.test'}),b=await f.registry.create({url:'https://b.test'});f.quit();a.win.destroy();b.win.destroy();assert.equal(f.data.state.tabs.length,2);
});
test('automation opens use showInactive, never show/focus',async()=>{
 const f=fixture(),a=await f.registry.open(undefined,{inactive:true}),win=a.win as unknown as FakeWindow;
 assert.equal(win.inactive,1);assert.equal(win.shown,0);assert.equal(win.focused,0);await f.registry.open(undefined,{inactive:true});assert.equal(win.inactive,2);assert.equal(win.focused,0);
 await f.registry.open();assert.equal(win.focused,1);
});
test('dirty probe fails closed on rejection and timeout, succeeds only on clean response',async()=>{
 const f=fixture(),b=await f.registry.create({url:browserUtil.HOME});
 const tab={view:{webContents:{isDestroyed:()=>false}}} as unknown as Parameters<BrowserType['formDirty']>[0];
 Reflect.set(b,'run',async()=>false);assert.equal(await b.formDirty(tab),false);
 Reflect.set(b,'run',async()=>{throw new Error('gone');});assert.equal(await b.formDirty(tab),true);
 Reflect.set(b,'run',()=>new Promise(()=>{}));assert.equal(await b.formDirty(tab),true);
});
test('disabled idle sleep and no pressure never probe hidden DOM; due eviction probes once',async()=>{
 let probes=0,evictions=0;const wc={isDestroyed:()=>false,getOSProcessId:()=>1,isLoading:()=>false,isCurrentlyAudible:()=>false,isBeingCaptured:()=>false,isDevToolsOpened:()=>false};
 const {TabSleeper}=load<{TabSleeper:typeof SleeperType}>('sleeper.ts',{'electron':{app:{getAppMetrics:()=>[{pid:1,memory:{workingSetSize:1024}}]}},'./browser.ts':{HOME:browserUtil.HOME},'./sleep-util.ts':sleepUtil});
 const tab={id:1,url:'https://hidden.test',hiddenAt:0,view:{webContents:wc}},browser={tabs:new Map([[1,tab]]),active:2,win:{isDestroyed:()=>false},isPrompting:()=>false,hasPopupOf:()=>false,formDirty:async()=>{probes++;return false;},async sleep(){evictions++;await this.formDirty();return true;}};
 const windows={all:()=>[browser],byTab:()=>browser},data={state:{settings:{sleep:{afterMin:0,afterMinOnBattery:0,budgetMiB:65536,watchdog:false},energy:{batterySaver:false}}}};
 const sleeper=new TabSleeper(windows as unknown as WindowsType,data as unknown as Data,()=>{});await sleeper.tick();assert.equal(probes,0);assert.equal(evictions,0);
 data.state.settings.sleep.afterMin=1;await sleeper.tick();assert.equal(evictions,1);assert.equal(probes,1);
});
test('sleep captures live scroll before closing and rechecks protection after the capture',async()=>{
 const f=fixture(),b=await f.registry.create({url:browserUtil.HOME}),tab=await b.create('https://hidden.test',false);
 const scroll={x:120,y:500,url:tab.url},entries=[{url:tab.url,title:'Hidden',pageState:'stale'}];let closed=0;
 const wc={isDestroyed:()=>false,isLoading:()=>false,isCurrentlyAudible:()=>false,isBeingCaptured:()=>false,isDevToolsOpened:()=>false,getURL:()=>tab.url,navigationHistory:{getAllEntries:()=>entries,getActiveIndex:()=>0},close(){closed++;}};
 const view={webContents:wc} as unknown as WebContentsView;tab.view=view;
 Reflect.set(b.win,'contentView',{removeChildView(){}});
 b.formDirty=async()=>false;
 Reflect.set(b,'run',async()=>{throw new Error('renderer unavailable');});
 assert.equal(await b.sleep(tab.id,'idle'),false);assert.equal(tab.view,view);assert.equal(closed,0);
 Reflect.set(b,'run',async()=>{b.active=tab.id;return scroll;});
 assert.equal(await b.sleep(tab.id,'idle'),false);assert.equal(tab.view,view);assert.equal(closed,0);
 b.active=0;Reflect.set(b,'run',async()=>({...scroll,url:'https://previous.test'}));
 assert.equal(await b.sleep(tab.id,'idle'),false);assert.equal(closed,0);
 Reflect.set(b,'run',async()=>scroll);
 assert.equal(await b.sleep(tab.id,'idle'),true);assert.equal(closed,1);assert.equal(tab.view,undefined);
 assert.deepEqual(tab.history,{entries,index:0,scroll});
});
test('wake applies the live scroll checkpoint after history load, only to the saved URL',async()=>{
 for(const redirected of [false,true]){
  const f=fixture(),b=await f.registry.create({url:browserUtil.HOME}),tab=await b.create('https://hidden.test',false);
  const scroll={x:120,y:500,url:tab.url},history={entries:[{url:tab.url,title:'Hidden',pageState:'stale'}],index:0,scroll};tab.history=history;
  let finish!:()=>void;const loading=new Promise<void>(resolve=>{finish=resolve;}),applied:unknown[]=[];
  const wc={isDestroyed:()=>false,navigationHistory:{async restore(saved:unknown){assert.equal(saved,history);await loading;}}};
  Reflect.set(b,'makeView',(t:typeof tab)=>{t.view={webContents:wc} as unknown as WebContentsView;});
  Reflect.set(b.sessions,'navDownloads',new Map());
  Reflect.set(b,'run',async(_wc:unknown,_world:number,fn:Function,arg:unknown)=>{
   new Function('location','scrollTo','arg',`return (${fn.toString()})(arg)`)({href:redirected?'https://redirected.test':scroll.url},(position:unknown)=>applied.push(position),arg);
  });
  const waking=f.ensureLoaded.call(b,tab);await settle();assert.deepEqual(applied,[]);
  finish();await waking;
  assert.deepEqual(applied,redirected?[]:[{left:120,top:500,behavior:'instant'}]);
  assert.equal(tab.history,undefined);assert.equal(tab.ready,undefined);
 }
});

const mainSource=fs.readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
function mainFunction<T>(start:string,end:string,name:string,deps:Record<string,unknown>):T{
 const from=mainSource.indexOf(start),to=mainSource.indexOf(end,from);assert.ok(from>=0&&to>from);
 const code=transformSync(mainSource.slice(from,to),{loader:'ts',target:'es2022'}).code;
 return new Function(...Object.keys(deps),code+';return '+name)(...Object.values(deps)) as T;
}
test('continued task epochs repin destroyed owners and cancellation never opens windows',async()=>{
 const f=fixture(),old=await f.registry.open(),live=await f.registry.create({url:browserUtil.HOME});
 const task={id:'task',epoch:2,status:'running'} as Task,taskWindows=new Map([[task.id,old]]);
 old.win.destroy();
 const from=mainSource.indexOf('async(task:Task,method:string,args:any)=>{'),to=mainSource.indexOf('},changed,auth,data);',from);
 assert.ok(from>=0&&to>from);
 const code=transformSync('const call='+mainSource.slice(from,to+1),{loader:'ts',target:'es2022'}).code;
 const call=new Function('windows','taskWindows',code+';return call')(f.registry,taskWindows) as (task:Task,method:string,args:object)=>Promise<unknown>;
 await call(task,'epoch',{});assert.equal(taskWindows.get(task.id),live);assert.equal(live.epochs.get(task.id),2);
 task.status='cancelled';task.epoch++;await call(task,'epoch',{});assert.equal(taskWindows.size,0);assert.equal(live.epochs.get(task.id),3);
 live.win.destroy();await call(task,'epoch',{});assert.equal(f.registry.all().length,0);assert.equal(taskWindows.size,0);
});
test('reader preference save restyles live reader views in every window',async()=>{
 const settings={reader:{theme:'light',size:18}},data={state:{settings},save(){}};
 const {Reader}=load<{Reader:typeof ReaderType}>('reader.ts',{'electron':{nativeTheme:{shouldUseDarkColors:false}}});
 const f=fixture(),current=await f.registry.open(),other=await f.registry.create({url:browserUtil.HOME});
 const rendered=[current,other].map(browser=>{
  const styles:string[]=[],backgrounds:string[]=[],view={setBackgroundColor:(color:string)=>backgrounds.push(color),webContents:{isDestroyed:()=>false,insertCSS:async(css:string)=>{styles.push(css);return String(styles.length);},removeInsertedCSS:async()=>{}}};
  browser.get(browser.active).reader=view as unknown as WebContentsView;
  browser.reader=new Reader(browser,data as unknown as Data,()=>{});return {styles,backgrounds};
 });
 const save=mainFunction<(patch:object)=>void>(' function savePrefs(',' registerRpc({','savePrefs',{data,windows:{current:()=>current,all:()=>[current,other],focused:()=>undefined},changed(){}});
 save({reader:{theme:'dark',size:24}});await settle();
 for(const {styles,backgrounds} of rendered){assert.equal(styles.length,1);assert.match(styles[0],/font-size:24px/);assert.match(styles[0],/--bg:#1c1c1e/);assert.deepEqual(backgrounds,['#1c1c1e']);}
});
test('default-browser focus checks are throttled, including a non-default result',async()=>{
 let checks=0;const code=transformSync(mainSource.slice(mainSource.indexOf('async function refreshDefault(){'),mainSource.indexOf('const pendingUrls:')),{loader:'ts',target:'es2022'}).code;
 const refresh=new Function('isDefaultBrowser','changed','let checkingDefault=false,quitting=false,cachedDefault=false,defaultCheckedAt=0;'+code+';return refreshDefault')(async()=>{checks++;return false;},()=>{}) as ()=>Promise<void>;
 await refresh();await refresh();await refresh();assert.equal(checks,1);
});

test('terminal task persistence releases window owners while live tasks remain pinned',async()=>{
 const f=fixture(),browser=await f.registry.open(),taskWindows=new Map<string,BrowserType>();let notifications=0;
 const from=mainSource.indexOf('engine.onPersist='),to=mainSource.indexOf('\n',from);assert.ok(from>=0&&to>from);
 const code=transformSync(mainSource.slice(from,to),{loader:'ts',target:'es2022'}).code;
 const engine:{onPersist?:(task:Task)=>void}={};
 new Function('engine','taskWindows','control',code)(engine,taskWindows,{notify:()=>{notifications++;}});
 for(const status of ['running','awaiting_approval','completed','failed','cancelled'] as const){
  const task={id:'task',status} as Task;taskWindows.set(task.id,browser);engine.onPersist!(task);
  assert.equal(taskWindows.has(task.id),status==='running'||status==='awaiting_approval');
 }
 assert.equal(notifications,5);
});
