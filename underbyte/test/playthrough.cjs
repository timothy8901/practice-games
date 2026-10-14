/*
 * UNDERBYTE — test/playthrough.cjs
 * Full scripted playthrough (Playwright, headless Chromium, file:// index.html).
 * Run:  node underbyte/test/playthrough.cjs      (exit code 0 = every step PASS)
 *
 * Proves the game is completable end to end:
 *   title → select (keyboard) → dc_wake → rest at the node → die to the tutorial scuttlebit →
 *   game over → respawn at the node (full hp, enemies back) → walk the DESIGN §10.3 critical
 *   path room by room with REAL inputs (a traversal bot that holds the direction key and jumps
 *   from what it sees in the tilemap: walls, hazard pits, Echo Jump at the apex) → vendor purchase →
 *   Tallock (ECHO JUMP + banner, double jump verified) → core 1 (+1 max heart) → save at a node,
 *   reload, CONTINUE → map screen → Weftyr (BURST LINE, dash verified) → Corrosant (GRIP PROTOCOL,
 *   wall jump verified, the unlocked hatch exit) → Rootwell gauntlet → Kernauth both phases →
 *   victory screen with stats. Frame time is measured with UB.debug.bench in the busiest rooms.
 *
 * Rooms whose platforming is long vertical descents/climbs (dc_fall, lw_hoist/lw_belts, the
 * Brinevault crawlspaces, the Nullspire climb) are skipped with UB.debug.warp to the next room's
 * entry exit, as the task allows; at least six rooms are crossed with real inputs and every exit
 * transition on those rooms fires naturally.
 */
const path = require('path');
const { launch } = require('./harness.cjs');

const SHOTS = path.join(__dirname, 'shots');
const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok, info });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info).slice(0, 600) : ''));
}

