export type SleepSettings={afterMin:number;afterMinOnBattery:number;budgetMiB:number;watchdog:boolean;leakFloorMiB:number;leakRateMiBPerMin:number};
export type Candidate={id:number;active:boolean;hiddenAt:number|undefined;loaded:boolean;loading:boolean;home:boolean;audible:boolean;captured:boolean;devtools:boolean;dirty:boolean;prompting:boolean;popupOpen:boolean;taskBusy:boolean;agentRecent:boolean;error:boolean};
export type Sample={at:number;kiB:number};
export function sleepable(c:Candidate):boolean{return !c.active&&c.loaded&&!c.loading&&!c.home&&!c.audible&&!c.captured&&!c.devtools&&!c.dirty&&!c.prompting&&!c.popupOpen&&!c.taskBusy&&!c.agentRecent;}
export function thresholds(s:SleepSettings,onBattery:boolean,thermal:'nominal'|'fair'|'serious'|'critical'|'unknown',batterySaver:boolean):{afterMs:number}{
 // Disabling idle sleep also disables its battery/thermal shortcut, not pressure relief.
 if(s.afterMin===0)return {afterMs:0};
 return {afterMs:(batterySaver&&(onBattery||thermal==='serious'||thermal==='critical')?s.afterMinOnBattery:s.afterMin)*60_000};
}
export function dueToSleep(c:Candidate,now:number,afterMs:number):boolean{return sleepable(c)&&afterMs>0&&c.hiddenAt!==undefined&&now-c.hiddenAt>=afterMs;}
export function budgetKiB(budgetMiB:number,totalBytes:number):number{return budgetMiB>0?budgetMiB*1024:Math.floor(totalBytes/4/1024);}
export function pickForPressure(cands:Candidate[],usageKiB:Map<number,number>,excessKiB:number):number[]{
 const ids:number[]=[];if(excessKiB<=0)return ids;
 // Unknown hide times follow known ones; sorting never changes the caller's list.
 const ordered=cands.filter(sleepable).sort((a,b)=>(a.hiddenAt??Infinity)-(b.hiddenAt??Infinity));let freed=0;
 for(const c of ordered){ids.push(c.id);freed+=usageKiB.get(c.id)??0;if(freed>=excessKiB)break;}
 return ids;
}
export function leaking(samples:Sample[],floorKiB:number,rateKiBPerMin:number,window=5):boolean{
 if(window<2||!Number.isInteger(window)||samples.length<window)return false;
 const start=samples.length-window,first=samples[start],last=samples[samples.length-1];
 if(!first||!last||last.kiB<floorKiB)return false;
 for(let i=start+1;i<samples.length;i++){const prev=samples[i-1],next=samples[i];if(!prev||!next||!(next.kiB>prev.kiB)||!(next.at>prev.at))return false;}
 return (last.kiB-first.kiB)/((last.at-first.at)/60_000)>=rateKiBPerMin;
}
export function pushSample(samples:Sample[],s:Sample,keep=6):Sample[]{if(keep<=0)return [];const next=samples.slice(Math.max(0,samples.length-keep+1));next.push(s);return next;}
