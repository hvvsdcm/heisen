import {_electron as electron,type ElectronApplication,type Page} from 'playwright';
import {expect} from 'playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import type {Dialog} from 'electron';
import {ControlClient} from '../src/cli/client.ts';
import type {ToolResult} from '../src/control-protocol.ts';

type Tab={tabId:number;url:string;active:boolean};
type Revision={id:string;name:string;before:string|null;after:string|null;author:string;revertOf?:string;dreamId?:string};
type Skill={id:string;name:string;enabled:boolean;approved:boolean;hash:string};
type Task={id:string;status:string;skills?:{id:string;name:string}[];events:{type:string;text:string}[]};
type Computer={enabled:boolean;active:boolean;apps:string[];permissions:unknown;helper:boolean;platform:string};
type State={cli:{enabled:boolean;path:string};settings:{cli:{socket:boolean;pageScripts:boolean}};computer:Computer};
type ModelMessage={role:string;content:string;tool_calls?:{function:{name:string}}[]};
type Observation={tabId:number;snapshot:string;elements:{ref:string;tag:string}[]};
type DialogGlobal=typeof globalThis&{__cliDialog?:{original:Dialog['showMessageBox'];messages:string[]}};
const root=path.resolve('.'),fixtureModel='heisen-test-model',skillName='CLI source audit';
const MCP_NAMES=['list_tabs','open_tab','select_tab','close_tab','navigate','go_back','go_forward','snapshot','wait_for','click','type','press_key','scroll','select_option','page_markdown','screenshot','fill_login','fill_signup','upload_file','list_downloads'];
// macOS's per-user tmpdir is long enough to exceed the Unix socket path limit.
const temp=await fs.mkdtemp(path.join(process.platform==='darwin'?'/tmp':os.tmpdir(),'heisen-cli-')),profile=path.join(temp,'profile');
const fixtureErrors:string[]=[],modelRequests:{system:string;user:string;tools:string[]}[]=[];
let base='',app:ElectronApplication|undefined,page:Page,dialogStubbed=false;
const server=http.createServer((req,res)=>{void (async()=>{
 const route=(req.url||'').split('?')[0];
 if(route==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:fixtureModel,name:'Local CLI fixture'}]}));return;}
 if(route==='/v1/chat/completions'){
  let raw='';for await(const chunk of req)raw+=chunk;
  const input=JSON.parse(raw) as {messages:ModelMessage[];tools?:{function:{name:string}}[]};
  const system=input.messages.find(m=>m.role==='system')?.content||'';
  modelRequests.push({system,user:input.messages.filter(m=>m.role==='user').map(m=>m.content).join('\n'),tools:(input.tools||[]).map(t=>t.function.name)});
  let message:object,finishReason:string;
  if(system.split('\n')[0]==='HEISEN_DREAMING'){
   assert.ok(input.messages.some(m=>m.content.includes('=== dup ===')),'dream must receive the duplicate memory');
   message={role:'assistant',content:JSON.stringify({changes:[{name:'dup',action:'delete',reason:'duplicate'}]})};finishReason='stop';
  }else{
   const toolMessages=input.messages.filter(m=>m.role==='tool');
   const results=toolMessages.map(m=>{
    const wrapped=/^<<<UNTRUSTED id=([a-f0-9]{16}) source="[^"]+">>>\n([\s\S]*)\n<<<END \1>>>$/.exec(m.content);
    assert.ok(wrapped,'tool result must retain its untrusted boundary');return JSON.parse(wrapped[2]) as Observation;
   });
   const observation=results.findLast(result=>result.snapshot),tabId=results.find(result=>result.tabId)?.tabId;
   const skillTask=input.messages.some(m=>m.role==='user'&&m.content.includes(skillName));
   const steps:(()=>[string,object])[]=[
    ()=>['web_open',{url:base+'/page?task=cli'}],
    ()=>['web_observe',{tabId}],
    ()=>['web_fill',{tabId,snapshot:observation!.snapshot,ref:observation!.elements.find(e=>e.tag==='input')!.ref,text:'verified CLI input'}],
    ()=>['web_observe',{tabId}],
    ()=>['web_click',{tabId,snapshot:observation!.snapshot,ref:observation!.elements.find(e=>e.tag==='button')!.ref}],
    ()=>['file_write',{path:'result.md',content:'# CLI result\nClicked 1 verified CLI input'}],
    ()=>['task_finish',{summary:'CLI fill and click completed.',artifactPaths:['result.md'],sourceIds:[]}],
   ];
   const skillSteps:(()=>[string,object])[]=[
    ()=>['file_write',{path:'audit.md',content:'# CLI source audit\nLocal fixture source verified.'}],
    ()=>['task_finish',{summary:'CLI source audit skill attached.',artifactPaths:['audit.md'],sourceIds:[]}],
   ];
   const selected=skillTask?skillSteps:steps;assert.ok(toolMessages.length<selected.length,'unexpected extra model turn');
   const [name,args]=selected[toolMessages.length]();
   message={role:'assistant',content:null,tool_calls:[{id:'cli-call-'+toolMessages.length,type:'function',function:{name,arguments:JSON.stringify(args)}}]};finishReason='tool_calls';
  }
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'cli-fixture',object:'chat.completion',created:Math.floor(Date.now()/1000),model:fixtureModel,choices:[{index:0,message,finish_reason:finishReason}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));return;
 }
 if(route==='/page'){
  res.setHeader('Content-Type','text/html');res.end('<title>Heisen local fixture</title><h1>Browser fixture</h1><input aria-label="Entry" onkeydown="if(event.key===\'Enter\')window.submits++"><button onclick="document.getElementById(\'result\').textContent=\'Clicked \'+(++window.count)+\' \'+document.querySelector(\'input\').value">Increment</button><select aria-label="Choice"><option value="a">Alpha</option><option value="b">Beta</option></select><div id="result">Ready</div><script>window.count=0;window.submits=0</script>');return;
 }
 res.writeHead(404).end('Not found');
 })().catch(error=>{fixtureErrors.push(String(error));res.writeHead(500).end('Fixture failed');});});
