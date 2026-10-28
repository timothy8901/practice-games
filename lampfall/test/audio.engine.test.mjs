// Engine-level tests for js/core/audio.js against a strict fake WebAudio implementation.
// The fake throws where real browsers throw (non-finite values, negative times, exponential ramps to
// zero, starting a source twice), records every scheduled source and automation event, and lets the
// tests drive `currentTime` and the scheduler timer deterministically. Real audio levels (peak/RMS)
// are checked in the browser by test/pages/audio.html and test/pages/audio-adversarial.html.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAudio, SFX_NAMES, INSTRUMENT_NAMES, DEMO_TRACK_ID, DEMO_TRACK, stepSeconds,
} from '../js/core/audio.js';

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Fake WebAudio
// ───────────────────────────────────────────────────────────────────────────────────────────────

const finite = (v, what) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`${what}: non-finite ${v}`);
};
const time = (t, what) => {
  finite(t, what);
  if (t < 0) throw new RangeError(`${what}: negative time ${t}`);
};

class FakeParam {
  constructor(ctx, owner, name, value) {
    this.ctx = ctx;
    this.owner = owner;
    this.name = name;
    this._v = value;
    /** @type {Array<{kind: string, v: number, t: number, tc?: number}>} */
    this.events = [];
    ctx.params.push(this);
  }
  get value() { return this._v; }
  set value(v) { finite(v, `${this.name}.value`); this._v = v; }
  _push(e) { this.events.push(e); this.ctx.log.push({ param: this, ...e }); return this; }
  setValueAtTime(v, t) { finite(v, 'setValueAtTime'); time(t, 'setValueAtTime'); return this._push({ kind: 'set', v, t }); }
  linearRampToValueAtTime(v, t) { finite(v, 'linearRamp'); time(t, 'linearRamp'); return this._push({ kind: 'lin', v, t }); }
  exponentialRampToValueAtTime(v, t) {
    finite(v, 'expRamp');
    time(t, 'expRamp');
    if (v <= 0) throw new RangeError(`exponentialRampToValueAtTime: value must be > 0, got ${v}`);
    return this._push({ kind: 'exp', v, t });
  }
  setTargetAtTime(v, t, tc) {
    finite(v, 'setTarget');
    time(t, 'setTarget');
    finite(tc, 'setTarget timeConstant');
    if (tc < 0) throw new RangeError('setTargetAtTime: negative time constant');
    return this._push({ kind: 'target', v, t, tc });
  }
  setValueCurveAtTime(curve, t, d) {
    time(t, 'setValueCurve');
    finite(d, 'setValueCurve duration');
    for (const v of curve) finite(v, 'setValueCurve value');
    return this._push({ kind: 'curve', v: curve[curve.length - 1], t, d });
  }
  cancelScheduledValues(t) { time(t, 'cancelScheduledValues'); this.events = this.events.filter((e) => e.t < t); return this; }
  cancelAndHoldAtTime(t) {
    time(t, 'cancelAndHoldAtTime');
    const held = this.valueAt(t);
    this.events = this.events.filter((e) => e.t < t);
    this.events.push({ kind: 'set', v: held, t });
    return this;
  }
  /** Approximate the automation value at time t (good enough for gain checks). */
  valueAt(t) {
    let v = this._v;
    let prevT = 0;
    let target = null;
    const evs = [...this.events].sort((a, b) => a.t - b.t);
    for (const e of evs) {
      if (target) {
        const until = Math.min(e.t, t);
        v = target.v + (v - target.v) * Math.exp(-(until - target.t) / Math.max(target.tc, 1e-9));
        if (e.t > t) return v;
        target = null;
      }
      if (e.t > t) {
        if (e.kind === 'lin') return v + (e.v - v) * ((t - prevT) / (e.t - prevT));
        if (e.kind === 'exp') return v * (e.v / v) ** ((t - prevT) / (e.t - prevT));
        return v;
      }
      if (e.kind === 'target') { target = e; prevT = e.t; continue; }
      v = e.v;
      prevT = e.t;
    }
    if (target) v = target.v + (v - target.v) * Math.exp(-(t - target.t) / Math.max(target.tc, 1e-9));
    return v;
  }
}

