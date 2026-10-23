// js/audio/tracks/* — the split score must equal the verified prototype note for note.
// Run: node --test test/audio.tracks.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as T from '../js/audio/tracks/index.js';
import * as PROTO from '../proto/music/tracks.js';
import { normalizeTrack } from '../js/core/audio.js';

const ids = Object.keys(PROTO.TRACKS);

test('tracks: same track ids in the same order as the prototype', () => {
  assert.deepEqual(Object.keys(T.TRACKS), ids);
  assert.equal(ids.length, 21);
});

test('tracks: every track deep-equals the prototype (every note, gain, flag and comment field)', () => {
  for (const id of ids) assert.deepStrictEqual(T.TRACKS[id], PROTO.TRACKS[id], id);
  assert.deepStrictEqual([...T.DAY_PARTS], PROTO.DAY_PARTS);
});

test('tracks: toEngine output is identical to the prototype and accepted by core normalizeTrack', () => {
  for (const id of ids) {
    const eng = T.toEngine(T.TRACKS[id]);
    assert.deepStrictEqual(eng, PROTO.toEngine(PROTO.TRACKS[id]), id);
    assert.deepStrictEqual(T.toEngine(T.TRACKS[id], { humanize: 0.1 }), PROTO.toEngine(PROTO.TRACKS[id], { humanize: 0.1 }), id);
    const n = normalizeTrack(id, eng);
    assert.equal(n.loop, T.TRACKS[id].loop !== false, `${id} loop flag`);
    assert.equal(n.bars, T.TRACKS[id].bars);
  }
});

test('tracks: one file per track, each exporting TRACK with its id', async () => {
  for (const id of ids) {
    const url = new URL(`../js/audio/tracks/${id}.js`, import.meta.url);
    assert.ok(existsSync(fileURLToPath(url)), `missing ${id}.js`);
    const mod = await import(url.href);
    assert.equal(mod.TRACK.id, id);
    assert.equal(mod.TRACK, T.TRACKS[id], `${id}: index uses the file's TRACK`);
  }
});

test('tracks: every prototype export is kept', () => {
  for (const k of Object.keys(PROTO)) assert.ok(k in T, `missing export ${k}`);
  for (const k of ['TRACKS', 'CUES', 'DAY_PARTS', 'themeForHour', 'toEngine', 'stemLayers', 'defaultStems', 'applyStems', 'signalSting']) assert.ok(k in T);
  assert.deepEqual(T.SIGNAL_CHIMES, PROTO.SIGNAL_CHIMES);
  assert.equal(T.midi('F#4'), 66);
  assert.deepStrictEqual(T.P('D4:2 r:2 [D4,F#4]:4'), PROTO.P('D4:2 r:2 [D4,F#4]:4'));
  assert.deepStrictEqual(T.rep(T.P('A4:1'), 3, 4), PROTO.rep(PROTO.P('A4:1'), 3, 4));
  assert.deepStrictEqual(T.cat(T.at(4, T.P('B4:2')), T.P('C5:1')), PROTO.cat(PROTO.at(4, PROTO.P('B4:2')), PROTO.P('C5:1')));
});

test('tracks: CUES keeps the prototype keys and behaves identically over every state', () => {
  assert.deepEqual(Object.keys(T.CUES), Object.keys(PROTO.CUES));
  for (const k of ['title', 'forecast', 'victory', 'shift_reveal', 'letter', 'relighting', 'lantern_market', 'credits']) {
    assert.deepStrictEqual(T.CUES[k], PROTO.CUES[k], k);
  }
  for (let hour = 0; hour < 24; hour++) for (let weekday = 0; weekday < 7; weekday++) {
    for (const place of [undefined, 'town', 'market']) for (const tide of [undefined, 0, 0.7, 0.71, 1]) for (const weather of ['clear', 'rain', 'storm', 'fog']) {
      const s = { hour, weekday, place, tide, weather, season: 'summer' };
      assert.deepStrictEqual(T.worldCue(s), PROTO.worldCue(s));
      assert.equal(T.CUES.world.pick(s), PROTO.CUES.world.pick(s));
    }
  }
  for (const season of ['winter', 'spring', 'summer', 'autumn', 'monsoon', undefined]) assert.equal(T.CUES.world.intensity({ season }), PROTO.CUES.world.intensity({ season }));
  for (const kind of ['wild', 'trainer', 'spire', 'summit', undefined, 'x']) assert.equal(T.CUES.battle.pick({ kind }), PROTO.CUES.battle.pick({ kind }));
  for (const hpRatio of [0, 0.25, 0.2500001, 1, undefined]) assert.equal(T.CUES.battle.stems.tense({ hpRatio }), PROTO.CUES.battle.stems.tense({ hpRatio }));
  for (const id of ids) if (T.TRACKS[id].loop !== false) assert.equal(T.CUES.world.fade(id), PROTO.CUES.world.fade(id));
});

