import {EventEmitter} from 'node:events';
import {MAX_FRAME} from './protocol.ts';

export const CONTROL_VERSION=1;
export const MAX_LINE=MAX_FRAME;
export type Json=string|number|boolean|null|Json[]|{[k:string]:Json};
export type Request={jsonrpc:'2.0';id:number|string;method:string;params?:Json};
export type Notification={jsonrpc:'2.0';method:string;params?:Json};
export type Response={jsonrpc:'2.0';id:number|string;result?:Json;error?:{code:number;message:string;data?:Json}};
export type Hello={token:string;client:{name:string;version:string};capabilities?:('page-js')[]};
export type HelloResult={protocol:number;app:{version:string;chromium:string};profile:string;pageScripts:boolean;computer:boolean};
export type ToolContent={type:'text';text:string}|{type:'image';data:string;mimeType:string};
export type ToolResult={content:ToolContent[];isError?:boolean;structuredContent?:Json};
export type TaskSummary={id:string;prompt:string;status:string;createdAt:string;mode?:string;result?:string};
export const METHODS=['hello','status','tools.list','tools.call','page.evaluate','tasks.start','tasks.list','tasks.get','tasks.cancel','tasks.continue','tasks.approve','tasks.watch','tasks.unwatch','tasks.wait','memory.list','memory.read','memory.write','memory.delete','memory.search','memory.history','memory.revert','memory.dream','skills.list','skills.install','skills.remove','skills.enable','skills.body','routines.list','routines.run','routines.toggle','computer.status'] as const;

export class LineDecoder extends EventEmitter<{message:[value:object];error:[error:Error]}> {
 private parts:Buffer[]=[];
 private size=0;
 push(chunk:Buffer|string):void{
  const bytes=typeof chunk==='string'?Buffer.from(chunk):chunk;
  let start=0;
  while(start<bytes.length){
   const end=bytes.indexOf(10,start),complete=end!==-1;
   const part=bytes.subarray(start,complete?end:bytes.length);
   const size=this.size+part.length;
   const last=part.length?part[part.length-1]:this.parts[this.parts.length-1]?.at(-1);
   // The limit counts UTF-8 JSON bytes, excluding LF and the optional CR.
   if(size-(last===13?1:0)>MAX_LINE){
    this.parts=[];this.size=0;
    this.emit('error',new Error('Line exceeds size limit'));return;
   }
   if(!complete){if(part.length)this.parts.push(Buffer.from(part));this.size=size;return;}
   const line=this.parts.length?Buffer.concat([...this.parts,part],size):part;
   this.parts=[];this.size=0;
   let value:unknown;
   try{
    value=JSON.parse(line.subarray(0,last===13?line.length-1:line.length).toString('utf8'));
    if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Expected object');
   }catch(e){this.emit('error',e as Error);start=end+1;continue;}
   this.emit('message',value);
   start=end+1;
  }
 }
}

export function encodeLine(value:unknown):string{
 const body=JSON.stringify(value);
 if(body===undefined)throw new Error('Expected JSON value');
 if(Buffer.byteLength(body)>MAX_LINE)throw new Error('Line exceeds size limit');
 return body+'\n';
}
// JSON-RPC: parse -32700, request -32600, method -32601, params -32602,
// internal -32603; control: unauthorized -32000, denied -32001, disabled -32002.
export function rpcError(code:number,message:string):Response['error']{return {code,message};}
