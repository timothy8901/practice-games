// Adversarial / contract tests for js/core/font.js: malformed inputs, boundaries,
// determinism, large inputs, unicode, rapid repeated calls and drawing before any
// canvas exists. Complements test/font.test.mjs.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as font from '../js/core/font.js';

const {
  FONTS, FONT_NAMES, getFont, getGlyph, hasGlyph, glyphRows, normalizeText,
  measureText, wrapText, layoutText, rasterizeText, drawText, drawTextTyped,
  clearGlyphCache, glyphCacheSize,
} = font;

/** Width of a line as the layout engine sees it (unscaled, main font unless given). */
const w = (s, opts) => measureText(s, opts).w;

describe('contract surface', () => {
  test('exports exactly the contract API (plus helpers) as functions', () => {
    for (const name of ['measureText', 'wrapText', 'drawText', 'drawTextTyped']) {
      assert.equal(typeof font[name], 'function', `${name} missing`);
    }
    assert.equal(measureText.length, 2);
    assert.equal(wrapText.length, 3);
    assert.equal(drawText.length, 5);
    assert.equal(drawTextTyped.length, 6);
  });

  test('importing the module touched no browser globals (pure at import time)', () => {
    assert.equal(typeof globalThis.document, 'undefined');
    assert.equal(typeof globalThis.window, 'undefined');
    assert.equal(typeof globalThis.OffscreenCanvas, 'undefined');
    assert.equal(glyphCacheSize('main'), 0);
    assert.equal(glyphCacheSize('small'), 0);
  });

  test('main is 5x7 with 2px descent, small is 3x5 with 1px descent; both carry every contract symbol', () => {
    assert.equal(FONTS.main.cellW, 5);
    assert.equal(FONTS.main.cellH, 7);
    assert.equal(FONTS.small.cellW, 3);
    assert.equal(FONTS.small.cellH, 5);
    for (const ch of [...'◉✦♥★☾☀▲▼◀▶↑↓←→…']) {
      for (const f of FONT_NAMES) assert.ok(hasGlyph(ch, f), `${f} lacks ${ch}`);
    }
    for (const ch of [...'éèêáàüöñ']) assert.ok(hasGlyph(ch, 'main'), `main lacks ${ch}`);
    for (let c = 32; c <= 126; c++) {
      const g = getGlyph(String.fromCharCode(c), 'main');
      assert.ok(g.w >= 1 && g.w <= 5, `main '${String.fromCharCode(c)}' width ${g.w}`);
      assert.ok(g.h >= 7 && g.h <= 9);
    }
    for (const ch of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      const g = getGlyph(ch, 'small');
      assert.ok(g.w >= 1 && g.w <= 3, `small '${ch}' width ${g.w}`);
      assert.ok(g.h >= 5 && g.h <= 6);
    }
  });

  test('no two distinct letters or digits share identical art within a font', () => {
    for (const name of FONT_NAMES) {
      const seen = new Map();
      for (const ch of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz') {
        if (name === 'small' && ch >= 'a') continue; // lowercase maps to uppercase in small
        const key = getGlyph(ch, name).rows.join('/');
        assert.ok(!seen.has(key), `${name}: '${ch}' and '${seen.get(key)}' are identical`);
        seen.set(key, ch);
      }
    }
  });

  test('font data is immutable', () => {
    assert.ok(Object.isFrozen(FONTS));
    assert.ok(Object.isFrozen(FONTS.main));
    assert.ok(Object.isFrozen(FONTS.small));
    const g = getGlyph('A');
    assert.ok(Object.isFrozen(g));
    assert.ok(Object.isFrozen(g.rows));
    assert.ok(Object.isFrozen(g.bits));
    assert.throws(() => { 'use strict'; FONTS.main.gap = 2; }, TypeError);
    assert.throws(() => { 'use strict'; g.rows[0] = 'xxxxx'; }, TypeError);
    assert.equal(FONTS.main.gap, 1);
  });
});

