import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {EventEmitter} from 'node:events';
import {randomUUID} from 'node:crypto';
import {transformSync} from 'esbuild';
import type {Permissions as PermissionsClass,PermissionRequest} from '../src/permissions.ts';
import type {Windows} from '../src/windows.ts';
import type {Data} from '../src/data.ts';
type Contents=EventEmitter&{id:number;url:string;session:TestSession;getURL:()=>string};
type RequestHandler=(wc:Contents,permission:string,callback:(allow:boolean)=>void,details:{requestingUrl:string;mediaTypes?:string[]})=>void;
type CheckHandler=(wc:Contents|null,permission:string,origin:string,details:{mediaType?:string;embeddingOrigin?:string})=>boolean;
type TestSession={request:RequestHandler;check:CheckHandler;setPermissionRequestHandler:(fn:RequestHandler)=>void;setPermissionCheckHandler:(fn:CheckHandler)=>void};

// Execute the real handlers without starting Electron or its global RPC registry.
const code=transformSync(fs.readFileSync(new URL('../src/permissions.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs',target:'es2022'}).code;
function fixture(){
 const methods:Record<string,(args:Record<string,unknown>)=>unknown>={},states:Record<string,()=>unknown>={};
 const module={exports:{}} as {exports:{Permissions:typeof PermissionsClass;permissionKey:(origin:string,topOrigin:string)=>string}};
 new Function('module','exports','require',code)(module,module.exports,(name:string)=>{
  if(name==='node:crypto')return {randomUUID};
  if(name==='./rpc.ts')return {registerRpc:(group:typeof methods)=>Object.assign(methods,group),registerState:(name:string,fn:()=>unknown)=>{states[name]=fn;}};
  throw new Error('Unexpected dependency '+name);
 });
 const session=():TestSession=>({request:()=>{throw new Error('Not installed');},check:()=>{throw new Error('Not installed');},setPermissionRequestHandler(fn){this.request=fn;},setPermissionCheckHandler(fn){this.check=fn;}});
 const regular=session(),privateSession=session(),permissions:Record<string,Record<string,'allow'|'block'>>={};
 let saves=0;
 const data={state:{permissions},save:()=>{saves++;}};
 const tabs=new Map<number,{id:number;view:{webContents:Contents}}>(),browser={tabs,tabForContents:(wc:Contents)=>tabs.get(wc.id)};
 const windows={sessions:{session:regular,configureSessions:(fn:(ses:TestSession)=>void)=>{fn(regular);fn(privateSession);}},byContents:()=>browser,tabForContents:browser.tabForContents,current:()=>browser,byTab:()=>browser};
 // The test doubles implement only the Electron surfaces this module consumes.
 const manager=new module.exports.Permissions(windows as unknown as Windows,data as unknown as Data,()=>{});manager.install();
 function contents(id:number,url:string,ses=regular){const wc=Object.assign(new EventEmitter(),{id,url,session:ses,getURL(){return this.url;}});tabs.set(id,{id,view:{webContents:wc}});return wc;}
 const pending=()=>states.permissionRequests() as PermissionRequest[];
 return {regular,privateSession,permissions,methods,pending,contents,key:module.exports.permissionKey,saves:()=>saves};
}
test('legacy same-origin grants never authorize the origin embedded on another site',()=>{
 const f=fixture(),origin='https://camera.test',a=f.contents(1,origin),b=f.contents(2,'https://a.test'),c=f.contents(3,'https://b.test');
 f.permissions[origin]={camera:'allow',microphone:'block'};
 assert.equal(f.regular.check(a,'media',origin,{mediaType:'video'}),true);
 assert.equal(f.regular.check(b,'media',origin,{mediaType:'video'}),false);
 let answer:boolean|undefined;
 f.regular.request(b,'media',(allow:boolean)=>{answer=allow;},{requestingUrl:origin+'/frame',mediaTypes:['video']});
 assert.equal(answer,undefined);const request=f.pending()[0];assert.equal(request.topOrigin,'https://a.test');
 f.methods['permission.decide']({id:request.id,allow:true});assert.equal(answer,true);
 assert.equal(f.regular.check(b,'media',origin,{mediaType:'video'}),true);
 assert.equal(f.regular.check(c,'media',origin,{mediaType:'video'}),false);
 assert.equal(f.regular.check(null,'media',origin,{mediaType:'video',embeddingOrigin:'https://a.test'}),true);
 assert.equal(f.regular.check(null,'media',origin,{mediaType:'video'}),false);
 assert.deepEqual(f.permissions[f.key(origin,'https://a.test')],{camera:'allow'});
 assert.equal(f.methods['permission.reset']({origin:f.key(origin,'https://a.test')}),true);
 assert.equal(f.regular.check(b,'media',origin,{mediaType:'video'}),false);
 assert.deepEqual(f.permissions[origin],{camera:'allow',microphone:'block'});
});
test('permission decisions settle only the matching embedding origin and navigation cancels pending approval',()=>{
 const f=fixture(),origin='https://frame.test',a=f.contents(1,'https://a.test'),b=f.contents(2,'https://b.test');
 let first:boolean|undefined,second:boolean|undefined;
 f.regular.request(a,'geolocation',(allow:boolean)=>{first=allow;},{requestingUrl:origin});
 f.regular.request(b,'geolocation',(allow:boolean)=>{second=allow;},{requestingUrl:origin});
 f.methods['permission.decide']({id:f.pending()[0].id,allow:true});assert.equal(first,true);assert.equal(second,undefined);assert.equal(f.pending().length,1);
 b.emit('did-start-navigation',{isMainFrame:true,isSameDocument:false});assert.equal(second,false);assert.equal(f.pending().length,0);
 assert.equal(f.permissions[f.key(origin,'https://b.test')],undefined);
});
test('private permission grants remain session-local and partitioned by top-level origin',()=>{
 const f=fixture(),origin='https://frame.test',top='https://a.test',a=f.contents(1,top,f.privateSession),b=f.contents(2,'https://b.test',f.privateSession);
 f.permissions[f.key(origin,top)]={camera:'allow',microphone:'block'};
 assert.equal(f.privateSession.check(a,'media',origin,{mediaType:'video'}),false);
 assert.equal(f.privateSession.check(a,'media',origin,{mediaType:'audio'}),false);
 let answer:boolean|undefined;f.privateSession.request(a,'media',(allow:boolean)=>{answer=allow;},{requestingUrl:origin,mediaTypes:['video']});
 f.methods['permission.decide']({id:f.pending()[0].id,allow:true});assert.equal(answer,true);assert.equal(f.saves(),0);
 assert.equal(f.privateSession.check(a,'media',origin,{mediaType:'video'}),true);assert.equal(f.privateSession.check(b,'media',origin,{mediaType:'video'}),false);
});
