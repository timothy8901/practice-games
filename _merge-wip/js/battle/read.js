/**
 * What scouting reveals: the in-battle Read result, the pre-battle Read card
 * and the dossier posted at a Spire door or the Summit gate. [BATTLE-RULES]
 *
 * Per-dial behaviour is a rules table ({@link READ_CARD_RULES}), overridable
 * per call, so the GDD can retune what each dial shows without code changes.
 * Content arrives as data (see `battle/data.js`); nothing here names a species.
 *
 * Pure: no DOM, no randomness.
 * @module battle/read
 */

import { createBattleData } from './data.js';
import { isWard, CHIP_KINDS } from './effects.js';

/**
 * What the pre-battle Read card shows per dial (rules 6.2).
 * - `roster`: 'all' foe creatures or only the 'lead'
 * - `ability`: 'always', 'if-read' (once the species is Read in the Field Log) or 'never'
 * - `wardShimmer`: whether a Ward holder's entry and pip shimmer
 * - `pips`: whether the roster pips (one per foe creature) show
 * - `readCostsTurn`: whether an in-battle Read spends the turn (copied onto read results)
 * @typedef {{roster: 'all'|'lead', ability: 'always'|'if-read'|'never', wardShimmer: boolean, pips: boolean, readCostsTurn: boolean}} ReadCardRules
 * @type {Readonly<Record<string, Readonly<ReadCardRules>>>}
 */
export const READ_CARD_RULES = Object.freeze({
  drift: Object.freeze({ roster: 'all', ability: 'always', wardShimmer: true, pips: true, readCostsTurn: false }),
  flux: Object.freeze({ roster: 'all', ability: 'if-read', wardShimmer: true, pips: true, readCostsTurn: false }),
  freefall: Object.freeze({ roster: 'lead', ability: 'never', wardShimmer: false, pips: false, readCostsTurn: true }),
});

/**
 * @param {string} dial
 * @param {Partial<ReadCardRules>} [override]
 * @returns {ReadCardRules}
 * @throws {RangeError} for an unknown dial without a full override
 */
export function readRulesFor(dial, override) {
  const base = READ_CARD_RULES[dial];
  if (!base && !override) throw new RangeError(`read: unknown dial ${String(dial)}`);
  return { ...(base || READ_CARD_RULES.flux), ...(override || {}) };
}

/**
 * @typedef {Object} ReadInfo
 * @property {string} speciesId  @property {string} name  @property {string} species  @property {number} level
 * @property {string[]} types
 * @property {{id: string, name: string, text: string, ward: boolean}} ability
 * @property {boolean} costsTurn
 * @property {string[]} [moves]  @property {string|null} [heldItem]  @property {number} [mends]   (Scouting Prism only)
 */

/**
 * What an in-battle Read reveals about a creature: always the ability with a
 * one-line effect; the dial only sets what it costs.
 * @param {import('./creatureOps.js').BattleCreature} target
 * @param {string} dial
 * @param {any} data battle data (raw tables, Registry or BattleData)
 * @param {{prism?: boolean, rules?: Partial<ReadCardRules>, costsTurn?: boolean}} [opts] Scouting Prism adds moves, held item and Mends
 * @returns {ReadInfo}
 */
export function readCreature(target, dial, data, opts = {}) {
  const view = createBattleData(data);
  const ability = view.ability(target.ability);
  const species = view.species(target.speciesId);
  /** @type {ReadInfo} */
  const out = {
    speciesId: species.id,
    name: target.nickname,
    species: species.name,
    level: target.level,
    types: target.types.slice(),
    ability: { id: ability.id, name: ability.name, text: ability.text, ward: isWard(ability) },
    costsTurn: opts.costsTurn ?? readRulesFor(dial, opts.rules).readCostsTurn,
  };
  if (opts.prism) {
    out.moves = target.moves.map((m) => m.id);
    out.heldItem = target.heldItem ?? null;
    out.mends = target.mends;
  }
  return out;
}

/**
 * Infers a dossier tactic tag ("evasion + recovery", "Ward wall", "chip", "crits") from a roster.
 * @param {ReadonlyArray<import('./creatureOps.js').BattleCreature>} party
 * @param {any} data
 * @returns {string}
 */
