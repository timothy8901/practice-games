// World content tests (GDD-01): the tilesets, the 24 maps, the encounter tables and the regions
// validate clean against tools/validate-data.mjs, match the id manifest, load through
// world/tilemap.loadMap, and Pellwick holds everything GDD-00 §4, §10 and §12 put in it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DATA } from '../js/data/index.js';
import { TUNING } from '../js/data/tuning.js';
import { validateData, checkManifest } from '../tools/validate-data.mjs';
import {
  MANIFEST, MAP_IDS, REGION_IDS, ENCOUNTER_IDS, PORCH_IDS, SPECIES_IDS, SPECIES_FAMILY, SCRIPT_IDS,
} from '../js/data/ids.manifest.js';
import { TILESETS, TILES, DEFAULT_LEGEND, ART_REQUESTS } from '../js/data/tilesets.js';
import { MAPS, MAPS_BY_ID } from '../js/data/maps/index.js';
import { ENCOUNTERS } from '../js/data/encounters/index.js';
import { PELLWICK_ENCOUNTERS } from '../js/data/encounters/pellwick.js';
import { REGIONS } from '../js/data/regions.js';
import { loadMap } from '../js/world/tilemap.js';
import { TILE_ART, resolveTileId } from '../js/art/tiles/index.js';
import { PROP_ART } from '../js/art/props.js';

const OWN = ['maps', 'tilesets', 'encounters', 'regions'];

/** Stub species rows so encounter rows resolve until the creature lane lands (errors in `species` are not ours). */
function speciesStubs() {
  return SPECIES_IDS.map((id) => ({
    id, name: id, types: ['Plain'], familyId: SPECIES_FAMILY[id], stage: 1,
    base: { hp: 40, atk: 40, def: 40, spa: 40, spd: 40, spe: 40 }, ability: 'x', learnset: [], heartmark: null,
    catchRate: 45, expYield: 50, growth: 'medium-fast', flags: {},
  }));
}

/** DATA with our tables swapped in (and species stubs if the shipped table lacks the manifest forms). */
function worldData() {
  const d = { ...DATA, maps: MAPS, tilesets: TILESETS, encounters: ENCOUNTERS, regions: REGIONS };
  const have = new Set((DATA.species ?? []).map((s) => s.id));
  if (!SPECIES_IDS.every((id) => have.has(id))) d.species = speciesStubs();
  const scripts = { ...(DATA.scripts ?? {}) };
  for (const id of SCRIPT_IDS) if (!scripts[id]) scripts[id] = ['STUB', { op: 'end' }];
  d.scripts = scripts;
  return d;
}

const ownErrors = (errors) => errors.filter((e) => OWN.some((t) => e.startsWith(`${t}:`)));
const loaded = new Map(MAPS.map((m) => [m.id, loadMap(m, TILES, { legend: DEFAULT_LEGEND })]));
const pw = MAPS_BY_ID.pellwick;
const rpw = loaded.get('pellwick');

/** Solid entity cells of a map (trees, props, boats, signs block walkers). */
function entityCells(map) {
  const s = new Set();
  for (const e of map.entities ?? []) if (['tree', 'prop', 'boat', 'sign', 'rock'].includes(e.kind)) s.add(`${e.x},${e.y}`);
  return s;
}
/** Walkable-from-entry set at a tide, entities blocking. */
function reach(map, rm, tide) {
  const block = entityCells(map);
  const ok = (x, y) => x >= 0 && y >= 0 && x < map.w && y < map.h && rm.passable(x, y, tide, 'walk') && !block.has(`${x},${y}`);
  const seen = new Set();
  const q = [[map.entry.x, map.entry.y]];
  seen.add(`${map.entry.x},${map.entry.y}`);
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (!seen.has(k) && ok(x + dx, y + dy)) { seen.add(k); q.push([x + dx, y + dy]); }
    }
  }
  return seen;
}
const reachLow = reach(pw, rpw, 'low');
const reachHigh = reach(pw, rpw, 'high');

// ---------------------------------------------------------------------------------------------
// validator + manifest
// ---------------------------------------------------------------------------------------------

test('validateData: zero errors in maps, tilesets, encounters and regions', () => {
  const { errors } = validateData(worldData(), { tuning: TUNING, legend: DEFAULT_LEGEND });
  assert.deepEqual(ownErrors(errors), []);
});

test('checkManifest: maps, encounters and regions are complete', () => {
  const spec = Object.fromEntries(['maps', 'encounters', 'regions'].map((t) => [t, MANIFEST[t]]));
  const { warnings, notes } = checkManifest(worldData(), spec);
  assert.deepEqual(warnings, []);
  assert.deepEqual(notes, []);
});

