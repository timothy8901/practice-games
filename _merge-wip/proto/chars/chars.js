// proto/chars/chars.js
// Character sprite index: anthro townsfolk + player species as 16x24
// palette-indexed string art, plus 48x48 portrait busts.
//
//   BODIES[bodyId]   -> { w, h, down[4], up[4], left[4], right[4], sit, fish, fishW, fishOx, poses? }
//   PALETTES[palId]  -> { letter: '#rrggbb' }
//   CHARACTERS[id]   -> { name, species, body, palette }
//   PORTRAITS[id]    -> { w: 48, h: 48, rows, palette }
//   frame(bodyId|body, facing, step) -> rows      (facing: down|up|left|right|sit|fish|hang)
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
import { PALETTES, CHARACTERS } from './palettes.js';
import { PORTRAITS } from './portraits.js';
import { decodeSprite } from '../../js/core/pixelart.js';

export { PALETTES, CHARACTERS, PORTRAITS, HEADS, TORSOS, TAILS, LEGS, EXTRAS };

const playerSpecies = ['redpanda', 'otter', 'vole', 'opossum', 'ferret', 'mongoose'];

export const BODIES = {
  ...Object.fromEntries(playerSpecies.map((s) => [s, buildMammal({ head: HEADS[s], torso: TORSOS.jumper, tail: TAILS[s] })])),
  wren: buildMammal({ head: HEADS.beaver, torso: TORSOS.overalls, tail: TAILS.beaver }),
  ambrose: buildMammal({ head: HEADS.beaver, torso: TORSOS.overalls, tail: TAILS.beaver, extras: [EXTRAS.cane] }),
  tamsin: buildMammal({ head: HEADS.badger, torso: TORSOS.jersey, tail: TAILS.badger, extras: [EXTRAS.cap] }),
  linnet: buildMammal({ head: HEADS.stoat, torso: TORSOS.jacket, tail: TAILS.stoat, extras: [EXTRAS.ponytail] }),
  linnetCut: buildMammal({ head: HEADS.stoat, torso: TORSOS.jacket, tail: TAILS.stoat }),
  ...buildTrainerBodies(),
  ...buildOtherBodies(),
};

// Characters whose body carries an extra prop pick the variant here.
CHARACTERS.agathe.body = 'trainerCoatBand';
CHARACTERS.teo.body = 'trainerVestGoggles';

/** Frame rows for a body. facing: down|up|left|right|sit|fish|hang. step 0..3. */
export function frame(body, facing = 'down', step = 0) {
  const b = typeof body === 'string' ? BODIES[body] : body;
  if (!b) throw new Error(`chars: unknown body ${body}`);
  if (facing === 'sit' || facing === 'fish') return b[facing];
  if (facing === 'hang') return (b.poses && b.poses.hang) || b.down[0];
  const set = b[facing];
  if (!set) throw new Error(`chars: body has no facing ${facing}`);
  return set[((step % 4) + 4) % 4];
}

/** Walk-cycle step for a time in ms (idle, A, idle, B at `ms` per frame). */
export function walkStep(t, ms = 125) {
  return Math.floor(t / ms) % 4;
}

/** Decoded sprite for a character id (cached by pixelart). */
export function sprite(charId, facing = 'down', step = 0, opts) {
  const ch = CHARACTERS[charId];
  if (!ch) throw new Error(`chars: unknown character ${charId}`);
  return decodeSprite(frame(ch.body, facing, step), PALETTES[ch.palette], opts);
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
  const all = [...b.down, ...b.up, ...b.left, ...b.right, b.sit, b.fish, ...(b.poses ? Object.values(b.poses) : [])];
  for (const f of all) for (const r of f) for (const ch of r) if (ch !== '.') s.add(ch);
  return [...s].sort();
}
