import {app as electronApp,BaseWindow,Menu,clipboard,dialog,type WebContents} from 'electron';
import path from 'node:path';
import {HOME,type Browser,type Tab} from './browser.ts';
import type {Data} from './data.ts';
import type {Windows} from './windows.ts';
import {isMac} from './platform.ts';
export type MenuContext={windows:Windows;data:Data;changed:()=>void;shortcut:(name:string)=>void;newChat:()=>void;toggleSidebar:()=>void};
type Item=Electron.MenuItemConstructorOptions;
export function installMenu(ctx:MenuContext):void{
 const {windows,data,changed,shortcut,newChat,toggleSidebar}=ctx;
 const run=(p:Promise<unknown>)=>void p.catch(e=>console.error('Menu action failed',(e as Error).message));
 const onBrowser=(fn:(browser:Browser)=>unknown)=>()=>{const browser=windows.focused();if(browser)fn(browser);};
 // Runs only while a web page is the visible active tab; new tab and app screens have no page contents.
 const onPage=(fn:(t:Tab,wc:WebContents,browser:Browser)=>unknown)=>onBrowser(browser=>{const t=browser.tabs.get(browser.active),wc=t?.view?.webContents;if(browser.route==='page'&&t&&wc&&!wc.isDestroyed())fn(t,wc,browser);});
 const sep:Item={type:'separator'};
 const K=isMac?{sidebar:'Ctrl+Cmd+S',fullscreen:'Ctrl+Cmd+F',devtools:'Alt+CmdOrCtrl+I'}:{sidebar:'Ctrl+Alt+S',fullscreen:'F11',devtools:'F12'};
 const app:Item[]=[{id:'about',label:'Heisen 정보',role:'about'},sep,{id:'settings',label:'설정…',accelerator:'CmdOrCtrl+,',click:onBrowser(browser=>browser.show('settings'))},sep,{id:'services',label:'서비스',role:'services'},sep,{id:'hide',label:'Heisen 숨기기',role:'hide',accelerator:'Cmd+H'},{id:'hide-others',label:'기타 숨기기',role:'hideOthers',accelerator:'Alt+Cmd+H'},{id:'unhide',label:'모두 보기',role:'unhide'},sep,{id:'quit',label:'Heisen 종료',role:'quit',accelerator:'Cmd+Q'}];
 const newTab=onBrowser(browser=>run((async()=>{await browser.create();shortcut('address');})()));
 // Chrome's default name is the page title in the Downloads folder; characters macOS or Windows reject in file names become '_'.
 const savePage=async(wc:WebContents)=>{const name=(wc.getTitle().replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').trim()||'page').slice(0,200),win=windows.focusedWindow();if(!win)return;const r=await dialog.showSaveDialog(win,{defaultPath:path.join(electronApp.getPath('downloads'),name+'.html'),filters:[{name:'웹페이지, 전체',extensions:['html','htm']}]});if(!r.canceled&&r.filePath&&!wc.isDestroyed())await wc.savePage(r.filePath,'HTMLComplete');};
 const file:Item[]=[{id:'new-window',label:'새 창',accelerator:'CmdOrCtrl+N',click:()=>run(windows.create({url:HOME}))},{id:'new-tab',label:'새 탭',accelerator:'CmdOrCtrl+T',click:newTab},{id:'new-incognito-tab',label:'새 시크릿 탭',accelerator:'CmdOrCtrl+Shift+N',click:onBrowser(browser=>run((async()=>{await browser.create(HOME,true,undefined,false,undefined,undefined,true);shortcut('address');})()))},{id:'new-chat',label:'새 대화',accelerator:'CmdOrCtrl+Shift+E',click:()=>newChat()},{id:'reopen-tab',label:'닫은 탭 다시 열기',accelerator:'CmdOrCtrl+Shift+T',click:onBrowser(browser=>run(browser.reopenClosed()))},{id:'open-location',label:'위치 열기…',accelerator:'CmdOrCtrl+L',click:()=>shortcut('address')},sep,
  {id:'close-window',label:'창 닫기',accelerator:'CmdOrCtrl+Shift+W',click:()=>BaseWindow.getFocusedWindow()?.close()},
  {id:'close-tab',label:'탭 닫기',accelerator:'CmdOrCtrl+W',click:onBrowser(browser=>{const w=BaseWindow.getFocusedWindow();if(w&&browser.popups.has(w))w.close();else browser.close(browser.active);})},sep,
  {id:'save-page',label:'페이지를 다른 이름으로 저장…',accelerator:'CmdOrCtrl+S',click:onPage((_t,wc)=>run(savePage(wc)))},
  {id:'print',label:'인쇄…',accelerator:'CmdOrCtrl+P',click:onPage((t,_wc,browser)=>browser.print(t.id))}];
 if(!isMac)file.push(sep,{id:'settings',label:'설정…',accelerator:'Ctrl+,',click:onBrowser(browser=>browser.show('settings'))},sep,{id:'quit',label:'종료',accelerator:'Ctrl+Shift+Q',role:'quit'});
 const edit:Item[]=[{id:'undo',label:'실행 취소',role:'undo',accelerator:'CmdOrCtrl+Z'},{id:'redo',label:'다시 실행',role:'redo',accelerator:'CmdOrCtrl+Shift+Z'},sep,{id:'cut',label:'잘라내기',role:'cut',accelerator:'CmdOrCtrl+X'},{id:'copy',label:'복사',role:'copy',accelerator:'CmdOrCtrl+C'},{id:'paste',label:'붙여넣기',role:'paste',accelerator:'CmdOrCtrl+V'},{id:'paste-match',label:'붙여넣고 스타일 일치',role:'pasteAndMatchStyle',accelerator:'CmdOrCtrl+Alt+Shift+V'},{id:'delete',label:'삭제',role:'delete'},{id:'select-all',label:'모두 선택',role:'selectAll',accelerator:'CmdOrCtrl+A'},sep,
  {id:'menu-find',label:'찾기',submenu:[{id:'find',label:'찾기…',accelerator:'CmdOrCtrl+F',click:onPage(()=>shortcut('find'))},{id:'find-next',label:'다음 찾기',accelerator:'CmdOrCtrl+G',click:onPage((_t,_wc,browser)=>browser.findNext(true))},{id:'find-prev',label:'이전 찾기',accelerator:'CmdOrCtrl+Shift+G',click:onPage((_t,_wc,browser)=>browser.findNext(false))}]},
  {id:'copy-url',label:'URL 복사',accelerator:'CmdOrCtrl+Shift+C',click:onPage(t=>{if(/^https?:/i.test(t.url))clipboard.writeText(t.url);})}];
 const view:Item[]=[{id:'toggle-sidebar',label:'사이드바 표시/숨기기',accelerator:K.sidebar,click:()=>toggleSidebar()},
  {id:'toggle-bookmark-bar',label:'항상 북마크바 표시',type:'checkbox',checked:data.state.settings.bookmarkBar,accelerator:'CmdOrCtrl+Shift+B',click:item=>{const s=data.state.settings;s.bookmarkBar=!s.bookmarkBar;item.checked=s.bookmarkBar;data.save();changed();}},
  {id:'toggle-panel',label:'측면 패널 표시/숨기기',accelerator:'CmdOrCtrl+E',click:()=>shortcut('panel')},sep,
  {id:'reload',label:'새로고침',accelerator:'CmdOrCtrl+R',click:onPage((_t,_wc,browser)=>run(browser.command('reload')))},{id:'hard-reload',label:'강력 새로고침',accelerator:'CmdOrCtrl+Shift+R',click:onPage((_t,wc)=>wc.reloadIgnoringCache())},sep,
  {id:'fullscreen',label:'전체 화면',role:'togglefullscreen',accelerator:K.fullscreen},
  {id:'zoom-reset',label:'실제 크기',accelerator:'CmdOrCtrl+0',click:onPage((t,_wc,browser)=>browser.zoom(t.id,'reset'))},{id:'zoom-in',label:'확대',accelerator:'CmdOrCtrl+Plus',click:onPage((t,_wc,browser)=>browser.zoom(t.id,'in'))},{id:'zoom-in-equal',label:'확대',accelerator:'CmdOrCtrl+=',visible:false,click:onPage((t,_wc,browser)=>browser.zoom(t.id,'in'))},{id:'zoom-out',label:'축소',accelerator:'CmdOrCtrl+-',click:onPage((t,_wc,browser)=>browser.zoom(t.id,'out'))},sep,
  {id:'menu-developer',label:'개발자',submenu:[{id:'devtools',label:'개발자 도구',accelerator:K.devtools,click:onPage((t,_wc,browser)=>browser.toggleDevTools(t.id))}]}];
 const history:Item[]=[{id:'home',label:'홈',accelerator:'CmdOrCtrl+Shift+H',click:onBrowser(browser=>{const t=browser.tabs.get(browser.active);if(t&&!t.taskId)run(browser.navigate(t.id,HOME));})},
  {id:'back',label:'뒤로',accelerator:'CmdOrCtrl+[',click:onPage((_t,_wc,browser)=>run(browser.command('back')))},{id:'forward',label:'앞으로',accelerator:'CmdOrCtrl+]',click:onPage((_t,_wc,browser)=>run(browser.command('forward')))},sep,
  {id:'history',label:'전체 방문 기록 보기',accelerator:'CmdOrCtrl+Y',click:onBrowser(browser=>browser.show('history'))},{id:'clear-history',label:'인터넷 사용 기록 삭제…',accelerator:'CmdOrCtrl+Shift+Backspace',click:onBrowser(browser=>{browser.show('settings');shortcut('clear-data');})}];
 const bookmarks:Item[]=[{id:'bookmarks',label:'북마크 관리자',accelerator:'Alt+CmdOrCtrl+B',click:onBrowser(browser=>browser.show('bookmarks'))},{id:'bookmark-tab',label:'이 탭을 북마크에 추가…',accelerator:'CmdOrCtrl+D',click:onPage((_t,_wc,browser)=>run(browser.command('bookmark')))},sep,{id:'import',label:'북마크 및 설정 가져오기…',click:()=>shortcut('import')}];
 const cycle=(id:string,label:string,accelerator:string,delta:1|-1,visible=true):Item=>({id,label,accelerator,visible,click:onBrowser(browser=>run(browser.cycle(delta)))});
 const tabs:Item[]=[cycle('next-tab','다음 탭 선택','Ctrl+Tab',1),cycle('prev-tab','이전 탭 선택','Ctrl+Shift+Tab',-1),cycle('next-tab-alt','다음 탭 선택','Alt+CmdOrCtrl+Right',1,false),cycle('prev-tab-alt','이전 탭 선택','Alt+CmdOrCtrl+Left',-1,false),cycle('next-tab-bracket','다음 탭 선택','CmdOrCtrl+Shift+]',1,false),cycle('prev-tab-bracket','이전 탭 선택','CmdOrCtrl+Shift+[',-1,false),sep,
  {id:'duplicate-tab',label:'탭 복제',click:onBrowser(browser=>run(browser.duplicate(browser.active)))},{id:'pin-tab',label:'탭 고정 전환',click:onBrowser(browser=>run(browser.command('pin')))},sep,
  {id:'tab-search',label:'탭 검색',accelerator:'CmdOrCtrl+Shift+A',click:()=>shortcut('tab-search')},
  ...[1,2,3,4,5,6,7,8,9].map((n):Item=>({id:n===9?'select-tab-last':'select-tab-'+n,label:n===9?'마지막 탭 선택':`탭 ${n} 선택`,accelerator:'CmdOrCtrl+'+n,visible:false,click:onBrowser(browser=>run(browser.selectIndex(n)))}))];
 const win:Item[]=[{id:'minimize',label:'최소화',role:'minimize',accelerator:'CmdOrCtrl+M'},{id:'zoom-window',label:'확대/축소',role:'zoom'},sep,{id:'downloads',label:'다운로드',accelerator:'CmdOrCtrl+Shift+J',click:onBrowser(browser=>browser.show('downloads'))},{id:'passwords',label:'비밀번호 관리자',click:onBrowser(browser=>browser.show('vault'))},sep,{id:'front',label:'모두 앞으로 가져오기',role:'front'}];
 if(!isMac)view.push(sep,...win.filter(item=>['minimize','downloads','passwords'].includes(item.id??'')));
 const menu=Menu.buildFromTemplate([...(isMac?[{id:'menu-app',label:'Heisen',submenu:app}]:[]),{id:'menu-file',label:'파일',submenu:file},{id:'menu-edit',label:'수정',submenu:edit},{id:'menu-view',label:'보기',submenu:view},{id:'menu-history',label:'방문 기록',submenu:history},{id:'menu-bookmarks',label:'북마크',submenu:bookmarks},{id:'menu-tab',label:'탭',submenu:tabs},...(isMac?[{id:'menu-window',label:'창',role:'window' as const,submenu:win}]:[])]);
 // The bookmark bar setting can also change from the app UI; refresh the check mark whenever the menu opens.
 const bar=menu.getMenuItemById('toggle-bookmark-bar')!;menu.getMenuItemById('menu-view')!.submenu!.on('menu-will-show',()=>{bar.checked=data.state.settings.bookmarkBar;});
 Menu.setApplicationMenu(menu);
}
