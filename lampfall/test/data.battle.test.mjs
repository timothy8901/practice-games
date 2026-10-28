// GDD-04 BATTLE self-validation: moves (65), trainers (65), the trainer scripts this chapter owns,
// and the Spire / Long Road / Summit / Reading data. Our tables override js/data/index.js's
// placeholders; references into other chapters' tables (species, items, story scripts) are checked
// against the id manifest, and only the ids those tables still lack are stubbed so every validator
// rule runs over our rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DATA } from '../js/data/index.js';
import * as M from '../js/data/ids.manifest.js';
import { validateData, checkManifest } from '../tools/validate-data.mjs';
import { EFFECT_KEYS, moveProblems, STAGE_KEYS } from '../js/battle/effects.js';
import { PROFILES } from '../js/battle/ai.js';
import { validateCond } from '../js/script/cond.js';
import { TUNING } from '../js/data/tuning.js';
import { MOVES as PROTO_MOVES } from '../proto/battle/moves.js';

import { MOVES, MOVE_BY_ID, SCRAP } from '../js/data/moves/index.js';
import { TRAINERS, TRAINER_BY_ID, TRAINER_SCRIPTS, WARD_FORMS, HEAL_CAP, ROUTE_TRAINERS } from '../js/data/trainers.js';
import { SPIRES, LONG_ROAD, SUMMIT, SUMMIT_BELL, THE_READING, WEATHER_KINDS, BOSS_SHIFT_ODDS } from '../js/data/spires.js';

const TYPE_NAMES = ['Plain', 'Grit', 'Brine', 'Kiln', 'Moss', 'Bolt', 'Rime', 'Gust', 'Stone', 'Rust', 'Glass', 'Hollow', 'Star'];
const WEATHER_IDS = WEATHER_KINDS.map((w) => w.id);
const ALL_ITEM_IDS = new Set(M.MANIFEST.items.ids);
const REGION_CURVE = { pellwick: 4, lowmoor: 6, cairnhold: 13, emberstep: 19, drownwood: 26, thistlewind: 33, rimeholt: 40, 'the-bar': 41, shardcrown: 47 };
// Isle wild bands (GDD-00 §4): mandatory route trainers sit in the day band, optional ones in the night band (+2).
const WILD = { lowmoor: [3, 8], cairnhold: [9, 14], emberstep: [15, 20], drownwood: [22, 27], thistlewind: [29, 34], rimeholt: [36, 41] };

