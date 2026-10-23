/**
 * @module core/font
 *
 * Bitmap pixel fonts embedded in code (no external assets) plus canvas text
 * rendering through a lazily-built, per-colour glyph atlas.
 *
 * Two fonts ship:
 *  - `main`  : 5x7 proportional glyphs for ASCII 32..126, game symbols
 *              (◉ ✦ ♥ ★ ☾ ☀ ▲ ▼ ◀ ▶ ↑ ↓ ← → …) and accented vowels
 *              (é è ê á à ü ö ñ). Descender letters (g j p q y) hang 2px below.
 *  - `small` : 3x5 font for numbers and labels (digits, A-Z, punctuation,
 *              arrows). Lowercase letters are drawn as uppercase.
 *
 * Glyphs are encoded as string rows ('#' = pixel on, '.' = off) and parsed into
 * row bitmasks at import time. Nothing here touches `window`/`document` at
 * import time: measuring, wrapping, layout and ASCII rasterising are pure, and
 * the glyph atlas is only created the first time text is actually drawn.
 *
 * Coordinates passed to the draw functions are the top-left corner of the first
 * line's glyph cell (cap height), in logical pixels; they are rounded to whole
 * pixels so upscaled output stays crisp.
 */

/** Pixel character used in glyph rows. */
const ON = '#';

/**
 * Parse a compact glyph string (`rows` separated by '/') into a glyph record.
 * Rows may be narrower than `cellW`; the glyph width is the width of its rows.
 * Rows beyond `cellH` are descender rows and may be at most `descent` deep.
 *
 * @param {string} src Compact glyph source, e.g. '.#./#.#/###/#.#/#.#'.
 * @param {number} cellH Cap height (rows above the baseline) of the font.
 * @param {number} descent Maximum descender rows allowed.
 * @returns {Glyph} `rows` are the padded source rows, `bits` are per-row
 *   bitmasks whose most-significant bit is the leftmost pixel (bit `w-1`).
 */
function parseGlyph(src, cellH, descent) {
  const rows = src.split('/');
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  if (w === 0) throw new Error(`font: empty glyph '${src}'`);
  if (rows.length > cellH + descent) throw new Error(`font: glyph too tall '${src}'`);
  const padded = rows.map((r) => r.padEnd(w, '.'));
  while (padded.length < cellH) padded.push('.'.repeat(w));
  const bits = padded.map((r) => {
    let b = 0;
    for (let i = 0; i < w; i++) b = (b << 1) | (r[i] === ON ? 1 : 0);
    return b;
  });
  return { w, h: padded.length, rows: padded, bits, ink: bits.some((b) => b !== 0) };
}

/* ------------------------------------------------------------------------ */
/* Main font: 5x7 cell, 2 descender rows, proportional widths               */
/* ------------------------------------------------------------------------ */

