// World reachability and content audit (GDD-00 §4, §10, §12; GDD-01 §17): proves with BFS over
// world/tilemap + the clockSys tide windows that the world is walkable as designed (tools/map-reachability),
// and that the maps carry every marker the cast and story chapters place people by.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  proveWorld, snapshot, reachWorld, walkable, highWater, lowsOf, allFlags, START,
} from '../tools/map-reachability.mjs';
import { MAPS, MAPS_BY_ID } from '../js/data/maps/index.js';
import { ENCOUNTERS } from '../js/data/encounters/index.js';
import { REGIONS } from '../js/data/regions.js';
import { TRAINERS } from '../js/data/trainers.js';
import { PORCH_IDS, NPC_IDS, TRAINER_IDS } from '../js/data/ids.manifest.js';

const results = proveWorld();
const pw = MAPS_BY_ID.pellwick;
const high = snapshot(highWater(3), {});
const lower = snapshot(lowsOf(3).lower, allFlags());
const reachHigh = reachWorld(high);

/** A marker stands where a person can: walkable at high water, or at the lower low for tide:'low' markers (onSolid / water markers are props and boats). */
function markerOk(mapId, name) {
  const mk = MAPS_BY_ID[mapId].markers?.[name];
  if (!mk) return `${mapId}: no marker '${name}'`;
  if (mk.onSolid || mk.water) return null;
  const snap = mk.tide === 'low' || mk.spring ? lower : high;
  if (mk.spring) return null; // the Old Quay: spring lows only (checked by the world test)
  return walkable(snap, mapId, mk.x, mk.y) || walkable(lower, mapId, mk.x, mk.y) ? null : `${mapId}: marker '${name}' (${mk.x},${mk.y}) is not walkable`;
}

// ---------------------------------------------------------------------------------------------
// the proof
// ---------------------------------------------------------------------------------------------

test('map-reachability: every claim holds', () => {
  const failed = results.filter((r) => !r.ok).map((r) => `${r.claim}${r.detail ? `: ${r.detail}` : ''}`);
  assert.deepEqual(failed, []);
  assert.ok(results.length >= 40, `${results.length} claims`);
});

test('high water: from the cottage door every Waystone, Spire, interior and isle is reached on foot', () => {
  for (const id of ['lowmoor', 'cairnhold', 'emberstep', 'drownwood', 'thistlewind', 'rimeholt', 'int-cottage', 'int-pells', 'int-post-office', 'int-archive', 'int-yard-shed', 'int-lighthouse',
    'spire-turn', 'spire-ward', 'spire-weather', 'spire-hollow', 'spire-relay', 'spire-mirror']) assert.ok(reachHigh.has(id), id);
  for (const id of ['the-bar', 'hollis-gate', 'keepers-hall', 'idris-hall', 'lantern-stack']) assert.ok(!reachHigh.has(id), `${id} is behind a tide way or a flag`);
  assert.deepEqual([START.mapId, START.x, START.y], ['pellwick', 9, 23]);
});

test('the Bar: Shardcrown at the lower low or any tide after lit.bar; the Lantern Stack at every low by the spur', () => {
  const lit = reachWorld(snapshot(highWater(5), { 'lit.bar': true }));
  assert.ok(lit.has('hollis-gate') && !lit.has('lantern-stack'));
  const lo = lowsOf(5);
  const atLower = reachWorld(snapshot(lo.lower, {}));
  const atOther = reachWorld(snapshot(lo.other, {}));
  assert.ok(atLower.has('hollis-gate') && atLower.has('lantern-stack'));
  assert.ok(!atOther.has('hollis-gate') && atOther.has('lantern-stack'));
});

// ---------------------------------------------------------------------------------------------
// cast markers (GDD-00 §10): home door, porch, work post for every scheduled resident
// ---------------------------------------------------------------------------------------------

