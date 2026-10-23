/**
 * The Archive collections: 18 fish, 10 bugs, 18 finds and 9 fruit (GDD-00 §7, §9; GDD-ids §14).
 * [GDD-05 TOWN LIFE]
 *
 * One table, `COLLECTIONS`, of §14.12 collection rows (`kind: 'fish' | 'bug' | 'relic' | 'fruit'`).
 * The fields below are the ones `systems/fishing`, `systems/gather` and `systems/fieldLog` read;
 * everything else (`tell`, `archive`, `move`, `habitat`, `hours`, `rarity`) is presentation for the
 * Field Log, the Archive cards and Barnaby's provenance slips.
 *
 * Shared row fields
 *   `where`    places the row can turn up: map / region ids, and for fish the reach `kind`s below
 *              (systems/gather.rowActive: any match passes; absent = anywhere)
 *   `night` / `day`   true = only during game night (18:00–06:00) / only during the day
 *   `when`     §6.4 cond (phase windows, the weir flag); `tide` 'any' or tide states; `weather` list
 *   `mods`     weight multipliers by `day|night|low|rising|high|falling|<weather>` (never zero:
 *              weather leans, it never locks)
 *   `w`        base weight in its pool; `rarity` the Field Log word for it
 *   `hours`    the time window as hour ranges [[from, to]] (wraps midnight), shown on the
 *              silhouette card of a seen-but-uncaught species; matches night/day/when exactly
 *
 * Fish: `shadow` is the size class the shadow sim draws (small | medium | large | forked),
 * `silhouette` its shape (finned | round | flat | ribbon | school | forked), `size` [min, max] cm,
 * `biteFrames` the Standard window range in 60 fps frames (7–31; tight for the night headliners),
 * `feints` [min, max] nibbles before the bite, `headliner` a night headliner (Bolt's Tailhum finds
 * it), `tags` for weather effects (fog pulls `silver` schools in, storms stir `storm` fish).
 * `tell` is shape + sound + word, learned after 3 catches (1 with a Brine lead).
 *
 * Bugs: `light` drawn to lit spots, `moth` drawn harder by a Bolt lead's string lights, `spook` the
 * multiplier on the gait radii (walk 2 tiles, run 4 tiles: so spook 1.5 = walk 3 / run 6), `wary`
 * the chance a careful swing still misses, `move` the movement signature, `habitat` the spot kinds
 * map authors place them at.
 *
 * Finds (kind 'relic'): `group` fossil | relic | shore, `skyglass: true` on the three skyglass
 * relics, `source` where they come from (crack | sparkle | skyglass | rake | tree), `letter` the
 * town letter its string-wall pin unlocks (T1–T18), `archivePrice` what Barnaby pays for a
 * duplicate, `refinesTo` what the Raft refines a skyglass relic into.
 *
 * Fruit: `origin` native | foreign, `price` / `ripePrice` (ripe is +25%), `favouredBy` the creature
 * types for which it is the favourite fruit (Greenhouse: +1 Bond once, overnight).
 *
 * Pure data; frozen.
 * @module data/collections
 */

import { deepFreeze } from './ids.js';

/**
 * Reach kinds a fish row's `where` may name (a map's `reaches[].kind`). Pellwick has two `river`
 * reaches, two `quay` reaches, the `creek` (empty until the weir turns), the point `flats` channel
 * and the `old-quay` (bared only at a spring low). After dark the quay reaches also count as `sea`.
 * Each isle's two reaches are a `river`, `lagoon` or `flats` reach (GDD-01 picks).
 */
export const REACH_KINDS = Object.freeze(['river', 'quay', 'sea', 'creek', 'flats', 'old-quay', 'lagoon']);

/** Spot kinds bug rows live at (map authors place bug spots with one of these; lit spots set `lit`). */
export const BUG_HABITATS = Object.freeze([
  'lit-porch', 'string-lights', 'orchard', 'green', 'lanes', 'reeds', 'point', 'flats', 'glowing-flats',
  'river', 'creek', 'hedges', 'beans',
]);

const ANY = Object.freeze([[0, 24]]);
const DAY = Object.freeze([[6, 18]]);
const NIGHT = Object.freeze([[18, 6]]);

/** @param {object} row */
const fish = (row) => ({ kind: 'fish', ...row });
/** @param {object} row */
const bug = (row) => ({ kind: 'bug', ...row });
/** @param {object} row */
const find = (row) => ({ kind: 'relic', ...row });
/** @param {object} row */
const fruit = (row) => ({ kind: 'fruit', ...row });

// ---------------------------------------------------------------------------------------------
// Fish (18): 80–4,200
// ---------------------------------------------------------------------------------------------

