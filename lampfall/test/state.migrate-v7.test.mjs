// v6 -> v7 (Real Clock across sessions): clock.realOffset persists the run-relative calendar offset
// so days that pass between sessions count; legacy Real Clock saves (clock.total = the epoch day)
// are rebased onto the run's own day count with every day stamp moved by the same whole days.
// Run: node --test test/state.migrate-v7.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { migrateWorld, isLegacyRealClock, LEGACY_REAL_DAY_MIN } from '../js/state/migrate.js';
import { validateWorld, createNewWorld, SCHEMA_VERSION } from '../js/state/schema.js';
import { createClock, realTimeToTotal } from '../js/core/time.js';
import * as clockSys from '../js/systems/clockSys.js';
import * as loans from '../js/systems/loans.js';
import { TUNING } from '../js/data/tuning.js';

const DAY = 1440;
const v6 = () => JSON.parse(fs.readFileSync(new URL('./fixtures/v6.json', import.meta.url), 'utf8'));

test('the schema is at v7 and a v6 save gains clock.realOffset = null', () => {
  assert.equal(SCHEMA_VERSION, 7);
  const r = migrateWorld(v6());
  assert.equal(r.ok, true);
  assert.equal(r.world.clock.realOffset, null);
  assert.deepEqual(validateWorld(r.world), []);
});

test('a legacy Real Clock save is rebased: clock.total and every day stamp lose the same whole days', () => {
  const w = v6();
  const E = 20_000; // an epoch-day count (2024)
  w.settings.realClock = true;
  w.clock = { ...w.clock, realClock: true, total: E * DAY + 600 };
  w.threads = { 'the-fence': { beat: 2, done: false, startedDay: E - 10, lastAdvancedDay: E - 2 } };
  w.letters = { ...w.letters, keeperDay: E - 1, familyDay: -1 };
  w.npcs = { bryony: { ...(w.npcs?.bryony ?? {}), met: true, lastTalkDay: E - 3, lastPorchDay: -1, saidLines: { 'gen1': E - 5 }, gifts: { timber: { n: 1, lastDay: E - 4 } } } };
  w.loans = { ...w.loans, builds: [{ id: 'gallery', tier: 2, startedDay: E - 1, readyDay: E + 1, choice: null, done: false }] };
  w.flags = { ...w.flags, 'sys.duel.day': E + 1, 'sys.duel.done.wren': E, 'sp.arrived': true };
  w.maps = { ...(w.maps ?? {}), pellwick: { ...(w.maps?.pellwick ?? {}), visited: true, picked: { 'berry:3,4': E - 7 }, trees: {}, cracks: {}, reach: { r1: 0.5 }, reachAt: { r1: (E - 1) * DAY + 30 }, opened: [] } };
  w.wallet = { ...w.wallet, starsaltDay: E - 2 };
  assert.ok(isLegacyRealClock(w.clock));
  const r = migrateWorld(w);
  assert.equal(r.ok, true);
  const out = r.world;
  const D = E - 10; // the earliest stamp lands on day 0
  assert.equal(out.clock.total, 10 * DAY + 600);
  assert.equal(out.clock.realOffset, D * DAY);
  assert.deepEqual(out.threads['the-fence'], { beat: 2, done: false, startedDay: 0, lastAdvancedDay: 8 });
  assert.equal(out.letters.keeperDay, 9);
  assert.equal(out.letters.familyDay, -1, '-1 = never stays');
  assert.equal(out.npcs.bryony.lastTalkDay, 7);
  assert.equal(out.npcs.bryony.lastPorchDay, -1);
  assert.equal(out.npcs.bryony.saidLines.gen1, 5);
  assert.equal(out.npcs.bryony.gifts.timber.lastDay, 6);
  assert.equal(out.loans.builds[0].startedDay, 9);
  assert.equal(out.loans.builds[0].readyDay, 11);
  assert.equal(out.flags['sys.duel.day'], 11);
  assert.equal(out.flags['sys.duel.done.wren'], 10);
  assert.equal(out.flags['sp.arrived'], true);
  assert.equal(out.maps.pellwick.picked['berry:3,4'], 3);
  assert.equal(out.maps.pellwick.reachAt.r1, 9 * DAY + 30);
  assert.equal(out.wallet.starsaltDay, 8);
  assert.equal(isLegacyRealClock(out.clock), false);
  assert.deepEqual(validateWorld(out), []);
  // the saved offset keeps the wall clock on the same run day: a clock restored at the save instant
  // reads the rebased total
  const now = () => (E - 3) * DAY * 60_000; // any instant; realOffset is checked against the wall below
  const clock = createClock({ realClock: true, realRelative: true, now });
  const wall = realTimeToTotal(now());
  assert.ok(wall - out.clock.realOffset < out.clock.total, 'an earlier wall clock re-anchors instead');
  clock.restore(out.clock);
  assert.ok(clock.total === out.clock.total);
  assert.ok(LEGACY_REAL_DAY_MIN > 10_000);
});

