import test from 'node:test';
import assert from 'node:assert/strict';
import { withReadTimeout } from './read-timeout.js';

test('stalled reads abort and external cancellation propagates', async () => {
  const stalled=signal=>new Promise((resolve,reject)=>{
    if(signal.aborted) reject(new Error('aborted'));
    else signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});
  });
  await assert.rejects(withReadTimeout(stalled,undefined,10),/aborted/);
  const outer=new AbortController();
  const pending=withReadTimeout(stalled,outer.signal,1000);
  outer.abort();
  await assert.rejects(pending,/aborted/);
  await assert.rejects(withReadTimeout(stalled,outer.signal),/aborted/);
});
test('successful reads clear timeout without aborting completed work', async()=>{
  let observed;
  assert.equal(await withReadTimeout(async signal=>{observed=signal;return 'ok';},undefined,10),'ok');
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(observed.aborted,false);
});
