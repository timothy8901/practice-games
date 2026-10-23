// Unit tests for js/art/atlas.js (pure parts: decoding, grading, caches, packing). Run: node --test test/art.atlas.test.mjs
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getTile, getSprite, getShadow, artDef, artIds, resolveArtId, resolveGrade, registerArt, registerAliases,
  animFrame, gradeColour, buildGameAtlases, atlasStats, clearAtlasCache, setAtlasCanvasFactory, MAX_GRADE_BUCKETS,
} from '../js/art/atlas.js';
import { gradeFor, gradeHex, INDOOR_GRADE, NIGHT_INK } from '../js/world/lighting.js';
import { COLORS, MASTER, pal } from '../js/art/palette.js';
import { TILE_ART } from '../js/art/tiles/index.js';
import { PROP_ART } from '../js/art/props.js';
import { UI_ART } from '../js/art/ui.js';

const px = (img, x, y) => {
  const i = (y * img.w + x) * 4;
  return '#' + [0, 1, 2].map((k) => img.pixels[i + k].toString(16).padStart(2, '0')).join('').toUpperCase();
};
const alpha = (img, x, y) => img.pixels[(y * img.w + x) * 4 + 3];
const NOON = gradeFor(12 * 60, 'clear');
const NIGHT = gradeFor(23 * 60, 'clear');
const lum = (h) => [1, 3, 5].reduce((s, i, k) => s + parseInt(h.slice(i, i + 2), 16) * [0.3, 0.59, 0.11][k], 0);

beforeEach(() => clearAtlasCache());

describe('registry', () => {
  it('registers every tile, prop and UI art id', () => {
    const ids = new Set(artIds());
    for (const id of [...Object.keys(TILE_ART), ...Object.keys(PROP_ART), ...Object.keys(UI_ART)]) assert.ok(ids.has(id), id);
    assert.equal(artDef('grass-a').source, 'tile');
    assert.equal(artDef('boat').source, 'prop');
    assert.equal(artDef('ui-cursor').kind, 'ui');
  });
  it('resolves placeholder and prototype aliases', () => {
    assert.equal(resolveArtId('deep-water'), 'water-deep');
    assert.equal(resolveArtId('tallgrass'), 'tall-grass');
    assert.equal(resolveArtId('floor'), 'floor-boards');
    assert.equal(resolveArtId('nope'), null);
    assert.throws(() => artDef('nope'), /unknown art/);
  });
  it('registerArt accepts the creature prototype shape and refuses duplicates', () => {
    const rows = ['....', '.kb.', '.bb.', '....'];
    registerArt({ 'test-critter': { rows, idle2: rows, back: rows.slice().reverse(), palette: pal('kb') } }, { source: 'creature', kind: 'creature' });
    const d = artDef('test-critter');
    assert.equal(d.frames.length, 2);
    assert.ok(d.variants.back);
    const back = getSprite('test-critter', 'back');
    assert.equal(px(back, 1, 2), MASTER.k);
    assert.throws(() => registerArt({ 'test-critter': { rows, palette: pal('kb') } }), /already registered/);
    registerArt({ 'test-critter': { rows, palette: pal('kb') } }, { replace: true });
    registerAliases({ critter: 'test-critter' });
    assert.equal(resolveArtId('critter'), 'test-critter');
  });
});

describe('getTile raw', () => {
  it('decodes 16×16 with the palette hexes; shadow chars stay transparent', () => {
    const t = getTile('grass-a');
    assert.equal(t.w, 16); assert.equal(t.h, 16);
    assert.equal(px(t, 0, 0), COLORS.grass2);
    const bush = getTile('bush');
    const def = artDef('bush');
    const sCh = Object.entries(def.pal).find(([, v]) => v === 'shadow')[0];
    const rows = def.frames[0];
    const y = rows.findIndex((r) => r.includes(sCh));
    assert.equal(alpha(bush, rows[y].indexOf(sCh), y), 0);
  });
  it('wraps frames and caches: the same call returns the same object', () => {
    const a = getTile('water-deep', 1);
    assert.equal(getTile('water-deep', 5), a);
    assert.notEqual(getTile('water-deep', 2), a);
  });
  it('flip bits mirror the pixels', () => {
    const t = getTile('dig-crack');
    const f = getTile('dig-crack', 0, null, 1);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) assert.equal(alpha(f, x, y), alpha(t, 15 - x, y));
  });
});

