/**
 * Every shop and counter (GDD-02 Economy, from GDD-00 §5 anchors, §7 and §9 Shops). [DATA-ECON]
 *
 * §14.9 rows (`id, keeper, hours, stock, buys, priceMult, nightKeeper`) plus the optional keys
 * `systems/shops` reads: `buysAll` (buys anything: Pell's by day, Ludo by night, so someone is always
 * buying), `rotations` (rows drawn per rotating pool per day, seeded `shop:<day>`), `wanted` and
 * `wantedPool` (Wanted Today: three at +50%, one stack each a day), `fromDay` (GDD day it opens) and
 * `cond` (open at all). Prices are fixed: an item costs its row `price` × `priceMult` everywhere.
 *
 * Keys no system reads yet are the authored content for the scenes that will: `decor` (the
 * furniture and clothes a shop rotates; ids from GDD-ids, rows from GDD-05), `backRoom` (Juniper's
 * heirlooms, returned free, never sold), `refine` (the Raft turns skyglass relics into Starsalt 1:1),
 * `auction` (Dov's sealed-crate disc auction at the first Lantern Market), `services` (what a counter
 * does that is not a sale), `bounty` (Barnaby's weekly Archive Bounty) and `crate` (the Consignment
 * Crate at your gate, which pays 90% at 06:00 through `systems/shops.settleCrate`).
 *
 * Hours are `[open, close)` minutes of day and wrap midnight. Stock `cond`s use the cond DSL; note
 * that the DSL's `day.dow` is the GDD calendar weekday, 0 = Monday … 6 = Sunday (state/selectors
 * DAY0_WEEKDAY: GDD day 1 is a Sunday), so the spring-tide Saturdays (GDD days 7, 14, 21) are `dow 5`
 * and the small hours after market night are `dow 6`; `fromDay` is a GDD day.
 * Pure data; deep-frozen.
 * @module data/shops
 */

/** @template T @param {T} o @returns {T} */
function freeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) freeze(v);
  }
  return o;
}

const H = 60;

/** The four collection kinds a buyer names (validator COLLECTION_KINDS). */
const ALL_KINDS = ['fish', 'bug', 'fruit', 'relic'];

/** Anchor stones are sold on Drift and Flux; Freefall earns one per badge and never buys them. */
const STONES_SOLD = { dial: ['drift', 'flux'] };

/** Saturday 20:00 to Sunday 02:00 (core-day weekday 6, then 0 before 02:00). */
const MARKET_NIGHT = { any: [{ all: [{ day: { dow: [5] } }, { hour: [20, 24] }] }, { all: [{ day: { dow: [6] } }, { hour: [0, 2] }] }] };

/** Furniture Pell's rotates (all 24; the first 12 survive cut-order 14). */
const FURNITURE = [
  'driftwood-bench', 'net-hammock', 'sea-chest', 'chart-table', 'barometer-clock', 'rag-rug', 'creel-stool', 'bottle-shelf',
  'brass-bedstead', 'rocking-chair', 'pot-belly-stove', 'fern-planter', 'oar-rack', 'figurehead', 'buoy-lamp', 'wheel-table',
  'cork-board', 'tide-clock', 'nesting-basket', 'field-guide-shelf', 'map-chest', 'float-chandelier', 'patchwork-bed', 'lamp-room-model',
];
/** Clothes for sale (the lighthouse jumper and the co-op apron are issued, not sold). */
const CLOTHES = ['oilskin-jacket', 'sou-wester', 'tide-boots', 'cable-cardigan', 'watch-cap', 'wader-overalls', 'ferry-scarf', 'keepers-coat', 'market-wrap', 'comet-brooch'];

/** Skyglass relics (finds) the Raft refines and Barnaby buys at 900. */
const SKYGLASS = ['skyglass-shard', 'skyglass-bead', 'skyglass-knot'];

