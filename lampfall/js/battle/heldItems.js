/**
 * Held-item behaviour, by data key. [BATTLE-RULES]
 *
 * Item rows are data (`data/items.js`); what a held item does is the `held` object on its row.
 * {@link getHeldRuntime} turns that object into the frozen runtime the engine calls at five hook
 * points: `onSwitchIn`, `onDamageTaken`, `onTurnEnd`, `onHitCheck`, `onStatCalc` (plus the
 * attack, crit, chip, payout and bench-EXP readings below). Keys describe behaviour, never
 * content, so every item that behaves alike shares a key.
 *
 * {@link HELD_KEYS} (the data validator rejects any other key in a `held` object):
 * - `critStages: n`                  +n crit stages on the holder's moves
 * - `endureFromFull: true`           a hit from full HP leaves it at 1 HP (`perBattle` times a battle)
 * - `perBattle: n`                   uses per battle of a triggered effect (default: unlimited, or
 *                                    once for a `consumable` item, which is then used up)
 * - `chipMult: x`                    burn, poison and trap chip on the holder times x
 * - `startStages: {stat: n}`         stat stages it carries onto the field each time it enters
 * - `payoutMult: x`                  trainer payout times x when the holder battled (player side)
 * - `benchShare: x`                  its share of EXP from the bench (instead of tuning.benchShare)
 * - `healAt: {below, fraction}`      when a hit or chip leaves it under `below` of max HP, heals
 *                                    `fraction` of max HP (spends a Mend like any heal)
 * - `cures: [kind]`                  clears one of these conditions at the end of a turn
 * - `typeBoost: {types: [T], mult}`  its moves of those types deal `mult` damage
 * - `accuracyMult: x`                its moves' hit chance times x (sure hits stay sure)
 * - `statMult: {stat: x}`            its effective stat times x
 * - `consumable: true`               used up the first time its effect fires: marked on the
 *                                    creature and reported in `result().consumedItems`
 * - `blocksShift: true`              Still Knot: matters only outside battle (inert here)
 * - `forecastTypeMult: x`, `type: T` type tilts: weigh Forecast cards (inert here)
 *
 * Bag items (Crackdust, medicine) have no `held` object and do nothing when held.
 * Pure: hook functions read their context and return a decision; the engine applies it.
 * @module battle/heldItems
 */

/** Every key a held object may carry. */
export const HELD_KEYS = Object.freeze([
  'critStages', 'endureFromFull', 'perBattle', 'chipMult', 'startStages', 'payoutMult', 'benchShare',
  'healAt', 'cures', 'typeBoost', 'accuracyMult', 'statMult', 'consumable', 'blocksShift', 'forecastTypeMult', 'type',
]);

/** Keys that only matter outside battle (the engine reads nothing from them). */
export const OUT_OF_BATTLE_KEYS = Object.freeze(['blocksShift', 'forecastTypeMult', 'type']);

const STATS = Object.freeze(['atk', 'def', 'spa', 'spd', 'spe', 'eva']);
const MAJOR = Object.freeze(['burn', 'poison', 'chill', 'numb']);

/**
 * @typedef {Object} HeldHooks
 * @property {(ctx: {self: any}) => {stages: Record<string, number>, text: string}|null} onSwitchIn
 * @property {(ctx: {phase: 'before'|'after', self: any, amount: number, source: string, uses: number, mends: number}) =>
 *   {amount?: number, heal?: number, text: string}|null} onDamageTaken   'before' may lower the amount (endure);
 *   'after' may heal (healAt)
 * @property {(ctx: {self: any, uses: number, mends: number}) => {cure?: string, heal?: number, text: string}|null} onTurnEnd
 * @property {(ctx: {self: any, move: any}) => number} onHitCheck          hit-chance multiplier
 * @property {(ctx: {self: any, stat: string}) => number} onStatCalc       stat multiplier
 * @property {(ctx: {self: any, move: any, moveType: string|null}) => number} onAttackMult   outgoing damage multiplier
 * @property {() => number} critStages
 * @property {(kind: string) => number} chipMult                         status-chip multiplier
 */