/** @type {Record<string, string>} */
const MAIN_SRC = {
  '!': '#/#/#/#/#/./#',
  '"': '#.#/#.#/#.#/.../.../.../...',
  '#': '.#.#./.#.#./#####/.#.#./#####/.#.#./.#.#.',
  $: '..#../.####/#.#../.###./..#.#/####./..#..',
  '%': '##..#/##.#./...#./..#../.#.../.#.##/#..##',
  '&': '.##../#..#./#..#./.##../#.#.#/#..#./.##.#',
  "'": '#/#/././././.',
  '(': '.#/#./#./#./#./#./.#',
  ')': '#./.#/.#/.#/.#/.#/#.',
  '*': '...../#.#.#/.###./#####/.###./#.#.#/.....',
  '+': '...../..#../..#../#####/..#../..#../.....',
  ',': '../../../../../.#/.#/#.',
  '-': '..../..../..../####/..../..../....',
  '.': '././././././#',
  '/': '....#/....#/...#./..#../.#.../#..../#....',
  0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  1: '..#../.##../..#../..#../..#../..#../.###.',
  2: '.###./#...#/....#/...#./..#../.#.../#####',
  3: '#####/...#./..#../...#./....#/#...#/.###.',
  4: '...#./..##./.#.#./#..#./#####/...#./...#.',
  5: '#####/#..../####./....#/....#/#...#/.###.',
  6: '..##./.#.../#..../####./#...#/#...#/.###.',
  7: '#####/....#/...#./..#../.#.../.#.../.#...',
  8: '.###./#...#/#...#/.###./#...#/#...#/.###.',
  9: '.###./#...#/#...#/.####/....#/...#./.##..',
  ':': './././#/././#',
  ';': '../../../.#/../.#/.#/#.',
  '<': '...#/..#./.#../#.../.#../..#./...#',
  '=': '..../..../####/..../####/..../....',
  '>': '#.../.#../..#./...#/..#./.#../#...',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  '@': '.###./#...#/....#/.##.#/#.#.#/#.#.#/.###.',
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '###../#..#./#...#/#...#/#...#/#..#./###..',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.####',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '###/.#./.#./.#./.#./.#./###',
  J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  '[': '##/#./#./#./#./#./##',
  '\\': '#..../#..../.#.../..#../...#./....#/....#',
  ']': '##/.#/.#/.#/.#/.#/##',
  '^': '..#../.#.#./#...#/...../...../...../.....',
  _: '...../...../...../...../...../...../#####',
  '`': '#./.#/../../../../..',
  a: '..../..../.##./...#/.###/#..#/.###',
  b: '#.../#.../###./#..#/#..#/#..#/###.',
  c: '..../..../.###/#.../#.../#.../.###',
  d: '...#/...#/.###/#..#/#..#/#..#/.###',
  e: '..../..../.##./#..#/####/#.../.###',
  f: '.##/#../###/#../#../#../#..',
  g: '..../..../.###/#..#/#..#/#..#/.###/...#/.##.',
  h: '#.../#.../###./#..#/#..#/#..#/#..#',
  i: '#/./#/#/#/#/#',
  j: '.#/../.#/.#/.#/.#/.#/.#/#.',
  k: '#.../#.../#..#/#.#./##../#.#./#..#',
  l: '#/#/#/#/#/#/#',
  m: '...../...../##.#./#.#.#/#.#.#/#.#.#/#.#.#',
  n: '..../..../###./#..#/#..#/#..#/#..#',
  o: '..../..../.##./#..#/#..#/#..#/.##.',
  p: '..../..../###./#..#/#..#/#..#/###./#.../#...',
  q: '..../..../.###/#..#/#..#/#..#/.###/...#/...#',
  r: '.../.../#.#/##./#../#../#..',
  s: '..../..../.###/#.../.##./...#/###.',
  t: '.#./.#./###/.#./.#./.#./..#',
  u: '..../..../#..#/#..#/#..#/#..#/.###',
  v: '...../...../#...#/#...#/#...#/.#.#./..#..',
  w: '...../...../#...#/#...#/#.#.#/#.#.#/.#.#.',
  x: '..../..../#..#/#..#/.##./#..#/#..#',
  y: '..../..../#..#/#..#/#..#/#..#/.###/...#/.##.',
  z: '..../..../####/...#/.##./#.../####',
  '{': '.##/.#./.#./#../.#./.#./.##',
  '|': '#/#/#/#/#/#/#',
  '}': '##./.#./.#./..#/.#./.#./##.',
  '~': '...../...../.#..#/#.#.#/#..#./...../.....',
  // --- game symbols ---
  '◉': '...../.###./#...#/#.#.#/#.#.#/#...#/.###.',
  '✦': '..#../..#../.###./#####/.###./..#../..#..',
  '♥': '...../.#.#./#####/#####/#####/.###./..#..',
  '★': '..#../.###./#####/.###./.###./#...#/.....',
  '☾': '..###/.##../##.../##.../##.../.##../..###',
  '☀': '..#../#.#.#/.###./#####/.###./#.#.#/..#..',
  '▲': '...../..#../..#../.###./.###./#####/.....',
  '▼': '...../#####/.###./.###./..#../..#../.....',
  '◀': '...../....#/..###/#####/..###/....#/.....',
  '▶': '...../#..../###../#####/###../#..../.....',
  '↑': '..#../.###./#.#.#/..#../..#../..#../..#..',
  '↓': '..#../..#../..#../..#../#.#.#/.###./..#..',
  '←': '...../..#../.#.../#####/.#.../..#../.....',
  '→': '...../..#../...#./#####/...#./..#../.....',
  '…': '...../...../...../...../...../...../#.#.#',
  '•': '...../...../.##../.##../...../...../.....',
  '×': '...../#...#/.#.#./..#../.#.#./#...#/.....',
  '°': '.##./#..#/.##./..../..../..../....',
  // --- accented lowercase vowels + ñ ---
  'é': '..#./.#../.##./#..#/####/#.../.###',
  'è': '.#../..#./.##./#..#/####/#.../.###',
  'ê': '.##./#..#/.##./#..#/####/#.../.###',
  'á': '..#./.#../.##./...#/.###/#..#/.###',
  'à': '.#../..#./.##./...#/.###/#..#/.###',
  'ü': '#..#/..../#..#/#..#/#..#/#..#/.###',
  'ö': '#..#/..../.##./#..#/#..#/#..#/.##.',
  'ñ': '.#.#/#.#./###./#..#/#..#/#..#/#..#',
};

/* ------------------------------------------------------------------------ */
/* Small font: 3x5 cell, 1 descender row (digits, A-Z, labels)              */
/* ------------------------------------------------------------------------ */

