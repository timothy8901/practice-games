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

// ---------------------------------------------------------------------------
// Verifier additions: ranges, calls before init, unicode, malformed options,
// rapid repeated calls, boundaries and cross-process goldens for derived art.
// ---------------------------------------------------------------------------

/** FNV-1a of a string's UTF-8 bytes. */
const strHash = (s) => fnv1a(new TextEncoder().encode(s));
/** JSON-ish rendering for assertion messages that survives BigInt and undefined. */
const show = (v) => (v === undefined ? 'undefined' : JSON.stringify(v, (k, x) => (typeof x === 'bigint' ? `${x}n` : x)));

const UNI_PAL = {
  '✦': '#fff', '♥': '#f00', '★': '#ff0', '☾': '#88f',
  '☀': '#fa0', '▲': '#0f0', 'é': '#0ff', 'ñ': '#f0f',
};
const UNI = ['✦♥★', '☾☀▲', 'é.ñ'];

describe('rgbToHsl stays inside its documented ranges', () => {
  it('never reports saturation above 1 (float overshoot on near-white tints)', () => {
    for (const hex of ['#fbfbff', '#fefeff', '#fffefe', '#010100', '#000001']) {
      const { h, s, l } = rgbToHsl(hex);
      assert.ok(s >= 0 && s <= 1, `${hex} s=${s}`);
      assert.ok(l >= 0 && l <= 1, `${hex} l=${l}`);
      assert.ok(h >= 0 && h < 360, `${hex} h=${h}`);
    }
    assert.equal(rgbToHsl('#fbfbff').s, 1);
  });
  it('holds over a dense sweep of the cube and still round-trips', () => {
    for (let r = 0; r < 256; r += 3) for (let g = 0; g < 256; g += 5) for (let b = 0; b < 256; b += 7) {
      const hsl = rgbToHsl({ r, g, b });
      assert.ok(hsl.h >= 0 && hsl.h < 360 && hsl.s >= 0 && hsl.s <= 1 && hsl.l >= 0 && hsl.l <= 1, `${r},${g},${b}`);
      const back = hslToRgb(hsl);
      assert.ok(back.r === r && back.g === g && back.b === b, `${r},${g},${b} -> ${JSON.stringify(back)}`);
    }
  });
});