// GDD-ids §11: id -> [ace species, ace level | null (scaled), team size | null, [min, max] | null]. Two rows differ from
// the GDD-ids table on purpose (tools/balance-sim.mjs, GDD-04 §Balance): Tibby's Wirewhisk is Lv8 (at Lv9 it swept on-curve
// parties) and Seraphine fields six (Lv42-43; four at Lv40-43 lost to on-curve parties 9 times in 10).
const EXPECTED = {
  'lowmoor-osier': ['reedkit', 6, 2, [5, 6]], 'lowmoor-dunlin': ['mudfist', 7, 2, [6, 7]], 'lowmoor-colm': ['puddlepip', 7, 2, [6, 7]],
  'lowmoor-perrin': ['sloshkin', 8, 2, [7, 8]], 'lowmoor-tibby': ['wirewhisk', 7, 3, [7, 7]],
  'cairnhold-ruddock': ['knuckleback', 12, 2, [11, 12]], 'cairnhold-prudence': ['chillnub', 12, 2, [11, 12]], 'cairnhold-jory': ['siltback', 13, 3, [11, 13]],
  'cairnhold-ellery': ['mothling', 13, 2, [12, 13]], 'cairnhold-bette': ['prismoth', 15, 3, [13, 15]],
  'emberstep-asha': ['rayling', 18, 2, [17, 18]], 'emberstep-kip': ['sootling', 18, 3, [16, 18]], 'emberstep-roswitha': ['sedgehare', 19, 2, [18, 19]],
  'emberstep-tobiah': ['emberjaw', 20, 3, [18, 20]], 'emberstep-marl': ['skeinwing', 21, 3, [19, 21]],
  'drownwood-wenna': ['rushling', 25, 3, [24, 25]], 'drownwood-gil': ['rustcreel', 26, 3, [24, 26]], 'drownwood-hettie': ['brinelance', 27, 3, [25, 27]],
  'drownwood-abner': ['creelwight', 27, 3, [25, 27]], 'drownwood-sorcha': ['duskwisp', 28, 3, [26, 28]],
  'thistlewind-ned': ['skirl', 31, 3, [30, 31]], 'thistlewind-lark': ['gillwick', 32, 3, [30, 32]], 'thistlewind-cuthbert': ['cragmitt', 33, 3, [31, 33]],
  'thistlewind-maisie': ['duskowl', 34, 4, [31, 34]], 'thistlewind-gideon': ['bogmonarch', 35, 4, [32, 35]],
  'rimeholt-hild': ['rimeplate', 38, 3, [37, 38]], 'rimeholt-oskar': ['floeback', 39, 3, [37, 39]], 'rimeholt-greer': ['strandrunner', 40, 4, [38, 40]],
  'rimeholt-sunniva': ['lumenveil', 41, 4, [38, 41]], 'rimeholt-aldous': ['caldermaw', 42, 4, [39, 42]],
  pip: ['wirewhisk', 4, 2, [2, 4]], // FH-15: a Tossup opens so the first trainer asks for a decision
  'maud-spire': ['bilgebob', 9, 2, [8, 9]], 'osric-spire': ['prismoth', 16, 3, [14, 16]], 'ines-spire': ['emberjaw', 22, 3, [20, 22]],
  'wendel-spire': ['hulkwight', 29, 3, [27, 29]], 'hallorans-spire': ['coilcrest', 36, 6, [33, 36]], 'seraphine-spire': ['lumenveil', 43, 6, [40, 43]],
  'bar-corwen': ['hulkwight', 41, 4, [40, 41]], 'bar-tilda': ['strandrunner', 41, 4, [40, 41]], 'bar-ezra': ['cairnward', 42, 4, [41, 42]],
  'bar-ottilie': ['lumenveil', 43, 5, [41, 43]], 'bar-hamish': ['brinelance', 43, 5, [42, 43]], 'bar-delphine': ['cragmitt', 44, 5, [42, 44]],
  'bastien-keeper': ['hulkwight', 46, 5, [43, 46]], 'cass-keeper': ['skeinwing', 48, 5, [45, 48]], 'idris-champion': ['vesperay', 50, 6, [46, 50]],
  'linnet-dock': ['sootling', 5, 1, [5, 5]], 'linnet-brackenford': ['caldermaw', 11, 3, [6, 11]], 'linnet-rimeholt': ['sootling', 39, 6, [36, 39]],
  'linnet-gate': ['emberjaw', 46, 6, [42, 46]], 'wick-cairnhold': ['rillfin', 12, 1, [12, 12]], 'wick-long-road': ['gillwick', 43, 3, [41, 43]],
  'merrow-engine': ['cairnward', 38, 4, [35, 38]], 'varga-drownwood': ['bogmonarch', 28, 4, [25, 28]],
  'corin-exhibition-1': ['tossup', 8, 2, [6, 8]], 'corin-exhibition-2': ['tossup', 20, 3, [17, 20]], 'corin-exhibition-3': ['tossup', 34, 4, [30, 34]],
  'porch-wren': ['scrapling', null, 3, null], 'porch-tully': ['scrapling', null, 3, null], 'porch-juniper': ['wirewhisk', null, 3, null],
  'porch-odile': ['prismoth', null, 3, null], 'porch-tamsin': ['creelwight', null, 3, null], 'porch-wick': ['gillwick', null, 3, null],
  'porch-augusta': ['bilgebob', null, 3, null], 'porch-linnet': ['sootling', null, 3, null],
};
const OPTIONAL = ['lowmoor-colm', 'lowmoor-tibby', 'cairnhold-ellery', 'cairnhold-bette', 'emberstep-roswitha', 'emberstep-marl', 'drownwood-sorcha', 'thistlewind-maisie', 'thistlewind-gideon', 'rimeholt-sunniva', 'rimeholt-aldous'];
// GDD-ids §5 numbers for the 11 new techniques: [type, category, power, accuracy, pp, priority]
const NEW_MOVES = {
  breaker: ['Brine', 'physical', 75, 95, 15, 0], flashover: ['Kiln', 'special', 100, 90, 5, 0], 'mire-bloom': ['Moss', 'special', 80, 100, 10, 0],
  fizz: ['Bolt', 'special', 40, 100, 30, 0], 'live-wire': ['Bolt', 'physical', 95, 100, 10, 0], 'floe-ram': ['Rime', 'physical', 70, 100, 15, 0],
  downdraft: ['Gust', 'special', 40, 100, 30, 1], 'cairn-crash': ['Stone', 'physical', 95, 85, 10, 0], murk: ['Hollow', 'special', 40, 100, 30, 0],
  'drowned-bell': ['Hollow', 'special', 90, 90, 10, 0], hush: ['Hollow', 'status', 0, 100, 15, 0],
};

// --- the overridden DATA, with stubs only for ids other chapters have not authored yet ----------