/** @type {Record<string, string>} */
const SMALL_SRC = {
  '!': '#/#/#/./#',
  '"': '#.#/#.#/.../.../...',
  '#': '#.#/###/#.#/###/#.#',
  $: '.##/##./.#./.##/##.',
  '%': '#.#/..#/.#./#../#.#',
  '&': '.#./#../.#./#.#/.##',
  "'": '#/#/././.',
  '(': '.#/#./#./#./.#',
  ')': '#./.#/.#/.#/#.',
  '*': '.../#.#/.#./#.#/...',
  '+': '.../.#./###/.#./...',
  ',': '../../../.#/.#/#.',
  '-': '.../.../###/.../...',
  '.': './././././#',
  '/': '..#/..#/.#./#../#..',
  0: '###/#.#/#.#/#.#/###',
  1: '.#./##./.#./.#./###',
  2: '###/..#/###/#../###',
  3: '###/..#/.##/..#/###',
  4: '#.#/#.#/###/..#/..#',
  5: '###/#../###/..#/###',
  6: '###/#../###/#.#/###',
  7: '###/..#/..#/..#/..#',
  8: '###/#.#/###/#.#/###',
  9: '###/#.#/###/..#/###',
  ':': './#/././#',
  ';': '../.#/../.#/#.',
  '<': '..#/.#./#../.#./..#',
  '=': '.../###/.../###/...',
  '>': '#../.#./..#/.#./#..',
  '?': '###/..#/.##/.../.#.',
  '@': '###/#.#/###/#../###',
  A: '.#./#.#/###/#.#/#.#',
  B: '##./#.#/##./#.#/##.',
  C: '.##/#../#../#../.##',
  D: '##./#.#/#.#/#.#/##.',
  E: '###/#../##./#../###',
  F: '###/#../##./#../#..',
  G: '.##/#../#.#/#.#/.##',
  H: '#.#/#.#/###/#.#/#.#',
  I: '###/.#./.#./.#./###',
  J: '..#/..#/..#/#.#/.#.',
  K: '#.#/#.#/##./#.#/#.#',
  L: '#../#../#../#../###',
  M: '#.#/###/###/#.#/#.#',
  N: '##./#.#/#.#/#.#/#.#',
  O: '.#./#.#/#.#/#.#/.#.',
  P: '##./#.#/##./#../#..',
  Q: '###/#.#/#.#/###/..#',
  R: '##./#.#/##./#.#/#.#',
  S: '.##/#../.#./..#/##.',
  T: '###/.#./.#./.#./.#.',
  U: '#.#/#.#/#.#/#.#/###',
  V: '#.#/#.#/#.#/#.#/.#.',
  W: '#.#/#.#/###/###/#.#',
  X: '#.#/#.#/.#./#.#/#.#',
  Y: '#.#/#.#/.#./.#./.#.',
  Z: '###/..#/.#./#../###',
  '[': '##/#./#./#./##',
  '\\': '#../#../.#./..#/..#',
  ']': '##/.#/.#/.#/##',
  '^': '.#./#.#/.../.../...',
  _: '.../.../.../.../###',
  '`': '#./.#/../../..',
  '{': '.##/.#./#../.#./.##',
  '|': '#/#/#/#/#',
  '}': '##./.#./..#/.#./##.',
  '~': '.../#.#/.#./.../...',
  // --- game symbols ---
  '◉': '.#./###/###/###/.#.',
  '✦': '.#./###/.#./.../...',
  '♥': '.../#.#/###/.#./...',
  '★': '.#./###/.#./#.#/...',
  '☾': '.##/#../#../#../.##',
  '☀': '#.#/.#./###/.#./#.#',
  '▲': '.../.#./###/###/...',
  '▼': '.../###/###/.#./...',
  '◀': '..#/.##/###/.##/..#',
  '▶': '#../##./###/##./#..',
  '↑': '.#./###/.#./.#./.#.',
  '↓': '.#./.#./.#./###/.#.',
  '←': '.#./#../###/#../.#.',
  '→': '.#./..#/###/..#/.#.',
  '…': '...../...../...../...../#.#.#',
  '•': '.../.#./.#./.../...',
  '×': '.../#.#/.#./#.#/...',
  '°': '.#./#.#/.#./.../...',
};

/**
 * Characters that are drawn as another character in every font (typographic
 * variants, whitespace variants, uppercase accents the fonts do not carry).
 * @type {Record<string, string>}
 */
const ALIASES = {
  ' ': ' ', // nbsp
  ' ': ' ', // thin space
  '‘': "'", '’': "'", '‚': "'",
  '“': '"', '”': '"', '„': '"',
  '–': '-', '—': '-', '−': '-', // en dash, em dash, minus
  '•': '•', '●': '•', '∙': '•',
  '★': '★', '☆': '★', '✦': '✦', '✧': '✦',
  '♥': '♥', '❤': '♥', '♡': '♥',
  '◀': '◀', '◄': '◀', '▶': '▶', '►': '▶',
  '▲': '▲', '▼': '▼',
  '☽': '☾', '☾': '☾', '☀': '☀', '☉': '☀',
  '◉': '◉', '◎': '◉', '○': '◉',
  '←': '←', '↑': '↑', '→': '→', '↓': '↓',
  'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E', 'Á': 'A', 'À': 'A', 'Â': 'A', 'Ä': 'A',
  'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I', 'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Ö': 'O',
  'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U', 'Ñ': 'N', 'Ç': 'C',
  'ë': 'é', 'â': 'á', 'ä': 'á', 'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i',
  'ó': 'o', 'ò': 'o', 'ô': 'o', 'ú': 'u', 'ù': 'u', 'û': 'u', 'ç': 'c',
};

/**
 * Characters the small font lacks are drawn as these main-font equivalents
 * (uppercase for letters, base vowel for accents).
 * @type {Record<string, string>}
 */
const SMALL_FALLBACKS = {
  'é': 'E', 'è': 'E', 'ê': 'E', 'á': 'A', 'à': 'A', 'ü': 'U', 'ö': 'O', 'ñ': 'N',
};

