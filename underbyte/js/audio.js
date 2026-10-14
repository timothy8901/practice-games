/*
 * UNDERBYTE — js/audio.js
 * Owner: AUDIO implementer. Contract: CONTRACT.md §4.6 (UB.Audio). Design: DESIGN.md §13.
 *
 * Everything is synthesized with Web Audio (oscillators + one white-noise buffer): no files.
 *
 *   graph   §13.2  voices → sfxBus → compressor ─┐
 *                  songs/ambient → musicBus → duck → dip → vis ─┼→ master → destination
 *                  send taps → feedback delay "reverb" ────────┘
 *   voices  §13.3  fixed pools of voice records (16 sfx + 24 music/ambient) reused in place;
 *                  per-voice Web Audio nodes are one-shot; ADSR exactly as specified.
 *   sfx     §13.8  one recipe function per name; rate-limited per logic frame; unknown = no-op.
 *   music   §13.4–13.7 songs are data (chords, bass/lead/arp 16th arrays, drum strings) stepped by
 *                  a 25 ms lookahead scheduler on the audio clock (seamless loop); crossfade on change.
 *   ambient §13.10 per-zone held voices + frame-counted one-shots (seeded rng, no wall clock).
 *
 * Every public method is safe with no AudioContext (headless tests never gesture): the live graph
 * `G` stays null and every entry point early-returns. Nothing in this file throws: the few places
 * that touch browser APIs that may legitimately fail are wrapped. No wall clock is read for logic —
 * the only timers are audio-clock (`ctx.currentTime`) and the scheduler's setInterval, which is
 * presentation (it keeps the loop seamless while rAF is throttled).
 */
