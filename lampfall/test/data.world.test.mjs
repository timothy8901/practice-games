// World content tests (GDD-01): the tilesets, the 24 maps, the encounter tables and the regions
// validate clean against tools/validate-data.mjs, match the id manifest, load through
// world/tilemap.loadMap, and Pellwick holds everything GDD-00 §4, §10 and §12 put in it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DATA } from '../js/data/index.js';
import { TUNING } from '../js/data/tuning.js';
import { validateData, checkManifest } from '../tools/validate-data.mjs';
import {
  MANIFEST, MAP_IDS, REGION_IDS, ENCOUNTER_IDS, PORCH_IDS, SPECIES_IDS, SPECIES_FAMILY, SCRIPT_IDS, TRAINER_IDS, WAYSTONE_IDS,
} from '../js/data/ids.manifest.js';
import { TILESETS, TILES, DEFAULT_LEGEND, ART_REQUESTS } from '../js/data/tilesets.js';
import { MAPS, MAPS_BY_ID } from '../js/data/maps/index.js';
import { ENCOUNTERS } from '../js/data/encounters/index.js';
import { PELLWICK_ENCOUNTERS } from '../js/data/encounters/pellwick.js';
import { ISLE_ENCOUNTERS } from '../js/data/encounters/isles.js';
import { REGIONS } from '../js/data/regions.js';
import { REACH_KINDS } from '../js/data/collections.js';
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

