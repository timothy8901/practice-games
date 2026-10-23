// Adversarial tests for js/core/audio.js: malformed inputs, prototype keys, boundaries, determinism,
// large inputs, unicode, rapid repeated calls and every engine call before unlock (Node has no WebAudio,
// so the engine must degrade without throwing). Browser-side behaviour is covered by
// test/pages/audio.html and test/pages/audio-adversarial.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAudio, SCALES, SCALE_ALIASES, CHORDS, resolveScale, scaleIntervals, scaleNotes, degreeToMidi, quantizeToScale, chord,
  num, noteToMidi, midiToNote, keyToMidi, freqToMidi, hashString, makeLcg, resolveNotes, expandPattern, parseStepString,
  bucketEvents, createStepClock, createRateLimiter, analyzeBuffer, inferInstrument, isDefaultStemName, kitVoice, resolveStem,
  normalizeTrack, sfxDuration, INSTRUMENT_NAMES, SFX_NAMES, DEMO_TRACK_ID, DEMO_TRACK, softClipCurve, intensityToCutoff,
  swingOffset, stepSeconds, fadeCurve, volumeToGain, dbToGain, gainToDb,
} from '../js/core/audio.js';

const PROTO_KEYS = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', '__defineGetter__'];

test('prototype keys are never treated as valid names', async () => {
  for (const k of PROTO_KEYS) {
    assert.equal(sfxDuration(k), null, `sfxDuration(${k})`);
    assert.equal(resolveScale(k), null, `resolveScale(${k})`);
    assert.equal(inferInstrument(k), 'pluck', `inferInstrument(${k})`);
    assert.throws(() => chord(60, k), RangeError, `chord(${k})`);
    assert.throws(() => scaleNotes(60, k), RangeError, `scaleNotes(${k})`);
    assert.throws(() => degreeToMidi(0, 60, k), RangeError, `degreeToMidi(${k})`);
    assert.throws(() => quantizeToScale(61, 60, k), RangeError, `quantizeToScale(${k})`);
    assert.throws(() => normalizeTrack('x', { bpm: 100, scale: k, layers: {} }), RangeError, `scale ${k}`);
    assert.throws(() => normalizeTrack('x', { bpm: 100, layers: { a: { inst: k, pattern: [] } } }), RangeError, `inst ${k}`);
  }
  const a = createAudio();
  for (const k of PROTO_KEYS) assert.equal(a.sfx(k), null, `sfx(${k})`);
  await assert.rejects(() => a.renderSfx('constructor'), RangeError);
  // A layer may legitimately be *named* after a prototype key.
  const t = a.defineTrack('p', { bpm: 100, layers: { constructor: 'x...', __proto__: null } });
  assert.equal(t.layers[0].name, 'constructor');
  assert.equal(t.layers[0].inst, 'pluck');
  assert.equal(resolveStem('constructor', {}, true), true);
  assert.equal(resolveStem('x', { __proto__: { x: false } }, true), true, 'inherited override keys are ignored');
});

test('num() coerces leniently and falls back on junk', () => {
  assert.equal(num(undefined, 3), 3);
  assert.equal(num(null, 3), 3);
  assert.equal(num('', 3), 3);
  assert.equal(num('   ', 3), 3);
  assert.equal(num(NaN, 3), 3);
  assert.equal(num(Infinity, 3), 3);
  assert.equal(num(-Infinity, 3), 3);
  assert.equal(num({}, 3), 3);
  assert.equal(num('abc', 3), 3);
  assert.equal(num('0.5', 3), 0.5);
  assert.equal(num(' 7 ', 0), 7);
  assert.equal(num('1e3', 0), 1000);
  assert.equal(num(true, 3), 1);
  assert.equal(num(false, 3), 0);
  assert.equal(num(0, 3), 0);
  assert.equal(num([2], 3), 2);
});

test('scale aliases resolve to canonical scales everywhere', () => {
  assert.equal(resolveScale('majorPentatonic'), 'pentatonic');
  assert.equal(resolveScale('major-pentatonic'), 'pentatonic');
  assert.equal(resolveScale('minor-pentatonic'), 'minorPentatonic');
  assert.equal(resolveScale('ionian'), 'major');
  assert.equal(resolveScale('aeolian'), 'minor');
  assert.equal(resolveScale('minor'), 'minor');
  assert.equal(resolveScale('nope'), null);
  assert.equal(resolveScale(null), null);
  assert.equal(resolveScale(5), null);
  assert.equal(resolveScale(''), null);
  for (const v of Object.values(SCALE_ALIASES)) assert.ok(Object.hasOwn(SCALES, v), `alias target ${v}`);
  assert.deepEqual(scaleNotes(60, 'majorPentatonic'), [60, 62, 64, 67, 69]);
  assert.deepEqual(scaleIntervals('aeolian'), SCALES.minor);
  assert.equal(degreeToMidi(5, 60, 'majorPentatonic'), 72);
  assert.equal(quantizeToScale(61, 60, 'ionian'), 60);
  assert.equal(normalizeTrack('t', { bpm: 100, scale: 'majorPentatonic', layers: {} }).scale, 'pentatonic');
  assert.equal(normalizeTrack('t', { bpm: 100, layers: {} }).scale, 'major');
  assert.deepEqual(scaleNotes(60, 'major', { octaves: 0 }), []);
  assert.equal(scaleNotes(60, 'major', { octaves: 'x' }).length, 7);
  assert.equal(scaleNotes(0, 'chromatic', { octaves: 1e9 }).length, 12 * 64, 'octaves are capped');
  assert.ok(Object.isFrozen(SCALE_ALIASES));
});

