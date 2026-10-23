// GDD-03 creatures: js/data/types.js, js/data/abilities.js, js/data/species/*. Validates the
// chapter's tables with tools/validate-data.mjs (zero errors for types, abilities, species,
// families) and checks them complete against js/data/ids.manifest.js; references into tables other
// chapters own (moves) are checked against the manifest id lists. Run: node --test test/data.creatures.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DATA } from '../js/data/index.js';
import * as M from '../js/data/ids.manifest.js';
import { validateData, checkManifest } from '../tools/validate-data.mjs';
import { HOOKS } from '../js/battle/abilityHooks.js';
import { getAbilityRuntime, abilityProblems } from '../js/battle/abilityHooks.js';
import { createBattleData } from '../js/battle/data.js';
import { TYPES, TYPE_CHART, TYPE_TABLE, ORDINARY_TYPES, TYPE_NAMES } from '../js/data/types.js';
import { ABILITIES } from '../js/data/abilities.js';
import { SPECIES, FAMILIES, canBeTaught, learnableAt } from '../js/data/species/index.js';
import { SPRITES } from '../proto/creatures/sprites.js';

const MINE = ['types', 'abilities', 'species', 'families'];
const DIALS = ['drift', 'flux', 'freefall'];
const byId = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
const famById = Object.fromEntries(FAMILIES.map((f) => [f.id, f]));

/** Minimal valid rows for the moves table (owned by GDD-04) so learnset references resolve. */
const STUB_MOVES = M.MOVE_IDS.map((id) => ({
  id, name: id, type: null, category: 'status', power: 0, accuracy: null,
  pp: id === 'scrap' ? null : 10, priority: 0, effect: id === 'scrap' ? { scrap: true } : {}, text: id,
}));

const data = { ...DATA, types: TYPES, abilities: ABILITIES, species: SPECIES, families: FAMILIES, moves: STUB_MOVES };
const mineOnly = (lines) => lines.filter((l) => MINE.some((t) => l.startsWith(`${t}:`)));

test('validateData: zero errors in the creature tables', () => {
  const { errors, warnings } = validateData(data, { hooks: new Set(Object.keys(HOOKS)), tuning: { wardCount: 3 } });
  assert.deepEqual(mineOnly(errors), []);
  const mineWarn = mineOnly(warnings).filter((w) => !w.startsWith('species:*: art/creatures not present'));
  assert.deepEqual(mineWarn, []);
});

test('checkManifest: types, abilities, species and families are complete with no extras', () => {
  const manifest = Object.fromEntries(MINE.map((t) => [t, M.MANIFEST[t]]));
  const { warnings, notes } = checkManifest(data, manifest);
  assert.deepEqual(warnings, []);
  assert.deepEqual(notes, []);
  assert.deepEqual(SPECIES.map((s) => s.id), [...M.SPECIES_IDS], 'species in Field Log order');
  assert.deepEqual(FAMILIES.map((f) => f.id), [...M.FAMILY_IDS]);
  assert.deepEqual(ABILITIES.map((a) => a.id).sort(), [...M.ABILITY_IDS].sort());
  assert.deepEqual(TYPES.map((t) => t.id), [...M.TYPE_IDS]);
});

test('every reference into other chapters resolves against the manifest', () => {
  const moves = new Set(M.MOVE_IDS);
  for (const s of SPECIES) {
    for (const [lv, mv] of s.learnset) { assert.ok(moves.has(mv), `${s.id} learns unknown ${mv}`); assert.ok(lv >= 1 && lv <= 100); }
    if (s.heartmark !== null) assert.ok(s.learnset.some((r) => r[1] === s.heartmark), `${s.id} heartmark not in learnset`);
    for (const mv of s.flags.teachable ?? []) assert.ok(Object.values(M.DISC_MOVES).includes(mv), `${s.id} teachable ${mv} is not a disc move`);
    assert.equal(M.SPECIES_FAMILY[s.id], s.familyId, `${s.id} family`);
  }
  for (const [mv, spId] of Object.entries(M.SIGNATURES)) assert.ok(byId[spId].learnset.some((r) => r[1] === mv), `${spId} must learn signature ${mv}`);
});

