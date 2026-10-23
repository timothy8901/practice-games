/**
 * Wood tiles: the pier and its end, fences, and the timber of the isles: the mangrove boardwalk
 * (Drownwood long way), wooden footbridges (river, moor), stilt-town decking, mooring posts, crates,
 * barrels, lobster creels, a net rack and the wreck ribs of the lost fleet on the Bar. [ART-TILES]
 *
 * Split from `proto/tiles/tiles.js` (pier planks show the water through their gaps; posts on both
 * sides). Blocking pieces keep the base line + cast shadow rule.
 * @module art/tiles/wood
 */

import { createGroup } from './kit.js';

const { tiles, def } = createGroup('wood');

/* ---------------------------------------------------------------- pier */
// Pier: one tile wide, cross planks with water showing through the gaps, posts on both sides.
const PP = { p: 'wd2', d: 'wd1', l: 'wd3', k: 'wd0', w: 'ink', h: 'wd4' };
const PLANKS = [
  'klllllllllllllkk',
  'klppppppppppppdk',
  'klpppdppppppppdk',
  'kwwwwwwwwwwwwwwk',
  'klllllllllllllkk',
  'klppppppppppppdk',
  'klppppppppdpppdk',
  'kwwwwwwwwwwwwwwk',
];
def('pier', PP, [
  ...PLANKS,
  'klllllllllllllkk',
  'klppppppppppppdk',
  'klpppppdppppppdk',
  'kwwwwwwwwwwwwwwk',
  'hklllllllllllkhk',
  'kkppppppppppppkk',
  'kkpppdppppppppkk',
  'kwwwwwwwwwwwwwwk',
]);
def('pier-end', PP, [
  'kkkkkkkkkkkkkkkk',
  'klllllllllllllkk',
  'klppppppppppppdk',
  'klpppppkkpppppdk',
  'kwwwwwwhkwwwwwwk',
  'klllllllllllllkk',
  'klppppppppppppdk',
  'klppdpppppppppdk',
  ...PLANKS.slice(3, 7),
  'hklllllllllllkhk',
  'kkppppppppppppkk',
  'kkppppppppdpppkk',
  'kwwwwwwwwwwwwwwk',
]);
// Pier running east-west (the Old Pier's arm, the Raft's gangway).
const turn = (rows) => rows[0].split('').map((_, x) => rows.map((r) => r[x]).reverse().join(''));
def('pier-h', PP, turn([
  ...PLANKS,
  'klllllllllllllkk',
  'klppppppppppppdk',
  'klpppppdppppppdk',
  'kwwwwwwwwwwwwwwk',
  'klllllllllllllkk',
  'klppppppppppppdk',
  'klpppdppppppppdk',
  'kwwwwwwwwwwwwwwk',
]));

/* -------------------------------------------------------------- boardwalk */
// Mangrove boardwalk (Drownwood long way): narrow weathered boards on stilts over tannin water; the
// gaps and the stilt heads show at the sides, a 1px wet shadow under the boards.
const BWP = { w: 'tan1', s: 'tan0', k: 'ww0', d: 'ww1', m: 'ww2', l: 'ww3', h: 'ww4', p: 'mg0' };
// boards run across the way (N-S for an E-W walk), 3px wide with 1px gaps showing the water; one board
// is short and one is a different tone so a long walk never repeats visibly.
const BOARDWALK = [
  'wwwwwwwwwwwwwwww',
  'wpwwwwwwwwwwwpww',
  'kkkkkkkkkkkkkkkk',
  'hlmshlmshlmkhlms',
  'lmmslmmslmmklmms',
  'lmdslmmsldmklmms',
  'lmmslmmslmmklmds',
  'lmmslmdslmmklmms',
  'lmmslmmslmmklmms',
  'ldmslmmslmmklmms',
  'lmmslmmsldmklmms',
  'lmmslmmswwwklmms',
  'kkkkkkkkkkkkkkkk',
  'ssssssssssssssss',
  'wpwwwwwwwwwwwpww',
  'wwwwwwwwwwwwwwww',
];
def('boardwalk-h', BWP, BOARDWALK);
def('boardwalk-v', BWP, turn(BOARDWALK));