test('parseStepString understands drum letters, accents, separators and unicode rests', () => {
  const ev = parseStepString('k.h.s.h.|K.H.S.H.');
  assert.deepEqual(ev.map((e) => e.t), [0, 2, 4, 6, 8, 10, 12, 14]);
  assert.deepEqual(ev.map((e) => e.n), [36, 42, 38, 42, 36, 42, 38, 42]);
  assert.deepEqual(ev.map((e) => e.v), [0.8, 0.8, 0.8, 0.8, 1, 1, 1, 1]);
  const mixed = parseStepString('x-k_s', { note: 70, vel: 0.5 });
  assert.deepEqual(mixed, [{ t: 0, n: 70, d: 1, v: 0.5 }, { t: 2, n: 36, d: 1, v: 0.5 }, { t: 4, n: 38, d: 1, v: 0.5 }]);
  assert.deepEqual(parseStepString('x\r\nx').map((e) => e.t), [0, 1], 'CRLF is ignored');
  assert.deepEqual(parseStepString('x♪x').map((e) => e.t), [0, 2], 'unknown glyphs are rests');
  assert.deepEqual(parseStepString(''), []);
  assert.deepEqual(parseStepString('   |  '), []);
  assert.throws(() => parseStepString(null), TypeError);
  assert.throws(() => parseStepString(['x']), TypeError);
});

test('kitVoice maps GM drum notes to kick/snare/hat with sane multipliers', () => {
  const inst = (n) => kitVoice(n).inst;
  for (const n of [0, 24, 35, 36]) assert.equal(inst(n), 'kick', `${n}`);
  assert.deepEqual(kitVoice(37), { inst: 'snare', vel: 0.6, dur: 1 });
  for (const n of [38, 39, 40]) assert.deepEqual(kitVoice(n), { inst: 'snare', vel: 1, dur: 1 });
  for (const n of [42, 44]) assert.deepEqual(kitVoice(n), { inst: 'hat', vel: 1, dur: 1 });
  for (const n of [41, 43, 45, 47, 48, 50]) assert.deepEqual(kitVoice(n), { inst: 'kick', vel: 0.9, dur: 1 });
  for (const n of [46, 49, 51, 57, 100, 127]) assert.deepEqual(kitVoice(n), { inst: 'hat', vel: 0.9, dur: 3 });
  assert.equal(inst(NaN), 'kick', 'junk defaults to the kick (note 36)');
  assert.equal(inst(undefined), 'kick');
  assert.equal(inst('38'), 'snare');
  assert.equal(inst(36.4), 'kick');
  assert.equal(inst(36.6), 'snare', 'fractional notes round');
  for (let n = -10; n <= 140; n++) {
    const v = kitVoice(n);
    assert.ok(['kick', 'snare', 'hat'].includes(v.inst) && v.vel > 0 && v.vel <= 1 && v.dur >= 1, `${n}`);
  }
});

test('instrument inference handles aliases, dotted names and case', () => {
  assert.equal(inferInstrument('perc'), 'kit');
  assert.equal(inferInstrument('drums'), 'kit');
  assert.equal(inferInstrument('kit'), 'kit');
  assert.equal(inferInstrument('perc.kick'), 'kick');
  assert.equal(inferInstrument('perc.hat'), 'hat');
  assert.equal(inferInstrument('PERC.SNARE'), 'snare');
  assert.equal(inferInstrument('melody.b'), 'pluck');
  assert.equal(inferInstrument('keys'), 'rhodes');
  assert.equal(inferInstrument('horns'), 'brass');
  assert.equal(inferInstrument('Night'), 'glass');
  assert.equal(inferInstrument('a.b.c'), 'pluck');
  assert.equal(inferInstrument('.'), 'pluck');
  assert.equal(inferInstrument(''), 'pluck');
  assert.equal(inferInstrument(undefined), 'pluck');
  assert.equal(inferInstrument(42), 'pluck');
  for (const name of INSTRUMENT_NAMES) assert.equal(inferInstrument(name.toUpperCase()), name);
  assert.deepEqual([...new Set(INSTRUMENT_NAMES)], [...INSTRUMENT_NAMES], 'no duplicate presets');
  for (const n of ['kit', 'rhodes', 'brass']) assert.ok(INSTRUMENT_NAMES.includes(n), n);
});

