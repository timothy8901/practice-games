// Unit tests for js/core/font.js (pure parts + a mocked canvas environment).
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  FONTS, FONT_NAMES, getFont, getGlyph, hasGlyph, glyphRows, normalizeText,
  measureText, wrapText, layoutText, rasterizeText, drawText, drawTextTyped,
  clearGlyphCache, glyphCacheSize,
} from '../js/core/font.js';

const SYMBOLS = [...'◉✦♥★☾☀▲▼◀▶↑↓←→…'];
const ACCENTS = [...'éèêáàüöñ'];

describe('font data', () => {
  test('exports both fonts with sane metrics', () => {
    assert.deepEqual(FONT_NAMES, ['main', 'small']);
    assert.equal(FONTS.main.cellH, 7);
    assert.equal(FONTS.main.descent, 2);
    assert.equal(FONTS.main.lineHeight, 10);
    assert.equal(FONTS.small.cellH, 5);
    assert.equal(FONTS.small.lineHeight, 7);
    assert.ok(Object.isFrozen(FONTS));
  });

  test('main font has a dedicated glyph for every printable ASCII char, symbol and accent', () => {
    for (let c = 32; c <= 126; c++) {
      const ch = String.fromCharCode(c);
      assert.ok(hasGlyph(ch, 'main'), `missing main glyph for '${ch}' (${c})`);
    }
    for (const ch of [...SYMBOLS, ...ACCENTS]) assert.ok(hasGlyph(ch, 'main'), `missing main glyph ${ch}`);
  });

  test('small font covers digits, A-Z, symbols and common punctuation', () => {
    for (const ch of '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ.,:;-+/%!?()\'"=<>*#$_[]|^ ') {
      assert.ok(hasGlyph(ch, 'small'), `missing small glyph '${ch}'`);
    }
    for (const ch of SYMBOLS) assert.ok(hasGlyph(ch, 'small'), `missing small symbol ${ch}`);
  });

  test('every glyph is well-formed: consistent row widths, within cell bounds, bits match rows', () => {
    for (const font of Object.values(FONTS)) {
      const all = [...font.glyphs.values(), font.fallback];
      for (const g of all) {
        // cellW is nominal; the ellipsis needs 5 columns in both fonts.
        assert.ok(g.w >= 1 && g.w <= Math.max(font.cellW, 5), `${font.name}: width ${g.w} out of range`);
        assert.ok(g.h >= font.cellH && g.h <= font.cellH + font.descent, `${font.name}: height ${g.h} out of range`);
        assert.equal(g.rows.length, g.h);
        assert.equal(g.bits.length, g.h);
        for (let r = 0; r < g.h; r++) {
          assert.equal(g.rows[r].length, g.w, `${font.name}: ragged row ${JSON.stringify(g.rows)}`);
          const fromRow = [...g.rows[r]].reduce((b, ch) => (b << 1) | (ch === '#' ? 1 : 0), 0);
          assert.equal(g.bits[r], fromRow);
        }
        assert.equal(g.ink, g.bits.some((b) => b !== 0));
      }
    }
  });

  test('digits are tabular (same width) in both fonts', () => {
    for (const name of FONT_NAMES) {
      const widths = new Set([...'0123456789'].map((d) => getGlyph(d, name).w));
      assert.equal(widths.size, 1, `${name} digits not uniform`);
    }
  });

  test('descenders only on g j p q y , ; in main', () => {
    const withDesc = [...FONTS.main.glyphs].filter(([, g]) => g.h > 7).map(([ch]) => ch).sort();
    assert.deepEqual(withDesc, [',', ';', 'g', 'j', 'p', 'q', 'y']);
  });
});

