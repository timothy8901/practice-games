/**
 * Water tiles: open sea, shallows, the muddy shallows, the river, their autotile edges (surf foam, river
 * ripple, deep-water shelf, shoreward swell), tide pools, stepping stones and causeways (exposed /
 * awash), plus the biome waters GDD-00 §4 adds: the mainland causeway, the Starfall Lagoon, tannin water
 * (Drownwood), the warm spring pools (Emberstep spa), the weir, lily pads, high-tide shoals, sea ice and
 * the mirror-ice of the Rimeholt caves. [ART-TILES]
 *
 * Split from `proto/tiles/tiles.js`; the shimmer frames, the calmer shallows and the 3-frame surf are
 * kept. New: a swell band that rolls toward the shore (backlog: "no directional swell").
 * @module art/tiles/water
 */

import { createGroup, rowsOf, erode, rot, texture } from './kit.js';
import { blank, blit, edgeSet } from '../spriteUtil.js';

const { tiles, def, get } = createGroup('water');

/* ------------------------------------------------------------- open water */
// A calm base with sparse highlight strokes (and a few darker troughs) that breathe over four frames:
// each stroke erodes a pixel from one end and grows back, so a field shimmers quietly.
const WATER_BASE = [
  'wwwwwwwwwwwwwwww',
  'wwhhhhwwwwwwwwww',
  'wwwwwwwwwwwwwhhw',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwkkwwwwwww',
  'wwwwwwwhhhwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'hhwwwwwwwwwwwwww',
  'wwwwwwwwwwhhhhww',
  'wwwwkkwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwhhhwwwwwwwww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwhhh',
  'wwwwwwwwwwwwwwww',
];
const shimmer = (base) => [0, 1, 2, 1].map((e) => base.map((row, y) => erode(row, e, (y & 1) === 0)));
const WAVES = shimmer(WATER_BASE);
def('water-deep', { w: 'deep1', h: 'deep2', k: 'deep0' }, WAVES, { fps: 6 });
// Shallows are calmer than the open sea: half the strokes, so the deep/shallow shelf reads.
const SHALLOW_BASE = WATER_BASE.map((r, y) => ([2, 5, 9, 14].includes(y) ? 'w'.repeat(16) : r));
def('water-shallow', { w: 'sh2', h: 'sh3', k: 'sh1' }, shimmer(SHALLOW_BASE), { fps: 6 });
def('water-mud', { w: 'shm1', h: 'shm2', k: 'shm0' }, WAVES, { fps: 6 });
// The Starfall Lagoon: deep, still and clearer than the sea, with a sparse slow glint of reflected sky.
const LAGOON_BASE = WATER_BASE.map((r, y) => (y % 4 === 1 ? r : r.replace(/h/g, 'w')));
const lagoonFrames = shimmer(LAGOON_BASE).map((f, i) => blit(f, i === 1 ? ['g'] : i === 2 ? ['.g.', 'g.g'] : ['.'], 11, 6));
def('water-lagoon', { w: 'deep2', h: 'deep3', k: 'deep1', g: 'foam' }, lagoonFrames, { fps: 4 });
// Tannin water (Drownwood): tea-dark and still, a slow surface film instead of waves.
def('water-tannin', { w: 'tan1', h: 'tan2', k: 'tan0' }, shimmer(SHALLOW_BASE), { fps: 4 });
// Warm spring pool (Emberstep spa): milky turquoise with rising steam wisps over four frames.
const STEAM = [['.c', 'c.', '.c'], ['c.', '.c', 'c.'], ['.c', '.c', 'c.'], ['c.', 'c.', '.c']];
const springBase = shimmer(SHALLOW_BASE.map((r) => r.replace(/k/g, 'w')));
def('water-spring', { w: 'spr1', h: 'spr2', k: 'spr0', c: 'spr3' },
  springBase.map((f, i) => blit(blit(f, STEAM[i], 4, 7 - (i % 2)), STEAM[(i + 2) % 4], 11, 2 + (i % 2))), { fps: 3 });
