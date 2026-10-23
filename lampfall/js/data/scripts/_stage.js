/**
 * Staging helpers for the story scripts. [DATA-SCRIPTS] GDD-07.
 *
 * Story scripts place people by map MARKER NAME, never by raw coordinates (GDD-01 §1.5): every
 * helper here looks the marker up in the map module at import time and throws when it is missing,
 * so a renamed marker breaks the build instead of a cutscene. The ops these helpers return are
 * plain §6.1 ops (`teleport`, `warp`, `camera`, `face`, `setFlag`) and are frozen by the index.
 *
 * Hook flags (the script side of system calls no op expresses; see `SCRIPT_HOOKS` in ./index.js):
 *  - `sys.errand.<id>`     credits one First Night Errand (systems/loans.errand)
 *  - `sys.deliver.<event>` delivers an event letter (systems/letters.deliverEvent)
 *  - `sys.porch.<porchId>` a porch's lit state (systems/townCommon.porchFlag: true lit, false dark)
 *
 * Pure: no DOM, no randomness.
 * @module data/scripts/_stage
 */

import { MAPS_BY_ID } from '../maps/index.js';

/**
 * A marker's cell, or throws.
 * @param {string} mapId
 * @param {string} name
 * @returns {{x: number, y: number}}
 */
export function mk(mapId, name) {
  const map = MAPS_BY_ID[mapId];
  if (!map) throw new Error(`scripts/_stage: unknown map '${mapId}'`);
  const m = map.markers?.[name];
  if (!m || !Number.isInteger(m.x) || !Number.isInteger(m.y)) throw new Error(`scripts/_stage: map '${mapId}' has no marker '${name}'`);
  return { x: m.x, y: m.y };
}

/**
 * A marker shifted by a few cells (for a second person beside a staging marker).
 * @param {string} mapId @param {string} name @param {number} dx @param {number} dy
 * @returns {{x: number, y: number}}
 */
export function near(mapId, name, dx, dy) {
  const m = mk(mapId, name);
  return { x: m.x + dx, y: m.y + dy };
}

/**
 * Teleport someone (an npc id or 'player') onto a marker of the CURRENT map.
 * @param {string} who @param {string} mapId @param {string} name @param {number} [dx] @param {number} [dy]
 */
export const tp = (who, mapId, name, dx = 0, dy = 0) => {
  const m = mk(mapId, name);
  return { op: 'teleport', who, x: m.x + dx, y: m.y + dy };
};

/**
 * Warp the player to a marker (any map), optionally facing a way.
 * @param {string} mapId @param {string} name @param {string} [facing]
 */
export const warpTo = (mapId, name, facing) => {
  const m = mk(mapId, name);
  return facing ? { op: 'warp', mapId, x: m.x, y: m.y, facing } : { op: 'warp', mapId, x: m.x, y: m.y };
};

/**
 * Pan the camera to a marker of the current map.
 * @param {string} mapId @param {string} name @param {number} [ms]
 */
export const cam = (mapId, name, ms = 700) => {
  const m = mk(mapId, name);
  return { op: 'camera', to: [m.x, m.y], ms };
};

/** Camera back on the player. @param {number} [ms] */
export const camHome = (ms = 500) => ({ op: 'camera', to: 'player', ms });

/** @param {string} who @param {'up'|'down'|'left'|'right'|'player'} dir */
export const face = (who, dir) => ({ op: 'face', who, dir });

/** @param {string} who @param {'!'|'?'|'♥'|'…'|'zzz'} kind */
export const emote = (who, kind) => ({ op: 'emote', who, kind });

/** @param {string} id @param {boolean|number|string} [value] */
export const flag = (id, value) => (value === undefined ? { op: 'setFlag', id } : { op: 'setFlag', id, value });

/** A porch lamp on or off (systems/townCommon reads `sys.porch.<id>`). @param {string} porchId @param {boolean} lit */
export const porch = (porchId, lit) => ({ op: 'setFlag', id: `sys.porch.${porchId}`, value: lit });

/** Credits one First Night Errand (500 off loan 1) through the `sys.errand.<id>` hook. @param {string} id */
export const errand = (id) => ({ op: 'setFlag', id: `sys.errand.${id}` });

/** Delivers an event letter through the `sys.deliver.<event>` hook. @param {string} eventId */
export const deliver = (eventId) => ({ op: 'setFlag', id: `sys.deliver.${eventId}` });

/** @param {number} ms */
export const wait = (ms) => ({ op: 'wait', ms });

/** @param {string} name */
export const sfx = (name) => ({ op: 'playSfx', name });

/** @param {string|null} track @param {number} [fade] */
export const music = (track, fade) => (fade === undefined ? { op: 'music', track } : { op: 'music', track, fade });

/** @param {string} text */
export const toast = (text) => ({ op: 'toast', text });

/** @param {string} script */
export const call = (script) => ({ op: 'call', script });

/** @param {string} id */
export const label = (id) => ({ op: 'label', id });

/** @param {string} id */
export const go = (id) => ({ op: 'goto', id });

/** The closing op. */
export const END = Object.freeze({ op: 'end' });

/**
 * A line by the dial (`run.dial`): `{drift, flux, freefall}` -> a `branch` op of says.
 * @param {{drift: Array<any>, flux: Array<any>, freefall: Array<any>}} byDial
 */
export const byDial = (byDial) => ({ op: 'branch', on: 'dial', cases: { drift: byDial.drift, flux: byDial.flux, freefall: byDial.freefall, default: byDial.flux } });
