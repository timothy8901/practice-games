/**
 * The one palette module (GDD-00 §14, ARCHITECTURE §1 / §8.4). [ART-SHARED]
 *
 * It unions, with exact hexes:
 * - {@link MASTER}: the 21-key sprite letter set, Sweetie-16 (GrafxKid) + `m c h u a`, with the values
 *   already in the creature prototype (`proto/creatures/sprites.js`). Creatures and Wildshift trainers
 *   index it by letter through {@link pal}. **Comet magenta `m` = `#FF5BD6`** is reserved
 *   ({@link MAGENTA_USES}).
 * - {@link COLORS}: the tile colour table (names -> hex) from `proto/tiles/tiles.js`, extended for the
 *   biomes GDD-00 §4 / §16 adds (moor, volcano, spa, drowned wood, ice, Spire and cottage interiors).
 *   Names that start with `!` are **LUT-exempt** (lamps, glowing mud, skyglass, runes, real flame):
 *   `art/atlas` never re-grades them, so they read as light at night.
 * - {@link ROOF_COLOURS} / {@link ROOF_RAMPS}: the eight roof choices of the Payment Ceremony (§16).
 * - {@link UI}: the keeper's-desk tokens of GDD-00 §14 (night ink, cream, deep blue, the two ambers,
 *   bioluminescent cyan, brass, ledger paper, wax red) plus the desk ramps the bible names.
 * - {@link CAST_HEX}: the character ramps adopted with `proto/chars` (Porchlight cast tokens).
 *
 * Rules enforced here and by `tools/lint-art.mjs`: no pure black or white anywhere; magenta-hued
 * colours only in reserved art; nothing grades below night ink (`world/lighting.gradeHex`).
 *
 * Pure data and string math: imports nothing, no DOM.
 * @module art/palette
 */

/** Darkest colour in the game; nothing is drawn or graded below it. */
export const NIGHT_INK = '#141B33';

/**
 * Sweetie-16 + the five extras = the 21 sprite letters (creature prototype values).
 * `k` is the 1px outline (never pure black), `w` the near-white highlight (never pure white).
 * @type {Readonly<Record<string, string>>}
 */
export const MASTER = Object.freeze({
  k: '#1A1C2C', // outline
  p: '#5D275D', // purple - Hollow
  r: '#B13E53', // red - Rust
  o: '#EF7D57', // orange - Kiln
  y: '#FFCD75', // yellow - Bolt, warm highlight, Heartmark centre on warm bodies
  l: '#A7F070', // light green
  g: '#38B764', // green - Moss
  t: '#257179', // teal
  n: '#29366F', // dark blue
  b: '#3B5DC9', // blue - Brine
  s: '#41A6F6', // sky - Rime
  i: '#73EFF7', // ice - Glass
  w: '#F4F4F4', // near-white - Gust, Heartmark centre on cool bodies
  v: '#94B0C2', // light grey - Plain
  e: '#566C86', // grey - Stone
  d: '#333C57', // dark grey - Star
  m: '#FF5BD6', // comet magenta - RESERVED (see MAGENTA_USES)
  c: '#F2C9A3', // skin light
  h: '#CF8A5E', // skin shade
  u: '#7A4B2E', // umber - Grit
  a: '#D9B38C', // tan
});

/** The 21 letters in canonical order. */
export const MASTER_KEYS = Object.freeze(Object.keys(MASTER));

/**
 * Build a palette subset from a string (or array) of master keys: `pal('kbsw')`.
 * @param {string|string[]} keys
 * @returns {Record<string, string>} letter -> hex
 * @throws {RangeError} on a letter outside {@link MASTER}
 */
export function pal(keys) {
  const p = {};
  for (const k of keys) {
    if (!Object.hasOwn(MASTER, k)) throw new RangeError(`pal: '${k}' is not a master key (${MASTER_KEYS.join('')})`);
    p[k] = MASTER[k];
  }
  return p;
}

/**
 * Battle type -> master letter (from `proto/battle/types.js`; the badge colour). `m` is never a type
 * colour. Keys are the display names the battle data uses.
 */
export const TYPE_PALETTE_KEY = Object.freeze({
  Plain: 'v', Grit: 'u', Brine: 'b', Kiln: 'o', Moss: 'g', Bolt: 'y', Rime: 's',
  Gust: 'w', Stone: 'e', Rust: 'r', Glass: 'i', Hollow: 'p', Star: 'd',
});