test('layers named after the contract stems start muted unless told otherwise', () => {
  for (const n of ['night', 'tide', 'rain', 'battle', 'tense', 'storm', 'night.bells', 'Rain', 'TIDE.low']) assert.equal(isDefaultStemName(n), true, n);
  for (const n of ['nightly', 'melody', 'bass', 'perc', 'raindrop', '', 'x.night']) assert.equal(isDefaultStemName(n), false, n);
  const t = normalizeTrack('s', {
    bpm: 100,
    layers: {
      night: [{ t: 0, n: 60 }],
      melody: [{ t: 0, n: 60 }],
      rain: 'x...',
      battle: { pattern: 'x...', stem: false },
      bass: { pattern: 'x...', stem: true },
      tide: { pattern: 'x...', stem: 0 },
    },
  });
  const by = Object.fromEntries(t.layers.map((l) => [l.name, l]));
  assert.equal(by.night.stem, true);
  assert.equal(by.melody.stem, false);
  assert.equal(by.rain.stem, true);
  assert.equal(by.rain.inst, 'glass');
  assert.equal(by.battle.stem, false, 'explicit stem:false wins over the name');
  assert.equal(by.bass.stem, true);
  assert.equal(by.tide.stem, false);
});

test('one-shot flag, kit layers and the new presets normalize', () => {
  assert.equal(normalizeTrack('a', { bpm: 100, layers: {} }).loop, true);
  assert.equal(normalizeTrack('a', { bpm: 100, loop: false, layers: {} }).loop, false);
  assert.equal(normalizeTrack('a', { bpm: 100, loop: 0, layers: {} }).loop, false);
  assert.equal(normalizeTrack('a', { bpm: 100, loop: 'yes', layers: {} }).loop, true);
  const k = normalizeTrack('k', { bpm: 120, bars: 1, layers: { perc: 'k.h.s.h.k.h.s.h.', drums: { inst: 'kit', pattern: [{ t: 0 }] } } });
  assert.equal(k.layers[0].inst, 'kit');
  assert.deepEqual(k.layers[0].events.map((e) => e.n[0]), [36, 42, 38, 42, 36, 42, 38, 42]);
  assert.deepEqual(k.layers[1].events[0].n, [36], 'kit default note is the kick');
  const r = normalizeTrack('r', { bpm: 100, layers: { keys: [{ t: 0, n: 'C4' }], horns: { inst: 'brass', pattern: [{ t: 0, n: 'C3' }] } } });
  assert.equal(r.layers[0].inst, 'rhodes');
  assert.equal(r.layers[1].inst, 'brass');
  assert.ok(Object.isFrozen(DEMO_TRACK));
  assert.equal(normalizeTrack(DEMO_TRACK_ID, DEMO_TRACK).loop, true);
});

test('resolveStem: exact override, then longest dotted prefix, then the default', () => {
  const m = (entries) => new Map(entries);
  assert.equal(resolveStem('perc.kick', m([['perc', false]]), true), false);
  assert.equal(resolveStem('perc.kick', m([['perc', false], ['perc.kick', true]]), true), true, 'exact wins');
  assert.equal(resolveStem('a.b.c', m([['a', false], ['a.b', true]]), false), true, 'longest prefix wins');
  assert.equal(resolveStem('a.b.c', m([['a', true]]), false), true);
  assert.equal(resolveStem('a.b.c', m([['b', false]]), true), true, 'middle segments are not prefixes');
  assert.equal(resolveStem('percussion', m([['perc', false]]), true), true, 'prefix must end at a dot');
  assert.equal(resolveStem('night', m([]), false), false);
  assert.equal(resolveStem('night', null, true), true);
  assert.equal(resolveStem('night', undefined, false), false);
  assert.equal(resolveStem('.a', m([['', false]]), true), true, 'empty prefix is ignored');
  assert.equal(resolveStem('perc.hat', { perc: false }, true), false, 'plain objects work');
  assert.equal(resolveStem('n', m([['n', 1]]), false), true, 'truthy values coerce');
  assert.equal(resolveStem('n', { n: 0 }, true), false);
  assert.equal(resolveStem(42, m([['42', false]]), true), false, 'names are stringified');
});

