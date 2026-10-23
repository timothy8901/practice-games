// Unit tests for js/systems/flow/dayFlow.js: the night's order (rest -> overnight -> builds 05:40 ->
// morning letter -> weather -> autosave), held events, refused rests, the awake wiring. [SCN-UI lane]
// Run: node --test test/flow.dayFlow.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../js/systems/flow/dayFlow.js';
import * as clockSys from '../js/systems/clockSys.js';
import { createNewWorld, validateWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import { createClock } from '../js/core/time.js';
import { forkFor } from '../js/state/rngs.js';
import { LETTERS } from '../js/data/letters/index.js';
import { LOANS } from '../js/data/loans.js';
import { ITEMS } from '../js/data/items.js';
import { COLLECTIONS } from '../js/data/collections.js';
import { SHOPS } from '../js/data/shops.js';

const DAY = 1440;
const data = Object.freeze({ letters: LETTERS, loans: LOANS, items: ITEMS, collections: COLLECTIONS, shops: SHOPS, scripts: { relighting: ['The lamp.'] }, npcs: [] });

/** A world on core day `day` at `minute`, home porch lit (tier 2), with a bound clock. */
function setup({ day = 1, minute = 22 * 60, build = true } = {}) {
  const world = createNewWorld({ seedCode: 'FLOW-DAY' });
  world.clock.total = day * DAY + minute;
  world.loans.tier = 2;
  if (build) world.loans.builds.push({ id: LOANS[0].build ?? 'cottage', tier: 1, startedDay: day, readyDay: day + 1, choice: null, done: false });
  const clock = createClock(clockSys.optionsFrom(world));
  clockSys.restoreFrom(world, clock);
  return { world, clock };
}
const rng = (world) => (label) => forkFor(world.run.seed, label);

describe('restNight: Sleep till dawn', () => {
  it('runs rest -> heal -> overnight -> builds -> crate -> letters -> weather -> autosave, in that order', () => {
    const { world, clock } = setup();
    const q = F.createQueueBus();
    const saved = [];
    const r = F.restNight(world, clock, 'sleep', {
      data, bus: q, rng: rng(world),
      save: (w) => { saved.push({ letters: w.letters.got.slice(), weatherDay: w.weather.day, built: w.loans.builds.map((b) => b.done) }); return { ok: true }; },
    });
    assert.equal(r.ok, true);
    assert.deepEqual(r.order, ['rest', 'heal', 'overnight', 'builds', 'crate', 'letters', 'weather', 'autosave']);
    assert.deepEqual(r.order, F.NIGHT_ORDER.filter((s) => r.order.includes(s)), 'matches NIGHT_ORDER');
    // the clock rolled to 06:00 of the next day
    assert.equal(world.clock.total, 2 * DAY + 6 * 60);
    // the build landed at 05:40
    assert.equal(r.landed.length, 1);
    assert.equal(world.loans.builds[0].done, true);
    // the morning letter came (K1 on day 2 = core day 1? K1 arrives on GDD day 2 = core day 1; this morning is core day 2)
    assert.ok(r.mail.length >= 1, `a letter arrived: ${JSON.stringify(r.overnight.mail)}`);
    assert.equal(world.letters.got[0], r.mail[0]);
    // weather rolled for the new game day
    assert.equal(world.weather.day, clockSys.gameDay(world));
    // the autosave saw the finished morning
    assert.deepEqual(saved[0], { letters: world.letters.got.slice(), weatherDay: world.weather.day, built: [true] });
    // the page is the closed day's
    assert.equal(r.summary.day, 1);
    assert.equal(world.dayPage.day, 2);
    assert.deepEqual(validateWorld(world), []);
  });

  it('domain events are held, in the night\'s order: midnight, builds, morning anchor, letter, weather', () => {
    const { world, clock } = setup();
    const q = F.createQueueBus();
    F.restNight(world, clock, 'sleep', { data, bus: q, rng: rng(world) });
    const names = q.events.map((e) => e.evt);
    const at = (n) => names.indexOf(n);
    assert.ok(at('day:end') >= 0 && at('day:start') > at('day:end'));
    assert.ok(at('clock:anchor') > at('day:start'), 'anchors after midnight');
    assert.ok(at('loan:built') > at('day:start'), 'the build lands after midnight');
    assert.ok(at('letter:delivered') > at('loan:built'), 'the letter comes after the build');
    assert.ok(at('weather:change') === -1 || at('weather:change') > at('letter:delivered'), 'weather after the letter');
    // and they reach a real bus only when flushed
    const got = [];
    const bus = { emit: (e) => got.push(e) };
    assert.equal(got.length, 0);
    const n = q.flush(bus);
    assert.equal(n, names.length);
    assert.deepEqual(got, names);
    assert.equal(q.events.length, 0);
  });

  it('a second Sleep the same morning is refused by the clock (too early again until 21:00)', () => {
    const { world, clock } = setup();
    F.restNight(world, clock, 'sleep', { data, bus: null, rng: rng(world) });
    const before = world.clock.total;
    const r = F.restNight(world, clock, 'sleep', { data, bus: null, rng: rng(world) });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'too-early');
    assert.equal(world.clock.total, before, 'nothing changed');
    assert.deepEqual(r.order, []);
  });
});