describe('malformed inputs', () => {
  test('font names that are Object.prototype keys are rejected, not resolved', () => {
    for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf', '']) {
      assert.throws(() => getFont(name), RangeError, `getFont('${name}')`);
      assert.throws(() => measureText('A', { font: name }), RangeError, `measureText font '${name}'`);
      assert.throws(() => wrapText('A', 10, { font: name }), RangeError);
      assert.throws(() => clearGlyphCache(name), RangeError);
    }
    for (const bad of [null, 0, 1, true, {}, [], () => {}, Symbol('x'), { glyphs: {} }]) {
      assert.throws(() => getFont(bad), RangeError);
    }
  });

  test('getGlyph / hasGlyph never throw for non-string or multi-char input', () => {
    for (const f of FONT_NAMES) {
      const def = getFont(f);
      for (const bad of [null, undefined, '', 'ab', 'constructor', '__proto__', {}, [], true, NaN, Infinity]) {
        const g = getGlyph(bad, f);
        assert.ok(g && typeof g.w === 'number', `${f} getGlyph(${String(bad)})`);
        assert.equal(hasGlyph(bad, f), false, `${f} hasGlyph(${String(bad)})`);
        assert.equal(g, def.fallback);
      }
      // numbers coerce to their digit glyph
      assert.equal(getGlyph(7, f), getGlyph('7', f));
      assert.equal(hasGlyph(7, f), true);
    }
    assert.equal(getGlyph('ß', 'small'), FONTS.small.fallback);
    assert.equal(getGlyph('ﬁ', 'small'), FONTS.small.fallback);
  });

  test('text coercion: numbers, booleans, objects, arrays, symbols-in-strings', () => {
    assert.equal(normalizeText(0), '0');
    assert.equal(normalizeText(false), 'false');
    assert.equal(normalizeText(['a', 'b']), 'a,b');
    assert.equal(normalizeText({ toString() { return 'obj'; } }), 'obj');
    assert.equal(measureText(12.5).w, w('12.5'));
    assert.deepEqual(wrapText(42, 100), ['42']);
    assert.equal(measureText(NaN).w, w('NaN'));
  });

  test('option validation covers every numeric option and rejects the right types', () => {
    const ctx = { drawImage() {}, globalAlpha: 1 };
    for (const scale of [0, -1, NaN, Infinity, -Infinity, '2', null]) {
      assert.throws(() => measureText('A', { scale }), RangeError, `scale ${scale}`);
    }
    for (const letterSpacing of [-2, NaN, Infinity, '1']) {
      assert.throws(() => measureText('A', { letterSpacing }), RangeError, `letterSpacing ${letterSpacing}`);
    }
    assert.throws(() => measureText('A', { lineSpacing: Infinity }), RangeError);
    assert.throws(() => measureText('A', { align: 'centre' }), RangeError);
    assert.throws(() => measureText('A', { align: null }), RangeError);
    assert.throws(() => drawText(ctx, 'A', 0, 0, { alpha: -0.1 }), RangeError);
    assert.throws(() => drawText(ctx, 'A', 0, 0, { alpha: NaN }), RangeError);
    assert.throws(() => drawText(ctx, 'A', 0, 0, { color: null }), TypeError);
    assert.throws(() => drawText(ctx, 'A', 0, 0, { color: {} }), TypeError);
    assert.throws(() => drawText(ctx, 'A', 0, 0, { outline: 1.5 }), RangeError);
    assert.throws(() => drawText(ctx, 'A', 0, 0, { outline: { width: -1 } }), RangeError);
    assert.throws(() => drawText(ctx, 'A', 0, 0, { outline: { color: 5 } }), TypeError);
    assert.throws(() => drawText(ctx, 'A', 0, 0, { shadow: { dx: NaN } }), RangeError);
    assert.throws(() => drawText(ctx, 'A', 0, 0, { shadow: { dy: Infinity } }), RangeError);
    assert.throws(() => drawText(ctx, 'A', 0, 0, { shadow: { color: 1 } }), TypeError);
  });

  test('falsy effect options mean "off"; truthy shorthands are accepted', () => {
    const ctx = { drawImage() {}, globalAlpha: 1 };
    // Nothing is drawn for '' so no canvas is needed; validation still runs.
    for (const v of [false, 0, '', null, undefined, NaN]) {
      assert.deepEqual(drawText(ctx, '', 0, 0, { shadow: v, outline: v }), measureText(''));
    }
    assert.doesNotThrow(() => drawText(ctx, '', 0, 0, { shadow: 2, outline: 2 }));
    assert.doesNotThrow(() => drawText(ctx, '', 0, 0, { shadow: '#f00', outline: '#0f0' }));
  });

  test('null / undefined option bags behave as defaults everywhere', () => {
    const ctx = { drawImage() {}, globalAlpha: 1 };
    assert.deepEqual(measureText('A', null), measureText('A'));
    assert.deepEqual(measureText('A', undefined), measureText('A'));
    assert.deepEqual(wrapText('a b', 100, null), ['a b']);
    assert.deepEqual(layoutText('A', null).w, 5);
    assert.deepEqual(rasterizeText('A', null).w, 5);
    assert.deepEqual(drawText(ctx, '', 0, 0, null), measureText(''));
    assert.deepEqual(drawTextTyped(ctx, 'abc', 0, 0, 0, null).total, 3);
  });

  test('drawText before any canvas exists: validation errors first, then a clear environment error', () => {
    assert.equal(typeof globalThis.OffscreenCanvas, 'undefined');
    assert.throws(() => drawText(undefined, 'x', 0, 0), TypeError);
    assert.throws(() => drawText({ drawImage: 'nope' }, 'x', 0, 0), TypeError);
    const ctx = { drawImage() {}, globalAlpha: 1 };
    assert.throws(() => drawText(ctx, 'x', 0, 0), /canvas-capable/);
    assert.throws(() => drawTextTyped(ctx, 'x', 0, 0, 1), /canvas-capable/);
    // typed with 0 visible never needs a canvas
    assert.equal(drawTextTyped(ctx, 'xyz', 0, 0, 0).done, false);
    // the failed attempt left no half-built atlas behind
    assert.equal(glyphCacheSize('main'), 0);
  });
});

