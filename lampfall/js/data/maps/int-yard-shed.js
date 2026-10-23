/**
 * THE CO-OP YARD SHED (int-yard-shed) — Hearthwright & Daughter (GDD-00 §7, §10; GDD-01 §11.5).
 * [DATA-MAPS] 14x10 interior. Door (7,9), arrival (7,8); the door returns to (56,26) in the yard.
 *
 * Wren's desk with the Hearth Ledger and the big abacus (payments happen at the yard counter outside;
 * in here you read the ledger and pick commissions), the TALLY WALL (one split stick goes up per loan
 * cleared, seven pegs), Ambrose's workbench and the alder planks he notches, the plans table where
 * Wren's room drawings are pinned (and the Lamp Room model when she offers it, `sp.lamp-room-offered`),
 * Peg the Scrapling's basket by the stove.
 *
 * Legend (map-local): '#' int-wall-top, 'W' int-wall, 'F' floor-boards, '%' window; detail
 * 'T' table, 'k' timber-stack, 'c' crates, '(' barrel, 'r' rug.
 * @type {import('../index.js').MapDef}
 */
/** One peg of the tally wall: the stick of loan n hangs once loan n is cleared (open tier > n; the last loan stays open at full payment). ART REQUEST split-stick. */
const stick = (n, x) => ({ art: 'split-stick', x, y: 1, cond: n < 7 ? { loan: { tier: { gte: n + 1 } } } : { loan: { tier: { gte: 7 }, paid: true } }, n });

export default {
  id: 'int-yard-shed',
  name: 'Co-op Yard Shed',
  kind: 'interior',
  region: 'pellwick',
  w: 14,
  h: 10,
  legend: { '#': 'int-wall-top', W: 'int-wall', F: 'floor-boards', T: 'table', k: 'timber-stack', r: 'rug' },
  ground: [
    '##############', // 0
    '#%WWWWWWWWWW%#', // 1  the tally wall (3-9,1) between the windows
    '#FFFFFFFFFFFF#', // 2
    '#FFFFFFFFFFFF#', // 3
    '#FFFFFFFFFFFF#', // 4
    '#FFFFFFFFFFFF#', // 5
    '#FFFFFFFFFFFF#', // 6
    '#FFFFFFFFFFFF#', // 7
    '#FFFFFFFFFFFF#', // 8
    '#######+######', // 9
  ],
  detail: [
    '..............', // 0
    '..............', // 1
    '............c.', // 2
    '.TT...TT....c.', // 3  Ambrose's bench (1-2,3); Wren's desk (6-7,3)
    '..............', // 4
    '..........TT..', // 5  the plans table
    '.k............', // 6  alder planks
    '.kk.....r.....', // 7
    '(.......r.....', // 8
    '..............', // 9
  ],
  overlay: null,
  collision: null,
  props: [
    stick(1, 3), stick(2, 4), stick(3, 5), stick(4, 6), stick(5, 7), stick(6, 8), stick(7, 9),
    { art: 'commission-plans', x: 10, y: 5, note: 'ART REQUEST commission-plans: Wren\'s room drawings' },
    { art: 'lamp-room-model', x: 11, y: 5, cond: { flag: 'sp.lamp-room-offered' }, note: 'ART REQUEST lamp-room-model (also FURNITURE_IDS lamp-room-model)' },
  ],
  entities: [
    { kind: 'prop', id: 'abacus', x: 8, y: 3, art: 'abacus', verb: 'ledger', note: 'ART REQUEST abacus: the bead frame Wren counts payments on' },
    { kind: 'prop', id: 'peg-basket', x: 11, y: 8, art: 'peg-basket', verb: 'look', note: 'ART REQUEST peg-basket: Peg the Scrapling\'s basket by the stove' },
  ],
  triggers: [
    { x: 6, y: 3, w: 2, h: 1, kind: 'use', id: 'hearth-ledger', verb: 'ledger' },
    { x: 8, y: 3, kind: 'use', id: 'abacus', verb: 'ledger' },
    { x: 10, y: 5, w: 2, h: 1, kind: 'use', id: 'plans-table', verb: 'commission' },
    { x: 3, y: 1, w: 7, h: 1, kind: 'use', id: 'tally-wall', verb: 'tallyWall' },
    { x: 1, y: 3, w: 2, h: 1, kind: 'use', id: 'ambrose-bench', verb: 'look' },
  ],
  warps: [{ x: 7, y: 9, kind: 'door', to: { mapId: 'pellwick', x: 56, y: 26, facing: 'down' }, sfx: 'doorOpen' }],
  spawns: [],
  regions: {
    shed: { x: 1, y: 2, w: 12, h: 7 },
    'ledger-desk': { x: 5, y: 2, w: 5, h: 3 },
    'plans-table': { x: 9, y: 4, w: 4, h: 3 },
  },
  markers: {
    'from-door': { x: 7, y: 8, facing: 'up' },
    'door-front': { x: 7, y: 8, facing: 'down' },
    'wren-ledger': { x: 6, y: 2, facing: 'down' },
    'wren-abacus': { x: 8, y: 2, facing: 'down' },
    'ledger-front': { x: 6, y: 4, facing: 'up' },
    'abacus-front': { x: 8, y: 4, facing: 'up' },
    'tally-wall-front': { x: 4, y: 2, facing: 'up' },
    'ambrose-workbench': { x: 2, y: 4, facing: 'up' },
    'ambrose-planks': { x: 2, y: 6, facing: 'left' },
    'plans-table-front': { x: 10, y: 6, facing: 'up' },
    'lamp-room-offer-wren': { x: 11, y: 4, facing: 'down' },
    'lamp-room-offer-player': { x: 11, y: 6, facing: 'up' },
    'lamp-room-model': { x: 11, y: 5, onSolid: true },
    'peg-basket': { x: 11, y: 8, onSolid: true },
    'peg-basket-front': { x: 10, y: 8, facing: 'right' },
    'shed-window': { x: 1, y: 2, facing: 'up' },
  },
  music: null,
  light: { indoor: true },
  entry: { x: 7, y: 8, facing: 'up' },
};
