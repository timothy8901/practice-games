// js/audio/director.js — pure decision logic (cue selection, stems, crossfade planning) and the
// director wired to a real bus with a fake engine and fake timers.
// Run: node --test test/audio.director.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS, TUNING_KEYS, SCENE_MUSIC, DIRECTOR_EVENTS, tuningOf, initialState, inHours, cueStateOf, pickWorldTrack,
  worldStems, battleKindOf, hpRatioOf, stemsFor, decide, trackLengthMs, msToNextBar, planHourCrossfade, applySceneEvent,
  createMusicDirector,
} from '../js/audio/director.js';
import { TRACKS, CUES, worldCue, themeForHour, twoBarsMs } from '../js/audio/tracks/index.js';
import { createBus } from '../js/core/events.js';
import { createFakeAudio, createFakeTimers, createFakeClock, makeWorld, makeData } from './fixtures/audio.fixture.mjs';

/** A director on a real bus with fakes; `scenes: true` gives it a scene feed. */
function rig({ ready = true, hour = 12, tide = 0.3, season = 'spring', world = makeWorld(), scenes = false, tuning, data, flags, throwOn, signalOf, sfx } = {}) {
  const bus = createBus();
  const audio = createFakeAudio({ ready, throwOn });
  const timers = createFakeTimers();
  const clock = createFakeClock({ hour, tide, season });
  const G = { bus, audio, clock, world, data, flags, scenes: scenes ? { top: () => null } : undefined };
  const music = createMusicDirector(G, { timers, tuning, signalOf, sfx: sfx ?? false });
  return { bus, audio, timers, clock, G, music, world };
}
const scene = (music, type, name, top = name) => music.onSceneChange({ type, scene: name ? { name } : null, top: top ? { name: top } : null });

// ---------------------------------------------------------------------------------------------
// Tuning and pure rules
// ---------------------------------------------------------------------------------------------

test('director: DEFAULTS frozen, TUNING_KEYS complete, tuningOf only accepts finite numbers for numeric keys', () => {
  assert.ok(Object.isFrozen(DEFAULTS));
  assert.deepEqual(TUNING_KEYS, Object.keys(DEFAULTS));
  const t = tuningOf({ TENSE_HP_RATIO: 0.5, STING_TAIL_MS: 'x', MARKET_PLACE: 'fair' });
  assert.equal(t.TENSE_HP_RATIO, 0.5);
  assert.equal(t.STING_TAIL_MS, DEFAULTS.STING_TAIL_MS);
  assert.equal(t.MARKET_PLACE, 'fair');
  assert.equal(DEFAULTS.BATTLE_FADE_MS, CUES.battle.fade);
  assert.deepEqual({ ...DEFAULTS.CUE_FADE_MS }, { title: CUES.title.fade, forecast: CUES.forecast.fade, relighting: CUES.relighting.fade, credits: CUES.credits.fade });
});

test('director: defaults reproduce tracks.CUES world rules for every hour, weekday, place, tide and weather', () => {
  for (let hour = 0; hour < 24; hour++) for (let weekday = 0; weekday < 7; weekday++) {
    for (const place of [null, 'town', 'market']) for (const tide of [0, 0.7, 0.71, 1]) for (const weather of ['clear', 'rain', 'storm', 'fog']) {
      const s = initialState({ hour, weekday, place, tide, weather, season: 'winter' });
      const cue = worldCue(cueStateOf(s));
      const track = pickWorldTrack(s);
      assert.equal(track, cue.track, `${hour}h wd${weekday} ${place}`);
      assert.deepEqual(worldStems(s, track), cue.stems);
      const d = decide(s);
      assert.equal(d.track, cue.track);
      assert.equal(d.intensity, cue.intensity);
    }
  }
  // weekday conversion: 0 = Monday here, 0 = Sunday in CUES
  assert.equal(cueStateOf(initialState({ weekday: 5 })).weekday, 6);
  assert.equal(cueStateOf(initialState({ weekday: 6 })).weekday, 0);
  assert.equal(pickWorldTrack(initialState({ hour: 19, weekday: 5, place: 'market' })), 'lantern_market');
  assert.equal(pickWorldTrack(initialState({ hour: 17, weekday: 5, place: 'market' })), 'h_afternoon');
});

