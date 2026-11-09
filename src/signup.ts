import {randomUUID} from 'node:crypto';
import type {Data,Secrets} from './data.ts';
import type {SignupProvider} from './browser.ts';
import type {Passwords} from './passwords.ts';
import {aliasEmail,describePassword,generatePassword,missingFor,satisfies} from './password-rules.ts';
import {textArg} from './protocol.ts';
import {registerRpc,registerState} from './rpc.ts';
// Password presets for automatic sign-up; kept only in secrets.json (safeStorage), never in UI state or agent output.
export type Preset={id:string;name:string;password:string;createdAt:number};
type Deps={data:Data;secrets:Secrets;passwords:Passwords;changed:()=>void};
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/,MAX_EMAILS=10,MAX_PRESETS=20,MODES:readonly string[]=['generate','preset'];
const isPreset=(v:any):v is Preset=>!!v&&typeof v.id==='string'&&typeof v.name==='string'&&typeof v.password==='string'&&typeof v.createdAt==='number';
// Sign-up settings (default emails, password mode), presets and the first-run wizard's completion; supplies browser.signup for web_signup/fill_signup.
export class Signup {
 constructor(private deps:Deps){}
 install():void{
  const {data,secrets,changed}=this.deps;
  registerRpc({
   'signup.save':a=>{
    const cur=data.state.settings.signup,has=(k:string)=>a[k]!==undefined;
    if(!has('emails')&&!has('mode')&&!has('alias'))throw new Error('Invalid sign-up settings');
    if(has('emails')&&!Array.isArray(a.emails)||has('mode')&&!MODES.includes(a.mode)||has('alias')&&typeof a.alias!=='boolean')throw new Error('Invalid sign-up settings');
    let emails=cur.emails;
    if(has('emails')){
     emails=[...new Set(a.emails.map((e:unknown)=>textArg(e,254).trim()))] as string[];
     if(emails.some(e=>!EMAIL.test(e)))throw new Error('이메일 형식이 올바르지 않습니다.');
     if(emails.length>MAX_EMAILS)throw new Error(`이메일은 ${MAX_EMAILS}개까지 추가할 수 있습니다.`);
    }
    data.state.settings.signup={mode:has('mode')?a.mode:cur.mode,emails,alias:has('alias')?a.alias:cur.alias};data.save();changed();return true;
   },
   'signup.presetAdd':a=>{
    const name=textArg(a.name,40).trim()||'기본',password=textArg(a.password,200);
    if(password.length<4)throw new Error('비밀번호는 4자 이상이어야 합니다.');
    const presets=this.presets();if(presets.length>=MAX_PRESETS)throw new Error(`비밀번호 세트는 ${MAX_PRESETS}개까지 추가할 수 있습니다.`);
    const id=randomUUID();secrets.set('signupPresets',[...presets,{id,name,password,createdAt:Date.now()}]);changed();return {id};
   },
   'signup.presetDelete':a=>{const id=textArg(a.id,100);secrets.set('signupPresets',this.presets().filter(p=>p.id!==id));changed();return true;},
   'onboarding.done':()=>{data.state.settings.onboarded=true;data.state.settings.importOffered=true;data.save();changed();return true;},
  });
  registerState('signupPresets',()=>this.presets().map(p=>({id:p.id,name:p.name,...describePassword(p.password)})));
 }
 presets():Preset[]{const raw=this.deps.secrets.get<unknown>('signupPresets');return Array.isArray(raw)?raw.filter(isPreset):[];}
 // The first attempt on a site may use the +alias; retries use the plain default email (sites that reject "+").
 provider():SignupProvider{
  const {data,passwords}=this.deps;
  return {
   mode:()=>data.state.settings.signup.mode,
   email:(origin,attempt)=>{const {emails,alias}=data.state.settings.signup,base=emails[0];return !base?null:alias&&attempt===0?aliasEmail(base,origin):base;},
   // Preset mode never falls back to a generated password: the first untried preset that fits the rules, else an error naming what is missing.
   password:(rules,tried)=>{
    if(data.state.settings.signup.mode==='generate')return {password:generatePassword(rules)};
    const presets=this.presets(),left=presets.filter(p=>!tried.includes(p.id)),fit=left.find(p=>satisfies(p.password,rules));
    if(fit)return {password:fit.password,preset:{id:fit.id,name:fit.name}};
    throw new Error('비밀번호 조건에 맞는 세트가 없습니다: '+(left.length?missingFor(left[0].password,rules).join(', '):presets.length?'이미 시도함':'세트 없음'));
   },
   record:e=>passwords.record(e),
  };
 }
}
