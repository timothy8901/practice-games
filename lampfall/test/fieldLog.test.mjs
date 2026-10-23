// Unit tests for js/systems/fieldLog.js. Run: node --test test/fieldLog.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as FL from '../js/systems/fieldLog.js';
import { createRegistry } from '../js/data/registry.js';
import { validateWorld } from '../js/state/schema.js';
import { DATA, COLLECTIONS, SPECIES, makeWorld, creatureOf, recordingBus } from './fixtures/gatherLane.fixture.mjs';

const BRINE = { lead: { types: ['Brine'] } };
const NONE = { lead: null };

describe('data adapter', () => {
  const reg = createRegistry({ collections: COLLECTIONS, species: SPECIES, encounters: DATA.encounters });
  it('rowsOf reads arrays, keyed objects and registries; unknown tables are empty', () => {
    assert.equal(FL.rowsOf(DATA, 'collections').length, COLLECTIONS.length);
    assert.equal(FL.rowsOf(reg, 'collections').length, COLLECTIONS.length);
    assert.equal(FL.rowsOf(DATA, 'encounters').length, Object.keys(DATA.encounters).length);
    assert.deepEqual(FL.rowsOf(DATA, 'nope'), []);
    assert.deepEqual(FL.rowsOf(reg, 'nope'), []);
    assert.deepEqual(FL.rowsOf(null, 'collections'), []);
    assert.deepEqual(FL.rowsOf({ collections: 5 }, 'collections'), []);
  });
  it('rowOf finds by id in every table shape and returns null otherwise', () => {
    assert.equal(FL.rowOf(DATA, 'collections', 'pear').price, 120);
    assert.equal(FL.rowOf(reg, 'collections', 'pear').price, 120);
    assert.equal(FL.rowOf(DATA, 'encounters', 'town-reeds').length, 1);
    assert.equal(FL.rowOf(reg, 'encounters', 'town-reeds').length, 1);
    assert.equal(FL.rowOf(DATA, 'collections', 'nope'), null);
    assert.equal(FL.rowOf(reg, 'collections', 'nope'), null);
    assert.equal(FL.rowOf(reg, 'nope', 'x'), null);
    assert.equal(FL.rowOf(DATA, 'encounters', 'toString'), null, 'no prototype keys');
    assert.equal(FL.rowOf(DATA, 'collections', 7), null);
  });
  it('collectionRows filters by kind; isLogged honours log:false', () => {
    assert.deepEqual(FL.collectionRows(DATA, 'fish').map((r) => r.id), ['fish-a', 'fish-b', 'fish-night']);
    assert.equal(FL.isLogged(FL.rowOf(DATA, 'collections', 'cockle')), false);
    assert.equal(FL.isLogged(FL.rowOf(DATA, 'collections', 'pear')), true);
    assert.equal(FL.isLogged(null), false);
  });
});

describe('tuning', () => {
  it('defaults are the GDD-00 values and frozen', () => {
    assert.equal(FL.DEFAULTS.fishTellCatches, 3);
    assert.equal(FL.DEFAULTS.findCleanMult, 1.4);
    assert.deepEqual(FL.DEFAULTS.creatureBonuses.brine, { fishNameSpecies: true, tellCatches: 1, biteWindowMult: 1.5 });
    assert.ok(Object.isFrozen(FL.DEFAULTS.creatureBonuses.brine));
    assert.deepEqual(FL.TUNING_KEYS, ['creatureBonuses', 'fishTellCatches', 'findCleanMult']);
    assert.equal(FL.tuningOf(null), FL.DEFAULTS);
  });
  it('merges valid overrides, caches per source, ignores other modules\' keys and rejects bad values', () => {
    const src = { fishTellCatches: 5, somethingElse: 1 };
    const t = FL.tuningOf(src);
    assert.equal(t.fishTellCatches, 5);
    assert.equal(t.findCleanMult, 1.4);
    assert.equal(FL.tuningOf(src), t, 'cached');
    assert.equal('somethingElse' in t, false);
    assert.throws(() => FL.tuningOf({ fishTellCatches: 0 }), /fishTellCatches/);
    assert.throws(() => FL.tuningOf({ creatureBonuses: { brine: { teleport: true } } }), /creatureBonuses/);
    assert.throws(() => FL.tuningOf(3), /must be an object/);
  });
  it('tuningSource prefers ctx.tuning, then data.tuning', () => {
    const a = { x: 1 }, b = { y: 2 };
    assert.equal(FL.tuningSource({ tuning: a, data: { tuning: b } }), a);
    assert.equal(FL.tuningSource({ data: { tuning: b } }), b);
    assert.equal(FL.tuningSource({}), null);
    assert.equal(FL.tuningSource(undefined), null);
  });
  it('V validators', () => {
    assert.ok(FL.V.intRange([1, 3]) && !FL.V.intRange([3, 1]) && !FL.V.intRange([1.5, 2]));
    assert.ok(FL.V.range([0.5, 1]) && !FL.V.range([1]));
    assert.ok(FL.V.unit(0) && FL.V.unit(1) && !FL.V.unit(1.1));
    assert.ok(FL.V.obj({}) && !FL.V.obj([]) && !FL.V.obj(null));
  });
});

