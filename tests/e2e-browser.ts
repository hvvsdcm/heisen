import {_electron as electron,type ElectronApplication,type Page} from 'playwright';
import {expect} from 'playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {setTimeout as sleep} from 'node:timers/promises';
import {execFileSync} from 'node:child_process';
import {readLibrary} from './lib.ts';
// T2: Chrome-like browsing — menu table and actions, background tabs, popups, context menu, find, zoom and pinch, swipe, request identity,
// site permissions, sidebar layout. navigator.webdriver and the bare UA check run in tests/e2e-agent.ts (plain launch without automation switches).
type PublicTab={id:number;url:string;title:string;zoom:number;sleeping:boolean;pinned:boolean;incognito?:boolean;taskId?:string;openerId?:number;error?:string;find?:{text:string;active:number;matches:number}};
type PermissionRequest={id:string;tabId:number;origin:string;kinds:string[]};
type State={active:number;route:string;tabs:PublicTab[];tasks:{id:string;status:string}[];settings:{bookmarkBar:boolean;sidebarCollapsed?:boolean};permissionRequests:PermissionRequest[];sitePermissions:Record<string,Record<string,'allow'|'block'>>};
type Heisen={heisen:{call(method:string,args:unknown):Promise<unknown>}};
type Point={x:number;y:number};
type Bounds={x:number;y:number;width:number;height:number;content:number[]};
type Modifiers=NonNullable<Electron.MouseInputEvent['modifiers']>;
// Kept on the main-process global between app.evaluate calls (each call is serialised on its own).
type Hooks={win():Electron.BrowserWindow;view():Electron.WebContentsView;overlay():Electron.WebContentsView|undefined;menus:{labels:string[];menu:Electron.Menu}[]};
type G={__t:Hooks};
// Stubbed external-app prompt and shell.openExternal (section 20).
type Ext={__ext:{boxes:Electron.MessageBoxOptions[];opened:string[];check:boolean}};
const root=path.resolve('.');const profile=path.join(root,'.test-browser');await fs.rm(profile,{recursive:true,force:true});await fs.mkdir(profile,{recursive:true});await fs.writeFile(path.join(profile,'library.json'),JSON.stringify({settings:{importOffered:true,onboarded:true}}));
// C1b menu table: id → accelerator (undefined = none).
const MENU:Record<string,string|undefined>={about:undefined,settings:'CmdOrCtrl+,',services:undefined,hide:'Cmd+H','hide-others':'Alt+Cmd+H',unhide:undefined,quit:'Cmd+Q',
 'new-tab':'CmdOrCtrl+T','new-window':'CmdOrCtrl+N','new-chat':'CmdOrCtrl+Shift+E','reopen-tab':'CmdOrCtrl+Shift+T','open-location':'CmdOrCtrl+L','close-window':'CmdOrCtrl+Shift+W','close-tab':'CmdOrCtrl+W','save-page':'CmdOrCtrl+S',print:'CmdOrCtrl+P',
 'new-incognito-tab':'CmdOrCtrl+Shift+N',
 undo:'CmdOrCtrl+Z',redo:'CmdOrCtrl+Shift+Z',cut:'CmdOrCtrl+X',copy:'CmdOrCtrl+C',paste:'CmdOrCtrl+V','paste-match':'CmdOrCtrl+Alt+Shift+V',delete:undefined,'select-all':'CmdOrCtrl+A',find:'CmdOrCtrl+F','find-next':'CmdOrCtrl+G','find-prev':'CmdOrCtrl+Shift+G','copy-url':'CmdOrCtrl+Shift+C',
 'toggle-sidebar':'Ctrl+Cmd+S','toggle-bookmark-bar':'CmdOrCtrl+Shift+B','toggle-panel':'CmdOrCtrl+E',reload:'CmdOrCtrl+R','hard-reload':'CmdOrCtrl+Shift+R',fullscreen:'Ctrl+Cmd+F','zoom-reset':'CmdOrCtrl+0','zoom-in':'CmdOrCtrl+Plus','zoom-out':'CmdOrCtrl+-','zoom-in-equal':'CmdOrCtrl+=',devtools:'Alt+CmdOrCtrl+I',
 home:'CmdOrCtrl+Shift+H',back:'CmdOrCtrl+[',forward:'CmdOrCtrl+]',history:'CmdOrCtrl+Y','clear-history':'CmdOrCtrl+Shift+Backspace',bookmarks:'Alt+CmdOrCtrl+B','bookmark-tab':'CmdOrCtrl+D',import:undefined,
 'next-tab':'Ctrl+Tab','prev-tab':'Ctrl+Shift+Tab','next-tab-alt':'Alt+CmdOrCtrl+Right','prev-tab-alt':'Alt+CmdOrCtrl+Left','next-tab-bracket':'CmdOrCtrl+Shift+]','prev-tab-bracket':'CmdOrCtrl+Shift+[','duplicate-tab':undefined,'pin-tab':undefined,'tab-search':'CmdOrCtrl+Shift+A',
 ...Object.fromEntries([1,2,3,4,5,6,7,8].map(n=>['select-tab-'+n,'CmdOrCtrl+'+n])),'select-tab-last':'CmdOrCtrl+9',minimize:'CmdOrCtrl+M','zoom-window':undefined,downloads:'CmdOrCtrl+Shift+J',passwords:undefined,front:undefined};
