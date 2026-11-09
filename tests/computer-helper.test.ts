import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn,execFile,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {promisify} from 'node:util';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {once} from 'node:events';

const root=fileURLToPath(new URL('../',import.meta.url)),binary=path.join(root,'build/helpers/heisen-computer');
const exec=promisify(execFile);
const available=process.platform==='darwin'&&await fs.access(binary).then(()=>true,()=>false);
type Reply={id:number|null;ok:boolean;result?:any;error?:string};
function launch(){
 const child=spawn(binary,[],{stdio:['pipe','pipe','pipe'],timeout:170000}),lines=createInterface({input:child.stdout});
 const pending=new Map<number|null,{resolve:(v:Reply)=>void;reject:(e:Error)=>void}>();
 let id=0,stderr='';
 child.stderr.on('data',data=>{stderr+=data;});
 const {promise:exited,resolve:resolveExit}=Promise.withResolvers<{code:number|null;signal:NodeJS.Signals|null}>();
 child.once('exit',(code,signal)=>{
  for(const p of pending.values())p.reject(new Error(`helper exited ${code}/${signal}: ${stderr}`));
  pending.clear();resolveExit({code,signal});
 });
 lines.on('line',line=>{
  let message:Reply;
  try{message=JSON.parse(line);}catch{for(const p of pending.values())p.reject(new Error(`Non-JSON stdout: ${line}`));return;}
  const p=pending.get(message.id);if(!p)return;
  pending.delete(message.id);p.resolve(message);
 });
 function send(value:Record<string,unknown>|string):Promise<Reply>{
  const request=typeof value==='string'?value:JSON.stringify({id:++id,...value}),key=typeof value==='string'?null:id;
  const {promise,resolve,reject}=Promise.withResolvers<Reply>();
  pending.set(key,{resolve,reject});child.stdin.write(request+'\n');
  return promise;
 }
 return {child,send,exited,async close(){
  if(child.exitCode!==null||child.signalCode!==null)return;
  child.kill('SIGKILL');await exited;lines.close();
 }};
}
function success(reply:Reply){assert.equal(reply.ok,true,reply.error||'Expected successful helper response');return reply.result;}
function failure(reply:Reply,code:string){assert.equal(reply.ok,false);assert.match(reply.error||'',new RegExp(`^${code}:`));assert.match(reply.error||'',/[가-힣]/);}

// Compiled from the production source: no test-only commands exist in the shipped helper.
const policyAndFixture=String.raw`
if CommandLine.arguments.contains("--policy") {
    precondition(secureField(role: "AXSecureTextField", subrole: "", secureInput: false))
    precondition(secureField(role: "AXTextField", subrole: "AXSecureTextField", secureInput: false))
    precondition(secureField(role: "AXTextField", subrole: "", secureInput: true))
    precondition(!secureField(role: "AXTextField", subrole: "", secureInput: false))
    for key in ["enter", "tab", "escape"] { precondition(permitsSecureKey([key])) }
    for keys in [["a"], ["cmd", "a"], ["shift", "tab"], ["enter", "tab"], []] { precondition(!permitsSecureKey(keys)) }
    for request: [String: Any] in [[:], ["apps": []], ["apps": "com.apple.TextEdit"]] {
        do { _ = try allowList(request); fatalError("missing allow-list accepted") }
        catch let error as HelperError { precondition(error.message.hasPrefix("not_allowed:")) }
    }
    precondition(try! allowList(["apps": ["test.fixture", "test.fixture"]]) == Set(["test.fixture"]))
    for permission in ["화면 기록", "손쉬운 사용"] {
        do { try requirePermission(false, permission); fatalError("missing permission accepted") }
        catch let error as HelperError { precondition(error.message == "permission_denied: 시스템 설정에서 \(permission)을 허용하세요.") }
        try! requirePermission(true, permission)
    }
    print("policy passed")
    exit(0)
}
let fixture = NSApplication.shared
fixture.setActivationPolicy(.regular)
let window = NSWindow(contentRect: NSRect(x: 100, y: 100, width: 320, height: 120), styleMask: [.titled], backing: .buffered, defer: false)
window.title = "Heisen isolated helper test"
let secure = NSSecureTextField(frame: NSRect(x: 20, y: 45, width: 280, height: 24))
secure.stringValue = "fixture-secret-never-return"
window.contentView?.addSubview(secure)
// Install observers before launching: ordering a window can itself activate the app.
// Activation is only requested after AppKit finishes launching, not before run().
var launched = false
var reported = false
let ready = NotificationCenter.default.addObserver(forName: NSApplication.didBecomeActiveNotification, object: fixture, queue: .main) { _ in
    window.makeKeyAndOrderFront(nil)
    window.makeFirstResponder(secure)
}
let started = NotificationCenter.default.addObserver(forName: NSApplication.didFinishLaunchingNotification, object: fixture, queue: .main) { _ in
    launched = true
    window.makeKeyAndOrderFront(nil)
    window.makeFirstResponder(secure)
    fixture.activate(ignoringOtherApps: true)
    emit(["fixture": "launched"])
}
let deadline = Date().addingTimeInterval(5)
let readiness = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { timer in
    guard launched, !reported else { return }
    let editor = secure.currentEditor()
    let focused = fixture.isActive && window.isKeyWindow && editor != nil && editor === window.firstResponder
    guard focused || Date() >= deadline else { return }
    reported = true
    timer.invalidate()
    emit(["fixture": focused ? "ready" : "unavailable",
          "active": fixture.isActive, "keyWindow": window.isKeyWindow,
          "frontmost": NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? ""])
}
fixture.run()
`;

