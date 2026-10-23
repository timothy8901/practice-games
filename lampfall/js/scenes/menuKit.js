/**
 * Shared drawing and plumbing for the pause-menu screens. [SCN-MENU]
 *
 * - **Prefs**: reduced motion (world.settings), high contrast and large text (the settings the schema
 *   does not carry yet live in a device mirror; see {@link readExt}). Every screen reads them through
 *   {@link prefsOf} each frame so a change in Settings applies live.
 * - **Skin**: the colour set a screen draws with. High contrast swaps paper panels for night ink with
 *   cream text and 2px edges ({@link skinOf}, {@link drawSkinPanel}).
 * - **Creatures**: {@link drawCreature} draws a form at ×1/×2 with the Heartmark in its spot, using
 *   the ART-CREATURES sprite registered in `art/atlas` when there is one, else a procedural
 *   field-guide placeholder built from the form's types and stage; {@link drawCreatureIcon} is the
 *   16x16 head crop for rows and strips.
 * - **Glyphs**: 8x8 menu icons the UI kit does not have (paw, satchel, tally, map, book, letter,
 *   gear, quill, disc, bottle, knot) drawn with the kit's three-slot palette.
 * - **Motion**: {@link createSlide} is the panel rule (in 6 f / out 4 f, 12 px from the anchor edge;
 *   a 4 f dissolve under reduced motion).
 * - **Hints**: {@link drawHints} draws `Z: Choose  X: Back` with the player's *current* bindings and
 *   device, so a remapped key reads correctly.
 * @module scenes/menuKit
 */
import { drawText, measureText } from '../core/font.js';
import { decodeSprite, drawSprite, silhouette } from '../core/pixelart.js';
import { tokenLabel } from '../core/input.js';
import { COLORS, PALETTE, TIMING } from '../ui/theme.js';
import { drawPanel, drawNotchedFrame } from '../ui/panel.js';
import { drawIcon } from '../ui/icons.js';
import { drawKeyGlyph, keyGlyphWidth } from '../ui/widgets.js';
import { artDef, artIds, getSprite } from '../art/atlas.js';
import * as creatureArtLib from '../art/creatures/index.js';
import { drawHeartmark as drawMarkArt, markAnchor, bodyKeyAt } from '../art/heartmark.js';
import { MASTER } from '../art/palette.js';
import { SAVE_PREFIX } from '../config.js';
import { TUNING } from '../data/tuning.js';
import { EXT_DEFAULTS, normalizeExt, markPixel, lookOf, primaryToken, hash32, typesOf, heartmarkSpot } from './menuModel.js';

/** Comet magenta: Heartmarks only on these screens (GDD-00 §14). */
export const MAGENTA = MASTER.m;

// ---------------------------------------------------------------------------------------------
// Context helpers
// ---------------------------------------------------------------------------------------------

/**
 * Economy / party context for system calls: registry, bus and the GDD tuning table.
 * @param {any} G
 * @returns {{data: any, bus: any, tuning: Record<string, any>}}
 */
export function sysCtx(G) {
  return { data: G.data ?? null, bus: G.bus ?? null, tuning: TUNING };
}

/**
 * UI sound through the bus (audio/sfxMap turns `ui:*` into sounds). Never throws.
 * @param {any} G
 * @param {'cursor'|'confirm'|'cancel'|'blocked'|'error'} kind
 */
export function sfx(G, kind) {
  try { G?.bus?.emit?.(`ui:${kind}`, {}); } catch { /* audio must never break a menu */ }
}

/**
 * A short toast (main.js draws them above the stack). Never throws.
 * @param {any} G
 * @param {string} text
 * @param {{kind?: string, ms?: number}} [o]
 */
export function toast(G, text, o = {}) {
  try {
    if (G?.toasts?.show) G.toasts.show(text, o);
    else G?.bus?.emit?.('toast', { text, ...o });
  } catch { /* a toast is cosmetic */ }
}

// ---------------------------------------------------------------------------------------------
// Extension settings mirror (GDD-00 §15 rows the schema does not carry yet)
// ---------------------------------------------------------------------------------------------

/** localStorage key of the extension-settings mirror. */
export const EXT_KEY = `${SAVE_PREFIX}settingsExt`;
let extCache = null;

/** @returns {Storage|null} */
function storage() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

/**
 * The extension settings: values STATE has already added to `world.settings` win, the device mirror
 * fills the rest, GDD-09 defaults otherwise.
 * @param {any} [G]
 * @returns {typeof EXT_DEFAULTS}
 */
