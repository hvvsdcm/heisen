/// <reference lib="es2024.promise" />
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {Worker} from 'node:worker_threads';

export type Bridge=(raw:string)=>Promise<string>;
export type Features={tasks:boolean;memory:boolean;skills:boolean;pageJs:boolean;screenshot:boolean};
export type ScriptContext={run:(code:string,filename?:string)=>Promise<unknown>;evaluate:(code:string,filename?:string)=>Promise<unknown>};
// The CLI REPL runs the user's own code in node:vm: scope isolation, NOT a security boundary.
// web_run runs model-written code in script-worker.ts: QuickJS/WASM inside a Worker, a realm
// with no host objects whose only capability is the string bridge. In both realms the
// authenticated control socket, app-side tool catalogue and native approvals remain the authority
// for browser access. Never inject host functions, promises, errors or Buffer objects into the
// public API: wrappers and returned values are created in the script realm over a private JSON bridge.
// SCRIPT_BOOTSTRAP must run unchanged in both node:vm and QuickJS.
export const SCRIPT_BOOTSTRAP=String.raw`((bridge,initialTab,features)=>{
 const parse=JSON.parse, stringify=JSON.stringify, freeze=Object.freeze;
 const ErrorType=Error, Bytes=Uint8Array;
 const call=async(method,params)=>{
  const reply=parse(await bridge(stringify({method,params})));
  if(reply.error)throw new ErrorType(reply.error);
  return reply.value;
 };
 const frozen=value=>{
  for(const item of Object.values(value))if(typeof item==='function')freeze(item);
  return freeze(value);
 };
 let active=initialTab;
 const tool=async(name,args={})=>{
  const result=await call('tools.call',{name,arguments:args});
  const text=result.content.filter(item=>item.type==='text').map(item=>item.text).join('\n');
  if(result.isError)throw new ErrorType(text||'도구 실행에 실패했습니다.');
  return {result,text};
 };
 const list=async()=>parse((await tool('list_tabs')).text);
 const refresh=async()=>{active=(await list()).find(tab=>tab.active)?.tabId;};
 const pageFor=id=>{
  let last=null,lastTab;
  const tab=()=>{const value=id??active;if(!Number.isSafeInteger(value)||value<1)throw new ErrorType('활성 탭이 없습니다. tabs.open(url)을 사용하세요.');return value;};
  const pageTool=async(name,args={})=>{
   const tabId=tab(),value=await tool(name,{tabId,...args});
   if(lastTab!==tabId){last=null;lastTab=tabId;}
   if(value.result.structuredContent&&typeof value.result.structuredContent==='object'&&'snapshot' in value.result.structuredContent)last=value.result.structuredContent;
   else if(name!=='page_markdown')last=null;
   return value;
  };
  const textTool=async(name,args={})=>(await pageTool(name,args)).text;
  const snapshotRaw=async()=>{
   const {result,text}=await pageTool('snapshot'),lines=text.split('\n');
   if(result.structuredContent)return {...result.structuredContent,text:lines.slice(2).join('\n')};
   const elements=lines.flatMap(line=>{const match=/^- (e\d+) (\S+) "(.*)"/.exec(line);return match?[{ref:match[1],role:match[2],name:match[3]}]:[];});
   return {title:lines[0]?.replace(/^\[title\] /,'')??'',url:lines[1]?.replace(/^\[url\] /,'')??'',text:lines.slice(2).join('\n'),elements};
  };
  const snapshot=async()=>{
   const s=await snapshotRaw();
   return last?{title:s.title,url:s.url,loading:s.loading,elements:freeze(s.elements.map(e=>freeze({...e}))),text:s.text}:{title:s.title,url:s.url,text:s.text};
  };
  const find=async(role,name)=>{
   const s=last&&lastTab===tab()?last:await snapshotRaw(),els=s.elements;
   const el=els.find(e=>e.role===role&&e.name===name)??els.find(e=>e.role===role&&e.name.includes(name));
   if(!el)throw new ErrorType(role+' "'+name+'" 요소를 찾을 수 없습니다.');
   return el.ref;
  };
  const fill=(ref,text,options={})=>textTool('type',{ref,text,...options.submit===undefined?{}:{submit:options.submit}});
  return frozen({
   get tab(){return id??active;},
   goto:url=>textTool('navigate',{url}),back:()=>textTool('go_back'),forward:()=>textTool('go_forward'),snapshot,find,
   click:ref=>textTool('click',{ref}),fill,type:fill,press:key=>textTool('press_key',{key}),
   scroll:(direction,amount)=>textTool('scroll',{direction,...amount===undefined?{}:{amount}}),
   select:(ref,value)=>textTool('select_option',{ref,value}),text:()=>textTool('page_markdown'),
   waitFor:(options={})=>textTool('wait_for',{...options.text===undefined?{}:{text:options.text},...options.load===undefined?{}:{load:options.load},...options.timeoutMs===undefined?{}:{timeoutMs:options.timeoutMs}}),
   ...features.screenshot?{screenshot:async file=>{
    const value=await call('screenshot',{tabId:tab(),...file===undefined?{}:{file}});
    return file===undefined?new Bytes(value):value;
   }}:{},
   url:async()=>(await snapshot()).url,title:async()=>(await snapshot()).title,
   evaluate:expression=>{if(!features.pageJs)throw new ErrorType('페이지 스크립트에는 --allow-page-js와 앱 설정 허용이 모두 필요합니다.');return call('page.evaluate',{tabId:tab(),expression});}
  });
 };
 const api={
  page:pageFor(),
  tabs:frozen({list,
   open:async(url,options={})=>{const data=parse((await tool('open_tab',{url,active:options.active===true})).text);await refresh();return pageFor(data.tabId);},
   select:async tabId=>{const result=await tool('select_tab',{tabId});active=tabId;return result.text;},
   close:async tabId=>{const result=await tool('close_tab',{tabId});await refresh();return result.text;},
   get:tabId=>{if(!Number.isSafeInteger(tabId)||tabId<1)throw new ErrorType('탭 id는 양의 정수여야 합니다.');return pageFor(tabId);}
  }),
  ...features.tasks?{task:async(prompt,options={})=>{
   const {id}=await call('tasks.start',{prompt,...options.urls?{urls:options.urls}:{},...options.deep?{mode:'deep'}:{},...options.skill?{skillId:options.skill}:{}});
   return frozen({id,wait:()=>call('tasks.wait',{id}),cancel:()=>call('tasks.cancel',{id})});
  }}:{},
  ...features.memory?{memory:frozen({list:()=>call('memory.list'),read:name=>call('memory.read',{name}),write:(name,text)=>call('memory.write',{name,text}),search:query=>call('memory.search',{query}),history:name=>call('memory.history',name===undefined?undefined:{name}),revert:id=>call('memory.revert',{id})})}:{},
  ...features.skills?{skills:frozen({list:()=>call('skills.list'),install:source=>call('skills.install',{source}),remove:id=>call('skills.remove',{id})})}:{},
  sleep:ms=>call('sleep',{ms}),
  console:frozen({log:(...args)=>call('console.log',{text:args.map(v=>typeof v==='string'?v:stringify(v)??String(v)).join(' ')}),error:(...args)=>call('console.error',{text:args.map(v=>typeof v==='string'?v:stringify(v)??String(v)).join(' ')})}),
  JSON:freeze(JSON),Math:freeze(Math)
 };
 frozen(api);
 for(const [key,value] of Object.entries(api))Object.defineProperty(globalThis,key,{value,enumerable:true});
})`;

