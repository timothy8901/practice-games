import { test } from 'node:test';
import assert from 'node:assert/strict';
import audioDefault, {
  audio, createAudio, SCALES, CHORDS, SFX_NAMES, INSTRUMENT_NAMES, DEMO_TRACK, DEMO_TRACK_ID,
  clamp, midiToFreq, freqToMidi, noteToMidi, midiToNote, keyToMidi, scaleNotes, degreeToMidi, quantizeToScale,
  chord, dbToGain, gainToDb, volumeToGain, fadeCurve, makeLcg, hashString,
  stepSeconds, resolveNotes, expandPattern, parseStepString, bucketEvents, swingOffset, createStepClock,
  createRateLimiter, analyzeBuffer, inferInstrument, normalizeTrack, sfxDuration, softClipCurve, intensityToCutoff,
} from '../js/core/audio.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

const CONTRACT_SFX = ('blip confirm cancel error step stepWater shake fruitDrop coin purse splash bite catchFish dig crack ' +
  'thwap bell lantern capture captureFail hit hitStrong hitWeak blocked heal levelUp shiftFlip shiftReveal letter doorOpen ' +
  'textTick toast wave rain thunder firefly night dawn stamp achievement').split(' ');
const CONTRACT_INSTRUMENTS = 'pluck pad bass bell flute kick hat snare marimba glass'.split(' ');

test('imports without a browser and exposes the singleton as default + named export', () => {
  assert.equal(audioDefault, audio);
  assert.equal(typeof globalThis.AudioContext, 'undefined');
  assert.equal(audio.ready, false);
  assert.equal(audio.state, 'closed');
  assert.equal(audio.analyser, null);
});

test('note <-> frequency conversions', () => {
  near(midiToFreq(69), 440);
  near(midiToFreq(57), 220);
  near(freqToMidi(440), 69);
  near(freqToMidi(midiToFreq(62.5)), 62.5);
  assert.throws(() => freqToMidi(0), RangeError);
});

test('note names parse and format', () => {
  assert.equal(noteToMidi('C4'), 60);
  assert.equal(noteToMidi('A4'), 69);
  assert.equal(noteToMidi('C#4'), 61);
  assert.equal(noteToMidi('Db4'), 61);
  assert.equal(noteToMidi('d3'), 50);
  assert.equal(noteToMidi('C-1'), 0);
  assert.equal(noteToMidi('H4'), null);
  assert.equal(noteToMidi(''), null);
  assert.equal(noteToMidi(62), null);
  assert.equal(midiToNote(60), 'C4');
  assert.equal(midiToNote(61), 'C#4');
  assert.equal(midiToNote(69.4), 'A4');
  assert.equal(keyToMidi('D'), 50);
  assert.equal(keyToMidi('F#', 4), 66);
  assert.equal(keyToMidi('Bb2'), 46);
  assert.equal(keyToMidi('X'), null);
});

test('scales, degrees, quantization and chords', () => {
  assert.deepEqual(scaleNotes(62, 'major'), [62, 64, 66, 67, 69, 71, 73]);
  assert.equal(scaleNotes(60, 'pentatonic', { octaves: 2 }).length, 10);
  assert.throws(() => scaleNotes(60, 'nope'), RangeError);
  assert.equal(degreeToMidi(0, 62, 'major'), 62);
  assert.equal(degreeToMidi(7, 62, 'major'), 74);
  assert.equal(degreeToMidi(-1, 62, 'major'), 61);
  assert.equal(quantizeToScale(63, 62, 'major'), 62);
  assert.equal(quantizeToScale(68, 62, 'major'), 67);
  assert.equal(quantizeToScale(74, 62, 'major'), 74);
  assert.equal(quantizeToScale(61, 62, 'major'), 61);
  assert.deepEqual(chord(62), [62, 66, 69]);
  assert.deepEqual(chord(62, 'min7'), [62, 65, 69, 72]);
  assert.deepEqual(chord(62, 'maj', { inversion: 1 }), [66, 69, 74]);
  assert.deepEqual(chord(62, 'maj', { octave: -1 }), [50, 54, 57]);
  assert.throws(() => chord(62, 'weird'), RangeError);
  assert.ok(Object.isFrozen(SCALES) && Object.isFrozen(CHORDS));
});

