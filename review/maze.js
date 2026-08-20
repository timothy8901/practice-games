/**
 * maze.js — the human-in-the-loop harness for the daily maze.
 *
 * Drive the seed you are reviewing, jump straight to the bit you want to test,
 * see the publish gate for that seed and for the next fortnight of seeds, and
 * leave feedback that records which seed you were on when you wrote it.
 *
 * PHYSICS-ENGINE-HANDOFF.md §13 recommends stealing this pattern wholesale:
 * "it let a human sign off on feel while automated checks covered correctness,
 * and the jump-straight-to-the-thing-I-want-to-test button saved enormous
 * amounts of time."
 *
 * The one design question the handoff insists on putting in front of a human on
 * day one is §1.1 — whether the world visibly tilts. It is the first toggle.
 */

import { generateMaze, dailySeed, seedForDate, isoToday, NOT_AUTO_PLACED } from '../3d-mazeball/src/generator.js';
import { assembleMaze, behavioursAt } from '../3d-mazeball/src/assemble.js';
import { validateSeed, validateRun } from '../3d-mazeball/src/validate.js';
import { Ball, stepBall, tiltUp, gatherFrom, supportUnder, FIXED, MAX_TILT, GRAVITY } from '../3d-mazeball/src/physics.js';
import { bodiesFor } from '../3d-mazeball/src/dynamics.js';
import { resolveEnv } from '../3d-mazeball/src/behaviors.js';
import { PIECE_BY_ID, KIT_VERSION, KIT_NAME } from '../3d-mazeball/src/pieces.js';
import { BALL_R, TUNING, DELTA } from '../3d-mazeball/src/kit.js';
import { Mesher } from '../3d-mazeball/src/mesher.js';
import { Viewer, multiply, lookAt, perspective } from './gl.js';

const $ = s => document.querySelector(s);
const STORE = `ratball-maze-review::${KIT_VERSION}`;

function el (tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    n.append(k.nodeType ? k : document.createTextNode(String(k)));
  }
  return n;
}

/* ── feedback state ───────────────────────────────────────────────────── */

const ASPECTS = [
  ['control', 'Control feel', 'Does tilting read as tilting a stage? Is it precise enough to thread a corridor, loose enough to overshoot?'],
  ['camera', 'Camera', 'Over-the-shoulder in a corridor. Does it clip, whip, or hide the corner you are about to take?'],
  ['worldtilt', 'World tilt (handoff §1.1)', 'The toggle above. Full tilt, partial, or none — which one would you ship?'],
  ['difficulty', 'Difficulty curve', 'Does it ramp? Is the end harder than the start in the way you want?'],
  ['variety', 'Generator variety', 'Play two or three days. Do they feel like different puzzles or the same one reshuffled?'],
  ['pieces', 'Specific pieces in situ', 'Which pieces read badly, play badly, or block you when they should not?'],
  ['pacing', 'Length and pacing', 'Is one run the right size for a daily? Where does it sag?'],
  ['other', 'Anything else', ''],
];
const SEVERITIES = [['must', 'must fix'], ['should', 'should improve'], ['question', 'question']];

const state = load() || {
  reviewer: '', verdict: null, aspects: {}, startedAt: new Date().toISOString(), seedsPlayed: [],
};
function load () { try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; } }
let saveT = null;
function save () {
  clearTimeout(saveT);
  saveT = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private mode */ } }, 180);
}
const aspect = k => (state.aspects[k] ||= { comments: [] });

/* ── world ────────────────────────────────────────────────────────────── */

let maze = null, world = null, bodies = [], viewer = null, glError = null;
let seedInfo = { iso: isoToday(), seed: dailySeed(), size: 6 };
let checkResult = null;

const view = { follow: true, trainingWheels: false, worldTilt: true, route: false, collision: false, overhead: false };
const input = { f: 0, r: 0, camYaw: 0, paused: false };
const cam = {
  yaw: 0, pitch: 0.42, dist: 4.2, height: 1.75, pos: [0, 3, 8], fov: 0.95,
  shoulder: 0.55,        // lateral offset of the boom — the "over the shoulder" part
};

/**
 * Chase-camera state.
 *
 * Handoff §6, change 1: in open terrain, swinging the camera to follow velocity
 * is great; in a maze the ball ricochets off walls, the velocity direction
 * flips, and the camera whips. The fix it recommends is not to disable
 * alignment but to make it lazy — only align once the heading has held steady
 * for a beat. That is what `stable` is for.
 */
const follow = {
  heading: 0,        // the direction of travel we are currently willing to trust
  ratYaw: 0,         // which way the rat itself is facing
  stable: 0,         // seconds the heading has held
  manualUntil: 0,    // stage time until which the player's own camera input wins
};

