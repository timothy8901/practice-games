/**
 * Screen effects: data-driven particle emitters, camera shake and full-screen
 * flashes.
 *
 * Pure module: simulation never touches the DOM or a clock, so it runs under
 * Node for tests; drawing happens only when {@link FX#draw draw(ctx)} is
 * handed a Canvas 2D context (anything with `fillRect`, `save`/`restore`,
 * `fillStyle`, `globalAlpha` and `globalCompositeOperation`). Every shape is
 * drawn from axis-aligned 1px rectangles at rounded coordinates so particles
 * stay crisp on the 480x270 pixel-art buffer.
 *
 * Determinism: all randomness flows through one generator chosen at
 * {@link createFX} time (`seed`, an `rng` with `next()`, or a `random`
 * function). Camera shake uses hashed noise keyed by shake index and time, so
 * it never consumes the particle stream. Two instances fed the same calls and
 * `dt`s produce identical {@link FX#snapshot snapshots} and camera offsets.
 *
 * Units: `dt`, lifetimes and durations are MILLISECONDS (as in `tween.js` and
 * `scene.js`); velocities are pixels per second, gravity pixels per second².
 * Velocity angles are degrees in canvas orientation: 0 = right, 90 = down,
 * 270 = up.
 *
 * @module core/fx
 */

import { resolveEase, lerp, clamp01 } from './tween.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;
const TWO_32 = 0x100000000;
/** Pixels past the screen edge before a screen-space particle is culled. */
const DEFAULT_CULL_MARGIN = 32;
/** Extra pixels drawn around a flash so it still covers the screen under shake. */
const FLASH_BLEED = 32;
/** Default noise frequency for camera shake, in samples per second. */
const SHAKE_FREQ = 28;

const LAYERS = Object.freeze(['back', 'front']);
const SPACES = Object.freeze(['world', 'screen']);
const SHAPES = Object.freeze(['pixel', 'rect', 'circle', 'ring', 'spark', 'line']);
const FADES = Object.freeze(['out', 'in', 'inOut', 'none', 'twinkle']);
const AXES = Object.freeze(['both', 'x', 'y']);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * Human-readable type name for error messages.
 * @param {unknown} v
 * @returns {string}
 */
function describe(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'number') return Number.isNaN(v) ? 'NaN' : String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  return typeof v;
}

/**
 * murmur3's 32-bit finaliser.
 * @param {number} h
 * @returns {number} uint32
 */
function fmix32(h) {
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * FNV-1a hash of a string (UTF-16 code units), finalised with fmix32.
 * @param {string} str
 * @returns {number} uint32
 */
function hash32(str) {
  let h = 0x811c9dc5 | 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193);
  }
  return fmix32(h);
}

/**
 * Deterministic `[-1, 1]` noise sample for an integer index of a stream.
 * @param {number} seed uint32 stream id
 * @param {number} i sample index
 * @returns {number}
 */
