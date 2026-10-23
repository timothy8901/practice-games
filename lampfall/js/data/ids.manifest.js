/**
 * THE id manifest: every content id in LAMPFALL, per table. [DATA-IDX] (generated with design/GDD-ids.md)
 *
 * Content lanes author tables whose ids must match these arrays exactly; `tools/validate-data.mjs`
 * warns (not yet errors) when an authored DATA table is missing manifest ids or has extra ones.
 * Display names and one-line facts live in `design/GDD-ids.md`; to add, rename or cut an id,
 * edit both in the same change. Pure module: no imports, frozen exports only.
 * @module data/ids.manifest
 */

/** 13 types: the 12 ordinary types + Star (DATA.types). */
export const TYPE_IDS = Object.freeze([
  'plain', 'grit', 'brine', 'kiln', 'moss', 'bolt', 'rime', 'gust',
  'stone', 'rust', 'glass', 'hollow', 'star',
]);

/** 14 Shift families + 2 unshifting singleton family rows (stillox, vagary) so every form has a familyId. */
export const FAMILY_IDS = Object.freeze([
  'sloshkin', 'scrapling', 'sedgehare', 'prismoth', 'vesperay', 'bilgebob', 'creelwight', 'wirewhisk',
  'rimeplate', 'caldermaw', 'rillfin', 'tossup', 'errant', 'duskowl', 'stillox', 'vagary',
]);

/** 42 forms (GDD-00 §8). Star-touched forms are palette variants, not rows. */
export const SPECIES_IDS = Object.freeze([
  'puddlepip', 'sloshkin', 'siltback', 'skeinwing', 'bogmonarch', 'scrapling', 'mudfist', 'knuckleback',
  'cragmitt', 'reedkit', 'rushling', 'sedgehare', 'mothling', 'prismoth', 'cairnward', 'lumenveil',
  'rayling', 'vesperay', 'bilgebob', 'brinelance', 'rustcreel', 'creelwight', 'hulkwight', 'wirewhisk',
  'coilcrest', 'chillnub', 'rimeplate', 'floeback', 'sootling', 'emberjaw', 'caldermaw', 'rillfin',
  'gillwick', 'strandrunner', 'tossup', 'squallcoil', 'hailcoil', 'skirl', 'duskwisp', 'duskowl',
  'stillox', 'vagary',
]);

/** Every row of DATA.moves: the 64 techniques + Scrap (no slot). */
export const MOVE_IDS = Object.freeze([
  'tap', 'sure-pinch', 'shell-rattle', 'settle', 'shellguard', 'knuckle', 'grind-down', 'pummel',
  'sand-smother', 'undertow', 'salt-spray', 'riptide', 'tidal-mend', 'breaker', 'ember-lick', 'kiln-maw',
  'scorch', 'slag-burst', 'flashover', 'reed-whip', 'reap', 'root-knot', 'spore-drift', 'mire-bloom',
  'arc-ping', 'jolt', 'bandlight', 'static-net', 'fizz', 'live-wire', 'frost-nip', 'plate-toss',
  'hoarfrost', 'rime-lock', 'floe-ram', 'skein-sweep', 'gale-cut', 'updraft', 'mirror-step', 'downdraft',
  'shard-fling', 'bedrock-charge', 'sandtrap', 'stand-firm', 'cairn-crash', 'rust-bite', 'corrode', 'iron-pin',
  'hullburst', 'dust-veil', 'shardlight', 'dazzle', 'lens-focus', 'vesper-mend', 'shadowbox', 'gnash',
  'snuff', 'echo-drain', 'murk', 'drowned-bell', 'hush', 'tailfall', 'starfall', 'plumbline',
  'scrap',
]);

