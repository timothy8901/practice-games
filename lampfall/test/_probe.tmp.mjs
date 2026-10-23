import * as P from '../js/systems/party.js';
import * as C from '../js/systems/creature.js';
import * as E from '../js/systems/exp.js';
import { validateWorld } from '../js/state/schema.js';
import { DATA, REG, mk, world } from './fixtures/rules-creature.fixture.mjs';
const fresh = (s, l, x = {}) => ({ ...mk('tmp', s, l, x), uid: '' });
const tryit = (name, f) => { try { console.log(name, JSON.stringify(f())); } catch (e) { console.log(name, 'THROW', e.constructor.name, e.message); } };

// a numeric uid
tryit('a numeric uid', () => { const w = world(); const r = P.addCreature(w, { ...fresh('sloshkin', 5), uid: 5 }, DATA); return [r.uid, validateWorld(w)]; });
// b hp writeback after engine levelled the copy
tryit('b hp', () => { const w = world(); P.addCreature(w, fresh('sloshkin', 10), DATA); const copy = C.serialize(w.party[0]);
  const need = E.expForLevel('medium-slow', 11) - copy.exp; C.gainExp(copy, need, DATA); copy.hp = Math.floor(copy.stats.hp * 0.5);
  const r = P.applyOutcome(w, { party: [copy], exp: [{ uid: copy.uid, amount: need }] }, DATA);
  return { copy: [copy.hp, copy.stats.hp, copy.level], world: [w.party[0].hp, w.party[0].stats.hp, w.party[0].level] }; });
// c knot with pending
tryit('c knot', () => { const w = world(); P.addCreature(w, fresh('sloshkin', 5), DATA); P.giveExp(w, 'c1', 100000, DATA); const before = [...w.pendingShifts];
  C.setHeldItem(w.party[0], 'fx-knot', DATA); return { before, after: w.pendingShifts, open: E.openWindows(w.party[0], DATA) }; });
// d typeQueue garbage
tryit('d tq', () => { const c = C.serialize(mk('x', 'sloshkin', 5)); c.typeQueue = [1, 2]; const d = C.deserialize(c, DATA); return [d.typeQueue, d.typeIndex]; });
// e NaN level
tryit('e nan', () => E.computeAward({ kind: 'wild', defeated: [{ expYield: 100, level: 10 }], party: [{ uid: 'a', level: NaN, participated: true }] }));
// f heldItem number
tryit('f held', () => { const c = mk('x', 'sloshkin', 5, { heldItem: 7 }); const w = world(); w.party.push(c); return validateWorld(w); });
// g moves non-array
tryit('g moves', () => mk('x', 'sloshkin', 5, { moves: 'tap' }).moves);
// h damping
tryit('h damp', () => E.computeAward({ kind: 'wild', source: 'rematch', curveLevel: 10, defeated: [{ expYield: 39, level: 10 }], party: [{ uid: 'a', level: 30, participated: true }] }, null, { tuning: { DAMP_FACTOR: 0.3 } }).totals);
// i deserialize level missing but exp present
tryit('i lvl', () => { const c = C.serialize(mk('x', 'sloshkin', 30)); delete c.level; const d = C.deserialize(c, DATA); return [d.level, d.exp]; });
// j makeCreature unknown dial / shift then validate
tryit('j stillKnot w/o item', () => { const c = C.serialize(mk('x', 'sloshkin', 5)); c.stillKnot = true; return C.deserialize(c, DATA).stillKnot; });
// k deserialize empty moves
tryit('k moves', () => { const c = C.serialize(mk('x', 'sloshkin', 5)); c.moves = []; return C.deserialize(c, DATA).moves; });
// l windowsUsed on Shift to neverShifts form?
tryit('l unfixed caught types', () => { const v = Object.values(DATA.species).find((s) => DATA.abilities[s.ability]?.unfixed); if (!v) return 'none'; const c = mk('x', v.id, 40); c.typeIndex = 2; c.types = [c.typeQueue[2]]; const w = world(); const r = P.addCreature(w, c, DATA); return [w.party[0].types, w.party[0].typeQueue, w.party[0].typeIndex]; });
// m gainExp on a creature whose level > tuning MAX_LEVEL
tryit('m', () => { const c = mk('x', 'sloshkin', 60); return C.gainExp(c, 100, DATA, { tuning: { MAX_LEVEL: 50 } }).gained; });
// n tuning mutable cache
tryit('n cache', () => { const t = { BENCH_SHARE: 0.6 }; const a = E.tuningOf(t).BENCH_SHARE; t.BENCH_SHARE = 0.1; return [a, E.tuningOf(t).BENCH_SHARE]; });
// o release w/ autoAnchor
tryit('o release', () => { const w = world(); P.addCreature(w, fresh('sloshkin', 5), DATA); P.addCreature(w, fresh('sloshkin', 5), DATA); w.settings.autoAnchor.c2 = 'auto-anchor'; P.release(w, 'c2', DATA); return validateWorld(w); });
