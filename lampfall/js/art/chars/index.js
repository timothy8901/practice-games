// js/art/chars/index.js  [ART-CHARS]
// Character sprites: the player (lease card), every resident, isle folk, Spire
// leader and Summit figure as palette-indexed string art on 16-wide cells,
// decoded by js/core/pixelart.js. Pure at import (no DOM).
//
//   BODIES[bodyId]   -> { w, h, ox, oy, down[4], up[4], left[4], right[4], run?, sit, fish, fishFrames[4], fishW, fishOx, poses? }
//   PALETTES[palId]  -> { letter: '#rrggbb' }
//   CHARACTERS[id]   -> { name, species, body, palette, portrait, gait, role }
//   CHAR_SPRITES[id] -> { id, name, species, gait, body (frameset), palette (hex map), portrait, w, h, ox, oy }
//   frame(body, facing, step, gait)      rows (facing down|up|left|right|sit|fish|hang|perch; gait walk|run)
//   walkStep(t, ms)                      0..3 (idle, step A, idle, step B); 12 fps characters -> ms = 83
//   charSprite(id, facing, step, opts)   decoded Sprite (cached by pixelart); opts.gait, opts.t (Juniper's sheen)
//   playerSprite(card, facing, step, opts)  decoded Sprite for a lease card (see player.js)
//   drawOffset(bodyOrId)                 {x, y} to add to a tile's top-left so the feet land on that tile
//   animatedPalette(palId, t)            Juniper's sheen cycled
//   lettersUsed(body)                    every letter a body uses (palette checks / validator)
//   CHAR_ART_PREFIX, charArtId(id)        art/atlas ids ('char-wren'); every character is registered at import:
//                                        getSprite('char-wren', {frame, name: 'left' | 'up' | 'right' | 'sit' |
//                                        'fish' | 'run-left' ..., grade}); the default frames are the down walk
//   registerPlayerArt(card)              re-registers 'char-player' for a new lease card (atlas caches cleared)
//
// Size-as-character: cells are 16 wide; height is 24 for almost everyone,
// 28 for Odile and 32 for Ansel (oy = 24 - h). Wick, the Thatch and Dimity are
// small inside the standard cell; Tully, Bryony and Augusta are wide (wide
// torso masks) and low (squat). Draw at tile (x, y - 8) + (ox, oy).
// Fish frames are fishW (24) wide: draw at x + fishOx so the figure keeps its
// tile and the rod reaches over the water. Right-facing frames are pre-flipped.
import { HEADS, TORSOS, TAILS, EXTRAS, LEGS, BIRDLEGS, MASK_WIDE, buildMammal, torsoVariant } from './mammals.js';
import './heads.js';
import './backs.js';
import { buildOtherBodies } from './others.js';
import { PALETTES, CHAR_GLOW_KEYS, CHAR_RAMPS, SW } from './palettes.js';
import { CHARACTERS } from './cast.js';
import { playerLook, DEFAULT_CARD } from './player.js';
import { decodeSprite } from '../../core/pixelart.js';
import { registerArt, registerAliases } from '../atlas.js';

export { PALETTES, CHARACTERS, CHAR_GLOW_KEYS, CHAR_RAMPS, SW, HEADS, TORSOS, TAILS, EXTRAS };
export {
  PLAYER_SPECIES, SPECIES_INFO, FUR_PALETTES, MARKINGS, EYE_SHAPES, OUTFITS, DEFAULT_CARD,
  normalizeCard, cardKey, playerLook, markHead,
} from './player.js';

const ex = (...names) => names.map((n) => EXTRAS[n]);
const mammal = (head, torso, tail, extras = [], more = {}) => buildMammal({ head: HEADS[head], torso, tail: TAILS[tail], extras: ex(...extras), legs: LEGS, ...more });
const bird = (head, torsoName, tail, extras = [], more = {}) => buildMammal({
  head: HEADS[head], torso: torsoVariant(torsoName, { hand: 'T', ...(more.masks ? { masks: more.masks } : {}) }), tail: TAILS[tail], extras: ex(...extras), legs: BIRDLEGS, ...more,
});
const wide = (name) => torsoVariant(name, { masks: MASK_WIDE });