class FakeNode {
  constructor(ctx, kind) {
    this.context = ctx;
    this.kind = kind;
    this.outputs = [];
    this.inputs = [];
    this.disconnectedAt = null;
    ctx.nodes.push(this);
  }
  connect(dest) {
    if (!dest) throw new TypeError('connect: no destination');
    this.outputs.push(dest);
    if (dest instanceof FakeNode) dest.inputs.push(this);
    return dest;
  }
  disconnect() {
    for (const d of this.outputs) if (d instanceof FakeNode) d.inputs = d.inputs.filter((n) => n !== this);
    this.outputs = [];
    this.disconnectedAt = this.context.currentTime;
  }
}

class FakeSource extends FakeNode {
  constructor(ctx, kind) {
    super(ctx, kind);
    this.startedAt = null;
    this.stoppedAt = null;
  }
  start(when = 0, offset = 0) {
    time(when, `${this.kind}.start`);
    time(offset, `${this.kind}.start offset`);
    if (this.startedAt !== null) throw new Error('InvalidStateError: start called twice');
    this.startedAt = when;
    this.context.starts.push(this);
  }
  stop(when = 0) {
    time(when, `${this.kind}.stop`);
    if (this.startedAt === null) throw new Error('InvalidStateError: stop before start');
    this.stoppedAt = when;
  }
}

class FakeAudioContext {
  constructor() {
    this.sampleRate = 48000;
    this.currentTime = 0;
    this.state = 'suspended';
    this.nodes = [];
    this.params = [];
    this.starts = [];
    this.log = [];
    this.listeners = new Map();
    this.destination = new FakeNode(this, 'destination');
    FakeAudioContext.instances.push(this);
  }
  addEventListener(type, fn) { (this.listeners.get(type) ?? this.listeners.set(type, []).get(type)).push(fn); }
  _emit(type) { for (const fn of this.listeners.get(type) ?? []) fn(); }
  resume() {
    // Like browsers: the promise and the state change land asynchronously.
    return Promise.resolve().then(() => { if (this.state !== 'closed' && this.state !== 'running') { this.state = 'running'; this._emit('statechange'); } });
  }
  suspend() { this.state = 'suspended'; this._emit('statechange'); return Promise.resolve(); }
  close() { this.state = 'closed'; this._emit('statechange'); return Promise.resolve(); }
  createGain() { const n = new FakeNode(this, 'gain'); n.gain = new FakeParam(this, n, 'gain', 1); return n; }
  createOscillator() {
    const n = new FakeSource(this, 'osc');
    n.type = 'sine';
    n.frequency = new FakeParam(this, n, 'frequency', 440);
    n.detune = new FakeParam(this, n, 'detune', 0);
    return n;
  }
  createBiquadFilter() {
    const n = new FakeNode(this, 'biquad');
    n.type = 'lowpass';
    n.frequency = new FakeParam(this, n, 'frequency', 350);
    n.Q = new FakeParam(this, n, 'Q', 1);
    n.gain = new FakeParam(this, n, 'gain', 0);
    return n;
  }
  createBufferSource() {
    const n = new FakeSource(this, 'buffer');
    n.buffer = null;
    n.loop = false;
    n.playbackRate = new FakeParam(this, n, 'playbackRate', 1);
    return n;
  }
  createBuffer(channels, length, sampleRate) {
    if (!(length > 0) || !Number.isInteger(length)) throw new RangeError(`createBuffer: bad length ${length}`);
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate, duration: length / sampleRate, getChannelData: (i) => data[i] };
  }
  createStereoPanner() {
    const n = new FakeNode(this, 'panner');
    n.pan = new FakeParam(this, n, 'pan', 0);
    return n;
  }
  createDynamicsCompressor() {
    const n = new FakeNode(this, 'compressor');
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new FakeParam(this, n, k, 0);
    return n;
  }
  createWaveShaper() { const n = new FakeNode(this, 'shaper'); n.curve = null; n.oversample = 'none'; return n; }
  createAnalyser() {
    const n = new FakeNode(this, 'analyser');
    n.fftSize = 2048;
    n.smoothingTimeConstant = 0.8;
    n.getFloatTimeDomainData = (arr) => arr.fill(0);
    return n;
  }
}
FakeAudioContext.instances = [];

class FakeOfflineAudioContext extends FakeAudioContext {
  constructor(channels, length, sampleRate) {
    super();
    if (!(length > 0) || !Number.isInteger(length)) throw new RangeError(`OfflineAudioContext: bad length ${length}`);
    if (length / sampleRate > 3600) throw new RangeError(`OfflineAudioContext: ${Math.round(length / sampleRate)} s is too long to allocate`);
    this.channels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    FakeOfflineAudioContext.last = this;
  }
  startRendering() {
    for (const p of this.params) for (const e of p.events) finite(e.v, 'render');
    return Promise.resolve(this.createBuffer(this.channels, this.length, this.sampleRate));
  }
}