test('director: the stem and market rules are tunable', () => {
  const t = tuningOf({ NIGHT_STEM_FROM_HOUR: 22, NIGHT_STEM_TO_HOUR: 2, PERC_OFF_FROM_HOUR: 0, PERC_OFF_TO_HOUR: 0, TIDE_STEM_ABOVE: 0.2, RAIN_STEM_WEATHERS: ['fog'], MARKET_WEEKDAY: 0, MARKET_FROM_HOUR: 10, MARKET_PLACE: 'pier' });
  const s = initialState({ hour: 21, tide: 0.3, weather: 'fog' });
  assert.deepEqual(worldStems(s, 'h_dusk', t), { core: true, melody: true, bass: true, perc: true, night: false, tide: true, rain: true });
  assert.equal(worldStems(initialState({ hour: 1 }), 'h_night_deep', t).night, true);
  assert.equal(pickWorldTrack(initialState({ hour: 11, weekday: 0, place: 'pier' }), t), 'lantern_market');
  assert.equal(pickWorldTrack(initialState({ hour: 11, weekday: 0, place: 'pier' }), tuningOf({ ...t, MARKET_TRACK: 'nope' })), 'h_late_morning', 'unknown market track falls back');
  assert.ok(inHours(23, 22, 2) && inHours(1, 22, 2) && !inHours(2, 22, 2) && !inHours(5, 3, 3));
  assert.deepEqual(worldStems(initialState(), 'nope'), {});
});

test('director: tide stem uses the height when known, else the tide state', () => {
  assert.equal(worldStems(initialState({ tide: null, tideState: 'high' }), 'h_midday').tide, true);
  assert.equal(worldStems(initialState({ tide: null, tideState: 'mid' }), 'h_midday').tide, false);
  assert.equal(worldStems(initialState({ tide: 0.75, tideState: 'mid' }), 'h_midday').tide, true);
  assert.equal(worldStems(initialState({ tide: 0.7 }), 'h_midday').tide, false, 'strictly above 0.7');
});

test('director: battle kinds, HP ratios and the tense threshold', () => {
  assert.equal(battleKindOf({ kind: 'wild' }), 'wild');
  assert.equal(battleKindOf({ kind: 'trainer' }), 'trainer');
  assert.equal(battleKindOf({ kind: 'trainer', source: 'spire' }), 'spire');
  assert.equal(battleKindOf({ kind: 'trainer', summit: true }), 'summit');
  assert.equal(battleKindOf({ trainerId: 'x' }), 'trainer');
  assert.equal(battleKindOf(null), 'wild');
  assert.equal(hpRatioOf({ hp: 1, maxHp: 4 }), 0.25);
  assert.equal(hpRatioOf({ hpRatio: 2 }), 1);
  assert.equal(hpRatioOf(-1), 0);
  assert.equal(hpRatioOf({ hp: 1, maxHp: 0 }), null);
  assert.equal(hpRatioOf('x'), null);
  for (const [kind, track] of [['wild', 'battle_wild'], ['trainer', 'battle_trainer'], ['spire', 'battle_spire'], ['summit', 'summit']]) {
    assert.equal(decide(initialState({ battle: { kind, hpRatio: 1 } })).track, track);
  }
  const at = (r, t) => decide(initialState({ battle: { kind: 'wild', hpRatio: r } }), t).stems.tense;
  assert.equal(at(0.25), true);
  assert.equal(at(0.2501), false);
  assert.equal(at(0.4, tuningOf({ TENSE_HP_RATIO: 0.5 })), true);
  assert.equal(decide(initialState({ battle: { kind: 'wild', hpRatio: 1 } })).fade, CUES.battle.fade);
});

test('director: decide priority — sting > override > scene > battle > map > world; known empty stack is silence', () => {
  const base = { hour: 8, scenes: ['overworld'], scenesKnown: true };
  assert.equal(decide(initialState(base)).track, 'h_morning');
  assert.equal(decide(initialState({ ...base, mapMusic: 'title' })).source, 'map');
  assert.equal(decide(initialState({ ...base, mapMusic: 'not-a-track' })).track, 'h_morning');
  assert.equal(decide(initialState({ ...base, battle: { kind: 'wild', hpRatio: 1 } })).track, 'battle_wild', 'overworld under a live battle');
  assert.equal(decide(initialState({ ...base, scenes: ['overworld', 'battle'], battle: { kind: 'trainer', hpRatio: 1 } })).track, 'battle_trainer');
  assert.equal(decide(initialState({ ...base, scenes: ['overworld', 'battle'] })).track, 'h_morning', 'ended battle falls through');
  assert.equal(decide(initialState({ ...base, scenes: ['overworld', 'battle', 'forecast'], battle: { kind: 'wild', hpRatio: 1 } })).track, 'forecast');
  assert.equal(decide(initialState({ ...base, scenes: ['overworld', 'menu', 'party'] })).track, 'h_morning', 'menus are transparent');
  assert.equal(decide(initialState({ ...base, scenes: ['title', 'saveLoad'] })).track, 'title');
  assert.equal(decide(initialState({ ...base, override: { track: 'credits' } })).source, 'override');
  assert.equal(decide(initialState({ ...base, override: { track: null } })).track, null);
  assert.equal(decide(initialState({ ...base, override: { track: 'credits' }, sting: { track: 'victory' } })).track, 'victory');
  assert.equal(decide(initialState({ ...base, scenes: ['boot'] })).track, null);
  assert.equal(decide(initialState({ scenes: [], scenesKnown: true })).track, null);
  assert.equal(decide(initialState({ hour: 8 })).track, 'h_morning', 'no scene feed = world');
  const title = decide(initialState({ scenes: ['title'], scenesKnown: true }));
  assert.equal(title.fade, CUES.title.fade);
  assert.equal(title.stems.night, true);
  assert.equal(title.stems.tide, true);
  assert.equal(title.stems.perc, false);
  assert.equal(decide(initialState({ scenes: ['ending'], scenesKnown: true })).track, 'relighting');
  assert.equal(decide(initialState({ scenes: ['ending'], scenesKnown: true, oneShotDone: 'relighting' })).track, CUES.relighting.then);
  assert.equal(decide(initialState({ scenes: ['x'], scenesKnown: true }), DEFAULTS, { x: { track: 'victory' } }).oneShot, true);
  assert.equal(decide(initialState({ scenes: ['x'], scenesKnown: true, oneShotDone: 'victory' }), DEFAULTS, { x: { track: 'victory' } }).track, null, 'one-shot without then = silence');
  assert.equal(decide(initialState({ hour: 3, scenes: ['x'], scenesKnown: true }), DEFAULTS, { x: { track: 'nope' } }).track, 'h_predawn', 'bad scene entry ignored');
});

