/**
 * The cottage's commissioned rooms at work (GDD-00 §7 rooms table; GDD-02 §3; data/loans `effects`).
 * [FLOW]
 *
 *  - **Workshop** (`cleanBench`, `tiltBench`): the fossil bench takes one fossil for the night and it
 *    comes back cleaned (+40% to Barnaby, `fieldLog.benchClean`); the polisher takes one skyglass
 *    relic (`tiltsFrom`) and the type you choose, and the morning leaves that type tilt (`tiltIds`) on
 *    the bench (held: that type's forms weigh ×2 on every Forecast card).
 *  - **Greenhouse** (`bondNight`): the bench keeps one party creature and its favourite fruit (the fruit
 *    row's `favouredBy` holds its type) overnight: +1 Bond in the morning, once per creature.
 *  - **Porch & Loft** (`telescopeErrants`): the loft telescope names the Errants on the wing tonight,
 *    seen or not (systems/encounter `errantMarkers` with `reveal`).
 *
 * What sits on a bench overnight lives in flags (systems/flags): `sys.bench.fossil` (find id),
 * `sys.bench.tilt` (tilt item id), `sys.bench.bond` (`<uid>|<fruit id>`); `sys.bondNight.<uid>` marks a
 * creature's Greenhouse night as spent. {@link settleBenches} is the overnight `bench` step
 * (systems/dayPage OVERNIGHT_STEPS), run by dayFlow at the morning.
 *
 * World writes only through the owning systems (bag, flags, fieldLog, creature). No DOM.
 * @module systems/flow/rooms
 */

import * as bag from '../bag.js';
import * as flags from '../flags.js';
import * as loans from '../loans.js';
import * as fieldLog from '../fieldLog.js';
import * as creatureSys from '../creature.js';
import * as encounter from '../encounter.js';
import { itemCount } from '../../state/selectors.js';
import { TUNING } from '../../data/tuning.js';
import { t } from '../../data/strings.js';

/** @typedef {import('../../state/schema.js').World} World */

export const BENCH_FOSSIL_FLAG = 'sys.bench.fossil';
export const BENCH_TILT_FLAG = 'sys.bench.tilt';
export const BENCH_BOND_FLAG = 'sys.bench.bond';
export const BOND_NIGHT_PREFIX = 'sys.bondNight.';

/** The room's `effects` (data/loans COMMISSIONS, registry table `commissions`), or {}. */
export function roomEffects(data, roomId) {
  let row = null;
  try { row = data.has('commissions', roomId) ? data.get('commissions', roomId) : null; } catch { row = null; }
  if (!row) { try { row = (data.list('commissions') ?? []).find((r) => r && r.id === roomId) ?? null; } catch { row = null; } }
  return row && row.effects && typeof row.effects === 'object' ? row.effects : {};
}

const rowOf = (data, table, id) => { try { return data.has(table, id) ? data.get(table, id) : null; } catch { return null; } };
const nameOf = (data, id) => rowOf(data, 'collections', id)?.name ?? rowOf(data, 'items', id)?.name ?? id;
const listOf = (data, table) => { try { return data.list(table); } catch { return []; } };

/** Fossils the player carries (collection finds of group 'fossil' or `cleanable`), with counts. */
export function benchFossils(world, data) {
  return listOf(data, 'collections')
    .filter((r) => r && r.kind === 'relic' && (r.group === 'fossil' || r.cleanable === true) && itemCount(world, r.id) > 0)
    .map((r) => ({ id: r.id, name: r.name, n: itemCount(world, r.id) }));
}

/** Skyglass relics the polisher takes (`tiltsFrom`) that the player carries. */
export function polishRelics(world, data) {
  const from = roomEffects(data, 'workshop').tiltsFrom ?? [];
  return from.filter((id) => itemCount(world, id) > 0).map((id) => ({ id, name: nameOf(data, id) }));
}