export function createScriptContext(bridge:Bridge,initialTab:number|undefined,features:Features):ScriptContext{
 const context=vm.createContext(Object.create(null),{codeGeneration:{strings:false,wasm:false}});
 // The host bridge exists only in this bootstrap closure, never on the global object.
 const initialize=vm.runInContext(SCRIPT_BOOTSTRAP,context,{filename:'heisen:api'});
 initialize(bridge,initialTab,features);
 function compile(code:string,filename:string,expression:boolean):vm.Script{
  if(expression){
   try{return new vm.Script(`(async()=>(${code.trim().replace(/;$/,'')}\n))()`,{filename});}catch(error){if(!(error instanceof SyntaxError))throw error;}
  }
  return new vm.Script(`(async()=>{${code}\n})()`,{filename});
 }
 return {
  async run(code:string,filename='heisen:script'):Promise<unknown>{return compile(code,filename,false).runInContext(context);},
  evaluate(code:string,filename='heisen:repl'):Promise<unknown>{
   // Compile synchronously so the REPL can distinguish incomplete input from runtime errors.
   const script=compile(code,filename,true);
   return Promise.resolve(script.runInContext(context)).then(value=>{context._=value;return value;});
  }
 };
}

let workerSource:string|undefined;
// tsx/tests run the TypeScript entry. Builds read dist/script-worker.cjs next to dist/main.mjs;
// reading it in the main process also works inside the packaged ASAR, so the worker evaluates it.
function scriptWorker(workerData:object):Worker{
 const options={workerData,resourceLimits:{maxOldGenerationSizeMb:256,stackSizeMb:16}};
 if(import.meta.url.endsWith('.ts'))return new Worker(new URL('./script-worker.ts',import.meta.url),options);
 workerSource??=readFileSync(fileURLToPath(new URL('./script-worker.cjs',import.meta.url)),'utf8');
 return new Worker(workerSource,{...options,eval:true});
}