describe('unicode', () => {
  test('decomposed accents compose to their bitmap glyph (NFC)', () => {
    assert.equal(normalizeText('e\u0301'), 'é');
    assert.equal(w('e\u0301'), w('é'));
    assert.equal(w('n\u0303'), w('ñ'));
    assert.equal(rasterizeText('u\u0308').rows.join(), rasterizeText('ü').rows.join());
    assert.equal(hasGlyph(normalizeText('a\u0301')), true);
  });

  test('variation selectors, zero-width characters, soft hyphens and BOM are invisible', () => {
    assert.equal(w('♥\ufe0f'), w('♥'));
    assert.equal(w('★\ufe0e'), w('★'));
    assert.equal(w('a\u200bb'), w('ab'));
    assert.equal(w('a\u200d\u200c\u200e\u200fb'), w('ab'));
    assert.equal(w('\ufeffa'), w('a'));
    assert.equal(w('co\u00adop'), w('coop'));
    assert.equal(w('a\u2060b'), w('ab'));
    assert.equal(w('x\u0301'), w('x'), 'a combining mark with no precomposed form is dropped, not boxed');
  });

  test('every Unicode line terminator becomes a newline; other controls vanish', () => {
    assert.deepEqual(wrapText('a\u2028b\u2029c\u0085d', 100), ['a', 'b', 'c', 'd']);
    assert.deepEqual(wrapText('a\r\nb\rc\nd', 100), ['a', 'b', 'c', 'd']);
    assert.equal(normalizeText('a\u0000\u0001\u001f\u007f\u0080\u009fb'), 'ab');
    assert.equal(normalizeText('\f\v'), '');
    assert.equal(normalizeText('a\tb'), 'a  b');
  });

  test('non-breaking and thin spaces draw as a space but never break a line', () => {
    assert.equal(w('a\u00a0b'), w('a b'));
    assert.equal(w('a\u2009b'), w('a b'));
    assert.deepEqual(wrapText('AA\u00a0AA BB', 27), ['AA\u00a0AA', 'BB'], 'breaks at the space, keeps the nbsp');
    assert.deepEqual(wrapText('AA AA', 26), ['AA', 'AA']);
    assert.deepEqual(wrapText('AA\u00a0AA', 26), ['AA\u00a0A', 'A'], 'nbsp is content: the word is broken by character, not at the nbsp');
  });

  test('astral code points, lone surrogates, RTL and CJK fall back to one box each and never throw', () => {
    const box = FONTS.main.fallback;
    for (const s of ['😀', '\ud83d', '\ude00', '中文', 'שלום', 'العربية', '𝔘𝔫𝔦', '\u{1F600}\u{1F601}']) {
      const n = Array.from(s).length;
      const m = measureText(s);
      assert.equal(m.w, n * box.w + (n - 1) * 1, `width of ${s}`);
      assert.equal(m.lines, 1);
      assert.deepEqual(wrapText(s, 1000), [s]);
      assert.equal(layoutText(s).glyphCount, n);
      assert.equal(rasterizeText(s).w, m.w);
    }
    assert.equal(hasGlyph('😀'), false);
    assert.equal(glyphRows('😀').join('/'), box.rows.join('/'));
  });

  test('typographic quotes, dashes and uppercase accents alias in both fonts', () => {
    for (const f of FONT_NAMES) {
      assert.equal(getGlyph('“', f), getGlyph('"', f));
      assert.equal(getGlyph('—', f), getGlyph('-', f));
      assert.equal(getGlyph('É', f), getGlyph('E', f));
      assert.equal(getGlyph('Ñ', f), getGlyph('N', f));
      assert.equal(getGlyph('❤', f), getGlyph('♥', f));
      assert.equal(getGlyph('►', f), getGlyph('▶', f));
    }
    assert.equal(getGlyph('ë', 'small'), getGlyph('E', 'small'));
    assert.equal(getGlyph('ç', 'small'), getGlyph('C', 'small'));
  });
});

