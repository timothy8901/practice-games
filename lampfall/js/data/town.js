/**
 * Town life: trees, the shop catalogue (furniture, clothes, roofs), the commissions' town-side
 * text, the Commons projects, the four festivals, the Porch Duel slate, the Crossovers table,
 * weather, the Day Page and the 24 journal stamps (GDD-00 §5–§9, §16; GDD-ids §15–§16).
 * [GDD-05 TOWN LIFE]
 *
 * Table shapes follow what the town systems already read:
 *  - `CREATURE_BONUSES` is `tuning.creatureBonuses` (systems/fieldLog `LeadBonus` keys only);
 *  - `COMMONS_PROJECTS` / `COMMISSIONS` add town effects and scenes to economy's loans.js rows
 *    (same ids; cost, share, names and card text stay in loans.js);
 *  - `FESTIVALS` rows are systems/schedule `FestivalRow`s (`data.festivals`) plus events and rewards
 *    (`dow` there counts 0 = Monday, so Saturday is 5);
 *  - `WEATHER` rows are systems/weather `WeatherKind`s (`data.weather`); `WEATHER_TUNING` holds the
 *    `WEATHER_WEIGHTS` / `WEATHER_EFFECTS` values for `data/tuning.js`;
 *  - `TOMORROW` templates are keyed by systems/dayPage `TOMORROW_ORDER` kinds.
 * Every `cond` is the §6.4 DSL (js/script/cond.js). Prices are buttons (◉). Templates use the
 * `data/strings` `{name}` / `{n|one|many}` placeholders.
 *
 * Economy owns `loans.js` (amounts, ladder) and `tuning.js`; the cast chapter owns NPC lines; the
 * battle chapter owns the `porch-*` trainer rosters. This file only names them.
 *
 * Pure data; frozen.
 * @module data/town
 */

import { deepFreeze } from './ids.js';
import { COLORS } from '../art/palette.js';

// ---------------------------------------------------------------------------------------------
// Trees, purses and bees (GDD-00 §9 Trees, §7 income)
// ---------------------------------------------------------------------------------------------

/**
 * Orchard rules and where Pellwick's ~100 trees stand. The seed picks one native fruit for the
 * town (stream `worldgen`, from `nativePool`); every grove tree bears it. The four other native
 * fruits grow on three garden trees each in neighbours' yards, so all five natives are always in
 * town. Foreign fruit comes only from grafts, market seedlings and gifts.
 */
export const TREES = deepFreeze({
  nativePool: ['pear', 'plum', 'apple', 'cherry', 'quince'],
  foreign: ['peach', 'fig', 'apricot', 'mulberry'],
  fruitPerTree: 3,
  fruitPerPress: 1,
  regrowDays: 2,
  ripeDays: 3,
  ripeMult: 1.25,
  purse: { range: [200, 600], step: 50, perTreePerDay: 1, trees: 6 },
  bees: {
    trees: 4, nestsPerTreePerDay: 1, humMs: 1000, honeycomb: 'honeycomb', honeycombPrice: 350,
    warning: 'A one-second hum and gold specks drifting down before the nest drops.',
    offer: 'With the net on the tool ring, the game offers it the moment the hum starts.',
    miss: 'Three cartoon bees orbit your head for one game hour. Nothing is lost; neighbours laugh, kindly.',
    gust: 'A Gust lead blows the nest clear: honeycomb, no sting, no net needed.',
  },
  shells: { chance: 0.15, from: ['whelk-shell', 'cockle'], trees: 'quay-gardens and point-orchard trees (the gulls drop them)' },
  groves: [
    { id: 'point-orchard', name: 'The Point Orchard', where: 'behind the Keeper\'s Cottage, along the point path', trees: 18, purse: 1, bees: 0, shells: true },
    { id: 'long-orchard', name: 'The Long Orchard', where: 'north of the green, down to the river', trees: 26, purse: 2, bees: 1, shells: false },
    { id: 'green-rows', name: 'The Green Rows', where: 'around the green and the Commons board', trees: 12, purse: 1, bees: 0, shells: false },
    { id: 'river-walk', name: 'The River Walk', where: 'both banks from the bridge to the stepping stones', trees: 14, purse: 1, bees: 1, shells: false },
    { id: 'quay-gardens', name: 'The Quay Gardens', where: 'behind the quay houses and the Anchorage', trees: 10, purse: 0, bees: 1, shells: true },
    { id: 'weir-copse', name: 'The Weir Copse', where: 'by the weir and the empty north creek', trees: 8, purse: 1, bees: 1, shells: false },
    { id: 'garden-trees', name: 'Neighbours\' Garden Trees', where: 'three each in Bryony\'s, Tully\'s, Odile\'s and Thessaly\'s yards; the four natives that are not the town\'s', trees: 12, purse: 0, bees: 0, shells: false },
  ],
  text: 'A press shakes one fruit; three to a tree. Stripped trees regrow in two days and ripen a day after that: a blush and a fuller shape, never colour alone, and 25% more at the counter. Leaving fruit on the tree is a choice.',
});

// ---------------------------------------------------------------------------------------------
// Furniture (24), clothes (12), roof colours (8)
// ---------------------------------------------------------------------------------------------

/**
 * Furniture rows. `source`: pells (rotating stock, 3 pieces a day), market (Lantern Market and the
 * third stall), ambrose (carved from your timber over two nights, `timber` logs instead of buttons),
 * gift. `size` in tiles [w, h]. `survivesCut`: the first twelve survive cut-order 14.
 */