describe('Crossovers: lead bonuses', () => {
  it('each type gets its own row; unknown and missing types give the zero row', () => {
    assert.equal(FL.bonusForTypes(['Brine']).biteWindowMult, 1.5);
    assert.equal(FL.bonusForTypes(['Gust']).shakeAllFruit, true);
    assert.equal(FL.bonusForTypes(['Stone']).extraCracks, 1);
    assert.equal(FL.bonusForTypes(['Glass']).skyglassSeeRadius, 5);
    assert.equal(FL.bonusForTypes(['Hollow']).skyglassByDay, true);
    assert.equal(FL.bonusForTypes(['Bolt']).humRadius, 4);
    assert.equal(FL.bonusForTypes(['Moss']).graftNightsSooner, 1);
    assert.equal(FL.bonusForTypes(['Rime']).extraShadows, 1);
    assert.equal(FL.bonusForTypes(['Kiln']).cleanFindsPerDay, 1);
    assert.deepEqual({ ...FL.bonusForTypes(['Plain']) }, { ...FL.NO_BONUS });
    assert.deepEqual({ ...FL.bonusForTypes([]) }, { ...FL.NO_BONUS });
    assert.deepEqual({ ...FL.bonusForTypes(null) }, { ...FL.NO_BONUS });
  });
  it('dual types merge (max numbers, OR booleans), case-insensitively and order-independently', () => {
    const a = FL.bonusForTypes(['Brine', 'Stone']);
    const b = FL.bonusForTypes(['stone', 'BRINE']);
    assert.equal(a, b, 'same cached row');
    assert.equal(a.fishNameSpecies, true);
    assert.equal(a.markCracks, true);
    assert.equal(a.extraCracks, 1);
    assert.equal(a.biteWindowMult, 1.5);
  });
  it('reads a custom table from ctx.tuning', () => {
    const ctx = { tuning: { creatureBonuses: { plain: { extraShadows: 3 } } } };
    assert.equal(FL.bonusForTypes(['Plain'], ctx).extraShadows, 3);
    assert.equal(FL.bonusForTypes(['Brine'], ctx).biteWindowMult, 1, 'the custom table replaces the default one');
  });
  it('the party lead decides: first alive member, ctx.lead overrides, null = no lead', () => {
    const w = makeWorld();
    assert.equal(FL.leadBonuses(w).fishNameSpecies, false, 'empty party');
    w.party.push(creatureOf('c1', ['Gust'], 0), creatureOf('c2', ['Brine']));
    assert.equal(FL.leadBonuses(w).fishNameSpecies, true, 'fainted first member is skipped');
    assert.equal(FL.leadBonuses(w).shakeAllFruit, false);
    assert.equal(FL.leadBonuses(w, { lead: { types: ['Gust'] } }).shakeAllFruit, true);
    assert.equal(FL.leadBonuses(w, NONE).fishNameSpecies, false);
    assert.equal(FL.leadOf(w, NONE), null);
  });
});