describe('calls before any canvas exists (Node, no factory)', () => {
  afterEach(() => setCanvasFactory(null));

  it('pure API works, canvas-backed calls fail with one clear message and leave ctx untouched', () => {
    setCanvasFactory(null);
    const s = decodeSprite(ARROW, PAL);
    const atlas = buildAtlas([s]);
    const ctx = fakeContext();
    ctx.globalAlpha = 0.7;
    assert.throws(() => drawSprite(ctx, s, 0, 0, { alpha: 0.5, flipX: true }), /no canvas implementation/);
    assert.throws(() => drawAtlasFrame(ctx, atlas, 0, 0, 0), /no canvas implementation/);
    assert.throws(() => makePattern(['r'], PAL), /no canvas implementation/);
    assert.throws(() => makePattern(s, ctx), /no canvas implementation/, 'a caller ctx still needs the sprite canvas');
    assert.throws(() => s.canvas, /no canvas implementation/);
    assert.throws(() => atlas.canvas, /no canvas implementation/);
    assert.equal(ctx.calls.length, 0);
    assert.equal(ctx.globalAlpha, 0.7);
    assert.equal(ctx.depth, 0);
    // nothing pure was poisoned by the failures
    assert.equal(decodeSprite(ARROW, PAL), s);
    assert.equal(paletteSwap(s, { r: '#000' }).palette.r, '#000000');
    assert.deepEqual(opaqueBounds(silhouette(s, '#fff')), { x: 0, y: 0, w: 4, h: 3 });
  });

  it('becomes drawable the moment a factory is installed, and fails again when it is removed', () => {
    setCanvasFactory(null);
    const s = decodeSprite(ARROW, PAL);
    const ctx = fakeContext();
    assert.throws(() => drawSprite(ctx, s, 0, 0), /no canvas implementation/);
    const created = [];
    setCanvasFactory(fakeFactory(created));
    drawSprite(ctx, s, 0, 0);
    assert.equal(ctx.calls.length, 1);
    assert.equal(created.length, 1);
    assert.equal(makePattern(s).rep, 'repeat');
    setCanvasFactory(null);
    assert.throws(() => drawSprite(ctx, s, 0, 0), /no canvas implementation/);
    assert.throws(() => makePattern(s), /no canvas implementation/);
  });

  it('a factory whose canvas has no 2d context fails cleanly and does not poison later factories', () => {
    setCanvasFactory((w, h) => ({ width: w, height: h, getContext: () => null }));
    const s = decodeSprite(ARROW, PAL);
    assert.throws(() => s.canvas, /could not acquire a 2d context/);
    assert.throws(() => makePattern(s), /could not acquire a 2d context/);
    assert.throws(() => drawSprite(fakeContext(), s, 0, 0), /could not acquire a 2d context/);
    const created = [];
    setCanvasFactory(fakeFactory(created));
    assert.equal(s.canvas.width, 4);
    assert.equal(makePattern(s).src, s.canvas);
    assert.equal(created.length, 2);
  });

  it('a throwing factory propagates its error and nothing stale is cached', () => {
    let calls = 0;
    setCanvasFactory(() => { calls++; throw new Error('synthetic factory failure'); });
    const s = decodeSprite(ARROW, PAL);
    assert.throws(() => s.canvas, /synthetic factory failure/);
    assert.throws(() => s.canvas, /synthetic factory failure/);
    assert.equal(calls, 2, 'retried, not cached as a failure');
    setCanvasFactory(fakeFactory());
    assert.equal(s.canvas.height, 3);
  });

  it('createPattern returning null is reported and not cached', () => {
    let nulls = 1;
    setCanvasFactory((w, h) => {
      const ctx = fakeContext();
      ctx.createPattern = (src, rep) => (nulls-- > 0 ? null : { src, rep });
      return { width: w, height: h, getContext: () => ctx };
    });
    const s = decodeSprite(ARROW, PAL);
    assert.throws(() => makePattern(s), /createPattern returned null/);
    const p = makePattern(s);
    assert.equal(p.rep, 'repeat');
    assert.equal(makePattern(s), p);
  });
});

