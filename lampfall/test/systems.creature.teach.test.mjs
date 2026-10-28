// Disc teaching and Still Knot rules in js/systems/creature.js (canTeach, teachMove, itemBlocksShift),
// salvaged from Claude's stashed rules work, plus parity checks against the scene helpers that
// already answer the same questions (shop.learnerState, menuModel.learnerStrip, art pickAnchor).
// Run: node --test test/systems.creature.teach.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../js/systems/creature.js';
import { DATA as FX, SPECIES, mk } from './fixtures/rules-creature.fixture.mjs';
import { ITEMS } from '../js/data/items.js';
import { SPECIES as GAME_SPECIES, FAMILIES } from '../js/data/species/index.js';
import { MOVES } from '../js/data/moves/index.js';
import { ABILITIES } from '../js/data/abilities.js';
import { TYPES } from '../js/data/types.js';
import { createRegistry } from '../js/data/registry.js';
import { learnerState } from '../js/scenes/shop.js';
import { learnerStrip } from '../js/scenes/menuModel.js';
import { pickAnchor, ANCHOR_KEYS } from '../js/art/heartmark.js';
import { makeRng } from '../js/core/rng.js';

// Fixture data with one form whose disc list (`flags.teachable`) holds a move outside its learnset.
const TAUGHT = 'gale-cut';
// The real creature and item tables only (not js/data/content.js, so cast/story edits never reach this file).
const GAME = Object.freeze({ types: TYPES, moves: MOVES, abilities: ABILITIES, species: GAME_SPECIES, families: FAMILIES, items: ITEMS });

const DATA = Object.freeze({
  ...FX,
  species: { ...SPECIES, discling: { ...SPECIES.sloshkin, id: 'discling', name: 'Discling', flags: { teachable: [TAUGHT] } } },
  items: [
    ...FX.items,
    { id: 'fx-held-knot', name: 'Held Knot', pocket: 'held', held: { blocksShift: true } },
    { id: 'fx-held-knots', name: 'Held Knot (old)', pocket: 'held', held: { blocksShifts: true } },
    { id: 'fx-row-knot', name: 'Row Knot', pocket: 'held', blocksShift: true },
    { id: 'fx-loose', name: 'Loose', pocket: 'held', held: { blocksShift: false } },
  ],
});

describe('canTeach', () => {
  it('knows / can (learnset or flags.teachable) / cannot', () => {
    const c = C.makeCreature({ uid: 'c1', speciesId: 'discling', level: 5, moves: ['tap'] }, DATA);
    assert.equal(C.canTeach(c, 'tap', DATA), 'knows');
    assert.equal(C.canTeach(c, TAUGHT, DATA), 'can', 'on the disc list');
    assert.equal(C.canTeach(c, 'settle', DATA), 'can', 'in the learnset');
    const plain = C.makeCreature({ uid: 'c2', speciesId: 'sloshkin', level: 5, moves: ['tap'] }, DATA);
    assert.equal(C.canTeach(plain, TAUGHT, DATA), 'cannot');
  });

  it('a form missing from the data (or no creature) reads as cannot, never throws', () => {
    assert.equal(C.canTeach({ speciesId: 'nobody', moves: [] }, 'tap', DATA), 'cannot');
    assert.equal(C.canTeach({ speciesId: 'nobody', moves: [{ id: 'tap' }] }, 'tap', DATA), 'knows');
    assert.equal(C.canTeach(null, 'tap', DATA), 'cannot');
  });

  it('agrees with shop.learnerState and menuModel.learnerStrip for every disc and every form in the game', () => {
    const reg = createRegistry(GAME);
    const discs = GAME.items.filter((it) => it.use === 'disc' && typeof it.move === 'string').map((it) => it.move);
    assert.ok(discs.length > 0, 'the game has discs');
    let n = 0;
    for (const sp of GAME.species) {
      const c = { uid: `u-${sp.id}`, nickname: sp.name, speciesId: sp.id, moves: [] };
      for (const mv of discs) {
        const want = C.canTeach(c, mv, GAME);
        assert.equal(learnerState(reg, c, mv), want, `${sp.id} / ${mv}: shop`);
        assert.equal(learnerStrip([c], mv, GAME)[0].state, want, `${sp.id} / ${mv}: satchel`);
        n++;
      }
    }
    assert.ok(n > 100);
  });
});