describe('forms: Seen / Read / Held', () => {
  it('markSeen records once and emits once', () => {
    const w = makeWorld();
    const { bus, events } = recordingBus();
    assert.deepEqual(FL.markSeen(w, 'form-a', { bus }), { formId: 'form-a', first: true });
    assert.deepEqual(FL.markSeen(w, 'form-a', { bus }), { formId: 'form-a', first: false });
    assert.deepEqual(events, [['fieldLog:seen', { formId: 'form-a', first: true }]]);
    assert.deepEqual(w.fieldLog.forms['form-a'], { seen: true, read: false, held: false, ability: null });
    assert.throws(() => FL.markSeen(w, ''), /non-empty/);
    assert.throws(() => FL.markSeen(w, 3), /non-empty/);
  });
  it('markRead implies Seen and records the ability: argument > per-seed pick > species row > previous', () => {
    const w = makeWorld();
    const { bus, events } = recordingBus();
    assert.deepEqual(FL.markRead(w, 'form-a', 'ab-x', { bus, data: DATA }), { formId: 'form-a', first: true, ability: 'ab-x' });
    assert.deepEqual(w.fieldLog.forms['form-a'], { seen: true, read: true, held: false, ability: 'ab-x' });
    w.run.gen.abilities['form-b'] = 'seeded-b';
    assert.equal(FL.markRead(w, 'form-b', null, { data: DATA }).ability, 'seeded-b');
    assert.equal(FL.markRead(w, 'form-c', null, { data: DATA }).ability, 'ab-c');
    assert.equal(FL.markRead(w, 'unknown-form', null, { data: DATA }).ability, null);
    // re-Read with nothing new: no event
    events.length = 0;
    const again = FL.markRead(w, 'form-a', 'ab-x', { bus, data: DATA });
    assert.equal(again.first, false);
    assert.deepEqual(events, []);
    FL.markRead(w, 'form-a', 'ab-y', { bus });
    assert.deepEqual(events, [['fieldLog:read', { formId: 'form-a', first: false, ability: 'ab-y' }]]);
  });
  it('markHeld implies Seen (not Read) and emits once', () => {
    const w = makeWorld();
    const { bus, events } = recordingBus();
    assert.equal(FL.markHeld(w, 'form-b', { bus }).first, true);
    assert.equal(FL.markHeld(w, 'form-b', { bus }).first, false);
    assert.deepEqual(w.fieldLog.forms['form-b'], { seen: true, read: false, held: true, ability: null });
    assert.equal(events.length, 1);
  });
  it('formEntry is read-only for unknown forms', () => {
    const w = makeWorld();
    const e = FL.formEntry(w, 'nope');
    assert.deepEqual({ ...e }, { seen: false, read: false, held: false, ability: null });
    assert.ok(Object.isFrozen(e));
    assert.deepEqual(w.fieldLog.forms, {});
  });
});

