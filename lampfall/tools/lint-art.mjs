#!/usr/bin/env node
/**
 * Art linter (GDD-00 §14 "A Node linter rejects any sprite off-size, over-keyed, or with an anchor
 * outside its pixels"; ARCHITECTURE §8.4). [TOOLS / ART-SHARED]
 *
 * Checks every registered piece of string art:
 * 1. **Size**: every frame (and every variant frame) is exactly the declared `w × h`, and the declared
 *    size is one its category allows ({@link SIZE_RULES}: 16×16 tiles, 16-multiple objects, 32×32 / 24×24
 *    / 96×96 creatures, 16×24 people, 48×48 busts, ...).
 * 2. **Key cap**: the number of distinct colours a frame set uses stays under its category's cap
 *    ({@link KEY_CAPS}; creatures: 8 keys + `m` + a highlight).
 * 3. **Palette**: every char in the rows is in the palette, and every palette value resolves to a colour
 *    in `js/art/palette.js` (`ALL_HEX`); no pure black (`#000000`) or white (`#FFFFFF`).
 * 4. **Magenta**: a magenta-hued colour (comet `m` = `#FF5BD6` and its kin) only in art that declares
 *    `reserved` as one of `palette.MAGENTA_USES` (Heartmarks, skyglass, Shift effects, the Forecast,
 *    the comet, the Vagary).
 * 5. **Heartmark anchors**: `heartmark`, `heartmarks.{head,chest,back,tail}`, `heartmarkBack`,
 *    `heartmarkIdle2` must sit on an opaque pixel of the frame they belong to, with the 3 px plus inside
 *    the sprite.
 * 6. **Ids**: kebab-case for tiles, props and UI; unique across every registry.
 *
 * Sources: `js/art/tiles/index.js` (TILE_ART), `js/art/props.js` (PROP_ART), `js/art/ui.js` (UI_ART), and,
 * once their lanes land, `js/art/creatures/index.js` (CREATURE_SPRITES), `js/art/chars/index.js`
 * (CHAR_SPRITES) and `js/art/portraits.js` (PORTRAITS). `--proto` also lints the prototype creatures
 * and character palettes (adoption readiness; not part of the gate).
 *
 * Usage: node tools/lint-art.mjs [--quiet] [--proto] [--advisory=char,portrait]
 *   exit 1 on any gating error; lines are `category:id: message`. `--advisory=<cats>` reports those
 *   categories without failing (a lane mid-adoption).
 * @module tools/lint-art
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const palette = await import(pathToFileURL(join(ROOT, 'js/art/palette.js')).href);
const { COLORS, ALL_HEX, MAGENTA_USES, isMagentaHex, isPureBlackOrWhite, parseHex } = palette;

/**
 * Allowed sizes per category / kind. A function returns `null` when the size is fine, else a reason.
 * @type {Readonly<Record<string, (w: number, h: number) => string|null>>}
 */
export const SIZE_RULES = Object.freeze({
  ground: (w, h) => (w === 16 && h === 16 ? null : 'tiles are 16×16'),
  edge: (w, h) => (w === 16 && h === 16 ? null : 'edge tiles are 16×16'),
  detail: (w, h) => (w === 16 && h === 16 ? null : 'detail tiles are 16×16'),
  object: (w, h) => (w % 16 === 0 && h % 16 === 0 && w <= 64 && h <= 96 ? null : 'objects are 16-multiples up to 64×96'),
  fx: (w, h) => (w % 16 === 0 && h % 16 === 0 && w <= 128 && h <= 64 ? null : 'fx sprites are 16-multiples up to 128×64'),
  prop: (w, h) => (w % 16 === 0 && h % 8 === 0 && w <= 64 && h <= 96 ? null : 'props are 16 wide-multiples, 8 tall-multiples, up to 64×96'),
  ui: (w, h) => (w >= 1 && h >= 1 && w <= 128 && h <= 64 ? null : 'UI art is at most 128×64'),
  creature: (w, h) => (w === h && [24, 32, 96].includes(w) ? null : 'creatures are 32×32 (24×24 small forms, 96×96 Vagary)'),
  // size-as-character: 16-wide cells 24-32 tall (Ansel 32, Odile 28); fishing frames are 24 wide
  char: (w, h) => ((w === 16 || w === 24) && h >= 24 && h <= 32 ? null : 'people are 16×24 cells (16-24 wide, 24-32 tall)'),
  portrait: (w, h) => (w === h && (w === 48 || w === 32) ? null : 'busts are 48×48 (32×32 legacy)'),
});

