/*
 * UNDERBYTE — test/pt-fixes-engine.cjs
 * Playtest fixes, ENGINE / integration lane (playtests/REPORT.md): the engine side of the playtest round.
 * Run:  node underbyte/test/pt-fixes-engine.cjs      (exit code 0 = all PASS)
 *
 *   B22 UB.debug.defeatBoss runs the faithful defeat path (Game.defeatBoss): no-argument / unknown ids never corrupt the
 *       save, a live boss dies the way its killing hit kills it (shots popped, defeat recorded + saved, dying → reward with
 *       bits, sparks and the module, the module's pickup finishing the fight), an intro in progress ends, Kernauth spends
 *       its phase and reaches the victory screen, a quit mid-fight leaves no fight state on the title
 *   B38 the boss camera frames the boss's focus point (focusX/focusY): Corrosant's ceiling head is in view from the grates,
 *       the fighter's feet never sink under the boss bar, and the fighter never leaves the view in the 1920 px rw_throne;
 *       a boss whose focus is off the view's left / right edge is marked by a chevron at that edge (not under an overlay)
 *   B34 (root) a melee box held out from the attacker's body knocks a fighter standing between body and box centre AWAY
 *       from the body (Game.knockOrigin), projectiles keep the box centre
 *   B25 game.buy() charges the vendor room's price (UB.Util.vendorPrice): rw_rest 70, dc_shrine 90 for SPARE CELL
 *   B19 save.hints.drop: the one-time drop-through hint is recorded in the save and survives a reload + CONTINUE
 *   B42 settings.reducedFlashing (default false, validated, persisted) and the REDUCED FLASHING settings row
 *   B31 a refused Overclock flashes the Overclock meter bar (DANGER trough + rim) for 6 f
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./harness.cjs');

const SHOTS = path.join(__dirname, 'shots');
const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok, info });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info).slice(0, 900) : ''));
}

function PE_INSTALL() {
  const UB = window.UB, d = UB.debug, g = UB.game;
  const Q = {};
  Q.render = function () { g.render(1); };
  Q.grab = function (x, y, w, h) {
    const c = document.getElementById('game'), dpr = g.dpr || 1;
    return c.getContext('2d').getImageData(Math.round(x * dpr), Math.round(y * dpr), Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr))).data;
  };
  Q.px = function (x, y) { const dd = Q.grab(x, y, 1, 1); return [dd[0], dd[1], dd[2]]; };
  Q.diff = function (a, b, tol) { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > (tol || 24)) n++; return n; };
  Q.texts = function () {
    const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, out = [];
    proto.fillText = function (s, x, y) { out.push([String(s), Math.round(x), Math.round(y)]); return orig.apply(this, arguments); };
    try { Q.render(); } finally { proto.fillText = orig; }
    return out;
  };
  Q.key = function (code, down) { window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: code, key: code, bubbles: true, cancelable: true })); };
  Q.tap = function (code, n) { Q.key(code, true); d.step(n || 1); Q.key(code, false); d.step(1); };
  Q.tilePx = function (tx, ty) { return { x: tx * 30 + 15, y: (ty + 1) * 30 }; };
  Q.settle = function () { for (let i = 0; i < 300 && !(g.screen === 'play' && !g.busy); i++) d.step(1); };
  /** a new run in play: every lore card marked seen, god on */
  Q.fresh = function (fighter) {
    d.toTitle(); d.newGame(fighter || 'tessik'); Q.settle();
    g.save.loreSeen = UB.IDS.zones.slice(); g.loreTimer = 0; g.loreZone = null; UB.UI.clearMessages(); d.god(true);
  };
  /** enter an arena through its L exit from the neighbouring room; returns the boss (fight state after `frames`) */
  Q.enter = function (from, room, frames) { d.warp(from, null); d.step(2); d.warp(room, 'L'); d.step(frames === undefined ? 152 : frames); return g.boss; };
  Q.enemyShots = function () { let n = 0; for (let i = 0; i < g.projectiles.length; i++) { const p = g.projectiles[i]; if (!p.dead && p.owner !== 'player') n++; } return n; };
  Q.saved = function () { try { return JSON.parse(localStorage.getItem('underbyte.save')); } catch (e) { return null; } };
  window.__PE = Q;
  return true;
}

