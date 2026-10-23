/**
 * WILDSHIFT types: the twelve ordinary types plus Star, the type chart and the
 * effectiveness words the UI shows (Strong / Neutral / Weak / Blocked).
 *
 * Pure data module: no DOM, no randomness. Chart values are the Proposed
 * values from the creatures spec (section 5), all est. until playtest.
 *
 * @module proto/battle/types
 */

/** The thirteen type names, chart order. */
export const TYPES = Object.freeze([
  'Plain', 'Grit', 'Brine', 'Kiln', 'Moss', 'Bolt', 'Rime', 'Gust', 'Stone', 'Rust', 'Glass', 'Hollow', 'Star',
]);

/** The twelve ordinary types (Star sits outside the chart). */
export const ORDINARY_TYPES = Object.freeze(TYPES.slice(0, 12));

/** Three-letter abbreviations used as chart column heads. */
export const TYPE_ABBR = Object.freeze({
  Plain: 'Pla', Grit: 'Gri', Brine: 'Bri', Kiln: 'Kil', Moss: 'Mos', Bolt: 'Bol', Rime: 'Rim',
  Gust: 'Gus', Stone: 'Sto', Rust: 'Rus', Glass: 'Gla', Hollow: 'Hol', Star: 'Sta',
});

/**
 * Master-palette letter for each type badge (creatures spec, palette table).
 * The hex values live in the visuals section; {@link PALETTE} carries
 * placeholders until that section lands.
 */
export const TYPE_PALETTE_KEY = Object.freeze({
  Plain: 'v', Grit: 'u', Brine: 'b', Kiln: 'o', Moss: 'g', Bolt: 'y', Rime: 's',
  Gust: 'w', Stone: 'e', Rust: 'r', Glass: 'i', Hollow: 'p', Star: 'd',
});

/**
 * Placeholder hex values for the palette letters this module needs.
 * PLACEHOLDER: the visuals section owns the real values; swap them in there.
 * `m` (comet magenta) is listed for completeness and must never be used on a
 * type badge.
 */
export const PALETTE = Object.freeze({
  v: '#c9c2b4', // plain: everyday sand
  u: '#b5793c', // grit: wet rope brown
  b: '#3d7fd6', // brine: harbour blue
  o: '#e8673c', // kiln: coral
  g: '#5c9e45', // moss: reed green
  y: '#e9c94a', // bolt: yellow-ish highlight
  s: '#8fd0e8', // rime: pale ice
  w: '#e8eef2', // gust: white-ish highlight
  e: '#7d7a72', // stone: grey cliff
  r: '#a3342e', // rust: berry red
  i: '#b7a9e6', // glass: skyglass lilac
  p: '#5a4a7a', // hollow: dusk purple
  d: '#2b2544', // star: night sky (badge carries a y comet glyph)
  k: '#111111', // black (silhouette test)
  m: '#ff3fb0', // comet magenta (Heartmarks, skyglass, Shift effects, Vagary only)
});

/**
 * Attacker type -> defender type -> multiplier (0 | 0.5 | 1 | 2).
 * Rows attack, columns defend. Dual types multiply.
 */