test('every engine call is safe before unlock and with junk arguments (no WebAudio in Node)', async () => {
  const a = createAudio();
  assert.equal(typeof globalThis.AudioContext, 'undefined');
  // sfx
  for (const bad of [null, 5, 'x', [], true, { pitch: 'x', volume: 'loud', pan: 'left', delay: -1, semitones: NaN }]) {
    assert.equal(a.sfx('coin', bad), null);
  }
  for (const name of [null, undefined, {}, 5, '', 'kazoo', 'coin\u0000', '🎵']) assert.equal(a.sfx(name), null);
  // volume
  assert.deepEqual(a.setVolume(null), { master: 1, music: 0.8, sfx: 1 });
  assert.deepEqual(a.setVolume('x'), { master: 1, music: 0.8, sfx: 1 });
  assert.deepEqual(a.setVolume([]), { master: 1, music: 0.8, sfx: 1 });
  assert.equal(a.setVolume(0.5).master, 0.5, 'a bare number sets master');
  assert.equal(a.setVolume({ master: '0.25' }).master, 0.25);
  assert.equal(a.setVolume({ master: Infinity }).master, 0.25);
  assert.equal(a.setVolume({ master: null, music: '', sfx: NaN }).master, 0.25, 'null/blank/NaN leave values alone');
  assert.deepEqual(a.setVolume({ master: 1, music: 0.8, sfx: 1 }), { master: 1, music: 0.8, sfx: 1 });
  // mute
  assert.equal(a.mute(), true);
  assert.equal(a.mute(null), false);
  assert.equal(a.mute(''), false);
  assert.equal(a.mute('yes'), true);
  a.mute(false);
  // music
  assert.equal(a.playMusic(DEMO_TRACK_ID, null), true);
  assert.deepEqual(a.nowPlaying(), { id: DEMO_TRACK_ID, pending: true });
  assert.equal(a.playMusic('missing', null), false);
  assert.equal(a.playMusic(undefined), false);
  assert.equal(a.stopMusic(null), false);
  assert.equal(a.nowPlaying(), null, 'stopMusic clears a pending request');
  assert.equal(a.playMusic(DEMO_TRACK_ID, { fade: NaN, restart: 'yes' }), true);
  assert.equal(a.stopMusic('x'), false);
  // params
  assert.deepEqual(a.setMusicParam(null), { intensity: 1 });
  assert.deepEqual(a.setMusicParam('x'), { intensity: 1 });
  assert.deepEqual(a.setMusicParam({ intensity: '0.5' }), { intensity: 0.5 });
  assert.deepEqual(a.setMusicParam({ intensity: null }), { intensity: 0.5 }, 'null means unchanged');
  assert.deepEqual(a.setMusicParam({ intensity: '' }), { intensity: 0.5 });
  assert.deepEqual(a.setMusicParam({ intensity: -1 }), { intensity: 0 });
  assert.deepEqual(a.setMusicParam({ intensity: true }), { intensity: 1 });
  // stems
  assert.deepEqual(a.setStem(null, true), []);
  assert.deepEqual(a.setStem(undefined, true), []);
  assert.deepEqual(a.setStem('', true), []);
  assert.deepEqual(a.setStem('   ', true), []);
  assert.deepEqual(a.setStem(42, true), ['42']);
  assert.deepEqual(a.setStem(' night ', true), ['42', 'night'], 'names are trimmed, order kept');
  assert.deepEqual(a.setStem('night', 0), ['42']);
  assert.deepEqual(a.setStem('42', false), []);
  assert.deepEqual(a.setStem('perc', false), [], 'forced-off stems are not listed');
  assert.deepEqual(a.getStems(), []);
  // misc
  assert.equal(a.hasTrack(undefined), false);
  assert.equal(a.ready, false);
  assert.equal(a.state, 'closed');
  assert.equal(a.analyser, null);
  assert.equal(a.context, null);
  assert.equal(await a.unlock(), false);
  assert.equal(await a.unlock(), false);
  await assert.rejects(() => a.renderTrack(DEMO_TRACK_ID, { bars: NaN }), /OfflineAudioContext/);
  await assert.rejects(() => a.renderTrack(DEMO_TRACK_ID, null), /OfflineAudioContext/);
  await assert.rejects(() => a.renderSfx('coin', null), /OfflineAudioContext/);
  await assert.rejects(() => a.renderSfx(null), RangeError);
  await assert.rejects(() => a.renderTrack('nope', null), RangeError);
  await a.dispose();
  await a.dispose();
  assert.equal(a.sfx('coin'), null);
  assert.equal(a.playMusic(DEMO_TRACK_ID), true, 'requests are remembered after dispose too');
  assert.deepEqual(a.nowPlaying(), { id: DEMO_TRACK_ID, pending: true });
});