/** Install the fake as the global AudioContext for the duration of `fn`. */
async function withFakeAudio(t, fn) {
  const saved = { AC: globalThis.AudioContext, OAC: globalThis.OfflineAudioContext };
  globalThis.AudioContext = FakeAudioContext;
  globalThis.OfflineAudioContext = FakeOfflineAudioContext;
  FakeAudioContext.instances = [];
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const a = createAudio();
  try {
    await fn(a);
  } finally {
    await a.dispose();
    t.mock.timers.reset();
    if (saved.AC === undefined) delete globalThis.AudioContext; else globalThis.AudioContext = saved.AC;
    if (saved.OAC === undefined) delete globalThis.OfflineAudioContext; else globalThis.OfflineAudioContext = saved.OAC;
  }
}

/** Advance the fake clock to `to` seconds, firing the scheduler timer along the way. */
function runUntil(t, ctx, to, tickMs = 60) {
  while (ctx.currentTime < to - 1e-9) {
    ctx.currentTime = Math.min(to, ctx.currentTime + tickMs / 1000);
    t.mock.timers.tick(tickMs);
  }
}

/** Is `to` reachable from `from` following audio connections? */
function reaches(from, to, seen = new Set()) {
  if (from === to) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  return from.outputs.some((n) => n instanceof FakeNode && reaches(n, to, seen));
}

/** Sources that make sound (the one-sample unlock nudge wired straight to the destination is excluded). */
const sourcesOf = (ctx) => ctx.starts.filter((s) => (s.kind === 'osc' || s.kind === 'buffer') && !s.outputs.includes(ctx.destination));

/**
 * Per-layer gain nodes of the `index`-th player in a context (players feed the music filter, which is
 * the first biquad the master chain creates; layer gains feed the player's output in layer order).
 * Muted layers keep scheduling notes through a zero gain so stems can fade in mid-note, so stem state
 * is observed on these gains rather than by counting notes.
 */
function layerGains(ctx, index = -1) {
  const musicFilter = ctx.nodes.find((n) => n.kind === 'biquad');
  const out = musicFilter.inputs.at(index);
  return out.inputs.filter((n) => n.kind === 'gain');
}

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Tests
// ───────────────────────────────────────────────────────────────────────────────────────────────

test('unlock builds the graph once; the analyser sees the final (soft-clipped) output', async (t) => {
  await withFakeAudio(t, async (a) => {
    const p1 = a.unlock();
    const p2 = a.unlock();
    assert.equal(p1, p2, 'concurrent unlocks share one attempt');
    assert.equal(await p1, true);
    assert.equal(FakeAudioContext.instances.length, 1);
    const ctx = a.context;
    assert.equal(a.ready, true);
    assert.equal(a.state, 'running');
    assert.ok(a.analyser);
    const shaper = ctx.nodes.find((n) => n.kind === 'shaper');
    assert.ok(shaper && shaper.curve instanceof Float32Array);
    assert.ok(reaches(shaper, a.analyser), 'soft clip sits before the analyser so visualizers never read > 1');
    assert.ok(reaches(a.analyser, ctx.destination) || reaches(shaper, ctx.destination));
    assert.equal(await a.unlock(), true, 'unlock is idempotent');
    assert.equal(FakeAudioContext.instances.length, 1);
  });
});

test('every sfx schedules without throwing at extreme options, and respects the delay cap', async (t) => {
  await withFakeAudio(t, async (a) => {
    await a.unlock();
    const ctx = a.context;
    const extremes = [{}, { pitch: 0.25 }, { pitch: 4 }, { semitones: -48 }, { semitones: 48 }, { volume: 0.001 }, { volume: 2 }, { pan: -1 }, { pan: 1 }];
    for (const name of SFX_NAMES) {
      for (const o of extremes) {
        ctx.currentTime += 0.5; // step past the rate limiter
        const h = a.sfx(name, o);
        assert.ok(h && h.name === name && h.duration > 0, `${name} ${JSON.stringify(o)}`);
      }
    }
    assert.equal(a.sfx('coin', { volume: 0 }), null, 'silent requests schedule nothing');
    ctx.currentTime += 1;
    const before = ctx.starts.length;
    const h = a.sfx('coin', { delay: 1e9 });
    assert.ok(h);
    const late = ctx.starts.slice(before);
    assert.ok(late.length > 0);
    assert.ok(late.every((s) => s.startedAt <= ctx.currentTime + 10.1), 'absurd delays are capped so nodes cannot pile up for ages');
  });
});