export const FISH = deepFreeze([
  fish({
    id: 'perch', name: 'Perch', where: ['river'], habitat: 'Any river reach; Pellwick\'s river mouth by the bridge pilings.',
    tide: 'any', hours: ANY, shadow: 'small', silhouette: 'finned', size: [14, 32],
    biteFrames: [26, 31], feints: [1, 2], w: 10, rarity: 'common', price: 80,
    tell: { shape: 'a small barred back with a nick of forked tail', sound: 'tick-tick on the float', word: 'Barred', text: 'Dark bars across a little back, a forked flick by the piling, two ticks on the float. Then it simply takes it.' },
    archive: 'A perch! The first fish of the season (and the first one on any card I write, by long tradition). Bridge piling, river mouth, falling tide, a beginner\'s rod. Provenance is everything. Even for perch.',
  }),
  fish({
    id: 'grey-mullet', name: 'Grey Mullet', where: ['quay'], habitat: 'Quay reaches by day, grazing the weed on the stones.',
    day: true, tide: 'any', hours: DAY, shadow: 'medium', silhouette: 'round', size: [28, 58],
    biteFrames: [20, 27], feints: [2, 3], w: 7, rarity: 'common', price: 240,
    tell: { shape: 'a blunt grey head that rises and sinks', sound: 'a soft pup at the surface', word: 'Kissing', text: 'It kisses the surface, pup, pup, and nibbles the bait like it is reading the label first. Wait for the third.' },
    archive: 'Grey mullet (they eat weed, which I find admirable and also a little sad). Tully insists they are lucky. I have no data on luck (yet). Quay stones, full daylight, three nibbles before it committed.',
  }),
  fish({
    id: 'dab', name: 'Dab', where: ['flats'], habitat: 'The channels left on the flats at low water.',
    day: true, tide: ['low'], hours: DAY, shadow: 'small', silhouette: 'flat', size: [12, 26],
    biteFrames: [22, 29], feints: [1, 2], w: 7, rarity: 'common', price: 160,
    tell: { shape: 'a flat shadow that is mostly sand-coloured edge', sound: 'a dull flup as it lifts off the bottom', word: 'Flat', text: 'A shadow with no thickness to it, lying in the channel like a dropped leaf. It lifts, flup, and comes at the bait sideways.' },
    archive: 'A dab (both eyes on one side, which it does not seem to mind). Point flats channel, dead low, daylight. I have filed it under Flat, then under Dab, then cross-referenced both. Thoroughness.',
  }),
  fish({
    id: 'herring', name: 'Herring', where: ['quay'], habitat: 'Quay shoals at any hour; fog pulls the silver schools right in to the steps.',
    tide: 'any', mods: { fog: 3, high: 1.5 }, tags: ['silver'], hours: ANY, shadow: 'small', silhouette: 'school', size: [18, 30],
    biteFrames: [24, 30], feints: [1, 2], w: 8, rarity: 'common', price: 120,
    tell: { shape: 'a school that turns all at once like a shaken coin purse', sound: 'a fizz of tiny splashes', word: 'Silver', text: 'The whole school flashes and turns as one. Cast at the edge, not the middle; the edge one bites.' },
    archive: 'Herring, from the silver school (I saw it turn, the whole cloud at once, like a sentence finishing itself). Quay steps, a foggy morning, high water. The fog brings them close. Augusta says so and she is right.',
  }),
  fish({
    id: 'mackerel', name: 'Mackerel', where: ['quay', 'lagoon'], habitat: 'Quay and lagoon reaches on a high daylight tide.',
    day: true, tide: ['high'], mods: { fog: 2 }, tags: ['silver'], hours: DAY, shadow: 'small', silhouette: 'school', size: [25, 40],
    biteFrames: [18, 25], feints: [1, 1], w: 6, rarity: 'common', price: 200,
    tell: { shape: 'a narrow school with tiger stripes when the sun catches it', sound: 'a quick rip of water', word: 'Striped', text: 'Green-black stripes in a fast, tight school. One feint, if that; mackerel do not believe in waiting.' },
    archive: 'Mackerel (the stripes are not decorative, apparently, though I choose to believe they are). Quay, high water, bright sun. It bit before I had finished saying "careful". Very rude. Very good.',
  }),
  fish({
    id: 'sand-eel', name: 'Sand Eel', where: ['flats'], habitat: 'The flats at low water, diving in and out of the wet sand.',
    tide: ['low'], hours: ANY, shadow: 'small', silhouette: 'ribbon', size: [10, 22],
    biteFrames: [24, 31], feints: [1, 3], w: 8, rarity: 'common', price: 100,
    tell: { shape: 'a thin silver line that vanishes into the sand', sound: 'a hiss like a dropped grain bag', word: 'Ribbon', text: 'A ribbon of silver that dives into the sand when your shadow touches it. Stand still; it comes back up to look.' },
    archive: 'A sand eel (not an eel, which I wrote on the card in capitals so nobody is disappointed). Dug its way in, then out, then into the bait. Flats, low water. Cheap, cheerful, very wriggly.',
  }),
  fish({
    id: 'stickleback', name: 'Stickleback', where: ['river', 'creek'], habitat: 'River reaches by day, guarding a patch of weed; the north creek too, once the weir turns.',
    day: true, tide: 'any', hours: DAY, shadow: 'small', silhouette: 'finned', size: [4, 8],
    biteFrames: [27, 31], feints: [2, 3], w: 9, rarity: 'common', price: 90,
    tell: { shape: 'a tiny shadow that charges much bigger shadows', sound: 'a peep of a splash', word: 'Spiny', text: 'Smallest shadow in the river and the bravest. It bumps the float three times to tell it off, then bites it.' },
    archive: 'Stickleback! Three spines, one opinion: that the river is his. River reach, mid-morning, it attacked the float twice before eating it. I am writing "brave" in the margin. Small things count.',
  }),
  fish({
    id: 'brown-trout', name: 'Brown Trout', where: ['river', 'creek'], habitat: 'River reaches by day, holding in the slack behind stones; the north creek too, once the weir turns.',
    day: true, tide: 'any', hours: DAY, shadow: 'medium', silhouette: 'finned', size: [25, 55],
    biteFrames: [15, 22], feints: [1, 2], w: 4, rarity: 'uncommon', price: 380,
    tell: { shape: 'a speckled shadow that holds still behind a stone', sound: 'a sip, barely there', word: 'Speckled', text: 'It hangs in the slack water behind a stone, perfectly still, red specks on the flank. It sips the bait. Strike on the sip.' },
    archive: 'A brown trout (red spots, gold flank, terribly handsome, knows it). Behind the third stone above the bridge, late morning. It sipped. I have never seen a fish sip. Provenance card is double length.',
  }),
  fish({
    id: 'grayling', name: 'Grayling', where: ['creek'], habitat: 'The north creek only, once the weir wheel turns and the water comes back.',
    when: { flag: 'sp.weir-turned' }, tide: 'any', hours: ANY, shadow: 'medium', silhouette: 'finned', size: [28, 45],
    biteFrames: [12, 17], feints: [1, 2], w: 3, rarity: 'rare', price: 1200,
    tell: { shape: 'a slim shadow with a tall sail of a back fin', sound: 'a clean little click', word: 'Sailfin', text: 'A tall fin like a sail breaks the surface of the creek. It rises, clicks at the bait, and is gone if you are late.' },
    archive: 'A GRAYLING. From the north creek. (Sorry. I am going to be quiet for a moment.) Nobody has written that on a card in thirty years. The sail fin. The smell of thyme. Ansel will want to see this. Ansel should see this first.',
  }),
  fish({
    id: 'sea-trout', name: 'Sea Trout', where: ['creek', 'river'], habitat: 'Rivers at dawn and dusk; the north creek too, once the weir turns.',
    when: { phase: ['dawn', 'dusk'] }, tide: 'any', hours: [[5, 7], [17.5, 19.5]], shadow: 'medium', silhouette: 'finned', size: [35, 70],
    biteFrames: [13, 18], feints: [1, 2], w: 3, rarity: 'uncommon', price: 650,
    tell: { shape: 'a long silver shadow moving upstream in the half-light', sound: 'a heavy roll at the surface', word: 'Rolling', text: 'At dawn or dusk a long silver back rolls once, upstream. It does not feint long. Watch for the roll, then the dip.' },
    archive: 'Sea trout (a brown trout that went to sea and came back silver, which is a better story than most people have). River, dusk, a long roll and then a fight. I noted the light. The light matters.',
  }),
  fish({
    id: 'silver-eel', name: 'Silver Eel', where: ['river', 'creek'], habitat: 'River reaches after dark, heading for the sea.',
    night: true, tide: 'any', hours: NIGHT, shadow: 'medium', silhouette: 'ribbon', size: [40, 90],
    biteFrames: [14, 20], feints: [2, 3], w: 4, rarity: 'uncommon', price: 450,
    tell: { shape: 'a long shadow that bends like a written S', sound: 'a slow drag on the line', word: 'Sinuous', text: 'A long S of a shadow slides along the bottom after dark. It drags the float slowly, twice, three times. Patience; then it pulls.' },
    archive: 'A silver eel, going to sea (they all go, one night, all at once, and nobody knows quite why). River, after dark, a slow drag on the line. I have tied a little ribbon on its card. For the journey.',
  }),
  fish({
    id: 'pollack', name: 'Pollack', where: ['quay', 'lagoon'], habitat: 'Quay and lagoon reaches at any hour; storms stir them up.',
    tide: 'any', mods: { storm: 1.5, overcast: 1.25 }, tags: ['storm'], hours: ANY, shadow: 'medium', silhouette: 'finned', size: [30, 60],
    biteFrames: [17, 24], feints: [1, 2], w: 5, rarity: 'common', price: 300,
    tell: { shape: 'a bronze shadow with a jutting lower jaw', sound: 'a hard knock on the line', word: 'Underbite', text: 'A bronze fish with an underbite, hanging off the weed line. It knocks once, hard, like someone at the door.' },
    archive: 'Pollack (underbite; dignified about it). Quay wall, an overcast afternoon, one hard knock and then everything at once. I find the pollack refreshingly direct.',
  }),
  fish({
    id: 'red-gurnard', name: 'Red Gurnard', where: ['quay', 'flats'], habitat: 'Quay reaches and the flats channels, walking the bottom on its fins.',
    tide: 'any', hours: ANY, shadow: 'medium', silhouette: 'finned', size: [22, 40],
    biteFrames: [16, 23], feints: [1, 3], w: 4, rarity: 'uncommon', price: 340,
    tell: { shape: 'a shadow with wide wing-fins that walks the bottom', sound: 'it croaks: grk, grk', word: 'Croaking', text: 'You hear it before you see it: grk, grk, from the bottom. Wide wing fins, little walking feet. It croaks once more when it bites.' },
    archive: 'A red gurnard, and yes, it CROAKED, on the slab, at me, twice. (I croaked back. Professional courtesy.) Quay channel, mid-tide. It walks on its fins. I need a new drawer.',
  }),
  fish({
    id: 'lumpsucker', name: 'Lumpsucker', where: ['old-quay'], habitat: 'The Old Quay\'s rock pools, bared only at a spring low (every seventh day).',
    tide: ['low'], hours: ANY, shadow: 'medium', silhouette: 'round', size: [20, 40],
    biteFrames: [20, 28], feints: [1, 2], w: 4, rarity: 'uncommon', price: 1100,
    tell: { shape: 'a round shadow stuck fast to a stone', sound: 'a pop like a cork', word: 'Clinging', text: 'A round lump stuck to the old stonework. It lets go with a pop, like a cork, and bumbles at the bait.' },
    archive: 'A lumpsucker (it sucks, onto lumps; the name is honest). Old Quay, spring low, a stone that has not seen air for six days. It held on to my claw for a whole minute. I am choosing to call that affection.',
  }),
  fish({
    id: 'sea-bass', name: 'Sea Bass', where: ['quay', 'flats'], habitat: 'Quay and the point flats from dusk into the evening; storms bring them in.',
    when: { phase: ['dusk', 'evening'] }, tide: 'any', mods: { storm: 1.5 }, tags: ['storm'], hours: [[17.5, 22]], shadow: 'large', silhouette: 'finned', size: [40, 80],
    biteFrames: [12, 17], feints: [1, 2], w: 2, rarity: 'uncommon', price: 900,
    tell: { shape: 'a big shadow that patrols the edge of the surf', sound: 'a sharp slap of a tail', word: 'Patrolling', text: 'A big shadow runs the edge of the surf at dusk, turning at the same rock every time. Cast ahead of the turn.' },
    archive: 'Sea bass (the handsome one at the dance). Off the point, golden hour sliding into evening, a tail-slap I heard from the green. Odile was painting; she put it in. It is the second-best fish in the painting.',
  }),
  fish({
    id: 'glimmer-sprat', name: 'Glimmer Sprat', where: ['flats', 'lagoon'], habitat: 'Flats channels and lagoon reaches at a night low, lit from below by skyglass.',
    night: true, tide: ['low'], tags: ['silver', 'skyglass'], hours: NIGHT, shadow: 'small', silhouette: 'school', size: [6, 12],
    biteFrames: [20, 26], feints: [1, 2], w: 6, rarity: 'uncommon', price: 700,
    tell: { shape: 'a school that glows magenta at the edges', sound: 'a hum just under hearing', word: 'Glimmer', text: 'At a night low a school lights up magenta at the edges, humming like the glass under it. The bright one bites.' },
    archive: 'Glimmer sprat (they glow; I have dimmed the lamp to check; they still glow). Glowing flats, night low, the school was humming. Born under skyglass, every one of them. I gave the card a magenta corner.',
  }),
  fish({
    id: 'john-dory', name: 'John Dory', where: ['quay', 'sea'], habitat: 'The night sea off the quay; it comes into the flats channels at a night low.',
    night: true, tide: 'any', headliner: true, hours: NIGHT, shadow: 'forked', silhouette: 'forked', size: [25, 50],
    biteFrames: [9, 13], feints: [1, 3], w: 0.4, rarity: 'rare', price: 2400,
    tell: { shape: 'a tall, thin, forked-tail shadow with a dark thumbprint', sound: 'a hollow tock, like a knuckle on a barrel', word: 'Thumbprint', text: 'Side-on it is huge; head-on it all but disappears. A dark thumbprint on the flank. It stalks the bait for a long while, then tocks once. Now.' },
    archive: 'A John Dory, by night (the thumbprint, see? Somebody very old pressed it there, in the story). Quay, night sea, forked tail, a hollow tock. I have put it on the good shelf. Ludo has asked twice what I would want for it.',
  }),
  fish({
    id: 'lantern-wolffish', name: 'Lantern Wolffish', where: ['quay', 'sea'], habitat: 'The night sea off the quay, rising on the night high water.',
    night: true, tide: 'any', mods: { high: 1.5 }, headliner: true, hours: NIGHT, shadow: 'forked', silhouette: 'forked', size: [60, 110],
    biteFrames: [7, 10], feints: [2, 3], w: 0.15, rarity: 'rare', price: 4200,
    tell: { shape: 'a long forked-tail shadow with a faint light at its brow', sound: 'a grinding crunch under the water', word: 'Lantern', text: 'A long dark shape with a faint glow at the brow, rising on the night high. It crunches at the bait twice. The third time is the only time.' },
    archive: 'The lantern wolffish. (I have taken my helmet off. Figuratively.) Night sea, high water, the little light at its brow lit up the slab. It has teeth like a mason\'s chisel and a face like a disappointed uncle. My favourite thing in the Archive.',
  }),
]);