(async () => {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  const t = await launch();
  const page = t.page;
  /** (UB, d, g, q, ...args) evaluator */
  const ev = (fn, ...args) => page.evaluate(({ src, args }) => { const f = new Function('UB', 'd', 'g', 'q', 'args', 'return (' + src + ')(UB, d, g, q, ...args)'); return f(window.UB, window.UB.debug, window.UB.game, window.__PE, args); }, { src: fn.toString(), args });
  async function shot(name) { await page.evaluate(() => window.UB.game.render(1)); await page.waitForTimeout(50); await page.screenshot({ path: path.join(SHOTS, 'pt-eng-' + name + '.png') }); }
  async function reload(clear) {
    if (clear) await page.evaluate(() => { localStorage.removeItem('underbyte.save'); localStorage.removeItem('underbyte.settings'); });
    await page.reload(); await page.waitForTimeout(250);
    await page.evaluate(PE_INSTALL);
    await ev((UB, d) => d.pauseLogic(true));
  }
  async function section(name, fn) {
    try { await fn(); } catch (e) { check(name + ': section threw ' + (e && e.message ? e.message : String(e)), false, e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e); }
  }

  try {
    await reload(true);

    // =============================================================================================== B22
    await section('B22', async () => {
      // a) no argument / unknown id outside an arena: refused, nothing recorded
      let r = await ev((UB, d, g, q) => {
        q.fresh('tessik');
        return { noArg: d.defeatBoss(), unknown: d.defeatBoss('nobody'), bd: g.save.bossesDefeated.slice() };
      });
      check('B22 defeatBoss() with no boss here and defeatBoss("nobody") return false and record nothing (no null in bossesDefeated)', r.noArg === false && r.unknown === false && r.bd.length === 0, r);

      // b) Weftyr mid-fight with live shots, no argument: the real kill path
      r = await ev((UB, d, g, q) => {
        q.fresh('tessik'); d.grant('echoJump', true);
        const b = q.enter('lw_rest', 'lw_weftyr');
        const o = { fight0: g.bossFight.state };
        for (let i = 0; i < 2400 && q.enemyShots() === 0; i++) { g.player.vx = 0; d.step(1); }
        o.shots = q.enemyShots();
        o.ret = d.defeatBoss();
        o.now = { fight: g.bossFight.state, dead: b.dead, shots: q.enemyShots(), bd: g.save.bossesDefeated.slice(), saved: (q.saved() || {}).bossesDefeated, burst: g.save.abilities.burstLine,
          sealed: g.level.openings.filter(op => op.sealed).length, song: UB.Audio.state().song };
        for (let i = 0; i < 400 && g.bossFight.state === 'dying'; i++) d.step(1);
        const ps = g.pickups.map(p => p.type);
        o.reward = { fight: g.bossFight.state, bits: ps.filter(x => x === 'bit').length, sparks: ps.filter(x => x === 'spark').length, module: ps.filter(x => x === 'ability').length, toast: UB.UI.toast1 };
        const m = g.pickups.find(p => p.type === 'ability');
        if (m) { d.teleport(m.x, m.y); }
        for (let i = 0; i < 400 && g.bossFight.state !== 'done'; i++) d.step(1);
        o.done = { fight: g.bossFight.state, boss: !!g.boss, mode: g.mode };
        return o;
      });
      check('B22 (Weftyr, mid-fight, ' + r.shots + ' live shots) defeatBoss() with no id beats the live boss: bossFight dying, every boss shot popped, the defeat recorded in memory and in the saved slot, Burst Line granted, the seals lifted',
        r.fight0 === 'fight' && r.shots > 0 && r.ret === true && r.now.fight === 'dying' && r.now.dead && r.now.shots === 0 && r.now.bd.join() === 'weftyr' && r.now.saved && r.now.saved.join() === 'weftyr' && r.now.burst && r.now.sealed === 0, r);
      check('B22 the dying → reward flow then plays as after a real kill: 5 large bits, 3 sparks, the ability module, "WEFTYR PURGED"; collecting the module ends the fight (done)',
        r.reward.fight === 'reward' && r.reward.bits === 5 && r.reward.sparks === 3 && r.reward.module === 1 && r.reward.toast === 'WEFTYR PURGED' && r.done.fight === 'done' && !r.done.boss && r.done.mode === 'normal', r);

      // c) during Tallock's intro card
      r = await ev((UB, d, g, q) => {
        q.fresh('korvask');
        q.enter('dc_shrine', 'dc_sentinel', 0);
        for (let i = 0; i < 120 && g.bossFight.state !== 'intro'; i++) { d.pressed('right', 1); d.step(1); }
        d.step(20);
        const o = { before: { fight: g.bossFight.state, mode: g.mode, locked: g.player.locked, card: UB.UI.cardT > 0 } };
        o.ret = d.defeatBoss('tallock');
        o.after = { fight: g.bossFight.state, mode: g.mode, locked: g.player.locked, card: UB.UI.cardT, ej: g.save.abilities.echoJump, sealed: g.level.openings.filter(op => op.sealed).length };
        return o;
      });
      check('B22 defeatBoss during the intro card ends the intro (mode normal, player unlocked, no card) and starts the death; Echo Jump granted, seals lifted',
        r.before.fight === 'intro' && r.before.mode === 'bossIntro' && r.before.locked && r.before.card && r.ret && r.after.fight === 'dying' && r.after.mode === 'normal' && !r.after.locked && r.after.card === 0 && r.after.ej && r.after.sealed === 0, r);

      // d) Kernauth (final, two phases) from its phase 1 intro: phase spent, finale, victory
      r = await ev((UB, d, g, q) => {
        q.fresh('tessik'); ['tallock', 'weftyr', 'corrosant'].forEach(id => d.defeatBoss(id));
        q.enter('rw_rest', 'rw_throne', 0);
        for (let i = 0; i < 160 && g.bossFight.state !== 'intro'; i++) { d.pressed('right', 1); d.step(1); }
        d.step(30);
        const b = g.boss, o = { intro: g.bossFight.state, phase0: b.phase };
        o.ret = d.defeatBoss('kernauth');
        o.after = { fight: g.bossFight.state, phase: b.phase, hidden: (g.level.hiddenProps || []).length, card: UB.UI.cardT };
        let n = 0; for (; n < 600 && g.screen !== 'victory'; n++) d.step(1);
        o.victory = { screen: g.screen, frames: n, flag: g.save.victory, saved: (q.saved() || {}).victory, bd: g.save.bossesDefeated.slice() };
        return o;
      });
      check('B22 defeatBoss("kernauth") in phase 1 spends the phase (throne burst, phase 2), shows no card over the death, then the finale reaches the victory screen with save.victory written (' + (r.victory && r.victory.frames) + ' f)',
        r.intro === 'intro' && r.phase0 === 1 && r.ret && r.after.fight === 'dying' && r.after.phase === 2 && r.after.hidden > 0 && r.after.card === 0 && r.victory.screen === 'victory' && r.victory.flag === true && r.victory.saved === true && r.victory.bd.indexOf('kernauth') >= 0, r);

      // e) a quit mid-fight leaves nothing on the title; f) a boss not live here: bookkeeping only, the screen stays
      r = await ev((UB, d, g, q) => {
        q.fresh('tessik');
        q.enter('dc_shrine', 'dc_sentinel');
        const o = { fight: g.bossFight.state };
        d.toTitle(); const s = d.state(); o.title = { screen: s.screen, fight: s.bossFight, mode: s.mode };
        q.fresh('vellix');
        o.ret = d.defeatBoss('corrosant'); d.step(1);
        const s2 = d.state(); o.off = { screen: s2.screen, room: s2.roomId, bf: s2.bossFight, bd: s2.bossesDefeated, grip: s2.abilities.gripProtocol, saved: (q.saved() || {}).bossesDefeated };
        return o;
      });
      check('B22 toTitle() during a fight leaves no fight state on the title (bossFight none)', r.fight === 'fight' && r.title.screen === 'title' && r.title.fight === 'none' && r.title.mode === 'normal', r);
      check('B22 defeatBoss of a boss that is not live here records it, grants its ability and writes the save, nothing else (play goes on in the same room)',
        r.ret && r.off.screen === 'play' && r.off.room === 'dc_wake' && r.off.bf === 'none' && r.off.bd.join() === 'corrosant' && r.off.grip && r.off.saved && r.off.saved.join() === 'corrosant', r);
    });

    // =============================================================================================== B38
    await section('B38', async () => {
      const r = await ev((UB, d, g, q) => {
        q.fresh('tessik'); ['tallock', 'weftyr'].forEach(id => d.defeatBoss(id));
        const b = q.enter('bv_rest', 'bv_corrosant'), A = b.A;
        // wait until the head rides the ceiling, then hold it there
        for (let i = 0; i < 3000 && !(b.hy < A.ceilY + 40 && b.state !== 'roar'); i++) { g.player.x = A.cx; g.player.y = A.floorY; g.player.vx = 0; d.step(1); }
        b.update = function () { this.t++; };
        const stand = function (x, y, n) {
          let worstFeet = -1e9;
          for (let i = 0; i < n; i++) { g.player.x = x; g.player.y = y; g.player.px = x; g.player.py = y; g.player.vx = 0; g.player.vy = 0; d.step(1); worstFeet = Math.max(worstFeet, g.player.y - g.cam.y); }
          return { camY: Math.round(g.cam.y), headScreenY: Math.round(b.focusY - g.cam.y), headScreenX: Math.round(b.focusX - g.cam.x), feetScreenY: Math.round(g.player.y - g.cam.y), worstFeet: Math.round(worstFeet), plScreenX: Math.round(g.player.x - g.cam.x) };
        };
        const o = { focus: { x: Math.round(b.focusX), y: Math.round(b.focusY) } };
        o.floor = stand(b.hx, A.floorY, 120);
        o.grate16 = stand(10 * 30 + 15, 16 * 30, 150);
        o.grate11 = stand(17 * 30 + 15, 11 * 30, 150);
        o.floorAgain = stand(b.hx, A.floorY, 150);
        // a fall from the high grate to the floor: the feet never drop under the view's lower band
        g.player.x = 17 * 30 + 15; g.player.y = 11 * 30; d.step(30);
        let worst = -1e9; d.teleport(25 * 30 + 15, 11 * 30 - 1);
        for (let i = 0; i < 90; i++) { d.step(1); worst = Math.max(worst, g.player.y - g.cam.y); }
        o.fallWorstFeet = Math.round(worst);
        return o;
      });
      await shot('b38-corrosant-grate');
      check('B38 on the row-16 grate the camera rises to frame Corrosant\'s ceiling head (head screen y ' + r.grate16.headScreenY + ', feet ' + r.grate16.feetScreenY + ')',
        r.grate16.headScreenY >= 40 && r.grate16.headScreenY <= 430 && r.grate16.feetScreenY <= 444 && r.grate16.feetScreenY > 100, r);
      check('B38 on the row-11 grate the head is in view too (head screen y ' + r.grate11.headScreenY + ')', r.grate11.headScreenY >= 40 && r.grate11.headScreenY <= 430 && r.grate11.feetScreenY <= 444, r);
      check('B38 from the floor the fighter\'s feet stay above the boss bar (screen y < 486; the view keeps its floor framing and the edge beacon marks the head)',
        r.floor.worstFeet < 486 && r.floorAgain.worstFeet < 486 && r.floor.camY === r.floorAgain.camY, r);
      check('B38 a fall from the high grate never carries the feet under the boss bar (worst feet screen y ' + r.fallWorstFeet + ')', r.fallWorstFeet < 486, r);

      const k = await ev((UB, d, g, q) => {
        q.fresh('orrubel'); ['tallock', 'weftyr', 'corrosant'].forEach(id => d.defeatBoss(id));
        const b = q.enter('rw_rest', 'rw_throne', 0);
        for (let i = 0; i < 400 && g.bossFight.state !== 'fight'; i++) { d.pressed('right', 1); d.step(1); }
        b.update = function () { this.t++; };   // hold the seated mass still
        const hold = function (x, n) { for (let i = 0; i < n; i++) { g.player.x = x; g.player.y = 630; g.player.px = x; g.player.py = 630; g.player.vx = 0; d.step(1); } };
        const out = [];
        for (const x of [45, 400, 1500, 1890]) {
          hold(x, 150);
          out.push({ x, sx: Math.round(g.player.x - g.cam.x), coreSX: Math.round(b.focusX - g.cam.x), coreSY: Math.round(b.focusY - g.cam.y), w: g.player.w });
        }
        // the phase-2 core flies the whole arena: with the focus at one end and the fighter at the other (1800 px apart)
        // the plain midpoint would put the fighter ~420 px off-screen
        const far = [];
        for (const [fx, x] of [[1860, 60], [60, 1860]]) {
          b.focusX = fx; hold(x, 200);
          far.push({ fx, x, sx: Math.round(g.player.x - g.cam.x), w: g.player.w });
        }
        return { fight: g.bossFight.state, out, far };
      });
      // inside by BOSS_CAM_SIDE (40 px) unless the room's own edge is nearer (the camera stops at the room bounds)
      const inside = (o) => { const m = Math.min(40, o.x, 1920 - o.x) - 1; return o.sx - o.w / 2 >= 0 && o.sx + o.w / 2 <= 960 && o.sx >= m && o.sx <= 960 - m; };
      check('B38 in the 1920 px rw_throne the fighter never leaves the view: at x 45 / 400 / 1500 / 1890 it stays 40 px inside the edges (or at the room\'s own edge)',
        k.fight === 'fight' && k.out.every(inside), k);
      check('B38 with the boss focus at the far end of rw_throne (1800 px away) the fighter stays in view, 40 px inside the edge', k.far.length === 2 && k.far.every(inside), k.far);
      check('B38 Kernauth\'s chest core (its focus) is in view whenever the fighter stands within 880 px of it', k.out.filter(o => Math.abs(o.x - 975) <= 880).every(o => o.coreSX >= 0 && o.coreSX <= 960 && o.coreSY >= 0 && o.coreSY <= 486), k);
    });

    // B38 side marker: a boss far off the view's side edge is marked at that edge (Tallock held at a far wall)
    await section('B38 marker', async () => {
      const r = await ev((UB, d, g, q) => {
        q.fresh('tessik');
        const b = q.enter('dc_shrine', 'dc_sentinel');
        b.update = function () { this.t++; };
        const out = {};
        const strip = function (x0) { q.render(); return q.grab(x0, 130, 24, 345); };
        const stage = function (bossX, plX) {
          b.x = bossX; b.px = bossX; b.focusX = bossX; b.focusY = b.y - 60;
          for (let i = 0; i < 150; i++) { g.player.x = plX; g.player.px = plX; g.player.vx = 0; d.step(1); }
        };
        for (const [side, bossX, plX, x0] of [['right', 1380, 60, 936], ['left', 60, 1380, 0]]) {
          stage(bossX, plX);
          const focusSX = Math.round(b.focusX - g.cam.x), plSX = Math.round(g.player.x - g.cam.x);
          const withM = strip(x0);
          const keep = b.focusX; b.focusX = g.cam.x + 480; const without = strip(x0); b.focusX = keep;   // same frame, focus in view: no marker
          // under the pause overlay: the same two renders must not differ (no marker drawn under a menu)
          g.openOverlay('pause'); d.step(1);
          const pWith = strip(x0); b.focusX = g.cam.x + 480; const pWithout = strip(x0); b.focusX = keep;
          g.closeOverlay(); d.step(1);
          out[side] = { focusSX, plSX, marker: q.diff(withM, without, 30), underPause: q.diff(pWith, pWithout, 30) };
        }
        return out;
      });
      await shot('b38-side-marker');
      check('B38 a boss off the view\'s right / left edge (fighter at the far wall) is marked by a chevron at that edge',
        r.right.focusSX > 960 && r.right.marker > 40 && r.left.focusSX < 0 && r.left.marker > 40, r);
      check('B38 the side marker is not drawn under the pause overlay', r.right.underPause === 0 && r.left.underPause === 0, r);
    });

    // =============================================================================================== B34 root
    await section('B34', async () => {
      const r = await ev((UB, d, g, q) => {
        q.fresh('tessik');
        const b = q.enter('dc_shrine', 'dc_sentinel'); d.god(false);
        b.update = function () { this.t++; };
        const pl = g.player, E = UB.Entity, h = b.hitA, f = b.facing || 1;
        const o = { facing: f };
        E.hitBoxWorld(b, 60, 40, 70, 40, h); h.facing = f;
        const boxC = h.x + h.w / 2;
        // between the body centre and the box centre (the fighter overlapping Tallock's front edge)
        pl.x = b.x + f * 30; o.originBetween = g.knockOrigin(h, pl) === b.x;
        pl.x = boxC + f * 20; o.originBeyond = g.knockOrigin(h, pl) === boxC;
        o.originProjectile = g.knockOrigin({ x: 100, y: 0, w: 20, h: 20, src: { x: 0, w: 30 } }, pl) === 110;
        o.originFar = g.knockOrigin({ x: b.x + f * 400, y: 0, w: 40, h: 20, src: b }, pl) === b.x + f * 400 + 20;
        // the real hit through resolveHits: the fighter between body and box centre is knocked AWAY from the body
        pl.x = b.x + f * 30; pl.y = b.y; pl.px = pl.x; pl.py = pl.y; pl.iframes = 0; pl.hp = pl.maxHp;
        h.hitList.length = 0; g.registerHit(h); g.resolveHits();
        o.vx = pl.vx; o.hp = pl.hp; o.max = pl.maxHp;
        d.god(true);
        return o;
      });
      check('B34 Game.knockOrigin: a fighter between Tallock\'s body and the Slab Swing box centre is knocked from the body; beyond the box centre, a projectile and a box away from the body keep the box centre',
        r.originBetween && r.originBeyond && r.originProjectile && r.originFar, r);
      check('B34 the Slab Swing landing on a fighter at Tallock\'s front edge knocks it away from his body (vx along his facing), never into it', r.hp === r.max - 1 && r.vx * r.facing > 0, r);
    });

    // =============================================================================================== B25 / E1
    await section('B25', async () => {
      const r = await ev((UB, d, g, q) => {
        const o = {};
        for (const room of ['dc_shrine', 'rw_rest']) {
          q.fresh('tessik'); d.warp(room, null); d.step(2); d.setBits(500);
          const res = d.buy('spare_cell');
          o[room] = { res, bits: g.save.bits, shown: UB.Util.vendorPrice(UB.IDS.vendorItems[0], room) };
        }
        q.fresh('tessik'); d.warp('rw_rest', null); d.step(2); d.setBits(119);
        o.poorAt119 = d.buy('hot_clock'); d.setBits(120); o.okAt120 = d.buy('hot_clock'); o.left = g.save.bits;
        return o;
      });
      check('B25 game.buy charges the vendor room\'s price: SPARE CELL 90 at dc_shrine, 70 at rw_rest (500 → 410 / 430)', r.dc_shrine.res === 'bought' && r.dc_shrine.bits === 410 && r.rw_rest.res === 'bought' && r.rw_rest.bits === 430 && r.rw_rest.shown === 70, r);
      check('B25 the affordability test uses the same price: HOT CLOCK at rw_rest is poor at 119 bits and bought at 120 (0 left)', r.poorAt119 === 'poor' && r.okAt120 === 'bought' && r.left === 0, r);
    });

    // =============================================================================================== B19 / E2
    await section('B19', async () => {
      let r = await ev((UB, d, g, q) => {
        q.fresh('tessik');
        const o = { fresh: g.save.hints.drop };
        d.warp('bv_sluice', 'T'); for (let i = 0; i < 160 && !(g.player.onGround && g.mode === 'normal'); i++) d.step(1);
        d.pressed('down', 40); d.step(40);
        o.shown = UB.UI.dropT > 0; o.recorded = g.save.hints.drop;
        d.save(); o.slot = (q.saved() || { hints: {} }).hints.drop;
        return o;
      });
      await reload(false);
      const r2 = await ev((UB, d, g, q) => {
        d.continueGame(); q.settle();
        const o = { cont: g.save.hints.drop };
        // a save written before the key existed loads with drop: false (the hint shows once more)
        const raw = q.saved(); delete raw.hints.drop; localStorage.setItem('underbyte.save', JSON.stringify(raw));
        o.legacy = g.readSave().hints.drop;
        return o;
      });
      check('B19 save.hints.drop starts false, is set when the drop-through hint shows and is written to the slot', r.fresh === false && r.shown && r.recorded === true && r.slot === true, r);
      check('B19 the drop hint stays "seen" after a reload + CONTINUE (sanitizeSave keeps hints.drop); an older save without the key loads it false', r2.cont === true && r2.legacy === false, r2);
    });

    // =============================================================================================== B42 / E3
    await section('B42', async () => {
      await reload(true);
      let r = await ev((UB, d, g, q) => {
        const o = { def: g.settings.reducedFlashing };
        q.fresh('tessik');
        q.tap('Escape'); q.tap('ArrowDown'); q.tap('ArrowDown'); q.tap('Enter');
        o.overlay = g.overlay;
        const tx = q.texts(); o.rows = tx.filter(t => UB.UI && ['MASTER VOLUME', 'MUSIC VOLUME', 'SFX VOLUME', 'SCREEN SHAKE', 'REDUCED FLASHING', 'SHOW HITBOXES', 'BACK'].indexOf(t[0]) >= 0).map(t => t[0] + '@' + t[2]);
        for (let i = 0; i < 4; i++) q.tap('ArrowDown');
        o.sel = UB.UI.sel; q.tap('Enter'); o.on = g.settings.reducedFlashing;
        o.stored = (JSON.parse(localStorage.getItem('underbyte.settings') || '{}')).reducedFlashing;
        q.tap('Escape'); q.tap('Escape');
        return o;
      });
      check('B42 settings.reducedFlashing defaults to false', r.def === false, r);
      check('B42 the settings list from play shows REDUCED FLASHING after SCREEN SHAKE (7 rows, BACK last)', r.overlay === 'settings' && r.rows.length === 7 && r.rows[4].indexOf('REDUCED FLASHING@') === 0 && r.rows[6].indexOf('BACK@') === 0, r);
      check('B42 Enter on REDUCED FLASHING (row 4) turns it on and writes underbyte.settings at once', r.sel === 4 && r.on === true && r.stored === true, r);
      await reload(false);
      r = await ev((UB, d, g, q) => {
        const o = { kept: g.settings.reducedFlashing };
        q.fresh('tessik'); d.warp('debug_room', null); d.step(5); UB.FX.clear();
        q.render(); const a = q.grab(380, 220, 200, 100), e0 = q.grab(0, 200, 6, 100);
        UB.FX.flash('#FF0000', 0.5, 10); q.render(); const b = q.grab(380, 220, 200, 100), e1 = q.grab(0, 200, 6, 100);
        o.centre = q.diff(a, b, 30); o.edge = q.diff(e0, e1, 30); UB.FX.clear();
        g.setSetting('reducedFlashing', false);
        return o;
      });
      check('B42 the setting survives a reload, and with it on a full-screen flash is only an edge pulse (centre unchanged, edge lit)', r.kept === true && r.centre <= 3 && r.edge > 20, r);
      await page.evaluate(() => localStorage.setItem('underbyte.settings', JSON.stringify({ version: 1, reducedFlashing: 'yes' })));
      await reload(false);
      r = await ev((UB, d, g, q) => {
        const o = { corrupt: g.settings.reducedFlashing };
        g.openOverlay('settings'); d.step(1);
        const tx = q.texts(); o.titleRows = tx.filter(t => ['MASTER VOLUME', 'REDUCED FLASHING', 'RESET SAVE', 'BACK'].indexOf(t[0]) >= 0).map(t => t[0] + '@' + t[2]);
        g.closeOverlay(); d.step(1);
        return o;
      });
      check('B42 a non-boolean reducedFlashing in the settings file falls back to false', r.corrupt === false, r);
      const back = r.titleRows.find(s => s.indexOf('BACK@') === 0), y = back ? +back.split('@')[1] : 999;
      check('B42 from the title the 8 rows (RESET SAVE included) fit inside the 360 px settings panel (BACK at y ' + y + ' ≤ 440)', r.titleRows.length === 4 && y <= 440, r);
    });

    // =============================================================================================== B31 meter cue
    await section('B31', async () => {
      const r = await ev((UB, d, g, q) => {
        q.fresh('tessik'); d.warp('debug_room', null); d.step(10);
        d.setMeter(60); d.step(2);
        q.render(); const calm = q.px(184, 92);
        d.pressed('overclock', 1);
        let f = 0; for (; f < 12 && !(g.player.denyT > 12 && g.player.denyKind === 'overclock'); f++) d.step(1);
        const o = { f, denyT: g.player.denyT, kind: g.player.denyKind, oc: g.player.ocActive || g.player.ocTransform > 0 };
        q.render(); o.flash = q.px(184, 92);
        d.step(10); q.render(); o.after = q.px(184, 92);
        return Object.assign(o, { calm });
      });
      const red = (p) => p[0] > 180 && p[1] < 110 && p[2] < 110;
      check('B31 a refused Overclock (meter 60) flashes the empty part of the Overclock meter in DANGER, then the bar returns to normal', !r.oc && r.kind === 'overclock' && !red(r.calm) && red(r.flash) && !red(r.after), r);
    });

    check('no console errors or page errors', t.errors.length === 0, t.errors);
  } catch (e) {
    check('test run threw: ' + (e && e.message), false, e && e.stack);
  }
  const failed = results.filter(r => !r.ok).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed' + (failed ? ', ' + failed + ' FAILED' : ''));
  await t.close();
  process.exit(failed ? 1 : 0);
})();
