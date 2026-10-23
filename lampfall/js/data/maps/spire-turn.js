/**
 * THE TURN SPIRE (spire-turn), Lowmoor — Maud Tallis, posted scripted Shifts (GDD-00 §4; GDD-01 §12.1).
 * [DATA-MAPS] 20x14 interior. Door (10,13), arrival (10,12); the door returns to Lowmoor's `spire-step`.
 *
 * The old ferry pavilion's turning hall: marsh pools in the corners (lagoon water, glasswort on the
 * margins), and in the middle the TURNTABLE, a ring of deck planks round a compass rose, where the
 * ferry once swung to face its crossing. Up the hall, Maud's dais under her ship's wheel, flanked by
 * the three card plinths of the posted strip (Up, Side, Down) that light as her creatures' marks glow.
 * The dossier board stands inside the door.
 *
 * Legend (map-local): '#' spire-wall-turn, 'F' spire-floor-turn, 'd' spire-dais; defaults 'u' lagoon,
 * 'p' deck-planks; detail 'i' glasswort, 'L' lamp-post, 'c' crates.
 * @type {import('../index.js').MapDef}
 */
export default {
  id: 'spire-turn',
  name: 'Turn Spire',
  kind: 'interior',
  region: 'lowmoor',
  spire: 'turn',
  w: 20,
  h: 14,
  legend: { '#': 'spire-wall-turn', F: 'spire-floor-turn', d: 'spire-dais', j: 'creel' },
  ground: [
    '####################', //  0
    '#uuu#FFFFFFFFFF#uuu#', //  1  the wheel and the card plinths
    '#uuuFFFFddddFFFFuuu#', //  2  Maud's dais (8-11,2-3)
    '#uuFFFFFddddFFFFFuu#', //  3
    '#uFFFFFFFFFFFFFFFFu#', //  4
    '#FFFFFFppppppFFFFFF#', //  5  the turntable
    '#uuFFFppFFFFppFFFuu#', //  6
    '#uuuFFpFFddFFpFFuuu#', //  7  the compass rose
    '#uuuFFpFFddFFpFFuuu#', //  8
    '#uuFFFppFFFFppFFFuu#', //  9
    '#FFFFFFppppppFFFFFF#', // 10
    '#uFFFFFFFFFFFFFFFFu#', // 11
    '#uuFFFFFFFFFFFFFFuu#', // 12
    '##########+#########', // 13
  ],
  detail: [
    '....................', //  0
    '....................', //  1
    '....................', //  2
    '...i............i...', //  3
    '..i..L........L..i..', //  4
    '....................', //  5
    '...i............i...', //  6
    '....................', //  7
    '....................', //  8
    '...i............i...', //  9
    '....................', // 10
    '..i..............i..', // 11
    '...j............j...', // 12  coiled ferry ropes
    '....................', // 13
  ],
  overlay: null,
  collision: null,
  props: [
    { art: 'compass-rose', x: 9, y: 8, note: 'ART REQUEST compass-rose (32x32) painted on the turntable' },
  ],
  entities: [
    { kind: 'prop', id: 'maud-wheel', x: 11, y: 1, art: 'ferry-wheel', verb: 'look', text: 'A ferry wheel, polished by one pair of wings for three years.', note: 'ART REQUEST ferry-wheel' },
    { kind: 'prop', id: 'card-plinth-up', x: 6, y: 1, art: 'card-plinth', verb: 'look', card: 'up', note: 'ART REQUEST card-plinth: lights with the posted strip' },
    { kind: 'prop', id: 'card-plinth-side', x: 9, y: 1, art: 'card-plinth', verb: 'look', card: 'side' },
    { kind: 'prop', id: 'card-plinth-down', x: 13, y: 1, art: 'card-plinth', verb: 'look', card: 'down' },
    { kind: 'prop', id: 'dossier-board', x: 7, y: 12, art: 'commons-board', verb: 'dossier', spire: 'turn', note: 'the Spire dossier nailed inside the door (32x32)' },
    { kind: 'prop', id: 'dossier-board-r', x: 8, y: 12, blocker: true, note: 'footprint of the dossier board' },
  ],
  triggers: [
    { x: 7, y: 12, w: 2, h: 1, kind: 'use', id: 'dossier', verb: 'dossier', spire: 'turn' },
    { x: 11, y: 1, kind: 'use', id: 'maud-wheel', verb: 'look' },
  ],
  warps: [{ x: 10, y: 13, kind: 'door', to: { mapId: 'lowmoor', x: 6, y: 8, facing: 'down' }, toMarker: 'spire-step', sfx: 'doorOpen' }],
  spawns: [],
  regions: {
    'spire-hall': { x: 1, y: 1, w: 18, h: 12 },
    dais: { x: 8, y: 2, w: 4, h: 2 },
    turntable: { x: 6, y: 5, w: 8, h: 6 },
    'arena-floor': { x: 7, y: 4, w: 6, h: 2 },
  },
  markers: {
    // trainer posts by data/trainers.js `post` (aliases of trainer-<id>, same cell)
    'spire-turn-dais': { x: 10, y: 2, facing: 'down', trainer: 'maud-spire' },
    // trainer posts (GDD-01 §1: every TRAINER_IDS row has trainer-<id> on its map)
    'trainer-maud-spire': { x: 10, y: 2, facing: 'down', trainer: 'maud-spire' },
    'from-door': { x: 10, y: 12, facing: 'up' },
    'door-front': { x: 10, y: 12, facing: 'down' },
    'dossier-front': { x: 9, y: 12, facing: 'left' },
    'leader-dais': { x: 10, y: 2, facing: 'down' },
    'maud-dais': { x: 10, y: 2, facing: 'down' },
    'challenger-spot': { x: 10, y: 5, facing: 'up' },
    'badge-spot': { x: 10, y: 4, facing: 'up' },
    'maud-wheel': { x: 11, y: 1, onSolid: true },
    'strip-up': { x: 6, y: 1, onSolid: true },
    'strip-side': { x: 9, y: 1, onSolid: true },
    'strip-down': { x: 13, y: 1, onSolid: true },
    'turntable-centre': { x: 9, y: 7, facing: 'up' },
    'spectator-west': { x: 4, y: 10, facing: 'right' },
    'spectator-east': { x: 15, y: 10, facing: 'left' },
  },
  music: 'battle_spire',
  light: { indoor: true },
  entry: { x: 10, y: 12, facing: 'up' },
};