export const FURNITURE = deepFreeze([
  { id: 'driftwood-bench', name: 'Driftwood Bench', price: 600, timber: 4, source: ['ambrose', 'pells'], size: [2, 1], survivesCut: true,
    text: 'Silvered planks off the point flats. Ambrose tags it with where the wood washed up.' },
  { id: 'net-hammock', name: 'Net Hammock', price: 900, source: ['pells'], size: [2, 1], survivesCut: true,
    text: 'An old seine net strung between two hooks. Sways when the door opens.' },
  { id: 'sea-chest', name: 'Sea Chest', price: 1200, source: ['pells', 'market'], size: [1, 1], survivesCut: true,
    text: 'A brass-cornered chest with a name scratched out of the lid. Holds blankets now.' },
  { id: 'chart-table', name: 'Chart Table', price: 2400, source: ['pells'], size: [2, 1], survivesCut: true,
    text: 'A slope-topped table with the Brindle Isles inked into the wood, the Bar drawn twice.' },
  { id: 'barometer-clock', name: 'Barometer Clock', price: 1800, source: ['pells'], size: [1, 1], survivesCut: true,
    text: 'Twin dials on one board: the hour and the glass. Ansel taps it when he visits.' },
  { id: 'rag-rug', name: 'Rag Rug', price: 400, source: ['pells', 'market'], size: [2, 2], survivesCut: true,
    text: 'Braided from old jumpers. One stripe is unmistakably lighthouse.' },
  { id: 'creel-stool', name: 'Creel Stool', price: 200, source: ['pells'], size: [1, 1], survivesCut: true,
    text: 'An upturned lobster creel with a cushion tied on. Wobbles exactly once.' },
  { id: 'bottle-shelf', name: 'Bottle Shelf', price: 700, source: ['pells'], size: [1, 1], survivesCut: true,
    text: 'A shelf of sea-glass bottles that throw green light across the floor at noon.' },
  { id: 'brass-bedstead', name: 'Brass Bedstead', price: 4200, source: ['pells'], size: [2, 2], survivesCut: true,
    text: 'Knobbed brass ends polished by somebody\'s grandmother. Creaks a lullaby.' },
  { id: 'rocking-chair', name: 'Rocking Chair', price: 1500, timber: 6, source: ['ambrose', 'pells'], size: [1, 1], survivesCut: true,
    text: 'Ambrose carves the rockers by touch. It rocks in time with the tide if you let it.' },
  { id: 'pot-belly-stove', name: 'Pot-belly Stove', price: 3000, source: ['pells'], size: [1, 1], survivesCut: true,
    text: 'Squat black iron with a kettle shelf. Dimity approves of anything warm.' },
  { id: 'fern-planter', name: 'Fern Planter', price: 350, source: ['pells', 'market'], size: [1, 1], survivesCut: true,
    text: 'A cracked crock of ferns from the weir copse. Thrives on being ignored.' },
  { id: 'oar-rack', name: 'Oar Rack', price: 800, timber: 3, source: ['ambrose'], size: [1, 1], survivesCut: false,
    text: 'Pegs for oars Pellwick no longer has. Wren says hang hope on it.' },
  { id: 'figurehead', name: 'Figurehead', price: 5200, source: ['market'], size: [1, 2], survivesCut: false,
    text: 'A carved gull from a lost-fleet bow, sold at the market by someone who will not say how.' },
  { id: 'buoy-lamp', name: 'Buoy Lamp', price: 1600, source: ['market'], size: [1, 1], survivesCut: false,
    text: 'A red channel buoy wired into a lamp. Hung on the porch it counts as string lights: moths come.' },
  { id: 'wheel-table', name: 'Wheel Table', price: 2800, timber: 8, source: ['ambrose', 'market'], size: [2, 2], survivesCut: false,
    text: 'A ship\'s wheel laid flat under glass. Coffee cups sit between the spokes.' },
  { id: 'cork-board', name: 'Cork Board', price: 500, source: ['pells'], size: [1, 1], survivesCut: false,
    text: 'Pin your own notices. Barnaby leaves a provenance card on it when he visits.' },
  { id: 'tide-clock', name: 'Tide Clock', price: 2000, source: ['pells'], size: [1, 1], survivesCut: false,
    text: 'One hand, two lows a day. Reads the next low from your armchair.' },
  { id: 'nesting-basket', name: 'Nesting Basket', price: 450, source: ['pells', 'market'], size: [1, 1], survivesCut: false,
    text: 'A deep wicker basket. Whoever leads your party naps in it when you are home.' },
  { id: 'field-guide-shelf', name: 'Field-guide Shelf', price: 1100, source: ['pells'], size: [1, 1], survivesCut: false,
    text: 'Fills with a spine for every Field Log plate you have Held. Corin runs a claw along it.' },
  { id: 'map-chest', name: 'Map Chest', price: 2600, source: ['market'], size: [2, 1], survivesCut: false,
    text: 'Shallow drawers of isle charts. The top drawer is the ring of six; the bottom one is blank.' },
  { id: 'float-chandelier', name: 'Float Chandelier', price: 3600, source: ['market'], size: [2, 2], survivesCut: false,
    text: 'Glass net floats hung in a ring with candles. Casts little moons on the ceiling.' },
  { id: 'patchwork-bed', name: 'Patchwork Bed', price: 2200, source: ['pells', 'market'], size: [2, 2], survivesCut: false,
    text: 'A quilt of every neighbour\'s scraps. You can find Tully\'s sweatband stripe if you look.' },
  { id: 'lamp-room-model', name: 'Lamp-room Model', price: 6000, timber: 12, source: ['ambrose'], size: [1, 1], survivesCut: false,
    cond: { flag: 'sp.relighting' },
    text: 'Ambrose\'s scale model of the Lamp Room, carved after the Relighting from memory and touch. The lens turns.' },
]);

/** Clothes rows: `slot` top | bottom | shoes | hat | accessory; `source` starter | errands | pells | market | gift. */
export const CLOTHES = deepFreeze([
  { id: 'lighthouse-jumper', name: 'Lighthouse-stripe Jumper', slot: 'top', price: 0, source: ['starter'],
    text: 'Red and cream stripes, darned at one elbow. The jumper you walked in wearing.' },
  { id: 'coop-apron', name: 'Co-op Apron', slot: 'top', price: 0, source: ['errands'],
    text: 'Wren\'s spare apron, pockets full of sawdust. Worn for errands; it goes on by itself.' },
  { id: 'oilskin-jacket', name: 'Oilskin Jacket', slot: 'top', price: 1800, source: ['pells'],
    text: 'Yellow oilskin that crackles when you shrug. Rain beads and runs off.' },
  { id: 'sou-wester', name: 'Sou\'wester', slot: 'hat', price: 600, source: ['pells'],
    text: 'The hat with the long back brim, for weather that comes in sideways.' },
  { id: 'tide-boots', name: 'Tide Boots', slot: 'shoes', price: 900, source: ['pells'],
    text: 'Knee-high rubber boots with a tide-line stain halfway up. Squelch faithfully.' },
  { id: 'cable-cardigan', name: 'Cable Cardigan', slot: 'top', price: 1400, source: ['market'],
    text: 'Thick cream cables and horn buttons. Smells faintly of somebody else\'s woodsmoke.' },
  { id: 'watch-cap', name: 'Watch Cap', slot: 'hat', price: 400, source: ['pells'],
    text: 'A rolled knit cap for night watches. Wick wears his pushed back; so can you.' },
  { id: 'wader-overalls', name: 'Wader Overalls', slot: 'bottom', price: 1600, source: ['pells'],
    text: 'Chest waders with braces. For the flats, the creek and the Old Quay at a spring low.' },
  { id: 'ferry-scarf', name: 'Ferry Scarf', slot: 'accessory', price: 0, source: ['gift'], cond: { badge: 2 },
    text: 'Maud\'s spare scarf, given the day the ferry goes free. "Keeps the spray out. Always confirm."' },
  { id: 'keepers-coat', name: 'Keeper\'s Coat', slot: 'top', price: 0, source: ['gift'], cond: { flag: 'sp.relighting' },
    text: 'Isolde\'s old watch coat from Juniper\'s back room, relined. It fits. Of course it fits.' },
  { id: 'market-wrap', name: 'Market Wrap', slot: 'accessory', price: 1200, source: ['market'],
    text: 'A big woven shawl in harbor colours, bought by lantern light on a Saturday.' },
  { id: 'comet-brooch', name: 'Comet Brooch', slot: 'accessory', price: 3000, source: ['market'],
    text: 'A brass pin set with one skyglass bead. It hums, very quietly, when your partner Shifts.' },
]);