describe('teachMove', () => {
  it('teaches a disc move into a free slot', () => {
    const c = C.makeCreature({ uid: 'c1', speciesId: 'discling', level: 5, moves: ['tap'] }, DATA);
    const before = c.moves.length;
    assert.deepEqual(C.teachMove(c, TAUGHT, DATA), { ok: true, move: TAUGHT, replaced: null });
    assert.equal(c.moves.length, before + 1);
    const slot = c.moves.find((m) => m.id === TAUGHT);
    assert.ok(slot && slot.pp === slot.maxPp && slot.pp > 0);
  });

  it('refuses unknown, known and unlearnable moves without touching the creature', () => {
    const c = C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', level: 5, moves: ['tap'] }, DATA);
    const snap = JSON.stringify(c);
    assert.deepEqual(C.teachMove(c, 'no-such-move', DATA), { ok: false, reason: 'unknown-move' });
    assert.deepEqual(C.teachMove(c, /** @type {any} */ (null), DATA), { ok: false, reason: 'unknown-move' });
    assert.deepEqual(C.teachMove(c, 'tap', DATA), { ok: false, reason: 'knows' });
    assert.deepEqual(C.teachMove(c, TAUGHT, DATA), { ok: false, reason: 'cannot-learn' }, 'learnMove alone would take it');
    assert.equal(JSON.stringify(c), snap);
  });

  it('a full set needs a valid replaceIndex and never overwrites the Heartmark technique', () => {
    const c = mk('c1', 'discling', 40, { data: DATA });
    assert.equal(c.moves.length, 4);
    assert.ok(c.heartmark && c.moves.some((m) => m.id === c.heartmark));
    const snap = JSON.stringify(c);
    assert.deepEqual(C.teachMove(c, TAUGHT, DATA), { ok: false, reason: 'full' });
    assert.deepEqual(C.teachMove(c, TAUGHT, DATA, { replaceIndex: 4 }), { ok: false, reason: 'full' });
    assert.deepEqual(C.teachMove(c, TAUGHT, DATA, { replaceIndex: -1 }), { ok: false, reason: 'full' });
    const hm = c.moves.findIndex((m) => m.id === c.heartmark);
    assert.deepEqual(C.teachMove(c, TAUGHT, DATA, { replaceIndex: hm }), { ok: false, reason: 'heartmark' });
    assert.equal(JSON.stringify(c), snap);
    const k = c.moves.findIndex((m) => m.id !== c.heartmark);
    const old = c.moves[k].id;
    assert.deepEqual(C.teachMove(c, TAUGHT, DATA, { replaceIndex: k }), { ok: true, move: TAUGHT, replaced: old });
    assert.equal(c.moves[k].id, TAUGHT);
    assert.equal(c.moves.length, 4);
  });

  it('honours MOVE_SLOTS tuning like learnMove', () => {
    const tuning = { MOVE_SLOTS: 2 };
    const c = C.makeCreature({ uid: 'c1', speciesId: 'discling', level: 5, moves: ['tap'], tuning }, DATA);
    assert.equal(c.moves.length, 2);
    assert.deepEqual(C.teachMove(c, TAUGHT, DATA, { tuning }), { ok: false, reason: 'full' });
    const k = c.moves.findIndex((m) => m.id !== c.heartmark);
    assert.equal(C.teachMove(c, TAUGHT, DATA, { tuning, replaceIndex: k }).ok, true);
  });
});

describe('itemBlocksShift (Still Knot rows)', () => {
  it('reads held.blocksShift (the item data spelling) and the older spellings', () => {
    assert.equal(C.itemBlocksShift({ held: { blocksShift: true } }), true);
    assert.equal(C.itemBlocksShift({ blocksShifts: true }), true);
    assert.equal(C.itemBlocksShift({ held: { blocksShifts: true } }), true);
    assert.equal(C.itemBlocksShift({ blocksShift: true }), true);
    assert.equal(C.itemBlocksShift({ held: { blocksShift: false } }), false);
    assert.equal(C.itemBlocksShift({ held: { blocksShift: 'yes' } }), false, 'only a real true');
    assert.equal(C.itemBlocksShift({ held: null }), false);
    assert.equal(C.itemBlocksShift(null), false);
    assert.equal(C.itemBlocksShift(undefined), false);
    assert.equal(C.itemBlocksShift('still-knot'), false, 'a row, not an id');
  });

  it('the game\'s Still Knots block Shifts and nothing else held does', () => {
    const knots = GAME.items.filter((it) => C.itemBlocksShift(it)).map((it) => it.id).sort();
    assert.deepEqual(knots, ['brack-still-knot', 'still-knot']);
  });

  it('makeCreature, setHeldItem and deserialize follow every spelling', () => {
    for (const id of ['fx-knot', 'fx-held-knot', 'fx-held-knots', 'fx-row-knot']) {
      const c = C.makeCreature({ uid: 'c1', speciesId: 'sloshkin', heldItem: id }, DATA);
      assert.equal(c.stillKnot, true, `${id}: makeCreature`);
      assert.equal(C.deserialize({ ...C.serialize(c), stillKnot: false }, DATA).stillKnot, true, `${id}: deserialize`);
      C.setHeldItem(c, 'fx-loose', DATA);
      assert.equal(c.stillKnot, false, 'held.blocksShift false is not a Knot');
      C.setHeldItem(c, id, DATA);
      assert.equal(c.stillKnot, true, `${id}: setHeldItem`);
    }
  });
});

describe('Heartmark body anchor (HEAD covers the stash\'s mark-spot helpers)', () => {
  it('drawBodyMark picks the same anchor as art/heartmark.pickAnchor, with and without an rng', () => {
    for (let i = 0; i < 40; i++) {
      const uid = `c${i}`;
      assert.equal(C.drawBodyMark(uid).anchor, pickAnchor(uid), `${uid}: no rng`);
      const seed = `anchor-parity:${i}`;
      assert.equal(C.drawBodyMark(uid, makeRng(seed)).anchor, pickAnchor(uid, makeRng(seed)), `${uid}: seeded`);
      assert.ok(ANCHOR_KEYS.includes(C.drawBodyMark(uid).anchor));
    }
  });
});