const HIDDEN=new Set(['zoom-in-equal','next-tab-alt','prev-tab-alt','next-tab-bracket','prev-tab-bracket','select-tab-last',...[1,2,3,4,5,6,7,8].map(n=>'select-tab-'+n)]);
const PAGE=`<title>Browser fixture</title><style>body{margin:0;font:16px sans-serif}#link,#img,#text,#edit{position:absolute;left:40px;margin:0}#link{top:40px}#img{top:90px;width:80px;height:60px}#text{top:180px}#edit{top:230px}#blank{position:absolute;left:0;top:300px;width:100%;height:400px}</style><a id="link" href="/next">Next page</a><img id="img" src="/img.png" alt="Fixture image"><p id="text">Fixture words</p><input id="edit" aria-label="Edit"><div id="blank"></div>`;
const PAGES:Record<string,string>={'/page':PAGE,'/next':'<title>Second page</title><h1>Second page</h1>','/find':'<title>Find fixture</title><p>apple apple apple</p>','/perm':'<title>Permission fixture</title><p>Permissions</p>','/popup':'<title>Popup fixture</title><p>Popup</p>'};
PAGES['/self-close-opener']='<title>Self-close opener</title><button id="open" onclick="window.open(\'/self-closing\')">Open self-closing tab</button>';
PAGES['/self-closing']='<title>Self-closing tab</title><script>addEventListener("load",()=>window.close())</script>';
PAGES['/multi-login']='<title>Second window login</title><form onsubmit="event.preventDefault()"><input name="username" autocomplete="username"><input name="password" type="password" autocomplete="current-password"><button>Sign in</button></form>';
PAGES['/fake-login']='<title>accounts.google.com</title><h1>accounts.google.com</h1><form onsubmit="event.preventDefault()"><input name="email"><input name="password" type="password"><button>Sign in</button></form>';
const image=await fs.readFile(path.join(root,'assets/heisen.png'));
const headers:Record<string,http.IncomingHttpHeaders>={};let stage=0;
const handler:http.RequestListener=async(req,res)=>{
 const route=(req.url||'').split('?')[0];headers[route]=req.headers;
 if(route==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'heisen-test-model',name:'Local test model'}]}));return;}
 if(route==='/v1/chat/completions'){
  for await(const _ of req);
  // Local mock model: open a task-owned tab on the permission fixture, then finish with one artifact.
  const steps:[string,object][]=[['web_open',{url:base+'/perm?task=1'}],['file_write',{path:'result.md',content:'# Permission fixture'}],['task_finish',{summary:'Opened the permission fixture.',artifactPaths:['result.md'],sourceIds:[]}]];
  const [name,args]=steps[Math.min(stage++,steps.length-1)];
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'test',object:'chat.completion',created:Date.now(),model:'heisen-test-model',choices:[{index:0,message:{role:'assistant',content:null,tool_calls:[{id:'c'+stage,type:'function',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}));return;
 }
 if(route==='/img.png'){res.setHeader('Content-Type','image/png');res.end(image);return;}
 if(route==='/download'){res.setHeader('Content-Type','text/plain');res.setHeader('Content-Disposition','attachment; filename="heisen-test.txt"');res.end('heisen download');return;}
 if(route==='/incognito-set'){res.setHeader('Set-Cookie','incognitoFixture=private; Path=/; SameSite=Lax');res.setHeader('Content-Type','text/html');res.end('<title>Incognito fixture</title><a id="private-child" target="_blank" href="/incognito-child">Private child</a>');return;}
 res.setHeader('Content-Type','text/html');res.end(PAGES[route]??PAGE);
};
// Two ports = two origins on one host: permissions are per origin, page zoom is per host:port.
const server=http.createServer(handler),server2=http.createServer(handler);
const listen=async(s:http.Server)=>{s.listen(0,'127.0.0.1');await once(s,'listening');const a=s.address();assert.ok(a&&typeof a==='object');return 'http://127.0.0.1:'+a.port;};
const base=await listen(server),base2=await listen(server2);
const env:Record<string,string>={...process.env as Record<string,string>,HEISEN_TEST_BACKGROUND:process.env.HEISEN_TEST_VISIBLE==='1'?'0':'1',HEISEN_DATA_DIR:profile,HEISEN_BETA_URL:'skip'};delete env.ELECTRON_RUN_AS_NODE;
// colorScheme null: Playwright otherwise emulates prefers-color-scheme: light in every page; the user sees the OS appearance.
const launchOptions=process.env.HEISEN_EXECUTABLE?{executablePath:path.resolve(process.env.HEISEN_EXECUTABLE),args:[],env,timeout:45000,colorScheme:null}:{args:[root],env,timeout:45000,colorScheme:null};
const errors:string[]=[];let app!:ElectronApplication,page!:Page;
async function launch(){
 app=await electron.launch(launchOptions);page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));app.process().stderr?.on('data',b=>{if(/Error|ERR_/.test(b.toString()))process.stderr.write(b);});
 await page.getByRole('textbox',{name:'주소창'}).waitFor();
 // tsx compiles with keepNames, so serialised callbacks that declare local functions call esbuild's __name helper.
 await app.evaluate('globalThis.__name=(fn)=>fn');
 // Context menus are recorded instead of shown (a native menu blocks until dismissed).
 await app.evaluate(({BrowserWindow,WebContentsView,Menu})=>{
  const win=()=>{const w=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('file:'));if(!w)throw new Error('No main window');return w;};
  const views=()=>win().contentView.children.filter((v):v is Electron.WebContentsView=>v instanceof WebContentsView);
  const view=()=>{const v=views().find(v=>v.getVisible()&&/^https?:/.test(v.webContents.getURL()));if(!v)throw new Error('No visible page view');return v;};
  const overlay=()=>views().find(v=>v.webContents.getURL().startsWith('data:text/html'));
  const menus:Hooks['menus']=[];Menu.prototype.popup=function(this:Electron.Menu){menus.push({labels:this.items.map(i=>i.label).filter(Boolean),menu:this});};
  (globalThis as unknown as G).__t={win,view,overlay,menus};
 });
}
const rpc=<T=unknown>(m:string,a:object={})=>page.evaluate(([m,a])=>{const ui=window as unknown as Heisen;return ui.heisen.call(m,a);},[m,a] as const) as Promise<T>;
const state=()=>rpc<State>('state');
const activeTab=async()=>{const s=await state();const t=s.tabs.find(t=>t.id===s.active);assert.ok(t,'no active tab');return t;};
const urls=async()=>(await state()).tabs.map(t=>t.url);
const menuClick=(id:string)=>app.evaluate(({Menu},id)=>{const item=Menu.getApplicationMenu()?.getMenuItemById(id);if(!item)throw new Error('No menu item '+id);item.click();},id);
// Main-world script in the visible page view of the active tab.
const inActive=<T=unknown>(code:string,gesture=false)=>app.evaluate((_e,[code,gesture])=>(globalThis as unknown as G).__t.view().webContents.executeJavaScript(code,gesture),[code,gesture] as const) as Promise<T>;
const inUrl=<T=unknown>(url:string,code:string,gesture=false)=>app.evaluate(({webContents},[url,code,gesture])=>{const wc=webContents.getAllWebContents().find(w=>w.getURL()===url);if(!wc)throw new Error('No contents at '+url);return wc.executeJavaScript(code,gesture);},[url,code,gesture] as const) as Promise<T>;
const center=(selector:string)=>inActive<Point>(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
const mouse=(p:Point,button:'left'|'middle'|'right',modifiers:Modifiers=[])=>app.evaluate((_e,[p,button,modifiers])=>{const wc=(globalThis as unknown as G).__t.view().webContents;wc.sendInputEvent({type:'mouseMove',x:p.x,y:p.y});for(const type of ['mouseDown','mouseUp'] as const)wc.sendInputEvent({type,x:p.x,y:p.y,button,clickCount:1,modifiers});},[p,button,modifiers] as const);
const menuCount=()=>app.evaluate(()=>(globalThis as unknown as G).__t.menus.length);
async function contextLabels(p:Point){const before=await menuCount();await mouse(p,'right');await expect.poll(menuCount).toBe(before+1);return app.evaluate(()=>(globalThis as unknown as G).__t.menus.at(-1)!.labels);}
const bounds=()=>app.evaluate(()=>{const h=(globalThis as unknown as G).__t;return {...h.view().getBounds(),content:h.win().getContentSize()};}) as Promise<Bounds>;
// Popups are BaseWindow containers holding [origin strip, page] views (src/browser.ts openPopup), not BrowserWindows; `at` picks by creation order.
const windowCount=()=>app.evaluate(({BaseWindow})=>BaseWindow.getAllWindows().length);
const popupEval=<T=unknown>(code:string,at=-1,gesture=false)=>app.evaluate(({BaseWindow,BrowserWindow,WebContentsView},[code,at,gesture])=>{const w=BaseWindow.getAllWindows().filter(w=>!(w instanceof BrowserWindow)).sort((a,b)=>a.id-b.id).at(at);const page=w?.contentView.children.filter((v):v is Electron.WebContentsView=>v instanceof WebContentsView)[1];if(!page)throw new Error('No popup window');return page.webContents.executeJavaScript(code,gesture);},[code,at,gesture] as const) as Promise<T>;
type PopupInfo={id:number;title:string;strip:string;stripBounds:Electron.Rectangle;pageBounds:Electron.Rectangle;content:number[];innerHeight:number;url:string;dialogParent:number|undefined};
const popupInfo=()=>app.evaluate(({BaseWindow,BrowserWindow,WebContentsView})=>Promise.all(BaseWindow.getAllWindows().filter(w=>!(w instanceof BrowserWindow)).sort((a,b)=>a.id-b.id).map(async w=>{
 const [strip,page]=w.contentView.children.filter((v):v is Electron.WebContentsView=>v instanceof WebContentsView);
 return {id:w.id,title:w.getTitle(),strip:await strip.webContents.executeJavaScript('document.body.textContent'),stripBounds:strip.getBounds(),pageBounds:page.getBounds(),content:w.getContentSize(),innerHeight:await page.webContents.executeJavaScript('innerHeight'),url:page.webContents.getURL(),dialogParent:BrowserWindow.fromWebContents(page.webContents)?.id};
}))) as Promise<PopupInfo[]>;
const closePopups=()=>app.evaluate(({BaseWindow,BrowserWindow})=>{for(const w of BaseWindow.getAllWindows())if(!(w instanceof BrowserWindow))w.close();});
// `count` precise wheel events 30 ms apart (no momentum: the gesture ends on the preload's quiet gap); returns the data-URL prefixes of the overlay whenever it was visible.
const swipe=(deltaX:number,count=6,deltaY=0)=>app.evaluate(async(_e,[deltaX,count,deltaY])=>{
 const h=(globalThis as unknown as G).__t,view=h.view(),wc=view.webContents,{width,height}=view.getBounds(),seen:string[]=[];
 const sample=()=>{const o=h.overlay();if(o?.getVisible())seen.push(o.webContents.getURL().slice(0,22));};
 for(let i=0;i<count;i++){wc.sendInputEvent({type:'mouseWheel',x:Math.round(width/2),y:Math.round(height/2),deltaX,deltaY,hasPreciseScrollingDeltas:true,canScroll:true});for(let j=0;j<3;j++){await new Promise(r=>setTimeout(r,10));sample();}}
 for(let j=0;j<6;j++){await new Promise(r=>setTimeout(r,10));sample();}
 return seen;
},[deltaX,count,deltaY] as const);
const overlayVisible=()=>app.evaluate(()=>!!(globalThis as unknown as G).__t.overlay()?.getVisible());
const pinch=(p:Point,scaleFactor:number)=>app.evaluate(async(_e,[p,scaleFactor])=>{const dbg=(globalThis as unknown as G).__t.view().webContents.debugger;dbg.attach('1.3');try{await dbg.sendCommand('Input.synthesizePinchGesture',{x:p.x,y:p.y,scaleFactor,gestureSourceType:'mouse'});}finally{dbg.detach();}},[p,scaleFactor] as const);
const requestNotification=`window.__perm=Notification.requestPermission();true`;
await launch();
const savedClipboard=await app.evaluate(({clipboard})=>clipboard.readText());
try{
 const packaged=await app.evaluate(({app})=>app.isPackaged);assert.equal(packaged,!!process.env.HEISEN_EXECUTABLE);console.log('PASS runtime identity: '+(packaged?'packaged Heisen.app':'development'));
 // 1. Menu table
 const items=await app.evaluate(({Menu},ids)=>ids.map(id=>{const i=Menu.getApplicationMenu()?.getMenuItemById(id);return i?{id,found:true,accelerator:i.accelerator??null,visible:i.visible,checked:i.checked}:{id,found:false,accelerator:null,visible:false,checked:false};}),Object.keys(MENU));
 for(const i of items){assert.ok(i.found,`menu item ${i.id} missing`);assert.equal(i.accelerator,MENU[i.id]??null,`accelerator of ${i.id}`);if(HIDDEN.has(i.id))assert.equal(i.visible,false,`${i.id} should be hidden`);}
 let s=await state();assert.equal(s.settings.bookmarkBar,true);assert.equal(items.find(i=>i.id==='toggle-bookmark-bar')!.checked,true);
 const barChecked=()=>app.evaluate(({Menu})=>Menu.getApplicationMenu()!.getMenuItemById('toggle-bookmark-bar')!.checked);
 await menuClick('toggle-bookmark-bar');assert.equal((await state()).settings.bookmarkBar,false);assert.equal(await barChecked(),false);
 await menuClick('toggle-bookmark-bar');assert.equal((await state()).settings.bookmarkBar,true);assert.equal(await barChecked(),true);
 console.log(`PASS menu table: ${items.length} ids with Chrome accelerators, ${HIDDEN.size} hidden shortcuts, toggle-bookmark-bar checked = setting`);
 // 2. Request identity (UA string and languages; navigator.webdriver is checked without automation switches in e2e-agent.ts)
 await rpc('tab.navigate',{url:base+'/page'});const A=(await activeTab()).id;
 const chromeMajor=(await app.evaluate(()=>process.versions.chrome)).split('.')[0];const ua=String(headers['/page']['user-agent']);
 assert.equal(ua,`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeMajor}.0.0.0 Safari/537.36`);
 const first=(await app.evaluate(({app})=>app.getPreferredSystemLanguages()))[0]?.replace(/_/g,'-')||'ko-KR';const lang=first.split('-')[0].toLowerCase();
 const acceptLanguage=String(headers['/page']['accept-language']);assert.ok(acceptLanguage.startsWith(lang===first?first:`${first},${lang};q=0.9`),`accept-language ${acceptLanguage} for system ${first}`);
 const nav=await inActive<{brands:{brand:string;version:string}[];languages:string[]}>('({brands:navigator.userAgentData.brands,languages:navigator.languages})');
 assert.ok(nav.brands.some(b=>b.brand==='Chromium'&&b.version===chromeMajor),JSON.stringify(nav.brands));
 console.log(`PASS identity: Chrome ${chromeMajor} reduced UA, accept-language "${acceptLanguage}", brands ${nav.brands.map(b=>b.brand+' '+b.version).join(', ')}`);
 console.log(`LOG sec-ch-ua header: ${headers['/page']['sec-ch-ua']??'(absent)'}; navigator.languages ${JSON.stringify(nav.languages)}`);
 // Page canvas and color scheme as in Chrome: a page without a background paints white, and prefers-color-scheme follows the OS appearance (launchOptions turn off Playwright's colour-scheme emulation).
 await expect.poll(()=>app.evaluate(async()=>{const b=(await (globalThis as unknown as G).__t.view().webContents.capturePage({x:600,y:500,width:1,height:1})).toBitmap();return [b[2],b[1],b[0]];})).toEqual([255,255,255]);
 const osDark=await app.evaluate(({nativeTheme})=>nativeTheme.shouldUseDarkColors);assert.equal(await inActive(`matchMedia('(prefers-color-scheme: dark)').matches`),osDark);
 console.log(`PASS page canvas: unstyled body pixel white, prefers-color-scheme dark = ${osDark} (OS)`);
 // 3. Tab menu actions
 await rpc('tab.new',{url:base+'/next'});await rpc('tab.new',{url:base+'/find'});s=await state();const [B,C]=s.tabs.slice(1).map(t=>t.id);assert.deepEqual(await urls(),[base+'/page',base+'/next',base+'/find']);assert.equal(s.active,C);
 const activeIs=async(id:number)=>{await expect.poll(async()=>(await state()).active).toBe(id);};
 await menuClick('select-tab-1');await activeIs(A);await menuClick('select-tab-last');await activeIs(C);
 await menuClick('next-tab');await activeIs(A);await menuClick('prev-tab');await activeIs(C);await menuClick('prev-tab');await activeIs(B);await menuClick('next-tab');await activeIs(C);
 await menuClick('copy-url');assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),base+'/find');
 await menuClick('close-tab');await expect.poll(urls).toEqual([base+'/page',base+'/next']);await activeIs(B);
 await menuClick('reopen-tab');await expect.poll(urls).toEqual([base+'/page',base+'/next',base+'/find']);s=await state();const D=s.tabs[2].id;assert.equal(s.active,D);await expect.poll(async()=>(await activeTab()).title).toBe('Find fixture');
 await menuClick('duplicate-tab');await expect.poll(urls).toEqual([base+'/page',base+'/next',base+'/find',base+'/find']);s=await state();const dup=s.tabs[3].id;assert.equal(s.active,dup);
 await rpc('tab.close',{id:dup});await activeIs(D);
 console.log('PASS menu actions: select-tab-1/last, next/prev cycle with wrap, copy-url, close-tab → reopen-tab at the same index, duplicate-tab');
 // 4. Find in page
 await rpc('find.start',{text:'apple'});await expect.poll(async()=>(await activeTab()).find).toEqual({text:'apple',active:1,matches:3});
 await rpc('find.next',{forward:true});await expect.poll(async()=>(await activeTab()).find?.active).toBe(2);
 await menuClick('find-next');await expect.poll(async()=>(await activeTab()).find?.active).toBe(3);
 await menuClick('find-prev');await expect.poll(async()=>(await activeTab()).find?.active).toBe(2);
 await rpc('find.stop');await expect.poll(async()=>(await activeTab()).find).toBeUndefined();
 // find.stop keeps the selection on the active match and a new session continues after it (observed: restart reports 3/3); start the UI check from the top.
 await inActive('getSelection().removeAllRanges()');
 let findInput=page.getByRole('textbox',{name:'페이지에서 찾기'});
 // Observed: the UI state can trail the RPC calls above (a refresh after reopening closed the bar when the active tab id changed); let it catch up first.
 let rows=page.locator('.tab-strip .tab-row');await expect(rows).toHaveCount(3);await expect(rows.nth(2)).toHaveClass(/selected/);
 await menuClick('find');await expect(findInput).toBeFocused();await expect(page.locator('.find-count')).toHaveText('0/0');await findInput.fill('apple');await expect(page.locator('.find-count')).toHaveText('1/3');
 await findInput.press('Enter');await expect(page.locator('.find-count')).toHaveText('2/3');
 await findInput.press('Escape');await expect(page.locator('.find-bar')).toHaveCount(0);await expect.poll(async()=>(await activeTab()).find).toBeUndefined();
 console.log('PASS find: 3 matches, next/prev via RPC and menu, stop; menu find focuses the find bar, typing → 1/3, Enter → 2/3, Esc closes');
 // 5. ⌘-click / middle-click → background tab right after the opener
 await rpc('tab.select',{id:A});await activeIs(A);const link=await center('#link');
 await mouse(link,'left',['meta']);await expect.poll(async()=>(await state()).tabs.length).toBe(4);
 s=await state();assert.equal(s.active,A);let child=s.tabs[1];assert.equal(child.url,base+'/next');assert.equal(child.sleeping,true);assert.equal(child.openerId,A);
 await mouse(link,'middle');await expect.poll(async()=>(await state()).tabs.length).toBe(5);
 s=await state();assert.equal(s.active,A);child=s.tabs[2];assert.equal(child.url,base+'/next');assert.equal(child.sleeping,true);assert.equal(child.openerId,A);assert.equal(s.tabs[3].id,B);
 console.log('PASS ⌘-click and middle-click: background tabs after the opener (and its earlier children), active tab unchanged, not loaded');
 // 6. Context menu items
 const linkMenu=await contextLabels(link);for(const l of ['새 탭에서 링크 열기','링크 주소 복사','다른 이름으로 링크 저장…','검사'])assert.ok(linkMenu.includes(l),`link menu lacks ${l}: ${linkMenu}`);assert.ok(!linkMenu.includes('뒤로'));
 await app.evaluate(()=>{const m=(globalThis as unknown as G).__t.menus.at(-1)!.menu;m.items.find(i=>i.label==='새 탭에서 링크 열기')!.click();});
 await expect.poll(async()=>(await state()).tabs.length).toBe(6);s=await state();assert.equal(s.active,A);assert.equal(s.tabs[3].url,base+'/next');assert.equal(s.tabs[3].openerId,A);
 const imageMenu=await contextLabels(await center('#img'));for(const l of ['새 탭에서 이미지 열기','다른 이름으로 이미지 저장…','이미지 복사','이미지 주소 복사','검사'])assert.ok(imageMenu.includes(l),`image menu lacks ${l}: ${imageMenu}`);
 await inActive(`(()=>{const r=document.createRange();r.selectNodeContents(document.getElementById('text'));getSelection().removeAllRanges();getSelection().addRange(r);})()`);
 const selectionMenu=await contextLabels(await center('#text'));assert.deepEqual(selectionMenu,['복사','Google에서 "Fixture words" 검색','검사']);
 const editMenu=await contextLabels(await center('#edit'));assert.deepEqual(editMenu,['실행 취소','다시 실행','잘라내기','복사','붙여넣기','붙여넣고 스타일 일치','모두 선택','검사']);
 await inActive(`getSelection().removeAllRanges();document.activeElement?.blur();`);
 const pageMenu=await contextLabels(await center('#blank'));assert.deepEqual(pageMenu,['뒤로','앞으로','새로고침','인쇄…','검사']);
 for(const t of (await state()).tabs.slice(1,4))await rpc('tab.close',{id:t.id});await expect.poll(urls).toEqual([base+'/page',base+'/next',base+'/find']);await activeIs(A);
 console.log('PASS context menu: link (open in background tab works), image, selection, editable and page items, 검사 last');
 // 7. Popups keep window.opener and show a page-unspoofable origin strip (Chrome's read-only popup location bar)
 assert.equal(await windowCount(),1);
 await inActive(`window.__popup=window.open('/popup','login','width=500,height=600');true`,true);await expect.poll(windowCount).toBe(2);
 await expect.poll(()=>popupEval<string>('location.href')).toBe(base+'/popup');assert.equal(await popupEval('!!window.opener'),true);assert.equal(await inActive('window.__popup.closed'),false);
 assert.equal((await state()).tabs.length,3);await closePopups();await expect.poll(windowCount).toBe(1);
 // A page titled like a sign-in domain: the strip and OS title show the real origin (http → 주의 요함), the page view starts below the strip.
 const warned='주의 요함 · '+base;
 await inActive(`window.__phish=window.open('/fake-login','phish','width=480,height=560');true`,true);await expect.poll(windowCount).toBe(2);
 await expect.poll(async()=>(await popupInfo())[0]?.strip).toBe(warned);await expect.poll(()=>popupEval<string>('document.title')).toBe('accounts.google.com');
 const [phish]=await popupInfo();assert.equal(phish.title,base,'OS title is the origin, not the page title');assert.equal(phish.url,base+'/fake-login');
 assert.deepEqual(phish.stripBounds,{x:0,y:0,width:phish.content[0],height:28});assert.deepEqual(phish.pageBounds,{x:0,y:28,width:phish.content[0],height:phish.content[1]-28});assert.equal(phish.innerHeight,phish.content[1]-28);
 assert.equal(phish.dialogParent,phish.id,'page dialogs parent to the popup container');
 // Real captures of the two views, stacked row by row at the capture's own scale (same width): strip above page.
 const stripShot=await app.evaluate(async({BaseWindow,BrowserWindow,WebContentsView,nativeImage})=>{
  const w=BaseWindow.getAllWindows().find(w=>!(w instanceof BrowserWindow))!,views=w.contentView.children.filter((v):v is Electron.WebContentsView=>v instanceof WebContentsView);
  const shots=await Promise.all(views.map(v=>v.webContents.capturePage())),scaleFactor=Math.max(...shots[0].getScaleFactors()),width=shots[0].getSize().width;
  if(shots.some(s=>s.getSize().width!==width))throw new Error('Popup views differ in width');
  const height=shots.reduce((h,s)=>h+s.getSize().height,0);
  return nativeImage.createFromBitmap(Buffer.concat(shots.map(s=>s.toBitmap({scaleFactor}))),{width:width*scaleFactor,height:height*scaleFactor,scaleFactor}).toPNG().toString('base64');
 });
 await fs.writeFile('/tmp/heisen-popup-strip.png',Buffer.from(stripShot,'base64'));
 // Nested popups get their own strip; script close and container close both end popups.
 await popupEval(`window.__nested=window.open('/popup','nested','width=400,height=400');true`,0,true);await expect.poll(windowCount).toBe(3);
 await expect.poll(async()=>(await popupInfo())[1]?.strip).toBe(warned);assert.equal(await popupEval('!!window.opener',1),true);assert.equal((await popupInfo())[1].title,base);
 await popupEval('window.__nested.close();true',0);await expect.poll(windowCount).toBe(2);await inActive('window.__phish.close();true');await expect.poll(windowCount).toBe(1);
 // An opener-written about:blank fake login shows the opener's origin.
 await inActive(`window.__blank=window.open('','blank','width=400,height=300');window.__blank.document.title='blank popup';true`,true);await expect.poll(windowCount).toBe(2);
 assert.equal(await popupEval('!!window.opener'),true);assert.equal(await popupEval('document.title'),'blank popup');
 await inActive(`window.__blank.document.write('<title>accounts.google.com</title><h1>Google 계정 로그인</h1><input type="password">');window.__blank.document.close();true`);
 await expect.poll(()=>popupEval<string>('document.title')).toBe('accounts.google.com');const [blank]=await popupInfo();assert.equal(blank.strip,warned);assert.equal(blank.title,base);assert.equal(blank.url,'about:blank');
 assert.equal(blank.innerHeight,blank.content[1]-28);await closePopups();await expect.poll(windowCount).toBe(1);
 // Closed containers release both views' contents (strip documents contain the encoded <bdi>).
 await expect.poll(()=>app.evaluate(({webContents},page)=>webContents.getAllWebContents().filter(w=>w.getURL().includes('%3Cbdi')||w.getURL()===page||w.getURL()==='about:blank').length,base+'/fake-login')).toBe(0);
 console.log('PASS popups: window.open with features → BaseWindow with origin strip (real origin, 주의 요함 on http, OS title = origin, page 28px lower) and window.opener (also opener-written about:blank, nested); screenshot /tmp/heisen-popup-strip.png');
 // 8. Pinch zoom: visual zoom enabled with Chrome's limits 1–5
 // Input.synthesizePinchGesture rejected the viewport centre (604,428 of 1208×856) with "Position out of bounds" but accepts points near the origin.
 const corner={x:10,y:10};const scale=()=>inActive<number>('visualViewport.scale');assert.equal(await scale(),1);
 await pinch(corner,2);await expect.poll(scale).toBeGreaterThan(1.5);
 await pinch(corner,10);await expect.poll(scale).toBeGreaterThan(4.5);assert.ok(await scale()<=5.001,`scale ${await scale()} above 5`);
 await pinch(corner,0.02);await expect.poll(scale).toBeLessThan(1.001);assert.ok(await scale()>=0.999,`scale ${await scale()} below 1`);
 assert.equal((await activeTab()).zoom,1,'pinch must not change page zoom');
 console.log('PASS pinch: visual zoom 1 → 2, clamped at 5 and at 1, page zoom untouched');
 // 9. Two-finger swipe (synthesised precise wheel events) with the arrow overlay
 await rpc('tab.navigate',{url:base+'/next'});await expect.poll(async()=>(await activeTab()).url).toBe(base+'/next');
 let backDelta=120;let seen=await swipe(backDelta);
 try{await expect.poll(async()=>(await activeTab()).url,{timeout:1500}).toBe(base+'/page');}
 catch{backDelta=-120;console.log('LOG swipe: deltaX +120 did not go back; retrying with -120');seen=await swipe(backDelta);await expect.poll(async()=>(await activeTab()).url,{timeout:3000}).toBe(base+'/page');}
 assert.ok(seen.length>0,'arrow overlay never visible during the back swipe');assert.ok(seen.every(u=>u.startsWith('data:text/html')),JSON.stringify(seen));await expect.poll(overlayVisible).toBe(false);
 const seenForward=await swipe(-backDelta);await expect.poll(async()=>(await activeTab()).url,{timeout:3000}).toBe(base+'/next');assert.ok(seenForward.length>0,'arrow overlay never visible during the forward swipe');await expect.poll(overlayVisible).toBe(false);
 // Short swipe (90 px < threshold) and a mostly vertical gesture stay on the page; the pause keeps them separate gestures.
 await swipe(backDelta/4,3);await sleep(300);await swipe(backDelta/6,6,120);await sleep(400);assert.equal((await activeTab()).url,base+'/next','short or vertical gesture navigated');assert.equal(await overlayVisible(),false);
 console.log(`PASS swipe: sendInputEvent mouseWheel deltaX ${backDelta>0?'+':''}${backDelta} ×6 → back to /page, ${-backDelta>0?'+':''}${-backDelta} → forward to /next; overlay (data: URL) visible during both (${seen.length}/${seenForward.length} samples), hidden after; ±30 ×3 and (±20, 120) ×6 stay`);
 // 10. Page zoom per host
 const zoomChip=(pct:number)=>page.getByRole('button',{name:`확대/축소: ${pct}%`});
 await menuClick('zoom-in');await expect.poll(async()=>(await activeTab()).zoom).toBe(1.1);await expect(zoomChip(110)).toBeVisible();
 await menuClick('zoom-reset');await expect.poll(async()=>(await activeTab()).zoom).toBe(1);await expect(page.locator('.zoom-chip')).toHaveCount(0);
 await menuClick('zoom-in');await menuClick('zoom-in');await expect.poll(async()=>(await activeTab()).zoom).toBe(1.25);await expect(zoomChip(125)).toBeVisible();
 assert.equal((await state()).tabs.find(t=>t.id===D)!.zoom,1.25,'same-host tab follows the zoom');
 console.log('PASS page zoom: menu zoom-in → 1.1 (chip 110%), zoom-reset → 1 (chip hidden), 1.25 applied to every tab on the host');
 // 11. Site permissions
 await rpc('tab.navigate',{url:base+'/perm'});await expect.poll(async()=>(await activeTab()).title).toBe('Permission fixture');
 let infobar=page.locator('.infobar');
 await inActive(requestNotification,true);await expect.poll(async()=>(await state()).permissionRequests.map(r=>[r.origin,r.kinds,r.tabId])).toEqual([[base,['notifications'],A]]);
 await expect(infobar).toContainText('알림 표시');await infobar.getByRole('button',{name:'허용'}).click();
 assert.equal(await inActive('window.__perm'),'granted');s=await state();assert.equal(s.sitePermissions[base]?.notifications,'allow');assert.equal(s.permissionRequests.length,0);await expect(infobar).toHaveCount(0);
 assert.equal(await inActive('Notification.requestPermission()',true),'granted');assert.equal((await state()).permissionRequests.length,0);
 await rpc('tab.navigate',{url:base2+'/perm'});await expect.poll(async()=>(await activeTab()).url).toBe(base2+'/perm');
 await inActive(requestNotification,true);await expect(infobar).toContainText('알림 표시');await infobar.getByRole('button',{name:'차단'}).click();
 assert.equal(await inActive('window.__perm'),'denied');assert.equal((await state()).sitePermissions[base2]?.notifications,'block');
 assert.equal(await inActive('Notification.requestPermission()',true),'denied');assert.equal((await state()).permissionRequests.length,0);await expect(infobar).toHaveCount(0);
 if(process.env.HEISEN_TEST_VISIBLE==='1'){
 // Exit right after the request, inside the window's enter animation: the page must still leave fullscreen and exitFullscreen() must settle.
 assert.equal(await inActive(`Promise.race([document.documentElement.requestFullscreen().then(()=>'entered',e=>'error '+e.message),new Promise(r=>setTimeout(()=>r('no answer in 15 s'),15000))])`,true),'entered','requestFullscreen()');
 assert.equal(await inActive(`Promise.race([document.exitFullscreen().then(()=>'exited',e=>'error '+e.message),new Promise(r=>setTimeout(()=>r('no answer in 15 s'),15000))])`),'exited','exitFullscreen() during the window enter animation');
 assert.equal(await inActive('document.fullscreenElement'),null);
 await expect.poll(()=>app.evaluate(()=>(globalThis as unknown as G).__t.win().isFullScreen()),{timeout:10000}).toBe(false);await sleep(1000);
 console.log('PASS native fullscreen: enter and exit during the window animation');
 }else console.log('SKIP (visible-only): native fullscreen enter/exit during the window animation');
 await rpc('auth.save',{provider:'local',baseURL:base+'/v1'});await rpc('settings.save',{provider:'local',model:'heisen-test-model'});
 const {id:taskId}=await rpc<{id:string}>('task.start',{prompt:'Open the permission fixture.',urls:[base+'/perm']});
 await expect.poll(async()=>(await state()).tasks.find(t=>t.id===taskId)?.status,{timeout:45000}).toBe('completed');
 assert.ok((await state()).tabs.some(t=>t.taskId===taskId&&t.url===base+'/perm?task=1'),'task tab missing');
 assert.equal(await inUrl(base+'/perm?task=1','Notification.requestPermission()',true),'denied');assert.equal((await state()).permissionRequests.length,0);
 console.log('PASS permissions: infobar 허용 → granted and stored, 차단 → denied and stored, repeat requests answered without the bar, task tab denied without the bar');
 // 12. Sidebar toggle keeps tabs, conversations and native view bounds
 await rpc('tab.select',{id:A});await activeIs(A);
 const ids=(await state()).tabs.map(t=>t.id),taskCount=(await state()).tasks.length;assert.ok(taskCount>=1);
 const collapse=page.getByRole('button',{name:'사이드바 접기'}),expand=page.getByRole('button',{name:'사이드바 펼치기'});
 const expectLayout=async(x:number)=>{const top=Number(await page.locator('.toolbar').getAttribute('data-chrome-top'));assert.equal((await page.locator('.content').boundingBox())!.y,top);await expect.poll(async()=>{const b=await bounds();return [b.x,b.y,b.width];}).toEqual([x,top,(await bounds()).content[0]-x]);};
 for(let i=0;i<3;i++){
  await collapse.click();await expect(page.locator('.app.sidebar-collapsed')).toHaveCount(1);await expectLayout(0);
  await expand.click();await expect(page.locator('.app.sidebar-collapsed')).toHaveCount(0);await expectLayout(232);
 }
 for(const width of [900,1440]){
  await app.evaluate((_e,width)=>(globalThis as unknown as G).__t.win().setSize(width,940),width);await expect.poll(async()=>(await bounds()).content[0]).toBe(width);
  await expectLayout(232);await menuClick('toggle-sidebar');await expect(page.locator('.app.sidebar-collapsed')).toHaveCount(1);await expectLayout(0);
  await menuClick('toggle-sidebar');await expect(page.locator('.app.sidebar-collapsed')).toHaveCount(0);await expectLayout(232);
  console.log(`LOG ${width}px: page view ${JSON.stringify(await bounds())}`);
 }
 s=await state();assert.deepEqual(s.tabs.map(t=>t.id),ids);assert.equal(s.tasks.length,taskCount);
 console.log('PASS sidebar: 3× 접기/펼치기 and menu toggle at 900px and 1440px → page view x 0/232, width = window − x; tabs and conversations unchanged');
 await expect(page.locator('#app-sidebar .tab-row')).toHaveCount(0);const stripBox=(await page.locator('.tab-strip').boundingBox())!,sidebarBox=(await page.locator('#app-sidebar').boundingBox())!;assert.equal(stripBox.y,0);assert.equal(stripBox.width,1440);assert.equal(stripBox.y+stripBox.height,sidebarBox.y);
 const beforeMove=(await state()).tabs.map(t=>t.id);const firstRow=rows.nth(0),lastRow=rows.nth(2),lastBox=(await lastRow.boundingBox())!;await firstRow.dragTo(lastRow,{targetPosition:{x:lastBox.width-3,y:lastBox.height/2}});await expect.poll(async()=>(await state()).tabs.map(t=>t.id)).toEqual([beforeMove[1],beforeMove[2],beforeMove[0],...beforeMove.slice(3)]);
 await collapse.click();await expectLayout(0);await menuClick('tab-search');const tabSearch=page.getByRole('textbox',{name:'탭 검색',exact:true});await expect(tabSearch).toBeFocused();await expect(page.locator('.app.sidebar-collapsed')).toHaveCount(1);await expect(page.locator('#tab-search-dropdown')).toBeVisible();await tabSearch.fill('find');await expect(page.locator('.tab-search-result')).toHaveCount(1);await tabSearch.press('Enter');await expect.poll(async()=>(await activeTab()).url).toBe(base+'/find');await expect(page.locator('#tab-search-dropdown')).toHaveCount(0);await expectLayout(0);await menuClick('tab-search');await expect(tabSearch).toBeFocused();await tabSearch.press('Escape');await expect(page.locator('#tab-search-dropdown')).toHaveCount(0);await expand.click();await expectLayout(232);
 const count=(await state()).tabs.length;await page.locator('.new-tab').click();await expect.poll(async()=>(await state()).tabs.length).toBe(count+1);const added=(await state()).active;await page.locator(`[data-tab-id="${added}"]`).click({button:'middle'});await expect.poll(async()=>(await state()).tabs.length).toBe(count);console.log('PASS horizontal tab drag reorder, + new tab, middle-click close, collapsed ⇧⌘A search filters/selects and Esc closes');
 const overflowIds:number[]=[];for(let i=0;i<30;i++)overflowIds.push(await rpc<number>('tab.new'));await expect(rows).toHaveCount(count+30);const scroll=page.locator('.tab-scroll');await expect.poll(()=>scroll.evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);await expect.poll(()=>scroll.evaluate(e=>{const r=e.getBoundingClientRect(),t=e.querySelector('.selected')!.getBoundingClientRect();return t.left>=r.left&&t.right<=r.right+1;})).toBe(true);assert.ok(await rows.evaluateAll(es=>es.every(e=>e.getBoundingClientRect().width>=48)));await rpc('tab.select',{id:beforeMove[1]});await expect.poll(()=>scroll.evaluate(e=>e.scrollLeft)).toBe(0);for(const id of overflowIds)await rpc('tab.close',{id});await expect(rows).toHaveCount(count);console.log('PASS tab widths ≥48px, horizontal overflow and selected-tab scroll into view');
 assert.equal(errors.length,0,errors.join('\n'));
 // 13. Restart: per-host zoom and site permissions persist
 // Locators belong to the old Page; rebind them to the relaunched window.
 await app.close();await launch();findInput=page.getByRole('textbox',{name:'페이지에서 찾기'});rows=page.locator('.tab-strip .tab-row');infobar=page.locator('.infobar');
 s=await state();const find=s.tabs.find(t=>t.url===base+'/find');assert.ok(find,'find tab not restored');
 assert.deepEqual(s.sitePermissions,{[base]:{notifications:'allow'},[base2]:{notifications:'block'}});
 await rpc('tab.select',{id:find.id});await expect.poll(async()=>(await activeTab()).zoom).toBe(1.25);await expect(zoomChip(125)).toBeVisible();
 assert.equal(await inActive('Notification.requestPermission()',true),'granted');assert.equal((await state()).permissionRequests.length,0);
 console.log('PASS restart: host zoom 1.25 restored on navigation (chip 125%), stored allow answered without the bar');
 // 14. Screenshot: find bar, permission infobar, zoom chip. Taken before any 127.0.0.1:<other port> page loads: Chromium keeps one zoom level per
 // hostname, so loading the base2 tab resets this tab to 100% (observed; Heisen stores zoom per host:port — reported, not worked around).
 s=await state();await expect(rows).toHaveCount(s.tabs.length);await expect(rows.nth(s.tabs.findIndex(t=>t.id===find.id))).toHaveClass(/selected/);
 await menuClick('find');await expect(findInput).toBeFocused();await expect(page.locator('.find-count')).toHaveText('0/0');await findInput.fill('apple');await expect(page.locator('.find-count')).toHaveText('1/3');
 await inActive(`window.__geo=new Promise(r=>navigator.geolocation.getCurrentPosition(()=>r('position'),e=>r('error '+e.code)));true`,true);
 await expect.poll(async()=>(await state()).permissionRequests.map(r=>r.kinds)).toEqual([['geolocation']]);await expect(infobar).toContainText('위치 정보 확인');await expect(zoomChip(125)).toBeVisible();
 const pinnedShot=(await state()).tabs.find(t=>t.id!==find.id&&!t.taskId)!;await rpc('tab.command',{name:'pin',id:pinnedShot.id});await expect(rows.first()).toHaveClass(/pinned/);await page.screenshot({path:path.join(root,'docs/browser-chrome.png')});await rpc('tab.command',{name:'pin',id:pinnedShot.id});
 await menuClick('toggle-bookmark-bar');await expect(page.locator('.find-bar.own-row')).toBeVisible();await expectLayout(232);assert.equal((await bounds()).y,176);await menuClick('toggle-bookmark-bar');await expect(page.locator('.find-bar.docked')).toBeVisible();await expectLayout(232);
 await infobar.getByRole('button',{name:'차단'}).click();assert.equal(await inActive('window.__geo'),'error 1');assert.equal((await state()).sitePermissions[base]?.geolocation,'block');
 await findInput.press('Escape');await menuClick('zoom-reset');await expect.poll(async()=>(await activeTab()).zoom).toBe(1);await expect(page.locator('.zoom-chip')).toHaveCount(0);
 console.log('PASS screenshot docs/browser-chrome.png (find bar 1/3, geolocation infobar, zoom chip 125%); geolocation 차단 → PERMISSION_DENIED; zoom-reset → 100%');
 const other=await rpc<number>('tab.new',{url:base2+'/perm'});assert.equal(await inActive('Notification.requestPermission()',true),'denied');assert.equal((await state()).permissionRequests.length,0);await rpc('tab.close',{id:other});
 console.log('PASS restart: stored block on the second origin answered without the bar');
 // 15. 페이지를 다른 이름으로 저장 (⌘S): the save dialog suggests "<title>.html" in Downloads and the page is written as complete HTML.
 await rpc('tab.select',{id:find.id});await expect.poll(async()=>(await activeTab()).title).toBe('Find fixture');
 const savedPage=path.join(profile,'saved-page.html');
 await app.evaluate(({dialog},file)=>{const g=globalThis as typeof globalThis&{__savePath?:string};dialog.showSaveDialog=(async(...a:{defaultPath?:string}[])=>{g.__savePath=a[a.length-1].defaultPath;return {canceled:false,filePath:file};}) as unknown as typeof dialog.showSaveDialog;},savedPage);
 await menuClick('save-page');await expect.poll(()=>fs.readFile(savedPage,'utf8').catch(()=>'')).toContain('apple apple apple');
 const downloads=await app.evaluate(({app})=>app.getPath('downloads'));assert.equal(await app.evaluate(()=>(globalThis as typeof globalThis&{__savePath?:string}).__savePath),path.join(downloads,'Find fixture.html'));
 console.log('PASS save page: ⌘S item suggests "Find fixture.html" in Downloads and writes the page as complete HTML');
 // 16. 인터넷 사용 기록 삭제 (⇧⌘⌫): settings dialog with Chrome's defaults, modal keyboard, and what each box clears.
 const historyCount=async()=>(await rpc<{history:unknown[]}>('state')).history.length;assert.ok(await historyCount()>0);
 const findURL=base+'/find';await inUrl(findURL,"document.cookie='heisen=1; max-age=3600';localStorage.setItem('heisen','1');true");
 await menuClick('clear-history');const clearDialog=page.getByRole('dialog',{name:'인터넷 사용 기록 삭제'});await expect(clearDialog).toBeVisible();assert.equal((await state()).route,'settings');
 const boxes=clearDialog.getByRole('checkbox');await expect(boxes).toHaveCount(3);
 assert.deepEqual(await clearDialog.locator('.check-row').allTextContents(),['방문 기록','쿠키 및 기타 사이트 데이터','캐시된 이미지 및 파일']);assert.deepEqual(await Promise.all([0,1,2].map(i=>boxes.nth(i).isChecked())),[true,false,true]);
 const range=clearDialog.getByRole('combobox');await expect(range).toHaveValue('all');await expect(range).toBeFocused();
 const deleteButton=clearDialog.getByRole('button',{name:'삭제'}),closeButton=clearDialog.getByRole('button',{name:'닫기'});
 await deleteButton.focus();await page.keyboard.press('Tab');await expect(closeButton).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(deleteButton).toBeFocused();
 await page.keyboard.press('Escape');await expect(clearDialog).toHaveCount(0);assert.ok(await historyCount()>0,'Escape must not clear');
 const privacyButton=page.getByRole('button',{name:'인터넷 사용 기록 삭제'});await privacyButton.click();await expect(clearDialog).toBeVisible();await expect(range).toBeFocused();
 await page.keyboard.press('Escape');await expect(clearDialog).toHaveCount(0);await expect(privacyButton).toBeFocused();
 await privacyButton.click();await deleteButton.click();await expect(clearDialog).toHaveCount(0);await expect.poll(historyCount).toBe(0);
 assert.match(await inUrl<string>(findURL,'document.cookie'),/heisen=1/);
 await privacyButton.click();await boxes.nth(1).check();await deleteButton.click();await expect(clearDialog).toHaveCount(0);
 await expect.poll(()=>inUrl<string>(findURL,'document.cookie')).not.toMatch(/heisen=1/);
 await rpc('tab.command',{name:'reload',id:find.id});await expect.poll(()=>inUrl<string|null>(findURL,"localStorage.getItem('heisen')")).toBeNull();
 console.log('PASS clear browsing data: ⇧⌘⌫ opens the settings dialog (방문 기록 ✓, 쿠키 ✗, 캐시 ✓), first box focused, Tab wraps, Esc closes and restores focus; 삭제 clears history only, then cookies and localStorage when checked');
 assert.equal(errors.length,0,errors.join('\n'));
 // 17. Omnibox: host:port typed without a scheme opens over http; non-web schemes are refused.
 const port=new URL(base).port;
 await rpc('tab.navigate',{url:`localhost:${port}/next`});await expect.poll(async()=>(await activeTab()).url).toBe(`http://localhost:${port}/next`);await expect.poll(async()=>(await activeTab()).title).toBe('Second page');
 await assert.rejects(rpc('tab.navigate',{url:'mailto:x'}),/HTTP\(S\)/);
 console.log(`PASS omnibox: "localhost:${port}/next" → http://localhost:${port}/next, "mailto:x" refused`);
 // 18. Downloads save to the Downloads folder without a dialog, numbered like Chrome.
 const downloadDir=path.join(profile,'downloads');await fs.mkdir(downloadDir,{recursive:true});await app.evaluate(({app},dir)=>app.setPath('downloads',dir),downloadDir);
 const clickDownload=()=>inActive(`(()=>{const a=document.createElement('a');a.href='/download';document.body.append(a);a.click();a.remove();})()`,true);
 const downloadNames=()=>fs.readdir(downloadDir).then(f=>f.sort());
 await clickDownload();await expect.poll(downloadNames).toEqual(['heisen-test.txt']);
 await clickDownload();await expect.poll(downloadNames).toEqual(['heisen-test (1).txt','heisen-test.txt']);
 type DownloadRow={name:string;state:string;path:string};
 await expect.poll(async()=>(await rpc<{downloads:DownloadRow[]}>('state')).downloads.slice(0,2).map(d=>[d.state,d.path])).toEqual([['completed',path.join(downloadDir,'heisen-test (1).txt')],['completed',path.join(downloadDir,'heisen-test.txt')]]);
 assert.equal(await fs.readFile(path.join(downloadDir,'heisen-test (1).txt'),'utf8'),'heisen download');
 // Chrome-style download attributes: Gatekeeper quarantine record and kMDItemWhereFroms [download URL, page URL].
 const xattr=(name:string,file:string,hex=false)=>{try{return execFileSync('/usr/bin/xattr',[...hex?['-x']:[],'-p',name,file],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{return '';}};
 const QUARANTINE=/^0083;[0-9a-f]{8};Heisen;[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/;
 const pageUrl=(await activeTab()).url;
 for(const f of ['heisen-test.txt','heisen-test (1).txt']){
  const file=path.join(downloadDir,f);assert.match(xattr('com.apple.quarantine',file),QUARANTINE,f);
  const plist=Buffer.from(xattr('com.apple.metadata:kMDItemWhereFroms',file,true).replace(/\s/g,''),'hex');
  assert.deepEqual(JSON.parse(execFileSync('/usr/bin/plutil',['-convert','json','-o','-','-'],{input:plist,encoding:'utf8'})),[new URL('/download',pageUrl).href,pageUrl],f);
 }
 console.log('PASS downloads: link download saved to Downloads without a dialog; second copy "heisen-test (1).txt"; com.apple.quarantine and kMDItemWhereFroms set');
 // 다른 이름으로 이미지 저장… leaves the save path unset (Electron's save dialog); a later listener stands in for the dialog's answer.
 type Asked={__askedPath?:string};
 await rpc('tab.navigate',{url:`localhost:${port}/page`});await expect.poll(async()=>(await activeTab()).title).toBe('Browser fixture');
 const savedImage=path.join(profile,'saved-image.png');
 await app.evaluate(({session},file)=>{const g=globalThis as unknown as Asked;session.fromPartition('persist:browser').once('will-download',(_e,item)=>{g.__askedPath=item.getSavePath();item.setSavePath(file);});},savedImage);
 await contextLabels(await center('#img'));await app.evaluate(()=>{(globalThis as unknown as G).__t.menus.at(-1)!.menu.items.find(i=>i.label==='다른 이름으로 이미지 저장…')!.click();});
 await expect.poll(()=>fs.stat(savedImage).then(s=>s.size,()=>0)).toBe(image.length);await expect.poll(()=>xattr('com.apple.quarantine',savedImage)).toMatch(QUARANTINE);
 assert.equal(await app.evaluate(()=>(globalThis as unknown as Asked).__askedPath),'');assert.deepEqual(await downloadNames(),['heisen-test (1).txt','heisen-test.txt']);
 console.log('PASS save as: 다른 이름으로 이미지 저장… skips the automatic Downloads path and quarantines the file');
 // Typing a URL that turns into a download saves the file and leaves the tab on its page (or the new tab page) without an error.
 const beforeDownload=await activeTab();await rpc('tab.navigate',{url:`localhost:${port}/download`});
 await expect.poll(downloadNames).toEqual(['heisen-test (1).txt','heisen-test (2).txt','heisen-test.txt']);
 let kept=await activeTab();assert.equal(kept.url,beforeDownload.url);assert.equal(kept.error,undefined);assert.equal((await state()).route,'page');
 const downloadTab=await rpc<number>('tab.new',{url:`localhost:${port}/download`});
 await expect.poll(downloadNames).toEqual(['heisen-test (1).txt','heisen-test (2).txt','heisen-test (3).txt','heisen-test.txt']);
 kept=await activeTab();assert.equal(kept.id,downloadTab);assert.equal(kept.url,'heisen://newtab');assert.equal(kept.error,undefined);assert.equal((await state()).route,'home');
 await rpc('tab.close',{id:downloadTab});await rpc('tab.select',{id:beforeDownload.id});
 await rpc('tab.navigate',{url:`localhost:${port}/next`});await expect.poll(async()=>(await activeTab()).title).toBe('Second page');
 console.log('PASS download navigation: typed download URL keeps the tab page, from a new tab keeps the new tab page, no error');
 // 19. Tab strip: Chrome close order, tab.move, pinned group, tab context menu.
 const tabMenu=async(id:number)=>{const before=await menuCount();await rpc('tab.menu',{id,x:20,y:120});await expect.poll(menuCount).toBe(before+1);return app.evaluate(()=>(globalThis as unknown as G).__t.menus.at(-1)!.labels);};
 const tabMenuClick=(label:string)=>app.evaluate((_e,label)=>{const m=(globalThis as unknown as G).__t.menus.at(-1)!.menu;const item=m.items.find(i=>i.label===label);if(!item)throw new Error('No tab menu item '+label);item.click();},label);
 const order=async()=>(await state()).tabs.map(t=>t.id);
 const T0=(await activeTab()).id;
 assert.deepEqual(await tabMenu(T0),['새 탭(오른쪽에)','새 시크릿 탭','새로고침','복제','고정','탭 닫기','다른 탭 닫기','오른쪽 탭 닫기','닫은 탭 다시 열기']);
 await tabMenuClick('다른 탭 닫기');await expect.poll(order).toEqual([T0]);await activeIs(T0);
 const T1=await rpc<number>('tab.new',{url:base+'/page'}),T2=await rpc<number>('tab.new',{url:base+'/find'}),T3=await rpc<number>('tab.new',{url:base+'/next'});assert.deepEqual(await order(),[T0,T1,T2,T3]);
 await rpc('tab.select',{id:T1});await rpc('tab.close',{id:T1});await activeIs(T2);
 await rpc('tab.select',{id:T3});await rpc('tab.close',{id:T3});await activeIs(T2);assert.deepEqual(await order(),[T0,T2]);
 await rpc('tab.select',{id:T0});await activeIs(T0);await inActive(`window.open('/next');true`,true);
 await expect.poll(async()=>(await state()).tabs.length).toBe(3);let s2=await state();const opened=s2.tabs[1];assert.equal(opened.openerId,T0);assert.equal(s2.active,opened.id);assert.equal(s2.tabs[2].id,T2);
 await rpc('tab.close',{id:opened.id});await activeIs(T0);
 // Featureless window.open becomes a tab; its on-load window.close must use the normal close path.
 const beforeSelfClose=await activeTab();await rpc('tab.navigate',{url:new URL('/self-close-opener',beforeSelfClose.url).href});
 await inActive(`document.getElementById('open').click();true`,true);
 await expect.poll(()=>!!headers['/self-closing']).toBe(true);
 await expect.poll(order).toEqual([T0,T2]);await activeIs(T0);
 assert.equal((await activeTab()).error,undefined);assert.equal(errors.length,0,errors.join('\n'));assert.equal(await windowCount(),1);
 assert.equal(await app.evaluate(({WebContentsView})=>(globalThis as unknown as G).__t.win().contentView.children.some(v=>v instanceof WebContentsView&&(!v.webContents||v.webContents.isDestroyed()))),false,'destroyed child view left attached');
 await rpc('tab.navigate',{url:beforeSelfClose.url});
 console.log('PASS self-closing child tab: featureless window.open + window.close on load removes the view and tab, restores opener, state stays readable');
 const T4=await rpc<number>('tab.new',{url:base+'/page'});await rpc('tab.move',{id:T4,index:0});assert.deepEqual(await order(),[T4,T0,T2]);
 assert.ok((await tabMenu(T2)).includes('고정'));await tabMenuClick('고정');await expect.poll(order).toEqual([T2,T4,T0]);
 await rpc('tab.move',{id:T0,index:0});assert.deepEqual(await order(),[T2,T0,T4],'unpinned tab stays after the pinned group');
 await rpc('tab.command',{name:'pin',id:T4});assert.deepEqual(await order(),[T2,T4,T0],'pin → end of pinned group');
 await rpc('tab.move',{id:T4,index:5});assert.deepEqual(await order(),[T2,T4,T0],'pinned tab stays in the pinned group');
 assert.ok((await tabMenu(T2)).includes('고정 해제'));
 const T5=await rpc<number>('tab.new',{url:base+'/next'});await tabMenu(T0);await tabMenuClick('오른쪽 탭 닫기');await expect.poll(order).toEqual([T2,T4,T0]);assert.ok(!(await order()).includes(T5));
 await tabMenu(T0);await tabMenuClick('다른 탭 닫기');assert.deepEqual(await order(),[T2,T4,T0],'pinned tabs survive 다른 탭 닫기');
 s2=await state();assert.deepEqual(s2.tabs.map(t=>t.pinned),[true,true,false]);await rpc('tab.select',{id:T0});await activeIs(T0);
 console.log('PASS tabs: close → right, last → left, child → opener; tab.move; pin to end of pinned group, unpinned clamped after it; tab menu 고정/오른쪽 탭 닫기/다른 탭 닫기 keep pinned tabs');
 // 20. External schemes ask (stubbed dialog) and open through shell.openExternal; 항상 허용 is stored per origin and scheme. Same-origin blob: navigates.
 await app.evaluate(({dialog,shell})=>{
  const g=globalThis as unknown as Ext;g.__ext={boxes:[],opened:[],check:false};
  dialog.showMessageBox=(async(...a:unknown[])=>{const options=a[a.length-1] as Electron.MessageBoxOptions;g.__ext.boxes.push({message:options.message,detail:options.detail,buttons:options.buttons,defaultId:options.defaultId,cancelId:options.cancelId,checkboxLabel:options.checkboxLabel});return {response:0,checkboxChecked:g.__ext.check};}) as unknown as typeof dialog.showMessageBox;
  shell.openExternal=(async(url:string)=>{g.__ext.opened.push(url);}) as typeof shell.openExternal;
 });
 const ext=()=>app.evaluate(()=>(globalThis as unknown as Ext).__ext);const origin=`http://localhost:${port}`;
 await inActive(`(()=>{const a=document.createElement('a');a.href='mailto:test@example.com';document.body.append(a);a.click();a.remove();})()`,true);
 await expect.poll(async()=>(await ext()).opened).toEqual(['mailto:test@example.com']);
 assert.deepEqual((await ext()).boxes,[{message:'mailto 앱을 여시겠습니까?',detail:origin,buttons:['열기','취소'],defaultId:1,cancelId:1,checkboxLabel:'항상 허용'}]);assert.equal((await state()).sitePermissions[origin],undefined);
 await app.evaluate(()=>{(globalThis as unknown as Ext).__ext.check=true;});
 await inActive(`window.open('tel:123');true`,true);await expect.poll(async()=>(await ext()).opened.length).toBe(2);assert.equal((await state()).sitePermissions[origin]?.['external:tel'],'allow');
 await inActive(`window.open('tel:456');true`,true);await expect.poll(async()=>(await ext()).opened).toEqual(['mailto:test@example.com','tel:123','tel:456']);assert.equal((await ext()).boxes.length,2,'remembered scheme asks again');
 await inActive(`location.href='file:///etc/hosts';true`,true);await sleep(500);assert.equal((await ext()).opened.length,3);assert.equal((await activeTab()).url,origin+'/next');
 await inActive(`location.href=URL.createObjectURL(new Blob(['<title>Blob page</title><p>blob</p>'],{type:'text/html'}));true`,true);
 await expect.poll(async()=>(await activeTab()).title).toBe('Blob page');assert.match((await activeTab()).url,new RegExp('^blob:'+origin+'/'));
 // The saved session keeps the page the blob came from, never the blob: URL (gone after restart).
 await sleep(800);const library=await readLibrary(app,profile);
 assert.ok(!library.tabs.some(t=>t.url.startsWith('blob:')),JSON.stringify(library.tabs));assert.deepEqual(library.tabs[library.activeTab!],{url:origin+'/next',title:'Second page',pinned:false});
 console.log('PASS external schemes: mailto link → prompt (origin, 열기/취소, 항상 허용) → openExternal; tel via window.open remembered with 항상 허용; file: ignored; same-origin blob: navigates and is saved as its source page');
 // 21. Private tabs use a fresh in-memory session and never enter the persisted library.
 const regular=(await activeTab()).id,privateURL=base+'/incognito-set',normalPermissions=structuredClone((await state()).sitePermissions);
 const privateTab=await rpc<number>('tab.new',{url:privateURL,incognito:true});assert.equal((await activeTab()).incognito,true);
 assert.equal(await windowCount(),1);await expect(page.locator('.toolbar.incognito .incognito-chip')).toHaveText('시크릿');
 assert.ok((await tabMenu(privateTab)).includes('새 시크릿 탭'));
 type PrivateGlobal={__privateSession:Electron.Session};
 const cookies=await app.evaluate(async({session})=>{const ses=(globalThis as unknown as G).__t.view().webContents.session;(globalThis as unknown as PrivateGlobal).__privateSession=ses;return {private:await ses.cookies.get({name:'incognitoFixture'}),normal:await session.fromPartition('persist:browser').cookies.get({name:'incognitoFixture'}),persistent:ses.isPersistent(),preloads:ses.getPreloadScripts().map(p=>p.id)};});
 assert.equal(cookies.normal.length,0);assert.equal(cookies.private[0]?.value,'private');assert.equal(cookies.persistent,false);assert.ok(cookies.preloads.includes('heisen-page'));
 assert.equal(headers['/incognito-set']['user-agent'],ua);
 await assert.rejects(()=>rpc('memory.capture'),/시크릿 탭은 저장할 수 없습니다/);
 await inActive(`document.querySelector('#private-child').click();true`,true);
 await expect.poll(async()=>(await state()).tabs.filter(t=>t.incognito).length).toBe(2);
 const privateChild=(await state()).tabs.find(t=>t.incognito&&t.id!==privateTab)!;assert.equal(privateChild.openerId,privateTab);await rpc('tab.select',{id:privateChild.id});
 assert.equal(await inActive('document.cookie'),'incognitoFixture=private');
 assert.equal(await app.evaluate(()=>(globalThis as unknown as G).__t.view().webContents.session===(globalThis as unknown as PrivateGlobal).__privateSession),true);
 await rpc('tab.zoom',{dir:'in'});const privateZoom=(await activeTab()).zoom;
 await rpc('tab.select',{id:regular});assert.notEqual((await activeTab()).zoom,privateZoom);
 await rpc('tab.select',{id:privateTab});await rpc('tab.navigate',{url:base+'/incognito-permissions'});
 // Persistent blocks apply, while persistent grants require a new private-session answer.
 assert.equal(normalPermissions[base]?.notifications,'allow');await inActive(requestNotification,true);
 await expect.poll(async()=>(await state()).permissionRequests.map(r=>[r.tabId,r.kinds])).toEqual([[privateTab,['notifications']]]);
 await rpc('permission.decide',{id:(await state()).permissionRequests[0].id,allow:true});assert.equal(await inActive('window.__perm'),'granted');
 assert.equal(await inActive('Notification.requestPermission()',true),'granted');assert.equal((await state()).permissionRequests.length,0);
 await rpc('tab.navigate',{url:base2+'/incognito-block'});assert.equal(await inActive('Notification.requestPermission()',true),'denied');assert.equal((await state()).permissionRequests.length,0);
 await rpc('tab.navigate',{url:origin+'/incognito-external'});
 const beforePrivateBoxes=(await ext()).boxes.length;await inActive(`window.open('tel:789');true`,true);
 await expect.poll(async()=>(await ext()).boxes.length).toBe(beforePrivateBoxes+1);
 await inActive(`window.open('mailto:private@example.com');true`,true);await expect.poll(async()=>(await ext()).boxes.length).toBe(beforePrivateBoxes+2);
 assert.deepEqual((await state()).sitePermissions,normalPermissions);
 await sleep(800);const privateLibrary=await readLibrary(app,profile);
 assert.ok(![...privateLibrary.tabs,...privateLibrary.history].some(t=>t.url.includes('/incognito')));
 for(const t of (await state()).tabs.filter(t=>t.incognito))await rpc('tab.close',{id:t.id});
 await expect.poll(()=>app.evaluate(async()=>((await (globalThis as unknown as PrivateGlobal).__privateSession.cookies.get({name:'incognitoFixture'})).length))).toBe(0);
 const freshPrivate=await rpc<number>('tab.new',{url:base+'/incognito-empty',incognito:true});assert.equal(await inActive('document.cookie'),'');
 assert.equal(await app.evaluate(()=>(globalThis as unknown as G).__t.view().webContents.session===(globalThis as unknown as PrivateGlobal).__privateSession),false);
 await inActive(requestNotification,true);await expect.poll(async()=>(await state()).permissionRequests.length).toBe(1);
 await rpc('permission.decide',{id:(await state()).permissionRequests[0].id,allow:false});assert.equal(await inActive('window.__perm'),'denied');assert.deepEqual((await state()).sitePermissions,normalPermissions);
 await rpc('tab.close',{id:freshPrivate});await menuClick('new-incognito-tab');await expect.poll(async()=>(await activeTab()).incognito).toBe(true);
 await expect(page.locator('.incognito-home h1')).toHaveText('시크릿 탭');await expect(page.locator('.incognito-home p')).toHaveText('시크릿 탭을 모두 닫으면 방문 기록·쿠키·사이트 데이터가 삭제됩니다.');
 await page.screenshot({path:path.join(root,'docs/incognito.png')});await rpc('tab.close',{id:(await activeTab()).id});
 console.log('PASS incognito: memory-only cookies/preload/identity, child inheritance, isolated zoom, permissions/external grants, history/session exclusion, last-tab cleanup and fresh partition; screenshot docs/incognito.png');
 // 23. A normal second window owns its prompts, page services and tab IDs, even after the first closes.
 const firstPage=page,firstIds=(await state()).tabs.map(t=>t.id),firstWindow=await app.browserWindow(firstPage),firstWindowId=await firstWindow.evaluate(w=>w.id);
 const newWindow=app.waitForEvent('window');await menuClick('new-window');page=await newWindow;await page.getByRole('textbox',{name:'주소창'}).waitFor();await expect.poll(windowCount).toBe(2);
 const secondWindow=await app.browserWindow(page),secondWindowId=await secondWindow.evaluate(w=>w.id);
 assert.ok((await state()).tabs.every(t=>!firstIds.includes(t.id)));assert.equal(await app.evaluate(({ipcMain})=>ipcMain.listenerCount('heisen:swipe')),1);
 if(process.env.HEISEN_TEST_VISIBLE==='1'){
  await secondWindow.evaluate(w=>w.focus());await expect.poll(()=>app.evaluate(({BrowserWindow})=>BrowserWindow.getFocusedWindow()?.id)).toBe(secondWindowId);await menuClick('new-tab');await expect.poll(async()=>(await state()).tabs.length).toBe(2);
  console.log('PASS native focus: second window receives the new-tab menu action');
 }else{
  console.log('SKIP (visible-only): native second-window focus and focused-window menu dispatch');
  // Preserve the two-tab setup through the caller-scoped API, without pretending it tests native focus.
  await rpc('tab.new');await expect.poll(async()=>(await state()).tabs.length).toBe(2);
 }
 const loginUrl=base2+'/multi-login';await rpc('tab.navigate',{url:loginUrl});
 await inUrl(loginUrl,"document.querySelector('[name=username]').value='second-user';document.querySelector('[name=password]').value='second-window-secret'");
 await app.evaluate(({webContents},url)=>{const wc=webContents.getAllWebContents().find(w=>w.getURL()===url)!;wc.focus();wc.sendInputEvent({type:'keyDown',keyCode:'Tab'});wc.sendInputEvent({type:'keyUp',keyCode:'Tab'});},loginUrl);
 const buttonPoint=await inUrl<Point>(loginUrl,"(()=>{const r=document.querySelector('button').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()");
 await app.evaluate(({webContents},[url,p])=>{const wc=webContents.getAllWebContents().find(w=>w.getURL()===url)!;for(const type of ['mouseDown','mouseUp'] as const)wc.sendInputEvent({type,x:p.x,y:p.y,button:'left',clickCount:1});},[loginUrl,buttonPoint] as const);
 type PromptState=State&{passwordPrompts:{tabId:number}[];activePasswords:number};
 await expect.poll(async()=>(await rpc<PromptState>('state')).passwordPrompts.length).toBe(1);
 assert.equal((await firstPage.evaluate(()=>(window as unknown as Heisen).heisen.call('state',{})) as PromptState).passwordPrompts.length,0);
 await rpc('password.prompt',{tabId:(await activeTab()).id,action:'save'});assert.equal((await rpc<PromptState>('state')).activePasswords,1);
 const menuBefore=await menuCount();await rpc('password.menu',{x:300,y:150});await expect.poll(menuCount).toBe(menuBefore+1);
 await app.evaluate(()=>{const menu=(globalThis as unknown as G).__t.menus.at(-1)!.menu;menu.items.find(i=>i.label==='second-user')!.click();});
 await expect.poll(()=>inUrl(loginUrl,"document.querySelector('[name=password]').value")).toBe('second-window-secret');
 await rpc('permission.reset',{origin:base2});await inUrl(loginUrl,requestNotification,true);await expect.poll(async()=>(await state()).permissionRequests.length).toBe(1);
 assert.equal((await firstPage.evaluate(()=>(window as unknown as Heisen).heisen.call('state',{})) as State).permissionRequests.length,0);
 await rpc('permission.decide',{id:(await state()).permissionRequests[0].id,allow:false});assert.equal(await inUrl(loginUrl,'window.__perm'),'denied');
 const idle=await rpc<number>('tab.new',{url:base+'/multi-idle'});await rpc('tab.new',{url:base2+'/multi-active?utm_source=multiwindow'});
 type PrivacyState=Omit<State,'tabs'>&{tabs:(PublicTab&{privacy:{params:number}})[]};
 await expect.poll(async()=>{const s=await rpc<PrivacyState>('state');return s.tabs.find(t=>t.id===s.active)?.privacy.params;}).toBeGreaterThan(0);
 await page.getByRole('button',{name:/사이트 정보$/}).click();await expect(page.getByRole('dialog',{name:'사이트 정보'})).toContainText('추적 매개변수 제거');await page.screenshot({path:'/tmp/heisen-b13c-two-windows.png'});await page.keyboard.press('Escape');
 // As in e2e-perf, detach Playwright's web targets: Chromium treats their automation capture as a sleep veto.
 type RootSession={send(method:string,args?:object):Promise<any>};
 type InProcessApp={_connection:{toImpl(app:ElectronApplication):{_browserContext:{_browser:{_session:RootSession}}}}};
 const inProcessApp=app as unknown as InProcessApp,cdp=inProcessApp._connection.toImpl(app)._browserContext._browser._session;
 await page.evaluate(()=>{document.title='Heisen second-window sleep check';});
 const targets=await cdp.send('Target.getTargets'),target=targets.targetInfos.find((t:{title:string})=>t.title==='Heisen second-window sleep check');assert.ok(target);
 const detached=page.waitForEvent('close');await cdp.send('Target.setAutoAttach',{autoAttach:false,waitForDebuggerOnStart:false,flatten:true});await detached;
 const attached=app.waitForEvent('window');await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:true});page=await attached;
 await app.evaluate(({powerMonitor})=>{powerMonitor.emit('on-ac');powerMonitor.emit('thermal-state-change',{state:'nominal'});});
 await rpc('prefs.save',{sleep:{afterMin:0.02,watchdog:false,budgetMiB:65536}});await sleep(2000);await rpc('perf.tick');assert.equal((await state()).tabs.find(t=>t.id===idle)?.sleeping,true);
 const mcp=await rpc<{url:string;token:string}>('mcp.enable');
 const listTabs=async()=>{const response=await fetch(mcp.url+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+mcp.token,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'list_tabs'}})});const body=await response.json();return JSON.parse(body.result.content[0].text) as {tabId:number}[];};
 const listed=await listTabs();assert.ok(listed.some(t=>firstIds.includes(t.tabId)));assert.ok(listed.some(t=>t.tabId===idle));
 await app.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id)!.close(),firstWindowId);await expect.poll(windowCount).toBe(1);
 await rpc('tab.select',{id:idle});assert.equal((await activeTab()).sleeping,false);assert.ok((await listTabs()).every(t=>!firstIds.includes(t.tabId)));
 await menuClick('new-tab');await expect.poll(async()=>(await state()).tabs.length).toBeGreaterThanOrEqual(5);await rpc('mcp.disable');
 if(process.platform==='darwin'){
  await app.evaluate(({BrowserWindow},id)=>BrowserWindow.fromId(id)!.close(),secondWindowId);await expect.poll(windowCount).toBe(0);assert.equal(await app.evaluate(({app})=>app.isReady()),true);
  await app.evaluate(({app})=>app.emit('activate'));await expect.poll(windowCount).toBe(1);
  const targets=await cdp.send('Target.getTargets'),target=targets.targetInfos.find((t:{url:string})=>t.url.startsWith('file:'));assert.ok(target);
  const reopened=app.waitForEvent('window');await cdp.send('Target.attachToTarget',{targetId:target.targetId,flatten:true});page=await reopened;await page.getByRole('textbox',{name:'주소창'}).waitFor();assert.ok((await state()).tabs.length);
 }
 console.log('PASS two windows: menu, global IDs, isolated autofill/permission prompts, privacy counters, sleeping, MCP, first-window close and macOS reopen');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('ALL BROWSER CHECKS PASSED');
 console.log('ALL CHECKS PASSED');
}finally{await app.evaluate(({clipboard},text)=>clipboard.writeText(text),savedClipboard).catch(()=>{});await app.close();server.closeAllConnections();server.close();server2.closeAllConnections();server2.close();}