/**
 * Roof colours for the Payment Ceremony swatches. `ramp` names the palette keys
 * [dark, shade, base, light] in js/art/palette.COLORS; `hexes` are those values. `artKey` is the
 * art lane's roof tile key (`roof-<artKey>-*`); heather has no roof tiles yet (manifest request).
 */
const ROOF_DEFS = [
  { id: 'slate-blue', name: 'Slate Blue', artKey: 'slate', ramp: ['slate0', 'slate1', 'slate2', 'slate3'], isDefault: true,
    text: 'Cairnhold slate, blue in the rain. Wren\'s cursor rests here first.' },
  { id: 'ochre', name: 'Ochre', artKey: 'ochre', ramp: ['ochre0', 'ochre1', 'ochre2', 'ochre3'],
    text: 'Warm clay tiles that hold the afternoon. Lovely from the Lamp Room.' },
  { id: 'harbor-red', name: 'Harbor Red', artKey: 'red', ramp: ['red0', 'red1', 'red2', 'red3'],
    text: 'The red of the old channel buoys. Seen from every boat that comes home.' },
  { id: 'moss', name: 'Moss', artKey: 'moss', ramp: ['moss0', 'moss1', 'moss2', 'moss3'],
    text: 'Green as the weir copse. It will grow real moss by spring; Bryony says that is a compliment.' },
  { id: 'sea-blue', name: 'Sea Blue', artKey: 'blue', ramp: ['blue0', 'blue1', 'blue2', 'blue3'],
    text: 'Deep harbor blue. The Thatch say it is the hardest colour to tie off neatly.' },
  { id: 'straw', name: 'Straw', artKey: 'straw', ramp: ['straw0', 'straw1', 'straw2', 'straw3'],
    text: 'Pale thatch gold. The finches like this one best and build a little extra.' },
  { id: 'tar', name: 'Tar', artKey: 'dark', ramp: ['dark0', 'dark1', 'dark2', 'dark3'],
    text: 'Tarred black, like the old net lofts. Makes a lit window look twice as warm.' },
  { id: 'heather', name: 'Heather', artKey: null, ramp: ['he0', 'he1', 'he2', 'he3'],
    text: 'Dusky moor purple from Thistlewind. Quiet by day, soft as a bruise at dusk.' },
];
export const ROOF_COLOURS = deepFreeze(ROOF_DEFS.map((r) => ({ ...r, isDefault: r.isDefault === true, hexes: r.ramp.map((k) => COLORS[k]) })));

// ---------------------------------------------------------------------------------------------
// Room commissions: the scenes around them (economy owns names, effects and Wren's card pitch in
// loans.js COMMISSIONS)
// ---------------------------------------------------------------------------------------------

/** What Wren says aloud when you pick each room, and the 05:40 dawn-build vignette the morning after. */
export const COMMISSIONS = deepFreeze([
  { id: 'training-yard',
    offer: 'A chalked yard out back. Tully\'s already asked if he can use it. I said ask the Keeper.',
    morning: 'The Thatch tied off a little lean-to over the yard gate. Tully is already doing laps.' },
  { id: 'workshop',
    offer: 'A bench, a vice and a window. Fossils come off it cleaner, and Barnaby will want to borrow it.',
    morning: 'Sawdust on the step, a vice bolted to the bench, and a fossil-shaped space waiting.' },
  { id: 'greenhouse',
    offer: 'Glass on the south wall. Foreign fruit on native roots, and somewhere warm for your partner to sleep.',
    morning: 'The panes are fogged with warmth. One pot already has a seedling in it that you did not plant. Wren did.' },
  { id: 'cellar',
    offer: 'Dig down, not out. Cold storage, a safe shelf for the things that matter, and room for twenty more friends.',
    morning: 'A trapdoor in the floor and a cool breath coming up it. The Keepsakes shelf has a lock only you open.' },
  { id: 'porch-loft',
    offer: 'A second seat on the porch and a loft above it. Two neighbours a night, and a telescope.',
    morning: 'A wider porch, a second chair, and a brass telescope pointed at the lagoon.' },
  { id: 'gallery',
    offer: 'One long wall with good light. Odile will cry. Barnaby will label everything.',
    morning: 'A long white wall with picture rails and one small brass label already on it: your name.' },
]);

// ---------------------------------------------------------------------------------------------
// Commons projects: the town effects (economy owns cost, neighbour share and the board slip in
// loans.js COMMONS)
// ---------------------------------------------------------------------------------------------

/**
 * What each funded project changes in town, as machine keys the owning systems read, plus the
 * scene that plays and the line the Day Page writes the morning it opens. Funding also sets
 * `sys.commons.<id>` (systems/loans). Effects are bonuses, never locks: the race, the market and
 * the creek all work without them.
 */
