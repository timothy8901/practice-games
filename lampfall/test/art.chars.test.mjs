// test/art.chars.test.mjs  [ART-CHARS]
// Format and coverage checks for js/art/chars/* and js/art/portraits.js:
// every sprite is on-size, every letter is in its palette, no pure black or
// white, the lease card has 6 species x 8 fur palettes plus working markings,
// eye shapes, blush and outfit, the GDD-00 §10 cast is present with the right
// species, and every bust is 48x48 with four expressions for the main cast.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/art/chars/index.js';
import * as P from '../js/art/portraits.js';
import { TRAINERS } from '../js/data/trainers.js';
import { artDef } from '../js/art/atlas.js';

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const FACINGS = ['down', 'up', 'left', 'right'];

test('every trainer body used by the field has registered character art', () => {
  for (const t of TRAINERS) assert.ok(artDef(`char-${t.sprite || t.npc || 'trainerVest'}`), t.id);
});

function framesOf(b) {
  const out = [];
  for (const f of FACINGS) b[f].forEach((fr, i) => out.push([`${f}${i}`, fr, b.w]));
  out.push(['sit', b.sit, b.w]);
  b.fishFrames.forEach((fr, i) => out.push([`fish${i}`, fr, b.fishW]));
  if (b.run) for (const [f, set] of Object.entries(b.run)) set.forEach((fr, i) => out.push([`run-${f}${i}`, fr, b.w]));
  if (b.poses) for (const [k, fr] of Object.entries(b.poses)) out.push([`pose-${k}`, fr, b.w]);
  return out;
}

test('every body: 4 facings x 4 frames, sit, 4 fish frames, all on-size', () => {
  for (const [id, b] of Object.entries(C.BODIES)) {
    // size-as-character: 16 wide, or 24 wide centred on the tile (ox -4) for the wide cast (Hesper)
    assert.ok(b.w === 16 || (b.w === 24 && b.ox === -4), `${id} width ${b.w} ox ${b.ox}`);
    assert.ok([24, 28, 32].includes(b.h), `${id} height ${b.h}`);
    assert.equal(b.oy, 24 - b.h, `${id} oy keeps the feet on the tile`);
    for (const f of FACINGS) assert.equal(b[f].length, 4, `${id}.${f} has 4 frames`);
    assert.equal(b.fishFrames.length, 4, `${id} fish frames`);
    for (const [name, fr, w] of framesOf(b)) {
      assert.equal(fr.length, b.h, `${id}.${name} height`);
      fr.forEach((r, y) => assert.equal(r.length, w, `${id}.${name} row ${y} width`));
    }
  }
});

test('feet stand on the bottom row of every standing frame', () => {
  for (const [id, b] of Object.entries(C.BODIES)) {
    if (['bat', 'moth'].includes(id)) continue; // fliers hover over a ground shadow
    for (const f of FACINGS) for (const fr of b[f]) {
      const lowest = fr.reduce((acc, r, y) => (/[^.z]/.test(r) ? y : acc), -1);
      assert.ok(lowest >= b.h - 2, `${id}.${f} lowest pixel row ${lowest} of ${b.h}`);
    }
  }
});

test('every character letter is in its palette; colours are hex, no pure black or white', () => {
  for (const [id, ch] of Object.entries(C.CHAR_SPRITES)) {
    const missing = C.lettersUsed(ch.body).filter((l) => !(l in ch.palette));
    assert.deepEqual(missing, [], `${id} letters missing from palette`);
    for (const [k, v] of Object.entries(ch.palette)) {
      assert.match(v, HEX, `${id}.${k}`);
      const rgb = v.slice(1, 7).toLowerCase();
      assert.notEqual(rgb, '000000', `${id}.${k} pure black`);
      assert.notEqual(rgb, 'ffffff', `${id}.${k} pure white`);
    }
  }
});

