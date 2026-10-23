/**
 * THE RELAY SPIRE (spire-relay), Thistlewind — Ada & Ivo Halloran, no-repeat rounds (GDD-00 §4;
 * GDD-01 §12.5). [DATA-MAPS] 20x14 interior. Door (10,13), arrival (10,12); returns to Thistlewind's
 * `spire-step`.
 *
 * A mill barn on the moor, fenced into three rings one above the other, one per round (spires.js:
 * round 1 Ivo, round 2 Ada, round 3 both). Each ring opens to the next through a gap in its fence, so
 * the climb reads as the relay: ring 1 (rows 9-12), ring 2 (rows 5-7), the twins' dais (rows 1-3).
 * Heather and gorse grow in from the walls; the sitters' bench by ring 2 is where the creatures you
 * already used wait out the rest of the relay; the roster board by the door says the rule.
 *
 * Legend (map-local): '#' spire-wall-relay, 'F' spire-floor-relay, 'd' spire-dais; defaults 'n' heather;
 * detail '|' fence, 'y' gorse, 'V' hedge.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'spire-relay',
  name: 'Relay Spire',
  kind: 'interior',
  region: 'thistlewind',
  spire: 'relay',
  w: 20,
  h: 14,
  legend: { '#': 'spire-wall-relay', F: 'spire-floor-relay', d: 'spire-dais' },
  ground: [
    '####################', //  0
    '#nnnFFFFddddFFFFnnn#', //  1  round 3: the twins' dais (8-11,1-2)
    '#nnFFFFFddddFFFFFnn#', //  2
    '#nFFFFFFFFFFFFFFFFn#', //  3
    '#nnnFFFFFFFFFFFFnnn#', //  4  fence; gap (9-10,4)
    '#nFFFFFFFFFFFFFFFFn#', //  5  round 2
    '#nFFFFFFFFFFFFFFFFn#', //  6
    '#nFFFFFFFFFFFFFFFFn#', //  7
    '#nnnFFFFFFFFFFFFnnn#', //  8  fence; gap (9-10,8)
    '#nFFFFFFFFFFFFFFFFn#', //  9  round 1
    '#nFFFFFFFFFFFFFFFFn#', // 10
    '#nnFFFFFFFFFFFFFFnn#', // 11
    '#nnnFFFFFFFFFFFFnnn#', // 12
    '##########+#########', // 13
  ],
  detail: [
    '....................', //  0
    '.yy..............yy.', //  1
    '.y................y.', //  2
    '....................', //  3
    '.yy||||||..||||||yy.', //  4
    '....................', //  5
    '....................', //  6
    '....................', //  7
    '.yy||||||..||||||yy.', //  8
    '....................', //  9
    '....................', // 10
    '.y................y.', // 11
    '.yy..............yy.', // 12
    '....................', // 13
  ],
  overlay: null,
  collision: null,
  props: [
    { art: 'jackdaw-feathers', x: 10, y: 1, note: 'ART REQUEST jackdaw-feathers: the Relay Seal\'s crossed feathers over the dais' },
  ],
  entities: [
    { kind: 'prop', id: 'dossier-board', x: 7, y: 12, art: 'commons-board', verb: 'dossier', spire: 'relay' },
    { kind: 'prop', id: 'dossier-board-r', x: 8, y: 12, blocker: true },
    { kind: 'prop', id: 'roster-board', x: 12, y: 12, art: 'tide-chalkboard', verb: 'look', text: 'THREE ROUNDS. TWO OF YOURS EACH. NOBODY TWICE. (Unless you have run out of nobodies.)' },
    { kind: 'prop', id: 'sitters-bench', x: 15, y: 6, art: 'bench', verb: 'sit', text: 'The sitters\' bench. Whoever has fought waits here.' },
  ],
  triggers: [
    { x: 7, y: 12, w: 2, h: 1, kind: 'use', id: 'dossier', verb: 'dossier', spire: 'relay' },
    { x: 12, y: 12, kind: 'use', id: 'roster-board', verb: 'look' },
  ],
  warps: [{ x: 10, y: 13, kind: 'door', to: { mapId: 'thistlewind', x: 26, y: 8, facing: 'down' }, toMarker: 'spire-step', sfx: 'doorOpen' }],
  spawns: [],
  regions: {
    'spire-hall': { x: 1, y: 1, w: 18, h: 12 },
    dais: { x: 8, y: 1, w: 4, h: 2 },
    'ring-1': { x: 2, y: 9, w: 16, h: 4 },
    'ring-2': { x: 2, y: 5, w: 16, h: 3 },
    'ring-3': { x: 2, y: 1, w: 16, h: 3 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'spire-relay-dais': { x: 10, y: 1, facing: 'down', trainer: 'hallorans-spire' },
    // trainer posts (GDD-01 §1: every TRAINER_IDS row has trainer-<id> on its map)
    'trainer-hallorans-spire': { x: 10, y: 1, facing: 'down', trainer: 'hallorans-spire' },
    'from-door': { x: 10, y: 12, facing: 'up' },
    'door-front': { x: 10, y: 12, facing: 'down' },
    'dossier-front': { x: 9, y: 12, facing: 'left' },
    'roster-board-front': { x: 12, y: 11, facing: 'down' },
    'ivo-post': { x: 10, y: 9, facing: 'down', round: 1 },
    'relay-round-1-player': { x: 10, y: 11, facing: 'up' },
    'ada-post': { x: 10, y: 5, facing: 'down', round: 2 },
    'relay-round-2-player': { x: 10, y: 7, facing: 'up' },
    'leader-dais': { x: 10, y: 1, facing: 'down' },
    'hallorans-dais': { x: 10, y: 1, facing: 'down', round: 3 },
    'ada-dais': { x: 9, y: 1, facing: 'down', round: 3 },
    'ivo-dais': { x: 10, y: 1, facing: 'down', round: 3 },
    'challenger-spot': { x: 10, y: 3, facing: 'up' },
    'relay-round-3-player': { x: 10, y: 3, facing: 'up' },
    'badge-spot': { x: 10, y: 3, facing: 'up' },
    'sitters-bench-front': { x: 14, y: 6, facing: 'right' },
  },
  music: 'battle_spire',
  light: { indoor: true },
  entry: { x: 10, y: 12, facing: 'up' },
};
