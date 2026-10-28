// Balance and continuity for the creature (GDD-03) and battle (GDD-04) chapters.
//
// 1. validateData / checkManifest over the real species, families, abilities, types, moves, trainers
//    (and the spires table, checked against the manifest's UNMAPPED.spires).
// 2. Continuity against design/GDD-ids.md and design/GDD-00-decisions.md: species rows, the Sloshkin
//    pools, the four Ward forms, signatures, discs, learnsets, trainer legality, Linnet, Spire aces.
// 3. The balance sim (tools/balance-sim.mjs) on the real engine and data: Spire leaders 55-85%,
//    the Summit run 35-65%, route trainers 85%+, no fight averaging 60 turns, stat-total outliers
//    only where documented, Ward readouts that name an answer, and a Reading that cannot be lost.
// Run: node --test test/data.balance.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { DATA } from '../js/data/index.js';
import * as M from '../js/data/ids.manifest.js';
import { validateData, checkManifest } from '../tools/validate-data.mjs';
import { HOOKS } from '../js/battle/abilityHooks.js';
import { wardCheck, isDamaging, isChipMove, moveTypeFor } from '../js/battle/effects.js';
import { createBattleData } from '../js/battle/data.js';
import { TYPES, TYPE_TABLE } from '../js/data/types.js';
import { ABILITIES } from '../js/data/abilities.js';
import { SPECIES, FAMILIES, canBeTaught } from '../js/data/species/index.js';
import { MOVES } from '../js/data/moves/index.js';
import { TRAINERS, TRAINER_BY_ID, TRAINER_SCRIPTS, WARD_FORMS } from '../js/data/trainers.js';
import { SPIRES, SUMMIT, THE_READING } from '../js/data/spires.js';
import { ITEMS } from '../js/data/items.js';
import {
  TARGETS, runAll, buildParty, PARTIES, statOutliers, BATTLE_DATA,
} from '../tools/balance-sim.mjs';

const MINE = ['types', 'abilities', 'species', 'families', 'moves', 'trainers'];
const SP = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
const MV = Object.fromEntries(MOVES.map((m) => [m.id, m]));
const VIEW = createBattleData(BATTLE_DATA);
const IDS_MD = readFileSync(new URL('../design/GDD-ids.md', import.meta.url), 'utf8');