/** The 64 techniques (GDD-00 §16): MOVE_IDS without Scrap. */
export const TECHNIQUE_IDS = Object.freeze([
  'tap', 'sure-pinch', 'shell-rattle', 'settle', 'shellguard', 'knuckle', 'grind-down', 'pummel',
  'sand-smother', 'undertow', 'salt-spray', 'riptide', 'tidal-mend', 'breaker', 'ember-lick', 'kiln-maw',
  'scorch', 'slag-burst', 'flashover', 'reed-whip', 'reap', 'root-knot', 'spore-drift', 'mire-bloom',
  'arc-ping', 'jolt', 'bandlight', 'static-net', 'fizz', 'live-wire', 'frost-nip', 'plate-toss',
  'hoarfrost', 'rime-lock', 'floe-ram', 'skein-sweep', 'gale-cut', 'updraft', 'mirror-step', 'downdraft',
  'shard-fling', 'bedrock-charge', 'sandtrap', 'stand-firm', 'cairn-crash', 'rust-bite', 'corrode', 'iron-pin',
  'hullburst', 'dust-veil', 'shardlight', 'dazzle', 'lens-focus', 'vesper-mend', 'shadowbox', 'gnash',
  'snuff', 'echo-drain', 'murk', 'drowned-bell', 'hush', 'tailfall', 'starfall', 'plumbline',
]);

/** 25 abilities: the prototype list with prism-ward merged into glasshide, plus dusksight. */
export const ABILITY_IDS = Object.freeze([
  'shoresense', 'featherbed', 'big-sibling', 'afterimage', 'unfixed', 'last-ebb', 'empty-weave', 'keen-glint',
  'tailhum', 'plateshed', 'skyroam', 'blank-slate', 'unshifting', 'furnace-jaw', 'glasshide', 'mirrorveil',
  'stillcoat', 'sodden', 'tidecall', 'ember-core', 'slatehide', 'scavenger', 'still-mind', 'sure-footing',
  'dusksight',
]);

/** The 26 items of GDD-00 §16 (wicks, medicine, cures, Crackdust, Still Knot, 6 type tilts, 6 held items, Isolde's Lantern). */
export const ITEM_IDS = Object.freeze([
  'tallow-wick', 'brass-wick', 'skyglass-wick', 'salve', 'tonic', 'full-salve', 'revive', 'ether',
  'full-ether', 'poultice', 'warm-shawl', 'crackdust', 'still-knot', 'tilt-brine', 'tilt-stone', 'tilt-glass',
  'tilt-gust', 'tilt-hollow', 'tilt-kiln', 'whetstone', 'cork-float', 'oilskin', 'ballast-stone', 'lucky-button',
  'tally-charm', 'isoldes-lantern',
]);

/** 12 technique discs (`disc-<moveId>`). */
export const DISC_IDS = Object.freeze([
  'disc-spore-drift', 'disc-sandtrap', 'disc-flashover', 'disc-cairn-crash', 'disc-hoarfrost', 'disc-drowned-bell', 'disc-shardlight', 'disc-live-wire',
  'disc-gale-cut', 'disc-stand-firm', 'disc-gnash', 'disc-plumbline',
]);

/** Tools and key items (tool ring, Reading Glass, Prism, Weatherglass...). Not counted in the 26. */
export const KEY_ITEM_IDS = Object.freeze([
  'keepers-lantern', 'reading-glass', 'scouting-prism', 'weatherglass', 'rod', 'net', 'shovel', 'grafting-knife',
  'string-lights', 'ration-ledger', 'errands-clipboard', 'mail-sack',
]);

/** Heirlooms and thread keepsakes (Keepsakes pocket, one-of-a-kind). Not counted in the 26. */
export const KEEPSAKE_IDS = Object.freeze([
  'dorrow-kettle', 'brack-still-knot', 'grade-two-lantern', 'bryony-seed-tin', 'odile-easel', 'thessaly-almanac', 'tully-sweatband', 'oyster-boat-nameboard',
  'fleet-bell',
]);

/** Sellables and wallet-counted rows that shop stock references (starsalt, anchor-stone...). */
export const GOODS_IDS = Object.freeze([
  'starsalt', 'anchor-stone', 'honeycomb', 'timber', 'moth-silk', 'fruit-seedling',
]);

/** Native (5) and foreign (4) fruit (DATA.collections kind fruit). */
export const FRUIT_IDS = Object.freeze([
  'pear', 'plum', 'apple', 'cherry', 'quince', 'peach', 'fig', 'apricot',
  'mulberry',
]);

