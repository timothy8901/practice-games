// Adversarial tests for lane SYS-GATHER-WORLD (systems/fieldLog, gather, fishing, encounter):
// boundaries (midnight wrap, day rollover, exact tide-window and night edges), max stacks, zero
// balances, malformed data, determinism across processes, a 60-day simulation of clock + economy,
// and save round trips through state/persist.
// Run: node --test test/sysGatherWorld.adversarial.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import * as FL from '../js/systems/fieldLog.js';
import * as G from '../js/systems/gather.js';
import * as F from '../js/systems/fishing.js';
import * as E from '../js/systems/encounter.js';
import * as wallet from '../js/systems/wallet.js';
import { makeRng } from '../js/core/rng.js';
import { tidePhaseAt, tideStateAt, TIDE_PERIOD_MINUTES } from '../js/core/time.js';
import { validateWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import { createRngs } from '../js/state/rngs.js';
import { createPersist } from '../js/state/persist.js';
import { migrateWorld } from '../js/state/migrate.js';
import { TUNING } from '../js/data/tuning.js';
import { DATA, TOWN, ISLE, POINT, makeWorld, at, LOW, recordingBus } from './fixtures/gatherLane.fixture.mjs';
import { digest } from './fixtures/gatherLaneDigest.mjs';

const T0 = { tideOffset: 0 };
const base = (extra = {}) => ({ data: DATA, lead: null, ...T0, ...extra });
const tree = (id) => TOWN.entities.find((e) => e.id === id);
const fishShadow = (fishId, extra = {}) => ({ id: `s-${fishId}`, fishId, creature: null, silhouette: 'small', shape: null, size: 12.3, x: 31, y: 21, named: false, tell: null, headliner: false, ...extra });

/** Ticks a session one frame at a time until `phase` (or a frame cap). */
function until(s, phase, cap = 5000) {
  for (let i = 0; i < cap && s.phase !== phase && !F.isOver(s); i++) F.tick(s, 1);
  return s;
}

describe('tuning.js stays valid for every lane module', () => {
  it('data/tuning.js resolves without throwing and carries every lane key', () => {
    for (const m of [FL, G, F, E]) {
      assert.doesNotThrow(() => m.tuningOf(TUNING));
      for (const k of m.TUNING_KEYS) assert.ok(Object.prototype.hasOwnProperty.call(TUNING, k), `tuning.js lacks ${k}`);
    }
  });
  it('GDD-00 fixed numbers', () => {
    assert.equal(G.DEFAULTS.glintBase + G.DEFAULTS.glintPerDay * 1, 560, 'day 1 Glint');
    assert.equal(F.DEFAULTS.fishReachFloor, 0.4);
    assert.deepEqual(F.DEFAULTS.fishShadowsPerReach, [4, 8]);
    assert.deepEqual(F.DEFAULTS.fishBiteFrames, [7, 31]);
    assert.deepEqual(F.DEFAULTS.fishGentleFrames, [36, 54]);
    assert.equal(FL.DEFAULTS.fishTellCatches, 3);
    assert.equal(FL.DEFAULTS.findCleanMult, 1.4);
    assert.equal(FL.DEFAULTS.creatureBonuses.brine.tellCatches, 1);
    assert.equal(FL.DEFAULTS.creatureBonuses.brine.biteWindowMult, 1.5);
    assert.equal(E.DEFAULTS.errantLitChance, 1 / 120);
    assert.equal(E.DEFAULTS.encounterNightLevelBonus, 2);
    assert.equal(E.DEFAULTS.errantReturnPlayMs, 2 * 3600 * 1000);
  });
  it('a malformed override throws a readable TypeError naming the key', () => {
    assert.throws(() => F.tuningOf({ fishReachFloor: 1.5 }), /fishReachFloor/);
    assert.throws(() => E.tuningOf({ errantLitChance: NaN }), /errantLitChance/);
    assert.throws(() => FL.tuningOf({ creatureBonuses: { brine: { teleport: true } } }), /creatureBonuses/);
    assert.throws(() => G.tuningOf('nope'), TypeError);
  });
});

describe('boundaries: night and tide-window edges', () => {
  it('night is [18:00, 06:00): 17:59.99 is day, 18:00 night, 05:59.99 night, 06:00 day', () => {
    assert.equal(G.isNightMinute(1079.99), false);
    assert.equal(G.isNightMinute(1080), true);
    assert.equal(G.isNightMinute(359.99), true);
    assert.equal(G.isNightMinute(360), false);
    const w = makeWorld();
    assert.equal(E.isNight(w, { total: at(4, 17, 59) }), false);
    assert.equal(E.isNight(w, { total: at(4, 18) }), true);
    assert.equal(E.isNight(w, { total: at(5, 5, 59) }), true);
    assert.equal(E.isNight(w, { total: at(5, 6) }), false);
  });
  it('the flats window is inclusive at exactly ±90 minutes, closed beyond (fractional minutes too)', () => {
    const w = makeWorld();
    for (const [dt, open] of [[-90, true], [90, true], [-90.5, false], [90.01, false], [0, true]]) {
      assert.equal(G.lowInfo(w, base({ total: 5 * LOW + dt })).inWindow, open, String(dt));
    }
  });
  it('the Glint digs at exactly low − 90 and not at low + 91', () => {
    const w = makeWorld();
    const lowT = 5 * LOW;
    const g = G.glintFor(w, TOWN, G.planRng(w), base({ total: lowT - 90 }));
    assert.equal(G.dig(w, TOWN, g.x, g.y, G.planRng(w), base({ total: lowT + 91 })).ok, false);
    const r = G.dig(w, TOWN, g.x, g.y, G.planRng(w), base({ total: lowT - 90 }));
    assert.deepEqual([r.ok, r.kind], [true, 'glint']);
  });
  it('lowInfo agrees with core/time at every low for 60 days (no drift): phase 0, state low, 745 min apart', () => {
    const w = makeWorld();
    const off = 321;
    let prev = null;
    for (let t = 0; t < 60 * 1440; t += 37) {
      const li = G.lowInfo(w, { total: t, tideOffset: off });
      assert.ok(Math.abs(li.minutesFromLow) <= TIDE_PERIOD_MINUTES / 2);
      assert.ok(Math.abs(tidePhaseAt(li.lowTotal, off)) < 1e-9 || Math.abs(tidePhaseAt(li.lowTotal, off) - 1) < 1e-9);
      assert.equal(tideStateAt(li.lowTotal, off), 'low');
      if (prev !== null && li.lowIndex !== prev.lowIndex) assert.equal(li.lowTotal - prev.lowTotal, TIDE_PERIOD_MINUTES * (li.lowIndex - prev.lowIndex));
      prev = li;
    }
  });
  it('skyglass digs only at a NIGHT low; 18:00 inside a low window opens it, 17:59 does not', () => {
    // a low at 18:30 on day 2: offset so that 2*1440 + 1110 is a low
    const lowT = at(2, 18, 30);
    const off = lowT % TIDE_PERIOD_MINUTES;
    const w = makeWorld();
    const ctx = (total) => ({ data: DATA, lead: null, tideOffset: off, total });
    const li = G.lowInfo(w, ctx(lowT));
    const relics = G.skyglassFor(w, TOWN, G.planRng(w), li.lowIndex, ctx(lowT));
    assert.ok(relics.length >= 1 && relics.length <= 3);
    const glint = G.glintFor(w, TOWN, G.planRng(w), ctx(lowT));
    const sparkles = G.sparklesFor(w, TOWN, G.planRng(w), li.lowIndex, ctx(lowT));
    const k = relics.find((r) => !(r.x === glint.x && r.y === glint.y) && !sparkles.some((s) => s.x === r.x && s.y === r.y));
    if (!k) return; // every relic shares a tile with a higher-priority find on this seed
    assert.notEqual(G.dig(w, TOWN, k.x, k.y, G.planRng(w), ctx(at(2, 17, 59))).kind, 'skyglass');
    assert.equal(G.dig(w, TOWN, k.x, k.y, G.planRng(w), ctx(at(2, 18))).kind, 'skyglass');
    assert.equal(G.dig(w, TOWN, k.x, k.y, G.planRng(w), ctx(at(2, 18, 1))).ok, false, 'taken');
  });
  it('never more than 3 skyglass relics per low, at least 1, over 500 lows', () => {
    const w = makeWorld();
    for (let k = 0; k < 500; k++) {
      const n = G.skyglassFor(w, TOWN, G.planRng(w), k, base()).length;
      assert.ok(n >= 1 && n <= 3, `${n} at low ${k}`);
    }
  });
  it('Glass/Hollow by day shows the relics of the next NIGHT low dimly, and exactly those dig there', () => {
    const w = makeWorld();
    const dayLow = 3 * LOW; // day 1 13:15: its window never touches night
    assert.equal(G.lowTouchesNight(dayLow, base()), false);
    const nl = G.nextNightLow(w, base({ total: dayLow }));
    assert.equal(nl.lowIndex, 4);
    assert.equal(G.lowTouchesNight(nl.lowTotal, base()), true);
    const ahead = G.skyglassFor(w, TOWN, G.planRng(w), 4, base());
    const hollow = base({ total: dayLow, lead: { types: ['Hollow'] } });
    const seen = [];
    for (let x = 0; x < 10; x++) for (const s of G.senses(w, TOWN, { x, y: 21 }, G.planRng(w), hollow).skyglass) seen.push(`${s.x},${s.y},${s.dim}`);
    const want = new Set(ahead.map((s) => `${s.x},${s.y},true`));
    assert.deepEqual(new Set(seen), want);
    // a night low is its own next night low
    assert.equal(G.nextNightLow(w, base({ total: 2 * LOW })).lowIndex, 2);
    // a 17:00 low (window to 18:30) touches night
    assert.equal(G.lowTouchesNight(at(1, 17), base()), true);
    assert.equal(G.lowTouchesNight(at(1, 7, 31), base()), false);
    assert.equal(G.lowTouchesNight(at(1, 7, 29), base()), true);
  });
});

describe('boundaries: midnight wrap and day rollover', () => {
  it('a purse a day: 23:59 and 00:00 are two days; the same day never pays twice', () => {
    const w = makeWorld();
    const paid = [];
    const ctx = (total) => base({ total, earn: (a) => paid.push(a) });
    const rng = makeRng(5);
    G.shakeTree(w, TOWN, 't-own-purse', rng, ctx(at(1, 23, 59)));
    G.shakeTree(w, TOWN, 't-own-purse', rng, ctx(at(1, 23, 59)));
    G.shakeTree(w, TOWN, 't-own-purse', rng, ctx(at(2, 0)));
    G.shakeTree(w, TOWN, 't-own-purse', rng, ctx(at(2, 12)));
    assert.deepEqual(paid, [1000, 1000]);
  });
  it('the hive hums once per day; the hum always precedes the outcome', () => {
    const w = makeWorld();
    const a = G.shakeTree(w, TOWN, 't-bees', makeRng(1), base({ total: at(1, 23, 59), net: true }));
    assert.deepEqual(a.events.map((e) => e.type), ['shake', 'hum', 'honey']);
    assert.equal(a.events[1].delayMs, 1000);
    assert.deepEqual(G.shakeTree(w, TOWN, 't-bees', makeRng(1), base({ total: at(1, 23, 59) })).events.map((e) => e.type), ['shake', 'bare']);
    const b = G.shakeTree(w, TOWN, 't-bees', makeRng(1), base({ total: at(2, 0) }));
    assert.deepEqual(b.events.map((e) => e.type), ['shake', 'hum', 'stung'], 'no net: stung');
    const c = G.shakeTree(w, TOWN, 't-bees', makeRng(1), base({ total: at(3, 0), lead: { types: ['Gust'] } }));
    assert.equal(c.hive.outcome, 'blown-clear');
  });
  it('regrow 2 days after stripping, ripe after 3 (unripe on the regrow day), across midnight', () => {
    const w = makeWorld();
    const strip = (total) => { for (let i = 0; i < 3; i++) G.shakeTree(w, TOWN, 't-pear', makeRng(i), base({ total })); };
    strip(at(5, 23, 59));
    assert.equal(G.treeState(w, TOWN, 't-pear', base({ total: at(6, 0) })).fruitLeft, 0);
    assert.equal(G.treeState(w, TOWN, 't-pear', base({ total: at(6, 23, 59) })).fruitLeft, 0);
    const back = G.treeState(w, TOWN, 't-pear', base({ total: at(7, 0) }));
    assert.deepEqual([back.fruitLeft, back.ripe, back.regrowDay, back.ripeDay], [3, false, 7, 8]);
    assert.equal(G.treeState(w, TOWN, 't-pear', base({ total: at(8, 0) })).ripe, true);
    const given = [];
    const r = G.shakeTree(w, TOWN, 't-pear', makeRng(9), base({ total: at(8, 0), give: (id, n) => given.push([id, n]) }));
    assert.deepEqual([r.fruit.ripe, r.fruit.value], [true, Math.round(120 * 1.25)]);
    assert.deepEqual(given, [['pear', 1]]);
  });
  it('a low that spans midnight gives one Glint per calendar day: the 23:30 dig and the 00:30 dig', () => {
    const lowT = at(2, 0);                         // a low exactly at midnight of day 2
    const off = lowT % TIDE_PERIOD_MINUTES;
    const w = makeWorld();
    const paid = [];
    const ctx = (total) => ({ data: DATA, lead: null, tideOffset: off, total, earn: (a) => paid.push(a) });
    const g1 = G.glintFor(w, TOWN, G.planRng(w), ctx(lowT - 30));
    assert.equal(G.dig(w, TOWN, g1.x, g1.y, G.planRng(w), ctx(lowT - 30)).kind, 'glint');
    assert.equal(G.dig(w, TOWN, g1.x, g1.y, G.planRng(w), ctx(lowT - 10)).kind === 'glint', false, 'day 1 Glint is gone');
    const g2 = G.glintFor(w, TOWN, G.planRng(w), ctx(lowT + 30));
    assert.equal(g2.dug, false);
    assert.equal(G.dig(w, TOWN, g2.x, g2.y, G.planRng(w), ctx(lowT + 30)).kind, 'glint');
    assert.equal(G.glintFor(w, TOWN, G.planRng(w), ctx(lowT + 60)).dug, true);
    assert.deepEqual(paid, [500 + 60 * 2, 500 + 60 * 3]);
  });
  it('cracks are per day: yesterday\'s opened keys are pruned on the next crack dig', () => {
    const w = makeWorld();
    const c1 = G.cracksFor(w, TOWN, G.planRng(w), base({ total: at(1, 9) }));
    G.dig(w, TOWN, c1[0].x, c1[0].y, G.planRng(w), base({ total: at(1, 23, 59) }));
    assert.equal(Object.keys(w.maps['town-map'].cracks).length, 1);
    const c2 = G.cracksFor(w, TOWN, G.planRng(w), base({ total: at(2, 0) }));
    assert.ok(c2.every((c) => !c.opened), 'a new day, fresh cracks');
    G.dig(w, TOWN, c2[0].x, c2[0].y, G.planRng(w), base({ total: at(2, 0) }));
    assert.deepEqual(Object.keys(w.maps['town-map'].cracks), [c2[0].key]);
  });
  it('a downed Errant returns at 00:00 the next day, at the next badge, or after exactly 2 h of play', () => {
    const w = makeWorld();
    w.stats.playMs = 1000;
    E.markErrantDown(w, 'errant-1', { total: at(1, 12) });
    assert.equal(E.errantUp(w, 'errant-1', { total: at(1, 23, 59) }), false);
    assert.equal(E.errantUp(w, 'errant-1', { total: at(2, 0) }), true);
    const noDay = { errantReturnNextDay: false };
    assert.equal(E.errantUp(w, 'errant-1', { total: at(3, 0), tuning: noDay }), false);
    w.badges.push('turn');
    assert.equal(E.errantUp(w, 'errant-1', { total: at(1, 13), tuning: noDay }), true);
    const playOnly = { errantReturnNextDay: false, errantReturnOnBadge: false };
    assert.equal(E.errantUp(w, 'errant-1', { total: at(1, 13), tuning: playOnly, playMs: 1000 + 7_199_999 }), false);
    assert.equal(E.errantUp(w, 'errant-1', { total: at(1, 13), tuning: playOnly, playMs: 1000 + 7_200_000 }), true);
    const never = { errantReturnNextDay: false, errantReturnOnBadge: false, errantReturnPlayMs: 0 };
    assert.equal(E.errantUp(w, 'errant-1', { total: at(99, 0), tuning: never, playMs: 1e12 }), false);
  });
  it('wild levels: +2 from 18:00 exactly, not at 17:59; clamped at the level bounds', () => {
    const w = makeWorld();
    assert.deepEqual(E.effectiveRows(w, ISLE, 'isle-grass', { data: DATA, total: at(1, 17, 59) })[0].levels, [3, 5]);
    assert.deepEqual(E.effectiveRows(w, ISLE, 'isle-grass', { data: DATA, total: at(1, 18) })[0].levels, [5, 7]);
    assert.equal(E.levelFor(99, true), 100);
    assert.equal(E.levelFor(100, true), 100);
    assert.equal(E.levelFor(-5, false), 1);
  });
});

describe('fishing edges', () => {
  it('Standard: a press on the last window frame lands; one frame later the window has closed', () => {
    const mk = () => until(F.cast(makeWorld(), TOWN, 'r-quay', [fishShadow('fish-a')], null, makeRng(3), base()), 'bite');
    const a = mk();
    assert.equal(a.plan.biteWindow, 31);
    F.tick(a, 30);
    assert.equal(a.phase, 'bite');
    F.press(a);
    assert.equal(a.phase, 'landed');
    const b = mk();
    F.tick(b, 31);
    assert.deepEqual([b.phase, b.missReason], ['missed', 'late']);
    F.press(b);
    assert.equal(b.phase, 'missed', 'input after the end changes nothing');
  });
  it('a press during a feint is early; during the approach nothing happens', () => {
    const s = F.cast(makeWorld(), TOWN, 'r-quay', [fishShadow('fish-a')], null, makeRng(3), base());
    F.press(s);
    assert.equal(s.phase, 'approach');
    F.release(s);
    until(s, 'nibble');
    F.press(s);
    assert.deepEqual([s.phase, s.missReason], ['missed', 'early']);
  });
  it('window maths: Gentle maps 7→36 and 31→54 linearly (clamped), Brine ×1.5 rounds, never below 1', () => {
    assert.equal(F.windowFrames(7, 'gentle', 1), 36);
    assert.equal(F.windowFrames(31, 'gentle', 1), 54);
    assert.equal(F.windowFrames(19, 'gentle', 1), 45);
    assert.equal(F.windowFrames(1000, 'gentle', 1), 54);
    assert.equal(F.windowFrames(-5, 'gentle', 1), 36);
    assert.equal(F.windowFrames(31, 'standard', 1.5), 47);
    assert.equal(F.windowFrames(0.1, 'standard', 1), 1);
    assert.equal(F.windowFrames(20, 'standard', -3), 20, 'a bad multiplier is ignored');
    assert.equal(F.windowFrames(20, 'patient', 9), null);
    assert.equal(F.windowSeconds(54), 0.9);
  });
  it('Patient needs no timing: never misses however long it waits; lands after exactly the reel frames held', () => {
    const s = F.cast(makeWorld(), TOWN, 'r-quay', [fishShadow('fish-a')], null, makeRng(3), base({ mode: 'patient' }));
    assert.equal(s.plan.biteWindow, null);
    for (let i = 0; i < 50; i++) { F.press(s); F.release(s); }
    F.tick(s, 10_000);
    assert.equal(s.phase, 'bite', 'the bite waits');
    F.press(s);
    F.tick(s, 59);
    assert.equal(s.phase, 'bite');
    F.release(s);
    F.tick(s, 500);
    assert.equal(s.phase, 'bite', 'letting go pauses');
    F.press(s);
    F.tick(s, 1);
    assert.equal(s.phase, 'landed');
    const w = makeWorld();
    const r = F.resolve(w, s, 'keep', base());
    assert.equal(r.log.patientRecord, true);
    assert.equal(w.collections.patientBest['fish-a'], 12.3);
  });
  it('a bad mode falls back to Standard; settings.fishing is honoured when ctx.mode is absent', () => {
    const w = makeWorld();
    assert.equal(F.cast(w, TOWN, 'r-quay', [fishShadow('fish-a')], null, makeRng(1), base({ mode: 'turbo' })).mode, 'standard');
    w.settings.fishing = 'gentle';
    assert.equal(F.cast(w, TOWN, 'r-quay', [fishShadow('fish-a')], null, makeRng(1), base()).mode, 'gentle');
    assert.equal(F.cast(w, TOWN, 'r-quay', [], null, makeRng(1), base()), null);
  });
  it('reach health: keep costs, release nudges UP, floor 40 %, linear recovery to full in one day', () => {
    const w = makeWorld({ total: at(1, 12) });
    const land = (choice, total = at(1, 12)) => {
      const s = until(F.cast(w, TOWN, 'r-quay', [fishShadow('fish-a')], null, makeRng(1), base({ total })), 'bite');
      F.press(s);
      return F.resolve(w, s, choice, base({ total })).health;
    };
    assert.equal(land('release'), 1, 'a release on a full reach stays full');
    for (let i = 0; i < 20; i++) land('keep');
    assert.equal(F.reachHealth(w, 'town-map', 'r-quay', base({ total: at(1, 12) })), 0.4);
    assert.ok(Math.abs(land('release') - 0.45) < 1e-9);
    // from 0.45 at 12:00: +0.6 per 1440 min
    const h = F.reachHealth(w, 'town-map', 'r-quay', base({ total: at(1, 12) + 720 }));
    assert.ok(Math.abs(h - 0.75) < 1e-9, String(h));
    assert.equal(F.reachHealth(w, 'town-map', 'r-quay', base({ total: at(3, 0) })), 1);
    assert.equal(F.reachHealth(w, 'town-map', 'r-quay', base({ total: 0 })), 0.45, 'a clock behind the stamp never lowers health');
    assert.throws(() => F.setReachHealth(w, 'town-map', 'r-quay', NaN), /finite/);
    assert.equal(F.setReachHealth(w, 'town-map', 'r-quay', -3), 0.4);
    assert.equal(F.setReachHealth(w, 'town-map', 'r-quay', 7), 1);
    assert.deepEqual(validateWorld(w), []);
  });
  it('shadows: 4 on a floored reach, 8 on a full one, +1 with a Rime lead; shape comes from the row', () => {
    const w = makeWorld({ total: at(1, 12) });
    const full = F.reachShadows(w, TOWN, 'r-river', makeRng(2), base({ total: at(1, 12) }));
    assert.equal(full.shadows.length, 8);
    F.setReachHealth(w, 'town-map', 'r-river', 0, base({ total: at(1, 12) }));
    assert.equal(F.reachShadows(w, TOWN, 'r-river', makeRng(2), base({ total: at(1, 12) })).shadows.length, 4);
    assert.equal(F.reachShadows(w, TOWN, 'r-river', makeRng(2), base({ total: at(1, 12), lead: { types: ['Rime'] } })).shadows.length, 5);
    const data = { ...DATA, collections: [{ id: 'f-shape', kind: 'fish', where: ['quay'], shadow: 'large', silhouette: 'ribbon', size: [1, 2], w: 1 }] };
    const v = F.reachShadows(w, TOWN, 'r-quay', makeRng(1), { data, lead: null, total: at(1, 12) });
    assert.ok(v.shadows.every((s) => s.silhouette === 'large' && s.shape === 'ribbon'));
  });
  it('a hooked wild creature is a wild: +2 levels at night', () => {
    const w = makeWorld();
    const day = F.reachShadows(w, TOWN, 'r-river', makeRng(4), base({ total: at(1, 12), tuning: { fishCreatureChance: 1 } }));
    const night = F.reachShadows(w, TOWN, 'r-river', makeRng(4), base({ total: at(1, 23), tuning: { fishCreatureChance: 1 } }));
    assert.ok(day.shadows.every((s) => s.creature.level === 7));
    assert.ok(night.shadows.every((s) => s.creature.level === 9));
  });
  it('a reach\'s nightKind lets after-dark-only places bite (a quay reach is also the sea at night)', () => {
    const w = makeWorld();
    const map = { id: 'q-map', region: 'town', reaches: [{ id: 'q', kind: 'quay', nightKind: 'sea', area: { x: 0, y: 0, w: 2, h: 2 } }] };
    const data = { collections: [{ id: 'sea-only', kind: 'fish', where: ['sea'], night: true, shadow: 'forked', size: [1, 2], w: 1 }] };
    assert.equal(F.reachShadows(w, map, 'q', makeRng(1), { data, lead: null, total: at(1, 12) }).shadows.length, 0);
    assert.ok(F.reachShadows(w, map, 'q', makeRng(1), { data, lead: null, total: at(1, 23) }).shadows.every((s) => s.fishId === 'sea-only'));
    assert.deepEqual(F.reachPlaces({ id: 'q', kind: 'quay', nightKind: ['sea', 'deep'] }, true), ['q', 'quay', 'sea', 'deep']);
    assert.deepEqual(F.reachPlaces({ id: 'q', kind: 'quay', nightKind: ['sea'] }, false), ['q', 'quay']);
  });
});

describe('max stacks, overflow and zero balances', () => {
  it('10,000 catches of one species: counts stay exact, the best holds, the tell is learned once', () => {
    const w = makeWorld();
    const { bus, events } = recordingBus();
    for (let i = 0; i < 10_000; i++) FL.recordFish(w, 'fish-a', (i * 7919) % 97, {}, { bus, lead: null });
    assert.deepEqual(w.collections.fish['fish-a'], { n: 10_000, best: 96 });
    assert.equal(events.filter((e) => e[0] === 'fieldLog:tell').length, 1);
    assert.equal(FL.tellCatchesLeft(w, 'fish-a', { lead: null }), 0);
    FL.recordFish(w, 'fish-a', Number.MAX_VALUE, {}, { lead: null });
    assert.equal(w.collections.fish['fish-a'].best, Number.MAX_VALUE);
    for (const bad of [Infinity, -1, NaN, '12', null]) assert.throws(() => FL.recordFish(w, 'fish-a', bad), TypeError);
    assert.deepEqual(validateWorld(w), []);
  });
  it('the step counter stops at STEPS_CAP and the world stays valid', () => {
    const w = makeWorld();
    w.encounter.steps = E.STEPS_CAP;
    E.rollStep(w, ISLE, makeRng(1), { data: DATA, x: 19, y: 19 });
    assert.equal(w.encounter.steps, E.STEPS_CAP);
    w.encounter.steps = -4;
    E.rollStep(w, ISLE, makeRng(1), { data: DATA, x: 19, y: 19 });
    assert.equal(w.encounter.steps, 1, 'a broken counter is repaired');
    assert.deepEqual(validateWorld(w), []);
  });
  it('cockle rakes stop at cockleRakesPerLow and reopen at the next low', () => {
    const w = makeWorld();
    const lowT = 4 * LOW;
    const res = [];
    for (let x = 0; x < 6; x++) res.push(G.rakeCockles(w, TOWN, x, 21, makeRng(x), base({ total: lowT })));
    assert.deepEqual(res.map((r) => r.ok || r.reason), [true, true, true, true, 'spent', 'spent']);
    assert.equal(G.rakeCockles(w, TOWN, 0, 21, makeRng(1), base({ total: lowT + LOW })).ok, true);
    assert.equal(G.rakeCockles(w, TOWN, 0, 21, makeRng(1), base({ total: lowT + LOW / 2 })).reason, 'tide');
  });
  it('the Glint pays with an empty purse; junk purse refunds count as 0; fractional ones floor', () => {
    const w = makeWorld();
    const lowT = 5 * LOW;
    const day = Math.floor(lowT / 1440);
    const g = G.glintFor(w, TOWN, G.planRng(w), base({ total: lowT }));
    assert.equal(g.amount, 500 + 60 * (day + 1));
    const r = G.dig(w, TOWN, g.x, g.y, G.planRng(w), base({ total: lowT }));
    assert.equal(r.amount, g.amount, 'no earn and no purse injected: still reported');
    for (const [refund, want] of [[NaN, 0], [-50, 0], [33.7, 33], [undefined, 0], ['12', 12]]) {
      const w2 = makeWorld();
      const paid = [];
      const r2 = G.dig(w2, TOWN, g.x, g.y, G.planRng(w2), base({ total: lowT, takePurse: () => refund, earn: (a) => paid.push(a) }));
      assert.equal(r2.events[1].refund, want, String(refund));
      assert.deepEqual(paid, [g.amount + want]);
    }
  });
  it('with the real wallet: the Keeper\'s Purse comes back in thirds on the next three Glints, wallet stays integral', () => {
    const w = makeWorld();
    w.wallet.purse = 900;
    w.wallet.purseGlints = 3;
    const refunds = [];
    for (let k = 0; k < 4; k++) {
      // one Glint per day: dig at the first low of each of four consecutive days
      const lowT = (5 + 2 * k) * LOW;
      const g = G.glintFor(w, TOWN, G.planRng(w), base({ total: lowT }));
      const r = G.dig(w, TOWN, g.x, g.y, G.planRng(w), base({ total: lowT, collectGlint: (o) => wallet.collectGlint(w, o) }));
      assert.equal(r.kind, 'glint');
      refunds.push(r.events[1].refund);
      assert.equal(r.amount, wallet.glintValue(Math.floor(lowT / 1440) + 1) + r.events[1].refund);
    }
    assert.deepEqual(refunds, [300, 300, 300, 0]);
    assert.equal(w.wallet.purse, 0);
    assert.ok(Number.isInteger(w.wallet.main));
    assert.deepEqual(validateWorld(w), []);
  });
  it('selling duplicates with zero price earns nothing and still succeeds; a refused take sells nothing', () => {
    const w = makeWorld();
    const data = { collections: [{ id: 'free-find', kind: 'relic', price: 0 }] };
    FL.recordFind(w, 'free-find');
    FL.donate(w, 'free-find');
    const earned = [];
    assert.deepEqual(FL.sellDuplicates(w, 'free-find', 3, {}, { data, earn: (a) => earned.push(a) }), { ok: true, id: 'free-find', n: 3, amount: 0 });
    assert.deepEqual(earned, []);
    assert.equal(FL.sellDuplicates(w, 'free-find', 1, {}, { data, take: () => false }).reason, 'not-in-bag');
    assert.equal(FL.sellDuplicates(w, 'free-find', 0, {}, { data }).reason, 'bad-count');
    assert.equal(FL.sellDuplicates(w, 'free-find', 1.5, {}, { data }).reason, 'bad-count');
  });
});

describe('malformed data never crashes a verb', () => {
  it('encounter tables with junk rows: steps keep working and only valid rows come out', () => {
    const data = {
      ...DATA,
      encounters: {
        junk: [null, 7, { species: 'nolevels', w: 5 }, { species: 'nanw', levels: [1, 2], w: NaN }, { species: 'inf', levels: [1, Infinity], w: 1 },
          { species: '', levels: [1, 1], w: 1 }, { species: 'ok', levels: [4, 2], w: 1 }, { species: 'bad-errant', errant: true, levels: 'x' }],
      },
    };
    const map = { id: 'junk-map', kind: 'exterior', region: 'isle-1', spawns: [{ area: { x: 0, y: 0, w: 5, h: 5 }, table: 'junk', rate: 1 }] };
    const w = makeWorld();
    const rng = makeRng(3);
    for (let i = 0; i < 2000; i++) {
      const r = E.rollStep(w, map, rng, { data, x: 1, y: 1, tuning: { encounterMinSteps: 0 }, total: at(1, 23) });
      if (r) assert.deepEqual([r.speciesId, r.level >= 4 && r.level <= 6], ['ok', true]);
    }
    assert.deepEqual(E.effectiveRows(w, map, 'junk', { data, total: at(1, 12) }).map((r) => r.species), ['ok']);
    // a spawn naming a missing table, a spawn with no table, no spawns at all
    for (const spawns of [[{ area: { x: 0, y: 0, w: 5, h: 5 }, table: 'missing', rate: 1 }], [{ area: { x: 0, y: 0, w: 5, h: 5 }, rate: 1 }], undefined]) {
      assert.equal(E.rollStep(w, { id: 'm', spawns }, rng, { data, x: 1, y: 1, tuning: { encounterMinSteps: 0 } }), null);
    }
    assert.deepEqual(E.errantMarkers(w, { data: null }), []);
    assert.equal(E.errantRouteNow(w, 'nobody', { data: {} }), null);
  });
  it('fish, bug and find rows with junk fields degrade instead of throwing', () => {
    const data = {
      collections: [
        { id: 'fish-junk', kind: 'fish', where: ['quay'], size: ['a', 'b'], w: NaN, biteFrames: 'fast', feints: [3, 1], mods: { day: NaN } },
        { id: 'bug-junk', kind: 'bug', w: Infinity, wary: 'very', spook: -2, mods: 'x' },
        null,
        { id: 'find-junk', kind: 'relic', source: 'crack', w: 'heavy' },
      ],
    };
    const w = makeWorld({ total: at(1, 12) });
    const v = F.reachShadows(w, TOWN, 'r-quay', makeRng(1), { data, lead: null });
    assert.ok(v.shadows.length > 0 && v.shadows.every((s) => s.size === 0 && s.fishId === 'fish-junk'));
    const s = until(F.cast(w, TOWN, 'r-quay', v.shadows, null, makeRng(1), { data, lead: null }), 'bite');
    assert.equal(s.plan.biteWindow, F.DEFAULTS.fishBiteFramesDefault, 'a junk biteFrames falls back to the default');
    F.press(s);
    assert.equal(F.resolve(w, s, 'keep', { data, lead: null }).kind, 'fish');
    const bugs = G.rollBugs(w, TOWN, [{ x: 1, y: 1 }, { x: 2, y: 2, lit: true }], makeRng(1), { data, lead: null, tuning: { bugSpawnChance: 1 } });
    assert.ok(bugs.every((b) => b.id === 'bug-junk'));
    assert.equal(G.netBug(w, { id: 'bug-junk', x: 1, y: 1 }, { x: 1, y: 2, gait: 'creep' }, makeRng(1), { data, lead: null }).ok, true);
    assert.deepEqual(G.findPool(data, TOWN, 'crack'), [{ id: 'find-junk', w: 1 }]);
    assert.deepEqual(validateWorld(w), []);
  });
  it('maps without dig / flats / reaches / trees answer empty, never throw', () => {
    const w = makeWorld();
    const bare = { id: 'bare' };
    assert.deepEqual(G.cracksFor(w, bare, G.planRng(w), base()), []);
    assert.equal(G.glintFor(w, bare, G.planRng(w), base()), null);
    assert.deepEqual(G.sparklesFor(w, bare, G.planRng(w), 3, base()), []);
    assert.deepEqual(G.skyglassFor(w, bare, G.planRng(w), 3, base()), []);
    assert.deepEqual(G.dig(w, bare, 0, 0, G.planRng(w), base()), { ok: false, kind: null, findId: null, amount: 0, events: [], reason: 'nothing' });
    assert.equal(G.rakeCockles(w, bare, 0, 0, makeRng(1), base()).reason, 'no-cockles');
    assert.deepEqual(G.senses(w, bare, { x: 0, y: 0 }, G.planRng(w), base({ lead: { types: ['Bolt', 'Glass', 'Grit'] } })), { glint: null, cracks: [], skyglass: [], hum: false, humTargets: [] });
    assert.throws(() => G.shakeTree(w, bare, 'nope', makeRng(1), base()), /unknown tree/);
    assert.throws(() => F.reachShadows(w, bare, 'nope', makeRng(1), base()), /unknown reach/);
    assert.deepEqual(G.spotsOf('junk'), []);
    assert.deepEqual(G.spotsOf([[1.5, 2], { x: 'a' }, null, { x: 0, y: 0, w: 2, h: 1 }, [0, 0]]), [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    assert.deepEqual(validateWorld(w), []);
  });
  it('a purse tree with a reversed own range falls back to the tuned range', () => {
    const w = makeWorld();
    const map = { id: 'pm', entities: [{ kind: 'tree', id: 'p', purse: [600, 200] }] };
    const r = G.shakeTree(w, map, 'p', makeRng(2), base());
    assert.ok(r.purse >= 200 && r.purse <= 600 && r.purse % 50 === 0);
  });
  it('a tree whose id looks like a low key keeps its fruit when low keys are pruned', () => {
    const w = makeWorld();
    const map = { id: 'collide', region: 'town', entities: [{ kind: 'tree', id: 's3', fruit: 'pear' }, { kind: 'tree', id: 'r2', fruit: 'pear' }], flats: { spots: [[0, 0], [1, 0]], cockles: { item: 'cockle' } } };
    G.shakeTree(w, map, 's3', makeRng(1), base({ total: at(1, 9) }));
    G.shakeTree(w, map, 'r2', makeRng(1), base({ total: at(1, 9) }));
    assert.equal(G.rakeCockles(w, map, 0, 0, makeRng(1), base({ total: 40 * LOW })).ok, true);
    assert.equal(G.treeState(w, map, 's3', base({ total: at(1, 10) })).fruitLeft, 2);
    assert.equal(G.treeState(w, map, 'r2', base({ total: at(1, 10) })).fruitLeft, 2);
    // genuine stale low keys do go
    w.maps.collide.picked['s1#0'] = 0;
    w.maps.collide.picked['r1@0,0'] = 0;
    G.rakeCockles(w, map, 1, 0, makeRng(1), base({ total: 40 * LOW }));
    assert.equal('s1#0' in w.maps.collide.picked, false);
    assert.equal('r1@0,0' in w.maps.collide.picked, false);
  });
  it('bugs only spawn at spots whose habitat they live at (rows without a habitat live anywhere)', () => {
    const w = makeWorld();
    const data = { collections: [{ id: 'porch-moth', kind: 'bug', habitat: ['lit-porch'], w: 1 }, { id: 'flats-hopper', kind: 'bug', habitat: 'flats', w: 1 }, { id: 'anywhere', kind: 'bug', w: 1 }] };
    const ctx = { data, lead: null, total: at(1, 12), tuning: { bugSpawnChance: 1 } };
    const spots = Array.from({ length: 40 }, (_, i) => ({ x: i, y: 0, habitat: i % 2 ? 'flats' : 'lit-porch' }));
    const bugs = G.rollBugs(w, TOWN, spots, makeRng(7), ctx);
    assert.equal(bugs.length, 40);
    for (const b of bugs) {
      if (b.x % 2) assert.ok(['flats-hopper', 'anywhere'].includes(b.id));
      else assert.ok(['porch-moth', 'anywhere'].includes(b.id));
    }
    assert.deepEqual(G.rollBugs(w, TOWN, [{ x: 0, y: 0, habitat: 'moon' }], makeRng(7), { ...ctx, data: { collections: [data.collections[0]] } }), []);
  });
});

describe('determinism', () => {
  it('the lane digest is identical in a separate Node process', () => {
    const url = pathToFileURL(new URL('./fixtures/gatherLaneDigest.mjs', import.meta.url).pathname).href;
    for (const seed of ['DETERMINISM-A', 'LAMPFALL-777']) {
      const here = JSON.stringify(digest(seed));
      const there = execFileSync(process.execPath, ['--input-type=module', '-e', `import(${JSON.stringify(url)}).then((m) => process.stdout.write(JSON.stringify(m.digest(${JSON.stringify(seed)}))))`], { encoding: 'utf8', timeout: 30_000 });
      assert.equal(there, here, seed);
    }
    assert.notEqual(JSON.stringify(digest('DETERMINISM-A')), JSON.stringify(digest('DETERMINISM-B')), 'seeds diverge');
  });
  it('placement ignores stream position: drawing from the base first changes nothing', () => {
    const w = makeWorld();
    const a = G.planRng(w);
    const b = G.planRng(w);
    for (let i = 0; i < 1000; i++) b.next();
    assert.deepEqual(G.cracksFor(w, TOWN, a, base({ day: 4 })), G.cracksFor(w, TOWN, b, base({ day: 4 })));
    assert.deepEqual(G.glintFor(w, TOWN, a, base({ day: 4 })), G.glintFor(w, TOWN, b, base({ day: 4 })));
    assert.deepEqual(G.skyglassFor(w, TOWN, a, 9, base()), G.skyglassFor(w, TOWN, b, 9, base()));
  });
});

describe('a 60-day simulation of clock + economy', () => {
  it('walks every minute for 60 days: one Glint a day, bounded state, no NaN, a valid world throughout', () => {
    const w = makeWorld({ seed: 'SIXTY-DAYS', total: 0 });
    const loot = makeRng(w.run.seed).fork('loot');
    const fishRng = makeRng(w.run.seed).fork(F.streamLabel('r-quay'));
    const encRng = makeRng(w.run.seed).fork(E.streamLabel('isle-map'));
    const master = G.planRng(w);
    const earn = (amount, source) => { assert.ok(Number.isInteger(amount) && amount >= 0, `${source}: ${amount}`); wallet.earn(w, amount); };
    const gifts = { n: 0 };
    const give = (id, n) => { assert.ok(typeof id === 'string' && Number.isInteger(n) && n > 0); gifts.n += n; };
    const glints = [];
    const encounters = { n: 0, night: 0 };
    let lastLowDug = -1;
    for (let total = 0; total < 60 * 1440; total++) {
      w.clock.total = total;
      const ctx = base({ total, earn, give, collectGlint: (o) => wallet.collectGlint(w, o) });
      const m = total % 1440;
      const day = Math.floor(total / 1440);
      if (m === 9 * 60) {
        for (const e of TOWN.entities) if (e.kind === 'tree') G.shakeTree(w, TOWN, e, loot, { ...ctx, net: true });
        for (const c of G.cracksFor(w, TOWN, master, ctx)) assert.equal(G.dig(w, TOWN, c.x, c.y, master, ctx).ok, true);
      }
      if (m % 60 === 30) {
        const view = F.reachShadows(w, TOWN, 'r-quay', fishRng, ctx);
        assert.ok(view.health >= 0.4 && view.health <= 1 && view.shadows.length >= 4);
        const s = F.cast(w, TOWN, 'r-quay', view.shadows, null, fishRng, ctx);
        if (s) { until(s, 'bite'); F.press(s); F.resolve(w, s, m % 120 === 30 ? 'keep' : 'release', ctx); }
        for (let i = 0; i < 6; i++) {
          const r = E.rollStep(w, ISLE, encRng, { ...ctx, x: 1, y: 1, tideState: 'rising' });
          if (r) { encounters.n++; if (r.night) encounters.night++; assert.ok(Number.isInteger(r.level) && r.level >= 1); }
        }
      }
      const li = G.lowInfo(w, ctx);
      if (li.minutesFromLow === 0 && li.lowIndex !== lastLowDug) {
        lastLowDug = li.lowIndex;
        const g = G.glintFor(w, TOWN, master, ctx);
        if (!g.dug) { const r = G.dig(w, TOWN, g.x, g.y, master, ctx); assert.equal(r.kind, 'glint'); glints.push([day, r.amount]); }
        for (const s of G.sparklesFor(w, TOWN, master, li.lowIndex, ctx)) G.dig(w, TOWN, s.x, s.y, master, ctx);
        if (li.nightLow) for (const k of G.skyglassFor(w, TOWN, master, li.lowIndex, ctx)) G.dig(w, TOWN, k.x, k.y, master, ctx);
        for (let x = 0; x < 5; x++) G.rakeCockles(w, TOWN, x, 22, loot, ctx);
      }
      if (m === 0 && day % 10 === 0) assert.deepEqual(validateWorld(w), [], `day ${day}`);
    }
    // exactly one Glint per calendar day, paying 500 + 60 × the GDD day
    assert.deepEqual(glints.map((g) => g[0]), Array.from({ length: 60 }, (_, d) => d));
    assert.equal(glints.reduce((s, g) => s + g[1], 0), 60 * 500 + 60 * (60 * 61) / 2);
    const ms = w.maps['town-map'];
    assert.ok(Object.keys(ms.picked).length < 40, `picked grew to ${Object.keys(ms.picked).length}`);
    assert.ok(Object.keys(ms.cracks).length <= 5);
    for (const v of Object.values(ms.reach)) assert.ok(v >= 0.4 && v <= 1);
    assert.ok(Number.isInteger(w.wallet.main) && w.wallet.main > 139_800);
    assert.ok(Object.values(w.collections.fish).every((r) => Number.isFinite(r.best) && r.n > 0));
    assert.ok(encounters.n > 50 && encounters.night > 0, JSON.stringify(encounters));
    assert.equal(w.stats.treesShaken, 60 * TOWN.entities.filter((e) => e.kind === 'tree').length);
    assert.ok(gifts.n > 0);
    assert.equal(JSON.stringify(w).includes('NaN'), false);
    assert.equal(JSON.stringify(w).includes('null,null'), false);
    assert.deepEqual(validateWorld(w), []);
  });
});

describe('save round trips through state/persist', () => {
  function makeG(seedCode) {
    const store = createStore(createNewWorldAt(seedCode));
    const rngs = createRngs(store);
    const scenes = { top: () => ({ name: 'overworld' }), has: () => false, isTransitioning: () => false };
    return { store, bus: store.bus, rngs, scenes, get world() { return store.world; } };
  }
  function createNewWorldAt(seedCode) {
    const w = makeWorld({ seed: seedCode, total: at(2, 23) });
    return w;
  }
  /** One round of lane verbs through the store, drawing from the stateful streams. */
  function play(G2, total) {
    return G2.store.tx('lane', (w) => {
      const ctx = base({ total });
      const fishRng = G2.rngs.stream(F.streamLabel('r-quay'));
      const view = F.reachShadows(w, TOWN, 'r-quay', fishRng, ctx);
      const s = until(F.cast(w, TOWN, 'r-quay', view.shadows, null, fishRng, ctx), 'bite');
      F.press(s);
      F.resolve(w, s, 'keep', ctx);
      const steps = [];
      const enc = G2.rngs.stream(E.streamLabel('isle-map'));
      for (let i = 0; i < 40; i++) steps.push(E.rollStep(w, ISLE, enc, { ...ctx, x: 1, y: 1, tideState: 'rising' }));
      E.markErrantDown(w, 'errant-1', ctx);
      G.shakeTree(w, TOWN, 't-purse', G2.rngs.stream('loot'), ctx);
      FL.markRead(w, 'form-a', null, ctx);
      return { shadows: view.shadows, steps };
    });
  }
  it('lane state and stateful streams survive a save and load bit for bit', () => {
    const A = makeG('ROUND-TRIP');
    play(A, at(2, 23));
    const p = createPersist({ storage: new Map(), prefix: 'LANE.', now: () => 1_700_000_000_000 });
    const saved = p.saveManual(A, 1);
    assert.equal(saved.ok, true, JSON.stringify(saved.error));
    const loaded = p.load('manual:1');
    assert.equal(loaded.ok, true, JSON.stringify(loaded.error));
    for (const k of ['encounter', 'collections', 'fieldLog', 'maps', 'rng']) assert.deepEqual(loaded.world[k], A.store.snapshot()[k], k);
    assert.deepEqual(validateWorld(loaded.world), []);
    // continuing in the original and in the reloaded world gives the same results
    const B = makeG('ROUND-TRIP');
    B.store.replace(loaded.world);
    const nextA = play(A, at(3, 1));
    const nextB = play(B, at(3, 1));
    assert.deepEqual(nextB, nextA);
    assert.deepEqual(B.store.snapshot().encounter, A.store.snapshot().encounter);
    assert.deepEqual(B.store.snapshot().maps, A.store.snapshot().maps);
  });
  it('a v5 world re-migrates to itself (lane keys survive migrateWorld)', () => {
    const A = makeG('MIGRATE-SELF');
    play(A, at(2, 23));
    const snap = A.store.snapshot();
    const res = migrateWorld(structuredClone(snap));
    const world = res.world ?? res;
    for (const k of ['encounter', 'collections', 'fieldLog', 'maps']) assert.deepEqual(world[k], snap[k], k);
  });
  it('POINT map: lit Errants after a round trip still roll at the shared 1-in-120', () => {
    const w = makeWorld({ total: at(1, 23) });
    w.flags['sp.lit.calls'] = true;
    const json = JSON.parse(JSON.stringify(w));
    const rng = makeRng(77);
    let errants = 0;
    let n = 0;
    while (n < 6000) {
      const r = E.rollStep(json, POINT, rng, { data: DATA, x: 1, y: 1, tuning: { encounterMinSteps: 0 } });
      if (!r) continue;
      n++;
      if (r.errant) { errants++; json.encounter.errants = {}; }
    }
    assert.ok(errants > 25 && errants < 80, `${errants} of 6000`);
  });
});
