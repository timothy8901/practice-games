/**
 * Player settings (`world.settings`): defaults, normalization, update with a side-effect list, and
 * the localStorage mirror (so the title screen honours volume / scale / reduced motion before any
 * world exists). Owner of `world.settings`.
 *
 * This module never touches the DOM: {@link apply} returns a list of effects and `main.js` /
 * `scenes/settings.js` perform them (`audio.setVolume`, `clockSys.applySettingsEffects`, ...). The mirror
 * helpers take a `StorageLike` so Node tests pass a Map-backed one.
 *
 * Pure. Lane: STATE.
 * @module systems/settings
 */

import { settingsDefaults, TEXT_SPEEDS, SCALE_MODES, AUTO_ANCHOR_MODES, isPlainObject } from '../state/schema.js';

/** @typedef {import('../state/schema.js').Settings} Settings */
/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../core/save.js').StorageLike} StorageLike */
/** @typedef {{bus?: {emit: (evt: string, payload: any) => any}|null}} Ctx */

/**
 * One thing the shell must do after a setting changed. `kind` names the subsystem; the payload is
 * the new value.
 * @typedef {{kind: 'audio.volume', volumes: Settings['volumes']}
 *   | {kind: 'audio.mute', muted: boolean}
 *   | {kind: 'clock.minutesPerDay', minutesPerDay: number}
 *   | {kind: 'clock.realClock', realClock: boolean}
 *   | {kind: 'display.scale', scale: Settings['scale']}
 *   | {kind: 'input.bindings', bindings: object|null}
 *   | {kind: 'motion.reduced', reducedMotion: boolean}
 *   | {kind: 'loop.fps30', fps30: boolean}
 *   | {kind: 'text.speed', textSpeed: Settings['textSpeed'], charsPerSecond: number}
 *   | {kind: 'anims.skip', skipAnims: boolean}
 *   | {kind: 'anchor.auto', autoAnchor: Settings['autoAnchor']}} SideEffect
 */

/** Fresh copy of the defaults. */
export const DEFAULTS = Object.freeze(settingsDefaults());

/** Typewriter speed per `textSpeed`, in characters per second. */
export const TEXT_SPEED_CPS = Object.freeze({ slow: 20, normal: 45, fast: 90, instant: Infinity });

/** Bounds for `minutesPerDay` (real minutes per in-game day). */
export const MINUTES_PER_DAY_RANGE = Object.freeze({ min: 6, max: 120 });

/** localStorage key of the settings mirror. // [GDD: title prefix] */
export const MIRROR_KEY = 'GAME.settings';

/** Keys the mirror carries (device-level preferences; nothing run-specific). */
export const MIRRORED_KEYS = Object.freeze(['volumes', 'muted', 'textSpeed', 'scale', 'bindings', 'reducedMotion', 'fps30', 'skipAnims', 'minutesPerDay']);

/**
 * @param {unknown} v
 * @param {number} fallback
 * @returns {number}
 */
function unit(v, fallback) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

/**
 * Coerces any partial / untrusted object into a complete, in-range Settings. Unknown keys are
 * dropped, wrong types fall back to the default, numbers are clamped.
 * @param {unknown} partial
 * @param {Settings} [base] what to fill from (defaults)
 * @returns {Settings}
 */
export function normalize(partial, base = settingsDefaults()) {
  const p = isPlainObject(partial) ? partial : {};
  const out = { ...base, volumes: { ...base.volumes }, autoAnchor: { ...base.autoAnchor } };
  if (isPlainObject(p.volumes)) {
    for (const k of ['master', 'music', 'sfx']) out.volumes[k] = unit(p.volumes[k], base.volumes[k]);
  }
  if (typeof p.muted === 'boolean') out.muted = p.muted;
  if (TEXT_SPEEDS.includes(p.textSpeed)) out.textSpeed = p.textSpeed;
  if (typeof p.minutesPerDay === 'number' && Number.isFinite(p.minutesPerDay)) {
    out.minutesPerDay = Math.min(MINUTES_PER_DAY_RANGE.max, Math.max(MINUTES_PER_DAY_RANGE.min, p.minutesPerDay));
  }
  if (typeof p.realClock === 'boolean') out.realClock = p.realClock;
  if (SCALE_MODES.includes(p.scale)) out.scale = p.scale;
  if (p.bindings === null || isPlainObject(p.bindings)) out.bindings = p.bindings === null ? null : { ...p.bindings };
  if (typeof p.reducedMotion === 'boolean') out.reducedMotion = p.reducedMotion;
  if (typeof p.fps30 === 'boolean') out.fps30 = p.fps30;
  if (typeof p.skipAnims === 'boolean') out.skipAnims = p.skipAnims;
  if (isPlainObject(p.autoAnchor)) {
    out.autoAnchor = {};
    for (const [uid, mode] of Object.entries(p.autoAnchor)) {
      if (mode === null || AUTO_ANCHOR_MODES.includes(mode)) out.autoAnchor[uid] = mode;
    }
  }
  return out;
}

/**
 * Characters per second for the typewriter under `settings`.
 * @param {Settings} settings
 * @returns {number} `Infinity` for instant
 */
export function textCharsPerSecond(settings) {
  return TEXT_SPEED_CPS[settings?.textSpeed] ?? TEXT_SPEED_CPS.normal;
}

/**
 * Side effects needed to bring the shell in line with `settings`. With `prev`, only the keys that
 * differ produce an effect; without it, every subsystem gets its value (boot, load).
 * @param {Settings} settings
 * @param {Settings|null} [prev]
 * @returns {SideEffect[]}
 */