/** The world lane's exterior maps; interiors, Spires and summit rooms belong to their own lanes (their errors are reported, not failed, here). */
const WORLD_MAPS = ['pellwick', 'lowmoor', 'cairnhold', 'emberstep', 'drownwood', 'thistlewind', 'rimeholt', 'the-bar'];
const ownErrors = (errors) => errors.filter((e) => OWN.some((t) => e.startsWith(`${t}:`)) && (!e.startsWith('maps:') || WORLD_MAPS.some((m) => e.startsWith(`maps:${m}:`))));
const otherMapErrors = (errors) => errors.filter((e) => e.startsWith('maps:') && !WORLD_MAPS.some((m) => e.startsWith(`maps:${m}:`)));
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
function reach(map, rm, tide, from = map.entry, skip = null) {
  const block = entityCells(map);
  const ok = (x, y) => x >= 0 && y >= 0 && x < map.w && y < map.h && rm.passable(x, y, tide, 'walk') && !block.has(`${x},${y}`) && !(skip && skip(x, y));
  const seen = new Set();
  if (!ok(from.x, from.y)) return seen;
  const q = [[from.x, from.y]];
  seen.add(`${from.x},${from.y}`);
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

test('validateData: zero errors in the world maps, tilesets, encounters and regions', (t) => {
  const { errors } = validateData(worldData(), { tuning: TUNING, legend: DEFAULT_LEGEND });
  assert.deepEqual(ownErrors(errors), []);
  for (const e of otherMapErrors(errors)) t.diagnostic(`other lane: ${e}`);
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
    const fallsThrough = (t.layer === 'detail' || t.layer === 'overlay') && !t.solid;
    for (const k of ['solid', 'water', 'tide', 'verb', 'sfx', 'anim', 'glow']) if (!(fallsThrough && (k === 'water' || k === 'tide'))) assert.ok(k in t, `${t.id}.${k}`);
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
  const short = pw.warps.find((w) => w.via === 'short-way' && w.way === 'stones');
  const long = pw.warps.find((w) => w.via === 'long-way');
  const bar = pw.warps.find((w) => w.to.mapId === 'the-bar');
  assert.equal(rpw.tileAt(short.x + 1, short.y).id, 'stepping-stones');
  assert.ok(!reachHigh.has(`${short.x},${short.y}`), 'the stones are under at high tide');
  assert.ok(reachHigh.has(`${long.x},${long.y}`), 'the boardwalk is open at high tide');
  assert.equal(rpw.tileAt(bar.x, bar.y).id, 'bar-road-near', 'the point-side Bar road opens at every low (the spur window)');
  assert.equal(bar.way, 'spur');
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

// ---------------------------------------------------------------------------------------------
// the six isles (GDD-00 §4; GDD-01 §11)
// ---------------------------------------------------------------------------------------------

const ISLES = [
  { id: 'lowmoor', waystone: 'brackenford', spire: 'turn', prev: 'pellwick', next: 'cairnhold', shortIn: 'stepping-stones', shortOut: 'causeway',
    holds: ['maud-practice-table', 'practice-table-player', 'linnet-rematch-stones', 'trainer-linnet-brackenford', 'linnet-decline', 'hobb-pavilion', 'corin-lowmoor-stones', 'pavilion-door'],
    regions: ['brackenford', 'ferry-pavilion', 'the-marsh', 'brackenford-flats', 'rematch-stones', 'peat-cuttings'] },
  { id: 'cairnhold', waystone: 'knapps-end', spire: 'ward', prev: 'lowmoor', next: 'emberstep', shortIn: 'causeway', shortOut: 'stepping-stones',
    holds: ['cairnhold-memorial', 'merrow-memorial', 'quill-memorial', 'wynn-clinic', 'mags-dock', 'osric-quarry', 'standing-stones', 'trainer-wick-cairnhold'],
    regions: ['knapps-end', 'the-quarry', 'standing-stones', 'mooring-clinic', 'the-memorial', 'cliff-path'] },
  { id: 'emberstep', waystone: 'sulphur-cross', spire: 'weather', prev: 'cairnhold', next: 'drownwood', shortIn: 'stepping-stones', shortOut: 'causeway',
    holds: ['errant-sighting', 'gorse-spa', 'ines-spa'],
    regions: ['sulphur-cross', 'the-volcano', 'spa-terraces', 'crater-lookout', 'ash-fields'] },
  { id: 'drownwood', waystone: 'mossgate', spire: 'hollow', prev: 'emberstep', next: 'thistlewind', shortIn: 'causeway', shortOut: 'causeway',
    holds: ['drowning-street', 'anchor-pulse', 'teal-poler', 'teal-drowning-street', 'varga-drowning-street', 'trainer-varga-drownwood', 'wendel-boatyard', 'tamsin-drownwood'],
    regions: ['mossgate', 'drowned-forest', 'drowning-street', 'old-town', 'boatyard'] },
  { id: 'thistlewind', waystone: 'windle', spire: 'relay', prev: 'drownwood', next: 'rimeholt', shortIn: 'causeway', shortOut: 'stepping-stones',
    holds: ['surge-street', 'surge-player', 'rook-mill', 'rook-surge', 'ada-ridge', 'ivo-ridge'],
    regions: ['windle', 'weft-lane', 'the-moor', 'the-ridge', 'relay-spire'] },
  { id: 'rimeholt', waystone: 'frostwick', spire: 'mirror', prev: 'thistlewind', next: null, shortIn: 'stepping-stones', shortOut: null,
    holds: ['idris-gallery', 'gallery-player', 'linnet-returns', 'trainer-linnet-rimeholt', 'brannoch-cave-lamp', 'seraphine-caves', 'cave-mouth'],
    regions: ['frostwick', 'the-glacier', 'mirror-caves', 'the-gallery', 'moraine'] },
];

/** The cell just inside an edge warp. */
const inward = (m, w) => (w.x === 0 ? { x: 1, y: w.y } : w.x === m.w - 1 ? { x: m.w - 2, y: w.y } : w.y === 0 ? { x: w.x, y: 1 } : { x: w.x, y: m.h - 2 });
const nb4 = (set, x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => set.has(`${x + dx},${y + dy}`));
const adjacent = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

for (const isle of ISLES) {
  const m = MAPS_BY_ID[isle.id];
  const rm = loaded.get(isle.id);
  const lo = reach(m, rm, 'low');
  const hi = reach(m, rm, 'high');

  test(`${isle.id}: authored 48x32 isle, its region, animated tiles within budget`, () => {
    assert.equal(m.stub, undefined);
    assert.equal(m.w, 48); assert.equal(m.h, 32);
    assert.equal(m.region, isle.id); assert.equal(m.kind, 'exterior'); assert.notEqual(m.town, true);
    assert.ok(rm.animated.length <= TUNING.animatedTileCap, `${rm.animated.length} animated tiles`);
  });

  test(`${isle.id}: dock Waystone, tide chalkboard, skyglass node and ferry stop, reachable at any tide`, () => {
    const ws = m.entities.find((e) => e.waystone);
    assert.ok(WAYSTONE_IDS.includes(isle.waystone));
    assert.equal(ws.id, isle.waystone);
    assert.ok(m.triggers.some((t) => t.verb === 'waystone' && t.x === ws.x && t.y === ws.y), 'waystone use trigger');
    assert.ok(nb4(hi, ws.x, ws.y), 'Waystone reachable at high tide');
    assert.ok(m.entities.some((e) => e.art === 'tide-chalkboard' && Math.max(Math.abs(e.x - ws.x), Math.abs(e.y - ws.y)) <= 2), 'tide chalkboard beside it');
    const node = m.entities.find((e) => e.node);
    assert.equal(node.id, `node-${isle.id}`);
    assert.ok(m.triggers.some((t) => t.verb === 'chip' && t.x === node.x && t.y === node.y));
    assert.ok(nb4(hi, node.x, node.y), 'node reachable at high tide');
    assert.ok(hi.has(`${m.markers['ferry-stop'].x},${m.markers['ferry-stop'].y}`), 'ferry stop reachable');
    assert.ok(m.triggers.some((t) => t.verb === 'ferry'));
  });

  test(`${isle.id}: the Spire door, reachable at any tide, with the spire-step marker`, () => {
    const door = m.warps.find((w) => w.kind === 'door');
    assert.equal(door.to.mapId, `spire-${isle.spire}`);
    assert.deepEqual([door.to.x, door.to.y], [10, 12]);
    assert.ok(rm.passable(door.x, door.y, 'high', 'walk'));
    assert.ok(hi.has(`${door.x},${door.y}`), 'Spire door reachable at high tide');
    assert.deepEqual([m.markers['spire-step'].x, m.markers['spire-step'].y], [door.x, door.y + 1]);
  });

  test(`${isle.id}: short way (tide-gated) and long way (any tide) in from ${isle.prev}${isle.next ? ` and out to ${isle.next}` : ''}`, () => {
    for (const [other, shortTile] of [[isle.prev, isle.shortIn], [isle.next, isle.shortOut]]) {
      if (!other) continue;
      const short = m.warps.filter((w) => w.to.mapId === other && w.via === 'short-way');
      const long = m.warps.filter((w) => w.to.mapId === other && w.via === 'long-way');
      assert.equal(short.length, 1, `${isle.id} -> ${other} short way`);
      assert.equal(long.length, 1, `${isle.id} -> ${other} long way`);
      const s1 = short[0]; const l1 = long[0];
      // the short way is made of its tide tiles: without them the warp's rock is cut off from the isle
      const ws = m.entities.find((e) => e.waystone);
      const sIn = inward(m, s1);
      const cut = reach(m, rm, 'low', sIn, (x, y) => rm.tileAt(x, y).id === shortTile);
      assert.ok(!nb4(cut, ws.x, ws.y), `the short way to ${other} crosses ${shortTile}`);
      let tiles = 0;
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (rm.tileAt(x, y).id === shortTile && Math.abs(x - s1.x) + Math.abs(y - s1.y) <= 9) tiles++;
      assert.ok(tiles >= 2, `${tiles} ${shortTile} tiles by the ${other} short way`);
      assert.ok(lo.has(`${s1.x},${s1.y}`), 'short way open at low water');
      assert.ok(!hi.has(`${s1.x},${s1.y}`), 'short way under at high water');
      assert.ok(hi.has(`${l1.x},${l1.y}`), 'long way open at high water');
      // both arrive on the other map, and both lead to the same place: its Waystone
      const om = MAPS_BY_ID[other]; const orm = loaded.get(other);
      const ows = om.entities.find((e) => e.waystone) ?? { x: om.entry.x, y: om.entry.y };
      for (const [w, tide] of [[s1, 'low'], [l1, 'high']]) {
        const there = reach(om, orm, tide, w.to);
        assert.ok(there.size > 0, `${other} arrival (${w.to.x},${w.to.y}) is open at ${tide} water`);
        assert.ok(nb4(there, ows.x, ows.y) || there.has(`${ows.x},${ows.y}`), `${w.via} arrival on ${other} leads to its Waystone at ${tide} water`);
      }
    }
  });

  test(`${isle.id}: two reaches, a dig site, route trainers and the isle's holds at their posts`, () => {
    assert.equal(m.reaches.length, 2);
    for (const r of m.reaches) {
      assert.equal(r.creatureTable, `${isle.id}-water`);
      assert.ok(REACH_KINDS.includes(r.kind), r.kind);
      let water = 0;
      for (let y = r.area.y; y < r.area.y + r.area.h; y++) for (let x = r.area.x; x < r.area.x + r.area.w; x++) if (rm.tileAt(x, y).water) water++;
      assert.ok(water >= r.area.w * r.area.h * 0.6, `${r.id} is mostly water`);
    }
    const block = entityCells(m);
    assert.ok(m.dig.spots.length >= 6, 'dig spots');
    for (const [x, y] of m.dig.spots) assert.ok(hi.has(`${x},${y}`) && !block.has(`${x},${y}`), `dig spot (${x},${y})`);
    const route = TRAINER_IDS.filter((t) => t.startsWith(`${isle.id}-`));
    assert.equal(route.length, 5);
    for (const t of route) {
      const mk = m.markers[`trainer-${t}`];
      assert.ok(mk, `marker trainer-${t}`);
      assert.equal(mk.trainer, t);
    }
    for (const n of isle.holds) assert.ok(m.markers[n], `marker ${n}`);
    for (const r of isle.regions) assert.ok(m.regions[r], `region ${r}`);
    for (const k of Object.keys(m.markers)) if (k.startsWith('trainer-')) assert.ok(TRAINER_IDS.includes(m.markers[k].trainer), k);
  });

  test(`${isle.id}: markers in bounds, on open ground reachable at their tide`, () => {
    const block = entityCells(m);
    for (const [name, mk] of Object.entries(m.markers)) {
      assert.match(name, /^[a-z0-9][a-z0-9-]*$/, name);
      assert.ok(mk.x >= 0 && mk.y >= 0 && mk.x < m.w && mk.y < m.h, name);
      if (mk.onSolid || mk.water) continue;
      assert.ok(!block.has(`${mk.x},${mk.y}`), `${name} stands on an entity`);
      assert.ok((mk.tide === 'low' ? lo : hi).has(`${mk.x},${mk.y}`), `${name} (${mk.x},${mk.y}) unreachable at ${mk.tide ?? 'high'} tide`);
    }
    for (const e of m.entities) if (e.kind !== 'boat') assert.ok(nb4(lo, e.x, e.y), `${e.id} has a reachable neighbour`);
  });

  test(`${isle.id}: wild spawns on cover use ${isle.id}-land; the reaches hook ${isle.id}-water`, () => {
    const land = m.spawns.find((sp) => sp.area === 'grass');
    assert.equal(land.table, `${isle.id}-land`);
    assert.ok(land.rate > 0);
    let cover = 0;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (rm.tileAt(x, y).spawn === 'grass') cover++;
    assert.ok(cover >= 20, `${cover} cover cells`);
    assert.ok(m.spawns.some((sp) => sp.table === `${isle.id}-water`));
    assert.ok(m.spawns.every((sp) => ENCOUNTERS[sp.table]));
  });
}

test('edge warps round-trip between the hub, the six isles and the Bar', () => {
  for (const id of WORLD_MAPS) {
    const m = MAPS_BY_ID[id];
    for (const w of m.warps.filter((x) => x.kind === 'edge')) {
      const om = MAPS_BY_ID[w.to.mapId];
      const back = om.warps.find((b) => b.kind === 'edge' && b.to.mapId === id && adjacent(b, w.to) && (adjacent(b.to, w) || (w.w && b.to.y === w.y + 1 && b.to.x >= w.x && b.to.x < w.x + w.w)));
      assert.ok(back, `${id} (${w.x},${w.y}) -> ${w.to.mapId} (${w.to.x},${w.to.y}) has a warp back`);
      assert.equal(back.via, w.via, `${id} <-> ${w.to.mapId} via`);
    }
  }
});

test('rimeholt: the mirror-ice caves are dark with a 3-tile light radius over the gallery and the Spire door', () => {
  const m = MAPS_BY_ID.rimeholt;
  const zone = m.darkZones.find((z) => z.id === 'mirror-caves');
  assert.equal(zone.lightRadius, 3);
  const inZ = (x, y) => x >= zone.area.x && y >= zone.area.y && x < zone.area.x + zone.area.w && y < zone.area.y + zone.area.h;
  const door = m.warps.find((w) => w.kind === 'door');
  assert.ok(inZ(door.x, door.y));
  assert.ok(inZ(m.markers['idris-gallery'].x, m.markers['idris-gallery'].y));
  const rm = loaded.get('rimeholt');
  let mirror = 0;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (rm.tileAt(x, y).id === 'mirror-ice') { mirror++; assert.ok(inZ(x, y), `mirror ice (${x},${y}) outside the dark`); }
  assert.ok(mirror >= 40, `${mirror} mirror-ice cells`);
});

test('drownwood: the drowning street is a tide street; Mossgate and the Spire stay linked at any tide', () => {
  const m = MAPS_BY_ID.drownwood;
  const rm = loaded.get('drownwood');
  const r = m.regions['drowning-street'];
  let drowned = 0;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (rm.tileAt(x, y).id === 'drowned-street') drowned++;
  assert.ok(drowned >= 10);
  const hi = reach(m, rm, 'high');
  const st = m.markers['drowning-street'];
  assert.ok(!hi.has(`${st.x},${st.y}`), 'the street is under at high water');
});

// ---------------------------------------------------------------------------------------------
// the Bar (GDD-00 §2, §4, §8)
// ---------------------------------------------------------------------------------------------

test('the-bar: the tide road to Shardcrown, the Lantern Stack spur, Hollis\'s Gate, the Long Road', () => {
  const m = MAPS_BY_ID['the-bar'];
  const rm = loaded.get('the-bar');
  assert.equal(m.stub, undefined);
  assert.equal(m.w, 64); assert.equal(m.h, 24); assert.equal(m.region, 'the-bar');
  const lo = reach(m, rm, 'low');
  const hi = reach(m, rm, 'high');
  const gate = m.warps.find((w) => w.to.mapId === 'hollis-gate');
  const stack = m.warps.find((w) => w.to.mapId === 'lantern-stack');
  assert.deepEqual([gate.to.x, gate.to.y], [10, 12]);
  assert.deepEqual([stack.to.x, stack.to.y], [10, 14]);
  for (const w of m.warps) assert.ok(lo.has(`${w.x},${w.y}`), `warp (${w.x},${w.y}) at low water`);
  assert.ok(!hi.has(`${gate.x},${gate.y}`) && !hi.has(`${stack.x},${stack.y}`), 'the Bar is under at high water (until lit.bar)');
  // the far road is the lower-low bar road; the near road (point to spur foot) and the spur open at every low
  let road = 0; let near = 0;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const id = rm.tileAt(x, y).id; if (id === 'bar-road') road++; if (id === 'bar-road-near') near++; }
  assert.ok(road >= 40, `${road} bar-road cells`); assert.ok(near >= 40, `${near} bar-road-near cells`);
  const noRoad = reach(m, rm, 'low', m.entry, (x, y) => rm.tileAt(x, y).id === 'bar-road');
  assert.ok(!noRoad.has(`${gate.x},${gate.y}`), 'Shardcrown is reached only by the Bar road');
  const noSpur = reach(m, rm, 'low', m.entry, (x, y) => rm.tileAt(x, y).id === 'bar-spur');
  assert.ok(!noSpur.has(`${stack.x},${stack.y}`) && noSpur.has(`${gate.x},${gate.y}`), 'the Lantern Stack hangs off the spur');
  const spurTile = TILES['bar-spur'];
  assert.equal(spurTile.tideWindow, 90); assert.equal(spurTile.way, 'spur'); assert.notEqual(spurTile.lowerLow, true);
  assert.equal(TILES['bar-road-near'].way, 'spur'); assert.equal(TILES['bar-road'].way, 'bar');
  // the Long Road: six trainers on the sandbanks, Wick halfway, Linnet at the gate
  for (const t of ['bar-corwen', 'bar-tilda', 'bar-ezra', 'bar-ottilie', 'bar-hamish', 'bar-delphine', 'wick-long-road', 'linnet-gate']) {
    assert.equal(m.markers[`trainer-${t}`]?.trainer, t, t);
  }
  for (const n of ['hollis-gate', 'hollis-gate-step', 'lantern-stack-step', 'spur-foot', 'engine-stack-foot', 'charges-linnet', 'charges-wick', 'crossing-start', 'from-pellwick']) assert.ok(m.markers[n], n);
  const block = entityCells(m);
  for (const [name, mk] of Object.entries(m.markers)) {
    assert.ok(!block.has(`${mk.x},${mk.y}`), `${name} on an entity`);
    assert.ok((mk.tide === 'low' ? lo : hi).has(`${mk.x},${mk.y}`), `${name} (${mk.x},${mk.y}) unreachable at ${mk.tide ?? 'high'} tide`);
  }
  let ribs = 0; let pools = 0;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const id = rm.tileAt(x, y).id; if (id === 'wreck-ribs') ribs++; if (id === 'tidepool') pools++; }
  assert.ok(ribs >= 10, `${ribs} wreck ribs`); assert.ok(pools >= 5, `${pools} tide pools`);
  assert.ok(m.spawns.length > 0 && m.spawns.every((sp) => sp.table === 'the-bar-pools' && typeof sp.area === 'object'));
});

// ---------------------------------------------------------------------------------------------
// isle encounter tables (GDD-00 §4, §8)
// ---------------------------------------------------------------------------------------------

test('isle encounter tables: GDD-00 holds at their day bands, night and tide leans, Wards from Cairnhold, Errant routes', () => {
  const band = Object.fromEntries(REGIONS.map((r) => [r.id, r.wild]));
  const WARDS = ['prismoth', 'cairnward', 'chillnub', 'lumenveil'];
  const HOLDS = {
    lowmoor: ['sloshkin', 'scrapling', 'reedkit', 'tossup', 'puddlepip', 'wirewhisk', 'mudfist'],
    cairnhold: ['prismoth', 'chillnub', 'mothling', 'cairnward'],
    emberstep: ['sootling', 'sedgehare', 'rayling'],
    drownwood: ['creelwight', 'bilgebob', 'rushling', 'rustcreel', 'duskwisp'],
    thistlewind: ['skirl', 'duskowl', 'coilcrest', 'gillwick', 'stillox'],
    rimeholt: ['rimeplate', 'floeback', 'lumenveil', 'strandrunner'],
  };
  for (const isle of ISLES.map((i) => i.id)) {
    const rows = [...ISLE_ENCOUNTERS[`${isle}-land`], ...ISLE_ENCOUNTERS[`${isle}-water`]];
    const [lo, hi] = band[isle];
    for (const r of rows) {
      assert.ok(SPECIES_IDS.includes(r.species), r.species);
      if (!r.errant) assert.ok(r.levels[0] >= lo && r.levels[1] <= hi, `${isle} ${r.species} ${r.levels} outside ${lo}-${hi}`);
    }
    for (const sp of HOLDS[isle]) assert.ok(rows.some((r) => r.species === sp), `${isle} holds ${sp}`);
    const land = ISLE_ENCOUNTERS[`${isle}-land`];
    assert.ok(land.some((r) => (r.mods?.night ?? 1) > 1), `${isle}-land leans at night`);
    assert.ok(land.some((r) => ['low', 'high', 'rising', 'falling'].some((k) => r.mods?.[k] !== undefined)), `${isle}-land has a tide lean`);
    assert.ok(land.some((r) => !r.cond && !r.errant), `${isle}-land has unconditional rows`);
  }
  for (const id of ['lowmoor-land', 'lowmoor-water']) for (const r of ISLE_ENCOUNTERS[id]) assert.ok(!WARDS.includes(r.species), `no Ward before Cairnhold (${r.species})`);
  assert.ok(ISLE_ENCOUNTERS['cairnhold-land'].some((r) => WARDS.includes(r.species)), 'the first Wards on Cairnhold');
  // Lowmoor's starters: ~15% each from day 2, gone once held
  const lm = ISLE_ENCOUNTERS['lowmoor-land'];
  const total = lm.filter((r) => !r.errant).reduce((a, r) => a + r.w, 0);
  for (const sp of ['sloshkin', 'scrapling', 'reedkit']) {
    const row = lm.find((r) => r.species === sp);
    assert.ok(Math.abs(row.w / total - 0.15) < 0.02, `${sp} ${(row.w / total).toFixed(3)}`);
    assert.ok(JSON.stringify(row.cond).includes('held'));
  }
  // Errant routes: Squallcoil from Emberstep onward, Hailcoil on Rimeholt only; never on a town table
  const routes = (sp) => Object.entries(ENCOUNTERS).filter(([, rows]) => rows.some((r) => r.species === sp && r.errant && (r.roam ?? 'route') === 'route')).map(([id]) => id);
  assert.deepEqual(routes('squallcoil'), ['emberstep-land', 'drownwood-land', 'thistlewind-land', 'rimeholt-land']);
  assert.deepEqual(routes('hailcoil'), ['rimeholt-land']);
  for (const id of ['the-bar-pools']) for (const r of ISLE_ENCOUNTERS[id]) if (!r.errant) assert.ok(r.levels[0] >= 40 && r.levels[1] <= 44);
});

// =============================================================================================
// INTERIORS, SPIRES AND SUMMIT ROOMS (GDD-01 §10-§13) [interiors lane]
// Self-contained: its own imports below, so the exterior lanes can edit the header freely.
// =============================================================================================
const { evalCond: evalCondI } = await import('../js/script/cond.js');
const { THREAD_IDS: THREAD_IDS_I, WAYSTONE_IDS: WAYSTONE_IDS_I, TRAINER_IDS: TRAINER_IDS_I } = await import('../js/data/ids.manifest.js');
const { SPIRES: SPIRES_I, SUMMIT: SUMMIT_I, THE_READING: READING_I } = await import('../js/data/spires.js');

const TOWN_INTERIORS = ['int-cottage', 'int-pells', 'int-post-office', 'int-archive', 'int-yard-shed', 'int-lighthouse'];
const SPIRE_MAPS = ['spire-turn', 'spire-ward', 'spire-weather', 'spire-hollow', 'spire-relay', 'spire-mirror'];
const SUMMIT_MAPS = ['hollis-gate', 'keepers-hall', 'idris-hall', 'lantern-stack'];
const INTERIORS = [...TOWN_INTERIORS, ...SPIRE_MAPS, ...SUMMIT_MAPS];
const COMMISSIONS = ['training-yard', 'workshop', 'greenhouse', 'cellar', 'porch-loft', 'gallery'];

/** A map variant expanded to a full MapDef (GDD-01 §1.14: a variant replaces the fields it names). */
function expandVariant(def, v) {
  const m = { ...def, ...v, id: def.id, variant: v.id };
  delete m.variants;
  return m;
}
/** Every layout a map can show: the base plus each variant. */
const layoutsOf = (def) => [{ ...def, variant: 'base' }, ...(def.variants ?? []).map((v) => expandVariant(def, v))];

/** Minimal world states the interiors are checked under (start of game, mid game, everything built). */
const SCENARIOS = {
  start: { flags: {}, loans: { tier: 1, paid: 0 }, badges: [], threads: {} },
  mid: { flags: { 'sys.build.bedsit': true, 'sys.build.cottage': true, 'sys.build.workshop': true, 'sys.build.gallery': true, 'sp.lamp-room-offered': true, 'sp.two-plans': true }, loans: { tier: 5, paid: 0 }, badges: ['turn', 'ward', 'weather', 'hollow'], threads: {} },
  end: {
    flags: { ...Object.fromEntries(['bedsit', 'cottage', 'lamp-room', ...COMMISSIONS].map((b) => [`sys.build.${b}`, true])), 'sp.summit-open': true, 'sp.two-plans': true, 'sp.charges-pulled': true, 'sp.relighting': true, 'sp.reading-done': true, 'sp.bell-dug': true, 'sp.late-delivery': true, 'sp.idris-beaten': true },
    loans: { tier: 7, paid: 80000 }, badges: ['turn', 'ward', 'weather', 'hollow', 'relay', 'mirror'], threads: { 'twelve-lights': { beat: 6, done: true } },
  },
};
const holds = (world, c) => (c == null ? true : evalCondI(world, c, {}));
/** The layout a world state shows: the last variant whose cond holds (GDD-01 §1.14). */
function activeLayout(def, world) {
  let m = { ...def, variant: 'base' };
  for (const v of def.variants ?? []) if (holds(world, v.cond)) m = expandVariant(def, v);
  return m;
}
/**
 * Walkable set from a cell under a world state: tiles + collision, solid entities whose cond holds.
 * A Spire sentinel (`sentinel: <id>`) is a battle gate: it steps aside once beaten, so it never walls.
 */
function reachI(m, world, from = m.entry) {
  const rm = loadMap(m, TILES, { legend: DEFAULT_LEGEND });
  const block = new Set((m.entities ?? []).filter((e) => e.solid !== false && !e.sentinel && holds(world, e.cond)).map((e) => `${e.x},${e.y}`));
  const ok = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && rm.passable(x, y, 'high', 'walk') && !block.has(`${x},${y}`);
  const seen = new Set([`${from.x},${from.y}`]);
  const q = [[from.x, from.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${x + dx},${y + dy}`;
      if (!seen.has(k) && ok(x + dx, y + dy)) { seen.add(k); q.push([x + dx, y + dy]); }
    }
  }
  return { seen, rm, block };
}
/** Whether some cell of a (possibly w x h) target, or a cell next to it, is in the walkable set. */
function faceable(seen, t) {
  for (let y = t.y; y < t.y + (t.h ?? 1); y++) {
    for (let x = t.x; x < t.x + (t.w ?? 1); x++) {
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (seen.has(`${x + dx},${y + dy}`)) return true;
    }
  }
  return false;
}
/** DATA with the world tables swapped in, the cottage variants added as extra maps, and thread rows stubbed until that lane lands. */
function interiorData() {
  const d = worldData();
  const extra = MAPS_BY_ID['int-cottage'].variants.map((v) => ({ ...expandVariant(MAPS_BY_ID['int-cottage'], v), id: `int-cottage~${v.id}` }));
  d.maps = [...d.maps, ...extra];
  const have = new Set((Array.isArray(d.threads) ? d.threads : Object.values(d.threads ?? {})).map((t) => t?.id));
  if (!THREAD_IDS_I.every((id) => have.has(id))) d.threads = THREAD_IDS_I.map((id) => ({ id, name: id, npcId: null, beats: [] }));
  return d;
}
const mineErrors = (errors) => errors.filter((e) => INTERIORS.some((id) => e.startsWith(`maps:${id}:`) || e.startsWith(`maps:${id}~`)));

test('interiors: validateData reports zero errors in the 16 interior, Spire and summit maps (and every cottage tier)', () => {
  const { errors } = validateData(interiorData(), { tuning: TUNING, legend: DEFAULT_LEGEND });
  assert.deepEqual(mineErrors(errors), []);
});

test('interiors: authored (no stubs), interior kind, door centred in the bottom wall, arrival above it, kebab-case markers', () => {
  for (const id of INTERIORS) {
    const m = MAPS_BY_ID[id];
    assert.ok(m, id);
    assert.equal(m.stub, undefined, `${id} is still a stub`);
    assert.equal(m.kind, 'interior', id);
    const door = { x: Math.floor(m.w / 2), y: m.h - 1 };
    for (const L of layoutsOf(m)) {
      const w = L.warps.find((x) => x.x === door.x && x.y === door.y);
      assert.ok(w, `${id}/${L.variant}: a warp on the door cell (${door.x},${door.y})`);
      assert.deepEqual([L.entry.x, L.entry.y], [door.x, door.y - 1], `${id}/${L.variant}: arrival above the door`);
      for (const n of Object.keys(L.markers)) assert.match(n, /^[a-z0-9][a-z0-9-]*$/, `${id}: marker ${n}`);
      assert.ok(L.markers['from-door'], `${id}/${L.variant}: from-door marker`);
      assert.equal(loadMap(L, TILES, { legend: DEFAULT_LEGEND }).w, m.w, `${id}/${L.variant} loads`);
    }
  }
  assert.deepEqual(SPIRE_MAPS.map((id) => [MAPS_BY_ID[id].w, MAPS_BY_ID[id].h]), SPIRE_MAPS.map(() => [20, 14]));
});

test('interiors: every door round-trips with the map it opens onto (Pellwick porch steps, isle spire-steps, the Bar, the summit chain)', () => {
  for (const id of INTERIORS) {
    const m = MAPS_BY_ID[id];
    for (const L of layoutsOf(m)) {
      for (const w of L.warps) {
        const t = MAPS_BY_ID[w.to.mapId];
        assert.ok(t, `${id}: warp to ${w.to.mapId}`);
        const rt = loaded.get(t.id);
        assert.ok(rt.passable(w.to.x, w.to.y, 'low', 'walk') || rt.passable(w.to.x, w.to.y, 'high', 'walk'), `${id} -> ${t.id} (${w.to.x},${w.to.y}) passable`);
        if (w.toMarker && t.markers?.[w.toMarker]) {
          const mk = t.markers[w.toMarker];
          assert.deepEqual([w.to.x, w.to.y], [mk.x, mk.y], `${id}: exit lands on ${t.id}'s ${w.toMarker}`);
        }
        // the way back: the target map has a warp into this map, landing on our arrival / next to the warp cell
        if (t.stub) continue;
        const back = layoutsOf(t).flatMap((x) => x.warps).filter((b) => b.to.mapId === id);
        assert.ok(back.length > 0, `${t.id} has a warp back into ${id}`);
        const into = back.find((b) => Math.abs(b.to.x - w.x) + Math.abs(b.to.y - w.y) <= 1);
        assert.ok(into, `${t.id}'s warp into ${id} lands beside ${id}'s exit (${w.x},${w.y})`);
        const out = back.find((b) => Math.abs(b.x - w.to.x) + Math.abs(b.y - w.to.y) <= 1);
        assert.ok(out, `${id}'s exit to ${t.id} lands beside ${t.id}'s door into it (got (${w.to.x},${w.to.y}))`);
      }
    }
  }
});

