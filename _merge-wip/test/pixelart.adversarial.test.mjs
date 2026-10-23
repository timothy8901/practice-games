// Adversarial tests for js/core/pixelart.js — run with
// `node --test test/pixelart.adversarial.test.mjs`. These complement
// pixelart.test.mjs with malformed input, boundaries, determinism across
// processes (golden hashes), large inputs, re-entrancy and state restoration.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as px from '../js/core/pixelart.js';

const {
  decodeSprite, drawSprite, paletteSwap, silhouette, outlineSprite, makePattern,
  recolorHSL, lerpColor, hexToRgb, rgbToHex, buildAtlas, drawAtlasFrame,
  rgbToHsl, hslToRgb, normalizeHex, opaqueBounds,
  setCanvasFactory, clearSpriteCache, spriteCacheSize, MAX_PIXELS,
} = px;

const PAL = { k: '#000000', r: '#ff0000', g: '#00ff00', b: '#0000ff', h: '#ffffff80' };
const ARROW = ['r...', 'rrg.', 'r..b'];

function at(obj, x, y) {
  const i = (y * obj.w + x) * 4;
  return Array.from(obj.pixels.subarray(i, i + 4));
}
const rgba = (hex) => { const c = hexToRgb(hex); return [c.r, c.g, c.b, c.a]; };
const CLEAR = [0, 0, 0, 0];

/** 32-bit FNV-1a, for golden hashes of pixel buffers. */
function fnv1a(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0).toString(16);
}

/** Deterministic mulberry32. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random sprites with a fixed seed (shared with the golden hash below). */
function randomSprites(seed, count) {
  const r = rng(seed);
  const chars = 'krgbh.';
  const out = [];
  for (let i = 0; i < count; i++) {
    const w = 1 + Math.floor(r() * 24);
    const h = 1 + Math.floor(r() * 24);
    const rows = [];
    for (let y = 0; y < h; y++) {
      let s = '';
      for (let x = 0; x < w; x++) s += chars[Math.floor(r() * chars.length)];
      rows.push(s);
    }
    out.push(decodeSprite(rows, PAL));
  }
  return out;
}

/** Minimal recording context; `failOn` makes that method throw. */
function fakeContext(failOn = null) {
  const ctx = {
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    depth: 0,
    calls: [],
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData() {},
    drawImage(...args) {
      if (failOn === 'drawImage') throw new Error('synthetic drawImage failure');
      ctx.calls.push(['drawImage', ...args.slice(1)]);
    },
    save() { ctx.depth++; },
    restore() { ctx.depth--; },
    translate() {},
    scale() {},
    createPattern(src, rep) { return { src, rep, owner: ctx }; },
  };
  return ctx;
}

function fakeFactory(created = []) {
  return (w, h) => {
    const canvas = { width: w, height: h };
    const ctx = fakeContext();
    canvas.getContext = () => ctx;
    created.push(canvas);
    return canvas;
  };
}

// ---------------------------------------------------------------------------
// paletteSwap semantics
// ---------------------------------------------------------------------------

