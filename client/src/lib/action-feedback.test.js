import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionFeedback } from './action-feedback.js';

function setup(options = {}) {
  let now = 0, closed = 0, state, sequence = 0;
  const timers = new Map();
  const action = createActionFeedback({
    ...options,
    onChange: next => { state = next; },
    onClose: () => closed++,
    setTimer: (fn, delay) => { timers.set(++sequence, { fn, at: now + delay }); return sequence; },
    clearTimer: id => timers.delete(id),
  });
  const advance = ms => {
    now += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= now) { timers.delete(id); timer.fn(); }
    }
  };
  return { action, advance, get state() { return state; }, get closed() { return closed; }, timers };
}

test('closes two seconds after success, not after starting the request', () => {
  const s = setup();
  s.action.begin(); s.advance(5000); assert.equal(s.closed, 0);
  s.action.succeed('Saved'); s.advance(1999); assert.equal(s.closed, 0);
  s.advance(1); assert.equal(s.closed, 1);
});
test('blocks duplicate actions while pending and while displaying success', () => {
  const s = setup();
  assert.equal(s.action.begin(), true); assert.equal(s.action.begin(), false);
  s.action.succeed('Saved'); assert.equal(s.action.begin(), false);
  s.action.succeed('Saved again'); s.advance(2000); assert.equal(s.closed, 1);
});
test('failure keeps the window open and allows a retry', () => {
  const s = setup();
  s.action.begin(); s.action.fail(); s.advance(5000);
  assert.equal(s.closed, 0); assert.equal(s.state.phase, 'idle');
  assert.equal(s.action.begin(), true);
});
test('unmount cancels closing and ignores a late successful response', () => {
  const s = setup();
  s.action.begin(); s.action.succeed('Saved'); s.action.dispose(); s.advance(2000);
  assert.equal(s.closed, 0);
  const late = setup();
  late.action.begin(); late.action.dispose(); late.action.succeed('Saved');
  assert.equal(late.timers.size, 0);
});
test('copying a newly saved key replaces the save timer with its own success hold', () => {
  const s = setup();
  s.action.begin('save'); s.action.succeed('Saved'); s.advance(1000);
  assert.equal(s.action.begin('copy', true), true);
  s.advance(3000); assert.equal(s.closed, 0);
  s.action.succeed('Copied', 'success'); s.advance(1999); assert.equal(s.closed, 0);
  s.advance(1); assert.equal(s.closed, 1);
});

test('persistent staff-code feedback resets after two seconds and permits repeat actions', () => {
  const s = setup({ closeOnSuccess: false });
  for (const action of ['save', 'copy', 'copy', 'save', 'clear']) {
    assert.equal(s.action.begin(action), true);
    s.action.succeed('Done');
    s.advance(1999);
    assert.equal(s.state.phase, 'success');
    assert.equal(s.closed, 0);
    s.advance(1);
    assert.equal(s.state.phase, 'idle');
    assert.equal(s.closed, 0);
  }
});

test('persistent copy can replace save feedback without closing or resetting during the request', () => {
  const s = setup({ closeOnSuccess: false });
  s.action.begin('save'); s.action.succeed('Saved'); s.advance(1000);
  assert.equal(s.action.begin('copy', true), true);
  s.advance(3000);
  assert.equal(s.state.phase, 'pending');
  s.action.succeed('Copied', 'success'); s.advance(2000);
  assert.equal(s.state.phase, 'idle');
  assert.equal(s.closed, 0);
});