/** Distinct-colour caps per category / kind (count of distinct hexes a frame set draws). */
export const KEY_CAPS = Object.freeze({
  ground: 12, edge: 8, detail: 12, object: 20, fx: 4, prop: 20, ui: 12,
  creature: 10, // 8 keys + m + highlight (GDD-00 §14)
  char: 24, portrait: 32,
});

const ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Resolves a palette value to `#RRGGBB` or `null` (transparent / the cast-shadow marker).
 * @param {string|null} v
 * @returns {{hex: string|null, error?: string}}
 */
function resolveValue(v) {
  if (v === null || v === 'shadow') return { hex: null };
  if (typeof v !== 'string') return { hex: null, error: `palette value ${JSON.stringify(v)} is not a string` };
  if (v[0] === '#') {
    const c = parseHex(v);
    if (!c) return { hex: null, error: `bad hex ${v}` };
    return { hex: '#' + c.map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase() };
  }
  if (Object.hasOwn(COLORS, v)) return resolveValue(COLORS[v]);
  return { hex: null, error: `unknown colour name '${v}'` };
}

/**
 * Normalizes any art def to `{w, h, frameSets: [{label, frames, pal}], anchors: [...]}`.
 * Tile / prop / UI defs: `{w, h, frames, pal, variants?, variantPal?}`. Creature defs: `{rows, palette,
 * idle2?, back?, heartmark?, heartmarks?, heartmarkBack?, heartmarkIdle2?}`. Character defs may carry
 * `frames` plus `palette`.
 */
function shape(def) {
  const pal = def.pal || def.palette || {};
  const sets = [];
  let w = def.w, h = def.h;
  if (Array.isArray(def.frames)) {
    sets.push({ label: '', frames: def.frames, pal });
    if (def.variants) {
      for (const [vn, vf] of Object.entries(def.variants)) {
        const vpal = (def.variantPal && def.variantPal[vn]) || pal;
        sets.push({ label: `@${vn}`, frames: Array.isArray(vf[0]) ? vf : [vf], pal: vpal });
      }
    }
  } else if (Array.isArray(def.rows)) {
    sets.push({ label: '', frames: [def.rows], pal });
    if (def.idle2) sets.push({ label: '@idle2', frames: [def.idle2], pal });
    if (def.back) sets.push({ label: '@back', frames: [def.back], pal });
  }
  if (!sets.length && def.body && typeof def.body === 'object') {
    // a character frameset: down/up/left/right [4], run {facing: [4]}, sit, fish, fishFrames [4], poses {}
    const b = def.body;
    const frames = [];
    const take = (f) => { if (Array.isArray(f) && typeof f[0] === 'string') frames.push(f); };
    for (const k of ['down', 'up', 'left', 'right', 'fishFrames']) if (Array.isArray(b[k])) b[k].forEach(take);
    take(b.sit); take(b.fish);
    if (b.run) for (const v of Object.values(b.run)) if (Array.isArray(v)) v.forEach(take);
    if (b.poses) for (const v of Object.values(b.poses)) take(v);
    sets.push({ label: '', frames, pal, perFrameSize: true });
    w = w ?? b.w; h = h ?? b.h;
  }
  const first = sets[0] && sets[0].frames[0];
  if (w === undefined && first) w = Math.max(0, ...first.map((r) => r.length));
  if (h === undefined && first) h = first.length;
  const anchors = [];
  const A = (name, pt, label) => { if (pt) anchors.push({ name, pt, label }); };
  A('heartmark', def.heartmark, '');
  if (def.heartmarks) for (const [k, pt] of Object.entries(def.heartmarks)) A(`heartmarks.${k}`, pt, '');
  A('heartmarkBack', def.heartmarkBack, '@back');
  A('heartmarkIdle2', def.heartmarkIdle2, '@idle2');
  if (def.heartmarksBack) for (const [k, pt] of Object.entries(def.heartmarksBack)) A(`heartmarksBack.${k}`, pt, '@back');
  return { w, h, sets, anchors };
}

/**
 * Lints one art definition.
 * @param {string} category  'tile' | 'prop' | 'ui' | 'creature' | 'char' | 'portrait'
 * @param {string} id
 * @param {any} def
 * @returns {{level: 'error'|'warn', where: string, message: string}[]}
 */
