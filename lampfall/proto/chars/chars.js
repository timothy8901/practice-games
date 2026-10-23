// proto/chars/chars.js
// Character sprite index: anthro townsfolk + player species as 16x24
// palette-indexed string art, plus 48x48 portrait busts.
//
//   BODIES[bodyId]   -> { w, h, down[4], up[4], left[4], right[4], sit, fish, fishW, fishOx, poses? }
//   PALETTES[palId]  -> { letter: '#rrggbb' }
//   CHARACTERS[id]   -> { name, species, body, palette }
//   PORTRAITS[id]    -> { w: 48, h: 48, rows, palette }
//   frame(bodyId|body, facing, step, gait) -> rows (facing: down|up|left|right|sit|fish|hang; gait walk|run)
//   animatedPalette(palId, t)        -> palette with Juniper's sheen cycled
//   walkStep(t, ms)                  -> 0..3      (idle, step A, idle, step B)
//   sprite(charId, facing, step, opts) -> decoded Sprite (via js/core/pixelart.js)
//
// Frames are plain `rows` + `palette`; decode them with decodeSprite() from
// js/core/pixelart.js. Right-facing frames are pre-flipped. The fish frame is
// 24 wide: draw it at x + body.fishOx so the figure stays on its tile and the
// rod reaches out over the water.
import { HEADS, TORSOS, TAILS, LEGS, EXTRAS, buildMammal } from './mammals.js';
import { buildTrainerBodies } from './trainers.js';
import { buildOtherBodies } from './others.js';
import './backs.js'; // hand-finished back-of-head views (must run before BODIES)
import { PALETTES, CHARACTERS } from './palettes.js';
import { PORTRAITS } from './portraits.js';
import { decodeSprite } from '../../js/core/pixelart.js';

export { PALETTES, CHARACTERS, PORTRAITS, HEADS, TORSOS, TAILS, LEGS, EXTRAS };

const playerSpecies = ['redpanda', 'otter', 'vole', 'opossum', 'ferret', 'mongoose'];

export const BODIES = {
  ...Object.fromEntries(playerSpecies.map((s) => [s, buildMammal({ head: HEADS[s], torso: TORSOS.jumper, tail: TAILS[s] })])),
  wren: buildMammal({ head: HEADS.beaver, torso: TORSOS.overalls, tail: TAILS.beaver }),
  ambrose: buildMammal({ head: HEADS.beaverElder, torso: TORSOS.overalls, tail: TAILS.beaver, extras: [EXTRAS.cane] }),
  tamsin: buildMammal({ head: HEADS.badger, torso: TORSOS.jersey, tail: TAILS.badger, extras: [EXTRAS.cap] }),
  linnet: buildMammal({ head: HEADS.stoat, torso: TORSOS.jacket, tail: TAILS.stoat, extras: [EXTRAS.ponytail] }),
  linnetCut: buildMammal({ head: HEADS.stoat, torso: TORSOS.jacket, tail: TAILS.stoat }),
  ...buildTrainerBodies(),
  ...buildOtherBodies(),
};

// Characters whose body carries an extra prop pick the variant here.
CHARACTERS.idris.body = 'idris';
CHARACTERS.agathe.body = 'agathe';
CHARACTERS.teo.body = 'teo';

/**
 * Frame rows for a body. facing: down|up|left|right|sit|fish|hang. step 0..3.
 * gait 'run' picks the run cycle where the body has one (player species and
 * every rig body), else falls back to the walk. For 'fish', step is the cast
 * phase: 0 hold, 1 wind-up, 2 cast, 3 bite.
 */
export function frame(body, facing = 'down', step = 0, gait = 'walk') {
  const b = typeof body === 'string' ? BODIES[body] : body;
  if (!b) throw new Error(`chars: unknown body ${body}`);
  const i = ((step % 4) + 4) % 4;
  if (facing === 'sit') return b.sit;
  if (facing === 'fish') return b.fishFrames ? b.fishFrames[i] : b.fish;
  if (facing === 'hang') return (b.poses && b.poses.hang) || b.down[0];
  const set = (gait === 'run' && b.run && b.run[facing]) || b[facing];
  if (!set) throw new Error(`chars: body has no facing ${facing}`);
  return set[i];
}

/** Walk-cycle step for a time in ms (idle, A, idle, B at `ms` per frame). */
export function walkStep(t, ms = 125) {
  return ((Math.floor(t / ms) % 4) + 4) % 4;
}

/** Decoded sprite for a character id (cached by pixelart). opts.gait = 'run' | 'walk'; opts.t (ms) animates sheen. */
export function sprite(charId, facing = 'down', step = 0, opts = {}) {
  const ch = CHARACTERS[charId];
  if (!ch) throw new Error(`chars: unknown character ${charId}`);
  const { gait, t, ...dec } = opts || {};
  const pal = t == null ? PALETTES[ch.palette] : animatedPalette(ch.palette, t);
  return decodeSprite(frame(ch.body, facing, step, gait), pal, dec);
}

/**
 * Palette with any cycling letters advanced to time t (ms). Juniper's
 * iridescent sheen (I/i) rolls through teal -> green -> violet -> teal like
 * light moving across magpie feathers; other palettes come back unchanged.
 * Returns a shared object per step, so decodeSprite's cache stays warm.
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

/** Decoded portrait bust for a character id, or null if none is drawn. */
export function portrait(charId, opts) {
  const p = PORTRAITS[charId];
  return p ? decodeSprite(p.rows, p.palette, opts) : null;
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
