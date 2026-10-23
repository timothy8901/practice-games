// Unit tests for js/art/palette.js. Run: node --test test/art.palette.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MASTER, MASTER_KEYS, pal, COLORS, UI, ROOF_COLOURS, ROOF_RAMPS, ROOF_NAMES, CAST_HEX, ALL_HEX, NIGHT_INK,
  LUT_EXEMPT, LUT_EXEMPT_KINDS, MAGENTA_USES, TYPE_PALETTE_KEY, typeColour, isLutExempt, isMagentaHex,
  isPureBlackOrWhite, hexOf, inPalette, parseHex,
} from '../js/art/palette.js';
import { MASTER as PROTO_CREATURE_MASTER } from '../proto/creatures/sprites.js';
import { COLORS as PROTO_TILE_COLORS, ROOF_COLOURS as PROTO_ROOFS } from '../proto/tiles/tiles.js';
import { PALETTES as PROTO_CHAR_PALETTES } from '../proto/chars/palettes.js';

const up = (h) => h.toUpperCase();

describe('MASTER: the 21-key sprite letter set', () => {
  it('has exactly Sweetie-16 + m c h u a', () => {
    assert.equal(MASTER_KEYS.length, 21);
    assert.deepEqual([...MASTER_KEYS].sort(), [...'kproylgtnbsiwvedmchua'].sort());
  });
  it('matches the creature prototype values exactly (case-insensitive)', () => {
    for (const k of MASTER_KEYS) assert.equal(MASTER[k], up(PROTO_CREATURE_MASTER[k]), k);
  });
  it('comet magenta m is #FF5BD6', () => assert.equal(MASTER.m, '#FF5BD6'));
  it('pal() builds subsets and rejects unknown letters', () => {
    assert.deepEqual(pal('kbm'), { k: MASTER.k, b: MASTER.b, m: MASTER.m });
    assert.deepEqual(pal(['w']), { w: MASTER.w });
    assert.throws(() => pal('kZ'), /not a master key/);
  });
});

describe('UI tokens (GDD-00 §14 exact hexes)', () => {
  const want = {
    nightInk: '#141B33', cream: '#F6F1E3', deepBlue: '#2B3A67', porchAmber: '#F9C46B', lighthouseAmber: '#FFB547',
    bioCyan: '#3FF2E0', brass: '#D9A441', ledgerPaper: '#F4F1E6', waxRed: '#A8323A', comet: '#FF5BD6',
  };
  for (const [k, v] of Object.entries(want)) it(`${k} = ${v}`, () => assert.equal(UI[k], v));
  it('night ink is the darkest named colour and the NIGHT_INK constant', () => {
    assert.equal(NIGHT_INK, '#141B33');
    assert.equal(COLORS.ink, NIGHT_INK);
  });
});

