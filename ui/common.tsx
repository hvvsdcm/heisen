import {useMemo,useState,useEffect,useRef} from 'react';
import {marked} from 'marked';
import DOMPurify from 'dompurify';
declare global {interface Window {heisen:{call:(method:string,args?:any)=>Promise<any>;onChange:(fn:()=>void)=>()=>void;onShortcut:(fn:(s:string)=>void)=>()=>void}}}
export type Modal={kind:string;data?:any}|null;
export const statusNames:Record<string,string>={running:'진행 중',awaiting_approval:'확인 필요',completed:'완료',cancelled:'중단됨',failed:'실패',interrupted:'일시 중단'};
export const toolNames:Record<string,string>={web_open:'페이지 열기',web_observe:'페이지 읽기',web_click:'요소 클릭',web_fill:'입력',web_press:'키 입력',web_scroll:'스크롤',web_select:'옵션 선택',web_navigate:'페이지 이동',web_read:'본문 읽기',web_wait:'대기',web_run:'스크립트 실행',web_login:'로그인 정보 입력',web_signup:'회원가입 정보 입력',research_capture:'출처 저장',file_write:'파일 작성',file_read:'파일 읽기',file_list:'파일 확인',code_run:'코드 실행',task_finish:'결과 확인'};
export const date=(v:any)=>new Date(v).toLocaleString('ko-KR',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
export const NEW_TAB_URL='heisen://newtab';
export function IconButton({label,children,onClick,active=false,disabled=false}:any){return <button className={'icon-button '+(active?'active':'')} title={label} aria-label={label} onClick={onClick} disabled={disabled}>{children}</button>}
export function Empty({icon,title,detail}:any){return <div className="empty-state">{icon}<p>{title}</p>{detail&&<span>{detail}</span>}</div>}
export function Markdown({text,open}:any){const html=useMemo(()=>DOMPurify.sanitize(marked.parse(text,{async:false}) as string,{FORBID_TAGS:['img','iframe','form','input','video','audio'],FORBID_ATTR:['style']}),[text]);return <div className="markdown" onClick={e=>{const a=(e.target as HTMLElement).closest('a');if(a){e.preventDefault();if(/^https?:/.test(a.href))open(a.href);}}} dangerouslySetInnerHTML={{__html:html}}/>;}
// Modal dialogs trap Tab and close on Escape anywhere; a non-modal card only handles Escape from inside itself. `[data-autofocus]` wins initial focus.
export function useDialog(box:{current:HTMLElement|null},dismiss:()=>void,modal=true){
 // Read during the first render, before autoFocus inside the dialog moves focus away from the opener.
 const [opener]=useState(()=>document.activeElement instanceof HTMLElement?document.activeElement:null);const dismissRef=useRef(dismiss);dismissRef.current=dismiss;
 useEffect(()=>{const el=box.current;if(!el)return;
  const focusables=()=>[...el.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]')].filter(n=>n.tabIndex>=0&&!n.matches(':disabled')&&n.getClientRects().length>0);
  if(modal&&!el.contains(document.activeElement))(el.querySelector<HTMLElement>('[data-autofocus]')||el.querySelector<HTMLElement>('.modal-body :is(input,textarea,select):not(:disabled)')||el.querySelector<HTMLElement>('footer .primary:not(:disabled)')||focusables()[0]||el).focus();
  const onKey=(e:KeyboardEvent)=>{if(e.isComposing||(!modal&&!el.contains(e.target as Node)))return;if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismissRef.current();return;}if(!modal||e.key!=='Tab')return;const list=focusables();if(!list.length){e.preventDefault();return;}const i=list.indexOf(document.activeElement as HTMLElement);if(e.shiftKey?i<=0:i<0||i===list.length-1){e.preventDefault();list[e.shiftKey?list.length-1:0].focus();}};
  document.addEventListener('keydown',onKey,true);
  return ()=>{document.removeEventListener('keydown',onKey,true);if(opener?.isConnected&&opener!==document.body)opener.focus();};},[modal]);
}
