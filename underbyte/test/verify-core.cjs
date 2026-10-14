/*
 * UNDERBYTE — test/verify-core.cjs
 * Independent verifier (round 1) — written separately from smoke.cjs and
 * deliberately not trusting its claims. Playwright, headless Chromium, file://.
 * Run:  node underbyte/test/verify-core.cjs      (exit 0 = every HARD check passed)
 *
 * Hard checks (PASS/FAIL, decide the exit code):
 *   A boot · B keyboard-only title→select→play with the live loop · R resize math ·
 *   C run/jump/wall/one-way physics + 600 frames of seeded random inputs ·
 *   D spikes · E exits both ways · F attack kills the walker · H pause freezes logic ·
 *   G death → game over → respawn at the last node · I save → reload → CONTINUE ·
 *   J the CONTRACT §9 debug API · K boss fight + HUD · Z zero console/page errors.
 * WARN probes (informational, do not affect the exit code): render interpolation under
 *   pause, corrupted-localStorage robustness. They are reported in the verifier's notes.
 * Screenshots: test/shots/1-select.png, 2-play.png, 3-boss.png (looked at by the verifier).
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./harness.cjs');

const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const warns = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}
function warn(name, ok, info) {
  if (ok) { console.log('OK   ' + name); return; }
  warns.push(name);
  console.log('WARN ' + name + (info !== undefined ? '  -> ' + JSON.stringify(info) : ''));
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

(async () => {
  const t = await launch();
  const page = t.page;
  // Run a function (serialized) inside the page with plain args.
  const ev = (fn, ...args) => page.evaluate(({ src, args }) => (new Function('args', 'return (' + src + ')(...args)'))(args), { src: fn.toString(), args });
  const state = () => page.evaluate(() => window.UB.debug.state());
  const step = (n) => page.evaluate((n) => window.UB.debug.step(n), n);
  async function stepUntil(pred, max, chunk = 1) {
    let s = await state();
    for (let i = 0; i < max && !pred(s); i += chunk) { await step(chunk); s = await state(); }
    return s;
  }
  // Real DOM key tap while logic is paused: down → 1 frame → up → 1 frame.
  async function keyTap(code) { await page.keyboard.down(code); await step(1); await page.keyboard.up(code); await step(1); }
  // Poll the live (unpaused) game until pred holds or ms elapse.
  async function waitState(pred, ms) {
    const t0 = Date.now(); let s = await state();
    while (!pred(s) && Date.now() - t0 < ms) { await page.waitForTimeout(50); s = await state(); }
    return s;
  }
  const lightRight = (extra) => page.evaluate((extra) => {
    const d = window.UB.debug; d.pressed('right', 1); d.step(1); d.pressed('light', 2); d.step(2 + extra); return d.state();
  }, extra);
  const pixel = (x, y) => page.evaluate(({ x, y }) => {
    const c = document.getElementById('game'); const ctx = c.getContext('2d'); const dpr = c.width / 960;
    return Array.from(ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data).slice(0, 3);
  }, { x, y });

  let startRoom = 'debug_room';
  try {
    // ================= A. boot =================
    await page.evaluate(() => { localStorage.removeItem('underbyte.save'); localStorage.removeItem('underbyte.settings'); });
    await page.reload(); await page.waitForTimeout(400);
    let s = await state();
    check('A1 boots to the title screen with no save', s.screen === 'title' && !s.hasSave, s);
    check('A2 boot produced zero console errors / page errors', t.errors.length === 0, t.errors);
    const warnLogs = t.logs.filter(l => l.indexOf('[warning]') === 0);
    warn('A3 no console warnings at boot', warnLogs.length === 0, warnLogs);
    // (window.Audio is the native HTMLAudioElement constructor, so it is not in this list)
    const leaks = await page.evaluate(() => ['Game', 'Player', 'Entity', 'Input', 'World', 'TILE', 'FX', 'UI', 'Render', 'Util', 'T', 'P', 'E', 'In', 'Au', 'Wd', 'R', 'boot', 'loop', 'resize', 'STEP', 'MAX_TICKS'].filter(k => k in window));
    check('A4 no accidental globals besides UB (strict-mode IIFEs hold)', leaks.length === 0 && await page.evaluate(() => typeof window.UB === 'object'), leaks);
    startRoom = await page.evaluate(() => window.UB.World.start.room);
    const werrs = await ev(() => window.UB.debug.worldErrors());
    check('A5 world data validates', werrs.length === 0, werrs);

    // ================= R. resize / letterbox math =================
    await page.setViewportSize({ width: 1000, height: 800 }); await page.waitForTimeout(150);
    let rs = await page.evaluate(() => { const c = document.getElementById('game'); const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, left: r.left, top: r.top }; });
    check('R1 1000x800 window: canvas letterboxed to 1000x562, centred vertically (top 119)', near(rs.w, 1000, 1) && near(rs.h, 562, 1) && near(rs.left, 0, 1) && near(rs.top, 119, 1), rs);
    await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(150);
    rs = await page.evaluate(() => { const c = document.getElementById('game'); const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, left: r.left, top: r.top }; });
    check('R2 1280x720 window: canvas fills it exactly (1280x720 at 0,0)', near(rs.w, 1280, 1) && near(rs.h, 720, 1) && near(rs.left, 0, 1) && near(rs.top, 0, 1), rs);

    // ================= B. keyboard-only flow, live loop (no debug flow calls) =================
    await page.keyboard.press('Enter');
    s = await waitState(x => x.screen === 'select', 2000);
    check('B1 Enter on the title opens character select', s.screen === 'select', s);
    await page.waitForTimeout(200);
    await t.shot(path.join(SHOTS, '1-select.png'));
    await page.keyboard.press('Enter');
    s = await waitState(x => x.screen === 'play' && !x.busy, 6000);
    check('B2 Enter on select starts play in the start room', s.screen === 'play' && !s.busy && s.roomId === startRoom, s);
    check('B3 new game: full hp, energy ~50, meter 0, no abilities, 0 bits', s.hp === s.maxHp && s.energy >= 50 && s.energy < 56 && s.meter === 0 && !s.abilities.echoJump && !s.abilities.burstLine && !s.abilities.gripProtocol && s.bits === 0, s);
    const b0 = s;
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(400); await page.keyboard.up('ArrowRight');
    s = await state();
    check('B4 holding ArrowRight (real key, live loop) moves the player right', s.x > b0.x + 40, { from: b0.x, to: s.x });
    await page.waitForTimeout(350);
    await t.shot(path.join(SHOTS, '2-play.png'));
    const heartPx = await pixel(39, 35), floorPx = await pixel(480, 520), skyPx = await pixel(480, 100);
    check('B5 HUD heart pixel is red (HUD renders)', heartPx[0] > 150 && heartPx[1] < 120 && heartPx[2] < 120, heartPx);
    check('B6 floor tile pixel is not black (tiles render)', floorPx[0] + floorPx[1] + floorPx[2] > 40, floorPx);
    check('B7 background pixel is not black (parallax renders)', skyPx[0] + skyPx[1] + skyPx[2] > 15, skyPx);
    await ev(() => window.UB.debug.pauseLogic(true));
    await step(10); s = await state();
    check('B8 player stands on the floor (grounded, y = 450)', s.grounded && s.y === 450, s);

    // ================= C. physics =================
    // The walker patrols x 510-690 on the floor; clear it (and ignore contact) so the wall tests measure tiles, not knockback.
    await ev(() => { window.UB.debug.killEnemies(); window.UB.debug.god(true); });
    const wallRun = await page.evaluate(() => {
      const d = window.UB.debug, g = window.UB.game, E = window.UB.Entity;
      d.teleport(16 * 30 + 15, 450); d.step(2);
      let maxX = 0, clip = false, maxDx = 0, last = g.player.x;
      d.pressed('right', 80);
      for (let i = 0; i < 80; i++) {
        d.step(1); const p = g.player;
        if (p.x - last > maxDx) maxDx = p.x - last; last = p.x;
        if (p.x > maxX) maxX = p.x;
        if (E.overlapsSolid(g.level, p.x - p.w / 2, p.y - p.h, p.w, p.h)) clip = true;
      }
      return { maxX, clip, maxDx, x: g.player.x, y: g.player.y, vx: g.player.vx };
    });
    check('C1 running right into the 3-tall block stops at its face (x = 709), never inside it, vx 0', near(wallRun.x, 709, 0.001) && wallRun.maxX <= 709.001 && !wallRun.clip && wallRun.y === 450 && wallRun.vx === 0 && wallRun.maxDx > 3.5, wallRun);
    const wallRunL = await page.evaluate(() => {
      const d = window.UB.debug, g = window.UB.game, E = window.UB.Entity;
      d.teleport(150, 450); d.step(2);
      let minX = 1e9, clip = false;
      d.pressed('left', 80);
      for (let i = 0; i < 80; i++) { d.step(1); const p = g.player; if (p.x < minX) minX = p.x; if (E.overlapsSolid(g.level, p.x - p.w / 2, p.y - p.h, p.w, p.h)) clip = true; }
      return { minX, clip, x: g.player.x, y: g.player.y };
    });
    check('C2 running left into the room wall stops at x = 41 (30 + half width)', near(wallRunL.x, 41, 0.001) && wallRunL.minX >= 40.999 && !wallRunL.clip, wallRunL);
    await ev(() => window.UB.debug.grant('burstLine', true));
    const dashRun = await page.evaluate(() => {
      const d = window.UB.debug, g = window.UB.game, E = window.UB.Entity;
      d.teleport(18 * 30 + 15, 450); d.step(2); d.pressed('right', 1); d.step(1);
      let maxX = 0, clip = false, maxDx = 0, last = g.player.x;
      d.pressed('dash', 2);
      for (let i = 0; i < 30; i++) {
        d.step(1); const p = g.player;
        if (p.x - last > maxDx) maxDx = p.x - last; last = p.x;
        if (p.x > maxX) maxX = p.x;
        if (E.overlapsSolid(g.level, p.x - p.w / 2, p.y - p.h, p.w, p.h)) clip = true;
      }
      return { maxX, clip, maxDx, x: g.player.x, y: g.player.y };
    });
    check('C3 a 15 px/frame dash into the block stops at its face without clipping', dashRun.maxDx > 10 && dashRun.maxX <= 709.001 && !dashRun.clip && near(dashRun.x, 709, 0.001), dashRun);
    await ev(() => window.UB.debug.grant('burstLine', false));
    await ev(() => window.UB.debug.teleport(15 * 30 + 15, 40));
    s = await stepUntil(x => x.grounded, 120);
    check('C4 a 410 px fall lands exactly on the floor (y = 450) without tunnelling', s.grounded && s.y === 450, s);
    await ev(() => window.UB.debug.teleport(12 * 30 + 15, 8 * 30 - 40));
    s = await stepUntil(x => x.grounded, 90);
    check('C5 lands on the one-way platform from above (y = 240)', s.grounded && s.y === 240, s);
    await page.evaluate(() => window.UB.debug.pressed('jump', 20));
    let minY = 1e9;
    for (let i = 0; i < 50; i++) { await step(1); const q = await state(); if (q.y < minY) minY = q.y; }
    s = await stepUntil(x => x.grounded, 60);
    check('C6 full jump from the platform: apex 90-120 px (clears 3 tiles) and lands back on it', 240 - minY > 90 && 240 - minY < 120 && s.y === 240 && s.grounded, { apex: 240 - minY, s });
    await page.evaluate(() => { window.UB.debug.pressed('down', 6); window.UB.debug.pressed('jump', 2); });
    s = await stepUntil(x => x.grounded && x.y === 450, 90);
    check('C7 Down+Jump drops through the one-way platform to the floor', s.y === 450 && s.grounded, s);
    await ev(() => window.UB.debug.teleport(25 * 30 + 15, 360)); await step(3); s = await state();
    check('C8a stands on top of the 3-tall block (y = 360)', s.grounded && s.y === 360, s);
    await page.evaluate(() => window.UB.debug.pressed('jump', 20)); await step(2);
    s = await stepUntil(x => x.grounded, 90);
    check('C8b jumping up through the row-11 one-way platform passes it and lands on top (y = 330)', s.y === 330 && s.grounded, s);
    // ceiling: an Echo Jump started just under the room ceiling (row 0, bottom at y 30) must stop at it, never pass it.
    await ev(() => window.UB.debug.grant('echoJump', true));
    const ceil = await page.evaluate(() => {
      const d = window.UB.debug, g = window.UB.game, p = g.player;
      d.teleport(15 * 30 + 15, 92); d.step(1);
      d.pressed('jump', 10);
      let minTop = 1e9, sawCeiling = false, minVy = 0;
      for (let i = 0; i < 40; i++) { d.step(1); const top = p.y - p.h; if (top < minTop) minTop = top; if (p.hitCeiling) sawCeiling = true; if (p.vy < minVy) minVy = p.vy; }
      return { minTop, sawCeiling, minVy, y: p.y, grounded: p.onGround };
    });
    check('C8c an air jump into the room ceiling stops at y = 30 (body top), sets hitCeiling, never clips above it', ceil.minVy < -400 && ceil.sawCeiling && ceil.minTop >= 29.999, ceil);
    await ev(() => window.UB.debug.grant('echoJump', false));
    // seeded random inputs
    await ev(() => { const d = window.UB.debug; d.grant('echoJump'); d.grant('burstLine'); d.grant('gripProtocol'); d.god(true); d.warp('debug_room', null); });
    const fuzz = await page.evaluate(() => {
      const d = window.UB.debug, g = window.UB.game, E = window.UB.Entity;
      const rng = window.UB.Util.rng(12345);
      const acts = ['left', 'right', 'jump', 'light', 'heavy', 'dash', 'down', 'special', 'up', 'overclock', 'left', 'right', 'jump'];
      const bad = [], rooms = {}; let maxAbsVy = 0, minY = 1e9, maxY = 0, modes = {};
      for (let i = 0; i < 600; i++) {
        const n = 1 + Math.floor(rng() * 3);
        for (let k = 0; k < n; k++) d.pressed(acts[Math.floor(rng() * acts.length)], 1 + Math.floor(rng() * 12));
        d.step(1);
        const p = g.player; if (!p || !g.level) { bad.push({ i, noPlayer: true }); break; }
        rooms[g.level.room.id] = 1; modes[g.mode] = (modes[g.mode] || 0) + 1;
        if (p.y > maxY) maxY = p.y; if (p.y < minY) minY = p.y; if (Math.abs(p.vy) > maxAbsVy) maxAbsVy = Math.abs(p.vy);
        if (p.x !== p.x || p.y !== p.y || p.vx !== p.vx || p.vy !== p.vy) { bad.push({ i, nan: true }); break; }
        const floor = g.level.h * 30 - 90; // every debug room: floor top is row 15
        if (p.y > floor + 0.001) bad.push({ i, belowFloor: p.y, room: g.level.room.id });
        if (p.x < p.w / 2 - 0.001 && g.mode !== 'transition') bad.push({ i, leftWall: p.x, room: g.level.room.id });
        if (g.mode === 'normal' && E.overlapsSolid(g.level, p.x - p.w / 2, p.y - p.h, p.w, p.h)) bad.push({ i, clip: true, x: p.x, y: p.y, room: g.level.room.id, st: p.state });
        if (bad.length > 8) break;
      }
      return { bad, rooms: Object.keys(rooms), modes, maxAbsVy, minY, maxY, end: d.state() };
    });
    check('C9 600 frames of seeded random inputs (all abilities, god): never below the floor, never inside a solid, no NaN', fuzz.bad.length === 0, fuzz);
    await ev(() => { const d = window.UB.debug; d.grant('echoJump', false); d.grant('burstLine', false); d.grant('gripProtocol', false); d.god(false); });
    const errsAfterFuzz = t.errors.length;
    check('C10 the random-input run produced no console/page errors', errsAfterFuzz === 0, t.errors);

    // ================= D. spikes =================
    await ev(() => window.UB.debug.warp('debug_room', null)); await step(2);
    s = await state(); const entry = { x: s.x, y: s.y, hp: s.hp };
    await ev(() => window.UB.debug.teleport(10 * 30 + 15, 450)); await step(3); s = await state();
    check('D1 touching floor spikes costs one heart and starts the hazard freeze', s.hp === entry.hp - 1 && s.hazardFreeze && s.mode === 'hazard', s);
    const frozen = await page.evaluate(() => { const g = window.UB.game; const x0 = g.player.x, y0 = g.player.y; window.UB.debug.pressed('right', 10); window.UB.debug.step(10); return { still: g.player.x === x0 && g.player.y === y0, mode: g.mode }; });
    check('D2 the player cannot move during the hazard freeze', frozen.still, frozen);
    s = await stepUntil(x => !x.hazardFreeze, 90);
    check('D3 after the freeze the player is back at the room entry with i-frames', near(s.x, entry.x, 0.001) && s.y === entry.y && s.iframes > 0 && s.mode === 'normal', { entry, s });
    await stepUntil(x => x.iframes === 0, 90, 5);

    // ================= E. exits both ways =================
    await ev(() => window.UB.debug.teleport(28 * 30 + 15, 450)); await step(2);
    const trE = await page.evaluate(() => {
      const d = window.UB.debug; d.pressed('right', 100);
      let saw = false, frames = 0, lockedDuring = true;
      for (let i = 0; i < 160; i++) { d.step(1); frames++; const s = d.state(); if (s.transition) { saw = true; if (!s.locked) lockedDuring = false; } if (s.roomId === 'debug_room2' && !s.transition && s.mode === 'normal') break; }
      window.UB.Input.releaseAll(); // drop the leftover virtual hold so later sections start clean
      return { saw, frames, lockedDuring, s: d.state() };
    });
    check('E1 walking out of the right exit transitions (player locked meanwhile) into debug_room2', trE.saw && trE.lockedDuring && trE.s.roomId === 'debug_room2' && trE.s.mode === 'normal' && !trE.s.locked, trE);
    check('E2 arrival at the paired spawn (tile 2,14 → x 75, y 450)', near(trE.s.x, 75, 0.001) && trE.s.y === 450, trE.s);
    await step(15);
    const trW = await page.evaluate(() => {
      const d = window.UB.debug; d.pressed('left', 100);
      let saw = false;
      for (let i = 0; i < 160; i++) { d.step(1); const s = d.state(); if (s.transition) saw = true; if (s.roomId === 'debug_room' && !s.transition && s.mode === 'normal') break; }
      window.UB.Input.releaseAll();
      return { saw, s: d.state() };
    });
    check('E3 walking back out of the left exit returns to debug_room at tile (29,14) → x 885', trW.saw && trW.s.roomId === 'debug_room' && near(trW.s.x, 885, 0.001) && trW.s.y === 450, trW);
    check('E4 the walker respawned on re-entry', trW.s.enemies === 1, trW.s);

    // ================= F. attack kills the walker =================
    await ev(() => window.UB.debug.god(true));
    const purged0 = await page.evaluate(() => window.UB.game.save.enemiesPurged);
    let en = await ev(() => window.UB.debug.enemies());
    const hp0 = en[0].hp;
    await ev((ex) => window.UB.debug.teleport(ex - 34, 450), en[0].x); await step(2);
    await lightRight(8);
    en = await ev(() => window.UB.debug.enemies());
    check('F1 a light attack damages the walker', en.length === 1 && en[0].hp < hp0, { hp0, en });
    for (let i = 0; i < 10; i++) {
      en = await ev(() => window.UB.debug.enemies()); if (!en.length) break;
      await ev((ex) => window.UB.debug.teleport(ex - 34, 450), en[0].x); await step(2); await lightRight(14);
    }
    s = await state(); const purged1 = await page.evaluate(() => window.UB.game.save.enemiesPurged);
    check('F2 the walker dies to repeated light attacks and enemiesPurged increments', s.enemies === 0 && purged1 === purged0 + 1, { enemies: s.enemies, purged0, purged1 });
    check('F3 the kill dropped bit pickups', (await ev(() => window.UB.debug.pickups())).some(p => p.type === 'bit'));
    await ev(() => window.UB.debug.god(false));

    // ================= H. pause freezes logic =================
    await ev(() => window.UB.debug.warp('debug_room', null)); await step(2);
    await page.evaluate(() => window.UB.debug.pressed('right', 30)); await step(6);
    const snap = () => page.evaluate(() => { const g = window.UB.game; const e = g.enemies[0]; return { pt: g.save.playTimeFrames, x: g.player.x, y: g.player.y, vx: g.player.vx, pt2: g.player.t, ex: e ? e.x : null, et: e ? e.t : null, pk: g.pickups.length, fx: window.UB.FX.count() }; });
    const before = await snap();
    await keyTap('Escape'); s = await state();
    check('H1 Escape opens the pause overlay over play', s.screen === 'pause' && s.baseScreen === 'play' && s.overlay === 'pause', s);
    await step(45);
    const during = await snap();
    check('H2 45 paused frames: play time, player position/clock, enemy position/clock and pickups unchanged', during.pt === before.pt && during.x === before.x && during.pt2 === before.pt2 && during.ex === before.ex && during.et === before.et && during.pk === before.pk, { before, during });
    const interp = await page.evaluate(() => { const g = window.UB.game; return { ppx: g.player.px, px: g.player.x, cpx: g.cam.px, cx: g.cam.x }; });
    warn('H3 (render) under the pause menu player.px === player.x and cam.px === cam.x (otherwise the frozen frame drifts with the interpolation alpha)', interp.ppx === interp.px && interp.cpx === interp.cx, interp);
    await keyTap('Escape'); s = await state();
    check('H4 Escape again resumes play', s.screen === 'play' && !s.overlay, s);
    await step(10); const after = await snap();
    check('H5 after resuming, play time and the world advance again', after.pt > before.pt && after.pt2 > before.pt2, { before, after });
    await keyTap('KeyM'); s = await state();
    check('H6 M opens the map overlay', s.screen === 'map', s);
    await keyTap('KeyM'); s = await state();
    check('H7 M closes the map overlay', s.screen === 'play', s);
    await page.keyboard.down('ArrowRight'); await step(2);
    const heldBefore = await page.evaluate(() => window.UB.Input.state.right.down);
    await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await step(1);
    const heldAfter = await page.evaluate(() => window.UB.Input.state.right.down);
    await page.keyboard.up('ArrowRight'); await step(1);
    check('H8 a window blur releases held keys (no stuck "right")', heldBefore === true && heldAfter === false, { heldBefore, heldAfter });

    // ================= G. death → game over → respawn at the last node =================
    await ev(() => window.UB.debug.teleport(5 * 30 + 15, 450)); await step(3); s = await state();
    check('G1 standing at the restore node offers the interaction', s.nearNode === 'node_debug', s);
    await page.evaluate(() => window.UB.debug.pressed('up', 2)); await step(1); s = await state();
    check('G2 Up at the node starts the rest sequence', s.mode === 'nodeUse', s);
    s = await stepUntil(x => x.mode === 'normal', 80);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('underbyte.save') || 'null'));
    check('G3 resting writes the save (debug_room / node_debug / full hearts)', saved && saved.roomId === 'debug_room' && saved.spawn && saved.spawn.nodeId === 'node_debug' && saved.hearts === saved.maxHearts, saved);
    await ev(() => window.UB.debug.setHp(1)); await step(1);
    await ev(() => window.UB.debug.teleport(10 * 30 + 15, 450)); await step(3); s = await state();
    check('G4 a spike at 1 hp kills the player', s.dead && s.hp === 0, s);
    s = await stepUntil(x => x.screen === 'gameover' && !x.busy, 240, 5);
    check('G5 death leads to the game-over screen and counts one death', s.screen === 'gameover' && s.deaths === 1, s);
    await step(30);
    await keyTap('Enter');
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 150, 5);
    check('G6 confirm on game over respawns at the last node (x 165, y 450) with full hp, energy 50, meter 0', s.screen === 'play' && s.roomId === 'debug_room' && near(s.x, 165, 0.001) && s.y === 450 && s.hp === s.maxHp && s.energy >= 50 && s.energy < 56 && s.meter === 0 && !s.dead, s);

    // ================= I. save → reload → CONTINUE =================
    await ev(() => window.UB.debug.warp('debug_room2', 'L')); await step(2);
    await ev(() => window.UB.debug.teleport(8 * 30 + 15, 450)); s = await stepUntil(x => x.bits >= 5, 30);
    const bitsNow = s.bits;
    check('I1 the placed medium bit in debug_room2 is worth 5', bitsNow >= 5, s);
    await ev(() => window.UB.debug.teleport(25 * 30 + 15, 11 * 30)); s = await stepUntil(x => x.maxHp === 6, 30);
    check('I2 collecting the hidden core raises max hp to 6 (+1 hp) and records it', s.maxHp === 6 && s.hp === 6 && s.cores.indexOf('core_debug') >= 0, s);
    await ev(() => window.UB.debug.warp('debug_room', null)); await step(2);
    await ev(() => window.UB.debug.setHp(2)); await step(1);
    await ev(() => window.UB.debug.teleport(5 * 30 + 15, 450)); await step(3);
    await page.evaluate(() => window.UB.debug.pressed('up', 2)); await step(1);
    s = await stepUntil(x => x.mode === 'normal', 80);
    check('I3 node use heals to the new max (6)', s.hp === 6 && s.maxHp === 6, s);
    const saved2 = await page.evaluate(() => JSON.parse(localStorage.getItem('underbyte.save') || 'null'));
    check('I4 the save records 6 hearts, the core, the bits and the room', saved2 && saved2.maxHearts === 6 && saved2.cores.indexOf('core_debug') >= 0 && saved2.bits === bitsNow && saved2.roomId === 'debug_room', saved2);
    await page.reload(); await page.waitForTimeout(400);
    s = await state();
    check('I5 after reload the title reports the save (room debug_room)', s.screen === 'title' && s.hasSave && s.savedRoom === 'debug_room', s);
    await page.keyboard.press('Enter');
    s = await waitState(x => (x.screen === 'play' && !x.busy) || x.screen === 'select', 6000);
    check('I6 Enter on the title with a save = CONTINUE → play in the saved room at the node', s.screen === 'play' && s.roomId === 'debug_room' && near(s.x, 165, 0.001) && s.y === 450, s);
    check('I7 CONTINUE restores max hp 6, full hp, the core, the bits and the fighter', s.maxHp === 6 && s.hp === 6 && s.cores.indexOf('core_debug') >= 0 && s.bits === bitsNow && s.fighter === 'tessik', s);
    await ev(() => window.UB.debug.pauseLogic(true));

    // ================= J. debug API (CONTRACT §9) =================
    const missing = await page.evaluate(() => {
      const d = window.UB.debug;
      return ['state', 'warp', 'teleport', 'grant', 'setHp', 'setMaxHp', 'setEnergy', 'setMeter', 'addBits', 'setBits', 'defeatBoss', 'killEnemies', 'god', 'godmode', 'step', 'frame', 'pauseLogic', 'pressed', 'newGame', 'startGame', 'continueGame', 'toTitle', 'skipTo', 'save', 'load', 'reset', 'audio', 'mute', 'rooms', 'enemies', 'pickups', 'boss', 'showHitboxes', 'worldErrors'].filter(n => typeof d[n] !== 'function');
    });
    check('J1 every CONTRACT §9 debug function exists', missing.length === 0, missing);
    await ev(() => window.UB.debug.warp('debug_boss', 'L')); await step(2); s = await state();
    check('J2 warp(room, exitId) loads the room at that exit spawn (x 75) with its boss idle', s.roomId === 'debug_boss' && near(s.x, 75, 0.001) && s.boss && s.boss.id === 'proto_warden' && s.bossFight === 'none', s);
    await ev(() => window.UB.debug.warp('debug_room2', { x: 300, y: 450 })); await step(2); s = await state();
    check('J3 warp(room, {x,y}) places the player there', s.roomId === 'debug_room2' && s.x === 300 && s.y === 450, s);
    await ev(() => window.UB.debug.grant('gripProtocol')); s = await state();
    check('J4 grant(id) turns an ability on', s.abilities.gripProtocol === true, s.abilities);
    await ev(() => window.UB.debug.grant('gripProtocol', false)); s = await state();
    check('J5 grant(id, false) turns it off', s.abilities.gripProtocol === false, s.abilities);
    await ev(() => window.UB.debug.setHp(2)); s = await state();
    check('J6 setHp(2) sets hp', s.hp === 2, s);
    await ev(() => window.UB.debug.godmode(true));
    await ev(() => window.UB.debug.warp('debug_room', null)); await ev(() => window.UB.debug.teleport(10 * 30 + 15, 450)); await step(5); s = await state();
    check('J7 godmode(true): spikes no longer hurt', s.god && s.hp === 2 && !s.hazardFreeze, s);
    await ev(() => window.UB.debug.godmode(false)); await ev(() => window.UB.debug.teleport(105, 450)); await step(2);
    const fr = await page.evaluate(() => { const d = window.UB.debug; const f0 = d.state().frame; const r = d.frame(); return { f0, r, f1: d.state().frame }; });
    check('J8 frame() advances exactly one logic frame and returns the frame counter', fr.f1 === fr.f0 + 1 && fr.r === fr.f1, fr);
    const sv = await ev(() => window.UB.debug.save());
    check('J9 save() returns true (slot written)', sv === true, sv);
    await ev(() => window.UB.debug.startGame('tessik'));
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 150, 5);
    check('J10 startGame(id) starts a fresh run in the start room (5 hearts, 0 bits, no abilities)', s.screen === 'play' && s.roomId === startRoom && s.fighter === 'tessik' && s.hp === 5 && s.maxHp === 5 && s.bits === 0 && !s.abilities.echoJump, s);
    await ev(() => window.UB.debug.setMeter(100)); s = await state();
    // transform = 20 f plus the 8 f activation hitstop during which the player does not update
    await page.evaluate(() => window.UB.debug.pressed('overclock', 2)); await step(45); s = await state();
    check('J11 setMeter(100) + overclock press transforms (Overclock active after the 20 f transform + 8 f hitstop)', s.overclock === true && s.playerState !== 'overclock', s);

    // ================= K. boss fight + boss HUD =================
    await ev(() => window.UB.debug.warp('debug_boss', 'L')); await step(2);
    await ev(() => window.UB.debug.teleport(9 * 30, 450)); await step(3); s = await state();
    check('K1 crossing the boss bounds starts the intro and locks the player', s.bossFight === 'intro' && s.locked && s.mode === 'bossIntro', s);
    const sealed = await page.evaluate(() => window.UB.Entity.tileAt(window.UB.game.level, 0, 13));
    check('K2 the boss seal makes the exit opening solid', sealed === '#', sealed);
    s = await stepUntil(x => x.bossFight === 'fight', 200, 10);
    check('K3 the fight starts after the card; control returns; boss active', s.bossFight === 'fight' && !s.locked && s.boss && s.boss.active, s);
    await ev(() => window.UB.debug.god(true));
    for (let i = 0; i < 4; i++) {
      const bx = await page.evaluate(() => window.UB.game.boss.x);
      await ev((x) => window.UB.debug.teleport(x - 50, 450), bx); await step(2); await lightRight(14);
    }
    s = await state();
    check('K4 light attacks damage the boss', s.boss && s.boss.hp < s.boss.maxHp && s.boss.hp > s.boss.maxHp / 2, s.boss);
    await page.waitForTimeout(250);
    await t.shot(path.join(SHOTS, '3-boss.png'));
    const barPx = await pixel(480, 501);
    check('K5 boss HP bar pixel at (480,501) is red/orange (boss HUD renders)', barPx[0] > 180 && barPx[1] < 170, barPx);
    await ev(() => window.UB.debug.god(false));

    // ================= Z. errors during the core checks =================
    check('Z1 no console errors or page errors during the core checks', t.errors.length === 0, t.errors);

    // ================= L. WARN probes: corrupted localStorage =================
    const errsBeforeL = t.errors.length;
    async function probeSave(raw, tryContinue) {
      const e0 = t.errors.length;
      await page.evaluate((raw) => { localStorage.setItem('underbyte.save', raw); }, raw);
      await page.reload(); await page.waitForTimeout(400);
      let st = null, cont = null;
      try { st = await state(); } catch (e) { st = { evalError: String(e && e.message || e).slice(0, 120) }; }
      if (tryContinue && st && st.screen === 'title') {
        try {
          await page.evaluate(() => window.UB.debug.pauseLogic(true));
          await page.evaluate(() => window.UB.debug.continueGame());
          await step(120);
          cont = await state();
        } catch (e) { cont = { evalError: String(e && e.message || e).slice(0, 160) }; }
      }
      const errs = t.errors.slice(e0).map(x => x.slice(0, 160));
      await page.evaluate(() => localStorage.removeItem('underbyte.save'));
      return { st, cont, errs };
    }
    let r = await probeSave('not json', true);
    warn('L1 corrupt save (invalid JSON) → boots to the title with no save and no errors', r.st && r.st.screen === 'title' && !r.st.hasSave && r.errs.length === 0, r);
    r = await probeSave('[1,2,3]', true);
    warn('L2 corrupt save (JSON array) → boots clean', r.st && r.st.screen === 'title' && r.errs.length === 0, r);
    r = await probeSave(JSON.stringify({ version: 1, fighter: 'tessik', cores: null }), true);
    warn('L3 corrupt save (version 1, cores:null) → still boots with no errors', r.st && r.st.screen === 'title' && r.errs.length === 0, r);
    r = await probeSave(JSON.stringify({ version: 1, fighter: 'tessik', roomId: 'debug_room', spawn: { nodeId: 'node_debug' }, cores: [], abilities: null, discovered: 7, visited: 'x', bitsCollected: 0, vendor: 3, bossesDefeated: {}, nodesUsed: null, bits: 'lots' }), true);
    warn('L4 corrupt save (version 1, wrong field types) → CONTINUE reaches play without errors', r.st && r.st.screen === 'title' && r.cont && !r.cont.evalError && r.cont.screen === 'play' && r.errs.length === 0, r);
    r = await probeSave(JSON.stringify({ version: 1, fighter: 'nobody', roomId: 'nope', spawn: { nodeId: 'zzz' }, cores: [] }), true);
    warn('L5 corrupt save (unknown fighter/room/node) → CONTINUE falls back to the start room', r.cont && r.cont.screen === 'play' && r.cont.roomId === startRoom && r.errs.length === 0, r);
    r = await probeSave(JSON.stringify({ version: 1, fighter: 'tessik', roomId: 'debug_room', spawn: { nodeId: 'node_debug' }, cores: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'] }), true);
    warn('L6 corrupt save (12 bogus cores) → max hearts stays within the HUD limit (≤ 9) / cores validated', r.cont && r.cont.screen === 'play' && r.cont.maxHp <= 9 && r.errs.length === 0, r);
    const e7 = t.errors.length;
    await page.evaluate(() => { localStorage.setItem('underbyte.settings', JSON.stringify({ master: 'loud', screenShake: 'yes', showHitboxes: 1 })); });
    await page.reload(); await page.waitForTimeout(300);
    let st2 = null; try { st2 = await state(); } catch (e) { st2 = { evalError: String(e && e.message || e).slice(0, 120) }; }
    warn('L7 corrupt settings (wrong types) → still boots', st2 && st2.screen === 'title' && t.errors.length === e7, { st2, errs: t.errors.slice(e7) });
    // hitstop interpolation: land a hit and inspect px/x while the world is frozen
    await page.evaluate(() => { localStorage.removeItem('underbyte.settings'); localStorage.removeItem('underbyte.save'); });
    await page.reload(); await page.waitForTimeout(300);
    await ev(() => { const d = window.UB.debug; d.pauseLogic(true); d.startGame('tessik'); });
    await stepUntil(x => x.screen === 'play' && !x.busy, 150, 5);
    await ev(() => window.UB.debug.god(true));
    const hs = await page.evaluate(() => {
      const d = window.UB.debug, g = window.UB.game, FX = window.UB.FX;
      const e = g.enemies[0]; d.teleport(e.x - 34, 450); d.step(2); d.pressed('right', 1); d.step(1); d.pressed('light', 2);
      for (let i = 0; i < 12; i++) { d.step(1); if (FX.hitstopFrames > 0) { return { hitstop: FX.hitstopFrames, ppx: g.player.px, px: g.player.x, epx: e.px, ex: e.x }; } }
      return null;
    });
    warn('L8 (render) during world hitstop entity.px === entity.x (otherwise the "frozen" frame drifts with the interpolation alpha)', hs && hs.ppx === hs.px && hs.epx === hs.ex, hs);
    const unusedL = errsBeforeL; void unusedL;
    await page.evaluate(() => { localStorage.removeItem('underbyte.settings'); localStorage.removeItem('underbyte.save'); });
    await page.reload(); await page.waitForTimeout(300);
  } catch (e) {
    check('test threw: ' + (e && e.message ? e.message : String(e)), false, e && e.stack);
  }

  const fails = results.filter(r => !r.ok);
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' hard checks passed' + (fails.length ? ' — FAILED: ' + fails.map(f => f.name).join(' | ') : ''));
  if (warns.length) console.log(warns.length + ' WARN probe(s) did not hold: ' + warns.join(' | '));
  console.log('screenshots in ' + SHOTS);
  await t.close();
  process.exit(fails.length ? 1 : 0);
})();