/** [npc, home door, porch, work post] on Pellwick (GDD-01 §5 marker table). */
const RESIDENTS = [
  ['wren', 'door-coop-yard', 'porch-coop-yard-step', 'wren-yard'],
  ['ambrose', 'door-coop-yard', 'porch-coop-yard-step', 'ambrose-bench'],
  ['hesper', 'door-post-office', 'porch-post-office-step', 'hesper-post-step'],
  ['juniper', 'door-pells', 'porch-pells-step', 'juniper-pells-step'],
  ['ludo', 'ludo-eave', 'porch-post-office-step', 'ludo-eave'],
  ['barnaby', 'door-archive', 'porch-archive-step', 'barnaby-archive-step'],
  ['augusta', 'door-wardens-house', 'porch-wardens-house-step', 'augusta-commons-board'],
  ['ansel', 'ansel-launch', 'ansel-launch', 'ansel-creek'],
  ['wick', 'door-dorrow', 'porch-dorrow-step', 'wick-cliff-stair'],
  ['tully', 'door-tully', 'porch-tully-step', 'tully-lap-1'],
  ['odile', 'door-odile', 'porch-odile-step', 'odile-easel'],
  ['bryony', 'door-bryony', 'porch-bryony-step', 'bryony-beans'],
  ['thessaly', 'door-thessaly', 'porch-thessaly-step', 'thessaly-bench'],
  ['tamsin', 'door-dark-1', 'porch-dark-1-step', 'tamsin-flats'],
  ['corin', 'door-archive', 'porch-archive-step', 'corin-step'],
  ['linnet', 'door-linnet', 'porch-linnet-step', 'linnet-porch'],
  ['dimity', 'door-keepers-cottage', 'porch-keepers-cottage-step', 'dimity-lamp'],
  ['maud', 'maud-berth', 'maud-berth', 'maud-punt'],
  ['merrow', 'door-anchorage', 'door-anchorage', 'merrow-anchorage'],
  ['varga', 'raft-berth', 'raft-berth', 'varga-raft'],
  ['dov', 'market-green', 'market-green', 'dov-stall'],
  ['pip', 'pip-quay', 'pip-quay', 'pip-quay'],
];

test('every scheduled resident has a home door, a porch and a work post marker on Pellwick, all standable', () => {
  const bad = [];
  for (const [npc, ...names] of RESIDENTS) for (const n of names) { const e = markerOk('pellwick', n); if (e) bad.push(`${npc}: ${e}`); }
  assert.deepEqual(bad, []);
});

test('every NPC in the manifest has at least one marker (by name or npc field) somewhere in the world', () => {
  const names = new Map();
  for (const m of MAPS) for (const [k, v] of Object.entries(m.markers ?? {})) { names.set(k, m.id); if (v.npc) names.set(`npc:${v.npc}`, m.id); }
  const missing = NPC_IDS.filter((id) => id !== 'isolde' && !names.has(`npc:${id}`) && ![...names.keys()].some((k) => k === id || k.startsWith(`${id}-`)));
  assert.deepEqual(missing, [], 'Isolde is absent (the Outer Isles); everyone else stands somewhere');
});

// ---------------------------------------------------------------------------------------------
// the first 30 minutes (GDD-00 §12): a staging marker per beat
// ---------------------------------------------------------------------------------------------

const BEATS = {
  'walk in over the closing causeway': ['arrival-start', 'causeway-foam'],
  'Wren and the lease card': ['wren-causeway', 'lease-card-player'],
  'three creatures on the last dry stones': ['starter-sloshkin', 'starter-scrapling', 'starter-reedkit', 'starter-kneel'],
  'Wick on the cliff stair; the bedsit': ['wick-cliff-stair', 'door-keepers-cottage'],
  'Corin on your step': ['corin-step', 'cottage-porch'],
  'Linnet vaults the fence; Maud from her punt': ['linnet-vault-to', 'trainer-linnet-dock', 'maud-punt-dock'],
  'the errands clipboard': ['wick-errands'],
  'apron at the yard; the Commons board; the neighbours': ['yard-apron', 'commons-pin', 'tully-nickname', 'meet-odile', 'meet-bryony', 'meet-thessaly'],
  'six trees, a purse, the bee hum': ['first-orchard'],
  'the mail sack; Hesper\'s lamp': ['mail-sack', 'post-office-door'],
  'the reeds: Capture Stance, first catch': ['reeds-stance', 'reeds-tossup'],
  'Barnaby\'s porthole': ['archive-porthole'],
  'Ansel\'s tells': ['ansel-launch', 'ansel-tells-player', 'piling'],
  'Pip the dock hand': ['pip-quay', 'pip-player'],
  'sell to Ludo': ['ludo-eave', 'ludo-sale'],
  'the yard by lamplight: THWAP': ['yard-payment', 'ambrose-bench'],
  'the porchlight and Dimity; the Prismoth': ['porchlight-player', 'dimity-lamp', 'prismoth-lamp'],
  'Tully\'s porch, beat 1': ['tully-porch'],
  'Corin\'s slip': ['corin-slip'],
  'night fishing': ['night-fishing'],
  'the flats glow: the Glint': ['glowing-flats', 'glint-hint'],
  'the Thatch tie off your roof': ['thatch-roof'],
  'K1 at the mailbox': ['mailbox-front'],
  'stones (or boardwalk) to Lowmoor': ['stones-start', 'boardwalk-start'],
};

test('every first-30-minute beat has its staging markers on Pellwick', () => {
  const bad = [];
  for (const [beat, names] of Object.entries(BEATS)) for (const n of names) { if (!pw.markers[n]) bad.push(`${beat}: '${n}'`); else { const e = markerOk('pellwick', n); if (e) bad.push(`${beat}: ${e}`); } }
  assert.deepEqual(bad, []);
});

