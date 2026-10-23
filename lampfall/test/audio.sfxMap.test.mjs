// js/audio/sfxMap.js — tables, pure resolution, rate limiting and the bus router (fake engine).
// Run: node --test test/audio.sfxMap.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS, TUNING_KEYS, BUS_SFX, VERB_SFX, BATTLE_SFX, tuningOf, resolveRef, readField, matches, selectRule,
  semitonesToPitch, pitchSemitones, resolveSfx, sfxForEvent, sfxForVerb, sfxForBattleEvent, createSfxLimiter, createSfxRouter,
} from '../js/audio/sfxMap.js';
import { SFX_NAMES } from '../js/core/audio.js';
import { makeRng } from '../js/core/rng.js';
import { createBus } from '../js/core/events.js';
import { KIND_VERBS, VERB_TOOLS } from '../js/world/interact.js';
import { EVENT_FIELDS } from '../js/battle/events.js';
import { createFakeAudio } from './fixtures/audio.fixture.mjs';

const rulesOf = (entry) => (Array.isArray(entry) ? entry : [entry]);
const allTables = { BUS_SFX, VERB_SFX, BATTLE_SFX };

test('sfxMap: DEFAULTS frozen, TUNING_KEYS complete, every value a finite number', () => {
  assert.ok(Object.isFrozen(DEFAULTS));
  assert.deepEqual(TUNING_KEYS, Object.keys(DEFAULTS));
  for (const [k, v] of Object.entries(DEFAULTS)) assert.ok(Number.isFinite(v), k);
});

test('sfxMap: every sound named in a table exists in the core sfx bank; every $ref is a tuning key', () => {
  const refs = [];
  const walk = (x) => {
    if (typeof x === 'string' && x.startsWith('$')) refs.push(x.slice(1));
    else if (x && typeof x === 'object') for (const v of Object.values(x)) walk(v);
  };
  for (const [tname, table] of Object.entries(allTables)) {
    assert.ok(Object.isFrozen(table), tname);
    for (const [evt, entry] of Object.entries(table)) {
      for (const r of rulesOf(entry)) {
        assert.ok(r.sfx === null || SFX_NAMES.includes(r.sfx), `${tname}.${evt}: unknown sfx ${r.sfx}`);
        walk(r);
      }
    }
  }
  for (const k of refs) assert.ok(k in DEFAULTS, `unknown tuning ref $${k}`);
  assert.ok(refs.length > 10);
});

test('sfxMap: tables cover the interaction verbs and the battle event types that make a sound', () => {
  for (const v of [...Object.values(KIND_VERBS), ...Object.keys(VERB_TOOLS)]) assert.ok(v in VERB_SFX, `verb ${v}`);
  for (const type of Object.keys(BATTLE_SFX)) assert.ok(type in EVENT_FIELDS || ['levelup', 'learn', 'glint', 'payout', 'run', 'item', 'lantern', 'capture', 'capture-fail', 'capture-shake', 'read', 'reveal', 'scrap', 'blackout'].includes(type), type);
});

test('sfxMap: tuningOf merges, ignores non-finite numbers, keeps unknown keys', () => {
  const t = tuningOf({ STEP_VOLUME: 0.2, SFX_BURST_MAX: NaN, EXTRA: 3 });
  assert.equal(t.STEP_VOLUME, 0.2);
  assert.equal(t.SFX_BURST_MAX, DEFAULTS.SFX_BURST_MAX);
  assert.equal(t.EXTRA, 3);
  assert.ok(Object.isFrozen(t));
  assert.deepEqual(tuningOf(), { ...DEFAULTS });
  assert.deepEqual(tuningOf('junk'), { ...DEFAULTS });
});

