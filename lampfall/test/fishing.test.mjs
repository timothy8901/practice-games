// Unit tests for js/systems/fishing.js. Run: node --test test/fishing.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../js/systems/fishing.js';
import { makeRng } from '../js/core/rng.js';
import { validateWorld } from '../js/state/schema.js';
import { DATA, TOWN, makeWorld, at, recordingBus } from './fixtures/gatherLane.fixture.mjs';

const DAY = at(1, 12);
const NIGHT = at(1, 23);
const base = (extra = {}) => ({ data: DATA, lead: null, total: DAY, ...extra });
const river = TOWN.reaches[0];

/** Runs frames until the session reaches `phase` (or gives up). */
function until(s, phase, max = 5000) {
  for (let i = 0; i < max && s.phase !== phase; i++) F.tick(s, 1);
  return s;
}

/** A cast at a given shadow with a fresh rng. */
function castAt(w, shadows, id, extra = {}, seed = 1) {
  return F.cast(w, TOWN, 'r-quay', shadows, id, makeRng(seed), base(extra));
}

const fishShadow = (fishId, extra = {}) => ({ id: `s-${fishId}`, fishId, creature: null, silhouette: 'small', size: 12.3, x: 31, y: 21, named: false, tell: null, headliner: false, ...extra });

describe('tuning', () => {
  it('defaults carry the GDD-00 numbers', () => {
    assert.deepEqual(F.DEFAULTS.fishShadowsPerReach, [4, 8]);
    assert.equal(F.DEFAULTS.fishReachFloor, 0.4);
    assert.equal(F.DEFAULTS.fishReachRecoverMinutes, 1440);
    assert.deepEqual(F.DEFAULTS.fishBiteFrames, [7, 31]);
    assert.deepEqual(F.DEFAULTS.fishGentleFrames, [36, 54]);
    assert.deepEqual(F.DEFAULTS.fishFeints, [1, 3]);
    assert.equal(F.FPS, 60);
    assert.deepEqual(F.MODES, ['standard', 'gentle', 'patient']);
    assert.deepEqual(F.TUNING_KEYS, Object.keys(F.DEFAULTS));
    assert.equal(F.streamLabel('r-quay'), 'fish:r-quay');
  });
  it('rejects malformed overrides', () => {
    assert.throws(() => F.tuningOf({ fishBiteFrames: [7, 7] }), /fishBiteFrames/);
    assert.throws(() => F.tuningOf({ fishReachFloor: 2 }), /fishReachFloor/);
    assert.throws(() => F.tuningOf({ fishFeintGapFrames: [0, 5] }), /fishFeintGapFrames/);
    assert.equal(F.tuningOf({ fishPatientReelFrames: 5 }).fishPatientReelFrames, 5);
  });
});

describe('reach health', () => {
  it('a reach never fished is full; set clamps to the floor and stamps the time', () => {
    const w = makeWorld({ total: DAY });
    assert.equal(F.reachHealth(w, 'town-map', 'r-river', base()), 1);
    assert.equal(F.setReachHealth(w, 'town-map', 'r-river', 0.1, base()), 0.4);
    assert.equal(F.setReachHealth(w, 'town-map', 'r-river', 7, base()), 1);
    F.setReachHealth(w, 'town-map', 'r-river', 0.4, base());
    assert.deepEqual([w.maps['town-map'].reach['r-river'], w.maps['town-map'].reachAt['r-river']], [0.4, DAY]);
    assert.throws(() => F.setReachHealth(w, 'town-map', 'r-river', NaN, base()), /finite/);
  });
  it('recovers linearly from the floor to full in one day', () => {
    const w = makeWorld({ total: DAY });
    F.setReachHealth(w, 'town-map', 'r-river', 0.4, base());
    assert.equal(F.reachHealth(w, 'town-map', 'r-river', base()), 0.4);
    assert.ok(Math.abs(F.reachHealth(w, 'town-map', 'r-river', base({ total: DAY + 720 })) - 0.7) < 1e-9);
    assert.equal(F.reachHealth(w, 'town-map', 'r-river', base({ total: DAY + 1440 })), 1);
    assert.equal(F.reachHealth(w, 'town-map', 'r-river', base({ total: DAY + 9999 })), 1);
    assert.equal(F.reachHealth(w, 'town-map', 'r-river', base({ total: DAY - 50 })), 0.4, 'clock behind the stamp: no recovery, no dip');
    delete w.maps['town-map'].reachAt['r-river'];
    assert.equal(F.reachHealth(w, 'town-map', 'r-river', base()), 1, 'no stamp: treated as long ago');
  });
  it('busy / quiet', () => {
    assert.equal(F.reachStatus(1), 'busy');
    assert.equal(F.reachStatus(0.75), 'busy');
    assert.equal(F.reachStatus(0.74), 'quiet');
    assert.equal(F.reachStatus(0.5, { tuning: { fishReachBusyAt: 0.5 } }), 'busy');
  });
});

