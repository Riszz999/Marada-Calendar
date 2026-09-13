import test from 'node:test';
import assert from 'node:assert/strict';
import { watchStaffSession } from './session-watch.js';

const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function setup(check) {
  let now=0, next=0, expired=0, token='original';
  const timers=new Map(), target=new EventTarget(), page=new EventTarget();
  page.visibilityState='visible';
  const stop=watchStaffSession({check,getToken:()=>token,onExpired:()=>expired++,target,page,
    setTimer:(fn,delay)=>{timers.set(++next,{fn,at:now+delay});return next;},clearTimer:id=>timers.delete(id)});
  return {stop,target,page,timers,setToken:value=>token=value,get expired(){return expired;},
    async advance(ms){now+=ms;for(const [id,timer] of [...timers]) if(timer.at<=now){timers.delete(id);timer.fn();}await flush();}};
}
test('idle staff is expelled on the next one-second verification after revocation',async()=>{
  let level='staff'; const s=setup(async()=>({level})); await flush();
  level='guest'; await s.advance(999); assert.equal(s.expired,0);
  await s.advance(1); assert.equal(s.expired,1); assert.equal(s.timers.size,0); s.stop();
});
test('focus and resume check immediately; requests do not overlap',async()=>{
  let resolve,calls=0; const s=setup(()=>{calls++;return new Promise(r=>resolve=r);});
  s.target.dispatchEvent(new Event('focus'));assert.equal(calls,1);
  resolve({level:'staff'});await flush();
  s.page.dispatchEvent(new Event('visibilitychange'));assert.equal(calls,2);
  resolve({level:'guest'});await flush();assert.equal(s.expired,1);s.stop();
});
test('network failure hides staff data, while teardown ignores delayed replies',async()=>{
  const lost=setup(async()=>{throw new Error('offline');});await flush();assert.equal(lost.expired,1);lost.stop();
  let resolve;const late=setup(()=>new Promise(r=>resolve=r));late.stop();resolve({level:'guest'});await flush();
  assert.equal(late.expired,0);assert.equal(late.timers.size,0);
});
test('an old in-flight check cannot invalidate a replacement token',async()=>{
  let resolve;const s=setup(()=>new Promise(r=>resolve=r));s.setToken('replacement');
  resolve({level:'guest'});await flush();assert.equal(s.expired,0);s.stop();
});
