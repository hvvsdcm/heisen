import test from 'node:test';
import assert from 'node:assert/strict';
import {CONTROL_VERSION,MAX_LINE,METHODS,LineDecoder,encodeLine,rpcError} from '../src/control-protocol.ts';
import type {ToolResult} from '../src/control-protocol.ts';
import {MAX_FRAME} from '../src/protocol.ts';
import {AgentApi,RpcError} from '../src/agent-api.ts';
import type {AgentDeps} from '../src/agent-api.ts';
import type {Data,Secrets} from '../src/data.ts';
import type {Browser} from '../src/browser.ts';
import type {Passwords} from '../src/passwords.ts';

function decoder(){
 const decoder=new LineDecoder(),messages:object[]=[],errors:Error[]=[];
 decoder.on('message',value=>messages.push(value));decoder.on('error',error=>errors.push(error));
 return {decoder,messages,errors};
}
test('control protocol exposes the version, shared frame limit, methods and RPC errors',()=>{
 assert.equal(CONTROL_VERSION,1);assert.equal(MAX_LINE,MAX_FRAME);
 assert.equal(new Set(METHODS).size,METHODS.length);
 assert.ok(METHODS.includes('hello'));assert.ok(METHODS.includes('tools.call'));assert.ok(METHODS.includes('computer.status'));
 for(const code of [-32700,-32600,-32601,-32602,-32603,-32000,-32001,-32002])assert.deepEqual(rpcError(code,'failure'),{code,message:'failure'});
});
test('LineDecoder handles fragmented UTF-8 buffers, CRLF and coalesced frames',()=>{
 const f=decoder(),first={jsonrpc:'2.0',id:1,method:'안녕',params:{text:'line\nnext 😀'}};
 const bytes=Buffer.from(encodeLine(first).replace(/\n$/,'\r\n'));
 for(const byte of bytes)f.decoder.push(Buffer.from([byte]));
 f.decoder.push('{"second":true}\n{"third":');assert.deepEqual(f.messages,[first,{second:true}]);
 f.decoder.push('3}\r');f.decoder.push('\n');f.decoder.push(Buffer.alloc(0));
 assert.deepEqual(f.messages,[first,{second:true},{third:3}]);assert.deepEqual(f.errors,[]);
});
test('LineDecoder waits for a newline and accepts objects only',()=>{
 const f=decoder();f.decoder.push('{}');assert.deepEqual(f.messages,[]);f.decoder.push('\n');
 for(const value of [null,[],[{}],true,false,1,'text'])f.decoder.push(encodeLine(value));
 assert.deepEqual(f.messages,[{}]);assert.equal(f.errors.length,7);
 assert.ok(f.errors.every(e=>e.message==='Expected object'));
 f.decoder.push('{broken}\n\n{"ok":true}\n');
 assert.ok(f.errors[7] instanceof SyntaxError);assert.ok(f.errors[8] instanceof SyntaxError);
 assert.deepEqual(f.messages,[{},{ok:true}]);
});
test('LineDecoder accepts the exact byte limit including split CRLF',()=>{
 const f=decoder(),value={text:'x'.repeat(MAX_LINE-11)},line=encodeLine(value);
 assert.equal(Buffer.byteLength(line),MAX_LINE+1);
 f.decoder.push(line.slice(0,-1));f.decoder.push('\r');f.decoder.push('\n');
 assert.deepEqual(f.errors,[]);assert.deepEqual(f.messages,[value]);
});
test('LineDecoder rejects oversized complete and partial lines and clears buffered data',()=>{
 for(const complete of [false,true]){
  const f=decoder();f.decoder.push('{"text":"');
  f.decoder.push('x'.repeat(MAX_LINE)+(complete?'"}\n':''));
  assert.equal(f.errors.length,1);assert.equal(f.errors[0].message,'Line exceeds size limit');assert.deepEqual(f.messages,[]);
  f.decoder.push('{"ok":true}\n');assert.deepEqual(f.messages,[{ok:true}]);
 }
 const f=decoder();f.decoder.push('{"text":"'+'한'.repeat(Math.ceil(MAX_LINE/3)));
 assert.equal(f.errors[0].message,'Line exceeds size limit');
});
test('encodeLine uses UTF-8 byte limits, escapes embedded newlines and rejects non-JSON values',()=>{
 assert.equal(encodeLine({text:'a\nb'}),'{"text":"a\\nb"}\n');
 assert.throws(()=>encodeLine({text:'x'.repeat(MAX_LINE)}),/Line exceeds size limit/);
 assert.throws(()=>encodeLine({text:'한'.repeat(Math.ceil(MAX_LINE/3))}),/Line exceeds size limit/);
 for(const value of [undefined,()=>{},Symbol('test')])assert.throws(()=>encodeLine(value),/Expected JSON value/);
 assert.throws(()=>encodeLine(1n),TypeError);
});

