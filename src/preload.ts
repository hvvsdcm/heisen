import {contextBridge,ipcRenderer} from 'electron';
contextBridge.exposeInMainWorld('heisen',Object.freeze({
 call:(method:string,args:unknown={})=>ipcRenderer.invoke('heisen:rpc',{method,args}),
 onChange:(fn:()=>void)=>{const listener=()=>fn();ipcRenderer.on('heisen:changed',listener);return ()=>ipcRenderer.removeListener('heisen:changed',listener);},
 onShortcut:(fn:(name:string)=>void)=>{const listener=(_e:unknown,name:string)=>fn(name);ipcRenderer.on('heisen:shortcut',listener);return ()=>ipcRenderer.removeListener('heisen:shortcut',listener);}
}));
