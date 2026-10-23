/**
 * WILDSHIFT species data: the 15 pitch creatures, the Sloshkin family forms
 * and the other forms the creatures doc references (Bilgebob, Sootling,
 * Knuckleback, Cragmitt).
 *
 * Base stats are INVENTED for the prototype (the pitch gives none); totals sit
 * on a stage ladder: hatchling ~270-280, stage 1 ~300-350, stage 2 ~420-455,
 * stage 3 ~495-520, titan 520, Errant 580, legendary 600. Prismoth's max HP is
 * quartered at instance time (`hpMultiplier`). Catch rates use a 3-255 scale,
 * EXP yields and growth curves follow the usual handheld-RPG shape.
 *
 * @module proto/battle/species
 */

import { getMove } from './moves.js';
import { getAbility } from './abilities.js';

/** Stage numbers: 0 hatchling, 1, 2, 3 (top), 4 titan/legendary. */
export const STAGE = Object.freeze({ HATCHLING: 0, ONE: 1, TWO: 2, THREE: 3, APEX: 4 });

/** Default Shift windows (est.): the island 2 / 4 / 6 curve levels. */
export const DEFAULT_SHIFT_WINDOWS = Object.freeze([9, 20, 34]);

/**
 * @typedef {Object} Species
 * @property {string} id
 * @property {string} name
 * @property {string[]} types
 * @property {string} family
 * @property {number} stage
 * @property {{hp:number,atk:number,def:number,spa:number,spd:number,spe:number}} base
 * @property {string} ability ability id
 * @property {Array<{level:number, move:string}>} learnset
 * @property {string|null} heartmark fixed Heartmark technique move id; null = none / chosen (Blank Slate)
 * @property {number} catchRate 3..255
 * @property {number} expYield
 * @property {'fast'|'medium-fast'|'medium-slow'|'slow'} growth
 * @property {number[]} shiftWindows
 * @property {Record<string, any>} flags
 */