/** The type tilts the polisher can make (`tiltIds` that are item rows), with their type. */
export function tiltChoices(data) {
  const ids = roomEffects(data, 'workshop').tiltIds ?? [];
  return ids.map((id) => rowOf(data, 'items', id)).filter(Boolean).map((r) => ({ id: r.id, type: r.type, name: r.name }));
}

/**
 * The favourite fruit a creature could spend its Greenhouse night with: a fruit the player carries
 * whose `favouredBy` holds one of the creature's types, or null.
 * @param {World} world @param {any} data @param {any} c
 * @returns {{id: string, name: string}|null}
 */
export function favouriteFruit(world, data, c) {
  let types = [];
  try { types = (rowOf(data, 'species', c.speciesId)?.types ?? []).map((x) => String(x).toLowerCase()); } catch { types = []; }
  for (const r of listOf(data, 'collections')) {
    if (!r || r.kind !== 'fruit' || !Array.isArray(r.favouredBy)) continue;
    if (!r.favouredBy.some((ty) => types.includes(String(ty).toLowerCase()))) continue;
    if (itemCount(world, r.id) > 0) return { id: r.id, name: r.name };
  }
  return null;
}

/**
 * Puts a fossil on the Workshop bench for the night. Call inside a tx.
 * @returns {{ok: boolean, reason?: string, id?: string}}
 */
export function benchFossil(world, data, findId, ctx = {}) {
  if (!loans.roomBuilt(world, 'workshop')) return { ok: false, reason: 'no-workshop' };
  if (flags.getFlag(world, BENCH_FOSSIL_FLAG)) return { ok: false, reason: 'busy' };
  if (itemCount(world, findId) < 1) return { ok: false, reason: 'not-held' };
  const tk = bag.take(world, findId, 1, { data, bus: ctx.bus ?? null, source: 'workshop', confirm: true });
  if (tk && tk.ok === false) return { ok: false, reason: 'not-held' };
  flags.setFlag(world, BENCH_FOSSIL_FLAG, findId, { bus: ctx.bus ?? null });
  return { ok: true, id: findId };
}

/**
 * Sets a skyglass relic in the polisher with the type tilt it will become. Call inside a tx.
 * @returns {{ok: boolean, reason?: string, tilt?: string}}
 */
export function benchTilt(world, data, relicId, tiltId, ctx = {}) {
  if (!loans.roomBuilt(world, 'workshop')) return { ok: false, reason: 'no-workshop' };
  if (flags.getFlag(world, BENCH_TILT_FLAG)) return { ok: false, reason: 'busy' };
  const fx = roomEffects(data, 'workshop');
  if (!(fx.tiltsFrom ?? []).includes(relicId)) return { ok: false, reason: 'not-skyglass' };
  if (!(fx.tiltIds ?? []).includes(tiltId)) return { ok: false, reason: 'unknown-tilt' };
  if (itemCount(world, relicId) < 1) return { ok: false, reason: 'not-held' };
  const tk = bag.take(world, relicId, 1, { data, bus: ctx.bus ?? null, source: 'workshop', confirm: true });
  if (tk && tk.ok === false) return { ok: false, reason: 'not-held' };
  flags.setFlag(world, BENCH_TILT_FLAG, tiltId, { bus: ctx.bus ?? null });
  return { ok: true, tilt: tiltId };
}

/**
 * Leaves a party creature and its favourite fruit in the Greenhouse for the night. Call inside a tx.
 * @returns {{ok: boolean, reason?: string, fruit?: string}}
 */
export function benchBond(world, data, uid, ctx = {}) {
  if (!loans.roomBuilt(world, 'greenhouse')) return { ok: false, reason: 'no-greenhouse' };
  if (flags.getFlag(world, BENCH_BOND_FLAG)) return { ok: false, reason: 'busy' };
  const c = (world.party ?? []).find((x) => x && x.uid === uid);
  if (!c) return { ok: false, reason: 'not-in-party' };
  if (flags.hasFlag(world, `${BOND_NIGHT_PREFIX}${uid}`)) return { ok: false, reason: 'spent' };
  const fruit = favouriteFruit(world, data, c);
  if (!fruit) return { ok: false, reason: 'no-fruit' };
  const tk = bag.take(world, fruit.id, 1, { data, bus: ctx.bus ?? null, source: 'greenhouse', confirm: true });
  if (tk && tk.ok === false) return { ok: false, reason: 'no-fruit' };
  flags.setFlag(world, BENCH_BOND_FLAG, `${uid}|${fruit.id}`, { bus: ctx.bus ?? null });
  return { ok: true, fruit: fruit.id };
}

