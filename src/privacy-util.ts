import {getDomain} from 'tldts';

export function siteOf(url:string|undefined|null):string|null{
 if(!url)return null;
 try{const parsed=new URL(url);if(parsed.protocol!=='http:'&&parsed.protocol!=='https:')return null;const hostname=parsed.hostname.toLowerCase();return getDomain(hostname)??hostname;}catch{return null;}
}
export function crossSite(a:string|null,b:string|null):boolean{return !!a&&!!b&&a!==b;}
export const TRACKING_PARAMS:readonly string[]=['gclid','dclid','gbraid','wbraid','gclsrc','fbclid','msclkid','mc_eid','mc_cid','igshid','twclid','ttclid','yclid','_hsenc','_hsmi','__hssc','__hstc','__hsfp','hsCtaTracking','oly_anon_id','oly_enc_id','vero_id','wickedid','mkt_tok','_openstat','rb_clickid','s_cid','ml_subscriber','ml_subscriber_hash','srsltid','li_fat_id','_branch_match_id','sc_customer','sc_eh','ss_email_id','bsft_uid','bsft_clkid'];
const trackingParams:Record<string,true>=Object.fromEntries(TRACKING_PARAMS.map(name=>[name.toLowerCase(),true]));
export function stripTracking(url:string):{url:string;removed:string[]}{
 let parsed:URL;try{parsed=new URL(url);}catch{return {url,removed:[]};}
 const removed:string[]=[];
 // Collect names before deleting so consecutive and repeated parameters are not skipped.
 for(const name of new Set(parsed.searchParams.keys()))if(trackingParams[name.toLowerCase()]===true||/^utm_/i.test(name))removed.push(name);
 if(!removed.length)return {url,removed};
 for(const name of removed)parsed.searchParams.delete(name);
 return {url:parsed.href,removed};
}
export function grantKey(topSite:string,thirdSite:string):string{return `${topSite}|${thirdSite}`;}
export function cookieBlocked(c:{requestUrl:string;topUrl:string|undefined;policy:'block'|'allow';grants:Record<string,number>;sites:Record<string,{protect:boolean}>;now:number}):boolean{
 if(c.policy==='allow')return false;
 const top=siteOf(c.topUrl),req=siteOf(c.requestUrl);
 if(!top||!req||!crossSite(top,req)||c.sites[top]?.protect===false)return false;
 return !(c.grants[grantKey(top,req)]>c.now);
}
export function pruneGrants(g:Record<string,number>,now:number):Record<string,number>{return Object.fromEntries(Object.entries(g).filter(([,expires])=>expires>now));}
export const CLIENT_HINT_HEADERS:readonly string[]=['sec-ch-ua-arch','sec-ch-ua-bitness','sec-ch-ua-full-version','sec-ch-ua-full-version-list','sec-ch-ua-model','sec-ch-ua-platform-version','sec-ch-ua-wow64','sec-ch-ua-form-factors','sec-ch-device-memory','device-memory','dpr','viewport-width','viewport-height','width'];
export function stripHeaders(h:Record<string,string>,names:readonly string[]):{headers:Record<string,string>;removed:number}{
 const unwanted=new Set(names.map(name=>name.toLowerCase()));let headers:Record<string,string>|undefined,removed=0;
 for(const name of Object.keys(h))if(unwanted.has(name.toLowerCase())){headers??={...h};delete headers[name];removed++;}
 return {headers:headers??h,removed};
}
export function trimReferrer(referrer:string,requestUrl:string):string|undefined{
 if(!crossSite(siteOf(referrer),siteOf(requestUrl)))return undefined;
 const parsed=new URL(referrer);
 return parsed.pathname!=='/'||parsed.search?parsed.origin+'/':undefined;
}