/** @type {Species[]} */
const LIST = [
  // ---------------------------------------------------------------- the 15 ---
  sp('sloshkin', 'Sloshkin', ['Brine'], 'sloshkin', 1, [60, 62, 55, 50, 55, 38], 'shoresense',
    [[1, 'tap'], [1, 'salt-spray'], [5, 'undertow'], [9, 'settle'], [13, 'shell-rattle'], [17, 'shellguard'], [22, 'riptide'], [28, 'tidal-mend'], [34, 'grind-down']],
    'undertow', 45, 64, 'medium-slow', { roleTag: 'starter_base', slow: true }),
  sp('skeinwing', 'Skeinwing', ['Brine', 'Gust'], 'sloshkin', 2, [55, 60, 50, 85, 65, 105], 'featherbed',
    [[1, 'tap'], [1, 'salt-spray'], [5, 'undertow'], [12, 'gale-cut'], [18, 'skein-sweep'], [24, 'updraft'], [30, 'mirror-step'], [36, 'riptide'], [42, 'hoarfrost']],
    'undertow', 45, 150, 'medium-slow', { roleTag: 'starter_shift', shiftOnly: true, fragile: true }),
  sp('scrapling', 'Scrapling', ['Grit'], 'scrapling', 1, [65, 80, 60, 30, 45, 35], 'big-sibling',
    [[1, 'tap'], [1, 'knuckle'], [6, 'shadowbox'], [10, 'sand-smother'], [15, 'pummel'], [20, 'stand-firm'], [26, 'grind-down'], [32, 'shellguard'], [38, 'rust-bite']],
    'shadowbox', 180, 60, 'medium-fast', { roleTag: 'early_carry', slow: true }),
  sp('prismoth', 'Prismoth', ['Glass', 'Gust'], 'prismoth', 2, [60, 40, 55, 90, 80, 95], 'prism-ward',
    [[1, 'dust-veil'], [1, 'tap'], [8, 'shardlight'], [14, 'updraft'], [20, 'skein-sweep'], [26, 'lens-focus'], [32, 'mirror-step'], [38, 'spore-drift']],
    null, 90, 140, 'medium-fast', { roleTag: 'ward', hpMultiplier: 0.25 }),
  sp('vesperay', 'Vesperay', ['Brine', 'Glass'], 'vesperay', 3, [95, 60, 85, 100, 100, 80], 'afterimage',
    [[1, 'salt-spray'], [1, 'dust-veil'], [10, 'shellguard'], [18, 'shardlight'], [26, 'vesper-mend'], [34, 'mirror-step'], [42, 'riptide'], [50, 'lens-focus'], [58, 'echo-drain']],
    null, 20, 220, 'slow', { roleTag: 'champion_ace' }),
  sp('vagary', 'Vagary', ['Star'], 'vagary', 4, [100, 90, 90, 120, 100, 100], 'unfixed',
    [[1, 'starfall'], [1, 'tailfall'], [20, 'shardlight'], [30, 'hoarfrost'], [40, 'riptide'], [50, 'kiln-maw'], [60, 'bandlight'], [70, 'echo-drain']],
    null, 3, 300, 'slow', { roleTag: 'comet_legendary', legendary: true, neverShifts: true, neverOnForecast: true }),
  sp('brinelance', 'Brinelance', ['Brine', 'Rime'], 'bilgebob', 2, [75, 105, 65, 60, 65, 85], 'last-ebb',
    [[1, 'tap'], [1, 'gnash'], [8, 'salt-spray'], [16, 'frost-nip'], [24, 'riptide'], [32, 'hoarfrost'], [40, 'iron-pin'], [48, 'pummel']],
    'gnash', 30, 170, 'slow', { roleTag: 'accidental_shift_hero' }),
  sp('creelwight', 'Creelwight', ['Hollow', 'Rust'], 'creelwight', 2, [70, 65, 110, 70, 95, 30], 'empty-weave',
    [[1, 'tap'], [1, 'snuff'], [8, 'rust-bite'], [15, 'corrode'], [22, 'echo-drain'], [29, 'iron-pin'], [36, 'stand-firm'], [43, 'shellguard'], [50, 'hullburst']],
    null, 60, 150, 'medium-slow', { roleTag: 'hollow_wall' }),
  sp('sedgehare', 'Sedgehare', ['Moss'], 'sedgehare', 2, [70, 95, 60, 55, 60, 100], 'keen-glint',
    [[1, 'tap'], [1, 'reed-whip'], [9, 'updraft'], [15, 'reap'], [21, 'root-knot'], [27, 'spore-drift'], [33, 'gale-cut'], [39, 'grind-down']],
    null, 75, 145, 'medium-fast', { roleTag: 'crit_threat' }),
  sp('wirewhisk', 'Wirewhisk', ['Bolt'], 'wirewhisk', 1, [45, 40, 45, 70, 55, 95], 'tailhum',
    [[1, 'arc-ping'], [1, 'tap'], [6, 'jolt'], [12, 'static-net'], [18, 'updraft'], [24, 'shell-rattle'], [30, 'mirror-step'], [36, 'gale-cut']],
    'arc-ping', 190, 55, 'medium-fast', { roleTag: 'scout' }),
  sp('rimeplate', 'Rimeplate', ['Rime', 'Stone'], 'rimeplate', 2, [80, 85, 115, 50, 75, 30], 'plateshed',
    [[1, 'tap'], [1, 'frost-nip'], [8, 'shard-fling'], [14, 'plate-toss'], [20, 'stand-firm'], [26, 'hoarfrost'], [32, 'rime-lock'], [38, 'sandtrap'], [44, 'bedrock-charge']],
    null, 90, 150, 'medium-slow', { roleTag: 'down_shift_example', slow: true }),
  sp('squallcoil', 'Squallcoil', ['Bolt', 'Brine'], 'squallcoil', 4, [90, 85, 75, 125, 90, 115], 'skyroam',
    [[1, 'jolt'], [1, 'salt-spray'], [15, 'static-net'], [25, 'riptide'], [35, 'bandlight'], [45, 'updraft'], [55, 'hullburst'], [65, 'gale-cut']],
    null, 3, 280, 'slow', { roleTag: 'errant', errant: true }),
  sp('tossup', 'Tossup', ['Plain'], 'tossup', 1, [50, 45, 50, 45, 50, 60], 'blank-slate',
    [[1, 'tap'], [1, 'sure-pinch'], [7, 'settle'], [13, 'shell-rattle'], [19, 'shellguard'], [25, 'knuckle'], [31, 'rust-bite'], [37, 'shardlight']],
    null, 255, 40, 'fast', { roleTag: 'wild_card_common', heartmarkChosenAtFirstShift: true }),
  sp('stillox', 'Stillox', ['Stone'], 'stillox', 4, [110, 115, 130, 50, 85, 30], 'unshifting',
    [[1, 'tap'], [1, 'shard-fling'], [10, 'stand-firm'], [20, 'grind-down'], [30, 'sandtrap'], [40, 'bedrock-charge'], [50, 'iron-pin'], [60, 'hullburst']],
    null, 25, 230, 'slow', { roleTag: 'unshifting_titan', neverShifts: true, titan: true }),
  sp('caldermaw', 'Caldermaw', ['Kiln', 'Stone'], 'caldermaw', 3, [90, 110, 100, 95, 70, 55], 'furnace-jaw',
    [[1, 'ember-lick'], [1, 'shard-fling'], [5, 'kiln-maw'], [12, 'scorch'], [20, 'slag-burst'], [28, 'stand-firm'], [36, 'grind-down'], [44, 'bedrock-charge'], [52, 'hullburst']],
    null, 30, 210, 'slow', { roleTag: 'rival_opener' }),
  // ---------------------------------------------------- Sloshkin family forms ---
  sp('puddlepip', 'Puddlepip', ['Brine'], 'sloshkin', 0, [50, 50, 48, 45, 50, 37], 'glasshide',
    [[1, 'tap'], [1, 'salt-spray'], [6, 'settle'], [12, 'shell-rattle'], [18, 'shellguard'], [24, 'tidal-mend'], [30, 'riptide']],
    'undertow', 120, 45, 'medium-slow', { hatchling: true }),
  sp('siltback', 'Siltback', ['Brine', 'Stone'], 'sloshkin', 2, [75, 80, 75, 55, 60, 30], 'tidecall',
    [[1, 'tap'], [1, 'salt-spray'], [5, 'shard-fling'], [12, 'settle'], [18, 'stand-firm'], [24, 'riptide'], [30, 'sandtrap'], [36, 'bedrock-charge'], [42, 'tidal-mend']],
    'undertow', 45, 145, 'medium-slow', {}),
  sp('bogmonarch', 'Bogmonarch', ['Brine', 'Stone'], 'sloshkin', 3, [100, 105, 95, 75, 80, 45], 'tidecall',
    [[1, 'tap'], [1, 'salt-spray'], [5, 'shard-fling'], [12, 'settle'], [20, 'stand-firm'], [28, 'riptide'], [36, 'sandtrap'], [44, 'bedrock-charge'], [52, 'tidal-mend'], [60, 'grind-down']],
    'undertow', 45, 240, 'medium-slow', {}),
  sp('lumenveil', 'Lumenveil', ['Glass'], 'lumenveil', 3, [75, 55, 70, 120, 95, 80], 'mirrorveil',
    [[1, 'dust-veil'], [1, 'tap'], [10, 'shardlight'], [18, 'lens-focus'], [26, 'dazzle'], [34, 'mirror-step'], [42, 'echo-drain'], [50, 'tidal-mend']],
    null, 45, 235, 'medium-slow', {}),
  sp('mudfist', 'Mudfist', ['Grit'], 'mudfist', 1, [65, 75, 60, 35, 50, 40], 'slatehide',
    [[1, 'tap'], [1, 'knuckle'], [8, 'sand-smother'], [14, 'pummel'], [20, 'stand-firm'], [26, 'grind-down'], [32, 'shellguard']],
    null, 150, 62, 'medium-fast', {}),
  sp('rushling', 'Rushling', ['Moss', 'Brine'], 'rushling', 1, [60, 50, 55, 70, 60, 35], 'scavenger',
    [[1, 'tap'], [1, 'reed-whip'], [7, 'salt-spray'], [13, 'spore-drift'], [19, 'root-knot'], [25, 'riptide'], [31, 'tidal-mend'], [37, 'reap']],
    null, 150, 63, 'medium-fast', {}),
  sp('chillnub', 'Chillnub', ['Rime'], 'rimeplate', 0, [55, 45, 60, 40, 45, 25], 'stillcoat',
    [[1, 'tap'], [1, 'frost-nip'], [8, 'settle'], [14, 'shard-fling'], [20, 'plate-toss'], [26, 'rime-lock'], [32, 'hoarfrost']],
    null, 160, 42, 'medium-slow', { hatchling: true }),
  sp('star-touched-sloshkin', 'Star-touched Sloshkin', ['Brine', 'Star'], 'sloshkin', 1, [65, 65, 58, 55, 58, 39], 'shoresense',
    [[1, 'tap'], [1, 'starfall'], [5, 'undertow'], [9, 'settle'], [13, 'shell-rattle'], [17, 'shellguard'], [22, 'riptide'], [28, 'tidal-mend'], [34, 'grind-down']],
    'undertow', 10, 90, 'medium-slow', { starTouched: true }),
  // ------------------------------------------------------- other referenced ---
  sp('bilgebob', 'Bilgebob', ['Brine'], 'bilgebob', 1, [110, 55, 45, 50, 45, 25], 'sodden',
    [[1, 'tap'], [1, 'salt-spray'], [8, 'gnash'], [14, 'settle'], [20, 'shellguard'], [26, 'riptide'], [32, 'tidal-mend'], [38, 'hullburst']],
    'gnash', 120, 70, 'slow', { mustNotReadAs: ['Wailmer', 'Cetoddle'] }),
  sp('sootling', 'Sootling', ['Kiln'], 'caldermaw', 0, [45, 50, 40, 60, 40, 35], 'ember-core',
    [[1, 'ember-lick'], [1, 'tap'], [8, 'scorch'], [14, 'settle'], [20, 'slag-burst'], [26, 'kiln-maw']],
    null, 160, 44, 'slow', { hatchling: true }),
  sp('knuckleback', 'Knuckleback', ['Grit'], 'scrapling', 2, [80, 110, 75, 40, 60, 55], 'big-sibling',
    [[1, 'tap'], [1, 'knuckle'], [6, 'shadowbox'], [10, 'sand-smother'], [15, 'pummel'], [20, 'stand-firm'], [26, 'grind-down'], [32, 'shellguard'], [38, 'rust-bite'], [45, 'iron-pin']],
    'shadowbox', 90, 145, 'medium-fast', {}),
  sp('cragmitt', 'Cragmitt', ['Grit', 'Stone'], 'scrapling', 3, [95, 125, 110, 45, 70, 60], 'slatehide',
    [[1, 'tap'], [1, 'knuckle'], [6, 'shadowbox'], [10, 'shard-fling'], [15, 'pummel'], [20, 'stand-firm'], [26, 'grind-down'], [32, 'sandtrap'], [40, 'bedrock-charge'], [48, 'iron-pin']],
    'shadowbox', 45, 235, 'medium-fast', {}),
];