// ---------------------------------------------------------------------------------------------
// Bugs (10): 60–900
// ---------------------------------------------------------------------------------------------

export const BUGS = deepFreeze([
  bug({
    id: 'tiger-moth', name: 'Tiger Moth', habitat: ['lit-porch', 'string-lights'],
    night: true, tide: 'any', hours: NIGHT, light: true, moth: true, spook: 0.75, wary: 0.1, w: 6, rarity: 'common', price: 180,
    move: 'Loops the lamp in lazy figure-eights, landing on the frame every third loop.',
    tell: { shape: 'orange underwings flashing on the loop', sound: 'a dry flutter on the glass', word: 'Looping', text: 'It lands on the lamp frame every third loop. Swing on the landing.' },
    archive: 'A tiger moth (orange underneath, which it keeps for emergencies). Your porch lamp, half past ten. Dimity was very gracious about the visitor. I have pinned it, figuratively. I do not pin moths. I write about them.',
  }),
  bug({
    id: 'ermine-moth', name: 'Ermine Moth', habitat: ['lit-porch', 'string-lights'],
    night: true, tide: 'any', hours: NIGHT, light: true, moth: true, spook: 0.75, wary: 0.05, w: 8, rarity: 'common', price: 140,
    move: 'Settles on the warm wall beside a lamp and does not move unless you run.',
    tell: { shape: 'white wings with black dots, flat on the wall', sound: 'none at all', word: 'Spotted', text: 'White as a fresh notice, dotted black, flat against the warm wall by the lamp. It trusts walking feet.' },
    archive: 'An ermine moth (white with black dots, very formal, like a little magistrate). Post office wall, by Hesper\'s lamp. Hesper says it comes every night to read the notices. I believe her.',
  }),
  bug({
    id: 'hawk-moth', name: 'Hawk-moth', habitat: ['string-lights', 'orchard'],
    when: { phase: ['dusk', 'evening'] }, tide: 'any', hours: [[17.5, 22]], light: true, moth: true, spook: 1.5, wary: 0.35, w: 2, rarity: 'rare', price: 600,
    move: 'Hovers in place at a blossom or a bulb, then darts a full tile sideways without warning.',
    tell: { shape: 'a hovering blur with a long tongue', sound: 'a hum like a tiny engine', word: 'Hovering', text: 'It hovers, humming, then darts sideways. Swing where it was going to be, after the second dart.' },
    archive: 'A hawk-moth! It hovered like a hummingbird (I have never seen a hummingbird; I have read about one, thoroughly). String lights in the orchard, dusk. It nearly took my porthole for a flower. Flattering.',
  }),
  bug({
    id: 'glow-worm', name: 'Glow-worm', habitat: ['reeds', 'point'], where: ['pellwick', 'lowmoor', 'drownwood'],
    night: true, tide: 'any', hours: NIGHT, spook: 0.5, wary: 0, w: 5, rarity: 'uncommon', price: 320,
    move: 'Sits still on a reed stem and glows green; it only dims when something runs at it.',
    tell: { shape: 'a green pinprick on a reed stem', sound: 'none; it dims instead', word: 'Glowing', text: 'A green pinprick low in the reeds. Walk, do not run; if it dims, stand still until it brightens.' },
    archive: 'A glow-worm (a beetle, technically, which it would like you to know). Reed edge by the point, after dark. It makes its own light. I wrote "independent" on the card and then underlined it.',
  }),
  bug({
    id: 'sandhopper', name: 'Sandhopper', habitat: ['flats'],
    tide: ['low'], hours: ANY, spook: 1.25, wary: 0.25, w: 8, rarity: 'common', price: 60,
    move: 'Hops in a burst of three from the wrack line whenever a shadow crosses it.',
    tell: { shape: 'a speck that jumps three times then hides', sound: 'tik-tik-tik', word: 'Hopping', text: 'Three hops, tik-tik-tik, then it hides under the weed. Net the weed, not the hop.' },
    archive: 'A sandhopper (one of a great many; this one specifically). Wrack line on the flats, low water. I am keeping its card short because it would not sit still for a long one.',
  }),
  bug({
    id: 'starfly', name: 'Starfly', habitat: ['glowing-flats'],
    night: true, tide: ['low'], hours: NIGHT, light: true, spook: 1, wary: 0.3, w: 2, rarity: 'rare', price: 900,
    move: 'Drifts over glowing mud and skyglass in slow spirals, pulsing magenta in time with the hum.',
    tell: { shape: 'a magenta spark spiralling over the mud', sound: 'a faint hum, in tune with the glass', word: 'Humming', text: 'It spirals over the glowing mud and hums with the skyglass. It drinks the light; swing when it dips to drink.' },
    archive: 'A starfly. (Oh.) Glowing flats, a night low, humming in tune with the skyglass under it. Born since the Starfall, like the sprats and the marks. The card is magenta. All of it. I could not help myself.',
  }),
  bug({
    id: 'red-admiral', name: 'Red Admiral', habitat: ['orchard', 'green'],
    day: true, tide: 'any', mods: { clear: 1.5, rain: 0.4 }, hours: DAY, spook: 1, wary: 0.1, w: 6, rarity: 'common', price: 160,
    move: 'Basks on warm fruit and stone with its wings open, then flits up in a loose zig-zag.',
    tell: { shape: 'black wings with a red band, open in the sun', sound: 'a papery snap on take-off', word: 'Basking', text: 'It basks with its wings flat open on fallen fruit. While the wings are open, it is not watching.' },
    archive: 'A red admiral (a butterfly of rank; I salute it every time). Windfall pear in the orchard, a bright morning. It was a little drunk on the pear, if I am honest. Provenance notes: ripe.',
  }),
  bug({
    id: 'dor-beetle', name: 'Dor Beetle', habitat: ['lanes', 'green'],
    when: { phase: ['dusk', 'evening'] }, tide: 'any', hours: [[17.5, 22]], spook: 0.5, wary: 0, w: 6, rarity: 'common', price: 120,
    move: 'Trundles along the lane in a straight line at dusk, then lifts off with a loud drone.',
    tell: { shape: 'a blue-black shine trundling down the lane', sound: 'a low drone when it flies', word: 'Droning', text: 'It trundles in a straight line and drones when it lifts. Get ahead of it on the line.' },
    archive: 'A dor beetle (blue-black underneath, like a good inkwell). The lane behind the green, dusk, droning like a slow bee. It walked into the net. I think it was going there anyway.',
  }),
  bug({
    id: 'damselfly', name: 'Damselfly', habitat: ['river', 'creek'],
    day: true, tide: 'any', hours: DAY, spook: 1.25, wary: 0.15, w: 5, rarity: 'uncommon', price: 260,
    move: 'Perches on a reed tip over the water, wings folded, and hops to the next reed when approached.',
    tell: { shape: 'a blue needle on a reed tip', sound: 'a dry rustle of wings', word: 'Perching', text: 'A blue needle on the tip of a reed. It hops one reed downstream when you come close; wait at the next reed.' },
    archive: 'A damselfly (smaller and more careful than a dragonfly; I relate). Reed tip over the river, mid-morning, wings folded like a closed book. Pale blue. I have matched the ink.',
  }),
  bug({
    id: 'bush-cricket', name: 'Bush-cricket', habitat: ['hedges', 'beans'],
    tide: 'any', mods: { rain: 5, storm: 3, overcast: 1.5, clear: 0.3 }, hours: ANY, spook: 1, wary: 0.2, w: 3, rarity: 'uncommon', price: 420,
    move: 'Sings from deep in a hedge and goes silent when you step close; it moves only between songs.',
    tell: { shape: 'long feelers poking out of the leaves', sound: 'a scratchy tsip-tsip that stops', word: 'Singing', text: 'It sings, tsip-tsip, from inside the hedge, and stops when you step close. Count to three in the silence; it sings again where it is.' },
    archive: 'A bush-cricket, from Bryony\'s beans (she was cross; then she was interested). Rain on the leaves, a scratchy little song. They come out in the wet. So, it turns out, do I.',
  }),
]);