test('macOS computer helper: JSON-lines, scope enforcement, TCC and secure fields',{skip:!available,timeout:180000,concurrency:false},async t=>{
 const helper=launch();t.after(()=>helper.close());
 const permissions=success(await helper.send({op:'permissions'}));
 assert.equal(typeof permissions.screen,'boolean');assert.equal(typeof permissions.accessibility,'boolean');
 t.diagnostic(`TCC screen=${permissions.screen}, accessibility=${permissions.accessibility}; no permission prompt or settings change requested.`);
 const apps=success(await helper.send({op:'apps'}));assert.ok(Array.isArray(apps));
 for(const app of apps){assert.equal(typeof app.id,'string');assert.equal(typeof app.name,'string');assert.equal(typeof app.pid,'number');assert.equal(typeof app.active,'boolean');}
 const focused=success(await helper.send({op:'focused'}));
 assert.equal(typeof focused.app.id,'string');assert.equal(typeof focused.element.role,'string');assert.equal(typeof focused.element.secure,'boolean');
 await t.test('malformed messages return errors and do not terminate the protocol',async()=>{
  failure(await helper.send('{broken'),'invalid_request');
  failure(await helper.send('[]'),'invalid_request');
  failure(await helper.send('{"id":true,"op":"permissions"}'),'invalid_request');
  failure(await helper.send({op:'shell',command:'echo forbidden'}),'unknown_op');
  assert.deepEqual(success(await helper.send({op:'permissions'})),permissions);
  failure(await helper.send({op:'request_permission',kind:'unknown'}),'invalid_params');
 });
 await t.test('all scoped operations deny absent, empty or disallowed app lists before acting',async()=>{
  const requests=[{op:'screenshot'},{op:'ui_tree',app:focused.app.id},{op:'activate',app:focused.app.id},
   {op:'click',x:0,y:0},{op:'scroll',x:0,y:0,dy:1},{op:'type',text:'must-not-type'},{op:'key',keys:['a']}];
  for(const request of requests){
   failure(await helper.send(request),'not_allowed');
   failure(await helper.send({...request,apps:[]}),'not_allowed');
   if(request.op!=='screenshot')failure(await helper.send({...request,apps:['invalid.heisen.nonexistent']}),'not_allowed');
  }
  failure(await helper.send({op:'screenshot',apps:['invalid.heisen.nonexistent']}),permissions.screen?'no_windows':'permission_denied');
 });
 await t.test('missing accessibility permission is an explicit Korean error',{skip:permissions.accessibility},async()=>{
  for(const request of [{op:'ui_tree',app:focused.app.id},{op:'type',text:'must-not-type'},{op:'key',keys:['a']},{op:'click',x:0,y:0},{op:'scroll',x:0,y:0,dy:1}]){
   failure(await helper.send({...request,apps:apps.map((app:any)=>app.id)}),'permission_denied');
  }
 });
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'heisen-helper-test-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const source=path.join(dir,'main.swift'),bundle=path.join(dir,'HeisenHelperFixture.app'),macos=path.join(bundle,'Contents/MacOS');
 await fs.mkdir(macos,{recursive:true});
 await fs.writeFile(source,(await fs.readFile(path.join(root,'helpers/computer/macos/main.swift'),'utf8'))+'\n'+policyAndFixture);
 const fixtureBinary=path.join(macos,'fixture');
 await exec('swiftc',['-D','COMPUTER_HELPER_POLICY_TEST',source,'-o',fixtureBinary],{timeout:90000,maxBuffer:4*1024*1024});
 await t.test('production secure-field policy covers AX role, subrole and system secure input',async()=>{
  const result=await exec(fixtureBinary,['--policy'],{timeout:10000});assert.equal(result.stdout.trim(),'policy passed');
 });
 await t.test('isolated secure fixture: bounded AX tree, rejected input, allowed-window screenshot',{skip:!permissions.accessibility&&'Accessibility permission is required for the interactive fixture.',timeout:45000,concurrency:false},async t=>{
  const fixtureId='io.heisen.helper-test.'+process.pid;
  await fs.writeFile(path.join(bundle,'Contents/Info.plist'),`<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>${fixtureId}</string><key>CFBundleExecutable</key><string>fixture</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>`);
  const fixture:ChildProcessWithoutNullStreams=spawn(fixtureBinary,[],{stdio:['pipe','pipe','pipe'],timeout:40000});
  let fixtureStderr='';
  fixture.stderr.on('data',data=>{fixtureStderr+=data;});
  const fixtureLines=createInterface({input:fixture.stdout});
  const fixtureExit=once(fixture,'exit');
  t.after(async()=>{fixtureLines.close();if(fixture.exitCode===null&&fixture.signalCode===null){fixture.kill('SIGTERM');await fixtureExit;}});
  const state=await new Promise<{fixture:string;active:boolean;keyWindow:boolean;frontmost:string}>((resolve,reject)=>{
   // AppKit runs in another process: readiness uses its real events; this only bounds a hung launch.
   const timer=setTimeout(()=>finish(new Error(`Fixture did not report AppKit readiness: ${fixtureStderr}`)),10000);
   const finish=(error:Error|null,value?:any)=>{clearTimeout(timer);fixtureLines.off('line',onLine);fixture.off('error',onError);fixture.off('exit',onExit);if(error)reject(error);else resolve(value);};
   const onError=(error:Error)=>finish(error);
   const onExit=(code:number|null,signal:NodeJS.Signals|null)=>finish(new Error(`Fixture exited before reporting readiness (${code}/${signal}): ${fixtureStderr}`));
   const onLine=(line:string)=>{
    try{
     const value=JSON.parse(line);
     t.diagnostic(`Fixture: ${line}`);
     if(value.fixture==='ready'||value.fixture==='unavailable')finish(null,value);
    }catch{finish(new Error(`Invalid fixture readiness message: ${line}`));}
   };
   fixtureLines.on('line',onLine);fixture.once('error',onError);fixture.once('exit',onExit);
  });
  if(state.fixture==='unavailable'){
   t.skip(`Interactive session could not activate the secure fixture (frontmost=${state.frontmost}, active=${state.active}, keyWindow=${state.keyWindow}); no input sent.`);
   return;
  }
  const ownFocus=success(await helper.send({op:'focused'}));
  if(ownFocus.app.id!==fixtureId||!ownFocus.element.secure){t.skip('Dedicated fixture could not acquire secure focus; no input sent.');return;}
  const args={apps:[fixtureId]},tree=success(await helper.send({op:'ui_tree',app:fixtureId,...args}));
  assert.ok(tree.nodes.length>=1);assert.equal(tree.app.id,fixtureId);
  assert.ok(!JSON.stringify(tree).includes('fixture-secret-never-return'));
  const shallow=success(await helper.send({op:'ui_tree',app:fixtureId,depth:0,maxNodes:1,...args}));
  assert.equal(shallow.nodes.length,1);assert.deepEqual(shallow.nodes[0].children,[]);
  // File-local serial execution cannot prevent another test process/app taking focus.
  // The helper's allow-list still refuses input in that case; never send to that app.
  for(const request of [{op:'type',text:'must-not-type'},{op:'key',keys:['a']},{op:'key',keys:['cmd','a']}]){
   const reply=await helper.send({...request,...args});
   if(!reply.ok&&reply.error?.startsWith('not_allowed:')){
    failure(reply,'not_allowed');
    t.skip('Interactive fixture lost foreground focus to another app; allow-list refused input.');
    return;
   }
   failure(reply,'secure_field');
  }
  if(permissions.screen){
   const image=success(await helper.send({op:'screenshot',maxWidth:640,...args}));
   assert.ok(image.width>0&&image.width<=640);assert.ok(image.height>0&&image.scale>0&&image.scale<=1);
   assert.equal(typeof image.origin.x,'number');assert.equal(typeof image.origin.y,'number');
   assert.equal(Buffer.from(image.png,'base64').subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  }else failure(await helper.send({op:'screenshot',...args}),'permission_denied');
 });
 await t.test('quit acknowledges its id before clean exit',async()=>{
  assert.deepEqual(success(await helper.send({op:'quit'})),{ok:true});
  assert.deepEqual(await helper.exited,{code:0,signal:null});
 });
});
