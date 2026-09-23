// ============ shared game context + small utilities ============
// G is a single mutable context object populated at boot in main.js and read
// by every system, so modules don't need to thread references through ctors.

export const G = {
  scene: null, camera: null, renderer: null,
  input: null, audio: null, fx: null, hud: null, cam: null,
  map: null, world: null, nav: null,
  player: null, zombies: null, weapons: null, rounds: null,
  box: null, powerups: null, interact: null,
  state: 'boot',
  paused: false,
  debug: false,
  time: 0,          // total elapsed game seconds (battle only)
  powerOn: false,   // map power switch
  papLinked: false, // teleporter mainframe linked -> PaP usable
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
// frame-rate independent exponential smoothing factor
export const damp = (dt, rate) => 1 - Math.exp(-rate * dt);
export const rand = (a = 1, b = null) => (b === null ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const TAU = Math.PI * 2;

// shortest signed angle a->b
export function angTo(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
