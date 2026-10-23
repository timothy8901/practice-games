// Adversarial tests for the AUDIO lane (js/audio/director.js, js/audio/sfxMap.js, js/audio/tracks/*):
// determinism across processes, boundaries of every stem / cue rule, prototype keys and malformed data at
// every entry point, huge inputs, every tuning dial, and world round trips through JSON and a real store.
// (test/audio.adversarial.test.mjs covers js/core/audio.js and belongs to CORE.)
// Run: node --test test/audio.lane.adversarial.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  DEFAULTS, TUNING_KEYS, tuningKeys, DIRECTOR_EVENTS, SCENE_MUSIC, tuningOf, initialState, decide, worldStems, stemsFor,
  battleKindOf, hpRatioOf, pickWorldTrack, trackOf, planHourCrossfade, applySceneEvent, createMusicDirector,
} from '../js/audio/director.js';
import * as SFX from '../js/audio/sfxMap.js';
import { TRACKS, CUES, DAY_PARTS, themeForHour, toEngine, worldCue } from '../js/audio/tracks/index.js';
import { SFX_NAMES, normalizeTrack } from '../js/core/audio.js';
import { EVENT_TYPES } from '../js/battle/events.js';
import { createBus } from '../js/core/events.js';
import { createNewWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import { createClock } from '../js/core/time.js';
import * as clockSys from '../js/systems/clockSys.js';
import { createFakeAudio, createFakeTimers, createFakeClock, makeWorld, makeData } from './fixtures/audio.fixture.mjs';

const PROTO_KEYS = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', '__defineGetter__', 'isPrototypeOf'];
const JUNK = [undefined, null, 0, -1, NaN, Infinity, '', 'x', true, [], [1, 2], {}, { hour: 'x' }, { tide: NaN }, () => 1, Symbol('s'), 10n];

function rig({ ready = true, hour = 12, tide = 0.3, season = 'spring', world = makeWorld(), scenes = false, tuning, data, flags, signalOf, sfx } = {}) {
  const bus = createBus();
  const audio = createFakeAudio({ ready });
  const timers = createFakeTimers();
  const clock = createFakeClock({ hour, tide, season });
  const G = { bus, audio, clock, world, data, flags, scenes: scenes ? { top: () => null } : undefined };
  const music = createMusicDirector(G, { timers, tuning, signalOf, sfx: sfx ?? false });
  return { bus, audio, timers, clock, G, music, world };
}
const scene = (music, type, name) => music.onSceneChange({ type, scene: name ? { name } : null, top: name ? { name } : null });
/** Every engine call must name a real track / a real engine layer of some track. */
function assertCleanEngine(audio) {
  const layerNames = new Set();
  for (const id of Object.keys(TRACKS)) for (const n of Object.keys(toEngine(TRACKS[id]).layers)) layerNames.add(n);
  for (const c of audio.calls) {
    if (c[0] === 'playMusic' || c[0] === 'defineTrack') assert.ok(Object.hasOwn(TRACKS, c[1]) || c[1] === 'letter_signal', `engine got track ${String(c[1])}`);
    if (c[0] === 'setStem') assert.ok(layerNames.has(c[1]), `engine got stem ${String(c[1])}`);
    if (c[0] === 'playMusic' || c[0] === 'stopMusic') {
      const fade = c[0] === 'playMusic' ? c[2].fade : c[1].fade;
      assert.ok(Number.isFinite(fade) && fade >= 0, `fade ${fade}`);
    }
  }
}
/** The director still follows the clock (it is not wedged). */
function assertAlive(r) {
  r.music.release();
  for (const k of Object.keys(r.music.status().state.stemOverrides)) r.music.setStem(k, null);
  r.bus.emit('clock:hour', { hour: 6 });
  r.timers.advance(10000);
  const tr = r.music.status().track;
  r.bus.emit('clock:hour', { hour: 15 });
  r.timers.advance(10000);
  assert.notEqual(r.music.status().track, tr, 'director wedged: hour change did not switch the track');
}

// ---------------------------------------------------------------------------------------------
// Determinism across processes
// ---------------------------------------------------------------------------------------------

const SCRIPT = `
import { createMusicDirector } from './js/audio/director.js';
import { createSfxRouter } from './js/audio/sfxMap.js';
import { createBus } from './js/core/events.js';
import { createFakeAudio, createFakeTimers, createFakeClock, makeWorld } from './test/fixtures/audio.fixture.mjs';
const bus = createBus(); const audio = createFakeAudio(); const timers = createFakeTimers();
const G = { bus, audio, clock: createFakeClock({ hour: 5, tide: 0.2 }), world: makeWorld(), scenes: { top: () => null } };
const music = createMusicDirector(G, { timers, sfx: false });
let t = 0;
const router = createSfxRouter({ bus, audio, now: () => t });
const scene = (type, name) => music.onSceneChange({ type, scene: { name }, top: { name } });
scene('push', 'title'); scene('replace', 'overworld');
for (let h = 6; h < 30; h++) { bus.emit('clock:hour', { hour: h % 24 }); timers.advance(777); for (let i = 0; i < 5; i++) { t += 37; bus.emit('player:step', {}); bus.emit('wallet:changed', { delta: 3 }); } }
bus.emit('tide:change', { tide: 0.9, state: 'high' }); bus.emit('weather:change', { kind: 'storm' });
bus.emit('battle:start', { kind: 'trainer' }); bus.emit('battle:hp', { hp: 2, maxHp: 10 });
for (const type of ['damage', 'effectiveness', 'capture-shake', 'stat']) { t += 100; bus.emit('battle:event', { type, amount: 3, mult: 2, segments: 2, stages: -2, result: 'lowered', side: 1 }); }
bus.emit('battle:end', { outcome: 'win' }); timers.advance(20000);
bus.emit('shift:resolved', { anchored: true }); timers.advance(20000); bus.emit('letter:delivered', {}); timers.advance(20000);
process.stdout.write(JSON.stringify({ calls: audio.calls, history: music.history(), status: music.status(), sfx: router.log() }));
`;

test('lane adversarial: one event script gives byte-identical engine calls in separate processes and in-process', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const run = () => execFileSync(process.execPath, ['--input-type=module', '-e', SCRIPT], { cwd: root, encoding: 'utf8' });
  const a = run();
  const b = run();
  assert.equal(a, b);
  const parsed = JSON.parse(a);
  assert.ok(parsed.calls.length > 50 && parsed.sfx.length > 10);
  assert.ok(parsed.history.some((h) => h.track === 'victory') && parsed.history.some((h) => h.track === 'shift_reveal_anchor'));
  // the jitter pitches come from the seeded 'audio:sfx' fork, so they repeat exactly too
  assert.ok(parsed.sfx.some((p) => p.sfx === 'step' && p.pitch !== 1));
});