const TAU = Math.PI * 2;
/** Shortest signed difference a − b, wrapped to [−π, π]. */
function angleDelta (a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
const run = { t: 0, falls: 0, started: false, finished: false, best: null, checkpoint: null };

let ball = new Ball(BALL_R);

function buildWorld () {
  const t0 = performance.now();
  maze = generateMaze({ seed: seedInfo.seed, width: seedInfo.size, height: seedInfo.size });
  world = assembleMaze(maze, { trainingWheels: view.trainingWheels });
  bodies = bodiesFor(world);
  const ms = performance.now() - t0;

  $('#seed-label').textContent = `${seedInfo.iso}  ·  seed 0x${seedInfo.seed.toString(16)}`;
  $('#maze-stats').textContent =
    `${maze.stats.occupied} tiles · ${maze.stats.pathLength}-tile route (${maze.stats.metres} m) · `
    + `${maze.stats.distinctPieces} distinct pieces · ${world.stats.renderTriangles.toLocaleString()} tris · `
    + `${world.stats.drawCalls} draw calls · ${world.stats.colliders} colliders`;
  $('#gen-time').textContent = `generated in ${ms.toFixed(0)} ms`;

  if (viewer) {
    viewer.cache.clear();
    for (const g of world.groups) {
      viewer.uploadGroup(`static:${g.material}`, {
        positions: g.positions, normals: g.normals, colors: g.colors,
        opacity: g.spec.opacity ?? 1, emissive: g.spec.emissive ?? 0,
      });
    }
    world.dynamicGroups.forEach((g, i) => viewer.uploadGroup(`dyn:${i}`, g));
    buildCharacter();
  }

  buildJumpList();
  respawn(true);
  runChecks();
  if (!state.seedsPlayed.includes(seedInfo.iso)) { state.seedsPlayed.push(seedInfo.iso); save(); }
}

/* ── the rat, and the shell it rides in ───────────────────────────────── */

function buildCharacter () {
  // Handoff §7: the character stays upright and only the shell spins, and the
  // shell needs bands or a transparent sphere just looks like it is sliding.
  const m = new Mesher();
  const grey = '#9b968f', pink = '#e8a9ad', dark = '#3a3833';
  m.sphere(0, 0, 0, 0.19, 'rat', { color: grey, rows: 7, cols: 10 });
  m.sphere(0, 0.06, -0.17, 0.13, 'rat', { color: grey, rows: 6, cols: 9 });
  m.sphere(0, 0.02, -0.28, 0.07, 'rat', { color: pink, rows: 5, cols: 7 });
  for (const s of [-1, 1]) {
    m.sphere(s * 0.1, 0.17, -0.14, 0.07, 'rat', { color: pink, rows: 5, cols: 7 });
    m.sphere(s * 0.05, 0.08, -0.27, 0.025, 'rat', { color: dark, rows: 4, cols: 6 });
    m.box(s * 0.14, -0.12, 0.02, 0.07, 0.16, 0.07, 'rat', { color: grey });
  }
  for (let i = 0; i < 5; i++) {
    m.sphere(0, -0.02 + i * 0.012, 0.2 + i * 0.075, 0.035 - i * 0.004, 'rat', { color: pink, rows: 4, cols: 6 });
  }
  const rat = m.build().find(g => g.material === 'rat');
  viewer.uploadGroup('rat', { positions: rat.positions, normals: rat.normals, colors: rat.colors });

  const s = new Mesher();
  s.sphere(0, 0, 0, BALL_R, 'shell', { color: '#bfe6ff', rows: 12, cols: 18 });
  const shell = s.build().find(g => g.material === 'shell');
  viewer.uploadGroup('shell', {
    positions: shell.positions, normals: shell.normals, colors: shell.colors, opacity: 0.3,
  });

  const b = new Mesher();
  for (let k = 0; k < 3; k++) {
    const axis = k === 0 ? 'y' : k === 1 ? 'x' : 'z';
    for (let i = 0; i < 28; i++) {
      const a0 = (i / 28) * Math.PI * 2, a1 = ((i + 1) / 28) * Math.PI * 2;
      const P = a => (axis === 'y' ? [Math.cos(a) * BALL_R, 0, Math.sin(a) * BALL_R]
        : axis === 'x' ? [Math.cos(a) * BALL_R, Math.sin(a) * BALL_R, 0]
          : [0, Math.sin(a) * BALL_R, Math.cos(a) * BALL_R]);
      b.tube(P(a0), P(a1), 0.012, 'band', { seg: 4, color: '#7ec8ff', collide: false });
    }
  }
  const band = b.build().find(g => g.material === 'band');
  viewer.uploadGroup('band', {
    positions: band.positions, normals: band.normals, colors: band.colors, emissive: 0.5,
  });
}

/* ── spawn / respawn ──────────────────────────────────────────────────── */

function respawn (full = false) {
  const at = run.checkpoint || world.spawn;
  ball = new Ball(BALL_R);
  ball.p = { x: at.x, y: at.y + 0.1, z: at.z };
  // Handoff §11.2: probe down before committing, never trust the nominal height.
  const support = supportUnder(world.colliders, ball.p.x, ball.p.z, ball.p.y + 3);
  if (Number.isFinite(support)) ball.p.y = support + BALL_R + 0.02;

  // Face down the corridor the ball is about to travel. The camera looks along
  // (sin yaw, cos yaw), so the yaw that faces a direction is atan2(dx, dz) —
  // negating both put the camera behind the ball looking back up the corridor.
  const exit = run.checkpoint
    ? aheadOnRoute(run.checkpoint)
    : { x: DELTA[world.spawn.dir][0], z: DELTA[world.spawn.dir][1] };
  cam.yaw = Math.atan2(exit.x, exit.z);
  follow.heading = cam.yaw;
  follow.ratYaw = cam.yaw;
  follow.stable = 0;
  follow.manualUntil = 0;

  if (full) { run.t = 0; run.falls = 0; run.started = false; run.finished = false; run.checkpoint = null; }
}

/** Direction toward the next waypoint after a point on the route. */
function aheadOnRoute (at) {
  let best = 0, bestD = Infinity;
  world.waypoints.forEach((w, i) => {
    const d = (w.x - at.x) ** 2 + (w.z - at.z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  });
  const next = world.waypoints[Math.min(world.waypoints.length - 1, best + 1)];
  const dx = next.x - at.x, dz = next.z - at.z;
  const L = Math.hypot(dx, dz) || 1;
  return { x: dx / L, z: dz / L };
}

/* ── jump-to ──────────────────────────────────────────────────────────── */

function buildJumpList () {
  const sel = $('#jump');
  const opts = [el('option', { value: '-1' }, 'start')];
  const seen = new Set();
  for (const wp of world.waypoints) {
    if (seen.has(wp.cell)) continue;
    seen.add(wp.cell);
    const cell = maze.cellAt.get(wp.cell);
    if (!cell) continue;
    const p = PIECE_BY_ID.get(cell.pieceId);
    opts.push(el('option', { value: String(world.waypoints.indexOf(wp)) },
      `${String(wp.index).padStart(2, '0')} · #${String(p.id).padStart(2, '0')} ${p.name}`));
  }
  sel.replaceChildren(...opts);
  sel.value = '-1';
}

$('#jump').addEventListener('change', e => {
  const i = Number(e.target.value);
  if (i < 0) { run.checkpoint = null; respawn(true); return; }
  const wp = world.waypoints[i];
  run.checkpoint = { x: wp.x, y: wp.y, z: wp.z };
  respawn();
  $('#stage').focus();
});

/* ── checks ───────────────────────────────────────────────────────────── */

function checkRow (cls, what, detail) {
  return el('div', { class: `check-row ${cls}` },
    el('span', { class: 'mark' }, cls === 'pass' ? '✓' : cls === 'warn' ? '!' : '✗'),
    el('span', { class: 'what' }, what),
    detail ? el('span', { class: 'detail' }, detail) : null);
}

function runChecks () {
  $('#checks').textContent = 'running…';
  setTimeout(() => {
    let r;
    try { r = validateSeed(seedInfo.seed, { width: seedInfo.size, height: seedInfo.size }); }
    catch (e) { $('#checks').replaceChildren(checkRow('fail', 'checks threw', e.message)); return; }
    checkResult = r;
    const p = r.physics;
    const rows = [
      checkRow(r.graph.pass ? 'pass' : 'fail', 'Graph — start reaches goal through matching sockets',
        `${r.graph.reached}/${r.graph.total} tiles`),
      checkRow(r.clearance.pass ? 'pass' : 'fail', 'Clearance — a ball fits the whole solution',
        `worst ${r.clearance.worst} m vs r ${BALL_R}`),
      r.clearance.grazes.length
        ? checkRow('warn', 'Clearance — grazing contacts', `${r.clearance.grazes.length} spot(s)`) : null,
      r.clearance.gapsByDesign.length
        ? checkRow('pass', 'Gaps by design (broken bridge, pit, dashed)', `${r.clearance.gapsByDesign.length}`) : null,
      checkRow(p.pass ? 'pass' : 'fail', 'Physics — reference bot reached the goal',
        `${p.seconds}s · ${p.falls} falls · ${p.resets} resets`),
      checkRow(p.clean ? 'pass' : 'warn', 'Physics — driven clean, no assisted segments',
        p.clean ? 'all segments' : `${(p.skipped || []).length} needed help`),
      checkRow(r.reproducible ? 'pass' : 'fail', 'Reproducible — same seed, same maze', r.fingerprint),
      checkRow(r.unplaceable.length ? 'fail' : 'pass', 'Every socket signature had a piece',
        r.unplaceable.length ? `${r.unplaceable.length} unplaceable` : 'no gaps'),
    ].filter(Boolean);

    if ((p.skipped || []).length) {
      rows.push(el('div', { class: 'check-row warn' },
        el('span', { class: 'mark' }, '→'),
        el('span', { class: 'what' },
          'Needed help at: ' + p.skipped.map(s => `#${String(s.piece).padStart(2, '0')} ${PIECE_BY_ID.get(s.piece)?.name || '?'}`).join(', '))));
    }
    $('#checks').replaceChildren(...rows);
  }, 30);
}

$('#recheck').addEventListener('click', runChecks);

/* ── seed sweep ───────────────────────────────────────────────────────── */

$('#sweep').addEventListener('click', () => {
  const days = Math.max(1, Math.min(60, Number($('#sweep-days').value) || 14));
  const out = $('#sweep-out');
  out.replaceChildren(el('p', { class: 'lede small' }, `running ${days} days…`));
  setTimeout(() => {
    const base = new Date(`${seedInfo.iso}T00:00:00Z`);
    const isos = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(base.getTime() + i * 86400000);
      isos.push(isoToday(d));
    }
    const t0 = performance.now();
    const r = validateRun(isos.map(seedForDate), { width: seedInfo.size, height: seedInfo.size });
    const ms = performance.now() - t0;
    const grid = el('div', { class: 'sweep-grid' });
    r.results.forEach((res, i) => {
      const cls = !res.pass ? 'bad' : res.clean ? 'clean' : 'open';
      grid.append(el('button', {
        class: `sweep-day ${cls}`, title: `${isos[i]} — ${cls}`,
        onclick: () => { setDate(isos[i]); },
      }, isos[i].slice(8)));
    });
    $('#sweep-count').textContent = `(${r.passed}/${r.total} open, ${r.clean}/${r.total} clean)`;
    out.replaceChildren(
      grid,
      el('p', { class: 'small dim' }, `${ms.toFixed(0)} ms · click a day to load it`),
      r.blockers.length
        ? el('div', {},
          el('p', { class: 'small', style: 'margin:6px 0 4px' }, 'Segments the reference bot could not drive:'),
          el('ul', { class: 'blockers' }, ...r.blockers.map(b => el('li', {},
            `#${String(b.piece).padStart(2, '0')} ${PIECE_BY_ID.get(b.piece)?.name || '?'} `,
            el('span', { class: 'n' }, `×${b.count}`)))))
        : el('p', { class: 'small dim' }, 'no blocked segments'),
    );
  }, 30);
});

/* ── input ────────────────────────────────────────────────────────────── */

const keys = new Set();
const stage = $('#stage');
stage.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === 'r') { run.falls++; respawn(); }
  if (e.key === ' ') input.paused = !input.paused;
});
stage.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
stage.addEventListener('blur', () => keys.clear());

