// Unit tests for js/systems/dayPage.js (SYS-TOWN). Run: node --test test/systems.dayPage.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../js/systems/dayPage.js';
import * as letters from '../js/systems/letters.js';
import * as threads from '../js/systems/threads.js';
import * as loans from '../js/systems/loans.js';
import { validateWorld, LOG_MAX, DAY_NOTES_MAX, creatureDefaults } from '../js/state/schema.js';
import { forkFor, createRngs } from '../js/state/rngs.js';
import { createStore } from '../js/state/store.js';
import { porchFlag } from '../js/systems/townCommon.js';
import { lowsOn } from '../js/systems/schedule.js';
import { makeWorld, makeData, at, recBus, MIN } from './fixtures/town.fixture.mjs';

const data = makeData();
const meet = (w, id, day = 0) => { w.npcs[id] = { met: true, talks: 1, lastTalkDay: day, lastPorchDay: -1, nickname: null, affinity: 0, favours: [], saidLines: {}, remembered: {}, gifts: {}, nicknameChoice: null, lastLineId: null, lingerDay: -1, lastGiftDay: -1 }; };

describe('the tally', () => {
  it('beginDay snapshots the stats and keeps the last page', () => {
    const w = makeWorld({ day: 3 });
    w.stats.catches = 4;
    w.dayPage.last = { day: 2 };
    P.beginDay(w, 3);
    assert.equal(w.dayPage.day, 3);
    assert.equal(w.dayPage.base.catches, 4);
    assert.equal('playMs' in w.dayPage.base, false);
    assert.deepEqual(w.dayPage.last, { day: 2 });
    assert.throws(() => P.beginDay(w, 1.5), /integer/);
    assert.deepEqual(validateWorld(w), []);
  });

  it('noteEvent: earnings, payments and notes', () => {
    const w = makeWorld({ day: 3 });
    assert.equal(w.dayPage.day, 0, 'a new world opens the arrival day\'s tally');
    w.dayPage.day = -1;                                              // no tally (e.g. damaged)
    assert.equal(P.noteEvent(w, 'wallet:changed', { currency: 'main', delta: 300 }), true);
    assert.equal(w.dayPage.day, 3, 'opens the tally on first use');
    P.noteEvent(w, 'wallet:changed', { currency: 'main', delta: -100 });
    P.noteEvent(w, 'wallet:changed', { currency: 'starsalt', delta: 2 });
    P.noteEvent(w, 'wallet:changed', { currency: 'main', delta: 1.5 });
    assert.equal(w.dayPage.earned, 300, 'only positive whole main deltas');
    assert.equal(P.noteEvent(w, 'loan:paid', { amount: 1000 }), true);
    assert.equal(P.noteEvent(w, 'loan:paid', { amount: 0 }), false);
    assert.equal(w.dayPage.paid, 1000);
    assert.equal(P.noteEvent(w, 'loan:built', { id: 'cottage' }), true);
    assert.equal(P.noteEvent(w, 'loan:built', {}), false);
    P.noteEvent(w, 'letter:read', { label: 'K2' });
    P.noteEvent(w, 'thread:beat', { threadId: 'tully-mile', beat: 2 });
    P.noteEvent(w, 'shift:resolved', {});
    P.noteEvent(w, 'badge:won', { spireId: 'turn' });
    P.noteEvent(w, 'capture:ok', { speciesId: 'tossup' });
    assert.deepEqual(w.dayPage.notes, ['built:cottage', 'read:K2', 'beat:tully-mile:2', 'shift', 'badge:turn', 'caught:tossup']);
    assert.equal(P.noteEvent(w, 'clock:minute', {}), false);
    assert.equal(P.noteEvent(w, 42, {}), false);
    for (let i = 0; i < 50; i++) P.noteEvent(w, 'letter:read', { label: `K${i}` });
    assert.equal(w.dayPage.notes.length, DAY_NOTES_MAX);
    assert.equal(w.dayPage.notes.at(-1), 'read:K49', 'oldest notes drop first');
    assert.deepEqual(validateWorld(w), []);
  });
});