test('director: stemsFor — layer defaults, world rules, cue stems, script overrides', () => {
  const s = initialState({ hour: 22, weather: 'rain', tide: 0.9, stemOverrides: { melody: false, ghost: true } });
  const st = stemsFor('h_night', s, 'world');
  assert.deepEqual(st, { core: true, melody: false, bass: true, perc: true, night: true, tide: true, rain: true });
  const market = stemsFor('lantern_market', initialState({ hour: 3 }), 'world');
  assert.equal(market.night, true, 'CUES.lantern_market.stems keeps the bells on');
  assert.equal(market.perc, false, 'quiet-hours rule still applies');
  assert.deepEqual(stemsFor('nope', s, 'world'), {});
  assert.deepEqual(Object.keys(stemsFor('victory', initialState(), 'sting')).sort(), Object.keys(TRACKS.victory.layers).sort());
});

test('director: track lengths, bar-line waits and the hourly crossfade plan', () => {
  assert.equal(trackLengthMs(TRACKS.shift_reveal), 1600);
  assert.equal(trackLengthMs(TRACKS.victory), 8000);
  assert.equal(trackLengthMs(TRACKS.letter), 4800);
  assert.equal(trackLengthMs(TRACKS.lantern_market), Math.round(16 * 3 * 60000 / 138));
  assert.equal(trackLengthMs(null), 0);
  const morning = { ...TRACKS.h_morning };
  assert.equal(msToNextBar({ id: 'h_morning', bpm: 100, step: 0 }, morning), 0);
  assert.equal(msToNextBar({ id: 'h_morning', bpm: 100, step: 4 }, morning), 1800);
  assert.equal(msToNextBar({ id: 'h_morning', bpm: 100, step: 31 }, morning), 150);
  assert.equal(msToNextBar({ id: 'other', bpm: 100, step: 4 }, morning), 0);
  assert.equal(msToNextBar({ id: 'h_morning', pending: true }, morning), 0);
  assert.equal(msToNextBar(null, morning), 0);
  assert.equal(msToNextBar({ id: 'h_morning', bpm: 100, step: NaN }, morning), 0);
  assert.equal(msToNextBar({ id: 'lantern_market', bpm: 138, step: 6 }, TRACKS.lantern_market), Math.round(6 * 60000 / 138 / 4));
  const np = { id: 'h_morning', bpm: 100, step: 4 };
  assert.deepEqual(planHourCrossfade(np, 'h_morning', 'h_late_morning'), { delayMs: 1800, fadeMs: twoBarsMs(TRACKS.h_late_morning) });
  assert.equal(planHourCrossfade(np, 'h_morning', 'h_late_morning').fadeMs, CUES.world.fade('h_late_morning'));
  assert.equal(planHourCrossfade(np, 'h_morning', 'h_late_morning', tuningOf({ HOUR_QUANTIZE: 0 })).delayMs, 0);
  assert.equal(planHourCrossfade(np, 'h_morning', 'h_late_morning', tuningOf({ HOUR_QUANTIZE_MAX_MS: 1000 })).delayMs, 0, 'too long a wait = switch now');
  assert.equal(planHourCrossfade(np, 'h_morning', 'h_late_morning', tuningOf({ HOUR_FADE_BARS: 4 })).fadeMs, 2 * twoBarsMs(TRACKS.h_late_morning));
  assert.equal(planHourCrossfade(np, null, 'h_late_morning').delayMs, 0);
});