// River: light flow streaks that slide downstream (rows rotate 4 per frame -> seamless loop).
const RIVER_BASE = [
  'rrrrrrrrrrrrrrrr',
  'rrsrrrrrrrrrrrrr',
  'rrsrrrrrrrrrrrrr',
  'rrsrrrrrrrrrdrrr',
  'rrsrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrsrr',
  'rrrrrrrrrrrrrsrr',
  'rrrrrrrrrrrrrsrr',
  'rrrrrrrsrrrrrrrr',
  'rrrrrrrsrrrrrrrr',
  'rrdrrrrsrrrrrrrr',
  'rrrrrrrsrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrsrrrrrrrdrrr',
  'rrrrsrrrrrrrrrrr',
];
def('river', { r: 'riv1', s: 'riv3', d: 'riv2' }, [0, 1, 2, 3].map((k) => rot(RIVER_BASE, k * 4)), { fps: 6 });
// Weir: the river drops a step over a stone sill; white water tumbles in four frames.
const WEIR = [
  'rrrrrrrrrrrrrrrr',
  'rrsrrrrrrrsrrrrr',
  'rrrrrrrrrrrrrrrr',
  'kkkkkkkkkkkkkkkk',
  'mmmmmmmmmmmmmmmm',
  'ffsffsffffsfffsf',
  'fsffffsffsfffsff',
  'sffsffffsffsffff',
  'ffffsfsffffffsff',
  'fsfffffsfffsffff',
  'ffsfsfffffsffsff',
  'sffffsffsffffffs',
  'rfsrrrfsrrrfsrrr',
  'rrrfrrrrrfrrrrfr',
  'rrrrrrrrrrrrrrrr',
  'rrsrrrrrrrrrrsrr',
];
def('weir', { r: 'riv1', s: 'riv3', f: 'foam', k: 'st0', m: 'st2' },
  [0, 1, 2, 3].map((k) => [...WEIR.slice(0, 5), ...rot(WEIR.slice(5, 12), k * 2), ...rot(WEIR.slice(12), k)]), { fps: 8 });

/* ---------------------------------------------------------------- edges */
// Surf where water meets land: a broken 3px band (foam, a paler shallow tone, stray pixels) in three
// frames. Authored for the N edge and rotated for the others.
const FP = { f: 'foam', s: 'sh3' };
const foamFrame = (a, b, c) => [a, b, c, ...blank(16, 13)];
const FOAM = [
  foamFrame('fff.ffffff.fff.f', '.s.f..s..f..s.f.', '...s........s...'),
  foamFrame('ffffff.fffff.fff', 'f..s.f..s..f..s.', '.....s.......s..'),
  foamFrame('ff.ffff.ffffff.f', '.f..s.f..s..f.s.', 's........s......'),
].map(edgeSet);
for (const side of ['n', 'e', 's', 'w']) def(`foam-${side}`, FP, FOAM.map((f) => f[side]), { kind: 'edge', fps: 6 });
// River bank: a single broken ripple instead of surf.
const RIPPLE = [
  ['s.ss...s.ss..s..', ...blank(16, 15)],
  ['.ss..s..ss..s.s.', ...blank(16, 15)],
  ['ss...s.s..ss..ss', ...blank(16, 15)],
].map(edgeSet);
for (const side of ['n', 'e', 's', 'w']) def(`ripple-${side}`, { s: 'riv3' }, RIPPLE.map((f) => f[side]), { kind: 'edge', fps: 6 });
// Shelf: dithered transition from shallows into deep water (drawn on the deep tile). The second row
// of dither is irregular so a long shelf never stair-steps on the tile grid.
const SHELF = edgeSet([
  's.s.s.s.s.s.s.s.',
  '.s.s.s.s.s.s.s.s',
  's...s..s.s...s..',
  '..s.....s...s...',
  '.....s........s.',
  ...blank(16, 11),
]);
for (const side of ['n', 'e', 's', 'w']) def(`shelf-${side}`, { s: 'sh1' }, SHELF[side], { kind: 'edge' });
// Swell: a soft crest line that rolls toward the shore over four frames (drawn on shallows whose
// shoreward side is land). N edge = the shore is north, so the crest travels up.
const swellFrame = (y) => blit(blank(16, 16), ['..ssss....sss...', '.s....s..s...s..'], 0, y);
const SWELL = [11, 8, 5, 2].map((y) => edgeSet(swellFrame(y)));
for (const side of ['n', 'e', 's', 'w']) def(`swell-${side}`, { s: 'sh3' }, SWELL.map((f) => f[side]), { kind: 'edge', fps: 3 });

