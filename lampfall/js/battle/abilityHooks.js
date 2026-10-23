/**
 * Ability behaviour, by hook key. [BATTLE-RULES]
 *
 * Ability rows are pure data (`data/abilities.js`): `{id, name, text, ward?, hook, hookParams?,
 * expShare?, glint?}`. `hook` names one entry of {@link HOOKS}; `hookParams` tunes it per row
 * (falling back to {@link DEFAULTS}). {@link getAbilityRuntime} merges the row with the hook into
 * the frozen object the engine calls. Hook keys describe behaviour, never content, so one key
 * serves every ability that behaves alike (two "+20% to one type" abilities share
 * `type-power-boost` with different params).
 *
 * Hook functions are pure: they read their context and return a value (a multiplier, a boolean,
 * `{mult, text}`); the engine applies it. The only state they touch is `bflags`, the
 * per-creature, per-battle scratch object the engine owns (so "first hit each battle" survives a
 * switch). Hooks that act on the battle (`onSwitchIn`, `onTurnEnd`) call the engine's documented
 * hook API: `battle.autoRead(side, source)`, `battle.revealFoeMove(side, n, source)`,
 * `battle.cycleUnfixed(side)`.
 *
 * Pure: no DOM, no randomness.
 * @module battle/abilityHooks
 */

import { mergeTuning } from './effects.js';

/**
 * Hook functions the engine looks for on an ability runtime. All optional.
 * @typedef {Object} AbilityHookFns
 * @property {(ctx: {battle: any, side: number, self: any, foe: any}) => void} [onSwitchIn]
 * @property {(ctx: {attacker: any, move: any, hpRatio: number, moveType: string|null}) => number} [onAttackMult] outgoing damage multiplier
 * @property {(ctx: {defender: any, attacker: any, move: any, eff: {mult: number, word: string}, bflags: Record<string, any>}) => {mult: number, text?: string}} [onDefendMult] incoming damage multiplier
 * @property {() => number} [critStages] extra crit stages
 * @property {(ctx: {attacker: any, move: any, bflags: Record<string, any>}) => boolean} [sureHitOverride] true = this move cannot miss
 * @property {(kind: string) => boolean} [statusImmune]
 * @property {() => boolean} [blocksForeignStatDrops]
 * @property {(ctx: {battle: any, side: number, self: any}) => void} [onTurnEnd]
 * @property {() => number} [healOnKo] fraction of max HP healed after knocking out a foe
 */

/**
 * The merged object the engine reads.
 * @typedef {Object} AbilityRuntime
 * @property {string} id  @property {string} name  @property {string} text
 * @property {{kind: 'strong-only'|'no-status'|'min-power', minPower?: number}|null} ward
 * @property {string|null} hook
 * @property {Readonly<Record<string, any>>} params   resolved hook params
 * @property {Readonly<AbilityHookFns>} hooks
 * @property {{toLowest: number}|null} expShare        Big-Sibling-style EXP hand-down
 * @property {boolean} glint                           announce a coming crit at the start of the turn
 * @property {boolean} decoys                          evasion stages show as decoys a miss pops
 * @property {boolean} blocksSelfKo                    no self-KO move works while it is on the field
 * @property {boolean} unfixed                         the holder's type cycles through its type loop
 */

/**
 * Default hook params (designer-tunable; a row's `hookParams` override them).
 * @type {Readonly<{
 *   softenMult: number, lowHpThreshold: number, lowHpBoost: number, typeBoostMult: number, critBoostStages: number,
 *   revealCount: number, categoryReductionMult: number, healOnKoFraction: number, expShareToLowest: number,
 * }>}
 */
export const DEFAULTS = Object.freeze({
  /** First-hit softeners (first contact hit / first non-Strong hit): damage multiplier. */
  softenMult: 0.5,
  /** Low-HP type boost: HP ratio under which it applies, and the multiplier. */
  lowHpThreshold: 0.25,
  lowHpBoost: 1.3,
  /** Plain type power boost multiplier. */
  typeBoostMult: 1.2,
  /** Extra crit stages of a crit-boost ability. */
  critBoostStages: 2,
  /** Foe moves revealed on switch-in. */
  revealCount: 1,
  /** Damage multiplier of a category damage reduction (e.g. physical hits). */
  categoryReductionMult: 0.75,
  /** Fraction of max HP healed after a knock-out. */
  healOnKoFraction: 1 / 8,
  /** Share of the holder's EXP handed to the lowest-level party member. */
  expShareToLowest: 0.3,
});

const FLAGS_NONE = Object.freeze({});

/**
 * @typedef {Object} HookDef
 * @property {string} describe                                   one line for tools and docs
 * @property {(t: typeof DEFAULTS) => Record<string, any>} [params]   default params (from tuning)
 * @property {(p: Record<string, any>, row: {id: string, name: string}) => AbilityHookFns} [hooks]
 * @property {(p: Record<string, any>) => Partial<Pick<AbilityRuntime, 'expShare'|'glint'|'decoys'|'blocksSelfKo'|'unfixed'>>} [flags]
 */

