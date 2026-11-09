import {useEffect,useLayoutEffect,useRef,useState,type MouseEvent} from 'react';
import {ArrowLeft,ArrowRight,RotateCw,X,Star,PanelLeft,PanelRight,Globe,Folder,ShieldCheck,ShieldOff,LockKeyhole,TriangleAlert,BookOpenText,ZoomIn,ZoomOut,Minus,Plus,Import,KeyRound} from 'lucide-react';
import {NEW_TAB_URL,IconButton} from './common.tsx';
import {FindBar,Infobar,infobarRequest} from './findbar.tsx';
import {requestSiteSettings} from './settings.tsx';
import './browser-chrome.css';
// Library and chat routes show as heisen://<route> in the omnibox; typing one of them navigates there.
const internalRoutes=['settings','history','bookmarks','downloads','vault','routines','memory','skills','chat','chats','activity'];
const READER_THEMES=[['auto','자동','linear-gradient(90deg,#fff 50%,#1c1c1e 50%)'],['light','밝게','#fff'],['sepia','세피아','#f4ecd8'],['dark','어둡게','#1c1c1e']];
export function Toolbar({s,active,act,route,openURL,panel,reserve,setPanel,modal,setModal}:any){
 const [address,setAddress]=useState('');const addressInput=useRef<HTMLInputElement>(null);const [findOpen,setFindOpen]=useState(false);const [zoomOpen,setZoomOpen]=useState(false);
 const [infoOpen,setInfoOpen]=useState(false);const info=useRef<HTMLDivElement>(null);const infoButton=useRef<HTMLButtonElement>(null);const [tabCardOpen,setTabCardOpen]=useState(false);
 const siteAvailable=s.route==='page'&&!!active?.site&&/^https?:/i.test(active.url);const showInfo=infoOpen&&siteAvailable&&!modal;
 const origin=siteAvailable?new URL(active.url).origin:'';const pv=active?.privacy;const rd=s.settings.reader;
 const security=s.route==='page'?(active?.block?.kind==='danger'?'위험한 사이트':active?.block||/^http:/i.test(active?.url||'')?'주의 요함':''):'';
 const securityClass=security?' insecure'+(active?.block?.kind==='danger'||active?.block?.kind==='cert'?' security-danger':''):'';
 useEffect(()=>{const changed=(e:Event)=>setTabCardOpen((e as CustomEvent<boolean>).detail);window.addEventListener('heisen:tab-card',changed);return ()=>window.removeEventListener('heisen:tab-card',changed);},[]);
 useEffect(()=>{setInfoOpen(false);},[active?.id,active?.url,s.route,modal]);
 useEffect(()=>{if(!showInfo)return;const outside=(e:PointerEvent)=>{if(!info.current?.contains(e.target as Node))setInfoOpen(false);};document.addEventListener('pointerdown',outside);return ()=>document.removeEventListener('pointerdown',outside);},[showInfo]);
 const internal=internalRoutes.includes(s.route);
 useEffect(()=>window.heisen.onShortcut(name=>{if(name==='address'){addressInput.current?.focus();addressInput.current?.select();}}),[]);
 useEffect(()=>{setAddress(internal?'heisen://'+s.route:active?.url===NEW_TAB_URL?'':active?.url||'');setZoomOpen(false);},[active?.url,active?.id,s.route]);
 const submit=()=>{const typed=/^heisen:\/\/([a-z]+)\/?$/i.exec(address.trim())?.[1]?.toLowerCase();if(typed&&internalRoutes.includes(typed))route(typed);else act('tab.navigate',{url:address});addressInput.current?.blur();};
 // Native page views sit above the renderer; chrome popovers share the existing modal occlusion.
 useEffect(()=>{void window.heisen.call('layout',{sidebar:s?.settings.sidebarCollapsed?0:232,panel:(panel||reserve)&&s?.route==='page'?390:0,modal:!!modal||showInfo||tabCardOpen}).catch(()=>{});},[panel,reserve,modal,showInfo,tabCardOpen,s?.route,s?.settings.sidebarCollapsed]);
 const bar=!!s.settings.bookmarkBar;
 // Bookmark bar shows the bookmarks that fit whole; the rest stay reachable through 모든 북마크.
 // Only as many as could possibly fit are rendered (a bookmark button is at least 28px: 8px padding each side + 12px icon).
 const bookmarkItems=useRef<HTMLDivElement>(null);const [barWidth,setBarWidth]=useState(0);const [fit,setFit]=useState(0);
 useLayoutEffect(()=>{const el=bookmarkItems.current;if(!el)return;setBarWidth(el.clientWidth);const observer=new ResizeObserver(([entry])=>setBarWidth(entry.contentRect.width));observer.observe(el);return ()=>observer.disconnect();},[bar]);
 const shown=s.bookmarks.slice(0,Math.ceil(barWidth/28)+1);
 useLayoutEffect(()=>{const el=bookmarkItems.current;if(!el)return;const right=el.getBoundingClientRect().right+0.5;let n=0;for(const child of el.children){if(child.getBoundingClientRect().right>right)break;n++;}setFit(n);},[bar,barWidth,s.bookmarks]);
 // Chrome: click opens in the current tab; ⌘-click or middle-click opens a background tab. Agent tabs refuse navigation, so they get a new tab.
 const openBookmark=(e:MouseEvent<HTMLButtonElement>,url:string)=>{if(e.button===1||e.metaKey)act('tab.new',{url,background:true,incognito:!!active?.incognito});else if(!active||active.taskId)openURL(url);else act('tab.navigate',{url});};
 // Native page view starts below strip (40) + toolbar (52) + bookmarks (32) + standalone find (40) + infobar (44).
 const top=40+52+(bar?32:0)+(findOpen&&s.route==='page'&&!bar?40:0)+(infobarRequest(s,active)?44:0);
 useEffect(()=>{void window.heisen.call('chrome.top',{top}).catch(()=>{});},[top]);
 const bookmarked=!internal&&s.bookmarks.some((b:any)=>b.url===active?.url);
 const zoom=active?.zoom??1;const pct=Math.round(zoom*100);
 // Saved-password menu opens under the key icon's bottom-left corner (window CSS px).
 const passwordMenu=(e:MouseEvent<HTMLButtonElement>)=>{const r=e.currentTarget.getBoundingClientRect();act('password.menu',{x:Math.round(r.left),y:Math.round(r.bottom)});};
 return <><header className={'toolbar'+(active?.incognito?' incognito':'')} data-chrome-top={top}>
 <IconButton label={s.settings.sidebarCollapsed?'사이드바 펼치기':'사이드바 접기'} onClick={()=>act('sidebar.toggle')}><PanelLeft size={16}/></IconButton><div className="nav-buttons"><IconButton label="뒤로" disabled={!active?.canBack||s.route!=='page'} onClick={()=>act('tab.command',{name:'back'})}><ArrowLeft size={17}/></IconButton><IconButton label="앞으로" disabled={!active?.canForward||s.route!=='page'} onClick={()=>act('tab.command',{name:'forward'})}><ArrowRight size={17}/></IconButton><IconButton label={active?.loading&&!internal?'중지':'새로고침'} disabled={!active||active.url===NEW_TAB_URL||internal} onClick={()=>act('tab.command',{name:active?.loading?'stop':'reload'})}>{active?.loading&&!internal?<X size={16}/>:<RotateCw size={16}/>}</IconButton></div>
 <form className="omnibox" onSubmit={e=>{e.preventDefault();submit();}}>
 <div ref={info} className="site-info-anchor" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setInfoOpen(false);}} onKeyDown={e=>{if(!e.nativeEvent.isComposing&&e.key==='Escape'){e.preventDefault();setInfoOpen(false);infoButton.current?.focus();}}}>
 <button ref={infoButton} type="button" className={'site-info-button'+securityClass} title={security||'사이트 정보'} aria-label={security?security+' · 사이트 정보':'사이트 정보'} aria-expanded={showInfo} aria-controls="site-info" disabled={!siteAvailable} onClick={()=>setInfoOpen(o=>!o)}>{security?<><TriangleAlert size={14}/><span>{security}</span></>:active?.protected===false?<ShieldOff size={14}/>:<ShieldCheck size={14}/>}</button>
 {showInfo&&<div id="site-info" className="site-info" role="dialog" aria-label="사이트 정보">
 <b className="site-info-title">{active.site}</b>
 <div className={'site-connection'+securityClass}>{security?<><TriangleAlert size={14}/><span>{active.block?.kind==='cert'?'인증서를 확인할 수 없음':security}</span></>:active.error?<><TriangleAlert size={14}/><span>연결 실패</span></>:/^https:/i.test(active.url)?<><LockKeyhole size={14}/><span>보안 연결</span></>:<><TriangleAlert size={14}/><span>보안 연결 아님</span></>}</div>
 <div className="site-info-count"><span>추적기 차단</span><b>{pv?.blocked??0}</b></div>
 {!!pv?.hosts.length&&<small className="site-info-hosts">{pv.hosts.slice(0,5).join(', ')}</small>}
 <div className="site-info-count"><span>교차 사이트 쿠키 차단</span><b>{pv?.cookies??0}</b></div>
 <div className="site-info-count"><span>추적 매개변수 제거</span><b>{pv?.params??0}</b></div>
 <label className="check-row"><input type="checkbox" checked={active.protected!==false} onChange={e=>act('privacy.site',{site:active.site,protect:e.target.checked})}/>이 사이트 보호</label>
 <div className="site-info-actions">{s.sitePermissions?.[origin]&&<button type="button" onClick={()=>act('permission.reset',{origin})}>권한 재설정</button>}<button type="button" onClick={()=>{setInfoOpen(false);requestSiteSettings();route('settings');}}>사이트 설정</button></div>
 </div>}
 </div>
 {active?.incognito&&<span className="incognito-chip">시크릿</span>}
 <input ref={addressInput} aria-label="주소창" value={address} onFocus={e=>e.target.select()} onChange={e=>setAddress(e.target.value)} placeholder="Google에서 검색하거나 URL 입력"/>
 {s.route==='page'&&(active?.readable||active?.reader)&&<div className={'zoom-chip reader-chip'+(active.reader?' open':'')}><button type="button" title="읽기 도구" aria-label="읽기 도구" aria-pressed={!!active.reader} onClick={()=>act('reader.toggle',{id:active.id})}><BookOpenText size={14}/></button>{active.reader&&<><button type="button" title="작게" aria-label="작게" disabled={rd.size<=14} onClick={()=>act('reader.set',{size:Math.max(14,rd.size-2)})}><Minus size={13}/></button><button type="button" title="크게" aria-label="크게" disabled={rd.size>=32} onClick={()=>act('reader.set',{size:Math.min(32,rd.size+2)})}><Plus size={13}/></button>{READER_THEMES.map(([id,name,color])=><button type="button" key={id} className={'reader-theme'+(rd.theme===id?' chosen':'')} title={name} aria-label={name} aria-pressed={rd.theme===id} style={{background:color}} onClick={()=>act('reader.set',{theme:id})}/>)}</>}</div>}
 {s.route==='page'&&s.activePasswords>0&&<div className="zoom-chip password-key"><button type="button" title="저장된 비밀번호" aria-label="저장된 비밀번호" onClick={passwordMenu}><KeyRound size={14}/></button></div>}
 {s.route==='page'&&zoom!==1&&<div className={'zoom-chip '+(zoomOpen?'open':'')} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setZoomOpen(false);}} onKeyDown={e=>{if(e.key==='Escape')setZoomOpen(false);}}><button type="button" title={`확대/축소: ${pct}%`} aria-label={`확대/축소: ${pct}%`} aria-expanded={zoomOpen} onClick={()=>setZoomOpen(!zoomOpen)}>{zoom>1?<ZoomIn size={14}/>:<ZoomOut size={14}/>}</button>{zoomOpen&&<><button type="button" title="축소" aria-label="축소" onClick={()=>act('tab.zoom',{dir:'out'})}><Minus size={13}/></button><span className="zoom-value">{pct}%</span><button type="button" title="확대" aria-label="확대" onClick={()=>act('tab.zoom',{dir:'in'})}><Plus size={13}/></button><button type="button" className="zoom-reset" onClick={()=>act('tab.zoom',{dir:'reset'})}>재설정</button></>}</div>}</form>
 <IconButton label={bookmarked?'북마크 삭제':'이 탭을 북마크에 추가'} active={bookmarked} disabled={internal} onClick={()=>act('tab.command',{name:'bookmark'})}><Star size={17}/></IconButton><IconButton label="측면 패널" active={panel} onClick={()=>{if(s.route==='page')setPanel(!panel);else route('chat');}}><PanelRight size={17}/></IconButton></header>
 <div className="chrome-bars">{bar&&<div className="bookmark-bar"><div className="bookmark-items" ref={bookmarkItems}>{shown.map((b:any,i:number)=><button key={b.id} className={i<fit?undefined:'bookmark-overflow'} title={b.title} onClick={e=>openBookmark(e,b.url)} onMouseDown={e=>{if(e.button===1)e.preventDefault();}} onAuxClick={e=>{if(e.button===1){e.preventDefault();openBookmark(e,b.url);}}}><Globe size={12}/><span>{b.title}</span></button>)}{!s.bookmarks.length&&<button onClick={()=>setModal({kind:'import'})}><Import size={13}/><span>북마크 가져오기</span></button>}</div><span className="bar-separator"/><button className="all-bookmarks" onClick={()=>route('bookmarks')}><Folder size={13}/><span>모든 북마크</span></button></div>}<FindBar s={s} active={active} open={findOpen} setOpen={setFindOpen}/></div><Infobar s={s} active={active} act={act}/></>;
}