function buildData() {
  const have = (table) => new Set((Array.isArray(DATA[table]) ? DATA[table] : Object.keys(DATA[table])).map((r) => (typeof r === 'string' ? r : r.id)));
  const species = [...DATA.species];
  const families = [...DATA.families];
  const abilities = [...DATA.abilities];
  const haveSpecies = have('species');
  const missingSpecies = M.SPECIES_IDS.filter((id) => !haveSpecies.has(id));
  if (missingSpecies.length) {
    // Stub forms: learnsets hold only the manifest's signature moves, so trainer move legality stays a warning.
    if (!abilities.some((a) => a.id === 'stub-ability')) abilities.push({ id: 'stub-ability', name: 'Stub', text: 'test stub', ward: null, hook: null });
    families.push({ id: 'stub-line', name: 'Stub line', windows: [8, 20, 34], shiftTable: {} });
    for (const id of missingSpecies) {
      const sig = Object.entries(M.SIGNATURES).filter(([, sp]) => sp === id).map(([mv]) => [1, mv]);
      species.push({ id, name: id, types: ['Plain'], familyId: 'stub-line', stage: 1, base: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 }, ability: 'stub-ability', learnset: sig, heartmark: null, catchRate: 45, expYield: 60, growth: 'medium-fast', flags: {} });
    }
  }
  const haveItems = have('items');
  const items = [...DATA.items, ...[...ALL_ITEM_IDS].filter((id) => !haveItems.has(id)).map((id) => ({ id, name: id, pocket: 'medicine', price: 0, sell: 0, stack: 1, use: null, oneOfAKind: false, text: 'test stub' }))];
  const scripts = { ...DATA.scripts };
  for (const id of M.SCRIPT_IDS) if (!(id in scripts)) scripts[id] = [{ op: 'end' }];
  Object.assign(scripts, TRAINER_SCRIPTS);
  return { ...DATA, species, families, abilities, items, scripts, moves: MOVES, trainers: TRAINERS };
}

const OURS = buildData();
const OWN_SCRIPT_IDS = new Set(Object.keys(TRAINER_SCRIPTS));
const isOurs = (line) => line.startsWith('moves:') || line.startsWith('trainers:') || [...OWN_SCRIPT_IDS].some((id) => line.startsWith(`${id}`) || line.startsWith(`scripts:${id}`));

// --- validator ---------------------------------------------------------------------------------

test('validateData: zero errors in moves, trainers and our trainer scripts', () => {
  const { errors } = validateData(OURS, { tuning: TUNING, effectKeys: EFFECT_KEYS, aiProfiles: Object.keys(PROFILES) });
  const mine = errors.filter(isOurs);
  assert.deepEqual(mine, [], mine.join('\n'));
});

test('checkManifest: moves and trainers complete, no extra ids', () => {
  const { warnings } = checkManifest(OURS, M.MANIFEST);
  const mine = warnings.filter((w) => w.startsWith('moves:') || w.startsWith('trainers:'));
  assert.deepEqual(mine, [], mine.join('\n'));
  assert.deepEqual(MOVES.map((m) => m.id).sort(), [...M.MOVE_IDS].sort());
  assert.deepEqual(TRAINERS.map((t) => t.id).sort(), [...M.TRAINER_IDS].sort());
  assert.deepEqual(SPIRES.map((s) => s.id), [...M.SPIRE_IDS], 'spires in badge order = UNMAPPED.spires');
  assert.deepEqual([...M.UNMAPPED.spires], SPIRES.map((s) => s.id));
});

// --- moves -------------------------------------------------------------------------------------

test('moves: 64 techniques + Scrap, every row well-formed against battle/effects', () => {
  assert.equal(MOVES.length, 65);
  assert.equal(MOVES.filter((m) => m.id !== 'scrap').length, 64);
  assert.equal(new Set(MOVES.map((m) => m.id)).size, 65);
  for (const mv of MOVES) {
    assert.deepEqual(moveProblems(mv), [], mv.id);
    assert.ok(mv.type === null || TYPE_NAMES.includes(mv.type), `${mv.id} type`);
    for (const k of Object.keys(mv.effect)) assert.ok(EFFECT_KEYS.includes(k), `${mv.id} effect ${k}`);
    if (mv.effect.stat) for (const s of mv.effect.stat) assert.ok(STAGE_KEYS.includes(s.stat));
    if (mv.effect.evasion) assert.ok(mv.pp <= 5, `${mv.id} evasion pp`);
    assert.ok(typeof mv.text === 'string' && mv.text.length > 8 && !/TODO|PLACEHOLDER/i.test(mv.text), `${mv.id} text`);
    assert.ok(Object.isFrozen(mv) && Object.isFrozen(mv.effect));
  }
  assert.equal(SCRAP.pp, null);
  assert.equal(SCRAP.power, 50);
  assert.equal(SCRAP.accuracy, null);
  assert.ok(SCRAP.effect.scrap && SCRAP.effect.sureHit);
  assert.equal(MOVES.filter((m) => m.pp === null).length, 1, 'only Scrap has pp null');
});