test('director: scene-stack model follows push/pop/replace/clear and re-syncs to the event top', () => {
  let st = [];
  st = applySceneEvent(st, { type: 'push', scene: { name: 'boot' }, top: { name: 'boot' } });
  st = applySceneEvent(st, { type: 'replace', scene: { name: 'title' }, top: { name: 'title' } });
  st = applySceneEvent(st, { type: 'push', scene: { name: 'saveLoad' }, top: { name: 'saveLoad' } });
  assert.deepEqual(st, ['title', 'saveLoad']);
  st = applySceneEvent(st, { type: 'pop', scene: { name: 'saveLoad' }, top: { name: 'title' } });
  assert.deepEqual(st, ['title']);
  st = applySceneEvent(st, { type: 'pop', scene: { name: 'title' }, top: null });
  assert.deepEqual(st, []);
  assert.deepEqual(applySceneEvent(['a', 'b'], { type: 'clear', scene: null, top: null }), []);
  assert.deepEqual(applySceneEvent(['a', 'b'], { type: 'pop', top: { name: 'z' } }), ['z'], 'drifted model re-synced');
  assert.deepEqual(applySceneEvent(['a'], { type: 'push', scene: 'b', top: 'b' }), ['a', 'b'], 'names as strings (bus scene:change payload)');
  assert.deepEqual(applySceneEvent(['a'], null), ['a']);
  assert.deepEqual(applySceneEvent(null, { type: 'push', scene: { name: 'q' } }), ['q']);
});

// ---------------------------------------------------------------------------------------------
// The director on a bus
// ---------------------------------------------------------------------------------------------

test('director: boots silent with an empty scene stack, then follows title -> overworld', () => {
  const { audio, music, timers } = rig({ scenes: true, hour: 7 });
  assert.equal(audio.plays().length, 0, 'nothing plays before the first scene');
  scene(music, 'push', 'boot');
  scene(music, 'replace', 'title');
  assert.deepEqual(audio.plays(), ['title']);
  assert.equal(audio.of('playMusic')[0][2].fade, CUES.title.fade);
  assert.equal(audio.stems.get('night'), true);
  assert.equal(audio.stems.get('tide'), true);
  assert.equal(audio.stems.get('perc'), false, 'title perc off (one prefix stem)');
  scene(music, 'push', 'saveLoad');
  assert.deepEqual(audio.plays(), ['title'], 'modal over title keeps the theme');
  scene(music, 'pop', 'saveLoad', 'title');
  scene(music, 'replace', 'overworld');
  assert.deepEqual(audio.plays(), ['title', 'h_morning']);
  assert.equal(music.status().scene, 'overworld');
  assert.equal(music.status().source, 'world');
  assert.equal(audio.stems.get('night'), false, 'stems are global: the world theme turns the title bells off');
  timers.advance(10000);
  assert.deepEqual(audio.plays(), ['title', 'h_morning']);
});

test('director: on-the-hour crossfade waits for the bar line and fades over two bars; same block = no switch', () => {
  const { audio, music, bus, timers } = rig({ hour: 6 });
  assert.deepEqual(audio.plays(), ['h_morning']);
  bus.emit('clock:hour', { hour: 7 });
  bus.emit('clock:hour', { hour: 8 });
  assert.deepEqual(audio.plays(), ['h_morning'], 'same 3-hour block');
  audio.setStep(4);
  bus.emit('clock:hour', { hour: 9 });
  assert.deepEqual(music.status().pending, { track: 'h_late_morning', delayMs: 1800 });
  assert.deepEqual(audio.plays(), ['h_morning']);
  timers.advance(1799);
  assert.deepEqual(audio.plays(), ['h_morning']);
  timers.advance(1);
  assert.deepEqual(audio.plays(), ['h_morning', 'h_late_morning']);
  assert.equal(audio.of('playMusic').at(-1)[2].fade, CUES.world.fade('h_late_morning'));
  assert.equal(music.status().pending, null);
  const sched = music.history().find((h) => h.action === 'schedule');
  assert.equal(sched.delayMs, 1800);
});

test('director: a burst of hours keeps exactly one pending switch', () => {
  const { audio, music, bus, timers } = rig({ hour: 6 });
  audio.setStep(1);
  const base = timers.size();
  bus.emit('clock:hour', { hour: 9 });
  bus.emit('clock:hour', { hour: 12 });
  bus.emit('clock:hour', { hour: 15 });
  assert.equal(music.status().pending.track, 'h_afternoon');
  assert.equal(timers.size(), base + 1);
  timers.advance(5000);
  assert.deepEqual(audio.plays(), ['h_morning', 'h_afternoon']);
  bus.emit('clock:hour', { hour: 18 });
  bus.emit('clock:hour', { hour: 17 });
  assert.equal(music.status().pending, null, 'returning to the playing block cancels the switch');
});