// ---------------------------------------------------------------------------------------------
// Boundaries
// ---------------------------------------------------------------------------------------------

test('lane adversarial: hour, tide, HP and market boundaries sit exactly where CUES puts them', () => {
  const s = (o) => initialState(o);
  // perc off [1,5), night on [20,5)
  const at = (hour) => worldStems(s({ hour }), themeForHour(hour));
  assert.equal(at(0).perc, true); assert.equal(at(1).perc, false); assert.equal(at(4).perc, false); assert.equal(at(5).perc, true);
  assert.equal(at(19).night, false); assert.equal(at(20).night, true); assert.equal(at(4).night, true); assert.equal(at(5).night, false);
  // tide strictly above 0.7
  assert.equal(worldStems(s({ tide: 0.7 }), 'h_midday').tide, false);
  assert.equal(worldStems(s({ tide: 0.7000001 }), 'h_midday').tide, true);
  assert.equal(worldStems(s({ tide: NaN, tideState: 'high' }), 'h_midday').tide, true);
  assert.equal(worldStems(s({ tide: Infinity, tideState: 'low' }), 'h_midday').tide, false);
  // tense at or below 0.25
  const tense = (hpRatio) => decide(s({ battle: { kind: 'wild', hpRatio } })).stems.tense;
  assert.equal(tense(0.25), true); assert.equal(tense(0.2500001), false); assert.equal(tense(0), true); assert.equal(tense(1), false);
  // market: Saturday (5, Monday = 0) from 18:00 in the market place only
  assert.equal(pickWorldTrack(s({ weekday: 5, hour: 17, place: 'market' })), themeForHour(17));
  assert.equal(pickWorldTrack(s({ weekday: 5, hour: 18, place: 'market' })), 'lantern_market');
  assert.equal(pickWorldTrack(s({ weekday: 5, hour: 23, place: 'market' })), 'lantern_market');
  assert.equal(pickWorldTrack(s({ weekday: 6, hour: 20, place: 'market' })), themeForHour(20));
  assert.equal(pickWorldTrack(s({ weekday: 5, hour: 20, place: 'town' })), themeForHour(20));
  // hour wrapping and junk hours never throw
  for (const hour of [24, -1, 1e9, -1e9, 23.999, NaN, Infinity, 'x', null]) {
    const d = decide(s({ hour }));
    assert.ok(Object.hasOwn(TRACKS, d.track), String(hour));
  }
  assert.equal(decide(s({ hour: 24 })).track, 'h_night_deep');
  assert.equal(decide(s({ hour: -1 })).track, 'h_night');
});

test('lane adversarial: the crossfade plan is bounded — never negative, never beyond the cap, 0 for junk nowPlaying', () => {
  for (const np of [null, undefined, {}, { id: 'h_morning' }, { id: 'h_morning', step: -5 }, { id: 'h_morning', step: NaN }, { id: 'h_morning', pending: true, step: 3 }, { id: 'nope', step: 3 }]) {
    const p = planHourCrossfade(np, 'h_morning', 'h_late_morning');
    assert.equal(p.delayMs, 0, JSON.stringify(np));
    assert.ok(p.fadeMs > 0);
  }
  for (let step = 0; step < 64; step++) {
    const p = planHourCrossfade({ id: 'h_morning', bpm: 100, step }, 'h_morning', 'h_late_morning');
    assert.ok(p.delayMs >= 0 && p.delayMs <= DEFAULTS.HOUR_QUANTIZE_MAX_MS);
  }
  // a very slow track: the bar line is further away than the cap -> switch at once
  const slow = planHourCrossfade({ id: 'h_morning', bpm: 1, step: 1 }, 'h_morning', 'h_late_morning');
  assert.equal(slow.delayMs, 0);
  for (const id of PROTO_KEYS) assert.deepEqual(planHourCrossfade({ id, step: 3 }, id, id), { delayMs: 0, fadeMs: 0 });
});

