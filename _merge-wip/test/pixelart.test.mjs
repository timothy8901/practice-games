// Unit tests for js/core/pixelart.js — run with `node --test test/pixelart.test.mjs`.
// Everything pure runs natively; canvas-dependent paths run against a recording
// fake canvas installed through setCanvasFactory().
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as px from '../js/core/pixelart.js';

const {
  decodeSprite, drawSprite, paletteSwap, silhouette, outlineSprite, makePattern,
  recolorHSL, lerpColor, hexToRgb, rgbToHex, buildAtlas, drawAtlasFrame,
  rgbToHsl, hslToRgb, normalizeHex, isSprite, opaqueBounds,
  setCanvasFactory, clearSpriteCache, spriteCacheSize,
} = px;

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

const PAL = { k: '#000000', r: '#ff0000', g: '#00ff00', b: '#0000ff', h: '#ffffff80' };
const ARROW = ['r...', 'rrg.', 'r..b']; // deliberately asymmetric, 4x3
const PLUS = ['.r.', 'rrr', '.r.'];

/** RGBA quad at (x, y) of a sprite/atlas. */
function at(obj, x, y) {
  const i = (y * obj.w + x) * 4;
  return Array.from(obj.pixels.subarray(i, i + 4));
}
const rgba = (hex) => { const c = hexToRgb(hex); return [c.r, c.g, c.b, c.a]; };
const CLEAR = [0, 0, 0, 0];

/** Deterministic mulberry32 for sampled property tests. */
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

/** Recording fake 2D context, shaped like the subset the module uses. */
function fakeContext(canvas) {
  const ctx = {
    canvas,
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    calls: [],
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    putImageData(img, x, y) { canvas.image = img; ctx.calls.push(['putImageData', x, y]); },
    drawImage(...args) { ctx.calls.push(['drawImage', ...args, { alpha: ctx.globalAlpha }]); },
    save() { ctx.calls.push(['save']); },
    restore() { ctx.calls.push(['restore']); },
    translate(x, y) { ctx.calls.push(['translate', x, y]); },
    scale(x, y) { ctx.calls.push(['scale', x, y]); },
    createPattern(src, rep) { ctx.calls.push(['createPattern', rep]); return { src, rep }; },
  };
  return ctx;
}

