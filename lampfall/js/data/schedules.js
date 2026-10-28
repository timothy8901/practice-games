/**
 * DATA.schedules: shared walking loops and schedule templates for the cast. [DATA-CAST] GDD-06.
 *
 * Two row kinds (systems/schedule, tools/validate-data):
 * - `path`: `{id, kind: 'path', mapId, loop, points: [[x, y]]}`: a loop an NPC walks while a schedule
 *   entry with `pose: 'path', path: <id>` is running (systems/schedule `routeFor`). Every vertex is a
 *   named world marker (GDD-01 §1.5), so a loop stands on walkable ground.
 * - `template`: `{id, kind: 'template', entries: [...]}`: entries without a place; an NPC lists
 *   `templates: [{id, mapId, x, y, facing?}]` and each entry takes that spot (`expandSchedule`).
 * @module data/schedules
 */
import { deepFreeze } from './ids.js';
import { MAPS_BY_ID } from './maps/index.js';

const hm = (h, m = 0) => h * 60 + m;
const path = (id, mapId, names, note) => ({ id, kind: 'path', mapId, loop: true,
  points: names.map((name) => { const m = MAPS_BY_ID[mapId].markers[name]; if (!m) throw new Error(`Schedule marker: ${name}`); return [m.x, m.y]; }),
  ...(note ? { note } : {}) });

export const SCHEDULES = deepFreeze([
  // --- Pellwick loops ---------------------------------------------------------------------------
  path('tully-flats-lap', 'pellwick', ['tully-lap-1', 'tully-lap-2', 'tully-lap-3', 'tully-lap-4'],
    'Tully\'s dawn laps of the green, 06:00-08:00: the four corners, clockwise, counted out loud.'),
  path('augusta-porch-count', 'pellwick', ['augusta-wardens-step', 'commons-pin', 'porch-tully-step', 'augusta-wardens-step'],
    'The Warden\'s evening porch count, counting every lit lamp.'),
  path('corin-night-round', 'pellwick', ['corin-archive-step', 'commons-pin', 'market-green', 'tully-lap-1', 'corin-archive-step'],
    'Corin\'s late round of the green: an owl\'s walk, slow, head turning at every lit porch.'),
  // FE-04: the loop stays outside the porch fence (it used to run in to corin-step through the gate,
  // the porch's only way out, and park there whenever Dimity or the player held the porch)
  path('wick-errand-run', 'pellwick', ['wick-cliff-stair', 'wick-errands'],
    'Wick up and down the cliff stair to the cottage gate and back, carrying Rillfin\'s bucket, very fast.'),
  path('odile-golden-walk', 'pellwick', ['meet-odile', 'point-dawn', 'odile-easel', 'point-dawn', 'meet-odile'],
    'Odile walking out to the easel on the point and back, stopping wherever the light changes.'),
  path('pip-bollards', 'pellwick', ['pip-quay', 'pip-player', 'mail-sack', 'pip-player', 'pip-quay'],
    'Pip checking the bollards along the quay, though there are no boats to tie to them.'),

  // --- isle loops -------------------------------------------------------------------------------
  path('hobb-tide-round', 'lowmoor', ['hobb-pavilion', 'hobb-tide-board', 'brackenford-dock', 'hobb-tide-board', 'hobb-pavilion'],
    'Hobb Fallow chalking the Brackenford tide board and walking it back to the pavilion.'),
  path('teal-poling-round', 'drownwood', ['teal-poler', 'mossgate-dock', 'tamsin-drownwood', 'mossgate-dock', 'teal-poler'],
    'Teal Fenner poling the stilt-town boardwalks from her post to the dock and the boatyard.'),
  path('brannoch-lamp-round', 'rimeholt', ['brannoch-cave-lamp', 'cave-mouth', 'seraphine-caves', 'cave-mouth', 'brannoch-cave-lamp'],
    'Brannoch Vey trimming the cave lamps from the mouth to the mirror-ice gallery.'),

  // --- templates --------------------------------------------------------------------------------
  { id: 'isle-post', kind: 'template',
    note: 'Isle folk at a fixed post: up at six, asleep at their post by ten.',
    entries: [{ at: hm(6), pose: 'stand', activity: 'at their post' }, { at: hm(22), pose: 'sleep' }] },
  { id: 'isle-post-late', kind: 'template',
    note: 'Isle folk who keep later hours (the spa, the mill, the cave lamps): up at eight, asleep at midnight.',
    entries: [{ at: hm(8), pose: 'stand', activity: 'at their post' }, { at: hm(23, 59), pose: 'sleep' }] },
]);
export default SCHEDULES;