describe('restNight: refused and short rests', () => {
  it('Sleep before 21:00 is refused and changes nothing', () => {
    const { world, clock } = setup({ minute: 19 * 60 });
    const snap = JSON.stringify(world);
    const r = F.restNight(world, clock, 'sleep', { data, bus: null, rng: rng(world), save: () => ({ ok: true }) });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'too-early');
    assert.equal(JSON.stringify(world), snap);
  });

  it('Nap till dusk: heal, no overnight, no letters, page of today so far', () => {
    const { world, clock } = setup({ minute: 13 * 60 });
    const r = F.restNight(world, clock, 'nap', { data, bus: null, rng: rng(world), save: () => ({ ok: true }) });
    assert.equal(r.ok, true);
    assert.deepEqual(r.order, ['rest', 'heal', 'autosave']);
    assert.equal(world.clock.total % DAY, 18 * 60);
    assert.equal(r.overnight, null);
    assert.equal(world.letters.got.length, 0);
    assert.equal(r.summary.day, world.dayPage.day, 'the open tally');
  });

  it('Lie down: ten minutes, heal', () => {
    const { world, clock } = setup({ minute: 10 * 60 });
    const r = F.restNight(world, clock, 'lie', { data, bus: null, rng: rng(world) });
    assert.equal(r.ok, true);
    assert.equal(world.clock.total % DAY, 10 * 60 + 10);
  });
});

/** A game-context double with a store, a clock, a bus and a recording persist. */
function fakeG(opts = {}) {
  const { world, clock } = setup(opts);
  const store = createStore(world);
  clockSys.restoreFrom(store.world, clock);
  const saves = [];
  const pushed = [];
  const toasts = [];
  const G = {
    store, clock, data, bus: store.bus, get world() { return store.world; },
    rngs: rng(world),
    persist: { autosave: (g, reason) => { saves.push({ reason, letters: g.world.letters.got.slice() }); return { ok: true, slot: 'auto:1' }; } },
    sceneFactories: { dayPage: () => ({}), forecast: () => ({}) },
    scenes: { top: () => ({ name: 'overworld' }) },
    push: (name, params) => pushed.push([name, params]),
  };
  store.bus.on('toast', (p) => toasts.push(p.text));
  return { G, saves, pushed, toasts };
}