test('GDD-00 §8 roster: types, stages and the four Ward forms', () => {
  const want = {
    puddlepip: [['Brine'], 0], sloshkin: [['Brine'], 1], siltback: [['Brine', 'Stone'], 2], skeinwing: [['Brine', 'Gust'], 2], bogmonarch: [['Brine', 'Stone'], 3],
    scrapling: [['Grit'], 1], mudfist: [['Grit'], 1], knuckleback: [['Grit'], 2], cragmitt: [['Grit', 'Stone'], 3],
    reedkit: [['Moss'], 1], rushling: [['Moss', 'Brine'], 1], sedgehare: [['Moss'], 2],
    mothling: [['Glass'], 1], prismoth: [['Glass', 'Gust'], 2], cairnward: [['Stone', 'Glass'], 2], lumenveil: [['Glass'], 3],
    rayling: [['Brine'], 1], vesperay: [['Brine', 'Glass'], 2], bilgebob: [['Brine'], 1], brinelance: [['Brine', 'Rime'], 2],
    rustcreel: [['Rust'], 1], creelwight: [['Hollow', 'Rust'], 2], hulkwight: [['Hollow', 'Rust'], 3],
    wirewhisk: [['Bolt'], 1], coilcrest: [['Bolt', 'Gust'], 2], chillnub: [['Rime'], 1], rimeplate: [['Rime', 'Stone'], 2], floeback: [['Rime', 'Stone'], 3],
    sootling: [['Kiln'], 1], emberjaw: [['Kiln'], 2], caldermaw: [['Kiln', 'Stone'], 3], rillfin: [['Brine'], 1], gillwick: [['Brine', 'Moss'], 2], strandrunner: [['Brine', 'Gust'], 3],
    tossup: [['Plain'], 1], squallcoil: [['Bolt', 'Brine'], 4], hailcoil: [['Rime', 'Gust'], 4], skirl: [['Gust'], 1], duskwisp: [['Hollow'], 1], duskowl: [['Hollow', 'Gust'], 2],
    stillox: [['Stone'], 4], vagary: [['Star'], 4],
  };
  for (const [id, [types, stage]] of Object.entries(want)) {
    assert.deepEqual(byId[id].types, types, `${id} types`);
    assert.equal(byId[id].stage, stage, `${id} stage`);
  }
  const wardAbilities = new Set(ABILITIES.filter((a) => a.ward).map((a) => a.id));
  assert.deepEqual([...wardAbilities].sort(), ['glasshide', 'mirrorveil', 'stillcoat']);
  assert.deepEqual(SPECIES.filter((s) => wardAbilities.has(s.ability)).map((s) => s.id).sort(), ['cairnward', 'chillnub', 'lumenveil', 'prismoth']);
  assert.equal(byId.prismoth.ability, 'glasshide');
  assert.equal(byId.puddlepip.ability, 'shoresense', 'GDD-ids ruling 4');
  assert.equal(byId.prismoth.flags.hpMultiplier, 0.25);
  for (const id of ['stillox', 'vagary']) assert.equal(byId[id].flags.neverShifts, true);
  for (const id of ['squallcoil', 'hailcoil']) assert.equal(byId[id].flags.errant, true);
  assert.equal(byId.vagary.flags.neverOnForecast, true);
  assert.equal(byId.skeinwing.flags.shiftOnly, true);
});

test('abilities: hook keys exist, rows pass the battle contract, Wards carry their kind', () => {
  for (const a of ABILITIES) {
    assert.deepEqual(abilityProblems(a), [], a.id);
    if (a.hook !== null) assert.ok(a.hook in HOOKS, `${a.id} hook ${a.hook}`);
    assert.doesNotThrow(() => getAbilityRuntime(a), a.id);
    assert.ok(typeof a.text === 'string' && a.text.length > 10, `${a.id} text`);
    if (a.nightHook) assert.ok(a.nightHook.hook in HOOKS, `${a.id} nightHook`);
  }
  const ab = Object.fromEntries(ABILITIES.map((a) => [a.id, a]));
  assert.equal(ab.stillcoat.ward.minPower, 50);
  assert.equal(getAbilityRuntime(ab['last-ebb']).hooks.onAttackMult({ hpRatio: 0.2, moveType: 'Hollow' }), 1.3);
  assert.equal(getAbilityRuntime(ab.tidecall).hooks.onAttackMult({ moveType: 'Brine' }), 1.2);
  const night = getAbilityRuntime({ ...ab.dusksight, hook: ab.dusksight.nightHook.hook, hookParams: ab.dusksight.nightHook.hookParams });
  assert.equal(night.hooks.onAttackMult({ moveType: 'Gust' }), 1.2);
});

