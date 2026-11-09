import {createHash,randomBytes} from 'node:crypto';
export const BETA_SERVER='https://heisen.dev';
export const GRACE_MS=7*24*60*60*1000,VERIFY_EVERY_MS=6*60*60*1000;
export type BetaSession={token:string;email:string;name?:string;admitted:boolean;verifiedAt:number;expiresAt:number};
export type BetaStatus='checking'|'signed_out'|'invite'|'active'|'offline';
// Release builds always talk to heisen.dev; HEISEN_BETA_URL (an http(s) origin, or 'skip' to bypass the gate) is honoured only in
// development (unpackaged) and in test packages (heisenTestBuild in the staged package.json).
export function betaServer(env:NodeJS.ProcessEnv,packaged:boolean,testBuild:boolean):{url:string;skip:boolean}{
 const value=(!packaged||testBuild)?env.HEISEN_BETA_URL:undefined;if(!value)return {url:BETA_SERVER,skip:false};if(value==='skip')return {url:BETA_SERVER,skip:true};
 const u=new URL(value);if(u.protocol!=='http:'&&u.protocol!=='https:')throw new Error('HEISEN_BETA_URL must be an http(s) URL');return {url:u.origin,skip:false};
}
// RFC 7636 S256: the verifier is 32 random bytes in base64url (43 chars), the challenge is base64url(sha256(verifier)).
export function pkcePair(bytes:Buffer=randomBytes(32)):{verifier:string;challenge:string}{const verifier=bytes.toString('base64url');return {verifier,challenge:createHash('sha256').update(verifier).digest('base64url')};}
// Reads the loopback HTTP request target; only /callback belongs to the pending sign-in.
export function callbackParams(url:string,state:string):{code:string}|{error:string}|null{
 if(!url.startsWith('/'))return null;let u:URL;try{u=new URL('http://127.0.0.1'+url);}catch{return null;}if(u.pathname!=='/callback')return null;
 const q=u.searchParams;if(q.get('state')!==state)return {error:'state_mismatch'};const error=q.get('error');if(error!==null)return {error};const code=q.get('code');if(code)return {code};return {error:'invalid_response'};
}
export function decide(saved:BetaSession|undefined,now:number):BetaStatus{if(!saved||saved.expiresAt<=now)return 'signed_out';if(!saved.admitted)return 'invite';return now-saved.verifiedAt<=GRACE_MS?'active':'offline';}
const MESSAGES:Record<string,string>={invalid_grant:'로그인을 완료하지 못했습니다. 다시 시도하세요.',login_failed:'로그인을 완료하지 못했습니다. 다시 시도하세요.',access_denied:'로그인이 취소되었습니다.',state_mismatch:'로그인 응답이 올바르지 않습니다. 다시 시도하세요.',invalid_response:'로그인 응답이 올바르지 않습니다. 다시 시도하세요.',account_disabled:'이 계정은 베타 참여가 중지되었습니다.',unauthorized:'세션이 만료되었거나 해지되었습니다. 다시 로그인하세요.',invalid_code:'초대 코드가 올바르지 않습니다.',code_exhausted:'사용 횟수를 초과한 초대 코드입니다.',code_expired:'만료된 초대 코드입니다.',code_revoked:'사용할 수 없는 초대 코드입니다.',too_many_attempts:'시도 횟수를 초과했습니다. 관리자에게 문의하세요.',rate_limited:'잠시 후 다시 시도하세요.',network:'서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.'};
export function betaMessage(code:string):string{return Object.hasOwn(MESSAGES,code)?MESSAGES[code]:'오류가 발생했습니다. 다시 시도하세요.';}