describe('the G wrappers', () => {
  it('restNow: tx, then the autosave sees the delivered letter; events held until wake()', () => {
    const { G, saves } = fakeG();
    const heard = [];
    G.bus.on('letter:delivered', (p) => heard.push(p.n));
    const r = F.restNow(G, 'sleep');
    assert.equal(r.ok, true);
    assert.equal(r.order.at(-1), 'autosave');
    assert.equal(saves.length, 1);
    assert.equal(saves[0].reason, 'sleep');
    assert.deepEqual(saves[0].letters, G.world.letters.got);
    assert.equal(heard.length, 0, 'held for the morning');
    F.wake(G, r);
    assert.equal(heard.length, 1, 'released at the morning');
  });

  it('rest(): Sleep pushes the Day Page with the summary, save result and landed builds; morning on close', async () => {
    const { G, pushed, toasts } = fakeG();
    const done = F.rest(G, 'sleep');
    assert.equal(pushed.length, 1);
    const [name, params] = pushed[0];
    assert.equal(name, 'dayPage');
    assert.equal(params.mode, 'sleep');
    assert.equal(params.save.ok, true);
    assert.equal(params.landed.length, 1);
    assert.ok(params.summary && Array.isArray(params.summary.tomorrow));
    params.onClose();
    const r = await done;
    assert.equal(r.ok, true);
    assert.ok(toasts.some((t) => /letter/i.test(t)), 'the mailbox toast at the morning');
  });

  it('rest(): too early toasts and pushes nothing', async () => {
    const { G, pushed, toasts } = fakeG({ minute: 15 * 60 });
    const r = await F.rest(G, 'sleep');
    assert.equal(r.ok, false);
    assert.equal(pushed.length, 0);
    assert.match(toasts[0], /Too early/);
  });

  it('resolvePendingForecasts opens each deferred Forecast in turn', async () => {
    const { G, pushed } = fakeG();
    G.store.tx('t', (w) => { w.pendingShifts.push('c1', 'c2'); });
    const p = F.resolvePendingForecasts(G, 'home');
    assert.deepEqual(pushed.map((x) => [x[0], x[1].uid, x[1].where]), [['forecast', 'c1', 'home']]);
    pushed[0][1].onClose();
    assert.deepEqual(pushed.map((x) => x[1].uid), ['c1', 'c2']);
    pushed[1][1].onClose();
    assert.equal(await p, 2);
  });

  it('install: the tally hears earnings; the dusk check queues the Relighting when due', () => {
    const { G } = fakeG({ minute: 17 * 60 });
    const off = F.install(G);
    const before = G.world.dayPage.earned;
    G.bus.emit('wallet:changed', { currency: 'main', delta: 250 });
    assert.equal(G.world.dayPage.earned, before + 250);
    // not due: nothing queued
    G.bus.emit('clock:dayPart', { dayPart: 'dusk' });
    assert.equal(G.world.pendingScript, null);
    // due today at dusk
    G.store.tx('t', (w) => { w.flags['sys.relighting-due'] = 1; w.clock.total = 1 * DAY + 18 * 60; });
    const due = [];
    G.bus.on('relighting:due', (p) => due.push(p));
    G.bus.emit('clock:dayPart', { dayPart: 'dusk' });
    assert.equal(G.world.pendingScript, 'relighting');
    assert.equal(due.length, 1);
    off();
  });

  it('install: the 06:00 anchor runs the overnight without a rest (letters come, no page)', () => {
    const { G, pushed } = fakeG({ minute: 22 * 60 });
    const off = F.install(G);
    // walk the clock to 06:00 through tick (as the overworld does)
    G.store.tx('tick', (w) => clockSys.setTime(w, G.clock, 5 * 60 + 59));
    for (let i = 0; i < 12; i++) G.store.tx('tick', (w) => clockSys.tick(w, G.clock, 250, { bus: G.bus, data }));
    assert.ok(G.world.letters.got.length >= 1, 'letter delivered at the morning anchor');
    assert.equal(G.world.dayPage.day, 2);
    assert.equal(pushed.filter((p) => p[0] === 'dayPage' && p[1].mode !== 'build').length, 0);
    off();
  });

  it('mailNumbers reads deliverMorning results', () => {
    assert.deepEqual(F.mailNumbers({ keeper: 3, town: [40, 41] }), [3, 40, 41]);
    assert.deepEqual(F.mailNumbers({ keeper: null, town: [] }), []);
    assert.deepEqual(F.mailNumbers(null), []);
    assert.deepEqual(F.mailNumbers([1, 'x', 2]), [1, 2]);
  });
});