function fakeCanvasFactory(created = []) {
  return (w, h) => {
    const canvas = { width: w, height: h, fake: true };
    const ctx = fakeContext(canvas);
    canvas.getContext = () => ctx;
    created.push(canvas);
    return canvas;
  };
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

describe('hexToRgb', () => {
  it('parses every accepted form', () => {
    assert.deepEqual(hexToRgb('#ff8000'), { r: 255, g: 128, b: 0, a: 255 });
    assert.deepEqual(hexToRgb('ff8000'), { r: 255, g: 128, b: 0, a: 255 });
    assert.deepEqual(hexToRgb('#F80'), { r: 255, g: 136, b: 0, a: 255 });
    assert.deepEqual(hexToRgb('#f808'), { r: 255, g: 136, b: 0, a: 136 });
    assert.deepEqual(hexToRgb('#ff800080'), { r: 255, g: 128, b: 0, a: 128 });
    assert.deepEqual(hexToRgb('  #AbCdEf  '), { r: 171, g: 205, b: 239, a: 255 });
  });
  it('rejects garbage with TypeError', () => {
    for (const bad of ['#ggg', '#12345', '#1234567', '', 'red', 123, null, undefined, {}]) {
      assert.throws(() => hexToRgb(bad), TypeError, `should reject ${String(bad)}`);
    }
  });
});

describe('rgbToHex', () => {
  it('formats numbers and objects, omitting opaque alpha', () => {
    assert.equal(rgbToHex(255, 0, 0), '#ff0000');
    assert.equal(rgbToHex(0, 0, 0, 255), '#000000');
    assert.equal(rgbToHex({ r: 1, g: 2, b: 3, a: 4 }), '#01020304');
    assert.equal(rgbToHex({ r: 1, g: 2, b: 3 }), '#010203');
  });
  it('rounds and clamps', () => {
    assert.equal(rgbToHex(300, -5, 12.6), '#ff000d');
    assert.equal(rgbToHex(0, 0, 0, 127.5), '#00000080');
  });
  it('rejects non-numbers', () => {
    assert.throws(() => rgbToHex(NaN, 0, 0), TypeError);
    assert.throws(() => rgbToHex(1, 2), TypeError);
    assert.throws(() => rgbToHex('1', 2, 3), TypeError);
  });
  it('round-trips with hexToRgb', () => {
    const r = rng(7);
    for (let i = 0; i < 500; i++) {
      const c = { r: Math.floor(r() * 256), g: Math.floor(r() * 256), b: Math.floor(r() * 256), a: Math.floor(r() * 256) };
      assert.deepEqual(hexToRgb(rgbToHex(c)), c);
    }
  });
});

describe('normalizeHex', () => {
  it('canonicalises', () => {
    assert.equal(normalizeHex('#F00'), '#ff0000');
    assert.equal(normalizeHex('abc'), '#aabbcc');
    assert.equal(normalizeHex('#ffffffff'), '#ffffff');
    assert.equal(normalizeHex('#0000'), '#00000000');
  });
});

describe('lerpColor', () => {
  it('interpolates rgb and alpha with clamped t', () => {
    assert.equal(lerpColor('#000', '#fff', 0), '#000000');
    assert.equal(lerpColor('#000', '#fff', 1), '#ffffff');
    assert.equal(lerpColor('#000', '#fff', 0.5), '#808080');
    assert.equal(lerpColor('#000', '#fff', -1), '#000000');
    assert.equal(lerpColor('#000', '#fff', 2), '#ffffff');
    assert.equal(lerpColor('#00000000', '#000000', 0.5), '#00000080');
    assert.equal(lerpColor('#ff0000', '#0000ff', 0.25), '#bf0040');
  });
  it('rejects a non-numeric t', () => {
    assert.throws(() => lerpColor('#000', '#fff', NaN), TypeError);
    assert.throws(() => lerpColor('#000', '#fff', '0.5'), TypeError);
  });
});

describe('rgbToHsl / hslToRgb', () => {
  it('matches known values', () => {
    assert.deepEqual(rgbToHsl('#ff0000'), { h: 0, s: 1, l: 0.5, a: 255 });
    assert.deepEqual(rgbToHsl('#00ff00'), { h: 120, s: 1, l: 0.5, a: 255 });
    assert.deepEqual(rgbToHsl('#0000ff'), { h: 240, s: 1, l: 0.5, a: 255 });
    assert.deepEqual(rgbToHsl('#ffffff'), { h: 0, s: 0, l: 1, a: 255 });
    assert.deepEqual(rgbToHsl({ r: 0, g: 0, b: 0, a: 9 }), { h: 0, s: 0, l: 0, a: 9 });
    assert.deepEqual(hslToRgb({ h: 120, s: 1, l: 0.5 }), { r: 0, g: 255, b: 0, a: 255 });
    assert.deepEqual(hslToRgb({ h: 480, s: 1, l: 0.5 }), { r: 0, g: 255, b: 0, a: 255 });
    assert.deepEqual(hslToRgb({ h: -120, s: 1, l: 0.5 }), { r: 0, g: 0, b: 255, a: 255 });
    assert.deepEqual(hslToRgb({ h: 0, s: 5, l: -1, a: 3 }), { r: 0, g: 0, b: 0, a: 3 });
  });
  it('round-trips exactly over sampled 8-bit colours', () => {
    const r = rng(42);
    for (let i = 0; i < 3000; i++) {
      const c = { r: Math.floor(r() * 256), g: Math.floor(r() * 256), b: Math.floor(r() * 256), a: 255 };
      assert.deepEqual(hslToRgb(rgbToHsl(c)), c);
    }
    for (const v of [0, 1, 2, 127, 128, 254, 255]) {
      for (const c of [{ r: v, g: 0, b: 0, a: 255 }, { r: v, g: v, b: v, a: 255 }, { r: 255, g: v, b: 0, a: 255 }]) {
        assert.deepEqual(hslToRgb(rgbToHsl(c)), c);
      }
    }
  });
  it('rejects malformed input', () => {
    assert.throws(() => rgbToHsl(null), TypeError);
    assert.throws(() => rgbToHsl({ r: 'x', g: 0, b: 0 }), TypeError);
    assert.throws(() => hslToRgb(null), TypeError);
    assert.throws(() => hslToRgb({ h: 0, s: NaN, l: 0 }), TypeError);
  });
});

describe('recolorHSL', () => {
  it('rotates hue, wrapping both ways', () => {
    assert.equal(recolorHSL('#ff0000', 120), '#00ff00');
    assert.equal(recolorHSL('#ff0000', -120), '#0000ff');
    assert.equal(recolorHSL('#ff0000', 480), '#00ff00');
  });
  it('shifts and clamps saturation / lightness', () => {
    assert.equal(recolorHSL('#ff0000', 0, -1), '#808080');
    assert.equal(recolorHSL('#ff0000', 0, 0, 1), '#ffffff');
    assert.equal(recolorHSL('#ff0000', 0, 0, -1), '#000000');
    assert.equal(recolorHSL('#808080', 90), '#808080'); // grey has no hue to rotate
    assert.equal(recolorHSL('#808080', 0, 1), '#ff0101'); // saturating grey falls back to hue 0
  });
  it('preserves alpha and is an identity with zero deltas', () => {
    assert.equal(recolorHSL('#ff000080', 120), '#00ff0080');
    const r = rng(3);
    for (let i = 0; i < 500; i++) {
      const hex = rgbToHex(Math.floor(r() * 256), Math.floor(r() * 256), Math.floor(r() * 256));
      assert.equal(recolorHSL(hex, 0, 0, 0), hex);
      assert.equal(recolorHSL(hex), hex);
    }
  });
  it('rejects non-numeric deltas', () => {
    assert.throws(() => recolorHSL('#fff', 'a'), TypeError);
  });
});

// ---------------------------------------------------------------------------
// decodeSprite
// ---------------------------------------------------------------------------

describe('decodeSprite basics', () => {
  it('produces the right dimensions, pixels and transparency', () => {
    const s = decodeSprite(ARROW, PAL);
    assert.equal(s.w, 4);
    assert.equal(s.h, 3);
    assert.equal(s.ox, 0);
    assert.equal(s.oy, 0);
    assert.equal(s.pixels.length, 4 * 3 * 4);
    assert.deepEqual(at(s, 0, 0), rgba('#ff0000'));
    assert.deepEqual(at(s, 2, 1), rgba('#00ff00'));
    assert.deepEqual(at(s, 3, 2), rgba('#0000ff'));
    assert.deepEqual(at(s, 1, 0), CLEAR);
    assert.ok(isSprite(s));
    assert.equal(typeof s.key, 'string');
  });
  it('treats "." and " " as transparent unless the palette overrides them', () => {
    const s = decodeSprite(['. ', ' .'], {});
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) assert.deepEqual(at(s, x, y), CLEAR);
    const o = decodeSprite(['.r'], { '.': '#0000ff', r: '#ff0000' });
    assert.deepEqual(at(o, 0, 0), rgba('#0000ff'));
  });
  it('keeps semi-transparent alpha', () => {
    const s = decodeSprite(['h'], PAL);
    assert.deepEqual(at(s, 0, 0), [255, 255, 255, 128]);
    assert.equal(s.palette.h, '#ffffff80');
  });
  it('pads ragged rows with transparency', () => {
    const s = decodeSprite(['r', 'rr', ''], { r: '#f00' });
    assert.equal(s.w, 2);
    assert.equal(s.h, 3);
    assert.deepEqual(s.rows, ['r.', 'rr', '..']);
    assert.deepEqual(at(s, 1, 0), CLEAR);
    assert.deepEqual(at(s, 1, 1), rgba('#f00'));
  });
  it('accepts a de-indented multi-line string and CRLF', () => {
    const heart = decodeSprite(`
        .r.r.
        rrrrr
        .rrr.
        ..r..
    `, { r: '#f00' });
    assert.equal(heart.w, 5);
    assert.equal(heart.h, 4);
    assert.deepEqual(heart.rows, ['.r.r.', 'rrrrr', '.rrr.', '..r..']);
    const crlf = decodeSprite('r.\r\n.r', { r: '#f00' });
    assert.deepEqual(crlf.rows, ['r.', '.r']);
  });
  it('accepts a Map palette and normalises colours', () => {
    const s = decodeSprite(['r'], new Map([['r', '#F00']]));
    assert.deepEqual(at(s, 0, 0), rgba('#ff0000'));
    assert.deepEqual(s.palette, { r: '#ff0000' });
  });
  it('is frozen', () => {
    const s = decodeSprite(ARROW, PAL);
    assert.ok(Object.isFrozen(s));
    assert.ok(Object.isFrozen(s.rows));
    assert.ok(Object.isFrozen(s.palette));
    assert.throws(() => { s.rows.push('x'); }, TypeError);
    assert.throws(() => { s.palette.r = '#000'; }, TypeError);
    assert.throws(() => { s.w = 99; }, TypeError);
  });
  it('exposes canvas as a non-enumerable accessor that fails cleanly without a DOM', () => {
    const s = decodeSprite(ARROW, PAL);
    assert.ok('canvas' in s);
    assert.ok(!Object.keys(s).includes('canvas'));
    assert.throws(() => s.canvas, /no canvas implementation/);
  });
});