export function readExt(G) {
  if (!extCache) {
    let raw = null;
    try { raw = JSON.parse(storage()?.getItem(EXT_KEY) ?? 'null'); } catch { raw = null; }
    extCache = normalizeExt(raw);
  }
  const s = G?.world?.settings;
  if (!s) return extCache;
  /** @type {Record<string, any>} */
  const merged = { ...extCache };
  for (const k of Object.keys(EXT_DEFAULTS)) if (Object.prototype.hasOwnProperty.call(s, k)) merged[k] = s[k];
  if (s.volumes && typeof s.volumes.ambience === 'number') merged.ambience = s.volumes.ambience;
  return /** @type {any} */ (normalizeExt(merged));
}

/**
 * Writes extension settings to the device mirror (never throws) and returns the new values.
 * @param {Partial<typeof EXT_DEFAULTS>} patch
 * @returns {typeof EXT_DEFAULTS}
 */
export function writeExt(patch) {
  extCache = normalizeExt({ ...readExt(null), ...patch });
  try { storage()?.setItem(EXT_KEY, JSON.stringify(extCache)); } catch { /* storage full / blocked */ }
  return extCache;
}

/** Test hook: forget the cached mirror. */
export function resetExtCache() { extCache = null; }

/**
 * Accessibility preferences a screen honours this frame.
 * @param {any} G
 * @returns {{reduced: boolean, contrast: boolean, large: boolean, noanim: boolean}}
 */
export function prefsOf(G) {
  const ext = readExt(G);
  return {
    reduced: G?.world?.settings?.reducedMotion === true,
    contrast: ext.highContrast === true,
    large: ext.largeText === true,
    noanim: !!(G?.flags && G.flags.noanim),
  };
}

// ---------------------------------------------------------------------------------------------
// Skin
// ---------------------------------------------------------------------------------------------

/**
 * @typedef {Object} Skin
 * @property {boolean} dark          high contrast (panels are night ink)
 * @property {'paper'|'dark'} style  panel / focus style for the UI kit
 * @property {string} text  @property {string} soft  @property {string} faint
 * @property {string} band  @property {string} rule  @property {string} card  @property {string} cardEdge
 * @property {string} accent         wax red / bright amber for emphasis
 * @property {string} good  @property {string} bad
 */

/**
 * @param {{contrast: boolean}} prefs
 * @returns {Skin}
 */
export function skinOf(prefs) {
  if (prefs && prefs.contrast) {
    return {
      dark: true, style: 'dark', text: COLORS.paper.light, soft: '#D8D2C2', faint: PALETTE.v,
      band: PALETTE.deepBlue, rule: PALETTE.v, card: COLORS.night.ink, cardEdge: COLORS.paper.light,
      accent: COLORS.brass.light, good: PALETTE.l, bad: '#FF8A8A',
    };
  }
  return {
    dark: false, style: 'paper', text: COLORS.paper.ink, soft: COLORS.paper.inkSoft, faint: COLORS.paper.inkFaint,
    band: COLORS.paper.shade, rule: COLORS.paper.rule, card: COLORS.paper.light, cardEdge: COLORS.paper.rule,
    accent: COLORS.wax.fill, good: PALETTE.t, bad: PALETTE.r,
  };
}

/**
 * A panel in the current skin: the kit's paper/ledger/notice styles normally, night ink with a 2px
 * cream edge under high contrast.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number, w: number, h: number}} rect
 * @param {Skin} skin
 * @param {'paper'|'ledger'|'notice'|'card'} [style='paper']
 * @param {object} [opts]  drawPanel options (title, seal, torn ...)
 */
export function drawSkinPanel(ctx, rect, skin, style = 'paper', opts = {}) {
  if (!skin.dark) return drawPanel(ctx, rect, style, opts);
  drawPanel(ctx, rect, 'dark', { ...opts, torn: 'none' });
  ctx.fillStyle = COLORS.paper.light;
  const { x, y, w, h } = rect;
  ctx.fillRect(x + 1, y, w - 2, 2); ctx.fillRect(x + 1, y + h - 2, w - 2, 2);
  ctx.fillRect(x, y + 1, 2, h - 2); ctx.fillRect(x + w - 2, y + 1, 2, h - 2);
  return { x: x + 5, y: y + 5, w: w - 10, h: h - 10 };
}

/**
 * A small card (row background) in the current skin.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x: number, y: number, w: number, h: number}} r
 * @param {Skin} skin
 * @param {{focused?: boolean, dim?: boolean, lifted?: boolean}} [o]
 */
