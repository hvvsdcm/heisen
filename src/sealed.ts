import fsp from 'node:fs/promises';
import path from 'node:path';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import type {Secrets} from './data.js';

export const SEAL_MAGIC=Buffer.from('HSN1');
let key:Buffer|undefined;
export class SealError extends Error{}
export function initSealed(secrets:Secrets):void{
 key=undefined;
 let encoded=secrets.get<string>('sealKey');
 if(encoded===undefined){encoded=randomBytes(32).toString('base64');secrets.set('sealKey',encoded);}
 const decoded=Buffer.from(encoded,'base64');
 if(decoded.length!==32)throw new Error('봉인 키가 올바르지 않습니다.');
 key=decoded;
}
export function sealedKey():Buffer{if(!key)throw new Error('봉인 키가 준비되지 않았습니다.');return key;}
export function isSealed(buf:Buffer):boolean{return buf.length>=32&&buf.subarray(0,4).equals(SEAL_MAGIC);}
export function seal(plain:Buffer|string,aad:string,k=sealedKey()):Buffer{
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',k,iv);
 cipher.setAAD(Buffer.from(aad));
 const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
 return Buffer.concat([SEAL_MAGIC,iv,cipher.getAuthTag(),ciphertext]);
}
export function open(blob:Buffer,aad:string,k=sealedKey()):Buffer{
 try{
  if(!isSealed(blob))throw new SealError('봉인 데이터를 열 수 없습니다.');
  const decipher=createDecipheriv('aes-256-gcm',k,blob.subarray(4,16));
  decipher.setAAD(Buffer.from(aad));decipher.setAuthTag(blob.subarray(16,32));
  return Buffer.concat([decipher.update(blob.subarray(32)),decipher.final()]);
 }catch{throw new SealError('봉인 데이터를 열 수 없습니다.');}
}
export async function sealedWrite(file:string,data:string|Buffer):Promise<void>{
 await fsp.writeFile(file+'.tmp',seal(data,path.basename(file)),{mode:0o600});
 await fsp.rename(file+'.tmp',file);
}
async function readFile(file:string):Promise<Buffer|null>{
 try{return await fsp.readFile(file);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return null;throw e;}
}
export async function sealedRead(file:string):Promise<Buffer|null>{
 const blob=await readFile(file);if(blob===null)return null;
 if(!isSealed(blob))throw new SealError('봉인되지 않은 파일입니다.');
 return open(blob,path.basename(file));
}
export async function sealedReadText(file:string):Promise<string|null>{return (await sealedRead(file))?.toString('utf8')??null;}
export async function migrateToSealed(file:string):Promise<'sealed'|'already'|'missing'>{
 const plain=await readFile(file);if(plain===null)return 'missing';if(isSealed(plain))return 'already';
 // Authentication belongs to the final filename, not the migration staging filename.
 await fsp.writeFile(file+'.sealing',seal(plain,path.basename(file)),{mode:0o600});
 await fsp.rename(file,file+'.v0');await fsp.rename(file+'.sealing',file);
 return 'sealed';
}
export async function dropBackup(file:string):Promise<void>{await fsp.rm(file+'.v0',{force:true});}
export function sealText(text:string,aad:string,k?:Buffer):Buffer{return seal(text,aad,k);}
export function openText(blob:Buffer,aad:string,k?:Buffer):string{return open(blob,aad,k).toString('utf8');}
