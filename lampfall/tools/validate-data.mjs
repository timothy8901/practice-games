#!/usr/bin/env node
/**
 * Cross-reference validator for the content tables (ARCHITECTURE §8.2). [TOOLS]
 *
 * Usage: node tools/validate-data.mjs [--strict] [--quiet] [--world save.json] [--data module.mjs]
 *   exit 1 on any error (or on warnings with --strict); every line is `table:id: message` (the table
 *   names the content file: `scripts:ph-intro[3]` is in `js/data/scripts/*`). `--data` validates the
 *   `DATA` export of another module instead of `js/data/index.js` (fixtures, tooling).
 *
 * `validateData(DATA, opts)` is the pure core (also run by `test/data.test.mjs`). Rules that need a
 * module from a lane that has not landed (battle effects, ability hooks, bag handlers, creature
 * sprites, tracks) run when the CLI finds the module and report one warning when it is absent.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createRegistry } from '../js/data/registry.js';
import { ID_RE } from '../js/data/ids.js';
import { validateOps, walkOps } from '../js/script/ops.js';
import { validateCond, flagsReadBy } from '../js/script/cond.js';
import { POCKET_IDS, LEVEL_MAX, SCHEMA_VERSION, validateWorld } from '../js/state/schema.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Effect vocabulary from §5.1, used until `js/battle/effects.js` exports `EFFECT_KEYS`. */
export const DRAFT_EFFECT_KEYS = Object.freeze([
  'stat', 'status', 'recovery', 'guard', 'evasion', 'sureHit', 'plumbline', 'scrap', 'clearRaised', 'flinch',
  'popsDecoy', 'highCrit', 'revealMoves', 'charge', 'spread', 'queuedType', 'multiHit', 'drain', 'selfKo', 'contact', 'chance',
]);
/** AI profiles from the manifest, used until `js/battle/ai.js` exports `PROFILES`. */
export const DRAFT_AI_PROFILES = Object.freeze(['wild', 'trainer', 'spire', 'summit']);
export const STATUS_KINDS = Object.freeze(['burn', 'poison', 'chill', 'numb', 'trap']);
export const WARD_KINDS = Object.freeze(['strong-only', 'no-status', 'min-power']);
export const GROWTHS = Object.freeze(['fast', 'medium-fast', 'medium-slow', 'slow']);
export const CATEGORIES = Object.freeze(['physical', 'special', 'status']);
export const POSES = Object.freeze(['stand', 'wander', 'sit', 'sleep', 'fish', 'shop', 'sweep', 'path', 'porch']);
export const COLLECTION_KINDS = Object.freeze(['fish', 'bug', 'relic', 'fruit']);
export const TIDE_STATES = Object.freeze(['low', 'rising', 'high', 'falling']);
export const ADVANCE_KEYS = Object.freeze(['dayOfWeek', 'days', 'immediate']);
export const TILE_TIDES = Object.freeze(['low', 'high', 'floods', 'glow']);
export const SPAWN_CLASSES = Object.freeze(['grass', 'water', 'mud']);
export const ENTITY_KINDS = Object.freeze(['npc', 'tree', 'rock', 'crack', 'sign', 'item', 'prop', 'roamer', 'boat']);

/**
 * @typedef {Object} ValidateOptions
 * @property {Record<string, any>} [tuning]
 * @property {readonly string[]} [effectKeys]
 * @property {Set<string>|null} [hooks]          ability hook keys; null = unknown (skip with a warning)
 * @property {Set<string>|null} [useHandlers]    item use keys; null = skip
 * @property {readonly string[]} [aiProfiles]
 * @property {Record<string, any>|null} [sprites] creature sprites by form id; null = skip
 * @property {Record<string, string>|null} [master] master palette; null = skip
 * @property {((rows: string[]) => {x: number, y: number, w: number, h: number}|null)|null} [opaqueBounds]
 * @property {{TRACKS?: Record<string, any>, CUES?: Record<string|number, any>}|null} [tracks]
 * @property {Record<string, string>} [legend]   DEFAULT_LEGEND override (derived from tilesets otherwise)
 * @property {Record<string, {ids: readonly string[], optional?: readonly string[], extras?: 'warn'|'allow', kind?: readonly string[]}>|null} [manifest]
 *   `ids.manifest.MANIFEST`; when set, authored tables are compared with it (warnings only)
 */

/**
 * Runs every rule over `DATA`.
 * @param {Record<string, any>} DATA
 * @param {ValidateOptions} [opts]
 * @returns {{errors: string[], warnings: string[]}}
 */