test('sfx rate limiting holds under a 10k-call storm in one instant', async (t) => {
  await withFakeAudio(t, async (a) => {
    await a.unlock();
    let ok = 0;
    for (let i = 0; i < 10000; i++) if (a.sfx(SFX_NAMES[i % SFX_NAMES.length])) ok++;
    assert.ok(ok > 0 && ok <= 20, `accepted ${ok}`);
  });
});

test('renderSfx: every sound at every extreme renders (volume 0 included) and is seed-deterministic', async (t) => {
  await withFakeAudio(t, async (a) => {
    for (const name of SFX_NAMES) {
      for (const o of [{ volume: 0 }, { volume: 2, pitch: 4, pan: 1 }, { pitch: 0.25, pan: -1 }, { semitones: 'x', volume: 'y' }]) {
        const buf = await a.renderSfx(name, o);
        assert.ok(buf.length > 0, `${name} ${JSON.stringify(o)}`);
      }
    }
    const sig = async (name, seed) => {
      await a.renderSfx(name, { seed });
      return FakeOfflineAudioContext.last.starts.map((s) => `${s.kind}@${s.startedAt.toFixed(6)}`).join(',');
    };
    assert.equal(await sig('rain', 5), await sig('rain', 5));
    assert.notEqual(await sig('rain', 5), await sig('rain', 6), 'the seed changes random sfx');
  });
});

test('renderCry: every cry wave, the snap / tail / shimmer / motif variants and junk params render; length follows the plan', async (t) => {
  const { cryPlan, CRY_WAVES } = await import('../js/core/audio.js');
  await withFakeAudio(t, async (a) => {
    const variants = [
      ...CRY_WAVES.map((wave) => ({ base: 62, slide: 5, wave })),
      { base: 69, slide: 12, wave: 'square', snap: true, tail: true, shimmer: true },
      { base: 60, motif: [69, 67, 66, 62] },
      null, { base: 'x', slide: NaN, wave: 'kazoo' },
    ];
    for (const p of variants) {
      for (const o of [{}, { volume: 0 }, { volume: 2, semitones: -4, pan: 1 }, { pitch: 'y', pan: -1 }]) {
        const buf = await a.renderCry(p, o);
        assert.equal(buf.length, Math.ceil((cryPlan(p).end + 0.4) * 44100), JSON.stringify(p));
        assert.ok(FakeOfflineAudioContext.last.starts.length > 0, 'something sounded');
      }
    }
  });
});