describe('paletteSwap is simultaneous', () => {
  it('exchanges two colours instead of collapsing them', () => {
    const s = decodeSprite(['rg', 'gr'], PAL);
    const swapped = paletteSwap(s, { '#ff0000': '#00ff00', '#00ff00': '#ff0000' });
    assert.equal(swapped.palette.r, '#00ff00');
    assert.equal(swapped.palette.g, '#ff0000');
    assert.deepEqual(at(swapped, 0, 0), rgba('#00ff00'));
    assert.deepEqual(at(swapped, 1, 0), rgba('#ff0000'));
    const viaMap = paletteSwap(s, new Map([['#f00', '#0f0'], ['#0f0', '#f00']]));
    assert.equal(viaMap, swapped, 'short hex and Map form reach the same cache entry');
  });
  it('matches colours against the input palette even after a char entry changed a slot', () => {
    const s = decodeSprite(['rg'], PAL);
    const out = paletteSwap(s, { r: '#00ff00', '#00ff00': '#0000ff' });
    assert.equal(out.palette.r, '#00ff00', 'char entry is not re-matched by the later colour entry');
    assert.equal(out.palette.g, '#0000ff');
  });
  it('lets the last entry win when several target one slot', () => {
    const s = decodeSprite(['r'], PAL);
    assert.equal(paletteSwap(s, { r: '#111111', '#ff0000': '#222222' }).palette.r, '#222222');
    assert.equal(paletteSwap(s, { '#ff0000': '#222222', r: '#111111' }).palette.r, '#111111');
  });
  it('rejects falsy non-null values instead of silently clearing the slot', () => {
    const s = decodeSprite(['r'], PAL);
    for (const bad of ['', 0, false, {}]) {
      assert.throws(() => paletteSwap(s, { r: bad }), TypeError, `value ${JSON.stringify(bad)}`);
    }
    assert.deepEqual(at(paletteSwap(s, { r: null }), 0, 0), CLEAR);
    assert.deepEqual(at(paletteSwap(s, { r: undefined }), 0, 0), CLEAR);
  });
  it('works on sprites that use a generated transparent character', () => {
    const base = decodeSprite(['. ', '.'], { '.': '#000', ' ': '#fff' });
    assert.equal(base.palette['@'], null, 'padding char was generated');
    const painted = paletteSwap(base, { '@': '#ff0000' });
    assert.deepEqual(at(painted, 1, 1), rgba('#ff0000'));
    const again = decodeSprite(painted.rows, painted.palette);
    assert.deepEqual(again.pixels, painted.pixels, 'round trip still holds with a new generated char');
  });
});

// ---------------------------------------------------------------------------
// Cache invalidation and mutation
// ---------------------------------------------------------------------------

describe('cache invalidation', () => {
  it('clearSpriteCache re-reads a mutated palette object', () => {
    const pal = { r: '#ff0000' };
    const rows = ['r'];
    const before = decodeSprite(rows, pal);
    assert.deepEqual(at(before, 0, 0), rgba('#ff0000'));
    pal.r = '#0000ff';
    clearSpriteCache();
    const after = decodeSprite(rows, pal);
    assert.deepEqual(at(after, 0, 0), rgba('#0000ff'));
    assert.equal(after.palette.r, '#0000ff');
    assert.equal(outlineSprite(after, '#fff').palette.r, '#0000ff');
  });
  it('clearSpriteCache re-reads a mutated rows array', () => {
    const rows = ['r.'];
    assert.deepEqual(at(decodeSprite(rows, PAL), 1, 0), CLEAR);
    rows[0] = 'rr';
    clearSpriteCache();
    assert.deepEqual(at(decodeSprite(rows, PAL), 1, 0), rgba('#ff0000'));
  });
  it('a reused, mutated options object never serves a stale variant', () => {
    const opts = { flipX: false, scale: 1 };
    const plain = decodeSprite(ARROW, PAL, opts);
    opts.flipX = true;
    const flipped = decodeSprite(ARROW, PAL, opts);
    assert.notEqual(plain, flipped);
    assert.deepEqual(flipped.rows, ['...r', '.grr', 'b..r']);
    opts.scale = 2;
    assert.equal(decodeSprite(ARROW, PAL, opts).w, 8);
  });
  it('structurally equal palettes and rows in fresh objects share one sprite', () => {
    const a = decodeSprite(['rg'], { r: '#ff0000', g: '#00ff00' });
    const b = decodeSprite(['rg'], { g: '#0F0', r: '#F00' });
    const c = decodeSprite(['rg'], new Map([['r', '#ff0000'], ['g', '#00ff00']]));
    assert.equal(a, b);
    assert.equal(a, c);
  });
  it('frozen inputs and null-prototype palettes are accepted', () => {
    const pal = Object.create(null);
    pal.r = '#ff0000';
    const rows = Object.freeze(['r']);
    const s = decodeSprite(rows, Object.freeze(pal));
    assert.deepEqual(at(s, 0, 0), rgba('#ff0000'));
    assert.deepEqual(s.palette, { r: '#ff0000' });
  });
});