describe('decodeSprite errors', () => {
  it('names the offending character, row and column', () => {
    assert.throws(() => decodeSprite(['r.', '.z'], PAL), /unknown palette character "z" at row 1, column 1/);
  });
  it('rejects bad rows', () => {
    assert.throws(() => decodeSprite(null, PAL), TypeError);
    assert.throws(() => decodeSprite(42, PAL), TypeError);
    assert.throws(() => decodeSprite(['r', 7], PAL), TypeError);
    assert.throws(() => decodeSprite([], PAL), RangeError);
    assert.throws(() => decodeSprite(['', ''], PAL), RangeError);
    assert.throws(() => decodeSprite('', PAL), RangeError);
  });
  it('rejects bad palettes', () => {
    assert.throws(() => decodeSprite(['r'], 'red'), TypeError);
    assert.throws(() => decodeSprite(['r'], { rr: '#f00' }), TypeError);
    assert.throws(() => decodeSprite(['r'], { r: 'red' }), TypeError);
    assert.throws(() => decodeSprite(['r'], { r: 0xff0000 }), TypeError);
    assert.throws(() => decodeSprite(['r'], { '\n': '#f00' }), TypeError);
  });
  it('rejects bad options', () => {
    assert.throws(() => decodeSprite(ARROW, PAL, { scale: 0 }), RangeError);
    assert.throws(() => decodeSprite(ARROW, PAL, { scale: 1.5 }), RangeError);
    assert.throws(() => decodeSprite(ARROW, PAL, { scale: -2 }), RangeError);
    assert.throws(() => decodeSprite(ARROW, PAL, { scale: '2' }), RangeError);
    assert.throws(() => decodeSprite(ARROW, PAL, { outline: 'nope' }), TypeError);
    assert.throws(() => decodeSprite(ARROW, PAL, { tint: { color: '#fff', amount: 'x' } }), TypeError);
    assert.throws(() => decodeSprite(ARROW, PAL, { tint: { color: 'nope' } }), TypeError);
    assert.throws(() => decodeSprite(ARROW, PAL, { tint: 'nope' }), TypeError);
  });
});