/**
 * The overnight `bench` step: a benched fossil comes back cleaned, the polisher leaves its tilt, and
 * a Greenhouse night gives +1 Bond (once per creature). Call inside a tx.
 * @param {World} world
 * @param {any} data
 * @param {{bus?: any}} [ctx]
 * @returns {{fossil: string|null, tilt: string|null, bond: {uid: string, to: number}|null, lines: string[]}}
 */
export function settleBenches(world, data, ctx = {}) {
  const bus = ctx.bus ?? null;
  const out = { fossil: null, tilt: null, bond: null, lines: /** @type {string[]} */ ([]) };
  const fossil = flags.getFlag(world, BENCH_FOSSIL_FLAG);
  if (typeof fossil === 'string' && fossil) {
    bag.give(world, fossil, 1, { data, bus, source: 'workshop' });
    try { fieldLog.benchClean(world, fossil, { data, bus }); } catch { /* not a logged find */ }
    flags.clearFlag(world, BENCH_FOSSIL_FLAG, { bus });
    out.fossil = fossil;
    out.lines.push(t('room.workshop.cleaned', { item: nameOf(data, fossil) }));
  }
  const tilt = flags.getFlag(world, BENCH_TILT_FLAG);
  if (typeof tilt === 'string' && tilt) {
    bag.give(world, tilt, 1, { data, bus, source: 'workshop' });
    flags.clearFlag(world, BENCH_TILT_FLAG, { bus });
    out.tilt = tilt;
    out.lines.push(t('room.polish.polished', { item: nameOf(data, tilt) }));
  }
  const bond = flags.getFlag(world, BENCH_BOND_FLAG);
  if (typeof bond === 'string' && bond.includes('|')) {
    const [uid] = bond.split('|');
    const c = (world.party ?? []).find((x) => x && x.uid === uid) ?? (world.box ?? []).find((x) => x && x.uid === uid);
    flags.clearFlag(world, BENCH_BOND_FLAG, { bus });
    if (c && !flags.hasFlag(world, `${BOND_NIGHT_PREFIX}${uid}`)) {
      const pips = Number.isInteger(roomEffects(data, 'greenhouse').bondNight) ? roomEffects(data, 'greenhouse').bondNight : 1;
      const r = creatureSys.addBond(c, pips, { tuning: TUNING });
      flags.setFlag(world, `${BOND_NIGHT_PREFIX}${uid}`, true, { bus });
      bus?.emit?.('creature:bond', { uid, from: r.from, to: r.to, source: 'greenhouse' });
      out.bond = { uid, to: r.to };
      out.lines.push(t('room.greenhouse.bonded', { nick: c.nickname ?? c.speciesId }));
    }
  }
  for (const text of out.lines) bus?.emit?.('toast', { text, icon: 'star' });
  return out;
}

/**
 * What the loft telescope shows tonight: every Errant up, seen or not.
 * @param {World} world @param {any} data
 * @returns {Array<{speciesId: string, name: string, place: string}>}
 */
export function telescopeView(world, data) {
  let markers = [];
  try { markers = encounter.errantMarkers(world, { data, reveal: true }); } catch { markers = []; }
  return markers.filter((m) => m.visible).map((m) => {
    const region = typeof m.tableId === 'string' ? m.tableId.split('-')[0] : '';
    return { speciesId: m.speciesId, name: rowOf(data, 'species', m.speciesId)?.name ?? m.speciesId, place: rowOf(data, 'regions', region)?.name ?? region };
  });
}