/** @param {string[]|string|undefined} v @returns {string[]} */
const list = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/**
 * Behaviour by hook key. Each entry declares its params (defaults from tuning), the hook
 * functions it builds and any engine flags it sets.
 * @type {Readonly<Record<string, Readonly<HookDef>>>}
 */
export const HOOKS = Object.freeze({
  'auto-read': Object.freeze({
    describe: 'On switch-in it Reads the foe for free (uses the one Read per foe).',
    hooks: (p, row) => ({ onSwitchIn: ({ battle, side }) => battle.autoRead(side, row.name) }),
  }),
  'reveal-moves-on-entry': Object.freeze({
    describe: 'On switch-in it reveals `count` unrevealed foe moves.',
    params: (t) => ({ count: t.revealCount }),
    hooks: (p, row) => ({ onSwitchIn: ({ battle, side }) => battle.revealFoeMove(side, p.count, row.name) }),
  }),
  'soften-first-contact': Object.freeze({
    describe: 'The first contact hit each battle deals `mult` damage.',
    params: (t) => ({ mult: t.softenMult, text: null }),
    hooks: (p, row) => ({
      onDefendMult: ({ move, bflags }) => {
        const key = `${row.id}:used`;
        if (move.effect.contact && !bflags[key]) {
          bflags[key] = true;
          return { mult: p.mult, text: p.text || `${row.name} softened the hit.` };
        }
        return { mult: 1 };
      },
    }),
  }),
  'soften-first-non-strong': Object.freeze({
    describe: 'The first hit each battle that is not Strong against it deals `mult` damage.',
    params: (t) => ({ mult: t.softenMult, text: null }),
    hooks: (p, row) => ({
      onDefendMult: ({ eff, bflags }) => {
        const key = `${row.id}:used`;
        if (eff.word !== 'Strong' && !bflags[key]) {
          bflags[key] = true;
          return { mult: p.mult, text: p.text || `${row.name} took the hit.` };
        }
        return { mult: 1 };
      },
    }),
  }),
  'neutralize-first-strong': Object.freeze({
    describe: 'The first Strong hit each battle deals neutral damage.',
    params: () => ({ text: null }),
    hooks: (p, row) => ({
      onDefendMult: ({ eff, bflags }) => {
        const key = `${row.id}:used`;
        if (eff.word === 'Strong' && eff.mult > 0 && !bflags[key]) {
          bflags[key] = true;
          return { mult: 1 / eff.mult, text: p.text || `${row.name}. The hit lands neutral.` };
        }
        return { mult: 1 };
      },
    }),
  }),
  'exp-share-lowest': Object.freeze({
    describe: 'After a battle it took part in, the lowest-level party member gets `toLowest` of its EXP.',
    params: (t) => ({ toLowest: t.expShareToLowest }),
    flags: (p) => ({ expShare: Object.freeze({ toLowest: p.toLowest }) }),
  }),
  decoys: Object.freeze({
    describe: 'Each evasion stage shows as a decoy; a miss pops one instead.',
    flags: () => ({ decoys: true }),
  }),
  'type-cycle': Object.freeze({
    describe: 'At the end of each turn its type moves to the next in its posted type loop.',
    flags: () => ({ unfixed: true }),
    hooks: () => ({ onTurnEnd: ({ battle, side }) => battle.cycleUnfixed(side) }),
  }),
  'low-hp-type-boost': Object.freeze({
    describe: 'Below `threshold` HP its moves of `types` deal `mult` damage.',
    params: (t) => ({ threshold: t.lowHpThreshold, mult: t.lowHpBoost, types: [] }),
    hooks: (p) => ({
      onAttackMult: ({ hpRatio, moveType }) => (hpRatio < p.threshold && moveType !== null && list(p.types).includes(moveType) ? p.mult : 1),
    }),
  }),
  'type-power-boost': Object.freeze({
    describe: 'Its moves of `types` deal `mult` damage.',
    params: (t) => ({ mult: t.typeBoostMult, types: [] }),
    hooks: (p) => ({ onAttackMult: ({ moveType }) => (moveType !== null && list(p.types).includes(moveType) ? p.mult : 1) }),
  }),
  'crit-boost': Object.freeze({
    describe: 'Raises its crit stage by `stages`; with `glint`, it announces a coming crit.',
    params: (t) => ({ stages: t.critBoostStages, glint: true }),
    flags: (p) => ({ glint: !!p.glint }),
    hooks: (p) => ({ critStages: () => p.stages }),
  }),
  'first-type-sure-hit': Object.freeze({
    describe: 'Its first damaging move of `types` each battle never misses.',
    params: () => ({ types: [] }),
    hooks: (p, row) => ({
      sureHitOverride: ({ move, bflags }) => {
        const key = `${row.id}:used`;
        if (list(p.types).includes(move.type) && move.category !== 'status' && !bflags[key]) {
          bflags[key] = true;
          return true;
        }
        return false;
      },
    }),
  }),
  'block-self-ko': Object.freeze({
    describe: 'No creature on the field can use a self-KO move.',
    flags: () => ({ blocksSelfKo: true }),
  }),
  'category-damage-reduction': Object.freeze({
    describe: 'Takes `mult` damage from hits of `category`.',
    params: (t) => ({ category: 'physical', mult: t.categoryReductionMult }),
    hooks: (p) => ({ onDefendMult: ({ move }) => ({ mult: move.category === p.category ? p.mult : 1 }) }),
  }),
  'heal-on-ko': Object.freeze({
    describe: 'Heals `fraction` of max HP after knocking out a foe.',
    params: (t) => ({ fraction: t.healOnKoFraction }),
    hooks: (p) => ({ healOnKo: () => p.fraction }),
  }),
  'status-immunity': Object.freeze({
    describe: 'Cannot get any status in `kinds`.',
    params: () => ({ kinds: [] }),
    hooks: (p) => ({ statusImmune: (kind) => list(p.kinds).includes(kind) }),
  }),
  'block-foreign-stat-drops': Object.freeze({
    describe: 'Foes cannot lower its stats.',
    hooks: () => ({ blocksForeignStatDrops: () => true }),
  }),
});