/** Wanted Today candidates: everyday goods (not the night headliners, not skyglass). */
const WANTED = [
  'perch', 'grey-mullet', 'dab', 'herring', 'mackerel', 'sand-eel', 'stickleback', 'brown-trout', 'grayling', 'sea-trout',
  'silver-eel', 'pollack', 'red-gurnard', 'lumpsucker', 'sea-bass', 'glimmer-sprat',
  'tiger-moth', 'ermine-moth', 'hawk-moth', 'glow-worm', 'sandhopper', 'starfly', 'red-admiral', 'dor-beetle', 'damselfly', 'bush-cricket',
  'ammonite', 'belemnite', 'crinoid-stem', 'fossil-fern', 'urchin-cast',
  'cockle', 'razor-shell', 'sea-glass', 'cuttlebone', 'mermaids-purse', 'whelk-shell',
  'pear', 'plum', 'apple', 'cherry', 'quince', 'peach', 'fig', 'apricot', 'mulberry',
  'honeycomb', 'timber', 'moth-silk',
];

/** @type {ReadonlyArray<import('./index.js').Shop & Record<string, any>>} */
export const SHOPS = freeze([
  {
    id: 'pells-sundries', name: 'Pell\'s Sundries', keeper: 'juniper', hours: [8 * H, 22 * H],
    greeting: 'Pell\'s! Everything you need and three things you didn\'t know you did.',
    stock: [
      // staples: never randomized
      { item: 'tallow-wick' },
      { item: 'brass-wick' },
      { item: 'skyglass-wick', cond: { badge: 2 } },
      { item: 'salve' },
      { item: 'tonic' },
      { item: 'full-salve' },
      { item: 'revive' },
      { item: 'ether', cond: { badge: 3 } },
      { item: 'full-ether', cond: { badge: 3 } },
      { item: 'poultice' },
      { item: 'warm-shawl' },
      { item: 'crackdust' },
      { item: 'anchor-stone', cond: STONES_SOLD },
      { item: 'timber' },                                  // the yard's offcuts: Ambrose's posts (The Fence) and carved furniture (MID-03)
      { item: 'disc-spore-drift', cond: { badge: 1 } },          // the chip-damage disc, guaranteed by badge 1
      // two discs a day
      { item: 'disc-spore-drift', rotate: 'discs', cond: { not: { badge: 1 } } },
      { item: 'disc-sandtrap', rotate: 'discs' },
      { item: 'disc-shardlight', rotate: 'discs' },
      { item: 'disc-gale-cut', rotate: 'discs' },
      { item: 'disc-flashover', rotate: 'discs', cond: { badge: 1 } },
      { item: 'disc-live-wire', rotate: 'discs', cond: { badge: 2 } },
      { item: 'disc-stand-firm', rotate: 'discs', cond: { flag: 'sp.first-market' } },
      // one coverage disc face-up from badge 4
      { item: 'disc-cairn-crash', rotate: 'coverage', cond: { badge: 4 } },
      { item: 'disc-hoarfrost', rotate: 'coverage', cond: { badge: 4 } },
      { item: 'disc-drowned-bell', rotate: 'coverage', cond: { badge: 4 } },
      // one held item a day from badge 2
      { item: 'whetstone', rotate: 'held', cond: { badge: 2 } },
      { item: 'cork-float', rotate: 'held', cond: { badge: 2 } },
      { item: 'oilskin', rotate: 'held', cond: { badge: 2 } },
      { item: 'ballast-stone', rotate: 'held', cond: { badge: 2 } },
      { item: 'lucky-button', rotate: 'held', cond: { badge: 2 } },
      { item: 'tally-charm', rotate: 'held', cond: { badge: 2 } },
    ],
    rotations: { discs: 2, coverage: 1, held: 1 },
    buys: ALL_KINDS, buysAll: true, priceMult: 1, nightKeeper: null,
    wanted: true, wantedPool: WANTED,
    decor: { furniture: FURNITURE, clothes: CLOTHES, perDay: { furniture: 3, clothes: 2 } },
    backRoom: ['dorrow-kettle', 'brack-still-knot', 'grade-two-lantern', 'bryony-seed-tin', 'odile-easel', 'thessaly-almanac', 'isoldes-lantern'],
    services: { identify: false, cartWhenBuilding: true },
    text: 'Juniper\'s shop: wicks, medicine, two discs a day, the Wanted Today board, and a back room nobody else goes in.',
  },
  {
    id: 'ludo-eave', name: 'Ludo\'s Eave', keeper: 'ludo', hours: [22 * H, 8 * H],
    greeting: 'Evening. Or morning. Hard to say from up here. What have you got?',
    stock: [
      { item: 'starsalt', qty: 3 },                       // shares the 3-a-day cap with the Raft
      { item: 'fruit-seedling', qty: 1 },
      { item: 'moth-silk', qty: 5 },
      // night stock: two odds and ends a night
      { item: 'tallow-wick', rotate: 'night' },
      { item: 'brass-wick', rotate: 'night' },
      { item: 'salve', rotate: 'night' },
      { item: 'revive', rotate: 'night' },
      { item: 'poultice', rotate: 'night' },
      { item: 'warm-shawl', rotate: 'night' },
    ],
    rotations: { night: 2 },
    buys: ALL_KINDS, buysAll: true, priceMult: 1, nightKeeper: null,
    text: 'A fruit bat on the post-office eave. Buys anything at full price from ten till eight; sells Starsalt, seedlings and moth-silk.',
  },
  {
    id: 'carnival-raft', name: 'The Carnival Raft', keeper: 'varga', hours: [12 * H, 2 * H], fromDay: 3,
    greeting: 'Step up! Every shape is a lucky shape if you read it right.',
    stock: [
      { item: 'starsalt', qty: 3 },                       // shares the 3-a-day cap with Ludo
    ],
    buys: [], priceMult: 1, nightKeeper: null,
    refine: { from: SKYGLASS, to: 'starsalt', rate: 1 },
    services: { shiftFair: { festival: 'lantern-market', text: 'Varga posts a live Forecast on the fair board and the crowd calls the odds. You call them better.' } },
    text: 'Teo Varga\'s floating fair at the Old Pier from day 3: Starsalt, relic refining one for one, and the Shift fair on market nights.',
  },
  {
    id: 'the-anchorage', name: 'The Anchorage', keeper: 'merrow', hours: [7 * H, 19 * H],
    greeting: 'Licensed stone, licensed knots. Light calls the change; we answer it.',
    stock: [
      { item: 'anchor-stone', cond: STONES_SOLD },
      { item: 'still-knot' },
    ],
    buys: [], priceMult: 1, nightKeeper: null,
    text: 'The Mooring office on the quay. Provost Merrow sells anchor stones and Still Knots, and keeps the licence ledger.',
  },
  {
    id: 'cairnhold-clinic', name: 'Cairnhold Clinic', keeper: 'wynn-cobble', hours: [7 * H, 19 * H],
    greeting: 'Sit down, you\'ve come over the causeway. Stones, knots, Crackdust. And a salve for the walk back.',
    stock: [
      { item: 'anchor-stone', cond: STONES_SOLD },
      { item: 'still-knot' },
      { item: 'crackdust' },                              // stocked before the first mandatory Ward
      { item: 'salve' },
      { item: 'poultice' },
    ],
    buys: [], priceMult: 1, nightKeeper: null,
    text: 'The Mooring clinic at Knapp\'s End: Cairnhold granite cut into stones, Still Knots and Crackdust, under the memorial.',
  },
  {
    id: 'lantern-market', name: 'Lantern Market', keeper: 'dov', hours: [20 * H, 2 * H], fromDay: 7, cond: MARKET_NIGHT,
    greeting: 'Lots, lights and lucky crates! Bid with your heart, pay with your buttons.',
    stock: [
      { item: 'starsalt', qty: 3 },                       // Varga's stall; the daily Starsalt cap still holds
      { item: 'fruit-seedling', qty: 3 },                 // Ludo's seedlings
      { item: 'string-lights' },
      { item: 'disc-shardlight', rotate: 'market' },
      { item: 'disc-gale-cut', rotate: 'market' },
      { item: 'disc-sandtrap', rotate: 'market' },
      { item: 'disc-live-wire', rotate: 'market', cond: { badge: 2 } },
      { item: 'disc-stand-firm', rotate: 'market', cond: { flag: 'sp.first-market' } },
    ],
    rotations: { market: 1 },
    buys: [], priceMult: 1, nightKeeper: null,
    decor: { furniture: FURNITURE, clothes: CLOTHES, perDay: { furniture: 4, clothes: 2 } },
    auction: {
      festivalDay: 7, keeper: 'dov', script: 'dov-auction',
      lots: [
        { id: 'tarred-crate', name: 'The Tarred Crate', pool: ['disc-stand-firm'] },
        { id: 'salt-crate', name: 'The Salt-Stained Crate', pool: ['disc-cairn-crash', 'disc-hoarfrost', 'disc-drowned-bell'] },
        { id: 'rope-crate', name: 'The Rope-Bound Crate', pool: ['disc-sandtrap', 'disc-shardlight', 'disc-gale-cut', 'disc-live-wire'] },
      ],
      shuffleLots: true,                                  // which crate holds which pool is seeded (`shop:7`)
      openingBid: 800, bidStep: 100,
      rivalDropAt: [0.6, 0.9],                            // rivals fold between 60% and 90% of the disc's shelf price
      maxBidIsShelfPrice: true,                           // you never pay more than Pell's would charge
      text: 'Three sealed crates, one disc each. Dov won\'t say which. He will say "going, going" a great deal.',
    },
    text: 'Saturdays 20:00-02:00 on the green and the Old Pier: Varga\'s stall, Ludo\'s seedlings, string lights, and on day 7 Dov\'s sealed-crate auction.',
  },
  {
    id: 'archive-desk', name: 'Archive Desk', keeper: 'barnaby', hours: [9 * H, 19 * H],
    greeting: 'Ah! Bring it here. Into the light. Oh, that\'s a good one.',
    stock: [],
    buys: ['relic'], priceMult: 1, nightKeeper: null,
    duplicatesOnly: true,                                 // Barnaby buys a find only once it is pinned on the string wall
    skyglassPrice: 900,                                   // or refine it 1:1 at the Raft
    services: {
      identify: true,                                     // names a whole batch of finds at once
      memoryRelearn: { price: 0 },
      recall: { starsalt: 6, cond: { badge: 4 }, keeper: 'corin' },
    },
    bounty: { count: 3, mult: 1.5, dow: 0, pool: ['ammonite', 'belemnite', 'crinoid-stem', 'fossil-fern', 'urchin-cast', 'old-shape-skull', 'brass-tide-gauge', 'postmark-die', 'fleet-tally-token', 'cockle', 'razor-shell', 'sea-glass', 'cuttlebone', 'mermaids-purse', 'whelk-shell', 'lumpsucker', 'glimmer-sprat', 'starfly'] },
    text: 'Barnaby\'s desk under the string wall. He identifies finds in one batch, buys duplicates, posts a weekly Bounty, relearns forgotten moves for free; Corin runs Recall upstairs from badge 4.',
  },
  {
    id: 'consignment-crate', name: 'Consignment Crate', keeper: 'wren', hours: [0, 0],
    greeting: 'Leave it in the crate. It\'ll be buttons by morning.',
    stock: [],
    buys: [], priceMult: 1, nightKeeper: null,
    crate: { rate: 0.9, settlesAt: 6 * H, takesAnything: true },
    text: 'A co-op crate at your gate. Anything goes in; at 06:00 it pays 90% of value.',
  },
]);

export default SHOPS;