describe('decodeSprite transforms', () => {
  it('flipX mirrors columns', () => {
    const s = decodeSprite(ARROW, PAL, { flipX: true });
    assert.deepEqual(s.rows, ['...r', '.grr', 'b..r']);
    assert.deepEqual(at(s, 3, 0), rgba('#ff0000'));
    assert.deepEqual(at(s, 0, 2), rgba('#0000ff'));
  });
  it('flipY mirrors rows', () => {
    const s = decodeSprite(ARROW, PAL, { flipY: true });
    assert.deepEqual(s.rows, ['r..b', 'rrg.', 'r...']);
  });
  it('both flips equal a 180 degree rotation', () => {
    const s = decodeSprite(ARROW, PAL, { flipX: true, flipY: true });
    assert.deepEqual(s.rows, ['b..r', '.grr', '...r']);
  });
  it('scale repeats pixels as blocks', () => {
    const s = decodeSprite(ARROW, PAL, { scale: 2 });
    assert.equal(s.w, 8);
    assert.equal(s.h, 6);
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) assert.deepEqual(at(s, x, y), rgba('#ff0000'));
    assert.deepEqual(at(s, 2, 0), CLEAR);
    assert.deepEqual(at(s, 4, 2), rgba('#00ff00'));
    assert.deepEqual(at(s, 5, 3), rgba('#00ff00'));
    assert.equal(s.rows[0], 'rr......');
  });
  it('outline grows by one pixel per side, 4-connected by default', () => {
    const s = decodeSprite(['r'], PAL, { outline: '#000' });
    assert.equal(s.w, 3);
    assert.equal(s.h, 3);
    assert.equal(s.ox, -1);
    assert.equal(s.oy, -1);
    assert.deepEqual(at(s, 1, 1), rgba('#ff0000'));
    for (const [x, y] of [[1, 0], [0, 1], [2, 1], [1, 2]]) assert.deepEqual(at(s, x, y), rgba('#000000'));
    for (const [x, y] of [[0, 0], [2, 0], [0, 2], [2, 2]]) assert.deepEqual(at(s, x, y), CLEAR);
  });
  it('outlineCorners fills the diagonals too', () => {
    const s = decodeSprite(['r'], PAL, { outline: '#000', outlineCorners: true });
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
      assert.deepEqual(at(s, x, y), x === 1 && y === 1 ? rgba('#ff0000') : rgba('#000000'));
    }
  });
  it('outline fills interior holes and ignores zero-alpha colours', () => {
    const ring = decodeSprite(['rrr', 'r.r', 'rrr'], PAL, { outline: '#0f0' });
    assert.deepEqual(at(ring, 2, 2), rgba('#00ff00'));
    const ghost = decodeSprite(['t'], { t: '#ff000000' }, { outline: '#0f0' });
    assert.deepEqual(at(ghost, 1, 0), CLEAR); // nothing solid to outline
  });
  it('tint blends toward the colour and preserves alpha', () => {
    const s = decodeSprite(['rh'], PAL, { tint: { color: '#ffffff', amount: 0.5 } });
    assert.deepEqual(at(s, 0, 0), rgba(lerpColor('#ff0000', '#ffffff', 0.5)));
    assert.deepEqual(at(s, 1, 0), [255, 255, 255, 128]);
    const full = decodeSprite(['r'], PAL, { tint: '#00ff00' });
    assert.deepEqual(at(full, 0, 0), rgba('#00ff00'));
    assert.equal(full, decodeSprite(['r'], PAL, { tint: { color: '#0f0', amount: 1 } }));
  });
  it('tint amount is clamped and zero tint is the untinted sprite', () => {
    const plain = decodeSprite(ARROW, PAL);
    assert.equal(decodeSprite(ARROW, PAL, { tint: { color: '#fff', amount: 0 } }), plain);
    assert.equal(
      decodeSprite(ARROW, PAL, { tint: { color: '#fff', amount: 7 } }),
      decodeSprite(ARROW, PAL, { tint: { color: '#fff', amount: 1 } }),
    );
    assert.equal(decodeSprite(ARROW, PAL, { tint: null }), plain);
  });
  it('composes flips, outline and scale in the documented order', () => {
    const s = decodeSprite(ARROW, PAL, { flipX: true, outline: '#000', scale: 3 });
    assert.equal(s.w, (4 + 2) * 3);
    assert.equal(s.h, (3 + 2) * 3);
    assert.equal(s.ox, -3);
    assert.equal(s.oy, -3);
    // flipped row 0 is '...r'; outlined it becomes '..@@r@', scaled x3 per cell
    assert.equal(s.rows[3], '......@@@@@@rrr@@@');
    assert.deepEqual(at(s, 5, 3), CLEAR);
    assert.deepEqual(at(s, 6, 3), rgba('#000000'));
    assert.deepEqual(at(s, 11, 3), rgba('#000000'));
    assert.deepEqual(at(s, 12, 3), rgba('#ff0000'));
    assert.deepEqual(at(s, 14, 3), rgba('#ff0000'));
    assert.deepEqual(at(s, 15, 3), rgba('#000000'));
    assert.deepEqual(at(s, 17, 3), rgba('#000000'));
    assert.deepEqual(at(s, 0, 0), CLEAR);
  });
  it('rows/palette round-trip: re-decoding reproduces the pixels', () => {
    const variants = [
      decodeSprite(ARROW, PAL),
      decodeSprite(ARROW, PAL, { flipX: true, flipY: true }),
      decodeSprite(ARROW, PAL, { scale: 2 }),
      decodeSprite(ARROW, PAL, { outline: '#123456', outlineCorners: true }),
      decodeSprite(ARROW, PAL, { tint: { color: '#00ffff', amount: 0.3 }, outline: '#000', scale: 2 }),
    ];
    for (const v of variants) {
      const again = decodeSprite(v.rows, v.palette);
      assert.deepEqual(again.pixels, v.pixels);
      assert.equal(again.w, v.w);
      assert.equal(again.h, v.h);
    }
  });
  it('derives variants from an existing Sprite, carrying ox/oy', () => {
    const base = decodeSprite(ARROW, PAL);
    assert.equal(decodeSprite(base, null, { flipX: true }), decodeSprite(ARROW, PAL, { flipX: true }));
    assert.equal(decodeSprite(base), base);
    const outlined = decodeSprite(ARROW, PAL, { outline: '#000' });
    const big = decodeSprite(outlined, null, { scale: 2 });
    assert.equal(big.ox, -2);
    assert.equal(big.w, 12);
    const twice = decodeSprite(outlined, null, { outline: '#fff' });
    assert.equal(twice.ox, -2);
    assert.equal(twice.w, 8);
    // a different palette acts as a swap
    const swapped = decodeSprite(base, { ...PAL, r: '#123456' });
    assert.deepEqual(at(swapped, 0, 0), rgba('#123456'));
  });
  it('is deterministic across cache clears', () => {
    const a = decodeSprite(ARROW, PAL, { outline: '#000', scale: 2, tint: '#808080' });
    clearSpriteCache();
    const b = decodeSprite(ARROW, PAL, { outline: '#000', scale: 2, tint: '#808080' });
    assert.notEqual(a, b);
    assert.deepEqual(a.pixels, b.pixels);
    assert.deepEqual(a.rows, b.rows);
    assert.equal(a.key, b.key);
  });
});

