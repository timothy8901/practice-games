/**
 * WILDSHIFT abilities: data plus hook functions the battle engine calls.
 *
 * Each ability is `{id, name, text, ward?, hooks}`. The engine calls a hook
 * only when it exists, so an ability with no battle effect (Skyroam,
 * Blank Slate) is plain data. Hooks are pure: they read the context and
 * return a value (a multiplier, a boolean, or a list of events); the engine
 * applies it. `bflags` is the per-creature, per-battle scratch object the
 * engine resets at battle start (so "first hit each battle" survives a switch).
 *
 * Ward abilities carry `ward: {kind}`:
 * - 'strong-only'  Glasshide / Prism Ward: only Strong hits land
 * - 'no-status'    Mirrorveil: status moves aimed at the holder fail
 * - 'min-power'    Stillcoat: hits under `minPower` do nothing
 * Scrap never pierces any Ward. Chip damage (poison, burn, trap) always does.
 *
 * @module proto/battle/abilities
 */

import { effectiveness } from './types.js';

/**
 * @typedef {Object} AbilityHooks
 * @property {(ctx: any) => any[]} [onSwitchIn] returns events
 * @property {(ctx: {attacker:any, move:any, hpRatio:number, moveType:string|null}) => number} [onAttackMult] outgoing damage multiplier
 * @property {(ctx: {defender:any, attacker:any, move:any, eff:{mult:number, word:string}, bflags:any}) => {mult:number, effMult?:number, text?:string}} [onDefendMult] incoming damage multiplier
 * @property {() => number} [critStages] extra crit stages
 * @property {(ctx: {attacker:any, move:any, bflags:any}) => boolean} [sureHitOverride] true = this move cannot miss
 * @property {(kind: string) => boolean} [statusImmune]
 * @property {() => boolean} [blocksForeignStatDrops]
 * @property {(ctx: any) => any[]} [onTurnEnd] returns events
 * @property {() => number} [healOnKo] fraction of max HP healed after KOing a foe
 */

/** @typedef {{id:string,name:string,text:string,ward?:{kind:'strong-only'|'no-status'|'min-power',minPower?:number},hooks:AbilityHooks,[k:string]:any}} Ability */

const STILLCOAT_MIN_POWER = 50; // estimate (rules 8.1)
const LAST_EBB_THRESHOLD = 0.25; // estimate
const LAST_EBB_BONUS = 1.3; // estimate

