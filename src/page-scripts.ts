// Functions serialized into executeJavaScriptInIsolatedWorld. Each one must be self-contained: no imports, no outer references (types are erased, so shared types are fine).
// Exception: world-1001 scripts may use the isolated-world global __heisenSecure; Browser.run installs it with sensitiveSetup before every world-1001 script.
import type {RuleSource} from './password-rules.ts';
export function pageScript<A>(fn:(arg:A)=>unknown,arg?:A){return `(${fn.toString()})(${arg===undefined?'':JSON.stringify(arg)})`;}
export type SnapshotElement={ref:string;tag:string;role:string;name:string;label:string;href?:string;value?:string;checked?:boolean;disabled?:boolean};
export type Snapshot={snapshot:string;url:string;title:string;text:string;elements:SnapshotElement[]};
export type SignupScan={found:boolean;passwordFields:number;hasEmail:boolean;username:string;rules:RuleSource};
// Isolated-world globals: the latest snapshot's ref → element map, and the sensitive-field tracker.
type Secure={payment:(el:Element)=>boolean;sensitive:(el:Element)=>boolean;values:()=>string[];scrubber:()=>(s:string)=>string};
type Heisen={__heisen?:{id:string;nodes:Map<string,Element>;url:string};__heisenSecure?:Secure};
// World 1001: Browser runs it at dom-ready on every user tab and again before every world-1001 script; the first run per document wins.
// A value-carrying input is sensitive if it is or ever was type=password while observed (a type-attribute observer catches
// "show password" toggles), or its autocomplete or name/id marks it as a password. Name/id hints include pw-style names
// (pw, userPw, user_pw, USER_PW, pw_confirm) but not words such as pwa; one-time-code fields are not sensitive.
// Payment fields are also sensitive. values() includes 3-character CVCs; scrubber() masks sensitive values in agent-bound text.
export function sensitiveSetup():void{
 const g=globalThis as Heisen;if(g.__heisenSecure)return;
 const seen=new WeakSet<Element>();
 const valueless:Record<string,true>={checkbox:true,radio:true,submit:true,reset:true,button:true,image:true,file:true,hidden:true,range:true,color:true};
 const isInput=(el:Element):el is HTMLInputElement=>el.tagName==='INPUT';
 new MutationObserver(records=>{for(const r of records)if((r.oldValue||'').trim().toLowerCase()==='password')seen.add(r.target as Element);}).observe(document,{subtree:true,attributes:true,attributeFilter:['type'],attributeOldValue:true});
 const payment=(el:Element)=>isInput(el)&&(/(^|\s)cc-/i.test(el.getAttribute('autocomplete')||'')||/card.?(number|num|no)|cvv|cvc|csc|expir|security.?code|카드.?번호|유효기간/i.test(el.name+' '+el.id+' '+(el.getAttribute('aria-label')||'')));
 const sensitive=(el:Element)=>isInput(el)&&!valueless[el.type]&&(payment(el)||el.type==='password'||seen.has(el)||/current-password|new-password/i.test(el.getAttribute('autocomplete')||'')||/password|passwd|passcode|pwd|(^|[_\-\s])pass($|[_\-\s])/i.test(el.name+' '+el.id)||/[pP]w(?![a-z])|PW(?![A-Za-z])/.test(el.name+' '+el.id));
 const values=()=>Array.from(document.querySelectorAll('input')).filter(i=>sensitive(i)&&i.value.length>=(payment(i)?1:4)).map(i=>i.value).sort((a,b)=>b.length-a.length);
 g.__heisenSecure={payment,sensitive,values,scrubber:()=>{const secrets=values();return (s:string)=>{for(const v of secrets)if(s.includes(v))s=s.split(v).join('••••••••');return s;};}};
}
// World 1001. Stores the ref → element map in the isolated-world global __heisen. Sensitive inputs show role password and no value.
export function snapshotScript():Snapshot{
 const id=crypto.randomUUID(),nodes=new Map<string,Element>(),elements:SnapshotElement[]=[];
 const sec=(globalThis as Heisen).__heisenSecure!,scrub=sec.scrubber();
 const clean=(s:string|null|undefined,max:number)=>scrub(s||'').replace(/\s+/g,' ').trim().slice(0,max);
 const textOf=(ids:string)=>ids.split(/\s+/).map(i=>document.getElementById(i)?.textContent||'').join(' ');
 const textRoles:Record<string,string>={checkbox:'checkbox',radio:'radio',submit:'button',reset:'button',button:'button',image:'button',file:'file',password:'password'};
 for(const node of Array.from(document.querySelectorAll('a[href],button,input,textarea,select,[role],[contenteditable="true"],[tabindex]:not([tabindex="-1"])'))){
  const el=node as HTMLElement,input=node as HTMLInputElement,tag=node.tagName.toLowerCase(),type=tag==='input'?input.type:'',secret=sec.sensitive(node);
  if(type==='hidden')continue;
  const r=el.getBoundingClientRect();if(type!=='file'&&!(r.width>0&&r.height>0&&el.checkVisibility?.()!==false))continue;
  const explicit=(el.getAttribute('role')||'').trim().split(/\s+/)[0];
  const role=secret?'password':type==='file'?type:explicit||(tag==='a'?'link':tag==='button'?'button':tag==='select'?'combobox':tag==='input'?textRoles[type]||'textbox':tag==='textarea'||el.isContentEditable?'textbox':'generic');
  const labels=(node as HTMLInputElement).labels;
  const name=clean(el.getAttribute('aria-label'),120)||clean(el.hasAttribute('aria-labelledby')?textOf(el.getAttribute('aria-labelledby')!):'',120)||clean(labels?Array.from(labels).map(l=>l.textContent).join(' '):'',120)||clean(el.getAttribute('placeholder'),120)||clean(el.getAttribute('title'),120)||clean(el.getAttribute('alt'),120)||clean(tag==='input'&&['submit','reset','button'].includes(type)?input.value:el.textContent,120);
  const ref='e'+(nodes.size+1);nodes.set(ref,node);
  const item:SnapshotElement={ref,tag,role,name,label:scrub(el.getAttribute('aria-label')||el.getAttribute('placeholder')||el.textContent||'').trim().slice(0,160)};
  if(node instanceof HTMLAnchorElement)item.href=scrub(node.href);
  if(role==='textbox')item.value=scrub(tag==='input'||tag==='textarea'?input.value:el.innerText||'').slice(0,200);
  if(role==='checkbox'||role==='radio')item.checked=tag==='input'?input.checked:el.getAttribute('aria-checked')==='true';
  if((el as HTMLButtonElement).disabled===true||el.getAttribute('aria-disabled')==='true')item.disabled=true;
  elements.push(item);if(nodes.size>=300)break;
 }
 (globalThis as Heisen).__heisen={id,nodes,url:location.href};
 return {snapshot:id,url:scrub(location.href),title:scrub(document.title),text:scrub(document.body?.innerText||'').slice(0,22000),elements};
}
// World 1001. Validates a snapshot ref and returns its viewport center. method: click | fill (typeable, not sensitive, focused) | focus.
export function targetScript(a:{snapshot?:string;ref:string;method:'click'|'fill'|'focus';origins?:string[]}):{x:number;y:number}|{error:string}{
 try{
  const s=(globalThis as Heisen).__heisen;const node=s?.nodes.get(a.ref) as HTMLElement|undefined;
  if(!s||s.id!==a.snapshot||s.url!==location.href||!node?.isConnected)throw new Error('관찰이 만료되었습니다. 다시 읽어 주세요.');
  const input=node as HTMLInputElement;
  if(a.method==='fill'&&(globalThis as Heisen).__heisenSecure!.payment(node))throw new Error('결제 정보 입력은 지원하지 않습니다.');
  if(a.method==='fill'&&((globalThis as Heisen).__heisenSecure!.sensitive(node)||!(node.tagName==='TEXTAREA'||node.isContentEditable||node.tagName==='INPUT'&&['text','email','search','url','tel','number'].includes(input.type))))throw new Error('이 필드에는 입력할 수 없습니다.');
  const link=node.closest('a');if(a.origins&&link?.href&&!a.origins.includes(new URL(link.href).origin))throw new Error('허용된 사이트 밖의 링크입니다.');
  if(input.disabled||input.readOnly)throw new Error('비활성 필드입니다.');
  node.scrollIntoView({block:'center'});if(a.method!=='click')node.focus();
  const r=node.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;const top=document.elementFromPoint(x,y);
  if(!top||!(node===top||node.contains(top)))throw new Error('대상이 다른 요소에 가려져 있습니다.');
  delete (globalThis as Heisen).__heisen;return {x,y};
 }catch(e){return {error:(e as Error).message};}
}
// World 1001. Readable Markdown of the visible page, capped at 100,000 characters. Sensitive input values are masked.
export function markdownScript():{title:string;url:string;markdown:string}{
 const scrub=(globalThis as Heisen).__heisenSecure!.scrubber();
 const skip:Record<string,true>={SCRIPT:true,STYLE:true,NOSCRIPT:true,SVG:true,TEMPLATE:true,HEAD:true,SELECT:true,TEXTAREA:true,IFRAME:true,CANVAS:true};
 const blocks:Record<string,true>={P:true,DIV:true,SECTION:true,ARTICLE:true,MAIN:true,HEADER:true,FOOTER:true,NAV:true,ASIDE:true,FORM:true,FIGURE:true,FIGCAPTION:true,DL:true,DT:true,DD:true,ADDRESS:true,DETAILS:true,SUMMARY:true,FIELDSET:true,HR:true,LI:true};
 const kept:string[]=[],INDENT='\u0002';
 const keep=(s:string)=>'\u0001'+(kept.push(s)-1)+'\u0001';
 const hidden=(el:Element)=>(el as HTMLElement).hidden||el.getAttribute('aria-hidden')==='true'||el.checkVisibility?.()===false;
 const inline=(s:string)=>s.replace(/\s*\n+\s*/g,' ').trim();
 const walk=(node:Node,depth:number):string=>{
  if(node.nodeType===Node.TEXT_NODE)return scrub(node.textContent||'').replace(/\s+/g,' ');
  if(node.nodeType!==Node.ELEMENT_NODE)return '';
  const el=node as HTMLElement,tag=el.tagName.toUpperCase();
  if(skip[tag]||hidden(el))return '';
  const inner=()=>Array.from(el.childNodes).map(c=>walk(c,depth)).join('');
  const heading=/^H([1-6])$/.exec(tag);
  if(heading){const t=inline(inner());return t?`\n\n${'#'.repeat(Number(heading[1]))} ${t}\n\n`:'';}
  switch(tag){
   case 'BR':return '\n';
   case 'IMG':{const alt=inline(el.getAttribute('alt')||'');return alt?` ${alt} `:'';}
   case 'A':{const t=inline(inner()),href=(el as HTMLAnchorElement).href;return t&&/^https?:/i.test(href)?`[${t.replace(/[[\]]/g,'\\$&')}](${href.replace(/[()\s]/g,c=>encodeURIComponent(c))})`:t?` ${t} `:'';}
   case 'PRE':{const code=(el.innerText||el.textContent||'').replace(/\n+$/,'');return code?`\n\n${keep('```\n'+code+'\n```')}\n\n`:'';}
   case 'CODE':{const t=(el.textContent||'').replace(/\s+/g,' ').trim();return t?'`'+t.replace(/`/g,'\\`')+'`':'';}
   case 'BLOCKQUOTE':{const t=inner().trim();return t?'\n\n'+t.replace(/\n{3,}/g,'\n\n').split('\n').map(l=>'> '+l.trim()).join('\n')+'\n\n':'';}
   case 'UL':case 'OL':{
    const items=Array.from(el.children).filter(c=>c.tagName==='LI'&&!hidden(c));const start=Number(el.getAttribute('start'))||1;
    const lines=items.map((li,i)=>{const body=Array.from(li.childNodes).map(c=>walk(c,depth+1)).join('').trim().replace(/\n{2,}/g,'\n');return INDENT.repeat(depth)+(tag==='OL'?`${start+i}. `:'- ')+body;}).filter(l=>l.trim());
    return lines.length?(depth?'\n':'\n\n')+lines.join('\n')+(depth?'\n':'\n\n'):'';
   }
   case 'TABLE':{
    const rows=Array.from((el as HTMLTableElement).rows).filter(r=>!hidden(r)).map(r=>Array.from(r.cells).map(c=>inline(walk(c,depth)).replace(/\|/g,'\\|')));
    if(!rows.length)return '';const width=Math.max(...rows.map(r=>r.length));const line=(r:string[])=>'| '+Array.from({length:width},(_,i)=>r[i]||'').join(' | ')+' |';
    return '\n\n'+[line(rows[0]),'|'+' --- |'.repeat(width),...rows.slice(1).map(line)].join('\n')+'\n\n';
   }
  }
  const t=inner();return blocks[tag]?`\n\n${t.trim()}\n\n`:t;
 };
 let md=walk(document.body||document.documentElement,0).replace(/[ \t]+\n/g,'\n').replace(/\n[ \t]+/g,'\n').replace(/[ \t]{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim();
 md=scrub(md.replace(/\u0002/g,'  ').replace(/\u0001(\d+)\u0001/g,(_,i)=>kept[Number(i)]));
 return {title:scrub(document.title),url:scrub(location.href),markdown:md.slice(0,100000)};
}
// World 1001. Screenshot guard input: whether a sensitive input is shown unmasked (non-password type with a value) or a sensitive value
// appears in the page text, plus the page text and visible field values so the main process can look for known secrets itself.
export function screenCheckScript():{revealed:boolean;text:string;values:string[]}{
 const sec=(globalThis as Heisen).__heisenSecure!,text=document.body?.innerText||'';
 const fields=Array.from(document.querySelectorAll<HTMLInputElement|HTMLTextAreaElement>('input,textarea')).filter(i=>i.type!=='hidden'&&i.value&&i.getBoundingClientRect().width>0&&i.checkVisibility?.()!==false);
 const revealed=fields.some(i=>i.type!=='password'&&sec.sensitive(i))||sec.values().some(v=>text.includes(v));
 return {revealed,text,values:fields.filter(i=>i.type!=='password').map(i=>i.value)};
}
// World 1002. Fills a saved login into the focused login form, or the first form with a password field.
export function fillLoginScript(v:{origin:string;username:string;password:string}):{ok:true}|{error:string}{
 try{
  if(location.origin!==v.origin)throw new Error('사이트가 변경되었습니다.');
  const visible=(el:HTMLElement)=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&el.checkVisibility?.()!==false;};
  const passwordIn=(scope:ParentNode)=>{const all=Array.from(scope.querySelectorAll<HTMLInputElement>('input[type=password]')).filter(p=>!p.disabled&&!p.readOnly);return all.find(visible)||all[0];};
  const active=document.activeElement as HTMLElement|null,activeForm=active?.closest('form');
  const form=activeForm&&passwordIn(activeForm)?activeForm:Array.from(document.forms).find(f=>passwordIn(f));
  const scope:ParentNode=form||document,password=passwordIn(scope);
  if(!password)throw new Error('비밀번호 입력란이 없습니다.');
  const inputs=Array.from(scope.querySelectorAll<HTMLInputElement>('input')).filter(i=>!i.disabled&&!i.readOnly&&i.type!=='hidden');
  const before=inputs.filter(i=>i.compareDocumentPosition(password)&Node.DOCUMENT_POSITION_FOLLOWING);
  const username=inputs.find(i=>/(^|\s)(username|email)(\s|$)/i.test(i.getAttribute('autocomplete')||''))||inputs.find(i=>i.type==='email')||before.filter(i=>(i.type==='text'||i.type==='tel')&&visible(i)).pop();
  const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;
  for(const [node,value] of [[username,v.username],[password,v.password]] as const){if(node){set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));}}
  return {ok:true};
 }catch(e){return {error:(e as Error).message};}
}
// World 1001. The sign-up form: among forms with a visible password field, the one with a new-password field, else one with two or more
// password fields, else the focused form, else the only one on a page that talks about signing up (no forms: the document, same tests).
// A page without password fields but with an email field and sign-up wording is step one of a two-step sign-up (passwordFields 0).
// rules come from the first password field's attributes; hints are its labels/placeholder/title/description, visible error/help
// text anywhere, then the nearest block around requirement-like text in the form (each ≤300 characters, at most 16).
export function signupScanScript():SignupScan{
 const visible=(el:Element)=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(el as HTMLElement).checkVisibility?.()!==false;};
 const SIGNUP=/가입|계정 만들기|sign\s?up|register|create (?:an )?account/i,signupPage=()=>SIGNUP.test(document.body?.innerText||'');
 const passwordsIn=(s:ParentNode)=>Array.from(s.querySelectorAll<HTMLInputElement>('input[type=password]')).filter(p=>!p.disabled&&!p.readOnly&&visible(p));
 const isNew=(p:HTMLInputElement)=>/(^|\s)new-password(\s|$)/i.test(p.getAttribute('autocomplete')||'');
 const isEmail=(i:HTMLInputElement)=>(i.type==='text'||i.type==='email')&&(i.type==='email'||/(^|\s)email(\s|$)/i.test(i.getAttribute('autocomplete')||'')||/mail/i.test(i.name+' '+i.id));
 const emailIn=(s:ParentNode)=>Array.from(s.querySelectorAll<HTMLInputElement>('input')).find(i=>!i.disabled&&!i.readOnly&&isEmail(i)&&visible(i));
 const pick=():ParentNode|null=>{
  const forms=Array.from(document.forms).filter(f=>passwordsIn(f).length),active=document.activeElement?.closest('form');
  if(forms.length)return forms.find(f=>passwordsIn(f).some(isNew))||forms.find(f=>passwordsIn(f).length>=2)||forms.find(f=>f===active)||(forms.length===1&&signupPage()?forms[0]:null);
  const all=passwordsIn(document);return all.some(isNew)||all.length>=2||(all.length>0&&signupPage())?document:null;
 };
 const none:SignupScan={found:false,passwordFields:0,hasEmail:false,username:'',rules:{hints:[]}};
 let scope=pick();
 if(!scope){const email=passwordsIn(document).length?undefined:emailIn(document);if(!email||!signupPage())return none;scope=email.form||document;}
 const fields=passwordsIn(scope),first=fields[0] as HTMLInputElement|undefined;
 const USER=/user|login|account|nick/i,ID=/(^|[_-])id($|[_-])/i;
 const user=Array.from(scope.querySelectorAll<HTMLInputElement>('input')).find(i=>!i.disabled&&(i.type==='text'||i.type==='tel')&&!isEmail(i)&&visible(i)&&(/(^|\s)username(\s|$)/i.test(i.getAttribute('autocomplete')||'')||[i.name,i.id].some(s=>USER.test(s)||ID.test(s))));
 const hints:string[]=[],add=(t:string|null|undefined)=>{const s=(t||'').replace(/\s+/g,' ').trim();if(s&&s.length<=300&&hints.length<16&&!hints.includes(s))hints.push(s);};
 if(first){
  for(const p of fields){for(const l of Array.from(p.labels||[]))add(l.innerText);add(p.placeholder);add(p.title);for(const id of (p.getAttribute('aria-describedby')||'').split(/\s+/))if(id)add(document.getElementById(id)?.textContent);}
  for(const el of Array.from(document.querySelectorAll<HTMLElement>('[role=alert],[aria-live],[aria-invalid=true]+*,.error,.invalid,[class*=error],[class*=invalid],[class*=help],[class*=hint]')))if(visible(el))add(el.innerText);
  // Requirement-like text nodes, each widened through inline wrappers (<b>, <span>…) to the block that holds the whole sentence.
  const HINT=/자|자리|글자|characters?|대문자|소문자|숫자|특수|영문|uppercase|lowercase|digit|number|symbol|special|letter/i,near=new Set<HTMLElement>();
  const walker=document.createTreeWalker(scope as Node,NodeFilter.SHOW_TEXT);
  for(let n=walker.nextNode();n;n=walker.nextNode()){
   if(!HINT.test(n.nodeValue||''))continue;let el=n.parentElement;
   while(el?.parentElement&&el!==scope&&getComputedStyle(el).display.startsWith('inline')&&(el.parentElement.textContent||'').length<=300)el=el.parentElement;
   if(el&&!/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION|SELECT|TEXTAREA)$/.test(el.tagName))near.add(el);
  }
  for(const el of near)if(visible(el))add(el.innerText);
 }
 const attr=(name:string)=>first?.getAttribute(name)??undefined;
 return {found:true,passwordFields:fields.length,hasEmail:!!emailIn(scope),username:user?.value.trim()||'',rules:{passwordrules:attr('passwordrules'),minlength:attr('minlength'),maxlength:attr('maxlength'),pattern:attr('pattern'),hints}};
}
// World 1002. Fills the sign-up form signupScanScript finds (a focused password field's form first): the password into every visible
// password field (confirmation fields included), the email into the first email field.
export function fillSignupScript(v:{origin:string;email?:string;password?:string}):{ok:true;filled:{email:boolean;password:boolean}}|{error:string}{
 try{
  if(location.origin!==v.origin)throw new Error('사이트가 변경되었습니다.');
  const visible=(el:Element)=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&(el as HTMLElement).checkVisibility?.()!==false;};
  const SIGNUP=/가입|계정 만들기|sign\s?up|register|create (?:an )?account/i,signupPage=()=>SIGNUP.test(document.body?.innerText||'');
  const passwordsIn=(s:ParentNode)=>Array.from(s.querySelectorAll<HTMLInputElement>('input[type=password]')).filter(p=>!p.disabled&&!p.readOnly&&visible(p));
  const isNew=(p:HTMLInputElement)=>/(^|\s)new-password(\s|$)/i.test(p.getAttribute('autocomplete')||'');
  const isEmail=(i:HTMLInputElement)=>(i.type==='text'||i.type==='email')&&(i.type==='email'||/(^|\s)email(\s|$)/i.test(i.getAttribute('autocomplete')||'')||/mail/i.test(i.name+' '+i.id));
  const emailIn=(s:ParentNode)=>Array.from(s.querySelectorAll<HTMLInputElement>('input')).find(i=>!i.disabled&&!i.readOnly&&isEmail(i)&&visible(i));
  const pick=():ParentNode|null=>{
   const forms=Array.from(document.forms).filter(f=>passwordsIn(f).length),focused=document.activeElement,active=focused?.closest('form');
   if(focused instanceof HTMLInputElement&&focused.type==='password'&&focused.form&&forms.includes(focused.form))return focused.form;
   if(forms.length)return forms.find(f=>passwordsIn(f).some(isNew))||forms.find(f=>passwordsIn(f).length>=2)||forms.find(f=>f===active)||(forms.length===1&&signupPage()?forms[0]:null);
   const all=passwordsIn(document);return all.some(isNew)||all.length>=2||(all.length>0&&signupPage())?document:null;
  };
  let scope=pick();
  if(!scope){const email=passwordsIn(document).length?undefined:emailIn(document);if(email&&signupPage())scope=email.form||document;}
  const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;
  const put=(node:HTMLInputElement,value:string)=>{set.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));};
  const filled={email:false,password:false};
  if(scope){
   const fields=v.password===undefined?[]:passwordsIn(scope),email=v.email===undefined?undefined:emailIn(scope);
   for(const p of fields)put(p,v.password!);filled.password=fields.length>0;
   if(email){put(email,v.email!);filled.email=true;}
  }
  if(!filled.email&&!filled.password)throw new Error('가입 양식을 찾을 수 없습니다.');
  return {ok:true,filled};
 }catch(e){return {error:(e as Error).message};}
}
// World 1001. Tags the snapshot's file input so the main process can find it with DOM.querySelector.
export function markUploadScript(a:{snapshot?:string;ref:string;nonce:string}):{ok:true}|{error:string}{
 const s=(globalThis as Heisen).__heisen;const node=s?.nodes.get(a.ref) as HTMLInputElement|undefined;
 if(!s||s.id!==a.snapshot||s.url!==location.href||!node?.isConnected)return {error:'관찰이 만료되었습니다. 다시 읽어 주세요.'};
 if(node.tagName!=='INPUT'||node.type!=='file')return {error:'파일 입력란이 아닙니다.'};
 if(node.disabled)return {error:'비활성 필드입니다.'};
 node.setAttribute('data-heisen-upload',a.nonce);return {ok:true};
}
export function unmarkUploadScript(nonce:string):boolean{
 for(const el of Array.from(document.querySelectorAll('[data-heisen-upload]')))if(el.getAttribute('data-heisen-upload')===nonce)el.removeAttribute('data-heisen-upload');
 return true;
}
// World 1001. Selects the option whose value or visible text matches.
export function selectOptionScript(a:{snapshot?:string;ref:string;value:string}):{ok:true}|{error:string}{
 const s=(globalThis as Heisen).__heisen;const node=s?.nodes.get(a.ref) as HTMLSelectElement|undefined;
 if(!s||s.id!==a.snapshot||s.url!==location.href||!node?.isConnected)return {error:'관찰이 만료되었습니다. 다시 읽어 주세요.'};
 if(node.tagName!=='SELECT')return {error:'선택 목록이 아닙니다.'};
 if(node.disabled)return {error:'비활성 필드입니다.'};
 const option=Array.from(node.options).find(o=>o.value===a.value)||Array.from(node.options).find(o=>o.text.replace(/\s+/g,' ').trim()===a.value.trim());
 if(!option||option.disabled)return {error:'선택할 수 없는 값입니다.'};
 option.selected=true;node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));
 return {ok:true};
}