export function drawCard(ctx, r, skin, o = {}) {
  const lift = o.lifted ? 1 : 0;
  ctx.fillStyle = COLORS.shadow;
  ctx.fillRect(r.x + 1, r.y + 1, r.w, r.h);
  ctx.fillStyle = o.focused ? skin.band : o.dim ? (skin.dark ? '#1C2442' : COLORS.paper.grain) : skin.card;
  ctx.fillRect(r.x + 1, r.y + 1 - lift, r.w - 2, r.h - 2);
  drawNotchedFrame(ctx, r.x, r.y - lift, r.w, r.h, o.focused ? (skin.dark ? COLORS.paper.light : COLORS.paper.ink) : skin.cardEdge);
}

/**
 * The full-screen backdrop of an opaque menu screen: night ink with a faint ledger-rule dither so
 * the desk never reads as a flat void.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{contrast?: boolean}} [prefs]
 */
export function drawBackdrop(ctx, prefs = {}) {
  ctx.fillStyle = COLORS.night.ink;
  ctx.fillRect(0, 0, 480, 270);
  if (prefs.contrast) return;
  ctx.fillStyle = '#1A2240';
  for (let y = 3; y < 270; y += 6) for (let x = (y % 12 === 3 ? 0 : 3); x < 480; x += 6) ctx.fillRect(x, y, 1, 1);
}

/**
 * A screen heading at the top-left with an optional right-aligned note.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} title
 * @param {string} [right]
 */
export function drawHeading(ctx, title, right) {
  drawText(ctx, title, 10, 5, { color: COLORS.paper.light, shadow: { color: COLORS.night.blue, dx: 1, dy: 1 } });
  if (right) drawText(ctx, right, 470, 5, { color: PALETTE.v, align: 'right' });
}

// ---------------------------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------------------------

/**
 * The label of an action's key on the player's current device and bindings.
 * @param {any} input
 * @param {string} action
 * @returns {{device: 'keyboard'|'gamepad'|'touch', label: string}}
 */
export function keyFor(input, action) {
  const device = input?.lastDevice === 'gamepad' ? 'gamepad' : input?.lastDevice === 'touch' ? 'touch' : 'keyboard';
  let label = '';
  try {
    const b = typeof input?.bindings === 'function' ? input.bindings() : null;
    const tok = b ? primaryToken(b, action, device) : null;
    label = tok ? tokenLabel(tok) : '';
  } catch { label = ''; }
  if (!label) label = { confirm: 'Z', cancel: 'X', l: '[', r: ']', menu: 'Enter', start: 'P' }[action] ?? action;
  if (device === 'touch') label = { confirm: 'A', cancel: 'B', l: '◀', r: '▶' }[action] ?? label;
  return { device, label };
}

/**
 * Key hints along the bottom-right: `[[action, text], ...]`. Returns the left x used.
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} input
 * @param {Array<[string, string]>} hints
 * @param {{x?: number, y?: number, dark?: boolean, color?: string}} [o]
 * @returns {number}
 */
export function drawHints(ctx, input, hints, o = {}) {
  let x = o.x ?? 472;
  const y = o.y ?? 259;
  const color = o.color ?? PALETTE.v;
  for (let i = hints.length - 1; i >= 0; i--) {
    const [action, text] = hints[i];
    const k = keyFor(input, action);
    const tw = measureText(text, { font: 'small' }).w;
    x -= tw;
    drawText(ctx, text, x, y + 2, { font: 'small', color });
    const gw = keyGlyphWidth(k.device, k.label);
    x -= gw + 3;
    drawKeyGlyph(ctx, k.device, k.label, x, y, { dark: true });
    x -= 10;
  }
  return x;
}

// ---------------------------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------------------------

/** Panel motion at 60 fps: in 6 f, out 4 f (GDD-00 §14). */
export const PANEL_IN_MS = 100;
export const PANEL_OUT_MS = 67;

/**
 * A slide-in / slide-out driver. `offset()` is the x shift (from the right edge), `alpha()` the
 * dissolve under reduced motion. `close(fn)` runs `fn` once the out motion ends (at once with
 * `noanim`).
 * @param {{dx?: number}} [o]
 */
