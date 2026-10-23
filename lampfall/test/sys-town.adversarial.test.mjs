// Adversarial tests for the SYS-TOWN lane (townCommon, schedule, memory, letters, threads, dayPage):
// window edges and midnight wraps, day rollovers, malformed data, max stacks, the overnight's
// morning detection, a 60-day clock + economy simulation, cross-process determinism and save round
// trips through state/persist. Run: node --test test/sys-town.adversarial.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as C from '../js/systems/townCommon.js';
import * as S from '../js/systems/schedule.js';
import * as M from '../js/systems/memory.js';
import * as L from '../js/systems/letters.js';
import * as T from '../js/systems/threads.js';
import * as P from '../js/systems/dayPage.js';
import * as loans from '../js/systems/loans.js';
import * as gather from '../js/systems/gather.js';
import * as weather from '../js/systems/weather.js';
import { createNewWorld, validateWorld, SCHEMA_VERSION } from '../js/state/schema.js';
import { migrateWorld } from '../js/state/migrate.js';
import { createPersist } from '../js/state/persist.js';
import { createStore } from '../js/state/store.js';
import { createRngs, forkFor } from '../js/state/rngs.js';
import { makeRng } from '../js/core/rng.js';
import { TUNING } from '../js/data/tuning.js';
import { evalCond } from '../js/script/cond.js';
import { dayOfWeek } from '../js/state/selectors.js';
import { weekday } from '../js/systems/clockSys.js';
import { makeWorld, makeData, at, recBus, MIN } from './fixtures/town.fixture.mjs';
import { makeGame, runDays, digest, FLATS } from './fixtures/town.sim.mjs';

const data = makeData();
const HOME = C.CALENDAR_DEFAULTS.homePorchId;
const litWorld = (day = 1, minute = 6 * MIN) => { const w = makeWorld({ day, minute }); w.loans.tier = 2; return w; };

// ---------------------------------------------------------------------------------------------
describe('townCommon: windows, calendar, porches, tuning', () => {
  it('inWindow: exact edges of plain, wrapping, full and empty windows', () => {
    const porch = [19 * MIN, 1 * MIN];
    assert.equal(C.inWindow(19 * MIN - 1, porch), false, '18:59');
    assert.equal(C.inWindow(19 * MIN, porch), true, '19:00 opens');
    assert.equal(C.inWindow(1439, porch), true, '23:59');
    assert.equal(C.inWindow(0, porch), true, 'midnight');
    assert.equal(C.inWindow(59, porch), true, '00:59');
    assert.equal(C.inWindow(60, porch), false, '01:00 closes (half-open)');
    assert.equal(C.inWindow(8 * MIN, [8 * MIN, 22 * MIN]), true);
    assert.equal(C.inWindow(22 * MIN, [8 * MIN, 22 * MIN]), false);
    assert.equal(C.inWindow(0, [0, 1440]), true, '[0, 1440] is the whole day');
    assert.equal(C.inWindow(1439, [0, 1440]), true);
    assert.equal(C.inWindow(30, [1140, 1500]), true, 'to > 1440 wraps');
    assert.equal(C.inWindow(61, [1140, 1500]), false);
    assert.equal(C.inWindow(600, [600, 600]), false, 'from === to is empty');
    for (const bad of [null, [], [1], [1, 2, 3], 'x']) assert.equal(C.inWindow(10, bad), false);
  });

  it('windowStartDay: an after-midnight minute belongs to the window that opened the day before', () => {
    const porch = [19 * MIN, 1 * MIN];
    assert.equal(C.windowStartDay(5, 30, porch), 4);
    assert.equal(C.windowStartDay(5, 19 * MIN, porch), 5);
    assert.equal(C.windowStartDay(5, 60, porch), null);
    assert.equal(C.windowStartDay(0, 30, porch), -1, 'before the first day: a negative start day, never NaN');
  });

  it('mod, calendar and GDD weekdays stay integral for huge and negative days', () => {
    assert.equal(C.mod(-1, 7), 6);
    assert.equal(C.mod(-14, 7), 0);
    const t = C.CALENDAR_DEFAULTS;
    assert.equal(C.dowOf(0, t), 6, 'GDD day 1 is a Sunday');
    assert.equal(C.dowOf(6, t), 5, 'GDD day 7 is a Saturday');
    assert.equal(C.dowOf(13, t), 5, 'GDD day 14 is a Saturday');
    assert.equal(C.dowOf(-1, t), 5);
    const big = 10_000_000;
    assert.ok(Number.isInteger(C.dowOf(big, t)) && C.dowOf(big, t) >= 0 && C.dowOf(big, t) < 7);
    assert.equal(C.coreDayOfGame(C.gameDay(big, t), t), big);
  });

  it('one calendar everywhere: town systems, selectors, clockSys and the cond DSL agree on weekdays', () => {
    const w = createNewWorld({ seedCode: 'CAL' });
    for (let d = 0; d < 60; d++) {
      at(w, d, 12 * MIN);
      const dow = C.dowOf(d, C.CALENDAR_DEFAULTS);
      assert.equal(dayOfWeek(w), dow, `selectors, core day ${d}`);
      assert.equal(weekday(w, TUNING).index, dow, `clockSys, core day ${d}`);
      assert.equal(evalCond(w, { day: { dow: [dow] } }, {}), true, `cond, core day ${d}`);
      assert.equal(evalCond(w, { day: { dow: [5] } }, {}), (C.gameDay(d, C.CALENDAR_DEFAULTS)) % 7 === 0, 'Saturdays are GDD days 7, 14, 21 …');
    }
  });

  it('minuteNow and coreDay read a damaged clock as 0 and fold any minute into the day', () => {
    const w = createNewWorld({ seedCode: 'CLK' });
    w.clock.total = NaN;
    assert.equal(C.minuteNow(w), 0);
    assert.equal(C.coreDay(w), 0);
    assert.equal(C.minuteNow(w, { minute: -1 }), 1439);
    assert.equal(C.minuteNow(w, { minute: 1440 + 30.9 }), 30);
    assert.equal(C.coreDay(w, { day: 1.5 }), 0, 'a non-integer day override is ignored');
  });

  it('porches: the GDD seven are lit at arrival without any porch rows; flags win; yours lights at loan 1', () => {
    const w = createNewWorld({ seedCode: 'PORCH' });
    const lit = C.CALENDAR_DEFAULTS.porchesLitAtStart;
    assert.equal(lit.length, 7);
    for (const id of lit) assert.equal(C.isPorchLit(w, {}, id), true, id);
    for (const id of ['porch-dorrow', 'porch-odile', 'porch-dark-1']) assert.equal(C.isPorchLit(w, {}, id), false, id);
    assert.equal(C.isPorchLit(w, {}, HOME), false, 'yours is dark until loan 1 is paid');
    w.loans.tier = 2;
    assert.equal(C.isPorchLit(w, {}, HOME), true);
    w.flags[C.porchFlag('porch-linnet')] = false;
    assert.equal(C.isPorchLit(w, {}, 'porch-linnet'), false, "Linnet's porch goes dark after her fall");
    w.loans.tier = NaN;
    assert.equal(C.isPorchLit(w, {}, HOME), false, 'a damaged tier reads as tier 1');
    assert.equal(C.isPorchLit(w, { tuning: { porchesLitAtStart: [] } }, 'porch-pells'), false, 'tuning can empty the list');
    assert.equal(C.isPorchLit(w, { tuning: { porchesLitAtStart: 'nope' } }, 'porch-pells'), true, 'a malformed list falls back to the GDD default');
    for (const bad of [null, '', 42]) assert.equal(C.isPorchLit(w, {}, bad), false);
  });

  it('a malformed tuning value names the module and the key', () => {
    assert.throws(() => L.tuningOf(null, { tuning: { letterHour: 24 } }), /letters tuning letterHour/);
    assert.throws(() => S.tuningOf(null, { tuning: { porchWindow: [19 * 60] } }), /schedule tuning porchWindow/);
    assert.throws(() => M.tuningOf(null, { tuning: { noRepeatDays: -1 } }), /memory tuning noRepeatDays/);
    assert.throws(() => T.tuningOf(null, { tuning: { threadShareKinds: ['boss'] } }), /threads tuning threadShareKinds/);
    assert.throws(() => P.tuningOf(null, { tuning: { buildLandMinute: 1440 } }), /dayPage tuning buildLandMinute/);
    assert.throws(() => P.tuningOf(null, { tuning: { porchesLitAtStart: [1] } }), /porchesLitAtStart/);
    assert.throws(() => L.tuningOf(null, { tuning: 'x' }), /tuning must be an object/);
  });

  it('the real tuning table resolves in every module and agrees with the GDD numbers', () => {
    const lt = L.tuningOf(null, { tuning: TUNING });
    assert.deepEqual([lt.letterHour, lt.familyLetterHour, lt.keeperFirstDay, lt.townPostFromDay], [6, 18, 2, 22]);
    assert.deepEqual([...lt.hesperCounterHours], [18 * 60, 2 * 60]);
    const st = S.tuningOf(null, { tuning: TUNING });
    assert.deepEqual([...st.porchWindow], [19 * 60, 1 * 60], 'porch talk 19:00-01:00 (GDD-00 §5)');
    assert.equal(M.tuningOf(null, { tuning: TUNING }).noRepeatDays, 5);
    const pt = P.tuningOf(null, { tuning: TUNING });
    assert.deepEqual([pt.buildLandMinute, pt.dayStartMinute], [5 * 60 + 40, 6 * 60]);
    assert.equal(lt.homePorchId, 'porch-keepers-cottage');
    assert.equal(C.CALENDAR_DEFAULTS.homePorchId, TUNING.homePorchId, 'the default matches the shipped id');
  });

  it('rngFor: every source kind gives the same stream for a label; nothing uses Math.random', () => {
    const w = createNewWorld({ seedCode: 'RNG' });
    const store = createStore(w);
    const want = forkFor(w.run.seed, 'glint:4').nextUint32();
    assert.equal(C.rngFor(null, w, 'glint:4').nextUint32(), want);
    assert.equal(C.rngFor(createRngs(store), w, 'glint:4').nextUint32(), want);
    assert.equal(C.rngFor(makeRng(w.run.seed), w, 'glint:4').nextUint32(), want);
    assert.equal(C.rngFor((l) => forkFor(w.run.seed, l), w, 'glint:4').nextUint32(), want);
    const real = Math.random;
    Math.random = () => { throw new Error('Math.random used'); };
    try {
      C.rngFor(null, { run: { seed: -3 } }, 'x').next();
      M.pickLine('wren', makeWorld(), data, { rng: makeRng(1) });
      P.overnight(litWorld(2, 22 * MIN), data, null, { hooks: { glint: (_w, _d, s) => s.rng.next() } });
    } finally {
      Math.random = real;
    }
  });
});