describe('getTile graded (palette LUT)', () => {
  it('noon grade leaves colours as authored', () => {
    const t = getTile('sand', 0, NOON);
    assert.equal(px(t, 0, 0), COLORS.sand2);
  });
  it('night recolours ordinary colours through lighting.gradeHex, never below ink', () => {
    const t = getTile('sand', 0, NIGHT);
    assert.equal(px(t, 0, 0), gradeHex(COLORS.sand2, NIGHT, NIGHT_INK).toUpperCase());
    assert.ok(lum(px(t, 0, 0)) < lum(COLORS.sand2));
    const ink = [0x14, 0x1b, 0x33];
    const deep = getTile('water-deep', 0, NIGHT);
    for (let i = 0; i < deep.pixels.length; i += 4) {
      if (!deep.pixels[i + 3]) continue;
      for (let k = 0; k < 3; k++) assert.ok(deep.pixels[i + k] >= ink[k] - 1);
    }
  });
  it('! colours bypass the LUT (glowing mud stays full cyan at night)', () => {
    const def = artDef('mud-glow');
    const aCh = Object.entries(def.pal).find(([, v]) => v === '!bio1')[0];
    const rows = def.frames[0];
    const y = rows.findIndex((r) => r.includes(aCh));
    const t = getTile('mud-glow', 0, NIGHT);
    assert.equal(px(t, rows[y].indexOf(aCh), y), COLORS['!bio1']);
  });
  it('variant palettes: the lit lamp keeps its amber at night, the unlit one grades', () => {
    const def = artDef('lamp-post');
    const lit = getSprite('lamp-post', { name: 'lit', grade: NIGHT });
    const unlit = getSprite('lamp-post', { grade: NIGHT });
    const gCh = 'g';
    const y = def.frames[0].findIndex((r) => r.includes(gCh));
    const x = def.frames[0][y].indexOf(gCh);
    assert.equal(px(lit, x, y), COLORS['!amber']);
    assert.notEqual(px(unlit, x, y), COLORS.pane1);
  });
  it('UI art is never graded', () => {
    const a = getSprite('ui-wax-seal', { grade: NIGHT });
    const b = getSprite('ui-wax-seal');
    assert.equal(a, b);
  });
  it('accepts grade ids and rejects junk', () => {
    assert.equal(resolveGrade(null), null);
    assert.equal(resolveGrade('raw'), null);
    assert.equal(resolveGrade('indoor'), INDOOR_GRADE);
    assert.equal(resolveGrade(NIGHT.id), NIGHT);
    assert.throws(() => resolveGrade('99|clear'), RangeError);
    assert.throws(() => resolveGrade('banana'), RangeError);
    assert.throws(() => resolveGrade({ id: 'x' }), TypeError);
    const t = getTile('sand', 0, NIGHT.id);
    assert.equal(px(t, 0, 0), gradeHex(COLORS.sand2, NIGHT, NIGHT_INK).toUpperCase());
  });
});

describe('bounded per-grade cache (§12)', () => {
  it('keeps at most MAX_GRADE_BUCKETS grades and evicts the least recently used', () => {
    assert.equal(MAX_GRADE_BUCKETS, 3);
    const grades = [0, 6, 12, 18, 22].map((h) => gradeFor(h * 60, 'clear'));
    getTile('sand', 0, grades[0]);
    getTile('sand', 0, grades[1]);
    getTile('sand', 0, grades[2]);
    getTile('sand', 0, grades[0]); // touch 0 so 1 is the LRU
    getTile('sand', 0, grades[3]);
    let s = atlasStats();
    assert.equal(s.grades.length, 3);
    assert.ok(!s.grades.includes(grades[1].id));
    assert.ok(s.grades.includes(grades[0].id));
    assert.equal(s.evictions, 1);
    for (let h = 0; h < 24; h += 0.5) getTile('grass-a', 0, gradeFor(h * 60, 'rain'));
    s = atlasStats();
    assert.equal(s.grades.length, 3);
  });
  it('a cache hit returns the identical image (no re-decode, no allocation of a new image)', () => {
    const a = getTile('river', 2, NIGHT);
    const before = atlasStats().gradedImages;
    for (let i = 0; i < 100; i++) assert.equal(getTile('river', 2, NIGHT), a);
    assert.equal(atlasStats().gradedImages, before);
  });
});

describe('shadows, animation, colour helper', () => {
  it('getShadow returns only the shadow pixels, or null', () => {
    const s = getShadow('tree-alder');
    assert.ok(s);
    let n = 0;
    for (let i = 0; i < s.pixels.length; i += 4) if (s.pixels[i + 3]) { n++; assert.equal(px(s, (i / 4) % s.w, Math.floor(i / 4 / s.w)), COLORS.shadow); }
    assert.ok(n > 10);
    assert.equal(getShadow('sand'), null);
  });
  it('animFrame follows the art fps', () => {
    assert.equal(animFrame('sand', 5000), 0);
    const d = artDef('water-deep');
    assert.equal(animFrame('water-deep', 1000), Math.floor(d.fps) % d.frames.length);
  });
  it('gradeColour grades names and keeps exempt ones', () => {
    assert.equal(gradeColour('!amber', NIGHT), '#F9C46B');
    assert.equal(gradeColour('sand2', null), '#E8D3A0');
    assert.equal(gradeColour('sand2', NIGHT), gradeHex('#E8D3A0', NIGHT, NIGHT_INK));
  });
});

describe('buildGameAtlases', () => {
  it('packs tiles, props and UI into three sheets with a lookup', () => {
    const A = buildGameAtlases();
    for (const g of ['tiles', 'props', 'ui']) {
      assert.ok(A[g].atlas, g);
      assert.ok(A[g].atlas.w <= 1024, `${g} fits 1024 wide`);
    }
    const tile = A.lookup('water-deep', 3);
    assert.equal(tile.atlas, A.tiles.atlas);
    const f = tile.atlas.frames[tile.index];
    assert.equal(f.w, 16);
    const lit = A.lookup('lighthouse', 7, 'lit');
    assert.equal(lit.atlas, A.props.atlas);
    assert.equal(A.lookup('nope'), null);
    // every frame of every tile is indexed
    let frames = 0;
    for (const t of Object.values(TILE_ART)) frames += t.frames.length;
    assert.ok(A.tiles.index.size >= frames);
  });
});

describe('canvas factory', () => {
  it('graded images create their canvas lazily through the factory', () => {
    let made = 0;
    setAtlasCanvasFactory((w, h) => {
      made++;
      return { width: w, height: h, getContext: () => ({ createImageData: (ww, hh) => ({ data: new Uint8ClampedArray(ww * hh * 4) }), putImageData() {} }) };
    });
    try {
      const t = getTile('path', 0, NIGHT);
      assert.equal(made, 0);
      const c = t.canvas;
      assert.equal(made, 1);
      assert.equal(t.canvas, c);
      assert.equal(c.width, 16);
    } finally {
      setAtlasCanvasFactory(null);
    }
  });
});
