import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { Task } from './protocol.ts';
import {isSealed,sealText,openText} from './sealed.ts';
export type Codec={seal(text:string,aad:string):Buffer;open(blob:Uint8Array|string,aad:string):string};
export function sealedCodec(key?:Buffer):Codec {
  return {seal:(text,aad)=>sealText(text,aad,key),open:(blob,aad)=>typeof blob==='string'?blob:openText(Buffer.from(blob.buffer,blob.byteOffset,blob.byteLength),aad,key)};
}
export type AuditRow={id:string;at:number;actor:string;taskId?:string;tool:string;origin?:string;summary:string;state:string};
export class Store {
  private db: DatabaseSync;
  constructor(file: string,private codec?:Codec) {
    this.db = new DatabaseSync(file);
    try {
      const version=this.db.prepare('PRAGMA user_version').get()!.user_version;
      if(!codec&&version===1)throw new Error('봉인된 작업 DB입니다.');
      this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA secure_delete=ON;
        CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS journal(id TEXT PRIMARY KEY, task_id TEXT, epoch INTEGER, tool TEXT, args TEXT, state TEXT, result TEXT);
        CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, at INTEGER NOT NULL, actor TEXT NOT NULL, task_id TEXT, tool TEXT NOT NULL, origin BLOB, summary BLOB, state TEXT NOT NULL);
        CREATE INDEX IF NOT EXISTS audit_at ON audit(at);`);
      if(codec&&version===0)this.migrate(file);
      this.db.exec("UPDATE journal SET state='UNKNOWN' WHERE state='PENDING'");
      for (const task of this.allRows()) if (['running','awaiting_approval'].includes(task.status)) {
        task.status = 'interrupted'; task.epoch++; delete task.approval;
        task.events.push({time:new Date().toISOString(),type:'interrupted',text:'프로세스가 재시작되었습니다. 실행 중이던 동작은 자동 반복하지 않습니다.'});
        this.save(task);
      }
      if(codec&&version===1)fs.rmSync(file+'.v0',{force:true});
    } catch(e) { this.db.close(); throw e; }
  }
  private enc(text:string,aad:string):Buffer|string { return this.codec?this.codec.seal(text,aad):text; }
  private dec(value:unknown,aad:string):string {
    if(typeof value==='string')return value;
    if(value instanceof Uint8Array&&isSealed(Buffer.from(value.buffer,value.byteOffset,value.byteLength))){
      if(!this.codec)throw new Error('봉인된 작업 DB입니다.');
      return this.codec.open(value,aad);
    }
    throw new Error('작업 데이터를 읽을 수 없습니다.');
  }
  private migrate(file:string):void {
    const backup=file+'.v0';fs.rmSync(backup,{force:true});
    this.db.prepare('VACUUM INTO ?').run(backup);fs.chmodSync(backup,0o600);
    this.db.exec('BEGIN');
    try {
      const tasks=this.db.prepare('UPDATE tasks SET data=? WHERE id=?');
      for(const row of this.db.prepare('SELECT id,data FROM tasks').all()){
        const id=String(row.id),aad='tasks:data:'+id;
        tasks.run(this.enc(this.dec(row.data,aad),aad),id);
      }
      const journal=this.db.prepare('UPDATE journal SET args=?,result=? WHERE id=?');
      for(const row of this.db.prepare('SELECT id,args,result FROM journal').all()){
        const id=String(row.id),args='journal:args:'+id,result='journal:result:'+id;
        journal.run(row.args===null?null:this.enc(this.dec(row.args,args),args),row.result===null?null:this.enc(this.dec(row.result,result),result),id);
      }
      const audit=this.db.prepare('UPDATE audit SET origin=?,summary=? WHERE id=?');
      for(const row of this.db.prepare('SELECT id,origin,summary FROM audit').all()){
        const id=String(row.id),origin='audit:origin:'+id,summary='audit:summary:'+id;
        audit.run(row.origin===null?null:this.enc(this.dec(row.origin,origin),origin),row.summary===null?null:this.enc(this.dec(row.summary,summary),summary),id);
      }
      this.db.exec('PRAGMA user_version=1; COMMIT');
    } catch(e) { this.db.exec('ROLLBACK'); throw e; }
    // Discard pre-migration WAL frames; the .v0 file is the only intentional plaintext backup.
    this.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  }
  save(task: Task) { this.db.prepare('INSERT OR REPLACE INTO tasks VALUES (?,?)').run(task.id,this.enc(JSON.stringify(task),'tasks:data:'+task.id)); }
  private readTasks(limit?:number):Task[] {
    const rows=limit===undefined?this.db.prepare('SELECT id,data FROM tasks ORDER BY rowid DESC').all():this.db.prepare('SELECT id,data FROM tasks ORDER BY rowid DESC LIMIT ?').all(limit);
    const tasks:Task[]=[];
    for(const row of rows){
      try { tasks.push(JSON.parse(this.dec(row.data,'tasks:data:'+row.id))); }
      catch { console.error('작업 데이터를 읽을 수 없습니다:',row.id); }
    }
    return tasks;
  }
  all():Task[] { return this.readTasks(30); }
  allRows():Task[] { return this.readTasks(); }
  start(id: string, task: Task, tool: string, args: unknown) { this.db.prepare('INSERT INTO journal VALUES (?,?,?,?,?,?,NULL)').run(id,task.id,task.epoch,tool,this.enc(JSON.stringify(args),'journal:args:'+id),'PENDING'); }
  finish(id: string, state: string, result: unknown) { this.db.prepare('UPDATE journal SET state=?, result=? WHERE id=?').run(state,this.enc(JSON.stringify(result).slice(0,100000),'journal:result:'+id),id); }
  audit(e:{actor:'task'|'mcp'|'cli';taskId?:string;tool:string;origin?:string;summary:string;state:'ok'|'error'|'denied'}):void {
    const id=randomUUID();
    this.db.prepare('INSERT INTO audit VALUES (?,?,?,?,?,?,?,?)').run(id,Date.now(),e.actor,e.taskId??null,e.tool,e.origin===undefined?null:this.enc(e.origin,'audit:origin:'+id),this.enc(e.summary.slice(0,2000),'audit:summary:'+id),e.state);
  }
  audits(limit=300):AuditRow[] {
    const rows:AuditRow[]=[];
    for(const row of this.db.prepare('SELECT * FROM audit ORDER BY at DESC LIMIT ?').all(limit)){
      try {
        const id=String(row.id);
        rows.push({id,at:Number(row.at),actor:String(row.actor),...(row.task_id===null?{}:{taskId:String(row.task_id)}),tool:String(row.tool),...(row.origin===null?{}:{origin:this.dec(row.origin,'audit:origin:'+id)}),summary:this.dec(row.summary,'audit:summary:'+id),state:String(row.state)});
      } catch { console.error('감사 기록을 읽을 수 없습니다:',row.id); }
    }
    return rows;
  }
  clearAudit():void { this.db.exec('DELETE FROM audit'); }
  journal(taskId: string) { return this.db.prepare('SELECT id, epoch, tool, state FROM journal WHERE task_id=?').all(taskId); }
  // Events live in the task row; journal rows are keyed by task_id.
  delete(taskId: string) { this.db.exec('BEGIN'); try { this.db.prepare('DELETE FROM journal WHERE task_id=?').run(taskId); this.db.prepare('DELETE FROM tasks WHERE id=?').run(taskId); this.db.exec('COMMIT'); } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  close() { this.db.close(); }
}
