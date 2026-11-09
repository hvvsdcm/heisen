import test from 'node:test';
import assert from 'node:assert/strict';
import {between,typingDelay,mousePath,keyFor,KEYS} from '../src/input.ts';
import {pageScript,snapshotScript} from '../src/page-scripts.ts';
import {SwipeTracker,SWIPE_THRESHOLD,type SwipeMessage} from '../src/swipe.ts';
const fixed=(v:number)=>()=>v;
test('typingDelay follows clamp(8000/len,12,140) × 0.6–1.4',()=>{
 assert.equal(typingDelay(14,fixed(0)),140*0.6);assert.equal(typingDelay(14,fixed(1)),140*1.4);
 assert.equal(typingDelay(100,fixed(0.5)),80);assert.equal(typingDelay(10000,fixed(0)),12*0.6);assert.equal(typingDelay(0,fixed(0.5)),140);
 for(let i=0;i<200;i++){const d=typingDelay(400);assert.ok(d>=12&&d<=28,String(d));}
});
test('between stays in range',()=>{assert.equal(between(45,110,fixed(0)),45);assert.equal(between(45,110,fixed(1)),110);for(let i=0;i<100;i++){const v=between(8,16);assert.ok(v>=8&&v<=16);}});
test('mousePath ends exactly at target and stays near the segment',()=>{
 const from={x:10,y:20},to={x:410,y:320},dist=Math.hypot(400,300);
 for(const steps of [6,9,12]){const path=mousePath(from,to,steps);assert.equal(path.length,steps);assert.deepEqual(path.at(-1),to);
  for(const p of path){assert.ok(p.x>=from.x-dist*0.25&&p.x<=to.x+dist*0.25&&p.y>=from.y-dist*0.25&&p.y<=to.y+dist*0.25,JSON.stringify(p));}
  const d=path.map(p=>Math.hypot(p.x-to.x,p.y-to.y));assert.ok(d[0]>d.at(-2)!);}
 assert.deepEqual(mousePath(to,to,6,fixed(0.5)),Array.from({length:6},()=>to));
});
test('keyFor maps printable ASCII to US keys and leaves the rest to insertText',()=>{
 assert.deepEqual(keyFor('a'),{key:'a',code:'KeyA',keyCode:65,shift:false,unshifted:'a'});
 assert.deepEqual(keyFor('Z'),{key:'Z',code:'KeyZ',keyCode:90,shift:true,unshifted:'z'});
 assert.deepEqual(keyFor('7'),{key:'7',code:'Digit7',keyCode:55,shift:false,unshifted:'7'});
 assert.deepEqual(keyFor('!'),{key:'!',code:'Digit1',keyCode:49,shift:true,unshifted:'1'});
 assert.deepEqual(keyFor(' '),{key:' ',code:'Space',keyCode:32,shift:false,unshifted:' '});
 assert.deepEqual(keyFor('?'),{key:'?',code:'Slash',keyCode:191,shift:true,unshifted:'/'});
 assert.equal(keyFor('"')?.code,'Quote');assert.equal(keyFor('~')?.code,'Backquote');
 for(let c=0x20;c<0x7f;c++)assert.ok(keyFor(String.fromCharCode(c)),String.fromCharCode(c));
 for(const ch of ['한','é','\n','\t','😀'])assert.equal(keyFor(ch),undefined);
});
test('KEYS carry virtual key codes and only Enter/Space type text',()=>{
 assert.equal(KEYS.Enter.keyCode,13);assert.equal(KEYS.Tab.keyCode,9);assert.equal(KEYS.Escape.keyCode,27);assert.equal(KEYS.PageDown.keyCode,34);
 assert.deepEqual(Object.entries(KEYS).filter(([,k])=>k.text).map(([n])=>n).sort(),['Enter','Space']);
});
test('pageScript serializes a self-contained call',()=>{
 const call=pageScript((a:{x:number})=>a.x,{x:1});assert.ok(call.endsWith(')({"x":1})'));assert.equal(new Function('return '+call)(),1);
 assert.match(pageScript(snapshotScript),/^\(function snapshotScript\(\)/);assert.ok(pageScript(snapshotScript).endsWith(')()'));
});
// Swipe deltas are recorded macOS trackpad wheel events (deltaX < 0 = fingers moving right = back) from xiel/wheel-gestures' fixtures (MIT).
type Wheel=[deltaX:number,deltaY?:number,flag?:'momentum'|'ctrl'];
function feed(events:Wheel[],canScrollX=(_dx:number)=>false){
 const t=new SwipeTracker(),out:SwipeMessage[]=[];
 for(const [deltaX,deltaY=0,flag] of events){const m=t.wheel({deltaX,deltaY,ctrlKey:flag==='ctrl',momentum:flag==='momentum'},canScrollX);if(m)out.push(m);}
 const end=t.quiet();if(end)out.push(end);return out;
}
const SWIPE_RIGHT=[-1,-7,-8,-11,-24,-12,-29,-24,-28,-52],MOMENTUM=[-54,-83,-83,-84,-84,-82,-82,-75,-72,-67,-59,-54,-49,-45,-41];
test('SwipeTracker: finger travel commits at the first momentum event; the fling never adds or ends twice',()=>{
 const out=feed([...SWIPE_RIGHT.map(x=>[x] as Wheel),...MOMENTUM.map(x=>[x,0,'momentum'] as Wheel)]),travel=-SWIPE_RIGHT.reduce((a,b)=>a+b,0);
 assert.deepEqual(out.filter(m=>m.phase!=='update'),[{phase:'end',dx:travel}]);assert.ok(travel>=SWIPE_THRESHOLD,String(travel));
 const updates=out.filter(m=>m.phase==='update').map(m=>m.dx);assert.ok(updates.every((dx,i)=>i===0||dx>=updates[i-1]),String(updates));
 assert.deepEqual(feed(SWIPE_RIGHT.map(x=>[-x] as Wheel)).at(-1),{phase:'end',dx:-travel},'mirrored swipe goes forward; lifted at rest ends on quiet()');
});
test('SwipeTracker: cross-axis jitter after the axis lock never cancels a slow drag',()=>{
 const slow:Wheel[]=[[-1],[-2],[-2],[-2],[-2],[-2,0],[-3],[-3],[-4,-1],...Array.from({length:40},(_,i)=>[i%3?-4:-1,i%2?-1:1] as Wheel),[-1,-1],[-1,1]];
 const out=feed(slow);assert.ok(out.every(m=>m.phase!=='cancel'));assert.deepEqual(out.at(-1),{phase:'end',dx:-slow.reduce((a,[x])=>a+x,0)});
});
test('SwipeTracker: short flick, vertical scroll, pinch and horizontal scrollers do not swipe',()=>{
 const flick=feed([[-1],[-4],[-5],[-13],[-25],[-39],[-24,0,'momentum'],[-52,0,'momentum'],[-56,0,'momentum']]);
 assert.ok(flick.at(-1)!.dx<SWIPE_THRESHOLD&&flick.at(-1)!.phase==='end',JSON.stringify(flick.at(-1)));
 assert.deepEqual(feed([[0,-1],[0,-2],[1,-9],[0,-12],[-30,-20],[-80,0],[-90,0]]),[],'gesture locked vertical stays vertical');
 assert.deepEqual(feed([[-20],[-20,0,'ctrl'],[-40],[-40]]).map(m=>m.phase),['update','cancel'],'pinch cancels and the rest of the gesture is ignored');
 assert.deepEqual(feed([[-20],[-60],[-60]],dx=>dx<0),[],'a scroller that can move left keeps the gesture');
 assert.equal(feed([[-20],[-60]],dx=>dx>0).at(-1)?.phase,'end','a scroller at its left edge does not');
 assert.deepEqual(feed(MOMENTUM.map(x=>[x,0,'momentum'] as Wheel)),[],'momentum alone never starts a swipe');
});