test('cry: ducks the music bus by CRY_DUCK under the cry and brings it back; overlapping cries re-hold', async (t) => {
  const { CRY_DUCK, dbToGain, cryPlan } = await import('../js/core/audio.js');
  await withFakeAudio(t, async (a) => {
    await a.unlock();
    const ctx = a.context;
    const musicFilter = ctx.nodes.find((n) => n.kind === 'biquad');
    const duck = musicFilter.outputs[0];
    assert.equal(duck.kind, 'gain', 'the music filter feeds the duck gain');
    assert.equal(duck.gain.value, 1);
    const { MUSIC_HEADROOM_DB } = await import('../js/core/audio.js');
    const headroom = duck.outputs[0];
    assert.equal(headroom.kind, 'gain');
    assert.ok(Math.abs(headroom.gain.value - dbToGain(MUSIC_HEADROOM_DB)) < 1e-9, 'fixed music headroom after the duck');
    assert.ok(MUSIC_HEADROOM_DB < 0 && MUSIC_HEADROOM_DB >= -6);
    const params = { base: 62, slide: 4, wave: 'triangle', tail: true };
    const r = a.cry(params, { volume: 0.9 });
    assert.ok(r, 'cry played');
    const lows = duck.gain.events.filter((e) => e.kind === 'lin' && Math.abs(e.v - dbToGain(CRY_DUCK.db)) < 1e-9);
    assert.equal(lows.length, 1, 'one ramp down to the duck level');
    assert.ok(Math.abs(lows[0].t - (r.time + CRY_DUCK.attack)) < 1e-9);
    const back = duck.gain.events.at(-1);
    assert.equal(back.kind, 'lin');
    assert.equal(back.v, 1, 'the music comes back to unity');
    assert.ok(Math.abs(back.t - (r.time + cryPlan(params).end + CRY_DUCK.release)) < 1e-9);
    assert.ok(CRY_DUCK.db < 0 && CRY_DUCK.db >= -12, 'a dip, not a mute');
    // a second cry while the first is still ducking: no throw, ends back at unity later
    ctx.currentTime += 0.1;
    assert.ok(a.cry(params));
    assert.equal(duck.gain.events.at(-1).v, 1);
    assert.ok(duck.gain.events.at(-1).t > back.t);
    // a delayed cry: the duck holds the music's level until the cry starts instead of dipping from the call
    ctx.currentTime += 5;
    const n0 = duck.gain.events.length;
    const rd = a.cry(params, { delay: 1 });
    assert.ok(rd, 'delayed cry played');
    const fresh = duck.gain.events.slice(n0);
    const lowD = fresh.find((e) => e.kind === 'lin' && Math.abs(e.v - dbToGain(CRY_DUCK.db)) < 1e-9);
    assert.ok(Math.abs(lowD.t - (rd.time + CRY_DUCK.attack)) < 1e-9);
    const holdAtStart = fresh.find((e) => e.kind === 'set' && Math.abs(e.t - rd.time) < 1e-9);
    assert.ok(holdAtStart, 'level held until the delayed cry starts');
    assert.ok(holdAtStart.v > dbToGain(CRY_DUCK.db), 'held at the undipped level');
    // sfx slider off: the cry is silent, so the music must not dip; sfx quieter than music: a shallower dip
    ctx.currentTime += 5;
    a.setVolume({ sfx: 0, music: 0.8 });
    let n1 = duck.gain.events.length;
    a.cry(params);
    assert.equal(duck.gain.events.slice(n1).filter((e) => e.kind === 'lin' && e.v < 1).length, 0, 'no duck with sfx off');
    ctx.currentTime += 5;
    a.setVolume({ sfx: 0.4, music: 0.8 });
    n1 = duck.gain.events.length;
    a.cry(params);
    const shallow = duck.gain.events.slice(n1).find((e) => e.kind === 'lin' && e.v < 1);
    assert.ok(shallow && shallow.v > dbToGain(CRY_DUCK.db) && shallow.v < 1, 'shallower duck when sfx is under music');
  });
});

test('renderTrack: every instrument survives extreme notes, durations and velocities', async (t) => {
  await withFakeAudio(t, async (a) => {
    const pattern = [
      { t: 0, n: 0, d: 0.001, v: 1 }, { t: 1, n: 127, d: 1e9, v: 1 }, { t: 2, n: -40, d: 4, v: 0.5 },
      { t: 3, n: 200, d: 2, v: 1 }, { t: 4, n: [60, 64.5, 'G4'], d: 8, v: 0.7 }, { t: 5, n: 60, d: 1, v: 0 },
    ];
    const layers = Object.fromEntries(INSTRUMENT_NAMES.map((inst) => [`l_${inst}`, { inst, pattern }]));
    a.defineTrack('extreme', { bpm: 300, bars: 1, layers });
    const buf = await a.renderTrack('extreme', { bars: 1, sampleRate: 8000 });
    assert.ok(buf.length > 0);
    const oc = FakeOfflineAudioContext.last;
    const loopSec = 16 * stepSeconds(300);
    const maxStop = Math.max(...oc.starts.map((s) => s.stoppedAt ?? 0));
    assert.ok(maxStop < 0.05 + loopSec + 10, `notes cannot outlive the loop by much (last stop at ${maxStop.toFixed(1)} s)`);
    for (const p of oc.params) for (const e of p.events) assert.ok(Number.isFinite(e.v), `${p.name} ${e.kind}`);
  });
});

test('renderTrack: zero-velocity events are rests', async (t) => {
  await withFakeAudio(t, async (a) => {
    a.defineTrack('ghost', { bpm: 120, bars: 1, layers: { lead: [{ t: 0, n: 60, v: 0 }, { t: 4, n: 62, v: 0 }] } });
    await a.renderTrack('ghost');
    assert.equal(sourcesOf(FakeOfflineAudioContext.last).length, 0);
    a.defineTrack('one', { bpm: 120, bars: 1, layers: { lead: [{ t: 0, n: 60, v: 0 }, { t: 4, n: 62, v: 0.5 }] } });
    await a.renderTrack('one');
    assert.ok(sourcesOf(FakeOfflineAudioContext.last).length > 0);
  });
});

