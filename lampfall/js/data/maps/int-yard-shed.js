/**
 * Co-op Yard Shed (int-yard-shed). STUB (GDD-01 §3): a minimal valid map so imports resolve; the isle / interior author replaces this file and keeps the arrival points named in GDD-01 §3.4.
 * @type {import('../index.js').MapDef}
 */
export default {
  stub: true,
  id: 'int-yard-shed',
  name: 'Co-op Yard Shed',
  kind: 'interior',
  region: 'pellwick',
  w: 14,
  h: 10,
  legend: { '#': 'int-wall', F: 'floor-boards', '+': 'door' },
  ground: [
    '##############',
    '#FFFFFFFFFFFF#',
    '#FFFFFFFFFFFF#',
    '#FFFFFFFFFFFF#',
    '#FFFFFFFFFFFF#',
    '#FFFFFFFFFFFF#',
    '#FFFFFFFFFFFF#',
    '#FFFFFFFFFFFF#',
    '#FFFFFFFFFFFF#',
    '#######+######',
  ],
  detail: null,
  overlay: null,
  collision: null,
  props: [],
  entities: [],
  triggers: [],
  warps: [{ x: 7, y: 9, kind: 'door', to: { mapId: 'pellwick', x: 56, y: 26, facing: 'down' }, sfx: 'doorOpen' }],
  spawns: [],
  regions: {},
  markers: { 'from-door': { x: 7, y: 8, facing: 'up' } },
  music: null,
  light: { indoor: true },
  entry: { x: 7, y: 8, facing: 'up' },
};