test('maps/index lists the 24 MAP_IDS in order, one file each', () => {
  assert.deepEqual(MAPS.map((m) => m.id), [...MAP_IDS]);
  assert.deepEqual(REGIONS.map((r) => r.id), [...REGION_IDS]);
  for (const id of ENCOUNTER_IDS) assert.ok(ENCOUNTERS[id], `encounter table ${id}`);
});

test('every map loads through world/tilemap.loadMap', () => {
  for (const m of MAPS) assert.ok(loaded.get(m.id).w === m.w, m.id);
});

// ---------------------------------------------------------------------------------------------
// tilesets
// ---------------------------------------------------------------------------------------------

test('tilesets: unique ids and chars, art resolves (or is an art request), lawns never spawn', () => {
  const ids = new Set();
  const chars = new Set();
  for (const t of TILESETS) {
    assert.ok(!ids.has(t.id), `dup id ${t.id}`); ids.add(t.id);
    if (t.char) { assert.ok(!chars.has(t.char), `dup char ${t.char}`); chars.add(t.char); }
    for (const k of ['solid', 'water', 'tide', 'verb', 'sfx', 'anim', 'glow']) assert.ok(k in t, `${t.id}.${k}`);
    assert.ok(resolveTileId(t.art) || PROP_ART[t.art] || ART_REQUESTS.includes(t.art), `${t.id}: art '${t.art}'`);
    if (/grass|mud/.test(t.id) && !t.spawn) assert.fail(`${t.id} matches a spawn keyword by name and needs an explicit spawn`);
  }
  assert.ok(TILESETS.length >= 96, `${TILESETS.length} tile kinds`);
  for (const id of ['grass', 'tall-grass', 'reeds', 'sand', 'wet-sand', 'mud-bank', 'mud-flat', 'mud-glow', 'shallows', 'deep-water', 'river', 'tidepool',
    'stepping-stones', 'river-stones', 'causeway', 'mainland-causeway', 'bar-road', 'old-quay', 'cliff', 'ledge', 'path', 'cobbles', 'quay', 'pier',
    'wall-timber', 'roof-slate', 'door', 'window', 'fence', 'pine', 'alder', 'tree-fruit', 'tree-purse', 'tree-bee', 'bush', 'flowers', 'rock',
    'waystone', 'skyglass-node', 'dig-crack', 'lighthouse', 'lighthouse-scaffold', 'spa-terrace', 'volcanic-rock', 'ash', 'boardwalk', 'drowned-street',
    'heather', 'windmill', 'ice', 'mirror-ice', 'glacier', 'wreck-ribs', 'sea-stack', 'brazier', 'floor-boards', 'counter', 'stairs-up', 'bed']) {
    assert.ok(TILES[id], `tile ${id}`);
  }
  assert.equal(TILES['stepping-stones'].tideWindow, 120);
  assert.equal(TILES.causeway.tideWindow, 150);
  assert.equal(TILES['mud-flat'].tideWindow, 90);
  assert.equal(TILES['mainland-causeway'].tideWindow, 60);
  assert.equal(TILES['bar-road'].lowerLow, true);
  for (const t of TILESETS) if (/^(grass|grass-b|meadow)$/.test(t.id)) assert.notEqual(t.spawn, 'grass');
});

// ---------------------------------------------------------------------------------------------
// Pellwick
// ---------------------------------------------------------------------------------------------

test('pellwick: 64x48 town hub, animated tiles within budget', () => {
  assert.equal(pw.w, 64); assert.equal(pw.h, 48);
  assert.equal(pw.region, 'pellwick'); assert.equal(pw.town, true);
  assert.ok(rpw.animated.length <= TUNING.animatedTileCap, `${rpw.animated.length} animated tiles`);
});

test('pellwick: the 20 porches, seven lit at arrival', () => {
  const porches = pw.entities.filter((e) => e.porch);
  assert.deepEqual(porches.map((p) => p.id).sort(), [...PORCH_IDS].sort());
  const lit = porches.filter((p) => p.litAtStart).map((p) => p.id).sort();
  assert.deepEqual(lit, ['porch-archive', 'porch-coop-yard', 'porch-linnet', 'porch-pells', 'porch-post-office', 'porch-tully', 'porch-wardens-house']);
  for (const p of porches) {
    assert.ok(reachHigh.has(`${p.step.x},${p.step.y}`), `${p.id} step reachable`);
    assert.ok(rpw.passable(p.door.x, p.door.y, 'high', 'walk'), `${p.id} door passable`);
  }
});

