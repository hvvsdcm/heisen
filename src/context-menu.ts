import {Menu,clipboard,type BaseWindow,type WebContents} from 'electron';
type Item=Electron.MenuItemConstructorOptions;
// saveAs downloads through the save dialog; plain downloads go straight to the Downloads folder.
export type ContextMenuDeps={win:BaseWindow;openTab:(url:string,active:boolean)=>void;search:(text:string)=>void;saveAs:(url:string)=>void};
export function contextMenuTemplate(wc:WebContents,p:Electron.ContextMenuParams,deps:ContextMenuDeps):Item[]{
 const groups:Item[][]=[],f=p.editFlags,selection=p.selectionText.replace(/\s+/g,' ').trim(),link=/^https?:\/\//i.test(p.linkURL),image=p.mediaType==='image'&&!!p.srcURL;
 if(p.misspelledWord)groups.push(p.dictionarySuggestions.length?p.dictionarySuggestions.map((s,i)=>({id:'ctx-spell-'+i,label:s,click:()=>wc.replaceMisspelling(s)})):[{id:'ctx-spell-none',label:'추천 단어 없음',enabled:false}]);
 if(link)groups.push([{id:'ctx-link-open',label:'새 탭에서 링크 열기',click:()=>deps.openTab(p.linkURL,false)},{id:'ctx-link-copy',label:'링크 주소 복사',click:()=>clipboard.writeText(p.linkURL)},{id:'ctx-link-save',label:'다른 이름으로 링크 저장…',click:()=>deps.saveAs(p.linkURL)}]);
 if(image)groups.push([{id:'ctx-image-open',label:'새 탭에서 이미지 열기',enabled:/^https?:\/\//i.test(p.srcURL),click:()=>deps.openTab(p.srcURL,false)},{id:'ctx-image-save',label:'다른 이름으로 이미지 저장…',click:()=>deps.saveAs(p.srcURL)},{id:'ctx-image-copy',label:'이미지 복사',click:()=>wc.copyImageAt(p.x,p.y)},{id:'ctx-image-copy-url',label:'이미지 주소 복사',click:()=>clipboard.writeText(p.srcURL)}]);
 if(p.isEditable)groups.push([{id:'ctx-undo',label:'실행 취소',enabled:f.canUndo,click:()=>wc.undo()},{id:'ctx-redo',label:'다시 실행',enabled:f.canRedo,click:()=>wc.redo()},{type:'separator'},{id:'ctx-cut',label:'잘라내기',enabled:f.canCut,click:()=>wc.cut()},{id:'ctx-copy',label:'복사',enabled:f.canCopy,click:()=>wc.copy()},{id:'ctx-paste',label:'붙여넣기',enabled:f.canPaste,click:()=>wc.paste()},{id:'ctx-paste-match',label:'붙여넣고 스타일 일치',enabled:f.canPaste&&f.canEditRichly,click:()=>wc.pasteAndMatchStyle()},{id:'ctx-select-all',label:'모두 선택',enabled:f.canSelectAll,click:()=>wc.selectAll()}]);
 else if(selection)groups.push([{id:'ctx-selection-copy',label:'복사',click:()=>wc.copy()},{id:'ctx-search',label:`Google에서 "${selection.length>20?selection.slice(0,20)+'…':selection}" 검색`,click:()=>deps.search(selection)}]);
 if(!link&&!image&&!p.isEditable&&!selection){const h=wc.navigationHistory;groups.push([{id:'ctx-back',label:'뒤로',enabled:h.canGoBack(),click:()=>h.goBack()},{id:'ctx-forward',label:'앞으로',enabled:h.canGoForward(),click:()=>h.goForward()},{id:'ctx-reload',label:'새로고침',click:()=>wc.reload()},{type:'separator'},{id:'ctx-print',label:'인쇄…',click:()=>wc.print({},()=>{})}]);}
 groups.push([{id:'ctx-inspect',label:'검사',click:()=>{if(!wc.isDevToolsOpened())wc.openDevTools({mode:'detach'});wc.inspectElement(p.x,p.y);}}]);
 return groups.flatMap((g,i)=>i?[{type:'separator'} as Item,...g]:g);
}
export function attachContextMenu(wc:WebContents,deps:ContextMenuDeps):void{
 wc.on('context-menu',(_e,p)=>{if(deps.win.isDestroyed()||wc.isDestroyed())return;Menu.buildFromTemplate(contextMenuTemplate(wc,p,deps)).popup({window:deps.win});});
}