/** @returns {Species} */
function sp(id, name, types, family, stage, [hp, atk, def, spa, spd, spe], ability, learnset, heartmark, catchRate, expYield, growth, flags) {
  getAbility(ability);
  for (const [, mv] of learnset) getMove(mv);
  if (heartmark) getMove(heartmark);
  return Object.freeze({
    id, name, types: Object.freeze(types.slice()), family, stage,
    base: Object.freeze({ hp, atk, def, spa, spd, spe }),
    ability,
    learnset: Object.freeze(learnset.map(([level, move]) => Object.freeze({ level, move }))),
    heartmark, catchRate, expYield, growth,
    shiftWindows: DEFAULT_SHIFT_WINDOWS,
    flags: Object.freeze({ ...flags }),
  });
}

/** All species by id. */
export const SPECIES = Object.freeze(Object.fromEntries(LIST.map((s) => [s.id, s])));

/** Ordered list of every species. */
export const SPECIES_LIST = Object.freeze(LIST.slice());

/** The 15 roster creatures, in pitch order. */
export const ROSTER_IDS = Object.freeze(LIST.slice(0, 15).map((s) => s.id));

/**
 * @param {string} id
 * @returns {Species}
 * @throws {RangeError}
 */
export function getSpecies(id) {
  const s = SPECIES[id];
  if (!s) throw new RangeError(`getSpecies: unknown species ${String(id)}`);
  return s;
}