export function validateData(DATA, opts = {}) {
  const errors = [];
  const warnings = [];
  const err = (table, id, msg) => errors.push(`${table}:${id}: ${msg}`);
  const warn = (table, id, msg) => warnings.push(`${table}:${id}: ${msg}`);
  const tuning = opts.tuning ?? {};
  const effectKeys = new Set(opts.effectKeys ?? DRAFT_EFFECT_KEYS);
  const aiProfiles = new Set(opts.aiProfiles ?? DRAFT_AI_PROFILES);

  const reg = createRegistry(DATA);
  for (const p of reg.verify()) errors.push(p);
  const has = (table, id) => reg.has(table, id);
  const list = (table) => (reg.tables.includes(table) ? reg.list(table) : []);
  const isNpcId = (id) => has('npcs', id);
  const condOpts = { has };
  const checkCond = (table, id, cond, what) => {
    if (cond === undefined) return;
    for (const p of validateCond(cond, condOpts, what)) err(table, id, p);
  };
  const typeNames = new Set(list('types').map((t) => t.name));
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  const int = (v) => Number.isInteger(v);

  // ---- species / families ----------------------------------------------------------------------
  const familyForms = new Map();
  for (const sp of list('species')) {
    const id = sp.id;
    if (!has('families', sp.familyId)) err('species', id, `familyId '${sp.familyId}' is not in families`);
    else familyForms.set(sp.familyId, [...(familyForms.get(sp.familyId) ?? []), id]);
    if (!Array.isArray(sp.types) || sp.types.length < 1 || sp.types.length > 2) err('species', id, 'types must list 1..2 type names');
    else for (const t of sp.types) if (!typeNames.has(t)) err('species', id, `type '${t}' is not in types`);
    if (!int(sp.stage) || sp.stage < 0 || sp.stage > 4) err('species', id, 'stage must be an integer 0..4');
    if (!has('abilities', sp.ability)) err('species', id, `ability '${sp.ability}' is not in abilities`);
    const learnset = Array.isArray(sp.learnset) ? sp.learnset : [];
    if (!Array.isArray(sp.learnset)) err('species', id, 'learnset must be [[level, moveId]]');
    const learned = new Set();
    for (const row of learnset) {
      if (!Array.isArray(row) || row.length !== 2 || !int(row[0]) || row[0] < 1 || row[0] > LEVEL_MAX) { err('species', id, `learnset row ${JSON.stringify(row)} must be [level 1..${LEVEL_MAX}, moveId]`); continue; }
      if (!has('moves', row[1])) err('species', id, `learnset move '${row[1]}' is not in moves`);
      learned.add(row[1]);
    }
    if (sp.heartmark !== null) {
      if (!has('moves', sp.heartmark)) err('species', id, `heartmark move '${sp.heartmark}' is not in moves`);
      else if (!learned.has(sp.heartmark)) warn('species', id, `heartmark move '${sp.heartmark}' is not in the learnset`);
    }
    if (!int(sp.catchRate) || sp.catchRate < 3 || sp.catchRate > 255) err('species', id, 'catchRate must be an integer 3..255');
    if (!num(sp.expYield) || sp.expYield <= 0) err('species', id, 'expYield must be > 0');
    if (!GROWTHS.includes(sp.growth)) err('species', id, `growth must be one of ${GROWTHS.join(' ')}`);
    for (const k of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) if (!int(sp.base?.[k]) || sp.base[k] <= 0) err('species', id, `base.${k} must be a positive integer`);
    if (opts.sprites) {
      const s = opts.sprites[id];
      if (!s || !Array.isArray(s.rows)) err('species', id, 'no front sprite in art/creatures');
      else {
        if (!Array.isArray(s.back)) warn('species', id, 'no back sprite in art/creatures');
        if (opts.master && s.palette) for (const k of Object.keys(s.palette)) if (!(k in opts.master)) err('species', id, `sprite palette key '${k}' is not in MASTER`);
        if (opts.opaqueBounds && s.heartmark && num(s.heartmark.x) && num(s.heartmark.y)) {
          const b = opts.opaqueBounds(s.rows);
          if (b && !(s.heartmark.x >= b.x && s.heartmark.x < b.x + b.w && s.heartmark.y >= b.y && s.heartmark.y < b.y + b.h)) err('species', id, 'heartmark mark lies outside the sprite\'s opaque bounds');
        }
      }
    }
  }
  if (!opts.sprites && list('species').length) warn('species', '*', 'art/creatures not present: sprite, palette and heartmark rules skipped');
  const speciesIdSet = new Set(list('species').map((sp) => sp.id));
  for (const fam of list('families')) {
    const id = fam.id;
    const forms = new Set(familyForms.get(id) ?? []);
    if (forms.size === 0) err('families', id, 'no species names this family');
    if (!Array.isArray(fam.windows) || fam.windows.some((w, i) => !int(w) || w < 1 || (i > 0 && w <= fam.windows[i - 1]))) err('families', id, 'windows must be strictly ascending positive integers');
    const table = fam.shiftTable && typeof fam.shiftTable === 'object' ? fam.shiftTable : null;
    if (!table) err('families', id, 'shiftTable must be an object keyed by form id');
    else {
      for (const [form, pools] of Object.entries(table)) {
        if (!forms.has(form)) err('families', id, `shiftTable form '${form}' is not a form of this family`);
        for (const dir of ['up', 'side', 'down']) {
          const pool = pools?.[dir];
          if (!Array.isArray(pool)) { err('families', id, `shiftTable.${form}.${dir} must be an array`); continue; }
          for (const e of pool) {
            // Pools may name forms of OTHER families (GDD-00 §8: Sloshkin's pools include Lumenveil, Mudfist,
            // Rushling and Chillnub); the target only has to be a real species.
            if (!e || !speciesIdSet.has(e.form)) err('families', id, `shiftTable.${form}.${dir} -> '${e?.form}' is not a known species`);
            // Weight: one number > 0, or per-dial weights {drift, flux, freefall} each >= 0 with at least one > 0
            // (a 0 means the form never appears on that dial).
            const w = e?.w;
            if (num(w)) { if (w <= 0) err('families', id, `shiftTable.${form}.${dir} -> '${e?.form}' weight must be > 0`); }
            else if (w && typeof w === 'object') {
              const dials = ['drift', 'flux', 'freefall'];
              if (dials.some((d) => !num(w[d]) || w[d] < 0)) err('families', id, `shiftTable.${form}.${dir} -> '${e?.form}' per-dial weights need drift, flux and freefall >= 0`);
              else if (dials.every((d) => w[d] === 0)) err('families', id, `shiftTable.${form}.${dir} -> '${e?.form}' is 0 on every dial`);
            } else err('families', id, `shiftTable.${form}.${dir} -> '${e?.form}' weight must be a number or {drift, flux, freefall}`);
          }
        }
      }
    }
    if (fam.star !== undefined && fam.star !== null && !forms.has(fam.star)) err('families', id, `star form '${fam.star}' is not a form of this family`);
  }
  const familyIds = list('families').map((f) => f.id);
  for (const fam of list('families')) {
    for (const other of list('families')) {
      if (other === fam) continue;
      for (const form of familyForms.get(fam.id) ?? []) {
        if (other.shiftTable && form in other.shiftTable) err('families', other.id, `shiftTable names '${form}', a form of family '${fam.id}'`);
      }
    }
  }
  void familyIds;

  // ---- moves -------------------------------------------------------------------------------------
  for (const mv of list('moves')) {
    const id = mv.id;
    if (mv.type !== null && !typeNames.has(mv.type)) err('moves', id, `type '${mv.type}' is not in types (or null)`);
    if (!CATEGORIES.includes(mv.category)) err('moves', id, `category must be one of ${CATEGORIES.join(' ')}`);
    if (!num(mv.power) || mv.power < 0) err('moves', id, 'power must be >= 0');
    if (mv.accuracy !== null && (!num(mv.accuracy) || mv.accuracy <= 0 || mv.accuracy > 100)) err('moves', id, 'accuracy must be null or 1..100');
    const effect = mv.effect && typeof mv.effect === 'object' ? mv.effect : null;
    if (!effect) err('moves', id, 'effect must be an object (may be empty)');
    else {
      for (const k of Object.keys(effect)) if (!effectKeys.has(k)) err('moves', id, `effect key '${k}' is not in EFFECT_KEYS`);
      if (effect.status && !STATUS_KINDS.includes(effect.status.kind)) err('moves', id, `status kind '${effect.status?.kind}' unknown (${STATUS_KINDS.join(' ')})`);
      if (effect.evasion && (mv.pp === null || mv.pp > 5)) err('moves', id, 'evasion moves must have pp <= 5');
      if (mv.pp === null && !effect.scrap) err('moves', id, 'pp may be null only for Scrap');
    }
    if (mv.pp !== null && (!int(mv.pp) || mv.pp < 1)) err('moves', id, 'pp must be null or a positive integer');
    if (!int(mv.priority)) err('moves', id, 'priority must be an integer');
    if (mv.signature !== undefined) {
      if (!has('species', mv.signature)) err('moves', id, `signature species '${mv.signature}' is not in species`);
      else if (!(reg.get('species', mv.signature).learnset ?? []).some((r) => r[1] === id)) err('moves', id, `signature species '${mv.signature}' does not learn it`);
    }
  }

  // ---- abilities ---------------------------------------------------------------------------------
  let wards = 0;
  for (const ab of list('abilities')) {
    if (ab.ward) { wards++; if (!WARD_KINDS.includes(ab.ward.kind)) err('abilities', ab.id, `ward kind '${ab.ward.kind}' unknown (${WARD_KINDS.join(' ')})`); }
    if (ab.hook !== null && ab.hook !== undefined) {
      if (typeof ab.hook !== 'string') err('abilities', ab.id, 'hook must be a key string or null');
      else if (opts.hooks && !opts.hooks.has(ab.hook)) err('abilities', ab.id, `hook '${ab.hook}' has no entry in battle/abilityHooks.HOOKS`);
    }
  }
  if (!opts.hooks && list('abilities').some((a) => typeof a.hook === 'string')) warn('abilities', '*', 'battle/abilityHooks not present: hook keys unchecked');
  if (num(tuning.wardCount) && wards !== tuning.wardCount) err('abilities', '*', `${wards} Ward abilities, tuning.wardCount is ${tuning.wardCount}`);

  // ---- items -------------------------------------------------------------------------------------
  for (const it of list('items')) {
    const id = it.id;
    if (!POCKET_IDS.includes(it.pocket)) err('items', id, `pocket '${it.pocket}' unknown (${POCKET_IDS.join(' ')})`);
    if (!num(it.price) || it.price < 0) err('items', id, 'price must be >= 0');
    if (!num(it.sell) || it.sell < 0) err('items', id, 'sell must be >= 0');
    else if (num(it.price) && it.sell > it.price) warn('items', id, 'sell price above buy price');
    if (!int(it.stack) || it.stack < 1) err('items', id, 'stack must be a positive integer');
    if (it.oneOfAKind && it.pocket !== 'keepsakes') err('items', id, 'oneOfAKind items belong in the keepsakes pocket');
    if (it.use !== null && it.use !== undefined) {
      if (typeof it.use !== 'string') err('items', id, 'use must be a handler key or null');
      else if (opts.useHandlers && !opts.useHandlers.has(it.use)) err('items', id, `use handler '${it.use}' is not in systems/bag.USE_HANDLERS`);
    }
  }
  if (!opts.useHandlers && list('items').some((i) => typeof i.use === 'string')) warn('items', '*', 'systems/bag not present: use handlers unchecked');

  // ---- tilesets / maps ---------------------------------------------------------------------------
  const tiles = new Map(list('tilesets').map((t) => [t.id, t]));
  const legend = { ...(opts.legend ?? Object.fromEntries(list('tilesets').filter((t) => t.char).map((t) => [t.char, t.id]))) };
  const seenChars = new Map();
  for (const tdef of list('tilesets')) {
    if (tdef.char !== undefined) {
      if (typeof tdef.char !== 'string' || tdef.char.length !== 1) err('tilesets', tdef.id, 'char must be one character');
      else if (seenChars.has(tdef.char)) err('tilesets', tdef.id, `char '${tdef.char}' already used by '${seenChars.get(tdef.char)}'`);
      else seenChars.set(tdef.char, tdef.id);
    }
    if (tdef.tide !== null && tdef.tide !== undefined && !TILE_TIDES.includes(tdef.tide)) err('tilesets', tdef.id, `tide must be ${TILE_TIDES.join('|')}|null`);
    if (tdef.anim !== undefined && tdef.anim !== null && !(int(tdef.anim) && tdef.anim >= 0) && !(tdef.anim && typeof tdef.anim === 'object' && int(tdef.anim.frames) && tdef.anim.frames > 0)) err('tilesets', tdef.id, 'anim must be a frame count >= 0, {frames, fps?} or null');
  }
  const mapIndex = new Map(list('maps').map((m) => [m.id, m]));
  /** @type {Map<string, (x: number, y: number, tide: 'low'|'high') => boolean>} */
  const passableFns = new Map();
  const inBounds = (m, x, y) => int(x) && int(y) && x >= 0 && y >= 0 && x < m.w && y < m.h;
  for (const map of list('maps')) {
    const id = map.id;
    if (!int(map.w) || !int(map.h) || map.w < 1 || map.h < 1) { err('maps', id, 'w and h must be positive integers'); continue; }
    if (!['exterior', 'interior'].includes(map.kind)) err('maps', id, 'kind must be exterior|interior');
    if (!has('regions', map.region)) err('maps', id, `region '${map.region}' is not in regions`);
    const lg = { ...legend, ...(map.legend ?? {}) };
    const layers = { ground: map.ground, detail: map.detail, overlay: map.overlay };
    for (const [name, rows] of Object.entries(layers)) {
      if (rows === null || rows === undefined) { if (name === 'ground') err('maps', id, 'ground layer is required'); continue; }
      if (!Array.isArray(rows) || rows.length !== map.h) { err('maps', id, `${name} must have ${map.h} rows`); continue; }
      rows.forEach((row, y) => {
        if (typeof row !== 'string' || row.length !== map.w) { err('maps', id, `${name} row ${y} must be ${map.w} chars`); return; }
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          if (name !== 'ground' && ch === '.') continue;
          const tid = lg[ch];
          if (!tid) err('maps', id, `${name} (${x},${y}): char '${ch}' is not in the legend`);
          else if (!tiles.has(tid)) err('maps', id, `${name} (${x},${y}): legend '${ch}' -> '${tid}' is not in tilesets`);
        }
      });
    }
    if (map.collision) {
      if (!Array.isArray(map.collision) || map.collision.length !== map.h || map.collision.some((r) => typeof r !== 'string' || r.length !== map.w)) err('maps', id, `collision must be ${map.h} rows of ${map.w} chars`);
      else for (const r of map.collision) for (const ch of r) if (!'#.-LH'.includes(ch)) err('maps', id, `collision char '${ch}' must be one of # . - L H`);
    }
    const groundOk = Array.isArray(map.ground) && map.ground.length === map.h && map.ground.every((r) => typeof r === 'string' && r.length === map.w);
    const tileAt = (x, y) => (groundOk ? tiles.get(lg[map.ground[y][x]]) ?? null : null);
    const passable = (x, y, tide) => {
      if (!inBounds(map, x, y)) return false;
      const c = Array.isArray(map.collision) && map.collision[y] ? map.collision[y][x] : '-';
      if (c === '#') return false;
      if (c === '.') return true;
      if (c === 'L') return tide === 'low';
      if (c === 'H') return tide === 'high';
      const t = tileAt(x, y);
      if (!t) return false;
      if (t.solid) return false;
      if (t.tide === 'low') return tide === 'low';
      if (t.tide === 'high') return tide === 'high';
      return !t.water;
    };
    if (groundOk) passableFns.set(id, passable);   // a malformed ground layer already errored; skip derived passability checks
    const passableEver = (x, y) => passable(x, y, 'low') || passable(x, y, 'high');
    if (!map.entry || !inBounds(map, map.entry.x, map.entry.y)) err('maps', id, 'entry must be in bounds');
    else if (groundOk && !passableEver(map.entry.x, map.entry.y)) err('maps', id, `entry (${map.entry.x},${map.entry.y}) is never passable`);
    // animated tiles
    if (groundOk) {
      let animated = 0;
      for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) { const t = tileAt(x, y); if (t && ((num(t.anim) && t.anim > 0) || (t.anim && typeof t.anim === 'object'))) animated++; }
      const cap = num(tuning.animatedTileCap) ? tuning.animatedTileCap : 400;
      if (animated > cap) warn('maps', id, `${animated} animated tiles (cap ${cap})`);
    }
    // tide:'low' components must touch dry land on both ends
    if (groundOk) {
      const seen = new Set();
      for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
        const t = tileAt(x, y);
        if (!t || t.tide !== 'low' || seen.has(`${x},${y}`)) continue;
        const comp = [];
        const stack = [[x, y]];
        seen.add(`${x},${y}`);
        while (stack.length) {
          const [cx, cy] = stack.pop();
          comp.push([cx, cy]);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx; const ny = cy + dy; const k = `${nx},${ny}`;
            const nt = inBounds(map, nx, ny) ? tileAt(nx, ny) : null;
            if (nt && nt.tide === 'low' && !seen.has(k)) { seen.add(k); stack.push([nx, ny]); }
          }
        }
        const dry = new Set();
        for (const [cx, cy] of comp) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (passable(cx + dx, cy + dy, 'high')) dry.add(`${cx + dx},${cy + dy}`);
        if (dry.size < 2) err('maps', id, `tide:low region at (${x},${y}) must touch dry land on both ends (touches ${dry.size})`);
      }
    }
    // entities
    const entityIds = new Set();
    for (const e of map.entities ?? []) {
      if (!e || typeof e.id !== 'string') { err('maps', id, `entity ${JSON.stringify(e)} needs an id`); continue; }
      if (entityIds.has(e.id)) err('maps', id, `entity id '${e.id}' is not unique`);
      entityIds.add(e.id);
      if (!ENTITY_KINDS.includes(e.kind)) err('maps', id, `entity '${e.id}' kind '${e.kind}' unknown`);
      if (!inBounds(map, e.x, e.y)) err('maps', id, `entity '${e.id}' at (${e.x},${e.y}) is out of bounds`);
      if (e.kind === 'npc' && !has('npcs', e.id)) err('maps', id, `npc entity '${e.id}' is not in npcs`);
      if (e.kind === 'item' && e.itemId !== undefined && !has('items', e.itemId)) err('maps', id, `item entity '${e.id}' item '${e.itemId}' is not in items`);
      if (e.kind === 'roamer' && e.speciesId !== undefined && !has('species', e.speciesId)) err('maps', id, `roamer '${e.id}' species '${e.speciesId}' is not in species`);
      if (e.kind === 'tree' && e.fruit !== undefined && !(has('collections', e.fruit) && reg.get('collections', e.fruit).kind === 'fruit')) err('maps', id, `tree '${e.id}' fruit '${e.fruit}' is not a fruit collection row`);
      checkCond('maps', id, e.cond, `entity '${e.id}' cond`);
    }
    for (const tr of map.triggers ?? []) {
      if (!tr || typeof tr.id !== 'string') { err('maps', id, `trigger ${JSON.stringify(tr)} needs an id`); continue; }
      if (!['step', 'use', 'enter'].includes(tr.kind)) err('maps', id, `trigger '${tr.id}' kind '${tr.kind}' must be step|use|enter`);
      if (!inBounds(map, tr.x, tr.y)) err('maps', id, `trigger '${tr.id}' at (${tr.x},${tr.y}) is out of bounds`);
      if (tr.script !== undefined && !has('scripts', tr.script)) err('maps', id, `trigger '${tr.id}' script '${tr.script}' is not in scripts`);
      checkCond('maps', id, tr.cond, `trigger '${tr.id}' cond`);
    }
    for (const w of map.warps ?? []) {
      const where = `warp at (${w?.x},${w?.y})`;
      if (!w || !inBounds(map, w.x, w.y)) { err('maps', id, `${where} is out of bounds`); continue; }
      if (!['door', 'edge', 'stairs'].includes(w.kind)) err('maps', id, `${where} kind '${w.kind}' must be door|edge|stairs`);
      if (groundOk && !passableEver(w.x, w.y)) err('maps', id, `${where} stands on a tile that is never passable`);
      const to = w.to;
      if (!to || !has('maps', to.mapId)) { err('maps', id, `${where} targets unknown map '${to?.mapId}'`); continue; }
      const tm = mapIndex.get(to.mapId);
      if (!inBounds(tm, to.x, to.y)) err('maps', id, `${where} targets (${to.x},${to.y}) outside '${to.mapId}'`);
      checkCond('maps', id, w.cond, `${where} cond`);
    }
    for (const s of map.spawns ?? []) {
      if (!has('encounters', s.table)) err('maps', id, `spawn table '${s.table}' is not in encounters`);
      if (!num(s.rate) || s.rate < 0 || s.rate > 1) err('maps', id, `spawn '${s.table}' rate must be 0..1`);
      if (typeof s.area === 'object' && s.area && !(inBounds(map, s.area.x, s.area.y) && inBounds(map, s.area.x + s.area.w - 1, s.area.y + s.area.h - 1))) err('maps', id, `spawn '${s.table}' area is out of bounds`);
      else if (typeof s.area === 'string') {
        if (!SPAWN_CLASSES.includes(s.area)) err('maps', id, `spawn '${s.table}' area '${s.area}' must be a rect or one of ${SPAWN_CLASSES.join(' ')}`);
        else if (groundOk && !spawnClassPresent(map, lg, tiles, s.area)) err('maps', id, `spawn '${s.table}' area '${s.area}' matches no tile on this map`);
      } else if (!s.area || typeof s.area !== 'object') err('maps', id, `spawn '${s.table}' area must be a rect or a class keyword`);
      checkCond('maps', id, s.cond, `spawn '${s.table}' cond`);
    }
    for (const [name, r] of Object.entries(map.regions ?? {})) {
      if (!r || !inBounds(map, r.x, r.y) || !inBounds(map, r.x + r.w - 1, r.y + r.h - 1)) err('maps', id, `region '${name}' is out of bounds`);
    }
    for (const p of map.props ?? []) { if (!inBounds(map, p.x, p.y)) err('maps', id, `prop '${p.art}' at (${p.x},${p.y}) is out of bounds`); checkCond('maps', id, p.cond, `prop '${p.art}' cond`); }
  }
  // warp targets passable at some tide + reachability (needs every map's passable fn)
  for (const map of list('maps')) {
    const passable = passableFns.get(map.id);
    if (!passable || !map.entry) continue;
    for (const w of map.warps ?? []) {
      const tm = mapIndex.get(w?.to?.mapId);
      const tp = tm && passableFns.get(tm.id);
      if (tp && inBounds(tm, w.to.x, w.to.y) && !(tp(w.to.x, w.to.y, 'low') || tp(w.to.x, w.to.y, 'high'))) err('maps', map.id, `warp at (${w.x},${w.y}) targets a never-passable tile (${w.to.x},${w.to.y}) in '${tm.id}'`);
    }
    for (const tide of ['low', 'high']) {
      const reach = bfs(map, passable, tide);
      for (const w of map.warps ?? []) {
        if (!w || !inBounds(map, w.x, w.y) || reach.has(`${w.x},${w.y}`)) continue;
        const msg = `warp at (${w.x},${w.y}) is not reachable from the entry at ${tide} tide`;
        if (tide === 'low') err('maps', map.id, msg); else warn('maps', map.id, msg);
      }
    }
  }

  // ---- npcs / schedules --------------------------------------------------------------------------
  const paths = new Map(list('schedules').filter((s) => s.kind === 'path').map((s) => [s.id, s]));
  for (const s of list('schedules')) {
    if (!['path', 'template'].includes(s.kind)) err('schedules', s.id, 'kind must be path|template');
    if (s.kind === 'path') {
      if (!has('maps', s.mapId)) err('schedules', s.id, `mapId '${s.mapId}' is not in maps`);
      if (!Array.isArray(s.points) || s.points.length === 0 || s.points.some((p) => !Array.isArray(p) || p.length !== 2 || !int(p[0]) || !int(p[1]))) err('schedules', s.id, 'points must be a non-empty [[x, y]] list');
      else if (has('maps', s.mapId)) {
        const m = mapIndex.get(s.mapId);
        const pass = passableFns.get(s.mapId);
        for (const [x, y] of s.points) if (!inBounds(m, x, y) || (pass && !(pass(x, y, 'low') || pass(x, y, 'high')))) err('schedules', s.id, `point (${x},${y}) is out of bounds or never passable on '${s.mapId}'`);
      }
    }
  }
  const threadsByNpc = new Map();
  for (const th of list('threads')) threadsByNpc.set(th.npcId, [...(threadsByNpc.get(th.npcId) ?? []), th.id]);
  for (const npc of list('npcs')) {
    const id = npc.id;
    if (!has('maps', npc.home)) err('npcs', id, `home '${npc.home}' is not in maps`);
    if (npc.threadId) {
      if (!has('threads', npc.threadId)) err('npcs', id, `threadId '${npc.threadId}' is not in threads`);
      else if (reg.get('threads', npc.threadId).npcId !== id) err('npcs', id, `thread '${npc.threadId}' belongs to npc '${reg.get('threads', npc.threadId).npcId}'`);
    }
    if (!Array.isArray(npc.schedule) || npc.schedule.length === 0) err('npcs', id, 'schedule must be a non-empty array');
    else {
      let lastAt = -1;
      npc.schedule.forEach((e, i) => {
        const where = `schedule[${i}]`;
        if (typeof e.at === 'number') {
          if (!int(e.at) || e.at < 0 || e.at >= 1440) err('npcs', id, `${where} at must be a minute 0..1439`);
          if (e.at <= lastAt) err('npcs', id, `${where} at ${e.at} is not after the previous timed entry (${lastAt})`);
          lastAt = e.at;
        } else if (!(e.at && typeof e.at === 'object' && (TIDE_STATES.includes(e.at.tide) || typeof e.at.phase === 'string'))) err('npcs', id, `${where} at must be a minute, {tide} or {phase}`);
        if (!has('maps', e.mapId)) err('npcs', id, `${where} mapId '${e.mapId}' is not in maps`);
        else {
          const m = mapIndex.get(e.mapId);
          const pass = passableFns.get(e.mapId);
          if (!inBounds(m, e.x, e.y)) err('npcs', id, `${where} (${e.x},${e.y}) is out of bounds on '${e.mapId}'`);
          else if (pass && !(pass(e.x, e.y, 'low') || pass(e.x, e.y, 'high'))) err('npcs', id, `${where} (${e.x},${e.y}) is never passable on '${e.mapId}'`);
        }
        if (e.pose !== undefined && !POSES.includes(e.pose)) err('npcs', id, `${where} pose '${e.pose}' unknown (${POSES.join(' ')})`);
        if (e.path !== undefined) {
          if (!paths.has(e.path)) err('npcs', id, `${where} path '${e.path}' is not a schedules path`);
          else if (paths.get(e.path).mapId !== e.mapId) warn('npcs', id, `${where} path '${e.path}' is on '${paths.get(e.path).mapId}', entry is on '${e.mapId}'`);
        }
        if (e.days !== undefined && (!Array.isArray(e.days) || e.days.some((d) => !int(d) || d < 0 || d > 6))) err('npcs', id, `${where} days must be integers 0..6`);
        checkCond('npcs', id, e.cond, `${where} cond`);
      });
    }
    const topicIds = new Set();
    for (const tp of npc.topics ?? []) {
      if (typeof tp.id !== 'string') { err('npcs', id, `topic ${JSON.stringify(tp)} needs an id`); continue; }
      if (topicIds.has(tp.id)) err('npcs', id, `topic id '${tp.id}' is not unique`);
      topicIds.add(tp.id);
      if (!has('scripts', tp.script)) err('npcs', id, `topic '${tp.id}' script '${tp.script}' is not in scripts`);
      if (tp.priority !== undefined && !num(tp.priority)) err('npcs', id, `topic '${tp.id}' priority must be a number`);
      checkCond('npcs', id, tp.cond, `topic '${tp.id}' cond`);
    }
    const generic = npc.lines?.generic;
    if (!Array.isArray(generic) || generic.length === 0) warn('npcs', id, 'no lines.generic: the default line will show');
    else {
      const ids = new Set();
      for (const l of generic) {
        if (!l || typeof l.id !== 'string' || typeof l.text !== 'string') err('npcs', id, `lines.generic entries need {id, text}`);
        else if (ids.has(l.id)) err('npcs', id, `lines.generic id '${l.id}' is not unique`);
        else ids.add(l.id);
      }
    }
  }

  // ---- threads -----------------------------------------------------------------------------------
  for (const th of list('threads')) {
    const id = th.id;
    if (!has('npcs', th.npcId)) err('threads', id, `npcId '${th.npcId}' is not in npcs`);
    else if (reg.get('npcs', th.npcId).threadId !== id) warn('threads', id, `npc '${th.npcId}' does not name this thread as threadId`);
    if (!Array.isArray(th.beats) || th.beats.length === 0) { err('threads', id, 'beats must be a non-empty array'); continue; }
    th.beats.forEach((b, i) => {
      if (b.id !== i + 1) err('threads', id, `beat ${JSON.stringify(b.id)} at index ${i} must be numbered ${i + 1} (ids contiguous from 1)`);
      if (!has('scripts', b.script)) err('threads', id, `beat ${b.id} script '${b.script}' is not in scripts`);
      checkCond('threads', id, b.cond, `beat ${b.id} cond`);
      if (b.advance !== undefined) {
        if (!b.advance || typeof b.advance !== 'object') err('threads', id, `beat ${b.id} advance must be an object`);
        else {
          for (const k of Object.keys(b.advance)) if (!ADVANCE_KEYS.includes(k)) err('threads', id, `beat ${b.id} advance key '${k}' unknown (${ADVANCE_KEYS.join(' ')})`);
          if (b.advance.dayOfWeek !== undefined && (!Array.isArray(b.advance.dayOfWeek) || b.advance.dayOfWeek.some((d) => !int(d) || d < 0 || d > 6))) err('threads', id, `beat ${b.id} advance.dayOfWeek must be integers 0..6`);
        }
      }
      if (b.where) {
        if (!has('maps', b.where.mapId)) err('threads', id, `beat ${b.id} where.mapId '${b.where.mapId}' is not in maps`);
        else if (!inBounds(mapIndex.get(b.where.mapId), b.where.x, b.where.y)) err('threads', id, `beat ${b.id} where is out of bounds`);
      }
    });
  }

  // ---- letters -----------------------------------------------------------------------------------
  const letters = list('letters').slice().sort((a, b) => a.n - b.n);
  letters.forEach((l, i) => {
    if (l.n !== i + 1) err('letters', l.id, `n ${l.n} breaks the contiguous 1..n order (expected ${i + 1})`);
    for (const f of ['from', 'to', 'date', 'seal', 'body']) if (typeof l[f] !== 'string' || !l[f]) err('letters', l.id, `${f} must be a non-empty string`);
    if (l.relicId !== null && l.relicId !== undefined && !(has('collections', l.relicId) && reg.get('collections', l.relicId).kind === 'relic')) err('letters', l.id, `relicId '${l.relicId}' is not a relic collection row`);
    if (l.unlock !== null && l.unlock !== undefined) checkCond('letters', l.id, l.unlock, 'unlock');
    if (l.reveal !== undefined) {
      const r = validateOps(l.reveal, { scriptId: `letter-${l.n}.reveal`, has, isNpcId, validateCond: (c) => validateCond(c, condOpts) });
      for (const p of r.errors) err('letters', l.id, `reveal: ${p}`);
    }
  });

  // ---- scripts / event scripts -------------------------------------------------------------------
  const scripts = DATA.scripts && typeof DATA.scripts === 'object' ? DATA.scripts : {};
  for (const [id, ops] of Object.entries(scripts)) {
    const r = validateOps(ops, { scriptId: id, has, isNpcId, validateCond: (c) => validateCond(c, condOpts) });
    errors.push(...r.errors);
    warnings.push(...r.warnings);
  }
  for (const es of list('eventScripts')) {
    if (typeof es.event !== 'string' || !es.event) err('eventScripts', es.id, 'event must be a bus event name');
    if (!has('scripts', es.script)) err('eventScripts', es.id, `script '${es.script}' is not in scripts`);
  }

  // ---- trainers ----------------------------------------------------------------------------------
  for (const tr of list('trainers')) {
    const id = tr.id;
    if (!Array.isArray(tr.party) || tr.party.length < 1 || tr.party.length > 6) err('trainers', id, 'party must hold 1..6 creatures');
    for (const c of tr.party ?? []) {
      if (!has('species', c.species)) { err('trainers', id, `party species '${c.species}' is not in species`); continue; }
      if (!int(c.level) || c.level < 1 || c.level > LEVEL_MAX) err('trainers', id, `party '${c.species}' level must be 1..${LEVEL_MAX}`);
      if (c.moves !== undefined) {
        if (!Array.isArray(c.moves) || c.moves.length > 4) err('trainers', id, `party '${c.species}' moves must list at most 4 moves`);
        else {
          const sp = reg.get('species', c.species);
          for (const mv of c.moves) {
            if (!has('moves', mv)) err('trainers', id, `party '${c.species}' move '${mv}' is not in moves`);
            else if (!(sp.learnset ?? []).some((r) => r[1] === mv && r[0] <= c.level)) warn('trainers', id, `party '${c.species}' cannot know '${mv}' at level ${c.level}`);
          }
        }
      }
    }
    for (const it of tr.items ?? []) if (!has('items', it.id)) err('trainers', id, `item '${it.id}' is not in items`);
    if (!num(tr.payout) || tr.payout < 0) err('trainers', id, 'payout must be >= 0');
    if (!aiProfiles.has(tr.ai)) err('trainers', id, `ai profile '${tr.ai}' unknown (${[...aiProfiles].join(' ')})`);
    for (const [k, sid] of Object.entries(tr.scripts ?? {})) {
      if (!['before', 'afterWin', 'afterLoss'].includes(k)) err('trainers', id, `scripts.${k} is not before|afterWin|afterLoss`);
      if (!has('scripts', sid)) err('trainers', id, `scripts.${k} '${sid}' is not in scripts`);
    }
  }

  // ---- shops -------------------------------------------------------------------------------------
  for (const sh of list('shops')) {
    const id = sh.id;
    if (!Array.isArray(sh.hours) || sh.hours.length !== 2 || sh.hours.some((h) => !int(h) || h < 0 || h > 1440)) err('shops', id, 'hours must be [open, close] minutes in 0..1440');
    if (!has('npcs', sh.keeper)) err('shops', id, `keeper '${sh.keeper}' is not in npcs`);
    if (sh.nightKeeper && !has('npcs', sh.nightKeeper)) err('shops', id, `nightKeeper '${sh.nightKeeper}' is not in npcs`);
    for (const s of sh.stock ?? []) {
      if (!has('items', s.item)) err('shops', id, `stock item '${s.item}' is not in items`);
      if (s.qty !== undefined && (!int(s.qty) || s.qty < 1)) err('shops', id, `stock '${s.item}' qty must be a positive integer`);
      checkCond('shops', id, s.cond, `stock '${s.item}' cond`);
    }
    for (const k of sh.buys ?? []) if (!COLLECTION_KINDS.includes(k)) err('shops', id, `buys kind '${k}' unknown (${COLLECTION_KINDS.join(' ')})`);
    if (!num(sh.priceMult) || sh.priceMult <= 0) err('shops', id, 'priceMult must be > 0');
  }

  // ---- encounters --------------------------------------------------------------------------------
  const minL = num(tuning.encounterMinLevel) ? tuning.encounterMinLevel : 1;
  const maxL = num(tuning.encounterMaxLevel) ? tuning.encounterMaxLevel : LEVEL_MAX;
  const spawnTables = new Set(list('maps').flatMap((m) => (m.spawns ?? []).map((s) => s.table)));
  const encounters = DATA.encounters && typeof DATA.encounters === 'object' ? DATA.encounters : {};
  for (const [id, rows] of Object.entries(encounters)) {
    if (!Array.isArray(rows) || rows.length === 0) { err('encounters', id, 'table must be a non-empty array'); continue; }
    let unconditional = 0;
    for (const r of rows) {
      if (!has('species', r.species)) err('encounters', id, `species '${r.species}' is not in species`);
      if (!num(r.w) || r.w <= 0) err('encounters', id, `'${r.species}' weight must be > 0`);
      if (!Array.isArray(r.levels) || r.levels.length !== 2 || !int(r.levels[0]) || !int(r.levels[1]) || r.levels[0] > r.levels[1] || r.levels[0] < minL || r.levels[1] > maxL) err('encounters', id, `'${r.species}' levels must be [min, max] within ${minL}..${maxL}`);
      if (r.cond === undefined) unconditional++;
      checkCond('encounters', id, r.cond, `'${r.species}' cond`);
    }
    if (unconditional === 0) err('encounters', id, 'needs at least one unconditional row');
    if (!spawnTables.has(id)) warn('encounters', id, 'no map spawn uses this table');
  }

  // ---- regions / loans / dials / collections -----------------------------------------------------
  for (const r of list('regions')) if (!int(r.curveLevel) || r.curveLevel < 1) err('regions', r.id, 'curveLevel must be a positive integer');
  list('loans').slice().sort((a, b) => a.tier - b.tier).forEach((l, i) => {
    if (l.tier !== i + 1) err('loans', l.id, `tier ${l.tier} breaks the contiguous 1..n ladder`);
    if (l.id !== `tier-${l.tier}`) err('loans', l.id, `id must be 'tier-${l.tier}' (cond DSL looks loans up by tier)`);
    if (!num(l.amount) || l.amount < 0) err('loans', l.id, 'amount must be >= 0');
  });
  for (const d of list('dials')) {
    if (!d.rules || typeof d.rules !== 'object') { err('dials', d.id, 'rules object required'); continue; }
    for (const k of ['readCostsTurn', 'wardBadge', 'runAllowed', 'anchorsAllowed']) if (typeof d.rules[k] !== 'boolean') err('dials', d.id, `rules.${k} must be a boolean`);
    if (!['percent', 'band'].includes(d.rules.captureDisplay)) err('dials', d.id, 'rules.captureDisplay must be percent|band');
    if (!int(d.rules.holdOutTurns) || d.rules.holdOutTurns < 0) err('dials', d.id, 'rules.holdOutTurns must be an integer >= 0');
  }
  for (const c of list('collections')) {
    if (!COLLECTION_KINDS.includes(c.kind)) err('collections', c.id, `kind '${c.kind}' unknown (${COLLECTION_KINDS.join(' ')})`);
    if (!num(c.price) || c.price < 0) err('collections', c.id, 'price must be >= 0');
    if (c.when) checkCond('collections', c.id, c.when, 'when');
  }

  // ---- tracks (optional) -------------------------------------------------------------------------
  if (opts.tracks && opts.tracks.CUES) {
    const trackIds = new Set(Object.keys(opts.tracks.TRACKS ?? {}));
    for (let h = 0; h < 24; h++) {
      const cue = opts.tracks.CUES[h] ?? opts.tracks.CUES[String(h)];
      const tid = typeof cue === 'string' ? cue : cue?.track;
      if (!tid) err('tracks', `hour-${h}`, 'no cue for this hour');
      else if (trackIds.size && !trackIds.has(tid)) err('tracks', `hour-${h}`, `cue '${tid}' is not a track`);
    }
  }

  // ---- flags read somewhere must be set somewhere (warning) --------------------------------------
  const setFlags = new Set();
  const readFlags = new Map();
  const noteRead = (cond, where) => { for (const f of flagsReadBy(cond)) if (!readFlags.has(f)) readFlags.set(f, where); };
  for (const [id, ops] of Object.entries(scripts)) {
    walkOps(ops, (op) => {
      if (op.op === 'setFlag' && typeof op.id === 'string') setFlags.add(op.id);
      if (op.op === 'if') noteRead(op.cond, `scripts:${id}`);
      if (op.op === 'choice') for (const o of op.options ?? []) noteRead(o.cond, `scripts:${id}`);
    }, isNpcId);
  }
  for (const l of letters) walkOps(l.reveal ?? [], (op) => { if (op.op === 'setFlag') setFlags.add(op.id); if (op.op === 'if') noteRead(op.cond, `letters:${l.id}`); });
  for (const l of letters) noteRead(l.unlock, `letters:${l.id}`);
  for (const npc of list('npcs')) { for (const tp of npc.topics ?? []) noteRead(tp.cond, `npcs:${npc.id}`); for (const e of npc.schedule ?? []) noteRead(e.cond, `npcs:${npc.id}`); }
  for (const th of list('threads')) for (const b of th.beats ?? []) noteRead(b.cond, `threads:${th.id}`);
  for (const m of list('maps')) for (const x of [...(m.entities ?? []), ...(m.triggers ?? []), ...(m.warps ?? []), ...(m.spawns ?? []), ...(m.props ?? [])]) noteRead(x.cond, `maps:${m.id}`);
  for (const sh of list('shops')) for (const s of sh.stock ?? []) noteRead(s.cond, `shops:${sh.id}`);
  for (const rows of Object.values(encounters)) if (Array.isArray(rows)) for (const r of rows) noteRead(r.cond, 'encounters');
  for (const [f, where] of readFlags) {
    if (f.startsWith('sys.') || f.startsWith('seen.')) continue;
    if (!setFlags.has(f)) warnings.push(`${where}: flag '${f}' is read but never set by a script or letter (a system may set it)`);
  }

  const notes = [];
  if (opts.manifest) {
    const m = checkManifest(DATA, opts.manifest);
    warnings.push(...m.warnings);
    notes.push(...m.notes);
  }

  return { errors, warnings, notes };
}

