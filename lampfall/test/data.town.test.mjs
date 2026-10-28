// GDD-05 TOWN LIFE: js/data/collections.js and js/data/town.js validate against the data validator,
// the id manifest and the town systems that read them. Run: node --test test/data.town.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DATA } from '../js/data/index.js';
import * as M from '../js/data/ids.manifest.js';
import { ID_RE } from '../js/data/ids.js';
import { validateData, checkManifest } from '../tools/validate-data.mjs';
import { validateCond } from '../js/script/cond.js';
import { COLLECTIONS, FISH, BUGS, FINDS, FRUIT, REACH_KINDS, BUG_HABITATS } from '../js/data/collections.js';
import * as T from '../js/data/town.js';
import * as fieldLog from '../js/systems/fieldLog.js';
import * as fishing from '../js/systems/fishing.js';
import * as gather from '../js/systems/gather.js';
import * as weather from '../js/systems/weather.js';
import * as schedule from '../js/systems/schedule.js';
import * as loans from '../js/systems/loans.js';
import { COMMONS as ECON_COMMONS, COMMISSIONS as ECON_COMMISSIONS } from '../js/data/loans.js';
import { TOMORROW_ORDER } from '../js/systems/dayPage.js';
import { PHASE_TABLE } from '../js/core/time.js';
import { COLORS, ROOF_COLOURS as ART_ROOF_KEYS } from '../js/art/palette.js';
import { makeRng } from '../js/core/rng.js';
import { createNewWorld } from '../js/state/schema.js';

// ---------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------

/** DATA with the tables this chapter owns swapped in. */
const OURS = { ...DATA, collections: COLLECTIONS };

/** Manifest-backed `has` for references into tables other chapters own. */
const MANIFEST_TABLES = {
  threads: M.THREAD_IDS, npcs: M.NPC_IDS, scripts: M.SCRIPT_IDS, species: M.SPECIES_IDS, families: M.FAMILY_IDS,
  items: [...M.ITEM_IDS, ...M.DISC_IDS, ...M.KEY_ITEM_IDS, ...M.KEEPSAKE_IDS, ...M.GOODS_IDS],
  dials: M.DIAL_IDS, maps: M.MAP_IDS, challenges: M.CHALLENGE_IDS, collections: COLLECTIONS.map((r) => r.id),
};
const has = (table, id) => (MANIFEST_TABLES[table] ?? []).includes(id);
const SPIRES = new Set(M.SPIRE_IDS);
const FLAGS = new Set(M.FLAG_IDS);

/** Every cond inside a value (keys `cond` and `when`), with a path. */
function condsIn(value, path = '', out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => condsIn(v, `${path}[${i}]`, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if ((k === 'cond' || k === 'when') && v !== undefined) out.push([`${path}.${k}`, v]);
      else condsIn(v, `${path}.${k}`, out);
    }
  }
  return out;
}

/** Story flags (sp./lit.) a cond reads must be manifest flags; sys./th./seen./stamp. are system-owned. */
function flagProblems(cond, path) {
  const out = [];
  const walk = (c) => {
    if (!c || typeof c !== 'object') return;
    if (typeof c.flag === 'string' && /^(sp|lit)\./.test(c.flag) && !FLAGS.has(c.flag)) out.push(`${path}: flag '${c.flag}' is not in FLAG_IDS`);
    if (c.badge !== undefined && typeof c.badge === 'string' && !SPIRES.has(c.badge)) out.push(`${path}: badge '${c.badge}' is not a spire id`);
    if (c.not) walk(c.not);
    for (const l of [c.all, c.any]) if (Array.isArray(l)) l.forEach(walk);
  };
  walk(cond);
  return out;
}

/** All player-facing strings in a value. */
function stringsIn(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => stringsIn(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => stringsIn(v, out));
  return out;
}

const idsOf = (rows) => rows.map((r) => r.id);
const sorted = (a) => [...a].sort();
const inHours = (h, ranges) => ranges.some(([a, b]) => (a <= b ? h >= a && h < b : h >= a || h < b));
const phaseAt = (h) => { let p = 'night'; for (const r of PHASE_TABLE) if (h * 60 >= r.start) p = r.phase; return p; };

// ---------------------------------------------------------------------------------------------
// validator + manifest
// ---------------------------------------------------------------------------------------------

describe('validate-data: collections', () => {
  it('validateData has zero errors for the collections table', () => {
    const { errors } = validateData(OURS, { manifest: M.MANIFEST });
    const mine = errors.filter((e) => e.startsWith('collections:'));
    assert.deepEqual(mine, []);
  });
  it('checkManifest: collections complete, no extra ids', () => {
    const { warnings, notes } = checkManifest(OURS, { collections: M.MANIFEST.collections });
    assert.deepEqual(warnings, []);
    assert.deepEqual(notes, []);
    assert.deepEqual(sorted(idsOf(COLLECTIONS)), sorted(M.MANIFEST.collections.ids));
  });
  it('kinds partition exactly into FISH_IDS, BUG_IDS, FIND_IDS, FRUIT_IDS', () => {
    const of = (k) => COLLECTIONS.filter((r) => r.kind === k).map((r) => r.id);
    assert.deepEqual(of('fish'), [...M.FISH_IDS]);
    assert.deepEqual(of('bug'), [...M.BUG_IDS]);
    assert.deepEqual(of('relic'), [...M.FIND_IDS]);
    assert.deepEqual(of('fruit'), [...M.FRUIT_IDS]);
    assert.ok(Object.isFrozen(COLLECTIONS) && COLLECTIONS.every((r) => Object.isFrozen(r)));
  });
  it('every `when` cond is well-formed and references manifest flags', () => {
    for (const r of COLLECTIONS) {
      if (r.when === undefined) continue;
      assert.deepEqual(validateCond(r.when, { has }, `${r.id}.when`), []);
      assert.deepEqual(flagProblems(r.when, r.id), []);
    }
  });
});

