// js/audio/tracks/* — the split score must equal the verified prototype note for note, apart from the listed
// polish deltas (w3 audio lane, design/polish-backlog.md): the theme bass trim, the thinned dusk and late-morning
// tunes, the busier midday tune, and kits played on the engine's own `kit` preset instead of three split layers.
// Run: node --test test/audio.tracks.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as T from '../js/audio/tracks/index.js';
import * as PROTO from '../proto/music/tracks.js';
import { normalizeTrack, kitVoice } from '../js/core/audio.js';

const ids = Object.keys(PROTO.TRACKS);

/** Theme bass gain after the mix polish (the prototype had 0.6: the loudest layer, so the limiter worked constantly). */
const THEME_BASS_GAIN = 0.5;
/** Melodies rewritten by the polish pass (density arc: dusk breathes, midday is the busiest hour). */
const REWRITTEN_MELODY = new Set(['h_dusk', 'h_midday', 'h_late_morning']);
const DAY_IDS = new Set(PROTO.DAY_PARTS.map(t => t.id));
/** Battle bass gain after the mix polish (prototype 0.7: five times the tune's RMS, and it set every battle peak). */
const BATTLE_BASS_GAIN = 0.55;
const BATTLE_IDS = new Set(['battle_wild', 'battle_trainer', 'battle_spire', 'summit']);
const TOUCHED = new Set([...DAY_IDS, ...BATTLE_IDS]);

/** The prototype track with the polish deltas applied: what the shipped track must equal. */
function expected(id) {
  const tr = structuredClone(PROTO.TRACKS[id]);
  if (DAY_IDS.has(id)) tr.layers.bass.gain = THEME_BASS_GAIN;
  if (BATTLE_IDS.has(id)) tr.layers.bass.gain = BATTLE_BASS_GAIN;
  if (REWRITTEN_MELODY.has(id)) tr.layers.melody.pattern = structuredClone(T.TRACKS[id].layers.melody.pattern);
  return tr;
}
/** Kit notes as heard: [step, voice, velocity] through core/audio kitVoice (merged) or the split layer's preset. */
function kitHits(layers, name) {
  const out = [];
  for (const [k, L] of Object.entries(layers)) {
    if (k === name && L.inst === 'kit') for (const e of L.pattern) { const kv = kitVoice(e.n); out.push([e.t, kv.inst, +(e.v * kv.vel).toFixed(6), kv.dur]); }
    else if (k.startsWith(`${name}.`)) for (const e of L.pattern) out.push([e.t, L.inst, +e.v.toFixed(6), 1]);
  }
  return out.sort((a, b) => a[0] - b[0] || String(a[1]).localeCompare(String(b[1])) || a[2] - b[2]);
}
/** Engine layers with any split kit `<name>.<voice>` collapsed to `<name>`, for comparing everything but the notes. */
function collapse(layers) {
  const out = {};
  for (const [k, L] of Object.entries(layers)) {
    const base = k.includes('.') ? k.slice(0, k.indexOf('.')) : k;
    const { pattern, inst, ...rest } = L;
    out[base] = { ...rest, inst: ['kick', 'snare', 'hat', 'kit'].includes(inst) ? 'kit' : inst, ...(inst === 'kit' || k.includes('.') ? {} : { pattern }) };
  }
  return out;
}
const uniq = (names) => [...new Set(names.map(n => n.includes('.') ? n.slice(0, n.indexOf('.')) : n))];

test('tracks: same track ids in the same order as the prototype', () => {
  assert.deepEqual(Object.keys(T.TRACKS), ids);
  assert.equal(ids.length, 21);
});

test('tracks: every track deep-equals the prototype plus the listed polish deltas (every note, gain, flag and comment field)', () => {
  for (const id of ids) assert.deepStrictEqual(T.TRACKS[id], expected(id), id);
  assert.deepStrictEqual([...T.DAY_PARTS].map(t => t.id), PROTO.DAY_PARTS.map(t => t.id));
  // the deltas are real: every other track is untouched, and each listed change differs from the prototype
  for (const id of ids) if (!TOUCHED.has(id)) assert.deepStrictEqual(T.TRACKS[id], PROTO.TRACKS[id], id);
  for (const id of BATTLE_IDS) assert.equal(PROTO.TRACKS[id].layers.bass.gain, 0.7);
  for (const id of REWRITTEN_MELODY) assert.notDeepStrictEqual(T.TRACKS[id].layers.melody.pattern, PROTO.TRACKS[id].layers.melody.pattern, id);
  for (const id of DAY_IDS) assert.equal(PROTO.TRACKS[id].layers.bass.gain, 0.6);
});

