/** Rime techniques (5: four prototype + Floe Ram). [GDD-04 BATTLE] @module data/moves/rime */
import { m } from './_helpers.js';

export default Object.freeze([
  m('frost-nip', 'Frost Nip', 'Rime', 'special', 50, 100, 25, 0, { status: { kind: 'chill', chance: 0.1 } }, 'May chill the target.'),
  m('plate-toss', 'Plate Toss', 'Rime', 'physical', 60, 100, 15, 0, {}, 'Throws one of its own plates; it grows back at the end of the turn.', 'rimeplate'),
  m('hoarfrost', 'Hoarfrost', 'Rime', 'special', 80, 95, 10, 0, { status: { kind: 'chill', chance: 0.2 } }, 'A hard cold. May chill.'),
  m('rime-lock', 'Rime Lock', 'Rime', 'status', 0, 75, 10, 0, { status: { kind: 'chill', chance: 1 } }, 'Chills the target for a few turns.'),
  // New (GDD-ids): a physical Rime option for the plated, heavy-footed forms.
  m('floe-ram', 'Floe Ram', 'Rime', 'physical', 70, 100, 15, 0, { status: { kind: 'chill', chance: 0.1 }, contact: true }, 'Rams like a loose ice floe in a spring tide. 10% chance to chill.'),
]);