function agentFixture(){
 const calls:{id:number;method:string;args:unknown}[]=[],confirmations:string[]=[];
 const state={allow:true,failure:undefined as string|undefined};
 const tabs=new Map([
  [1,{id:1,title:'Fixture',url:'https://example.test/',loading:false,incognito:false,taskId:undefined as string|undefined}],
  [2,{id:2,title:'Task',url:'https://task.test/',loading:false,incognito:false,taskId:'task'}],
  [3,{id:3,title:'Private',url:'https://private.test/',loading:false,incognito:true,taskId:undefined}],
 ]);
 const browser={tabs,active:1,downloads:[],get(id:number){const tab=tabs.get(id);if(!tab)throw new Error('탭을 찾을 수 없습니다.');return tab;},masked<T>(_id:number,value:T){return value;},async agent(id:number,method:string,args:unknown={}){
  calls.push({id,method,args});if(state.failure)throw new Error(state.failure);
  switch(method){
   case 'login':return {username:'user@example.test',password:'must-not-leak'};
   case 'signupInfo':return {origin:'https://example.test',email:'user@example.test',existing:false};
   case 'signup':return {email:'user@example.test',filled:{email:true,password:true},attempt:1,password:'must-not-leak'};
   case 'screenshot':return 'png-base64';
   default:return {title:'Fixture',url:'https://example.test/',elements:[]};
  }
 }};
 const windows={all:()=>[browser],byTab:(id:number)=>tabs.has(id)?browser:undefined,focused:()=>browser,sessions:{downloads:[]}} as unknown as AgentDeps['windows'];
 const deps:AgentDeps={windows,passwords:{matches:()=>[{username:'user@example.test'}]} as unknown as Passwords,address:s=>s,startTask:async()=>({id:'task'}),listTasks:()=>[],cancelTask:()=>{},confirm:async message=>{confirmations.push(message);return state.allow;},version:'test'};
 const data={state:{settings:{vault:true}}} as Data;
 const api=new AgentApi({} as Secrets,data,deps,()=>{});
 return {api,data,calls,confirmations,state};
}
function text(result:ToolResult){const content=result.content[0];assert.equal(content.type,'text');return content.type==='text'?content.text:'';}
test('callTool lists only user tabs without an HTTP server and preserves MCP results',async()=>{
 const {api}=agentFixture(),result=await api.callTool('list_tabs',undefined,new Set());
 assert.deepEqual(api.info(),{enabled:false,url:''});
 assert.deepEqual(JSON.parse(text(result)),[{tabId:1,title:'Fixture',url:'https://example.test/',active:true,loading:false}]);
 assert.deepEqual(await api.rpc({jsonrpc:'2.0',id:'tabs',method:'tools/call',params:{name:'list_tabs'}}),{jsonrpc:'2.0',id:'tabs',result});
 assert.deepEqual(await api.callTool('screenshot',{tabId:1},new Set()),{content:[{type:'image',data:'png-base64',mimeType:'image/png'}]});
});
test('callTool validates names and schemas before browser execution',async()=>{
 const {api,calls}=agentFixture();
 const cases:[string,unknown][]=[['unknown',{}],['list_tabs',null],['list_tabs',[]],['list_tabs',{extra:true}],['click',{tabId:1}],['click',{tabId:'1',ref:'e1'}],['click',{tabId:0,ref:'e1'}],['click',{tabId:1.5,ref:'e1'}],['type',{tabId:1,ref:'e1',text:'x'.repeat(10001)}],['press_key',{tabId:1,key:'F13'}],['open_tab',{url:'https://example.test',active:'yes'}]];
 for(const [name,args] of cases){
  await assert.rejects(api.callTool(name,args,new Set()),e=>e instanceof RpcError&&e.code===-32602);
  const response=await api.rpc({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}) as {error:{code:number}};
  assert.equal(response.error.code,-32602);
 }
 assert.deepEqual(calls,[]);
});
test('callTool wraps synchronous and asynchronous operation failures as bounded tool errors',async()=>{
 const f=agentFixture();
 for(const tabId of [2,3,99])assert.equal((await f.api.callTool('snapshot',{tabId},new Set())).isError,true);
 assert.deepEqual(f.calls,[]);
 f.state.failure='x'.repeat(2500);
 const result=await f.api.callTool('snapshot',{tabId:1},new Set());
 assert.equal(result.isError,true);assert.equal(text(result),'x'.repeat(2000));
 assert.deepEqual(await f.api.rpc({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'snapshot',arguments:{tabId:1}}}),{jsonrpc:'2.0',id:1,result});
});
test('login and signup approvals are caller-owned, isolated and never reveal passwords',async()=>{
 const f=agentFixture(),first=new Set<string>(),second=new Set<string>();
 for(const name of ['fill_login','fill_signup']){
  for(let i=0;i<2;i++){
   const result=await f.api.callTool(name,{tabId:1},first);
   assert.equal(result.isError,undefined);assert.ok(!JSON.stringify(result).includes('must-not-leak'));
  }
 }
 assert.equal(f.confirmations.length,2);assert.deepEqual([...first],['https://example.test','signup:https://example.test']);
 await f.api.callTool('fill_login',{tabId:1},second);assert.equal(f.confirmations.length,3);
 assert.deepEqual([...second],['https://example.test']);
 await f.api.rpc({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'fill_login',arguments:{tabId:1}}});
 assert.equal(f.confirmations.length,4);
 await f.api.rpc({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'fill_login',arguments:{tabId:1}}});
 assert.equal(f.confirmations.length,4);
 f.api.stop();
 await f.api.rpc({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'fill_login',arguments:{tabId:1}}});
 assert.equal(f.confirmations.length,5);assert.equal(first.size,2);assert.equal(second.size,1);
 assert.ok(f.calls.filter(c=>c.method==='login'||c.method==='signup').every(c=>JSON.stringify(c.args)==='{"origin":"https://example.test"}'));
});
test('denied approval and disabled vault do not fill credentials or cache approval',async()=>{
 const f=agentFixture(),approved=new Set<string>();f.state.allow=false;
 for(const name of ['fill_login','fill_signup']){
  const result=await f.api.callTool(name,{tabId:1},approved);assert.equal(result.isError,true);assert.match(text(result),/거부/);
 }
 assert.equal(approved.size,0);assert.ok(!f.calls.some(c=>c.method==='login'||c.method==='signup'));
 f.data.state.settings.vault=false;
 const result=await f.api.callTool('fill_login',{tabId:1},approved);
 assert.equal(result.isError,true);assert.match(text(result),/비밀번호 관리자가 꺼져 있습니다/);assert.equal(f.confirmations.length,2);
});
