import {isIP} from 'node:net';
export const HOME='heisen://newtab';
const CREDENTIALS='인증 정보가 포함된 URL은 열 수 없습니다.';
// Schemes recognised without "//" (so "mailto:x" is a URL, not a search); only http(s) and the new tab page navigate.
const KNOWN_SCHEMES:Record<string,true>={http:true,https:true,heisen:true,about:true,blob:true,chrome:true,'chrome-extension':true,data:true,devtools:true,file:true,filesystem:true,ftp:true,javascript:true,mailto:true,sms:true,tel:true,'view-source':true,ws:true,wss:true};
const IPV4=/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
// host[:port][/?#rest] with no whitespace in the host part; [IPv6] hosts in brackets.
const HOST_INPUT=/^(\[[\da-f:.]+\]|[\p{L}\p{N}_-]+(?:\.[\p{L}\p{N}_-]+)*\.?)(?::(\d{1,5}))?([/?#].*)?$/iu;
export type Omnibox={url:string;fallback?:string};
// Chrome omnibox rules: explicit http(s) URLs, host:port, localhost, IPv4/[IPv6] and dotted host names navigate; everything else is a
// Google search. Hosts typed without a scheme open over http when local (localhost, IP, single label with a port); other hosts try
// https first and carry the original http URL for an explicit HTTPS-First interstitial, never a silent retry.
export function omnibox(value:string):Omnibox{
 const v=value.trim();if(v.toLowerCase()===HOME)return {url:HOME};
 const scheme=/^([a-z][a-z\d+.-]*):(\/\/)?/i.exec(v);
 if(scheme&&!HOST_INPUT.test(v)&&(scheme[2]||KNOWN_SCHEMES[scheme[1].toLowerCase()])){
  if(!/^https?$/i.test(scheme[1]))throw new Error('HTTP(S) 주소만 사용할 수 있습니다.');
  const u=new URL(v);if(u.username||u.password)throw new Error(CREDENTIALS);return {url:u.href};
 }
 if(/^[^\s/?#@]*:[^\s/?#@]*@[^\s/?#@]+/.test(v))throw new Error(CREDENTIALS);
 const m=HOST_INPUT.exec(v);
 if(m){
  const host=m[1].toLowerCase().replace(/\.$/,''),port=m[2],labels=host.split('.');
  const local=host.startsWith('[')||IPV4.test(host)||host==='localhost'||host.endsWith('.localhost')||(labels.length===1&&!!port);
  const named=labels.length>1&&/^([a-z]{2,}|xn--[a-z\d-]+)$/i.test(labels.at(-1)!);
  if(local||named){
   try{
    const u=new URL((local?'http://':'https://')+v);
    if(local)return {url:u.href};const http=new URL(u.href);http.protocol='http:';return {url:u.href,fallback:http.href};
   }catch{}
  }
 }
 return {url:'https://www.google.com/search?q='+encodeURIComponent(v)};
}
// URL.hostname retains IPv6 brackets; normalise DNS names before checking local-only exceptions.
export function upgradeHostExcluded(hostname:string):boolean{
 const host=hostname.toLowerCase().replace(/\.$/,'');
 return !!isIP(host.replace(/^\[|\]$/g,''))||!host.includes('.')||host.endsWith('.localhost')||host.endsWith('.local');
}
// Schemes handed to the OS (mailto, tel, zoommtg…). Web, local-file, script and browser-internal schemes never are.
const NOT_EXTERNAL:Record<string,true>={http:true,https:true,heisen:true,about:true,blob:true,chrome:true,'chrome-extension':true,'chrome-untrusted':true,'chrome-search':true,data:true,devtools:true,file:true,filesystem:true,javascript:true,vbscript:true,'view-source':true,ws:true,wss:true,ftp:true,intent:true,content:true};
export function externalScheme(url:string):string|null{
 const m=/^([a-z][a-z\d+.-]*):/i.exec(url);if(!m)return null;const s=m[1].toLowerCase();
 return NOT_EXTERNAL[s]?null:s;
}
// blob: URLs created by the page itself (same origin), e.g. a generated PDF opened by the site.
export function sameOriginBlob(url:string,page:string):boolean{
 if(!/^blob:https?:\/\//i.test(url))return false;
 try{const p=new URL(page);return (p.protocol==='http:'||p.protocol==='https:')&&new URL(url.slice(5)).origin===p.origin;}catch{return false;}
}
export const ZOOM_LEVELS=[0.25,0.33,0.5,0.67,0.75,0.8,0.9,1,1.1,1.25,1.5,1.75,2,2.5,3,4,5];
export function stepZoom(current:number,dir:'in'|'out'|'reset'):number{
 if(dir==='reset')return 1;
 const next=dir==='in'?ZOOM_LEVELS.find(z=>z>current+0.001):ZOOM_LEVELS.findLast(z=>z<current-0.001);
 return next??current;
}
export function zoomKey(url:string):string|undefined{
 try{const u=new URL(url);return u.protocol==='http:'||u.protocol==='https:'?u.hostname||undefined:undefined;}catch{return undefined;}
}
export function insertAfterOpener(order:number[],openerId:number|undefined,openerOf:(id:number)=>number|undefined):number{
 const at=openerId===undefined?-1:order.indexOf(openerId);if(at<0)return order.length;
 let i=at+1;while(i<order.length&&openerOf(order[i])===openerId)i++;return i;
}
export function shortcutIndex(n:number,count:number):number{
 if(n===9)return count-1;
 if(Number.isInteger(n)&&n>=1&&n<=8&&n-1<count)return n-1;
 return -1;
}
export function cycleIndex(current:number,count:number,delta:1|-1):number{
 if(count<=0)return -1;if(current<0||current>=count)return delta===1?0:count-1;
 return (current+delta+count)%count;
}
export function pushClosed<T>(stack:T[],item:T,max=25):T[]{return [...stack,item].slice(-Math.max(1,max));}
export function popupSize(features:string):{width:number;height:number}{
 const read=(name:string,fallback:number)=>{const m=new RegExp('(?:^|[,\\s])'+name+'\\s*=\\s*(\\d+)','i').exec(features);const v=m?Number(m[1]):NaN;return Number.isSafeInteger(v)&&v>=100?Math.min(v,4096):fallback;};
 return {width:read('width',500),height:read('height',650)};
}
// Popup origin strip (Chrome's read-only popup location bar), POPUP_STRIP px above the page view. It shows the page main frame's real origin,
// never page-chosen text: an opaque origin shows about:blank/about:srcdoc, its http(s) URL's origin (CSP sandbox) or only the scheme, because a
// data:/blob: URL body is written by the page. http origins get the toolbar's 주의 요함 warning; the window title is the origin alone.
export const POPUP_STRIP=28;
export function popupLabel(frameOrigin:string,url:string):{warning:string;origin:string}{
 let origin=frameOrigin;
 if(!origin||origin==='null'){
  const page=url||'about:blank',scheme=/^([a-z][a-z\d+.-]*):/i.exec(page)?.[1].toLowerCase();
  if(scheme==='about'&&/^about:(blank|srcdoc)(?=$|[?#])/i.test(page))origin=page.replace(/[?#].*$/,'').toLowerCase();
  else if(scheme==='http'||scheme==='https'){try{origin=new URL(page).origin;}catch{origin=scheme+':';}}
  else origin=scheme?scheme+':':'null';
 }
 return {warning:/^http:/i.test(origin)?'주의 요함 · ':'',origin};
}
// Static strip document: no script (the text arrives via executeJavaScript), no network. The origin elides on its left so a long host keeps
// its registrable end visible; the warning never elides.
export const popupStripHtml=`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>html,body{margin:0;height:100%;overflow:hidden;background:#303030}body{box-sizing:border-box;border-bottom:1px solid #3c3c3c;color:#e3e3e3;font:13px -apple-system,BlinkMacSystemFont,"Helvetica Neue","Apple SD Gothic Neo",sans-serif;cursor:default}#o{display:flex;align-items:center;height:100%;padding:0 10px;white-space:nowrap}#w{flex:none;white-space:pre}#t{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;direction:rtl}</style><div id="o"><span id="w"></span><span id="t"><bdi dir="ltr" id="v"></bdi></span></div>`;
// Chrome's choice after closing the active tab: its nearest child (right first), else the nearest tab with the same opener,
// else the opener, else the right neighbour, else the left one.
export function closeSelection(order:number[],closing:number,openerOf:(id:number)=>number|undefined):number|undefined{
 const i=order.indexOf(closing);if(i<0)return undefined;
 const near=(opener:number)=>{for(let j=i+1;j<order.length;j++)if(openerOf(order[j])===opener)return order[j];for(let j=i-1;j>=0;j--)if(openerOf(order[j])===opener)return order[j];return undefined;};
 const child=near(closing);if(child!==undefined)return child;
 const opener=openerOf(closing);if(opener!==undefined&&order.includes(opener))return near(opener)??opener;
 return order[i+1]??order[i-1];
}
// Moves id to index while pinned tabs stay before unpinned ones: a pinned tab is clamped into the pinned group, an unpinned one after it.
export function moveTab(order:number[],id:number,index:number,isPinned:(id:number)=>boolean):number[]{
 const rest=order.filter(k=>k!==id);if(rest.length===order.length)return order;
 const pins=rest.filter(isPinned).length,pinned=isPinned(id);
 rest.splice(Math.max(pinned?0:pins,Math.min(pinned?pins:rest.length,Math.trunc(index)||0)),0,id);return rest;
}
// Chrome's unique download name: "name (1).ext", keeping two-part archive extensions such as ".tar.gz" together.
export function uniqueFilename(name:string,taken:(name:string)=>boolean):string{
 if(!taken(name))return name;
 const dot=/(\.tar)?\.[^.]{1,12}$/i.exec(name),at=dot&&dot.index>0?dot.index:name.length,stem=name.slice(0,at),ext=name.slice(at);
 for(let n=1;;n++){const next=`${stem} (${n})${ext}`;if(!taken(next))return next;}
}
// Chrome's com.apple.quarantine value for a downloaded file: flags 0083, download time as hex Unix seconds, agent name, event UUID.
export function quarantineValue(ms:number,uuid:string):string{return `0083;${Math.floor(ms/1000).toString(16)};Heisen;${uuid.toUpperCase()}`;}
// Binary property list (bplist00) with one array of strings, the format of the com.apple.metadata:kMDItemWhereFroms attribute.
export function stringArrayPlist(items:string[]):Buffer{
 // Object header: type nibble with the length inline below 15, else 0xF followed by an int object (1, 2 or 4 bytes, big-endian).
 const head=(type:number,n:number)=>n<15?Buffer.from([type|n]):Buffer.from([type|15,...n<256?[0x10,n]:n<65536?[0x11,n>>8,n&255]:[0x12,n>>>24,(n>>16)&255,(n>>8)&255,n&255]]);
 const refSize=items.length<255?1:2;
 const string=(s:string)=>{if(/^[\x00-\x7f]*$/.test(s))return Buffer.concat([head(0x50,s.length),Buffer.from(s,'ascii')]);const utf16=Buffer.from(s,'utf16le').swap16();return Buffer.concat([head(0x60,utf16.length/2),utf16]);};
 const objects=[Buffer.concat([head(0xa0,items.length),...items.map((_,i)=>refSize===1?Buffer.from([i+1]):Buffer.from([(i+1)>>8,(i+1)&255]))]),...items.map(string)];
 let end=8;const offsets=objects.map(o=>{const at=end;end+=o.length;return at;});
 const size=end<256?1:end<65536?2:4,table=Buffer.alloc(offsets.length*size);offsets.forEach((o,i)=>table.writeUIntBE(o,i*size,size));
 const trailer=Buffer.alloc(32);trailer[6]=size;trailer[7]=refSize;trailer.writeBigUInt64BE(BigInt(objects.length),8);trailer.writeBigUInt64BE(BigInt(end),24);
 return Buffer.concat([Buffer.from('bplist00','ascii'),...objects,table,trailer]);
}