/**
 * Hex of a battle type's badge colour. Accepts `'Brine'` or `'brine'`.
 * @param {string} type
 * @returns {string}
 * @throws {RangeError} on an unknown type
 */
export function typeColour(type) {
  const name = typeof type === 'string' && type ? type[0].toUpperCase() + type.slice(1).toLowerCase() : '';
  const key = TYPE_PALETTE_KEY[name];
  if (!key) throw new RangeError(`typeColour: unknown type ${String(type)}`);
  return MASTER[key];
}

/**
 * Keeper's-desk UI tokens (GDD-00 §14 exact hexes, then the desk ramps from porchlight-visuals §5/§16).
 * HUD and cursor art drawn from these bypass the LUT.
 */
export const UI = Object.freeze({
  nightInk: '#141B33',
  cream: '#F6F1E3',
  deepBlue: '#2B3A67',
  porchAmber: '#F9C46B',
  lighthouseAmber: '#FFB547',
  bioCyan: '#3FF2E0',
  brass: '#D9A441',
  ledgerPaper: '#F4F1E6',
  waxRed: '#A8323A',
  // desk ramps named by the bible
  ledgerRule: '#C9A77C',
  deskInk: '#2A2433',
  tallyLight: '#C9A16B',
  tallyDark: '#7A5A36',
  comet: '#FF5BD6',
  // derived shades for UI art texture (shadows of the tokens above, never new hues)
  paperShade: '#E6DCC3',
  paperDeep: '#CDBF9E',
  waxLight: '#C9525C',
  waxDark: '#7A2228',
  brassDark: '#8A6A1E',
  brassLight: '#F2D27A',
  tallyDeep: '#4E3620',
  inkSoft: '#6B6275',
  skyDay: '#3FA7D6',
  skyHaze: '#B8CFE0',
  sunCore: '#FFE29A',
  sunLow: '#F28C28',
  moon: '#EAF2F8',
  moonShade: '#B8CFE0',
  cloudShade: '#94A3B4',
  cloudDark: '#6E7A86',
  overcast0: '#7E8C9C',
  overcast1: '#A8B4BE',
  overcast2: '#5E6A78',
  cometTail: '#F6A6E8',
  cometCore: '#FFE6F7',
});

/**
 * Tile colour table: name -> hex. `!name` = LUT-exempt light source. Light from the top-left; shadows
 * lean blue-violet, highlights lean warm cream; the darkest colour is night ink.
 * @type {Readonly<Record<string, string>>}
 */
