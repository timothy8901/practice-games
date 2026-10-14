/*
 * UNDERBYTE — js/characters.js
 * Owner: CHARACTERS implementer.
 * Contract: CONTRACT.md §5 (player object + hooks), §7 (hits, projectiles).
 * Design: DESIGN.md §2 (controls), §3 (shared combat rules), §4 (the five fighters), §11.2 (rig drawing).
 *
 * The five fighters of DESIGN §4 — Tessik, Brackmaw, Vellix, Orrubel, Korvask — share one
 * Player class (run / variable jump / coyote / buffers / Echo Jump / Burst Line / Grip Protocol /
 * light chain with cancel windows / heavy / air attack / down-strike pogo / hurt / death /
 * energy / Overclock) driven by per-fighter data, plus a per-fighter "special program" for the
 * unique special and the Overclock ultimate (ground wave, area burst + dive, floor blink + storm,
 * ring toss + sentries, counter + grab-slam). Projectiles (Pulse Line, Ring, Sentry, Bolt) are
 * UB.Entity instances pooled per player and handed to game.spawnProjectile.
 *
 * Drawing is procedural (DESIGN §11.2): every fighter is a rig of pre-allocated shape structs in
 * body-local space (+x = facing, +y = down, body centre = 0,0) posed per frame by a pose function,
 * then drawn in three passes (ink, fill, glow). Nothing allocates per frame: palettes are
 * pre-mixed ramps, hit descriptors and projectiles are pooled, shape structs are mutated in place.
 */
