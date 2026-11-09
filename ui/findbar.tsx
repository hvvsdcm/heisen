import {useEffect,useRef,useState} from 'react';
import {ChevronUp,ChevronDown,X} from 'lucide-react';
import {IconButton} from './common.tsx';
const PERMISSION_NAMES:Record<string,string>={geolocation:'위치 정보 확인',notifications:'알림 표시',camera:'카메라 사용',microphone:'마이크 사용','clipboard-read':'클립보드에 복사된 텍스트 및 이미지 확인'};
const send=(method:string,args:any={})=>void window.heisen.call(method,args).catch(()=>{});
function hostOf(origin:string){try{return new URL(origin).host;}catch{return origin;}}
// What the infobar shows for the active tab (permission requests first, then a password save/update prompt); Toolbar uses the same lookup to reserve the 44px row.
export function infobarRequest(s:any,active:any){
 if(s?.route!=='page'||!active)return undefined;
 const permission=s.permissionRequests?.find((r:any)=>r.tabId===active.id);if(permission)return {type:'permission' as const,req:permission};
 const password=s.passwordPrompts?.find((p:any)=>p.tabId===active.id);return password?{type:'password' as const,req:password}:undefined;
}
export function FindBar({s,active,open,setOpen}:any){
 const [text,setText]=useState('');const [focusTick,setFocusTick]=useState(0);const input=useRef<HTMLInputElement>(null);
 const timer=useRef<number>(undefined);const route=useRef(s.route);route.current=s.route;const current=useRef(text);current.current=text;
 const search=(value:string)=>{clearTimeout(timer.current);timer.current=undefined;send(value?'find.start':'find.stop',value?{text:value}:{});};
 const close=()=>{clearTimeout(timer.current);timer.current=undefined;send('find.stop');setOpen(false);};
 useEffect(()=>window.heisen.onShortcut(name=>{if(name!=='find'||route.current!=='page')return;setOpen(true);setFocusTick(t=>t+1);if(current.current)search(current.current);}),[]);
 useEffect(()=>{if(focusTick){input.current?.focus();input.current?.select();}},[focusTick]);
 useEffect(()=>{clearTimeout(timer.current);timer.current=undefined;setOpen(false);},[active?.id]);
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 if(!open||s.route!=='page')return null;
 const change=(value:string)=>{setText(value);clearTimeout(timer.current);timer.current=window.setTimeout(()=>search(value),200);};
 const next=(forward:boolean)=>{if(timer.current)search(text);else send('find.next',{forward});};
 return <div className={'find-bar '+(s.settings.bookmarkBar?'docked':'own-row')}><input ref={input} aria-label="페이지에서 찾기" value={text} onChange={e=>change(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();next(!e.shiftKey);}else if(e.key==='Escape'){e.preventDefault();close();}}}/><span className="find-count">{`${active?.find?.active||0}/${active?.find?.matches||0}`}</span><span className="find-separator"/><IconButton label="이전" disabled={!text} onClick={()=>next(false)}><ChevronUp size={15}/></IconButton><IconButton label="다음" disabled={!text} onClick={()=>next(true)}><ChevronDown size={15}/></IconButton><IconButton label="닫기" onClick={close}><X size={15}/></IconButton></div>;
}
export function Infobar({s,active,act}:any){
 const item=infobarRequest(s,active);if(!item)return null;const req=item.req;
 if(item.type==='password'){
  const answer=(action:'save'|'never'|'dismiss')=>act('password.prompt',{tabId:req.tabId,action});
  return <div className="infobar" role="alert"><span className="infobar-text">{req.kind==='update'?'비밀번호를 업데이트하시겠습니까?':'비밀번호를 저장하시겠습니까?'}{req.username&&<> <strong>{req.username}</strong></>}</span><div className="infobar-actions">{req.kind==='update'?<button onClick={()=>answer('save')}>업데이트</button>:<><button onClick={()=>answer('save')}>저장</button><button onClick={()=>answer('never')}>사용 안함</button></>}<button onClick={()=>answer('dismiss')}>닫기</button></div></div>;
 }
 const names=req.kinds.map((k:string)=>PERMISSION_NAMES[k]||k).join(', ');
 return <div className="infobar" role="alert"><span className="infobar-text">{`${hostOf(req.origin)}에서 다음 작업을 하려고 합니다: ${names}`}</span><div className="infobar-actions"><button onClick={()=>act('permission.decide',{id:req.id,allow:true})}>허용</button><button onClick={()=>act('permission.decide',{id:req.id,allow:false})}>차단</button></div></div>;
}