// ---------------------------------------------------------------------------------------------
describe('schedule: wraps, rollovers, festivals, shops, garbage', () => {
  it('the last entry of a day runs past midnight until the first entry of the next', () => {
    const w = makeWorld({ day: 2 });
    const at23 = S.whereIs('wren', w, data, { day: 2, minute: 23 * MIN });
    const at3 = S.whereIs('wren', w, data, { day: 3, minute: 3 * MIN });
    assert.deepEqual([at23.mapId, at23.pose], ['yard', 'sleep']);
    assert.deepEqual([at3.mapId, at3.pose, at3.since], ['yard', 'sleep', 23 * MIN], 'still the 23:00 entry at 03:00');
    const at6 = S.whereIs('wren', w, data, { day: 3, minute: 6 * MIN });
    assert.deepEqual([at6.mapId, at6.since], ['yard', 6 * MIN]);
  });

  it('a weekday-filtered entry is tested on the day it started, across the midnight rollover', () => {
    // wren's 20:00 quay sit runs Mon-Fri (GDD weekdays 0-4); core day 1 = Monday
    const w = makeWorld();
    const mon = S.entryAt('wren', w, data, 20 * MIN + 30, { day: 1 });
    assert.equal(mon.entry.pose, 'sit');
    const sat = S.entryAt('wren', w, data, 20 * MIN + 30, { day: 6 });
    assert.notEqual(sat.entry.pose, 'sit', 'Saturday: no quay sit');
    const sunSmallHours = S.entryAt('wren', w, data, 30, { day: 0 });
    assert.equal(sunSmallHours.entry.pose, 'sleep');
  });

  it('a `for`-limited tide entry: in at its last minute, out at the next', () => {
    const w = makeWorld({ day: 4 });
    w.weather.current = 'clear';
    const lows = S.lowsOn(w, 4);
    assert.ok(lows.length >= 1);
    const low = lows.find((m) => m + 90 < 20 * MIN && m >= 9 * MIN) ?? null;
    if (low === null) return; // no daytime low to test against today
    const inside = S.entryAt('wren', w, data, low + 89, { day: 4 });
    assert.equal(inside.entry.mapId, 'flats');
    const after = S.entryAt('wren', w, data, low + 90, { day: 4 });
    assert.notEqual(after.entry.mapId, 'flats', 'for: 90 ends exactly 90 minutes later');
    w.weather.current = 'rain';
    assert.notEqual(S.entryAt('wren', w, data, low + 10, { day: 4 }).entry.mapId, 'flats', 'weather filter');
  });

  it('lows follow the GDD tide: day 1 16:40, day 2 05:05 and 17:30', () => {
    const w = createNewWorld({ seedCode: 'TIDE' });
    assert.ok(S.lowsOn(w, 0).includes(16 * 60 + 40));
    assert.deepEqual(S.lowsOn(w, 1), [5 * 60 + 5, 17 * 60 + 30]);
    assert.deepEqual(S.lowsOn(w, 2), [5 * 60 + 55, 18 * 60 + 20]);
    for (let d = 0; d < 400; d++) {
      const l = S.lowsOn(w, d);
      assert.ok(l.length >= 1 && l.length <= 2, `day ${d}`);
      assert.ok(l.every((m) => Number.isInteger(m) && m >= 0 && m < 1440));
    }
  });

  it('Lantern Market: Saturday 20:00 to Sunday 02:00, edges exact; never before day 7', () => {
    const w = makeWorld();
    const on = (day, minute) => S.isFestival('lantern-market', w, data, { day, minute });
    assert.equal(on(6, 20 * MIN - 1), false, 'Saturday 19:59');
    assert.equal(on(6, 20 * MIN), true, 'Saturday 20:00 (GDD day 7)');
    assert.equal(on(7, 1 * MIN + 59), true, 'Sunday 01:59 still the Saturday market');
    assert.equal(on(7, 2 * MIN), false, 'Sunday 02:00');
    assert.equal(on(7, 20 * MIN), false, 'Sunday evening');
    assert.equal(on(13, 21 * MIN), true, 'GDD day 14');
    const early = { tuning: { calendarFirstDow: 5 } };                 // pretend day 1 is a Saturday
    assert.equal(S.isFestival('lantern-market', w, data, { day: 0, minute: 21 * MIN, ...early }), false, 'fromDay 7');
    const p = S.whereIs('wren', w, data, { day: 6, minute: 21 * MIN });
    assert.deepEqual([p.source, p.festivalId, p.mapId], ['festival', 'lantern-market', 'green']);
  });

  it('porch talk: 19:00-01:00 on the porch days, keyed to the evening it started', () => {
    // wren sits on her porch Saturday and Sunday evenings (GDD weekdays 5, 6); core 0 = Sunday
    const w = makeWorld();
    const src = (day, minute) => S.whereIs('wren', w, data, { day, minute })?.source;
    assert.equal(src(0, 19 * MIN - 1), 'schedule');
    assert.equal(src(0, 19 * MIN), 'porch', 'Sunday 19:00');
    assert.equal(src(1, 59), 'porch', 'Monday 00:59 is still Sunday evening');
    assert.equal(src(1, 60), 'schedule', 'Monday 01:00');
    assert.equal(src(1, 19 * MIN + 30), 'schedule', 'Monday evening: not a porch day');
    assert.equal(S.porchTalkOpen(w, data, { minute: 0 }), true);
    w.flags[C.porchFlag('wren')] = false;
    assert.equal(src(0, 20 * MIN), 'schedule', 'a dark porch: no porch talk');
  });

  it('shops: open === close is always open; fromDay is tested on the evening the hours began', () => {
    const w = makeWorld();
    for (const m of [0, 359, 360, 1439]) assert.equal(S.isShopOpen({ hours: [360, 360] }, w, data, { minute: m }), true);
    assert.equal(S.isShopOpen({ hours: [0, 1440] }, w, data, { minute: 700 }), true);
    const raft = { id: 'raft', hours: [12 * MIN, 2 * MIN], fromDay: 3 };
    assert.equal(S.isShopOpen(raft, w, data, { day: 1, minute: 13 * MIN }), false, 'GDD day 2');
    assert.equal(S.isShopOpen(raft, w, data, { day: 2, minute: 13 * MIN }), true, 'GDD day 3');
    assert.equal(S.isShopOpen(raft, w, data, { day: 2, minute: 1 * MIN }), false, 'GDD day 3 at 01:00 is GDD day 2\'s night');
    assert.equal(S.isShopOpen(raft, w, data, { day: 3, minute: 1 * MIN }), true, 'GDD day 4 01:00 = day 3\'s night');
    assert.equal(S.isShopOpen(raft, w, data, { day: 3, minute: 2 * MIN }), false, '02:00 closes');
    for (const bad of [null, {}, { hours: [1] }, { hours: [NaN, 5] }, { hours: ['8', '9'] }]) assert.equal(S.isShopOpen(bad, w, data), false);
    assert.equal(S.isShopOpen('nope', w, data), false);
  });

  it('never throws on malformed NPCs, entries and tables (fuzzed)', () => {
    const w = makeWorld({ day: 5, minute: 12 * MIN });
    const rng = makeRng(99);
    const junk = [null, undefined, 0, 'x', NaN, Infinity, -5, [], {}, { tide: 'mid' }, { phase: 'nope' }, { tide: 'low', offset: NaN }, 99999, -1];
    for (let i = 0; i < 400; i++) {
      const sched = Array.from({ length: rng.int(0, 5) }, () => ({
        at: junk[rng.int(0, junk.length - 1)] ?? rng.int(-100, 3000),
        mapId: rng.next() < 0.8 ? 'm' : junk[rng.int(0, junk.length - 1)],
        x: rng.next() < 0.5 ? rng.int(0, 9) : junk[rng.int(0, junk.length - 1)],
        y: 1, days: rng.next() < 0.3 ? [rng.int(0, 6)] : undefined, for: rng.next() < 0.3 ? junk[rng.int(0, junk.length - 1)] : undefined,
      }));
      const npc = { id: `n${i}`, schedule: rng.next() < 0.1 ? 'bad' : sched, porch: rng.next() < 0.2 ? { mapId: 'p', hours: [rng.int(0, 1440), rng.int(0, 1440)] } : undefined, home: rng.next() < 0.5 ? 'h' : undefined };
      const p = S.whereIs(npc, w, data, { minute: rng.int(0, 1439) });
      if (p) {
        assert.equal(typeof p.mapId, 'string');
        assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y));
        assert.ok(Number.isFinite(p.since));
      }
    }
    assert.equal(S.whereIs('ghost', w, data), null, 'no schedule, no home');
    assert.equal(S.whereIs('nobody', w, data), null);
    assert.equal(S.whereIs(null, w, data), null);
    assert.equal(S.whereIs('wren', w, null)?.mapId ?? null, null, 'no data: the id resolves to nothing');
    assert.deepEqual(S.npcsOnMap(w, { npcs: 'nope' }, 'yard'), []);
    assert.equal(S.routeFor({ pathId: 'quay-sweep', mapId: 'elsewhere' }, data), null);
    assert.equal(S.routeFor({ pathId: 'nope', mapId: 'quay' }, data), null);
  });

  it('Porch Supper needs a host row; with none lit there is nobody to host', () => {
    const w = makeWorld();
    for (const id of ['wren', 'juniper', 'tully']) w.flags[C.porchFlag(id)] = false;
    const sup = { festivals: [{ id: 'porch-supper', dow: [5], from: 18 * MIN, to: 20 * MIN, host: 'porch' }] };
    const d = { ...data, ...sup };
    assert.equal(S.porchSupperHost(w, d, 6), null);
    const p = S.whereIs('juniper', w, d, { day: 6, minute: 19 * MIN });
    assert.notEqual(p.source, 'festival', 'no host, no supper');
  });
});

