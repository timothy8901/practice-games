/**
 * 8x8 string-art icons. [UI-KIT] — ARCHITECTURE-DRAFT §7.
 *
 * Every icon is 8 rows of 8 characters drawn with three palette slots so a caller can recolour
 * without new art: `#` ink, `o` accent, `w` light. `.` is transparent. Icons decode lazily through
 * `core/pixelart.decodeSprite` (cached by content, so repeated draws cost one `drawImage`).
 *
 * Families: verbs (talk shake fish dig read lantern door sit), device glyphs (key, button, tap,
 * pad), tells (glint bars wiggle), clock/tide (sun moon tideUp tideDown wave), status (burn poison
 * chill numb), the Heartmark sparkle (the only icon that may carry `m`), Ward badge glyphs, the 13
 * type icons (each a unique silhouette; Star is a five-point star, never a four-point sparkle), and
 * UI marks (check cross lock strike pin seal coin more arrows).
 *
 * Importing this module touches no DOM; decoding happens on first draw.
 * @module ui/icons
 */
import { decodeSprite, drawSprite } from '../core/pixelart.js';
import { PALETTE, COLORS } from './theme.js';

/** @type {Record<string, string[]>} */
export const ICON_ART = Object.freeze({
  // ---- verbs ----------------------------------------------------------------------------------
  talk: [
    '.######.',
    '#wwwwww#',
    '#wowowo#',
    '#wwwwww#',
    '.#####.#',
    '....#.#.',
    '....##..',
    '........',
  ],
  shake: [
    '..####..',
    '.##oo##.',
    'o#oooo#o',
    '.##oo##.',
    'o.####.o',
    '...##...',
    '...##...',
    '..####..',
  ],
  fish: [
    '........',
    '..###..#',
    '.#w##.##',
    '#o####.#',
    '.####.##',
    '..###..#',
    '........',
    '........',
  ],
  dig: [
    '..###...',
    '...#....',
    '...#....',
    '...#....',
    '..###...',
    '.#ooo#..',
    '.#ooo#..',
    '..#o#...',
  ],
  read: [
    '........',
    '.##..##.',
    '#ww##ww#',
    '#wo##ow#',
    '#ww##ww#',
    '#wo##ow#',
    '.##..##.',
    '........',
  ],
  lantern: [
    '...##...',
    '..####..',
    '.#.oo.#.',
    '.#oooo#.',
    '.#owwo#.',
    '.#.oo.#.',
    '..####..',
    '...##...',
  ],
  door: [
    '.######.',
    '.#oooo#.',
    '.#oooo#.',
    '.#ooow#.',
    '.#oooo#.',
    '.#oooo#.',
    '.#oooo#.',
    '########',
  ],
  sit: [
    '.##.....',
    '.#o.....',
    '.#o.....',
    '.######.',
    '.#oooo#.',
    '.######.',
    '.#....#.',
    '.#....#.',
  ],
  // ---- device glyphs (frames; the label is drawn by widgets.drawKeyGlyph) ----------------------
  key: [
    '########',
    '#wwwwww#',
    '#wwwwww#',
    '#wwwwww#',
    '#wwwwww#',
    '#oooooo#',
    '########',
    '........',
  ],
  button: [
    '..####..',
    '.#wwww#.',
    '#wwwwww#',
    '#wwwwww#',
    '#wwwwww#',
    '#oooooo#',
    '.#oooo#.',
    '..####..',
  ],
  tap: [
    '...##...',
    '..#..#..',
    '.#.##.#.',
    '...##...',
    '...##...',
    '..####..',
    '..#oo#..',
    '..####..',
  ],
  pad: [
    '........',
    '.######.',
    '##o##o##',
    '#o#o#oo#',
    '##o####.',
    '.##..##.',
    '........',
    '........',
  ],
  // ---- tells ----------------------------------------------------------------------------------
  glint: [
    '........',
    '...w....',
    '...#....',
    '.w###w..',
    '...#....',
    '...w....',
    '........',
    '........',
  ],
  bars: [
    '........',
    '.######.',
    '........',
    '.######.',
    '........',
    '.######.',
    '........',
    '........',
  ],
  wiggle: [
    '........',
    '.#......',
    '#.#..#..',
    '...##.#.',
    '.......#',
    '........',
    '........',
    '........',
  ],
  // ---- clock and tide --------------------------------------------------------------------------
  sun: [
    '#..##..#',
    '.#.oo.#.',
    '..oooo..',
    '#ooowoo#',
    '#oooooo#',
    '..oooo..',
    '.#.oo.#.',
    '#..##..#',
  ],
  moon: [
    '...####.',
    '..##w...',
    '.##.....',
    '.##.....',
    '.##.....',
    '.##.....',
    '..##....',
    '...####.',
  ],
  tideUp: [
    '...#....',
    '..###...',
    '.#####..',
    '...#....',
    '...#....',
    '.##..##.',
    '#..##..#',
    '........',
  ],
  tideDown: [
    '...#....',
    '...#....',
    '.#####..',
    '..###...',
    '...#....',
    '.##..##.',
    '#..##..#',
    '........',
  ],
  wave: [
    '........',
    '........',
    '.##..##.',
    '#..##..#',
    '........',
    '.##..##.',
    '#..##..#',
    '........',
  ],
  clock: [
    '..####..',
    '.#wwww#.',
    '#www#ww#',
    '#www#ww#',
    '#www##w#',
    '#wwwwww#',
    '.#wwww#.',
    '..####..',
  ],
  // ---- status ---------------------------------------------------------------------------------
  burn: [
    '....#...',
    '...##...',
    '..#o#...',
    '.#oo##..',
    '.#ooo#..',
    '#oowoo#.',
    '#owwwo#.',
    '.#####..',
  ],
  poison: [
    '...#..w.',
    '..###...',
    '.#ooo#..',
    '.#ooo#w.',
    '#ooooo#.',
    '#oo.oo#.',
    '.#ooo#..',
    '..###...',
  ],
  chill: [
    '.#.#.#..',
    '.#.#.#..',
    '.#.#.#..',
    '.#.#.#..',
    '.#.#....',
    '.#......',
    '.w......',
    '........',
  ],
  numb: [
    '........',
    '.######.',
    '#......#',
    '#.####.#',
    '#.#..#.#',
    '#.####.#',
    '#......#',
    '.######.',
  ],
  // ---- Heartmark (5px plus with diagonal glints) and Ward -------------------------------------
  heartmark: [
    '........',
    '.w.o.w..',
    '...o....',
    '.oowoo..',
    '...o....',
    '.w.o.w..',
    '........',
    '........',
  ],
  ward: [
    '...##...',
    '..#..#..',
    '.#....#.',
    '.#....#.',
    '.#....#.',
    '..#..#..',
    '...##...',
    '........',
  ],
  wardKnown: [
    '...##...',
    '..#..#..',
    '.#.ow.#.',
    '.#ooo.#.',
    '.#.o..#.',
    '..#..#..',
    '...##...',
    '........',
  ],
  // ---- type icons (unique silhouettes) ---------------------------------------------------------
  'type-plain': [
    '........',
    '..####..',
    '.#....#.',
    '.#.##.#.',
    '.#.##.#.',
    '.#....#.',
    '..####..',
    '........',
  ],
  'type-grit': [
    '........',
    '.##..##.',
    '#..##..#',
    '#.####.#',
    '#.####.#',
    '#..##..#',
    '.##..##.',
    '........',
  ],
  'type-brine': [
    '........',
    '..##....',
    '.#..#..#',
    '#....##.',
    '........',
    '..##....',
    '.#..#..#',
    '#....##.',
  ],
  'type-kiln': [
    '...##...',
    '..#..#..',
    '.#....#.',
    '#......#',
    '#.####.#',
    '#.#oo#.#',
    '#.#oo#.#',
    '########',
  ],
  'type-moss': [
    '........',
    '.#..#...',
    '.#.##.#.',
    '##.##.#.',
    '.#.##.##',
    '.####.#.',
    '..####..',
    '........',
  ],
  'type-bolt': [
    '....##..',
    '...##...',
    '..##....',
    '.#####..',
    '...##...',
    '..##....',
    '.##.....',
    '#.......',
  ],
  'type-rime': [
    '...#....',
    '.#.#.#..',
    '..###...',
    '#######.',
    '..###...',
    '.#.#.#..',
    '...#....',
    '........',
  ],
  'type-gust': [
    '........',
    '..####..',
    '.#....#.',
    '......#.',
    '.#####..',
    '........',
    '..###...',
    '.....#..',
  ],
  'type-stone': [
    '........',
    '........',
    '...##...',
    '..####..',
    '.######.',
    '.######.',
    '########',
    '........',
  ],
  'type-rust': [
    '..#..#..',
    '.######.',
    '##.##.##',
    '.##..##.',
    '.##..##.',
    '##.##.##',
    '.######.',
    '..#..#..',
  ],
  'type-glass': [
    '........',
    '..####..',
    '.#.#..#.',
    '#..#...#',
    '.#.#..#.',
    '..#..#..',
    '...##...',
    '........',
  ],
  'type-hollow': [
    '........',
    '..####..',
    '.#....#.',
    '#......#',
    '#......#',
    '.#....#.',
    '..####..',
    '........',
  ],
  'type-star': [
    '...#....',
    '...#....',
    '#######.',
    '.#####..',
    '..###...',
    '.##.##..',
    '#.....#.',
    '........',
  ],
  // ---- UI marks ----
  warn: [
    '...##...',
    '...##...',
    '..#oo#..',
    '..#oo#..',
    '.#.oo.#.',
    '.#....#.',
    '#..oo..#',
    '########',
  ],
  star: [
    '...#....',
    '..#o#...',
    '###o###.',
    '#ooooo#.',
    '.#ooo#..',
    '.#o#o#..',
    '##.#.##.',
    '........',
  ],
  info: [
    '..####..',
    '.#.oo.#.',
    '#......#',
    '#..oo..#',
    '#..oo..#',
    '#..oo..#',
    '.#....#.',
    '..####..',
  ],
  keyboard: [
    '........',
    '########',
    '#w.w.w.#',
    '#.w.w.w#',
    '#w.www.#',
    '########',
    '........',
    '........',
  ],
  // (marks)---------------------------------------------------------------------------
  check: [
    '........',
    '......#.',
    '.....##.',
    '....##..',
    '#..##...',
    '##.#....',
    '.##.....',
    '........',
  ],
  cross: [
    '........',
    '.#....#.',
    '.##..##.',
    '..####..',
    '..####..',
    '.##..##.',
    '.#....#.',
    '........',
  ],
  lock: [
    '..####..',
    '.#....#.',
    '.#....#.',
    '########',
    '#oooooo#',
    '#oo##oo#',
    '#oooooo#',
    '########',
  ],
  strike: [
    '......#.',
    '.....#..',
    '.######.',
    '...#....',
    '..#.....',
    '.######.',
    '#.......',
    '........',
  ],
  pin: [
    '...oo...',
    '..oooo..',
    '..oooo..',
    '...##...',
    '.######.',
    '...##...',
    '...#....',
    '...#....',
  ],
  coin: [
    '..####..',
    '.#oooo#.',
    '#oowwoo#',
    '#owoowo#',
    '#owoowo#',
    '#oowwoo#',
    '.#oooo#.',
    '..####..',
  ],
  more: [
    '........',
    '........',
    '########',
    '.######.',
    '..####..',
    '...##...',
    '........',
    '........',
  ],
  arrowRight: [
    '........',
    '#.......',
    '###.....',
    '#####...',
    '#######.',
    '#####...',
    '###.....',
    '#.......',
  ],
  shift: [
    '...##...',
    '..#..#..',
    '.#.##.#.',
    '#..##..#',
    '...##...',
    '...##...',
    '...##...',
    '...##...',
  ],
  tally: [
    '#.#.#.#.',
    '#.#.#o#.',
    '#.#o#.#.',
    '#o#.#.#.',
    '#.#.#.#.',
    '#.#.#.#.',
    '#.#.#.#.',
    '........',
  ],
  blank: [
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
  ],
});

