import {useEffect,useRef,useState,type ReactNode} from 'react';
import {BookOpen,Plus,FolderOpen,FileArchive,GitBranch,PencilLine,Trash2,X,Loader2} from 'lucide-react';
import {Empty,IconButton,Markdown,useDialog} from './common.tsx';
import type {SkillMeta} from '../src/skills.ts';

type Entry={id:string;title:string;description:string;enabled:boolean;approved:boolean;source:SkillMeta['source']['kind'];error?:string};
type Results={'skills.list':SkillMeta[];'skills.install':SkillMeta[];'skills.create':SkillMeta;'skills.remove':boolean;'skills.enable':SkillMeta;'skills.body':string;'skills.pickFolder':string|null};
type Call=<M extends keyof Results>(method:M,args?:Record<string,unknown>)=>Promise<Results[M]>;
const sources={git:{icon:GitBranch,label:'Git'},folder:{icon:FolderOpen,label:'폴더'},zip:{icon:FileArchive,label:'ZIP'},local:{icon:PencilLine,label:'직접 만든 스킬'},legacy:{icon:PencilLine,label:'기존 스킬'}};
const message=(error:unknown)=>String(error instanceof Error?error.message:error).replace(/^Error invoking remote method '[^']+': Error: /,'');
function SkillDialog({title,close,children,footer}:{title:string;close:()=>void;children:ReactNode;footer?:ReactNode}){
 const box=useRef<HTMLElement>(null);useDialog(box,close);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><section ref={box} tabIndex={-1} className="modal wide skill-dialog" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><IconButton label="닫기" onClick={close}><X size={18}/></IconButton></header><div className="modal-body">{children}</div>{footer&&<footer>{footer}</footer>}</section></div>;
}
function SkillStatus({entry}:{entry:Entry}){
 return <>{!entry.approved&&<span className="badge warn">승인 필요</span>}{entry.error&&<span className="badge warn" title={entry.error}>오류</span>}</>;
}
function SkillEditor({call,close}:{call:Call;close:()=>void}){
 const [tab,setTab]=useState<'install'|'create'>('install'),[source,setSource]=useState(''),[name,setName]=useState(''),[description,setDescription]=useState(''),[body,setBody]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[discard,setDiscard]=useState(false);
 const dismiss=()=>{if(busy)return;if(source||name||description||body)setDiscard(true);else close();};
 const pick=async()=>{setBusy(true);setError('');try{const folder=await call('skills.pickFolder');if(folder!==null)setSource(folder);}catch(e){setError(message(e));}finally{setBusy(false);}};
 const save=async()=>{setBusy(true);setError('');try{if(tab==='install')await call('skills.install',{source:source.trim()});else await call('skills.create',{name:name.trim(),description:description.trim(),body});close();}catch(e){setError(message(e));}finally{setBusy(false);}};
 return <SkillDialog title="스킬 추가" close={dismiss} footer={discard?<><span className="skill-confirm">변경사항을 버릴까요?</span><button onClick={()=>setDiscard(false)}>취소</button><button onClick={close}>버리기</button></>:<><button disabled={busy} onClick={dismiss}>취소</button><button className="primary" disabled={busy||(tab==='install'?!source.trim():!name.trim()||!description.trim()||!body.trim())} onClick={()=>void save()}>{busy&&<Loader2 className="spin" size={16}/>} {tab==='install'?'설치':'만들기'}</button></>}>
 <nav className="settings-tabs" aria-label="스킬 추가 방식">{([['install','설치'],['create','새로 만들기']] as const).map(([id,label])=><button key={id} disabled={busy||discard} className={tab===id?'chosen':''} aria-pressed={tab===id} onClick={()=>{setTab(id);setError('');}}>{label}</button>)}</nav>
 {tab==='install'?<><label>Git URL · 폴더 · ZIP 경로<input value={source} maxLength={4096} onChange={e=>setSource(e.target.value)} disabled={busy||discard} required/></label><button disabled={busy||discard} onClick={()=>void pick()}><FolderOpen size={15}/>폴더 선택</button></>:<><label>이름<input value={name} maxLength={80} onChange={e=>setName(e.target.value)} disabled={busy||discard} required/></label><label>설명<input value={description} maxLength={500} onChange={e=>setDescription(e.target.value)} disabled={busy||discard} required/></label><label>작업 지시<textarea value={body} maxLength={10000} rows={12} onChange={e=>setBody(e.target.value)} disabled={busy||discard} required/></label></>}
 {error&&<p role="alert" className="error-text">{error}</p>}
 </SkillDialog>;
}
function SkillDetail({entry,close,open}:{entry:Entry;close:()=>void;open:(url:string)=>void}){
 const [detail,setDetail]=useState<{meta:SkillMeta;body:string}|null>(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;setDetail(null);setError('');void Promise.all([window.heisen.call('skills.list'),window.heisen.call('skills.body',{id:entry.id})]).then(([list,body]:[SkillMeta[],string])=>{const meta=list.find(v=>v.id===entry.id);if(!meta)throw new Error('스킬을 찾을 수 없습니다.');if(live)setDetail({meta,body});}).catch(e=>{if(live)setError(message(e));});return ()=>{live=false;};},[entry.id,entry.enabled,entry.approved,entry.error,entry.title,entry.description]);
 return <SkillDialog title={entry.title} close={close}>
 <div className="skill-badges"><SkillStatus entry={entry}/></div>{entry.error&&<p className="error-text">{entry.error}</p>}{error&&<p role="alert" className="error-text">{error}</p>}
 {!detail&&!error&&<p role="status"><Loader2 className="spin" size={16}/> 불러오는 중</p>}
 {detail&&<><p>{detail.meta.description}</p><dl className="skill-metadata"><dt>출처</dt><dd>{sources[detail.meta.source.kind].label}{detail.meta.source.ref&&` · ${detail.meta.source.ref}`}</dd><dt>해시</dt><dd><code>{detail.meta.hash.slice(0,12)}</code></dd>{([['tools','도구'],['sites','사이트'],['scripts','스크립트']] as const).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{detail.meta.permissions[key].join(', ')||'없음'}</dd></div>)}</dl><Markdown text={detail.body} open={open}/></>}
 </SkillDialog>;
}
export function SkillsPage({s,call,act,search}:{s:{skills:Entry[]};call:Call;act:(method:string,args?:Record<string,unknown>)=>void;search:string}){
 const [adding,setAdding]=useState(false),[selected,setSelected]=useState<string|null>(null),[removing,setRemoving]=useState<Entry|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const query=search.trim().toLowerCase(),entries=s.skills.filter(v=>`${v.title} ${v.description}`.toLowerCase().includes(query)),detail=s.skills.find(v=>v.id===selected);
 const toggle=async(entry:Entry,enabled:boolean)=>{setBusy(entry.id);setError('');try{await call('skills.enable',{id:entry.id,enabled});}catch(e){setError(message(e));}finally{setBusy('');}};
 const remove=async()=>{if(!removing)return;setBusy(removing.id);setError('');try{await call('skills.remove',{id:removing.id});setRemoving(null);}catch(e){setError(message(e));}finally{setBusy('');}};
 return <div className="skills-page"><div className="button-row skill-actions"><button className="primary" disabled={!!busy} onClick={()=>setAdding(true)}><Plus size={15}/>추가</button></div>{error&&!removing&&<p role="alert" className="error-text">{error}</p>}<div className="rows">{entries.map(entry=>{const Source=sources[entry.source].icon;return <div className="library-row skill-row" key={entry.id}><BookOpen size={18}/><button className="row-text" onClick={()=>setSelected(entry.id)}><b>{entry.title}</b><span>{entry.description}</span></button><div className="skill-row-actions"><div className="skill-badges"><SkillStatus entry={entry}/></div><span className="skill-source" title={sources[entry.source].label} aria-label={sources[entry.source].label}><Source size={16}/></span><label className="check-row"><input type="checkbox" aria-label={`${entry.title} 사용`} checked={entry.enabled} disabled={!!busy} onChange={e=>void toggle(entry,e.target.checked)}/>사용</label><IconButton label={`${entry.title} 삭제`} disabled={!!busy} onClick={()=>{setError('');setRemoving(entry);}}><Trash2 size={15}/></IconButton></div></div>;})}{!entries.length&&<Empty icon={<BookOpen/>} title={query?'검색 결과 없음':'스킬 없음'}/>}</div>
 {adding&&<SkillEditor call={call} close={()=>setAdding(false)}/>} {detail&&<SkillDetail entry={detail} close={()=>setSelected(null)} open={url=>{setSelected(null);act('tab.new',{url});}}/>}
 {removing&&<SkillDialog title="스킬 삭제" close={()=>{if(!busy)setRemoving(null);}} footer={<><button disabled={!!busy} onClick={()=>setRemoving(null)}>취소</button><button className="primary" disabled={!!busy} onClick={()=>void remove()}>{busy&&<Loader2 className="spin" size={16}/>}삭제</button></>}><p>“{removing.title}”을(를) 삭제할까요?</p>{error&&<p role="alert" className="error-text">{error}</p>}</SkillDialog>}
 </div>;
}
