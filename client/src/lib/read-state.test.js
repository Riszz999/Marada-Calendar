import test from 'node:test';
import assert from 'node:assert/strict';
import { beginRead, readPhase, validateRead } from './read-state.js';

test('initial and scope changes remain loading until valid data is available',()=>{
  assert.equal(readPhase({},'admin:active'),'loading');
  const pending=beginRead({},'admin:active');
  assert.equal(readPhase(pending,'admin:active'),'loading');
  const ready={key:'admin:active',data:{items:[]},fetching:false,error:false};
  assert.equal(readPhase(ready,'admin:active'),'ready');
  assert.equal(readPhase(ready,'staff:active'),'loading');
  assert.equal(beginRead(ready,'staff:active').data,null);
  assert.equal(beginRead(ready,'admin:history').data,null);
});
test('background refresh retains content, explicit invalidation must hide the old record',()=>{
  const old={key:'admin:active',data:{items:[{status:'pending'}]},error:false,fetching:false};
  const refresh=beginRead(old,'admin:active');
  assert.equal(refresh.data,old.data);
  assert.equal(readPhase(refresh,'admin:active'),'refreshing');
  const invalidated=beginRead(refresh,'admin:active',true);
  assert.equal(invalidated.data,null);
  assert.equal(readPhase(invalidated,'admin:active'),'loading');
  assert.equal(beginRead(invalidated,'admin:active').data,null);
  assert.equal(readPhase({...invalidated,error:true,fetching:false},'admin:active'),'error');
  assert.equal(readPhase(beginRead({...invalidated,error:true},'admin:active'),'admin:active'),'loading');
});
test('responses must match their contract; missing payload is never an empty successful list',()=>{
  for(const kind of ['reservations','list','summary','users','staffKey']) {
    for(const data of [null,undefined,{},'',42]) assert.throws(()=>validateRead(kind,data),/invalid_response/);
  }
  assert.deepEqual(validateRead('reservations',[]),[]);
  assert.deepEqual(validateRead('users',[]),[]);
  assert.equal(validateRead('list',{items:[],total:0,page:1,pageSize:30}).total,0);
  assert.throws(()=>validateRead('list',{total:0,page:1,pageSize:30}),/invalid_response/);
  assert.throws(()=>validateRead('summary',{total:0}),/invalid_response/);
  assert.equal(validateRead('summary',{total:0,days:[]}).total,0);
  assert.equal(validateRead('staffKey',{configured:false,key:null,updatedAt:null}).configured,false);
  assert.equal(validateRead('staffKey',{configured:true,key:null,updatedAt:'2026-09-06'}).configured,true);
  assert.throws(()=>validateRead('staffKey',{configured:true}),/invalid_response/);
});
