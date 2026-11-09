import test from 'node:test';
import assert from 'node:assert/strict';
import {siteOf,crossSite,TRACKING_PARAMS,stripTracking,grantKey,cookieBlocked,pruneGrants,CLIENT_HINT_HEADERS,stripHeaders,trimReferrer} from '../src/privacy-util.ts';

const context:Parameters<typeof cookieBlocked>[0]={requestUrl:'https://tracker.test/pixel',topUrl:'https://www.example.com/page',policy:'block',grants:{},sites:{},now:1000};
test('sites use registrable domains, lowercase hosts and ignore scheme and port',()=>{
 assert.equal(siteOf('https://WWW.Example.COM:8443/path?q=x'),'example.com');
 assert.equal(siteOf('http://shop.a.co.uk/'),'a.co.uk');
 assert.equal(siteOf('https://a.co.uk/'),'a.co.uk');
 assert.equal(siteOf('https://user:secret@www.example.com/'),'example.com');
 assert.equal(siteOf('https://bücher.de/'),'xn--bcher-kva.de');
});
test('sites fall back to IPv4, IPv6, localhost and bare suffix hostnames',()=>{
 assert.equal(siteOf('http://127.0.0.1:3000/path'),'127.0.0.1');
 assert.equal(siteOf('http://[::1]:3000/path'),'[::1]');
 assert.equal(siteOf('http://LOCALHOST:3000/path'),'localhost');
 assert.equal(siteOf('https://co.uk/'),'co.uk');
});
test('sites reject invalid and non-HTTP URLs and missing context',()=>{
 for(const url of [undefined,null,'','example.com','/relative','https://','not a URL','file:///tmp/page','data:text/html,test','about:blank','heisen://home','ws://example.com/','ftp://example.com/'])assert.equal(siteOf(url),null,String(url));
});
test('party checks require two known distinct nonempty sites',()=>{
 assert.equal(crossSite('example.com','tracker.test'),true);
 assert.equal(crossSite('example.com','example.com'),false);
 for(const a of [null,''])for(const b of [null,'','example.com']){assert.equal(crossSite(a,b),false);assert.equal(crossSite(b,a),false);}
 assert.equal(crossSite(siteOf('http://a.example.com/'),siteOf('https://b.example.com:8443/')),false);
});
test('tracking removes all listed identifiers and any utm prefix case-insensitively',()=>{
 const names=[...TRACKING_PARAMS.map(name=>name.toUpperCase()),'utm_source','UtM_custom','utm_'];
 const url='https://example.com/path?keep=1&'+names.map(name=>`${name}=value`).join('&');
 assert.deepEqual(stripTracking(url),{url:'https://example.com/path?keep=1',removed:names});
 assert.ok(TRACKING_PARAMS.includes('gclid'));assert.ok(TRACKING_PARAMS.includes('fbclid'));assert.ok(TRACKING_PARAMS.includes('mc_eid'));
});
test('tracking preserves path, fragment and unrelated query values',()=>{
 const result=stripTracking('https://example.com/a%2Fb/page?gclid=1&q=hello%20world&keep=%26&fbclid=2#section%20one');
 const url=new URL(result.url);assert.equal(url.pathname,'/a%2Fb/page');assert.equal(url.hash,'#section%20one');
 assert.deepEqual([...url.searchParams],[['q','hello world'],['keep','&']]);assert.deepEqual(result.removed,['gclid','fbclid']);
});
test('tracking handles duplicate and adjacent names without skipping and is idempotent',()=>{
 const result=stripTracking('https://example.com/?gclid=1&gclid=2&fbclid=3&GCLID=4&keep=a&keep=b');
 assert.deepEqual(result,{url:'https://example.com/?keep=a&keep=b',removed:['gclid','fbclid','GCLID']});
 assert.deepEqual(stripTracking(result.url),{url:result.url,removed:[]});
});
test('tracking decodes names, removes empty identifiers and leaves no query delimiter',()=>{
 assert.deepEqual(stripTracking('https://example.com/?%67clid=&utm_source&mc_eid=x#anchor'),{url:'https://example.com/#anchor',removed:['gclid','utm_source','mc_eid']});
});
test('tracking leaves unmodified URLs byte-for-byte intact',()=>{
 for(const url of ['https://EXAMPLE.com:443/a?q=a%20b&x=~#hash','https://example.com?','https://example.com/?utm=1&not_utm_source=2&gclid_extra=3&constructor=4&__proto__=5','https://example.com/?q=gclid%3D1#utm_source=2'])assert.deepEqual(stripTracking(url),{url,removed:[]});
});
test('tracking leaves malformed and relative URLs intact',()=>{
 for(const url of ['not a URL','/path?gclid=1','https://?gclid=1',''])assert.deepEqual(stripTracking(url),{url,removed:[]});
});
test('cookie policy explicitly allows all requests',()=>{
 assert.equal(cookieBlocked({...context,policy:'allow'}),false);
});
test('cookies are allowed when either site context is unknown',()=>{
 for(const topUrl of [undefined,'','about:blank','invalid'])assert.equal(cookieBlocked({...context,topUrl}),false);
 for(const requestUrl of ['invalid','file:///tmp/page','data:text/plain,x'])assert.equal(cookieBlocked({...context,requestUrl}),false);
});
test('first-party cookies include subdomains, scheme changes and popup top URLs',()=>{
 for(const requestUrl of ['https://example.com/','http://cdn.example.com:8080/'])assert.equal(cookieBlocked({...context,requestUrl}),false);
 assert.equal(cookieBlocked({...context,topUrl:context.requestUrl}),false);
 assert.equal(cookieBlocked({...context,topUrl:'http://localhost:3000/',requestUrl:'http://localhost:4000/'}),false);
});
test('disabling top-site protection permits cross-site cookies',()=>{
 assert.equal(cookieBlocked({...context,sites:{'example.com':{protect:false}}}),false);
 assert.equal(cookieBlocked({...context,sites:{'example.com':{protect:true}}}),true);
 assert.equal(cookieBlocked({...context,sites:{'tracker.test':{protect:false}}}),true);
});
test('a future pair-specific storage grant permits cross-site cookies',()=>{
 assert.equal(grantKey('example.com','tracker.test'),'example.com|tracker.test');
 assert.equal(cookieBlocked({...context,grants:{[grantKey('example.com','tracker.test')]:1001}}),false);
 assert.equal(cookieBlocked({...context,grants:{[grantKey('tracker.test','example.com')]:1001}}),true);
 assert.equal(cookieBlocked({...context,grants:{[grantKey('elsewhere.test','tracker.test')]:1001}}),true);
});
test('cross-site cookies are blocked without a grant or at its expiry boundary',()=>{
 assert.equal(cookieBlocked(context),true);
 for(const expires of [0,999,1000])assert.equal(cookieBlocked({...context,grants:{'example.com|tracker.test':expires}}),true);
 assert.equal(cookieBlocked({...context,topUrl:'http://127.0.0.1/',requestUrl:'http://127.0.0.2/'}),true);
});
test('cookie decisions never mutate grants or site settings',()=>{
 const grants=Object.freeze({'example.com|tracker.test':1001}),sites=Object.freeze({'example.com':Object.freeze({protect:true})});
 assert.equal(cookieBlocked({...context,grants,sites}),false);
 assert.deepEqual(grants,{'example.com|tracker.test':1001});assert.deepEqual(sites,{'example.com':{protect:true}});
});
test('grant pruning retains only unexpired pairs without mutating the input',()=>{
 const grants=Object.freeze({'example.com|tracker.test':1001,'example.com|old.test':999,'example.com|due.test':1000});
 assert.deepEqual(pruneGrants(grants,1000),{'example.com|tracker.test':1001});assert.equal(Object.keys(grants).length,3);
 assert.deepEqual(pruneGrants(grants,1001),{});assert.deepEqual(pruneGrants({},1000),{});
});
test('high-entropy hints are removed while low-entropy hints and unrelated headers survive',()=>{
 const headers:Record<string,string>={'Sec-CH-UA':'browser','Sec-CH-UA-Mobile':'?0','Sec-CH-UA-Platform':'macOS',Accept:'text/html',Cookie:'session=value'};
 for(const name of CLIENT_HINT_HEADERS)headers[name.toUpperCase()]='value';
 const original={...headers},result=stripHeaders(Object.freeze(headers),CLIENT_HINT_HEADERS);
 assert.equal(result.removed,CLIENT_HINT_HEADERS.length);
 assert.deepEqual(result.headers,{'Sec-CH-UA':'browser','Sec-CH-UA-Mobile':'?0','Sec-CH-UA-Platform':'macOS',Accept:'text/html',Cookie:'session=value'});
 assert.deepEqual(headers,original);
});
test('header stripping matches either casing and counts actual removed keys',()=>{
 const headers={Cookie:'one',cookie:'two',COOKIE:'three',Accept:'text/html'};
 assert.deepEqual(stripHeaders(headers,['cOoKiE','COOKIE']),{headers:{Accept:'text/html'},removed:3});
 assert.deepEqual(stripHeaders({'Set-Cookie':'one','set-cookie':'two'},['SET-COOKIE']),{headers:{},removed:2});
});
test('header stripping leaves unmatched and empty records alone',()=>{
 const headers={Accept:'text/html',constructor:'value'};
 assert.deepEqual(stripHeaders(headers,CLIENT_HINT_HEADERS),{headers,removed:0});
 assert.deepEqual(stripHeaders(headers,[]),{headers,removed:0});assert.deepEqual(stripHeaders({},['cookie']),{headers:{},removed:0});
});
test('cross-site referrers lose path and query but retain scheme and port',()=>{
 assert.equal(trimReferrer('https://example.com/path?private=1#section','https://tracker.test/pixel'),'https://example.com/');
 assert.equal(trimReferrer('http://example.com:8080/?private=1','https://tracker.test/'),'http://example.com:8080/');
 assert.equal(trimReferrer('https://user:secret@example.com/path','https://tracker.test/'),'https://example.com/');
 assert.equal(trimReferrer('http://[::1]:3000/path','https://example.com/'),'http://[::1]:3000/');
});
test('same-site and already origin-only referrers remain unchanged',()=>{
 assert.equal(trimReferrer('https://a.example.com/private?q=1','http://b.example.com:8080/'),undefined);
 for(const referrer of ['https://example.com','https://example.com/','https://example.com/#anchor'])assert.equal(trimReferrer(referrer,'https://tracker.test/'),undefined);
});
test('referrer trimming ignores invalid or non-HTTP site contexts',()=>{
 for(const invalid of ['','not a URL','about:blank','file:///tmp/private','data:text/html,test']){
  assert.equal(trimReferrer(invalid,'https://tracker.test/'),undefined);
  assert.equal(trimReferrer('https://example.com/private?q=1',invalid),undefined);
 }
});