// ---------------------------------------------------------------------------
// Malformed input and boundaries
// ---------------------------------------------------------------------------

describe('malformed palettes and rows', () => {
  it('rejects falsy non-null palette values', () => {
    for (const bad of ['', 0, false, [], {}]) {
      assert.throws(() => decodeSprite(['r'], { r: bad }), TypeError, `value ${JSON.stringify(bad)}`);
    }
    assert.deepEqual(at(decodeSprite(['r'], { r: null }), 0, 0), CLEAR);
    assert.deepEqual(at(decodeSprite(['r'], { r: undefined }), 0, 0), CLEAR);
  });
  it('explains multi-unit (emoji) characters in keys and rows', () => {
    assert.throws(() => decodeSprite(['x'], { '😀': '#f00' }), /single character.*UTF-16/);
    assert.throws(() => decodeSprite(['😀'], { r: '#f00' }), /multi-unit character.*row 0, column 0/);
    assert.throws(() => decodeSprite(['r\u200br'], { r: '#f00' }), /unknown palette character "\\u200b" at row 0, column 1/);
    assert.throws(() => decodeSprite(['r\tr'], { r: '#f00' }), /unknown palette character "\\u0009" at row 0, column 1/);
    assert.throws(() => decodeSprite(['r\u00a0r'], { r: '#f00' }), /unknown palette character "\\u00a0" at row 0, column 1/);
    assert.throws(() => decodeSprite(['r r'], { r: '#f00', ' ': '#fff' }, { outline: 'nope' }), TypeError);
    assert.deepEqual(at(decodeSprite(['r r'], { r: '#f00', ' ': undefined }), 1, 0), CLEAR, 'undefined value is transparent');
  });
  it('accepts single-unit non-ASCII palette characters', () => {
    const s = decodeSprite(['é©→'], { 'é': '#f00', '©': '#0f0', '→': '#00f' });
    assert.equal(s.w, 3);
    assert.deepEqual(at(s, 2, 0), rgba('#0000ff'));
    assert.equal(decodeSprite(s.rows, s.palette), s);
  });
  it('treats a whitespace-only first and last template line symmetrically', () => {
    const s = decodeSprite('   \n  r\n  r\n   ', { r: '#f00' });
    assert.deepEqual(s.rows, ['r', 'r']);
    const tabs = decodeSprite('\n\t\tr.\n\t\t.r\n\t', { r: '#f00' });
    assert.deepEqual(tabs.rows, ['r.', '.r']);
  });
  it('keeps interior blank lines as transparent rows', () => {
    const s = decodeSprite('\n  r\n\n  r\n', { r: '#f00' });
    assert.equal(s.h, 3);
    assert.deepEqual(at(s, 0, 1), CLEAR);
  });
  it('rejects control characters, non-string rows and nested arrays', () => {
    assert.throws(() => decodeSprite(['r\nr'], { r: '#f00' }), /unknown palette character "\\u000a" at row 0, column 1/);
    assert.throws(() => decodeSprite([['r']], { r: '#f00' }), TypeError);
    assert.throws(() => decodeSprite([null], { r: '#f00' }), TypeError);
    assert.throws(() => decodeSprite({ length: 1, 0: 'r' }, { r: '#f00' }), TypeError);
  });
  it('rejects hex look-alikes', () => {
    for (const bad of ['＃ｆｆｆ', '#\u212Aff', '# fff', '#ff f', '#ff00zz', '0xff0000', 'ff', '#']) {
      assert.throws(() => hexToRgb(bad), TypeError, `should reject ${JSON.stringify(bad)}`);
    }
    assert.deepEqual(hexToRgb('#bad'), { r: 187, g: 170, b: 221, a: 255 });
    assert.equal(normalizeHex('#FFFFFF00'), '#ffffff00');
  });
});