describe('unicode art', () => {
  it('BMP symbols and accented letters are ordinary palette characters (golden)', () => {
    const s = decodeSprite(UNI, UNI_PAL, { outline: '#000', scale: 2 });
    assert.equal(s.w, 10);
    assert.equal(s.h, 10);
    assert.equal(fnv1a(s.pixels), '621dc605');
    assert.equal(s.palette['@'], '#000000', 'outline char is picked from the ASCII pool');
    const again = decodeSprite(s.rows, s.palette);
    assert.deepEqual(again.pixels, s.pixels, 'rows/palette reproduce the pixels');
    assert.equal(again.ox, 0, 'the draw offset is not part of rows/palette');
    const plain = decodeSprite(UNI, UNI_PAL);
    assert.equal(decodeSprite(plain.rows, plain.palette), plain, 'undecorated art round-trips to the same object');
    assert.deepEqual(at(paletteSwap(s, { '♥': '#000' }), 4, 2), rgba('#000000'));
    assert.deepEqual(at(silhouette(s, '#123456'), 2, 2), rgba('#123456'));
  });
  it('palette keys are case-sensitive and may be any single code unit', () => {
    const s = decodeSprite(['rRｒ'], { r: '#f00', R: '#0f0', 'ｒ': '#00f' });
    assert.deepEqual(at(s, 0, 0), rgba('#ff0000'));
    assert.deepEqual(at(s, 1, 0), rgba('#00ff00'));
    assert.deepEqual(at(s, 2, 0), rgba('#0000ff'));
  });
  it('names invisible and combining characters precisely in errors', () => {
    assert.throws(() => decodeSprite(['é'], { e: '#f00' }), /unknown palette character "́" at row 0, column 1/);
    assert.throws(() => decodeSprite(['r‏r'], { r: '#f00' }), /unknown palette character "\\u200f" at row 0, column 1/);
    assert.throws(() => decodeSprite(['r　r'], { r: '#f00' }), /unknown palette character "\\u3000" at row 0, column 1/);
    assert.throws(() => decodeSprite(['r‍r'], { r: '#f00' }), /unknown palette character "\\u200d" at row 0, column 1/);
    assert.throws(() => decodeSprite('﻿r\nrr', { r: '#f00' }), /unknown palette character "\\ufeff" at row 0, column 0/);
    assert.throws(() => decodeSprite(['r'], new Map([['\u{1F600}', '#f00']])), /single character.*UTF-16/);
    assert.throws(() => decodeSprite(['r'], { 'é́': '#f00' }), /single character/);
  });
  it('treats a surrogate pair as two pixels when the halves are palette keys (one pixel = one code unit)', () => {
    const s = decodeSprite(['\u{1F600}'], { '\ud83d': '#f00', '\ude00': '#0f0' });
    assert.equal(s.w, 2);
    assert.deepEqual(at(s, 0, 0), rgba('#ff0000'));
    assert.deepEqual(at(s, 1, 0), rgba('#00ff00'));
  });
});

