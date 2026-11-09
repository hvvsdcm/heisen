// Session preload for http(s) pages. Runs in the sandboxed isolated world: ipcRenderer only, never contextBridge, nothing reaches the page's main world.
import {ipcRenderer} from 'electron';
import {SwipeTracker,SWIPE_GAP,type SwipeMessage} from './swipe.ts';

// swipe
// Two-finger horizontal trackpad swipe (logic in swipe.ts); updates are sent once per frame, end/cancel at once.
const swipe={tracker:new SwipeTracker(),timer:undefined as NodeJS.Timeout|undefined,frame:0};
function swipeSend(msg:SwipeMessage|undefined){
 if(!msg)return;
 if(msg.phase==='update'){if(!swipe.frame)swipe.frame=requestAnimationFrame(()=>{swipe.frame=0;if(swipe.tracker.active)ipcRenderer.send('heisen:swipe',{phase:'update',dx:swipe.tracker.dx});});return;}
 if(swipe.frame){cancelAnimationFrame(swipe.frame);swipe.frame=0;}
 ipcRenderer.send('heisen:swipe',msg);
}
// The viewport scrolls only when the propagated overflow-x (html, else body) allows it; overflow-x:hidden pages still swipe.
function canScrollX(el:Element,deltaX:number,root:boolean){
 if(el.scrollWidth<=el.clientWidth)return false;
 const overflow=root?[document.documentElement,document.body].map(e=>e?getComputedStyle(e).overflowX:'visible').find(o=>o!=='visible')??'visible':getComputedStyle(el).overflowX;
 if(root?/^(hidden|clip)$/.test(overflow):!/^(auto|scroll|overlay)$/.test(overflow))return false;
 return deltaX>0?el.scrollLeft+el.clientWidth<el.scrollWidth-1:el.scrollLeft>0;
}
function horizontalScroller(target:EventTarget|null,deltaX:number){
 const root=document.scrollingElement;
 for(let el=target instanceof Element?target:null;el;el=el.parentElement)if(el!==root&&canScrollX(el,deltaX,false))return true;
 return !!root&&canScrollX(root,deltaX,true);
}
window.addEventListener('wheel',e=>{
 // WheelEvent.momentum (Chromium 156): true for the system's inertial events after the fingers lift.
 const momentum='momentum' in e&&e.momentum===true;
 swipeSend(swipe.tracker.wheel({deltaX:e.deltaX,deltaY:e.deltaY,ctrlKey:e.ctrlKey,momentum},dx=>horizontalScroller(e.target,dx)));
 clearTimeout(swipe.timer);swipe.timer=swipe.tracker.active?setTimeout(()=>swipeSend(swipe.tracker.quiet()),SWIPE_GAP):undefined;
},{passive:true,capture:true});

// login forms
// Main frame only. A trusted click (or ArrowDown) in a login field asks main for the saved-accounts menu; a login submit reports the typed pair
// for the save prompt. Nothing is filled from here and nothing is sent on page load. A password field is new-password (sign-up / change:
// main offers a generated password) when marked autocomplete new-password, or when its form has two or more visible password fields,
// unless it is marked current-password.
type LoginKind='username'|'password'|'new-password';
const login={field:null as HTMLInputElement|null,fieldAt:0,pair:'',pairAt:0};
const visibleInput=(el:HTMLElement)=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&el.checkVisibility?.()!==false;};
function isLoginField(el:EventTarget|null):LoginKind|null{
 if(!(el instanceof HTMLInputElement)||el.disabled||el.readOnly)return null;
 if(el.type==='password'){
  const ac=(el.getAttribute('autocomplete')||'').toLowerCase();if(/\bcurrent-password\b/.test(ac))return 'password';
  return /\bnew-password\b/.test(ac)||Array.from((el.form||document).querySelectorAll<HTMLInputElement>('input[type=password]')).filter(visibleInput).length>=2?'new-password':'password';
 }
 if(!['text','email','tel'].includes(el.type))return null;
 const autocomplete=(el.getAttribute('autocomplete')||'').toLowerCase();
 if(/\busername\b/.test(autocomplete))return 'username';
 if(!Array.from(document.querySelectorAll<HTMLInputElement>('input[type=password]')).some(visibleInput))return null;
 return /\b(username|email)\b/.test(autocomplete)||/user|email|login|account|id/i.test(el.name+' '+el.id)?'username':null;
}
function loginField(el:EventTarget|null){
 const kind=isLoginField(el);if(!kind)return;
 const input=el as HTMLInputElement,now=Date.now();
 if(login.field===input&&now-login.fieldAt<800)return;
 login.field=input;login.fieldAt=now;
 const r=input.getBoundingClientRect();
 ipcRenderer.send('heisen:login-field',{kind,rect:{x:r.x,y:r.y,width:r.width,height:r.height}});
}
// Username: an autocomplete username/email field, else an email field, else the last text/tel field before the password.
function loginSubmit(scope:ParentNode){
 const inputs=Array.from(scope.querySelectorAll('input')).filter(i=>!i.disabled&&i.type!=='hidden');
 const password=inputs.find(i=>i.type==='password'&&i.value);if(!password)return;
 const named=inputs.filter(i=>['text','email','tel'].includes(i.type)&&i.value.trim());
 const user=named.find(i=>/\b(username|email)\b/i.test(i.getAttribute('autocomplete')||''))||named.find(i=>i.type==='email')||named.filter(i=>i.compareDocumentPosition(password)&Node.DOCUMENT_POSITION_FOLLOWING).pop();
 const username=user?.value.trim()||'',pair=username+'\n'+password.value,now=Date.now();
 if(pair===login.pair&&now-login.pairAt<3000)return;
 login.pair=pair;login.pairAt=now;
 ipcRenderer.send('heisen:login-submit',{username,password:password.value});
}
if(window===window.top){
 window.addEventListener('mousedown',e=>{if(e.isTrusted&&e.button===0)loginField(e.target);},true);
 window.addEventListener('keydown',e=>{
  if(!e.isTrusted)return;
  if(e.key==='ArrowDown'&&e.target===document.activeElement)loginField(e.target);
  else if(e.key==='Enter'&&e.target instanceof HTMLInputElement&&e.target.type==='password')loginSubmit(e.target.form||document);
 },true);
 document.addEventListener('submit',e=>{if(e.isTrusted&&e.target instanceof HTMLFormElement)loginSubmit(e.target);},true);
 window.addEventListener('click',e=>{
  const button=e.isTrusted&&e.target instanceof Element?e.target.closest<HTMLButtonElement|HTMLInputElement>('button,input[type=submit]'):null;
  if(button?.form)loginSubmit(button.form);
 },true);
}
