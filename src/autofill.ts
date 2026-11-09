import {ipcMain,Menu,type IpcMainEvent,type WebContents} from 'electron';
import {randomUUID} from 'node:crypto';
import type {Browser,Tab} from './browser.ts';
import type {Windows} from './windows.ts';
import type {Data} from './data.ts';
import {originMatches,type Passwords} from './passwords.ts';
import {pageScript,sensitiveSetup,fillLoginScript,signupScanScript,fillSignupScript,type SignupScan} from './page-scripts.ts';
import {generatePassword,parseRules} from './password-rules.ts';
import {originOf} from './protocol.ts';
import {registerRpc,registerState} from './rpc.ts';
type Deps={windows:Windows;passwords:Passwords;data:Data;changed:()=>void};
type Prompt={id:string;tabId:number;kind:'save'|'update';origin:string;username:string;password:string;at:number};
type Rect={x:number;y:number;width:number;height:number};
const PROMPT_TTL=180000,MENU_GAP=800,AGENT_QUIET=2000,MAX_ACCOUNTS=10;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const isRect=(r:any):r is Rect=>!!r&&finite(r.x)&&finite(r.y)&&finite(r.width)&&finite(r.height);
const webOrigin=(url:string)=>{try{return originOf(url);}catch{return null;}};
// Chrome-style autofill: the page preload reports login-field clicks and form submits; main shows the saved accounts as a native menu
// under the field and fills the chosen one in world 1002, and turns submitted credentials into a save/update infobar. New-password
// fields also offer a generated password. With the password manager off (settings.vault) there are no menus, prompts or key icon.
export class Autofill {
 private prompts=new Map<number,Prompt>();private menuAt=new WeakMap<WebContents,number>();private watched=new WeakSet<WebContents>();
 constructor(private deps:Deps){}
 attach(browser:Browser):void{browser.vaultLookup=o=>this.deps.passwords.matches(o);browser.vaultEnabled=()=>this.deps.data.state.settings.vault;}
 install():void{
  const {windows,passwords,data,changed}=this.deps;
  ipcMain.on('heisen:login-field',(e,msg)=>this.field(e,msg));
  ipcMain.on('heisen:login-submit',(e,msg)=>this.submit(e,msg));
  registerRpc({
   'password.prompt':a=>this.answer(a),
   'vault.toggle':a=>{data.state.settings.vault=a.enabled===true;if(!data.state.settings.vault)this.prompts.clear();data.save();changed();return true;},
   'password.menu':a=>{
    if(!data.state.settings.vault)return false;
    if(!finite(a.x)||!finite(a.y))throw new Error('Invalid position');
    const browser=windows.current(),tab=browser.tabs.get(browser.active),wc=tab?.view?.webContents;
    if(!tab||!wc||wc.isDestroyed()||this.agentBusy(tab))return false;
    const origin=webOrigin(wc.getURL());return !!origin&&this.popup(wc,origin,a.x,a.y);
   },
  });
  registerState('passwordPrompts',()=>{const browser=windows.current();return [...this.prompts.values()].filter(p=>browser.tabs.has(p.tabId)).map(({password,...p})=>p);});
  registerState('activePasswords',()=>{const browser=windows.current(),tab=browser.tabs.get(browser.active),origin=data.state.settings.vault&&tab&&webOrigin(tab.url);return origin?passwords.matches(origin).length:0;});
 }
 // Agent-driven input (task-owned tab, or MCP input in the last 2 s) never opens the menu or a prompt.
 private agentBusy(tab:Tab){return !!tab.taskId||!!tab.agentAt&&Date.now()-tab.agentAt<AGENT_QUIET;}
 // Accepts only the main frame of a tab on http(s); returns the tab, its contents and the frame origin.
 private sender(e:IpcMainEvent){
  const browser=this.deps.windows.byContents(e.sender),tab=browser?.tabForContents(e.sender),frame=e.senderFrame;
  if(!browser||!tab||!frame||frame!==e.sender.mainFrame)return undefined;
  const origin=frame.origin;if(!/^https?:\/\/[^/]+$/.test(origin))return undefined;
  return {browser,tab,wc:e.sender,origin};
 }
 private field(e:IpcMainEvent,msg:any){
  const s=this.sender(e);if(!s||this.agentBusy(s.tab)||!msg||(msg.kind!=='username'&&msg.kind!=='password'&&msg.kind!=='new-password')||!isRect(msg.rect))return;
  const {data}=this.deps,{browser}=s;if(!data.state.settings.vault||s.tab.id!==browser.active||browser.route!=='page'||browser.modal||!s.tab.view)return;
  const now=Date.now();if(now-(this.menuAt.get(s.wc)??0)<MENU_GAP)return;
  const b=s.tab.view.getBounds(),zoom=s.wc.getZoomFactor();
  if(this.popup(s.wc,s.origin,b.x+msg.rect.x*zoom,b.y+(msg.rect.y+msg.rect.height)*zoom,msg.kind==='new-password'))this.menuAt.set(s.wc,now);
 }
 private popup(wc:WebContents,origin:string,x:number,y:number,suggest=false){
  const browser=this.deps.windows.byContents(wc);if(!browser)return false;
  const accounts=this.deps.passwords.matches(origin).slice(0,MAX_ACCOUNTS);if(!accounts.length&&!suggest)return false;
  Menu.buildFromTemplate([
   ...(suggest?[{label:'강력한 비밀번호 사용',click:()=>void this.suggest(wc,origin)},{type:'separator' as const}]:[]),
   ...accounts.map(v=>({label:v.username||'(사용자 이름 없음)',click:()=>void this.fill(wc,origin,v.id)})),
   ...(accounts.length?[{type:'separator' as const}]:[]),
   {label:'비밀번호 관리…',click:()=>{if(!browser.win.isDestroyed())browser.show('vault');}},
  ]).popup({window:browser.win,x:Math.round(x),y:Math.round(y)});
  return true;
 }
 // Chrome's strong-password suggestion: a password generated for the form's inferred rules goes into every password field (the
 // confirmation too) and is saved at once without a username; the submit that follows adopts the username silently.
 private async suggest(wc:WebContents,origin:string){
  const {passwords,data}=this.deps,browser=this.deps.windows.byContents(wc);
  if(!browser||!data.state.settings.vault||wc.isDestroyed()||webOrigin(wc.getURL())!==origin)return;
  try{
   const scan:SignupScan=await wc.executeJavaScriptInIsolatedWorld(1001,[{code:pageScript(sensitiveSetup)+';'+pageScript(signupScanScript)}]);
   const password=generatePassword(parseRules(scan.rules));
   const r=await wc.executeJavaScriptInIsolatedWorld(1002,[{code:pageScript(fillSignupScript,{origin,password})}],true);
   if('error' in r){console.error('Password suggestion failed',r.error);return;}
   if(!r.filled.password)return;
   const tab=browser.tabForContents(wc);if(tab)browser.rememberSecret(tab.id,password);
   passwords.record({origin,username:scan.username,password,by:'user'});
  }catch(e){console.error('Password suggestion failed',e);}
 }
 // The page may have navigated while the menu was open; fill only if the document is still on the same origin.
 // A filled password is remembered for the tab so agent output from this page masks it.
 private async fill(wc:WebContents,origin:string,id:string){
  if(wc.isDestroyed()||webOrigin(wc.getURL())!==origin)return;
  const v=this.deps.passwords.matches(origin).find(v=>v.id===id);if(!v)return;
  const r=await wc.executeJavaScriptInIsolatedWorld(1002,[{code:pageScript(fillLoginScript,{origin,username:v.username,password:v.password})}],true).catch(()=>null);
  if(r&&'error' in r)console.error('Autofill failed',r.error);
  else if(r){const browser=this.deps.windows.byContents(wc),tab=browser?.tabForContents(wc);if(tab)browser!.rememberSecret(tab.id,v.password);}
 }
 private submit(e:IpcMainEvent,msg:any){
  const s=this.sender(e);if(!s||!msg)return;
  const {username,password}=msg;
  if(typeof username!=='string'||username.length>500||typeof password!=='string'||!password||password.length>4096)return;
  // A submitted password is masked in agent output from this tab, whether or not it gets saved and whoever typed it.
  s.browser.rememberSecret(s.tab.id,password);
  const {data,passwords,changed}=this.deps;if(!data.state.settings.vault)return;
  if(this.agentBusy(s.tab))return;
  if(data.state.neverSave.some(o=>originMatches(o,s.origin)))return;
  if(username&&passwords.adoptUsername(s.origin,password,username)){changed();return;}
  const saved=passwords.matches(s.origin).find(v=>v.username===username);
  if(saved?.password===password)return;
  const tabId=s.tab.id,id=randomUUID();
  this.prompts.set(tabId,{id,tabId,kind:saved?'update':'save',origin:s.origin,username,password,at:Date.now()});
  setTimeout(()=>{if(this.prompts.get(tabId)?.id===id){this.prompts.delete(tabId);changed();}},PROMPT_TTL).unref();
  if(!this.watched.has(s.wc)){this.watched.add(s.wc);s.wc.once('destroyed',()=>{if(this.prompts.delete(tabId))changed();});}
  changed();
 }
 private async answer(a:any){
  if(!['save','never','dismiss'].includes(a.action))throw new Error('Invalid action');
  const tabId=Number(a.tabId),p=this.prompts.get(tabId);if(!p||!this.deps.windows.current().tabs.has(tabId))return false;
  const {data,passwords,changed}=this.deps;
  this.prompts.delete(tabId);
  if(a.action==='save'){
   // An update targets the saved entry's own origin (it may differ by "www."), so the merge replaces it instead of adding a twin.
   const origin=passwords.matches(p.origin).find(v=>v.username===p.username)?.origin??p.origin;
   // importer.ts pulls in node:sqlite; load it only when a login is actually saved (same as passwords.ts).
   const {mergeLogins}=await import('./importer.ts');
   passwords.save(mergeLogins(passwords.list(),[{origin,username:p.username,password:p.password,createdAt:Date.now()}],'heisen').list);
  }
  if(a.action==='never'&&!data.state.neverSave.includes(p.origin)){data.state.neverSave.push(p.origin);data.save();}
  changed();return true;
 }
}