test('lease-card fur ramps: hex, no pure black or white', () => {
  for (const sp of C.PLAYER_SPECIES) C.FUR_PALETTES[sp].forEach((p, i) => {
    for (const [k, v] of Object.entries(p)) {
      if (k === 'id' || k === 'name') continue;
      assert.match(v, HEX, `${sp} ${i} ${k}`);
      assert.ok(!/^#(000000|ffffff)/i.test(v), `${sp} ${i} ${k} = ${v}`);
    }
  });
});

test('every colour the cast draws resolves in js/art/palette.js (ALL_HEX)', async () => {
  const pal = await import('../js/art/palette.js');
  const all = new Set();
  const add = (p) => { for (const v of Object.values(p)) if (typeof v === 'string' && v[0] === '#') all.add(pal.hexOf(v)); };
  for (const ch of Object.values(C.CHAR_SPRITES)) add(ch.palette);
  for (const p of Object.values(C.PALETTES)) add(p);
  for (const sp of C.PLAYER_SPECIES) for (let i = 0; i < 8; i++) for (const o of C.OUTFITS) for (const m of [[], ['socks']]) add(C.playerLook({ species: sp, fur: i, outfit: o, markings: m }).palette);
  for (const id of P.PORTRAIT_IDS) for (const e of P.expressionsOf(id)) add(P.portrait(id, e).palette);
  const missing = [...all].filter((h) => !pal.ALL_HEX.has(h)).sort();
  assert.deepEqual(missing, [], `add these to js/art/chars/hexes.js: ${missing.map((h) => `'${h}'`).join(', ')}`);
});

test('comet magenta is reserved: no character palette uses #ff5bd6', () => {
  for (const [id, p] of Object.entries(C.PALETTES)) for (const [k, v] of Object.entries(p)) assert.notEqual(v.toLowerCase(), '#ff5bd6', `${id}.${k}`);
});

test('GDD-00 §10 cast is present with the decided species', () => {
  const want = {
    wren: 'beaver', ambrose: 'old beaver', hesper: 'garden snail', juniper: 'magpie', ludo: 'fruit bat', barnaby: 'hermit crab',
    dimity: 'rosy maple moth', augusta: 'grey seal', ansel: 'grey heron', wick: 'puffling', tully: 'wombat', odile: 'roseate spoonbill',
    bryony: 'rock hyrax', thessaly: 'bilby', tamsin: 'badger', isolde: 'storm petrel', thatch: 'finches', corin: 'tawny owl',
    linnet: 'stoat', maud: 'greylag goose', osric: 'tortoise', ines: 'crested newt', wendel: 'great crested grebe', ada: 'jackdaw',
    ivo: 'jackdaw', seraphine: 'arctic fox', hollis: 'mountain goat', agathe: 'cormorant', teo: 'raccoon', dov: 'kinkajou',
    bastien: 'mink', cass: 'lynx', idris: 'great northern diver', pip: 'water rat',
  };
  for (const [id, sp] of Object.entries(want)) {
    assert.ok(C.CHARACTERS[id], `missing ${id}`);
    assert.equal(C.CHARACTERS[id].species, sp, `${id} species`);
  }
});

test('size as character: Ansel tallest, Odile next, Wick small inside his cell', () => {
  assert.equal(C.CHAR_SPRITES.ansel.h, 32);
  assert.equal(C.CHAR_SPRITES.odile.h, 28);
  assert.deepEqual(C.drawOffset('ansel'), { x: 0, y: -16 });
  assert.deepEqual(C.drawOffset('wren'), { x: 0, y: -8 });
  const top = (fr) => fr.findIndex((r) => /[^.z]/.test(r));
  assert.ok(top(C.frame('puffling', 'down', 0)) >= 6, 'Wick is small');
  assert.ok(top(C.frame('wren', 'down', 0)) <= 1, 'Wren fills the cell');
});

test('lease card: 6 species, 8 fur palettes each, every combination builds', () => {
  assert.deepEqual([...C.PLAYER_SPECIES], ['water-vole', 'pine-marten', 'red-panda', 'opossum', 'ferret', 'mongoose']);
  for (const sp of C.PLAYER_SPECIES) {
    assert.equal(C.FUR_PALETTES[sp].length, 8, sp);
    for (let i = 0; i < 8; i++) {
      const look = C.playerLook({ species: sp, fur: i });
      const missing = C.lettersUsed(look.body).filter((l) => !(l in look.palette));
      assert.deepEqual(missing, [], `${sp} fur ${i}`);
    }
    for (const m of C.MARKINGS) for (const e of C.EYE_SHAPES) for (const o of C.OUTFITS) {
      const look = C.playerLook({ species: sp, markings: [m], eyes: e, outfit: o, blush: true });
      const missing = C.lettersUsed(look.body).filter((l) => !(l in look.palette));
      assert.deepEqual(missing, [], `${sp} ${m} ${e} ${o}`);
    }
  }
  assert.equal(C.DEFAULT_CARD.species, 'red-panda');
});

test('lease card options change the pixels (markings, eyes, blush, socks, outfit)', () => {
  const base = C.playerLook({ species: 'red-panda' });
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const m of ['mask', 'stripe', 'freckles', 'blaze']) assert.ok(!same(C.playerLook({ species: 'red-panda', markings: [m] }).body.down[0], base.body.down[0]) || m === 'stripe', m);
  assert.ok(!same(C.playerLook({ species: 'red-panda', markings: ['stripe'] }).body.up[0], base.body.up[0]), 'stripe shows from behind');
  assert.notEqual(C.playerLook({ species: 'red-panda', markings: ['socks'] }).palette.S, base.palette.S, 'socks recolour the paws');
  for (const e of ['sleepy', 'bright']) assert.ok(!same(C.playerLook({ species: 'red-panda', eyes: e }).body.down[0], base.body.down[0]), e);
  assert.ok(!same(C.playerLook({ species: 'red-panda', blush: true }).body.down[0], base.body.down[0]), 'blush');
  assert.ok(!same(C.playerLook({ species: 'red-panda', outfit: 'apron' }).body.down[0], base.body.down[0]), 'apron');
});