test('interiors: under every world state, markers, warps, use triggers and furniture verbs are reachable from the door', () => {
  for (const id of INTERIORS) {
    const def = MAPS_BY_ID[id];
    for (const [sname, world] of Object.entries(SCENARIOS)) {
      const m = activeLayout(def, world);
      const { seen, block } = reachI(m, world);
      const where = `${id}/${m.variant} @${sname}`;
      for (const [n, k] of Object.entries(m.markers)) {
        assert.ok(k.x >= 0 && k.y >= 0 && k.x < m.w && k.y < m.h, `${where}: marker ${n} in bounds`);
        if (k.onSolid || k.apart || k.staff || k.water) continue;
        if (k.room && !holds(world, { flag: `sys.build.${k.room}` })) continue;
        if (block.has(`${k.x},${k.y}`)) continue; // a conditional piece stands there in this state (the trapdoor cover)
        assert.ok(seen.has(`${k.x},${k.y}`), `${where}: marker ${n} (${k.x},${k.y}) unreachable`);
      }
      for (const w of m.warps) if (holds(world, w.cond)) assert.ok(seen.has(`${w.x},${w.y}`), `${where}: warp (${w.x},${w.y}) -> ${w.to.mapId}`);
      for (const t of m.triggers) if (t.kind === 'use' && !t.staff && holds(world, t.cond)) assert.ok(faceable(seen, t), `${where}: trigger ${t.id}`);
      for (const e of m.entities) if (e.verb && !e.staff && holds(world, e.cond)) assert.ok(faceable(seen, { x: e.x, y: e.y }), `${where}: ${e.id}`);
    }
  }
});