test('types: the chart as written (56 pairings, one immunity, Star neutral) and type colour keys', () => {
  let n = 0;
  for (const a of TYPE_NAMES) for (const d of TYPE_NAMES) if (TYPE_CHART[a][d] !== 1) n++;
  assert.equal(n, 56);
  const zeros = [];
  for (const a of TYPE_NAMES) for (const d of TYPE_NAMES) if (TYPE_CHART[a][d] === 0) zeros.push(`${a}>${d}`);
  assert.deepEqual(zeros, ['Plain>Hollow', 'Grit>Hollow']);
  for (const t of TYPE_NAMES) { assert.equal(TYPE_CHART.Star[t], 1); assert.equal(TYPE_CHART[t].Star, 1); }
  assert.equal(ORDINARY_TYPES.length, 12);
  const keys = TYPES.map((t) => t.paletteKey);
  assert.deepEqual(keys, ['v', 'u', 'b', 'o', 'g', 'y', 's', 'w', 'e', 'r', 'i', 'p', 'd']);
  assert.ok(!keys.includes('m'), 'comet magenta never on a type badge');
});

test('the battle view accepts these tables (species, abilities, chart)', () => {
  const view = createBattleData({ species: SPECIES, moves: STUB_MOVES, abilities: ABILITIES, types: TYPE_TABLE });
  const probs = view.problems().filter((p) => !/move/.test(p));
  assert.deepEqual(probs, []);
  assert.equal(view.chart.effectiveness('Kiln', ['Glass', 'Gust']).mult, 2);
  assert.equal(view.chart.effectiveness('Bolt', ['Brine', 'Gust']).mult, 4);
  assert.equal(view.species('caldermaw').familyId, 'caldermaw');
});

test('stage ladder: base totals sit on the ladder (documented exceptions only)', () => {
  const total = (s) => Object.values(s.base).reduce((a, b) => a + b, 0);
  const range = { 0: [270, 290], 1: [300, 355], 2: [420, 470], 3: [495, 525] };
  const exceptions = new Set(['vesperay']); // two-form line: its top carries a stage-3 total (prototype value)
  for (const s of SPECIES) {
    const t = total(s);
    if (s.stage === 4) assert.ok([520, 580, 600].includes(t), `${s.id} apex total ${t}`);
    else if (!exceptions.has(s.id)) assert.ok(t >= range[s.stage][0] && t <= range[s.stage][1], `${s.id} stage ${s.stage} total ${t}`);
  }
  assert.equal(total(byId.vesperay), 520);
});

test('Shift tables: every shifting form has a row; per-dial weights; Freefall flattened; windows 8/20/34', () => {
  for (const f of FAMILIES) {
    const forms = SPECIES.filter((s) => s.familyId === f.id);
    if (f.single) {
      assert.deepEqual(Object.keys(f.shiftTable), []);
      assert.equal(f.star, null);
      for (const s of forms) assert.equal(s.flags.neverShifts, true);
      continue;
    }
    assert.deepEqual(f.windows, [8, 20, 34], `${f.id} windows`);
    assert.ok(forms.some((s) => s.id === f.star), `${f.id} star form`);
    assert.ok(f.starPalette && Object.keys(f.starPalette).length > 0, `${f.id} star palette`);
    for (const k of Object.values(f.starPalette)) assert.notEqual(k, 'm', `${f.id} Star-touched never uses magenta`);
    for (const s of forms) {
      const row = f.shiftTable[s.id];
      assert.ok(row, `${f.id} has no row for ${s.id}`);
      for (const dir of ['up', 'side', 'down']) {
        const pool = row[dir];
        const ff = new Set(pool.map((e) => e.w.freefall));
        if (pool.length) assert.equal(ff.size, 1, `${s.id}.${dir}: Freefall weights must be equal (flattened)`);
        for (const e of pool) {
          assert.ok(byId[e.form], `${s.id}.${dir} -> ${e.form}`);
          assert.notEqual(e.form, s.id, `${s.id}.${dir} names itself`);
          for (const d of DIALS) assert.ok(Number.isFinite(e.w[d]) && e.w[d] >= 0);
          assert.ok(!byId[e.form].flags.neverShifts && !byId[e.form].flags.neverOnForecast, `${s.id}.${dir} -> ${e.form} cannot be a Forecast card`);
        }
        const seen = new Set(pool.map((e) => e.form));
        assert.equal(seen.size, pool.length, `${s.id}.${dir} duplicates`);
      }
      // every dial shows a Side card, and Up or Down exists
      for (const d of DIALS) assert.ok(row.side.some((e) => e.w[d] > 0), `${s.id} side empty on ${d}`);
      assert.ok(row.up.length + row.down.length > 0, `${s.id} has neither Up nor Down`);
      // directions follow stage: Up forms are never a lower stage, Down never higher
      for (const e of row.up) assert.ok(byId[e.form].stage >= s.stage, `${s.id} up -> ${e.form} is lower stage`);
      for (const e of row.down) assert.ok(byId[e.form].stage <= s.stage, `${s.id} down -> ${e.form} is higher stage`);
    }
  }
});

