// Two-finger history swipe from DOM wheel events (page-preload.ts → gestures.ts). No DOM or Electron here so it stays unit-testable.
// One gesture = the run of finger (non-momentum) wheel events. Its axis is decided once from the first SWIPE_LOCK px, so cross-axis jitter
// never cancels it; vertical gestures, pinch (ctrlKey) and horizontal scrollers that can still move that way are left to the page.
// The gesture ends at the first momentum event (lifted with a fling) or after SWIPE_GAP ms without events (lifted at rest);
// momentum events never start or feed a swipe, so the fling after a completed swipe cannot navigate again.
// SWIPE_THRESHOLD: finger travel (CSS px of wheel delta) that commits. Recorded macOS trackpad swipes travel ~200–600 px before lifting;
// short flicks stay well under it.
export const SWIPE_THRESHOLD=140,SWIPE_LOCK=8,SWIPE_GAP=120,SWIPE_RATIO=1.5;
export type SwipeMessage={phase:'update'|'end'|'cancel';dx:number};
export type SwipeWheel={deltaX:number;deltaY:number;ctrlKey:boolean;momentum:boolean};
export class SwipeTracker {
 private mode:'idle'|'track'|'swipe'|'skip'='idle';private sx=0;private sy=0;
 /** Finger travel so far, positive = back (fingers moving right). */
 dx=0;
 get active(){return this.mode!=='idle';}
 /** `canScrollX(deltaX)`: whether a scroller under the pointer can still move by deltaX. */
 wheel(e:SwipeWheel,canScrollX:(deltaX:number)=>boolean):SwipeMessage|undefined{
  if(e.momentum)return this.quiet();
  if(e.ctrlKey){const msg=this.mode==='swipe'?{phase:'cancel' as const,dx:this.dx}:undefined;this.mode='skip';this.dx=0;return msg;}
  if(this.mode==='idle'){this.mode='track';this.sx=0;this.sy=0;this.dx=0;}
  if(this.mode==='skip')return;
  if(this.mode==='track'){
   this.sx+=e.deltaX;this.sy+=e.deltaY;
   if(Math.max(Math.abs(this.sx),Math.abs(this.sy))<SWIPE_LOCK)return;
   if(Math.abs(this.sx)<=SWIPE_RATIO*Math.abs(this.sy)||canScrollX(this.sx)){this.mode='skip';return;}
   this.mode='swipe';this.dx=-this.sx;
  }else this.dx-=e.deltaX;
  return {phase:'update',dx:this.dx};
 }
 /** Gesture over (gap timer or momentum): reports the swipe's final travel, if one was tracking. */
 quiet():SwipeMessage|undefined{const msg=this.mode==='swipe'?{phase:'end' as const,dx:this.dx}:undefined;this.mode='idle';this.dx=0;return msg;}
}