// ---------------------------------------------------------------------------------------------
describe('memory: no-repeat window, stacks, nicknames, malformed lines', () => {
  it('a line said on day d stays out through d+4 and is back on d+5', () => {
    const w = makeWorld({ day: 10, minute: 12 * MIN });
    const only = { id: 'solo', lines: { generic: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] } };
    M.recordLine(w, 'solo', 'a', { day: 10 });
    M.recordLine(w, 'solo', 'b', { day: 6 });
    assert.equal(M.pickLine(only, w, data, { day: 10 }).lineId, 'b', 'b said 4 days ago: still blocked, but least recent');
    assert.equal(M.pickLine(only, w, data, { day: 10 }).repeat, true);
    assert.equal(M.pickLine(only, w, data, { day: 11 }).lineId, 'b', 'day 11: b said 5 days ago is fresh');
    assert.equal(M.pickLine(only, w, data, { day: 11 }).repeat, false);
    assert.equal(M.saidWithin(w, 'solo', 'a', 14, 5), true);
    assert.equal(M.saidWithin(w, 'solo', 'a', 15, 5), false);
    assert.equal(M.saidWithin(w, 'solo', 'a', 9, 5), false, 'a clock moved back does not count the future');
    assert.equal(M.pickLine(only, w, data, { day: 10, tuning: { strictNoRepeat: true, noRepeatDays: 50 } }), null, 'strict: nothing new to say');
  });

  it('Linger skips the line just said; one line only means nothing to linger on', () => {
    const w = makeWorld({ day: 2, minute: 12 * MIN });
    const one = { id: 'one', lines: { generic: [{ id: 'x', text: 'X' }] } };
    const said = M.talkLine(w, data, one);
    assert.equal(said.lineId, 'x');
    assert.equal(M.pickLine(one, w, data, { linger: true }), null);
    M.talk(w, 'one', data);
    assert.deepEqual(M.linger(w, 'one', data), { ok: true });
    assert.deepEqual(M.linger(w, 'one', data), { ok: false, reason: 'already' });
    assert.equal(M.canLinger(w, 'one', data, { day: 3 }), false, 'not talked on day 3');
  });

  it('gifts: thousands remembered without overflow; one counts a day; the cap of 0 never counts', () => {
    const w = makeWorld({ day: 1 });
    let aff = 0;
    for (let d = 0; d < 2000; d++) {
      const r = M.giveGift(w, data, 'wren', 'pear', { day: d });
      aff += r.affinityDelta;
      const again = M.giveGift(w, data, 'wren', 'plum', { day: d });
      assert.equal(again.reaction, 'again');
    }
    assert.equal(w.npcs.wren.gifts.pear.n, 2000);
    assert.equal(w.npcs.wren.affinity, aff);
    assert.equal(aff, 2000 * 3);
    assert.ok(Number.isSafeInteger(w.npcs.wren.affinity));
    const z = makeWorld();
    assert.equal(M.giveGift(z, data, 'wren', 'pear', { tuning: { giftsPerDay: 0 } }).affinityDelta, 0);
    assert.throws(() => M.giveGift(z, data, 'wren', ''), TypeError);
    assert.equal(M.giveGift(z, data, 'stranger', 'pear').reaction, 'neutral', 'an npc without a row is neutral');
    assert.deepEqual(validateWorld(w), []);
  });

  it('nickname counter: 12 characters by code point, whitespace collapsed, empty refused', () => {
    const w = makeWorld();
    assert.equal(M.setNickname(w, 'tully', 'counter', data, { counter: 'Abcdefghijkl' }).ok, true);
    assert.equal(M.setNickname(w, 'tully', 'counter', data, { counter: 'Abcdefghijklm' }).ok, false);
    assert.equal(M.setNickname(w, 'tully', 'counter', data, { counter: '🦡🦡🦡🦡🦡🦡🦡🦡🦡🦡🦡🦡' }).ok, true, '12 emoji = 12 characters');
    assert.equal(M.setNickname(w, 'tully', 'counter', data, { counter: '   ' }).ok, false);
    assert.equal(M.setNickname(w, 'tully', 'counter', data, { counter: '  Big   Sky ' }).nickname, 'Big Sky');
    assert.deepEqual(M.setNickname(w, 'tully', 'accept', data, {}), { ok: false, reason: 'no-offer' });
    assert.deepEqual(M.setNickname(w, 'tully', 'shrug', data), { ok: false, reason: 'bad-choice' });
    assert.equal(M.setNickname(w, 'tully', 'decline', data).nickname, null);
    assert.equal(w.npcs.tully.nicknameChoice, 'decline');
    assert.throws(() => M.setNickname(w, '', 'decline', data), TypeError);
  });

  it('remember: reports a first write as a change even when the value is null; rejects non-JSON', () => {
    const w = makeWorld();
    assert.deepEqual(M.remember(w, 'wren', 'k', null), { changed: true });
    assert.deepEqual(M.remember(w, 'wren', 'k', null), { changed: false });
    assert.deepEqual(M.remember(w, 'wren', 'k', { a: [1] }), { changed: true });
    for (const bad of [undefined, NaN, () => 1, new Date(0), { a: Infinity }, [undefined]]) assert.throws(() => M.remember(w, 'wren', 'z', bad), TypeError);
    let deep = 1;
    for (let i = 0; i < 40; i++) deep = [deep];
    assert.throws(() => M.remember(w, 'wren', 'deep', deep), TypeError, 'a 40-deep value is refused');
    assert.equal(M.recall(w, 'wren', 'missing', 7), 7);
    assert.equal(M.forget(w, 'wren', 'k'), true);
    assert.equal(M.forget(w, 'wren', 'k'), false);
  });

  it('malformed line pools are skipped; unknown tags never hold; the validator names them', () => {
    const npc = { id: 'odd', lines: { generic: [null, 5, { text: 'no id' }, { id: 'ok', text: 'fine' }, { id: 'tag', text: 't', tags: ['moon'] }], night: 'not a list' } };
    const w = makeWorld({ minute: 12 * MIN });
    assert.equal(M.pickLine(npc, w, data).lineId, 'ok');
    assert.equal(M.linesOf(npc).length, 2);
    const problems = M.validateLines({ id: 'v', lines: { a: [{ id: 'x', text: 'x', tags: ['weather'] }], b: [{ id: 'x', text: 'y', tags: ['moon'] }] } });
    assert.equal(problems.length, 3, problems.join('\n'));
    assert.equal(M.pickLine({ id: 'empty' }, w, data), null);
    assert.equal(M.pickLine('nobody', w, data), null);
  });

  it('the rng tie-break is deterministic and stays inside the tied set', () => {
    const npc = { id: 'tie', lines: { generic: ['a', 'b', 'c', 'd'] } };
    const w = makeWorld({ minute: 12 * MIN });
    const seq = (seed) => Array.from({ length: 30 }, (_, i) => M.pickLine(npc, w, data, { rng: makeRng(seed + i) }).lineId).join('');
    assert.equal(seq(5), seq(5));
    assert.match(seq(5), /^(generic[1-4])+$/);
    assert.ok(new Set(seq(5)).size > 1, 'the tie-break spreads');
  });
});

