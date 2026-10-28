// Creature art (js/art/creatures/*, js/art/heartmark.js): every species id has a sprite at the right
// size, ≤ 8 keys (+ m on the Vagary only), four Heartmark anchors on body pixels in every frame, the 22
// prototype forms ported pixel-for-pixel, Star-touched remaps for every family star, and the Heartmark
// API (pickAnchor, anchorPoint, drawHeartmark geometry). Run: node --test test/art.creatures.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CREATURE_SPRITES, STAR_SPRITES, CREATURE_ICONS, CREATURE_IDS, FAMILY_ART, getCreatureSprite, getCreatureIcon,
  creatureArt, creatureSprite, drawCreature, hasArt, SPRITE_NAME_BY_ID, CREATURE_SIZE, ICON_SIZE,
} from '../js/art/creatures/index.js';
import { drawHeartmark, pickAnchor, anchorPoint, heartmarkPixels, ANCHOR_KEYS, HEARTMARK_MAGENTA, CENTRE_WARM, CENTRE_COOL } from '../js/art/heartmark.js';
import { SPECIES, FAMILIES, FAMILY_MODULES } from '../js/data/species/index.js';
import { SPRITES as PROTO } from '../proto/creatures/sprites.js';
import { MASTER } from '../js/art/palette.js';
import { lintArtEntry } from '../tools/lint-art.mjs';
import { makeRng } from '../js/core/rng.js';
import { artDef, getSprite } from '../js/art/atlas.js';
import { setCanvasFactory } from '../js/core/pixelart.js';

setCanvasFactory((w, h) => ({ width: w, height: h, getContext: () => ({ createImageData: (ww, hh) => ({ data: new Uint8ClampedArray(ww * hh * 4) }), putImageData() {} }) }));

const protoName = (id) => id.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
const lettersOf = (frames) => new Set(frames.flat().join('').replace(/\./g, ''));
const onBody = (rows, p) => { const c = rows[p.y]?.[p.x]; return !!c && c !== '.' && c !== 'k'; };

/** A recording 2D context. */
function fakeCtx() {
  const px = new Map();
  return {
    px, globalAlpha: 1, fillStyle: '#000', imageSmoothingEnabled: false,
    fillRect(x, y, w, h) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px.set(`${x + i},${y + j}`, this.fillStyle); },
    drawImage() {}, save() {}, restore() {}, putImageData() {},
  };
}

describe('roster coverage', () => {
  it('every species id has a sprite; every family module has an art module', () => {
    assert.equal(SPECIES.length, 42);
    for (const s of SPECIES) assert.ok(CREATURE_SPRITES[s.id], `${s.id} has no sprite`);
    assert.deepEqual([...CREATURE_IDS].sort(), SPECIES.map((s) => s.id).sort());
    assert.deepEqual(FAMILY_ART.map((m) => m.FAMILY), FAMILY_MODULES.map((m) => m.family.id));
    for (const mod of FAMILY_MODULES) {
      const art = FAMILY_ART.find((a) => a.FAMILY === mod.family.id);
      assert.deepEqual(Object.keys(art.SPRITES).sort(), mod.forms.map((f) => f.id).sort(), mod.family.id);
    }
    for (const s of SPECIES) assert.ok(hasArt(s.id), s.id);
  });

  it('dimensions: 32×32 forms, the Vagary 96×96, every frame', () => {
    for (const s of SPECIES) {
      const r = CREATURE_SPRITES[s.id];
      const want = s.id === 'vagary' ? 96 : 32;
      assert.equal(r.w, want, s.id); assert.equal(r.h, want, s.id);
      for (const f of ['rows', 'idle2', 'back']) {
        assert.equal(r[f].length, want, `${s.id}.${f} rows`);
        for (const row of r[f]) assert.equal(row.length, want, `${s.id}.${f} width`);
      }
      assert.notDeepEqual(r.idle2, r.rows, `${s.id}: idle2 differs from front`);
      assert.notDeepEqual(r.back, r.rows, `${s.id}: back differs from front`);
    }
  });

  it('keys: ≤ 8 master letters, k included, m only on the Vagary, inside flags.palette for the briefs', () => {
    for (const s of SPECIES) {
      const r = CREATURE_SPRITES[s.id];
      const used = lettersOf([r.rows, r.idle2, r.back]);
      assert.ok(used.size <= 8, `${s.id}: ${used.size} keys`);
      assert.ok(used.has('k'), `${s.id}: no outline`);
      for (const ch of used) assert.ok(ch in MASTER, `${s.id}: '${ch}' not in MASTER`);
      if (s.id === 'vagary') { assert.ok(used.has('m')); assert.equal(r.reserved, 'vagary'); } else assert.ok(!used.has('m'), `${s.id} draws comet magenta`);
      if (s.flags.sprite === 'brief') for (const ch of used) assert.ok(s.flags.palette.includes(ch), `${s.id}: '${ch}' outside its brief palette ${s.flags.palette}`);
      assert.equal(r.highlight, s.flags.heartmarkHighlight, s.id);
    }
  });

  it('passes tools/lint-art (every form and every Star-touched remap)', () => {
    for (const [id, r] of [...Object.entries(CREATURE_SPRITES), ...Object.entries(STAR_SPRITES)]) {
      const errs = lintArtEntry('creature', id, r).filter((p) => p.level === 'error');
      assert.deepEqual(errs, [], id);
    }
  });
});