// ---------------------------------------------------------------------------------------------
// Finds (18): 6 fossils, 6 relics (3 skyglass), 6 shore finds
// ---------------------------------------------------------------------------------------------

export const FINDS = deepFreeze([
  // fossils (cracks): 300–1,500, cleaned +40% overnight on the Workshop bench or on the spot with a Kiln lead
  find({
    id: 'ammonite', name: 'Ammonite', group: 'fossil', source: ['crack'], where: ['pellwick', 'lowmoor', 'cairnhold'], letter: 't1',
    w: 6, rarity: 'common', price: 400,
    archive: 'An ammonite (a coiled shell older than the sea\'s current address). Crack by the point path, dug by you, Tuesday. I have pinned it beside the bar soundings, because a spiral is a kind of tide table. Bear with me.',
  }),
  find({
    id: 'belemnite', name: 'Belemnite', group: 'fossil', source: ['crack'], where: ['pellwick', 'cairnhold', 'emberstep'], letter: 't2',
    w: 6, rarity: 'common', price: 300,
    archive: 'A belemnite (people used to call them thunderbolts, which is wrong and wonderful). Quarry crack, dry ground. Pinned beside Mabry\'s day book: the oil boat that turned back. Both of them pointing out to sea.',
  }),
  find({
    id: 'crinoid-stem', name: 'Crinoid Stem', group: 'fossil', source: ['crack'], where: ['cairnhold', 'thistlewind', 'rimeholt'], letter: 't3',
    w: 5, rarity: 'common', price: 350,
    archive: 'A crinoid stem (a sea lily; little stone buttons stacked like coins in a ledger). Hillside crack, after rain. Pinned beside the weir inspection that was deferred "until the mill is sold". It was never sold. It was never inspected.',
  }),
  find({
    id: 'fossil-fern', name: 'Fossil Fern', group: 'fossil', source: ['crack'], where: ['lowmoor', 'drownwood', 'thistlewind'], letter: 't4',
    w: 4, rarity: 'uncommon', price: 600,
    archive: 'A fossil fern (pressed in stone like a letter in a book). Marsh crack, low light. Pinned beside the note that the keeper posted a drawing to the harbor office. A drawing. I would very much like to see that drawing.',
  }),
  find({
    id: 'urchin-cast', name: 'Urchin Cast', group: 'fossil', source: ['crack'], where: ['pellwick', 'emberstep', 'rimeholt'], letter: 't5',
    w: 3, rarity: 'uncommon', price: 800,
    archive: 'An urchin cast (five-pointed, like a star drawn by someone careful). Crack below the lighthouse. Pinned beside Merrow\'s ward log: broth carried up the stair to a keeper who would not sleep. Somebody was kind. It is written down.',
  }),
  find({
    id: 'old-shape-skull', name: 'Old-Shape Skull', group: 'fossil', source: ['crack'], letter: 't6',
    w: 0.6, rarity: 'rare', price: 1500,
    archive: 'A skull of the old shape (a creature from before the hum). Look at the brow: no mark. Nothing to light. Pinned beside Merrow\'s note that creatures born before the Starfall carry no Heartmark. I keep looking at your partner\'s brow, and then at this one.',
  }),
  // town relics (sparkles, a few cracks): 300–1,500
  find({
    id: 'brass-tide-gauge', name: 'Brass Tide Gauge', group: 'relic', source: ['sparkle'], where: ['pellwick', 'the-bar'], letter: 't7',
    w: 1.5, rarity: 'rare', price: 1200,
    archive: 'A brass tide gauge, harbor issue, needle stuck at a very low number. Point flats, a night low, under the glow. Pinned beside the notice to mariners: the light will burn nine more nights. It did not burn ten.',
  }),
  find({
    id: 'postmark-die', name: 'Postmark Die', group: 'relic', source: ['crack', 'sparkle'], where: ['pellwick'], letter: 't8',
    w: 1.5, rarity: 'uncommon', price: 700,
    archive: 'The old post office\'s postmark die (Hesper went very quiet when she saw it). Under the green, three hand-widths down. Pinned beside Mabry Coil\'s last page: the last sack, and the office closing. The sack that is now arriving. One letter a morning.',
  }),
  find({
    id: 'fleet-tally-token', name: 'Fleet Tally Token', group: 'relic', source: ['sparkle'], where: ['pellwick', 'the-bar', 'drownwood'], letter: 't9',
    w: 2, rarity: 'uncommon', price: 500,
    archive: 'A berth token from the lost fleet, number stamped on one side, a little boat on the other. Flats, low water, near the wreck ribs. Pinned beside the roll of the lost fleet. I have found its line on the roll. I will not read it out.',
  }),
  // skyglass relics (night low only): 900 to Barnaby, or 1 Starsalt at the Raft
  find({
    id: 'skyglass-shard', name: 'Skyglass Shard', group: 'relic', skyglass: true, source: ['skyglass'], letter: 't10',
    w: 6, rarity: 'uncommon', price: 900, archivePrice: 900, refinesTo: { starsalt: 1 },
    archive: 'Skyglass, a shard (it hums; I have put it in a drawer and the drawer hums). Glowing flats, night low, magenta under the mud. Pinned beside Merrow\'s log of the Night of Wrong Shapes, hour by hour. The glass and the hours. Same night.',
  }),
  find({
    id: 'skyglass-bead', name: 'Skyglass Bead', group: 'relic', skyglass: true, source: ['skyglass'], letter: 't11',
    w: 3, rarity: 'rare', price: 900, archivePrice: 900, refinesTo: { starsalt: 1 },
    archive: 'Skyglass, rolled smooth into a bead by thirty years of tide. Night low, deep in the glow. Pinned beside Ansel\'s report on the grounding of the fleet. He wrote it well. He wrote it the next morning. I wish he had waited a week.',
  }),
  find({
    id: 'skyglass-knot', name: 'Skyglass Knot', group: 'relic', skyglass: true, source: ['skyglass'], letter: 't12',
    w: 1, rarity: 'rare', price: 900, archivePrice: 900, refinesTo: { starsalt: 1 },
    archive: 'Skyglass, twisted into a knot (it fell hot, the books say, and cooled tied). Night low. Pinned beside Merrow\'s founding of the Mooring: light calls the change. The glass looks like it changed its mind while falling. I sympathise.',
  }),
  // shore finds (sparkles, the rake, the odd gull drop): 100–400; storms wash more up
  find({
    id: 'cockle', name: 'Cockle', group: 'shore', source: ['rake', 'sparkle'], tags: ['shore'], letter: 't13',
    w: 8, rarity: 'common', price: 100,
    archive: 'A cockle! Oh, a COCKLE. East flats, low tide, Tuesday, I am writing it on the card. Provenance is everything. Pinned beside Mabry\'s note about the children wading home across the flats. They raked cockles on the way. Of course they did.',
  }),
  find({
    id: 'razor-shell', name: 'Razor Shell', group: 'shore', source: ['sparkle'], tags: ['shore'], letter: 't14',
    w: 6, rarity: 'common', price: 120,
    archive: 'A razor shell (long and straight, like a ruled line). Flats, low water, standing up in the sand like a pen in a pot. Pinned beside Ansel\'s finding: the light was out at midnight. A straight line. A hard one.',
  }),
  find({
    id: 'sea-glass', name: 'Sea Glass', group: 'shore', source: ['sparkle'], tags: ['shore'], letter: 't15',
    w: 4, rarity: 'uncommon', price: 260,
    archive: 'Sea glass (NOT skyglass; your Glass says so and so do I; it does not hum, it is simply green and patient). A bottle, once. Pinned beside the notice suspending the ferry, indefinitely. Indefinitely is a long word for a short notice.',
  }),
  find({
    id: 'cuttlebone', name: 'Cuttlebone', group: 'shore', source: ['sparkle'], tags: ['shore'], letter: 't16',
    w: 4, rarity: 'common', price: 180,
    archive: 'A cuttlebone, light as a biscuit, washed up after weather. Strand line, the morning after a blow. Pinned beside Ansel\'s recommendation that the keeper be relieved. It is very light, for something so final.',
  }),
  find({
    id: 'mermaids-purse', name: 'Mermaid\'s Purse', group: 'shore', source: ['sparkle'], tags: ['shore'], letter: 't17',
    w: 3, rarity: 'uncommon', price: 220,
    archive: 'A mermaid\'s purse (an egg case, empty; the occupant left to see the world). Strand line, low water. Pinned beside Mabry\'s note: letters to the Outer Isles returned, no forwarding address. Everybody leaves an empty case behind.',
  }),
  find({
    id: 'whelk-shell', name: 'Whelk Shell', group: 'shore', source: ['sparkle', 'tree'], tags: ['shore'], letter: 't18',
    w: 5, rarity: 'common', price: 150,
    archive: 'A whelk shell (a gull dropped it on you from a tree, I understand, which is the gull\'s idea of a gift). Pinned beside Ansel\'s last addendum, the one he never sent. He did see the drawing. Later. Put it to your ear. It sounds like a weir.',
  }),
]);