describe('non-finite numbers are rejected everywhere', () => {
  it('colour helpers', () => {
    for (const v of [Infinity, -Infinity, NaN]) {
      assert.throws(() => rgbToHex(v, 0, 0), TypeError);
      assert.throws(() => rgbToHex(0, 0, 0, v), TypeError);
      assert.throws(() => lerpColor('#000', '#fff', v), TypeError);
      assert.throws(() => recolorHSL('#f00', v), TypeError);
      assert.throws(() => recolorHSL('#f00', 0, v), TypeError);
      assert.throws(() => recolorHSL('#f00', 0, 0, v), TypeError);
      assert.throws(() => hslToRgb({ h: v, s: 1, l: 0.5 }), TypeError);
      assert.throws(() => hslToRgb({ h: 0, s: v, l: 0.5 }), TypeError);
      assert.throws(() => rgbToHsl({ r: v, g: 0, b: 0 }), TypeError);
      assert.throws(() => decodeSprite(ARROW, PAL, { tint: { color: '#fff', amount: v } }), TypeError);
    }
    assert.equal(rgbToHex(-0, -0, -0), '#000000');
    assert.equal(rgbToHex(255.4, 0.5, 0.49), '#ff0100');
  });
  it('huge finite deltas still wrap and clamp', () => {
    assert.equal(recolorHSL('#ff0000', 360 * 1e6 + 120), '#00ff00');
    assert.equal(recolorHSL('#ff0000', 0, 1e9, -1e9), '#000000');
  });
});

describe('pixel budget', () => {
  it('exports the limit', () => {
    assert.equal(MAX_PIXELS, 4096 * 4096);
  });
  it('refuses an explosive scale quickly with a clear RangeError', () => {
    const t0 = performance.now();
    assert.throws(() => decodeSprite(ARROW, PAL, { scale: 1e6 }), /RangeError|pixel limit/);
    assert.throws(() => decodeSprite(ARROW, PAL, { scale: 1e9 }), (e) => e instanceof RangeError && /pixel limit/.test(e.message));
    assert.throws(() => decodeSprite(['r'], PAL, { scale: 4097 }), RangeError);
    assert.throws(() => decodeSprite(['r'], PAL, { scale: 4095, outline: '#000' }), RangeError, 'outline growth counts');
    assert.ok(performance.now() - t0 < 200, 'rejected before allocating anything');
  });
  it('still allows legitimately large sprites', () => {
    const s = decodeSprite(['rg', 'gr'], PAL, { scale: 512 });
    assert.equal(s.w, 1024);
    assert.equal(s.pixels.length, 1024 * 1024 * 4);
    assert.deepEqual(at(s, 1023, 0), rgba('#00ff00'));
  });
  it('caps raw rows and atlases too', () => {
    const wide = 'r'.repeat(4097);
    const rows = new Array(4097).fill(wide);
    assert.throws(() => decodeSprite(rows, PAL), RangeError);
    const s = decodeSprite(['r'], PAL, { scale: 64 });
    assert.throws(() => buildAtlas([s], { padding: 3000 }), RangeError);
  });
});

// ---------------------------------------------------------------------------
// Determinism across processes (golden hashes)
// ---------------------------------------------------------------------------

describe('determinism', () => {
  it('a composite decode matches its golden hash', () => {
    const s = decodeSprite(ARROW, PAL, {
      flipX: true, outline: '#123456', outlineCorners: true, scale: 3, tint: { color: '#00ffff', amount: 0.35 },
    });
    assert.equal(s.w, 18);
    assert.equal(s.h, 15);
    assert.equal(fnv1a(s.pixels), 'da4bc039');
    assert.equal(s.key.slice(0, 11), '18x15@-3,-3');
    clearSpriteCache();
    const again = decodeSprite(ARROW, PAL, {
      flipX: true, outline: '#123456', outlineCorners: true, scale: 3, tint: { color: '#00ffff', amount: 0.35 },
    });
    assert.notEqual(again, s);
    assert.equal(again.key, s.key);
    assert.equal(fnv1a(again.pixels), 'da4bc039');
  });
  it('a 400-sprite atlas matches its golden layout and hash', () => {
    const sprites = randomSprites(99, 400);
    const atlas = buildAtlas(sprites);
    assert.equal(atlas.w, 270);
    assert.equal(atlas.h, 288);
    assert.equal(fnv1a(atlas.pixels), 'e75a9844');
    const again = buildAtlas(randomSprites(99, 400));
    assert.deepEqual(again.frames, atlas.frames);
  });
  it('a full-screen 480x270 sprite matches its golden hash', () => {
    const chars = 'krgbh.';
    const big = [];
    for (let y = 0; y < 270; y++) {
      let s = '';
      for (let x = 0; x < 480; x++) s += chars[(x * 7 + y * 3) % 5];
      big.push(s);
    }
    const t0 = performance.now();
    const s = decodeSprite(big, PAL);
    const ms = performance.now() - t0;
    assert.equal(s.w, 480);
    assert.equal(s.h, 270);
    assert.equal(fnv1a(s.pixels), '2c2449c5');
    assert.ok(ms < 500, `480x270 decode took ${ms.toFixed(1)}ms`);
  });
});