function noise(seed, i) {
  return (fmix32((seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0) / TWO_32) * 2 - 1;
}

/**
 * mulberry32: a tiny, fast 32-bit generator used when no `rng` is injected.
 * @param {number} seed uint32
 * @returns {() => number} uniform in `[0, 1)`
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / TWO_32;
  };
}

/**
 * Recursively freezes plain objects and arrays (used for the preset table).
 * @template T
 * @param {T} value
 * @returns {T}
 */
function deepFreeze(value) {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

/**
 * Hermite smoothing for noise interpolation.
 * @param {number} t in `[0, 1]`
 * @returns {number}
 */
function smooth(t) {
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// Presets (pure data)
// ---------------------------------------------------------------------------

/**
 * A particle emitter specification. Every field is optional; unspecified
 * fields fall back to the preset's value, then to {@link SPEC_DEFAULTS}.
 * A "range" is a number or a `[min, max]` pair sampled per particle.
 *
 * @typedef {Object} ParticleSpec
 * @property {string} [preset] Name in {@link PARTICLE_PRESETS} (or a custom preset) to start from.
 * @property {'back'|'front'} [layer='front'] Draw pass the particles belong to.
 * @property {'world'|'screen'} [space='world'] World particles are offset by the camera passed to
 *   `draw()`; screen particles are not, and are culled when they leave the screen (`cull`).
 * @property {number} [x=0] Emission box left (or point) in the chosen space.
 * @property {number} [y=0] Emission box top (or point).
 * @property {number} [w=0] Emission box width; particles spawn uniformly inside.
 * @property {number} [h=0] Emission box height.
 * @property {number} [count=0] Particles spawned immediately (a burst).
 * @property {number} [rate=0] Continuous emission in particles per second.
 * @property {number} [duration] Milliseconds of continuous emission; `Infinity` until `stop()`.
 *   Defaults to `Infinity` when `rate > 0`, else 0.
 * @property {number|[number, number]} [life=[600,1000]] Lifetime in ms (min 1).
 * @property {number|[number, number]} [speed=0] Initial speed in px/s, along `angle`.
 * @property {number|[number, number]} [angle=[0,360]] Initial direction in degrees (0 right, 90 down).
 * @property {number|[number, number]} [vx=0] Extra initial horizontal velocity (px/s).
 * @property {number|[number, number]} [vy=0] Extra initial vertical velocity (px/s).
 * @property {number} [gravity=0] Vertical acceleration in px/s² (positive = down).
 * @property {number} [drag=0] Velocity damping per second (`v *= 1 - drag*dt`).
 * @property {number} [wind=0] How strongly the global wind (see `setWind`) accelerates the particle.
 * @property {number|[number, number]} [size=1] Size in pixels at birth.
 * @property {number|[number, number]|null} [sizeEnd=null] Size at death (null = constant).
 * @property {string|string[]} [colors=['#ffffff']] Fill colours; one is picked per particle.
 * @property {string[]|null} [ramp=null] Colour over lifetime (discrete steps); overrides `colors`.
 * @property {number|[number, number]} [alpha=1] Base opacity in `[0, 1]`.
 * @property {'out'|'in'|'inOut'|'none'|'twinkle'} [fade='out'] Opacity curve over the lifetime.
 * @property {number|[number, number]} [twinkle=[0.5,2]] Twinkle frequency in Hz (`fade: 'twinkle'`).
 * @property {'pixel'|'rect'|'circle'|'ring'|'spark'|'line'} [shape='pixel'] How a particle is drawn.
 * @property {{amp: number|[number, number], freq: number|[number, number]}|null} [wobble=null]
 *   Sideways sine sway: amplitude in px and frequency in Hz.
 * @property {number|[number, number]} [tumble=0] For `rect`: width oscillation frequency in Hz.
 * @property {number|'origin'|null} [floor=null] Particles die when falling past this y
 *   (`'origin'` = their own spawn y).
 * @property {boolean} [cull=true] Cull screen-space particles that leave the screen.
 * @property {string} [blend='source-over'] Canvas composite operation (`'lighter'` for glows).
 */

/**
 * Defaults every emitter starts from before preset and spec values apply.
 * @type {Readonly<Required<Omit<ParticleSpec, 'preset'|'duration'>>>}
 */
export const SPEC_DEFAULTS = deepFreeze({
  layer: 'front',
  space: 'world',
  x: 0,
  y: 0,
  w: 0,
  h: 0,
  count: 0,
  rate: 0,
  life: [600, 1000],
  speed: 0,
  angle: [0, 360],
  vx: 0,
  vy: 0,
  gravity: 0,
  drag: 0,
  wind: 0,
  size: 1,
  sizeEnd: null,
  colors: ['#ffffff'],
  ramp: null,
  alpha: 1,
  fade: 'out',
  twinkle: [0.5, 2],
  shape: 'pixel',
  wobble: null,
  tumble: 0,
  floor: null,
  cull: true,
  blend: 'source-over',
});

/** Every field a spec may carry (defaults plus the two that have no default). */
const SPEC_KEYS = new Set([...Object.keys(SPEC_DEFAULTS), 'preset', 'duration']);

/**
 * Built-in emitter presets, as pure data. Use them by name:
 * `fx.particles({ preset: 'sparkles', x, y })` or `fx.particles('sparkles', { x, y })`.
 *
 * Continuous ones (`rate` > 0) emit until `stop()`; bursts (`count` > 0) are
 * one-shot. Positions default to `(0, 0)` and should be set by the caller,
 * except `rain` and `snow`, which cover the whole 480x270 screen.
 *
 * @type {Readonly<Record<string, Readonly<ParticleSpec>>>}
 */
export const PARTICLE_PRESETS = deepFreeze({
  /** Slow drifting glow points that twinkle; world space, additive. */
  fireflies: {
    rate: 2,
    life: [2500, 4500],
    speed: [4, 12],
    angle: [0, 360],
    drag: 0.2,
    wind: 0.3,
    size: [1, 2],
    colors: ['#e9f59a', '#c9f08a', '#fff7b0'],
    alpha: [0.7, 1],
    fade: 'twinkle',
    twinkle: [0.6, 1.6],
    wobble: { amp: [3, 8], freq: [0.2, 0.5] },
    blend: 'lighter',
    cull: false,
  },
  /** A short burst of twinkling plus-shaped sparks (pickups, Heartmarks). */
  sparkles: {
    count: 12,
    life: [300, 650],
    speed: [10, 40],
    angle: [0, 360],
    gravity: -15,
    drag: 1.5,
    size: [1, 3],
    sizeEnd: 1,
    colors: ['#ffffff', '#fff2a8', '#ffd1f0', '#bff5ff'],
    fade: 'twinkle',
    twinkle: [4, 8],
    shape: 'spark',
    blend: 'lighter',
    cull: false,
  },
  /** Water drops fanning upward and falling back to the surface they left. */
  splash: {
    count: 10,
    life: [250, 500],
    speed: [40, 110],
    angle: [220, 320],
    gravity: 320,
    size: [1, 2],
    colors: ['#bfe8ff', '#ffffff', '#7cc5f2'],
    fade: 'out',
    floor: 'origin',
    cull: false,
  },
  /** Tumbling leaves drifting down on the wind. */
  leaves: {
    rate: 1.5,
    life: [3000, 5000],
    vx: [-6, 6],
    vy: [8, 16],
    gravity: 4,
    wind: 1,
    size: [2, 3],
    colors: ['#8ab85a', '#c99a3e', '#b85c2e', '#e0b34a'],
    fade: 'inOut',
    shape: 'rect',
    tumble: [0.6, 1.4],
    wobble: { amp: [4, 10], freq: [0.25, 0.5] },
    cull: false,
  },
  /** A soft puff of dust (footsteps, landings, digging). */
  dust: {
    count: 6,
    life: [300, 600],
    speed: [6, 20],
    angle: [200, 340],
    gravity: -6,
    drag: 2,
    size: [1, 2],
    sizeEnd: 1,
    colors: ['#d8c9a6', '#bfb094', '#eee3c8'],
    alpha: [0.5, 0.8],
    fade: 'out',
    cull: false,
  },
  /** Screen-wide rain streaks behind the actors. */
  rain: {
    layer: 'back',
    space: 'screen',
    rate: 140,
    x: -40,
    y: -20,
    w: 560,
    h: 10,
    life: [500, 800],
    vx: [-30, -20],
    vy: [380, 470],
    wind: 1,
    size: [5, 9],
    colors: ['#8fb2d9', '#6f93bf', '#b5d0ec'],
    alpha: [0.4, 0.75],
    fade: 'none',
    shape: 'line',
    cull: true,
  },
  /** Screen-wide drifting snowflakes behind the actors. */
  snow: {
    layer: 'back',
    space: 'screen',
    rate: 24,
    x: -20,
    y: -10,
    w: 520,
    h: 4,
    life: [6000, 9000],
    vx: [-4, 4],
    vy: [14, 28],
    wind: 0.6,
    size: [1, 2],
    colors: ['#ffffff', '#dff2ff', '#cfe4ff'],
    alpha: [0.6, 1],
    fade: 'none',
    wobble: { amp: [3, 8], freq: [0.15, 0.35] },
    cull: true,
  },
  /** Tiny sunbeam motes hanging in the air. */
  motes: {
    rate: 3,
    life: [3000, 6000],
    speed: [1, 4],
    angle: [0, 360],
    wind: 0.2,
    size: 1,
    colors: ['#fff5d0', '#ffe9a8'],
    alpha: [0.3, 0.7],
    fade: 'twinkle',
    twinkle: [0.3, 0.8],
    wobble: { amp: [2, 5], freq: [0.1, 0.3] },
    blend: 'lighter',
    cull: false,
  },
  /** A celebratory burst of tumbling paper squares (screen space). */
  confetti: {
    space: 'screen',
    count: 40,
    life: [1500, 2600],
    speed: [60, 180],
    angle: [220, 320],
    gravity: 150,
    drag: 1.2,
    size: [2, 3],
    colors: ['#ff5c7a', '#ffd34d', '#5ad1ff', '#7cf08a', '#c58cff', '#ff9d4d'],
    fade: 'inOut',
    shape: 'rect',
    tumble: [1.5, 3.5],
    wobble: { amp: [2, 6], freq: [0.8, 1.6] },
    cull: false,
  },
  /** Rising embers that cool from yellow to ash (campfires, lanterns). */
  embers: {
    rate: 4,
    life: [900, 1600],
    speed: [8, 22],
    angle: [240, 300],
    gravity: -12,
    drag: 0.8,
    wind: 0.5,
    size: [1, 2],
    sizeEnd: 1,
    ramp: ['#fff1a8', '#ffb347', '#ff6b3d', '#7a4a3a'],
    fade: 'out',
    wobble: { amp: [1, 3], freq: [1, 2.5] },
    blend: 'lighter',
    cull: false,
  },
  /** Small rings rising through water. */
  bubbles: {
    rate: 2,
    life: [1200, 2400],
    vx: [-3, 3],
    vy: [-28, -14],
    size: [2, 4],
    colors: ['#cfefff', '#ffffff'],
    alpha: [0.5, 0.9],
    fade: 'inOut',
    shape: 'ring',
    wobble: { amp: [1, 3], freq: [0.8, 1.6] },
    cull: false,
  },
});

// ---------------------------------------------------------------------------
// Spec validation / resolution
// ---------------------------------------------------------------------------

/**
 * @param {string} name
 * @param {unknown} v
 * @param {{min?: number, max?: number, allowInfinity?: boolean, integer?: boolean}} [o]
 * @returns {number}
 */
function num(name, v, { min = -Infinity, max = Infinity, allowInfinity = false, integer = false } = {}) {
  if (typeof v !== 'number' || Number.isNaN(v)) {
    throw new TypeError(`fx.particles: ${name} must be a number, got ${describe(v)}`);
  }
  if (!Number.isFinite(v) && !(allowInfinity && v === Infinity)) {
    throw new RangeError(`fx.particles: ${name} must be finite, got ${v}`);
  }
  if (integer && Number.isFinite(v) && !Number.isInteger(v)) {
    throw new RangeError(`fx.particles: ${name} must be an integer, got ${v}`);
  }
  if (v < min || v > max) {
    throw new RangeError(`fx.particles: ${name} must be in [${min}, ${max}], got ${v}`);
  }
  return v;
}

/**
 * Normalises a range (`n` or `[min, max]`) into a `[min, max]` pair.
 * @param {string} name
 * @param {unknown} v
 * @param {{min?: number, max?: number}} [bounds]
 * @returns {[number, number]}
 */
function range(name, v, bounds = {}) {
  if (typeof v === 'number') {
    const n = num(name, v, bounds);
    return [n, n];
  }
  if (Array.isArray(v) && v.length === 2) {
    const a = num(`${name}[0]`, v[0], bounds);
    const b = num(`${name}[1]`, v[1], bounds);
    return a <= b ? [a, b] : [b, a];
  }
  throw new TypeError(`fx.particles: ${name} must be a number or a [min, max] pair, got ${describe(v)}`);
}

/**
 * @param {string} name
 * @param {unknown} v
 * @param {readonly string[]} allowed
 * @returns {string}
 */
function oneOf(name, v, allowed) {
  if (typeof v === 'string' && allowed.includes(v)) return v;
  throw new TypeError(`fx.particles: ${name} must be one of ${allowed.join('|')}, got ${describe(v)}`);
}

/**
 * @param {string} name
 * @param {unknown} v
 * @returns {string[]}
 */
function colorList(name, v) {
  const arr = typeof v === 'string' ? [v] : v;
  if (!Array.isArray(arr) || arr.length === 0 || arr.some((c) => typeof c !== 'string' || c === '')) {
    throw new TypeError(`fx.particles: ${name} must be a colour string or a non-empty array of them`);
  }
  return arr.slice();
}

/**
 * Merges defaults, preset and overrides into a fully validated, frozen spec
 * with every range normalised to a `[min, max]` pair.
 *
 * @param {ParticleSpec} input
 * @param {Readonly<Record<string, Readonly<ParticleSpec>>>} presets
 * @returns {Readonly<object>}
 */
function resolveSpec(input, presets) {
  let base = {};
  if (input.preset !== undefined) {
    if (typeof input.preset !== 'string' || !Object.hasOwn(presets, input.preset)) {
      throw new TypeError(
        `fx.particles: unknown preset ${describe(input.preset)} (known: ${Object.keys(presets).join(', ')})`,
      );
    }
    base = presets[input.preset];
    if (typeof base !== 'object' || base === null) {
      throw new TypeError(`fx.particles: preset ${describe(input.preset)} is not a spec object`);
    }
  }
  for (const key of Object.keys(base)) {
    if (!SPEC_KEYS.has(key)) throw new TypeError(`fx.particles: preset has an unknown field "${key}"`);
  }
  for (const key of Object.keys(input)) {
    if (!SPEC_KEYS.has(key)) throw new TypeError(`fx.particles: unknown spec field "${key}"`);
  }
  const s = { ...SPEC_DEFAULTS, ...base, ...input };
  for (const key of Object.keys(s)) {
    if (s[key] === undefined) s[key] = base[key] ?? SPEC_DEFAULTS[key];
  }
  const rate = num('rate', s.rate, { min: 0 });
  const duration =
    s.duration === undefined || s.duration === null
      ? rate > 0
        ? Infinity
        : 0
      : num('duration', s.duration, { min: 0, allowInfinity: true });
  let floor = null;
  if (s.floor === 'origin') floor = 'origin';
  else if (s.floor !== null) floor = num('floor', s.floor);
  let wobbleAmp = null;
  let wobbleFreq = null;
  if (s.wobble !== null) {
    if (typeof s.wobble !== 'object') {
      throw new TypeError(`fx.particles: wobble must be {amp, freq} or null, got ${describe(s.wobble)}`);
    }
    wobbleAmp = range('wobble.amp', s.wobble.amp ?? 0, { min: 0 });
    wobbleFreq = range('wobble.freq', s.wobble.freq ?? 0, { min: 0 });
  }
  if (typeof s.blend !== 'string' || s.blend === '') {
    throw new TypeError(`fx.particles: blend must be a composite operation name, got ${describe(s.blend)}`);
  }
  if (typeof s.cull !== 'boolean') {
    throw new TypeError(`fx.particles: cull must be a boolean, got ${describe(s.cull)}`);
  }
  return Object.freeze({
    preset: typeof input.preset === 'string' ? input.preset : null,
    layer: oneOf('layer', s.layer, LAYERS),
    space: oneOf('space', s.space, SPACES),
    shape: oneOf('shape', s.shape, SHAPES),
    fade: oneOf('fade', s.fade, FADES),
    blend: s.blend,
    x: num('x', s.x),
    y: num('y', s.y),
    w: num('w', s.w, { min: 0 }),
    h: num('h', s.h, { min: 0 }),
    count: num('count', s.count, { min: 0, integer: true }),
    rate,
    duration,
    life: range('life', s.life, { min: 1 }),
    speed: range('speed', s.speed),
    angle: range('angle', s.angle),
    vx: range('vx', s.vx),
    vy: range('vy', s.vy),
    gravity: num('gravity', s.gravity),
    drag: num('drag', s.drag, { min: 0 }),
    wind: num('wind', s.wind),
    size: range('size', s.size, { min: 0 }),
    sizeEnd: s.sizeEnd === null ? null : range('sizeEnd', s.sizeEnd, { min: 0 }),
    colors: Object.freeze(colorList('colors', s.colors)),
    ramp: s.ramp === null ? null : Object.freeze(colorList('ramp', s.ramp)),
    alpha: range('alpha', s.alpha, { min: 0, max: 1 }),
    twinkle: range('twinkle', s.twinkle, { min: 0 }),
    tumble: range('tumble', s.tumble, { min: 0 }),
    wobbleAmp,
    wobbleFreq,
    floor,
    cull: s.cull,
  });
}

// ---------------------------------------------------------------------------
// Particles and emitters
// ---------------------------------------------------------------------------

/** One live particle. Instances are pooled; fields are reassigned on spawn. */
class Particle {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.age = 0;
    this.life = 1;
    this.size0 = 1;
    this.size1 = 1;
    this.color = '#ffffff';
    /** @type {readonly string[]|null} */
    this.ramp = null;
    this.alpha = 1;
    this.fade = 'out';
    this.shape = 'pixel';
    this.blend = 'source-over';
    this.layer = 'front';
    this.space = 'world';
    this.twinkle = 0;
    this.tumble = 0;
    this.phase = 0;
    this.wobbleAmp = 0;
    this.wobbleFreq = 0;
    this.gravity = 0;
    this.drag = 0;
    this.wind = 0;
    /** @type {number|null} */
    this.floor = null;
    this.cull = false;
    /** @type {Emitter|null} */
    this.emitter = null;
  }
}

/**
 * Opacity multiplier for a particle at life fraction `f`.
 * @param {Particle} p
 * @param {number} f in `[0, 1]`
 * @returns {number}
 */
function fadeAt(p, f) {
  switch (p.fade) {
    case 'out':
      return 1 - f;
    case 'in':
      return f;
    case 'none':
      return 1;
    case 'inOut':
      return f < 0.2 ? f / 0.2 : f > 0.8 ? (1 - f) / 0.2 : 1;
    default: {
      // twinkle: trapezoid envelope times a per-particle sine flicker
      const env = f < 0.15 ? f / 0.15 : f > 0.85 ? (1 - f) / 0.15 : 1;
      const s = 0.5 + 0.5 * Math.sin(p.phase + p.age * 0.001 * TWO_PI * p.twinkle);
      return env * (0.3 + 0.7 * s);
    }
  }
}

/**
 * A handle to one emitter returned by {@link FX#particles}. Move it by
 * assigning `x`/`y`; stop or kill it; or fire extra bursts.
 */
export class Emitter {
  /** Emission origin x (settable). @type {number} */
  x;
  /** Emission origin y (settable). @type {number} */
  y;
  /** @type {Readonly<object>} */
  #spec;
  /** @type {{spawn: (em: Emitter) => boolean, killOf: (em: Emitter) => void}} */
  #host;
  #elapsed = 0;
  #acc = 0;
  #stopped = false;
  #alive = 0;

  /**
   * @param {Readonly<object>} spec resolved spec
   * @param {{spawn: (em: Emitter) => boolean, killOf: (em: Emitter) => void}} host
   * @package
   */
  constructor(spec, host) {
    this.#spec = spec;
    this.#host = host;
    this.x = spec.x;
    this.y = spec.y;
  }

  /** The fully resolved, frozen spec this emitter runs with. @type {Readonly<object>} */
  get spec() {
    return this.#spec;
  }

  /** Live particles spawned by this emitter. @type {number} */
  get alive() {
    return this.#alive;
  }

  /** True while continuous emission is still possible. @type {boolean} */
  get emitting() {
    return !this.#stopped && this.#spec.rate > 0 && this.#elapsed < this.#spec.duration;
  }

  /** True once emission ended and every particle died. @type {boolean} */
  get done() {
    return !this.emitting && this.#alive === 0;
  }

  /** Milliseconds of continuous emission so far. @type {number} */
  get elapsed() {
    return this.#elapsed;
  }

  /**
   * Convenience setter for both coordinates.
   * @param {number} x
   * @param {number} y
   * @returns {this}
   */
  moveTo(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  /** Stops continuous emission; live particles finish their lives. */
  stop() {
    this.#stopped = true;
  }

  /** Stops emission and removes this emitter's live particles at once. */
  kill() {
    this.#stopped = true;
    this.#host.killOf(this);
  }

  /**
   * Spawns `n` particles right now at the current origin.
   * @param {number} n
   * @returns {number} how many were actually spawned (the particle cap may refuse some)
   */
  burst(n) {
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
      throw new RangeError(`emitter.burst: n must be a number >= 0, got ${describe(n)}`);
    }
    let spawned = 0;
    for (let i = 0; i < Math.floor(n); i++) {
      if (!this.#host.spawn(this)) break;
      spawned++;
    }
    return spawned;
  }

  /**
   * Advances continuous emission by `dt` ms.
   * @param {number} dt
   * @package
   */
  tick(dt) {
    if (!this.emitting) return;
    const spec = this.#spec;
    const emitTime = Math.min(dt, spec.duration - this.#elapsed);
    this.#elapsed += dt;
    this.#acc += (spec.rate * emitTime) / 1000;
    const n = Math.floor(this.#acc);
    if (n > 0) {
      this.#acc -= n;
      for (let i = 0; i < n; i++) {
        if (!this.#host.spawn(this)) break;
      }
    }
  }

  /**
   * @param {number} delta +1 on spawn, -1 on death
   * @package
   */
  track(delta) {
    this.#alive += delta;
  }
}

// ---------------------------------------------------------------------------
// Flash handle
// ---------------------------------------------------------------------------

/** A full-screen colour flash returned by {@link FX#flash}. */
export class Flash {
  /** @type {string} */
  color;
  #ms;
  #hold;
  #peak;
  /** @type {(t: number) => number} */
  #ease;
  #elapsed = 0;
  #cancelled = false;

  /**
   * @param {string} color
   * @param {number} ms
   * @param {number} hold
   * @param {number} peak
   * @param {(t: number) => number} easeFn
   * @package
   */
  constructor(color, ms, hold, peak, easeFn) {
    this.color = color;
    this.#ms = ms;
    this.#hold = hold;
    this.#peak = peak;
    this.#ease = easeFn;
  }

  /** Current opacity in `[0, peak]`. @type {number} */
  get alpha() {
    if (this.#cancelled) return 0;
    const t = clamp01((this.#elapsed - this.#hold) / this.#ms);
    return this.#peak * (1 - this.#ease(t));
  }

  /** True once faded out or cancelled. @type {boolean} */
  get done() {
    return this.#cancelled || this.#elapsed >= this.#hold + this.#ms;
  }

  /** Removes the flash immediately. */
  cancel() {
    this.#cancelled = true;
  }

  /**
   * @param {number} dt
   * @package
   */
  tick(dt) {
    this.#elapsed += dt;
  }
}

// ---------------------------------------------------------------------------
// Shape rasterisers (all axis-aligned 1px rects at integer coordinates)
// ---------------------------------------------------------------------------

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} w integer >= 1
 * @param {number} h integer >= 1
 */
function fillCentered(ctx, cx, cy, w, h) {
  ctx.fillRect(Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
}

/**
 * A filled disc made of horizontal spans.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} size diameter in px
 */
function fillDisc(ctx, cx, cy, size) {
  if (size < 3) {
    fillCentered(ctx, cx, cy, Math.max(1, Math.round(size)), Math.max(1, Math.round(size)));
    return;
  }
  const r = Math.round(size / 2);
  const x = Math.round(cx);
  const y = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.round(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(x - hw, y + dy, hw * 2 + 1, 1);
  }
}

/**
 * A 1px ring (classic pixel circle with open diagonals).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} size diameter in px
 */
function fillRing(ctx, cx, cy, size) {
  if (size < 3) {
    fillDisc(ctx, cx, cy, size);
    return;
  }
  const r = Math.round(size / 2);
  const x = Math.round(cx);
  const y = Math.round(cy);
  const cap = Math.round(Math.sqrt(r * r - (r - 0.5) ** 2));
  ctx.fillRect(x - cap, y - r, cap * 2 + 1, 1);
  ctx.fillRect(x - cap, y + r, cap * 2 + 1, 1);
  for (let dy = -r + 1; dy <= r - 1; dy++) {
    const hw = Math.round(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(x - hw, y + dy, 1, 1);
    ctx.fillRect(x + hw, y + dy, 1, 1);
  }
}

/**
 * A plus-shaped spark.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} size arm span in px
 */
function fillSpark(ctx, cx, cy, size) {
  const x = Math.round(cx);
  const y = Math.round(cy);
  if (size < 2) {
    ctx.fillRect(x, y, 1, 1);
    return;
  }
  const arm = Math.max(1, Math.round(size / 2));
  ctx.fillRect(x - arm, y, arm * 2 + 1, 1);
  ctx.fillRect(x, y - arm, 1, arm * 2 + 1);
}

/**
 * A streak trailing behind the particle along its velocity.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Particle} p
 * @param {number} cx
 * @param {number} cy
 * @param {number} size length in px
 */
function fillStreak(ctx, p, cx, cy, size) {
  const n = Math.max(1, Math.round(size));
  const len = Math.hypot(p.vx, p.vy);
  const dx = len > 1e-6 ? p.vx / len : 0;
  const dy = len > 1e-6 ? p.vy / len : 1;
  for (let i = 0; i < n; i++) {
    ctx.fillRect(Math.round(cx - dx * i), Math.round(cy - dy * i), 1, 1);
  }
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Particle} p
 * @param {number} x draw-space centre
 * @param {number} y draw-space centre
 * @param {number} size current size in px
 */
function drawShape(ctx, p, x, y, size) {
  switch (p.shape) {
    case 'rect': {
      let w = size;
      if (p.tumble > 0) w = size * Math.abs(Math.cos(p.phase + p.age * 0.001 * TWO_PI * p.tumble));
      fillCentered(ctx, x, y, Math.max(1, Math.round(w)), Math.max(1, Math.round(size * 0.6)));
      return;
    }
    case 'circle':
      fillDisc(ctx, x, y, size);
      return;
    case 'ring':
      fillRing(ctx, x, y, size);
      return;
    case 'spark':
      fillSpark(ctx, x, y, size);
      return;
    case 'line':
      fillStreak(ctx, p, x, y, size);
      return;
    default: {
      const s = Math.max(1, Math.round(size));
      fillCentered(ctx, x, y, s, s);
    }
  }
}

// ---------------------------------------------------------------------------
// FX system
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FXOptions
 * @property {number|string} [seed='fx'] Seed for the built-in generator (ignored with `rng`/`random`).
 * @property {{next: () => number}} [rng] A seeded generator to draw from (e.g. `makeRng(...)`).
 * @property {() => number} [random] A function returning uniform numbers in `[0, 1)`.
 * @property {number} [width=480] Screen width in game pixels (flash size, screen-space culling).
 * @property {number} [height=270] Screen height in game pixels.
 * @property {number} [maxParticles=2000] Hard cap; spawns beyond it are dropped.
 * @property {number} [maxDt=100] Largest particle-simulation step per `update()` call (ms, > 0); bigger
 *   `dt`s are clamped for particles only. Shakes and flashes always advance by the full `dt`.
 * @property {number} [cullMargin=32] Pixels past the screen edge before culling.
 * @property {Record<string, ParticleSpec>} [presets] Extra or overriding presets, merged over the built-ins.
 */

/**
 * @typedef {Object} FX
 * @property {(spec: string|ParticleSpec, overrides?: ParticleSpec) => Emitter} particles
 *   Starts an emitter from a preset name and/or spec; bursts spawn immediately.
 * @property {(amount: number, ms: number, opts?: {freq?: number, decay?: number, axis?: 'both'|'x'|'y'}) => void} shake
 *   Adds a decaying camera shake of up to `amount` pixels for `ms`.
 * @property {(color: string, ms: number, opts?: {alpha?: number, ease?: string|((t: number) => number), hold?: number}) => Flash} flash
 *   Adds a full-screen flash fading from `alpha` to 0 over `ms`.
 * @property {(dt: number) => void} update Advances everything by `dt` milliseconds.
 * @property {(ctx: CanvasRenderingContext2D, opts?: {layer?: 'back'|'front', camera?: {x: number, y: number}}) => void} draw
 *   Draws particles (optionally one layer) and, on the front/all pass, the flashes.
 * @property {() => {x: number, y: number}} cameraOffset Integer shake offset to translate the world by.
 * @property {() => number} shakeStrength Current peak shake amplitude in pixels.
 * @property {(x: number, y: number) => void} setWind Global wind acceleration (px/s²) scaled per spec.
 * @property {() => {x: number, y: number}} wind Current wind.
 * @property {() => void} clear Removes every particle, emitter, shake and flash.
 * @property {() => {particles: number, emitters: number, shakes: number, flashes: number, pooled: number}} stats
 * @property {() => Array<{x: number, y: number, size: number, color: string, alpha: number, layer: string, space: string, shape: string}>} snapshot
 *   Plain copies of the live particles (debug overlays, tests).
 * @property {number} particleCount Live particles.
 * @property {number} emitterCount Emitters still tracked (emitting or with live particles).
 * @property {string[]} presetNames Available preset names.
 */

/**
 * Creates an independent effects system. A scene usually owns one, drawn
 * in two passes: `draw(ctx, {layer: 'back'})` before the actors and
 * `draw(ctx, {layer: 'front'})` after them, with the world translated by
 * `cameraOffset()` in between.
 *
 * @param {FXOptions} [options]
 * @returns {FX}
 */
export function createFX(options = {}) {
  if (typeof options !== 'object' || options === null) {
    throw new TypeError(`createFX: options must be an object, got ${describe(options)}`);
  }
  const {
    seed = 'fx',
    rng,
    random,
    width = 480,
    height = 270,
    maxParticles = 2000,
    maxDt = 100,
    cullMargin = DEFAULT_CULL_MARGIN,
    presets: extraPresets = {},
  } = options;

  for (const [name, v] of Object.entries({ width, height, maxParticles, maxDt, cullMargin })) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new RangeError(`createFX: ${name} must be a finite number >= 0, got ${describe(v)}`);
    }
  }
  if (maxDt <= 0) {
    throw new RangeError(`createFX: maxDt must be > 0 (it is the largest simulated step per update), got ${maxDt}`);
  }
  if (typeof extraPresets !== 'object' || extraPresets === null) {
    throw new TypeError(`createFX: presets must be an object, got ${describe(extraPresets)}`);
  }

  /** @type {() => number} */
  let rnd;
  if (rng !== undefined) {
    if (rng === null || typeof rng.next !== 'function') {
      throw new TypeError(`createFX: rng must have a next() method, got ${describe(rng)}`);
    }
    rnd = () => rng.next();
  } else if (random !== undefined) {
    if (typeof random !== 'function') {
      throw new TypeError(`createFX: random must be a function, got ${describe(random)}`);
    }
    rnd = random;
  } else {
    if (typeof seed !== 'number' && typeof seed !== 'string') {
      throw new TypeError(`createFX: seed must be a number or string, got ${describe(seed)}`);
    }
    rnd = mulberry32(hash32(typeof seed === 'number' ? `n:${seed}` : `s:${seed}`));
  }

  const presets = Object.freeze({ ...PARTICLE_PRESETS, ...extraPresets });

  /** @type {Particle[]} */
  const live = [];
  /** @type {Particle[]} */
  const pool = [];
  /** @type {Emitter[]} */
  let emitters = [];
  /** @type {Array<{amp: number, ms: number, elapsed: number, freq: number, decay: number, axis: string, sx: number, sy: number}>} */
  let shakes = [];
  /** @type {Flash[]} */
  let flashes = [];
  let shakeCounter = 0;
  let camX = 0;
  let camY = 0;
  let strength = 0;
  let windX = 0;
  let windY = 0;

  /**
   * @param {readonly [number, number]} r
   * @returns {number}
   */
  function sample(r) {
    return r[0] === r[1] ? r[0] : r[0] + (r[1] - r[0]) * rnd();
  }

  /**
   * @param {readonly string[]} list
   * @returns {string}
   */
  function pick(list) {
    return list.length === 1 ? list[0] : list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
  }

  /**
   * Spawns one particle for `em`. Always consumes the same number of random
   * draws for a given spec, so emitter order alone determines the stream.
   * @param {Emitter} em
   * @returns {boolean} false when the particle cap refused it
   */
  function spawn(em) {
    if (live.length >= maxParticles) return false;
    const s = em.spec;
    const p = pool.pop() ?? new Particle();
    p.x = em.x + s.w * rnd();
    p.y = em.y + s.h * rnd();
    const speed = sample(s.speed);
    const ang = sample(s.angle) * DEG;
    p.vx = Math.cos(ang) * speed + sample(s.vx);
    p.vy = Math.sin(ang) * speed + sample(s.vy);
    p.age = 0;
    p.life = sample(s.life);
    p.size0 = sample(s.size);
    p.size1 = s.sizeEnd ? sample(s.sizeEnd) : p.size0;
    p.color = pick(s.colors);
    p.ramp = s.ramp;
    p.alpha = sample(s.alpha);
    p.fade = s.fade;
    p.shape = s.shape;
    p.blend = s.blend;
    p.layer = s.layer;
    p.space = s.space;
    p.twinkle = sample(s.twinkle);
    p.tumble = sample(s.tumble);
    p.phase = rnd() * TWO_PI;
    p.wobbleAmp = s.wobbleAmp ? sample(s.wobbleAmp) : 0;
    p.wobbleFreq = s.wobbleFreq ? sample(s.wobbleFreq) : 0;
    p.gravity = s.gravity;
    p.drag = s.drag;
    p.wind = s.wind;
    p.floor = s.floor === 'origin' ? p.y : s.floor;
    p.cull = s.cull && s.space === 'screen';
    p.emitter = em;
    em.track(1);
    live.push(p);
    return true;
  }

  /**
   * Returns a dead particle to the pool.
   * @param {Particle} p
   */
  function recycle(p) {
    p.emitter?.track(-1);
    p.emitter = null;
    p.ramp = null;
    pool.push(p);
  }

  /**
   * Removes particles that fail `keep`, preserving draw order.
   * @param {(p: Particle) => boolean} keep
   */
  function filterLive(keep) {
    let w = 0;
    for (let i = 0; i < live.length; i++) {
      const p = live[i];
      if (keep(p)) live[w++] = p;
      else recycle(p);
    }
    live.length = w;
  }

  /** @param {Emitter} em */
  function killOf(em) {
    filterLive((p) => p.emitter !== em);
  }

  const host = { spawn, killOf };

  /**
   * Semi-implicit Euler step for one particle.
   * @param {Particle} p
   * @param {number} s step in seconds
   * @param {number} dtMs the same step in milliseconds (ages the particle)
   * @returns {boolean} true when the particle stays alive
   */
  function integrate(p, s, dtMs) {
    p.age += dtMs;
    if (p.age >= p.life) return false;
    p.vx += windX * p.wind * s;
    p.vy += (p.gravity + windY * p.wind) * s;
    if (p.drag > 0) {
      const f = Math.max(0, 1 - p.drag * s);
      p.vx *= f;
      p.vy *= f;
    }
    p.x += p.vx * s;
    p.y += p.vy * s;
    if (p.floor !== null && p.vy > 0 && p.y >= p.floor) return false;
    if (p.cull) {
      const m = cullMargin;
      if (p.x < -m || p.y < -m || p.x > width + m || p.y > height + m) return false;
    }
    return true;
  }

  /** Recomputes the cached camera offset from the live shakes. */
  function computeShake() {
    let x = 0;
    let y = 0;
    let peak = 0;
    for (const sh of shakes) {
      const t = sh.elapsed / sh.ms;
      const env = (1 - t) ** sh.decay;
      const idx = (sh.elapsed * sh.freq) / 1000;
      const i0 = Math.floor(idx);
      const fr = smooth(idx - i0);
      const a = sh.amp * env;
      peak += a;
      if (sh.axis !== 'y') x += a * lerp(noise(sh.sx, i0), noise(sh.sx, i0 + 1), fr);
      if (sh.axis !== 'x') y += a * lerp(noise(sh.sy, i0), noise(sh.sy, i0 + 1), fr);
    }
    camX = Math.round(x);
    camY = Math.round(y);
    strength = peak;
  }

  /**
   * @param {string|ParticleSpec} spec
   * @param {ParticleSpec} [overrides]
   * @returns {Emitter}
   */
  function particles(spec, overrides) {
    let input;
    if (typeof spec === 'string') input = { preset: spec };
    else if (typeof spec === 'object' && spec !== null && !Array.isArray(spec)) input = spec;
    else throw new TypeError(`fx.particles: expected a preset name or a spec object, got ${describe(spec)}`);
    if (overrides !== undefined) {
      if (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides)) {
        throw new TypeError(`fx.particles: overrides must be an object, got ${describe(overrides)}`);
      }
      input = { ...input, ...overrides };
    }
    const resolved = resolveSpec(input, presets);
    const em = new Emitter(resolved, host);
    emitters.push(em);
    if (resolved.count > 0) em.burst(resolved.count);
    return em;
  }

  /**
   * @param {number} amount
   * @param {number} ms
   * @param {{freq?: number, decay?: number, axis?: 'both'|'x'|'y'}} [opts]
   */
  function shake(amount, ms, opts = {}) {
    if (typeof opts !== 'object' || opts === null) {
      throw new TypeError(`fx.shake: options must be an object, got ${describe(opts)}`);
    }
    const { freq = SHAKE_FREQ, decay = 2, axis = 'both' } = opts;
    for (const [name, v] of Object.entries({ amount, ms, freq, decay })) {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new TypeError(`fx.shake: ${name} must be a finite number, got ${describe(v)}`);
      }
    }
    if (!AXES.includes(axis)) {
      throw new TypeError(`fx.shake: axis must be one of ${AXES.join('|')}, got ${describe(axis)}`);
    }
    if (amount <= 0 || ms <= 0 || freq <= 0) return;
    const id = ++shakeCounter;
    shakes.push({
      amp: amount,
      ms,
      elapsed: 0,
      freq,
      decay: Math.max(0, decay),
      axis,
      sx: hash32(`shake:${id}:x`),
      sy: hash32(`shake:${id}:y`),
    });
    computeShake();
  }

  /**
   * @param {string} color
   * @param {number} ms
   * @param {{alpha?: number, ease?: string|((t: number) => number), hold?: number}} [opts]
   * @returns {Flash}
   */
  function flash(color, ms, opts = {}) {
    if (typeof opts !== 'object' || opts === null) {
      throw new TypeError(`fx.flash: options must be an object, got ${describe(opts)}`);
    }
    const { alpha = 0.85, ease: easing = 'outQuad', hold = 0 } = opts;
    if (typeof color !== 'string' || color === '') {
      throw new TypeError(`fx.flash: color must be a non-empty string, got ${describe(color)}`);
    }
    for (const [name, v] of Object.entries({ ms, alpha, hold })) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
        throw new RangeError(`fx.flash: ${name} must be a finite number >= 0, got ${describe(v)}`);
      }
    }
    const fl = new Flash(color, Math.max(ms, 1e-9), hold, Math.min(alpha, 1), resolveEase(easing));
    if (ms <= 0 && hold <= 0) fl.cancel();
    else flashes.push(fl);
    return fl;
  }

  /**
   * Advances everything by `dt` ms (negative `dt` counts as 0). Shakes and
   * flashes are time envelopes and always advance by the full `dt`, like
   * tweens, so they stay in sync with `tween.js` after a long frame. The
   * particle simulation (emission and integration) advances by at most
   * `maxDt` per call, so a hitch cannot tunnel particles through floors or
   * burst-spawn thousands of them.
   * @param {number} dt
   */
  function update(dt) {
    if (typeof dt !== 'number' || !Number.isFinite(dt)) {
      throw new TypeError(`fx.update: dt must be a finite number of milliseconds, got ${describe(dt)}`);
    }
    const elapsed = Math.max(0, dt);
    const step = Math.min(elapsed, maxDt);
    const s = step / 1000;

    if (shakes.length > 0) {
      for (const sh of shakes) sh.elapsed += elapsed;
      shakes = shakes.filter((sh) => sh.elapsed < sh.ms);
      computeShake();
    }
    if (flashes.length > 0) {
      for (const fl of flashes) fl.tick(elapsed);
      flashes = flashes.filter((fl) => !fl.done);
    }
    for (const em of emitters) em.tick(step);
    if (step > 0) filterLive((p) => integrate(p, s, step));
    if (emitters.length > 0) emitters = emitters.filter((em) => !em.done);
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{layer?: 'back'|'front', camera?: {x: number, y: number}}} [opts]
   */
  function draw(ctx, opts = {}) {
    if (!ctx || typeof ctx.fillRect !== 'function' || typeof ctx.save !== 'function') {
      throw new TypeError('fx.draw: expected a Canvas 2D context');
    }
    if (typeof opts !== 'object' || opts === null) {
      throw new TypeError(`fx.draw: options must be an object, got ${describe(opts)}`);
    }
    const { layer = null, camera = null } = opts;
    if (layer !== null && !LAYERS.includes(layer)) {
      throw new TypeError(`fx.draw: layer must be one of ${LAYERS.join('|')}, got ${describe(layer)}`);
    }
    const cx0 = camera ? camera.x : 0;
    const cy0 = camera ? camera.y : 0;
    ctx.save();
    let curFill = null;
    let curAlpha = -1;
    let curBlend = null;
    for (let i = 0; i < live.length; i++) {
      const p = live[i];
      if (layer !== null && p.layer !== layer) continue;
      const f = p.age / p.life;
      const a = p.alpha * fadeAt(p, f);
      if (a <= 0.004) continue;
      let x = p.x;
      let y = p.y;
      if (p.wobbleAmp > 0) x += Math.sin(p.phase + p.age * 0.001 * TWO_PI * p.wobbleFreq) * p.wobbleAmp;
      if (p.space === 'world') {
        x -= cx0;
        y -= cy0;
      }
      const color = p.ramp ? p.ramp[Math.min(p.ramp.length - 1, Math.floor(f * p.ramp.length))] : p.color;
      if (p.blend !== curBlend) {
        ctx.globalCompositeOperation = p.blend;
        curBlend = p.blend;
      }
      if (a !== curAlpha) {
        ctx.globalAlpha = a;
        curAlpha = a;
      }
      if (color !== curFill) {
        ctx.fillStyle = color;
        curFill = color;
      }
      drawShape(ctx, p, x, y, lerp(p.size0, p.size1, f));
    }
    ctx.restore();

    if ((layer === null || layer === 'front') && flashes.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      for (const fl of flashes) {
        const a = fl.alpha;
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = fl.color;
        ctx.fillRect(-FLASH_BLEED, -FLASH_BLEED, width + FLASH_BLEED * 2, height + FLASH_BLEED * 2);
      }
      ctx.restore();
    }
  }

  function clear() {
    filterLive(() => false);
    for (const em of emitters) em.stop();
    emitters = [];
    shakes = [];
    flashes = [];
    camX = 0;
    camY = 0;
    strength = 0;
  }

  return {
    particles,
    shake,
    flash,
    update,
    draw,
    cameraOffset: () => ({ x: camX, y: camY }),
    shakeStrength: () => strength,
    /**
     * @param {number} x
     * @param {number} y
     */
    setWind(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new TypeError(`fx.setWind: expected finite numbers, got ${describe(x)}, ${describe(y)}`);
      }
      windX = x;
      windY = y;
    },
    wind: () => ({ x: windX, y: windY }),
    clear,
    stats: () => ({
      particles: live.length,
      emitters: emitters.length,
      shakes: shakes.length,
      flashes: flashes.length,
      pooled: pool.length,
    }),
    snapshot: () =>
      live.map((p) => {
        const f = p.age / p.life;
        return {
          x: p.x,
          y: p.y,
          size: lerp(p.size0, p.size1, f),
          color: p.ramp ? p.ramp[Math.min(p.ramp.length - 1, Math.floor(f * p.ramp.length))] : p.color,
          alpha: p.alpha * fadeAt(p, f),
          layer: p.layer,
          space: p.space,
          shape: p.shape,
        };
      }),
    get particleCount() {
      return live.length;
    },
    get emitterCount() {
      return emitters.length;
    },
    get presetNames() {
      return Object.keys(presets);
    },
  };
}