'use strict';
(function (UB) {
  const E = UB.Entity, In = UB.Input, FX = UB.FX, Au = UB.Audio, P = UB.Palette, U = UB.Util, Rn = UB.Render;
  const DT = 1 / 60, TILE = 30, TAU = Math.PI * 2, DEG = Math.PI / 180;

  // DESIGN §3.12 — UB.Combat.RULES (exported as UB.Characters.RULES).
  const R = {
    buffer: 6, coyote: 6, jumpCut: 0.45, wallJumpVx: 40, wallJumpVy: 0.95,
    wallCoyote: 5, wallLock: 8, dashCooldown: 18, dashSpeedHold: true, stepUp: 6, chuteLaunch: 1.2,
    chuteIFrames: 20, dropThroughFrames: 10, pogoVy: -580, pogoDive: 500,
    hurtFrames: 16, iFrames: 60, hurtKb: [240, -300], hurtHitstop: 6, hurtShake: [5, 10],
    hazardFreeze: 30, hazardIFrames: 45, hazardHitstop: 6, deathFrames: 60,
    energyMax: 100, energyStart: 50, energyRegen: 3, meterMax: 100, ocFrames: 720,
    ocTransform: 20, ocRevert: 10, ocDamage: 1.5, ocSpeed: 1.15, ocReach: 1.2, ocReachCx: 1.1,
    ocKbTaken: 0.5, ocHitstopBonus: 1, ultimateCost: 40, chainTimeout: 20, airLandLag: 4,
    landSquashVy: 600, enemyFlash: 4, enemyHitstunBase: 10, killHitstopBonus: 2,
  };

  // =====================================================================================
  // DATA — DESIGN §4.2 sheets verbatim (box = [cx, cy, w, h] body-local, kb = [kx, ky] px/s)
  // =====================================================================================
  function mv(o) { // fill the optional fields every move shares so hot paths never test for undefined
    if (o.lunge === undefined) o.lunge = 0;
    if (o.hitCancel === undefined) o.hitCancel = 0;
    if (o.whiffCancel === undefined) o.whiffCancel = 0;
    if (o.rechain === undefined) o.rechain = 0;
    if (o.jumpCancel === undefined) o.jumpCancel = 0;
    if (o.energy === undefined) o.energy = 0;
    if (o.meter === undefined) o.meter = 0;
    if (o.shake === undefined) o.shake = null;
    if (o.box === undefined) o.box = null;
    if (o.kb === undefined) o.kb = null;
    if (o.dmg === undefined) o.dmg = 0;
    if (o.hitstop === undefined) o.hitstop = 0;
    if (o.a === undefined) o.a = 0;
    return o;
  }

  const DATA = {
    tessik: {
      id: 'tessik', name: 'Tessik', title: 'The Courier Lantern', affinity: 'signal', element: 'Signal', feel: 'balanced',
      hp: 5, run: 235, accel: 2300, friction: 2600, airControl: 0.80,
      jumpVel: 640, gravity: 1800, maxFall: 900, weight: 1.00, wallSlide: 90, djMult: 0.85,
      dash: { dist: 180, frames: 12 }, box: { w: 22, h: 48 }, runCycle: 8, downLandLag: 6,
      palette: { base: '#2F7A86', shade: '#163E47', accent: '#F0B64A', glow: '#DFFBFF' },
      ocPalette: { base: '#19B5C8', shade: '#0B4A55', accent: '#FFE08A', glow: '#FFFFFF' },
      bio: 'Tessik once carried messages between the kingdom\'s layers and still mutters route names under its breath. It believes every corrupted thing is only a message that lost its address, and that a sharp enough blade can re-deliver it. Balanced in every stat; the right first choice.',
      moves: {
        light1: mv({ name: 'Edge Sweep', s: 4, a: 3, r: 8, box: [30, -2, 44, 30], dmg: 3, kb: [180, -60], hitstop: 3, lunge: 40, hitCancel: 8, whiffCancel: 12, jumpCancel: 8, energy: 4, meter: 2 }),
        light2: mv({ name: 'Cross Cut', s: 4, a: 3, r: 9, box: [32, -4, 48, 34], dmg: 3, kb: [200, -80], hitstop: 3, lunge: 40, hitCancel: 8, whiffCancel: 13, jumpCancel: 8, energy: 4, meter: 2 }),
        light3: mv({ name: 'Lantern Thrust', s: 6, a: 4, r: 14, box: [38, -2, 56, 30], dmg: 5, kb: [380, -120], hitstop: 4, lunge: 90, hitCancel: 11, rechain: 17, jumpCancel: 11, energy: 6, meter: 4, shake: [3, 6] }),
        heavy: mv({ name: 'Prism Hammer', s: 12, a: 5, r: 18, box: [34, 0, 56, 52], dmg: 9, kb: [460, -220], hitstop: 5, energy: 10, meter: 6, shake: [3, 6] }),
        special: mv({ name: 'Pulse Line', cost: 30, s: 10, a: 0, r: 16, grounded: true, proj: { w: 26, h: 26, speed: 420, range: 390, life: 56, dmg: 6, kb: [260, -200], local: 4, meter: 5 } }),
        air: mv({ name: 'Skyline Arc', s: 5, a: 4, r: 10, box: [26, -6, 44, 40], dmg: 3, kb: [160, -40], hitstop: 3, energy: 4, meter: 2 }),
        down: mv({ name: 'Lantern Drop', s: 4, a: 999, r: 6, box: [4, 26, 24, 30], dmg: 4, kb: [60, 120], hitstop: 3, energy: 5, meter: 3 }),
        ultimate: mv({ name: 'Sightline', cost: 40, s: 12, a: 24, r: 16, grounded: true, beam: { len: 480, h: 28, cy: -4, ticks: [13, 19, 25, 31], dmg: 5, kb: [120, -40], local: 2, shake: [6, 10] } }),
      },
    },
    brackmaw: {
      id: 'brackmaw', name: 'Brackmaw', title: 'The Walking Vault', affinity: 'ore', element: 'Ore', feel: 'heavy-slow-strong',
      hp: 6, run: 180, accel: 1200, friction: 1500, airControl: 0.55,
      jumpVel: 620, gravity: 2000, maxFall: 1050, weight: 0.60, wallSlide: 110, djMult: 1.00,
      dash: { dist: 180, frames: 15 }, box: { w: 34, h: 54 }, runCycle: 12, downLandLag: 10,
      palette: { base: '#5A5F6B', shade: '#2C2F38', accent: '#B4532B', glow: '#FF9A3C' },
      ocPalette: { base: '#6B3A2A', shade: '#2A1410', accent: '#FF7A2A', glow: '#FFF2B0' },
      bio: 'A retired archival lock that decided the safest vault is the one that walks toward the problem. It speaks in short declaratives and considers being knocked over a personal failing. Slow, armoured, and the hardest hitter here.',
      moves: {
        light1: mv({ name: 'Mitt Jab', s: 6, a: 3, r: 10, box: [34, 2, 46, 36], dmg: 4, kb: [220, -60], hitstop: 4, lunge: 30, hitCancel: 10, whiffCancel: 15, jumpCancel: 10, energy: 4, meter: 2 }),
        light2: mv({ name: 'Backfist', s: 6, a: 3, r: 11, box: [36, -2, 50, 40], dmg: 4, kb: [240, -80], hitstop: 4, lunge: 30, hitCancel: 10, whiffCancel: 16, jumpCancel: 10, energy: 4, meter: 2 }),
        light3: mv({ name: 'Vault Slam', s: 9, a: 5, r: 18, box: [40, 6, 60, 46], dmg: 8, kb: [480, -160], hitstop: 5, lunge: 60, hitCancel: 15, rechain: 21, jumpCancel: 15, energy: 6, meter: 4, shake: [3, 6] }),
        heavy: mv({ name: 'Anvil Drop', s: 16, a: 6, r: 24, box: [38, 4, 64, 60], dmg: 14, kb: [560, -300], hitstop: 6, energy: 10, meter: 6, shake: [3, 6], armor: [6, 22] }),
        special: mv({ name: 'Vault Stomp', cost: 40, s: 14, a: 4, r: 22, box: [0, 12, 150, 56], dmg: 12, kb: [420, -320], kbAway: true, hitstop: 7, meter: 5, shake: [5, 8], air: { s: 6, diveVy: 1400, drift: 60, box: [0, 0, 38, 58], dmg: 6 }, ringR: 75 }),
        air: mv({ name: 'Haymaker', s: 8, a: 4, r: 12, box: [32, 0, 48, 44], dmg: 5, kb: [260, -60], hitstop: 4, energy: 4, meter: 2 }),
        down: mv({ name: 'Mitt Plunge', s: 6, a: 999, r: 10, box: [4, 30, 34, 30], dmg: 7, kb: [80, 160], hitstop: 4, energy: 5, meter: 3 }),
        ultimate: mv({ name: 'Quake Vault', cost: 40, s: 18, a: 6, r: 28, box: [0, 10, 300, 70], dmg: 26, kb: [560, -420], kbAway: true, hitstop: 10, meter: 5, shake: [10, 16], air: { s: 6, diveVy: 1400, drift: 60, box: [0, 0, 38, 58], dmg: 8 }, ringR: 150 }),
      },
    },
    vellix: {
      id: 'vellix', name: 'Vellix', title: 'The Prefetch Streak', affinity: 'flux', element: 'Flux', feel: 'fast-fragile',
      hp: 4, run: 300, accel: 3600, friction: 3200, airControl: 1.00,
      jumpVel: 615, gravity: 1750, maxFall: 850, weight: 1.30, wallSlide: 70, djMult: 0.90,
      dash: { dist: 210, frames: 10 }, box: { w: 18, h: 40 }, runCycle: 6, downLandLag: 5,
      palette: { base: '#4C2A6E', shade: '#241236', accent: '#F7F4EA', glow: '#FF3FA4' },
      ocPalette: { base: '#7A2CB8', shade: '#2A0B45', accent: '#FFFFFF', glow: '#FF5CC8' },
      bio: 'A cache routine that lives three steps ahead of everyone and is bored by the present. Reckless and bright, it treats every fight as a timing puzzle it has already solved. Fastest in the roster, and the most fragile.',
      moves: {
        light1: mv({ name: 'Flick', s: 3, a: 2, r: 6, box: [26, 0, 36, 24], dmg: 2, kb: [140, -40], hitstop: 3, lunge: 60, hitCancel: 6, whiffCancel: 9, jumpCancel: 6, energy: 4, meter: 2 }),
        light2: mv({ name: 'Tail Snap', s: 3, a: 3, r: 6, box: [30, -2, 44, 28], dmg: 3, kb: [160, -60], hitstop: 3, lunge: 60, hitCancel: 7, whiffCancel: 10, jumpCancel: 7, energy: 4, meter: 2 }),
        light3: mv({ name: 'Crest Rake', s: 5, a: 3, r: 10, box: [34, -4, 48, 30], dmg: 3, kb: [300, -140], hitstop: 3, lunge: 110, hitCancel: 9, rechain: 15, jumpCancel: 9, energy: 6, meter: 4, shake: [3, 6] }),
        heavy: mv({ name: 'Tailwhip Vault', s: 9, a: 5, r: 14, box: [30, -4, 52, 44], dmg: 6, kb: [380, -240], hitstop: 4, jumpCancel: 15, energy: 10, meter: 6, shake: [3, 6] }),
        special: mv({ name: 'Blink Strike', cost: 25, s: 4, a: 8, r: 8, grounded: true, box: [6, 0, 34, 40], dmg: 7, kb: [220, -120], local: 4, meter: 5, slide: 25, shake: [4, 8] }),
        air: mv({ name: 'Scissor Spin', s: 4, a: 5, r: 8, box: [0, 0, 52, 46], dmg: 2, kb: [150, -60], hitstop: 3, energy: 4, meter: 2 }),
        down: mv({ name: 'Needle Drop', s: 3, a: 999, r: 5, box: [2, 24, 20, 28], dmg: 3, kb: [60, 120], hitstop: 3, energy: 5, meter: 3 }),
        ultimate: mv({ name: 'Afterimage Storm', cost: 40, s: 6, a: 32, r: 10, box: [0, 0, 44, 46], dmg: 6, kb: [200, -160], local: 3, meter: 5, blinks: 4, blinkFrames: 8, lock: 260, maxTravel: 180, through: 30, freeTravel: 90, guard: 38, shake: [8, 14] }),
      },
    },
    orrubel: {
      id: 'orrubel', name: 'Orrubel', title: 'The Ring Warden', affinity: 'cipher', element: 'Cipher', feel: 'zoner',
      hp: 5, run: 215, accel: 1900, friction: 2200, airControl: 0.75,
      jumpVel: 630, gravity: 1800, maxFall: 900, weight: 1.10, wallSlide: 90, djMult: 0.85,
      dash: { dist: 180, frames: 12 }, box: { w: 24, h: 44 }, runCycle: 4, downLandLag: 7,
      palette: { base: '#5E6B55', shade: '#30392D', accent: '#C8D6B0', glow: '#9CFF57' },
      ocPalette: { base: '#86976E', shade: '#3A4A2E', accent: '#E6F2C8', glow: '#CBFF66' },
      bio: 'A watchdog process that trusts nothing it has not measured twice and prefers to fight from behind a wall of its own instruments. Soft-spoken and precise, it apologises to enemies as it pins them. Long reach, a returning ring, and sentries.',
      moves: {
        light1: mv({ name: 'Whip Flick', s: 5, a: 3, r: 9, box: [44, -2, 64, 22], dmg: 2, kb: [120, -30], hitstop: 3, hitCancel: 9, whiffCancel: 13, jumpCancel: 9, energy: 4, meter: 2 }),
        light2: mv({ name: 'Whip Cross', s: 5, a: 3, r: 9, box: [46, 0, 68, 22], dmg: 3, kb: [140, -40], hitstop: 3, hitCancel: 9, whiffCancel: 13, jumpCancel: 9, energy: 4, meter: 2 }),
        light3: mv({ name: 'Double Lash', s: 7, a: 4, r: 13, box: [50, -4, 76, 26], dmg: 4, kb: [320, -120], hitstop: 4, hitCancel: 12, rechain: 18, jumpCancel: 12, energy: 6, meter: 4, shake: [3, 6] }),
        heavy: mv({ name: 'Ring Toss', s: 10, a: 0, r: 14, ring: { w: 20, h: 20, speed: 560, range: 220, life: 50, dmgOut: 7, dmgBack: 4, kb: [260, -120], local: 4, energy: 5, meter: 1, launch: [14, -2] } }),
        special: mv({ name: 'Sentry Pin', cost: 35, s: 8, a: 0, r: 12, sentry: { life: 300, cadence: 30, range: 260, at: [[40, -8]], bolt: { w: 10, h: 10, speed: 480, life: 45, dmg: 2, kb: [80, -20], local: 2, meter: 1 } } }),
        air: mv({ name: 'Whip Circle', s: 5, a: 4, r: 10, box: [28, -4, 60, 36], dmg: 2, kb: [140, -40], hitstop: 3, energy: 4, meter: 2 }),
        down: mv({ name: 'Peg Drop', s: 5, a: 999, r: 7, box: [2, 26, 22, 28], dmg: 3, kb: [60, 120], hitstop: 3, energy: 5, meter: 3 }),
        ultimate: mv({ name: 'Sentry Triad', cost: 40, s: 8, a: 0, r: 12, sentry: { life: 300, cadence: 30, range: 300, at: [[40, -8], [-40, -8], [0, -60]], bolt: { w: 10, h: 10, speed: 480, life: 45, dmg: 2, kb: [80, -20], local: 2, meter: 1 } } }),
      },
    },
    korvask: {
      id: 'korvask', name: 'Korvask', title: 'The Clamp Balancer', affinity: 'pressure', element: 'Pressure', feel: 'grappler-ish bruiser',
      hp: 6, run: 200, accel: 1500, friction: 1800, airControl: 0.60,
      jumpVel: 610, gravity: 1900, maxFall: 960, weight: 0.75, wallSlide: 100, djMult: 1.00,
      dash: { dist: 180, frames: 14 }, box: { w: 30, h: 56 }, runCycle: 10, downLandLag: 9,
      palette: { base: '#7A2E2E', shade: '#3E1414', accent: '#D9C27A', glow: '#FFE066' },
      ocPalette: { base: '#B8362E', shade: '#4A0F0F', accent: '#FFD766', glow: '#FFF7C2' },
      bio: 'A load-balancer that misremembers its old job as "holding things until they stop struggling." Gruff and loyal, it believes any problem can be solved by getting closer to it. A bruiser whose counter turns enemy attacks into pain.',
      moves: {
        light1: mv({ name: 'Clamp Jab', s: 5, a: 3, r: 9, box: [32, 2, 44, 34], dmg: 3, kb: [120, -40], hitstop: 3, lunge: 30, hitCancel: 9, whiffCancel: 13, jumpCancel: 9, energy: 4, meter: 2 }),
        light2: mv({ name: 'Clamp Hook', s: 5, a: 3, r: 10, box: [34, -2, 46, 38], dmg: 4, kb: [130, -50], hitstop: 4, lunge: 30, hitCancel: 9, whiffCancel: 14, jumpCancel: 9, energy: 4, meter: 2 }),
        light3: mv({ name: 'Chain Haul', s: 8, a: 4, r: 16, box: [40, 0, 56, 44], dmg: 6, kb: [-200, -240], hitstop: 5, hitCancel: 13, rechain: 19, jumpCancel: 13, energy: 6, meter: 4, shake: [3, 6] }),
        heavy: mv({ name: 'Drum Slam', s: 14, a: 5, r: 20, box: [36, 6, 58, 56], dmg: 11, kb: [520, -280], hitstop: 6, lunge: 40, energy: 10, meter: 6, shake: [3, 6] }),
        special: mv({ name: 'Bulwark Catch', cost: 20, s: 2, a: 16, r: 18, counter: { s: 6, a: 4, r: 14, box: [34, 0, 70, 56], dmg: 16, kb: [540, -320], hitstop: 6, refund: 20, meter: 15, shake: [4, 8] } }),
        air: mv({ name: 'Anchor Swing', s: 7, a: 4, r: 12, box: [30, 4, 48, 44], dmg: 4, kb: [220, -40], hitstop: 4, energy: 4, meter: 2 }),
        down: mv({ name: 'Piston Plunge', s: 5, a: 999, r: 9, box: [4, 30, 30, 30], dmg: 6, kb: [80, 160], hitstop: 4, energy: 5, meter: 3 }),
        ultimate: mv({ name: 'Clamp Press', cost: 40, s: 8, a: 10, r: 18, grab: { box: [18, 0, 40, 50], lunge: 110, frames: 10, hitstop: 8 }, press: { frames: 14, hop: 24, hold: [22, 0] }, slam: { frames: 4, box: [16, 10, 90, 60], dmgHeld: 32, dmg: 10, kb: [380, -400], hitstop: 8, r: 14, shake: [8, 14] } }),
      },
    },
  };
  // Derived stat block + aliases the select screen / contract read (hp run jumpVel gravity weight are also top-level).
  for (const id in DATA) {
    const d = DATA[id];
    d.jumpHeight = d.jumpVel * d.jumpVel / (2 * d.gravity);
    d.stats = { hp: d.hp, run: d.run, jumpVel: d.jumpVel, gravity: d.gravity, weight: d.weight, jumpHeight: d.jumpHeight,
      accel: d.accel, friction: d.friction, airControl: d.airControl, maxFall: d.maxFall, wallSlide: d.wallSlide, djMult: d.djMult, dash: d.dash, box: d.box };
  }
  const list = [];
  for (let i = 0; i < UB.IDS.fighters.length; i++) if (DATA[UB.IDS.fighters[i]]) list.push(DATA[UB.IDS.fighters[i]]);

  // =====================================================================================
  // Palettes — pre-mixed ramps so Overclock crossfades and death desaturation never build strings per frame
  // =====================================================================================
  const RAMP_N = 8;
  function hexToRgb(h, out) { out[0] = parseInt(h.slice(1, 3), 16); out[1] = parseInt(h.slice(3, 5), 16); out[2] = parseInt(h.slice(5, 7), 16); return out; }
  function rgbToHex(r, g, b) { return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase(); }
  const rgbA = [0, 0, 0], rgbB = [0, 0, 0];
  function mixHex(a, b, k) {
    hexToRgb(a, rgbA); hexToRgb(b, rgbB);
    return rgbToHex(Math.round(rgbA[0] + (rgbB[0] - rgbA[0]) * k), Math.round(rgbA[1] + (rgbB[1] - rgbA[1]) * k), Math.round(rgbA[2] + (rgbB[2] - rgbA[2]) * k));
  }
  function desatHex(h) { hexToRgb(h, rgbA); const l = Math.round(rgbA[0] * 0.3 + rgbA[1] * 0.59 + rgbA[2] * 0.11); return rgbToHex(l, l, l); }
  /** A drawable palette: the four fighter colours plus the shared inks. */
  function makePal(src, k, dst) {
    const p = { base: src.base, shade: src.shade, accent: src.accent, glow: src.glow, ink: P.INK, paper: P.PAPER, white: '#FFFFFF', danger: P.DANGER };
    if (dst) { p.base = mixHex(src.base, dst.base, k); p.shade = mixHex(src.shade, dst.shade, k); p.accent = mixHex(src.accent, dst.accent, k); p.glow = mixHex(src.glow, dst.glow, k); }
    return p;
  }
  for (const id in DATA) {
    const d = DATA[id];
    const grey = { base: desatHex(d.palette.base), shade: desatHex(d.palette.shade), accent: desatHex(d.palette.accent), glow: desatHex(d.palette.glow) };
    d.ocRamp = []; d.greyRamp = [];
    for (let k = 0; k <= RAMP_N; k++) { d.ocRamp.push(makePal(d.palette, k / RAMP_N, d.ocPalette)); d.greyRamp.push(makePal(d.palette, k / RAMP_N, grey)); }
    d.pal = d.ocRamp[0]; d.ocPal = d.ocRamp[RAMP_N];
    d.auraOpts = { color: d.ocPalette.glow };
  }

  // =====================================================================================
  // Rig primitives (DESIGN §11.2.2 in spirit: shape structs, ink pass → fill pass → glow pass)
  // =====================================================================================
  const K_ELL = 1, K_RR = 2, K_POLY = 3, K_WEDGE = 4, K_LIMB = 5, K_LINE = 6, K_ARC = 7, K_DOT = 8;
  let shapeSeed = 1;
  function shape(list, k, fill) {
    const s = { k: k, x: 0, y: 0, w: 0, h: 0, r: 0, rot: 0, a0: 0, a1: TAU, fill: fill || 'base', col: 'shade', lw: 2,
      pts: null, n: 0, glow: false, alpha: 1, off: false, seed: shapeSeed++, jit: false, ink: true };
    list.push(s); return s;
  }
  // factories: body-local coordinates; every field may be mutated by the pose function each frame
  function ell(list, x, y, rx, ry, fill) { const s = shape(list, K_ELL, fill); s.x = x; s.y = y; s.w = rx; s.h = ry; return s; }
  function rrc(list, x, y, w, h, r, fill) { const s = shape(list, K_RR, fill); s.x = x; s.y = y; s.w = w; s.h = h; s.r = r; return s; }
  function poly(list, pts, fill) { const s = shape(list, K_POLY, fill); s.pts = pts.slice(); s.n = pts.length >> 1; s.jit = true; return s; }
  function wedge(list, x, y, len, wid, ang, fill) { const s = shape(list, K_WEDGE, fill); s.x = x; s.y = y; s.w = len; s.h = wid; s.rot = ang; return s; }
  function limb(list, x0, y0, cx, cy, x1, y1, w, col) { const s = shape(list, K_LIMB); s.pts = [x0, y0, cx, cy, x1, y1]; s.lw = w; s.col = col || 'shade'; return s; }
  function line(list, x0, y0, x1, y1, w, col) { const s = shape(list, K_LINE); s.pts = [x0, y0, x1, y1]; s.lw = w; s.col = col || 'shade'; return s; }
  function arc(list, x, y, r, a0, a1, w, col) { const s = shape(list, K_ARC); s.x = x; s.y = y; s.w = r; s.h = r; s.a0 = a0; s.a1 = a1; s.lw = w; s.col = col || 'accent'; return s; }
  function dot(list, x, y, r, fill, glow) { const s = shape(list, K_DOT, fill || 'glow'); s.x = x; s.y = y; s.r = r; s.glow = !!glow; return s; }

  /** Build the canvas path of one shape (no fill/stroke). */
  function pathOf(ctx, s) {
    ctx.beginPath();
    switch (s.k) {
      case K_ELL: ctx.ellipse(s.x, s.y, Math.max(0.1, s.w), Math.max(0.1, s.h), s.rot, s.a0, s.a1); if (s.a1 - s.a0 < TAU - 0.01) ctx.closePath(); break;
      case K_RR: {
        const w = Math.max(0.5, s.w), h = Math.max(0.5, s.h), r = Math.min(s.r, w / 2, h / 2);
        if (s.rot !== 0) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); Rn.rrect(ctx, -w / 2, -h / 2, w, h, r); ctx.restore(); }
        else Rn.rrect(ctx, s.x - w / 2, s.y - h / 2, w, h, r);
        break;
      }
      case K_POLY: {
        const p = s.pts, j = s.jit ? 1 : 0;
        for (let i = 0; i < s.n; i++) {
          const x = p[i * 2] + s.x + (j ? U.jitter(s.seed, i, 0.8) : 0), y = p[i * 2 + 1] + s.y + (j ? U.jitter(s.seed, i + 17, 0.8) : 0);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); break;
      }
      case K_WEDGE: {
        const c = Math.cos(s.rot * DEG), sn = Math.sin(s.rot * DEG);
        const hx = -sn * s.h / 2, hy = c * s.h / 2;
        ctx.moveTo(s.x + hx, s.y + hy); ctx.lineTo(s.x + c * s.w, s.y + sn * s.w); ctx.lineTo(s.x - hx, s.y - hy); ctx.closePath(); break;
      }
      case K_LIMB: { const p = s.pts; ctx.moveTo(p[0], p[1]); ctx.quadraticCurveTo(p[2], p[3], p[4], p[5]); break; }
      case K_LINE: { const p = s.pts; ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); break; }
      case K_ARC: ctx.ellipse(s.x, s.y, Math.max(0.1, s.w), Math.max(0.1, s.h), 0, s.a0, s.a1); break;
      case K_DOT: ctx.arc(s.x, s.y, Math.max(0.1, s.r), 0, TAU); break;
    }
  }
  function isStroke(s) { return s.k === K_LIMB || s.k === K_LINE || s.k === K_ARC; }
  /**
   * Draw a rig: ink pass (every non-glow shape stroked INK; stroke shapes get lw+3 so a 2 px limb
   * keeps a 1.5 px ink border), fill pass (fills / coloured strokes), glow pass ('lighter', halo),
   * then an optional tint pass (hurt white/red re-draw at `tintAlpha`).
   */
  function drawRig(ctx, shapes, pal, tint, tintAlpha, outline) {
    const n = shapes.length;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = P.INK;
    for (let i = 0; i < n; i++) {
      const s = shapes[i];
      if (s.off || s.glow || !s.ink) continue;
      pathOf(ctx, s);
      ctx.lineWidth = isStroke(s) ? s.lw + 3 : 3;
      ctx.stroke();
    }
    const baseAlpha = ctx.globalAlpha;
    for (let i = 0; i < n; i++) {
      const s = shapes[i];
      if (s.off || s.glow) continue;
      if (s.alpha !== 1) ctx.globalAlpha = baseAlpha * s.alpha;
      pathOf(ctx, s);
      if (isStroke(s)) { ctx.strokeStyle = pal[s.col] || s.col; ctx.lineWidth = s.lw; ctx.stroke(); }
      else { ctx.fillStyle = pal[s.fill] || s.fill; ctx.fill(); }
      if (s.alpha !== 1) ctx.globalAlpha = baseAlpha;
    }
    let anyGlow = false;
    for (let i = 0; i < n; i++) if (shapes[i].glow && !shapes[i].off) { anyGlow = true; break; }
    if (anyGlow) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const s = shapes[i];
        if (!s.glow || s.off) continue;
        const c = pal[s.fill] || s.fill;
        if (s.k === K_DOT) { ctx.globalAlpha = baseAlpha * 0.22 * s.alpha; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 2.5, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = baseAlpha * s.alpha;
        pathOf(ctx, s);
        if (isStroke(s)) { ctx.strokeStyle = c; ctx.lineWidth = s.lw; ctx.stroke(); } else { ctx.fillStyle = c; ctx.fill(); }
      }
      ctx.restore();
    }
    if (tint) {
      ctx.globalAlpha = baseAlpha * tintAlpha;
      ctx.fillStyle = tint; ctx.strokeStyle = tint;
      for (let i = 0; i < n; i++) {
        const s = shapes[i];
        if (s.off) continue;
        pathOf(ctx, s);
        if (isStroke(s)) { ctx.lineWidth = s.lw; ctx.stroke(); } else ctx.fill();
      }
      ctx.globalAlpha = baseAlpha;
    }
    if (outline) {   // the i-frame silhouette edge: every body shape stroked in `outline` at near-full opacity
      ctx.save(); ctx.globalAlpha = 0.9; ctx.strokeStyle = outline;
      for (let i = 0; i < n; i++) {
        const s = shapes[i];
        if (s.off || s.glow || !s.ink) continue;
        pathOf(ctx, s); ctx.lineWidth = isStroke(s) ? s.lw + 1 : 1.5; ctx.stroke();
      }
      ctx.restore();
    }
  }
  /** Motion smear: 3 concentric arcs at alpha ×1, ×0.6, ×0.3 (DESIGN §11.2.2 UB.Draw.smear). */
  function smear(ctx, x, y, r, a0, a1, col, alpha) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = alpha * (i === 0 ? 1 : (i === 1 ? 0.6 : 0.3)); ctx.lineWidth = 4 - i;
      ctx.beginPath(); ctx.arc(x, y, Math.max(1, r - i * 5), a0, a1); ctx.stroke();
    }
    ctx.restore();
  }
  /** Progress 0..1 of the active window of a move (0 outside). */
  function activeK(pl) { const m = pl.move; if (!m || m.a <= 0) return 0; const k = (pl.moveT - m.s) / Math.max(1, Math.min(m.a, 8)); return k < 0 ? 0 : (k > 1 ? 1 : k); }
  function isActive(pl) { const m = pl.move; return !!m && pl.moveT > m.s && pl.moveT <= m.s + m.a; }
  function isStartup(pl) { const m = pl.move; return !!m && pl.moveT <= m.s; }

  // =====================================================================================
  // Rigs — one build()/pose()/extras() per fighter (DESIGN §4.2 visual specs, §11.2.3 animation table)
  // =====================================================================================
  function setLine(s, x0, y0, x1, y1) { const p = s.pts; p[0] = x0; p[1] = y0; p[2] = x1; p[3] = y1; }
  function setLimb(s, x0, y0, cx, cy, x1, y1) { const p = s.pts; p[0] = x0; p[1] = y0; p[2] = cx; p[3] = cy; p[4] = x1; p[5] = y1; }
  function setPt(s, i, x, y) { s.pts[i * 2] = x; s.pts[i * 2 + 1] = y; }
  function sinT(t, period) { return Math.sin(t / period * TAU); }
  /** Shared animation numbers (DESIGN §11.2.3) computed once per frame into `o`. */
  const PO = { lean: 0, bob: 0, ph: 0, leg: 0, knee: 0, arm: 0, st: 'idle', t: 0, act: false, k: 0, cyc: 8, air: false };
  function basePose(v) {
    const o = PO, st = v.state, t = v.stateT;
    o.st = st; o.t = t; o.lean = 0; o.bob = 0; o.leg = 0; o.knee = 0; o.arm = 0; o.act = isActive(v); o.k = activeK(v); o.cyc = v.data.runCycle;
    o.air = !v.onGround;
    if (st === 'idle') { o.bob = sinT(t, 40); }
    else if (st === 'run' || (st === 'dash')) {
      o.ph = (v.t % o.cyc) / o.cyc * TAU; o.leg = Math.sin(o.ph); o.knee = 6 * Math.max(0, Math.cos(o.ph));
      o.bob = -2 * Math.abs(o.leg); o.arm = -6 * o.leg; o.lean = st === 'dash' ? 22 : 10;
    } else if (st === 'attack' && v.onGround) { o.lean = 4; }
    return o;
  }

  const RIGS = {};

  // ---- TESSIK — hexagonal lantern head, blade forearms, strand cloak ----------------------------------
  RIGS.tessik = {
    build: function () {
      const L = [], r = { shapes: L };
      r.strands = []; r.beads = [];
      for (let i = 0; i < 7; i++) { r.strands.push(limb(L, 0, -4, 0, 8, 0, 20, 2, 'shade')); }
      for (let i = 0; i < 7; i++) { r.beads.push(dot(L, 0, 20, 2, 'accent', false)); }
      r.armB = line(L, -6, -4, -9, 6, 2, 'shade'); r.bladeB = wedge(L, -9, 6, 14, 4, 90, 'accent');
      r.legB = line(L, 0, 8, -4, 24, 2, 'shade'); r.footB = wedge(L, -4, 24, 6, 3, 0, 'shade');
      r.legF = line(L, 0, 8, 4, 24, 2, 'shade'); r.footF = wedge(L, 4, 24, 6, 3, 0, 'shade');
      r.torso = poly(L, [-6, -4, 6, -4, 4, 8, -4, 8], 'base');
      r.neck = line(L, 0, -6, 0, -4, 2, 'shade');
      r.head = poly(L, [0, -26, 9, -21, 9, -11, 0, -6, -9, -11, -9, -21], 'base');
      r.core = poly(L, [0, -20, 3, -16, 0, -12, -3, -16], 'glow'); r.core.glow = true; r.core.jit = false;
      r.armF = line(L, 6, -4, 9, 6, 2, 'shade'); r.bladeF = wedge(L, 9, 6, 14, 4, 90, 'accent');
      return r;
    },
    pose: function (r, v) {
      const o = basePose(v), st = o.st, mv = v.moveName, m = v.move, mt = v.moveT;
      const oc = v.ocActive;
      // defaults: idle
      let strandDir = 0, strandUp = 0, sway = sinT(v.t, 72) * 2, flare = 0, crouch = 0, headTilt = 0;
      let uaF = 95, faF = 100, uaB = 85, faB = 80;           // upper-arm / forearm angles (deg, 90 = down, 0 = forward)
      let footFx = 4, footBx = -4, footFy = 24, footBy = 24, kneeF = 0, kneeB = 0;
      let coreA = 0.9 + 0.1 * sinT(v.t, 90);
      if (st === 'run' || st === 'dash') {
        strandDir = -1; sway = 0;
        footFx = 4 + 8 * o.leg; footBx = -4 - 8 * o.leg; kneeF = o.knee; kneeB = 6 - o.knee;
        uaF = 90 - 40 * o.leg; faF = 60 - 40 * o.leg; uaB = 90 + 40 * o.leg; faB = 60 + 40 * o.leg;
      } else if (st === 'jump') { footFx = 5; footBx = -3; footFy = footBy = 10; uaF = 20; faF = -40; uaB = 160; faB = -140; strandDir = 0; sway = 0; headTilt = -5; }
      else if (st === 'fall') { footFx = 7; footBx = -7; uaF = 0; faF = 0; uaB = 180; faB = 180; strandUp = -1; sway = 0; }
      else if (st === 'cling') { uaF = 20; faF = -60; uaB = 120; faB = 90; footFx = 8; footBx = 2; footFy = 20; footBy = 22; sway = 0; }
      else if (st === 'hurt') { strandDir = 1; uaF = 30; faF = 0; uaB = 140; faB = 180; coreA = ((v.t >> 1) & 1) ? 0.2 : 1; sway = 0; }
      if (m && (mv === 'light1' || mv === 'light2' || mv === 'light3' || mv === 'air' || mv === 'heavy' || mv === 'down' || mv === 'special' || mv === 'ultimate')) {
        const k = o.k, ws = isStartup(v);
        if (mv === 'light1' || mv === 'light2') {
          // one forearm blade sweeps a 120° arc in front (left blade on L1, right on L2)
          const a = ws ? -80 : (o.act ? -70 + 130 * k : 60);
          if (mv === 'light1') { uaF = 20; faF = a; } else { uaB = 20; faB = a; uaF = 100; faF = 110; }
          crouch = 1;
        } else if (mv === 'light3') { // both blades thrust forward, core flares
          const a = ws ? 40 : 0; uaF = uaB = a + 10; faF = faB = a; coreA = o.act ? 1 : 0.9; strandDir = -1;
        } else if (mv === 'heavy') {
          if (mt <= 12) { uaF = uaB = -70; faF = faB = -90; strandDir = -1; }               // raised overhead
          else { uaF = uaB = 10; faF = faB = o.act ? 30 + 50 * k : 85; flare = 14; crouch = 3; }   // slammed down
        } else if (mv === 'air') { const a = ws ? 110 : (o.act ? 100 - 160 * k : -60); uaF = a - 20; faF = a; uaB = 160; faB = 170; }
        else if (mv === 'down') { uaF = uaB = 100; faF = faB = 90; footFx = 3; footBx = -3; footFy = footBy = 26; strandUp = -1; }
        else if (mv === 'special') { crouch = 4; uaF = 60; faF = 95; uaB = 150; faB = 120; }
        else if (mv === 'ultimate') { uaF = uaB = 0; faF = faB = 0; coreA = 1; strandDir = -1; }
      }
      // --- apply ---
      const bob = o.bob + crouch;
      const nStr = oc ? 7 : 5;
      for (let i = 0; i < 7; i++) {
        const s = r.strands[i], b = r.beads[i];
        if (i >= nStr) { s.off = b.off = true; continue; }
        s.off = b.off = false;
        const sx = oc ? (i - 3) * 2.2 : (i - 2) * 3;
        const tipX = sx + sway + strandDir * (14 + i) + flare * (i < 3 ? -1 : 1), tipY = 20 + strandUp * 14 + bob;
        const cxp = sx - 4 - strandDir * 2 + sway * 0.5, cyp = 8 + strandUp * 4 + bob;
        setLimb(s, sx, -4 + bob, cxp, cyp, tipX, tipY);
        b.x = tipX; b.y = tipY; s.col = oc ? 'glow' : 'shade'; s.alpha = 1;
      }
      // arms
      const eFx = 6 + 10 * Math.cos(uaF * DEG), eFy = -4 + bob + 10 * Math.sin(uaF * DEG);
      setLine(r.armF, 6, -4 + bob, eFx, eFy); r.bladeF.x = eFx; r.bladeF.y = eFy; r.bladeF.rot = faF;
      const eBx = -6 + 10 * Math.cos(uaB * DEG), eBy = -4 + bob + 10 * Math.sin(uaB * DEG);
      setLine(r.armB, -6, -4 + bob, eBx, eBy); r.bladeB.x = eBx; r.bladeB.y = eBy; r.bladeB.rot = faB;
      // legs (knee bend pulls the hip point forward)
      setLine(r.legF, 2 + kneeF * 0.3, 8 + bob, footFx, footFy); r.footF.x = footFx; r.footF.y = footFy; r.footF.rot = 0;
      setLine(r.legB, -2 - kneeB * 0.3, 8 + bob, footBx, footBy); r.footB.x = footBx; r.footB.y = footBy; r.footB.rot = 0;
      r.torso.y = bob; r.neck.pts[1] = -6 + bob; r.neck.pts[3] = -4 + bob;
      r.head.y = bob; r.head.x = headTilt * 0.3; r.core.y = bob; r.core.x = headTilt * 0.3; r.core.alpha = coreA;
      return o.lean;
    },
    extras: function (ctx, v, pal) {
      const mv = v.moveName, m = v.move;
      if (m && isActive(v) && (mv === 'light1' || mv === 'light2' || mv === 'air')) {
        const k = activeK(v);
        const a0 = mv === 'air' ? 0.6 - 2.6 * k : -1.3 + 1.6 * k;
        smear(ctx, 12, m.box[1], 26, a0, a0 + 0.9, pal.accent, 0.6);
      } else if (m && mv === 'light3' && isActive(v)) { smear(ctx, 20, -2, 22, -0.5, 0.5, pal.glow, 0.5); }
      else if (m && mv === 'heavy' && v.moveT > 12 && v.moveT <= 20) {
        const k = Math.min(1, (v.moveT - 12) / 5);
        smear(ctx, 16, -8, 30, -1.6 + 1.9 * k, -1.1 + 1.9 * k, pal.accent, 0.55);
        if (isActive(v)) { ctx.save(); ctx.strokeStyle = pal.accent; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(26 + i * 6, 22); ctx.lineTo(32 + i * 6, 12 - i * 3); } ctx.stroke(); ctx.restore(); }
      } else if (m && mv === 'special') {
        ctx.save(); ctx.globalAlpha *= 0.35 + 0.25 * Math.abs(sinT(v.moveT, 10)); ctx.fillStyle = pal.glow;
        ctx.beginPath(); ctx.ellipse(10, v.h / 2 - 2, 20, 4, 0, 0, TAU); ctx.fill(); ctx.restore();
      }
      if (v.ocActive || v.ocTransform > 0) { // orbiting second hexagon (1 rev / 2 s)
        ctx.save(); ctx.translate(0, -16); ctx.rotate(v.t / 120 * TAU);
        ctx.strokeStyle = pal.glow; ctx.lineWidth = 2; ctx.globalAlpha *= 0.7; ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = i * TAU / 6 - Math.PI / 2; const x = Math.cos(a) * 16, y = Math.sin(a) * 16; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.closePath(); ctx.stroke(); ctx.restore();
      }
    },
  };

  // ---- BRACKMAW — boulder torso, headlight eyes, vault dial, ground-resting mitts ---------------------
  RIGS.brackmaw = {
    build: function () {
      const L = [], r = { shapes: L };
      r.armB = line(L, -14, -14, -15, 2, 6, 'shade'); r.mittB = rrc(L, -15, 12, 12, 24, 4, 'base');
      r.knB = []; for (let i = 0; i < 3; i++) r.knB.push(line(L, -20, 16 + i * 2, -10, 16 + i * 2, 1.5, 'accent'));
      r.legB = rrc(L, -6, 20.5, 10, 13, 3, 'shade'); r.legF = rrc(L, 6, 20.5, 10, 13, 3, 'shade');
      r.torso = rrc(L, 0, -3, 32, 34, 8, 'base');
      r.cracks = []; for (let i = 0; i < 6; i++) { const c = line(L, 0, 0, 0, 0, 1.5, 'glow'); c.glow = true; c.ink = false; r.cracks.push(c); }
      r.dial = dot(L, 2, 2, 7, 'accent', false);
      r.ticks = []; for (let i = 0; i < 4; i++) r.ticks.push(line(L, 2, 2, 2, 2, 2, 'shade'));
      r.dialGlow = dot(L, 2, 2, 4, 'glow', true); r.dialGlow.off = true;
      r.head = poly(L, [-14, -20, 14, -20, 9, -30, -9, -30], 'base');
      r.rivets = []; for (let i = 0; i < 4; i++) r.rivets.push(dot(L, -10 + i * 6, -21, 1, 'shade', false));
      r.eyeA = rrc(L, 4, -25, 3, 3, 0.5, 'glow'); r.eyeA.glow = true; r.eyeB = rrc(L, 10, -25, 3, 3, 0.5, 'glow'); r.eyeB.glow = true;
      r.armF = line(L, 14, -14, 15, 2, 6, 'shade'); r.mittF = rrc(L, 15, 12, 12, 24, 4, 'base');
      r.knF = []; for (let i = 0; i < 3; i++) r.knF.push(line(L, 10, 16 + i * 2, 20, 16 + i * 2, 1.5, 'accent'));
      return r;
    },
    pose: function (r, v) {
      const o = basePose(v), st = o.st, mv = v.moveName, m = v.move, mt = v.moveT, oc = v.ocActive;
      let bob = st === 'idle' ? sinT(v.t, 120) : o.bob, crouch = 0, tilt = 0;
      // mitt centre positions (body-local), mitt rotation, leg offsets
      let mFx = 15, mFy = 12, mBx = -15, mBy = 12, mRot = 0, legFx = 6, legBx = -6, legY = 20.5, dialSpin = 0;
      let blink = st === 'idle' && (v.t % 180) < 4;
      if (st === 'run' || st === 'dash') { // knuckle-walk: mitts swing forward and plant while the legs shuffle
        bob = -3 * Math.abs(o.leg); mFx = 15 + 9 * o.leg; mFy = 12 - 4 * Math.max(0, o.leg); mBx = -15 - 9 * o.leg; mBy = 12 - 4 * Math.max(0, -o.leg);
        legFx = 6 - 4 * o.leg; legBx = -6 + 4 * o.leg; tilt = 4;
      } else if (st === 'jump') { mFy = mBy = -8; mFx = 17; mBx = -17; legY = 23; tilt = -5; }
      else if (st === 'fall') { mFy = mBy = -18; mFx = 15; mBx = -15; mRot = 0; legFx = 9; legBx = -9; legY = 23; tilt = 8; }
      else if (st === 'cling') { mFx = 18; mFy = -6; mBx = -10; mBy = 8; legFx = 8; legBx = -2; }
      else if (st === 'hurt') { mFy = mBy = -12; mFx = 12; mBx = -18; tilt = -15; dialSpin = v.t * 20; }
      if (m) {
        const k = o.k, ws = isStartup(v);
        if (mv === 'light1') { mFx = ws ? 10 : 15 + 20 * (o.act ? k : 1); mFy = 12 - (o.act ? 6 * k : 6); }
        else if (mv === 'light2') { mBx = ws ? -22 : -15 + 36 * (o.act ? k : 1); mBy = 10 - (o.act ? 6 * k : 6); mFx = 10; }
        else if (mv === 'light3') { const kk = ws ? 0 : (o.act ? k : 1); mFx = 15 + 22 * kk; mBx = -15 + 34 * kk; mFy = mBy = -6 + 20 * kk; crouch = ws ? -2 : 3; }
        else if (mv === 'heavy') {
          if (mt <= 16) { mFy = mBy = -34 + 2 * (mt % 2); mFx = 12; mBx = -12; tilt = -8; }
          else { const kk = o.act ? k : 1; mFx = 18 + 10 * kk; mBx = 2 + 10 * kk; mFy = mBy = -34 + 56 * kk; crouch = 4 * kk; tilt = 6; }
        } else if (mv === 'air') { const kk = ws ? -0.3 : (o.act ? k : 1); mFx = 2 + 26 * kk; mFy = 4 - 10 * Math.sin(kk * Math.PI); mBx = -16; mBy = -4; }
        else if (mv === 'down') { mFy = mBy = 22; mFx = 12; mBx = -12; legY = 22; }
        else if (mv === 'special' || mv === 'ultimate') {
          const sp = v.sp;
          if (sp.phase === 'dive') { tilt = 30; mFx = 20; mBx = -8; mFy = mBy = -16; }
          else if (sp.phase === 'burst' || sp.phase === 'recover') { crouch = 6; mFy = mBy = 22; mFx = 20; mBx = -20; }
          else { crouch = 6; mFy = mBy = -10 + (mt % 4); mFx = 16; mBx = -16; tilt = -6; }    // wind-up: mitts raised
        }
      }
      bob += crouch;
      // apply
      r.torso.y = -3 + bob; r.torso.rot = tilt * DEG * 0.3;
      r.head.y = bob; r.head.x = tilt * 0.2; for (let i = 0; i < 4; i++) r.rivets[i].y = -21 + bob;
      r.eyeA.y = r.eyeB.y = -25 + bob; r.eyeA.h = r.eyeB.h = blink ? 0.3 : (oc ? 5 : 3); r.eyeA.w = r.eyeB.w = oc ? 5 : 3; r.eyeA.x = 4 + tilt * 0.2; r.eyeB.x = 10 + tilt * 0.2;
      r.dial.y = 2 + bob; for (let i = 0; i < 4; i++) { const a = (i * 90 + dialSpin) * DEG; setLine(r.ticks[i], 2 + Math.cos(a) * 3, 2 + bob + Math.sin(a) * 3, 2 + Math.cos(a) * 6.5, 2 + bob + Math.sin(a) * 6.5); }
      r.dialGlow.off = !oc; r.dialGlow.y = 2 + bob;
      for (let i = 0; i < 6; i++) { const c = r.cracks[i]; c.off = !oc; if (oc) { const a = (i * 61) % 360 * DEG; setLine(c, -4 + Math.cos(a) * 4, bob - 4 + Math.sin(a) * 4, -4 + Math.cos(a) * 15, bob - 4 + Math.sin(a) * 13); } }
      r.mittF.x = mFx; r.mittF.y = mFy; r.mittF.rot = mRot; setLine(r.armF, 14, -14 + bob, mFx, mFy - 10);
      r.mittB.x = mBx; r.mittB.y = mBy; r.mittB.rot = mRot; setLine(r.armB, -14, -14 + bob, mBx, mBy - 10);
      for (let i = 0; i < 3; i++) { setLine(r.knF[i], mFx - 5, mFy + 4 + i * 2, mFx + 5, mFy + 4 + i * 2); setLine(r.knB[i], mBx - 5, mBy + 4 + i * 2, mBx + 5, mBy + 4 + i * 2); }
      r.legF.x = legFx; r.legF.y = legY; r.legB.x = legBx; r.legB.y = legY;
      return tilt;
    },
    extras: function (ctx, v, pal) {
      const mv = v.moveName, m = v.move;
      if (m && isActive(v) && (mv === 'light1' || mv === 'light2' || mv === 'air')) { // grey smear behind the mitt
        ctx.save(); ctx.globalAlpha *= 0.45; ctx.fillStyle = pal.base; ctx.beginPath(); ctx.ellipse(mv === 'light2' ? 10 : 20, mv === 'air' ? 2 : 8, 16, 9, 0, 0, TAU); ctx.fill(); ctx.restore();
      } else if (m && mv === 'heavy' && v.moveT > 16 && v.moveT <= 24) {
        smear(ctx, 20, 20, 24, Math.PI * 1.05, Math.PI * 1.6, pal.accent, 0.5); smear(ctx, 30, 22, 18, Math.PI * 1.05, Math.PI * 1.6, pal.accent, 0.35);
      } else if (m && (mv === 'light3') && isActive(v)) { smear(ctx, 24, 6, 28, -0.3, 0.9, pal.accent, 0.5); }
      else if (m && (mv === 'special' || mv === 'ultimate') && v.sp.phase === 'burst') {
        const R0 = m.ringR, k = Math.min(1, v.sp.t / Math.max(1, m.a)), n = mv === 'ultimate' ? 3 : 1;
        ctx.save(); ctx.strokeStyle = pal.glow; ctx.lineWidth = 3;
        for (let i = 0; i < n; i++) { const kk = Math.max(0, k - i * 0.2); ctx.globalAlpha = 0.8 * (1 - kk); ctx.beginPath(); ctx.ellipse(0, v.h / 2, R0 * kk, R0 * kk * 0.35, 0, 0, TAU); ctx.stroke(); }
        ctx.restore();
      }
    },
  };

  // ---- VELLIX — arrowhead head, single glow eye, crest fin, blade-tipped whip tail ---------------------
  RIGS.vellix = {
    build: function () {
      const L = [], r = { shapes: L };
      r.tail = limb(L, -3, 6, -22, 14, -24, -4, 2, 'shade'); r.tailTip = poly(L, [0, -3, 3, 0, 0, 3, -3, 0], 'accent'); r.tailTip.jit = false;
      r.thighB = line(L, 0, 6, 5, 12, 2, 'shade'); r.shinB = line(L, 5, 12, -3, 20, 2, 'shade'); r.toeB = line(L, -3, 20, 1, 20, 2, 'accent');
      r.torso = rrc(L, 0, -2, 8, 17, 4, 'base'); r.torso.rot = 15 * DEG;
      r.stripes = []; for (let i = 0; i < 3; i++) r.stripes.push(line(L, -3, -7 + i * 5, 3, -7 + i * 5, 1, 'accent'));
      r.thighF = line(L, 0, 6, 6, 12, 2, 'shade'); r.shinF = line(L, 6, 12, -2, 20, 2, 'shade'); r.toeF = line(L, -2, 20, 2, 20, 2, 'accent');
      r.arm = line(L, 2, -6, 8, 0, 2, 'shade'); r.claw1 = line(L, 8, 0, 11, 1, 1.5, 'accent'); r.claw2 = line(L, 8, 0, 10, 3, 1.5, 'accent');
      r.crest = poly(L, [0, -18, -14, -22, -2, -15], 'accent');
      r.crest2 = poly(L, [-2, -17, -22, -26, -4, -14], 'accent'); r.crest3 = poly(L, [-3, -16, -26, -16, -5, -13], 'accent');
      r.head = poly(L, [10, -14, -6, -18, -6, -10], 'base');
      r.eye = ell(L, 4, -14, 2.5, 1.5, 'glow'); r.eye.glow = true; r.eye2 = ell(L, 1, -14, 2, 1.2, 'glow'); r.eye2.glow = true; r.eye2.off = true;
      return r;
    },
    pose: function (r, v) {
      const o = basePose(v), st = o.st, mv = v.moveName, m = v.move, mt = v.moveT, oc = v.ocActive;
      let bob = o.bob, lean = 20, tailCx = -22, tailCy = 14, tailX = -24, tailY = -4, swish = sinT(v.t, 96) * 6, ball = false;
      let kF = 6, kFy = 12, fF = -2, kB = 5, kBy = 12, fB = -3, armX = 8, armY = 0, crestFlat = 0, slit = false;
      if (st === 'idle') { tailX = -24 + swish * 0.3; tailY = -4 + swish; }
      else if (st === 'run' || st === 'dash') { lean = 35; tailCx = -26; tailCy = 6; tailX = -30; tailY = 2; crestFlat = 1; kF = 6 + 7 * o.leg; fF = -2 + 8 * o.leg; kB = 6 - 7 * o.leg; fB = -2 - 8 * o.leg; kFy = 12 - o.knee * 0.4; kBy = 12 - (6 - o.knee) * 0.4; armX = 8 + 3 * o.leg; }
      else if (st === 'jump') { lean = 0; kF = 5; kFy = 10; fF = 2; kB = 3; kBy = 10; fB = 0; tailCx = -12; tailCy = 22; tailX = -2; tailY = 24; armY = -4; }
      else if (st === 'fall') { lean = 30; kF = 7; fF = -6; kB = 4; fB = -8; tailCx = -20; tailCy = -6; tailX = -16; tailY = -26; armX = 4; armY = -6; }
      else if (st === 'cling') { lean = 0; kF = 8; kFy = 10; fF = 6; kB = 6; kBy = 14; fB = 4; armX = 10; armY = -6; tailCx = -16; tailCy = 16; tailX = -14; tailY = 0; }
      else if (st === 'hurt') { ball = true; slit = true; }
      if (m) {
        const k = o.k, ws = isStartup(v);
        if (mv === 'light1') { armX = ws ? 4 : 10 + 10 * (o.act ? k : 1); armY = ws ? -2 : -2 + 2 * k; lean = 25; }
        else if (mv === 'light2') { const kk = ws ? -0.3 : (o.act ? k : 1); tailCx = -6 + 30 * kk; tailCy = -22; tailX = 6 + 24 * kk; tailY = -12 - 6 * kk; lean = 15; }
        else if (mv === 'light3') { lean = ws ? 10 : 45; crestFlat = 1; armX = 10; armY = 2; tailCx = -26; tailCy = 4; tailX = -30; tailY = 0; }
        else if (mv === 'heavy') { // backflip-kick: tail blade sweeps a 200° arc
          const kk = ws ? 0 : (o.act ? k : 1); const a = (-110 + 200 * kk) * DEG; lean = -20 - 30 * kk;
          tailCx = Math.cos(a - 0.6) * 18; tailCy = 2 + Math.sin(a - 0.6) * 18; tailX = Math.cos(a) * 28; tailY = 2 + Math.sin(a) * 28;
          kF = 2; kFy = 8; fF = 10 * kk; kB = 0; kBy = 10; fB = -4;
        } else if (mv === 'air') { lean = 360 * (o.act ? k : (ws ? 0 : 1)); tailCx = -20; tailCy = 10; tailX = -26; tailY = -6; kF = 4; fF = 0; kB = 2; fB = -2; }
        else if (mv === 'down') { lean = 0; kF = 3; kFy = 12; fF = 1; kB = -1; kBy = 12; fB = -1; tailCx = -4; tailCy = -10; tailX = 0; tailY = -30; armX = 3; armY = 4; }
        else if (mv === 'special' || mv === 'ultimate') { lean = v.sp.phase === 'slide' || v.sp.phase === 'blink' ? 40 : 30; crestFlat = 1; tailCx = -28; tailCy = 4; tailX = -34; tailY = 2; kF = 8; fF = 2; kB = 4; fB = -6; }
      }
      // apply
      setLimb(r.tail, -3, 6 + bob, tailCx, tailCy + bob, tailX, tailY + bob); r.tailTip.x = tailX; r.tailTip.y = tailY + bob;
      setLine(r.thighF, 0, 6 + bob, kF, kFy + bob); setLine(r.shinF, kF, kFy + bob, fF, 20); setLine(r.toeF, fF, 20, fF + 4, 20);
      setLine(r.thighB, 0, 6 + bob, kB, kBy + bob); setLine(r.shinB, kB, kBy + bob, fB, 20); setLine(r.toeB, fB, 20, fB + 4, 20);
      r.torso.y = -2 + bob; r.torso.rot = (15 + lean * 0.2) * DEG; r.torso.w = ball ? 16 : 8; r.torso.h = ball ? 16 : 17; r.torso.r = ball ? 8 : 4;
      for (let i = 0; i < 3; i++) { const s = r.stripes[i]; s.off = ball; setLine(s, -3 + i, -7 + i * 5 + bob, 3 + i, -8 + i * 5 + bob); }
      setLine(r.arm, 2, -6 + bob, armX, armY + bob); setLine(r.claw1, armX, armY + bob, armX + 3, armY + 1 + bob); setLine(r.claw2, armX, armY + bob, armX + 2, armY + 3 + bob);
      const hy = (ball ? -6 : 0) + bob;
      r.head.y = hy; r.eye.y = -14 + hy; r.eye.h = slit ? 0.4 : (1.5 + 0.4 * sinT(v.t, 60)); r.eye2.off = !oc; r.eye2.y = -14 + hy; r.eye2.h = r.eye.h * 0.8;
      r.crest.y = hy; r.crest2.y = hy; r.crest3.y = hy;
      setPt(r.crest, 1, oc ? -22 : -14, crestFlat ? -19 : -22); r.crest2.off = !oc; r.crest3.off = !oc;
      return lean * 0.35;
    },
    extras: function (ctx, v, pal) {
      const mv = v.moveName, m = v.move;
      if (m && isActive(v) && mv === 'light1') { ctx.save(); ctx.strokeStyle = pal.glow; ctx.lineWidth = 1.5; ctx.globalAlpha *= 0.8; ctx.beginPath(); ctx.moveTo(10, -10); ctx.lineTo(42, 10); ctx.stroke(); ctx.restore(); }
      else if (m && isActive(v) && mv === 'light3') { ctx.save(); ctx.strokeStyle = pal.glow; ctx.lineWidth = 1.5; ctx.globalAlpha *= 0.8; ctx.beginPath(); ctx.moveTo(14, -16); ctx.lineTo(56, -2); ctx.moveTo(12, -8); ctx.lineTo(54, 6); ctx.stroke(); ctx.restore(); }
      else if (m && mv === 'heavy' && v.moveT > 9 && v.moveT <= 16) { const k = Math.min(1, (v.moveT - 9) / 5); smear(ctx, 4, -2, 26, (-110 + 200 * k - 60) * DEG, (-110 + 200 * k) * DEG, pal.accent, 0.6); }
      else if (m && mv === 'light2' && isActive(v)) smear(ctx, 10, -8, 22, -1.4 + 1.2 * activeK(v), -0.8 + 1.2 * activeK(v), pal.accent, 0.5);
      else if (m && mv === 'air' && isActive(v)) { smear(ctx, 0, 0, 26, 0, TAU, pal.glow, 0.3); }
    },
  };

  // ---- ORRUBEL — hooded bell of stacked rings, wide visor, two antenna-whips, peg legs ----------------
  const RING_W = [14, 17, 20, 23, 26, 28, 30], RING_Y = [-10, -4, 2, 8, 14, 18, 22];
  RIGS.orrubel = {
    build: function () {
      const L = [], r = { shapes: L };
      r.ant = []; r.beads = [];
      for (let i = 0; i < 4; i++) { r.ant.push(limb(L, 10, -18, -18, -30, -22, -30, 2, 'shade')); r.beads.push(dot(L, -22, -30, 1.5, 'accent', false)); }
      r.legB = line(L, -6, 14, -6, 22, 3, 'shade'); r.footB = dot(L, -6, 22, 2, 'shade', false);
      r.legF = line(L, 6, 14, 6, 22, 3, 'shade'); r.footF = dot(L, 6, 22, 2, 'shade', false);
      r.hood = ell(L, 0, -15, 11, 7.5, 'base');
      r.spine = line(L, 0, -8, 0, 12, 2, 'glow'); r.spine.glow = true; r.spine.ink = false;
      r.rings = []; r.ringEdges = [];
      for (let i = 0; i < 7; i++) { r.rings.push(rrc(L, 0, RING_Y[i], RING_W[i], 6, 3, 'base')); }
      for (let i = 0; i < 7; i++) { const e = line(L, -7, 0, 7, 0, 2, 'shade'); e.ink = false; r.ringEdges.push(e); }
      r.visor = rrc(L, 0, -17, 16, 4, 1.5, 'glow'); r.visor.glow = true;
      r.visor2 = rrc(L, 0, -17, 16, 2, 1, 'glow'); r.visor2.glow = true; r.visor3 = rrc(L, 0, -17, 16, 2, 1, 'glow'); r.visor3.glow = true;
      r.pupil = rrc(L, 4, -17, 2, 2, 0.5, 'shade'); r.pupil.ink = false;
      return r;
    },
    pose: function (r, v) {
      const o = basePose(v), st = o.st, mv = v.moveName, m = v.move, mt = v.moveT, oc = v.ocActive;
      let bob = o.bob, tilt = 0, pitch = 1, legFy = 22, legBy = 22, legFx = 6, legBx = -6, wob = 0, scan = Math.sin(v.t / 180 * TAU) * 4, visorDark = false;
      // antenna tips (two front/back pairs): front (f) and back (b), plus control points
      let fx = -22, fy = -30, fcx = -18, fcy = -30, bx = -20, by = -27, bcx = -18, bcy = -30;
      if (st === 'idle') { fy = -26 + sinT(v.t, 120); by = -24 - sinT(v.t, 120); }
      else if (st === 'run' || st === 'dash') { tilt = 12; const ph2 = (v.t % 4) / 4 * TAU; legFy = 22 - 3 * Math.max(0, Math.sin(ph2)); legBy = 22 - 3 * Math.max(0, -Math.sin(ph2)); legFx = 6 + 3 * Math.sin(ph2); legBx = -6 - 3 * Math.sin(ph2); wob = 1; fx = -30; fy = -20; bx = -28; by = -16; fcx = -16; fcy = -26; bcx = -14; bcy = -24; }
      else if (st === 'jump') { pitch = 0.66; fx = 8; fy = -40; fcx = 6; fcy = -30; bx = -8; by = -40; bcx = -6; bcy = -30; legFy = legBy = 19; }
      else if (st === 'fall') { pitch = 1.33; fx = 26; fy = -22; fcx = 14; fcy = -30; bx = -26; by = -22; bcx = -14; bcy = -30; legFx = 8; legBx = -8; }
      else if (st === 'cling') { fx = 18; fy = -30; fcx = 10; fcy = -34; bx = -14; by = -32; legFx = 9; legFy = 19; }
      else if (st === 'hurt') { visorDark = v.stateT < 4; wob = 2; fx = 20; fy = -14; bx = 16; by = -8; }
      if (m) {
        const k = o.k, ws = isStartup(v);
        if (mv === 'light1' || mv === 'light2' || mv === 'light3' || mv === 'air') {
          const reach = m.box[0] + m.box[2] / 2 - 4, kk = ws ? -0.2 : (o.act ? 1 : 0.6);
          const ty = m.box[1] + (mv === 'air' ? -6 : 0);
          if (mv === 'light1' || mv === 'light3' || mv === 'air') { fx = 10 + (reach - 10) * kk; fy = ws ? -34 : ty - 4 + 6 * k; fcx = fx * 0.5; fcy = -30; }
          if (mv === 'light2' || mv === 'light3' || mv === 'air') { bx = 10 + (reach - 10) * kk; by = ws ? -36 : ty + 6 - 6 * k; bcx = bx * 0.5; bcy = -34; }
          tilt = 6;
        } else if (mv === 'heavy') { tilt = ws ? -6 : 8; fx = 20; fy = -34; bx = -24; by = -30; }
        else if (mv === 'special' || mv === 'ultimate') { fx = 34; fy = -14; fcx = 20; fcy = -28; bx = 30; by = -10; bcx = 16; bcy = -24; visorDark = false; }
        else if (mv === 'down') { pitch = 0.6; legFy = legBy = 26; legFx = 3; legBx = -3; fx = 6; fy = -42; bx = -6; by = -42; }
      }
      // apply
      const nAnt = oc ? 4 : 2;
      for (let i = 0; i < 4; i++) {
        const a = r.ant[i], b = r.beads[i];
        if (i >= nAnt) { a.off = b.off = true; continue; }
        a.off = b.off = false;
        const front = (i % 2) === 0, spread = i >= 2 ? 6 : 0;
        const tx = (front ? fx : bx) + spread, ty = (front ? fy : by) - spread * 0.5, cx = (front ? fcx : bcx), cy = (front ? fcy : bcy) - spread;
        setLimb(a, front ? 10 : -10, -18 + bob, cx, cy + bob, tx, ty + bob); b.x = tx; b.y = ty + bob;
      }
      setLine(r.legF, legFx, 14 + bob, legFx, legFy); r.footF.x = legFx; r.footF.y = legFy;
      setLine(r.legB, legBx, 14 + bob, legBx, legBy); r.footB.x = legBx; r.footB.y = legBy;
      const nR = oc ? 7 : 5, ringOut = v.sp && v.sp.ringOut;
      for (let i = 0; i < 7; i++) {
        const rg = r.rings[i], e = r.ringEdges[i];
        const off = i >= nR || (i === 0 && ringOut);
        rg.off = e.off = off; if (off) continue;
        const wx = wob ? Math.sin(v.t / 3 + i) * wob : (st === 'idle' ? sinT(v.t + i * 20, 120) * (i % 2 ? 1 : -1) : 0);
        const y = -10 + (RING_Y[i] + 10) * pitch + bob;
        rg.x = wx + tilt * 0.08 * (14 - RING_Y[i]); rg.y = y; rg.w = RING_W[i];
        setLine(e, rg.x - RING_W[i] / 2 + 2, y + 3, rg.x + RING_W[i] / 2 - 2, y + 3);
      }
      r.spine.off = false; setLine(r.spine, 0, -8 * pitch + bob, 0, 12 * pitch + bob);
      r.hood.y = -15 + bob; r.hood.x = tilt * 0.25;
      r.visor.y = -17 + bob; r.visor.x = tilt * 0.25; r.visor.off = oc; r.visor.fill = visorDark ? 'shade' : 'glow';
      r.visor2.off = r.visor3.off = !oc; r.visor2.y = -18.5 + bob; r.visor3.y = -15.5 + bob; r.visor2.x = r.visor3.x = tilt * 0.25;
      r.pupil.x = 4 + scan + tilt * 0.25; r.pupil.y = -17 + bob; r.pupil.off = visorDark || oc;
      return tilt;
    },
    extras: function (ctx, v, pal) {
      const mv = v.moveName, m = v.move;
      if (m && isActive(v) && (mv === 'light1' || mv === 'light2' || mv === 'light3' || mv === 'air')) {
        const reach = m.box[0] + m.box[2] / 2 - 4;
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = pal.glow; ctx.globalAlpha *= 0.9;
        ctx.beginPath(); ctx.arc(reach, m.box[1], 4, 0, TAU); ctx.fill();
        if (mv === 'light3' || mv === 'air') { ctx.beginPath(); ctx.arc(reach - 6, m.box[1] + 8, 4, 0, TAU); ctx.fill(); }
        ctx.restore();
        if (mv === 'air') smear(ctx, 14, -4, 30, -2.2 + 2 * activeK(v), -1.4 + 2 * activeK(v), pal.accent, 0.5);
      } else if (m && (mv === 'special' || mv === 'ultimate') && v.moveT <= 2) { ctx.save(); ctx.fillStyle = '#FFFFFF'; Rn.rrect(ctx, -8, -19, 16, 4, 1.5); ctx.fill(); ctx.restore(); }
    },
  };

  // ---- KORVASK — banded barrel, low dome with three eye slits, chain arms with clamp jaws -------------
  RIGS.korvask = {
    build: function () {
      const L = [], r = { shapes: L };
      r.chainB = []; for (let i = 0; i < 5; i++) r.chainB.push(arc(L, 0, 0, 2.5, 0, TAU, 1.5, 'accent'));
      r.clampB1 = arc(L, 0, 0, 6, 0.6, Math.PI - 0.6, 3, 'accent'); r.clampB2 = arc(L, 0, 0, 6, Math.PI + 0.6, TAU - 0.6, 3, 'accent');
      r.legB = rrc(L, -7, 21, 10, 14, 3, 'shade'); r.footB = rrc(L, -7, 27, 12, 4, 1, 'shade');
      r.legF = rrc(L, 7, 21, 10, 14, 3, 'shade'); r.footF = rrc(L, 7, 27, 12, 4, 1, 'shade');
      r.head = ell(L, 0, -16, 10, 10, 'base');
      r.crest = poly(L, [-6, -25, 0, -30, 6, -25], 'accent'); r.crest.off = true;
      r.eyes = []; for (let i = 0; i < 3; i++) { const e = rrc(L, -4 + i * 6, -21, 4, 2, 0.5, 'glow'); e.glow = true; r.eyes.push(e); }
      r.shB = rrc(L, -16, -14, 10, 8, 3, 'shade');
      r.torso = rrc(L, 0, -1, 26, 30, 6, 'base');
      r.bands = []; for (let i = 0; i < 3; i++) r.bands.push(line(L, -13, -10 + i * 10, 13, -10 + i * 10, 2, 'accent'));
      r.seam = line(L, 0, -15, 0, 13, 1, 'shade'); r.seam.ink = false;
      r.shF = rrc(L, 16, -14, 10, 8, 3, 'shade');
      r.chainF = []; for (let i = 0; i < 5; i++) r.chainF.push(arc(L, 0, 0, 2.5, 0, TAU, 1.5, 'accent'));
      r.clampF1 = arc(L, 0, 0, 6, 0.6, Math.PI - 0.6, 3, 'accent'); r.clampF2 = arc(L, 0, 0, 6, Math.PI + 0.6, TAU - 0.6, 3, 'accent');
      return r;
    },
    pose: function (r, v) {
      const o = basePose(v), st = o.st, mv = v.moveName, m = v.move, mt = v.moveT, oc = v.ocActive;
      let bob = o.bob, tilt = 0, sqY = 1, legFx = 7, legBx = -7;
      const sway = sinT(v.t, 84) * 2;
      // clamp (hand) positions + jaw gap (0 closed .. 1 wide) + chain bend
      let hFx = 18 + sway, hFy = 12, hBx = -18 - sway, hBy = 12, gapF = 0.6, gapB = 0.6, bendF = 0, bendB = 0, rotF = 0, rotB = 0, slitBright = 1;
      if (st === 'idle') { slitBright = 1; }
      else if (st === 'run' || st === 'dash') { tilt = 6; hFx = 18 - 8 * o.leg; hFy = 12 - 3 * Math.abs(o.leg); hBx = -18 - 8 * o.leg; hBy = 12 - 3 * Math.abs(o.leg); legFx = 7 + 5 * o.leg; legBx = -7 - 5 * o.leg; bob = o.bob; }
      else if (st === 'jump') { hFx = 17; hFy = 14; hBx = -17; hBy = 14; legFx = 5; legBx = -5; tilt = -4; gapF = gapB = 0.3; }
      else if (st === 'fall') { hFx = 20; hFy = -22; hBx = -20; hBy = -22; legFx = 10; legBx = -10; gapF = gapB = 1; rotF = -90; rotB = -90; }
      else if (st === 'cling') { hFx = 22; hFy = -16; hBx = -12; hBy = 10; gapF = 0.1; legFx = 9; legBx = -3; }
      else if (st === 'hurt') { tilt = -20; hFx = 24; hFy = -8; hBx = 6; hBy = -14; slitBright = ((v.t >> 1) & 1) ? 0.3 : 1; }
      if (m) {
        const k = o.k, ws = isStartup(v), sp = v.sp;
        if (mv === 'light1') { const kk = ws ? -0.2 : (o.act ? 1 : 0.7); hFx = 16 + 36 * kk; hFy = 2; gapF = ws ? 0.8 : (o.act ? 0 : 0.2); bendF = 0; }
        else if (mv === 'light2') { const kk = ws ? -0.2 : (o.act ? 1 : 0.7); hBx = 10 + 30 * kk; hBy = 10 - 14 * kk; gapB = ws ? 0.8 : (o.act ? 0 : 0.2); rotB = -60 * kk; }
        else if (mv === 'light3') { const kk = ws ? 0 : (o.act ? 1 - 0.5 * k : 0.3); hFx = 14 + 44 * kk; hBx = 10 + 44 * kk; hFy = -2; hBy = 4; gapF = gapB = ws ? 0.9 : 0; tilt = 6; }
        else if (mv === 'heavy') {
          if (mt <= 14) { hFx = 10; hBx = -10; hFy = hBy = -34 + (mt % 2); gapF = gapB = 0.9; tilt = -6; }
          else { const kk = o.act ? k : 1; sqY = 0.85; hFx = 10 + 26 * kk; hBx = -4 + 26 * kk; hFy = hBy = -34 + 60 * kk; gapF = gapB = 0.2; tilt = 8; bob += 8 * kk; }
        } else if (mv === 'air') { const kk = ws ? -0.3 : (o.act ? k : 1); const a = (150 - 150 * kk) * DEG; hFx = 4 + Math.cos(a) * 30; hFy = 4 + Math.sin(a) * 26; gapF = 0.9; hBx = -14; hBy = -8; }
        else if (mv === 'down') { hFx = 10; hBx = -10; hFy = hBy = 26; gapF = gapB = 0.1; rotF = rotB = 90; legFx = 5; legBx = -5; }
        else if (mv === 'special') { // stance: clamps crossed in front
          if (sp.phase === 'stance' || sp.phase === 'raise') { hFx = 14; hFy = -6; hBx = 14; hBy = 2; gapF = gapB = 0.4; rotF = 45; rotB = -45; legFx = 10; legBx = -10; }
          else if (sp.phase === 'whiff') { hFx = 16; hFy = 10; hBx = -10; hBy = 12; gapF = gapB = 0.8; tilt = 4; }
        } else if (mv === 'counter') { const kk = ws ? 0 : (o.act ? k : 1); hFx = 8 + 30 * kk; hBx = 0 + 30 * kk; hFy = -30 + 44 * kk; hBy = -26 + 44 * kk; gapF = gapB = 0.15; tilt = 10 * kk; sqY = 1 - 0.1 * kk; }
        else if (mv === 'ultimate') {
          const sp2 = v.sp;
          if (sp2.phase === 'wind') { hFx = 6; hBx = -6; hFy = hBy = -8; gapF = gapB = 1; tilt = -6; }
          else if (sp2.phase === 'lunge') { hFx = 36; hBx = 30; hFy = -4; hBy = 6; gapF = gapB = 1; tilt = 18; }
          else if (sp2.phase === 'press') { hFx = 24; hBx = 20; hFy = -6; hBy = 4; gapF = gapB = 0; tilt = 4; }
          else if (sp2.phase === 'slam') { hFx = 30; hBx = 26; hFy = 20; hBy = 22; gapF = gapB = 0.1; tilt = 12; sqY = 0.9; }
          else { hFx = 20; hBx = -16; hFy = 14; hBy = 12; gapF = gapB = 0.6; }
        }
      }
      // apply
      r.torso.y = -1 + bob; r.torso.h = 30 * sqY; r.torso.rot = tilt * DEG * 0.25;
      for (let i = 0; i < 3; i++) { const b = r.bands[i]; setLine(b, -13, (-10 + i * 10) * sqY + bob - 1, 13, (-10 + i * 10) * sqY + bob - 1); b.glow = oc; b.ink = !oc; }
      setLine(r.seam, 0, -15 * sqY + bob, 0, 13 * sqY + bob);
      r.head.y = -16 + bob - (1 - sqY) * 14; r.head.x = tilt * 0.2; r.crest.off = !oc; r.crest.y = r.head.y + 16; r.crest.x = r.head.x;
      for (let i = 0; i < 3; i++) { const e = r.eyes[i]; e.y = -21 + bob - (1 - sqY) * 14; e.x = -4 + i * 6 + tilt * 0.2; const seq = ((v.t / 40) | 0) % 3; e.alpha = slitBright * (st === 'idle' && seq === i ? 1 : 0.7); }
      r.shF.y = -14 + bob; r.shB.y = -14 + bob;
      // chains: links spread from the shoulder to the clamp, bent sideways
      const nL = oc ? 5 : 4;
      for (let i = 0; i < 5; i++) {
        const cf = r.chainF[i], cb = r.chainB[i];
        if (i >= nL) { cf.off = cb.off = true; continue; }
        cf.off = cb.off = false;
        const k = (i + 1) / (nL + 1), bendK = Math.sin(k * Math.PI);
        cf.x = 16 + (hFx - 16) * k + bendF * bendK; cf.y = -10 + bob + (hFy - (-10 + bob)) * k; cf.h = 2; cf.w = 2.5;
        cb.x = -16 + (hBx + 16) * k + bendB * bendK; cb.y = -10 + bob + (hBy - (-10 + bob)) * k; cb.h = 2; cb.w = 2.5;
      }
      const gF = 0.2 + gapF * 1.1, gB = 0.2 + gapB * 1.1, rf = rotF * DEG, rb = rotB * DEG;
      r.clampF1.x = r.clampF2.x = hFx; r.clampF1.y = r.clampF2.y = hFy; r.clampF1.a0 = rf + gF; r.clampF1.a1 = rf + Math.PI - gF; r.clampF2.a0 = rf + Math.PI + gF; r.clampF2.a1 = rf + TAU - gF;
      r.clampB1.x = r.clampB2.x = hBx; r.clampB1.y = r.clampB2.y = hBy; r.clampB1.a0 = rb + gB; r.clampB1.a1 = rb + Math.PI - gB; r.clampB2.a0 = rb + Math.PI + gB; r.clampB2.a1 = rb + TAU - gB;
      r.legF.x = legFx; r.footF.x = legFx; r.legB.x = legBx; r.footB.x = legBx;
      return tilt;
    },
    extras: function (ctx, v, pal) {
      const mv = v.moveName, m = v.move;
      if (m && isActive(v) && (mv === 'light1' || mv === 'light2' || mv === 'light3')) { // snap spark at the far clamp
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = pal.glow; ctx.beginPath(); ctx.arc(m.box[0] + m.box[2] / 2 - 10, m.box[1], 3, 0, TAU); ctx.fill(); ctx.restore();
        if (mv === 'light3') smear(ctx, 20, 2, 26, -0.4, 0.4, pal.accent, 0.5);
      } else if (m && (mv === 'heavy' || mv === 'counter') && isActive(v)) { smear(ctx, 24, 18, 22, Math.PI * 1.1, Math.PI * 1.7, pal.accent, 0.6); }
      else if (m && mv === 'air' && isActive(v)) smear(ctx, 8, 10, 28, 0.2 + 1.6 * activeK(v), 1.0 + 1.6 * activeK(v), pal.accent, 0.5);
      else if (m && mv === 'special' && (v.sp.phase === 'stance' || v.sp.phase === 'raise')) {
        ctx.save(); ctx.globalAlpha *= v.sp.flash > 0 ? 0.9 : 0.3; ctx.fillStyle = v.sp.flash > 0 ? '#FFFFFF' : pal.glow;
        ctx.beginPath(); ctx.ellipse(14, -2, 20, 30, 0, 0, TAU); ctx.fill(); ctx.restore();
      } else if (m && mv === 'ultimate' && v.sp.phase === 'slam') { smear(ctx, 30, 20, 30, Math.PI * 1.1, Math.PI * 1.8, pal.glow, 0.6); }
    },
  };
  for (const id in RIGS) RIGS[id].rig = RIGS[id].build();   // shared rig per fighter (one player at a time; previews reuse it)

  // =====================================================================================
  // Player-owned projectiles (CONTRACT §7): pooled per player, re-armed by spawn()
  // =====================================================================================
  /** "Local" hitstop (DESIGN §3.0): freeze only the victim's AI counters, never the world. */
  /** Shared scratch options for per-frame FX.spawn/burst calls (FX reads the fields synchronously). */
  const FXO = { vx: 0, vy: 0, life: 20, size: 3, size2: undefined, color: '#FFFFFF', grav: 0, drag: 1, dir: 0, radius: 0, n: 0 };
  function fxDot(x, y, vx, vy, life, size, color) { FXO.vx = vx; FXO.vy = vy; FXO.life = life; FXO.size = size; FXO.size2 = undefined; FXO.color = color; FXO.grav = 0; FXO.drag = 1; FX.spawn('dot', x, y, FXO); }
  function localStun(victim, n) {
    if (!victim || victim.hitstun === undefined || n <= 0) return;
    if (victim.kbResist > 0) victim.hitstun += n;
    if (victim.flash !== undefined && victim.flash < 4) victim.flash = 4;
  }
  function makeProj(w, h, kindTag) {
    const p = new E({ x: 0, y: 0, w: w, h: h, units: 'pxf' });
    p.owner = 'player'; p.collideTiles = false; p.ignoreOneWay = true; p.dead = true; p.life = 0;
    p.hit = E.makeHit('player'); p.hit.src = p; p.hit.kind = 'projectile'; p.hit.flags = 2; p.hit.tag = kindTag;
    return p;
  }
  function fillHit(h, dmg, kb, energy, meter, facing) { h.dmg = dmg; h.kbx = kb[0]; h.kby = kb[1]; h.energy = energy; h.meter = meter; h.facing = facing; h.hitstop = 0; h.shake = 0; h.shakeFrames = 0; h.multi = false; }
  function registerBox(game, p, h) { h.x = p.x - p.w / 2; h.y = p.y - p.h; h.w = p.w; h.h = p.h; game.registerHit(h); }
  function footingAt(level, tx, ty) { const ch = E.tileAt(level, tx, ty); return ch === '#' || ch === 'c' || ch === '-'; }
  // Footing along the feet line y: '#'/'c'/'-' tiles when y is a tile top, plus every mover whose top is y (DESIGN §3.0: a mover is a floor)
  function feetRow(y) { const r = Math.round(y / TILE); return Math.abs(y - r * TILE) < 0.5 ? r : -1; }
  /** Pixels of [x−hw, x+hw] standing over footing at the feet line y. */
  function footOverlap(level, y, x, hw) {
    const row = feetRow(y), ps = level.platforms;
    let ov = 0;
    if (row >= 0) { const c0 = Math.floor((x - hw) / TILE), c1 = Math.floor((x + hw - 0.001) / TILE); for (let c = c0; c <= c1; c++) if (footingAt(level, c, row)) ov += Math.min(x + hw, (c + 1) * TILE) - Math.max(x - hw, c * TILE); }
    for (let i = 0; i < ps.length; i++) { const p = ps[i]; if (Math.abs(p.y - y) > 0.5) continue; const o = Math.min(x + hw, p.x + p.w) - Math.max(x - hw, p.x); if (o > 0) ov += o; }
    return ov;
  }
  /** From the point x, the far edge (along f) of the unbroken footing run under it at the feet line y (x itself when x is over none). */
  function footEdge(level, y, x, f) {
    const row = feetRow(y), ps = level.platforms;
    let e = x;
    for (let n = 0; n < 16; n++) {
      const probe = f > 0 ? e : e - 0.001;
      let next = e;
      if (row >= 0) { const c = Math.floor(probe / TILE); if (footingAt(level, c, row)) next = f > 0 ? (c + 1) * TILE : c * TILE; }
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i]; if (Math.abs(p.y - y) > 0.5 || probe < p.x || probe >= p.x + p.w) continue;
        const pe = f > 0 ? p.x + p.w : p.x; if ((pe - next) * f > 0) next = pe;
      }
      if (next === e) break;
      e = next;
    }
    return e;
  }

  // ---- Tessik: Pulse Line — a 26×26 wedge sliding along the floor ----
  function PulseLine(owner) {
    const p = makeProj(26, 26, 'pulse');
    p.pl = owner; p.dir = 1; p.travelled = 0; p.spec = owner.data.moves.special.proj;
    p.hit.onHit = function (victim, result, game) { localStun(victim, p.spec.local); };
    p.spawn = function (game) {
      const s = this.spec, o = this.pl;
      this.x = o.x + 16 * o.facing; this.y = o.y; this.px = this.x; this.py = this.y; this.dir = o.facing; this.facing = o.facing;
      this.travelled = 0; this.life = 0; this.dead = false; this.hit.hitList.length = 0;
      fillHit(this.hit, o.dmgOf(s.dmg), s.kb, 0, s.meter, o.facing); this.hit.shake = 4; this.hit.shakeFrames = 8;
      game.spawnProjectile(this);
    };
    p.update = function (game) {
      if (this.dead) return;
      const s = this.spec, lv = game.level, step = s.speed / 60;
      this.life++; this.x += step * this.dir; this.travelled += step;
      const hw = this.w / 2, c0 = Math.floor((this.x - hw) / TILE), c1 = Math.floor((this.x + hw - 0.001) / TILE);
      if (E.overlapsSolid(lv, this.x - hw, this.y - this.h + 2, this.w, this.h - 4)) { this.dead = true; return; }   // wall
      const row = Math.floor((this.y + 0.5) / TILE);
      let fy = Infinity;
      for (let tx = c0; tx <= c1; tx++) if (footingAt(lv, tx, row)) { fy = row * TILE; break; }
      // a mover is a floor (DESIGN §3.0): the wave rides the top of one under it (within a few px above, or up to one tile below)
      const ps = lv.platforms;
      for (let i = 0; i < ps.length; i++) {
        const q = ps[i];
        if (this.x + hw <= q.x || this.x - hw >= q.x + q.w || q.y < this.y - 8 || q.y > this.y + TILE + 0.5) continue;
        if (q.y < fy) fy = q.y;
      }
      if (fy === Infinity) { // step down at most one tile, else the wave dies at the drop
        for (let tx = c0; tx <= c1; tx++) if (footingAt(lv, tx, row + 1)) { fy = (row + 1) * TILE; break; }
      }
      if (fy === Infinity) { this.dead = true; return; }
      this.y = fy;
      if (this.travelled >= s.range || this.life >= s.life) { this.dead = true; return; }
      registerBox(game, this, this.hit);
      if ((this.life & 3) === 0) fxDot(this.x - this.dir * 10, this.y - 4, 0, -0.3, 14, 2, this.pl.curPal.glow);
    };
    p.draw = function (ctx, game, alpha) {
      if (this.dead) return;
      const x = U.lerp(this.px, this.x, alpha), y = U.lerp(this.py, this.y, alpha), pal = this.pl.curPal;
      ctx.save(); ctx.translate(x, y); ctx.scale(this.dir, 1);
      ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = P.INK; ctx.fillStyle = pal.accent;
      const wob = 2 * Math.sin(this.life * 0.8);
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-12, -24 + wob); ctx.lineTo(-6, -10); ctx.lineTo(-13, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = pal.glow; ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(8, -2); ctx.lineTo(-6, -16 + wob); ctx.lineTo(-4, -4); ctx.closePath(); ctx.fill();
      ctx.restore();
    };
    return p;
  }

  /**
   * How far (px, up to `max`) a Pulse Line fired now would travel before its floor runs out: the same footing rule as
   * its update (the feet row, a one-tile step down, or a mover) sampled at its 7 px/frame stride from the spawn point.
   */
  const PULSE_MIN_RUN = 30;
  function pulseRunway(pl, game, max) {
    const lv = game.level, f = pl.facing, hw = 13, step = pl.data.moves.special.proj.speed / 60, ps = lv.platforms;
    let y = pl.y;
    for (let t = step; t <= max + step; t += step) {
      const x = pl.x + 16 * f + t * f, c0 = Math.floor((x - hw) / TILE), c1 = Math.floor((x + hw - 0.001) / TILE);
      const row = Math.floor((y + 0.5) / TILE);
      let fy = Infinity;
      for (let tx = c0; tx <= c1; tx++) if (footingAt(lv, tx, row)) { fy = row * TILE; break; }
      for (let i = 0; i < ps.length; i++) { const q = ps[i]; if (x + hw <= q.x || x - hw >= q.x + q.w || q.y < y - 8 || q.y > y + TILE + 0.5) continue; if (q.y < fy) fy = q.y; }
      if (fy === Infinity) for (let tx = c0; tx <= c1; tx++) if (footingAt(lv, tx, row + 1)) { fy = (row + 1) * TILE; break; }
      if (fy === Infinity) return t - step;
      y = fy;
    }
    return max;
  }

  // ---- Orrubel: Ring Toss — out 220 px, then homes back to the body ----
  function Ring(owner) {
    const spec = owner.data.moves.heavy.ring;
    const p = makeProj(spec.w, spec.h, 'ring');
    p.pl = owner; p.spec = spec; p.dir = 1; p.leg = 0; p.travelled = 0; p.vx = 0; p.vy = 0;
    p.hitBack = E.makeHit('player'); p.hitBack.src = p; p.hitBack.kind = 'projectile'; p.hitBack.flags = 2; p.hitBack.tag = 'ringBack';
    p.hit.onHit = p.hitBack.onHit = function (victim, result, game) { localStun(victim, spec.local); };
    p.spawn = function (game) {
      const o = this.pl;
      this.x = o.x + spec.launch[0] * o.facing; this.y = o.cy() + spec.launch[1] + this.h / 2; this.px = this.x; this.py = this.y;
      this.dir = o.facing; this.facing = o.facing; this.leg = 0; this.travelled = 0; this.life = 0; this.dead = false;
      this.hit.hitList.length = 0; this.hitBack.hitList.length = 0;
      fillHit(this.hit, o.dmgOf(spec.dmgOut), spec.kb, spec.energy, spec.meter, o.facing);
      fillHit(this.hitBack, o.dmgOf(spec.dmgBack), spec.kb, spec.energy, spec.meter, o.facing);
      this.vx = spec.speed / 60 * this.dir; this.vy = 0;
      o.sp.ringOut = true;
      game.spawnProjectile(this);
    };
    p.update = function (game) {
      if (this.dead) return;
      const o = this.pl, lv = game.level, sp = spec.speed / 60;
      this.life++;
      if (this.leg === 0) {
        const nx = this.x + sp * this.dir;
        if (this.travelled + sp >= spec.range || E.overlapsSolid(lv, nx - this.w / 2, this.y - this.h, this.w, this.h)) this.leg = 1;
        else { this.x = nx; this.travelled += sp; }
      }
      if (this.leg === 1) { // re-aimed every frame at the body centre
        const dx = o.x - this.x, dy = o.cy() - this.cy(), d = Math.sqrt(dx * dx + dy * dy);
        if (d <= sp + 2 || E.overlapBox(o, this.x - this.w / 2, this.y - this.h, this.w, this.h)) { this.dead = true; }
        else { this.x += dx / d * sp; this.y += dy / d * sp; this.hitBack.facing = dx >= 0 ? 1 : -1; }
      }
      if (this.life >= spec.life) this.dead = true;
      if (this.dead) { o.sp.ringOut = false; return; }
      registerBox(game, this, this.leg === 0 ? this.hit : this.hitBack);
    };
    p.draw = function (ctx, game, alpha) {
      if (this.dead) return;
      const x = U.lerp(this.px, this.x, alpha), y = U.lerp(this.py, this.y, alpha) - this.h / 2, pal = this.pl.curPal;
      ctx.save(); ctx.translate(x, y); ctx.rotate(this.life * 0.5 * this.dir);
      ctx.lineWidth = 7; ctx.strokeStyle = P.INK; ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, 0, 0, TAU); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = pal.accent; ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, 0, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.5; ctx.strokeStyle = pal.glow; ctx.beginPath(); ctx.ellipse(0, 0, 9, 5, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    };
    return p;
  }

  // ---- Orrubel: Sentry (hovering turret) + Bolt ----
  function Bolt(owner) {
    const p = makeProj(10, 10, 'bolt');
    p.pl = owner; p.spec = null; p.vx = 0; p.vy = 0;
    p.hit.onHit = function (victim, result, game) { localStun(victim, p.spec.local); p.dead = true; };
    p.fire = function (game, x, y, tx, ty, spec) {
      this.spec = spec; this.x = x; this.y = y + this.h / 2; this.px = this.x; this.py = this.y;
      const dx = tx - x, dy = ty - y, d = Math.sqrt(dx * dx + dy * dy) || 1, sp = spec.speed / 60;
      this.vx = dx / d * sp; this.vy = dy / d * sp; this.facing = dx >= 0 ? 1 : -1;
      this.life = 0; this.dead = false; this.hit.hitList.length = 0;
      fillHit(this.hit, spec.dmg, spec.kb, 0, spec.meter, this.facing);   // sheet damage: the Triad is the Overclock form already
      game.spawnProjectile(this);
    };
    p.update = function (game) {
      if (this.dead) return;
      this.life++; this.x += this.vx; this.y += this.vy;
      if (this.life >= this.spec.life || E.overlapsSolid(game.level, this.x - 5, this.y - 10, 10, 10)) { this.dead = true; return; }
      registerBox(game, this, this.hit);
    };
    p.draw = function (ctx, game, alpha) {
      if (this.dead) return;
      const x = U.lerp(this.px, this.x, alpha), y = U.lerp(this.py, this.y, alpha) - 5, pal = this.pl.curPal;
      ctx.save(); ctx.lineCap = 'round';
      ctx.strokeStyle = P.INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - this.vx * 1.5, y - this.vy * 1.5); ctx.stroke();
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - this.vx * 1.5, y - this.vy * 1.5); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = pal.glow; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
      ctx.restore();
    };
    return p;
  }
  function Sentry(owner, idx) {
    const p = makeProj(18, 18, 'sentry');
    p.pl = owner; p.idx = idx; p.spec = null; p.cad = 0; p.aimX = 0; p.aimY = 0; p.aimT = 0;
    p.place = function (game, x, y, spec) {
      const lv = game.level, o = this.pl;
      // clamp out of solid geometry: pull back toward the body until the box is free
      let cx = x, cy = y, tries = 0;
      while (tries++ < 12 && E.overlapsSolid(lv, cx - 9, cy - 9, 18, 18)) { cx += (o.x - cx) * 0.25; cy += (o.cy() - cy) * 0.25; }
      this.x = cx; this.y = cy + 9; this.px = this.x; this.py = this.y;
      this.spec = spec; this.life = 0; this.cad = 0; this.dead = false; this.aimT = 0;
      game.spawnProjectile(this);
    };
    p.update = function (game) {
      if (this.dead) return;
      const spec = this.spec;
      this.life++;
      if (this.life >= spec.life) { this.dead = true; return; }
      if (this.aimT > 0) this.aimT--;
      if (++this.cad >= spec.cadence) {
        this.cad = 0;
        // nearest enemy (or the boss) within range, centre to centre
        let best = null, bd = spec.range * spec.range, bx = 0, by = 0;
        const cx = this.x, cy = this.cy();
        for (let i = 0; i < game.enemies.length; i++) {
          const e = game.enemies[i]; if (e.dead) continue;
          const dx = e.x - cx, dy = e.cy() - cy, d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; best = e; bx = e.x; by = e.cy(); }
        }
        const b = game.boss;
        if (b && b.active && !b.dead) { const dx = b.x - cx, dy = b.cy() - cy, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = b; bx = b.x; by = b.cy(); } }
        if (best) {
          const bolt = this.pl.freeBolt();
          if (bolt) { bolt.fire(game, cx, cy, bx, by, spec.bolt); this.aimX = bx; this.aimY = by; this.aimT = 8; Au.sfx('bolt', cx); }
        }
      }
    };
    p.draw = function (ctx, game, alpha) {
      if (this.dead) return;
      const x = this.x, y = this.y - 9, pal = this.pl.curPal, k = this.life < 6 ? this.life / 6 : 1, fade = this.spec.life - this.life < 30 ? ((this.life >> 2) & 1 ? 0.4 : 1) : 1;
      ctx.save(); ctx.translate(x, y + Math.sin(this.life / 30 * TAU) * 2); ctx.globalAlpha *= fade;
      ctx.lineWidth = 6; ctx.strokeStyle = P.INK; ctx.beginPath(); ctx.arc(0, 0, 7 * k, 0, TAU); ctx.stroke();
      ctx.lineWidth = 3; ctx.strokeStyle = pal.accent; ctx.beginPath(); ctx.arc(0, 0, 7 * k, 0, TAU); ctx.stroke();
      ctx.rotate(this.life / 90 * TAU);
      for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(11, 0); ctx.stroke(); }
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = pal.glow; ctx.beginPath(); ctx.arc(0, 0, this.aimT > 0 ? 4 : 2.5, 0, TAU); ctx.fill();
      ctx.restore();
    };
    return p;
  }

  // =====================================================================================
  // Player (CONTRACT §5) — shared kit driven by DATA; specials via SPECIALS[id]
  // =====================================================================================
  function Player(data, game) {
    E.call(this, { x: 0, y: 0, w: data.box.w, h: data.box.h, units: 'pxs', hp: data.hp, stepUp: R.stepUp });
    this.id = data.id; this.data = data; this.name = data.name;
    this.baseHp = data.hp; this.maxHp = data.hp; this.hp = data.hp;
    this.abilities = game && game.save ? game.save.abilities : { echoJump: false, burstLine: false, gripProtocol: false };
    this.energy = R.energyStart; this.energyMax = R.energyMax;
    this.meter = 0; this.meterMax = R.meterMax;
    this.overclock = 0; this.ocTransform = 0; this.ocRevert = 0; this.ocActive = false; this.ocWarnT = 0;
    this.state = 'idle'; this.stateT = 0;
    this.locked = false;
    this.deathTimer = 0;
    this.hurtTimer = 0; this.coyote = 0; this.airJumps = 1; this.airDash = 1;
    this.jumpCutAvail = false; this.wallLock = 0; this.wallCoyote = 0; this.wallDir = 0; this.clinging = false;
    this.dashT = 0; this.dashCd = 0; this.dashing = false; this.dashGround = false;
    this.move = null; this.moveName = ''; this.moveT = 0; this.chain = 0; this.chainTimer = 0; this.connected = false;
    this.landLag = 0; this.lockout = 0; this.guard = 0; this.armor = false;
    this.pogoActive = false; this.pogoGrace = false;
    this.contactImmune = false;             // set per frame by a special whose body is meant to collide with its victim (dive, grab-press)
    this.denyT = 0; this.denyKind = ''; this.denyArm = [false, false, false];   // refused-press cue (B31)
    this.squashX = 1; this.squashY = 1; this.squashT = 0; this.squashMax = 1;
    this.hurtRot = 0; this.lastVy = 0; this.stepT = 0; this.wantJump = false; this.canJumpCancel = false; this.canDashCancel = false;
    this.curPal = data.pal;                  // palette in use this frame (Overclock ramp / death ramp)
    this.rig = RIGS[data.id] ? RIGS[data.id] : RIGS.tessik;
    // hit descriptors: one per generic move + the special program's own
    this.hit = E.makeHit('player'); this.hit.src = this; this.hit.onHit = Player.prototype._onHit.bind(this);
    this.hitS = E.makeHit('player'); this.hitS.src = this; this.hitS.onHit = Player.prototype._onHitSpecial.bind(this);
    this.hitS2 = E.makeHit('player'); this.hitS2.src = this; this.hitS2.onHit = Player.prototype._onHitSpecial.bind(this);
    this.hitPush = E.makeHit('player'); this.hitPush.src = this; this.hitPush.kind = 'special'; this.hitPush.tag = 'ocPush'; this.hitPush.onHit = Player.prototype._onHitPush.bind(this);
    // special-program scratch state (never reallocated)
    this.sp = { phase: '', t: 0, len: 0, dx: 0, travel: 0, blink: 0, target: null, held: null, ringOut: false, flash: 0, dive: false, ult: false, startX: 0, caught: false, hop: 0, lockMove: false, ownList: this.hitS2.hitList };
    this.program = SPECIALS[data.id] || SPECIALS.tessik;
    // projectile pools
    this.pulse = data.id === 'tessik' ? PulseLine(this) : null;
    this.ring = data.id === 'orrubel' ? Ring(this) : null;
    this.sentries = null; this.bolts = null;
    if (data.id === 'orrubel') { this.sentries = [Sentry(this, 0), Sentry(this, 1), Sentry(this, 2)]; this.bolts = []; for (let i = 0; i < 8; i++) this.bolts.push(Bolt(this)); }
    this.beamT = 0; this.beamLen = 0;
  }
  Player.prototype = Object.create(E.prototype);
  Player.prototype.constructor = Player;

  // --- small helpers -----------------------------------------------------------------------
  Player.prototype.runSpeed = function () { return this.data.run * (this.ocActive ? R.ocSpeed : 1); };
  Player.prototype.dmgOf = function (d) { return this.ocActive ? Math.floor(d * R.ocDamage) : d; };
  Player.prototype.attacking = function () { return this.move !== null; };
  Player.prototype.canAct = function () { return !this.locked && this.hurtTimer <= 0 && !this.dead && this.ocTransform <= 0; };
  /** Would a special/ultimate press start right now? (energy for its cost, and the program's own refusals — Tessik's second Pulse Line) */
  Player.prototype.canStartSpecial = function () {
    const m = this.ocActive ? this.data.moves.ultimate : this.data.moves.special;
    if (!m || this.energy < m.cost) return false;
    return !(this.program.refuses && this.program.refuses(this));
  };
  Player.prototype.squash = function (sx, sy, frames) { this.squashX = sx; this.squashY = sy; this.squashT = frames; this.squashMax = frames; };
  Player.prototype.freeBolt = function () { const b = this.bolts; if (!b) return null; for (let i = 0; i < b.length; i++) if (b[i].dead) return b[i]; return null; };
  /** Forget pooled projectiles the engine dropped (room load clears game.projectiles without flagging them). */
  Player.prototype.clearProjectiles = function () {
    if (this.pulse) this.pulse.dead = true;
    if (this.ring) { this.ring.dead = true; this.sp.ringOut = false; }
    if (this.sentries) for (let i = 0; i < 3; i++) this.sentries[i].dead = true;
    if (this.bolts) for (let i = 0; i < this.bolts.length; i++) this.bolts[i].dead = true;
  };
  /** Fill a world hit box from a body-local [cx,cy,w,h] with the Overclock reach rule (DESIGN §3.9). */
  Player.prototype.boxHit = function (h, box, dmg, kb, hitstop, energy, meter, shake) {
    const reach = this.ocActive ? R.ocReach : 1, cxm = this.ocActive ? R.ocReachCx : 1;
    E.hitBoxWorld(this, box[0] * cxm, box[1], box[2] * reach, box[3] * reach, h);
    h.dmg = this.dmgOf(dmg); h.kbx = kb[0]; h.kby = kb[1]; h.facing = this.facing;
    h.hitstop = hitstop > 0 ? hitstop + (this.ocActive ? R.ocHitstopBonus : 0) : 0;
    h.energy = energy; h.meter = meter; h.multi = false;
    h.shake = shake ? shake[0] : 0; h.shakeFrames = shake ? shake[1] : 0;
    return h;
  };
  Player.prototype.setState = function (s) { if (s !== this.state) { this.state = s; this.stateT = 0; } };

  Player.prototype.startMove = function (name, mObj) {
    const m = mObj || this.data.moves[name];
    this.move = m; this.moveName = name; this.moveT = 0; this.connected = false;
    this.hit.hitList.length = 0;
    this.hit.tag = name;
    this.hit.kind = name === 'heavy' ? 'heavy' : (name === 'air' ? 'air' : (name === 'down' ? 'down' : (name === 'special' || name === 'counter' ? 'special' : (name === 'ultimate' ? 'ultimate' : 'light'))));
    this.clinging = false; this.canJumpCancel = false; this.canDashCancel = false;
    if (name === 'down') { this.setState('down'); }
    else if (!this.onGround) this.setState('air');
    else { this.setState('attack'); this.vx *= 0.5; }
  };
  Player.prototype.endMove = function () {
    this.move = null; this.moveName = ''; this.moveT = 0; this.pogoActive = false; this.sp.phase = ''; this.armor = false; this.contactImmune = false;
    this.sp.held = null; this.sp.lockMove = false;
    if (this.state === 'attack' || this.state === 'air' || this.state === 'down') this.setState(this.onGround ? 'idle' : 'fall');
  };
  Player.prototype.cancelMove = function () { this.endMove(); this.chain = 0; this.chainTimer = 0; this.beamT = 0; };

  /** Engine callback for the generic descriptor: a hit connected (enemy, boss, enemy projectile or 'spike'). */
  Player.prototype._onHit = function (victim, result, game) {
    this.connected = true;
    if (this.moveName === 'down') this.pogo(game, victim);
  };
  Player.prototype.pogo = function (game, victim) {
    this.vy = R.pogoVy; this.airJumps = 1; this.airDash = 1;
    // the down box is registered before the move of the frame, so the body may have sunk a few px into the
    // victim's top by now: bounce from its surface (contact is skipped on this tick either way)
    if (victim && victim.w !== undefined && E.overlap(this, victim)) { const top = victim.y - victim.h; if (this.y > top && this.y - top < 20) this.y = top; }
    this.endMove(); this.pogoActive = true; this.pogoGrace = true;   // stays "pogo" for the engine's hazard check this tick
    this.landLag = 0; this.setState('jump'); this.jumpCutAvail = false;
    FX.burst('pogo', this.x, this.y, 5, { color: this.curPal.glow });
    FX.burst('ring', this.x, this.y, 1, { radius: 20 });
    FX.shake(2, 3);
    Au.sfx('pogo', this.x);
  };
  /** Special / ultimate descriptor callback: per-fighter reactions (away knockback, grabs, local stun). */
  Player.prototype._onHitSpecial = function (victim, result, game) {
    this.connected = true;
    this.program.onHit(this, victim, result, game);
  };
  Player.prototype._onHitPush = function (victim, result, game) { // Overclock transform shove: away from the body
    if (victim && victim.vx !== undefined && !(result && result.blocked)) { const s = U.sign(victim.x - this.x) || this.facing; victim.vx = Math.abs(victim.vx) * s; }
  };

  // --- hurt / death / respawn (DESIGN §3.2, §3.3) ---------------------------------------------
  /**
   * Take damage. opts {hazard:true} = spike/pool (ignores i-frames, no knockback, hp only — the
   * engine runs the freeze/respawn). Returns true if hp dropped. Korvask's Bulwark Catch, Vellix's
   * blink i-frames (`guard`) and Brackmaw's heavy armour are resolved here.
   */
  Player.prototype.hurt = function (dmg, fromX, opts) {
    if (this.dead) return false;
    const hazard = !!(opts && opts.hazard);
    if (!hazard) {
      if (this.iframes > 0 && !(opts && opts.ignoreIframes)) return false;
      if (this.ocTransform > 0 || this.guard > 0) return false;
      if (this.program.tryCatch && this.program.tryCatch(this, fromX, UB.game, opts)) return false;
    }
    this.hp -= dmg;
    this.flash = 6;
    if (!hazard) {
      this.iframes = R.iFrames;
      let away = fromX === undefined || fromX === null ? -this.facing : (U.sign(this.x - fromX) || -this.facing);
      // DESIGN §3.3: acid puddles and stuck needles knock straight up — (0, −300)·weight, no horizontal push
      const noKbx = !!(opts && opts.hit && opts.hit.noKbx);
      if (this.armor) { // Brackmaw's Anvil Drop: damage only, never interrupted
        FX.hitstop(2); FX.burst('chip', this.x, this.cy(), 3, { color: P.DANGER, dir: away }); Au.sfx('hurt', this.x);
      } else {
        this.hurtTimer = R.hurtFrames; this.setState('hurt');
        this.cancelMove(); this.dashing = false; this.dashT = 0; this.clinging = false; this.beamT = 0;
        const k = this.data.weight * (this.ocActive ? R.ocKbTaken : 1);
        this.vx = noKbx ? 0 : R.hurtKb[0] * away * k; this.vy = R.hurtKb[1] * k;
        this.squash(1.15, 0.85, 4);
        FX.hitstop(R.hurtHitstop); FX.shake(R.hurtShake[0], R.hurtShake[1]);
        FX.burst('chip', this.x, this.cy(), 6, { color: P.DANGER, dir: away });
        FX.flash(P.DANGER, 0.25, 6);
        Au.sfx('hurt', this.x);
      }
    }
    if (this.hp <= 0) { this.hp = 0; this.die(); }
    return true;
  };
  Player.prototype.die = function () {
    if (this.dead) return;
    this.dead = true; this.deathTimer = 0; this.setState('dead');
    this.cancelMove(); this.dashing = false; this.clinging = false; this.overclock = 0; this.ocActive = false; this.ocTransform = 0; this.ocRevert = 0;
    this.vx = 0; this.vy = -150; this.guard = 0; this.hurtTimer = 0;
    Au.loop('wallSlide', false);
    FX.burst('chip', this.x, this.cy(), 12, { color: this.data.palette.base });
    Au.sfx('death', this.x);
  };
  /** Full reset at a node / new game (keeps energyMax — the engine owns it). opts: {hp, energy, meter, iframes, vx, vy, airJumps}. */
  Player.prototype.respawn = function (x, y, opts) {
    opts = opts || {};
    this.x = x; this.y = y; this.px = x; this.py = y;
    this.vx = opts.vx || 0; this.vy = opts.vy || 0;
    this.dead = false; this.deathTimer = 0; this.setState('idle');
    if (opts.hp !== undefined) this.hp = opts.hp;
    if (opts.energy !== undefined) this.energy = opts.energy;
    if (opts.meter !== undefined) this.meter = opts.meter;
    this.iframes = opts.iframes || 0; this.hurtTimer = 0; this.flash = 0; this.guard = 0; this.armor = false;
    this.cancelMove(); this.dashing = false; this.dashT = 0; this.dashCd = 0; this.clinging = false;
    this.overclock = 0; this.ocTransform = 0; this.ocRevert = 0; this.ocActive = false; this.ocWarnT = 0; this.curPal = this.data.pal;
    this.landLag = 0; this.lockout = 0; this.wallLock = 0; this.coyote = 0; this.wallCoyote = 0; this.jumpCutAvail = false; this.contactImmune = false;
    this.denyT = 0;
    this.airJumps = opts.airJumps !== undefined ? opts.airJumps : 1; this.airDash = this.airJumps;
    this.onGround = false; this.ground = null; this.dropThrough = 0;
    this.squashX = this.squashY = 1; this.squashT = 0; this.pogoActive = false; this.pogoGrace = false;
    this.clearProjectiles();
    Au.loop('wallSlide', false);
  };
  /** Move without resetting hp/energy/meter/Overclock (room arrival, hazard respawn, debug teleport). */
  Player.prototype.place = function (x, y, opts) {
    opts = opts || {};
    this.x = x; this.y = y; this.px = x; this.py = y;
    this.vx = opts.vx || 0; this.vy = opts.vy || 0;
    this.cancelMove(); this.dashing = false; this.dashT = 0; this.clinging = false; this.wallLock = 0; this.guard = 0; this.armor = false;
    this.hurtTimer = 0; this.landLag = 0; this.pogoActive = false; this.pogoGrace = false; this.contactImmune = false;
    this.jumpCutAvail = false;   // a chute launch (vy set here) is not a jump: releasing the key must not cut it
    this.onGround = false; this.wasOnGround = false; this.ground = null; this.dropThrough = 0; this.coyote = 0; this.wallCoyote = 0;
    if (opts.iframes) this.iframes = Math.max(this.iframes, opts.iframes);
    if (opts.airJumps !== undefined) { this.airJumps = opts.airJumps; this.airDash = opts.airJumps; }
    if (!this.dead) this.setState('fall');
    this.clearProjectiles();
    Au.loop('wallSlide', false);
  };
  Player.prototype.heal = function (n) { this.hp = Math.min(this.maxHp, this.hp + n); };

  // --- update (one logic frame) ----------------------------------------------------------------
  function isOneWayUnder(pl, level) {
    if (pl.groundTy < 0) return false;
    for (let tx = pl.groundTx0; tx <= pl.groundTx1; tx++) if (E.tileAt(level, tx, pl.groundTy) === '-') return true;
    return false;
  }
  const STATES_OC = { idle: 1, run: 1, jump: 1, fall: 1, cling: 1 };
  const REFUSABLE = ['special', 'overclock', 'dash'], DENY_FRAMES = 18;

  /**
   * One logic frame: the body update, then the refused-input check (DESIGN §3.7, playtest B31): a Special, Overclock
   * or Dash press whose 6 f buffer runs out without starting anything — airborne for a floor-bound special, during
   * the special's own move, at a light's chain end, a meter short of full, no Burst Line, the dash cooldown — plays
   * the deny sfx and shows the refusal cue over the fighter, so no input is silently swallowed. Presses lost to a
   * hurt, a lock (intro card, pickup), death or the Overclock transform stay silent: the player is not in control.
   */
  Player.prototype.update = function (game) {
    this.updateBody(game);
    if (this.denyT > 0) this.denyT--;
    for (let i = 0; i < REFUSABLE.length; i++) {
      const s = In.state[REFUSABLE[i]];
      if (!s) continue;
      if (s.buffer > 1) this.denyArm[i] = true;
      else if (s.buffer === 1 && this.denyArm[i]) { this.denyArm[i] = false; if (this.canAct()) this.deny(game, REFUSABLE[i], false); }
      else if (s.buffer <= 0) this.denyArm[i] = false;
    }
  };
  /** A refused press: the deny sfx, the cue over the fighter (`denyT`/`denyKind`), the energy-bar flash for a special. */
  Player.prototype.deny = function (game, kind, lockout) {
    Au.sfx('deny');
    this.denyT = DENY_FRAMES; this.denyKind = kind;
    if (lockout) this.lockout = 10;
    if (game) { if (kind === 'special') game.denyFlash = 6; game.denyKind = kind; }
  };
  Player.prototype.updateBody = function (game) {
    const d = this.data, inp = In.state, sp = this.sp;
    this.t++; this.stateT++;
    if (this.pogoGrace) { this.pogoGrace = false; this.pogoActive = false; }
    if (this.iframes > 0) this.iframes--;
    if (this.flash > 0) this.flash--;
    if (this.dashCd > 0) this.dashCd--;
    if (this.lockout > 0) this.lockout--;
    if (this.wallLock > 0) this.wallLock--;
    if (this.guard > 0) this.guard--;
    if (sp.flash > 0) sp.flash--;
    if (this.squashT > 0 && --this.squashT === 0) { this.squashX = this.squashY = 1; }
    if (this.chainTimer > 0 && --this.chainTimer === 0) this.chain = 0;
    // Orrubel: the engine may kill the ring without running its update (off-room cull, the 64-projectile
    // eviction) — the heavy must never stay locked behind a ring that no longer exists
    if (sp.ringOut && this.ring && this.ring.dead) sp.ringOut = false;

    // ---- Overclock timers (DESIGN §3.9) ----
    if (this.ocTransform > 0) {
      this.ocTransform--;
      if (this.ocTransform === 0) { this.ocActive = true; this.overclock = R.ocFrames; this.ocWarnT = 0; }
    } else if (this.ocActive) {
      // the clock stands still while the fighter is locked (boss intro card, the 120 f ability pickup): those frames
      // are not play time, so they never eat the transformation (playtest B10)
      if (!this.locked) {
        this.overclock--; this.meter = this.meterMax * this.overclock / R.ocFrames;
        if (this.overclock <= 180 && this.overclock > 0 && (this.overclock % 12) === 0) Au.sfx('overclockWarn');
        if (this.overclock <= 0) { this.ocActive = false; this.ocRevert = R.ocRevert; this.meter = 0; Au.sfx('overclockEnd'); }
      }
      if ((this.t % 3) === 0) FX.burst('aura', this.x, this.y, 1, d.auraOpts);
    } else if (this.ocRevert > 0) this.ocRevert--;
    // energy regen: 3/s, 6/s in Overclock
    this.energy = Math.min(this.energyMax, this.energy + R.energyRegen * DT * (this.ocActive ? 2 : 1));

    if (this.dead) {
      this.deathTimer++;
      this.gravity(d.gravity, d.maxFall); this.vx = U.approach(this.vx, 0, d.friction * DT);
      this.moveAndCollide(game.level);
      return;
    }
    if (this.hurtTimer > 0) {
      this.hurtTimer--;
      this.gravity(d.gravity, d.maxFall);
      if (this.onGround) this.vx = U.approach(this.vx, 0, d.friction * DT);
      this.moveAndCollide(game.level);
      if (this.hurtTimer === 0) this.setState(this.onGround ? 'idle' : 'fall');
      Au.loop('wallSlide', false);
      return;
    }

    let act = this.canAct();
    const dir = act ? ((inp.right.down ? 1 : 0) - (inp.left.down ? 1 : 0)) : 0;
    const wasGround = this.onGround, wasClinging = this.clinging;
    if (this.onGround) { this.coyote = R.coyote; this.airJumps = 1; this.airDash = 1; }

    // ---- Burst Line (dash): in progress ----
    if (this.dashing) {
      this.dashT--;
      const dist = d.dash.dist * (this.ocActive ? R.ocSpeed : 1);
      this.vx = (dist / d.dash.frames) * 60 * this.facing; this.vy = 0;
      this.moveAndCollide(game.level);
      if (this.dashT <= 0 || this.hitWall === this.facing) {
        this.dashing = false; this.dashCd = R.dashCooldown;
        this.vx = (dir === this.facing && dir !== 0) ? this.runSpeed() * this.facing : 0;
        this.setState(this.onGround ? 'idle' : 'fall');
      } else if ((this.t & 3) === 0) FX.burst('dust', this.x, this.y, 1);
      Au.loop('wallSlide', false);
      return;
    }

    // ---- Attacks / specials in progress (may cancel into jump/dash/special below) ----
    let physDone = false;
    if (this.move) {
      if (this.moveName === 'special' || this.moveName === 'ultimate') physDone = this.program.tick(this, game, dir);
      else this.tickMove(game, dir);
    }
    if (this.landLag > 0) this.landLag--;

    // ---- Overclock activation: idle/run/jump/fall/cling only ----
    // checked AFTER the move in progress has ticked (and possibly ended), like jump/light/dash below, so a press
    // buffered through the end of an attack fires on the first free frame (DESIGN §2.5 "first legal frame")
    if (act && inp.overclock.buffer > 0 && this.meter >= this.meterMax && !this.ocActive && !this.attacking() && !this.dashing && STATES_OC[this.state]) {
      In.consume('overclock');
      this.ocTransform = R.ocTransform - 8; this.clinging = false; this.vx = 0; this.setState('overclock');
      FX.hitstop(8); FX.flash('#FFFFFF', 0.6, 8); FX.shake(6, 12);
      FX.burst('spark', this.x, this.cy(), 24, { color: d.ocPalette.glow });
      FX.burst('ring', this.x, this.cy(), 1, { radius: 120 });
      // shove every enemy within 60 px: (300 away, -200), no damage
      const hp = this.hitPush; hp.hitList.length = 0;
      hp.x = this.x - this.w / 2 - 60; hp.y = this.y - this.h - 60; hp.w = this.w + 120; hp.h = this.h + 120;
      hp.dmg = 0; hp.kbx = 300; hp.kby = -200; hp.facing = this.facing; hp.hitstop = 0; hp.energy = 0; hp.meter = 0;
      game.registerHit(hp);
      Au.sfx('overclockOn', this.x);
      act = false;   // the transform owns the rest of this frame: no dash / attack / jump starts on it
    }

    // ---- Burst Line: start ----
    if (act && this.abilities.burstLine && inp.dash.buffer > 0 && this.dashCd <= 0 && !this.attacking() && this.landLag <= 0 && (this.onGround || this.airDash > 0)) {
      In.consume('dash');
      if (!this.onGround) this.airDash--;
      if (dir !== 0) this.facing = dir;
      this.dashing = true; this.dashT = d.dash.frames; this.setState('dash'); this.clinging = false; this.vy = 0; this.chain = 0; this.chainTimer = 0;
      FX.burst('dust', this.x, this.y, 5); Au.sfx('dash', this.x);
      Au.loop('wallSlide', false);
      return this.update_dashFirst(game, dir);
    }

    // ---- Neutral attack inputs ----
    if (!this.move && act && this.landLag <= 0 && this.lockout <= 0) {
      // DESIGN §3.5: an air attack / down-strike may start any time airborne except during dash/hurt/CLING —
      // while clinging (`this.clinging` = last frame's cling) the press is left buffered for the wall jump
      if (inp.light.buffer > 0) {
        if (this.onGround) {
          In.consume('light');
          this.chain = this.chainTimer > 0 ? this.chain + 1 : 1; if (this.chain > 3) this.chain = 1;
          if (dir !== 0) this.facing = dir;
          this.startMove('light' + this.chain);
          this.tickMove(game, dir);
        } else if (!this.clinging) {
          In.consume('light');
          if (inp.down.down) this.startMove('down'); else this.startMove('air');
          this.tickMove(game, dir);
        }
      } else if (inp.heavy.buffer > 0) {
        if (this.onGround) {
          In.consume('heavy');
          if (!(this.ring && sp.ringOut)) { if (dir !== 0) this.facing = dir; this.chain = 0; this.chainTimer = 0; this.startMove('heavy'); this.tickMove(game, dir); }
        } else if (!this.clinging) { In.consume('heavy'); this.startMove('down'); this.tickMove(game, dir); }
      } else if (inp.special.buffer > 0) {
        if (this.program.press(this, game, dir)) {
          this.chain = 0; this.chainTimer = 0;
          // the press frame is f1 of the special (DESIGN §3.7 "charged on f1"), as startMove + tickMove is for generic moves
          if (this.move && (this.moveName === 'special' || this.moveName === 'ultimate')) physDone = this.program.tick(this, game, dir);
        }
      }
    }

    // ---- Horizontal movement ----
    const lockMove = (this.move !== null && this.state === 'attack') || sp.lockMove || this.landLag > 0;
    const run = this.runSpeed();
    const accel = this.onGround ? d.accel : d.accel * d.airControl;
    const fric = this.onGround ? d.friction : d.friction * 0.15;
    if (!physDone) {
      if (dir !== 0 && !lockMove && this.wallLock <= 0) {
        this.vx = U.approach(this.vx, dir * run, accel * DT);
        if (!this.attacking() && !this.dashing) this.facing = dir;
      } else if (!sp.lockMove && (this.wallLock <= 0 || this.onGround)) {
        this.vx = U.approach(this.vx, 0, fric * DT);
      }
    }

    // ---- Grip Protocol (wall cling) ----
    this.clinging = false;
    if (act && this.abilities.gripProtocol && !this.onGround && this.vy > 0 && !this.attacking() && dir !== 0 && this.hitWall === dir) {
      const bx = this.x + dir * (this.w / 2 + 1), r0 = Math.floor((this.y - this.h) / TILE), r1 = Math.floor((this.y - 1) / TILE), tx = Math.floor(bx / TILE);
      let wall = false;
      for (let r = r0; r <= r1; r++) if (E.tileAt(game.level, tx, r) === '#') { wall = true; break; }
      if (wall) {
        this.clinging = true; this.wallDir = dir; this.wallCoyote = R.wallCoyote; this.setState('cling'); this.facing = dir;
        if (this.vy > d.wallSlide) this.vy = d.wallSlide;
        this.airJumps = 1; this.airDash = 1;
        if ((this.t & 3) === 0) FX.burst('dust', this.x + dir * this.w / 2, this.y - 10, 1);
      }
    }
    Au.loop('wallSlide', this.clinging);

    // ---- Jump (ground / coyote / wall / Echo) ----
    if (act && inp.jump.buffer > 0 && !this.attacking() && !this.dashing && this.landLag <= 0) {
      if (this.onGround && inp.down.down && (this.ground || isOneWayUnder(this, game.level))) {
        In.consume('jump'); this.dropThrough = R.dropThroughFrames; this.onGround = false; this.coyote = 0;
      } else if (this.onGround || this.coyote > 0) {
        In.consume('jump');
        this.vy = -d.jumpVel; this.jumpCutAvail = true; this.coyote = 0; this.onGround = false; this.setState('jump');
        this.squash(0.85, 1.15, 6); FX.burst('dust', this.x, this.y, 3); Au.sfx('jump', this.x);
        this.chain = 0; this.chainTimer = 0;
      } else if ((this.clinging || this.wallCoyote > 0) && this.wallDir !== 0) {
        In.consume('jump');
        const away = -this.wallDir;
        this.vx = (d.run + R.wallJumpVx) * away; this.vy = -R.wallJumpVy * d.jumpVel;
        this.facing = away; this.wallLock = R.wallLock; this.wallCoyote = 0; this.clinging = false;
        this.airJumps = 1; this.airDash = 1; this.jumpCutAvail = true; this.setState('jump');
        this.squash(0.85, 1.15, 6); FX.burst('dust', this.x - away * this.w / 2, this.y - 10, 3); Au.sfx('jump', this.x);
      } else if (this.abilities.echoJump && this.airJumps > 0) {
        In.consume('jump');
        this.airJumps--; this.vy = -d.djMult * d.jumpVel; this.jumpCutAvail = true; this.setState('jump');
        this.squash(0.85, 1.15, 6); FX.burst('ring', this.x, this.y, 1, { radius: 24 }); Au.sfx('doubleJump', this.x);
      }
    }
    if (inp.jump.released && this.vy < 0 && this.jumpCutAvail) { this.vy *= R.jumpCut; this.jumpCutAvail = false; }
    if (this.hitCeiling) this.jumpCutAvail = false;
    // coyote windows count down after the jump check: airborne frames 1–6 (ground) / 1–5 (wall) still jump
    if (!this.onGround && this.coyote > 0) this.coyote--;
    if (!this.clinging && !wasClinging && this.wallCoyote > 0) this.wallCoyote--;   // the frame the wall is let go does not count

    // ---- Gravity & move: half-step (leapfrog) so the analytic apex v²/2g of DESIGN §4.1 holds ----
    if (!physDone) {
      this.vy = Math.min(d.maxFall, this.vy + d.gravity * DT * 0.5);
      if (this.clinging && this.vy > d.wallSlide) this.vy = d.wallSlide;
      this.lastVy = this.vy;
      this.moveAndCollide(game.level);
      if (!this.onGround) this.vy = Math.min(d.maxFall, this.vy + d.gravity * DT * 0.5);
    } else this.lastVy = this.vy;

    // ---- Landing ----
    if (this.onGround && !wasGround) {
      if (this.lastVy >= R.landSquashVy) { this.squash(1.2, 0.8, 6); FX.burst('dust', this.x, this.y, 6); }
      if (this.lastVy >= 900) FX.shake(2, 4);
      Au.sfx('land', this.x);
      if (this.moveName === 'down') { this.endMove(); this.landLag = d.downLandLag; this.chain = 0; this.chainTimer = 0; }
      else if (this.moveName === 'air') { const past = this.moveT > this.move.s; this.endMove(); if (past) this.landLag = R.airLandLag; this.chain = 0; this.chainTimer = 0; }
      else if (this.move && this.state === 'air') { this.setState('attack'); }   // an air-started special continues grounded
      else if (!this.move) { this.chain = 0; this.chainTimer = 0; }
      this.program.onLand(this, game);
    }
    if (this.moveName === 'down' && this.onGround && this.moveT > 1) { this.endMove(); this.landLag = d.downLandLag; }

    // ---- State label + run FX ----
    if (!this.attacking() && !this.dashing && !this.clinging && this.ocTransform <= 0) {
      if (this.onGround) this.setState(Math.abs(this.vx) > 10 ? 'run' : 'idle');
      else this.setState(this.vy < 0 ? 'jump' : 'fall');
    }
    if (this.ocTransform > 0) this.setState('overclock');
    if (this.state === 'run' && this.onGround) {
      if (++this.stepT >= d.runCycle) { this.stepT = 0; FX.burst('dust', this.x, this.y, d.weight < 0.8 ? 2 : 1); Au.sfx('step', this.x); }
    } else this.stepT = 0;
  };
  /** The first dash frame runs on the press frame (DESIGN §3.1: N dash frames at constant speed). */
  Player.prototype.update_dashFirst = function (game, dir) {
    const d = this.data;
    this.dashT--;
    this.vx = (d.dash.dist * (this.ocActive ? R.ocSpeed : 1) / d.dash.frames) * 60 * this.facing; this.vy = 0;
    this.moveAndCollide(game.level);
    if (this.dashT <= 0 || this.hitWall === this.facing) { this.dashing = false; this.dashCd = R.dashCooldown; this.vx = 0; this.setState(this.onGround ? 'idle' : 'fall'); }
  };

  /**
   * Generic move frame (lights, heavy, air, down-strike, Korvask's counter-slam): startup/active/
   * recovery, lunge, cancel windows (DESIGN §3.5), hit registration, pogo on floor spikes.
   */
  Player.prototype.tickMove = function (game, dir) {
    const m = this.move, inp = In.state, d = this.data;
    if (!m) return;
    this.moveT++;
    const name = this.moveName, mt = this.moveT, act = this.canAct();
    const grounded = this.state === 'attack';
    const isLight = name === 'light1' || name === 'light2' || name === 'light3';
    if (grounded && mt === 1 && m.lunge) this.vx += m.lunge * this.facing;
    if (m.armor) this.armor = mt >= m.armor[0] && mt <= m.armor[1];
    // ---- cancel windows ----
    if (act && grounded && isLight) {
      const inHit = this.connected && m.hitCancel > 0 && mt >= m.hitCancel;
      const inWhiff = !this.connected && m.whiffCancel > 0 && mt >= m.whiffCancel;
      const canChain = name === 'light3' ? (this.connected && mt >= m.rechain) : (inHit || inWhiff);
      if (canChain && inp.light.buffer > 0) {
        In.consume('light');
        this.chain = name === 'light3' ? 1 : this.chain + 1;
        if (dir !== 0) this.facing = dir;
        this.startMove('light' + this.chain);
        return this.tickMove(game, dir);          // the next light's f1 is this frame (DESIGN §3.11 worked timing)
      }
      if (inHit) {
        if (inp.jump.buffer > 0 && (this.onGround || this.coyote > 0)) { this.cancelMove(); return; }
        if (this.abilities.burstLine && inp.dash.buffer > 0 && this.dashCd <= 0) { this.cancelMove(); return; }
        if (inp.special.buffer > 0) {
          if (this.canStartSpecial()) { this.cancelMove(); return; }
          // DESIGN §3.7: a press that cannot start (energy, a second Pulse Line) is only the deny — sfx, bar flash,
          // 10 f lockout — and never cancels the light, which runs to its end
          In.consume('special'); this.deny(game, 'special', true);
        }
      }
    } else if (act && name === 'heavy' && m.jumpCancel > 0 && this.connected && mt >= m.jumpCancel && inp.jump.buffer > 0 && this.onGround) { this.cancelMove(); return; }
    const active = mt > m.s && mt <= m.s + m.a;
    if (name === 'down') {
      this.pogoActive = active;
      if (active) { if (this.vy < R.pogoDive) this.vy = R.pogoDive; if (this.vy > d.maxFall) this.vy = d.maxFall; }
    } else if (mt > m.s + m.a + m.r) {
      this.endMove();
      if (isLight) this.chainTimer = R.chainTimeout; else { this.chain = 0; this.chainTimer = 0; }
      return;
    }
    if (name === 'heavy' && m.ring && mt === m.s + 1 && this.ring && this.ring.dead) this.ring.spawn(game);   // Orrubel: Ring Toss launch
    if (active && m.box) {
      const h = this.hit;
      this.boxHit(h, m.box, m.dmg, m.kb, m.hitstop, m.energy, m.meter, m.shake);
      if (name === 'counter') { h.dmg = m.dmg; h.meter = 0; }   // +15 meter was granted on the catch (DESIGN §4.2.5: "+15 on catch")
      game.registerHit(h);
      if (name === 'down' && E.hazardInBox(game.level, h.x, h.y, h.w, h.h, false) === 'spike' && E.lastHazard.ch === '^') this.pogo(game);
    }
  };

  // =====================================================================================
  // Special programs — one per fighter: press() starts, tick() runs a frame (returns true when it
  // moved the body itself), onHit() reacts to the special descriptors, onLand() for dive landings.
  // =====================================================================================
  function spend(pl, game, cost) {
    if (pl.energy < cost) { pl.deny(game, 'special', true); return false; }
    pl.energy -= cost; return true;
  }
  function beginSpecial(pl, name, dir) {
    pl.startMove(name);
    pl.hitS.kind = pl.hit.kind; pl.hitS.tag = name; pl.hitS.hitList.length = 0;
    pl.hitS2.kind = pl.hit.kind; pl.hitS2.tag = name; pl.hitS2.hitList = pl.sp.ownList; pl.hitS2.hitList.length = 0;
    pl.sp.phase = 'wind'; pl.sp.t = 0; pl.sp.lockMove = false; pl.sp.ult = name === 'ultimate'; pl.sp.held = null; pl.sp.target = null;
    if (dir !== 0 && pl.onGround) pl.facing = dir;
    Au.sfx(name === 'ultimate' ? 'ultimate' : 'special', pl.x);
  }
  /** Nearest live enemy or active boss within `range` px of the body centre (null if none). */
  function nearestTarget(pl, game, range) {
    let best = null, bd = range * range;
    const cx = pl.x, cy = pl.cy();
    for (let i = 0; i < game.enemies.length; i++) {
      const e = game.enemies[i]; if (e.dead) continue;
      const dx = e.x - cx, dy = e.cy() - cy, d2 = dx * dx + dy * dy;
      if (d2 < bd) { bd = d2; best = e; }
    }
    const b = game.boss;
    if (b && b.active && !b.dead) { const dx = b.x - cx, dy = b.cy() - cy, d2 = dx * dx + dy * dy; if (d2 < bd) { bd = d2; best = b; } }
    return best;
  }
  /** Knockback "away" from the body regardless of facing (Brackmaw's bursts, the Overclock shove). */
  function kbAway(pl, victim, result) {
    if (!victim || victim.vx === undefined || (result && result.blocked)) return;
    const s = U.sign(victim.x - pl.x) || pl.facing;
    victim.vx = Math.abs(victim.vx) * s;
  }
  const NOOP = function () {};
  const SPECIALS = {};

  // ---- TESSIK: Pulse Line (floor wave) / Sightline (beam) ----
  SPECIALS.tessik = {
    refuses: function (pl) { return !pl.ocActive && !!pl.pulse && !pl.pulse.dead; },   // only one Pulse Line at a time
    press: function (pl, game, dir) {
      if (!pl.onGround) return false;                       // grounded only; the 6 f buffer fires on landing
      In.consume('special');
      const oc = pl.ocActive, m = oc ? pl.data.moves.ultimate : pl.data.moves.special;
      if (!oc && pl.pulse && !pl.pulse.dead) { pl.deny(game, 'special', true); return true; }   // only one Pulse Line: a second press is refused (deny, no energy)
      // a wave with no floor ahead would die at the drop within a tile: refused (deny, no energy) instead of a silent fizzle (B31)
      if (!oc && pulseRunway(pl, game, PULSE_MIN_RUN) < PULSE_MIN_RUN) { pl.deny(game, 'special', true); return true; }
      if (!spend(pl, game, m.cost)) return true;
      beginSpecial(pl, oc ? 'ultimate' : 'special', dir);
      pl.beamT = 0;
      return true;
    },
    tick: function (pl, game, dir) {
      const m = pl.move; pl.moveT++;
      const mt = pl.moveT;
      if (!pl.sp.ult) {
        if (mt === m.s + 1 && pl.pulse) pl.pulse.spawn(game);
        if (mt > m.s + m.r) pl.endMove();
        return false;
      }
      const b = m.beam;
      pl.beamT = (mt >= b.ticks[0] && mt <= m.s + m.a) ? 1 : 0;
      if (pl.beamT) {
        // clip at the first solid wall along the beam rows
        const lv = game.level, front = pl.x + pl.facing * pl.w / 2, y0 = pl.cy() + b.cy - b.h / 2;
        const r0 = Math.floor(y0 / TILE), r1 = Math.floor((y0 + b.h - 0.001) / TILE);
        let len = b.len, c = Math.floor(front / TILE);
        for (let i = 0; i < 17; i++, c += pl.facing) {
          let solid = false;
          for (let r = r0; r <= r1; r++) if (E.solidAt(lv, c, r)) { solid = true; break; }
          if (solid) { const edge = pl.facing > 0 ? c * TILE : (c + 1) * TILE; len = Math.max(0, Math.min(len, (edge - front) * pl.facing)); break; }
        }
        pl.beamLen = len;
        let tickNow = false;
        for (let i = 0; i < b.ticks.length; i++) if (b.ticks[i] === mt) { tickNow = true; break; }
        if (tickNow) {
          const h = pl.hitS;
          h.x = pl.facing > 0 ? front : front - len; h.y = y0; h.w = len; h.h = b.h;
          h.dmg = b.dmg; h.kbx = b.kb[0]; h.kby = b.kb[1]; h.facing = pl.facing; h.hitstop = 0; h.energy = 0; h.meter = 0; h.multi = true;
          h.shake = 0; h.shakeFrames = 0; h.kind = 'ultimate';
          game.registerHit(h);
          if (mt === b.ticks[0]) { FX.flash('#FFFFFF', 0.3, 6); FX.shake(b.shake[0], b.shake[1]); }
          FX.burst('spark', front + pl.facing * Math.min(len, 40), pl.cy() + b.cy, 4, { color: pl.curPal.glow, dir: pl.facing });
        }
      }
      if (mt > m.s + m.a + m.r) { pl.endMove(); pl.beamT = 0; }
      return false;
    },
    onHit: function (pl, victim, result, game) { localStun(victim, pl.sp.ult ? pl.data.moves.ultimate.beam.local : pl.data.moves.special.proj.local); },
    onLand: NOOP,
    drawWorld: function (ctx, pl, alpha) {
      if (!pl.beamT || !pl.move) return;
      const b = pl.move.beam, pal = pl.curPal;
      const x0 = pl.x + pl.facing * pl.w / 2, y = pl.cy() + b.cy, x1 = x0 + pl.facing * pl.beamLen;
      const k = Math.min(1, (pl.moveT - b.ticks[0] + 1) / 3);
      ctx.save(); ctx.lineCap = 'round';
      ctx.globalAlpha = 0.9; ctx.strokeStyle = P.INK; ctx.lineWidth = 10 * k; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = P.ENERGY; ctx.lineWidth = 6 * k; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.fillStyle = pal.glow;
      for (let i = 0; i < 12; i++) { const t = (i * 37 + pl.moveT * 23) % 100 / 100; const jx = x0 + (x1 - x0) * t, jy = y + U.jitter(pl.moveT, i, 10); ctx.beginPath(); ctx.arc(jx, jy, 1.5, 0, TAU); ctx.fill(); }
      ctx.restore();
    },
  };

  // ---- BRACKMAW: Vault Stomp (ground burst / air dive) / Quake Vault ----
  SPECIALS.brackmaw = {
    press: function (pl, game, dir) {
      In.consume('special');
      const oc = pl.ocActive, m = oc ? pl.data.moves.ultimate : pl.data.moves.special;
      if (!spend(pl, game, m.cost)) return true;
      beginSpecial(pl, oc ? 'ultimate' : 'special', dir);
      pl.sp.phase = pl.onGround ? 'wind' : 'windAir'; pl.sp.dive = !pl.onGround;
      return true;
    },
    tick: function (pl, game, dir) {
      const m = pl.move, sp = pl.sp; pl.moveT++;
      const mt = pl.moveT;
      if (sp.phase === 'wind') { sp.lockMove = true; if (mt > m.s) { sp.phase = 'burst'; sp.t = 0; } else return false; }
      if (sp.phase === 'windAir') { if (mt > m.air.s) { sp.phase = 'dive'; sp.t = 0; } else return false; }
      if (sp.phase === 'dive') {
        const a = m.air;
        pl.contactImmune = true;   // the dive drives the body through its victim: no contact damage until the burst is done
        pl.vy = a.diveVy; pl.vx = dir * a.drift; pl.lastVy = pl.vy;
        pl.moveAndCollide(game.level);
        pl.boxHit(pl.hitS2, a.box, a.dmg, m.kb, 4, 0, m.meter, null); pl.hitS2.kbx = 200; pl.hitS2.kby = -100; if (sp.ult) pl.hitS2.dmg = a.dmg;
        game.registerHit(pl.hitS2);
        if ((pl.t & 1) === 0) FX.burst('dust', pl.x, pl.y - pl.h, 1);
        if (pl.onGround) { sp.phase = 'burst'; sp.t = 0; pl.setState('attack'); FX.burst('dust', pl.x, pl.y, 8); }
        return true;
      }
      if (sp.phase === 'burst') {
        sp.t++; sp.lockMove = true; pl.vx = 0; pl.contactImmune = sp.dive;
        if (sp.t === 1) {
          FX.shake(m.shake[0], m.shake[1]); FX.burst('chip', pl.x, pl.y, sp.ult ? 10 : 5, { color: pl.data.palette.accent });
          FX.burst('ring', pl.x, pl.y - 6, 1, { radius: m.ringR, life: 14 }); Au.sfx('heavyHit', pl.x);
          pl.hitS.hitList.length = 0;
        }
        pl.boxHit(pl.hitS, m.box, m.dmg, m.kb, m.hitstop, 0, m.meter, null); if (sp.ult) pl.hitS.dmg = m.dmg;
        game.registerHit(pl.hitS);
        if (sp.t >= m.a) { sp.phase = 'recover'; sp.t = 0; }
        return false;
      }
      if (sp.phase === 'recover') { sp.t++; sp.lockMove = true; pl.contactImmune = false; if (sp.t > m.r) { pl.endMove(); sp.lockMove = false; } return false; }
      pl.endMove(); return false;
    },
    onHit: function (pl, victim, result, game) { if (pl.sp.phase === 'burst') kbAway(pl, victim, result); },
    onLand: NOOP,
  };

  /**
   * Blink Strike vs. a boss body (DESIGN §4.2.3, playtest B16): the slide either carries the whole body past the boss
   * or stops flush at its near side — it never ends inside it (where the guard runs out and the body touch lands).
   * Decided on the frame the slide would enter the body: `later` px of slide remain after this frame; passing needs
   * room on the far side (footing for half the body, no wall). Returns the (possibly shortened) step.
   */
  function blinkPastBoss(pl, game, bx, fy, step, later) {
    const b = game.boss, f = pl.facing, hw = pl.w / 2;
    if (!b || !b.active || b.dead || !(b.contact > 0) || step <= 0) return step;
    if (!(pl.y > b.y - b.h && pl.y - pl.h < b.y)) return step;                               // not at the body's height
    const bl = b.x - b.w / 2, br = b.x + b.w / 2, nx = bx + step * f;
    if (bx - hw < br && bx + hw > bl) return step;                                         // already inside: carry on through
    if (!(nx - hw < br && nx + hw > bl)) return step;                                      // not reaching it this frame
    const exitX = f > 0 ? br + hw + 0.5 : bl - hw - 0.5, need = (exitX - bx) * f;
    const lv = game.level;
    const pass = need <= step + later && footOverlap(lv, fy, exitX, hw) >= hw && !E.overlapsSolid(lv, exitX - hw, pl.y - pl.h, pl.w, pl.h - 1);
    if (pass) return step;
    const stopX = f > 0 ? bl - hw - 0.5 : br + hw + 0.5;
    return Math.max(0, Math.min(step, (stopX - bx) * f));
  }

  // ---- VELLIX: Blink Strike (floor slide) / Afterimage Storm (4 homing blinks) ----
  SPECIALS.vellix = {
    press: function (pl, game, dir) {
      const oc = pl.ocActive, m = oc ? pl.data.moves.ultimate : pl.data.moves.special;
      if (!oc && !pl.onGround) return false;                // Blink Strike is floor-bound; buffered until landing
      In.consume('special');
      if (!spend(pl, game, m.cost)) return true;
      beginSpecial(pl, oc ? 'ultimate' : 'special', dir);
      pl.sp.startX = pl.x; pl.sp.blink = -1;
      return true;
    },
    tick: function (pl, game, dir) {
      const m = pl.move, sp = pl.sp, d = pl.data; pl.moveT++;
      const mt = pl.moveT, lv = game.level, hw = pl.w / 2, f = pl.facing;
      if (!sp.ult) { // Blink Strike: f1–4 crouch, f5–12 slide, f13–20 recovery
        sp.lockMove = true;
        if (mt <= m.s) { pl.vx = 0; return false; }   // the crouch plants the feet (no residual run drift into the slide)
        if (mt <= m.s + m.a) {
          sp.phase = 'slide'; pl.guard = 1;   // read by this tick's hit resolution; the next update clears it (f5–12 only)
          // stop at a drop: never leave less than half the body over footing — '#', '-', 'c' tiles under the feet
          // or a mover (DESIGN §4.2.3). On a mover the body is also carried by its dx this frame (moveAndCollide).
          const gp = pl.ground && pl.onGround ? pl.ground : null, bx = pl.x + (gp ? gp.dx : 0), fy = pl.y + (gp ? gp.dy : 0);
          let step = m.slide;
          if (footOverlap(lv, fy, bx + step * f, hw) < hw) {
            const lim = footEdge(lv, fy, bx + f * (hw - 0.001), f) - f * hw;   // front edge flush with the ledge edge
            step = Math.max(0, Math.min(step, (lim - bx) * f));
          }
          step = blinkPastBoss(pl, game, bx, fy, step, (m.s + m.a - mt) * m.slide);
          pl.vx = step * 60 * f; pl.vy = 0; pl.lastVy = 0;
          pl.moveAndCollide(lv);
          if (!pl.onGround) { pl.vy = 0; }
          pl.vx = 0;
          pl.boxHit(pl.hitS, m.box, m.dmg, m.kb, 0, 0, m.meter, m.shake); game.registerHit(pl.hitS);
          if ((mt & 1) === 0) fxDot(pl.x - f * 10, pl.cy(), 0, 0, 10, 3, pl.curPal.glow);
          return true;
        }
        sp.phase = 'recover';
        if (mt > m.s + m.a + m.r) { pl.endMove(); sp.lockMove = false; }
        return false;
      }
      // Afterimage Storm
      if (mt <= m.guard) pl.guard = 1;   // f1–38 exactly (cleared at the top of the next update)
      if (mt <= m.s) { sp.lockMove = true; return false; }
      const bi = Math.floor((mt - m.s - 1) / m.blinkFrames), bf = (mt - m.s - 1) % m.blinkFrames;
      if (bi < m.blinks) {
        sp.phase = 'blink';
        if (bf === 0) { // aim a new blink
          const tg = nearestTarget(pl, game, m.lock);
          pl.hitS.hitList.length = 0;
          if (tg) {
            const dx = tg.x - pl.x, s = U.sign(dx) || pl.facing;
            sp.travel = U.clamp(dx + m.through * s, -m.maxTravel, m.maxTravel); sp.target = tg;
          } else { sp.travel = m.freeTravel * pl.facing; sp.target = null; }
          if (sp.travel !== 0) pl.facing = U.sign(sp.travel);
          sp.dx = sp.travel / m.blinkFrames;
          FX.burst('spark', pl.x, pl.cy(), 4, { color: pl.curPal.glow });
        }
        pl.boxHit(pl.hitS, m.box, m.dmg, m.kb, 0, 0, m.meter, null); pl.hitS.dmg = m.dmg; game.registerHit(pl.hitS);
        if (sp.target) { // gravity suspended while locked on
          pl.vx = sp.dx * 60; pl.vy = 0; pl.lastVy = 0; pl.moveAndCollide(lv); pl.vx = 0;
          if ((mt & 1) === 0) fxDot(pl.x - pl.facing * 8, pl.cy(), 0, 0, 12, 3, pl.curPal.glow);
          return true;
        }
        pl.vx = sp.dx * 60; sp.lockMove = true;   // untargeted: horizontal only, gravity integrates normally
        return false;
      }
      sp.phase = 'recover'; sp.lockMove = true;
      if (mt > m.s + m.a + m.r) { pl.endMove(); sp.lockMove = false; }
      return false;
    },
    onHit: function (pl, victim, result, game) { localStun(victim, pl.move ? pl.move.local : 3); },
    onLand: NOOP,
  };

  // ---- ORRUBEL: Sentry Pin / Sentry Triad (the Ring Toss heavy lives in tickMove) ----
  SPECIALS.orrubel = {
    press: function (pl, game, dir) {
      In.consume('special');
      const oc = pl.ocActive, m = oc ? pl.data.moves.ultimate : pl.data.moves.special;
      if (!spend(pl, game, m.cost)) return true;
      beginSpecial(pl, oc ? 'ultimate' : 'special', dir);
      return true;
    },
    tick: function (pl, game, dir) {
      const m = pl.move, sp = pl.sp; pl.moveT++;
      const mt = pl.moveT;
      sp.lockMove = pl.onGround;
      if (mt === m.s + 1) {
        const s = m.sentry;
        for (let i = 0; i < 3; i++) pl.sentries[i].dead = true;            // a new cast replaces every sentry
        for (let i = 0; i < s.at.length && i < 3; i++) pl.sentries[i].place(game, pl.x + s.at[i][0] * pl.facing, pl.cy() + s.at[i][1], s);
        FX.burst('ring', pl.x + s.at[0][0] * pl.facing, pl.cy() + s.at[0][1], 1, { radius: 14, life: 6 });
      }
      if (mt > m.s + m.r) { pl.endMove(); sp.lockMove = false; }
      return false;
    },
    onHit: NOOP, onLand: NOOP,
  };

  // ---- KORVASK: Bulwark Catch (counter) / Clamp Press (grab-slam) ----
  SPECIALS.korvask = {
    press: function (pl, game, dir) {
      In.consume('special');
      const oc = pl.ocActive, m = oc ? pl.data.moves.ultimate : pl.data.moves.special;
      if (!spend(pl, game, m.cost)) return true;
      beginSpecial(pl, oc ? 'ultimate' : 'special', dir);
      pl.sp.phase = oc ? 'wind' : 'raise'; pl.sp.caught = false;
      return true;
    },
    tick: function (pl, game, dir) {
      const m = pl.move, sp = pl.sp; pl.moveT++;
      const mt = pl.moveT;
      if (!sp.ult) { // Bulwark Catch: f1–2 raise, stance f3–18, whiff recovery f19–36
        sp.lockMove = pl.onGround;
        if (mt <= m.s) sp.phase = 'raise';
        else if (mt <= m.s + m.a) sp.phase = 'stance';
        else sp.phase = 'whiff';
        if (mt > m.s + m.a + m.r) { pl.endMove(); sp.lockMove = false; }
        return false;
      }
      const g = m.grab, pr = m.press, sl = m.slam;
      if (sp.phase === 'wind') { sp.lockMove = true; if (mt > m.s) { sp.phase = 'lunge'; sp.t = 0; pl.hitS2.hitList = sp.ownList; pl.hitS2.hitList.length = 0; } else return false; }
      if (sp.phase === 'lunge') {
        sp.t++;
        pl.vx = g.lunge / g.frames * 60 * pl.facing; pl.vy = 0; pl.lastVy = 0;
        pl.moveAndCollide(game.level); pl.vx = 0;
        pl.boxHit(pl.hitS2, g.box, 0, sl.kb, g.hitstop, 0, 0, null); pl.hitS2.dmg = 0; pl.hitS2.kbx = 0; pl.hitS2.kby = 0;
        game.registerHit(pl.hitS2);
        if (sp.t >= g.frames) { sp.phase = 'whiff'; sp.t = 0; }
        return true;
      }
      if (sp.phase === 'press') {
        sp.t++; pl.contactImmune = true;   // the victim is held against the body (DESIGN §4.2.5)
        const half = pr.frames / 2;
        pl.vy = (sp.t <= half ? -1 : 1) * (pr.hop / half) * 60; pl.vx = 0; pl.lastVy = 0;
        pl.moveAndCollide(game.level);
        const v = sp.held;
        if (v && !v.dead && v !== game.boss) { v.x = pl.x + pr.hold[0] * pl.facing; v.y = pl.cy() + pr.hold[1] + v.h / 2; v.vx = 0; v.vy = 0; if (v.hitstun !== undefined) v.hitstun = 20; }
        if (sp.t >= pr.frames) { sp.phase = 'slam'; sp.t = 0; pl.hitS.hitList.length = 0; pl.hitS2.hitList = pl.hitS.hitList; }
        return true;
      }
      if (sp.phase === 'slam') {
        sp.t++; pl.vx = 0; pl.contactImmune = true;
        if (sp.t === 1) { FX.shake(sl.shake[0], sl.shake[1]); FX.burst('ring', pl.x + pl.facing * 20, pl.y, 1, { radius: 40 }); FX.burst('dust', pl.x + pl.facing * 24, pl.y, 6); Au.sfx('heavyHit', pl.x); }
        const v = sp.held;
        if (v && !v.dead) { // the held victim takes the full press
          const h2 = pl.hitS2; h2.x = v.x - v.w / 2 - 1; h2.y = v.y - v.h - 1; h2.w = v.w + 2; h2.h = v.h + 2;
          h2.dmg = sl.dmgHeld; h2.kbx = sl.kb[0]; h2.kby = sl.kb[1]; h2.facing = pl.facing; h2.hitstop = sl.hitstop; h2.energy = 0; h2.meter = m.meter; h2.multi = false; h2.shake = 0; h2.shakeFrames = 0;
          game.registerHit(h2);
        }
        pl.boxHit(pl.hitS, sl.box, sl.dmg, sl.kb, sl.hitstop, 0, m.meter, null); pl.hitS.dmg = sl.dmg; game.registerHit(pl.hitS);
        if (sp.t >= sl.frames) { sp.phase = 'recover'; sp.t = 0; sp.held = null; }
        return false;
      }
      if (sp.phase === 'recover') { sp.t++; sp.lockMove = true; pl.contactImmune = false; if (sp.t > sl.r) { pl.endMove(); sp.lockMove = false; } return false; }
      if (sp.phase === 'whiff') { sp.t++; sp.lockMove = true; if (sp.t > m.r) { pl.endMove(); sp.lockMove = false; } return false; }
      pl.endMove(); return false;
    },
    onHit: function (pl, victim, result, game) {
      const sp = pl.sp;
      if (sp.ult && sp.phase === 'lunge' && !sp.held && victim && victim.w !== undefined) {
        sp.held = victim; sp.phase = 'press'; sp.t = 0; FX.hitstop(pl.move.grab.hitstop);
      }
    },
    onLand: NOOP,
    /** Bulwark Catch: negate a catchable hit during the stance and answer with the Counter-Slam. */
    tryCatch: function (pl, fromX, game, opts) {
      if (pl.moveName !== 'special' || pl.sp.phase !== 'stance' || pl.sp.ult || !game) return false;
      let proj = null;
      const hit = opts && opts.hit ? opts.hit : null;   // the engine passes the descriptor for registered hits (contact: null)
      if (hit) {
        if (hit.flags & 1) return false;                                 // unblockable (DESIGN §8.5): hurts normally
        if (hit.src && hit.src !== game.boss && (hit.flags & 2 || game.projectiles.indexOf(hit.src) >= 0)) proj = hit.src;
      } else for (let i = 0; i < game.hitCount; i++) {                   // fallback: scan this frame's hits overlapping the body
        const h = game.hits[i];
        if (!h || h.owner === 'player' || !E.overlapBox(pl, h.x, h.y, h.w, h.h)) continue;
        if (h.flags & 1) return false;
        if (h.src && h.src !== game.boss && (h.flags & 2 || game.projectiles.indexOf(h.src) >= 0)) proj = h.src;
      }
      if (proj) { proj.dead = true; FX.burst('spark', proj.x, proj.cy(), 6, { color: P.PAPER }); }
      const m = pl.data.moves.special, c = m.counter;
      if (fromX !== undefined && fromX !== null) { const s = U.sign(fromX - pl.x); if (s) pl.facing = s; }
      FX.hitstop(6); FX.shake(3, 6); FX.burst('ring', pl.x + pl.facing * 14, pl.cy(), 1, { radius: 36, life: 8 });
      pl.sp.flash = 3; pl.sp.caught = true;
      game.addEnergy(c.refund); game.addMeter(c.meter, true);
      Au.sfx('special', pl.x);
      pl.startMove('counter', c);
      pl.guard = c.s + c.a + c.r;                                          // the caught attack cannot land during the answer
      return true;
    },
  };
  // Korvask's counter-slam is a generic move: give it the shared defaults.
  mv(DATA.korvask.moves.special.counter);

  // =====================================================================================
  // Draw (DESIGN §11.2.3): squash/stretch, Overclock scale + palette crossfade, death, afterimages
  // =====================================================================================
  const WHITE = '#FFFFFF', GHOST_ALPHA = 0.4;
  /** A boolean comfort setting (F02) — read live; a missing key (older settings file) is off. */
  function comfort(game, key) { const s = game && game.settings; return !!(s && s[key] === true); }
  Player.prototype.draw = function (ctx, game, alpha) {
    // i-frame blink (playtest B43): the "off" beats draw a dimmed silhouette with a bright outline instead of nothing,
    // so the fighter is never lost on screen. STEADY SILHOUETTE (F02): no blink at all — the body stays fully drawn
    // and a steady outline in the fighter's glow marks the invulnerable frames.
    const steady = comfort(game, 'steadySilhouette');
    const inv = this.iframes > 0 && !this.dead;
    const ghost = inv && !steady && ((this.iframes >> 2) & 1) === 1;
    const d = this.data, x = U.lerp(this.px, this.x, alpha), y = U.lerp(this.py, this.y, alpha);
    // palette: Overclock ramp (transform / active / revert) or the death desaturation
    let pal = d.pal;
    if (this.dead) pal = d.greyRamp[Math.min(RAMP_N, Math.round(this.deathTimer / 40 * RAMP_N))];
    else if (this.ocActive) pal = d.ocPal;
    else if (this.ocTransform > 0) pal = d.ocRamp[Math.round((1 - this.ocTransform / (R.ocTransform - 8)) * RAMP_N)];
    else if (this.ocRevert > 0) pal = d.ocRamp[Math.round(this.ocRevert / R.ocRevert * RAMP_N)];
    this.curPal = pal;
    let sx = this.squashX, sy = this.squashY, rot = 0, a = 1;
    if (this.squashT > 0 && this.squashMax > 0) { const k = 1 - Math.pow(1 - this.squashT / this.squashMax, 2); sx = 1 + (this.squashX - 1) * k; sy = 1 + (this.squashY - 1) * k; }
    if (!this.onGround && !this.dead && !this.dashing) sy *= 1 + Math.min(0.12, Math.max(0, this.vy) / 9000);
    const ocK = this.ocActive ? 1 : (this.ocTransform > 0 ? 1 - this.ocTransform / (R.ocTransform - 8) : (this.ocRevert > 0 ? this.ocRevert / R.ocRevert : 0));
    if (ocK > 0) { sx *= 1 + 0.25 * ocK; sy *= 1 + 0.25 * ocK; }
    if (this.dead) { const k = Math.min(1, this.deathTimer / 40); sy *= 1 - 0.7 * k; rot = 25 * k * DEG; a = this.deathTimer > 40 ? 1 - (this.deathTimer - 40) / 20 : 1; }
    if (ghost) a *= GHOST_ALPHA;
    if (this.program.drawWorld) this.program.drawWorld(ctx, this, alpha);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    let ox = 0, oy = 0;
    if (this.hurtTimer > 0 && this.hurtTimer > R.hurtFrames - 6) { ox = U.jitter(this.t, 1, 2); oy = U.jitter(this.t, 2, 2); }
    ctx.translate(x + ox, y + oy); ctx.scale(this.facing * sx, sy);
    if (ocK > 0) { // body halo
      ctx.globalAlpha *= 0.12 + 0.04 * Math.sin(this.t / 20 * TAU);
      ctx.fillStyle = pal.glow; ctx.beginPath(); ctx.ellipse(0, -this.h / 2, this.w * 0.8, this.h * 0.8, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = Math.max(0, a);
    }
    ctx.translate(0, -this.h / 2); ctx.rotate(rot);
    const rigDef = this.rig, shapes = rigDef.rig.shapes;
    const lean = rigDef.pose(rigDef.rig, this);
    if (lean) ctx.rotate(lean * DEG);
    // the hurt tint: 2 f white then DANGER — REDUCED FLASHING (F02) skips the white beat (a red tint only, no body flash)
    const tint = this.flash > 0 ? (this.flash > 4 && !comfort(game, 'reducedFlashing') ? WHITE : P.DANGER) : null;
    if (this.id === 'vellix' && (Math.abs(this.vx) > 240 || this.ocActive) && !this.dead) { // afterimage ghosts
      const n = this.ocActive ? 3 : 2;
      for (let i = n; i >= 1; i--) {
        ctx.save(); ctx.translate(-8 * i * U.sign(this.vx || this.facing) * this.facing, 0); ctx.globalAlpha = Math.max(0, a) * (i === 1 ? 0.25 : (i === 2 ? 0.12 : 0.07));
        drawRig(ctx, shapes, pal, null, 0); ctx.restore();
      }
    }
    drawRig(ctx, shapes, pal, tint, 0.6, ghost || (steady && inv) ? pal.glow : null);
    rigDef.extras(ctx, this, pal);
    ctx.restore();
    if (this.denyT > 0 && !this.dead) drawDenyCue(ctx, x, y - this.h * sy - 16, this.denyT);
  };
  /** The refused-press cue (B31): a small ringed slash over the head, popping in and fading out. */
  function drawDenyCue(ctx, x, y, t) {
    const k = t / DENY_FRAMES, r = 8 + 3 * Math.max(0, k - 0.75) * 4;
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 2.5); ctx.lineCap = 'round';
    ctx.strokeStyle = P.INK; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.moveTo(x - r * 0.7, y + r * 0.7); ctx.lineTo(x + r * 0.7, y - r * 0.7); ctx.stroke();
    ctx.strokeStyle = P.DANGER; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.moveTo(x - r * 0.7, y + r * 0.7); ctx.lineTo(x + r * 0.7, y - r * 0.7); ctx.stroke();
    ctx.restore();
  }

  // --- select-screen preview: idle rig (x, y = feet) --------------------------------------------
  const previews = {}, idleTops = {};
  /** Highest point (min local y, body centre = 0) of a posed rig's shapes — line widths included, approximately. */
  function rigTop(shapes) {
    let top = 0;
    for (let i = 0; i < shapes.length; i++) {
      const s = shapes[i]; if (s.off) continue;
      let y = 0;
      switch (s.k) {
        case K_ELL: case K_ARC: y = s.y - (s.rot || s.k === K_ARC ? Math.max(s.w, s.h) : s.h); break;
        case K_RR: y = s.y - (s.rot ? Math.max(s.w, s.h) : s.h) / 2; break;
        case K_DOT: y = s.y - s.r; break;
        case K_WEDGE: { const c = Math.cos(s.rot * DEG), sn = Math.sin(s.rot * DEG), hy = Math.abs(c * s.h / 2); y = Math.min(s.y - hy, s.y + sn * s.w); break; }
        case K_POLY: { y = 1e9; for (let j = 0; j < s.n; j++) if (s.pts[j * 2 + 1] + s.y < y) y = s.pts[j * 2 + 1] + s.y; break; }
        default: { const p = s.pts; y = 1e9; for (let j = 1; j < p.length; j += 2) if (p[j] < y) y = p[j]; y -= s.lw / 2; }
      }
      if (y < top) top = y;
    }
    return top;
  }
  /** The idle pose's highest point per fighter (cached; posing is deterministic). */
  function idleTop(rigDef, d) {
    if (idleTops[d.id] === undefined) {
      const v = previews[d.id], st = v.state, t = v.t, stT = v.stateT, og = v.onGround;
      v.state = 'idle'; v.t = 0; v.stateT = 0; v.onGround = true;
      rigDef.pose(rigDef.rig, v); idleTops[d.id] = rigTop(rigDef.rig.shapes);
      v.state = st; v.t = t; v.stateT = stT; v.onGround = og;
      rigDef.pose(rigDef.rig, v);
    }
    return idleTops[d.id];
  }
  function previewView(d) {
    return { state: 'idle', stateT: 0, t: 0, moveName: '', move: null, moveT: 0, vx: 0, vy: 0, onGround: true, facing: 1, ocActive: false, ocTransform: 0,
      connected: false, hurtTimer: 0, flash: 0, dashing: false, clinging: false, w: d.box.w, h: d.box.h, data: d, sp: { phase: '', ringOut: false, flash: 0 }, beamT: 0 };
  }
  for (const id in DATA) previews[id] = previewView(DATA[id]);
  // DESIGN §12.10 showcase: 180 f of idle, then one pose of the cycle held for its §4.2 frames (48 f slot)
  const POSES = ['run', 'light1', 'light2', 'light3', 'jump', 'heavy'], POSE_SLOT = 228, POSE_IDLE = 180, PREVIEW_HOP = 0.25;
  function drawPreview(ctx, id, x, y, scale, t, showcase) {
    const d = DATA[id] || list[0], v = previews[d.id], rigDef = RIGS[d.id];
    t = t | 0;
    v.t = v.stateT = t;
    let bob = 1 + 0.015 * Math.sin(t / 40 * TAU), dy = 0, hop = 0;
    if (showcase) {
      const slot = t % POSE_SLOT, k = slot - POSE_IDLE, pose = POSES[Math.floor(t / POSE_SLOT) % POSES.length];
      if (k >= 0) {
        if (pose === 'run') { v.state = 'run'; v.vx = d.run; v.stateT = k; bob = 1; }
        else if (pose === 'jump') { const a = k / 47; v.state = a < 0.5 ? 'jump' : 'fall'; v.onGround = false; v.vy = -600 + a * 1200; v.stateT = k; hop = Math.sin(a * Math.PI); bob = 1; }
        else { const m = d.moves[pose], total = m.s + m.a + m.r; if (k < total) { v.state = 'attack'; v.moveName = pose; v.move = m; v.moveT = k + 1; v.stateT = k; bob = 1; } }
      }
    }
    rigDef.pose(rigDef.rig, v);
    if (hop > 0) {
      // the showcase hop (playtest B32): the rig's highest point rises at most a quarter of the fighter's real apex at the
      // preview scale (Tessik ≈ 28 px at ×3) — the airborne pose's own reach (raised arms) counts toward it — so the jump
      // reads (and compares between fighters) while the rig stays inside its portrait, never over the select header
      const reach = Math.max(0, (idleTop(rigDef, d) - rigTop(rigDef.rig.shapes)) * scale);
      dy = -hop * Math.max(0, d.jumpHeight * PREVIEW_HOP * scale / 3 - reach);
    }
    ctx.save();
    ctx.translate(x, y + dy); ctx.scale(scale, scale * bob);
    ctx.translate(0, -d.box.h / 2);
    drawRig(ctx, rigDef.rig.shapes, d.pal, null, 0);
    rigDef.extras(ctx, v, d.pal);
    ctx.restore();
    v.state = 'idle'; v.moveName = ''; v.move = null; v.moveT = 0; v.vx = 0; v.vy = 0; v.onGround = true;   // the view is shared with the card previews
  }

  UB.Characters = {
    DATA: DATA,
    list: list,
    RULES: R,
    /** Create the player entity for a fighter id (unknown id → the first fighter). */
    create: function (id, game) { return new Player(DATA[id] || list[0], game); },
    drawPreview: drawPreview,
    Player: Player,
    RIGS: RIGS,
    SPECIALS: SPECIALS,
  };
})(window.UB);
