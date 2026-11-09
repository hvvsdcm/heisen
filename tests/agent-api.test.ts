import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {AgentApi,MCP_TOOLS,RpcError,type AgentDeps} from '../src/agent-api.ts';
import {Data,Secrets} from '../src/data.ts';
import {Store,sealedCodec} from '../src/store.ts';
import {originOf} from '../src/protocol.ts';
import type {Browser} from '../src/browser.ts';
import type {Windows} from '../src/windows.ts';
import type {Passwords} from '../src/passwords.ts';
import type {ToolResult} from '../src/control-protocol.ts';
import {testCipher} from './lib.ts';

async function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'heisen-agent-api-'));
 const secrets=new Secrets(path.join(root,'secrets.json'),testCipher()),data=await Data.open(root,secrets),store=new Store(path.join(root,'tasks.sqlite'),sealedCodec());
 const calls:{id?:number;method:string;args?:unknown}[]=[],confirmations:{message:string;detail:string}[]=[];
 const state={allow:false,started:0,failure:'',confirm:undefined as undefined|((message:string,detail:string)=>Promise<boolean>)};
 const tabs=new Map([[1,{id:1,title:'Fixture',url:'https://example.test/',loading:false,incognito:false,taskId:undefined as string|undefined}],[2,{id:2,title:'Other',url:'https://other.test/',loading:false,incognito:false,taskId:undefined as string|undefined}]]);
 const browser={tabs,active:1,downloads:[],get(id:number){const tab=tabs.get(id);if(!tab)throw new Error('탭을 찾을 수 없습니다.');return tab;},masked<T>(_id:number,value:T){return value;},
  async openForAgent(url:string){calls.push({method:'open',args:{url}});const tab={...this.get(1),id:tabs.size+1,url};tabs.set(tab.id,tab);return tab;},
  async navigate(id:number,url:string){calls.push({id,method:'navigate',args:{url}});this.get(id).url=url;},
  async select(id:number){calls.push({id,method:'select'});},close(id:number){calls.push({id,method:'close'});tabs.delete(id);},
  async command(method:string,id:number){calls.push({id,method});},
  async agent(id:number,method:string,args:unknown={}){
   calls.push({id,method,args});if(state.failure)throw new Error(state.failure);
   const url=this.get(id).url;
   if(method==='signupInfo')return {origin:originOf(url),email:'user@example.test',existing:false};
   if(method==='signup')return {email:'user@example.test',filled:{email:true,password:true},attempt:1};
   if(method==='login')return {username:'user@example.test'};
   if(method==='screenshot')return 'sensitive-screenshot-data';
   return {title:'Fixture',url,elements:[],markdown:'sensitive-page-content'};
  }};
 const browsers=[browser as unknown as Browser];
 const windows={all:()=>browsers,byTab:(id:number)=>browsers.find(b=>b.tabs.has(id)),focused:()=>browsers.at(-1),open:async()=>{browsers.push(browser as unknown as Browser);return browsers.at(-1)!;},sessions:{downloads:[]}} as unknown as Windows;
 const deps:AgentDeps={windows,passwords:{matches:()=>[{username:'user@example.test'}]} as unknown as Passwords,address:s=>s.includes('://')?s:'https://'+s,
  startTask:async()=>{if(state.failure)throw new Error(state.failure);return {id:String(++state.started)};},listTasks:()=>[],cancelTask:()=>{},
  confirm:async(message,detail)=>{confirmations.push({message,detail});return state.confirm?state.confirm(message,detail):state.allow;},version:'test',store};
 const api=new AgentApi(secrets,data,deps,()=>{});
 return {api,data,store,deps,browsers,browser,tabs,calls,confirmations,state,root,async close(){api.stop();try{await data.flush();}finally{store.close();fs.rmSync(root,{recursive:true,force:true});}}};
}
function request(url:string,token:string,body:unknown){
 return new Promise<{status:number;json:any}>((resolve,reject)=>{
  const req=http.request(url,{agent:false,method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'}},res=>{
   let text='';res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode!,json:JSON.parse(text)}));
  });req.on('error',reject);req.end(typeof body==='string'?body:JSON.stringify(body));
 });
}
function errorText(result:ToolResult){assert.equal(result.isError,true);const content=result.content[0];assert.equal(content.type,'text');return content.type==='text'?content.text:'';}