/* ---------------------------------------------------------------- bridges */
// Wooden footbridge over the river (E-W): planks across, a hand-rail on both sides with posts.
const BRP = { k: 'wd0', d: 'wd1', p: 'wd2', l: 'wd3', h: 'wd4', s: 'deep0', r: 'riv1' };
const BRIDGE = [
  'hhhhhhhhhhhhhhhh',
  'kddkddddddkddddk',
  'kkkkkkkkkkkkkkkk',
  'lpppklpppklpppkl',
  'lpppklpdpklpppkl',
  'lpdpklpppklpppkl',
  'lpppklpppklpdpkl',
  'lpppklpppklpppkl',
  'lpppklpppklpppkl',
  'lppdklpppklpppkl',
  'lpppklppdklpppkl',
  'kkkkkkkkkkkkkkkk',
  'ssssssssssssssss',
  'hhhhhhhhhhhhhhhh',
  'kddkddddddkddddk',
  'kkkkkkkkkkkkkkkk',
];
def('bridge-wood', BRP, BRIDGE);
def('bridge-wood-v', BRP, turn(BRIDGE));
// Stilt-town decking (Drownwood): long silvered planks running east-west, grain streaks along each
// board, staggered butt joints, nail heads at the joists.
def('deck-planks', { k: 'ww0', d: 'ww1', m: 'ww2', l: 'ww3', h: 'ww4', n: 'iron' }, [
  'hllllllllllkhlll',
  'mmmdddmmmmmkmmmm',
  'mnmmmmmmmmnkmmnm',
  'kkkkkkkkkkkkkkkk',
  'lllkhlllllllllll',
  'mmmkmmmmmmdddmmm',
  'mmnkmmmmmmmmmmmm',
  'kkkkkkkkkkkkkkkk',
  'llllllllhllllllk',
  'mddddmmmmmmmmmmk',
  'nmmmmmmmmmmmmmnk',
  'kkkkkkkkkkkkkkkk',
  'lllllkhlllllllll',
  'mmmmmkmmmmdddmmm',
  'mmnmmkmmmmmmmmnm',
  'kkkkkkkkkkkkkkkk',
]);

/* ---------------------------------------------------------------- fences */
const FENP = { p: 'wd2', d: 'wd1', l: 'wd3', k: 'base', s: 'shadow' };
def('fence-h', FENP, [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.lk....lk....lk.',
  '.pk....pk....pk.',
  'llllllllllllllll',
  'pppppppppppppppp',
  '.pk....pk....pk.',
  '.pk....pk....pk.',
  'llllllllllllllll',
  'pppppppppppppppp',
  '.pk....pk....pk.',
  '.dk....dk....dk.',
  '................',
], { kind: 'detail' });
def('fence-v', FENP, [
  '......lkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......pkk.......',
  '......dkk.......',
  '................',
], { kind: 'detail' });
// Picket gate (the cottage garden, Bryony's fence thread): a lighter painted gate between posts.
def('fence-gate', { ...FENP, w: 'pl2', v: 'pl0' }, [
  '................',
  '................',
  '................',
  '..w.w.w.w.w.w...',
  '.lwkwkwkwkwkwk..',
  '.pwkwkwkwkwkwk..',
  '.pwwwwwwwwwwwk..',
  '.pvvvvvvvvvvvk..',
  '.pwkwkwkwkwkwk..',
  '.pwkwkwkwkwkwk..',
  '.pwwwwwwwwwwwk..',
  '.pvvvvvvvvvvvk..',
  '.pwkwkwkwkwkwk..',
  '.dvkvkvkvkvkvk..',
  '................',
  '................',
], { kind: 'detail' });