describe('summary and Tomorrow', () => {
  it('summarize: amounts, stat deltas, who you talked to', () => {
    const w = makeWorld({ day: 3, minute: 22 * MIN });
    P.beginDay(w, 3);
    w.stats.catches += 2;
    w.stats.forecasts += 1;
    w.stats.fishCaught += 3;
    P.noteEvent(w, 'wallet:changed', { currency: 'main', delta: 4200 });
    P.noteEvent(w, 'loan:paid', { amount: 1000 });
    meet(w, 'wren', 3);
    meet(w, 'tully', 2);
    meet(w, 'odile', 4);
    const s = P.summarize(w, data);
    assert.deepEqual({ ...s, tomorrow: undefined }, {
      day: 3, gameDay: 4, dow: 2, buttons: 4200, loanPaid: 1000, catches: 2, fish: 3, forecasts: 1, battles: 0, lettersRead: 0,
      talkedTo: ['odile', 'wren'], notes: [], tomorrow: undefined,
    });
    const other = P.summarize(w, data, { day: 1 });
    assert.deepEqual([other.buttons, other.catches], [0, 0], 'a day without a tally has no amounts');
    assert.equal(P.logLine(s), 'D4 · +4200 · paid 1000 · 2 caught · 3 fish · 1 Forecast · odile, wren');
    assert.equal(P.logLine({ ...s, loanPaid: 0, catches: 0, fish: 0, forecasts: 2, talkedTo: [] }), 'D4 · +4200 · 2 Forecasts');
  });

  it('tomorrowList: builds, Forecasts, the letter, beats, lows, letters to carry, heirlooms, providers', () => {
    const w = makeWorld({ day: 3, minute: 22 * MIN });
    w.loans.tier = 2;
    w.loans.builds.push({ id: 'cottage', tier: 2, startedDay: 3, readyDay: 4, choice: null, done: false });
    w.loans.builds.push({ id: 'roof', tier: 1, startedDay: 0, readyDay: 1, choice: 'slate', done: true });
    w.party.push({ ...creatureDefaults(), uid: 'c1', nickname: 'PUDDLE', speciesId: 'sloshkin' });
    w.pendingShifts.push('c1');
    meet(w, 'thessaly');
    threads.advance(w, data, 'thessaly-bench', { day: 2 });
    letters.deliverEvening(at(w, 3, 18 * MIN), data);
    at(w, 3, 22 * MIN);
    w.letters.got.push(22); w.letters.delivered += 1; w.letters.doors.push(22); w.letters.awaiting.push(22);
    const provider = () => [{ kind: 'graft', id: 'plum' }, { kind: 'spire', id: 'ward' }, null, { nope: 1 }];
    const list = P.tomorrowList(w, data, { tomorrow: [provider, 'bad'], tuning: { tomorrowMax: 20 } });
    assert.deepEqual(list.map((i) => i.kind), ['build', 'graft', 'forecast', 'letter', 'beat', 'low', 'carry', 'heirloom', 'spire']);
    assert.deepEqual(list[0], { kind: 'build', id: 'cottage', params: { readyGameDay: 5, lands: true, minute: 340 } });
    assert.deepEqual(list[2], { kind: 'forecast', id: 'c1', params: { nickname: 'PUDDLE', speciesId: 'sloshkin' } });
    assert.deepEqual(list[3], { kind: 'letter', id: 'K1', params: { n: 1, channel: 'keeper', minute: 360 } });
    assert.deepEqual(list[4], { kind: 'beat', id: 'thessaly-bench', params: { npcId: 'thessaly', beat: 2, title: 'Template' } });
    assert.deepEqual(list[5], { kind: 'low', id: null, params: { minutes: lowsOn(w, 4) } });
    assert.deepEqual(list[6], { kind: 'carry', id: 'F1', params: { n: 21, atCounter: true } });
    assert.deepEqual(list[7], { kind: 'heirloom', id: 'F2', params: { n: 22 } });
    assert.equal(P.tomorrowList(w, data, { tomorrow: [provider] }).length, 8, 'tomorrowMax');
    assert.deepEqual(validateWorld(w), []);
  });

  it('tonightList: what the night still holds before Sleep', () => {
    const w = makeWorld({ day: 3, minute: 21 * MIN });
    meet(w, 'tully');
    w.threads['tully-mile'] = { beat: 2, done: false, startedDay: 0, lastAdvancedDay: 0 };
    w.flags['sp.race'] = true;
    letters.deliverEvening(at(w, 3, 18 * MIN), data);
    at(w, 3, 21 * MIN);
    const items = P.tonightList(w, data, { tonight: [() => ({ kind: 'ludo' })] });
    const kinds = items.map((i) => i.kind);
    assert.ok(kinds.includes('porch'));
    assert.ok(items.some((i) => i.kind === 'beat' && i.id === 'tully-mile'));
    assert.ok(kinds.includes('carry'));
    assert.equal(kinds.at(-1), 'ludo');
    const lowsTonight = [...lowsOn(w, 3).map((m) => 3 * 1440 + m), ...lowsOn(w, 4).map((m) => 4 * 1440 + m)].filter((x) => x > 3 * 1440 + 21 * MIN && x < 4 * 1440 + 6 * MIN);
    assert.equal(kinds.includes('low'), lowsTonight.length > 0);
    const noon = P.tonightList(makeWorld({ day: 3, minute: 12 * MIN }), data);
    assert.equal(noon.some((i) => i.kind === 'porch'), false, 'porch talk is closed at noon');
  });
});

