import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {transformSync} from 'esbuild';
import {originOf} from '../src/protocol.ts';
import type {SecurityPatch} from '../src/main.ts';

// Importing main.ts starts Electron. Compile its contiguous pure declarations
// instead, with the same TypeScript compiler used by the app build.
const source=fs.readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const start=source.indexOf('export function securityPatch('),end=source.indexOf('app.enableSandbox();');
assert.ok(start>=0&&end>start);
const code=transformSync(source.slice(start,end),{loader:'ts',format:'cjs',target:'es2022'}).code;
const module={exports:{}} as {exports:{securityPatch:(input:unknown)=>SecurityPatch;browsingSince:(range:unknown,now?:number)=>number}};
new Function('module','exports','originOf',code)(module,module.exports,originOf);
const {securityPatch,browsingSince}=module.exports;

test('range starts use rolling hours, days, weeks and four weeks',()=>{
 const now=Date.UTC(2026,10,7,12);
 for(const [range,duration] of Object.entries({hour:3600000,day:86400000,week:604800000,month:2419200000}))assert.equal(browsingSince(range,now),now-duration);
 assert.equal(browsingSince('all',now),0);assert.equal(browsingSince(undefined,now),0);
 for(const value of [null,'',false,0,{},[],['hour'],'year','toString','__proto__'])assert.throws(()=>browsingSince(value,now));
 const since=browsingSince('hour',now);assert.deepEqual([since-1,since,since+1].filter(at=>at<since),[since-1]);
});
test('security groups validate without mutating inputs and canonicalize host exceptions',()=>{
 const input={https:{allowed:['Example.COM.','example.com','한글.kr','localhost']},safeBrowsing:{enabled:false},downloads:{askWhere:true},agentSites:{'https://example.com':'block','http://localhost:8080':'allow'}};
 const before=structuredClone(input),patch=securityPatch(input);
 assert.deepEqual(patch,{...input,https:{allowed:['example.com','xn--bj0bj06e.kr','localhost']}});assert.deepEqual(input,before);
 assert.notEqual(patch.agentSites,input.agentSites);assert.notEqual(patch.https,input.https);
 assert.deepEqual(securityPatch({}),{});assert.deepEqual(securityPatch({https:{allowed:[]},agentSites:{}}),{https:{allowed:[]},agentSites:{}});
});
test('security rejects unknown keys, malformed groups and coercion',()=>{
 for(const input of [null,undefined,[],true,'',1,{unknown:{}},{safeBrowsing:false},{downloads:[]},{https:null},{agentSites:[]},{safeBrowsing:{}},{safeBrowsing:{enabled:'false'}},{safeBrowsing:{enabled:0}},{safeBrowsing:{enabled:true,extra:1}},{downloads:{askWhere:1}},{downloads:{askWhere:false,extra:1}},{https:{allowed:'example.com'}},{https:{allowed:[],extra:true}},JSON.parse('{"__proto__":{}}'),Object.create({safeBrowsing:{enabled:false}})])assert.throws(()=>securityPatch(input),JSON.stringify(input));
});
test('host exceptions reject URLs, credentials, ports, wildcards and malformed hosts',()=>{
 for(const host of ['',null,12,' example.com','example.com ','https://example.com','example.com/path','example.com:80','x@example.com','*.example.com','a..com','-a.com','a-.com','a'.repeat(64)+'.com','a#b','a?b','a\\b','%65xample.com','a'.repeat(254)])assert.throws(()=>securityPatch({https:{allowed:[host]}}),String(host));
 assert.throws(()=>securityPatch({https:{allowed:Array(501).fill('example.com')}}));
 assert.equal(securityPatch({https:{allowed:Array.from({length:500},(_,i)=>'h'+i+'.test')}}).https?.allowed.length,500);
});
test('agent policies require exact HTTP(S) origins, explicit decisions and bounded size',()=>{
 for(const origin of ['https://example.com/','https://example.com/path','https://user:pass@example.com','https://EXAMPLE.com','https://example.com:443','file:///tmp','javascript:alert(1)','__proto__','constructor','https://example.com?x=1'])assert.throws(()=>securityPatch({agentSites:{[origin]:'block'}}));
 for(const value of [true,false,null,0,'deny','BLOCK',{}])assert.throws(()=>securityPatch({agentSites:{'https://example.com':value}}));
 const sites=Object.fromEntries(Array.from({length:500},(_,i)=>['https://h'+i+'.test','block']));assert.equal(Object.keys(securityPatch({agentSites:sites}).agentSites!).length,500);
 assert.throws(()=>securityPatch({agentSites:{...sites,'https://extra.test':'allow'}}));
});
test('an invalid later group cannot partially apply earlier groups',()=>{
 const settings={safeBrowsing:{enabled:true},downloads:{askWhere:false},https:{allowed:[]},agentSites:{}};
 assert.throws(()=>Object.assign(settings,securityPatch({safeBrowsing:{enabled:false},downloads:{askWhere:'yes'}})));
 assert.equal(settings.safeBrowsing.enabled,true);
});