test('sfxMap: resolveRef / readField / matches', () => {
  assert.equal(resolveRef('$STEP_VOLUME', DEFAULTS), DEFAULTS.STEP_VOLUME);
  assert.equal(resolveRef('$NOPE', DEFAULTS, 7), 7);
  assert.equal(resolveRef(3, DEFAULTS), 3);
  assert.equal(resolveRef('3', DEFAULTS, 1), 1);
  assert.equal(resolveRef(Infinity, DEFAULTS, 2), 2);
  assert.equal(readField({ a: { b: 4 } }, 'a.b'), 4);
  assert.equal(readField({ a: null }, 'a.b'), undefined);
  assert.equal(readField(null, 'a'), undefined);
  const t = DEFAULTS;
  assert.ok(matches(undefined, {}, t));
  assert.ok(matches({ field: 'x', eq: 1 }, { x: 1 }, t));
  assert.ok(!matches({ field: 'x', eq: 1 }, { x: '1' }, t));
  assert.ok(matches({ field: 'x', ne: 1 }, { x: 2 }, t));
  assert.ok(matches({ field: 'x', in: ['a', 'b'] }, { x: 'b' }, t));
  assert.ok(!matches({ field: 'x', in: 'ab' }, { x: 'a' }, t));
  assert.ok(matches({ field: 'x', gt: 0 }, { x: 1 }, t) && !matches({ field: 'x', gt: 0 }, { x: 0 }, t));
  assert.ok(matches({ field: 'x', gte: '$HIT_STRONG_MULT' }, { x: 2 }, t));
  assert.ok(matches({ field: 'x', lt: 0 }, { x: -1 }, t) && matches({ field: 'x', lte: 0.5 }, { x: 0.5 }, t));
  assert.ok(!matches({ field: 'x', gt: 0 }, { x: '5' }, t), 'numeric comparisons need numbers');
  assert.ok(matches({ field: 'x', truthy: true }, { x: 'y' }, t) && matches({ field: 'x', truthy: false }, {}, t));
  assert.ok(!matches({ field: 'x' }, { x: 1 }, t), 'a match with no comparison fails');
  assert.ok(!matches({ eq: 1 }, { x: 1 }, t), 'a match with no field fails');
  assert.ok(matches([{ field: 'a', eq: 1 }, { field: 'b', eq: 2 }], { a: 1, b: 2 }, t));
  assert.ok(!matches([{ field: 'a', eq: 1 }, { field: 'b', eq: 2 }], { a: 1, b: 3 }, t));
  assert.equal(selectRule(null, {}, t), null);
  assert.equal(selectRule([{ sfx: 'a', when: { field: 'k', eq: 1 } }], { k: 2 }, t), null);
});

test('sfxMap: footsteps — water variant, jitter bounded and deterministic for a seed, different seeds differ', () => {
  const seq = (seed) => { const rng = makeRng(seed); return Array.from({ length: 20 }, () => sfxForEvent('player:step', {}, { rng }).pitch); };
  assert.deepEqual(seq('a'), seq('a'));
  assert.notDeepEqual(seq('a'), seq('b'));
  for (const p of seq('c')) assert.ok(p >= 1 - DEFAULTS.STEP_PITCH_JITTER - 1e-9 && p <= 1 + DEFAULTS.STEP_PITCH_JITTER + 1e-9, String(p));
  const rng = makeRng(1);
  assert.equal(sfxForEvent('player:step', { terrain: 'water' }, { rng }).sfx, 'stepWater');
  const dry = sfxForEvent('player:step', { terrain: 'sand' }, { rng });
  assert.equal(dry.sfx, 'step');
  assert.equal(dry.key, 'step');
  assert.equal(dry.volume, DEFAULTS.STEP_VOLUME);
  assert.equal(dry.minIntervalMs, DEFAULTS.STEP_MIN_INTERVAL_MS);
  assert.equal(sfxForEvent('player:step', {}, {}).pitch, 1, 'no rng = no jitter');
  const quiet = sfxForEvent('player:step', {}, { rng, tuning: tuningOf({ STEP_PITCH_JITTER: 0, STEP_VOLUME: 0.1 }) });
  assert.equal(quiet.pitch, 1);
  assert.equal(quiet.volume, 0.1);
});