/** Icon ids in a stable display order. */
export const ICON_NAMES = Object.freeze(Object.keys(ICON_ART));

/** Verb icons in the order the HUD cycles them. */
export const VERB_ICONS = Object.freeze(['talk', 'shake', 'fish', 'dig', 'read', 'lantern', 'door', 'sit']);

/** Status icons. */
export const STATUS_ICONS = Object.freeze({ burn: 'burn', poison: 'poison', chill: 'chill', numb: 'numb' });

/** Default accent per icon when the caller passes none. */
const DEFAULT_ACCENT = Object.freeze({
  burn: PALETTE.o, poison: PALETTE.p, chill: PALETTE.i, numb: PALETTE.y,
  heartmark: PALETTE.m, wardKnown: PALETTE.i, lantern: PALETTE.porchAmber, sun: PALETTE.porchAmber,
  coin: PALETTE.brass, pin: PALETTE.brass, lock: PALETTE.tallyLight, door: PALETTE.tallyLight,
  dig: PALETTE.tallyLight, shake: PALETTE.g, sit: PALETTE.tallyLight, read: PALETTE.waxRed,
  key: PALETTE.ledgerRule, button: PALETTE.ledgerRule, tap: PALETTE.waxRed, pad: PALETTE.ledgerRule,
  tally: PALETTE.waxRed, 'type-kiln': PALETTE.o, talk: PALETTE.inkSoft, fish: PALETTE.s,
  warn: PALETTE.o, star: PALETTE.y, info: PALETTE.s, clock: PALETTE.waxRed,
});