export function createSlide(o = {}) {
  const dx = o.dx ?? 12;
  let t = 0, phase = 'in', done = null, reduced = false, noanim = false;
  const ease = (k) => 1 - (1 - k) * (1 - k);
  return {
    get phase() { return phase; },
    get closing() { return phase === 'out'; },
    open(prefs) { t = 0; phase = 'in'; done = null; reduced = !!prefs?.reduced; noanim = !!prefs?.noanim; if (noanim) phase = 'idle'; },
    close(fn, prefs) {
      if (phase === 'out') return;
      reduced = !!prefs?.reduced; noanim = !!prefs?.noanim;
      if (noanim) { phase = 'gone'; fn?.(); return; }
      phase = 'out'; t = 0; done = fn ?? null;
    },
    update(dt) {
      if (phase === 'in') { t += dt; if (t >= PANEL_IN_MS) phase = 'idle'; }
      else if (phase === 'out') {
        t += dt;
        if (t >= PANEL_OUT_MS) { phase = 'gone'; const f = done; done = null; f?.(); }
      }
    },
    /** @returns {number} */
    offset() {
      if (reduced || noanim) return 0;
      if (phase === 'in') return Math.round(dx * (1 - ease(Math.min(1, t / PANEL_IN_MS))));
      if (phase === 'out') return Math.round(dx * ease(Math.min(1, t / PANEL_OUT_MS)));
      return 0;
    },
    /** @returns {number} */
    alpha() {
      if (phase === 'in') return reduced ? Math.min(1, t / 67) : Math.min(1, 0.35 + t / PANEL_IN_MS);
      if (phase === 'out') return Math.max(0, 1 - t / PANEL_OUT_MS);
      return phase === 'gone' ? 0 : 1;
    },
  };
}

/**
 * The cursor bob: 0 or 1 px every half of `TIMING.cursorBobMs`.
 * @param {number} ms
 * @returns {number}
 */
export function bob(ms) {
  return (ms % TIMING.cursorBobMs) < TIMING.cursorBobMs / 2 ? 0 : 1;
}

/**
 * The ▶ cursor at x,y (bobbing).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y
 * @param {number} ms
 * @param {Skin} skin
 */
export function drawCursorAt(ctx, x, y, ms, skin) {
  drawText(ctx, '▶', x + bob(ms), y, { color: skin.dark ? PALETTE.y : COLORS.wax.fill });
}

// ---------------------------------------------------------------------------------------------
// Glyphs
// ---------------------------------------------------------------------------------------------

/** 8x8 menu glyphs (`#` ink, `o` accent, `w` light), same grammar as ui/icons. */
export const GLYPHS = Object.freeze({
  paw: ['.#..#...', '#o##o#..', '.#..#...', '..###...', '.#ooo#..', '.#ooo#..', '..###...', '........'],
  satchel: ['..####..', '.#....#.', '########', '#oooooo#', '#oo##oo#', '#oooooo#', '########', '........'],
  tally: ['#.#.#.#.', '#.#.#.#.', '########', '#ooooooo', '#ooooooo', '########', '#.#.#.#.', '........'],
  map: ['##..##..', '#o##o###', '#oo#oo##', '#o#oo#o#', '#oo#oo##', '###o##o#', '..##..##', '........'],
  book: ['.######.', '#wwww#o#', '#w##w#o#', '#wwww#o#', '#w##w#o#', '#wwww#o#', '.######.', '........'],
  letter: ['########', '#w#ww#w#', '#ww##ww#', '#wwooww#', '#wwooww#', '#wwwwww#', '########', '........'],
  gear: ['...##...', '.#.##.#.', '..####..', '###ww###', '###ww###', '..####..', '.#.##.#.', '...##...'],
  quill: ['......##', '.....#o#', '....#o#.', '...#o#..', '..#o#...', '.##w#...', '#.##....', '##......'],
  disc: ['..####..', '.#oooo#.', '#oowwoo#', '#ow##wo#', '#ow##wo#', '#oowwoo#', '.#oooo#.', '..####..'],
  bottle: ['...##...', '...##...', '..#ww#..', '.#wwww#.', '.#oooo#.', '.#oooo#.', '.######.', '........'],
  knot: ['#......#', '.#....#.', '..#..#..', '...##...', '..#oo#..', '.#owoo#.', '.#oooo#.', '..####..'],
  wick: ['...o....', '..ooo...', '...w....', '..###...', '..#w#...', '..#w#...', '.#####..', '........'],
  bag: ['..####..', '.#....#.', '#oooooo#', '#oo##oo#', '#oooooo#', '#oooooo#', '.######.', '........'],
  box: ['########', '#oooooo#', '#o####o#', '########', '#oooooo#', '#oooooo#', '########', '........'],
});