const env:Record<string,string>={...process.env as Record<string,string>,HEISEN_TEST_BACKGROUND:process.env.HEISEN_TEST_VISIBLE==='1'?'0':'1',HEISEN_DATA_DIR:profile,HEISEN_BETA_URL:'skip'};delete env.ELECTRON_RUN_AS_NODE;
// The preload is the app's typed test boundary; it is not declared on DOM Window.
const rpc=<T=unknown>(method:string,args:object={})=>page.evaluate(([method,args])=>{const ui=window as unknown as {heisen:{call(m:string,a:object):Promise<unknown>}};return ui.heisen.call(method,args);},[method,args] as const) as Promise<T>;
// Every CLI invocation uses the built executable and the same isolated profile as Electron.
async function cli(args:string[],stdin=''):Promise<{code:number|null;stdout:string;stderr:string}>{
 const {promise,resolve,reject}=Promise.withResolvers<{code:number|null;stdout:string;stderr:string}>();
  const child=spawn(process.execPath,[path.join(root,'dist/cli.mjs'),'--timeout','45',...args],{cwd:root,env,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGKILL');},60000);
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});
  child.on('error',error=>{clearTimeout(timer);reject(error);});
  child.stdin.on('error',error=>{if(!('code' in error)||error.code!=='EPIPE')reject(error);});
  child.once('close',code=>{clearTimeout(timer);if(timedOut)reject(new Error(`CLI timed out: ${args.join(' ')}\n${stdout}\n${stderr}`));else resolve({code,stdout,stderr});});
  child.stdin.end(stdin);
 return promise;
}
async function ok(args:string[],stdin=''){
 const result=await cli(args,stdin);assert.equal(result.code,0,`CLI ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);return result.stdout;
}
async function json<T>(args:string[]):Promise<T>{return JSON.parse(await ok([...args,'--json'])) as T;}
function toolValue<T>(result:ToolResult):T{
 assert.ok(!result.isError,JSON.stringify(result));const content=result.content.find(c=>c.type==='text');assert.ok(content&&content.type==='text');return JSON.parse(content.text) as T;
}
async function rejectedHandshake(socketPath:string,method:string,params?:object){
 const {promise,resolve,reject}=Promise.withResolvers<void>();
  const socket=net.connect(socketPath);let text='';const timer=setTimeout(()=>{socket.destroy();reject(new Error('unauthorized socket did not close'));},5000);
  socket.setEncoding('utf8');socket.on('error',error=>{clearTimeout(timer);reject(error);});socket.on('data',chunk=>{text+=chunk;});
  socket.on('connect',()=>socket.write(JSON.stringify({jsonrpc:'2.0',id:1,method,params})+'\n'));
  socket.on('close',()=>{clearTimeout(timer);try{const response=JSON.parse(text.trim());assert.equal(response.id,1);assert.equal(response.error.code,-32000);resolve();}catch(error){reject(error);}});
 return promise;
}
try{
 await fs.mkdir(profile);await fs.writeFile(path.join(profile,'library.json'),JSON.stringify({settings:{importOffered:true,onboarded:true}}));
 const listening=Promise.withResolvers<void>();server.once('error',listening.reject);server.listen(0,'127.0.0.1',listening.resolve);await listening.promise;server.off('error',listening.reject);
 const address=server.address();assert.ok(address&&typeof address==='object');base='http://127.0.0.1:'+address.port;
 app=await electron.launch(process.env.HEISEN_EXECUTABLE?{executablePath:path.resolve(process.env.HEISEN_EXECUTABLE),args:[],env,timeout:45000}:{args:[root],env,timeout:45000});
 app.process().stderr?.on('data',chunk=>{if(/Error|ERR_|failed/i.test(String(chunk)))process.stderr.write(chunk);});
 page=await app.firstWindow({timeout:45000});page.setDefaultTimeout(15000);await page.getByRole('textbox',{name:'주소창'}).waitFor();
 const initial=await rpc<State>('state');assert.equal(initial.settings.cli.socket,false);assert.equal(initial.cli.enabled,false);assert.equal((await cli(['status'])).code,4);
 await rpc('cli.toggle',{enabled:true});await expect.poll(async()=>(await rpc<State>('state')).cli.enabled).toBe(true);
 const state=await rpc<State>('state'),identity=await app.evaluate(({app})=>({version:app.getVersion(),profile:app.getPath('userData')}));assert.equal(identity.profile,profile);
 const status=await json<{version:string;chromium:string;computer:Computer}>(['status']);assert.equal(status.version,identity.version);assert.match(status.chromium,/^\d+\./);
 await rejectedHandshake(state.cli.path,'status');await rejectedHandshake(state.cli.path,'hello',{token:'wrong-token',client:{name:'cli-e2e',version:'1'}});
 if(process.platform!=='win32'){
  for(const [file,mode] of [[path.join(profile,'run'),0o700],[state.cli.path,0o600],[path.join(profile,'run/heisen.token'),0o600]] as const)assert.equal((await fs.stat(file)).mode&0o777,mode,file);
 }
 const control=await ControlClient.connect({profile,timeoutMs:5000});
 try{
  assert.equal(control.hello.profile,profile);assert.equal(control.hello.pageScripts,false);assert.equal(control.hello.computer,false);
  const computer=await control.call<Computer>('computer.status');assert.deepEqual(computer,status.computer);assert.deepEqual(computer,await rpc('computer.status'));
  assert.equal(computer.enabled,false);assert.equal(computer.active,false);assert.deepEqual(computer.apps,[]);assert.equal(typeof computer.helper,'boolean');
 }finally{control.close();}
 console.log('PASS 1 status/version, default-off socket, authentication, permissions, computer.status wiring (no OS control)');

 const opened=toolValue<{tabId:number}>(await json<ToolResult>(['open',base+'/page']));assert.ok(Number.isSafeInteger(opened.tabId));
 const tabs=toolValue<Tab[]>(await json<ToolResult>(['tabs','list']));assert.ok(tabs.some(t=>t.tabId===opened.tabId&&t.url===base+'/page'&&t.active));
 console.log('PASS 2 open + tabs list through the CLI');

 const tabId=String(opened.tabId);
 const inPage=()=>app!.evaluate(async({webContents},url)=>{
  const tab=webContents.getAllWebContents().find(w=>w.getURL()===url);if(!tab)throw new Error('Missing one-shot fixture tab');
  return tab.executeJavaScript('({result:document.getElementById("result").textContent,submits:window.submits,choice:document.querySelector("select").value})') as Promise<{result:string;submits:number;choice:string}>;
 },base+'/page');
 const snapshot=await ok(['snapshot',tabId]);assert.match(snapshot,/button "Increment"/);
 const inputRef=/^- (e\d+) textbox "Entry"/m.exec(snapshot)?.[1];assert.ok(inputRef,snapshot);
 const typed=await ok(['type',tabId,inputRef,'hi','--submit']);assert.equal((await inPage()).submits,1);
 const buttonRef=/^- (e\d+) button "Increment"/m.exec(typed)?.[1];assert.ok(buttonRef,typed);
 const clickStarted=performance.now(),clicked=await ok(['click',tabId,buttonRef]),clickMs=performance.now()-clickStarted;
 assert.match(clicked,/button "Increment"/);assert.equal((await inPage()).result,'Clicked 1 hi');
 console.log(`CLI one-shot click wall clock: ${clickMs.toFixed(1)} ms (node dist/cli.mjs click)`);
 assert.match(await ok(['wait',tabId,'--for','Clicked','--load']),/button "Increment"/);
 assert.match(await ok(['snapshot',tabId,'--full']),/Clicked 1 hi/);
 assert.match(await ok(['read',tabId]),/Clicked 1 hi/);
 const selectRef=/^- (e\d+) combobox "Choice"/m.exec(await ok(['snapshot',tabId]))?.[1];assert.ok(selectRef);
 assert.match(await ok(['select',tabId,selectRef,'b']),/button "Increment"/);assert.equal((await inPage()).choice,'b');
 assert.match(await ok(['key',tabId,'Tab']),/button "Increment"/);
 assert.match(await ok(['scroll',tabId,'down','100']),/button "Increment"/);
 assert.match(await ok(['scroll',tabId,'up']),/button "Increment"/);
 const destination=base+'/page?oneshot=go';assert.ok((await ok(['go',tabId,destination])).includes(`[url] ${destination}`));
 assert.ok((await ok(['go',tabId,'back'])).includes(`[url] ${base}/page\n`));
 assert.ok((await ok(['go',tabId,'forward'])).includes(`[url] ${destination}`));
 const screenshot=path.join(temp,'oneshot.png');assert.equal((await ok(['shot',tabId,screenshot])).trim(),screenshot);
 assert.deepEqual((await fs.readFile(screenshot)).subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
 if(process.platform!=='win32')assert.equal((await fs.stat(screenshot)).mode&0o777,0o600);
 for(const args of [['snapshot','0'],['click',tabId],['scroll',tabId,'left'],['scroll',tabId,'down','1.5'],['read',tabId,'--submit']])assert.equal((await cli(args)).code,64,args.join(' '));
 console.log('PASS 2a one-shot snapshot, type --submit, click, wait, full/read, select, key, scroll, navigation/history, private PNG and argument validation');

 await rpc('auth.save',{provider:'local',baseURL:base+'/v1'});await rpc('settings.save',{provider:'local',model:fixtureModel});
 const executed=await ok(['exec','Fill entry and click Increment on the fixture.','--url',base+'/page?task=cli']);assert.match(executed,/web_open/);
 const tasks=await json<Task[]>(['tasks','list']);assert.equal(tasks.length,1);assert.equal(tasks[0].status,'completed');
 const task=await json<Task>(['tasks','show',tasks[0].id]);assert.ok(task.events.some(e=>e.text.includes('web_open')));
 const result=await app.evaluate(async({webContents},url)=>{const tab=webContents.getAllWebContents().find(w=>w.getURL()===url);if(!tab)throw new Error('Missing task fixture tab');return tab.executeJavaScript('document.getElementById("result").textContent');},base+'/page?task=cli');
 assert.equal(result,'Clicked 1 verified CLI input');assert.ok(modelRequests.every(r=>!r.tools.some(name=>name.startsWith('computer_'))),'disabled computer tools must not reach the model');
 console.log('PASS 3 exec streams web_open and completes real browser fill/click with the local model');

 assert.equal((await ok(['repl','-e',`const t=await tabs.open(${JSON.stringify(base+'/page')});console.log((await t.snapshot()).title)`])).trim(),'Heisen local fixture');
 // -e is a script body, so explicitly print the scope checks rather than relying on REPL expression echo.
 assert.equal((await ok(['repl','-e',"console.log(typeof require+' '+typeof process)"])).trim(),'undefined undefined');
 // The active tab after exec is task-owned and intentionally absent from the CLI catalogue.
 const script=path.join(temp,'fixture.js');await fs.writeFile(script,`console.log((await tabs.get(${opened.tabId}).snapshot()).title)`);assert.equal((await ok(['repl',script])).trim(),'Heisen local fixture');
 console.log('PASS 4 REPL -e/file execution, tab snapshot, require/process absent');

 const requests=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'cli-e2e',version:'1'}}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/list'},{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'list_tabs',arguments:{}}}];
 const replies=(await ok(['mcp'],requests.map(r=>JSON.stringify(r)).join('\n')+'\n')).trim().split('\n').map(line=>JSON.parse(line));
 assert.deepEqual(replies.map(r=>r.id),[1,2,3]);for(const reply of replies){assert.equal(reply.jsonrpc,'2.0');assert.equal(reply.error,undefined);}
 assert.equal(replies[0].result.protocolVersion,'2025-06-18');assert.equal(replies[0].result.serverInfo.name,'heisen');assert.equal(replies[0].result.serverInfo.version,identity.version);
 assert.deepEqual(replies[1].result.tools.map((t:{name:string})=>t.name).sort(),[...MCP_NAMES].sort());assert.ok(toolValue<Tab[]>(replies[2].result).some(t=>t.tabId===opened.tabId));
 console.log('PASS 5 stdio MCP initialize, notification silence, 20 tools, real tools/call');

 await ok(['memory','write','note','--text','a']);await ok(['memory','write','note','--text','b']);
 const history=await json<Revision[]>(['memory','history','note']);assert.equal(history.length,2);assert.equal(history[0].before,'a');assert.equal(history[0].after,'b');assert.equal(history[1].before,null);
 const reverted=await json<Revision>(['memory','revert',history[0].id]);assert.equal(reverted.revertOf,history[0].id);assert.equal(reverted.author,'user');assert.equal((await ok(['memory','read','note'])).trim(),'a');
 assert.equal((await json<Revision[]>(['memory','history','note'])).length,3);
 console.log('PASS 6 memory writes, ordered history and revision revert restore a');

 await ok(['memory','write','dup','--text','x']);const dream=await json<{id:string;status:string;changes:{name:string;revisionId:string}[]}>(['memory','dream']);assert.equal(dream.status,'applied');
 assert.ok(!(await json<{name:string}[]>(['memory','list'])).some(m=>m.name==='dup'));assert.equal(await json(['memory','read','dup']),null);
 const dreamHistory=await json<Revision[]>(['memory','history','dup']);assert.equal(dreamHistory[0].author,'dreaming');assert.equal(dreamHistory[0].before,'x');assert.equal(dreamHistory[0].after,null);assert.equal(dreamHistory[0].dreamId,dream.id);assert.equal(dream.changes[0].revisionId,dreamHistory[0].id);
 assert.equal(modelRequests.filter(r=>r.system.startsWith('HEISEN_DREAMING')).length,1);
 console.log('PASS 7 dreaming uses local completion, deletes dup and records its dreaming revision');

 const skillDir=path.join(temp,'skill');await fs.mkdir(skillDir);await fs.writeFile(path.join(skillDir,'SKILL.md'),`---\nname: ${skillName}\ndescription: CLI source audit checks source URLs\nallowed-tools: [web_observe]\n---\nCheck source URLs before finishing.\n`);
 await app.evaluate(({dialog})=>{const g=globalThis as DialogGlobal;g.__cliDialog={original:dialog.showMessageBox,messages:[]};dialog.showMessageBox=(async(...args:unknown[])=>{const options=args.at(-1) as {message:string};g.__cliDialog!.messages.push(options.message);return {response:1,checkboxChecked:false};}) as typeof dialog.showMessageBox;});dialogStubbed=true;
 const installed=await json<Skill[]>(['skills','install',skillDir]);assert.equal(installed.length,1);assert.equal(installed[0].approved,true);assert.equal(installed[0].enabled,true);assert.match(installed[0].hash,/^[a-f0-9]{64}$/);
 assert.ok((await json<Skill[]>(['skills','list'])).some(s=>s.id===installed[0].id&&s.name===skillName));
 assert.deepEqual(await app.evaluate(()=>(globalThis as DialogGlobal).__cliDialog!.messages),[`스킬 "${skillName}"을(를) 사용할까요?`]);
 const skillOutput=await ok(['exec',`${skillName}: check the source URLs. Keep the response short.`,'--json']);
 const skillTask=JSON.parse(skillOutput.trim().split('\n').at(-1)!) as Task;assert.equal(skillTask.status,'completed');
 const attached=await json<Task>(['tasks','show',skillTask.id]);assert.deepEqual(attached.skills,[{id:installed[0].id,name:skillName}]);assert.ok(modelRequests.some(r=>r.user.includes('Check source URLs before finishing.')));
 console.log('PASS 8 folder skill install requests native approval; automatic matching attaches skill to CLI task');

 await rpc('cli.toggle',{enabled:false});assert.equal((await rpc<State>('state')).cli.enabled,false);
 const disabled=await cli(['status']);assert.equal(disabled.code,4);assert.equal(disabled.stdout,'');assert.match(disabled.stderr,/CLI 소켓이 꺼져 있습니다/);
 await assert.rejects(fs.access(path.join(profile,'run/heisen.token')),{code:'ENOENT'});
 assert.deepEqual(fixtureErrors,[]);
 console.log('PASS 9 disabling the control socket removes the token and returns CLI exit 4');
 console.log('ALL CLI CHECKS PASSED');
}finally{
 try{
  if(app){
   const child=app.process(),forceClose=setTimeout(()=>child.kill('SIGKILL'),10000);
   try{if(dialogStubbed)await app.evaluate(({dialog})=>{const g=globalThis as DialogGlobal;dialog.showMessageBox=g.__cliDialog!.original;delete g.__cliDialog;});}
   finally{try{await app.close();}finally{clearTimeout(forceClose);}}
  }
 }finally{
  server.closeAllConnections();const closed=Promise.withResolvers<void>();server.close(()=>closed.resolve());await closed.promise;await fs.rm(temp,{recursive:true,force:true});
 }
}
