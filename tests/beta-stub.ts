import http from 'node:http';
import {createHash,randomBytes} from 'node:crypto';
// In-memory stand-in for the heisen-web beta API (heisen.dev) used by tests/e2e-beta.ts. It mirrors the Worker's contract:
// /auth/start → sign-in form → http://127.0.0.1:<redirect_port>/callback?code&state, PKCE-bound one-time app codes, Bearer sessions, per-account admission
// via one-use invite codes. Tokens live only in memory.
type Account={email:string;name:string|null;admitted:boolean};
type Session={email:string;revoked:boolean;createdAt:number};
export type BetaStub={url:string;requests:string[];tokens:string[];revokeAll():void;setDown(down:boolean):void;close():Promise<void>};
const SESSION_MS=90*24*60*60*1000;
const page=(title:string,body:string)=>`<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font:15px system-ui;background:#1f1f1f;color:#e3e3e3;padding:40px">${body}</body>`;
export async function startBetaStub(opts:{codes?:string[]}={}):Promise<BetaStub>{
 const codes=opts.codes||[],usedCodes=new Set<string>();
 const flows=new Map<string,{challenge:string;port:number}>(),appCodes=new Map<string,{email:string;challenge:string;expires:number}>();
 const accounts=new Map<string,Account>(),sessions=new Map<string,Session>();
 const requests:string[]=[],tokens:string[]=[];let down=false;
 const send=(res:http.ServerResponse,status:number,body?:Record<string,unknown>)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(body?JSON.stringify(body):undefined);};
 const html=(res:http.ServerResponse,status:number,text:string)=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(text);};
 const read=async(req:http.IncomingMessage)=>{let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)throw new Error('too large');}return raw;};
 const bearer=(req:http.IncomingMessage)=>{const m=/^Bearer (hsb_[\w-]+)$/.exec(req.headers.authorization||'');const s=m&&sessions.get(m[1]);return s&&!s.revoked&&Date.now()<s.createdAt+SESSION_MS?{session:s,account:accounts.get(s.email)!}:undefined;};
 const user=(a:Account)=>({id:'u_'+createHash('sha256').update(a.email).digest('base64url').slice(0,16),email:a.email,name:a.name,admitted:a.admitted});
 const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url||'/','http://stub'),route=`${req.method} ${u.pathname}`;requests.push(route);
  if(down){send(res,503,{error:'unavailable'});return;}
  try{
   if(route==='GET /auth/start'){
    const q=u.searchParams,state=q.get('state')||'',port=q.get('redirect_port')||'';
    if(q.get('client')!=='app'||!/^[\w-]{16,128}$/.test(state)||!/^[\w-]{43}$/.test(q.get('code_challenge')||'')||q.get('code_challenge_method')!=='S256'||!/^[1-9][0-9]{3,4}$/.test(port)||Number(port)<1024||Number(port)>65535){send(res,400,{error:'invalid_request'});return;}
    flows.set(state,{challenge:q.get('code_challenge')!,port:Number(port)});res.writeHead(302,{Location:'/stub/login?state='+encodeURIComponent(state),'Cache-Control':'no-store'});res.end();return;
   }
   if(route==='GET /stub/login'){const state=(u.searchParams.get('state')||'').replace(/[&<>"']/g,c=>`&#${c.charCodeAt(0)};`);html(res,200,page('Stub sign-in',`<form method="post" action="/stub/login"><label>Email <input name="email" type="email" required autofocus></label><input type="hidden" name="state" value="${state}"><button>Sign in</button></form>`));return;}
   if(route==='POST /stub/login'){
    const form=new URLSearchParams(await read(req)),state=form.get('state')||'',email=(form.get('email')||'').trim(),flow=flows.get(state);
    if(!flow||!email){html(res,400,page('Expired','로그인 요청이 만료되었습니다.'));return;}
    flows.delete(state);if(!accounts.has(email))accounts.set(email,{email,name:null,admitted:false});
    const code='hac_'+randomBytes(32).toString('base64url');appCodes.set(code,{email,challenge:flow.challenge,expires:Date.now()+120000});
    res.writeHead(302,{Location:`http://127.0.0.1:${flow.port}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,'Cache-Control':'no-store'});res.end();return;
   }
   if(route==='GET /auth/app/complete'){html(res,200,page('Heisen','로그인이 끝났습니다. Heisen 앱으로 돌아가세요.'));return;}
   if(u.pathname.startsWith('/api/')&&req.headers.origin){send(res,403,{error:'forbidden'});return;}
   if(route==='POST /api/app/token'){
    const body=JSON.parse(await read(req)),grant=typeof body.code==='string'?appCodes.get(body.code):undefined;
    if(grant)appCodes.delete(body.code);
    if(!grant||grant.expires<Date.now()||typeof body.code_verifier!=='string'||createHash('sha256').update(body.code_verifier).digest('base64url')!==grant.challenge){send(res,400,{error:'invalid_grant'});return;}
    const token='hsb_'+randomBytes(32).toString('base64url'),now=Date.now();sessions.set(token,{email:grant.email,revoked:false,createdAt:now});tokens.push(token);
    send(res,200,{token,expires_at:now+SESSION_MS,user:user(accounts.get(grant.email)!)});return;
   }
   if(route==='POST /api/logout'){const auth=bearer(req);if(auth)auth.session.revoked=true;send(res,204);return;}
   const auth=bearer(req);
   if(u.pathname.startsWith('/api/')&&!auth){send(res,401,{error:'unauthorized'});return;}
   if(route==='GET /api/me'){send(res,200,{user:user(auth!.account),session:{expires_at:auth!.session.createdAt+SESSION_MS,last_seen_at:Date.now()}});return;}
   if(route==='POST /api/invite/redeem'){
    const account=auth!.account;if(account.admitted){send(res,200,{user:user(account)});return;}
    const body=JSON.parse(await read(req)),code=typeof body.code==='string'?body.code.toUpperCase().replace(/[^A-Z0-9]/g,''):'';
    const match=codes.find(c=>c.replace(/-/g,'')===code);
    if(!match){send(res,400,{error:'invalid_code'});return;}
    if(usedCodes.has(match)){send(res,400,{error:'code_exhausted'});return;}
    usedCodes.add(match);account.admitted=true;send(res,200,{user:user(account)});return;
   }
   send(res,404,{error:'not_found'});
  }catch{send(res,400,{error:'invalid_request'});}
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('stub server has no TCP address');
 return {url:'http://127.0.0.1:'+address.port,requests,tokens,
  revokeAll(){for(const s of sessions.values())s.revoked=true;},
  setDown(value){down=value;},
  close(){server.closeAllConnections();return new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