test('moves: prototype numbers kept; signatures match the manifest; 11 new moves per GDD-ids', () => {
  for (const [id, p] of Object.entries(PROTO_MOVES)) {
    const n = MOVE_BY_ID[id];
    assert.ok(n, id);
    for (const k of ['type', 'category', 'power', 'accuracy', 'pp', 'priority', 'signature']) assert.deepEqual(n[k], p[k], `${id}.${k}`);
    assert.deepEqual({ ...n.effect }, { ...p.effect }, `${id}.effect`);
  }
  const sigs = Object.fromEntries(MOVES.filter((m) => m.signature).map((m) => [m.id, m.signature]));
  assert.deepEqual(sigs, { ...M.SIGNATURES });
  for (const [id, [type, category, power, accuracy, pp, priority]] of Object.entries(NEW_MOVES)) {
    const mv = MOVE_BY_ID[id];
    assert.ok(mv && !PROTO_MOVES[id], `${id} is new`);
    assert.deepEqual([mv.type, mv.category, mv.power, mv.accuracy, mv.pp, mv.priority], [type, category, power, accuracy, pp, priority], id);
  }
  assert.equal(Object.keys(PROTO_MOVES).length + Object.keys(NEW_MOVES).length, 65);
  // Each ordinary type: 4 non-signature techniques except Glass (3, plus Starfall as its fourth).
  for (const t of TYPE_NAMES.slice(0, 12)) {
    const n = MOVES.filter((m) => m.type === t && !m.signature).length;
    assert.equal(n, t === 'Glass' ? 3 : 4, `${t} ordinary techniques`);
  }
  const pl = MOVE_BY_ID.plumbline;
  assert.ok(pl.effect.plumbline && pl.effect.sureHit && pl.accuracy === null && pl.type === null && /Mirrorveil/.test(pl.text));
});

test('moves: disc moves exist and the Kiln disc is Flashover', () => {
  for (const mv of Object.values(M.DISC_MOVES)) assert.ok(MOVE_BY_ID[mv], mv);
  assert.equal(MOVE_BY_ID.flashover.type, 'Kiln');
});

// --- trainers ----------------------------------------------------------------------------------

const wardsOf = (t) => {
  const forms = [];
  for (const c of t.party) {
    if (WARD_FORMS.includes(c.species)) forms.push(c.species);
    for (const card of c.bossShift?.cards ?? []) if (WARD_FORMS.includes(card.form)) forms.push(card.form);
  }
  return forms;
};

test('trainers: GDD-ids aces, team sizes and level ranges', () => {
  assert.equal(TRAINERS.length, 65);
  for (const t of TRAINERS) {
    const [ace, aceLv, size, range] = EXPECTED[t.id];
    assert.ok(t.party.length >= 1 && t.party.length <= 6, t.id);
    if (size !== null) assert.equal(t.party.length, size, `${t.id} size`);
    const last = t.party[t.party.length - 1];
    assert.equal(last.species, ace, `${t.id} ace (last slot)`);
    if (aceLv !== null) {
      assert.equal(last.level, aceLv, `${t.id} ace level`);
      const lv = t.party.map((c) => c.level);
      assert.deepEqual([Math.min(...lv), Math.max(...lv)], range, `${t.id} range`);
    }
  }
});

