import type {Readable,Writable} from 'node:stream';
import {LineDecoder,encodeLine,type Json} from '../control-protocol.ts';
import {CliError,type ControlClient} from './client.ts';
import type {CommandContext} from './main.ts';

const protocols=['2025-06-18','2025-03-26','2024-11-05'];
const evaluateTool={name:'page_evaluate',description:'Evaluate JavaScript in a user tab. Requires the CLI flag and app page-script setting.',inputSchema:{type:'object',properties:{tabId:{type:'integer',minimum:1},expression:{type:'string',maxLength:100000}},required:['tabId','expression'],additionalProperties:false}};
function record(value:unknown):value is Record<string,Json>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}

// Pure transport adapter: all browser authority and approvals stay at the control socket.
export async function serveMcp(client:ControlClient,options:{input?:Readable;output?:Writable;pageJs?:boolean}={}):Promise<void>{
 const input=options.input??process.stdin,output=options.output??process.stdout;
 const pageJs=options.pageJs===true&&client.hello.pageScripts,decoder=new LineDecoder();
 const completion=Promise.withResolvers<void>();
 let queue=Promise.resolve(),finished=false;
 const finish=(error?:Error)=>{
  if(finished)return;finished=true;
  input.off('data',onData);input.off('end',onEnd);input.off('close',onEnd);input.off('error',onError);input.pause();
  output.off('error',onError);client.off('close',onClose);
  if(error)completion.reject(error);else completion.resolve();
 };
 const send=async(value:unknown)=>{
  if(finished)return;
  const sent=Promise.withResolvers<void>();
  output.write(encodeLine(value),error=>error?sent.reject(error):sent.resolve());
  await sent.promise;
 };
 const dispatch=async(message:Record<string,unknown>)=>{
  const id=typeof message.id==='string'||typeof message.id==='number'&&Number.isFinite(message.id)?message.id:null;
  if(message.jsonrpc!=='2.0'||typeof message.method!=='string'||('id' in message&&id===null)){
   await send({jsonrpc:'2.0',id,error:{code:-32600,message:'Invalid request'}});return;
  }
  if(!('id' in message)||message.method.startsWith('notifications/'))return;
  try{
   if(message.params!==undefined&&!record(message.params))throw new CliError(64,'params must be an object',-32602);
   const params=message.params as Record<string,Json>|undefined;
   let result:unknown;
   switch(message.method){
    case 'initialize':result={protocolVersion:typeof params?.protocolVersion==='string'&&protocols.includes(params.protocolVersion)?params.protocolVersion:protocols[0],capabilities:{tools:{}},serverInfo:{name:'heisen',version:client.hello.app.version}};break;
    case 'ping':result={};break;
    case 'tools/list':{
     const catalogue=await client.call<{tools:Json[]}>('tools.list');
     result=pageJs?{...catalogue,tools:[...catalogue.tools,evaluateTool]}:catalogue;break;
    }
    case 'tools/call':{
     if(typeof params?.name!=='string'||(params.arguments!==undefined&&!record(params.arguments)))throw new CliError(64,'name and arguments are invalid',-32602);
     if(params.name==='page_evaluate'){
      if(!pageJs)throw new CliError(1,'페이지 스크립트가 꺼져 있습니다.',-32002);
      const args=params.arguments;
      if(!record(args)||typeof args.tabId!=='number'||!Number.isSafeInteger(args.tabId)||args.tabId<1||typeof args.expression!=='string'||args.expression.length>100000||Object.keys(args).some(key=>key!=='tabId'&&key!=='expression'))throw new CliError(64,'Invalid page_evaluate arguments',-32602);
      const value=await client.call('page.evaluate',args);
      result={content:[{type:'text',text:JSON.stringify(value)}]};
     }else result=await client.call('tools.call',{name:params.name,arguments:params.arguments??{}});
     break;
    }
    default:throw new CliError(1,'Method not found',-32601);
   }
   await send({jsonrpc:'2.0',id,result});
  }catch(error){
   await send({jsonrpc:'2.0',id,error:{code:error instanceof CliError?error.rpcCode??-32603:-32603,message:error instanceof Error?error.message:String(error)}});
  }
 };
 const enqueue=(work:()=>Promise<void>)=>{
  input.pause();
  queue=queue.then(()=>finished?undefined:work()).then(()=>{if(!finished)input.resume();}).catch(error=>finish(error));
 };
 const onData=(chunk:Buffer|string)=>decoder.push(chunk);
 const onEnd=()=>{void queue.then(()=>finish());};
 const onError=(error:Error)=>finish(error);
 const onClose=()=>finish(new CliError(4,'Heisen 연결이 종료되었습니다.'));
 decoder.on('message',message=>enqueue(()=>dispatch(message as Record<string,unknown>)));
 decoder.on('error',error=>enqueue(async()=>{
  const oversized=error.message==='Line exceeds size limit';
  await send({jsonrpc:'2.0',id:null,error:{code:oversized||error.message==='Expected object'?-32600:-32700,message:error.message}});
  if(oversized)finish();
 }));
 input.on('data',onData);input.once('end',onEnd);input.once('close',onEnd);input.on('error',onError);
 output.on('error',onError);client.once('close',onClose);input.resume();
 if(input.readableEnded)onEnd();
 await completion.promise;
}

export async function runMcp(context:CommandContext):Promise<number>{
 context.allowOptions();
 if(context.args.length)throw new CliError(64,'mcp에는 추가 인수를 지정할 수 없습니다.');
 await serveMcp(await context.connect(),{pageJs:context.options.pageJs});return 0;
}