/** 18 fish (DATA.collections kind fish). */
export const FISH_IDS = Object.freeze([
  'perch', 'grey-mullet', 'dab', 'herring', 'mackerel', 'sand-eel', 'stickleback', 'brown-trout',
  'grayling', 'sea-trout', 'silver-eel', 'pollack', 'red-gurnard', 'lumpsucker', 'sea-bass', 'glimmer-sprat',
  'john-dory', 'lantern-wolffish',
]);

/** 10 bugs (DATA.collections kind bug). */
export const BUG_IDS = Object.freeze([
  'tiger-moth', 'ermine-moth', 'hawk-moth', 'glow-worm', 'sandhopper', 'starfly', 'red-admiral', 'dor-beetle',
  'damselfly', 'bush-cricket',
]);

/** 18 finds: 6 fossils, 6 relics (3 skyglass), 6 shore finds (DATA.collections kind relic). */
export const FIND_IDS = Object.freeze([
  'ammonite', 'belemnite', 'crinoid-stem', 'fossil-fern', 'urchin-cast', 'old-shape-skull', 'brass-tide-gauge', 'postmark-die',
  'fleet-tally-token', 'skyglass-shard', 'skyglass-bead', 'skyglass-knot', 'cockle', 'razor-shell', 'sea-glass', 'cuttlebone',
  'mermaids-purse', 'whelk-shell',
]);

/** Curve-level regions (DATA.regions). */
export const REGION_IDS = Object.freeze([
  'pellwick', 'lowmoor', 'cairnhold', 'emberstep', 'drownwood', 'thistlewind', 'rimeholt', 'the-bar',
  'shardcrown',
]);

/** 24 maps (GDD-00 §16). */
export const MAP_IDS = Object.freeze([
  'pellwick', 'lowmoor', 'cairnhold', 'emberstep', 'drownwood', 'thistlewind', 'rimeholt', 'the-bar',
  'spire-turn', 'spire-ward', 'spire-weather', 'spire-hollow', 'spire-relay', 'spire-mirror', 'int-cottage', 'int-pells',
  'int-post-office', 'int-archive', 'int-yard-shed', 'int-lighthouse', 'hollis-gate', 'keepers-hall', 'idris-hall', 'lantern-stack',
]);

/** 7 Waystones (one per isle + Hollis's Gate). */
export const WAYSTONE_IDS = Object.freeze([
  'brackenford', 'knapps-end', 'sulphur-cross', 'mossgate', 'windle', 'frostwick', 'hollis-gate',
]);

/** 6 Spires; also the badge ids, in order. */
export const SPIRE_IDS = Object.freeze([
  'turn', 'ward', 'weather', 'hollow', 'relay', 'mirror',
]);

/** 43 NPCs: 16 scheduled residents + Dimity + Spire leaders + Summit + faction heads + isle NPCs + fixtures + absent letter authors (isolde, mabry). */
export const NPC_IDS = Object.freeze([
  'wren', 'ambrose', 'hesper', 'juniper', 'ludo', 'barnaby', 'augusta', 'ansel',
  'wick', 'tully', 'odile', 'bryony', 'thessaly', 'tamsin', 'corin', 'linnet',
  'dimity', 'maud', 'osric', 'ines', 'wendel', 'ada', 'ivo', 'seraphine',
  'hollis', 'bastien', 'cass', 'idris', 'merrow', 'varga', 'dov', 'pip',
  'the-thatch', 'isolde', 'mabry', 'hobb-fallow', 'wynn-cobble', 'quill-hartsease', 'mags-penny', 'gorse-abernethy', 'teal-fenner',
  'rook-hayward', 'brannoch-vey',
]);