/** @param {Species} s @returns {number} base stat total */
export function baseTotal(s) {
  const b = s.base;
  return b.hp + b.atk + b.def + b.spa + b.spd + b.spe;
}

/**
 * Moves a species knows at a level (learnset entries at or below `level`,
 * in learn order, de-duplicated).
 * @param {Species} s
 * @param {number} level
 * @returns {string[]} move ids
 */
export function learnableAt(s, level) {
  const out = [];
  for (const e of s.learnset) if (e.level <= level && !out.includes(e.move)) out.push(e.move);
  return out;
}

/** @param {Species} s @param {string} moveId @returns {boolean} */
export function canLearn(s, moveId) {
  return s.learnset.some((e) => e.move === moveId);
}

// ---------------------------------------------------------------------------
// Growth curves
// ---------------------------------------------------------------------------

/** Total EXP needed to be at `level` on a growth curve. */
export function expForLevel(growth, level) {
  const n = Math.max(1, Math.min(100, Math.floor(level)));
  if (n === 1) return 0;
  switch (growth) {
    case 'fast': return Math.floor((4 * n ** 3) / 5);
    case 'medium-fast': return n ** 3;
    case 'medium-slow': return Math.max(0, Math.floor(1.2 * n ** 3 - 15 * n ** 2 + 100 * n - 140));
    case 'slow': return Math.floor((5 * n ** 3) / 4);
    default: throw new RangeError(`expForLevel: unknown growth ${String(growth)}`);
  }
}

