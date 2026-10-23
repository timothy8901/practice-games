/**
 * DATA: every content table by name, merged, deep-frozen. [DATA-IDX] (day 1)
 *
 * The only file that imports every table. Systems never import a table file directly; they take the
 * registry (`createRegistry(DATA)`) or import `DATA` from here. Tables are either arrays of rows
 * with kebab-case `id`s or plain objects keyed by id (`scripts`, `encounters`); the registry indexes
 * both. The typedefs below are the row contracts content lanes write to (§14).
 *
 * INTEGRATION: each `./placeholder/*.js` import is a stand-in for a content lane's real file
 * (manifest §1: `types.js`, `moves/index.js`, `abilities.js`, `species/index.js`, `items.js`,
 * `loans.js`, `shops.js`, `dials.js`, `trainers.js`, `npcs/index.js`, `schedules.js`,
 * `threads/index.js`, `letters/index.js`, `scripts/index.js`, `maps/index.js`, `tilesets.js`,
 * `encounters.js`, `collections.js`). Swap the import, keep the table name, run
 * `node tools/validate-data.mjs`.
 * @module data/index
 */

import { deepFreeze } from './ids.js';
import { CREDITS } from './credits.js';
import { TYPES, MOVES, ABILITIES, SPECIES, FAMILIES } from './placeholder/battle.js';
import { TILESETS, REGIONS, MAPS, ENCOUNTERS, COLLECTIONS } from './placeholder/world.js';
import {
  ITEMS, NPCS, SCHEDULES, THREADS, LETTERS, SHOPS, TRAINERS, LOANS, DIALS, CHALLENGES, TOGGLE_ORDER, EVENT_SCRIPTS,
} from './placeholder/town.js';
import { SCRIPTS } from './placeholder/scripts.js';

// --- row typedefs (the content contract) -------------------------------------------------------

/** @typedef {import('../script/cond.js').Cond} Cond */
/** @typedef {import('../script/ops.js').Op} Op */
/** @typedef {{hp: number, atk: number, def: number, spa: number, spd: number, spe: number}} StatBlock */

/**
 * @typedef {Object} Move
 * @property {string} id  @property {string} name
 * @property {string|null} type           type name (`'Brine'`) or null for typeless
 * @property {'physical'|'special'|'status'} category
 * @property {number} power  @property {number|null} accuracy  @property {number|null} pp  @property {number} priority
 * @property {Record<string, any>} effect  keys ⊂ battle/effects.EFFECT_KEYS
 * @property {string} text  @property {string} [signature]   species id whose learnset must contain this move
 */

/**
 * @typedef {Object} Ability
 * @property {string} id  @property {string} name  @property {string} text
 * @property {{kind: string, minPower?: number}|null} ward
 * @property {string|null} hook        key into battle/abilityHooks.HOOKS
 * @property {boolean} [expShare]  @property {boolean} [glint]
 */

/**
 * @typedef {Object} Species
 * @property {string} id  @property {string} name  @property {string[]} types  @property {string} familyId
 * @property {number} stage  @property {StatBlock} base  @property {string} ability
 * @property {Array<[number, string]>} learnset   [level, moveId]
 * @property {string|null} heartmark  @property {number} catchRate  @property {number} expYield
 * @property {'fast'|'medium-fast'|'medium-slow'|'slow'} growth  @property {Record<string, any>} flags
 */

/**
 * @typedef {Object} Family
 * @property {string} id  @property {string} name  @property {number[]} windows
 * @property {Record<string, {up: Array<{form: string, w: number}>, side: Array<{form: string, w: number}>, down: Array<{form: string, w: number}>}>} shiftTable
 * @property {string|null} [star]
 */

/**
 * @typedef {Object} Item
 * @property {string} id  @property {string} name  @property {string} pocket
 * @property {number} price  @property {number} sell  @property {number} stack
 * @property {string|null} use         handler key in systems/bag.USE_HANDLERS
 * @property {boolean} oneOfAKind  @property {string} text
 */

