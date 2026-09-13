import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrollDelta, watchFormViewport } from './form-viewport.js';

test('field reveal includes both viewport edges without moving a visible field', () => {
  assert.equal(scrollDelta({top:20,bottom:68},90,250),-70);
  assert.equal(scrollDelta({top:240,bottom:288},90,250),38);
  assert.equal(scrollDelta({top:100,bottom:148},90,250),0);
  assert.equal(scrollDelta({top:90,bottom:250},90,250),0);
  // A large field aligns its start rather than scrolling its beginning away.
  assert.equal(scrollDelta({top:140,bottom:540},90,250),50);
});

function setup({width=844,height=844,visible=240,modal=true,role=null}={}) {
  const win=new EventTarget(), viewport=new EventTarget(), surface=new EventTarget();
  const values=new Map(), frames=new Map(), timers=new Map(); let sequence=0, documentScroll=0, mutationCallback, errorNode=null;
  Object.assign(viewport,{height:visible,offsetTop:0,scale:1});
  Object.assign(win,{
    visualViewport:viewport,innerHeight:height,innerWidth:width,
    requestAnimationFrame:fn=>{frames.set(++sequence,fn);return sequence;},
    cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:fn=>{timers.set(++sequence,fn);return sequence;},
    clearTimeout:id=>timers.delete(id),
    scrollBy:({top})=>{documentScroll+=top;},
    getComputedStyle:node=>({position:surface.dataset.viewportCompact==='true'?'static':node.position}),
    MutationObserver:class { constructor(callback){mutationCallback=callback;} observe(){} disconnect(){mutationCallback=null;} },
  });
  const rect=()=>({top:600-(modal?surface.scrollTop:documentScroll),bottom:648-(modal?surface.scrollTop:documentScroll),height:48});
  const field={matches:selector=>selector!=='button',getBoundingClientRect:rect,closest:selector=>selector==='.field'?{getBoundingClientRect:()=>({...rect(),top:rect().top-30,height:78})}:null};
  Object.assign(surface,{
    ownerDocument:{defaultView:win,activeElement:field},dataset:{},scrollTop:0,
    getAttribute:name=>name==='role'?role:null,
    style:{getPropertyValue:key=>values.get(key)||'',setProperty:(key,value)=>values.set(key,value)},
    contains:node=>node===field,
    getBoundingClientRect:()=>{const top=parseFloat(values.get('--modal-viewport-top'))||0;const h=surface.dataset.viewportFullscreen==='true'?viewport.height:Math.min(500,parseFloat(values.get('--modal-max-height'))||500);return {top,bottom:top+h,height:h};},
    querySelector:selector=>selector==='.toast.error'?errorNode:{position:'sticky',getBoundingClientRect:()=>({height:selector==='.modal-head'?90:77})},
    querySelectorAll:()=>[],
  });
  const flush=()=>{for(const [id,fn] of [...frames]){frames.delete(id);fn();}};
  const stop=watchFormViewport(surface,{modal});
  const addError=()=>{
    errorNode={isConnected:true,contains:()=>false,getBoundingClientRect:()=>({top:668-surface.scrollTop,bottom:713-surface.scrollTop,height:45})};
    mutationCallback?.([{target:surface,addedNodes:[errorNode]}]);return errorNode;
  };
  const focus=()=>{const event=new Event('focusin');Object.defineProperty(event,'target',{value:field});surface.dispatchEvent(event);};
  const settle=()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn();}flush();};
  return {win,viewport,surface,values,frames,timers,flush,stop,rect,addError,focus,settle};
}
test('landscape phone fits the visual viewport and releases sticky controls', () => {
  const f=setup();f.flush();
  assert.equal(f.surface.dataset.viewportFullscreen,'true');
  assert.equal(f.surface.dataset.viewportCompact,'true');
  assert.equal(f.surface.getBoundingClientRect().bottom,240);
  assert.ok(f.rect().bottom<=224);assert.ok(f.rect().top>=12);f.stop();
});
test('tablet keyboard keeps fields clear of sticky header and footer', () => {
  const f=setup({width:768,height:1024,visible:420});f.flush();
  assert.equal(f.surface.dataset.viewportCompact,'true');
  assert.ok(f.rect().top>=12);assert.ok(f.rect().bottom<=404);f.stop();
});
test('desktop dialog is centered within the visual viewport, not the layout viewport', () => {
  const f=setup({width:1440,height:1000,visible:600});f.flush();
  assert.equal(f.surface.dataset.viewportFullscreen,'false');
  assert.equal(f.surface.getBoundingClientRect().top,50);
  assert.ok(f.surface.getBoundingClientRect().bottom<=600);f.stop();
});