/* ------------------------------------------------------------------------ */
/* Font definitions                                                          */
/* ------------------------------------------------------------------------ */

/**
 * @typedef {object} Glyph
 * @property {number} w Width in pixels.
 * @property {number} h Height in pixels including descender rows.
 * @property {string[]} rows Padded source rows ('#' on, '.' off).
 * @property {number[]} bits Per-row bitmask, bit `w-1` is the leftmost pixel.
 * @property {boolean} ink False for glyphs with no pixels (space).
 */

/**
 * @typedef {object} FontDef
 * @property {string} name Font name ('main' or 'small').
 * @property {number} cellW Nominal glyph width (widest regular glyph).
 * @property {number} cellH Cap height: rows above the baseline.
 * @property {number} descent Rows below the baseline reserved for descenders.
 * @property {number} leading Blank rows between lines.
 * @property {number} lineHeight `cellH + descent + leading`.
 * @property {number} gap Intrinsic blank columns between consecutive glyphs.
 * @property {number} spaceW Width of the space glyph.
 * @property {Map<string, Glyph>} glyphs Glyphs by character.
 * @property {Glyph} fallback Glyph drawn for unknown characters.
 */

/**
 * Build a font definition from compact glyph sources.
 * @param {string} name
 * @param {Record<string, string>} src
 * @param {{cellW: number, cellH: number, descent: number, leading: number, spaceW: number, fallback: string}} m
 * @returns {FontDef}
 */
function buildFont(name, src, m) {
  const glyphs = new Map();
  for (const [ch, g] of Object.entries(src)) glyphs.set(ch, parseGlyph(g, m.cellH, m.descent));
  const blank = '.'.repeat(m.spaceW);
  glyphs.set(' ', {
    w: m.spaceW,
    h: m.cellH,
    rows: Array.from({ length: m.cellH }, () => blank),
    bits: new Array(m.cellH).fill(0),
    ink: false,
  });
  return {
    name,
    cellW: m.cellW,
    cellH: m.cellH,
    descent: m.descent,
    leading: m.leading,
    lineHeight: m.cellH + m.descent + m.leading,
    gap: 1,
    spaceW: m.spaceW,
    glyphs,
    fallback: parseGlyph(m.fallback, m.cellH, m.descent),
  };
}

/**
 * The embedded fonts, by name.
 * @type {Readonly<Record<'main'|'small', FontDef>>}
 */
export const FONTS = Object.freeze({
  main: buildFont('main', MAIN_SRC, {
    cellW: 5, cellH: 7, descent: 2, leading: 1, spaceW: 3,
    fallback: '#####/#...#/#...#/#...#/#...#/#...#/#####',
  }),
  small: buildFont('small', SMALL_SRC, {
    cellW: 3, cellH: 5, descent: 1, leading: 1, spaceW: 2,
    fallback: '###/###/###/###/###',
  }),
});

/** Names of the available fonts. */
export const FONT_NAMES = Object.freeze(Object.keys(FONTS));

/**
 * Resolve a font option (name or definition) to a {@link FontDef}.
 * @param {string|FontDef|undefined} font
 * @returns {FontDef}
 * @throws {RangeError} For an unknown font name.
 */
export function getFont(font = 'main') {
  if (typeof font === 'object' && font !== null && font.glyphs instanceof Map) return font;
  const def = FONTS[/** @type {'main'|'small'} */ (font)];
  if (!def) throw new RangeError(`font: unknown font '${String(font)}' (expected ${FONT_NAMES.join('|')})`);
  return def;
}

/**
 * Resolve the glyph a character is drawn with in a font, following aliases and
 * the small font's uppercase fallback. Never returns undefined.
 * @param {string} ch A single character (code point).
 * @param {string|FontDef} [font='main']
 * @returns {Glyph}
 */
export function getGlyph(ch, font = 'main') {
  const def = getFont(font);
  const c = ALIASES[ch] ?? ch;
  const direct = def.glyphs.get(c);
  if (direct) return direct;
  if (def.name === 'small') {
    const alt = SMALL_FALLBACKS[c] ?? c.toUpperCase();
    const g = alt.length === 1 ? def.glyphs.get(alt) : undefined;
    if (g) return g;
  }
  return def.fallback;
}

/**
 * Whether a character has a dedicated glyph (directly or through an alias /
 * small-font uppercase fallback) rather than the fallback box.
 * @param {string} ch
 * @param {string|FontDef} [font='main']
 * @returns {boolean}
 */
export function hasGlyph(ch, font = 'main') {
  const def = getFont(font);
  return getGlyph(ch, def) !== def.fallback;
}

/**
 * Rows ('#'/'.') of the glyph a character resolves to. Handy for tests and
 * for building sprites out of letters.
 * @param {string} ch
 * @param {string|FontDef} [font='main']
 * @returns {string[]}
 */
export function glyphRows(ch, font = 'main') {
  return getGlyph(ch, font).rows.slice();
}

/* ------------------------------------------------------------------------ */
/* Text normalisation, layout, measuring, wrapping                           */
/* ------------------------------------------------------------------------ */