test('sfxMap: coin combo climbs per pickup, caps, and resets after a pause; spending plays the purse', () => {
  const combo = new Map();
  const st = (now) => sfxForEvent('wallet:changed', { delta: 5 }, { combo, now }).semitones;
  assert.equal(st(0), 0);
  assert.equal(st(100), 1);
  assert.equal(st(200), 2);
  for (let i = 3; i < 12; i++) st(100 * i);
  assert.equal(st(1300), DEFAULTS.COIN_COMBO_MAX_STEPS * DEFAULTS.COIN_COMBO_SEMITONES, 'capped');
  assert.equal(st(1300 + DEFAULTS.COIN_COMBO_RESET_MS + 1), 0, 'reset after the pause');
  assert.equal(sfxForEvent('wallet:changed', { delta: -3 }, {}).sfx, 'purse');
  assert.equal(sfxForEvent('wallet:changed', { delta: 0 }, {}), null);
  assert.equal(sfxForEvent('wallet:changed', null, {}), null);
  const big = new Map();
  const t = tuningOf({ COIN_COMBO_SEMITONES: 2, COIN_COMBO_MAX_STEPS: 1 });
  sfxForEvent('wallet:changed', { delta: 1 }, { combo: big, now: 0, tuning: t });
  assert.equal(sfxForEvent('wallet:changed', { delta: 1 }, { combo: big, now: 10, tuning: t }).semitones, 2);
  assert.equal(sfxForEvent('wallet:changed', { delta: 1 }, { combo: big, now: 20, tuning: t }).semitones, 2);
});

test('sfxMap: event specifics — save failures, generic sfx, warps, ambience, unknown events', () => {
  assert.equal(sfxForEvent('save:fail', { willRetry: true }), null, 'a retried save stays silent');
  assert.equal(sfxForEvent('save:fail', { willRetry: false }).sfx, 'error');
  assert.equal(sfxForEvent('save:ok', {}).volume, DEFAULTS.SAVE_OK_VOLUME);
  const g = sfxForEvent('sfx', { name: 'bell', semitones: 3, volume: 0.4 });
  assert.equal(g.sfx, 'bell');
  assert.equal(g.semitones, 3);
  assert.equal(g.volume, 0.4);
  assert.ok(Math.abs(sfxForEvent('sfx', { name: 'bell', pitch: 2 }).semitones - 12) < 1e-9);
  assert.equal(sfxForEvent('sfx', { name: '' }), null);
  assert.equal(sfxForEvent('sfx', {}), null);
  assert.equal(sfxForEvent('warp', { sfx: 'stamp' }).sfx, 'stamp');
  assert.equal(sfxForEvent('warp', {}).sfx, 'doorOpen');
  assert.equal(sfxForEvent('tide:change', { state: 'high' }).sfx, 'wave');
  assert.equal(sfxForEvent('tide:change', { state: 'low' }), null);
  assert.equal(sfxForEvent('weather:change', { current: 'storm' }).sfx, 'thunder');
  assert.equal(sfxForEvent('weather:change', { kind: 'storm' }).sfx, 'thunder');
  assert.equal(sfxForEvent('weather:change', { current: 'rain' }), null);
  assert.equal(sfxForEvent('clock:phase', { phase: 'dawn' }).sfx, 'dawn');
  assert.equal(sfxForEvent('collection:added', { kind: 'fish' }).sfx, 'catchFish');
  assert.equal(sfxForEvent('collection:added', { kind: 'relic' }).sfx, 'achievement');
  assert.equal(sfxForEvent('letter:delivered', {}), null, 'the music sting owns the letter');
  assert.equal(sfxForEvent('nope', {}), null);
  assert.equal(sfxForEvent('toString', {}), null, 'no prototype lookups');
  assert.equal(sfxForEvent('capture:ok', {}, { map: { 'capture:ok': { sfx: 'bell' } } }).sfx, 'bell', 'custom map');
});