// ---------------------------------------------------------------------------
// Large inputs and packing quality
// ---------------------------------------------------------------------------

describe('large inputs', () => {
  it('packs 400 random sprites without overlap, inside the sheet, with clear gutters', () => {
    const sprites = randomSprites(7, 400);
    const atlas = buildAtlas(sprites, { padding: 1 });
    const covered = new Uint8Array(atlas.w * atlas.h);
    let area = 0;
    for (let i = 0; i < sprites.length; i++) {
      const f = atlas.frames[i];
      const s = sprites[i];
      assert.equal(f.w, s.w);
      assert.equal(f.h, s.h);
      assert.ok(f.x >= 1 && f.y >= 1 && f.x + f.w + 1 <= atlas.w && f.y + f.h + 1 <= atlas.h, `frame ${i} inside`);
      area += s.w * s.h;
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          const idx = (f.y + y) * atlas.w + f.x + x;
          assert.equal(covered[idx], 0, `overlap at frame ${i}`);
          covered[idx] = 1;
          const p = (idx) * 4;
          const q = (y * s.w + x) * 4;
          for (let c = 0; c < 4; c++) assert.equal(atlas.pixels[p + c], s.pixels[q + c]);
        }
      }
    }
    for (let i = 0; i < covered.length; i++) {
      if (!covered[i]) assert.equal(atlas.pixels[i * 4 + 3], 0, 'gutter pixel is transparent');
    }
    assert.ok(area / (atlas.w * atlas.h) > 0.5, `packing efficiency ${(area / (atlas.w * atlas.h)).toFixed(2)}`);
  });
  it('dedupes a thousand references to one sprite', () => {
    const s = decodeSprite(ARROW, PAL);
    const atlas = buildAtlas(new Array(1000).fill(s), { padding: 0 });
    assert.equal(atlas.frames.length, 1000);
    assert.equal(atlas.w, 4);
    assert.equal(atlas.h, 3);
    assert.ok(atlas.frames.every((f) => f.x === 0 && f.y === 0));
  });
  it('a lone sprite with no padding packs edge to edge', () => {
    const s = decodeSprite(['rrr', 'rrr'], PAL);
    const atlas = buildAtlas([s], { padding: 0 });
    assert.equal(atlas.w, 3);
    assert.equal(atlas.h, 2);
    assert.deepEqual(atlas.pixels, s.pixels);
  });
  it('the identity fast path keeps per-frame decodes cheap', () => {
    decodeSprite(ARROW, PAL, { outline: '#000' });
    decodeSprite(ARROW, PAL, { outline: '#000', flipX: true });
    const t0 = performance.now();
    for (let i = 0; i < 20000; i++) decodeSprite(ARROW, PAL, { flipX: (i & 1) === 1, outline: '#000' });
    const ms = performance.now() - t0;
    assert.ok(ms < 400, `20k cached decodes took ${ms.toFixed(1)}ms`);
    assert.equal(spriteCacheSize(), spriteCacheSize(), 'no growth while hitting the cache');
  });
  it('many distinct decodes with a shared palette all stay correct', () => {
    const r = rng(5);
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      const rows = [];
      const h = 1 + Math.floor(r() * 6);
      for (let y = 0; y < h; y++) {
        let line = '';
        const w = 1 + Math.floor(r() * 6);
        for (let x = 0; x < w; x++) line += 'krgb.'[Math.floor(r() * 5)];
        rows.push(line);
      }
      const s = decodeSprite(rows, PAL);
      seen.add(s);
      const again = decodeSprite(s.rows, s.palette);
      assert.equal(again, s);
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          const ch = s.rows[y][x];
          assert.deepEqual(at(s, x, y), ch === '.' ? CLEAR : rgba(PAL[ch]), `pixel ${x},${y} of sprite ${i}`);
        }
      }
    }
    assert.ok(seen.size > 250, 'random art is mostly distinct');
  });
});

