/**
 * Easing curves and a small deterministic tween scheduler.
 *
 * Pure module: no DOM access, no timers, no module-level side effects, so it
 * runs unchanged under Node (`node --test`) and in the browser. Time never
 * comes from a clock; the owner feeds elapsed milliseconds into
 * {@link Tweens#update update(dt)}, which makes every animation reproducible
 * (and pausable, slowable or fast-forwardable by feeding different `dt`s).
 *
 * - {@link ease}: a frozen table of easing functions `t in [0,1] -> value`.
 * - {@link createTweens}: `to(obj, props, ms, opts)` animates numeric
 *   properties in place; tweens may be delayed, repeated, yoyo'd, paused,
 *   cancelled or finished early, and expose a lazily created promise.
 * - {@link resolveEase}, {@link lerp}, {@link clamp01}: helpers shared with
 *   `fx.js` and the scene transitions.
 *
 * Units: durations, delays and `dt` are all MILLISECONDS, the same convention
 * as `scene.js`. Values always land exactly on their targets at the end of a
 * tween (no floating-point drift), and a single huge `dt` completes a tween
 * instead of overshooting it.
 *
 * @module core/tween
 */

// ---------------------------------------------------------------------------
// Shared helpers
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
  return typeof v;
}

/**
 * Clamps a number into `[0, 1]`. `NaN` becomes 0.
 * @param {number} t
 * @returns {number}
 */
export function clamp01(t) {
  return t > 1 ? 1 : t > 0 ? t : 0;
}

/**
 * Linear interpolation that is exact at both ends (`lerp(a, b, 0) === a`,
 * `lerp(a, b, 1) === b` with no rounding error), which keeps tweened values
 * landing precisely on their targets. `t` is not clamped, so eased factors
 * that overshoot (`outBack`, `outElastic`) extrapolate as intended.
 *
 * @param {number} a value at `t = 0`
 * @param {number} b value at `t = 1`
 * @param {number} t interpolation factor
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a * (1 - t) + b * t;
}

// ---------------------------------------------------------------------------
// Easing
// ---------------------------------------------------------------------------

/** Overshoot constant of the "back" family (Penner's default, ~10%). */
const BACK_S = 1.70158;
/** Overshoot constant for the in-out "back" curve (Penner's `s * 1.525`). */
const BACK_S2 = BACK_S * 1.525;
const TWO_PI = Math.PI * 2;
/** Angular period of the elastic family (one full wobble every 0.3 of `t`). */
const ELASTIC_P = TWO_PI / 3;
const ELASTIC_P2 = TWO_PI / 4.5;

/**
 * Penner's bounce-out curve: four parabolic bounces of decreasing height.
 * @param {number} t
 * @returns {number}
 */
function bounceOut(t) {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) {
    const u = t - 1.5 / d1;
    return n1 * u * u + 0.75;
  }
  if (t < 2.5 / d1) {
    const u = t - 2.25 / d1;
    return n1 * u * u + 0.9375;
  }
  const u = t - 2.625 / d1;
  return n1 * u * u + 0.984375;
}

/**
 * Easing functions. Every curve maps `0 -> 0` and `1 -> 1`; the `*Back` and
 * `*Elastic` families deliberately overshoot in between, `step` holds 0 and
 * snaps to 1 at the end. Callers are expected to pass `t` in `[0, 1]`; the
 * tween scheduler always does.
 *
 * Contract members: `linear, inQuad, outQuad, inOutQuad, outCubic,
 * inOutCubic, outBack, outElastic, outBounce`. The rest are extras.
 *
 * @type {Readonly<Record<string, (t: number) => number>>}
 */