/** Rows of every markdown table under a `## n.` section whose header starts with `| id |` or `| Spire`. */
function tableRows(section) {
  const start = IDS_MD.indexOf(`## ${section}.`);
  const end = IDS_MD.indexOf('\n## ', start + 4);
  const body = IDS_MD.slice(start, end === -1 ? undefined : end);
  return body.split('\n').filter((l) => /^\| `[^`]+` \|/.test(l)).map((l) => l.split('|').slice(1, -1).map((c) => c.trim().replace(/^`|`$/g, '')));
}

const data = {
  ...DATA, types: TYPES, abilities: ABILITIES, species: SPECIES, families: FAMILIES, moves: MOVES, trainers: TRAINERS, items: ITEMS,
  scripts: { ...DATA.scripts, ...TRAINER_SCRIPTS },
};
const mineOnly = (lines) => lines.filter((l) => MINE.some((t) => l.startsWith(`${t}:`)));

// --- 1. validator ------------------------------------------------------------------------------------

test('validateData: zero errors in the six tables (script ids owned by GDD-07 resolve in the manifest)', () => {
  const { errors, warnings } = validateData(data, { hooks: new Set(Object.keys(HOOKS)), tuning: { wardCount: 3 } });
  const scriptRef = /^trainers:[a-z0-9-]+: scripts\.\w+ '([a-z0-9-]+)' is not in scripts$/;
  const real = mineOnly(errors).filter((e) => {
    const m = scriptRef.exec(e);
    return !(m && M.SCRIPT_IDS.includes(m[1]));
  });
  assert.deepEqual(real, []);
  assert.deepEqual(mineOnly(warnings).filter((w) => !w.startsWith('species:*: art/creatures not present')), []);
});

test('checkManifest: the six tables are complete with no extra ids; the six Spires match the manifest', () => {
  const manifest = Object.fromEntries(MINE.map((t) => [t, M.MANIFEST[t]]));
  const { warnings, notes } = checkManifest(data, manifest);
  assert.deepEqual(warnings, []);
  assert.deepEqual(notes, []);
  assert.deepEqual(SPIRES.map((s) => s.id), [...M.UNMAPPED.spires]);
  for (const sid of Object.keys(TRAINER_SCRIPTS)) assert.ok(!M.SCRIPT_IDS.includes(sid), `trainer script ${sid} collides with a manifest script`);
});

// --- 2. continuity -----------------------------------------------------------------------------------

test('species rows match GDD-ids §4 (id, name, stage, types, ability, family)', () => {
  const rows = tableRows(4);
  assert.equal(rows.length, 42);
  for (const [id, name, stage, types, ability] of rows) {
    const s = SP[id];
    assert.ok(s, `${id} missing`);
    assert.ok([s.name, s.flags.displayName].includes(name.replace(/ \*inv\.\*$/, '')), `${id} name ${s.name} vs ${name}`);
    assert.equal(s.stage, Number(stage), `${id} stage`);
    assert.deepEqual(s.types, types.split('/'), `${id} types`);
    assert.equal(s.ability, ability, `${id} ability`);
    assert.equal(s.familyId, M.SPECIES_FAMILY[id], `${id} family`);
  }
});

test('moves match GDD-ids §5 numbers (category, power, accuracy, PP, priority, signature)', () => {
  const rows = tableRows(5);
  assert.equal(rows.length, 65);
  const num = (v) => (v === '—' ? null : Number(v));
  for (const [id, , cat, pow, acc, pp, pri, sig] of rows) {
    const m = MV[id];
    assert.ok(m, `${id} missing`);
    assert.equal(m.category, cat, `${id} category`);
    assert.equal(m.power, Number(pow), `${id} power`);
    assert.equal(m.accuracy, num(acc), `${id} accuracy`);
    assert.equal(m.pp, num(pp), `${id} pp`);
    assert.equal(m.priority, Number(pri), `${id} priority`);
    if (sig) assert.equal(M.SIGNATURES[id], sig, `${id} signature`);
  }
});

test('abilities: every form GDD-ids §6 lists carries that ability', () => {
  const rows = tableRows(6);
  assert.equal(rows.length, 25);
  for (const [id, , , forms] of rows) {
    for (const f of forms.split(',').map((x) => x.trim()).filter(Boolean)) assert.equal(SP[f]?.ability, id, `${f} should carry ${id}`);
  }
});

test('the Sloshkin family pools are GDD-00 §8 exactly; Star-touched Sloshkin on the Side card', () => {
  const fam = FAMILIES.find((f) => f.id === 'sloshkin');
  const t = fam.shiftTable.sloshkin;
  const forms = (card) => t[card].map((e) => e.form).sort();
  assert.deepEqual(forms('up'), ['bogmonarch', 'lumenveil', 'siltback', 'skeinwing']);
  assert.deepEqual(forms('side'), ['mudfist', 'rushling']);
  assert.deepEqual(forms('down'), ['chillnub', 'puddlepip']);
  assert.equal(fam.star, 'sloshkin');
  for (const card of ['up', 'side', 'down']) {
    const ff = t[card].map((e) => e.w.freefall);
    assert.ok(ff.every((w) => w === ff[0]), `Freefall weights flattened in ${card}`);
  }
  for (const f of FAMILIES) if (f.shiftTable && Object.keys(f.shiftTable).length) assert.deepEqual([...f.windows], [8, 20, 34], `${f.id} windows`);
});

test('Wards sit on exactly the four GDD-00 forms; no Ward on any trainer before Cairnhold', () => {
  const wardAb = new Set(ABILITIES.filter((a) => a.ward).map((a) => a.id));
  assert.deepEqual(SPECIES.filter((s) => wardAb.has(s.ability)).map((s) => s.id).sort(), ['cairnward', 'chillnub', 'lumenveil', 'prismoth']);
  assert.deepEqual([...WARD_FORMS].sort(), ['cairnward', 'chillnub', 'lumenveil', 'prismoth']);
  for (const id of ['pip', 'linnet-dock', 'linnet-brackenford', 'maud-spire', 'corin-exhibition-1', ...TRAINERS.filter((t) => t.region === 'lowmoor').map((t) => t.id)]) {
    const tr = TRAINER_BY_ID[id];
    for (const c of tr.party) {
      assert.ok(!WARD_FORMS.includes(c.species), `${id} fields a Ward before Cairnhold`);
      for (const card of c.bossShift?.cards ?? []) assert.ok(!WARD_FORMS.includes(card.form), `${id} boss Shift to a Ward before Cairnhold`);
    }
  }
});

test('signatures, discs and learnsets resolve', () => {
  for (const [mv, spId] of Object.entries(M.SIGNATURES)) assert.ok(SP[spId].learnset.some((r) => r[1] === mv), `${spId} must learn signature ${mv}`);
  for (const m of MOVES) if (m.signature) assert.ok(SP[m.signature].learnset.some((r) => r[1] === m.id), `${m.id} signature row`);
  for (const [disc, mv] of Object.entries(M.DISC_MOVES)) {
    const item = ITEMS.find((i) => i.id === disc);
    assert.ok(item, `${disc} item row`);
    assert.equal(item.move, mv, `${disc} teaches ${mv}`);
    assert.ok(MV[mv], `${disc} move ${mv} exists`);
    const learners = SPECIES.filter((s) => canBeTaught(s, mv) || s.learnset.some((r) => r[1] === mv)).length;
    assert.ok(learners / SPECIES.length >= 0.25, `${disc}: ${learners} learners < 25%`);
  }
  for (const s of SPECIES) {
    for (const [lv, mv] of s.learnset) assert.ok(MV[mv] && Number.isInteger(lv) && lv >= 1, `${s.id} learns ${mv} at ${lv}`);
    for (const mv of s.flags.teachable ?? []) assert.ok(Object.values(M.DISC_MOVES).includes(mv), `${s.id} teachable ${mv}`);
  }
});

test('every trainer creature is legal: species, level, and moves learnable by that level or from a disc', () => {
  const problems = [];
  for (const tr of TRAINERS) {
    for (const c of tr.party) {
      const s = SP[c.species];
      if (!s) { problems.push(`${tr.id}: ${c.species}`); continue; }
      for (const mv of c.moves ?? []) {
        const byLevel = s.learnset.some((r) => r[1] === mv && r[0] <= c.level);
        if (!byLevel && !canBeTaught(s, mv)) problems.push(`${tr.id}: ${c.species} Lv${c.level} cannot know ${mv}`);
      }
    }
  }
  assert.deepEqual(problems, []);
});

test("Linnet's opener and arc teams follow GDD-00 §11 and GDD-ids", () => {
  const dock = TRAINER_BY_ID['linnet-dock'];
  assert.equal(dock.party.length, 1);
  const [cinder] = dock.party;
  assert.deepEqual([cinder.species, cinder.level], ['sootling', 5]);
  assert.equal(cinder.bossShift.odds, 100, 'the posted strip reads Up 100% on every dial');
  assert.deepEqual(cinder.bossShift.cards.map((x) => [x.dir, x.form]), [['up', 'caldermaw']]);
  assert.equal(cinder.bossShift.shiftAt, 0, 'it is a Lv5 Caldermaw by the time the fight starts');
  assert.ok(dock.story && dock.holdOut === 3 && !dock.blackout, 'hold three turns, any result, never costs');
  const br = TRAINER_BY_ID['linnet-brackenford'];
  assert.equal(br.party.length, 3);
  assert.deepEqual([br.party.at(-1).species, br.party.at(-1).level], ['caldermaw', 11]);
  const rh = TRAINER_BY_ID['linnet-rimeholt'];
  assert.equal(rh.party.length, 6, 'a balanced six');
  assert.deepEqual([rh.party.at(-1).species, rh.party.at(-1).level], ['sootling', 39], 'Sootling on her shoulder');
  assert.equal(new Set(rh.party.map((c) => c.species)).size, 6);
  const gate = TRAINER_BY_ID['linnet-gate'];
  assert.equal(gate.party.length, 6);
  assert.equal(gate.party.at(-1).level, 46);
  assert.equal(SP[gate.party.at(-1).species].familyId, 'caldermaw', 'her ace is still the Sootling line');
  for (const t of [dock, br, rh, gate]) assert.equal(t.party.at(-1).nick ?? 'Cinder', 'Cinder');
});

test('Spire aces, levels, curves and prizes follow GDD-00 §4 / §7; the Summit aces follow §8', () => {
  const want = { turn: ['bilgebob', 9], ward: ['prismoth', 16], weather: ['emberjaw', 22], hollow: ['hulkwight', 29], relay: ['coilcrest', 36], mirror: ['lumenveil', 43] };
  for (const sp of SPIRES) {
    const tr = TRAINER_BY_ID[sp.trainer];
    const ace = tr.party.at(-1);
    assert.deepEqual([ace.species, ace.level], want[sp.id], `${sp.id} ace`);
    assert.deepEqual([sp.ace.species, sp.ace.level], want[sp.id], `${sp.id} row ace`);
    assert.ok(tr.party.every((c) => c.level <= ace.level), `${sp.id}: no creature above the ace`);
    assert.equal(sp.curveLevel, ace.level - 3, `${sp.id} curve = ace - 3`);
    assert.equal(PARTIES[sp.id].curve, sp.curveLevel, `${sp.id} sim curve`);
    assert.equal(tr.payout, 200 * ace.level, `${sp.id} prize`);
  }
  const ids = tableRows(9).filter((r) => SPIRES.some((s) => s.id === r[0]));
  for (const r of ids) assert.equal(`${want[r[0]][0]} Lv${want[r[0]][1]}`, r[5], `GDD-ids §9 ${r[0]}`);
  const aceOf = (id) => TRAINER_BY_ID[id].party.at(-1);
  assert.equal(aceOf('bastien-keeper').level, 46);
  assert.equal(aceOf('cass-keeper').level, 48);
  assert.deepEqual([aceOf('idris-champion').species, aceOf('idris-champion').level], ['vesperay', 50]);
  assert.equal(PARTIES.summit.curve, SUMMIT.curveLevel);
});

// --- 3. balance ----------------------------------------------------------------------------------------

const REPORT = runAll(200, 'balance');
const pct = (x) => `${(x * 100).toFixed(1)}%`;

test('every Spire leader: 55-85% for an on-curve party, averaged over the three starter lines', () => {
  const [lo, hi] = TARGETS.spire;
  for (const s of REPORT.spires) {
    assert.equal(s.n, 600, `${s.id} battles`);
    assert.ok(s.rate >= lo && s.rate <= hi, `${s.id}: ${pct(s.rate)} (${JSON.stringify(s.byStarter)})`);
    for (const [st, r] of Object.entries(s.byStarter)) assert.ok(r >= 0.2, `${s.id} with the ${st} line: ${pct(r)} (a starter line is walled)`);
  }
});

test('the Summit run (Bastien, Cass, Idris in a row): 35-65% on-curve', () => {
  const [lo, hi] = TARGETS.summit;
  assert.ok(REPORT.summit.rate >= lo && REPORT.summit.rate <= hi, `summit ${pct(REPORT.summit.rate)}`);
  assert.equal(REPORT.summit.reached['bastien-keeper'], 600);
});

test('route trainers: 85%+ for the on-curve party', () => {
  assert.equal(REPORT.route.length, 30);
  const low = REPORT.route.filter((r) => r.rate < TARGETS.routeMin).map((r) => `${r.id} ${pct(r.rate)}`);
  assert.deepEqual(low, []);
});

test('no fight averages 60 turns', () => {
  for (const s of [...REPORT.spires, REPORT.summit, ...REPORT.route]) assert.ok(s.avgTurns < TARGETS.maxAvgTurns, `${s.id}: ${s.avgTurns.toFixed(1)} turns`);
});

test('stat totals: no strictly dominated form; outliers only where GDD-03 documents them', () => {
  const r = statOutliers();
  assert.deepEqual(r.dominated, []);
  // documented: Vesperay (two-form line, a stage-3 total; Idris's ace), Tossup (Plain blank slate),
  // Lumenveil (a Ward pays for itself), Stillox (the titan sits under the two Errants and the Vagary),
  // Rayling and Wirewhisk (fast stage-1 specials at the top of the 300-355 band).
  const allowed = new Set(['vesperay', 'tossup', 'lumenveil', 'stillox', 'rayling', 'wirewhisk']);
  for (const o of r.outliers) assert.ok(allowed.has(o.id), `${o.id} stage ${o.stage} total ${o.total} (z ${o.z})`);
  assert.ok(r.stages[1].max - r.stages[1].min <= 55 && r.stages[2].max <= 470 + 50 && r.stages[3].max - r.stages[3].min <= 30);
});

test('Ward readouts name an answer: every Ward a trainer fields meets a party move that lands or a chip that works', () => {
  const partyFor = (region) => ({ cairnhold: 'ward', emberstep: 'weather', drownwood: 'hollow', thistlewind: 'relay', rimeholt: 'mirror', 'the-bar': 'summit', shardcrown: 'summit' }[region]);
  for (const tr of TRAINERS.filter((t) => t.party.some((c) => WARD_FORMS.includes(c.species)) && t.class !== 'porch')) {
    const key = partyFor(tr.region) || 'summit';
    for (const c of tr.party.filter((x) => WARD_FORMS.includes(x.species))) {
      const s = SP[c.species];
      const ability = VIEW.ability(s.ability);
      for (const st of ['sloshkin', 'scrapling', 'reedkit']) {
        const party = buildParty(key, st);
        const answers = party.flatMap((p) => p.moves.map((m) => VIEW.move(m.id)).filter((mv) => {
          const lands = wardCheck(ability, mv, s.types, moveTypeFor(mv, p), VIEW.chart).lands;
          return lands && (isDamaging(mv) || isChipMove(mv));
        }));
        const dust = PARTIES[key].crackdust > 0;
        assert.ok(answers.length > 0 || dust, `${tr.id}'s ${c.species} walls the ${st} party (no landing move, no chip, no Crackdust)`);
      }
    }
  }
});

test('the Reading cannot be lost by construction', () => {
  const R = THE_READING;
  assert.equal(R.rules.canLose, false);
  assert.ok(R.rules.playerHpFloor >= 1, 'your creatures never fall below 1 HP');
  assert.ok(R.rules.foeHpFloor >= 1, 'its bar never empties');
  assert.deepEqual([R.rules.blackout, R.rules.buttons, R.rules.run, R.rules.lantern], [false, 0, false, false]);
  assert.equal(R.endsOn, 'accept', 'only Accept ends it');
  assert.equal(R.phases.length, 7);
  const last = R.phases.at(-1);
  assert.ok(last.offer.accept.ends && last.offer.anchor.free && last.offer.reroll.free && last.offer.anchor.addsPhase && last.offer.reroll.addsPhase);
  // every phase move is one the Vagary knows at the Reading's level floor
  for (const p of R.phases) for (const mv of p.moves) {
    assert.ok(SP.vagary.learnset.some((r) => r[1] === mv && r[0] <= R.level.min), `vagary cannot know ${mv} at Lv${R.level.min}`);
  }
  assert.ok(SP.vagary.flags.neverShifts && SP.vagary.flags.neverOnForecast);
});