test('director: a 24-hour sweep plays each day-part theme once, in order, with its stems', () => {
  const { audio, music, bus, timers } = rig({ hour: 0, tuning: { HOUR_QUANTIZE: 0 } });
  for (let h = 1; h < 24; h++) bus.emit('clock:hour', { hour: h });
  bus.emit('clock:hour', { hour: 0 });
  timers.advance(100);
  assert.deepEqual(audio.plays(), [...[0, 3, 6, 9, 12, 15, 18, 21].map(themeForHour), 'h_night_deep']);
  assert.equal(music.status().track, 'h_night_deep');
  // stems were set as the clock moved: 03:00 quiet hours, 21:00 night bells
  const log = music.history();
  assert.ok(log.every((h) => h.reason !== 'hour' || h.fade === CUES.world.fade(h.track)));
});

test('director: night / perc / tide / rain stems follow clock, tide and weather', () => {
  const { audio, bus, clock } = rig({ hour: 2, tide: 0.1 });
  assert.equal(audio.stems.get('night'), true);
  assert.equal(audio.stems.get('perc'), false, '01:00–05:00 drops the brushes');
  assert.equal(audio.stems.get('tide'), false);
  bus.emit('tide:change', { state: 'high', previous: 'mid', tide: 0.85 });
  assert.equal(audio.stems.get('tide'), true);
  clock.tide = 0.6;
  bus.emit('clock:minute', { hour: 2, minute: 30 });
  assert.equal(audio.stems.get('tide'), false, 'falling tide below 0.7 turns the swell off between state changes');
  const before = audio.of('setStem').length;
  bus.emit('clock:minute', { hour: 2, minute: 31 });
  assert.equal(audio.of('setStem').length, before, 'nothing to change, nothing sent');
  bus.emit('weather:change', { current: 'rain' });
  assert.equal(audio.stems.get('rain'), true);
  bus.emit('weather:change', { kind: 'fog' });
  assert.equal(audio.stems.get('rain'), false);
  bus.emit('clock:hour', { hour: 5 });
  assert.equal(audio.stems.get('perc'), true);
  assert.equal(audio.stems.get('night'), false);
});

test('director: season sets the music intensity; map music and the market night override the hour', () => {
  const data = makeData({ 'int-a': { id: 'int-a', region: 'town', music: 'credits' }, green: { id: 'green', region: 'market' } });
  const { audio, bus, music, world } = rig({ hour: 19, season: 'winter', data });
  assert.equal(audio.of('setMusicParam')[0][1].intensity, 0.9);
  bus.emit('map:enter', { mapId: 'int-a' });
  assert.equal(music.status().track, 'credits');
  assert.equal(music.status().source, 'map');
  bus.emit('map:enter', { mapId: 'green' });
  assert.equal(music.status().track, 'h_dusk', 'not Saturday');
  world.clock.total = 6 * 1440 + 19 * 60; // game day 7 (a Saturday per clockSys)
  bus.emit('day:start', { dayOfWeek: 5 });
  assert.equal(music.status().track, 'lantern_market');
  assert.equal(audio.stems.get('night'), true);
  bus.emit('map:enter', { mapId: 'unknown-map' });
  assert.equal(music.status().track, 'h_dusk');
  bus.emit('map:enter', { mapId: 'x', music: 'title', region: 'market' });
  assert.equal(music.status().track, 'title', 'payload fields win');
});

