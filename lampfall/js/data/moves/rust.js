/** Rust techniques (4). Prototype numbers kept. [GDD-04 BATTLE] @module data/moves/rust */
import { m } from './_helpers.js';

export default Object.freeze([
  m('rust-bite', 'Rust Bite', 'Rust', 'physical', 60, 100, 20, 0, { status: { kind: 'poison', chance: 0.3 }, contact: true }, 'A bite of old iron. May poison.'),
  m('corrode', 'Corrode', 'Rust', 'status', 0, 90, 25, 0, { status: { kind: 'poison', chance: 1 } }, 'Poisons the target.'),
  m('iron-pin', 'Iron Pin', 'Rust', 'physical', 80, 100, 15, 0, { contact: true }, 'Pins with a rusted spike.'),
  m('hullburst', 'Hullburst', 'Rust', 'physical', 150, 100, 5, 0, { selfKo: true }, 'The user bursts apart and faints. Fails while Sodden is on the field.'),
]);
