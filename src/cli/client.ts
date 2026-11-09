import {EventEmitter} from 'node:events';
import {closeSync,constants,fstatSync,lstatSync,openSync,readFileSync,type Stats} from 'node:fs';
import {join,resolve as resolvePath} from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import type {Readable,Writable} from 'node:stream';
import {CONTROL_VERSION,LineDecoder,encodeLine,type HelloResult,type Json,type Notification,type Response} from '../control-protocol.ts';
import {controlSocketPath,dataRoot} from '../platform.ts';

declare const __HEISEN_VERSION__:string;
export const CLI_VERSION=typeof __HEISEN_VERSION__==='string'?__HEISEN_VERSION__:'dev';
export type ClientOptions={profile?:string;socket?:string;host?:string;timeoutMs?:number;pageJs?:boolean};
export class CliError extends Error{
 constructor(public exitCode:number,message:string,public rpcCode?:number){super(message);this.name='CliError';}
}
const unavailable='Heisen이 실행 중이 아니거나 CLI 소켓이 꺼져 있습니다.';
function localCredentials(options:ClientOptions):{token:string;endpoint:string}{
 const profile=resolvePath(options.profile??dataRoot()),endpoint=controlSocketPath(profile);
 if(options.socket&&(process.platform==='win32'?options.socket.toLowerCase()!==endpoint.toLowerCase():resolvePath(options.socket)!==endpoint))throw new CliError(64,'--socket은 선택한 프로필의 제어 소켓이어야 합니다.');
 let fd:number|undefined;
 try{
  const dir=join(profile,'run'),file=join(dir,'heisen.token'),directory=lstatSync(dir),tokenStat=lstatSync(file);
  const privateOwner=(stat:Stats)=>process.getuid!==undefined&&stat.uid===process.getuid()&&(stat.mode&0o077)===0;
  if(!directory.isDirectory()||!tokenStat.isFile())throw new Error('Unsafe control files');
  if(process.platform!=='win32'){
   const socketStat=lstatSync(endpoint);
   if(!privateOwner(directory)||!privateOwner(tokenStat)||!socketStat.isSocket()||!privateOwner(socketStat))throw new Error('Unsafe control ownership or modes');
  }
  // Node cannot inspect named-pipe peer ownership or Windows ACLs. Windows relies
  // on the profile's inherited private user ACL; never use a shared profile.
  // A profile-specific pipe prevents collisions, but cannot authenticate its owner.
  fd=openSync(file,constants.O_RDONLY|(process.platform==='win32'?0:constants.O_NOFOLLOW));
  const opened=fstatSync(fd);if(opened.dev!==tokenStat.dev||opened.ino!==tokenStat.ino)throw new Error('Control token changed');
  const token=readFileSync(fd,'utf8').trim();if(token)return {token,endpoint};
 }catch{}finally{if(fd!==undefined)closeSync(fd);}
 throw new CliError(4,unavailable);
}
function timeoutFor(options:ClientOptions):number{
 const timeout=options.timeoutMs??120000;
 if(!Number.isFinite(timeout)||timeout<1||timeout>2147483647)throw new CliError(64,'제한 시간은 0초 초과, 2147483.647초 이하여야 합니다.');
 return timeout;
}
async function localSocket(endpoint:string,options:ClientOptions):Promise<net.Socket>{
 return new Promise((resolve,reject)=>{
  const socket=net.connect(endpoint);
  const timer=setTimeout(()=>fail(new CliError(4,'Heisen 연결 시간이 초과되었습니다.')),timeoutFor(options));
  const fail=(error:Error)=>{clearTimeout(timer);socket.destroy();reject(error instanceof CliError?error:new CliError(4,unavailable));};
  socket.once('error',fail);
  socket.once('connect',()=>{clearTimeout(timer);socket.removeListener('error',fail);resolve(socket);});
 });
}

