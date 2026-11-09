import {globalShortcut} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import type {Data} from './data.ts';
import {helperCommand,helperPath} from './platform.ts';
import {textArg} from './protocol.ts';

type Permissions={screen:boolean;accessibility:boolean};
type RunningApp={id:string;name:string;pid:number;active:boolean};
type Screenshot={png:string;width:number;height:number;scale:number;origin:{x:number;y:number}};
export type ComputerOp='screenshot'|'click'|'type'|'key'|'scroll'|'ui_tree';
export type ComputerStatus={enabled:boolean;active:boolean;apps:string[];permissions:Permissions|null;helper:boolean;platform:'mac'|'win'|'unsupported'};
const shortcut='CommandOrControl+Shift+Escape';
const sensitiveKeys:Record<string,true>={'cmd+space':true,'cmd+tab':true,'alt+tab':true,win:true,'cmd+q':true,'cmd+w':true,'cmd+shift+w':true,'cmd+delete':true,'backspace+cmd':true,'alt+f4':true,'ctrl+w':true,'ctrl+shift+w':true,'cmd+delete+shift':true};

export class ComputerUse {
 private child?:ChildProcessWithoutNullStreams;
 private pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void;timer:NodeJS.Timeout}>();
 private sequence=0;
 private generation=0;
 private permissionState:Permissions|null=null;
 private taskId?:string;
 private ready=false;
 private starting?:Promise<void>;
 private image?:Screenshot;
 private busy=false;
 onStop?:(reason:string,taskId?:string)=>void;
 constructor(private deps:{data:Data;appRoot:string;packaged:boolean;confirm:(message:string,detail:string)=>Promise<boolean>;changed:()=>void;logDir:string}){}
 status():ComputerStatus{return {enabled:this.deps.data.state.settings.computer.enabled,active:this.ready,apps:[...this.deps.data.state.settings.computer.apps],permissions:this.permissionState?{...this.permissionState}:null,helper:(process.platform==='darwin'||process.platform==='win32')&&fs.existsSync(helperPath('computer',this.deps.appRoot,this.deps.packaged)),platform:process.platform==='darwin'?'mac':process.platform==='win32'?'win':'unsupported'};}
 owns(taskId:string){return this.taskId===taskId;}
 private log(taskId:string|undefined,op:string,args:Record<string,unknown>,ok:boolean,error?:string,app?:string){
  fs.mkdirSync(this.deps.logDir,{recursive:true,mode:0o700});
  const file=path.join(this.deps.logDir,'log.jsonl');
  // Never persist typed secrets or captured pixels, including on refused input.
  const safe={...args};if('text' in safe)safe.text=`[redacted: ${typeof safe.text==='string'?safe.text.length:0} characters]`;
  fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),taskId,op,args:safe,app,ok,...(error?{error}: {})})+'\n',{mode:0o600});fs.chmodSync(file,0o600);
 }
 private spawn(){
  if(this.child)return this.child;
  if(this.status().platform==='unsupported'||!this.status().helper)throw new Error('helper가 없습니다.');
  const launch=helperCommand('computer',this.deps.appRoot,this.deps.packaged);
  const child=spawn(launch.command,launch.args,{stdio:['pipe','pipe','pipe'],windowsHide:true});this.child=child;
  let buffer='';child.stdout.setEncoding('utf8');child.stderr.resume();
  const failed=(error:Error)=>{if(this.child!==child)return;this.stop('crash',error.message);};
  child.on('error',failed);child.on('exit',()=>failed(new Error('컴퓨터 helper 연결이 끊겼습니다.')));child.stdin.on('error',failed);
  child.stdout.on('data',(chunk:string)=>{
   if(this.child!==child)return;
   buffer+=chunk;if(Buffer.byteLength(buffer)>24*1024*1024){failed(new Error('helper 응답 크기 초과'));return;}
   for(let end;(end=buffer.indexOf('\n'))>=0;){
    const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line.trim())continue;
    try{
     const reply=JSON.parse(line);
     if(reply.event==='stop'){this.stop('user');return;}
     if(!Number.isSafeInteger(reply.id)||typeof reply.ok!=='boolean')throw new Error('helper 응답 형식 오류');
     const pending=this.pending.get(reply.id);if(!pending)continue;this.pending.delete(reply.id);clearTimeout(pending.timer);
     if(reply.ok)pending.resolve(reply.result);else pending.reject(new Error(String(reply.error||'helper 오류')));
    }catch(error){failed(error as Error);return;}
   }
  });return child;
 }
 private request(op:string,args:Record<string,unknown>={}):Promise<any>{
  const child=this.spawn(),id=++this.sequence;
  const {promise,resolve,reject}=Promise.withResolvers<any>();
  const timer=setTimeout(()=>this.stop('crash','컴퓨터 helper 응답 시간 초과'),op==='screenshot'?30000:15000);
  this.pending.set(id,{resolve,reject,timer});
  child.stdin.write(JSON.stringify({...args,id,op})+'\n',error=>{if(error&&this.child===child)this.stop('crash',error.message);});
  return promise;
 }
 async setEnabled(on:boolean){
  if(!on){this.deps.data.state.settings.computer.enabled=false;this.deps.data.save();this.stop('user');this.deps.changed();return;}
  const generation=this.generation;await this.permissions();if(generation!==this.generation)throw new Error('컴퓨터 제어가 중지되었습니다.');
  this.deps.data.state.settings.computer.enabled=true;this.deps.data.save();this.deps.changed();
 }
 async runningApps():Promise<RunningApp[]>{return this.request('apps');}
 async allow(app:string){
  app=textArg(app,200);if(this.status().apps.includes(app))return;
  const candidate=(await this.runningApps()).find(item=>item.id===app);if(!candidate)throw new Error('실행 중인 앱을 선택하세요.');
  const generation=this.generation;
  if(!await this.deps.confirm('이 앱의 컴퓨터 제어를 허용할까요?',`${candidate.name}\n${app}\n화면 읽기 및 마우스·키보드 제어`))throw new Error('사용자가 앱 허용을 거절했습니다.');
  if(generation!==this.generation)throw new Error('컴퓨터 제어가 중지되었습니다.');
  const apps=this.deps.data.state.settings.computer.apps;if(!apps.includes(app))apps.push(app);this.deps.data.save();this.deps.changed();
 }
 disallow(app:string){app=textArg(app,200);this.deps.data.state.settings.computer.apps=this.status().apps.filter(id=>id!==app);this.deps.data.save();this.stop('user');this.deps.changed();}
 async permissions():Promise<Permissions>{
  const result=await this.request('permissions');if(typeof result?.screen!=='boolean'||typeof result?.accessibility!=='boolean')throw new Error('helper 권한 응답 오류');
  this.permissionState={screen:result.screen,accessibility:result.accessibility};this.deps.changed();return {...this.permissionState};
 }
 async requestPermission(kind:'screen'|'accessibility'){
  if(kind!=='screen'&&kind!=='accessibility')throw new Error('권한 종류가 올바르지 않습니다.');
  await this.request('request_permission',{kind});await this.permissions();
 }
 async begin(taskId:string):Promise<void>{
  if(!this.status().enabled)throw new Error('컴퓨터 제어가 꺼져 있습니다.');
  if(!this.status().apps.length)throw new Error('허용된 앱이 없습니다.');
  if(this.taskId&&this.taskId!==taskId)throw new Error('다른 작업에서 컴퓨터를 제어 중입니다.');
  if(this.ready)return;if(this.starting)return this.starting;
  this.taskId=taskId;const generation=this.generation;
  const start=(async()=>{
   try{
    if(!globalShortcut.register(shortcut,()=>this.stop('hotkey')))throw new Error('전역 중지 단축키를 등록할 수 없습니다.');
    await this.request('indicator',{on:true,text:process.platform==='darwin'?'Heisen 제어 중 · ⌘⇧Esc 중지':'Heisen 제어 중 · Ctrl+Shift+Esc 중지'});
    if(generation!==this.generation)throw new Error('컴퓨터 제어가 중지되었습니다.');
    this.ready=true;this.deps.changed();
   }catch(error){if(generation===this.generation)this.stop('crash',(error as Error).message);throw error;}
  })();this.starting=start;
  try{await start;}finally{if(this.starting===start)this.starting=undefined;}
 }
 async act(taskId:string,op:ComputerOp,args:Record<string,unknown>):Promise<unknown>{
  let app:string|undefined;let locked=false;
  try{
   if(this.busy)throw new Error('컴퓨터 동작이 이미 실행 중입니다.');this.busy=true;locked=true;
   await this.begin(taskId);const generation=this.generation;
   const check=()=>{if(generation!==this.generation||!this.ready||!this.owns(taskId)||!this.status().enabled)throw new Error('컴퓨터 제어가 중지되었습니다.');};
   const apps=this.status().apps;const permissions=await this.permissions();check();
   if(!permissions.accessibility||(op==='screenshot'&&!permissions.screen))throw new Error('시스템 설정에서 화면 기록/손쉬운 사용을 허용하세요.');
   let input:Record<string,unknown>={};
   if(op==='screenshot')input={maxWidth:1280};
   else if(op==='ui_tree'){
    if(args.app!==undefined){app=textArg(args.app,200);if(!apps.includes(app))throw new Error('허용되지 않은 앱입니다: '+app);input.app=app;}
    const depth=args.depth??6;if(!Number.isInteger(depth)||Number(depth)<0||Number(depth)>20)throw new Error('트리 깊이가 올바르지 않습니다.');input={...input,depth,maxNodes:400};
   }else{
    const focused=await this.request('focused');check();app=focused?.app?.id;
    if(!app||!apps.includes(app))throw new Error('허용되지 않은 앱입니다: '+(focused?.app?.name||app||''));
    if(op==='type'){
     if(focused.element?.secure!==false)throw new Error('secure_field: 보안 입력 필드에는 입력할 수 없습니다.');
     input={text:textArg(args.text,10000)};
    }else if(op==='key'){
     if(!Array.isArray(args.keys)||!args.keys.length||args.keys.length>5||args.keys.some(key=>typeof key!=='string'||! /^(cmd|ctrl|alt|shift|win|[a-z0-9]|enter|tab|escape|space|backspace|delete|up|down|left|right|f(?:[1-9]|1[0-2])|home|end|pageup|pagedown)$/i.test(key)))throw new Error('키 조합이 올바르지 않습니다.');
     const keys=args.keys.map(key=>key.toLowerCase());if(new Set(keys).size!==keys.length)throw new Error('키 조합이 올바르지 않습니다.');
     if(focused.element?.secure!==false&&!(keys.length===1&&['enter','tab','escape'].includes(keys[0])))throw new Error('secure_field: 보안 입력 필드에는 입력할 수 없습니다.');
     if((sensitiveKeys[[...keys].sort().join('+')]||keys.includes('win'))&&!await this.deps.confirm(keys.join('+')+'를 누를까요?',focused.app.name))throw new Error('사용자가 키 입력을 거절했습니다.');
     check();input={keys};
    }else if(op==='click'||op==='scroll'){
     const image=this.image;if(!image)throw new Error('먼저 스크린샷을 확인하세요.');
     const {x,y}=args;if(typeof x!=='number'||typeof y!=='number'||!Number.isFinite(x)||!Number.isFinite(y)||x<0||y<0||x>=image.width||y>=image.height)throw new Error('스크린샷 좌표가 올바르지 않습니다.');
     input={x:x/image.scale+image.origin.x,y:y/image.scale+image.origin.y};
     if(op==='click'){const button=args.button??'left',count=args.count??1;if(!['left','right'].includes(String(button))||![1,2].includes(Number(count))||typeof count!=='number')throw new Error('클릭 인수가 올바르지 않습니다.');input={...input,button,count};}
     else{const dx=args.dx??0,dy=args.dy;if(!Number.isInteger(dx)||!Number.isInteger(dy)||Math.abs(Number(dx))>100000||Math.abs(Number(dy))>100000)throw new Error('스크롤 인수가 올바르지 않습니다.');input={...input,dx,dy};}
    }else throw new Error('허용되지 않은 도구입니다.');
   }
   check();this.log(taskId,op+'_requested',args,true,undefined,app);
   const result=await this.request(op,{...input,apps});check();
   if(op==='screenshot'){
    const shot=result as Screenshot;if(typeof shot?.png!=='string'||!shot.png||![shot.width,shot.height,shot.scale,shot.origin?.x,shot.origin?.y].every(Number.isFinite)||shot.width<=0||shot.height<=0||shot.scale<=0)throw new Error('스크린샷 응답이 올바르지 않습니다.');
    this.image=shot;
   }else if(op!=='ui_tree')this.image=undefined;
   this.log(taskId,op,args,true,undefined,app);return result;
  }catch(error){this.log(taskId,op,args,false,(error as Error).message,app);throw error;}
  finally{if(locked)this.busy=false;}
 }
 stop(reason:'user'|'hotkey'|'task'|'quit'|'crash',error?:string){
  const taskId=this.taskId,child=this.child;this.generation++;this.taskId=undefined;this.ready=false;this.starting=undefined;this.image=undefined;this.child=undefined;
  globalShortcut.unregister(shortcut);
  // Kill immediately: a graceful quit could sit behind queued keystrokes.
  if(child)child.kill('SIGKILL');
  for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(new Error(error||'컴퓨터 제어가 중지되었습니다.'));}this.pending.clear();
  try{if(child||taskId)this.log(taskId,'stop',{reason},!error,error);}finally{this.deps.changed();this.onStop?.(reason,taskId);}
 }
}