/**
 * Draws a menu glyph (or falls back to a ui/icons id).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} name
 * @param {number} x @param {number} y
 * @param {{ink?: string, accent?: string, light?: string, scale?: number}} [o]
 */
export function drawGlyph(ctx, name, x, y, o = {}) {
  const art = GLYPHS[name];
  if (!art) { drawIcon(ctx, name, x, y, o); return; }
  const sprite = decodeSprite(art, { '#': o.ink ?? COLORS.paper.ink, o: o.accent ?? COLORS.wax.fill, w: o.light ?? COLORS.paper.light, '.': null });
  drawSprite(ctx, sprite, Math.round(x), Math.round(y), o.scale && o.scale !== 1 ? { scale: o.scale } : undefined);
}

/**
 * The glyph id and accent for an item row.
 * @param {Record<string, any>|null} item
 * @returns {{glyph: string, accent: string}}
 */
export function itemGlyph(item) {
  const use = item?.use ?? '';
  const kind = item?.kind ?? '';
  if (String(use).startsWith('capture') || kind === 'wick') return { glyph: 'wick', accent: PALETTE.o };
  if (use === 'disc') return { glyph: 'disc', accent: typeAccent(item?.type) };
  if (use === 'heal' || use === 'revive') return { glyph: 'bottle', accent: PALETTE.r };
  if (use === 'pp') return { glyph: 'bottle', accent: PALETTE.s };
  if (use === 'cure') return { glyph: 'bottle', accent: PALETTE.g };
  if (use === 'ward-suppress') return { glyph: 'glint', accent: PALETTE.i };
  if (item?.pocket === 'keepsakes') return { glyph: 'star', accent: PALETTE.y };
  if (use === 'hold' || item?.pocket === 'held') return { glyph: 'knot', accent: PALETTE.brass };
  if (item?.wallet) return { glyph: 'coin', accent: PALETTE.brass };
  if (use === 'key') return { glyph: 'key', accent: PALETTE.brass };
  return { glyph: 'glint', accent: PALETTE.o };
}

/** @param {string|undefined} type */
function typeAccent(type) {
  return TYPE_RAMP[type]?.[0] ?? PALETTE.v;
}

// ---------------------------------------------------------------------------------------------
// Creatures
// ---------------------------------------------------------------------------------------------

/** Type -> [fill, shade, light] for the placeholder sprites (art/palette master keys). */
export const TYPE_RAMP = Object.freeze({
  Plain: [MASTER.v, MASTER.e, MASTER.w], Grit: [MASTER.a, MASTER.u, MASTER.c], Brine: [MASTER.b, MASTER.n, MASTER.s],
  Kiln: [MASTER.o, MASTER.r, MASTER.y], Moss: [MASTER.g, MASTER.t, MASTER.l], Bolt: [MASTER.y, MASTER.o, MASTER.w],
  Rime: [MASTER.s, MASTER.b, MASTER.i], Gust: [MASTER.w, MASTER.v, MASTER.w], Stone: [MASTER.e, MASTER.d, MASTER.v],
  Rust: [MASTER.r, MASTER.p, MASTER.o], Glass: [MASTER.i, MASTER.s, MASTER.w], Hollow: [MASTER.p, MASTER.d, MASTER.v],
  Star: [MASTER.d, MASTER.k, MASTER.y],
});
/** Warm bodies take a `y` mark centre, cool ones `w` (GDD-00 §14). */
const WARM = new Set(['Kiln', 'Bolt', 'Rust', 'Grit', 'Star']);

/**
 * The registered ART-CREATURES sprite for a form, or null.
 * @param {string} speciesId
 * @param {boolean} [back]
 * @returns {import('../core/pixelart.js').Sprite|null}
 */
export function creatureArt(speciesId, back = false) {
  try {
    if (!artIds().includes(speciesId)) return null;
    const def = artDef(speciesId);
    if (!def || (def.kind !== 'creature' && def.source !== 'creature')) return null;
    return getSprite(speciesId, back && def.variants?.back ? 'back' : undefined);
  } catch { return null; }
}

/**
 * Procedural placeholder rows for a form (32x32): a field-guide blob with a head, ears or fins,
 * a tail and feet, sized by stage and coloured by type. Deterministic per species id.
 * @param {{id: string, types?: string[], stage?: number}} sp
 * @returns {{rows: string[], palette: Record<string, string|null>, head: {x: number, y: number}}}
 */
