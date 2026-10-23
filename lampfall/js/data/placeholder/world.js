/**
 * PLACEHOLDER day-1 world tables: tilesets, two tiny ASCII maps, regions, an encounter table and
 * collection rows. [DATA-IDX] Replaced by DATA-MAPS / DATA-GATHER files at integration.
 * @module data/placeholder/world
 */

/**
 * Tile definitions. `char` is the DEFAULT_LEGEND character (§8.4: the prototype's hard-coded legend
 * becomes data). `tide: 'low'` tiles are walkable only at low tide (causeways, stepping stones).
 * @type {ReadonlyArray<import('../index.js').TileDef>}
 */
export const TILESETS = Object.freeze([
  { id: 'deep-water', char: 'D', art: 'deep-water', solid: false, water: true, tide: null, verb: 'fish', sfx: 'stepWater', anim: 4, glow: false },
  { id: 'shallows', char: 'S', art: 'shallows', solid: false, water: true, tide: null, verb: 'fish', sfx: 'stepWater', anim: 4, glow: false },
  { id: 'sand', char: 'A', art: 'sand', solid: false, water: false, tide: null, verb: null, sfx: 'step', anim: 0, glow: false },
  { id: 'wet-sand', char: 'W', art: 'wet-sand', solid: false, water: false, tide: 'floods', verb: 'dig', sfx: 'step', anim: 0, glow: true },
  { id: 'causeway', char: 'E', art: 'causeway', solid: false, water: false, tide: 'low', verb: null, sfx: 'step', anim: 0, glow: false },
  { id: 'grass', char: 'G', art: 'grass', solid: false, water: false, tide: null, verb: null, sfx: 'step', anim: 0, glow: false },
  { id: 'tall-grass', char: 'T', art: 'tall-grass', solid: false, water: false, tide: null, verb: null, sfx: 'step', anim: 2, glow: false },
  { id: 'path', char: 'P', art: 'path', solid: false, water: false, tide: null, verb: null, sfx: 'step', anim: 0, glow: false },
  { id: 'cobbles', char: 'O', art: 'cobbles', solid: false, water: false, tide: null, verb: null, sfx: 'step', anim: 0, glow: false },
  { id: 'pier', char: 'K', art: 'pier', solid: false, water: false, tide: null, verb: 'fish', sfx: 'step', anim: 0, glow: false },
  { id: 'wall', char: '#', art: 'wall', solid: true, water: false, tide: null, verb: null, sfx: null, anim: 0, glow: false },
  { id: 'floor', char: 'F', art: 'floor', solid: false, water: false, tide: null, verb: null, sfx: 'step', anim: 0, glow: false },
]);

/** @type {ReadonlyArray<{id: string, name: string, curveLevel: number, music: string|null}>} */
export const REGIONS = Object.freeze([
  { id: 'ph-region', name: 'PLACEHOLDER region', curveLevel: 5, music: null },
]);

/** @type {ReadonlyArray<import('../index.js').MapDef>} */
export const MAPS = Object.freeze([
  {
    id: 'ph-field', name: 'PLACEHOLDER Field', kind: 'exterior', region: 'ph-region', w: 12, h: 8,
    legend: {},
    ground: [
      'DDDDSSAAGGGG',
      'DDDSSAAGGGGG',
      'DDSSAAGTTGGG',
      'DSSAAEEPPGGG',
      'SSAAGGGPPGGG',
      'SAAGGGGPPGGG',
      'AAGGGTTPGGGG',
      'AGGGGGGPGGGG',
    ],
    detail: null,
    overlay: null,
    collision: null,
    props: [],
    entities: [
      { kind: 'npc', id: 'ph-keeper', x: 9, y: 2 },
      { kind: 'tree', id: 'ph-tree-1', x: 10, y: 1, fruit: 'ph-pear' },
      { kind: 'sign', id: 'ph-sign', x: 8, y: 6, text: 'PLACEHOLDER field. Mind the tide.' },
    ],
    triggers: [
      { x: 9, y: 5, kind: 'use', id: 'ph-mailbox', verb: 'mailbox' },
      { x: 7, y: 6, kind: 'step', id: 'ph-intro-step', script: 'ph-intro', once: true, cond: { not: { flag: 'sp.ph-met' } } },
    ],
    warps: [
      { x: 10, y: 4, to: { mapId: 'ph-hut', x: 3, y: 4, facing: 'up' }, kind: 'door', sfx: 'doorOpen' },
    ],
    spawns: [{ area: 'grass', table: 'ph-grass', rate: 0.08 }],
    regions: { porch: { x: 8, y: 4, w: 2, h: 1 } },
    music: null,
    light: { indoor: false },
    entry: { x: 7, y: 7, facing: 'up' },
  },
  {
    id: 'ph-hut', name: 'PLACEHOLDER Hut', kind: 'interior', region: 'ph-region', w: 8, h: 6,
    legend: {},
    ground: [
      '########',
      '#FFFFFF#',
      '#FFFFFF#',
      '#FFFFFF#',
      '#FFFFFF#',
      '###F####',
    ],
    detail: null,
    overlay: null,
    collision: null,
    props: [],
    entities: [],
    triggers: [{ x: 1, y: 1, kind: 'use', id: 'ph-bed', verb: 'bed' }],
    warps: [
      { x: 3, y: 5, to: { mapId: 'ph-field', x: 10, y: 5, facing: 'down' }, kind: 'door', sfx: 'doorOpen' },
    ],
    spawns: [],
    regions: {},
    music: null,
    light: { indoor: true },
    entry: { x: 3, y: 4, facing: 'up' },
  },
]);

/** @type {Readonly<Record<string, ReadonlyArray<import('../index.js').EncounterRow>>>} */
export const ENCOUNTERS = Object.freeze({
  'ph-grass': [
    { species: 'ph-pip', levels: [2, 4], w: 60 },
    { species: 'ph-pup', levels: [3, 5], w: 20, cond: { phase: ['night', 'evening'] } },
  ],
});

/** @type {ReadonlyArray<import('../index.js').CollectionRow>} */
export const COLLECTIONS = Object.freeze([
  { id: 'ph-fish', kind: 'fish', name: 'PLACEHOLDER Fish', where: ['shallows'], when: { phase: ['dawn', 'dusk'] }, tide: 'any', shadow: 'small', size: [12, 30], tell: 'two short feints then a long pull', price: 90 },
  { id: 'ph-pear', kind: 'fruit', name: 'PLACEHOLDER Pear', price: 10 },
  { id: 'ph-shard', kind: 'relic', name: 'PLACEHOLDER Shard', price: 40 },
]);