export function lintArtEntry(category, id, def) {
  const out = [];
  const where = `${category}:${id}`;
  const err = (message) => out.push({ level: 'error', where, message });
  const warn = (message) => out.push({ level: 'warn', where, message });
  if (!def || typeof def !== 'object') { err('definition is not an object'); return out; }
  const kind = category === 'tile' ? def.kind || 'ground' : category;
  if (['tile', 'prop', 'ui'].includes(category) && !ID_RE.test(id)) err('id must be kebab-case');
  const { w, h, sets, anchors } = shape(def);
  if (!sets.length) { err('no frames / rows'); return out; }
  // 1. size (character framesets size each frame on its own: fishing frames are wider)
  const rule = SIZE_RULES[kind];
  const perFrame = sets.some((x) => x.perFrameSize);
  if (!rule) err(`unknown kind '${kind}'`);
  else if (!perFrame) {
    const why = rule(w, h);
    if (why) err(`off-size ${w}×${h}: ${why}`);
  }
  // 3. palette resolution
  const used = new Set();
  const usedHex = new Set();
  for (const set of sets) {
    const hexOfChar = {};
    for (const [ch, v] of Object.entries(set.pal)) {
      const r = resolveValue(v);
      if (r.error) err(`palette${set.label} '${ch}': ${r.error}`);
      else if (r.hex && !ALL_HEX.has(r.hex.slice(0, 7))) err(`palette${set.label} '${ch}': ${r.hex} is not in js/art/palette.js`);
      hexOfChar[ch] = r.hex;
      if (typeof v === 'string' && v[0] === '#' && isPureBlackOrWhite(v)) err(`palette${set.label} '${ch}': pure black / white ${v}`);
      if (r.hex && isPureBlackOrWhite(r.hex)) err(`palette${set.label} '${ch}': pure black / white ${r.hex}`);
    }
    set.frames.forEach((rows, fi) => {
      if (!Array.isArray(rows)) { err(`frame${set.label} ${fi} is not an array of rows`); return; }
      let fw = w, fh = h;
      if (set.perFrameSize) {
        fh = rows.length; fw = rows[0] ? rows[0].length : 0;
        const why = rule && rule(fw, fh);
        if (why) err(`off-size: frame ${fi} is ${fw}×${fh}: ${why}`);
      }
      if (rows.length !== fh) err(`off-size: frame${set.label} ${fi} has ${rows.length} rows, want ${fh}`);
      rows.forEach((r, y) => {
        if (typeof r !== 'string') { err(`frame${set.label} ${fi} row ${y} is not a string`); return; }
        if (r.length !== fw) err(`off-size: frame${set.label} ${fi} row ${y} is ${r.length} wide, want ${fw}`);
        for (const ch of r) {
          if (ch === '.' || ch === ' ') continue;
          if (!(ch in set.pal)) { err(`frame${set.label} ${fi} row ${y}: char '${ch}' missing from palette`); continue; }
          used.add(ch);
          const hx = hexOfChar[ch];
          if (hx) usedHex.add(hx.slice(0, 7));
        }
      });
    });
  }
  for (const ch of Object.keys(sets[0].pal)) if (!used.has(ch)) warn(`palette key '${ch}' is never drawn`);
  // 2. key cap (per frame set: variants that recolour count separately)
  const cap = KEY_CAPS[kind];
  if (cap !== undefined) {
    for (const set of sets) {
      const hexes = new Set();
      for (const rows of set.frames) for (const r of rows) for (const ch of r) {
        if (ch === '.' || ch === ' ' || !(ch in set.pal)) continue;
        const rv = resolveValue(set.pal[ch]);
        if (rv.hex) hexes.add(rv.hex.slice(0, 7));
      }
      if (hexes.size > cap) err(`over the key cap: ${hexes.size} colours${set.label} (cap ${cap} for ${kind})`);
    }
  }
  // 4. magenta
  const magenta = [...usedHex].filter((x) => isMagentaHex(x));
  if (magenta.length && !MAGENTA_USES.includes(def.reserved)) {
    err(`magenta ${magenta.join(', ')} outside its reserved uses (declare reserved: ${MAGENTA_USES.join(' | ')})`);
  }
  if (def.reserved && !MAGENTA_USES.includes(def.reserved)) err(`reserved '${def.reserved}' is not one of ${MAGENTA_USES.join(', ')}`);
  // 5. heartmark anchors
  for (const a of anchors) {
    const set = sets.find((s) => s.label === a.label) || sets[0];
    const rows = set.frames[0];
    const { x, y } = a.pt;
    if (!Number.isInteger(x) || !Number.isInteger(y)) { err(`${a.name} is not an integer point`); continue; }
    if (x < 1 || y < 1 || x > w - 2 || y > h - 2) { err(`${a.name} (${x},${y}): the 3 px plus would leave the ${w}×${h} sprite`); continue; }
    const ch = rows[y] && rows[y][x];
    if (!ch || ch === '.' || ch === ' ') err(`${a.name} (${x},${y}) is outside the sprite's pixels`);
  }
  return out;
}