test('the cottage: one layout per house tier, keyed by the build flags, growing from the bedsit to Lamp Room access', () => {
  const c = MAPS_BY_ID['int-cottage'];
  assert.deepEqual([c.artTier, ...c.variants.map((v) => v.tier)], [0, 1, 2, 3]);
  assert.deepEqual(c.variants.map((v) => v.id), ['cottage', 'rooms', 'lamp-room']);
  assert.deepEqual(['start', 'mid', 'end'].map((s) => activeLayout(c, SCENARIOS[s]).variant), ['base', 'rooms', 'lamp-room']);
  assert.equal(activeLayout(c, { ...SCENARIOS.start, flags: { 'sys.build.cottage': true } }).variant, 'cottage');
  const floor = (L) => { const r = loadMap(L, TILES, { legend: DEFAULT_LEGEND }); let n = 0; for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) if (r.passable(x, y, 'high', 'walk')) n++; return n; };
  const sizes = layoutsOf(c).map(floor);
  for (let i = 1; i < sizes.length; i++) assert.ok(sizes[i] >= sizes[i - 1], `tier ${i} is no smaller (${sizes})`);
  // every commission room opens on its own build flag; unbuilt ones are sealed
  const rooms = c.variants.find((v) => v.id === 'rooms');
  for (const r of ['greenhouse', 'gallery', 'training-yard', 'workshop', 'cellar', 'porch-loft']) {
    assert.ok(rooms.entities.some((e) => JSON.stringify(e.cond ?? null).includes(`sys.build.${r}`)), `room ${r} keyed on sys.build.${r}`);
  }
  const sealedOnly = { ...SCENARIOS.mid, flags: { 'sys.build.cottage': true, 'sys.build.cellar': true } };
  const L = activeLayout(c, sealedOnly);
  const { seen } = reachI(L, sealedOnly);
  for (const n of ['greenhouse-door', 'gallery-door', 'training-yard-door', 'workshop-door']) assert.ok(!seen.has(`${L.markers[n].x},${L.markers[n].y}`), `${n} sealed until built`);
  // Lamp Room access: the keeper's stair links the hearth room to the lighthouse foot, both ways, only once built
  const lamp = expandVariant(c, c.variants.find((v) => v.id === 'lamp-room'));
  const down = lamp.warps.find((w) => w.to.mapId === 'int-lighthouse');
  assert.ok(down && down.cond.flag === 'sys.build.lamp-room');
  const lh = MAPS_BY_ID['int-lighthouse'];
  const up = lh.warps.find((w) => w.to.mapId === 'int-cottage');
  assert.deepEqual([up.to.x, up.to.y], [lamp.markers['keepers-stair-arrival'].x, lamp.markers['keepers-stair-arrival'].y]);
  assert.deepEqual([down.to.x, down.to.y], [lh.markers['keepers-stair-arrival'].x, lh.markers['keepers-stair-arrival'].y]);
  assert.ok(!c.warps.some((w) => w.to.mapId === 'int-lighthouse'), 'no keeper\'s stair before the Lamp Room');
  assert.ok(!reachI(lh, SCENARIOS.mid).seen.has(`${up.x},${up.y}`), 'the trapdoor stays shut before the build');
});