describe('shadows', () => {
  it('a full reach shows 8 shadows of the fish that live there, in its water, sized from the rows', () => {
    const w = makeWorld({ total: DAY });
    const v = F.reachShadows(w, TOWN, 'r-quay', makeRng(1), base());
    assert.deepEqual([v.reachId, v.health, v.status, v.empty, v.shadows.length], ['r-quay', 1, 'busy', false, 8]);
    for (const s of v.shadows) {
      assert.equal(s.fishId, 'fish-b', 'only fish-b lives on the quay by day');
      assert.ok(s.size >= 30 && s.size <= 50 && Math.round(s.size * 10) === s.size * 10);
      assert.ok(s.x >= 30 && s.x < 36 && s.y >= 20 && s.y < 24);
      assert.equal(s.silhouette, 'medium');
      assert.deepEqual([s.named, s.tell, s.headliner, s.creature], [false, null, false, null]);
    }
    assert.deepEqual(F.reachShadows(w, TOWN, 'r-quay', makeRng(1), base()), v, 'deterministic');
    assert.throws(() => F.reachShadows(w, TOWN, 'nope', makeRng(1), base()), /unknown reach/);
  });
  it('a fished reach is quieter: 4 at the floor; Rime +1; extra shoals from ctx', () => {
    const w = makeWorld({ total: DAY });
    F.setReachHealth(w, 'town-map', 'r-quay', 0.4, base());
    const v = F.reachShadows(w, TOWN, 'r-quay', makeRng(1), base());
    assert.deepEqual([v.status, v.shadows.length], ['quiet', 4]);
    F.setReachHealth(w, 'town-map', 'r-quay', 0.75, base());
    assert.equal(F.reachShadows(w, TOWN, 'r-quay', makeRng(1), base()).shadows.length, 6);
    assert.equal(F.reachShadows(w, TOWN, 'r-quay', makeRng(1), base({ lead: { types: ['Rime'] } })).shadows.length, 7);
    assert.equal(F.reachShadows(w, TOWN, 'r-quay', makeRng(1), base({ extraShadows: 2 })).shadows.length, 8);
    assert.equal(F.reachShadows(w, TOWN, { ...TOWN.reaches[1], shadows: [1, 2] }, makeRng(1), base()).shadows.length, 2);
  });
  it('the north creek is empty until its cond holds', () => {
    const w = makeWorld({ total: DAY });
    const v = F.reachShadows(w, TOWN, 'r-creek', makeRng(1), base());
    assert.deepEqual([v.empty, v.shadows.length], [true, 0]);
    w.flags['sp.weir.open'] = true;
    assert.ok(F.reachShadows(w, TOWN, 'r-creek', makeRng(1), base()).shadows.length > 0);
  });
  it('night brings the headliner to the quay; Brine names species; learned tells show', () => {
    const w = makeWorld({ total: NIGHT });
    const v = F.reachShadows(w, TOWN, 'r-quay', makeRng(3), base({ total: NIGHT, lead: { types: ['Brine'] } }));
    assert.ok(v.shadows.some((s) => s.fishId === 'fish-night' && s.headliner && s.silhouette === 'forked'));
    assert.ok(v.shadows.every((s) => s.named));
    const rv = F.reachShadows(w, TOWN, 'r-river', makeRng(3), base());
    assert.ok(rv.shadows.every((s) => ['fish-a', 'fish-b'].includes(s.fishId)));
    w.fieldLog.tells['fish-a'] = 1;
    const tv = F.reachShadows(w, TOWN, 'r-river', makeRng(3), base());
    const a = tv.shadows.find((s) => s.fishId === 'fish-a');
    assert.deepEqual(a.tell, { shape: 'forked', sound: 'plip', word: 'Forked' });
    assert.ok(tv.shadows.filter((s) => s.fishId === 'fish-b').every((s) => s.tell === null));
  });
  it('any reach with a creature table can hold a wild creature', () => {
    const w = makeWorld({ total: DAY });
    const v = F.reachShadows(w, TOWN, river, makeRng(4), base({ tuning: { fishCreatureChance: 1 } }));
    assert.ok(v.shadows.length === 8 && v.shadows.every((s) => s.fishId === null && s.creature && s.creature.speciesId === 'form-c' && s.creature.level === 7 && s.silhouette === 'large' && s.size === 0));
    assert.deepEqual(v.shadows[0].creature, { speciesId: 'form-c', level: 7, errant: false, tableId: 'river-creatures' });
    const none = F.reachShadows(w, TOWN, 'r-quay', makeRng(4), base({ tuning: { fishCreatureChance: 1 } }));
    assert.ok(none.shadows.every((s) => s.creature === null), 'no table, no creatures');
  });
  it('a reach with no fish for the moment shows nothing', () => {
    const w = makeWorld({ total: DAY });
    assert.equal(F.reachShadows(w, TOWN, 'r-quay', makeRng(1), base({ data: { collections: [] } })).shadows.length, 0);
  });
  it('fog pulls a school in through row mods', () => {
    const w = makeWorld({ total: DAY });
    const count = (weather) => {
      let n = 0;
      const r = makeRng(5);
      for (let i = 0; i < 60; i++) n += F.reachShadows(w, TOWN, river, r, base({ weather })).shadows.filter((s) => s.fishId === 'fish-b').length;
      return n;
    };
    assert.ok(count('fog') > count('clear') * 1.5);
  });
  it('a Bolt lead hums near a night headliner', () => {
    const w = makeWorld({ total: NIGHT });
    const shadows = [fishShadow('fish-night', { headliner: true, x: 10, y: 10 }), fishShadow('fish-b', { x: 0, y: 0 })];
    assert.deepEqual(F.headlinerSpots(shadows), [{ x: 10, y: 10 }]);
    assert.deepEqual(F.headlinerSpots(null), []);
    assert.equal(F.headlinerHum(w, shadows, { x: 14, y: 10 }, { lead: { types: ['Bolt'] } }), true);
    assert.equal(F.headlinerHum(w, shadows, { x: 15, y: 10 }, { lead: { types: ['Bolt'] } }), false);
    assert.equal(F.headlinerHum(w, shadows, { x: 10, y: 10 }, { lead: null }), false);
  });
});