test('renderTrack is deterministic, honours stems/prefix stems and caps absurd lengths', async (t) => {
  await withFakeAudio(t, async (a) => {
    const sig = async (opts) => {
      await a.renderTrack(DEMO_TRACK_ID, opts);
      return FakeOfflineAudioContext.last.starts.map((s) => `${s.kind}@${s.startedAt.toFixed(6)}`).join(',');
    };
    assert.equal(await sig({ bars: 2 }), await sig({ bars: 2 }), 'humanization is seeded by the track id');
    const names = Object.keys(DEMO_TRACK.layers);
    const gainsAt = async (opts, at = 0.5) => {
      await a.renderTrack(DEMO_TRACK_ID, { bars: 1, ...opts });
      const g = layerGains(FakeOfflineAudioContext.last);
      return Object.fromEntries(names.map((n, i) => [n, g[i].gain.valueAt(at)]));
    };
    const plain = await gainsAt({});
    assert.equal(plain.night, 0, 'stems start muted');
    assert.equal(plain.tide, 0);
    assert.equal(plain.bass, DEMO_TRACK.layers.bass.gain);
    const lit = await gainsAt({ stems: ['night'] });
    assert.equal(lit.night, DEMO_TRACK.layers.night.gain, 'stems option switches a stem on');
    assert.equal(lit.tide, 0);
    const cut = await gainsAt({ stems: { bass: false, tide: true } });
    assert.equal(cut.bass, 0, 'any layer can be forced off');
    assert.equal(cut.tide, DEMO_TRACK.layers.tide.gain);
    a.defineTrack('kit', {
      bpm: 120, bars: 1,
      layers: { 'perc.kick': { inst: 'kick', pattern: 'x...x...x...x...' }, 'perc.hat': { inst: 'hat', pattern: 'x.x.x.x.x.x.x.x.' }, lead: [{ t: 0, n: 60 }] },
    });
    const kitGains = async (stems) => {
      await a.renderTrack('kit', { stems });
      return layerGains(FakeOfflineAudioContext.last).map((g) => g.gain.valueAt(0.5));
    };
    assert.deepEqual(await kitGains(undefined), [1, 1, 1]);
    assert.deepEqual(await kitGains({ perc: false }), [0, 0, 1], 'a prefix stem covers perc.*');
    assert.deepEqual(await kitGains({ perc: false, 'perc.hat': true }), [0, 1, 1], 'an exact name beats the prefix');
    assert.deepEqual(await kitGains({ 'perc.kick': false }), [0, 1, 1], 'exact names still work alone (backwards compatible)');
    await a.renderTrack(DEMO_TRACK_ID, { bars: 1e7, sampleRate: 8000 });
    const len = FakeOfflineAudioContext.last.length / 8000;
    assert.ok(len <= 610, `render length capped (${len.toFixed(0)} s)`);
  });
});

test('live scheduling: notes land ahead of the clock and a stall never bursts stale notes', async (t) => {
  await withFakeAudio(t, async (a) => {
    await a.unlock();
    const ctx = a.context;
    assert.equal(a.playMusic(DEMO_TRACK_ID, { fade: 0 }), true);
    runUntil(t, ctx, 2);
    const first = sourcesOf(ctx);
    assert.ok(first.length > 20, `notes scheduled (${first.length})`);
    assert.ok(first.every((s) => s.startedAt >= 0.05 - 0.005), 'nothing before the track start');
    assert.ok(first.every((s) => s.startedAt <= 2 + 0.31 + 0.01), 'nothing beyond the look-ahead');
    // Main thread stalls for 10 s: the clock jumps without the timer firing.
    const mark = ctx.starts.length;
    ctx.currentTime = 12;
    t.mock.timers.tick(60);
    const after = ctx.starts.slice(mark).filter((s) => s.kind === 'osc' || s.kind === 'buffer');
    assert.ok(after.length > 0, 'music resumes after the stall');
    const stale = after.filter((s) => s.startedAt < 12 - 0.03);
    assert.equal(stale.length, 0, `no notes scheduled in the past after a stall (${stale.length} stale)`);
    const np = a.nowPlaying();
    const expectStep = Math.floor((12 - 0.05) / stepSeconds(92)) % 128;
    assert.equal(np.step, expectStep, 'position follows the audio clock');
  });
});