test('gain helpers and curves', () => {
  near(dbToGain(0), 1);
  near(dbToGain(-6.0206), 0.5, 1e-4);
  near(gainToDb(1), 0);
  assert.equal(gainToDb(0), -Infinity);
  assert.equal(volumeToGain(1), 1);
  assert.equal(volumeToGain(0.5), 0.25);
  assert.equal(volumeToGain(-3), 0);
  assert.equal(volumeToGain('x'), 0);
  assert.equal(clamp(5, 0, 1), 1);
  const fin = fadeCurve(5, 'in');
  const fout = fadeCurve(5, 'out', 0.5);
  assert.equal(fin.length, 5);
  near(fin[0], 0);
  near(fin[4], 1);
  near(fout[0], 0.5);
  near(fout[4], 0, 1e-6);
  for (let i = 0; i < 5; i++) near(fin[i] ** 2 + (fout[i] * 2) ** 2, 1, 1e-6);
  assert.equal(fadeCurve(1, 'in').length, 2);
  const clip = softClipCurve(1001);
  near(clip[500], 0);
  assert.ok(clip[1000] < 0.91 && clip[1000] > 0.9);
  near(clip[800], (800 / 1000) * 2 - 1, 1e-6);
  near(intensityToCutoff(0), 400);
  assert.ok(intensityToCutoff(1) > 19500 && intensityToCutoff(1) < 20500);
});

test('lcg and hash are deterministic', () => {
  const a = makeLcg(42);
  const b = makeLcg(42);
  const seq = [a(), a(), a()];
  assert.deepEqual([b(), b(), b()], seq);
  assert.ok(seq.every((v) => v >= 0 && v < 1));
  assert.equal(hashString('harbor'), hashString('harbor'));
  assert.notEqual(hashString('harbor'), hashString('harbour'));
  assert.ok(Number.isInteger(hashString('x')) && hashString('x') >= 0);
});

test('step timing math', () => {
  near(stepSeconds(92, 4), 60 / 92 / 4);
  near(stepSeconds(120, 2), 0.25);
  assert.throws(() => stepSeconds(0), RangeError);
  near(swingOffset(1, 1, 0.3), 0.1);
  assert.equal(swingOffset(2, 1, 0.3), 0);
  assert.equal(swingOffset(1, 0, 0.3), 0);
  near(swingOffset(3, 0.5, 0.3), 0.05);
});

test('resolveNotes and expandPattern normalize, sort, clamp and drop junk', () => {
  assert.deepEqual(resolveNotes('D4'), [62]);
  assert.deepEqual(resolveNotes([62, 'F#4', 'bad', null]), [62, 66]);
  assert.deepEqual(resolveNotes(null), []);
  const ev = expandPattern([
    { t: 4, n: 'D4', d: 2, v: 0.5 },
    { t: 0, n: [62, 66], d: 0, v: 9 },
    { t: 2, n: null },
    { t: 40, n: 60 },
    { t: -1, n: 60 },
    null,
    { t: 'x', n: 60 },
    { t: 6 },
  ], { loopSteps: 32, defaultNote: 36 });
  assert.deepEqual(ev, [
    { t: 0, n: [62, 66], d: 1, v: 1 },
    { t: 4, n: [62], d: 2, v: 0.5 },
    { t: 6, n: [36], d: 1, v: 0.8 },
  ]);
  assert.throws(() => expandPattern('nope', { loopSteps: 16 }), TypeError);
  assert.throws(() => expandPattern([], { loopSteps: 0 }), RangeError);
});

test('parseStepString and bucketEvents', () => {
  const evs = parseStepString('x.o.|X...', { note: 36, vel: 0.8 });
  assert.deepEqual(evs.map((e) => e.t), [0, 2, 4]);
  near(evs[1].v, 0.44);
  assert.equal(evs[2].v, 1);
  assert.throws(() => parseStepString(5), TypeError);
  const buckets = bucketEvents(expandPattern([{ t: 2.5, n: 60 }, { t: 2, n: 61 }, { t: 7, n: 62 }], { loopSteps: 16 }));
  assert.deepEqual([...buckets.keys()], [2, 7]);
  assert.equal(buckets.get(2).length, 2);
});