test('unicode ids, note names and sfx names', () => {
  const a = createAudio();
  const id = 'ночь-🌙';
  const t = a.defineTrack(id, { bpm: 90, layers: { 'мелодия.🎵': [{ t: 0, n: 'F♯4' }, { t: 2, n: 'B♭3' }] } });
  assert.ok(a.hasTrack(id));
  assert.ok(a.trackIds().includes(id));
  assert.equal(t.layers[0].name, 'мелодия.🎵');
  assert.deepEqual(t.layers[0].events.map((e) => e.n[0]), [66, 58]);
  assert.equal(a.playMusic(id), true);
  assert.deepEqual(a.setStem('мелодия', false), []);
  assert.equal(resolveStem('мелодия.🎵', new Map([['мелодия', false]]), true), false);
  assert.equal(noteToMidi('F♯4'), 66);
  assert.equal(noteToMidi('B♭3'), 58);
  assert.equal(noteToMidi(' c4 '), 60);
  assert.equal(noteToMidi('Cb4'), 59);
  assert.equal(noteToMidi('E#4'), 65);
  assert.equal(noteToMidi('c#-1'), 1);
  assert.equal(noteToMidi('C10'), 132);
  assert.equal(noteToMidi('C100'), null);
  assert.equal(noteToMidi('C♯♯4'), null);
  assert.equal(noteToMidi('Ｃ4'), null, 'full-width letters are not notes');
  assert.equal(midiToNote(-1), 'B-2');
  assert.equal(midiToNote(127), 'G9');
  assert.equal(midiToNote(60.5), 'C#4');
  for (const bad of [NaN, Infinity, undefined, null, '60', {}]) assert.throws(() => midiToNote(bad), RangeError, `midiToNote(${String(bad)})`);
  assert.equal(keyToMidi('f#'), 54);
  assert.equal(keyToMidi(' D '), 50);
  assert.equal(keyToMidi('D', 'x'), null);
  assert.equal(a.sfx('🎵'), null);
  assert.equal(sfxDuration('🎵'), null);
  assert.equal(typeof hashString('♯♭🎵'), 'number');
  assert.equal(hashString('♯♭🎵'), hashString('♯♭🎵'));
  assert.equal(hashString(''), 0x811c9dc5);
  assert.notEqual(hashString('a'), hashString('b'));
});

test('determinism: normalization, hashing and the LCG are stable', () => {
  const strip = (t) => JSON.stringify({ ...t, layers: t.layers.map((l) => ({ ...l, buckets: [...l.buckets.entries()] })) });
  assert.equal(strip(normalizeTrack(DEMO_TRACK_ID, DEMO_TRACK)), strip(normalizeTrack(DEMO_TRACK_ID, DEMO_TRACK)));
  const seqOf = (seed, n = 5) => { const r = makeLcg(seed); return Array.from({ length: n }, () => r()); };
  assert.deepEqual(seqOf(0), seqOf(0));
  assert.deepEqual(seqOf(NaN), seqOf(0), 'junk seeds fall back to the default seed');
  assert.deepEqual(seqOf(1.9), seqOf(1));
  assert.deepEqual(seqOf(-1), seqOf(0xffffffff));
  assert.notDeepEqual(seqOf(1), seqOf(2));
  const r = makeLcg(7);
  for (let i = 0; i < 10000; i++) { const v = r(); assert.ok(v >= 0 && v < 1); }
  const a = createAudio();
  const b = createAudio();
  assert.deepEqual(a.trackIds(), b.trackIds());
  assert.equal(strip(a.defineTrack('x', { bpm: 100, layers: { kick: 'x...' } })), strip(b.defineTrack('x', { bpm: 100, layers: { kick: 'x...' } })));
});

test('expandPattern boundaries and numeric-string notes', () => {
  const ev = expandPattern([
    { t: 15.999999, n: 60 }, { t: 16, n: 60 }, { t: '4', n: '60' }, { t: Infinity, n: 60 }, { t: 1, n: 60, v: 0 },
    { t: 2, n: 60, v: -1 }, { t: 3, n: 60, v: '0.5' }, { t: 5, n: 60, v: Infinity }, { t: 6, n: 60, d: Infinity },
    { t: 7, n: 60, d: 0.001 }, { t: 8, n: [] }, { t: 9, n: ['bad'] }, { t: 10, n: [60, 'bad', '62'] }, { t: 11, n: 60.5 },
    { t: 12, n: ' ' }, 'junk', 7, [], { t: 13 },
  ], { loopSteps: 16, defaultNote: 40 });
  assert.deepEqual(ev.map((e) => e.t), [1, 2, 3, 4, 5, 6, 7, 10, 11, 13, 15.999999]);
  const by = Object.fromEntries(ev.map((e) => [e.t, e]));
  assert.equal(by[1].v, 0, 'zero velocity is kept');
  assert.equal(by[2].v, 0);
  assert.equal(by[3].v, 0.5);
  assert.deepEqual(by[4].n, [60], 'numeric strings are notes');
  assert.equal(by[5].v, 0.8, 'infinite velocity falls back');
  assert.equal(by[6].d, 1, 'infinite duration falls back');
  assert.equal(by[7].d, 0.001);
  assert.deepEqual(by[10].n, [60, 62]);
  assert.deepEqual(by[11].n, [60.5]);
  assert.deepEqual(by[13].n, [40]);
  const long = expandPattern([{ t: 0, n: 60, d: 1e9 }, { t: 1, n: 60, d: 16 }, { t: 2, n: 60, d: 15.5 }], { loopSteps: 16 });
  assert.deepEqual(long.map((e) => e.d), [16, 16, 15.5], 'durations are capped at one loop');
  assert.deepEqual(resolveNotes('60'), [60]);
  assert.deepEqual(resolveNotes(['1e2', ' ', '']), [100]);
  assert.deepEqual(resolveNotes(Infinity), []);
  assert.deepEqual(expandPattern([{ t: 0.25, n: 1 }, { t: 0.5, n: 1 }], { loopSteps: 0.5 }).map((e) => e.t), [0.25]);
  assert.throws(() => expandPattern([], { loopSteps: NaN }), RangeError);
  assert.throws(() => expandPattern([], {}), RangeError);
  assert.throws(() => expandPattern(null, { loopSteps: 4 }), TypeError);
  assert.deepEqual([...bucketEvents(expandPattern([{ t: 2.999, n: 1 }], { loopSteps: 4 })).keys()], [2]);
  assert.equal(bucketEvents([]).size, 0);
});

