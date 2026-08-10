/**
 * theme.js — the severed floor.
 *
 * The 64 pieces, the generator and the solver stay exactly as they are. What
 * changes is everything you can see: an office palette laid over the authored
 * colours, hallway walls and ceiling lights grown from each piece's own recorded
 * centre-line, and two structural pieces swapped for props — the arrival desk
 * you start at and the elevator you are trying to reach.
 *
 * Nothing here touches physics. Walls are real collision geometry (they are the
 * same bumper-wall mechanism as before, just dressed), and every other surface
 * keeps the friction and restitution the piece declared.
 *
 * A note on the look: corridors are fully enclosed — floor, walls and a
 * suspended tile ceiling. That only works because the camera sits down inside
 * the corridor behind the marble; from the old raised angle a ceiling blacked
 * out the entire frame. The two decisions are one decision, and both are
 * toggles on the review page so they can be judged together.
 */

import { setPalette } from './mesher.js';

/* ── palette ──────────────────────────────────────────────────────────── */

/**
 * Office colours. Grey, green and light blue, as asked for — the green is the
 * carpet, the blue is doors and signage, the grey is everything structural.
 */
export const OFFICE = {
  carpet: '#93a58f',        // corridor carpet, pale grey-green
  carpetAlt: '#849a86',     // ramps and landings, a shade cooler
  carpetDark: '#6d7d6c',
  wall: '#e9ebe6',          // off-white wall
  wallShade: '#d6d9d2',
  wallDark: '#b9bdb6',
  skirting: '#3d444a',      // dark trim at the foot of every wall
  steel: '#b4babf',         // elevator doors, fittings
  steelDark: '#7f868c',
  accent: '#a7c8dc',        // light blue — doors, stripes, signage
  accentDeep: '#6d9cbb',
  glass: '#cfe3ee',
  light: '#fdfbf2',         // ceiling panels
  sign: '#b8483a',          // the one warm colour: exit and hazard signage
  ink: '#2b3138',
};

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

function hexToHsl (hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-6) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return { h: hue * 360, s, l };
}

function hslToHex (h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  s = clamp01(s); l = clamp01(l);
  const f = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const to = v => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0');
  return `#${to(f(p, q, h + 1 / 3))}${to(f(p, q, h))}${to(f(p, q, h - 1 / 3))}`;
}

/** Re-tint `hex` onto a target hue/saturation, keeping its own lightness. */
function retint (hex, hue, sat, lightBias = 0, lightScale = 1) {
  const c = hexToHsl(hex);
  return hslToHex(hue, sat, clamp01(0.5 + (c.l - 0.5) * lightScale + lightBias));
}

/**
 * Colours that carry meaning rather than material, mapped by hand so the
 * meaning survives. Everything else goes through the hue bands below.
 */
const EXPLICIT = {
  '#ffffff': OFFICE.light,
  '#f5f5f5': OFFICE.wall,
  '#e8e8e8': OFFICE.wall,
  '#2b3138': OFFICE.ink,
  '#bfe6ff': OFFICE.glass,       // the ice track becomes polished floor
  '#3ec6ff': OFFICE.accent,
  '#ffd93a': OFFICE.accent,      // every "glow" cue becomes signage blue
  '#fff2b0': OFFICE.light,
  '#ff3b3b': OFFICE.sign,
  '#ff5a4a': OFFICE.sign,
};

/**
 * The whole kit, re-tinted by hue band.
 *
 * Doing this by band rather than by a 95-entry lookup means a piece added later
 * is themed automatically, and it keeps the *relationships* between colours —
 * a piece that was two shades of oak is still two shades of carpet.
 */
/**
 * Colours that are already office colours pass through untouched.
 *
 * Without this the theme re-tints its own output: OFFICE.carpet is a very
 * desaturated green, so the grey band claimed it and every prop's carpet came
 * out white. Anything the theme itself authors is by definition already themed.
 */
const OWN = new Set(Object.values(OFFICE).map(v => v.toLowerCase()));

export function officeColour (hex) {
  if (typeof hex !== 'string' || hex[0] !== '#') return hex;
  const key = hex.toLowerCase();
  if (OWN.has(key)) return hex;
  if (EXPLICIT[key]) return EXPLICIT[key];
  const { h, s, l } = hexToHsl(key);

  // 0.19, not 0.12: the kit's steels and slate blues sit around s = 0.13–0.17,
  // and below this threshold they were being read as "blue" and re-tinted into
  // accent colour, which turned every rail and fitting baby blue.
  if (s < 0.19) return hslToHex(210, 0.05, clamp01(l * 0.95 + 0.06));   // greys → cool office grey
  if (h >= 15 && h < 42) return retint(key, 105, 0.10, -0.02, 0.8);     // oak/browns → carpet
  // 42–68 is gold, which the kit uses for every objective and marker, so it
  // becomes signage blue. The band stops at 68 because the ramps' green sits at
  // 72° — inside the old 50–75 window, which turned every ramp bright blue.
  if (h >= 42 && h < 68) return retint(key, 200, 0.32, 0.06, 0.8);      // gold → signage blue
  if (h >= 68 && h < 165) return retint(key, 116, 0.10, -0.04, 0.85);   // greens → cooler carpet
  if (h >= 165 && h < 255) return retint(key, 202, 0.28, 0.04, 0.9);    // blues → accent blue
  if (h >= 255 && h < 320) return retint(key, 205, 0.22, 0.05, 0.9);    // purples → accent blue
  return retint(key, 8, 0.42, -0.02, 0.9);                              // reds/pinks → signage red
}