test('MCP permits 120 tool calls per sliding minute, rejects 121 with -32000 and expires the window',async t=>{
 const f=await fixture();let now=Date.now();t.mock.method(Date,'now',()=>now);
 try{
  const info=await f.api.enable(),body={jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'list_tabs'}};
  for(let i=0;i<120;i++){const r=await request(info.url+'/mcp',info.token!,body);assert.equal(r.status,200);assert.ok(r.json.result);}
  const denied=await request(info.url+'/mcp',info.token!,body);assert.equal(denied.status,200);assert.equal(denied.json.error.code,-32000);
  assert.match(denied.json.error.message,/요청이 너무 많습니다/);
  assert.ok((await request(info.url+'/mcp',info.token!,{jsonrpc:'2.0',id:2,method:'tools/list'})).json.result);
  now+=59999;assert.equal((await request(info.url+'/mcp',info.token!,body)).json.error.code,-32000);
  now++;assert.ok((await request(info.url+'/mcp',info.token!,body)).json.result);
  assert.equal(f.store.audits().filter(row=>row.state==='denied').length,2);
 }finally{await f.close();}
});

test('invalid tool attempts consume the MCP limit while CLI retains its independent transport budget',async()=>{
 const f=await fixture();try{
  for(let i=0;i<120;i++)await assert.rejects(f.api.callTool('unknown',{},new Set()),e=>e instanceof RpcError&&e.code===-32602);
  await assert.rejects(f.api.callTool('list_tabs',{},new Set()),e=>e instanceof RpcError&&e.code===-32000);
  assert.equal((await f.api.callTool('list_tabs',{},new Set(),'cli')).isError,undefined);
  assert.equal(f.store.audits().filter(row=>row.actor==='cli').length,1);
 }finally{await f.close();}
});

test('three refusals suppress the fourth confirmation for ten minutes without suppressing read tools',async t=>{
 const f=await fixture();let now=Date.now();t.mock.method(Date,'now',()=>now);
 try{
  for(let i=0;i<4;i++)assert.match(errorText(await f.api.callTool('fill_login',{tabId:1},new Set())),/사용자가 거부했습니다/);
  assert.equal(f.confirmations.length,3);assert.ok(!f.calls.some(c=>c.method==='login'));
  assert.equal((await f.api.callTool('snapshot',{tabId:1},new Set())).isError,undefined);
  now+=599999;assert.match(errorText(await f.api.callTool('fill_signup',{tabId:1},new Set())),/거부/);assert.equal(f.confirmations.length,3);
  now++;f.state.allow=true;assert.equal((await f.api.callTool('fill_login',{tabId:1},new Set())).isError,undefined);assert.equal(f.confirmations.length,4);
  assert.equal(f.store.audits().filter(row=>row.state==='denied').length,5);
 }finally{await f.close();}
});

test('refusals older than ten minutes do not contribute to confirmation cooldown',async t=>{
 const f=await fixture();let now=Date.now();t.mock.method(Date,'now',()=>now);
 try{
  for(let i=0;i<2;i++)await f.api.callTool('fill_login',{tabId:1},new Set());
  now+=600000;
  for(let i=0;i<2;i++)await f.api.callTool('fill_login',{tabId:1},new Set());
  assert.equal(f.confirmations.length,4);
 }finally{await f.close();}
});