let drag = null;
stage.addEventListener('pointerdown', e => { drag = e.clientX; stage.setPointerCapture(e.pointerId); stage.focus(); });
stage.addEventListener('pointermove', e => {
  if (drag == null) return;
  cam.yaw -= (e.clientX - drag) * 0.007;
  drag = e.clientX;
  follow.manualUntil = run.t + 1.6;
});
stage.addEventListener('pointerup', e => { drag = null; stage.releasePointerCapture(e.pointerId); });

function readInput (dt) {
  const k = keys;
  const wantF = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
  const wantR = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
  // Tilt eases toward the stick rather than snapping — handoff §3, `dt * 11`.
  const ease = Math.min(1, dt * TUNING.tiltEase);
  input.f += (wantF * MAX_TILT - input.f) * ease;
  input.r += (wantR * MAX_TILT - input.r) * ease;
  const yaw = (k.has('e') ? 1 : 0) - (k.has('q') ? 1 : 0);
  if (yaw) { cam.yaw += yaw * dt * 2.2; follow.manualUntil = run.t + 1.6; }
}

/**
 * Swing the camera round behind the rat and keep it there.
 *
 * Three gates, in order of how much trouble each one saves:
 *
 * 1. **Speed.** Below a walking pace the direction of travel is noise — a ball
 *    settling against a kerb has a velocity pointing sideways. Under the
 *    threshold the camera simply holds where it is.
 * 2. **Stability.** The heading has to hold within ~30° for `HOLD` seconds
 *    before the camera commits to it. Without this the camera spins on every
 *    bounce, which is the exact failure the handoff warns about.
 * 3. **Manual override.** Q/E or a drag suspends the follow for 1.6 s, so
 *    looking around does not fight the camera, and it re-centres afterwards.
 */