test('Sloshkin pools are the source table (GDD-00 §8, wildshift-creatures §6.2)', () => {
  const row = famById.sloshkin.shiftTable.sloshkin;
  const flat = (pool) => Object.fromEntries(pool.map((e) => [e.form, [e.w.drift, e.w.flux, e.w.freefall]]));
  assert.deepEqual(flat(row.up), { siltback: [70, 45, 25], skeinwing: [20, 25, 25], bogmonarch: [10, 15, 25], lumenveil: [0, 15, 25] });
  assert.deepEqual(flat(row.side), { mudfist: [50, 50, 50], rushling: [50, 50, 50] });
  assert.deepEqual(flat(row.down), { puddlepip: [100, 70, 50], chillnub: [0, 30, 50] });
  assert.equal(famById.sloshkin.star, 'sloshkin');
  // Bilgebob's Up card holds Brinelance at 6 of 100 on Flux
  const up = famById.bilgebob.shiftTable.bilgebob.up;
  const fluxTotal = up.reduce((a, e) => a + e.w.flux, 0);
  assert.equal(fluxTotal, 100);
  assert.equal(up.find((e) => e.form === 'brinelance').w.flux, 6);
  // Scrapling's forward line holds 70 of 100 Up weight on Drift
  const sup = famById.scrapling.shiftTable.scrapling.up;
  assert.equal(sup.filter((e) => ['knuckleback', 'cragmitt'].includes(e.form)).reduce((a, e) => a + e.w.drift, 0), 70);
  assert.equal(sup.reduce((a, e) => a + e.w.drift, 0), 100);
  // Errants: Down never a hatchling on Drift or Flux
  for (const id of ['squallcoil', 'hailcoil']) {
    for (const e of famById.errant.shiftTable[id].down) if (byId[e.form].stage === 0 || byId[e.form].flags.hatchling) { assert.equal(e.w.drift, 0); assert.equal(e.w.flux, 0); }
  }
});

test('Tossup: one form per type per card, split evenly on every dial', () => {
  const row = famById.tossup.shiftTable.tossup;
  for (const dir of ['up', 'side']) {
    assert.equal(row[dir].length, 12, dir);
    assert.ok(row[dir].every((e) => e.w.drift === 1 && e.w.flux === 1 && e.w.freefall === 1));
  }
  const upTypes = new Set(row.up.flatMap((e) => byId[e.form].types));
  for (const t of ORDINARY_TYPES.filter((t) => t !== 'Plain')) assert.ok(upTypes.has(t), `tossup Up misses ${t}`);
  assert.equal(byId.tossup.heartmark, null);
  assert.equal(byId.tossup.expYield, 50, 'GDD-00 §8 EXP check: the Lv4 Tossup catch gives 40');
});

test('Heartmark: every form but Tossup, Stillox and the Vagary carries a technique it can learn', () => {
  for (const s of SPECIES) {
    if (['tossup', 'stillox', 'vagary'].includes(s.id)) { assert.equal(s.heartmark, null, s.id); continue; }
    assert.ok(typeof s.heartmark === 'string', `${s.id} heartmark`);
  }
  // starters carry their source technique from the start
  assert.ok(learnableAt(byId.sloshkin, 5).includes('undertow'));
  assert.equal(byId.scrapling.heartmark, 'shadowbox');
  for (const id of ['puddlepip', 'siltback', 'skeinwing', 'bogmonarch']) assert.equal(byId[id].heartmark, 'undertow', id);
});