// ---------------------------------------------------------------------------------------------
describe('letters: channels at their edges', () => {
  it('K1 on GDD day 2 through K20 on day 21, then one town letter a morning from day 22; Late Delivery on the 56th', () => {
    const w = litWorld(0, 6 * MIN);
    const bus = recBus();
    const keeperDays = [];
    for (let d = 0; d < 60; d++) {
      at(w, d, 6 * MIN);
      const r = L.deliverMorning(w, data, { bus });
      if (r.keeper !== null) keeperDays.push(C.gameDay(d, C.CALENDAR_DEFAULTS));
      if (r.town.length) assert.ok(C.gameDay(d, C.CALENDAR_DEFAULTS) >= 22, 'town post from day 22');
      L.collectMail(w, data);
      assert.deepEqual(validateWorld(w), [], `day ${d}`);
    }
    assert.deepEqual(keeperDays, Array.from({ length: 20 }, (_, i) => i + 2));
    assert.equal(w.letters.got.filter((n) => n >= 39 && n <= 56).length, 18, 'every town letter by post');
    assert.equal(bus.of('letters:late-delivery').length, 0, 'family letters still missing: no party');
    for (let d = 60; d < 80; d++) {
      at(w, d, 18 * MIN);
      L.deliverEvening(w, data, { bus });
      at(w, d, 19 * MIN);
      L.carry(w, data, { bus });
    }
    assert.equal(bus.of('letters:late-delivery').length, 1, 'fires exactly once');
    assert.equal(w.flags[L.LATE_DELIVERY_FLAG], C.gameDay(w.letters.familyDay, C.CALENDAR_DEFAULTS));
    assert.equal(L.deliverEvent(w, data, 'lantern').ok, true);
    assert.equal(bus.of('letters:late-delivery').length, 1, 'event letters never re-fire it');
  });

  it('no accrual: a clock jump of 30 days brings one letter; repeats on one day bring none; going back brings none', () => {
    const w = litWorld(1);
    assert.equal(L.deliverMorning(w, data).keeper, 1);
    assert.equal(L.deliverMorning(w, data).keeper, null, 'same day');
    L.collectMail(w, data);
    at(w, 31, 6 * MIN);
    assert.equal(L.deliverMorning(w, data).keeper, 2, 'one, the next in order');
    assert.equal(L.deliverMorning(w, data).keeper, null);
    L.collectMail(w, data);
    at(w, 10, 6 * MIN);
    assert.deepEqual([L.deliverMorning(w, data).keeper, L.deliverMorning(w, data).reason], [null, 'already']);
  });

  it('a dark porch slides the series; an uncollected letter holds the next', () => {
    const w = makeWorld({ day: 1, minute: 6 * MIN });
    assert.equal(L.deliverMorning(w, data).reason, 'porch-dark');
    w.loans.tier = 2;
    at(w, 4, 6 * MIN);
    assert.equal(L.deliverMorning(w, data).keeper, 1, 'K1 on the first lit morning');
    at(w, 5, 6 * MIN);
    assert.equal(L.deliverMorning(w, data).reason, 'mailbox-full');
    L.markRead(w, data, 1);
    at(w, 6, 6 * MIN);
    assert.equal(L.deliverMorning(w, data).keeper, 2);
  });

  it('family letter edges: 17:59 not yet, 18:00 at the counter, carried till 01:59, 02:00 closed', () => {
    const w = makeWorld({ day: 0, minute: 18 * MIN });
    assert.equal(L.deliverEvening(w, data).reason, 'too-early', 'GDD day 1');
    at(w, 1, 18 * MIN - 1);
    assert.equal(L.deliverEvening(w, data).reason, 'not-yet');
    at(w, 1, 18 * MIN);
    assert.equal(L.deliverEvening(w, data).family, 21);
    at(w, 2, 2 * MIN);
    assert.deepEqual(L.carry(w, data), { ok: false, reason: 'closed' });
    at(w, 2, 1 * MIN + 59);
    assert.deepEqual(L.carry(w, data), { ok: true, n: 21 });
  });

  it('a family letter missed at 18:00 still comes after midnight while the counter is open', () => {
    const w = makeWorld({ day: 3, minute: 1 * MIN + 30 });
    const r = L.deliverEvening(w, data);
    assert.equal(r.family, 21);
    assert.equal(w.letters.familyDay, 2, 'it was the evening before\'s letter');
    at(w, 3, 18 * MIN);
    assert.equal(L.deliverEvening(w, data).reason, 'counter-full');
    at(w, 4, 2 * MIN);
    assert.equal(L.deliverEvening(w, data).reason, 'not-yet', 'after 02:00 the evening is over');
    const shut = makeWorld({ day: 3, minute: 30 });
    assert.equal(L.deliverEvening(shut, data, { tuning: { hesperCounterHours: [18 * 60, 23 * 60] } }).reason, 'not-yet', 'a counter closing before midnight has no small hours');
  });

  it('doors: wrong door, not carrying, double delivery; dark porch waits; lightsPorch lights it', () => {
    const w = makeWorld({ day: 1, minute: 18 * MIN });
    const gave = [];
    const crit = [];
    const opts = { giveItem: (_w, id, n) => gave.push([id, n]), addCreature: (_w, c) => crit.push(c.species) };
    L.deliverEvening(w, data);
    L.carry(w, data);
    assert.deepEqual(L.deliverToDoor(w, data, 21, 'odile', opts), { ok: false, reason: 'wrong-door' });
    assert.deepEqual(L.deliverToDoor(w, data, 99, 'dorrows', opts), { ok: false, reason: 'not-carrying' });
    const r = L.deliverToDoor(w, data, 21, 'dorrows', opts);
    assert.equal(r.returned, true, 'F1 lights its own porch');
    assert.equal(w.flags[C.porchFlag('dorrows')], true);
    assert.deepEqual([gave, crit], [[['heirloom-1', 1]], ['crit-1']]);
    assert.deepEqual(L.deliverToDoor(w, data, 21, 'dorrows', opts), { ok: false, reason: 'not-carrying' });
    at(w, 2, 18 * MIN);
    L.deliverEvening(w, data);
    L.carry(w, data);
    const dark = L.deliverToDoor(w, data, 22, 'odile', opts);
    assert.deepEqual([dark.returned, w.letters.awaiting], [false, [22]]);
    assert.deepEqual(L.releaseHeirlooms(w, data, opts), [], 'still dark');
    w.flags[C.porchFlag('odile')] = true;
    assert.deepEqual(L.releaseHeirlooms(w, data, opts).map((h) => h.n), [22]);
    assert.deepEqual(L.releaseHeirlooms(w, data, opts), [], 'once');
    assert.deepEqual(validateWorld(w), []);
  });

  it('the string wall: duplicates and bad ids refused; a letter already posted is not delivered twice', () => {
    const w = makeWorld({ day: 25 });
    w.letters.got.push(39); w.letters.delivered = 1; w.letters.mailbox.push(39);
    assert.deepEqual(L.pinFind(w, data, 'find-1'), { ok: true, letter: null, lateDelivery: false });
    assert.deepEqual(L.pinFind(w, data, 'find-1'), { ok: false, reason: 'already-pinned' });
    for (const bad of ['', null, 7]) assert.deepEqual(L.pinFind(w, data, bad), { ok: false, reason: 'bad-find' });
    assert.equal(L.pinFind(w, data, 'mystery-rock').letter, null, 'a find with no letter still pins');
    assert.equal(L.pinFind(w, data, 'find-2').letter, 40);
    assert.deepEqual(validateWorld(w), []);
  });

  it('markRead counts once, sets reveal flags once, and refuses an undelivered letter', () => {
    const w = litWorld(1);
    L.deliverMorning(w, data);
    assert.deepEqual(L.markRead(w, data, 2), { ok: false, reason: 'not-delivered' });
    const r = L.markRead(w, data, 1);
    assert.deepEqual([r.ok, r.already, r.flags], [true, false, ['sp.k1-read']]);
    assert.equal(L.markRead(w, data, 1).already, true);
    assert.equal(w.stats.lettersRead, 1);
  });

  it('letters with missing or garbage rows never crash the post', () => {
    const w = litWorld(1);
    const junk = { letters: [null, { n: 'x' }, { n: 1.5 }, { id: 'k1', n: 1 }, { id: 'k2', n: 2, unlock: { flag: 'sp.never' } }] };
    assert.equal(L.deliverMorning(w, junk).keeper, 1);
    L.collectMail(w, junk);
    at(w, 2, 6 * MIN);
    assert.equal(L.deliverMorning(w, junk).reason, 'locked');
    assert.equal(L.deliverMorning(createNewWorld({ seedCode: 'E' }), {}).reason, 'too-early');
    const lit = litWorld(3);
    assert.equal(L.deliverMorning(lit, {}).reason, 'none-left');
    assert.equal(L.nextLetterPreview(lit, {}).n, null);
    assert.deepEqual(L.validateLetters({ letters: [{ id: 'f1', n: 1, channel: 'family' }, { id: 'q', n: 2, channel: 'q' }] }).length, 2);
  });
});