/** 65 trainer rosters (GDD-00 §16). */
export const TRAINER_IDS = Object.freeze([
  'lowmoor-osier', 'lowmoor-dunlin', 'lowmoor-colm', 'lowmoor-perrin', 'lowmoor-tibby', 'cairnhold-ruddock', 'cairnhold-prudence', 'cairnhold-jory',
  'cairnhold-ellery', 'cairnhold-bette', 'emberstep-asha', 'emberstep-kip', 'emberstep-roswitha', 'emberstep-tobiah', 'emberstep-marl', 'drownwood-wenna',
  'drownwood-gil', 'drownwood-hettie', 'drownwood-abner', 'drownwood-sorcha', 'thistlewind-ned', 'thistlewind-lark', 'thistlewind-cuthbert', 'thistlewind-maisie',
  'thistlewind-gideon', 'rimeholt-hild', 'rimeholt-oskar', 'rimeholt-greer', 'rimeholt-sunniva', 'rimeholt-aldous', 'pip', 'maud-spire',
  'osric-spire', 'ines-spire', 'wendel-spire', 'hallorans-spire', 'seraphine-spire', 'bar-corwen', 'bar-tilda', 'bar-ezra',
  'bar-ottilie', 'bar-hamish', 'bar-delphine', 'bastien-keeper', 'cass-keeper', 'idris-champion', 'linnet-dock', 'linnet-brackenford',
  'linnet-rimeholt', 'linnet-gate', 'wick-cairnhold', 'wick-long-road', 'merrow-engine', 'varga-drownwood', 'corin-exhibition-1', 'corin-exhibition-2',
  'corin-exhibition-3', 'porch-wren', 'porch-tully', 'porch-juniper', 'porch-odile', 'porch-tamsin', 'porch-wick', 'porch-augusta',
  'porch-linnet',
]);

/** 56 letters (k1-k20, f1-f18, t1-t18) + 2 event letters (e1, e2). */
export const LETTER_IDS = Object.freeze([
  'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7', 'k8',
  'k9', 'k10', 'k11', 'k12', 'k13', 'k14', 'k15', 'k16',
  'k17', 'k18', 'k19', 'k20', 'f1', 'f2', 'f3', 'f4',
  'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
  'f13', 'f14', 'f15', 'f16', 'f17', 'f18', 't1', 't2',
  't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10',
  't11', 't12', 't13', 't14', 't15', 't16', 't17', 't18',
  'e1', 'e2',
]);

/** 6 life threads + 3 cast arcs + 1 template thread. */
export const THREAD_IDS = Object.freeze([
  'mudlark-mile', 'twelve-lights', 'oyster-boat', 'the-fence', 'heirlooms-going-home', 'the-bell', 'ember-grub', 'water-pack',
  'empty-creek', 'second-chapter',
]);

/** 6 room commissions (pick 4). */
export const COMMISSION_IDS = Object.freeze([
  'training-yard', 'workshop', 'greenhouse', 'cellar', 'porch-loft', 'gallery',
]);

/** 6 Commons projects. */
export const COMMONS_PROJECT_IDS = Object.freeze([
  'dark-house-1', 'quay-lamps', 'mudlark-mile-flags', 'north-creek-footbridge', 'training-yard-green', 'third-stall',
]);

/** 7 loans (278,000 total). */
export const LOAN_IDS = Object.freeze([
  'tier-1', 'tier-2', 'tier-3', 'tier-4', 'tier-5', 'tier-6', 'tier-7',
]);

/** Overnight builds (systems/loans build queue, sys.build.<id> flags): the three fixed builds plus the six commissions. */
export const BUILD_IDS = Object.freeze([
  'bedsit', 'cottage', 'lamp-room',
  'training-yard', 'workshop', 'greenhouse', 'cellar', 'porch-loft', 'gallery',
]);

/** Shops and buy-only counters (DATA.shops). */
export const SHOP_IDS = Object.freeze([
  'pells-sundries', 'ludo-eave', 'carnival-raft', 'the-anchorage', 'cairnhold-clinic', 'lantern-market', 'archive-desk', 'consignment-crate',
]);

/** 4 festivals. */
export const FESTIVAL_IDS = Object.freeze([
  'lantern-market', 'mudlark-mile', 'long-night', 'late-delivery-party',
]);

/** 24 furniture pieces (the first 12 survive cut-order 14). */
export const FURNITURE_IDS = Object.freeze([
  'driftwood-bench', 'net-hammock', 'sea-chest', 'chart-table', 'barometer-clock', 'rag-rug', 'creel-stool', 'bottle-shelf',
  'brass-bedstead', 'rocking-chair', 'pot-belly-stove', 'fern-planter', 'oar-rack', 'figurehead', 'buoy-lamp', 'wheel-table',
  'cork-board', 'tide-clock', 'nesting-basket', 'field-guide-shelf', 'map-chest', 'float-chandelier', 'patchwork-bed', 'lamp-room-model',
]);