/* ------------------------------------------------------- pools & crossings */
// Tide pool: rock lip around still water with glints.
def('tidepool', { r: 'st2', d: 'st1', l: 'st3', w: 'sh1', g: 'dapple', k: 'st0', s: 'wet1' }, [
  'ssssdrrrrrrdssss',
  'ssdrrlllrrrrrdss',
  'sdrlwwwwwwwwrrds',
  'sdrwwwwwwwgwwrds',
  'drlwwwwwwwwwwrkd',
  'drwwgwwwwwwwwwkd',
  'drwwwwwwwwwwwwkd',
  'drwwwwwwwwwwwgkd',
  'drwwwwwwwwwwwwkd',
  'drlwwgwwwwwwwrkd',
  'sdrwwwwwwwwwrrks',
  'sdrrwwwwwgwwrkds',
  'ssdrrlwwwwrrkdss',
  'sssdrrrrrrrkdsss',
  'ssssdkkkkkkdssss',
  'ssssssssssssssss',
]);
// Stepping stone exposed (on river) / submerged.
const STP = { r: 'riv1', s: 'riv3', k: 'st0', d: 'st1', m: 'st2', l: 'st3', h: 'st4', f: 'foam' };
const STEPSTONE = [
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrdmmmmdrrrrr',
  'rrrsdmlhhlmmdrrr',
  'rrsdmlhmmmmmmdrr',
  'rrdmlmmmmmmmmkrr',
  'rrdmmmmmmmmmmkrr',
  'rrdmmmmmmmmmdkrr',
  'rrkdmmmmmmmdkkrr',
  'rrrkkdmmmddkkrrr',
  'rrrfkkkkkkkkfrrr',
  'rrrrffrrrrffrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
];
def('stepstone', STP, STEPSTONE);
def('stepstone-sub', { r: 'riv1', s: 'riv3', m: 'sh1', d: 'riv0', f: 'foam' }, [
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrddddddrrrrr',
  'rrrrdmmmmmmdrrrr',
  'rrrdmmmmmmmmdrrr',
  'rrsdmmmmmmmmdrrr',
  'rrrdmmmmmmmmdsrr',
  'rrrdmmmmmmmmdrrr',
  'rrrrdmmmmmmdrrrr',
  'rrrrrddddddrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
  'rrrrrrrrrrrrrrrr',
]);
// Sea stepping stones (the isle short ways run over open shallows, not the river).
def('stepstone-sea', { ...STP, r: 'sh2', s: 'sh3' }, STEPSTONE);
def('stepstone-sea-sub', { r: 'sh2', s: 'sh3', m: 'sh1', d: 'sh0', f: 'foam' }, rowsOf(get('stepstone-sub')));
// Causeway: cut stone blocks across the sea; exposed / awash.
const CWP = { k: 'st0', d: 'st1', m: 'st2', l: 'st3', h: 'st4', w: 'sh2', f: 'foam' };
const CAUSEWAY = [
  'wwfwwwwwwwwwfwww',
  'kkkkkkkkkkkkkkkk',
  'lmmmmmmdlmmmmmmd',
  'lmmmmmmdlmmmmmmd',
  'mmmmmmmdmmmmmmmd',
  'dddddddddddddddd',
  'mmmdlmmmmmmdlmmm',
  'mmmdlmmmmmmdlmmm',
  'mmmdmmmmhmmdmmmm',
  'dddddddddddddddd',
  'lmmmmmmdlmmmmmmd',
  'lmmmmmmdlmmmmmmd',
  'mmmmhmmdmmmmmmmd',
  'dddddddddddddddd',
  'kkkkkkkkkkkkkkkk',
  'wwwwfwwwwwwwwwfw',
];
def('causeway', CWP, CAUSEWAY);
const CAUSEWAY_SUB = [
  'wwwwwwwwwwwwwwww',
  'wfffwwwwwfffwwww',
  'dmmmmmmdmmmmmmmd',
  'dmmmmmmdmmmmmmmd',
  'dmmmmmmdmmmmmmmd',
  'dddddddddddddddd',
  'mmmdmmmmmmmdmmmm',
  'mmmdmmmmmmmdmmmm',
  'mmmdmmmmmmmdmmmm',
  'dddddddddddddddd',
  'dmmmmmmdmmmmmmmd',
  'dmmmmmmdmmmmmmmd',
  'dmmmmmmdmmmmmmmd',
  'dddddddddddddddd',
  'wwwwfffwwwwwwfff',
  'wwwwwwwwwwwwwwww',
];
def('causeway-sub', { w: 'sh2', d: 'sh1', m: 'sh0', f: 'foam', s: 'sh3' }, CAUSEWAY_SUB);
// Causeway running north-south (the isle causeways turn).
const turn = (rows) => rows[0].split('').map((_, x) => rows.map((r) => r[x]).reverse().join(''));
def('causeway-v', CWP, turn(CAUSEWAY));
def('causeway-v-sub', { w: 'sh2', d: 'sh1', m: 'sh0', f: 'foam', s: 'sh3' }, turn(CAUSEWAY_SUB));
// Mainland causeway (arrival only, ±1 h of low): an old metalled road on a stone bank, tarred timber
// marker posts with a white band on the seaward edge so the way reads even awash.
const MCP = { k: 'st0', d: 'co0', m: 'co1', l: 'co2', w: 'sh2', f: 'foam', p: 'wd0', b: 'pl3', y: 'sand1' };
def('mainland-causeway', MCP, [
  'wwfwwwpwwwwfwwww',
  'kkkkkkbkkkkkkkkk',
  'yyyyyypyyyyyyyyy',
  'mmmmmmmmmmmmmmmm',
  'mmlmmmmmmmmdmmmm',
  'mmmmmmmmlmmmmmmm',
  'mdmmmmmmmmmmmlmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmlmmmmdmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mlmmmmmmmmmmmmmd',
  'mmmmmmmdmmmmmmmm',
  'yyyyyyyyyyyyyyyy',
  'dddddddddddddddd',
  'kkkkkkkkkkkkkkkk',
  'wwwwfwwwwwwwwfww',
]);
def('mainland-causeway-sub', { w: 'sh2', d: 'sh1', m: 'sh0', f: 'foam', p: 'wd0', b: 'pl3' }, [
  'wwwwwwpwwwwwwwww',
  'wffwwwbwwwfffwww',
  'dddddddddddddddd',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'mmmmmmmmmmmmmmmm',
  'dddddddddddddddd',
  'wwfffwwwwwwwffww',
  'wwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwww',
]);