test('stems toggled before the downbeat apply at the downbeat; later toggles only glide the changed layer', async (t) => {
  await withFakeAudio(t, async (a) => {
    await a.unlock();
    const ctx = a.context;
    a.playMusic(DEMO_TRACK_ID, { fade: 0 });
    const targets = () => ctx.log.filter((e) => e.kind === 'target' && e.param.name === 'gain').length;
    const t0 = targets();
    a.setStem('night', true); // still before the track's start time (now + 0.05)
    assert.equal(targets(), t0, 'no layer glides from silence when a stem is set before the downbeat');
    const nightGain = DEMO_TRACK.layers.night.gain;
    const setAtStart = ctx.log.filter((e) => e.kind === 'set' && e.param.name === 'gain' && Math.abs(e.t - 0.05) < 1e-9 && e.v === nightGain);
    assert.ok(setAtStart.length >= 1, 'the night layer is switched on exactly at the downbeat');
    runUntil(t, ctx, 1);
    const t1 = targets();
    a.setStem('tide', true);
    assert.equal(targets() - t1, 1, 'only the tide layer moves');
    const t2 = targets();
    a.setStem('tide', true);
    assert.equal(targets(), t2, 'repeating a toggle schedules nothing');
    a.setMusicParam({ intensity: 0.5 });
    assert.equal(targets() - t2, 0, 'intensity without minIntensity gates moves no layer gain');
  });
});

test('live setStem: a prefix toggles every perc.* layer, exact names still win, state carries across tracks', async (t) => {
  await withFakeAudio(t, async (a) => {
    await a.unlock();
    const ctx = a.context;
    const def = {
      bpm: 120, bars: 1,
      layers: {
        'perc.kick': { inst: 'kick', pattern: 'x...x...x...x...' },
        'perc.hat': { inst: 'hat', pattern: 'x.x.x.x.x.x.x.x.' },
        lead: [{ t: 0, n: 60 }],
        night: { inst: 'glass', pattern: [{ t: 0, n: 'D5' }], stem: true },
      },
    };
    a.defineTrack('kitA', def);
    a.defineTrack('kitB', { ...def, bpm: 100 });
    a.playMusic('kitA', { fade: 0 });
    runUntil(t, ctx, 1);
    const g = () => layerGains(ctx).map((n) => +n.gain.valueAt(ctx.currentTime).toFixed(3));
    assert.deepEqual(g(), [1, 1, 1, 0]);
    assert.deepEqual(a.setStem('perc', false), []);
    runUntil(t, ctx, 3);
    assert.deepEqual(g(), [0, 0, 1, 0], 'setStem("perc", false) silences perc.kick and perc.hat');
    assert.deepEqual(a.setStem('perc.hat', true), ['perc.hat']);
    a.setStem('night', true);
    runUntil(t, ctx, 5);
    assert.deepEqual(g(), [0, 1, 1, 1], 'exact name beats the prefix; flagged stems still switch on by name');
    a.playMusic('kitB', { fade: 200 });
    runUntil(t, ctx, 7);
    assert.deepEqual(g(), [0, 1, 1, 1], 'stem state applies to the next track from its first step');
    a.setStem('perc', true);
    a.setStem('perc.hat', false);
    runUntil(t, ctx, 9);
    assert.deepEqual(g(), [1, 0, 1, 1]);
  });
});

test('sfx on a suspended context: queued right after unlock(), dropped later instead of bursting on resume', async (t) => {
  await withFakeAudio(t, async (a) => {
    const p = a.unlock();
    assert.equal(a.state, 'suspended', 'resume is still in flight');
    assert.ok(a.sfx('confirm'), 'the click that unlocked audio can still play its sound');
    await p;
    assert.equal(a.state, 'running');
    const ctx = a.context;
    ctx.currentTime = 5;
    assert.ok(a.sfx('coin'));
    await ctx.suspend();
    const realNow = Date.now;
    Date.now = () => realNow() + 60_000; // a minute later, still suspended
    let queued = 0;
    try {
      for (let i = 0; i < 100; i++) if (a.sfx(SFX_NAMES[i % SFX_NAMES.length])) queued++;
    } finally {
      Date.now = realNow;
    }
    assert.equal(queued, 0, 'nothing piles up while suspended');
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(a.state, 'running', 'sfx() asks the context to resume');
    ctx.currentTime = 6;
    assert.ok(a.sfx('coin'), 'and plays again once running');
  });
});