export const BODIES = {
  player: playerLook(DEFAULT_CARD).body,
  wren: mammal('beaver', TORSOS.overalls, 'beaver'),
  ambrose: mammal('beaverElder', TORSOS.overalls, 'beaver', ['cane']),
  tamsin: mammal('badger', TORSOS.jersey, 'badger', ['cap']),
  linnet: mammal('stoat', TORSOS.jacket, 'stoat', ['ponytail']),
  augusta: mammal('seal', wide('coat'), 'none', ['wardenCap']),
  tully: mammal('wombat', wide('jersey'), 'none', [], { squat: 2 }),
  bryony: mammal('hyrax', wide('apron'), 'none', ['sunHat'], { squat: 1 }),
  thessaly: mammal('bilby', TORSOS.jacket, 'bilby'),
  pip: mammal('waterRat', TORSOS.jersey, 'waterRat', ['flatCap']),
  osric: mammal('tortoise', TORSOS.apron, 'shell', [], { squat: 1 }),
  ines: mammal('newt', TORSOS.coat, 'newt', ['turban']),
  seraphine: mammal('arcticFox', TORSOS.coat, 'arcticFox', ['headlamp']),
  hollis: mammal('goat', TORSOS.coat, 'goat', ['ledger']),
  teo: mammal('raccoon', TORSOS.vest, 'raccoon', ['goggles']),
  dov: mammal('kinkajou', TORSOS.vest, 'kinkajou', ['bowtie']),
  bastien: mammal('mink', TORSOS.coat, 'mink'),
  cass: mammal('lynx', TORSOS.coat, 'lynx'),
  corin: bird('tawnyOwl', 'coat', 'birdShort', ['readingGlass']),
  idris: bird('diver', 'coat', 'birdShort'),
  agathe: bird('cormorant', 'coat', 'birdLong', ['armband']),
  maud: bird('goose', 'coat', 'goose', ['souwester']),
  wendel: bird('grebe', 'overalls', 'birdShort'),
  ada: bird('jackdaw', 'vest', 'birdShort', ['scarfL']),
  ivo: bird('jackdaw', 'vest', 'birdShort', ['scarfR']),
  isolde: bird('petrel', 'shawl', 'petrel', ['lantern'], { squat: 1 }),
  trainerVest: mammal('trainer', TORSOS.vest, 'none'),
  trainerCoat: mammal('trainer', TORSOS.coat, 'none'),
  ...buildOtherBodies(),
};

/** Frame rows. facing: down|up|left|right|sit|fish|hang|perch. step 0..3 (fish: 0 hold, 1 wind-up, 2 cast, 3 bite). */
export function frame(body, facing = 'down', step = 0, gait = 'walk') {
  const b = typeof body === 'string' ? BODIES[body] : body;
  if (!b) throw new Error(`chars: unknown body ${body}`);
  const i = ((step % 4) + 4) % 4;
  if (facing === 'sit') return b.sit;
  if (facing === 'fish') return b.fishFrames ? b.fishFrames[i] : b.fish;
  if (facing === 'hang' || facing === 'perch') return (b.poses && b.poses[facing]) || b.sit || b.down[0];
  const set = (gait === 'run' && b.run && b.run[facing]) || b[facing];
  if (!set) throw new Error(`chars: body has no facing ${facing}`);
  return set[i];
}

/** Walk-cycle step for a time in ms (idle, A, idle, B at `ms` per frame). */
export function walkStep(t, ms = 125) {
  return ((Math.floor(t / ms) % 4) + 4) % 4;
}

/** Offset from a tile's top-left pixel to the frame's top-left so the feet stand on the tile. */
export function drawOffset(body) {
  const b = typeof body === 'string' ? (BODIES[body] || (CHARACTERS[body] && BODIES[CHARACTERS[body].body])) : body;
  if (!b) throw new Error(`chars: unknown body ${body}`);
  return { x: b.ox || 0, y: -8 + (b.oy || 0) };
}

/**
 * Palette with any cycling letters advanced to time t (ms). Juniper's
 * iridescent sheen (I/i) rolls teal -> green -> violet -> teal; other palettes
 * come back unchanged. Shared object per step so decodeSprite's cache stays warm.
 */
const SHEEN = [['#2a6f8f', '#3fae8c'], ['#3fae8c', '#2a6f8f'], ['#3a5a9a', '#3fae8c'], ['#5a4a8f', '#2a6f8f']];
const sheenCache = new Map();
export function animatedPalette(palId, t = 0, ms = 220) {
  const base = PALETTES[palId];
  if (!base || !('I' in base)) return base;
  const n = SHEEN.length, k = ((Math.floor(t / ms) % n) + n) % n;
  const key = palId + k;
  if (!sheenCache.has(key)) sheenCache.set(key, { ...base, I: SHEEN[k][0], i: SHEEN[k][1] });
  return sheenCache.get(key);
}