/**
 * @typedef {Object} TileDef
 * @property {string} id  @property {string} char   DEFAULT_LEGEND character
 * @property {string} art  @property {boolean} solid  @property {boolean} water
 * @property {'low'|'high'|'floods'|'glow'|null} tide  @property {string|null} verb  @property {string|null} sfx
 * @property {number|{frames: number, fps?: number}} anim  frames (0 = static)  @property {boolean} glow  @property {string} [spawn]  keyword spawn class
 */

/**
 * @typedef {Object} MapDef   see ARCHITECTURE §4.1
 * @property {string} id  @property {string} name  @property {'exterior'|'interior'} kind  @property {string} region
 * @property {number} w  @property {number} h
 * @property {Record<string, string>} [legend]  @property {string[]} ground
 * @property {string[]|null} [detail]  @property {string[]|null} [overlay]  @property {string[]|null} [collision]
 * @property {Array<{art: string, x: number, y: number, cond?: Cond}>} [props]
 * @property {Array<{kind: string, id: string, x: number, y: number, cond?: Cond, [k: string]: any}>} entities
 * @property {Array<{x: number, y: number, w?: number, h?: number, kind: 'step'|'use'|'enter', id: string, cond?: Cond, script?: string, verb?: string, once?: boolean}>} triggers
 * @property {Array<{x: number, y: number, w?: number, h?: number, to: {mapId: string, x: number, y: number, facing?: string}, kind: 'door'|'edge'|'stairs', cond?: Cond, sfx?: string}>} warps
 * @property {Array<{area: {x: number, y: number, w: number, h: number}|'grass'|'water'|'mud', table: string, rate: number, cond?: Cond}>} spawns
 * @property {Record<string, {x: number, y: number, w: number, h: number}>} [regions]
 * @property {string|null} [music]  @property {{indoor?: boolean, ambient?: string}} [light]
 * @property {{x: number, y: number, facing?: string}} entry
 */

/** @typedef {{species: string, levels: [number, number], w: number, errant?: boolean, cond?: Cond}} EncounterRow */
/** @typedef {{id: string, kind: 'fish'|'bug'|'relic'|'fruit', name: string, price: number, [k: string]: any}} CollectionRow */

/**
 * @typedef {Object} ScheduleEntry   see §4.4
 * @property {number|{tide: 'low'|'high'}|{phase: string}} at
 * @property {string} mapId  @property {number} x  @property {number} y  @property {string} [facing]
 * @property {string} [pose]  @property {string} [path]  @property {number[]} [days]  @property {Cond} [cond]  @property {number} [wanderR]
 */

/**
 * @typedef {Object} NpcDef   see §14.5
 * @property {string} id  @property {string} name  @property {string} species  @property {string} portrait  @property {string} sprite
 * @property {string} home  @property {string|null} [threadId]
 * @property {ScheduleEntry[]} schedule
 * @property {Array<{id: string, cond?: Cond, script: string, priority: number, once?: boolean, repeatDays?: number, favour?: string}>} topics
 * @property {{generic: Array<{id: string, text: string}>, [pose: string]: any}} lines
 */

/**
 * @typedef {Object} ThreadDef   see §14.7
 * @property {string} id  @property {string} npcId  @property {string} title
 * @property {Array<{id: number, cond: Cond, script: string, advance?: {dayOfWeek?: number[], days?: number, immediate?: boolean}, where?: {mapId: string, x: number, y: number}, reward?: Record<string, any>}>} beats
 */

/**
 * @typedef {Object} Letter   see §14.8
 * @property {string} id  @property {number} n  @property {string} from  @property {string} to  @property {string} date
 * @property {string} seal  @property {string} body  @property {string|null} relicId  @property {Cond|null} unlock  @property {Op[]} [reveal]
 */