let active = false;
export function applyOfficeTheme (on = true) {
  active = !!on;
  setPalette(on ? officeColour : null);
}
export const themeActive = () => active;

/* ── hallway dimensions ───────────────────────────────────────────────── */

export const HALL = {
  wallH: 2.35,         // full hallway height now that there is a ceiling on it
  wallT: 0.18,
  skirtH: 0.15,
  stripeY: 1.02,       // the horizontal accent line every office corridor has
  stripeH: 0.075,

  /* Suspended ceiling.
   *
   * 0.6 m is the real module for a commercial grid ceiling, and using the real
   * number matters more than it sounds: it is the only thing in the corridor
   * with a fixed, familiar size, so it is what the eye reads speed and distance
   * against. At a made-up spacing the corridor loses its sense of scale.
   *
   * The ceiling never collides. The marble cannot reach 2.35 m, and putting it
   * in the collision set would make the camera's boom think it was buried
   * inside geometry on every single frame. */
  ceilDrop: 0.02,      // how far the tile face hangs below the wall top
  tile: 0.6,           // grid module
  barT: 0.04,          // T-bar width
  barDrop: 0.014,      // how far the bars hang below the tile face
  lightEvery: 3.6,     // metres between recessed light panels
  lightL: 0.58,        // panel length along the corridor
  lightSpan: 0.55,     // fraction of the corridor width a panel covers

  /* How much wall to remove around a junction mouth.
   *
   * 2.6 m was generous enough that a four-way lost its corners as well as its
   * mouths, leaving the pad open to the void on every diagonal. Just over half a
   * corridor width opens the arms and keeps the corners. */
  junctionOpen: 1.9,
};

/* ── props ────────────────────────────────────────────────────────────── */

/**
 * The elevator: the thing you are trying to reach.
 *
 * Built as a recessed alcove in a back wall — two steel doors with a seam, a
 * light-blue surround, a call plate and a lit floor indicator — with a plain
 * carpet approach so the corridor still connects to its socket.
 *
 * `dir` is the open edge, as a unit XZ vector pointing out of the tile, so the
 * alcove faces back down the corridor the player arrives along.
 */
export function buildElevator (m, dir, half, deckT) {
  const fx = dir.x, fz = dir.z;             // toward the corridor
  const rx = -fz, rz = fx;                  // across it
  const P = (along, across, y) => [fx * along + rx * across, y, fz * along + rz * across];
  const back = -half + 0.9;                 // the wall the elevator sits in

  // The route the corridor stitches onto: in from the socket, up to the doors.
  m.addRoute([
    { x: fx * half, y: 0, z: fz * half },
    { x: fx * (back + 1.4), y: 0, z: fz * (back + 1.4) },
  ], 4.0);

  // carpet approach, full width of the alcove
  m.polyPrism([
    [P(half, -3.0, 0)[0], P(half, -3.0, 0)[2]],
    [P(half, 3.0, 0)[0], P(half, 3.0, 0)[2]],
    [P(back, 3.0, 0)[0], P(back, 3.0, 0)[2]],
    [P(back, -3.0, 0)[0], P(back, -3.0, 0)[2]],
  ], 0, deckT, 'track', { color: OFFICE.carpet, sideColor: OFFICE.skirting });

  // back wall with a recess
  const wallY = HALL.wallH / 2;
  for (const s of [-1, 1]) {
    const c = P(back, s * 2.25, wallY);
    m.boxRot(c[0], wallY, c[2], 1.5, HALL.wallH, HALL.wallT, [0, 1, 0],
      Math.atan2(fx, fz), 'wall', { color: OFFICE.wall });
  }
  // blue surround
  const sur = P(back + 0.02, 0, 0);
  m.boxRot(sur[0], HALL.wallH / 2, sur[2], 3.1, HALL.wallH, 0.1, [0, 1, 0],
    Math.atan2(fx, fz), 'wall', { color: OFFICE.accent });

  // the doors, slightly proud of the surround, with a seam down the middle
  for (const s of [-1, 1]) {
    const d = P(back + 0.12, s * 0.66, 0);
    m.boxRot(d[0], 1.05, d[2], 1.24, 2.1, 0.1, [0, 1, 0],
      Math.atan2(fx, fz), 'steel', { color: OFFICE.steel });
  }
  const seam = P(back + 0.19, 0, 0);
  m.boxRot(seam[0], 1.05, seam[2], 0.05, 2.1, 0.04, [0, 1, 0],
    Math.atan2(fx, fz), 'steel', { color: OFFICE.steelDark, collide: false });

  // lit floor indicator above the doors, and a call plate beside them
  const ind = P(back + 0.16, 0, 0);
  m.boxRot(ind[0], 2.34, ind[2], 0.62, 0.2, 0.06, [0, 1, 0],
    Math.atan2(fx, fz), 'glow', { color: OFFICE.accent, collide: false });
  const plate = P(back + 0.16, 1.06, 0);
  m.boxRot(plate[0], 1.15, plate[2], 0.16, 0.3, 0.05, [0, 1, 0],
    Math.atan2(fx, fz), 'glow', { color: OFFICE.light, collide: false });

  // skirting along the alcove walls
  for (const s of [-1, 1]) {
    const c = P(back + 0.1, s * 2.25, 0);
    m.boxRot(c[0], HALL.skirtH / 2, c[2], 1.5, HALL.skirtH, 0.06, [0, 1, 0],
      Math.atan2(fx, fz), 'marker', { color: OFFICE.skirting, collide: false });
  }
}

