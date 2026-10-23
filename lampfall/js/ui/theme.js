/**
 * UI theme tokens. [UI-KIT] — ARCHITECTURE-DRAFT §7.
 *
 * Pure data: colours, the 4px spacing grid, type metrics, timing constants, the 13 type chips and
 * the explicit-state strings. Every hex here comes from the two art bibles (Porchlight §9.1/§16
 * "keeper's desk" and Wildshift §3.3/§3.11 Sweetie-16 roles) except the handful marked *derived*,
 * which are shades of a bible colour for texture and shadow work. There is no pure black and no
 * pure white anywhere in this file (`test/ui.theme.test.mjs` enforces it): the darkest ink is
 * night ink `#141B33`, the lightest paper is `#F6F1E3`.
 *
 * Rule carried by every widget in the kit: **nothing means anything by colour alone**. Each role
 * colour pairs with a word or a glyph (`ROLE_GLYPH`), each type chip has a unique icon and a
 * 3-letter code, and each bar kind has its own fill texture.
 * @module ui/theme
 */

/** Raw palette, named after its source. Bible colours unless noted. */
export const PALETTE = Object.freeze({
  // --- Porchlight: the keeper's desk (porchlight-visuals §9.1, §16) ---
  ledgerPaper: '#F4F1E6',
  paperLightest: '#F6F1E3',
  ledgerRule: '#C9A77C',
  deskInk: '#2A2433',
  waxRed: '#A8323A',
  tallyLight: '#C9A16B',
  tallyDark: '#7A5A36',
  brass: '#D9A441',
  porchAmber: '#F9C46B',
  nightInk: '#141B33',
  deepBlue: '#2B3A67',
  autumnStraw: '#F3C178',
  autumnRust: '#B5452E',
  winterLight: '#EAF2F8',
  winterSlate: '#6E8CA8',
  winterGlow: '#F6D8AE',
  springBlossom: '#F2A7B5',
  nightMint: '#9FE8C8',
  // --- derived shades of the desk colours (not in a bible; shadow/texture only) ---
  paperShade: '#E6DCC3',
  paperDeep: '#CDBF9E',
  paperGrain: '#EDE6D2',
  inkSoft: '#6B6275',
  inkFaint: '#9A9087',
  waxLight: '#C9525C',
  waxDark: '#7A2228',
  brassDark: '#9C7126',
  // --- Wildshift master keys (wildshift-visuals §3.3 proposed mapping) ---
  k: '#1A1C2C', p: '#5D275D', r: '#B13E53', o: '#EF7D57', y: '#FFCD75', l: '#A7F070',
  g: '#38B764', t: '#257179', n: '#29366F', b: '#3B5DC9', s: '#41A6F6', i: '#73EFF7',
  w: '#F4F4F4', v: '#94B0C2', e: '#566C86', d: '#333C57',
  /** Comet magenta: the bible leaves `m` to the art lead; this reads as magenta next to `p`. */
  m: '#E65CC0',
});

/** Semantic colour tokens used by every widget. */
export const COLORS = Object.freeze({
  paper: Object.freeze({
    fill: PALETTE.ledgerPaper,
    light: PALETTE.paperLightest,
    shade: PALETTE.paperShade,
    deep: PALETTE.paperDeep,
    grain: PALETTE.paperGrain,
    rule: PALETTE.ledgerRule,
    edge: PALETTE.tallyDark,
    ink: PALETTE.deskInk,
    inkSoft: PALETTE.inkSoft,
    inkFaint: PALETTE.inkFaint,
    margin: PALETTE.waxRed,
  }),
  dark: Object.freeze({
    fill: PALETTE.n,
    border: PALETTE.v,
    inner: PALETTE.d,
    text: PALETTE.w,
    textSoft: PALETTE.v,
    edge: PALETTE.k,
  }),
  wax: Object.freeze({ fill: PALETTE.waxRed, light: PALETTE.waxLight, dark: PALETTE.waxDark, text: PALETTE.paperLightest }),
  brass: Object.freeze({ fill: PALETTE.brass, dark: PALETTE.brassDark, light: PALETTE.porchAmber }),
  tally: Object.freeze({ light: PALETTE.tallyLight, dark: PALETTE.tallyDark }),
  role: Object.freeze({
    safe: PALETTE.g,
    warn: PALETTE.o,
    danger: PALETTE.r,
    disabled: PALETTE.e,
    unique: PALETTE.y,
    info: PALETTE.s,
    shift: PALETTE.m,
  }),
  focus: Object.freeze({
    /** Dotted ring + cursor on paper panels. */
    ringOnPaper: PALETTE.deskInk,
    cursorOnPaper: PALETTE.waxRed,
    bandOnPaper: PALETTE.paperShade,
    /** The same on dark panels. */
    ringOnDark: PALETTE.w,
    cursorOnDark: PALETTE.y,
    bandOnDark: PALETTE.d,
    /** Pointer hover (lighter than keyboard focus; hidden on keyboard/gamepad). */
    hoverOnPaper: PALETTE.paperGrain,
    hoverOnDark: PALETTE.deepBlue,
  }),
  bar: Object.freeze({
    hp: PALETTE.g, hpLow: PALETTE.o, hpCrit: PALETTE.r,
    exp: PALETTE.s, glow: PALETTE.porchAmber, bond: PALETTE.springBlossom,
    track: PALETTE.paperDeep, trackDark: PALETTE.d,
  }),
  night: Object.freeze({ ink: PALETTE.nightInk, blue: PALETTE.deepBlue, amber: PALETTE.porchAmber }),
  shadow: 'rgba(20, 27, 51, 0.35)',
  dim: 'rgba(20, 27, 51, 0.55)',
});