/** 12 clothes. */
export const CLOTHES_IDS = Object.freeze([
  'lighthouse-jumper', 'coop-apron', 'oilskin-jacket', 'sou-wester', 'tide-boots', 'cable-cardigan', 'watch-cap', 'wader-overalls',
  'ferry-scarf', 'keepers-coat', 'market-wrap', 'comet-brooch',
]);

/** 8 roof colours (slate-blue is the cursor default). */
export const ROOF_COLOUR_IDS = Object.freeze([
  'slate-blue', 'ochre', 'harbor-red', 'moss', 'sea-blue', 'straw', 'tar', 'heather',
]);

/** 24 journal stamps. */
export const STAMP_IDS = Object.freeze([
  'someone-picked-you', 'identity-crisis', 'first-steps', 'into-the-light', 'thwap', 'a-little-late', 'read-before-you-roll', 'again-please',
  'not-this-time', 'ward-question', 'glowing-flats', 'on-the-steps', 'home-again', 'weather-caught', 'market-night', 'read-it-for-me',
  'wrong-shapes', 'two-plans', 'the-long-night', 'the-reading', 'ring-off', 'tied-off', 'late-delivery', 'every-plate',
]);

/** 20 porches (7 lit at arrival, yours, 4 by family letters, 8 dark houses). */
export const PORCH_IDS = Object.freeze([
  'porch-coop-yard', 'porch-pells', 'porch-post-office', 'porch-archive', 'porch-wardens-house', 'porch-tully', 'porch-linnet', 'porch-keepers-cottage',
  'porch-dorrow', 'porch-odile', 'porch-bryony', 'porch-thessaly', 'porch-dark-1', 'porch-dark-2', 'porch-dark-3', 'porch-dark-4',
  'porch-dark-5', 'porch-dark-6', 'porch-dark-7', 'porch-dark-8',
]);

/** Chaos dials. */
export const DIAL_IDS = Object.freeze([
  'drift', 'flux', 'freefall',
]);

/** Challenge modes (ride-the-dice and blind-read only if the cut line allows). */
export const CHALLENGE_IDS = Object.freeze([
  'no-rewind', 'one-heart', 'ride-the-dice', 'blind-read',
]);

/** Weather kinds. */
export const WEATHER_IDS = Object.freeze([
  'clear', 'overcast', 'rain', 'fog', 'storm',
]);

/** Encounter table ids (GDD-01 may add more). */
export const ENCOUNTER_IDS = Object.freeze([
  'pellwick-reeds', 'pellwick-reach', 'pellwick-point-night', 'lowmoor-land', 'lowmoor-water', 'cairnhold-land', 'cairnhold-water', 'emberstep-land',
  'emberstep-water', 'drownwood-land', 'drownwood-water', 'thistlewind-land', 'thistlewind-water', 'rimeholt-land', 'rimeholt-water', 'the-bar-pools',
  'lantern-stack-perch',
]);

/** Story scene/script ids for the GDD-00 §11-§12 beats (other lanes add NPC, thread and trainer scripts). */
export const SCRIPT_IDS = Object.freeze([
  'arrival-causeway', 'wren-lease-card', 'wren-key-lantern', 'starter-choice', 'wick-keeper', 'corin-reading-glass', 'linnet-dock-before', 'linnet-dock-after',
  'wick-errands', 'yard-apron', 'tully-nickname', 'meet-neighbors', 'first-orchard', 'hesper-mail-sack', 'corin-capture-stance', 'barnaby-field-log',
  'ansel-fishing-tells', 'pip-before', 'ludo-first-sale', 'first-payment', 'porchlight-on', 'corin-slip', 'first-glowing-flats', 'thatch-first-roof',
  'hesper-k1', 'corin-first-forecast', 'linnet-decline', 'maud-practice-table', 'linnet-brackenford-before', 'linnet-brackenford-after', 'raft-docks', 'tamsin-arrives',
  'act-2-open', 'cairnhold-memorial', 'anchorage-turns-away', 'first-errant-sighting', 'first-lantern-market', 'dov-auction', 'varga-hires-you', 'linnet-fall',
  'comet-brightens', 'drowning-street', 'anchor-pulse-misfire', 'the-surge', 'idris-gallery', 'linnet-returns', 'two-plans-one-night', 'merrow-engine-before',
  'merrow-engine-after', 'charges-pulled', 'lamp-room-offered', 'lamp-room-built', 'the-relighting', 'the-crossing', 'the-reading', 'credits-dawn',
  'coda-morning', 'ansel-confession', 'ansel-weir-wheel', 'bell-dig', 'tamsin-sails', 'summit-gate', 'linnet-gate-before', 'linnet-gate-after',
  'wick-long-road-before', 'idris-anchor-release', 'summit-bell', 'blackout-wake', 'late-delivery-party', 'passenger-perch', 'dark-house-reopens', 'ninth-spire-ask',
]);