test('concurrent confirmations serialize and do not share approval across actions or sessions',async()=>{
 const f=await fixture();let active=0,maxActive=0;
 const pending:((allowed:boolean)=>void)[]=[];
 f.state.confirm=()=>new Promise(resolve=>{active++;maxActive=Math.max(maxActive,active);pending.push(allowed=>{active--;resolve(allowed);});});
 try{
  const firstApproved=new Set<string>(),secondApproved=new Set<string>();
  const first=f.api.callTool('fill_login',{tabId:1},firstApproved),second=f.api.callTool('fill_login',{tabId:2},secondApproved,'cli');
  await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(f.confirmations.length,1);pending.shift()!(true);
  assert.equal((await first).isError,undefined);
  await new Promise<void>(resolve=>setImmediate(resolve));assert.equal(f.confirmations.length,2);pending.shift()!(false);
  assert.match(errorText(await second),/거부/);assert.equal(maxActive,1);
  assert.deepEqual([...firstApproved],['https://example.test']);assert.equal(secondApproved.size,0);
  assert.deepEqual(f.calls.filter(c=>c.method==='login').map(c=>c.id),[1]);
 }finally{for(const resolve of pending)resolve(false);await f.close();}
});

test('queued confirmations stop prompting after the third refusal and recover after dialog errors',async()=>{
 const f=await fixture();try{
  const results=await Promise.all(Array.from({length:6},()=>f.api.callTool('fill_login',{tabId:1},new Set())));
  assert.equal(f.confirmations.length,3);assert.ok(results.every(r=>r.isError));
 }finally{await f.close();}
 const g=await fixture();try{
  g.state.confirm=async()=>{throw new Error('dialog unavailable');};
  assert.match(errorText(await g.api.callTool('fill_login',{tabId:1},new Set())),/dialog unavailable/);
  g.state.confirm=undefined;g.state.allow=true;
  assert.equal((await g.api.callTool('fill_login',{tabId:1},new Set())).isError,undefined);
 }finally{await g.close();}
});

test('every tab-bound tool checks site policy before browser actions, files or confirmations',async()=>{
 const f=await fixture();try{
  f.data.state.settings.agentSites={'https://example.test':'block'};
  const args={tabId:1,url:'https://other.test/',ref:'e1',text:'private input',key:'Enter',direction:'down',value:'value',path:'/nonexistent-file'};
  for(const tool of MCP_TOOLS.filter(tool=>'tabId' in tool.inputSchema.properties)){
   const input=Object.fromEntries(tool.inputSchema.required.map(key=>[key,args[key as keyof typeof args]]));
   const result=await f.api.callTool(tool.name,input,new Set());assert.match(errorText(result),/에이전트 조작을 차단/,tool.name);
  }
  assert.deepEqual(f.calls,[]);assert.deepEqual(f.confirmations,[]);
  assert.ok(f.store.audits().every(row=>row.state==='denied'&&row.actor==='mcp'));
  f.data.state.settings.agentSites['https://example.test']='allow';
  assert.equal((await f.api.callTool('snapshot',{tabId:1},new Set())).isError,undefined);
  f.tabs.get(1)!.url='heisen://newtab';assert.equal((await f.api.callTool('select_tab',{tabId:1},new Set())).isError,undefined);
 }finally{await f.close();}
});

test('open and navigate check normalized destinations and the shared CLI path enforces live policy',async()=>{
 const f=await fixture();try{
  f.data.state.settings.agentSites={'https://blocked.test':'block'};
  for(const name of ['open_tab','navigate'])assert.match(errorText(await f.api.callTool(name,{url:'blocked.test',...(name==='navigate'?{tabId:1}:{})},new Set())),/차단/);
  assert.deepEqual(f.calls,[]);assert.ok(f.store.audits().every(row=>row.origin==='https://blocked.test'));
  f.data.state.settings.agentSites['https://example.test']='block';
  assert.match(errorText(await f.api.callTool('close_tab',{tabId:1},new Set(),'cli')),/차단/);
  assert.equal(f.store.audits().find(row=>row.actor==='cli')?.state,'denied');
  f.data.state.settings.agentSites={};
  assert.equal((await f.api.callTool('navigate',{tabId:1,url:'https://other.test/'},new Set())).isError,undefined);
  assert.equal((await f.api.callTool('open_tab',{url:'https://other.test/'},new Set())).isError,undefined);
 }finally{await f.close();}
});