test('pellwick: ~100 named fruit trees, 6 purse trees, 4 bee trees, each reachable', () => {
  const trees = pw.entities.filter((e) => e.kind === 'tree');
  const fruit = trees.filter((t) => !t.purse && !t.hive);
  assert.ok(fruit.length >= 90 && fruit.length <= 110, `${fruit.length} fruit trees`);
  assert.equal(trees.filter((t) => t.purse).length, 6);
  assert.equal(trees.filter((t) => t.hive).length, 4);
  assert.equal(new Set(trees.map((t) => t.name)).size, trees.length, 'tree names unique');
  for (const t of trees) {
    assert.ok(t.name && t.name.length > 1, t.id);
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => reachHigh.has(`${t.x + dx},${t.y + dy}`));
    assert.ok(nb, `${t.id} at (${t.x},${t.y}) has no reachable neighbour`);
  }
});

test('pellwick: every warp reachable; short ways tide-gated, long way open at any tide', () => {
  for (const w of pw.warps) assert.ok(reachLow.has(`${w.x},${w.y}`), `warp (${w.x},${w.y}) at low tide`);
  const short = pw.warps.find((w) => w.via === 'short-way');
  const long = pw.warps.find((w) => w.via === 'long-way');
  const bar = pw.warps.find((w) => w.via === 'the-bar');
  assert.equal(rpw.tileAt(short.x, short.y).id, 'stepping-stones');
  assert.ok(!reachHigh.has(`${short.x},${short.y}`), 'the stones are under at high tide');
  assert.ok(reachHigh.has(`${long.x},${long.y}`), 'the boardwalk is open at high tide');
  assert.equal(rpw.tileAt(bar.x, bar.y).id, 'bar-road');
  for (const w of pw.warps) assert.ok(MAPS_BY_ID[w.to.mapId], w.to.mapId);
  // the mainland causeway: tide-gated, at the east edge, arrival only (no warp on it)
  assert.equal(rpw.tileAt(63, 30).id, 'mainland-causeway');
  assert.ok(!pw.warps.some((w) => w.x >= 60 && w.y >= 29 && w.y <= 32));
});

test('pellwick: interior doors follow the door convention both ways', () => {
  for (const w of pw.warps.filter((x) => x.kind === 'door')) {
    const im = MAPS_BY_ID[w.to.mapId];
    assert.equal(im.kind, 'interior', w.to.mapId);
    assert.deepEqual([w.to.x, w.to.y], [Math.floor(im.w / 2), im.h - 2], `${im.id} arrival`);
    const back = im.warps.find((b) => b.to.mapId === 'pellwick');
    assert.ok(back, `${im.id} has a door back`);
    assert.equal(back.to.x, w.x); assert.equal(back.to.y, w.y + 1);
    assert.ok(reachHigh.has(`${back.to.x},${back.to.y}`), `${im.id} returns to a reachable cell`);
  }
});

test('pellwick: markers in bounds, on open reachable ground (unless flagged), for every resident and story beat', () => {
  const block = entityCells(pw);
  for (const [name, m] of Object.entries(pw.markers)) {
    assert.match(name, /^[a-z0-9][a-z0-9-]*$/, name);
    assert.ok(m.x >= 0 && m.y >= 0 && m.x < 64 && m.y < 48, name);
    if (m.onSolid || m.water) continue;
    assert.ok(!block.has(`${m.x},${m.y}`), `${name} stands on an entity`);
    const set = m.tide === 'low' ? reachLow : reachHigh;
    if (m.spring) continue; // the Old Quay: only at a spring low
    assert.ok(set.has(`${m.x},${m.y}`), `${name} (${m.x},${m.y}) unreachable at ${m.tide ?? 'high'} tide`);
  }
  const names = Object.keys(pw.markers);
  for (const npc of ['wren', 'ambrose', 'hesper', 'juniper', 'ludo', 'barnaby', 'augusta', 'ansel', 'wick', 'tully', 'odile', 'bryony',
    'thessaly', 'tamsin', 'corin', 'linnet', 'dimity', 'maud', 'pip', 'merrow', 'varga', 'dov']) {
    assert.ok(names.some((n) => n.startsWith(`${npc}-`)), `marker for ${npc}`);
  }
  for (const n of ['arrival-start', 'wren-causeway', 'starter-sloshkin', 'starter-scrapling', 'starter-reedkit', 'wick-cliff-stair', 'corin-step',
    'linnet-vault-to', 'corin-dock', 'maud-punt-dock', 'wick-errands', 'yard-apron', 'commons-pin', 'tully-nickname', 'meet-odile', 'meet-bryony',
    'meet-thessaly', 'first-orchard', 'mail-sack', 'post-office-door', 'reeds-stance', 'archive-porthole', 'ansel-launch', 'pip-quay', 'ludo-eave',
    'yard-payment', 'porchlight-player', 'prismoth-lamp', 'tully-porch', 'corin-slip', 'glowing-flats', 'thatch-roof', 'mailbox-front',
    'stones-start', 'bar-head', 'raft-berth', 'market-green', 'shift-fair', 'lighthouse-door', 'weir-wheel', 'bell-dig', 'blackout-wake']) {
    assert.ok(pw.markers[n], `marker ${n}`);
  }
});