test('trainers: every reference resolves against the manifest', () => {
  for (const t of TRAINERS) {
    assert.ok(M.MAP_IDS.includes(t.map), `${t.id} map`);
    assert.ok(M.REGION_IDS.includes(t.region), `${t.id} region`);
    assert.match(t.post, /^[a-z0-9][a-z0-9-]*$/, `${t.id} post`);
    assert.ok(t.postName && t.title && t.class && t.tacticTag, `${t.id} display fields`);
    if (t.npc) assert.ok(M.NPC_IDS.includes(t.npc), `${t.id} npc`);
    for (const n of t.npcs ?? []) assert.ok(M.NPC_IDS.includes(n), `${t.id} npcs`);
    assert.ok(PROFILES[t.ai], `${t.id} ai`);
    for (const c of t.party) {
      assert.ok(M.SPECIES_IDS.includes(c.species), `${t.id} ${c.species}`);
      assert.ok(Number.isInteger(c.level) && c.level >= 1 && c.level <= 100);
      if (c.moves) {
        assert.ok(c.moves.length >= 1 && c.moves.length <= 4, `${t.id} ${c.species} moves`);
        assert.equal(new Set(c.moves).size, c.moves.length, `${t.id} ${c.species} duplicate move`);
        for (const mv of c.moves) assert.ok(MOVE_BY_ID[mv] && mv !== 'scrap', `${t.id} ${mv}`);
      }
      if (c.held) assert.ok(M.ITEM_IDS.includes(c.held), `${t.id} held ${c.held}`);
      if (c.onEntry) assert.ok(WEATHER_IDS.includes(c.onEntry.weather) && c.onEntry.turns > 0);
      if (c.trainer) assert.ok(M.NPC_IDS.includes(c.trainer));
      if (c.before) {
        assert.ok(M.SPECIES_IDS.includes(c.before.species));
        assert.deepEqual(validateCond(c.before.until, {}), []);
      }
      if (c.bossShift) {
        const b = c.bossShift;
        assert.ok(Number.isInteger(b.postAt) && Number.isInteger(b.shiftAt) && b.shiftAt >= b.postAt, `${t.id} bossShift timing`);
        if (b.odds === 'dial') assert.deepEqual(b.cards.map((x) => x.dir), ['up', 'side', 'down']);
        else assert.ok(b.odds === 100 && b.cards.length === 1, `${t.id} sure shift`);
        const forms = b.cards.map((x) => x.form);
        assert.equal(new Set(forms).size, forms.length);
        for (const fm of forms) { assert.ok(M.SPECIES_IDS.includes(fm), fm); assert.notEqual(fm, c.species); assert.ok(!['vagary', 'stillox'].includes(fm)); }
      }
    }
    for (const it of t.items) {
      assert.ok(M.ITEM_IDS.includes(it.id), `${t.id} item ${it.id}`);
      assert.ok(it.heal > 0 && it.heal <= 1 && it.name);
    }
    if (t.available) assert.deepEqual(validateCond(t.available, {}), [], t.id);
    if (t.requires) assert.ok(M.MAP_IDS.includes(t.requires.visited));
  }
});

test('trainers: payouts are 50 x highest level, 200 x ace, or rule-driven', () => {
  for (const t of TRAINERS) {
    const hi = Math.max(...t.party.map((c) => c.level));
    const ace = t.party[t.party.length - 1].level;
    const k = t.payoutRule.kind;
    if (k === 'highest') assert.equal(t.payout, 50 * hi, t.id);
    else if (k === 'ace') assert.equal(t.payout, 200 * ace, t.id);
    else assert.equal(t.payout, 0, t.id);
    if (['route', 'long-road', 'dock'].includes(t.class)) assert.equal(k, 'highest', t.id);
    if (['leader', 'keeper', 'champion'].includes(t.class)) assert.equal(k, 'ace', t.id);
    if (t.class === 'porch') assert.deepEqual([k, t.payoutRule.perLevel], ['curve', 30], t.id);
  }
  assert.equal(TRAINER_BY_ID.pip.payout, 200);
  assert.equal(TRAINER_BY_ID['drownwood-hettie'].payout, 1350, 'Day 10 check');
  assert.deepEqual(['maud-spire', 'osric-spire', 'ines-spire', 'wendel-spire', 'hallorans-spire', 'seraphine-spire'].map((id) => TRAINER_BY_ID[id].payout), [1800, 3200, 4400, 5800, 7200, 8600]);
  assert.equal(TRAINER_BY_ID['idris-champion'].payout, 10000);
});

test('trainers: route bands, optional = declinable, story never walls', () => {
  const declinable = TRAINERS.filter((t) => t.declinable).map((t) => t.id).sort();
  assert.deepEqual(declinable, [...OPTIONAL].sort());
  for (const t of TRAINERS.filter((x) => x.class === 'route')) {
    const [lo, hi] = WILD[t.region];
    const [min, max] = t.declinable ? [lo + 2, hi + 2] : [lo, hi];
    assert.equal(t.band, t.declinable ? 'night' : 'day', t.id);
    for (const c of t.party) assert.ok(c.level >= min && c.level <= max, `${t.id} ${c.species} Lv${c.level} outside ${min}-${max}`);
  }
  for (const [isle, ids] of Object.entries(ROUTE_TRAINERS)) assert.equal(ids.length, 5, isle);
  for (const t of TRAINERS) {
    if (t.story) assert.equal(t.blackout, false, `${t.id} story battles never cost money`);
    if (['keeper', 'champion', 'porch', 'mentor'].includes(t.class)) assert.equal(t.blackout, false, t.id);
    if (['route', 'leader', 'long-road'].includes(t.class)) assert.equal(t.blackout, true, t.id);
    if (t.declinable) assert.equal(t.class, 'route');
  }
  assert.equal(TRAINER_BY_ID['linnet-dock'].holdOut, 3);
  const dock = TRAINER_BY_ID['linnet-dock'].party[0];
  assert.deepEqual([dock.species, dock.bossShift.cards[0].form, dock.bossShift.odds], ['sootling', 'caldermaw', 100]);
});

