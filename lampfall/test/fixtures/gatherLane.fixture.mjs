// Shared fixtures for the SYS-GATHER / SYS-WORLD tests (fishing, gather, fieldLog, encounter).
// Content is invented and generic on purpose: the systems never name a species, fish or map.
import { createNewWorld, creatureDefaults } from '../../js/state/schema.js';
import { makeRng } from '../../js/core/rng.js';

/** Collections: 3 fish, 3 bugs, finds of every source, 2 fruit, one unlogged cockle. */
export const COLLECTIONS = Object.freeze([
  { id: 'fish-a', kind: 'fish', name: 'Fish A', price: 80, where: ['river'], shadow: 'small', size: [10, 20], biteFrames: 31, tell: { shape: 'forked', sound: 'plip', word: 'Forked' }, w: 3 },
  { id: 'fish-b', kind: 'fish', name: 'Fish B', price: 300, where: ['river', 'quay'], shadow: 'medium', size: [30, 50], biteFrames: [12, 16], feints: [2, 2], w: 1, mods: { fog: 3 } },
  { id: 'fish-night', kind: 'fish', name: 'Night Fish', price: 2400, where: ['quay'], night: true, headliner: true, shadow: 'forked', size: [40, 60], biteFrames: 14, biteFramesNight: 7, w: 2 },
  { id: 'bug-a', kind: 'bug', name: 'Bug A', price: 60, w: 1 },
  { id: 'bug-moth', kind: 'bug', name: 'Moth', price: 300, light: true, moth: true, night: true, w: 1 },
  { id: 'bug-wary', kind: 'bug', name: 'Wary Bug', price: 900, wary: 1, spook: 2, w: 0.0001 },
  { id: 'fossil-a', kind: 'relic', name: 'Fossil A', price: 600, group: 'fossil', source: ['crack'] },
  { id: 'relic-a', kind: 'relic', name: 'Relic A', price: 400, group: 'relic', source: 'crack', w: 2 },
  { id: 'shore-a', kind: 'relic', name: 'Shore A', price: 150, group: 'shore', source: ['sparkle', 'tree'] },
  { id: 'sky-a', kind: 'relic', name: 'Skyglass A', price: 900, archivePrice: 900, group: 'relic', skyglass: true, source: ['skyglass'] },
  { id: 'elsewhere', kind: 'relic', name: 'Isle Relic', price: 700, group: 'relic', source: ['crack'], where: ['isle-map'] },
  { id: 'cockle', kind: 'relic', name: 'Cockle', price: 20, group: 'shore', log: false },
  { id: 'pear', kind: 'fruit', name: 'Pear', price: 120 },
  { id: 'peach', kind: 'fruit', name: 'Peach', price: 480, ripePrice: 600 },
]);

/** Species: 6 forms; one opts out of the log. */
export const SPECIES = Object.freeze([
  { id: 'form-a', name: 'Form A', types: ['Brine'], ability: 'ab-a' },
  { id: 'form-b', name: 'Form B', types: ['Grit'], ability: 'ab-b' },
  { id: 'form-c', name: 'Form C', types: ['Moss'], ability: 'ab-c' },
  { id: 'form-night', name: 'Night Form', types: ['Hollow'], ability: 'ab-n' },
  { id: 'errant-1', name: 'Errant One', types: ['Bolt', 'Brine'], ability: 'ab-e1' },
  { id: 'errant-2', name: 'Errant Two', types: ['Rime', 'Gust'], ability: 'ab-e2' },
  { id: 'hidden', name: 'Hidden', types: ['Star'], ability: 'ab-h', log: false },
]);

export const ENCOUNTERS = Object.freeze({
  'isle-grass': [
    { species: 'form-a', levels: [3, 5], w: 60 },
    { species: 'form-b', levels: [4, 4], w: 40, mods: { night: 0 } },
    { species: 'form-night', levels: [6, 6], w: 10, cond: { phase: ['night', 'evening'] } },
    { species: 'errant-1', levels: [20, 20], w: 1, errant: true },
  ],
  'isle-2-grass': [
    { species: 'form-c', levels: [10, 12], w: 1 },
    { species: 'errant-1', levels: [21, 21], w: 1, errant: true },
  ],
  'town-reeds': [
    { species: 'form-c', levels: [2, 5], w: 1 },
  ],
  'lit-point': [
    { species: 'form-a', levels: [40, 40], w: 1 },
    { species: 'errant-1', levels: [44, 44], w: 1, errant: true, roam: 'lit', cond: { flag: 'sp.lit.calls' } },
    { species: 'errant-2', levels: [44, 44], w: 1, errant: true, roam: 'lit', cond: { flag: 'sp.lit.calls' } },
  ],
  'river-creatures': [
    { species: 'form-c', levels: [7, 7], w: 1 },
  ],
});

