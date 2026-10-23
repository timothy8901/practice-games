/**
 * Interaction resolver (ARCHITECTURE §4.5): what the confirm button would do on the tile the player
 * faces. Pure and allocation-light; the HUD calls it every frame the player is idle and
 * `systems/flow/interactFlow.doInteraction(G, action)` executes the result.
 *
 * Candidates are evaluated in {@link INTERACTION_PRIORITY} order and the first match wins:
 * npc > roamer > item > sign > use-trigger > tree > rock > boat > prop > water (fish) > crack / mud (dig) > door > tile verb.
 * A verb that needs a tool the player is not holding is still returned, with `disabled` carrying
 * the reason, so the HUD shows a greyed verb rather than nothing.
 *
 * Tool capability is data: an item row's `use` field names the verb it enables (`'fish'`, `'dig'`,
 * `'catch'`). No item ids live here.
 *
 * Lane: WORLD-ENT.
 * @module world/interact
 */

import { DIR_INDEX, DX, DY } from './entities.js';
import { tideState as tideStateOf } from '../state/selectors.js';

/** @typedef {import('./entities.js').Entity} Entity */
/** @typedef {import('./entities.js').EntityManager} EntityManager */

/**
 * @typedef {Object} ContextAction
 * @property {string} verb           handler key for interactFlow.VERB_HANDLERS
 * @property {string} label          short HUD word, e.g. 'Talk'
 * @property {string} prompt         full HUD line, e.g. 'Talk to Wren'
 * @property {string} icon           icon id for ui/icons.js (the verb)
 * @property {string} kind           target kind: 'npc'|'roamer'|'item'|'sign'|'trigger'|'tree'|'rock'|'water'|'crack'|'mud'|'door'|'boat'|'prop'|'tile'
 * @property {string|null} targetId  entity id, trigger id, warp target map id or tile id
 * @property {Entity|object|null} target   the entity, trigger, warp or TileInfo
 * @property {string|null} disabled  reason the verb cannot run right now, or null
 * @property {Record<string, any>} payload   verb-specific data: {x, y, tool, tideState, ...}
 */

/** Candidate kinds in the order they win a tile. */
export const INTERACTION_PRIORITY = Object.freeze([
  'npc', 'roamer', 'item', 'sign', 'trigger', 'tree', 'rock', 'boat', 'prop', 'water', 'crack', 'mud', 'door', 'tile',
]);

/** Default verb per candidate kind. */
export const KIND_VERBS = Object.freeze({
  npc: 'talk', roamer: 'read', item: 'pickUp', sign: 'read', tree: 'shake', rock: 'inspect',
  water: 'fish', crack: 'dig', mud: 'dig', door: 'enter', boat: 'board', prop: 'look', tile: 'look',
});

/** Verbs that need a held tool whose `use` equals the verb. */
export const VERB_TOOLS = Object.freeze({ fish: 'fish', dig: 'dig', catch: 'catch' });

/** HUD words per verb (the UI may map these through strings.js). */
export const VERB_LABELS = Object.freeze({
  talk: 'Talk', read: 'Read', pickUp: 'Pick up', shake: 'Shake', inspect: 'Inspect', fish: 'Fish', dig: 'Dig',
  catch: 'Catch', enter: 'Enter', board: 'Board', look: 'Look', sit: 'Sit', mailbox: 'Mailbox', use: 'Use',
});

/** Reason strings for `disabled`. */
export const DISABLED = Object.freeze({
  needsTool: Object.freeze({ fish: 'Needs a rod', dig: 'Needs a shovel', catch: 'Needs a net' }),
  tide: 'Under water',
});

/**
 * Looks a row up in the registry without throwing (works with `data/registry.js` and plain tables).
 * @param {object|null|undefined} data
 * @param {string} table
 * @param {string|null|undefined} id
 * @returns {object|null}
 */
export function lookup(data, table, id) {
  if (!data || id == null) return null;
  if (typeof data.has === 'function' && typeof data.get === 'function') return data.has(table, id) ? data.get(table, id) : null;
  const t = data[table];
  if (!t) return null;
  if (Array.isArray(t)) { for (let i = 0; i < t.length; i++) if (t[i] && t[i].id === id) return t[i]; return null; }
  return Object.prototype.hasOwnProperty.call(t, id) ? t[id] : null;
}

/**
 * The verb the held tool enables (`items[tool].use`), or null.
 * @param {object} world
 * @param {object} data
 * @returns {string|null}
 */
export function toolUse(world, data) {
  const tool = world && world.player ? world.player.tool : null;
  const row = lookup(data, 'items', tool);
  return row && typeof row.use === 'string' ? row.use : null;
}

/** Reused result record; copy if you keep it across frames. */
const action = { verb: '', label: '', prompt: '', icon: '', kind: '', targetId: null, target: null, disabled: null, payload: { x: 0, y: 0, tool: null, tideState: 'low', script: null, to: null, text: null } };

/**
 * @param {string} kind @param {string} verb @param {string|null} targetId @param {object|null} target
 * @param {string} prompt @param {string|null} disabled
 * @returns {ContextAction}
 */
function fill(kind, verb, targetId, target, prompt, disabled) {
  action.kind = kind;
  action.verb = verb;
  action.label = VERB_LABELS[verb] || verb;
  action.prompt = prompt;
  action.icon = verb;
  action.targetId = targetId;
  action.target = target;
  action.disabled = disabled;
  return action;
}