export const COLORS = Object.freeze({
  ink: '#141B33', deep: '#2B3A67', uiink: '#2A2433', cream: '#F6F1E3',
  // the 1px base line under everything that blocks (trees, bushes, walls, cliffs) = master k
  base: '#1A1C2C',
  // grass
  grass0: '#2E5A48', grass1: '#3F7A5A', grass2: '#5E9E6A', grass3: '#7DB874', grass4: '#A8D5A2',
  // sand / wet sand (wet is two ramps darker, with a hard tide line)
  sand0: '#A98B64', sand1: '#C9A77C', sand2: '#E8D3A0', sand3: '#F4E8C1',
  wet0: '#6E5A44', wet1: '#8C7352', wet2: '#A98B64', bank: '#272026',
  // mud
  mud0: '#5A4A3E', mud1: '#7D6A58', mud2: '#A8927C',
  wmud0: '#43392F', wmud1: '#5A4E44', wmud2: '#6E6456', skyref: '#6E8CA8', skyref2: '#B8CFE0',
  gmud0: '#1E2B4A', gmud1: '#2B3A67',
  '!bio0': '#1F8F8A', '!bio1': '#3FF2E0', '!bio2': '#9FE8C8',
  // water
  deep0: '#173B5E', deep1: '#1F4F7A', deep2: '#2A6F8F', deep3: '#3FA7D6',
  sh0: '#2A6F8F', sh1: '#357F9C', sh2: '#3F9BB8', sh3: '#6FBFCF', dapple: '#8CCBC8',
  riv0: '#2A6F8F', riv1: '#3A8FA8', riv2: '#4FB3C9', riv3: '#9FD3C0',
  shm0: '#3E7A8C', shm1: '#4F93A4', shm2: '#79B8C2', shmud: '#7E9C92',
  foam: '#EAF2F8',
  // tannin water (Drownwood) and the warm spring pools (Emberstep spa)
  tan0: '#22302A', tan1: '#2F4236', tan2: '#466048', tan3: '#6E8A60',
  spr0: '#2A7F8C', spr1: '#3FA3AC', spr2: '#76CFCB', spr3: '#B4E8E0',
  // ice / snow (Rimeholt)
  ice0: '#3A6E96', ice1: '#5E9CC4', ice2: '#94CDE2', ice3: '#C8EAF2',
  snow0: '#8E9EBA', snow1: '#B4C6DA', snow2: '#D6E4EE', snow3: '#EAF2F8',
  // stone / cliff
  st0: '#2A2F44', st1: '#4F5A6B', st2: '#6E7A86', st3: '#8E9AA6', st4: '#B8CFE0',
  cl0: '#2A2433', cl1: '#4A3E44', cl2: '#6E5A58', cl3: '#8C7A6E', cl4: '#A8927C',
  // volcanic rock, ash (Emberstep)
  vo0: '#1C1922', vo1: '#2C2731', vo2: '#433B45', vo3: '#5E5359', vo4: '#7E7076',
  ash0: '#5A5458', ash1: '#77706F', ash2: '#958C86', ash3: '#B4AAA0',
  // travertine terraces (spa)
  tv0: '#9A8670', tv1: '#BDAA90', tv2: '#DACCB2', tv3: '#EFE4CE',
  // ground
  pa0: '#8E6B45', pa1: '#B08A5E', pa2: '#C9A77C', pa3: '#D9C19A',
  co0: '#4E4A5A', co1: '#6B6672', co2: '#8E8A86', co3: '#ABA6A0', co4: '#C4BFB6', co15: '#7C7780', cow1: '#857868', cow2: '#A39484',
  soil0: '#3E2C22', soil1: '#5A4030', soil2: '#7A5A40',
  // moor and marsh
  moor0: '#3E4A30', moor1: '#58663E', moor2: '#76844E', moor3: '#98A466',
  he0: '#3A2C44', he1: '#5E4668', he2: '#80688A', he3: '#A690AA',
  reed0: '#4E5A30', reed1: '#76823E', reed2: '#A2A85A', reed3: '#C8C47E',
  // wood / building
  wd0: '#4E3620', wd1: '#7A5A36', wd2: '#A5794B', wd3: '#C9A16B', wd4: '#E0BE86',
  ww0: '#38322E', ww1: '#544A42', ww2: '#766A5E', ww3: '#9C9082', ww4: '#BEB2A2',
  pl0: '#B8A88A', pl1: '#D6C8A6', pl2: '#EADFC4', pl3: '#F4E8C1',
  br0: '#6E2E24', br1: '#8A4432', br2: '#A8553C', br3: '#C27050',
  pane0: '#3B4A6B', pane1: '#6E8CA8', '!wglow': '#F6D8AE', '!amber': '#F9C46B',
  '!lampcore': '#FFE29A', '!lhamber': '#FFB547', brass: '#D9A441', brass0: '#8A6A1E', iron: '#3B3A48', iron2: '#5A5868',
  // real flame (the only saturated warms after dark besides the two ambers)
  '!fire0': '#C2502A', '!fire1': '#F28C28', '!fire2': '#FFE29A',
  // roofs: [dark, shade, base, light]
  slate0: '#2F3A4C', slate1: '#3F4D60', slate2: '#5B6B7E', slate3: '#7A8CA0',
  red0: '#6E2E24', red1: '#8A3426', red2: '#B5452E', red3: '#D1664A',
  moss0: '#2E5A48', moss1: '#3F6B44', moss2: '#5E8C5A', moss3: '#7FA86A',
  blue0: '#1E3350', blue1: '#2B466B', blue2: '#3B5F8C', blue3: '#5B82B0',
  straw0: '#7A5A36', straw1: '#B08A42', straw2: '#D9B46A', straw3: '#EBD08A',
  dark0: '#2A2433', dark1: '#3B3A48', dark2: '#4E4C62', dark3: '#6A6882',
  teal0: '#163E44', teal1: '#22545A', teal2: '#327078', teal3: '#4E9098',
  ochre0: '#6A461E', ochre1: '#8E6228', ochre2: '#B4823A', ochre3: '#D6A65A',
  // interiors: wallpapers and rugs (cottage tiers), Spire accents
  wpb0: '#3E5468', wpb1: '#5A7488', wpb2: '#7E98A8',
  wpg0: '#4A5E44', wpg1: '#667C5A', wpg2: '#8AA078',
  rug0: '#6E2A2A', rug1: '#8E3A32', rug2: '#B8604A', rug3: '#D9A066',
  // flora
  pinek: '#11262A', pine0: '#1F4A3C', pine1: '#2E5A48', pine2: '#3F7A5A', pine3: '#5E9E6A', pine4: '#7FB08A',
  ald0: '#3F7A5A', ald1: '#5E9E6A', ald2: '#7DB874', ald3: '#A8D5A2', aldbark0: '#5A4A3E', aldbark1: '#8C7A6E', aldbark2: '#B8A88A',
  fr0: '#2E5A48', fr1: '#4F8A52', fr2: '#6BAA75', fr3: '#8FC27C', pear: '#F3C178', pear2: '#FFE29A', pear0: '#B08A42',
  mg0: '#33291F', mg1: '#4E4030', mg2: '#6E5E48', mgl0: '#24402E', mgl1: '#33583C', mgl2: '#4C7A4C', mgl3: '#6E9C5E',
  blossom: '#F2A7B5', blossom2: '#E07A9A', marigold: '#F28C28', petal: '#F6F1E3', yellow: '#FFE29A',
  glass0: '#7A1E2C', glass1: '#A3283A', glass2: '#C9504A',
  // skyglass (the only magenta in the world), its spent state, and the Waystone rune
  '!m0': '#8E2D80', '!m1': '#E04FC0', '!m2': '#F6A6E8', sgd0: '#3E3446', sgd1: '#5E5268', sgd2: '#86798E',
  '!rune': '#73EFF7', '!runew': '#F6F1E3', rune0: '#4A6E7A', rune1: '#6E94A0',
  shadow: '#2B3A67',
});