// ---------------------------------------------------------------------------------------------
// Fruit (9): native 120 / ripe 150, foreign 480 / ripe 600
// ---------------------------------------------------------------------------------------------

const NATIVE_SOURCES = Object.freeze(['town trees', 'neighbours\' garden trees']);
const FOREIGN_SOURCES = Object.freeze(['Greenhouse graft', 'Lantern Market seedling', 'gift from a close neighbour']);

export const FRUIT = deepFreeze([
  fruit({
    id: 'pear', name: 'Pear', origin: 'native', price: 120, ripePrice: 150, sources: NATIVE_SOURCES, favouredBy: ['plain', 'gust'],
    text: 'A long-necked harbor pear. Ripe ones blush on one cheek and go round at the bottom.',
  }),
  fruit({
    id: 'plum', name: 'Plum', origin: 'native', price: 120, ripePrice: 150, sources: NATIVE_SOURCES, favouredBy: ['glass'],
    text: 'A dusky plum with a bloom like breath on glass. Ripe ones sag a little on the stalk.',
  }),
  fruit({
    id: 'apple', name: 'Apple', origin: 'native', price: 120, ripePrice: 150, sources: NATIVE_SOURCES, favouredBy: ['grit', 'stone'],
    text: 'A sharp little salt-wind apple. Ripe ones streak red and sit heavy in the hand.',
  }),
  fruit({
    id: 'cherry', name: 'Cherry', origin: 'native', price: 120, ripePrice: 150, sources: NATIVE_SOURCES, favouredBy: ['kiln', 'bolt'],
    text: 'Paired cherries on one stalk. Ripe pairs go dark and glossy and hang lower.',
  }),
  fruit({
    id: 'quince', name: 'Quince', origin: 'native', price: 120, ripePrice: 150, sources: NATIVE_SOURCES, favouredBy: ['rust', 'rime'],
    text: 'A lumpy golden quince that smells better than it tastes raw. Ripe ones lose their fuzz.',
  }),
  fruit({
    id: 'peach', name: 'Peach', origin: 'foreign', price: 480, ripePrice: 600, sources: FOREIGN_SOURCES, favouredBy: ['brine'],
    text: 'A soft-skinned peach from the south. Ripe ones blush all over and dent if you look at them.',
  }),
  fruit({
    id: 'fig', name: 'Fig', origin: 'foreign', price: 480, ripePrice: 600, sources: FOREIGN_SOURCES, favouredBy: ['moss'],
    text: 'A purple fig that grows best against a warm wall. Ripe ones split a smile at the base.',
  }),
  fruit({
    id: 'apricot', name: 'Apricot', origin: 'foreign', price: 480, ripePrice: 600, sources: FOREIGN_SOURCES, favouredBy: ['star'],
    text: 'An apricot the colour of the porchlight. Ripe ones freckle and come away at a touch.',
  }),
  fruit({
    id: 'mulberry', name: 'Mulberry', origin: 'foreign', price: 480, ripePrice: 600, sources: FOREIGN_SOURCES, favouredBy: ['hollow'],
    text: 'A cluster of mulberries that stain everything. Ripe ones go nearly black; your paws will too.',
  }),
]);

/** Every collection row (fish, bugs, finds, fruit), in manifest order. */
export const COLLECTIONS = deepFreeze([...FISH, ...BUGS, ...FINDS, ...FRUIT]);

export default COLLECTIONS;