describe('validate-data: town tables against the manifest', () => {
  const exact = (rows, ids, what) => assert.deepEqual(sorted(idsOf(rows)), sorted(ids), what);
  it('furniture 24, clothes 12, roofs 8, commissions 6, Commons 6, festivals 4, weather 5, stamps 24', () => {
    exact(T.FURNITURE, M.FURNITURE_IDS, 'furniture');
    exact(T.CLOTHES, M.CLOTHES_IDS, 'clothes');
    exact(T.ROOF_COLOURS, M.ROOF_COLOUR_IDS, 'roofs');
    exact(T.COMMISSIONS, M.COMMISSION_IDS, 'commissions');
    exact(T.COMMONS_PROJECTS, M.COMMONS_PROJECT_IDS, 'commons');
    exact(T.FESTIVALS, M.FESTIVAL_IDS, 'festivals');
    exact(T.WEATHER, M.WEATHER_IDS, 'weather');
    exact(T.STAMPS, M.STAMP_IDS, 'stamps');
    assert.deepEqual(idsOf(T.STAMPS), [...M.STAMP_IDS], 'stamps in manifest order');
    assert.deepEqual(idsOf(T.FURNITURE), [...M.FURNITURE_IDS], 'furniture in manifest order (cut keeps the first 12)');
  });
  it('every cond in town.js is well-formed, with manifest refs, flags and spire ids', () => {
    const all = condsIn(T.TOWN, 'town');
    assert.ok(all.length >= 40, `found ${all.length} conds`);
    for (const [path, c] of all) {
      assert.deepEqual(validateCond(c, { has }, path), [], path);
      assert.deepEqual(flagProblems(c, path), [], path);
    }
  });
  it('ids are kebab-case and every referenced id resolves in the manifest', () => {
    for (const rows of [T.FURNITURE, T.CLOTHES, T.ROOF_COLOURS, T.COMMISSIONS, T.COMMONS_PROJECTS, T.FESTIVALS, T.WEATHER, T.STAMPS]) {
      for (const r of rows) assert.match(r.id, ID_RE);
    }
    const P = T.PORCH_DUELS;
    for (const n of P.neighbours) {
      assert.ok(M.NPC_IDS.includes(n.npc), n.npc);
      assert.ok(M.TRAINER_IDS.includes(n.trainer), n.trainer);
      assert.ok(M.PORCH_IDS.includes(n.porch), n.porch);
      assert.ok(M.SPECIES_IDS.includes(n.lead), n.lead);
      if (n.leadAfter) assert.ok(M.SPECIES_IDS.includes(n.leadAfter.lead));
    }
    assert.deepEqual(sorted(P.neighbours.map((n) => n.npc)), sorted(['wren', 'tully', 'juniper', 'odile', 'tamsin', 'wick', 'augusta', 'linnet']), 'the 8 neighbours of GDD-00 §8');
    assert.deepEqual(sorted(P.neighbours.map((n) => n.trainer)), sorted(M.TRAINER_IDS.filter((t) => t.startsWith('porch-'))));
    assert.ok(M.PORCH_IDS.includes(P.visitorVenue));
    for (const l of P.leaders) { assert.ok(M.NPC_IDS.includes(l.npc), l.npc); assert.ok(M.TRAINER_IDS.includes(l.trainer), l.trainer); }
    const routeIds = P.routePools.flatMap((p) => p.trainers);
    assert.equal(routeIds.length, 30);
    for (const id of routeIds) assert.ok(M.TRAINER_IDS.includes(id), id);
    for (const p of P.routePools) assert.ok(M.REGION_IDS.includes(p.region));
    for (const c of T.COMMONS_PROJECTS) {
      if (c.script) assert.ok(M.SCRIPT_IDS.includes(c.script), c.script);
      if (c.effect.porch) assert.ok(M.PORCH_IDS.includes(c.effect.porch));
      if (c.effect.npc) assert.ok(M.NPC_IDS.includes(c.effect.npc));
      if (c.effect.festival) assert.ok(M.FESTIVAL_IDS.includes(c.effect.festival));
    }
    for (const f of T.FESTIVALS) {
      for (const e of f.events) if (e.script) assert.ok(M.SCRIPT_IDS.includes(e.script), e.script);
      for (const r of f.rewards) {
        if (r.stamp) assert.ok(M.STAMP_IDS.includes(r.stamp), r.stamp);
        if (r.keepsake) assert.ok(M.KEEPSAKE_IDS.includes(r.keepsake) || M.ITEM_IDS.includes(r.keepsake), r.keepsake);
      }
    }
    for (const s of T.STAMPS) if (s.counter) { assert.match(s.counter.id, /^stamp\./); assert.equal(s.cond.counter, s.counter.id); }
    assert.ok(M.GOODS_IDS.includes(T.TREES.bees.honeycomb));
    for (const id of [...T.TREES.nativePool, ...T.TREES.foreign]) assert.ok(M.FRUIT_IDS.includes(id));
    for (const id of T.TREES.shells.from) assert.ok(M.FIND_IDS.includes(id));
  });
  it('no placeholder text anywhere', () => {
    for (const s of [...stringsIn(COLLECTIONS), ...stringsIn(T.TOWN)]) {
      assert.doesNotMatch(s, /TODO|TBD|PLACEHOLDER|lorem|FIXME|\[GDD\]/i, s);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// collection rules (GDD-00 §7, §9; GDD-ids §14)
// ---------------------------------------------------------------------------------------------

describe('fish', () => {
  it('18 species, 80–4,200, night headliners at their GDD prices', () => {
    assert.equal(FISH.length, 18);
    const prices = FISH.map((f) => f.price);
    assert.equal(Math.min(...prices), 80);
    assert.equal(Math.max(...prices), 4200);
    const by = Object.fromEntries(FISH.map((f) => [f.id, f]));
    assert.equal(by['perch'].price, 80);
    assert.equal(by['john-dory'].price, 2400);
    assert.equal(by['lantern-wolffish'].price, 4200);
    for (const id of ['john-dory', 'lantern-wolffish']) {
      assert.equal(by[id].night, true); assert.equal(by[id].headliner, true); assert.equal(by[id].shadow, 'forked');
    }
    assert.equal(FISH.filter((f) => f.headliner).length, 2);
    assert.ok(by['sea-bass'].price >= 850 && by['sea-bass'].price <= 950, 'sea bass ~900');
  });
  it('shadows, silhouettes, sizes, bite windows (7–31), feints (1–3)', () => {
    for (const f of FISH) {
      assert.ok(['small', 'medium', 'large', 'forked'].includes(f.shadow), f.id);
      assert.ok(['finned', 'round', 'flat', 'ribbon', 'school', 'forked'].includes(f.silhouette), f.id);
      assert.ok(Array.isArray(f.size) && f.size[0] > 0 && f.size[0] < f.size[1], f.id);
      const [a, b] = f.biteFrames;
      assert.ok(Number.isInteger(a) && Number.isInteger(b) && a >= 7 && b <= 31 && a <= b, `${f.id} biteFrames`);
      if (f.feints) assert.ok(f.feints[0] >= 1 && f.feints[1] <= 3 && f.feints[0] <= f.feints[1], `${f.id} feints`);
      assert.ok(f.w > 0 && ['common', 'uncommon', 'rare'].includes(f.rarity), f.id);
      assert.ok(Array.isArray(f.where) && f.where.every((k) => REACH_KINDS.includes(k)), `${f.id} where`);
      assert.ok(f.tide === 'any' || (Array.isArray(f.tide) && f.tide.every((s) => ['low', 'rising', 'high', 'falling'].includes(s))), f.id);
      assert.ok(f.tell && ['shape', 'sound', 'word', 'text'].every((k) => typeof f.tell[k] === 'string' && f.tell[k].length > 0), `${f.id} tell`);
      assert.ok(typeof f.archive === 'string' && f.archive.length > 60, `${f.id} archive`);
      if (f.mods) for (const v of Object.values(f.mods)) assert.ok(v > 0, `${f.id}: mods never zero`);
    }
    // headliners are the tightest windows
    const tightest = Math.max(...FISH.filter((f) => f.headliner).map((f) => f.biteFrames[1]));
    for (const f of FISH.filter((x) => !x.headliner)) assert.ok(f.biteFrames[1] > tightest, `${f.id} wider than the headliners`);
  });
  it('the tell words are unique', () => {
    const words = FISH.map((f) => f.tell.word);
    assert.equal(new Set(words).size, words.length);
  });
  it('hours match night/day/when exactly at every hour', () => {
    for (const row of [...FISH, ...BUGS]) {
      for (let h = 0; h < 24; h += 0.5) {
        const night = h >= 18 || h < 6;
        let active = true;
        if (row.night === true && !night) active = false;
        if (row.day === true && night) active = false;
        if (row.when?.phase && !row.when.phase.includes(phaseAt(h))) active = false;
        assert.equal(inHours(h, row.hours), active, `${row.id} at ${h}h`);
      }
    }
  });
  it('fog pulls the silver schools in; storms stir the storm fish (tags match the weather effects)', () => {
    const silver = FISH.filter((f) => f.tags?.includes('silver')).map((f) => f.id);
    assert.ok(silver.includes('herring') && silver.includes('mackerel'));
    const fogTags = T.WEATHER_TUNING.WEATHER_EFFECTS.fog.filter((e) => e.target === 'fish').map((e) => e.tag);
    const stormTags = T.WEATHER_TUNING.WEATHER_EFFECTS.storm.filter((e) => e.target === 'fish').map((e) => e.tag);
    assert.ok(fogTags.includes('silver'));
    assert.ok(stormTags.every((tag) => FISH.some((f) => f.tags?.includes(tag))));
    assert.ok(FINDS.filter((f) => f.group === 'shore').every((f) => f.tags?.includes('shore')));
  });
});

describe('fish in the shadow sim (systems/fishing)', () => {
  const MAP = {
    id: 'pellwick', region: 'pellwick',
    reaches: [
      { id: 'river-mouth', kind: 'river', area: { x: 0, y: 0, w: 6, h: 3 } },
      { id: 'quay-east', kind: 'quay', area: { x: 10, y: 0, w: 6, h: 3 } },
      { id: 'point-channel', kind: 'flats', area: { x: 20, y: 0, w: 6, h: 3 } },
      { id: 'north-creek', kind: 'creek', area: { x: 30, y: 0, w: 4, h: 3 }, cond: { flag: 'sp.weir-turned' } },
      { id: 'old-quay', kind: 'old-quay', area: { x: 40, y: 0, w: 4, h: 3 } },
      { id: 'night-sea', kind: 'sea', area: { x: 50, y: 0, w: 6, h: 3 } },
    ],
  };
  const DATAX = { collections: COLLECTIONS };
  const world = (flags = {}) => { const w = createNewWorld({ seedCode: 'TOWN-LIFE' }); Object.assign(w.flags, flags); return w; };
  const ENVS = [];
  for (const total of [1440 + 9 * 60, 1440 + 18 * 60, 1440 + 23 * 60, 1440 + 5.5 * 60]) {
    for (const tideState of ['low', 'rising', 'high', 'falling']) {
      for (const weatherKind of ['clear', 'fog', 'storm']) {
        const h = (total % 1440) / 60;
        ENVS.push({ total, tideState, weather: weatherKind, phase: phaseAt(h) });
      }
    }
  }
  it('every fish can bite somewhere in Pellwick under some clock, tide and weather', () => {
    const w = world({ 'sp.weir-turned': true });
    const seen = new Set();
    for (const env of ENVS) for (const reach of MAP.reaches) for (const r of fishing.fishFor(w, MAP, reach, { data: DATAX, ...env })) seen.add(r.id);
    assert.deepEqual(sorted(seen), sorted(M.FISH_IDS));
  });
  it('every reach has fish by day and by night (the creek once the weir turns)', () => {
    const w = world({ 'sp.weir-turned': true });
    for (const reach of MAP.reaches.filter((r) => r.kind !== 'old-quay' && r.kind !== 'sea' && r.kind !== 'flats')) {
      for (const total of [1440 + 10 * 60, 1440 + 22 * 60]) {
        const n = fishing.fishFor(w, MAP, reach, { data: DATAX, total, tideState: 'rising', phase: phaseAt((total % 1440) / 60) }).length;
        assert.ok(n >= 2, `${reach.id} at ${total % 1440}: ${n}`);
      }
    }
    const flats = MAP.reaches.find((r) => r.kind === 'flats');
    assert.ok(fishing.fishFor(w, MAP, flats, { data: DATAX, total: 1440 + 600, tideState: 'low', phase: 'morning' }).length >= 3);
    assert.ok(fishing.fishFor(w, MAP, flats, { data: DATAX, total: 1440 + 1380, tideState: 'low', phase: 'night' }).length >= 3);
  });
  it('the grayling waits for the weir; the north creek is empty until then', () => {
    const creek = MAP.reaches.find((r) => r.id === 'north-creek');
    const ctx = { data: DATAX, total: 1440 + 600, tideState: 'rising', phase: 'morning' };
    assert.ok(!fishing.fishFor(world(), MAP, creek, ctx).some((r) => r.id === 'grayling'));
    assert.ok(fishing.fishFor(world({ 'sp.weir-turned': true }), MAP, creek, ctx).some((r) => r.id === 'grayling'));
    const view = fishing.reachShadows(world(), MAP, creek, makeRng(3), { ...ctx, lead: null });
    assert.equal(view.empty, true);
  });
  it('night quay shadows include forked-tail headliners across seeds, and casting works', () => {
    const quay = MAP.reaches.find((r) => r.id === 'quay-east');
    let headliners = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const w = world();
      const view = fishing.reachShadows(w, MAP, quay, makeRng(seed), { data: DATAX, lead: null, total: 1440 + 23 * 60, tideState: 'high', phase: 'night' });
      assert.ok(view.shadows.length >= 4 && view.shadows.length <= 8);
      for (const s of view.shadows) if (s.headliner) { headliners++; assert.equal(s.silhouette, 'forked'); }
      const sess = fishing.cast(w, MAP, quay.id, view.shadows, null, makeRng(seed + 100), { data: DATAX, lead: null, total: 1440 + 23 * 60, tideState: 'high', phase: 'night' });
      assert.ok(sess && sess.plan.biteWindow >= 7 && sess.plan.biteWindow <= 31);
    }
    assert.ok(headliners > 0);
  });
  it('a Brine lead widens the window ×1.5 and names species (the Crossovers table works on these rows)', () => {
    const quay = MAP.reaches.find((r) => r.id === 'quay-east');
    const ctx = { data: { collections: COLLECTIONS, tuning: { creatureBonuses: T.CREATURE_BONUSES } }, total: 1440 + 600, tideState: 'high', phase: 'morning' };
    const view = fishing.reachShadows(world(), MAP, quay, makeRng(9), { ...ctx, lead: { types: ['Brine'] } });
    assert.ok(view.shadows.every((s) => s.named));
    assert.equal(fishing.windowFrames(20, 'standard', fieldLog.bonusForTypes(['brine'], ctx).biteWindowMult), 30);
  });
});

describe('bugs', () => {
  it('10 bugs, 60–900, movement, spook and habitat for each', () => {
    assert.equal(BUGS.length, 10);
    const prices = BUGS.map((b) => b.price);
    assert.equal(Math.min(...prices), 60);
    assert.equal(Math.max(...prices), 900);
    for (const b of BUGS) {
      assert.ok(typeof b.move === 'string' && b.move.length > 20, b.id);
      assert.ok(b.spook > 0 && b.spook <= 2, b.id);
      assert.ok(b.wary >= 0 && b.wary < 0.5, b.id);
      assert.ok(b.habitat.length > 0 && b.habitat.every((h) => BUG_HABITATS.includes(h)), b.id);
      assert.ok(typeof b.archive === 'string' && b.archive.length > 60, b.id);
      if (b.where) assert.ok(b.where.every((m) => M.MAP_IDS.includes(m) || M.REGION_IDS.includes(m)), b.id);
      if (b.mods) for (const v of Object.values(b.mods)) assert.ok(v > 0, `${b.id}: weather leans, never locks`);
    }
    assert.ok(BUGS.filter((b) => b.moth).length >= 3, 'moths at lamps and string lights');
    assert.ok(BUGS.every((b) => !b.weather), 'no bug is weather-locked');
  });
  it('walking 2 tiles is safe for most; running spooks most (systems/gather spook radii)', () => {
    const walkSafe = BUGS.filter((b) => gather.spookRadius(b, 'walk') <= 2).length;
    const runSpooks = BUGS.filter((b) => gather.spookRadius(b, 'run') >= 3).length;
    assert.ok(walkSafe >= 7, `walk-safe ${walkSafe}`);
    assert.ok(runSpooks >= 7, `run spooks ${runSpooks}`);
    for (const b of BUGS) assert.equal(gather.spookRadius(b, 'creep'), 0);
  });
  it('lit porches at night draw moths; a Bolt lead draws them harder (systems/gather.rollBugs)', () => {
    const map = { id: 'pellwick', region: 'pellwick' };
    const spots = Array.from({ length: 40 }, (_, i) => ({ x: i, y: 0, lit: true }));
    const w = createNewWorld({ seedCode: 'TOWN-LIFE' });
    const night = { data: { collections: COLLECTIONS, tuning: { creatureBonuses: T.CREATURE_BONUSES } }, total: 1440 + 22 * 60, tideState: 'rising', phase: 'night', weather: 'clear' };
    const plain = gather.rollBugs(w, map, spots, makeRng(4), { ...night, lead: null });
    const bolt = gather.rollBugs(w, map, spots, makeRng(4), { ...night, lead: { types: ['Bolt'] } });
    const moths = (list) => list.filter((b) => COLLECTIONS.find((r) => r.id === b.id).moth).length;
    assert.ok(plain.length > 0);
    assert.ok(moths(plain) > 0);
    assert.ok(moths(bolt) >= moths(plain));
  });
});

describe('finds', () => {
  const by = Object.fromEntries(FINDS.map((f) => [f.id, f]));
  it('6 fossils, 6 relics (3 skyglass), 6 shore finds, each with its town letter t1–t18 in order', () => {
    const groups = (g) => FINDS.filter((f) => f.group === g).map((f) => f.id);
    assert.deepEqual(groups('fossil'), M.FIND_IDS.slice(0, 6));
    assert.deepEqual(groups('relic'), M.FIND_IDS.slice(6, 12));
    assert.deepEqual(groups('shore'), M.FIND_IDS.slice(12, 18));
    assert.deepEqual(FINDS.filter((f) => f.skyglass).map((f) => f.id), ['skyglass-shard', 'skyglass-bead', 'skyglass-knot']);
    FINDS.forEach((f, i) => assert.equal(f.letter, `t${i + 1}`, f.id));
    for (const f of FINDS) assert.ok(M.LETTER_IDS.includes(f.letter));
  });
  it('prices: fossils and relics 300–1,500, shore 100–400, skyglass 900 to Barnaby or 1 Starsalt', () => {
    for (const f of FINDS) {
      if (f.group === 'shore') assert.ok(f.price >= 100 && f.price <= 400, f.id);
      else assert.ok(f.price >= 300 && f.price <= 1500, f.id);
      assert.ok(typeof f.archive === 'string' && f.archive.length > 60, f.id);
    }
    for (const id of ['skyglass-shard', 'skyglass-bead', 'skyglass-knot']) {
      assert.equal(by[id].archivePrice, 900);
      assert.deepEqual(by[id].refinesTo, { starsalt: 1 });
      assert.deepEqual(by[id].source, ['skyglass'], 'night low only');
    }
  });
  it('sources feed the dig pools (systems/gather.findPool) for cracks, sparkles, skyglass and the rake', () => {
    const data = { collections: COLLECTIONS };
    const pw = { id: 'pellwick', region: 'pellwick' };
    const crack = gather.findPool(data, pw, 'crack').map((e) => e.id);
    const sparkle = gather.findPool(data, pw, 'sparkle').map((e) => e.id);
    const sky = gather.findPool(data, pw, 'skyglass').map((e) => e.id);
    assert.ok(['ammonite', 'belemnite', 'urchin-cast', 'old-shape-skull', 'postmark-die'].every((id) => crack.includes(id)));
    assert.ok(sparkle.includes('cockle') && sparkle.includes('brass-tide-gauge') && sparkle.includes('fleet-tally-token'));
    assert.deepEqual(sorted(sky), sorted(['skyglass-shard', 'skyglass-bead', 'skyglass-knot']));
    assert.ok(gather.findPool(data, pw, 'rake').some((e) => e.id === 'cockle'));
    // every find has at least one place to come from in the ring of isles
    const maps = [...M.REGION_IDS].map((id) => ({ id, region: id }));
    for (const f of FINDS) {
      const ok = maps.some((m) => f.source.some((s) => gather.findPool(data, m, s).some((e) => e.id === f.id)));
      assert.ok(ok, `${f.id} has a source`);
    }
    for (const f of FINDS.filter((x) => x.group === 'fossil')) assert.ok(!f.source.includes('skyglass'));
  });
  it('fossils are cleanable by a Kiln lead (group fossil); nothing else is', () => {
    for (const f of FINDS) assert.equal(f.group === 'fossil', ['ammonite', 'belemnite', 'crinoid-stem', 'fossil-fern', 'urchin-cast', 'old-shape-skull'].includes(f.id));
  });
});

describe('fruit', () => {
  it('native 120 / ripe 150, foreign 480 / ripe 600 (ripe +25%)', () => {
    for (const f of FRUIT) {
      if (f.origin === 'native') assert.deepEqual([f.price, f.ripePrice], [120, 150], f.id);
      else assert.deepEqual([f.price, f.ripePrice], [480, 600], f.id);
      assert.equal(f.ripePrice, Math.round(f.price * 1.25));
    }
    assert.deepEqual(FRUIT.filter((f) => f.origin === 'native').map((f) => f.id), T.TREES.nativePool);
    assert.deepEqual(FRUIT.filter((f) => f.origin === 'foreign').map((f) => f.id), T.TREES.foreign);
  });
  it('every creature type has exactly one favourite fruit (Greenhouse +1 Bond)', () => {
    const all = FRUIT.flatMap((f) => f.favouredBy);
    assert.deepEqual(sorted(all), sorted(M.TYPE_IDS));
  });
  it('a shaken tree pays the row price (systems/gather.shakeTree reads price / ripePrice)', () => {
    const map = { id: 'pellwick', region: 'pellwick', entities: [{ kind: 'tree', id: 'pt-1', x: 1, y: 1, fruit: 'pear' }] };
    const w = createNewWorld({ seedCode: 'TOWN-LIFE' });
    const got = [];
    const res = gather.shakeTree(w, map, 'pt-1', makeRng(1), { data: { collections: COLLECTIONS }, lead: null, day: 5, give: (id, n) => got.push([id, n]) });
    assert.equal(res.fruit.id, 'pear');
    assert.equal(res.fruit.value, res.fruit.ripe ? 150 : 120);
    assert.deepEqual(got, [['pear', 1]]);
  });
});

// ---------------------------------------------------------------------------------------------
// town tables against the systems that read them
// ---------------------------------------------------------------------------------------------

describe('town.js', () => {
  it('trees: ~100 grove trees, 6 purse trees, ~4 bee trees, GDD-00 rules', () => {
    const t = T.TREES;
    const trees = t.groves.reduce((n, g) => n + g.trees, 0);
    assert.ok(trees >= 95 && trees <= 105, `${trees} trees`);
    assert.equal(t.groves.reduce((n, g) => n + g.purse, 0), 6);
    assert.equal(t.groves.reduce((n, g) => n + g.bees, 0), 4);
    assert.deepEqual([t.fruitPerTree, t.regrowDays, t.ripeDays, t.ripeMult, t.bees.humMs, t.bees.honeycombPrice], [3, 2, 3, 1.25, 1000, 350]);
    assert.deepEqual(t.purse.range, [200, 600]);
    assert.equal(t.purse.trees, 6);
    const g = gather.DEFAULTS;
    assert.deepEqual([g.fruitPerTree, g.regrowDaysDefault, g.fruitRipeDays, g.fruitRipeMult, g.hiveHumMs], [t.fruitPerTree, t.regrowDays, t.ripeDays, t.ripeMult, t.bees.humMs]);
  });
  it('furniture and clothes 200–6,000 (gifts and starters free)', () => {
    for (const f of T.FURNITURE) {
      assert.ok(f.price >= 200 && f.price <= 6000, f.id);
      assert.ok(Array.isArray(f.size) && f.size.every((n) => Number.isInteger(n) && n >= 1 && n <= 2), f.id);
      assert.ok(f.source.every((s) => ['pells', 'market', 'ambrose', 'gift'].includes(s)), f.id);
      if (f.source.includes('ambrose')) assert.ok(Number.isInteger(f.timber) && f.timber > 0, `${f.id} timber`);
    }
    assert.equal(T.FURNITURE.filter((f) => f.survivesCut).length, 12);
    assert.ok(T.FURNITURE.slice(0, 12).every((f) => f.survivesCut));
    for (const c of T.CLOTHES) {
      assert.ok(['top', 'bottom', 'shoes', 'hat', 'accessory'].includes(c.slot), c.id);
      if (c.source.some((s) => s === 'pells' || s === 'market')) assert.ok(c.price >= 200 && c.price <= 6000, c.id);
      else assert.equal(c.price, 0, c.id);
    }
  });
  it('roof colours: hexes from the palette, slate blue the default, art keys exist', () => {
    assert.equal(T.ROOF_COLOURS.filter((r) => r.isDefault).length, 1);
    assert.equal(T.ROOF_COLOURS[0].id, 'slate-blue');
    assert.ok(T.ROOF_COLOURS[0].isDefault);
    for (const r of T.ROOF_COLOURS) {
      assert.equal(r.hexes.length, 4);
      r.ramp.forEach((k, i) => assert.equal(r.hexes[i], COLORS[k], `${r.id} ${k}`));
      for (const h of r.hexes) assert.match(h, /^#[0-9A-F]{6}$/i);
      if (r.artKey !== null) assert.ok(ART_ROOF_KEYS.includes(r.artKey), `${r.id} art key ${r.artKey}`);
    }
    assert.equal(new Set(T.ROOF_COLOURS.map((r) => r.hexes[2])).size, 8, 'eight distinct base colours');
  });
  it('Commons projects: town effects line up with economy\'s loans.js rows; systems/loans accepts the merge', () => {
    const econ = Object.fromEntries(ECON_COMMONS.map((p) => [p.id, p]));
    assert.deepEqual(sorted(Object.keys(econ)), sorted(M.COMMONS_PROJECT_IDS));
    const cost = Object.fromEntries(ECON_COMMONS.map((p) => [p.id, p.cost]));
    assert.deepEqual(cost, { 'dark-house-1': 3000, 'quay-lamps': 4000, 'mudlark-mile-flags': 5000, 'north-creek-footbridge': 6000, 'training-yard-green': 10000, 'third-stall': 12000 });
    for (const p of T.COMMONS_PROJECTS) {
      assert.ok(!('cost' in p) && !('neighborShare' in p), `${p.id}: cost and share stay in loans.js`);
      if (econ[p.id].cond !== undefined || p.cond?.badge !== undefined) assert.deepEqual(p.cond, econ[p.id].cond, `${p.id} cond agrees`);
      assert.ok(typeof p.built === 'string' && p.built.length > 20);
    }
    const merged = ECON_COMMONS.map((e) => ({ ...e, ...T.COMMONS_PROJECTS.find((p) => p.id === e.id) }));
    assert.equal(loans.tuningOf({ commonsProjects: merged }).commonsProjects.length, 6);
    for (const c of T.COMMISSIONS) {
      assert.ok(ECON_COMMISSIONS.some((e) => e.id === c.id), c.id);
      assert.ok(c.offer.length > 20 && c.morning.length > 20, c.id);
    }
  });
  it('festivals: schedule.js accepts the rows; the Lantern Market runs Saturdays 20:00–02:00 from day 7', () => {
    const t = schedule.tuningOf(null, { tuning: { festivals: T.FESTIVALS } });
    assert.equal(t.festivals.length, 4);
    const lm = T.FESTIVALS.find((f) => f.id === 'lantern-market');
    assert.deepEqual([lm.dow, lm.fromDay, lm.from, lm.to], [[5], 7, 1200, 120]);
    const def = schedule.DEFAULT_FESTIVALS.find((f) => f.id === 'lantern-market');
    assert.deepEqual([lm.dow, lm.fromDay, lm.from, lm.to], [[...def.dow], def.fromDay, def.from, def.to]);
    // Saturday day 7 at 21:00 (core day 6): market on; day 6 (a Friday): off
    const w = createNewWorld({ seedCode: 'TOWN-LIFE' });
    w.clock.total = 6 * 1440 + 21 * 60;
    assert.ok(schedule.isFestival('lantern-market', w, { festivals: T.FESTIVALS }));
    w.clock.total = 5 * 1440 + 21 * 60;
    assert.ok(!schedule.isFestival('lantern-market', w, { festivals: T.FESTIVALS }));
    const mm = T.FESTIVALS.find((f) => f.id === 'mudlark-mile');
    assert.ok(mm.days.every((d) => d % 7 === 0), 'spring lows fall on every 7th day');
    for (const f of T.FESTIVALS) {
      assert.ok(f.events.length >= 2 && f.rewards.length >= 1, f.id);
      assert.ok(typeof f.text === 'string' && f.text.length > 20);
    }
  });
  it('Porch Duels: 3 a day, 30 × curve, curve = next Spire ace − 3, never more than three creatures', () => {
    const P = T.PORCH_DUELS;
    assert.equal(P.offersPerDay, 3);
    assert.equal(P.payoutPerCurveLevel, 30);
    const aces = [9, 16, 22, 29, 36, 43, 50];
    assert.deepEqual(P.curveByBadges, aces.map((a) => a - 3));
    assert.equal(P.payoutPerCurveLevel * P.curveByBadges[3], 780, 'Day 10: a Porch Duel with Osric pays 780');
    assert.deepEqual(P.hours, [19 * 60, 60], 'porch talk 19:00–01:00');
    assert.equal(P.partySizeByBadges.length, 7);
    assert.ok(P.partySizeByBadges.every((n) => n >= 1 && n <= 3));
  });
  it('Crossovers: exactly the GDD-00 §9 table, accepted by systems/fieldLog', () => {
    assert.deepEqual(JSON.parse(JSON.stringify(T.CREATURE_BONUSES)), JSON.parse(JSON.stringify(fieldLog.DEFAULTS.creatureBonuses)));
    const t = fieldLog.tuningOf({ creatureBonuses: T.CREATURE_BONUSES });
    assert.equal(t.creatureBonuses, T.CREATURE_BONUSES);
    for (const type of Object.keys(T.CREATURE_BONUSES)) assert.ok(M.TYPE_IDS.includes(type), type);
    const covered = T.CROSSOVERS.flatMap((c) => c.types);
    assert.deepEqual(sorted(covered), sorted(M.TYPE_IDS), 'every type has a lead-card line');
    const ctx = { tuning: { creatureBonuses: T.CREATURE_BONUSES } };
    assert.equal(fieldLog.bonusForTypes(['Gust'], ctx).shakeAllFruit, true);
    assert.equal(fieldLog.bonusForTypes(['Brine', 'Stone'], ctx).extraCracks, 1);
    assert.equal(fieldLog.bonusForTypes(['Plain'], ctx).extraShadows, 0);
  });
  it('weather: systems/weather accepts the kind rows and the tuning values', () => {
    const kinds = weather.kinds({ weather: T.WEATHER });
    for (const id of M.WEATHER_IDS) assert.ok(kinds.has(id), id);
    const tuning = weather.tuningOf({ tuning: T.WEATHER_TUNING });
    assert.equal(tuning.WEATHER_WEIGHTS.snow, 0, 'one season: no snow');
    for (const id of M.WEATHER_IDS) assert.ok(tuning.WEATHER_WEIGHTS[id] > 0, id);
    for (const row of T.WEATHER) {
      assert.deepEqual(row.effects, T.WEATHER_TUNING.WEATHER_EFFECTS[row.id]);
      for (const e of row.effects) assert.ok(weather.EFFECT_TARGETS.includes(e.target) && e.mult > 0);
      assert.ok(row.town && row.augusta && row.ansel, row.id);
    }
    assert.ok(T.WEATHER_TUNING.WEATHER_EFFECTS.rain.some((e) => e.target === 'bug'), 'rain brings bugs');
    assert.ok(T.WEATHER_TUNING.WEATHER_EFFECTS.storm.some((e) => e.target === 'errant'), 'storms put Errant lightning on the sea');
    assert.ok(T.WEATHER_TUNING.WEATHER_EFFECTS.fog.some((e) => e.target === 'fish' && e.tag === 'silver'), 'fog pulls silver schools in');
  });
  it('Day Page: a template for every Tomorrow kind; the list begins "Tomorrow:"', () => {
    for (const kind of TOMORROW_ORDER) assert.ok(typeof T.TOMORROW[kind] === 'string' && T.TOMORROW[kind].length > 0, kind);
    assert.equal(T.DAY_PAGE.tomorrowHeading, 'Tomorrow:');
    assert.ok(T.DAY_PAGE.tomorrowEmpty.startsWith('Tomorrow:'));
    assert.equal(T.DAY_PAGE.saved, 'Saved, verified.');
    assert.match(T.DAY_PAGE.notSaved, /^Not saved/);
    for (const k of ['buttons', 'loan', 'catches', 'people', 'shifts']) assert.ok(T.DAY_PAGE.sections[k], k);
  });
  it('stamps: 24, each with a cond; counters bump on real bus events', () => {
    assert.equal(T.STAMPS.length, 24);
    const events = new Set(['capture:ok', 'stat:inc', 'fieldLog:read', 'fieldLog:held', 'gather:skyglass', 'battle:end', 'letter:heirloom', 'encounter:errant-down']);
    for (const s of T.STAMPS) {
      assert.ok(s.cond && typeof s.cond === 'object', s.id);
      assert.ok(typeof s.name === 'string' && typeof s.text === 'string' && s.text.length > 20, s.id);
      if (s.counter) assert.ok(events.has(s.counter.on), `${s.id}: ${s.counter.on}`);
    }
    assert.equal(T.STAMPS.find((s) => s.id === 'every-plate').cond.gte, M.SPECIES_IDS.length);
    assert.equal(T.STAMPS.find((s) => s.id === 'someone-picked-you').name, 'Someone Picked You');
  });
});