/** @type {Ability[]} */
const LIST = [
  // ---- Named in the creatures doc --------------------------------------------
  ab('shoresense', 'Shoresense', 'On switch-in it Reads the foe automatically. The foe\'s ability and any Ward go straight into the Field Log.', {
    onSwitchIn: ({ battle, side }) => battle.autoRead(side, 'Shoresense'),
  }),
  ab('featherbed', 'Featherbed', 'Halves damage from the first contact hit each battle.', {
    onDefendMult: ({ move, bflags }) => {
      if (move.effect.contact && !bflags.featherbedUsed) {
        bflags.featherbedUsed = true;
        return { mult: 0.5, text: 'Featherbed softened the hit. The fringe flattens.' };
      }
      return { mult: 1 };
    },
  }),
  ab('big-sibling', 'Big Sibling', 'After each battle it takes part in, the lowest-level party member gets an extra 30% of its EXP. Lost if it faints.', {}, {
    expShare: { toLowest: 0.3 },
  }),
  ab('prism-ward', 'Prism Ward', 'Only Strong hits land. Poison, burn and trap damage still work.', {}, {
    ward: { kind: 'strong-only' },
    wardClass: 'Glasshide',
  }),
  ab('afterimage', 'Afterimage', 'Each evasion stage shows as a decoy (max 2). A hit that lands on a decoy pops it and deals no damage.', {}, {
    decoys: true,
  }),
  ab('unfixed', 'Unfixed', 'At the end of each turn its type moves to the next in a posted loop of four: Star, then three seeded types.', {
    onTurnEnd: ({ battle, side }) => battle.cycleUnfixed(side),
  }, { unfixed: true }),
  ab('last-ebb', 'Last Ebb', 'Below 25% HP its Brine and Hollow moves gain 30% power.', {
    onAttackMult: ({ hpRatio, moveType }) =>
      hpRatio < LAST_EBB_THRESHOLD && (moveType === 'Brine' || moveType === 'Hollow') ? LAST_EBB_BONUS : 1,
  }, { threshold: LAST_EBB_THRESHOLD }),
  ab('empty-weave', 'Empty Weave', 'The first hit each battle that is not Strong against it deals half damage.', {
    onDefendMult: ({ eff, bflags }) => {
      if (eff.word !== 'Strong' && !bflags.emptyWeaveUsed) {
        bflags.emptyWeaveUsed = true;
        return { mult: 0.5, text: 'Empty Weave took the hit. The rope ring unravels.' };
      }
      return { mult: 1 };
    },
  }),
  ab('keen-glint', 'Keen Glint', 'Raises its crit chance two stages. Its ears glint on a turn its next hit will crit.', {
    critStages: () => 2,
  }, { glint: true }),
  ab('tailhum', 'Tailhum', 'On switch-in, reveals one foe move.', {
    onSwitchIn: ({ battle, side }) => battle.revealFoeMove(side, 1, 'Tailhum'),
  }),
  ab('plateshed', 'Plateshed', 'The first Strong hit each battle deals neutral damage, and one plate falls off.', {
    onDefendMult: ({ eff, bflags }) => {
      if (eff.word === 'Strong' && !bflags.plateshedUsed) {
        bflags.plateshedUsed = true;
        return { mult: 1 / eff.mult, text: 'Plateshed. A plate falls away and the hit lands neutral.' };
      }
      return { mult: 1 };
    },
  }),
  ab('skyroam', 'Skyroam', 'Moves one route per in-game hour. Once seen, it shows on the map. (No battle effect.)', {}),
  ab('blank-slate', 'Blank Slate', 'Its Heartmark can carry any one of its techniques, chosen at its first Shift. (No battle effect.)', {}, { heartmarkChoice: true }),
  ab('unshifting', 'Unshifting', 'Cannot Shift and its type never changes. Any effect that would force a type or form change fails.', {}, { neverShifts: true, fixedType: true }),
  ab('furnace-jaw', 'Furnace Jaw', 'Its first Kiln move each battle never misses.', {
    sureHitOverride: ({ move, bflags }) => {
      if (move.type === 'Kiln' && move.category !== 'status' && !bflags.furnaceJawUsed) {
        bflags.furnaceJawUsed = true;
        return true;
      }
      return false;
    },
  }),
  // ---- The three Wards ---------------------------------------------------------
  ab('glasshide', 'Glasshide', 'Only Strong hits land.', {}, { ward: { kind: 'strong-only' }, wardClass: 'Glasshide' }),
  ab('mirrorveil', 'Mirrorveil', 'Status moves aimed at it fail.', {}, { ward: { kind: 'no-status' }, wardClass: 'Mirrorveil' }),
  ab('stillcoat', 'Stillcoat', `Hits under ${STILLCOAT_MIN_POWER} power do nothing.`, {}, { ward: { kind: 'min-power', minPower: STILLCOAT_MIN_POWER }, wardClass: 'Stillcoat' }),
  // ---- Generic -------------------------------------------------------------------
  ab('sodden', 'Sodden', 'Stops every creature on the field from using a self-KO move.', {}, { blocksSelfKo: true }),
  ab('tidecall', 'Tidecall', 'Brine moves gain 20% power.', {
    onAttackMult: ({ moveType }) => (moveType === 'Brine' ? 1.2 : 1),
  }),
  ab('ember-core', 'Ember Core', 'Kiln moves gain 20% power.', {
    onAttackMult: ({ moveType }) => (moveType === 'Kiln' ? 1.2 : 1),
  }),
  ab('slatehide', 'Slatehide', 'Takes 25% less damage from physical hits.', {
    onDefendMult: ({ move }) => ({ mult: move.category === 'physical' ? 0.75 : 1 }),
  }),
  ab('scavenger', 'Scavenger', 'Heals 1/8 of max HP after knocking out a foe.', {
    healOnKo: () => 1 / 8,
  }),
  ab('still-mind', 'Still Mind', 'Cannot be numbed or chilled.', {
    statusImmune: (kind) => kind === 'numb' || kind === 'chill',
  }),
  ab('sure-footing', 'Sure Footing', 'Foes cannot lower its stats.', {
    blocksForeignStatDrops: () => true,
  }),
];