describe('boundaries', () => {
  test('measureText of whitespace-only and newline-only text', () => {
    assert.equal(measureText(' ').w, 3);
    assert.equal(measureText('   ').w, 3 * 3 + 2);
    assert.deepEqual([measureText('\n').lines, measureText('\n').h], [2, 19]);
    assert.deepEqual([measureText('\n\n\n').lines, measureText('\n\n\n').w], [4, 0]);
    assert.equal(measureText(' ', { font: 'small' }).w, 2);
  });

  test('wrap at exact fit, one pixel under, and widths of 1 and tiny fractions', () => {
    const AA = w('AA'); // 11
    assert.deepEqual(wrapText('AA AA', AA * 2 + 1 + 3 + 1), ['AA AA']);
    assert.deepEqual(wrapText('AA AA', AA * 2 + 1 + 3), ['AA', 'AA']);
    assert.deepEqual(wrapText('AA', AA), ['AA']);
    assert.deepEqual(wrapText('AA', AA - 1), ['A', 'A']);
    assert.deepEqual(wrapText('ab cd', 1), ['a', 'b', 'c', 'd']);
    assert.deepEqual(wrapText('ab cd', 0.001), ['a', 'b', 'c', 'd']);
    assert.deepEqual(wrapText('ab cd', Number.MIN_VALUE), ['a', 'b', 'c', 'd']);
    assert.deepEqual(wrapText('ab cd', Number.MAX_VALUE), ['ab cd']);
    assert.deepEqual(wrapText('ab cd', -0), ['ab cd']);
  });

  test('wrapping never emits a whitespace-only line from a soft break and never loses ink', () => {
    const samples = [
      ' hello', '  hello world', 'hello   world', 'hello ', 'a' + ' '.repeat(50) + 'b',
      '   ', ' ', '', 'x\n   \ny', ' \n ', '\u00a0\u00a0\u00a0',
    ];
    for (const s of samples) {
      for (const maxW of [1, 3, 4, 10, 17, 24, 40, 1000]) {
        const lines = wrapText(s, maxW);
        assert.ok(lines.length >= 1, `'${s}' @${maxW} returned no lines`);
        assert.equal(lines.join('').replace(/ /g, ''), s.replace(/[ \n]/g, ''), `ink lost for '${s}' @${maxW}`);
        const paragraphs = s.split('\n').length;
        // Only plain spaces are blank: nbsp is content and may legitimately occupy a line of its own.
        const blank = lines.filter((l) => l.replace(/ /g, '') === '').length;
        assert.ok(blank <= paragraphs, `'${s}' @${maxW} produced ${blank} blank lines: ${JSON.stringify(lines)}`);
        for (const l of lines) {
          const n = Array.from(l).length;
          assert.ok(w(l) <= maxW || n <= 1, `'${l}' (${w(l)}px) exceeds ${maxW}`);
        }
      }
    }
  });

  test('negative letterSpacing down to -gap makes glyphs touch; wrapping respects it', () => {
    assert.equal(w('AAA', { letterSpacing: -1 }), 15);
    assert.deepEqual(wrapText('AAA AAA', 15 + 0 + 3 + 0 + 15, { letterSpacing: -1 }), ['AAA AAA']);
    assert.deepEqual(wrapText('AAA AAA', 15 + 3 + 15 - 1, { letterSpacing: -1 }), ['AAA', 'AAA']);
    const r = rasterizeText('II', { letterSpacing: -1 });
    assert.equal(r.w, 6);
    assert.equal(r.rows[0], '######');
  });

  test('negative lineSpacing overlaps lines but never makes h negative for one line', () => {
    const m = measureText('A\nA', { lineSpacing: -5 });
    assert.equal(m.lineHeight, 5);
    assert.equal(m.h, 5 + 9);
    assert.equal(measureText('A', { lineSpacing: -100 }).h, 9);
  });

  test('fractional scale is allowed for measuring and drawing but not rasterising', () => {
    const m = measureText('AB', { scale: 1.5 });
    assert.equal(m.w, 11 * 1.5);
    assert.equal(m.h, 13.5);
    assert.throws(() => rasterizeText('AB', { scale: 1.5 }), RangeError);
    assert.throws(() => rasterizeText('AB', { scale: 0.5 }), RangeError);
    assert.equal(rasterizeText('AB', { scale: 3 }).w, 33);
  });

  test('drawTextTyped clamps every odd visibleChars value', () => {
    const ctx = { drawImage() {}, globalAlpha: 1 };
    const total = layoutText('ab cd').glyphCount;
    assert.equal(total, 5);
    // Values that clamp to 0 need no canvas (nothing is drawn); non-zero coercions are
    // covered in the mocked-canvas block below.
    for (const v of [undefined, null, 'x', -Infinity, -0, 0.999, -5, NaN, '', false, {}]) {
      const r = drawTextTyped(ctx, 'ab cd', 0, 0, v);
      assert.equal(r.shown, 0, `visibleChars ${String(v)}`);
      assert.equal(r.done, false);
      assert.equal(r.total, total);
    }
    assert.equal(drawTextTyped(ctx, '', 0, 0, 1e9).done, true);
    assert.equal(drawTextTyped(ctx, '\n\n', 0, 0, 1).done, true, 'newlines are not countable glyphs');
    assert.equal(drawTextTyped(ctx, '\n\n', 0, 0, 0).total, 0);
  });
});