test('town interiors hold their people and pieces: counters, the sorting room, the string wall, the loft, the tally wall, the lens', () => {
  const need = {
    'int-cottage': ['bed-side', 'hearth-front', 'storage-front', 'dimity-windowsill', 'coda-morning'],
    'int-pells': ['juniper-counter', 'juniper-back-room', 'counter-front', 'disc-case-front', 'wanted-today-front', 'isolde-lantern-shelf'],
    'int-post-office': ['hesper-counter', 'post-counter-front', 'mail-sack-drop', 'hesper-sorting', 'old-post-sack', 'mabry-daybook-front', 'party-hesper'],
    'int-archive': ['barnaby-desk', 'archive-desk-front', 'barnaby-porthole', 'string-wall-front', 'field-log-front', 'shiftlog-front', 'corin-desk', 'corin-loft', 'corin-loft-stair', 'bell-exhibit'],
    'int-yard-shed': ['wren-ledger', 'ledger-front', 'tally-wall-front', 'ambrose-workbench', 'plans-table-front', 'lamp-room-offer-wren', 'lamp-room-offer-player'],
    'int-lighthouse': ['isolde-desk-front', 'stair-foot', 'lamp-room-hatch', 'lantern-stack-view', 'relight-player', 'relight-wick', 'ambrose-lamp-room'],
  };
  for (const [id, names] of Object.entries(need)) for (const n of names) assert.ok(MAPS_BY_ID[id].markers[n], `${id}: marker ${n}`);
  const tileIds = (id) => { const m = MAPS_BY_ID[id]; const r = loaded.get(id); const s = new Set(); for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) s.add(r.tileAt(x, y).id); return s; };
  assert.ok(tileIds('int-archive').has('string-wall') && tileIds('int-archive').has('porthole'));
  assert.ok(tileIds('int-lighthouse').has('lens') && tileIds('int-lighthouse').has('lamp-room-floor'));
  assert.ok(tileIds('int-pells').has('counter') && tileIds('int-post-office').has('counter'));
  assert.ok(MAPS_BY_ID['int-pells'].triggers.some((t) => t.shop === 'pells-sundries'));
  assert.ok(MAPS_BY_ID['int-archive'].triggers.some((t) => t.shop === 'archive-desk'));
  assert.equal(MAPS_BY_ID['int-yard-shed'].props.filter((p) => p.art === 'split-stick').length, 7, 'seven pegs on the tally wall');
  // the Archive porthole sits where the town sees it: two east of the door, as at (34,19) beside the door (32,19)
  const ar = loaded.get('int-archive');
  assert.equal(ar.tileAt(10, 11).id, 'porthole');
});