// ---------------------------------------------------------------------------------------------
describe('threads: caps, Mondays, rewards, garbage', () => {
  const met = (w, ...ids) => { for (const id of ids) M.talk(w, id, data); };

  it('one beat a day per thread; spacing by days; the Monday waiver; immediate bypasses the cap', () => {
    const w = makeWorld({ day: 2 });                                 // Tuesday
    met(w, 'tully');
    assert.equal(T.advance(w, data, 'tully-mile').ok, true);
    assert.equal(T.advance(w, data, 'tully-mile').reason, 'today');
    assert.equal(T.advance(w, data, 'tully-mile', { day: 3 }).reason, 'spacing', 'beat 2 waits 2 days');
    assert.equal(T.advance(w, data, 'tully-mile', { day: 4 }).ok, true);
    const mon = makeWorld({ day: 8 });                               // core day 8 = Monday (core 0 is a Sunday)
    met(mon, 'tully');
    T.advance(mon, data, 'tully-mile', { day: 7 });
    assert.equal(T.advance(mon, data, 'tully-mile', { day: 8 }).ok, true, 'Monday waives the 2-day spacing');
    const tue = makeWorld({ day: 9 });
    met(tue, 'tully');
    T.advance(tue, data, 'tully-mile', { day: 8 });
    assert.equal(T.advance(tue, data, 'tully-mile', { day: 9 }).reason, 'spacing', 'Tuesday does not');
    const cast = makeWorld({ day: 2 });
    cast.flags['sp.dock-done'] = true;
    met(cast, 'linnet');
    assert.equal(T.advance(cast, data, 'linnet-grub').ok, true);
    assert.equal(T.advance(cast, data, 'linnet-grub').ok, true, 'advance.immediate');
    assert.equal(cast.threads['linnet-grub'].done, true);
  });

  it('the resident share is paid once with the content data and the tuned fraction', () => {
    const w = makeWorld({ day: 3 });
    const seen = [];
    const tuning = { residentShareFraction: 0.2 };
    const collab = { residentShare: (world, id, ctx) => { seen.push(ctx); return loans.residentShare(world, id, ctx); } };
    T.setBeat(w, data, 'tully-mile', 3, { loans: collab, tuning });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].data, data);
    assert.equal(seen[0].tuning, tuning);
    assert.equal('day' in seen[0], false, 'no econ `day` override');
    assert.equal(seen[0].threadDay, 3);
    assert.equal(w.loans.paid, Math.round(6000 * 0.2), '20% of loan 1 (the tuned fraction)');
    T.setBeat(w, data, 'tully-mile', 1, { loans: collab, tuning });
    T.setBeat(w, data, 'tully-mile', 3, { loans: collab, tuning });
    assert.equal(w.loans.paid, Math.round(6000 * 0.2), 're-completing a re-opened thread pays nothing more');
    assert.deepEqual(w.loans.residentShares, ['tully-mile']);
    assert.deepEqual(validateWorld(w), []);
  });

  it('kinds: cast and template threads do not pay; a beat reward can override', () => {
    const w = makeWorld({ day: 3 });
    const calls = [];
    const collab = { residentShare: (_w, id) => { calls.push(id); return { ok: true }; } };
    T.setBeat(w, data, 'thessaly-bench', 3, { loans: collab });
    w.flags['sp.dock-done'] = true;
    T.setBeat(w, data, 'linnet-grub', 2, { loans: collab });
    T.setBeat(w, data, 'odile-lights', 2, { loans: collab });
    assert.deepEqual(calls, [], 'template, cast, and a lead thread whose last beat says share: false');
  });

  it('malformed thread rows: gaps, missing ids, unknown threads, bad beats', () => {
    const w = makeWorld({ day: 2 });
    const d = { ...data, threads: [null, { id: 'gap', npcId: 'x', beats: [{ id: 1, cond: true }, { id: 3, cond: true }, { cond: true }, null] }, { id: 'nobeats', npcId: 'x' }] };
    w.npcs.x = { ...w.npcs.wren, met: true };
    M.talk(w, 'x', d);
    assert.equal(T.advance(w, d, 'gap').ok, true);
    assert.equal(T.advance(w, d, 'gap', { day: 3 }).reason, 'no-beat', 'beat 2 missing: the thread stalls, it does not skip');
    assert.equal(T.advance(w, d, 'nobeats').reason, 'no-beat');
    assert.equal(T.advance(w, d, 'unknown').reason, 'unknown-thread');
    for (const bad of [-1, 1.5, 4, NaN]) assert.equal(T.setBeat(w, d, 'gap', bad).reason, 'bad-beat');
    assert.deepEqual(T.eligibleBeats(w, { threads: 'nope' }), []);
    assert.deepEqual(T.openThreads(w, d).map((t) => t.threadId), ['gap']);
  });
});