describe('determinism and purity', () => {
  test('measure / wrap / layout / rasterize are referentially transparent across many calls', () => {
    const txt = 'Porchlight ✦ meets Wildshift — "shift" at 12:30 é ñ ü … ◉♥★\nsecond line';
    const opts = { scale: 2, letterSpacing: 1, lineSpacing: 2, maxWidth: 120, align: 'center' };
    const m0 = measureText(txt, opts);
    const w0 = wrapText(txt, 120, opts);
    const r0 = rasterizeText(txt, opts);
    const l0 = JSON.stringify(layoutText(txt, opts), (k, v) => (k === 'font' ? v.name : v));
    for (let i = 0; i < 200; i++) {
      assert.deepEqual(measureText(txt, opts), m0);
      assert.deepEqual(wrapText(txt, 120, opts), w0);
      assert.deepEqual(rasterizeText(txt, opts), r0);
      assert.equal(JSON.stringify(layoutText(txt, opts), (k, v) => (k === 'font' ? v.name : v)), l0);
    }
  });

  test('callers cannot corrupt shared state through returned values', () => {
    const lines = wrapText('a b', 100);
    lines.push('zzz');
    assert.deepEqual(wrapText('a b', 100), ['a b']);
    const rows = glyphRows('A');
    rows.length = 0;
    assert.equal(glyphRows('A').length, 7);
    const m = measureText('A');
    m.w = 999;
    assert.equal(measureText('A').w, 5);
    const l = layoutText('A');
    l.lines.length = 0;
    assert.equal(layoutText('A').lines.length, 1);
  });

  test('option objects are not mutated', () => {
    const opts = Object.freeze({ scale: 2, maxWidth: 40, align: 'right', letterSpacing: 1 });
    assert.doesNotThrow(() => measureText('hello world', opts));
    assert.doesNotThrow(() => wrapText('hello world', 40, opts));
    assert.doesNotThrow(() => rasterizeText('hello world', opts));
    assert.deepEqual(opts, { scale: 2, maxWidth: 40, align: 'right', letterSpacing: 1 });
  });

  test('wrap + measure agree with rasterize for random strings and widths', () => {
    // Small deterministic LCG so the test is reproducible without rng.js.
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const alphabet = [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?-\'"◉✦♥★éñü…  \u00a0'];
    for (let i = 0; i < 300; i++) {
      const len = 1 + Math.floor(rnd() * 60);
      let s = '';
      for (let j = 0; j < len; j++) s += rnd() < 0.08 ? '\n' : alphabet[Math.floor(rnd() * alphabet.length)];
      const maxW = 1 + Math.floor(rnd() * 80);
      const f = rnd() < 0.5 ? 'main' : 'small';
      const scale = 1 + Math.floor(rnd() * 3);
      const o = { font: f, scale, maxWidth: maxW * scale };
      const lines = wrapText(s, maxW * scale, o);
      const m = measureText(s, o);
      const r = rasterizeText(s, o);
      assert.equal(m.lines, lines.length, `line count for ${JSON.stringify(s)} @${maxW}`);
      assert.equal(r.w, m.w);
      assert.equal(r.h, m.h);
      assert.equal(m.w, Math.max(...lines.map((l) => measureText(l, { font: f, scale }).w)));
      for (const l of lines) {
        const n = Array.from(l).length;
        assert.ok(measureText(l, { font: f, scale }).w <= maxW * scale || n <= 1, `'${l}' too wide @${maxW}x${scale} ${f}`);
      }
      const ink = (t) => t.replace(/[ \n]/g, '');
      assert.equal(ink(lines.join('')), ink(normalizeText(s)), `ink lost in ${JSON.stringify(s)}`);
    }
  });
});