test('sfxMap: verbs, disabled verbs and battle events', () => {
  assert.equal(sfxForVerb('shake').sfx, 'shake');
  assert.equal(sfxForVerb('dig', { x: 1 }).sfx, 'dig');
  assert.equal(sfxForVerb('dig', { disabled: 'Need a spade' }).sfx, 'blocked');
  assert.equal(sfxForVerb('fly'), null);
  assert.equal(sfxForVerb(42), null);
  assert.equal(sfxForVerb('shake', null, { verbs: { shake: { sfx: 'thwap' } } }).sfx, 'thwap');
  const b = (ev, tuning) => sfxForBattleEvent(ev, tuning ? { tuning: tuningOf(tuning) } : {});
  assert.equal(b({ type: 'damage', source: 'status', amount: 3 }).sfx, 'hitWeak');
  assert.equal(b({ type: 'damage', source: 'party', amount: 3 }).sfx, 'hit');
  assert.equal(b({ type: 'damage', source: 'party', amount: 0 }), null);
  assert.equal(b({ type: 'effectiveness', mult: 2 }).sfx, 'hitStrong');
  assert.equal(b({ type: 'effectiveness', mult: 1.5 }), null);
  assert.equal(b({ type: 'effectiveness', mult: 1.5 }, { HIT_STRONG_MULT: 1.5 }).sfx, 'hitStrong', 'threshold is tunable');
  assert.equal(b({ type: 'effectiveness', mult: 0.5 }).sfx, 'hitWeak');
  assert.equal(b({ type: 'effectiveness', mult: 0 }).sfx, 'blocked');
  const up = b({ type: 'stat', result: 'raised', stages: 2 });
  const down = b({ type: 'stat', result: 'lowered', stages: -1 });
  assert.equal(up.semitones, 2 * DEFAULTS.STAT_STAGE_SEMITONES);
  assert.equal(down.semitones, -DEFAULTS.STAT_STAGE_SEMITONES);
  assert.equal(b({ type: 'stat', result: 'raised', stages: 12 }).semitones, DEFAULTS.STAT_MAX_SEMITONES, 'clamped');
  assert.equal(b({ type: 'stat', result: 'capped', stages: 1 }).sfx, 'blocked');
  assert.ok(b({ type: 'capture-shake', n: 2 }).semitones > b({ type: 'capture-shake', n: 1 }).semitones);
  assert.equal(b({ type: 'capture-shake', n: 99 }).semitones, DEFAULTS.CAPTURE_SHAKE_MAX_SEMITONES);
  assert.equal(b({ type: 'message', text: 'x' }), null);
  assert.equal(b(null), null);
  assert.equal(b({}), null);
  assert.equal(semitonesToPitch(12), 2);
  assert.equal(pitchSemitones({ kind: 'weird' }, {}, { tuning: DEFAULTS }), 0);
  assert.equal(pitchSemitones({ kind: 'field', field: 'q', semitones: 1 }, { q: 'x' }, { tuning: DEFAULTS }), 0);
  assert.equal(resolveSfx({ sfx: 'bell', volume: 9 }, {}).volume, 2, 'volume clamped');
});