describe('decodeSprite cache', () => {
  it('returns the same object for the same art, palette and options', () => {
    const a = decodeSprite(ARROW, PAL);
    assert.equal(decodeSprite(ARROW, PAL), a);
    assert.equal(decodeSprite(ARROW.slice(), { ...PAL }), a, 'structurally equal inputs share the entry');
    assert.equal(decodeSprite(ARROW, PAL, {}), a);
    assert.notEqual(decodeSprite(ARROW, PAL, { flipX: true }), a);
    assert.notEqual(decodeSprite(ARROW, PAL, { scale: 2 }), a);
    assert.notEqual(decodeSprite(ARROW, { ...PAL, r: '#f01' }), a);
  });
  it('dedupes by content: a symmetric sprite flipped is itself', () => {
    const plus = decodeSprite(PLUS, PAL);
    assert.equal(decodeSprite(PLUS, PAL, { flipX: true }), plus);
    assert.equal(decodeSprite(PLUS, PAL, { flipY: true }), plus);
  });
  it('reports and clears its size', () => {
    clearSpriteCache();
    assert.equal(spriteCacheSize(), 0);
    const a = decodeSprite(ARROW, PAL);
    decodeSprite(ARROW, PAL, { flipX: true });
    assert.equal(spriteCacheSize(), 2);
    clearSpriteCache();
    assert.equal(spriteCacheSize(), 0);
    assert.notEqual(decodeSprite(ARROW, PAL), a);
    assert.deepEqual(decodeSprite(ARROW, PAL).pixels, a.pixels);
  });
});

// ---------------------------------------------------------------------------
// Derived sprites
// ---------------------------------------------------------------------------

describe('paletteSwap', () => {
  it('remaps by character and by colour, to colours or transparency', () => {
    const s = decodeSprite(ARROW, PAL);
    const byChar = paletteSwap(s, { r: '#123456' });
    assert.deepEqual(at(byChar, 0, 0), rgba('#123456'));
    assert.deepEqual(at(byChar, 2, 1), rgba('#00ff00'));
    const byColor = paletteSwap(s, { '#FF0000': '#123456' });
    assert.equal(byColor, byChar, 'same resulting palette shares the cache entry');
    assert.equal(paletteSwap(s, { '#f00': '#123456' }), byChar);
    const cleared = paletteSwap(s, { g: null });
    assert.deepEqual(at(cleared, 2, 1), CLEAR);
    const tinted = paletteSwap(s, new Map([['b', '#ffffff80']]));
    assert.deepEqual(at(tinted, 3, 2), [255, 255, 255, 128]);
  });
  it('can colour the default transparent character', () => {
    const s = paletteSwap(decodeSprite(ARROW, PAL), { '.': '#000' });
    assert.deepEqual(at(s, 1, 0), rgba('#000000'));
  });
  it('ignores colours that do not occur and leaves the source untouched', () => {
    const s = decodeSprite(ARROW, PAL);
    assert.equal(paletteSwap(s, { '#abcdef': '#000' }), s);
    paletteSwap(s, { r: '#000' });
    assert.deepEqual(at(s, 0, 0), rgba('#ff0000'));
    assert.equal(s.palette.r, '#ff0000');
  });
  it('preserves ox/oy and size', () => {
    const o = decodeSprite(ARROW, PAL, { outline: '#000' });
    const s = paletteSwap(o, { r: '#0ff' });
    assert.equal(s.ox, -1);
    assert.equal(s.w, 6);
  });
  it('rejects bad input', () => {
    const s = decodeSprite(ARROW, PAL);
    assert.throws(() => paletteSwap({}, { r: '#000' }), TypeError);
    assert.throws(() => paletteSwap(s, null), TypeError);
    assert.throws(() => paletteSwap(s, { zz: '#000' }), TypeError);
    assert.throws(() => paletteSwap(s, { r: 'blue' }), TypeError);
  });
});

describe('silhouette', () => {
  it('flattens every opaque pixel to one colour, keeping alpha', () => {
    const s = silhouette(decodeSprite(['rgh', '.b.'], PAL), '#102030');
    for (const [x, y] of [[0, 0], [1, 0], [1, 1]]) assert.deepEqual(at(s, x, y), rgba('#102030'));
    assert.deepEqual(at(s, 2, 0), [16, 32, 48, 128]);
    assert.deepEqual(at(s, 0, 1), CLEAR);
  });
  it('multiplies by the colour alpha', () => {
    const s = silhouette(decodeSprite(['rh'], PAL), '#00000080');
    assert.deepEqual(at(s, 0, 0), [0, 0, 0, 128]);
    assert.deepEqual(at(s, 1, 0), [0, 0, 0, 64]);
  });
  it('preserves geometry and is cached', () => {
    const o = decodeSprite(ARROW, PAL, { outline: '#000', scale: 2 });
    const a = silhouette(o, '#fff');
    assert.equal(a.ox, -2);
    assert.equal(a.w, o.w);
    assert.equal(silhouette(o, '#ffffff'), a);
    assert.throws(() => silhouette(null, '#fff'), TypeError);
    assert.throws(() => silhouette(o, 'white'), TypeError);
  });
});

