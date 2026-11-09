import type {WebContents} from 'electron';
import {setTimeout as sleep} from 'node:timers/promises';
// Trusted input through CDP Input.* with fast or human-like timing. Only Input.*/DOM.*/Page.* are used; never Runtime.enable.
export type InputStyle='fast'|'human';
type Point={x:number;y:number};
type Rand=()=>number;
const SHIFT=8;
const pointers=new WeakMap<WebContents,Point>();
export function between(min:number,max:number,rand:Rand=Math.random){return min+(max-min)*rand();}
export function typingDelay(length:number,rand:Rand=Math.random){return Math.min(140,Math.max(12,8000/Math.max(1,length)))*between(0.6,1.4,rand);}
// Curved, eased path of `steps` points ending exactly at `to` (the start point itself is not included).
export function mousePath(from:Point,to:Point,steps:number,rand:Rand=Math.random):Point[]{
 const dx=to.x-from.x,dy=to.y-from.y,dist=Math.hypot(dx,dy),bend=dist*between(-0.2,0.2,rand);
 const cx=from.x+dx/2-(dist?dy/dist:0)*bend,cy=from.y+dy/2+(dist?dx/dist:0)*bend;const out:Point[]=[];
 for(let i=1;i<=steps;i++){
  if(i===steps){out.push({x:to.x,y:to.y});break;}
  const s=i/steps,t=s<0.5?2*s*s:1-(-2*s+2)**2/2,u=1-t;
  out.push({x:u*u*from.x+2*u*t*cx+t*t*to.x+between(-0.5,0.5,rand),y:u*u*from.y+2*u*t*cy+t*t*to.y+between(-0.5,0.5,rand)});
 }
 return out;
}
const SYMBOLS:Record<string,[string,number,string]>={'`':['Backquote',192,'~'],'-':['Minus',189,'_'],'=':['Equal',187,'+'],'[':['BracketLeft',219,'{'],']':['BracketRight',221,'}'],'\\':['Backslash',220,'|'],';':['Semicolon',186,':'],"'":['Quote',222,'"'],',':['Comma',188,'<'],'.':['Period',190,'>'],'/':['Slash',191,'?'],'1':['Digit1',49,'!'],'2':['Digit2',50,'@'],'3':['Digit3',51,'#'],'4':['Digit4',52,'$'],'5':['Digit5',53,'%'],'6':['Digit6',54,'^'],'7':['Digit7',55,'&'],'8':['Digit8',56,'*'],'9':['Digit9',57,'('],'0':['Digit0',48,')']};
// US-layout key for a printable ASCII character; undefined for anything else (typed with Input.insertText).
export function keyFor(ch:string):{key:string;code:string;keyCode:number;shift:boolean;unshifted:string}|undefined{
 if(ch===' ')return {key:' ',code:'Space',keyCode:32,shift:false,unshifted:' '};
 if(/^[a-z]$/.test(ch))return {key:ch,code:'Key'+ch.toUpperCase(),keyCode:ch.toUpperCase().charCodeAt(0),shift:false,unshifted:ch};
 if(/^[A-Z]$/.test(ch))return {key:ch,code:'Key'+ch,keyCode:ch.charCodeAt(0),shift:true,unshifted:ch.toLowerCase()};
 for(const [base,[code,keyCode,shifted]] of Object.entries(SYMBOLS)){if(ch===base)return {key:ch,code,keyCode,shift:false,unshifted:base};if(ch===shifted)return {key:ch,code,keyCode,shift:true,unshifted:base};}
 return undefined;
}
export type Key='Enter'|'Tab'|'Escape'|'Backspace'|'ArrowDown'|'ArrowUp'|'ArrowLeft'|'ArrowRight'|'PageDown'|'PageUp'|'Home'|'End'|'Space';
// windowsVirtualKeyCode, DOM code, typed text and macOS editing command (CDP needs the command on macOS for editing keys).
export const KEYS:Record<Key,{key:string;code:string;keyCode:number;text?:string;command?:string}>={
 Enter:{key:'Enter',code:'Enter',keyCode:13,text:'\r',command:'insertNewline'},Tab:{key:'Tab',code:'Tab',keyCode:9},Escape:{key:'Escape',code:'Escape',keyCode:27,command:'cancelOperation'},Backspace:{key:'Backspace',code:'Backspace',keyCode:8,command:'deleteBackward'},
 ArrowDown:{key:'ArrowDown',code:'ArrowDown',keyCode:40,command:'moveDown'},ArrowUp:{key:'ArrowUp',code:'ArrowUp',keyCode:38,command:'moveUp'},ArrowLeft:{key:'ArrowLeft',code:'ArrowLeft',keyCode:37,command:'moveLeft'},ArrowRight:{key:'ArrowRight',code:'ArrowRight',keyCode:39,command:'moveRight'},
 PageDown:{key:'PageDown',code:'PageDown',keyCode:34,command:'scrollPageDown'},PageUp:{key:'PageUp',code:'PageUp',keyCode:33,command:'scrollPageUp'},Home:{key:'Home',code:'Home',keyCode:36,command:'scrollToBeginningOfDocument'},End:{key:'End',code:'End',keyCode:35,command:'scrollToEndOfDocument'},Space:{key:' ',code:'Space',keyCode:32,text:' '},
};
export async function ensureDebugger(wc:WebContents){if(!wc.debugger.isAttached())wc.debugger.attach('1.3');}
export function releaseDebugger(wc:WebContents){if(!wc.isDestroyed()&&wc.debugger.isAttached())wc.debugger.detach();}
// A hidden or occluded page never acknowledges input events; fail instead of waiting forever.
async function send(wc:WebContents,method:string,params:object){
 const timer=new AbortController();
 try{return await Promise.race([wc.debugger.sendCommand(method,params),sleep(5000,undefined,{signal:timer.signal}).then(()=>{throw new Error('페이지가 입력에 응답하지 않습니다.');})]);}
 finally{timer.abort();}
}
async function start(wc:WebContents):Promise<Point>{
 const last=pointers.get(wc);if(last)return last;
 try{const m=await send(wc,'Page.getLayoutMetrics',{});const v=m.cssVisualViewport||m.cssLayoutViewport;return {x:v.clientWidth/2,y:v.clientHeight/2};}catch{return {x:0,y:0};}
}
async function moveTo(wc:WebContents,x:number,y:number,modifiers=0){
 for(const p of mousePath(await start(wc),{x,y},Math.round(between(6,12)))){await send(wc,'Input.dispatchMouseEvent',{type:'mouseMoved',x:p.x,y:p.y,button:'none',buttons:0,modifiers});pointers.set(wc,p);await sleep(between(8,16));}
}
export async function click(wc:WebContents,x:number,y:number,style:InputStyle,opts:{button?:'left'|'middle'|'right';modifiers?:number}={}){
 await ensureDebugger(wc);const button=opts.button||'left',modifiers=opts.modifiers||0,buttons={left:1,right:2,middle:4}[button];
 if(style==='human')await moveTo(wc,x,y,modifiers);
 else{await send(wc,'Input.dispatchMouseEvent',{type:'mouseMoved',x,y,button:'none',buttons:0,modifiers});pointers.set(wc,{x,y});}
 await send(wc,'Input.dispatchMouseEvent',{type:'mousePressed',x,y,button,buttons,clickCount:1,modifiers});
 if(style==='human')await sleep(between(45,110));
 await send(wc,'Input.dispatchMouseEvent',{type:'mouseReleased',x,y,button,buttons:0,clickCount:1,modifiers});
}
// `beforeKey` runs once before fast insertion or before each human-style character; throwing stops typing (task cancellation).
export async function typeText(wc:WebContents,text:string,style:InputStyle,beforeKey?:()=>void){
 if(!text)return;
 await ensureDebugger(wc);
 if(style==='fast'){beforeKey?.();await send(wc,'Input.insertText',{text});return;}
 const chars=[...text];
 for(let i=0;i<chars.length;i++){
  beforeKey?.();
  const ch=chars[i],k=keyFor(ch),delay=typingDelay(chars.length),last=i===chars.length-1;
  if(!k){await send(wc,'Input.insertText',{text:ch});if(!last)await sleep(delay);continue;}
  const modifiers=k.shift?SHIFT:0;
  if(k.shift)await send(wc,'Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,modifiers:SHIFT});
  await send(wc,'Input.dispatchKeyEvent',{type:'keyDown',key:k.key,code:k.code,text:ch,unmodifiedText:k.unshifted,windowsVirtualKeyCode:k.keyCode,modifiers});
  await sleep(delay*0.35);
  await send(wc,'Input.dispatchKeyEvent',{type:'keyUp',key:k.key,code:k.code,windowsVirtualKeyCode:k.keyCode,modifiers});
  if(k.shift)await send(wc,'Input.dispatchKeyEvent',{type:'keyUp',key:'Shift',code:'ShiftLeft',windowsVirtualKeyCode:16,modifiers:0});
  if(!last)await sleep(delay*0.65);
 }
}
export async function selectAll(wc:WebContents,style:InputStyle){
 await ensureDebugger(wc);
 await send(wc,'Input.dispatchKeyEvent',{type:'keyDown',key:'a',code:'KeyA',modifiers:4,commands:['selectAll']});
 if(style==='human')await sleep(between(45,110));
 await send(wc,'Input.dispatchKeyEvent',{type:'keyUp',key:'a',code:'KeyA',modifiers:4});
}
export async function pressKey(wc:WebContents,key:Key,style:InputStyle){
 const k=KEYS[key];if(!k)throw new Error('지원하지 않는 키입니다.');await ensureDebugger(wc);
 await send(wc,'Input.dispatchKeyEvent',{type:k.text?'keyDown':'rawKeyDown',key:k.key,code:k.code,windowsVirtualKeyCode:k.keyCode,...(k.text?{text:k.text,unmodifiedText:k.text}:{}),...(k.command?{commands:[k.command]}:{})});
 if(style==='human')await sleep(between(45,110));
 await send(wc,'Input.dispatchKeyEvent',{type:'keyUp',key:k.key,code:k.code,windowsVirtualKeyCode:k.keyCode});
}
export async function wheel(wc:WebContents,x:number,y:number,deltaY:number,style:InputStyle){
 await ensureDebugger(wc);
 if(style==='fast'){
  await send(wc,'Input.dispatchMouseEvent',{type:'mouseMoved',x,y,button:'none',buttons:0});pointers.set(wc,{x,y});
  await send(wc,'Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY,button:'none',buttons:0});return;
 }
 await moveTo(wc,x,y);
 for(let i=0;i<4;i++){await send(wc,'Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY:deltaY/4,button:'none',buttons:0});await sleep(between(8,16));}
}
