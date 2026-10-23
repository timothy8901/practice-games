/**
 * Party, box and Training Yard: uids, adding catches, swapping, storing, healing, nicknames, the
 * Heartmark technique pin, and writing a battle's outcome back into the world (ARCHITECTURE §5.5).
 * [RULES-CREATURE]
 *
 * Owns `world.party`, `world.box` and `world.yard` (tools/lint-owners). Every function is
 * `fn(world, ...args, opts?)`, runs inside a caller's `store.tx`, and returns a plain result; with
 * `opts.bus` it emits domain events after mutating (§3.4): `party:changed {reason, uid?}`,
 * `creature:levelUp {uid, from, to}`, `creature:learned {uid, move}`, (through systems/exp)
 * `shift:window {uid, level, held}` and (through systems/settings, on release) `settings:changed`. Refusals are results (`{ok: false, reason}`), not throws;
 * programming errors (bad indices types, duplicate uids) throw.
 *
 * Tunables: {@link DEFAULTS} here plus `creature.DEFAULTS` and `exp.DEFAULTS`; one flat
 * `opts.tuning` object is handed to all three ({@link checkTuning} validates it). Content arrives
 * as `data` (Registry or tables; see `exp.dataLookup`). Pure: no DOM; randomness only from the
 * injected rng.
 * @module systems/party
 */

import { PARTY_MAX as SCHEMA_PARTY_MAX, STATUS_KINDS } from '../state/schema.js';
import { day as dayOf } from '../state/selectors.js';
import { nextUid as nextCounterUid } from './flags.js';
import * as creature from './creature.js';
import * as exp from './exp.js';
import { setAutoAnchor } from './settings.js';

/** @typedef {import('../state/schema.js').World} World */
/** @typedef {import('../state/schema.js').Creature} Creature */
/** @typedef {import('../core/rng.js').Rng} Rng */
/** @typedef {{emit: (evt: string, payload: any) => any}} Bus */
/** @typedef {{tuning?: Record<string, any>|null, bus?: Bus|null}} PartyOpts */

/**
 * @typedef {Object} PartyTuning
 * @property {number} PARTY_MAX        party size (≤ schema PARTY_MAX)
 * @property {number} BOX_CAPACITY     creatures the box holds
 * @property {number} NICKNAME_MAX     characters in a nickname
 * @property {boolean} LIGHT_ON_CATCH  a creature added to the party/box is bonded (`wild = false`, Heartmark lit)
 */

/**
 * Designer-tunable defaults. [GDD values]
 * @type {Readonly<PartyTuning>}
 */
export const DEFAULTS = Object.freeze({
  PARTY_MAX: 6,
  BOX_CAPACITY: 120,
  NICKNAME_MAX: 12,
  LIGHT_ON_CATCH: true,
});

/** @type {Record<keyof PartyTuning, [(v: any) => boolean, string]>} */
const SPEC = {
  PARTY_MAX: [(v) => Number.isInteger(v) && v >= 1 && v <= SCHEMA_PARTY_MAX, `integer 1..${SCHEMA_PARTY_MAX}`],
  BOX_CAPACITY: [(v) => Number.isInteger(v) && v >= 0, 'integer ≥ 0'],
  NICKNAME_MAX: [(v) => Number.isInteger(v) && v >= 1, 'integer ≥ 1'],
  LIGHT_ON_CATCH: [(v) => typeof v === 'boolean', 'boolean'],
};

/** Tuning keys this module reads. */
export const TUNING_KEYS = Object.freeze(Object.keys(DEFAULTS));

/** Every tuning key of the lane (party + creature + exp), for {@link checkTuning} and the GDD table. */
export const ALL_TUNING_KEYS = Object.freeze([...TUNING_KEYS, ...creature.TUNING_KEYS, ...exp.TUNING_KEYS]);

/** @type {WeakMap<object, Readonly<PartyTuning>>} */
const TUNING_CACHE = new WeakMap();

/**
 * Resolves a partial tuning override over {@link DEFAULTS}. Keys of other modules are ignored.
 * Cached per override object only when that object is frozen (mutable overrides are re-read).
 * @param {Partial<PartyTuning>|null|undefined} [tuning]
 * @returns {Readonly<PartyTuning>}
 * @throws {TypeError} when a known key has a malformed value
 */