// ---------------------------------------------------------------------------------------------
// Prototype keys and malformed data
// ---------------------------------------------------------------------------------------------

test('lane adversarial: prototype keys are never tracks, cues, stems or scenes — and never wedge the director', () => {
  for (const k of PROTO_KEYS) assert.equal(trackOf(k), null, k);
  for (const k of PROTO_KEYS) {
    const r = rig();
    r.music.play(k);
    assert.equal(r.music.status().state.override, null, `play(${k}) must be ignored`);
    assert.equal(r.music.sting(k), false);
    r.music.setStem(k, true);
    r.bus.emit('music:cue', { track: k });
    r.bus.emit('music:cue', { sting: k });
    r.bus.emit('music:cue', { stem: k, on: true });
    r.bus.emit('map:enter', { mapId: 'm', music: k, place: k });
    r.bus.emit('battle:start', { kind: k, source: k });
    r.bus.emit('battle:end', { outcome: k });
    r.bus.emit('weather:change', { kind: k });
    r.bus.emit('tide:change', { state: k });
    scene(r.music, 'push', k);
    scene(r.music, 'pop', null);
    assertCleanEngine(r.audio);
    assert.ok(!Object.keys(r.music.status().stems).some((s) => PROTO_KEYS.includes(s)), k);
    assertAlive(r);
  }
  // decide with prototype keys in every slot of the state
  for (const k of PROTO_KEYS) {
    const d = decide(initialState({ sting: { track: k }, override: { track: k }, mapMusic: k, scenes: [k], stemOverrides: JSON.parse(`{"${k}": true}`) }));
    assert.ok(Object.hasOwn(TRACKS, d.track));
    assert.ok(!Object.hasOwn(d.stems, k) || Object.hasOwn(TRACKS[d.track].layers, k));
  }
  // a scene table with a prototype-key cue / track is skipped, not crashed on
  const d = decide(initialState({ scenes: ['overworld', 'weird'] }), DEFAULTS, { overworld: 'world', weird: { cue: 'constructor', track: 'toString' } });
  assert.equal(d.source, 'world');
  // map data with prototype-key music via the registry path
  const r = rig({ data: makeData({ m: { region: 'town', music: '__proto__' } }) });
  r.bus.emit('map:enter', { mapId: 'm' });
  assert.equal(r.music.status().source, 'world');
});

test('lane adversarial: junk payloads on every director event never throw and never reach the engine as junk', () => {
  const r = rig({ scenes: true });
  scene(r.music, 'push', 'overworld');
  for (const evt of DIRECTOR_EVENTS) for (const p of JUNK) assert.doesNotThrow(() => r.bus.emit(evt, p), `${evt} ${String(p)}`);
  for (const p of JUNK) {
    assert.doesNotThrow(() => r.music.onSceneChange(p));
    assert.doesNotThrow(() => r.music.battleEvent(p));
    assert.doesNotThrow(() => r.music.battleHp(p));
    assert.doesNotThrow(() => r.music.setStem(p, p));
    assert.doesNotThrow(() => r.music.sting(p));
    assert.doesNotThrow(() => r.music.play(p, p));
  }
  r.timers.advance(60000);
  assertCleanEngine(r.audio);
  assert.ok(r.music.status());
  JSON.stringify(r.music.status());
  // a junk-laden world and context
  for (const world of [null, 5, 'w', [], { settings: 'x', weather: 3, player: { mapId: 7 } }, { settings: { volumes: 'loud', muted: 'yes' } }]) {
    assert.doesNotThrow(() => createMusicDirector({ bus: createBus(), audio: createFakeAudio(), world, clock: { hour: NaN, tide: 'hi', season: 4 } }, { timers: createFakeTimers(), sfx: false }));
  }
  for (const G of JUNK) assert.doesNotThrow(() => createMusicDirector(G, { timers: createFakeTimers() }).destroy());
});