export const COMMONS_PROJECTS = deepFreeze([
  { id: 'dark-house-1', cond: { flag: 'sp.raft-docked' }, script: 'tamsin-arrives',
    effect: { porch: 'porch-dark-1', npc: 'tamsin' },
    built: 'Tamsin Brack walked across the causeway at dusk with one bag and a rake. Porch 1 is lit.' },
  { id: 'quay-lamps',
    effect: { extraNightShadows: 1, reaches: ['quay'], litBugSpots: 6 },
    built: 'Six lamps on the quay: one more shadow on each quay reach after dark, and six new lit spots for moths.' },
  { id: 'mudlark-mile-flags',
    effect: { springLowRoute: 'point-flats', festival: 'mudlark-mile', crowd: true },
    built: 'Flags across the point flats. At every spring low they mark the firmest dry line, and on race day the whole town turns out.' },
  { id: 'north-creek-footbridge',
    effect: { shortcut: ['the green', 'Ansel\'s launch', 'the weir'], anyTide: true },
    built: 'A plank bridge over the north creek to Ansel\'s launch and the weir, dry at any tide. Ansel fishes from it now.' },
  { id: 'training-yard-green', cond: { badge: 5 },
    effect: { yardShare: 0.25, storedCreatures: 3, npc: 'tully' },
    built: 'A chalked yard on the green: three stored creatures earn 25% of party EXP, same as the room. Tully runs it at dawn.' },
  { id: 'third-stall',
    effect: { festival: 'lantern-market', extraStock: { furniture: 2, clothes: 2 } },
    built: 'A third stall on market nights: a guest trader off Maud\'s ferry with two more pieces of furniture and two of clothing.' },
]);

// ---------------------------------------------------------------------------------------------
// Festivals (4): systems/schedule FestivalRow + events and rewards
// ---------------------------------------------------------------------------------------------

/** Spring-tide days: every 7th day (Saturdays), the days the Old Quay is bared. */
const SPRING_DAYS = Object.freeze([7, 14, 21, 28, 35, 42, 49, 56, 63, 70]);

export const FESTIVALS = deepFreeze([
  {
    id: 'lantern-market', name: 'Lantern Market', dow: [5], fromDay: 7, from: 20 * 60, to: 2 * 60,
    where: 'the green and the Old Pier',
    text: 'Every Saturday from eight till two: string lights over the green, stalls down the Old Pier, the spring low glittering under it all.',
    events: [
      { id: 'varga-stall', text: 'Varga\'s stall: Starsalt (the day\'s three, shared with Ludo), relic refining, a Shift fair on the Raft.' },
      { id: 'ludo-seedlings', text: 'Ludo\'s seedlings: one foreign fruit seedling a week, and moth-silk.' },
      { id: 'string-lights', text: 'String lights sold and strung: moths and Prismoths come to the green.' },
      { id: 'third-stall', text: 'With the Commons third stall: a guest trader off Maud\'s ferry.', cond: { flag: 'sys.commons.third-stall' } },
      { id: 'first-market', text: 'The first market (day 7): Dov\'s sealed-crate disc auction and Varga hires you to call odds at the Shift fair.', script: 'first-lantern-market' },
      { id: 'dov-auction', text: 'Dov\'s sealed-crate auction: one technique disc, bids in buttons.', script: 'dov-auction' },
      { id: 'linnet-fall', text: 'The first market on or after badge 2: Linnet\'s fall at the Shift fair.', script: 'linnet-fall', cond: { badge: 2 } },
    ],
    rewards: [
      { stamp: 'market-night' },
      { text: 'Furniture, clothes and string lights you can buy nowhere else.' },
    ],
  },
  {
    id: 'mudlark-mile', name: 'Mudlark Mile', days: SPRING_DAYS, from: 6 * 60, to: 19 * 60,
    cond: { all: [{ thread: { id: 'mudlark-mile', beat: { gte: 4 } } }, { not: { thread: { id: 'mudlark-mile', done: true } } }, { lowTide: true }] },
    where: 'the point flats, from the cottage steps to the Bar marker and back',
    text: 'Tully\'s race across the point flats at a spring low. He swears he was never the slowest kid.',
    events: [
      { id: 'the-race', text: 'Your fastest creature paces Tully\'s Scrapling across the flats; win or lose, the race runs to the end.' },
      { id: 'the-crowd', text: 'Tamsin, Wick and Bryony cheer from the wrack line; Augusta keeps time on the barometer\'s second hand.' },
      { id: 'flags', text: 'With the Commons flags: the course is marked and the whole town lines it.', cond: { flag: 'sys.commons.mudlark-mile-flags' } },
    ],
    rewards: [
      { keepsake: 'tully-sweatband', text: 'Tully gives you his sweatband, win or lose.' },
      { text: 'Finishing The Mudlark Mile pays the resident share: one notch on Wren\'s stick.' },
      { stamp: 'tied-off', text: 'If it is your first finished life thread.' },
    ],
  },
  {
    id: 'long-night', name: 'The Long Night', from: 17 * 60, to: 6 * 60,
    cond: { all: [{ flag: 'sp.lamp-room-built' }, { not: { flag: 'sp.reading-done' } }] },
    where: 'the point, the lighthouse stair and the Lantern Stack',
    text: 'The dusk after the Lamp Room is built. Everybody comes out to the point.',
    events: [
      { id: 'lantern', text: '17:30: Juniper brings Isolde\'s Lantern and the Lantern letter up the point.' },
      { id: 'relighting', text: 'You light it from your own porch lamp and climb with Wick. The beam sweeps every roof; every lit porch pulses once; a horn answers with Your Signal.', script: 'the-relighting' },
      { id: 'crossing', text: 'The sea draws back. The shore party watches you cross to the Lantern Stack.', script: 'the-crossing' },
      { id: 'reading', text: 'The Reading: seven phases, one Forecast offered to you at the end.', script: 'the-reading' },
    ],
    rewards: [
      { stamp: 'the-long-night' },
      { stamp: 'the-reading' },
      { keepsake: 'isoldes-lantern', text: 'Isolde\'s Lantern: one sure catch, asked for with the cursor on No.' },
      { text: 'The six lit.* rules switch on; the porches of the dark houses begin to reopen, one a night.' },
    ],
  },
  {
    id: 'late-delivery-party', name: 'The Late Delivery Party', from: 18 * 60, to: 2 * 60,
    cond: { all: [{ flag: 'sp.late-delivery' }, { not: { seen: 'late-delivery-party' } }] },
    where: 'the green outside the post office',
    text: 'The evening the 56th letter arrives. Hesper declares the sack empty and the town throws her a party.',
    events: [
      { id: 'party', text: 'Hesper\'s counter becomes a buffet; every neighbour brings the letter that came to them and reads one line aloud.', script: 'late-delivery-party' },
      { id: 'string-wall', text: 'Barnaby brings the string wall out onto the green, every letter pinned, every string tied.' },
    ],
    rewards: [
      { stamp: 'late-delivery' },
      { text: 'Hesper starts bringing postcards from the Outer Isles instead.' },
    ],
  },
]);