describe('tile colour table', () => {
  it('keeps every prototype tile colour with the same hex', () => {
    for (const [name, hex] of Object.entries(PROTO_TILE_COLORS)) assert.equal(up(COLORS[name]), up(hex), name);
  });
  it('every value is a 6-digit hex', () => {
    for (const [name, hex] of Object.entries(COLORS)) assert.match(hex, /^#[0-9A-F]{6}$/i, name);
  });
});

describe('roof colours ×8', () => {
  it('has eight, the prototype six first', () => {
    assert.equal(ROOF_COLOURS.length, 8);
    assert.deepEqual(ROOF_COLOURS.slice(0, 6), PROTO_ROOFS);
  });
  it('each has a 4-step ramp in COLORS and a display name', () => {
    for (const c of ROOF_COLOURS) {
      assert.equal(ROOF_RAMPS[c].length, 4);
      for (const n of ROOF_RAMPS[c]) assert.ok(n in COLORS, n);
      assert.ok(ROOF_NAMES[c], c);
    }
  });
  it('ramps get lighter from dark to light', () => {
    const lum = (h) => { const [r, g, b] = parseHex(h); return 0.3 * r + 0.59 * g + 0.11 * b; };
    for (const c of ROOF_COLOURS) {
      const L = ROOF_RAMPS[c].map((n) => lum(COLORS[n]));
      for (let i = 1; i < 4; i++) assert.ok(L[i] > L[i - 1], `${c} step ${i}`);
    }
  });
});

describe('global rules', () => {
  it('no pure black or white anywhere', () => {
    for (const h of [...Object.values(MASTER), ...Object.values(COLORS), ...Object.values(UI), ...CAST_HEX]) {
      assert.equal(isPureBlackOrWhite(h), false, h);
    }
    assert.equal(isPureBlackOrWhite('#000000'), true);
    assert.equal(isPureBlackOrWhite('#fff'), true);
    assert.equal(isPureBlackOrWhite('#FFFFFFFF'), true);
  });
  it('magenta-hued colours appear only as m, skyglass and the comet tokens', () => {
    const magenta = Object.entries({ ...COLORS, ...Object.fromEntries(Object.entries(UI).map(([k, v]) => [`ui.${k}`, v])) })
      .filter(([, h]) => isMagentaHex(h)).map(([k]) => k).sort();
    assert.deepEqual(magenta, ['!m0', '!m1', '!m2', 'ui.comet', 'ui.cometTail'].sort());
    assert.equal(isMagentaHex(MASTER.m), true);
  });
  it('isMagentaHex keeps purples, heathers and pinks out', () => {
    for (const h of [MASTER.p, COLORS.he1, COLORS.he2, COLORS.blossom, COLORS.blossom2, COLORS.glass1, COLORS.sgd1, '#E07A9A']) {
      assert.equal(isMagentaHex(h), false, h);
    }
    assert.equal(isMagentaHex('nope'), false);
  });
  it('MAGENTA_USES names the six reserved uses', () => {
    assert.deepEqual([...MAGENTA_USES].sort(), ['comet', 'forecast', 'heartmark', 'shift', 'skyglass', 'vagary']);
  });
});

describe('LUT exemption', () => {
  it('lists lamps, glowing mud, skyglass, Heartmarks, HUD and cursor', () => {
    for (const k of ['lamps', 'glowingMud', 'skyglass', 'heartmark', 'hud', 'cursor']) assert.ok(LUT_EXEMPT[k] && LUT_EXEMPT[k].length, k);
    assert.deepEqual(LUT_EXEMPT_KINDS, ['ui']);
  });
  it('every exempt tile colour name exists and starts with !', () => {
    for (const k of ['lamps', 'glowingMud', 'skyglass', 'runes', 'flame']) {
      for (const n of LUT_EXEMPT[k]) { assert.ok(n in COLORS, n); assert.equal(n[0], '!'); }
    }
    for (const n of Object.keys(COLORS).filter((x) => x[0] === '!')) {
      assert.ok(Object.values(LUT_EXEMPT).some((list) => list.includes(n)), `${n} is in a LUT_EXEMPT list`);
    }
  });
  it('isLutExempt: ! names and reserved light hexes only', () => {
    assert.equal(isLutExempt('!amber'), true);
    assert.equal(isLutExempt('grass2'), false);
    assert.equal(isLutExempt(MASTER.m), true);
    assert.equal(isLutExempt('#f9c46b'), true);
    assert.equal(isLutExempt(UI.lighthouseAmber), true);
    assert.equal(isLutExempt(UI.bioCyan), true);
    assert.equal(isLutExempt(MASTER.b), false);
    assert.equal(isLutExempt(''), false);
    assert.equal(isLutExempt(null), false);
  });
});

describe('queries', () => {
  it('hexOf resolves names, ! names, letters, UI tokens and hexes', () => {
    assert.equal(hexOf('grass2'), '#5E9E6A');
    assert.equal(hexOf('amber'), '#F9C46B');
    assert.equal(hexOf('!amber'), '#F9C46B');
    assert.equal(hexOf('m'), '#FF5BD6');
    assert.equal(hexOf('waxRed'), '#A8323A');
    assert.equal(hexOf('#abc'), '#AABBCC');
    assert.equal(hexOf('#141b3366'), '#141B33');
    assert.throws(() => hexOf('not-a-colour'), RangeError);
  });
  it('ALL_HEX is the union and inPalette ignores alpha and case', () => {
    assert.ok(ALL_HEX.has('#FF5BD6'));
    assert.ok(inPalette('#5e9e6a'));
    assert.ok(inPalette('#141B3366'));
    assert.equal(inPalette('#123457'), false);
    assert.equal(inPalette('green'), false);
  });
  it('CAST_HEX covers every hex in the prototype character palettes', () => {
    for (const p of Object.values(PROTO_CHAR_PALETTES)) {
      for (const v of Object.values(p)) if (typeof v === 'string' && v[0] === '#') assert.ok(inPalette(v), v);
    }
  });
  it('typeColour maps the 13 types to master letters, never m', () => {
    assert.equal(Object.keys(TYPE_PALETTE_KEY).length, 13);
    assert.ok(!Object.values(TYPE_PALETTE_KEY).includes('m'));
    assert.equal(typeColour('Brine'), MASTER.b);
    assert.equal(typeColour('brine'), MASTER.b);
    assert.equal(typeColour('STAR'), MASTER.d);
    assert.throws(() => typeColour('Fire'), RangeError);
  });
});