/**
 * The arrival desk: where the shift starts.
 *
 * A short stretch of carpet, a partition wall behind, a desk with a terminal,
 * and the one piece of signage on the floor. Deliberately unremarkable — it is
 * the thing you leave.
 */
export function buildArrival (m, dir, half, deckT) {
  const fx = dir.x, fz = dir.z;
  const rx = -fz, rz = fx;
  const P = (along, across) => [fx * along + rx * across, 0, fz * along + rz * across];
  const yaw = Math.atan2(fx, fz);
  const back = -half + 1.2;

  m.addRoute([
    { x: fx * half, y: 0, z: fz * half },
    { x: fx * (back + 1.0), y: 0, z: fz * (back + 1.0) },
  ], 3.6);

  m.polyPrism([
    [P(half, -2.6)[0], P(half, -2.6)[2]],
    [P(half, 2.6)[0], P(half, 2.6)[2]],
    [P(back, 2.6)[0], P(back, 2.6)[2]],
    [P(back, -2.6)[0], P(back, -2.6)[2]],
  ], 0, deckT, 'track', { color: OFFICE.carpet, sideColor: OFFICE.skirting });

  const w = P(back, 0);
  m.boxRot(w[0], HALL.wallH / 2, w[2], 5.2, HALL.wallH, HALL.wallT, [0, 1, 0], yaw,
    'wall', { color: OFFICE.wall });
  m.boxRot(w[0], HALL.skirtH / 2, w[2], 5.2, HALL.skirtH, HALL.wallT + 0.03, [0, 1, 0], yaw,
    'marker', { color: OFFICE.skirting, collide: false });

  // desk with a terminal, off to one side so the corridor stays clear
  const d = P(back + 1.05, 1.75);
  m.boxRot(d[0], 0.36, d[2], 1.9, 0.1, 0.85, [0, 1, 0], yaw, 'steel', { color: OFFICE.wallShade });
  for (const s of [-1, 1]) {
    const leg = P(back + 1.05, 1.75 + s * 0.8);
    m.boxRot(leg[0], 0.18, leg[2], 0.08, 0.36, 0.7, [0, 1, 0], yaw, 'steel',
      { color: OFFICE.steelDark, collide: false });
  }
  const scr = P(back + 0.85, 1.75);
  m.boxRot(scr[0], 0.66, scr[2], 0.7, 0.5, 0.06, [0, 1, 0], yaw, 'glow',
    { color: OFFICE.accent, collide: false });

  // floor decal marking the start
  const s0 = P(0, 0);
  m.boxRot(s0[0], 0.012, s0[2], 2.2, 0.02, 0.12, [0, 1, 0], yaw, 'marker',
    { color: OFFICE.accentDeep, collide: false });
}

/** Piece id → prop builder. Everything else is themed by palette and hallways. */
export const PROPS = {
  58: buildElevator,        // Goal Ring Archway → the elevator
  57: buildArrival,         // Start Spawn Cage  → the arrival desk
};

/* ── flavour ──────────────────────────────────────────────────────────── */

export const FLAVOUR = {
  title: 'THE SEVERED FLOOR',
  subtitle: 'Daily refinement · find the elevator',
  goal: 'ELEVATOR',
  start: 'ARRIVAL',
  checkpoint: 'WELLNESS STATION',
  pickup: 'MELON BAR',
  bonus: 'WAFFLE TOKEN',
  secret: 'THE TESTING FLOOR',
  hazard: 'BREAK ROOM',
  runner: 'the innie',
};
