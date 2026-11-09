import {useEffect,useRef,useState} from 'react';
import {RotateCw,Plus,Search,MessageSquare,Globe,Folder,Download,TriangleAlert,CalendarClock,Trash2,Play,Pause,KeyRound,Copy,X,Check,Ban,History,Loader2} from 'lucide-react';
import {date,IconButton,Empty} from './common.tsx';
import {SettingsPage} from './settings.tsx';
import {MemoryPage} from './memory.tsx';
import {SkillsPage} from './skills.tsx';
import type {AuditRow} from '../src/store.ts';
const searchLabels:Record<string,string>={bookmarks:'북마크 검색',history:'방문 기록 검색',memory:'메모리 검색',skills:'스킬 검색',vault:'비밀번호 검색',chats:'대화 검색',activity:'활동 검색'};
const emptyTitles:Record<string,string>={bookmarks:'북마크가 없습니다.',history:'방문 기록이 없습니다.'};
const downloadStates:Record<string,string>={progressing:'다운로드 중',completed:'완료',cancelled:'취소됨',interrupted:'중단됨'};
const host=(origin:string)=>{try{return new URL(origin).host||origin;}catch{return origin;}};
const auditActors:Record<string,string>={task:'작업',mcp:'MCP',cli:'CLI'};
const auditStates:Record<string,string>={ok:'완료',error:'오류',denied:'차단'};
const auditTime=new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function useAudits(active:boolean){
 const [rows,setRows]=useState<AuditRow[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[version,setVersion]=useState(0);
 useEffect(()=>{
  if(!active)return;
  let live=true,request=0;setLoading(true);
  const load=async()=>{
   const current=++request;
   try{const result:AuditRow[]=await window.heisen.call('audit.list');if(live&&current===request){setRows(result);setError('');}}
   catch{if(live&&current===request)setError('활동을 불러오지 못했습니다.');}
   finally{if(live&&current===request)setLoading(false);}
  };
  void load();const off=window.heisen.onChange(()=>void load());
  return ()=>{live=false;off();};
 },[active,version]);
 const clear=async()=>{
  if(busy)return;setBusy(true);
  try{await window.heisen.call('audit.clear');setVersion(v=>v+1);}
  catch{setError('활동을 지우지 못했습니다.');}
  finally{setBusy(false);}
 };
 return {rows,loading,busy,error,clear};
}
function ActivityRows({rows,loading,error,search}:{rows:AuditRow[];loading:boolean;error:string;search:string}){
 const query=search.trim().toLowerCase();
 const filtered=rows.filter(row=>`${auditTime.format(row.at)} ${auditActors[row.actor]||row.actor} ${row.tool} ${row.origin||''} ${auditStates[row.state]||row.state}`.toLowerCase().includes(query));
 return <div className="rows activity-rows" aria-label="에이전트 활동" aria-busy={loading}>
  {error&&<p role="alert" className="error-text">{error}</p>}
  {loading?<p role="status" className="muted"><Loader2 className="spin" size={15}/> 불러오는 중</p>:<>
   {filtered.map(row=>{const StateIcon=row.state==='ok'?Check:row.state==='denied'?Ban:X;const state=auditStates[row.state]||row.state;return <div className="library-row activity-row" key={row.id}>
    <time dateTime={new Date(row.at).toISOString()} title={new Date(row.at).toLocaleString('ko-KR')}>{auditTime.format(row.at)}</time>
    <span className="badge">{auditActors[row.actor]||row.actor}</span>
    <span className="activity-tool" title={row.tool}>{row.tool}</span>
    <span className="activity-origin" title={row.origin}>{row.origin||'—'}</span>
    <span className="activity-state" role="img" aria-label={state} title={state}><StateIcon size={17} aria-hidden="true"/></span>
   </div>;})}
   {!filtered.length&&!error&&<Empty icon={<History/>} title={query?'검색 결과 없음':'에이전트 활동이 없습니다.'}/>}
  </>}
 </div>;
}
export function Library({s,active,act,call,route,setModal,openTask,openURL,search,setSearch,models,modelsBusy,setNotice}:any){
  useEffect(()=>{if(s.route==='vault')void call('import.sync').catch(()=>{});},[s.route]);
  const audits=useAudits(s.route==='activity');
  // Undo for a deleted password: main keeps the entry restorable for 10s (vault.restore).
  const [undo,setUndo]=useState('');const undoTimer=useRef<number|undefined>(undefined);
  const clearUndo=()=>{window.clearTimeout(undoTimer.current);setUndo('');};
  useEffect(()=>()=>window.clearTimeout(undoTimer.current),[]);
  const deletePassword=(id:string)=>call('vault.delete',{id}).then(()=>{window.clearTimeout(undoTimer.current);setUndo(id);undoTimer.current=window.setTimeout(()=>setUndo(''),10000);}).catch(()=>{});
  const match=(v:any)=>JSON.stringify(v).toLowerCase().includes(search.toLowerCase());
  return <div className="library"><div className="library-heading"><div><h1>{{routines:'루틴',memory:'메모리',skills:'스킬',bookmarks:'북마크',history:'방문 기록',downloads:'다운로드',vault:'비밀번호 관리자',settings:'설정',chats:'대화',activity:'에이전트 활동'}[s.route as string]}</h1></div>{s.route==='vault'&&<button onClick={()=>setModal({kind:'import'})}>가져오기</button>}{['routines','vault'].includes(s.route)&&<button className="primary" onClick={()=>setModal({kind:({routines:'routine',vault:'vault'} as any)[s.route]})}><Plus size={15}/> 추가</button>}{s.route==='history'&&<button onClick={()=>setModal({kind:'clearData'})}>인터넷 사용 기록 삭제</button>}{s.route==='activity'&&<button disabled={audits.busy||audits.loading||!audits.rows.length} onClick={()=>void audits.clear()}>지우기</button>}</div>
    {s.route==='settings'?<SettingsPage s={s} call={call} act={act} setModal={setModal} models={models} modelsBusy={modelsBusy} notice={setNotice}/>:<>
    {searchLabels[s.route]&&<label className="list-search"><Search size={15}/><input aria-label={searchLabels[s.route]} placeholder={searchLabels[s.route]} value={search} onChange={e=>setSearch(e.target.value)}/></label>}
    {s.route==='routines'&&<div className="rows">{s.routines.map((r:any)=><div className="library-row" key={r.id}><CalendarClock size={19}/><button className="row-text" onClick={()=>setModal({kind:'routine',data:r})}><b>{r.name}</b><span>{r.enabled?`다음 실행 ${date(r.next)}`:'일시 정지'} · {r.cron}</span>{r.lastError&&<span className="error-text">{r.lastError}</span>}</button>{r.lastTask&&<IconButton label="결과 보기" onClick={()=>openTask(r.lastTask)}><MessageSquare size={16}/></IconButton>}<IconButton label="지금 실행" onClick={()=>act('routine.run',{id:r.id})}><Play size={15}/></IconButton><IconButton label={r.enabled?'일시 정지':'활성화'} onClick={()=>act('routine.toggle',{id:r.id})}>{r.enabled?<Pause size={15}/>:<RotateCw size={15}/>}</IconButton><IconButton label="삭제" onClick={()=>act('routine.delete',{id:r.id})}><Trash2 size={15}/></IconButton></div>)}{!s.routines.length&&<Empty icon={<CalendarClock/>} title="루틴이 없습니다."/>}</div>}
    {s.route==='memory'&&<MemoryPage s={s} call={call} act={act} search={search} setNotice={setNotice} active={active}/>}
    {s.route==='skills'&&<SkillsPage s={s} call={call} act={act} search={search}/>}
    {s.route==='activity'&&<ActivityRows rows={audits.rows} loading={audits.loading} error={audits.error} search={search}/>}
    {['bookmarks','history'].includes(s.route)&&<div className="rows">{s[s.route].filter(match).map((v:any,i:number)=><div className="library-row" key={v.id||i}><Globe size={18}/><button className="row-text" onClick={()=>openURL(v.url)}><b>{v.title||v.url}</b><span>{v.url}</span></button>{s.route==='history'?<small>{date(v.at)}</small>:<IconButton label="삭제" onClick={()=>act('bookmark.delete',{id:v.id})}><Trash2 size={15}/></IconButton>}</div>)}{!s[s.route].length&&<Empty icon={<Folder/>} title={emptyTitles[s.route]}/>}</div>}
    {s.route==='downloads'&&<div className="rows">{s.downloads.map((d:any)=><div className="library-row" key={d.id}><Download size={18}/><div className="row-text"><b>{d.name}{d.state==='dangerous'&&<> <TriangleAlert size={16}/></>}</b><span>{d.state!=='dangerous'&&<>{downloadStates[d.state]||d.state} · </>}{(d.received/1048576).toFixed(1)} MB</span></div>{d.state==='dangerous'?<><button onClick={()=>act('download.keep',{id:d.id})}>보관</button><button onClick={()=>act('download.discard',{id:d.id})}>삭제</button></>:<IconButton label="Finder에서 보기" disabled={d.state!=='completed'} onClick={()=>act('download.reveal',{id:d.id})}><Folder size={16}/></IconButton>}</div>)}{!s.downloads.length&&<Empty icon={<Download/>} title="다운로드 내역이 없습니다."/>}</div>}
    {s.route==='vault'&&<div className="rows">{s.vault.filter(match).map((v:any)=><div className="library-row" key={v.id}><Globe size={18}/><div className="row-text"><b>{host(v.origin)}</b><span>{v.username||'(사용자 이름 없음)'}{v.signup&&(v.signup.by==='agent'?' · 에이전트 가입':' · 생성됨')}</span></div><small>••••••••</small><IconButton label="비밀번호 복사" onClick={()=>call('vault.copy',{id:v.id}).then(()=>setNotice('복사됨')).catch(()=>{})}><Copy size={15}/></IconButton><IconButton label="삭제" onClick={()=>deletePassword(v.id)}><Trash2 size={15}/></IconButton></div>)}{!s.vault.length&&<Empty icon={<KeyRound/>} title="저장된 비밀번호가 없습니다."/>}</div>}
    {s.route==='chats'&&<div className="rows">{s.tasks.filter(match).map((t:any)=><div className="library-row" key={t.id}><MessageSquare size={18}/><button className="row-text" onClick={()=>openTask(t.id)}><b>{t.prompt}</b><span>{date(t.createdAt)}</span></button><IconButton label="삭제" onClick={()=>act('task.delete',{id:t.id})}><Trash2 size={15}/></IconButton></div>)}{!s.tasks.length&&<Empty icon={<MessageSquare/>} title="대화가 없습니다."/>}</div>}
    </>}
    {undo&&s.route==='vault'&&<div role="status" className="toast"><span>비밀번호를 삭제했습니다.</span><button className="toast-action" onClick={()=>{const id=undo;clearUndo();void call('vault.restore',{id}).catch(()=>{});}}>실행취소</button><button aria-label="닫기" onClick={clearUndo}><X size={16}/></button></div>}
   </div>;
}