describe('bite windows', () => {
  it('Standard is the species frames; Gentle maps 7–31 onto 36–54; Patient has none; Brine × 1.5', () => {
    assert.equal(F.windowFrames(7, 'standard', 1), 7);
    assert.equal(F.windowFrames(31, 'standard', 1), 31);
    assert.equal(F.windowFrames(7, 'gentle', 1), 36);
    assert.equal(F.windowFrames(31, 'gentle', 1), 54);
    assert.equal(F.windowFrames(19, 'gentle', 1), 45);
    assert.equal(F.windowFrames(2, 'gentle', 1), 36, 'clamped');
    assert.equal(F.windowFrames(99, 'gentle', 1), 54, 'clamped');
    assert.equal(F.windowFrames(10, 'patient', 1), null);
    assert.equal(F.windowFrames(10, 'standard', 1.5), 15);
    assert.equal(F.windowFrames(31, 'gentle', 1.5), 81);
    assert.equal(F.windowFrames(0, 'standard', 1), 1, 'at least one frame');
    assert.equal(F.windowFrames(10, 'standard', -2), 10, 'bad multiplier ignored');
    assert.equal(F.windowSeconds(36), 0.6);
    assert.equal(F.windowSeconds(54), 0.9);
    assert.equal(F.windowSeconds(null), null);
  });
});