test('step clock emits each step once, wraps loops and reports position', () => {
  const clock = createStepClock({ bpm: 120, loopSteps: 8, stepsPerBeat: 4, stepsPerBar: 8, startTime: 10 });
  near(clock.stepSec, 0.125);
  near(clock.loopSec, 1);
  assert.deepEqual(clock.advance(9), []);
  const first = clock.advance(10.3);
  assert.deepEqual(first.map((t) => t.abs), [0, 1, 2]);
  near(first[2].time, 10.25);
  assert.deepEqual(clock.advance(10.3), []);
  const more = clock.advance(11.2);
  assert.deepEqual(more.map((t) => t.step), [3, 4, 5, 6, 7, 0, 1]);
  assert.equal(more[5].loop, 1);
  assert.equal(clock.nextStep(), 10);
  const pos = clock.positionAt(11.3125);
  assert.deepEqual({ abs: pos.abs, step: pos.step, loop: pos.loop, beat: pos.beat }, { abs: 10, step: 2, loop: 1, beat: 0 });
  near(pos.phase, 0.5);
  near(clock.nextBarTime(10.01), 11);
  near(clock.nextBarTime(11), 11);
  near(clock.timeOf(16), 12);
  assert.throws(() => createStepClock({ bpm: 120, loopSteps: 2.5 }), RangeError);
});

test('step clock catches up instead of flooding after a long stall', () => {
  const clock = createStepClock({ bpm: 120, loopSteps: 16, stepsPerBar: 16, startTime: 0, maxCatchUpSteps: 4 });
  clock.advance(0.2);
  const ticks = clock.advance(100);
  assert.ok(ticks.length <= 6, `expected a short catch-up burst, got ${ticks.length}`);
  assert.ok(ticks.at(-1).time < 100 && ticks.at(-1).time > 99);
});

test('rate limiter refuses rapid repeats and bursts', () => {
  const rl = createRateLimiter({ minInterval: 0.02, maxBurst: 3, window: 0.1 });
  assert.equal(rl.allow('a', 1.0), true);
  assert.equal(rl.allow('a', 1.01), false);
  assert.equal(rl.allow('a', 1.03), true);
  assert.equal(rl.allow('b', 1.04), true);
  assert.equal(rl.allow('c', 1.05), false);
  assert.equal(rl.allow('c', 1.2), true);
  rl.reset();
  assert.equal(rl.allow('a', 1.2), true);
});

test('analyzeBuffer computes peak and rms across channels', () => {
  const r = analyzeBuffer([new Float32Array([0, 0.5, -1]), new Float32Array([0.5, 0.5, 0.5])]);
  assert.equal(r.peak, 1);
  assert.equal(r.samples, 6);
  near(r.rms, Math.sqrt((0.25 + 1 + 0.75) / 6));
  assert.deepEqual(analyzeBuffer([]), { peak: 0, rms: 0, samples: 0 });
});

test('track normalization validates and expands layers', () => {
  const t = normalizeTrack('t', {
    bpm: 100, key: 'D', scale: 'minor', bars: 2,
    layers: {
      melody: [{ t: 0, n: 'D4' }, { t: 40, n: 'E4' }],
      kick: 'x...'.repeat(10),
      lead: { inst: 'glass', pattern: [{ t: 1, n: [62, 'F4'] }], gain: 5, stem: true, pan: -3, minIntensity: 0.7 },
    },
  });
  assert.equal(t.loopSteps, 32);
  assert.equal(t.stepsPerBeat, 4);
  assert.equal(t.root, 50);
  const by = Object.fromEntries(t.layers.map((l) => [l.name, l]));
  assert.equal(by.melody.inst, 'marimba');
  assert.equal(by.melody.events.length, 1);
  assert.equal(by.kick.inst, 'kick');
  assert.equal(by.kick.events.length, 8, 'hits past the loop end are dropped');
  assert.deepEqual(by.kick.events[0].n, [36]);
  assert.equal(by.lead.gain, 2);
  assert.equal(by.lead.pan, -1);
  assert.equal(by.lead.stem, true);
  assert.equal(by.lead.minIntensity, 0.7);
  assert.deepEqual(by.lead.events[0].n, [62, 65]);
  assert.equal(inferInstrument('night'), 'glass');
  assert.equal(inferInstrument('whatever'), 'pluck');
  assert.throws(() => normalizeTrack('', { bpm: 100, layers: {} }), TypeError);
  assert.throws(() => normalizeTrack('x', { bpm: 1000, layers: {} }), RangeError);
  assert.throws(() => normalizeTrack('x', { bpm: 100, bars: 0, layers: {} }), RangeError);
  assert.throws(() => normalizeTrack('x', { bpm: 100, key: 'Q', layers: {} }), RangeError);
  assert.throws(() => normalizeTrack('x', { bpm: 100, scale: 'zzz', layers: {} }), RangeError);
  assert.throws(() => normalizeTrack('x', { bpm: 100, layers: { a: { inst: 'kazoo', pattern: [] } } }), RangeError);
  assert.throws(() => normalizeTrack('x', { bpm: 100, layers: { a: { pattern: 5 } } }), TypeError);
  assert.throws(() => normalizeTrack('x', { bpm: 100, stepsPerBar: 15, layers: {} }), RangeError);
});