describe('collections', () => {
  it('recordFish counts, keeps the best size and flags records', () => {
    const w = makeWorld();
    const { bus, events } = recordingBus();
    const a = FL.recordFish(w, 'fish-a', 12.5, {}, { ...NONE, bus });
    assert.deepEqual([a.n, a.first, a.best, a.record, a.tellLearned], [1, true, 12.5, true, false]);
    const b = FL.recordFish(w, 'fish-a', 11, {}, NONE);
    assert.deepEqual([b.n, b.first, b.best, b.record], [2, false, 12.5, false]);
    assert.deepEqual(w.collections.fish['fish-a'], { n: 2, best: 12.5 });
    assert.deepEqual(events[0], ['fieldLog:fish', { id: 'fish-a', first: true, size: 12.5, best: 12.5, record: true, patient: false }]);
    assert.throws(() => FL.recordFish(w, 'fish-a', -1), /size/);
    assert.throws(() => FL.recordFish(w, 'fish-a', NaN), /size/);
    assert.throws(() => FL.recordFish(w, '', 1), /fish id/);
  });
  it('learns a tell after 3 catches, or 1 with a Brine lead (GDD-00 §9 Crossovers)', () => {
    const w = makeWorld();
    const { bus, events } = recordingBus();
    FL.recordFish(w, 'fish-a', 10, {}, NONE);
    assert.equal(FL.tellCatchesLeft(w, 'fish-a', NONE), 2);
    FL.recordFish(w, 'fish-a', 10, {}, NONE);
    assert.equal(FL.tellLearned(w, 'fish-a'), false);
    const third = FL.recordFish(w, 'fish-a', 10, {}, { ...NONE, bus });
    assert.equal(third.tellNew, true);
    assert.equal(FL.tellLearned(w, 'fish-a'), true);
    assert.equal(FL.tellCatchesLeft(w, 'fish-a'), 0);
    assert.deepEqual(events.at(-1), ['fieldLog:tell', { id: 'fish-a' }]);
    const fourth = FL.recordFish(w, 'fish-a', 10, {}, NONE);
    assert.deepEqual([fourth.tellNew, fourth.tellLearned], [false, true]);
    assert.equal(w.fieldLog.tells['fish-a'], 1);

    const w2 = makeWorld();
    assert.equal(FL.tellCatchesLeft(w2, 'fish-b', BRINE), 1);
    assert.equal(FL.recordFish(w2, 'fish-b', 40, {}, BRINE).tellNew, true);
    // an explicit threshold wins; a tuning override changes the base
    const w3 = makeWorld();
    assert.equal(FL.recordFish(w3, 'fish-b', 40, { tellCatches: 2 }, NONE).tellNew, false);
    assert.equal(FL.recordFish(w3, 'fish-b', 40, { tellCatches: 2 }, NONE).tellNew, true);
    const w4 = makeWorld();
    assert.equal(FL.recordFish(w4, 'fish-b', 40, {}, { ...NONE, tuning: { fishTellCatches: 1 } }).tellNew, true);
  });
  it('Patient catches keep their own record board', () => {
    const w = makeWorld();
    const a = FL.recordFish(w, 'fish-b', 30, { patient: true }, NONE);
    assert.equal(a.patientRecord, true);
    assert.equal(w.collections.patientBest['fish-b'], 30);
    FL.recordFish(w, 'fish-b', 45, {}, NONE);
    assert.equal(w.collections.patientBest['fish-b'], 30, 'a Standard catch does not touch the Patient board');
    assert.equal(FL.recordFish(w, 'fish-b', 29, { patient: true }, NONE).patientRecord, false);
    assert.equal(FL.recordFish(w, 'fish-b', 31, { patient: true }, NONE).patientRecord, true);
    assert.equal(w.collections.patientBest['fish-b'], 31);
    assert.equal(w.collections.fish['fish-b'].best, 45);
  });
  it('recordBug and recordFind count and report first', () => {
    const w = makeWorld();
    const { bus, events } = recordingBus();
    assert.deepEqual(FL.recordBug(w, 'bug-a', { bus }), { id: 'bug-a', n: 1, first: true });
    assert.deepEqual(FL.recordBug(w, 'bug-a'), { id: 'bug-a', n: 2, first: false });
    assert.deepEqual(FL.recordFind(w, 'fossil-a', { bus }), { id: 'fossil-a', n: 1, first: true });
    assert.deepEqual(w.collections.relics['fossil-a'], { n: 1, cleaned: false });
    assert.deepEqual(events.map((e) => e[0]), ['fieldLog:bug', 'fieldLog:find']);
    assert.equal(FL.collectedCount(w, 'bug-a'), 2);
    assert.equal(FL.collectedCount(w, 'nope'), 0);
    assert.throws(() => FL.recordBug(w, null), /bug id/);
    assert.throws(() => FL.recordFind(w, ''), /find id/);
  });
});