const FOLLOW_MIN_SPEED = 2.0;
const FOLLOW_HOLD = 0.3;
function updateFollowCam (dt) {
  const vx = ball.v.x, vz = ball.v.z;
  const speed = Math.hypot(vx, vz);

  // The rat turns to face where it is going well before the camera commits —
  // it should never look like it is being dragged sideways.
  if (speed > 0.7) {
    const h = Math.atan2(vx, vz);
    follow.ratYaw += angleDelta(h, follow.ratYaw) * Math.min(1, dt * 7);
  }

  if (!view.follow || view.overhead) return;
  if (run.t < follow.manualUntil) return;
  if (speed < FOLLOW_MIN_SPEED) { follow.stable = 0; return; }

  const heading = Math.atan2(vx, vz);
  if (Math.abs(angleDelta(heading, follow.heading)) > 0.55) {
    follow.heading = heading;
    follow.stable = 0;
    return;
  }
  follow.heading += angleDelta(heading, follow.heading) * Math.min(1, dt * 6);
  follow.stable += dt;
  if (follow.stable < FOLLOW_HOLD) return;

  // Ease in proportion to how far off we are, so a small correction is gentle
  // and a full reversal still gets there in about a second.
  const err = angleDelta(follow.heading, cam.yaw);
  cam.yaw += err * Math.min(1, dt * (1.6 + Math.abs(err) * 1.4));
}

/* ── fixed-step loop (handoff §2.5) ───────────────────────────────────── */

let acc = 0, last = 0, raf = null;

function frame (now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000 || 0);
  last = now;
  if (!world) return;

  readInput(dt);
  updateFollowCam(dt);

  if (!input.paused && !run.finished) {
    acc += dt;
    let steps = 0;
    while (acc >= FIXED && steps < 8) {
      const up = tiltUp(cam.yaw, input.f, input.r);
      const env = resolveEnv(behavioursAt(world, ball.p.x, ball.p.z), ball);
      stepBall(ball, gatherFrom(world.colliders), up, FIXED, env);
      for (const b of bodies) { b.advance(run.t, FIXED); b.resolve(ball, run.t, FIXED); }
      acc -= FIXED; steps++;
      run.t += FIXED;
      if (Math.hypot(ball.v.x, ball.v.y, ball.v.z) > 0.5) run.started = true;
    }

    // Fall-out: back to the corridor entrance with a time penalty, never a life
    // (handoff §5.4). The threshold is small so the reset is snappy.
    const floor = run.checkpoint ? run.checkpoint.y : world.spawn.y;
    if (ball.p.y < floor - 11) { run.falls++; run.t += 3; respawn(); }

    const g = world.goal;
    if (!run.finished && Math.hypot(ball.p.x - g.x, ball.p.z - g.z) < g.radius && Math.abs(ball.p.y - g.y) < 3) {
      run.finished = true;
      if (run.best == null || run.t < run.best) run.best = run.t;
    }
  }

  draw();
  drawHud();
  drawTilt();
}

/* ── camera (handoff §6) ──────────────────────────────────────────────── */

