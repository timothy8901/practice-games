/**
 * Battle-ready data for the battle and Forecast scenes. [SCN-BATTLE]
 *
 * `js/data/index.js` still serves the day-1 placeholder battle tables (`ph-*` ids). Until the real
 * species / moves / abilities / types / trainers / items / dials tables are wired there, the battle
 * scenes read them from their own modules, layered over `DATA`, through one Registry. The type
 * chart rides along as `typeChart` (the engine needs `{chart, ordinary, statusImmunity, cures}`) and
 * the GDD tuning table as `tuning`, so every system called with `{data}` reads the GDD numbers.
 *
 * Once `G.data` carries the real tables (it knows `sloshkin`), it is used as is (with the chart and
 * tuning attached when it lacks them). A test page may set `G.battleData` to override everything.
 * @module scenes/battleData
 */
import { DATA } from '../data/index.js';
import { createRegistry } from '../data/registry.js';
import { SPECIES, FAMILIES } from '../data/species/index.js';
import { MOVES } from '../data/moves/index.js';
import { ABILITIES } from '../data/abilities.js';
import { TYPES, TYPE_TABLE } from '../data/types.js';
import { TRAINERS } from '../data/trainers.js';
import { ITEMS } from '../data/items.js';
import { DIALS } from '../data/dials.js';
import { TUNING } from '../data/tuning.js';

/** @type {any} */
let cached = null;

/**
 * Adds `typeChart` / `tuning` to a registry-like object without touching it.
 * @param {any} reg
 * @returns {any}
 */
function withExtras(reg) {
  return { ...reg, typeChart: reg.typeChart ?? TYPE_TABLE, tuning: reg.tuning ?? TUNING };
}

/**
 * The real battle tables as one registry (built once).
 * @returns {any}
 */
export function realBattleData() {
  if (!cached) {
    const reg = createRegistry({
      ...DATA, species: SPECIES, families: FAMILIES, moves: MOVES, abilities: ABILITIES, types: TYPES,
      trainers: TRAINERS, items: ITEMS, dials: DIALS,
    });
    cached = withExtras(reg);
  }
  return cached;
}

/**
 * The data the battle scenes use for this game context (cached on `G.battleData`).
 * @param {any} G
 * @returns {any}
 */
export function resolveBattleData(G) {
  if (G.battleData) return G.battleData;
  const d = G.data;
  let real = false;
  try { real = !!(d && typeof d.has === 'function' && d.has('species', 'sloshkin') && d.has('moves', 'tap')); } catch { real = false; }
  G.battleData = real ? withExtras(d) : realBattleData();
  return G.battleData;
}
