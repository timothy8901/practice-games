// js/script/cond.js: the condition DSL (§6.4) — evaluation per key, static validation, flag discovery.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { evalCond, validateCond, flagsReadBy, COND_KEYS } from '../js/script/cond.js';
import { createNewWorld } from '../js/state/schema.js';
import { encodeSeedCode } from '../js/core/rng.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA } from '../js/data/index.js';
import * as sel from '../js/state/selectors.js';

const data = createRegistry(DATA);

/** Fresh world at day `d`, minute-of-day `m`. */
function worldAt(m = 10 * 60, d = 0) {
  const w = createNewWorld({ seedCode: encodeSeedCode({ dial: 'FLUX', seed: 7, toggles: [] }) });
  w.clock.total = d * 1440 + m;
  return w;
}
const ev = (w, c, ctx = {}) => evalCond(w, c, { data, ...ctx });

test('COND_KEYS lists every §6.4 key', () => {
  for (const k of ['flag', 'not', 'all', 'any', 'counter', 'hasItem', 'wallet', 'hour', 'phase', 'tide', 'lowTide', 'day',
    'weather', 'loan', 'badge', 'letter', 'thread', 'npc', 'party', 'fieldLog', 'map', 'inRegion', 'dial', 'challenge', 'seen', 'tool']) {
    assert.ok(COND_KEYS.includes(k), k);
  }
});

test('booleans, null/undefined (always holds), combinators', () => {
  const w = worldAt();
  assert.equal(ev(w, true), true);
  assert.equal(ev(w, false), false);
  assert.equal(ev(w, undefined), true);
  assert.equal(ev(w, null), true);
  assert.equal(ev(w, { not: false }), true);
  assert.equal(ev(w, { all: [true, { not: false }] }), true);
  assert.equal(ev(w, { all: [true, false] }), false);
  assert.equal(ev(w, { any: [false, true] }), true);
  assert.equal(ev(w, { any: [] }), false);
  assert.equal(ev(w, { all: [] }), true);
});

test('flag (truthy or is), counter ranges, seen', () => {
  const w = worldAt();
  w.flags['sp.met'] = true;
  w.flags['np.wren.mood'] = 'calm';
  w.counters['sp.fish'] = 4;
  w.flags['seen.ph-intro'] = true;
  assert.equal(ev(w, { flag: 'sp.met' }), true);
  assert.equal(ev(w, { flag: 'sp.unset' }), false);
  assert.equal(ev(w, { flag: 'np.wren.mood', is: 'calm' }), true);
  assert.equal(ev(w, { flag: 'np.wren.mood', is: 'cross' }), false);
  assert.equal(ev(w, { counter: 'sp.fish', gte: 3 }), true);
  assert.equal(ev(w, { counter: 'sp.fish', gte: 3, lte: 3 }), false);
  assert.equal(ev(w, { counter: 'sp.none', lte: 0 }), true);
  assert.equal(ev(w, { seen: 'ph-intro' }), true);
  assert.equal(ev(w, { seen: 'ph-remind' }), false);
});

test('hasItem, wallet, tool', () => {
  const w = worldAt();
  w.bag.pockets.wicks.push({ id: 'ph-lantern', n: 2 });
  w.wallet.main = 500;
  w.player.tool = 'ph-lantern';
  assert.equal(ev(w, { hasItem: 'ph-lantern' }), true);
  assert.equal(ev(w, { hasItem: 'ph-lantern', n: 3 }), false);
  assert.equal(ev(w, { wallet: { gte: 500 } }), true);
  assert.equal(ev(w, { wallet: { gte: 501 } }), false);
  assert.equal(ev(w, { tool: 'ph-lantern' }), true);
});