'use strict';
(function (UB) {
  const U = UB.Util;
  const clamp = U.clamp;

  // --- constants -----------------------------------------------------------------------------
  const MAX_SFX = 16;          // §13.3 sfx voice cap (steals the oldest)
  const MAX_MUSIC = 24;        // music + ambient records (pads hold 3–4 notes per bar + releases)
  const LOOKAHEAD = 0.12;      // s, §13.5
  const SCHED_MS = 25;         // scheduler interval
  const XFADE = 0.8;           // s, song crossfade §13.4
  const NOISE_SECONDS = 2;     // §13.2 one 2 s white-noise buffer
  const AFF_TYPE = { signal: 'sine', ore: 'square', flux: 'sawtooth', cipher: 'triangle', pressure: 'square' };
  const HEAVY_FIGHTER = { brackmaw: true, korvask: true };
  /** Per-name rate limits in logic frames (§13.8): hits 3, step 6, everything else 2. */
  const RATE = { step: 6, lightHit: 3, heavyHit: 3, enemyHit: 3, bossHit: 3 };
  const SAFE_ROOM = /_rest$|^dc_shrine$/;   // §13.7 safe rooms play the zone song at 70 %

  // MIDI → Hz table (§13.4: freq = 440·2^((n−69)/12)).
  const FREQ = new Float64Array(128);
  for (let i = 0; i < 128; i++) FREQ[i] = 440 * Math.pow(2, (i - 69) / 12);
  const SEMI = Math.pow(2, 1 / 12);

  // --- module state --------------------------------------------------------------------------
  let G = null;         // the live graph (built by init() after the first gesture)
  let cur = null;       // graph voices are created in (G, or an offline graph while debugRender runs)
  let schedTimer = 0;   // setInterval handle for the lookahead scheduler

  const Audio = {
    ctx: null,            // AudioContext once init() ran after a user gesture
    ready: false,
    song: null,           // requested track id (kept even without a context)
    ambientZone: null,    // requested ambient zone id
    volumes: { master: 8, music: 7, sfx: 8 },
    muted: false,
    _lastPlay: Object.create(null), // name → frame (rate limiting)
    _loops: Object.create(null),    // name → true while a looping voice is requested
    frame: 0,
    _duck: 1,
  };

  // --- graph (§13.2) -------------------------------------------------------------------------
  /** Builds the full bus graph on `ctx`. Also used for OfflineAudioContext renders (debugRender). */
  function buildGraph(ctx) {
    const g = {
      ctx: ctx, master: ctx.createGain(), musicBus: ctx.createGain(), duckG: ctx.createGain(), dipG: ctx.createGain(),
      visG: ctx.createGain(), sfxBus: ctx.createGain(), ambBus: ctx.createGain(), comp: null,
      delay: ctx.createDelay(1.0), fb: ctx.createGain(), fbLp: ctx.createBiquadFilter(), wet: ctx.createGain(),
      noise: null, sfxPool: [], musicPool: [], stereo: typeof ctx.createStereoPanner === 'function',
      masterLevel: 1, musicLevel: 1, sfxLevel: 1, roomMult: 1,
    };
    // compressor on the sfx bus (thr −18, ratio 4, att 0.003, rel 0.25)
    try {
      g.comp = ctx.createDynamicsCompressor();
      g.comp.threshold.value = -18; g.comp.ratio.value = 4; g.comp.attack.value = 0.003; g.comp.release.value = 0.25;
      if (g.comp.knee) g.comp.knee.value = 12;
    } catch (e) { g.comp = null; }
    g.sfxBus.connect(g.comp || g.master);
    if (g.comp) g.comp.connect(g.master);
    // music chain: musicBus (setting × room) → duck → dip → vis → master
    g.musicBus.connect(g.duckG); g.duckG.connect(g.dipG); g.dipG.connect(g.visG); g.visG.connect(g.master);
    g.ambBus.gain.value = 0.6; g.ambBus.connect(g.musicBus);   // §13.10 ambient at 0.6 of the music gain
    // feedback-delay reverb: Delay 0.23 → Gain 0.38 → lowpass 2200 → back into Delay; wet 0.35 → master
    g.delay.delayTime.value = 0.23; g.fb.gain.value = 0.38;
    g.fbLp.type = 'lowpass'; g.fbLp.frequency.value = 2200;
    g.delay.connect(g.fb); g.fb.connect(g.fbLp); g.fbLp.connect(g.delay);
    g.wet.gain.value = 0.35; g.delay.connect(g.wet); g.wet.connect(g.master);
    g.master.connect(ctx.destination);
    // one 2 s white-noise buffer (§13.2) — presentation randomness, never logic
    const n = Math.floor(ctx.sampleRate * NOISE_SECONDS);
    g.noise = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = g.noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    for (let i = 0; i < MAX_SFX; i++) g.sfxPool.push(makeRecord());
    for (let i = 0; i < MAX_MUSIC; i++) g.musicPool.push(makeRecord());
    return g;
  }

  /** Voice record (fixed structs reused in place, §13.3). */
  function makeRecord() {
    return { busy: false, prio: 0, start: 0, end: 0, held: false, r: 0.1, tag: '',
      g: null, o1: null, o2: null, o3: null, src: null, lfo: null };
  }
  function freeRecord(rec) {
    rec.busy = false; rec.held = false; rec.tag = '';
    rec.g = null; rec.o1 = null; rec.o2 = null; rec.o3 = null; rec.src = null; rec.lfo = null;
  }
  /** Stop every source of a record at `t` (after a short gain ramp to avoid clicks). */
  function stopRecord(rec, t, ramp) {
    try {
      if (rec.g) { const gp = rec.g.gain; gp.cancelScheduledValues(t); gp.setValueAtTime(gp.value, t); gp.linearRampToValueAtTime(0, t + ramp); }
      const te = t + ramp + 0.005;
      if (rec.o1) rec.o1.stop(te); if (rec.o2) rec.o2.stop(te); if (rec.o3) rec.o3.stop(te);
      if (rec.src) rec.src.stop(te); if (rec.lfo) rec.lfo.stop(te);
    } catch (e) { /* a source that never started or already stopped — ignore */ }
    freeRecord(rec);
  }
  /** Release a held voice (ambient/loop) with its own release time. */
  function releaseRecord(rec) {
    if (!rec.busy) return;
    const now = G ? G.ctx.currentTime : (cur ? cur.ctx.currentTime : 0);
    stopRecord(rec, now, Math.max(0.01, rec.r));
  }
  /** Claim a record from `pool`: free records that end by `freeAt` (the new voice's start) first,
   *  else steal the oldest (prio-aware) by stopping it at now + 0.01. */
  function claim(pool, freeAt, now, prio) {
    let oldest = null;
    for (let i = 0; i < pool.length; i++) {
      const rec = pool[i];
      if (rec.busy && !rec.held && rec.end <= freeAt) freeRecord(rec);
      if (!rec.busy) return rec;
      if (rec.prio <= prio && (oldest === null || rec.start < oldest.start)) oldest = rec;
    }
    if (oldest === null) return null;           // a normal voice may not steal an important one
    stopRecord(oldest, now + 0.01, 0.01);        // §13.3: stop at t+0.01 with a 10 ms ramp
    return oldest;
  }
  function countBusy(pool, now) {
    let n = 0;
    for (let i = 0; i < pool.length; i++) { const rec = pool[i]; if (rec.busy && (rec.held || rec.end > now)) n++; }
    return n;
  }

  // --- voice (§13.3) -------------------------------------------------------------------------
  /**
   * Per-call overrides (a shared scratch object, so recipes allocate nothing). Reset by `oReset()`.
   *   when   absolute start time (0 = now + 0.005)     pan   −1..1 (0 = no panner)
   *   fMul   frequency multiplier (pitch)              vMul  volume multiplier
   *   type   oscillator type override ('' = spec)     pair  add a ±15 cent twin (Pressure affinity)
   *   prio   1 = important (ultimate/boss: steals anything)   bus   '' = spec.bus
   *   held   true = sustain until released (loops/ambient)   dur   > 0 overrides spec.dur
   *   rand   apply the ±6 cent / ±4 % humanising jitter (sfx only)
   *   f      frequency override in Hz (music notes; 0 = spec.f)   out   AudioNode to feed instead of the bus (song gain)
   */
  const O = { when: 0, pan: 0, fMul: 1, vMul: 1, type: '', pair: false, prio: 0, bus: '', held: false, dur: 0, rand: false, tag: '', f: 0, out: null };
  function oReset() { O.when = 0; O.pan = 0; O.fMul = 1; O.vMul = 1; O.type = ''; O.pair = false; O.prio = 0; O.bus = ''; O.held = false; O.dur = 0; O.rand = false; O.tag = ''; O.f = 0; O.out = null; }

  /**
   * Voice spec (§13.3), all optional but `type`:
   *   type 'sine'|'square'|'sawtooth'|'triangle'|'noise', f, detune (cents), slide {to,t} | [{to,t},…]
   *   type2/f2/f2mul/detune2/g2 (second oscillator; g2 = its gain), type3/f3mul/g3 (third)
   *   g2decay: osc2 fades to 0 over this many seconds (bell partial)
   *   ftype 'lowpass'|'highpass'|'bandpass', cut, q, cutEnv {to,t} | [{to,t},…]
   *   a d s r dur (seconds), vol, bus 'sfx'|'music'|'amb', send (0..1), pan
   *   lfo {rate, depth, target:'cut'|'freq', from}   vibrato / filter wobble
   * Returns the voice record (or null when nothing could be created).
   */
  function voice(spec) {
    const g = cur; if (!g) return null;
    const ctx = g.ctx;
    const now = ctx.currentTime;
    const t = O.when > 0 ? O.when : now + 0.005;
    const busName = O.bus || spec.bus || 'sfx';
    const pool = busName === 'sfx' ? g.sfxPool : g.musicPool;
    const rec = claim(pool, t > now ? t : now, now, O.prio);
    if (!rec) return null;
    let a = spec.a !== undefined ? spec.a : 0.005, d = spec.d !== undefined ? spec.d : 0.08;
    const s = spec.s !== undefined ? spec.s : 0, r = spec.r !== undefined ? spec.r : 0.12;
    let dur = O.dur > 0 ? O.dur : (spec.dur !== undefined ? spec.dur : 0.1);
    let vol = (spec.vol !== undefined ? spec.vol : 0.3) * O.vMul;
    let fMul = O.fMul;
    if (O.rand) {  // §13.3: ±6 cents and ±4 % duration so repeats never sound machine-gunned
      fMul *= Math.pow(2, (Math.random() * 12 - 6) / 1200);
      const dm = 1 + (Math.random() * 0.08 - 0.04); d *= dm; dur *= dm;
    }
    try {
      const gain = ctx.createGain();
      const gp = gain.gain;
      gp.setValueAtTime(0, t);
      gp.linearRampToValueAtTime(vol, t + a);
      gp.linearRampToValueAtTime(vol * s, t + a + d);
      let end;
      if (O.held) { end = Infinity; }
      else {
        gp.setValueAtTime(vol * s, t + a + d + dur);
        gp.linearRampToValueAtTime(0, t + a + d + dur + r);
        end = t + a + d + dur + r + 0.02;
      }
      // filter
      let head = gain;   // node the sources connect to
      const cut = spec.cut || 0;
      let flt = null;
      if (cut > 0) {
        flt = ctx.createBiquadFilter();
        flt.type = spec.ftype || 'lowpass';
        flt.Q.value = spec.q !== undefined ? spec.q : 1;
        flt.frequency.setValueAtTime(cut, t);
        if (spec.cutEnv) rampParam(flt.frequency, cut, spec.cutEnv, t);
        flt.connect(gain); head = flt;
      }
      // output: pan? → bus (+ send tap → reverb)
      const bus = busName === 'sfx' ? g.sfxBus : busName === 'amb' ? g.ambBus : g.musicBus;
      let out = gain;
      if (O.pan !== 0 && g.stereo) {
        const pn = ctx.createStereoPanner(); pn.pan.value = clamp(O.pan, -1, 1); gain.connect(pn); out = pn;
      }
      out.connect(O.out || bus);
      const send = spec.send || 0;
      if (send > 0) { const sg = ctx.createGain(); sg.gain.value = send; gain.connect(sg); sg.connect(g.delay); }
      // sources
      const type = O.type || spec.type;
      const stopAt = end === Infinity ? 0 : end + 0.01;
      if (type === 'noise') {
        const src = ctx.createBufferSource(); src.buffer = g.noise; src.loop = true;
        src.connect(head); src.start(t); if (stopAt) src.stop(stopAt);
        rec.src = src;
      } else {
        const f = (O.f > 0 ? O.f : (spec.f || 220)) * fMul;
        const o1 = ctx.createOscillator(); o1.type = type;
        o1.frequency.setValueAtTime(f, t);
        if (spec.detune) o1.detune.value = spec.detune + (O.pair ? 15 : 0); else if (O.pair) o1.detune.value = 15;
        if (spec.slide) rampParam(o1.frequency, f, spec.slide, t, fMul);
        o1.connect(head); o1.start(t); if (stopAt) o1.stop(stopAt);
        rec.o1 = o1;
        if (spec.type2 || O.pair) {
          const o2 = ctx.createOscillator();
          o2.type = O.pair && !spec.type2 ? type : spec.type2;
          const f2 = O.pair && !spec.type2 ? f : (spec.f2 ? spec.f2 * fMul : f * (spec.f2mul || 1));
          o2.frequency.setValueAtTime(f2, t);
          if (O.pair && !spec.type2) o2.detune.value = -15; else if (spec.detune2) o2.detune.value = spec.detune2;
          if (spec.slide && !(O.pair && !spec.type2)) rampParam(o2.frequency, f2, spec.slide, t, fMul * f2 / f);
          const g2 = spec.g2 !== undefined ? spec.g2 : 1;
          if (g2 !== 1 || spec.g2decay) {
            const gg = ctx.createGain(); gg.gain.setValueAtTime(g2, t);
            if (spec.g2decay) gg.gain.linearRampToValueAtTime(0, t + a + spec.g2decay);
            o2.connect(gg); gg.connect(head);
          } else o2.connect(head);
          o2.start(t); if (stopAt) o2.stop(stopAt);
          rec.o2 = o2;
        }
        if (spec.type3) {
          const o3 = ctx.createOscillator(); o3.type = spec.type3;
          o3.frequency.setValueAtTime(f * (spec.f3mul || 0.5), t);
          const g3 = spec.g3 !== undefined ? spec.g3 : 1;
          if (g3 !== 1) { const gg = ctx.createGain(); gg.gain.value = g3; o3.connect(gg); gg.connect(head); } else o3.connect(head);
          o3.start(t); if (stopAt) o3.stop(stopAt);
          rec.o3 = o3;
        }
      }
      if (spec.lfo && (spec.lfo.target !== 'freq' || rec.o1)) {   // vibrato / filter wobble
        const lf = spec.lfo;
        const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = lf.rate;
        const lg = ctx.createGain();
        const fBase = (O.f > 0 ? O.f : (spec.f || 220)) * fMul;
        lg.gain.value = lf.target === 'freq' ? fBase * (Math.pow(2, lf.depth / 1200) - 1) : lf.depth;
        lfo.connect(lg);
        if (lf.target === 'freq') { lg.connect(rec.o1.frequency); if (rec.o2 && spec.type2) lg.connect(rec.o2.frequency); }
        else if (flt) lg.connect(flt.frequency);
        lfo.start(t + (lf.from || 0)); if (stopAt) lfo.stop(stopAt);
        rec.lfo = lfo;
      }
      rec.busy = true; rec.prio = O.prio; rec.start = t; rec.end = end; rec.held = O.held; rec.r = r; rec.g = gain; rec.tag = O.tag;
      return rec;
    } catch (e) {
      freeRecord(rec);
      return null;
    }
  }
  /** Exponential ramp(s) of an AudioParam from `from` through one or more {to, t} stages. */
  function rampParam(param, from, env, t, mul) {
    mul = mul || 1;
    let at = t;
    if (Array.isArray(env)) {
      for (let i = 0; i < env.length; i++) { at += env[i].t; param.exponentialRampToValueAtTime(Math.max(1, env[i].to * mul), at); }
    } else param.exponentialRampToValueAtTime(Math.max(1, env.to * mul), t + env.t);
  }

  // --- SFX recipes (§13.8) -------------------------------------------------------------------
  // Every spec is a constant (no per-call allocation); recipes vary them through `O`.
  const SP = {
    jump:       { type: 'sine', f: 300, slide: { to: 620, t: 0.09 }, a: 0.003, d: 0.06, s: 0, r: 0.05, dur: 0, vol: 0.25 },
    jumpHi:     { type: 'sine', f: 420, slide: { to: 900, t: 0.09 }, a: 0.003, d: 0.06, s: 0, r: 0.05, dur: 0, vol: 0.25 },
    landNoise:  { type: 'noise', cut: 500, a: 0.002, d: 0.07, s: 0, r: 0.02, dur: 0, vol: 0.2 },
    landThump:  { type: 'sine', f: 90, a: 0.002, d: 0.05, s: 0, r: 0.03, dur: 0, vol: 0.2 },
    landHeavy:  { type: 'sine', f: 60, a: 0.002, d: 0.07, s: 0, r: 0.04, dur: 0, vol: 0.3 },
    step:       { type: 'noise', cut: 400, a: 0.002, d: 0.03, s: 0, r: 0.01, dur: 0, vol: 0.06 },
    dashSaw:    { type: 'sawtooth', f: 180, slide: { to: 60, t: 0.12 }, cut: 1400, a: 0.003, d: 0.12, s: 0, r: 0.04, dur: 0, vol: 0.22 },
    dashNoise:  { type: 'noise', ftype: 'highpass', cut: 6000, cutEnv: { to: 800, t: 0.12 }, a: 0.003, d: 0.12, s: 0, r: 0.03, dur: 0, vol: 0.14 },
    wallSlide:  { type: 'noise', ftype: 'bandpass', cut: 1200, q: 2, a: 0.05, d: 0.02, s: 1, r: 0.08, vol: 0.08 },
    lightHit:   { type: 'sine', f: 520, slide: { to: 260, t: 0.06 }, a: 0.002, d: 0.07, s: 0, r: 0.03, dur: 0, vol: 0.3, send: 0.12 },
    lightHit2:  { type: 'sine', f: 560, slide: { to: 280, t: 0.06 }, a: 0.002, d: 0.07, s: 0, r: 0.03, dur: 0, vol: 0.3, send: 0.12 },
    lightHit3:  { type: 'sine', f: 620, slide: { to: 310, t: 0.06 }, a: 0.002, d: 0.11, s: 0, r: 0.03, dur: 0, vol: 0.32, send: 0.12 },
    hitNoise:   { type: 'noise', cut: 3000, a: 0.001, d: 0.03, s: 0, r: 0.02, dur: 0, vol: 0.15 },
    heavyHit:   { type: 'sine', f: 220, slide: { to: 70, t: 0.14 }, a: 0.003, d: 0.14, s: 0, r: 0.05, dur: 0, vol: 0.4, send: 0.12 },
    heavyNoise: { type: 'noise', cut: 900, a: 0.002, d: 0.12, s: 0, r: 0.03, dur: 0, vol: 0.3 },
    sub55:      { type: 'sine', f: 55, a: 0.003, d: 0.2, s: 0, r: 0.05, dur: 0, vol: 0.3 },
    spTessik:   { type: 'sine', f: 880, slide: { to: 1760, t: 0.15 }, a: 0.005, d: 0.15, s: 0, r: 0.1, dur: 0, vol: 0.25, send: 0.5 },
    spBrack:    { type: 'square', f: 90, slide: { to: 40, t: 0.3 }, cut: 700, a: 0.005, d: 0.3, s: 0, r: 0.08, dur: 0, vol: 0.3 },
    spBrackN:   { type: 'noise', cut: 800, a: 0.005, d: 0.25, s: 0, r: 0.05, dur: 0, vol: 0.2 },
    spVellix:   { type: 'sawtooth', f: 400, slide: { to: 2400, t: 0.08 }, cut: 5000, a: 0.003, d: 0.08, s: 0, r: 0.04, dur: 0, vol: 0.22 },
    spOrrubel:  { type: 'triangle', f: 1200, a: 0.002, d: 0.05, s: 0, r: 0.03, dur: 0, vol: 0.2, send: 0.2 },
    spKorvask:  { type: 'square', f: 150, cut: 1200, a: 0.003, d: 0.1, s: 0, r: 0.03, dur: 0, vol: 0.25 },
    ocPulse:    { type: 'sine', f: 48, a: 0.005, d: 0.4, s: 0, r: 0.05, dur: 0, vol: 0.4 },
    whiff:      { type: 'noise', ftype: 'highpass', cut: 2000, a: 0.002, d: 0.05, s: 0, r: 0.02, dur: 0, vol: 0.08 },
    pogo:       { type: 'triangle', f: 700, slide: { to: 1200, t: 0.06 }, a: 0.002, d: 0.06, s: 0, r: 0.04, dur: 0, vol: 0.22 },
    hurt:       { type: 'square', f: 300, slide: { to: 120, t: 0.18 }, cut: 1600, a: 0.003, d: 0.18, s: 0, r: 0.05, dur: 0, vol: 0.35 },
    hurtNoise:  { type: 'noise', cut: 1200, a: 0.002, d: 0.1, s: 0, r: 0.03, dur: 0, vol: 0.25 },
    death:      { type: 'sawtooth', f: 440, slide: { to: 40, t: 0.9 }, cut: 3000, cutEnv: { to: 200, t: 0.9 }, a: 0.005, d: 0.9, s: 0, r: 0.1, dur: 0, vol: 0.3 },
    deathBurst: { type: 'noise', cut: 2500, a: 0.002, d: 0.12, s: 0, r: 0.04, dur: 0, vol: 0.2 },
    spike:      { type: 'noise', ftype: 'bandpass', cut: 2500, q: 3, a: 0.002, d: 0.08, s: 0, r: 0.03, dur: 0, vol: 0.3 },
    spikeTri:   { type: 'triangle', f: 900, slide: { to: 300, t: 0.1 }, a: 0.002, d: 0.1, s: 0, r: 0.03, dur: 0, vol: 0.2 },
    enemyHit:   { type: 'sine', f: 400, slide: { to: 200, t: 0.05 }, a: 0.002, d: 0.05, s: 0, r: 0.03, dur: 0, vol: 0.2, send: 0.12 },
    enemyDeath: { type: 'square', f: 240, slide: { to: 60, t: 0.25 }, cut: 1500, a: 0.003, d: 0.25, s: 0, r: 0.05, dur: 0, vol: 0.25 },
    enemyDeathN:{ type: 'noise', cut: 2000, a: 0.002, d: 0.15, s: 0, r: 0.04, dur: 0, vol: 0.2 },
    blip:       { type: 'sine', f: 1320, a: 0.002, d: 0.04, s: 0, r: 0.03, dur: 0, vol: 0.1 },
    pickupBit:  { type: 'sine', f: 1320, a: 0.002, d: 0.06, s: 0, r: 0.03, dur: 0, vol: 0.18 },
    energyArp:  { type: 'triangle', f: 660, a: 0.002, d: 0.05, s: 0, r: 0.04, dur: 0, vol: 0.2, send: 0.3 },
    healNote:   { type: 'sine', f: 523, a: 0.05, d: 0.6, s: 0, r: 0.1, dur: 0, vol: 0.15, send: 0.4 },
    coreSweep:  { type: 'sine', f: 1047, slide: { to: 2093, t: 0.8 }, a: 0.01, d: 0.8, s: 0, r: 0.2, dur: 0, vol: 0.15, send: 0.4 },
    kick:       { type: 'sine', f: 150, slide: { to: 42, t: 0.11 }, a: 0.002, d: 0.2, s: 0, r: 0.05, dur: 0, vol: 0.5 },
    restorePad: { type: 'square', f: 110, cut: 500, a: 0.3, d: 0.8, s: 0, r: 0.2, dur: 0, vol: 0.15, send: 0.3 },
    restoreSwp: { type: 'noise', cut: 200, cutEnv: { to: 3000, t: 1.0 }, a: 0.2, d: 0.8, s: 0, r: 0.2, dur: 0, vol: 0.08 },
    ocOnSub:    { type: 'sine', f: 55, slide: { to: 110, t: 0.25 }, a: 0.005, d: 0.3, s: 0, r: 0.1, dur: 0, vol: 0.5 },
    ocOnSweep:  { type: 'sawtooth', f: 220, slide: { to: 1760, t: 0.4 }, cut: 400, cutEnv: { to: 6000, t: 0.4 }, a: 0.005, d: 0.4, s: 0, r: 0.1, dur: 0, vol: 0.25, send: 0.2 },
    ocOnRev:    { type: 'noise', ftype: 'highpass', cut: 1000, a: 0.3, d: 0.05, s: 0, r: 0.02, dur: 0, vol: 0.2 },
    ocEnd:      { type: 'sawtooth', f: 880, slide: { to: 110, t: 0.5 }, cut: 5000, cutEnv: { to: 200, t: 0.5 }, a: 0.005, d: 0.5, s: 0, r: 0.1, dur: 0, vol: 0.2 },
    ocWarn:     { type: 'sine', f: 880, a: 0.002, d: 0.05, s: 0, r: 0.03, dur: 0, vol: 0.12 },
    deny:       { type: 'square', f: 150, cut: 1200, a: 0.002, d: 0.08, s: 0, r: 0.02, dur: 0, vol: 0.15 },
    menuMove:   { type: 'triangle', f: 740, a: 0.002, d: 0.04, s: 0, r: 0.03, dur: 0, vol: 0.12 },
    menuNote:   { type: 'sine', f: 660, a: 0.002, d: 0.12, s: 0, r: 0.04, dur: 0, vol: 0.18 },
    menuBack:   { type: 'triangle', f: 500, slide: { to: 330, t: 0.08 }, a: 0.002, d: 0.08, s: 0, r: 0.03, dur: 0, vol: 0.12 },
    abilityNote:{ type: 'sine', f: 440, a: 0.01, d: 1.0, s: 0, r: 0.2, dur: 0, vol: 0.14, send: 0.5 },
    roar:       { type: 'sawtooth', f: 80, detune: 20, type2: 'sawtooth', f2mul: 1, detune2: -20, slide: [{ to: 160, t: 0.3 }, { to: 60, t: 0.6 }],
                  cut: 200, cutEnv: [{ to: 1800, t: 0.3 }, { to: 300, t: 0.6 }], a: 0.02, d: 0.9, s: 0, r: 0.15, dur: 0, vol: 0.45, send: 0.2 },
    roarNoise:  { type: 'noise', cut: 400, a: 0.1, d: 0.6, s: 0, r: 0.1, dur: 0, vol: 0.3 },
    roarSub:    { type: 'sine', f: 40, a: 0.01, d: 0.8, s: 0, r: 0.1, dur: 0, vol: 0.4 },
    bossHit:    { type: 'square', f: 180, slide: { to: 90, t: 0.08 }, cut: 1500, a: 0.002, d: 0.08, s: 0, r: 0.03, dur: 0, vol: 0.3, send: 0.12 },
    bossHitN:   { type: 'noise', ftype: 'bandpass', cut: 900, a: 0.002, d: 0.06, s: 0, r: 0.02, dur: 0, vol: 0.2 },
    bossDie:    { type: 'sawtooth', f: 220, slide: { to: 20, t: 2.5 }, cut: 2000, cutEnv: { to: 100, t: 2.5 }, a: 0.01, d: 2.5, s: 0, r: 0.2, dur: 0, vol: 0.3 },
    bossDieN:   { type: 'noise', cut: 300, a: 0.5, d: 1.5, s: 0, r: 0.2, dur: 0, vol: 0.3 },
    transN:     { type: 'noise', cut: 300, cutEnv: [{ to: 2000, t: 0.15 }, { to: 300, t: 0.15 }], a: 0.02, d: 0.28, s: 0, r: 0.05, dur: 0, vol: 0.12 },
    transTone:  { type: 'sine', f: 220, slide: { to: 330, t: 0.3 }, a: 0.01, d: 0.3, s: 0, r: 0.05, dur: 0, vol: 0.08 },
    crumble:    { type: 'noise', cut: 800, a: 0.005, d: 0.3, s: 0, r: 0.05, dur: 0, vol: 0.2 },
    bolt:       { type: 'triangle', f: 1000, slide: { to: 500, t: 0.07 }, a: 0.002, d: 0.07, s: 0, r: 0.03, dur: 0, vol: 0.15 },
    heart1:     { type: 'sine', f: 50, a: 0.003, d: 0.12, s: 0, r: 0.03, dur: 0, vol: 0.35 },
    heart2:     { type: 'sine', f: 45, a: 0.003, d: 0.1, s: 0, r: 0.03, dur: 0, vol: 0.25 },
    saveTri:    { type: 'triangle', f: 1320, a: 0.002, d: 0.2, s: 0, r: 0.05, dur: 0, vol: 0.1 },
  };

  function game() { return UB.game || null; }
  function player() { const g = game(); return g && g.player ? g.player : null; }
  /** Set O.type / O.pair from the current fighter's affinity (§13.8 "affinity type"). */
  function aff() {
    const p = player();
    const k = p && p.data && p.data.affinity ? p.data.affinity : 'signal';
    O.type = AFF_TYPE[k] || 'sine'; O.pair = k === 'pressure';
  }
  function clearAff() { O.type = ''; O.pair = false; }
  /** Positional pan (§13.3): clamp((x − camCenter)/480, −1, 1)·0.6; 0 when x is not given. */
  function panFor(x) {
    if (typeof x !== 'number' || !isFinite(x)) return 0;
    const g = game(); if (!g || !g.cam) return 0;
    return clamp((x - (g.cam.x + 480)) / 480, -1, 1) * 0.6;
  }
  /** Schedule the next voice `dt` seconds after the recipe's start (`base`). */
  function at(base, dt) { O.when = base + dt; }
  function heavyFighter() { const p = player(); return !!(p && HEAVY_FIGHTER[p.id]); }
  /** Music-bus dip (§13.8 hurt/overclockOn): instant drop to `mult`, back to 1 over `seconds`. */
  function dip(mult, seconds) {
    if (!G) return;
    try {
      const gp = G.dipG.gain, now = G.ctx.currentTime;
      gp.cancelScheduledValues(now); gp.setValueAtTime(mult, now); gp.linearRampToValueAtTime(1, now + seconds);
    } catch (e) { /* ignore */ }
  }
  const bitCombo = { last: -1000, n: 0 };   // pickupBit pitch climb (frame-based, §13.8)

  // Recipe functions: `b` = start time (absolute), `pan` already resolved. They may set O fields
  // before each voice(); `sfxPlay` resets O between names.
  function recHeal(b, pan, vMul) {
    O.pan = pan; O.vMul = vMul;
    at(b, 0); voice(SP.healNote);
    at(b, 0.08); O.fMul = 659 / 523; voice(SP.healNote);
    at(b, 0.16); O.fMul = 784 / 523; voice(SP.healNote);
    O.fMul = 1;
  }
  function recMenuConfirm(b) {
    at(b, 0); voice(SP.menuNote); at(b, 0.05); O.fMul = 1.5; voice(SP.menuNote); O.fMul = 1;
  }
  function recPickupBit(b, pan, semis, vMul) {
    O.pan = pan; O.vMul = vMul; O.rand = true;
    const m = Math.pow(SEMI, semis);
    at(b, 0); O.fMul = m; voice(SP.pickupBit);
    at(b, 0.04); O.fMul = m * 1760 / 1320; voice(SP.pickupBit);
    O.fMul = 1;
  }
  function recHeavyHit(b, pan, fMul) {
    aff(); O.pan = pan; O.rand = true; O.fMul = fMul; voice(SP.heavyHit); clearAff();
    voice(SP.heavyNoise); O.fMul = 1; voice(SP.sub55);
  }
  function recRoar(b, pitch) {
    O.prio = 1; O.fMul = pitch;
    at(b, 0); voice(SP.roar); voice(SP.roarNoise); voice(SP.roarSub);
    O.fMul = 1;
  }
  function recSpecial(b, pan, fMul, vMul) {
    const p = player(); const id = p ? p.id : 'tessik';
    O.pan = pan; O.fMul = fMul; O.vMul = vMul; O.rand = true;
    switch (id) {
      case 'brackmaw': at(b, 0); voice(SP.spBrack); voice(SP.spBrackN); break;
      case 'vellix': at(b, 0); voice(SP.spVellix); break;
      case 'orrubel': at(b, 0); voice(SP.spOrrubel); at(b, 0.06); voice(SP.spOrrubel); at(b, 0.12); voice(SP.spOrrubel); break;
      case 'korvask': O.pair = true; at(b, 0); voice(SP.spKorvask); at(b, 0.1); O.fMul = fMul * 2; voice(SP.spKorvask); O.pair = false; break;
      default: at(b, 0); voice(SP.spTessik); break;
    }
    O.fMul = 1; O.vMul = 1;
  }

  /** name → recipe(b, pan, x). Unknown names are a silent no-op (CONTRACT §4.6). */
  const RECIPES = {
    jump: function (b, pan) { aff(); O.pan = pan; O.rand = true; voice(SP.jump); },
    doubleJump: function (b, pan) {
      aff(); O.pan = pan; O.rand = true; voice(SP.jumpHi);
      clearAff(); O.fMul = 2; O.vMul = 0.48; voice(SP.jumpHi);   // + one octave up at 0.12 vol
    },
    land: function (b, pan) {
      O.pan = pan; O.rand = true; voice(SP.landNoise);
      voice(heavyFighter() ? SP.landHeavy : SP.landThump);
    },
    step: function (b, pan) { O.pan = pan; O.rand = true; voice(SP.step); },
    dash: function (b, pan) { O.pan = pan; O.rand = true; voice(SP.dashSaw); voice(SP.dashNoise); },
    lightHit: function (b, pan) {
      const p = player(); const mv = p ? p.moveName : '';
      aff(); O.pan = pan; O.rand = true;
      voice(mv === 'light3' ? SP.lightHit3 : mv === 'light2' ? SP.lightHit2 : SP.lightHit);
      clearAff(); voice(SP.hitNoise);
    },
    heavyHit: function (b, pan) { recHeavyHit(b, pan, 1); },
    special: function (b, pan) { recSpecial(b, pan, 1, 1); },
    ultimate: function (b, pan) {
      O.prio = 1; recSpecial(b, pan, 1, 1);
      O.prio = 1; recSpecial(b, pan, Math.pow(SEMI, 7), 0.8);       // doubled +7 semitones
      O.prio = 1; at(b, 0); O.pan = 0; voice(SP.ocPulse);           // overclockPulse
    },
    whiff: function (b, pan) { O.pan = pan; O.rand = true; voice(SP.whiff); },
    pogo: function (b, pan) { O.pan = pan; O.rand = true; voice(SP.pogo); },
    hurt: function (b, pan) { O.rand = true; voice(SP.hurt); voice(SP.hurtNoise); dip(0.6, 0.9); },
    death: function (b) {
      O.prio = 1; voice(SP.death);
      at(b, 0); voice(SP.deathBurst); at(b, 0.25); voice(SP.deathBurst); at(b, 0.5); voice(SP.deathBurst);
    },
    spike: function (b, pan) { O.pan = pan; O.rand = true; voice(SP.spike); voice(SP.spikeTri); },
    enemyHit: function (b, pan) { aff(); O.pan = pan; O.rand = true; voice(SP.enemyHit); },
    enemyDeath: function (b, pan) {
      O.pan = pan; O.rand = true; voice(SP.enemyDeath); voice(SP.enemyDeathN);
      O.rand = false;
      for (let i = 0; i < 4; i++) { at(b, 0.03 * i); O.fMul = Math.pow(SEMI, i * 3); voice(SP.blip); }
      O.fMul = 1;
    },
    pickupBit: function (b, pan) {
      // +2 semitones per bit collected within 0.5 s (30 logic frames), max +12
      if (Audio.frame - bitCombo.last <= 30) bitCombo.n = Math.min(6, bitCombo.n + 1); else bitCombo.n = 0;
      bitCombo.last = Audio.frame;
      recPickupBit(b, pan, bitCombo.n * 2, 1);
    },
    energy: function (b, pan) {
      O.pan = pan;
      at(b, 0); voice(SP.energyArp); at(b, 0.05); O.fMul = 880 / 660; voice(SP.energyArp); at(b, 0.1); O.fMul = 2; voice(SP.energyArp);
      O.fMul = 1;
    },
    heal: function (b, pan) { recHeal(b, pan, 1); },
    core: function (b, pan) { recHeal(b, pan, 1); at(b, 0); O.pan = 0; voice(SP.coreSweep); voice(SP.kick); },
    restore: function (b, pan) {
      at(b, 0); voice(SP.restorePad); recHeal(b, 0, 1);
      at(b, 0.3); voice(SP.restoreSwp);
    },
    overclockOn: function (b) {
      O.prio = 1; at(b, 0); voice(SP.ocOnSub); voice(SP.ocOnSweep); voice(SP.ocOnRev);
      dip(0.3, 0.4);
    },
    overclockEnd: function (b) { voice(SP.ocEnd); },
    overclockWarn: function (b) { voice(SP.ocWarn); },
    deny: function (b) { at(b, 0); voice(SP.deny); at(b, 0.14); voice(SP.deny); },
    menuMove: function (b) { voice(SP.menuMove); },
    menuConfirm: function (b) { recMenuConfirm(b); },
    menuBack: function (b) { voice(SP.menuBack); },
    ability: function (b) {
      O.prio = 1;
      at(b, 0); voice(SP.abilityNote); at(b, 0.06); O.fMul = 554 / 440; voice(SP.abilityNote);
      at(b, 0.12); O.fMul = 659 / 440; voice(SP.abilityNote); at(b, 0.18); O.fMul = 2; voice(SP.abilityNote);
      O.fMul = 1; at(b, 0); voice(SP.kick);
    },
    bossRoar: function (b, pan) { recRoar(b, 1); },
    bossHit: function (b, pan) { O.pan = pan; O.rand = true; voice(SP.bossHit); voice(SP.bossHitN); },
    bossPhase: function (b, pan) { recRoar(b, 1.3); O.prio = 1; at(b, 0); voice(SP.ocOnSweep); },
    bossDeath: function (b, pan) {
      O.prio = 1;
      for (let i = 0; i < 6; i++) { at(b, 0.12 * i); O.prio = 1; recHeavyHit(b, 0, Math.pow(0.8, i)); }
      O.prio = 1; at(b, 0); voice(SP.bossDie); voice(SP.bossDieN);
    },
    roomTransition: function (b) { voice(SP.transN); voice(SP.transTone); },
    crumble: function (b, pan) {
      O.pan = pan; voice(SP.crumble);
      for (let i = 0; i < 3; i++) { at(b, 0.08 * i); O.vMul = 0.6; voice(SP.landNoise); voice(SP.landThump); }
      O.vMul = 1;
    },
    platformMove: function () { /* silent by design (§13.8) */ },
    wallSlide: function (b, pan) { O.pan = pan; O.dur = 0.12; voice(SP.wallSlide); },   // one-shot form; the player uses loop('wallSlide')
    turretShot: function (b, pan) { O.pan = pan; O.rand = true; voice(SP.bolt); },
    bolt: function (b, pan) { O.pan = pan; O.rand = true; voice(SP.bolt); },
    heartbeat: function (b) { at(b, 0); voice(SP.heart1); at(b, 0.21); voice(SP.heart2); },
    vendorBuy: function (b) {
      for (let i = 0; i < 3; i++) { recPickupBit(b + 0.07 * i, 0, i * 4, 0.8); }
      recMenuConfirm(b + 0.22);
    },
    save: function (b) { recMenuConfirm(b); at(b, 0.1); voice(SP.saveTri); },
  };

  /** Core sfx entry: rate limit, resolve pan, run the recipe inside the live graph. */
  function sfxPlay(name, x, force) {
    const rec = RECIPES[name];
    if (!rec) return;
    if (!force) {
      const last = Audio._lastPlay[name];
      const lim = RATE[name] || 2;
      if (last !== undefined && Audio.frame - last < lim) return;   // §13.8 dropped, not queued
    }
    Audio._lastPlay[name] = Audio.frame;
    if (!cur) return;
    const b = cur.ctx.currentTime + 0.005;
    oReset(); O.when = b;
    try { rec(b, panFor(x), x); } catch (e) { /* never throw out of audio */ }
    oReset();
  }

  // --- music engine (§13.4–13.7) -------------------------------------------------------------
  const VOICING = { m: [0, 3, 7], M: [0, 4, 7], m7: [0, 3, 7, 10], sus2: [0, 2, 7], dim: [0, 3, 6], M7: [0, 4, 7, 11], Moct: [0, 4, 7, 12] };
  /** Instrument recipes (§13.6). `bus:'music'` voices are routed through the song's own gain. */
  const INST = {
    pad:     { type: 'sawtooth', detune: 7, type2: 'sawtooth', f2mul: 1, detune2: -7, type3: 'triangle', f3mul: 0.5, g3: 0.8,
               cut: 520, q: 0.7, cutEnv: { to: 900, t: 1.2 }, a: 0.4, d: 0.3, s: 0.85, r: 0.6, vol: 0.11, bus: 'music', send: 0.3 },
    padDark: { type: 'square', detune: 12, type2: 'square', f2mul: 1, detune2: -12, cut: 380, q: 0.8, a: 0.4, d: 0.3, s: 0.85, r: 0.6,
               vol: 0.09, bus: 'music', send: 0.3, lfo: { rate: 0.15, depth: 120, target: 'cut' } },
    bass:    { type: 'triangle', type2: 'square', f2mul: 0.5, g2: 0.4, cut: 300, a: 0.01, d: 0.1, s: 0.6, r: 0.08, vol: 0.22, bus: 'music' },
    bassSaw: { type: 'sawtooth', cut: 1800, cutEnv: { to: 700, t: 0.08 }, a: 0.005, d: 0.12, s: 0.4, r: 0.05, vol: 0.2, bus: 'music' },
    lead:    { type: 'sine', type2: 'triangle', f2mul: 1, g2: 0.5, cut: 2400, a: 0.02, d: 0.15, s: 0.5, r: 0.25, vol: 0.14, bus: 'music', send: 0.25,
               lfo: { rate: 5.5, depth: 6, target: 'freq', from: 0.25 } },
    bell:    { type: 'sine', type2: 'sine', f2mul: 2.76, g2: 0.3, g2decay: 0.25, a: 0.003, d: 0.5, s: 0, r: 0.6, dur: 0, vol: 0.13, bus: 'music', send: 0.4 },
    pluck:   { type: 'square', cut: 3000, cutEnv: { to: 600, t: 0.12 }, a: 0.003, d: 0.18, s: 0, r: 0.1, dur: 0, vol: 0.1, bus: 'music', send: 0.2 },
    pulse:   { type: 'square', cut: 900, a: 0.002, d: 0.06, s: 0, r: 0.04, dur: 0, vol: 0.08, bus: 'music' },
    kick:    { type: 'sine', f: 150, slide: { to: 42, t: 0.11 }, a: 0.002, d: 0.2, s: 0, r: 0.05, dur: 0, vol: 0.5, bus: 'music' },
    snareN:  { type: 'noise', ftype: 'bandpass', cut: 1800, q: 0.8, a: 0.002, d: 0.14, s: 0, r: 0.03, dur: 0, vol: 0.3, bus: 'music', send: 0.1 },
    snareT:  { type: 'triangle', f: 180, a: 0.002, d: 0.06, s: 0, r: 0.02, dur: 0, vol: 0.2, bus: 'music' },
    hat:     { type: 'noise', ftype: 'highpass', cut: 7000, a: 0.002, d: 0.035, s: 0, r: 0.01, dur: 0, vol: 0.14, bus: 'music' },
    hatOpen: { type: 'noise', ftype: 'highpass', cut: 7000, a: 0.002, d: 0.18, s: 0, r: 0.03, dur: 0, vol: 0.14, bus: 'music' },
    drone:   { type: 'sine', type2: 'sine', f2mul: 1.005, type3: 'sawtooth', f3mul: 0.5, g3: 0.6, cut: 200, a: 2.0, d: 0.5, s: 1, r: 1.5, vol: 0.1, bus: 'music' },
    droneRW: { type: 'sine', type2: 'sine', f2mul: 1.005, type3: 'sawtooth', f3mul: 0.5, g3: 0.6, cut: 290, a: 2.0, d: 0.5, s: 1, r: 1.5, vol: 0.1, bus: 'music',
               lfo: { rate: 0.1, depth: 130, target: 'cut' } },
    clank:   { type: 'noise', ftype: 'bandpass', cut: 3200, q: 6, a: 0.002, d: 0.12, s: 0, r: 0.04, dur: 0, vol: 0.12, bus: 'music', send: 0.3 },
    swell:   { type: 'noise', cut: 600, a: 1.5, d: 0.05, s: 0, r: 0.1, dur: 0, vol: 0.12, bus: 'music' },
  };

  // Song data helpers (run once at load; songs are plain arrays of 128 16th-note entries).
  function bar(a) { if (a.length !== 16) throw new Error('bar length'); return a; }
  function seq(bars8) { const out = []; for (let i = 0; i < 8; i++) { const b = bar(bars8[i]); for (let j = 0; j < 16; j++) out.push(b[j]); } return out; }
  function tr(b, n) { const o = new Array(16); for (let i = 0; i < 16; i++) o[i] = b[i] > 0 ? b[i] + n : b[i]; return o; }
  function rev(b) { const o = new Array(16); for (let i = 0; i < 16; i++) o[i] = b[15 - i]; return o; }
  function rep(b) { return [b, b, b, b, b, b, b, b]; }

  // TITLE — "Boot Sequence" · 80 BPM · D major (lydian colour) · pad + lead + soft bass, no drums.
  const T1 = [74, -1, -1, -1, 78, -1, -1, -1, 81, -1, -1, -1, -1, -1, 80, -1], T2 = [78, -1, -1, -1, -1, -1, -1, -1, 76, -1, -1, -1, 74, -1, -1, -1];
  // DRIFTCACHE arp (2-bar pattern) · NULLSPIRE lead (4-bar phrase) · BRINEVAULT bells · LOOMWORKS lead · BOSS stabs
  const DA = [62, 0, 65, 0, 69, 0, 72, 0, 69, 0, 65, 0, 62, 0, 69, 0], DB = [65, 0, 69, 0, 72, 0, 76, 0, 72, 0, 69, 0, 65, 0, 60, 0];
  const N1 = [0, 0, 0, 0, 71, -1, 74, -1, 76, -1, -1, -1, 74, -1, 71, -1], N2 = [72, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 67, -1, 69, -1];
  const N3 = [71, -1, -1, -1, 74, -1, -1, -1, 79, -1, -1, -1, -1, -1, 78, -1], N4 = [74, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0];
  const BA = [78, 0, 81, 0, 85, 0, 81, 0, 78, 0, 85, 0, 90, 0, 85, 0];
  const B1 = [81, -1, -1, -1, -1, -1, -1, -1, 85, -1, -1, -1, -1, -1, -1, -1], B2 = [86, -1, -1, -1, -1, -1, -1, -1, 85, -1, -1, -1, 81, -1, -1, -1];
  const B3 = [80, -1, -1, -1, -1, -1, -1, -1, 83, -1, -1, -1, -1, -1, -1, -1], B4 = [85, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
  const L1 = [67, -1, -1, -1, 70, -1, -1, -1, 74, -1, -1, -1, 72, -1, 70, -1], L2 = [67, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 65, -1, 67, -1];
  const L3 = [70, -1, -1, -1, 72, -1, -1, -1, 75, -1, -1, -1, -1, -1, 74, -1], L4 = [72, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0];
  const F1 = [69, -1, 0, 0, 0, 0, 69, -1, 0, 0, 72, -1, 0, 0, 71, -1], F2 = [69, -1, 0, 0, 0, 0, 0, 0, 76, -1, 0, 0, 75, -1, 0, 0];
  const F3 = [77, -1, 0, 0, 0, 0, 77, -1, 0, 0, 76, -1, 0, 0, 72, -1], F4 = [71, -1, 0, 0, 0, 0, 68, -1, 0, 0, 0, 0, 69, -1, 0, 0];
  const F8 = [80, -1, -1, -1, 79, -1, -1, -1, 76, -1, -1, -1, 75, -1, 71, -1];

  /**
   * Songs (§13.7). roots = pad voicing root per bar (MIDI); kinds = chord kind; bass entries are
   * semitone offsets from the bar root placed in octave 2 (36 + root % 12); lead entries absolute;
   * arp entries absolute, written for `arpRef` and transposed by (root − arpRef) per bar.
   * drums: 8 strings of 16 (`k` kick, `s` snare, `h` hat, `o` open hat, `.` rest).
   */
  const SONGS = {
    title: { name: 'Boot Sequence', bpm: 80, bars: 8, roots: [62, 57, 59, 55, 62, 57, 64, 55], kinds: ['M', 'M', 'm', 'M', 'M', 'M', 'm', 'M'],
      pad: 'pad', bassInst: 'bass', leadInst: 'lead',
      bass: seq(rep([0, -1, -1, -1, -1, -1, -1, -1, 7, -1, -1, -1, -1, -1, -1, -1])),
      lead: seq([T1, T2, [71, -1, -1, -1, 74, -1, -1, -1, 78, -1, -1, -1, -1, -1, -1, -1], [79, -1, -1, -1, 78, -1, 76, -1, 74, -1, -1, -1, -1, -1, -1, -1],
        T1, T2, [76, -1, -1, -1, 79, -1, -1, -1, 83, -1, -1, -1, 81, -1, 79, -1], [78, -1, -1, -1, -1, -1, -1, -1, 0, 0, 0, 0, 74, -1, -1, -1]]),
      arp: null, drums: null },
    driftcache: { name: 'Idle Loop', bpm: 72, bars: 8, roots: [62, 62, 55, 62, 65, 60, 62, 57], kinds: ['m7', 'm7', 'M', 'm7', 'M7', 'M', 'm7', 'm'],
      pad: 'pad', bassInst: 'bass', arpInst: 'pluck', arpRef: 62, drone: 38, droneVol: 0.5,
      bass: seq([[0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 7, -1, 0, 0, 0, 0], [0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 7, -1, 0, 0, 0, 0], [0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 7, -1, 0, 0, 0, 0],
        [0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 7, -1, 0, 0, 0, 0], [0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 7, -1, 0, 0, 0, 0], [0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 7, -1, 0, 0, 0, 0],
        [0, -1, -1, -1, 0, 0, 0, 0, 0, 0, 7, -1, 0, 0, 0, 0], [0, -1, -1, -1, 0, 0, 0, 0, 12, -1, 10, -1, 7, -1, -1, -1]]),
      lead: null, arp: seq([DA, DB, DA, DB, DA, DB, DA, DB]),
      drums: rep('..h...h...h...h.') },
    loomworks: { name: 'Pressure Line', bpm: 104, bars: 8, roots: [55, 55, 51, 53, 55, 58, 51, 50], kinds: ['m', 'm', 'M', 'M', 'm', 'M', 'M', 'M'],
      pad: 'padDark', bassInst: 'bassSaw', leadInst: 'lead',
      bass: seq(rep([0, 0, 0, -1, 0, 0, 12, -1, 0, 0, 0, -1, 10, -1, 7, -1])),
      lead: seq([L1, L2, L3, L4, tr(L1, 7), tr(L2, 7), tr(L3, 7), tr(L4, 7)]), arp: null,
      drums: ['k..hs..hk.khs..h', 'k..hs..hk.khs..h', 'k..hs..hk.khs..h', 'k..hs..hk.khs..h', 'k..hs..hk.khs..h', 'k..hs..hk.khs..h', 'k..hs..hk.khs..h', 'k..hs..hk.k.s.ss'],
      extra: function (inst, step, bar_, sub, t) { if (sub === 4 && (bar_ & 1) === 1) { O.when = t; voice(INST.clank); } } },
    brinevault: { name: 'Facets', bpm: 96, bars: 8, roots: [66, 62, 57, 64, 66, 59, 62, 61], kinds: ['m', 'M', 'M', 'M', 'm', 'M', 'M', 'm'],
      pad: 'pad', bassInst: 'bass', leadInst: 'bell', arpInst: 'bell', arpRef: 66,
      bass: seq(rep([0, -1, -1, -1, -1, -1, 0, -1, 7, -1, -1, -1, 5, -1, 3, -1])),
      lead: seq([B1, B2, B3, B4, tr(B1, -12), tr(B2, -12), tr(B3, -12), tr(B4, -12)]),
      arp: seq([BA, BA, BA, BA, BA, BA, BA, rev(BA)]),
      drums: ['..h.h...h.h...h.', '..h.h...h.h...h.', '..h.h...h.h...h.', '..h.h...h.h...ho', '..h.h...h.h...h.', '..h.h...h.h...h.', '..h.h...h.h...h.', '..h.h...h.h...ho'] },
    nullspire: { name: 'Unanswered', bpm: 84, bars: 8, roots: [52, 48, 55, 50, 52, 57, 48, 59], kinds: ['m', 'M', 'M', 'M', 'm', 'm', 'M', 'm'],
      pad: 'pad', bassInst: 'bass', leadInst: 'lead', arpInst: 'pluck', arpRef: 52,
      bass: seq([[0, -1, 0, 0, 7, -1, 0, 0, 0, -1, 0, 0, 10, -1, 7, -1], [0, -1, 0, 0, 7, -1, 0, 0, 0, -1, 0, 0, 10, -1, 7, -1], [0, -1, 0, 0, 7, -1, 0, 0, 0, -1, 0, 0, 10, -1, 7, -1],
        [0, -1, 0, 0, 7, -1, 0, 0, 0, -1, 0, 0, 10, -1, 7, -1], [0, -1, 0, 0, 7, -1, 0, 0, 0, -1, 0, 0, 10, -1, 7, -1], [0, -1, 0, 0, 7, -1, 0, 0, 0, -1, 0, 0, 10, -1, 7, -1],
        [0, -1, 0, 0, 7, -1, 0, 0, 0, -1, 0, 0, 10, -1, 7, -1], [0, -1, 0, 0, 7, -1, 0, 0, 12, -1, 10, -1, 7, -1, 5, -1]]),
      lead: seq([N1, N2, N3, N4, N1, N2, N3, N4]),
      arp: seq(rep([52, 0, 0, 0, 0, 0, 55, 0, 0, 0, 59, 0, 0, 0, 0, 0])),
      drums: ['k...h...k...h...', 'k...h...k...h...', 'k...h...k...h...', 'k...h...k...h...', 'k...h...k...h...', 'k...h...k...h...', 'k...h...k...h...', 'k...h...k.k.h.o.'] },
    rootwell: { name: 'Null Pointer', bpm: 60, bars: 8, roots: [48, 49, 48, 46, 48, 49, 44, 43], kinds: ['m', 'M', 'm', 'm', 'm', 'M', 'M', 'dim'],
      pad: 'padDark', bassInst: 'bass', arpInst: 'pulse', arpRef: 48, drone: 36, droneVol: 1, droneInst: 'droneRW',
      bass: seq(rep([0, -1, -1, -1, -1, -1, -1, -1, 0, -1, -1, -1, 1, -1, 0, -1])), lead: null,
      arp: seq(rep([48, 0, 0, 49, 0, 0, 55, 0, 0, 48, 0, 0, 51, 0, 0, 0])),
      drums: ['kk..............', 'kk..............', 'kk..............', 'k.......k.....k.', 'kk..............', 'kk..............', 'kk..............', 'k.......k.....k.'],
      extra: function (inst, step, bar_, sub, t) { if (step === inst.total - 6) { O.when = t; voice(INST.swell); } } },
    boss: { name: 'Fault Handler', bpm: 150, bpm2: 158, bars: 8, roots: [57, 57, 53, 52, 57, 50, 53, 52], kinds: ['m', 'm', 'M', 'M', 'm', 'm', 'M', 'M'],
      pad: 'padDark', bassInst: 'bassSaw', leadInst: 'lead', p2: true,
      bass: seq([[0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 12, -1], [0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 12, -1], [0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 12, -1],
        [0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 12, -1], [0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 12, -1], [0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 12, -1],
        [0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 0, -1, 12, -1], [0, -1, 0, -1, 0, -1, 0, -1, 12, -1, 11, -1, 8, -1, 7, -1]]),
      lead: seq([F1, F2, F3, F4, F1, F2, F3, F8]), arp: null,
      drums: ['k.h.s.h.k.h.s.h.', 'k.h.s.h.k.h.s.h.', 'k.h.s.h.k.h.s.h.', 'k.h.s.h.k.h.s.h.', 'k.h.s.h.k.h.s.h.', 'k.h.s.h.k.h.s.h.', 'k.h.s.h.k.h.s.h.', 'k.h.s.h.k.k.s.ss'] },
    victory: { name: 'Finale', bpm: 48, bars: 4, roots: [54, 54, 54, 54], kinds: ['Moct', 'Moct', 'Moct', 'Moct'], pad: 'pad', hold: true,
      bass: null, lead: null, arp: null, drums: null },
  };
  for (const id in SONGS) { const S = SONGS[id]; S.id = id; S.total = 16 * S.bars; if (!S.droneVol) S.droneVol = 1; }

  /** Scheduler instances (two: the current song and the one fading out). Fixed structs. */
  function makeInst() {
    return { active: false, song: null, id: null, bpm: 0, stepTime: 0, total: 0, step: 0, next: 0, gain: null, endAt: 0, p2: false, drone: null, droneOn: false };
  }
  let curInst = makeInst(), fadeInst = makeInst();

  /** Duration (in steps) of the note starting at `i` in `track` (follows −1 ties, wraps). */
  function noteSteps(track, i, total) {
    let n = 1;
    while (n < 64 && track[(i + n) % total] === -1) n++;
    return n;
  }
  function playNote(inst, spec, note, t, steps) {
    if (note <= 0 || note > 127) return;
    O.when = t; O.f = FREQ[note]; O.bus = 'music'; O.out = inst.gain;
    O.dur = spec.s > 0 ? Math.max(0.01, steps * inst.stepTime - spec.a - spec.d - spec.r) : 0;
    voice(spec);
  }
  function playDrum(inst, ch, t) {
    O.when = t; O.bus = 'music'; O.out = inst.gain; O.dur = 0; O.f = 0;
    if (ch === 'k') voice(INST.kick);
    else if (ch === 's') { voice(INST.snareN); voice(INST.snareT); }
    else if (ch === 'h') voice(INST.hat);
    else if (ch === 'o') voice(INST.hatOpen);
  }
  /** Schedule every track's events for 16th `step` at audio time `t` (§13.5 scheduleStep). */
  function scheduleStep(inst, step, t) {
    const S = inst.song, total = inst.total;
    const bar_ = (step >> 4) % S.bars, sub = step & 15;
    const root = S.roots[bar_];
    oReset();
    // pad: one voice per chord note for the bar (released 0.1 s before the next bar)
    if (S.pad && sub === 0 && (!S.hold || step === 0)) {
      const spec = INST[S.pad], vo = VOICING[S.kinds[bar_]];
      const len = S.hold ? inst.stepTime * total : inst.stepTime * 16;
      for (let i = 0; i < vo.length; i++) {
        O.when = t; O.f = FREQ[root + vo[i]]; O.bus = 'music'; O.out = inst.gain;
        O.dur = Math.max(0.05, len - 0.1 - spec.a - spec.d - spec.r);
        voice(spec);
      }
      oReset();
    }
    if (S.bass) {
      const e = S.bass[step];
      if (e >= 0) {   // 0 is a note here (the root offset), −1 a tie
        const note = 36 + (root % 12) + e;
        const n = noteSteps(S.bass, step, total);
        playNote(inst, INST[S.bassInst], note, t, n);
        if (S.p2 && inst.p2) playNote(inst, INST.pulse, note + 12, t, 1);   // phase 2: pulse doubles the bass an octave up
      }
    }
    if (S.lead) {
      const e = S.lead[step];
      if (e > 0) playNote(inst, INST[S.leadInst], e + (S.p2 && inst.p2 ? 12 : 0), t, noteSteps(S.lead, step, total));
    }
    if (S.arp) {
      const e = S.arp[step];
      if (e > 0) playNote(inst, INST[S.arpInst], e + root - S.arpRef, t, noteSteps(S.arp, step, total));
    }
    if (S.drums) {
      let ch = S.drums[bar_].charAt(sub);
      if (ch !== '.') {
        if (S.p2 && inst.p2 && ch === 'h' && (sub & 3) === 2) ch = 'o';   // phase 2: open hats on the off-beats
        playDrum(inst, ch, t);
      }
    }
    if (S.extra) { oReset(); O.bus = 'music'; O.out = inst.gain; S.extra(inst, step, bar_, sub, t); }
    oReset();
  }
  function tickInst(inst, now) {
    if (!inst.active) return;
    if (inst.next < now - 0.25) inst.next = now + 0.05;   // §13.1: fell behind (throttled/suspended) → resync, no catch-up burst
    let guard = 0;
    while (inst.next < now + LOOKAHEAD && guard++ < 48) {
      scheduleStep(inst, inst.step, inst.next);
      inst.next += inst.stepTime;
      inst.step = (inst.step + 1) % inst.total;    // wrap = seamless loop
    }
  }
  function schedTick() {
    if (!G) return;
    cur = G;
    const now = G.ctx.currentTime;
    try {
      tickInst(curInst, now); tickInst(fadeInst, now);
      if (fadeInst.active && now >= fadeInst.endAt) stopInst(fadeInst, 0);
    } catch (e) { /* never throw out of a timer */ }
  }
  /** Fade an instance out over `secs` and mark when it may be dropped. */
  function fadeOutInst(inst, secs) {
    if (!inst.active || !G) return;
    const now = G.ctx.currentTime;
    try { const gp = inst.gain.gain; gp.cancelScheduledValues(now); gp.setValueAtTime(gp.value, now); gp.linearRampToValueAtTime(0, now + secs); } catch (e) { /* ignore */ }
    inst.endAt = now + secs + 0.05;
    if (inst.drone) { releaseRecord(inst.drone); inst.drone = null; }
  }
  function stopInst(inst, secs) {
    if (!inst.active) return;
    if (secs > 0 && G) {
      fadeOutInst(inst, secs);
      // keep stepping until the fade ends (schedTick drops it at endAt)
      return;
    }
    try { if (inst.gain) inst.gain.disconnect(); } catch (e) { /* ignore */ }
    if (inst.drone) { releaseRecord(inst.drone); inst.drone = null; }
    inst.active = false; inst.song = null; inst.id = null; inst.gain = null; inst.p2 = false;
  }
  function setInstTempo(inst, bpm) { inst.bpm = bpm; inst.stepTime = 60 / bpm / 4; }
  /** Start song `id` on the live graph, crossfading from whatever plays (§13.4). */
  function startSong(id, fadeIn) {
    const S = SONGS[id];
    if (!S || !G) return;
    cur = G;
    const now = G.ctx.currentTime;
    if (fadeInst.active) stopInst(fadeInst, 0);                 // a third song during a fade: drop the fading one
    if (curInst.active) { const tmp = fadeInst; fadeInst = curInst; curInst = tmp; fadeOutInst(fadeInst, XFADE); }
    const inst = curInst;
    inst.active = true; inst.song = S; inst.id = id; inst.total = S.total; inst.step = 0; inst.p2 = false;
    setInstTempo(inst, S.bpm);
    inst.next = now + 0.05;
    try {
      inst.gain = G.ctx.createGain();
      inst.gain.gain.setValueAtTime(0.0001, now);
      inst.gain.gain.linearRampToValueAtTime(1, now + (fadeIn > 0 ? fadeIn : 0.02));
      inst.gain.connect(G.musicBus);
    } catch (e) { inst.active = false; return; }
    // song-level drone (Driftcache D2, Rootwell C2) and the final boss's drone (§13.7)
    let droneNote = S.drone || 0, droneSpec = INST[S.droneInst || 'drone'], droneVol = S.droneVol;
    const g = game();
    if (id === 'boss' && g && g.zone && g.zone.id === 'rootwell') { droneNote = 36; droneSpec = INST.droneRW; droneVol = 1; }
    if (droneNote) {
      oReset(); O.when = now + 0.05; O.f = FREQ[droneNote]; O.bus = 'music'; O.out = inst.gain; O.held = true; O.vMul = droneVol; O.tag = 'drone';
      inst.drone = voice(droneSpec); oReset();
    }
    tickInst(inst, now);
  }

  // --- ambient layers (§13.10) ---------------------------------------------------------------
  const AMB = {
    hum55:    { type: 'sine', f: 55, a: 1.0, d: 0.2, s: 1, r: 0.8, vol: 0.04, bus: 'amb' },
    dust:     { type: 'noise', cut: 1200, a: 0.002, d: 0.05, s: 0, r: 0.02, dur: 0, vol: 0.08, bus: 'amb' },
    rattle:   { type: 'noise', ftype: 'bandpass', cut: 2400, q: 3, a: 0.002, d: 0.12, s: 0, r: 0.03, dur: 0, vol: 0.1, bus: 'amb' },
    sawSweep: { type: 'sawtooth', f: 120, slide: { to: 480, t: 0.6 }, cut: 900, a: 0.05, d: 0.6, s: 0, r: 0.1, dur: 0, vol: 0.06, bus: 'amb' },
    drip:     { type: 'sine', f: 1000, a: 0.002, d: 0.09, s: 0, r: 0.04, dur: 0, vol: 0.1, bus: 'amb', send: 0.5 },
    bubble:   { type: 'noise', ftype: 'bandpass', cut: 200, q: 1.2, a: 1.0, d: 0.2, s: 1, r: 0.8, vol: 0.05, bus: 'amb', lfo: { rate: 0.35, depth: 80, target: 'cut' } },
    beat:     { type: 'sine', f: 880, type2: 'sine', f2: 884, g2: 1, a: 1.5, d: 0.2, s: 1, r: 1.0, vol: 0.03, bus: 'amb' },
    crackle:  { type: 'noise', ftype: 'highpass', cut: 3000, a: 0.001, d: 0.03, s: 0, r: 0.01, dur: 0, vol: 0.12, bus: 'amb' },
    descend:  { type: 'triangle', f: 110, slide: { to: 55, t: 1.5 }, a: 0.05, d: 1.5, s: 0, r: 0.2, dur: 0, vol: 0.08, bus: 'amb' },
    thump1:   { type: 'sine', f: 50, a: 0.003, d: 0.12, s: 0, r: 0.03, dur: 0, vol: 0.25, bus: 'amb' },
    thump2:   { type: 'sine', f: 50, a: 0.003, d: 0.1, s: 0, r: 0.03, dur: 0, vol: 0.18, bus: 'amb' },
    choir:    { type: 'triangle', f: FREQ[42], detune: 4, type2: 'triangle', f2: FREQ[49], detune2: -5, type3: 'triangle', f3mul: FREQ[54] / FREQ[42], g3: 0.8,
                cut: 600, a: 2.0, d: 0.5, s: 1, r: 1.5, vol: 0.02, bus: 'amb' },
  };
  const RW_ORDER = { rw_gate: 0, rw_rest: 1, rw_throne: 2 };
  /** Ambient state: held voice records, a seeded rng and frame timers (logic frames, never wall clock). */
  const amb = { zone: null, h0: null, h1: null, rng: null, t: 0, nextA: 0, nextB: 0, moverSign: new Int8Array(32), choirT: 0 };
  let lastRoomId = '';

  function zoneSeed(zoneId) {
    const z = UB.World && UB.World.zones ? UB.World.zones[zoneId] : null;
    return 1000003 * ((z && z.index) || 1) + 17;
  }
  function stopAmbientVoices() {
    if (amb.h0) { releaseRecord(amb.h0); amb.h0 = null; }
    if (amb.h1) { releaseRecord(amb.h1); amb.h1 = null; }
  }
  function ambHeld(spec, vMul) {
    oReset(); O.held = true; O.bus = 'amb'; O.vMul = vMul || 1; O.tag = 'amb';
    const r = voice(spec); oReset(); return r;
  }
  /** Create the held voices + timers for `amb.zone` on the live graph. */
  function startAmbientVoices() {
    if (!G || !amb.zone) return;
    cur = G;
    amb.rng = U.rng(zoneSeed(amb.zone)); amb.t = 0; amb.choirT = 0;
    for (let i = 0; i < amb.moverSign.length; i++) amb.moverSign[i] = 0;
    switch (amb.zone) {
      case 'driftcache': amb.h0 = ambHeld(AMB.hum55, 1); amb.nextA = 60 + Math.floor(amb.rng() * 180); break;
      case 'loomworks': amb.nextA = 240; break;
      case 'brinevault': amb.h0 = ambHeld(AMB.bubble, 1); amb.nextA = 24 + Math.floor(amb.rng() * 96); break;
      case 'nullspire': amb.h0 = ambHeld(AMB.beat, 1); amb.nextA = 60 + Math.floor(amb.rng() * 180); amb.nextB = 360; break;
      case 'rootwell': amb.h0 = ambHeld(AMB.choir, 1); amb.nextA = 36; break;
      default: break;
    }
  }
  function ambOne(spec, pan, f) {
    oReset(); O.bus = 'amb'; O.pan = pan || 0; if (f) O.f = f; O.rand = true;
    voice(spec); oReset();
  }
  /** Per-frame ambient tick (called from update() with the live graph current). */
  function ambientTick(g) {
    if (!amb.zone || !amb.rng) return;
    amb.t++;
    const rng = amb.rng;
    switch (amb.zone) {
      case 'driftcache':   // dust tick every 180–360 f
        if (amb.t >= amb.nextA) { ambOne(AMB.dust, 0, 0); amb.nextA = amb.t + 180 + Math.floor(rng() * 181); }
        break;
      case 'loomworks': {  // chain rattle when a mover reverses (panned to it); saw sweep every 480 f
        const lv = g && g.level;
        if (lv && lv.platforms) {
          const n = Math.min(lv.platforms.length, amb.moverSign.length);
          for (let i = 0; i < n; i++) {
            const p = lv.platforms[i];
            const sg = p.dx > 0.01 ? 1 : p.dx < -0.01 ? -1 : (p.dy > 0.01 ? 2 : p.dy < -0.01 ? -2 : 0);
            const prev = amb.moverSign[i];
            if (sg !== 0 && prev !== 0 && sg === -prev) ambOne(AMB.rattle, panFor(p.x + p.w * 0.5), 0);
            if (sg !== 0) amb.moverSign[i] = sg;
          }
        }
        if (amb.t >= amb.nextA) { ambOne(AMB.sawSweep, 0, 0); amb.nextA = amb.t + 480; }
        break;
      }
      case 'brinevault':   // drips at a random pitch 800–1600 Hz every 24–120 f
        if (amb.t >= amb.nextA) { ambOne(AMB.drip, (rng() - 0.5) * 0.8, 800 + rng() * 800); amb.nextA = amb.t + 24 + Math.floor(rng() * 97); }
        break;
      case 'nullspire':    // static crackle every 60–240 f; descending bass note every 720 f
        if (amb.t >= amb.nextA) { ambOne(AMB.crackle, (rng() - 0.5) * 1.2, 0); amb.nextA = amb.t + 60 + Math.floor(rng() * 181); }
        if (amb.t >= amb.nextB) { ambOne(AMB.descend, 0, 0); amb.nextB = amb.t + 720; }
        break;
      case 'rootwell': {   // heartbeat every 72 f; choir swells toward the throne
        if (amb.t >= amb.nextA) {
          oReset(); O.bus = 'amb'; const b = G.ctx.currentTime + 0.005;
          O.when = b; voice(AMB.thump1); O.when = b + 0.15; voice(AMB.thump2); oReset();
          amb.nextA = amb.t + 72;
        }
        if (amb.h0 && amb.h0.busy && ++amb.choirT > 160 && (amb.choirT % 15) === 0) {
          const room = g && g.level ? g.level.room : null, pl = g ? g.player : null;
          let prog = 0;
          if (room && RW_ORDER[room.id] !== undefined) prog = (RW_ORDER[room.id] + (pl ? clamp(pl.x / (room.w * 30), 0, 1) : 0)) / 3;
          try { amb.h0.g.gain.setTargetAtTime(0.02 + 0.06 * prog, G.ctx.currentTime, 0.5); } catch (e) { /* ignore */ }
        }
        break;
      }
      default: break;
    }
  }

  // --- levels, ducking, visibility -----------------------------------------------------------
  const SFX_MAKEUP = 2.0;   // brings hits to the §13.9 targets (≈ −8 dBFS at settings 8/7/8) before the compressor
  const MUSIC_TRIM = 0.75;  // keeps song peaks near −14 dBFS at music 7 (kicks/pads stack in the busy songs)
  function applyLevels(g, instant) {
    const v = Audio.volumes;
    g.masterLevel = Audio.muted ? 0 : Math.pow(clamp(v.master, 0, 10) / 10, 2);
    g.musicLevel = Math.pow(clamp(v.music, 0, 10) / 10, 2) * MUSIC_TRIM;
    g.sfxLevel = Math.pow(clamp(v.sfx, 0, 10) / 10, 2) * SFX_MAKEUP;
    try {
      if (instant) { g.master.gain.value = g.masterLevel; g.musicBus.gain.value = g.musicLevel * g.roomMult; g.sfxBus.gain.value = g.sfxLevel; return; }
      const now = g.ctx.currentTime;
      g.master.gain.setTargetAtTime(g.masterLevel, now, 0.03);
      g.musicBus.gain.setTargetAtTime(g.musicLevel * g.roomMult, now, 0.03);
      g.sfxBus.gain.setTargetAtTime(g.sfxLevel, now, 0.03);
    } catch (e) { /* ignore */ }
  }
  function onVisibility() {
    if (!G) return;
    try {
      const now = G.ctx.currentTime, gp = G.visG.gain;
      gp.cancelScheduledValues(now); gp.setValueAtTime(gp.value, now);
      if (document.hidden) gp.linearRampToValueAtTime(0, now + 0.1);           // §13.1 hidden: music → 0 over 0.1 s
      else { gp.linearRampToValueAtTime(1, now + 0.3); Audio.resume(); }       // visible: back over 0.3 s + resume
    } catch (e) { /* ignore */ }
  }
  if (typeof document !== 'undefined') { try { document.addEventListener('visibilitychange', onVisibility); } catch (e) { /* ignore */ } }

  // --- public API (CONTRACT §4.6) ------------------------------------------------------------
  /** Create the context on the first user gesture (the engine wires UB.Input.onGesture → init). Idempotent; resumes. */
  Audio.init = function () {
    if (Audio.ready) { Audio.resume(); return; }
    let ctx = null;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    } catch (e) { ctx = null; }
    Audio.ready = true;
    if (!ctx) return;                       // no Web Audio: everything stays a silent no-op
    try {
      Audio.ctx = ctx;
      G = buildGraph(ctx); cur = G;
      applyLevels(G, true);
      G.duckG.gain.value = Audio._duck;
      if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) { /* ignore */ } }
      if (schedTimer) clearInterval(schedTimer);
      schedTimer = setInterval(schedTick, SCHED_MS);
      if (Audio.song) startSong(Audio.song, 0.3);
      if (Audio.ambientZone) { amb.zone = Audio.ambientZone; startAmbientVoices(); }
      for (const k in Audio._loops) if (Audio._loops[k] === true) { Audio._loops[k] = startLoopVoice(k); }
    } catch (e) { G = null; cur = null; Audio.ctx = null; }
  };
  /** Resume a suspended context (idempotent, cheap). */
  Audio.resume = function () {
    if (!G) return;
    try { if (G.ctx.state !== 'running' && G.ctx.resume) G.ctx.resume(); } catch (e) { /* ignore */ }
  };
  /** Fire a one-shot SFX by recipe name (§13.8); x = world x for panning. Unknown names: silent no-op. */
  Audio.sfx = function (name, x) {
    if (typeof name !== 'string') return;
    if (G) cur = G;
    sfxPlay(name, x, false);
  };
  Audio.play = Audio.sfx;   // alias used by DESIGN.md
  const LOOP_SPECS = { wallSlide: SP.wallSlide };
  function startLoopVoice(name) {
    const spec = LOOP_SPECS[name];
    if (!spec || !G) return true;
    cur = G; oReset(); O.held = true; O.bus = 'sfx'; O.tag = name;
    const r = voice(spec); oReset();
    return r || true;
  }
  /** Looping voices (`wallSlide`): on=true starts if not running, false stops. Idempotent; unknown = no-op. */
  Audio.loop = function (name, on) {
    if (!LOOP_SPECS[name]) return;
    const curr = Audio._loops[name];
    if (on) {
      if (curr) { if (G && (curr === true || !curr.busy)) Audio._loops[name] = startLoopVoice(name); return; }
      Audio._loops[name] = startLoopVoice(name);
    } else if (curr) {
      if (curr !== true) releaseRecord(curr);
      delete Audio._loops[name];
    }
  };
  Audio.stopLoops = function () { for (const k in Audio._loops) Audio.loop(k, false); };
  /** Start (or crossfade to) a song (UB.IDS.songs); null stops. The same id never restarts. */
  Audio.music = function (trackId) {
    if (!trackId) { Audio.stopMusic(); return; }
    if (typeof trackId !== 'string' || !SONGS[trackId]) return;
    Audio.song = trackId;
    if (!G) return;
    if (curInst.active && curInst.id === trackId) return;
    try { startSong(trackId, curInst.active ? XFADE : 0.3); } catch (e) { /* ignore */ }
  };
  Audio.stopMusic = function () {
    if (G) cur = G;
    Audio.song = null;
    if (!G || !curInst.active) return;
    try {
      if (fadeInst.active) stopInst(fadeInst, 0);
      const tmp = fadeInst; fadeInst = curInst; curInst = tmp;
      fadeOutInst(fadeInst, 0.5);
    } catch (e) { /* ignore */ }
  };
  /** Zone ambient SFX layer (§13.10): started on zone entry, stopped on zone change / title. */
  Audio.ambient = function (zoneId) {
    if (G) cur = G;
    zoneId = zoneId || null;
    if (zoneId === Audio.ambientZone && (!G || zoneId === amb.zone)) return;
    Audio.ambientZone = zoneId;
    if (!G) return;
    try { stopAmbientVoices(); amb.zone = zoneId; startAmbientVoices(); } catch (e) { /* ignore */ }
  };
  Audio.stopAmbient = function () {
    if (G) cur = G;
    Audio.ambientZone = null;
    if (!G) { amb.zone = null; return; }
    try { stopAmbientVoices(); } catch (e) { /* ignore */ }
    amb.zone = null; amb.rng = null;
  };
  /** Volumes are 0–10 integers (DESIGN §14.2); any subset may be passed. The engine persists them. */
  Audio.setVolumes = function (v) {
    if (!v) return;
    if (v.master !== undefined && isFinite(v.master)) Audio.volumes.master = clamp(Math.round(v.master), 0, 10);
    if (v.music !== undefined && isFinite(v.music)) Audio.volumes.music = clamp(Math.round(v.music), 0, 10);
    if (v.sfx !== undefined && isFinite(v.sfx)) Audio.volumes.sfx = clamp(Math.round(v.sfx), 0, 10);
    if (G) applyLevels(G, false);
  };
  /** Convenience: set one volume through the engine's settings (persisted) when a game exists. */
  Audio.setVolume = function (key, value) {
    if (key !== 'master' && key !== 'music' && key !== 'sfx') return;
    const g = game();
    if (g && typeof g.setSetting === 'function') { try { g.setSetting(key, clamp(Math.round(value), 0, 10)); return; } catch (e) { /* fall through */ } }
    const o = {}; o[key] = value; Audio.setVolumes(o);
  };
  /** Music duck multiplier (1 play, 0.4 paused/menus, 0 game-over fade) reached over `seconds`. */
  Audio.duck = function (mult, seconds) {
    mult = clamp(isFinite(mult) ? mult : 1, 0, 1); seconds = isFinite(seconds) && seconds > 0 ? seconds : 0.2;
    Audio._duck = mult;
    if (!G) return;
    try {
      const gp = G.duckG.gain, now = G.ctx.currentTime;
      gp.cancelScheduledValues(now); gp.setValueAtTime(gp.value, now); gp.linearRampToValueAtTime(mult, now + seconds);
    } catch (e) { /* ignore */ }
  };
  Audio.mute = function () { Audio.muted = true; if (G) applyLevels(G, false); };
  Audio.unmute = function () { Audio.muted = false; if (G) applyLevels(G, false); };
  Audio.toggleMute = function () { if (Audio.muted) Audio.unmute(); else Audio.mute(); return Audio.muted; };
  /** Once per logic frame (engine): rate-limit clock, boss phase-2 variant, safe-room level, ambient timers. */
  Audio.update = function () {
    Audio.frame++;
    if (!G) return;
    cur = G;
    const g = game();
    try {
      if (curInst.active && curInst.song.p2) {
        const b = g ? g.boss : null;
        const p2 = !!(b && !b.dead && (b.phase >= 2 || b.enraged));
        if (p2 !== curInst.p2) { curInst.p2 = p2; setInstTempo(curInst, p2 ? curInst.song.bpm2 : curInst.song.bpm); }
      }
      const rid = g && g.level && g.level.room ? g.level.room.id : '';
      if (rid !== lastRoomId) {
        lastRoomId = rid;
        const m = SAFE_ROOM.test(rid) ? 0.7 : 1;
        if (m !== G.roomMult) { G.roomMult = m; G.musicBus.gain.setTargetAtTime(G.musicLevel * m, G.ctx.currentTime, 0.3); }
      }
      ambientTick(g);
    } catch (e) { /* never throw out of the tick */ }
  };
  /** Test hook (DESIGN §13.9 / CONTRACT §4.6). */
  Audio.state = function () {
    const now = G ? G.ctx.currentTime : 0;
    return {
      ctxState: G ? G.ctx.state : 'none',
      voices: G ? countBusy(G.sfxPool, now) + countBusy(G.musicPool, now) : 0,
      song: Audio.song, playing: curInst.active ? curInst.id : null,
      step: curInst.active ? curInst.step : 0, bpm: curInst.active ? curInst.bpm : 0, phase2: curInst.p2,
      ambient: Audio.ambientZone, loops: Object.keys(Audio._loops), muted: Audio.muted, volumes: Audio.volumes, duck: Audio._duck,
    };
  };
  /** Direct voice access (DESIGN §13.3 `UB.Audio.voice(spec)`) for modules that want a private sound. */
  Audio.voice = function (spec) {
    if (!G || !spec) return null;
    cur = G; oReset();
    let r = null;
    try { r = voice(spec); } catch (e) { r = null; }
    oReset(); return r;
  };
  Audio.sfxNames = function () { return Object.keys(RECIPES); };
  Audio.songs = SONGS;

  /**
   * Test hook: renders `name` (an sfx recipe or a song id) into an OfflineAudioContext for
   * `seconds` and resolves with the peak absolute sample value of the mix (post master).
   * Resolves −1 when OfflineAudioContext is unavailable. Never throws, never needs a gesture.
   */
  Audio.debugRender = function (name, seconds) {
    seconds = isFinite(seconds) && seconds > 0 ? seconds : 2;
    try {
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OAC) return Promise.resolve(-1);
      const sr = 44100;
      const octx = new OAC(2, Math.floor(sr * seconds), sr);
      const g = buildGraph(octx);
      g.roomMult = 1; applyLevels(g, true);
      g.duckG.gain.value = 1;
      const savedCur = cur; cur = g;
      try {
        const S = SONGS[name];
        if (S) {
          const inst = makeInst();
          inst.active = true; inst.song = S; inst.id = name; inst.total = S.total; inst.step = 0;
          setInstTempo(inst, S.bpm); inst.next = 0.05;
          inst.gain = octx.createGain(); inst.gain.connect(g.musicBus);
          if (S.drone) { oReset(); O.when = 0.05; O.f = FREQ[S.drone]; O.bus = 'music'; O.out = inst.gain; O.held = true; O.vMul = S.droneVol; voice(INST[S.droneInst || 'drone']); oReset(); }
          let guard = 0;
          while (inst.next < seconds && guard++ < 8192) { scheduleStep(inst, inst.step, inst.next); inst.next += inst.stepTime; inst.step = (inst.step + 1) % inst.total; }
        } else if (RECIPES[name]) {
          oReset(); O.when = 0.02;
          RECIPES[name](0.02, 0, undefined);
          oReset();
        } else if (AMB[name]) {
          oReset(); O.when = 0.02; voice(AMB[name]); oReset();
        }
      } finally { cur = savedCur; }
      return octx.startRendering().then(function (buf) {
        let peak = 0;
        for (let c = 0; c < buf.numberOfChannels; c++) {
          const d = buf.getChannelData(c);
          for (let i = 0; i < d.length; i++) { const v = d[i] < 0 ? -d[i] : d[i]; if (v > peak) peak = v; }
        }
        return peak;
      }, function () { return -1; });
    } catch (e) { return Promise.resolve(-1); }
  };

  UB.Audio = Audio;
})(window.UB);
