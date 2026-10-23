/**
 * Tossup: creature sprites by form id (GDD-03 §5, §8; GDD-00 §14). [ART-CREATURES]
 * Forms: Tossup.
 *
 * Palette-indexed string art in master-palette letters (`js/art/palette.js` MASTER; `.` is clear), left-front
 * 3/4, light from the top-left. Each form: `rows` (front), `idle2` (the second idle frame), `back` (the
 * player-side view), `keys` (the letters it may draw, `k` outline included; never `m` outside the Vagary),
 * `highlight` (Heartmark centre: `w` on cool bodies, `y` on warm or white ones), and the four Heartmark
 * anchors `{head, chest, back, tail}` for each frame. `mark` names the anchor the prototype drew.
 * Ported pixel-for-pixel from `proto/creatures/sprites.js` (art-directed): Tossup.
 * Star-touched: `tossup` (palette remap in `./index.js` from the family's `starPalette`).
 * Pure data: imports nothing.
 * @module art/creatures/tossup
 */

/** Family id (`js/data/species`). */
export const FAMILY = 'tossup';

/** Sprite records by form id. */
export const SPRITES = Object.freeze({
  // Tossup (Plain, stage 1): a hermit crab living in a chipped blue-banded teacup
  'tossup': {
    source: 'drawn', size: 32, keys: 'kwvebahu', highlight: 'y', idle: 'squash', mark: 'head',
    anchors: { head: { x: 14, y: 8 }, chest: { x: 10, y: 12 }, back: { x: 20, y: 16 }, tail: { x: 24, y: 15 } },
    anchorsIdle2: { head: { x: 14, y: 9 }, chest: { x: 10, y: 13 }, back: { x: 20, y: 17 }, tail: { x: 24, y: 16 } },
    anchorsBack: { head: { x: 17, y: 8 }, chest: { x: 21, y: 12 }, back: { x: 11, y: 16 }, tail: { x: 7, y: 15 } },
    rows: [
      '................................',
      '................................',
      '................................',
      '..........kwk.kwk...............',
      '..........kkk.kkk...............',
      '...........kak.kak..............',
      '...........kaakkaak.............',
      '.........kkkaaaaaakkkk..........',
      '.......kkeekaaaaaakeeekk........',
      '......keeeekaaaaaakeeeeeek......',
      '.....kwwkaakwwwwwwwwkkwwwvk.....',
      '....kkkkaaaakbbbbbbbeebbbbkkkkk.',
      '...kaaahhaaahkbbbbbbkkbbbbkvvvvk',
      '..kaakkkhaaahhkwwwwwwwwwwwkvkkek',
      '..kakk..kkaaahkkwwwwwwwwwwkvk.ek',
      '..kaak...kkhhhkkwwwwwwwwwvkvk.ek',
      '...kkakwwwkkkkwwwwwwwwwwvvkvk.ek',
      '....kkkkwwwwwwwwwwwwwwwvvvkvvvvk',
      '.......kwwwwwwwwwwwwwwvvvekkkkkk',
      '........kwwwwwwwwwwwwwvvveek....',
      '.........kvwwwwwwwwwwvvveeek....',
      '..........kvvwwwwwwwvvveek......',
      '...........kkvwwwwwvveekk.......',
      '.............kkkkkkkkkk.........',
      '............kvvvvvveeeek........',
      '............kkkkkkkkkkkk........',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
    idle2: [
      '................................',
      '................................',
      '................................',
      '................................',
      '..........kwk.kwk...............',
      '..........kkk.kkk...............',
      '...........kak.kak..............',
      '...........kaakkaak.............',
      '.........kkkaaaaaakkkk..........',
      '.......kkeekaaaaaakeeekk........',
      '......keeeekaaaaaakeeeeeek......',
      '.....kwwkaakwwwwwwwwkkwwwvk.....',
      '....kkkkaaaakbbbbbbbeebbbbkkkkk.',
      '...kaaahhaaahkbbbbbbkkbbbbkvvvvk',
      '..kaakkkhaaahhkwwwwwwwwwwwkvkkek',
      '..kakk..kkaaahkkwwwwwwwwwwkvk.ek',
      '..kaak...kkhhhkkwwwwwwwwwvkvk.ek',
      '...kkakwwwkkkkwwwwwwwwwwvvkvk.ek',
      '....kkkkwwwwwwwwwwwwwwwvvvkvvvvk',
      '.......kwwwwwwwwwwwwwwvvvekkkkkk',
      '........kwwwwwwwwwwwwwvvveek....',
      '.........kvwwwwwwwwwwvvveeek....',
      '..........kvvwwwwwwwvvveek......',
      '.............kkkkkkkkkk.........',
      '............kvvvvvveeeek........',
      '............kkkkkkkkkkkk........',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
    back: [
      '................................',
      '................................',
      '................................',
      '...............kwk.kwk..........',
      '...............kkk.kkk..........',
      '..............kak.kak...........',
      '.............kaakkaak...........',
      '..........kkkkaaaaaakkk.........',
      '........kkeeekaaaaaakeekk.......',
      '......keeeeeekaaaaaakeeeek......',
      '.....kvwwwkkwwwwwwwwkaakwwk.....',
      '.kkkkkbbbbeebbbbbbbkaaaakkkk....',
      'kvvvvkbbbbkkbbbbbbkhaaahhaaak...',
      'kekkvkwwwwwwwwwwwkhhaaahkkkaak..',
      'ke.kvkwwwwwwwwwwkkhaaakk..kkak..',
      'ke.kvkvwwwwwwwwwkkhhhkk...kaak..',
      'ke.kvkvvwwwwwwwwwwkkkkwwwkakk...',
      'kvvvvkvvvwwwwwwwwwwwwwwwkkkk....',
      'kkkkkkevvvwwwwwwwwwwwwwwk.......',
      '....keevvvwwwwwwwwwwwwwk........',
      '....keeevvvwwwwwwwwwwvk.........',
      '......keevvvwwwwwwwvvk..........',
      '.......kkeevvwwwwwvkk...........',
      '.........kkkkkkkkkk.............',
      '........keeeevvvvvvk............',
      '........kkkkkkkkkkkk............',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
      '................................',
    ],
  },
});

export default SPRITES;