// ---------------------------------------------------------------------------------------------
describe('dayPage: which morning, stale tallies, collaborators', () => {
  it('nextMorning: this morning until 06:59, tomorrow from 07:00, whatever the tally says', () => {
    const w = makeWorld({ day: 5, minute: 5 * MIN + 59 });
    w.dayPage.day = 4;
    assert.equal(P.nextMorning(w, data), 5);
    at(w, 5, 6 * MIN);
    assert.equal(P.nextMorning(w, data), 5, 'at the 06:00 anchor / just woken: this morning');
    at(w, 5, 6 * MIN + 59);
    assert.equal(P.nextMorning(w, data), 5);
    at(w, 5, 7 * MIN);
    assert.equal(P.nextMorning(w, data), 6, 'a missed morning is not written late');
    at(w, 5, 6 * MIN);
    w.dayPage.day = 5;
    assert.equal(P.nextMorning(w, data), 5, 'already written: the overnight answers already');
    assert.equal(P.overnight(w, data, null).reason, 'already');
    w.dayPage.day = -1;
    assert.equal(P.nextMorning(w, data), 5);
    assert.equal(P.nextMorning(w, data, { graceMinutes: 0 }), 6);
    assert.equal(P.OVERNIGHT_GRACE_MINUTES, 60);
    at(w, 5, 0);
    assert.equal(P.nextMorning(w, data), 5, 'Sleep after midnight');
  });

  it('Sleep skipping to dawn then the overnight: the right morning, its letter, once', () => {
    const w = litWorld(0, 22 * MIN);
    at(w, 1, 6 * MIN);                                               // woke at 06:00 on GDD day 2
    const r = P.overnight(w, data, null);
    assert.deepEqual([r.ran, r.day, r.endedDay, r.mail.keeper], [true, 1, 0, 1]);
    assert.equal(P.overnight(w, data, null).reason, 'already');
    at(w, 1, 23 * MIN);
    const n = P.overnight(w, data, null);
    assert.deepEqual([n.day, n.endedDay], [2, 1], 'that evening\'s Sleep leads into day 2');
  });

  it('an event in the small hours writes into the evening-before\'s page, not tomorrow\'s', () => {
    const w = litWorld(1, 30);
    w.dayPage.day = -1;
    P.noteEvent(w, 'wallet:changed', { currency: 'main', delta: 40 });
    assert.equal(w.dayPage.day, 0);
    const r = P.overnight(w, data, null);
    assert.deepEqual([r.ran, r.day, r.summary.buttons], [true, 1, 40]);
    assert.equal(P.pageDay(w, { minute: 6 * MIN }), 1);
    assert.equal(P.pageDay(makeWorld({ day: 0, minute: 30 })), 0, 'never negative');
  });

  it('a stale tally becomes the page of the night that closes it', () => {
    const w = litWorld(9, 22 * MIN);
    P.beginDay(w, 6);
    P.noteEvent(w, 'wallet:changed', { currency: 'main', delta: 700 });
    const r = P.overnight(w, data, null);
    assert.deepEqual([r.day, r.endedDay, r.summary.day, r.summary.buttons], [10, 9, 9, 700]);
    assert.match(w.log.at(-1), /^D10 · \+700/);
  });

  it('a hook that throws anything is recorded with a string message', () => {
    const w = litWorld(2, 22 * MIN);
    const r = P.overnight(w, data, null, { hooks: { regrow: () => { throw 'plain'; }, cracks: () => { throw null; }, wanted: () => { throw { message: 7 }; } } });
    assert.deepEqual(r.errors.map((e) => e.step), ['regrow', 'cracks', 'wanted']);
    assert.ok(r.errors.every((e) => typeof e.message === 'string'));
    assert.equal(r.ran, true);
    assert.deepEqual(validateWorld(w), []);
  });

  it('step.base gives the overworld\'s Glint and weather; step.rng is already positioned', () => {
    const w = litWorld(4, 22 * MIN);
    let glint = null; let viaRng = null; let plan = null;
    P.overnight(w, data, null, {
      hooks: {
        glint: (world, _d, s) => { glint = gather.glintFor(world, FLATS, s.base, { day: s.day }); viaRng = s.rng.nextUint32(); },
        weather: (world, _d, s) => { plan = weather.rollDay(world, null, s.base, { day: s.gameDay }).today; },
      },
    });
    const ref = gather.glintFor(w, FLATS, gather.planRng(w), { day: 5 });
    assert.deepEqual([glint.x, glint.y], [ref.x, ref.y]);
    assert.equal(viaRng, forkFor(w.run.seed, 'glint:5').nextUint32());
    assert.deepEqual(plan, weather.planDay(6, null, makeRng(w.run.seed)), 'weather:<GDD day 6> from the master seed');
  });

  it('the tally refuses junk events and never goes negative or NaN', () => {
    const w = makeWorld({ day: 3, minute: 12 * MIN });
    for (const p of [null, {}, { currency: 'main', delta: NaN }, { currency: 'main', delta: Infinity }, { currency: 'main', delta: -5 }, { currency: 'main', delta: '9' }]) {
      assert.equal(P.noteEvent(w, 'wallet:changed', p), false);
    }
    for (const p of [null, { amount: -1 }, { amount: 2.5 }, { amount: NaN }]) assert.equal(P.noteEvent(w, 'loan:paid', p), false);
    P.noteEvent(w, 'wallet:changed', { currency: 'main', delta: Number.MAX_SAFE_INTEGER });
    assert.equal(w.dayPage.earned, Number.MAX_SAFE_INTEGER);
    assert.deepEqual([w.dayPage.paid, w.dayPage.notes], [0, []]);
  });
});