test('confirmation stays inset on phones and short screens, then restores full-screen forms', () => {
  for (const visible of [740, 320]) {
    const f=setup({width:360,height:740,visible,role:'alertdialog'});f.flush();
    assert.equal(f.surface.dataset.viewportFullscreen,'false');
    assert.ok(f.surface.getBoundingClientRect().top>=32);
    assert.ok(f.surface.getBoundingClientRect().bottom<=visible-32);
    f.surface.getAttribute=()=>null;
    f.win.dispatchEvent(new Event('resize'));f.flush();
    assert.equal(f.surface.dataset.viewportFullscreen,'true');
    f.stop();
  }
});
test('login gains scroll room for a visual-only keyboard and releases it when closed', () => {
  const f=setup({modal:false,visible:240});f.flush();
  assert.equal(f.values.get('--keyboard-inset'),'604px');
  assert.ok(f.rect().bottom<=220);
  f.viewport.height=844;f.viewport.dispatchEvent(new Event('resize'));f.flush();
  assert.equal(f.values.get('--keyboard-inset'),'0px');f.stop();
});
test('viewport panning follows its offset without fighting manual scrolling', () => {
  const f=setup();f.flush();f.surface.scrollTop=0;
  f.viewport.offsetTop=36;f.viewport.dispatchEvent(new Event('scroll'));f.flush();
  assert.equal(f.surface.getBoundingClientRect().top,36);
  assert.equal(f.surface.scrollTop,0);f.stop();
});
test('closing a surface cancels pending work and removes resize/focus listeners', () => {
  const f=setup();assert.equal(f.frames.size,1);f.stop();assert.equal(f.frames.size,0);
  f.viewport.dispatchEvent(new Event('resize'));f.win.dispatchEvent(new Event('resize'));f.surface.dispatchEvent(new Event('focusin'));
  assert.equal(f.frames.size,0);
});
test('browsers without VisualViewport use the window size', () => {
  const f=setup();f.stop();f.win.visualViewport=undefined;
  const stop=watchFormViewport(f.surface,{modal:true});f.flush();
  assert.equal(f.values.get('--modal-viewport-height'),'844px');stop();
});
test('an error inserted below the active field becomes visible with that field', () => {
  const f=setup();f.flush();const error=f.addError();f.flush();
  assert.ok(error.getBoundingClientRect().bottom<=224);
  assert.ok(f.rect().top>=12);f.stop();
});

test('focus is revealed again after the browser adjusts scrolling late', () => {
  const f=setup();f.flush();f.focus();f.flush();
  // Native keyboard/focus scrolling can land after the first resize frame.
  f.surface.scrollTop=0;f.settle();
  assert.ok(f.rect().bottom<=224);f.stop();
});

test('manual scrolling cancels delayed focus corrections', () => {
  const f=setup();f.flush();f.focus();f.flush();
  f.surface.dispatchEvent(new Event('touchmove'));
  f.surface.scrollTop=0;f.settle();
  assert.equal(f.surface.scrollTop,0);f.stop();
});

test('closing cancels keyboard settle timers', () => {
  const f=setup();f.focus();assert.ok(f.timers.size>0);
  f.stop();assert.equal(f.timers.size,0);
});

test('autofocus before viewport watcher installation receives settling checks', () => {
  const f=setup();f.flush();
  f.surface.scrollTop=0;f.settle();
  assert.ok(f.rect().bottom<=224);f.stop();
});
