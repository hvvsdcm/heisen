import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {AgentApi,MCP_TOOLS,RpcError} from './agent-api.ts';
import {CONTROL_VERSION,LineDecoder,encodeLine,type Notification,type Response} from './control-protocol.ts';
import {controlSocketPath} from './platform.ts';
import {originOf,textArg,type Task} from './protocol.ts';
import type {Browser} from './browser.ts';
import type {HeisenEngine} from './models.ts';
import type {Data} from './data.ts';
import type {Routines} from './routines.ts';
import type {MemoryStore,Dreaming} from './memory.ts';
import type {SkillStore} from './skills.ts';

export type ControlDeps={
 profile:string;version:string;chromium:string;agentApi:AgentApi;
 browser:()=>Browser|undefined;openWindow:()=>Promise<Browser>;
 startTask:(input:{prompt:string;urls?:string[];mode?:string;skillId?:string;memoryIds?:string[]})=>Promise<{id:string}>;
 continueTask?:(input:{id:string;prompt:string;urls?:string[];mode?:string;skillId?:string;memoryIds?:string[]})=>Promise<{id:string}>;
 engine:HeisenEngine;data:Data;routines:Routines;changed:()=>void;
 memory?:MemoryStore;skills?:SkillStore;dreaming?:Dreaming;
 computer?:{status:()=>{enabled:boolean}};
};
export type Session={id:number;authed:boolean;approved:Set<string>;pageJs:boolean;watching:Set<string>;send:(msg:Notification|Response)=>void};
type Connection=Session&{socket:net.Socket;abort:AbortController;sent:Map<string,number>;lastEvent:Map<string,Task['events'][number]>;statuses:Map<string,string>};
type Handler=(params:Record<string,any>,session:Session)=>unknown|Promise<unknown>;
type Waiter={finish:(task?:Task,error?:Error)=>void};
const terminal=(task:Task)=>['completed','failed','cancelled','interrupted'].includes(task.status);
const MAX_BUFFER=8*1024*1024;
function text(value:unknown,max:number):string{try{return textArg(value,max);}catch{throw new RpcError(-32602,'Invalid text argument');}}
function strings(value:unknown,maxItems:number,maxLength:number):string[]|undefined{
 if(value===undefined)return undefined;
 if(!Array.isArray(value)||value.length>maxItems)throw new RpcError(-32602,'Invalid array argument');
 return value.map(item=>text(item,maxLength));
}
function urls(value:unknown):string[]|undefined{
 const result=strings(value,12,4096);
 try{result?.forEach(originOf);}catch{throw new RpcError(-32602,'HTTP(S) URL required');}
 return result;
}
function unlink(file:string){try{fs.unlinkSync(file);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}}