test('trainers: Ward placement (none before Cairnhold, at most one per trainer) and heal caps', () => {
  for (const t of TRAINERS) {
    const w = wardsOf(t);
    assert.ok(w.length <= 1, `${t.id} has ${w.length} Wards`);
    if (['pellwick', 'lowmoor'].includes(t.region) && w.length) {
      assert.equal(t.requires?.visited, 'cairnhold', `${t.id}: a Ward before Cairnhold must be gated on reaching Cairnhold`);
    }
    const cap = t.class === 'route' ? HEAL_CAP.route : HEAL_CAP.default;
    assert.ok(t.items.length <= cap, `${t.id} carries ${t.items.length} heals (cap ${cap})`);
  }
  // The first mandatory Ward is Prudence's Chillnub, on Cairnhold.
  const mandatoryWards = TRAINERS.filter((t) => t.class === 'route' && !t.declinable && wardsOf(t).length);
  assert.equal(mandatoryWards[0].id, 'cairnhold-prudence');
  // Crackdust (300) sits below every Cairnhold route payout.
  for (const id of ROUTE_TRAINERS.cairnhold) assert.ok(TRAINER_BY_ID[id].payout > 300, id);
});

test('trainers: scripts resolve (ours generated, story ones from the manifest)', () => {
  const story = new Set(M.SCRIPT_IDS);
  for (const id of OWN_SCRIPT_IDS) {
    assert.ok(!story.has(id), `${id} collides with a GDD-07 script id`);
    assert.match(id, /^[a-z0-9-]+-before$/, 'no generated win / loss scripts (they repeated the parting line, FH-10)');
    const [say, end] = TRAINER_SCRIPTS[id];
    assert.equal(say.op, 'say');
    assert.ok(say.text.length > 10 && !/TODO|PLACEHOLDER/i.test(say.text));
    assert.equal(end.op, 'end');
  }
  for (const t of TRAINERS) {
    const sid = t.scripts.before;
    assert.ok(OWN_SCRIPT_IDS.has(sid) || story.has(sid), `${t.id} scripts.before '${sid}'`);
    for (const k of ['afterWin', 'afterLoss']) {
      // after-battle scripts are story-owned or absent: the battle scene speaks lines.win / lines.lose itself
      const after = t.scripts[k];
      if (after !== undefined) assert.ok(story.has(after), `${t.id} scripts.${k} '${after}'`);
    }
    for (const k of ['intro', 'win', 'lose']) assert.ok(t.lines[k] && t.lines[k].length > 10, `${t.id} lines.${k}`);
  }
  assert.equal(TRAINER_BY_ID['idris-champion'].scripts.afterWin, 'idris-anchor-release');
  assert.equal(TRAINER_BY_ID['idris-champion'].scripts.afterLoss, 'summit-bell');
});

test('trainers: Porch Duels scale to the party median and gate correctly', () => {
  const porch = TRAINERS.filter((t) => t.class === 'porch');
  assert.equal(porch.length, 8);
  for (const t of porch) {
    assert.equal(t.scale.by, 'party-median');
    assert.equal(t.scale.sizeByBadges.length, 7);
    assert.ok(t.scale.sizeByBadges.every((n) => n >= 1 && n <= 3));
    assert.equal(t.expSource, 'rematch');
    for (const c of t.party) assert.ok(Number.isInteger(c.levelOffset), `${t.id} offset`);
  }
  assert.equal(TRAINER_BY_ID['porch-odile'].requires.visited, 'cairnhold');
});

// --- Spires, Long Road, Summit, the Reading -----------------------------------------------------