test('normalizeCard never throws on junk and is memoized by cardKey', () => {
  for (const junk of [null, undefined, {}, { species: 'otter' }, { fur: 99, markings: 'mask', eyes: 7 }]) {
    const c = C.normalizeCard(junk);
    assert.ok(C.PLAYER_SPECIES.includes(c.species));
    assert.ok(c.fur >= 0 && c.fur < 8);
  }
  assert.equal(C.playerLook({ species: 'ferret', fur: 2 }), C.playerLook({ fur: 2, species: 'ferret' }));
});

test('no otter anywhere: the marten replaced it', () => {
  assert.ok(!('otter' in C.HEADS));
  assert.ok(!Object.values(C.CHARACTERS).some((c) => /otter/.test(c.species)));
});

test('walk cycles move: frames 1 and 3 differ from the idle frame for walkers', () => {
  for (const [id, ch] of Object.entries(C.CHAR_SPRITES)) {
    const b = ch.body;
    for (const f of FACINGS) {
      assert.notDeepEqual(b[f][1], b[f][0], `${id}.${f} step A`);
      assert.notDeepEqual(b[f][3], b[f][0], `${id}.${f} step B`);
    }
  }
});

test('portraits: 48x48, letters in palette, four expressions for the main cast', () => {
  const main = ['wren', 'corin', 'linnet', 'juniper', 'hesper', 'wick', 'ambrose', 'idris', 'maud', 'tully'];
  for (const id of main) assert.deepEqual(P.expressionsOf(id), ['neutral', 'happy', 'worried', 'surprised'], id);
  for (const id of P.PORTRAIT_IDS) {
    const exprs = P.expressionsOf(id);
    assert.ok(exprs.includes('neutral'), id);
    const seen = new Set();
    for (const e of exprs) {
      const p = P.portrait(id, e);
      assert.equal(p.rows.length, 48, `${id} ${e} height`);
      p.rows.forEach((r, y) => assert.equal(r.length, 48, `${id} ${e} row ${y}`));
      const missing = [...new Set(p.rows.join('').replace(/\./g, ''))].filter((l) => !(l in p.palette));
      assert.deepEqual(missing, [], `${id} ${e} missing letters`);
      seen.add(p.rows.join('\n'));
    }
    assert.equal(seen.size, exprs.length, `${id}: every expression is distinct`);
  }
});

test('every named resident and Spire leader has a bust', () => {
  const need = ['wren', 'ambrose', 'hesper', 'juniper', 'ludo', 'barnaby', 'dimity', 'augusta', 'ansel', 'wick', 'tully', 'odile',
    'bryony', 'thessaly', 'tamsin', 'isolde', 'thatch', 'corin', 'linnet', 'maud', 'osric', 'ines', 'wendel', 'ada', 'ivo',
    'seraphine', 'hollis', 'agathe', 'teo', 'dov', 'bastien', 'cass', 'idris', 'pip'];
  for (const id of need) assert.ok(P.portrait(id), `bust for ${id}`);
  assert.equal(P.portrait('nobody'), null);
  assert.equal(P.portrait('osric', 'happy').expr, 'neutral', 'falls back to neutral');
});

test('Linnet has no purple in her fur (brown ramp)', () => {
  const p = P.portrait('linnet');
  for (const k of ['F', 'f', 'D', 'L']) assert.notEqual(p.palette[k].toLowerCase(), C.SW.p, `bust ${k}`);
  assert.notEqual(C.PALETTES.linnet.f.toLowerCase(), C.SW.p);
});
