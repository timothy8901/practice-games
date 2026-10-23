/**
 * THE KEEPERS' HALL (keepers-hall), Shardcrown — Bastien Kell and Cass Rune (GDD-00 §4, §8;
 * GDD-01 §13.2). [DATA-MAPS] 20x14 interior. Door (10,13), arrival (10,12) back to Hollis's Gate (10,1);
 * the north door (10,0) climbs on to Idris's Hall.
 *
 * In the middle, on its round stone hearth, the OLD BRAZIER the Keepers tended through the dark years:
 * the one light on the isles for thirty years. Bastien's side (west) is the salvage diver's: the ribs
 * of a lost fleet boat, net racks, creels of things brought up from the bar. Cass's side (east) is the
 * weather-watcher's: wind vanes, the sky window, chimes. Bastien takes you first at the foot of the
 * hall; Cass waits by the north door (spires.js SUMMIT order). No Waystone in here: HP stays as it is
 * between fights (`between` in spires.js).
 *
 * Legend (map-local): '#' cave-wall, 's' wall-stone, ']' window-stone, 'F' floor-stone, 'd' spire-dais,
 * '@' door-stone; default 'f' flagstones; detail 'B' brazier, 'w' wreck-ribs (32x32), 'n' net-rack,
 * 'j' creel, 'L' lamp-post.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'keepers-hall',
  name: 'Keepers\' Hall',
  kind: 'interior',
  region: 'shardcrown',
  w: 20,
  h: 14,
  legend: { '#': 'cave-wall', s: 'wall-stone', ']': 'window-stone', F: 'floor-stone', d: 'spire-dais', B: 'brazier', w: 'wreck-ribs', n: 'net-rack', j: 'creel' },
  ground: [
    '##########@#########', //  0  on to Idris's Hall
    '#ssssssssfFfss]]]ss#', //  1  the sky window (14-16,1)
    '#FFFFFFFFFFFFFFFFFF#', //  2
    '#FFF#FFFFFFFFFF#FFF#', //  3  pillars
    '#FFFFFFFFFFFFFFFFFF#', //  4
    '#FFFFFFFFddddFFFFFF#', //  5  the brazier hearth (8-11,5-8)
    '#FFFFFFFdddddFFFFFF#', //  6
    '#FFFFFFFdddddFFFFFF#', //  7
    '#FFFFFFFFddddFFFFFF#', //  8
    '#FFFFFFFFFFFFFFFFFF#', //  9
    '#FFF#FFFFFFFFFF#FFF#', // 10  pillars
    '#FFFFFFFFFFFFFFFFFF#', // 11
    '#FFFFFFFFFFFFFFFFFF#', // 12
    '##########@#########', // 13
  ],
  detail: [
    '....................', //  0
    '....................', //  1
    '.n................L.', //  2
    '.n..................', //  3
    '....................', //  4
    '....................', //  5
    '..........B.........', //  6  the old brazier (10,6)
    '....................', //  7
    '.w..................', //  8  ribs of a lost boat (1-2,7-8)
    '.j..................', //  9
    '.j................L.', // 10
    '....................', // 11
    '....................', // 12
    '....................', // 13
  ],
  overlay: null,
  collision: null,
  props: [
    { art: 'light-pool', x: 9, y: 7, note: 'the brazier\'s pool on the hearth stones' },
    { art: 'weathervane', x: 17, y: 3, note: 'ART REQUEST weathervane: Cass\'s vanes' },
    { art: 'weathervane', x: 17, y: 8 },
    { art: 'string-lights', x: 15, y: 2, note: 'wind chimes under the sky window' },
    { art: 'fleet-nameboard', x: 3, y: 1, note: 'ART REQUEST fleet-nameboard: names of the lost fleet Bastien brought up' },
  ],
  entities: [],
  triggers: [
    { x: 10, y: 6, kind: 'use', id: 'old-brazier', verb: 'look', text: 'The old brazier. Somebody fed it every night for thirty years.' },
    { x: 1, y: 7, w: 2, h: 2, kind: 'use', id: 'lost-boat', verb: 'look', text: 'The ribs of a harbour boat. A Pellwick boat. Bastien brought it up in pieces.' },
  ],
  warps: [
    { x: 10, y: 13, kind: 'door', to: { mapId: 'hollis-gate', x: 10, y: 1, facing: 'down' }, sfx: 'doorOpen' },
    { x: 10, y: 0, kind: 'door', to: { mapId: 'idris-hall', x: 10, y: 12, facing: 'up' }, via: 'summit', sfx: 'doorOpen' },
  ],
  spawns: [],
  regions: {
    'keepers-hall': { x: 1, y: 2, w: 18, h: 11 },
    'brazier-hearth': { x: 7, y: 5, w: 5, h: 4 },
    'bastien-side': { x: 1, y: 2, w: 6, h: 11 },
    'cass-side': { x: 13, y: 2, w: 6, h: 11 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'keepers-hall-brazier-left': { x: 6, y: 10, facing: 'right', trainer: 'bastien-keeper' },
    'keepers-hall-brazier-right': { x: 13, y: 3, facing: 'left', trainer: 'cass-keeper' },
    // trainer posts (GDD-01 §1: every TRAINER_IDS row has trainer-<id> on its map)
    'trainer-bastien-keeper': { x: 6, y: 10, facing: 'right', trainer: 'bastien-keeper' },
    'trainer-cass-keeper': { x: 13, y: 3, facing: 'left', trainer: 'cass-keeper' },
    'from-door': { x: 10, y: 12, facing: 'up' },
    'door-front': { x: 10, y: 12, facing: 'down' },
    'from-idris-hall': { x: 10, y: 1, facing: 'down' },
    'bastien-post': { x: 6, y: 10, facing: 'right', trainer: 'bastien-keeper' },
    'bastien-challenger': { x: 9, y: 10, facing: 'left' },
    'cass-post': { x: 13, y: 3, facing: 'left', trainer: 'cass-keeper' },
    'cass-challenger': { x: 10, y: 3, facing: 'right' },
    'old-brazier': { x: 10, y: 6, onSolid: true },
    'brazier-front': { x: 10, y: 9, facing: 'up' },
    'north-door': { x: 10, y: 1, facing: 'up' },
    'bell-restart-bastien': { x: 9, y: 10, facing: 'left', note: 'the Summit Bell returns you here when Bastien beat you' },
    'bell-restart-cass': { x: 10, y: 3, facing: 'right', note: 'the Summit Bell returns you here when Cass beat you' },
  },
  music: 'summit',
  light: { indoor: true },
  entry: { x: 10, y: 12, facing: 'up' },
};