describe('overnight', () => {
  it('runs the steps in order with the right day, time and labelled forks', () => {
    const w = makeWorld({ day: 3, minute: 23 * MIN });
    const calls = [];
    const hooks = {};
    for (const step of P.OVERNIGHT_STEPS) {
      hooks[step] = (world, d, s) => { calls.push([step, s.day, s.gameDay, s.endedDay, s.now % 1440, s.rng.nextUint32()]); return step.toUpperCase(); };
    }
    const r = P.overnight(w, data, null, { hooks });
    assert.equal(r.ran, true);
    assert.deepEqual([r.day, r.endedDay], [4, 3], 'after 06:00 the night leads into tomorrow');
    assert.deepEqual(calls.map((c) => c[0]), P.OVERNIGHT_STEPS);
    assert.deepEqual(calls[0].slice(1, 5), [4, 5, 3, 5 * MIN + 40], 'builds at 05:40');
    assert.deepEqual(calls[1].slice(1, 5), [4, 5, 3, 6 * MIN]);
    const glint = calls.find((c) => c[0] === 'glint');
    assert.equal(glint[5], forkFor(w.run.seed, 'glint:4').nextUint32(), "the Glint draws from 'glint:<day>'");
    const weather = calls.find((c) => c[0] === 'weather');
    assert.equal(weather[5], forkFor(w.run.seed, 'weather:5').nextUint32(), "weather's stream is named by the GDD day (systems/weather)");
    assert.equal(calls.find((c) => c[0] === 'wanted')[5], forkFor(w.run.seed, 'shop:wanted:4').nextUint32());
    assert.equal(r.steps.glint, 'GLINT');
    assert.deepEqual(r.errors, []);
    assert.equal(w.dayPage.day, 4);
    assert.deepEqual(validateWorld(w), []);
  });

  it('is idempotent per morning and defaults to the coming 06:00', () => {
    const w = makeWorld({ day: 4, minute: 2 * MIN });
    const r1 = P.overnight(w, data, null);
    assert.deepEqual([r1.ran, r1.day, r1.endedDay], [true, 4, 3], 'at 02:00 the coming morning is today');
    const r2 = P.overnight(w, data, null);
    assert.deepEqual([r2.ran, r2.reason], [false, 'already']);
    assert.equal(w.log.length, 1);
    const r3 = P.overnight(w, data, null, { toDay: 5 });
    assert.equal(r3.ran, true);
    assert.equal(r3.endedDay, 4);
  });

  it('closes the day: summary, log line, last page; opens the new tally', () => {
    const w = makeWorld({ day: 2, minute: 22 * MIN });
    P.beginDay(w, 2);
    P.noteEvent(w, 'wallet:changed', { currency: 'main', delta: 900 });
    P.noteEvent(w, 'letter:read', { label: 'K1' });
    const bus = recBus();
    const r = P.overnight(w, data, null, { bus });
    assert.equal(r.summary.buttons, 900);
    assert.deepEqual(w.log, ['D3 · +900']);
    assert.equal(w.dayPage.last.buttons, 900);
    assert.deepEqual(w.dayPage.last.notes, ['read:K1']);
    assert.deepEqual([w.dayPage.day, w.dayPage.earned, w.dayPage.notes], [3, 0, []]);
    assert.deepEqual(bus.of('dayPage:written'), [{ day: 2, gameDay: 3, toDay: 3 }]);
    assert.deepEqual(P.summarize(w, data, { day: 2 }).buttons, 0, 'the closed tally is gone; the page lives in dayPage.last');
    assert.deepEqual(validateWorld(w), []);
  });

  it('keeps at most dayPageLogLines lines', () => {
    const w = makeWorld({ day: 0, minute: 22 * MIN });
    for (let d = 1; d <= LOG_MAX + 5; d++) P.overnight(w, data, null, { toDay: d });
    assert.equal(w.log.length, LOG_MAX);
    assert.match(w.log.at(-1), /^D65 /);
    const few = makeWorld({ day: 0, minute: 22 * MIN });
    for (let d = 1; d <= 5; d++) P.overnight(few, data, null, { toDay: d, tuning: { dayPageLogLines: 2 } });
    assert.equal(few.log.length, 2);
    const none = makeWorld({ day: 0, minute: 22 * MIN });
    P.overnight(none, data, null, { tuning: { dayPageLogLines: 0 } });
    assert.deepEqual(none.log, []);
    assert.deepEqual(validateWorld(w), []);
  });

  it('a failing hook is recorded and the night goes on (strict rethrows)', () => {
    const w = makeWorld({ day: 1, minute: 22 * MIN });
    w.loans.tier = 2;
    const bus = recBus();
    const r = P.overnight(w, data, null, { bus, hooks: { regrow: () => { throw new Error('no trees'); }, weather: () => 'ok' } });
    assert.deepEqual(r.errors, [{ step: 'regrow', message: 'no trees' }]);
    assert.equal(r.steps.weather, 'ok');
    assert.equal(r.mail.keeper, 1, 'the letters still came');
    assert.deepEqual(bus.of('dayPage:error'), [{ step: 'regrow', message: 'no trees', day: 2 }]);
    const w2 = makeWorld({ day: 1, minute: 22 * MIN });
    assert.throws(() => P.overnight(w2, data, null, { strict: true, hooks: { regrow: () => { throw new Error('boom'); } } }), /boom/);
  });

  it('delivers the 06:00 letter and releases heirlooms whose porch is now lit', () => {
    const w = makeWorld({ day: 1, minute: 18 * MIN });
    w.loans.tier = 2;
    w.letters.got.push(22); w.letters.delivered = 1; w.letters.doors.push(22); w.letters.awaiting.push(22);
    at(w, 1, 23 * MIN);
    w.flags[porchFlag('odile')] = true;
    const gave = [];
    const r = P.overnight(w, data, null, { giveItem: (_w, id) => gave.push(id) });
    assert.deepEqual(r.heirlooms.map((h) => h.id), ['f2']);
    assert.deepEqual(gave, ['heirloom-2']);
    assert.equal(r.mail.keeper, 1);
    assert.equal(w.letters.today, 1);
    assert.deepEqual(validateWorld(w), []);
  });

  it('the loans shorthand lands builds through RULES-ECON at 05:40', () => {
    const w = makeWorld({ day: 1, minute: 22 * MIN });
    w.loans.builds.push({ id: 'cottage', tier: 2, startedDay: 1, readyDay: 2, choice: null, done: false });
    const seen = [];
    const r = P.overnight(w, data, null, { loans: { landDue: (world, ctx) => { seen.push(ctx.now); return loans.landDue(world, ctx); } } });
    assert.deepEqual(seen, [2 * 1440 + 5 * MIN + 40]);
    assert.equal(r.steps.builds.landed.length, 1, 'the real landDue landed it');
    assert.equal(w.loans.builds[0].done, true);
    assert.deepEqual(validateWorld(w), []);
    const own = makeWorld({ day: 1, minute: 22 * MIN });
    let used = '';
    P.overnight(own, data, null, { loans: { landDue: () => { used = 'loans'; } }, hooks: { builds: () => { used = 'hook'; } } });
    assert.equal(used, 'hook', 'an explicit hook wins over the shorthand');
  });

  it('accepts an Rngs registry, a label function or an Rng as the rng source, deterministically', () => {
    const make = () => makeWorld({ day: 1, minute: 22 * MIN });
    const draw = (rng) => {
      const w = make();
      let got = null;
      P.overnight(w, data, rng, { hooks: { glint: (_w, _d, s) => { got = s.rng.nextUint32(); } } });
      return got;
    };
    const base = draw(null);
    const w = make();
    const store = createStore(w);
    assert.equal(draw(createRngs(store)), base, 'Rngs.fresh(label) = the stateless fork');
    assert.equal(draw((label) => forkFor(w.run.seed, label)), base);
    const viaFork = draw({ fork: (label) => forkFor(1, label) });
    assert.equal(viaFork, forkFor(1, 'glint:2').nextUint32());
    assert.equal(draw(null), base, 'same world, same night');
  });

  it('a simulated three-week run keeps the world valid and the Tomorrow list honest', () => {
    const w = makeWorld({ day: 0, minute: 22 * MIN });
    w.loans.tier = 2;
    meet(w, 'tully');
    const spy = { calls: 0, residentShare: () => { spy.calls += 1; return { ok: true }; } };
    for (let day = 1; day <= 21; day++) {
      const r = P.overnight(w, data, null, { toDay: day });
      assert.equal(r.ran, true);
      at(w, day, 9 * MIN);
      const page = P.summarize(w, data, { day });
      const letterItem = page.tomorrow.find((i) => i.kind === 'letter');
      for (const n of letters.collectMail(w, data)) letters.markRead(w, data, n);
      for (const b of threads.eligibleBeats(w, data)) threads.advance(w, data, b.threadId, { loans: spy });
      if (day === 10) w.flags['sp.race'] = true;
      if (day < 20) assert.ok(letterItem, `day ${day}: tomorrow brings a letter`);
      assert.deepEqual(validateWorld(w), [], `day ${day}`);
    }
    assert.deepEqual(w.letters.read, [...Array.from({ length: 20 }, (_, i) => i + 1), 39], 'K1..K20 on days 2–21, then T1 by post on day 22');
    assert.equal(w.threads['tully-mile'].done, true);
    assert.equal(spy.calls, 1);
    assert.equal(w.log.length, 21);
  });

  it('tuning defaults are the GDD anchors', () => {
    const t = P.tuningOf(null);
    assert.deepEqual([t.buildLandMinute, t.dayStartMinute, t.dayPageLogLines], [5 * MIN + 40, 6 * MIN, LOG_MAX]);
    assert.deepEqual(P.TUNING_KEYS, Object.keys(P.DEFAULTS));
    assert.throws(() => P.tuningOf({ tuning: { dayPageLogLines: LOG_MAX + 1 } }), /dayPageLogLines/);
    assert.throws(() => P.tuningOf({ tuning: { buildLandMinute: 1440 } }), /buildLandMinute/);
  });
});
