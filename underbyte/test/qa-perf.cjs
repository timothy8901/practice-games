/*
 * UNDERBYTE — test/qa-perf.cjs   (QA round 2, lens: PERFORMANCE & VISUAL QUALITY)
 * Run:  node underbyte/test/qa-perf.cjs      (exit code 0 = every check passed)
 *
 * Playwright, headless Chromium, file:// index.html. Launches Chromium itself (not harness.cjs)
 * because the heap checks need `--enable-precise-memory-info --js-flags=--expose-gc` and the DPR
 * checks need a second browser context with deviceScaleFactor 2. Everything is driven through
 * window.UB.debug (CONTRACT §9) with logic paused and stepped by hand; timings use
 * performance.now around game.tick() + game.render(1) + a 1-px readback of the main canvas
 * (the raster is paid inside the measurement). The machine is shared with other Chromium
 * instances, so every timing is taken as the best of up to three 300-frame runs and the spread
 * is printed; a check only fails when the quietest run is over the limit.
 *
 * What it proves / measures
 *   1. Frame cost in the five busiest rooms (most live enemies: rw_gate, bv_cistern, ns_climb,
 *      lw_belts, ns_plunge) with the player running, jumping, attacking and firing specials, and
 *      in every boss arena (live fight, Kernauth both phases): MEDIAN < 8 ms, 99th percentile
 *      < 25 ms over 300 frames (best of 3 runs).
 *   2. Heap: gc'd growth ≤ 1.5 MB over 1800 frames of play, a second 1800-frame window that
 *      grows ≤ 512 KB (plateau), a 30-cycle title→game→victory plateau, sampled allocations of a
 *      play frame ≤ 2 KB/frame.
 *   3. Caps under spam: 200 specials + 60 ultimates per fighter (projectiles ≤ 64, particles ≤ 512,
 *      hits ≤ 64), 400 particle bursts (pool stays ≤ 512, dust/aura recycled first), 200 raw
 *      projectile spawns (cap 64, the evicted ones flagged dead), 100 registered hits in one frame.
 *   4. Feel: every fighter's light and heavy hit → hitstop, particles, enemy flash, (heavy) shake;
 *      kill chips; boss hit; player hurt (hitstop 6, shake, red flash, 60 i-frames, impact zoom);
 *      frozen frames during hitstop are alpha-independent.
 *   5. Every real room through every exit: screenshot (test/shots/qa-perf-room-<room>-<exit>.png),
 *      world not blank, tile cache painted, dominant colour nearest the room's own zone palette,
 *      the PLAYER actually drawn (pixel diff with its draw stubbed), every on-screen enemy drawn.
 *   6. No placeholder art: every enemy type/variant, boss and fighter rig draws ≥ 5 colours with an
 *      INK outline and is not a filled rectangle.
 *   7. Every screen and overlay: screenshot + not blank; shop effect lines fit the panel; select
 *      bios wrap to ≤ 4 lines; victory stats fit the panel; the CONTINUE sub-line fits.
 *   8. Camera under the real rAF loop: no backward steps of the player on screen while running,
 *      no jumps > 6 px, camera monotonic; vertical camera monotonic while falling; the transition
 *      composite draws mid-slide and lands in the right room; parallax layers wrap without a seam.
 *   9. Letterbox at five window sizes (16:9, centred, fills the limiting side) with the backing
 *      scale following the CSS upscale (960×540 → 1, 1440×810 → 1.5, ≥ 1920×1080 → 2) and every
 *      full-screen cache rebuilt at that scale.
 *  10. DPR 2: backing 1920×1080, tile cache at scale 2 (also for the tallest room), INK edges
 *      twice as many device pixels wide, frame cost ≤ 4.5× DPR 1, a resize keeps the letterbox.
 * Finally: no console / page errors.
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { INDEX: HARNESS_INDEX } = require('./harness.cjs');

const INDEX = HARNESS_INDEX || path.resolve(__dirname, '..', 'index.html');
const SHOTS = path.resolve(__dirname, 'shots');
const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info) : ''));
}
const r2 = (v) => Math.round(v * 100) / 100;
const BUSY_ROOMS = ['rw_gate', 'bv_cistern', 'ns_climb', 'lw_belts', 'ns_plunge'];   // most live enemies (9/8/7/6/6)
const ARENAS = { dc_sentinel: 'tallock', lw_weftyr: 'weftyr', bv_corrosant: 'corrosant', rw_throne: 'kernauth' };
const FIGHTERS = ['tessik', 'brackmaw', 'vellix', 'orrubel', 'korvask'];
const MED_LIMIT = 8, P99_LIMIT = 25;

async function makePage(browser, ctxOpts) {
  const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 720 } }, ctxOpts || {}));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + (e && e.stack ? e.stack : String(e))));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('[error] ' + m.text()); });
  await page.goto('file://' + INDEX);
  await page.waitForTimeout(300);
  const D = (fn, ...args) => page.evaluate(({ src, args }) => { const f = new Function('d', 'args', 'return (' + src + ')(d, ...args)'); return f(window.UB.debug, args); }, { src: fn.toString(), args });
  const G = (fn, ...args) => page.evaluate(({ src, args }) => { const f = new Function('g', 'args', 'return (' + src + ')(g, ...args)'); return f(window.UB.game, args); }, { src: fn.toString(), args });
  const state = () => page.evaluate(() => window.UB.debug.state());
  const step = (n) => page.evaluate((n) => window.UB.debug.step(n), n);
  async function start(fighter) {
    await page.evaluate(() => { localStorage.removeItem('underbyte.save'); localStorage.removeItem('underbyte.settings'); });
    await D(d => d.pauseLogic(true));
    await D((d, f) => d.newGame(f), fighter || 'tessik');
    let s = await state();
    for (let i = 0; i < 120 && !(s.screen === 'play' && !s.busy); i++) { await step(5); s = await state(); }
    // the zone lore card would otherwise open 90 f after each first zone entry and freeze the world
    await page.evaluate(() => { const g = window.UB.game; g.save.loreSeen = window.UB.IDS.zones.slice(); g.loreTimer = 0; g.loreZone = null; });
    return s;
  }
  async function shot(name) { await page.evaluate(() => window.UB.game.render(1)); await page.screenshot({ path: path.join(SHOTS, 'qa-perf-' + name + '.png') }); }
  return { ctx, page, errors, D, G, state, step, start, shot };
}

/** In-page per-frame cost probe: tick + render(1) + a 1-px readback of the main canvas. `hold` drives the player. */
const PROBE = `(function (n, hold) {
  const g = window.UB.game, d = window.UB.debug, mc = g.mctx;
  const tot = new Float64Array(n), tk = new Float64Array(n);
  let maxFx = 0, reentries = 0; const room0 = g.level.room.id, spot = hold && hold.spot;
  for (let i = 0; i < n; i++) {
    if (g.level.room.id !== room0 || g.mode === 'transition') { reentries++; d.warp(room0, null); if (spot) d.teleport(spot.x, spot.y); }
    if (hold) {
      if (hold.move) d.pressed(((i / 40) | 0) % 2 ? 'left' : 'right', 2);
      if (hold.light && i % 15 === 0) d.pressed('light', 2);
      if (hold.heavy && i % 45 === 20) d.pressed('heavy', 2);
      if (hold.jump && i % 50 === 0) d.pressed('jump', 2);
      if (hold.special && i % 90 === 10) { d.setEnergy(100); d.pressed('special', 2); }
    }
    const t0 = performance.now(); g.tick(); const t1 = performance.now(); g.render(1); mc.getImageData(0, 0, 1, 1); tot[i] = performance.now() - t0; tk[i] = t1 - t0;
    const c = window.UB.FX.count(); if (c > maxFx) maxFx = c;
  }
  const b = Array.from(tot).sort((x, y) => x - y), bt = Array.from(tk).sort((x, y) => x - y);
  return { med: b[n >> 1], p99: b[Math.floor(n * 0.99)], max: b[n - 1], avg: b.reduce((x, y) => x + y, 0) / n, tickMed: bt[n >> 1],
    maxFx: maxFx, enemies: g.enemies.length, proj: g.projectiles.length, room: g.level.room.id, reentries: reentries };
})`;
/** A standing spot near the centre of the current room with air on both sides (so a driven player never reaches an exit). */
const SPOT = `(function () { const g = window.UB.game, r = g.level.room, T = r.tiles, cx0 = r.w >> 1;
  for (let dx = 0; dx < r.w; dx++) for (const x of [cx0 + dx, cx0 - dx]) { if (x < 3 || x > r.w - 4) continue;
    for (let y = r.h - 2; y >= 2; y--) { if (T[y][x] === '.' && T[y - 1][x] === '.' && T[y][x - 1] === '.' && T[y][x + 1] === '.' && T[y][x - 2] === '.' && T[y][x + 2] === '.' && T[y + 1][x] === '#') return { x: x * 30 + 15, y: (y + 1) * 30 }; } }
  return null; })`;