test('Heartmark anchors: four per form, inside the 32 cell, inside the drawn sprite where one exists', () => {
  const drawnName = {
    sloshkin: 'Sloshkin', skeinwing: 'Skeinwing', scrapling: 'Scrapling', prismoth: 'Prismoth', vesperay: 'Vesperay', vagary: 'Vagary',
    brinelance: 'Brinelance', creelwight: 'Creelwight', sedgehare: 'Sedgehare', wirewhisk: 'Wirewhisk', rimeplate: 'Rimeplate', squallcoil: 'Squallcoil',
    tossup: 'Tossup', stillox: 'Stillox', caldermaw: 'Caldermaw', siltback: 'Siltback', bogmonarch: 'Bogmonarch', lumenveil: 'Lumenveil',
    mudfist: 'Mudfist', rushling: 'Rushling', puddlepip: 'Puddlepip', chillnub: 'Chillnub',
  };
  let drawn = 0;
  for (const s of SPECIES) {
    const a = s.flags.heartmarkAnchors;
    assert.deepEqual(Object.keys(a), ['head', 'chest', 'back', 'tail'], s.id);
    for (const p of Object.values(a)) assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 1 && p.x <= 30 && p.y >= 1 && p.y <= 30, `${s.id} anchor ${JSON.stringify(p)}`);
    assert.ok(['w', 'y'].includes(s.flags.heartmarkHighlight), s.id);
    assert.ok(Array.isArray(s.flags.mustNotReadAs) && s.flags.mustNotReadAs.length > 0, `${s.id} mustNotReadAs`);
    assert.ok(typeof s.flags.feature === 'string' && s.flags.feature.length > 10, `${s.id} feature`);
    assert.ok(typeof s.flags.log === 'string' && s.flags.log.length > 30, `${s.id} log`);
    const keys = s.flags.palette;
    assert.ok(typeof keys === 'string' && keys.length <= 8 && keys.includes('k'), `${s.id} palette`);
    if (s.id !== 'vagary') assert.ok(!keys.includes('m'), `${s.id} palette uses comet magenta`);
    if (s.flags.sprite === 'drawn') {
      drawn++;
      const spr = SPRITES[drawnName[s.id]];
      assert.ok(spr, `${s.id} is marked drawn but has no prototype sprite`);
      for (const [k, p] of Object.entries(a)) {
        const ch = spr.rows[p.y][p.x];
        assert.ok(ch !== '.' && ch !== 'k', `${s.id} ${k} anchor (${p.x},${p.y}) is on '${ch}', not body`);
      }
      assert.deepEqual([...Object.keys(spr.palette)].sort().join(''), [...keys].sort().join(''), `${s.id} palette matches the drawn sprite`);
      assert.ok(Object.values(a).some((p) => p.x === spr.heartmark.x && p.y === spr.heartmark.y), `${s.id}: the prototype mark is one of its anchors`);
    }
  }
  assert.equal(drawn, 22, 'GDD-ids ruling 6: 22 drawn forms');
  assert.equal(SPECIES.filter((s) => s.flags.sprite === 'brief').length, 20, '20 sprite briefs');
});

test('discs: every disc move has at least 25% learners (GDD-00 §8 seed guarantee)', () => {
  for (const mv of Object.values(M.DISC_MOVES)) {
    const n = SPECIES.filter((s) => canBeTaught(s, mv)).length;
    assert.ok(n >= Math.ceil(SPECIES.length * 0.25), `${mv}: ${n} learners`);
  }
});

test('catch rates and EXP yields match the GDD checks', () => {
  // Errants: ~22% with a Tallow wick at the Stance floor (odds ≈ catchRate / 255)
  for (const id of ['squallcoil', 'hailcoil']) assert.ok(Math.abs(byId[id].catchRate / 255 - 0.22) < 0.01, id);
  // The Passenger: 14% with a Skyglass wick (x2) at the Stance floor
  assert.ok(Math.abs((byId.vagary.catchRate / 255) * 2 - 0.14) < 0.01);
  // Pip's Lv4 Wirewhisk: 55 x 4 / 5 x 1.5 = 66
  assert.equal(Math.round((byId.wirewhisk.expYield * 4) / 5 * 1.5), 66);
  // Lowmoor wilds give enough to reach Lv8 from 406 EXP in two Lv6 fights
  for (const id of ['puddlepip', 'scrapling', 'reedkit', 'tossup', 'wirewhisk', 'mudfist', 'sloshkin']) assert.ok(byId[id].expYield >= 45, id);
});
