import {ipcMain,type BrowserWindow,type WebContents} from 'electron';
import {AsyncLocalStorage} from 'node:async_hooks';
const context=new AsyncLocalStorage<{win:BrowserWindow}>();
export function callerWindow():BrowserWindow|undefined{return context.getStore()?.win;}
export type RpcMethod=(args:any)=>unknown;
const methods=new Map<string,RpcMethod>();
const states=new Map<string,()=>unknown>();
export function registerRpc(group:Record<string,RpcMethod>):void{
 for(const name of Object.keys(group))if(methods.has(name))throw new Error('Duplicate RPC '+name);
 for(const [name,fn] of Object.entries(group))methods.set(name,fn);
}
export function registerState(key:string,fn:()=>unknown):void{
 if(states.has(key))throw new Error('Duplicate state '+key);
 states.set(key,fn);
}
export function collectState():Record<string,unknown>{
 const out:Record<string,unknown>={};
 for(const [key,fn] of states)out[key]=fn();
 return out;
}
// allow gates every call by method name (the beta sign-in gate); a refused call rejects in the renderer.
export function installRpc(uiURL:string,allow:((method:string)=>boolean)|undefined,isUiWindow:(wc:WebContents)=>BrowserWindow|undefined):void{
 ipcMain.handle('heisen:rpc',async(event,payload)=>{
  const win=isUiWindow(event.sender);
  if(!win||win.isDestroyed()||event.senderFrame!==win.webContents.mainFrame||event.senderFrame.url!==uiURL)throw new Error('Unauthorized caller');
  if(!payload||typeof payload.method!=='string'||JSON.stringify(payload).length>1100000)throw new Error('Invalid request');
  const method=methods.get(payload.method);if(!method)throw new Error('Unknown method');
  if(allow&&!allow(payload.method))throw new Error('로그인이 필요합니다.');
  return context.run({win},()=>method(payload.args||{}));
 });
}