function cameraFor () {
  if (view.overhead) {
    const b = world.bounds;
    const cx = (b.lo[0] + b.hi[0]) / 2, cz = (b.lo[2] + b.hi[2]) / 2;
    const span = Math.max(b.hi[0] - b.lo[0], b.hi[2] - b.lo[2]);
    return { eye: [cx, span * 0.95, cz + 0.001], at: [cx, 0, cz], fov: 0.95 };
  }
  const speed = Math.hypot(ball.v.x, ball.v.y, ball.v.z);
  // Speed pull-back is deliberately small: in a corridor a long boom just puts
  // the camera inside the wall behind you (handoff §6, change 3).
  const dist = cam.dist + Math.min(1.6, speed * 0.05);
  const want = [
    ball.p.x - Math.sin(cam.yaw) * dist * Math.cos(cam.pitch),
    ball.p.y + cam.height + Math.sin(cam.pitch) * dist,
    ball.p.z - Math.cos(cam.yaw) * dist * Math.cos(cam.pitch),
  ];
  // Change 2: do not clip through walls. Pull the boom in to the first point
  // where geometry sits AT or ABOVE it — a deck the boom has ended up inside or
  // underneath. Testing "is there a floor below the boom" instead pulls the
  // camera in over every corridor, because there always is one.
  const dx = want[0] - ball.p.x, dy = want[1] - ball.p.y, dz = want[2] - ball.p.z;
  let t = 1;
  for (let s = 0.3; s <= 1; s += 0.1) {
    const px = ball.p.x + dx * s, py = ball.p.y + dy * s, pz = ball.p.z + dz * s;
    const sup = supportUnder(world.colliders, px, pz, py + 6);
    if (Number.isFinite(sup) && sup > py - 0.15) { t = Math.max(0.4, s - 0.1); break; }
  }
  // Over the shoulder rather than dead astern: the boom is offset sideways and
  // the look-at is offset less, so the rat sits off-centre and you can see the
  // corridor it is heading into instead of the back of its own head.
  const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
  const s = view.overhead ? 0 : cam.shoulder;
  const eye = [
    ball.p.x + dx * t + rx * s,
    ball.p.y + dy * t,
    ball.p.z + dz * t + rz * s,
  ];
  cam.pos = cam.pos.map((v, i) => v + (eye[i] - v) * 0.28);
  return {
    eye: cam.pos,
    at: [ball.p.x + rx * s * 0.3, ball.p.y + 0.5, ball.p.z + rz * s * 0.3],
    fov: 0.92 + Math.min(0.22, speed * 0.02),
  };
}

/* ── draw ─────────────────────────────────────────────────────────────── */

function sizeStage () {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = stage.getBoundingClientRect();
  const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
  if (stage.width !== w || stage.height !== h) { stage.width = w; stage.height = h; }
}

const I = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function tiltMatrix () {
  // Handoff §1.1 — the *visual* tilt is a separate decision from the physics
  // tilt. The world rotates by the inverse of the tilt, pivoted on the ball, so
  // the horizon tips while the ball stays put on screen. In a corridor that can
  // read as nausea rather than feedback, which is why it is a toggle and why the
  // strength is partial rather than 1.0.
  if (!view.worldTilt || view.overhead) return I();
  const strength = 0.35;                        // partial, per the handoff's recommendation
  const up = tiltUp(cam.yaw, input.f * strength, input.r * strength);
  const m = I();
  // Rotate the world so `up` lands on +Y, about the axis up × Y, pivoted on the
  // ball. Applying the rotation itself (rather than its inverse) would tip the
  // world the same way as gravity and cancel the cue entirely.
  const ax = up.z, ay = 0, az = -up.x;          // up × (0, 1, 0)
  const s = Math.hypot(ax, ay, az);
  if (s < 1e-6) return m;
  const nx = ax / s, ny = ay / s, nz = az / s;
  const ang = -Math.atan2(s, up.y);
  const C = Math.cos(ang), S = Math.sin(ang), t = 1 - C;
  const R = [
    [t * nx * nx + C, t * nx * ny - S * nz, t * nx * nz + S * ny],
    [t * nx * ny + S * nz, t * ny * ny + C, t * ny * nz - S * nx],
    [t * nx * nz - S * ny, t * ny * nz + S * nx, t * nz * nz + C],
  ];
  const p = [ball.p.x, ball.p.y, ball.p.z];
  for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) m[col * 4 + row] = R[row][col];
  for (let row = 0; row < 3; row++) {
    m[12 + row] = p[row] - (R[row][0] * p[0] + R[row][1] * p[1] + R[row][2] * p[2]);
  }
  return m;
}

function draw () {
  if (!viewer) return;
  sizeStage();
  const c = cameraFor();
  const mvp = viewer.beginFrame(c);
  const T = tiltMatrix();

  for (const g of world.groups) viewer.drawGroup(`static:${g.material}`, mvp, T);
  world.dynamicGroups.forEach((g, i) => {
    const body = bodies.find(b => b.cell === g.cell && b.effect === g.effect);
    const M = body ? body.modelMatrix(run.t) : I();
    viewer.drawGroup(`dyn:${i}`, mvp, multiply(T, M));
  });

  if (view.route) viewer.drawPath(world.waypoints, mvp, [1, 0.82, 0.28, 0.75], 0.35);

  // Character: upright, parented to the ball's position but not its rotation
  // and not to the tilted world group (handoff §7 rule 1).
  const bp = ballMatrix();
  viewer.drawGroup('rat', mvp, multiply(T, bp.upright));
  viewer.drawGroup('band', mvp, multiply(T, bp.spun), { opacity: 1 });
  viewer.drawGroup('shell', mvp, multiply(T, bp.spun), { opacity: 0.26 });
}