/** Best of up to `runs` runs: the first run decides; a borderline run (> 75 % of a limit) is re-measured up to `runs` times. */
async function measure(page, runs, n, hold) {
  const all = [];
  if (hold && hold.move && !hold.spot) { hold.spot = await page.evaluate(`${SPOT}()`); if (hold.spot) await page.evaluate((sp) => window.UB.debug.teleport(sp.x, sp.y), hold.spot); }
  for (let k = 0; k < runs; k++) {
    const r = await page.evaluate(`${PROBE}(${n}, ${JSON.stringify(hold || null)})`);
    all.push(r);
    if (r.med < MED_LIMIT * 0.75 && r.p99 < P99_LIMIT * 0.75) break;   // clearly fine: no need to re-measure
  }
  const best = Object.assign({}, all.reduce((a, b) => (b.med < a.med ? b : a)));
  best.p99 = Math.min.apply(null, all.map(r => r.p99));
  best.runs = all.map(r => r2(r.med) + '/' + r2(r.p99));
  best.consistent = all.every(r => (r.med < MED_LIMIT) === (best.med < MED_LIMIT));
  best.reentries = all.reduce((a, r) => a + r.reentries, 0);
  return best;
}
/** Count distinct 5-bit colours on a 20-px grid of an ImageData-like {data, w, h}. */
const COLOR_COUNT = `(function (ctx, w, h) { const img = ctx.getImageData(0, 0, w, h).data; const s = new Set(); for (let y = 10; y < h; y += 20) for (let x = 10; x < w; x += 20) { const i = (y * w + x) * 4; s.add((img[i] >> 3) + ',' + (img[i + 1] >> 3) + ',' + (img[i + 2] >> 3)); } return s.size; })`;

