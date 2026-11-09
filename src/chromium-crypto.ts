import {pbkdf2Sync,createCipheriv,createDecipheriv} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import fs from 'node:fs/promises';
const V10=Buffer.from('v10'),IV=Buffer.alloc(16,0x20);
export function deriveKey(password:string):Buffer{return pbkdf2Sync(password,'saltysalt',1003,16,'sha1');}
export function decryptV10(data:Uint8Array,key:Buffer):Buffer|null{
  const buf=Buffer.from(data.buffer,data.byteOffset,data.byteLength);
  if(buf.length<3||!buf.subarray(0,3).equals(V10))return null;
  const d=createDecipheriv('aes-128-cbc',key,IV);
  return Buffer.concat([d.update(buf.subarray(3)),d.final()]);
}
export function encryptV10(plain:Buffer|string,key:Buffer):Buffer{const c=createCipheriv('aes-128-cbc',key,IV);return Buffer.concat([V10,c.update(typeof plain==='string'?Buffer.from(plain,'utf8'):plain),c.final()]);}
export function decryptV10Gcm(data:Uint8Array,key32:Buffer):Buffer|null{
  const buf=Buffer.from(data.buffer,data.byteOffset,data.byteLength);
  if(buf.length<31||!buf.subarray(0,3).equals(V10))return null;
  const d=createDecipheriv('aes-256-gcm',key32,buf.subarray(3,15));
  d.setAuthTag(buf.subarray(buf.length-16));
  return Buffer.concat([d.update(buf.subarray(15,buf.length-16)),d.final()]);
}
export async function localStateKey(localStatePath:string,unprotect:(b:Buffer)=>Promise<Buffer>):Promise<{key?:Buffer;appBound:boolean}>{
  const state=JSON.parse(await fs.readFile(localStatePath,'utf8')),crypt=state?.os_crypt;
  const appBound=!!crypt&&Object.hasOwn(crypt,'app_bound_encrypted_key');
  if(crypt?.encrypted_key===undefined)return {appBound};
  const encoded=crypt.encrypted_key;
  if(typeof encoded!=='string'||!encoded.length||encoded.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw new Error('Local State의 암호화 키 형식이 올바르지 않습니다.');
  const blob=Buffer.from(encoded,'base64');
  if(blob.length<=5||blob.subarray(0,5).toString('utf8')!=='DPAPI')throw new Error('Local State의 DPAPI 키를 찾을 수 없습니다.');
  const key=await unprotect(blob.subarray(5));
  if(key.length!==32)throw new Error('Local State의 복호화 키 길이가 올바르지 않습니다.');
  return {key,appBound};
}
// macOS derives a 16-byte CBC key; Windows Local State supplies a 32-byte GCM key.
// Unsupported versions (including app-bound v20) and authentication failures stay unreadable.
export function chromiumDecryptor(key:Buffer):(b:Uint8Array)=>Buffer|null{
  const decrypt=key.length===32?decryptV10Gcm:decryptV10;
  return b=>{try{return decrypt(b,key);}catch{return null;}};
}
export async function keychainPassword(service:string,account?:string):Promise<string>{
  try{const {stdout}=await promisify(execFile)('/usr/bin/security',['find-generic-password','-w','-s',service,...(account?['-a',account]:[])],{timeout:120000,encoding:'utf8'});return stdout.replace(/\r?\n$/,'');}
  catch(error){throw new Error(error&&typeof error==='object'&&'code' in error&&error.code===44?'KEYCHAIN_NOT_FOUND':'KEYCHAIN_DENIED');}
}
export type KeychainReader=(service:string,account?:string)=>Promise<string>;
export function isTestKeychain(env:NodeJS.ProcessEnv,packaged:boolean):boolean{return !packaged&&!!env.HEISEN_TEST_KEYCHAIN;}
// Development hook: HEISEN_TEST_KEYCHAIN is a JSON object mapping keychain service name → password; ignored in packaged builds.
export function keychainReader(env:NodeJS.ProcessEnv,packaged:boolean):KeychainReader{
  if(!isTestKeychain(env,packaged))return keychainPassword;
  const parsed:unknown=JSON.parse(String(env.HEISEN_TEST_KEYCHAIN)),map=new Map<string,unknown>(parsed&&typeof parsed==='object'?Object.entries(parsed):[]);
  return async service=>{const value=map.get(service);if(typeof value!=='string')throw new Error('KEYCHAIN_NOT_FOUND');return value;};
}