/**
 * Compares each DATA table with the id manifest (`js/data/ids.manifest.js` MANIFEST). A table counts
 * as authored once it holds at least one manifest id; until then it gets a note, not a warning, so the
 * placeholder tables stay quiet. For an authored table, every missing manifest id (except `optional`
 * ones) and every id the manifest does not list (unless `extras: 'allow'`) is a warning. Warnings, not
 * errors, until the content lanes land.
 * @param {Record<string, any>} DATA
 * @param {Record<string, {ids: readonly string[], optional?: readonly string[], extras?: 'warn'|'allow', kind?: readonly string[]}>} manifest
 * @returns {{warnings: string[], notes: string[]}}
 */
export function checkManifest(DATA, manifest) {
  const warnings = [];
  const notes = [];
  const MAX_LISTED = 20;
  const listIds = (a) => (a.length > MAX_LISTED ? `${a.slice(0, MAX_LISTED).join(', ')} (+${a.length - MAX_LISTED} more)` : a.join(', '));
  for (const [table, spec] of Object.entries(manifest)) {
    const raw = DATA[table];
    if (raw === undefined) { notes.push(`manifest: DATA has no '${table}' table yet (${spec.ids.length} manifest ids)`); continue; }
    let rows = Array.isArray(raw) ? raw : Object.keys(raw).map((id) => ({ id }));
    if (spec.kind) rows = rows.filter((r) => spec.kind.includes(r?.kind));
    const have = rows.map((r) => r?.id).filter((id) => typeof id === 'string');
    const want = new Set(spec.ids);
    if (!have.some((id) => want.has(id))) {
      notes.push(`manifest: '${table}' not yet authored (0 of ${spec.ids.length} manifest ids; ${have.length} other ids)`);
      continue;
    }
    const haveSet = new Set(have);
    const optional = new Set(spec.optional ?? []);
    const missing = spec.ids.filter((id) => !haveSet.has(id) && !optional.has(id));
    if (missing.length) warnings.push(`${table}:*: missing ${missing.length} manifest id(s): ${listIds(missing)}`);
    if (spec.extras !== 'allow') {
      for (const id of have) if (!want.has(id)) warnings.push(`${table}:${id}: id is not in js/data/ids.manifest.js`);
    }
  }
  return { warnings, notes };
}