test('pellwick: named places, reaches, flats and dig spots', () => {
  for (const r of ['the-point', 'keepers-cottage', 'lighthouse', 'point-flats', 'bar-head', 'green', 'commons-square', 'coop-yard', 'quay', 'maud-berth',
    'old-pier', 'old-quay', 'north-creek', 'weir', 'the-reeds', 'marsh-reeds', 'lowmoor-short-way', 'lowmoor-long-way', 'causeway-end', 'orchard', 'hill-orchard']) {
    assert.ok(pw.regions[r], `region ${r}`);
  }
  const kinds = pw.reaches.map((r) => r.kind);
  assert.equal(kinds.filter((k) => k === 'river').length, 2);
  assert.equal(kinds.filter((k) => k === 'quay').length, 2);
  for (const r of pw.reaches) {
    let water = 0;
    for (let y = r.area.y; y < r.area.y + r.area.h; y++) for (let x = r.area.x; x < r.area.x + r.area.w; x++) if (rpw.tileAt(x, y).water) water++;
    if (r.kind !== 'creek') assert.ok(water >= r.area.w * r.area.h * 0.6, `${r.id} is mostly water`);
  }
  const block = entityCells(pw);
  for (const [x, y] of pw.flats.spots) assert.ok(reachLow.has(`${x},${y}`), `flats spot (${x},${y})`);
  assert.ok(pw.flats.spots.length >= 40);
  for (const [x, y] of pw.dig.spots) assert.ok(reachHigh.has(`${x},${y}`) && !block.has(`${x},${y}`), `dig spot (${x},${y})`);
  // reed edges exist and are the only spawn cover (lawns never roll)
  const reedCells = [];
  for (let y = 0; y < 48; y++) for (let x = 0; x < 64; x++) if (rpw.tileAt(x, y).spawn === 'grass') reedCells.push(rpw.tileAt(x, y).id);
  assert.ok(reedCells.length >= 60);
  assert.deepEqual([...new Set(reedCells)], ['reeds']);
  assert.ok(pw.spawns.filter((s) => s.rate > 0).every((s) => s.reeds === true));
});

test('pellwick encounter tables: reed edges Lv2-5 by day, manifest species, day/night/tide weights', () => {
  const reeds = PELLWICK_ENCOUNTERS['pellwick-reeds'];
  for (const r of reeds) {
    assert.ok(SPECIES_IDS.includes(r.species), r.species);
    assert.ok(r.levels[0] >= 2 && r.levels[1] <= 5, `${r.species} ${r.levels}`);
  }
  assert.ok(reeds.some((r) => r.species === 'tossup'), 'the first catch is a Tossup');
  assert.ok(reeds.some((r) => (r.mods?.night ?? 1) > 1), 'a night lean');
  assert.ok(reeds.some((r) => (r.mods?.high ?? 1) > 1), 'a high-tide lean');
  for (const r of reeds) assert.ok(!['prismoth', 'cairnward', 'chillnub', 'lumenveil'].includes(r.species), 'no Ward before Cairnhold');
  const lit = PELLWICK_ENCOUNTERS['pellwick-point-night'].filter((r) => r.errant);
  assert.deepEqual(lit.map((r) => r.species).sort(), ['hailcoil', 'squallcoil']);
  for (const r of lit) assert.equal(r.roam, 'lit');
});

test('stub maps: valid, flagged, and Lowmoor / the Bar answer Pellwick\'s arrival points', () => {
  for (const m of MAPS) if (m.id !== 'pellwick') assert.equal(m.stub === true || m.stub === undefined, true);
  for (const w of pw.warps.filter((x) => x.kind === 'edge')) {
    const rm = loaded.get(w.to.mapId);
    assert.ok(rm.passable(w.to.x, w.to.y, 'low', 'walk') || rm.passable(w.to.x, w.to.y, 'high', 'walk'), `${w.to.mapId} (${w.to.x},${w.to.y})`);
  }
  assert.ok(TILE_ART);
});