/* ---------------------------------------------------------------- harbor clutter */
// Mooring post: a tarred bollard with a rope turn, base line, shadow.
def('mooring-post', { k: 'base', d: 'wd0', m: 'wd1', l: 'wd2', r: 'sand1', q: 'sand0', s: 'shadow' }, [
  '................',
  '................',
  '................',
  '................',
  '......kkkk......',
  '.....kllmmk.....',
  '.....klmmdk.....',
  '.....kqrrqk.....',
  '.....krqqrk.....',
  '.....kqrrqk.....',
  '.....klmmdk.....',
  '.....klmmdk.....',
  '.....klmmdks....',
  '.....kkkkkkss...',
  '.......sssss....',
  '................',
], { kind: 'detail' });
// Crates: two stacked fish boxes, slatted, stencilled lids.
def('crates', { k: 'base', d: 'wd1', p: 'wd2', l: 'wd3', h: 'wd4', s: 'shadow', i: 'uiink' }, [
  '................',
  '................',
  '....kkkkkkk.....',
  '....khhhhhlk....',
  '....klpppppk....',
  '....klpiipdk....',
  '....kdddddddkk..',
  '..kkkkkkkkkkhk..',
  '..khhhhhhhlkpk..',
  '..klpppppppkpk..',
  '..klddddddpkdk..',
  '..klpppppppkk...',
  '..klpppiipdks...',
  '..kkkkkkkkkkss..',
  '....ssssssssss..',
  '................',
], { kind: 'detail' });
// Barrel: hooped staves, lit west side, base line, shadow.
def('barrel', { k: 'base', d: 'wd0', m: 'wd1', p: 'wd2', l: 'wd3', i: 'iron', j: 'iron2', s: 'shadow' }, [
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '....kmmmmmmk....',
  '....kddddddk....',
  '...kjiiiiiijk...',
  '...klppppmmdk...',
  '...klppppmmdk...',
  '...kjiiiiiijk...',
  '...klppppmmdk...',
  '...klppppmmdk...',
  '...kjiiiiiijks..',
  '....kkkkkkkkss..',
  '.....sssssss....',
  '................',
], { kind: 'detail' });
// Lobster creel: a netted, half-round trap with a rope float (the quay, Tamsin's oyster boat).
def('creel', { k: 'base', d: 'wd1', l: 'wd3', n: 'pl0', m: 'pl1', r: 'red2', q: 'red1', s: 'shadow' }, [
  '................',
  '................',
  '................',
  '................',
  '.....kkkkkk.....',
  '...kkdmnmndkk...',
  '..kdnmnmnmnmdk..',
  '..kmnmnmnmnmnk..',
  '..knmnmnmnmnmk.r',
  '..kdnmnmnmnmdkrq',
  '..klllllllllldq.',
  '..kkkkkkkkkkkks.',
  '....sssssssss...',
  '................',
  '................',
  '................',
], { kind: 'detail' });
// Net rack: two posts and a rail with a drying net draped over it (the quay).
def('net-rack', { k: 'base', d: 'wd1', p: 'wd2', l: 'wd3', n: 'st3', m: 'st2', f: 'red2', s: 'shadow' }, [
  '................',
  '................',
  '.kk..........kk.',
  '.lkpppppppppplk.',
  '.lkddddddddddlk.',
  '.lknmnmnmnmnmlk.',
  '.lkmnmnmnmnmnlk.',
  '.lknmnmfmnmnmlk.',
  '.lk.mnmnmnmn.lk.',
  '.lk..nmnmnm..lk.',
  '.lk...m.n....lk.',
  '.lk..........lk.',
  '.lk..........lk.',
  '.dks.........dks',
  '.kkss........kks',
  '..ss..........ss',
], { kind: 'detail' });

/* ---------------------------------------------------------------- the lost fleet */
// Wreck ribs (the Bar, 32×32): the keel and curved ribs of a lost ship half-sunk in the sand, weed at
// the waterline, barnacled. Blocking: base line and cast shadow.
const RIBS = [
  '................................',
  '................................',
  '....k......k......k......k......',
  '...klk....klk....klk....klk.....',
  '...kmk....kmk....kmk....kmk.....',
  '..klmk...klmk...klmk...klmk.....',
  '..kmdk...kmdk...kmdk...kmdk.....',
  '..kmdk...kmdk...kmdk...kmdk.....',
  '..klmk...klmk...kmmk...klmk.....',
  '..kmdk...kmdk...kmdk...kmdk..k..',
  '..kmmk...kmmk...kmdk...kmdk.klk.',
  '..kmdk...kmdk...kbdk...kmdk.kmk.',
  '..kmdk...kbdk...kmdk...kbdk.kmdk',
  '..kmmk...kmmk...kmmk...kmmk.kmdk',
  '..kbdk...kmdk...kmdk...kmdk.kbdk',
  '..kmdk...kmdk...kmmk...kmdk.kmdk',
  '..kmmk...kgdk...kmdk...kgmk.kmdk',
  '..kgdk...kmgk...kgdk...kmdk.kgdk',
  '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  '.klllllllllllllllllllllllllllllk',
  '.kmmmmmmmmmmmmmmmmmmmmmmmmmmmmdk',
  '.kddddddddddddddddddddddddddddkk',
  '.kkkkkkkkkkkkkkkkkkkkkkkkkkkkkks',
  '..xxxxxxxxxxxxxxxxxxxxxxxxxxxxss',
  '...sssssssssssssssssssssssssss..',
  '.....ssssssssssssssssssssssss...',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
  '................................',
];
def('wreck-ribs', { k: 'ww0', d: 'ww1', m: 'ww2', l: 'ww3', b: 'ww4', g: 'mgl1', s: 'shadow', x: 'base' }, RIBS, { w: 32, h: 32, kind: 'object' });
// A single rib and stern post standing alone in the shallows (scatter along the Bar).
def('wreck-post', { k: 'ww0', d: 'ww1', m: 'ww2', l: 'ww3', g: 'mgl1', f: 'foam' }, [
  '................',
  '................',
  '.......kk.......',
  '......klmk......',
  '......kmdk......',
  '......klmk......',
  '......kmdk......',
  '......kmdk......',
  '......klmk......',
  '......kmdk......',
  '......kgdk......',
  '......kgmk......',
  '.....fkkkkf.....',
  '....f......f....',
  '.....f.ff.f.....',
  '................',
], { kind: 'detail' });

export const WOOD_TILES = Object.freeze(tiles);
export default WOOD_TILES;