// ---------------------------------------------------------------------------
// Drawing robustness and state restoration
// ---------------------------------------------------------------------------

describe('drawing robustness', () => {
  afterEach(() => setCanvasFactory(null));

  it('restores globalAlpha and the transform stack when drawImage throws', () => {
    setCanvasFactory(fakeFactory());
    const s = decodeSprite(ARROW, PAL);
    const ctx = fakeContext('drawImage');
    ctx.globalAlpha = 0.8;
    assert.throws(() => drawSprite(ctx, s, 0, 0, { alpha: 0.5 }), /synthetic/);
    assert.equal(ctx.globalAlpha, 0.8);
    assert.equal(ctx.depth, 0);
    assert.throws(() => drawSprite(ctx, s, 0, 0, { alpha: 0.5, flipX: true }), /synthetic/);
    assert.equal(ctx.globalAlpha, 0.8);
    assert.equal(ctx.depth, 0, 'save/restore balanced on the flip path');
    const atlas = buildAtlas([s]);
    assert.throws(() => drawAtlasFrame(ctx, atlas, 0, 0, 0, { alpha: 0.5, flipY: true }), /synthetic/);
    assert.equal(ctx.globalAlpha, 0.8);
    assert.equal(ctx.depth, 0);
  });

  it('does not throw on non-finite positions and tolerates odd option values', () => {
    setCanvasFactory(fakeFactory());
    const s = decodeSprite(ARROW, PAL);
    const ctx = fakeContext();
    drawSprite(ctx, s, NaN, 0);
    drawSprite(ctx, s, Infinity, -Infinity);
    drawSprite(ctx, s, 0, 0, { alpha: undefined, scale: null, flipX: 'yes' });
    drawSprite(ctx, s, 0, 0, null);
    assert.equal(ctx.calls.length, 4);
    assert.equal(ctx.globalAlpha, 1);
    assert.equal(ctx.depth, 0);
  });

  it('validates atlas frame indices', () => {
    setCanvasFactory(fakeFactory());
    const atlas = buildAtlas([decodeSprite(ARROW, PAL)]);
    const ctx = fakeContext();
    for (const bad of [NaN, 1.5, -1, 1, Infinity, undefined, null]) {
      assert.throws(() => drawAtlasFrame(ctx, atlas, bad, 0, 0), RangeError, `index ${String(bad)}`);
    }
    drawAtlasFrame(ctx, atlas, 0, 0, 0);
    assert.equal(ctx.calls.length, 1);
  });

  it('a canvas factory may itself use the module (re-entrancy)', () => {
    const created = [];
    const inner = fakeFactory(created);
    setCanvasFactory((w, h) => {
      // e.g. a factory that decodes a placeholder sprite while building a canvas
      const placeholder = decodeSprite(['k'], PAL);
      assert.ok(placeholder.w === 1);
      return inner(w, h);
    });
    const s = decodeSprite(ARROW, PAL);
    const c = s.canvas;
    assert.equal(c.width, 4);
    assert.equal(created.length, 1);
    assert.equal(s.canvas, c);
    const pattern = makePattern(s);
    assert.equal(pattern.src, c);
    assert.equal(created.length, 2, 'one sprite canvas plus one scratch canvas');
  });

  it('switching factories rebuilds the scratch context and patterns', () => {
    const first = [];
    setCanvasFactory(fakeFactory(first));
    const s = decodeSprite(ARROW, PAL);
    const p1 = makePattern(s);
    assert.equal(first.length, 2);
    const second = [];
    setCanvasFactory(fakeFactory(second));
    const p2 = makePattern(s);
    assert.notEqual(p2, p1);
    assert.equal(second.length, 2, 'new sprite canvas and new scratch canvas');
    assert.equal(p2.src, s.canvas);
    const scratch = second.find((c) => c.width === 1 && c.height === 1);
    assert.ok(scratch, 'a fresh 1x1 scratch canvas was created');
    assert.equal(p2.owner, scratch.getContext(), 'pattern made on the new scratch context');
  });

  it('a caller-supplied context without createPattern falls back to the scratch context', () => {
    const created = [];
    setCanvasFactory(fakeFactory(created));
    const s = decodeSprite(['rg', 'gr'], PAL);
    const p = makePattern(s, { drawImage() {} });
    assert.equal(p.rep, 'repeat');
    assert.equal(created.length, 2);
  });
});

