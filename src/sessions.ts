import {app,BrowserWindow,dialog,session,type BaseWindow,type DownloadItem,type Session,type WebContents} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {Data} from './data.ts';
import type {SafeBrowsing} from './safebrowsing.ts';
import {uniqueFilename} from './browser-util.ts';
import {dangerousName,type DownloadRow} from './downloads-guard.ts';
import {markDownloaded} from './platform.ts';

export type PendingLoad={urls:Set<string>;wake?:()=>void};
type PendingDownload={file:string;target:string;froms:string[];ask:boolean;finished:boolean;approved:boolean;choosing:boolean;moving?:Promise<void>;parent:BrowserWindow|null};
// Profile-wide hooks and download state are shared by every browser window.
export class Sessions {
 readonly session:Session;incognitoSession?:Session;downloads:DownloadRow[]=[];
 private sessionSetups=new Set<(ses:Session)=>void>();
 // Explicit saveAs requests always ask; ordinary downloads follow settings.downloads.askWhere.
 readonly askWhere=new Set<string>();readonly reserved=new Set<string>();
 private items=new Map<string,DownloadItem>();private pendingDownloads=new Map<string,PendingDownload>();
 // Page loads in progress and the first URLs of downloads they turned into.
 readonly navDownloads=new WeakMap<WebContents,PendingLoad>();
 readonly externalPermissions=new WeakMap<Session,Set<string>>();readonly popupSessions=new WeakMap<BaseWindow,Session>();
 constructor(private data:Data,private changed:()=>void,public readonly safeBrowsing:SafeBrowsing){
  const holding=path.join(data.root,'downloads-pending');fs.rmSync(holding,{recursive:true,force:true});fs.mkdirSync(holding,{recursive:true,mode:0o700});
  app.on('before-quit',()=>{for(const item of this.items.values())item.cancel();this.items.clear();this.pendingDownloads.clear();fs.rmSync(holding,{recursive:true,force:true});});
  this.session=session.fromPartition('persist:browser');this.setupSession(this.session);
  this.configureSessions(ses=>ses.registerPreloadScript({type:'frame',id:'heisen-page',filePath:path.join(app.getAppPath(),'dist','page-preload.cjs'),matches:['http://*/*','https://*/*']}));
 }
 configureSessions(setup:(ses:Session)=>void){if(this.sessionSetups.has(setup))return;this.sessionSetups.add(setup);setup(this.session);if(this.incognitoSession)setup(this.incognitoSession);}
 private setupSession(ses:Session){
  for(const setup of this.sessionSetups)setup(ses);
  ses.on('will-download',(_event,item,source)=>{
   const name=path.basename(item.getFilename()||'download'),first=item.getURLChain()[0]??item.getURL();
   const danger=dangerousName(name)?'type':this.safeBrowsing.check(new URL(first).hostname).listed?'site':undefined;
   const row:DownloadRow={id:randomUUID(),name,url:item.getURL(),received:0,total:item.getTotalBytes(),state:danger?'dangerous':'progressing',path:'',incognito:ses!==this.session,at:Date.now(),danger};this.downloads.unshift(row);
   let target='';
   const nav=this.navDownloads.get(source);if(nav){nav.urls.add(first);nav.wake?.();}
   // Chrome's kMDItemWhereFroms: the download URL, then the page it came from.
   const froms=[item.getURL(),source.isDestroyed()?'':source.getURL()].filter((u,i,all)=>/^https?:/i.test(u)&&all.indexOf(u)===i);
   const ask=this.askWhere.delete(first)||this.data.state.settings.downloads.askWhere;
   const dir=app.getPath('downloads');fs.mkdirSync(dir,{recursive:true});
   const suggested=path.join(dir,uniqueFilename(name,n=>this.reserved.has(path.join(dir,n))||fs.existsSync(path.join(dir,n))));
   if(danger){
    const holding=path.join(this.data.root,'downloads-pending',row.id);fs.mkdirSync(holding,{recursive:true,mode:0o700});
    const pending:PendingDownload={file:path.join(holding,name),target:suggested,froms,ask,finished:false,approved:false,choosing:false,parent:BrowserWindow.fromWebContents(source)};
    this.pendingDownloads.set(row.id,pending);this.reserved.add(suggested);this.items.set(row.id,item);
    item.setSavePath(pending.file);item.pause();
   }else if(ask)item.setSaveDialogOptions({defaultPath:suggested});
   else{target=suggested;this.reserved.add(target);item.setSavePath(target);}
   item.on('updated',()=>{row.received=item.getReceivedBytes();row.total=item.getTotalBytes();this.changed();});
   item.once('done',(_e,state)=>{
    this.items.delete(row.id);const file=item.getSavePath(),pending=this.pendingDownloads.get(row.id);
    if(danger){
     if(!pending)return;
     if(state==='completed'){
      // A small response can finish despite pause(); it stays private until explicit consent.
      pending.finished=true;if(pending.approved)void this.releaseDownload(row,pending).catch(e=>console.error('Download release failed',e));else this.changed();
     }else{this.pendingDownloads.delete(row.id);this.reserved.delete(pending.target);fs.rmSync(path.dirname(pending.file),{recursive:true,force:true});row.state=state;this.changed();}
     return;
    }
    this.reserved.delete(target);
    const finish=()=>{row.state=state;row.path=file;this.changed();};
    if(state==='completed'&&file)void markDownloaded(file,froms).finally(finish);else finish();
   });this.changed();
  });
 }
 async keep(id:string){
  const pending=this.pendingDownloads.get(id),row=this.downloads.find(d=>d.id===id);
  if(!pending||pending.choosing||pending.approved||row?.state!=='dangerous')return false;
  pending.choosing=true;
  try{
   if(pending.ask){
    const options={defaultPath:pending.target},parent=pending.parent,answer=await (parent&&!parent.isDestroyed()?dialog.showSaveDialog(parent,options):dialog.showSaveDialog(options));
    if(answer.canceled||!answer.filePath||this.pendingDownloads.get(id)!==pending)return false;
    this.reserved.delete(pending.target);pending.target=answer.filePath;this.reserved.add(pending.target);
   }
   pending.approved=true;row.state='progressing';
   if(pending.finished)await this.releaseDownload(row,pending);else this.items.get(id)?.resume();
   this.changed();return true;
  }finally{pending.choosing=false;}
 }
 discard(id:string){
  const pending=this.pendingDownloads.get(id);if(!pending||pending.approved)return false;
  this.pendingDownloads.delete(id);this.items.get(id)?.cancel();this.items.delete(id);this.reserved.delete(pending.target);
  fs.rmSync(path.dirname(pending.file),{recursive:true,force:true});this.downloads=this.downloads.filter(d=>d.id!==id);this.changed();return true;
 }
 private releaseDownload(row:DownloadRow,pending:PendingDownload):Promise<void>{
  if(pending.moving)return pending.moving;
  pending.moving=(async()=>{
   try{
    if(!pending.ask){
     this.reserved.delete(pending.target);const dir=path.dirname(pending.target);
     pending.target=path.join(dir,uniqueFilename(row.name,n=>this.reserved.has(path.join(dir,n))||fs.existsSync(path.join(dir,n))));this.reserved.add(pending.target);
     // Linking then unlinking moves without overwriting a concurrently created destination.
     try{await fs.promises.link(pending.file,pending.target);}catch(error){if((error as NodeJS.ErrnoException).code!=='EXDEV')throw error;await fs.promises.copyFile(pending.file,pending.target,fs.constants.COPYFILE_EXCL);}
     await fs.promises.unlink(pending.file);
    }else{
     try{await fs.promises.rename(pending.file,pending.target);}catch(error){if((error as NodeJS.ErrnoException).code!=='EXDEV')throw error;await fs.promises.copyFile(pending.file,pending.target);await fs.promises.unlink(pending.file);}
    }
    await markDownloaded(pending.target,pending.froms);row.path=pending.target;row.state='completed';
   }catch(error){row.state='interrupted';throw error;}
   finally{this.pendingDownloads.delete(row.id);this.reserved.delete(pending.target);await fs.promises.rm(path.dirname(pending.file),{recursive:true,force:true});this.changed();}
  })();return pending.moving;
 }
 privateSession(){if(!this.incognitoSession){this.incognitoSession=session.fromPartition('incognito-'+randomUUID());this.setupSession(this.incognitoSession);}return this.incognitoSession;}
 clearIncognito(hasIncognitoTabs:()=>boolean,popups:Set<BaseWindow>){
  if(!this.incognitoSession||hasIncognitoTabs())return;
  const ses=this.incognitoSession;this.incognitoSession=undefined;
  for(const popup of [...popups])if(this.popupSessions.get(popup)===ses&&!popup.isDestroyed())popup.destroy();
  for(const row of [...this.downloads])if(row.incognito)this.discard(row.id);
  this.downloads=this.downloads.filter(d=>!d.incognito);
  void Promise.all([ses.clearStorageData(),ses.clearCache()]).catch(e=>console.error('Incognito cleanup failed',e));
 }
}
