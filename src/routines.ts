import {CronExpressionParser} from 'cron-parser';
import {randomUUID} from 'node:crypto';
import {Data,type Routine} from './data.ts';
import {originOf} from './protocol.ts';
export function nextRun(cron:string,zone:string,now=Date.now()){return CronExpressionParser.parse(cron,{tz:zone,currentDate:new Date(now)}).next().getTime();}
export class Routines {
 private active=new Set<string>();
 constructor(public data:Data,private start:(r:Routine)=>Promise<{id:string}>,private running:(id:string)=>boolean,private changed:()=>void){}
 save(input:any){if(typeof input.name!=='string'||!input.name.trim()||typeof input.prompt!=='string'||!input.prompt.trim())throw new Error('루틴 이름과 작업을 입력하세요.');if(!Array.isArray(input.urls)||input.urls.length>12)throw new Error('시작 URL을 확인하세요.');for(const u of input.urls)originOf(u);if(input.kind==='heartbeat'&&!input.targetTask)throw new Error('이어갈 대화를 선택하세요.');const next=nextRun(input.cron,input.zone||'Asia/Seoul');const existing=this.data.state.routines.find(r=>r.id===input.id);const r:Routine={id:existing?.id||randomUUID(),name:input.name.slice(0,200),prompt:input.prompt.slice(0,12000),urls:input.urls,cron:input.cron,zone:input.zone||'Asia/Seoul',enabled:input.enabled!==false,kind:input.kind==='heartbeat'?'heartbeat':'cron',targetTask:input.kind==='heartbeat'?String(input.targetTask):undefined,next,lastTask:existing?.lastTask,mode:input.mode==='deep'?'deep':'normal'};this.data.state.routines=this.data.state.routines.filter(v=>v.id!==r.id);this.data.state.routines.push(r);this.data.save();this.changed();return r;}
 async run(id:string){const r=this.data.state.routines.find(v=>v.id===id);if(!r)throw new Error('루틴을 찾을 수 없습니다.');if(this.active.has(id)||r.lastTask&&this.running(r.lastTask))throw new Error('이 루틴의 이전 작업이 실행 중입니다.');this.active.add(id);r.next=nextRun(r.cron,r.zone);delete r.lastError;this.data.save();try{const task=await this.start(r);r.lastTask=task.id;}catch(e){r.lastError=(e as Error).message;throw e;}finally{this.active.delete(id);this.data.save();this.changed();}}
 async tick(now=Date.now()){for(const r of this.data.state.routines){if(!r.enabled||r.next>now)continue;if(this.active.has(r.id)||r.lastTask&&this.running(r.lastTask)){r.next=nextRun(r.cron,r.zone,now);this.data.save();continue;}try{await this.run(r.id);}catch{}}}
}