describe('Heartmark anchors', () => {
  it('four anchors per frame, on body pixels (not outline, not clear), plus fits inside the cell', () => {
    for (const s of SPECIES) {
      const r = CREATURE_SPRITES[s.id];
      for (const [set, rows, label] of [[r.heartmarks, r.rows, 'front'], [r.heartmarksIdle2, r.idle2, 'idle2'], [r.heartmarksBack, r.back, 'back']]) {
        assert.deepEqual(Object.keys(set), ANCHOR_KEYS, `${s.id} ${label}`);
        for (const k of ANCHOR_KEYS) {
          const p = set[k];
          assert.ok(p.x >= 1 && p.y >= 1 && p.x <= r.w - 2 && p.y <= r.h - 2, `${s.id} ${label}.${k} plus leaves the cell`);
          assert.ok(onBody(rows, p), `${s.id} ${label}.${k} (${p.x},${p.y}) is on '${rows[p.y]?.[p.x]}'`);
        }
      }
      assert.ok(ANCHOR_KEYS.includes(r.mark), s.id);
    }
  });

  it('front anchors are the species data anchors (×3 + 1 on the 96×96 Vagary)', () => {
    for (const s of SPECIES) {
      const r = CREATURE_SPRITES[s.id];
      const k = r.w / 32;
      for (const key of ANCHOR_KEYS) {
        const a = s.flags.heartmarkAnchors[key];
        assert.deepEqual({ ...r.heartmarks[key] }, k === 1 ? { x: a.x, y: a.y } : { x: a.x * k + 1, y: a.y * k + 1 }, `${s.id}.${key}`);
      }
    }
  });
});

describe('ported prototype forms', () => {
  it('the 22 drawn forms keep every approved pixel (front, idle2, back) and their prototype mark', () => {
    const drawn = SPECIES.filter((s) => s.flags.sprite === 'drawn' && s.id !== 'vagary');
    assert.equal(drawn.length, 21);
    for (const s of drawn) {
      const p = PROTO[protoName(s.id)];
      const r = CREATURE_SPRITES[s.id];
      // `revised` frames were repainted in the art director's second pass (true backs, silhouettes); the
      // rest stay pixel-for-pixel, and a revised frame must actually differ from the prototype.
      const rev = new Set(r.revised ?? []);
      for (const ch of rev) assert.ok(['rows', 'idle2', 'back'].includes(ch), `${s.id} revised '${ch}'`);
      for (const [f, label] of [['rows', 'front'], ['idle2', 'idle2'], ['back', 'back']]) {
        if (rev.has(f)) assert.notDeepEqual([...r[f]], p[f], `${s.id} ${label} is listed as revised but unchanged`);
        else assert.deepEqual([...r[f]], p[f], `${s.id} ${label}`);
      }
      assert.deepEqual({ ...r.heartmarks[r.mark] }, p.heartmark, `${s.id} mark`);
      assert.equal(r.source, 'drawn');
      assert.equal(SPRITE_NAME_BY_ID[s.id], protoName(s.id));
    }
  });

  it('the Vagary is the 96×96 comet creature built on the 32×32 concept', () => {
    const r = CREATURE_SPRITES.vagary;
    assert.equal(r.conceptSize, 32);
    const used = lettersOf([r.rows]);
    for (const ch of ['k', 'm', 'w', 'i']) assert.ok(used.has(ch), ch);
  });
});

