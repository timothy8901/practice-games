// v5 -> v6 (audit MID-06 / MID-08): EXP rebased onto the steeper curve; missing badge gifts handed over.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { migrateWorld } from '../js/state/migrate.js';
import { validateWorld } from '../js/state/schema.js';
import { TUNING } from '../js/data/tuning.js';
import * as exp from '../js/systems/exp.js';

const v5 = () => JSON.parse(fs.readFileSync(new URL('./fixtures/v5.json', import.meta.url), 'utf8'));
const mon = (uid, level, xp) => ({ uid, speciesId: 'sloshkin', formId: 'sloshkin', level, exp: xp });
const floorAt = (L) => exp.expForLevel('medium-slow', L, { tuning: TUNING });

test('a Lv30 creature with old-curve EXP lands inside its Lv30 band on the new curve, keeping its progress', () => {
  const w = v5();
  const base = w.party[0] ?? {};
  w.party = [{ ...base, ...mon('c900', 30, 8 * 30 * 30 + Math.floor((8 * 31 * 31 - 8 * 30 * 30) / 2)) }];
  const out = migrateWorld(w).world.party[0];
  assert.equal(out.level, 30);
  assert.ok(out.exp >= floorAt(30) && out.exp < floorAt(31), `exp ${out.exp} in [${floorAt(30)}, ${floorAt(31)})`);
  const frac = (out.exp - floorAt(30)) / (floorAt(31) - floorAt(30));
  assert.ok(Math.abs(frac - 0.5) < 0.01, `half-way stays half-way (${frac})`);
});

test('creatures at Lv8 and below are untouched (the curve did not change there)', () => {
  const w = v5();
  const base = w.party[0] ?? {};
  w.party = [{ ...base, ...mon('c901', 7, 400) }];
  assert.equal(migrateWorld(w).world.party[0].exp, 400);
});

test('a save holding the weather, relay and mirror badges receives their gifts once', () => {
  const w = v5();
  w.badges = ['turn', 'ward', 'weather', 'hollow', 'relay', 'mirror'];
  const bag = migrateWorld(w).world.bag;
  const count = (id) => Object.values(bag.pockets).flat().filter((s) => s && s.id === id).length;
  assert.equal(count('scouting-prism'), 1);
  assert.equal(count('weatherglass'), 1);
  assert.equal(count('disc-plumbline'), 1);
  const again = migrateWorld({ ...migrateWorld(w).world, v: 5 }).world.bag;
  assert.equal(Object.values(again.pockets).flat().filter((s) => s && s.id === 'weatherglass').length, 1, 'idempotent');
});

test('the migrated fixture validates', () => {
  assert.deepEqual(validateWorld(migrateWorld(v5()).world), []);
});
