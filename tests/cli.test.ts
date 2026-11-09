import test from 'node:test';
import type {TestContext} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {mkdtemp,mkdir,writeFile,readFile,stat,rm,chmod,symlink,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {PassThrough} from 'node:stream';
import {spawn} from 'node:child_process';
import {controlSocketPath} from '../src/platform.ts';
import {LineDecoder,encodeLine,type Json,type Request} from '../src/control-protocol.ts';
import {ControlClient,CliError} from '../src/cli/client.ts';
import {createReplRuntime,startInteractive} from '../src/cli/repl.ts';
import {serveMcp} from '../src/cli/mcp.ts';
import {createScriptContext,runScriptInWorker,type Features} from '../src/script-api.ts';

const snapshot='[title] Example\n[url] https://example.test/\n- e1 button "Go"';
const structuredSnapshot={snapshot:'s1',title:'Example',url:'https://example.test/',loading:false,elements:[{ref:'e2',role:'button',name:'Go back'},{ref:'e1',role:'button',name:'Go'}]};
const tools=[{name:'list_tabs',description:'Tabs',inputSchema:{type:'object',properties:{}}},{name:'click',description:'Click',inputSchema:{type:'object',properties:{tabId:{type:'integer'},ref:{type:'string'}},required:['tabId','ref']}}];
async function fakeServer(t:TestContext,pageScripts=false,structured=false){
 const profile=await mkdtemp(join(tmpdir(),'hcli-')),socket=controlSocketPath(profile),requests:Request[]=[];
 await mkdir(join(profile,'run'),{mode:0o700});await writeFile(join(profile,'run','heisen.token'),'test-token',{mode:0o600});
 const connections=new Set<net.Socket>();
 let active=1,nextTab=1;
 const tabs=[{tabId:1,active:true,title:'Example',url:'https://example.test/'}];
 const server=net.createServer(connection=>{
  connections.add(connection);connection.once('close',()=>connections.delete(connection));
  const decoder=new LineDecoder();connection.on('data',chunk=>decoder.push(chunk));decoder.on('error',()=>connection.destroy());
  decoder.on('message',value=>{
   const request=value as Request;requests.push(request);
   const params=request.params as Record<string,Json>;
   let result:unknown=true;
   const text=(value:unknown)=>({content:[{type:'text',text:typeof value==='string'?value:JSON.stringify(value)}]});
   if(request.method==='hello'){
    assert.equal(params.token,'test-token');
    result={protocol:1,app:{version:'0.5-test',chromium:'156'},profile,pageScripts,computer:false};
   }else if(request.method==='tools.list')result={tools};
   else if(request.method==='tools.call'){
    const args=params.arguments as Record<string,Json>;
    switch(params.name){
     case 'list_tabs':result=text(tabs.map(tab=>({...tab,active:tab.tabId===active})));break;
     case 'open_tab':{
      const id=++nextTab;tabs.push({tabId:id,active:false,title:'New',url:String(args.url)});if(args.active)active=id;result=text({tabId:id});break;
     }
     case 'select_tab':active=Number(args.tabId);result=text({ok:true});break;
     case 'close_tab':tabs.splice(tabs.findIndex(tab=>tab.tabId===args.tabId),1);if(active===args.tabId)active=tabs[0]?.tabId;result=text({ok:true});break;
     case 'screenshot':result={content:[{type:'image',mimeType:'image/png',data:Buffer.from([137,80,78,71]).toString('base64')}]};break;
     case 'page_markdown':result=text('[title] Example\n[url] https://example.test/\n\n# Markdown');break;
     default:result=args.ref==='denied'?{...text('User denied'),isError:true}:{...text(snapshot),...structured?{structuredContent:structuredSnapshot}:{}};
    }
   }else if(request.method==='page.evaluate')result={value:42};
   else if(request.method==='tasks.start')result={id:'task-1'};
   else if(request.method==='tasks.wait')result={id:'task-1',status:'completed'};
   else if(request.method==='memory.read'&&params.name==='missing'){
    connection.write(encodeLine({jsonrpc:'2.0',id:request.id,error:{code:-32602,message:'Missing memory'}}));return;
   }else if(request.method==='memory.list')result=[{name:'notes',title:'Notes'}];
   connection.write(encodeLine({jsonrpc:'2.0',id:request.id,result}));
  });
 });
 const listening=Promise.withResolvers<void>();server.once('error',listening.reject);server.listen(socket,()=>listening.resolve());await listening.promise;
 if(process.platform!=='win32')await chmod(socket,0o600);
 t.after(async()=>{
  for(const connection of connections)connection.destroy();
  const closed=Promise.withResolvers<void>();server.close(()=>closed.resolve());await closed.promise;await rm(profile,{recursive:true,force:true});
 });
 const client=await ControlClient.connect({profile,socket,pageJs:true,timeoutMs:3000});t.after(()=>client.close());
 return {client,profile,socket,requests};
}

async function cli(args:string[],input=''){
 const entry=process.env.HEISEN_CLI_ENTRY;
 const child=spawn(process.execPath,[...entry?[]:['--import','tsx'],entry??resolve('src/cli/main.ts'),...args],{stdio:['pipe','pipe','pipe'],timeout:10000});
 let stdout='',stderr='';child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
 child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
 const exit=Promise.withResolvers<number|null>();child.once('error',exit.reject);child.once('close',exit.resolve);
 child.stdin.end(input);
 try{return {code:await exit.promise,stdout,stderr};}finally{child.kill();}
}

test('REPL maps the complete page, tabs, task, memory and skills API to control requests',async t=>{
 const {client,requests,profile}=await fakeServer(t),runtime=await createReplRuntime(client);
 const output=await runtime.run(`
  await page.goto('https://example.test/next');await page.back();await page.forward();
  await page.click('e1');await page.fill('e2','hello',{submit:true});await page.type('e2','again');
  await page.press('Enter');await page.scroll('down',400);await page.select('e3','value');
  const snap=await page.snapshot(),text=await page.text(),url=await page.url(),title=await page.title();
  const fixed=await tabs.open('https://two.test/');await tabs.select(fixed.tab);
  await tabs.get(1).click('e1');await page.click('e1');await fixed.goto('https://two.test/next');
  await tabs.close(fixed.tab);await tabs.list();
  const job=await task('Do it',{urls:['https://example.test/'],deep:true,skill:'skill-1'});await job.wait();await job.cancel();
  await memory.list();await memory.read('notes');await memory.write('notes','hello');await memory.search('hello');await memory.history();await memory.history('notes');await memory.revert('rev-1');
  await skills.list();await skills.install('/skills/example');await skills.remove('skill-1');await sleep(0);
  return {snap,text,url,title,tab:page.tab,fixed:fixed.tab};
 `) as {snap:unknown;text:string;url:string;title:string;tab:number;fixed:number};
 assert.deepEqual(JSON.parse(JSON.stringify(output.snap)),{title:'Example',url:'https://example.test/',text:'- e1 button "Go"'});
 assert.match(output.text,/# Markdown/);assert.equal(output.url,'https://example.test/');assert.equal(output.title,'Example');assert.equal(output.tab,1);assert.equal(output.fixed,2);
 const toolCalls=requests.filter(request=>request.method==='tools.call').map(request=>request.params as {name:string;arguments:Record<string,Json>});
 for(const name of ['navigate','go_back','go_forward','snapshot','click','type','press_key','scroll','select_option','page_markdown','list_tabs','open_tab','select_tab','close_tab'])assert.ok(toolCalls.some(call=>call.name===name),name);
 assert.ok(toolCalls.some(call=>call.name==='type'&&call.arguments.submit===true&&call.arguments.text==='hello'));
 assert.deepEqual(toolCalls.filter(call=>call.name==='click').map(call=>call.arguments.tabId),[1,1,2]);
 assert.deepEqual(requests.find(request=>request.method==='tasks.start')?.params,{prompt:'Do it',urls:['https://example.test/'],mode:'deep',skillId:'skill-1'});
 for(const method of ['tasks.wait','tasks.cancel','memory.list','memory.read','memory.write','memory.search','memory.history','memory.revert','skills.list','skills.install','skills.remove'])assert.ok(requests.some(request=>request.method===method),method);
 const image=await runtime.run('return await page.screenshot();');assert.equal(Object.prototype.toString.call(image),'[object Uint8Array]');assert.equal(Buffer.isBuffer(image),false);
 const file=join(profile,'capture.png');assert.equal(await runtime.run(`return await page.screenshot(${JSON.stringify(file)});`),file);assert.deepEqual(await readFile(file),Buffer.from([137,80,78,71]));
 await assert.rejects(runtime.run("await page.click('denied')"),/User denied/);
 await assert.rejects(runtime.run("await memory.read('missing')"),/Missing memory/);
});

function callsTool(request:Request,name:string){
 const p=request.params;
 return request.method==='tools.call'&&p!==null&&typeof p==='object'&&'name' in p&&p.name===name;
}

test('REPL uses structured snapshots for find and remembers action results for waitFor',async t=>{
 const {client,requests}=await fakeServer(t,false,true),runtime=await createReplRuntime(client);
 assert.equal(await runtime.run("return await page.find('button','Go')"),'e1');
 assert.equal(await runtime.run("return await page.find('button','back')"),'e2');
 await assert.rejects(runtime.run("await page.find('link','Missing')"),/link "Missing" 요소를 찾을 수 없습니다/);
 assert.equal(requests.filter(r=>callsTool(r,'snapshot')).length,1);
 const snap=await runtime.run('return await page.snapshot()');
 assert.deepEqual(JSON.parse(JSON.stringify(snap)),{title:'Example',url:'https://example.test/',loading:false,elements:structuredSnapshot.elements,text:'- e1 button "Go"'});
 assert.equal(await runtime.run('const s=await page.snapshot();return Object.isFrozen(s.elements)&&s.elements.every(Object.isFrozen)'),true);
 await runtime.run("await page.click('e1');return await page.find('button','Go')");
 await runtime.run("await page.waitFor({text:'Go'});await page.waitFor({load:false,timeoutMs:500});return await page.find('button','Go')");
 const waits=requests.filter(r=>callsTool(r,'wait_for')).map(r=>r.params);
 assert.deepEqual(waits,[{name:'wait_for',arguments:{tabId:1,text:'Go'}},{name:'wait_for',arguments:{tabId:1,load:false,timeoutMs:500}}]);
 assert.equal(requests.filter(r=>callsTool(r,'snapshot')).length,3);
 await runtime.run('await tabs.select((await tabs.open("https://two.test/")).tab)');
 await runtime.run("return await page.find('button','Go')");
 const lastSnapshot=requests.filter(r=>callsTool(r,'snapshot')).at(-1);
 assert.deepEqual(lastSnapshot?.params,{name:'snapshot',arguments:{tabId:2}});
});

test('REPL find also reads legacy text snapshots',async t=>{
 const {client}=await fakeServer(t),runtime=await createReplRuntime(client);
 assert.equal(await runtime.run("return await page.find('button','Go')"),'e1');
});

const scriptFeatures:Features={tasks:false,memory:false,skills:false,pageJs:false,screenshot:false};
const workerOptions={initialTab:1,features:scriptFeatures,signal:new AbortController().signal,idleMs:2000,totalMs:5000,maxCalls:10};
const scriptBridge=async()=>JSON.stringify({value:{content:[{type:'text',text:snapshot}],structuredContent:structuredSnapshot}});

test('script context omits disabled features and retains the page-JS gate',async()=>{
 const runtime=createScriptContext(scriptBridge,1,scriptFeatures);
 assert.equal(await runtime.run("return [typeof task,typeof memory,typeof skills,typeof page.screenshot,typeof process,typeof require,typeof Buffer].join(',')"),Array(7).fill('undefined').join(','));
 await assert.rejects(runtime.run('await page.evaluate("1")'),/--allow-page-js/);
 assert.equal(await runtime.evaluate('await page.find("button","Go")'),'e1');
});

test('script worker returns JSON values, bounded logs and bridge call count',async()=>{
 const requests:{method:string;params:{name:string}}[]=[];
 const result=await runScriptInWorker({...workerOptions,code:`
  console.log('hello',{answer:42});console.error('error');await sleep(0);
  const ref=await page.find('button','Go');await page.click(ref);
  return {ref,title:await page.title(),host:typeof process};
 `,bridge:async raw=>{requests.push(JSON.parse(raw));return scriptBridge();}});
 assert.deepEqual(result,{value:{ref:'e1',title:'Example',host:'undefined'},logs:['hello {"answer":42}','error'],calls:3});
 assert.deepEqual(requests.map(r=>[r.method,r.params.name]),[['tools.call','snapshot'],['tools.call','click'],['tools.call','snapshot']]);
 const bounded=await runScriptInWorker({...workerOptions,bridge:scriptBridge,code:"for(let i=0;i<105;i++)console.log('x'.repeat(2100));"});
 assert.equal(bounded.value,undefined);assert.equal(bounded.logs.length,100);assert.ok(bounded.logs.every(line=>line.length===2000));assert.equal(bounded.calls,0);
});

test('script worker rejects script and bridge errors without leaking host constructors',async()=>{
 await assert.rejects(runScriptInWorker({...workerOptions,bridge:scriptBridge,code:"console.log('before');await page.snapshot();throw new Error('broken');"}),error=>{
  assert.ok(error instanceof Error);assert.equal(error.message,'broken');
  assert.ok('logs' in error);assert.deepEqual(error.logs,['before']);assert.ok('calls' in error);assert.equal(error.calls,1);return true;
 });
 await assert.rejects(runScriptInWorker({...workerOptions,bridge:async()=>{throw new Error('denied');},code:'await page.snapshot()'}),/denied/);
 // A realm error's constructor chain reaches only QuickJS's Function, never the host's process.
 const escaped=await runScriptInWorker({...workerOptions,bridge:async()=>{throw new Error('denied');},code:'try{await page.snapshot()}catch(error){return error.constructor.constructor("return [typeof process,typeof require]")()}'});
 assert.deepEqual(escaped.value,['undefined','undefined']);
 await assert.rejects(runScriptInWorker({...workerOptions,bridge:async()=>{throw new Error('denied');},code:'try{await page.snapshot()}catch(error){error.constructor.constructor("return process")().exit(1)}'}),/'process' is not defined/);
});

test('script worker realm has no host globals, even after a stack overflow',async()=>{
 const globals=await runScriptInWorker({...workerOptions,bridge:scriptBridge,code:'return [typeof process,typeof require,typeof globalThis.process,typeof WebAssembly]'});
 assert.deepEqual(globals.value,Array(4).fill('undefined'));
 const overflow=await runScriptInWorker({...workerOptions,bridge:scriptBridge,code:`
  const deep=()=>deep();
  try{deep()}catch(error){
   let snapshot;try{snapshot=(await page.snapshot()).title}catch(inner){snapshot=String(inner.message)}
   return {error:error.message,snapshot,process:typeof process,leaked:error.constructor.constructor('return typeof process')()}
  }
 `});
 assert.deepEqual(overflow.value,{error:'stack overflow',snapshot:'Example',process:'undefined',leaked:'undefined'});
});

test('script worker terminates synchronous infinite loops at the total deadline',async()=>{
 // Exercise actual worker termination from the parent platform timer, including a blocked worker event loop.
 await assert.rejects(runScriptInWorker({...workerOptions,bridge:scriptBridge,code:'while(true){}',idleMs:5000,totalMs:150}),/스크립트 실행 시간 한도를 넘었습니다/);
});

test('script worker terminates idle scripts but pauses idle time during bridge approvals',async t=>{
 await assert.rejects(runScriptInWorker({...workerOptions,bridge:scriptBridge,code:'await sleep(10000)',idleMs:150}),/스크립트가 응답하지 않아 중단했습니다/);
 t.mock.timers.enable({apis:['setTimeout']});
 const result=await runScriptInWorker({...workerOptions,idleMs:300,code:'return (await page.snapshot()).title',bridge:async()=>{
  t.mock.timers.tick(450);return scriptBridge();
 }});
 assert.equal(result.value,'Example');assert.equal(result.calls,1);
});

test('script worker enforces maxCalls before forwarding excess requests',async()=>{
 let calls=0;
 await assert.rejects(runScriptInWorker({...workerOptions,maxCalls:1,code:'await page.snapshot();await page.snapshot()',bridge:async()=>{calls++;return scriptBridge();}}),/스크립트 호출 한도를 넘었습니다/);
 assert.equal(calls,1);
});

test('script worker terminates on abort, including a pending bridge and pre-aborted signal',async()=>{
 const controller=new AbortController(),called=Promise.withResolvers<void>(),reply=Promise.withResolvers<string>();
 const running=runScriptInWorker({...workerOptions,signal:controller.signal,code:'await page.snapshot()',bridge:async()=>{called.resolve();return reply.promise;}});
 const rejected=assert.rejects(running,/Cancelled/);
 await called.promise;controller.abort();await rejected;reply.resolve(await scriptBridge());
 await assert.rejects(runScriptInWorker({...workerOptions,signal:controller.signal,code:'while(true){}',bridge:scriptBridge}),/Cancelled/);
});

test('REPL isolates constructors, globals, promises, results, errors and dynamic imports',async t=>{
 const {client}=await fakeServer(t),runtime=await createReplRuntime(client);
 const attempts=[
  'require("node:fs")','process.cwd()','Buffer.from("x")','globalThis.process.cwd()',
  '({}).constructor.constructor("return process")()',
  'globalThis.constructor.constructor("return process")()',
  'page.goto.constructor("return process")()',
  'page.constructor.constructor("return process")()',
  'console.log.constructor("return process")()',
  'memory.list().constructor.constructor("return process")()',
  '(await memory.list()).constructor.constructor("return process")()',
  '(await page.screenshot()).constructor.constructor("return process")()',
  'try{await memory.read("missing")}catch(error){error.constructor.constructor("return process")()}',
  'await import("node:fs")'
 ];
 for(const code of attempts)await assert.rejects(runtime.run(code),code);
 assert.equal(await runtime.run('return globalThis.__bridge'),undefined);
 assert.equal(await runtime.run('return Object.isFrozen(page)&&Object.isFrozen(page.goto)&&Object.isFrozen(tabs)&&Object.isFrozen(memory)&&Object.isFrozen(skills)&&Object.isFrozen(console)&&Object.isFrozen(task)&&Object.isFrozen(JSON)&&Object.isFrozen(Math)'),true);
 assert.equal(await runtime.evaluate('await Promise.resolve(6*7)'),42);assert.equal(await runtime.evaluate('_ + 1'),43);
});

test('REPL and MCP page evaluation require BOTH opt-ins',async t=>{
 for(const setting of [false,true]){
  const {client,requests}=await fakeServer(t,setting);
  for(const flag of [false,true]){
   const runtime=await createReplRuntime(client,{pageJs:flag});
   if(flag&&setting)assert.deepEqual(JSON.parse(JSON.stringify(await runtime.run('return await page.evaluate("6*7")'))),{value:42});
   else await assert.rejects(runtime.run('return await page.evaluate("6*7")'),/--allow-page-js/);
   const input=new PassThrough(),output=new PassThrough();let text='';output.on('data',chunk=>text+=chunk);
   const serving=serveMcp(client,{input,output,pageJs:flag});
   input.end(encodeLine({jsonrpc:'2.0',id:1,method:'tools/list'})+encodeLine({jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'page_evaluate',arguments:{tabId:1,expression:'6*7'}}}));
   await serving;
   const replies=text.trim().split('\n').map(line=>JSON.parse(line));
   assert.equal(replies[0].result.tools.some((tool:{name:string})=>tool.name==='page_evaluate'),flag&&setting);
   if(flag&&setting)assert.deepEqual(replies[1].result,{content:[{type:'text',text:'{"value":42}'}]});else assert.equal(replies[1].error.code,-32002);
  }
  assert.equal(requests.filter(request=>request.method==='page.evaluate').length,setting?2:0);
 }
});

test('stdio MCP negotiates, forwards tools, preserves tool errors and validates JSON-RPC',async t=>{
 const {client,requests}=await fakeServer(t),input=new PassThrough(),output=new PassThrough();let text='';output.on('data',chunk=>text+=chunk);
 const serving=serveMcp(client,{input,output});
 input.end([
  '{not-json}\n','[]\n',
  encodeLine({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26'}}),
  encodeLine({jsonrpc:'2.0',method:'notifications/initialized'}),
  encodeLine({jsonrpc:'2.0',id:2,method:'ping'}),
  encodeLine({jsonrpc:'2.0',id:3,method:'tools/list'}),
  encodeLine({jsonrpc:'2.0',id:'call',method:'tools/call',params:{name:'click',arguments:{tabId:1,ref:'denied'}}}),
  encodeLine({jsonrpc:'2.0',id:5,method:'unknown'}),
  encodeLine({jsonrpc:'2.0',id:6,method:'tools/call',params:{name:1}}),
  encodeLine({jsonrpc:'1.0',id:7,method:'ping'}),
  encodeLine({jsonrpc:'2.0',id:8,method:'initialize',params:{protocolVersion:'unknown'}})
 ].join(''));
 await serving;
 const replies=text.trim().split('\n').map(line=>JSON.parse(line));assert.equal(replies.length,10);
 assert.equal(replies[0].error.code,-32700);assert.equal(replies[1].error.code,-32600);
 assert.deepEqual(replies[2].result,{protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'heisen',version:'0.5-test'}});
 assert.deepEqual(replies[3].result,{});assert.deepEqual(replies[4].result,{tools});
 assert.equal(replies[5].id,'call');assert.deepEqual(replies[5].result,{content:[{type:'text',text:'User denied'}],isError:true});
 assert.equal(replies[6].error.code,-32601);assert.equal(replies[7].error.code,-32602);assert.equal(replies[8].error.code,-32600);assert.equal(replies[9].result.protocolVersion,'2025-06-18');
 assert.deepEqual(requests.find(request=>request.method==='tools.call')?.params,{name:'click',arguments:{tabId:1,ref:'denied'}});
});

test('interactive REPL accepts multiline input, retains last result and creates private history',async t=>{
 const {client,profile}=await fakeServer(t),runtime=await createReplRuntime(client),input=new PassThrough(),output=new PassThrough();let text='';output.on('data',chunk=>text+=chunk);
 const historyFile=join(profile,'history');
 const serving=startInteractive(runtime,{input,output,historyFile,terminal:true});
 input.end('({\nanswer: await Promise.resolve(42)\n})\n_\n.exit\n');
 await serving;assert.match(text,/answer: 42/);assert.doesNotMatch(text,/SyntaxError/);
 if(process.platform!=='win32')assert.equal((await stat(historyFile)).mode&0o777,0o600);
 assert.match(await readFile(historyFile,'utf8'),/Promise.resolve\(42\)/);
});

test('CLI entry points handle REPL scripts/help and stdio MCP handshake against fake control server',async t=>{
 const {profile,socket}=await fakeServer(t),options=['--profile',profile,'--socket',socket];
 const help=await cli(['repl','--help']);assert.equal(help.code,0);assert.match(help.stdout,/repl \[-e/);assert.equal(help.stderr,'');
 const script=await cli([...options,'repl','-e','console.log(await page.title());']);assert.equal(script.code,0,script.stderr);assert.equal(script.stdout,'Example\n');
 const file=join(profile,'script.js');await writeFile(file,'return (await tabs.list())[0].tabId;');
 const fromFile=await cli([...options,'repl',file,'--json']);assert.equal(fromFile.code,0,fromFile.stderr);assert.equal(fromFile.stdout,'1\n');
 const failed=await cli([...options,'repl','-e','process.cwd()']);assert.equal(failed.code,1);assert.match(failed.stderr,/ReferenceError: process is not defined/);
 const invalid=await cli([...options,'repl',file,'-e','1']);assert.equal(invalid.code,64);
 const mcp=await cli([...options,'mcp'],[
  {jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}},
  {jsonrpc:'2.0',method:'notifications/initialized'},
  {jsonrpc:'2.0',id:2,method:'tools/list'},
  {jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'list_tabs',arguments:{}}}
 ].map(encodeLine).join(''));
 assert.equal(mcp.code,0,mcp.stderr);assert.equal(mcp.stderr,'');
 const replies=mcp.stdout.trim().split('\n').map(line=>JSON.parse(line));assert.equal(replies.length,3);assert.equal(replies[0].result.serverInfo.name,'heisen');assert.deepEqual(replies[1].result,{tools});assert.equal(JSON.parse(replies[2].result.content[0].text)[0].tabId,1);
});

test('local client and stdio bridge refuse an endpoint outside the selected profile before connecting',async t=>{
 const {profile,requests}=await fakeServer(t),other=await fakeServer(t),before=other.requests.length;
 await assert.rejects(ControlClient.connect({profile,socket:other.socket}),error=>error instanceof CliError&&error.exitCode===64);
 const bridge=await cli(['--profile',profile,'--socket',other.socket,'--stdio'],encodeLine({jsonrpc:'2.0',id:1,method:'hello',params:{}}));
 assert.equal(bridge.code,64);assert.equal(other.requests.length,before);assert.equal(requests.length,1);
});
test('local client rejects foreign ownership, public modes and symlinks before sending hello',{skip:process.platform==='win32'},async t=>{
 const {profile,socket,requests}=await fakeServer(t),token=join(profile,'run','heisen.token'),dir=join(profile,'run');
 for(const [file,unsafe,safe] of [[token,0o644,0o600],[dir,0o755,0o700],[socket,0o666,0o600]] as const){
  await chmod(file,unsafe);
  await assert.rejects(ControlClient.connect({profile}),error=>error instanceof CliError&&error.exitCode===4);
  assert.equal(requests.length,1);await chmod(file,safe);
 }
 // This test runs only on POSIX, where getuid is present.
 const posix=process as NodeJS.Process&{getuid:()=>number},uid=posix.getuid(),getuid=t.mock.method(posix,'getuid',()=>uid+1);
 await assert.rejects(ControlClient.connect({profile}),error=>error instanceof CliError&&error.exitCode===4);getuid.mock.restore();
 assert.equal(requests.length,1);
 for(const file of [token,socket,dir]){
  const backup=file+'.real';await rename(file,backup);await symlink(backup,file);
  await assert.rejects(ControlClient.connect({profile}),error=>error instanceof CliError&&error.exitCode===4);
  assert.equal(requests.length,1);await rm(file);await rename(backup,file);
 }
});