describe('malformed options', () => {
  const base = () => decodeSprite(ARROW, PAL);

  it('non-object opts are treated as no options', () => {
    for (const v of [0, '', false, null, undefined, NaN, 5, 'flipX']) {
      assert.equal(decodeSprite(ARROW, PAL, v), base(), `opts=${String(v)}`);
    }
  });
  it('rejects every non-positive-integer scale', () => {
    for (const v of [Infinity, -Infinity, NaN, 2n, '2', [2], {}, -0, 1.0000001, true, 0, -1]) {
      assert.throws(() => decodeSprite(ARROW, PAL, { scale: v }), RangeError, `scale=${String(v)}`);
    }
    assert.equal(decodeSprite(ARROW, PAL, { scale: 1 }), base());
  });
  it('rejects malformed tints and ignores empty ones', () => {
    for (const v of [5, true, [], {}, { color: 5 }, { color: '#fff', amount: '1' }, { color: '#fff', amount: 1n }, { amount: 0.5 }]) {
      assert.throws(() => decodeSprite(ARROW, PAL, { tint: v }), TypeError, `tint=${show(v)}`);
    }
    for (const v of [0, '', false, null, undefined, { color: '#fff', amount: 0 }, { color: '#fff', amount: -3 }]) {
      assert.equal(decodeSprite(ARROW, PAL, { tint: v }), base(), `tint=${show(v)}`);
    }
  });
  it('rejects malformed outlines and ignores empty ones', () => {
    for (const v of [{}, [], true, 1, 'black', '#12']) {
      assert.throws(() => decodeSprite(ARROW, PAL, { outline: v }), TypeError, `outline=${show(v)}`);
    }
    for (const v of ['', 0, false, null, undefined]) {
      assert.equal(decodeSprite(ARROW, PAL, { outline: v }), base(), `outline=${show(v)}`);
    }
    assert.equal(decodeSprite(ARROW, PAL, { outlineCorners: true }), base(), 'corners without outline is a no-op');
  });
  it('flips follow JS truthiness, so odd values flip rather than throw', () => {
    assert.equal(decodeSprite(ARROW, PAL, { flipX: 'no' }), decodeSprite(ARROW, PAL, { flipX: true }));
    assert.equal(decodeSprite(ARROW, PAL, { flipY: 0 }), base());
  });
  it('validates atlas options strictly', () => {
    const s = base();
    for (const v of ['1', NaN, Infinity, 1.5, -1, true, [1]]) {
      assert.throws(() => buildAtlas([s], { padding: v }), RangeError, `padding=${String(v)}`);
    }
    assert.equal(buildAtlas([s], { padding: -0 }).w, 4, '-0 is zero padding');
    for (const v of ['7', NaN, 0, 0.5, -5, true, null, undefined].filter((v) => v !== null && v !== undefined)) {
      assert.throws(() => buildAtlas([s], { maxWidth: v }), RangeError, `maxWidth=${String(v)}`);
    }
    assert.equal(buildAtlas([s], { maxWidth: Infinity }).w, buildAtlas([s]).w);
    const tiles = [0, 1, 2, 3].map((i) => decodeSprite(['rr', 'rr'], { r: rgbToHex(i * 10, 0, 0) }));
    assert.deepEqual(buildAtlas(tiles, { maxWidth: 7.9 }).frames, buildAtlas(tiles, { maxWidth: 7 }).frames, 'fractional maxWidth floors');
    for (const bad of [[null], [s, 'x'], new Set([s]), [undefined], [{ ...s }]]) {
      assert.throws(() => buildAtlas(bad), TypeError);
    }
    assert.equal(buildAtlas(Object.freeze([s])).frames.length, 1);
  });
  it('drawAtlasFrame requires an integer index', () => {
    setCanvasFactory(fakeFactory());
    try {
      const atlas = buildAtlas([base(), decodeSprite(['bb'], PAL)]);
      const ctx = fakeContext();
      for (const bad of ['0', '1', [0], true, 2, -1, 0.5, 1n]) {
        assert.throws(() => drawAtlasFrame(ctx, atlas, bad, 0, 0), RangeError, `index ${String(bad)}`);
      }
      drawAtlasFrame(ctx, atlas, -0, 0, 0);
      drawAtlasFrame(ctx, atlas, 1, 0, 0);
      assert.equal(ctx.calls.length, 2);
    } finally {
      setCanvasFactory(null);
    }
  });
  it('paletteSwap rejects non-string Map keys and odd mapping containers', () => {
    const s = base();
    assert.throws(() => paletteSwap(s, new Map([[1, '#000']])), TypeError);
    assert.throws(() => paletteSwap(s, new Map([[null, '#000']])), TypeError);
    assert.throws(() => paletteSwap(s, 'r'), TypeError);
    assert.throws(() => paletteSwap(s, 42), TypeError);
    assert.equal(paletteSwap(s, {}), s, 'empty mapping is the identity');
    assert.equal(paletteSwap(s, new Map()), s);
  });
});