describe('getFont / getGlyph / hasGlyph / glyphRows', () => {
  test('getFont resolves names, passes definitions through, rejects unknown', () => {
    assert.equal(getFont(), FONTS.main);
    assert.equal(getFont('small'), FONTS.small);
    assert.equal(getFont(FONTS.small), FONTS.small);
    assert.throws(() => getFont('huge'), RangeError);
    assert.throws(() => getFont(null), RangeError);
  });

  test('aliases map typographic variants and uppercase accents', () => {
    assert.equal(getGlyph('’'), getGlyph("'"));
    assert.equal(getGlyph('“'), getGlyph('"'));
    assert.equal(getGlyph('—'), getGlyph('-'));
    assert.equal(getGlyph(' '), getGlyph(' '));
    assert.equal(getGlyph('É'), getGlyph('E'));
    assert.equal(getGlyph('ë'), getGlyph('é'));
    assert.equal(getGlyph('❤'), getGlyph('♥'));
  });

  test('small font falls back to uppercase for lowercase and base letters for accents', () => {
    assert.equal(getGlyph('a', 'small'), getGlyph('A', 'small'));
    assert.equal(getGlyph('é', 'small'), getGlyph('E', 'small'));
    assert.equal(getGlyph('ñ', 'small'), getGlyph('N', 'small'));
    assert.ok(hasGlyph('q', 'small'));
  });

  test('unknown characters resolve to the fallback box and hasGlyph reports false', () => {
    assert.equal(getGlyph('中'), FONTS.main.fallback);
    assert.equal(getGlyph('ß', 'small'), FONTS.small.fallback); // toUpperCase gives 'SS'
    assert.equal(hasGlyph('中'), false);
    assert.equal(hasGlyph('中', 'small'), false);
  });

  test('glyphRows returns a copy of the glyph art', () => {
    const rows = glyphRows('I');
    assert.deepEqual(rows, ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###']);
    rows[0] = 'xxx';
    assert.equal(glyphRows('I')[0], '###');
    assert.deepEqual(glyphRows('1', 'small'), ['.#.', '##.', '.#.', '.#.', '###']);
  });
});

describe('normalizeText', () => {
  test('coerces and cleans input', () => {
    assert.equal(normalizeText(null), '');
    assert.equal(normalizeText(undefined), '');
    assert.equal(normalizeText(42), '42');
    assert.equal(normalizeText('a\r\nb\rc'), 'a\nb\nc');
    assert.equal(normalizeText('a\tb'), 'a  b');
    assert.equal(normalizeText('a\u0007b\u007f'), 'ab');
    assert.equal(normalizeText('keep\nnewline'), 'keep\nnewline');
  });
});

describe('measureText', () => {
  test('single glyphs and empty text', () => {
    assert.deepEqual(measureText('A'), { w: 5, h: 9, lines: 1, lineHeight: 10, ascent: 7, descent: 2 });
    assert.deepEqual(measureText(''), { w: 0, h: 9, lines: 1, lineHeight: 10, ascent: 7, descent: 2 });
    assert.deepEqual(measureText('1', { font: 'small' }), { w: 3, h: 6, lines: 1, lineHeight: 7, ascent: 5, descent: 1 });
    assert.equal(measureText(null).w, 0);
  });

  test('proportional widths add intrinsic 1px gaps', () => {
    assert.equal(measureText('ii').w, 3); // 1 + 1 + 1
    assert.equal(measureText('AA').w, 11); // 5 + 1 + 5
    assert.equal(measureText('A A').w, 15); // 5+1+3+1+5
    assert.equal(measureText('12:30', { font: 'small' }).w, 3 + 1 + 3 + 1 + 1 + 1 + 3 + 1 + 3);
  });

  test('scale, letterSpacing and lineSpacing', () => {
    assert.deepEqual(measureText('AA', { scale: 2 }), { w: 22, h: 18, lines: 1, lineHeight: 20, ascent: 14, descent: 4 });
    assert.equal(measureText('AA', { letterSpacing: 2 }).w, 13);
    assert.equal(measureText('AA', { letterSpacing: -1 }).w, 10);
    assert.equal(measureText('A\nA').h, 19);
    assert.equal(measureText('A\nA', { lineSpacing: 3 }).h, 22);
    assert.equal(measureText('A\nA', { lineSpacing: 3 }).lineHeight, 13);
    assert.equal(measureText('A\nAAA').w, 17);
    assert.equal(measureText('A\n\nA').lines, 3);
  });

  test('maxWidth wraps before measuring', () => {
    const m = measureText('AAA AAA', { maxWidth: 20 });
    assert.equal(m.lines, 2);
    assert.equal(m.w, 17);
  });

  test('is deterministic and side-effect free', () => {
    const a = measureText('Hello ◉ world é', { scale: 3, letterSpacing: 1 });
    for (let i = 0; i < 5; i++) assert.deepEqual(measureText('Hello ◉ world é', { scale: 3, letterSpacing: 1 }), a);
  });

  test('rejects invalid options', () => {
    assert.throws(() => measureText('A', { scale: 0 }), RangeError);
    assert.throws(() => measureText('A', { scale: NaN }), RangeError);
    assert.throws(() => measureText('A', { scale: -1 }), RangeError);
    assert.throws(() => measureText('A', { letterSpacing: -2 }), RangeError);
    assert.throws(() => measureText('A', { letterSpacing: Infinity }), RangeError);
    assert.throws(() => measureText('A', { lineSpacing: NaN }), RangeError);
    assert.throws(() => measureText('A', { align: 'middle' }), RangeError);
    assert.throws(() => measureText('A', { font: 'nope' }), RangeError);
  });
});

describe('wrapText', () => {
  const TEXT = 'The quick brown fox jumps over the lazy dog';

  test('wraps on word boundaries and every line fits', () => {
    const lines = wrapText(TEXT, 60);
    assert.deepEqual(lines, ['The quick', 'brown fox', 'jumps over', 'the lazy dog']);
    for (const l of lines) assert.ok(measureText(l).w <= 60, `'${l}' too wide`);
    assert.equal(lines.join(' '), TEXT);
  });

  test('honours explicit newlines and keeps blank lines', () => {
    assert.deepEqual(wrapText('a\n\nb', 100), ['a', '', 'b']);
    assert.deepEqual(wrapText('a\r\nb', 100), ['a', 'b']);
    assert.deepEqual(wrapText('', 100), ['']);
    assert.deepEqual(wrapText(null, 100), ['']);
  });

  test('breaks words wider than the line by character', () => {
    const lines = wrapText('AAAAAAAAAA', 17); // three A's = 17px
    assert.deepEqual(lines, ['AAA', 'AAA', 'AAA', 'A']);
    const mixed = wrapText('go AAAAAAA!', 17);
    assert.equal(mixed[0], 'go');
    for (const l of mixed.slice(1, -1)) assert.ok(measureText(l).w <= 17);
    assert.equal(mixed.join(''), 'goAAAAAAA!');
  });

  test('a glyph wider than the line still gets its own line', () => {
    assert.deepEqual(wrapText('WWW', 2), ['W', 'W', 'W']);
  });

  test('non-positive or non-finite maxWidth only splits on newlines', () => {
    assert.deepEqual(wrapText('a b\nc', 0), ['a b', 'c']);
    assert.deepEqual(wrapText('a b', -5), ['a b']);
    assert.deepEqual(wrapText('a b', NaN), ['a b']);
    assert.deepEqual(wrapText('a b', Infinity), ['a b']);
    assert.deepEqual(wrapText('a b', undefined), ['a b']);
  });

  test('maxWidth is in scaled pixels; letterSpacing is respected', () => {
    assert.deepEqual(wrapText(TEXT, 120, { scale: 2 }), wrapText(TEXT, 60));
    assert.deepEqual(wrapText('AA AA', 11), ['AA', 'AA']);
    assert.deepEqual(wrapText('AA AA', 27), ['AA AA']); // 11 + 1 + 3 + 1 + 11
    assert.deepEqual(wrapText('AA AA', 26), ['AA', 'AA']);
    assert.deepEqual(wrapText('AA AA', 27, { letterSpacing: 1 }), ['AA', 'AA']);
    assert.deepEqual(wrapText('AA AA', 31, { letterSpacing: 1 }), ['AA AA']);
    assert.deepEqual(wrapText('AB CD', 30, { font: 'small' }), ['AB CD']);
  });

  test('preserves inner spacing that fits, trims trailing spaces on wrapped lines', () => {
    assert.deepEqual(wrapText('a  b', 100), ['a  b']);
    assert.deepEqual(wrapText('  indented', 100), ['  indented']);
    assert.deepEqual(wrapText('AA  AA', 11), ['AA', 'AA']);
    assert.deepEqual(wrapText('AA   ', 11), ['AA']);
    assert.deepEqual(wrapText('AA AA\n', 11), ['AA', 'AA', '']);
  });

  test('every line of long generated text fits for many widths', () => {
    const words = ['♥', 'fjord', 'ñandú', 'Heartmark', 'x', '12:30', 'é', '—', 'supercalifragilistic', '…'];
    const txt = Array.from({ length: 60 }, (_, i) => words[(i * 7) % words.length]).join(' ');
    for (const maxW of [9, 15, 24, 37, 61, 100, 213]) {
      const lines = wrapText(txt, maxW);
      for (const l of lines) {
        const w = measureText(l).w;
        const single = l.length === 1 || [...l].length === 1;
        assert.ok(w <= maxW || single, `width ${w} > ${maxW} for '${l}'`);
      }
      assert.equal(lines.join('').replace(/ /g, ''), txt.replace(/ /g, ''), 'no characters lost');
    }
  });
});

describe('layoutText', () => {
  test('positions glyphs and counts drawable characters', () => {
    const l = layoutText('Ai\nB');
    assert.equal(l.lines.length, 2);
    assert.equal(l.glyphCount, 3);
    assert.deepEqual(l.lines[0].glyphs.map((g) => g.x), [0, 6]);
    assert.equal(l.lines[0].w, 7);
    assert.equal(l.lines[1].y, 10);
    assert.equal(l.w, 7);
    assert.equal(l.h, 19);
    assert.equal(l.align, 'left');
  });

  test('align offsets each line by its own width', () => {
    const c = layoutText('AAA\nA', { align: 'center' });
    assert.deepEqual(c.lines.map((x) => x.x), [-8.5, -2.5]);
    const r = layoutText('AAA\nA', { align: 'right' });
    assert.deepEqual(r.lines.map((x) => x.x), [-17, -5]);
  });

  test('scale and letterSpacing are carried without changing unscaled geometry', () => {
    const l = layoutText('AB', { scale: 3, letterSpacing: 2 });
    assert.equal(l.scale, 3);
    assert.deepEqual(l.lines[0].glyphs.map((g) => g.x), [0, 8]);
  });
});

describe('rasterizeText', () => {
  test('a single glyph rasterises to its rows padded to the descent box', () => {
    const r = rasterizeText('A');
    assert.equal(r.w, 5);
    assert.equal(r.h, 9);
    assert.deepEqual(r.rows, [...glyphRows('A'), '.....', '.....']);
  });

  test('empty text yields an empty-width box', () => {
    const r = rasterizeText('');
    assert.equal(r.w, 0);
    assert.equal(r.h, 9);
    assert.deepEqual(r.rows, Array(9).fill(''));
  });

  test('integer scale repeats pixels; fractional scale is rejected', () => {
    const r1 = rasterizeText('i');
    const r2 = rasterizeText('i', { scale: 2 });
    assert.equal(r2.w, 2);
    assert.equal(r2.h, 18);
    assert.deepEqual(r2.rows, r1.rows.flatMap((row) => [row.repeat(2).replace(/[#.]/g, (c) => c + c), row.replace(/[#.]/g, (c) => c + c)]).map((row) => row.slice(0, 2)));
    assert.throws(() => rasterizeText('i', { scale: 1.5 }), RangeError);
  });

  test('alignment places narrow lines inside the widest line box', () => {
    const left = rasterizeText('i\nAAA');
    const right = rasterizeText('i\nAAA', { align: 'right' });
    const center = rasterizeText('i\nAAA', { align: 'center' });
    assert.equal(left.rows[0], '#' + '.'.repeat(16));
    assert.equal(right.rows[0], '.'.repeat(16) + '#');
    assert.equal(center.rows[0], '.'.repeat(8) + '#' + '.'.repeat(8));
    assert.equal(left.rows[10], right.rows[10]);
  });

  test('descenders hang below the cap cell and next line starts at lineHeight', () => {
    const r = rasterizeText('g\ng');
    assert.equal(r.h, 19);
    assert.equal(r.rows[7], '...#');
    assert.equal(r.rows[8], '.##.');
    assert.equal(r.rows[9], '....');
    assert.equal(r.rows[10 + 7], '...#');
  });

  test('matches measureText exactly', () => {
    for (const t of ['', 'A', 'Hello, World!', 'multi\nline ✦', '12:30', 'ñ é ü']) {
      for (const font of FONT_NAMES) {
        const m = measureText(t, { font, scale: 2 });
        const r = rasterizeText(t, { font, scale: 2 });
        assert.equal(r.w, m.w, `${font} '${t}' w`);
        assert.equal(r.h, m.h, `${font} '${t}' h`);
      }
    }
  });
});

describe('drawText / drawTextTyped without a canvas environment', () => {
  test('rejects a missing or non-2D context', () => {
    assert.throws(() => drawText(null, 'x', 0, 0), TypeError);
    assert.throws(() => drawText({}, 'x', 0, 0), TypeError);
  });

  test('reports a clear error when no canvas can be created', () => {
    const ctx = { drawImage() {}, globalAlpha: 1 };
    assert.throws(() => drawText(ctx, 'x', 0, 0), /canvas-capable/);
  });

  test('drawing nothing needs no canvas at all', () => {
    const ctx = { drawImage() {}, globalAlpha: 1 };
    assert.deepEqual(drawText(ctx, '', 0, 0), measureText(''));
    assert.equal(drawTextTyped(ctx, 'abc', 0, 0, 0).shown, 0);
  });
});

/** A minimal OffscreenCanvas stand-in that records fillRect calls. */
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
    return {
      fillStyle: '',
      fillRect(x, y, w, h) { self.fills.push([x, y, w, h, this.fillStyle]); },
    };
  }
}

/** A minimal 2D target context that records drawImage calls. */
function fakeCtx() {
  return {
    globalAlpha: 1,
    imageSmoothingEnabled: true,
    calls: [],
    drawImage(...args) { this.calls.push(args); },
  };
}

describe('drawText with a mocked canvas environment', () => {
  before(() => { globalThis.OffscreenCanvas = FakeOffscreenCanvas; clearGlyphCache(); });
  after(() => { delete globalThis.OffscreenCanvas; clearGlyphCache(); });

  test('builds the atlas lazily, once per font+colour, and tints it', () => {
    clearGlyphCache();
    FakeOffscreenCanvas.created.length = 0;
    assert.equal(glyphCacheSize('main'), 0);
    const ctx = fakeCtx();
    drawText(ctx, 'Hi', 0, 0, { color: '#ff0000' });
    assert.equal(glyphCacheSize('main'), 1);
    assert.equal(FakeOffscreenCanvas.created.length, 1);
    const atlas = FakeOffscreenCanvas.created[0];
    assert.equal(atlas.height, 9);
    assert.ok(atlas.fills.length > 100);
    assert.ok(atlas.fills.every((f) => f[4] === '#ff0000'));
    drawText(ctx, 'again', 0, 0, { color: '#ff0000' });
    assert.equal(FakeOffscreenCanvas.created.length, 1, 'atlas reused');
    drawText(ctx, 'x', 0, 0, { color: '#00ff00', font: 'small' });
    assert.equal(glyphCacheSize('small'), 1);
    assert.equal(glyphCacheSize('main'), 1);
    assert.equal(FakeOffscreenCanvas.created.length, 2);
    clearGlyphCache('small');
    assert.equal(glyphCacheSize('small'), 0);
    assert.equal(glyphCacheSize('main'), 1);
  });

  test('one drawImage per inked glyph at the laid-out position, smoothing off', () => {
    const ctx = fakeCtx();
    const m = drawText(ctx, 'A i', 10.4, 20.6);
    assert.deepEqual(m, measureText('A i'));
    assert.equal(ctx.imageSmoothingEnabled, false);
    assert.equal(ctx.calls.length, 2, 'space is not drawn');
    const [a, i] = ctx.calls;
    assert.equal(a[5], 10); // dx rounded
    assert.equal(a[6], 21); // dy rounded
    assert.equal(a[7], 5); // dw
    assert.equal(a[8], 7); // dh (no descender)
    assert.equal(i[5], 10 + 5 + 1 + 3 + 1);
    assert.equal(i[7], 1);
  });

  test('scale multiplies destination size and positions; align shifts lines', () => {
    const ctx = fakeCtx();
    drawText(ctx, 'AA', 100, 0, { scale: 2, align: 'right' });
    assert.equal(ctx.calls[0][5], 100 - 22);
    assert.equal(ctx.calls[1][5], 100 - 22 + 12);
    assert.equal(ctx.calls[0][7], 10);
    const c = fakeCtx();
    drawText(c, 'AAA', 50, 0, { align: 'center' });
    assert.equal(c.calls[0][5], 42); // offset -8.5 rounds to -8
  });

  test('shadow and outline add passes in the right order and colours', () => {
    clearGlyphCache();
    FakeOffscreenCanvas.created.length = 0;
    const ctx = fakeCtx();
    drawText(ctx, 'AB', 0, 0, { color: '#fff', shadow: true });
    assert.equal(ctx.calls.length, 4);
    assert.deepEqual(ctx.calls.slice(0, 2).map((c) => [c[5], c[6]]), [[1, 1], [7, 1]]);
    assert.deepEqual(ctx.calls.slice(2).map((c) => [c[5], c[6]]), [[0, 0], [6, 0]]);
    const o = fakeCtx();
    drawText(o, 'A', 5, 5, { color: '#fff', outline: '#123456', scale: 2 });
    assert.equal(o.calls.length, 9);
    const offsets = o.calls.slice(0, 8).map((c) => `${c[5] - 5},${c[6] - 5}`).sort();
    assert.deepEqual(offsets, ['-2,-2', '-2,0', '-2,2', '0,-2', '0,2', '2,-2', '2,0', '2,2'].sort());
    assert.equal(glyphCacheSize('main'), 3); // white, shadow colour, outline colour
    const both = fakeCtx();
    drawText(both, 'A', 0, 0, { outline: { width: 2 }, shadow: { color: '#000', dx: 0, dy: 2 } });
    assert.equal(both.calls.length, 24 + 1 + 1);
    assert.throws(() => drawText(fakeCtx(), 'A', 0, 0, { outline: { width: 0 } }), RangeError);
  });

  test('atlas cache is bounded per font (LRU)', () => {
    clearGlyphCache();
    const ctx = fakeCtx();
    for (let i = 0; i < 40; i++) drawText(ctx, 'A', 0, 0, { color: `rgb(${i},0,0)` });
    assert.equal(glyphCacheSize('main'), 32);
    FakeOffscreenCanvas.created.length = 0;
    drawText(ctx, 'A', 0, 0, { color: 'rgb(39,0,0)' });
    assert.equal(FakeOffscreenCanvas.created.length, 0, 'recent colour still cached');
    drawText(ctx, 'A', 0, 0, { color: 'rgb(0,0,0)' });
    assert.equal(FakeOffscreenCanvas.created.length, 1, 'oldest colour was evicted');
  });

  test('alpha scales globalAlpha during the draw and restores it', () => {
    const ctx = fakeCtx();
    ctx.globalAlpha = 0.5;
    let seen = null;
    ctx.drawImage = () => { seen = ctx.globalAlpha; };
    drawText(ctx, 'A', 0, 0, { alpha: 0.5 });
    assert.equal(seen, 0.25);
    assert.equal(ctx.globalAlpha, 0.5);
    assert.throws(() => drawText(fakeCtx(), 'A', 0, 0, { alpha: 2 }), RangeError);
    assert.throws(() => drawText(fakeCtx(), 'A', 0, 0, { color: 123 }), TypeError);
  });

  test('maxWidth wraps while drawing and metrics match measureText', () => {
    const ctx = fakeCtx();
    const text = 'The quick brown fox';
    const m = drawText(ctx, text, 0, 0, { maxWidth: 60 });
    assert.deepEqual(m, measureText(text, { maxWidth: 60 }));
    assert.equal(m.lines, 2);
    const ys = new Set(ctx.calls.map((c) => c[6]));
    assert.deepEqual([...ys].sort((a, b) => a - b), [0, 10]);
  });

  test('drawTextTyped reveals a stable prefix across lines', () => {
    const text = 'ab cd\nef';
    const full = fakeCtx();
    drawText(full, text, 0, 0);
    for (let n = 0; n <= 10; n++) {
      const ctx = fakeCtx();
      const r = drawTextTyped(ctx, text, 0, 0, n);
      assert.equal(r.total, 7);
      assert.equal(r.shown, Math.min(n, 7));
      assert.equal(r.done, n >= 7);
      const inkedPrefix = [...'ab cd' + 'ef'].slice(0, Math.min(n, 7)).filter((c) => c !== ' ').length;
      assert.equal(ctx.calls.length, inkedPrefix);
      assert.deepEqual(ctx.calls, full.calls.slice(0, inkedPrefix), `prefix ${n} differs`);
    }
    assert.equal(drawTextTyped(fakeCtx(), text, 0, 0, -3).shown, 0);
    assert.equal(drawTextTyped(fakeCtx(), text, 0, 0, NaN).shown, 0);
    assert.equal(drawTextTyped(fakeCtx(), text, 0, 0, 2.9).shown, 2);
    assert.equal(drawTextTyped(fakeCtx(), text, 0, 0, Infinity).shown, 7);
  });

  test('typed text with wrapping never reflows as it reveals', () => {
    const text = 'The quick brown fox jumps';
    const full = fakeCtx();
    drawText(full, text, 0, 0, { maxWidth: 60 });
    const part = fakeCtx();
    drawTextTyped(part, text, 0, 0, 12, { maxWidth: 60 });
    assert.deepEqual(part.calls, full.calls.slice(0, part.calls.length));
    assert.ok(part.calls.some((c) => c[6] === 10), 'second line has started');
  });
});
