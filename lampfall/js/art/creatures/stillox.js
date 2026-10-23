/**
 * Stillox: creature sprites by form id (GDD-03 §5, §8; GDD-00 §14). [ART-CREATURES]
 * Forms: Stillox.
 *
 * Palette-indexed string art in master-palette letters (`js/art/palette.js` MASTER; `.` is clear), left-front
 * 3/4, light from the top-left. Each form: `rows` (front), `idle2` (the second idle frame), `back` (the
 * player-side view), `keys` (the letters it may draw, `k` outline included; never `m` outside the Vagary),
 * `highlight` (Heartmark centre: `w` on cool bodies, `y` on warm or white ones), and the four Heartmark
 * anchors `{head, chest, back, tail}` for each frame. `mark` names the anchor the prototype drew.
 * Ported pixel-for-pixel from `proto/creatures/sprites.js` (art-directed): Stillox.
 * Pure data: imports nothing.
 * @module art/creatures/stillox
 */

/** Family id (`js/data/species`). */
export const FAMILY = 'stillox';

/** Sprite records by form id. */
export const SPRITES = Object.freeze({
  // Stillox (Stone, stage 4): a carved stone ox: withers hump, chisel-cut horns, fluted column legs with capital and base
  'stillox': {
    source: 'drawn', size: 32, keys: 'kwvedn', highlight: 'w', idle: 'squash', mark: 'head',
    anchors: { head: { x: 9, y: 13 }, chest: { x: 5, y: 17 }, back: { x: 18, y: 10 }, tail: { x: 28, y: 12 } },
    anchorsIdle2: { head: { x: 9, y: 14 }, chest: { x: 5, y: 18 }, back: { x: 18, y: 11 }, tail: { x: 28, y: 13 } },
    anchorsBack: { head: { x: 22, y: 13 }, chest: { x: 26, y: 17 }, back: { x: 13, y: 10 }, tail: { x: 3, y: 12 } },
    rows: [
      '................................',
      '................................',
      '...kk...........................',
      '..kwvk........kk................',
      '..kwvvk......kvek...............',
      '..kvvvvk....kkvekk..............',
      '...kvvvek.kkkvvekvkk............',
      '....kvvek.kvkvekvvvk............',
      '.....kvek.kkvekvvvvekkkkk.......',
      '..kkkkkkkkeeeeeeeeeeeeeeekkkkk..',
      '..kvvvvvveekeeeeeeeeeeeeeeeeek..',
      '.kevvvvvveekeeeeeeeeeeeeeeddddk.',
      '.kvvwkeeeeekeeeeeeeeeeeeeeddddk.',
      '.kvvkkeeeeekeeeeeeeeeeeeeeddddk.',
      '.kvveeeeeeekeeeeeeeeedddddddeek.',
      '.keeeeeeeeekeeeeeeeddddddddddk..',
      '.kekkekekddkeeeeeeeddddddddddk..',
      '..keeeeeeddkeeeeeeedddddddddddk.',
      '..keeeeeekdkeeeeeeeddddddddddk..',
      '..kkkkkkk.kdddddddddddddddddddk.',
      '..........kdddddddddddddddddddk.',
      '..........kkkkkkkkkkkkkkkkkkkkk.',
      '.......kkkkkkkkkkk..kkkkkkkkkkk.',
      '.......kvvvvvkkddk..kvvvvvkkddk.',
      '........kvevk.kddk...kvevk.kddk.',
      '........kvevk.kddk...kvevk.kddk.',
      '........kvevk.kddk...kvevk.kddk.',
      '........kvedk.kddk...kvedk.kddk.',
      '........kdedk.kddk...kdedk.kddk.',
      '.......kdddddkkddk..kdddddkkddk.',
      '.......kkkkkkkkkkk..kkkkkkkkkkk.',
      '................................',
    ],
    idle2: [
      '................................',
      '................................',
      '................................',
      '...kk...........................',
      '..kwvk........kk................',
      '..kwvvk......kvek...............',
      '..kvvvvk....kkvekk..............',
      '...kvvvek.kkkvvekvkk............',
      '....kvvek.kvkvekvvvk............',
      '.....kvek.kkvekvvvvekkkkk.......',
      '..kkkkkkkkeeeeeeeeeeeeeeekkkkk..',
      '..kvvvvvveekeeeeeeeeeeeeeeeeek..',
      '.kevvvvvveekeeeeeeeeeeeeeeddddk.',
      '.kvvwkeeeeekeeeeeeeeeeeeeeddddk.',
      '.kvvkkeeeeekeeeeeeeeeeeeeeddddk.',
      '.kvveeeeeeekeeeeeeeeedddddddeek.',
      '.keeeeeeeeekeeeeeeeddddddddddk..',
      '.kekkekekddkeeeeeeeddddddddddk..',
      '..keeeeeeddkeeeeeeedddddddddddk.',
      '..keeeeeekdkeeeeeeeddddddddddk..',
      '..kkkkkkk.kdddddddddddddddddddk.',
      '..........kdddddddddddddddddddk.',
      '..........kkkkkkkkkkkkkkkkkkkkk.',
      '.......kkkkkkkkkkk..kkkkkkkkkkk.',
      '.......kvvvvvkkddk..kvvvvvkkddk.',
      '........kvevk.kddk...kvevk.kddk.',
      '........kvevk.kddk...kvevk.kddk.',
      '........kvevk.kddk...kvevk.kddk.',
      '........kvedk.kddk...kvedk.kddk.',
      '.......kdddddkkddk..kdddddkkddk.',
      '.......kkkkkkkkkkk..kkkkkkkkkkk.',
      '................................',
    ],
    back: [
      '................................',
      '................................',
      '...........................kk...',
      '................kk........kvwk..',
      '...............kevk......kvvwk..',
      '..............kkevkk....kvvvvk..',
      '............kkvkevvkkk.kevvvk...',
      '............kvvvkevkvk.kevvk....',
      '.......kkkkkevvvvkevkk.kevk.....',
      '..kkkkkeeeeeeeeeeeeeeekkkkkkkk..',
      '..keeeeeeeeeeeeeeeeekeevvvvvvk..',
      '.kddddeeeeeeeeeeeeeekeevvvvvvek.',
      '.kddddeeeeeeeeeeeeeekeeeeeeevvk.',
      '.kddddeeeeeeeeeeeeeekeeeeeeevvk.',
      '.keedddddddeeeeeeeeekeeeeeeevvk.',
      '..kddddddddddeeeeeeekeeeeeeeeek.',
      '..kddddddddddeeeeeeekddeeeeeeek.',
      '.kdddddddddddeeeeeeekddeeeeeee..',
      '..kddddddddddeeeeeeekdkeeeeeek..',
      '.kdddddddddddddddddddk.kkkkkkk..',
      '.kdddddddddddddddddddk..........',
      '.kkkkkkkkkkkkkkkkkkkkk..........',
      '.kkkkkkkkkkk..kkkkkkkkkkk.......',
      '.kddkkvvvvvk..kddkkvvvvvk.......',
      '.kddk.kvevk...kddk.kvevk........',
      '.kddk.kvevk...kddk.kvevk........',
      '.kddk.kvevk...kddk.kvevk........',
      '.kddk.kdevk...kddk.kdevk........',
      '.kddk.kdedk...kddk.kdedk........',
      '.kddkkdddddk..kddkkdddddk.......',
      '.kkkkkkkkkkk..kkkkkkkkkkk.......',
      '................................',
    ],
  },
});

export default SPRITES;