test('director: battle start/hp/end — track by kind, tense at <=25%, victory sting then back to the world', () => {
  const { audio, bus, music, timers } = rig({ hour: 13 });
  bus.emit('battle:start', { kind: 'trainer', source: 'spire' });
  assert.equal(music.status().track, 'battle_spire');
  assert.equal(audio.of('playMusic').at(-1)[2].fade, CUES.battle.fade);
  assert.equal(audio.stems.get('tense'), false);
  assert.equal(audio.stems.get('perc'), true);
  bus.emit('battle:hp', { hp: 30, maxHp: 100 });
  assert.equal(audio.stems.get('tense'), false);
  bus.emit('battle:event', { event: { type: 'damage', side: 0, target: 'x', amount: 5, hp: 25, maxHp: 100, source: 'party' } });
  assert.equal(audio.stems.get('tense'), true);
  bus.emit('battle:event', { type: 'damage', side: 1, hp: 1, maxHp: 100 });
  assert.equal(audio.stems.get('tense'), true, 'foe damage does not touch the stem');
  music.battleEvent({ type: 'heal', side: 0, hp: 90, maxHp: 100 });
  assert.equal(audio.stems.get('tense'), false);
  bus.emit('battle:end', { outcome: 'win' });
  assert.equal(music.status().track, 'victory');
  assert.equal(audio.of('playMusic').at(-1)[2].restart, true);
  timers.advance(trackLengthMs(TRACKS.victory) + DEFAULTS.STING_TAIL_MS - 1);
  assert.equal(music.status().track, 'victory');
  timers.advance(1);
  assert.equal(music.status().track, 'h_midday');
  assert.equal(audio.of('playMusic').at(-1)[2].fade, DEFAULTS.WORLD_RETURN_FADE_MS);
  bus.emit('battle:start', { kind: 'wild', hpRatio: 0.1 });
  assert.equal(audio.stems.get('tense'), true, 'starting HP feeds the stem');
  bus.emit('battle:end', { outcome: 'run' });
  assert.equal(music.status().track, 'h_midday', 'no sting for a run');
  music.battleHp(0.1);
  assert.equal(music.status().track, 'h_midday', 'HP outside a battle is ignored');
});

test('director: stings — shift reveal, anchor, letter (repeated letters restart), signal letters', () => {
  const sig = [5, 4, 3, 2, 1, 0];
  let signal = null;
  const { audio, bus, music, timers } = rig({ hour: 6, signalOf: () => signal });
  bus.emit('shift:resolved', { uid: 'c1', formId: 'x' });
  assert.equal(music.status().track, 'shift_reveal');
  timers.advance(1600 + DEFAULTS.STING_TAIL_MS);
  assert.equal(music.status().track, 'h_morning');
  bus.emit('shift:resolved', { uid: 'c1', anchored: true });
  assert.equal(music.status().track, 'shift_reveal_anchor');
  timers.advance(5000);
  bus.emit('shift:window', { uid: 'c1', level: 16 });
  assert.equal(music.status().track, 'h_morning', 'a window opening is sfx only');
  bus.emit('letter:delivered', { n: 1 });
  timers.advance(1000);
  bus.emit('letter:delivered', { n: 2 });
  const letters = audio.of('playMusic').filter((c) => c[1] === 'letter');
  assert.equal(letters.length, 2);
  assert.equal(letters[1][2].restart, true);
  timers.advance(trackLengthMs(TRACKS.letter) + DEFAULTS.STING_TAIL_MS - 1);
  assert.equal(music.status().track, 'letter', 'the timer restarted with the second letter');
  timers.advance(1);
  assert.equal(music.status().track, 'h_morning');
  signal = sig;
  bus.emit('letter:delivered', { n: 3 });
  assert.equal(music.status().track, 'letter_signal');
  assert.ok(audio.of('defineTrack').some((c) => c[1] === 'letter_signal'));
  signal = [9, 9];
  timers.advance(10000);
  bus.emit('letter:delivered', { n: 4 });
  assert.equal(music.status().track, 'letter', 'a malformed Signal falls back to the default letter');
  assert.equal(music.sting('nope'), false);
  assert.equal(music.sting('victory'), true);
  bus.emit('battle:start', { kind: 'wild' });
  assert.equal(music.status().track, 'battle_wild', 'a battle cuts a sting short');
  timers.advance(20000);
  assert.equal(music.status().track, 'battle_wild', 'and its timer is gone');
});

test('director: scene one-shot (the Relighting) then its follow-on track; leaving resets it', () => {
  const { audio, music, timers } = rig({ scenes: true, hour: 22 });
  scene(music, 'push', 'overworld');
  scene(music, 'push', 'ending');
  assert.equal(music.status().track, 'relighting');
  assert.equal(audio.of('playMusic').at(-1)[2].fade, CUES.relighting.fade);
  timers.advance(trackLengthMs(TRACKS.relighting) + DEFAULTS.STING_TAIL_MS);
  assert.equal(music.status().track, CUES.relighting.then);
  scene(music, 'pop', 'ending', 'overworld');
  assert.equal(music.status().track, 'h_night');
  assert.equal(music.status().state.oneShotDone, null);
  scene(music, 'push', 'credits');
  assert.equal(music.status().track, 'credits');
  assert.equal(audio.of('playMusic').at(-1)[2].fade, CUES.credits.fade);
});

test('director: forecast over battle and back', () => {
  const { music, bus } = rig({ scenes: true, hour: 10 });
  scene(music, 'push', 'overworld');
  bus.emit('battle:start', { kind: 'wild' });
  scene(music, 'push', 'battle');
  assert.equal(music.status().track, 'battle_wild');
  scene(music, 'push', 'forecast');
  assert.equal(music.status().track, 'forecast');
  scene(music, 'pop', 'forecast', 'battle');
  assert.equal(music.status().track, 'battle_wild');
  bus.emit('battle:end', { outcome: 'loss' });
  assert.equal(music.status().track, 'h_late_morning');
  scene(music, 'pop', 'battle', 'overworld');
  assert.equal(music.status().track, 'h_late_morning');
});