type Pending={resolve:(value:unknown)=>void;reject:(error:Error)=>void;timer:NodeJS.Timeout};
export class ControlClient extends EventEmitter<{notification:[notification:Notification];close:[]}>{
 hello!:HelloResult;
 private nextId=0;
 private pending=new Map<number,Pending>();
 private stopped=false;
 private constructor(private input:Readable,private output:Writable,private stop:()=>void,private timeoutMs:number){
  super();
  const decoder=new LineDecoder();
  input.on('data',chunk=>decoder.push(chunk));
  input.once('end',()=>this.fail(new CliError(4,'Heisen 연결이 종료되었습니다.')));
  input.once('close',()=>this.fail(new CliError(4,'Heisen 연결이 종료되었습니다.')));
  input.on('error',()=>this.fail(new CliError(4,'Heisen 연결에 실패했습니다.')));
  if((output as unknown)!==input)output.on('error',()=>this.fail(new CliError(4,'Heisen 연결에 실패했습니다.')));
  decoder.on('error',()=>this.fail(new CliError(4,'Heisen 응답 형식이 올바르지 않습니다.')));
  decoder.on('message',value=>this.receive(value));
 }
 static async connect(options:ClientOptions={}):Promise<ControlClient>{
  const timeout=timeoutFor(options);
  let client:ControlClient,token='';
  if(options.host){
   if(options.host.startsWith('-')||/[\s\x00-\x1f]/.test(options.host))throw new CliError(64,'SSH 호스트가 올바르지 않습니다.');
   if(options.profile||options.socket)throw new CliError(64,'--host는 --profile 또는 --socket과 함께 사용할 수 없습니다.');
   const child=spawn('ssh',['-T',options.host,'heisen','--stdio'],{stdio:['pipe','pipe','pipe']});
   client=new ControlClient(child.stdout,child.stdin,()=>{child.stdin.destroy();child.stdout.destroy();child.stderr.destroy();child.kill();},timeout);
   // SSH owns authentication prompts and diagnostics; protocol output stays on stdout.
   child.stderr.on('data',chunk=>process.stderr.write(chunk));
   child.once('error',()=>client.fail(new CliError(4,'SSH를 실행할 수 없습니다.')));
   child.once('close',code=>client.fail(new CliError(4,`원격 Heisen 연결이 종료되었습니다.${code===null?'':` (SSH ${code})`}`)));
  }else{
   const credentials=localCredentials(options);token=credentials.token;
   const socket=await localSocket(credentials.endpoint,options);
   client=new ControlClient(socket,socket,()=>socket.destroy(),timeout);
  }
  try{
   const hello=await client.call<HelloResult>('hello',{token,client:{name:'heisen-cli',version:CLI_VERSION},capabilities:options.pageJs?['page-js']:[]});
   if(!hello||hello.protocol!==CONTROL_VERSION||typeof hello.app?.version!=='string'||typeof hello.app?.chromium!=='string'||typeof hello.profile!=='string'||typeof hello.pageScripts!=='boolean'||typeof hello.computer!=='boolean')throw new CliError(4,'Heisen 제어 프로토콜 버전이 맞지 않습니다.');
   client.hello=hello;return client;
  }catch(error){client.close();if(error instanceof CliError&&error.exitCode===1)throw new CliError(4,error.message,error.rpcCode);throw error;}
 }
 call<T=Json>(method:string,params?:Json):Promise<T>{
  if(this.stopped)return Promise.reject(new CliError(4,'Heisen 연결이 종료되었습니다.'));
  const id=++this.nextId;
  let line:string;
  try{line=encodeLine({jsonrpc:'2.0',id,method,...params===undefined?{}:{params}});}catch{return Promise.reject(new CliError(64,'요청이 너무 크거나 JSON 형식이 아닙니다.'));}
  return new Promise<T>((resolve,reject)=>{
   const timer=setTimeout(()=>{this.pending.delete(id);reject(new CliError(1,'요청 시간이 초과되었습니다.'));},this.timeoutMs);
   this.pending.set(id,{resolve:value=>resolve(value as T),reject,timer});
   this.output.write(line,error=>{if(error)this.fail(new CliError(4,'Heisen에 요청을 보낼 수 없습니다.'));});
  });
 }
 private receive(value:object):void{
  if(this.stopped)return;
  const message=value as Partial<Response&Notification>;
  if(message.jsonrpc!=='2.0'){this.fail(new CliError(4,'Heisen 응답 형식이 올바르지 않습니다.'));return;}
  if(!('id' in message)){
   if(typeof message.method==='string')this.emit('notification',message as Notification);
   return;
  }
  if(typeof message.id!=='number')return;
  const pending=this.pending.get(message.id);if(!pending)return;
  this.pending.delete(message.id);clearTimeout(pending.timer);
  if(message.error&&typeof message.error.code==='number'&&typeof message.error.message==='string'){
   const {code,message:text}=message.error;
   pending.reject(new CliError(code===-32000?4:code===-32602?64:1,text,code));
  }else if('result' in message&&!('error' in message))pending.resolve(message.result);
  else pending.reject(new CliError(4,'Heisen 응답 형식이 올바르지 않습니다.'));
 }
 private fail(error:CliError):void{
  if(this.stopped)return;
  this.stopped=true;
  for(const pending of this.pending.values()){clearTimeout(pending.timer);pending.reject(error);}
  this.pending.clear();this.stop();this.emit('close');
 }
 close():void{this.fail(new CliError(4,'Heisen 연결이 종료되었습니다.'));}
}