test('pending request before unlock: the last request wins', async (t) => {
  await withFakeAudio(t, async (a) => {
    a.defineTrack('other', { ...DEMO_TRACK, bpm: 120 });
    a.playMusic(DEMO_TRACK_ID);
    const p = a.unlock(); // graph is built synchronously; resume is still pending
    a.playMusic('other');
    await p;
    runUntil(t, a.context, 0.5);
    assert.equal(a.nowPlaying().id, 'other');
  });
});

test('stopMusic fades out, stops scheduling and releases the player; one-shots keep their tail', async (t) => {
  await withFakeAudio(t, async (a) => {
    await a.unlock();
    const ctx = a.context;
    a.playMusic(DEMO_TRACK_ID, { fade: 0 });
    runUntil(t, ctx, 1);
    assert.equal(a.stopMusic({ fade: 500 }), true);
    assert.equal(a.nowPlaying(), null);
    const mark = ctx.starts.length;
    runUntil(t, ctx, 6);
    const late = ctx.starts.slice(mark).filter((s) => s.startedAt > 1.5 + 0.01);
    assert.equal(late.length, 0, 'nothing scheduled after the fade ends');
    // One-shot: plays once, nowPlaying clears at its end, its nodes outlive the end long enough for long tails.
    a.defineTrack('sting', { bpm: 120, bars: 1, loop: false, layers: { lead: { inst: 'bell', pattern: [{ t: 15, n: 'D3', d: 16 }] } } });
    a.playMusic('sting', { fade: 0 });
    const start = ctx.currentTime + 0.05;
    const end = start + 16 * stepSeconds(120);
    runUntil(t, ctx, end - 0.1);
    assert.equal(a.nowPlaying().id, 'sting');
    assert.equal(a.nowPlaying().oneShot, true);
    runUntil(t, ctx, end + 0.2);
    assert.equal(a.nowPlaying(), null, 'one-shot ended');
    const outs = () => ctx.nodes.filter((n) => n.kind === 'gain' && n.disconnectedAt !== null && n.disconnectedAt > end - 1);
    runUntil(t, ctx, end + 3.5);
    assert.equal(outs().length, 0, 'a ringing one-shot is not cut 3 s after its end');
    runUntil(t, ctx, end + 7);
    assert.ok(outs().length >= 1, 'and is released afterwards');
  });
});

test('crossfade churn: rapid track switches never leave more than a few players scheduling', async (t) => {
  await withFakeAudio(t, async (a) => {
    await a.unlock();
    const ctx = a.context;
    a.defineTrack('b', { ...DEMO_TRACK, bpm: 130 });
    for (let i = 0; i < 50; i++) {
      a.playMusic(i % 2 ? 'b' : DEMO_TRACK_ID, { fade: 2000 });
      runUntil(t, ctx, ctx.currentTime + 0.06);
    }
    const mark = ctx.starts.length;
    const from = ctx.currentTime;
    runUntil(t, ctx, from + 1);
    const perSecond = ctx.starts.length - mark;
    const single = await (async () => {
      await a.renderTrack('b', { bars: 1 });
      return FakeOfflineAudioContext.last.starts.length / (16 * stepSeconds(130));
    })();
    assert.ok(perSecond < single * 4, `churn: ${perSecond} sources/s vs ${single.toFixed(0)}/s for one track`);
    assert.equal(a.nowPlaying().id, 'b');
  });
});

test('dispose mid-unlock, reuse after dispose and suspended contexts', async (t) => {
  await withFakeAudio(t, async (a) => {
    a.playMusic(DEMO_TRACK_ID);
    const p = a.unlock();
    await a.dispose();
    assert.equal(await p, false, 'an unlock interrupted by dispose reports false');
    assert.equal(a.ready, false);
    assert.equal(a.nowPlaying(), null);
    assert.equal(await a.unlock(), true, 'a disposed engine can be unlocked again');
    assert.equal(FakeAudioContext.instances.length, 2);
    assert.equal(FakeAudioContext.instances[0].state, 'closed', 'the old context is closed');
    const ctx = a.context;
    await ctx.suspend();
    assert.equal(a.state, 'suspended');
    assert.equal(await a.unlock(), true, 'unlock resumes a suspended context');
    a.playMusic(DEMO_TRACK_ID);
    runUntil(t, ctx, 0.5);
    assert.equal(a.nowPlaying().id, DEMO_TRACK_ID);
    a.setVolume({ master: 0.5, music: 0, sfx: 1 });
    a.mute(true);
    const mute = ctx.log.filter((e) => e.kind === 'target' && e.v === 0).length;
    assert.ok(mute >= 2, 'mute and zero music volume are scheduled on the graph');
  });
});
