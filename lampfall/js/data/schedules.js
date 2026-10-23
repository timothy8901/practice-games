/** Reusable walking loops. Every vertex resolves through the authored world markers. */
import { deepFreeze } from './ids.js';
import { MAPS_BY_ID } from './maps/index.js';
const path = (id, mapId, names) => ({ id, kind: 'path', mapId, loop: true,
  points: names.map((name) => { const m = MAPS_BY_ID[mapId].markers[name]; if (!m) throw new Error(`Schedule marker: ${name}`); return [m.x, m.y]; }) });
export const SCHEDULES = deepFreeze([
  path('tully-flats-lap', 'pellwick', ['tully-lap-1', 'tully-lap-2', 'tully-lap-3', 'tully-lap-4']),
  path('augusta-porch-count', 'pellwick', ['augusta-wardens-step', 'commons-pin', 'porch-tully-step', 'augusta-wardens-step']),
]);
export default SCHEDULES;