export function inferTacticTag(party, data) {
  const view = createBattleData(data);
  const moves = (c) => c.moves.map((m) => view.move(m.id));
  const tags = [];
  const hasEva = party.some((c) => moves(c).some((mv) => mv.effect.evasion));
  const hasRec = party.some((c) => moves(c).some((mv) => mv.effect.recovery));
  if (hasEva && hasRec) tags.push('evasion + recovery');
  else if (hasEva) tags.push('evasion');
  else if (hasRec) tags.push('recovery');
  if (party.some((c) => isWard(view.ability(c.ability)))) tags.push('Ward wall');
  if (party.some((c) => moves(c).some((mv) => mv.effect.status && CHIP_KINDS.includes(mv.effect.status.kind)))) tags.push('chip');
  if (party.some((c) => moves(c).some((mv) => mv.effect.highCrit) || view.ability(c.ability).glint)) tags.push('crits');
  return tags.length ? tags.join(', ') : 'straight fight';
}

/**
 * @typedef {Object} Dossier
 * @property {string} name  @property {string|null} title
 * @property {Array<{speciesId: string, species: string, name: string, level: number, types: string[], ability: {id: string, name: string, ward: boolean}}>} roster
 * @property {number} healPips  @property {string} tacticTag
 */

/**
 * The dossier posted at a Spire door or the Summit gate: full roster with
 * abilities, heal pips and the tactic tag (dial-independent).
 * @param {{name: string, party: ReadonlyArray<import('./creatureOps.js').BattleCreature>, items?: ReadonlyArray<{heal?: number}>, tacticTag?: string, title?: string}} trainer
 * @param {any} data
 * @returns {Dossier}
 */
export function dossier(trainer, data) {
  const view = createBattleData(data);
  const roster = trainer.party.map((c) => {
    const ability = view.ability(c.ability);
    return { speciesId: c.speciesId, species: view.species(c.speciesId).name, name: c.nickname, level: c.level, types: c.types.slice(), ability: { id: ability.id, name: ability.name, ward: isWard(ability) } };
  });
  return {
    name: trainer.name,
    title: trainer.title || null,
    roster,
    healPips: (trainer.items || []).filter((i) => i.heal).length,
    tacticTag: trainer.tacticTag || inferTacticTag(trainer.party, view),
  };
}

/**
 * @typedef {Object} ReadCard
 * @property {string} dial
 * @property {Array<{speciesId: string, species: string, types: string[], level: number, ability: {id: string, name: string, ward: boolean}|null, wardShimmer: boolean, moves?: string[], heldItem?: string|null}>} roster
 * @property {Array<{wardShimmer: boolean}>|null} pips
 * @property {number|null} healPips   Scouting Prism only
 * @property {boolean} autoSkip       every foe species already Read: the card may be skipped
 */

/**
 * The pre-battle Read card (rules 6.2).
 * @param {{party: ReadonlyArray<import('./creatureOps.js').BattleCreature>, name?: string, items?: ReadonlyArray<{heal?: number}>}} foe trainer side (or a wild party)
 * @param {string} dial
 * @param {any} data
 * @param {{read: {has: (id: string) => boolean}}} [fieldLog] species ids already Read
 * @param {{prism?: boolean, rules?: Partial<ReadCardRules>}} [opts]
 * @returns {ReadCard}
 */
export function readCard(foe, dial, data, fieldLog = { read: new Set() }, opts = {}) {
  const view = createBattleData(data);
  const rules = readRulesFor(dial, opts.rules);
  const roster = rules.roster === 'lead' ? foe.party.slice(0, 1) : foe.party;
  const entries = roster.map((c) => {
    const ability = view.ability(c.ability);
    const showAbility = rules.ability === 'always' || (rules.ability === 'if-read' && fieldLog.read.has(c.speciesId));
    /** @type {any} */
    const e = {
      speciesId: c.speciesId,
      species: view.species(c.speciesId).name,
      types: c.types.slice(),
      level: c.level,
      ability: showAbility ? { id: ability.id, name: ability.name, ward: isWard(ability) } : null,
      wardShimmer: rules.wardShimmer && isWard(ability),
    };
    if (opts.prism) {
      e.moves = c.moves.map((m) => m.id);
      e.heldItem = c.heldItem ?? null;
    }
    return e;
  });
  const pips = rules.pips ? foe.party.map((c) => ({ wardShimmer: rules.wardShimmer && isWard(view.ability(c.ability)) })) : null;
  const allRead = foe.party.every((c) => fieldLog.read.has(c.speciesId));
  return { dial, roster: entries, pips, healPips: opts.prism ? (foe.items || []).filter((i) => i.heal).length : null, autoSkip: allRead };
}
