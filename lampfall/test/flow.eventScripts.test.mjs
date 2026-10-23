// Unit tests for js/systems/flow/eventScripts.js (bus event -> world.pendingScript). [SCN-UI lane]
// Run: node --test test/flow.eventScripts.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/systems/flow/eventScripts.js';
import { createNewWorld, validateWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA } from '../js/data/index.js';

const scripts = { 'wren-tier3': ['Wren: Three.'], 'badge-moss': ['Moss.'], 'beat-2': ['Two.'], 'again': ['Again.'], 'rainy': ['Rain.'], 'first': ['First.'], 'second': ['Second.'] };
const tables = (rows) => ({ scripts, eventScripts: rows });
const world = () => createNewWorld({ seedCode: 'FLOW-EVT' });

describe('parseEvent / rowMatches', () => {
  it('splits a row event into the domain event and its values', () => {
    assert.deepEqual(E.parseEvent('loan:tier:3'), { base: 'loan:tier', values: ['3'] });
    assert.deepEqual(E.parseEvent('loan:tier'), { base: 'loan:tier', values: [] });
    assert.deepEqual(E.parseEvent('thread:beat:wren-tally:2'), { base: 'thread:beat', values: ['wren-tally', '2'] });
    assert.deepEqual(E.parseEvent('letters:late-delivery'), { base: 'letters:late-delivery', values: [] });
    assert.deepEqual(E.parseEvent('mystery:thing:x'), { base: 'mystery:thing', values: ['x'] }, 'unknown events: first two segments');
  });

  it('matches values against the payload scalars', () => {
    assert.equal(E.rowMatches({ event: 'loan:tier:3' }, 'loan:tier', { tier: 3, prev: 2 }), true);
    assert.equal(E.rowMatches({ event: 'loan:tier:3' }, 'loan:tier', { tier: 4, prev: 3 }), false, 'the tier reached, not the one left');
    assert.equal(E.rowMatches({ event: 'loan:tier:3' }, 'loan:tier', { tier: 5, prev: 4 }), false);
    assert.equal(E.rowMatches({ event: 'loan:tier:3' }, 'loan:paid', { tier: 3 }), false, 'other event');
    assert.equal(E.rowMatches({ event: 'badge:won:moss-spire' }, 'badge:won', { spireId: 'moss-spire' }), true);
    assert.equal(E.rowMatches({ event: 'thread:beat:wren-tally:2' }, 'thread:beat', { threadId: 'wren-tally', beat: 2 }), true);
    assert.equal(E.rowMatches({ event: 'thread:beat:wren-tally:2' }, 'thread:beat', { threadId: 'wren-tally', beat: 3 }), false);
    assert.equal(E.rowMatches({ event: 'day:start' }, 'day:start', null), true, 'no values: always');
  });
});

describe('scriptFor', () => {
  it('first matching row in data order with a known script', () => {
    const data = tables([
      { id: 'a', event: 'loan:tier:3', script: 'missing' },
      { id: 'b', event: 'loan:tier:3', script: 'wren-tier3' },
      { id: 'c', event: 'loan:tier', script: 'again' },
    ]);
    const w = world();
    assert.equal(E.scriptFor(w, data, 'loan:tier', { tier: 3 }), 'wren-tier3');
    assert.equal(E.scriptFor(w, data, 'loan:tier', { tier: 6 }), 'again');
    assert.equal(E.scriptFor(w, data, 'loan:paid', { amount: 5 }), null);
  });

  it('once-only rows skip a seen script; once:false repeats', () => {
    const data = tables([{ id: 'a', event: 'day:start', script: 'first' }, { id: 'b', event: 'day:start', script: 'again', once: false }]);
    const w = world();
    w.flags['seen.first'] = true;
    w.flags['seen.again'] = true;
    assert.equal(E.scriptFor(w, data, 'day:start', {}), 'again');
  });

  it('cond must hold; a script already pending is not queued twice', () => {
    const data = tables([{ id: 'a', event: 'weather:change', script: 'rainy', cond: { flag: 'sp.ready' } }]);
    const w = world();
    assert.equal(E.scriptFor(w, data, 'weather:change', { kind: 'rain' }), null);
    w.flags['sp.ready'] = true;
    assert.equal(E.scriptFor(w, data, 'weather:change', { kind: 'rain' }), 'rainy');
    w.pendingScript = 'rainy';
    assert.equal(E.scriptFor(w, data, 'weather:change', { kind: 'rain' }), null);
  });

  it('listenedEvents lists base events once, in data order', () => {
    const data = tables([{ event: 'loan:tier:3', script: 'x' }, { event: 'badge:won', script: 'y' }, { event: 'loan:tier:5', script: 'z' }]);
    assert.deepEqual(E.listenedEvents(data), ['loan:tier', 'badge:won']);
    assert.deepEqual(E.listenedEvents(null), []);
  });
});