// ---------------------------------------------------------------------------------------------
// trainers: a post marker on its map, under both names
// ---------------------------------------------------------------------------------------------

test('every manifest trainer has trainer-<id> and its data/trainers `post` marker on its map, same cell, standable', () => {
  const rows = new Map(TRAINERS.map((r) => [r.id, r]));
  const bad = [];
  for (const id of TRAINER_IDS) {
    const r = rows.get(id);
    if (!r) { bad.push(`${id}: no trainers row`); continue; }
    const m = MAPS_BY_ID[r.map];
    if (!m) { bad.push(`${id}: map '${r.map}'`); continue; }
    const a = m.markers?.[`trainer-${id}`];
    const b = m.markers?.[r.post];
    if (!a) bad.push(`${id}: no trainer-${id} on ${r.map}`);
    if (!b) bad.push(`${id}: no post '${r.post}' on ${r.map}`);
    if (a && b && (a.x !== b.x || a.y !== b.y)) bad.push(`${id}: trainer-${id} and '${r.post}' differ`);
    if (a && a.trainer !== id) bad.push(`${id}: trainer-${id}.trainer is '${a.trainer}'`);
    if (a) { const e = markerOk(r.map, `trainer-${id}`); if (e) bad.push(e); }
  }
  assert.deepEqual(bad, []);
});

// ---------------------------------------------------------------------------------------------
// porches and trees (GDD-00 §4)
// ---------------------------------------------------------------------------------------------

test('20 porches with the PORCH_IDS; the seven lit at arrival are the GDD\'s seven', () => {
  const porches = pw.entities.filter((e) => e.porch);
  assert.deepEqual(porches.map((p) => p.id).sort(), [...PORCH_IDS].sort());
  assert.deepEqual(porches.filter((p) => p.litAtStart).map((p) => p.id).sort(),
    ['porch-archive', 'porch-coop-yard', 'porch-linnet', 'porch-pells', 'porch-post-office', 'porch-tully', 'porch-wardens-house']);
  for (const p of porches) {
    assert.ok(walkable(high, 'pellwick', p.step.x, p.step.y), `${p.id} step`);
    assert.ok(pw.markers[`${p.id}-step`], `${p.id}-step marker`);
  }
});

test('~100 named fruit trees, 6 purse trees, ~4 bee trees; every tree can be shaken from a cell reached at high water', () => {
  const trees = pw.entities.filter((e) => e.kind === 'tree');
  const fruit = trees.filter((t) => t.fruitFrom === 'native' || t.fruit);
  const purse = trees.filter((t) => t.purse);
  const bee = trees.filter((t) => t.hive);
  assert.ok(fruit.length >= 90 && fruit.length <= 110, `${fruit.length} fruit trees`);
  assert.equal(purse.length, 6);
  assert.ok(bee.length >= 3 && bee.length <= 5, `${bee.length} bee trees`);
  assert.equal(new Set(trees.map((t) => t.name)).size, trees.length, 'tree names are unique');
  const reached = reachHigh.get('pellwick');
  const lonely = trees.filter((t) => ![[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => reached.has((t.y + dy) * pw.w + t.x + dx)));
  assert.deepEqual(lonely.map((t) => t.id), []);
});

// ---------------------------------------------------------------------------------------------
// encounter bands (GDD-00 §4)
// ---------------------------------------------------------------------------------------------

test('encounter rows sit in their region\'s wild band; town wilds stay Lv2-5 even with the +2 night bonus', () => {
  const band = Object.fromEntries(REGIONS.map((r) => [r.id, r.wild]));
  const regionOf = (id) => (id.startsWith('the-bar') ? 'the-bar' : id.split('-')[0]);
  const bad = [];
  for (const [id, rows] of Object.entries(ENCOUNTERS)) {
    if (id === 'lantern-stack-perch') continue; // the Passenger, Lv50, a one-off perch
    const [lo, hi] = band[regionOf(id)];
    for (const r of rows) {
      if (r.errant) continue;
      if (r.levels[0] < lo || r.levels[1] > hi) bad.push(`${id}: ${r.species} ${r.levels} outside ${lo}-${hi}`);
      const nightOnly = id === 'pellwick-point-night';
      const rollsAtNight = nightOnly || r.mods?.night !== 0;
      if (regionOf(id) === 'pellwick' && id !== 'pellwick-reach' && rollsAtNight && r.levels[1] + 2 > hi) bad.push(`${id}: ${r.species} ${r.levels} +2 at night passes Lv${hi}`);
    }
  }
  assert.deepEqual(bad, []);
});