test('lane adversarial: HP feeds — NaN and Infinity are ignored, switch resets to full, story battles are trainer battles', () => {
  assert.equal(hpRatioOf({ hp: NaN, maxHp: 10 }), null);
  assert.equal(hpRatioOf({ hp: 5, maxHp: NaN }), null);
  assert.equal(hpRatioOf({ hp: 5, maxHp: 0 }), null);
  assert.equal(hpRatioOf({ hp: 5, maxHp: -10 }), null);
  assert.equal(hpRatioOf({ hp: -5, maxHp: 10 }), 0);
  assert.equal(hpRatioOf({ hp: 50, maxHp: 10 }), 1);
  assert.equal(hpRatioOf({ hpRatio: Infinity, hp: 1, maxHp: 10 }), 0.1);
  assert.equal(battleKindOf({ kind: 'story' }), 'trainer');
  assert.equal(battleKindOf({ story: true }), 'trainer');
  assert.equal(battleKindOf({ kind: 'wild', source: 'rematch' }), 'trainer');
  assert.equal(battleKindOf({ kind: 'trainer', source: 'spire' }), 'spire');
  assert.equal(battleKindOf({ kind: 'trainer', source: 'spire', summit: true }), 'summit');
  assert.equal(battleKindOf({ kind: 'wild', trainerId: '' }), 'wild');
  const r = rig();
  r.bus.emit('battle:start', { kind: 'story' });
  assert.equal(r.music.status().track, 'battle_trainer');
  r.bus.emit('battle:event', { event: { type: 'damage', side: 0, amount: 9, hp: 1, maxHp: 10 } });
  assert.equal(r.music.status().stems.tense, true);
  r.bus.emit('battle:event', { type: 'damage', side: 0, hp: NaN, maxHp: 10 });
  assert.equal(r.music.status().stems.tense, true, 'a NaN hp must not clear the tense stem');
  r.bus.emit('battle:event', { type: 'damage', side: 1, hp: 10, maxHp: 10 });
  assert.equal(r.music.status().stems.tense, true, 'foe HP never drives the tense stem');
  r.bus.emit('battle:event', { type: 'switch', side: 0, from: 'a', to: 'b' });
  assert.equal(r.music.status().stems.tense, false);
  // HP events outside a battle are ignored
  r.bus.emit('battle:end', { outcome: 'loss' });
  r.bus.emit('battle:hp', 0);
  assert.equal(r.music.status().state.battle, null);
});

// ---------------------------------------------------------------------------------------------
// Huge inputs
// ---------------------------------------------------------------------------------------------

test('lane adversarial: 20k hour events, 10k-deep scene stacks and 100k sfx events stay fast and bounded', () => {
  const r = rig({ scenes: true });
  scene(r.music, 'push', 'overworld');
  const t0 = Date.now();
  for (let i = 0; i < 20000; i++) { r.bus.emit('clock:hour', { hour: i % 24 }); if (i % 7 === 0) r.timers.advance(5000); }
  r.timers.advance(10000);
  assert.ok(r.timers.size() <= 2, `timers leak: ${r.timers.size()}`);
  assert.ok(r.music.history().length <= DEFAULTS.HISTORY_LIMIT);
  for (let i = 0; i < 10000; i++) scene(r.music, 'push', i % 2 ? 'menu' : 'dialogue');
  assert.equal(r.music.status().source, 'world', 'transparent scenes over the overworld keep the world');
  for (let i = 0; i < 10001; i++) scene(r.music, 'pop', null);
  assert.equal(r.music.status().track, null, 'an emptied stack is silence');
  assert.ok(Date.now() - t0 < 8000, `too slow: ${Date.now() - t0} ms`);

  let now = 0;
  const audio = createFakeAudio();
  const router = SFX.createSfxRouter({ bus: createBus(), audio, now: () => now });
  const t1 = Date.now();
  for (let i = 0; i < 100000; i++) {
    now += 3;
    router.event('sfx', { name: `junk-${i}` });
    router.event('player:step', { sfx: `nope-${i}` });
    router.battle({ type: 'damage', amount: 1 });
  }
  const st = router.stats();
  assert.ok(Date.now() - t1 < 8000, `sfx too slow: ${Date.now() - t1} ms`);
  assert.ok(router.log().length <= 32);
  assert.ok(st.played + st.limited + st.silent === 300000);
  // unknown names never reach the engine
  assert.ok(audio.of('sfx').every((c) => SFX_NAMES.includes(c[1])));
  // limiter state is bounded by the sound bank, not by the number of distinct junk names
  const lim = SFX.createSfxLimiter();
  for (let i = 0; i < 50000; i++) lim.allow(`k${i % 50}`, i * 1000);
  assert.equal(lim.size(), 50);
});

// ---------------------------------------------------------------------------------------------
// Every dial (tuning key)
// ---------------------------------------------------------------------------------------------

test('lane adversarial: every director tuning key ignores junk overrides and the tuningKeys alias lists them all', () => {
  assert.equal(tuningKeys, TUNING_KEYS);
  assert.deepEqual([...TUNING_KEYS], Object.keys(DEFAULTS));
  for (const k of TUNING_KEYS) {
    for (const junk of [NaN, Infinity, 'x', null, {}, [], true]) {
      const t = tuningOf({ [k]: junk });
      const d = DEFAULTS[k];
      if (typeof d === 'number' || typeof d === 'string') assert.equal(t[k], d, `${k} <- ${String(junk)}`);
      else if (Array.isArray(d)) assert.ok(Array.isArray(t[k]), k);
      else assert.ok(t[k] && typeof t[k] === 'object' && !Array.isArray(t[k]), k);
    }
  }
  // a __proto__ key (e.g. from JSON) cannot re-parent the tuning object
  const t = tuningOf(JSON.parse('{"__proto__": {"TENSE_HP_RATIO": 0.9, "EVIL": 1}}'));
  assert.equal(t.TENSE_HP_RATIO, DEFAULTS.TENSE_HP_RATIO);
  assert.equal(t.EVIL, undefined);
  // table-valued keys merge over the defaults
  const m = tuningOf({ SEASON_INTENSITY: { winter: 0.5, monsoon: 0.7, summer: 'loud' } });
  assert.deepEqual(m.SEASON_INTENSITY, { winter: 0.5, spring: 1.0, summer: 1.1, autumn: 1.0, monsoon: 0.7 });
  assert.equal(decide(initialState({ season: 'summer' }), m).intensity, 1.1);
  assert.equal(decide(initialState({ season: 'winter' }), m).intensity, 0.5);
  assert.equal(tuningOf({ CUE_FADE_MS: { title: 99 } }).CUE_FADE_MS.credits, CUES.credits.fade);
});