/**
 * Every role pairs with a glyph (a symbol the bitmap font really has) so colour is never the only
 * channel. The font has no check mark, so `safe` draws as `+` in running text; widgets that have
 * room draw the 8x8 icon from `ROLE_ICON` instead.
 */
export const ROLE_GLYPH = Object.freeze({
  safe: '+', warn: '!', danger: '×', disabled: '–', unique: '★', info: '•', shift: '✦',
});

/** The 8x8 icon (ui/icons) for each role. */
export const ROLE_ICON = Object.freeze({
  safe: 'check', warn: 'warn', danger: 'cross', disabled: 'strike', unique: 'star', info: 'info', shift: 'heartmark',
});

/** Spacing grid: everything in the kit snaps to 4px (2px for hairline insets). */
export const GRID = 4;
export const SPACE = Object.freeze({ hair: 1, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 24 });

/**
 * Snap a length to the grid (never below one cell).
 * @param {number} n
 * @param {number} [cell=GRID]
 * @returns {number}
 */
export function snap(n, cell = GRID) {
  return Math.max(cell, Math.round(n / cell) * cell);
}

/** Type metrics for `core/font`: main is 5x7 + 2 descender + 1 leading, small is 3x5. */
export const TYPE = Object.freeze({
  body: 'main',
  label: 'small',
  lineH: 10,
  smallLineH: 7,
  capH: 7,
  smallCapH: 5,
  /** Cursor glyph drawn left of the focused item. */
  cursor: '▶',
  more: '▼',
  currency: '◉',
});

/** Timing constants shared by widgets (ms). */
export const TIMING = Object.freeze({
  inputLockMs: 500,
  /** Dialogue choices ignore input this long after they appear (mash-through guard, not a timer). */
  choiceLockMs: 250,
  toastMs: 3000,
  toastSlideMs: 180,
  toastFadeMs: 300,
  toolRingHoldMs: 220,
  toolRingOpenMs: 120,
  tooltipMs: 1600,
  repeatDelayMs: 300,
  repeatRateMs: 80,
  cursorBobMs: 520,
  /** Typewriter beat pauses. */
  beatCommaMs: 90,
  beatStopMs: 220,
});

/** Typewriter speeds in characters per second (`instant` reveals the page at once). */
export const TEXT_SPEEDS = Object.freeze({ slow: 22, normal: 45, fast: 90, instant: Infinity });

/**
 * The 13 types: 3-letter code (wildshift-visuals §15.1), word, colour and a unique icon id.
 * Star deliberately avoids the four-point sparkle and `m` is never used by a chip (§4.3).
 * @type {Readonly<Record<string, {code: string, word: string, color: string, ink: string, icon: string}>>}
 */