test('director: script overrides (music / stem ops via music:cue and the API)', () => {
  const { music, bus, audio } = rig({ hour: 13 });
  bus.emit('music:cue', { track: 'title', fade: 50 });
  assert.equal(music.status().track, 'title');
  assert.equal(audio.of('playMusic').at(-1)[2].fade, 50);
  bus.emit('music:cue', { stem: 'melody', on: false });
  assert.equal(audio.stems.get('melody'), false);
  bus.emit('music:cue', { stem: 'melody' });
  assert.equal(audio.stems.get('melody'), true);
  bus.emit('music:cue', { track: null });
  assert.equal(music.status().track, null);
  assert.equal(audio.of('stopMusic').length, 1);
  bus.emit('music:cue', { release: true });
  assert.equal(music.status().track, 'h_midday');
  music.play('not-a-track');
  assert.equal(music.status().track, 'h_midday');
  bus.emit('music:cue', { sting: 'victory' });
  assert.equal(music.status().track, 'victory');
  assert.doesNotThrow(() => bus.emit('music:cue', null));
  music.setStem('', true);
});

test('director: locked audio — music queued in the engine, stings dropped, unlock detected by polling', () => {
  const { audio, music, bus, timers } = rig({ ready: false, hour: 20 });
  assert.equal(music.status().locked, true);
  assert.equal(audio.pendingId(), 'h_dusk', 'the engine holds the request');
  bus.emit('letter:delivered', {});
  assert.equal(music.status().track, 'h_dusk', 'sting dropped while locked');
  assert.equal(music.history().at(-1).action, 'drop');
  bus.emit('clock:hour', { hour: 21 });
  assert.equal(audio.pendingId(), 'h_night', 'no bar-line wait while locked');
  audio.unlock();
  timers.advance(DEFAULTS.UNLOCK_POLL_MS);
  assert.equal(music.status().locked, false);
  assert.equal(music.history().at(-1).action, 'reapply');
  assert.equal(audio.current(), 'h_night');
  bus.emit('letter:delivered', {});
  assert.equal(music.status().track, 'letter');
  assert.equal(music.sting('victory', { force: true }), true);
});

test('director: unlock noticed on the next bus event or notifyUnlocked without waiting for the poll', () => {
  const { audio, music } = rig({ ready: false });
  audio.ready = true;
  music.notifyUnlocked();
  assert.equal(music.status().locked, false);
});

test('director: settings — volumes and mute at boot, on change only when different, ?mute wins', () => {
  const world = makeWorld({ volumes: { master: 0.5, music: 0.4, sfx: 0.3 }, muted: false });
  const { audio, bus } = rig({ world });
  assert.deepEqual(audio.of('setVolume')[0][1], { master: 0.5, music: 0.4, sfx: 0.3 });
  assert.deepEqual(audio.of('mute')[0], ['mute', false]);
  bus.emit('settings:changed', { changed: ['textSpeed'] });
  assert.equal(audio.of('setVolume').length, 1, 'unchanged settings are not re-sent');
  world.settings.volumes.music = 0.1;
  world.settings.muted = true;
  bus.emit('settings:changed', { changed: ['volumes', 'muted'] });
  assert.deepEqual(audio.of('setVolume').at(-1)[1], { master: 0.5, music: 0.1, sfx: 0.3 });
  assert.deepEqual(audio.of('mute').at(-1), ['mute', true]);
  const forced = rig({ world: makeWorld({ muted: false }), flags: { mute: true } });
  assert.deepEqual(forced.audio.of('mute').at(-1), ['mute', true]);
});

test('director: world:replaced re-reads the world and clears battle, sting and overrides', () => {
  const { music, bus, clock, world, timers } = rig({ hour: 10 });
  bus.emit('battle:start', { kind: 'wild' });
  music.play('credits');
  clock.hour = 22;
  world.weather.current = 'storm';
  bus.emit('world:replaced', { world });
  assert.equal(music.status().track, 'h_night');
  assert.equal(music.status().stems.rain, true);
  assert.equal(music.status().state.battle, null);
  assert.equal(music.status().state.override, null);
  timers.advance(60000);
  assert.equal(music.status().track, 'h_night');
});