test('Spires: themed hall, leader on the dais, challenger spot, trainer posts, the dossier at the door', () => {
  for (const sp of SPIRES_I) {
    const m = MAPS_BY_ID[sp.map];
    assert.equal(m.region, sp.isle, sp.map);
    assert.equal(m.spire, sp.id);
    const r = loaded.get(sp.map);
    const lead = m.markers['leader-dais'];
    assert.ok(lead && m.markers[`${sp.leader}-dais`], `${sp.map}: the leader's dais marker`);
    assert.equal(r.tileAt(lead.x, lead.y).id, 'spire-dais', `${sp.map}: the leader stands on the dais`);
    assert.ok(m.markers['challenger-spot'] && m.markers['badge-spot']);
    const ids = new Set(); for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) ids.add(r.tileAt(x, y).id);
    assert.ok(ids.has(`spire-floor-${sp.id}`) && ids.has(`spire-wall-${sp.id}`), `${sp.map}: themed floor and wall`);
    assert.ok(ids.size >= 6, `${sp.map}: more than an empty room (${ids.size} tile kinds)`);
    const d = m.entities.find((e) => e.verb === 'dossier');
    assert.ok(d && d.spire === sp.id && d.y >= m.h - 3, `${sp.map}: dossier board by the door`);
    for (const step of sp.order.filter((o) => o.kind === 'sentinel')) {
      assert.ok(Object.values(m.markers).some((k) => k.trainer === step.id), `${sp.map}: post for ${step.id}`);
    }
  }
  assert.ok(MAPS_BY_ID['spire-mirror'].markers['idris-gallery'].apart, 'Idris watches from a gallery the player cannot climb to');
  const relay = MAPS_BY_ID['spire-relay'].markers;
  assert.ok(relay['ivo-post'] && relay['ada-post'] && relay['hallorans-dais']);
});

