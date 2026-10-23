/**
 * HOLLIS'S GATE (hollis-gate), Shardcrown — the end of the Bar, the Summit gate (GDD-00 §4, §8;
 * GDD-01 §13.1). [DATA-MAPS] 20x14 interior (a walled gate court, open to the sky). Door (10,13),
 * arrival (10,12); the door returns to the Bar's `hollis-gate-step`.
 *
 * The rim of the comet's atoll, walled by Hollis Brandt, ex-Mooring quartermaster: the HOLLIS'S GATE
 * Waystone (WAYSTONE_IDS `hollis-gate`; autosave, deferred Forecasts, heals once per tide) with its tide
 * chalkboard; Hollis's desk with the Readers' fund box (Spire shares) and the Ration Ledger; the Summit
 * dossier board (every Keeper's and the Champion's posted roster); crates of supplies; skyglass glinting
 * in the masonry. The SUMMIT GATE in the north wall (10,0) stays barred until six badges
 * (`sp.summit-open`, script `summit-gate`); beyond it the stair to the Keepers' Hall. Braziers flank it.
 *
 * Legend (map-local): '#' cave-wall, 's' wall-stone, ']' window-stone, 'F' floor-stone, '@' door-stone;
 * default 'f' flagstones; detail 'B' brazier, 'T' table, 'c' crates, '(' barrel.
 * @type {import('../index.js').MapDef}
 */
const open = { flag: 'sp.summit-open' };

export default {
  id: 'hollis-gate',
  name: 'Hollis\'s Gate',
  kind: 'interior',
  region: 'shardcrown',
  w: 20,
  h: 14,
  legend: { '#': 'cave-wall', s: 'wall-stone', ']': 'window-stone', F: 'floor-stone', B: 'brazier', T: 'table' },
  ground: [
    '##########@#########', //  0  the Summit gate (10,0)
    '#sss]sssssfsssss]ss#', //  1  the gate passage (10,1)
    '#ffffffffFFFfffffff#', //  2
    '#ffffffffFFFfffffff#', //  3
    '#fffffffffFffffffff#', //  4
    '#fffffffffFffffffff#', //  5
    '#fffffffffFffffffff#', //  6
    '#fffffffffFffffffff#', //  7
    '#fffffffffFffffffff#', //  8
    '#fffffffffFffffffff#', //  9
    '#fffffffffFffffffff#', // 10
    '#ffffffffFFFfffffff#', // 11
    '#ffffffffFFFfffffff#', // 12
    '##########@#########', // 13
  ],
  detail: [
    '....................', //  0
    '....................', //  1
    '........B...B.......', //  2  braziers flank the gate
    '....................', //  3
    '..............TT....', //  4  Hollis's desk
    '....................', //  5
    '....................', //  6
    '....................', //  7
    '....................', //  8
    '....................', //  9
    '.(..............cc..', // 10
    '.(...............c..', // 11
    '....................', // 12
    '....................', // 13
  ],
  overlay: null,
  collision: null,
  props: [
    { art: 'skyglass', x: 6, y: 1, note: 'comet glass in the masonry (glows magenta)' },
    { art: 'skyglass', x: 14, y: 1 },
    { art: 'skyglass', x: 1, y: 7 },
    { art: 'skyglass', x: 18, y: 5 },
    { art: 'ration-ledger', x: 15, y: 4, note: 'ART REQUEST ration-ledger: open on Hollis\'s desk' },
  ],
  entities: [
    { kind: 'prop', id: 'hollis-gate', x: 5, y: 6, art: 'waystone', waystone: true, verb: 'waystone', note: 'WAYSTONE_IDS hollis-gate' },
    { kind: 'prop', id: 'hollis-gate-chalkboard', x: 6, y: 6, art: 'tide-chalkboard', verb: 'tideTable' },
    { kind: 'prop', id: 'readers-fund', x: 16, y: 4, art: 'fund-box', verb: 'readersFund', note: 'ART REQUEST fund-box: the Readers\' fund (Spire shares)' },
    { kind: 'prop', id: 'summit-dossier', x: 3, y: 3, art: 'commons-board', verb: 'dossier', dossier: 'summit', note: 'the Summit dossiers: every Keeper\'s and the Champion\'s roster' },
    { kind: 'prop', id: 'summit-dossier-r', x: 4, y: 3, blocker: true },
    { kind: 'prop', id: 'summit-gate-bars', x: 10, y: 0, art: 'gate-bars', verb: 'look', cond: { not: open }, text: 'Iron bars, and a slate: SIX SEALS. -H.B.', note: 'ART REQUEST gate-bars' },
    { kind: 'prop', id: 'gate-bench', x: 13, y: 9, art: 'bench', verb: 'sit' },
  ],
  triggers: [
    { x: 5, y: 6, kind: 'use', id: 'waystone', verb: 'waystone', waystone: 'hollis-gate' },
    { x: 6, y: 6, kind: 'use', id: 'tide-chalkboard', verb: 'tideTable' },
    { x: 16, y: 4, kind: 'use', id: 'readers-fund', verb: 'readersFund' },
    { x: 14, y: 4, w: 2, h: 1, kind: 'use', id: 'hollis-desk', verb: 'look' },
    { x: 3, y: 3, w: 2, h: 1, kind: 'use', id: 'summit-dossier', verb: 'dossier', dossier: 'summit' },
  ],
  warps: [
    { x: 10, y: 13, kind: 'door', to: { mapId: 'the-bar', x: 59, y: 11, facing: 'down' }, toMarker: 'hollis-gate-step', sfx: 'doorOpen' },
    { x: 10, y: 0, kind: 'door', to: { mapId: 'keepers-hall', x: 10, y: 12, facing: 'up' }, cond: open, via: 'summit', sfx: 'doorOpen' },
  ],
  spawns: [],
  regions: {
    'gate-court': { x: 1, y: 2, w: 18, h: 11 },
    'summit-gate': { x: 9, y: 1, w: 3, h: 2 },
    waystone: { x: 4, y: 5, w: 4, h: 3 },
    'hollis-desk': { x: 13, y: 3, w: 5, h: 3 },
  },
  markers: {
    'from-door': { x: 10, y: 12, facing: 'up' },
    'door-front': { x: 10, y: 12, facing: 'down' },
    'waystone-front': { x: 5, y: 7, facing: 'up' },
    'chalkboard-front': { x: 6, y: 7, facing: 'up' },
    'hollis-desk': { x: 15, y: 3, facing: 'down' },
    'desk-front': { x: 15, y: 5, facing: 'up' },
    'readers-fund-front': { x: 17, y: 4, facing: 'left' },
    'hollis-gate': { x: 11, y: 2, facing: 'left' },
    'summit-gate': { x: 10, y: 1, facing: 'up' },
    'summit-gate-player': { x: 10, y: 3, facing: 'up' },
    'dossier-front': { x: 3, y: 4, facing: 'up' },
    'gate-bench-front': { x: 12, y: 9, facing: 'right' },
    'supplies': { x: 15, y: 10, facing: 'right' },
    'wade-arrival': { x: 5, y: 8, facing: 'down', note: 'where the wade rule lands you when the Bar floods (nearest Waystone)' },
  },
  music: 'summit',
  light: { indoor: false, ambient: 'summit' },
  entry: { x: 10, y: 12, facing: 'up' },
};