describe('the pending slot', () => {
  it('queue / peek / take, with a backlog behind the pending one', () => {
    const w = world();
    assert.deepEqual(E.queue(w, 'first'), { queued: true, where: 'pending' });
    assert.deepEqual(E.queue(w, 'first'), { queued: false, where: null }, 'same id twice');
    assert.deepEqual(E.queue(w, 'second'), { queued: true, where: 'backlog' });
    assert.equal(E.peekPending(w), 'first');
    assert.deepEqual(E.backlog(w), ['second']);
    assert.equal(E.takePending(w), 'first');
    assert.equal(w.pendingScript, 'second', 'the backlog moves up');
    assert.equal(E.takePending(w), 'second');
    assert.equal(w.pendingScript, null);
    assert.equal(E.takePending(w), null);
    assert.deepEqual(E.queue(w, ''), { queued: false, where: null });
    assert.deepEqual(validateWorld(w), []);
  });

  it('bookmarks a cutscene position as JSON and clears it', () => {
    const w = world();
    const state = { pc: [3, 1, 0], vars: { _choice: 1 }, callStack: [], top: null, seq: 4 };
    E.bookmarkCutscene(w, 'arrival', state);
    state.pc.push(9);
    assert.deepEqual(E.cutsceneBookmark(w), { scriptId: 'arrival', state: { pc: [3, 1, 0], vars: { _choice: 1 }, callStack: [], top: null, seq: 4 } }, 'a copy');
    assert.deepEqual(validateWorld(w), []);
    E.clearCutscene(w);
    assert.equal(E.cutsceneBookmark(w), null);
    E.bookmarkCutscene(w, '', state);
    assert.equal(w.cutscene, null, 'no id, no bookmark');
  });
});

describe('install / runPending with a game context', () => {
  function fakeG(dataTables) {
    const store = createStore(world());
    const pushed = [];
    const G = {
      store, bus: store.bus, get world() { return store.world; },
      data: dataTables ?? createRegistry(DATA),
      sceneFactories: { cutscene: () => ({}) },
      scenes: { find: () => null },
      push: (name, params) => pushed.push([name, params]),
    };
    return { G, pushed };
  }

  it('a matching bus event queues its script inside a transaction', () => {
    const { G } = fakeG();
    const txs = [];
    G.bus.on('tx', (p) => txs.push(p.label));
    const off = E.install(G);
    G.bus.emit('loan:tier', { tier: 3, prev: 2 });
    assert.equal(G.world.pendingScript, null, 'placeholder row is loan:tier:2');
    G.bus.emit('loan:tier', { tier: 2, prev: 1 });
    assert.equal(G.world.pendingScript, 'ph-beat-1');
    assert.ok(txs.some((l) => l.startsWith('eventScript:')), 'through store.tx');
    off();
    G.store.tx('t', (w) => E.takePending(w));
    G.bus.emit('loan:tier', { tier: 2, prev: 1 });
    assert.equal(G.world.pendingScript, null, 'unsubscribed');
  });

  it('runPending resumes a bookmark first, else plays the pending script', () => {
    const { G, pushed } = fakeG();
    assert.equal(E.runPending(G), false);
    G.store.tx('q', (w) => E.queue(w, 'ph-intro'));
    assert.equal(E.runPending(G), true);
    assert.deepEqual(pushed.at(-1), ['cutscene', { scriptId: 'ph-intro' }]);
    assert.equal(G.world.pendingScript, null);
    G.store.tx('b', (w) => E.bookmarkCutscene(w, 'ph-arrival', { pc: [1], vars: {}, callStack: [], top: null, seq: 1 }));
    G.store.tx('q', (w) => E.queue(w, 'ph-remind'));
    assert.equal(E.runPending(G), true);
    assert.deepEqual(pushed.at(-1), ['cutscene', { resume: true }]);
    assert.equal(G.world.pendingScript, 'ph-remind', 'pending waits for the resumed cutscene');
  });

  it('a bookmark naming a script the data lost is dropped', () => {
    const { G, pushed } = fakeG();
    G.store.tx('b', (w) => E.bookmarkCutscene(w, 'gone-script', { pc: [0], vars: {}, callStack: [], top: null, seq: 0 }));
    assert.equal(E.runPending(G), false);
    assert.equal(G.world.cutscene, null);
    assert.equal(pushed.length, 0);
  });
});