/**
 * The runtime the engine reads.
 * @typedef {Object} HeldRuntime
 * @property {string} id  @property {string} name
 * @property {Readonly<Record<string, any>>} held      the row's `held` object
 * @property {boolean} consumable
 * @property {number} perBattle                         Infinity when unlimited
 * @property {boolean} inert                            nothing in battle reads it
 * @property {number} payoutMult  @property {number|null} benchShare
 * @property {Readonly<HeldHooks>} hooks
 */

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isFrac = (v) => isNum(v) && v > 0 && v <= 1;

/**
 * Problems of one item row's `held` object; empty = valid (no `held` object is valid: a bag item).
 * @param {any} row an item row
 * @param {{has: (t: string) => boolean}|null} [types] type names, to check `typeBoost.types` / `type`
 * @returns {string[]}
 */
export function heldProblems(row, types = null) {
  const id = row && typeof row.id === 'string' ? row.id : '?';
  const h = row && row.held;
  if (h == null) return [];
  if (typeof h !== 'object' || Array.isArray(h)) return [`item ${id}: held must be an object`];
  const out = [];
  const bad = (k, want) => out.push(`item ${id}: held.${k} must be ${want}`);
  for (const k of Object.keys(h)) if (!HELD_KEYS.includes(k)) out.push(`item ${id}: unknown held key "${k}"`);
  if (h.critStages !== undefined && !(Number.isInteger(h.critStages) && h.critStages > 0)) bad('critStages', 'a positive integer');
  for (const k of ['endureFromFull', 'consumable', 'blocksShift']) if (h[k] !== undefined && typeof h[k] !== 'boolean') bad(k, 'a boolean');
  if (h.perBattle !== undefined && !(Number.isInteger(h.perBattle) && h.perBattle > 0)) bad('perBattle', 'a positive integer');
  for (const k of ['chipMult', 'accuracyMult']) if (h[k] !== undefined && !(isNum(h[k]) && h[k] >= 0 && h[k] <= 4)) bad(k, 'a multiplier 0..4');
  if (h.payoutMult !== undefined && !(isNum(h.payoutMult) && h.payoutMult >= 1 && h.payoutMult <= 4)) bad('payoutMult', 'a multiplier 1..4');
  if (h.benchShare !== undefined && !(isNum(h.benchShare) && h.benchShare >= 0 && h.benchShare <= 1)) bad('benchShare', 'a share 0..1');
  if (h.forecastTypeMult !== undefined && !(isNum(h.forecastTypeMult) && h.forecastTypeMult > 0)) bad('forecastTypeMult', 'a positive number');
  if (h.type !== undefined && (typeof h.type !== 'string' || (types && !types.has(h.type)))) bad('type', 'a known type name');
  if (h.startStages !== undefined) {
    if (!h.startStages || typeof h.startStages !== 'object') bad('startStages', '{stat: stages}');
    else for (const [s, n] of Object.entries(h.startStages)) if (!STATS.includes(s) || !Number.isInteger(n) || n === 0) bad(`startStages.${s}`, 'a non-zero integer on atk/def/spa/spd/spe/eva');
  }
  if (h.statMult !== undefined) {
    if (!h.statMult || typeof h.statMult !== 'object') bad('statMult', '{stat: mult}');
    else for (const [s, m] of Object.entries(h.statMult)) if (!STATS.slice(0, 5).includes(s) || !(isNum(m) && m > 0 && m <= 4)) bad(`statMult.${s}`, 'a multiplier on atk/def/spa/spd/spe');
  }
  if (h.healAt !== undefined && !(h.healAt && isFrac(h.healAt.below) && isFrac(h.healAt.fraction))) bad('healAt', '{below: 0..1, fraction: 0..1}');
  if (h.cures !== undefined && !(Array.isArray(h.cures) && h.cures.length && h.cures.every((k) => MAJOR.includes(k)))) bad('cures', `a list of ${MAJOR.join('/')}`);
  if (h.typeBoost !== undefined) {
    const tb = h.typeBoost;
    if (!(tb && Array.isArray(tb.types) && tb.types.length && isNum(tb.mult) && tb.mult > 0 && tb.mult <= 4)) bad('typeBoost', '{types: [Type], mult}');
    else if (types) for (const t of tb.types) if (!types.has(t)) bad('typeBoost.types', `known types (got ${String(t)})`);
  }
  return out;
}