// The SSH endpoint substitutes its own token; it never sends that token to the caller.
export async function runStdioBridge(options:ClientOptions={}):Promise<void>{
 if(options.host)throw new CliError(64,'--stdio는 로컬 연결에서만 사용할 수 있습니다.');
 timeoutFor(options);
 const {token,endpoint}=localCredentials(options),socket=await localSocket(endpoint,options);
 await new Promise<void>((resolve,reject)=>{
  const decoder=new LineDecoder();let first=true,finished=false;
  const timer=setTimeout(()=>finish(new CliError(4,'인증 요청 시간이 초과되었습니다.')),3000);
  const finish=(error?:Error)=>{
   if(finished)return;finished=true;clearTimeout(timer);
   process.stdin.off('data',onData);process.stdin.off('end',onEnd);process.stdin.off('error',onError);process.stdin.pause();
   process.stdout.off('error',onError);process.stdout.off('drain',onOutputDrain);
   socket.destroy();error?reject(error):resolve();
  };
  const onData=(chunk:Buffer)=>decoder.push(chunk);
  const onEnd=()=>socket.end();
  const onError=()=>finish(new CliError(4,'표준 입출력 연결이 종료되었습니다.'));
  const onOutputDrain=()=>socket.resume();
  decoder.on('error',()=>finish(new CliError(64,'JSON 요청 형식이 올바르지 않습니다.')));
  decoder.on('message',value=>{
   if(finished)return;
   const message=value as {method?:unknown;params?:unknown};
   if(first){
    if(message.method!=='hello'||!message.params||typeof message.params!=='object'||Array.isArray(message.params)){finish(new CliError(4,'첫 요청은 hello여야 합니다.'));return;}
    message.params={...message.params,token};first=false;clearTimeout(timer);
   }
   try{if(!socket.write(encodeLine(message)))process.stdin.pause();}catch{finish(new CliError(64,'요청이 너무 큽니다.'));}
  });
  socket.on('data',chunk=>{if(!process.stdout.write(chunk))socket.pause();});
  socket.on('drain',()=>process.stdin.resume());
  socket.once('error',()=>finish(new CliError(4,'Heisen 연결에 실패했습니다.')));
  socket.once('end',()=>finish());socket.once('close',()=>finish());
  process.stdout.on('drain',onOutputDrain);process.stdout.on('error',onError);
  process.stdin.on('data',onData);process.stdin.once('end',onEnd);process.stdin.on('error',onError);process.stdin.resume();
 });
}
