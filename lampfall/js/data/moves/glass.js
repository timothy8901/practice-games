/** Glass techniques (5: three ordinary + Dust Veil and Vesper Mend signatures). [GDD-04 BATTLE] @module data/moves/glass */
import { m } from './_helpers.js';

export default Object.freeze([
  m('dust-veil', 'Dust Veil', 'Glass', 'special', 30, 100, 20, 0, { status: { kind: 'poison', chance: 0.3 } }, 'Low damage; 30% chance to poison.', 'prismoth'),
  m('shardlight', 'Shardlight', 'Glass', 'special', 75, 100, 15, 0, {}, 'A beam through skyglass.'),
  m('dazzle', 'Dazzle', 'Glass', 'status', 0, 100, 15, 0, { stat: [{ target: 'foe', stat: 'atk', stages: -1 }, { target: 'foe', stat: 'spa', stages: -1 }] }, "Lowers the target's Attack and Sp. Attack."),
  m('lens-focus', 'Lens Focus', 'Glass', 'status', 0, null, 15, 0, { stat: [{ target: 'self', stat: 'spa', stages: 2 }] }, "Sharply raises the user's Sp. Attack."),
  m('vesper-mend', 'Vesper Mend', 'Glass', 'status', 0, null, 10, 0, { recovery: { fraction: 0.5, delay: 1, cancelledBy: 'Hollow' } }, 'The eye panel brightens; at the end of next turn heals 50%. A Hollow hit in between cancels it. Spends one Mend.', 'vesperay'),
]);