export const TYPE_CHIPS = Object.freeze({
  plain: Object.freeze({ code: 'PLN', word: 'Plain', color: PALETTE.v, ink: PALETTE.k, icon: 'type-plain' }),
  grit: Object.freeze({ code: 'GRT', word: 'Grit', color: PALETTE.tallyLight, ink: PALETTE.k, icon: 'type-grit' }),
  brine: Object.freeze({ code: 'BRN', word: 'Brine', color: PALETTE.s, ink: PALETTE.k, icon: 'type-brine' }),
  kiln: Object.freeze({ code: 'KLN', word: 'Kiln', color: PALETTE.o, ink: PALETTE.k, icon: 'type-kiln' }),
  moss: Object.freeze({ code: 'MOS', word: 'Moss', color: PALETTE.g, ink: PALETTE.k, icon: 'type-moss' }),
  bolt: Object.freeze({ code: 'BLT', word: 'Bolt', color: PALETTE.y, ink: PALETTE.k, icon: 'type-bolt' }),
  rime: Object.freeze({ code: 'RIM', word: 'Rime', color: PALETTE.i, ink: PALETTE.k, icon: 'type-rime' }),
  gust: Object.freeze({ code: 'GST', word: 'Gust', color: PALETTE.winterLight, ink: PALETTE.k, icon: 'type-gust' }),
  stone: Object.freeze({ code: 'STN', word: 'Stone', color: PALETTE.e, ink: PALETTE.w, icon: 'type-stone' }),
  rust: Object.freeze({ code: 'RST', word: 'Rust', color: PALETTE.autumnRust, ink: PALETTE.w, icon: 'type-rust' }),
  glass: Object.freeze({ code: 'GLS', word: 'Glass', color: PALETTE.nightMint, ink: PALETTE.k, icon: 'type-glass' }),
  hollow: Object.freeze({ code: 'HLW', word: 'Hollow', color: PALETTE.p, ink: PALETTE.w, icon: 'type-hollow' }),
  star: Object.freeze({ code: 'STR', word: 'Star', color: PALETTE.winterGlow, ink: PALETTE.k, icon: 'type-star' }),
});

/** Type ids in chart order. */
export const TYPE_IDS = Object.freeze(Object.keys(TYPE_CHIPS));

/** Exact explicit-state strings (wildshift-visuals §18.3). */
export const STRINGS = Object.freeze({
  unknown: '???',
  empty: 'EMPTY',
  scrap: 'Scrap',
  mendsUnknown: 'Mends ?',
  wardUnknown: 'Ward ?',
  wardKnown: 'Ward: known',
  blockedByWard: 'Blocked by Ward',
  notSaved: 'Not saved',
  noAnchor: 'No anchor stones',
  eva1: 'EVA +1',
  eva2: 'EVA +2',
  more: 'more',
});

/**
 * Device glyph labels for the context verb and key hints. Keyboard shows the key cap, gamepad
 * the face button, touch the tap word.
 */
export const DEVICE_LABELS = Object.freeze({
  keyboard: Object.freeze({ confirm: 'Z', cancel: 'X', tool: 'C', menu: 'Enter', l: '[', r: ']' }),
  gamepad: Object.freeze({ confirm: 'A', cancel: 'B', tool: 'X', menu: 'Start', l: 'LB', r: 'RB' }),
  touch: Object.freeze({ confirm: 'A', cancel: 'B', tool: 'Tool', menu: 'Menu', l: '◀', r: '▶' }),
});

/**
 * Normalise a hex colour to `#RRGGBB` upper-case (ignores alpha).
 * @param {string} hex
 * @returns {string}
 */
export function normalizeHexToken(hex) {
  const h = String(hex).trim().replace(/^#/, '');
  const full = h.length === 3 || h.length === 4 ? h.slice(0, 3).split('').map((c) => c + c).join('') : h.slice(0, 6);
  return '#' + full.toUpperCase();
}

/**
 * True for pure black or pure white, which the bibles forbid.
 * @param {string} hex
 * @returns {boolean}
 */
export function isPureBlackOrWhite(hex) {
  const n = normalizeHexToken(hex);
  return n === '#000000' || n === '#FFFFFF';
}

/**
 * Every opaque hex colour the theme defines (for tests and palette audits).
 * @returns {string[]}
 */
export function allColors() {
  const out = new Set();
  const walk = (v) => {
    if (typeof v === 'string') {
      if (/^#[0-9a-f]{3,8}$/i.test(v)) out.add(normalizeHexToken(v));
    } else if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) walk(v[k]);
    }
  };
  walk(PALETTE);
  walk(COLORS);
  walk(TYPE_CHIPS);
  return [...out];
}

/**
 * Pick the text/ring/cursor set for a panel style.
 * @param {'paper'|'ledger'|'notice'|'card'|'dark'} style
 * @returns {{text: string, soft: string, ring: string, cursor: string, band: string, hover: string, rule: string, dark: boolean}}
 */
export function surfaceFor(style) {
  if (style === 'dark') {
    return {
      text: COLORS.dark.text, soft: COLORS.dark.textSoft, ring: COLORS.focus.ringOnDark, cursor: COLORS.focus.cursorOnDark,
      band: COLORS.focus.bandOnDark, hover: COLORS.focus.hoverOnDark, rule: COLORS.dark.inner, dark: true,
    };
  }
  return {
    text: COLORS.paper.ink, soft: COLORS.paper.inkSoft, ring: COLORS.focus.ringOnPaper, cursor: COLORS.focus.cursorOnPaper,
    band: COLORS.focus.bandOnPaper, hover: COLORS.focus.hoverOnPaper, rule: COLORS.paper.rule, dark: false,
  };
}