const spin = { q: [0, 0, 0, 1] };
function ballMatrix () {
  // The rat is parented to the ball's position but not its rotation and not to
  // the tilted world group (handoff §7 rule 1) — it only yaws to face travel.
  // The model is built facing local −Z, so the yaw that points its muzzle down
  // the direction of travel is the heading plus half a turn.
  const a = follow.ratYaw + Math.PI;
  const c = Math.cos(a), s = Math.sin(a);
  const upright = new Float32Array([
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    ball.p.x, ball.p.y, ball.p.z, 1,
  ]);

  // Only the shell spins: integrate ω into a quaternion (handoff §7).
  const w = ball.w, mag = Math.hypot(w.x, w.y, w.z);
  if (mag > 1e-6) {
    const a = mag * (1 / 60), s = Math.sin(a / 2);
    const dq = [w.x / mag * s, w.y / mag * s, w.z / mag * s, Math.cos(a / 2)];
    const q = spin.q;
    spin.q = [
      dq[3] * q[0] + dq[0] * q[3] + dq[1] * q[2] - dq[2] * q[1],
      dq[3] * q[1] - dq[0] * q[2] + dq[1] * q[3] + dq[2] * q[0],
      dq[3] * q[2] + dq[0] * q[1] - dq[1] * q[0] + dq[2] * q[3],
      dq[3] * q[3] - dq[0] * q[0] - dq[1] * q[1] - dq[2] * q[2],
    ];
    const n = Math.hypot(...spin.q) || 1;
    spin.q = spin.q.map(v => v / n);
  }
  const [x, y, z, wq] = spin.q;
  const spun = new Float32Array([
    1 - 2 * (y * y + z * z), 2 * (x * y + z * wq), 2 * (x * z - y * wq), 0,
    2 * (x * y - z * wq), 1 - 2 * (x * x + z * z), 2 * (y * z + x * wq), 0,
    2 * (x * z + y * wq), 2 * (y * z - x * wq), 1 - 2 * (x * x + y * y), 0,
    ball.p.x, ball.p.y, ball.p.z, 1,
  ]);
  return { upright, spun };
}

function drawHud () {
  const speed = Math.hypot(ball.v.x, ball.v.y, ball.v.z);
  const cell = world.cellLookup(ball.p.x, ball.p.z);
  const piece = cell ? PIECE_BY_ID.get(cell.pieceId) : null;
  const done = run.finished;
  $('#hud').innerHTML =
    `<div class="big ${done ? 'ok' : ''}">${run.t.toFixed(2)}s${done ? '  GOAL' : ''}</div>`
    + `<div>${speed.toFixed(1)} m/s${ball.grounded ? '' : '  <span class="warn">airborne</span>'}</div>`
    + `<div>falls <span class="${run.falls ? 'warn' : ''}">${run.falls}</span>`
    + `${run.best != null ? `   best ${run.best.toFixed(2)}s` : ''}</div>`
    + (piece ? `<div class="dim">#${String(piece.id).padStart(2, '0')} ${piece.name}</div>` : '')
    + (input.paused ? '<div class="warn">paused</div>' : '');
}

const tiltCtx = $('#tilt').getContext('2d');
function drawTilt () {
  const c = tiltCtx, W = 120;
  c.clearRect(0, 0, W, W);
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1;
  c.beginPath(); c.arc(W / 2, W / 2, 44, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(W / 2 - 48, W / 2); c.lineTo(W / 2 + 48, W / 2);
  c.moveTo(W / 2, W / 2 - 48); c.lineTo(W / 2, W / 2 + 48); c.stroke();
  const x = W / 2 + (input.r / MAX_TILT) * 44;
  const y = W / 2 - (input.f / MAX_TILT) * 44;
  c.fillStyle = '#ffd93a';
  c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,.5)';
  c.font = '9px ui-monospace, monospace';
  c.fillText(`${(Math.hypot(input.f, input.r) * 180 / Math.PI).toFixed(0)}°`, W / 2 - 8, W - 4);
}

/* ── toggles ──────────────────────────────────────────────────────────── */

for (const btn of document.querySelectorAll('.tool[data-toggle]')) {
  btn.addEventListener('click', () => {
    const k = btn.dataset.toggle;
    view[k] = !view[k];
    btn.setAttribute('aria-pressed', String(view[k]));
    // The rails are real collision geometry, so this one changes the world
    // rather than the view. Rebuilding keeps the position and the clock.
    if (k === 'trainingWheels') {
      const keep = { p: { ...ball.p }, v: { ...ball.v }, t: run.t, falls: run.falls, cp: run.checkpoint };
      buildWorld();
      run.checkpoint = keep.cp;
      ball.p = keep.p; ball.v = keep.v;
      run.t = keep.t; run.falls = keep.falls;
    }
    stage.focus();
  });
  btn.setAttribute('aria-pressed', String(view[btn.dataset.toggle]));
}

/* ── seed controls ────────────────────────────────────────────────────── */

function setDate (iso) {
  seedInfo.iso = iso;
  seedInfo.seed = seedForDate(iso);
  $('#date').value = iso;
  buildWorld();
}
$('#date').addEventListener('change', e => setDate(e.target.value));
$('#prev-day').addEventListener('click', () => shiftDay(-1));
$('#next-day').addEventListener('click', () => shiftDay(1));
$('#today').addEventListener('click', () => setDate(isoToday()));
$('#regen').addEventListener('click', () => { seedInfo.size = Number($('#size').value); buildWorld(); });
$('#size').addEventListener('change', () => { seedInfo.size = Number($('#size').value); buildWorld(); });
function shiftDay (n) {
  const d = new Date(`${seedInfo.iso}T00:00:00Z`);
  setDate(isoToday(new Date(d.getTime() + n * 86400000)));
}

/* ── feedback UI ──────────────────────────────────────────────────────── */

