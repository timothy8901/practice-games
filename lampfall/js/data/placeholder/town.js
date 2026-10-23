/**
 * PLACEHOLDER day-1 town and economy tables: one NPC with a schedule and lines, one path, one
 * thread, one letter, one shop, one trainer, one item, one loan tier, the dial rule rows and the
 * event-script table. [DATA-IDX] Replaced by DATA-CAST / DATA-THREADS / DATA-LETTERS / DATA-ECON
 * files at integration. Every number is // [GDD].
 * @module data/placeholder/town
 */

/** @type {ReadonlyArray<import('../index.js').Item>} */
export const ITEMS = Object.freeze([
  { id: 'ph-lantern', name: 'PLACEHOLDER Lantern', pocket: 'tools', price: 250, sell: 125, stack: 20, use: 'capture:1', oneOfAKind: false, text: 'Shows the odds before you commit.' },
]);

/** @type {ReadonlyArray<import('../index.js').NpcDef>} */
export const NPCS = Object.freeze([
  {
    id: 'ph-keeper', name: 'PLACEHOLDER Keeper', species: 'otter', portrait: 'ph-keeper', sprite: 'ph-keeper', home: 'ph-hut',
    threadId: 'ph-thread',
    schedule: [
      { at: 6 * 60, mapId: 'ph-hut', x: 2, y: 2, pose: 'stand' },
      { at: 9 * 60, mapId: 'ph-field', x: 9, y: 2, pose: 'wander', wanderR: 2, path: 'ph-walk' },
      { at: { tide: 'low' }, mapId: 'ph-field', x: 4, y: 3, pose: 'stand', cond: { weather: ['clear'] } },
      { at: 21 * 60, mapId: 'ph-hut', x: 2, y: 2, pose: 'sleep' },
    ],
    topics: [
      { id: 'ph-first', cond: { not: { flag: 'sp.ph-met' } }, script: 'ph-intro', priority: 10, once: true },
      { id: 'ph-remind', cond: { loan: { paid: false } }, script: 'ph-remind', priority: 2, repeatDays: 1 },
    ],
    lines: {
      generic: [
        { id: 'g1', text: 'PLACEHOLDER generic line one.' },
        { id: 'g2', text: 'PLACEHOLDER generic line two, {player}.' },
      ],
      wander: ['PLACEHOLDER wander line.'],
      sleep: ['Zzz.'],
      night: ['PLACEHOLDER night line.'],
      porch: ['{player}. Sit a minute?'],
    },
  },
]);

/** Shared schedule templates and named paths. */
export const SCHEDULES = Object.freeze([
  { id: 'ph-walk', kind: 'path', mapId: 'ph-field', points: [[9, 2], [10, 2], [10, 3], [9, 3]] },
  { id: 'shopkeeper', kind: 'template', entries: [{ at: 7 * 60, pose: 'shop' }, { at: 21 * 60, pose: 'sleep' }] },
]);

/** @type {ReadonlyArray<import('../index.js').ThreadDef>} */
export const THREADS = Object.freeze([
  {
    id: 'ph-thread', npcId: 'ph-keeper', title: 'PLACEHOLDER thread',
    beats: [
      { id: 1, cond: { flag: 'sp.ph-met' }, script: 'ph-beat-1', advance: { dayOfWeek: [0] } },
      { id: 2, cond: { all: [{ thread: { id: 'ph-thread', beat: 1 } }, { letter: { read: 1 } }] }, script: 'ph-beat-2', where: { mapId: 'ph-field', x: 9, y: 2 }, reward: { share: true } },
    ],
  },
]);

/** @type {ReadonlyArray<import('../index.js').Letter>} */
export const LETTERS = Object.freeze([
  {
    id: 'letter-1', n: 1, from: 'PLACEHOLDER Sender', to: 'The Keeper', date: 'Day 1', seal: 'wax-blue',
    body: 'PLACEHOLDER first letter.|Write when the causeway dries.',
    relicId: null, unlock: null,
    reveal: [{ op: 'setFlag', id: 'sp.ph-letter-1' }],
  },
]);

/** @type {ReadonlyArray<import('../index.js').Shop>} */
export const SHOPS = Object.freeze([
  {
    id: 'ph-shop', keeper: 'ph-keeper', hours: [7 * 60, 21 * 60],
    stock: [{ item: 'ph-lantern' }, { item: 'ph-lantern', rotate: 'daily', qty: 3, cond: { badge: 1 } }],
    buys: ['fish', 'fruit', 'relic'], priceMult: 1.0, nightKeeper: null,
  },
]);

/** @type {ReadonlyArray<import('../index.js').Trainer>} */
export const TRAINERS = Object.freeze([
  {
    id: 'ph-rival-1', name: 'PLACEHOLDER Rival', title: 'Rival', class: 'rival', portrait: 'ph-rival',
    party: [{ species: 'ph-pip', level: 5, moves: ['ph-tap', 'ph-splash'] }],
    items: [], ai: 'trainer', payout: 100, tacticTag: 'rush',
    scripts: { before: 'ph-trainer-before', afterWin: 'ph-trainer-win', afterLoss: 'ph-trainer-loss' },
  },
]);

/** Loan ladder: the real GDD-02 table (its ids are the manifest's tier-N, so a partial stand-in would trip the manifest check). */
export { LOANS } from '../loans.js';

/**
 * Dial rule rows (§5.1 change 4: `DialRules`). // [GDD values]
 * @type {ReadonlyArray<import('../index.js').Dial>}
 */
export const DIALS = Object.freeze([
  { id: 'drift', name: 'Drift', text: 'Gentle odds, visible Forecasts.', rules: { readCostsTurn: false, captureDisplay: 'percent', wardBadge: true, runAllowed: true, holdOutTurns: 0, rerollCostMult: 1, anchorsAllowed: true } },
  { id: 'flux', name: 'Flux', text: 'The intended game.', rules: { readCostsTurn: false, captureDisplay: 'percent', wardBadge: true, runAllowed: true, holdOutTurns: 0, rerollCostMult: 2, anchorsAllowed: true } },
  { id: 'freefall', name: 'Freefall', text: 'No anchors, no rerolls.', rules: { readCostsTurn: true, captureDisplay: 'band', wardBadge: false, runAllowed: false, holdOutTurns: 2, rerollCostMult: 0, anchorsAllowed: false } },
]);

/** Challenge modes. // [GDD list] */
export const CHALLENGES = Object.freeze([
  { id: 'no-rewind', name: 'No Rewind', text: 'One autosave slot, no manual saves.' },
  { id: 'one-heart', name: 'One Heart', text: 'A blacked-out creature is released.' },
]);

/** Seed-code toggle registry (append-only; order is the bit order). */
export const TOGGLE_ORDER = Object.freeze([]);

/** Bus event -> script id rows (§6.3 `EVENT_SCRIPTS`). */
export const EVENT_SCRIPTS = Object.freeze([
  { id: 'ph-loan-tier-2', event: 'loan:tier:2', script: 'ph-beat-1' },
]);