export const TYPE_CHART = Object.freeze({
  Plain: Object.freeze({ Plain: 1, Grit: 1, Brine: 1, Kiln: 1, Moss: 1, Bolt: 1, Rime: 1, Gust: 1, Stone: 0.5, Rust: 1, Glass: 1, Hollow: 0, Star: 1 }),
  Grit: Object.freeze({ Plain: 2, Grit: 1, Brine: 2, Kiln: 2, Moss: 0.5, Bolt: 0.5, Rime: 1, Gust: 1, Stone: 1, Rust: 2, Glass: 0.5, Hollow: 0, Star: 1 }),
  Brine: Object.freeze({ Plain: 1, Grit: 1, Brine: 1, Kiln: 2, Moss: 2, Bolt: 1, Rime: 2, Gust: 1, Stone: 0.5, Rust: 0.5, Glass: 1, Hollow: 1, Star: 1 }),
  Kiln: Object.freeze({ Plain: 1, Grit: 1, Brine: 0.5, Kiln: 1, Moss: 2, Bolt: 1, Rime: 2, Gust: 1, Stone: 1, Rust: 0.5, Glass: 2, Hollow: 2, Star: 1 }),
  Moss: Object.freeze({ Plain: 1, Grit: 1, Brine: 0.5, Kiln: 0.5, Moss: 1, Bolt: 2, Rime: 1, Gust: 1, Stone: 2, Rust: 2, Glass: 0.5, Hollow: 1, Star: 1 }),
  Bolt: Object.freeze({ Plain: 1, Grit: 1, Brine: 2, Kiln: 1, Moss: 1, Bolt: 1, Rime: 1, Gust: 2, Stone: 1, Rust: 1, Glass: 0.5, Hollow: 1, Star: 1 }),
  Rime: Object.freeze({ Plain: 1, Grit: 1, Brine: 0.5, Kiln: 0.5, Moss: 2, Bolt: 1, Rime: 1, Gust: 2, Stone: 1, Rust: 2, Glass: 1, Hollow: 1, Star: 1 }),
  Gust: Object.freeze({ Plain: 1, Grit: 2, Brine: 1, Kiln: 2, Moss: 1, Bolt: 1, Rime: 0.5, Gust: 1, Stone: 1, Rust: 1, Glass: 1, Hollow: 2, Star: 1 }),
  Stone: Object.freeze({ Plain: 1, Grit: 1, Brine: 0.5, Kiln: 1, Moss: 1, Bolt: 2, Rime: 1, Gust: 0.5, Stone: 1, Rust: 1, Glass: 2, Hollow: 1, Star: 1 }),
  Rust: Object.freeze({ Plain: 2, Grit: 1, Brine: 1, Kiln: 1, Moss: 1, Bolt: 2, Rime: 0.5, Gust: 1, Stone: 1, Rust: 1, Glass: 0.5, Hollow: 1, Star: 1 }),
  Glass: Object.freeze({ Plain: 1, Grit: 2, Brine: 0.5, Kiln: 1, Moss: 1, Bolt: 1, Rime: 1, Gust: 1, Stone: 0.5, Rust: 0.5, Glass: 1, Hollow: 2, Star: 1 }),
  Hollow: Object.freeze({ Plain: 1, Grit: 1, Brine: 1, Kiln: 1, Moss: 1, Bolt: 1, Rime: 1, Gust: 0.5, Stone: 2, Rust: 0.5, Glass: 2, Hollow: 1, Star: 1 }),
  Star: Object.freeze({ Plain: 1, Grit: 1, Brine: 1, Kiln: 1, Moss: 1, Bolt: 1, Rime: 1, Gust: 1, Stone: 1, Rust: 1, Glass: 1, Hollow: 1, Star: 1 }),
});

/** Effectiveness words the UI shows (always with an icon, never colour alone). */
export const WORDS = Object.freeze({ STRONG: 'Strong', NEUTRAL: 'Neutral', WEAK: 'Weak', BLOCKED: 'Blocked' });

/**
 * @param {string} type
 * @returns {boolean} whether `type` is one of the thirteen types
 */
export function isType(type) {
  return TYPES.includes(type);
}

/**
 * Single-pair chart lookup.
 * @param {string|null} attackType move type (`null` = typeless, always 1)
 * @param {string} defendType
 * @returns {number} 0 | 0.5 | 1 | 2
 */
export function chartMult(attackType, defendType) {
  if (attackType == null) return 1;
  const row = TYPE_CHART[attackType];
  if (!row) throw new RangeError(`chartMult: unknown attacking type ${String(attackType)}`);
  const v = row[defendType];
  if (v === undefined) throw new RangeError(`chartMult: unknown defending type ${String(defendType)}`);
  return v;
}

/**
 * Multiplier and effectiveness word of a move type against a defender's types.
 * Dual types multiply (x4 is still "Strong", x0.25 still "Weak"). A typeless
 * move (`null`, e.g. Scrap) is Neutral against everything.
 *
 * @param {string|null} moveType
 * @param {readonly string[]} defenderTypes one or two types
 * @returns {{mult: number, word: 'Strong'|'Neutral'|'Weak'|'Blocked'}}
 */
export function effectiveness(moveType, defenderTypes) {
  let mult = 1;
  for (const t of defenderTypes) mult *= chartMult(moveType, t);
  return { mult, word: wordFor(mult) };
}

/**
 * @param {number} mult
 * @returns {'Strong'|'Neutral'|'Weak'|'Blocked'}
 */
export function wordFor(mult) {
  if (mult === 0) return WORDS.BLOCKED;
  if (mult > 1) return WORDS.STRONG;
  if (mult < 1) return WORDS.WEAK;
  return WORDS.NEUTRAL;
}

/**
 * Hex colour for a type badge (placeholder palette, see {@link PALETTE}).
 * @param {string} type
 * @returns {string}
 */
export function typeColour(type) {
  const key = TYPE_PALETTE_KEY[type];
  if (!key) throw new RangeError(`typeColour: unknown type ${String(type)}`);
  return PALETTE[key];
}

/**
 * Types that hit the given defender for Strong damage.
 * @param {readonly string[]} defenderTypes
 * @returns {string[]}
 */
export function strongTypesAgainst(defenderTypes) {
  return ORDINARY_TYPES.filter((t) => effectiveness(t, defenderTypes).mult > 1);
}

/**
 * Types the given defender is immune to (chart 0).
 * @param {readonly string[]} defenderTypes
 * @returns {string[]}
 */
export function immuneTypesOf(defenderTypes) {
  return ORDINARY_TYPES.filter((t) => effectiveness(t, defenderTypes).mult === 0);
}