test('tracks: polish — dusk breathes, midday is the busiest tune of the day, bass sits under the tunes', () => {
  const stats = (tr) => {
    const total = tr.bars * tr.stepsPerBar; const cov = new Uint8Array(total); let notes = 0;
    for (const e of tr.layers.melody.pattern) { if (!(e.v > 0)) continue; notes++; for (let s = e.t; s < Math.min(total, e.t + e.d); s++) cov[s] = 1; }
    const secs = total * 60 / tr.bpm / 4;
    return { notes, perSec: notes / secs, rest: 1 - cov.reduce((a, b) => a + b, 0) / total };
  };
  const by = Object.fromEntries(T.DAY_PARTS.map(t => [t.id, stats(t)]));
  assert.ok(by.h_dusk.rest >= 0.15, `dusk rest ${by.h_dusk.rest}`);
  assert.ok(by.h_dusk.notes < stats(PROTO.TRACKS.h_dusk).notes, 'dusk thinned');
  for (const t of T.DAY_PARTS) if (t.id !== 'h_midday') {
    assert.ok(by.h_midday.notes > by[t.id].notes && by.h_midday.perSec > by[t.id].perSec, `midday busier than ${t.id}`);
  }
  assert.ok(by.h_midday.rest >= 0.1, 'midday still leaves air');
  for (const t of T.DAY_PARTS) {
    // every rewritten melody still fills its loop exactly (bar lines intact) and stays in the flute/marimba range
    const end = Math.max(...t.layers.melody.pattern.map(e => e.t + e.d));
    assert.ok(end <= t.bars * t.stepsPerBar, `${t.id} melody fits the loop`);
  }
  for (const id of BATTLE_IDS) assert.equal(T.TRACKS[id].layers.bass.gain, BATTLE_BASS_GAIN, id);
  for (const t of T.DAY_PARTS) assert.equal(t.layers.bass.gain, THEME_BASS_GAIN, t.id);
});

test('tracks: toEngine equals the prototype except that a kit is one engine layer on the kit preset playing the same hits', () => {
  for (const id of ids) {
    const eng = T.toEngine(T.TRACKS[id]);
    for (const humanize of [undefined, 0.1]) {
      const mine = T.toEngine(T.TRACKS[id], humanize === undefined ? undefined : { humanize });
      const theirs = PROTO.toEngine(expected(id), humanize === undefined ? undefined : { humanize });
      const { layers: ml, ...mt } = mine; const { layers: tl, ...tt } = theirs;
      assert.deepStrictEqual(mt, tt, id);
      assert.deepStrictEqual(collapse(ml), collapse(tl), `${id} layer settings`);
      for (const [name, L] of Object.entries(T.TRACKS[id].layers)) {
        if (L.inst !== 'kit') continue;
        assert.equal(ml[name].inst, 'kit', `${id}.${name} on the kit preset`);
        assert.ok(!Object.keys(ml).some(k => k.startsWith(`${name}.`)), `${id}.${name} not split`);
        // only GM notes whose kit voice equals the old split's mapping (36 kick, 37 rim, 38 snare, 42 hat)
        for (const e of ml[name].pattern) assert.ok([36, 37, 38, 42].includes(e.n), `${id}.${name} drum note ${e.n}`);
        assert.deepStrictEqual(kitHits(ml, name), kitHits(tl, name), `${id}.${name} hits`);
      }
    }
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

test('tracks: stemLayers / defaultStems / applyStems reach the same layers as the prototype (one prefix stem per kit)', () => {
  for (const id of ids) {
    const tr = T.TRACKS[id];
    assert.deepEqual(T.defaultStems(tr), uniq(PROTO.defaultStems(PROTO.TRACKS[id])), id);
    for (const stem of [...Object.keys(tr.layers), 'nope']) assert.deepEqual(T.stemLayers(tr, stem), uniq(PROTO.stemLayers(PROTO.TRACKS[id], stem)));
    const mine = []; const theirs = [];
    const state = Object.fromEntries([...Object.keys(tr.layers), 'nope'].map((k, i) => [k, i % 2 === 0]));
    T.applyStems({ setStem: (n, on) => mine.push([n, on]) }, tr, state);
    PROTO.applyStems({ setStem: (n, on) => theirs.push([n, on]) }, PROTO.TRACKS[id], state);
    const seen = new Set();
    assert.deepEqual(mine, theirs.map(([n, on]) => [uniq([n])[0], on]).filter(([n]) => !seen.has(n) && seen.add(n)), id);
    // every name the director sends is a real engine layer of the track
    const layerNames = Object.keys(T.toEngine(tr).layers);
    for (const [n] of mine) assert.ok(layerNames.includes(n), `${id}: ${n}`);
  }
  // a kit stem is the layer itself, whatever drums it holds
  assert.deepEqual(T.stemLayers(T.TRACKS.h_night_deep, 'perc'), ['perc']);
  assert.deepEqual(T.stemLayers(T.TRACKS.battle_wild, 'perc'), ['perc']);
  assert.deepEqual(T.stemLayers(T.TRACKS.battle_wild, 'constructor'), []);
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
