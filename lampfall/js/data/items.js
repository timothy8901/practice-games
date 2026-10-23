/**
 * Every item row (GDD-02 Economy, from GDD-00 §7 Price list and §16 Items). [DATA-ECON]
 *
 * 26 items (3 wicks, 6 medicine, 2 cures, Crackdust, the Still Knot, 6 type tilts, 6 held items,
 * Isolde's Lantern) + 12 technique discs + 12 key items and tools + 9 keepsakes + 6 goods and wallet
 * rows = 65 rows, ids exactly as `data/ids.manifest.js` (ITEM_IDS, DISC_IDS, KEY_ITEM_IDS,
 * KEEPSAKE_IDS, GOODS_IDS). Fish, bugs, finds and fruit are collection rows (`data/collections.js`,
 * GDD-05), not items.
 *
 * Row fields (§14.12 plus the keys `systems/bag` and `systems/shops` read):
 *  - `pocket`: wicks | medicine | discs | finds | held | keepsakes | tools (state/schema POCKET_IDS).
 *  - `kind`: what the item is; shops sell goods kinds (tuning.fullPriceKinds) at full value.
 *  - `price` (what a shop charges at priceMult 1), `sell` (a spare sold back: 50%; goods sell at full
 *    price, so their `sell` equals `price`), `stack`, `oneOfAKind` (keepsakes only: always asks first).
 *  - `use`: a `systems/bag.USE_HANDLERS` key, with its parameters on the row: `amount` (heal / pp;
 *    absent = full), `fraction` (revive), `cures`, `turns` (ward-suppress), `type` (a tilt's type
 *    name), `move` (disc), `grade` (wick: the `tuning.lanternGrades` key it burns at).
 *  - `wallet`: 'starsalt' | 'anchors' marks a currency row (counted in the wallet, never a stack).
 *  - `held`: what a held item does in battle or on the Forecast (read by the battle and forecast lanes).
 *  - `buyable: false`: never on a shelf (discs won in story, tilts from the Workshop, keepsakes).
 *
 * Pure data; deep-frozen.
 * @module data/items
 */

/** @template T @param {T} o @returns {T} */
function freeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) freeze(v);
  }
  return o;
}

const half = (p) => Math.floor(p / 2);

/** A technique disc row: reusable, 50% back when spare; `price` 0 = never sold. */
const disc = (id, name, move, price, text) => ({
  id, name, pocket: 'discs', kind: 'disc', price, sell: half(price), stack: 1, use: 'disc', move,
  oneOfAKind: false, buyable: price > 0, text,
});

/** A type tilt: a polished skyglass relic (Workshop), held; forms of its type weigh ×2 on every card. */
const tilt = (id, type, name, text) => ({
  id, name, pocket: 'held', kind: 'tilt', price: 1800, sell: 900, stack: 3, use: 'hold', type,
  held: { forecastTypeMult: 2, type }, oneOfAKind: false, buyable: false, text,
});

/** A key item or tool: never sold, never spent. */
const key = (id, name, text, extra = {}) => ({
  id, name, pocket: 'tools', kind: 'key', price: 0, sell: 0, stack: 1, use: 'key', oneOfAKind: false, buyable: false, text, ...extra,
});

/** A keepsake: one of a kind, asks before it is spent, never sold. */
const keepsake = (id, name, text, extra = {}) => ({
  id, name, pocket: 'keepsakes', kind: 'keepsake', price: 0, sell: 0, stack: 1, use: null, oneOfAKind: true, buyable: false, text, ...extra,
});