describe('the cast state machine', () => {
  it('cast picks the aimed shadow (or draws one) and pre-rolls the plan', () => {
    const w = makeWorld({ total: DAY });
    const { bus, events } = recordingBus();
    const shadows = [fishShadow('fish-a'), fishShadow('fish-b')];
    const s = castAt(w, shadows, 's-fish-b', { bus });
    assert.equal(s.shadow.fishId, 'fish-b');
    assert.notEqual(s.shadow, shadows[1], 'a copy');
    assert.equal(s.mode, 'standard');
    assert.equal(s.phase, 'approach');
    assert.ok(s.plan.arrive >= 45 && s.plan.arrive <= 120);
    assert.equal(s.plan.feints.length, 2, 'fish-b always feints twice');
    assert.ok(s.plan.feints[0] > s.plan.arrive && s.plan.feints[1] > s.plan.feints[0] && s.plan.biteAt > s.plan.feints[1]);
    assert.ok(s.plan.biteWindow >= 12 && s.plan.biteWindow <= 16);
    assert.deepEqual(s.events, [{ type: 'cast', frame: 0, mode: 'standard', silhouette: 'small', fishId: null }]);
    assert.deepEqual(events, [['fishing:cast', { mapId: 'town-map', reachId: 'r-quay', mode: 'standard', shadowId: 's-fish-b' }]]);
    assert.equal(F.cast(w, TOWN, 'r-quay', [], null, makeRng(1), base()), null);
    assert.equal(F.cast(w, TOWN, 'r-quay', null, null, makeRng(1), base()), null);
    const drawn = castAt(w, shadows, null);
    assert.ok(['fish-a', 'fish-b'].includes(drawn.shadow.fishId));
    assert.equal(castAt(w, shadows, 'missing').shadow.fishId, drawn.shadow.fishId, 'unknown target falls back to the same draw');
    let feints = new Set();
    for (let i = 0; i < 100; i++) feints.add(castAt(w, [fishShadow('fish-a')], null, {}, i).plan.feints.length);
    assert.deepEqual([...feints].sort(), [1, 2, 3]);
  });
  it('a named shadow and a learned tell are announced at the cast', () => {
    const w = makeWorld({ total: DAY });
    const s = castAt(w, [fishShadow('fish-a', { named: true, tell: { word: 'Forked' } })], null);
    assert.deepEqual(s.events, [
      { type: 'cast', frame: 0, mode: 'standard', silhouette: 'small', fishId: 'fish-a' },
      { type: 'tell', frame: 0, tell: { word: 'Forked' } },
    ]);
  });
  it('night headliners bite in a tighter window at night; Brine widens; modes come from ctx or settings', () => {
    const w = makeWorld({ total: NIGHT });
    const night = castAt(w, [fishShadow('fish-night')], null, { total: NIGHT });
    assert.deepEqual([night.night, night.plan.biteWindow], [true, 7]);
    assert.equal(castAt(w, [fishShadow('fish-night')], null, { total: DAY }).plan.biteWindow, 14);
    assert.equal(castAt(w, [fishShadow('fish-night')], null, { total: NIGHT, lead: { types: ['Brine'] } }).plan.biteWindow, 11);
    assert.equal(castAt(w, [fishShadow('fish-night')], null, { total: NIGHT, mode: 'gentle' }).plan.biteWindow, 36);
    assert.equal(castAt(w, [fishShadow('fish-night')], null, { mode: 'patient' }).plan.biteWindow, null);
    assert.equal(castAt(w, [fishShadow('fish-night')], null, { mode: 'turbo' }).mode, 'standard');
    w.settings.fishing = 'gentle';
    assert.equal(castAt(w, [fishShadow('fish-night')], null).mode, 'gentle');
    assert.equal(castAt(w, [fishShadow('unknown-fish')], null, { mode: 'standard' }).plan.biteWindow, 18, 'row-less default');
  });
  it('Standard: approach ignores presses, a press on a feint misses early', () => {
    const w = makeWorld();
    const s = castAt(w, [fishShadow('fish-b')], null);
    F.press(s);
    assert.equal(s.phase, 'approach');
    F.release(s);
    F.tick(s, s.plan.arrive - 1);
    assert.equal(s.phase, 'approach');
    F.tick(s, 1);
    assert.equal(s.phase, 'nibble');
    assert.deepEqual(s.events, [{ type: 'arrive', frame: s.plan.arrive }]);
    F.tick(s, s.plan.feints[0] - s.frame);
    assert.deepEqual(s.events.at(-1), { type: 'feint', frame: s.plan.feints[0], n: 1, of: 2 });
    F.press(s);
    assert.deepEqual([s.phase, s.missReason], ['missed', 'early']);
    assert.deepEqual(s.events, [{ type: 'miss', frame: s.frame, reason: 'early' }]);
    assert.equal(F.isOver(s), true);
    F.tick(s, 100);
    assert.deepEqual(s.events, [], 'nothing after the end');
  });
  it('Standard: a press inside the window lands; the window is exactly biteWindow frames', () => {
    const w = makeWorld();
    const s = until(castAt(w, [fishShadow('fish-b')], null), 'bite');
    assert.equal(s.frame, s.plan.biteAt);
    assert.deepEqual(s.events.at(-1), { type: 'bite', frame: s.plan.biteAt, biteWindow: s.plan.biteWindow });
    F.tick(s, s.plan.biteWindow - 1);
    assert.equal(s.phase, 'bite', 'last frame of the window still open');
    F.press(s);
    assert.equal(s.phase, 'landed');
    assert.deepEqual(s.events.map((e) => e.type), ['hooked', 'landed']);
    assert.equal(s.events[1].fishId, 'fish-b');
    const late = until(castAt(w, [fishShadow('fish-b')], null), 'bite');
    F.tick(late, late.plan.biteWindow);
    assert.deepEqual([late.phase, late.missReason, late.frame], ['missed', 'late', late.plan.biteAt + late.plan.biteWindow]);
    F.press(late);
    assert.equal(late.phase, 'missed');
  });
  it('Gentle uses the wider window', () => {
    const w = makeWorld();
    const s = until(castAt(w, [fishShadow('fish-a')], null, { mode: 'gentle' }), 'bite');
    assert.equal(s.plan.biteWindow, 54);
    F.tick(s, 53);
    F.press(s);
    assert.equal(s.phase, 'landed');
  });
  it('Patient: no timing anywhere; the bite waits and holding reels it in', () => {
    const w = makeWorld();
    const s = castAt(w, [fishShadow('fish-b')], null, { mode: 'patient', tuning: { fishPatientReelFrames: 30 } });
    F.tick(s, s.plan.feints[0]);
    F.press(s);
    assert.equal(s.phase, 'nibble', 'a press on a feint does not miss');
    F.release(s);
    until(s, 'bite');
    F.tick(s, 10000, { tuning: { fishPatientReelFrames: 30 } });
    assert.equal(s.phase, 'bite', 'the bite waits');
    F.press(s);
    assert.equal(s.phase, 'bite', 'pressing starts reeling, it does not land at once');
    F.tick(s, 10, { tuning: { fishPatientReelFrames: 30 } });
    assert.equal(s.reel, 10);
    F.release(s);
    F.tick(s, 50, { tuning: { fishPatientReelFrames: 30 } });
    assert.equal(s.reel, 10, 'letting go pauses');
    F.press(s);
    F.tick(s, 19, { tuning: { fishPatientReelFrames: 30 } });
    assert.equal(s.phase, 'bite');
    F.tick(s, 1, { tuning: { fishPatientReelFrames: 30 } });
    assert.equal(s.phase, 'landed');
    assert.deepEqual(s.events.map((e) => e.type), ['reel', 'hooked', 'landed']);
    // held from before the bite: reeling starts the frame after it
    const h = castAt(w, [fishShadow('fish-b')], null, { mode: 'patient' });
    F.press(h);
    until(h, 'bite');
    F.tick(h, F.DEFAULTS.fishPatientReelFrames);
    assert.equal(h.phase, 'landed');
  });
  it('cancel and argument checks', () => {
    const w = makeWorld();
    const s = castAt(w, [fishShadow('fish-b')], null);
    F.cancel(s);
    assert.deepEqual([s.phase, s.events[0].type], ['cancelled', 'cancel']);
    F.cancel(s);
    assert.deepEqual(s.events, []);
    assert.throws(() => F.tick(s, -1), /frames/);
    assert.throws(() => F.tick(s, 1.5), /frames/);
    const z = castAt(w, [fishShadow('fish-b')], null);
    F.tick(z, 0);
    assert.equal(z.frame, 0);
  });
  it('same rng and the same input frames give the same session', () => {
    const play = () => {
      const w = makeWorld();
      const v = F.reachShadows(w, TOWN, 'r-river', makeRng('fish:r-river'), base());
      const s = F.cast(w, TOWN, 'r-river', v.shadows, null, makeRng('fish:r-river'), base());
      until(s, 'bite');
      F.tick(s, 3);
      F.press(s);
      return JSON.stringify(s);
    };
    assert.equal(play(), play());
  });
});