// ---------------------------------------------------------------------------------------------
// The Porch Duel slate (GDD-00 §8 Porch Duels, §7 income)
// ---------------------------------------------------------------------------------------------

/**
 * Three friendly offers a day on the Commons board. Payout = 30 × the posted curve of your next
 * Spire (ace − 3), whoever the opponent is; nothing is lost; no calls. Opponents scale to your
 * party's median level. The battle chapter owns each `trainer` roster; this table owns who offers,
 * where, and when.
 */
export const PORCH_DUELS = deepFreeze({
  offersPerDay: 3,
  payoutPerCurveLevel: 30,
  hours: [19 * 60, 1 * 60],
  stream: 'shop:<day>/duels',
  scaling: 'party-median',
  /** Posted curve by badges held (next Spire's ace − 3; after six badges, the Summit's 47). */
  curveByBadges: [7, 13, 19, 26, 33, 40, 47],
  /** Opponent party size by badges held: 1 before badge 2, 2 until badge 4, then 3. */
  partySizeByBadges: [1, 1, 2, 2, 3, 3, 3],
  composition: 'Two neighbours and one visitor when any visitor is eligible, else three neighbours. No opponent twice a day; no neighbour three days running.',
  fallbackVenue: 'If the offering porch is dark, the duel is fought under the lamp by the Commons board on the green.',
  stakes: 'Friendly: nothing is lost, the party is healed after, and the clock pauses as in any battle.',
  neighbours: [
    { npc: 'wren', trainer: 'porch-wren', porch: 'porch-coop-yard', lead: 'scrapling', nickname: 'Peg' },
    { npc: 'tully', trainer: 'porch-tully', porch: 'porch-tully', lead: 'scrapling', nickname: null },
    { npc: 'juniper', trainer: 'porch-juniper', porch: 'porch-pells', lead: 'wirewhisk', nickname: null },
    { npc: 'odile', trainer: 'porch-odile', porch: 'porch-odile', lead: 'prismoth', nickname: null, cond: { any: [{ flag: 'sp.memorial-seen' }, { badge: 'ward' }] } },
    { npc: 'tamsin', trainer: 'porch-tamsin', porch: 'porch-dark-1', lead: 'creelwight', nickname: 'Kettle', cond: { flag: 'sp.tamsin-arrived' } },
    { npc: 'wick', trainer: 'porch-wick', porch: 'porch-keepers-cottage', lead: 'rillfin', nickname: null,
      leadAfter: { cond: { thread: { id: 'water-pack', beat: { gte: 2 } } }, lead: 'gillwick' } },
    { npc: 'augusta', trainer: 'porch-augusta', porch: 'porch-wardens-house', lead: 'bilgebob', nickname: null },
    { npc: 'linnet', trainer: 'porch-linnet', porch: 'porch-linnet', lead: 'caldermaw', nickname: null,
      cond: { all: [{ flag: 'sp.linnet-rematch' }, { any: [{ not: { flag: 'sp.linnet-fell' } }, { flag: 'sp.linnet-returned' }] }] },
      leadAfter: { cond: { flag: 'sp.linnet-returned' }, lead: 'sootling' } },
  ],
  /**
   * Visitors (beaten leaders, route trainers) are on the slate: the battle flow fights them as a Porch
   * Duel (`setup.porchDuel`: scaled to the party median with `partySizeByBadges`, no blackout, no
   * defeated flag, the duel purse instead of the trainer's payout).
   */
  visitorsLive: true,
  /** Beaten leaders ferry in and borrow the Archive porch (Barnaby keeps the cards). */
  visitorVenue: 'porch-archive',
  leaders: [
    { npc: 'maud', trainer: 'maud-spire', cond: { badge: 'turn' } },
    { npc: 'osric', trainer: 'osric-spire', cond: { badge: 'ward' } },
    { npc: 'ines', trainer: 'ines-spire', cond: { badge: 'weather' } },
    { npc: 'wendel', trainer: 'wendel-spire', cond: { badge: 'hollow' } },
    { npc: 'ada', trainer: 'hallorans-spire', cond: { badge: 'relay' } },
    { npc: 'seraphine', trainer: 'seraphine-spire', cond: { badge: 'mirror' } },
    { npc: 'bastien', trainer: 'bastien-keeper', cond: { flag: 'sp.idris-beaten' } },
    { npc: 'cass', trainer: 'cass-keeper', cond: { flag: 'sp.idris-beaten' } },
    { npc: 'idris', trainer: 'idris-champion', cond: { flag: 'sp.idris-beaten' } },
  ],
  /** Route trainers post once you hold that isle's badge (you have walked their road). */
  routePools: [
    { region: 'lowmoor', cond: { badge: 'turn' }, trainers: ['lowmoor-osier', 'lowmoor-dunlin', 'lowmoor-colm', 'lowmoor-perrin', 'lowmoor-tibby'] },
    { region: 'cairnhold', cond: { badge: 'ward' }, trainers: ['cairnhold-ruddock', 'cairnhold-prudence', 'cairnhold-jory', 'cairnhold-ellery', 'cairnhold-bette'] },
    { region: 'emberstep', cond: { badge: 'weather' }, trainers: ['emberstep-asha', 'emberstep-kip', 'emberstep-roswitha', 'emberstep-tobiah', 'emberstep-marl'] },
    { region: 'drownwood', cond: { badge: 'hollow' }, trainers: ['drownwood-wenna', 'drownwood-gil', 'drownwood-hettie', 'drownwood-abner', 'drownwood-sorcha'] },
    { region: 'thistlewind', cond: { badge: 'relay' }, trainers: ['thistlewind-ned', 'thistlewind-lark', 'thistlewind-cuthbert', 'thistlewind-maisie', 'thistlewind-gideon'] },
    { region: 'rimeholt', cond: { badge: 'mirror' }, trainers: ['rimeholt-hild', 'rimeholt-oskar', 'rimeholt-greer', 'rimeholt-sunniva', 'rimeholt-aldous'] },
  ],
  slip: {
    header: 'Porch Duels tonight',
    offer: '{who} — {porch}, after seven. {n|One creature|{n} creatures}, friendly. {payout}◉.',
    taken: '{who} — fought. {payout}◉ in your pocket.',
    none: 'No duels posted tonight. Tully says that is suspicious.',
  },
});