test('spires: six rows in badge order with prizes, shares, dossiers and unlocks', () => {
  const curve = [6, 13, 19, 26, 33, 40];
  SPIRES.forEach((s, i) => {
    assert.equal(s.n, i + 1);
    const tr = TRAINER_BY_ID[s.trainer];
    assert.ok(tr && tr.class === 'leader' && tr.spire === s.id, s.id);
    const ace = tr.party[tr.party.length - 1];
    assert.deepEqual([ace.species, ace.level], [s.ace.species, s.ace.level], `${s.id} ace`);
    assert.equal(s.curveLevel, s.ace.level - 3, `${s.id} posted curve = ace - 3`);
    assert.equal(s.curveLevel, curve[i]);
    assert.equal(s.curveLevel, REGION_CURVE[s.isle]);
    assert.deepEqual({ ...s.prize }, { buttons: 200 * s.ace.level, starsalt: 3 });
    assert.equal(s.share.fraction, 0.1);
    assert.ok(M.NPC_IDS.includes(s.leader) && M.MAP_IDS.includes(s.map) && M.WAYSTONE_IDS.includes(s.waystone) && M.REGION_IDS.includes(s.isle));
    assert.equal(s.badge.id, s.id);
    assert.ok(s.dossier.text.length > 60 && s.theme.text.length > 60 && s.theme.rule);
    assert.ok(s.order.some((o) => o.kind === 'battle' && o.trainer === s.trainer));
    for (const o of s.order) {
      if (o.script) assert.ok(M.SCRIPT_IDS.includes(o.script), o.script);
      if (o.kind === 'sentinel') {
        assert.ok(WARD_FORMS.includes(o.foe.species));
        for (const mv of o.foe.moves) assert.ok(MOVE_BY_ID[mv]);
        assert.equal(o.capture, false);
      }
    }
    for (const u of s.unlocks) {
      if (u.item) assert.ok(ALL_ITEM_IDS.has(u.item), `${s.id} unlock ${u.item}`);
      for (const it of u.items ?? []) assert.ok(M.DISC_IDS.includes(it));
      if (u.shop) assert.ok(M.SHOP_IDS.includes(u.shop));
      if (u.npc) assert.ok(M.NPC_IDS.includes(u.npc));
      if (u.script) assert.ok(M.SCRIPT_IDS.includes(u.script));
      if (u.kind === 'commons-project') assert.ok(M.COMMONS_PROJECT_IDS.includes(u.id));
    }
  });
  // GDD-00 §7 badge tools, one line each.
  const has = (id, pred) => assert.ok(SPIRES.find((s) => s.id === id).unlocks.some(pred), id);
  has('turn', (u) => u.id === 'reroll');
  has('turn', (u) => u.item === 'disc-spore-drift');
  has('ward', (u) => u.id === 'lantern-paths');
  has('ward', (u) => u.id === 'free-ferry');
  has('ward', (u) => u.item === 'skyglass-wick');
  has('weather', (u) => u.item === 'scouting-prism');
  has('weather', (u) => u.item === 'ether');
  has('hollow', (u) => u.id === 'recall' && u.cost.starsalt === 6);
  has('hollow', (u) => u.faceUp === 1);
  has('relay', (u) => u.item === 'weatherglass');
  has('relay', (u) => u.id === 'training-yard-green');
  has('mirror', (u) => u.item === 'disc-plumbline');
  has('mirror', (u) => u.id === 'summit');
});

test('spires: theme rules are well-formed data', () => {
  const by = Object.fromEntries(SPIRES.map((s) => [s.id, s]));
  assert.ok(by.turn.theme.rule.bossShifts && by.turn.theme.rule.postTurnsAhead === 1);
  assert.ok(TRAINER_BY_ID['maud-spire'].party.every((c) => c.bossShift), 'every Maud creature Shifts');
  assert.equal(by.ward.theme.rule.crackdust.turns, 3);
  assert.equal(by.ward.theme.rule.crackdust.price, 300);
  assert.equal(wardsOf(TRAINER_BY_ID['osric-spire']).length, 1);
  assert.deepEqual([...by.weather.theme.rule.cycle], ['steam', 'ash', 'squall', 'clear']);
  for (const w of by.weather.theme.rule.cycle) assert.ok(WEATHER_IDS.includes(w));
  assert.equal(by.weather.theme.rule.turnsEach, 3);
  assert.ok(TRAINER_BY_ID['wendel-spire'].party.length === 3);
  const slots = by.relay.theme.rule.rounds.flatMap((r) => [...r.slots]).sort();
  assert.deepEqual(slots, [0, 1, 2, 3, 4, 5]);
  assert.ok(by.relay.theme.rule.singles && by.relay.theme.rule.noRepeat);
  const m = by.mirror.theme.rule;
  assert.deepEqual([m.evasionCap, m.decoysMax, m.mendsPerBattle, m.showTrueOdds], [2, 2, 3, true]);
  for (const k of ['base', 'lit']) for (const d of M.DIAL_IDS) {
    const o = BOSS_SHIFT_ODDS[k][d];
    assert.equal(o.up + o.side + o.down, 100, `${k}.${d}`);
  }
  for (const w of WEATHER_KINDS) for (const t of Object.keys(w.power)) assert.ok(TYPE_NAMES.includes(t));
});