test('Summit and the stack: Hollis\'s Gate Waystone and gate, the Keepers\' brazier, the Bell, the Engine, the Reading, the perch', () => {
  const hg = MAPS_BY_ID['hollis-gate'];
  const ws = hg.entities.find((e) => e.waystone);
  assert.equal(ws.id, 'hollis-gate');
  assert.ok(WAYSTONE_IDS_I.includes(ws.id));
  assert.ok(hg.triggers.some((t) => t.verb === 'waystone' && t.x === ws.x && t.y === ws.y));
  assert.ok(hg.entities.some((e) => e.art === 'tide-chalkboard' && Math.abs(e.x - ws.x) + Math.abs(e.y - ws.y) === 1), 'tide chalkboard beside the Waystone');
  const gate = hg.warps.find((w) => w.to.mapId === 'keepers-hall');
  assert.deepEqual(gate.cond, { flag: 'sp.summit-open' });
  assert.ok(!reachI(hg, SCENARIOS.mid).seen.has(`${gate.x},${gate.y}`), 'barred before six badges');
  assert.ok(reachI(hg, SCENARIOS.end).seen.has(`${gate.x},${gate.y}`), 'open after');
  // the chain climbs gate -> Keepers' Hall -> Idris's Hall, in the order spires.js fights it
  assert.deepEqual(SUMMIT_I.order.map((s) => s.map), ['keepers-hall', 'keepers-hall', 'idris-hall']);
  assert.ok(MAPS_BY_ID['keepers-hall'].warps.some((w) => w.to.mapId === 'idris-hall'));
  const kh = MAPS_BY_ID['keepers-hall'];
  assert.ok(kh.markers['bastien-post'].trainer === 'bastien-keeper' && kh.markers['cass-post'].trainer === 'cass-keeper');
  assert.equal(loaded.get('keepers-hall').tileAt(kh.markers['old-brazier'].x, kh.markers['old-brazier'].y).id, 'brazier');
  const ih = MAPS_BY_ID['idris-hall'];
  assert.ok(ih.entities.some((e) => e.art === 'summit-bell') && ih.triggers.some((t) => t.script === 'summit-bell'));
  assert.equal(ih.markers['idris-dais'].trainer, 'idris-champion');
  const ls = MAPS_BY_ID['lantern-stack'];
  for (const npc of READING_I.shoreParty) assert.ok(ls.markers[`reading-${npc}`], `the Reading: ${npc} on the shore`);
  assert.ok(ls.markers['reading-player'] && ls.markers['reading-passenger'] && ls.markers['merrow-engine']);
  assert.ok(ls.spawns.some((s) => s.table === 'lantern-stack-perch') && ls.entities.some((e) => e.kind === 'roamer' && e.speciesId === 'vagary'));
  assert.ok(reachI(ls, SCENARIOS.mid).block.has('9,8'), 'the Engine stands in Act III');
  assert.ok(!reachI(ls, SCENARIOS.end).block.has('9,8'), 'and is gone after the Relighting');
  assert.ok(TRAINER_IDS_I.includes('merrow-engine') && TRAINER_IDS_I.includes('idris-champion'));
});