/** The eight roof choices (GDD-00 §16: roof colours = 8). Order is the swatch order. */
export const ROOF_COLOURS = Object.freeze(['slate', 'red', 'moss', 'blue', 'straw', 'dark', 'teal', 'ochre']);

/** Display names for the roof swatches. */
export const ROOF_NAMES = Object.freeze({
  slate: 'Slate', red: 'Brick red', moss: 'Moss', blue: 'Harbor blue', straw: 'Thatch', dark: 'Tar black',
  teal: 'Verdigris', ochre: 'Ochre',
});

/** Roof ramps `[dark, shade, base, light]` (colour names in {@link COLORS}). */
export const ROOF_RAMPS = Object.freeze(Object.fromEntries(
  ROOF_COLOURS.map((c) => [c, Object.freeze([`${c}0`, `${c}1`, `${c}2`, `${c}3`])]),
));

/**
 * The cast ramps adopted with `proto/chars` (per-character palettes and busts use these hexes
 * directly). The character lane appends here when it adds a colour; the linter checks against it.
 */
export const CAST_HEX = Object.freeze([
  '#141B33', '#141B3366', '#171522', '#1A1C2C', '#1E1E28', '#1E2433', '#1E2A33', '#1E2A4A', '#1F1D2A', '#241A1C',
  '#257179', '#26363F', '#29366F', '#2A1C12', '#2A1C22', '#2A2433', '#2A2838', '#2A3340', '#2A3A33', '#2A6F8F',
  '#2B3A67', '#2E1C12', '#2E3A2C', '#33301F', '#333C57', '#34505C', '#38B764', '#3A1F1C', '#3A2018', '#3A2410',
  '#3A2818', '#3A2830', '#3A3440', '#3A3848', '#3A5246', '#3A5A9A', '#3B4A6B', '#3B5DC9', '#3E2618', '#3E2C2C',
  '#3E3240', '#3E5660', '#3FAE8C', '#41A6F6', '#4A2A22', '#4A2D2E', '#4A3038', '#4A3222', '#4A3A44', '#4A4862',
  '#4E3418', '#4E6E5D', '#4F6D7A', '#566A5C', '#566C86', '#5A3A2A', '#5A3A30', '#5A4030', '#5A4A3E', '#5A4A44',
  '#5A4A8F', '#5A4E34', '#5C4028', '#5D275D', '#5F5F70', '#5F7A85', '#5F9A8E', '#607486', '#66573E', '#6A4330',
  '#6A4A52', '#6A5A3A', '#6B4A32', '#6E2A2A', '#6E93A8', '#6F8F99', '#73EFF7', '#7A1E2C', '#7A2E20', '#7A3B4E',
  '#7A4630', '#7A5A1E', '#7A5A36', '#7A5C44', '#7A6A5A', '#7A6E4A', '#7A8C74', '#7AB8A4', '#7E5260', '#7F7A96',
  '#7F98A0', '#8A4F1A', '#8A5A3B', '#8A6646', '#8A6A1E', '#8A6A72', '#8A8A96', '#8B3620', '#8C7A5A', '#8E8E9C',
  '#8EA0B0', '#94B0C2', '#9AB8C6', '#9FC7D6', '#9FD3C0', '#A0727A', '#A3283A', '#A7F070', '#A8323A', '#A8402E',
  '#A8683A', '#A8807A', '#A8904A', '#A8927C', '#A89A6E', '#A89A88', '#A8A8B4', '#A9B8A0', '#B07A2A', '#B07A52',
  '#B13E53', '#B4A880', '#B4B4C0', '#B57A84', '#B8862F', '#B8906C', '#B89C84', '#B8A888', '#B8AA94', '#B8C8D4',
  '#B8CFE0', '#B9B4C4', '#BFA478', '#C0742A', '#C2502A', '#C3D0BA', '#C8C4CC', '#C8D2DA', '#C96A1A', '#C97B2C',
  '#C9A070', '#C9A090', '#C9A16B', '#C9A77C', '#C9B48A', '#C9BD8C', '#CC8E54', '#CDBBA4', '#CFE2EA', '#CFE7F2',
  '#D0545A', '#D6CCB4', '#D8C79B', '#D98A9C', '#D9907A', '#D9A066', '#D9A3A0', '#D9A441', '#D9CBB0', '#D9CFA8',
  '#DDCCA0', '#E06A4F', '#E07A3F', '#E07A9A', '#E0C77A', '#E39A4F', '#E3A0A8', '#E3B867', '#E3C08E', '#E4DCCB',
  '#E6DCC4', '#E8D3A0', '#E8EDF0', '#E9C08A', '#E9D3B0', '#E9F7F2', '#EADCB8', '#EF7D57', '#EFE6CF', '#EFE6D6',
  '#F1EEE6', '#F28C28', '#F29A7A', '#F2A541', '#F2A7B5', '#F2C14E', '#F2D27A', '#F3C178', '#F4E8C1', '#F4F1E6',
  '#F4F4F4', '#F6D8AE', '#F6E3A0', '#F6EAD2', '#F6F1E3', '#F9C46B', '#F9D1D9', '#FF5BD6', '#FFCD75', '#FFE29A',
  '#FFF3D6',
]);