/**
 * Whether any cell of a map matches a keyword spawn class, by the same rule `world/tilemap` uses
 * (`tile.spawn` when set, else water for `'water'`, else the tile id contains the keyword; the
 * detail layer wins over ground).
 * @param {any} map
 * @param {Record<string, string>} lg     merged legend
 * @param {Map<string, any>} tiles        tile id -> def
 * @param {string} cls
 * @returns {boolean}
 */
function spawnClassPresent(map, lg, tiles, cls) {
  for (let y = 0; y < map.h; y++) {
    for (let x = 0; x < map.w; x++) {
      const dch = Array.isArray(map.detail) && typeof map.detail[y] === 'string' ? map.detail[y][x] : '.';
      const id = dch && dch !== '.' && lg[dch] ? lg[dch] : lg[map.ground[y][x]];
      const t = id ? tiles.get(id) : null;
      if (!t) continue;
      if (typeof t.spawn === 'string' ? t.spawn === cls : cls === 'water' ? t.water === true : id.includes(cls)) return true;
    }
  }
  return false;
}

/**
 * 4-directional flood fill from the map entry.
 * @param {any} map
 * @param {(x: number, y: number, tide: 'low'|'high') => boolean} passable
 * @param {'low'|'high'} tide
 * @returns {Set<string>} `"x,y"` keys reached
 */