/**
 * Normalise arbitrary input into drawable text: coerces to string, unifies
 * line endings to '\n', expands tabs to two spaces and strips other control
 * characters. `null`/`undefined` become ''.
 * @param {unknown} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '  ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '');
}

/**
 * Split a string into user-perceived characters (code points).
 * @param {string} s
 * @returns {string[]}
 */
function chars(s) {
  return Array.from(s);
}

/**
 * @typedef {object} TextOptions
 * @property {string|FontDef} [font='main'] Font name or definition.
 * @property {number} [scale=1] Integer-friendly scale factor (> 0).
 * @property {number} [letterSpacing=0] Extra pixels (unscaled) between glyphs,
 *   on top of the font's intrinsic 1px gap. May be negative down to `-gap`.
 * @property {number} [lineSpacing=0] Extra pixels (unscaled) between lines.
 * @property {'left'|'center'|'right'} [align='left'] Horizontal anchor of `x`.
 * @property {number} [maxWidth] Wrap text to this many (scaled) pixels.
 */

/**
 * Validate and fill in text options.
 * @param {TextOptions|undefined} opts
 * @returns {{font: FontDef, scale: number, letterSpacing: number, lineSpacing: number, align: 'left'|'center'|'right', maxWidth: number|undefined}}
 */
function resolveOptions(opts) {
  const o = opts ?? {};
  const font = getFont(o.font);
  const scale = o.scale === undefined ? 1 : o.scale;
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError(`font: scale must be a positive number, got ${scale}`);
  const letterSpacing = o.letterSpacing === undefined ? 0 : o.letterSpacing;
  if (!Number.isFinite(letterSpacing) || letterSpacing < -font.gap) {
    throw new RangeError(`font: letterSpacing must be a finite number >= ${-font.gap}, got ${letterSpacing}`);
  }
  const lineSpacing = o.lineSpacing === undefined ? 0 : o.lineSpacing;
  if (!Number.isFinite(lineSpacing)) throw new RangeError(`font: lineSpacing must be finite, got ${lineSpacing}`);
  const align = o.align === undefined ? 'left' : o.align;
  if (align !== 'left' && align !== 'center' && align !== 'right') {
    throw new RangeError(`font: align must be left|center|right, got '${String(align)}'`);
  }
  const maxWidth = Number.isFinite(o.maxWidth) && /** @type {number} */ (o.maxWidth) > 0 ? o.maxWidth : undefined;
  return { font, scale, letterSpacing, lineSpacing, align, maxWidth };
}

/**
 * Unscaled width of a run of characters in a font.
 * @param {FontDef} font
 * @param {string[]} cs Characters.
 * @param {number} letterSpacing
 * @returns {number}
 */
function runWidth(font, cs, letterSpacing) {
  if (cs.length === 0) return 0;
  let w = 0;
  for (const c of cs) w += getGlyph(c, font).w;
  return w + (cs.length - 1) * (font.gap + letterSpacing);
}

/**
 * Word-wrap one paragraph (no newlines) to an unscaled width.
 * @param {FontDef} font
 * @param {string} para
 * @param {number} max Unscaled maximum line width.
 * @param {number} letterSpacing
 * @returns {string[]}
 */
function wrapParagraph(font, para, max, letterSpacing) {
  const fits = (s) => runWidth(font, chars(s), letterSpacing) <= max;
  /** @type {string[]} */
  const out = [];
  let line = '';
  let open = false; // the current line has been started (may still be '' at paragraph start)
  let swallow = false; // after a soft wrap, drop the spaces that caused it
  for (const word of para.split(' ')) {
    if (swallow && word === '') continue;
    swallow = false;
    const candidate = open ? `${line} ${word}` : word;
    if (fits(candidate)) {
      line = candidate;
      open = true;
      continue;
    }
    if (open) out.push(line.trimEnd());
    line = '';
    open = false;
    if (word === '') {
      swallow = true;
      continue;
    }
    if (fits(word)) {
      line = word;
      open = true;
      continue;
    }
    // A single word wider than the line: break it by characters.
    let chunk = '';
    for (const c of chars(word)) {
      if (chunk.length && !fits(chunk + c)) {
        out.push(chunk);
        chunk = '';
      }
      chunk += c;
    }
    line = chunk;
    open = true;
  }
  if (open || out.length === 0) out.push(line);
  return out;
}

/**
 * Word-wrap text so no line exceeds `maxWidthPx` (scaled pixels). Explicit
 * newlines are honoured; words wider than a line are broken by character; a
 * glyph wider than the line still gets a line of its own. When `maxWidthPx`
 * is not a positive finite number the text is only split on newlines.
 *
 * @param {unknown} text
 * @param {number} maxWidthPx
 * @param {TextOptions} [opts] `font`, `scale` and `letterSpacing` are used.
 * @returns {string[]} Lines (never empty; '' yields ['']).
 */
export function wrapText(text, maxWidthPx, opts) {
  const { font, scale, letterSpacing } = resolveOptions(opts);
  const paras = normalizeText(text).split('\n');
  if (!Number.isFinite(maxWidthPx) || maxWidthPx <= 0) return paras;
  const max = maxWidthPx / scale;
  return paras.flatMap((p) => wrapParagraph(font, p, max, letterSpacing));
}

