import {BaseWindow,BrowserWindow,type Rectangle,type WebContents} from 'electron';
import {Browser,HOME,type Tab} from './browser.ts';
import type {Data} from './data.ts';
import type {HttpsFirst} from './https-first.ts';
import type {Sessions} from './sessions.ts';
import {callerWindow} from './rpc.ts';
import {windowChrome} from './platform-app.ts';
import {testWindowOptions,showWindow,focusWindow} from './test-background.ts';

// UI windows only: popup windows may be owned by a Browser but never acquire RPC authority.
export class Windows {
 private list:Browser[]=[];private counter=0;private lastFocused?:Browser;
 constructor(private deps:{data:Data;changed:()=>void;httpsFirst:HttpsFirst;sessions:Sessions;uiURL:string;preload:string;beforeShow:(win:BrowserWindow)=>void;quitting:()=>boolean}){}
 nextTabId():number{return ++this.counter;}
 get sessions():Sessions{return this.deps.sessions;}
 all():Browser[]{return this.list.filter(b=>!b.win.isDestroyed());}
 focused():Browser|undefined{
  const focused=BaseWindow.getFocusedWindow(),browser=focused?this.of(focused)??this.list.find(b=>b.popups.has(focused)):undefined;
  return browser??(this.lastFocused&&!this.lastFocused.win.isDestroyed()?this.lastFocused:this.all()[0]);
 }
 focusedWindow():BrowserWindow|undefined{return this.focused()?.win;}
 of(win:BaseWindow):Browser|undefined{return this.list.find(b=>b.win===win&&!win.isDestroyed());}
 byContents(wc:WebContents):Browser|undefined{return this.list.find(b=>!b.win.isDestroyed()&&(b.win.webContents===wc||b.tabForContents(wc)||b.popupFor(wc)));}
 byTab(id:number):Browser|undefined{return this.list.find(b=>!b.win.isDestroyed()&&b.tabs.has(id));}
 tabForContents(wc:WebContents):Tab|undefined{return this.byContents(wc)?.tabForContents(wc);}
 async create(opts:{url?:string;incognito?:boolean;bounds?:Rectangle;inactive?:boolean}={}):Promise<Browser>{
  const {data,changed,httpsFirst,sessions,uiURL,preload}=this.deps;
  const restore=!this.all().length&&opts.url!==undefined&&data.state.tabs.length>0;
  const win=new BrowserWindow({width:1440,height:940,...opts.bounds,minWidth:900,minHeight:650,title:'Heisen',show:false,...windowChrome(),autoHideMenuBar:process.platform==='win32',backgroundColor:'#272727',...testWindowOptions(),webPreferences:{preload,nodeIntegration:false,contextIsolation:true,sandbox:true}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',(event,url)=>{if(url!==uiURL)event.preventDefault();});
  const browser=new Browser(win,data,changed,httpsFirst,sessions);browser.sidebar=data.state.settings.sidebarCollapsed?0:232;this.list.push(browser);
  win.on('focus',()=>{this.lastFocused=browser;});
  win.once('closed',()=>{this.list=this.list.filter(b=>b!==browser);if(this.lastFocused===browser)this.lastFocused=undefined;if(!this.deps.quitting())this.focused()?.save();changed();});
  try{
   this.deps.beforeShow(win);
   await win.loadURL(uiURL);if(win.isDestroyed())throw new Error('열린 창이 없습니다.');
   // Reopening from the tray/Dock/automation must consume the saved session before
   // creating a tab can overwrite it. A new URL is added to, not substituted for, it.
   if(restore)await browser.restore();
   if((opts.url!==undefined&&(!restore||opts.url!==HOME))||opts.incognito)await browser.create(opts.url??HOME,true,undefined,false,undefined,undefined,opts.incognito===true);
   if(win.isDestroyed())throw new Error('열린 창이 없습니다.');showWindow(win,opts.inactive);changed();return browser;
  }catch(error){if(!win.isDestroyed())win.destroy();throw error;}
 }
 async open(url?:string,opts:{inactive?:boolean}={}):Promise<Browser>{
  const browser=this.focused();if(!browser)return this.create({url:url??HOME,...opts});
  if(url!==undefined)await browser.create(url);
  if(browser.win.isDestroyed())throw new Error('열린 창이 없습니다.');
  if(!opts.inactive&&browser.win.isMinimized())browser.win.restore();showWindow(browser.win,opts.inactive);if(!opts.inactive)focusWindow(browser.win);return browser;
 }
 current():Browser{
  const caller=callerWindow(),browser=caller?this.of(caller):this.focused();
  if(!browser)throw new Error('열린 창이 없습니다.');return browser;
 }
}
export let windows:Windows;
export function setWindows(registry:Windows):void{windows=registry;}