function bfs(map, passable, tide) {
  const seen = new Set();
  const start = [map.entry.x, map.entry.y];
  if (!passable(start[0], start[1], tide)) return seen;
  const q = [start];
  seen.add(`${start[0]},${start[1]}`);
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx; const ny = y + dy; const k = `${nx},${ny}`;
      if (!seen.has(k) && passable(nx, ny, tide)) { seen.add(k); q.push([nx, ny]); }
    }
  }
  return seen;
}

/**
 * Save-file check (`--world`): schema validation against the registry plus the version bound.
 * @param {any} world
 * @param {import('../js/data/registry.js').Registry} reg
 * @returns {string[]} problems
 */
export function validateWorldAgainst(world, reg) {
  const out = [];
  if (!world || typeof world !== 'object') return ['world: not an object'];
  if (!Number.isInteger(world.v) || world.v > SCHEMA_VERSION) out.push(`world:v: ${world.v} is newer than SCHEMA_VERSION ${SCHEMA_VERSION}`);
  for (const p of validateWorld(world, reg)) out.push(`world: ${p}`);
  return out;
}

/**
 * Imports an optional module, returning null when it is absent or fails to load under Node.
 * @param {string} rel path relative to the repo root
 * @param {string[]} notes collects a note when the module exists but cannot load
 * @returns {Promise<any|null>}
 */
