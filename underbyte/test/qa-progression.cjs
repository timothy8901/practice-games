/*
 * UNDERBYTE — test/qa-progression.cjs
 * QA round 3 · lens: PROGRESSION & SOFTLOCKS (Playwright, headless Chromium, file:// index.html).
 * Run:  node underbyte/test/qa-progression.cjs      (exit code 0 = every check PASS)
 *
 * Round 3 keeps the round-1/2 proof of the critical path (sections B–G: NEW GAME → every room with REAL inputs, every gate
 * BLOCKED without its ability and PASSED with it, every node + CONTINUE in zones 2–5, the three cores, loops A/B, the boss
 * seals across deaths / quits / reloads) and the softlock hunt (H), and adds:
 *   A3 static reachability: every placed bit / core / node / enemy / vendor / pickup / mover lies in the air component of its
 *      room's exits (BFS over non-solid tiles, abilities ignored) — a sealed pocket can never be collected
 *   N  ns_climb RIGHT face (DESIGN §10.3 #16 "shaft 1 → slab → shaft 2 → …"): the shaft-2 foot doorway claim, the 8-wide
 *      column x26–33 per fighter and technique, the full right-face run with real inputs, shaft 2 as a pit
 *   P  per-fighter gate proofs (all five): gate 1 jump + Echo Jump, gate 2 ground / hop dash windows, gate 3 wall climb,
 *      the core-2 and bv_catwalk crawlspace gaps, dc_cross at tier 0 (pit 1 via the grate, pit 2 window), lw_hoist H1 → H2
 *   Q  QUIT → CONTINUE in the middle of every non-normal mode (hazard freeze, node use, boss intro, pickup sequence, dying)
 *   R  a boss module left behind: through Corrosant's open hatch into ns_base and back up; through Weftyr's hatch into
 *      bv_sluice (gate 2 still blocked) and back up into the pocket, over the wall, module collected
 *   S  every chute / top arrival × held direction × fighter (no Echo Jump): the launch must never end in a hazard
 *      (the DESIGN §10.6 F9 rule); the Echo-Jump variants are reported as information
 *   M  map bookkeeping invariants at the end of the run (visited ⊆ real rooms, discovered = visited + their neighbours)
 *
 * Probes drive the game ONLY through UB.Input virtual keys (UB.debug.pressed) / real key events with UB.debug.pauseLogic(true) + step(n),
 * so every run is frame-exact and repeatable. Debug helpers used: warp (to skip platforming proven once / to set up probes), teleport
 * (boss macro + probe starts), grant(…, false)/grant(…, true) ONLY to re-check a gate after its ability was earned for real (and in the
 * per-fighter / matrix sections, which say so), setMaxHp/setHp(99) during hazard probes, killEnemies in rooms where contact knockback
 * would pollute a traversal measurement, god(true) only during boss fights and the Rootwell gauntlet, addBits(90) once for the keyboard purchase.
 * Checks that encode a defect found in this round FAIL until the world data is fixed (A3, N1, S1) — see the findings report.
 */
const path = require('path');
const { launch } = require('./harness.cjs');

const SHOTS = path.join(__dirname, 'shots');
const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok, info });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info).slice(0, 700) : ''));
}

// ---------------------------------------------------------------------------------------------------
// In-page probe library (installed with page.evaluate; runs inside the game page, logic paused + stepped).
// ---------------------------------------------------------------------------------------------------
function QA_INSTALL() {
  const UB = window.UB, d = UB.debug, E = UB.Entity, In = UB.Input, T = 30;
  const G = function () { return UB.game; };
  const Q = {};
  // Taps are real keyboard events (keydown now, keyup after n logic frames) so a new press edge is made without
  // disturbing any virtual hold (UB.debug.pressed) that is still running; holds are the virtual keys.
  Q.fc = 0; Q.pend = []; Q.queued = []; Q.lastUp = {};
  Q.keyIsDown = function (code) { for (let i = 0; i < Q.pend.length; i++) if (Q.pend[i].code === code) return true; return false; };
  Q.kup = function (code) { window.dispatchEvent(new KeyboardEvent('keyup', { code: code, bubbles: true })); Q.lastUp[code] = Q.fc; };
  Q.kdown = function (action, n) {
    const code = In.bindings[action][0];
    // a human releases at least one frame before pressing again: never put a key-down in the same logic frame as a key-up of that key
    if (Q.keyIsDown(code)) { for (let i = Q.pend.length - 1; i >= 0; i--) if (Q.pend[i].code === code) { Q.kup(code); Q.pend.splice(i, 1); } }
    if (Q.lastUp[code] === Q.fc) { Q.queued.push({ code: code, n: n || 1 }); return; }
    window.dispatchEvent(new KeyboardEvent('keydown', { code: code, bubbles: true }));
    Q.pend.push({ code: code, until: Q.fc + (n || 1) });
  };
  Q.kflush = function (all) { for (let i = Q.pend.length - 1; i >= 0; i--) if (all || Q.pend[i].until <= Q.fc) { Q.kup(Q.pend[i].code); Q.pend.splice(i, 1); } if (all) Q.queued.length = 0; };
  Q.stepK = function () {
    d.step(1); Q.fc++; Q.kflush(false);
    while (Q.queued.length) { const q = Q.queued.shift(); window.dispatchEvent(new KeyboardEvent('keydown', { code: q.code, bubbles: true })); Q.pend.push({ code: q.code, until: Q.fc + q.n }); }
  };
  Q.rng = function (seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  Q.snap = function () {
    const g = G(), p = g.player;
    if (!p || !g.level) return { room: null, screen: g.overlay || g.screen };
    return { room: g.level.room.id, x: +p.x.toFixed(1), y: +p.y.toFixed(1), vx: +p.vx.toFixed(0), vy: +p.vy.toFixed(0), g: p.onGround, mode: g.mode, cling: p.clinging, mover: !!p.ground, hp: p.hp, maxHp: p.maxHp, state: p.state, screen: g.overlay || g.screen, airJumps: p.airJumps };
  };
  Q.tile = function (tx, ty) { return { x: tx * T + 15, y: (ty + 1) * T }; };
  Q.clearOverlay = function () {
    const g = G(); let k = 0;
    while (g.overlay && k < 600) { if (g.overlay === 'lore') { if (k > 14) d.pressed('confirm', 2); } else d.pressed('back', 2); d.step(1); k++; }
    return g.overlay;
  };
  Q.settle = function (n) { for (let i = 0; i < n; i++) { d.step(1); if (G().overlay) Q.clearOverlay(); } return Q.snap(); };
  Q.setAbilities = function (ej, bl, gp) { d.grant('echoJump', !!ej); d.grant('burstLine', !!bl); d.grant('gripProtocol', !!gp); };
  Q.abilities = function () { const a = G().save.abilities; return [!!a.echoJump, !!a.burstLine, !!a.gripProtocol]; };
  Q.inSolid = function () { const g = G(), p = g.player; return E.overlapsSolid(g.level, p.x - p.w / 2, p.y - p.h, p.w, p.h); };
  Q.bigHp = function () { const p = G().player; if (p.maxHp < 50) d.setMaxHp(99); d.setHp(99); };
  Q.restoreHp = function () { const g = G(), p = g.player; const m = p.baseHp + g.save.cores.length; d.setMaxHp(m); d.setHp(m); };
  Q.waitNormal = function (max) { const g = G(); let k = 0; while (g.mode !== 'normal' && k++ < (max || 200)) d.step(1); return g.mode; };
  /** Fresh attempt: wait out any freeze, (re)load the room at the start position or teleport, clear enemies/overlays, refill hp. */
  Q.begin = function (start, opts) {
    Q.kflush(true); In.releaseAll();
    Q.waitNormal(200);
    if (start.room) d.warp(start.room, { x: start.x, y: start.y }); else d.teleport(start.x, start.y);
    d.step(1); Q.clearOverlay();
    if (!(opts && opts.keepEnemies)) d.killEnemies();
    Q.bigHp();
    d.step(2);
    return Q.snap();
  };
  /**
   * Drive `frames` logic frames with ctrl(f, p, g, H) (H.hold(action, n) = one virtual hold of n frames) and
   * stop(f, p, g) → truthy = goal reached. opts: {stopOnHazard, stopOnRoomChange (default true)}.
   */
  Q.drive = function (frames, ctrl, stop, opts) {
    opts = opts || {};
    const g = G();
    // hold = a virtual key hold; tap = release everything first so a new press edge is made even while a hold is active
    const H = { dir: null, hold: function (a, n) { if (a === 'left' || a === 'right') H.dir = a; d.pressed(a, n || 1); }, tap: function (a, n) { Q.kdown(a, n || 1); } };
    const room0 = g.level.room.id;
    let hazards = 0, minY = 1e9, maxX = -1e9, minX = 1e9, result = null, f = 0, roomChanged = null;
    const landed = {};
    for (f = 0; f < frames; f++) {
      const p = g.player;
      if (g.overlay) Q.clearOverlay();
      if (g.screen !== 'play') { result = { left: g.screen }; break; }
      if (g.level.room.id !== room0) { roomChanged = { to: g.level.room.id, f: f, exit: g.transition.exit ? g.transition.exit.id : null }; Q.kflush(true); if (opts.stopOnRoomChange !== false) { result = { room: g.level.room.id }; break; } }
      if (g.mode === 'hazard') {
        hazards++;
        if (opts.stopOnHazard) { result = { hazard: true }; break; }
        while (g.mode === 'hazard' && f < frames) { Q.stepK(); f++; }
        continue;
      }
      const r = stop ? stop(f, p, g) : null;   // evaluated even on locked frames (a pickup sequence locks the player)
      if (r) { result = r; break; }
      if (g.mode === 'transition' || p.locked) { Q.stepK(); continue; }
      if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.x < minX) minX = p.x;
      if (p.onGround) { const k = Math.floor(p.x / T) + ',' + Math.floor((p.y - 1) / T); landed[k] = 1; }
      H.dir = null;
      if (ctrl) ctrl(f, p, g, H);
      Q.stepK();
    }
    return { frames: f, result: result, hazards: hazards, roomChanged: roomChanged, snap: Q.snap(), minY: +minY.toFixed(1), maxX: +maxX.toFixed(1), minX: +minX.toFixed(1), landed: Object.keys(landed) };
  };
  /** Plausible random human-ish controller: direction holds, jump taps, Echo Jumps when falling, dashes, wall kicks, drops. */
  Q.randomCtrl = function (opts) {
    opts = opts || {};
    const rnd = Q.rng(opts.seed || 1);
    let dir = opts.dirBias || 0, dirT = 0, jumpCd = 0, dashCd = 0;
    return function (f, p, g, H) {
      if (dirT <= 0) { const r = rnd(); dir = r < 0.55 ? (opts.dirBias || (rnd() < 0.5 ? 1 : -1)) : (r < 0.8 ? -(opts.dirBias || 1) : 0); dirT = 10 + Math.floor(rnd() * 60); }
      dirT--;
      if (dir) H.hold(dir > 0 ? 'right' : 'left', 1);
      if (jumpCd > 0) jumpCd--; if (dashCd > 0) dashCd--;
      const ab = g.save.abilities;
      if ((p.onGround || p.coyote > 0) && jumpCd <= 0 && rnd() < 0.12) { H.tap('jump', 4 + Math.floor(rnd() * 22)); jumpCd = 6; }
      else if (!p.onGround && p.clinging && jumpCd <= 0 && rnd() < 0.35) { H.tap('jump', 6 + Math.floor(rnd() * 14)); jumpCd = 6; }
      else if (!p.onGround && ab.echoJump && p.airJumps > 0 && jumpCd <= 0 && (p.vy > -60) && rnd() < 0.2) { H.tap('jump', 6 + Math.floor(rnd() * 16)); jumpCd = 8; }
      if (ab.burstLine && dashCd <= 0 && rnd() < 0.06) { H.tap('dash', 2); dashCd = 20; }
      if (p.onGround && rnd() < 0.01) { H.hold('down', 8); H.tap('jump', 3); H.hold('down', 8); jumpCd = 10; }
    };
  };
  /** Deterministic attempt: hold dir; jump at j0 (jHold 0 = none); Echo Jump at ej; dash at da; wall kicks when clinging. */
  Q.scriptCtrl = function (s) {
    return function (f, p, g, H) {
      if (s.dir) H.hold(s.dir > 0 ? 'right' : 'left', 1);
      if (s.jHold !== 0 && f === (s.j0 === undefined ? 0 : s.j0)) H.tap('jump', s.jHold || 20);
      if (s.ej !== undefined && f === s.ej) H.tap('jump', s.ejHold || 20);
      if (s.da !== undefined && f === s.da) H.tap('dash', 2);
      if (s.wj && p.clinging && (f % 4) === 0) H.tap('jump', 12);
    };
  };
  /** Sweep deterministic jump/Echo Jump/dash timings from a fixed start; room changes count as failures unless opts.roomOk. */
  Q.sweep = function (start, dir, stop, opts) {
    opts = opts || {};
    const frames = opts.frames || 150; const out = { tried: 0, hazards: 0, roomChanges: 0, success: null, minY: 1e9, maxX: -1e9, minX: 1e9 };
    const ejs = opts.ejs || [undefined, 8, 14, 20, 26, 32, 40, 50];
    const das = opts.das || [undefined, 2, 10, 18, 26, 34, 44];
    const jh = opts.jHolds || [20];
    const runups = opts.runups || [0];
    for (const ru of runups) for (const h of jh) for (const ej of ejs) for (const da of das) {
      Q.begin(start, opts);
      const ctrl = Q.scriptCtrl({ dir: dir, j0: ru, jHold: h, ej: ej === undefined ? undefined : ru + ej, da: da === undefined ? undefined : ru + da, wj: opts.wj });
      const r = Q.drive(frames + ru, ctrl, stop, { stopOnHazard: true });
      out.tried++;
      if (r.minY < out.minY) out.minY = r.minY; if (r.maxX > out.maxX) out.maxX = r.maxX; if (r.minX < out.minX) out.minX = r.minX;
      if (r.result && r.result.hazard) out.hazards++;
      else if (r.result && r.result.abort) out.aborts = (out.aborts || 0) + 1;
      else if (r.result && (r.result.room || r.result.left) && !opts.roomOk) out.roomChanges++;
      else if (r.result) { out.success = { ej: ej, da: da, jHold: h, runup: ru, result: r.result, snap: r.snap, frames: r.frames }; return out; }
    }
    return out;
  };
  /** Random-input attempts: n seeds × frames each from a fixed start; stops at the first success. */
  Q.randomAttempts = function (start, n, frames, stop, opts) {
    opts = opts || {};
    const out = { tried: 0, hazards: 0, roomChanges: 0, success: null, minY: 1e9, maxX: -1e9, minX: 1e9 };
    for (let s = 1; s <= n; s++) {
      Q.begin(start, opts);
      const r = Q.drive(frames, Q.randomCtrl({ seed: s * 7919 + (opts.seedBase || 0), dirBias: opts.dirBias }), stop, { stopOnHazard: false });
      out.tried++; out.hazards += r.hazards;
      if (r.minY < out.minY) out.minY = r.minY; if (r.maxX > out.maxX) out.maxX = r.maxX; if (r.minX < out.minX) out.minX = r.minX;
      if (r.result && r.result.abort) { out.aborts = (out.aborts || 0) + 1; continue; }
      if (r.result && (r.result.room || r.result.left) && !opts.roomOk) { out.roomChanges++; continue; }
      if (r.result && !r.result.hazard) { out.success = { seed: s, result: r.result, snap: r.snap, frames: r.frames }; return out; }
    }
    return out;
  };
  /**
   * Waypoint walker (real inputs): points = [{tx, ty?, tol?, exit?, jumpAt?, jumpDir?, jHold?, ej?, ejVy?, dashVy?, drop?,
   * dropAt?, wj?, autoPit?, dropLimit?, lipDrop?, noAutoJump?, stuck?, air?}]. Holds the direction toward tx; a wall /
   * hazard pit ahead triggers a jump (autoPit); Echo Jump mid-air over a hazard column. Completes a point when grounded
   * within tol px of tx (and at ty when given). exit:true = the room change is the goal.
   */
  Q.walk = function (points, maxFrames) {
    const g = G(); const room0 = g.level.room.id; let i = 0, f = 0, jumpCd = 0, stuck = 0, lastX = 0, lastY = 0; const log = [];
    let hazards = 0;
    while (f < maxFrames && i < points.length) {
      const p = g.player, wp = points[i], tx = wp.tx * T + 15;
      if (g.overlay) Q.clearOverlay();
      if (g.screen !== 'play') return { ok: false, reason: 'left play ' + g.screen, i: i, f: f, log: log, hazards: hazards };
      if (g.level.room.id !== room0) { Q.kflush(true); return { ok: wp.exit === true, reason: 'room changed', to: g.level.room.id, exit: g.transition.exit ? g.transition.exit.id : null, i: i, f: f, log: log, hazards: hazards, snap: Q.snap() }; }
      if (g.mode === 'hazard') { hazards++; while (g.mode === 'hazard' && f < maxFrames) { Q.stepK(); f++; } if (wp.stopOnHazard !== false) return { ok: false, reason: 'hazard', i: i, f: f, snap: Q.snap(), log: log, hazards: hazards }; continue; }
      if (g.mode !== 'normal' || p.locked) { Q.stepK(); f++; continue; }
      const dx = tx - p.x, dir = Math.abs(dx) < 3 ? 0 : (dx > 0 ? 1 : -1);
      const reachedX = Math.abs(dx) <= (wp.tol || 6);
      const reachedY = wp.ty === undefined || Math.abs(p.y - (wp.ty + 1) * T) <= 2;
      if (reachedX && reachedY && (p.onGround || wp.air)) {
        log.push({ i: i, f: f, x: +p.x.toFixed(0), y: +p.y.toFixed(0) });
        if (wp.wait) { for (let k = 0; k < wp.wait; k++) { Q.stepK(); f++; } }
        i++; stuck = 0; continue;
      }
      const dirAct = dir > 0 ? 'right' : 'left';
      if (dir && !(p.dropThrough > 0)) d.pressed(dirAct, 1);
      const jp = function (n) { Q.kdown('jump', n); };
      const dropNow = function () { d.pressed('down', 8); Q.kdown('jump', 3); };
      if (jumpCd > 0) jumpCd--;
      if (wp.jumpAt !== undefined && p.onGround && jumpCd <= 0 && Math.abs(p.x - (wp.jumpAt * T + 15)) <= (wp.jumpTol || 8) && (wp.jumpDir === undefined || wp.jumpDir === dir)) { jp(wp.jHold || 22); jumpCd = 10; }
      if (wp.ej && !p.onGround && !p.clinging && p.dropThrough <= 0 && p.vy > (wp.ejVy === undefined ? 0 : wp.ejVy) && p.airJumps > 0 && jumpCd <= 0 && g.save.abilities.echoJump) { jp(wp.ejHold || 20); jumpCd = 10; }
      if (wp.dashVy !== undefined && !p.onGround && p.vy >= wp.dashVy && !p.dashing && p.dashCd <= 0 && g.save.abilities.burstLine) { Q.kdown('dash', 2); }
      if (wp.wj && p.clinging && jumpCd <= 0) { jp(wp.wjHold || 10); jumpCd = wp.wjCd || 6; }
      if (wp.drop && p.onGround && (wp.dropAt === undefined || Math.abs(p.x - (wp.dropAt * T + 15)) <= 8)) { dropNow(); jumpCd = 12; }
      if (!wp.noAutoJump && dir && p.onGround && jumpCd <= 0) {
        const aheadTx = Math.floor((p.x + dir * (p.w / 2 + 8)) / T), feetTy = Math.floor((p.y - 1) / T);
        const wallLow = E.solidAt(g.level, aheadTx, feetTy), wallHigh = E.solidAt(g.level, aheadTx, feetTy - 1);
        let hazardDrop = false, depth = 0;
        if (wp.autoPit) for (let ty = feetTy + 1; ty < feetTy + 11; ty++) { const ch = E.tileAt(g.level, aheadTx, ty); if (ch === '#' || ch === '-' || ch === 'c') break; if (ch === '^' || ch === '~') { hazardDrop = true; break; } depth++; }
        const lip = !wallLow && wallHigh;
        if (!lip && (wallLow || wallHigh || hazardDrop || (wp.autoPit && depth >= (wp.dropLimit || 10)))) { jp(wp.jHold || 22); jumpCd = 14; }
        else if (lip && wp.lipDrop && E.tileAt(g.level, Math.floor(p.x / T), feetTy + 1) === '-') { dropNow(); jumpCd = 14; }
      }
      if (wp.autoPit && !p.onGround && p.vy > 0 && jumpCd <= 0 && p.airJumps > 0 && g.save.abilities.echoJump) {
        let hz = false; const myTx = Math.floor(p.x / T), feetTy = Math.floor((p.y - 1) / T);
        for (let ty = feetTy + 1; ty < feetTy + 12; ty++) { const ch = E.tileAt(g.level, myTx, ty); if (ch === '#' || ch === '-' || ch === 'c') break; if (ch === '^' || ch === '~') { hz = true; break; } }
        const aheadTx = Math.floor((p.x + dir * (p.w / 2 + 8)) / T);
        const wallAhead = dir && (E.solidAt(g.level, aheadTx, feetTy) || E.solidAt(g.level, aheadTx, feetTy - 1));
        if (hz || wallAhead) { jp(20); jumpCd = 14; }
      }
      if (wp.trace && (f % (wp.trace === true ? 3 : wp.trace)) === 0) log.push([f, +p.x.toFixed(0), +p.y.toFixed(0), p.onGround ? 1 : 0, jumpCd, p.airJumps, p.state]);
      if (Math.abs(p.x - lastX) < 0.5 && Math.abs(p.y - lastY) < 0.5) { stuck++; if (stuck > (wp.stuck || 300)) return { ok: false, reason: 'stuck', i: i, f: f, snap: Q.snap(), log: log, hazards: hazards }; } else { stuck = 0; lastX = p.x; lastY = p.y; }
      Q.stepK(); f++;
    }
    return { ok: i >= points.length, reason: i >= points.length ? 'done' : 'timeout', i: i, f: f, snap: Q.snap(), log: log, hazards: hazards };
  };
  /** Walk to the node tile with real input, press Up, wait for the rest to finish. */
  Q.restAtNode = function (nx) {
    const g = G();
    const w = Q.walk([{ tx: nx, tol: 4 }], 900);   // (bv_rest's node stands on a 1-tile plinth: the wall auto-jump handles it)
    d.step(2);
    const near = g.nearNode ? g.nearNode.id : null, prompt = g.prompt ? g.prompt.text : null;
    d.pressed('up', 2); d.step(3);
    const modeAfterPress = g.mode;
    Q.waitNormal(120); d.step(2);
    return { walked: w.ok, near: near, prompt: prompt, modeAfterPress: modeAfterPress, snap: Q.snap(), savedRoom: g.savedData ? g.savedData.roomId : null, hp: g.player.hp, energy: g.player.energy };
  };
  /** Alternating wall-jump climb between two facing walls; stops when stop() fires. */
  Q.wallClimb = function (frames, stop, kick) {
    let dir = 1, last = -99;
    return Q.drive(frames, function (f, p, g, H) { H.hold(dir > 0 ? 'right' : 'left', 1); if (f === 0) H.tap('jump', 14); if (p.clinging && f - last > 4) { H.tap('jump', kick || 8); last = f; dir = -dir; } }, stop, { stopOnHazard: true });
  };
  /** Boss macro (from playthrough.cjs): stand beside the boss, face it, chain lights, hop; god keeps the player alive. */
  Q.bossMacro = function (o) {
    const g = G();
    let it = 0, hits = 0, phases = {}, f = 0;
    while (f < o.maxFrames) {
      const b = g.boss; if (!b) break;
      const bf = g.bossFight.state;
      if (bf === 'intro' || bf === 'none') { d.step(1); f++; continue; }
      if (bf !== 'fight') break;
      phases[b.phase] = 1;
      const pl = g.player, lv = g.level, A = b.A || null;
      const floorY = A ? A.floorY : lv.h * 30 - 90, cx = A ? A.cx : lv.w * 15;
      let dir = b.x > cx ? 1 : -1;
      let tx = b.x - dir * (b.w / 2 + (o.reach || 12)), ty = Math.min(floorY, b.cy() + pl.h / 2);
      if (b.id === 'kernauth' && b.phase === 1) { tx = b.x - dir * 60; ty = Math.min(floorY, b.y - 120 + pl.h / 2); }
      if (E.overlapsSolid(lv, tx - pl.w / 2, ty - pl.h, pl.w, pl.h)) { dir = -dir; tx = b.x - dir * (b.w / 2 + (o.reach || 12)); }
      if (E.overlapsSolid(lv, tx - pl.w / 2, ty - pl.h, pl.w, pl.h)) { ty = floorY; }
      if (E.overlapsSolid(lv, tx - pl.w / 2, ty - pl.h, pl.w, pl.h)) { tx = Math.max(60, Math.min(lv.w * 30 - 60, tx)); }
      d.teleport(tx, ty); d.step(1); f++;
      d.pressed(dir > 0 ? 'right' : 'left', 1); d.step(1); f++;
      if (it % (o.jumpEvery || 6) === 0) d.pressed('jump', 6);
      const hp0 = b.hp;
      d.pressed('light', 2); d.step(8); f += 8;
      d.pressed('light', 2); d.step(10); f += 10;
      if (g.boss && g.boss.hp < hp0) hits++;
      it++;
    }
    const b = g.boss;
    return { frames: f, hits: hits, phases: Object.keys(phases), fight: g.bossFight.state, hp: b ? b.hp : null, boss: b ? b.id : null, screen: g.screen };
  };
  /** After the reward state: walk onto the ability module with real input and ride the pickup sequence. */
  Q.takeAbility = function () {
    const g = G(); let k = 0;
    while (k++ < 600 && !(g.bossFight.state === 'reward' || g.bossFight.state === 'done' || (!g.boss && g.pickups.some(function (p) { return p.type === 'ability'; })))) d.step(1);
    const abil = g.pickups.find(function (p) { return p.type === 'ability'; });
    const st1 = { fight: g.bossFight.state, pickups: g.pickups.length, abil: !!abil };
    if (!abil) return { st1: st1, ok: false };
    const ax = abil.x;
    const ay = abil.y;
    const w = Q.drive(1200, function (f, p, g, H) {
      if (Math.abs(p.x - ax) > 3) H.hold(p.x < ax ? 'right' : 'left', 1);
      if (p.onGround && p.y < ay - 20 && Math.abs(p.x - ax) < 90 && (f % 20) === 0) { H.hold('down', 8); H.tap('jump', 3); }   // on a grate above the module: drop through
    }, function (f, p, g) { return g.mode === 'pickupSeq' ? { seq: true } : null; }, {});
    const seq = !!(w.result && w.result.seq);
    const ban = { t: UB.UI.bannerT, l1: UB.UI.banner1 };
    Q.waitNormal(300); d.step(2);
    return { st1: st1, walked: seq, seq: seq, banner: ban, abilities: Q.abilities(), bosses: g.save.bossesDefeated.slice(), fight: g.bossFight.state, ok: seq };
  };
  /** Single-wall climb (Grip Protocol): cling → wall jump away → Echo Jump near the apex → (opts.dash) dash back toward the wall near the second apex → cling again. */
  Q.singleWall = function (dirToWall, frames, stop, opts) {
    opts = opts || {};
    let lastJump = -99, ej = -99, dashed = false;
    return Q.drive(frames, function (f, p, g, H) {
      H.hold(dirToWall > 0 ? 'right' : 'left', 1);
      if (p.clinging && f - lastJump > 6) { H.tap('jump', 10); lastJump = f; ej = -99; dashed = false; return; }
      if (!p.clinging && !p.onGround && f - lastJump > 10 && ej < 0 && p.vy > (opts.ejVy === undefined ? -80 : opts.ejVy) && p.airJumps > 0 && g.save.abilities.echoJump) { H.tap('jump', 12); ej = f; return; }
      if (opts.dash && !p.clinging && !p.onGround && ej > 0 && f - ej > 6 && !dashed && p.vy > -60 && g.save.abilities.burstLine && !(opts.noDashAbove !== undefined && p.y < opts.noDashAbove)) { H.tap('dash', 2); dashed = true; return; }
      if (p.onGround && f - lastJump > 20 && opts.groundJump !== false) { H.tap('jump', 14); lastJump = f; ej = -99; dashed = false; }
    }, stop, { stopOnHazard: true });
  };
  /** Down+Jump through the grate under the feet, then hold dir (±1/0) until grounded again. */
  Q.dropThrough = function (dir, frames, stop) {
    return Q.drive(frames, function (f, p, g, H) { if (f === 0) { H.hold('down', 8); H.tap('jump', 3); } else if (f > 4 && dir) H.hold(dir > 0 ? 'right' : 'left', 1); },
      stop || function (f, p) { return (f > 6 && p.onGround) ? { landed: true, x: +p.x.toFixed(0), y: p.y } : null; }, { stopOnHazard: true, stopOnRoomChange: true });
  };
  Q.sealed = function (id) { const o = G().level.openings.find(function (o) { return o.id === id; }); return o ? o.sealed : null; };
  Q.modules = function () { return G().pickups.filter(function (p) { return p.type === 'ability'; }).map(function (p) { return { x: p.x, y: p.y, ability: p.ability }; }); };
  /** Quit to the title (in-page, no reload) and CONTINUE; returns the title state and the arrival snapshot. */
  Q.quitContinue = function () {
    const g = G(); g.toTitle(); d.step(3);
    const t = { screen: g.screen, hasSave: g.hasSave(), savedRoom: g.savedData && g.savedData.roomId };
    d.continueGame(); let k = 0; while (k++ < 300 && !(g.screen === 'play' && !g.busy)) d.step(1); Q.settle(5);
    return { title: t, snap: Q.snap(), inSolid: Q.inSolid() };
  };
  /** Set 1 heart (god off), wait for the death (something must hurt us), ride the game over, confirm, return the respawn snapshot. */
  Q.dieAndRespawn = function (maxFrames) {
    const g = G(); d.god(false); d.setHp(1); const d0 = g.save.deaths;
    let died = false; for (let f = 0; f < (maxFrames || 4000) && !died; f++) { d.step(1); if (g.player.dead) died = true; }
    let k = 0; while (k++ < 400 && !(g.screen === 'gameover' && !g.busy)) d.step(1);
    const go = { screen: g.screen, deaths: g.save.deaths, d0: d0 };
    d.step(30); d.pressed('confirm', 2); k = 0; while (k++ < 300 && !(g.screen === 'play' && !g.busy)) d.step(1); d.step(3);
    return { died: died, go: go, snap: Q.snap(), inSolid: Q.inSolid(), boss: !!g.boss, bf: g.bossFight.state, enemies: g.enemies.length };
  };
  /** Static reachability of a room: BFS over non-'#' tiles from every exit opening; placements outside the component. */
  Q.bfsRoom = function (id) {
    const W = UB.World, rm = W.rooms[id];
    const seen = new Uint8Array(rm.w * rm.h); const q = [];
    const push = function (x, y) { if (x < 0 || y < 0 || x >= rm.w || y >= rm.h) return; const i = y * rm.w + x; if (seen[i] || rm.tiles[y][x] === '#') return; seen[i] = 1; q.push(i); };
    for (const e of rm.exits) for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) push(x, y);
    while (q.length) { const i = q.pop(); const x = i % rm.w, y = (i / rm.w) | 0; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
    const comp = function (x, y) { return seen[y * rm.w + x] === 1; };
    const bad = [];
    rm.bits.forEach(function (b) { if (!comp(b.x, b.y)) bad.push('bit(' + b.x + ',' + b.y + ',' + b.size + ')'); });
    rm.cores.forEach(function (c) { if (!comp(c.x, c.y)) bad.push('core ' + c.id); });
    rm.nodes.forEach(function (n) { if (!comp(n.x, n.y)) bad.push('node ' + n.id); });
    rm.spawns.forEach(function (s) { if (!comp(s.x, s.y)) bad.push('enemy ' + s.type + '(' + s.x + ',' + s.y + ')'); });
    if (rm.vendor && !comp(rm.vendor.x, rm.vendor.y)) bad.push('vendor');
    if (rm.start && !comp(rm.start.x, rm.start.y)) bad.push('start');
    if (rm.boss && rm.boss.pickup && !comp(rm.boss.pickup.x, rm.boss.pickup.y)) bad.push('pickup');
    if (rm.boss && rm.boss.spawn && !comp(rm.boss.spawn.x, rm.boss.spawn.y)) bad.push('bossSpawn');
    rm.platforms.forEach(function (p) { if (!comp(p.from.x, p.from.y) || !comp(p.to.x, p.to.y)) bad.push('mover ' + p.id); });
    let sealedAir = 0, sealedHaz = 0;
    for (let y = 0; y < rm.h; y++) for (let x = 0; x < rm.w; x++) { const ch = rm.tiles[y][x]; if (ch !== '#' && !comp(x, y)) { sealedAir++; if (ch === '~' || ch === '^' || ch === 'v' || ch === 'c') sealedHaz++; } }
    return { id: id, bad: bad, sealedAir: sealedAir, sealedHaz: sealedHaz };
  };
  /** Climb between two facing walls with a technique: 'wall' (kicks only), 'wallEJ' (+ Echo Jump 20 f after each kick), 'wallEJdash' (+ dash at 38 f), 'wallDashEJ' (dash 18 f, Echo Jump 34 f). */
  Q.techClimb = function (tech, first, frames, stop) {
    const st = { dir: first, last: -99, ej: -1, da: -1 };
    return Q.drive(frames, function (f, p, g, H) {
      H.hold(st.dir > 0 ? 'right' : 'left', 1);
      if (f === 0) H.tap('jump', 16);
      if (p.clinging && f - st.last > 4) {
        H.tap('jump', 18); st.last = f; st.dir = -st.dir;
        if (tech === 'wallEJ') st.ej = f + 20;
        if (tech === 'wallEJdash') { st.ej = f + 20; st.da = f + 38; }
        if (tech === 'wallDashEJ') { st.da = f + 18; st.ej = f + 34; }
      }
      if (f === st.ej && !p.clinging) H.tap('jump', 16);
      if (f === st.da && !p.clinging) H.tap('dash', 2);
    }, stop, { stopOnHazard: true });
  };
  /** A chute / top arrival with a direction held (and optionally an Echo Jump at the apex): where does the fighter end up? */
  Q.arrival = function (room, exitId, dir, ej) {
    Q.waitNormal(200); d.warp(room, exitId); d.step(1); Q.clearOverlay(); d.killEnemies(); Q.bigHp();
    let ejDone = false;
    const r = Q.drive(240, function (f, p, g, H) { if (dir !== 'none') H.hold(dir, 1); if (ej && !ejDone && !p.locked && p.vy > -60 && p.airJumps > 0) { H.tap('jump', 16); ejDone = true; } },
      function (f, p) { return (p.onGround && f > 2) ? { landed: true, x: +p.x.toFixed(0), tx: Math.floor(p.x / T), y: p.y, mover: !!p.ground } : null; }, { stopOnHazard: true, stopOnRoomChange: true });
    if (r.result && r.result.hazard) return { kind: 'HAZARD', hazard: Object.assign({}, E.lastHazard) };
    if (r.result && r.result.landed) return { kind: 'land', tx: r.result.tx, ty: r.result.y / T - 1, mover: r.result.mover };
    if (r.roomChanged) return { kind: 'out', to: r.roomChanged.to };
    return { kind: 'none' };
  };
  /** Dash-window sweep: from `start`, walk right to sx then (hop 3 f and) dash; the window is the span of sx that satisfies stop. */
  Q.dashWindow = function (start, sx0, sx1, hop, stop) {
    let ok = 0, tried = 0, first = null, last = null;
    for (let sx = sx0; sx <= sx1; sx += 4) {
      Q.begin(start); tried++;
      const st = { done: false, hopAt: -1 };
      const r = Q.drive(200, function (f, p, g, H) {
        if (p.x < sx - 1 && !p.dashing && !st.done) H.hold('right', 1);
        else if (!p.dashing && p.dashCd <= 0 && !st.done) { st.done = true; if (hop) { H.tap('jump', 3); st.hopAt = f; } else H.tap('dash', 2); }
        if (hop && st.hopAt >= 0 && f === st.hopAt + 3) H.tap('dash', 2);
        if (st.done) H.hold('right', 1);
      }, stop, { stopOnHazard: true });
      if (r.result && !r.result.hazard && !r.result.room) { ok++; if (first === null) first = sx; last = sx; }
    }
    return { ok: ok, tried: tried, first: first, last: last, windowPx: first === null ? 0 : last - first + 4 };
  };
  window.QA = Q;
}