test('injected shared site policy is used and is rechecked after approval before filling',async()=>{
 const f=await fixture();let blocked=false;const checked:string[]=[];
 f.deps.agentAllowed=url=>{checked.push(url);if(blocked)throw new Error('policy blocked');};
 f.state.confirm=async()=>{blocked=true;return true;};
 try{
  assert.match(errorText(await f.api.callTool('fill_login',{tabId:1},new Set())),/policy blocked/);
  assert.ok(checked.length>=2);assert.ok(!f.calls.some(c=>c.method==='login'));
  assert.equal(f.store.audits()[0].state,'denied');
  f.tabs.get(1)!.url='heisen://newtab';assert.equal((await f.api.callTool('select_tab',{tabId:1},new Set())).isError,undefined);
 }finally{await f.close();}
});

test('uploads require separate confirmations, honor site changes during approval and audit no contents',async()=>{
 const f=await fixture(),file=path.join(f.root,'upload.txt');fs.writeFileSync(file,'private file contents');f.state.allow=true;
 try{
  for(let i=0;i<2;i++)assert.equal((await f.api.callTool('upload_file',{tabId:1,ref:'e1',path:file},new Set())).isError,undefined);
  assert.equal(f.confirmations.length,2);assert.equal(f.calls.filter(c=>c.method==='upload').length,2);
  f.state.confirm=async()=>{f.data.state.settings.agentSites['https://example.test']='block';return true;};
  assert.match(errorText(await f.api.callTool('upload_file',{tabId:1,ref:'e1',path:file},new Set())),/차단/);
  assert.equal(f.calls.filter(c=>c.method==='upload').length,2);assert.ok(!JSON.stringify(f.store.audits()).includes('private file contents'));
 }finally{await f.close();}
});

test('audits record successes, failures and refusals without typed text, screenshots or result bodies',async()=>{
 const f=await fixture();try{
  await f.api.callTool('type',{tabId:1,ref:'e1',text:'sensitive-typed-text'},new Set());
  await f.api.callTool('screenshot',{tabId:1},new Set());await f.api.callTool('page_markdown',{tabId:1},new Set());
  f.state.failure='sensitive-error-body';assert.equal((await f.api.callTool('snapshot',{tabId:1},new Set())).isError,true);f.state.failure='';
  await f.api.callTool('fill_login',{tabId:1},new Set());
  await assert.rejects(f.api.callTool('type',{tabId:1,ref:'e1',text:'sensitive-invalid-input',extra:true},new Set()),RpcError);
  const rows=f.store.audits(),serialized=JSON.stringify(rows);
  assert.equal(rows.length,6);assert.ok(rows.every(row=>row.actor==='mcp'));
  assert.deepEqual(rows.filter(row=>row.tool==='type'&&row.state==='ok').map(row=>[row.origin,JSON.parse(row.summary)]),[['https://example.test',{tabId:1,ref:'e1'}]]);
  assert.equal(rows.find(row=>row.tool==='snapshot')?.state,'error');assert.equal(rows.find(row=>row.tool==='fill_login')?.state,'denied');
  for(const value of ['sensitive-typed-text','sensitive-screenshot-data','sensitive-page-content','sensitive-error-body','sensitive-invalid-input'])assert.ok(!serialized.includes(value),value);
  await f.api.callTool('open_tab',{url:'https://example.test/'+'a'.repeat(1000)},new Set());
  assert.equal(f.store.audits().find(row=>row.tool==='open_tab')?.summary.length,500);
 }finally{await f.close();}
});