/** 11x11 wax seal blank (the only non-8x8 art here); an emblem is stamped into its centre. */
export const SEAL_ART = Object.freeze([
  '...#####...',
  '.##ooooo##.',
  '.#owwoooo#.',
  '#owooooooo#',
  '#ooooooooo#',
  '#ooooooooo#',
  '#ooooooooo#',
  '#ooooooooo#',
  '.#ooooooo#.',
  '.##ooooo##.',
  '...#####...',
]);

/** 5x5 emblems pressed into a seal (drawn in the seal's ink): role symbols, never colour alone. */
export const SEAL_EMBLEMS = Object.freeze({
  plus: ['..#..', '..#..', '#####', '..#..', '..#..'],
  check: ['....#', '...##', '#.##.', '###..', '.#...'],
  cross: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  star: ['..#..', '.###.', '#####', '.#.#.', '#...#'],
  none: ['.....', '.....', '.....', '.....', '.....'],
});

/**
 * Seal rows with an emblem stamped at (3,3).
 * @param {keyof typeof SEAL_EMBLEMS} emblem
 * @returns {string[]}
 */
export function sealRows(emblem = 'plus') {
  const e = SEAL_EMBLEMS[emblem] || SEAL_EMBLEMS.plus;
  return SEAL_ART.map((row, y) => {
    if (y < 3 || y > 7) return row;
    const er = e[y - 3];
    return row.slice(0, 3) + [...er].map((c, i) => (c === '#' ? '#' : row[3 + i])).join('') + row.slice(8);
  });
}