/** Per-character sprite records (body frameset + palette + metadata). */
export const CHAR_SPRITES = Object.freeze(Object.fromEntries(Object.entries(CHARACTERS).map(([id, ch]) => {
  const body = BODIES[ch.body];
  if (!body) throw new Error(`chars: ${id} wears unknown body ${ch.body}`);
  const palette = id === 'player' ? playerLook(DEFAULT_CARD).palette : PALETTES[ch.palette];
  if (!palette) throw new Error(`chars: ${id} has unknown palette ${ch.palette}`);
  return [id, Object.freeze({ id, name: ch.name, species: ch.species, gait: ch.gait, role: ch.role, body, palette, portrait: ch.portrait, w: body.w, h: body.h, ox: body.ox || 0, oy: body.oy || 0 })];
})));

/** Decoded sprite for a character id. opts.gait = 'run' | 'walk'; opts.t (ms) animates sheen; other opts go to decodeSprite. */
export function charSprite(charId, facing = 'down', step = 0, opts = {}) {
  const ch = CHAR_SPRITES[charId];
  if (!ch) throw new Error(`chars: unknown character ${charId}`);
  const { gait, t, ...dec } = opts || {};
  const pal = t == null ? ch.palette : (animatedPalette(CHARACTERS[charId].palette, t) || ch.palette);
  return decodeSprite(frame(ch.body, facing, step, gait), pal, dec);
}
/** Back-compat alias of the prototype's name. */
export const sprite = charSprite;

/** Decoded sprite for a lease card (the player). */
export function playerSprite(card, facing = 'down', step = 0, opts = {}) {
  const { body, palette } = playerLook(card);
  const { gait, t, ...dec } = opts || {};
  void t;
  return decodeSprite(frame(body, facing, step, gait), palette, dec);
}

/** Every letter used by a body across all frames (for palette checks). */
export function lettersUsed(body) {
  const b = typeof body === 'string' ? BODIES[body] : body;
  const s = new Set();
  const all = [...b.down, ...b.up, ...b.left, ...b.right, b.sit, b.fish, ...(b.fishFrames || []),
    ...(b.run ? Object.values(b.run).flat() : []), ...(b.poses ? Object.values(b.poses) : [])];
  for (const f of all) for (const r of f) for (const ch of r) if (ch !== '.') s.add(ch);
  return [...s].sort();
}

// ---------------------------------------------------------------------------
// art/atlas registration (ARCHITECTURE §12: per-grade recolour caches live in
// the atlas; the entity renderer draws getSprite(charArtId(id), {...})).
// ---------------------------------------------------------------------------
export const CHAR_ART_PREFIX = 'char-';
export const charArtId = (id) => CHAR_ART_PREFIX + id;

/** Atlas definition for a frameset + palette: down walk as the default frames, the rest as named variants. */
export function artDefOf(body, palette) {
  const variants = { up: body.up, left: body.left, right: body.right, sit: [body.sit], fish: body.fishFrames };
  if (body.run) for (const [f, set] of Object.entries(body.run)) variants[`run-${f}`] = set;
  if (body.poses) for (const [k, fr] of Object.entries(body.poses)) variants[k] = [fr];
  return { kind: 'char', w: body.w, h: body.h, fps: 12, frames: body.down, pal: palette, variants, anchor: { x: 8 - (body.ox || 0), y: body.h - 1 } };
}
/** Every character as an atlas table keyed by charArtId. */
export function charArtTable() {
  return {
    ...Object.fromEntries(Object.values(CHAR_SPRITES).map((c) => [charArtId(c.id), artDefOf(c.body, c.palette)])),
    'char-trainerVest': artDefOf(BODIES.trainerVest, PALETTES.routeTrainer),
    'char-trainerCoat': artDefOf(BODIES.trainerCoat, PALETTES.routeTrainer),
  };
}
registerArt(charArtTable(), { source: 'chars', kind: 'char', replace: true });
// Narrative names and harbor residents share the established animal rigs.
registerAliases({
  'char-merrow': 'char-agathe', 'char-varga': 'char-teo', 'char-the-thatch': 'char-thatch',
  'char-mabry': 'char-hesper', 'char-hobb-fallow': 'char-thessaly', 'char-wynn-cobble': 'char-pip',
  'char-quill-hartsease': 'char-osric', 'char-mags-penny': 'char-maud', 'char-gorse-abernethy': 'char-bryony',
  'char-teal-fenner': 'char-pip', 'char-rook-hayward': 'char-ada', 'char-brannoch-vey': 'char-wendel',
});

/** Point 'char-player' at a lease card's look (call after the lease card is confirmed or edited). */
export function registerPlayerArt(card) {
  const { body, palette } = playerLook(card);
  return registerArt({ [charArtId('player')]: artDefOf(body, palette) }, { source: 'chars', kind: 'char', replace: true });
}