// ---------------------------------------------------------------------------------------------
// Crossovers (GDD-00 §9): the party lead's type changes one town verb by one rule
// ---------------------------------------------------------------------------------------------

/**
 * `tuning.creatureBonuses`: lowercase type id -> systems/fieldLog `LeadBonus` fields. Dual-type
 * leads merge (largest number, OR of booleans). Bonuses only; nothing is ever locked behind one.
 * Plain, Rust and Star leads change no verb (their porch lines still notice them).
 */
export const CREATURE_BONUSES = deepFreeze({
  brine: { fishNameSpecies: true, tellCatches: 1, biteWindowMult: 1.5 },
  gust: { shakeAllFruit: true, hiveBlowClear: true },
  grit: { markCracks: true, extraCracks: 1, glintSeeRadius: 3 },
  stone: { markCracks: true, extraCracks: 1, glintSeeRadius: 3 },
  glass: { skyglassSeeRadius: 5, skyglassByDay: true },
  hollow: { skyglassSeeRadius: 5, skyglassByDay: true },
  bolt: { humRadius: 4, mothLightMult: 2 },
  moss: { graftNightsSooner: 1 },
  rime: { extraShadows: 1 },
  kiln: { cleanFindsPerDay: 1 },
});

/** How each Crossover reads on the party screen's lead card (verb + one line). */
export const CROSSOVERS = deepFreeze([
  { types: ['brine'], verb: 'fish', text: 'Names every shadow\'s species; learns a tell after one catch; the bite window is half again as wide.' },
  { types: ['gust'], verb: 'shake', text: 'One shake drops every fruit on a tree, and it blows a bee nest clear: honeycomb, no sting.' },
  { types: ['grit', 'stone'], verb: 'dig', text: 'Marks today\'s cracks on the map, opens a fifth, and spots the Glint from three tiles.' },
  { types: ['glass', 'hollow'], verb: 'dig', text: 'Sees skyglass relics from five tiles, dimly even by day (they still dig only at a night low).' },
  { types: ['bolt'], verb: 'listen', text: 'Its Tailhum hums within four tiles of a purse, the Glint or a night headliner, and draws moths to string lights.' },
  { types: ['moss'], verb: 'graft', text: 'A Greenhouse graft takes one night sooner.' },
  { types: ['rime'], verb: 'fish', text: 'Calms the quay: one more shadow on every reach.' },
  { types: ['kiln'], verb: 'clean', text: 'Cleans one fossil on the spot each day (+40%, as the Workshop bench would).' },
  { types: ['plain', 'rust', 'star'], verb: null, text: 'Changes no town verb. The neighbours notice it all the same.' },
]);

// ---------------------------------------------------------------------------------------------
// Weather (GDD-00 §9): systems/weather kind rows + tuning values
// ---------------------------------------------------------------------------------------------

/** Effects per kind (systems/weather WEATHER_EFFECTS): bonuses, never locks. */
const WEATHER_EFFECTS = {
  clear: [{ target: 'bug', tag: 'day', mult: 1.25 }],
  overcast: [{ target: 'fish', tag: '*', mult: 1.1 }],
  rain: [{ target: 'bug', tag: '*', mult: 1.5 }, { target: 'encounter', tag: 'brine', mult: 1.25 }, { target: 'encounter', tag: 'moss', mult: 1.25 }],
  fog: [{ target: 'fish', tag: 'silver', mult: 2 }, { target: 'shoal', tag: 'quay', mult: 1.5 }, { target: 'encounter', tag: 'hollow', mult: 1.25 }],
  storm: [{ target: 'errant', tag: 'lightning', mult: 2 }, { target: 'find', tag: 'shore', mult: 2 }, { target: 'fish', tag: 'storm', mult: 1.5 }, { target: 'encounter', tag: 'bolt', mult: 1.25 }],
  snow: [{ target: 'encounter', tag: 'rime', mult: 1.5 }],
};

/** Values for `data/tuning.js` (economy owns the file): the climate and the effects above. */
export const WEATHER_TUNING = deepFreeze({
  WEATHER_WEIGHTS: { clear: 34, overcast: 26, rain: 20, fog: 12, storm: 8, snow: 0 },
  WEATHER_EFFECTS,
});

export const WEATHER = deepFreeze([
  { id: 'clear', name: 'Clear', phrase: 'clear skies', prep: 'through', lead: null, particles: null, stems: [], branches: ['weather:clear'], seasons: null,
    effects: WEATHER_EFFECTS.clear,
    town: 'Butterflies bask on the windfalls; the Glint flashes from further off; golden hour on the point is gold.',
    augusta: 'Clear through the evening tide. I\'d put money on it, if I had any.',
    ansel: 'Glass high and steady.' },
  { id: 'overcast', name: 'Overcast', phrase: 'cloud', prep: 'by', lead: 'clear', particles: null, stems: [], branches: ['weather:overcast'], seasons: null,
    effects: WEATHER_EFFECTS.overcast,
    town: 'Fish lose their caution under a lid of cloud: a few more bites on every reach.',
    augusta: 'Cloud by the afternoon tide. Nothing to write home about. I\'ll write anyway.',
    ansel: 'Glass easing.' },
  { id: 'rain', name: 'Rain', phrase: 'showers', prep: 'by', lead: 'overcast', particles: 'rain', stems: ['rain'], branches: ['weather:rain', 'weather:wet'], seasons: null,
    effects: WEATHER_EFFECTS.rain,
    town: 'Rain brings the bugs out (bush-crickets sing in the beans) and Brine and Moss creatures to the reeds.',
    augusta: 'Showers by the evening tide. Bring the washing in; leave the net out.',
    ansel: 'Glass falling.' },
  { id: 'fog', name: 'Fog', phrase: 'fog', prep: 'by', lead: 'clear', particles: 'mist', stems: [], branches: ['weather:fog'], seasons: null,
    effects: WEATHER_EFFECTS.fog,
    town: 'Fog pulls the silver schools right in to the quay steps; Hollow creatures drift closer on the isles.',
    augusta: 'Fog by the morning tide. The herring will be on the steps. So will I.',
    ansel: 'Glass still. Sea quiet. Fog.' },
  { id: 'storm', name: 'Storm', phrase: 'a storm', prep: 'by', lead: 'overcast', particles: 'rain', stems: ['rain'], branches: ['weather:storm', 'weather:wet', 'errant-lightning'], seasons: null,
    effects: WEATHER_EFFECTS.storm,
    town: 'Errant lightning walks on the sea; shore finds wash up twice as thick; bass and pollack come in close.',
    augusta: 'A storm by the night tide. Nobody on the Bar. I mean it kindly.',
    ansel: 'Glass dropping fast.' },
]);