describe('outlineSprite', () => {
  it('matches the decode-time outline option', () => {
    const viaOpt = decodeSprite(ARROW, PAL, { outline: '#000' });
    const viaFn = outlineSprite(decodeSprite(ARROW, PAL), '#000');
    assert.deepEqual(viaFn.pixels, viaOpt.pixels);
    assert.equal(viaFn.ox, -1);
    assert.equal(viaFn.oy, -1);
    assert.equal(viaFn, viaOpt, 'identical content and origin share the cache entry');
    const corners = outlineSprite(decodeSprite(['r'], PAL), '#000', { corners: true });
    assert.deepEqual(corners.pixels, decodeSprite(['r'], PAL, { outline: '#000', outlineCorners: true }).pixels);
  });
  it('stacks', () => {
    const twice = outlineSprite(outlineSprite(decodeSprite(['r'], PAL), '#000'), '#0f0');
    assert.equal(twice.w, 5);
    assert.equal(twice.ox, -2);
    assert.deepEqual(at(twice, 2, 0), rgba('#00ff00'));
    assert.deepEqual(at(twice, 2, 1), rgba('#000000'));
    assert.deepEqual(at(twice, 2, 2), rgba('#ff0000'));
  });
  it('rejects bad input', () => {
    assert.throws(() => outlineSprite({}, '#000'), TypeError);
    assert.throws(() => outlineSprite(decodeSprite(['r'], PAL), 'black'), TypeError);
  });
});

describe('opaqueBounds', () => {
  it('trims to the visible pixels', () => {
    assert.deepEqual(opaqueBounds(decodeSprite(ARROW, PAL)), { x: 0, y: 0, w: 4, h: 3 });
    assert.deepEqual(opaqueBounds(decodeSprite(['....', '.rg.', '....'], PAL)), { x: 1, y: 1, w: 2, h: 1 });
    assert.equal(opaqueBounds(decodeSprite(['..', '..'], PAL)), null);
    assert.equal(opaqueBounds(decodeSprite(['t'], { t: '#ff000000' })), null);
    assert.throws(() => opaqueBounds({}), TypeError);
  });
});

describe('isSprite', () => {
  it('only accepts module-made sprites', () => {
    const s = decodeSprite(ARROW, PAL);
    assert.ok(isSprite(s));
    assert.ok(!isSprite({ ...s }));
    assert.ok(!isSprite(null));
    assert.ok(!isSprite(undefined));
    assert.ok(!isSprite('sprite'));
  });
});

// ---------------------------------------------------------------------------
// buildAtlas (pure part)
// ---------------------------------------------------------------------------

describe('buildAtlas', () => {
  const A = () => decodeSprite(ARROW, PAL);
  const B = () => decodeSprite(['bb', 'bb', 'bb', 'bb', 'bb'], PAL);
  const C = () => decodeSprite(['ggggggg'], PAL);

  function overlaps(f, g) {
    return f.x < g.x + g.w && g.x < f.x + f.w && f.y < g.y + g.h && g.y < f.y + f.h;
  }

  it('packs every sprite inside the sheet without overlaps, in input order', () => {
    const sprites = [A(), B(), C(), decodeSprite(ARROW, PAL, { outline: '#000' })];
    const atlas = buildAtlas(sprites);
    assert.equal(atlas.frames.length, 4);
    for (let i = 0; i < sprites.length; i++) {
      const f = atlas.frames[i];
      const s = sprites[i];
      assert.equal(f.w, s.w);
      assert.equal(f.h, s.h);
      assert.equal(f.ox, s.ox);
      assert.equal(f.oy, s.oy);
      assert.ok(f.x >= 1 && f.y >= 1 && f.x + f.w <= atlas.w - 1 && f.y + f.h <= atlas.h - 1, `frame ${i} within padded bounds`);
      for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
        assert.deepEqual(at(atlas, f.x + x, f.y + y), at(s, x, y), `pixel ${x},${y} of frame ${i}`);
      }
      for (let j = i + 1; j < sprites.length; j++) {
        assert.ok(!overlaps(f, atlas.frames[j]), `frames ${i} and ${j} overlap`);
      }
    }
    assert.equal(atlas.pixels.length, atlas.w * atlas.h * 4);
    assert.deepEqual(atlas.sprites, sprites);
    assert.ok(Object.isFrozen(atlas));
    assert.ok(Object.isFrozen(atlas.frames));
  });
  it('keeps a transparent gutter between frames', () => {
    const atlas = buildAtlas([A(), A(), B()], { padding: 2 });
    // every pixel not covered by a frame is clear
    for (let y = 0; y < atlas.h; y++) for (let x = 0; x < atlas.w; x++) {
      const inside = atlas.frames.some((f) => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h);
      if (!inside) assert.deepEqual(at(atlas, x, y), CLEAR);
    }
    for (const f of atlas.frames) assert.ok(f.x >= 2 && f.y >= 2);
  });
  it('shares a rectangle for repeated sprite references', () => {
    const a = A();
    const atlas = buildAtlas([a, B(), a]);
    assert.deepEqual(atlas.frames[0], atlas.frames[2]);
    assert.notDeepEqual(atlas.frames[0], atlas.frames[1]);
  });
  it('lays out a known case deterministically with maxWidth', () => {
    const tiles = [0, 1, 2, 3].map((i) => decodeSprite(['rr', 'rr'], { r: rgbToHex(i * 10, 0, 0) }));
    const atlas = buildAtlas(tiles, { padding: 1, maxWidth: 7 });
    assert.equal(atlas.w, 7);
    assert.equal(atlas.h, 7);
    assert.deepEqual(atlas.frames.map((f) => [f.x, f.y]), [[1, 1], [4, 1], [1, 4], [4, 4]]);
    const again = buildAtlas(tiles, { padding: 1, maxWidth: 7 });
    assert.deepEqual(again.frames, atlas.frames);
    assert.deepEqual(again.pixels, atlas.pixels);
  });
  it('never shrinks below the widest sprite', () => {
    const atlas = buildAtlas([C()], { maxWidth: 2 });
    assert.equal(atlas.w, 9);
    assert.equal(atlas.frames[0].x, 1);
  });
  it('rejects bad input', () => {
    assert.throws(() => buildAtlas([]), TypeError);
    assert.throws(() => buildAtlas('nope'), TypeError);
    assert.throws(() => buildAtlas([A(), {}]), TypeError);
    assert.throws(() => buildAtlas([A()], { padding: -1 }), RangeError);
    assert.throws(() => buildAtlas([A()], { padding: 0.5 }), RangeError);
    assert.throws(() => buildAtlas([A()], { maxWidth: 0 }), RangeError);
  });
  it('has a lazy canvas that fails cleanly without a DOM', () => {
    const atlas = buildAtlas([A()]);
    assert.ok(!Object.keys(atlas).includes('canvas'));
    assert.throws(() => atlas.canvas, /no canvas implementation/);
  });
});