test('tracks: CUES[0..23] are non-enumerable hour keys naming the day-part theme (validate-data contract)', () => {
  for (let h = 0; h < 24; h++) {
    assert.equal(T.CUES[h], T.themeForHour(h));
    assert.ok(T.TRACKS[T.CUES[h]]);
  }
  assert.ok(!Object.keys(T.CUES).includes('0'));
  assert.ok(Object.isFrozen(T.CUES) && Object.isFrozen(T.TRACKS) && Object.isFrozen(T.DAY_PARTS));
});

test('tracks: themeForHour wraps and floors; twoBarsMs matches the prototype', () => {
  for (const h of [-1, -24.5, 0, 2.99, 3, 23, 24, 25, 47, 1e6]) assert.equal(T.themeForHour(h), PROTO.themeForHour(h), String(h));
  assert.equal(T.themeForHour(24), 'h_night_deep');
  assert.equal(T.themeForHour(-1), 'h_night');
  for (const id of ids) assert.equal(T.twoBarsMs(T.TRACKS[id]), PROTO.twoBarsMs(PROTO.TRACKS[id]));
  assert.equal(T.twoBarsMs({ bpm: 120 }), 4000);
  assert.equal(T.twoBarsMs({ bpm: 138, stepsPerBar: 12 }), Math.round(2 * 3 * 60000 / 138));
});

test('tracks: stemLayers / defaultStems / applyStems equal the prototype for every track and stem', () => {
  for (const id of ids) {
    const tr = T.TRACKS[id];
    assert.deepEqual(T.defaultStems(tr), PROTO.defaultStems(PROTO.TRACKS[id]), id);
    for (const stem of [...Object.keys(tr.layers), 'nope']) assert.deepEqual(T.stemLayers(tr, stem), PROTO.stemLayers(PROTO.TRACKS[id], stem));
    const mine = []; const theirs = [];
    const state = Object.fromEntries(Object.keys(tr.layers).map((k, i) => [k, i % 2 === 0]));
    T.applyStems({ setStem: (n, on) => mine.push([n, on]) }, tr, state);
    PROTO.applyStems({ setStem: (n, on) => theirs.push([n, on]) }, PROTO.TRACKS[id], state);
    assert.deepEqual(mine, theirs, id);
  }
  // the kit fan-out: a whisper-perc theme only has hats; a battle has the whole kit
  assert.deepEqual(T.stemLayers(T.TRACKS.h_night_deep, 'perc'), ['perc.hat']);
  assert.deepEqual(T.stemLayers(T.TRACKS.battle_wild, 'perc').sort(), ['perc.hat', 'perc.kick', 'perc.snare']);
});

test('tracks: signalSting equals the prototype, clamps junk indices, and the default is the letter melody', () => {
  for (const sig of [undefined, [0, 1, 2, 3, 4, 5], [5, 5, 5, 5, 5, 5], [-3, 9, 2.7, 0, 1, 2]]) {
    assert.deepStrictEqual(T.signalSting(sig), PROTO.signalSting(sig));
  }
  const s = T.signalSting();
  assert.equal(s.id, 'letter_signal');
  assert.deepStrictEqual(s.layers.melody.pattern, T.TRACKS.letter.layers.melody.pattern);
  assert.ok(normalizeTrack('letter_signal', T.toEngine(T.signalSting([1, 1, 1, 1, 1, 1]))));
});

test('tracks: pure and deterministic — building twice gives identical data; no DOM needed', async () => {
  const again = await import(`../js/audio/tracks/index.js?again=${Date.now()}`);
  for (const id of ids) assert.deepStrictEqual(again.TRACKS[id], T.TRACKS[id]);
  assert.equal(typeof globalThis.document, 'undefined');
});