describe('Barnaby: donations, duplicates, the string wall, the Kiln clean', () => {
  it('donate needs a collected, undonated specimen in the bag', () => {
    const w = makeWorld();
    const taken = [];
    const take = (id, n) => { taken.push([id, n]); return true; };
    assert.deepEqual(FL.donate(w, 'fossil-a', { take }), { ok: false, id: 'fossil-a', reason: 'not-collected' });
    FL.recordFind(w, 'fossil-a');
    assert.deepEqual(FL.donate(w, 'fossil-a', { take: () => false }), { ok: false, id: 'fossil-a', reason: 'not-in-bag' });
    const { bus, events } = recordingBus();
    assert.deepEqual(FL.donate(w, 'fossil-a', { take, bus }), { ok: true, id: 'fossil-a' });
    assert.deepEqual(taken, [['fossil-a', 1]]);
    assert.deepEqual(events, [['fieldLog:donated', { id: 'fossil-a' }]]);
    assert.equal(FL.isDonated(w, 'fossil-a'), true);
    assert.deepEqual(FL.donate(w, 'fossil-a'), { ok: false, id: 'fossil-a', reason: 'already-donated' });
    FL.recordFish(w, 'fish-a', 10, {}, NONE);
    assert.equal(FL.donate(w, 'fish-a').ok, true, 'fish donate too; no take callback = nothing to refuse');
  });
  it('sellDuplicates only after donating; archivePrice, the clean multiplier, earn and take', () => {
    const w = makeWorld();
    const earned = [];
    const ctx = { data: DATA, earn: (a, s) => earned.push([a, s]), take: () => true };
    FL.recordFind(w, 'sky-a');
    assert.equal(FL.sellDuplicates(w, 'sky-a', 1, {}, ctx).reason, 'not-donated');
    FL.donate(w, 'sky-a');
    assert.deepEqual(FL.sellDuplicates(w, 'sky-a', 2, {}, ctx), { ok: true, id: 'sky-a', n: 2, amount: 1800 });
    FL.recordFind(w, 'fossil-a');
    FL.donate(w, 'fossil-a');
    assert.equal(FL.sellDuplicates(w, 'fossil-a', 1, { cleaned: true }, ctx).amount, 840);
    assert.deepEqual(earned, [[1800, 'archive'], [840, 'archive']]);
    assert.equal(FL.sellDuplicates(w, 'fossil-a', 0, {}, ctx).reason, 'bad-count');
    assert.equal(FL.sellDuplicates(w, 'fossil-a', 1.5, {}, ctx).reason, 'bad-count');
    assert.equal(FL.sellDuplicates(w, 'fossil-a', 1, {}, { ...ctx, take: () => false }).reason, 'not-in-bag');
    w.collections.donated.push('ghost');
    assert.equal(FL.sellDuplicates(w, 'ghost', 1, {}, ctx).reason, 'unknown');
  });
  it('pinFind checks the find, then hands it to letters.pinFind (which owns world.letters.pinned)', () => {
    const w = makeWorld();
    const lettersPin = (id) => { w.letters.pinned.push(id); return { ok: true, letter: 17, lateDelivery: false }; };
    assert.equal(FL.pinFind(w, 'fossil-a', { pinFind: lettersPin }).reason, 'not-a-find');
    FL.recordFind(w, 'fossil-a');
    assert.equal(FL.pinFind(w, 'fossil-a', { pinFind: lettersPin }).reason, 'not-donated');
    FL.donate(w, 'fossil-a');
    assert.equal(FL.pinFind(w, 'fossil-a').reason, 'no-wall');
    assert.equal(FL.pinFind(w, 'fossil-a', { pinFind: () => ({ ok: false, reason: 'x' }) }).reason, 'refused');
    assert.equal(FL.pinFind(w, 'fossil-a', { pinFind: () => false }).reason, 'refused');
    const { bus, events } = recordingBus();
    assert.deepEqual(FL.pinFind(w, 'fossil-a', { pinFind: lettersPin, bus }), { ok: true, id: 'fossil-a', letter: 17 });
    assert.deepEqual(events, [['fieldLog:pinned', { id: 'fossil-a', letter: 17 }]]);
    assert.equal(FL.isPinned(w, 'fossil-a'), true);
    assert.equal(FL.pinFind(w, 'fossil-a', { pinFind: lettersPin }).reason, 'already-pinned');
    FL.recordFind(w, 'relic-a');
    FL.donate(w, 'relic-a');
    assert.deepEqual(FL.pinFind(w, 'relic-a', { pinFind: () => undefined }), { ok: true, id: 'relic-a', letter: null });
    assert.deepEqual(FL.pinFind(w, 'shore-a', { pinFind: () => 3 }).ok, false);
  });
  it('kilnClean: Kiln lead only, fossils only, once per day', () => {
    const w = makeWorld();
    const KILN = { lead: { types: ['Kiln'] }, data: DATA };
    assert.equal(FL.kilnClean(w, 'fossil-a', { ...KILN, lead: null }).reason, 'no-kiln-lead');
    assert.equal(FL.kilnClean(w, 'fossil-a', KILN).reason, 'not-a-find');
    FL.recordFind(w, 'fossil-a');
    FL.recordFind(w, 'relic-a');
    assert.equal(FL.kilnClean(w, 'relic-a', KILN).reason, 'not-cleanable');
    const { bus, events } = recordingBus();
    assert.deepEqual(FL.kilnClean(w, 'fossil-a', { ...KILN, day: 3, bus }), { ok: true, id: 'fossil-a', mult: 1.4 });
    assert.equal(w.collections.relics['fossil-a'].cleaned, true);
    assert.equal(w.collections.cleanedDay, 3);
    assert.deepEqual(events, [['fieldLog:cleaned', { id: 'fossil-a', mult: 1.4 }]]);
    assert.equal(FL.kilnClean(w, 'fossil-a', { ...KILN, day: 3 }).reason, 'used-today');
    assert.equal(FL.kilnClean(w, 'fossil-a', { ...KILN, day: 4 }).ok, true);
    // without a data row the find is assumed cleanable; day defaults to the clock
    FL.recordFind(w, 'mystery');
    assert.equal(FL.kilnClean(w, 'mystery', { lead: { types: ['Kiln'] } }).ok, true);
    assert.equal(w.collections.cleanedDay, 1);
    assert.deepEqual(validateWorld(w), []);
  });
});

