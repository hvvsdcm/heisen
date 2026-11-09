import {randomBytes} from 'node:crypto';
import http from 'node:http';
import {shell,type BrowserWindow} from 'electron';
import type {Secrets} from './data.ts';
import {VERIFY_EVERY_MS,betaMessage,callbackParams,decide,pkcePair,type BetaSession,type BetaStatus} from './beta-util.ts';
import {focusWindow} from './test-background.ts';
export type BetaInfo={status:BetaStatus;email?:string;name?:string;online:boolean;verifiedAt?:number;error?:string;busy:boolean;server:string};
type Reply={status:number;body?:Record<string,any>};
const GATE_METHODS:Record<string,true>={state:true,layout:true,'chrome.top':true,'beta.signIn':true,'beta.cancel':true,'beta.redeem':true,'beta.retry':true,'beta.signOut':true};
// status 0 = no response (network, timeout); an unparseable body leaves body undefined so callers fall back to their default code.
async function request(url:string,init:RequestInit):Promise<Reply>{let res:Response;try{res=await fetch(url,init);}catch{return {status:0};}try{const body:unknown=await res.json();return {status:res.status,body:body&&typeof body==='object'?body as Record<string,any>:undefined};}catch{return {status:res.status};}}
// Closed-beta gate. The session token lives only in Secrets ('beta') and is never logged; every state change calls changed().
export class Beta {
 private status:BetaStatus='checking';private online=true;private error?:string;private busy=false;private stopped=false;private pending?:()=>void;private timer?:NodeJS.Timeout;
 private unlock!:()=>void;private unlocked=new Promise<void>(resolve=>{this.unlock=resolve;});
 constructor(private secrets:Secrets,private opts:{url:string;skip:boolean;parent:()=>BrowserWindow;version:string;changed:()=>void;openExternal?:(url:string)=>Promise<void>}){}
 private saved():BetaSession|undefined{try{return this.secrets.get<BetaSession>('beta');}catch{return undefined;}}
 private set(status:BetaStatus){this.status=status;if(status==='active')this.unlock();}
 private headers(token?:string):Record<string,string>{return {'Content-Type':'application/json','X-Heisen-Version':this.opts.version,...(token?{Authorization:'Bearer '+token}:{})};}
 private signedOut(code:string){this.secrets.delete('beta');this.set('signed_out');this.online=true;this.error=betaMessage(code);}
 info():BetaInfo{const s=this.opts.skip?undefined:this.saved();return {status:this.status,email:s?.email,name:s?.name,online:this.online,verifiedAt:s?.verifiedAt,error:this.error,busy:this.busy,server:this.opts.url};}
 allows(method:string):boolean{return this.status==='active'||Object.hasOwn(GATE_METHODS,method);}
 ready():Promise<void>{return this.unlocked;}
 start():void{
  if(this.opts.skip){this.set('active');this.opts.changed();return;}
  const saved=this.saved();this.set(decide(saved,Date.now()));this.online=this.status!=='offline';this.opts.changed();
  if(saved)void this.verify();this.timer=setInterval(()=>void this.verify(),VERIFY_EVERY_MS);this.timer.unref();
 }
 async verify():Promise<void>{
  const saved=this.saved();if(!saved||this.opts.skip)return;
  const reply=await request(this.opts.url+'/api/me',{headers:this.headers(saved.token),signal:AbortSignal.timeout(15000)});
  // Sign-out, sign-in or redeem may have replaced the session while the request was in flight.
  if(this.stopped||this.saved()?.token!==saved.token)return;const now=Date.now(),user=reply.body?.user;
  if(reply.status===200&&user&&typeof user.email==='string'){const admitted=user.admitted===true;this.secrets.set('beta',{...saved,email:user.email,name:typeof user.name==='string'?user.name:undefined,admitted,verifiedAt:now});this.set(admitted?'active':'invite');this.online=true;this.error=undefined;}
  else if(reply.status===401)this.signedOut(reply.body?.error||'unauthorized');
  else{this.online=false;this.set(decide(saved,now));}
  this.opts.changed();
 }
 async signIn():Promise<void>{
  this.cancel();if(this.stopped)return;
  const {verifier,challenge}=pkcePair(),state=randomBytes(16).toString('base64url');let done=false,timeout:NodeJS.Timeout|undefined;
  const finish=(error?:string,exchanging=false)=>{if(done)return;done=true;clearTimeout(timeout);if(this.pending===cancel)this.pending=undefined;server.close();if(!exchanging){server.closeAllConnections();this.busy=false;this.error=error===undefined?undefined:betaMessage(error);if(!this.stopped)this.opts.changed();}};
  const cancel=()=>finish();
  const server=http.createServer((req,res)=>{
   if(done){res.writeHead(410,{Connection:'close'});res.end();return;}
   if(req.method!=='GET'){res.writeHead(405,{Allow:'GET'});res.end();return;}
   const result=callbackParams(req.url||'/',state);if(!result){res.writeHead(404);res.end();return;}
   if('code' in result){res.writeHead(302,{Location:this.opts.url+'/auth/app/complete','Cache-Control':'no-store',Connection:'close'});res.end();}
   else{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',Connection:'close'});res.end('<!doctype html><meta charset="utf-8"><p>로그인하지 못했습니다. Heisen에서 다시 시도하세요.</p>');}
   // Preserve the callback response while shutting the listener; the connection closes after it flushes.
   finish(undefined,true);const parent=this.opts.parent();if(parent&&!parent.isDestroyed())focusWindow(parent);
   if('code' in result)void this.exchange(result.code,verifier);else{this.busy=false;this.error=betaMessage(result.error);this.opts.changed();}
  });
  this.pending=cancel;this.busy=true;this.error=undefined;this.opts.changed();
  timeout=setTimeout(cancel,10*60*1000);timeout.unref();
  await new Promise<void>(resolve=>{server.on('error',()=>{finish('network');resolve();});server.listen(0,'127.0.0.1',resolve);});
  if(done){server.close();return;}const address=server.address();if(!address||typeof address==='string'){finish('network');return;}
  const start=new URL(this.opts.url+'/auth/start');for(const [k,v] of Object.entries({client:'app',state,code_challenge:challenge,code_challenge_method:'S256',redirect_port:String(address.port)}))start.searchParams.set(k,v);
  try{await (this.opts.openExternal||((url:string)=>shell.openExternal(url)))(start.href);}catch{finish('network');}
 }
 private async exchange(code:string,verifier:string):Promise<void>{
  this.busy=true;this.opts.changed();
  const reply=await request(this.opts.url+'/api/app/token',{method:'POST',headers:this.headers(),body:JSON.stringify({code,code_verifier:verifier}),signal:AbortSignal.timeout(15000)});
  if(this.stopped)return;const body=reply.body,user=body?.user;
  if(reply.status===200&&typeof body?.token==='string'&&typeof body.expires_at==='number'&&user&&typeof user.email==='string'){
   const admitted=user.admitted===true;
   try{this.secrets.set('beta',{token:body.token,email:user.email,name:typeof user.name==='string'?user.name:undefined,admitted,verifiedAt:Date.now(),expiresAt:body.expires_at});this.set(admitted?'active':'invite');this.online=true;this.error=undefined;}catch{this.error=betaMessage('storage');}
  }else this.error=betaMessage(body?.error||'network');
  this.busy=false;this.opts.changed();
 }
 cancel():void{this.pending?.();}
 async redeem(code:string):Promise<void>{
  const saved=this.saved();if(!saved){this.signedOut('unauthorized');this.opts.changed();return;}
  this.busy=true;this.error=undefined;this.opts.changed();
  const reply=await request(this.opts.url+'/api/invite/redeem',{method:'POST',headers:this.headers(saved.token),body:JSON.stringify({code}),signal:AbortSignal.timeout(15000)});
  this.busy=false;if(this.stopped||this.saved()?.token!==saved.token)return;
  if(reply.status===200){this.secrets.set('beta',{...saved,admitted:true,verifiedAt:Date.now()});this.set('active');this.online=true;this.error=undefined;}
  else if(reply.status===401)this.signedOut(reply.body?.error||'unauthorized');
  else this.error=betaMessage(reply.body?.error||'network');
  this.opts.changed();
 }
 async retry():Promise<void>{await this.verify();}
 async signOut():Promise<void>{
  const saved=this.saved();this.cancel();
  if(saved)await request(this.opts.url+'/api/logout',{method:'POST',headers:this.headers(saved.token),signal:AbortSignal.timeout(5000)});
  this.secrets.delete('beta');this.set('signed_out');this.online=true;this.error=undefined;this.busy=false;this.opts.changed();
 }
 stop():void{this.stopped=true;clearInterval(this.timer);this.timer=undefined;this.cancel();}
}