test('Real Clock: a reload two real days later advances two game days and lands the pending build', () => {
  const world = createNewWorld({ seedCode: 'REAL-OFFSET' });
  world.settings.realClock = true;
  world.clock.realClock = true;
  let wallMs = Date.UTC(2026, 9, 1, 12, 0, 0);
  const now = () => wallMs;
  const opts = { ...clockSys.optionsFrom(world, { tuning: TUNING }), now, maxCatchUpMinutes: Infinity };
  const clock = createClock(opts);
  clockSys.restoreFrom(world, clock, { tuning: TUNING });
  clockSys.tick(world, clock, 16, {});
  const day0 = Math.floor(world.clock.total / DAY);
  assert.ok(Number.isInteger(world.clock.realOffset), 'serialize writes the offset while Real Clock is on');
  assert.equal(world.clock.realOffset % DAY, 0);
  assert.deepEqual(validateWorld(world), []);
  // a build queued for tomorrow morning
  world.loans.builds.push({ id: 'gallery', tier: 2, startedDay: day0, readyDay: day0 + 1, choice: null, done: false });
  const saved = JSON.parse(JSON.stringify(world));
  // two real days later, a fresh session loads the save
  wallMs += 2 * 86_400_000;
  const clock2 = createClock({ ...opts });
  const loaded = migrateWorld(saved).world;
  const r = clockSys.restoreFrom(loaded, clock2, { tuning: TUNING });
  assert.equal(r.ok, true);
  clockSys.tick(loaded, clock2, 16, {});
  assert.equal(Math.floor(loaded.clock.total / DAY), day0 + 2, 'two game days passed');
  const landed = loans.landDue(loaded, { tuning: TUNING });
  assert.ok(JSON.stringify(landed).includes('gallery'), JSON.stringify(landed));
  // without the offset (a pre-v7 save), the reload re-anchors to the run day: no days pass
  const old = JSON.parse(JSON.stringify(saved));
  delete old.clock.realOffset;
  const clock3 = createClock({ ...opts });
  clockSys.restoreFrom(old, clock3, { tuning: TUNING });
  clockSys.tick(old, clock3, 16, {});
  assert.ok(Math.floor(old.clock.total / DAY) <= day0 + 1);
});

test('a wall clock set back before the save re-anchors instead of running the clock backwards', () => {
  let wallMs = Date.UTC(2026, 9, 10, 9, 0, 0);
  const now = () => wallMs;
  const clock = createClock({ realClock: true, realRelative: true, now, startDay: 5 });
  const state = clock.serialize();
  assert.equal(typeof state.realOffset, 'number');
  wallMs -= 3 * 86_400_000;
  const c2 = createClock({ realClock: true, realRelative: true, now });
  c2.restore(state);
  c2.update(16);
  assert.ok(c2.total >= state.total, 'never backwards');
  // a non-real clock never writes the offset
  assert.equal('realOffset' in createClock().serialize(), false);
});

test('a legacy Real Clock save rebases the day-valued flags too: the Relighting still comes due', () => {
  const w = v6();
  const E = 20_000;
  w.settings.realClock = true;
  w.clock = { ...w.clock, realClock: true, total: E * DAY + 600 };
  w.threads = { 'the-fence': { beat: 1, done: false, startedDay: E - 4, lastAdvancedDay: E - 4 } };
  // the last loan paid and the Lamp Room landed: the Relighting is due at tomorrow's dusk
  w.flags = { ...w.flags, 'sys.relighting-due': E + 1, 'sp.late-delivery': E - 6, 'sys.duel.visitor-fought': E + 1, 'sys.duel.visitor': 'lowmoor-osier', 'sp.arrived': true };
  const r = migrateWorld(w);
  assert.equal(r.ok, true);
  const out = r.world;
  const D = E - 6; // the Late Delivery day is the earliest stamp
  assert.equal(out.clock.total, 6 * DAY + 600);
  assert.equal(out.clock.realOffset, D * DAY);
  assert.equal(out.flags['sys.relighting-due'], 7, 'the Relighting dusk day moves with the clock');
  assert.equal(out.flags['sp.late-delivery'], 0);
  assert.equal(out.flags['sys.duel.visitor-fought'], 7);
  assert.equal(out.flags['sys.duel.visitor'], 'lowmoor-osier', 'string flags stay');
  assert.equal(out.flags['sp.arrived'], true);
  assert.equal(out.threads['the-fence'].startedDay, 2);
  assert.deepEqual(validateWorld(out), []);
  // tomorrow's dusk on the rebased clock fires it (left on the epoch count it never would)
  const relightMinute = TUNING.relightMinute ?? 18 * 60;
  assert.equal(loans.relightingDue(out, { tuning: TUNING, now: 7 * DAY + relightMinute }), true);
  assert.equal(loans.relightingDue(out, { tuning: TUNING, now: 6 * DAY + 700 }), false);
});