async function optional(rel, notes) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) return null;
  try { return await import(pathToFileURL(p).href); } catch (e) { notes.push(`${rel}: could not load under Node (${e.message}); its rules are skipped`); return null; }
}

/**
 * Gathers the optional lane modules into validator options.
 * @returns {Promise<{opts: ValidateOptions, notes: string[]}>}
 */
export async function loadOptions() {
  const notes = [];
  const tuning = (await import('../js/data/tuning.js')).TUNING;
  const effects = await optional('js/battle/effects.js', notes);
  const hooks = await optional('js/battle/abilityHooks.js', notes);
  const bag = await optional('js/systems/bag.js', notes);
  const ai = await optional('js/battle/ai.js', notes);
  const creatures = await optional('js/art/creatures/index.js', notes);
  const palette = await optional('js/art/palette.js', notes);
  const pixelart = await optional('js/core/pixelart.js', notes);
  const tracks = await optional('js/audio/tracks/index.js', notes);
  const manifest = await optional('js/data/ids.manifest.js', notes);
  return {
    notes,
    opts: {
      tuning,
      effectKeys: effects?.EFFECT_KEYS ?? DRAFT_EFFECT_KEYS,
      hooks: hooks?.HOOKS ? new Set(Object.keys(hooks.HOOKS)) : null,
      useHandlers: bag?.USE_HANDLERS ? new Set(Object.keys(bag.USE_HANDLERS)) : null,
      aiProfiles: ai?.PROFILES ? Object.keys(ai.PROFILES) : DRAFT_AI_PROFILES,
      sprites: creatures?.CREATURE_SPRITES ?? null,
      master: palette?.MASTER ?? null,
      opaqueBounds: typeof pixelart?.opaqueBounds === 'function' ? pixelart.opaqueBounds : null,
      tracks: tracks ? { TRACKS: tracks.TRACKS, CUES: tracks.CUES } : null,
      manifest: manifest?.MANIFEST ?? null,
    },
  };
}