/** 32x32 bust silhouette for an empty portrait slot. */
export const PORTRAIT_PLACEHOLDER_ART = Object.freeze([
  '................................',
  '................................',
  '................................',
  '............########............',
  '..........############..........',
  '.........##############.........',
  '.........##############.........',
  '........################........',
  '........################........',
  '........################........',
  '........################........',
  '........################........',
  '.........##############.........',
  '.........##############.........',
  '..........############..........',
  '...........##########...........',
  '............########............',
  '.............######.............',
  '.............######.............',
  '...........##########...........',
  '.........##############.........',
  '.......##################.......',
  '......####################......',
  '.....######################.....',
  '....########################....',
  '....########################....',
  '...##########################...',
  '...##########################...',
  '...##########################...',
  '...##########################...',
  '................................',
  '................................',
]);

/**
 * @typedef {Object} IconColors
 * @property {string} [ink]    Colour of `#` (default desk ink).
 * @property {string} [accent] Colour of `o` (default per icon, else wax red).
 * @property {string} [light]  Colour of `w` (default lightest paper).
 */

/**
 * Resolve an icon sprite (cached). Unknown ids return the `blank` icon so a missing icon never
 * throws mid-frame; `hasIcon` tells you in advance.
 * @param {string} name
 * @param {IconColors} [colors]
 * @returns {import('../core/pixelart.js').Sprite}
 */
export function getIcon(name, colors) {
  const art = ICON_ART[name] || ICON_ART.blank;
  const c = colors || {};
  const palette = {
    '#': c.ink || COLORS.paper.ink,
    o: c.accent || DEFAULT_ACCENT[name] || PALETTE.waxRed,
    w: c.light || COLORS.paper.light,
    '.': null,
  };
  return decodeSprite(art, palette);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(ICON_ART, name);
}

/**
 * Draw an icon at `x,y` (top-left). Pass `scale` for 2x/3x.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} name
 * @param {number} x
 * @param {number} y
 * @param {IconColors & {scale?: number, alpha?: number}} [opts]
 */
export function drawIcon(ctx, name, x, y, opts) {
  const o = opts || {};
  let sprite = getIcon(name, o);
  if (o.scale && o.scale !== 1) sprite = decodeSprite(sprite, null, { scale: o.scale });
  drawSprite(ctx, sprite, Math.round(x), Math.round(y), o.alpha !== undefined ? { alpha: o.alpha } : undefined);
}

/**
 * The wax seal sprite.
 * @param {{fill?: string, light?: string, ink?: string, emblem?: keyof typeof SEAL_EMBLEMS}} [colors]
 * @returns {import('../core/pixelart.js').Sprite}
 */
export function getSeal(colors) {
  const c = colors || {};
  return decodeSprite(sealRows(c.emblem || 'plus'), {
    '#': c.ink || COLORS.wax.dark,
    o: c.fill || COLORS.wax.fill,
    w: c.light || COLORS.wax.light,
    '.': null,
  });
}

/**
 * Draw the wax seal with its top-left at `x,y` (11x11).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {{fill?: string, light?: string, ink?: string, emblem?: keyof typeof SEAL_EMBLEMS}} [colors]
 */
export function drawSeal(ctx, x, y, colors) {
  drawSprite(ctx, getSeal(colors), Math.round(x), Math.round(y));
}

/**
 * Placeholder bust for a missing portrait (32x32, two tones).
 * @param {{ink?: string}} [colors]
 * @returns {import('../core/pixelart.js').Sprite}
 */
export function getPortraitPlaceholder(colors) {
  return decodeSprite(PORTRAIT_PLACEHOLDER_ART, { '#': (colors && colors.ink) || COLORS.paper.deep, '.': null });
}
