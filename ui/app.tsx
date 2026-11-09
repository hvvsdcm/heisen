import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {X,MessageSquare,ChevronRight,Globe,VenetianMask,LockOpen,ShieldAlert,TriangleAlert} from 'lucide-react';
import './style.css';
import {type Modal,date} from './common.tsx';
import {ModalView} from './settings.tsx';
import {Toolbar} from './toolbar.tsx';
import {Sidebar} from './sidebar.tsx';
import {TabStrip} from './tabstrip.tsx';
import {TaskView,Composer} from './chat.tsx';
import {Library} from './library.tsx';
import {Gate} from './gate.tsx';
import type {Block} from '../src/https-first.ts';
function PageBlock({id,block,act}:{id:number;block:Block;act:(method:string,args:unknown)=>void}){
 const danger=block.kind==='danger',http=block.kind==='http';
 const Icon=http?LockOpen:danger?TriangleAlert:ShieldAlert;
 const proceed=block.canProceed===true&&block.kind!=='cert';
 return <section className={'page-block page-block-'+block.kind} aria-labelledby="page-block-title">
  <Icon size={32} aria-hidden="true"/>
  <h2 id="page-block-title">{http?'안전하지 않은 연결':danger?'위험한 사이트':'인증서를 확인할 수 없음'}</h2>
  <p className="page-block-host">{block.host}</p>
  <p className="page-block-detail">{danger?block.list||block.detail:block.detail}</p>
  <div className="page-block-actions"><button className="primary" onClick={()=>act('tab.block',{id,action:'back'})}>뒤로 가기</button>
   {proceed&&http&&<button onClick={()=>act('tab.block',{id,action:'proceed'})}>계속</button>}
  </div>
  {proceed&&danger&&<details className="page-block-details"><summary>세부정보</summary><button onClick={()=>act('tab.block',{id,action:'proceed'})}>계속</button></details>}
 </section>;
}
function App(){
 const [s,setState]=useState<any>();const [error,setError]=useState('');const [notice,setNotice]=useState('');const [modal,setModal]=useState<Modal>(null);const [panel,setPanel]=useState(false);const [search,setSearch]=useState('');const [models,setModels]=useState<any[]>([]);const [modelsBusy,setModelsBusy]=useState(false);const routeName=useRef('');routeName.current=s?.route||'';
 const [tabSearchOpen,setTabSearchOpen]=useState(false);
 const refresh=async()=>{try{setState(await window.heisen.call('state'));}catch(e){setError((e as Error).message);}};
 const call=async(method:string,args:any={})=>{try{const r=await window.heisen.call(method,args);await refresh();return r;}catch(e){setError((e as Error).message.replace(/^Error invoking remote method '[^']+': Error: /,''));throw e;}};
 const act=(method:string,args:any={})=>void call(method,args).catch(()=>{});
 useEffect(()=>{void refresh();return window.heisen.onChange(()=>void refresh());},[]);
 useEffect(()=>window.heisen.onShortcut(name=>{if(name==='panel'){if(routeName.current==='page')setPanel(p=>!p);else route('chat');}if(name==='import')setModal({kind:'import'});}),[]);
 // First-run setup yields to any open modal and is offered again on the next state update while onboarding is unfinished.
 useEffect(()=>{if(s&&(!s.beta||s.beta.status==='active')&&s.settings.onboarded===false)setModal(m=>m||{kind:'onboarding'});},[s]);
 useEffect(()=>{if(!error&&!notice)return;const t=setTimeout(()=>{setError('');setNotice('');},7000);return ()=>clearTimeout(t);},[error,notice]);
 const active=s?.tabs.find((t:any)=>t.id===s.active);
 // The beta gate refuses auth.models, so the list loads again once it unlocks.
 useEffect(()=>{if(!s||(s.beta&&s.beta.status!=='active'))return;const p=s.providers.find((p:any)=>p.id===s.settings.provider);if(!p?.connected){setModels([]);return;}let live=true;setModelsBusy(true);window.heisen.call('auth.models',{provider:p.id}).then(list=>{if(live)setModels(list);}).catch(()=>{if(live)setModels([]);}).finally(()=>{if(live)setModelsBusy(false);});return ()=>{live=false;};},[s?.settings.provider,s?.providers.map((p:any)=>p.connected).join(','),s?.beta?.status]);
 const route=(name:string)=>{setSearch('');act('route',{route:name});};
 const openTask=(id:string)=>{act('task.select',{id});route('chat');};
 const openURL=(url:string)=>act('tab.new',{url});
 const start=async(prompt:string,mode:string,memoryIds:string[],skillId:string,forceNew=false)=>{const urls=active&&!active.incognito&&/^https?:/.test(active.url)?[active.url]:[];if(!forceNew&&s.task&&((s.route==='chat')||(s.route==='page'&&panel)))await call('task.continue',{id:s.task.id,prompt,mode,urls,memoryIds,skillId});else await call('task.start',{prompt,mode,urls,memoryIds,skillId});if(s.route!=='page')route('chat');else setPanel(true);};
 if(!s)return <div className="launch"/>;
 if(s.beta&&s.beta.status!=='active')return <Gate s={s} call={call}/>;
 const task=s.task;
 // A pending subscription login shows as a card in the right column (panel width) and keeps the OAuth tab visible, so it is not a blocking modal.
 const loginCard=modal?.kind==='login'&&s.attempt?.status==='pending';
 const taskView=<TaskView s={s} task={task} act={act} call={call} start={start} models={models} busy={modelsBusy} route={route} openURL={openURL} setModal={setModal}/>;
 return <div className={'app platform-'+s.platform+' '+(s.settings.sidebarCollapsed?'sidebar-collapsed':'')}>
  <TabStrip s={s} act={act} searching={tabSearchOpen} setSearching={setTabSearchOpen}/>
  <div className="app-body"><Sidebar s={s} task={task} route={route} openTask={openTask} setModal={setModal}/>
  <div className="browser-shell"><Toolbar s={s} active={active} act={act} route={route} openURL={openURL} panel={panel} reserve={loginCard} setPanel={setPanel} modal={(!loginCard&&modal)||tabSearchOpen} setModal={setModal}/>
  <main className={'content '+s.route}>
   {s.route==='home'&&(active?.incognito?<div className="home-content incognito-home"><VenetianMask size={40}/><h1>시크릿 탭</h1><p>시크릿 탭을 모두 닫으면 방문 기록·쿠키·사이트 데이터가 삭제됩니다.</p></div>:<div className="home-content"><div className="home-brand"><span className="wordmark"><img src="./brand/mark.png" alt=""/>Heisen</span></div><Composer s={s} call={call} start={start} models={models} busy={modelsBusy} onSettings={()=>route('settings')}/>{s.tasks.length>0&&<div className="home-list"><div className="list-title">최근 대화</div>{s.tasks.slice(0,5).map((t:any)=><button className="recent-row" key={t.id} onClick={()=>openTask(t.id)}><MessageSquare size={15}/><span>{t.prompt}</span><small>{date(t.createdAt)}</small><ChevronRight size={14}/></button>)}</div>}</div>)}
   {s.route==='page'&&<>{active?.block?<div className={'page-block-area'+(panel||loginCard?' with-panel':'')}><PageBlock key={`${active.id}:${active.block.kind}:${active.block.url}`} id={active.id} block={active.block} act={act}/></div>:active?.error&&<div className="page-error"><Globe size={30}/><h2>사이트에 연결할 수 없음</h2><p>{active.error}</p><button onClick={()=>act('tab.command',{name:'reload'})}>새로고침</button></div>}{panel&&<aside className="ai-panel">{taskView}</aside>}</>}
   {s.route==='chat'&&<div className="full-chat">{taskView}</div>}
   {!['home','page','chat'].includes(s.route)&&<Library s={s} active={active} act={act} call={call} route={route} setModal={setModal} openTask={openTask} openURL={openURL} search={search} setSearch={setSearch} models={models} modelsBusy={modelsBusy} setNotice={setNotice}/>}
  </main></div></div>
  {(error||notice)&&<div role="status" className={'toast '+(error?'error':'')}><span>{error||notice}</span><button aria-label="닫기" onClick={()=>{setError('');setNotice('');}}><X size={16}/></button></div>}
  {modal&&<ModalView modal={modal} close={()=>setModal(null)} call={call} act={act} s={s} start={start}/>}
 </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
