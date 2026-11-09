import {app,powerMonitor} from 'electron';
import os from 'node:os';
import {HOME,type Browser,type Tab} from './browser.ts';
import type {Windows} from './windows.ts';
import type {Data} from './data.ts';
import {registerRpc} from './rpc.ts';
import {budgetKiB,dueToSleep,leaking,pickForPressure,pushSample,sleepable,thresholds,type Candidate,type Sample} from './sleep-util.ts';

// Chromium has no Electron memory-pressure event or memory-cache purge API. Budget
// all app processes, not system free memory (which is misleading on macOS).
export class TabSleeper {
 onBattery=false;thermal:'nominal'|'fair'|'serious'|'critical'|'unknown'='unknown';
 private timer?:NodeJS.Timeout;private ticking?:Promise<void>;private samples=new Map<number,Sample[]>();private pids=new Map<number,number>();
 private battery=()=>{this.onBattery=true;this.changed();};
 private ac=()=>{this.onBattery=false;this.changed();};
 private thermalChanged=(details:{state:TabSleeper['thermal']})=>{this.thermal=details.state;this.changed();};
 constructor(private windows:Windows,private data:Data,private changed:()=>void){}
 install(){
  if(this.timer)return;
  this.onBattery=powerMonitor.isOnBatteryPower();this.thermal=powerMonitor.getCurrentThermalState();
  powerMonitor.on('on-battery',this.battery);powerMonitor.on('on-ac',this.ac);powerMonitor.on('thermal-state-change',this.thermalChanged);
  this.timer=setInterval(()=>void this.tick().catch(e=>console.error('Tab sleep failed',e)),30_000);this.timer.unref();
  registerRpc({'tab.usage':a=>this.usage(Number(a.id)),'perf.tick':async()=>{await this.tick();return true;}});
 }
 stop(){clearInterval(this.timer);this.timer=undefined;powerMonitor.off('on-battery',this.battery);powerMonitor.off('on-ac',this.ac);powerMonitor.off('thermal-state-change',this.thermalChanged);this.samples.clear();this.pids.clear();}
 usage(id:number):{kiB:number|null;shared:number}{
  const wc=this.windows.byTab(id)?.tabs.get(id)?.view?.webContents;if(!wc||wc.isDestroyed())return {kiB:null,shared:0};
  const pid=wc.getOSProcessId();if(!pid)return {kiB:null,shared:0};let shared=0;
  for(const browser of this.windows.all())for(const tab of browser.tabs.values()){const other=tab.view?.webContents;if(other&&!other.isDestroyed()&&other.getOSProcessId()===pid)shared++;}
  return {kiB:app.getAppMetrics().find(m=>m.pid===pid)?.memory.workingSetSize??null,shared};
 }
 tick():Promise<void>{if(!this.ticking)this.ticking=this.sample().finally(()=>{this.ticking=undefined;});return this.ticking;}
 private async sample(){
  const metrics=app.getAppMetrics(),byPid=new Map(metrics.map(m=>[m.pid,m.memory.workingSetSize])),now=Date.now(),settings=this.data.state.settings;
  const {afterMs}=thresholds(settings.sleep,this.onBattery,this.thermal,settings.energy.batterySaver);
  const candidates:Candidate[]=[],usage=new Map<number,number>(),shares=new Map<number,number>();let slept=false;
  for(const browser of this.windows.all())for(const tab of browser.tabs.values()){const wc=tab.view?.webContents;if(wc&&!wc.isDestroyed()){const pid=wc.getOSProcessId();shares.set(pid,(shares.get(pid)??0)+1);}}
  for(const id of this.pids.keys())if(!this.windows.byTab(id)?.tabs.get(id)?.view){this.pids.delete(id);this.samples.delete(id);}
  for(const browser of this.windows.all())for(const tab of browser.tabs.values()){
   const c=this.candidate(browser,tab),wc=tab.view?.webContents;candidates.push(c);
   if(!wc||wc.isDestroyed())continue;
   const pid=wc.getOSProcessId(),kiB=byPid.get(pid);
   if(this.pids.get(tab.id)!==pid){this.samples.delete(tab.id);this.pids.set(tab.id,pid);}
   if(kiB!==undefined){
    // A shared renderer is one allocation, not one allocation per tab.
    usage.set(tab.id,kiB/(shares.get(pid)??1));
    if(settings.sleep.watchdog)this.samples.set(tab.id,pushSample(this.samples.get(tab.id)??[],{at:now,kiB}));else this.samples.delete(tab.id);
   }else this.samples.delete(tab.id);
   const reason=settings.sleep.watchdog&&sleepable(c)&&leaking(this.samples.get(tab.id)??[],settings.sleep.leakFloorMiB*1024,settings.sleep.leakRateMiBPerMin*1024)?'leak':dueToSleep(c,now,afterMs)?'idle':undefined;
   if(reason&&!browser.win.isDestroyed()&&await browser.sleep(tab.id,reason)){slept=true;c.loaded=false;this.samples.delete(tab.id);this.pids.delete(tab.id);}
  }
  // Refresh after idle/leak eviction: do not count already reclaimed memory twice.
  const total=(slept?app.getAppMetrics():metrics).reduce((sum,m)=>sum+m.memory.workingSetSize,0),excess=total-budgetKiB(settings.sleep.budgetMiB,os.totalmem());
  for(const id of pickForPressure(candidates,usage,excess))if(await this.windows.byTab(id)?.sleep(id,'pressure')){slept=true;this.samples.delete(id);this.pids.delete(id);}
  if(slept)this.changed();
 }
 private candidate(browser:Browser,tab:Tab):Candidate{
  const wc=tab.view?.webContents,loaded=!!wc&&!wc.isDestroyed();
  const c:Candidate={id:tab.id,active:browser.active===tab.id,hiddenAt:tab.hiddenAt,loaded,loading:!!tab.ready||tab.loading||!!(loaded&&wc.isLoading()),home:tab.url===HOME,audible:!!(loaded&&wc.isCurrentlyAudible()),captured:!!(loaded&&wc.isBeingCaptured()),devtools:!!(loaded&&wc.isDevToolsOpened()),dirty:false,prompting:!!(loaded&&browser.isPrompting(wc)),popupOpen:browser.hasPopupOf(tab.id),taskBusy:!!tab.taskId&&browser.taskBusy(tab.taskId),agentRecent:tab.agentAt!==undefined&&Date.now()-tab.agentAt<600_000,error:!!tab.error};
  // DOM dirtiness is probed only by Browser.sleep at the eviction decision.
  return c;
 }
}