/** The six lit.* Relighting flags and the major sp.* story flags (not table ids; dotted namespaces). */
export const FLAG_IDS = Object.freeze([
  'lit.shiftTide', 'lit.steadied', 'lit.keepersAnchor', 'lit.fleetHome', 'lit.bar', 'lit.calls', 'sp.arrived', 'sp.lease-signed',
  'sp.starter-chosen', 'sp.reading-glass', 'sp.dock-battle', 'sp.errands-started', 'sp.mail-sack', 'sp.capture-stance', 'sp.field-log', 'sp.first-payment',
  'sp.first-forecast', 'sp.linnet-declined', 'sp.reroll-taught', 'sp.linnet-rematch', 'sp.raft-docked', 'sp.tamsin-arrived', 'sp.act-2', 'sp.memorial-seen',
  'sp.first-market', 'sp.varga-hired', 'sp.linnet-fell', 'sp.act-3', 'sp.drowning-street', 'sp.surge', 'sp.idris-gallery', 'sp.linnet-returned',
  'sp.two-plans', 'sp.engine-halted', 'sp.charges-pulled', 'sp.act-4', 'sp.lamp-room-offered', 'sp.lamp-room-built', 'sp.relighting', 'sp.reading-done',
  'sp.credits-seen', 'sp.summit-open', 'sp.idris-beaten', 'sp.ansel-confessed', 'sp.bell-dug', 'sp.weir-turned', 'sp.tamsin-sailed', 'sp.late-delivery',
  'sp.passenger-caught', 'sp.ninth-spire',
]);

/** Signature technique -> the species whose learnset must contain it (15). */
export const SIGNATURES = Object.freeze({
  'sure-pinch': 'tossup',
  'undertow': 'sloshkin',
  'kiln-maw': 'caldermaw',
  'reap': 'sedgehare',
  'arc-ping': 'wirewhisk',
  'bandlight': 'squallcoil',
  'plate-toss': 'rimeplate',
  'skein-sweep': 'skeinwing',
  'bedrock-charge': 'stillox',
  'dust-veil': 'prismoth',
  'vesper-mend': 'vesperay',
  'shadowbox': 'scrapling',
  'gnash': 'brinelance',
  'snuff': 'creelwight',
  'tailfall': 'vagary'
});

/** Disc item id -> the technique it teaches. */
export const DISC_MOVES = Object.freeze({
  'disc-spore-drift': 'spore-drift',
  'disc-sandtrap': 'sandtrap',
  'disc-flashover': 'flashover',
  'disc-cairn-crash': 'cairn-crash',
  'disc-hoarfrost': 'hoarfrost',
  'disc-drowned-bell': 'drowned-bell',
  'disc-shardlight': 'shardlight',
  'disc-live-wire': 'live-wire',
  'disc-gale-cut': 'gale-cut',
  'disc-stand-firm': 'stand-firm',
  'disc-gnash': 'gnash',
  'disc-plumbline': 'plumbline'
});