/**
 * Display name for an entity: data row name, def name, else the id.
 * @param {Entity} e @param {object} data
 */
function nameOf(e, data) {
  const row = e.kind === 'npc' ? lookup(data, 'npcs', e.npcId) : e.kind === 'item' ? lookup(data, 'items', e.itemId)
    : e.kind === 'roamer' ? lookup(data, 'species', e.speciesId) : null;
  if (row && row.name) return row.name;
  if (e.def && e.def.name) return e.def.name;
  return e.itemId || e.speciesId || e.npcId || e.id;
}

/**
 * Resolves the context action for the tile the player faces.
 * @param {Entity} player
 * @param {{w: number, h: number, tileAt: Function, triggersAt: Function, warpAt: Function}} map   RuntimeMap
 * @param {EntityManager} ents
 * @param {object} world
 * @param {object} data
 * @param {{tideState?: string}} [opts]   tide override (default: read from world.clock via state/selectors)
 * @returns {ContextAction|null}   a REUSED record, or null when nothing is there
 */
export function resolveFacing(player, map, ents, world, data, opts) {
  const di = DIR_INDEX[player.facing];
  if (di === undefined) return null;
  const x = player.x + DX[di], y = player.y + DY[di];
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return null;
  const tide = (opts && opts.tideState) || tideStateOf(world);
  const use = toolUse(world, data);
  const p = action.payload;
  p.x = x; p.y = y; p.tool = world && world.player ? world.player.tool : null; p.tideState = tide;
  p.script = null; p.to = null; p.text = null;

  // 1. Entities that outrank triggers: npc, roamer, item, sign.
  const e = ents.at(x, y);
  if (e && e.id !== player.id) {
    if (e.kind === 'npc') return fill('npc', 'talk', e.id, e, `Talk to ${nameOf(e, data)}`, null);
    if (e.kind === 'roamer') {
      if (use === 'catch' && e.def && e.def.catchable) return fill('roamer', 'catch', e.id, e, `Catch ${nameOf(e, data)}`, null);
      return fill('roamer', 'read', e.id, e, `Read ${nameOf(e, data)}`, null);
    }
    if (e.kind === 'item') return fill('item', 'pickUp', e.id, e, `Pick up ${nameOf(e, data)}`, null);
    if (e.kind === 'sign') { p.text = e.def && e.def.text ? e.def.text : null; return fill('sign', 'read', e.id, e, 'Read the sign', null); }
  }

  // 2. Use triggers.
  const trigs = map.triggersAt(x, y);
  for (let i = 0; i < trigs.length; i++) {
    const t = trigs[i];
    if (t.kind !== 'use') continue;
    if (t.once && world && world.maps && world.maps[map.id] && world.maps[map.id].opened && world.maps[map.id].opened.indexOf(t.id) !== -1) continue;
    const verb = t.verb || 'use';
    p.script = t.script || null;
    return fill('trigger', verb, t.id, t, VERB_LABELS[verb] || verb, null);
  }

  // 3. Remaining entities: tree, rock, boat, prop (a boat sits on water, so it must outrank 'fish').
  if (e && e.id !== player.id) {
    if (e.kind === 'tree') return fill('tree', 'shake', e.id, e, 'Shake the tree', null);
    if (e.kind === 'rock') return fill('rock', 'inspect', e.id, e, 'Inspect the rock', null);
    if (e.kind === 'boat') return fill('boat', 'board', e.id, e, 'Board the boat', null);
    if (e.kind === 'prop') {
      const verb = e.def && e.def.verb ? e.def.verb : null;
      if (verb) return fill('prop', verb, e.id, e, VERB_LABELS[verb] || verb, null);
    }
  }

  // 4. Water (fish): open water, or a tide:'low' tile while the tide is in.
  const tile = map.tileAt(x, y);
  if (tile && (tile.water || (tile.tide === 'low' && tide !== 'low'))) {
    return fill('water', 'fish', tile.id, tile, 'Fish here', use === 'fish' ? null : DISABLED.needsTool.fish);
  }
  // 5. Dig spots: a crack entity, or a tile whose verb is 'dig' (mud flats, dry now).
  if (e && e.id !== player.id && e.kind === 'crack') {
    return fill('crack', 'dig', e.id, e, 'Dig here', use === 'dig' ? null : DISABLED.needsTool.dig);
  }
  if (tile) {
    if (tile.verb === 'dig') {
      return fill('mud', 'dig', tile.id, tile, 'Dig here', use === 'dig' ? null : DISABLED.needsTool.dig);
    }
  }
  const warp = map.warpAt(x, y);
  if (warp && warp.kind === 'door') {
    p.to = warp.to;
    return fill('door', 'enter', warp.to ? warp.to.mapId : null, warp, 'Enter', null);
  }
  if (tile && tile.verb && tile.verb !== 'fish' && tile.verb !== 'dig') {
    const verb = tile.verb;
    return fill('tile', verb, tile.id, tile, VERB_LABELS[verb] || verb, VERB_TOOLS[verb] && use !== VERB_TOOLS[verb] ? (DISABLED.needsTool[verb] || `Needs a tool`) : null);
  }
  return null;
}
