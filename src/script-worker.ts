/// <reference lib="es2024.promise" />
// web_run worker: model-written code runs in QuickJS compiled to WASM, a realm with no Node, Electron or host objects.
// Its only host capability is the string-in/string-out bridge; results and errors leave as strings.
import {parentPort,workerData} from 'node:worker_threads';
import {newQuickJSWASMModuleFromVariant,type QuickJSDeferredPromise,type QuickJSHandle} from 'quickjs-emscripten-core';

const port=parentPort!;
const {bootstrap,code,initialTab,features}=workerData as {bootstrap:string;code:string;initialTab?:number;features:object};
let nextId=0;
const replies=new Map<number,(raw:string)=>void>();
port.on('message',message=>{
 if(message.type==='reply'){const resolve=replies.get(message.id);if(resolve){replies.delete(message.id);resolve(message.raw);}}
});
const host=async(raw:string):Promise<string>=>{
 try{
  const {method,params}=JSON.parse(raw);
  if(method==='console.log'||method==='console.error'){
   port.postMessage({type:'log',stream:method,text:String(params.text).slice(0,2000)});return '{}';
  }
  if(method==='sleep'){
   const ms=params.ms;
   if(typeof ms!=='number'||!Number.isFinite(ms)||ms<0||ms>2147483647)throw new Error('sleep 시간은 0~2147483647ms여야 합니다.');
   const {promise,resolve}=Promise.withResolvers();setTimeout(resolve,ms);await promise;return '{}';
  }
  const {promise,resolve}=Promise.withResolvers<string>(),id=++nextId;
  replies.set(id,resolve);port.postMessage({type:'call',id,raw});return await promise;
 }catch(error){return JSON.stringify({error:error instanceof Error?error.message:String(error)});}
};
const hostError=(error:unknown)=>({type:'error',message:String((error as Error)?.message??error),stack:typeof (error as Error)?.stack==='string'?(error as Error).stack:undefined});

async function main(){
 const runtime=(await newQuickJSWASMModuleFromVariant(import('@jitl/quickjs-singlefile-cjs-release-sync'))).newRuntime();
 // QuickJS reports its stack overflow before the worker's 16MB native stack overflows (parser recursion included).
 runtime.setMemoryLimit(256*1024*1024);runtime.setMaxStackSize(256*1024);
 const context=runtime.newContext(),deferreds=new Set<QuickJSDeferredPromise>(),handles:QuickJSHandle[]=[];
 let script:QuickJSHandle|undefined,done=false;
 const settle=(message:object,clean:boolean)=>{
  if(done)return;done=true;port.postMessage(message);
  // A host exception may have unwound through WASM mid-operation; then leave the instance to worker.terminate().
  if(clean)try{for(const deferred of deferreds)deferred.dispose();for(const handle of [script,...handles])if(handle?.alive)handle.dispose();context.dispose();runtime.dispose();}catch{}
 };
 const realmError=(handle:QuickJSHandle)=>{
  let error:any;
  try{error=context.dump(handle);}catch{error='스크립트 오류를 읽을 수 없습니다.';}
  if(handle.alive)handle.dispose();
  return {type:'error',message:String(error?.message??error),stack:typeof error?.stack==='string'?error.stack:undefined};
 };
 const json=context.getProp(context.global,'JSON'),stringify=context.getProp(json,'stringify');json.dispose();handles.push(stringify);
 const pump=()=>{
  if(done||!script)return;
  const jobs=runtime.executePendingJobs();
  if(jobs.error){settle(realmError(jobs.error),true);return;}
  const state=context.getPromiseState(script);
  if(state.type==='pending')return;
  if(state.type==='rejected'){settle(realmError(state.error),true);return;}
  // Serialize inside QuickJS with the intrinsic captured before user code ran; only a string crosses out.
  const box=context.newObject();context.setProp(box,'value',state.value);
  if(state.value!==script)state.value.dispose();
  const result=context.callFunction(stringify,context.undefined,box);box.dispose();
  if(result.error){settle(realmError(result.error),true);return;}
  const text=context.typeof(result.value)==='string'?context.getString(result.value):undefined;result.value.dispose();
  settle(text===undefined?{type:'error',message:'스크립트 결과를 JSON으로 변환할 수 없습니다.'}:{type:'done',value:text},true);
 };
 const bridge=context.newFunction('bridge',raw=>{
  const deferred=context.newPromise();deferreds.add(deferred);
  void host(context.typeof(raw)==='string'?context.getString(raw):'').then(reply=>{
   if(done)return;
   deferreds.delete(deferred);
   const value=context.newString(reply);deferred.resolve(value);value.dispose();deferred.dispose();pump();
  }).catch(error=>settle(hostError(error),false));
  return deferred.handle;
 });
 handles.push(bridge);
 // The bridge exists only in the bootstrap closure, never on the QuickJS global object.
 const initialize=context.unwrapResult(context.evalCode(bootstrap,'heisen:api'));handles.push(initialize);
 const tab=initialTab===undefined?context.undefined:context.newNumber(initialTab);handles.push(tab);
 const flags=context.unwrapResult(context.evalCode('('+JSON.stringify(features)+')','heisen:features'));handles.push(flags);
 context.unwrapResult(context.callFunction(initialize,context.undefined,bridge,tab,flags)).dispose();
 const evaluated=context.evalCode('(async()=>{'+code+'\n})()','heisen:script');
 if(evaluated.error)settle(realmError(evaluated.error),true);
 else{script=evaluated.value;pump();}
}
main().catch(error=>port.postMessage(hostError(error)));
