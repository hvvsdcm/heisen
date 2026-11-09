import {useState,useEffect,useRef} from 'react';
import {Loader2} from 'lucide-react';
import {useDialog} from './common.tsx';
// Sign-in gate, shown by app.tsx while s.beta.status is not 'active'. The main process refuses every other RPC until it unlocks (src/beta.ts allows()).
// Display-only normalization: 11 letters/digits become HSN-XXXX-XXXX; the server makes the final check.
const formatCode=(v:string)=>{const raw=v.toUpperCase(),a=raw.replace(/[^A-Z0-9]/g,'');return a.length===11?`${a.slice(0,3)}-${a.slice(3,7)}-${a.slice(7)}`:raw;};
const CODE=/^HSN-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
export function Gate({s,call}:any){const b=s.beta;const [code,setCode]=useState('');const box=useRef<HTMLDivElement>(null);
 const run=(method:string,args:any={})=>void call(method,args).catch(()=>{});
 // Hides the tab view; the toolbar sets the real layout again once the gate is gone.
 useEffect(()=>{window.heisen.call('layout',{panel:0,modal:true}).catch(()=>{});},[]);
 // Escape has nothing to dismiss; the hook supplies the Tab trap and initial focus.
 useDialog(box,()=>{});
 // A status change replaces the focused control; keep focus inside the gate.
 useEffect(()=>{const el=box.current;if(el&&!el.contains(document.activeElement))(el.querySelector<HTMLElement>('[data-autofocus]')||el.querySelector<HTMLElement>('button:not(:disabled)')||el).focus();},[b.status]);
 const valid=CODE.test(code),submit=()=>{if(!b.busy&&valid)run('beta.redeem',{code});};
 const error=b.error&&<p className="error-text">{b.error}</p>;
 const body=b.status==='signed_out'?<><button className="primary" disabled={b.busy} onClick={()=>run('beta.signIn')}>Google 계정으로 계속</button>{b.busy&&<><p className="muted">브라우저에서 로그인을 마치세요.</p><button onClick={()=>run('beta.cancel')}>취소</button></>}{error}</>
  :b.status==='invite'?<><p>{b.email}<span className="muted"> 계정으로 로그인됨</span></p><label>초대 코드<input data-autofocus placeholder="HSN-XXXX-XXXX" autoCapitalize="characters" spellCheck={false} maxLength={14} value={code} onChange={e=>setCode(formatCode(e.target.value))} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();submit();}}}/></label><button className="primary" disabled={b.busy||!valid} onClick={submit}>확인</button><button className="subtle" onClick={()=>run('beta.signOut')}>다른 계정으로 로그인</button>{error}</>
  :b.status==='offline'?<><p>서버에 연결할 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도하세요.</p><button className="primary" onClick={()=>run('beta.retry')}>다시 시도</button><button className="subtle" onClick={()=>run('beta.signOut')}>로그아웃</button>{error}</>
  :<Loader2 className="spin"/>;
 return <div ref={box} tabIndex={-1} className="gate" role="dialog" aria-modal="true" aria-label="Heisen 로그인"><section className="gate-card"><div className="onboarding-brand"><span className="wordmark"><img src="./brand/mark.png" alt=""/>Heisen</span></div>{body}<small className="muted">heisen.dev</small></section></div>;
}