describe('large inputs', () => {
  test('wrapping and measuring 20k words is linear-time (no quadratic line re-measuring)', () => {
    const big = Array.from({ length: 20000 }, (_, i) => `word${i % 13}`).join(' ');
    let t0 = performance.now();
    const narrow = wrapText(big, 200);
    const tNarrow = performance.now() - t0;
    t0 = performance.now();
    const wide = wrapText(big, 1e7);
    const tWide = performance.now() - t0;
    assert.ok(narrow.length > 1000);
    assert.equal(wide.length, 1);
    assert.ok(tNarrow < 1500, `narrow wrap took ${tNarrow.toFixed(0)}ms`);
    assert.ok(tWide < 1500, `wide wrap took ${tWide.toFixed(0)}ms (quadratic?)`);
    t0 = performance.now();
    const m = measureText(big, { maxWidth: 464 });
    assert.ok(performance.now() - t0 < 1500);
    assert.equal(m.lines, wrapText(big, 464).length);
  });

  test('a single 50k-character word breaks by character without blowing up', () => {
    const word = 'W'.repeat(50000);
    const lines = wrapText(word, 29); // 5 W's = 29px
    assert.equal(lines.length, 10000);
    assert.ok(lines.every((l) => l === 'WWWWW'));
    assert.equal(wrapText(word, 1e9).length, 1);
    const m = measureText(word);
    assert.equal(m.w, 50000 * 5 + 49999);
  });

  test('thousands of newlines', () => {
    const txt = 'x\n'.repeat(5000);
    const m = measureText(txt);
    assert.equal(m.lines, 5001);
    assert.equal(m.h, 5000 * 10 + 9);
    assert.equal(wrapText(txt, 10).length, 5001);
    assert.equal(layoutText(txt).glyphCount, 5000);
  });

  test('rasterizing a long line stays consistent with measure', () => {
    const txt = 'The quick brown fox ◉ jumps over the lazy dog é '.repeat(40);
    const r = rasterizeText(txt);
    const m = measureText(txt);
    assert.equal(r.w, m.w);
    assert.equal(r.rows.length, 9);
    assert.ok(r.rows.every((row) => row.length === r.w));
  });
});

/** Minimal OffscreenCanvas stand-in recording fillRect calls per atlas. */
class FakeOffscreenCanvas {
  static created = [];
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.fills = [];
    FakeOffscreenCanvas.created.push(this);
  }
  getContext() {
    const self = this;
    return { fillStyle: '', fillRect(x, y, w, h) { self.fills.push([x, y, w, h, this.fillStyle]); } };
  }
}
class NullContextCanvas {
  constructor(w, h) { this.width = w; this.height = h; }
  getContext() { return null; }
}
function fakeCtx() {
  return { globalAlpha: 1, imageSmoothingEnabled: true, calls: [], drawImage(...a) { this.calls.push(a); } };
}

