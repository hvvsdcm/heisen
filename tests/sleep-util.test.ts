import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Data,Secrets} from '../src/data.ts';
import {testCipher} from './lib.ts';
import {openText} from '../src/sealed.ts';
import {sleepable,thresholds,dueToSleep,budgetKiB,pickForPressure,leaking,pushSample,type Candidate,type SleepSettings,type Sample} from '../src/sleep-util.ts';
const settings:SleepSettings={afterMin:30,afterMinOnBattery:10,budgetMiB:0,watchdog:true,leakFloorMiB:1024,leakRateMiBPerMin:50};
const candidate:Candidate={id:1,active:false,hiddenAt:0,loaded:true,loading:false,home:false,audible:false,captured:false,devtools:false,dirty:false,prompting:false,popupOpen:false,taskBusy:false,agentRecent:false,error:false};
const samples:Sample[]=Array.from({length:5},(_,i)=>({at:i*60_000,kiB:(824+i*50)*1024}));
test('sleep eligibility excludes every protected state but not an error page',()=>{
 assert.equal(sleepable(candidate),true);assert.equal(sleepable({...candidate,error:true}),true);
 for(const key of ['active','loading','home','audible','captured','devtools','dirty','prompting','popupOpen','taskBusy','agentRecent'] as const)assert.equal(sleepable({...candidate,[key]:true}),false,key);
 assert.equal(sleepable({...candidate,loaded:false}),false);
});
test('idle thresholds shorten on battery or serious heat only when the saver is enabled',()=>{
 for(const thermal of ['nominal','fair','serious','critical','unknown'] as const){
  assert.deepEqual(thresholds(settings,false,thermal,true),{afterMs:(thermal==='serious'||thermal==='critical'?10:30)*60_000});
  assert.deepEqual(thresholds(settings,true,thermal,true),{afterMs:10*60_000});
  for(const battery of [false,true])assert.deepEqual(thresholds(settings,battery,thermal,false),{afterMs:30*60_000});
 }
});
test('zero idle timeout stays disabled on battery and under thermal pressure',()=>{
 for(const battery of [false,true])for(const thermal of ['nominal','serious','critical'] as const)assert.deepEqual(thresholds({...settings,afterMin:0},battery,thermal,true),{afterMs:0});
 assert.deepEqual(thresholds({...settings,afterMinOnBattery:0},true,'nominal',true),{afterMs:0});
});
test('idle due time includes the deadline and requires a known hide time and eligibility',()=>{
 assert.equal(dueToSleep(candidate,59_999,60_000),false);assert.equal(dueToSleep(candidate,60_000,60_000),true);
 assert.equal(dueToSleep(candidate,60_001,60_000),true);assert.equal(dueToSleep(candidate,60_000,0),false);
 assert.equal(dueToSleep({...candidate,hiddenAt:undefined},60_000,60_000),false);
 assert.equal(dueToSleep({...candidate,hiddenAt:120_000},60_000,60_000),false);
 for(const key of ['active','loading','home','audible','captured','devtools','dirty','prompting','popupOpen','taskBusy','agentRecent'] as const)assert.equal(dueToSleep({...candidate,[key]:true},60_000,60_000),false,key);
 assert.equal(dueToSleep({...candidate,loaded:false},60_000,60_000),false);
});
test('memory budget converts MiB to KiB or uses a quarter of physical memory rounded down',()=>{
 assert.equal(budgetKiB(256,16*1024**3),256*1024);assert.equal(budgetKiB(0,16*1024**3),4*1024**2);
 assert.equal(budgetKiB(0,16_387),4);assert.equal(budgetKiB(0,0),0);
});
test('pressure picks eligible tabs oldest first and stops exactly at the target without mutation',()=>{
 const cands=[{...candidate,id:3,hiddenAt:300},{...candidate,id:1,hiddenAt:100},{...candidate,id:4,hiddenAt:0,active:true},{...candidate,id:2,hiddenAt:200}];
 const original=structuredClone(cands),usage=new Map([[1,100],[2,200],[3,300],[4,1000]]);
 assert.deepEqual(pickForPressure(cands,usage,300),[1,2]);assert.deepEqual(pickForPressure(cands,usage,301),[1,2,3]);assert.deepEqual(cands,original);
 assert.deepEqual([...usage],[[1,100],[2,200],[3,300],[4,1000]]);
});
test('pressure handles missing usage and hide time and insufficient reclaimable memory',()=>{
 const cands=[{...candidate,id:3,hiddenAt:undefined},{...candidate,id:2,hiddenAt:20},{...candidate,id:1,hiddenAt:0}];
 assert.deepEqual(pickForPressure(cands,new Map([[2,100],[3,200]]),100),[1,2]);
 assert.deepEqual(pickForPressure(cands,new Map([[2,100],[3,200]]),500),[1,2,3]);
 assert.deepEqual(pickForPressure(cands,new Map(),1),[1,2,3]);
});
test('pressure leaves all tabs alone when there is no excess or no eligible tab',()=>{
 assert.deepEqual(pickForPressure([candidate],new Map([[1,100]]),0),[]);assert.deepEqual(pickForPressure([candidate],new Map(),-1),[]);
 assert.deepEqual(pickForPressure([],new Map(),100),[]);assert.deepEqual(pickForPressure([{...candidate,dirty:true}],new Map([[1,100]]),1),[]);
});
test('leak detection includes the floor and rate boundary using elapsed minutes',()=>{
 assert.equal(leaking(samples,1024*1024,50*1024),true);
 assert.equal(leaking(samples,1024*1024+1,50*1024),false);assert.equal(leaking(samples,1024*1024,50*1024+1),false);
 assert.equal(leaking(samples.map(s=>({...s,at:s.at*2})),1024*1024,50*1024),false);
});
test('leak detection requires the entire window and strictly rising memory',()=>{
 assert.equal(leaking([],0,0),false);assert.equal(leaking(samples.slice(1),0,0),false);
 const flat=samples.map(s=>({...s}));flat[2].kiB=flat[1].kiB;assert.equal(leaking(flat,0,0),false);
 flat[2].kiB=flat[1].kiB-1;assert.equal(leaking(flat,0,0),false);
 const missing=samples.slice();delete missing[2];assert.equal(leaking(missing,0,0),false);
});
test('leak detection only considers the latest window and accepts a custom window',()=>{
 assert.equal(leaking([{at:-60_000,kiB:2*1024**2},...samples],1024*1024,50*1024),true);
 assert.equal(leaking(samples.slice(-3),1024*1024,50*1024,3),true);
 assert.equal(leaking(samples,0,0,6),false);assert.equal(leaking(samples,0,0,1),false);
});
test('leak samples require increasing timestamps rather than an infinite or reversed rate',()=>{
 assert.equal(leaking(samples.map(s=>({...s,at:0})),0,0),false);
 const reversed=samples.map(s=>({...s}));reversed[2].at=0;assert.equal(leaking(reversed,0,0),false);
});
test('sample retention keeps the newest six values without changing the input',()=>{
 const original=structuredClone(samples),last={at:300_000,kiB:1100*1024},next={at:360_000,kiB:1200*1024};
 const full=pushSample(samples,last);assert.deepEqual(full,[...samples,last]);assert.deepEqual(pushSample(full,next),[...samples.slice(1),last,next]);assert.deepEqual(samples,original);
 assert.deepEqual(pushSample(samples,last,3),[...samples.slice(-2),last]);assert.deepEqual(pushSample(samples,last,1),[last]);assert.deepEqual(pushSample(samples,last,0),[]);assert.deepEqual(pushSample([],last),[last]);
});
test('new and legacy profiles acquire all performance, privacy and reader defaults',async()=>{
 for(const saved of [undefined,{}, {settings:{theme:'light'},history:[{title:'kept',url:'https://example.test/',at:1}]}]){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'heisen-sleep-')),secrets=new Secrets(path.join(root,'secrets.json'),testCipher());let data:Data|undefined;
  try{
   if(saved)fs.writeFileSync(path.join(root,'library.json'),JSON.stringify(saved));data=await Data.open(root,secrets);
   assert.deepEqual(data.state.settings.sleep,settings);assert.deepEqual(data.state.settings.energy,{batterySaver:true,pauseHiddenVideo:true});
   assert.deepEqual(data.state.settings.privacy,{trackers:true,ads:false,thirdPartyCookies:'block',stripParams:true,clientHints:true});
   assert.deepEqual(data.state.settings.reader,{size:18,theme:'auto'});assert.deepEqual(data.state.privacy,{sites:{},grants:{}});
   if(saved&&'history' in saved){assert.deepEqual(data.state.history,saved.history);assert.equal(data.state.settings.theme,'light');}
   await data.flush();const persisted=JSON.parse(openText(fs.readFileSync(path.join(root,'library.json')),'library.json'));assert.deepEqual(persisted.settings,data.state.settings);assert.deepEqual(persisted.privacy,data.state.privacy);
  }finally{await data?.flush();fs.rmSync(root,{recursive:true,force:true});}
 }
});
test('partial saved settings retain explicit false and zero values while filling missing defaults',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'heisen-sleep-')),secrets=new Secrets(path.join(root,'secrets.json'),testCipher());let data:Data|undefined;
 const privacy={sites:{'example.test':{protect:false}},grants:{'example.test|login.test':123456}};
 try{
  fs.writeFileSync(path.join(root,'library.json'),JSON.stringify({privacy,settings:{sleep:{afterMin:0,watchdog:false},energy:{batterySaver:false},privacy:{trackers:false,ads:true,stripParams:false,thirdPartyCookies:'allow'},reader:{theme:'sepia'}}}));data=await Data.open(root,secrets);
  assert.deepEqual(data.state.settings.sleep,{...settings,afterMin:0,watchdog:false});assert.deepEqual(data.state.settings.energy,{batterySaver:false,pauseHiddenVideo:true});
  assert.deepEqual(data.state.settings.privacy,{trackers:false,ads:true,thirdPartyCookies:'allow',stripParams:false,clientHints:true});assert.deepEqual(data.state.settings.reader,{size:18,theme:'sepia'});assert.deepEqual(data.state.privacy,privacy);
  await data.flush();const reopened=await Data.open(root,secrets);try{assert.deepEqual(reopened.state,data.state);}finally{await reopened.flush();}
 }finally{await data?.flush();fs.rmSync(root,{recursive:true,force:true});}
});
test('partial library privacy records receive the missing collection',async()=>{
 for(const privacy of [{sites:{'example.test':{protect:false}}},{grants:{'example.test|login.test':123456}}]){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'heisen-sleep-')),secrets=new Secrets(path.join(root,'secrets.json'),testCipher());let data:Data|undefined;
  try{fs.writeFileSync(path.join(root,'library.json'),JSON.stringify({privacy}));data=await Data.open(root,secrets);assert.deepEqual(data.state.privacy,{sites:{},grants:{},...privacy});}
  finally{await data?.flush();fs.rmSync(root,{recursive:true,force:true});}
 }
});