export const ease = Object.freeze({
  linear: (t) => t,

  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),

  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),

  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - (1 - t) ** 4,
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - (-2 * t + 2) ** 4 / 2),

  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,

  inExpo: (t) => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
  outExpo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  inOutExpo: (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2;
  },

  inCirc: (t) => 1 - Math.sqrt(1 - t * t),
  outCirc: (t) => Math.sqrt(1 - (t - 1) ** 2),

  inBack: (t) => (BACK_S + 1) * t * t * t - BACK_S * t * t,
  outBack: (t) => 1 + (BACK_S + 1) * (t - 1) ** 3 + BACK_S * (t - 1) ** 2,
  inOutBack: (t) =>
    t < 0.5
      ? ((2 * t) ** 2 * ((BACK_S2 + 1) * 2 * t - BACK_S2)) / 2
      : ((2 * t - 2) ** 2 * ((BACK_S2 + 1) * (t * 2 - 2) + BACK_S2) + 2) / 2,

  inElastic: (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return -(2 ** (10 * t - 10)) * Math.sin((t * 10 - 10.75) * ELASTIC_P);
  },
  outElastic: (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ELASTIC_P) + 1;
  },
  inOutElastic: (t) => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < 0.5
      ? -(2 ** (20 * t - 10) * Math.sin((20 * t - 11.125) * ELASTIC_P2)) / 2
      : (2 ** (-20 * t + 10) * Math.sin((20 * t - 11.125) * ELASTIC_P2)) / 2 + 1;
  },

  inBounce: (t) => 1 - bounceOut(1 - t),
  outBounce: bounceOut,
  inOutBounce: (t) => (t < 0.5 ? (1 - bounceOut(1 - 2 * t)) / 2 : (1 + bounceOut(2 * t - 1)) / 2),

  smoothstep: (t) => t * t * (3 - 2 * t),
  smootherstep: (t) => t * t * t * (t * (6 * t - 15) + 10),
  step: (t) => (t >= 1 ? 1 : 0),
});

/**
 * Turns an easing specification into a function: an easing function is
 * returned as-is, a string is looked up in {@link ease}, and `undefined` or
 * `null` means `ease.linear`.
 *
 * @param {string|((t: number) => number)|null|undefined} spec
 * @returns {(t: number) => number}
 * @throws {TypeError} for an unknown name or any other type
 */