/**
 * @typedef {object} LaidGlyph
 * @property {string} ch The source character.
 * @property {Glyph} glyph The glyph it resolved to.
 * @property {number} x Unscaled offset from the line's left edge.
 */

/**
 * @typedef {object} LaidLine
 * @property {string} text The line's text.
 * @property {LaidGlyph[]} glyphs Glyph placements.
 * @property {number} w Unscaled line width.
 * @property {number} x Unscaled horizontal offset of the line's left edge from the anchor.
 * @property {number} y Unscaled vertical offset of the line's cell top from the layout top.
 */

/**
 * @typedef {object} TextLayout
 * @property {LaidLine[]} lines
 * @property {number} w Unscaled width of the widest line.
 * @property {number} h Unscaled height (cap top of line 1 to descent of the last line).
 * @property {number} glyphCount Number of drawable characters (newlines excluded).
 * @property {FontDef} font
 * @property {number} scale
 * @property {number} letterSpacing
 * @property {number} lineAdvance Unscaled distance between consecutive line tops.
 * @property {'left'|'center'|'right'} align
 */

/**
 * Lay out text into positioned glyphs. Pure; shared by measuring, drawing and
 * the ASCII rasteriser so all three agree exactly.
 * @param {unknown} text
 * @param {TextOptions} [opts]
 * @returns {TextLayout}
 */
export function layoutText(text, opts) {
  const o = resolveOptions(opts);
  const { font, letterSpacing } = o;
  const lineStrings = o.maxWidth === undefined
    ? normalizeText(text).split('\n')
    : wrapText(text, o.maxWidth, o);
  const lineAdvance = font.lineHeight + o.lineSpacing;
  const step = font.gap + letterSpacing;
  let maxW = 0;
  let glyphCount = 0;
  const lines = lineStrings.map((s, i) => {
    /** @type {LaidGlyph[]} */
    const glyphs = [];
    let x = 0;
    for (const ch of chars(s)) {
      const glyph = getGlyph(ch, font);
      glyphs.push({ ch, glyph, x });
      x += glyph.w + step;
    }
    const w = glyphs.length ? x - step : 0;
    maxW = Math.max(maxW, w);
    glyphCount += glyphs.length;
    const ax = o.align === 'left' ? 0 : o.align === 'center' ? -w / 2 : -w;
    return { text: s, glyphs, w, x: ax, y: i * lineAdvance };
  });
  const h = (lines.length - 1) * lineAdvance + font.cellH + font.descent;
  return { lines, w: maxW, h, glyphCount, font, scale: o.scale, letterSpacing, lineAdvance, align: o.align };
}

/**
 * Measure text in scaled pixels. `h` spans from the cap top of the first line
 * to the descender bottom of the last (9px for one line of `main`, 6px for
 * `small`); use `ascent` (cap height) to centre labels on their letters.
 *
 * @param {unknown} text
 * @param {TextOptions} [opts]
 * @returns {{w: number, h: number, lines: number, lineHeight: number, ascent: number, descent: number}}
 */
export function measureText(text, opts) {
  return metricsOf(layoutText(text, opts));
}

/**
 * Render text to an ASCII bitmap ('#' = pixel, '.' = empty). Pure; useful for
 * tests, debugging and for stamping text into sprite data. Lines are aligned
 * inside a box as wide as the widest line.
 *
 * @param {unknown} text
 * @param {TextOptions} [opts] `scale` must be a positive integer here.
 * @returns {{w: number, h: number, rows: string[]}}
 */
export function rasterizeText(text, opts) {
  const l = layoutText(text, opts);
  if (!Number.isInteger(l.scale)) throw new RangeError(`font: rasterizeText needs an integer scale, got ${l.scale}`);
  const s = l.scale;
  const W = l.w * s;
  const H = l.h * s;
  const grid = Array.from({ length: H }, () => new Array(W).fill('.'));
  for (const line of l.lines) {
    const slack = l.w - line.w;
    const lx = l.align === 'left' ? 0 : l.align === 'center' ? Math.floor(slack / 2) : slack;
    for (const { glyph, x } of line.glyphs) {
      for (let r = 0; r < glyph.h; r++) {
        const bitsRow = glyph.bits[r];
        if (!bitsRow) continue;
        for (let c = 0; c < glyph.w; c++) {
          if (!((bitsRow >> (glyph.w - 1 - c)) & 1)) continue;
          for (let sy = 0; sy < s; sy++) {
            const row = grid[(line.y + r) * s + sy];
            for (let sx = 0; sx < s; sx++) {
              row[(lx + x + c) * s + sx] = ON;
            }
          }
        }
      }
    }
  }
  return { w: W, h: H, rows: grid.map((r) => r.join('')) };
}

/* ------------------------------------------------------------------------ */
/* Glyph atlas + canvas drawing (needs a canvas only when called)            */
/* ------------------------------------------------------------------------ */

/** Maximum number of colour atlases kept per font (least recently used wins). */
const ATLAS_LIMIT_PER_FONT = 32;

/**
 * @typedef {object} Atlas
 * @property {OffscreenCanvas|HTMLCanvasElement} canvas One row of every glyph, tinted.
 * @property {Map<Glyph, number>} frames Source x of each glyph in the atlas.
 */

