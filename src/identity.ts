import {app,type Session} from 'electron';
export function chromeUserAgent(chrome=process.versions.chrome):string{
 const major=String(chrome||'').split('.')[0]||'0';
 return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}
export function acceptLanguages(preferred:string[]):string{
 const out:string[]=[];
 for(const raw of preferred){const tag=String(raw).trim().replace(/_/g,'-');if(!/^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$/.test(tag))continue;for(const t of [tag,tag.split('-')[0].toLowerCase()])if(!out.some(o=>o.toLowerCase()===t.toLowerCase()))out.push(t);}
 return (out.length?out:['ko-KR','ko','en-US','en']).join(',');
}
export function applyIdentity(ses:Session):void{ses.setUserAgent(chromeUserAgent(),acceptLanguages(app.getPreferredSystemLanguages()));}
// Module top level on purpose: main.ts imports this statically, so it runs before app 'ready' and every WebContents (including popups) starts with the Chrome UA.
app.userAgentFallback=chromeUserAgent();