export function tuningOf(tuning) {
  if (tuning == null) return DEFAULTS;
  if (typeof tuning !== 'object') throw new TypeError('party.tuningOf: tuning must be an object');
  const cacheable = Object.isFrozen(tuning);
  const hit = cacheable ? TUNING_CACHE.get(tuning) : undefined;
  if (hit) return hit;
  /** @type {any} */
  const out = { ...DEFAULTS };
  for (const key of TUNING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(tuning, key)) continue;
    const v = /** @type {any} */ (tuning)[key];
    const [pred, desc] = SPEC[/** @type {keyof PartyTuning} */ (key)];
    if (!pred(v)) throw new TypeError(`party tuning ${key}: expected ${desc}, got ${JSON.stringify(v)}`);
    out[key] = v;
  }
  const frozen = Object.freeze(out);
  if (cacheable) TUNING_CACHE.set(tuning, frozen);
  return frozen;
}

/**
 * Validates a flat tuning object for the whole lane: unknown keys and malformed values.
 * @param {Record<string, any>|null|undefined} tuning
 * @returns {string[]} problems; empty = valid
 */
export function checkTuning(tuning) {
  if (tuning == null) return [];
  if (typeof tuning !== 'object') return ['tuning: expected an object'];
  const out = [];
  for (const key of Object.keys(tuning)) if (!ALL_TUNING_KEYS.includes(key)) out.push(`tuning.${key}: unknown key`);
  for (const resolve of [tuningOf, creature.tuningOf, exp.tuningOf]) {
    try {
      resolve(/** @type {any} */ ({ ...tuning }));
    } catch (err) {
      out.push(String(/** @type {Error} */ (err).message));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Lookup and uids
// ---------------------------------------------------------------------------------------------

/**
 * Finds a creature by uid.
 * @param {World} world
 * @param {string} uid
 * @returns {{c: Creature, where: 'party'|'box', index: number}|null}
 */
export function findCreature(world, uid) {
  let index = world.party.findIndex((c) => c.uid === uid);
  if (index >= 0) return { c: world.party[index], where: 'party', index };
  index = world.box.findIndex((c) => c.uid === uid);
  if (index >= 0) return { c: world.box[index], where: 'box', index };
  return null;
}

/**
 * Allocates the next creature uid (`'c1'`, `'c2'`, ...) from the `sys.uid` counter
 * (systems/flags), skipping any uid already in the world (e.g. after an import).
 * @param {World} world
 * @returns {string}
 */
export function nextUid(world) {
  let uid = nextCounterUid(world);
  while (findCreature(world, uid)) uid = nextCounterUid(world);
  return uid;
}

/** @param {PartyOpts} opts @param {string} evt @param {any} payload */
function emit(opts, evt, payload) {
  opts.bus?.emit(evt, payload);
}

// ---------------------------------------------------------------------------------------------
// Adding
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} AddOpts
 * @property {boolean} [caught=true]   a fresh catch/gift: stamp caughtDay/caughtMap, skip passed windows, light the Heartmark
 * @property {number} [day]            default: today (state/selectors.day)
 * @property {string} [mapId]          default: world.player.mapId
 * @property {'party'|'box'} [to]      force a destination (default: party when it has room, else box)
 */

/**
 * Adds a creature to the party (or the box when the party is full). The stored record is a
 * normalized copy (`creature.serialize` then `creature.deserialize`: schema keys only, content ids
 * checked against `data`, numbers clamped, stats recomputed); a uid that is not a non-empty string
 * is replaced by one from {@link nextUid}.
 * @param {World} world
 * @param {Creature} c
 * @param {any} data
 * @param {PartyOpts & AddOpts} [opts]
 * @returns {{ok: true, uid: string, where: 'party'|'box', index: number, creature: Creature, skippedWindows: number[]}|{ok: false, reason: 'full'|'party-full'|'box-full'}}
 * @throws {TypeError} for a non-object; {Error} for a uid already in the world; {RangeError} for unknown content ids
 */
export function addCreature(world, c, data, opts = {}) {
  if (!c || typeof c !== 'object') throw new TypeError('party.addCreature: creature must be an object');
  const t = tuningOf(opts.tuning);
  if (typeof c.uid === 'string' && c.uid && findCreature(world, c.uid)) {
    throw new Error(`party.addCreature: uid ${JSON.stringify(c.uid)} is already in the world`);
  }
  const partyRoom = world.party.length < t.PARTY_MAX;
  const boxRoom = world.box.length < t.BOX_CAPACITY;
  /** @type {'party'|'box'} */
  let where;
  if (opts.to === 'party') {
    if (!partyRoom) return { ok: false, reason: 'party-full' };
    where = 'party';
  } else if (opts.to === 'box') {
    if (!boxRoom) return { ok: false, reason: 'box-full' };
    where = 'box';
  } else if (partyRoom) where = 'party';
  else if (boxRoom) where = 'box';
  else return { ok: false, reason: 'full' };

  const raw = creature.serialize(c);
  if (typeof raw.uid !== 'string' || !raw.uid) raw.uid = nextUid(world);
  const rec = creature.deserialize(raw, data, opts);
  /** @type {number[]} */
  let skippedWindows = [];
  if (opts.caught !== false) {
    rec.caughtDay = Number.isInteger(opts.day) ? /** @type {number} */ (opts.day) : dayOf(world);
    rec.caughtMap = typeof opts.mapId === 'string' ? opts.mapId : (world.player?.mapId ?? '');
    if (t.LIGHT_ON_CATCH) rec.wild = false;
    skippedWindows = exp.skipPassedWindows(rec, data, opts);
  }
  const list = where === 'party' ? world.party : world.box;
  list.push(rec);
  exp.refreshPending(world, rec.uid, data, opts);
  emit(opts, 'party:changed', { reason: 'add', uid: rec.uid, where });
  return { ok: true, uid: rec.uid, where, index: list.length - 1, creature: rec, skippedWindows };
}

/**
 * @typedef {Object} GiftSpec
 * @property {string} [speciesId]    form id (`species` is accepted too, as script ops spell it)
 * @property {string} [species]
 * @property {number} level
 * @property {string|null} [nickname] (`nick` is accepted too)
 * @property {string|null} [nick]
 * @property {string|null} [heldItem]
 * @property {string[]} [moves]
 */

/**
 * Builds a brand-new creature from a spec and adds it (gifts, starters, script `addCreature`):
 * allocates its uid with {@link nextUid}, draws its Heartmark placement (and an Unfixed loop) from
 * `rng` forked by that uid, then {@link addCreature} with `caught: true` unless `opts.caught` is
 * false. A refused add (`full`) leaves a gap in the uid counter, nothing else.
 * @param {World} world
 * @param {GiftSpec} spec
 * @param {any} data
 * @param {Rng|null} [rng]
 * @param {PartyOpts & AddOpts} [opts]
 * @returns {ReturnType<typeof addCreature>}
 * @throws {TypeError} for a malformed spec; {RangeError} for unknown content ids
 */
export function giveCreature(world, spec, data, rng = null, opts = {}) {
  if (!spec || typeof spec !== 'object') throw new TypeError('party.giveCreature: spec must be an object');
  const speciesId = spec.speciesId ?? spec.species;
  if (typeof speciesId !== 'string' || !speciesId) throw new TypeError('party.giveCreature: spec needs a species id');
  if (!Number.isFinite(spec.level)) throw new TypeError('party.giveCreature: spec needs a finite level');
  const name = spec.nickname ?? spec.nick ?? undefined;
  const c = creature.makeCreature({
    uid: nextUid(world),
    speciesId,
    level: spec.level,
    nickname: typeof name === 'string' ? name : undefined,
    heldItem: spec.heldItem ?? null,
    moves: spec.moves,
    rng,
    tuning: opts.tuning,
  }, data);
  return addCreature(world, c, data, { ...opts, caught: opts.caught !== false });
}

// ---------------------------------------------------------------------------------------------
// Arranging
// ---------------------------------------------------------------------------------------------

/**
 * Swaps two party slots (same index is a no-op success).
 * @param {World} world
 * @param {number} i
 * @param {number} j
 * @param {PartyOpts} [opts]
 * @returns {{ok: true}|{ok: false, reason: 'bad-index'}}
 */
export function swap(world, i, j, opts = {}) {
  const n = world.party.length;
  if (!Number.isInteger(i) || !Number.isInteger(j) || i < 0 || j < 0 || i >= n || j >= n) return { ok: false, reason: 'bad-index' };
  if (i === j) return { ok: true };
  const a = world.party[i];
  world.party[i] = world.party[j];
  world.party[j] = a;
  emit(opts, 'party:changed', { reason: 'swap', from: i, to: j });
  return { ok: true };
}

/**
 * Moves a party creature to the box. Refuses the last party member, and refuses when the party
 * would be left with no conscious creature although it has one now. A creature with an open window drops out of
 * `pendingShifts` while stored when HOLD_WINDOWS_IN_BOX (it keeps the window).
 * @param {World} world
 * @param {string} uid
 * @param {any} [data]
 * @param {PartyOpts} [opts]
 * @returns {{ok: true, index: number}|{ok: false, reason: 'not-in-party'|'last'|'last-alive'|'box-full'}}
 */
export function toBox(world, uid, data, opts = {}) {
  const t = tuningOf(opts.tuning);
  const i = world.party.findIndex((c) => c.uid === uid);
  if (i < 0) return { ok: false, reason: 'not-in-party' };
  if (world.party.length <= 1) return { ok: false, reason: 'last' };
  const aliveNow = world.party.some((c) => c.hp > 0);
  const aliveAfter = world.party.some((c, k) => k !== i && c.hp > 0);
  if (aliveNow && !aliveAfter) return { ok: false, reason: 'last-alive' };
  if (world.box.length >= t.BOX_CAPACITY) return { ok: false, reason: 'box-full' };
  const [c] = world.party.splice(i, 1);
  world.box.push(c);
  exp.refreshPending(world, uid, data, opts);
  emit(opts, 'party:changed', { reason: 'toBox', uid });
  return { ok: true, index: world.box.length - 1 };
}

/**
 * Moves a box creature into the party (it leaves the Training Yard). A window it held while
 * stored becomes pending again.
 * @param {World} world
 * @param {string} uid
 * @param {any} [data]
 * @param {PartyOpts} [opts]
 * @returns {{ok: true, index: number, pending: boolean}|{ok: false, reason: 'not-in-box'|'party-full'}}
 */
export function fromBox(world, uid, data, opts = {}) {
  const t = tuningOf(opts.tuning);
  const i = world.box.findIndex((c) => c.uid === uid);
  if (i < 0) return { ok: false, reason: 'not-in-box' };
  if (world.party.length >= t.PARTY_MAX) return { ok: false, reason: 'party-full' };
  const [c] = world.box.splice(i, 1);
  world.party.push(c);
  const y = world.yard.indexOf(uid);
  if (y >= 0) world.yard.splice(y, 1);
  const { pending } = exp.refreshPending(world, uid, data, opts);
  emit(opts, 'party:changed', { reason: 'fromBox', uid });
  return { ok: true, index: world.party.length - 1, pending };
}

/**
 * Releases a creature for good (box UI, behind a confirm). Refuses the last party member. Also
 * removes it from the Yard and `pendingShifts`, and clears its auto-anchor preset through
 * `systems/settings.setAutoAnchor` (the owner of `world.settings`).
 * @param {World} world
 * @param {string} uid
 * @param {any} [data]
 * @param {PartyOpts} [opts]
 * @returns {{ok: true, creature: Creature}|{ok: false, reason: 'unknown'|'last'}}
 */
export function release(world, uid, data, opts = {}) {
  const f = findCreature(world, uid);
  if (!f) return { ok: false, reason: 'unknown' };
  if (f.where === 'party' && world.party.length <= 1) return { ok: false, reason: 'last' };
  const [c] = (f.where === 'party' ? world.party : world.box).splice(f.index, 1);
  const y = world.yard.indexOf(uid);
  if (y >= 0) world.yard.splice(y, 1);
  exp.refreshPending(world, uid, data, opts);
  const presets = world.settings && world.settings.autoAnchor;
  if (presets && Object.prototype.hasOwnProperty.call(presets, uid)) setAutoAnchor(world, uid, null, { bus: opts.bus ?? null });
  emit(opts, 'party:changed', { reason: 'release', uid });
  return { ok: true, creature: c };
}

/**
 * Lists a stored creature in the Training Yard (at most YARD_CAP, from systems/exp tuning).
 * @param {World} world
 * @param {string} uid
 * @param {PartyOpts} [opts]
 * @returns {{ok: true}|{ok: false, reason: 'not-in-box'|'already'|'yard-full'}}
 */
export function toYard(world, uid, opts = {}) {
  const cap = exp.tuningOf(opts.tuning).YARD_CAP;
  if (!world.box.some((c) => c.uid === uid)) return { ok: false, reason: 'not-in-box' };
  if (world.yard.includes(uid)) return { ok: false, reason: 'already' };
  if (world.yard.length >= cap) return { ok: false, reason: 'yard-full' };
  world.yard.push(uid);
  emit(opts, 'party:changed', { reason: 'toYard', uid });
  return { ok: true };
}

/**
 * Takes a creature off the Training Yard list.
 * @param {World} world
 * @param {string} uid
 * @param {PartyOpts} [opts]
 * @returns {{ok: boolean}}
 */
export function fromYard(world, uid, opts = {}) {
  const i = world.yard.indexOf(uid);
  if (i < 0) return { ok: false };
  world.yard.splice(i, 1);
  emit(opts, 'party:changed', { reason: 'fromYard', uid });
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Care
// ---------------------------------------------------------------------------------------------

/**
 * Full heal (HP, PP, status, Mends) of the whole party, or of the listed uids (party or box).
 * @param {World} world
 * @param {PartyOpts & {uids?: string[]}} [opts]
 * @returns {{healed: string[]}}
 */
export function heal(world, opts = {}) {
  const list = Array.isArray(opts.uids)
    ? [...new Set(opts.uids)].map((u) => findCreature(world, u)?.c).filter(Boolean)
    : world.party;
  const healed = [];
  for (const c of /** @type {Creature[]} */ (list)) {
    creature.healFull(c, opts);
    healed.push(c.uid);
  }
  if (healed.length) emit(opts, 'party:changed', { reason: 'heal', uids: healed });
  return { healed };
}

/**
 * Renames a creature. The name is trimmed, control characters removed and inner whitespace
 * collapsed; empty or longer than NICKNAME_MAX characters is refused.
 * @param {World} world
 * @param {string} uid
 * @param {string} name
 * @param {PartyOpts} [opts]
 * @returns {{ok: true, nickname: string}|{ok: false, reason: 'unknown'|'empty'|'too-long'}}
 */
export function nickname(world, uid, name, opts = {}) {
  const t = tuningOf(opts.tuning);
  const f = findCreature(world, uid);
  if (!f) return { ok: false, reason: 'unknown' };
  const clean = String(name ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim();
  if (!clean) return { ok: false, reason: 'empty' };
  if ([...clean].length > t.NICKNAME_MAX) return { ok: false, reason: 'too-long' };
  f.c.nickname = clean;
  emit(opts, 'party:changed', { reason: 'nickname', uid });
  return { ok: true, nickname: clean };
}

/**
 * Pins the Heartmark technique of a creature (rules §5.2; normally at its first Shift).
 * @param {World} world
 * @param {string} uid
 * @param {string} moveId
 * @param {any} data
 * @param {PartyOpts & {force?: boolean}} [opts]
 * @returns {{ok: true}|{ok: false, reason: 'unknown'|'not-known'|'already-pinned'}}
 */
export function pinHeartmark(world, uid, moveId, data, opts = {}) {
  const f = findCreature(world, uid);
  if (!f) return { ok: false, reason: 'unknown' };
  const r = creature.pinHeartmarkTechnique(f.c, moveId, data, { force: opts.force });
  if (r.ok) emit(opts, 'party:changed', { reason: 'heartmark', uid, move: moveId });
  return r;
}

/**
 * Gives (or takes, with null) a creature's held item and brings `pendingShifts` in line: a Still
 * Knot (an item row with `blocksShifts: true`) hides an open window while held; it comes back when
 * the Knot comes off. Windows *reached* while the Knot is held follow exp STILL_KNOT_MODE. Bag
 * bookkeeping (taking the item out of / back into the bag) is the caller's, through systems/bag.
 * @param {World} world
 * @param {string} uid
 * @param {string|null} itemId
 * @param {any} data
 * @param {PartyOpts} [opts]
 * @returns {{ok: true, prev: string|null, stillKnot: boolean, pending: boolean}|{ok: false, reason: 'unknown'}}
 * @throws {TypeError} for an item id that is not a string or null
 */
export function setHeldItem(world, uid, itemId, data, opts = {}) {
  const f = findCreature(world, uid);
  if (!f) return { ok: false, reason: 'unknown' };
  const { prev } = creature.setHeldItem(f.c, itemId, data);
  const { pending } = exp.refreshPending(world, uid, data, opts);
  emit(opts, 'party:changed', { reason: 'held', uid, item: f.c.heldItem });
  return { ok: true, prev, stillKnot: f.c.stillKnot, pending };
}

/**
 * Reconciles `world.pendingShifts` with every creature (after a load, a migration or a tuning
 * change): each party creature with an open window is listed once, everything else is dropped.
 * @param {World} world
 * @param {any} [data]
 * @param {PartyOpts} [opts]
 * @returns {{pending: string[], changed: boolean}}
 */
export function syncPending(world, data, opts = {}) {
  let changed = false;
  for (const uid of [...world.pendingShifts]) {
    if (!findCreature(world, uid)) changed = exp.refreshPending(world, uid, data, opts).changed || changed;
  }
  for (const c of [...world.party, ...world.box]) changed = exp.refreshPending(world, c.uid, data, opts).changed || changed;
  return { pending: world.pendingShifts.slice(), changed };
}

// ---------------------------------------------------------------------------------------------
// EXP
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} LevelUp
 * @property {string} uid  @property {number} from  @property {number} to
 * @property {string[]} newMoves   learned into free slots
 * @property {string[]} offers     waiting for a slot (learn-move prompt)
 */

/**
 * Gives EXP to one creature outside battle (scripts, rewards): levels, moves, window detection,
 * events. EXP is applied as given (no split).
 * @param {World} world
 * @param {string} uid
 * @param {number} amount
 * @param {any} data
 * @param {PartyOpts} [opts]
 * @returns {{ok: true, levelUp: LevelUp|null, windowsOpened: number[]}|{ok: false, reason: 'unknown'}}
 */
export function giveExp(world, uid, amount, data, opts = {}) {
  const f = findCreature(world, uid);
  if (!f) return { ok: false, reason: 'unknown' };
  const { levelUp, opened } = applyExpTo(world, f.c, amount, data, opts);
  if (levelUp) emit(opts, 'party:changed', { reason: 'exp', uid });
  return { ok: true, levelUp, windowsOpened: opened };
}

/**
 * @param {World} world
 * @param {Creature} c
 * @param {number} amount
 * @param {any} data
 * @param {PartyOpts} opts
 * @returns {{levelUp: LevelUp|null, opened: number[]}}
 */
function applyExpTo(world, c, amount, data, opts) {
  const r = creature.gainExp(c, amount, data, opts);
  /** @type {LevelUp|null} */
  let levelUp = null;
  if (r.to > r.from) {
    levelUp = { uid: c.uid, from: r.from, to: r.to, newMoves: r.learned, offers: r.offers };
    emit(opts, 'creature:levelUp', { uid: c.uid, from: r.from, to: r.to });
    for (const move of r.learned) emit(opts, 'creature:learned', { uid: c.uid, move });
  }
  const { opened } = exp.detectWindows(world, c.uid, r.from, data, opts);
  return { levelUp, opened };
}

// ---------------------------------------------------------------------------------------------
// Battle outcome
// ---------------------------------------------------------------------------------------------

/**
 * What `battleFlow` hands over after a battle: the engine's `result()` plus the facts the EXP split
 * needs. When `defeated` is present the split is computed here by `exp.computeAward`
 * (authoritative, §5.5); otherwise the engine's per-uid `exp` amounts are applied as given.
 * @typedef {Object} BattleOutcome
 * @property {Creature[]} [party]                 side-0 engine copies after the battle (matched by uid)
 * @property {Array<{uid: string, amount: number}>} [exp]   engine-computed EXP (fallback)
 * @property {Array<{speciesId?: string, level: number, expYield?: number}>} [defeated]   foes KO'd or caught
 * @property {string[]} [participants]            uids that battled
 * @property {'wild'|'trainer'|string} [kind]
 * @property {string} [source]                    'route' | 'story' | 'spire' | 'rematch' | 'duel'
 * @property {number|null} [curveLevel]
 * @property {Creature|null} [caught]
 * @property {string[]} [seen]                    forms met (Field Log Seen)
 * @property {string[]} [read]                    forms Read (Field Log Read)
 */

/**
 * @typedef {Object} OutcomeApplied
 * @property {LevelUp[]} levelUps
 * @property {string[]} windowsOpened                         uids with a newly opened window, in order
 * @property {Array<{uid: string, level: number}>} windows    every newly opened window
 * @property {{uid: string, where: 'party'|'box'}|null} caught
 * @property {'full'|null} caughtLost                         the catch did not fit anywhere
 * @property {Array<{uid: string, amount: number}>} awards    EXP applied per uid
 */

/**
 * Writes a battle's outcome into the world (ARCHITECTURE §5.5): EXP split (fainted = 0 HP on the
 * engine copy at the end) and applied (levels, moves, window detection into `pendingShifts`; level
 * and EXP are never copied from the engine copies), then HP / PP / status back by uid (clamped;
 * HP as the copy's ratio when the copy's max HP differs; statuses outside the schema's kinds
 * dropped), the catch added via {@link addCreature}, and Field Log
 * marks through `opts.markFieldLog(world, 'seen'|'read'|'held', formId)` (systems/fieldLog owns
 * that state). Emits `creature:levelUp`, `creature:learned`, `shift:window` and one
 * `party:changed {reason: 'battle'}`.
 * @param {World} world
 * @param {BattleOutcome} battleResult
 * @param {any} data
 * @param {Rng|null} [rng]   only used to draw a Heartmark placement for a caught creature whose record lacks one
 * @param {PartyOpts & {markFieldLog?: (world: World, state: 'seen'|'read'|'held', formId: string) => void, day?: number, mapId?: string}} [opts]
 * @returns {OutcomeApplied}
 * @throws {TypeError} for a non-object result or malformed EXP facts; {RangeError} for a catch with unknown content (both before any write)
 */
export function applyOutcome(world, battleResult, data, rng = null, opts = {}) {
  if (!battleResult || typeof battleResult !== 'object') throw new TypeError('party.applyOutcome: battleResult must be an object');
  const r = battleResult;
  // a catch with unknown content fails here, before anything in the world has changed
  if (r.caught && typeof r.caught === 'object') creature.deserialize({ ...creature.serialize(r.caught), uid: 'probe' }, data, opts);

  // engine copies of party creatures, by uid (first copy wins)
  /** @type {Map<string, any>} */
  const copies = new Map();
  for (const copy of Array.isArray(r.party) ? r.party : []) {
    if (!copy || typeof copy.uid !== 'string' || copies.has(copy.uid)) continue;
    if (world.party.some((x) => x.uid === copy.uid)) copies.set(copy.uid, copy);
  }
  /** fainted at the end of the battle (the engine copy's HP when there is one) */
  const faintedAfter = (/** @type {Creature} */ c) => {
    const cp = copies.get(c.uid);
    return cp && Number.isFinite(cp.hp) ? cp.hp <= 0 : c.hp <= 0;
  };

  // 1. EXP split
  /** @type {Array<{uid: string, amount: number}>} */
  let awards;
  if (Array.isArray(r.defeated)) {
    const participants = new Set(Array.isArray(r.participants) ? r.participants : []);
    const yard = world.yard.map((u) => world.box.find((c) => c.uid === u)).filter(Boolean)
      .map((c) => ({ uid: /** @type {Creature} */ (c).uid, level: /** @type {Creature} */ (c).level }));
    awards = exp.computeAward({
      kind: r.kind ?? 'wild',
      source: r.source,
      curveLevel: r.curveLevel ?? null,
      defeated: r.defeated,
      party: world.party.map((c) => ({ uid: c.uid, level: c.level, fainted: faintedAfter(c), participated: participants.has(c.uid), ability: c.ability })),
      yard,
    }, data, opts).totals;
  } else {
    /** @type {Map<string, number>} */
    const sum = new Map();
    for (const e of Array.isArray(r.exp) ? r.exp : []) {
      if (e && typeof e.uid === 'string' && Number.isFinite(e.amount) && e.amount > 0) sum.set(e.uid, (sum.get(e.uid) || 0) + Math.floor(e.amount));
    }
    awards = [...sum].map(([uid, amount]) => ({ uid, amount }));
  }

  // 2. apply EXP (levels come only from here, never from the engine copies)
  /** @type {LevelUp[]} */
  const levelUps = [];
  /** @type {Array<{uid: string, level: number}>} */
  const windows = [];
  const applied = [];
  for (const { uid, amount } of awards) {
    const f = findCreature(world, uid);
    if (!f) continue;
    const { levelUp, opened } = applyExpTo(world, f.c, amount, data, opts);
    applied.push({ uid, amount });
    if (levelUp) levelUps.push(levelUp);
    for (const level of opened) windows.push({ uid, level });
  }

  // 3. HP / PP / status back by uid. After the EXP so the PP of a move learned on a level-up is
  // copied too, and HP keeps the copy's ratio when the engine levelled its copy (its max HP then
  // differs from the record's before the EXP is applied here).
  for (const [uid, copy] of copies) {
    const c = world.party.find((x) => x.uid === uid);
    if (!c) continue;
    if (Number.isFinite(copy.hp)) {
      const copyMax = copy.stats && Number.isFinite(copy.stats.hp) && copy.stats.hp > 0 ? copy.stats.hp : null;
      let hp;
      if (copy.hp <= 0) hp = 0;
      else if (copyMax !== null && copyMax !== c.stats.hp) hp = Math.max(1, Math.round((Math.min(copy.hp, copyMax) / copyMax) * c.stats.hp));
      else hp = Math.floor(copy.hp);
      c.hp = Math.max(0, Math.min(c.stats.hp, hp));
    }
    for (const m of c.moves) {
      const cm = Array.isArray(copy.moves) ? copy.moves.find((x) => x && x.id === m.id) : null;
      if (cm && Number.isFinite(cm.pp)) m.pp = Math.max(0, Math.min(m.maxPp, Math.floor(cm.pp)));
    }
    c.status = copy.status && STATUS_KINDS.includes(copy.status.kind)
      ? { kind: copy.status.kind, turns: Math.max(0, Math.floor(Number(copy.status.turns) || 0)) }
      : null;
  }

  // 4. the catch
  /** @type {OutcomeApplied['caught']} */
  let caught = null;
  /** @type {'full'|null} */
  let caughtLost = null;
  if (r.caught && typeof r.caught === 'object') {
    const rec = creature.serialize(r.caught);
    if (!rec.uid || findCreature(world, rec.uid)) rec.uid = nextUid(world);
    const m = r.caught.mark;
    if (!(m && Number.isInteger(m.x) && Number.isInteger(m.y)) && rng) {
      rec.mark = creature.drawMark(creature.creatureStream(rng, 'mark', rec.uid), opts);
    }
    const res = addCreature(world, rec, data, { ...opts, caught: true });
    if (res.ok) caught = { uid: res.uid, where: res.where };
    else caughtLost = 'full';
  }

  // 5. Field Log
  if (typeof opts.markFieldLog === 'function') {
    const seen = [];
    const add = (list, id) => { if (typeof id === 'string' && id && !list.includes(id)) list.push(id); };
    for (const id of Array.isArray(r.seen) ? r.seen : []) add(seen, id);
    for (const d of Array.isArray(r.defeated) ? r.defeated : []) add(seen, d && d.speciesId);
    if (r.caught) add(seen, r.caught.speciesId);
    const read = [];
    for (const id of Array.isArray(r.read) ? r.read : []) add(read, id);
    for (const id of seen) opts.markFieldLog(world, 'seen', id);
    for (const id of read) opts.markFieldLog(world, 'read', id);
    if (caught && r.caught) opts.markFieldLog(world, 'held', r.caught.speciesId);
  }

  emit(opts, 'party:changed', { reason: 'battle' });
  const windowsOpened = [...new Set(windows.map((w) => w.uid))];
  return { levelUps, windowsOpened, windows, caught, caughtLost, awards: applied };
}