export function resolveEase(spec) {
  if (spec === undefined || spec === null) return ease.linear;
  if (typeof spec === 'function') return spec;
  if (typeof spec === 'string') {
    const fn = Object.hasOwn(ease, spec) ? ease[spec] : null;
    if (fn) return fn;
    throw new TypeError(`resolveEase: unknown easing "${spec}" (known: ${Object.keys(ease).join(', ')})`);
  }
  throw new TypeError(`resolveEase: expected an easing name or function, got ${describe(spec)}`);
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * @param {string} where caller name for the message
 * @param {string} name argument name
 * @param {unknown} v
 * @returns {number}
 * @throws {TypeError|RangeError}
 */
function assertNonNegativeMs(where, name, v) {
  if (typeof v !== 'number' || Number.isNaN(v)) {
    throw new TypeError(`${where}: ${name} must be a number of milliseconds, got ${describe(v)}`);
  }
  if (v < 0 || !Number.isFinite(v)) {
    throw new RangeError(`${where}: ${name} must be finite and >= 0, got ${v}`);
  }
  return v;
}

/**
 * @param {string} where
 * @param {string} name
 * @param {unknown} fn
 * @returns {Function|null}
 * @throws {TypeError}
 */
function optionalFn(where, name, fn) {
  if (fn === undefined || fn === null) return null;
  if (typeof fn !== 'function') {
    throw new TypeError(`${where}: ${name} must be a function, got ${describe(fn)}`);
  }
  return fn;
}

/**
 * @param {unknown} v
 * @returns {boolean} true for any non-null object or function
 */
function isObjectLike(v) {
  return (typeof v === 'object' && v !== null) || typeof v === 'function';
}

// ---------------------------------------------------------------------------
// Tween
// ---------------------------------------------------------------------------

/** Internal lifecycle states. */
const PENDING = 0;
const RUNNING = 1;
const FINISHED = 2;
const CANCELLED = 3;

/**
 * Options accepted by {@link Tweens#to}.
 *
 * @typedef {Object} TweenOptions
 * @property {string|((t: number) => number)} [ease='linear'] Easing name (see {@link ease}) or function.
 * @property {number} [delay=0] Milliseconds to wait before the tween starts. Start values are
 *   captured when the delay ends, not when `to()` is called.
 * @property {(tween: Tween) => void} [onDone] Called once when the tween completes (not when cancelled).
 * @property {(k: number, tween: Tween) => void} [onUpdate] Called after every applied frame with the
 *   eased factor `k` of the current cycle (final frame included).
 * @property {(tween: Tween) => void} [onStart] Called once, right after start values are captured.
 * @property {Record<string, number>} [from] Explicit start values (applied to the target at start).
 *   Every key must also be in `props`.
 * @property {number} [repeat=0] Extra plays after the first; `Infinity` loops forever.
 * @property {boolean} [yoyo=false] Alternate direction on each repeat (odd cycles run backwards).
 * @property {boolean} [overwrite=false] Cancel every other running tween on the same target first.
 */

/**
 * A running (or finished) animation of numeric properties. Instances are
 * created by {@link Tweens#to}; the class is exported for type references.
 */
export class Tween {
  /** @type {object} */
  #target;
  /** @type {string[]} */
  #keys;
  /** @type {number[]} end values, parallel to `#keys` */
  #to;
  /** @type {number[]} start values captured at start, parallel to `#keys` */
  #from;
  /** @type {number[]} values seen at creation; fallback when the start value went non-numeric */
  #initial;
  /** @type {Record<string, number>|null} */
  #fromSpec;
  /** @type {(t: number) => number} */
  #ease;
  /** @type {number} */
  #duration;
  /** @type {number} */
  #delayLeft;
  /** @type {number} active milliseconds (after the delay) */
  #elapsed = 0;
  /** @type {number} number of cycles (repeat + 1), may be Infinity */
  #cycles;
  /** @type {number} duration * cycles, may be Infinity */
  #total;
  /** @type {boolean} */
  #yoyo;
  /** @type {Function|null} */
  #onDone;
  /** @type {Function|null} */
  #onUpdate;
  /** @type {Function|null} */
  #onStart;
  /** @type {number} one of PENDING/RUNNING/FINISHED/CANCELLED */
  #state = PENDING;
  /** @type {boolean} */
  #paused = false;
  /** @type {Promise<boolean>|null} */
  #promise = null;
  /** @type {((v: boolean) => void)|null} */
  #resolve = null;

  /**
   * @param {object} target
   * @param {Record<string, number>} props
   * @param {number} ms
   * @param {TweenOptions} opts already validated by {@link Tweens#to}
   * @param {(t: number) => number} easeFn
   * @package
   */
  constructor(target, props, ms, opts, easeFn) {
    this.#target = target;
    this.#keys = Object.keys(props);
    this.#to = this.#keys.map((k) => props[k]);
    this.#initial = this.#keys.map((k) => target[k]);
    this.#from = this.#initial.slice();
    this.#fromSpec = opts.from ?? null;
    this.#ease = easeFn;
    this.#duration = ms;
    this.#delayLeft = opts.delay ?? 0;
    const repeat = opts.repeat ?? 0;
    this.#cycles = repeat === Infinity ? Infinity : repeat + 1;
    this.#total = ms === 0 ? 0 : ms * this.#cycles;
    this.#yoyo = opts.yoyo === true;
    this.#onDone = opts.onDone ?? null;
    this.#onUpdate = opts.onUpdate ?? null;
    this.#onStart = opts.onStart ?? null;
  }

  /** The object whose properties are animated. @type {object} */
  get target() {
    return this.#target;
  }

  /** Duration of one cycle in milliseconds. @type {number} */
  get duration() {
    return this.#duration;
  }

  /** Active milliseconds so far (the delay does not count). @type {number} */
  get elapsed() {
    return this.#elapsed;
  }

  /** True once the tween completed or was cancelled. @type {boolean} */
  get done() {
    return this.#state === FINISHED || this.#state === CANCELLED;
  }

  /** True when the tween completed normally (not cancelled). @type {boolean} */
  get finished() {
    return this.#state === FINISHED;
  }

  /** True when {@link Tween#cancel} ended the tween. @type {boolean} */
  get cancelled() {
    return this.#state === CANCELLED;
  }

  /** True after the delay elapsed and start values were captured. @type {boolean} */
  get started() {
    return this.#state !== PENDING;
  }

  /** True while paused via {@link Tween#pause}. @type {boolean} */
  get paused() {
    return this.#paused;
  }

  /**
   * Linear fraction of the whole tween in `[0, 1]` (delay excluded, repeats
   * included). For endless tweens it is the fraction of the current cycle.
   * @type {number}
   */
  get progress() {
    if (this.#state === FINISHED) return 1;
    if (this.#state === PENDING) return 0;
    if (this.#duration === 0) return this.#state === CANCELLED ? 0 : 1;
    if (this.#total === Infinity) {
      return (this.#elapsed % this.#duration) / this.#duration;
    }
    return clamp01(this.#elapsed / this.#total);
  }

  /**
   * Resolves to `true` when the tween completes, `false` when it is cancelled
   * (including via `clear()`/`stop()`). Created lazily.
   * @type {Promise<boolean>}
   */
  get promise() {
    if (!this.#promise) {
      if (this.done) {
        this.#promise = Promise.resolve(this.#state === FINISHED);
      } else {
        this.#promise = new Promise((resolve) => {
          this.#resolve = resolve;
        });
      }
    }
    return this.#promise;
  }

  /** Freezes the tween in place until {@link Tween#resume}. */
  pause() {
    this.#paused = true;
  }

  /** Continues a paused tween. */
  resume() {
    this.#paused = false;
  }

  /**
   * Stops the tween where it is. Values are left as they are and `onDone`
   * is NOT called. Safe to call more than once.
   */
  cancel() {
    if (this.done) return;
    this.#state = CANCELLED;
    this.#settle(false);
  }

  /**
   * Jumps straight to the end: final values are written, `onUpdate` sees the
   * last frame and `onDone` fires. An endless tween finishes at the end of
   * its current cycle. Safe to call more than once.
   */
  finish() {
    if (this.done) return;
    if (this.#state === PENDING) this.#start();
    this.#delayLeft = 0;
    if (this.#total !== Infinity) {
      this.#elapsed = this.#total;
    } else {
      const d = this.#duration;
      this.#elapsed = Math.ceil(this.#elapsed / d) * d;
      if (this.#elapsed === 0) this.#elapsed = d;
    }
    this.#apply(true);
    this.#complete();
  }

  /**
   * Advances the tween by `dt` milliseconds (already time-scaled).
   * @param {number} dt
   * @package
   */
  step(dt) {
    if (this.done || this.#paused) return;
    if (this.#delayLeft > 0) {
      if (dt < this.#delayLeft) {
        this.#delayLeft -= dt;
        return;
      }
      dt -= this.#delayLeft;
      this.#delayLeft = 0;
    }
    if (this.#state === PENDING) this.#start();
    this.#elapsed += dt;
    const final = this.#elapsed >= this.#total;
    this.#apply(final);
    if (final) this.#complete();
  }

  /** Captures start values, applies `from`, fires `onStart`. */
  #start() {
    this.#state = RUNNING;
    const target = this.#target;
    const spec = this.#fromSpec;
    for (let i = 0; i < this.#keys.length; i++) {
      const key = this.#keys[i];
      let v;
      if (spec && Object.hasOwn(spec, key)) {
        v = spec[key];
        target[key] = v;
      } else {
        v = target[key];
        if (!Number.isFinite(v)) v = this.#initial[i];
      }
      this.#from[i] = v;
    }
    this.#onStart?.(this);
  }

  /**
   * Writes interpolated values for the current `elapsed`.
   * @param {boolean} final true when this is the last frame (snap to the end of the last cycle)
   */
  #apply(final) {
    const d = this.#duration;
    let cycle;
    let local;
    if (d === 0 || (final && this.#total !== Infinity)) {
      cycle = this.#cycles === Infinity ? 0 : this.#cycles - 1;
      local = 1;
    } else if (final) {
      cycle = Math.max(0, Math.ceil(this.#elapsed / d) - 1);
      local = 1;
    } else {
      cycle = Math.floor(this.#elapsed / d);
      local = (this.#elapsed - cycle * d) / d;
    }
    if (this.#yoyo && cycle % 2 === 1) local = 1 - local;
    const k = this.#ease(local);
    const target = this.#target;
    const keys = this.#keys;
    const from = this.#from;
    const to = this.#to;
    for (let i = 0; i < keys.length; i++) {
      target[keys[i]] = local >= 1 ? to[i] : local <= 0 ? from[i] : lerp(from[i], to[i], k);
    }
    this.#onUpdate?.(k, this);
  }

  /** Marks the tween finished and fires `onDone`. */
  #complete() {
    this.#state = FINISHED;
    this.#settle(true);
    this.#onDone?.(this);
  }

  /** @param {boolean} ok */
  #settle(ok) {
    if (this.#resolve) {
      this.#resolve(ok);
      this.#resolve = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Tweens
 * @property {(obj: object, props: Record<string, number>, ms: number, opts?: TweenOptions) => Tween} to
 *   Animates the numeric properties in `props` from their current values to the given ones over `ms`.
 * @property {(ms: number, fn?: (tween: Tween) => void, opts?: {delay?: number}) => Tween} wait
 *   A timer: calls `fn` after `ms` milliseconds of scheduler time.
 * @property {(obj: object) => number} stop Cancels every running tween on `obj`; returns how many.
 * @property {(dt: number) => void} update Advances all tweens by `dt` milliseconds.
 * @property {() => void} clear Cancels every tween.
 * @property {number} count Number of running (not done) tweens.
 * @property {number} timeScale Multiplier applied to every `dt` (0 pauses everything).
 */

/**
 * Creates an independent tween scheduler. Each scene typically owns one so
 * that popping the scene drops its animations with it.
 *
 * Determinism: given the same calls and the same sequence of `dt`s, two
 * schedulers produce identical values; nothing reads a clock. Tweens created
 * inside a callback during `update()` start on the next `update()`.
 *
 * @param {{timeScale?: number}} [options]
 * @returns {Tweens}
 */
export function createTweens({ timeScale = 1 } = {}) {
  /** @type {Tween[]} */
  let list = [];
  let scale = validateScale(timeScale);

  /**
   * @param {unknown} v
   * @returns {number}
   */
  function validateScale(v) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new RangeError(`tweens.timeScale: expected a finite number >= 0, got ${describe(v)}`);
    }
    return v;
  }

  /**
   * @param {object} obj
   * @param {Record<string, number>} props
   * @param {number} ms
   * @param {TweenOptions} [opts]
   * @returns {Tween}
   */
  function to(obj, props, ms, opts = {}) {
    if (!isObjectLike(obj)) {
      throw new TypeError(`tweens.to: target must be an object, got ${describe(obj)}`);
    }
    if (typeof props !== 'object' || props === null || Array.isArray(props)) {
      throw new TypeError(`tweens.to: props must be an object of numeric targets, got ${describe(props)}`);
    }
    if (typeof opts !== 'object' || opts === null) {
      throw new TypeError(`tweens.to: options must be an object, got ${describe(opts)}`);
    }
    assertNonNegativeMs('tweens.to', 'ms', ms);
    const delay = opts.delay === undefined ? 0 : assertNonNegativeMs('tweens.to', 'delay', opts.delay);
    const repeat = opts.repeat === undefined ? 0 : opts.repeat;
    if (repeat !== Infinity && (!Number.isInteger(repeat) || repeat < 0)) {
      throw new RangeError(`tweens.to: repeat must be a non-negative integer or Infinity, got ${describe(repeat)}`);
    }
    const from = opts.from === undefined || opts.from === null ? undefined : opts.from;
    if (from !== undefined && (typeof from !== 'object' || Array.isArray(from))) {
      throw new TypeError(`tweens.to: from must be an object, got ${describe(from)}`);
    }
    for (const key of Object.keys(props)) {
      const end = props[key];
      if (typeof end !== 'number' || !Number.isFinite(end)) {
        throw new TypeError(`tweens.to: props.${key} must be a finite number, got ${describe(end)}`);
      }
      const hasFrom = from !== undefined && Object.hasOwn(from, key);
      if (hasFrom) {
        if (typeof from[key] !== 'number' || !Number.isFinite(from[key])) {
          throw new TypeError(`tweens.to: from.${key} must be a finite number, got ${describe(from[key])}`);
        }
      } else if (typeof obj[key] !== 'number' || !Number.isFinite(obj[key])) {
        throw new TypeError(
          `tweens.to: target.${key} is ${describe(obj[key])}; set a numeric start value or pass from.${key}`,
        );
      }
    }
    if (from !== undefined) {
      for (const key of Object.keys(from)) {
        if (!Object.hasOwn(props, key)) {
          throw new TypeError(`tweens.to: from.${key} has no matching entry in props`);
        }
      }
    }
    const easeFn = resolveEase(opts.ease);
    const validated = {
      delay,
      repeat,
      from,
      yoyo: opts.yoyo === true,
      onDone: optionalFn('tweens.to', 'onDone', opts.onDone),
      onUpdate: optionalFn('tweens.to', 'onUpdate', opts.onUpdate),
      onStart: optionalFn('tweens.to', 'onStart', opts.onStart),
    };
    if (opts.overwrite === true) stop(obj);
    const tween = new Tween(obj, props, ms, validated, easeFn);
    list.push(tween);
    return tween;
  }

  /**
   * @param {number} ms
   * @param {(tween: Tween) => void} [fn]
   * @param {{delay?: number}} [opts]
   * @returns {Tween}
   */
  function wait(ms, fn, opts = {}) {
    return to({}, {}, ms, { delay: opts.delay, onDone: fn ?? undefined });
  }

  /**
   * @param {object} obj
   * @returns {number}
   */
  function stop(obj) {
    let n = 0;
    for (const tween of list) {
      if (tween.target === obj && !tween.done) {
        tween.cancel();
        n++;
      }
    }
    return n;
  }

  /** @param {number} dt */
  function update(dt) {
    if (typeof dt !== 'number' || !Number.isFinite(dt)) {
      throw new TypeError(`tweens.update: dt must be a finite number of milliseconds, got ${describe(dt)}`);
    }
    const step = Math.max(0, dt) * scale;
    const arr = list;
    const n = arr.length;
    for (let i = 0; i < n; i++) {
      arr[i].step(step);
      // clear() inside a callback swaps the list; the old one is abandoned.
      if (list !== arr) return;
    }
    let w = 0;
    for (let i = 0; i < arr.length; i++) {
      if (!arr[i].done) arr[w++] = arr[i];
    }
    arr.length = w;
  }

  function clear() {
    const old = list;
    list = [];
    for (const tween of old) tween.cancel();
  }

  return {
    to,
    wait,
    stop,
    update,
    clear,
    get count() {
      let n = 0;
      for (const tween of list) if (!tween.done) n++;
      return n;
    },
    get timeScale() {
      return scale;
    },
    set timeScale(v) {
      scale = validateScale(v);
    },
  };
}