/** Every hook key, for the data validator. */
export const HOOK_KEYS = Object.freeze(Object.keys(HOOKS));

/**
 * Problems of one ability row against the hook vocabulary; empty = valid.
 * @param {any} row
 * @returns {string[]}
 */
export function abilityProblems(row) {
  const out = [];
  const id = row && typeof row.id === 'string' ? row.id : '?';
  if (!row || typeof row !== 'object') return [`ability ${id}: not an object`];
  if (typeof row.name !== 'string' || !row.name) out.push(`ability ${id}: name is required`);
  if (row.hook != null && !HOOKS[row.hook]) out.push(`ability ${id}: unknown hook "${row.hook}"`);
  if (row.ward != null) {
    if (!['strong-only', 'no-status', 'min-power'].includes(row.ward.kind)) out.push(`ability ${id}: unknown ward kind ${String(row.ward.kind)}`);
    if (row.ward.kind === 'min-power' && !(row.ward.minPower > 0)) out.push(`ability ${id}: a min-power Ward needs minPower > 0`);
  }
  if (row.hookParams != null && (typeof row.hookParams !== 'object' || Array.isArray(row.hookParams))) out.push(`ability ${id}: hookParams must be an object`);
  return out;
}

/**
 * Merges an ability row with its hook into the runtime object the engine calls.
 * Row booleans `glint` / `expShare` (the data contract's shorthands) also set
 * those flags; `expShare` may be a number (the share) or `true` (the default share).
 * @param {{id: string, name: string, text?: string, ward?: any, hook?: string|null, hookParams?: Record<string, any>, expShare?: boolean|number|{toLowest: number}, glint?: boolean}} row
 * @param {{tuning?: Partial<typeof DEFAULTS>}} [opts]
 * @returns {Readonly<AbilityRuntime>}
 * @throws {TypeError} for a malformed row
 * @throws {RangeError} for an unknown hook key or tuning key
 */
export function getAbilityRuntime(row, opts = {}) {
  if (!row || typeof row !== 'object' || typeof row.id !== 'string') throw new TypeError('getAbilityRuntime: an ability row with an id is required');
  const tuning = mergeTuning(DEFAULTS, pick(opts.tuning, DEFAULTS), 'abilityHooks');
  const hookKey = row.hook == null ? null : row.hook;
  const def = hookKey === null ? null : HOOKS[hookKey];
  if (hookKey !== null && !def) throw new RangeError(`ability ${row.id}: unknown hook "${hookKey}" (known: ${HOOK_KEYS.join(', ')})`);
  const params = Object.freeze({ ...(def && def.params ? def.params(tuning) : {}), ...(row.hookParams || {}) });
  const name = typeof row.name === 'string' ? row.name : row.id;
  const hooks = Object.freeze(def && def.hooks ? def.hooks(params, { id: row.id, name }) : {});
  const flags = def && def.flags ? def.flags(params) : FLAGS_NONE;
  let expShare = flags.expShare || null;
  if (!expShare && row.expShare) {
    const share = typeof row.expShare === 'number' ? row.expShare : typeof row.expShare === 'object' ? row.expShare.toLowest : tuning.expShareToLowest;
    expShare = Object.freeze({ toLowest: share });
  }
  return Object.freeze({
    id: row.id,
    name,
    text: typeof row.text === 'string' ? row.text : '',
    ward: row.ward ? Object.freeze({ ...row.ward }) : null,
    hook: hookKey,
    params,
    hooks,
    expShare,
    glint: !!(flags.glint || row.glint === true),
    decoys: !!flags.decoys,
    blocksSelfKo: !!flags.blocksSelfKo,
    unfixed: !!flags.unfixed,
  });
}

/**
 * Keeps only the keys of `tuning` that `defaults` knows (callers may pass a
 * wider battle tuning table).
 * @param {Record<string, any>|undefined} tuning
 * @param {Record<string, any>} defaults
 * @returns {Record<string, any>|undefined}
 */
function pick(tuning, defaults) {
  if (!tuning) return undefined;
  const out = {};
  for (const k of Object.keys(tuning)) if (k in defaults) out[k] = tuning[k];
  return out;
}