test('lane adversarial: every numeric director dial changes behaviour when overridden', () => {
  const s = initialState;
  assert.equal(worldStems(s({ hour: 3 }), 'h_night_deep', tuningOf({ PERC_OFF_FROM_HOUR: 4 })).perc, true);
  assert.equal(worldStems(s({ hour: 5 }), 'h_predawn', tuningOf({ PERC_OFF_TO_HOUR: 6 })).perc, false);
  assert.equal(worldStems(s({ hour: 19 }), 'h_dusk', tuningOf({ NIGHT_STEM_FROM_HOUR: 19 })).night, true);
  assert.equal(worldStems(s({ hour: 5 }), 'h_predawn', tuningOf({ NIGHT_STEM_TO_HOUR: 6 })).night, true);
  assert.equal(worldStems(s({ tide: 0.5 }), 'h_midday', tuningOf({ TIDE_STEM_ABOVE: 0.4 })).tide, true);
  assert.equal(worldStems(s({ weather: 'fog' }), 'h_midday', tuningOf({ RAIN_STEM_WEATHERS: ['fog'] })).rain, true);
  assert.equal(decide(s({ battle: { kind: 'wild', hpRatio: 0.4 } }), tuningOf({ TENSE_HP_RATIO: 0.5 })).stems.tense, true);
  assert.equal(pickWorldTrack(s({ weekday: 2, hour: 18, place: 'market' }), tuningOf({ MARKET_WEEKDAY: 2 })), 'lantern_market');
  assert.equal(pickWorldTrack(s({ weekday: 5, hour: 12, place: 'market' }), tuningOf({ MARKET_FROM_HOUR: 12 })), 'lantern_market');
  assert.equal(pickWorldTrack(s({ weekday: 5, hour: 20, place: 'pier' }), tuningOf({ MARKET_PLACE: 'pier' })), 'lantern_market');
  assert.equal(pickWorldTrack(s({ weekday: 5, hour: 20, place: 'market' }), tuningOf({ MARKET_TRACK: 'credits' })), 'credits');
  assert.equal(pickWorldTrack(s({ weekday: 5, hour: 20, place: 'market' }), tuningOf({ MARKET_TRACK: 'constructor' })), themeForHour(20));
  const base = planHourCrossfade(null, 'h_morning', 'h_late_morning');
  assert.equal(planHourCrossfade(null, 'h_morning', 'h_late_morning', tuningOf({ HOUR_FADE_BARS: 4 })).fadeMs, base.fadeMs * 2);
  assert.equal(planHourCrossfade(null, 'h_morning', 'h_late_morning', tuningOf({ HOUR_FADE_BARS: -3 })).fadeMs, 0);
  assert.equal(planHourCrossfade({ id: 'h_morning', bpm: 100, step: 1 }, 'h_morning', 'h_late_morning', tuningOf({ HOUR_QUANTIZE: 0 })).delayMs, 0);
  assert.equal(planHourCrossfade({ id: 'h_morning', bpm: 100, step: 1 }, 'h_morning', 'h_late_morning', tuningOf({ HOUR_QUANTIZE_MAX_MS: 10 })).delayMs, 0);
  for (const [k, src, st] of [['BATTLE_FADE_MS', 'battle', { battle: { kind: 'wild', hpRatio: 1 } }], ['STING_FADE_MS', 'sting', { sting: { track: 'victory' } }],
    ['WORLD_RETURN_FADE_MS', 'world', {}], ['MAP_FADE_MS', 'map', { mapMusic: 'title' }], ['STOP_FADE_MS', 'silence', { scenesKnown: true }]]) {
    const d = decide(s(st), tuningOf({ [k]: 123 }));
    assert.equal(d.source, src, k);
    assert.equal(d.fade, 123, k);
  }
  assert.equal(decide(s({ scenes: ['title'], scenesKnown: true }), tuningOf({ CUE_FADE_MS: { title: 77 } })).fade, 77);
  assert.equal(decide(s({ scenes: ['x'], scenesKnown: true }), tuningOf({ SCENE_FADE_MS: 55 }), { x: { track: 'title' } }).fade, 55);
  // negative fades are clamped before they reach the engine
  const neg = decide(s({ battle: { kind: 'wild', hpRatio: 1 } }), tuningOf({ BATTLE_FADE_MS: -500 }));
  assert.equal(neg.fade, 0);
  // shell dials: STING_TAIL_MS, UNLOCK_POLL_MS, HISTORY_LIMIT, VICTORY_OUTCOMES
  const a = rig({ tuning: { STING_TAIL_MS: 5000, HISTORY_LIMIT: 3, VICTORY_OUTCOMES: ['run'] } });
  a.bus.emit('battle:start', { kind: 'wild' });
  a.bus.emit('battle:end', { outcome: 'win' });
  assert.notEqual(a.music.status().track, 'victory', 'win is no longer a victory outcome');
  a.bus.emit('battle:start', { kind: 'wild' });
  a.bus.emit('battle:end', { outcome: 'run' });
  assert.equal(a.music.status().track, 'victory');
  a.timers.advance(trackLengthOf('victory') + 4000);
  assert.equal(a.music.status().track, 'victory', 'still inside the long tail');
  a.timers.advance(1500);
  assert.notEqual(a.music.status().track, 'victory');
  assert.ok(a.music.history().length <= 3);
  const b = rig({ ready: false, tuning: { UNLOCK_POLL_MS: 5000 } });
  b.audio.unlock();
  b.timers.advance(4000);
  assert.equal(b.music.status().locked, true);
  b.timers.advance(1001);
  assert.equal(b.music.status().locked, false);
  // SEASON_INTENSITY reaches the engine
  const c = rig({ season: 'winter', tuning: { SEASON_INTENSITY: { winter: 0.3 } } });
  assert.deepEqual(c.audio.of('setMusicParam').at(-1), ['setMusicParam', { intensity: 0.3 }]);
});
function trackLengthOf(id) { const t = TRACKS[id]; return Math.round((t.bars * ((t.stepsPerBar || 16) === 12 ? 3 : 4) * 60000) / t.bpm); }