function renderAspects () {
  $('#aspects').replaceChildren(...ASPECTS.map(([key, title, question]) => {
    const list = el('ul', { class: 'comments' });
    const sev = el('select', {}, ...SEVERITIES.map(([v, t]) => el('option', { value: v }, t)));
    const ta = el('textarea', { rows: 2, placeholder: `Note on ${title.toLowerCase()}…` });
    const add = el('button', {
      class: 'add',
      onclick () {
        const v = ta.value.trim();
        if (!v) { ta.focus(); return; }
        aspect(key).comments.push({
          severity: sev.value, text: v, at: new Date().toISOString(),
          seed: seedInfo.iso, seedHex: `0x${seedInfo.seed.toString(16)}`, size: seedInfo.size,
          trainingWheels: view.trainingWheels, followCam: view.follow, worldTilt: view.worldTilt,
        });
        ta.value = ''; save(); redraw(); updateCounters();
      },
    }, 'Add note');
    ta.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); add.click(); }
    });
    function redraw () {
      list.replaceChildren(...aspect(key).comments.map((c, i) => el('li', { 'data-sev': c.severity },
        el('button', {
          class: 'del', title: 'Delete', onclick () { aspect(key).comments.splice(i, 1); save(); redraw(); updateCounters(); },
        }, '×'),
        el('span', { class: 'sev' }, SEVERITIES.find(s => s[0] === c.severity)[1]),
        c.text,
        el('span', { class: 'seedtag' }, c.seed))));
    }
    redraw();
    return el('div', { class: 'aspect' },
      el('h3', {}, title),
      question ? el('p', { class: 'q' }, question) : null,
      el('div', { class: 'controls' },
        el('div', { class: 'control-row' }, sev, add),
        el('div', { class: 'comment-input' }, ta),
        list));
  }));
}

function updateCounters () {
  const all = ASPECTS.flatMap(([k]) => aspect(k).comments);
  $('#counters').replaceChildren(
    el('span', {}, el('b', {}, String(all.length)), ' notes'),
    el('span', {}, el('b', {}, String(all.filter(c => c.severity === 'must').length)), ' must-fix'),
    el('span', {}, el('b', {}, String(new Set(all.map(c => c.seed)).size)), ' seeds noted'),
    el('span', {}, el('b', {}, String(state.seedsPlayed.length)), ' seeds loaded'),
  );
}

/* ── export ───────────────────────────────────────────────────────────── */

function snapshot () {
  const now = new Date();
  return {
    schema: 'ratball-maze-review/1',
    artifact: {
      name: `${KIT_NAME} — daily maze`,
      version: KIT_VERSION,
      path: '3d-mazeball/src/',
      generator: 'generator.js + assemble.js + validate.js',
      notAutoPlaced: NOT_AUTO_PLACED,
    },
    review: {
      reviewer: state.reviewer || null,
      verdict: state.verdict,
      exportedAt: now.toISOString(),
      exportedAtLocal: now.toLocaleString(),
      startedAt: state.startedAt,
      seedsLoaded: state.seedsPlayed,
      lastSeed: { date: seedInfo.iso, hex: `0x${seedInfo.seed.toString(16)}`, size: seedInfo.size },
    },
    checksForLastSeed: checkResult ? {
      seed: checkResult.seed, fingerprint: checkResult.fingerprint,
      pass: checkResult.pass, clean: checkResult.clean,
      graph: checkResult.graph.pass, clearance: checkResult.clearance.pass,
      physics: { pass: checkResult.physics.pass, clean: checkResult.physics.clean,
        seconds: checkResult.physics.seconds, falls: checkResult.physics.falls,
        skipped: checkResult.physics.skipped },
      stats: checkResult.stats,
    } : null,
    aspects: ASPECTS.map(([key, title]) => ({
      key, title, comments: aspect(key).comments.map(c => ({ ...c })),
    })).filter(a => a.comments.length),
    summary: {
      notes: ASPECTS.reduce((n, [k]) => n + aspect(k).comments.length, 0),
      mustFix: ASPECTS.reduce((n, [k]) => n + aspect(k).comments.filter(c => c.severity === 'must').length, 0),
      shouldImprove: ASPECTS.reduce((n, [k]) => n + aspect(k).comments.filter(c => c.severity === 'should').length, 0),
      questions: ASPECTS.reduce((n, [k]) => n + aspect(k).comments.filter(c => c.severity === 'question').length, 0),
    },
  };
}

const VERDICT = { approve: 'APPROVE', revise: 'REVISE', discuss: 'NEEDS DISCUSSION' };
const SEVTEXT = Object.fromEntries(SEVERITIES);

