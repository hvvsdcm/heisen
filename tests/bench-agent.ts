import {_electron as electron,type ElectronApplication,type Page} from 'playwright';
import {expect} from 'playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {parseArgs} from 'node:util';
import {ControlClient} from '../src/cli/client.ts';
import type {Json,ToolResult} from '../src/control-protocol.ts';

type Observation={tabId?:number;snapshot?:string;text?:string;elements?:{ref:string;tag:string;role:string;name:string}[];error?:string};
type ModelMessage={role:string;content:string;tool_call_id?:string};
type Step={name:string;ms:number|null;requestBytes:number;resultRequestBytes:number|null;observeChars:number|null};
type Task={id:string;status:string;events:{type:string;text:string}[]};
const {values}=parseArgs({options:{out:{type:'string'}},allowPositionals:false});
const root=path.resolve('.'),fixtureModel='heisen-test-model',title='Heisen benchmark fixture';
// Short paths also fit macOS's Unix socket path limit.
const temp=await fs.mkdtemp(path.join(process.platform==='darwin'?'/tmp':os.tmpdir(),'heisen-bench-')),profile=path.join(temp,'profile');
const env:Record<string,string>={...process.env as Record<string,string>,HEISEN_TEST_BACKGROUND:'1',HEISEN_DATA_DIR:profile,HEISEN_BETA_URL:'skip'};delete env.ELECTRON_RUN_AS_NODE;
const measurements:Record<string,number[]>={},steps:Step[]=[],fixtureErrors:string[]=[],observations:number[]=[];
let base='',app:ElectronApplication|undefined,page:Page,control:ControlClient|undefined,lastResponseAt=0;
const fixturePage=`<!doctype html><meta charset="utf-8"><title>${title}</title><h1>Browser fixture</h1><input aria-label="Entry"><button onclick="document.getElementById('result').textContent='Clicked '+(++window.count)+' '+document.querySelector('input').value">Increment</button><div id="result">Ready</div><nav>${Array.from({length:150},(_,i)=>`<a href="/page?link=${i}">Link ${i}</a>`).join(' ')}</nav><p>${'Local benchmark body text. '.repeat(424)}</p><script>window.count=0</script>`;
const server=http.createServer((req,res)=>{void (async()=>{
 const route=(req.url||'').split('?')[0];
 if(route==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:fixtureModel,name:'Local benchmark model'}]}));return;}
 if(route==='/v1/chat/completions'){
  let raw='';for await(const chunk of req)raw+=chunk;
  const receivedAt=performance.now(),requestBytes=Buffer.byteLength(raw);
  const input=JSON.parse(raw) as {messages:ModelMessage[]};
  const toolMessages=input.messages.filter(m=>m.role==='tool');
  // Read every result by its untrusted boundary. Actions may return either
  // {observeAgain:true} or a fresh snapshot; select the latest snapshot in both cases.
  const results=toolMessages.map(m=>{
   const wrapped=/^<<<UNTRUSTED id=([a-f0-9]{16}) source="[^"]+">>>\n([\s\S]*)\n<<<END \1>>>$/.exec(m.content);
   assert.ok(wrapped,'tool result must retain its untrusted boundary');
   const value=JSON.parse(wrapped[2]) as Observation;assert.equal(value.error,undefined,wrapped[2]);return {value,chars:wrapped[2].length};
  });
  const index=toolMessages.length;assert.equal(index,steps.length,'unexpected model retry or extra turn');
  if(index){
   const previous=steps[index-1];previous.ms=receivedAt-lastResponseAt;previous.resultRequestBytes=requestBytes;
   if(previous.name==='web_observe'){previous.observeChars=results.at(-1)!.chars;observations.push(previous.observeChars);}
  }
  const observation=results.findLast(r=>r.value.snapshot)?.value,tabId=results.find(r=>r.value.tabId)?.value.tabId;
  const ref=(tag:string)=>{const el=observation?.elements?.find(e=>e.tag===tag);assert.ok(el,`missing ${tag} in observation`);return el.ref;};
  const flow:(()=>[string,object])[]=[
   ()=>['web_open',{url:base+'/page?task=bench'}],
   ()=>['web_observe',{tabId}],
   ()=>['web_fill',{tabId,snapshot:observation!.snapshot,ref:ref('input'),text:'hello world'}],
   ()=>['web_observe',{tabId}],
   ()=>['web_click',{tabId,snapshot:observation!.snapshot,ref:ref('button')}],
   ()=>['web_observe',{tabId}],
   ()=>['web_click',{tabId,snapshot:observation!.snapshot,ref:ref('button')}],
   ()=>['web_observe',{tabId}],
   ()=>{assert.ok(observation?.text?.includes('Clicked 2 hello world'),'task must really fill and click twice');return ['file_write',{path:'result.md',content:'# Benchmark result\nClicked 2 hello world'}];},
   ()=>['task_finish',{summary:'Benchmark fill and two clicks completed.',artifactPaths:['result.md'],sourceIds:[]}],
  ];
  assert.ok(index<flow.length,'unexpected extra model turn');const [name,args]=flow[index]();
  steps.push({name,ms:null,requestBytes,resultRequestBytes:null,observeChars:null});
  res.setHeader('Content-Type','application/json');lastResponseAt=performance.now();
  res.end(JSON.stringify({id:'bench-fixture',object:'chat.completion',created:Math.floor(Date.now()/1000),model:fixtureModel,choices:[{index:0,message:{role:'assistant',content:null,tool_calls:[{id:'bench-call-'+index,type:'function',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));return;
 }
 if(route==='/page'){res.setHeader('Content-Type','text/html');res.end(fixturePage);return;}
 res.writeHead(404).end('Not found');
 })().catch(error=>{fixtureErrors.push(String(error));res.writeHead(500).end('Fixture failed');});});
const rpc=<T=unknown>(method:string,args:object={})=>page.evaluate(([method,args])=>{const ui=window as unknown as {heisen:{call(m:string,a:object):Promise<unknown>}};return ui.heisen.call(method,args);},[method,args] as const) as Promise<T>;
const median=(runs:number[])=>{assert.ok(runs.length);const sorted=[...runs].sort((a,b)=>a-b),i=Math.floor(sorted.length/2);return sorted.length%2?sorted[i]:(sorted[i-1]+sorted[i])/2;};
async function time<T>(name:string,run:()=>Promise<T>):Promise<T>{
 const start=performance.now(),result=await run(),ms=performance.now()-start;(measurements[name]??=[]).push(ms);console.log(`${name}[${measurements[name].length}]: ${ms.toFixed(2)} ms`);return result;
}
function text(result:ToolResult){const c=result.content.find(c=>c.type==='text');assert.ok(c&&c.type==='text','missing tool text');return c.text;}
function refOf(snapshot:string,role:string,name:string){const match=new RegExp(`^- (e\\d+) ${role} ${JSON.stringify(name)}`,'m').exec(snapshot);assert.ok(match,`missing ${role} ${name}`);return match[1];}
async function tool(name:string,args:Record<string,Json>={}){
 return time(name,async()=>{const result=await control!.call<ToolResult>('tools.call',{name,arguments:args});assert.ok(!result.isError,`${name}: ${JSON.stringify(result)}`);return result;});
}
async function cliSnapshot(tabId:number):Promise<void>{
 await time('cliOneShot',()=>new Promise<void>((resolve,reject)=>{
  const child=spawn(process.execPath,[path.join(root,'dist/cli.mjs'),'repl','-e',`console.log((await tabs.get(${tabId}).snapshot()).title)`],{cwd:root,env,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',timedOut=false;const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},60000);
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('close',code=>{clearTimeout(timer);try{assert.equal(timedOut,false,'CLI timed out');assert.equal(code,0,stderr);assert.equal(stdout.trim(),title);resolve();}catch(error){reject(error);}});
 }));
}
try{
 await fs.mkdir(profile);await fs.writeFile(path.join(profile,'library.json'),JSON.stringify({settings:{importOffered:true,onboarded:true}}));
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve();});});
 const address=server.address();assert.ok(address&&typeof address==='object');base='http://127.0.0.1:'+address.port;
 app=await electron.launch({args:[root],env,timeout:45000});
 page=await app.firstWindow({timeout:45000});page.setDefaultTimeout(15000);await page.getByRole('textbox',{name:'주소창'}).waitFor();
 await rpc('cli.toggle',{enabled:true});await expect.poll(async()=>(await rpc<{cli:{enabled:boolean}}>('state')).cli.enabled).toBe(true);
 control=await time('connect',()=>ControlClient.connect({profile,timeoutMs:60000}));
 const tools=await control.call<{tools:{name:string}[]}>('tools.list');
 const opened=JSON.parse(text(await tool('open_tab',{url:base+'/page',active:true}))) as {tabId:number};const tabId=opened.tabId;assert.ok(Number.isSafeInteger(tabId));
 let snapshot='';for(let i=0;i<3;i++)snapshot=text(await tool('snapshot',{tabId}));
 snapshot=text(await tool('type',{tabId,ref:refOf(snapshot,'textbox','Entry'),text:'hello world'}));assert.ok(snapshot.includes('value="hello world"'));
 const longText='abcdefghij'.repeat(10);snapshot=text(await tool('type',{tabId,ref:refOf(snapshot,'textbox','Entry'),text:longText}));assert.ok(snapshot.includes(`value="${longText}"`));
 for(let i=0;i<2;i++)snapshot=text(await tool('click',{tabId,ref:refOf(snapshot,'button','Increment')}));
 // Escape exercises key dispatch without re-activating the focused button.
 await tool('scroll',{tabId,direction:'down',amount:600});await tool('press_key',{tabId,key:'Escape'});
 const shot=await tool('screenshot',{tabId});assert.ok(shot.content.some(c=>c.type==='image'&&c.mimeType==='image/png'&&c.data.startsWith('iVBOR')));
 const markdown=text(await tool('page_markdown',{tabId}));assert.ok(markdown.includes('Clicked 2 '+longText));
 await tool('navigate',{tabId,url:base+'/page?navigated=1'});
 const hasWait=tools.tools.some(t=>t.name==='wait_for');if(hasWait)await tool('wait_for',{tabId,text:'Ready',load:true});else console.log('wait_for: null (tool not available)');
 for(let i=0;i<2;i++)await cliSnapshot(tabId);
 await rpc('auth.save',{provider:'local',baseURL:base+'/v1'});await rpc('settings.save',{provider:'local',model:fixtureModel});
 const taskStart=performance.now();
 const started=await control.call<Task>('tasks.start',{prompt:'Fill Entry with hello world, click Increment twice, verify the result and save result.md.',urls:[base+'/page?task=bench']});
 const completed=await control.call<Task>('tasks.wait',{id:started.id,timeoutMs:45000});const taskEnd=performance.now(),taskTotalMs=taskEnd-taskStart;
 assert.deepEqual(fixtureErrors,[]);assert.equal(completed.status,'completed',JSON.stringify(completed));assert.equal(steps.length,10);assert.equal(observations.length,4);
 steps.at(-1)!.ms=taskEnd-lastResponseAt;
 for(const [index,step] of steps.entries())console.log(`task ${index+1} ${step.name}: ${step.ms!.toFixed(2)} ms; request ${step.requestBytes} bytes; result request ${step.resultRequestBytes??'none'} bytes; observe ${step.observeChars??'none'} chars`);
 console.log(`taskTotal: ${taskTotalMs.toFixed(2)} ms`);
 const windows=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(w=>({opacity:w.getOpacity(),focusable:w.isFocusable()})));
 assert.ok(windows.every(w=>!w.focusable&&(process.platform==='linux'||w.opacity===0)),'benchmark windows must stay in background mode');
 const bodyTextChars=await app.evaluate(async({webContents},url)=>{const wc=webContents.getAllWebContents().find(w=>w.getURL()===url);if(!wc)throw new Error('Missing fixture tab');return wc.executeJavaScript('document.body.innerText.length') as Promise<number>;},base+'/page?task=bench');
 const result={type100Ms:measurements.type[1],clickMs:median(measurements.click),scrollMs:median(measurements.scroll),keyMs:median(measurements.press_key),taskTotalMs,observeChars:median(observations),cliOneShotMs:median(measurements.cliOneShot),detail:{measurements,waitForMs:hasWait?measurements.wait_for[0]:null,steps,background:true,fixture:{links:150,bodyTextChars},stepTiming:'Model response sent to next model request received; final step ends at tasks.wait resolution. Includes local transport, serialization and engine bookkeeping; requestBytes is the request that selected each step.'}};
 if(values.out){const output=path.resolve(values.out);await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify(result));
}finally{
 control?.close();
 try{if(app){const child=app.process(),forceClose=setTimeout(()=>child.kill('SIGKILL'),10000);try{await app.close();}finally{clearTimeout(forceClose);}}}
 finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await fs.rm(temp,{recursive:true,force:true});}
}