const ONE = () => 1;
const NONE = () => null;

/**
 * Builds the runtime for an item row (null for a row without a `held` object: a bag item).
 * @param {any} row
 * @returns {Readonly<HeldRuntime>|null}
 * @throws {TypeError} for a malformed `held` object
 */
export function getHeldRuntime(row) {
  if (!row || typeof row !== 'object' || typeof row.id !== 'string') throw new TypeError('getHeldRuntime: an item row with an id is required');
  if (row.held == null) return null;
  const problems = heldProblems(row);
  if (problems.length) throw new TypeError(problems.join('; '));
  const h = row.held;
  const name = typeof row.name === 'string' ? row.name : row.id;
  const consumable = h.consumable === true;
  const perBattle = h.perBattle ?? (consumable ? 1 : Infinity);
  const battleKeys = Object.keys(h).filter((k) => !OUT_OF_BATTLE_KEYS.includes(k) && k !== 'perBattle' && k !== 'consumable');
  /** @type {HeldHooks} */
  const hooks = {
    onSwitchIn: h.startStages
      ? ({ self }) => ({ stages: { ...h.startStages }, text: `${self.nickname} settles in with its ${name}.` })
      : NONE,
    onDamageTaken: (ctx) => {
      if (ctx.uses >= perBattle) return null;
      const max = ctx.self.stats.hp;
      if (ctx.phase === 'before') {
        if (h.endureFromFull && ctx.source === 'party' && ctx.self.hp >= max && ctx.amount >= ctx.self.hp && max > 1) {
          return { amount: ctx.self.hp - 1, text: `${ctx.self.nickname} bobs up at 1 HP on its ${name}.` };
        }
        return null;
      }
      if (h.healAt && ctx.self.hp > 0 && ctx.self.hp < max * h.healAt.below && ctx.mends > 0) {
        return { heal: h.healAt.fraction, text: `${ctx.self.nickname}'s ${name} kicks in.` };
      }
      return null;
    },
    onTurnEnd: (ctx) => {
      if (ctx.uses >= perBattle || ctx.self.hp <= 0) return null;
      if (h.cures && ctx.self.status && h.cures.includes(ctx.self.status.kind)) return { cure: ctx.self.status.kind, text: `${ctx.self.nickname}'s ${name} clears it up.` };
      if (h.healAt && ctx.self.hp < ctx.self.stats.hp * h.healAt.below && ctx.mends > 0) return { heal: h.healAt.fraction, text: `${ctx.self.nickname}'s ${name} kicks in.` };
      return null;
    },
    onHitCheck: h.accuracyMult !== undefined ? () => h.accuracyMult : ONE,
    onStatCalc: h.statMult ? ({ stat }) => h.statMult[stat] ?? 1 : ONE,
    onAttackMult: h.typeBoost ? ({ moveType }) => (moveType != null && h.typeBoost.types.includes(moveType) ? h.typeBoost.mult : 1) : ONE,
    critStages: () => h.critStages ?? 0,
    chipMult: () => h.chipMult ?? 1,
  };
  return Object.freeze({
    id: row.id,
    name,
    held: Object.freeze({ ...h }),
    consumable,
    perBattle,
    inert: battleKeys.length === 0,
    payoutMult: h.payoutMult ?? 1,
    benchShare: h.benchShare ?? null,
    hooks: Object.freeze(hooks),
  });
}