export async function runScriptInWorker(o:{code:string;initialTab?:number;features:Features;bridge:Bridge;signal:AbortSignal;idleMs:number;totalMs:number;maxCalls:number}):Promise<{value:unknown;logs:string[];calls:number}>{
 const logs:string[]=[];let calls=0;
 if(o.signal.aborted)throw Object.assign(new Error('Cancelled'),{logs,calls});
 const worker=scriptWorker({bootstrap:SCRIPT_BOOTSTRAP,code:o.code,initialTab:o.initialTab,features:o.features});
 let idle:NodeJS.Timeout|undefined,total:NodeJS.Timeout|undefined;
 const {promise,resolve,reject}=Promise.withResolvers<{value:unknown;logs:string[];calls:number}>();
 let ended=false,pending=0;
 const fail=(error:Error)=>{if(ended)return;ended=true;reject(Object.assign(error,{logs,calls}));};
 const armIdle=()=>{clearTimeout(idle);if(!ended&&!pending)idle=setTimeout(()=>fail(new Error('스크립트가 응답하지 않아 중단했습니다.')),o.idleMs);};
 const abort=()=>fail(new Error('Cancelled'));
 try{
  worker.on('error',fail);
  worker.on('exit',code=>fail(new Error('스크립트 워커가 종료되었습니다. ('+code+')')));
  worker.on('message',message=>{
   if(ended)return;
   switch(message.type){
    case 'log':if(logs.length<100)logs.push(String(message.text).slice(0,2000));break;
    case 'call':{
     if(calls>=o.maxCalls){fail(new Error('스크립트 호출 한도를 넘었습니다.'));return;}
     calls++;pending++;clearTimeout(idle);
     void (async()=>{
      let raw:string;
      try{raw=await o.bridge(message.raw);}catch(error){raw=JSON.stringify({error:error instanceof Error?error.message:String(error)});}
      pending--;
      if(!ended){worker.postMessage({type:'reply',id:message.id,raw});armIdle();}
     })().catch(error=>fail(error instanceof Error?error:new Error(String(error))));
     break;
    }
    case 'done':
     try{const {value}=JSON.parse(message.value);ended=true;resolve({value,logs,calls});}catch(error){fail(error instanceof Error?error:new Error(String(error)));}
     break;
    case 'error':{const error=new Error(message.message);if(message.stack)error.stack=message.stack;fail(error);break;}
   }
  });
  o.signal.addEventListener('abort',abort,{once:true});
  if(o.signal.aborted)abort();
  else{total=setTimeout(()=>fail(new Error('스크립트 실행 시간 한도를 넘었습니다.')),o.totalMs);armIdle();}
  return await promise;
 }finally{
  clearTimeout(idle);clearTimeout(total);o.signal.removeEventListener('abort',abort);await worker.terminate();
 }
}