test('normalizeTrack boundaries and malformed definitions', () => {
  const ok = (def) => normalizeTrack('t', { layers: {}, ...def });
  assert.equal(ok({ bpm: 20 }).bpm, 20);
  assert.equal(ok({ bpm: 300 }).bpm, 300);
  assert.equal(ok({ bpm: '120' }).bpm, 120);
  for (const bpm of [19.999, 300.001, 0, -100, NaN, Infinity, null, 'fast', undefined]) assert.throws(() => ok({ bpm }), RangeError, `bpm ${bpm}`);
  assert.equal(ok({ bpm: 100, bars: 1 }).loopSteps, 16);
  assert.equal(ok({ bpm: 100, bars: '2' }).loopSteps, 32);
  for (const bars of [0, 1.5, -1, NaN, 'x']) assert.throws(() => ok({ bpm: 100, bars }), RangeError, `bars ${bars}`);
  const tiny = ok({ bpm: 100, bars: 3, stepsPerBar: 1, beatsPerBar: 1 });
  assert.equal(tiny.loopSteps, 3);
  assert.equal(tiny.stepsPerBeat, 1);
  const waltz = ok({ bpm: 100, stepsPerBar: 12, beatsPerBar: 3 });
  assert.equal(waltz.stepsPerBeat, 4);
  assert.throws(() => ok({ bpm: 100, stepsPerBar: 12, beatsPerBar: 5 }), RangeError);
  assert.throws(() => ok({ bpm: 100, stepsPerBar: 0 }), RangeError);
  assert.throws(() => ok({ bpm: 100, beatsPerBar: 2.5 }), RangeError);
  assert.equal(ok({ bpm: 100, swing: 2 }).swing, 1);
  assert.equal(ok({ bpm: 100, swing: -1 }).swing, 0);
  assert.equal(ok({ bpm: 100, swing: 'x' }).swing, 0);
  assert.equal(ok({ bpm: 100, key: 'd' }).root, 50);
  assert.equal(ok({ bpm: 100, key: 'D4' }).root, 62);
  assert.equal(ok({ bpm: 100, key: 'bb' }).root, 58, 'a bare key sits in octave 3 like D -> D3 (Bb3 = 58)');
  for (const key of ['', 'H', 'D#b', 5, null]) assert.throws(() => ok({ bpm: 100, key }), RangeError, `key ${key}`);
  const layer = (spec) => normalizeTrack('t', { bpm: 100, layers: { a: spec } }).layers[0];
  assert.equal(layer({ pattern: [], gain: -1 }).gain, 0);
  assert.equal(layer({ pattern: [], gain: 'x' }).gain, 1);
  assert.equal(layer({ pattern: [], gain: 99 }).gain, 2);
  assert.equal(layer({ pattern: [], pan: 'x' }).pan, 0);
  assert.equal(layer({ pattern: [], pan: 5 }).pan, 1);
  assert.equal(layer({ pattern: [], humanize: 'x' }).humanize, 0.5);
  assert.equal(layer({ pattern: [], humanize: -4 }).humanize, 0);
  assert.equal(layer({ pattern: [], minIntensity: 2 }).minIntensity, 1);
  assert.equal(layer({ pattern: [], minIntensity: null }).minIntensity, 0);
  for (const spec of [null, 5, {}, { inst: 'kit' }, { pattern: 5 }, { pattern: {} }, true]) {
    assert.throws(() => layer(spec), TypeError, `layer ${JSON.stringify(spec)}`);
  }
  assert.throws(() => layer({ pattern: [], inst: 'kazoo' }), RangeError);
  for (const id of [5, '', null, undefined, {}]) assert.throws(() => normalizeTrack(id, { bpm: 100, layers: {} }), TypeError);
  for (const def of [null, 'str', 5, undefined]) assert.throws(() => normalizeTrack('x', def), TypeError);
  assert.throws(() => normalizeTrack('x', []), RangeError);
  assert.throws(() => normalizeTrack('x', { bpm: 100, layers: null }), TypeError);
  assert.throws(() => normalizeTrack('x', { bpm: 100, layers: 'kick' }), TypeError);
  assert.equal(normalizeTrack('x', { bpm: 100, layers: {} }).layers.length, 0, 'an empty track is allowed');
});