(async () => {
  const t = await launch({ bootMs: 400 });
  const page = t.page;
  const state = () => page.evaluate(() => window.UB.debug.state());
  const step = (n) => page.evaluate((n) => window.UB.debug.step(n), n);
  const D = (fn, ...args) => page.evaluate(({ src, args }) => {
    const f = new Function('d', 'g', 'args', 'return (' + src + ')(d, g, ...args)');
    return f(window.UB.debug, window.UB.game, args);
  }, { src: fn.toString(), args });
  async function stepUntil(pred, max, chunk = 2) {
    let s = await state();
    for (let i = 0; i < max && !pred(s); i += chunk) { await step(chunk); s = await state(); }
    return s;
  }
  // real keyboard tap, latched by the next logic frames
  async function keyTap(key, after = 2) { await page.keyboard.down(key); await step(1); await page.keyboard.up(key); await step(after); }
  async function shot(name) { await page.evaluate(() => window.UB.game.render(1)); await t.shot(path.join(SHOTS, name)); }
  const naturalExits = [];   // {from, to, exit}
  const realRooms = new Set();
  const benches = [];

  /**
   * Traversal bot (runs in-page). Holds `dir` every frame through UB.Input's virtual keys and
   * decides jumps from the tilemap ahead of the leading edge: a wall at feet height → jump; a
   * pit whose first non-air tile is a hazard → jump; still blocked past the apex with an air
   * jump left → Echo Jump. Dismisses a zone lore card. Stops when the room changes (the exit
   * fired naturally) or after maxFrames. Returns {ok, frames, from, to, exit, jumps, reason}.
   */
  const botRun = (opts) => page.evaluate((o) => {
    const d = window.UB.debug, g = window.UB.game, E = window.UB.Entity, T = 30;
    const dir = o.dir, from = g.level.room.id, dirAct = dir > 0 ? 'right' : 'left';
    let jumpCd = 0, jumps = 0, airJumps = 0, lastX = g.player.x, stuck = 0, loreT = 0, lastExit = null;
    for (let f = 0; f < o.maxFrames; f++) {
      const p = g.player, lv = g.level;
      if (g.mode === 'transition' && g.transition.exit) lastExit = g.transition.exit.id;
      if (lv.room.id !== from && g.mode === 'normal' && !p.locked) return { ok: true, frames: f, from: from, to: lv.room.id, exit: lastExit, jumps: jumps, airJumps: airJumps };
      if (g.overlay === 'lore') { if (++loreT > 14) d.pressed('confirm', 2); d.step(1); continue; }
      if (g.overlay || g.screen !== 'play') return { ok: false, reason: 'left play: ' + (g.overlay || g.screen), frames: f, from: from };
      if (g.mode !== 'normal' || p.locked || p.dead) { d.step(1); continue; }
      if (o.stopX !== undefined && ((dir > 0 && p.x >= o.stopX) || (dir < 0 && p.x <= o.stopX)) && p.onGround) return { ok: true, frames: f, from: from, to: from, reachedX: p.x, jumps: jumps };
      if (jumpCd > 0) jumpCd--;
      const lead = p.x + dir * p.w / 2;
      const feetTy = Math.floor((p.y - 1) / T), floorTy = feetTy + 1;
      const aheadTx = Math.floor((lead + dir * 8) / T);
      const solid = (tx, ty) => E.solidAt(lv, tx, ty);
      const at = (tx, ty) => E.tileAt(lv, tx, ty);
      const wallLow = solid(aheadTx, feetTy), wallHigh = solid(aheadTx, feetTy - 1);
      const wall = wallLow || wallHigh;
      const lip = !wallLow && wallHigh;                       // a ceiling lip the body cannot walk under: a jump never helps
      const myTx = Math.floor(p.x / T);
      const onOneWay = p.onGround && at(myTx, floorTy) === '-';
      let hazardDrop = false, depth = 0;
      for (let ty = floorTy; ty < floorTy + 10; ty++) {
        const ch = at(aheadTx, ty);
        if (ch === '#' || ch === '-' || ch === 'c') break;
        if (ch === '^' || ch === '~') { hazardDrop = true; break; }
        depth++;
      }
      const deepDrop = depth >= (o.dropLimit || 10);
      // under the player's own column: a hazard (a pit crossing that fell short) or nothing at all (an exit chute)
      let hazardBelow = false, below = 0;
      for (let ty = floorTy; ty < floorTy + 12; ty++) { const ch = at(myTx, ty); if (ch === '#' || ch === '-' || ch === 'c') break; if (ch === '^' || ch === '~') { hazardBelow = true; break; } below++; }
      const bottomless = below >= 12 || floorTy + below >= lv.h;
      if (!(p.clinging && bottomless)) d.pressed(dirAct, 1);   // hold the direction key (except inside a chute: let go of the wall and fall out)
      if (onOneWay && lip) { d.pressed('down', 6); d.pressed('jump', 2); jumpCd = 12; }   // wedged under a ceiling on a grate: drop through
      else if (p.onGround && jumpCd <= 0 && !lip && (wall || hazardDrop || (deepDrop && !o.allowDrop))) { d.pressed('jump', 24); jumpCd = 28; jumps++; }
      else if (!p.onGround && !bottomless && p.vy > 0 && jumpCd <= 0 && p.airJumps > 0 && g.save.abilities.echoJump && (wall || hazardBelow)) { d.pressed('jump', 24); jumpCd = 28; airJumps++; }
      // stuck: nothing moved for 90 f → hop; 240 f → give up
      if (Math.abs(p.x - lastX) < 0.5) { stuck++; if (stuck === 90 && p.onGround) { d.pressed('jump', 24); jumpCd = 28; } if (stuck > 240) return { ok: false, reason: 'stuck', frames: f, from: from, x: p.x, y: p.y, state: p.state }; }
      else { stuck = 0; lastX = p.x; }
      d.step(1);
    }
    return { ok: false, reason: 'timeout', frames: o.maxFrames, from: from, x: g.player.x, y: g.player.y, room: g.level.room.id, mode: g.mode };
  }, opts);
  async function cross(dir, opts = {}) {
    const r = await botRun(Object.assign({ dir, maxFrames: 2400, allowDrop: false, dropLimit: 4 }, opts));
    if (r.ok && r.to && r.to !== r.from) { naturalExits.push({ from: r.from, to: r.to, exit: r.exit }); realRooms.add(r.from); }
    return r;
  }

  /**
   * Boss macro (in-page): every iteration put the player beside the boss on the side with room
   * (debug teleport — fliers and the ceiling crawler cannot be reached otherwise), face it with the
   * direction key, mash light (two chained lights per cycle) and hop every `jumpEvery` cycles.
   * God mode keeps the player alive; the boss's roar/transition windows simply block the hits.
   * Returns when the fight leaves 'fight' (dying/reward) or after maxFrames.
   */
  const bossMacro = (opts) => page.evaluate((o) => {
    const d = window.UB.debug, g = window.UB.game, E = window.UB.Entity;
    let it = 0, hits = 0, phases = new Set(), f = 0, minHp = 1e9;
    while (f < o.maxFrames) {
      const b = g.boss; if (!b) break;
      const bf = g.bossFight.state;
      if (bf === 'intro' || bf === 'none') { d.step(1); f++; continue; }
      if (bf !== 'fight') break;
      phases.add(b.phase);
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
      if (g.boss && g.boss.hp < minHp) minHp = g.boss.hp;
      it++;
    }
    const b = g.boss;
    return { frames: f, hits: hits, phases: [...phases], fight: g.bossFight.state, hp: b ? b.hp : null, boss: b ? b.id : null, screen: g.screen };
  }, opts);

  // After the reward state: walk/teleport onto the ability module and ride the pickup sequence.
  async function takeAbility(bossId, ability, bannerLine) {
    let s = await stepUntil(x => x.bossFight === 'reward' || x.bossFight === 'done', 400, 5);
    check(bossId + ': death animation ends in the reward state', s.bossFight === 'reward' || s.bossFight === 'done', s.bossFight);
    const abil = (await D(d => d.pickups())).find(p => p.type === 'ability');
    check(bossId + ': the ability module and rewards dropped', !!abil && (await D(d => d.pickups())).length >= 4, await D(d => d.pickups()));
    if (abil) { await D((d, g, x, y) => d.teleport(x, y), abil.x, abil.y); await step(3); }
    s = await state();
    check(bossId + ': touching the module starts the pickup sequence', s.mode === 'pickupSeq', s.mode);
    const ban = await page.evaluate(() => ({ t: window.UB.UI.bannerT, l1: window.UB.UI.banner1 }));
    check(bossId + ': the ' + bannerLine + ' banner shows', ban.t > 0 && ban.l1 === bannerLine, ban);
    s = await stepUntil(x => x.mode === 'normal', 300, 5);
    check(bossId + ': ' + ability + ' granted and the boss recorded', s.abilities[ability] === true && s.bossesDefeated.includes(bossId) && s.bossFight === 'done', { abilities: s.abilities, bosses: s.bossesDefeated });
    return s;
  }
  // the lore card of a freshly entered zone (90 f after the toast): let it open, then dismiss it with a key
  async function settleZone() {
    let s = await stepUntil(x => x.screen === 'lore', 160, 4);
    if (s.screen === 'lore') { await step(14); await keyTap('Enter', 4); }
    return state();
  }
  async function restAtNode(nodeTileX) {
    const nx = nodeTileX * 30 + 15;
    const s0 = await state();
    const r = await botRun({ dir: s0.x < nx ? 1 : -1, maxFrames: 900, allowDrop: false, dropLimit: 4, stopX: nx + (s0.x < nx ? -4 : 4) });
    await D((d, g, x) => { const pl = g.player; pl.x = x; pl.px = x; pl.vx = 0; }, nx); await step(2);
    let s = await state();
    const near = s.nearNode;
    await page.evaluate(() => window.UB.debug.pressed('up', 2)); await step(2);
    s = await stepUntil(x => x.mode === 'normal', 90, 1);
    return { walked: r, near, s };
  }

  try {
    // ===================== 1. boot, new game by keyboard =====================
    await page.evaluate(() => { localStorage.removeItem('underbyte.save'); localStorage.removeItem('underbyte.settings'); });
    await page.reload(); await page.waitForTimeout(400);
    await D(d => d.pauseLogic(true));
    let s = await state();
    check('1a boots to the title with no save, world data valid', s.screen === 'title' && !s.hasSave && (await D(d => d.worldErrors())).length === 0, s.screen);
    await keyTap('Enter'); s = await state();
    check('1b Enter → character select', s.screen === 'select', s.screen);
    await keyTap('Enter');
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 200);
    check('1c Enter → NEW GAME with fighter 1 (Tessik) in the start room dc_wake, full hp, no abilities', s.screen === 'play' && s.fighter === 'tessik' && s.roomId === 'dc_wake' && s.hp === 5 && s.maxHp === 5 && !s.abilities.echoJump, s);
    await settleZone();

    // ===================== 2. rest at the first node, die, respawn =====================
    let rest = await restAtNode(5);
    check('2a walking to node_dc_wake and pressing Up rests there (REST prompt, save written)', rest.near === 'node_dc_wake' && rest.s.mode === 'normal' && rest.s.hasSave && rest.s.savedRoom === 'dc_wake', rest);
    await D(d => { d.god(false); d.setHp(1); });
    const enemies0 = (await D(d => d.enemies())).filter(e => e.type !== 'bossSegment');
    check('2b dc_wake holds its tutorial scuttlebit', enemies0.length === 1 && enemies0[0].type === 'scuttlebit', enemies0);
    // walk right into the patroller with 1 heart and no god mode
    let died = await page.evaluate(() => {
      const d = window.UB.debug, g = window.UB.game;
      for (let f = 0; f < 900; f++) { if (g.player.dead) return { dead: true, f, x: g.player.x }; d.pressed('right', 1); d.step(1); }
      return { dead: false, x: g.player.x, hp: g.player.hp };
    });
    check('2c with god mode off the scuttlebit kills a 1-heart Tessik', died.dead, died);
    s = await stepUntil(x => x.screen === 'gameover' && !x.busy, 300, 5);
    check('2d → game over screen, deaths = 1', s.screen === 'gameover' && s.deaths === 1, { screen: s.screen, deaths: s.deaths });
    await step(30); await keyTap('Enter');
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 200, 5);
    const enemies1 = (await D(d => d.enemies())).filter(e => e.type !== 'bossSegment');
    check('2e Enter respawns at the last restore node (dc_wake node tile 5,12: x 165) with full hp, energy 50, enemies respawned', s.roomId === 'dc_wake' && Math.abs(s.x - 165) < 0.01 && s.hp === s.maxHp && s.energy >= 50 && s.energy < 56 && enemies1.length === 1, { s, enemies1 });
    await shot('pt-1-respawn.png');

    // ===================== 3. critical path with real inputs: dc_wake → dc_fall =====================
    await D(d => d.god(true));
    let r = await cross(1);
    check('3a REAL INPUT dc_wake → R → dc_fall (exit fires naturally)', r.ok && r.to === 'dc_fall' && r.exit === 'R', r);
    // dc_fall is a 50-row descent: skip it to dc_cross's left exit
    await D(d => d.warp('dc_cross', 'L')); await step(3);
    r = await cross(1);
    check('3b REAL INPUT dc_cross (two spike pits, the mound) → R → dc_shrine', r.ok && r.to === 'dc_shrine' && r.exit === 'R', r);
    await shot('pt-2-dc_shrine.png');

    // ===================== 4. dc_shrine: node + vendor =====================
    rest = await restAtNode(9);
    check('4a rest at node_dc_shrine (save now points here)', rest.near === 'node_dc_shrine' && rest.s.savedRoom === 'dc_shrine', rest);
    await D(d => d.addBits(100));
    r = await botRun({ dir: 1, maxFrames: 600, allowDrop: false, dropLimit: 4, stopX: 21 * 30 + 15 - 4 });
    await D((d, g) => { g.player.x = 21 * 30 + 15; g.player.px = g.player.x; g.player.vx = 0; }); await step(2); s = await state();
    check('4b standing at Scrivvet shows ▲ TRADE', s.nearVendor && s.prompt === 'TRADE', { nearVendor: s.nearVendor, prompt: s.prompt });
    await keyTap('ArrowUp', 3); s = await state();
    check('4c Up opens the shop overlay', s.screen === 'shop', s.screen);
    await shot('pt-3-shop.png');
    const bits0 = s.bits;
    await keyTap('Enter', 3); s = await state();
    check('4d Enter buys SPARE CELL (first row): −90 bits, vendor saved, energyMax 125', s.vendor.includes('spare_cell') && s.bits === bits0 - 90 && s.energyMax === 125, { vendor: s.vendor, bits: s.bits, bits0, energyMax: s.energyMax });
    await keyTap('Escape', 3); s = await state();
    const ban = await page.evaluate(() => ({ t: window.UB.UI.bannerT, l1: window.UB.UI.banner1 }));
    check('4e Escape closes the shop and the PURCHASED banner shows', s.screen === 'play' && ban.t > 0 && ban.l1 === 'SPARE CELL PURCHASED', { screen: s.screen, ban });
    r = await cross(1);
    check('4f REAL INPUT dc_shrine → R → dc_sentinel', r.ok && r.to === 'dc_sentinel' && r.exit === 'R', r);

    // ===================== 5. boss 1: Tallock → Echo Jump =====================
    s = await stepUntil(x => x.bossFight === 'intro', 30);
    check('5a arriving in the arena starts the Tallock intro (title card, player locked)', s.boss && s.boss.id === 'tallock' && s.bossFight === 'intro' && s.locked, { boss: s.boss, fight: s.bossFight });
    await step(60); await shot('pt-4-tallock-card.png');
    let fight = await bossMacro({ maxFrames: 4000, jumpEvery: 5 });
    check('5b Tallock dies to the light macro (face it, mash light, hop)', fight.fight === 'dying' || fight.fight === 'reward', fight);
    benches.push({ room: 'dc_sentinel (boss death)', b: await D(d => d.bench(60)) });
    s = await takeAbility('tallock', 'echoJump', 'ECHO JUMP ACQUIRED');
    // double jump: two jumps in the air
    await D(d => d.teleport(20 * 30 + 15, 450)); await step(3);
    const dj = await page.evaluate(() => {
      const d = window.UB.debug, g = window.UB.game; let minY = 1e9, second = false;
      d.pressed('jump', 20); for (let i = 0; i < 22; i++) { d.step(1); if (g.player.y < minY) minY = g.player.y; }
      d.pressed('jump', 20); for (let i = 0; i < 70; i++) { d.step(1); if (g.player.y < minY) minY = g.player.y; if (g.player.airJumps === 0) second = true; if (g.player.onGround && i > 10) break; }
      return { apex: 450 - minY, second };
    });
    check('5c Echo Jump works: a second jump in the air lifts the apex past 180 px (single jump 114)', dj.second && dj.apex > 180 && dj.apex < 215, dj);
    r = await cross(1, { maxFrames: 3000 });
    check('5d REAL INPUT dc_sentinel → Echo Jump onto the 5-tile block → R2 → lw_hoist', r.ok && r.to === 'lw_hoist' && r.exit === 'R2' && r.airJumps >= 1, r);
    await settleZone();

    // ===================== 6. core 1 in dc_loft (+1 max heart) =====================
    const hp0 = (await state()).maxHp;
    await D(d => d.warp('dc_loft', { x: 27 * 30 + 15, y: 13 * 30 })); await step(2);
    s = await stepUntil(x => x.maxHp === hp0 + 1, 60, 1);
    const ban2 = await page.evaluate(() => ({ t: window.UB.UI.bannerT, l1: window.UB.UI.banner1 }));
    check('6a collecting core 1 raises max hp ' + hp0 + ' → ' + (hp0 + 1) + ' (+1 hp, CORE FOUND banner, saved)', s.maxHp === hp0 + 1 && s.cores.includes('core_dc_loft') && ban2.l1 === 'CORE FOUND' && ban2.t > 0, { s: { maxHp: s.maxHp, hp: s.hp, cores: s.cores }, ban2 });

    // ===================== 7. lw_rest: save, reload, CONTINUE, map =====================
    await D(d => d.warp('lw_rest', 'L')); await step(2); await settleZone();
    rest = await restAtNode(15);
    check('7a rest at node_lw_rest writes the save', rest.near === 'node_lw_rest' && rest.s.savedRoom === 'lw_rest', rest);
    const before = await state();
    await page.reload(); await page.waitForTimeout(400);
    await D(d => d.pauseLogic(true)); s = await state();
    check('7b after a page reload the title offers CONTINUE', s.screen === 'title' && s.hasSave && s.savedRoom === 'lw_rest', s);
    await keyTap('Enter');
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 200, 5);
    check('7c CONTINUE restores the room (lw_rest at the node), fighter, abilities, bits, vendor item, cores/max hp', s.roomId === 'lw_rest' && s.fighter === 'tessik' && Math.abs(s.x - (15 * 30 + 15)) < 0.01 && s.abilities.echoJump && !s.abilities.burstLine && s.bits === before.bits && s.vendor.includes('spare_cell') && s.energyMax === 125 && s.maxHp === before.maxHp && s.cores.length === 1, { s, before: { bits: before.bits, maxHp: before.maxHp } });
    await D(d => d.god(true));
    await keyTap('KeyM', 3); s = await state();
    const disc = await D((d, g) => ({ discovered: g.save.discovered.slice(), visited: g.save.visited.slice() }));
    check('7d M opens the map; discovered rooms include every visited room (' + disc.visited.length + ' visited, ' + disc.discovered.length + ' discovered)', s.screen === 'map' && disc.visited.every(r0 => disc.discovered.includes(r0)) && ['dc_wake', 'dc_cross', 'dc_shrine', 'dc_sentinel', 'lw_rest'].every(r0 => disc.discovered.includes(r0)) && disc.discovered.length > disc.visited.length, { screen: s.screen, disc });
    await shot('pt-5-map.png');
    await keyTap('KeyM', 3); s = await state();
    check('7e M closes the map', s.screen === 'play', s.screen);

    // ===================== 8. boss 2: Weftyr → Burst Line =====================
    r = await cross(1);
    check('8a REAL INPUT lw_rest → R → lw_weftyr', r.ok && r.to === 'lw_weftyr' && r.exit === 'R', r);
    s = await stepUntil(x => x.bossFight === 'intro', 30);
    check('8b Weftyr intro starts on arrival', s.boss && s.boss.id === 'weftyr' && s.bossFight === 'intro', s.boss);
    fight = await bossMacro({ maxFrames: 5000, jumpEvery: 4 });
    check('8c Weftyr (flier) dies to the macro', fight.fight === 'dying' || fight.fight === 'reward', fight);
    s = await takeAbility('weftyr', 'burstLine', 'BURST LINE ACQUIRED');
    await D(d => d.teleport(20 * 30 + 15, 450)); await step(3);
    const dash = await page.evaluate(() => {
      const d = window.UB.debug, g = window.UB.game; const x0 = g.player.x; let maxVy = 0, dashing = false;
      d.pressed('right', 1); d.step(1); d.pressed('dash', 2);
      for (let i = 0; i < 14; i++) { d.step(1); if (g.player.dashing) dashing = true; if (Math.abs(g.player.vy) > maxVy) maxVy = Math.abs(g.player.vy); }
      return { dx: g.player.x - x0, maxVy, dashing };
    });
    check('8d Burst Line works: the dash key moves ~180 px in 12 f with vy = 0', dash.dashing && dash.dx >= 150 && dash.dx <= 200 && dash.maxVy < 1, dash);

    // ===================== 9. boss 3: Corrosant → Grip Protocol =====================
    await D(d => d.warp('bv_rest', 'L')); await step(2); await settleZone();
    r = await cross(1);
    check('9a REAL INPUT bv_rest → R → bv_corrosant', r.ok && r.to === 'bv_corrosant' && r.exit === 'R', r);
    s = await stepUntil(x => x.bossFight === 'intro', 30);
    const crust = await D((d, g) => g.level.openings.find(o => o.id === 'B').sealed);
    check('9b Corrosant intro starts; the brine crust over B is sealed', s.boss && s.boss.id === 'corrosant' && s.bossFight === 'intro' && crust === true, { boss: s.boss, crust });
    fight = await bossMacro({ maxFrames: 7000, jumpEvery: 4, reach: 10 });
    check('9c Corrosant (ceiling crawler + segments) dies to the macro', fight.fight === 'dying' || fight.fight === 'reward', fight);
    s = await takeAbility('corrosant', 'gripProtocol', 'GRIP PROTOCOL ACQUIRED');
    const crust2 = await D((d, g) => g.level.openings.find(o => o.id === 'B').sealed);
    check('9d the hatch B unseals after the fight', crust2 === false, crust2);
    // wall jump on the arena's left wall (column 0 above the L opening)
    await D(d => d.teleport(45, 630)); await step(3);
    const wj = await page.evaluate(() => {
      const d = window.UB.debug, g = window.UB.game; let clung = false, kicked = false, vxAfter = 0, vyAfter = 0;
      d.pressed('jump', 10); d.step(6);
      for (let i = 0; i < 40; i++) { d.pressed('left', 1); d.step(1); if (g.player.clinging) { clung = true; break; } }
      if (clung) { d.pressed('jump', 8); d.step(4); vxAfter = g.player.vx; vyAfter = g.player.vy; kicked = vxAfter > 100 && vyAfter < -300; }
      return { clung, kicked, vxAfter, vyAfter, x: g.player.x, y: g.player.y };
    });
    check('9e Grip Protocol works: holding into the wall clings, jump kicks off (vx away, vy up)', wj.clung && wj.kicked, wj);
    r = await cross(1, { allowDrop: true, maxFrames: 2000 });
    check('9f REAL INPUT bv_corrosant → drop through the unlocked hatch → B → ns_base', r.ok && r.to === 'ns_base' && r.exit === 'B', r);

    // ===================== 10. Rootwell: gauntlet, last node, final boss =====================
    await D(d => d.warp('rw_gate', 'T')); await step(2); await settleZone();
    s = await stepUntil(x => x.grounded, 120, 2);
    check('10a arriving through rw_gate.T lands on the row-3 grate', s.roomId === 'rw_gate' && s.grounded && s.y <= 120, { y: s.y, grounded: s.grounded });
    await step(120);   // let the gauntlet wake up (motes, valves) before timing it
    benches.push({ room: 'rw_gate (gauntlet)', b: await D(d => d.bench(120)) });
    r = await cross(1, { maxFrames: 3000 });
    check('10b REAL INPUT rw_gate (platewalkers, rootram, twin valves, broodcell) → R → rw_rest', r.ok && r.to === 'rw_rest' && r.exit === 'R', r);
    rest = await restAtNode(9);
    check('10c rest at node_rw_rest', rest.near === 'node_rw_rest' && rest.s.savedRoom === 'rw_rest', rest);
    r = await cross(1);
    check('10d REAL INPUT rw_rest → R → rw_throne', r.ok && r.to === 'rw_throne' && r.exit === 'R', r);
    s = await stepUntil(x => x.bossFight === 'intro', 30);
    check('10e Kernauth intro starts (final boss, phase 1)', s.boss && s.boss.id === 'kernauth' && s.boss.phase === 1 && s.bossFight === 'intro', s.boss);
    fight = await bossMacro({ maxFrames: 9000, jumpEvery: 5 });
    benches.push({ room: 'rw_throne (Kernauth)', b: await D(d => d.bench(60)) });
    check('10f Kernauth phase 1 → phase 2 (UNBOUND) → dies to the macro', fight.phases.includes(1) && fight.phases.includes(2) && (fight.fight === 'dying' || fight.fight === 'reward'), fight);
    await shot('pt-6-kernauth-death.png');
    s = await stepUntil(x => x.screen === 'victory' && !x.busy, 600, 5);
    const stats = await D((d, g) => g.victoryStats());
    check('10g the victory screen appears with run stats (fighter, time, deaths, bits, cores, rooms, enemies, 4/4 bosses)', s.screen === 'victory' && stats.fighter === 'TESSIK' && stats.bosses === '4/4' && stats.deaths === 1 && /^\d\d:\d\d:\d\d$/.test(stats.time) && stats.cores === '1/3', { screen: s.screen, stats });
    await step(240); await shot('pt-7-victory.png');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('underbyte.save') || 'null'));
    check('10h the save records the victory and all four bosses', saved && saved.victory === true && saved.bossesDefeated.length === 4, saved && { victory: saved.victory, bosses: saved.bossesDefeated });

    // ===================== 11. coverage + performance + errors =====================
    check('11a at least 6 rooms were crossed with real inputs (' + [...realRooms].join(', ') + ')', realRooms.size >= 6, [...realRooms]);
    check('11b at least 4 exit transitions fired naturally (' + naturalExits.length + ': ' + naturalExits.map(e => e.from + '.' + e.exit + '→' + e.to).join(', ') + ')', naturalExits.length >= 4, naturalExits);
    const worst = benches.reduce((a, b) => (b.b.avgTotal > a.b.avgTotal ? b : a), benches[0]);
    console.log('frame time (ms, tick+render):', benches.map(b => b.room + ' avg ' + b.b.avgTotal.toFixed(2) + ' (tick ' + b.b.avgTick.toFixed(2) + ', render ' + b.b.avgRender.toFixed(2) + ', max ' + b.b.maxTotal.toFixed(2) + ')').join(' | '));
    check('11c average frame time under 10 ms in the busiest room (' + worst.room + ': ' + worst.b.avgTotal.toFixed(2) + ' ms)', worst.b.avgTotal < 10, benches);
    check('11d no console errors or page errors during the playthrough', t.errors.length === 0, t.errors);
  } catch (e) {
    check('test threw: ' + (e && e.message ? e.message : String(e)), false, e && e.stack);
  }

  const fails = results.filter(x => !x.ok);
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' steps passed' + (fails.length ? ' — FAILED: ' + fails.map(f => f.name).join(' | ') : ''));
  if (t.errors.length) console.log('page errors:\n' + t.errors.join('\n'));
  await t.close();
  process.exit(fails.length ? 1 : 0);
})();