// ---------------------------------------------------------------------------
// Canvas-backed behaviour through a fake canvas factory
// ---------------------------------------------------------------------------

describe('with a fake canvas factory', () => {
  afterEach(() => setCanvasFactory(null));

  it('validates the factory argument', () => {
    assert.throws(() => setCanvasFactory('x'), TypeError);
    setCanvasFactory(undefined); // same as null
  });

  it('builds the sprite canvas once from the pixel data', () => {
    const created = [];
    setCanvasFactory(fakeCanvasFactory(created));
    const s = decodeSprite(ARROW, PAL);
    const c = s.canvas;
    assert.equal(c, s.canvas, 'cached');
    assert.equal(created.length, 1);
    assert.equal(c.width, 4);
    assert.equal(c.height, 3);
    assert.deepEqual(c.image.data, s.pixels);
    assert.deepEqual(c.getContext().calls, [['putImageData', 0, 0]]);
  });

  it('drops built canvases when the factory changes and errors again when removed', () => {
    const first = [];
    setCanvasFactory(fakeCanvasFactory(first));
    const s = decodeSprite(ARROW, PAL);
    const c1 = s.canvas;
    const second = [];
    setCanvasFactory(fakeCanvasFactory(second));
    assert.notEqual(s.canvas, c1);
    assert.equal(second.length, 1);
    setCanvasFactory(null);
    assert.throws(() => s.canvas, /no canvas implementation/);
  });

  it('drawSprite draws at the snapped, offset position and forces nearest sampling', () => {
    setCanvasFactory(fakeCanvasFactory());
    const s = decodeSprite(ARROW, PAL);
    const ctx = fakeContext({});
    drawSprite(ctx, s, 10.4, 20.6);
    assert.equal(ctx.imageSmoothingEnabled, false);
    assert.deepEqual(ctx.calls, [['drawImage', s.canvas, 0, 0, 4, 3, 10, 21, 4, 3, { alpha: 1 }]]);

    const o = decodeSprite(ARROW, PAL, { outline: '#000' });
    ctx.calls.length = 0;
    drawSprite(ctx, o, 10, 20);
    assert.deepEqual(ctx.calls, [['drawImage', o.canvas, 0, 0, 6, 5, 9, 19, 6, 5, { alpha: 1 }]]);

    ctx.calls.length = 0;
    drawSprite(ctx, o, 10, 20, { scale: 2, snap: false });
    assert.deepEqual(ctx.calls, [['drawImage', o.canvas, 0, 0, 6, 5, 8, 18, 12, 10, { alpha: 1 }]]);

    ctx.calls.length = 0;
    drawSprite(ctx, s, 0.5, 0.5, { snap: false, scale: 1.5 });
    assert.deepEqual(ctx.calls, [['drawImage', s.canvas, 0, 0, 4, 3, 0.5, 0.5, 6, 4.5, { alpha: 1 }]]);
  });

  it('drawSprite flips in place with a transform', () => {
    setCanvasFactory(fakeCanvasFactory());
    const s = decodeSprite(ARROW, PAL);
    const ctx = fakeContext({});
    drawSprite(ctx, s, 10, 20, { flipX: true });
    assert.deepEqual(ctx.calls, [
      ['save'], ['translate', 14, 20], ['scale', -1, 1],
      ['drawImage', s.canvas, 0, 0, 4, 3, 0, 0, 4, 3, { alpha: 1 }], ['restore'],
    ]);
    ctx.calls.length = 0;
    drawSprite(ctx, s, 10, 20, { flipY: true, scale: 2 });
    assert.deepEqual(ctx.calls, [
      ['save'], ['translate', 10, 26], ['scale', 1, -1],
      ['drawImage', s.canvas, 0, 0, 4, 3, 0, 0, 8, 6, { alpha: 1 }], ['restore'],
    ]);
  });

  it('drawSprite applies and restores alpha, skipping invisible draws', () => {
    setCanvasFactory(fakeCanvasFactory());
    const s = decodeSprite(ARROW, PAL);
    const ctx = fakeContext({});
    ctx.globalAlpha = 0.5;
    drawSprite(ctx, s, 0, 0, { alpha: 0.5 });
    assert.equal(ctx.calls[0][10].alpha, 0.25);
    assert.equal(ctx.globalAlpha, 0.5);
    ctx.calls.length = 0;
    drawSprite(ctx, s, 0, 0, { alpha: 3 });
    assert.equal(ctx.calls[0][10].alpha, 0.5, 'alpha is clamped to 1');
    ctx.calls.length = 0;
    drawSprite(ctx, s, 0, 0, { alpha: 0 });
    drawSprite(ctx, s, 0, 0, { alpha: -1 });
    drawSprite(ctx, s, 0, 0, { scale: 0 });
    drawSprite(ctx, s, 0, 0, { alpha: NaN });
    assert.deepEqual(ctx.calls, []);
  });

  it('drawSprite validates its arguments', () => {
    setCanvasFactory(fakeCanvasFactory());
    const s = decodeSprite(ARROW, PAL);
    assert.throws(() => drawSprite({}, s, 0, 0), TypeError);
    assert.throws(() => drawSprite(fakeContext({}), {}, 0, 0), TypeError);
  });

  it('makePattern creates a cached repeat pattern on a scratch or given context', () => {
    const created = [];
    setCanvasFactory(fakeCanvasFactory(created));
    const tile = ['rg', 'gr'];
    const pat = makePattern(tile, PAL);
    const sprite = decodeSprite(tile, PAL);
    assert.equal(pat.rep, 'repeat');
    assert.equal(pat.src, sprite.canvas);
    assert.equal(makePattern(tile, PAL), pat, 'cached per sprite');
    assert.equal(makePattern(sprite), pat, 'accepts a sprite directly');
    assert.equal(created.length, 2, 'one tile canvas plus one scratch canvas');

    const ctx = fakeContext({});
    const other = decodeSprite(['bb'], PAL);
    const p2 = makePattern(other, ctx);
    assert.deepEqual(ctx.calls, [['createPattern', 'repeat']]);
    assert.equal(p2.src, other.canvas);
    const p3 = makePattern(['kk'], PAL, ctx);
    assert.equal(ctx.calls.length, 2);
    assert.notEqual(p3, p2);
    assert.throws(() => makePattern(['zz'], PAL), /unknown palette character/);
  });

  it('builds the atlas canvas lazily and draws frames from it', () => {
    setCanvasFactory(fakeCanvasFactory());
    const a = decodeSprite(ARROW, PAL);
    const o = decodeSprite(ARROW, PAL, { outline: '#000' });
    const atlas = buildAtlas([a, o]);
    const c = atlas.canvas;
    assert.equal(c, atlas.canvas);
    assert.equal(c.width, atlas.w);
    assert.equal(c.height, atlas.h);
    assert.deepEqual(c.image.data, atlas.pixels);

    const ctx = fakeContext({});
    const f = atlas.frames[1];
    drawAtlasFrame(ctx, atlas, 1, 30, 40);
    assert.deepEqual(ctx.calls, [['drawImage', c, f.x, f.y, 6, 5, 29, 39, 6, 5, { alpha: 1 }]]);
    ctx.calls.length = 0;
    drawAtlasFrame(ctx, atlas, 0, 30, 40, { flipX: true, alpha: 0.5 });
    const g = atlas.frames[0];
    assert.deepEqual(ctx.calls, [
      ['save'], ['translate', 34, 40], ['scale', -1, 1],
      ['drawImage', c, g.x, g.y, 4, 3, 0, 0, 4, 3, { alpha: 0.5 }], ['restore'],
    ]);
    ctx.calls.length = 0;
    drawAtlasFrame(ctx, atlas, 0, 0, 0, { alpha: 0 });
    assert.deepEqual(ctx.calls, []);
    assert.throws(() => drawAtlasFrame(ctx, atlas, 2, 0, 0), RangeError);
    assert.throws(() => drawAtlasFrame(ctx, atlas, -1, 0, 0), RangeError);
    assert.throws(() => drawAtlasFrame(ctx, {}, 0, 0, 0), TypeError);
    assert.throws(() => drawAtlasFrame({}, atlas, 0, 0, 0), TypeError);
  });

  it('clearSpriteCache also forgets canvases and patterns', () => {
    const created = [];
    setCanvasFactory(fakeCanvasFactory(created));
    const s = decodeSprite(ARROW, PAL);
    const c1 = s.canvas;
    const p1 = makePattern(s);
    clearSpriteCache();
    assert.notEqual(s.canvas, c1);
    assert.notEqual(makePattern(s), p1);
  });
});

describe('module hygiene', () => {
  it('imports without touching browser globals', () => {
    assert.equal(typeof globalThis.window, 'undefined');
    assert.equal(typeof globalThis.document, 'undefined');
  });
  it('exports exactly the contract surface plus documented extras', () => {
    const expected = [
      'decodeSprite', 'drawSprite', 'paletteSwap', 'silhouette', 'outlineSprite', 'makePattern',
      'recolorHSL', 'lerpColor', 'hexToRgb', 'rgbToHex', 'buildAtlas',
      'drawAtlasFrame', 'rgbToHsl', 'hslToRgb', 'normalizeHex', 'isSprite', 'opaqueBounds',
      'setCanvasFactory', 'clearSpriteCache', 'spriteCacheSize', 'MAX_PIXELS',
    ].sort();
    assert.deepEqual(Object.keys(px).sort(), expected);
  });
});