// ---------------------------------------------------------------------------------------------
describe('long run, determinism, saves', () => {
  it('60 in-game days of clock + economy + letters + threads keep the world valid, without drift or NaN', () => {
    const g = runDays(makeGame('TOWN-SIM-60'), 0, 60);
    assert.deepEqual(g.problems, []);
    const w = g.store.world;
    assert.equal(w.dayPage.day, 60, 'one page per morning, none skipped ahead, none behind');
    assert.equal(w.letters.got.filter((n) => n <= 20).length, 20, 'all twenty Keeper letters');
    assert.equal(w.letters.got.length, 56, 'the whole serial');
    assert.equal(new Set(w.letters.got).size, w.letters.got.length, 'no duplicates');
    assert.ok(Number.isInteger(w.flags[L.LATE_DELIVERY_FLAG]), 'the Late Delivery party fired');
    assert.ok(w.log.length > 0 && w.log.length <= 60);
    assert.equal(g.counts['dayPage:error'] ?? 0, 0);
    assert.ok(w.loans.tier >= 2);
    assert.equal(w.weather.day, 61, 'the last overnight rolled GDD day 61');
    assert.deepEqual(validateWorld(w), []);
  });

  it('the same seed gives the same world in another process', () => {
    const local = digest(runDays(makeGame('TOWN-DET'), 0, 45).store.world);
    const sim = fileURLToPath(new URL('./fixtures/town.sim.mjs', import.meta.url));
    const out = JSON.parse(execFileSync(process.execPath, [sim, 'TOWN-DET', '45'], { encoding: 'utf8' }));
    assert.deepEqual(out, { digest: local, problems: 0 });
    assert.notEqual(digest(runDays(makeGame('TOWN-OTHER'), 0, 45).store.world), local, 'another seed differs');
  });

  it('a save on day 30 loaded through state/persist continues to the same day-60 world', () => {
    const straight = runDays(makeGame('TOWN-SAVE'), 0, 60);
    const first = runDays(makeGame('TOWN-SAVE'), 0, 30);
    const persist = createPersist({ storage: new Map(), prefix: 'lampfall.', now: () => 1 });
    const scenes = { top: () => ({ name: 'overworld' }), has: () => false, isTransitioning: () => false };
    const G = { store: first.store, bus: first.store.bus, rngs: first.rngs, scenes, get world() { return first.store.world; } };
    const saved = persist.autosave(G, 'manual');
    assert.equal(saved.ok, true, JSON.stringify(saved.error));
    const loaded = persist.load(saved.slot);
    assert.equal(loaded.ok, true, JSON.stringify(loaded.error));
    assert.equal(loaded.world.v, SCHEMA_VERSION);
    assert.deepEqual(loaded.world.letters, first.store.world.letters);
    assert.deepEqual(loaded.world.dayPage, first.store.world.dayPage);
    assert.deepEqual(loaded.world.npcs, first.store.world.npcs);
    const second = runDays(makeGame('TOWN-SAVE', loaded.world), 30, 60);
    assert.deepEqual(second.problems, []);
    assert.equal(digest(second.store.world), digest(straight.store.world));
  });

  it('a v3 save mid-letters migrates, validates and keeps the morning rules', () => {
    const w = litWorld(5, 10 * MIN);
    const v3 = JSON.parse(JSON.stringify(w));
    v3.v = 3;
    v3.letters = { delivered: 5, read: [1, 2, 3, 4], today: 5 };
    delete v3.dayPage;
    const res = migrateWorld(v3);
    assert.equal(res.ok, true);
    const m = res.world;
    assert.deepEqual(validateWorld(m), []);
    assert.deepEqual([m.letters.keeperDay, m.letters.mailbox, m.dayPage.day], [5, [5], 5]);
    L.markRead(m, data, 5);
    assert.equal(L.deliverMorning(m, data).reason, 'already', 'no second Keeper letter on the day of the save');
    at(m, 5, 22 * MIN);
    assert.equal(P.overnight(m, data, null).day, 6, 'the first night after loading leads into tomorrow');
  });
});