function toMarkdown (s) {
  const L = [];
  L.push(`# Playtest review — ${s.artifact.name}`);
  L.push('');
  L.push('| | |');
  L.push('| --- | --- |');
  L.push(`| **Artifact** | ${s.artifact.name} |`);
  L.push(`| **Version** | ${s.artifact.version} |`);
  L.push(`| **Source** | \`${s.artifact.path}\` — ${s.artifact.generator} |`);
  L.push(`| **Reviewer** | ${s.review.reviewer || '_unnamed_'} |`);
  L.push(`| **Exported** | ${s.review.exportedAtLocal} (${s.review.exportedAt}) |`);
  L.push(`| **Overall verdict** | **${s.review.verdict ? VERDICT[s.review.verdict] : 'NOT SET'}** |`);
  L.push(`| **Seeds loaded** | ${s.review.seedsLoaded.join(', ') || '—'} |`);
  L.push(`| **Last seed** | ${s.review.lastSeed.date} (${s.review.lastSeed.hex}), ${s.review.lastSeed.size}×${s.review.lastSeed.size} |`);
  L.push('');
  L.push(`${s.summary.notes} notes — ${s.summary.mustFix} must fix, ${s.summary.shouldImprove} should improve, ${s.summary.questions} questions.`);
  L.push('');

  if (s.checksForLastSeed) {
    const c = s.checksForLastSeed;
    L.push('## Automated checks, last seed loaded');
    L.push('');
    L.push(`- fingerprint \`${c.fingerprint}\` · gate **${c.pass ? 'open' : 'FAILED'}**, ${c.clean ? 'driven clean' : 'needed assistance'}`);
    L.push(`- graph ${c.graph ? 'pass' : 'FAIL'} · clearance ${c.clearance ? 'pass' : 'FAIL'}`);
    L.push(`- reference bot: ${c.physics.seconds}s, ${c.physics.falls} falls`);
    if (c.physics.skipped?.length) {
      L.push(`- could not drive: ${c.physics.skipped.map(x => `#${x.piece}`).join(', ')}`);
    }
    L.push('');
  }

  for (const [sev, title] of [['must', 'Must fix'], ['should', 'Should improve'], ['question', 'Questions']]) {
    const rows = s.aspects.flatMap(a => a.comments.filter(c => c.severity === sev).map(c => ({ a, c })));
    if (!rows.length) continue;
    L.push(`## ${title} (${rows.length})`);
    L.push('');
    for (const { a, c } of rows) {
      L.push(`- **${a.title}** — ${c.text}`);
      const mode = [c.followCam === false && 'free cam', c.trainingWheels && 'training wheels',
        c.worldTilt === false && 'no world tilt'].filter(Boolean).join(', ');
      L.push(`  - _seed ${c.seed} (${c.seedHex}), ${c.size}×${c.size}${mode ? ` · ${mode}` : ''} · logged ${new Date(c.at).toLocaleString()}_`);
    }
    L.push('');
  }

  L.push('## Every note, by aspect');
  L.push('');
  if (!s.aspects.length) L.push('_no notes_');
  for (const a of s.aspects) {
    L.push(`### ${a.title}`);
    L.push('');
    for (const c of a.comments) {
      L.push(`- **[${SEVTEXT[c.severity]}]** ${c.text}`);
      L.push(`  <sub>seed ${c.seed} · ${c.seedHex} · ${c.size}×${c.size} · ${c.at}</sub>`);
    }
    L.push('');
  }

  L.push('## Known gaps in the generator');
  L.push('');
  for (const [id, why] of Object.entries(s.artifact.notAutoPlaced)) {
    L.push(`- **#${String(id).padStart(2, '0')}** — ${why}`);
  }
  L.push('');
  return L.join('\n');
}

function download (name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

$('#export').addEventListener('click', async () => {
  const s = snapshot();
  const md = toMarkdown(s);
  const stamp = s.review.exportedAt.replace(/[:.]/g, '-').slice(0, 19);
  const base = `ratball-playtest_${s.artifact.version}_${stamp}`;
  download(`${base}.md`, md, 'text/markdown;charset=utf-8');
  setTimeout(() => download(`${base}.json`, JSON.stringify(s, null, 2), 'application/json;charset=utf-8'), 260);
  let copied = false;
  try { await navigator.clipboard.writeText(md); copied = true; } catch { /* not permitted */ }
  const b = $('#export'), was = b.textContent;
  b.textContent = copied ? 'Exported · Markdown copied' : 'Exported (2 files)';
  setTimeout(() => { b.textContent = was; }, 2600);
});

/* ── boot ─────────────────────────────────────────────────────────────── */

$('#reviewer').value = state.reviewer || '';
$('#reviewer').addEventListener('input', e => { state.reviewer = e.target.value; save(); });
for (const btn of document.querySelectorAll('.v')) {
  btn.setAttribute('aria-checked', String(state.verdict === btn.dataset.verdict));
  btn.addEventListener('click', () => {
    state.verdict = state.verdict === btn.dataset.verdict ? null : btn.dataset.verdict;
    for (const b of document.querySelectorAll('.v')) {
      b.setAttribute('aria-checked', String(state.verdict === b.dataset.verdict));
    }
    save();
  });
}

try { viewer = new Viewer(stage, { background: [0.051, 0.063, 0.078] }); }
catch (e) {
  glError = e;
  $('#viewport').append(el('p', { class: 'stage-hint', style: 'top:50%;left:0;right:0;text-align:center' },
    `WebGL is unavailable: ${e.message}`));
}

$('#date').value = seedInfo.iso;
renderAspects();
updateCounters();
buildWorld();
if (!glError) raf = requestAnimationFrame(frame);

/**
 * Console handles. `step(seconds)` advances and redraws without the animation
 * frame, which is the only way to exercise this page anywhere the document is
 * backgrounded — requestAnimationFrame is throttled to nothing there, so the
 * canvas never sizes itself and never draws.
 */
Object.assign(window, {
  world: () => world, maze: () => maze, ball: () => ball, snapshot, toMarkdown, setDate,
  step (seconds = 1 / 60, frames = 1) {
    for (let i = 0; i < frames; i++) frame((last || 0) + seconds * 1000);
    return { t: run.t, pos: { ...ball.p }, buffer: [stage.width, stage.height] };
  },
  /** Chase-camera state, for checking that the follow actually converges. */
  camState () {
    const speed = Math.hypot(ball.v.x, ball.v.z);
    const heading = Math.atan2(ball.v.x, ball.v.z);
    return {
      yaw: cam.yaw, heading, ratYaw: follow.ratYaw, speed,
      stable: follow.stable, err: angleDelta(heading, cam.yaw),
      trainingWheels: view.trainingWheels, follow: view.follow,
    };
  },
});