describe('rapid repeated calls', () => {
  afterEach(() => setCanvasFactory(null));

  it('cycling derived sprites does not grow the cache past the distinct variants', () => {
    const s = decodeSprite(ARROW, PAL);
    const maps = [{ r: '#111' }, { r: '#222' }, { '#00ff00': null }, { b: '#ffffff80' }];
    const firsts = maps.map((m) => paletteSwap(s, m));
    const sils = ['#000', '#fff', '#f00'].map((c) => silhouette(s, c));
    const outs = ['#000', '#fff'].map((c) => outlineSprite(s, c));
    const size = spriteCacheSize();
    const t0 = performance.now();
    for (let i = 0; i < 20000; i++) {
      assert.equal(paletteSwap(s, maps[i % 4]), firsts[i % 4]);
      assert.equal(silhouette(s, ['#000', '#fff', '#f00'][i % 3]), sils[i % 3]);
      assert.equal(outlineSprite(s, i & 1 ? '#fff' : '#000'), outs[i & 1]);
    }
    const ms = performance.now() - t0;
    assert.equal(spriteCacheSize(), size, 'no growth');
    assert.ok(ms < 2000, `60k derived calls took ${ms.toFixed(0)}ms`);
  });

  it('fresh but structurally equal inputs every frame still hit the content cache', () => {
    const s = decodeSprite(ARROW, PAL);
    const size = spriteCacheSize();
    for (let i = 0; i < 5000; i++) {
      assert.equal(decodeSprite(ARROW.map((r) => r), { ...PAL }, { flipX: false }), s);
    }
    assert.equal(spriteCacheSize(), size);
  });

  it('10k draws with mixed options leave the context state exactly as found', () => {
    setCanvasFactory(fakeFactory());
    const s = decodeSprite(ARROW, PAL, { outline: '#000' });
    const atlas = buildAtlas([s, decodeSprite(ARROW, PAL)]);
    const ctx = fakeContext();
    ctx.globalAlpha = 0.37;
    const r = rng(11);
    let expected = 0;
    for (let i = 0; i < 10000; i++) {
      const alpha = r() < 0.1 ? 0 : r() * 1.5;
      const opts = { alpha, flipX: r() < 0.5, flipY: r() < 0.5, scale: r() < 0.2 ? 0 : 1 + Math.floor(r() * 3), snap: r() < 0.5 };
      if (opts.alpha > 0 && opts.scale > 0) expected++;
      if (i & 1) drawSprite(ctx, s, r() * 480 - 20, r() * 270 - 20, opts);
      else drawAtlasFrame(ctx, atlas, i % 2, r() * 480, r() * 270, opts);
      assert.equal(ctx.globalAlpha, 0.37);
      assert.equal(ctx.depth, 0);
    }
    assert.equal(ctx.calls.length, expected);
    assert.equal(ctx.imageSmoothingEnabled, false);
  });

  it('interleaving clearSpriteCache with decodes always yields correct pixels', () => {
    const ref = decodeSprite(ARROW, PAL, { outline: '#000', scale: 2 }).pixels.slice();
    for (let i = 0; i < 1000; i++) {
      if (i % 97 === 0) clearSpriteCache();
      const s = decodeSprite(ARROW, PAL, { outline: '#000', scale: 2 });
      assert.deepEqual(s.pixels, ref);
      assert.equal(decodeSprite(ARROW, PAL, { outline: '#000', scale: 2 }), s);
    }
  });
});

describe('boundaries', () => {
  it('a sprite of exactly MAX_PIXELS is allowed and correct', () => {
    const s = decodeSprite(['r'], PAL, { scale: 4096 });
    assert.equal(s.w * s.h, MAX_PIXELS);
    assert.equal(s.pixels.length, MAX_PIXELS * 4);
    assert.deepEqual(at(s, 0, 0), rgba('#ff0000'));
    assert.deepEqual(at(s, 4095, 4095), rgba('#ff0000'));
    assert.throws(() => decodeSprite(['rr'], PAL, { scale: 4096 }), RangeError);
    assert.throws(() => outlineSprite(s, '#000'), RangeError);
    assert.throws(() => buildAtlas([s], { padding: 1 }), RangeError, 'gutters push it over');
    assert.equal(buildAtlas([s], { padding: 0 }).w, 4096);
    clearSpriteCache();
  });
  it('one-pixel-wide and one-pixel-tall sprites at the 4096 edge work', () => {
    const wide = decodeSprite(['r'.repeat(4096)], PAL, { flipX: true });
    const tall = decodeSprite(new Array(4096).fill('r'), PAL, { flipY: true });
    assert.equal(wide.w, 4096);
    assert.equal(wide.h, 1);
    assert.equal(tall.w, 1);
    assert.equal(tall.h, 4096);
    assert.deepEqual(opaqueBounds(wide), { x: 0, y: 0, w: 4096, h: 1 });
    assert.throws(() => decodeSprite(['r'.repeat(4097)], PAL, { scale: 4096 }), RangeError);
    clearSpriteCache();
  });
  it('a 1x1 sprite survives every transform', () => {
    const s = decodeSprite(['r'], PAL, { flipX: true, flipY: true, outline: '#000', outlineCorners: true, scale: 3, tint: { color: '#fff', amount: 0.5 } });
    assert.equal(s.w, 9);
    assert.equal(s.ox, -3);
    assert.deepEqual(at(s, 4, 4), rgba('#ff8080'));
    assert.deepEqual(at(s, 0, 0), rgba('#000000'));
    assert.deepEqual(opaqueBounds(s), { x: 0, y: 0, w: 9, h: 9 });
    const o = outlineSprite(s, '#0f0');
    assert.equal(o.w, 11);
    assert.equal(o.ox, -4);
  });
  it('alpha extremes', () => {
    assert.equal(opaqueBounds(silhouette(decodeSprite(ARROW, PAL), '#ff000000')), null, 'alpha-0 silhouette is empty');
    assert.equal(silhouette(decodeSprite(ARROW, PAL), '#ff0000ff').palette.r, '#ff0000');
    assert.equal(rgbToHex(0, 0, 0, 254.5), '#000000', '254.5 rounds to opaque and drops the alpha pair');
    assert.equal(rgbToHex(0, 0, 0, 0.49), '#00000000');
    assert.equal(lerpColor('#00000000', '#ffffffff', 1), '#ffffff');
    assert.equal(recolorHSL('#12345600', 180), '#56341200');
  });
});

