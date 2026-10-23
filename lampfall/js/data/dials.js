/**
 * The Chaos dial, the challenge modes and the seed-code toggle registry (GDD-02 Economy, from
 * GDD-00 §3, §7, §8 and §15). [DATA-ECON]
 *
 * DIALS — the three positions printed on the back of the lease card ("How do you like your odds?").
 * `rules` is the battle-facing rule row the validator and `battle/engine` read (`readCostsTurn`,
 * `captureDisplay` 'percent' | 'band', `wardBadge`, `runAllowed`, `holdOutTurns` (0 = no dial-wide
 * hold-out; scripted battles set their own), `rerollCostMult`, `anchorsAllowed`). `shift` is GDD-00
 * §8's dial table as data: base and steadied (after the Relighting) Up / Side / Down odds, the Bond
 * cap, the stat floor, pool weighting, unseen forms, anchor stones, Read cost, capture display, and
 * whether the Summit Bell holds your place. The numbers equal `data/tuning.js` (CARD_ODDS, BOND_CAP,
 * STAT_FLOOR, anchorRules, CAPTURE_DISPLAY); the test checks they agree.
 *
 * CHALLENGES — No Rewind and One Heart ship; Ride the Dice and Blind Read ship only if the cut line
 * allows (`optional: true`). Each is a wax seal on the Seed Card.
 *
 * TOGGLE_ORDER — the seed code's toggle bits (`core/rng.setSeedToggles`, at most 8). APPEND-ONLY:
 * bit i is the i-th name, so reordering or removing a name changes every seed code ever shared.
 *
 * Changing the dial happens only at home (the Hearth Ledger's last page, with Dimity) and marks the
 * Seed Card not race-eligible. Pure data; deep-frozen.
 * @module data/dials
 */

/** @template T @param {T} o @returns {T} */
function freeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) freeze(v);
  }
  return o;
}

/**
 * @typedef {Object} DialShiftRules
 * @property {{up: number, side: number, down: number}} odds        base card odds (sum 100)
 * @property {{up: number, side: number, down: number}} steadied    with `lit.steadied` (5 pts Down -> Side)
 * @property {number} bondStep      pts moved Down -> Up per Bond pip
 * @property {number} bondCap       most pts Bond can move
 * @property {number|null} statFloor  fraction of each stat kept through a Shift (null = none)
 * @property {'source'|'flat'} poolWeights  weights inside a card
 * @property {'shown'|'silhouette'} unseenForms
 * @property {{start: number, refillTo: number, perBadge: number, price: number|null, buyable: boolean}} anchors
 * @property {boolean} readFree     Read costs nothing (false: it spends the turn)
 * @property {boolean} summitBellHolds  the Summit Bell restarts you at whoever beat you
 * @property {number} starTouched   chance a Forecast shows the Star-touched form in the Side slot
 * @property {number|null} discConfirmAbove   ask before buying a disc above this price (null = never)
 */

/** @type {ReadonlyArray<{id: string, name: string, tag: string, text: string, rules: Record<string, any>, shift: DialShiftRules}>} */
export const DIALS = freeze([
  {
    id: 'drift', name: 'Drift', tag: 'gentler',
    text: 'Kinder odds and three free anchor stones, topped up with every badge. The cards still turn; they just lean your way.',
    rules: { readCostsTurn: false, captureDisplay: 'percent', wardBadge: true, runAllowed: true, holdOutTurns: 0, rerollCostMult: 1, anchorsAllowed: true },
    shift: {
      odds: { up: 50, side: 40, down: 10 },
      steadied: { up: 50, side: 45, down: 5 },
      bondStep: 5, bondCap: 5, statFloor: 0.1,
      poolWeights: 'source', unseenForms: 'shown',
      anchors: { start: 3, refillTo: 3, perBadge: 0, price: 500, buyable: true },
      readFree: true, summitBellHolds: true, starTouched: 0.02, discConfirmAbove: null,
    },
  },
  {
    id: 'flux', name: 'Flux', tag: 'as Isolde read it',
    text: 'The odds as the sea sets them. Anchor stones cost 500 at the Anchorage; Corin leaves two on your step.',
    rules: { readCostsTurn: false, captureDisplay: 'percent', wardBadge: true, runAllowed: true, holdOutTurns: 0, rerollCostMult: 1, anchorsAllowed: true },
    shift: {
      odds: { up: 40, side: 35, down: 25 },
      steadied: { up: 40, side: 40, down: 20 },
      bondStep: 5, bondCap: 15, statFloor: 0.2,
      poolWeights: 'source', unseenForms: 'shown',
      anchors: { start: 2, refillTo: 0, perBadge: 0, price: 500, buyable: true },
      readFree: true, summitBellHolds: true, starTouched: 0.02, discConfirmAbove: null,
    },
  },
  {
    id: 'freefall', name: 'Freefall', tag: 'wild',
    text: 'Flat pools, silhouettes for forms you have never seen, odds in words, one stone per badge and no stat floor. Read costs the turn. The Summit Bell will not hold your place.',
    rules: { readCostsTurn: true, captureDisplay: 'band', wardBadge: true, runAllowed: true, holdOutTurns: 0, rerollCostMult: 1, anchorsAllowed: true },
    shift: {
      odds: { up: 30, side: 30, down: 40 },
      steadied: { up: 30, side: 35, down: 35 },
      bondStep: 5, bondCap: 10, statFloor: null,
      poolWeights: 'flat', unseenForms: 'silhouette',
      anchors: { start: 0, refillTo: 0, perBadge: 1, price: null, buyable: false },
      readFree: false, summitBellHolds: false, starTouched: 0.02, discConfirmAbove: 2500,
    },
  },
]);

/** The dial a new game starts on. */
export const DEFAULT_DIAL = 'flux';

/**
 * @typedef {Object} ChallengeDef
 * @property {string} id  @property {string} name  @property {string} seal   wax-seal label on the Seed Card
 * @property {boolean} optional   ships only if the cut line allows
 * @property {Record<string, any>} rules   machine keys the owning systems read
 * @property {string} text
 */

/** @type {ReadonlyArray<ChallengeDef>} */
export const CHALLENGES = freeze([
  {
    id: 'no-rewind', name: 'No Rewind', seal: 'NR', optional: false,
    rules: { saveSlots: 1, manualSaves: false, autosaveOnly: true },
    text: 'One autosave slot and no manual saves. What happened, happened; Dimity writes it down anyway.',
  },
  {
    id: 'one-heart', name: 'One Heart', seal: 'OH', optional: false,
    rules: { battlers: 'starter', othersCatchable: true },
    text: 'Only the creature that picked you may battle. Catch the others for the Field Log, and keep them company.',
  },
  {
    id: 'ride-the-dice', name: 'Ride the Dice', seal: 'RD', optional: true,
    rules: { anchorDisabled: true },
    text: 'Anchor is disabled. Every window lands one way or another; Reroll is still yours.',
  },
  {
    id: 'blind-read', name: 'Blind Read', seal: 'BR', optional: true,
    rules: { readShows: ['types'], scoutingPrism: false },
    text: 'Read shows types only, and Corin keeps the Scouting Prism in his pocket. Trust your eyes.',
  },
]);

/** Seed-code toggle bit order: APPEND-ONLY (bit i = i-th name; at most 8). */
export const TOGGLE_ORDER = freeze(['no-rewind', 'one-heart', 'ride-the-dice', 'blind-read']);

export default DIALS;