/** @type {WeakMap<FontDef, Map<string, Atlas>>} */
const atlasCache = new WeakMap();

/**
 * Create a canvas of the given size using whatever the environment offers.
 * @param {number} w
 * @param {number} h
 * @returns {OffscreenCanvas|HTMLCanvasElement}
 */
function createCanvas(w, h) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(w, h);
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  throw new Error('font: drawText needs a canvas-capable environment (OffscreenCanvas or document)');
}

/**
 * Rasterise every glyph of a font into a single-row atlas in one colour.
 * @param {FontDef} font
 * @param {string} color CSS colour.
 * @returns {Atlas}
 */
function buildAtlas(font, color) {
  const glyphs = new Set(font.glyphs.values());
  glyphs.add(font.fallback);
  /** @type {Map<Glyph, number>} */
  const frames = new Map();
  let x = 0;
  for (const g of glyphs) {
    frames.set(g, x);
    x += g.w + 1;
  }
  const canvas = createCanvas(Math.max(1, x), font.cellH + font.descent);
  const ctx = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));
  ctx.fillStyle = color;
  for (const [g, gx] of frames) {
    for (let r = 0; r < g.h; r++) {
      const bits = g.bits[r];
      if (!bits) continue;
      let c = 0;
      while (c < g.w) {
        if (!((bits >> (g.w - 1 - c)) & 1)) {
          c++;
          continue;
        }
        let e = c + 1;
        while (e < g.w && (bits >> (g.w - 1 - e)) & 1) e++;
        ctx.fillRect(gx + c, r, e - c, 1);
        c = e;
      }
    }
  }
  return { canvas, frames };
}

/**
 * Fetch (or lazily build) the atlas for a font/colour pair.
 * @param {FontDef} font
 * @param {string} color
 * @returns {Atlas}
 */
function getAtlas(font, color) {
  let perFont = atlasCache.get(font);
  if (!perFont) {
    perFont = new Map();
    atlasCache.set(font, perFont);
  }
  const hit = perFont.get(color);
  if (hit) {
    perFont.delete(color); // refresh LRU position
    perFont.set(color, hit);
    return hit;
  }
  const atlas = buildAtlas(font, color);
  perFont.set(color, atlas);
  if (perFont.size > ATLAS_LIMIT_PER_FONT) perFont.delete(perFont.keys().next().value);
  return atlas;
}

/**
 * Drop every cached glyph atlas (e.g. after a palette change or to free memory).
 * Atlases are rebuilt lazily on the next draw.
 * @param {string|FontDef} [font] Only clear this font's atlases.
 */
export function clearGlyphCache(font) {
  if (font === undefined) {
    for (const def of Object.values(FONTS)) atlasCache.delete(def);
    return;
  }
  atlasCache.delete(getFont(font));
}

/**
 * Number of colour atlases currently cached for a font (diagnostics).
 * @param {string|FontDef} [font='main']
 * @returns {number}
 */
export function glyphCacheSize(font = 'main') {
  return atlasCache.get(getFont(font))?.size ?? 0;
}

/**
 * @typedef {object} DrawOptions
 * @property {string|FontDef} [font='main']
 * @property {number} [scale=1]
 * @property {string} [color='#ffffff'] CSS colour the glyphs are tinted with.
 * @property {'left'|'center'|'right'} [align='left'] Which edge of each line `x` anchors.
 * @property {boolean|string|{color?: string, dx?: number, dy?: number}} [shadow]
 *   Drop shadow: `true` for a 1px dark shadow down-right, a colour string, or
 *   an explicit spec (offsets in unscaled pixels).
 * @property {boolean|string|{color?: string, width?: number}} [outline]
 *   8-neighbour outline: `true` for 1px black, a colour string, or a spec.
 * @property {number} [maxWidth] Wrap to this many scaled pixels.
 * @property {number} [letterSpacing=0] Extra unscaled pixels between glyphs.
 * @property {number} [lineSpacing=0] Extra unscaled pixels between lines.
 * @property {number} [alpha=1] Multiplied into the context's globalAlpha.
 */

/**
 * @typedef {{w: number, h: number, lines: number, lineHeight: number, ascent: number, descent: number}} TextMetrics2
 */

/**
 * Normalise the `shadow` option.
 * @param {DrawOptions['shadow']} v
 * @returns {{color: string, dx: number, dy: number}|null}
 */
function shadowSpec(v) {
  if (!v) return null;
  const base = { color: 'rgba(0,0,0,0.6)', dx: 1, dy: 1 };
  if (v === true) return base;
  if (typeof v === 'string') return { ...base, color: v };
  return { ...base, ...v };
}

/**
 * Normalise the `outline` option.
 * @param {DrawOptions['outline']} v
 * @returns {{color: string, width: number}|null}
 */
function outlineSpec(v) {
  if (!v) return null;
  const base = { color: '#000000', width: 1 };
  if (v === true) return base;
  if (typeof v === 'string') return { ...base, color: v };
  const width = v.width === undefined ? 1 : v.width;
  if (!Number.isInteger(width) || width < 1) throw new RangeError(`font: outline width must be an integer >= 1, got ${width}`);
  return { color: v.color ?? base.color, width };
}