/**
 * @typedef {Object} Shop   see §14.9
 * @property {string} id  @property {string} keeper  @property {[number, number]} hours
 * @property {Array<{item: string, cond?: Cond, rotate?: string, qty?: number}>} stock
 * @property {string[]} buys  @property {number} priceMult  @property {string|null} [nightKeeper]
 */

/**
 * @typedef {Object} Trainer   see §14.10
 * @property {string} id  @property {string} name  @property {string} title  @property {string} class  @property {string} portrait
 * @property {Array<{species: string, level: number, moves?: string[]}>} party
 * @property {Array<{id: string, heal?: number}>} items  @property {string} ai  @property {number} payout  @property {string} [tacticTag]
 * @property {{before?: string, afterWin?: string, afterLoss?: string}} scripts
 */

/**
 * @typedef {Object} Dial
 * @property {string} id  @property {string} name  @property {string} text
 * @property {{readCostsTurn: boolean, captureDisplay: 'percent'|'band', wardBadge: boolean, runAllowed: boolean, holdOutTurns: number, rerollCostMult: number, anchorsAllowed: boolean}} rules
 */

// --- the table ----------------------------------------------------------------------------------

/**
 * Every content table by name. Frozen deep; mutate nothing.
 * @type {Readonly<{
 *   types: readonly {id: string, name: string, abbr: string, paletteKey: string}[],
 *   moves: readonly Move[], abilities: readonly Ability[], species: readonly Species[], families: readonly Family[],
 *   items: readonly Item[], loans: readonly any[], shops: readonly Shop[], dials: readonly Dial[], challenges: readonly any[],
 *   trainers: readonly Trainer[], npcs: readonly NpcDef[], schedules: readonly any[], threads: readonly ThreadDef[],
 *   letters: readonly Letter[], scripts: Readonly<Record<string, readonly Op[]>>, eventScripts: readonly {id: string, event: string, script: string}[],
 *   maps: readonly MapDef[], tilesets: readonly TileDef[], regions: readonly {id: string, name: string, curveLevel: number}[],
 *   encounters: Readonly<Record<string, readonly EncounterRow[]>>, collections: readonly CollectionRow[],
 *   credits: readonly {id: string, heading: string, lines: readonly string[]}[]
 * }>}
 */
export const DATA = deepFreeze({
  types: TYPES,
  moves: MOVES,
  abilities: ABILITIES,
  species: SPECIES,
  families: FAMILIES,
  items: ITEMS,
  loans: LOANS,
  shops: SHOPS,
  dials: DIALS,
  challenges: CHALLENGES,
  trainers: TRAINERS,
  npcs: NPCS,
  schedules: SCHEDULES,
  threads: THREADS,
  letters: LETTERS,
  scripts: SCRIPTS,
  eventScripts: EVENT_SCRIPTS,
  maps: MAPS,
  tilesets: TILESETS,
  regions: REGIONS,
  encounters: ENCOUNTERS,
  collections: COLLECTIONS,
  credits: CREDITS,
});

/** Table names in `DATA`, in declaration order. */
export const TABLE_NAMES = Object.freeze(Object.keys(DATA));

/** Seed-code toggle registry, append-only (`setSeedToggles(TOGGLE_ORDER)` at boot, §9). */
export { TOGGLE_ORDER };

/**
 * Tile definitions keyed by id: the `tiles` argument `world/tilemap.loadMap` takes
 * (`data/tilesets.TILES` in the manifest).
 * @type {Readonly<Record<string, import('./index.js').TileDef>>}
 */
export const TILES = Object.freeze(Object.fromEntries(TILESETS.map((t) => [t.id, t])));

/**
 * `char -> tile id` built from the tileset rows (§8.4: the prototype's hard-coded legend is data).
 * A map's own `legend` merges over this.
 * @type {Readonly<Record<string, string>>}
 */
export const DEFAULT_LEGEND = Object.freeze(Object.fromEntries(TILESETS.filter((t) => t.char).map((t) => [t.char, t.id])));

export default DATA;
