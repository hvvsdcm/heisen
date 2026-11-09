import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {ZOOM_LEVELS,stepZoom,zoomKey,insertAfterOpener,shortcutIndex,cycleIndex,pushClosed,popupSize,popupLabel,popupStripHtml,omnibox,externalScheme,sameOriginBlob,closeSelection,moveTab,uniqueFilename,quarantineValue,stringArrayPlist,HOME} from '../src/browser-util.ts';
import {HttpsFirst,upgradable,connectionError,certError} from '../src/https-first.ts';
import {DANGEROUS_EXTENSIONS,dangerousName} from '../src/downloads-guard.ts';
import type {Data} from '../src/data.ts';
const search=(q:string)=>({url:'https://www.google.com/search?q='+encodeURIComponent(q)});
test('omnibox: local hosts open over http, dotted hosts over https with an http fallback',()=>{
  assert.deepEqual(omnibox('localhost:3000'),{url:'http://localhost:3000/'});assert.deepEqual(omnibox('localhost'),{url:'http://localhost/'});
  assert.deepEqual(omnibox('localhost:5173/app?x=1'),{url:'http://localhost:5173/app?x=1'});
  assert.deepEqual(omnibox('example.com:8080'),{url:'https://example.com:8080/',fallback:'http://example.com:8080/'});
  assert.deepEqual(omnibox('dev.local:5173/app'),{url:'https://dev.local:5173/app',fallback:'http://dev.local:5173/app'});
  assert.deepEqual(omnibox('example.com'),{url:'https://example.com/',fallback:'http://example.com/'});
  assert.deepEqual(omnibox('192.168.0.1'),{url:'http://192.168.0.1/'});assert.deepEqual(omnibox('127.0.0.1:8080'),{url:'http://127.0.0.1:8080/'});
  assert.deepEqual(omnibox('[::1]:3000'),{url:'http://[::1]:3000/'});assert.deepEqual(omnibox('myserver:8080/x'),{url:'http://myserver:8080/x'});
  assert.deepEqual(omnibox('  https://Example.com/a b '),{url:'https://example.com/a%20b'});assert.deepEqual(omnibox('http://localhost:3000'),{url:'http://localhost:3000/'});
  assert.deepEqual(omnibox(HOME),{url:HOME});
});
test('omnibox: hosts whose first label is all digits are URLs, IPv4 stays local',()=>{
  for(const h of ['163.com','126.com','58.com','1688.com','360.cn','10.0.0.1.nip.io'])assert.deepEqual(omnibox(h),{url:`https://${h}/`,fallback:`http://${h}/`},h);
  assert.deepEqual(omnibox('58.com/job?x=1'),{url:'https://58.com/job?x=1',fallback:'http://58.com/job?x=1'});
  assert.deepEqual(omnibox('10.0.0.1'),{url:'http://10.0.0.1/'});
});
test('omnibox: everything else is a Google search; non-web schemes and credentials are refused',()=>{
  for(const q of ['how to x','a.b c','note:later','1.5','node','999.1.1.1','example.com:99999'])assert.deepEqual(omnibox(q),search(q),q);
  for(const v of ['mailto:x','javascript:alert(1)','file:///etc/passwd','data:text/html,x','ftp://example.com','heisen://settings'])assert.throws(()=>omnibox(v),/HTTP\(S\)/,v);
  for(const v of ['https://user:pw@example.com','user:pw@example.com'])assert.throws(()=>omnibox(v),/인증 정보/,v);
});
test('HTTPS First excludes local, nonstandard and remembered hosts',()=>{
 for(const url of ['http://localhost/','http://a.localhost/','http://printer.local/','http://127.0.0.1/','http://10.2.3.4/','http://172.16.1.1/','http://192.168.1.1/','http://8.8.8.8/','http://[::1]/','http://[fc00::1]/','http://[fe80::1]/','http://myserver/','http://example.com:8080/','https://example.com/','http://user:pw@example.com/','bad URL'])assert.equal(upgradable(url,new Set()),null,url);
 assert.equal(upgradable('http://example.com/a?q=1#x',new Set()),'https://example.com/a?q=1#x');
 assert.equal(upgradable('http://example.com:80/',new Set()),'https://example.com/');
 assert.equal(upgradable('http://EXAMPLE.com./',new Set(['example.com'])),null);
 assert.equal(upgradable('http://www.example.com/',new Set(['example.com'])),'https://www.example.com/');
});
test('HTTPS errors distinguish connections from certificates and aborts',()=>{
 for(const code of [-100,-102,-107,-199]){assert.equal(connectionError(code),true);assert.equal(certError(code),false);}
 for(const code of [-200,-202,-299]){assert.equal(connectionError(code),false);assert.equal(certError(code),true);}
 for(const code of [-99,-3,-300,0]){assert.equal(connectionError(code),false);assert.equal(certError(code),false);}
});
test('HTTPS First tracks exact fresh upgrades, remembers consent and cleans up contents',()=>{
 let saves=0;const data={state:{settings:{https:{allowed:[] as string[]}}},save(){saves++;}} as unknown as Data;
 const policy=new HttpsFirst(data),rule=policy.rule(),request={url:'http://example.com/a',resourceType:'mainFrame',webContentsId:9} as Electron.OnBeforeRequestListenerDetails;
 assert.deepEqual(rule.before!(request),{redirectURL:'https://example.com/a'});
 assert.deepEqual(policy.blockFor(9,'https://example.com/a',-102,'ERR_CONNECTION_REFUSED'),{kind:'http',url:request.url,host:'example.com',detail:'ERR_CONNECTION_REFUSED',canProceed:true});
 assert.equal(policy.blockFor(9,'https://other.example/a',-102,'failed'),null);
 assert.equal(policy.blockFor(9,'https://example.com/a',-3,'aborted'),null);
 policy.upgraded.get(9)!.at=Date.now()-5001;assert.equal(policy.blockFor(9,'https://example.com/a',-102,'failed'),null);
 policy.allow('EXAMPLE.com.');policy.allow('example.com');assert.equal(saves,1);assert.deepEqual(data.state.settings.https.allowed,['example.com']);
 assert.equal(rule.before!(request),undefined);assert.equal(policy.upgraded.size,0);
 policy.forget(9);assert.equal(policy.lastCert.size,0);
});
test('certificate failures never downgrade or override Chromium HSTS enforcement',()=>{
 const policy=new HttpsFirst({} as Data),wc={id:9} as Electron.WebContents,cert={fingerprint:'SHA256:fixture'} as Electron.Certificate;
 let trusted:boolean|undefined;policy.certificateError({defaultPrevented:false,preventDefault(){assert.fail('certificate override');}},wc,'https://example.com/','ERR_CERT_AUTHORITY_INVALID',cert,value=>{trusted=value;},true);
 assert.equal(trusted,false);
 assert.deepEqual(policy.blockFor(9,'https://example.com/',-202,'ERR_CERT_AUTHORITY_INVALID'),{kind:'cert',url:'https://example.com/',host:'example.com',detail:'ERR_CERT_AUTHORITY_INVALID',fingerprint:cert.fingerprint,canProceed:false});
 policy.certificateError({} as Electron.Event,wc,'https://cdn.example/','bad',cert,value=>{trusted=value;},false);
 assert.equal(trusted,false);assert.equal(policy.lastCert.get(9)?.url,'https://example.com/');
 policy.forget(9);assert.equal(policy.lastCert.size,0);
 assert.equal(policy.blockFor(9,'https://example.com/',-102,'failed'),null);
});
test('HTTPS pages reject plaintext subresources without upgrading subframes',()=>{
 const policy=new HttpsFirst({} as Data),before=policy.rule().before!;
 for(const resourceType of ['script','image','subFrame','webSocket'])assert.deepEqual(before({url:resourceType==='webSocket'?'ws://example.com/':'http://example.com/',resourceType,initiatorOrigin:'https://secure.example/'} as Electron.OnBeforeRequestListenerDetails),{cancel:true});
 assert.equal(before({url:'https://cdn.example/',resourceType:'script',initiatorOrigin:'https://secure.example/'} as Electron.OnBeforeRequestListenerDetails),undefined);
 assert.equal(before({url:'http://example.com/',resourceType:'image',initiatorOrigin:'http://example.com/'} as Electron.OnBeforeRequestListenerDetails),undefined);
});
test('externalScheme hands app schemes to the OS, never web or local ones',()=>{
  assert.equal(externalScheme('mailto:a@b.c'),'mailto');assert.equal(externalScheme('TEL:123'),'tel');assert.equal(externalScheme('zoommtg://zoom.us/join'),'zoommtg');
  assert.equal(externalScheme('msteams:/l/meetup'),'msteams');assert.equal(externalScheme('slack://open'),'slack');
  for(const u of ['https://a.b','http://a.b','file:///x','javascript:x','data:text/html,x','chrome://settings','devtools://x','blob:https://a.b/1','about:blank','view-source:https://a.b','no scheme'])assert.equal(externalScheme(u),null,u);
});
test('sameOriginBlob accepts blob URLs of the page origin only',()=>{
  assert.equal(sameOriginBlob('blob:https://a.com/1-2','https://a.com/doc'),true);assert.equal(sameOriginBlob('blob:http://localhost:3000/x','http://localhost:3000/'),true);
  assert.equal(sameOriginBlob('blob:https://a.com/1','https://b.com/'),false);assert.equal(sameOriginBlob('blob:null/1','https://a.com/'),false);
  assert.equal(sameOriginBlob('https://a.com/1','https://a.com/'),false);assert.equal(sameOriginBlob('blob:https://a.com/1','about:blank'),false);
});
test('closeSelection follows Chrome: child, sibling, opener, right, left',()=>{
  const openers:Record<number,number|undefined>={};const of=(id:number)=>openers[id];
  assert.equal(closeSelection([1,2,3],2,of),3);assert.equal(closeSelection([1,2,3],3,of),2);assert.equal(closeSelection([1],1,of),undefined);assert.equal(closeSelection([1,2],9,of),undefined);
  openers[3]=1;assert.equal(closeSelection([1,3,2],3,of),1,'back to the opener');
  openers[4]=1;assert.equal(closeSelection([1,3,4,2],3,of),4,'next sibling first');assert.equal(closeSelection([1,3,4,2],4,of),3,'sibling on the left');
  openers[5]=3;assert.equal(closeSelection([1,3,5,4,2],3,of),5,'own child first');
  openers[6]=9;assert.equal(closeSelection([1,6,2],6,of),2,'missing opener → right');
});
test('moveTab keeps pinned tabs before unpinned ones',()=>{
  const pinned=new Set([1,2]);const p=(id:number)=>pinned.has(id);
  assert.deepEqual(moveTab([1,2,3,4,5],5,0,p),[1,2,5,3,4]);assert.deepEqual(moveTab([1,2,3,4,5],3,9,p),[1,2,4,5,3]);
  assert.deepEqual(moveTab([1,2,3,4,5],1,4,p),[2,1,3,4,5]);assert.deepEqual(moveTab([1,2,3,4,5],4,2,p),[1,2,4,3,5]);
  assert.deepEqual(moveTab([1,2,3],7,0,p),[1,2,3]);assert.deepEqual(moveTab([1,2,3,4],4,NaN,p),[1,2,4,3]);
  pinned.add(4);assert.deepEqual(moveTab([1,2,3,4,5],4,Infinity,p),[1,2,4,3,5],'pin → end of pinned group');
  pinned.delete(1);assert.deepEqual(moveTab([1,2,4,3,5],1,0,p),[2,4,1,3,5],'unpin → first unpinned');
});
test('uniqueFilename numbers like Chrome',()=>{
  const taken=new Set(['a.txt','a (1).txt','x.tar.gz','README']);const t=(n:string)=>taken.has(n);
  assert.equal(uniqueFilename('b.txt',t),'b.txt');assert.equal(uniqueFilename('a.txt',t),'a (2).txt');
  assert.equal(uniqueFilename('x.tar.gz',t),'x (1).tar.gz');assert.equal(uniqueFilename('README',t),'README (1)');
});
test('dangerousName classifies executable types case-insensitively by the final extension',()=>{
  for(const ext of DANGEROUS_EXTENSIONS){
    assert.equal(dangerousName('download.'+ext),true,ext);
    assert.equal(dangerousName('download.'+ext.toUpperCase()),true,ext.toUpperCase());
  }
  for(const name of ['report.pdf.exe','run.command','installer.app','archive.zip.sh','file.exe.','file.EXE . .','run.terminal','open.url','auth.scf','run.desktop','run.appref-ms','run.jnlp','run.msc','run.wsc','run.sct','run.py','run.pyw','run.ws'])assert.equal(dangerousName(name),true,name);
  for(const name of ['','README','.exe','report.pdf','image.png','notes.txt','file.tar.gz','installer.app.zip','run.command.txt','report.pdf. '])assert.equal(dangerousName(name),false,name);
});
test('quarantineValue uses Chrome\'s flags, hex seconds, agent and uppercase UUID',()=>{
  assert.equal(quarantineValue(1_700_000_000_999,'0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0'),'0083;6553f100;Heisen;0F1E2D3C-4B5A-6978-8796-A5B4C3D2E1F0');
});
test('stringArrayPlist writes a binary plist array that plutil reads back',{skip:process.platform!=='darwin'},()=>{
  for(const items of [['https://a.com/f.zip','https://a.com/'],['https://예시.com/'+'x'.repeat(300)],Array.from({length:300},(_,i)=>'u'+i),[]]){
   const bytes=stringArrayPlist(items);assert.equal(bytes.subarray(0,8).toString(),'bplist00');
   assert.deepEqual(JSON.parse(execFileSync('/usr/bin/plutil',['-convert','json','-o','-','-'],{input:bytes}).toString()),items);
  }
});
test('stepZoom follows Chrome zoom levels',()=>{
  assert.equal(stepZoom(1,'in'),1.1);assert.equal(stepZoom(1,'out'),0.9);assert.equal(stepZoom(1.75,'reset'),1);
  assert.equal(stepZoom(1.1000000000000003,'in'),1.25);assert.equal(stepZoom(1.0999999,'out'),1);
  assert.equal(stepZoom(1.2,'in'),1.25);assert.equal(stepZoom(1.2,'out'),1.1);
  assert.equal(stepZoom(5,'in'),5);assert.equal(stepZoom(0.25,'out'),0.25);
  let z=0.25;const seen=[z];while(stepZoom(z,'in')!==z){z=stepZoom(z,'in');seen.push(z);}assert.deepEqual(seen,ZOOM_LEVELS);
});
test('zoomKey uses http(s) hostname, matching Chromium per-host zoom',()=>{
  assert.equal(zoomKey('https://Example.com/a?b#c'),'example.com');assert.equal(zoomKey('http://localhost:8080/x'),'localhost');
  assert.equal(zoomKey('https://example.com:443/'),'example.com');
  assert.equal(zoomKey('heisen://newtab'),undefined);assert.equal(zoomKey('file:///tmp/a.html'),undefined);assert.equal(zoomKey('not a url'),undefined);
});
test('insertAfterOpener places after opener and its existing children',()=>{
  const openers:Record<number,number|undefined>={1:undefined,2:undefined,3:1,4:1,5:undefined};const of=(id:number)=>openers[id];
  assert.equal(insertAfterOpener([1,2,5],undefined,of),3);assert.equal(insertAfterOpener([1,2,5],9,of),3);
  assert.equal(insertAfterOpener([1,2,5],1,of),1);assert.equal(insertAfterOpener([1,3,4,2,5],1,of),3);
  assert.equal(insertAfterOpener([1,3,4],1,of),3);assert.equal(insertAfterOpener([1,3,2,4],1,of),2);
});
test('shortcutIndex maps ⌘1–⌘8 and ⌘9',()=>{
  assert.equal(shortcutIndex(1,3),0);assert.equal(shortcutIndex(3,3),2);assert.equal(shortcutIndex(4,3),-1);assert.equal(shortcutIndex(8,10),7);
  assert.equal(shortcutIndex(9,3),2);assert.equal(shortcutIndex(9,12),11);assert.equal(shortcutIndex(9,0),-1);
  assert.equal(shortcutIndex(0,3),-1);assert.equal(shortcutIndex(10,20),-1);assert.equal(shortcutIndex(1.5,3),-1);assert.equal(shortcutIndex(NaN,3),-1);
});
test('cycleIndex wraps both ways',()=>{
  assert.equal(cycleIndex(0,3,1),1);assert.equal(cycleIndex(2,3,1),0);assert.equal(cycleIndex(0,3,-1),2);assert.equal(cycleIndex(0,1,1),0);
  assert.equal(cycleIndex(-1,3,1),0);assert.equal(cycleIndex(-1,3,-1),2);assert.equal(cycleIndex(0,0,1),-1);
});
test('pushClosed keeps the newest entries up to the limit',()=>{
  let stack:number[]=[];for(let i=1;i<=30;i++)stack=pushClosed(stack,i);
  assert.equal(stack.length,25);assert.equal(stack[0],6);assert.equal(stack.at(-1),30);
  const before=[1,2];const after=pushClosed(before,3,2);assert.deepEqual(after,[2,3]);assert.deepEqual(before,[1,2]);
  assert.deepEqual(pushClosed([],'a'),['a']);assert.deepEqual(pushClosed([1,2,3],4,0),[4]);
});
test('popupSize reads window.open features',()=>{
  assert.deepEqual(popupSize('width=480,height=720,left=10'),{width:480,height:720});
  assert.deepEqual(popupSize('popup'),{width:500,height:650});assert.deepEqual(popupSize('innerwidth=300, Height = 400'),{width:500,height:400});
  assert.deepEqual(popupSize('width=10,height=99999'),{width:500,height:4096});
});
test('popupLabel shows the main frame origin, warns on http and never page-written URL text',()=>{
  assert.deepEqual(popupLabel('https://accounts.google.com','https://accounts.google.com/signin?x=1'),{warning:'',origin:'https://accounts.google.com'});
  assert.deepEqual(popupLabel('http://127.0.0.1:8080','http://127.0.0.1:8080/login'),{warning:'주의 요함 · ',origin:'http://127.0.0.1:8080'});
  assert.deepEqual(popupLabel('https://opener.example','about:blank'),{warning:'',origin:'https://opener.example'},'opener-written about:blank keeps the opener origin');
  assert.deepEqual(popupLabel('null','about:blank'),{warning:'',origin:'about:blank'});assert.deepEqual(popupLabel('null',''),{warning:'',origin:'about:blank'});
  assert.equal(popupLabel('null','about:srcdoc#accounts.google.com').origin,'about:srcdoc');
  assert.equal(popupLabel('null','data:text/html,<title>accounts.google.com</title>').origin,'data:');
  assert.equal(popupLabel('null','blob:null/6b0a8c1e-1f0d-4c55-9d7e-2a1b3c4d5e6f').origin,'blob:');
  assert.deepEqual(popupLabel('null','http://sandboxed.example/accounts.google.com'),{warning:'주의 요함 · ',origin:'http://sandboxed.example'});
  assert.match(popupStripHtml,/content="default-src 'none'; style-src 'unsafe-inline'"/);assert.doesNotMatch(popupStripHtml,/<script|https?:/);
});