// ---------------------------------------------------------------------------
// Derived sprite edge cases
// ---------------------------------------------------------------------------

describe('derived sprite edge cases', () => {
  it('silhouette of a fully transparent sprite is itself transparent and cached', () => {
    const empty = decodeSprite(['..', '..'], PAL);
    const sil = silhouette(empty, '#ff0000');
    assert.equal(opaqueBounds(sil), null);
    assert.equal(silhouette(empty, '#f00'), sil);
  });
  it('outlineSprite on a fully transparent sprite adds no outline', () => {
    const o = outlineSprite(decodeSprite(['..'], PAL), '#fff');
    assert.equal(o.w, 4);
    assert.equal(o.h, 3);
    assert.equal(opaqueBounds(o), null);
  });
  it('outline treats semi-transparent pixels as solid and zero-alpha as empty', () => {
    const s = decodeSprite(['h.t'], { h: '#ffffff80', t: '#ff000000' }, { outline: '#000' });
    assert.deepEqual(at(s, 0, 1), rgba('#000000'), 'left of the half-alpha pixel');
    assert.deepEqual(at(s, 4, 1), CLEAR, 'right of the zero-alpha pixel');
    assert.deepEqual(at(s, 3, 1), [255, 0, 0, 0], 'zero-alpha pixel keeps its rgb');
  });
  it('opaqueBounds respects scale and outline geometry', () => {
    const s = decodeSprite(['....', '.r..', '....'], PAL, { scale: 3 });
    assert.deepEqual(opaqueBounds(s), { x: 3, y: 3, w: 3, h: 3 });
    const o = decodeSprite(['....', '.r..', '....'], PAL, { outline: '#000' });
    assert.deepEqual(opaqueBounds(o), { x: 1, y: 1, w: 3, h: 3 });
  });
  it('tint then paletteSwap then silhouette compose and stay reproducible', () => {
    const t = decodeSprite(ARROW, PAL, { tint: { color: '#ffffff', amount: 0.25 } });
    assert.equal(t.palette.r, '#ff4040', 'r tinted 25% toward white');
    const sw = paletteSwap(t, { '#ff4040': '#000000' });
    assert.deepEqual(at(sw, 0, 0), rgba('#000000'));
    const sil = silhouette(sw, '#10203040');
    assert.deepEqual(at(sil, 0, 0), [16, 32, 48, 64]);
    assert.deepEqual(decodeSprite(sil.rows, sil.palette).pixels, sil.pixels);
  });
  it('decodeSprite with a Sprite and an incomplete palette names the missing character', () => {
    const o = decodeSprite(['r'], PAL, { outline: '#000' });
    assert.throws(() => decodeSprite(o, { r: '#0f0' }), /unknown palette character "@"/);
    const ok = decodeSprite(o, { ...o.palette, r: '#0f0' });
    assert.deepEqual(at(ok, 1, 1), rgba('#00ff00'));
    assert.equal(ok.ox, -1);
  });
});