describe('determinism of derived sprites and colour math (goldens)', () => {
  it('paletteSwap, silhouette and outlineSprite match their golden hashes', () => {
    const base = decodeSprite(ARROW, PAL);
    const sw = paletteSwap(base, { r: '#123456', '#00ff00': null, b: '#abcdef40' });
    assert.equal(fnv1a(sw.pixels), '7bdd0f8a');
    assert.equal(sw.key.slice(0, 20), '4x3@0,0|babcdef40g--');
    const sil = silhouette(decodeSprite(ARROW, PAL, { outline: '#000', scale: 2 }), '#10203080');
    assert.equal(sil.w, 12);
    assert.equal(sil.h, 10);
    assert.equal(sil.ox, -2);
    assert.equal(fnv1a(sil.pixels), '259b1145');
    const out2 = outlineSprite(outlineSprite(base, '#000'), '#fff', { corners: true });
    assert.equal(out2.w, 8);
    assert.equal(out2.h, 7);
    assert.equal(out2.ox, -2);
    assert.equal(fnv1a(out2.pixels), '61117f6b');
    const atlas = buildAtlas([sw, sil, out2, decodeSprite(UNI, UNI_PAL, { outline: '#000', scale: 2 }), base, sw], { padding: 2, maxWidth: 40 });
    assert.equal(atlas.w, 26);
    assert.equal(atlas.h, 31);
    assert.equal(fnv1a(atlas.pixels), '90de6c3a');
    assert.deepEqual(atlas.frames.map((f) => [f.x, f.y]), [[2, 26], [2, 2], [14, 14], [2, 14], [8, 26], [2, 26]]);
  });
  it('recolorHSL, lerpColor and rgbToHsl sweeps match their golden hashes', () => {
    let sweep = '';
    for (const c of ['#e8873a', '#4a7bd0', '#808080', '#ff000080']) {
      for (let i = 0; i < 360; i += 7) sweep += recolorHSL(c, i, (i % 5 - 2) / 10, (i % 3 - 1) / 10);
    }
    assert.equal(strHash(sweep), '429014b');
    let lerps = '';
    for (let i = 0; i <= 100; i++) lerps += lerpColor('#1d2430', '#f2c14e80', i / 100);
    assert.equal(strHash(lerps), '343c4aca');
    let hsls = '';
    for (let i = 0; i < 256; i += 5) hsls += JSON.stringify(rgbToHsl({ r: i, g: 255 - i, b: (i * 7) % 256 }));
    assert.equal(strHash(hsls), '2947c2f8');
  });
});