/** Species id -> family id. */
export const SPECIES_FAMILY = Object.freeze({
  'puddlepip': 'sloshkin',
  'sloshkin': 'sloshkin',
  'siltback': 'sloshkin',
  'skeinwing': 'sloshkin',
  'bogmonarch': 'sloshkin',
  'scrapling': 'scrapling',
  'mudfist': 'scrapling',
  'knuckleback': 'scrapling',
  'cragmitt': 'scrapling',
  'reedkit': 'sedgehare',
  'rushling': 'sedgehare',
  'sedgehare': 'sedgehare',
  'mothling': 'prismoth',
  'prismoth': 'prismoth',
  'cairnward': 'prismoth',
  'lumenveil': 'prismoth',
  'rayling': 'vesperay',
  'vesperay': 'vesperay',
  'bilgebob': 'bilgebob',
  'brinelance': 'bilgebob',
  'rustcreel': 'creelwight',
  'creelwight': 'creelwight',
  'hulkwight': 'creelwight',
  'wirewhisk': 'wirewhisk',
  'coilcrest': 'wirewhisk',
  'chillnub': 'rimeplate',
  'rimeplate': 'rimeplate',
  'floeback': 'rimeplate',
  'sootling': 'caldermaw',
  'emberjaw': 'caldermaw',
  'caldermaw': 'caldermaw',
  'rillfin': 'rillfin',
  'gillwick': 'rillfin',
  'strandrunner': 'rillfin',
  'tossup': 'tossup',
  'squallcoil': 'errant',
  'hailcoil': 'errant',
  'skirl': 'duskowl',
  'duskwisp': 'duskowl',
  'duskowl': 'duskowl',
  'stillox': 'stillox',
  'vagary': 'vagary'
});

/**
 * How each DATA table is checked against the manifest. `ids`: the ids the table must hold;
 * `optional`: ids that may be absent without a warning (cut-line candidates); `extras`: 'warn'
 * (default) or 'allow' (tables other lanes extend, e.g. scripts). `kind`: only rows whose `kind`
 * field is in this list are compared (collections). Manifest tables with no DATA table yet
 * (waystones, furniture, stamps...) are listed in `UNMAPPED`.
 */
export const MANIFEST = Object.freeze({
  types: Object.freeze({ ids: TYPE_IDS }),
  families: Object.freeze({ ids: FAMILY_IDS }),
  species: Object.freeze({ ids: SPECIES_IDS }),
  moves: Object.freeze({ ids: MOVE_IDS }),
  abilities: Object.freeze({ ids: ABILITY_IDS }),
  items: Object.freeze({ ids: Object.freeze([...ITEM_IDS, ...DISC_IDS, ...KEY_ITEM_IDS, ...KEEPSAKE_IDS, ...GOODS_IDS]) }),
  collections: Object.freeze({ ids: Object.freeze([...FISH_IDS, ...BUG_IDS, ...FIND_IDS, ...FRUIT_IDS]) }),
  regions: Object.freeze({ ids: REGION_IDS }),
  maps: Object.freeze({ ids: MAP_IDS }),
  npcs: Object.freeze({ ids: NPC_IDS }),
  trainers: Object.freeze({ ids: TRAINER_IDS }),
  letters: Object.freeze({ ids: LETTER_IDS }),
  threads: Object.freeze({ ids: THREAD_IDS }),
  loans: Object.freeze({ ids: LOAN_IDS }),
  shops: Object.freeze({ ids: SHOP_IDS }),
  dials: Object.freeze({ ids: DIAL_IDS }),
  challenges: Object.freeze({ ids: CHALLENGE_IDS, optional: Object.freeze(['ride-the-dice', 'blind-read']) }),
  encounters: Object.freeze({ ids: ENCOUNTER_IDS, extras: 'allow' }),
  scripts: Object.freeze({ ids: SCRIPT_IDS, extras: 'allow' }),
});

/** Manifest tables that no DATA table holds yet (checked once their table lands). */
export const UNMAPPED = Object.freeze({
  waystones: WAYSTONE_IDS, spires: SPIRE_IDS, commissions: COMMISSION_IDS, commonsProjects: COMMONS_PROJECT_IDS,
  festivals: FESTIVAL_IDS, furniture: FURNITURE_IDS, clothes: CLOTHES_IDS, roofColours: ROOF_COLOUR_IDS,
  stamps: STAMP_IDS, porches: PORCH_IDS, weather: WEATHER_IDS, flags: FLAG_IDS,
});