/** Level reached with `exp` total EXP on a growth curve (1..100). */
export function levelFromExp(growth, exp) {
  let lv = 1;
  while (lv < 100 && expForLevel(growth, lv + 1) <= exp) lv++;
  return lv;
}

// ---------------------------------------------------------------------------
// Sloshkin family Shift table (hidden pool weights, creatures doc section 6)
// ---------------------------------------------------------------------------

/**
 * Hidden Sloshkin pool, as seen from Sloshkin. Weights are per card and sum to
 * 100 within each card on each dial; 0 means the form never appears on that
 * dial. Freefall card odds are [NEED SOURCE] and left null.
 */
export const SLOSHKIN_SHIFT_TABLE = Object.freeze({
  family: 'sloshkin',
  viewedFrom: 'sloshkin',
  cardOddsByDial: Object.freeze({
    drift: Object.freeze({ up: 0.5, side: 0.4, down: 0.1 }),
    flux: Object.freeze({ up: 0.4, side: 0.35, down: 0.25 }),
    freefall: Object.freeze({ up: null, side: null, down: null }),
  }),
  bondCap: Object.freeze({ drift: 5, flux: 15, freefall: 10 }),
  pool: Object.freeze([
    row('siltback', 'up', 'forward', 2, 70, 45, 25),
    row('skeinwing', 'up', 'shift_only', 2, 20, 25, 25),
    row('bogmonarch', 'up', 'skip_ahead', 3, 10, 15, 25),
    row('lumenveil', 'up', 'other_family', 3, 0, 15, 25),
    row('mudfist', 'side', 'other_family', 1, 50, 50, 50),
    row('rushling', 'side', 'other_family', 1, 50, 50, 50),
    row('puddlepip', 'down', 'own_hatchling', 0, 100, 70, 50),
    row('chillnub', 'down', 'other_family_hatchling', 0, 0, 30, 50),
  ]),
  starTouched: Object.freeze({ form: 'star-touched-sloshkin', replacesCard: 'side', forecastChance: 0.02 }),
  shiftlogPullWeight: 5,
});

function row(form, card, kind, stage, drift, flux, freefall) {
  getSpecies(form);
  return Object.freeze({ form, card, kind, stage, weights: Object.freeze({ drift, flux, freefall }) });
}