describe('Star-touched remaps', () => {
  it('one per family star, remapped from the family starPalette, no magenta, same shape', () => {
    const stars = FAMILIES.filter((f) => f.star);
    assert.equal(Object.keys(STAR_SPRITES).length, stars.length);
    for (const f of stars) {
      const st = STAR_SPRITES[`star-${f.star}`];
      const base = CREATURE_SPRITES[f.star];
      assert.ok(st, f.id);
      assert.equal(st.starOf, f.star);
      for (const fr of ['rows', 'idle2', 'back']) {
        st[fr].forEach((row, y) => {
          for (let x = 0; x < row.length; x++) {
            const b = base[fr][y][x];
            assert.equal(row[x], f.starPalette[b] ?? b, `${f.star} ${fr} (${x},${y})`);
          }
        });
      }
      assert.ok(!lettersOf([st.rows, st.idle2, st.back]).has('m'));
      assert.ok(lettersOf([st.rows, st.idle2, st.back]).size <= 8);
    }
  });

  it('Star-touched Sloshkin matches the art director\'s prototype exactly', () => {
    assert.deepEqual([...STAR_SPRITES['star-sloshkin'].rows], PROTO.StarSloshkin.rows);
    assert.deepEqual([...STAR_SPRITES['star-sloshkin'].back], PROTO.StarSloshkin.back);
  });
});

describe('lookups', () => {
  it('icons are 16×16 head crops containing the head anchor', () => {
    for (const s of SPECIES) {
      const ic = CREATURE_ICONS[s.id];
      assert.equal(ic.rows.length, ICON_SIZE); for (const r of ic.rows) assert.equal(r.length, ICON_SIZE);
      const h = CREATURE_SPRITES[s.id].heartmarks.head;
      assert.ok(h.x >= ic.ox && h.x < ic.ox + 16 * ic.step && h.y >= ic.oy && h.y < ic.oy + 16 * ic.step, s.id);
      assert.ok(ic.rows.join('').replace(/\./g, '').length > 40, `${s.id} icon is nearly empty`);
      const sp = getCreatureIcon(s.id);
      assert.equal(sp.w, 16); assert.equal(sp.h, 16);
    }
  });

  it('getCreatureSprite decodes front / idle2 / back / star / silhouette and caches', () => {
    const a = getCreatureSprite('rillfin');
    assert.equal(a.w, 32);
    assert.equal(getCreatureSprite('rillfin'), a);
    assert.notEqual(getCreatureSprite('rillfin', { frame: 1 }), a);
    assert.notEqual(getCreatureSprite('rillfin', { back: true }), a);
    assert.notEqual(getCreatureSprite('rillfin', { star: true }), a);
    assert.equal(getCreatureSprite('vagary', { scale: 2 }).w, 192);
    const sil = getCreatureSprite('rillfin', { silhouette: true });
    const hexes = new Set();
    for (let i = 0; i < sil.pixels.length; i += 4) if (sil.pixels[i + 3]) hexes.add(sil.pixels.slice(i, i + 3).join(','));
    assert.equal(hexes.size, 1);
    assert.equal(getCreatureSprite('nope'), null);
  });

  it('adapter API: creatureArt / creatureSprite / drawCreature keep working (placeholder for unknown ids)', () => {
    const art = creatureArt('sloshkin', { anchor: 'tail' });
    assert.deepEqual({ ...art.heartmark }, { ...CREATURE_SPRITES.sloshkin.heartmarks.tail });
    assert.equal(art.placeholder, false);
    assert.equal(creatureArt('not-a-form').placeholder, true);
    assert.equal(creatureSprite('not-a-form', { types: ['Kiln'] }).w, CREATURE_SIZE);
    const ctx = fakeCtx();
    const out = drawCreature(ctx, 'gillwick', 10, 10, { scale: 2, anchor: 'chest' });
    assert.deepEqual(out.mark, { ...CREATURE_SPRITES.gillwick.heartmarks.chest });
    assert.ok([...ctx.px.values()].includes(HEARTMARK_MAGENTA));
  });

  it('every form is registered with art/atlas (front, back, star variants)', () => {
    for (const s of SPECIES) assert.equal(artDef(s.id).kind, 'creature', s.id);
    assert.equal(getSprite('sloshkin', 'back').w, 32);
    assert.equal(getSprite('sloshkin', 'star').w, 32);
  });
});

