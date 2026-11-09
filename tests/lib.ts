import fs from 'node:fs/promises';
import path from 'node:path';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import type {ElectronApplication} from 'playwright';
import {DatabaseSync} from 'node:sqlite';
import {sealedCodec} from '../src/store.ts';
import type {Cipher,Library} from '../src/data.ts';
import {openText} from '../src/sealed.ts';

export function testCipher():Cipher{
 const key=randomBytes(32);
 return {isEncryptionAvailable:()=>true,encryptString(s:string){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);const enc=Buffer.concat([c.update(s,'utf8'),c.final()]);return Buffer.concat([iv,c.getAuthTag(),enc]);},decryptString(b:Buffer){const d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString();}};
}

// Use the running isolated app's mock keychain; never initialize the process-global seal key.
async function readSealKey(app:ElectronApplication,profile:string):Promise<Buffer>{
 const values=JSON.parse(await fs.readFile(path.join(profile,'secrets.json'),'utf8')) as Record<string,string>;
 const encoded=JSON.parse(await app.evaluate(({safeStorage},b64)=>safeStorage.decryptString(Buffer.from(b64,'base64')),values.sealKey)) as string;
 return Buffer.from(encoded,'base64');
}

export async function readLibrary(app:ElectronApplication,profile:string):Promise<Library>{
 return JSON.parse(openText(await fs.readFile(path.join(profile,'library.json')),'library.json',await readSealKey(app,profile))) as Library;
}

// Read-only: constructing another Store would interrupt running tasks and pending journal entries.
export async function readTaskAudit(app:ElectronApplication,profile:string,taskId:string){
 const codec=sealedCodec(await readSealKey(app,profile)),db=new DatabaseSync(path.join(profile,'tasks.sqlite'),{readOnly:true});
 const decode=(value:unknown,aad:string):unknown=>{
  if(value===null)return null;
  if(typeof value!=='string'&&!(value instanceof Uint8Array))throw new Error('Missing task audit payload: '+aad);
  return JSON.parse(codec.open(value,aad));
 };
 try{
  const row=db.prepare('SELECT data FROM tasks WHERE id=?').get(taskId);
  const task=decode(row?.data,'tasks:data:'+taskId);
  const journal=db.prepare('SELECT id,tool,args,state,result FROM journal WHERE task_id=?').all(taskId).map(row=>({
   tool:row.tool,args:decode(row.args,'journal:args:'+row.id),state:row.state,result:decode(row.result,'journal:result:'+row.id),
  }));
  return {task,journal};
 }finally{db.close();}
}