/** @type {ReadonlyArray<import('./index.js').Item & Record<string, any>>} */
export const ITEMS = freeze([
  // ---- wicks (one burns per raise of the Keeper's Lantern) ---------------------------------------
  { id: 'tallow-wick', name: 'Tallow Wick', pocket: 'wicks', kind: 'wick', price: 100, sell: 50, stack: 50, use: 'capture:1', grade: 'capture:1', oneOfAKind: false,
    text: 'Co-op tallow. Burns one raise at the odds you see. Smells faintly of supper.' },
  { id: 'brass-wick', name: 'Brass Wick', pocket: 'wicks', kind: 'wick', price: 300, sell: 150, stack: 50, use: 'capture:2', grade: 'capture:2', oneOfAKind: false,
    text: 'A wick in a brass collar. One and a half times the odds, and it doesn\'t gutter in wind.' },
  { id: 'skyglass-wick', name: 'Skyglass Wick', pocket: 'wicks', kind: 'wick', price: 600, sell: 300, stack: 50, use: 'capture:3', grade: 'capture:3', oneOfAKind: false,
    text: 'Threaded with skyglass dust. Doubles the odds; the flame hums the same note as the mark.' },

  // ---- medicine (in battle, each heal spends one of the creature's three Mends) ------------------
  { id: 'salve', name: 'Salve', pocket: 'medicine', kind: 'medicine', price: 80, sell: 40, stack: 20, use: 'heal', amount: 25, oneOfAKind: false,
    text: 'Restores 25 HP. Juniper\'s own recipe; she won\'t say what\'s in it, only that it isn\'t fish.' },
  { id: 'tonic', name: 'Tonic', pocket: 'medicine', kind: 'medicine', price: 240, sell: 120, stack: 20, use: 'heal', amount: 70, oneOfAKind: false,
    text: 'Restores 70 HP. Bitter, brown, and in a bottle older than the bottle\'s label.' },
  { id: 'full-salve', name: 'Full Salve', pocket: 'medicine', kind: 'medicine', price: 600, sell: 300, stack: 20, use: 'heal', oneOfAKind: false,
    text: 'Restores all HP. A whole tin, so don\'t be shy with it.' },
  { id: 'revive', name: 'Revive', pocket: 'medicine', kind: 'medicine', price: 600, sell: 300, stack: 20, use: 'revive', fraction: 0.5, oneOfAKind: false,
    text: 'Wakes a fainted creature at half its HP. Smelling salts, a warm cloth, a kind word.' },
  { id: 'ether', name: 'Ether', pocket: 'medicine', kind: 'medicine', price: 250, sell: 125, stack: 20, use: 'pp', amount: 10, oneOfAKind: false,
    text: 'Restores 10 PP to each move. Stocked at Pell\'s from the third badge.' },
  { id: 'full-ether', name: 'Full Ether', pocket: 'medicine', kind: 'medicine', price: 700, sell: 350, stack: 20, use: 'pp', oneOfAKind: false,
    text: 'Restores every move\'s PP in full. For the long climbs.' },

  // ---- cures -----------------------------------------------------------------------------------
  { id: 'poultice', name: 'Poultice', pocket: 'medicine', kind: 'cure', price: 150, sell: 75, stack: 20, use: 'cure', cures: ['burn', 'poison'], oneOfAKind: false,
    text: 'Cures a burn or poison. Cool, green and wrapped in a dock leaf.' },
  { id: 'warm-shawl', name: 'Warm Shawl', pocket: 'medicine', kind: 'cure', price: 150, sell: 75, stack: 20, use: 'cure', cures: ['chill', 'numb'], oneOfAKind: false,
    text: 'Cures chill or numb. Knitted on the post office step by somebody patient.' },

  // ---- battle ------------------------------------------------------------------------------------
  { id: 'crackdust', name: 'Crackdust', pocket: 'medicine', kind: 'battle', price: 300, sell: 150, stack: 20, use: 'ward-suppress', turns: 3, oneOfAKind: false,
    text: 'Thrown at a Ward, it cracks the lattice for three turns. No Ward, no throw: you keep it.' },
  { id: 'still-knot', name: 'Still Knot', pocket: 'held', kind: 'held', price: 2000, sell: 1000, stack: 3, use: 'hold', held: { blocksShift: true }, oneOfAKind: false,
    text: 'A Mooring knot in tarred cord. Held, it lets every window pass unused. Held by Still Knot.' },

  // ---- type tilts (Workshop: a skyglass relic polished overnight) --------------------------------
  tilt('tilt-brine', 'Brine', 'Brine Tilt', 'Polished skyglass with a tide inside. Held: Brine forms weigh double on every card.'),
  tilt('tilt-stone', 'Stone', 'Stone Tilt', 'Skyglass set in Cairnhold granite. Held: Stone forms weigh double on every card.'),
  tilt('tilt-glass', 'Glass', 'Glass Tilt', 'A clear lens that rings when tapped. Held: Glass forms weigh double on every card.'),
  tilt('tilt-gust', 'Gust', 'Gust Tilt', 'A feather-light shard that won\'t sit still. Held: Gust forms weigh double on every card.'),
  tilt('tilt-hollow', 'Hollow', 'Hollow Tilt', 'Dark glass that holds the lamplight a beat too long. Held: Hollow forms weigh double on every card.'),
  tilt('tilt-kiln', 'Kiln', 'Kiln Tilt', 'Warm to the touch, always. Held: Kiln forms weigh double on every card.'),

  // ---- held items ------------------------------------------------------------------------------
  { id: 'whetstone', name: 'Whetstone', pocket: 'held', kind: 'held', price: 1200, sell: 600, stack: 3, use: 'hold', held: { critStages: 1 }, oneOfAKind: false,
    text: 'Held: hits find the soft spot more often (+1 crit stage). Ansel\'s old one, by the look of it.' },
  { id: 'cork-float', name: 'Cork Float', pocket: 'held', kind: 'held', price: 1500, sell: 750, stack: 3, use: 'hold', held: { endureFromFull: true, perBattle: 1 }, oneOfAKind: false,
    text: 'Held: once a battle, a hit from full HP leaves it bobbing at 1 HP instead of under.' },
  { id: 'oilskin', name: 'Oilskin', pocket: 'held', kind: 'held', price: 1200, sell: 600, stack: 3, use: 'hold', held: { chipMult: 0.5 }, oneOfAKind: false,
    text: 'Held: burn, poison and trap chip it for half. Everything runs off.' },
  { id: 'ballast-stone', name: 'Ballast Stone', pocket: 'held', kind: 'held', price: 1200, sell: 600, stack: 3, use: 'hold', held: { startStages: { def: 1, spd: 1, spe: -1 } }, oneOfAKind: false,
    text: 'Held: starts each battle a stage steadier in Defence and Sp. Defence, a stage slower.' },
  { id: 'lucky-button', name: 'Lucky Button', pocket: 'held', kind: 'held', price: 2000, sell: 1000, stack: 3, use: 'hold', held: { payoutMult: 1.5 }, oneOfAKind: false,
    text: 'Held: +50% buttons from any trainer battle it took part in. Brass, with four holes and a wink.' },
  { id: 'tally-charm', name: 'Tally Charm', pocket: 'held', kind: 'held', price: 1500, sell: 750, stack: 3, use: 'hold', held: { benchShare: 1 }, oneOfAKind: false,
    text: 'Held: earns full EXP from the bench instead of 60%. A tiny notched stick on a cord.' },

  // ---- the heirloom ----------------------------------------------------------------------------
  keepsake('isoldes-lantern', 'Isolde\'s Lantern',
    'The last keeper\'s own lantern. One sure catch, ever. It always asks first, and the cursor starts on No.',
    { use: 'sure-catch', kind: 'lantern' }),

  // ---- technique discs (reusable) ----------------------------------------------------------------
  disc('disc-spore-drift', 'Disc: Spore Drift', 'spore-drift', 1500, 'Teaches Spore Drift: a slow poison that chips through a Ward. On Pell\'s shelf by the first badge.'),
  disc('disc-sandtrap', 'Disc: Sandtrap', 'sandtrap', 1500, 'Teaches Sandtrap: traps the foe and chips it every turn. Patience in a disc.'),
  disc('disc-flashover', 'Disc: Flashover', 'flashover', 2500, 'Teaches Flashover: a Kiln blast for the gap in your coverage.'),
  disc('disc-cairn-crash', 'Disc: Cairn Crash', 'cairn-crash', 2500, 'Teaches Cairn Crash: a Stone strike with the whole quarry behind it.'),
  disc('disc-hoarfrost', 'Disc: Hoarfrost', 'hoarfrost', 2500, 'Teaches Hoarfrost: a Rime chill that settles in and stays.'),
  disc('disc-drowned-bell', 'Disc: Drowned Bell', 'drowned-bell', 3500, 'Teaches Drowned Bell: a Hollow toll from somewhere under the bar.'),
  disc('disc-shardlight', 'Disc: Shardlight', 'shardlight', 2000, 'Teaches Shardlight: a Glass beam that bends where you point it.'),
  disc('disc-live-wire', 'Disc: Live Wire', 'live-wire', 3000, 'Teaches Live Wire: a Bolt strike that crackles on contact.'),
  disc('disc-gale-cut', 'Disc: Gale Cut', 'gale-cut', 2000, 'Teaches Gale Cut: a Gust edge, thin as a gull\'s wing.'),
  disc('disc-stand-firm', 'Disc: Stand Firm', 'stand-firm', 2000, 'Teaches Stand Firm: plant your feet and take it. First seen in one of Dov\'s sealed crates.'),
  disc('disc-gnash', 'Disc: Gnash', 'gnash', 0, 'Teaches Gnash. Linnet\'s, scratched with her initials. Given at the Shardcrown gate, win or lose.'),
  disc('disc-plumbline', 'Disc: Plumbline', 'plumbline', 0, 'Teaches Plumbline: clears every stage and steadies the foe. Seraphine\'s answer to her own Spire.'),

  // ---- key items and tools ---------------------------------------------------------------------
  key('keepers-lantern', 'Keeper\'s Lantern', 'Co-op issue. Finds your door. Finds other things; ask the owl. Each raise burns one wick.'),
  key('reading-glass', 'Reading Glass', 'Isolde\'s old loupe. Names finds, Reads creatures, opens Forecasts. Look before you swing.'),
  key('scouting-prism', 'Scouting Prism', 'Clipped to the Glass by Corin at the third badge. Read now shows moves, held item and Mends left.'),
  key('weatherglass', 'Weatherglass', 'A storm-glass on a strap. Shows isle weather and Errants on the map. The fifth badge\'s gift.'),
  key('rod', 'Rod', 'Split cane and a cork grip. Cast, feint, feint, bite.'),
  key('net', 'Net', 'For bugs, and for bee nests if you listen for the hum.'),
  key('shovel', 'Shovel', 'For cracks, sparkles and the Glint. Mind the cockles.'),
  key('grafting-knife', 'Grafting Knife', 'A curved blade for the Greenhouse bench. Foreign fruit, one patient cut at a time.'),
  key('string-lights', 'String Lights', 'A coil of little lamps. Hang them anywhere: moths come, bugs come, neighbours come.', { price: 1500, buyable: true }),
  key('ration-ledger', 'Ration Ledger', 'Hollis\'s checklist for the Long Road: PP, medicine, wicks. He ticks it twice.'),
  key('errands-clipboard', 'Errands Clipboard', 'Wick\'s list for your first night: six errands, five hundred off loan 1 each, any order.'),
  key('mail-sack', 'Mail Sack', 'Thirty years of post in one sack. Heavier than it looks. Hesper is waiting.'),

  // ---- keepsakes and heirlooms ---------------------------------------------------------------------
  keepsake('dorrow-kettle', 'The Dorrows\' Kettle', 'A dented copper kettle from Juniper\'s back room. Home to the Dorrow burrow, and their porch lights.'),
  keepsake('brack-still-knot', 'The Bracks\' Still Knot', 'Tamsin\'s family knot, tarred black. Works as a Still Knot; it asks before it\'s tied on.', { use: 'hold', held: { blocksShift: true }, kind: 'held' }),
  keepsake('grade-two-lantern', 'Grade-Two Lantern', 'A brass lantern from the Warden\'s house, returned by letter. Too handsome to burn wicks in.'),
  keepsake('bryony-seed-tin', 'Bryony\'s Seed Tin', 'Her grandmother\'s bean seeds, still rattling. Home to Bryony, and her porch lights.'),
  keepsake('odile-easel', 'Grandmother\'s Easel', 'A folding easel, paint on every joint. Home to Odile, and her porch lights.'),
  keepsake('thessaly-almanac', 'Thessaly\'s Almanac', 'Thirty years of tide notes in a bilby\'s hand. Home to Thessaly, and her porch lights.'),
  keepsake('tully-sweatband', 'Tully\'s Sweatband', 'Given after the Mudlark Mile, win or lose. Still damp. He insists that\'s tradition.'),
  keepsake('oyster-boat-nameboard', 'Oyster Boat Nameboard', 'Read out of Kettle the Creelwight on Drownwood. The Bracks\' boat name, in flaking gold.'),
  keepsake('fleet-bell', 'The Fleet\'s Bell', 'Dug from the Old Quay at a spring low. Barnaby has opinions about where it should live.'),

  // ---- goods and wallet rows -----------------------------------------------------------------------
  { id: 'starsalt', name: 'Starsalt', pocket: 'finds', kind: 'currency', wallet: 'starsalt', price: 800, sell: 0, stack: 99, use: null, oneOfAKind: false,
    text: 'Refined skyglass dust. Pays for Rerolls and Recall, nothing else. Never sold back. Three a day, shared between the Raft and Ludo.' },
  { id: 'anchor-stone', name: 'Anchor Stone', pocket: 'finds', kind: 'currency', wallet: 'anchors', price: 500, sell: 0, stack: 99, use: null, oneOfAKind: false,
    text: 'Cairnhold granite, cut by Osric, licensed by the Mooring. Spend one to refuse a window.' },
  { id: 'honeycomb', name: 'Honeycomb', pocket: 'finds', kind: 'honey', price: 350, sell: 350, stack: 10, use: null, oneOfAKind: false,
    text: 'Netted from a bee tree after the hum. Ludo pays full price and licks his thumb.' },
  { id: 'timber', name: 'Timber', pocket: 'finds', kind: 'timber', price: 120, sell: 120, stack: 20, use: null, oneOfAKind: false,
    text: 'Storm branches and old stumps. Ambrose can tell the tree by the smell.' },
  { id: 'moth-silk', name: 'Moth-silk', pocket: 'finds', kind: 'silk', price: 450, sell: 450, stack: 20, use: null, oneOfAKind: false,
    text: 'Fine as breath, gathered under the porch lamps. Ludo trades in it and won\'t say who buys.' },
  { id: 'fruit-seedling', name: 'Fruit Seedling', pocket: 'finds', kind: 'seedling', price: 2000, sell: 1000, stack: 5, use: null, oneOfAKind: false,
    plants: ['peach', 'fig', 'apricot', 'mulberry'],
    text: 'A foreign fruit tree in a pot: peach, fig, apricot or mulberry. Plant it and wait three days.' },
]);

export default ITEMS;