/**
 * @returns {Ability}
 */
function ab(id, name, text, hooks, extra = {}) {
  return Object.freeze({ id, name, text, hooks: Object.freeze({ ...hooks }), ...extra });
}

/** All abilities by id. */
export const ABILITIES = Object.freeze(Object.fromEntries(LIST.map((a) => [a.id, a])));

/** Ordered list. */
export const ABILITY_LIST = Object.freeze(LIST.slice());

/** Ids of the Ward-class abilities. */
export const WARD_IDS = Object.freeze(LIST.filter((a) => a.ward).map((a) => a.id));

/**
 * @param {string} id
 * @returns {Ability}
 * @throws {RangeError} for an unknown id
 */
export function getAbility(id) {
  const a = ABILITIES[id];
  if (!a) throw new RangeError(`getAbility: unknown ability ${String(id)}`);
  return a;
}

/** @param {Ability|null|undefined} ability @returns {boolean} */
export function isWard(ability) {
  return !!(ability && ability.ward);
}

/**
 * Whether a Ward lets a given technique through. Pure: no engine state.
 * Scrap never pierces. Immune (mult 0) hits never land either way.
 *
 * @param {Ability} ability the defender's ability (may be a non-Ward)
 * @param {import('./moves.js').Move} move
 * @param {readonly string[]} defenderTypes
 * @param {string|null} [moveType] override for queued-type moves
 * @returns {{lands: boolean, reason: 'ward'|'immune'|null, eff: {mult:number, word:string}}}
 */
export function wardCheck(ability, move, defenderTypes, moveType = move.type) {
  const eff = move.category === 'status' ? { mult: 1, word: 'Neutral' } : effectiveness(moveType, defenderTypes);
  if (move.category !== 'status' && eff.mult === 0) return { lands: false, reason: 'immune', eff };
  const ward = ability && ability.ward;
  if (!ward) return { lands: true, reason: null, eff };
  if (move.effect.scrap) return { lands: false, reason: 'ward', eff };
  switch (ward.kind) {
    case 'strong-only':
      if (move.category === 'status') return { lands: true, reason: null, eff };
      return eff.mult > 1 ? { lands: true, reason: null, eff } : { lands: false, reason: 'ward', eff };
    case 'no-status':
      return move.category === 'status' ? { lands: false, reason: 'ward', eff } : { lands: true, reason: null, eff };
    case 'min-power':
      if (move.category === 'status') return { lands: true, reason: null, eff };
      return move.power < ward.minPower ? { lands: false, reason: 'ward', eff } : { lands: true, reason: null, eff };
    default:
      return { lands: true, reason: null, eff };
  }
}

/**
 * The one-line readout header for a blocked hit, e.g.
 * "Glasshide held. Only Strong hits get through."
 * @param {Ability} ability
 * @returns {string}
 */
export function wardHeldText(ability) {
  switch (ability.ward && ability.ward.kind) {
    case 'strong-only': return `${ability.name} held. Only Strong hits get through.`;
    case 'no-status': return `${ability.name} held. Status techniques fail against it.`;
    case 'min-power': return `${ability.name} held. Hits under ${ability.ward.minPower} power do nothing.`;
    default: return `${ability.name} held.`;
  }
}