test('hour ranges are half-open and wrap midnight; phase; day / dow', () => {
  assert.equal(ev(worldAt(10 * 60), { hour: [9, 11] }), true);
  assert.equal(ev(worldAt(11 * 60), { hour: [9, 11] }), false);
  assert.equal(ev(worldAt(23 * 60), { hour: [22, 2] }), true);
  assert.equal(ev(worldAt(1 * 60), { hour: [22, 2] }), true);
  assert.equal(ev(worldAt(3 * 60), { hour: [22, 2] }), false);
  const w = worldAt(10 * 60, 9);
  assert.equal(ev(w, { phase: [sel.phase(w)] }), true);
  assert.equal(ev(w, { phase: ['nowhere'] }), false);
  // core day 9 is GDD day 10: `day` is the GDD day of the run (MID-07)
  assert.equal(ev(w, { day: { gte: 10 } }), true);
  assert.equal(ev(w, { day: { gte: 11 } }), false);
  assert.equal(ev(w, { day: { lte: 10 } }), true);
  assert.equal(ev(w, { day: { lte: 9 } }), false);
  assert.equal(ev(w, { day: { dow: [sel.dayOfWeek(w)] } }), true);
  assert.equal(ev(w, { day: { dow: [(sel.dayOfWeek(w) + 1) % 7] } }), false);
});

test('tide and lowTide agree with the selectors at every sampled minute', () => {
  let sawLow = false; let sawOther = false;
  for (let m = 0; m < 1440; m += 37) {
    const w = worldAt(m);
    const state = sel.tideState(w);
    assert.equal(ev(w, { tide: [state] }), true);
    assert.equal(ev(w, { lowTide: true }), state === 'low');
    assert.equal(ev(w, { lowTide: false }), state !== 'low');
    if (state === 'low') sawLow = true; else sawOther = true;
  }
  assert.ok(sawLow && sawOther);
});

test('weather, dial, challenge, badge (id or count), letter read', () => {
  const w = worldAt();
  w.weather.today = 'mist';
  w.run.challenges = ['one-heart'];
  w.badges = ['spire-a', 'spire-b'];
  w.letters.read = [1, 3];
  assert.equal(ev(w, { weather: ['mist', 'rain'] }), true);
  assert.equal(ev(w, { weather: ['storm'] }), false);
  assert.equal(ev(w, { dial: ['flux'] }), true);
  assert.equal(ev(w, { dial: ['freefall'] }), false);
  assert.equal(ev(w, { challenge: 'one-heart' }), true);
  assert.equal(ev(w, { challenge: 'no-rewind' }), false);
  assert.equal(ev(w, { badge: 'spire-b' }), true);
  assert.equal(ev(w, { badge: 2 }), true);
  assert.equal(ev(w, { badge: 3 }), false);
  assert.equal(ev(w, { letter: { read: 3 } }), true);
  assert.equal(ev(w, { letter: { read: 2 } }), false);
});

test('loan tier (number = at least, or range) and paid (looked up as tier-<n>)', () => {
  const w = worldAt();
  w.loans.tier = 1;
  w.loans.paid = 100;
  assert.equal(ev(w, { loan: { tier: 1 } }), true);
  assert.equal(ev(w, { loan: { tier: 2 } }), false);
  assert.equal(ev(w, { loan: { tier: { eq: 1 } } }), true);
  assert.equal(ev(w, { loan: { paid: false } }), true);
  w.loans.paid = data.get('loans', 'tier-1').amount;   // the real ladder: tier 1 is paid at its full amount
  assert.equal(ev(w, { loan: { paid: true } }), true);
  assert.equal(evalCond(w, { loan: { paid: true } }, {}), false);   // no registry: unknown -> not paid
});

test('thread, npc memory, party, fieldLog', () => {
  const w = worldAt();
  w.threads['ph-thread'] = { beat: 2, done: false, startedDay: 0, lastAdvancedDay: 0 };
  w.npcs['ph-keeper'] = { met: true, talks: 5, nickname: 'Kip', lastTalkDay: 0, lastPorchDay: null, affinity: 0, favours: [], saidLines: {}, remembered: {} };
  w.party.push({ uid: 'c1', speciesId: 'ph-pup', familyId: 'ph-line', level: 12 });
  w.fieldLog.forms['ph-pip'] = { seen: true, read: true, held: false, ability: null };
  assert.equal(ev(w, { thread: { id: 'ph-thread', beat: 2 } }), true);
  assert.equal(ev(w, { thread: { id: 'ph-thread', beat: 3 } }), false);
  assert.equal(ev(w, { thread: { id: 'ph-thread', done: false } }), true);
  assert.equal(ev(w, { thread: { id: 'ph-missing' } }), false);
  assert.equal(ev(w, { npc: { id: 'ph-keeper', met: true, talks: { gte: 5 }, nickname: true } }), true);
  assert.equal(ev(w, { npc: { id: 'ph-other', met: true } }), false);
  assert.equal(ev(w, { npc: { id: 'ph-other', met: false } }), true);
  assert.equal(ev(w, { party: { has: 'ph-pup', family: 'ph-line', level: { gte: 10 }, size: { gte: 1 } } }), true);
  assert.equal(ev(w, { party: { has: 'ph-pip' } }), false);
  assert.equal(ev(w, { fieldLog: { form: 'ph-pip', state: 'seen' } }), true);
  assert.equal(ev(w, { fieldLog: { form: 'ph-pip', state: 'read' } }), true);
  assert.equal(ev(w, { fieldLog: { form: 'ph-pip', state: 'held' } }), false);
});