test('lane adversarial: every sfx tuning key is referenced by a rule or the limiter, and overriding it changes the result', () => {
  assert.equal(SFX.tuningKeys, SFX.TUNING_KEYS);
  const refs = new Set();
  const walk = (x) => { if (typeof x === 'string' && x.startsWith('$')) refs.add(x.slice(1)); else if (x && typeof x === 'object') for (const v of Object.values(x)) walk(v); };
  for (const table of [SFX.BUS_SFX, SFX.VERB_SFX, SFX.BATTLE_SFX]) walk(table);
  for (const k of SFX.TUNING_KEYS) assert.ok(refs.has(k) || ['SFX_DEFAULT_MIN_INTERVAL_MS', 'SFX_BURST_WINDOW_MS', 'SFX_BURST_MAX'].includes(k), `unused tuning key ${k}`);
  // no designer number is written literally in a table any more (0 only as structure-free defaults)
  const literals = [];
  const scan = (x, path) => {
    if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) {
      if (['minIntervalMs', 'volume', 'semitones', 'max', 'resetMs', 'amount', 'gt', 'gte', 'lt', 'lte'].includes(k) && typeof v === 'number' && v !== 0) literals.push(`${path}.${k}=${v}`);
      scan(v, `${path}.${k}`);
    }
  };
  for (const [n, table] of Object.entries({ BUS: SFX.BUS_SFX, VERB: SFX.VERB_SFX, BATTLE: SFX.BATTLE_SFX })) scan(table, n);
  assert.deepEqual(literals, []);
  // each $-referenced interval / volume follows its key
  const every = (entry) => (Array.isArray(entry) ? entry : [entry]);
  for (const table of [SFX.BUS_SFX, SFX.VERB_SFX, SFX.BATTLE_SFX]) {
    for (const entry of Object.values(table)) for (const rule of every(entry)) {
      if (!rule.sfx) continue;
      const tuning = {};
      if (typeof rule.minIntervalMs === 'string') tuning[rule.minIntervalMs.slice(1)] = 4321;
      if (typeof rule.volume === 'string') tuning[rule.volume.slice(1)] = 0.123;
      if (!Object.keys(tuning).length) continue;
      const payload = {};
      for (const m of rule.when ? (Array.isArray(rule.when) ? rule.when : [rule.when]) : []) {
        payload[m.field] = 'eq' in m ? m.eq : 'in' in m ? m.in[0] : 'gt' in m ? 1e9 : 'lt' in m ? -1e9 : 'gte' in m ? 1e9 : 'lte' in m ? 0.0001 : m.truthy;
      }
      const play = SFX.resolveSfx(rule, payload, { tuning: SFX.tuningOf(tuning) });
      if (typeof rule.minIntervalMs === 'string') assert.equal(play.minIntervalMs, 4321, JSON.stringify(rule));
      if (typeof rule.volume === 'string') assert.equal(play.volume, 0.123, JSON.stringify(rule));
    }
  }
  // the limiter dials
  const lim = SFX.createSfxLimiter({ tuning: { SFX_BURST_MAX: 2, SFX_BURST_WINDOW_MS: 1000 } });
  assert.ok(lim.allow('a', 0, 0) && lim.allow('b', 1, 0));
  assert.equal(lim.allow('c', 2, 0), false);
  assert.equal(lim.allow('c', 1001, 0), true);
  // junk and __proto__ overrides
  for (const k of SFX.TUNING_KEYS) for (const junk of [NaN, 'x', null, {}]) assert.equal(SFX.tuningOf({ [k]: junk })[k], SFX.DEFAULTS[k]);
  assert.equal(SFX.tuningOf(JSON.parse('{"__proto__": {"STEP_VOLUME": 2}}')).STEP_VOLUME, SFX.DEFAULTS.STEP_VOLUME);
  assert.equal(SFX.resolveRef('$constructor', SFX.DEFAULTS, 7), 7);
});

