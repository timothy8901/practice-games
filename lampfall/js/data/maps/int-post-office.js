/**
 * Post Office (int-post-office). STUB (GDD-01 §3): a minimal valid map so imports resolve; the isle / interior author replaces this file and keeps the arrival points named in GDD-01 §3.4.
 * @type {import('../index.js').MapDef}
 */
export default {
  stub: true,
  id: 'int-post-office',
  name: 'Post Office',
  kind: 'interior',
  region: 'pellwick',
  w: 12,
  h: 10,
  legend: { '#': 'int-wall', F: 'floor-boards', '+': 'door' },
  ground: [
    '############',
    '#FFFFFFFFFF#',
    '#FFFFFFFFFF#',
    '#FFFFFFFFFF#',
    '#FFFFFFFFFF#',
    '#FFFFFFFFFF#',
    '#FFFFFFFFFF#',
    '#FFFFFFFFFF#',
    '#FFFFFFFFFF#',
    '######+#####',
  ],
  detail: null,
  overlay: null,
  collision: null,
  props: [],
  entities: [],
  triggers: [],
  warps: [{ x: 6, y: 9, kind: 'door', to: { mapId: 'pellwick', x: 48, y: 20, facing: 'down' }, sfx: 'doorOpen' }],
  spawns: [],
  regions: {},
  markers: { 'from-door': { x: 6, y: 8, facing: 'up' } },
  music: null,
  light: { indoor: true },
  entry: { x: 6, y: 8, facing: 'up' },
};