export function placeholderRows(sp) {
  const h = hash32(sp?.id ?? '?');
  const t1 = sp?.types?.[0] ?? 'Plain', t2 = sp?.types?.[1] ?? null;
  const [fill, shade, light] = TYPE_RAMP[t1] ?? TYPE_RAMP.Plain;
  const acc = t2 ? (TYPE_RAMP[t2] ?? TYPE_RAMP.Plain)[0] : light;
  const stage = Math.max(0, Math.min(3, sp?.stage ?? 1));
  const G = Array.from({ length: 32 }, () => Array(32).fill('.'));
  const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < 32 && y < 32) G[y][x] = c; };
  const ell = (cx, cy, rx, ry, c) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) put(x, y, c);
      }
    }
  };
  const bodyR = [5, 7, 8, 9][stage], bodyRy = [4, 5, 6, 7][stage];
  const headR = [4, 5, 5, 6][stage];
  const cx = 17, by = 30 - bodyRy - 2;
  const hx = cx - Math.round(bodyR * 0.55), hy = by - bodyRy - headR + 3;
  // tail
  const tailKind = h % 3;
  if (tailKind === 0) { for (let i = 0; i < 6; i++) put(cx + bodyR + i - 1, by - i, 'f'), put(cx + bodyR + i - 1, by - i + 1, 'f'); }
  else if (tailKind === 1) { ell(cx + bodyR + 1, by - 2, 3, 2, 'a'); }
  // feet
  ell(cx - bodyR + 3, by + bodyRy, 2, 1.2, 's'); ell(cx + bodyR - 3, by + bodyRy, 2, 1.2, 's');
  // body, belly
  ell(cx, by, bodyR, bodyRy, 'f');
  ell(cx - 1, by + 2, bodyR - 3, bodyRy - 3, 'l');
  // ears / fins / crest
  const ear = (h >> 3) % 4;
  if (ear === 0) { ell(hx - 3, hy - headR, 1.5, 3, 'f'); ell(hx + 2, hy - headR, 1.5, 3, 'f'); }
  else if (ear === 1) { for (let i = 0; i < 4; i++) { put(hx - 3 + i, hy - headR - 3 + i, 'a'); put(hx + 1 + i, hy - headR - 3 + i, 'a'); } }
  else if (ear === 2) { ell(hx, hy - headR, 3, 1.6, 'a'); }
  // head
  ell(hx, hy, headR, headR - 0.5, 'f');
  ell(hx - 1, hy + 1, headR - 2, headR - 2.5, 'l');
  // shade the lower edges
  for (let y = 31; y >= 1; y--) for (let x = 0; x < 32; x++) {
    if ((G[y][x] === 'f') && (y === 31 || G[y + 1][x] === '.')) G[y][x] = 's';
  }
  // accent markings (second type) on the back
  if (t2) for (let i = -2; i <= 2; i++) { put(cx + i * 2, by - bodyRy + 1, 'a'); put(cx + i * 2 + 1, by - bodyRy + 2, 'a'); }
  // eye
  const ex = hx - 2, ey = hy - 1;
  put(ex, ey, 'k'); put(ex, ey + 1, 'k'); put(ex - 1, ey, 'w');
  // outline
  const out = G.map((r) => r.slice());
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (G[y][x] !== '.') continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => G[y + dy]?.[x + dx] && G[y + dy][x + dx] !== '.');
    if (n) out[y][x] = 'k';
  }
  return {
    rows: out.map((r) => r.join('')),
    palette: { '.': null, k: MASTER.k, f: fill, s: shade, l: light === fill ? MASTER.w : light, a: acc, w: MASTER.w },
    head: { x: hx, y: hy },
  };
}

const PLACEHOLDER_CACHE = new Map();

/**
 * The sprite of a form: ART-CREATURES art when registered, else the cached placeholder.
 * @param {any} sp  species info (`{id, types, stage, flags}`)
 * @returns {{sprite: import('../core/pixelart.js').Sprite, head: {x: number, y: number}, real: boolean}}
 */
export function formSprite(sp) {
  const id = sp?.id ?? '?';
  const art = creatureArt(id);
  if (art) {
    const a = sp?.flags?.heartmarkAnchors?.head;
    return { sprite: art, head: a ? { x: a.x, y: a.y } : { x: 12, y: 10 }, real: true };
  }
  let hit = PLACEHOLDER_CACHE.get(id);
  if (!hit) {
    const p = placeholderRows(sp ?? { id });
    hit = { sprite: decodeSprite(p.rows, p.palette), head: p.head, real: false };
    PLACEHOLDER_CACHE.set(id, hit);
  }
  return hit;
}