test('REST task starts have an independent ten-per-minute budget, expiry and sanitized audits',async t=>{
 const f=await fixture();let now=Date.now();t.mock.method(Date,'now',()=>now);
 try{
  const info=await f.api.enable(),url=info.url+'/tasks',body={prompt:'sensitive-task-prompt',urls:['https://example.test/']};
  for(let i=0;i<10;i++)assert.equal((await request(url,info.token!,body)).status,201);
  assert.equal((await request(url,info.token!,body)).status,429);assert.equal(f.state.started,10);
  assert.equal((await f.api.callTool('list_tabs',{},new Set())).isError,undefined);
  now+=60000;assert.equal((await request(url,info.token!,body)).status,201);
  const rows=f.store.audits().filter(row=>row.tool==='tasks.start');assert.equal(rows.length,12);
  assert.equal(rows.filter(row=>row.state==='ok').length,11);assert.equal(rows.filter(row=>row.state==='denied').length,1);
  assert.ok(rows.every(row=>row.actor==='mcp'));assert.ok(!JSON.stringify(rows).includes('sensitive-task-prompt'));
 }finally{await f.close();}
});

test('REST task validation, policy and execution failures are audited and malformed bodies consume quota',async()=>{
 const f=await fixture();try{
  const info=await f.api.enable(),url=info.url+'/tasks';
  for(const body of ['{broken','null',{urls:[]}])assert.equal((await request(url,info.token!,body)).status,400);
  f.data.state.settings.agentSites={'https://blocked.test':'block'};
  assert.equal((await request(url,info.token!,{prompt:'test',urls:['https://blocked.test/']})).status,400);
  f.state.failure='task failure';assert.equal((await request(url,info.token!,{prompt:'test',urls:[]})).status,400);
  f.state.failure='';for(let i=0;i<5;i++)assert.equal((await request(url,info.token!,{prompt:'test',urls:[]})).status,201);
  assert.equal((await request(url,info.token!,{prompt:'test',urls:[]})).status,429);
  const rows=f.store.audits();assert.equal(rows.length,11);assert.equal(rows.filter(row=>row.state==='error').length,4);
  assert.equal(rows.find(row=>row.origin==='https://blocked.test')?.state,'denied');assert.equal(f.state.started,5);
 }finally{await f.close();}
});

test('MCP resolves all windows and keeps the surviving owner after the first window closes',async()=>{
 const f=await fixture();try{
  const tabs=new Map([[10,{...f.tabs.get(1)!,id:10,title:'Second window'}]]);
  const second={...f.browser,tabs,active:10,get(id:number){const tab=tabs.get(id);if(!tab)throw new Error('탭을 찾을 수 없습니다.');return tab;}};
  f.browsers.push(second as unknown as Browser);
  const list=await f.api.callTool('list_tabs',{},new Set()),content=list.content[0];assert.equal(content.type,'text');if(content.type!=='text')throw new Error('Expected text');assert.deepEqual(JSON.parse(content.text).map((t:{tabId:number})=>t.tabId),[1,2,10]);
  assert.equal((await f.api.callTool('snapshot',{tabId:10},new Set())).isError,undefined);assert.equal(f.calls.at(-1)?.id,10);
  f.browsers.shift();
  assert.equal((await f.api.callTool('snapshot',{tabId:10},new Set())).isError,undefined);
  assert.match(errorText(await f.api.callTool('snapshot',{tabId:1},new Set())),/탭을 찾을 수 없습니다/);
  f.browsers.length=0;
  assert.equal((await f.api.callTool('list_downloads',{},new Set())).isError,undefined);
  assert.equal((await f.api.callTool('open_tab',{url:'https://example.test/new'},new Set())).isError,undefined);assert.equal(f.browsers.length,1);
 }finally{await f.close();}
});
