/**
 * The thirteen types and the type chart (GDD-00 §16; wildshift-creatures §4-§5, "the chart as
 * written"). [DATA-SPECIES]
 *
 * `TYPES` is the DATA table: one row per type, `paletteKey` is the badge colour's letter in the
 * 21-key master palette (`art/palette.MASTER`). Star's badge is `d` with a `y` comet glyph, because
 * comet magenta `m` never goes on a UI icon. `TYPE_TABLE` is the battle view's type table
 * (`battle/data.createBattleData` reads `{chart, ordinary, statusImmunity, cures}`).
 *
 * Rows attack, columns defend. 2 Strong, 0.5 Weak, 0 Blocked. Dual types multiply. Hollow is
 * immune to Plain and Grit: the one immunity, the one homage. Star is neutral both ways.
 * Pure data: imports only `./ids.js`.
 * @module data/types
 */

import { deepFreeze } from './ids.js';

/** Type names in chart order (the names species, moves and the chart use). */
export const TYPE_NAMES = deepFreeze([
  'Plain', 'Grit', 'Brine', 'Kiln', 'Moss', 'Bolt', 'Rime', 'Gust', 'Stone', 'Rust', 'Glass', 'Hollow', 'Star',
]);

/** The twelve ordinary types (Star sits outside the chart). */
export const ORDINARY_TYPES = deepFreeze(TYPE_NAMES.slice(0, 12));

/**
 * The DATA table rows. `text` is the world logic a Read card or the Field Log can show.
 * @type {ReadonlyArray<{id: string, name: string, abbr: string, paletteKey: string, glyph: string|null, text: string}>}
 */
export const TYPES = deepFreeze([
  { id: 'plain', name: 'Plain', abbr: 'Pla', paletteKey: 'v', glyph: null, text: 'Everyday bodies and blows. Stone shrugs off a plain blow, and it passes straight through Hollow.' },
  { id: 'grit', name: 'Grit', abbr: 'Gri', paletteKey: 'u', glyph: null, text: 'Fists, grapples and grinding sand. Sand smothers a kiln and soaks up brine; a fist sinks into moss and skids off glass.' },
  { id: 'brine', name: 'Brine', abbr: 'Bri', paletteKey: 'b', glyph: null, text: 'Salt sea. Salt quenches a kiln, melts rime and kills roots. A sea stack stands against it, and salt only feeds rust.' },
  { id: 'kiln', name: 'Kiln', abbr: 'Kil', paletteKey: 'o', glyph: null, text: 'Flame, forges and kilns. A kiln slumps glass, melts rime, burns moss and burns off shadow.' },
  { id: 'moss', name: 'Moss', abbr: 'Mos', paletteKey: 'g', glyph: null, text: 'Roots, lichen and reeds. Roots crack stone, swallow old iron and ground a current.' },
  { id: 'bolt', name: 'Bolt', abbr: 'Bol', paletteKey: 'y', glyph: null, text: 'Lightning and current. It runs through salt water and strikes what flies; glass insulates against it.' },
  { id: 'rime', name: 'Rime', abbr: 'Rim', paletteKey: 's', glyph: null, text: 'Ice and hard cold. Cold kills roots, grounds wings and makes iron brittle.' },
  { id: 'gust', name: 'Gust', abbr: 'Gus', paletteKey: 'w', glyph: null, text: 'Wind and flight. Wind starves a flame, throws a fighter and scatters echoes.' },
  { id: 'stone', name: 'Stone', abbr: 'Sto', paletteKey: 'e', glyph: null, text: 'Rock, cliffs and sea stacks. Stone shatters glass and grounds lightning; roots crack it.' },
  { id: 'rust', name: 'Rust', abbr: 'Rus', paletteKey: 'r', glyph: null, text: 'Corrosion, scrap and old iron. Rust eats everyday things and breaks circuits; cold iron wards off spirits.' },
  { id: 'glass', name: 'Glass', abbr: 'Gla', paletteKey: 'i', glyph: null, text: 'Skyglass, mirrors and light. A mirror shows what is hollow and turns a fighter\'s blow.' },
  { id: 'hollow', name: 'Hollow', abbr: 'Hol', paletteKey: 'p', glyph: null, text: 'Spirits, echoes and empty places. Plain and Grit pass straight through it.' },
  { id: 'star', name: 'Star', abbr: 'Sta', paletteKey: 'd', glyph: 'y', text: 'Comet creatures only. Outside the chart: it deals and takes neutral damage against everything.' },
]);

/** Type name -> badge palette key (the Read card, move panel and type badges). */
export const TYPE_PALETTE_KEY = deepFreeze(Object.fromEntries(TYPES.map((t) => [t.name, t.paletteKey])));

const S = 2;
const H = 0.5;
const O = 0;

/**
 * The chart exactly as written in wildshift-creatures §5 (56 non-neutral pairings).
 * `TYPE_CHART[attacker][defender]`.
 * @type {Readonly<Record<string, Readonly<Record<string, number>>>>}
 */
export const TYPE_CHART = deepFreeze(build({
  Plain: { Stone: H, Hollow: O },
  Grit: { Plain: S, Brine: S, Kiln: S, Moss: H, Bolt: H, Rust: S, Glass: H, Hollow: O },
  Brine: { Kiln: S, Moss: S, Rime: S, Stone: H, Rust: H },
  Kiln: { Brine: H, Moss: S, Rime: S, Rust: H, Glass: S, Hollow: S },
  Moss: { Brine: H, Kiln: H, Bolt: S, Stone: S, Rust: S, Glass: H },
  Bolt: { Brine: S, Gust: S, Glass: H },
  Rime: { Brine: H, Kiln: H, Moss: S, Gust: S, Rust: S },
  Gust: { Grit: S, Kiln: S, Rime: H, Hollow: S },
  Stone: { Brine: H, Bolt: S, Gust: H, Glass: S },
  Rust: { Plain: S, Bolt: S, Rime: H, Glass: H },
  Glass: { Grit: S, Brine: H, Stone: H, Rust: H, Hollow: S },
  Hollow: { Gust: H, Stone: S, Rust: H, Glass: S },
  Star: {},
}));

/**
 * A creature of the named type cannot get that status (battle/data `statusImmunity`).
 * @type {Readonly<Record<string, string>>}
 */
export const STATUS_IMMUNITY = deepFreeze({ burn: 'Kiln', chill: 'Rime', poison: 'Rust', numb: 'Bolt' });

/**
 * A damaging hit of `type` cures `status` on its target (a Kiln hit thaws a chill).
 * @type {ReadonlyArray<{type: string, status: string}>}
 */
export const STATUS_CURES = deepFreeze([{ type: 'Kiln', status: 'chill' }]);

/** The battle view's type table (`battle/data.createBattleData({types: TYPE_TABLE, ...})`). */
export const TYPE_TABLE = deepFreeze({
  names: TYPE_NAMES,
  chart: TYPE_CHART,
  ordinary: ORDINARY_TYPES,
  statusImmunity: STATUS_IMMUNITY,
  cures: STATUS_CURES,
});

/**
 * Fills every unlisted pairing with 1.
 * @param {Record<string, Record<string, number>>} sparse
 * @returns {Record<string, Record<string, number>>}
 */
function build(sparse) {
  const out = {};
  for (const a of TYPE_NAMES) {
    out[a] = {};
    for (const d of TYPE_NAMES) out[a][d] = sparse[a] && d in sparse[a] ? sparse[a][d] : 1;
  }
  return out;
}

export default TYPES;