/* ------------------------------------------------------------ LUT exemption */

/**
 * What bypasses the hour LUT (GDD-00 §14): lamps, glowing mud, skyglass, Heartmarks, HUD and cursor
 * (plus runes and real flame, which are light sources by the same rule). Tile palettes mark these by
 * the `!` prefix on the colour name; sprite palettes (hex) list them here.
 */
export const LUT_EXEMPT = Object.freeze({
  lamps: Object.freeze(['!amber', '!lampcore', '!lhamber', '!wglow']),
  glowingMud: Object.freeze(['!bio0', '!bio1', '!bio2']),
  skyglass: Object.freeze(['!m0', '!m1', '!m2']),
  runes: Object.freeze(['!rune', '!runew']),
  flame: Object.freeze(['!fire0', '!fire1', '!fire2']),
  /** Heartmark pixels: the plus in `m`, its `w` / `y` centre and the `k` rim on light bodies. */
  heartmark: Object.freeze([MASTER.m, MASTER.w, MASTER.y, MASTER.k]),
  /** Every art kind drawn as HUD (art/ui.js, the Skyband pieces, wax seals, tally sticks). */
  hud: Object.freeze(['ui']),
  /** The pointing-hand cursor and focus marks. */
  cursor: Object.freeze(['ui-cursor', 'ui-cursor-small', 'ui-focus-corner']),
});