// ---------------------------------------------------------------------------------------------
// The Day Page (GDD-00 §9; pillar 6: Tomorrow, always)
// ---------------------------------------------------------------------------------------------

/** Dimity's page: section lines in order, then *Tomorrow:*, then the save check. */
export const DAY_PAGE = deepFreeze({
  header: 'Day {day}, {weekday}.',
  sections: {
    buttons: 'Buttons: {earned}◉ in, {spent}◉ out.',
    buttonsQuiet: 'Buttons: a quiet day for the purse.',
    loan: 'Paid {paid}◉ at the yard. {left}◉ to go on loan {tier}.',
    loanCleared: 'Loan {tier} cleared. THWAP. Ambrose split the stick.',
    loanDone: 'Nothing owed. Wren says it twice to hear it.',
    catches: 'Caught: {list}.',
    catchesNone: 'Caught: nothing, which is also a kind of day.',
    people: 'Talked with {list}.',
    peopleNone: 'Talked with: me. I count.',
    shifts: '{nick} became {form}.',
    anchored: '{nick} held fast.',
    letter: 'Read {label}.',
    heirloom: '{item} went home to {porch}.',
    badge: 'The {spire} seal on the tally wall.',
    lost: 'Lost to {name}. Home to the porch, a bit lighter in the pocket.',
    lostWild: 'Lost a fight in the wild. Home to the porch, a bit lighter in the pocket.',
    // a loss that sent nobody home (a story fight, a Keeper, a mentor or friend): no porch, no buttons
    lostPlain: 'Lost to {name}.',
    lostWildPlain: 'Lost a fight in the wild.',
    stamp: 'A stamp in the book: {stamp}.',
  },
  quietDay: [
    'Not much to write. I wrote it anyway.',
    'You walked a lot and bought nothing. Very restful, from up here.',
    'The tide came in, the tide went out. So did you.',
  ],
  tomorrowHeading: 'Tomorrow:',
  tomorrowJoin: '; ',
  tomorrowEnd: '.',
  tomorrowEmpty: 'Tomorrow: whatever you like. That is allowed.',
  saved: 'Saved, verified.',
  notSaved: 'Not saved. The page didn\'t take. Try the bench again, or the bed.',
  signOff: ['— D.', 'Sleep well. — D.', 'I kept the lamp warm. — D.', 'Goodnight, Keeper. — D.'],
});

/**
 * One *Tomorrow:* item per kind (systems/dayPage TOMORROW_ORDER, plus `go` and `loan` for the
 * route and pace lines the scene adds). Placeholders are filled from the item's id and params.
 */
export const TOMORROW = deepFreeze({
  build: 'the Thatch tie off {build} at 5:40',
  graft: 'the {fruit} graft takes overnight',
  bench: '{find} comes off the bench cleaned',
  forecast: '{nick} has a Shift pip lit (a Waystone, or home at the {time} low)',
  letter: '{label} at six',
  meet: '{who} on {place} at the low',
  beat: '{who}\'s porch tonight: {title}',
  low: 'lows at {times}',
  carry: '{label} to carry to its door',
  carryCounter: '{label} waiting at Hesper\'s counter',
  heirloom: '{label}\'s heirloom waits for a lit porch',
  errant: '{errant} seen over {isle}',
  spire: 'the {spire} Spire whenever you\'re ready (curve {curve})',
  go: '{isle} by the {time} low',
  loan: '{left}◉ to go on loan {tier}',
});

// ---------------------------------------------------------------------------------------------
// Boards: the Commons slip at your gate, Wanted Today, the Crate, the Archive Bounty
// ---------------------------------------------------------------------------------------------

export const BOARDS = deepFreeze({
  commons: {
    heading: 'The Commons board · Augusta',
    barometer: 'Ansel\'s chalk: {glass}',
    forecast: '{odds} in 10, {phrase} {prep} the {tide} tide.',
    forecastWrong: 'Yesterday I said {odds} in 10. I was the other {rest}. — A.',
    cracks: 'Cracks seen: {n} on {places}.',
    beats: 'On a porch tonight: {list}.',
    errant: '{errant} seen over {isle}.',
    jar: 'Commons Jar: {jar}◉. Next: {project} ({share}◉ from us).',
    dossier: 'Dossier: the {spire} Spire. {gimmick}',
  },
  wantedToday: {
    items: 3, mult: 1.5, perItemStacks: 1,
    rule: 'Three items at +50%, one stack each, rerolled overnight; one may be a Held form\'s drop.',
    slip: 'Wanted today at Pell\'s: {a}, {b} and {c}. Half again on one stack each.',
  },
  crate: {
    share: 0.9,
    rule: 'Anything left in the Crate at your gate sells overnight for 90% of its value.',
    slip: 'The Crate sold {list} for {n}◉.',
    empty: 'The Crate is empty. Wren checked twice.',
  },
  archiveBounty: {
    entries: 3, mult: 1.5, refreshDow: 0,
    rule: 'Every Monday Barnaby posts three wanted specimens (fish, bugs, finds, Held forms or creature drops) at half again their price.',
    slip: 'Archive Bounty this week: {a}, {b} and {c}. (Provenance required. Obviously.)',
  },
});

// ---------------------------------------------------------------------------------------------
// Journal stamps (24)
// ---------------------------------------------------------------------------------------------

const LIFE_THREADS = ['mudlark-mile', 'twelve-lights', 'oyster-boat', 'the-fence', 'heirlooms-going-home', 'the-bell'];

/**
 * A stamp lands the moment its `cond` holds. A `counter` block names a counter the stamp system
 * keeps (`world.counters`): it adds 1 on each `on` bus event whose payload matches `match`
 * (each key equal, or one of a listed array).
 */