test('step clock, rate limiter and timing helpers at the edges', () => {
  assert.throws(() => stepSeconds(Infinity), RangeError, 'infinite bpm would make a zero-length step');
  assert.throws(() => stepSeconds(120, Infinity), RangeError);
  assert.throws(() => stepSeconds(NaN), RangeError);
  assert.throws(() => stepSeconds(-1), RangeError);
  assert.throws(() => stepSeconds('x'), RangeError);
  assert.equal(stepSeconds('120'), 0.125);
  assert.throws(() => createStepClock({ bpm: Infinity, loopSteps: 4 }), RangeError);
  assert.throws(() => createStepClock({ bpm: 120, loopSteps: 0 }), RangeError);
  assert.throws(() => createStepClock({ bpm: 120, loopSteps: NaN }), RangeError);
  const c = createStepClock({ bpm: 120, loopSteps: 1, stepsPerBar: 1, stepsPerBeat: 1, startTime: 0, maxCatchUpSteps: Infinity });
  assert.deepEqual(c.advance(NaN), []);
  assert.deepEqual(c.advance(Infinity), [], 'a non-finite horizon never loops forever');
  assert.deepEqual(c.advance(-1), []);
  assert.deepEqual(c.advance(0.5).map((t) => t.abs), [0], 'horizon exactly at the next step is exclusive');
  assert.deepEqual(c.advance(0.5000001).map((t) => t.abs), [1]);
  assert.deepEqual(c.advance(2).map((t) => t.abs), [2, 3]);
  assert.equal(c.nextStep(), 4);
  assert.deepEqual(c.positionAt(-5), { abs: 0, step: 0, bar: 0, beat: 0, loop: 0, phase: 0 });
  assert.equal(c.nextBarTime(0.5), 0.5);
  assert.equal(c.nextBarTime(0.5000001), 1);
  const stall = createStepClock({ bpm: 300, loopSteps: 1e6, stepsPerBar: 16, startTime: 0, maxCatchUpSteps: 8 });
  stall.advance(0.1);
  const burst = stall.advance(1e6);
  assert.ok(burst.length > 0 && burst.length <= 9, `catch-up burst ${burst.length}`);
  assert.ok(Number.isFinite(stall.positionAt(1e9).abs));
  const rl = createRateLimiter({ minInterval: 0.02, maxBurst: 5, window: 0.1 });
  let allowed = 0;
  for (let i = 0; i < 10000; i++) if (rl.allow('same', 1)) allowed++;
  assert.equal(allowed, 1, 'the same key at the same instant is allowed once');
  rl.reset();
  allowed = 0;
  for (let i = 0; i < 10000; i++) if (rl.allow(`k${i}`, 1)) allowed++;
  assert.equal(allowed, 5, 'distinct keys hit the burst cap');
  rl.reset();
  assert.equal(rl.allow('a', 1), true);
  assert.equal(rl.allow('a', 0.5), true, 'a clock that went backwards does not wedge the key');
  assert.equal(rl.allow(undefined, 2), true);
  assert.equal(swingOffset(1, -1, 0.3), 0);
  assert.equal(swingOffset(1, NaN, 0.3), 0);
  assert.ok(Math.abs(swingOffset(1, 5, 0.3) - 0.1) < 1e-9, 'swing is clamped to 1');
  assert.equal(swingOffset(-1, 1, 0.3), 0, 'negative steps are not odd');
});