test('director: never throws into the bus, even with a failing engine or junk payloads', () => {
  const { bus, music } = rig({ throwOn: ['playMusic', 'setStem', 'defineTrack', 'setVolume', 'mute'] });
  for (const evt of DIRECTOR_EVENTS) {
    for (const p of [undefined, null, 7, 'x', {}, { hour: 'a', tide: NaN, mapId: 3, outcome: {} }]) {
      assert.doesNotThrow(() => bus.emit(evt, p), evt);
    }
  }
  assert.doesNotThrow(() => music.onSceneChange({ type: 'push', scene: 42 }));
  assert.doesNotThrow(() => music.onSceneChange(undefined));
  assert.doesNotThrow(() => music.refresh());
});

test('director: tolerates a context without a bus, engine, world or clock (day-1 contract kept)', () => {
  const music = createMusicDirector({});
  assert.doesNotThrow(() => music.onSceneChange({ type: 'pop', top: null }));
  assert.doesNotThrow(() => music.sting('victory'));
  assert.doesNotThrow(() => music.destroy());
  assert.ok(Object.isFrozen(music));
  assert.doesNotThrow(() => createMusicDirector(null).destroy());
});

test('director: status reports scene and lastEvent; destroy unsubscribes and cancels timers', () => {
  const bus = createBus();
  const timers = createFakeTimers();
  const audio = createFakeAudio({ ready: false });
  const music = createMusicDirector({ bus, audio }, { timers, sfx: false });
  assert.equal(music.status().scene, null);
  assert.equal(music.status().lastEvent, null);
  music.onSceneChange({ type: 'push', scene: { name: 'menu' }, top: { name: 'menu' } });
  bus.emit('map:enter', { mapId: 'x' });
  assert.equal(music.status().scene, 'menu');
  assert.equal(music.status().lastEvent, 'map:enter');
  assert.ok(DIRECTOR_EVENTS.includes('battle:start'));
  assert.ok(timers.size() >= 1, 'unlock poll running');
  music.destroy();
  assert.equal(timers.size(), 0);
  bus.emit('battle:start', {});
  assert.equal(music.status().lastEvent, 'map:enter', 'no listener after destroy');
});

test('director: bus scene:change drives the stack only when main.js is not calling onSceneChange', () => {
  const { music, bus } = rig({ hour: 8 });
  bus.emit('scene:change', { type: 'push', scene: 'title', top: 'title' });
  assert.equal(music.status().track, 'title');
  music.onSceneChange({ type: 'replace', scene: { name: 'overworld' }, top: { name: 'overworld' } });
  bus.emit('scene:change', { type: 'push', scene: 'title', top: 'title' });
  assert.equal(music.status().track, 'h_morning', 'direct feed wins; the bus echo is ignored');
});

test('director: creates the sfx router on the same bus unless sfx:false', () => {
  const bus = createBus();
  const audio = createFakeAudio();
  const music = createMusicDirector({ bus, audio }, { timers: createFakeTimers() });
  assert.ok(music.sfx);
  bus.emit('capture:ok', {});
  assert.deepEqual(audio.of('sfx').map((c) => c[1]), ['capture']);
  music.destroy();
  bus.emit('capture:ok', {});
  assert.equal(audio.of('sfx').length, 1);
  assert.equal(rig().music.sfx, null);
});

test('director: deterministic — the same event script gives the same engine calls and history', () => {
  const script = (r) => {
    const { bus, music, audio, timers } = r;
    scene(music, 'push', 'title'); scene(music, 'replace', 'overworld');
    for (let h = 0; h < 24; h++) { audio.setStep(h % 16); bus.emit('clock:hour', { hour: h }); timers.advance(700); }
    bus.emit('tide:change', { state: 'high', tide: 0.9 }); bus.emit('weather:change', { current: 'rain' });
    bus.emit('battle:start', { kind: 'summit' }); bus.emit('battle:hp', 0.2); bus.emit('battle:end', { outcome: 'capture' });
    timers.advance(9000); bus.emit('letter:delivered', {}); timers.advance(9000);
    return { calls: audio.calls, history: music.history() };
  };
  assert.deepEqual(script(rig({ scenes: true })), script(rig({ scenes: true })));
});

test('director: the ambience slider reaches the engine\'s ambience bus, only when it changes (LG-RN102)', () => {
  const world = makeWorld({ volumes: { master: 1, music: 0.8, sfx: 1 }, muted: false });
  world.settings.ambience = 0.2;
  const { audio, bus } = rig({ world });
  assert.deepEqual(audio.of('setAmbience').at(-1), ['setAmbience', 0.2]);
  bus.emit('settings:changed', { changed: ['textSpeed'] });
  assert.equal(audio.of('setAmbience').length, 1, 'unchanged ambience is not re-sent');
  world.settings.ambience = 0;
  bus.emit('settings:changed', { changed: ['ambience'] });
  assert.deepEqual(audio.of('setAmbience').at(-1), ['setAmbience', 0]);
});