export function apply(settings, prev = null) {
  const s = normalize(settings);
  const p = prev ? normalize(prev) : null;
  const changed = (key) => !p || JSON.stringify(p[key]) !== JSON.stringify(s[key]);
  /** @type {SideEffect[]} */
  const out = [];
  if (changed('volumes')) out.push({ kind: 'audio.volume', volumes: { ...s.volumes } });
  if (changed('muted')) out.push({ kind: 'audio.mute', muted: s.muted });
  if (changed('minutesPerDay')) out.push({ kind: 'clock.minutesPerDay', minutesPerDay: s.minutesPerDay });
  if (changed('realClock')) out.push({ kind: 'clock.realClock', realClock: s.realClock });
  if (changed('scale')) out.push({ kind: 'display.scale', scale: s.scale });
  if (changed('bindings')) out.push({ kind: 'input.bindings', bindings: s.bindings ? { ...s.bindings } : null });
  if (changed('reducedMotion')) out.push({ kind: 'motion.reduced', reducedMotion: s.reducedMotion });
  if (changed('fps30')) out.push({ kind: 'loop.fps30', fps30: s.fps30 });
  if (changed('textSpeed')) out.push({ kind: 'text.speed', textSpeed: s.textSpeed, charsPerSecond: textCharsPerSecond(s) });
  if (changed('skipAnims')) out.push({ kind: 'anims.skip', skipAnims: s.skipAnims });
  if (changed('autoAnchor')) out.push({ kind: 'anchor.auto', autoAnchor: { ...s.autoAnchor } });
  return out;
}

/**
 * Applies a patch to `world.settings` (inside a tx) and returns the changed keys and the effects to
 * perform. Emits `settings:changed` `{changed, settings}` when a bus is given and something changed.
 * @param {World} world
 * @param {Partial<Settings>} patch
 * @param {Ctx} [ctx]
 * @returns {{changed: string[], effects: SideEffect[], settings: Settings}}
 */
export function update(world, patch, ctx) {
  if (!isPlainObject(patch)) throw new TypeError('settings.update: patch must be an object');
  const prev = normalize(world.settings);
  const merged = normalize({ ...prev, ...patch, volumes: { ...prev.volumes, ...(isPlainObject(patch.volumes) ? patch.volumes : {}) } }, prev);
  const changed = Object.keys(merged).filter((k) => JSON.stringify(merged[k]) !== JSON.stringify(prev[k]));
  if (changed.length === 0) return { changed, effects: [], settings: world.settings };
  for (const k of changed) world.settings[k] = merged[k];
  const effects = apply(merged, prev);
  ctx?.bus?.emit('settings:changed', { changed, settings: world.settings });
  return { changed, effects, settings: world.settings };
}

/**
 * Sets a creature's auto-anchor preset (`null` clears it).
 * @param {World} world
 * @param {string} uid
 * @param {'auto-anchor'|'auto-up'|null} mode
 * @param {Ctx} [ctx]
 * @returns {ReturnType<typeof update>}
 */
export function setAutoAnchor(world, uid, mode, ctx) {
  if (typeof uid !== 'string' || !uid) throw new TypeError('settings.setAutoAnchor: uid must be a non-empty string');
  if (mode !== null && !AUTO_ANCHOR_MODES.includes(mode)) throw new TypeError(`settings.setAutoAnchor: mode must be null or one of ${AUTO_ANCHOR_MODES.join(', ')}`);
  const autoAnchor = { ...world.settings.autoAnchor };
  if (mode === null) delete autoAnchor[uid]; else autoAnchor[uid] = mode;
  return update(world, { autoAnchor }, ctx);
}

/**
 * The device-level subset of `settings`, as the JSON string stored in the mirror.
 * @param {Settings} settings
 * @returns {string}
 */
export function toMirror(settings) {
  const s = normalize(settings);
  /** @type {Record<string, any>} */
  const out = {};
  for (const k of MIRRORED_KEYS) out[k] = s[k];
  return JSON.stringify(out);
}

/**
 * Parses a mirror string; `null` when it is not usable.
 * @param {unknown} text
 * @returns {Partial<Settings>|null}
 */
export function fromMirror(text) {
  if (typeof text !== 'string' || !text) return null;
  try {
    const parsed = JSON.parse(text);
    if (!isPlainObject(parsed)) return null;
    /** @type {Record<string, any>} */
    const out = {};
    for (const k of MIRRORED_KEYS) if (parsed[k] !== undefined) out[k] = parsed[k];
    return out;
  } catch {
    return null;
  }
}

/**
 * Reads the mirror from a storage. Never throws; defaults when missing or unreadable.
 * @param {StorageLike|null|undefined} storage
 * @param {string} [key]
 * @returns {Settings}
 */
export function readMirror(storage, key = MIRROR_KEY) {
  try {
    return normalize(fromMirror(storage?.getItem(key)));
  } catch {
    return settingsDefaults();
  }
}

/**
 * Writes the mirror. Never throws; returns whether the write happened.
 * @param {StorageLike|null|undefined} storage
 * @param {Settings} settings
 * @param {string} [key]
 * @returns {boolean}
 */
export function writeMirror(storage, settings, key = MIRROR_KEY) {
  try {
    if (!storage || typeof storage.setItem !== 'function') return false;
    storage.setItem(key, toMirror(settings));
    return true;
  } catch {
    return false;
  }
}