test('large inputs stay fast and well-formed', () => {
  const N = 50000;
  const big = Array.from({ length: N }, (_, i) => ({ t: ((i * 7919) % 4096) + (i % 2) * 0.5, n: 48 + (i % 24), d: 1 + (i % 3), v: 0.3 + (i % 7) / 10 }));
  const t0 = performance.now();
  const ev = expandPattern(big, { loopSteps: 4096 });
  assert.equal(ev.length, N);
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i - 1].t <= ev[i].t);
  const buckets = bucketEvents(ev);
  assert.ok(buckets.size <= 4096);
  const track = normalizeTrack('big', { bpm: 60, bars: 4096, layers: { melody: big, kick: 'x...'.repeat(20000) } });
  assert.equal(track.loopSteps, 65536);
  assert.equal(track.layers[0].events.length, N);
  assert.equal(track.layers[1].events.length, 16384, 'hits past the loop end are dropped');
  assert.ok(performance.now() - t0 < 5000, 'under five seconds for 50k events');
  assert.equal(parseStepString('x'.repeat(100000)).length, 100000);
  assert.equal(fadeCurve(1e6, 'in').length, 1e6);
  assert.ok(Math.abs(fadeCurve(1e6, 'in')[1e6 - 1] - 1) < 1e-6);
  const r = analyzeBuffer([new Float32Array(1 << 20).fill(0.5)]);
  assert.equal(r.peak, 0.5);
  assert.ok(Math.abs(r.rms - 0.5) < 1e-6);
  const clip = softClipCurve(1 << 16);
  for (let i = 1; i < clip.length; i++) assert.ok(clip[i] >= clip[i - 1] && Math.abs(clip[i]) < 0.906);
  const c5 = chord(60, 'maj9', { inversion: 1e9 });
  assert.equal(c5.length, 5);
  assert.deepEqual(chord(60, 'maj', { inversion: -5 }), [60, 64, 67]);
  assert.deepEqual(chord(60, 'maj', { inversion: NaN, octave: 'x' }), [60, 64, 67]);
  assert.equal(Object.keys(CHORDS).length >= 14, true);
  const a = createAudio();
  for (let i = 0; i < 2000; i++) a.defineTrack(`t${i}`, { bpm: 100, bars: 1, layers: {} });
  assert.equal(a.trackIds().length, 2001);
});

test('rapid repeated calls before unlock do not accumulate state or throw', async () => {
  const a = createAudio();
  for (let i = 0; i < 20000; i++) a.setStem(i % 2 ? 'night' : 'tide', i % 3 === 0);
  assert.ok(a.getStems().length <= 2);
  for (let i = 0; i < 10000; i++) {
    a.setMusicParam({ intensity: (i % 100) / 100 });
    a.setVolume({ master: (i % 10) / 10 });
    a.mute(i % 2 === 0);
    assert.equal(a.playMusic(DEMO_TRACK_ID, { fade: i }), true);
    if (i % 2) a.stopMusic({ fade: i });
  }
  assert.equal(a.nowPlaying(), null);
  assert.deepEqual(a.setMusicParam({}), { intensity: 0.99 });
  const ps = Array.from({ length: 100 }, () => a.unlock());
  assert.equal(ps[0], ps[1], 'concurrent unlocks share one attempt');
  assert.ok((await Promise.all(ps)).every((v) => v === false));
  assert.equal(a.ready, false);
  for (let i = 0; i < 1000; i++) assert.equal(a.sfx(SFX_NAMES[i % SFX_NAMES.length]), null);
  await Promise.all(Array.from({ length: 20 }, () => a.dispose()));
  assert.equal(a.state, 'closed');
});

test('pure helper hygiene: NaN never leaks out of the curve and gain helpers', () => {
  assert.ok(Number.isFinite(intensityToCutoff(NaN)));
  assert.ok(Number.isFinite(intensityToCutoff('x')));
  assert.equal(intensityToCutoff(NaN), intensityToCutoff(1));
  let prev = 0;
  for (let i = 0; i <= 10; i++) { const c = intensityToCutoff(i / 10); assert.ok(c > prev); prev = c; }
  assert.equal(softClipCurve(1).length, 2);
  assert.ok(softClipCurve(NaN).every((v) => Number.isFinite(v)));
  assert.ok(softClipCurve(64, 2).every((v) => Number.isFinite(v)), 'a knee above 1 is clamped');
  assert.equal(fadeCurve(NaN, 'in').length, 2);
  assert.equal(fadeCurve(0, 'out').length, 2);
  assert.equal(fadeCurve(3.7, 'in').length, 3);
  assert.equal(volumeToGain(null), 0);
  assert.equal(volumeToGain('0.5'), 0.25);
  assert.equal(volumeToGain(Infinity), 1);
  assert.equal(dbToGain(-Infinity), 0);
  assert.equal(gainToDb(-1), -Infinity);
  assert.throws(() => freqToMidi(-1), RangeError);
  assert.throws(() => freqToMidi('x'), RangeError);
  assert.throws(() => freqToMidi(NaN), RangeError);
  assert.deepEqual([...new Set(SFX_NAMES)].length, SFX_NAMES.length, 'sfx names are unique');
  assert.equal(SFX_NAMES.length, 40);
  for (const [alias, target] of [['tailSlap', 'thwap'], ['select', 'confirm'], ['back', 'cancel'], ['type', 'textTick'], ['shift', 'shiftFlip']]) {
    assert.equal(sfxDuration(alias), sfxDuration(target), alias);
  }
});
