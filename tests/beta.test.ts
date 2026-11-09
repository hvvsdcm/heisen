import test from 'node:test';
import assert from 'node:assert/strict';
import {BETA_SERVER,GRACE_MS,betaMessage,betaServer,callbackParams,decide,pkcePair,type BetaSession} from '../src/beta-util.ts';
test('pkcePair: RFC 7636 appendix B vector and fresh 43-character pairs',()=>{
  const verifier='dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
  assert.deepEqual(pkcePair(Buffer.from(verifier,'base64url')),{verifier,challenge:'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'});
  const a=pkcePair(),b=pkcePair();assert.equal(a.verifier.length,43);assert.equal(a.challenge.length,43);assert.match(a.verifier,/^[\w-]{43}$/);assert.notEqual(a.verifier,b.verifier);
});
test('callbackParams: wrong path, state mismatch, error, code and empty responses',()=>{
  const state='s'.repeat(22),callback='/callback';
  for(const url of ['/','/favicon.ico','/callback/','/callbacks?code=x&state='+state,'/auth/app/complete?code=x&state='+state,'http://127.0.0.1/callback?code=x&state='+state,'//other/callback?state='+state])assert.equal(callbackParams(url,state),null,url);
  assert.deepEqual(callbackParams(callback+'?code=hac_x&state=other',state),{error:'state_mismatch'});
  assert.deepEqual(callbackParams(callback+'?code=hac_x',state),{error:'state_mismatch'});
  assert.deepEqual(callbackParams(callback+'?error=access_denied&state='+state,state),{error:'access_denied'});
  assert.deepEqual(callbackParams(callback+'?error=&code=hac_x&state='+state,state),{error:''});
  assert.deepEqual(callbackParams(callback+'?code=hac_x&state='+state,state),{code:'hac_x'});
  assert.deepEqual(callbackParams(callback+'?state='+state,state),{error:'invalid_response'});
  assert.deepEqual(callbackParams(callback+'?code=&state='+state,state),{error:'invalid_response'});
});
test('decide: signed out, expired, invite, active within grace, offline after grace',()=>{
  const now=1_800_000_000_000,s:BetaSession={token:'hsb_x',email:'a@example.com',admitted:true,verifiedAt:now-1000,expiresAt:now+86400000};
  assert.equal(decide(undefined,now),'signed_out');
  assert.equal(decide({...s,expiresAt:now},now),'signed_out');
  assert.equal(decide({...s,admitted:false},now),'invite');
  assert.equal(decide(s,now),'active');assert.equal(decide({...s,verifiedAt:now-GRACE_MS},now),'active');
  assert.equal(decide({...s,verifiedAt:now-GRACE_MS-1},now),'offline');
});
test('betaServer: release packages ignore the environment; dev and test builds honour HEISEN_BETA_URL',()=>{
  const release={url:BETA_SERVER,skip:false};
  assert.deepEqual(betaServer({},false,false),release);
  for(const v of ['skip','http://127.0.0.1:9','ftp://x'])assert.deepEqual(betaServer({HEISEN_BETA_URL:v},true,false),release,v);
  assert.deepEqual(betaServer({HEISEN_BETA_URL:'skip'},false,false),{url:BETA_SERVER,skip:true});
  assert.deepEqual(betaServer({HEISEN_BETA_URL:'skip'},true,true),{url:BETA_SERVER,skip:true});
  assert.deepEqual(betaServer({HEISEN_BETA_URL:'http://localhost:8787/some/path?x=1'},false,false),{url:'http://localhost:8787',skip:false});
  assert.deepEqual(betaServer({HEISEN_BETA_URL:'https://staging.heisen.dev'},true,true),{url:'https://staging.heisen.dev',skip:false});
  assert.throws(()=>betaServer({HEISEN_BETA_URL:'not a url'},false,false));
  assert.throws(()=>betaServer({HEISEN_BETA_URL:'file:///tmp/x'},false,false),/http\(s\)/);
});
test('betaMessage maps server codes and falls back for unknown ones',()=>{
  assert.equal(betaMessage('invalid_code'),'초대 코드가 올바르지 않습니다.');assert.equal(betaMessage('network'),'서버에 연결할 수 없습니다. 인터넷 연결을 확인하세요.');
  assert.equal(betaMessage('login_failed'),betaMessage('invalid_grant'));
  for(const code of ['nope','toString','__proto__'])assert.equal(betaMessage(code),'오류가 발생했습니다. 다시 시도하세요.');
});