export const REGIONS = Object.freeze([
  { id: 'town', name: 'Town', curveLevel: 4, town: true },
  { id: 'isle-1', name: 'Isle 1', curveLevel: 6 },
]);

/** A town map: trees, a dig site, flats with the Glint, reaches, reed spawns and a grass spawn. */
export const TOWN = Object.freeze({
  id: 'town-map', kind: 'exterior', region: 'town', w: 40, h: 30,
  entities: [
    { kind: 'tree', id: 't-pear', x: 2, y: 2, fruit: 'pear' },
    { kind: 'tree', id: 't-peach', x: 4, y: 2, fruit: 'peach' },
    { kind: 'tree', id: 't-purse', x: 6, y: 2, fruit: 'pear', purse: true },
    { kind: 'tree', id: 't-bees', x: 8, y: 2, hive: 'honeycomb' },
    { kind: 'tree', id: 't-shells', x: 10, y: 2, shells: ['shore-a'] },
    { kind: 'tree', id: 't-own-purse', x: 12, y: 2, purse: [1000, 1000] },
    { kind: 'npc', id: 'not-a-tree', x: 1, y: 1 },
  ],
  dig: { spots: [[20, 5], [21, 5], [22, 5], [23, 5], [24, 5], [25, 5], { x: 20, y: 6, w: 3, h: 1 }] },
  flats: { glint: true, skyglass: true, spots: [{ x: 0, y: 20, w: 10, h: 3 }], cockles: { item: 'cockle' } },
  reaches: [
    { id: 'r-river', kind: 'river', area: { x: 30, y: 0, w: 5, h: 10 }, creatureTable: 'river-creatures' },
    { id: 'r-quay', kind: 'quay', area: { x: 30, y: 20, w: 6, h: 4 } },
    { id: 'r-creek', kind: 'river', area: { x: 36, y: 0, w: 2, h: 4 }, cond: { flag: 'sp.weir.open' } },
  ],
  spawns: [
    { area: { x: 0, y: 10, w: 4, h: 4 }, table: 'town-reeds', rate: 1, reeds: true },
    { area: { x: 10, y: 10, w: 4, h: 4 }, table: 'isle-grass', rate: 1 },
  ],
});

export const ISLE = Object.freeze({
  id: 'isle-map', kind: 'exterior', region: 'isle-1', w: 20, h: 20,
  entities: [],
  dig: { spots: [[1, 1], [2, 2]], cracks: 1 },
  spawns: [
    { area: { x: 0, y: 0, w: 10, h: 10 }, table: 'isle-grass', rate: 1 },
    { area: { x: 10, y: 0, w: 5, h: 5 }, table: 'isle-grass', rate: 1, cond: { lowTide: true } },
  ],
});

export const ISLE2 = Object.freeze({
  id: 'isle-2-map', kind: 'exterior', region: 'isle-1', w: 10, h: 10,
  spawns: [{ area: { x: 0, y: 0, w: 10, h: 10 }, table: 'isle-2-grass', rate: 1 }],
});

export const POINT = Object.freeze({
  id: 'point-map', kind: 'exterior', region: 'isle-1', w: 10, h: 10,
  spawns: [{ area: { x: 0, y: 0, w: 10, h: 10 }, table: 'lit-point', rate: 1 }],
});

export const HOUSE = Object.freeze({
  id: 'house', kind: 'interior', region: 'isle-1', w: 4, h: 4,
  spawns: [{ area: { x: 0, y: 0, w: 4, h: 4 }, table: 'isle-grass', rate: 1 }],
});

/** Content tables as an object of tables (not a registry). */
export const DATA = Object.freeze({
  collections: COLLECTIONS, species: SPECIES, encounters: ENCOUNTERS, regions: REGIONS, maps: [TOWN, ISLE, ISLE2, POINT, HOUSE],
});

/** Minutes helpers: tide offset 0 puts lows at 0, 745, 1490, 2235, ... */
export const LOW = 745;
export const at = (day, hh, mm = 0) => day * 1440 + hh * 60 + mm;

/**
 * A fresh world; `total` sets the clock.
 * @param {{seed?: string, total?: number}} [o]
 */
export function makeWorld(o = {}) {
  const w = createNewWorld({ seedCode: o.seed ?? 'GATHER-LANE' });
  w.clock.total = o.total ?? at(1, 12);
  return w;
}

/** A party creature with the given types (alive). */
export function creatureOf(uid, types, hp = 10) {
  return { ...creatureDefaults(), uid, speciesId: 'form-a', familyId: 'fam', types, level: 5, hp, stats: { hp: 20, atk: 1, def: 1, spa: 1, spd: 1, spe: 1 } };
}

/** A bus stub that records every emit as [event, payload]. */
export function recordingBus() {
  const events = [];
  return { bus: { emit: (e, p) => { events.push([e, p]); } }, events };
}

/** The run's master generator for a world. */
export const master = (w) => makeRng(w.run.seed);