describe('resolve', () => {
  it('keep: logs, counts, costs the reach and gives the fish', () => {
    const w = makeWorld({ total: DAY });
    const { bus, events } = recordingBus();
    const given = [];
    const s = until(castAt(w, [fishShadow('fish-b', { size: 41.5 })], null), 'bite');
    F.press(s);
    const r = F.resolve(w, s, 'keep', base({ bus, give: (i, n) => given.push([i, n]) }));
    assert.deepEqual([r.ok, r.kind, r.fishId, r.size], [true, 'fish', 'fish-b', 41.5]);
    assert.ok(Math.abs(r.health - 0.9) < 1e-9);
    assert.equal(r.log.first, true);
    assert.deepEqual(given, [['fish-b', 1]]);
    assert.deepEqual(w.collections.fish['fish-b'], { n: 1, best: 41.5 });
    assert.equal(w.stats.fishCaught, 1);
    assert.equal(s.phase, 'kept');
    assert.deepEqual(events.filter((e) => e[0].startsWith('fishing:')).map((e) => e[0]), ['fishing:land', 'fishing:keep']);
    assert.deepEqual(F.resolve(w, s, 'keep', base()), { ok: false, kind: 'none', fishId: null, size: 0, encounter: null, health: r.health, log: null });
  });
  it('release: still logged, no fish given, the reach gets a nudge back', () => {
    const w = makeWorld({ total: DAY });
    const k = until(castAt(w, [fishShadow('fish-a')], null), 'bite');
    F.press(k);
    assert.ok(Math.abs(F.resolve(w, k, 'keep', base()).health - 0.9) < 1e-9, 'a kept fish costs the reach');
    const s = until(castAt(w, [fishShadow('fish-a')], null), 'bite');
    F.press(s);
    const r = F.resolve(w, s, 'release', base({ give: () => assert.fail('released fish are not given') }));
    assert.ok(Math.abs(r.health - 0.95) < 1e-9, 'a release nudges health up');
    assert.equal(s.phase, 'released');
    assert.equal(w.collections.fish['fish-a'].n, 2);
    // fished hard, the reach bottoms out at the floor
    for (let i = 0; i < 10; i++) {
      const t = until(castAt(w, [fishShadow('fish-a')], null), 'bite');
      F.press(t);
      F.resolve(w, t, 'keep', base());
    }
    assert.equal(F.reachHealth(w, 'town-map', 'r-quay', base()), 0.4);
    assert.equal(F.reachShadows(w, TOWN, 'r-quay', makeRng(1), base()).status, 'quiet');
    assert.equal(F.reachHealth(w, 'town-map', 'r-quay', base({ total: DAY + 1440 })), 1);
  });
  it('a tell is learned after 3 catches, after 1 with a Brine lead', () => {
    const w = makeWorld({ total: DAY });
    const land = (lead) => {
      const s = until(castAt(w, [fishShadow('fish-a')], null, { lead }), 'bite');
      F.press(s);
      return F.resolve(w, s, 'release', base({ lead }));
    };
    assert.equal(land(null).log.tellNew, false);
    assert.equal(land(null).log.tellNew, false);
    assert.equal(land(null).log.tellNew, true);
    const w2 = makeWorld({ total: DAY });
    const s = until(F.cast(w2, TOWN, 'r-quay', [fishShadow('fish-b')], null, makeRng(1), base({ lead: { types: ['Brine'] } })), 'bite');
    F.press(s);
    assert.equal(F.resolve(w2, s, 'keep', base({ lead: { types: ['Brine'] } })).log.tellNew, true);
  });
  it('Patient landings go on their own board', () => {
    const w = makeWorld({ total: DAY });
    const s = castAt(w, [fishShadow('fish-b', { size: 33.3 })], null, { mode: 'patient' });
    F.press(s);
    until(s, 'landed');
    F.resolve(w, s, 'keep', base());
    assert.equal(w.collections.patientBest['fish-b'], 33.3);
  });
  it('a miss resolves once; a hooked creature returns its encounter', () => {
    const w = makeWorld({ total: DAY });
    const { bus, events } = recordingBus();
    const s = castAt(w, [fishShadow('fish-b')], null);
    until(s, 'nibble');
    F.tick(s, s.plan.feints[0] - s.frame);
    F.press(s);
    assert.deepEqual(F.resolve(w, s, 'keep', base({ bus })).kind, 'miss');
    assert.deepEqual(events, [['fishing:miss', { mapId: 'town-map', reachId: 'r-quay', reason: 'early' }]]);
    assert.equal(F.resolve(w, s, 'keep', base()).kind, 'none');
    const creature = { speciesId: 'form-c', level: 7, errant: false, tableId: 'river-creatures' };
    const c = castAt(w, [fishShadow(null, { creature, silhouette: 'large', size: 0 })], null);
    until(c, 'bite');
    F.press(c);
    const r = F.resolve(w, c, 'keep', base({ give: () => assert.fail('creatures are battled, not bagged') }));
    assert.deepEqual([r.kind, r.encounter], ['creature', creature]);
    assert.equal(w.stats.fishCaught, 0);
    const pending = castAt(w, [fishShadow('fish-b')], null);
    assert.equal(F.resolve(w, pending, 'keep', base()).kind, 'none', 'an unfinished cast resolves to nothing');
    assert.deepEqual(validateWorld(w), []);
  });
});