/**
 * Blit the first `limit` glyphs of a layout with one atlas at an offset.
 * @param {CanvasRenderingContext2D} ctx
 * @param {TextLayout} layout
 * @param {Atlas} atlas
 * @param {number} ox Rounded origin x (scaled px).
 * @param {number} oy Rounded origin y (scaled px).
 * @param {number} limit Number of glyphs to draw.
 */
function blitLayout(ctx, layout, atlas, ox, oy, limit) {
  const s = layout.scale;
  let left = limit;
  for (const line of layout.lines) {
    if (left <= 0) break;
    const dy = oy + Math.round(line.y * s);
    for (const { glyph, x } of line.glyphs) {
      if (left-- <= 0) return;
      if (!glyph.ink) continue;
      const sx = /** @type {number} */ (atlas.frames.get(glyph));
      ctx.drawImage(
        atlas.canvas, sx, 0, glyph.w, glyph.h,
        ox + Math.round((line.x + x) * s), dy, glyph.w * s, glyph.h * s,
      );
    }
  }
}

/**
 * Draw a prepared layout: outline pass, shadow pass, then the main colour.
 * @param {CanvasRenderingContext2D} ctx
 * @param {TextLayout} layout
 * @param {number} x
 * @param {number} y
 * @param {DrawOptions} o
 * @param {number} limit Glyphs to draw.
 */
function paintLayout(ctx, layout, x, y, o, limit) {
  if (!ctx || typeof ctx.drawImage !== 'function') throw new TypeError('font: drawText needs a 2D canvas context');
  const color = o.color === undefined ? '#ffffff' : o.color;
  if (typeof color !== 'string') throw new TypeError('font: color must be a CSS colour string');
  if (o.alpha !== undefined && !(o.alpha >= 0 && o.alpha <= 1)) throw new RangeError(`font: alpha must be within 0..1, got ${o.alpha}`);
  if (limit <= 0 || layout.glyphCount === 0) return;
  const s = layout.scale;
  const ox = Math.round(x);
  const oy = Math.round(y);
  const prevAlpha = ctx.globalAlpha;
  ctx.imageSmoothingEnabled = false;
  if (o.alpha !== undefined) ctx.globalAlpha = prevAlpha * o.alpha;
  const outline = outlineSpec(o.outline);
  if (outline) {
    const atlas = getAtlas(layout.font, outline.color);
    const r = outline.width;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx || dy) blitLayout(ctx, layout, atlas, ox + dx * s, oy + dy * s, limit);
      }
    }
  }
  const shadow = shadowSpec(o.shadow);
  if (shadow) {
    blitLayout(ctx, layout, getAtlas(layout.font, shadow.color), ox + Math.round(shadow.dx * s), oy + Math.round(shadow.dy * s), limit);
  }
  blitLayout(ctx, layout, getAtlas(layout.font, color), ox, oy, limit);
  ctx.globalAlpha = prevAlpha;
}

/**
 * Convert a layout to public metrics (scaled pixels).
 * @param {TextLayout} l
 * @returns {TextMetrics2}
 */
function metricsOf(l) {
  const s = l.scale;
  return {
    w: l.w * s,
    h: l.h * s,
    lines: l.lines.length,
    lineHeight: l.lineAdvance * s,
    ascent: l.font.cellH * s,
    descent: l.font.descent * s,
  };
}

/**
 * Draw text with the bitmap font. `x`,`y` is the top-left of the first line's
 * cap cell (or its top-centre / top-right for `align` center / right) and is
 * rounded to whole pixels. Glyphs come from a per-colour atlas that is built
 * on first use, so repeated draws are a single `drawImage` per glyph.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {unknown} text
 * @param {number} x
 * @param {number} y
 * @param {DrawOptions} [opts]
 * @returns {TextMetrics2} The measured size of what was laid out.
 */
export function drawText(ctx, text, x, y, opts = {}) {
  const layout = layoutText(text, opts);
  paintLayout(ctx, layout, x, y, opts, layout.glyphCount);
  return metricsOf(layout);
}

/**
 * Draw the first `visibleChars` characters of text (newlines are not counted;
 * spaces are), for typewriter effects. The full text is laid out and wrapped
 * first, so the visible prefix never reflows as more characters appear.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {unknown} text
 * @param {number} x
 * @param {number} y
 * @param {number} visibleChars Characters to show; clamped to 0..total
 *   (`Infinity` shows everything, NaN shows nothing).
 * @param {DrawOptions} [opts]
 * @returns {TextMetrics2 & {shown: number, total: number, done: boolean}}
 */
export function drawTextTyped(ctx, text, x, y, visibleChars, opts = {}) {
  const layout = layoutText(text, opts);
  const n = visibleChars === Infinity ? layout.glyphCount : Number.isFinite(visibleChars) ? Math.floor(visibleChars) : 0;
  const shown = Math.min(Math.max(0, n), layout.glyphCount);
  paintLayout(ctx, layout, x, y, opts, shown);
  return { ...metricsOf(layout), shown, total: layout.glyphCount, done: shown >= layout.glyphCount };
}
