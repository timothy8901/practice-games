/**
 * THE WEATHER SPIRE (spire-weather), Emberstep — Ines Calloway, posted 3-turn weather (GDD-00 §4;
 * GDD-01 §12.3). [DATA-MAPS] 20x14 interior. Door (10,13), arrival (10,12); returns to Emberstep's
 * `spire-step`.
 *
 * A spa hall cut into the volcano, its four corners dressed as the four arena weathers in cycle order,
 * so the walk up the nave passes them as the HUD will post them: STEAM (south-west: hot-spring pools and
 * the spa terrace), ASH (north-west: ash floor, volcanic rock, ember vents), SQUALL (north-east: heather
 * and gorse combed flat by a draught from the vents), CLEAR (south-east: a sun-warm flower bed under
 * the skylight). The posted cycle is chalked on a board by the door; Ines's dais heads the nave.
 *
 * Legend (map-local): '#' spire-wall-weather, 'F' spire-floor-weather, 'd' spire-dais, 'e' spa-terrace;
 * defaults 'J' hot-spring, '>' ash, 'n' heather, '*' / '&' flowers; detail '<' volcanic-rock,
 * 'v' ember-vent, 'y' gorse.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'spire-weather',
  name: 'Weather Spire',
  kind: 'interior',
  region: 'emberstep',
  spire: 'weather',
  w: 20,
  h: 14,
  legend: { '#': 'spire-wall-weather', F: 'spire-floor-weather', d: 'spire-dais', e: 'spa-terrace', v: 'ember-vent' },
  ground: [
    '####################', //  0
    '#>>>##FFFFFFFF##nnn#', //  1  ASH (NW) | SQUALL (NE)
    '#>>>>FFFddddFFFFnnn#', //  2  Ines's dais (8-11,2-3)
    '#>>>>FFFddddFFFFnnn#', //  3
    '#>>>>>FFFFFFFFnnnnn#', //  4
    '#>>>>>FFFFFFFFnnnnn#', //  5
    '#>>>>FFFFFFFFFFnnnn#', //  6
    '#FFFFFFFFFFFFFFFFFF#', //  7
    '#JJJeeFFFFFFFFF&*&*#', //  8  STEAM (SW) | CLEAR (SE)
    '#JJJJeFFFFFFFFF*&*&#', //  9
    '#JJJeeFFFFFFFFF&*&*#', // 10
    '#eeeeFFFFFFFFFFF*&*#', // 11
    '#eeeFFFFFFFFFFFFFFF#', // 12
    '##########+#########', // 13
  ],
  detail: [
    '....................', //  0
    '.<..............y...', //  1
    '...v...........y..y.', //  2
    '.<..<.............y.', //  3
    '...v...........y....', //  4
    '.<...........y...y..', //  5
    '..<.............y...', //  6
    '....................', //  7
    '....................', //  8
    '....................', //  9
    '....................', // 10
    '....................', // 11
    '....................', // 12
    '....................', // 13
  ],
  overlay: null,
  collision: null,
  props: [
    { art: 'fog-band', x: 1, y: 9, note: 'steam drifting off the springs' },
    { art: 'light-pool', x: 16, y: 9, note: 'the skylight over the clear corner' },
  ],
  entities: [
    { kind: 'prop', id: 'dossier-board', x: 7, y: 12, art: 'commons-board', verb: 'dossier', spire: 'weather' },
    { kind: 'prop', id: 'dossier-board-r', x: 8, y: 12, blocker: true },
    { kind: 'prop', id: 'weather-board', x: 12, y: 12, art: 'tide-chalkboard', verb: 'look', text: 'STEAM 1-3 · ASH 4-6 · SQUALL 7-9 · CLEAR 10-12 · and round again. You will see it coming.' },
  ],
  triggers: [
    { x: 7, y: 12, w: 2, h: 1, kind: 'use', id: 'dossier', verb: 'dossier', spire: 'weather' },
    { x: 12, y: 12, kind: 'use', id: 'weather-board', verb: 'look' },
  ],
  warps: [{ x: 10, y: 13, kind: 'door', to: { mapId: 'emberstep', x: 6, y: 17, facing: 'down' }, toMarker: 'spire-step', sfx: 'doorOpen' }],
  spawns: [],
  regions: {
    'spire-hall': { x: 1, y: 1, w: 18, h: 12 },
    dais: { x: 8, y: 2, w: 4, h: 2 },
    'steam-corner': { x: 1, y: 8, w: 5, h: 5 },
    'ash-corner': { x: 1, y: 1, w: 5, h: 6 },
    'squall-corner': { x: 14, y: 1, w: 5, h: 6 },
    'clear-corner': { x: 15, y: 8, w: 4, h: 4 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'spire-weather-dais': { x: 10, y: 2, facing: 'down', trainer: 'ines-spire' },
    // trainer posts (GDD-01 §1: every TRAINER_IDS row has trainer-<id> on its map)
    'trainer-ines-spire': { x: 10, y: 2, facing: 'down', trainer: 'ines-spire' },
    'from-door': { x: 10, y: 12, facing: 'up' },
    'door-front': { x: 10, y: 12, facing: 'down' },
    'dossier-front': { x: 9, y: 12, facing: 'left' },
    'weather-board-front': { x: 12, y: 11, facing: 'down' },
    'leader-dais': { x: 10, y: 2, facing: 'down' },
    'ines-dais': { x: 10, y: 2, facing: 'down' },
    'challenger-spot': { x: 10, y: 5, facing: 'up' },
    'badge-spot': { x: 10, y: 4, facing: 'up' },
    'steam-corner': { x: 5, y: 9, facing: 'left' },
    'ash-corner': { x: 4, y: 5, facing: 'left' },
    'squall-corner': { x: 16, y: 4, facing: 'right' },
    'clear-corner': { x: 14, y: 9, facing: 'right' },
  },
  music: 'battle_spire',
  light: { indoor: true },
  entry: { x: 10, y: 12, facing: 'up' },
};
