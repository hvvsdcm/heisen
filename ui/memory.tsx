import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {Brain,Plus,History,Sparkles,RotateCcw,Trash2,X,Loader2,Download} from 'lucide-react';
import {diffLines} from 'diff';
import {date,Empty,IconButton,useDialog} from './common.tsx';
import type {Author,Dream,Revision} from '../src/memory.ts';

type Results={'memory.read':string|null;'memory.write':Revision;'memory.delete':Revision;'memory.revert':Revision;'memory.capture':Revision;'memory.history':Revision[];'memory.dreams':Dream[];'memory.dream':Dream;'memory.settings':boolean};
type Call=<M extends keyof Results>(method:M,args?:Record<string,unknown>)=>Promise<Results[M]>;
type Entry={id:string;title:string;at:number;author:Author;bytes:number};
type Schedule={enabled:boolean;cron:string;zone:string;next:number};
const authors:Record<Author,string>={user:'사용자',agent:'에이전트',dreaming:'정리'};
const statuses={applied:'완료',rejected:'미적용',failed:'실패'};
const actions={create:'추가',update:'수정',delete:'삭제'};
const message=(error:unknown)=>String(error instanceof Error?error.message:error).replace(/^Error invoking remote method '[^']+': Error: /,'');

function MemoryDialog({title,close,children,footer}:{title:string;close:()=>void;children:ReactNode;footer?:ReactNode}){
 const box=useRef<HTMLElement>(null);useDialog(box,close);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><section ref={box} tabIndex={-1} className="modal wide memory-dialog" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><IconButton label="닫기" onClick={close}><X size={18}/></IconButton></header><div className="modal-body">{children}</div>{footer&&<footer>{footer}</footer>}</section></div>;
}
function RevisionDiff({revision}:{revision:Revision}){
 const changes=useMemo(()=>diffLines(revision.before??'',revision.after??'',{timeout:100}),[revision.before,revision.after]);
 if(!changes)return <><p className="muted">변경 전</p><pre className="diff">{revision.before??''}</pre><p className="muted">변경 후</p><pre className="diff">{revision.after??''}</pre></>;
 return <pre className="diff" aria-label="변경 내용">{changes.map((part,i)=><span key={i} className={part.added?'add':part.removed?'del':undefined}>{part.value.replace(/\n$/,'').split('\n').map(line=>(part.added?'+ ':part.removed?'- ':'  ')+line+'\n').join('')}</span>)}</pre>;
}
function RevertButton({revision,call,done}:{revision:Revision;call:Call;done:()=>void}){
 const [confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const revert=async()=>{setBusy(true);setError('');try{await call('memory.revert',{id:revision.id});setConfirm(false);done();}catch(e){setError(message(e));}finally{setBusy(false);}};
 return <div className="memory-revert">{error&&<span role="alert" className="error-text">{error}</span>}{confirm?<><span>이 변경 전으로 되돌릴까요?</span><button disabled={busy} onClick={()=>setConfirm(false)}>취소</button><button disabled={busy} onClick={()=>void revert()}>{busy?<Loader2 className="spin" size={15}/>:<RotateCcw size={15}/>} 되돌리기</button></>:<IconButton label="되돌리기" onClick={()=>setConfirm(true)}><RotateCcw size={16}/></IconButton>}</div>;
}
function MemoryEditor({entry,entries,call,close,saved}:{entry:Entry|null;entries:Entry[];call:Call;close:()=>void;saved:()=>void}){
 const [name,setName]=useState(entry?.id??''),[text,setText]=useState(''),[original,setOriginal]=useState('');
 const [loading,setLoading]=useState(!!entry),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState<'discard'|'delete'|null>(null);
 useEffect(()=>{if(!entry)return;let live=true;void window.heisen.call('memory.read',{name:entry.id}).then((value:string|null)=>{if(!live)return;if(value===null)throw new Error('메모리를 찾을 수 없습니다.');setText(value);setOriginal(value);setLoading(false);}).catch(e=>{if(live)setError(message(e));});return ()=>{live=false;};},[entry?.id]);
 const dirty=text!==original||(!entry&&!!name);
 const dismiss=()=>{if(busy)return;if(dirty)setConfirm('discard');else close();};
 const save=async()=>{setBusy(true);setError('');try{if(!entry&&entries.some(v=>v.id.toLowerCase()===name.toLowerCase()))throw new Error('같은 이름의 메모리가 있습니다.');await call('memory.write',{name,text});saved();close();}catch(e){setError(message(e));}finally{setBusy(false);}};
 const remove=async()=>{setBusy(true);setError('');try{await call('memory.delete',{name:entry!.id});saved();close();}catch(e){setError(message(e));}finally{setBusy(false);}};
 return <MemoryDialog title={entry?entry.title:'메모리 추가'} close={dismiss} footer={confirm?<><span className="memory-confirm">{confirm==='delete'?'메모리를 삭제할까요?':'변경사항을 버릴까요?'}</span><button disabled={busy} onClick={()=>setConfirm(null)}>취소</button><button disabled={busy} onClick={()=>confirm==='delete'?void remove():close()}>{confirm==='delete'?'삭제':'버리기'}</button></>:<>{entry&&<IconButton label="삭제" disabled={busy||loading} onClick={()=>setConfirm('delete')}><Trash2 size={16}/></IconButton>}<button disabled={busy} onClick={dismiss}>취소</button><button className="primary" disabled={busy||loading||!name.trim()||!text.trim()||!!entry&&!dirty} onClick={()=>void save()}>{busy?<Loader2 className="spin" size={16}/>:null}저장</button></>}>
 {!entry&&<label>이름<input value={name} maxLength={80} onChange={e=>setName(e.target.value)} disabled={busy} required/></label>}{entry&&<p className="muted">{entry.id} · {authors[entry.author]}</p>}
 {loading&&!error?<p role="status"><Loader2 className="spin" size={16}/> 불러오는 중</p>:<label>내용<textarea value={text} onChange={e=>setText(e.target.value)} rows={14} maxLength={60000} disabled={busy||loading} required/></label>}{error&&<p role="alert" className="error-text">{error}</p>}
 </MemoryDialog>;
}
function DreamDetail({dream,call,close,done}:{dream:Dream;call:Call;close:()=>void;done:()=>void}){
 const [revisions,setRevisions]=useState<Map<string,Revision>|null>(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;const names=[...new Set(dream.changes.filter(c=>c.revisionId).map(c=>c.name))];void Promise.all(names.map(name=>window.heisen.call('memory.history',{name}))).then((lists:Revision[][])=>{if(live)setRevisions(new Map(lists.flat().map(r=>[r.id,r])));}).catch(e=>{if(live)setError(message(e));});return ()=>{live=false;};},[dream.id]);
 return <MemoryDialog title="정리 기록" close={close}><p className="muted">{date(dream.at)} · {statuses[dream.status]}{dream.model&&` · ${dream.model}`}</p>{dream.error&&<p role="alert" className="error-text">{dream.error}</p>}{error&&<p role="alert" className="error-text">{error}</p>}{!revisions&&!error&&<p role="status">불러오는 중</p>}{dream.changes.map((change,i)=>{const revision=change.revisionId?revisions?.get(change.revisionId):undefined;return <section className="memory-change" key={i}><div className="memory-change-heading"><b>{change.name}</b><span className="badge">{actions[change.action]}</span>{revision&&<RevertButton revision={revision} call={call} done={done}/>}</div><p>{change.reason}</p>{revision?<RevisionDiff revision={revision}/>:change.revisionId&&revisions?<p className="error-text">변경 기록을 찾을 수 없습니다.</p>:null}</section>;})}{!dream.changes.length&&!dream.error&&<Empty icon={<Sparkles/>} title="변경 없음"/>}</MemoryDialog>;
}
function DreamSchedule({settings,call}:{settings:Schedule;call:Call}){
 const [cron,setCron]=useState(settings.cron),[zone,setZone]=useState(settings.zone),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setCron(settings.cron);setZone(settings.zone);},[settings.cron,settings.zone]);
 const save=async(enabled:boolean)=>{setBusy(true);setError('');try{await call('memory.settings',{enabled,cron,zone});}catch(e){setError(message(e));}finally{setBusy(false);}};
 return <div className="setting-block memory-schedule"><label className="check-row"><input type="checkbox" checked={settings.enabled} disabled={busy} onChange={e=>void save(e.target.checked)}/>예약 정리</label><div className="form-columns"><label>Cron<input value={cron} onChange={e=>setCron(e.target.value)} disabled={busy} maxLength={200}/></label><label>시간대<input value={zone} onChange={e=>setZone(e.target.value)} disabled={busy} maxLength={100}/></label><button disabled={busy||!cron.trim()||!zone.trim()||cron===settings.cron&&zone===settings.zone} onClick={()=>void save(settings.enabled)}>저장</button></div>{settings.enabled&&settings.next>0&&<p className="muted">다음 정리 {date(settings.next)}</p>}{error&&<p role="alert" className="error-text">{error}</p>}</div>;
}
export function MemoryPage({s,call,search,setNotice,active}:{s:{memory:Entry[];dreams:Dream[];settings:{dreaming:Schedule}};call:Call;act?:unknown;search:string;setNotice:(text:string)=>void;active?:{url:string;incognito?:boolean}}){
 const [tab,setTab]=useState<'memory'|'history'|'dreams'>('memory'),[editor,setEditor]=useState<Entry|null|undefined>(),[revision,setRevision]=useState<Revision|null>(null),[dream,setDream]=useState<Dream|null>(null);
 const [history,setHistory]=useState<Revision[]>([]),[dreams,setDreams]=useState<Dream[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[version,setVersion]=useState(0);
 const entries:Entry[]=s.memory;const memoryKey=entries.map(v=>`${v.id}:${v.at}`).join('|'),dreamKey=(s.dreams as Dream[]).map(v=>v.id).join('|');
 useEffect(()=>{if(tab==='memory')return;let live=true;setLoading(true);void window.heisen.call(tab==='history'?'memory.history':'memory.dreams').then(result=>{if(!live)return;if(tab==='history')setHistory(result);else setDreams(result);}).catch(e=>{if(live)setError(message(e));}).finally(()=>{if(live)setLoading(false);});return ()=>{live=false;};},[tab,memoryKey,dreamKey,version]);
 const changed=()=>setVersion(v=>v+1);
 const capture=async()=>{setBusy(true);setError('');try{await call('memory.capture');setNotice('저장됨');changed();}catch(e){setError(message(e));}finally{setBusy(false);}};
 const run=async()=>{setBusy(true);setError('');try{const report:Dream=await call('memory.dream');if(report.error)setError(report.error);else setNotice('정리 완료');changed();}catch(e){setError(message(e));}finally{setBusy(false);}};
 const query=search.trim().toLowerCase();const memories=entries.filter(v=>`${v.id} ${v.title}`.toLowerCase().includes(query));const revisions=history.filter(v=>`${v.name} ${authors[v.author]}`.toLowerCase().includes(query));const reports=dreams.filter(v=>`${statuses[v.status]} ${v.model} ${v.changes.map(c=>`${c.name} ${c.reason}`).join(' ')}`.toLowerCase().includes(query));
 return <div className="memory-page"><nav className="settings-tabs" aria-label="메모리 보기">{([['memory','메모리'],['history','기록'],['dreams','정리']] as const).map(([id,label])=><button key={id} className={tab===id?'chosen':''} aria-pressed={tab===id} onClick={()=>{if(tab!==id)setLoading(id!=='memory');setTab(id);setError('');}}>{label}</button>)}</nav>
 {error&&<p role="alert" className="error-text">{error}</p>}
 {tab==='memory'&&<><div className="button-row memory-actions"><button className="primary" onClick={()=>setEditor(null)}><Plus size={15}/>추가</button>{active&&!active.incognito&&/^https?:/.test(active.url)&&<button disabled={busy} onClick={()=>void capture()}><Download size={15}/>현재 페이지 저장</button>}</div><div className="rows">{memories.map(entry=><div className="library-row" key={entry.id}><Brain size={18}/><button className="row-text" onClick={()=>setEditor(entry)}><b>{entry.title}</b><span>{date(entry.at)} · {authors[entry.author]}</span></button></div>)}{!memories.length&&<Empty icon={<Brain/>} title={query?'검색 결과 없음':'메모리 없음'}/>}</div></>}
 {tab==='history'&&(loading?<p role="status">불러오는 중</p>:<div className="rows">{revisions.map(item=><div className="library-row memory-history-row" key={item.id}><History size={18}/><button className="row-text" onClick={()=>setRevision(item)}><b>{item.name}</b><span>{date(item.at)} · {authors[item.author]}{item.revertOf?' · 되돌림':''}</span></button><RevertButton revision={item} call={call} done={changed}/></div>)}{!revisions.length&&!error&&<Empty icon={<History/>} title={query?'검색 결과 없음':'기록 없음'}/>}</div>)}
 {tab==='dreams'&&<><div className="button-row memory-actions"><button disabled={busy} onClick={()=>void run()}>{busy?<Loader2 className="spin" size={15}/>:<Sparkles size={15}/>} {busy?'정리 중':'지금 정리'}</button></div><DreamSchedule settings={s.settings.dreaming} call={call}/>{loading?<p role="status">불러오는 중</p>:<div className="rows">{reports.map(report=><div className="library-row" key={report.id}><Sparkles size={18}/><button className="row-text" onClick={()=>setDream(report)}><b>{date(report.at)}</b><span>{statuses[report.status]} · 변경 {report.changes.length}개</span></button></div>)}{!reports.length&&!error&&<Empty icon={<Sparkles/>} title={query?'검색 결과 없음':'정리 기록 없음'}/>}</div>}</>}
 {editor!==undefined&&<MemoryEditor entry={editor} entries={entries} call={call} close={()=>setEditor(undefined)} saved={changed}/>} {revision&&<MemoryDialog title={revision.name} close={()=>setRevision(null)} footer={<RevertButton revision={revision} call={call} done={()=>{changed();setRevision(null);setNotice('되돌림');}}/>}><p className="muted">{date(revision.at)} · {authors[revision.author]}</p><RevisionDiff revision={revision}/></MemoryDialog>}{dream&&<DreamDetail dream={dream} call={call} close={()=>setDream(null)} done={()=>{changed();setNotice('되돌림');}}/>}
 </div>;
}