test('sfxMap: limiter — per-key spacing, independent keys, burst cap, odd clocks', () => {
  const lim = createSfxLimiter();
  assert.ok(lim.allow('a', 0, 100));
  assert.ok(!lim.allow('a', 50, 100));
  assert.ok(lim.allow('b', 50, 100), 'other keys are independent');
  assert.ok(lim.allow('a', 100, 100));
  assert.ok(!lim.allow('x', NaN), 'non-finite time refused');
  assert.ok(lim.allow('a', 10, 100), 'time going backwards never locks a key');
  const burst = createSfxLimiter({ tuning: { SFX_BURST_MAX: 3, SFX_BURST_WINDOW_MS: 100 } });
  assert.ok(burst.allow('k1', 0, 0) && burst.allow('k2', 1, 0) && burst.allow('k3', 2, 0));
  assert.ok(!burst.allow('k4', 3, 0), 'burst cap');
  assert.ok(burst.allow('k4', 101, 0), 'window slides');
  assert.equal(burst.size(), 4);
  burst.reset();
  assert.equal(burst.size(), 0);
  const dflt = createSfxLimiter();
  assert.ok(dflt.allow('z', 0));
  assert.ok(!dflt.allow('z', DEFAULTS.SFX_DEFAULT_MIN_INTERVAL_MS - 1));
  assert.ok(dflt.allow('z', DEFAULTS.SFX_DEFAULT_MIN_INTERVAL_MS));
});

test('sfxMap: router plays bus events through the engine, rate-limited by the injected clock', () => {
  const bus = createBus();
  const audio = createFakeAudio();
  let now = 0;
  const r = createSfxRouter({ bus, audio, now: () => now, rng: makeRng('t') });
  bus.emit('capture:ok', { uid: 'c1' });
  assert.deepEqual(audio.of('sfx').map((c) => c[1]), ['capture']);
  bus.emit('player:step', {});
  now = 10;
  bus.emit('player:step', {});
  assert.equal(audio.of('sfx').filter((c) => c[1] === 'step').length, 1, 'second step inside STEP_MIN_INTERVAL_MS dropped');
  now = 200;
  bus.emit('player:step', { terrain: 'water' });
  assert.equal(audio.of('sfx').filter((c) => c[1] === 'stepWater').length, 1, 'water steps share the step key and its spacing');
  bus.emit('interact', { verb: 'shake' });
  bus.emit('interact', 'dig');
  bus.emit('battle:event', { event: { type: 'heal', side: 0, amount: 3 } });
  bus.emit('battle:event', { type: 'crit', side: 1 });
  bus.emit('letter:delivered', {});
  const names = audio.of('sfx').map((c) => c[1]);
  assert.deepEqual(names.slice(-4), ['shake', 'dig', 'heal', 'hitStrong']);
  const s = r.stats();
  assert.equal(s.limited, 1);
  assert.ok(s.played >= 6);
  assert.equal(r.log().at(-1).sfx, 'hitStrong');
  assert.equal(r.event('nope'), null);
  assert.equal(r.verb('talk').sfx, 'blip');
  r.destroy();
  const before = audio.of('sfx').length;
  bus.emit('capture:ok', {});
  assert.equal(audio.of('sfx').length, before, 'no listener after destroy');
});

test('sfxMap: router never throws into the bus (failing engine, junk payloads, no engine)', () => {
  const bus = createBus();
  const audio = createFakeAudio({ throwOn: ['sfx'] });
  const r = createSfxRouter({ bus, audio, now: () => 0 });
  assert.doesNotThrow(() => bus.emit('capture:ok', {}));
  assert.doesNotThrow(() => bus.emit('battle:event', null));
  assert.doesNotThrow(() => bus.emit('interact', 7));
  assert.equal(r.stats().failed, 1);
  const quiet = createSfxRouter({ bus: createBus() });
  assert.equal(quiet.event('capture:ok', {}).sfx, 'capture');
  assert.doesNotThrow(() => createSfxRouter({ bus: { on: () => null } }));
});

test('sfxMap: router determinism — same seed and event script give the same plays', () => {
  const run = () => {
    const bus = createBus();
    const audio = createFakeAudio();
    let now = 0;
    createSfxRouter({ bus, audio, now: () => now, rng: makeRng('same') });
    for (let i = 0; i < 30; i++) { now += 130; bus.emit('player:step', {}); if (i % 3 === 0) bus.emit('wallet:changed', { delta: 1 }); }
    return audio.of('sfx');
  };
  assert.deepEqual(run(), run());
});
