import {ipcMain,WebContentsView,type BrowserWindow,type IpcMainEvent} from 'electron';
import type {Browser} from './browser.ts';
import {windows} from './windows.ts';
import {SWIPE_THRESHOLD,type SwipeMessage} from './swipe.ts';
type IconNode=[string,Record<string,string>][];
const PHASES=['update','end','cancel'];
function svg(node:IconNode,cls:string){return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${node.map(([tag,attrs])=>`<${tag}${Object.entries(attrs).filter(([k])=>k!=='key').map(([k,v])=>` ${k}="${v}"`).join('')}/>`).join('')}</svg>`;}
function overlayHtml(left:IconNode,right:IconNode){return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}#c{position:absolute;left:8px;top:8px;width:56px;height:56px;border-radius:50%;background:rgba(58,58,58,.92);color:#e7e7e5;display:flex;align-items:center;justify-content:center}#c.done{background:#e7e7e5;color:#000}svg{width:24px;height:24px}#c.back .r,#c.forward .l{display:none}</style></head><body><div id="c">${svg(left,'l')}${svg(right,'r')}</div><script>window.set=(back,p)=>{const c=document.getElementById('c');c.className=(back?'back':'forward')+(p>=1?' done':'');c.style.opacity=String(.35+.65*p);c.style.transform='translateX('+(back?-1:1)*16*(1-p)+'px)';};</script></body></html>`;}
// Chrome-like history swipe: page-preload.ts reports the finger travel dx; a small transparent view shows the arrow, and the gesture navigates on end once dx reaches the threshold.
export class SwipeNavigator {
 private static installed=false;
 private static navigators=new WeakMap<Browser,SwipeNavigator>();
 private overlay?:Promise<WebContentsView>;private shown=false;
 constructor(private browser:Browser,private win:BrowserWindow){}
 install(){
  SwipeNavigator.navigators.set(this.browser,this);
  if(!SwipeNavigator.installed){
   SwipeNavigator.installed=true;
   ipcMain.on('heisen:swipe',(e,msg:SwipeMessage)=>{const browser=windows.byContents(e.sender);if(browser)SwipeNavigator.navigators.get(browser)?.swipe(e,msg);});
  }
  // Built once the UI has loaded so the first swipe already shows the arrow (a cold overlay takes longer than a quick swipe).
  this.win.webContents.once('did-finish-load',()=>{if(!this.win.isDestroyed())this.overlay??=this.create();});
  // A quit right after launch can close the window before the overlay loads. Its loadURL promise then settles inside the overlay's own
  // did-finish-load dispatch, and while the app shuts down Electron deletes a closed WebContents synchronously: closing it there trips
  // Chromium's CHECK(!observers_.is_notifying_observers()) (SIGTRAP). Close on a later task instead; a load aborted by the quit is moot.
  this.win.on('closed',()=>{void this.overlay?.then(o=>{setImmediate(()=>{if(!o.webContents.isDestroyed())o.webContents.close();});},()=>{});});
 }
 private swipe(e:IpcMainEvent,msg:SwipeMessage){
  const tab=this.browser.tabs.get(this.browser.active),wc=tab?.view?.webContents;
  if(!tab?.view||!wc||tab.taskId||e.sender!==wc||e.senderFrame!==wc.mainFrame)return;
  if(!msg||!PHASES.includes(msg.phase)||typeof msg.dx!=='number'||!Number.isFinite(msg.dx))return;
  const back=msg.dx>0,history=wc.navigationHistory,possible=msg.dx!==0&&(back?history.canGoBack():history.canGoForward()),progress=Math.min(1,Math.abs(msg.dx)/SWIPE_THRESHOLD);
  if(msg.phase==='update'){if(possible)void this.show(tab.view,back,progress);else this.hide();return;}
  this.hide();if(msg.phase==='end'&&possible&&progress>=1)void this.browser.command(back?'back':'forward',tab.id);
 }
 private async create(){
  const [{__iconData:left},{__iconData:right}]=await Promise.all([import('lucide-react/icons/arrow-left'),import('lucide-react/icons/arrow-right')]) as unknown as [{__iconData:{node:IconNode}},{__iconData:{node:IconNode}}];
  const overlay=new WebContentsView({webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});overlay.setBackgroundColor('#00000000');overlay.setVisible(false);
  await overlay.webContents.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(overlayHtml(left.node,right.node)));
  return overlay;
 }
 private async show(view:WebContentsView,back:boolean,progress:number){
  this.shown=true;const overlay=await (this.overlay??=this.create());if(!this.shown||this.win.isDestroyed())return;
  const b=view.getBounds();overlay.setBounds({x:back?b.x+8:b.x+b.width-80,y:Math.round(b.y+b.height/2-36),width:72,height:72});
  overlay.webContents.executeJavaScript(`set(${back},${progress})`).catch(()=>{});
  this.win.contentView.addChildView(overlay);overlay.setVisible(true);
 }
 private hide(){this.shown=false;void this.overlay?.then(o=>o.setVisible(false));}
}
