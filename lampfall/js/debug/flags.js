/**
 * URL boot flags. [BOOT]
 *
 * Pure: parses a query string into a typed {@link BootFlags} record. Every flag has a safe default,
 * malformed values fall back to that default instead of throwing, and `flagsToSearch` round-trips the
 * record back to a query string for links and tests.
 * @module debug/flags
 */

/**
 * @typedef {Object} BootFlags
 * @property {boolean} debug          install `window.__game` and the perf overlay (`?debug=1`)
 * @property {string|null} seed       seed code to start with (`?seed=DRIFT-K7Q2-MD7F`), upper-cased
 * @property {boolean} skipTitle      boot straight into the overworld with a default lease card
 * @property {number} speed           simulation multiplier, clamped to [0.25, 64]
 * @property {boolean|'auto'} touch   force the touch overlay on (`1`) or off (`0`); `auto` otherwise
 * @property {string|null} slot       save slot to load at boot (`auto:1`, `manual:2`)
 * @property {'integer'|'fit'|'auto'|null} scale  display scaling mode override
 * @property {boolean} mute           start with audio muted
 * @property {boolean} noanim         every transition and animation runs at 0 ms
 * @property {boolean} strict         wrap the world in a write-guard Proxy outside `store.tx`
 * @property {string|null} scene      scene name to push once the overworld is up (visual work)
 * @property {string|null} trainer    trainer id handed to `?scene=battle`
 */

const TRUE_WORDS = new Set(['1', 'true', 'yes', 'on']);
const FALSE_WORDS = new Set(['0', 'false', 'no', 'off']);
const SEED_RE = /^[A-Z0-9][A-Z0-9-]{2,}$/;
const SLOT_RE = /^(auto|manual):[1-9]\d*$/;
const NAME_RE = /^[a-zA-Z][a-zA-Z0-9-]*$/;

/** Speed bounds; `?speed=0` is treated as the default (no multiplier). */
export const SPEED_MIN = 0.25;
export const SPEED_MAX = 64;

/** The flags with their defaults, in URL order. */
export const DEFAULT_FLAGS = Object.freeze({
  debug: false,
  seed: null,
  skipTitle: false,
  speed: 1,
  touch: 'auto',
  slot: null,
  scale: null,
  mute: false,
  noanim: false,
  strict: false,
  scene: null,
  trainer: null,
});

/**
 * Reads a boolean flag. A bare key (`?debug`) counts as true.
 * @param {URLSearchParams} params
 * @param {string} key
 * @param {boolean} fallback
 * @returns {boolean}
 */
function readBool(params, key, fallback) {
  if (!params.has(key)) return fallback;
  const v = params.get(key).trim().toLowerCase();
  if (v === '' || TRUE_WORDS.has(v)) return true;
  if (FALSE_WORDS.has(v)) return false;
  return fallback;
}

/**
 * Parses `location.search` (or any query string) into boot flags.
 * @param {string|URLSearchParams|null|undefined} search  e.g. `'?debug=1&seed=DRIFT-K7Q2-MD7F'`
 * @returns {BootFlags} a fresh, mutable record (debug hooks such as `skipAnims` toggle fields on it)
 */
export function parseFlags(search) {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(typeof search === 'string' ? search : '');
  const flags = { ...DEFAULT_FLAGS };

  flags.debug = readBool(params, 'debug', false);
  flags.skipTitle = readBool(params, 'skipTitle', false);
  flags.mute = readBool(params, 'mute', false);
  flags.noanim = readBool(params, 'noanim', false);
  flags.strict = readBool(params, 'strict', false);

  const seed = (params.get('seed') ?? '').trim().toUpperCase();
  flags.seed = SEED_RE.test(seed) ? seed : null;

  const speed = Number.parseFloat(params.get('speed') ?? '');
  flags.speed = Number.isFinite(speed) && speed > 0
    ? Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed))
    : 1;

  if (params.has('touch')) {
    const t = params.get('touch').trim().toLowerCase();
    flags.touch = TRUE_WORDS.has(t) || t === '' ? true : FALSE_WORDS.has(t) ? false : 'auto';
  }

  const slot = (params.get('slot') ?? '').trim().toLowerCase();
  flags.slot = SLOT_RE.test(slot) ? slot : null;

  const scale = (params.get('scale') ?? '').trim().toLowerCase();
  flags.scale = scale === 'integer' || scale === 'fit' || scale === 'auto' ? scale : null;

  const scene = (params.get('scene') ?? '').trim();
  flags.scene = NAME_RE.test(scene) ? scene : null;

  const trainer = (params.get('trainer') ?? '').trim().toLowerCase();
  flags.trainer = NAME_RE.test(trainer) ? trainer : null;

  return flags;
}

/**
 * Serializes flags back to a query string, omitting defaults. Inverse of {@link parseFlags}.
 * @param {Partial<BootFlags>} flags
 * @returns {string} `'?debug=1&seed=...'` or `''` when every flag is default
 */
export function flagsToSearch(flags) {
  const params = new URLSearchParams();
  const f = { ...DEFAULT_FLAGS, ...flags };
  for (const key of ['debug', 'skipTitle', 'mute', 'noanim', 'strict']) {
    if (f[key]) params.set(key, '1');
  }
  if (f.seed) params.set('seed', f.seed);
  if (f.speed !== 1) params.set('speed', String(f.speed));
  if (f.touch !== 'auto') params.set('touch', f.touch ? '1' : '0');
  if (f.slot) params.set('slot', f.slot);
  if (f.scale) params.set('scale', f.scale);
  if (f.scene) params.set('scene', f.scene);
  if (f.trainer) params.set('trainer', f.trainer);
  const s = params.toString();
  return s ? `?${s}` : '';
}

/**
 * Whether a hostname is a local development host (debug hooks install there without `?debug=1`).
 * @param {string|null|undefined} hostname
 * @returns {boolean}
 */
export function isLocalhost(hostname) {
  if (typeof hostname !== 'string') return false;
  const h = hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]' || h.endsWith('.localhost');
}
