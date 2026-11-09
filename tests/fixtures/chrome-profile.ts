import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {deriveKey,encryptV10} from '../../src/chromium-crypto.ts';
// Values written into the fake profile so reader tests can assert exact results.
export const CHROME_FIXTURE={
  login:{path:'/login',username:'alice',password:'s3cret-pw'},
  blacklistedUser:'blocked',androidUser:'droid',
  cookie:{name:'sid',value:'encrypted-cookie-value'},
  plainCookie:{name:'theme',value:'dark'},
  partitionedCookie:{name:'embed',value:'partitioned-value'},
  expiredCookie:{name:'old',value:'expired-value'},
};
// Chrome stores times as microseconds since 1601-01-01; these exceed 2^53, so they are bound as BigInt.
const chromeTime=(ms:number)=>BigInt(ms)*1000n+11644473600000000n;
export function makeChromeProfile(root:string,opts:{password:string;host:string}):{appSupport:string;profile:string}{
  const browserRoot=path.join(root,'Google','Chrome'),profile=path.join(browserRoot,'Default'),key=deriveKey(opts.password),{host}=opts,f=CHROME_FIXTURE;
  const future=chromeTime(Date.now()+86400000),past=chromeTime(Date.now()-86400000),now=chromeTime(Date.now());
  fs.mkdirSync(profile,{recursive:true});
  fs.writeFileSync(path.join(browserRoot,'Local State'),JSON.stringify({profile:{info_cache:{Default:{name:'사용자 1'}}}}));
  fs.writeFileSync(path.join(profile,'Preferences'),'{}');

  const logins=new DatabaseSync(path.join(profile,'Login Data'));
  logins.exec('CREATE TABLE logins (origin_url VARCHAR NOT NULL, action_url VARCHAR, username_element VARCHAR, username_value VARCHAR, password_element VARCHAR, password_value BLOB, submit_element VARCHAR, signon_realm VARCHAR NOT NULL, date_created INTEGER NOT NULL, blacklisted_by_user INTEGER NOT NULL, scheme INTEGER NOT NULL)');
  const login=logins.prepare('INSERT INTO logins VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  login.run(`https://${host}${f.login.path}`,`https://${host}/session`,'username',f.login.username,'password',encryptV10(f.login.password,key),'',`https://${host}/`,now,0,0);
  login.run(`https://${host}/`,'','',f.blacklistedUser,'',Buffer.alloc(0),'',`https://${host}/`,now,1,0);
  login.run('android://hash@com.example.app/','','',f.androidUser,'',encryptV10('android-pw',key),'','android://hash@com.example.app/',now,0,0);
  logins.close();

  const cookies=new DatabaseSync(path.join(profile,'Cookies'));
  cookies.exec(`CREATE TABLE meta(key LONGVARCHAR NOT NULL UNIQUE PRIMARY KEY, value LONGVARCHAR);
INSERT INTO meta VALUES ('version',24),('last_compatible_version',24);
CREATE TABLE cookies(creation_utc INTEGER NOT NULL, host_key TEXT NOT NULL, top_frame_site_key TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL, encrypted_value BLOB NOT NULL, path TEXT NOT NULL, expires_utc INTEGER NOT NULL, is_secure INTEGER NOT NULL, is_httponly INTEGER NOT NULL, last_access_utc INTEGER NOT NULL, has_expires INTEGER NOT NULL, is_persistent INTEGER NOT NULL, priority INTEGER NOT NULL, samesite INTEGER NOT NULL, source_scheme INTEGER NOT NULL, source_port INTEGER NOT NULL, last_update_utc INTEGER NOT NULL, source_type INTEGER NOT NULL, has_cross_site_ancestor INTEGER NOT NULL)`);
  const cookie=cookies.prepare('INSERT INTO cookies VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  // meta.version >= 24: plaintext is SHA256(host_key) followed by the cookie value.
  const encrypted=(hostKey:string,value:string)=>encryptV10(Buffer.concat([createHash('sha256').update(hostKey).digest(),Buffer.from(value)]),key);
  const domainHost='.'+host;
  cookie.run(now,domainHost,'',f.cookie.name,'',encrypted(domainHost,f.cookie.value),'/',future,1,1,now,1,1,1,1,2,443,now,0,0);
  cookie.run(now,host,'',f.plainCookie.name,f.plainCookie.value,Buffer.alloc(0),'/',0n,0,0,now,0,0,1,-1,1,80,now,0,0);
  cookie.run(now,domainHost,`https://embedder.test`,f.partitionedCookie.name,'',encrypted(domainHost,f.partitionedCookie.value),'/',future,1,0,now,1,1,1,0,2,443,now,0,1);
  cookie.run(now,host,'',f.expiredCookie.name,'',encrypted(host,f.expiredCookie.value),'/',past,1,0,now,1,1,1,2,2,443,now,0,0);
  cookies.close();

  const bookmarks={checksum:'',roots:{
    bookmark_bar:{children:[
      {id:'2',name:'Example',type:'url',url:`https://${host}/`,date_added:String(now)},
      {id:'3',name:'폴더',type:'folder',date_added:String(now),children:[
        {id:'4',name:'Docs',type:'url',url:`https://${host}/docs`,date_added:String(now)},
        {id:'5',name:'하위 폴더',type:'folder',date_added:String(now),children:[{id:'6',name:'Deep',type:'url',url:'https://deep.example/',date_added:String(now)}]},
        {id:'7',name:'Script',type:'url',url:'javascript:alert(1)',date_added:String(now)},
      ]},
    ],id:'1',name:'북마크바',type:'folder'},
    other:{children:[{id:'9',name:'Example again',type:'url',url:`https://${host}/`,date_added:String(now)},{id:'10',name:'Settings',type:'url',url:'chrome://settings/',date_added:String(now)}],id:'8',name:'기타 북마크',type:'folder'},
    synced:{children:[{id:'12',name:'Mobile',type:'url',url:'http://mobile.example/',date_added:String(now)}],id:'11',name:'모바일 북마크',type:'folder'},
  },version:1};
  fs.writeFileSync(path.join(profile,'Bookmarks'),JSON.stringify(bookmarks,null,3));

  const history=new DatabaseSync(path.join(profile,'History'));
  history.exec('CREATE TABLE urls(id INTEGER PRIMARY KEY AUTOINCREMENT, url LONGVARCHAR, title LONGVARCHAR, visit_count INTEGER DEFAULT 0 NOT NULL, typed_count INTEGER DEFAULT 0 NOT NULL, last_visit_time INTEGER NOT NULL, hidden INTEGER DEFAULT 0 NOT NULL)');
  const url=history.prepare('INSERT INTO urls(url,title,visit_count,typed_count,last_visit_time,hidden) VALUES (?,?,?,?,?,?)');
  url.run(`https://${host}/older`,'Older',1,0,past,0);
  url.run(`https://${host}/newer`,'Newer',3,1,now,0);
  url.run(`https://${host}/hidden`,'Hidden',1,0,now,1);
  history.close();
  return {appSupport:root,profile};
}