test('sfx bank and instrument presets cover the contract', () => {
  for (const name of CONTRACT_SFX) assert.ok(SFX_NAMES.includes(name), `missing sfx ${name}`);
  for (const name of CONTRACT_INSTRUMENTS) assert.ok(INSTRUMENT_NAMES.includes(name), `missing instrument ${name}`);
  assert.equal(sfxDuration('thwap'), 0.26);
  assert.equal(sfxDuration('tailSlap'), 0.26);
  assert.equal(sfxDuration('nope'), null);
  for (const name of SFX_NAMES) assert.ok(sfxDuration(name) > 0 && sfxDuration(name) <= 3.5, name);
});

test('demo track is a valid, in-key, 8-bar D major loop', () => {
  const t = normalizeTrack(DEMO_TRACK_ID, DEMO_TRACK);
  assert.equal(t.bpm, 92);
  assert.equal(t.key, 'D');
  assert.equal(t.bars, 8);
  assert.equal(t.loopSteps, 128);
  const names = t.layers.map((l) => l.name);
  for (const n of ['bass', 'melody', 'pad', 'arp', 'kick', 'hat', 'night']) assert.ok(names.includes(n), n);
  const night = t.layers.find((l) => l.name === 'night');
  assert.equal(night.stem, true);
  assert.equal(night.inst, 'glass');
  const inKey = new Set(scaleNotes(0, 'major').map((s) => (s + 2) % 12));
  for (const l of t.layers) {
    if (['kick', 'hat', 'snare'].includes(l.inst)) continue;
    for (const ev of l.events) {
      assert.ok(ev.t >= 0 && ev.t < 128 && ev.d > 0 && ev.v > 0 && ev.v <= 1);
      for (const n of ev.n) assert.ok(inKey.has(((n % 12) + 12) % 12), `${l.name}: ${midiToNote(n)} out of D major`);
    }
  }
  assert.ok(Object.isFrozen(DEMO_TRACK));
});

test('engine API degrades gracefully without WebAudio and remembers requests', async () => {
  const a = createAudio();
  assert.equal(a.ready, false);
  assert.equal(await a.unlock(), false);
  assert.equal(a.ready, false);
  assert.equal(a.sfx('coin'), null);
  assert.equal(a.sfx('definitely-not-a-sound'), null);
  assert.deepEqual(a.getVolume(), { master: 1, music: 0.8, sfx: 1 });
  assert.deepEqual(a.setVolume({ master: 2, sfx: -1, music: 'x' }), { master: 1, music: 0.8, sfx: 0 });
  assert.equal(a.isMuted(), false);
  assert.equal(a.mute(true), true);
  assert.equal(a.isMuted(), true);
  assert.deepEqual(a.trackIds(), [DEMO_TRACK_ID]);
  assert.equal(a.hasTrack(DEMO_TRACK_ID), true);
  assert.equal(a.playMusic('missing'), false);
  assert.equal(a.playMusic(DEMO_TRACK_ID), true);
  assert.deepEqual(a.nowPlaying(), { id: DEMO_TRACK_ID, pending: true });
  assert.equal(a.stopMusic(), false);
  assert.equal(a.nowPlaying(), null);
  assert.deepEqual(a.setStem('night', true), ['night']);
  assert.deepEqual(a.setStem('night', false), []);
  assert.deepEqual(a.setMusicParam({ intensity: 7 }), { intensity: 1 });
  assert.deepEqual(a.setMusicParam({ intensity: 0.25 }), { intensity: 0.25 });
  const custom = a.defineTrack('mini', { bpm: 120, bars: 1, layers: { kick: 'x...' } });
  assert.equal(custom.loopSteps, 16);
  assert.ok(a.hasTrack('mini'));
  await assert.rejects(() => a.renderSfx('coin'), /OfflineAudioContext/);
  await assert.rejects(() => a.renderSfx('nope'), RangeError);
  await assert.rejects(() => a.renderTrack('nope'), RangeError);
  await a.dispose();
  assert.equal(a.ready, false);
});