/**
 * The Heartmark: a 3 px plus at ×1, a 5 px plus with corner glints at ×2, centre `w` on cool bodies
 * and `y` on warm ones. `cx,cy` is the centre pixel in screen space.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx @param {number} cy
 * @param {number} [scale=1]
 * @param {{warm?: boolean, glint?: boolean, dim?: boolean}} [o]
 */
export function drawHeartmark(ctx, cx, cy, scale = 1, o = {}) {
  const m = o.dim ? PALETTE.e : MAGENTA;
  const centre = o.warm ? MASTER.y : MASTER.w;
  cx = Math.round(cx); cy = Math.round(cy);
  ctx.fillStyle = m;
  if (scale >= 2) {
    ctx.fillRect(cx - 2, cy, 5, 1); ctx.fillRect(cx, cy - 2, 1, 5);
    ctx.fillRect(cx - 1, cy - 1, 3, 3);
    if (o.glint) { ctx.fillRect(cx - 3, cy - 3, 1, 1); ctx.fillRect(cx + 3, cy - 3, 1, 1); ctx.fillRect(cx - 3, cy + 3, 1, 1); ctx.fillRect(cx + 3, cy + 3, 1, 1); }
  } else {
    ctx.fillRect(cx - 1, cy, 3, 1); ctx.fillRect(cx, cy - 1, 1, 3);
  }
  ctx.fillStyle = centre;
  ctx.fillRect(cx, cy, 1, 1);
}

/**
 * Draws a creature (its current form, or `opts.form`) at x,y with its Heartmark in its spot. Uses
 * the ART-CREATURES art (`art/creatures.drawCreature` with the individual's anchor and offset) and
 * falls back to the procedural placeholder for ids outside the roster.
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} G
 * @param {any} c          creature record (uid, speciesId, mark, wild, hp)
 * @param {number} x @param {number} y
 * @param {{scale?: number, form?: string, grey?: boolean, glint?: boolean, bobY?: number, mark?: boolean, frame?: 0|1}} [o]
 * @returns {{w: number, h: number}}
 */
export function drawCreature(ctx, G, c, x, y, o = {}) {
  const formId = o.form ?? c?.speciesId;
  const scale = o.scale ?? 1;
  const yy = Math.round(y + (o.bobY ?? 0));
  if (formId && creatureArtLib.hasArt(formId)) {
    const r = creatureArtLib.drawCreature(ctx, formId, Math.round(x), yy, {
      scale, frame: o.frame ?? 0, anchor: heartmarkSpot(c), mark: c?.mark ?? null, star: c?.starTouched, lit: c ? c.wild !== true : false,
      glint: o.glint ? 1 : 0, showMark: o.mark !== false && !!c, silhouette: o.grey ? PALETTE.e : null, types: typesOf(c),
    });
    return { w: r.w, h: r.h };
  }
  const look = lookOf(G?.data);
  const sp = look.speciesOrNull(formId) ?? { id: formId, types: typesOf(c), stage: 1, flags: {} };
  const { sprite } = formSprite(sp);
  const img = o.grey ? silhouette(sprite, PALETTE.e) : sprite;
  drawSprite(ctx, img, Math.round(x), yy, scale !== 1 ? { scale } : undefined);
  if (o.mark !== false && c && c.wild !== true) {
    const p = markPixel(c, sp, { w: sprite.w, h: sprite.h });
    const warm = WARM.has(sp.types?.[0]);
    drawHeartmark(ctx, x + p.x * scale + (scale > 1 ? Math.floor(scale / 2) : 0), yy + p.y * scale + (scale > 1 ? Math.floor(scale / 2) : 0), scale, { warm, glint: o.glint, dim: o.grey });
  }
  return { w: sprite.w * scale, h: sprite.h * scale };
}

/**
 * The 16x16 head-crop icon of a creature (party rows, learner strips, slot cards), with its mark when
 * the mark falls inside the crop. `grey` draws the resting (fainted) silhouette, `dim` a faded one.
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} G
 * @param {any} c
 * @param {number} x @param {number} y
 * @param {{grey?: boolean, form?: string, dim?: boolean}} [o]
 */
