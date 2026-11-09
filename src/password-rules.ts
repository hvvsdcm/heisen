// Password requirement inference (passwordrules > minlength/maxlength/pattern > nearby hint text) and a Chromium-style generator (components/password_manager/core/browser/generation/password_generator.cc). Pure functions, no Electron.
import {randomInt} from 'node:crypto';
export type CharClass='lower'|'upper'|'digit'|'special';
export type PasswordRules={minLength:number;maxLength:number;required:CharClass[];allowed:CharClass[];specials:string};
export type RuleSource={passwordrules?:string;minlength?:string;maxlength?:string;pattern?:string;hints:string[]};
const CLASSES:CharClass[]=['lower','upper','digit','special'],SAFE='-_.:!',COMMON='-_.:!@#$%^&*',MAX_LENGTH=200;
const SETS={lower:'abcdefghijkmnpqrstuvwxyz',upper:'ABCDEFGHJKLMNPQRSTUVWXYZ',digit:'23456789'};
const LABELS:[CharClass,string][]=[['upper','대문자'],['lower','소문자'],['digit','숫자'],['special','특수문자']];
const UNIT='(?:자리|글자|자|characters?|chars?)';
const RANGE=new RegExp(`(\\d{1,3})\\s*(?:자리|글자|자)?\\s*(?:~|-|–|to)\\s*(\\d{1,3})\\s*${UNIT}`,'i'),MINS=[/(?:최소|\b(?:minimum|at least|min\.?))\s*(\d{1,3})/i,/(\d{1,3})\s*(?:자리|글자|자|characters?)\s*(?:이상|or more|minimum)/i],MAXES=[/(?:최대|\b(?:maximum|up to|no more than))\s*(\d{1,3})/i,/(\d{1,3})\s*(?:자리|글자|자|characters?)\s*(?:이하|or less|maximum)/i];
const HINT_CLASSES:[RegExp,CharClass][]=[[/대문자|uppercase|capital/i,'upper'],[/소문자|lowercase/i,'lower'],[/숫자|number|digit|numeric/i,'digit'],[/특수\s*문자|기호|special|symbol|punctuation/i,'special'],[/영문|letter|alphabet/i,'lower']];
const NO_SPECIAL=/특수\s*문자\s*(?:사용\s*)?(?:불가|제외|없이)|(?:no|without|cannot contain)\s+special|letters and (?:numbers|digits) only|영문(?:과|,)?\s*숫자만/i;
const HINT_SPECIALS=/(?:특수\s*문자|기호|special(?:\s+characters?)?|symbols?)\s*[(\[:：]?\s*((?:[!-/:-@[-`{-~]\s*,?\s*){2,})/i;
export const DEFAULT_RULES:PasswordRules={minLength:8,maxLength:200,required:[],allowed:[...CLASSES],specials:SAFE};
const classOf=(c:string):CharClass=>c>='a'&&c<='z'?'lower':c>='A'&&c<='Z'?'upper':c>='0'&&c<='9'?'digit':'special';
const int=(s:string|undefined)=>s!==undefined&&/^\s*\d+\s*$/.test(s)?Number(s):NaN;
const unique=(s:string)=>[...new Set(s)].join('');
// Classes covered by a regex bracket body (without the brackets/caret), plus its listed special characters.
function bracket(body:string){const classes=new Set<CharClass>();let chars='';const add=(c:string)=>{const k=classOf(c);classes.add(k);if(k==='special')chars+=c;};
 for(let i=0;i<body.length;i++){const c=body[i];
  if(c==='\\'){const e=body[++i];if(e==='d')classes.add('digit');else if(e==='w')['lower','upper','digit'].forEach(k=>classes.add(k as CharClass));else if(e==='W')classes.add('special');else if(e!==undefined&&!/[sSDbBnrtv]/.test(e))add(e);continue;}
  if(body[i+1]==='-'&&i+2<body.length&&body[i+2]!=='\\'){const from=Math.max(c.charCodeAt(0),0x21),to=Math.min(body.charCodeAt(i+2),0x7e);for(let k=from;k<=to;k++)add(String.fromCharCode(k));i+=2;continue;}
  add(c);}
 return {classes,chars:unique(chars)};}
// The class a lookahead such as (?=.*[A-Z]) or (?=.*\d) demands, judged by its last character token.
function lookahead(body:string):{cls:CharClass;chars:string}|undefined{
 const t=[...body.matchAll(/\[(\^?)((?:\\.|[^\]\\])*)\]|\\([dWw])/g)].at(-1);if(!t)return;
 if(t[3])return t[3]==='d'?{cls:'digit',chars:''}:t[3]==='W'?{cls:'special',chars:''}:undefined;
 const {classes,chars}=bracket(t[2]);
 if(t[1])return classes.has('lower')&&classes.has('upper')&&classes.has('digit')?{cls:'special',chars:''}:undefined;
 if(classes.size===1){const cls=[...classes][0];return {cls,chars:cls==='special'?chars:''};}
 if(classes.size===2&&classes.has('lower')&&classes.has('upper'))return {cls:'lower',chars:''};}
export function parseRules(src:RuleSource):PasswordRules{
 let min=DEFAULT_RULES.minLength,max=DEFAULT_RULES.maxLength,specials='',limited=false,noSpecial=false;const required=new Set<CharClass>(),allowed=new Set<CharClass>();
 // 1. Apple passwordrules: "minlength: 10; required: upper; allowed: [-_!]".
 for(const part of (src.passwordrules||'').split(';')){const m=/^\s*([\w-]+)\s*:\s*(.*?)\s*$/.exec(part);if(!m)continue;const key=m[1].toLowerCase();
  if(key==='minlength'||key==='maxlength'){const n=int(m[2]);if(Number.isFinite(n)){if(key==='minlength')min=n;else max=n;}continue;}
  if(key!=='required'&&key!=='allowed')continue;const target=key==='required'?required:allowed;if(key==='allowed')limited=true;
  for(const v of m[2].matchAll(/\[([^\]]*)\]|[\w-]+/g)){
   if(v[1]!==undefined){for(const c of v[1]){const k=classOf(c);target.add(k);if(k==='special')specials+=c;}continue;}
   const id=v[0].toLowerCase();if(id==='ascii-printable'||id==='unicode')CLASSES.forEach(c=>target.add(c));else if((CLASSES as string[]).includes(id))target.add(id as CharClass);}}
 specials=unique(specials);const allow=limited?new Set([...allowed,...required]):new Set(CLASSES);
 // 2. minlength/maxlength attributes only tighten.
 const lo=int(src.minlength),hi=int(src.maxlength);if(Number.isFinite(lo))min=Math.max(min,lo);if(Number.isFinite(hi))max=Math.min(max,hi);
 // 3. pattern attribute: lookaheads name required classes, {n,m} names the length.
 if(src.pattern)try{for(const m of src.pattern.matchAll(/\(\?=([^()]*)\)/g)){const r=lookahead(m[1]);if(!r)continue;required.add(r.cls);if(r.cls==='special'&&!specials&&r.chars){const common=[...r.chars].filter(c=>COMMON.includes(c)).join('');specials=common||r.chars;}}
  const len=/\{(\d+),(\d*)\}/.exec(src.pattern.replace(/\(\?=[^()]*\)/g,''));if(len){min=Math.max(min,Number(len[1]));if(len[2])max=Math.min(max,Number(len[2]));}}catch{}
 // 4. Hint and error text near the field (Korean + English). Mentioned classes become required.
 for(const h of src.hints){if(typeof h!=='string')continue;
  const r=RANGE.exec(h);if(r&&Number(r[1])<=Number(r[2])){min=Math.max(min,Number(r[1]));max=Math.min(max,Number(r[2]));}
  for(const re of MINS){const m=re.exec(h);if(m)min=Math.max(min,Number(m[1]));}
  for(const re of MAXES){const m=re.exec(h);if(m)max=Math.min(max,Number(m[1]));}
  for(const [re,cls] of HINT_CLASSES)if(re.test(h))required.add(cls);
  if(NO_SPECIAL.test(h))noSpecial=true;
  const listed=HINT_SPECIALS.exec(h);if(listed&&!specials){const chars=unique(listed[1].replace(/[\s,()[\]]/g,''));if(chars.length>=2)specials=chars;}}
 if(noSpecial){allow.delete('special');required.delete('special');}
 // 5. Sanitize like Chromium's SanitizeRequirementsSpec.
 if(!allow.size)CLASSES.forEach(c=>allow.add(c));
 if(!(max>=4))max=MAX_LENGTH;if(min>max)min=max;if(!(min>=4))min=4;
 return {minLength:min,maxLength:max,required:CLASSES.filter(c=>required.has(c)&&allow.has(c)),allowed:CLASSES.filter(c=>allow.has(c)),specials:specials||SAFE};}
export function describePassword(password:string):{length:number;classes:CharClass[]}{const chars=[...password];const seen=new Set(chars.map(classOf));return {length:chars.length,classes:CLASSES.filter(c=>seen.has(c))};}
export function missingFor(password:string,rules:PasswordRules):string[]{const {length,classes}=describePassword(password);const out:string[]=[];
 if(length<rules.minLength)out.push(`${rules.minLength}자 이상`);if(length>rules.maxLength)out.push(`${rules.maxLength}자 이하`);
 for(const [c,label] of LABELS)if(rules.required.includes(c)&&!classes.includes(c))out.push(label);
 for(const [c,label] of LABELS)if(classes.includes(c)&&!rules.allowed.includes(c))out.push(label+' 제외');
 return out;}
export function satisfies(password:string,rules:PasswordRules):boolean{return missingFor(password,rules).length===0;}
function shuffle(chars:string[]){for(let i=chars.length-1;i>0;i--){const j=randomInt(i+1);[chars[i],chars[j]]=[chars[j],chars[i]];}}
function build(rules:PasswordRules):string{
 const target=Math.max(1,Math.min(Math.max(15,rules.minLength),rules.maxLength,MAX_LENGTH));const sets:string[][]=[];
 for(const c of ['lower','upper','digit'] as const)if(rules.allowed.includes(c))sets.push([...SETS[c]]);
 if(rules.required.includes('special')||(!sets.length&&rules.allowed.includes('special'))){const own=[...rules.specials].filter(c=>classOf(c)==='special'),safe=own.filter(c=>SAFE.includes(c));sets.push(safe.length?safe:own.length?own:[...SAFE]);}
 if(!sets.length)sets.push([...SETS.lower]);
 const pick=(s:string[])=>s[randomInt(s.length)],all=sets.flat(),chars=sets.slice(0,target).map(pick);while(chars.length<target)chars.push(pick(all));
 let out='';for(let i=0;i<6;i++){shuffle(chars);out=chars.join('');if(!/--|__/.test(out))break;}
 return out;}
export function generatePassword(rules:PasswordRules):string{const first=build(rules);return satisfies(first,rules)?first:build(rules);}
export function aliasEmail(email:string,origin:string):string{const at=email.lastIndexOf('@');if(at<1||email.includes('+'))return email;let host:string;try{host=new URL(origin).hostname;}catch{return email;}const label=host.replace(/^www\./i,'').toLowerCase().replace(/[^a-z0-9]/g,'');return label?`${email.slice(0,at)}+${label}${email.slice(at)}`:email;}