// ---------------------------------------------------------------------------------------------
// sfx tables against the real vocabularies
// ---------------------------------------------------------------------------------------------

test('lane adversarial: every battle sfx key is a real battle event type; engine events resolve as the scene will feed them', () => {
  for (const type of Object.keys(SFX.BATTLE_SFX)) assert.ok(EVENT_TYPES.includes(type), `BATTLE_SFX.${type} is not a battle event type`);
  // the engine emits ONE capture-shake with `segments`; better odds climb in pitch
  const p0 = SFX.sfxForBattleEvent({ type: 'capture-shake', segments: 0 });
  const p3 = SFX.sfxForBattleEvent({ type: 'capture-shake', segments: 3 });
  assert.ok(p3.semitones > p0.semitones);
  assert.equal(SFX.sfxForBattleEvent({ type: 'capture-shake', n: 1, segments: 3 }).semitones, SFX.DEFAULTS.CAPTURE_SHAKE_SEMITONES, 'a per-tick n wins over segments');
  assert.equal(SFX.sfxForBattleEvent({ type: 'scrap-cost', amount: 3 }).sfx, 'thwap');
  assert.equal(SFX.sfxForBattleEvent({ type: 'type-shift' }).sfx, 'shiftFlip');
  for (const type of ['turn', 'message', 'move', 'end', 'exp']) assert.equal(SFX.sfxForBattleEvent({ type }), null, type);
  for (const k of PROTO_KEYS) {
    assert.equal(SFX.sfxForBattleEvent({ type: k }), null);
    assert.equal(SFX.sfxForEvent(k, {}), null);
    assert.equal(SFX.sfxForVerb(k, {}), null);
    assert.equal(SFX.sfxForEvent('sfx', { name: k }), null, `sfx name ${k}`);
  }
});

test('lane adversarial: sound names from payloads must exist in the core bank (tile footsteps, warps, script sfx)', () => {
  assert.equal(SFX.isKnownSfx('stepWater'), true);
  assert.equal(SFX.isKnownSfx('nope'), false);
  assert.equal(SFX.isKnownSfx(''), false);
  assert.equal(SFX.isKnownSfx(7), false);
  // tilesets name each tile's footstep sound; the step event plays it when the overworld passes it on
  assert.equal(SFX.sfxForEvent('player:step', { sfx: 'stepWater' }).sfx, 'stepWater');
  assert.equal(SFX.sfxForEvent('player:step', { sfx: 'bogus' }).sfx, 'step');
  assert.equal(SFX.sfxForEvent('player:step', { terrain: 'water', sfx: 'bogus' }).sfx, 'stepWater');
  assert.equal(SFX.sfxForEvent('warp', { sfx: 'bogus' }).sfx, 'doorOpen');
  assert.equal(SFX.sfxForEvent('sfx', { name: 'bogus' }), null);
  assert.equal(SFX.sfxForEvent('sfx', { name: ' coin ' }).sfx, 'coin');
  // junk payloads at the router never throw; the engine only ever hears real names
  const bus = createBus();
  const audio = createFakeAudio();
  let now = 0;
  const router = SFX.createSfxRouter({ bus, audio, now: () => (now += 500) });
  for (const evt of [...Object.keys(SFX.BUS_SFX), 'interact', 'battle:event']) for (const p of JUNK) assert.doesNotThrow(() => bus.emit(evt, p), evt);
  for (const p of JUNK) { router.verb(p, p); router.battle(p); router.event(p, p); }
  assert.ok(audio.of('sfx').every((c) => SFX_NAMES.includes(c[1])));
  // a broken clock (NaN) still plays, rate-limited as if time stood still
  const r2 = SFX.createSfxRouter({ audio: createFakeAudio(), now: () => NaN });
  assert.ok(r2.event('loan:paid', {}));
  assert.equal(r2.event('loan:paid', {}), null);
  router.destroy();
});