test('long road, summit and bell', () => {
  const steps = LONG_ROAD.order.map((o) => o.trainer);
  assert.deepEqual(steps, ['bar-corwen', 'bar-tilda', 'bar-ezra', 'wick-long-road', 'bar-ottilie', 'bar-hamish', 'bar-delphine', 'linnet-gate']);
  for (const id of steps.filter((s) => s.startsWith('bar-'))) {
    for (const c of TRAINER_BY_ID[id].party) assert.ok(c.level >= 40 && c.level <= 44, id);
    assert.equal(TRAINER_BY_ID[id].class, 'long-road');
  }
  assert.equal(steps.indexOf('wick-long-road'), 3, 'Wick halfway');
  assert.deepEqual(validateCond(LONG_ROAD.order[7].cond, {}), []);
  assert.equal(LONG_ROAD.gate.badges, 6);
  assert.ok(M.SCRIPT_IDS.includes(LONG_ROAD.gate.script) && M.ITEM_IDS.concat(M.KEY_ITEM_IDS).includes(LONG_ROAD.ledger));
  assert.deepEqual(SUMMIT.order.map((o) => o.trainer), ['bastien-keeper', 'cass-keeper', 'idris-champion']);
  for (const o of SUMMIT.order) assert.ok(M.MAP_IDS.includes(o.map));
  assert.equal(SUMMIT.losses.buttons, 0);
  assert.equal(SUMMIT.champion.buttons, 10000);
  assert.equal(TRAINER_BY_ID['bastien-keeper'].party.at(-1).level, 46);
  assert.equal(TRAINER_BY_ID['cass-keeper'].party.at(-1).level, 48);
  assert.equal(TRAINER_BY_ID['idris-champion'].party.at(-1).species, 'vesperay');
  assert.deepEqual([...SUMMIT_BELL.dials], ['drift', 'flux']);
  assert.equal(SUMMIT_BELL.refills, false);
  assert.ok(M.SCRIPT_IDS.includes(SUMMIT_BELL.script));
});

test('the Reading: seven phases that cannot be lost and end only on Accept', () => {
  const R = THE_READING;
  assert.equal(R.species, 'vagary');
  assert.ok(M.SCRIPT_IDS.includes(R.script) && M.MAP_IDS.includes(R.map));
  assert.equal(R.phases.length, 7);
  assert.equal(R.phaseTurns, 2);
  assert.deepEqual([R.rules.canLose, R.rules.playerHpFloor, R.rules.foeHpFloor, R.rules.blackout, R.rules.buttons, R.endsOn], [false, 1, 1, false, 0, 'accept']);
  const aspectOk = (a) => {
    assert.ok(a.name && a.palette);
    assert.equal(a.typeQueue.length, 4);
    assert.equal(a.typeQueue[0], 'Star');
    for (const t of a.typeQueue) assert.ok(TYPE_NAMES.includes(t), t);
    if (a.weather) assert.ok(WEATHER_IDS.includes(a.weather));
  };
  aspectOk(R.arrival);
  R.phases.forEach((p, i) => {
    assert.equal(p.n, i + 1);
    assert.deepEqual(p.next.cards.map((c) => c.dir), ['up', 'side', 'down']);
    for (const c of p.next.cards) aspectOk(c.aspect);
    for (const mv of p.moves) assert.ok(MOVE_BY_ID[mv], mv);
    assert.ok(p.moves.includes('tailfall'));
    assert.ok(M.NPC_IDS.includes(p.voice.npc));
  });
  assert.deepEqual(R.phases.slice(0, 6).map((p) => p.lesson), [...M.SPIRE_IDS]);
  for (const c of R.phases[2].next.cards) assert.ok(c.aspect.typeQueue.includes('Hollow'), 'phase 4 aspects all carry Hollow');
  for (const c of R.phases[1].next.cards) assert.ok(c.aspect.weather, 'phase 3 aspects all post weather');
  const last = R.phases[6];
  assert.ok(last.rule.offerToPlayer);
  assert.equal(last.offer.accept.ends, true);
  assert.deepEqual([last.offer.anchor.free, last.offer.anchor.addsPhase, last.offer.reroll.free, last.offer.reroll.addsPhase], [true, true, true, true]);
  assert.ok(M.STAMP_IDS.includes(last.offer.accept.stamp) && M.FLAG_IDS.includes(last.offer.accept.flag));
  assert.ok(last.rerollPool.length >= 6);
  last.rerollPool.forEach(aspectOk);
  for (const n of R.shoreParty) assert.ok(M.NPC_IDS.includes(n));
});