export function drawCreatureIcon(ctx, G, c, x, y, o = {}) {
  const formId = o.form ?? c?.speciesId;
  const prev = ctx.globalAlpha;
  if (formId && creatureArtLib.hasArt(formId)) {
    const icon = creatureArtLib.getCreatureIcon(formId, { star: c?.starTouched, silhouette: o.grey ? PALETTE.e : null });
    if (!icon) return;
    if (o.dim) ctx.globalAlpha = prev * 0.45;
    drawSprite(ctx, icon, Math.round(x), Math.round(y));
    ctx.globalAlpha = prev;
    const rec = creatureArtLib.creatureRecord(formId);
    const win = creatureArtLib.CREATURE_ICONS[formId];
    if (rec && win && c && c.wild !== true && !o.dim && !o.grey && win.step === 1) {
      const at = markAnchor({ heartmark: rec.heartmarks[heartmarkSpot(c)] ?? rec.heartmarks[rec.mark] }, c.mark, { w: rec.w, h: rec.h });
      const ix = at.x - win.ox, iy = at.y - win.oy;
      if (ix >= 1 && ix <= 14 && iy >= 1 && iy <= 14) {
        const centre = rec.highlight === 'y' ? MASTER.y : rec.highlight === 'w' ? MASTER.w : null;
        drawMarkArt(ctx, Math.round(x) - win.ox, Math.round(y) - win.oy, at, { lit: true, scale: 1, body: bodyKeyAt(rec, at), centre });
      }
    }
    return;
  }
  const look = lookOf(G?.data);
  const sp = look.speciesOrNull(formId) ?? { id: formId, types: typesOf(c), stage: 1, flags: {} };
  const { sprite, head } = formSprite(sp);
  const sx = Math.max(0, Math.min(sprite.w - 16, Math.round(head.x - 7)));
  const sy = Math.max(0, Math.min(sprite.h - 16, Math.round(head.y - 8)));
  const img = o.grey ? silhouette(sprite, PALETTE.e) : sprite;
  const canvas = img.canvas;
  if (!canvas) return;
  if (o.dim) ctx.globalAlpha = prev * 0.45;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, sx, sy, 16, 16, Math.round(x), Math.round(y), 16, 16);
  ctx.globalAlpha = prev;
  if (c && c.wild !== true && !o.dim) {
    const p = markPixel(c, sp, { w: sprite.w, h: sprite.h });
    if (p.x - sx >= 1 && p.x - sx <= 14 && p.y - sy >= 1 && p.y - sy <= 14) {
      drawHeartmark(ctx, x + p.x - sx, y + p.y - sy, 1, { warm: WARM.has(sp.types?.[0]), dim: o.grey });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------------------------

/**
 * Draws wrapped body text, clipped to `maxLines` lines of 10 px (an ellipsis marks the cut). Under
 * Large text it draws at ×2 whenever the whole text fits in the same height, else at ×1. Returns
 * the height used.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x @param {number} y @param {number} w
 * @param {{color: string, large?: boolean, maxLines?: number}} o
 * @returns {number}
 */
export function drawBody(ctx, text, x, y, w, o) {
  const maxH = (o.maxLines ?? 6) * 10;
  for (const scale of o.large ? [2, 1] : [1]) {
    const lines = measureText(text, { maxWidth: w, scale }).lines;
    const cap = Math.max(1, Math.floor(maxH / (10 * scale)));
    if (scale === 2 && lines > cap) continue;
    const shown = lines > cap ? clipLines(text, w, cap, scale) : text;
    drawText(ctx, shown, x, y, { color: o.color, maxWidth: w, scale });
    return Math.min(lines, cap) * 10 * scale;
  }
  return 0;
}

/**
 * One line of text that fits `maxW` pixels: the text itself when it fits, else cut at a character
 * with a trailing `…`. Use it for single-line labels; `drawText`'s `maxWidth` wraps instead, which
 * would spill a long place or item name into the line below.
 * @param {string} text
 * @param {number} maxW
 * @param {{font?: string, scale?: number}} [opts]
 * @returns {string}
 */
export function fitText(text, maxW, opts = {}) {
  const s = String(text ?? '');
  if (!(maxW > 0) || measureText(s, opts).w <= maxW) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measureText(`${s.slice(0, mid).trimEnd()}…`, opts).w <= maxW) lo = mid; else hi = mid - 1;
  }
  return lo > 0 ? `${s.slice(0, lo).trimEnd()}…` : '…';
}

/**
 * The text cut to `maxLines` wrapped lines with an ellipsis.
 * @param {string} text @param {number} w @param {number} maxLines @param {number} [scale=1]
 * @returns {string}
 */
function clipLines(text, w, maxLines, scale = 1) {
  const words = String(text).split(/\s+/);
  let out = '';
  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (measureText(`${next}...`, { maxWidth: w, scale }).lines > maxLines) return `${out}...`;
    out = next;
  }
  return out;
}
