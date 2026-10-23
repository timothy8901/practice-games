// [GDD] Every value in this file is a PLACEHOLDER awaiting the design panel (ARCHITECTURE §15.5).
// Systems import these constants by name; nothing in js/systems hard-codes a tuned number.
/**
 * Designer-tuned numbers, by name (caps, shares, costs, rates). [DATA-IDX]
 *
 * Grouped by the system that reads them. Keep every number here, in `data/dials.js` or in
 * `data/loans.js`; never in a system. `TUNING` is the frozen table; the named exports are the
 * same values for direct import.
 * @module data/tuning
 */

/** @type {Readonly<Record<string, any>>} */
export const TUNING = Object.freeze({
  // --- creatures / battle (§5.1 change 5: LANTERN, BLACKOUT_*, BENCH_SHARE, CATCH_UP_*, CAPTURE_*) ---
  wardCount: 0,                 // [GDD] number of Ward abilities the validator expects in data/abilities
  benchShare: 0.5,              // [GDD] EXP share for benched party members
  yardShare: 0.25,              // [GDD] EXP share for Training Yard creatures (0 if the Yard is cut)
  catchUpLevels: 5,             // [GDD] levels below curve at which catch-up EXP starts
  catchUpMult: 1.5,             // [GDD] catch-up multiplier at full gap
  dampingAboveCurve: 0.5,       // [GDD] EXP multiplier when above the curve level
  blackoutCostFraction: 0.1,    // [GDD] share of wallet.main lost on a blackout
  blackoutCostMin: 10,          // [GDD]
  captureBands: Object.freeze([0.25, 0.5, 0.75]),   // [GDD] band edges for the Freefall capture display
  lanternGrades: Object.freeze({ 'capture:1': 1.0, 'capture:2': 1.5, 'capture:3': 2.0 }), // [GDD] odds multipliers
  mendsPerBattle: 2,            // [GDD]
  // --- shifts / forecast ---
  rerollBaseCost: 1,            // [GDD] starsalt per reroll before dial multipliers
  anchorCost: 1,                // [GDD] anchors per Anchor
  starTouchedChance: 0.02,      // [GDD]
  // --- town / neighbours ---
  noRepeatDays: 3,              // generic lines are not repeated within this many days
  porchWindow: Object.freeze([19 * 60, 22 * 60]),   // [GDD] minutes of day when porch talk is on
  letterHour: 6,                // morning letters arrive at this hour
  npcCatchUpTiles: 12,          // path catch-up cap per schedule change
  npcsPerMap: 16,               // simulated NPC cap per map (§12)
  // --- economy ---
  shopDiminishingAfter: 5,      // [GDD] sells of one item per day before the price drops
  shopDiminishingMult: 0.75,    // [GDD]
  wantedTodayMult: 1.5,         // [GDD]
  stackMax: 99,                 // default stack limit when an item gives none
  // --- world / loop ---
  encounterRateDefault: 0.08,
  encounterMinLevel: 1,
  encounterMaxLevel: 100,
  animatedTileCap: 400,         // validator warns above this (§4.2)
  toolRingHoldMs: 220,          // hold `tool` this long to open the ring (§7)
  routeAutosaveMs: 90_000,      // route autosave timer when dirty (§10)
  dayPageLogLines: 60,
  regrowDaysDefault: 2,         // [GDD] trees / cracks regrow after this many days
});

export const wardCount = TUNING.wardCount;
export const benchShare = TUNING.benchShare;
export const noRepeatDays = TUNING.noRepeatDays;
export const porchWindow = TUNING.porchWindow;
export const letterHour = TUNING.letterHour;
export const npcCatchUpTiles = TUNING.npcCatchUpTiles;
export const toolRingHoldMs = TUNING.toolRingHoldMs;
export const routeAutosaveMs = TUNING.routeAutosaveMs;
export const animatedTileCap = TUNING.animatedTileCap;
export const encounterMinLevel = TUNING.encounterMinLevel;
export const encounterMaxLevel = TUNING.encounterMaxLevel;
export const stackMax = TUNING.stackMax;

export default TUNING;