/** Art kinds that never go through the LUT. */
export const LUT_EXEMPT_KINDS = Object.freeze(['ui']);

/**
 * Whether a palette value bypasses the LUT: a `!`-named tile colour, or a reserved light hex
 * (comet magenta, the two ambers, bioluminescent cyan) in a hex palette.
 * @param {string} value colour name or hex
 * @returns {boolean}
 */
export function isLutExempt(value) {
  if (typeof value !== 'string' || !value) return false;
  if (value[0] === '!') return true;
  if (value[0] !== '#') return false;
  return EXEMPT_HEX.has(value.slice(0, 7).toUpperCase());
}
const EXEMPT_HEX = new Set([MASTER.m, UI.porchAmber, UI.lighthouseAmber, UI.bioCyan].map((h) => h.toUpperCase()));

/* ------------------------------------------------------------ magenta rule */

/**
 * Where comet magenta (and any magenta-hued colour) may appear (GDD-00 §14). Art that uses one must
 * declare `reserved: <one of these>`; the linter rejects it anywhere else.
 */
export const MAGENTA_USES = Object.freeze(['heartmark', 'skyglass', 'shift', 'forecast', 'comet', 'vagary']);

/**
 * Whether a hex reads as magenta (hue 288..338 degrees, saturated, mid lightness). Purples like
 * master `p` and dusky heathers are deliberately outside: they are low in saturation or value.
 * @param {string} hex `#rrggbb` (alpha ignored)
 * @returns {boolean}
 */
export function isMagentaHex(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return false;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-6) return false;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return h >= 288 && h <= 338 && s >= 0.45 && l >= 0.3 && l <= 0.9;
}

/* ------------------------------------------------------------ queries */

/**
 * Parses `#rgb`, `#rrggbb` or `#rrggbbaa` into `[r, g, b]` (0..255), or `null`.
 * @param {string} hex
 * @returns {number[]|null}
 */
export function parseHex(hex) {
  if (typeof hex !== 'string') return null;
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = /^#([0-9a-f]{3})$/i.exec(hex);
  if (m) return [0, 1, 2].map((i) => parseInt(m[1][i] + m[1][i], 16));
  return null;
}

/**
 * Whether a hex is pure black or pure white (banned everywhere).
 * @param {string} hex
 * @returns {boolean}
 */
export function isPureBlackOrWhite(hex) {
  const c = parseHex(hex);
  if (!c) return false;
  return (c[0] === 0 && c[1] === 0 && c[2] === 0) || (c[0] === 255 && c[1] === 255 && c[2] === 255);
}

/**
 * Resolves a palette value to `#RRGGBB` (upper case; alpha dropped): a {@link COLORS} name (with or
 * without its `!`), a {@link MASTER} letter, a {@link UI} token, or a hex.
 * @param {string} value
 * @returns {string}
 * @throws {RangeError} on an unknown name
 */
export function hexOf(value) {
  if (typeof value === 'string') {
    if (value[0] === '#') {
      const c = parseHex(value);
      if (c) return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    } else if (Object.hasOwn(COLORS, value)) return COLORS[value].toUpperCase();
    else if (Object.hasOwn(COLORS, '!' + value)) return COLORS['!' + value].toUpperCase();
    else if (value.length === 1 && Object.hasOwn(MASTER, value)) return MASTER[value];
    else if (Object.hasOwn(UI, value)) return UI[value].toUpperCase();
  }
  throw new RangeError(`palette: unknown colour ${JSON.stringify(value)}`);
}

/**
 * Every colour the game may draw, upper-case `#RRGGBB` (alpha dropped): MASTER + COLORS + UI + cast.
 * @type {ReadonlySet<string>}
 */
export const ALL_HEX = Object.freeze(new Set([
  ...Object.values(MASTER), ...Object.values(COLORS), ...Object.values(UI), ...CAST_HEX,
].map((h) => hexOf(h))));

/**
 * Whether a hex is in the game palette ({@link ALL_HEX}). Alpha is ignored (a translucent shadow of a
 * palette colour is still that colour).
 * @param {string} hex
 * @returns {boolean}
 */
export function inPalette(hex) {
  const c = parseHex(hex);
  if (!c) return false;
  return ALL_HEX.has('#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase());
}