test('map and inRegion use ctx first, then the player position', () => {
  const w = worldAt();
  w.player.mapId = 'ph-field'; w.player.x = 8; w.player.y = 4;     // porch region {x:8, y:4, w:2, h:1}
  assert.equal(ev(w, { map: 'ph-field' }), true);
  assert.equal(ev(w, { map: 'ph-hut' }, { mapId: 'ph-hut' }), true);
  assert.equal(ev(w, { inRegion: 'porch' }), true);
  assert.equal(ev(w, { inRegion: 'porch' }, { x: 7 }), false);
  assert.equal(ev(w, { inRegion: 'nowhere' }), false);
  assert.equal(evalCond(w, { inRegion: 'porch' }, {}), false);       // needs the registry for map regions
});

test('malformed conditions throw TypeError (one DSL key per object)', () => {
  const w = worldAt();
  assert.throws(() => evalCond(w, { flg: 'x' }), TypeError);
  assert.throws(() => evalCond(w, { flag: 'x', hour: [1, 2] }), TypeError);
  assert.throws(() => evalCond(w, { flag: 'x', gte: 1 }), TypeError);
  assert.throws(() => evalCond(w, [true]), TypeError);
  assert.throws(() => evalCond(w, 'flag'), TypeError);
});

test('evalCond never mutates the world', () => {
  const w = worldAt();
  const before = JSON.stringify(w);
  ev(w, { all: [{ npc: { id: 'ph-keeper', met: false } }, { thread: { id: 'ph-thread' } }, { fieldLog: { form: 'ph-pip', state: 'seen' } }] });
  assert.equal(JSON.stringify(w), before);
});

test('validateCond: shapes and references', () => {
  const has = (t, id) => data.has(t, id);
  assert.deepEqual(validateCond({ all: [{ flag: 'sp.x' }, { not: { hasItem: 'ph-lantern' } }] }, { has }), []);
  assert.deepEqual(validateCond(true), []);
  assert.deepEqual(validateCond({ flg: 1 }), ['cond: malformed {"flg":1} (one DSL key per object)']);
  const p = (c) => validateCond(c, { has });
  assert.ok(p({ hasItem: 'ghost' }).includes("cond: hasItem 'ghost' is not in items"));
  assert.ok(p({ hour: [3, 25] }).includes('cond: hour must be [from, to] in 0..24'));
  assert.ok(p({ tide: ['ebb'] }).includes("cond: unknown tide state 'ebb'"));
  assert.ok(p({ phase: ['teatime'] })[0].startsWith("cond: unknown phase 'teatime'"));
  assert.ok(p({ dial: ['hard'] }).includes("cond: dial 'hard' is not in dials"));
  assert.ok(p({ day: { dow: [7] } }).includes('cond: day.dow must be integers 0..6'));
  assert.ok(p({ thread: { id: 'ghost' } }).includes("cond: thread.id 'ghost' is not in threads"));
  assert.ok(p({ fieldLog: { form: 'ph-pip', state: 'owned' } }).includes('cond: fieldLog.state must be seen|read|held'));
  assert.ok(p({ any: { flag: 'x' } }).includes('cond: any must be an array of conds'));
  assert.ok(p({ all: [{ flag: 'sp.a' }, { map: 'nowhere' }] }).includes("cond.all[1]: map 'nowhere' is not in maps"));
});

test('flagsReadBy collects flags through combinators', () => {
  const flags = flagsReadBy({ all: [{ flag: 'sp.a' }, { any: [{ not: { flag: 'sp.b' } }, { hour: [1, 2] }] }] });
  assert.deepEqual([...flags].sort(), ['sp.a', 'sp.b']);
  assert.equal(flagsReadBy(true).size, 0);
});