export class Control{
 private server?:net.Server;
 private starting?:Promise<void>;
 private closing:Promise<void>=Promise.resolve();
 private generation=0;
 private enabled=false;
 private token='';
 private nextSession=0;
 private sessions=new Set<Connection>();
 private handlers=new Map<string,Handler>();
 private waiters=new Map<string,Set<Waiter>>();
 private readonly socketPath:string;
 private readonly tokenPath:string;
 constructor(private deps:ControlDeps){
  this.socketPath=controlSocketPath(deps.profile);this.tokenPath=path.join(deps.profile,'run','heisen.token');
  const {memory,dreaming,skills,changed}=deps;
  if(memory)this.register('memory',{
   list:()=>memory.list(),
   read:p=>memory.read(text(p.name,80)),
   write:async p=>{const revision=await memory.write(text(p.name,80),text(p.text,60000),{author:'user'});changed();return revision;},
   delete:async p=>{const revision=await memory.delete(text(p.name,80),{author:'user'});changed();return revision;},
   search:p=>memory.search(text(p.query,1000)),
   history:p=>memory.history(p.name===undefined?undefined:text(p.name,80)),
   revert:async p=>{const revision=await memory.revert(text(p.id,40));changed();return revision;}
  });
  if(dreaming)this.register('memory',{dream:()=>dreaming.run('manual')});
  if(skills)this.register('skills',{
   list:()=>skills.list(),
   install:async p=>{try{return await skills.install(text(p.source,4096));}finally{changed();}},
   remove:async p=>{await skills.remove(text(p.id,100));changed();return true;},
   enable:async p=>{if(typeof p.enabled!=='boolean')throw new RpcError(-32602,'enabled must be a boolean');try{return await skills.setEnabled(text(p.id,100),p.enabled);}finally{changed();}},
   body:p=>skills.body(text(p.id,100))
  });
 }
 info(){return {enabled:this.enabled,path:this.socketPath,clients:[...this.sessions].filter(s=>s.authed).length};}
 register(prefix:'memory'|'skills'|'computer',handlers:Record<string,Handler>):void{
  for(const [name,handler] of Object.entries(handlers))this.handlers.set(`${prefix}.${name}`,handler);
 }
 async start():Promise<void>{
  if(!this.deps.data.state.settings.cli.socket||this.enabled)return;
  if(this.starting){await this.starting;if(this.deps.data.state.settings.cli.socket&&!this.enabled)await this.start();return;}
  const generation=this.generation;
  this.starting=this.listen(generation);
  try{await this.starting;}finally{this.starting=undefined;}
 }
 private async listen(generation:number):Promise<void>{
  await this.closing;
  if(generation!==this.generation||!this.deps.data.state.settings.cli.socket)return;
  try{
   const dir=path.dirname(this.tokenPath);
   fs.mkdirSync(dir,{recursive:true,mode:0o700});
   const stat=fs.lstatSync(dir);
   if(!stat.isDirectory()||process.getuid&&stat.uid!==process.getuid())throw new Error('Unsafe control directory');
   fs.chmodSync(dir,0o700);
   // Node exposes neither getpeereid/SO_PEERCRED nor named-pipe ACLs. POSIX
   // uses private modes; Windows relies on the profile's inherited user ACL
   // to protect the per-run token, not chmod or the pipe name. A shared or
   // permissive profile directory does not provide a same-user boundary.
   unlink(this.tokenPath);
   this.token=randomBytes(32).toString('base64url');
   fs.writeFileSync(this.tokenPath,this.token,{mode:0o600,flag:'wx'});
   fs.chmodSync(this.tokenPath,0o600);
   if(process.platform!=='win32')unlink(this.socketPath);
   const server=net.createServer(socket=>this.connect(socket));this.server=server;
   await new Promise<void>((resolve,reject)=>{
    const closed=()=>reject(new Error('Control startup stopped'));
    const failed=(error:Error)=>{server.off('close',closed);reject(error);};
    server.once('error',failed);server.once('close',closed);
    server.listen(this.socketPath,()=>{server.off('error',failed);server.off('close',closed);resolve();});
   });
   if(generation!==this.generation)return;
   if(process.platform!=='win32')fs.chmodSync(this.socketPath,0o600);
   server.on('error',error=>{console.error('Control server failed',error);this.stop();});
   this.enabled=true;this.deps.changed();
  }catch(error){
   if(generation===this.generation){console.error('Control server start failed',error);this.stop();}
  }
 }
 stop():void{
  ++this.generation;this.enabled=false;
  for(const session of this.sessions)session.socket.destroy();
  for(const session of this.sessions)this.dispose(session);
  const server=this.server;this.server=undefined;
  if(server)this.closing=new Promise(resolve=>server.close(()=>resolve()));
  // net.Server.close unlinks its own Unix socket before a later start binds.
  if(this.token){this.token='';try{unlink(this.tokenPath);}catch(error){console.error('Control token cleanup failed',error);}}
  this.deps.changed();
 }
 private dispose(session:Connection):void{
  if(!this.sessions.delete(session))return;
  session.abort.abort();session.approved.clear();session.watching.clear();session.sent.clear();session.lastEvent.clear();session.statuses.clear();this.deps.changed();
 }
 private connect(socket:net.Socket):void{
  if(!this.enabled||this.sessions.size>=64){socket.destroy();return;}
  socket.setEncoding('utf8');
  const decoder=new LineDecoder();let ending=false,queue=Promise.resolve(),queued=0,queuedBytes=0,rateAt=Date.now(),requests=0;
  const send=(message:unknown)=>{
   if(socket.destroyed||ending)return;
   const line=encodeLine(message);
   if(socket.writableLength+Buffer.byteLength(line)>MAX_BUFFER){socket.destroy();return;}
   socket.write(line);
  };
  const fail=(id:unknown,code:number,message:string)=>{
   if(socket.destroyed||ending)return;
   send({jsonrpc:'2.0',id:typeof id==='string'||typeof id==='number'&&Number.isFinite(id)?id:null,error:{code,message}});
   ending=true;socket.end(()=>socket.destroy());setTimeout(()=>socket.destroy(),250).unref();
  };
  const session:Connection={id:++this.nextSession,authed:false,approved:new Set(),pageJs:false,watching:new Set(),send,socket,abort:new AbortController(),sent:new Map(),lastEvent:new Map(),statuses:new Map()};
  this.sessions.add(session);
  const handshake=setTimeout(()=>fail(null,-32000,'Unauthorized'),3000);handshake.unref();
  socket.on('error',()=>socket.destroy());socket.once('close',()=>{clearTimeout(handshake);this.dispose(session);});
  decoder.on('error',error=>fail(null,error instanceof SyntaxError?-32700:-32600,error.message));
  decoder.on('message',value=>{
   if(ending||socket.destroyed)return;
   const message=value as Record<string,unknown>,now=Date.now(),bytes=Buffer.byteLength(JSON.stringify(value));
   if(now-rateAt>=1000){rateAt=now;requests=0;}
   if(++requests>120||queued>=64||queuedBytes+bytes>MAX_BUFFER){fail(message.id,-32600,'Request limit exceeded');return;}
   queued++;queuedBytes+=bytes;
   queue=queue.then(async()=>{
    if(ending||socket.destroyed)return;
    const id=message.id,validId=typeof id==='string'&&id.length<=100||typeof id==='number'&&Number.isFinite(id);
    if(!session.authed){
     try{
      if(message.jsonrpc!=='2.0'||message.method!=='hello'||!validId)throw new RpcError(-32000,'Unauthorized');
      const result=this.hello(message.params,session);clearTimeout(handshake);send({jsonrpc:'2.0',id,result});this.deps.changed();
     }catch{fail(id,-32000,'Unauthorized');}
     return;
    }
    if(message.jsonrpc!=='2.0'){send({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}});return;}
    if(!('id' in message)&&typeof message.method==='string')return;
    if(typeof message.method!=='string'&&('result' in message||'error' in message))return;
    if(!validId||typeof message.method!=='string'||message.method.length>80){send({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}});return;}
    try{
     const params=message.params??{};
     if(typeof params!=='object'||Array.isArray(params))throw new RpcError(-32602,'params must be an object');
     const result=await this.dispatch(message.method,params as Record<string,unknown>,session);
     send({jsonrpc:'2.0',id,result:result??null});
    }catch(error){send({jsonrpc:'2.0',id,error:{code:error instanceof RpcError?error.code:-32603,message:String((error as Error)?.message||error).slice(0,2000)}});}
   }).catch(()=>{socket.destroy();}).finally(()=>{queued--;queuedBytes-=bytes;});
  });
  socket.on('data',chunk=>decoder.push(chunk));
 }
 private hello(params:unknown,session:Connection){
  if(!params||typeof params!=='object'||Array.isArray(params))throw new RpcError(-32000,'Unauthorized');
  const p=params as Record<string,any>,token=Buffer.from(text(p.token,100)),expected=Buffer.from(this.token);
  if(!this.token||token.length!==expected.length||!timingSafeEqual(token,expected))throw new RpcError(-32000,'Unauthorized');
  if(!p.client||typeof p.client!=='object'||Array.isArray(p.client))throw new RpcError(-32000,'Unauthorized');
  text(p.client.name,80);text(p.client.version,80);
  const capabilities=strings(p.capabilities,8,80);
  if(capabilities?.some(value=>value!=='page-js'))throw new RpcError(-32602,'Unknown capability');
  session.authed=true;session.pageJs=this.deps.data.state.settings.cli.pageScripts===true&&!!capabilities?.includes('page-js');
  return {protocol:CONTROL_VERSION,app:{version:this.deps.version,chromium:this.deps.chromium},profile:this.deps.profile,pageScripts:session.pageJs,computer:this.deps.computer?.status().enabled??false};
 }
 private async dispatch(method:string,p:Record<string,any>,session:Connection):Promise<unknown>{
  const {engine,data}=this.deps;
  switch(method){
   case 'hello':throw new RpcError(-32600,'Already authenticated');
   case 'status':return {version:this.deps.version,chromium:this.deps.chromium,tabs:[...(this.deps.browser()?.tabs.values()??[])].filter(t=>!t.incognito&&!t.taskId).length,tasks:{running:[...engine.tasks.values()].filter(t=>!terminal(t)).length,total:engine.tasks.size},mcp:this.deps.agentApi.info(),computer:this.deps.computer?.status()??{enabled:false},window:!!this.deps.browser()};
   case 'tools.list':return {tools:MCP_TOOLS};
   case 'tools.call':{
    const name=text(p.name,80);if(!this.deps.browser())await this.deps.openWindow();
    return this.deps.agentApi.callTool(name,p.arguments,session.approved,'cli');
   }
   case 'page.evaluate':return this.evaluate(p,session);
   case 'tasks.start':{
    const prompt=text(p.prompt,12000),mode=p.mode===undefined?undefined:text(p.mode,80);
    if(mode!==undefined&&mode!=='normal'&&mode!=='deep')throw new RpcError(-32602,'Invalid mode');
    return this.deps.startTask({prompt,urls:urls(p.urls),mode,skillId:p.skillId===undefined?undefined:text(p.skillId,100),memoryIds:strings(p.memoryIds,100,80)});
   }
   case 'tasks.list':return [...engine.tasks.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(t=>({id:t.id,prompt:t.prompt,status:t.status,createdAt:t.createdAt,mode:t.mode,result:t.result?.slice(0,64000)}));
   case 'tasks.get':return engine.publicTask(engine.get(text(p.id,100)));
   case 'tasks.cancel':engine.cancel(text(p.id,100));return true;
   case 'tasks.continue':{
    const id=text(p.id,100),prompt=text(p.prompt,12000),mode=p.mode===undefined?undefined:text(p.mode,80);
    if(mode!==undefined&&mode!=='normal'&&mode!=='deep')throw new RpcError(-32602,'Invalid mode');
    const input={id,prompt,urls:urls(p.urls),mode,skillId:p.skillId===undefined?undefined:text(p.skillId,100),memoryIds:strings(p.memoryIds,100,80)};
    return this.deps.continueTask?this.deps.continueTask(input):engine.continueTask(id,prompt,{provider:data.state.settings.provider,model:data.state.settings.model,urls:input.urls});
   }
   case 'tasks.approve':{
    const id=text(p.id,100),approvalId=text(p.approvalId,100),task=engine.get(id);
    if(typeof p.approved!=='boolean')throw new RpcError(-32602,'approved must be a boolean');
    if(task.approval?.id!==approvalId||task.status!=='awaiting_approval')throw new RpcError(-32602,'만료된 실행 확인입니다.');
    // No typed approval kind exists yet. Fail closed: only these two engine-
    // authored non-credential titles may be approved outside the app window.
    if(!['새 사이트 접근','작성된 코드 실행'].includes(task.approval.title))throw new RpcError(-32001,'이 승인은 Heisen 앱 창에서 확인해 주세요. 로그인·회원가입·파일 업로드는 CLI에서 승인할 수 없습니다.');
    engine.approve(id,approvalId,p.approved);return true;
   }
   case 'tasks.watch':{
    const task=engine.get(text(p.id,100));session.watching.add(task.id);this.emitTask(session,task);return true;
   }
   case 'tasks.unwatch':this.unwatch(session,text(p.id,100));return true;
   case 'tasks.wait':{
    const task=engine.get(text(p.id,100)),timeout=p.timeoutMs??600000;
    if(!Number.isSafeInteger(timeout)||timeout<1||timeout>2147483647)throw new RpcError(-32602,'Invalid timeoutMs');
    return this.wait(task,timeout,session);
   }
   case 'routines.list':return data.state.routines;
   case 'routines.run':await this.deps.routines.run(text(p.id,100));return true;
   case 'routines.toggle':{
    const id=text(p.id,100),routine=data.state.routines.find(r=>r.id===id);
    if(!routine)throw new RpcError(-32602,'루틴을 찾을 수 없습니다.');
    routine.enabled=!routine.enabled;data.save();this.deps.changed();return true;
   }
  }
  const handler=this.handlers.get(method);if(handler)return handler(p,session);
  throw new RpcError(-32601,'Method not found');
 }
 private async evaluate(p:Record<string,any>,session:Connection):Promise<unknown>{
  if(!session.pageJs||!this.deps.data.state.settings.cli.pageScripts)throw new RpcError(-32002,'페이지 스크립트가 꺼져 있습니다.');
  const expression=text(p.expression,100000);
  if(!Number.isSafeInteger(p.tabId)||p.tabId<1)throw new RpcError(-32602,'Invalid tab');
  const browser=this.deps.browser(),tab=browser?.get(p.tabId);
  if(!tab||tab.incognito)throw new RpcError(-32602,'탭을 찾을 수 없습니다.');
  if(tab.taskId)throw new RpcError(-32602,'작업 탭은 다룰 수 없습니다.');
  if(!tab.view)await browser!.command('reload',tab.id);else if(tab.ready)await tab.ready;
  if(session.abort.signal.aborted)throw new RpcError(-32000,'Connection closed');
  if(!this.deps.data.state.settings.cli.pageScripts)throw new RpcError(-32002,'페이지 스크립트가 꺼져 있습니다.');
  if(browser!.get(tab.id)!==tab||!tab.view||tab.view.webContents.isDestroyed())throw new RpcError(-32602,'웹 페이지를 먼저 여세요.');
  tab.agentAt=Date.now();
  let timer:NodeJS.Timeout|undefined;
  try{
   const value=await Promise.race([tab.view.webContents.executeJavaScript(expression,true),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new RpcError(-32603,'timeout')),10000);timer.unref();})]);
   const json=JSON.stringify(value)??'null',bytes=Buffer.from(json);
   return bytes.length>1024*1024?{value:bytes.subarray(0,1024*1024).toString('utf8'),truncated:true}:{value:JSON.parse(json)};
  }finally{clearTimeout(timer);}
 }
 notify(task:Task):void{
  for(const session of this.sessions)if(session.authed&&session.watching.has(task.id))this.emitTask(session,task);
  if(terminal(task))for(const waiter of this.waiters.get(task.id)??[])waiter.finish(task);
 }
 private emitTask(session:Connection,task:Task):void{
  const previous=session.lastEvent.get(task.id),sent=session.sent.get(task.id)??0;
  // Engine retains only the latest 150 events. Object identity tracks rollover
  // even when repeated events have identical timestamps and text.
  const offset=previous?(task.events[sent-1]===previous?sent:Math.max(0,task.events.indexOf(previous)+1)):0;
  try{
   for(const event of task.events.slice(offset))session.send({jsonrpc:'2.0',method:'task.event',params:{id:task.id,event}});
   session.sent.set(task.id,task.events.length);
   const last=task.events.at(-1);if(last)session.lastEvent.set(task.id,last);
   const approval=task.approval?{id:task.approval.id,title:task.approval.title,detail:task.approval.detail}:undefined;
   const params={id:task.id,status:task.status,...approval?{approval}:{}},status=JSON.stringify(params);
   if(session.statuses.get(task.id)!==status){session.send({jsonrpc:'2.0',method:'task.status',params});session.statuses.set(task.id,status);}
   if(terminal(task))this.unwatch(session,task.id);
  }catch{session.socket.destroy();}
 }
 private unwatch(session:Connection,id:string):void{session.watching.delete(id);session.sent.delete(id);session.lastEvent.delete(id);session.statuses.delete(id);}
 private wait(task:Task,timeout:number,session:Connection):Promise<unknown>{
  if(terminal(task))return Promise.resolve(this.deps.engine.publicTask(task));
  return new Promise((resolve,reject)=>{
   const waiting=this.waiters.get(task.id)??new Set<Waiter>();this.waiters.set(task.id,waiting);
   const aborted=()=>waiter.finish(undefined,new Error('Connection closed'));
   const timer=setTimeout(()=>waiter.finish(undefined,new RpcError(-32603,'timeout')),timeout);timer.unref();
   const waiter:Waiter={finish:(result,error)=>{
    clearTimeout(timer);session.abort.signal.removeEventListener('abort',aborted);waiting.delete(waiter);if(!waiting.size)this.waiters.delete(task.id);
    if(error)reject(error);else resolve(this.deps.engine.publicTask(result!));
   }};
   waiting.add(waiter);session.abort.signal.addEventListener('abort',aborted,{once:true});if(session.abort.signal.aborted)aborted();
  });
 }
}