(async () => {
  const t = await launch({ bootMs: 400 });
  const page = t.page;
  const install = () => page.evaluate('(' + QA_INSTALL.toString() + ')()');
  const ev = (fn, ...args) => page.evaluate(({ src, args }) => (new Function('d', 'g', 'Q', 'args', 'return (' + src + ')(d, g, Q, ...args)'))(window.UB.debug, window.UB.game, window.QA, args), { src: fn.toString(), args });
  const state = () => page.evaluate(() => window.UB.debug.state());
  const step = (n) => page.evaluate((n) => window.UB.debug.step(n), n);
  async function keyTap(key, after = 2) { await page.keyboard.down(key); await step(1); await page.keyboard.up(key); await step(after); }
  async function shot(name, settle = 40) { await page.evaluate((n) => { for (let i = 0; i < n; i++) window.UB.debug.step(1); window.UB.game.render(1); }, settle); await t.shot(path.join(SHOTS, name)); }
  async function stepUntil(pred, max, chunk = 2) { let s = await state(); for (let i = 0; i < max && !pred(s); i += chunk) { await step(chunk); s = await state(); } return s; }
  const entered = [];   // rooms this test entered (real exits + warps), in order
  const enter = (id) => { if (entered.indexOf(id) < 0) entered.push(id); };
  async function section(name, fn) { try { await fn(); } catch (e) { check(name + ' threw: ' + (e && e.message ? e.message : String(e)), false, e && e.stack); } }
  // reload the page (fresh JS state) and CONTINUE from the title with the keyboard
  async function reloadContinue() {
    await page.reload(); await page.waitForTimeout(400); await install();
    await ev(d => d.pauseLogic(true));
    const title = await state();
    await keyTap('Enter');
    const s = await stepUntil(x => x.screen === 'play' && !x.busy, 200, 5);
    const r = await ev((d, g, Q) => ({ snap: Q.snap(), inSolid: Q.inSolid(), ab: Q.abilities() }));
    return { title: { screen: title.screen, hasSave: title.hasSave, savedRoom: title.savedRoom }, snap: r.snap, inSolid: r.inSolid, ab: r.ab, s };
  }
  // if the critical-path chain broke, later independent sections set themselves up with debug grants (and say so)
  async function ensurePlay(grants) {
    const s = await state();
    if (s.baseScreen === 'play' && s.roomId) return true;
    console.log('  (chain broken: starting a fresh Tessik game with debug grants for this section)');
    await fresh('tessik'); if (grants) await ev((d, g, Q) => Q.setAbilities(true, true, true));
    return false;
  }
  // start a fresh game for a fighter (used by the per-fighter probes at the end)
  const fresh = (fid) => ev((d, g, Q, fid) => { d.pauseLogic(true); d.newGame(fid); for (let i = 0; i < 200 && (g.screen !== 'play' || g.busy); i++) d.step(1); Q.settle(100); d.god(false); return Q.snap(); }, fid);

  await install();

  // ===================== A. boot + world sanity =====================
  await section('A', async () => {
    await page.evaluate(() => { localStorage.removeItem('underbyte.save'); localStorage.removeItem('underbyte.settings'); });
    await page.reload(); await page.waitForTimeout(400); await install();
    await ev(d => d.pauseLogic(true));
    const s = await state();
    const w = await ev((d, g) => {
      const W = window.UB.World; const cores = [], nodes = [], vendors = [];
      for (const id in W.rooms) { const r = W.rooms[id]; if (r.debug) continue; r.cores.forEach(c => cores.push(c.id + '@' + id + '(' + c.x + ',' + c.y + ')')); r.nodes.forEach(n => nodes.push(n.id)); if (r.vendor) vendors.push(id + '(' + r.vendor.x + ',' + r.vendor.y + ')'); }
      return { errors: d.worldErrors(), cores, nodes, vendors };
    });
    check('A1 boots to the title with no save and UB.World.validate() = []', s.screen === 'title' && !s.hasSave && w.errors.length === 0, { screen: s.screen, errors: w.errors });
    check('A2 world holds the 3 cores (dc_loft 27,12 · lw_belts 93,6 · dc_fall 24,4), 6 nodes and 2 vendor tiles of §10.4', w.cores.length === 3 && w.cores.includes('core_dc_loft@dc_loft(27,12)') && w.cores.includes('core_lw_belts@lw_belts(93,6)') && w.cores.includes('core_dc_fall@dc_fall(24,4)') && w.nodes.length === 6 && w.vendors.length === 2 && w.vendors.includes('dc_shrine(21,14)') && w.vendors.includes('rw_rest(21,14)'), w);
    // A3 static reachability (no abilities modelled: a tile component the exits cannot reach by ANY move is sealed for good)
    const bfs = await ev((d, g, Q) => { const W = window.UB.World, out = []; for (const id in W.rooms) { if (W.rooms[id].debug) continue; const r = Q.bfsRoom(id); if (r.bad.length || r.sealedAir) out.push(r); } return out; });
    check('A3 every placed bit / core / node / enemy / vendor / pickup / mover of every room lies in the air component of its exits (nothing is walled off: ' + (bfs.length ? bfs.map(r => r.id + ' ' + r.bad.join(' ') + ' [' + r.sealedAir + ' sealed air tiles, ' + r.sealedHaz + ' hazards]').join(' | ') : 'ok') + ')', bfs.length === 0, bfs);
  });

  // ===================== B. NEW GAME by keyboard =====================
  await section('B', async () => {
    await keyTap('Enter'); let s = await state();
    check('B1 Enter on the title → character select', s.screen === 'select', s.screen);
    await keyTap('Enter');
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 200);
    enter('dc_wake');
    check('B2 NEW GAME (Tessik) starts in dc_wake at the start tile (3,12) with 5/5 hearts, 0 bits, no abilities', s.screen === 'play' && s.fighter === 'tessik' && s.roomId === 'dc_wake' && Math.abs(s.x - 105) < 1 && s.hp === 5 && s.maxHp === 5 && !s.abilities.echoJump && !s.abilities.burstLine && !s.abilities.gripProtocol && s.bits === 0 && !s.god, s);
    s = await stepUntil(x => x.screen === 'lore', 200, 4);
    check('B3 the Driftcache lore card opens once after the zone toast', s.screen === 'lore', s.screen);
    await step(14); await keyTap('Enter', 4); s = await state();
    check('B4 a key dismisses the lore card (loreSeen records driftcache)', s.screen === 'play' && s.loreSeen.includes('driftcache'), { screen: s.screen, loreSeen: s.loreSeen });
    // B5 a death before the first rest: the respawn is the start node (node_dc_wake), not a wall / the void
    const r = await ev((d, g, Q) => {
      Q.waitNormal(200); d.warp('dc_fall', { x: 5 * 30 + 15, y: 20 * 30 }); Q.settle(3);
      d.teleport(25 * 30 + 15, 27 * 30);   // feet on the tile under the row-26 spike bed (x24-27): the body overlaps the spike box
      const r = Q.dieAndRespawn(600);
      r.nodeId = g.save.spawn.nodeId; r.roomId = g.save.roomId;
      return r;
    });
    enter('dc_fall');
    check('B5 dying on spikes with 1 heart before ever resting → game over → confirm → respawn at node_dc_wake (5,12): dc_wake x 165 y 390, hearts full, grounded, not in a wall', r.died && r.go.screen === 'gameover' && r.go.deaths === r.go.d0 + 1 && r.snap.room === 'dc_wake' && Math.abs(r.snap.x - 165) < 1 && r.snap.y === 390 && r.snap.hp === r.snap.maxHp && r.snap.g && !r.inSolid && r.nodeId === 'node_dc_wake' && r.roomId === 'dc_wake', r);
  });

  // ===================== C. tier 0 with real inputs =====================
  await section('C', async () => {
    // C1 dc_wake → R (from the node after B5)
    let r = await ev((d, g, Q) => { Q.bigHp(); d.god(false); return Q.walk([{ tx: 33, exit: true, autoPit: true, dropLimit: 4 }], 1500); });
    if (r.ok) enter('dc_fall');
    check('C1 REAL INPUT dc_wake: walk off the dais past the scuttlebit → R → dc_fall (no hazard)', r.ok && r.to === 'dc_fall' && r.exit === 'R' && r.hazards === 0, r);
    // C2 dc_fall: the full §10.3 descent (entry ledge → grate row 8 → the well → grate row 40 → floor → R), no hazard
    r = await ev((d, g, Q) => {
      Q.settle(40); d.killEnemies();
      const w = Q.walk([
        { tx: 13, noAutoJump: true, tol: 10 },                 // off the entry ledge onto the row-8 grate (x13-16)
        { tx: 17, noAutoJump: true, tol: 4, stuck: 60 },       // walk to x17: off the grate's right end, straight down the well
        { tx: 17, ty: 39, noAutoJump: true, tol: 40 },         // lands on the row-40 grate (x16-19)
        { tx: 21, noAutoJump: true, tol: 4, stuck: 60 },       // off its right end
        { tx: 21, ty: 49, noAutoJump: true, tol: 40 },         // the floor row 49, right of the 5-wide spike bed (x12-16)
        { tx: 33, exit: true, noAutoJump: true },
      ], 3000);
      return { ok: w.ok, to: w.to, exit: w.exit, hazards: w.hazards, reason: w.reason, i: w.i, log: w.log, snap: w.snap };
    });
    if (r.ok) enter('dc_cross');
    check('C2 REAL INPUT dc_fall: the 50-row descent (entry ledge → grate row 8 → the well → grate row 40 → floor) → R → dc_cross, no hazard', r.ok && r.to === 'dc_cross' && r.exit === 'R' && r.hazards === 0, r);
    // C3 dc_cross → R
    r = await ev((d, g, Q) => { Q.settle(40); d.killEnemies(); const w = Q.walk([{ tx: 65, exit: true, autoPit: true, dropLimit: 4 }], 2400); return { ok: w.ok, to: w.to, exit: w.exit, hazards: w.hazards, reason: w.reason, snap: w.snap }; });
    if (r.ok) enter('dc_shrine');
    check('C3 REAL INPUT dc_cross: two spike pits + the mound → R → dc_shrine, no hazard', r.ok && r.to === 'dc_shrine' && r.exit === 'R' && r.hazards === 0, r);
    // C4 dc_shrine: node + vendor
    r = await ev((d, g, Q) => { Q.settle(40); Q.restoreHp(); d.setHp(3); return Q.restAtNode(9); });
    check('C4a walking to node_dc_shrine shows ▲ REST; Up rests: hearts full, save written to dc_shrine', r.walked && r.near === 'node_dc_shrine' && r.prompt === 'REST' && r.modeAfterPress === 'nodeUse' && r.savedRoom === 'dc_shrine' && r.hp === r.snap.maxHp, r);
    r = await ev((d, g, Q) => { const w = Q.walk([{ tx: 21, tol: 4, noAutoJump: true }], 900); d.step(2); const s = d.state(); return { walked: w.ok, nearVendor: s.nearVendor, prompt: s.prompt, bits: s.bits, poor: d.buy('spare_cell'), vendor: s.vendor }; });
    check('C4b walking to Scrivvet (21,14) shows ▲ TRADE; with ' + r.bits + ' bits a 90-bit purchase is refused ("poor")', r.walked && r.nearVendor && r.prompt === 'TRADE' && r.poor === 'poor' && r.vendor.length === 0, r);
    // C4c the real interaction: Up at Scrivvet opens the shop, Confirm buys row 1 (SPARE CELL 90; the bits come from debug.addBits), Back closes it
    r = await ev((d, g, Q) => {
      const bits0 = g.save.bits; d.addBits(90 - Math.min(bits0, 90));
      Q.kdown('up', 2); Q.stepK(); Q.stepK(); Q.stepK();
      const opened = { overlay: g.overlay, mode: g.mode };
      Q.kdown('confirm', 2); Q.stepK(); Q.stepK(); Q.stepK(); Q.stepK();
      const after = { bits: g.save.bits, vendor: g.save.vendor.slice(), energyMax: g.player.energyMax, overlay: g.overlay, saved: g.savedData && g.savedData.vendor };
      Q.kdown('back', 2); Q.stepK(); Q.stepK(); Q.stepK(); Q.stepK();
      return { opened, after, closed: { overlay: g.overlay, banner: window.UB.UI.banner1, screen: g.screen } };
    });
    check('C4c a real Up press at Scrivvet opens the shop overlay; Confirm buys SPARE CELL (bits −90, energyMax 125, saved); Back closes it with the PURCHASED banner', r.opened.overlay === 'shop' && r.after.vendor.includes('spare_cell') && r.after.energyMax === 125 && r.after.saved && r.after.saved.includes('spare_cell') && r.closed.overlay === null && r.closed.screen === 'play' && r.closed.banner === 'SPARE CELL PURCHASED', r);
    // C5 dc_sentinel: seal, death mid-fight, respawn, re-entry, quit + continue
    r = await ev((d, g, Q) => { const w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900); let k = 0; while (k++ < 40 && g.bossFight.state !== 'intro') d.step(1); return { ok: w.ok, to: w.to, bf: g.bossFight.state, boss: g.boss && g.boss.id, sealedL: Q.sealed('L'), locked: g.player.locked }; });
    if (r.ok) enter('dc_sentinel');
    check('C5a REAL INPUT dc_shrine → R → dc_sentinel: Tallock intro starts, L seals, player locked', r.ok && r.to === 'dc_sentinel' && r.bf === 'intro' && r.boss === 'tallock' && r.sealedL === true && r.locked === true, r);
    r = await ev((d, g, Q) => { while (g.bossFight.state === 'intro') d.step(1); return Q.dieAndRespawn(2400); });
    check('C5b dying mid-fight (1 heart, no god) → game over → confirm → respawn at node_dc_shrine (9,14): full hearts, grounded, not in a wall, no boss', r.died && r.go.screen === 'gameover' && r.go.deaths === r.go.d0 + 1 && r.snap.room === 'dc_shrine' && Math.abs(r.snap.x - 285) < 1 && r.snap.y === 450 && r.snap.hp === r.snap.maxHp && r.snap.g && !r.inSolid && !r.boss && r.bf === 'none' && r.snap.mode === 'normal', r);
    r = await ev((d, g, Q) => {
      const w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900);
      const onEntry = { sealedL: Q.sealed('L'), bf: g.bossFight.state, boss: g.boss && g.boss.id, hp: g.boss && g.boss.hp };
      let k = 0; while (k++ < 40 && g.bossFight.state !== 'intro') d.step(1);
      const intro = { bf: g.bossFight.state, sealedL: Q.sealed('L') };
      while (g.bossFight.state === 'intro') d.step(1); d.step(30);
      const qc = Q.quitContinue();
      const w2 = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900);
      const re = { sealedL: Q.sealed('L'), bf: g.bossFight.state, hp: g.boss && g.boss.hp };
      return { w: w.ok, onEntry, intro, qc, w2: w2.ok, re };
    });
    check('C5c re-entering after death: the seal is open on entry, Tallock is back at full HP, the intro re-seals L', r.w && r.onEntry.sealedL === false && r.onEntry.bf === 'none' && r.onEntry.hp === 120 && r.intro.bf === 'intro' && r.intro.sealedL === true, r);
    check('C5d quit to title mid-fight → CONTINUE puts the player at node_dc_shrine; re-entering restarts a fresh fight', r.qc.title.screen === 'title' && r.qc.title.hasSave && r.qc.title.savedRoom === 'dc_shrine' && r.qc.snap.room === 'dc_shrine' && Math.abs(r.qc.snap.x - 285) < 1 && r.qc.snap.y === 450 && r.qc.snap.mode === 'normal' && r.w2 && r.re.sealedL === false && r.re.hp === 120, r);
    // C6 Tallock for real → gate 1 blocked / reward survives a quit / passed
    r = await ev((d, g, Q) => { let k = 0; while (k++ < 40 && g.bossFight.state !== 'intro') d.step(1); d.god(true); const f = Q.bossMacro({ maxFrames: 5000, jumpEvery: 5 }); d.god(false); return f; });
    check('C6a Tallock dies to the light macro', r.fight === 'dying' || r.fight === 'reward', r);
    r = await ev((d, g, Q) => {
      let k = 0; while (k++ < 600 && !(g.bossFight.state === 'reward')) d.step(1);
      const ab0 = Q.abilities();
      const start = { x: 36 * 30 + 15, y: 15 * 30 };
      const stop = (f, p, g) => (p.onGround && p.y <= 301 && p.x >= 39 * 30) ? { onBlock: true, x: p.x, y: p.y } : (p.x < 27 * 30 ? { abort: true } : null);
      const sw = Q.sweep(start, 1, stop, { frames: 120, runups: [0, 6, 12, 20, 30, 45], jHolds: [20, 10], ejs: [undefined], das: [undefined] });
      const ra = Q.randomAttempts(start, 6, 600, stop, { dirBias: 1 });
      Q.restoreHp();
      return { ab0, blocked: !sw.success && !ra.success, tried: sw.tried + ra.tried, minY: Math.min(sw.minY, ra.minY), maxX: Math.max(sw.maxX, ra.maxX), sealedL: Q.sealed('L'), fight: g.bossFight.state };
    });
    check('C6b GATE 1 BLOCKED: without Echo Jump ' + r.tried + ' attempts (run-up/jump sweep + 600 f random) never stand on the 5-tile block (best feet y ' + r.minY + '; max x ' + r.maxX + ' < 1200)', r.ab0[0] === false && r.blocked && r.maxX < 1200 && r.fight === 'reward', r);
    // C6e the reward survives a quit: CONTINUE → node → re-enter → the module waits at (20,14), no boss, L open (CONTRACT v4 §8 boss flow)
    r = await ev((d, g, Q) => {
      Q.waitNormal(200); d.teleport(10 * 30 + 15, 15 * 30); d.step(2);
      const before = { bf: g.bossFight.state, bosses: g.save.bossesDefeated.slice(), sealedL: Q.sealed('L'), ab: Q.abilities(), modules: Q.modules() };
      const qc = Q.quitContinue();
      const w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900); Q.settle(5);
      const re = { room: g.level.room.id, boss: !!g.boss, bf: g.bossFight.state, sealedL: Q.sealed('L'), modules: Q.modules(), ab: Q.abilities(), bosses: g.save.bossesDefeated.slice() };
      return { before, qc, w: w.ok, re };
    });
    check('C6e quitting to the title during the reward (module uncollected) → CONTINUE at node_dc_shrine → re-entering dc_sentinel: Tallock stays purged, no fight, L open, the ECHO JUMP module waits at (20,14)', r.before.bf === 'reward' && r.before.bosses.includes('tallock') && !r.before.ab[0] && r.qc.title.savedRoom === 'dc_shrine' && r.qc.snap.room === 'dc_shrine' && r.w && r.re.room === 'dc_sentinel' && !r.re.boss && r.re.bf === 'none' && r.re.sealedL === false && r.re.modules.length === 1 && r.re.modules[0].ability === 'echoJump' && Math.abs(r.re.modules[0].x - 615) < 1 && Math.abs(r.re.modules[0].y - 450) < 1 && !r.re.ab[0] && r.re.bosses.includes('tallock'), r);
    r = await ev((d, g, Q) => { const a = Q.takeAbility(); a.sealedL = Q.sealed('L'); return a; });
    check('C6c walking onto the waiting module (real input) → pickup sequence → ECHO JUMP ACQUIRED, saved, L stays open', r.ok && r.banner.l1 === 'ECHO JUMP ACQUIRED' && r.abilities[0] === true && !r.abilities[1] && r.bosses.includes('tallock') && r.fight === 'done' && r.sealedL === false, r);
    r = await ev((d, g, Q) => { const w = Q.walk([{ tx: 50, exit: true, autoPit: true, ej: true, ejVy: 0 }], 2400); return { ok: w.ok, to: w.to, exit: w.exit, hazards: w.hazards, reason: w.reason, snap: w.snap }; });
    if (r.ok) enter('lw_hoist');
    check('C6d GATE 1 PASSES: REAL INPUT jump + Echo Jump onto the block → R2 → lw_hoist', r.ok && r.to === 'lw_hoist' && r.exit === 'R2', r);
  });

  // ===================== D. tier 1 =====================
  await section('D', async () => {
    // D1 lw_hoist: hoists H1/H2 with real inputs
    let r = await ev((d, g, Q) => {
      Q.settle(100); d.killEnemies(); Q.bigHp();
      const H1 = () => g.level.platforms.find(m => m.id === 'H1'), H2 = () => g.level.platforms.find(m => m.id === 'H2');
      const log = []; let f = 0;
      const w = Q.walk([{ tx: 9, tol: 4, noAutoJump: true }], 600); log.push(['ledge', w.ok]);
      let k = 0; while (k++ < 1500 && !(H1().y <= 300 && (H1().dir === 1 || H1().waitT > 0))) { d.step(1); f++; }
      const r1 = Q.drive(120, (f, p, g, H) => { H.hold('right', 1); }, (f, p) => p.ground ? { onH1: true } : null, {}); log.push(['onto H1', r1.result]);
      k = 0; while (k++ < 3000 && !(H1().y >= 598 && Math.abs(H2().y - 600) < 50)) { d.step(1); f++; }
      const r2 = Q.drive(150, (f, p, g, H) => { H.hold('right', 1); if (f === 0) H.hold('jump', 20); if (f === 24) H.hold('jump', 20); }, (f, p) => (p.onGround && p.x >= 18 * 30) ? { across: true, mover: !!p.ground, x: +p.x.toFixed(0), y: p.y } : null, { stopOnHazard: true });
      log.push(['across to H2 / the right ledge', r2.result, r2.hazards]);
      k = 0; while (k++ < 3000 && !(H2().y >= 838)) { d.step(1); f++; }
      const r3 = Q.drive(300, (f, p, g, H) => { if (p.x > 470) H.hold('left', 1); }, null, { stopOnRoomChange: true });
      log.push(['drop into the chute', r3.roomChanged, r3.hazards]);
      return { log, hazards: r1.hazards + r2.hazards + r3.hazards, to: r3.roomChanged && r3.roomChanged.to, exit: r3.roomChanged && r3.roomChanged.exit, f };
    });
    if (r.to) enter(r.to);
    check('D1 REAL INPUT lw_hoist: ride H1 down, Echo Jump across to H2 / the right ledge, drop into the pillar chute → B → lw_belts, no static pool touched', r.to === 'lw_belts' && r.exit === 'B' && r.hazards === 0, r);
    // D2 lw_belts: core-2 gap blocked with Echo Jump only (probe inside the room), then the belts with real inputs
    r = await ev((d, g, Q) => {
      Q.settle(40);
      const start = { room: 'lw_belts', x: 82 * 30 + 15, y: 7 * 30 };
      const stop = (f, p, g) => (p.onGround && p.x >= 90 * 30 && p.y <= 211) ? { onLedge: true, x: p.x, y: p.y } : null;
      const sw = Q.sweep(start, 1, stop, { frames: 120, runups: [0, 6, 12, 20], jHolds: [2, 4, 8, 20], ejs: [undefined, 4, 8, 12], das: [undefined] });
      const ra = Q.randomAttempts(start, 6, 600, stop, { dirBias: 1 });
      const fromFloor = Q.randomAttempts({ room: 'lw_belts', x: 88 * 30 + 15, y: 15 * 30 }, 4, 600, stop, { dirBias: 1 });
      return { ab: Q.abilities(), blocked: !sw.success && !ra.success && !fromFloor.success, tried: sw.tried + ra.tried + fromFloor.tried, maxXcrawl: Math.max(sw.maxX, ra.maxX), minYfloor: fromFloor.minY };
    });
    check('D2a core-2 gap BLOCKED with Echo Jump only: ' + r.tried + ' attempts never reach the x90-94 ledge (crawlspace gap, nor from the floor: best feet y ' + r.minYfloor + ' > 210)', r.ab[0] && !r.ab[1] && r.blocked && r.minYfloor > 211, r);
    r = await ev((d, g, Q) => {
      d.warp('lw_belts', 'T'); Q.settle(3); d.killEnemies(); Q.bigHp();
      const M1 = () => g.level.platforms.find(m => m.id === 'M1'), M2 = () => g.level.platforms.find(m => m.id === 'M2');
      const log = []; let hz = 0;
      let w = Q.walk([{ tx: 16, noAutoJump: true, tol: 20 }, { tx: 19, ty: 14, noAutoJump: true, tol: 4 }], 900); log.push(['T grate → floor x19', w.ok, w.log]); hz += w.hazards;
      let k = 0; while (k++ < 1500 && !(M1().x <= 640 && (M1().dir === 1 || M1().waitT > 0))) d.step(1);
      let r1 = Q.drive(90, (f, p, g, H) => { H.hold('right', 1); if (f === 0) H.hold('jump', 20); }, (f, p) => p.ground ? { onM1: true } : null, { stopOnHazard: true }); log.push(['M1', r1.result]); hz += r1.hazards;
      k = 0; while (k++ < 1500 && !(M1().x >= 830)) d.step(1);
      let r2 = Q.drive(120, (f, p, g, H) => { H.hold('right', 1); if (f === 0) H.hold('jump', 16); }, (f, p) => (p.onGround && !p.ground && p.x >= 32 * 30 && p.y <= 451) ? { off: true } : null, { stopOnHazard: true }); log.push(['off M1', r2.result]); hz += r2.hazards;
      w = Q.walk([{ tx: 43, ty: 14, noAutoJump: true, tol: 4 }], 900); log.push(['to x43', w.ok]); hz += w.hazards;
      k = 0; while (k++ < 1500 && !(M2().x <= 1360 && (M2().dir === 1 || M2().waitT > 0))) d.step(1);
      r1 = Q.drive(90, (f, p, g, H) => { H.hold('right', 1); if (f === 0) H.hold('jump', 20); }, (f, p) => p.ground ? { onM2: true } : null, { stopOnHazard: true }); log.push(['M2', r1.result]); hz += r1.hazards;
      k = 0; while (k++ < 1500 && !(M2().x >= 1550)) d.step(1);
      r2 = Q.drive(120, (f, p, g, H) => { H.hold('right', 1); if (f === 0) H.hold('jump', 16); }, (f, p) => (p.onGround && !p.ground && p.x >= 56 * 30 && p.y <= 451) ? { off: true } : null, { stopOnHazard: true }); log.push(['off M2', r2.result]); hz += r2.hazards;
      w = Q.walk([{ tx: 97, exit: true, autoPit: true }], 1500); log.push(['→ R', w.ok, w.to]); hz += w.hazards;
      return { log, hazards: hz, to: w.to, exit: w.exit, ok: w.ok };
    });
    if (r.to) enter(r.to);
    check('D2b REAL INPUT lw_belts (T arrival on the row-4 grate): belts M1 and M2 over both static pools, the mound → R → lw_rest, no pool touched', r.ok && r.to === 'lw_rest' && r.exit === 'R' && r.hazards === 0, r);
    // D3 lw_rest: the hatch on the way to the node, rest, reload + CONTINUE, map
    r = await ev((d, g, Q) => {
      Q.settle(100); Q.restoreHp(); d.setHp(2);
      const E = window.UB.Entity, rows = []; for (let y = 13; y < 17; y++) { let t = ''; for (let x = 0; x < 10; x++) t += E.tileAt(g.level, x, y); rows.push(y + ':' + t); }
      const walk = Q.drive(240, (f, p, g, H) => { H.hold('right', 1); }, (f, p) => (p.x >= 300) ? { past: true } : null, { stopOnRoomChange: true });
      return { rows, result: walk.result, roomChanged: walk.roomChanged, snap: walk.snap };
    });
    if (r.roomChanged) enter(r.roomChanged.to);
    check('D3a0 lw_rest: walking at floor level from the L arrival toward the node does not fall through the row-14 hatch grate (DESIGN §6.10: a hatch in the floor, Down+Jump to drop)', r.result && r.result.past && !r.roomChanged, r);
    r = await ev((d, g, Q) => {
      if (g.level.room.id !== 'lw_rest') { Q.waitNormal(200); d.warp('lw_rest', 'L'); Q.settle(3); }
      Q.restoreHp(); d.setHp(2);
      Q.walk([{ tx: 8, ty: 14, jumpAt: 2, jumpDir: 1, jumpTol: 20, tol: 30, noAutoJump: true, stuck: 120 }], 300);   // hop over the hatch
      return Q.restAtNode(15);
    });
    check('D3a rest at node_lw_rest (real walk + Up): save → lw_rest, hearts full', r.walked && r.near === 'node_lw_rest' && r.prompt === 'REST' && r.savedRoom === 'lw_rest' && r.hp === r.snap.maxHp, r);
    const before = await state();
    await page.reload(); await page.waitForTimeout(400); await install();
    await ev(d => d.pauseLogic(true)); let s = await state();
    check('D3b after a page reload the title offers CONTINUE (saved room lw_rest)', s.screen === 'title' && s.hasSave && s.savedRoom === 'lw_rest', s);
    await keyTap('Enter'); s = await stepUntil(x => x.screen === 'play' && !x.busy, 200, 5);
    r = await ev((d, g, Q) => ({ snap: Q.snap(), inSolid: Q.inSolid(), bosses: g.save.bossesDefeated.slice(), ab: Q.abilities() }));
    check('D3c CONTINUE (zone 2) → lw_rest at the node tile (15,14): x 465 y 450, grounded, not in a wall, hearts full, Echo Jump + Tallock kept', s.roomId === 'lw_rest' && Math.abs(s.x - 465) < 1 && s.y === 450 && r.snap.g && !r.inSolid && s.hp === s.maxHp && s.maxHp === before.maxHp && r.ab[0] && !r.ab[1] && r.bosses.includes('tallock') && s.bits === before.bits, { s, r });
    await ev((d, g, Q) => Q.settle(100));
    await keyTap('KeyM', 3); s = await state();
    const map = await ev((d, g, Q, entered) => {
      const W = window.UB.World; const vis = g.save.visited.slice(), disc = g.save.discovered.slice();
      const expectDisc = entered.slice(); for (const id of entered) for (const e of W.rooms[id].exits) if (expectDisc.indexOf(e.to.room) < 0) expectDisc.push(e.to.room);
      const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));
      return { vis, disc, expectDisc, visitedOk: same(vis, entered), discoveredOk: same(disc, expectDisc) };
    }, entered);
    check('D3d M opens the map; save.visited is exactly the ' + entered.length + ' rooms entered so far (' + entered.join(' ') + ')', s.screen === 'map' && map.visitedOk, { screen: s.screen, vis: map.vis, entered });
    check('D3e save.discovered is exactly visited + every room a visited exit leads to (' + map.expectDisc.length + ' rooms), nothing else', map.discoveredOk, map);
    await shot('qa-prog-map-lw_rest.png');
    await keyTap('KeyM', 3); s = await state();
    check('D3f M closes the map', s.screen === 'play', s.screen);
    // D3g LOOP A (DESIGN §10.4) with REAL INPUTS at tier 1: lw_shaft (R arrival, as from lw_belts.L) climbed floor → row-28 grate (6-tile rise: jump +
    // Echo Jump) → row-24 grate → hoist S1 → row-9 grate → ledge row 5 → R2 → dc_cross.L2 shelf; drop to the floor and come back onto the 6-tile shelf
    // (180 px: Echo Jump) → L2 → lw_shaft.R2 → descend the grates → R → lw_belts. (lw_belts itself was crossed in D2b; the warp only skips its re-crossing.)
    r = await ev((d, g, Q) => {
      Q.waitNormal(200); d.warp('lw_shaft', 'R'); Q.settle(3); d.killEnemies(); Q.bigHp();
      const log = []; let hz = 0;
      const S1 = () => g.level.platforms.find(m => m.id === 'S1');
      let w = Q.walk([{ tx: 23, tol: 4, noAutoJump: true }], 400); hz += w.hazards;
      let r1 = Q.drive(120, (f, p, g, H) => { if (f === 0) H.tap('jump', 24); if (f === 22) H.tap('jump', 22); }, (f, p) => (p.onGround && p.y <= 841) ? { g28: true, y: p.y } : null, { stopOnHazard: true }); log.push(['grate28 (6-tile rise)', r1.result]); hz += r1.hazards;
      const rise6 = !!(r1.result && r1.result.g28);
      if (!rise6) { Q.waitNormal(100); d.teleport(23 * 30 + 15, 28 * 30); d.step(2); }
      w = Q.walk([{ tx: 15, ty: 23, jumpAt: 20, jumpDir: -1, jumpTol: 30, ej: true, ejVy: -100, tol: 40, noAutoJump: true, stuck: 200 }], 600); log.push(['grate24', w.ok]); hz += w.hazards;
      if (!w.ok) { Q.waitNormal(100); d.teleport(14 * 30 + 15, 24 * 30); d.step(2); }
      w = Q.walk([{ tx: 12, tol: 4, noAutoJump: true }], 400);
      let k = 0; while (k++ < 3000 && !(S1().dist <= 0.01 && S1().waitT > 25)) d.step(1);
      r1 = Q.drive(200, (f, p, g, H) => { if (!p.ground) H.hold('left', 1); }, (f, p) => p.ground ? { onS1: true, y: +p.y.toFixed(0) } : null, { stopOnHazard: true }); log.push(['S1 from the row-24 grate', r1.result]); hz += r1.hazards;
      const onS1 = !!(r1.result && r1.result.onS1);
      if (!onS1) { Q.waitNormal(100); k = 0; while (k++ < 3000 && !(S1().dist <= 0.01 && S1().waitT > 25)) d.step(1); d.teleport(9 * 30 + 15, S1().y); d.step(1); }
      k = 0; while (k++ < 3000 && !(S1().y <= 301 && S1().waitT > 0)) d.step(1);
      w = Q.walk([{ tx: 16, ty: 8, jumpAt: 10, jumpDir: 1, jumpTol: 30, jHold: 16, ej: true, ejVy: -100, tol: 40, noAutoJump: true, stuck: 120 }], 300); log.push(['row-9 grate from S1 top', w.ok]); hz += w.hazards;
      if (!w.ok) { Q.waitNormal(100); d.teleport(16 * 30 + 15, 9 * 30); d.step(2); }
      w = Q.walk([{ tx: 23, ty: 4, jumpAt: 17, jumpDir: 1, jumpTol: 30, jHold: 24, ej: true, ejVy: -100, tol: 40, noAutoJump: true, stuck: 200 }, { tx: 33, exit: true, noAutoJump: true }], 900); log.push(['ledge row 5 → R2', w.ok, w.to, w.exit]); hz += w.hazards;
      const toCross = w.to === 'dc_cross' && w.exit === 'R2';
      const arrive = Q.snap();
      Q.settle(40); d.killEnemies();
      w = Q.walk([{ tx: 12, ty: 14, noAutoJump: true, tol: 40, stuck: 200 }, { tx: 10, tol: 4, noAutoJump: true }], 600); log.push(['dc_cross floor', w.ok, Q.snap().y]); hz += w.hazards;
      r1 = Q.drive(150, (f, p, g, H) => { if (f > 2) H.hold('left', 1); if (f === 0) H.tap('jump', 24); if (f === 22) H.tap('jump', 22); }, (f, p) => (p.onGround && p.y <= 271 && p.x < 9 * 30) ? { shelf: true, y: p.y } : null, { stopOnHazard: true, stopOnRoomChange: true }); log.push(['shelf from the floor (Echo Jump)', r1.result]); hz += r1.hazards;
      const shelf = !!(r1.result && r1.result.shelf);
      if (!shelf) { Q.waitNormal(100); d.warp('dc_cross', { x: 4 * 30 + 15, y: 9 * 30 }); d.step(2); }
      w = Q.walk([{ tx: -2, exit: true, noAutoJump: true }], 600); log.push(['L2', w.ok, w.to, w.exit]); hz += w.hazards;
      const toShaft = w.to === 'lw_shaft' && w.exit === 'L2';
      Q.settle(40); d.killEnemies();
      w = Q.walk([{ tx: 19, tol: 4, noAutoJump: true }], 600);
      const down = Q.drive(1500, (f, p, g, H) => { const E = window.UB.Entity; const ty = Math.floor((p.y - 1) / 30) + 1, tx = Math.floor(p.x / 30); if (p.onGround && p.y < 1000 && E.tileAt(g.level, tx, ty) === '-' && (f % 10) === 0) { H.hold('down', 8); H.tap('jump', 3); } if (p.x < 20 * 30) H.hold('right', 1); }, (f, p) => (p.onGround && p.y >= 1019 && p.x >= 19 * 30) ? { floor: true, x: +p.x.toFixed(0) } : null, { stopOnHazard: true }); log.push(['descend the grates', down.result]); hz += down.hazards;
      w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 600); log.push(['R', w.ok, w.to, w.exit]); hz += w.hazards;
      return { log, hz, rise6, onS1, toCross, arrive, shelf, toShaft, toBelts: w.to === 'lw_belts' && w.exit === 'R', end: Q.snap() };
    });
    enter('lw_shaft');
    check('D3g LOOP A (REAL INPUT, Echo Jump only): lw_shaft floor → row-28 grate (6-tile rise) → row-24 grate → hoist S1 → row-9 grate → ledge → R2 → dc_cross.L2 (shelf, feet y 270); floor → the 6-tile shelf with Echo Jump → L2 → lw_shaft descent → R → lw_belts; no hazard', r.rise6 && r.onS1 && r.toCross && r.arrive.room === 'dc_cross' && r.arrive.y === 270 && r.shelf && r.toShaft && r.toBelts && r.hz === 0, r);
    enter('lw_belts');
    await ev((d, g, Q) => { Q.waitNormal(200); d.warp('lw_rest', 'L'); Q.settle(3); Q.restoreHp(); });
    // D4 Weftyr → Burst Line → the hatch
    r = await ev((d, g, Q) => { d.god(false); const w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900); let k = 0; while (k++ < 40 && g.bossFight.state !== 'intro') d.step(1); return { ok: w.ok, to: w.to, bf: g.bossFight.state, boss: g.boss && g.boss.id, sealed: ['L', 'B'].map(id => g.level.openings.find(o => o.id === id).sealed) }; });
    if (r.ok) enter('lw_weftyr');
    check('D4a REAL INPUT lw_rest → R → lw_weftyr: Weftyr intro, L and B sealed', r.ok && r.to === 'lw_weftyr' && r.bf === 'intro' && r.boss === 'weftyr' && r.sealed[0] && r.sealed[1], r);
    r = await ev((d, g, Q) => { d.god(true); const f = Q.bossMacro({ maxFrames: 6000, jumpEvery: 4 }); d.god(false); return f; });
    check('D4b Weftyr dies to the macro', r.fight === 'dying' || r.fight === 'reward', r);
    // D4b2 a page reload mid-reward (Weftyr dead, BURST LINE uncollected) → CONTINUE (zone 2) → lw_rest; walking back finds the module waiting, no fight, both seals open
    r = await ev((d, g, Q) => { let k = 0; while (k++ < 600 && g.bossFight.state !== 'reward') d.step(1); return { bf: g.bossFight.state, bosses: g.save.bossesDefeated.slice(), ab: Q.abilities(), savedRoom: g.savedData && g.savedData.roomId, savedBosses: g.savedData && g.savedData.bossesDefeated }; });
    const rc = await reloadContinue();
    const rr = await ev((d, g, Q) => { Q.settle(100); const w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900); Q.settle(5); return { w: w.ok, room: g.level.room.id, boss: !!g.boss, bf: g.bossFight.state, sealed: [Q.sealed('L'), Q.sealed('B')], modules: Q.modules(), ab: Q.abilities() }; });
    check('D4b2 reload mid-reward: the boss-death save already lists weftyr; CONTINUE → lw_rest node (15,14); re-entering lw_weftyr: no boss, no fight, L and B open, the BURST LINE module waits at (20,14)', r.bf === 'reward' && r.savedBosses && r.savedBosses.includes('weftyr') && r.savedRoom === 'lw_rest' && rc.snap.room === 'lw_rest' && Math.abs(rc.snap.x - 465) < 1 && rc.snap.y === 450 && rr.w && rr.room === 'lw_weftyr' && !rr.boss && rr.bf === 'none' && rr.sealed[0] === false && rr.sealed[1] === false && rr.modules.length === 1 && rr.modules[0].ability === 'burstLine' && Math.abs(rr.modules[0].x - 615) < 1 && !rr.ab[1], { r, rc: rc.snap, rr });
    r = await ev((d, g, Q) => { const a = Q.takeAbility(); a.sealed = ['L', 'B'].map(id => g.level.openings.find(o => o.id === id).sealed); return a; });
    check('D4c BURST LINE ACQUIRED by walking onto the module; both seals lift', r.ok && r.banner.l1 === 'BURST LINE ACQUIRED' && r.abilities[1] === true && r.bosses.includes('weftyr') && !r.sealed[0] && !r.sealed[1], r);
    r = await ev((d, g, Q) => {
      Q.bigHp();
      const w = Q.walk([{ tx: 38, tol: 4, noAutoJump: true }, { tx: 43, ty: 14, jumpAt: 38, jumpDir: 1, ej: true, ejVy: -150, tol: 40, noAutoJump: true, stuck: 120 }], 900);
      let to = w.to, exit = w.exit, hz = w.hazards;
      if (!to) { const r2 = Q.drive(300, (f, p, g, H) => { if (Math.abs(p.x - 1305) > 4) H.hold(p.x < 1305 ? 'right' : 'left', 1); }, null, { stopOnRoomChange: true }); to = r2.roomChanged && r2.roomChanged.to; exit = r2.roomChanged && r2.roomChanged.exit; hz += r2.hazards; }
      return { log: w.log, to: to, exit: exit, hazards: hz };
    });
    if (r.to) enter(r.to);
    check('D4d REAL INPUT the hatch: Echo Jump over the 1-wide wall x40 into the pocket, drop into the chute → B → bv_sluice', r.to === 'bv_sluice' && r.exit === 'B', r);
    // D5 bv_sluice: T arrival, drop through, GATE 2 blocked / passed
    r = await ev((d, g, Q) => {
      Q.settle(100); d.killEnemies(); Q.bigHp();
      const land = Q.drive(60, null, (f, p) => p.onGround ? { y: p.y, x: +p.x.toFixed(0) } : null, {});
      const drop = Q.drive(60, (f, p, g, H) => { if (f === 0) { H.hold('down', 8); H.hold('jump', 3); } }, (f, p) => (p.onGround && p.y >= 239) ? { y: p.y } : null, {});
      return { land: land.result, drop: drop.result };
    });
    check('D5a bv_sluice T arrival lands on the row-4 grate (feet y 120); Down+Jump drops through to the crawlspace floor (y 240)', r.land && r.land.y === 120 && r.drop && r.drop.y === 240, r);
    r = await ev((d, g, Q) => {
      d.grant('burstLine', false);   // re-check the gate without the dash we just earned
      const start = { room: 'bv_sluice', x: 13 * 30 + 15, y: 8 * 30 };
      const stop = (f, p, g) => (p.onGround && p.x >= 21 * 30 && p.y <= 241) ? { crossed: true, x: p.x, y: p.y } : null;
      const sw = Q.sweep(start, 1, stop, { frames: 120, runups: [0, 6, 12, 20, 30], jHolds: [2, 4, 8, 20], ejs: [undefined, 4, 8, 12, 16], das: [undefined] });
      const ra = Q.randomAttempts(start, 6, 600, stop, { dirBias: 1 });
      d.grant('burstLine', true);
      return { blocked: !sw.success && !ra.success, tried: sw.tried + ra.tried, hazards: sw.hazards + ra.hazards, maxX: Math.max(sw.maxX, ra.maxX), ab: Q.abilities() };
    });
    check('D5b GATE 2 BLOCKED: without Burst Line ' + r.tried + ' attempts (hop/Echo Jump sweep + random) never land past the 6-tile gap (best x ' + r.maxX + ' < 630); misses end in the acid → respawn, never a trap (' + r.hazards + ' acid hits)', r.blocked && r.maxX < 630 && r.hazards > 0 && r.ab[1], r);
    r = await ev((d, g, Q) => {
      d.warp('bv_sluice', 'T'); Q.settle(3); d.killEnemies(); Q.bigHp();
      Q.drive(60, null, (f, p) => p.onGround ? 1 : null, {}); Q.drive(60, (f, p, g, H) => { if (f === 0) { H.hold('down', 8); H.hold('jump', 3); } }, (f, p) => (p.onGround && p.y >= 239) ? 1 : null, {});
      let w = Q.walk([{ tx: 13, noAutoJump: true, tol: 5 }], 600);
      const gap = Q.drive(120, (f, p, g, H) => { H.hold('right', 1); if (f === 0) H.hold('jump', 4); if (f === 6) H.hold('dash', 2); }, (f, p) => (p.onGround && p.x >= 21 * 30) ? { crossed: true, x: +p.x.toFixed(0) } : null, { stopOnHazard: true });
      w = Q.walk([{ tx: 30, noAutoJump: true, tol: 6 }, { tx: 34, noAutoJump: true }, { tx: 36, ty: 14, noAutoJump: true, tol: 40 }, { tx: 65, exit: true, noAutoJump: true }], 1500);
      return { gap: gap.result, hazards: gap.hazards + w.hazards, ok: w.ok, to: w.to, exit: w.exit, reason: w.reason };
    });
    if (r.to) enter(r.to);
    check('D5c GATE 2 PASSES: REAL INPUT hop-dash across the crawlspace gap, down to the lower hall → R → bv_cistern, no acid', r.gap && r.gap.crossed && r.ok && r.to === 'bv_cistern' && r.exit === 'R' && r.hazards === 0, r);
    // D6 LOOP B (DESIGN §10.4) and the lw_rest hatch at tier 1 / tier 2
    // D6a tier 1 (Echo Jump only): drop through the lw_rest hatch → bv_catwalk; the crawlspace gap is BLOCKED; a miss is acid → respawn at the T arrival → the ledge is a launch pad back up to lw_rest
    r = await ev((d, g, Q) => {
      d.grant('burstLine', false);
      Q.waitNormal(200); d.warp('lw_rest', { x: 15 * 30 + 15, y: 15 * 30 }); Q.settle(3); Q.bigHp();
      const w = Q.walk([{ tx: 5, tol: 4, noAutoJump: true }], 600);
      const drop = Q.dropThrough(0, 120, null);
      const out = { hatch: drop.roomChanged };
      Q.settle(3); d.killEnemies(); Q.bigHp();
      const land = Q.drive(60, null, (f, p) => p.onGround ? { y: p.y, x: +p.x.toFixed(0) } : null, {}); out.land = land.result; out.hr = Object.assign({}, g.hazardRespawn);
      const start = { room: 'bv_catwalk', x: 13 * 30 + 15, y: 5 * 30 };
      const stop = (f, p, g) => (p.onGround && p.x >= 21 * 30 && p.y <= 151) ? { crossed: true, x: p.x } : null;
      const sw = Q.sweep(start, 1, stop, { frames: 120, runups: [0, 6, 12, 20, 30], jHolds: [2, 4, 8, 20], ejs: [undefined, 4, 8, 12, 16], das: [undefined] });
      const ra = Q.randomAttempts(start, 6, 600, stop, { dirBias: 1 });
      out.blocked = { blocked: !sw.success && !ra.success, tried: sw.tried + ra.tried, hazards: sw.hazards + ra.hazards, maxX: Math.max(sw.maxX, ra.maxX) };
      // a miss from the real arrival: walk into the gap → acid → respawn falling onto the ledge → jump back up through T
      Q.waitNormal(200); d.warp('bv_catwalk', 'T'); Q.settle(3); d.killEnemies(); Q.bigHp();
      Q.drive(60, null, (f, p) => p.onGround ? 1 : null, {});
      const into = Q.drive(300, (f, p, g, H) => { H.hold('right', 1); }, null, { stopOnHazard: true });
      out.acid = !!(into.result && into.result.hazard);
      Q.waitNormal(200); d.step(3); out.respawn = Q.snap();
      const land2 = Q.drive(60, null, (f, p) => p.onGround ? { y: p.y, x: +p.x.toFixed(0) } : null, {}); out.respawnLand = land2.result;
      const up = Q.drive(150, (f, p, g, H) => { if (Math.abs(p.x - 165) > 4) H.hold(p.x < 165 ? 'right' : 'left', 1); if (f === 10) H.tap('jump', 24); if (f === 32) H.tap('jump', 20); }, null, { stopOnRoomChange: true }); out.back = up.roomChanged;
      d.grant('burstLine', true);
      return out;
    });
    enter('bv_catwalk');
    check('D6a tier 1: Down+Jump on the lw_rest hatch → B → bv_catwalk (T arrival falls onto the ledge, feet y 120); the crawlspace gap is BLOCKED without Burst Line (' + r.blocked.tried + ' attempts, max x ' + r.blocked.maxX + ' < 630); walking in = acid → respawn at the arrival → the ledge → T → lw_rest (no trap)', r.hatch && r.hatch.to === 'bv_catwalk' && r.hatch.exit === 'B' && r.land && r.land.y === 120 && r.blocked.blocked && r.blocked.maxX < 630 && r.acid && r.respawnLand && r.respawnLand.y === 120 && r.back && r.back.to === 'lw_rest' && r.back.exit === 'T', r);
    // D6b tier 2 (Echo Jump + Burst Line): the whole loop B with REAL INPUTS: lw_rest hatch → bv_catwalk (antechamber, dash the gap, the right shaft, the hall grates, the chute) →
    // bv_cistern.T (row-3 grate: Down+Jump + left onto the row-8 grate) → the upper gallery → L → bv_sluice.R (lower hall → pipe → grate → crawlspace → dash west → shelf) → T → lw_weftyr (pocket, the 1-wide wall) → L → lw_rest
    r = await ev((d, g, Q) => {
      Q.waitNormal(200); d.warp('lw_rest', { x: 15 * 30 + 15, y: 15 * 30 }); Q.settle(3); Q.bigHp();
      const log = []; let hz = 0;
      let w = Q.walk([{ tx: 5, tol: 4, noAutoJump: true }], 600);
      let r1 = Q.dropThrough(0, 120, null); log.push(['hatch', r1.roomChanged]);
      Q.settle(3); d.killEnemies(); Q.bigHp();
      Q.drive(60, null, (f, p) => p.onGround ? 1 : null, {});
      w = Q.walk([{ tx: 14, tol: 6, noAutoJump: true, stuck: 200 }], 600); log.push(['antechamber', w.ok, Q.snap().y]); hz += w.hazards;
      const gap = Q.drive(120, (f, p, g, H) => { H.hold('right', 1); if (p.onGround && p.x >= 446 && !p.dashing && p.dashCd <= 0 && f < 60) H.tap('dash', 2); }, (f, p) => (p.onGround && p.x >= 21 * 30) ? { crossed: true, x: +p.x.toFixed(0) } : null, { stopOnHazard: true }); log.push(['gap (ground dash from the edge)', gap.result]); hz += gap.hazards;
      const crossed = !!(gap.result && gap.result.crossed);
      if (!crossed) { Q.waitNormal(200); d.teleport(23 * 30 + 15, 5 * 30); d.step(2); }
      const down = Q.drive(1800, (f, p, g, H) => {
        const E = window.UB.Entity; const ty = Math.floor((p.y - 1) / 30) + 1, tx = Math.floor(p.x / 30);
        if (p.onGround && E.tileAt(g.level, tx, ty) === '-' && (f % 10) === 0) { H.hold('down', 8); H.tap('jump', 3); }
        const goal = p.y < 13 * 30 + 1 ? 28 * 30 + 15 : 30 * 30;
        if (p.x < goal - 6) H.hold('right', 1); else if (p.x > goal + 6) H.hold('left', 1);
      }, (f, p) => (p.onGround && p.y >= 989 && p.x >= 29 * 30) ? { floor: true, x: +p.x.toFixed(0) } : null, { stopOnHazard: true }); log.push(['right shaft + hall grates → floor', down.result]); hz += down.hazards;
      const hall = !!(down.result && down.result.floor);
      if (!hall) { Q.waitNormal(200); d.teleport(30 * 30 + 15, 33 * 30); d.step(2); }
      r1 = Q.drive(200, (f, p, g, H) => { H.hold('left', 1); }, null, { stopOnRoomChange: true }); log.push(['chute B', r1.roomChanged]);
      const toCistern = !!(r1.roomChanged && r1.roomChanged.to === 'bv_cistern' && r1.roomChanged.exit === 'B');
      Q.settle(3); d.killEnemies(); Q.bigHp();
      const land = Q.drive(60, null, (f, p) => p.onGround ? { y: p.y, x: +p.x.toFixed(0) } : null, {}); log.push(['cistern T arrival', land.result]);
      w = Q.walk([{ tx: 50, tol: 3, noAutoJump: true, stuck: 120 }], 300);
      const dr = Q.drive(200, (f, p, g, H) => { if (f === 0) { H.hold('down', 8); H.tap('jump', 3); } else if (f > 4) { H.hold('left', 1); if (f === 14 && !p.onGround && p.airJumps > 0) H.tap('jump', 12); } }, (f, p) => (f > 6 && p.onGround) ? { landed: true, x: +p.x.toFixed(0), y: p.y } : null, { stopOnHazard: true, stopOnRoomChange: true });
      log.push(['row-3 grate: Down+Jump + left + Echo Jump → the row-8 grate (y 240) / the slab (y 360)', dr.result]); hz += dr.hazards;
      const g8 = !!(dr.result && dr.result.landed && (dr.result.y === 240 || dr.result.y === 360));
      if (!g8) { Q.waitNormal(200); d.teleport(47 * 30 + 15, 8 * 30); d.step(2); }
      w = Q.walk((g.player.y === 240 ? [{ tx: 43, ty: 11, jumpAt: 46, jumpDir: -1, jumpTol: 20, tol: 30, noAutoJump: true, stuck: 200 }] : []).concat([
        { tx: 35, tol: 4, noAutoJump: true },
        { tx: 28, ty: 9, jumpAt: 35, jumpDir: -1, jumpTol: 20, jHold: 24, ej: true, ejVy: -100, tol: 40, noAutoJump: true, stuck: 200 },
        { tx: 27, tol: 4, noAutoJump: true },
        { tx: 20, ty: 12, jumpAt: 27, jumpDir: -1, jumpTol: 20, jHold: 24, ej: true, ejVy: -100, tol: 40, noAutoJump: true, stuck: 200 },
        { tx: 19, tol: 4, noAutoJump: true },
        { tx: 12, ty: 15, jumpAt: 19, jumpDir: -1, jumpTol: 20, jHold: 24, tol: 40, noAutoJump: true, stuck: 200 },
        { tx: -2, exit: true, noAutoJump: true },
      ]), 2400); log.push(['upper gallery → L', w.ok, w.reason, w.to, w.exit, w.i]); hz += w.hazards;
      const toSluice = w.to === 'bv_sluice' && w.exit === 'L';
      if (!toSluice) return { log, hz, crossed, hall, toCistern, g8, toSluice };
      Q.settle(3); d.killEnemies(); Q.bigHp();
      w = Q.walk([
        { tx: 55, noAutoJump: true, tol: 6 },
        { tx: 50, ty: 10, jumpAt: 54, jumpDir: -1, ej: true, ejVy: -200, tol: 40, noAutoJump: true, stuck: 150 },
        { tx: 52, ty: 5, jumpAt: 50, jumpDir: 1, ej: true, ejVy: -200, tol: 40, noAutoJump: true, stuck: 150 },
        { tx: 50, ty: 5, noAutoJump: true, tol: 6 },
        { tx: 42, ty: 7, jumpAt: 50, jumpDir: -1, dashVy: 0, tol: 60, noAutoJump: true, stuck: 150 },
        { tx: 34, ty: 7, noAutoJump: true, tol: 4 },
      ], 2500); log.push(['sluice lower hall → crawlspace', w.ok, w.reason]); hz += w.hazards;
      const shaft = Q.drive(120, (f, p, g, H) => { H.hold('left', 1); if (f === 2) H.tap('dash', 2); }, (f, p) => (p.onGround && p.x <= 30 * 30 + 15 && p.y <= 241) ? { across: true } : null, { stopOnHazard: true }); hz += shaft.hazards;
      w = Q.walk([{ tx: 22, noAutoJump: true, tol: 5 }], 600); hz += w.hazards;
      const gap2 = Q.drive(120, (f, p, g, H) => { H.hold('left', 1); if (f === 0) H.hold('jump', 4); if (f === 6) H.hold('dash', 2); }, (f, p) => (p.onGround && p.x <= 14 * 30 + 15 && p.y <= 241) ? { crossed: true } : null, { stopOnHazard: true }); hz += gap2.hazards;
      w = Q.walk([{ tx: 3, noAutoJump: true, tol: 6 }, { tx: 3, ty: 3, jumpAt: 3, jumpTol: 20, jHold: 24, ej: true, ejVy: -300, tol: 40, noAutoJump: true, stuck: 150 }], 900); hz += w.hazards;
      const up = Q.drive(120, (f, p, g, H) => { if (f === 0) H.tap('jump', 24); if (f === 22) H.tap('jump', 20); }, null, { stopOnRoomChange: true }); log.push(['sluice → T', shaft.result, gap2.result, up.roomChanged]);
      const toWeftyr = !!(up.roomChanged && up.roomChanged.to === 'lw_weftyr' && up.roomChanged.exit === 'T');
      Q.settle(3); Q.bigHp();
      const pocket = Q.drive(150, (f, p, g, H) => { H.hold('left', 1); }, (f, p) => p.onGround ? { x: +p.x.toFixed(0), y: p.y } : null, {});
      const over = Q.drive(150, (f, p, g, H) => { H.hold('left', 1); if (f === 0) H.tap('jump', 24); if (f === 22) H.tap('jump', 22); }, (f, p) => (p.onGround && p.x < 40 * 30) ? { over: true } : null, { stopOnHazard: true }); hz += over.hazards;
      w = Q.walk([{ tx: -2, exit: true, noAutoJump: true }], 900); log.push(['weftyr pocket → over the wall → L', pocket.result, over.result, w.ok, w.to, w.exit]); hz += w.hazards;
      return { log, hz, crossed, hall, toCistern, g8, toSluice, toWeftyr, over: !!(over.result && over.result.over), toRest: w.to === 'lw_rest' && w.exit === 'L', bf: g.bossFight.state, end: Q.snap() };
    });
    check('D6b LOOP B (REAL INPUT, Echo Jump + Burst Line): lw_rest hatch → bv_catwalk (ground dash across the gap from the antechamber edge → right shaft → hall grates → chute) → bv_cistern.T (Down+Jump + left + Echo Jump onto the row-8 grate / the slab) → upper gallery → L → bv_sluice.R (pipe → grate → crawlspace → dash west → shelf) → T → lw_weftyr (pocket, over the 1-wide wall) → L → lw_rest; no hazard', r.crossed && r.hall && r.toCistern && r.g8 && r.toSluice && r.toWeftyr && r.over && r.toRest && r.hz === 0, r);
    enter('bv_cistern'); enter('bv_sluice');
    await ev((d, g, Q) => { Q.waitNormal(200); d.warp('bv_cistern', 'L'); Q.settle(3); Q.restoreHp(); });
  });

  // ===================== E. tier 2 =====================
  await section('E', async () => {
    let r = await ev((d, g, Q) => {
      Q.settle(100); d.killEnemies(); Q.bigHp();
      const log = []; let hz = 0;
      let w = Q.walk([{ tx: 15, noAutoJump: true }, { tx: 13, ty: 23, noAutoJump: true, tol: 40 }, { tx: 8, noAutoJump: true }, { tx: 12, ty: 32, noAutoJump: true, tol: 40 }], 1500); log.push(['ledge → grate → left bank', w.ok, w.reason]); hz += w.hazards;
      // footings across the acid lake: [x0, x1, feet y]
      const F = [[1, 13, 990], [18, 19, 900], [24, 25, 870], [30, 31, 930], [36, 37, 840], [41, 62, 990]];
      const which = (p) => { for (let i = 0; i < F.length; i++) if (p.onGround && Math.abs(p.y - F[i][2]) < 2 && p.x >= F[i][0] * 30 - 12 && p.x <= F[i][1] * 30 + 42) return i; return -1; };
      // each 4-tile gap (rises ≤ 3 tiles): a running jump taken D px before the edge, with/without the Echo Jump or a dash at
      // the apex (DESIGN §10.3 "hop-dash or Echo Jump"); a miss is acid → respawn on the arrival ledge → back down to the bank
      const variants = [{ D: 0 }, { D: 30 }, { D: 0, ej: 20 }, { D: 40, ej: 20 }, { D: 70, ej: 20 }, { D: 0, da: 20 }, { D: 30, da: 20 }, { D: 60, da: 24 }, { D: 90, ej: 20 }, { D: 0, ej: 30 }];
      const toBank = () => Q.walk([{ tx: 15, noAutoJump: true }, { tx: 13, ty: 23, noAutoJump: true, tol: 40 }, { tx: 8, noAutoJump: true }, { tx: 12, ty: 32, noAutoJump: true, tol: 40 }], 1500);
      const known = {}, next = {}; let cur = which(g.player), guard = 0;
      while (cur >= 0 && cur < F.length - 1 && guard++ < 60) {
        let v = known[cur];
        if (!v) { next[cur] = next[cur] || 0; if (next[cur] >= variants.length) break; v = variants[next[cur]++]; }
        const edge = F[cur][1] * 30 + 30 - g.player.w / 2 - 3 - (v.D || 0);
        Q.drive(400, (f, p, g, H) => { if (p.x < edge - 2) H.hold('right', 1); else if (p.x > edge + 2) H.hold('left', 1); }, (f, p) => (p.onGround && Math.abs(p.x - edge) <= 2 && Math.abs(p.vx) < 30) ? 1 : null, {});
        const hop = Q.drive(120, (f, p, g, H) => { H.hold('right', 1); if (f === 0) H.hold('jump', 20); if (v.da !== undefined && f === v.da) H.tap('dash', 2); if (v.ej !== undefined && f === v.ej && p.airJumps > 0) H.tap('jump', 16); }, (f, p) => (which(p) > cur) ? { to: which(p), x: +p.x.toFixed(0), y: p.y } : null, { stopOnHazard: true });
        if (hop.result && hop.result.to !== undefined) { if (!known[cur]) log.push(['hop from ' + cur + ' ' + JSON.stringify(v), hop.result]); known[cur] = v; cur = hop.result.to; continue; }
        hz += hop.hazards;
        Q.waitNormal(120); d.step(3);
        if (which(g.player) < 0) toBank();   // the acid respawn put us back on the arrival ledge: down to the bank and re-cross with the known hops
        cur = which(g.player); if (cur < 0) break;
      }
      w = Q.walk([{ tx: 65, exit: true, noAutoJump: true }], 900); log.push(['→ R', w.ok, w.to]); hz += w.hazards;
      return { log, hazards: hz, ok: w.ok, to: w.to, exit: w.exit };
    });
    if (r.to) enter(r.to);
    check('E1 REAL INPUT bv_cistern: ledge → row-24 grate → left bank → the four pillars (hop-dash / Echo Jump) → right bank → R → bv_rest (' + r.hazards + ' acid hits while finding the hops)', r.ok && r.to === 'bv_rest' && r.exit === 'R', r);
    r = await ev((d, g, Q) => { Q.settle(100); Q.restoreHp(); return Q.restAtNode(15); });
    check('E2a rest at node_bv_rest (15,13): REST prompt, save → bv_rest', r.walked && r.near === 'node_bv_rest' && r.prompt === 'REST' && r.savedRoom === 'bv_rest', r);
    r = await reloadContinue();
    check('E2b page reload → CONTINUE (zone 3) → bv_rest at the node tile (15,13): x 465 y 420, grounded, not in a wall, hearts full, Echo Jump + Burst Line kept', r.title.hasSave && r.title.savedRoom === 'bv_rest' && r.snap.room === 'bv_rest' && Math.abs(r.snap.x - 465) < 1 && r.snap.y === 420 && r.snap.g && !r.inSolid && r.snap.hp === r.snap.maxHp && r.ab[0] && r.ab[1] && !r.ab[2], r);
    r = await ev((d, g, Q) => { Q.settle(100); d.god(false); const w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900); let k = 0; while (k++ < 40 && g.bossFight.state !== 'intro') d.step(1); return { ok: w.ok, to: w.to, bf: g.bossFight.state, boss: g.boss && g.boss.id, sealedB: Q.sealed('B'), sealedL: Q.sealed('L') }; });
    if (r.ok) enter('bv_corrosant');
    check('E3a REAL INPUT bv_rest → R → bv_corrosant: the brine crust over B is sealed on entry, Corrosant intro seals L', r.ok && r.to === 'bv_corrosant' && r.bf === 'intro' && r.boss === 'corrosant' && r.sealedB === true && r.sealedL === true, r);
    // E3a2 dying to Corrosant → respawn at node_bv_rest → re-entry: L open, the crust (locked B) still sealed while the boss lives, Corrosant back at 240
    r = await ev((d, g, Q) => {
      while (g.bossFight.state === 'intro') d.step(1);
      const dr = Q.dieAndRespawn(3000);
      const w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900); d.step(2);
      const re = { room: g.level.room.id, bf: g.bossFight.state, L: Q.sealed('L'), B: Q.sealed('B'), hp: g.boss && g.boss.hp, maxHp: g.boss && g.boss.maxHp, phase: g.boss && g.boss.phase, bosses: g.save.bossesDefeated.slice() };
      let k = 0; while (k++ < 60 && g.bossFight.state !== 'intro') d.step(1);
      const intro = { bf: g.bossFight.state, L: Q.sealed('L'), B: Q.sealed('B') };
      while (g.bossFight.state === 'intro') d.step(1);
      return { dr, w: w.ok, re, intro };
    });
    check('E3a2 dying to Corrosant → game over → respawn at node_bv_rest (15,13), hearts full; re-entering: L open on entry, the brine crust B still locked, Corrosant 240/240 phase 1, the intro re-seals L', r.dr.died && r.dr.snap.room === 'bv_rest' && Math.abs(r.dr.snap.x - 465) < 1 && r.dr.snap.y === 420 && r.dr.snap.hp === r.dr.snap.maxHp && !r.dr.inSolid && r.w && r.re.room === 'bv_corrosant' && r.re.bf === 'none' && r.re.L === false && r.re.B === true && r.re.hp === 240 && r.re.maxHp === 240 && !r.re.bosses.includes('corrosant') && r.intro.bf === 'intro' && r.intro.L === true && r.intro.B === true, r);
    r = await ev((d, g, Q) => { d.god(true); const f = Q.bossMacro({ maxFrames: 8000, jumpEvery: 4, reach: 10 }); d.god(false); return f; });
    check('E3b Corrosant dies to the macro', r.fight === 'dying' || r.fight === 'reward', r);
    // E3b2 quit during the reward → CONTINUE → re-entry: the crust is gone (boss recorded), no fight, the GRIP PROTOCOL module waits at (22,20)
    r = await ev((d, g, Q) => {
      let k = 0; while (k++ < 600 && g.bossFight.state !== 'reward') d.step(1);
      const before = { bf: g.bossFight.state, L: Q.sealed('L'), B: Q.sealed('B'), bosses: g.save.bossesDefeated.slice() };
      const qc = Q.quitContinue();
      const w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900); Q.settle(5);
      const re = { room: g.level.room.id, boss: !!g.boss, bf: g.bossFight.state, L: Q.sealed('L'), B: Q.sealed('B'), modules: Q.modules(), ab: Q.abilities() };
      return { before, qc, w: w.ok, re };
    });
    check('E3b2 quitting during the reward → CONTINUE at node_bv_rest → re-entering bv_corrosant: no boss, no fight, L open AND the brine crust B unsealed (boss recorded), the GRIP PROTOCOL module waits at (22,20)', r.before.bf === 'reward' && r.before.bosses.includes('corrosant') && r.qc.snap.room === 'bv_rest' && r.w && r.re.room === 'bv_corrosant' && !r.re.boss && r.re.bf === 'none' && r.re.L === false && r.re.B === false && r.re.modules.length === 1 && r.re.modules[0].ability === 'gripProtocol' && Math.abs(r.re.modules[0].x - 675) < 1 && Math.abs(r.re.modules[0].y - 630) < 1 && !r.re.ab[2], r);
    r = await ev((d, g, Q) => { const a = Q.takeAbility(); a.sealedB = Q.sealed('B'); return a; });
    check('E3c GRIP PROTOCOL ACQUIRED by walking onto the waiting module; the hatch B stays open', r.ok && r.banner.l1 === 'GRIP PROTOCOL ACQUIRED' && r.abilities[2] === true && r.bosses.includes('corrosant') && r.sealedB === false, r);
    r = await ev((d, g, Q) => {
      const w = Q.walk([{ tx: 43, tol: 4, noAutoJump: true }], 900);
      let to = w.to, exit = w.exit;
      if (!to) { const r2 = Q.drive(300, (f, p, g, H) => { if (Math.abs(p.x - 1305) > 4) H.hold(p.x < 1305 ? 'right' : 'left', 1); }, null, { stopOnRoomChange: true }); to = r2.roomChanged && r2.roomChanged.to; exit = r2.roomChanged && r2.roomChanged.exit; }
      return { to: to, exit: exit };
    });
    if (r.to) enter(r.to);
    check('E3d REAL INPUT walking into the open hatch → B → ns_base', r.to === 'ns_base' && r.exit === 'B', r);
    // E4 ns_base
    r = await ev((d, g, Q) => {
      Q.settle(100); d.killEnemies(); Q.bigHp();
      const log = []; let hz = 0;
      const land = Q.drive(60, null, (f, p) => p.onGround ? { y: p.y } : null, {}); log.push(['land', land.result]);
      let w = Q.walk([{ tx: 7, noAutoJump: true }], 300); log.push(['hole', w.ok]); hz += w.hazards;
      const well = Q.drive(900, (f, p, g, H) => { const E = window.UB.Entity; const ty = Math.floor((p.y - 1) / 30) + 1, tx = Math.floor(p.x / 30); if (p.onGround && E.tileAt(g.level, tx, ty) === '-') { H.hold('down', 8); H.hold('jump', 3); } }, (f, p) => (p.onGround && p.y >= 989) ? { floor: true } : null, { stopOnHazard: true }); log.push(['well', well.result]); hz += well.hazards;
      w = Q.walk([{ tx: 12, noAutoJump: true, tol: 4 }], 400); hz += w.hazards;
      const pool = Q.drive(120, (f, p, g, H) => { H.hold('right', 1); if (f === 0) H.hold('jump', 3); if (f === 5) H.hold('dash', 2); }, (f, p) => (p.onGround && p.x >= 18 * 30) ? { crossed: true } : null, { stopOnHazard: true }); log.push(['pool', pool.result]); hz += pool.hazards;
      w = Q.walk([{ tx: 25, noAutoJump: true, tol: 4 }], 400); hz += w.hazards;
      return { log, hazards: hz, land: land.result, well: well.result, pool: pool.result, snap: Q.snap() };
    });
    check('E4a REAL INPUT ns_base: T arrival on the ledge, through the hole, down the well (dropping through 6 grates), hop-dash the static pool, under the shaft, no hazard', r.land && r.land.y === 120 && r.well && r.well.floor && r.pool && r.pool.crossed && r.hazards === 0 && r.snap.x > 740 && r.snap.y === 990, r);
    r = await ev((d, g, Q) => {
      d.grant('gripProtocol', false);
      const start = { room: 'ns_base', x: 25 * 30 + 15, y: 33 * 30 };
      const stop = (f, p, g) => (p.onGround && p.y <= 601) ? { up: true, x: p.x, y: p.y } : (p.x < 18 * 30 ? { abort: true } : null);   // abort if the random walker leaves the tunnel for the well
      const sw = Q.sweep(start, 0, stop, { frames: 150, runups: [0], ejs: [undefined, 10, 20, 24, 28, 34], das: [undefined, 10, 24, 30] });
      const ra = Q.randomAttempts(start, 6, 600, stop, {});
      d.grant('gripProtocol', true);
      return { blocked: !sw.success && !ra.success, tried: sw.tried + ra.tried, minY: Math.min(sw.minY, ra.minY), ab: Q.abilities() };
    });
    check('E4b GATE 3 BLOCKED: without Grip Protocol ' + r.tried + ' attempts (jump/Echo Jump/dash sweep + random) never leave the 10-tile shaft (best feet y ' + r.minY + ' > 600)', r.blocked && r.minY > 601 && r.ab[2], r);
    r = await ev((d, g, Q) => {
      d.warp('ns_base', { x: 25 * 30 + 15, y: 33 * 30 }); Q.settle(3); d.killEnemies(); Q.bigHp();
      const c = Q.wallClimb(600, (f, p, g) => (p.onGround && p.y <= 601) ? { top: true, x: +p.x.toFixed(0) } : null, 8);
      const w = Q.walk([{ tx: 29, ty: 19, jumpAt: 23, jumpDir: 1, tol: 40, noAutoJump: true, stuck: 120 }, { tx: 33, exit: true, noAutoJump: true }], 900);
      return { climb: c.result, frames: c.frames, ok: w.ok, to: w.to, exit: w.exit, reason: w.reason, hazards: c.hazards + w.hazards };
    });
    if (r.to) enter(r.to);
    check('E4c GATE 3 PASSES: REAL INPUT alternating wall jumps up the shaft (' + r.frames + ' f) → block top → R → ns_climb', r.climb && r.climb.top && r.ok && r.to === 'ns_climb' && r.exit === 'R' && r.hazards === 0, r);
  });

  // ===================== F. tier 3 =====================
  await section('F', async () => {
    // F0 ns_climb L → T with REAL INPUTS (the DESIGN §10.3 #16 left face): floor → grate row 66 → crumble row 62 → grate row 58 → lift L1 → ledge row 38 →
    // crumbles rows 34/30 → (or, skipping the slot x1-6 doorway) the spine's left face x22 climbed by repeated cling + wall jump + Echo Jump →
    // the spine top row 10 → grates rows 6/5/3 → T → ns_rest
    let r = await ev((d, g, Q) => {
      Q.settle(100); d.killEnemies(); Q.bigHp();
      const log = []; let hz = 0;
      let w = Q.walk([{ tx: 6, ty: 65, jumpAt: 3, jumpDir: 1, jumpTol: 40, ej: true, ejVy: -100, tol: 40, noAutoJump: true, stuck: 200 }], 600); log.push(['grate row 66', w.ok]); hz += w.hazards;
      w = Q.walk([{ tx: 13, ty: 61, jumpAt: 8, jumpDir: 1, jumpTol: 30, ej: true, ejVy: -100, tol: 30, noAutoJump: true, stuck: 200 }], 600); log.push(['crumble row 62', w.ok]); hz += w.hazards;
      w = Q.walk([{ tx: 5, ty: 57, jumpAt: 12, jumpDir: -1, jumpTol: 40, ej: true, ejVy: -100, tol: 40, noAutoJump: true, stuck: 200 }, { tx: 5, tol: 8, noAutoJump: true, stuck: 120 }], 600); log.push(['grate row 58', w.ok, Q.snap().y]); hz += w.hazards;
      const L1 = () => g.level.platforms.find(m => m.id === 'L1');
      let k = 0; while (k++ < 2000 && !(L1().dist <= 0.01 && L1().waitT > 24)) d.step(1);
      let r1 = Q.drive(150, (f, p, g, H) => { H.hold('right', 1); if (f === 2) H.tap('jump', 10); }, (f, p) => p.ground ? { onL1: true } : null, { stopOnHazard: true }); log.push(['lift L1 at its bottom', r1.result]); hz += r1.hazards;
      const onL1 = !!(r1.result && r1.result.onL1);
      if (!onL1) { Q.waitNormal(100); k = 0; while (k++ < 2000 && !(L1().dist <= 0.01 && L1().waitT > 24)) d.step(1); d.teleport(10 * 30 + 15, L1().y); d.step(1); }
      k = 0; while (k++ < 2000 && !(L1().y <= 1201)) d.step(1);
      r1 = Q.drive(120, (f, p, g, H) => { H.hold('left', 1); if (f === 0) H.tap('jump', 12); }, (f, p) => (p.onGround && !p.ground && p.y <= 1141 && p.x < 9 * 30) ? { ledge38: true } : null, { stopOnHazard: true }); log.push(['ledge row 38', r1.result]); hz += r1.hazards;
      if (!(r1.result && r1.result.ledge38)) { Q.waitNormal(100); d.teleport(5 * 30 + 15, 38 * 30); d.step(2); }
      w = Q.walk([{ tx: 13, ty: 33, jumpAt: 7, jumpDir: 1, jumpTol: 30, ej: true, ejVy: -100, tol: 30, noAutoJump: true, stuck: 200 }], 600); log.push(['crumble row 34', w.ok]); hz += w.hazards;
      w = Q.walk([{ tx: 18, ty: 29, jumpAt: 13, jumpDir: 1, jumpTol: 30, ej: true, ejVy: -100, tol: 30, noAutoJump: true, stuck: 200 }], 600); log.push(['crumble row 30', w.ok]); hz += w.hazards;
      const stopTop = (f, p, g) => (p.y <= 300 && p.x >= 21 * 30 && p.x < 26 * 30 && !p.onGround && p.vy >= 0) ? { aboveTop: true, y: +p.y.toFixed(0) } : null;
      let c = Q.singleWall(1, 1500, stopTop, { dash: false }); let climbMode = 'jump+EJ';
      if (!(c.result && c.result.aboveTop)) { Q.waitNormal(100); d.teleport(18 * 30 + 15, 30 * 30); d.step(2); c = Q.singleWall(1, 2400, stopTop, { dash: true, noDashAbove: 420 }); climbMode = 'jump+EJ+dash'; }
      log.push(['spine single-wall climb ' + climbMode, c.result, c.frames, c.minY]); hz += c.hazards;
      const climbed = !!(c.result && c.result.aboveTop);
      r1 = Q.drive(90, (f, p, g, H) => { H.hold('right', 1); }, (f, p) => (p.onGround && p.y <= 301) ? { top: true, x: +p.x.toFixed(0), y: p.y } : null, { stopOnHazard: true }); log.push(['spine top', r1.result]);
      if (!(r1.result && r1.result.top)) { Q.waitNormal(100); d.teleport(23 * 30 + 15, 10 * 30); d.step(2); }
      r1 = Q.drive(100, (f, p, g, H) => { if (f === 0) H.tap('jump', 20); if (f === 20) H.tap('jump', 18); }, (f, p) => (p.onGround && p.y <= 181) ? { g6: true } : null, { stopOnHazard: true }); log.push(['grate row 6', r1.result]);
      if (!(r1.result && r1.result.g6)) { Q.waitNormal(100); d.teleport(24 * 30 + 15, 6 * 30); d.step(2); }
      w = Q.walk([{ tx: 27, tol: 3, noAutoJump: true }, { tx: 32, ty: 4, jumpAt: 27, jumpDir: 1, jumpTol: 10, jHold: 20, ej: true, ejVy: -100, tol: 40, noAutoJump: true, stuck: 200 }, { tx: 35, tol: 3, noAutoJump: true }, { tx: 41, ty: 2, jumpAt: 35, jumpDir: 1, jumpTol: 10, jHold: 20, ej: true, ejVy: -100, tol: 40, noAutoJump: true, stuck: 200 }], 900); log.push(['crown grates rows 5/3', w.ok, w.reason]); hz += w.hazards;
      const crown = w.ok;
      if (!crown) { Q.waitNormal(100); d.teleport(41 * 30 + 15, 3 * 30); d.step(2); }
      const up = Q.drive(120, (f, p, g, H) => { if (Math.abs(p.x - 41 * 30 - 15) > 4) H.hold(p.x < 41 * 30 + 15 ? 'right' : 'left', 1); if (f === 10) H.tap('jump', 24); if (f === 32) H.tap('jump', 20); }, null, { stopOnRoomChange: true }); log.push(['T', up.roomChanged]);
      return { log, hz, onL1, climbed, climbMode, climbFrames: c.frames, crown, to: up.roomChanged && up.roomChanged.to, exit: up.roomChanged && up.roomChanged.exit };
    });
    if (r.to) enter(r.to);
    check('F0 REAL INPUT ns_climb L → T (Tessik): grates/crumbles of the left face → lift L1 → ledge row 38 → crumbles rows 34/30 → the spine face x22 climbed by ' + r.climbMode + ' (' + r.climbFrames + ' f) → spine top → crown grates → T → ns_rest; no hazard', r.onL1 && r.climbed && r.crown && r.to === 'ns_rest' && r.exit === 'T' && r.hz === 0, r);
    await shot('qa-prog-ns_climb.png', 5);
    // F0b/F0c the DESIGN §6.18 / §10.3 #16 / §10.4 geometry the route text relies on (world.js ns_climb tilemap)
    r = await ev((d, g, Q) => {
      const W = window.UB.World, room = W.rooms.ns_climb, at = (x, y) => W.tileAt(room, x, y);
      const slotOpen = []; for (let x = 1; x <= 6; x++) { if (at(x, 17) !== '#') slotOpen.push('(' + x + ',17)'); if (at(x, 27) !== '#') slotOpen.push('(' + x + ',27)'); }
      for (let y = 18; y <= 26; y++) if (at(7, y) !== '#') slotOpen.push('(7,' + y + ')');
      const wallRows = []; for (let y = 61; y <= 69; y++) if (at(26, y) === '#' && at(27, y) === '#') wallRows.push(y);
      return { slotOpen, wallRows, row17: room.tiles[17].slice(0, 10), row27: room.tiles[27].slice(0, 10), row65: room.tiles[65].slice(20, 36) };
    });
    check('F0b DESIGN §10.3 #16 / §10.4: the ns_climb wall-jump slot x1-6 rows 18-26 ("ledge row 27 → wall-jump the slot → ledge row 16") has an entrance or an exit (some tile of row 17 x1-6, row 27 x1-6 or x7 rows 18-26 is not solid)', r.slotOpen.length > 0, r);
    check('F0c DESIGN §10.3 #16: shaft 1 (x28-31, rows 52-69) is reachable from the floor the L exit stands on (x26-27 are not solid for the whole of rows 61-69)', r.wallRows.length < 9, r);
    // F0d/F0e the routes the QA-2 doorways open (DESIGN §10.6 F8): the slot x1-6 climbed from the ledge row 27 by alternating
    // wall jumps (+ an Echo Jump per hop: the slot is 6 wide) out through the hole x4-6 in rows 16-17; the shaft-3 floor
    // (row 17, x44-46) reached from the grate row 21 by an Echo Jump through the hole x42-43 in the block
    r = await ev((d, g, Q) => {
      Q.setAbilities(true, true, true); Q.waitNormal(200);
      // start against the x0 face (the x7 face only begins above the doorway, rows 18-23): the first hop clings low on x0,
      // under the ledge x1-3, every later hop kicks across with an Echo Jump
      d.warp('ns_climb', Q.tile(1, 26)); Q.settle(3); d.killEnemies(); Q.bigHp();
      let dir = -1, last = -99, ejAt = -1;
      const slot = Q.drive(900, function (f, p, g, H) {
        H.hold(dir > 0 ? 'right' : 'left', 1);
        if (f === 0) H.tap('jump', 14);
        if (p.clinging && f - last > 4) { H.tap('jump', 20); last = f; dir = -dir; ejAt = f + 22; }
        if (f === ejAt) H.tap('jump', 14);
      }, (f, p) => (p.onGround && p.y <= 480) ? { out: true, x: +p.x.toFixed(0), y: p.y } : null, { stopOnHazard: true });
      d.warp('ns_climb', Q.tile(43, 20)); Q.settle(3); d.killEnemies(); Q.bigHp();
      const hole = Q.drive(240, function (f, p, g, H) { if (f === 0) H.tap('jump', 12); if (f === 16) H.tap('jump', 14); if (f >= 22) H.hold('right', 1); },
        (f, p) => (p.onGround && p.y <= 511) ? { up: true, x: +p.x.toFixed(0), y: p.y } : null, { stopOnHazard: true });
      d.warp('ns_rest', 'B');
      return { slot: slot.result, slotFrames: slot.frames, slotHz: slot.hazards, hole: hole.result, holeFrames: hole.frames, holeHz: hole.hazards };
    });
    check('F0d ns_climb slot x1-6: from the ledge row 27 (in through the x7-8 doorway) alternating wall jumps + Echo Jumps climb out through the hole x4-6 in rows 16-17 (footing at y ≤ 480, no hazard)', !!r.slot && r.slot.out && r.slotHz === 0, r);
    check('F0e ns_climb shaft-3 floor (row 17, x44-46): reached from the grate row 21 by an Echo Jump through the hole x42-43 (lands at y 510, x ≥ 1320)', !!r.hole && r.hole.up && r.hole.y === 510 && r.hole.x >= 44 * 30 && r.holeHz === 0, r);
    r = await ev((d, g, Q) => { Q.settle(3); const land = Q.drive(90, null, (f, p) => p.onGround ? { y: p.y, x: +p.x.toFixed(0) } : null, {}); Q.settle(100); Q.restoreHp(); const rest = Q.restAtNode(15); return { land: land.result, rest }; });
    enter('ns_rest');
    check('F1a ns_rest chute arrival (from ns_climb.T) auto-launches onto the row-15 hatch grate (floor level); rest at node_ns_rest saves', r.land && r.land.y === 450 && r.rest.near === 'node_ns_rest' && r.rest.savedRoom === 'ns_rest', r);
    r = await reloadContinue();
    check('F1b page reload → CONTINUE (zone 4) → ns_rest at the node tile (15,14), grounded, not in a wall, hearts full, all three abilities kept', r.title.savedRoom === 'ns_rest' && r.snap.room === 'ns_rest' && Math.abs(r.snap.x - 465) < 1 && r.snap.y === 450 && r.snap.g && !r.inSolid && r.snap.hp === r.snap.maxHp && r.ab[0] && r.ab[1] && r.ab[2], r);
    r = await ev((d, g, Q) => { Q.settle(100); const w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900); return { ok: w.ok, to: w.to, exit: w.exit }; });
    if (r.to) enter(r.to);
    check('F1c REAL INPUT ns_rest → R → ns_plunge', r.ok && r.to === 'ns_plunge' && r.exit === 'R', r);
    // F1d ns_plunge L → B with REAL INPUTS: the pure descent down the x16-17 line (row-9 and row-45 grates, every pool and spike row passed beside) into the hatch
    r = await ev((d, g, Q) => {
      Q.settle(100); d.killEnemies(); Q.bigHp();
      const land = Q.drive(60, null, (f, p) => p.onGround ? { y: p.y } : null, {});
      const dsc = Q.drive(1800, (f, p, g, H) => {
        const E = window.UB.Entity; const ty = Math.floor((p.y - 1) / 30) + 1, tx = Math.floor(p.x / 30);
        const goal = p.y >= 1490 ? 15 * 30 + 15 : 16 * 30 + 24;
        if (p.onGround && p.y < 1490 && E.tileAt(g.level, tx, ty) === '-' && (f % 10) === 0) { H.hold('down', 8); H.tap('jump', 3); }
        if (p.x < goal - 4) H.hold('right', 1); else if (p.x > goal + 4) H.hold('left', 1);
      }, null, { stopOnHazard: true, stopOnRoomChange: true });
      return { land: land.result, hazards: dsc.hazards, to: dsc.roomChanged && dsc.roomChanged.to, exit: dsc.roomChanged && dsc.roomChanged.exit, landed: dsc.landed.length, snap: dsc.snap };
    });
    if (r.to) enter(r.to);
    check('F1d REAL INPUT ns_plunge: L arrival on the ledge → the descent (grates rows 9/45 dropped through, pools and spike rows passed) → the hatch → B → rw_gate; no hazard', r.land && r.land.y === 150 && r.to === 'rw_gate' && r.exit === 'B' && r.hazards === 0, r);
    r = await ev((d, g, Q) => { Q.settle(3); const land = Q.drive(120, null, (f, p) => p.onGround ? { y: p.y } : null, {}); Q.settle(100); d.god(true); const w = Q.walk([{ tx: 49, exit: true, autoPit: true, ej: true, lipDrop: true }], 3000); d.god(false); return { land: land.result, ok: w.ok, to: w.to, exit: w.exit, reason: w.reason }; });
    if (r.to) enter(r.to);
    check('F2 rw_gate T arrival lands on the row-4 grate (clear of the ceiling lip); REAL INPUT gauntlet (platewalkers, rootram, twin valves, broodcell, rootbound, rootwisp) → R → rw_rest', r.land && r.land.y === 120 && r.ok && r.to === 'rw_rest' && r.exit === 'R', r);
    r = await ev((d, g, Q) => { Q.settle(100); Q.restoreHp(); const rest = Q.restAtNode(9); const w = Q.walk([{ tx: 21, tol: 4, noAutoJump: true }], 900); d.step(2); const s = d.state(); return { rest, walked: w.ok, nearVendor: s.nearVendor, prompt: s.prompt }; });
    check('F3a rw_rest: rest at node_rw_rest (9,14) saves; walking to Scrivvet (21,14) shows ▲ TRADE', r.rest.near === 'node_rw_rest' && r.rest.savedRoom === 'rw_rest' && r.walked && r.nearVendor && r.prompt === 'TRADE', r);
    r = await reloadContinue();
    check('F3b page reload → CONTINUE (zone 5) → rw_rest at the node tile (9,14), grounded, not in a wall, hearts full', r.title.savedRoom === 'rw_rest' && r.snap.room === 'rw_rest' && Math.abs(r.snap.x - 285) < 1 && r.snap.y === 450 && r.snap.g && !r.inSolid && r.snap.hp === r.snap.maxHp, r);
    r = await ev((d, g, Q) => { Q.settle(100); const w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900); let k = 0; while (k++ < 40 && g.bossFight.state !== 'intro') d.step(1); return { ok: w.ok, to: w.to, bf: g.bossFight.state, boss: g.boss && g.boss.id, phase: g.boss && g.boss.phase }; });
    if (r.to) enter(r.to);
    check('F4a REAL INPUT rw_rest → R → rw_throne: Kernauth intro (phase 1)', r.ok && r.to === 'rw_throne' && r.bf === 'intro' && r.boss === 'kernauth' && r.phase === 1, r);
    // F4a2 dying in phase 2 → respawn at node_rw_rest → re-entry: a fresh phase-1 fight (200/200), L open, the throne prop back, no victory recorded
    r = await ev((d, g, Q) => {
      while (g.bossFight.state === 'intro') d.step(1);
      d.god(true); let f = 0; while (f < 6000 && g.boss && g.boss.phase < 2) { const m = Q.bossMacro({ maxFrames: 60, jumpEvery: 5 }); f += m.frames; if (!g.boss || m.fight !== 'fight') break; }
      const p2 = { phase: g.boss && g.boss.phase, hp: g.boss && g.boss.hp, maxHp: g.boss && g.boss.maxHp, hidden: !!(g.level.hiddenProps && Object.keys(g.level.hiddenProps).length), bf: g.bossFight.state };
      d.step(200);
      const dr = Q.dieAndRespawn(4000);
      const w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900); d.step(2);
      const re = { room: g.level.room.id, bf: g.bossFight.state, L: Q.sealed('L'), phase: g.boss && g.boss.phase, hp: g.boss && g.boss.hp, maxHp: g.boss && g.boss.maxHp, hidden: !!(g.level.hiddenProps && Object.keys(g.level.hiddenProps).length), song: g.curSong, bosses: g.save.bossesDefeated.slice(), victory: g.save.victory };
      let k = 0; while (k++ < 60 && g.bossFight.state !== 'intro') d.step(1);
      return { p2, dr, w: w.ok, re, intro: g.bossFight.state };
    });
    check('F4a2 Kernauth reaches phase 2 (240/240, the throne hidden); dying there → game over → respawn at node_rw_rest; re-entering: phase 1 at 200/200, L open, the throne visible again, zone music, no victory recorded, the intro restarts', r.p2.phase === 2 && r.p2.hp === 240 && r.p2.maxHp === 240 && r.p2.hidden && r.dr.died && r.dr.snap.room === 'rw_rest' && Math.abs(r.dr.snap.x - 285) < 1 && r.dr.snap.hp === r.dr.snap.maxHp && r.w && r.re.room === 'rw_throne' && r.re.bf === 'none' && r.re.L === false && r.re.phase === 1 && r.re.hp === 200 && r.re.maxHp === 200 && !r.re.hidden && r.re.song === 'rootwell' && !r.re.bosses.includes('kernauth') && !r.re.victory && r.intro === 'intro', r);
    r = await ev((d, g, Q) => { while (g.bossFight.state === 'intro') d.step(1); d.god(true); const f = Q.bossMacro({ maxFrames: 10000, jumpEvery: 5 }); d.god(false); let k = 0; while (k++ < 800 && !(g.screen === 'victory' && !g.busy)) d.step(1); return { f, screen: g.screen, stats: g.victoryStats(), victory: g.save.victory, rooms: g.save.visited.length }; });
    check('F4b Kernauth phase 1 → 2 → dies; victory screen with stats, 4/4 bosses, save.victory', r.f.phases.includes('1') && r.f.phases.includes('2') && r.screen === 'victory' && r.stats.bosses === '4/4' && r.victory === true, r);
    await shot('qa-prog-victory.png', 240);
  });

  // ===================== G. the three cores exactly as §10.4 =====================
  await section('G', async () => {
    // back into play from the victory screen (continue from the last node), then work the core routes
    let r = await ev((d, g, Q) => { if (g.screen === 'victory') { g.toTitle(); d.step(3); d.continueGame(); let k = 0; while (k++ < 300 && !(g.screen === 'play' && !g.busy)) d.step(1); Q.settle(5); } return Q.snap(); });
    check('G0 CONTINUE after the victory still works (rw_rest node)', r.room === 'rw_rest' && r.g, r);
    await ensurePlay(true);
    // core 1: the slab is blocked without Echo Jump
    r = await ev((d, g, Q) => {
      Q.setAbilities(false, false, false);
      const start = { room: 'dc_cross', x: 50 * 30 + 15, y: 15 * 30 };
      const stop = (f, p, g) => (p.onGround && p.y <= 271 && p.x >= 53 * 30) ? { onSlab: true } : null;
      const sw = Q.sweep(start, 1, stop, { frames: 120, runups: [0, 10, 20, 40], jHolds: [20, 10], ejs: [undefined], das: [undefined] });
      const ra = Q.randomAttempts(start, 6, 600, stop, { dirBias: 1 });
      Q.setAbilities(true, false, false);
      return { blocked: !sw.success && !ra.success, tried: sw.tried + ra.tried, minY: Math.min(sw.minY, ra.minY) };
    });
    check('G1a core 1 gate BLOCKED: without Echo Jump ' + r.tried + ' attempts never stand on the hanging slab (best feet y ' + r.minY + ' > 270)', r.blocked && r.minY > 271, r);
    r = await ev((d, g, Q) => {
      d.warp('dc_cross', 'L'); Q.settle(3); d.killEnemies(); Q.bigHp();
      const w = Q.walk([
        { tx: 50, autoPit: true, dropLimit: 4, tol: 8 },
        { tx: 56, ty: 8, jumpAt: 50, jumpDir: 1, ej: true, ejVy: -200, tol: 40, noAutoJump: true, stuck: 200 },
        { tx: 57, ty: 5, jumpAt: 56, jHold: 22, tol: 40, noAutoJump: true, stuck: 200 },
        { tx: 57, ty: 1, jumpAt: 57, ej: true, ejVy: -100, tol: 40, noAutoJump: true, stuck: 200 },
        { tx: 57, ty: -2, jumpAt: 57, exit: true, air: true, tol: 40, noAutoJump: true, stuck: 200 },
      ], 3000);
      const arrive = Q.snap();
      let land = null, w2 = null, core = null, hp0 = null;
      if (g.level.room.id === 'dc_loft') {
        d.killEnemies(); Q.settle(3); Q.restoreHp(); hp0 = g.player.maxHp;
        // the chute (x5-7) opens nine tiles left of the spike bed: holding RIGHT through the launch (the natural input,
        // the core is to the right) lands on the floor x8-17; from x12 jump + Echo Jump onto the first crumble plank
        // (x19-20, row 11), then hop plank to plank
        land = Q.drive(150, (f, p, g, H) => { H.hold('right', 1); }, (f, p) => p.onGround ? { x: +p.x.toFixed(0), y: p.y } : null, {});
        w2 = Q.walk([
          { tx: 12, noAutoJump: true, tol: 4 },
          { tx: 19, ty: 10, jumpAt: 12, jumpDir: 1, jumpTol: 10, ej: true, ejVy: -60, tol: 30, noAutoJump: true, stuck: 100 },
          { tx: 23, ty: 10, jumpAt: 20, jumpDir: 1, tol: 30, noAutoJump: true, stuck: 100 },
          { tx: 27, ty: 12, jumpAt: 24, jumpDir: 1, tol: 30, noAutoJump: true, stuck: 100 },
        ], 1500);
        d.step(5);
        core = { cores: g.save.cores.slice(), maxHp: g.player.maxHp, hp0: hp0, banner: window.UB.UI.banner1, hazards: w2.hazards, saved: g.savedData && g.savedData.cores.slice() };
      }
      return { w: { ok: w.ok, reason: w.reason, to: w.to, exit: w.exit, i: w.i, log: w.log }, arrive, land: land && land.result, w2: w2 && { ok: w2.ok, reason: w2.reason, i: w2.i, log: w2.log }, core };
    });
    if (r.w.to) enter(r.w.to);
    check('G1b core 1 ROUTE (Echo Jump): REAL INPUT dc_cross floor → slab → grate row 6 → grate row 2 → T → dc_loft (chute launch) → crumble planks over the spike bed → pedestal: CORE FOUND, +1 max heart, saved', r.w.to === 'dc_loft' && r.core && r.core.cores.includes('core_dc_loft') && r.core.maxHp === r.core.hp0 + 1 && r.core.banner === 'CORE FOUND' && r.core.hazards === 0 && r.core.saved && r.core.saved.includes('core_dc_loft'), r);
    await shot('qa-prog-core1.png');
    // core 2 (Burst Line): the crawlspace route
    r = await ev((d, g, Q) => {
      Q.setAbilities(true, true, false);
      d.warp('lw_belts', { x: 71 * 30 + 15, y: 15 * 30 }); Q.settle(3); d.killEnemies(); Q.bigHp(); Q.restoreHp(); const hp0 = g.player.maxHp;
      const w = Q.walk([
        { tx: 74, ty: 9, jumpAt: 71, jumpDir: 1, ej: true, ejVy: -200, tol: 40, noAutoJump: true, stuck: 150 },   // grate row 10 (x73-76): 5 tiles up → Echo Jump
        { tx: 75, ty: 6, jumpAt: 74, jHold: 22, tol: 40, noAutoJump: true, stuck: 150 },                          // grate row 7 (x74-77)
        { tx: 82, ty: 6, noAutoJump: true, tol: 6 },                                                              // crawlspace floor x78-83
      ], 2000);
      const gap = Q.drive(120, (f, p, g, H) => { H.hold('right', 1); if (f === 0) H.hold('jump', 4); if (f === 6) H.hold('dash', 2); }, (f, p) => (p.onGround && p.x >= 90 * 30 && p.y <= 211) ? { onLedge: true, x: +p.x.toFixed(0) } : null, { stopOnHazard: true });
      const w2 = Q.walk([{ tx: 93, ty: 6, noAutoJump: true, tol: 6 }], 600); d.step(5);
      return { w: { ok: w.ok, reason: w.reason, log: w.log }, gap: gap.result, w2: w2.ok, cores: g.save.cores.slice(), maxHp: g.player.maxHp, hp0, banner: window.UB.UI.banner1 };
    });
    check('G2 core 2 ROUTE (Burst Line): REAL INPUT lw_belts floor → grate row 10 (Echo Jump) → grate row 7 → crawlspace → dash the 6-tile gap → ledge x90-94: CORE FOUND, +1 max heart', r.w.ok && r.gap && r.gap.onLedge && r.w2 && r.cores.includes('core_lw_belts') && r.maxHp === r.hp0 + 1 && r.banner === 'CORE FOUND', r);
    // core 3 (Grip Protocol): blocked without, honest with
    r = await ev((d, g, Q) => {
      Q.setAbilities(true, true, false);
      const stopP = (f, p, g) => (p.onGround && p.y <= 151) ? { inPocket: true } : null;
      const startC = { room: 'dc_fall', x: 28 * 30 + 15, y: 14 * 30 };
      const sw = Q.sweep(startC, 0, stopP, { frames: 150, ejs: [undefined, 10, 20, 24, 28, 34], das: [undefined, 10, 24, 30] });
      const ra = Q.randomAttempts(startC, 6, 600, stopP, {});
      const stopB = (f, p, g) => (p.onGround && p.y <= 421 && p.x >= 19 * 30 && p.x <= 30 * 30) ? { onLedgeB: true } : null;
      const startA = { room: 'dc_fall', x: 14 * 30 + 15, y: 24 * 30 };
      const swB = Q.sweep(startA, 1, stopB, { frames: 200, ejs: [undefined, 10, 20, 30], das: [undefined, 10, 20, 30] });
      const raB = Q.randomAttempts(startA, 6, 600, stopB, { dirBias: 1 });
      return { shaftBlocked: !sw.success && !ra.success, shaftTried: sw.tried + ra.tried, shaftMinY: Math.min(sw.minY, ra.minY), ledgeBlocked: !swB.success && !raB.success, ledgeTried: swB.tried + raB.tried, ledgeMinY: Math.min(swB.minY, raB.minY) };
    });
    check('G3a core 3 gate BLOCKED: with Echo Jump + Burst Line nothing lands in the pocket above the 9-tile shaft (' + r.shaftTried + ' attempts) nor on ledge B from the row-24 grate (' + r.ledgeTried + ' attempts)', r.shaftBlocked && r.ledgeBlocked, r);
    r = await ev((d, g, Q) => {
      Q.setAbilities(true, true, true);
      d.warp('dc_fall', { x: 14 * 30 + 15, y: 24 * 30 }); Q.settle(3); d.killEnemies(); Q.bigHp(); Q.restoreHp(); const hp0 = g.player.maxHp;
      // the ledge-B cling: run right, jump, Echo Jump into the x19 face, cling, kick, Echo Jump at the kick's apex, drift back right onto the top
      let kicked = -1, ej2 = false;
      const up = Q.drive(300, (f, p, g, H) => {
        if (f === 0) H.hold('jump', 20);
        if (f === 20) H.hold('jump', 20);
        if (p.clinging && kicked < 0) { H.hold('jump', 6); kicked = f; }
        if (kicked >= 0 && !ej2 && f > kicked + 2 && p.vy > -40 && p.airJumps > 0) { H.hold('jump', 20); ej2 = true; }
        if (kicked < 0 || f > kicked + 1) H.hold('right', 1);
      }, (f, p) => (p.onGround && p.y <= 421 && p.x >= 19 * 30 && p.x <= 30 * 30) ? { onLedgeB: true, x: +p.x.toFixed(0) } : null, { stopOnHazard: true });
      const w = Q.walk([{ tx: 28, ty: 13, noAutoJump: true, tol: 6 }], 600);
      const climb = Q.wallClimb(600, (f, p, g) => (p.onGround && p.y <= 151) ? { inPocket: true, x: +p.x.toFixed(0) } : null, 6);
      const w2 = Q.walk([{ tx: 24, ty: 4, noAutoJump: true, tol: 6, stuck: 150 }], 600); d.step(5);
      return { up: up.result, w: w.ok, climb: climb.result, climbFrames: climb.frames, w2: w2.ok, cores: g.save.cores.slice(), maxHp: g.player.maxHp, hp0, banner: window.UB.UI.banner1, hazards: up.hazards + w.hazards + climb.hazards + w2.hazards };
    });
    check('G3b core 3 ROUTE (Grip Protocol): REAL INPUT grate row 24 → cling ledge B\'s left face, kick + Echo Jump onto its top → the shaft x27-29 by alternating wall jumps (9 tiles, ' + r.climbFrames + ' f) → the pocket: CORE FOUND, +1 max heart', r.up && r.up.onLedgeB && r.w && r.climb && r.climb.inPocket && r.w2 && r.cores.includes('core_dc_fall') && r.maxHp === r.hp0 + 1 && r.banner === 'CORE FOUND' && r.hazards === 0, r);
    await shot('qa-prog-core3.png');
    const s = await state();
    check('G4 all three cores collected: max hearts 5 + 3 = 8, cores saved', s.cores.length === 3 && s.maxHp === 8, { cores: s.cores, maxHp: s.maxHp });
  });

  // ===================== H. softlock hunt =====================
  await section('H', async () => {
    await ensurePlay(true);
    // H1 hazard respawn after a chute (bottom-exit) arrival must keep the player in the room (DESIGN §3.3: "respawn at the last entry spawn")
    for (const [room, exit, dirKey, hz, prev] of [['dc_loft', 'B', 'left', [20, 14], 'dc_cross'], ['ns_plunge', 'B', 'left', [21, 48], 'rw_gate'], ['bv_catwalk', 'B', 'right', [10, 32], 'bv_cistern']]) {
      const r = await ev((d, g, Q, room, exit, dirKey, hz) => {
        Q.setAbilities(true, true, true); Q.waitNormal(200);
        d.warp(room, exit); Q.settle(3); d.killEnemies(); Q.bigHp();
        // steer out of the chute onto the nearest floor (a real player holds a direction during the launch)
        const land = Q.drive(150, (f, p, g, H) => { if (room === 'bv_catwalk') { if (p.x < 880) H.hold('right', 1); } else H.hold(dirKey, 1); }, (f, p) => p.onGround ? { x: +p.x.toFixed(0), y: p.y } : null, { stopOnRoomChange: true });
        if (!land.result || land.result.room) return { room, land: land.result, roomChanged: land.roomChanged };
        const entrySpawn = Object.assign({}, g.hazardRespawn);
        const sp = Q.tile(hz[0], hz[1]); d.teleport(sp.x, sp.y);
        let k = 0; while (k++ < 20 && g.mode !== 'hazard') d.step(1);
        const hit = g.mode === 'hazard';
        for (let f = 0; f < 150 && g.level.room.id === room; f++) d.step(1);
        return { room, land: land.result, hit, entrySpawn, after: Q.snap(), stayed: g.level.room.id === room };
      }, room, exit, dirKey, hz);
      check('H1 ' + room + ' entered through its chute (' + exit + '): a hazard hit respawns INSIDE the room (not dropped back out into ' + prev + ')', r.hit && r.stayed, r);
    }
    // H2 lw_hoist dry patches beside the static pools (tier 1): escapable without touching the pool?
    for (const fid of ['tessik']) {
      await fresh(fid);
      const r = await ev((d, g, Q, fid) => {
        Q.setAbilities(true, false, false);
        const out = {};
        // bottom-LEFT: no dry patch any more (x1-12 of row 33 are pool): walking off the x0-6 ledge leftward ends in the pool
        // and respawns at the entry (-1 heart, never a trap)
        { const start = { room: 'lw_hoist', x: 3 * 30 + 15, y: 19 * 30 }; Q.begin(start);
          const r = Q.drive(240, (f, p, g, H) => { H.hold('left', 1); }, (f, p, g) => (p.onGround && p.y >= 989) ? { dry: true, x: p.x } : null, { stopOnHazard: true });
          out.left = { pool: !!(r.result && r.result.hazard), dry: !!(r.result && r.result.dry), tiles: g.level.room.tiles[33].slice(0, 14), back: Q.snap() }; }
        for (const sx of [29]) {
          const dir = sx < 15 ? 1 : -1;
          const start = { room: 'lw_hoist', x: sx * 30 + 15, y: 33 * 30 };
          const stop = (f, p, g) => (p.onGround && (p.ground || p.y <= 900)) ? { escaped: true, x: +p.x.toFixed(0), y: p.y, mover: !!p.ground } : null;
          let got = null, tries = 0, hazards = 0, minY = 1e9;
          outer: for (const ru of [0, 6, 12, 20, 30]) for (const h of [20, 10]) for (const ej of [8, 12, 16, 20, 24, 28, 32, 38, 44]) {
            Q.begin(start); tries++;
            if (sx > 15) { const h2 = g.level.platforms.find(m => m.id === 'H2'); let k = 0; while (k++ < 1200 && !(Math.abs(h2.y - 840) < 1 && h2.waitT > 36)) d.step(1); }
            const r = Q.drive(ru + 130, (f, p, g, H) => { H.hold(dir > 0 ? 'right' : 'left', 1); if (f === ru) H.hold('jump', h); if (f === ru + ej) H.hold('jump', 20); }, stop, { stopOnHazard: true });
            if (r.minY < minY) minY = r.minY;
            if (r.result && r.result.hazard) hazards++;
            else if (r.result && r.result.escaped) { got = { ru, h, ej, result: r.result }; break outer; }
          }
          out['x' + sx] = { tries, hazards, got, minY };
        }
        return out;
      }, fid);
      check('H2 lw_hoist bottom-LEFT (' + fid + '): no dry pocket beside the static pool — dropping off the x0-6 ledge leftward is a pool hit that respawns inside the room (x1-12 of row 33 are pool)', r.left.pool && !r.left.dry && r.left.tiles === '#~~~~~~~~~~~~#' && r.left.back.room === 'lw_hoist', r.left);
      check('H2 lw_hoist bottom-RIGHT dry patch x27-30 (' + fid + ', Echo Jump): escapable onto hoist H2 at its lowest point', !!r.x29.got, r.x29);
    }
    // H3 bv_catwalk: the large-bit pocket x1-7 left of the acid trough (tier 2)
    await fresh('tessik');
    let r = await ev((d, g, Q) => {
      Q.setAbilities(true, true, false);
      const start = { room: 'bv_catwalk', x: 3 * 30 + 15, y: 33 * 30 };
      const stop = (f, p, g) => (p.onGround && p.x >= 17 * 30) ? { escaped: true, x: +p.x.toFixed(0), y: p.y } : null;
      let successes = 0, tries = 0, hazards = 0, first = null;
      for (const ru of [0, 20, 40]) for (const a of [6, 12, 18, 24, 30, 36]) for (const b of [4, 10, 16, 22, 28, 34, 40, 46, 52, 60]) {
        Q.begin(start); tries++;
        const r = Q.drive(ru + 160, (f, p, g, H) => { H.hold('right', 1); if (f === ru) H.hold('jump', 20); if (f === ru + a) H.hold('jump', 20); if (f === ru + b) H.hold('dash', 2); }, stop, { stopOnHazard: true });
        if (r.result && r.result.hazard) hazards++;
        else if (r.result && r.result.escaped) { successes++; if (!first) first = { ru, a, b, snap: r.snap }; }
      }
      // how easily the pocket is entered: from the row-17 grate, jump left + dash
      const stopIn = (f, p, g) => (p.onGround && p.x <= 7 * 30 + 15 && p.y >= 989) ? { inPocket: true } : null;
      const into = Q.sweep({ room: 'bv_catwalk', x: 19 * 30 + 15, y: 17 * 30 }, -1, stopIn, { frames: 200, runups: [0, 10], ejs: [undefined, 10, 20, 30], das: [undefined, 6, 14, 22, 30] });
      return { tries, hazards, successes, first, enteredIn: into.success ? into.tried : null };
    });
    check('H3 bv_catwalk large-bit pocket x1-7 (Echo Jump + Burst Line): entered with a plain jump-dash (' + r.enteredIn + ' tries); escapable by a plausible, non-frame-perfect sequence (≥ 3 of ' + r.tries + ' jump/Echo Jump/dash combos succeed, got ' + r.successes + ')', r.enteredIn !== null && r.successes >= 3, r);
    // H4 lw_shaft left floor (behind the 7-wide spike bed) is left on hoist S1 with an Echo Jump
    r = await ev((d, g, Q) => {
      Q.setAbilities(true, false, false);
      const start = { room: 'lw_shaft', x: 9 * 30 + 15, y: 34 * 30 };
      const stop = (f, p, g) => (p.onGround && p.ground) ? { onS1: true, y: p.y } : null;
      let got = null, tries = 0;
      for (const ej of [16, 20, 24]) { Q.begin(start); tries++; const s1 = g.level.platforms.find(m => m.id === 'S1'); let k = 0; while (k++ < 1400 && !(Math.abs(s1.y - 900) < 1 && s1.waitT > 20)) d.step(1); d.teleport(start.x, start.y); d.step(2); const r = Q.drive(120, (f, p, g, H) => { if (f === 0) H.hold('jump', 20); if (f === ej) H.hold('jump', 20); }, stop, { stopOnHazard: true }); if (r.result && r.result.onS1) { got = { ej, y: r.result.y }; break; } }
      return { got, tries };
    });
    check('H4 lw_shaft left floor x1-11: hoist S1 at its lowest point is reached with jump + Echo Jump (no trap behind the spike bed)', !!r.got, r);
    // H6 dc_fall bottom-left floor x1-11 (left of the 5-wide spike bed, the row-46 grate 4 tiles up is out of a tier-0 jump): every fighter pogos across the spikes (DESIGN §10.3 "pogo-able")
    const perFighter = {};
    for (const fid of ['tessik', 'brackmaw', 'vellix', 'orrubel', 'korvask']) {
      await fresh(fid);
      perFighter[fid] = await ev((d, g, Q) => {
        Q.setAbilities(false, false, false);
        const start = { room: 'dc_fall', x: 10 * 30 + 15, y: 50 * 30 };
        const stop = (f, p, g) => (p.onGround && p.x >= 17 * 30 && p.y >= 1490) ? { escaped: true, x: +p.x.toFixed(0) } : null;
        let got = null, tries = 0, hz = 0;
        outer: for (const j of [0, 6, 12]) for (const ds of [8, 12, 16, 20, 26]) for (const again of [0, 1]) {
          Q.begin(start); tries++; let pressed = 0;
          const r = Q.drive(200, (f, p, g, H) => { H.hold('right', 1); if (f === j) H.tap('jump', 14); if (f === j + ds) { H.hold('down', 10); H.tap('light', 2); H.hold('down', 10); pressed++; } if (again && pressed === 1 && f > j + ds + 10 && !p.onGround && p.vy > 0) { H.hold('down', 10); H.tap('light', 2); H.hold('down', 10); pressed++; } }, stop, { stopOnHazard: true });
          if (r.result && r.result.hazard) hz++; else if (r.result && r.result.escaped) { got = { j, ds, again, f: r.frames }; break outer; }
        }
        return { tries, hz, got };
      });
    }
    check('H6 dc_fall bottom-left floor (tier 0): every fighter crosses the 5-wide spike bed with a down-strike pogo (jump, Down+light over the spikes)', Object.values(perFighter).every(x => !!x.got), perFighter);
    // H7 bv_sluice is two-way at tier 2 (DESIGN §10.4): lower hall → the raised pipe → grate row 6 → west → crawlspace → dash the gap west → shelf → T
    await fresh('tessik');
    r = await ev((d, g, Q) => {
      Q.setAbilities(true, true, false);
      d.warp('bv_sluice', 'R'); Q.settle(3); d.killEnemies(); Q.bigHp();
      const w = Q.walk([
        { tx: 55, noAutoJump: true, tol: 6 },
        { tx: 50, ty: 10, jumpAt: 54, jumpDir: -1, ej: true, ejVy: -200, tol: 40, noAutoJump: true, stuck: 150 },  // onto the pipe x48-52 (standing row 10); jump from x54 so the head clears its underside
        { tx: 52, ty: 5, jumpAt: 50, jumpDir: 1, ej: true, ejVy: -200, tol: 40, noAutoJump: true, stuck: 150 },    // grate row 6 (x50-56)
        { tx: 50, ty: 5, noAutoJump: true, tol: 6 },
        { tx: 42, ty: 7, jumpAt: 50, jumpDir: -1, dashVy: 0, tol: 60, noAutoJump: true, stuck: 150 },  // west over x45-49 onto the x34-44 floor (standing row 7): the row-2 ceiling caps the hop at 42 px, so hop + dash
        { tx: 34, ty: 7, noAutoJump: true, tol: 4 },
      ], 2500);
      // the 3-wide drop shaft x31-33 under the crawlspace's 60 px ceiling: a ground dash west from the floor's edge onto x21-30
      const shaft = Q.drive(120, (f, p, g, H) => { H.hold('left', 1); if (f === 2) H.tap('dash', 2); }, (f, p) => (p.onGround && p.x <= 30 * 30 + 15 && p.y <= 241) ? { across: true, x: +p.x.toFixed(0) } : null, { stopOnHazard: true });
      const w2 = Q.walk([{ tx: 22, noAutoJump: true, tol: 5 }], 600);
      const gap = Q.drive(120, (f, p, g, H) => { H.hold('left', 1); if (f === 0) H.hold('jump', 4); if (f === 6) H.hold('dash', 2); }, (f, p) => (p.onGround && p.x <= 14 * 30 + 15 && p.y <= 241) ? { crossed: true, x: +p.x.toFixed(0) } : null, { stopOnHazard: true });
      const w3 = Q.walk([{ tx: 3, noAutoJump: true, tol: 6 }, { tx: 3, ty: 3, jumpAt: 3, jumpTol: 20, jHold: 24, ej: true, ejVy: -300, tol: 40, noAutoJump: true, stuck: 150 }], 900);
      const up = Q.drive(120, (f, p, g, H) => { if (f === 0) H.hold('jump', 24); if (f === 22) H.hold('jump', 20); }, null, { stopOnRoomChange: true });
      return { w: { ok: w.ok, reason: w.reason, i: w.i, log: w.log }, shaft: shaft.result, w2: w2.ok, gap: gap.result, w3: { ok: w3.ok, reason: w3.reason, log: w3.log }, to: up.roomChanged && up.roomChanged.to, exit: up.roomChanged && up.roomChanged.exit, hazards: w.hazards + shaft.hazards + w2.hazards + gap.hazards + w3.hazards + up.hazards };
    });
    check('H7 bv_sluice is two-way with Echo Jump + Burst Line (§10.4): REAL INPUT lower hall → pipe → grate row 6 → crawlspace → dash west → shelf → T → lw_weftyr', r.w.ok && r.shaft && r.shaft.across && r.gap && r.gap.crossed && r.to === 'lw_weftyr' && r.hazards === 0, r);
    // H8 chute launch vs. the variable-jump cut: jump out of dc_cross.T holding the jump key, release it 5 f after the launch starts
    r = await ev((d, g, Q) => {
      Q.setAbilities(true, false, false);
      const out = {};
      for (const mode of ['release5', 'hold']) {
        Q.kflush(true); window.UB.Input.releaseAll(); Q.waitNormal(200);
        d.warp('dc_cross', { x: 57 * 30 + 15, y: 2 * 30 }); Q.settle(3); d.killEnemies(); Q.bigHp();
        const p = g.player; let launched = -1, minY = 1e9, cutAvailOnArrival = null;
        Q.kdown('jump', 200);
        for (let f = 0; f < 140; f++) {
          Q.stepK();
          if (g.level.room.id === 'dc_loft') {
            if (cutAvailOnArrival === null) cutAvailOnArrival = !!p.jumpCutAvail;
            if (!p.locked && launched < 0) launched = f;
            if (mode === 'release5' && launched >= 0 && f === launched + 5) Q.kflush(true);
            if (launched >= 0 && p.y < minY) minY = p.y;
            if (f > launched + 40 && launched >= 0) break;
          }
        }
        Q.kflush(true);
        out[mode] = { launched, rise: launched >= 0 ? 540 - minY : null, cutAvailOnArrival };
      }
      return out;
    });
    check('H8 a jump key released 5 f into a chute launch (dc_cross.T → dc_loft) does not cut the launch: the rise stays ≥ 90 px (the chute depth); held it is ' + (r.hold && r.hold.rise) + ' px, released ' + (r.release5 && r.release5.rise) + ' px', r.hold && r.release5 && r.hold.rise >= 150 && r.release5.rise >= 90, r);
    // H9 the same hatch geometry in ns_rest: walking left from the node at floor level
    r = await ev((d, g, Q) => {
      Q.waitNormal(200); d.warp('ns_rest', { x: 15 * 30 + 15, y: 15 * 30 }); Q.settle(3); Q.bigHp();
      const walk = Q.drive(240, (f, p, g, H) => { H.hold('left', 1); }, (f, p) => (p.x <= 45) ? { reachedWall: true } : null, { stopOnRoomChange: true });
      return { result: walk.result, roomChanged: walk.roomChanged };
    });
    check('H9 ns_rest: walking left from the node at floor level does not fall through the row-14 hatch grate into ns_climb', r.result && r.result.reachedWall && !r.roomChanged, r);
    // H10 (informational) bv_cistern lower half: can the right bank get back up to the arrival ledge / T without Grip Protocol?
    r = await ev((d, g, Q) => {
      Q.setAbilities(true, true, false);
      const start = { room: 'bv_cistern', x: 45 * 30 + 15, y: 33 * 30 };
      const stop = (f, p, g) => (p.onGround && p.y <= 481) ? { up: true, x: +p.x.toFixed(0), y: p.y } : null;
      const ra = Q.randomAttempts(start, 10, 900, stop, { dirBias: -1 });
      const ra2 = Q.randomAttempts(start, 6, 900, stop, { dirBias: 1 });
      Q.setAbilities(true, true, true);
      return { noGP: { tried: ra.tried + ra2.tried, success: ra.success && ra.success.result, minY: Math.min(ra.minY, ra2.minY) } };
    });
    console.log('  (info, not a check) bv_cistern lower half → arrival ledge / upper gallery without Grip Protocol: ' + JSON.stringify(r.noGP) + ' (the lake floor is one-way until the right wall can be climbed; R → bv_rest is always open)');
  });

  // ===================== H2. softlock hunt, round 2 =====================
  await section('H2', async () => {
    await fresh('tessik');
    // H10 every mover ridden for two full cycles with no input: never crushed (no hazard), never inside a tile, never dropped out of the room
    let r = await ev((d, g, Q) => {
      Q.setAbilities(true, true, true); Q.waitNormal(200);
      const out = {}, bad = [];
      for (const [room, id] of [['lw_hoist', 'H1'], ['lw_hoist', 'H2'], ['lw_belts', 'M1'], ['lw_belts', 'M2'], ['lw_shaft', 'S1'], ['ns_climb', 'L1']]) {
        Q.waitNormal(200); d.warp(room, null); Q.settle(3); d.killEnemies(); Q.bigHp();
        const m = g.level.platforms.find(p => p.id === id);
        d.teleport(m.x + m.w / 2, m.y); d.step(1);
        const cycle = Math.ceil(2 * (m.len / m.speed + m.wait)) + 60;
        let onMover = 0, hazards = 0, solid = 0, fell = false;
        for (let f = 0; f < cycle; f++) {
          d.step(1);
          if (g.mode === 'hazard') { hazards++; break; }
          if (g.player.ground === m) onMover++;
          if (Q.inSolid()) solid++;
          if (g.level.room.id !== room) { fell = true; break; }
        }
        out[room + '.' + id] = { frames: cycle, onMover, hazards, solid, fell, end: Q.snap() };
        if (hazards || solid || fell) bad.push(room + '.' + id);
      }
      return { out, bad };
    });
    check('H10 all 6 movers (H1 H2 M1 M2 S1 L1) ridden for two full cycles with no input: no crush/hazard, never inside a tile, never dropped out of the room (S1 may hand the rider to the row-16 grate it passes)', r.bad.length === 0, r);
    // H11 bv_cistern entered from above (bv_catwalk.B → T, the loop B direction) at tier 2 (no Grip Protocol): the row-3 grate is walled in at rows 1-2
    // (the player can only stand at x50-52), a plain Down+Jump + left drop misses the row-8 grate by a few px and lands on the right bank (the lower
    // half, one-way until Grip Protocol); Down+Jump + left + an Echo Jump (or a dash) reaches the gallery (the row-8 grate or the slab row 12)
    r = await ev((d, g, Q) => {
      Q.setAbilities(true, true, false);
      const arrive = () => { Q.waitNormal(200); d.warp('bv_cistern', 'T'); Q.settle(3); d.killEnemies(); Q.bigHp(); Q.drive(60, null, (f, p) => p.onGround ? 1 : null, {}); };
      arrive();
      const land = Q.snap();
      const wl = Q.drive(120, (f, p, g, H) => { H.hold('left', 1); }, (f, p) => (p.x <= 48 * 30 + 15) ? { walkedPast: true } : null, {});
      const wall = { result: wl.result, x: +g.player.x.toFixed(0) };
      Q.walk([{ tx: 50, tol: 3, noAutoJump: true, stuck: 120 }], 300);
      const plain = Q.dropThrough(-1, 400, null);
      arrive(); Q.walk([{ tx: 50, tol: 3, noAutoJump: true, stuck: 120 }], 300);
      const ej = Q.drive(300, (f, p, g, H) => { if (f === 0) { H.hold('down', 8); H.tap('jump', 3); } else if (f > 4) { H.hold('left', 1); if (f === 14 && !p.onGround && p.airJumps > 0) H.tap('jump', 12); } }, (f, p) => (f > 6 && p.onGround) ? { landed: true, x: +p.x.toFixed(0), y: p.y } : null, { stopOnHazard: true, stopOnRoomChange: true });
      Q.setAbilities(true, true, true);
      return { land, wall, plain: plain.result, ej: ej.result };
    });
    console.log('  (info, not a check) bv_cistern.T arrival at tier 2, a plain Down+Jump + left drop lands at ' + JSON.stringify(r.plain) + ' (the right bank = the one-way lower half; the gallery needs the Echo Jump / dash during the drop)');
    check('H11 bv_cistern.T arrival (from bv_catwalk, tier 2): lands on the row-3 grate (y 90) boxed in by the rows-1-2 ceiling (cannot walk left of x50); Down+Jump + left + Echo Jump lands in the gallery (the row-8 grate y 240 or the slab y 360)', r.land.y === 90 && r.wall.result === null && r.ej && r.ej.landed && (r.ej.y === 240 || r.ej.y === 360), r);
    // H12 ns_climb shaft 1 (x28-31, rows 52-69) opens onto the L floor through its doorway (x26-27, rows 67-69; DESIGN §10.6 F8)
    // and is also leavable upward by alternating wall jumps
    r = await ev((d, g, Q) => {
      Q.waitNormal(200); d.warp('ns_climb', { x: 29 * 30 + 15, y: 70 * 30 }); Q.settle(3); d.killEnemies(); Q.bigHp();
      const toFloor = Q.sweep({ room: 'ns_climb', x: 29 * 30 + 15, y: 70 * 30 }, -1, (f, p) => (p.onGround && p.x < 26 * 30) ? { floor: true } : null, { frames: 120, runups: [0], jHolds: [20], ejs: [undefined, 20], das: [undefined, 10, 30] });
      Q.waitNormal(200); d.warp('ns_climb', { x: 29 * 30 + 15, y: 70 * 30 }); Q.settle(3); d.killEnemies(); Q.bigHp();
      const c = Q.wallClimb(1500, (f, p, g) => (p.onGround && p.y <= 1561) ? { out: true, x: +p.x.toFixed(0), y: p.y } : null, 8);
      return { toFloorDirect: !!toFloor.success, climb: c.result, frames: c.frames, hazards: c.hazards };
    });
    check('H12 ns_climb shaft 1 (x28-31, bottom row 69): walkable to the L floor through the x26-27 doorway (rows 67-69), and alternating wall jumps (Grip Protocol) climb the 18 tiles out onto the x26-27 step (row 51) / the slab', r.toFloorDirect && r.climb && r.climb.out && r.hazards === 0, r);
    // H13 ns_plunge bottom-right pocket x29-30 (row 49, beside the 9-wide pool x20-28 on the floor): leavable without a pool hit (jump + Echo Jump + dash west)
    r = await ev((d, g, Q) => {
      const start = { room: 'ns_plunge', x: 29 * 30 + 15, y: 50 * 30 };
      const stop = (f, p) => (p.onGround && p.x < 20 * 30 && p.y >= 1499) ? { out: true, x: +p.x.toFixed(0) } : null;
      const sw = Q.sweep(start, -1, stop, { frames: 150, runups: [0, 4], jHolds: [20, 24], ejs: [14, 18, 22, 26], das: [undefined, 20, 30, 40, 50] });
      return { got: !!sw.success, tried: sw.tried, hazards: sw.hazards, success: sw.success && { ej: sw.success.ej, da: sw.success.da } };
    });
    check('H13 ns_plunge floor pocket x29-30 beside the 9-wide pool: left again over the pool with jump + Echo Jump + dash (no trap)', r.got, r);
    // H15 (info) dc_loft chute arrival with RIGHT held during the launch: where does it land? (DESIGN §10.4 "the chute auto-launch lands you on the floor")
    r = await ev((d, g, Q) => {
      Q.setAbilities(true, true, true);
      const out = {};
      for (const hold of ['right', 'left']) {
        Q.waitNormal(200); d.warp('dc_loft', 'B'); Q.settle(3); d.killEnemies(); Q.bigHp();
        const land = Q.drive(200, (f, p, g, H) => { H.hold(hold, 1); }, (f, p) => p.onGround ? { x: +p.x.toFixed(0), tx: Math.floor(p.x / 30), y: p.y } : null, { stopOnHazard: true, stopOnRoomChange: true });
        const o = { result: land.result };
        if (land.result && land.result.hazard) { Q.waitNormal(200); d.step(1); o.respawn = Q.snap(); const l2 = Q.drive(200, (f, p, g, H) => { H.hold('left', 1); }, (f, p) => p.onGround ? { x: +p.x.toFixed(0), y: p.y } : null, { stopOnHazard: true, stopOnRoomChange: true }); o.relaunchLand = l2.result; }
        out[hold] = o;
      }
      return out;
    });
    console.log('  (info, not a check) dc_loft chute arrival holding RIGHT: ' + JSON.stringify(r.right) + ' · holding LEFT: ' + JSON.stringify(r.left));
    check('H15 dc_loft chute arrival: a spike hit while the chute respawn is still pending relaunches the player from the chute (vy < 0) and a held LEFT lands on the floor x≤13 (never stuck in the spike bed)', !r.right.result || !r.right.result.hazard || (r.right.respawn && r.right.respawn.vy < 0 && r.right.relaunchLand && r.right.relaunchLand.y === 450 && r.right.relaunchLand.x < 14 * 30), r);
  });

  // ===================== N. ns_climb RIGHT face (DESIGN §10.3 #16, §6.18) =====================
  await section('N', async () => {
    await fresh('tessik');
    // N1 the geometry the route text relies on: "shaft 1 (x28–31, rows 52–69) → slab row 51 → shaft 2 (x36–39, rows 39–50)". Shaft 1's top
    // opens onto the step x26–27 (row 52) / the slab x32–33 (row 51); shaft 2 stands on the slab behind its left wall x34–35 (rows 39–50).
    // "Every shaft … has a walkable or jumpable way in at its foot": shaft 2 needs a doorway in x34–35 at its foot (rows 49–50).
    let r = await ev((d, g, Q) => {
      const W = window.UB.World, room = W.rooms.ns_climb, at = (x, y) => W.tileAt(room, x, y);
      const footOpen = []; for (let y = 45; y <= 50; y++) if (at(34, y) !== '#' || at(35, y) !== '#') footOpen.push(y);
      const slabTop = []; for (let x = 32; x <= 43; x++) slabTop.push(at(x, 51));
      const shaft2 = []; for (let y = 39; y <= 50; y++) shaft2.push(at(34, y) + at(35, y) + '|' + room.tiles[y].slice(36, 40) + '|' + at(40, y) + at(41, y));
      // walking right along the slab top from x32 (feet y 1530) must reach shaft 2 (x36) if the foot is open
      Q.setAbilities(true, true, true); Q.waitNormal(200);
      Q.begin({ room: 'ns_climb', x: 32 * 30 + 15, y: 51 * 30 });
      const walk = Q.drive(120, (f, p, g, H) => H.hold('right', 1), (f, p) => p.x >= 36 * 30 ? { reached: true } : null, {});
      return { footOpen, slabTop: slabTop.join(''), shaft2, walked: !!(walk.result && walk.result.reached), maxX: walk.maxX, hitWall: g.player.hitWall };
    });
    check('N1 DESIGN §10.3 #16 "shaft 1 → slab row 51 → shaft 2": shaft 2 (x36-39, rows 39-50) has a way in at its foot — some tile of its left wall x34-35 in rows 45-50 is open and the slab top x32-33 (feet y 1530) walks into x36 (got: open rows ' + JSON.stringify(r.footOpen) + ', walked ' + r.walked + ', stopped at x ' + r.maxX + ')', r.footOpen.length > 0 && r.walked, r);
    // N2 shaft 2 entered from above is a 4-wide pit: alternating wall jumps lead back out (no trap)
    r = await ev((d, g, Q) => { Q.begin({ room: 'ns_climb', x: 37 * 30 + 15, y: 51 * 30 }); const c = Q.wallClimb(900, (f, p) => (p.onGround && p.y <= 37 * 30 + 1) ? { out: true, x: +p.x.toFixed(0) } : null, 16); return { ok: !!(c.result && c.result.out), frames: c.frames, hazards: c.hazards }; });
    check('N2 shaft 2 dropped into from the ledge row 37 (a 12-tile pit on the slab) is left again by alternating wall jumps (Grip Protocol), no hazard', r.ok && r.hazards === 0, r);
    // N3 the only way up the right face today: the 8-wide column x26-33 (rows 39-50) between the spine face x25 and the shaft-2 wall x34, per fighter and technique
    const col = {};
    for (const fid of ['tessik', 'brackmaw', 'vellix', 'orrubel', 'korvask']) {
      await fresh(fid);
      col[fid] = await ev((d, g, Q) => {
        Q.setAbilities(true, true, true); Q.waitNormal(200);
        const stopUp = (f, p) => ((p.onGround && p.y <= 37 * 30 + 1) || p.y <= 1000) ? { up: true, x: +p.x.toFixed(0), y: +p.y.toFixed(0) } : null;
        const start = { room: 'ns_climb', x: 27 * 30, y: 52 * 30 };   // the 2-wide step x26-27 at shaft 1's top
        const out = {};
        for (const tech of ['wall', 'wallEJ', 'wallEJdash', 'wallDashEJ']) {
          let best = null;
          for (const first of [-1, 1]) { Q.begin(start); const c = Q.techClimb(tech, first, 1200, stopUp); if (c.result && c.result.up && (!best || c.frames < best)) best = c.frames; }
          out[tech] = best;
        }
        Q.begin(start); let c = Q.singleWall(-1, 1500, stopUp, { dash: false }); out.singleX25 = (c.result && c.result.up) ? c.frames : null;
        Q.begin(start); c = Q.singleWall(-1, 1500, stopUp, { dash: true }); out.singleX25dash = (c.result && c.result.up) ? c.frames : null;
        return out;
      });
    }
    const colLine = Object.keys(col).map(k => k + ' ' + Object.keys(col[k]).map(t => t + ':' + (col[k][t] === null ? 'x' : col[k][t] + 'f')).join(' ')).join(' · ');
    check('N3a the column x26-33 is NOT climbable by plain alternating wall jumps for any fighter (8 tiles apart): ' + colLine, Object.values(col).every(c => c.wall === null), col);
    check('N3b every fighter climbs the column with wall jump + dash + Echo Jump hops (Grip Protocol + Burst Line + Echo Jump) or single-face cling → kick → Echo Jump → dash back on the spine face x25', Object.values(col).every(c => (c.wallEJdash !== null || c.wallDashEJ !== null) && c.singleX25dash !== null), col);
    console.log('  (info, not a check) wall jump + Echo Jump without the dash climbs the column for: ' + Object.keys(col).filter(k => col[k].wallEJ !== null).join(' ') + ' only');
    // N4 the whole right face with REAL inputs (Tessik, all abilities): L → floor → the shaft-1 doorway (x26-27, rows 67-69) → shaft 1 (alternating wall jumps,
    // 18 tiles) → the step x26-27 → the column (wall jump + dash + Echo Jump) → the ledge row 37 → grates rows 33/29, the crumble row 25, the grate row 21 (Echo
    // Jumps) → up through the hole x42-43 (rows 17-18) onto the shaft-3 floor → shaft 3 (wall jumps) → the grate row 3 → T → ns_rest
    await fresh('tessik');
    r = await ev((d, g, Q) => {
      const T = 30; Q.setAbilities(true, true, true); Q.waitNormal(200);
      d.warp('ns_climb', 'L'); Q.settle(3); d.killEnemies(); Q.bigHp();
      const log = []; let hz = 0; const stage = {};
      let w = Q.walk([{ tx: 29, tol: 6, noAutoJump: true }], 900); log.push(['doorway → shaft 1 foot', w.ok]); hz += w.hazards; stage.foot = w.ok;
      let c = Q.wallClimb(1500, (f, p) => (p.onGround && p.y <= 1561 && p.x < 28 * T) ? { step: true, x: +p.x.toFixed(0), y: p.y } : null, 16); log.push(['shaft 1 → the step x26-27', c.result, c.frames]); hz += c.hazards; stage.shaft1 = !!(c.result && c.result.step);
      if (!stage.shaft1) { Q.waitNormal(100); d.teleport(27 * T, 52 * T); d.step(2); }
      const stopUp = (f, p) => ((p.onGround && p.y <= 37 * T + 1) || p.y <= 1000) ? { up: true, x: +p.x.toFixed(0), y: +p.y.toFixed(0) } : null;
      c = Q.techClimb('wallDashEJ', -1, 1200, stopUp); if (!(c.result && c.result.up)) { Q.waitNormal(100); d.teleport(27 * T, 52 * T); d.step(2); c = Q.techClimb('wallEJdash', 1, 1200, stopUp); }
      log.push(['the column x26-33', c.result, c.frames]); hz += c.hazards; stage.column = !!(c.result && c.result.up);
      if (!stage.column) { Q.waitNormal(100); d.teleport(28 * T + 15, 37 * T); d.step(2); }
      // settle onto the ledge row 37 (the block top x30-35, feet y 1110) — the column may have left us airborne over it
      w = Q.walk([{ tx: 33, ty: 36, tol: 20, noAutoJump: true, stuck: 200 }], 600); log.push(['ledge row 37', w.ok, Q.snap().y]); hz += w.hazards; stage.ledge = w.ok;
      if (!stage.ledge) { Q.waitNormal(100); d.teleport(33 * T + 15, 37 * T); d.step(2); }
      w = Q.walk([
        { tx: 38, ty: 32, jumpAt: 33, jumpDir: 1, jumpTol: 14, jHold: 22, ej: true, ejVy: -100, tol: 40, noAutoJump: true, stuck: 200 },
        { tx: 40, tol: 4, noAutoJump: true },
        { tx: 44, ty: 28, jumpAt: 40, jumpDir: 1, jumpTol: 14, jHold: 22, ej: true, ejVy: -100, tol: 40, noAutoJump: true, stuck: 200 },
        { tx: 42, tol: 4, noAutoJump: true },
        { tx: 37, ty: 24, jumpAt: 42, jumpDir: -1, jumpTol: 14, jHold: 22, ej: true, ejVy: -100, tol: 40, noAutoJump: true, stuck: 200 },
        { tx: 38, tol: 4, noAutoJump: true, stuck: 60 },
        { tx: 44, ty: 20, jumpAt: 38, jumpDir: 1, jumpTol: 14, jHold: 22, ej: true, ejVy: -100, tol: 40, noAutoJump: true, stuck: 200 },
      ], 3000); log.push(['grates 33 / 29 / crumble 25 / 21', w.ok, w.reason, w.i]); hz += w.hazards; stage.grates = w.ok;
      if (!stage.grates) { Q.waitNormal(100); d.teleport(43 * T + 15, 21 * T); d.step(2); }
      let hole = null;
      for (const ejAt of [16, 12, 20]) {   // settle on the grate under the hole (x43), jump, Echo Jump, drift right onto the shaft-3 floor
        w = Q.walk([{ tx: 43, tol: 3, noAutoJump: true, stuck: 120 }], 300); Q.drive(12, null, null, {});
        hole = Q.drive(240, (f, p, g, H) => { if (f === 0) H.tap('jump', 12); if (f === ejAt) H.tap('jump', 14); if (f >= ejAt + 6) H.hold('right', 1); }, (f, p) => (p.onGround && p.y <= 511) ? { up: true, x: +p.x.toFixed(0), y: p.y, ejAt } : null, { stopOnHazard: true });
        hz += hole.hazards; if (hole.result && hole.result.up) break;
      }
      log.push(['hole x42-43 → shaft-3 floor', hole.result]); stage.hole = !!(hole.result && hole.result.up);
      if (!stage.hole) { Q.waitNormal(100); d.teleport(45 * T + 15, 17 * T); d.step(2); }
      w = Q.walk([{ tx: 45, tol: 6, noAutoJump: true }], 300);
      c = Q.wallClimb(900, (f, p) => (p.y <= 240 && !p.onGround) ? { top: true, x: +p.x.toFixed(0), y: +p.y.toFixed(0) } : null, 16); log.push(['shaft 3', c.result, c.frames]); hz += c.hazards; stage.shaft3 = !!(c.result && c.result.top);
      // the crown: footing at the x40-41 wall top (row 7, feet y 210) or the grate row 3 (feet y 90) under T
      w = Q.walk([{ tx: 41, ty: 6, ej: true, ejVy: -100, wj: true, tol: 30, noAutoJump: true, stuck: 300 }], 900); log.push(['the crown (wall top / grate row 3)', w.ok, w.reason, Q.snap().y]); hz += w.hazards;
      stage.crown = w.ok || (g.player.onGround && g.player.y <= 211 && Math.abs(g.player.x - 41 * T - 15) <= 45);
      if (!stage.crown) { Q.waitNormal(100); d.teleport(41 * T + 15, 3 * T); d.step(2); }
      const up = Q.drive(120, (f, p, g, H) => { if (Math.abs(p.x - 41 * T - 15) > 4) H.hold(p.x < 41 * T + 15 ? 'right' : 'left', 1); if (f === 10) H.tap('jump', 24); if (f === 32) H.tap('jump', 20); }, null, { stopOnRoomChange: true }); log.push(['T', up.roomChanged]);
      stage.to = up.roomChanged && up.roomChanged.to;
      return { log, hz, stage };
    });
    check('N4 REAL INPUT ns_climb right face (Tessik, all abilities): doorway → shaft 1 (wall jumps) → the step → the column (wall jump + dash + Echo Jump) → ledge row 37 → grates 33/29/25/21 → the hole → shaft 3 → grate row 3 → T → ns_rest; no hazard (stages: ' + JSON.stringify(r.stage) + ')', r.stage.foot && r.stage.shaft1 && r.stage.column && r.stage.ledge && r.stage.grates && r.stage.hole && r.stage.shaft3 && r.stage.crown && r.stage.to === 'ns_rest' && r.hz === 0, r);
  });

  // ===================== P. every fighter through every gate (DESIGN §10.5 "identical for all five fighters") =====================
  await section('P', async () => {
    const per = {};
    for (const fid of ['tessik', 'brackmaw', 'vellix', 'orrubel', 'korvask']) {
      await fresh(fid);
      per[fid] = await ev((d, g, Q) => {
        const T = 30, out = { body: [g.player.w, g.player.h] };
        // debug grants: this section proves the GEOMETRY per fighter; the abilities were earned for real in sections C–E
        Q.setAbilities(true, true, true); ['tallock', 'weftyr', 'corrosant'].forEach(b => d.defeatBoss(b)); Q.waitNormal(200);
        // P1 gate 1: the dc_sentinel block (top row 10, 5 tiles) with a jump + Echo Jump from the floor
        { const sw = Q.sweep({ room: 'dc_sentinel', x: 36 * T + 15, y: 15 * T }, 1, (f, p) => (p.onGround && p.y <= 301 && p.x >= 39 * T) ? { onBlock: true } : null, { frames: 120, runups: [0], jHolds: [20], ejs: [8, 12, 16, 20, 24, 28], das: [undefined] });
          out.gate1 = { ok: !!sw.success, ej: sw.success && sw.success.ej, tried: sw.tried }; }
        // P2 gate 2: the bv_sluice crawlspace gap x15-20 from the standing row 8 — the window of dash-start x that lands on x21+ (ground dash / 3 f hop-dash)
        { const stop = (f, p) => (p.onGround && p.x >= 21 * T && p.y <= 241) ? { crossed: true } : null;
          out.gate2ground = Q.dashWindow({ room: 'bv_sluice', x: 13 * T + 15, y: 8 * T }, 15 * T - 60, 15 * T + 20, false, stop);
          out.gate2hop = Q.dashWindow({ room: 'bv_sluice', x: 13 * T + 15, y: 8 * T }, 15 * T - 60, 15 * T + 20, true, stop); }
        // P3 gate 3: the ns_base shaft x24-27 (rows 20-29) by alternating wall jumps with the jump key held 16 f per kick
        { Q.begin({ room: 'ns_base', x: 25 * T + 15, y: 33 * T }); const c = Q.wallClimb(900, (f, p) => (p.onGround && p.y <= 601) ? { top: true } : null, 16); out.gate3 = { ok: !!(c.result && c.result.top), frames: c.frames }; }
        // P4 the core-2 crawlspace gap (lw_belts x84-89, standing row 7) and the bv_catwalk gap (x15-20, standing row 5): ground-dash windows
        { out.core2gap = Q.dashWindow({ room: 'lw_belts', x: 80 * T + 15, y: 7 * T }, 84 * T - 60, 84 * T + 20, false, (f, p) => (p.onGround && p.x >= 90 * T && p.y <= 211) ? { onLedge: true } : null);
          out.catwalkGap = Q.dashWindow({ room: 'bv_catwalk', x: 11 * T + 15, y: 5 * T }, 15 * T - 60, 15 * T + 20, false, (f, p) => (p.onGround && p.x >= 21 * T && p.y <= 151) ? { crossed: true } : null); }
        // P5 tier 0: dc_cross L → R with REAL inputs — pit 1 via the row-12 grate (x15-17), pit 2 (x40-43) jumped from its edge (x40 + half the body)
        { Q.setAbilities(false, false, false);
          Q.begin({ room: 'dc_cross', x: 2 * T + 15, y: 15 * T });
          let w = Q.walk([
            { tx: 13, tol: 4, noAutoJump: true },
            { tx: 16, ty: 11, jumpAt: 13, jumpDir: 1, jumpTol: 12, jHold: 24, tol: 30, noAutoJump: true, stuck: 150 },
            { tx: 19, ty: 14, noAutoJump: true, tol: 20, stuck: 150 },
            { tx: 36, autoPit: true, dropLimit: 4, tol: 8 },
            { tx: 38, tol: 4, noAutoJump: true },
          ], 2000);
          const toPit1 = w.ok, hz1 = w.hazards;
          // pit 2 from its very edge: the last grounded centre is x40·30 + w/2; jump 6 px before it, RIGHT held (the window measured below starts ≥ 20 px earlier)
          const jx = 40 * T + g.player.w / 2 - 6, st = { done: false };
          const hop = Q.drive(300, (f, p, g, H) => { H.hold('right', 1); if (p.x >= jx && !st.done) { st.done = true; H.tap('jump', 24); } }, (f, p) => (p.onGround && p.x >= 44 * T - p.w / 2 && p.y >= 449) ? { over: true, x: +p.x.toFixed(0) } : null, { stopOnHazard: true });
          w = Q.walk([{ tx: 65, exit: true, noAutoJump: true }], 900);
          out.dcCross = { ok: toPit1 && !!(hop.result && hop.result.over) && w.ok, to: w.to, hazards: hz1 + hop.hazards + w.hazards, pit1: toPit1, pit2: hop.result };
          // pit 2's jump-start window (tier 0): the span of start x (held RIGHT, 24 f jump) that lands on x44+
          let ok = 0, first = null, last = null;
          for (let sx = 40 * T - 60; sx <= 40 * T + 24; sx += 4) {
            Q.begin({ room: 'dc_cross', x: 36 * T + 15, y: 15 * T }); const st = { done: false };
            const r = Q.drive(200, (f, p, g, H) => { H.hold('right', 1); if (p.x >= sx && !st.done) { st.done = true; H.tap('jump', 24); } }, (f, p) => (p.onGround && p.x >= 44 * T - p.w / 2 && p.y >= 449) ? { over: true } : null, { stopOnHazard: true });
            if (r.result && r.result.over) { ok++; if (first === null) first = sx; last = sx; }
          }
          out.pit2 = { ok, first, last, windowPx: first === null ? 0 : last - first + 4 };
          Q.setAbilities(true, true, true); }
        // P6 lw_hoist H1 → H2: from H1 at its bottom, jump + Echo Jump right lands on H2 / the right ledge
        { Q.setAbilities(true, false, false); Q.begin({ room: 'lw_hoist', x: 12 * T + 15, y: 9 * T });
          const H1 = () => g.level.platforms.find(m => m.id === 'H1'), H2 = () => g.level.platforms.find(m => m.id === 'H2');
          d.teleport(12 * T + 15, H1().y); d.step(2);   // ride H1 standing at its right edge; hop when it is near its bottom and H2 passes within ±2 rows
          const st = { hopAt: -1, ej: false };
          const r = Q.drive(4000, (f, p, g, H) => {
            const h1 = H1(), h2 = H2();
            if (st.hopAt < 0) {
              if (p.ground !== h1) return;
              const edge = h1.x + h1.w - p.w / 2 - 2;
              if (p.x < edge - 2) { H.hold('right', 1); return; }
              if (h1.y >= 540 && Math.abs(h2.y - h1.y) <= 60) { st.hopAt = f; H.hold('jump', 20); H.hold('right', 1); }
              return;
            }
            if (!st.ej && f > st.hopAt + 4 && p.vy > -60 && p.airJumps > 0) { H.tap('jump', 20); st.ej = true; }   // Echo Jump at the apex
            if (p.x < h2.x + 8) H.hold('right', 1); else if (p.x > h2.x + h2.w - 8) H.hold('left', 1);                  // steer over H2
          }, (f, p) => (st.hopAt >= 0 && f > st.hopAt + 5 && p.onGround && (p.ground === H2() || p.x >= 18 * T)) ? { across: true, onH2: p.ground === H2(), x: +p.x.toFixed(0), y: p.y } : null, { stopOnHazard: true });
          out.hoist = { ok: !!(r.result && r.result.across), result: r.result, hopAt: st.hopAt, hazards: r.hazards }; Q.setAbilities(true, true, true); }
        return out;
      });
    }
    const F = Object.keys(per);
    const line = (k, f) => F.map(id => id + ' ' + f(per[id][k])).join(' · ');
    check('P1 GATE 1 PASSES for every fighter: jump + Echo Jump onto the dc_sentinel block (' + line('gate1', x => (x.ok ? 'EJ@' + x.ej + 'f' : 'FAIL')) + ')', F.every(id => per[id].gate1.ok), F.map(id => [id, per[id].gate1]));
    check('P2 GATE 2 PASSES for every fighter: the bv_sluice crawlspace gap by a ground dash from the edge (window ≥ 20 px) and by a 3 f hop-dash (window ≥ 40 px): ' + line('gate2ground', x => x.windowPx + 'px') + ' / hop ' + line('gate2hop', x => x.windowPx + 'px'), F.every(id => per[id].gate2ground.windowPx >= 20 && per[id].gate2hop.windowPx >= 40), F.map(id => [id, per[id].gate2ground, per[id].gate2hop]));
    check('P3 GATE 3 PASSES for every fighter: alternating wall jumps (16 f holds) up the ns_base shaft within 900 f (' + line('gate3', x => (x.ok ? x.frames + 'f' : 'FAIL')) + ')', F.every(id => per[id].gate3.ok), F.map(id => [id, per[id].gate3]));
    check('P4 the core-2 and bv_catwalk crawlspace gaps: a ground dash from the edge crosses them for every fighter (windows ≥ 20 px): core 2 ' + line('core2gap', x => x.windowPx + 'px') + ' / catwalk ' + line('catwalkGap', x => x.windowPx + 'px'), F.every(id => per[id].core2gap.windowPx >= 20 && per[id].catwalkGap.windowPx >= 20), F.map(id => [id, per[id].core2gap, per[id].catwalkGap]));
    check('P5 TIER 0 for every fighter: REAL INPUT dc_cross L → R (pit 1 over the row-12 grate, pit 2 from its edge) → dc_shrine with no spike hit; pit 2\'s jump window ≥ 24 px (' + line('pit2', x => x.windowPx + 'px') + ')', F.every(id => per[id].dcCross.ok && per[id].dcCross.to === 'dc_shrine' && per[id].dcCross.hazards === 0 && per[id].pit2.windowPx >= 24), F.map(id => [id, per[id].dcCross, per[id].pit2]));
    check('P6 lw_hoist H1 → H2 for every fighter: a jump + Echo Jump from H1 at its bottom reaches H2 / the right ledge (DESIGN §10.3 #6)', F.every(id => per[id].hoist.ok), F.map(id => [id, per[id].hoist]));
  });

  // ===================== Q. QUIT → CONTINUE in the middle of every non-normal mode =====================
  await section('Q', async () => {
    await fresh('tessik');
    const r = await ev((d, g, Q) => {
      const T = 30, out = {};
      const after = (label) => {   // CONTINUE, then: mode normal, unlocked, no overlay / boss / fade, hearts full, movable
        const qc = Q.quitContinue();
        const x0 = g.player.x; Q.drive(30, (f, p, g, H) => H.hold('right', 1), null, {});
        out[label] = { room: qc.snap.room, x: qc.snap.x, y: qc.snap.y, inSolid: qc.inSolid, mode: g.mode, locked: g.player.locked, overlay: g.overlay, boss: !!g.boss, bf: g.bossFight.state, moved: +(g.player.x - x0).toFixed(1), fade: g.fadeLevel, dead: g.player.dead, hp: g.player.hp, maxHp: g.player.maxHp, busy: g.busy, screen: g.screen };
        return out[label];
      };
      const sane = (o, room, x, y) => o.room === room && Math.abs(o.x - x) < 1 && o.y === y && !o.inSolid && o.mode === 'normal' && !o.locked && o.overlay === null && !o.boss && o.bf === 'none' && o.moved > 40 && o.fade === 0 && !o.dead && o.hp === o.maxHp && !o.busy && o.screen === 'play';
      // the save: node_dc_shrine (9,14)
      Q.waitNormal(200); d.warp('dc_shrine', { x: 9 * T + 15, y: 15 * T }); Q.settle(3); out.rest = Q.restAtNode(9).savedRoom;
      // Q1 pause + QUIT during the hazard freeze (a spike hit in dc_cross)
      d.warp('dc_cross', { x: 10 * T + 15, y: 15 * T }); Q.settle(3); d.killEnemies(); Q.restoreHp();
      d.teleport(16 * T + 15, 16 * T + 20); let k = 0; while (k++ < 30 && g.mode !== 'hazard') d.step(1); d.step(10);
      d.pressed('pause', 2); d.step(3); out.h = { mode: g.mode, overlay: g.overlay, hp: g.player.hp };
      out.hazardOk = sane(after('hazard'), 'dc_shrine', 285, 450);
      // Q2 during the node use (the 30 f pulse)
      d.warp('dc_shrine', { x: 9 * T + 15, y: 15 * T }); Q.settle(3); d.pressed('up', 2); d.step(4); out.n = { mode: g.mode }; d.pressed('pause', 2); d.step(3); out.n.overlay = g.overlay;
      out.nodeOk = sane(after('nodeUse'), 'dc_shrine', 285, 450);
      // Q3 during the boss intro (Tallock's card), then re-entering the arena restarts a fresh intro with the seal
      d.warp('dc_sentinel', 'L'); Q.settle(3); k = 0; while (k++ < 60 && g.bossFight.state !== 'intro') d.step(1); d.step(40);
      out.b = { mode: g.mode, bf: g.bossFight.state, locked: g.player.locked }; d.pressed('pause', 2); d.step(3); out.b.overlay = g.overlay;
      out.bossIntroOk = sane(after('bossIntro'), 'dc_shrine', 285, 450);
      let w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900); k = 0; while (k++ < 60 && g.bossFight.state !== 'intro') d.step(1);
      out.bossReentry = { to: w.to, bf: g.bossFight.state, sealedL: Q.sealed('L'), hp: g.boss && g.boss.hp, locked: g.player.locked };
      // Q4 during the pickup sequence (Tallock beaten by the macro, the module touched, 30 f in): the ability is NOT granted yet; CONTINUE; the module waits
      while (g.bossFight.state === 'intro') d.step(1);
      d.god(true); Q.bossMacro({ maxFrames: 6000, jumpEvery: 5 }); d.god(false);
      k = 0; while (k++ < 900 && g.bossFight.state !== 'reward') d.step(1);
      const abil = g.pickups.find(p => p.type === 'ability'); out.p = { bf: g.bossFight.state, abil: !!abil };
      if (abil) { d.teleport(abil.x, abil.y); k = 0; while (k++ < 60 && g.mode !== 'pickupSeq') d.step(1); d.step(30); out.p.mode = g.mode; out.p.locked = g.player.locked; out.p.ab = Q.abilities().slice(); d.pressed('pause', 2); d.step(3); out.p.overlay = g.overlay; }
      out.pickupOk = sane(after('pickupSeq'), 'dc_shrine', 285, 450);
      out.pickupAfter = { ab: Q.abilities(), bosses: g.save.bossesDefeated.slice() };
      w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900); Q.settle(5);
      out.pickupReentry = { to: w.to, modules: Q.modules(), boss: !!g.boss, bf: g.bossFight.state, sealedL: Q.sealed('L') };
      const take = Q.takeAbility(); out.take = { ok: take.ok, ab: take.abilities, banner: take.banner && take.banner.l1 };
      // Q5 while dying (the 60 f death animation after a 1-heart spike hit)
      Q.waitNormal(200); d.warp('dc_cross', { x: 10 * T + 15, y: 15 * T }); Q.settle(3); d.killEnemies(); d.setHp(1); d.god(false);
      d.teleport(16 * T + 15, 16 * T + 20); k = 0; while (k++ < 60 && !g.player.dead) d.step(1); d.step(10);
      out.d = { dead: g.player.dead, mode: g.mode }; d.pressed('pause', 2); d.step(3); out.d.overlay = g.overlay;
      out.dyingOk = sane(after('dying'), 'dc_shrine', 285, 450);
      // Q6 a pause / map press during a room transition is ignored (the transition completes)
      d.warp('dc_shrine', { x: 29 * T + 15, y: 15 * T }); Q.settle(3);
      Q.drive(120, (f, p, g, H) => H.hold('right', 1), (f, p, g) => g.mode === 'transition' ? 1 : null, { stopOnRoomChange: false });
      d.step(8); d.pressed('pause', 2); d.step(2); out.t = { mode: g.mode, overlay: g.overlay, phase: g.transition.phase }; d.pressed('map', 2); d.step(2); out.t.overlay2 = g.overlay;
      Q.waitNormal(200); out.t.room = g.level.room.id; out.t.modeAfter = g.mode; out.t.overlayAfter = g.overlay;
      return out;
    });
    check('Q1 pause + QUIT during a hazard freeze → CONTINUE at node_dc_shrine: mode normal, unlocked, hearts full, movable, no fade / overlay left over', r.h.mode === 'hazard' && r.h.overlay === 'pause' && r.hazardOk, r);
    check('Q2 pause + QUIT during the node-use pulse → CONTINUE sane', r.n.mode === 'nodeUse' && r.n.overlay === 'pause' && r.nodeOk, r);
    check('Q3 pause + QUIT during Tallock\'s intro → CONTINUE sane (no boss bar, bossFight none); re-entering dc_sentinel restarts a fresh intro with L sealed and Tallock at 120', r.b.mode === 'bossIntro' && r.b.overlay === 'pause' && r.bossIntroOk && r.bossReentry.to === 'dc_sentinel' && r.bossReentry.bf === 'intro' && r.bossReentry.sealedL === true && r.bossReentry.hp === 120, r);
    check('Q4 pause + QUIT 30 f into the ECHO JUMP pickup sequence (ability not yet granted) → CONTINUE sane, Tallock recorded, no ability; re-entering: the module waits at (20,14), no fight, L open; collecting it grants ECHO JUMP', r.p.mode === 'pickupSeq' && r.p.locked === true && r.p.ab[0] === false && r.p.overlay === 'pause' && r.pickupOk && !r.pickupAfter.ab[0] && r.pickupAfter.bosses.includes('tallock') && r.pickupReentry.to === 'dc_sentinel' && r.pickupReentry.modules.length === 1 && r.pickupReentry.modules[0].ability === 'echoJump' && !r.pickupReentry.boss && r.pickupReentry.bf === 'none' && r.pickupReentry.sealedL === false && r.take.ok && r.take.ab[0] === true && r.take.banner === 'ECHO JUMP ACQUIRED', r);
    check('Q5 pause + QUIT during the death animation → CONTINUE sane (alive, hearts full)', r.d.dead && r.d.mode === 'dying' && r.d.overlay === 'pause' && r.dyingOk, r);
    check('Q6 pause / map presses during a room transition are ignored; the transition completes into dc_sentinel in mode normal', r.t.mode === 'transition' && r.t.overlay === null && r.t.overlay2 === null && r.t.room === 'dc_sentinel' && r.t.modeAfter === 'normal' && r.t.overlayAfter === null, r);
  });

  // ===================== R. a boss module left behind (the hatch under the arena opens as soon as the boss is recorded) =====================
  await section('R', async () => {
    await fresh('tessik');
    // R1 Corrosant recorded, GRIP PROTOCOL not collected: the open hatch B drops the player into ns_base (no Grip Protocol); the arrival ledge is a
    // launch pad back up through T (a plain jump); the chute arrival lands on the arena floor and the module is still there
    let r = await ev((d, g, Q) => {
      const T = 30, out = {};
      Q.setAbilities(true, true, false); g.save.bossesDefeated.push('tallock', 'weftyr', 'corrosant'); Q.waitNormal(200);
      d.warp('bv_rest', { x: 15 * T + 15, y: 14 * T }); Q.settle(3); out.rest = Q.restAtNode(15).savedRoom;
      let w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900); Q.settle(5);
      out.arena = { to: w.to, modules: Q.modules(), B: Q.sealed('B'), L: Q.sealed('L'), boss: !!g.boss };
      // skip the module: it sits at (22,20) on the floor — jump over it with a running Echo Jump (real input), then walk into the hatch at x42-44
      Q.bigHp();
      w = Q.walk([{ tx: 16, tol: 4, noAutoJump: true }, { tx: 30, ty: 20, jumpAt: 17, jumpDir: 1, jumpTol: 10, jHold: 24, ej: true, ejVy: -250, tol: 40, noAutoJump: true, stuck: 150 }], 900);
      out.skipped = { ok: w.ok, ab: Q.abilities(), modules: Q.modules().length };
      w = Q.walk([{ tx: 43, tol: 4, noAutoJump: true }], 1200); let r2 = null;
      if (!w.to) r2 = Q.drive(300, (f, p, g, H) => { if (Math.abs(p.x - 1305) > 4) H.hold(p.x < 1305 ? 'right' : 'left', 1); }, null, { stopOnRoomChange: true });
      out.down = { to: w.to || (r2 && r2.roomChanged && r2.roomChanged.to), exit: w.exit || (r2 && r2.roomChanged && r2.roomChanged.exit) };
      Q.settle(3); d.killEnemies(); Q.bigHp();
      const land = Q.drive(90, null, (f, p) => p.onGround ? { x: +p.x.toFixed(0), y: p.y } : null, {}); out.land = land.result;
      const back = Q.drive(200, (f, p, g, H) => { if (Math.abs(p.x - 105) > 4) H.hold(p.x < 105 ? 'right' : 'left', 1); if (f === 20) H.tap('jump', 24); }, null, { stopOnRoomChange: true });
      out.back = back.roomChanged;
      Q.settle(3); Q.bigHp();
      const land2 = Q.drive(200, (f, p, g, H) => { H.hold('left', 1); }, (f, p) => p.onGround ? { x: +p.x.toFixed(0), y: p.y } : null, { stopOnHazard: true, stopOnRoomChange: true }); out.land2 = land2.result;
      out.modulesBack = Q.modules();
      const take = Q.takeAbility(); out.take = { ok: take.ok, ab: take.abilities, banner: take.banner && take.banner.l1 };
      return out;
    });
    check('R1 GRIP PROTOCOL left behind: bv_corrosant re-entered with the crust open (no boss), the module jumped over, the hatch B → ns_base (T arrival on the ledge, no Grip Protocol); a plain jump from the ledge → T → bv_corrosant (chute arrival onto the arena floor, LEFT held); the module still waits and grants GRIP PROTOCOL', r.arena.to === 'bv_corrosant' && r.arena.modules.length === 1 && r.arena.B === false && r.arena.L === false && !r.arena.boss && !r.skipped.ab[2] && r.skipped.modules === 1 && r.down.to === 'ns_base' && r.down.exit === 'B' && r.land && r.land.y === 120 && r.back && r.back.to === 'bv_corrosant' && r.back.exit === 'T' && r.land2 && r.land2.y === 630 && !r.land2.hazard && r.modulesBack.length === 1 && r.take.ok && r.take.ab[2] === true, r);
    // R2 Weftyr recorded, BURST LINE not collected: into the hatch pocket, down B into bv_sluice; gate 2 still blocked; the row-4 grate launches back up
    // into lw_weftyr's pocket; over the 1-wide wall with the Echo Jump; the module waits
    r = await ev((d, g, Q) => {
      const T = 30, out = {};
      Q.setAbilities(true, false, false); Q.waitNormal(200);
      d.warp('lw_rest', { x: 15 * T + 15, y: 15 * T }); Q.settle(3); out.rest = Q.restAtNode(15).savedRoom;
      let w = Q.walk([{ tx: 33, exit: true, noAutoJump: true }], 900); Q.settle(5);
      out.arena = { to: w.to, modules: Q.modules(), B: Q.sealed('B'), L: Q.sealed('L'), boss: !!g.boss };
      Q.bigHp();
      w = Q.walk([{ tx: 14, tol: 4, noAutoJump: true }, { tx: 28, ty: 14, jumpAt: 15, jumpDir: 1, jumpTol: 10, jHold: 24, ej: true, ejVy: -250, tol: 40, noAutoJump: true, stuck: 150 }, { tx: 38, tol: 4, noAutoJump: true },
        { tx: 43, ty: 14, jumpAt: 38, jumpDir: 1, ej: true, ejVy: -150, tol: 40, noAutoJump: true, stuck: 120 }], 1500);
      out.skipped = { ok: w.ok || !!w.to, ab: Q.abilities(), modules: Q.modules().length, to: w.to };
      let to = w.to; if (!to) { const r3 = Q.drive(300, (f, p, g, H) => { if (Math.abs(p.x - 1305) > 4) H.hold(p.x < 1305 ? 'right' : 'left', 1); }, null, { stopOnRoomChange: true }); to = r3.roomChanged && r3.roomChanged.to; }
      out.down = { to };
      Q.settle(3); d.killEnemies(); Q.bigHp();
      const land = Q.drive(90, null, (f, p) => p.onGround ? { x: +p.x.toFixed(0), y: p.y } : null, {}); out.land = land.result;
      // gate 2 is still blocked here (no Burst Line): a quick sweep from the crawlspace ledge
      Q.drive(60, (f, p, g, H) => { if (f === 0) { H.hold('down', 8); H.hold('jump', 3); } }, (f, p) => (p.onGround && p.y >= 239) ? 1 : null, {});
      const sw = Q.sweep({ room: 'bv_sluice', x: 13 * T + 15, y: 8 * T }, 1, (f, p) => (p.onGround && p.x >= 21 * T && p.y <= 241) ? { crossed: true } : null, { frames: 120, runups: [0, 10, 20], jHolds: [2, 4, 20], ejs: [undefined, 4, 8, 12], das: [undefined] });
      out.gate2 = { blocked: !sw.success, tried: sw.tried, hazards: sw.hazards };
      Q.waitNormal(200); d.warp('bv_sluice', 'T'); Q.settle(3); d.killEnemies(); Q.bigHp();
      Q.drive(60, null, (f, p) => p.onGround ? 1 : null, {});
      const up = Q.drive(150, (f, p, g, H) => { if (Math.abs(p.x - 105) > 4) H.hold(p.x < 105 ? 'right' : 'left', 1); if (f === 10) H.tap('jump', 24); if (f === 32) H.tap('jump', 20); }, null, { stopOnRoomChange: true }); out.back = up.roomChanged;
      Q.settle(3); Q.bigHp();
      const pocket = Q.drive(150, (f, p, g, H) => { H.hold('left', 1); }, (f, p) => p.onGround ? { x: +p.x.toFixed(0), y: p.y } : null, {}); out.pocket = pocket.result;
      const over = Q.drive(150, (f, p, g, H) => { H.hold('left', 1); if (f === 0) H.tap('jump', 24); if (f === 22) H.tap('jump', 22); }, (f, p) => (p.onGround && p.x < 40 * T) ? { over: true } : null, { stopOnHazard: true }); out.over = over.result;
      out.modulesBack = Q.modules(); out.bf = g.bossFight.state;
      const take = Q.takeAbility(); out.take = { ok: take.ok, ab: take.abilities, banner: take.banner && take.banner.l1 };
      return out;
    });
    check('R2 BURST LINE left behind: lw_weftyr re-entered (no boss, L + B open), the module jumped over, over the wall into the pocket → B → bv_sluice (T arrival on the grate); gate 2 still BLOCKED (' + r.gate2.tried + ' tries); the shelf launches back up → T → lw_weftyr\'s pocket; Echo Jump over the 1-wide wall; the module waits and grants BURST LINE', r.arena.to === 'lw_weftyr' && r.arena.modules.length === 1 && r.arena.B === false && !r.arena.boss && !r.skipped.ab[1] && r.down.to === 'bv_sluice' && r.land && r.land.y === 120 && r.gate2.blocked && r.back && r.back.to === 'lw_weftyr' && r.back.exit === 'T' && r.pocket && r.pocket.y === 450 && r.pocket.x > 40 * 30 && r.over && r.over.over && r.modulesBack.length === 1 && r.bf === 'none' && r.take.ok && r.take.ab[1] === true, r);
  });

  // ===================== S. every chute / top arrival × held direction × fighter (DESIGN §10.6 F9: a launch must not land on a hazard) =====================
  await section('S', async () => {
    const rows = [];
    for (const fid of ['tessik', 'brackmaw', 'vellix', 'orrubel', 'korvask']) {
      await fresh(fid);
      const r = await ev((d, g, Q) => {
        const W = window.UB.World, out = [];
        Q.setAbilities(true, true, true); ['tallock', 'weftyr', 'corrosant'].forEach(b => d.defeatBoss(b)); Q.waitNormal(200);
        for (const id in W.rooms) { const room = W.rooms[id]; if (room.debug) continue;
          for (const ex of room.exits) { if (ex.side !== 'top' && ex.side !== 'bottom') continue;
            for (const dir of ['none', 'left', 'right']) for (const ej of [false, true]) {
              if (ex.side === 'top' && ej) continue;
              const a = Q.arrival(id, ex.id, dir, ej);
              out.push({ exit: id + '.' + ex.id, side: ex.side, dir, ej, kind: a.kind, at: a.kind === 'land' ? a.tx + ',' + a.ty : (a.kind === 'out' ? a.to : (a.hazard ? a.hazard.kind + '@' + a.hazard.tx + ',' + a.hazard.ty : '')) });
            }
          }
        }
        return out;
      });
      for (const x of r) rows.push(Object.assign({ fid }, x));
    }
    const hazNoEJ = rows.filter(x => x.kind === 'HAZARD' && !x.ej), hazEJ = rows.filter(x => x.kind === 'HAZARD' && x.ej);
    const fmt = (l) => l.map(x => x.fid + ' ' + x.exit + ' ' + x.dir + (x.ej ? '+EJ' : '') + ' → ' + x.at).join(' | ');
    check('S1 no chute / top arrival with a single direction held through the launch (no Echo Jump) ends in a hazard for any fighter (' + rows.filter(x => !x.ej).length + ' arrivals; hazards: ' + (hazNoEJ.length ? fmt(hazNoEJ) : 'none') + ')', hazNoEJ.length === 0, hazNoEJ);
    console.log('  (info, not a check) with an Echo Jump at the apex and the direction still held, these launches end in a hazard: ' + (hazEJ.length ? fmt(hazEJ) : 'none'));
    const outRows = rows.filter(x => x.kind === 'out' && x.dir !== 'none');
    console.log('  (info, not a check) launches that fall back out of the room with a direction held: ' + (outRows.length ? fmt(outRows) : 'none'));
  });

  // ===================== I. every exit arrival =====================
  await section('I', async () => {
    await ensurePlay(true);
    const r = await ev((d, g, Q) => {
      Q.setAbilities(true, true, true); ['tallock', 'weftyr', 'corrosant'].forEach(b => d.defeatBoss(b)); Q.bigHp();
      const W = window.UB.World, bad = []; let n = 0;
      for (const id in W.rooms) {
        const room = W.rooms[id]; if (room.debug) continue;
        for (const ex of room.exits) {
          Q.waitNormal(200); d.warp(id, ex.id); d.step(1); Q.clearOverlay(); d.killEnemies(); d.setHp(99); n++;
          const inSolid = Q.inSolid();
          const r = Q.drive(180, null, (f, p, g) => p.onGround ? { landed: true } : null, { stopOnHazard: true, stopOnRoomChange: true });
          const landed = !!(r.result && r.result.landed), hazard = !!(r.result && r.result.hazard), chute = ex.side === 'bottom';
          if (inSolid || hazard || !(landed || (chute && r.roomChanged))) bad.push({ exit: id + '.' + ex.id, inSolid, hazard, landed, room: r.roomChanged && r.roomChanged.to });
        }
      }
      return { n, bad };
    });
    check('I1 all ' + r.n + ' exit arrivals: never inside a wall, never into a hazard within 180 f, and the player lands (chute arrivals may fall back out with no input)', r.n === 50 && r.bad.length === 0, r);
  });

  // ===================== J. crumble tiles return =====================
  await section('J', async () => {
    await ensurePlay(true);
    const r = await ev((d, g, Q) => {
      d.warp('dc_loft', { x: 19 * 30 + 15, y: 11 * 30 }); Q.settle(2); d.killEnemies(); Q.bigHp();
      const T = window.UB.Engine.T, lv = g.level, idx = 11 * lv.w + 19;
      let shaking = false, gone = false, goneAt = -1, back = -1;
      for (let f = 0; f < T.crumbleShake + T.crumbleGone + T.crumbleBack + 30; f++) {
        d.step(1);
        if (lv.crumble.some(c => c.tx === 19 && c.ty === 11 && c.state === 1)) shaking = true;
        if (lv.gone[idx] === 1 && !gone) { gone = true; goneAt = f; }
        if (gone && lv.gone[idx] === 0 && back < 0) back = f;
      }
      return { shaking, gone, goneAt, back, expectBack: T.crumbleShake + T.crumbleGone, tileAt: window.UB.Entity.tileAt(lv, 19, 11) };
    });
    check('J1 a crumble plank shakes 20 f, vanishes for 180 f and returns solid (no one-way route)', r.shaking && r.gone && r.back > 0 && r.back - r.goneAt >= 170 && r.back - r.goneAt <= 240 && r.tileAt === 'c', r);
  });

  // ===================== M. map bookkeeping invariants =====================
  await section('M', async () => {
    await ensurePlay(true);
    const r = await ev((d, g, Q) => {
      const W = window.UB.World; const real = Object.keys(W.rooms).filter(id => !W.rooms[id].debug);
      const vis = g.save.visited.slice(), disc = g.save.discovered.slice();
      const expect = vis.slice(); for (const id of vis) for (const e of W.rooms[id].exits) if (expect.indexOf(e.to.room) < 0) expect.push(e.to.room);
      const same = (a, b) => a.length === b.length && a.every(x => b.includes(x));
      const dup = (a) => a.length !== new Set(a).size;
      // the map overlay by the real key, then its room cursor sits on the current room
      Q.waitNormal(200); Q.kdown('map', 2); Q.stepK(); Q.stepK(); Q.stepK();
      const Ui = window.UB.UI;
      const map = { overlay: g.overlay, cursor: Ui.mapCursor || Ui.mapCur || null, current: g.level.room.id };
      Q.kdown('back', 2); Q.stepK(); Q.stepK(); Q.stepK(); const closed = g.overlay;
      return { vis, disc, expect, real: real.length, visReal: vis.every(id => real.includes(id)), discReal: disc.every(id => real.includes(id)), discOk: same(disc, expect), dupV: dup(vis), dupD: dup(disc), map, closed, current: g.level.room.id, currentVisited: vis.includes(g.level.room.id) };
    });
    check('M1 after the run: save.visited (' + r.vis.length + ' rooms) and save.discovered (' + r.disc.length + ') hold only real rooms, no duplicates, the current room is visited, and discovered = visited + every room a visited exit leads to', r.visReal && r.discReal && !r.dupV && !r.dupD && r.currentVisited && r.discOk, r);
    check('M2 the map key opens the map overlay and Back closes it (current room ' + r.current + ')', r.map.overlay === 'map' && r.closed === null, r);
  });

  check('K1 no console errors or page errors', t.errors.length === 0, t.errors);

  const fails = results.filter(x => !x.ok);
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' checks passed' + (fails.length ? ' — FAILED: ' + fails.map(f => f.name).join(' | ') : ''));
  if (t.errors.length) console.log('page errors:\n' + t.errors.join('\n'));
  await t.close();
  process.exit(fails.length ? 1 : 0);
})();