/* ------------------------------------------------------- water details */
// Lily pads (river reaches, Drownwood): notched pads with a lit rim, one with a bud.
def('lily-pads', { g: 'grass1', l: 'grass3', k: 'grass0', b: 'blossom', w: 'petal' }, [
  '................',
  '...kkk..........',
  '..kglgk.........',
  '..kggg.k........',
  '...kkkk.....kk..',
  '...........kglk.',
  '...........kgbw.',
  '............kk..',
  '.....kkk........',
  '....kgllk.......',
  '....kgg.gk......',
  '....kggggk......',
  '.....kkkk.......',
  '................',
  '................',
  '................',
], { kind: 'detail' });
// High-tide shoal: a knot of small fish shadows turning under the surface (quay shoals, Brine tells).
const FISH = ['.dd.', 'dddd', '.d..'];
const shoalFrame = (dx) => blit(blit(blit(blank(16, 16), FISH, 3 + dx, 4), FISH, 8 - dx, 7), ['dd.', '.dd'], 5 + dx, 10);
def('shoal', { d: 'deep0' }, [shoalFrame(0), shoalFrame(1), shoalFrame(2), shoalFrame(1)], { kind: 'detail', fps: 4 });

/* --------------------------------------------------------------- ice */
// Sea ice (Rimeholt ice path): walkable, pale with frost streaks and a few pressure cracks.
def('ice', { i: 'ice2', l: 'ice3', d: 'ice1', k: 'ice0' }, texture('i', [
  [['....lll', '.lll...', 'll.....'], 1, 1], [['...ll', 'lll..'], 9, 7], [['.ll', 'l..'], 2, 12],
  [['dd....', '..dddd'], 8, 13], [['ddd', '...', '...'], 3, 6], [['l'], 14, 3], [['d'], 13, 10],
]));
// Cracked ice (thin, never a hazard: tells only): the same ice with a dark star-free branching crack.
def('ice-cracked', { i: 'ice2', l: 'ice3', d: 'ice1', k: 'ice0' }, blit(rowsOf(get('ice')), [
  '......k.....',
  '.....k......',
  '..kkk.......',
  '.k...kk.....',
  'k......kk...',
  '.........k..',
  '..........kk',
], 2, 4));
// Mirror-ice (the caves): polished, darker and glassy, reflecting a soft band; a sparkle walks across
// it over four frames (light radius in the caves is 3 tiles, so the floor itself must read).
const MIRROR = texture('i', [[['llllll'], 1, 3], [['llll'], 9, 4], [['dd'], 3, 9], [['ddd'], 11, 12], [['l'], 6, 13]]);
// a short diagonal glint, never a plus or a four-point star (the Heartmark's glyph)
const SPARKS = [['h'], ['sh'], ['s.', '.h'], ['.']];
def('mirror-ice', { i: 'ice1', l: 'ice2', d: 'ice0', s: 'foam', h: 'ice3' },
  SPARKS.map((g, f) => blit(MIRROR, g, 4 + f * 3, 6 + (f & 1) * 2)), { fps: 3 });

export const WATER_TILES = Object.freeze(tiles);
export default WATER_TILES;