/** @returns {Promise<number>} exit code */
export async function main(argv = process.argv.slice(2)) {
  const strict = argv.includes('--strict');
  const quiet = argv.includes('--quiet');
  const wi = argv.indexOf('--world');
  const di = argv.indexOf('--data');
  if (di >= 0 && !argv[di + 1]) { console.error('error data: --data needs a module path'); return 1; }
  const { DATA, DEFAULT_LEGEND } = di >= 0
    ? await import(pathToFileURL(resolve(argv[di + 1])).href)
    : await import('../js/data/index.js');
  const { opts, notes } = await loadOptions();
  const { errors, warnings, notes: dataNotes } = validateData(DATA, { ...opts, ...(DEFAULT_LEGEND ? { legend: DEFAULT_LEGEND } : {}) });
  notes.push(...dataNotes);
  if (wi >= 0) {
    const file = argv[wi + 1];
    if (!file) errors.push('world: --world needs a file path');
    else {
      try { errors.push(...validateWorldAgainst(JSON.parse(readFileSync(resolve(file), 'utf8')), createRegistry(DATA))); } catch (e) { errors.push(`world: ${file}: ${e.message}`); }
    }
  }
  for (const e of errors) console.error(`error ${e}`);
  if (!quiet) for (const w of warnings) console.warn(`warn  ${w}`);
  if (!quiet) for (const n of notes) console.warn(`note  ${n}`);
  const tables = Object.entries(DATA).map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : Object.keys(v).length}`).join(' ');
  console.log(`validate-data: ${errors.length} errors, ${warnings.length} warnings (${tables})`);
  return errors.length || (strict && warnings.length) ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
