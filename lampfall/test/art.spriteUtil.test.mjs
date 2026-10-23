// Unit tests for js/art/spriteUtil.js. Run: node --test test/art.spriteUtil.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  blank, sizeOf, normalize, blit, under, patch, fillRect, remap, mirror, flipV, rotateCW, rotate, edgeSet, shift,
  squash, hover, squashBy, bbox, isOpaque, keysUsed, frameAt, frameOnce, pingPong, withAnticipation, ditherRow,
  hash2, MAX_SQUASH, CHAR_FPS,
} from '../js/art/spriteUtil.js';
import { squash as protoSquash, hover as protoHover, SPRITES } from '../proto/creatures/sprites.js';

const box = (w, h) => blank(w, h).map((r, y) => (y >= 2 && y < h - 1 ? '.' + 'a'.repeat(w - 2) + '.' : r));

describe('construction', () => {
  it('blank / sizeOf / normalize', () => {
    assert.deepEqual(blank(3, 2), ['...', '...']);
    assert.deepEqual(blank(2, 1, 'x'), ['xx']);
    assert.deepEqual(sizeOf(['ab', 'abcd']), { w: 4, h: 2 });
    assert.deepEqual(normalize(['ab', 'abcd']), ['ab..', 'abcd']);
  });
  it('blit is transparent-aware, clips, and does not mutate', () => {
    const base = blank(4, 3);
    const out = blit(base, ['x.', 'yz'], 3, 1);
    assert.deepEqual(base, blank(4, 3));
    assert.deepEqual(out, ['....', '...x', '...y']);
    assert.deepEqual(blit(['aa', 'aa'], ['b.'], 0, 0), ['ba', 'aa']);
  });
  it('under only fills transparent pixels', () => {
    assert.deepEqual(under(['a.', '..'], ['bb', 'bb'], 0, 0), ['ab', 'bb']);
  });
  it('patch, fillRect, remap', () => {
    assert.deepEqual(patch(['...'], [[1, 0, 'x'], [9, 9, 'y']]), ['.x.']);
    assert.deepEqual(fillRect(blank(3, 3), 1, 1, 2, 2, 'q'), ['...', '.qq', '.qq']);
    assert.deepEqual(remap(['abca'], { a: 'z', c: 'y' }), ['zbyz']);
  });
});

describe('transforms', () => {
  const R = ['ab', 'cd', 'ef'];
  it('mirror and flipV', () => {
    assert.deepEqual(mirror(R), ['ba', 'dc', 'fe']);
    assert.deepEqual(flipV(R), ['ef', 'cd', 'ab']);
  });
  it('rotateCW turns a w×h into h×w; four turns are identity', () => {
    assert.deepEqual(rotateCW(R), ['eca', 'fdb']);
    assert.deepEqual(rotate(R, 4), R);
    assert.deepEqual(rotate(R, -1), rotate(R, 3));
  });
  it('edgeSet authors e/s/w from the north edge', () => {
    const n = ['xxxx', '....', '....', '....'];
    const e = edgeSet(n);
    assert.deepEqual(e.n, n);
    assert.deepEqual(e.s, ['....', '....', '....', 'xxxx']);
    assert.ok(e.e.every((r) => r[3] === 'x'));
    assert.ok(e.w.every((r) => r[0] === 'x'));
  });
  it('shift moves inside the same box', () => {
    assert.deepEqual(shift(['a.', '..'], 1, 1), ['..', '.a']);
  });
});

describe('motion helpers (sized by rows, §8.4)', () => {
  it('squash matches the creature prototype on 32×32 sprites', () => {
    const rows = SPRITES.Sloshkin.rows;
    assert.deepEqual(squash(rows, 26), protoSquash(rows, 26));
  });
  it('hover matches the prototype on 32×32 sprites', () => {
    assert.deepEqual(hover(SPRITES.Prismoth.rows), protoHover(SPRITES.Prismoth.rows));
  });
  for (const [w, h] of [[24, 24], [16, 24], [96, 96]]) {
    it(`squash / hover keep ${w}×${h}`, () => {
      const r = box(w, h);
      const s = squash(r, h - 4);
      assert.equal(s.length, h);
      assert.ok(s.every((row) => row.length === w));
      assert.equal(s[0], '.'.repeat(w));
      const hv = hover(r);
      assert.equal(hv.length, h);
      assert.equal(hv[h - 1], '.'.repeat(w));
    });
  }
  it('squashBy never exceeds 10% and keeps the feet planted', () => {
    assert.equal(MAX_SQUASH, 0.1);
    const r = box(16, 24);
    const before = bbox(r);
    for (const p of [0.05, 0.1, 0.5]) {
      const s = squashBy(r, p);
      const after = bbox(s);
      assert.equal(after.y + after.h, before.y + before.h, 'bottom row stays');
      assert.ok(before.h - after.h <= Math.round(before.h * 0.1), 'at most 10% shorter');
      assert.equal(s.length, 24);
    }
    assert.deepEqual(squashBy(r, 0), r);
    assert.deepEqual(squashBy(blank(4, 4), 0.1), blank(4, 4));
  });
});

describe('queries', () => {
  it('bbox / isOpaque / keysUsed', () => {
    assert.deepEqual(bbox(['....', '.ab.', '..c.']), { x: 1, y: 1, w: 2, h: 2 });
    assert.equal(bbox(blank(3, 3)), null);
    assert.equal(isOpaque(['.a'], 1, 0), true);
    assert.equal(isOpaque(['.a'], 0, 0), false);
    assert.equal(isOpaque(['.a'], 5, 0), false);
    assert.deepEqual([...keysUsed([['ab'], ['bc.']])].sort(), ['a', 'b', 'c']);
    assert.deepEqual([...keysUsed(['x.y'])].sort(), ['x', 'y']);
  });
});

describe('frame timing', () => {
  it('frameAt loops at fps with a phase', () => {
    assert.equal(frameAt(0, 4, 6), 0);
    assert.equal(frameAt(1000, 4, 6), 2); // 6 frames in 1 s -> 6 mod 4
    assert.equal(frameAt(0, 4, 6, 3), 3);
    assert.equal(frameAt(5000, 1, 6), 0);
    assert.equal(frameAt(5000, 3, 0), 0);
    assert.ok(frameAt(-250, 4, 4) >= 0);
  });
  it('frameOnce clamps on the last frame', () => {
    assert.equal(frameOnce(0, 5, 10), 0);
    assert.equal(frameOnce(250, 5, 10), 2);
    assert.equal(frameOnce(99999, 5, 10), 4);
  });
  it('pingPong, anticipation, CHAR_FPS', () => {
    assert.deepEqual(pingPong(4), [0, 1, 2, 3, 2, 1]);
    assert.deepEqual(pingPong(1), [0]);
    assert.deepEqual(withAnticipation(['w'], [['a'], ['b']]), [['w'], ['a'], ['b']]);
    assert.equal(CHAR_FPS, 12);
  });
  it('ditherRow and hash2 are deterministic', () => {
    assert.equal(ditherRow(4, 0, 'a', 'b'), 'abab');
    assert.equal(ditherRow(4, 1, 'a', 'b'), 'baba');
    assert.equal(hash2(3, 7), hash2(3, 7));
    assert.notEqual(hash2(3, 7), hash2(7, 3));
    assert.ok(Number.isInteger(hash2(-5, 2)) && hash2(-5, 2) >= 0);
  });
});
