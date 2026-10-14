/*
 * UNDERBYTE — test/smoke.cjs
 * Engine skeleton smoke test (Playwright, headless Chromium, file:// index.html).
 * Run:  node underbyte/test/smoke.cjs      (exit code 0 = all PASS)
 *
 * Drives the game through window.UB.debug (CONTRACT.md §9) with logic paused
 * and stepped deterministically, plus real keyboard events for the screen
 * flow. Prints a PASS/FAIL line per check and asserts the page produced no
 * console errors or uncaught exceptions.
 */
const { launch } = require('./harness.cjs');

const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok, info });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info) : ''));
}
function expectNear(name, got, want, tol, info) { check(name + ' (' + got + ' ≈ ' + want + ')', Math.abs(got - want) <= tol, info); }

(async () => {
  const t = await launch();
  const page = t.page;
  const D = (fn, ...args) => page.evaluate(({ src, args }) => {
    const f = new Function('d', 'args', 'return (' + src + ')(d, ...args)');
    return f(window.UB.debug, args);
  }, { src: fn.toString(), args });
  const state = () => page.evaluate(() => window.UB.debug.state());
  const step = (n) => page.evaluate((n) => window.UB.debug.step(n), n);
  // Hold an action for `frames` logic frames and advance that many frames (+ settle).
  const holdStep = (action, frames, extra = 0) => page.evaluate(({ action, frames, extra }) => {
    window.UB.debug.pressed(action, frames); window.UB.debug.step(frames + extra); return window.UB.debug.state();
  }, { action, frames, extra });
  // Face +x then light-attack (2 f press, `extra` frames of follow-through).
  const lightRight = (extra = 14) => page.evaluate((extra) => {
    window.UB.debug.pressed('right', 1); window.UB.debug.step(1);
    window.UB.debug.pressed('light', 2); window.UB.debug.step(2 + extra); return window.UB.debug.state();
  }, extra);
  const energyOk = (e) => e >= 50 && e < 53; // 50 at spawn + 3/s regen during the few frames stepped
  // Step until predicate(state) is true (max frames); returns the state.
  async function stepUntil(pred, max, chunk = 5) {
    let s = await state();
    for (let i = 0; i < max && !pred(s); i += chunk) { await step(chunk); s = await state(); }
    return s;
  }
  async function keyTap(key) { await page.keyboard.down(key); await step(1); await page.keyboard.up(key); await step(1); }

  try {
    // ---------- boot ----------
    await page.evaluate(() => localStorage.removeItem('underbyte.save'));
    await page.reload(); await page.waitForTimeout(250);
    await D(d => d.pauseLogic(true));
    let s = await state();
    check('boots to title screen', s.screen === 'title', s);
    const errs = await page.evaluate(() => window.UB.debug.worldErrors());
    check('world data validates', errs.length === 0, errs);

    // ---------- title → select → play by keyboard ----------
    await keyTap('Enter');
    s = await state();
    check('title: NEW GAME opens character select', s.screen === 'select', s);
    await keyTap('Enter');
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 120);
    const startRoom = await page.evaluate(() => window.UB.World.start.room);
    check('select: confirm starts play in the start room (' + startRoom + ')', s.screen === 'play' && s.roomId === startRoom, s);
    check('player has full hp and 50 energy', s.hp === s.maxHp && s.hp === 5 && energyOk(s.energy), s);
    // The engine checks below use the pinned geometry of the debug room (unreachable in play):
    // warp there and rest at its node once, so the save (and every respawn) anchors to it.
    await D(d => d.warp('debug_room', null)); await step(2);
    await D(d => d.teleport(5 * 30 + 15, 450)); await step(3);
    await page.evaluate(() => window.UB.debug.pressed('up', 2)); await step(2);
    s = await stepUntil(x => x.mode === 'normal', 90, 1);
    check('debug room: resting at its node anchors the save there', s.roomId === 'debug_room' && s.mode === 'normal' && (await page.evaluate(() => (JSON.parse(localStorage.getItem('underbyte.save') || 'null') || {}).roomId)) === 'debug_room', s);
    // the physics checks measure tiles, not knockback: clear the patrolling walker first (room re-entry respawns it)
    await D(d => d.killEnemies());
    await D(d => d.teleport(105, 450)); await step(5); s = await state();
    check('player stands on the floor (grounded, y = 450)', s.grounded && s.y === 450, s);

    // ---------- run ----------
    const x0 = s.x;
    s = await holdStep('right', 30); // ~0.5 s of running
    check('run right moves the player', s.x > x0 + 60, { x0, x: s.x });
    await step(20); // friction stop
    s = await holdStep('left', 30);
    check('run left moves the player back', s.x < x0 + 60, { x0, x: s.x });
    await step(20);

    // ---------- variable jump ----------
    await D(d => d.teleport(105, 450)); await step(3);
    let minY = 1e9;
    await page.evaluate(() => window.UB.debug.pressed('jump', 20));
    for (let i = 0; i < 45; i++) { await step(1); const q = await state(); if (q.y < minY) minY = q.y; }
    const fullApex = 450 - minY;
    expectNear('full jump apex clears 3 tiles, fails 4 (Tessik 113.8 px)', fullApex, 113.8, 3);
    s = await stepUntil(x => x.grounded, 60, 1);
    check('lands back on the floor after the jump', s.grounded && s.y === 450, s);
    minY = 1e9;
    await page.evaluate(() => window.UB.debug.pressed('jump', 3));
    for (let i = 0; i < 45; i++) { await step(1); const q = await state(); if (q.y < minY) minY = q.y; }
    const shortApex = 450 - minY;
    check('short tap jumps lower than a full jump (variable height)', shortApex < fullApex * 0.6 && shortApex > 15, { shortApex, fullApex });
    await stepUntil(x => x.grounded, 60, 1);

    // ---------- blocked by solid tiles ----------
    await D(d => d.teleport(60, 450)); await step(2);
    s = await holdStep('left', 40);
    expectNear('solid wall stops the body (left edge x = 30 + half width)', s.x, 30 + 11, 0.01);
    await D(d => d.teleport(21 * 30 + 15, 450)); await step(2); // just left of the 3-tall block at x 24–26
    s = await holdStep('right', 40);
    expectNear('3-tile block stops a running body', s.x, 24 * 30 - 11, 0.01);
    s = await state();
    check('player cannot pass through the floor', s.y <= 450, s);

    // ---------- one-way platform ----------
    await D(d => d.teleport(13 * 30 + 15, 8 * 30 - 40)); // above the row-8 platform (tile 13: plain floor below, no spikes)
    s = await stepUntil(x => x.grounded, 60, 1);
    check('falls onto the one-way platform and stands on it (y = 240)', s.grounded && s.y === 240, s);
    await page.evaluate(() => { window.UB.debug.pressed('down', 4); window.UB.debug.pressed('jump', 2); });
    s = await stepUntil(x => x.grounded && x.y === 450, 90, 1);
    check('down + jump drops through the one-way platform to the floor', s.y === 450, s);
    // stand on the 3-tall block (top y = 360) and jump up through the row-11 platform above it (y = 330)
    await D(d => d.teleport(25 * 30 + 15, 360)); await step(3); s = await state();
    check('stands on top of the solid block (y = 360)', s.grounded && s.y === 360, s);
    await page.evaluate(() => window.UB.debug.pressed('jump', 20)); await step(2);
    s = await stepUntil(x => x.grounded, 90, 1);
    check('jumping up through the one-way platform lands on top of it (y = 330)', s.y === 330, s);

    // ---------- pickup a placed bit ----------
    const bitsBefore = (await state()).bits;
    await D(d => d.teleport(14 * 30 + 15, 450)); s = await stepUntil(x => x.bits > bitsBefore, 30, 1);
    check('walking over a placed bit collects it (+1)', s.bits === bitsBefore + 1, { bitsBefore, bits: s.bits });
    await D(d => d.warp('debug_room', { x: 14 * 30 + 15, y: 450 })); await step(5); s = await state();
    const pk = await D(d => d.pickups());
    check('collected placed bit does not respawn on room reload', s.bits === bitsBefore + 1 && !pk.some(p => p.type === 'bit' && Math.abs(p.x - (14 * 30 + 15)) < 1 && p.y > 400), pk);

    // ---------- spikes: damage + respawn at the room entry point ----------
    await D(d => d.warp('debug_room', null)); await step(2);
    s = await state(); const entryX = s.x, entryY = s.y, hpBefore = s.hp;
    await D(d => d.teleport(10 * 30 + 15, 450)); await step(3); s = await state();
    check('spike hit removes one heart and freezes the player', s.hp === hpBefore - 1 && s.hazardFreeze, s);
    s = await stepUntil(x => !x.hazardFreeze, 90, 1);
    expectNear('after the hazard freeze the player is back at the entry x', s.x, entryX, 0.01);
    check('…and at the entry y with i-frames', s.y === entryY && s.iframes > 0, s);
    await stepUntil(x => x.iframes === 0, 80);

    // ---------- enemy: hit it with lights until it dies, collect drops ----------
    s = await state();
    check('placeholder enemy spawned in the room', s.enemies === 1, s);
    let en = await D(d => d.enemies());
    const enemyHp0 = en[0].hp;
    await D(d => d.god(true));
    await D((d, ex) => d.teleport(ex - 34, 450), en[0].x); await step(2);
    await lightRight(8);
    en = await D(d => d.enemies());
    check('light attack damages the enemy', en.length === 1 && en[0].hp < enemyHp0, { enemyHp0, en });
    for (let i = 0; i < 12 && (await D(d => d.enemies())).length; i++) {
      en = await D(d => d.enemies());
      await D((d, ex) => d.teleport(ex - 34, 450), en[0].x); await step(2);
      await lightRight(14);
    }
    s = await state();
    check('enemy dies after enough light hits', s.enemies === 0, s);
    const bitsBeforeDrops = s.bits;
    const drops = await D(d => d.pickups());
    check('enemy death dropped bits', drops.filter(p => p.type === 'bit').length >= 2, drops);
    for (let i = 0; i < 6; i++) { const ps = await D(d => d.pickups()); const b = ps.find(p => p.type === 'bit'); if (!b) break; await D((d, x, y) => d.teleport(x, y), b.x, b.y); await step(8); }
    s = await state();
    check('dropped bits can be collected', s.bits > bitsBeforeDrops, { bitsBeforeDrops, bits: s.bits });
    await D(d => d.god(false));

    // ---------- room exit → second room → back ----------
    await D(d => d.teleport(28 * 30 + 15, 450)); await step(2);
    await page.evaluate(() => window.UB.debug.pressed('right', 60));
    s = await stepUntil(x => x.roomId === 'debug_room2' && !x.transition, 120, 1);
    check('walking through the right exit loads the second room', s.roomId === 'debug_room2', s);
    expectNear('arrival spawn tile (2,14) → x = 75', s.x, 75, 0.01);
    check('arrival: standing on the floor', s.y === 450, s);
    await step(30);
    await page.evaluate(() => window.UB.debug.pressed('left', 60));
    s = await stepUntil(x => x.roomId === 'debug_room' && !x.transition, 120, 1);
    check('walking back through the left exit returns to the first room', s.roomId === 'debug_room', s);
    expectNear('return arrival spawn tile (29,14) → x = 885', s.x, 885, 0.01);
    check('enemy respawned on room re-entry', s.enemies === 1, s);

    // ---------- moving platform + crumble tile (room 2) ----------
    await D(d => d.warp('debug_room2', 'L')); await step(2);
    await D(d => d.teleport(6 * 30 + 15, 6 * 30 - 20)); // above the mover's start
    s = await stepUntil(x => x.grounded, 60, 1);
    const onMoverX = s.x; await step(40); s = await state();
    check('moving platform carries the standing player', s.grounded && Math.abs(s.x - onMoverX) > 10, { onMoverX, x: s.x });
    await D(d => d.teleport(12 * 30 + 15, 9 * 30 - 10)); s = await stepUntil(x => x.grounded, 40, 1);
    check('crumble tile holds the player at first (y = 270)', s.grounded && s.y === 270, s);
    s = await stepUntil(x => x.y > 300, 60, 1);
    check('crumble tile vanishes after ~20 f and the player falls', s.y > 300, s);

    // ---------- pause / resume, map ----------
    await D(d => d.warp('debug_room', null)); await step(2);
    await keyTap('Escape'); s = await state();
    check('Escape opens the pause overlay', s.screen === 'pause', s);
    const fBefore = (await state()).playTimeFrames; await step(10);
    check('world is frozen while paused', (await state()).playTimeFrames === fBefore);
    await keyTap('Escape'); s = await state();
    check('Escape again resumes play', s.screen === 'play', s);
    await keyTap('KeyM'); s = await state();
    check('M opens the map', s.screen === 'map', s);
    await keyTap('KeyM'); s = await state();
    check('M closes the map', s.screen === 'play', s);

    // ---------- death at 0 hp → game over → respawn ----------
    await D(d => d.setHp(1)); await step(1);
    await D(d => d.teleport(10 * 30 + 15, 450)); await step(3); s = await state();
    check('spike at 1 hp kills the player', s.hp === 0 && s.dead, s);
    s = await stepUntil(x => x.screen === 'gameover' && !x.busy, 200);
    check('death leads to the game over screen', s.screen === 'gameover', s);
    check('deaths stat incremented', s.deaths === 1, s);
    await step(25);
    await keyTap('Enter');
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 120);
    check('confirm on game over respawns in play', s.screen === 'play', s);
    check('respawn: full hp, energy 50, meter 0, start room', s.hp === s.maxHp && energyOk(s.energy) && s.meter === 0 && s.roomId === 'debug_room', s);

    // ---------- restore node: save ----------
    await D(d => d.setHp(2)); await D(d => d.teleport(5 * 30 + 15, 450)); await step(3); s = await state();
    check('standing at the node shows the interaction', s.nearNode === 'node_debug', s);
    await page.evaluate(() => window.UB.debug.pressed('up', 2));
    s = await stepUntil(x => x.hp === x.maxHp && x.mode === 'normal', 60, 1);
    check('node use heals to full', s.hp === s.maxHp, s);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('underbyte.save') || 'null'));
    check('node use writes underbyte.save', !!saved && saved.roomId === 'debug_room' && saved.spawn.nodeId === 'node_debug' && saved.fighter === 'tessik', saved);
    check('save has the DESIGN §14 keys', saved && ['version', 'fighter', 'roomId', 'spawn', 'hearts', 'maxHearts', 'baseHearts', 'cores', 'abilities', 'bits', 'bitsLifetime', 'discovered', 'visited', 'bossesDefeated', 'bitsCollected', 'vendor', 'nodesUsed', 'loreSeen', 'hints', 'enemiesPurged', 'playTimeFrames', 'deaths', 'victory'].every(k => k in saved), saved && Object.keys(saved));
    const bitsSaved = saved && saved.bits;

    // ---------- boss: trigger, intro, kill, ability pickup, seal lifts ----------
    await D(d => d.warp('debug_boss', 'L')); await step(2); s = await state();
    check('boss room has a boss and no fight yet', s.boss && s.boss.id === 'proto_warden' && s.bossFight === 'none', s);
    await D(d => d.teleport(9 * 30, 450)); await step(3); s = await state();
    check('crossing the fight bounds starts the intro (player locked)', s.bossFight === 'intro' && s.locked, s);
    s = await stepUntil(x => x.bossFight === 'fight', 200);
    check('after 150 f the fight starts and control returns', s.bossFight === 'fight' && !s.locked, s);
    await D(d => d.god(true));
    for (let i = 0; i < 40 && (await state()).bossFight === 'fight'; i++) {
      const bx = await page.evaluate(() => window.UB.game.boss.x);
      await D((d, x) => d.teleport(x - 50, 450), bx); await step(2); await lightRight(14);
    }
    s = await state();
    check('boss dies to light attacks', s.bossFight === 'dying' || s.bossFight === 'reward', s);
    s = await stepUntil(x => x.bossFight === 'reward', 200);
    const abil = (await D(d => d.pickups())).find(p => p.type === 'ability');
    check('defeated boss drops an ability module + rewards', !!abil && (await D(d => d.pickups())).length >= 4, await D(d => d.pickups()));
    await D((d, x, y) => d.teleport(x, y), abil.x, abil.y); await step(3); s = await state();
    check('touching the module starts the pickup sequence', s.mode === 'pickupSeq', s);
    s = await stepUntil(x => x.mode === 'normal', 200);
    check('pickup sequence grants Echo Jump and records the boss', s.abilities.echoJump && s.bossesDefeated.includes('proto_warden') && s.bossFight === 'done', s);
    const saved2 = await page.evaluate(() => JSON.parse(localStorage.getItem('underbyte.save') || 'null'));
    check('boss pickup wrote the save with the ability', saved2 && saved2.abilities.echoJump === true && saved2.bossesDefeated.includes('proto_warden'), saved2);
    await D(d => d.god(false));
    await D(d => d.teleport(2 * 30 + 15, 450)); await step(2);
    await page.evaluate(() => window.UB.debug.pressed('left', 60));
    s = await stepUntil(x => x.roomId === 'debug_room2' && !x.transition, 120, 1);
    check('sealed exit is open again after the reward', s.roomId === 'debug_room2', s);
    // echo jump now works
    await D(d => d.teleport(20 * 30, 450)); await step(3);
    minY = 1e9;
    await page.evaluate(() => window.UB.debug.pressed('jump', 20));
    await step(22);
    await page.evaluate(() => window.UB.debug.pressed('jump', 20));
    for (let i = 0; i < 60; i++) { await step(1); const q = await state(); if (q.y < minY) minY = q.y; }
    check('Echo Jump roughly doubles the apex (clears 6 tiles)', 450 - minY > 180 && 450 - minY < 210, { apex: 450 - minY });
    await stepUntil(x => x.grounded, 90, 1);

    // ---------- Continue from title after reload ----------
    await page.reload(); await page.waitForTimeout(250);
    await D(d => d.pauseLogic(true)); s = await state();
    check('after reload: title shows and a save exists', s.screen === 'title' && s.hasSave, s);
    await keyTap('Enter'); // title selection defaults to CONTINUE when a save exists
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 120);
    check('CONTINUE loads the saved room at the node with the saved fighter', s.screen === 'play' && s.roomId === 'debug_room' && s.fighter === 'tessik', s);
    check('continued save keeps bits, ability and full hearts', s.bits >= bitsSaved && s.abilities.echoJump && s.hp === s.maxHp, s);
    expectNear('continue: standing at the node tile (5,14)', s.x, 165, 0.01);

    // ---------- v2 contract: frozen-frame snapshots, hints, vendor, shop/lore overlays, debug spawns, projectile cap ----------
    await D(d => d.warp('debug_room', null)); await step(2);
    await page.evaluate(() => window.UB.debug.pressed('right', 30)); await step(6);
    await keyTap('Escape');
    let fr = await page.evaluate(() => { const g = window.UB.game; return { ppx: g.player.px, px: g.player.x, cpx: g.cam.px, cx: g.cam.x, screen: g.overlay }; });
    check('paused world is snapped (player.px === x, cam.px === cam.x) so the frozen frame cannot drift', fr.screen === 'pause' && fr.ppx === fr.px && fr.cpx === fr.cx, fr);
    await keyTap('Escape'); await step(30);
    await D(d => d.god(true));
    fr = await page.evaluate(() => {
      const d = window.UB.debug, g = window.UB.game, FX = window.UB.FX;
      const e = d.spawnEnemy('walker', 12, 14, { patrol: [10, 14] });
      const ent = g.enemies[g.enemies.length - 1];
      d.teleport(ent.x - 34, 450); d.step(2); d.pressed('right', 1); d.step(1); d.pressed('light', 2);
      for (let i = 0; i < 12; i++) { d.step(1); if (FX.hitstopFrames > 0) return { spawned: e, hitstop: FX.hitstopFrames, ppx: g.player.px, px: g.player.x, epx: ent.px, ex: ent.x }; }
      return { spawned: e, hitstop: 0 };
    });
    check('debug.spawnEnemy places a live enemy in the current room', fr.spawned && fr.spawned.type === 'walker' && fr.spawned.x === 12 * 30 + 15, fr.spawned);
    check('the frame a hit lands is snapped too (px === x for player and victim during hitstop)', fr.hitstop > 0 && fr.ppx === fr.px && fr.epx === fr.ex, fr);
    await D(d => d.god(false)); await D(d => d.killEnemies());
    s = await state();
    check('save.hints records the first use of move/jump/light (control-hint strip source)', s.hints && s.hints.move && s.hints.jump && s.hints.light, s.hints);
    const fxn = await D(d => d.fx('spark', 200, 400, { n: 6 }));
    check('debug.fx fires a burst (particle count ≥ 6)', fxn >= 6, fxn);
    const projCap = await page.evaluate(() => {
      const g = window.UB.game, E = window.UB.Entity;
      for (let i = 0; i < 70; i++) { const p = new E({ x: 100 + i, y: 100, w: 4, h: 4 }); p.owner = 'enemy'; p.update = function () {}; p.draw = function () {}; g.spawnProjectile(p); }
      const n = g.projectiles.length; g.projectiles.length = 0; return n;
    });
    check('projectiles are capped at 64 (oldest evicted)', projCap === 64, projCap);
    // vendor purchases through game.buy() (the shop UI calls this)
    await D(d => d.setBits(100));
    const buy1 = await D(d => d.buy('spare_cell')); s = await state();
    check('buy(spare_cell) with 100 bits: bought, energyMax 125, 10 bits left, saved in vendor[]', buy1 === 'bought' && s.energyMax === 125 && s.bits === 10 && s.vendor.includes('spare_cell'), { buy1, s });
    const buy2 = await D(d => d.buy('spare_cell')), buy3 = await D(d => d.buy('hot_clock'));
    check('buying again is "sold", an unaffordable item is "poor"', buy2 === 'sold' && buy3 === 'poor', { buy2, buy3 });
    const savedV = await page.evaluate(() => JSON.parse(localStorage.getItem('underbyte.save') || 'null'));
    check('a purchase writes the save immediately', savedV && savedV.vendor.includes('spare_cell') && savedV.bits === 10, savedV && savedV.vendor);
    // shop overlay: open, navigate to DEEP PING (row 3), confirm buys it, back closes and shows the PURCHASED banner
    await D(d => d.setBits(200));
    await page.evaluate(() => window.UB.game.openOverlay('shop')); await step(1); s = await state();
    check('openOverlay(shop) shows the vendor panel (screen = shop, world frozen)', s.screen === 'shop' && s.baseScreen === 'play', s);
    await page.evaluate(() => window.UB.debug.pressed('down', 1)); await step(1);
    await page.evaluate(() => window.UB.debug.pressed('confirm', 1)); await step(1); s = await state();
    check('shop: Down + Confirm buys the next unsold item (DEEP PING) and stays open', s.screen === 'shop' && s.vendor.includes('deep_ping') && s.bits === 80, s);
    await page.evaluate(() => window.UB.debug.pressed('back', 1)); await step(1); s = await state();
    const bannerUp = await page.evaluate(() => window.UB.UI.bannerT > 0 && window.UB.UI.banner1);
    check('shop: Back closes the panel and the PURCHASED banner appears', s.screen === 'play' && bannerUp === 'DEEP PING PURCHASED', { s: s.screen, bannerUp });
    // lore overlay: UI closes it after 240 f (or any key)
    await D(d => d.skipTo('lore')); await step(1); s = await state();
    check('skipTo(lore) opens the lore card overlay', s.screen === 'lore', s);
    await step(241); s = await state();
    check('the lore card closes itself after 240 f', s.screen === 'play', s);
    // debug.spawnBoss in a room without a boss record: live fight at once; {fight:true} runs the intro
    let bs = await D(d => d.spawnBoss('proto_warden')); s = await state();
    check('spawnBoss(id) creates a live boss in the current room (bossFight = fight, active)', bs && bs.id === 'proto_warden' && bs.fight === 'fight' && s.boss && s.boss.active, { bs, boss: s.boss });
    bs = await D(d => d.spawnBoss('proto_warden', { fight: true })); s = await state();
    check('spawnBoss(id, {fight:true}) runs the trigger flow (intro, player locked)', bs && bs.fight === 'intro' && s.locked && s.mode === 'bossIntro', { bs, s });
    await D(d => d.warp('debug_room', null)); await step(2); s = await state();
    check('warping away discards the debug boss', !s.boss && s.bossFight === 'none' && !s.locked, s);
    // corrupt save slot: boot + CONTINUE must never throw
    await page.evaluate(() => localStorage.setItem('underbyte.save', JSON.stringify({ version: 1, fighter: 'tessik', cores: null, abilities: 7, bits: 'lots', bitsCollected: 0, vendor: 3, bossesDefeated: {}, discovered: 'x' })));
    const errsBefore = t.errors.length;
    await page.reload(); await page.waitForTimeout(250);
    await D(d => d.pauseLogic(true)); s = await state();
    check('a corrupt version-1 save still boots (no page errors)', s.screen === 'title' && t.errors.length === errsBefore, t.errors.slice(errsBefore));
    await D(d => d.continueGame()); s = await stepUntil(x => x.screen === 'play' && !x.busy, 150);
    check('CONTINUE on the corrupt save sanitises it and reaches play in the start room', s.screen === 'play' && s.roomId === startRoom && s.bits === 0 && s.maxHp === 5 && t.errors.length === errsBefore, s);
    await page.evaluate(() => localStorage.setItem('underbyte.save', JSON.stringify({ version: 1, fighter: 'tessik', roomId: 'debug_room', spawn: { nodeId: 'node_debug' }, cores: ['a', 'b', 'c', 'core_debug', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k'] })));
    await page.reload(); await page.waitForTimeout(250);
    await D(d => d.pauseLogic(true)); await D(d => d.continueGame()); s = await stepUntil(x => x.screen === 'play' && !x.busy, 150);
    check('bogus core ids are dropped on load (only world cores count: max hp 6)', s.maxHp === 6 && s.cores.length === 1 && s.cores[0] === 'core_debug', s);
    await page.evaluate(() => localStorage.removeItem('underbyte.save'));

    // ---------- debug API surface ----------
    const api = await page.evaluate(() => Object.keys(window.UB.debug));
    const want = ['state', 'warp', 'teleport', 'grant', 'setHp', 'setMaxHp', 'setEnergy', 'setMeter', 'addBits', 'setBits', 'defeatBoss', 'killEnemies', 'god', 'godmode', 'step', 'frame', 'pauseLogic', 'pressed', 'newGame', 'startGame', 'continueGame', 'toTitle', 'skipTo', 'save', 'load', 'reset', 'audio', 'mute', 'rooms', 'enemies', 'pickups', 'boss', 'showHitboxes', 'worldErrors', 'spawnEnemy', 'spawnBoss', 'fx', 'buy'];
    check('UB.debug exposes the contract API', want.every(k => api.includes(k)), want.filter(k => !api.includes(k)));
    const globals = await page.evaluate(() => Object.keys(window).filter(k => k === 'UB'));
    check('UB global present', globals.length === 1);

    // ---------- render sanity + no console errors ----------
    await D(d => d.pauseLogic(false)); await page.waitForTimeout(400);
    const px = await page.evaluate(() => { const c = document.getElementById('game'); const d = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data; return [d[0], d[1], d[2]]; });
    check('canvas renders something at the centre', px[0] + px[1] + px[2] > 0, px);
    check('no console errors or page errors', t.errors.length === 0, t.errors);
  } catch (e) {
    check('test threw: ' + (e && e.message ? e.message : String(e)), false, e && e.stack);
  }

  const fails = results.filter(r => !r.ok);
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' checks passed' + (fails.length ? ' — FAILED: ' + fails.map(f => f.name).join(' | ') : ''));
  if (t.errors.length) console.log('page errors:\n' + t.errors.join('\n'));
  await t.close();
  process.exit(fails.length ? 1 : 0);
})();
