// proto/chars/chars.js  (round 0 skeleton)
import { HEADS, TORSOS, TAILS, buildMammal } from './mammals.js';
import { PALETTES } from './palettes.js';
export { PALETTES };
export const BODIES = { redpanda: buildMammal({ head: HEADS.redpanda, torso: TORSOS.jumper, tail: TAILS.redpanda }) };
export const CHARACTERS = { player: { name: 'Newcomer', body: 'redpanda', palette: 'redpanda' } };
export const PORTRAITS = {};
export function frame(body, facing = 'down', step = 0) {
  const b = typeof body === 'string' ? BODIES[body] : body;
  if (facing === 'sit' || facing === 'fish') return b[facing];
  return b[facing][step & 3];
}