describe('heartmark', () => {
  it('pickAnchor is deterministic per uid, uses stream heartmark:<uid>, and spreads over all four keys', () => {
    const rng = makeRng('seed-1');
    const a = pickAnchor('c17', rng);
    assert.equal(pickAnchor('c17', makeRng('seed-1')), a);
    assert.equal(a, ANCHOR_KEYS[makeRng('seed-1').fork('heartmark:c17').int(0, 3)]);
    const seen = new Set();
    for (let i = 0; i < 64; i++) seen.add(pickAnchor(`c${i}`, rng));
    assert.deepEqual([...seen].sort(), [...ANCHOR_KEYS].sort());
    assert.ok(ANCHOR_KEYS.includes(pickAnchor('c1')));
    assert.equal(pickAnchor('c1'), pickAnchor('c1'));
    assert.equal(pickAnchor('x', () => 0.99), 'tail');
  });

  it('anchorPoint reads the right frame and keeps the key through a Shift', () => {
    const r = CREATURE_SPRITES.rillfin;
    assert.deepEqual(anchorPoint(r, 'back'), { ...r.heartmarks.back });
    assert.deepEqual(anchorPoint(r, 'back', { back: true }), { ...r.heartmarksBack.back });
    assert.deepEqual(anchorPoint(r, 'back', { frame: 1 }), { ...r.heartmarksIdle2.back });
    const g = CREATURE_SPRITES.gillwick;
    assert.deepEqual(anchorPoint(g, 'back'), { ...g.heartmarks.back });
  });

  it('geometry: 3 px plus at ×1, 5 px plus with corner glints at ×2; centre by highlight; unlit has no magenta', () => {
    assert.equal(heartmarkPixels(1).arm.length, 4);
    assert.equal(heartmarkPixels(2, true).arm.length, 8);
    assert.equal(heartmarkPixels(2, true).glints.length, 4);
    const warm = CREATURE_SPRITES.knuckleback; // highlight y
    const c1 = fakeCtx();
    const at = drawHeartmark(c1, warm, 'head', { x: 0, y: 0, scale: 1 });
    assert.equal(c1.px.get(`${at.x},${at.y}`), CENTRE_WARM);
    const magenta1 = [...c1.px.entries()].filter(([, v]) => v === HEARTMARK_MAGENTA).length;
    assert.equal(magenta1, 4);
    const c2 = fakeCtx();
    const at2 = drawHeartmark(c2, CREATURE_SPRITES.rillfin, 'head', { x: 0, y: 0, scale: 2 });
    assert.equal(c2.px.get(`${at2.x * 2},${at2.y * 2}`), CENTRE_COOL);
    const magenta2 = [...c2.px.values()].filter((v) => v === HEARTMARK_MAGENTA).length;
    assert.equal(magenta2, 12, '8 arm px + 4 corner glints');
    const c3 = fakeCtx();
    drawHeartmark(c3, CREATURE_SPRITES.rillfin, 'head', { x: 0, y: 0, scale: 2, lit: false });
    assert.ok(![...c3.px.values()].includes(HEARTMARK_MAGENTA));
    // legacy signature
    const c4 = fakeCtx();
    drawHeartmark(c4, 5, 5, { x: 3, y: 3 }, { scale: 1 });
    assert.equal(c4.px.get('9,8'), HEARTMARK_MAGENTA);
  });
});