export const STAMPS = deepFreeze([
  { id: 'someone-picked-you', name: 'Someone Picked You', cond: { flag: 'sp.starter-chosen' },
    text: 'Three on the stones, and one stayed. The mark lit on the name.' },
  { id: 'identity-crisis', name: 'Identity Crisis', cond: { flag: 'sp.dock-battle' },
    text: 'Linnet\'s creature changed shape mid-fight and you held anyway.' },
  { id: 'first-steps', name: 'First Steps', cond: { flag: 'sp.linnet-rematch' },
    text: 'The Brackenford rematch. She said "fine" like it cost her a button.' },
  { id: 'into-the-light', name: 'Into the Light', cond: { counter: 'stamp.catches', gte: 1 },
    counter: { id: 'stamp.catches', on: 'capture:ok', match: { scripted: false } },
    text: 'Your first catch folded into the Lantern\'s light. Warm chord. No wobble.' },
  { id: 'thwap', name: 'THWAP', cond: { flag: 'sp.first-payment' },
    text: 'The first notch. The loudest sound on the island.' },
  { id: 'a-little-late', name: 'A Little Late', cond: { seen: 'hesper-k1' },
    text: 'A letter thirty years late, addressed to the Keeper. That\'s you now.' },
  { id: 'read-before-you-roll', name: 'Read Before You Roll', cond: { flag: 'sp.first-forecast' },
    text: 'Three cards, three odds, one choice. You looked first.' },
  { id: 'again-please', name: 'Again, Please', cond: { counter: 'stamp.rerolls', gte: 1 },
    counter: { id: 'stamp.rerolls', on: 'stat:inc', match: { key: 'rerolls' } },
    text: 'A pinch of Starsalt and the cards went round again.' },
  { id: 'not-this-time', name: 'Not This Time', cond: { counter: 'stamp.anchors', gte: 1 },
    counter: { id: 'stamp.anchors', on: 'stat:inc', match: { key: 'anchors' } },
    text: 'A stone in the paw and the window closed. Some days you keep what you have.' },
  { id: 'ward-question', name: 'Ward ?', cond: { counter: 'stamp.ward-reads', gte: 1 },
    counter: { id: 'stamp.ward-reads', on: 'fieldLog:read', match: { ability: ['glasshide', 'mirrorveil', 'stillcoat'] } },
    text: 'A shimmer like a lattice. The Glass said Ward, and a question mark.' },
  { id: 'glowing-flats', name: 'Glowing Flats', cond: { counter: 'stamp.skyglass', gte: 1 },
    counter: { id: 'stamp.skyglass', on: 'gather:skyglass' },
    text: 'Cyan mud, a night low, and a piece of the sky that hummed in your paw.' },
  { id: 'on-the-steps', name: 'On the Steps', cond: { counter: 'stamp.porch-duels', gte: 1 },
    counter: { id: 'stamp.porch-duels', on: 'battle:end', match: { porchDuel: true } },
    text: 'A friendly duel on somebody\'s porch. Somebody made tea after.' },
  { id: 'home-again', name: 'Home Again', cond: { counter: 'stamp.heirlooms', gte: 1 },
    counter: { id: 'stamp.heirlooms', on: 'letter:heirloom' },
    text: 'A family letter to a lit door, and an old thing came home off Juniper\'s shelf.' },
  { id: 'weather-caught', name: 'Weather Caught', cond: { counter: 'stamp.errants', gte: 1 },
    counter: { id: 'stamp.errants', on: 'encounter:errant-down' },
    text: 'The lightning that walks on the sea, met head-on. It\'ll be back tomorrow.' },
  { id: 'market-night', name: 'Market Night', cond: { flag: 'sp.first-market' },
    text: 'String lights on the green, stalls down the Old Pier, odds called out loud.' },
  { id: 'read-it-for-me', name: 'Read It for Me', cond: { flag: 'sp.linnet-returned' },
    text: 'Linnet, in ermine, on her own step: "I\'m not asking Merrow."' },
  { id: 'wrong-shapes', name: 'Wrong Shapes', cond: { flag: 'sp.surge' },
    text: 'A whole street in Windle Shifted in one night, and you were there to read it.' },
  { id: 'two-plans', name: 'Two Plans, One Night', cond: { flag: 'sp.two-plans' },
    text: 'An Engine on the Lantern Stack and charges in the lagoon. Neither went off.' },
  { id: 'the-long-night', name: 'The Long Night', cond: { flag: 'sp.relighting' },
    text: 'The beam went round. Every porch pulsed once. A horn answered with your Signal.' },
  { id: 'the-reading', name: 'The Reading', cond: { flag: 'sp.reading-done' },
    text: 'The biggest Forecast there is, offered to you. You read it, and accepted.' },
  { id: 'ring-off', name: 'Ring Off', cond: { flag: 'sp.idris-beaten' },
    text: 'The Champion took the anchor off. Silence is an answer.' },
  { id: 'tied-off', name: 'Tied Off', cond: { any: LIFE_THREADS.map((id) => ({ thread: { id, done: true } })) },
    text: 'Somebody\'s story, finished, with you in it. One notch, and a string tied.' },
  { id: 'late-delivery', name: 'Late Delivery', cond: { flag: 'sp.late-delivery' },
    text: 'The fifty-sixth letter. The sack is empty. Hesper is beside herself.' },
  { id: 'every-plate', name: 'Every Plate', cond: { counter: 'stamp.forms-held', gte: 42 },
    counter: { id: 'stamp.forms-held', on: 'fieldLog:held', match: { first: true } },
    text: 'All forty-two plates Held. Corin can\'t see them well. He ran a claw down every one.' },
]);

/** Every table in this module, by the DATA name the orchestrator may wire it under. */
export const TOWN = deepFreeze({
  trees: TREES,
  furniture: FURNITURE,
  clothes: CLOTHES,
  roofColours: ROOF_COLOURS,
  commissionScenes: COMMISSIONS,
  commonsEffects: COMMONS_PROJECTS,
  festivals: FESTIVALS,
  porchDuels: PORCH_DUELS,
  creatureBonuses: CREATURE_BONUSES,
  crossovers: CROSSOVERS,
  weather: WEATHER,
  weatherTuning: WEATHER_TUNING,
  dayPage: DAY_PAGE,
  tomorrow: TOMORROW,
  boards: BOARDS,
  stamps: STAMPS,
});

export default TOWN;