(async () => {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'] });
  const t = await makePage(browser);
  const { page, D, G, state, step } = t;
  try {
    // ================= 1. boot =================
    let s = await t.start('tessik');
    check('1a NEW GAME boots into play (dc_wake)', s.screen === 'play' && s.roomId === 'dc_wake', s);
    const gcOk = await page.evaluate(() => typeof window.gc === 'function' && !!(performance.memory && performance.memory.usedJSHeapSize));
    check('1b precise memory + gc available for the heap checks', gcOk);
    const busiest = await page.evaluate((list) => { const W = window.UB.World; const counts = []; for (const id in W.rooms) { const r = W.rooms[id]; if (!r.debug) counts.push([id, r.spawns.length]); } counts.sort((a, b) => b[1] - a[1]); return { top: counts.slice(0, 5).map(c => c[0]), picked: list }; }, BUSY_ROOMS);
    check('1c the five measured rooms are the five with the most enemy spawns', busiest.top.every(id => BUSY_ROOMS.indexOf(id) >= 0), busiest);

    // ================= 2. frame cost: busiest rooms (running, jumping, attacking, specials) =================
    const perf = {};
    for (const room of BUSY_ROOMS) {
      await D((d, r) => d.warp(r, null), room); await step(30); await D(d => d.god(true));
      const b = await measure(page, 3, 300, { move: true, light: true, heavy: true, jump: true, special: true });
      perf[room] = b;
      console.log('   ' + room.padEnd(12) + ' median ' + r2(b.med) + ' ms (tick ' + r2(b.tickMed) + '), p99 ' + r2(b.p99) + ' ms, max ' + r2(b.max) + ' (runs med/p99: ' + b.runs.join(' | ') + ') enemies ' + b.enemies + ', peak particles ' + b.maxFx);
      check('2 frame cost ' + room + ': median < ' + MED_LIMIT + ' ms (' + r2(b.med) + ') and p99 < ' + P99_LIMIT + ' ms (' + r2(b.p99) + ')', b.med < MED_LIMIT && b.p99 < P99_LIMIT && b.room === room && b.reentries === 0, b);
    }
    // boss arenas: live fight, player attacking
    for (const room in ARENAS) {
      await D((d, r) => d.warp(r, null), room); await step(10);
      await D((d, b) => d.spawnBoss(b), ARENAS[room]); await step(30); await D(d => d.god(true));
      const b = await measure(page, 3, 300, { light: true, heavy: true, move: true });
      const bs = await D(d => d.boss());
      perf[room] = b;
      console.log('   ' + room.padEnd(12) + ' (' + ARENAS[room] + ' ' + (bs ? bs.state + '/' + bs.attack : '-') + ') median ' + r2(b.med) + ' ms, p99 ' + r2(b.p99) + ' ms, max ' + r2(b.max) + ' (runs: ' + b.runs.join(' | ') + ')');
      check('2 frame cost boss ' + room + ' (' + ARENAS[room] + '): median < ' + MED_LIMIT + ' ms (' + r2(b.med) + ') and p99 < ' + P99_LIMIT + ' ms (' + r2(b.p99) + ')', bs && bs.fight === 'fight' && b.med < MED_LIMIT && b.p99 < P99_LIMIT, { boss: bs, b });
    }
    // Kernauth phase 2 (the phase change happens inside takeHit, CONTRACT §6.2)
    await D(d => d.warp('rw_throne', null)); await step(10); await D(d => d.spawnBoss('kernauth')); await step(30); await D(d => d.god(true));
    await page.evaluate(() => { const g = window.UB.game, b = g.boss, h = window.UB.Entity.makeHit('player'); h.dmg = b.hp; h.kind = 'heavy'; h.x = b.x - 60; h.y = b.y - 120; h.w = 120; h.h = 120; b.takeHit(h, g); });
    await step(200);
    const k2 = await D(d => d.boss());
    const bK2 = await measure(page, 3, 300, { light: true, move: true });
    console.log('   rw_throne p2 (' + (k2 ? 'phase ' + k2.phase + ' ' + k2.state : '-') + ') median ' + r2(bK2.med) + ' ms, p99 ' + r2(bK2.p99) + ' (runs: ' + bK2.runs.join(' | ') + ')');
    check('2 frame cost Kernauth phase 2: phase === 2, median < 8 ms (' + r2(bK2.med) + ') and p99 < 25 ms (' + r2(bK2.p99) + ')', k2 && k2.phase === 2 && bK2.med < MED_LIMIT && bK2.p99 < P99_LIMIT, { k2, bK2 });
    // worst case: the busiest room with the particle pool full and 64 projectiles alive
    await D(d => d.warp('rw_gate', null)); await step(30); await D(d => d.god(true));
    const worst = await page.evaluate(`(function () {
      const g = window.UB.game, FX = window.UB.FX;
      for (let i = 0; i < 40; i++) FX.burst('spark', g.player.x, g.player.y - 20, 16, { color: '#FFFFFF' });
      for (let i = 0; i < 64; i++) { const p = new window.UB.Entity({ x: g.player.x + i * 7, y: g.player.y - 30, w: 8, h: 8, units: 'pxf' }); p.owner = 'enemy'; p.update = function () { this.t++; }; p.draw = function (c) { c.fillStyle = '#fff'; c.fillRect(this.x - 4, this.y - 8, 8, 8); }; g.spawnProjectile(p); }
      return ${PROBE}(120, { move: true, light: true });
    })()`);
    console.log('   rw_gate + full particle pool + 64 projectiles: median ' + r2(worst.med) + ' ms, p99 ' + r2(worst.p99) + ' (particles at start ' + worst.maxFx + ', projectiles ' + worst.proj + ')');
    check('2 worst case (rw_gate, 512 particles, 64 projectiles): median < 8 ms (' + r2(worst.med) + ') and p99 < 25 ms (' + r2(worst.p99) + ')', worst.med < MED_LIMIT && worst.p99 < P99_LIMIT, worst);

    // ================= 3. heap =================
    await t.start('tessik'); await D(d => d.warp('bv_cistern', null)); await step(30); await D(d => d.god(true));
    const PLAY = `(function (n) { const g = window.UB.game, d = window.UB.debug; for (let i = 0; i < n; i++) { d.pressed(i % 400 < 200 ? 'right' : 'left', 2); if (i % 30 === 0) d.pressed('jump', 2); if (i % 15 === 0) d.pressed('light', 2); if (i % 90 === 0) d.pressed('heavy', 2); if (i % 120 === 0) { d.setEnergy(100); d.pressed('special', 2); } if (i % 600 === 599) d.warp(['bv_cistern', 'ns_climb', 'rw_gate'][(i / 600) | 0 % 3], null); g.tick(); g.render(1); } })`;
    const growth = await page.evaluate(`(function () {
      window.gc(); window.gc(); const h0 = performance.memory.usedJSHeapSize;
      ${PLAY}(1800); window.gc(); window.gc(); const h1 = performance.memory.usedJSHeapSize;
      ${PLAY}(1800); window.gc(); window.gc(); const h2 = performance.memory.usedJSHeapSize;
      const g = window.UB.game; return { h0, h1, h2, g1: h1 - h0, g2: h2 - h1, fx: window.UB.FX.count(), proj: g.projectiles.length, enemies: g.enemies.length, pickups: g.pickups.length, room: g.level.room.id };
    })()`);
    console.log('   heap: ' + growth.h0 + ' → ' + growth.h1 + ' (+' + growth.g1 + ' B after 1800 f) → ' + growth.h2 + ' (+' + growth.g2 + ' B after 1800 more)');
    check('3a JS heap grows ≤ 1.5 MB over 1800 frames of play (gc before/after): +' + growth.g1 + ' B', growth.g1 <= 1.5 * 1024 * 1024, growth);
    check('3b a second 1800-frame window grows ≤ 512 KB (no unbounded growth): +' + growth.g2 + ' B', growth.g2 <= 512 * 1024, growth);
    const cycles = await page.evaluate(() => {
      const g = window.UB.game, d = window.UB.debug; const out = [];
      for (let c = 0; c < 30; c++) {
        d.toTitle(); for (let i = 0; i < 10; i++) { g.tick(); g.render(1); }
        d.newGame(['tessik', 'vellix', 'korvask', 'brackmaw', 'orrubel'][c % 5]); for (let i = 0; i < 120; i++) { g.tick(); g.render(1); }
        d.warp(['dc_cross', 'lw_belts', 'bv_cistern', 'ns_climb', 'rw_gate'][c % 5], null); for (let i = 0; i < 30; i++) { g.tick(); g.render(1); }
        d.skipTo('pause'); for (let i = 0; i < 5; i++) { g.tick(); g.render(1); } d.skipTo('play');
        d.skipTo('map'); for (let i = 0; i < 5; i++) { g.tick(); g.render(1); } d.skipTo('play');
        d.skipTo('victory'); for (let i = 0; i < 30; i++) { g.tick(); g.render(1); }
        if (c % 5 === 4) { window.gc(); window.gc(); out.push(performance.memory.usedJSHeapSize); }
      }
      return out;
    });
    const plateau = cycles[cycles.length - 1] - cycles[1];
    console.log('   heap after every 5 game cycles: ' + cycles.join(', ') + ' (cycles 10→30: ' + plateau + ' B)');
    check('3c heap plateaus over 30 title→game→room→victory cycles (cycles 10→30 grow ≤ 1 MB): ' + plateau + ' B', plateau <= 1024 * 1024, cycles);
    await t.start('tessik'); await D(d => d.warp('bv_cistern', null)); await step(30); await D(d => d.god(true));
    const cdp = await t.ctx.newCDPSession(page);
    await cdp.send('HeapProfiler.enable');
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 512 });
    await page.evaluate(() => { const g = window.UB.game, d = window.UB.debug; for (let i = 0; i < 600; i++) { d.pressed(i % 240 < 120 ? 'right' : 'left', 2); if (i % 15 === 0) d.pressed('light', 2); if (i % 40 === 0) d.pressed('jump', 2); g.tick(); g.render(1); } });
    const { profile } = await cdp.send('HeapProfiler.stopSampling');
    const agg = new Map(); let total = 0;
    (function walk(node) { const cf = node.callFrame; const key = (cf.functionName || '(anon)') + ' ' + (cf.url || '').split('/').pop() + ':' + (cf.lineNumber + 1); if (node.selfSize > 0) { agg.set(key, (agg.get(key) || 0) + node.selfSize); total += node.selfSize; } for (const c of node.children || []) walk(c); })(profile.head);
    const top = Array.from(agg.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => Math.round(v / 600) + ' B/f ' + k);
    console.log('   sampled allocation ' + Math.round(total / 600) + ' B/frame; top sites: ' + top.join(' | '));
    check('3d sampled allocation of a play frame ≤ 2 KB/frame (' + Math.round(total / 600) + ' B)', total / 600 <= 2048, top);
    await cdp.detach();

    // ================= 4. caps under spam =================
    for (const f of FIGHTERS) {
      await t.start(f);
      await D(d => d.warp('debug_boss', null)); await step(10); await D(d => d.god(true));
      await D(d => d.spawnBoss('proto_warden')); await step(5);
      const r = await page.evaluate(() => {
        const g = window.UB.game, d = window.UB.debug, FX = window.UB.FX;
        let maxProj = 0, maxFx = 0, maxHits = 0, hitsThisTick = 0;
        const reg = g.registerHit; g.registerHit = function (h) { hitsThisTick++; return reg.call(this, h); };
        const tick = () => { hitsThisTick = 0; g.tick(); g.render(1); maxProj = Math.max(maxProj, g.projectiles.length); maxFx = Math.max(maxFx, FX.count()); maxHits = Math.max(maxHits, hitsThisTick); };
        const run = (n) => { for (let i = 0; i < n; i++) { d.setEnergy(100); d.pressed('special', 2); for (let k = 0; k < 4; k++) tick(); } };
        run(200);
        for (let k = 0; k < 60; k++) tick();
        d.setMeter(100); d.pressed('overclock', 4); for (let k = 0; k < 40; k++) tick();
        const oc = g.player.ocActive; run(60);
        g.registerHit = reg;
        return { fighter: g.player.id, maxProj, maxFx, maxHits, oc, proj: g.projectiles.length, fx: FX.count(), state: g.player.state };
      });
      console.log('   ' + f.padEnd(9) + ' spam: max projectiles ' + r.maxProj + ', max particles ' + r.maxFx + ', max hits/frame ' + r.maxHits + ', overclock ' + r.oc);
      check('4 ' + f + ': 200 specials + 60 ultimates keep projectiles ≤ 64 (' + r.maxProj + '), particles ≤ 512 (' + r.maxFx + '), hits ≤ 64 (' + r.maxHits + '), Overclock armed', r.fighter === f && r.maxProj <= 64 && r.maxFx <= 512 && r.maxHits <= 64 && r.oc, r);
    }
    const caps = await page.evaluate(() => {
      const g = window.UB.game, FX = window.UB.FX, E = window.UB.Entity;
      FX.clear();
      for (let i = 0; i < 60; i++) FX.burst('dust', 100 + i, 100, 8);           // 480 dust
      let auraFirst = FX.count();
      for (let i = 0; i < 400; i++) FX.burst('spark', 200, 200, 16, { color: '#FF0000' });   // 6400 sparks requested
      const afterSpam = FX.count();
      for (let i = 0; i < 40; i++) { FX.update(); }
      const afterUpdate = FX.count();
      // raw projectile spawns: cap 64, oldest evicted and flagged dead
      g.dropProjectiles();
      const made = [];
      for (let i = 0; i < 200; i++) { const p = new E({ x: g.player.x, y: g.player.y - 20, w: 6, h: 6, units: 'pxf' }); p.owner = 'enemy'; p.id = i; p.update = function () { }; p.draw = function () { }; made.push(p); g.spawnProjectile(p); }
      const live = g.projectiles.length, oldestDead = made.slice(0, 136).every(p => p.dead), newestAlive = made.slice(136).every(p => !p.dead && g.projectiles.indexOf(p) >= 0);
      g.dropProjectiles();
      // 100 registered hits in one frame: the engine keeps ≤ 64 and does not throw
      let threw = null; let count = 0;
      try { for (let i = 0; i < 100; i++) { const h = E.makeHit('player'); h.x = -1000; h.y = -1000; h.w = 1; h.h = 1; h.dmg = 1; g.registerHit(h); } count = g.hitCount; g.tick(); } catch (e) { threw = String(e); }
      return { auraFirst, afterSpam, afterUpdate, live, oldestDead, newestAlive, count, threw };
    });
    check('4 particle pool: 400 spark bursts on top of 480 dust stay ≤ 512 live (' + caps.afterSpam + '), dust recycled first', caps.afterSpam <= 512 && caps.afterSpam >= 500 && caps.afterUpdate <= 512, caps);
    check('4 projectiles: 200 raw spawns keep 64 live (' + caps.live + '), the 136 evicted are flagged dead, the newest 64 stay', caps.live === 64 && caps.oldestDead && caps.newestAlive, caps);
    check('4 hits: 100 registrations in one frame are capped at 64 (' + caps.count + ') and the tick does not throw', caps.count <= 64 && caps.threw === null, caps);

    // ================= 5. feel: hitstop / shake / particles / flash per fighter =================
    const feelAll = {};
    for (const f of FIGHTERS) {
      await t.start(f);
      await D(d => d.warp('debug_room', null)); await step(10); await D(d => d.god(true)); await D(d => d.killEnemies());
      feelAll[f] = await page.evaluate(() => {
        const g = window.UB.game, d = window.UB.debug, FX = window.UB.FX, pl = g.player;
        const mk = () => g.spawnEnemy('walker', Math.floor(pl.x / 30) + 2, Math.floor((pl.y - 1) / 30), null);
        const probe = (action, frames) => {
          const e = mk(); e.hp = 999; pl.facing = 1; FX.clear(); pl.cancelMove(); pl.energy = 100;
          const r = { hitstop: 0, shake: 0, fx: 0, eflash: 0, hp0: e.hp, zoom: 0 };
          d.pressed(action, 2);
          for (let i = 0; i < frames; i++) { g.tick(); r.zoom = Math.max(r.zoom, g.zoom.t); g.render(1); r.hitstop = Math.max(r.hitstop, FX.hitstopFrames); r.shake = Math.max(r.shake, FX._shakeLeft); r.fx = Math.max(r.fx, FX.count()); r.eflash = Math.max(r.eflash, e.flash || 0); }
          r.hp = e.hp; e.dead = true; g.enemies.length = 0;
          return r;
        };
        const light = probe('light', 40);
        for (let i = 0; i < 40; i++) g.tick();
        const heavy = probe('heavy', 70);
        const mv = window.UB.Characters.DATA[pl.id].moves.heavy; heavy.sheet = { hitstop: mv.hitstop || 0, shake: !!mv.shake, local: mv.ring ? mv.ring.local : 0 };
        for (let i = 0; i < 40; i++) g.tick();
        // kill: 12 chips + shake + hitstop +2
        const e = mk(); e.hp = 1; pl.facing = 1; FX.clear(); pl.cancelMove();
        const kill = { hitstop: 0, shake: 0, fx: 0 };
        d.pressed('light', 2);
        for (let i = 0; i < 40; i++) { g.tick(); g.render(1); kill.hitstop = Math.max(kill.hitstop, FX.hitstopFrames); kill.shake = Math.max(kill.shake, FX._shakeLeft); kill.fx = Math.max(kill.fx, FX.count()); }
        kill.dead = e.dead;
        return { light, heavy, kill, id: pl.id };
      });
      const fe = feelAll[f];
      check('5 ' + f + ' light hit: damage, hitstop ≥ 3, sparks, enemy flash', fe.id === f && fe.light.hp < fe.light.hp0 && fe.light.hitstop >= 3 && fe.light.fx >= 4 && fe.light.eflash > 0, fe.light);
      const sh = fe.heavy.sheet, worldHs = sh.hitstop;
      check('5 ' + f + ' heavy hit: damage, enemy flash, particles, world hitstop = sheet (' + worldHs + '), shake iff sheet, impact zoom iff hitstop > 5', fe.heavy.hp < fe.heavy.hp0 && fe.heavy.eflash > 0 && fe.heavy.fx >= 4 && fe.heavy.hitstop === worldHs && (fe.heavy.shake > 0) === sh.shake && (fe.heavy.zoom > 0) === (worldHs > 5), fe.heavy);
      check('5 ' + f + ' kill: dead, ≥ 12 chips, shake, hitstop', fe.kill.dead && fe.kill.fx >= 12 && fe.kill.shake > 0 && fe.kill.hitstop >= 3, fe.kill);
    }
    await t.start('tessik'); await D(d => d.warp('debug_boss', null)); await step(10); await D(d => d.god(true)); await D(d => d.killEnemies());
    const feel = await page.evaluate(() => {
      const g = window.UB.game, d = window.UB.debug, FX = window.UB.FX, pl = g.player;
      const flashes = []; const of = FX.flash; FX.flash = function (c, a, f) { flashes.push([c, a, f]); return of.apply(this, arguments); };
      d.spawnBoss('proto_warden', { x: Math.floor(pl.x / 30) + 2, y: Math.floor((pl.y - 1) / 30) }); for (let i = 0; i < 2; i++) g.tick();
      FX.clear(); const boss = { hitstop: 0, shake: 0, fx: 0, hp0: g.boss.hp, bflash: 0 };
      pl.facing = 1; d.pressed('heavy', 2);
      for (let i = 0; i < 50; i++) { g.tick(); g.render(1); boss.hitstop = Math.max(boss.hitstop, FX.hitstopFrames); boss.shake = Math.max(boss.shake, FX._shakeLeft); boss.fx = Math.max(boss.fx, FX.count()); boss.bflash = Math.max(boss.bflash, g.boss.flash || 0); }
      boss.hp = g.boss.hp;
      // frozen frames: during hitstop the world canvas must not depend on alpha
      d.god(false); FX.clear(); flashes.length = 0; const hurt = { hitstop: 0, shake: 0, hp0: pl.hp, zoom: 0 };
      g.boss.x = pl.x; g.boss.px = pl.x;
      let frozenSame = null;
      for (let i = 0; i < 20; i++) {
        g.tick(); hurt.zoom = Math.max(hurt.zoom, g.zoom.t);
        if (FX.hitstopFrames > 2 && frozenSame === null) {
          g.render(1); g.render(0.0); const a = g.wctx.getImageData(0, 0, 960, 540).data; g.render(0.5); const b = g.wctx.getImageData(0, 0, 960, 540).data;
          let diff = 0; for (let k = 0; k < a.length; k += 4) if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2]) diff++;
          frozenSame = diff;
        } else g.render(1);
        hurt.hitstop = Math.max(hurt.hitstop, FX.hitstopFrames); hurt.shake = Math.max(hurt.shake, FX._shakeLeft); hurt.iframes = Math.max(hurt.iframes || 0, pl.iframes);
      }
      hurt.hp = pl.hp; hurt.flashes = flashes.slice(); hurt.frozenDiff = frozenSame;
      FX.flash = of;
      return { boss, hurt };
    });
    check('5 heavy hit on a boss: damage, hitstop ≥ 5, shake, particles, boss flash', feel.boss.hp < feel.boss.hp0 && feel.boss.hitstop >= 5 && feel.boss.shake > 0 && feel.boss.fx > 0 && feel.boss.bflash > 0, feel.boss);
    check('5 player hurt: −1 heart, hitstop 6, shake, a red screen flash, 60 i-frames, impact zoom', feel.hurt.hp === feel.hurt.hp0 - 1 && feel.hurt.hitstop >= 6 && feel.hurt.shake > 0 && feel.hurt.flashes.some(f => /ff3b3b/i.test(f[0])) && feel.hurt.iframes === 60 && feel.hurt.zoom > 0, feel.hurt);
    check('5 frozen frames: during hitstop the world canvas is identical at alpha 0 and 0.5 (' + feel.hurt.frozenDiff + ' px differ)', feel.hurt.frozenDiff === 0, feel.hurt);
    await t.shot('feel-hurt');

    // ================= 6. every room through every exit =================
    await t.start('tessik');
    const rooms = await D(d => d.rooms().filter(r => r.zone !== 'debug'));
    const zoneSig = await page.evaluate(() => { const W = window.UB.World, out = {}; const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; for (const z of window.UB.IDS.zones) { const p = W.zones[z].palette; const cs = [p.bg0, p.bg1, p.bg2, p.tileFill].map(hex); const m = [0, 1, 2].map(i => cs.reduce((a, c) => a + c[i], 0) / cs.length); const sum = m[0] + m[1] + m[2]; out[z] = m.map(v => v / sum); } return out; });
    let roomFails = 0, exitsSeen = 0; const roomStats = [];
    for (const r of rooms) {
      for (const ex of r.exits) {
        await D((d, room, exit) => d.warp(room, exit), r.id, ex.id);
        await step(45);
        s = await state();
        if (s.screen !== 'play') await D(d => d.skipTo('play'));
        const px = await page.evaluate((sig) => {
          const g = window.UB.game, wc = g.wctx, lv = g.level, pl = g.player, U = window.UB.Util;
          window.UB.UI.clearMessages(); pl.iframes = 0; g.render(1);
          const img = wc.getImageData(0, 0, 960, 540).data; const colors = new Set(); let sr = 0, sg = 0, sb = 0, n = 0;
          for (let y = 10; y < 540; y += 20) for (let x = 10; x < 960; x += 20) { const i = (y * 960 + x) * 4; colors.add((img[i] >> 3) + ',' + (img[i + 1] >> 3) + ',' + (img[i + 2] >> 3)); sr += img[i]; sg += img[i + 1]; sb += img[i + 2]; n++; }
          const sum = Math.max(1, sr + sg + sb); const mean = [sr / sum, sg / sum, sb / sum]; let bestZ = null, bestD = 1e9;
          for (const z in sig) { const d = Math.hypot(mean[0] - sig[z][0], mean[1] - sig[z][1], mean[2] - sig[z][2]); if (d < bestD) { bestD = d; bestZ = z; } }
          const tc = lv.tileCache.getContext('2d'); const tw = lv.tileCache.width, th = lv.tileCache.height; const td = tc.getImageData(0, 0, tw, th).data; let painted = 0;
          for (let i = 3; i < td.length; i += 4 * 97) if (td[i] > 0) painted++;
          // the player is drawn: the region around it changes when its draw is stubbed
          const cx = Math.round(U.lerp(g.cam.px, g.cam.x, 1)), cy = Math.round(U.lerp(g.cam.py, g.cam.y, 1));
          const sx = Math.max(0, Math.round(pl.x - cx) - 40), sy = Math.max(0, Math.round(pl.y - cy) - 70), sw = Math.min(960 - sx, 80), sh = Math.min(540 - sy, 90);
          const withP = wc.getImageData(sx, sy, sw, sh).data;
          const od = pl.draw; pl.draw = function () { }; g.render(1); const withoutP = wc.getImageData(sx, sy, sw, sh).data; pl.draw = od;
          let pdiff = 0; for (let i = 0; i < withP.length; i += 4) if (withP[i] !== withoutP[i] || withP[i + 1] !== withoutP[i + 1] || withP[i + 2] !== withoutP[i + 2]) pdiff++;
          // every on-screen enemy is drawn (its box region changes when its draw is stubbed)
          let enemiesOn = 0, enemiesDrawn = 0; const missing = [];
          for (let k = 0; k < g.enemies.length; k++) {
            const e = g.enemies[k]; const ex0 = Math.round(e.x - cx), ey0 = Math.round(e.y - cy);
            if (ex0 < 20 || ex0 > 940 || ey0 < 20 || ey0 > 520) continue;
            enemiesOn++;
            const bx = Math.max(0, ex0 - 40), by = Math.max(0, ey0 - 60), bw = Math.min(960 - bx, 80), bh = Math.min(540 - by, 80);
            g.render(1); const a = wc.getImageData(bx, by, bw, bh).data; const oe = e.draw; e.draw = function () { }; g.render(1); const b = wc.getImageData(bx, by, bw, bh).data; e.draw = oe;
            let dd = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) dd++;
            if (dd >= 30) enemiesDrawn++; else missing.push(e.type + '@' + ex0 + ',' + ey0 + ':' + dd);
          }
          g.render(1);
          return { colors: colors.size, nearest: bestZ, painted, zone: g.zone.id, cache: tw + 'x' + th, pdiff, enemiesOn, enemiesDrawn, missing };
        }, zoneSig);
        await page.screenshot({ path: path.join(SHOTS, 'qa-perf-room-' + r.id + '-' + ex.id + '.png') });
        exitsSeen++;
        const ok = s.roomId === r.id && s.screen === 'play' && px.colors >= 12 && px.painted > 0 && px.nearest === r.zone && px.zone === r.zone && px.pdiff >= 100 && px.enemiesDrawn === px.enemiesOn;
        if (!ok) { roomFails++; console.log('   room ' + r.id + ' exit ' + ex.id + ' problem: ' + JSON.stringify({ s: { roomId: s.roomId, screen: s.screen, mode: s.mode }, px })); }
        roomStats.push(r.id + '/' + ex.id + ':' + px.colors + 'c/p' + px.pdiff + '/e' + px.enemiesDrawn + '-' + px.enemiesOn);
      }
    }
    check('6 every real room through every exit renders (not blank, tiles painted, zone palette, player drawn, on-screen enemies drawn) — ' + exitsSeen + ' exits, ' + roomFails + ' problems', exitsSeen >= 50 && roomFails === 0, roomStats);
    // HUD overlap on arrival: when the player's body sits under the HUD block (24..210 × 22..115) on arrival through an exit
    // (the camera is pinned to the room's top-left corner there) the hearts/energy/meter block must dim (DESIGN §12.1: α 0.35)
    const hudOverlap = [], hudDimmed = [];
    for (const r of rooms) for (const ex of r.exits) {
      await D((d, room, exit) => d.warp(room, exit), r.id, ex.id); await step(45);
      const o = await page.evaluate(() => { const g = window.UB.game, pl = g.player; for (let i = 0; i < 30; i++) g.render(1); const cx = Math.round(g.cam.x), cy = Math.round(g.cam.y); const bx = pl.x - pl.w / 2 - cx, by = pl.y - pl.h - cy; return { bx: Math.round(bx), by: Math.round(by), w: pl.w, h: pl.h, over: bx < 210 && bx + pl.w > 24 && by < 115 && by + pl.h > 22, hudAlpha: window.UB.UI.hudAlpha }; });
      if (o.over) { hudOverlap.push(r.id + '.' + ex.id + '@' + o.bx + ',' + o.by + ' α' + o.hudAlpha.toFixed(2)); if (o.hudAlpha > 0.4) hudDimmed.push(r.id + '.' + ex.id + ' α' + o.hudAlpha.toFixed(2)); }
      else if (o.hudAlpha < 0.99) hudDimmed.push(r.id + '.' + ex.id + ' dimmed while clear α' + o.hudAlpha.toFixed(2));
    }
    console.log('   arrivals where the player stands under the HUD block (the block dims to α 0.35 there): ' + (hudOverlap.length ? hudOverlap.join(' ') : 'none'));
    check('6 arrival spawns: whenever the player stands under the HUD hearts/energy/meter block 45 f after arriving the block has dimmed to α ≤ 0.4 (and is opaque when the player is clear)', hudDimmed.length === 0, hudDimmed);

    // ================= 7. no placeholder art: every rig draws with colour + outline, not a rectangle =================
    await D(d => d.warp('debug_room', null)); await step(5); await D(d => d.killEnemies());
    const rigs = await page.evaluate(() => {
      const g = window.UB.game, out = [], IDS = window.UB.IDS, Rn = window.UB.Render;
      const c = Rn.makeCanvas(240, 240), ctx = c.getContext('2d');
      const hexInk = [0x14, 0x10, 0x18];
      function analyse(name, drawFn) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 240, 240);
        ctx.save(); ctx.translate(120, 180); try { drawFn(ctx); } catch (e) { out.push({ name, err: String(e) }); ctx.restore(); return; } ctx.restore();
        const d = ctx.getImageData(0, 0, 240, 240).data; const cols = new Set(); let ink = 0, minx = 240, maxx = 0, miny = 240, maxy = 0, filled = 0;
        for (let y = 0; y < 240; y++) for (let x = 0; x < 240; x++) { const i = (y * 240 + x) * 4; if (d[i + 3] < 40) continue; filled++; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; cols.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4)); if (Math.abs(d[i] - hexInk[0]) < 24 && Math.abs(d[i + 1] - hexInk[1]) < 24 && Math.abs(d[i + 2] - hexInk[2]) < 24) ink++; }
        const bw = maxx - minx + 1, bh = maxy - miny + 1; const cover = filled / Math.max(1, bw * bh);
        out.push({ name, colors: cols.size, ink, bw, bh, cover: Math.round(cover * 100) / 100, filled });
      }
      const spawnFor = { brinejelly: { type: 'brinejelly' } };
      const types = IDS.enemies.filter(t => t !== 'walker' && t !== 'mote');
      const variants = { scuttlebit: ['brinecrab', 'staticshot', 'rootbound'], hopnode: ['dripnode', 'nullnode'], glarewisp: ['rootwisp'], spitvalve: ['acidvalve', 'twinvalve'], rambyte: ['rootram'], platewalker: ['rootplate'] };
      const room = g.level.room;
      const draws = [];
      for (const ty of types) { draws.push([ty, { type: ty, x: 10, y: 10 }]); for (const v of (variants[ty] || [])) draws.push([ty + ':' + v, { type: ty, variant: v, x: 10, y: 10 }]); }
      for (const [name, sp] of draws) {
        const e = window.UB.Enemies.create(sp.type, sp, room, g);
        if (!e) { out.push({ name, err: 'create returned null' }); continue; }
        e.x = e.px = 0; e.y = e.py = 0; e.facing = 1;
        analyse('enemy ' + name, (cx) => e.draw(cx, g, 1));
      }
      for (const b of IDS.bosses) {
        const spec = { id: b, bounds: [0, room.w - 1], seal: [], locked: [], final: b === 'kernauth', pickup: { x: 5, y: 10 }, spawn: { x: 10, y: 10 } };
        const bs = window.UB.Bosses.create(b, room, g, spec); if (!bs) { out.push({ name: 'boss ' + b, err: 'null' }); continue; }
        bs.x = bs.px = 0; bs.y = bs.py = 0; bs.facing = 1;
        analyse('boss ' + b, (cx) => bs.draw(cx, g, 1));
      }
      for (const f of IDS.fighters) {
        const pl = window.UB.Characters.create(f, g); pl.abilities = { echoJump: false, burstLine: false, gripProtocol: false }; pl.x = pl.px = 0; pl.y = pl.py = 0; pl.facing = 1; pl.iframes = 0;
        analyse('fighter ' + f, (cx) => pl.draw(cx, g, 1));
      }
      return out;
    });
    const noOutline = /glarewisp/;   // DESIGN §7.4: the wisp is a bare eye-orb (core / halo / pupil, no outline colour)
    const rigBad = rigs.filter(r => r.err || r.colors < 5 || (r.ink < 20 && !noOutline.test(r.name)) || r.cover > 0.96 || r.filled < 150);
    check('7 every rig (' + rigs.length + ': enemies + variants, bosses, fighters) draws ≥ 5 colours with an INK outline (wisps excepted) and is not a filled rectangle', rigs.length >= 25 && rigBad.length === 0, rigBad.length ? rigBad : rigs.map(r => r.name + ':' + r.colors + 'c'));

    // ================= 8. screens and overlays =================
    await t.start('tessik'); await D(d => d.warp('dc_shrine', null)); await step(5);
    const notBlank = () => page.evaluate(`(function () { const g = window.UB.game; g.render(1); return ${COLOR_COUNT}(g.mctx, 960, 540); })()`);
    for (const sc of ['pause', 'map', 'settings', 'shop', 'lore']) {
      await D((d, x) => d.skipTo(x), sc); await step(30);
      s = await state(); const c = await notBlank(); await t.shot('screen-' + sc);
      check('8 overlay ' + sc + ' opens and draws (' + c + ' colours)', s.screen === sc && c >= 6, { screen: s.screen, c });
      await D(d => d.skipTo('play')); await step(2);
    }
    // text fits: shop effect lines inside the panel (230..730), lore wrapped lines ≤ 5 and ≤ 560 px, bios ≤ 4 lines of ≤ 490 px
    const fits = await page.evaluate(() => {
      const g = window.UB.game, ctx = g.mctx, U = window.UB.Util, out = { shop: [], lore: [], bios: [], cont: null };
      ctx.font = window.UB.font(12, 'MONO');
      for (const it of window.UB.IDS.vendorItems) out.shop.push({ id: it.id, w: Math.ceil(ctx.measureText(it.effect).width) });
      ctx.font = window.UB.font(13, 'MONO');
      for (const z of window.UB.IDS.zones) { const lines = U.wrapText(ctx, window.UB.World.zones[z].lore || '', 560); out.lore.push({ z, n: lines.length, w: Math.ceil(Math.max.apply(null, lines.map(l => ctx.measureText(l).width).concat([0]))) }); }
      ctx.font = window.UB.font(11, 'MONO');
      for (const f of window.UB.Characters.list) { const lines = U.wrapText(ctx, f.bio || '', 490); out.bios.push({ id: f.id, n: lines.length, w: Math.ceil(Math.max.apply(null, lines.map(l => ctx.measureText(l).width).concat([0]))) }); }
      return out;
    });
    check('8 shop effect lines fit the panel (x 260 → ≤ 720)', fits.shop.every(s => 260 + s.w <= 720), fits.shop);
    check('8 lore paragraphs wrap to ≤ 5 lines of ≤ 560 px', fits.lore.every(l => l.n >= 1 && l.n <= 5 && l.w <= 560), fits.lore);
    check('8 fighter bios wrap to ≤ 4 lines of ≤ 490 px', fits.bios.every(b => b.n >= 1 && b.n <= 4 && b.w <= 490), fits.bios);
    // map footer: the cursor room's bestiary line (centred at 480, 11px MONO) must stay clear of the legend (left) and 'R recentre · Esc / M close' (right)
    const realRooms = (await D(d => d.rooms().filter(r => r.zone !== 'debug'))).map(r => r.id);
    const footer = [];
    for (const id of realRooms) {
      await D((d, r) => d.warp(r, null), id); await step(3);
      await D(d => d.skipTo('map')); await step(2);
      footer.push(await page.evaluate((id) => {
        const g = window.UB.game, UI = window.UB.UI, ctx = g.mctx; g.render(1);
        ctx.font = window.UB.font(11, 'MONO');
        const legendR = 60 + ctx.measureText('◆ node  ● boss  ⬢ vendor  · you').width;
        const rightL = 900 - ctx.measureText('Esc / M close').width - 18 - ctx.measureText('R recentre').width;
        const w = ctx.measureText(UI.mapBestiary || '').width;
        return { id, line: UI.mapBestiary, w: Math.ceil(w), left: Math.round(480 - w / 2), right: Math.round(480 + w / 2), legendR: Math.ceil(legendR), rightL: Math.floor(rightL) };
      }, id));
      await D(d => d.skipTo('play')); await step(2);
    }
    const footerBad = footer.filter(f => f.left < f.legendR + 8 || f.right > f.rightL - 8);
    check('8 map footer: every room\'s bestiary line fits between the legend and the close/recentre hints (' + footerBad.length + ' overlap)', footer.length === realRooms.length && footerBad.length === 0, footerBad.length ? footerBad : footer.map(f => f.id + ':' + f.w));
    await D(d => d.skipTo('gameover')); s = await state(); for (let i = 0; i < 100 && !(s.screen === 'gameover' && !s.busy); i++) { await step(5); s = await state(); } await step(40);
    check('8 game over screen draws', s.screen === 'gameover' && (await notBlank()) >= 2, s.screen); await t.shot('screen-gameover');
    await D(d => d.skipTo('play')); await step(2);
    await D(d => d.skipTo('victory')); s = await state(); for (let i = 0; i < 100 && !(s.screen === 'victory' && !s.busy); i++) { await step(5); s = await state(); } await step(120);
    check('8 victory screen draws', s.screen === 'victory' && (await notBlank()) >= 6, s.screen); await t.shot('screen-victory');
    await D(d => d.toTitle()); await step(60); s = await state();
    check('8 title screen draws (with a save: CONTINUE enabled)', s.screen === 'title' && s.hasSave && (await notBlank()) >= 6, s); await t.shot('screen-title');
    await D(d => d.skipTo('select')); await step(60); s = await state();
    check('8 select screen draws', s.screen === 'select' && (await notBlank()) >= 6, s.screen); await t.shot('screen-select');
    // boss title card + bar in the real flow
    await t.start('tessik'); await D(d => d.warp('dc_sentinel', 'L')); await step(5);
    for (let i = 0; i < 40 && (await state()).mode !== 'bossIntro'; i++) await step(5);
    await step(60); s = await state(); await t.shot('screen-boss-card');
    check('8 boss intro card shows (mode bossIntro, card timer running)', s.mode === 'bossIntro' && (await page.evaluate(() => window.UB.UI.cardT > 0)), s.mode);
    await step(120); s = await state();
    const barPx = await page.evaluate(() => { const g = window.UB.game; g.render(1); const d = g.mctx.getImageData(200, 500, 1, 1).data; return { r: d[0], g: d[1], b: d[2] }; });
    check('8 boss HP bar drawn once the fight starts (red fill at 200,500)', s.bossFight === 'fight' && barPx.r > 150 && barPx.r > barPx.g + 60, { s: s.bossFight, barPx }); await t.shot('screen-boss-fight');

    // ================= 9. camera under the real rAF loop, transition, parallax =================
    await t.start('tessik'); await D(d => d.warp('dc_cross', null)); await step(5); await D(d => d.killEnemies()); await D(d => d.god(true));
    await D(d => d.teleport(400, 450)); await step(40);
    const jit = await page.evaluate(() => new Promise((resolve) => {
      const g = window.UB.game, d = window.UB.debug, U = window.UB.Util, FX = window.UB.FX;
      const rec = []; const origRender = g.render;
      g.render = function (alpha) { const cx = Math.round(U.lerp(g.cam.px, g.cam.x, alpha) + FX.shakeX); const px = U.lerp(g.player.px, g.player.x, alpha); rec.push({ a: alpha, cx, px, sx: px - cx, f: g.frame, st: g.player.state, t: performance.now() }); return origRender.call(this, alpha); };
      d.pressed('right', 240); d.pauseLogic(false);
      let n = 0; const tick = () => { if (++n >= 120) { d.pauseLogic(true); g.render = origRender; resolve(rec); } else requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }));
    const body = jit.slice(5, 115);
    let backPx = 0, camBackWhileRunning = 0, bigScreenStep = 0, moving = 0, maxStep = 0, dupFrames = 0;
    for (let i = 1; i < body.length; i++) { const dpx = body[i].px - body[i - 1].px, dcx = body[i].cx - body[i - 1].cx, dsx = Math.abs(body[i].sx - body[i - 1].sx); if (dpx < -0.01) backPx++; if (dpx > 0.5) { moving++; if (dcx < 0) camBackWhileRunning++; } if (dsx > 6) bigScreenStep++; maxStep = Math.max(maxStep, dsx); if (body[i].f === body[i - 1].f && body[i].a === body[i - 1].a) dupFrames++; }
    const logicFrames = body[body.length - 1].f - body[0].f;
    console.log('   rAF loop: ' + body.length + ' renders, ' + logicFrames + ' logic frames, ' + moving + ' moving renders, max on-screen step ' + r2(maxStep) + ' px');
    check('9a rAF loop: player interpolation never steps backwards while running right (' + moving + ' moving renders, ' + backPx + ' back-steps)', body.length >= 100 && moving >= 20 && backPx === 0, { backPx, moving, n: body.length });
    check('9b rAF loop: camera never steps backwards while the player runs (' + camBackWhileRunning + ') and the player never jumps > 6 px on screen (max ' + r2(maxStep) + ')', camBackWhileRunning === 0 && bigScreenStep === 0, { camBackWhileRunning, bigScreenStep, maxStep });
    check('9c rAF loop ticks logic at ~60 Hz while rendering (' + logicFrames + ' logic frames over ' + body.length + ' renders)', logicFrames >= body.length * 0.5 && logicFrames <= body.length * 2.5, { logicFrames, renders: body.length });
    // vertical: fall down dc_fall under the stepped loop; the interpolated camera y never steps backwards and never jumps > 20 px
    await D(d => d.warp('dc_fall', 'L')); await step(10); await D(d => d.god(true));
    const shaft = await page.evaluate(() => { const g = window.UB.game, r = g.level.room, T = r.tiles; let best = { len: 0, x: 0, y0: 0 }; for (let x = 1; x < r.w - 1; x++) { let run = 0, start = 0; for (let y = 0; y <= r.h; y++) { const air = y < r.h && T[y][x] === '.'; if (air) { if (!run) start = y; run++; } else { if (run > best.len) best = { len: run, x, y0: start }; run = 0; } } } g.player.place(best.x * 30 + 15, (best.y0 + 2) * 30, {}); g.snapCamera(); return best; });
    const vert = await page.evaluate(() => { const g = window.UB.game, U = window.UB.Util, out = []; for (let i = 0; i < 150; i++) { g.tick(); for (const a of [0.25, 0.5, 0.75, 1]) { out.push({ cy: Math.round(U.lerp(g.cam.py, g.cam.y, a)), py: U.lerp(g.player.py, g.player.y, a), vy: g.player.vy, ground: g.player.onGround }); } } return out; });
    let camBackY = 0, camBigY = 0, falling = 0;
    for (let i = 1; i < vert.length; i++) { if (vert[i].vy > 100 && !vert[i].ground && vert[i - 1].vy > 100) { falling++; const d = vert[i].cy - vert[i - 1].cy; if (d < 0) camBackY++; if (d > 12) camBigY++; } }
    console.log('   dc_fall shaft: column ' + shaft.x + ', ' + shaft.len + ' air tiles; ' + falling + ' falling quarter-frames');
    check('9d falling down dc_fall\'s longest shaft: the interpolated camera y never steps up (' + camBackY + ') or jumps > 12 px per quarter frame (' + camBigY + ') over ' + falling + ' falling renders', falling >= 40 && camBackY === 0 && camBigY === 0, { camBackY, camBigY, falling, shaft });
    // room transition composite: mid-slide render, then arrival
    await D(d => d.warp('dc_wake', null)); await step(5);
    await page.evaluate(() => { const g = window.UB.game, ex = window.UB.World.exit(g.level.room, 'R'); g.startTransition(ex); });
    await step(6 + 8); s = await state(); const trC = await notBlank(); await t.shot('transition-right-mid');
    const seamPx = await page.evaluate(() => { const g = window.UB.game, tr = g.transition, U = window.UB.Util, T = window.UB.Engine.T; g.render(1); const k = U.easeOutCubic(1 - tr.timer / T.slide); const sx = Math.round(tr.dx > 0 ? 960 * (1 - k) : 960 * k); const d = g.mctx.getImageData(Math.max(0, Math.min(959, sx)), 300, 1, 1).data; return { sx, dx: tr.dx, r: d[0], g: d[1], b: d[2], phase: tr.phase }; });
    await step(30); const s2 = await state();
    check('9e room transition: slide composite draws (' + trC + ' colours), the ink seam is at the slide edge, lands in dc_fall', s.transition && trC >= 6 && seamPx.phase === 'slide' && seamPx.r < 40 && seamPx.g < 40 && seamPx.b < 40 && s2.roomId === 'dc_fall' && s2.mode === 'normal', { s: s.mode, seamPx, s2: s2.roomId });
    // parallax wrap seams
    const seams = await page.evaluate(() => {
      const R = window.UB.Render, W = window.UB.World, out = [];
      for (const z of window.UB.IDS.zones) { const zone = W.zones[z];
        for (const [k, fx, fy] of [['bg1', 0.25, 0.125], ['bg2', 0.5, 0.25]]) {
          let camY = ((-450) / fy) % (720 / fy); if (camY < 0) camY += 720 / fy;
          let camX = ((-480) / fx) % (1280 / fx); if (camX < 0) camX += 1280 / fx;
          const w = document.createElement('canvas'); w.width = 960; w.height = 540; const wc = w.getContext('2d');
          R.drawBackground(wc, zone, camX, camY);
          const img = wc.getImageData(0, 0, 960, 540).data;
          const rd = []; for (let y = 0; y < 539; y++) { let s = 0; for (let px = 0; px < 960; px += 2) { const i = (y * 960 + px) * 4, j = ((y + 1) * 960 + px) * 4; s += Math.abs(img[i] - img[j]) + Math.abs(img[i + 1] - img[j + 1]) + Math.abs(img[i + 2] - img[j + 2]); } rd.push(s / 480); }
          const cd = []; for (let x = 0; x < 959; x++) { let s = 0; for (let py = 0; py < 540; py += 2) { const i = (py * 960 + x) * 4, j = (py * 960 + x + 1) * 4; s += Math.abs(img[i] - img[j]) + Math.abs(img[i + 1] - img[j + 1]) + Math.abs(img[i + 2] - img[j + 2]); } cd.push(s / 270); }
          const seamY = Math.round((((-camY * fy - 180) % 720) + 720) % 720), seamX = Math.round((((-camX * fx) % 1280) + 1280) % 1280);
          const rs = rd.slice().sort((a, b) => a - b), cs = cd.slice().sort((a, b) => a - b);
          const atRow = Math.max(rd[seamY - 1] || 0, rd[seamY] || 0, rd[seamY + 1] || 0), atCol = Math.max(cd[seamX - 1] || 0, cd[seamX] || 0, cd[seamX + 1] || 0);
          out.push({ z, k, seamY, seamX, atRow: +atRow.toFixed(1), rowP99: +rs[Math.floor(rs.length * 0.99)].toFixed(1), atCol: +atCol.toFixed(1), colP99: +cs[Math.floor(cs.length * 0.99)].toFixed(1) });
        } }
      return out;
    });
    const seamBad = seams.filter(x => x.atRow > Math.max(x.rowP99 * 1.5, 8) || x.atCol > Math.max(x.colP99 * 1.5, 8));
    check('9f parallax layers wrap without a visible seam — ' + seamBad.length + ' bad of ' + seams.length, seamBad.length === 0, seamBad.length ? seamBad : seams);
    // ambient layer + fog + vignette never leave the context state changed (globalAlpha / composite)
    const ctxState = await page.evaluate(() => { const g = window.UB.game; g.render(1); const wc = g.wctx, mc = g.mctx; return { wa: wc.globalAlpha, wo: wc.globalCompositeOperation, ma: mc.globalAlpha, mo: mc.globalCompositeOperation }; });
    check('9g a frame leaves both contexts at globalAlpha 1 / source-over', ctxState.wa === 1 && ctxState.wo === 'source-over' && ctxState.ma === 1 && ctxState.mo === 'source-over', ctxState);

    // ================= 10. letterbox / resize / backing scale =================
    for (const vp of [[800, 600], [500, 900], [3000, 400], [320, 180], [1440, 810], [1920, 1080]]) {
      await page.setViewportSize({ width: vp[0], height: vp[1] }); await page.waitForTimeout(120);
      const r = await page.evaluate(() => { const c = document.getElementById('game'); const r = c.getBoundingClientRect(); const g = window.UB.game, lv = g.level; return { iw: window.innerWidth, ih: window.innerHeight, w: r.width, h: r.height, left: r.left, top: r.top, right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom, backing: c.width + 'x' + c.height, dpr: g.dpr, rscale: window.UB.Render.scale, cacheScale: lv.cacheScale, cache: lv.tileCache.width + 'x' + lv.tileCache.height, roomW: lv.room.w * 30, roomH: lv.room.h * 30 }; });
      const s = Math.min(vp[0] / 960, vp[1] / 540);
      const wantScale = Math.max(1, Math.min(2, Math.floor(s * 2) / 2));
      const ratioOk = Math.abs(r.w / r.h - 16 / 9) < 0.01, centred = Math.abs(r.left - r.right) <= 2 && Math.abs(r.top - r.bottom) <= 2, fills = Math.abs(r.w - r.iw) <= 2 || Math.abs(r.h - r.ih) <= 2;
      const backingOk = r.backing === Math.round(960 * wantScale) + 'x' + Math.round(540 * wantScale) && r.dpr === wantScale && r.rscale === wantScale && r.cacheScale === wantScale && r.cache === (r.roomW * wantScale) + 'x' + (r.roomH * wantScale);
      check('10 letterbox at ' + vp.join('x') + ': 16:9, centred, fills the limiting side, backing scale ' + wantScale + ' (' + r.backing + ', tile cache ' + r.cache + ')', ratioOk && centred && fills && backingOk, r);
      if (vp[0] === 1920) await t.shot('letterbox-1920x1080');
      if (vp[0] === 1440) await t.shot('letterbox-1440x810');
    }
    await page.setViewportSize({ width: 800, height: 600 }); await page.waitForTimeout(100); await t.shot('letterbox-800x600');
    await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(100);
    const errsNow = t.errors.length;
    check('11a no console / page errors in the DPR 1 session so far', errsNow === 0, t.errors);
    // DPR 1 reference cost for the DPR 2 comparison (same room, same probe, quiet)
    await t.start('tessik'); await D(d => d.warp('dc_cross', null)); await step(30); await D(d => d.god(true));
    const ref1 = await measure(page, 3, 120, null);
    const edge1 = await page.evaluate(() => { const g = window.UB.game, lv = g.level, s = lv.cacheScale; const c = lv.tileCache.getContext('2d'); const room = lv.room; let tx = -1, ty = -1; outer: for (let y = 1; y < room.h; y++) for (let x = 1; x < room.w - 1; x++) if (room.tiles[y][x] === '#' && room.tiles[y - 1][x] === '.' && room.tiles[y][x - 1] === '#' && room.tiles[y][x + 1] === '#') { tx = x; ty = y; break outer; } if (tx < 0) return null; const col = c.getImageData(Math.round((tx * 30 + 15) * s), Math.round((ty * 30 - 6) * s), 1, Math.round(16 * s)).data; let run = 0, best = 0; for (let i = 0; i < col.length; i += 4) { const ink = col[i + 3] > 100 && col[i] < 60 && col[i + 1] < 60 && col[i + 2] < 60; if (ink) { run++; if (run > best) best = run; } else run = 0; } return { tx, ty, inkRun: best, scale: s }; });

    // ================= 11. DPR 2 =================
    const t2 = await makePage(browser, { deviceScaleFactor: 2 });
    await t2.start('tessik');
    const info = await t2.page.evaluate(() => { const g = window.UB.game, c = document.getElementById('game'); return { dpr: window.devicePixelRatio, gdpr: g.dpr, canvas: c.width + 'x' + c.height, css: c.style.width + '/' + c.style.height, world: g.world.width + 'x' + g.world.height, snap: g.snap.width + 'x' + g.snap.height, rscale: window.UB.Render.scale, cacheScale: g.level.cacheScale, cache: g.level.tileCache.width + 'x' + g.level.tileCache.height }; });
    check('11b DPR 2: backing canvas 1920x1080, CSS 1280px, world + snap canvases 1920x1080, Render scale 2, tile cache at scale 2', info.dpr === 2 && info.gdpr === 2 && info.canvas === '1920x1080' && info.css === '1280px/720px' && info.world === '1920x1080' && info.snap === '1920x1080' && info.rscale === 2 && info.cacheScale === 2, info);
    await t2.D(d => d.warp('dc_cross', null)); await t2.step(30); await t2.D(d => d.god(true));
    await t2.shot('dpr2-dc_cross');
    const edge2 = await t2.page.evaluate(() => { const g = window.UB.game, lv = g.level, s = lv.cacheScale; const c = lv.tileCache.getContext('2d'); const room = lv.room; let tx = -1, ty = -1; outer: for (let y = 1; y < room.h; y++) for (let x = 1; x < room.w - 1; x++) if (room.tiles[y][x] === '#' && room.tiles[y - 1][x] === '.' && room.tiles[y][x - 1] === '#' && room.tiles[y][x + 1] === '#') { tx = x; ty = y; break outer; } if (tx < 0) return null; const col = c.getImageData(Math.round((tx * 30 + 15) * s), Math.round((ty * 30 - 6) * s), 1, Math.round(16 * s)).data; let run = 0, best = 0; for (let i = 0; i < col.length; i += 4) { const ink = col[i + 3] > 100 && col[i] < 60 && col[i + 1] < 60 && col[i + 2] < 60; if (ink) { run++; if (run > best) best = run; } else run = 0; } return { tx, ty, inkRun: best, scale: s }; });
    console.log('   tile top edge INK run: DPR 1 ' + (edge1 && edge1.inkRun) + ' px, DPR 2 ' + (edge2 && edge2.inkRun) + ' device px');
    check('11c DPR 2 tile cache is drawn at scale (the 3 px INK tile edge is ~6 device px tall: ' + (edge2 && edge2.inkRun) + ' vs ' + (edge1 && edge1.inkRun) + ' at DPR 1)', edge1 && edge2 && edge1.inkRun >= 2 && edge1.inkRun <= 4 && edge2.inkRun >= 5 && edge2.inkRun <= 8, { edge1, edge2 });
    const ref2 = await measure(t2.page, 3, 120, null);
    const ratio = ref2.med / Math.max(0.5, ref1.med);
    console.log('   dc_cross quiet frame: DPR 1 median ' + r2(ref1.med) + ' ms, DPR 2 median ' + r2(ref2.med) + ' ms (×' + r2(ratio) + '; pixel count is ×4)');
    check('11d DPR 2 frame cost scales no worse than the pixel count (≤ 4.5× DPR 1): ×' + r2(ratio), ratio <= 4.5, { ref1: ref1.runs, ref2: ref2.runs });
    const busy2 = await (async () => { await t2.D(d => d.warp('rw_gate', null)); await t2.step(30); return measure(t2.page, 3, 300, { move: true, light: true, jump: true }); })();
    console.log('   DPR 2 rw_gate (moving + attacking): median ' + r2(busy2.med) + ' ms, p99 ' + r2(busy2.p99) + ' (runs ' + busy2.runs.join(' | ') + ')');
    check('11e DPR 2 busiest room frame cost stays within ~3× the DPR 1 budget (median < 25 ms: ' + r2(busy2.med) + ', pixel count ×4; software raster)', busy2.med < 25 && busy2.reentries === 0, busy2);
    const big2 = await (async () => { await t2.D(d => d.warp('ns_climb', null)); await t2.step(5); return t2.page.evaluate(() => { const g = window.UB.game; return { cacheScale: g.level.cacheScale, cache: g.level.tileCache.width + 'x' + g.level.tileCache.height }; }); })();
    check('11f DPR 2: the tallest room (ns_climb) keeps a scale-2 tile cache under the 16 MP cap', big2.cacheScale === 2 && big2.cache === '2880x4320', big2);
    // resize at DPR 2 keeps the letterbox and the backing cap of 2
    for (const vp of [[640, 360], [1000, 1000]]) {
      await t2.page.setViewportSize({ width: vp[0], height: vp[1] }); await t2.page.waitForTimeout(120);
      const r = await t2.page.evaluate(() => { const c = document.getElementById('game'); const r = c.getBoundingClientRect(); const g = window.UB.game; return { w: r.width, h: r.height, left: r.left, right: window.innerWidth - r.right, top: r.top, bottom: window.innerHeight - r.bottom, backing: c.width + 'x' + c.height, dpr: g.dpr, cacheScale: g.level.cacheScale }; });
      const s = Math.min(vp[0] / 960, vp[1] / 540); const want = Math.max(1, Math.min(2, Math.floor(2 * s * 2) / 2));
      check('11g DPR 2 resize to ' + vp.join('x') + ': letterbox 16:9 centred, backing scale ' + want + ' (' + r.backing + ')', Math.abs(r.w / r.h - 16 / 9) < 0.01 && Math.abs(r.left - r.right) <= 2 && Math.abs(r.top - r.bottom) <= 2 && r.dpr === want && r.cacheScale === want, r);
    }
    check('11h no console / page errors in the DPR 2 session', t2.errors.length === 0, t2.errors);
    await t2.ctx.close();
  } catch (e) {
    check('unexpected exception: ' + (e && e.message ? e.message : String(e)), false, e && e.stack);
  }
  check('no console / page errors (DPR 1 session, whole run)', t.errors.length === 0, t.errors);
  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed` + (failed.length ? ' — FAILED: ' + failed.map(f => f.name).join(' ; ') : ''));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