describe('completion', () => {
  it('counts forms, fish, bugs, finds, tells and donations against the data', () => {
    const w = makeWorld();
    let c = FL.completion(w, DATA);
    assert.deepEqual(c.forms.held, { have: 0, total: 6, pct: 0 }, 'log:false species excluded');
    assert.equal(c.finds.total, 5, 'cockle excluded');
    assert.equal(c.fish.total, 3);
    assert.equal(c.bugs.total, 3);
    assert.equal(c.overall, 0);
    FL.markSeen(w, 'form-a');
    FL.markRead(w, 'form-b', null, { data: DATA });
    FL.markHeld(w, 'form-c');
    FL.markHeld(w, 'hidden');
    FL.markHeld(w, 'not-in-data');
    FL.recordFish(w, 'fish-a', 10, {}, BRINE);
    FL.recordBug(w, 'bug-a');
    FL.recordFind(w, 'fossil-a');
    FL.recordFind(w, 'cockle');
    FL.donate(w, 'fossil-a');
    c = FL.completion(w, DATA);
    assert.deepEqual(c.forms.seen, { have: 3, total: 6, pct: 50 });
    assert.deepEqual(c.forms.read, { have: 1, total: 6, pct: 16 });
    assert.deepEqual(c.forms.held, { have: 1, total: 6, pct: 16 });
    assert.deepEqual(c.fish, { have: 1, total: 3, pct: 33 });
    assert.deepEqual(c.tells, { have: 1, total: 3, pct: 33 });
    assert.deepEqual(c.finds, { have: 1, total: 5, pct: 20 });
    assert.deepEqual(c.donated, { have: 1, total: 11, pct: 9 });
    assert.equal(c.overall, Math.floor(((1 / 6 + 1 / 3 + 1 / 3 + 1 / 5) / 4) * 100));
  });
  it('reaches 100 only when complete and never rounds up to it', () => {
    const data = { species: [{ id: 's1' }], collections: [{ id: 'f1', kind: 'fish', price: 1 }] };
    const w = makeWorld();
    FL.markHeld(w, 's1');
    FL.recordFish(w, 'f1', 1, {}, NONE);
    assert.equal(FL.completion(w, data).overall, 100);
    const many = { species: Array.from({ length: 1000 }, (_, i) => ({ id: `s${i}` })) };
    const w2 = makeWorld();
    for (let i = 0; i < 999; i++) FL.markHeld(w2, `s${i}`);
    assert.equal(FL.completion(w2, many).forms.held.pct, 99);
    assert.equal(FL.completion(w2, many).overall, 99);
    assert.equal(FL.completion(makeWorld(), {}).overall, 0, 'no data: nothing to complete');
  });
  it('the world stays valid after every Field Log operation', () => {
    const w = makeWorld();
    FL.markRead(w, 'form-a', null, { data: DATA });
    FL.recordFish(w, 'fish-a', 10.5, { patient: true }, BRINE);
    FL.recordBug(w, 'bug-a');
    FL.recordFind(w, 'fossil-a');
    FL.donate(w, 'fossil-a');
    assert.deepEqual(validateWorld(w), []);
  });
});