describe('drawing with a mocked canvas (rapid repeated calls, caching, effects)', () => {
  before(() => { globalThis.OffscreenCanvas = FakeOffscreenCanvas; clearGlyphCache(); });
  after(() => { delete globalThis.OffscreenCanvas; clearGlyphCache(); });

  test('10k draws of varied text reuse one atlas per font+colour and leave no garbage', () => {
    clearGlyphCache();
    FakeOffscreenCanvas.created.length = 0;
    const ctx = fakeCtx();
    const texts = ['HP 12/30', 'Lv.7 ★', 'tide: low ☾', 'é ñ ü', '…', ''];
    for (let i = 0; i < 10000; i++) {
      const f = i % 2 ? 'small' : 'main';
      drawText(ctx, texts[i % texts.length], i % 480, i % 270, { font: f, color: '#fff', scale: 1 + (i % 3) });
    }
    assert.equal(FakeOffscreenCanvas.created.length, 2);
    assert.equal(glyphCacheSize('main'), 1);
    assert.equal(glyphCacheSize('small'), 1);
    assert.equal(ctx.globalAlpha, 1);
    assert.equal(ctx.imageSmoothingEnabled, false);
  });

  test('atlas pixels equal the glyph bitmaps for every glyph (inked runs merged into rects)', () => {
    clearGlyphCache();
    FakeOffscreenCanvas.created.length = 0;
    drawText(fakeCtx(), 'A', 0, 0, { color: '#abcdef' });
    const atlas = FakeOffscreenCanvas.created[0];
    assert.equal(atlas.height, 9);
    // Rebuild a bitmap from the recorded fills and compare against rasterizing each glyph.
    const grid = Array.from({ length: atlas.height }, () => new Array(atlas.width).fill('.'));
    for (const [x, y, fw, fh, color] of atlas.fills) {
      assert.equal(color, '#abcdef');
      assert.equal(fh, 1);
      for (let i = 0; i < fw; i++) grid[y][x + i] = '#';
    }
    const total = grid.flat().filter((c) => c === '#').length;
    let expected = 0;
    const seen = new Set();
    for (const g of [...FONTS.main.glyphs.values(), FONTS.main.fallback]) {
      if (seen.has(g)) continue;
      seen.add(g);
      expected += g.rows.join('').split('#').length - 1;
    }
    assert.equal(total, expected, 'every inked pixel of every glyph is in the atlas exactly once');
  });

  test('a canvas whose 2D context is unavailable produces a clear error, not a TypeError', () => {
    clearGlyphCache();
    globalThis.OffscreenCanvas = NullContextCanvas;
    try {
      assert.throws(() => drawText(fakeCtx(), 'A', 0, 0, { color: '#123' }), /2D context/);
      assert.equal(glyphCacheSize('main'), 0);
    } finally {
      globalThis.OffscreenCanvas = FakeOffscreenCanvas;
    }
  });

  test('globalAlpha is restored even when drawImage throws', () => {
    const ctx = fakeCtx();
    ctx.globalAlpha = 0.7;
    ctx.drawImage = () => { throw new Error('boom'); };
    assert.throws(() => drawText(ctx, 'A', 0, 0, { alpha: 0.5 }), /boom/);
    assert.equal(ctx.globalAlpha, 0.7);
  });

  test('numeric shorthands: shadow: n offsets by n, outline: n is the width', () => {
    const ctx = fakeCtx();
    drawText(ctx, 'A', 10, 10, { shadow: 3 });
    assert.equal(ctx.calls.length, 2);
    assert.deepEqual([ctx.calls[0][5], ctx.calls[0][6]], [13, 13]);
    const o = fakeCtx();
    drawText(o, 'A', 0, 0, { outline: 2 });
    assert.equal(o.calls.length, 24 + 1);
  });

  test('shadow is painted before outline, outline before fill, for every glyph of multi-line text', () => {
    clearGlyphCache();
    const ctx = fakeCtx();
    drawText(ctx, 'ab\ncd', 0, 0, { color: '#fff', shadow: '#111', outline: '#222' });
    const colourOf = (c) => c[0].fills[0][4];
    const seq = ctx.calls.map(colourOf);
    const firstOutline = seq.indexOf('#222');
    const firstFill = seq.indexOf('#fff');
    assert.ok(seq.lastIndexOf('#111') < firstOutline, 'all shadow passes precede the outline');
    assert.ok(seq.lastIndexOf('#222') < firstFill, 'all outline passes precede the fill');
    // 4 glyphs: shadow 9 offsets each, outline 8, fill 1
    assert.equal(seq.filter((c) => c === '#111').length, 36);
    assert.equal(seq.filter((c) => c === '#222').length, 32);
    assert.equal(seq.filter((c) => c === '#fff').length, 4);
  });

  test('right/center alignment at odd widths stays pixel-aligned at integer scales', () => {
    for (const scale of [1, 2, 3]) {
      for (const align of ['left', 'center', 'right']) {
        const ctx = fakeCtx();
        drawText(ctx, 'iii\nWWWW', 100, 50, { align, scale });
        for (const c of ctx.calls) {
          assert.ok(Number.isInteger(c[5]) && Number.isInteger(c[6]), `non-integer dest ${c[5]},${c[6]}`);
          assert.equal(c[7], c[3] * scale);
          assert.equal(c[8], c[4] * scale);
        }
      }
    }
  });

  test('non-finite positions do not throw and do not poison the cache or alpha', () => {
    const ctx = fakeCtx();
    ctx.globalAlpha = 0.3;
    assert.doesNotThrow(() => drawText(ctx, 'A', NaN, Infinity, { alpha: 0.5 }));
    assert.equal(ctx.globalAlpha, 0.3);
    assert.doesNotThrow(() => drawText(ctx, 'A', -1e9, 1e9));
  });

  test('drawTextTyped is a strict prefix of drawText for every count, with effects and wrapping', () => {
    const text = 'Tide’s low at 12:30 — fetch the ◉ coins!';
    const opts = { maxWidth: 80, shadow: true, outline: '#333', scale: 2, align: 'center' };
    const full = fakeCtx();
    drawText(full, text, 120, 40, opts);
    const total = layoutText(text, opts).glyphCount;
    for (let n = 0; n <= total; n++) {
      const part = fakeCtx();
      const r = drawTextTyped(part, text, 120, 40, n, opts);
      assert.equal(r.shown, n);
      assert.equal(r.done, n === total);
      // Every (colour, atlas x, dest x, dest y) the prefix draws is also drawn by the full text,
      // at the same place: revealing more characters never moves what is already shown.
      const key = (c) => `${c[0].fills[0][4]}|${c[1]}|${c[5]}|${c[6]}`;
      const fullSet = new Set(full.calls.map(key));
      for (const c of part.calls) assert.ok(fullSet.has(key(c)), `prefix ${n} drew something the full text did not`);
      assert.ok(part.calls.length <= full.calls.length);
      if (n === total) assert.deepEqual(part.calls, full.calls);
    }
  });

  test('drawTextTyped coerces and clamps non-zero visibleChars', () => {
    for (const [v, shown] of [['3', 3], [4.999, 4], [1e9, 5], [true, 1], [Infinity, 5], ['2.5', 2]]) {
      const r = drawTextTyped(fakeCtx(), 'ab cd', 0, 0, v);
      assert.equal(r.shown, shown, `visibleChars ${String(v)}`);
      assert.equal(r.done, shown === 5);
    }
  });

  test('clearGlyphCache during a frame forces one rebuild and nothing else', () => {
    clearGlyphCache();
    const ctx = fakeCtx();
    drawText(ctx, 'A', 0, 0, { color: '#010203' });
    FakeOffscreenCanvas.created.length = 0;
    clearGlyphCache('main');
    drawText(ctx, 'B', 0, 0, { color: '#010203' });
    drawText(ctx, 'C', 0, 0, { color: '#010203' });
    assert.equal(FakeOffscreenCanvas.created.length, 1);
    assert.deepEqual(ctx.calls.slice(1).map((c) => c[0]), [FakeOffscreenCanvas.created[0], FakeOffscreenCanvas.created[0]]);
  });

  test('cache limit is per font and per colour string; 1000 unique colours keep only the last 32', () => {
    clearGlyphCache();
    const ctx = fakeCtx();
    for (let i = 0; i < 1000; i++) drawText(ctx, 'x', 0, 0, { color: `hsl(${i},50%,50%)` });
    assert.equal(glyphCacheSize('main'), 32);
    assert.equal(glyphCacheSize('small'), 0);
  });
});