test('lane adversarial: weather kind data drives weather stems (data rows over the defaults)', () => {
  // the defaults: rain and storm list the rain stem, exactly the RAIN_STEM_WEATHERS default
  for (const kind of ['clear', 'overcast', 'rain', 'fog', 'storm', 'snow']) {
    const r = rig();
    r.bus.emit('weather:change', { kind });
    assert.equal(r.music.status().stems.rain, kind === 'rain' || kind === 'storm', kind);
  }
  // a content row adds a kind that rains
  const data = { weather: [{ id: 'squall', stems: ['rain'] }] };
  const r = rig({ data });
  r.bus.emit('weather:change', { kind: 'squall' });
  assert.equal(r.music.status().stems.rain, true);
  assert.deepEqual(r.music.status().state.weatherStems, ['rain']);
  // an unknown kind with no data is just not rain
  r.bus.emit('weather:change', { kind: 'meteor-shower' });
  assert.equal(r.music.status().stems.rain, false);
  // malformed weather data never breaks the director
  const bad = rig({ data: { weather: [{ id: 'BAD ID' }] } });
  assert.doesNotThrow(() => bad.bus.emit('weather:change', { kind: 'rain' }));
  assert.equal(bad.music.status().stems.rain, true, 'RAIN_STEM_WEATHERS still applies');
});

// ---------------------------------------------------------------------------------------------
// Round trips
// ---------------------------------------------------------------------------------------------

test('lane adversarial: decisions survive a JSON round trip of the music state', () => {
  const states = [];
  for (let hour = 0; hour < 24; hour += 5) for (const scenes of [[], ['overworld'], ['overworld', 'battle'], ['title'], ['ending']]) {
    states.push(initialState({ hour, weekday: hour % 7, tide: hour / 24, weather: hour % 2 ? 'rain' : 'clear', weatherStems: hour % 2 ? ['rain'] : [], season: 'summer', place: 'market',
      scenes, scenesKnown: true, battle: scenes.includes('battle') ? { kind: 'spire', hpRatio: 0.2 } : null, stemOverrides: { perc: false } }));
  }
  for (const s of states) assert.deepEqual(decide(JSON.parse(JSON.stringify(s))), decide(s));
});

test('lane adversarial: a real world -> JSON -> world:replaced gives the same music as the live world', () => {
  const store = createStore(createNewWorld({ seedCode: 'TEST-0000-0000' }));
  const clock = createClock(clockSys.optionsFrom(store.world));
  clockSys.restoreFrom(store.world, clock);
  const audio = createFakeAudio();
  const timers = createFakeTimers();
  const G = { bus: store.bus, audio, clock, get world() { return store.world; }, scenes: { top: () => ({ name: 'overworld' }) } };
  const music = createMusicDirector(G, { timers, sfx: false });
  for (let i = 0; i < 40; i++) clockSys.tick(store.world, clock, 37_000, { bus: store.bus });
  timers.advance(10000);
  const before = music.status();
  const snap = JSON.parse(JSON.stringify(store.snapshot()));
  store.replace(snap);
  timers.advance(10000);
  const after = music.status();
  assert.equal(after.track, before.track);
  assert.deepEqual(after.stems, before.stems);
  assert.equal(after.state.hour, before.state.hour);
  assert.equal(after.state.weekday, before.state.weekday);
  // the settings in the restored world reached the engine
  const vol = audio.of('setVolume').at(-1)[1];
  assert.deepEqual(vol, { master: snap.settings.volumes.master, music: snap.settings.volumes.music, sfx: snap.settings.volumes.sfx });
  assertCleanEngine(audio);
  music.destroy();
});

// ---------------------------------------------------------------------------------------------
// The score
// ---------------------------------------------------------------------------------------------

test('lane adversarial: the score is deep-frozen; mutation attempts throw and leave every note intact', () => {
  const before = JSON.stringify(TRACKS);
  assert.throws(() => { TRACKS.h_morning.bpm = 1; }, TypeError);
  assert.throws(() => { TRACKS.h_morning.layers.melody.pattern[0].n = 1; }, TypeError);
  assert.throws(() => { TRACKS.h_morning.layers.melody.pattern.push({}); }, TypeError);
  assert.throws(() => { DAY_PARTS[0].layers.core.gain = 9; }, TypeError);
  assert.throws(() => { CUES.title.stems.perc = true; }, TypeError);
  assert.throws(() => { CUES.world.stems.rain = () => true; }, TypeError);
  assert.equal(JSON.stringify(TRACKS), before);
  // still usable: every track normalizes in the engine and every hour has a cue
  for (const id of Object.keys(TRACKS)) assert.ok(normalizeTrack(id, toEngine(TRACKS[id])));
  for (let h = 0; h < 24; h++) assert.equal(worldCue({ hour: h }).track, themeForHour(h));
  // the scene table and director constants are frozen as well
  assert.ok(Object.isFrozen(SCENE_MUSIC) && Object.isFrozen(DEFAULTS) && Object.isFrozen(SFX.DEFAULTS));
});

test('lane adversarial: applySceneEvent never shares the input array and tolerates junk events', () => {
  const stack = ['a', 'b'];
  for (const ev of JUNK) {
    const out = applySceneEvent(stack, ev);
    assert.notEqual(out, stack);
    assert.deepEqual(stack, ['a', 'b']);
  }
  assert.deepEqual(applySceneEvent(null, { type: 'push', scene: 'x' }), ['x']);
  assert.deepEqual(applySceneEvent(['a'], { type: 'pop', top: null }), []);
  assert.deepEqual(applySceneEvent(['a', 'zzz'], { type: 'pop', top: 'a' }), ['a']);
});
