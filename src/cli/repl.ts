/// <reference lib="es2024.promise" />
import {createScriptContext} from '../script-api.ts';
import repl from 'node:repl';
import {inspect} from 'node:util';
import {readFile,mkdir,open,chmod,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {dataRoot} from '../platform.ts';
import {Transform,type Readable,type Writable} from 'node:stream';
import {CliError,type ControlClient} from './client.ts';
import type {CommandContext} from './main.ts';
import type {Json,ToolResult} from '../control-protocol.ts';

type ReplOptions={pageJs?:boolean;stdout?:Writable;stderr?:Writable};
export type ReplRuntime={run:(code:string,filename?:string)=>Promise<unknown>;evaluate:(code:string,filename?:string)=>Promise<unknown>};

export async function createReplRuntime(client:ControlClient,options:ReplOptions={}):Promise<ReplRuntime>{
 const stdout=options.stdout??process.stdout,stderr=options.stderr??process.stderr;
 const pageJs=options.pageJs===true&&client.hello.pageScripts;
 const initial=await client.call<ToolResult>('tools.call',{name:'list_tabs',arguments:{}});
 const initialText=initial.content.filter(item=>item.type==='text').map(item=>item.text).join('\n');
 if(initial.isError)throw new CliError(1,initialText);
 const tabs=JSON.parse(initialText) as {tabId:number;active:boolean}[];
 const bridge=async(raw:string):Promise<string>=>{
  try{
   const {method,params}=JSON.parse(raw) as {method:string;params?:Record<string,Json>};
   let value:unknown;
   switch(method){
    case 'console.log':case 'console.error':
     (method==='console.log'?stdout:stderr).write(String(params?.text??'')+'\n');break;
    case 'sleep':{
     const ms=params?.ms;
     if(typeof ms!=='number'||!Number.isFinite(ms)||ms<0||ms>2147483647)throw new Error('sleep 시간은 0~2147483647ms여야 합니다.');
     await sleep(ms);break;
    }
    case 'screenshot':{
     const result=await client.call<ToolResult>('tools.call',{name:'screenshot',arguments:{tabId:params!.tabId}});
     if(result.isError)throw new Error(result.content.filter(item=>item.type==='text').map(item=>item.text).join('\n'));
     const image=result.content.find(item=>item.type==='image'&&item.mimeType==='image/png');
     if(!image||image.type!=='image')throw new Error('PNG 스크린샷이 없습니다.');
     const bytes=Buffer.from(image.data,'base64');
     if(params!.file!==undefined){
      if(typeof params!.file!=='string'||!params!.file)throw new Error('스크린샷 파일 경로가 필요합니다.');
      await writeFile(params!.file,bytes,{mode:0o600});value=params!.file;
     }else value=Array.from(bytes);
     break;
    }
    case 'page.evaluate':
     if(!pageJs)throw new Error('페이지 스크립트가 꺼져 있습니다.');
     value=await client.call(method,params);break;
    default:value=await client.call(method,params);
   }
   return JSON.stringify({value});
  }catch(error){return JSON.stringify({error:error instanceof Error?error.message:String(error)});}
 };
 return createScriptContext(bridge,tabs.find(tab=>tab.active)?.tabId,{tasks:true,memory:true,skills:true,pageJs,screenshot:true});
}

export async function startInteractive(runtime:ReplRuntime,options:{input?:Readable;output?:Writable;historyFile:string;terminal?:boolean}):Promise<void>{
 const file=await open(options.historyFile,'a',0o600);await file.close();await chmod(options.historyFile,0o600);
 let history=(await readFile(options.historyFile,'utf8')).split('\n').filter(Boolean);
 const input=options.input??process.stdin;
 let pending=Promise.resolve(),closed=false;
 // readline.pause() does not stop lines already decoded from a pasted chunk.
 // Feed one submitted line at a time so async evaluation and '_' stay ordered.
 const feed=new Transform({transform(chunk:Buffer,_encoding,callback){
  void (async()=>{
   let start=0;
   for(let end=0;end<chunk.length&&!closed;end++){
    if(chunk[end]!==10&&chunk[end]!==13)continue;
    this.push(chunk.subarray(start,end+1));start=end+1;await pending;
   }
   if(start<chunk.length&&!closed)this.push(chunk.subarray(start));
  })().then(()=>callback(),callback);
 }});
 const terminalInput=input as Readable&{isTTY?:boolean;setRawMode?:(enabled:boolean)=>void};
 Object.assign(feed,{isTTY:terminalInput.isTTY,setRawMode:(enabled:boolean)=>terminalInput.setRawMode?.(enabled)});
 const server=repl.start({prompt:'heisen> ',input:feed,output:options.output??process.stdout,terminal:options.terminal??process.stdin.isTTY,useGlobal:false,
  writer:value=>inspect(value,{depth:4}),
  eval:(code,_context,filename,callback)=>{
   try{pending=runtime.evaluate(code,filename).then(value=>callback(null,value),error=>callback(new Error(error?.stack??String(error)),undefined));}
   catch(error){
    const e=error as Error;
    callback(/Unexpected end of input|Unexpected token '[)}]'/.test(e.message)?new repl.Recoverable(e):e,undefined);
   }
  }
 });
 const ended=Promise.withResolvers<void>();server.once('exit',()=>{closed=true;ended.resolve();});
 // Keep persistence explicit: REPL setupHistory debounces writes beyond 'exit'.
 // The readline history event supplies its current newest-first command list.
 Object.assign(server,{history});
 server.on('history',lines=>{history=lines;});
 try{
  input.pipe(feed);await ended.promise;await pending;
  await writeFile(options.historyFile,history.join('\n'),{mode:0o600});
 }finally{closed=true;input.unpipe(feed);input.pause();server.close();feed.destroy();}
}

export async function runRepl(context:CommandContext):Promise<number>{
 context.allowOptions('eval');
 if(context.args.length>1||(context.values.eval!==undefined&&context.args.length))throw new CliError(64,'repl [-e <코드>] [파일] 중 하나를 지정하세요.');
 const client=await context.connect(),runtime=await createReplRuntime(client,{pageJs:context.options.pageJs});
 const file=context.args[0];
 if(context.values.eval!==undefined||file){
  try{
   const value=await runtime.run(context.values.eval??await readFile(file,'utf8'),file??'heisen:-e');
   if(value!==undefined)context.print(value);return 0;
  }catch(error){console.error((error as Error)?.stack??String(error));return 1;}
 }
 const directory=join(context.options.profile??(context.options.host?dataRoot():client.hello.profile),'run');
 await mkdir(directory,{recursive:true,mode:0o700});
 await startInteractive(runtime,{historyFile:join(directory,'repl_history')});return 0;
}