/**
 * Lints whole registries. Duplicate ids across registries are errors.
 * @param {Array<{category: string, table: Record<string, any>}>} sources
 * @returns {{errors: object[], warnings: object[], count: number}}
 */
export function lintArt(sources) {
  const problems = [];
  const seen = new Map();
  let count = 0;
  for (const { category, table } of sources) {
    for (const [id, def] of Object.entries(table)) {
      count++;
      if (seen.has(id) && ['tile', 'prop', 'ui'].includes(category) && ['tile', 'prop', 'ui'].includes(seen.get(id))) {
        problems.push({ level: 'error', where: `${category}:${id}`, message: `id also used by a ${seen.get(id)}` });
      }
      seen.set(id, category);
      problems.push(...lintArtEntry(category, id, def));
    }
  }
  return { errors: problems.filter((p) => p.level === 'error'), warnings: problems.filter((p) => p.level === 'warn'), count };
}

/**
 * Loads every art registry on disk.
 * @param {{proto?: boolean}} [opts]
 * @returns {Promise<Array<{category: string, table: Record<string, any>}>>}
 */
export async function collectArt(opts = {}) {
  const imp = (rel) => import(pathToFileURL(join(ROOT, rel)).href);
  const sources = [];
  const tiles = await imp('js/art/tiles/index.js');
  sources.push({ category: 'tile', table: tiles.TILE_ART });
  sources.push({ category: 'prop', table: (await imp('js/art/props.js')).PROP_ART });
  sources.push({ category: 'ui', table: (await imp('js/art/ui.js')).UI_ART });
  const optional = [
    ['js/art/creatures/index.js', 'CREATURE_SPRITES', 'creature'],
    ['js/art/chars/index.js', 'CHAR_SPRITES', 'char'],
    ['js/art/portraits.js', 'PORTRAITS', 'portrait'],
  ];
  for (const [rel, name, category] of optional) {
    if (!existsSync(join(ROOT, rel))) continue;
    const m = await imp(rel);
    if (m[name]) sources.push({ category, table: m[name] });
  }
  if (opts.proto) {
    const c = await imp('proto/creatures/sprites.js');
    const table = {};
    for (const [name, s] of Object.entries(c.SPRITES)) {
      const def = { ...s };
      if (name === 'Vagary') def.reserved = 'vagary';
      table[name] = def;
    }
    sources.push({ category: 'creature', table });
  }
  return sources;
}

/**
 * Splits errors into gating and advisory by category (`--advisory char,portrait` reports a lane that is
 * still being adopted without failing the gate).
 * @param {object[]} errors @param {string[]} advisory
 * @returns {{gate: object[], advisory: object[]}}
 */
export function splitAdvisory(errors, advisory) {
  const isAdv = (e) => advisory.includes(e.where.split(':')[0]);
  return { gate: errors.filter((e) => !isAdv(e)), advisory: errors.filter(isAdv) };
}

/* ------------------------------------------------------------ CLI */
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const quiet = process.argv.includes('--quiet');
  const proto = process.argv.includes('--proto');
  const advArg = process.argv.find((a) => a.startsWith('--advisory'));
  const advisoryCats = advArg ? (advArg.split('=')[1] || '').split(',').filter(Boolean) : [];
  const sources = await collectArt({ proto });
  const { errors, warnings, count } = lintArt(sources);
  const { gate, advisory } = splitAdvisory(errors, advisoryCats);
  for (const e of gate) console.log(`${e.where}: ${e.message}`);
  if (!quiet) for (const e of advisory) console.log(`advisory ${e.where}: ${e.message}`);
  if (!quiet) for (const w of warnings) console.log(`warn ${w.where}: ${w.message}`);
  if (advisory.length) {
    const byCat = {};
    for (const e of advisory) { const c = e.where.split(':')[0]; byCat[c] = (byCat[c] || 0) + 1; }
    console.log(`lint-art: advisory (not gating): ${Object.entries(byCat).map(([c, n]) => `${n} ${c}`).join(', ')}`);
  }
  if (!quiet || gate.length) console.log(`lint-art: ${count} art entries, ${gate.length} errors, ${warnings.length} warnings`);
  process.exit(gate.length ? 1 : 0);
}
