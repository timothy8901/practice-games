/*
 * UNDERBYTE — test/qa-combat.cjs   (QA round 3, lens: COMBAT PER FIGHTER)
 * Run:  node underbyte/test/qa-combat.cjs      (exit code 0 = every check passed)
 *
 * Drives the game through window.UB.debug (CONTRACT §9) in headless Chromium from file://.
 * Rounds 1–2 (sections A–F) are kept verbatim; round 3 adds section G (real enemy types, live-AI bosses, movers, the pull, i-frame windows).
 * For each of the five fighters it verifies, against the DESIGN §3/§4 numbers:
 *   A  UB.Characters.DATA move tables = the §4.2 sheets (S/A/R, box, dmg, kb, hitstop, lunge, cancels, energy, meter, cost); no two fighters alike
 *   B  in debug_room: measured S/A/R on a whiff (±2 f); every move damages a stationary target for the DESIGN damage with the
 *      DESIGN knockback / hitstop / energy / meter; heavies and L3 launch the victim; cancel windows (hit / whiff / L3 re-chain /
 *      jump, dash, special cancels / heavy no-cancel / Vellix heavy jump-cancel / 20 f chain timeout); 6 f buffer; specials
 *      (cost, deny + lockout, grounded-only buffering, Pulse Line, Vault Stomp, Blink Strike, Sentry Pin, Bulwark Catch); air attack,
 *      down-strike + pogo (enemies, spikes, destructible projectiles → vy = −580); Overclock (20 f transform, 720 f, ×1.5 on EVERY move,
 *      +1 hitstop, reach ×1.2 / cx ×1.1, run/dash ×1.15, regen 6/s, kb taken ×0.5, 10 f revert, ultimate for 40); energy regen 3/s;
 *      hurt (1 heart, 16 f, 60 i-frames, hitstop 6, (240,−300)·weight); hazard freeze 30 f + 45 i-frames; spikes ignore i-frames;
 *      Burst Line 180 px (Vellix 210), vy = 0, 18 f cooldown; Echo Jump apex + release cut; Grip Protocol vectors, no cling on crumble;
 *      coyote 6 f, wall-coyote 5 f; the DESIGN §3.11 worked light-chain timing (kill frame of a 10 HP target); lunge maths;
 *      facing lock; buffers frozen in hitstop; hurt-interrupted specials vs. persisting projectiles; restore node energy refill
 *   C  the real dc_wake with the real scuttlebit (18 px) / driftmoth: EVERY move connects for its sheet damage, every special works,
 *      the patrolling scuttlebit dies to the light chain
 *   D  the real Tallock in dc_sentinel: L1 / heavy / pogo per fighter; Korvask's counter vs. a boss melee hit, a boss projectile,
 *      an unblockable; Clamp Press on a boss (32, not moved) and on two enemies (32 + 10)
 *   E  special deep-dives: Ring Toss culled through an exit must not lock the heavy, sentry clamp / no-target / range, Sightline wall
 *      clip + landing buffer, Pulse Line step-down + drop, Afterimage Storm (untargeted 90 px with gravity; targeted 30 px through +
 *      reverse), Quake Vault air (8 + 26), Clamp Press whiff 36 f, Counter-Slam 24 f, acid-puddle knockback
 *   F  death → game over → respawn (energy 50, meter 0), meter persists across rooms, Hot Clock ×1.5, Spare Cell 125
 *   G  (round 3) per fighter in the real dc_wake against EVERY enemy type's real takeHit: hopnode (full kb, hitstun 10+hitstop, heavy
 *      launch), rambyte (kbResist 0.5, Korvask's −100 pull), spitvalve / voltwheel / broodcell (kbResist 0: never moved), mote kill,
 *      glarewisp + droplatch by air attack, platewalker (front lights blocked + 25 % meter + pushed BACK, heavy guard-break, lights from
 *      behind, down-strike from above); the real scuttlebit's hitstun countdown; two targets per swing; Korvask's Chain Haul must not
 *      drag a scuttlebit into a contact hurt (god off); hurt knockback away from a source on the left; energy == cost fires; the
 *      ultimate denied at 39; an ultimate outliving the Overclock; Overclock buffered through the end of an attack; air-attack momentum;
 *      the ≥ 500 px/s dive; a new down-strike the frame after a pogo; dash facing lock; energy cap; wall jump → Echo Jump; Vellix's
 *      i-frame windows exactly f5–12 (Blink) / f1–38 (Storm); every special on the lw_belts moving belt over the static pool (Blink
 *      Strike must not leave the belt, the Pulse Line must ride it); every fighter vs every LIVE boss in its arena (a bot that runs,
 *      jumps, Echo-Jumps and attacks: Tallock dies, the others take ≥ 3 hits); the ultimates on the held Tallock (Sightline 20, Quake 26,
 *      Storm 24, Triad bolts); the static pool hazard (30 f freeze, 45 i-frames, meter/energy untouched)
 * Finally: no console/page errors.
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./harness.cjs');
const SHOTS = path.resolve(__dirname, 'shots');

const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info) : ''));
}
function near(name, got, want, tol, info) {
  const g = typeof got === 'number' ? Math.round(got * 100) / 100 : got;
  check(name + ' (' + g + ' ≈ ' + want + ' ±' + tol + ')', typeof got === 'number' && Math.abs(got - want) <= tol, info);
}
const uniq = (a) => a.filter((v, i) => a.indexOf(v) === i);
const IDS = ['tessik', 'brackmaw', 'vellix', 'orrubel', 'korvask'];

// DESIGN §4.1 / §4.2 — the pinned numbers (fields: s a r box dmg kb hitstop lunge hitCancel whiffCancel rechain jumpCancel energy meter cost)
const DESIGN = {
  tessik: { hp: 5, run: 235, accel: 2300, friction: 2600, airControl: 0.80, jumpVel: 640, gravity: 1800, weight: 1.00, djMult: 0.85, dash: [180, 12], wallSlide: 90, box: [22, 48], apex: 113.8, apexF: 21, djApex: 196, cost: 30, downLag: 6, killFrame: 21, chainHits: 3,
    moves: {
      light1: { s: 4, a: 3, r: 8, box: [30, -2, 44, 30], dmg: 3, kb: [180, -60], hitstop: 3, lunge: 40, hitCancel: 8, whiffCancel: 12, jumpCancel: 8, energy: 4, meter: 2 },
      light2: { s: 4, a: 3, r: 9, box: [32, -4, 48, 34], dmg: 3, kb: [200, -80], hitstop: 3, lunge: 40, hitCancel: 8, whiffCancel: 13, jumpCancel: 8, energy: 4, meter: 2 },
      light3: { s: 6, a: 4, r: 14, box: [38, -2, 56, 30], dmg: 5, kb: [380, -120], hitstop: 4, lunge: 90, hitCancel: 11, rechain: 17, jumpCancel: 11, energy: 6, meter: 4 },
      heavy: { s: 12, a: 5, r: 18, box: [34, 0, 56, 52], dmg: 9, kb: [460, -220], hitstop: 5, lunge: 0, energy: 10, meter: 6 },
      special: { s: 10, a: 0, r: 16, cost: 30 },
      air: { s: 5, a: 4, r: 10, box: [26, -6, 44, 40], dmg: 3, kb: [160, -40], hitstop: 3, energy: 4, meter: 2 },
      down: { s: 4, r: 6, box: [4, 26, 24, 30], dmg: 4, kb: [60, 120], hitstop: 3, energy: 5, meter: 3 },
      ultimate: { s: 12, a: 24, r: 16, cost: 40 },
    } },
  brackmaw: { hp: 6, run: 180, accel: 1200, friction: 1500, airControl: 0.55, jumpVel: 620, gravity: 2000, weight: 0.60, djMult: 1.00, dash: [180, 15], wallSlide: 110, box: [34, 54], apex: 96.1, apexF: 19, djApex: 192, cost: 40, downLag: 10, killFrame: 28, chainHits: 3,
    moves: {
      light1: { s: 6, a: 3, r: 10, box: [34, 2, 46, 36], dmg: 4, kb: [220, -60], hitstop: 4, lunge: 30, hitCancel: 10, whiffCancel: 15, jumpCancel: 10, energy: 4, meter: 2 },
      light2: { s: 6, a: 3, r: 11, box: [36, -2, 50, 40], dmg: 4, kb: [240, -80], hitstop: 4, lunge: 30, hitCancel: 10, whiffCancel: 16, jumpCancel: 10, energy: 4, meter: 2 },
      light3: { s: 9, a: 5, r: 18, box: [40, 6, 60, 46], dmg: 8, kb: [480, -160], hitstop: 5, lunge: 60, hitCancel: 15, rechain: 21, jumpCancel: 15, energy: 6, meter: 4 },
      heavy: { s: 16, a: 6, r: 24, box: [38, 4, 64, 60], dmg: 14, kb: [560, -300], hitstop: 6, lunge: 0, energy: 10, meter: 6 },
      special: { s: 14, a: 4, r: 22, box: [0, 12, 150, 56], dmg: 12, kb: [420, -320], hitstop: 7, cost: 40, meter: 5 },
      air: { s: 8, a: 4, r: 12, box: [32, 0, 48, 44], dmg: 5, kb: [260, -60], hitstop: 4, energy: 4, meter: 2 },
      down: { s: 6, r: 10, box: [4, 30, 34, 30], dmg: 7, kb: [80, 160], hitstop: 4, energy: 5, meter: 3 },
      ultimate: { s: 18, a: 6, r: 28, box: [0, 10, 300, 70], dmg: 26, kb: [560, -420], hitstop: 10, cost: 40 },
    } },
  vellix: { hp: 4, run: 300, accel: 3600, friction: 3200, airControl: 1.00, jumpVel: 615, gravity: 1750, weight: 1.30, djMult: 0.90, dash: [210, 10], wallSlide: 70, box: [18, 40], apex: 108.1, apexF: 21, djApex: 196, cost: 25, downLag: 5, killFrame: 29, chainHits: 4,
    moves: {
      light1: { s: 3, a: 2, r: 6, box: [26, 0, 36, 24], dmg: 2, kb: [140, -40], hitstop: 3, lunge: 60, hitCancel: 6, whiffCancel: 9, jumpCancel: 6, energy: 4, meter: 2 },
      light2: { s: 3, a: 3, r: 6, box: [30, -2, 44, 28], dmg: 3, kb: [160, -60], hitstop: 3, lunge: 60, hitCancel: 7, whiffCancel: 10, jumpCancel: 7, energy: 4, meter: 2 },
      light3: { s: 5, a: 3, r: 10, box: [34, -4, 48, 30], dmg: 3, kb: [300, -140], hitstop: 3, lunge: 110, hitCancel: 9, rechain: 15, jumpCancel: 9, energy: 6, meter: 4 },
      heavy: { s: 9, a: 5, r: 14, box: [30, -4, 52, 44], dmg: 6, kb: [380, -240], hitstop: 4, lunge: 0, jumpCancel: 15, energy: 10, meter: 6 },
      special: { s: 4, a: 8, r: 8, box: [6, 0, 34, 40], dmg: 7, kb: [220, -120], cost: 25, meter: 5 },
      air: { s: 4, a: 5, r: 8, box: [0, 0, 52, 46], dmg: 2, kb: [150, -60], hitstop: 3, energy: 4, meter: 2 },
      down: { s: 3, r: 5, box: [2, 24, 20, 28], dmg: 3, kb: [60, 120], hitstop: 3, energy: 5, meter: 3 },
      ultimate: { s: 6, a: 32, r: 10, box: [0, 0, 44, 46], dmg: 6, kb: [200, -160], cost: 40 },
    } },
  orrubel: { hp: 5, run: 215, accel: 1900, friction: 2200, airControl: 0.75, jumpVel: 630, gravity: 1800, weight: 1.10, djMult: 0.85, dash: [180, 12], wallSlide: 90, box: [24, 44], apex: 110.3, apexF: 21, djApex: 190, cost: 35, downLag: 7, killFrame: 39, chainHits: 4,
    moves: {
      light1: { s: 5, a: 3, r: 9, box: [44, -2, 64, 22], dmg: 2, kb: [120, -30], hitstop: 3, lunge: 0, hitCancel: 9, whiffCancel: 13, jumpCancel: 9, energy: 4, meter: 2 },
      light2: { s: 5, a: 3, r: 9, box: [46, 0, 68, 22], dmg: 3, kb: [140, -40], hitstop: 3, lunge: 0, hitCancel: 9, whiffCancel: 13, jumpCancel: 9, energy: 4, meter: 2 },
      light3: { s: 7, a: 4, r: 13, box: [50, -4, 76, 26], dmg: 4, kb: [320, -120], hitstop: 4, lunge: 0, hitCancel: 12, rechain: 18, jumpCancel: 12, energy: 6, meter: 4 },
      heavy: { s: 10, a: 0, r: 14, lunge: 0 },
      special: { s: 8, a: 0, r: 12, cost: 35 },
      air: { s: 5, a: 4, r: 10, box: [28, -4, 60, 36], dmg: 2, kb: [140, -40], hitstop: 3, energy: 4, meter: 2 },
      down: { s: 5, r: 7, box: [2, 26, 22, 28], dmg: 3, kb: [60, 120], hitstop: 3, energy: 5, meter: 3 },
      ultimate: { s: 8, a: 0, r: 12, cost: 40 },
    } },
  korvask: { hp: 6, run: 200, accel: 1500, friction: 1800, airControl: 0.60, jumpVel: 610, gravity: 1900, weight: 0.75, djMult: 1.00, dash: [180, 14], wallSlide: 100, box: [30, 56], apex: 97.9, apexF: 19, djApex: 196, cost: 20, downLag: 9, killFrame: 25, chainHits: 3,
    moves: {
      light1: { s: 5, a: 3, r: 9, box: [32, 2, 44, 34], dmg: 3, kb: [120, -40], hitstop: 3, lunge: 30, hitCancel: 9, whiffCancel: 13, jumpCancel: 9, energy: 4, meter: 2 },
      light2: { s: 5, a: 3, r: 10, box: [34, -2, 46, 38], dmg: 4, kb: [130, -50], hitstop: 4, lunge: 30, hitCancel: 9, whiffCancel: 14, jumpCancel: 9, energy: 4, meter: 2 },
      light3: { s: 8, a: 4, r: 16, box: [40, 0, 56, 44], dmg: 6, kb: [-200, -240], hitstop: 5, lunge: 0, hitCancel: 13, rechain: 19, jumpCancel: 13, energy: 6, meter: 4 },
      heavy: { s: 14, a: 5, r: 20, box: [36, 6, 58, 56], dmg: 11, kb: [520, -280], hitstop: 6, lunge: 40, energy: 10, meter: 6 },
      special: { s: 2, a: 16, r: 18, cost: 20 },
      air: { s: 7, a: 4, r: 12, box: [30, 4, 48, 44], dmg: 4, kb: [220, -40], hitstop: 4, energy: 4, meter: 2 },
      down: { s: 5, r: 9, box: [4, 30, 30, 30], dmg: 6, kb: [80, 160], hitstop: 4, energy: 5, meter: 3 },
      ultimate: { s: 8, a: 10, r: 18, cost: 40 },
    } },
};

(async () => {
  const t = await launch();
  const page = t.page;
  const ev = (fn, ...args) => page.evaluate(({ src, args }) => (new Function('d', 'g', 'args', 'return (' + src + ')(d, g, ...args)'))(window.UB.debug, window.UB.game, args), { src: fn.toString(), args });
  const evs = (code) => page.evaluate((code) => (new Function('d', 'g', code))(window.UB.debug, window.UB.game), code);
  const state = () => page.evaluate(() => window.UB.debug.state());
  const step = (n) => page.evaluate((n) => window.UB.debug.step(n), n);
  /** Step n frames one at a time, running `script` (d, g, i in scope) before each; returns one record per frame. */
  const log = (n, script) => page.evaluate(({ n, script }) => {
    const g = window.UB.game, d = window.UB.debug, In = window.UB.Input, FX = window.UB.FX, out = [];
    const pre = script ? new Function('d', 'g', 'i', script) : null;
    for (let i = 0; i < n; i++) {
      if (pre) pre(d, g, i);
      d.step(1);
      const pl = g.player, hb = [];
      for (let j = 0; j < g.dbgHitCount; j++) { const h = g.dbgHits[j]; if (h.owner === 'player') hb.push([Math.round(h.x), Math.round(h.y), Math.round(h.w), Math.round(h.h)]); }
      const e = g.enemies.map(e => ({ t: e.type, hp: e.hp, x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, vx: Math.round(e.vx * 6000) / 100, vy: Math.round(e.vy * 6000) / 100, hs: e.hitstun, st: e.state }));
      out.push({ f: i, mv: pl.moveName, mt: pl.moveT, st: pl.state, hb, x: Math.round(pl.x * 100) / 100, y: Math.round(pl.y * 100) / 100, vx: Math.round(pl.vx * 10) / 10, vy: Math.round(pl.vy * 10) / 10,
        en: Math.round(pl.energy * 100) / 100, me: Math.round(pl.meter * 100) / 100, oc: pl.ocActive, ocT: pl.ocTransform, ocL: pl.overclock, ocR: pl.ocRevert, ph: pl.sp.phase, ifr: pl.iframes, hurt: pl.hurtTimer, hp: pl.hp,
        hs: FX.hitstopFrames, mode: g.mode, dash: pl.dashing, dcd: pl.dashCd, aj: pl.airJumps, ad: pl.airDash, coy: pl.coyote, cl: pl.clinging, wd: pl.wallDir, wc: pl.wallCoyote, ch: pl.chain, cht: pl.chainTimer,
        con: pl.connected, ll: pl.landLag, lo: pl.lockout, gnd: pl.onGround, fac: pl.facing, guard: pl.guard, ro: !!pl.sp.ringOut, jb: In.state.jump.buffer,
        pr: g.projectiles.length, prs: g.projectiles.map(p => ({ k: p.hit ? p.hit.tag : '?', kind: p.kind || '', x: Math.round(p.x), y: Math.round(p.y), dead: !!p.dead })), e, boss: g.boss ? { hp: g.boss.hp, x: Math.round(g.boss.x), y: Math.round(g.boss.y) } : null, screen: g.screen });
    }
    return out;
  }, { n, script });
  async function start(id, x = 420, y = 450, room = 'debug_room') {
    await ev((d, g, id) => d.startGame(id), id);
    for (let i = 0; i < 60; i++) { const s = await state(); if (s.screen === 'play' && !s.busy) break; await step(5); }
    // real zones open a lore card 90 f after arrival (freezing the world): mark it seen so the checks run in normal play
    await ev((d, g, room, x, y) => { d.warp(room, { x, y }); d.killEnemies(); d.god(false); if (g.zone && g.save.loreSeen.indexOf(g.zone.id) < 0) g.save.loreSeen.push(g.zone.id); }, room, x, y);
    await step(5);
  }
  // A stationary 24-px-tall target with real gravity/collision (knockback shows) but no AI: a hopnode stub.
  const TARGET = 'd.killEnemies(); d.spawnEnemy("hopnode", 15, 14, {}); (function(){ const e = g.enemies[0]; e.hp = 999; e.maxHp = 999; e.update = function (game) { if (this.hitstun > 0) this.hitstun--; if (this.flash > 0) this.flash--; this.gravity(0.45, 12); this.moveAndCollide(game.level); }; })();';
  const TARGET10 = TARGET + ' g.enemies[0].kbResist = 0; g.enemies[0].hp = 10; g.enemies[0].maxHp = 10;';   // the §3.11 balance target: 10 HP, never moved
  const WALKER = 'd.killEnemies(); d.spawnEnemy("walker", 15, 14, { patrol: [15, 15] }); g.enemies[0].speed = 0; g.enemies[0].hp = 999; g.enemies[0].maxHp = 999;';
  const WALKER_AT = (tx) => `d.spawnEnemy("walker", ${tx}, 14, { patrol: [${tx}, ${tx}] }); g.enemies[g.enemies.length - 1].speed = 0; g.enemies[g.enemies.length - 1].hp = 999; g.enemies[g.enemies.length - 1].maxHp = 999;`;
  const SCUT = (tx) => `d.spawnEnemy("scuttlebit", ${tx}, 14, { patrol: [${tx}, ${tx}] }); g.enemies[g.enemies.length - 1].speed = 0; g.enemies[g.enemies.length - 1].hp = 999; g.enemies[g.enemies.length - 1].maxHp = 999;`;
  // a destructible 10×10 enemy-owned projectile sitting still at (x, y) (flags: 2 = projectile, 1 = unblockable)
  const PROJ = (x, y, flags, vx = 0) => `(function(){ const E = window.UB.Entity; const p = new E({ x: ${x}, y: ${y}, w: 10, h: 10, units: 'pxf' }); p.owner = 'enemy'; p.destructible = true; p.vx = ${vx}; p.hit = E.makeHit('enemy'); p.hit.dmg = 1; p.hit.flags = ${flags}; p.hit.src = p; p.hit.kind = 'projectile'; p.update = function (game) { this.x += this.vx; const h = this.hit; h.x = this.x - 5; h.y = this.y - 10; h.w = 10; h.h = 10; h.facing = -1; game.registerHit(h); }; p.draw = function () {}; g.spawnProjectile(p); })();`;
  const AT = (x, y, f = 1) => ` d.teleport(${x}, ${y}); g.player.facing = ${f};`;
  const hitFrame = (L) => { for (let i = 1; i < L.length; i++) if (L[i].e.length && L[i - 1].e.length && L[i].e[0].hp < L[i - 1].e[0].hp) return i; return -1; };
  const hitsOf = (L) => L.map((r, i) => i > 0 && r.e.length && L[i - 1].e.length && r.e[0].hp < L[i - 1].e[0].hp ? { f: i, dmg: L[i - 1].e[0].hp - r.e[0].hp, mv: r.mv, mt: r.mt, ph: r.ph, hs: r.hs, evx: r.e[0].vx, evy: r.e[0].vy } : null).filter(Boolean);
  const maxMt = (L, mv) => Math.max(0, ...L.filter(r => r.mv === mv).map(r => r.mt));
  /** setup (code), then 3 settle frames, then n logged frames, then `post` idle frames. */
  const CLEAR = 'window.UB.Input.releaseAll(); for (const a of window.UB.Input.ACTIONS) window.UB.Input.state[a].buffer = 0;';
  async function run(setup, script, n = 70, post = 30) { await evs(CLEAR + setup); await step(3); const L = await log(n, 'if (i === 0) g.__p = 0;' + (script || '')); if (post) await step(post); return L; }
  const once = (mv, mt, action) => `if (g.player.moveName === "${mv}" && g.player.moveT === ${mt} && !g.__p) { g.__p = 1; d.pressed("${action}", 1); }`;
  const chainTo = (n) => n > 1 ? `g.player.chain = ${n - 1}; g.player.chainTimer = 20;` : '';
  const btn = (name) => name === 'heavy' ? 'heavy' : name === 'special' || name === 'ultimate' ? 'special' : 'light';
  const overclockOn = async (x = 420, y = 450) => { await evs(CLEAR + 'd.killEnemies(); d.setMeter(100);' + AT(x, y)); await step(3); await log(30, 'if (i === 0) d.pressed("overclock", 1);'); };
  const overclockOff = async () => { await evs('g.player.overclock = 1;'); await step(30); };
  const reOverclock = async (x = 420, y = 450) => { await overclockOff(); await overclockOn(x, y); };   // the 720 f budget is spent by the long loops
  async function shot(file, clip) { await page.waitForTimeout(60); const f = path.join(SHOTS, file); await page.screenshot({ path: f, clip }); check('screenshot written: test/shots/' + file, fs.existsSync(f) && fs.statSync(f).size > 2000); }

  try {
    await page.evaluate(() => localStorage.removeItem('underbyte.save'));
    await page.reload(); await page.waitForTimeout(250);
    await ev((d) => d.pauseLogic(true));

    // ======================= A. roster + DATA = DESIGN sheets =======================
    const data = await page.evaluate(() => {
      const o = {}; for (const id in window.UB.Characters.DATA) { const d = window.UB.Characters.DATA[id]; o[id] = { hp: d.hp, run: d.run, accel: d.accel, friction: d.friction, airControl: d.airControl, jumpVel: d.jumpVel, gravity: d.gravity, weight: d.weight, djMult: d.djMult, dash: [d.dash.dist, d.dash.frames], wallSlide: d.wallSlide, box: [d.box.w, d.box.h], downLag: d.downLandLag, moves: {} };
        for (const k in d.moves) { const m = d.moves[k]; o[id].moves[k] = { name: m.name, s: m.s, a: m.a, r: m.r, box: m.box, dmg: m.dmg, kb: m.kb, hitstop: m.hitstop, lunge: m.lunge, hitCancel: m.hitCancel, whiffCancel: m.whiffCancel, rechain: m.rechain, jumpCancel: m.jumpCancel, energy: m.energy, meter: m.meter, cost: m.cost }; } }
      return o;
    });
    check('roster is the five pinned fighters in order', Object.keys(data).join(',') === IDS.join(','), Object.keys(data));
    for (const id of IDS) {
      const D = DESIGN[id], d = data[id], bad = [];
      for (const k of ['hp', 'run', 'accel', 'friction', 'airControl', 'jumpVel', 'gravity', 'weight', 'djMult', 'wallSlide', 'downLag']) if (d[k] !== D[k]) bad.push(k + '=' + d[k]);
      if (JSON.stringify(d.dash) !== JSON.stringify(D.dash) || JSON.stringify(d.box) !== JSON.stringify(D.box)) bad.push('dash/box');
      for (const mvName in D.moves) {
        const m = d.moves[mvName], want = D.moves[mvName];
        if (!m) { bad.push(mvName + ' missing'); continue; }
        for (const k in want) { const w = want[k], got = m[k]; const same = Array.isArray(w) ? JSON.stringify(w) === JSON.stringify(got) : (w === got || (w === 0 && (got === 0 || got === undefined))); if (!same) bad.push(mvName + '.' + k + '=' + JSON.stringify(got) + '≠' + JSON.stringify(w)); }
        if (typeof m.name !== 'string' || m.name.length < 3) bad.push(mvName + ' unnamed');
      }
      check('[' + id + '] DATA stats + 8 named moves match the DESIGN §4.1/§4.2 sheet', bad.length === 0, bad);
    }
    const sig = (id) => ['light1', 'light2', 'light3', 'heavy', 'air', 'down'].map(k => JSON.stringify([data[id].moves[k].box, data[id].moves[k].dmg, data[id].moves[k].s])).join('|');
    check('no two fighters have identical move tables', uniq(IDS.map(sig)).length === 5);

    // ======================= B. per fighter in the debug room =======================
    for (const id of IDS) {
      const D = DESIGN[id], M = D.moves, tag = '[' + id + '] ';
      await start(id);
      let s = await state();
      check(tag + 'starts in debug_room grounded with hp ' + D.hp, s.fighter === id && s.roomId === 'debug_room' && s.grounded && s.hp === D.hp, s);
      await ev((d) => d.god(true));

      // ---------- B1. whiff frame data (S/A/R ±2) ----------
      for (const name of ['light1', 'light2', 'light3', 'heavy', 'air', 'special', 'ultimate']) {
        if (name === 'ultimate') await overclockOn();
        const setup = 'd.killEnemies(); d.setEnergy(100);' + AT(420, 450);
        const script = name === 'air' ? 'if (i === 0) d.pressed("jump", 30); if (i === 6) d.pressed("light", 1);' : `if (i === 0) { ${chainTo(name === 'light2' ? 2 : name === 'light3' ? 3 : 1)} d.pressed("${btn(name)}", 1); }`;
        const L = await run(setup, script, 90, 10);
        const rows = L.filter(r => r.mv === name);
        const activeMts = uniq(rows.filter(r => r.hb.length).map(r => r.mt));
        const total = Math.max(0, ...rows.map(r => r.mt));
        const want = M[name];
        if (want.a > 0 && want.box) {
          const S = activeMts.length ? Math.min(...activeMts) - 1 : -99, A = activeMts.length, R = total - S - A;
          check(tag + name + ' whiff frame data S' + want.s + ' A' + want.a + ' R' + want.r + ' (±2)', Math.abs(S - want.s) <= 2 && Math.abs(A - want.a) <= 2 && Math.abs(R - want.r) <= 2, { S, A, R, total });
        } else {
          near(tag + name + ' total frames ' + (want.s + want.a + want.r), total, want.s + want.a + want.r, 2, { total });
          if (id === 'tessik' && name === 'special') near(tag + 'Pulse Line projectile spawns on f11', (rows.find(r => r.pr > 0) || { mt: -1 }).mt, 11, 1);
          if (id === 'orrubel' && name === 'heavy') near(tag + 'Ring launches on f11', (rows.find(r => r.pr > 0) || { mt: -1 }).mt, 11, 1);
          if (id === 'orrubel' && name === 'special') near(tag + 'Sentry placed on f9', (rows.find(r => r.pr > 0) || { mt: -1 }).mt, 9, 1);
          if (id === 'orrubel' && name === 'ultimate') check(tag + 'Sentry Triad places 3 sentries', Math.max(...rows.map(r => r.prs.filter(p => p.k === 'sentry').length)) === 3, rows.map(r => r.pr));
          if (id === 'korvask' && name === 'special') check(tag + 'Bulwark Catch phases raise → stance (f3–18) → whiff recovery', rows.some(r => r.mt === 3 && r.ph === 'stance') && rows.some(r => r.mt === 18 && r.ph === 'stance') && rows.some(r => r.mt === 19 && r.ph === 'whiff'), uniq(rows.map(r => r.mt + r.ph)));
          if (id === 'korvask' && name === 'ultimate') check(tag + 'Clamp Press whiff: wind f1–8, lunge f9–18 (110 px), R18 → 36 f', rows.some(r => r.mt === 8 && r.ph === 'wind') && rows.some(r => r.mt === 9 && r.ph === 'lunge') && Math.abs(Math.max(...rows.map(r => r.x)) - 420 - 110) < 1 && total === 36, { total, maxX: Math.max(...rows.map(r => r.x)), phases: uniq(rows.map(r => r.mt + r.ph)) });
          if (id === 'tessik' && name === 'ultimate') check(tag + 'Sightline beam ticks on f13, f19, f25, f31 (4 multi-ticks)', JSON.stringify(activeMts) === '[13,19,25,31]', activeMts);
        }
        if (name === 'ultimate') await overclockOff();
      }
      // energy cost on press; deny + 10 f lockout below cost
      let L = await run('d.killEnemies(); d.setEnergy(100);' + AT(420, 450), 'if (i === 0) d.pressed("special", 1);', 20, 80);
      near(tag + 'special costs ' + D.cost + ' energy on the press frame', 100 - L[0].en, D.cost, 0.2, L.slice(0, 2).map(r => r.en));
      L = await run('d.killEnemies(); d.setEnergy(D_COST - 1);'.replace('D_COST', D.cost) + AT(420, 450), 'if (i === 0) d.pressed("special", 1);', 20, 30);
      check(tag + 'special below cost is denied: no move, no energy spent, 10 f lockout', !L.some(r => r.mv) && L[0].en >= D.cost - 1.1 && L[0].lo === 10, { en: L[0].en, lo: L[0].lo, mv: uniq(L.map(r => r.mv)) });

      // ---------- B2. damage / knockback / hitstop / energy / meter per move vs a 24-px target ----------
      for (const name of ['light1', 'light2', 'light3', 'heavy', 'air', 'down', 'special']) {
        const want = M[name];
        if (!want.dmg) continue;                         // projectile / stance moves are covered in B5
        let setup, script;
        if (name === 'air') {
          setup = 'd.killEnemies(); d.spawnEnemy("driftmoth", 15, 12, {}); (function(){ const e = g.enemies[0]; e.hp = 999; e.maxHp = 999; e.update = function () { if (this.hitstun > 0) this.hitstun--; if (this.flash > 0) this.flash--; }; })(); d.setEnergy(50); d.setMeter(10);' + AT(420, 450);
          script = 'const e = g.enemies[0]; if (e) { e.x = g.player.x + 30 * g.player.facing; e.y = g.player.cy() + e.h / 2; } if (i === 0) d.pressed("jump", 30); if (i === 2) d.pressed("light", 1);';
        } else if (name === 'down') {
          setup = TARGET + ' d.setEnergy(50); d.setMeter(10); d.teleport(465, 372);';
          script = 'if (i === 0) { d.pressed("down", 40); d.pressed("light", 1); }';
        } else {
          setup = TARGET + ' d.setEnergy(50); d.setMeter(10);' + AT(420, 450);
          script = `if (i === 0) { ${chainTo(name === 'light2' ? 2 : name === 'light3' ? 3 : 1)} d.pressed("${btn(name)}", 1); }`;
        }
        L = await run(setup, script, name === 'special' ? 100 : 60, 40);
        const hf = hitFrame(L);
        if (hf < 0) { check(tag + name + ' connects with the target', false, { moves: uniq(L.map(r => r.mv)), boxes: L.filter(r => r.hb.length).slice(0, 2).map(r => r.hb), enemy: L[0].e }); continue; }
        const b = L[hf - 1], a = L[hf];
        check(tag + name + ' deals ' + want.dmg + ' dmg', b.e[0].hp - a.e[0].hp === want.dmg, { dmg: b.e[0].hp - a.e[0].hp, mv: a.mv });
        near(tag + name + ' energy +' + (want.energy || 0), a.en - b.en - 0.05, want.energy || 0, 0.11);
        near(tag + name + ' meter +' + want.meter, a.me - b.me, want.meter, 0.01);
        near(tag + name + ' world hitstop ' + (want.hitstop || 0) + ' f', a.hs, want.hitstop || 0, 0);
        const kbAway = id === 'brackmaw' && name === 'special';
        near(tag + name + ' knockback vx ' + want.kb[0], a.e[0].vx * (kbAway ? Math.sign(a.e[0].x - a.x) || 1 : 1), want.kb[0], 2);
        near(tag + name + ' knockback vy ' + want.kb[1], a.e[0].vy, want.kb[1], 2);
        if (name === 'heavy' || name === 'light3' || name === 'special') {
          const later = L.slice(hf + 1).filter(r => r.hs === 0 && r.e.length).slice(0, 6);
          check(tag + name + ' launches the victim (rises after the hit)', later.length >= 3 && Math.min(...later.map(r => r.e[0].y)) < a.e[0].y - 2, later.map(r => r.e[0].y));
        }
        if (name === 'down') {
          const pg = L.find(r => r.vy <= -575 && r.vy >= -585);
          check(tag + 'down-strike on an enemy pogoes: vy = −580, move ends, Echo Jump + air dash refreshed', !!pg && pg.aj === 1 && pg.ad === 1 && pg.mv === '', pg || L.slice(hf - 1, hf + 2));
        }
      }
      await ev((d) => d.god(false));

      // ---------- B3. pogo onto an enemy must never turn into contact damage (god OFF) ----------
      const sweep = [];
      for (const h of [352, 360, 366, 372, 380]) {
        for (let k = 0; k < 20 && (await state()).mode !== 'normal'; k++) await step(10);
        await evs(CLEAR + 'd.killEnemies(); ' + WALKER_AT(18) + ' d.setHp(' + D.hp + '); d.teleport(555, ' + h + ');'); await step(1);
        L = await log(30, 'if (i === 0) { d.pressed("down", 40); d.pressed("light", 1); }');
        const pg = L.find(r => r.vy <= -500), hurtF = L.findIndex(r => r.hurt > 0), hf = hitFrame(L);
        sweep.push({ h, hit: hf, pogo: !!pg, hurt: hurtF, hp: L[29].hp });
        await evs('d.killEnemies();'); await step(50);
      }
      check(tag + 'down-strike onto a walker from 5 heights: always a pogo, never a contact hurt (§3.6)', sweep.every(r => r.pogo && r.hurt < 0 && r.hp === D.hp), sweep);
      // pogo on floor spikes (tiles 10–11 row 14 of debug_room): vy −580, no damage, no hazard freeze
      await evs('d.killEnemies(); d.setHp(' + D.hp + '); d.teleport(330, 330);'); await step(1);
      L = await log(22, 'if (i === 0) { d.pressed("down", 40); d.pressed("light", 1); }');
      const spg = L.find(r => r.vy <= -500);
      check(tag + 'down-strike on floor spikes pogoes (vy ≈ −580 before gravity), no damage, no freeze', !!spg && spg.vy >= -582 && spg.vy <= -540 && spg.hp === D.hp && !L.some(r => r.mode === 'hazard'), spg || L.slice(8, 16).map(r => [r.y, r.vy, r.mode]));
      await evs('d.teleport(420, 450);'); await step(20);
      // pogo on a destructible enemy projectile: vy −580, the projectile pops, no hurt
      await evs(CLEAR + 'd.killEnemies(); d.setHp(' + D.hp + ');' + AT(420, 330)); await step(1);
      L = await log(40, 'if (i === 0) ' + PROJ(420, 400, 2) + ' if (i === 1) { d.pressed("down", 40); d.pressed("light", 1); }');
      const ppg = L.find(r => r.vy <= -575 && r.vy >= -585);
      check(tag + 'down-strike on a destructible enemy projectile pogoes (vy = −580), pops it, no hurt', !!ppg && L[39].pr === 0 && !L.some(r => r.hurt > 0) && L[39].hp === D.hp, { ppg: ppg && [ppg.f, ppg.vy], pr: L[39].pr, hp: L[39].hp });
      await step(30);
      // landing lag after a whiffed down-strike
      await evs('d.killEnemies(); d.setHp(' + D.hp + ');' + AT(420, 400)); await step(1);
      L = await log(60, 'if (i === 0) { d.pressed("down", 60); d.pressed("light", 1); } if (i >= 2) d.pressed("light", 1);');
      const landF = L.findIndex(r => r.gnd), nextLight = L.findIndex(r => r.f > landF && r.mv === 'light1');
      near(tag + 'down-strike landing lag ' + D.downLag + ' f (next light after landing)', nextLight - landF, D.downLag, 0, { landF, nextLight });
      // down-strike keeps air control (§3.6) and an airborne Heavy press is a Down-Strike (§3.5)
      await ev((d) => d.god(true));
      L = await run('d.killEnemies();' + AT(420, 300), 'if (i === 0) { d.pressed("down", 40); d.pressed("light", 1); } if (i >= 2) d.pressed("right", 1);', 10, 30);
      check(tag + 'down-strike keeps air control (vx grows while holding right, facing locked)', L.slice(2, 8).every(r => r.mv === 'down') && L[7].vx > L[3].vx && L[7].vx > 20 && L[7].fac === 1, L.map(r => [r.mv, r.vx]));
      L = await run('d.killEnemies();' + AT(420, 450), 'if (i === 0) d.pressed("jump", 20); if (i === 6) d.pressed("heavy", 1);', 12, 40);
      check(tag + 'airborne Heavy press is a Down-Strike', L.some(r => r.mv === 'down') && !L.some(r => r.mv === 'heavy'), uniq(L.map(r => r.mv)));

      // ---------- screenshot: L3 connecting with the target, hitboxes shown ----------
      await evs(CLEAR + TARGET + AT(420, 450) + ' d.showHitboxes(true);'); await step(3);
      await page.evaluate(() => { const d = window.UB.debug, g = window.UB.game; g.player.chain = 2; g.player.chainTimer = 20; d.pressed('light', 1); for (let i = 0; i < 40; i++) { d.step(1); const pl = g.player; if (pl.moveName === 'light3' && pl.moveT === pl.move.s + 2) break; } });
      await shot('qa-combat-' + id + '-l3.png', { x: 0, y: 0, width: 1280, height: 720 });
      await evs('d.showHitboxes(false);'); await step(40);

      // ---------- B4. light-chain cancel windows ----------
      L = await run(TARGET + AT(420, 450), 'if (i === 0) d.pressed("light", 1);' + once('light1', M.light1.hitCancel - 2, 'light'));
      check(tag + 'L1 hit-cancel → L2 starts on f' + M.light1.hitCancel, maxMt(L, 'light1') === M.light1.hitCancel - 1 && L.some(r => r.mv === 'light2') && L.some(r => r.con), { l1: maxMt(L, 'light1'), l2: L.some(r => r.mv === 'light2') });
      L = await run('d.killEnemies();' + AT(420, 450), 'if (i === 0) d.pressed("light", 1);' + once('light1', M.light1.whiffCancel - 2, 'light'));
      check(tag + 'L1 whiff-cancel → L2 starts on f' + M.light1.whiffCancel, maxMt(L, 'light1') === M.light1.whiffCancel - 1 && L.some(r => r.mv === 'light2'), { l1: maxMt(L, 'light1') });
      L = await run('d.killEnemies();' + AT(420, 450), 'if (i === 0) d.pressed("light", 1);' + once('light1', M.light1.whiffCancel - 5, 'light'));
      check(tag + 'light pressed early is buffered 6 f and still chains on the whiff-cancel frame', maxMt(L, 'light1') === M.light1.whiffCancel - 1 && L.some(r => r.mv === 'light2'), { l1: maxMt(L, 'light1') });
      L = await run(TARGET + AT(420, 450), `if (i === 0) { ${chainTo(3)} d.pressed("light", 1); }` + once('light3', M.light3.rechain - 2, 'light'));
      check(tag + 'L3 hit re-chains to L1 on f' + M.light3.rechain, maxMt(L, 'light3') === M.light3.rechain - 1 && L.some(r => r.f > 2 && r.mv === 'light1' && r.ch === 1), { l3: maxMt(L, 'light3') });
      L = await run('d.killEnemies();' + AT(420, 450), `if (i === 0) { ${chainTo(3)} d.pressed("light", 1); } if (i > 2 && i % 4 === 0) d.pressed("light", 1);`, 90);
      check(tag + 'L3 whiff has no cancel (full ' + (M.light3.s + M.light3.a + M.light3.r) + ' f) then L1', maxMt(L, 'light3') === M.light3.s + M.light3.a + M.light3.r && (L.find(r => r.f > 3 && r.mv && r.mv !== 'light3') || {}).mv === 'light1', { l3: maxMt(L, 'light3') });
      L = await run(TARGET + AT(420, 450), `if (i === 0) { ${chainTo(3)} d.pressed("light", 1); }` + once('light3', M.light3.hitCancel - 2, 'jump'));
      check(tag + 'L3 hit jump-cancel on f' + M.light3.hitCancel, maxMt(L, 'light3') === M.light3.hitCancel - 1 && L.some(r => r.st === 'jump' && r.vy < -200), { l3: maxMt(L, 'light3') });
      L = await run(TARGET + ' d.grant("burstLine", true);' + AT(420, 450), `if (i === 0) { ${chainTo(3)} d.pressed("light", 1); }` + once('light3', M.light3.hitCancel - 2, 'dash'));
      check(tag + 'L3 hit dash-cancel on f' + M.light3.hitCancel, maxMt(L, 'light3') === M.light3.hitCancel - 1 && L.some(r => r.dash), { l3: maxMt(L, 'light3') });
      await ev((d) => d.grant('burstLine', false));
      L = await run(TARGET + ' d.setEnergy(100);' + AT(420, 450), `if (i === 0) { ${chainTo(3)} d.pressed("light", 1); }` + once('light3', M.light3.hitCancel - 2, 'special'), 90);
      check(tag + 'L3 hit special-cancel on f' + M.light3.hitCancel, maxMt(L, 'light3') === M.light3.hitCancel - 1 && L.some(r => r.mv === 'special'), { l3: maxMt(L, 'light3') });
      L = await run(TARGET + AT(420, 450), `if (i === 0) { ${chainTo(2)} d.pressed("light", 1); }` + once('light2', M.light2.jumpCancel - 2, 'jump'));
      check(tag + 'L2 hit jump-cancel on f' + M.light2.jumpCancel, maxMt(L, 'light2') === M.light2.jumpCancel - 1 && L.some(r => r.st === 'jump'), { l2: maxMt(L, 'light2') });
      // a DENIED special (no energy) must not cancel a light: DESIGN §3.7 "a press with insufficient energy does nothing except deny + 10 f lockout"
      const l1Total = M.light1.s + M.light1.a + M.light1.r;
      L = await run(TARGET + ' d.setEnergy(0);' + AT(420, 450), 'if (i === 0) d.pressed("light", 1);' + once('light1', M.light1.hitCancel - 2, 'special'), 40, 20);
      check(tag + 'a denied special press (0 energy) does not hit-cancel L1 (L1 runs its ' + l1Total + ' f; deny lockout only)', maxMt(L, 'light1') === l1Total && !L.some(r => r.mv === 'special'), { l1: maxMt(L, 'light1'), lockoutAt: L.findIndex(r => r.lo === 10), moves: uniq(L.map(r => r.mv)) });
      const ht = M.heavy.s + M.heavy.a + M.heavy.r;
      L = await run(TARGET + AT(420, 450), 'if (i === 0) d.pressed("heavy", 1); if (i >= 2 && i % 3 === 0) d.pressed("light", 1);', 80);
      check(tag + 'heavy cannot be cancelled by lights (full ' + ht + ' f)', maxMt(L, 'heavy') === ht, { heavy: maxMt(L, 'heavy') });
      L = await run(TARGET + AT(420, 450), 'if (i === 0) d.pressed("heavy", 1); if (i >= 2 && i % 3 === 0) d.pressed("jump", 1);', 80);
      if (id === 'vellix') check(tag + 'Tailwhip Vault jump-cancels on hit from f15', maxMt(L, 'heavy') === 14 && L.some(r => r.st === 'jump'), { heavy: maxMt(L, 'heavy') });
      else check(tag + 'heavy cannot be jump-cancelled (full ' + ht + ' f)', maxMt(L, 'heavy') === ht, { heavy: maxMt(L, 'heavy') });
      for (const back of [3, 8]) {
        L = await run('d.killEnemies();' + AT(420, 450), 'if (i === 0) d.pressed("heavy", 1);' + once('heavy', ht - back, 'light'), 80);
        const l1 = L.find(r => r.mv === 'light1');
        if (back === 3) check(tag + 'light pressed 3 f before the heavy ends is buffered and starts on f' + (ht + 1), !!l1 && l1.f === ht, { l1: l1 && l1.f });
        else check(tag + 'light pressed 8 f before the heavy ends expires (6 f buffer)', !l1, { l1: l1 && l1.f });
      }
      const l1t = M.light1.s + M.light1.a + M.light1.r;
      for (const gap of [19, 21]) {
        L = await run('d.killEnemies();' + AT(420, 450), 'if (i === 0) d.pressed("light", 1); if (i === ' + (l1t + gap) + ') d.pressed("light", 1);', 90);
        const second = L.find(r => r.f > l1t + gap && r.mv);
        check(tag + 'chain timeout 20 f: a light ' + gap + ' f after L1 ends is ' + (gap < 20 ? 'L2' : 'L1'), !!second && second.mv === (gap < 20 ? 'light2' : 'light1'), second && second.mv);
      }
      // DESIGN §3.11 worked timing: mashing light vs a 10 HP target (kbResist 0, never moved) kills on the pinned frame (hitstop ticks excluded)
      L = await run(TARGET10 + AT(420, 450), 'd.pressed("light", 1);', 80, 30);
      { let frozen = 0; const hits = [];
        for (let i = 1; i < L.length; i++) { if (L[i - 1].hs > 0) frozen++; const r = L[i]; if (L[i - 1].e.length && (r.e.length === 0 || r.e[0].hp < L[i - 1].e[0].hp)) hits.push({ pf: i + 1 - frozen, mv: r.mv, hp: r.e.length ? r.e[0].hp : 0 }); }
        check(tag + '§3.11 light chain vs 10 HP: ' + D.chainHits + ' hits, kill on player frame f' + D.killFrame, hits.length === D.chainHits && hits[hits.length - 1].pf === D.killFrame && hits[hits.length - 1].hp === 0, hits); }
      // lunge: on f1 vx *= 0.5 then +lunge, friction applies (§3.5)
      L = await run('d.killEnemies();' + AT(300, 450), 'if (i < 30) d.pressed("right", 1); if (i === 30) d.pressed("light", 1);', 32, 20);
      near(tag + 'L1 f1 velocity = 0.5·run + lunge − friction/60', (L.find(r => r.mv === 'light1' && r.mt === 1) || { vx: -1 }).vx, Math.max(0, D.run * 0.5 + M.light1.lunge - D.friction / 60), 0.6, L.slice(29, 32).map(r => [r.mv, r.mt, r.vx]));
      // facing locks and movement input is ignored during a grounded attack (§3.1, §3.5)
      L = await run('d.killEnemies();' + AT(420, 450), 'if (i === 0) d.pressed("light", 1); if (i >= 1) d.pressed("left", 1);', l1t, 20);
      check(tag + 'facing locks and movement input is ignored for the whole L1', L.every(r => r.mv === 'light1' && r.fac === 1 && Math.abs(r.x - 420) < 1.5), uniq(L.map(r => r.fac + '/' + Math.round(r.x))));

      // ---------- B5. special / ultimate mechanics ----------
      if (id === 'tessik') {
        L = await run(WALKER + ' d.setEnergy(100); d.setMeter(10);' + AT(420, 450), 'if (i === 0) d.pressed("special", 1); if (i === 20) d.pressed("special", 1);', 100, 20);
        const hf = hitFrame(L);
        check(tag + 'Pulse Line hits the walker for 6, kb (260,−200), +5 meter, local hitstop only', hf > 0 && L[hf - 1].e[0].hp - L[hf].e[0].hp === 6 && Math.abs(L[hf].e[0].vx - 260) < 2 && Math.abs(L[hf].e[0].vy + 200) < 2 && L[hf].me - L[hf - 1].me === 5 && L[hf].hs === 0 && L[hf].e[0].hs === 14, hf > 0 ? L[hf] : L.slice(10, 14));
        check(tag + 'Pulse Line: one at a time (second press refused, no energy charged)', Math.max(...L.map(r => r.pr)) === 1 && L.filter((r, i) => i > 0 && r.en < L[i - 1].en - 1).length === 0 && L[0].en <= 70.1, { maxPr: Math.max(...L.map(r => r.pr)), drops: L.filter((r, i) => i > 0 && r.en < L[i - 1].en - 1).map(r => r.f), en0: L[0].en });
        L = await run('d.killEnemies(); d.setEnergy(100);' + AT(100, 450), 'if (i === 0) d.pressed("special", 1);', 80, 20);
        const pr2 = L.filter(r => r.pr > 0);
        check(tag + 'Pulse Line: 420 px/s along the floor, dies by 56 f / 390 px', pr2.length >= 50 && pr2.length <= 57 && Math.abs(pr2[1].prs[0].x - pr2[0].prs[0].x - 7) < 0.2 && uniq(pr2.map(r => r.prs[0].y)).length === 1 && pr2[pr2.length - 1].prs[0].x - pr2[0].prs[0].x <= 392, { alive: pr2.length, travelled: pr2.length ? pr2[pr2.length - 1].prs[0].x - pr2[0].prs[0].x : null });
        L = await run('d.killEnemies(); d.setEnergy(100);' + AT(600, 450), 'if (i === 0) d.pressed("special", 1);', 60, 20);
        const last = L.filter(r => r.pr > 0).pop();
        check(tag + 'Pulse Line dies at a wall', !!last && last.prs[0].x <= 708 && last.f < 30, last);
        // snaps to the floor: steps down one tile (30 px) from the one-way shelf onto the block, then dies at the 90 px drop
        L = await run('d.killEnemies(); d.setEnergy(100);' + AT(660, 330), 'if (i === 0) d.pressed("special", 1);', 70, 20);
        const pp = L.filter(r => r.pr > 0).map(r => r.prs[0]);
        check(tag + 'Pulse Line snaps to the floor: steps down the 30 px edge (y 330 → 360) and dies at the 90 px drop', pp.some(p => p.y === 330) && pp.some(p => p.y === 360) && pp.every(p => p.y === 330 || p.y === 360) && pp[pp.length - 1].x < 830, { ys: uniq(pp.map(p => p.y)), lastX: pp.length ? pp[pp.length - 1].x : null });
        await evs('d.killEnemies(); d.setEnergy(100);' + AT(420, 450)); await step(3);
        let L0 = await log(60, 'if (i === 0) d.pressed("jump", 5);'); const lf = L0.findIndex((r, i) => i > 3 && r.gnd);
        await evs('d.setEnergy(100);' + AT(420, 450)); await step(3);
        L = await log(60, 'if (i === 0) d.pressed("jump", 5); if (i === ' + (lf - 3) + ') d.pressed("special", 1);');
        check(tag + 'airborne special press is buffered and fires on landing', !L.some(r => r.mv === 'special' && !r.gnd) && L.some(r => r.mv === 'special' && r.f >= lf), { lf, sp: (L.find(r => r.mv === 'special') || {}).f });
        // hurt-interrupt: a hit during the startup cancels the special (no projectile); a fired Pulse Line persists through a hurt
        await ev((d) => d.god(false));
        L = await run('d.killEnemies(); d.setEnergy(100); d.setHp(5);' + AT(560, 450), 'if (i === 0) d.pressed("special", 1); if (i === 3) { ' + WALKER_AT(14) + ' g.enemies[0].x = g.player.x; }', 40, 20);
        check(tag + 'a hurt during the Pulse Line startup cancels it: no projectile, move gone', L.findIndex(r => r.hurt > 0) >= 0 && !L.some(r => r.pr > 0) && !L.some(r => r.f > 6 && r.mv === 'special'), { hurtAt: L.findIndex(r => r.hurt > 0), pr: Math.max(...L.map(r => r.pr)) });
        await evs('d.killEnemies();'); await step(60);
        L = await run('d.killEnemies(); d.setEnergy(100); d.setHp(5);' + AT(560, 450), 'if (i === 0) d.pressed("special", 1); if (i === 14) { ' + WALKER_AT(12) + ' g.enemies[0].x = g.player.x; }', 40, 20);
        check(tag + 'a fired Pulse Line persists through a hurt (§3.2)', L.findIndex(r => r.hurt > 0) >= 14 && L.slice(16, 30).every(r => r.pr >= 1), { hurtAt: L.findIndex(r => r.hurt > 0), pr: L.slice(16, 30).map(r => r.pr) });
        await evs('d.killEnemies();'); await step(60);
        await ev((d) => d.god(true));
      }
      if (id === 'brackmaw') {
        L = await run(WALKER + ' ' + WALKER_AT(12) + AT(420, 450), 'if (i === 0) d.pressed("special", 1);', 40, 20);
        const hf = hitFrame(L);
        check(tag + 'Vault Stomp (ground) hits both sides for 12 with "away" knockback', hf > 0 && L[hf].e[0].hp === 987 && L[hf].e[1].hp === 987 && L[hf].e[0].vx > 400 && L[hf].e[1].vx < -400 && L[hf].e[0].vy < -300, hf > 0 ? L[hf].e : null);
        for (const god of [true, false]) {
          await ev((d, g, gg) => d.god(gg), god);
          L = await run('d.killEnemies(); d.setEnergy(100); d.setHp(6);' + AT(420, 450), 'if (i === 0) d.pressed("jump", 25); if (i === 10) { ' + WALKER_AT(14) + ' g.enemies[0].x = g.player.x; } if (i === 14) d.pressed("special", 1);', 90, 20);
          const hits = hitsOf(L);
          if (god) check(tag + 'air Vault Stomp: dive at 1400 px/s hits for 6, landing burst hits for 12', L.some(r => r.ph === 'dive' && r.vy >= 1390) && hits.length === 2 && hits[0].dmg === 6 && hits[0].ph === 'dive' && hits[1].dmg === 12 && hits[1].ph === 'burst', hits);
          else check(tag + 'air Vault Stomp onto an enemy (god off) must not hurt Brackmaw / cancel the burst', hits.length === 2 && L[89].hp === 6 && !L.some(r => r.hurt > 0), { hits, hp: L[89].hp, hurtAt: L.findIndex(r => r.hurt > 0) });
        }
        await ev((d) => d.god(true));
        L = await run('d.killEnemies(); d.setHp(6);' + AT(560, 450), 'if (i === 0) d.pressed("heavy", 1); if (i === 8) { ' + WALKER_AT(14) + ' g.enemies[0].x = g.player.x + 20; } if (i === 7) d.god(false);', 60, 20);
        check(tag + 'Anvil Drop armour f6–22: contact damages (6→5) but never interrupts the heavy; hurt i-frames still start', L[59].hp === 5 && maxMt(L, 'heavy') === 46 && !L.some(r => r.hurt > 0) && L.some(r => r.f < 30 && r.ifr >= 58), { hp: L[59].hp, heavy: maxMt(L, 'heavy'), hurt: L.filter(r => r.hurt > 0).length, ifr: Math.max(...L.map(r => r.ifr)) });
        await ev((d) => d.god(false));
        await evs('d.killEnemies();'); await step(60);
        L = await run('d.killEnemies(); d.setEnergy(100); d.setHp(6);' + AT(560, 450), 'if (i === 0) d.pressed("special", 1); if (i === 3) { ' + WALKER_AT(14) + ' g.enemies[0].x = g.player.x; }', 40, 20);
        check(tag + 'a hurt during the Vault Stomp wind-up cancels it (no burst)', L.findIndex(r => r.hurt > 0) >= 0 && !L.some(r => r.ph === 'burst') && !L.some(r => r.f > 6 && r.mv === 'special'), { hurtAt: L.findIndex(r => r.hurt > 0), phases: uniq(L.map(r => r.ph)) });
        await evs('d.killEnemies();'); await step(60);
        await ev((d) => d.god(true));
      }
      if (id === 'vellix') {
        await ev((d) => d.god(false));
        L = await run('d.killEnemies(); d.setHp(4); d.setEnergy(100); ' + WALKER_AT(16) + AT(420, 450), 'if (i === 0) d.pressed("special", 1);', 40, 20);
        const sl = L.filter(r => r.ph === 'slide');
        check(tag + 'Blink Strike: 8 slide frames at 25 px/f (200 px), vy 0, passes through the walker for 7 with i-frames (no hurt)', sl.length === 8 && Math.abs(sl[7].x - sl[0].x - 175) < 0.5 && sl.every(r => r.y === 450 && r.guard > 0) && L[39].hp === 4 && !L.some(r => r.hurt > 0) && hitsOf(L).some(h => h.dmg === 7), { slide: sl.map(r => r.x), hp: L[39].hp, hits: hitsOf(L) });
        L = await run('d.killEnemies(); d.setEnergy(100); d.setHp(4);' + AT(560, 450), 'if (i === 0) d.pressed("special", 1); if (i === 2) { ' + WALKER_AT(14) + ' g.enemies[0].x = g.player.x; }', 40, 20);
        check(tag + 'a hurt during the Blink Strike crouch (f1–4, no i-frames yet) cancels it', L.findIndex(r => r.hurt > 0) >= 0 && L.findIndex(r => r.hurt > 0) <= 4 && !L.some(r => r.ph === 'slide'), { hurtAt: L.findIndex(r => r.hurt > 0), phases: uniq(L.map(r => r.ph)) });
        await evs('d.killEnemies();'); await step(60);
        await ev((d) => d.god(true));
        L = await run('d.killEnemies(); d.setEnergy(100);' + AT(600, 450), 'if (i === 0) d.pressed("special", 1);', 30, 20);
        check(tag + 'Blink Strike stops flush at a wall', Math.max(...L.map(r => r.x)) === 711, uniq(L.map(r => r.x)));
        L = await run('d.killEnemies(); d.setEnergy(100);' + AT(735, 360), 'if (i === 0) { d.pressed("left", 2); } if (i === 2) d.pressed("special", 1);', 40, 20);
        check(tag + 'Blink Strike stops at a ledge edge (never leaves footing; floor-bound §3.7)', L.every(r => r.y === 360) && Math.min(...L.map(r => r.x)) >= 720 + 9 - 0.01, { xs: uniq(L.map(r => r.x)), ys: uniq(L.map(r => r.y)) });
        await evs('d.killEnemies(); d.setEnergy(100);' + AT(420, 450)); await step(3);
        let L0 = await log(60, 'if (i === 0) d.pressed("jump", 5);'); const lf = L0.findIndex((r, i) => i > 3 && r.gnd);
        await evs('d.setEnergy(100);' + AT(420, 450)); await step(3);
        L = await log(60, 'if (i === 0) d.pressed("jump", 5); if (i === ' + (lf - 3) + ') d.pressed("special", 1);');
        check(tag + 'airborne Blink press is buffered and fires on landing', !L.some(r => r.mv === 'special' && !r.gnd) && L.some(r => r.mv === 'special' && r.f >= lf), { lf, sp: (L.find(r => r.mv === 'special') || {}).f });
      }
      if (id === 'orrubel') {
        L = await run(TARGET + ' d.setEnergy(100); d.setMeter(10);' + AT(420, 450), 'if (i === 0) d.pressed("special", 1);', 330, 10);
        const hits = hitsOf(L), sentryRows = L.filter(r => r.prs.some(p => p.k === 'sentry'));
        const sr = sentryRows[0] || { f: -1, prs: [{ x: 0, y: 0 }] }, sp0 = sr.prs.find(p => p.k === 'sentry') || { x: 0, y: 0 }, hf0 = hits.length ? hits[0].f : 1;
        check(tag + 'Sentry Pin: sentry at (40,−8) on f9 lives 300 f, first bolt 30 f after placement then every 30 f (+travel), 2 dmg, kb (80,−20), +1 meter', Math.abs(sr.f - 8.5) <= 0.5 && sentryRows.length >= 298 && sentryRows.length <= 302 && hits.length >= 9 && hf0 - sr.f >= 29 && hf0 - sr.f <= 30 && hits.every(h => h.dmg === 2) && hits.slice(1).every((h, i) => h.f - hits[i].f >= 30 && h.f - hits[i].f <= 40) && L[hf0].me - L[hf0 - 1].me === 1 && Math.abs(L[hf0].e[0].vx - 80) < 2 && Math.abs(L[hf0].e[0].vy + 20) < 2 && Math.abs(sp0.x - (420 + 40)) < 2 && Math.abs(sp0.y - 9 - (428 - 8)) < 2, { placedF: sr.f, alive: sentryRows.length, hits: hits.slice(0, 4), first: sp0 });
        L = await run(TARGET + ' d.setEnergy(100);' + AT(420, 450), 'if (i === 0) d.pressed("special", 1); if (i === 40) d.pressed("special", 1);', 420, 10);
        const listAfter = L[60].prs.filter(p => p.k === 'sentry').length, hits2 = hitsOf(L).filter(h => h.f > 60), alive2 = L.filter(r => r.f > 48 && r.prs.some(p => p.k === 'sentry')).length;
        check(tag + 'Sentry Pin re-cast: one sentry in the projectile list, still 300 f of life and a 30 f cadence (not double-ticked)', listAfter === 1 && alive2 >= 296 && hits2.slice(1).every((h, i) => h.f - hits2[i].f >= 30 && h.f - hits2[i].f <= 40), { listAfter, alive2, cadence: hits2.slice(0, 5).map(h => h.f) });
        L = await run('d.killEnemies(); d.setEnergy(100);' + AT(420, 450), 'if (i === 0) d.pressed("special", 1);', 120, 10);
        check(tag + 'Sentry Pin with no enemy in range never fires a bolt', !L.some(r => r.prs.some(p => p.k === 'bolt')), L.filter(r => r.prs.some(p => p.k === 'bolt')).length);
        // lock range: the Pin (260) ignores a target 280 px from the sentry; the Triad (300) shoots it
        L = await run('d.killEnemies(); d.setEnergy(100); ' + WALKER_AT(20) + AT(285, 450), 'if (i === 0) d.pressed("special", 1);', 120, 10);
        check(tag + 'Sentry Pin lock range 260: a walker 290 px from the sentry is not shot', !L.some(r => r.prs.some(p => p.k === 'bolt')), { sentryX: (L.find(r => r.pr > 0) || { prs: [] }).prs, enemyX: L[0].e[0] && L[0].e[0].x });
        await overclockOn(285, 450);
        L = await run('d.killEnemies(); d.setEnergy(100); ' + WALKER_AT(20) + AT(285, 450), 'if (i === 0) d.pressed("special", 1);', 120, 10);
        check(tag + 'Sentry Triad lock range 300: the same walker (290 px) is shot', L.some(r => r.prs.some(p => p.k === 'bolt')) && hitsOf(L).some(h => h.dmg === 2), { bolts: L.filter(r => r.prs.some(p => p.k === 'bolt')).length, hits: hitsOf(L).slice(0, 2) });
        await overclockOff();
        // the sentry is clamped out of solid geometry (placed against the left wall)
        L = await run('d.killEnemies(); d.setEnergy(100);' + AT(45, 450, -1), 'if (i === 0) d.pressed("special", 1);', 20, 10);
        const sw = (L.find(r => r.pr > 0) || { prs: [] }).prs.find(p => p.k === 'sentry');
        check(tag + 'Sentry Pin cast into the wall is pulled back out of solid tiles (box clear of x < 30)', !!sw && sw.x - 9 >= 30 && sw.x < 60, sw);
        await evs('d.showHitboxes(true);'); await shot('qa-combat-orrubel-sentry-wall.png', { x: 0, y: 450, width: 400, height: 220 }); await evs('d.showHitboxes(false);');
        L = await run(TARGET + ' d.setEnergy(50); d.setMeter(10);' + AT(420, 450), 'if (i === 0) d.pressed("heavy", 1); if (i === 30) d.pressed("heavy", 1);', 90, 20);
        const rh = hitsOf(L), ring = L.filter(r => r.prs.some(p => p.k === 'ring'));
        check(tag + 'Ring Toss: 7 out / 4 back, +5 energy +1 meter per leg, 560 px/s for 220 px then homes back and despawns on the body; heavy locked while the ring is out', rh.length === 2 && rh[0].dmg === 7 && rh[1].dmg === 4 && Math.abs(L[rh[0].f].en - L[rh[0].f - 1].en - 5.05) < 0.1 && L[rh[0].f].me - L[rh[0].f - 1].me === 1 && Math.abs(ring[1].prs[0].x - ring[0].prs[0].x - 9.33) < 1 && Math.max(...ring.map(r => r.prs[0].x)) <= 434 + 221 && ring.length < 52 && L.filter(r => r.mv === 'heavy' && r.mt === 1).length === 1, { hits: rh, ringFrames: ring.length, maxX: Math.max(...ring.map(r => r.prs[0].x)), heavies: L.filter(r => r.mv === 'heavy' && r.mt === 1).map(r => r.f) });
        // the ring turns back early at a wall and still returns; the heavy comes back
        L = await run('d.killEnemies(); d.setEnergy(100);' + AT(640, 450), 'if (i === 0) d.pressed("heavy", 1); if (i === 50) d.pressed("heavy", 1);', 80, 20);
        const rw = L.filter(r => r.prs.some(p => p.k === 'ring')).map(r => r.prs.find(p => p.k === 'ring').x);
        check(tag + 'Ring Toss into a wall turns back before 220 px, despawns on the body, heavy available again', rw.length > 5 && Math.max(...rw) < 720 && Math.max(...rw) < 640 + 200 && !L[49].ro && L.filter(r => r.mv === 'heavy' && r.mt === 1).length === 2, { maxX: Math.max(...rw), ringOutAt49: L[49].ro, heavies: L.filter(r => r.mv === 'heavy' && r.mt === 1).map(r => r.f) });
        // the ring and the sentry persist through a hurt (§3.2)
        await ev((d) => d.god(false));
        L = await run('d.killEnemies(); d.setEnergy(100); d.setHp(5);' + AT(560, 450), 'if (i === 0) d.pressed("special", 1); if (i === 20) { ' + WALKER_AT(14) + ' g.enemies[0].x = g.player.x; }', 60, 10);
        check(tag + 'a placed sentry persists through a hurt', L.findIndex(r => r.hurt > 0) >= 20 && L.slice(21, 60).every(r => r.prs.some(p => p.k === 'sentry')), { hurtAt: L.findIndex(r => r.hurt > 0) });
        await evs('d.killEnemies();'); await step(60);
        L = await run('d.killEnemies(); d.setEnergy(100); d.setHp(5);' + AT(560, 450), 'if (i === 0) d.pressed("heavy", 1); if (i === 14) { ' + WALKER_AT(12) + ' g.enemies[0].x = g.player.x; }', 60, 10);
        check(tag + 'a thrown ring persists through a hurt and still returns (heavy unlocked)', L.findIndex(r => r.hurt > 0) >= 14 && L.slice(15, 25).every(r => r.prs.some(p => p.k === 'ring')) && !L[59].ro, { hurtAt: L.findIndex(r => r.hurt > 0), ringOut: L[59].ro });
        await evs('d.killEnemies();'); await step(60);
        await ev((d) => d.god(true));
      }
      if (id === 'korvask') {
        await ev((d) => d.god(false));
        L = await run('d.killEnemies(); d.setHp(6); d.setEnergy(60); d.setMeter(10);' + AT(420, 450), 'if (i === 0) d.pressed("special", 1); if (i === 4) { ' + WALKER_AT(14) + ' }', 70, 20);
        const ch = hitsOf(L)[0], catchF = L.findIndex(r => r.mv === 'counter');
        check(tag + 'Bulwark Catch negates walker contact (no hp loss, no hurt), refunds 20 energy, answers with Counter-Slam S6 A4 for 16 dmg, kb (540,−320), hitstop 6', L[69].hp === 6 && !L.some(r => r.hurt > 0) && catchF >= 0 && Math.abs(L[catchF].en - L[catchF - 1].en - 20.05) < 0.1 && !!ch && ch.dmg === 16 && ch.mv === 'counter' && ch.mt === 7 && Math.abs(L[ch.f].e[0].vx - 540) < 2 && Math.abs(L[ch.f].e[0].vy + 320) < 2 && L[ch.f].hs === 6, { hp: L[69].hp, catchF, ch, en: catchF >= 0 ? [L[catchF - 1].en, L[catchF].en] : null });
        near(tag + 'Bulwark Catch meter gain is +15 total for the catch + slam (§3.9 "catch +15")', catchF >= 0 ? L[69].me - L[catchF - 1].me : -1, 15, 0.5);
        near(tag + 'Counter-Slam lasts 24 f (S6 A4 R14)', maxMt(L, 'counter'), 24, 0);
        L = await run('d.killEnemies(); d.setHp(6); d.setEnergy(100);' + AT(420, 450), 'if (i === 0) d.pressed("special", 1); if (i === 2) ' + PROJ('g.player.x + 60', 'g.player.y - 20', 2, -4), 60, 20);
        check(tag + 'Bulwark Catch destroys a caught enemy projectile and counters', L[59].hp === 6 && L.filter(r => r.pr > 0).length < 15 && L.some(r => r.mv === 'counter'), { hp: L[59].hp, projFrames: L.filter(r => r.pr > 0).length });
        L = await run('d.killEnemies(); d.setHp(6); d.setEnergy(100);' + AT(560, 450), 'if (i === 0) d.pressed("special", 1); if (i === 2) ' + PROJ('g.player.x + 60', 'g.player.y - 20', 1, -4), 60, 20);
        check(tag + 'an unblockable hit (flags 1) is not caught: Korvask is hurt normally during the stance', L[59].hp === 5 && !L.some(r => r.mv === 'counter') && L.some(r => r.hurt > 0), { hp: L[59].hp });
        await evs('d.killEnemies();'); await step(60);
        L = await run('d.killEnemies(); d.setHp(6); d.setEnergy(100);' + AT(420, 450), 'if (i === 0) d.pressed("special", 1); if (i === 5) d.teleport(330, 450);', 40, 60);
        check(tag + 'floor spikes during the stance are not caught: the hazard freeze fires and a heart is lost', L.some(r => r.mode === 'hazard') && L[39].hp === 5 && !L.some(r => r.mv === 'counter'), { modes: uniq(L.map(r => r.mode)), hp: L[39].hp });
        L = await run('d.killEnemies(); d.setEnergy(100);' + AT(420, 450), 'if (i === 0) d.pressed("jump", 20); if (i === 5) d.pressed("special", 1);', 40, 30);
        check(tag + 'Bulwark Catch works in the air with gravity', L.some(r => r.mv === 'special' && !r.gnd && r.ph === 'stance') && L.filter(r => r.mv === 'special').some((r, i, a) => i > 0 && r.vy > a[i - 1].vy), uniq(L.map(r => r.mv + '/' + r.gnd)));
        await ev((d) => d.god(true));
      }

      // ---------- B6. air attack landing lag + air attack cancelled by landing in startup ----------
      L = await run('d.killEnemies();' + AT(420, 400), 'if (i === 0) d.pressed("light", 1); if (i >= 2) d.pressed("light", 1);', 60, 20);
      const lf2 = L.findIndex(r => r.gnd), airActive = L.some(r => r.mv === 'air' && r.hb.length);
      check(tag + 'air attack landing: no hit → move ends on landing' + (airActive ? ' with 4 f landing lag' : ' (startup cancelled, no lag)'), lf2 > 0 && !L.some(r => r.f > lf2 && r.mv === 'air') && (airActive ? (L.findIndex(r => r.f > lf2 && r.mv === 'light1') - lf2) === 4 : (L.findIndex(r => r.f > lf2 && r.mv === 'light1') - lf2) <= 1), { lf2, airActive, next: L.findIndex(r => r.f > lf2 && r.mv === 'light1') });
      // DESIGN §3.5: "Air attack. Any time airborne except during dash/hurt/cling" — a light while clinging must not start one
      await evs('d.grant("gripProtocol", true);');
      L = await run('d.killEnemies(); d.teleport(70, 450); g.player.facing = -1;', 'if (i === 0) d.pressed("jump", 10); if (i >= 2) d.pressed("left", 1); if (i === 30) d.pressed("light", 1);', 40, 20);
      check(tag + 'a light pressed while clinging does not start an air attack (§3.5: not during cling)', L[29].cl && !L.slice(30, 36).some(r => r.mv === 'air'), { clBefore: L[29].cl, after: L.slice(30, 34).map(r => r.mv + '/' + r.cl) });
      await evs('d.grant("gripProtocol", false);');

      // ---------- B7. Overclock ----------
      L = await run('d.killEnemies(); d.setMeter(100); d.setEnergy(10);' + AT(420, 450), 'if (i === 0) d.pressed("overclock", 1);', 760, 5);
      const ocFrames = L.filter(r => r.oc).length, firstOc = L.findIndex(r => r.oc);
      check(tag + 'Overclock: 8 f hitstop + 12 f transform, then active for exactly 720 f, meter drains to 0 and the revert follows', firstOc === 20 && L.filter(r => r.f < 20 && r.hs > 0).length === 8 && ocFrames === 720 && L[759].me === 0 && !L[759].oc && L[19].me === 100 && L[380].me > 45 && L[380].me < 55, { firstOc, ocFrames, me: [L[19].me, L[380].me, L[759].me] });
      check(tag + 'Overclock end: 10 f revert, meter 0, no i-frames granted', L.filter(r => r.ocR > 0).length === 10 && L[755].ifr === 0 && L[755].me === 0, { revert: L.filter(r => r.ocR > 0).length, ifr: L[755].ifr });
      near(tag + 'Overclock energy regen 6/s', L[80].en - L[20].en, 6, 0.1);
      await overclockOn();
      for (const name of ['light1', 'light2', 'light3', 'heavy', 'air', 'down']) {
        if (id === 'orrubel' && name === 'heavy') continue;
        const want = M[name];
        let setup, script;
        if (name === 'air') { setup = 'd.killEnemies(); d.spawnEnemy("driftmoth", 15, 12, {}); (function(){ const e = g.enemies[0]; e.hp = 999; e.maxHp = 999; e.update = function () { if (this.hitstun > 0) this.hitstun--; if (this.flash > 0) this.flash--; }; })(); d.setMeter(50);' + AT(420, 450); script = 'const e = g.enemies[0]; if (e) { e.x = g.player.x + 30 * g.player.facing; e.y = g.player.cy() + e.h / 2; } if (i === 0) d.pressed("jump", 30); if (i === 2) d.pressed("light", 1);'; }
        else if (name === 'down') { setup = TARGET + ' d.setMeter(50); d.teleport(465, 372);'; script = 'if (i === 0) { d.pressed("down", 40); d.pressed("light", 1); }'; }
        else { setup = TARGET + ' d.setMeter(50);' + AT(420, 450); script = `if (i === 0) { ${chainTo(name === 'light2' ? 2 : name === 'light3' ? 3 : 1)} d.pressed("${btn(name)}", 1); }`; }
        L = await run(setup, script, 60, 20);
        const hf = hitFrame(L);
        const grounded = name !== 'air' && name !== 'down';
        const cxOk = !grounded || hf < 0 || Math.abs(L[hf].hb[0][0] - (L[hf].x + want.box[0] * 1.1 * L[hf].fac - want.box[2] * 1.2 / 2)) < 1.5;
        check(tag + 'Overclock ' + name + ': dmg floor(' + want.dmg + '×1.5) = ' + Math.floor(want.dmg * 1.5) + ', hitstop +1, box ×1.2' + (grounded ? ', cx ×1.1' : '') + ', no meter gain', hf > 0 && L[hf - 1].e[0].hp - L[hf].e[0].hp === Math.floor(want.dmg * 1.5) && L[hf].hs === want.hitstop + 1 && Math.abs(L[hf].hb[0][2] - want.box[2] * 1.2) < 1 && Math.abs(L[hf].hb[0][3] - want.box[3] * 1.2) < 1 && cxOk && L[hf].me <= L[hf - 1].me, hf > 0 ? { dmg: L[hf - 1].e[0].hp - L[hf].e[0].hp, hs: L[hf].hs, box: L[hf].hb, x: L[hf].x, me: [L[hf - 1].me, L[hf].me] } : 'no hit');
      }
      L = await run('d.killEnemies(); d.grant("burstLine", true);' + AT(650, 450, -1), 'd.pressed("left", 1);', 28, 5);
      near(tag + 'Overclock run speed ×1.15', -L[27].vx, D.run * 1.15, 1);
      L = await run(AT(650, 450, -1), 'if (i === 0) d.pressed("dash", 1);', D.dash[1] + 1, 20);
      near(tag + 'Overclock dash distance ×1.15', 650 - L[D.dash[1] - 1].x, D.dash[0] * 1.15, 2);
      await ev((d) => d.grant('burstLine', false));
      await ev((d) => d.god(false));
      L = await run('d.killEnemies(); d.setHp(' + D.hp + ');' + AT(600, 450), 'if (i === 0) { ' + WALKER_AT(20) + ' }', 10, 10);
      const hr = L.find(r => r.hurt > 0);
      check(tag + 'hurt during Overclock: knockback ×0.5, Overclock keeps running', !!hr && Math.abs(hr.vx + 240 * D.weight * 0.5) < 1 && Math.abs(hr.vy + 300 * D.weight * 0.5) < 1 && hr.oc, hr);
      await ev((d) => d.god(true));
      // ultimate replaces the special: cost 40, DESIGN damage
      L = await run(WALKER + ' d.setEnergy(100);' + AT(420, 450), 'if (i === 0) d.pressed("special", 1);', 140, 10);
      const uh = hitsOf(L), ucost = Math.round(100 - Math.min(...L.map(r => r.en)));
      check(tag + 'in Overclock the special button fires the ultimate for 40 energy', L.some(r => r.mv === 'ultimate') && ucost === 40, { ucost, mv: uniq(L.map(r => r.mv)) });
      if (id === 'tessik') check(tag + 'Sightline: 4 ticks × 5 dmg = 20 on a stationary walker', uh.length === 4 && uh.every(h => h.dmg === 5) && uh.map(h => h.mt).join() === '13,19,25,31', uh);
      if (id === 'brackmaw') check(tag + 'Quake Vault: 26 dmg, box 300×70 at the feet', uh.length === 1 && uh[0].dmg === 26 && L.some(r => r.hb.length && r.hb[0][2] >= 300 && r.hb[0][2] <= 361), { uh, box: (L.find(r => r.mv === 'ultimate' && r.hb.length) || {}).hb });
      if (id === 'vellix') check(tag + 'Afterimage Storm: homing blinks hit 6 per pass, ≥ 2 passes, i-frames f1–38', uh.length >= 2 && uh.every(h => h.dmg === 6) && L.filter(r => r.mv === 'ultimate' && r.mt >= 1 && r.mt <= 38).every(r => r.guard > 0), uh);
      if (id === 'orrubel') { const bolts = hitsOf(L); check(tag + 'Sentry Triad: 3 sentries, bolts deal the sheet\'s 2 dmg (potential 60 over 5 s)', bolts.length >= 6 && bolts.every(h => h.dmg === 2), bolts.slice(0, 4)); }
      if (id === 'korvask') check(tag + 'Clamp Press (god on): lunge grabs, press, slam deals 32 to the held victim', uh.length === 1 && uh[0].dmg === 32 && uh[0].ph === 'slam', { uh, ph: uniq(L.map(r => r.ph)) });
      await reOverclock();   // the loop above used most of the 720 f: a fresh Overclock for the ultimate deep-dives
      if (id === 'tessik') {
        // Sightline is grounded only: an airborne press is buffered and fires on landing (§4.2.1)
        await evs('d.killEnemies(); d.setEnergy(100);' + AT(420, 450)); await step(3);
        const L0 = await log(60, 'if (i === 0) d.pressed("jump", 5);'); const lf = L0.findIndex((r, i) => i > 3 && r.gnd);
        await evs('d.setEnergy(100);' + AT(420, 450)); await step(3);
        L = await log(90, 'if (i === 0) d.pressed("jump", 5); if (i === ' + (lf - 3) + ') d.pressed("special", 1);');
        check(tag + 'Sightline: an airborne press is buffered and fires on landing', !L.some(r => r.mv === 'ultimate' && !r.gnd && r.mt <= 3) && L.some(r => r.mv === 'ultimate' && r.f >= lf), { lf, ult: (L.find(r => r.mv === 'ultimate') || {}).f });
        // the beam is clipped at the first solid wall (the ### block at x 720)
        L = await run('d.killEnemies(); d.setEnergy(100);' + AT(600, 450), 'if (i === 0) d.pressed("special", 1);', 60, 20);
        const beams = L.filter(r => r.mv === 'ultimate' && r.hb.length).map(r => r.hb[0]);
        check(tag + 'Sightline beam is clipped at the first solid wall (body front 611 → 720 = 109 px, height 28)', beams.length === 4 && beams.every(b => b[0] === 611 && b[2] === 109 && b[3] === 28), beams);
      }
      if (id === 'brackmaw') {
        L = await run('d.killEnemies(); d.setEnergy(100);' + AT(420, 450), 'if (i === 0) d.pressed("jump", 25); if (i === 10) { ' + WALKER_AT(14) + ' g.enemies[0].x = g.player.x; } if (i === 14) d.pressed("special", 1);', 90, 20);
        const qh = hitsOf(L);
        check(tag + 'Quake Vault (air): dive hits for 8, the Quake burst on landing for 26', qh.length === 2 && qh[0].dmg === 8 && qh[0].ph === 'dive' && qh[1].dmg === 26 && qh[1].ph === 'burst', qh);
        await evs(CLEAR + WALKER + AT(420, 450) + ' d.setEnergy(100); d.showHitboxes(true);'); await step(3);
        await page.evaluate(() => { const d = window.UB.debug, g = window.UB.game; d.pressed('special', 1); for (let i = 0; i < 40; i++) { d.step(1); if (g.player.sp.phase === 'burst') break; } });
        await shot('qa-combat-brackmaw-quake.png', { x: 0, y: 0, width: 1280, height: 720 });
        await evs('d.showHitboxes(false);'); await step(60);
      }
      if (id === 'vellix') {
        // untargeted Storm: 4 blinks of 90 px along facing with gravity ON (never a gap crosser, §3.7 / §4.2.3)
        L = await run('d.killEnemies(); d.setEnergy(100);' + AT(300, 450), 'if (i === 0) d.pressed("jump", 30); if (i === 6) d.pressed("special", 1);', 60, 20);
        const bl = L.filter(r => r.mv === 'ultimate' && r.ph === 'blink');
        check(tag + 'Afterimage Storm with no target: 4 × 90 px along facing, gravity keeps integrating (vy rises, y changes)', bl.length === 32 && Math.abs(bl[31].x - bl[0].x - 90 * 4 + 90 / 8) < 2 && Math.max(...bl.map(r => r.vy)) > bl[0].vy + 300 && uniq(bl.map(r => r.y)).length > 8 && bl.every((r, i) => i === 0 || Math.abs(r.x - bl[i - 1].x - 11.25) < 0.1 || r.x === bl[i - 1].x), { n: bl.length, dx: bl.length ? bl[31].x - bl[0].x : null, vy: bl.length ? [bl[0].vy, Math.max(...bl.map(r => r.vy))] : null, ys: uniq(bl.map(r => r.y)).length });
        // targeted: travels toward and 30 px through the target (max 180), gravity suspended, the next blink reverses
        L = await run('d.killEnemies(); d.setEnergy(100); ' + WALKER_AT(19) + ' g.enemies[0].kbResist = 0;' + AT(420, 450), 'if (i === 0) d.pressed("special", 1);', 60, 20);
        const b2 = L.filter(r => r.mv === 'ultimate' && r.ph === 'blink');
        const firstMax = Math.max(...b2.slice(0, 8).map(r => r.x)), secondEnd = b2[15] ? b2[15].x : 0;
        check(tag + 'Afterimage Storm locked on: blink 1 = 180 px (420 → 600, 30 px past the walker at 585), blink 2 reverses to 555, y fixed, 4 passes × 6 dmg', Math.abs(firstMax - 600) < 1 && Math.abs(secondEnd - 555) < 1 && b2.every(r => r.y === 450) && hitsOf(L).length === 4 && hitsOf(L).every(h => h.dmg === 6) && b2[7].fac === 1 && b2[8].fac === -1, { firstMax, secondEnd, hits: hitsOf(L), facing: uniq(b2.map(r => r.fac)) });
        await evs(CLEAR + 'd.killEnemies(); ' + WALKER_AT(19) + AT(420, 450) + ' d.setEnergy(100); d.showHitboxes(true);'); await step(3);
        await page.evaluate(() => { const d = window.UB.debug, g = window.UB.game; d.pressed('special', 1); for (let i = 0; i < 40; i++) { d.step(1); if (g.player.moveName === 'ultimate' && g.player.moveT === 12) break; } });
        await shot('qa-combat-vellix-storm.png', { x: 0, y: 0, width: 1280, height: 720 });
        await evs('d.showHitboxes(false);'); await step(60);
      }
      if (id === 'korvask') {
        // held victim 32, a second enemy in the slam box 10 with kb (380,−400)
        L = await run('d.killEnemies(); d.setEnergy(100); ' + WALKER_AT(15) + WALKER_AT(16) + AT(420, 450), 'if (i === 0) d.pressed("special", 1);', 80, 10);
        const slamF = L.findIndex((r, i) => i > 0 && r.e.length === 2 && r.e[0].hp < L[i - 1].e[0].hp);
        check(tag + 'Clamp Press: the held walker takes 32, the second walker in the slam box takes 10 with kb (380,−400)', slamF > 0 && L[slamF].e[0].hp === 967 && L[slamF].e[1].hp === 989 && Math.abs(L[slamF].e[1].vx - 380) < 2 && Math.abs(L[slamF].e[1].vy + 400) < 2, slamF > 0 ? L[slamF].e : uniq(L.map(r => r.ph)));
        await ev((d) => d.god(false));
        L = await run(WALKER + ' d.setEnergy(100); d.setHp(6);' + AT(420, 450), 'if (i === 0) d.pressed("special", 1);', 90, 10);
        check(tag + 'Clamp Press (god off) must not be cancelled by contact with the held victim: slam lands, no hp lost', hitsOf(L).some(h => h.dmg === 32) && L[89].hp === 6 && !L.some(r => r.hurt > 0), { hits: hitsOf(L), hp: L[89].hp, phases: uniq(L.map(r => r.ph)) });
        await ev((d) => d.god(true));
      }
      await overclockOff();
      // activation only when idle/run/jump/fall/cling
      L = await run('d.killEnemies(); d.setMeter(100);' + AT(420, 450), 'if (i === 0) d.pressed("heavy", 1); if (i === 3) d.pressed("overclock", 1);', 80, 10);
      check(tag + 'Overclock cannot be activated during an attack (the 6 f buffer then expires)', !L.some(r => r.oc) && L[79].me === 100, { oc: L.some(r => r.oc), me: L[79].me });
      L = await run('d.killEnemies(); d.setMeter(100); d.grant("burstLine", true);' + AT(300, 450), 'if (i === 0) d.pressed("dash", 1); if (i === 2) d.pressed("overclock", 1);', 60, 10);
      check(tag + 'Overclock cannot be activated during a dash', !L.some(r => r.oc) && L[59].me === 100, { oc: L.some(r => r.oc), me: L[59].me });
      await ev((d) => d.grant('burstLine', false));
      await ev((d) => d.god(false));
      L = await run('d.killEnemies(); d.setMeter(100); d.setHp(' + D.hp + ');' + AT(600, 450), 'if (i === 0) { ' + WALKER_AT(20) + ' } if (i === 2) d.pressed("overclock", 1);', 60, 10);
      check(tag + 'Overclock cannot be activated during the hurt state', L[0].hurt > 0 && !L.some(r => r.oc) && L[59].me === 100, { hurt: L[0].hurt, oc: L.some(r => r.oc), me: L[59].me });
      await evs('d.killEnemies();'); await step(70);
      L = await run('d.killEnemies(); d.setMeter(100); d.setHp(' + D.hp + ');' + AT(560, 450), 'if (i === 0) d.pressed("overclock", 1); if (i === 10) { ' + WALKER_AT(14) + ' g.enemies[0].x = g.player.x; }', 32, 10);
      check(tag + 'Overclock transform f1–20 is invulnerable: an overlapping walker cannot hurt during it (it does once the form is up)', L.slice(10, 20).every(r => r.hp === D.hp && r.hurt === 0) && L[20].oc && L.slice(20, 32).some(r => r.hurt > 0), { hp: L.slice(10, 20).map(r => r.hp), oc: L[20].oc, hurtAfter: L.slice(20, 32).some(r => r.hurt > 0) });
      await evs('d.killEnemies();'); await step(70);
      await overclockOff();
      await ev((d) => d.god(true));
      // transform shove
      L = await run(WALKER + ' d.setMeter(100);' + AT(420, 450), 'if (i === 0) d.pressed("overclock", 1);', 30, 10);
      check(tag + 'Overclock transform shoves a nearby enemy (300 away, −200) for 0 dmg', L[0].e[0].hp === 999 && L[0].e[0].vx > 290 && L[0].e[0].vy < -190, L[0].e);
      await overclockOff();

      // ---------- B8. energy regen, hurt, hazard ----------
      L = await run('d.killEnemies(); d.setEnergy(20);' + AT(420, 450), '', 61, 5);
      near(tag + 'energy regen 3/s', L[60].en - L[0].en, 3, 0.1);
      await ev((d) => d.god(false));
      L = await run('d.killEnemies(); d.setHp(' + D.hp + ');' + AT(600, 450), 'if (i === 0) { ' + WALKER_AT(20) + ' }', 90, 10);
      const h0 = L.findIndex(r => r.hurt > 0), hh = L[h0];
      check(tag + 'contact hurt: 1 heart, hurt 16 f, i-frames 60, world hitstop 6, kb (240 away, −300)·weight', h0 === 0 && hh.hp === D.hp - 1 && hh.hurt === 16 && hh.ifr === 60 && hh.hs === 6 && Math.abs(hh.vx + 240 * D.weight) < 1 && Math.abs(hh.vy + 300 * D.weight) < 1, hh);
      check(tag + 'i-frames tick 60 player frames (66 incl. hitstop); no second contact hit meanwhile; the hurt state lasts 16 f', h0 === 0 && L[6].ifr === 60 && L[65].ifr === 1 && L.slice(0, 66).every(r => r.hp === D.hp - 1 && r.mode === 'normal') && L.slice(0, 40).filter(r => r.hurt > 0).length === 22, { ifr: [L[6].ifr, L[65].ifr], hp: uniq(L.slice(0, 66).map(r => r.hp)), hurtFrames: L.slice(0, 40).filter(r => r.hurt > 0).length, modes: uniq(L.map(r => r.mode)) });
      await evs('d.killEnemies(); d.setHp(' + D.hp + '); d.teleport(330, 450);'); await step(1);
      L = await log(70, '');
      const hz = L.filter(r => r.mode === 'hazard'), afterHz = L.find(r => r.f > hz[hz.length - 1].f);
      check(tag + 'floor spike: 1 heart ignoring i-frames, 6 f hitstop + 30 f freeze + 10 f fade with the body frozen, respawn with 45 i-frames', hz.length === 45 && L[0].hp === D.hp - 1 && uniq(hz.map(r => r.x + ',' + r.y)).length === 1 && afterHz.ifr >= 44 && afterHz.x === 420 && afterHz.y === 450, { hazardFrames: hz.length, hp: L[0].hp, after: afterHz });
      await step(30);
      // spikes ignore i-frames (§3.2/§3.3): hurt by contact, then onto spikes within the 60 i-frames → a second heart goes
      L = await run('d.killEnemies(); d.setHp(' + D.hp + ');' + AT(600, 450), 'if (i === 0) { ' + WALKER_AT(20) + ' } if (i === 20) { d.killEnemies(); d.teleport(330, 450); }', 40, 60);
      check(tag + 'spikes ignore i-frames: a spike touched 20 f after a contact hurt still costs a heart', L[0].hurt > 0 && L[19].ifr > 30 && L.some(r => r.f > 20 && r.mode === 'hazard') && L[39].hp === D.hp - 2, { ifr19: L[19].ifr, hp: L[39].hp, modes: uniq(L.map(r => r.mode)) });
      await step(30);

      // ---------- B9. Burst Line, Echo Jump, Grip Protocol, buffer, coyote ----------
      await ev((d) => d.god(true));
      await evs('d.grant("burstLine", true);');
      L = await run('d.killEnemies();' + AT(300, 450), 'if (i === 0) d.pressed("dash", 1);', 40, 10);
      const dr = L.filter(r => r.dash);
      check(tag + 'Burst Line: ' + D.dash[0] + ' px in ' + D.dash[1] + ' f at constant speed, vy = 0, 18 f cooldown set', Math.abs(L[D.dash[1] - 1].x - 300 - D.dash[0]) < 0.5 && dr.every(r => r.vy === 0) && Math.abs(L[0].x - 300 - D.dash[0] / D.dash[1]) < 0.5 && L[D.dash[1] - 1].dcd === 18 && !L[D.dash[1]].dash, { dist: L[D.dash[1] - 1].x - 300, dcd: L[D.dash[1] - 1].dcd });
      for (const gap of [17, 18]) {
        L = await run(AT(300, 450), 'if (i === 0) d.pressed("dash", 1); if (i === ' + (D.dash[1] - 1 + gap) + ') d.pressed("dash", 1);', 60, 10);
        const second = L.find(r => r.f > D.dash[1] && r.dash);
        check(tag + 'second dash ' + gap + ' f after the last dash frame → ' + (gap >= 18 ? 'starts immediately' : 'waits for the 18 f cooldown'), !!second && (gap >= 18 ? second.f === D.dash[1] - 1 + gap : second.f === D.dash[1] - 1 + 18), second && second.f);
      }
      L = await run(AT(300, 450), 'if (i === 0) d.pressed("dash", 1); if (i === ' + (D.dash[1] - 5) + ') d.pressed("light", 1);', 40, 10);
      check(tag + 'a light pressed during the dash starts on the frame after the dash ends (buffered)', !L.some(r => r.dash && r.mv) && (L.find(r => r.mv === 'light1') || {}).f === D.dash[1], { lightAt: (L.find(r => r.mv === 'light1') || {}).f });
      L = await run(AT(420, 450), 'if (i === 0) d.pressed("jump", 30); if (i === 8) d.pressed("dash", 1); if (i === 22) d.pressed("dash", 1);', 50, 20);
      const ad = L.filter(r => r.dash);
      check(tag + 'air dash: vy = 0 (hangs), only one per airtime', ad.length === D.dash[1] - 1 && uniq(ad.map(r => r.y)).length === 1 && !L.some(r => r.f > 21 && r.f < 40 && r.dash), { ad: ad.length, second: L.some(r => r.f > 21 && r.f < 40 && r.dash) });
      L = await run(AT(600, 450), 'if (i === 0) d.pressed("dash", 1);', 25, 10);
      check(tag + 'dash stops flush at a wall', Math.max(...L.map(r => r.x)) === 720 - D.box[0] / 2, Math.max(...L.map(r => r.x)));
      L = await run('d.teleport(735, 360); g.player.facing = -1;', 'if (i === 0) { d.pressed("left", 1); d.pressed("dash", 1); }', 25, 20);
      check(tag + 'ground dash off a ledge keeps vy = 0 until it ends', L.filter(r => r.dash).every(r => r.y === 360 && r.vy === 0) && L.filter(r => r.dash).some(r => !r.gnd), uniq(L.filter(r => r.dash).map(r => r.y + '/' + r.gnd)));
      await evs('d.grant("burstLine", false); d.grant("echoJump", true);');
      L = await run(AT(420, 450), 'if (i === 0) d.pressed("jump", 20); if (i === 21) d.pressed("jump", 20);', 90, 10);
      near(tag + 'Echo Jump apex from the first apex ' + D.djApex + ' px', 450 - Math.min(...L.map(r => r.y)), D.djApex, 4);
      const dj = L.find(r => r.f >= 21 && r.aj === 0);
      near(tag + 'Echo Jump vy = −' + D.djMult + '·jumpVel', dj ? dj.vy - D.gravity / 60 : 0, -D.djMult * D.jumpVel, 1);
      L = await run(AT(420, 450), 'if (i === 0) d.pressed("jump", 20); if (i === 21) d.pressed("jump", 20); if (i === 45) d.pressed("jump", 20);', 90, 10);
      check(tag + 'only one Echo Jump per airtime', L.filter(r => r.f > 30 && r.vy < -400 && !r.gnd).length === 0 && L.filter(r => r.f >= 21 && r.f < 30 && r.vy < -400).length > 0, L.filter(r => r.f > 30 && r.vy < -400).map(r => r.f));
      L = await run(AT(420, 450), 'if (i === 0) d.pressed("jump", 20); if (i === 21) d.pressed("jump", 3);', 30, 40);
      near(tag + 'Echo Jump release cut ×0.45 (same rule as the first jump)', L[24].vy - D.gravity / 60, L[23].vy * 0.45, 1, L.slice(21, 26).map(r => r.vy));
      await evs('d.grant("echoJump", false);');
      L = await run(AT(420, 450), 'if (i === 0) d.pressed("jump", 4);', 10, 40);
      near(tag + 'jump cut ×0.45 on release', L[4].vy - D.gravity / 60, L[3].vy * 0.45, 1);
      L = await run(AT(420, 450), 'if (i === 0) d.pressed("jump", 2); if (i === 5) d.pressed("jump", 1); if (i === 12) d.pressed("jump", 1);', 30, 40);
      check(tag + 'without Echo Jump a second press in the air never jumps again (vy only ever rises after the cut)', L.slice(3, 25).every((r, i, a) => i === 0 || r.gnd || r.vy >= a[i - 1].vy - 0.01), L.slice(3, 16).map(r => r.vy));
      // buffer: landing jump fires when pressed ≤ 5 f before the first grounded frame (6 f window incl. the press frame)
      for (const lead of [4, 5]) {
        await evs('d.teleport(690, 300);'); await step(1);
        const L0 = await log(60, ''); const lf = L0.findIndex(r => r.gnd);
        await evs('d.teleport(690, 300);'); await step(1);
        L = await log(60, 'if (i === ' + (lf - lead) + ') d.pressed("jump", 1);');
        const jf = L.find(r => r.f >= lf && r.vy < -300);
        check(tag + 'jump pressed ' + lead + ' f before landing ' + (lead <= 4 ? 'fires on the first grounded frame (6 f buffer)' : 'has expired (6 f buffer)'), lead <= 4 ? !!jf && jf.f === lf + 1 : !jf, { lf, jf: jf && jf.f });
        await step(30);
      }
      // buffers do not tick during world hitstop (§3.1): a jump pressed inside a 30 f hitstop fires when the world resumes
      L = await run('d.killEnemies();' + AT(420, 450), 'if (i === 0) d.fx("hitstop", 0, 0, { frames: 30 }); if (i === 3) d.pressed("jump", 1);', 45, 20);
      const jh = L.find(r => r.vy < -500);
      check(tag + 'input buffer is frozen during hitstop: a jump pressed 27 f before the freeze ends still fires', !!jh && jh.f >= 29 && jh.f <= 32 && L[28].jb === 6, { jumpAt: jh && jh.f, bufferAt28: L[28].jb });
      // coyote: 6 f after walking off the ### block top (edge x = 720)
      const coy = [];
      for (const delay of [5, 6]) {
        await evs('g.__off = undefined; d.teleport(735, 360); g.player.facing = -1;'); await step(5);
        L = await log(50, 'd.pressed("left", 1); if (g.__off === undefined && !g.player.onGround) g.__off = i; if (g.__off !== undefined && i === g.__off + ' + delay + ') d.pressed("jump", 1);');
        const off = await ev((d, g) => g.__off);
        coy.push({ delay, jumped: !!L.find(r => r.f >= off && r.vy < -300) });
        await step(30);
      }
      check(tag + 'coyote time: a jump on the 6th airborne frame still fires (6 f, §3.1), the 7th does not', coy[0].jumped && !coy[1].jumped, coy);
      // Grip Protocol: cling on the room's left wall, slide speed, wall jump vectors, 8 f wall lock, wall-coyote 5 f
      await evs('d.grant("gripProtocol", true); d.teleport(70, 450); g.player.facing = -1;'); await step(3);
      L = await log(70, 'if (i === 0) d.pressed("jump", 10); if (i >= 2 && i < 50) d.pressed("left", 1); if (i === 50) d.pressed("jump", 1); if (i > 50) d.pressed("left", 1);');
      const cl = L.filter(r => r.cl), wj = L[50];
      check(tag + 'Grip Protocol: clings to a # wall while falling, slides at ' + D.wallSlide + ' px/s, refreshes Echo Jump + air dash', cl.length > 20 && cl.every(r => r.st === 'cling' && r.wd === -1 && r.aj === 1 && r.ad === 1 && r.x === 30 + D.box[0] / 2) && Math.abs((cl[cl.length - 1].y - cl[5].y) / (cl.length - 6) - D.wallSlide / 60) < 0.05, { n: cl.length, slide: cl.length > 6 ? (cl[cl.length - 1].y - cl[5].y) / (cl.length - 6) * 60 : null });
      check(tag + 'wall jump: vx = (run+40) away, vy = −0.95·jumpVel, faces away, horizontal input ignored 8 f', wj.vx === D.run + 40 && Math.abs(wj.vy - D.gravity / 60 + 0.95 * D.jumpVel) < 1 && wj.fac === 1 && L.slice(51, 58).every(r => r.vx === D.run + 40) && L[60].vx < D.run + 40 - 10, { wj: [wj.vx, wj.vy, wj.fac], lock: L.slice(51, 61).map(r => r.vx) });
      const wc = [];
      for (const delay of [4, 5]) {
        await evs('d.teleport(70, 450); g.player.facing = -1;'); await step(3);
        L = await log(60, 'if (i === 0) d.pressed("jump", 10); if (i >= 2 && i < 30) d.pressed("left", 1); if (i === 30 + ' + delay + ') d.pressed("jump", 1);');
        wc.push({ delay, clungBefore: L[29].cl, jumped: !!L.find(r => r.f >= 30 && r.vy < -100 && r.vx > 50) });
        await step(20);
      }
      check(tag + 'wall-coyote: a jump 5 f after leaving the wall still wall-jumps (5 f, §3.1)', wc.every(r => r.clungBefore) && wc[0].jumped && wc[1].jumped, wc);
      // crumble tiles are never clingable (debug_room2's ccc block at row 9, x 11–13: left face x = 330)
      await ev((d) => d.warp('debug_room2', { x: 300, y: 300 })); await step(3);
      L = await run('d.killEnemies(); d.teleport(310, 300); g.player.facing = 1;', 'd.pressed("right", 1);', 14, 10);
      check(tag + 'Grip Protocol never clings to a crumble (c) block', !L.some(r => r.cl) && L.slice(6).every(r => r.vy > 0 && r.st === 'fall'), uniq(L.map(r => r.cl + '/' + r.st)));
      await ev((d) => d.warp('debug_room', { x: 420, y: 450 })); await step(3);
      await evs('d.grant("gripProtocol", false);');
      // restore node: ▲ REST refills energy to max and hp (node_debug at tile (5,14))
      L = await run('d.killEnemies(); d.setEnergy(20); d.setHp(1);' + AT(165, 450), 'if (i === 3) d.pressed("up", 2);', 150, 10);
      check(tag + 'restore node sets energy to max and refills hearts (§3.8, §5.5)', L.some(r => r.mode === 'nodeUse') && L[149].en === 100 && L[149].hp === D.hp && L[149].mode === 'normal', { modes: uniq(L.map(r => r.mode)), en: L[149].en, hp: L[149].hp });
      await ev((d) => d.god(false));
    }

    // ======================= C. real room: dc_wake with the real scuttlebit / driftmoth =======================
    for (const id of IDS) {
      const D = DESIGN[id], M = D.moves, tag = '[' + id + '] ';
      await start(id, 500, 450, 'dc_wake');
      await ev((d) => d.god(true));
      let L;
      // every move connects with the REAL enemy (scuttlebit 26×18 on the same floor; a real driftmoth for the air attack) for its sheet numbers
      for (const name of ['light1', 'light2', 'light3', 'heavy', 'down', 'air']) {
        const want = M[name];
        let setup, script;
        if (name === 'air') { setup = 'd.killEnemies(); d.spawnEnemy("driftmoth", 18, 12, {}); g.enemies[0].hp = 999; g.enemies[0].maxHp = 999;' + AT(500, 450); script = 'const e = g.enemies[0]; if (e) { e.x = g.player.x + 30 * g.player.facing; e.y = g.player.cy() + e.h / 2; e.vx = 0; e.vy = 0; } if (i === 0) d.pressed("jump", 30); if (i === 2) d.pressed("light", 1);'; }
        else if (name === 'down') { setup = 'd.killEnemies();' + SCUT(18) + ' d.teleport(555, 372);'; script = 'if (i === 0) { d.pressed("down", 40); d.pressed("light", 1); }'; }
        else { setup = 'd.killEnemies();' + SCUT(18) + AT(500, 450); script = `if (i === 0) { ${chainTo(name === 'light2' ? 2 : name === 'light3' ? 3 : 1)} d.pressed("${btn(name)}", 1); }`; }
        L = await run(setup, script, 70, 30);
        const h = hitsOf(L);
        if (id === 'orrubel' && name === 'heavy') { check(tag + 'dc_wake: Ring Toss out (7) + back (4) both connect with the scuttlebit', h.length === 2 && h[0].dmg === 7 && h[1].dmg === 4, h); continue; }
        check(tag + 'dc_wake: ' + name + ' hits the real ' + (name === 'air' ? 'driftmoth' : 'scuttlebit') + ' once for ' + want.dmg + ', kb ' + JSON.stringify(want.kb) + ', hitstop ' + want.hitstop, h.length === 1 && h[0].dmg === want.dmg && h[0].hs === want.hitstop && Math.abs(h[0].evx - want.kb[0]) < 2 && Math.abs(h[0].evy - want.kb[1]) < 2 && (name !== 'down' || L.some(r => r.vy <= -575 && r.vy >= -585)), h.length ? h : { boxes: L.filter(r => r.hb.length).slice(0, 2).map(r => r.hb), e: L[5].e });
      }
      if (id === 'korvask') { L = await run('d.killEnemies();' + SCUT(18) + AT(500, 450), `if (i === 0) { ${chainTo(3)} d.pressed("light", 1); }`, 40, 20); const h = hitsOf(L)[0]; check(tag + 'dc_wake: Chain Haul pulls the scuttlebit toward Korvask (vx −200 along facing)', !!h && h.evx === -200 && L[h.f + 12].e[0].x < L[h.f - 1].e[0].x - 5, h && { h, xBefore: L[h.f - 1].e[0].x, xAfter: L[h.f + 12].e[0].x }); }
      if (id === 'tessik') { L = await run('d.killEnemies();' + SCUT(18) + ' d.setEnergy(100);' + AT(440, 450), 'if (i === 0) d.pressed("special", 1);', 80, 20); const h = hitsOf(L); check(tag + 'dc_wake: Pulse Line hits the 18 px scuttlebit for 6', h.length === 1 && h[0].dmg === 6 && Math.abs(h[0].evx - 260) < 2, h); }
      if (id === 'brackmaw') { L = await run('d.killEnemies();' + SCUT(14) + SCUT(18) + ' d.setEnergy(100);' + AT(495, 450), 'if (i === 0) d.pressed("special", 1);', 50, 20); const hf = L.findIndex((x, i) => i > 0 && x.e[0].hp < L[i - 1].e[0].hp); check(tag + 'dc_wake: Vault Stomp hits the scuttlebits on both sides for 12, away kb', hf > 0 && L[hf].e[0].hp === 987 && L[hf].e[1].hp === 987 && L[hf].e[0].vx < -400 && L[hf].e[1].vx > 400, hf > 0 ? L[hf].e : 'nohit'); }
      if (id === 'vellix') { await ev((d) => d.god(false)); L = await run('d.killEnemies();' + SCUT(18) + ' d.setEnergy(100); d.setHp(4);' + AT(470, 450), 'if (i === 0) d.pressed("special", 1);', 40, 20); check(tag + 'dc_wake: Blink Strike passes through the scuttlebit for 7 without being hurt', hitsOf(L).some(h => h.dmg === 7) && L[39].hp === 4 && !L.some(r => r.hurt > 0), { hits: hitsOf(L), hp: L[39].hp }); await ev((d) => d.god(true)); }
      if (id === 'orrubel') { L = await run('d.killEnemies();' + SCUT(18) + ' d.setEnergy(100);' + AT(480, 450), 'if (i === 0) d.pressed("special", 1);', 120, 20); const h = hitsOf(L); check(tag + 'dc_wake: Sentry bolts hit the scuttlebit for 2 every 30 f', h.length >= 3 && h.every(x => x.dmg === 2) && h.slice(1).every((x, i) => x.f - h[i].f >= 29 && x.f - h[i].f <= 32), h); }
      if (id === 'korvask') { await ev((d) => d.god(false)); L = await run('d.killEnemies(); d.setEnergy(60); d.setHp(6);' + AT(500, 450), 'if (i === 0) d.pressed("special", 1); if (i === 4) { ' + SCUT(17) + ' g.enemies[0].x = g.player.x + 24; }', 70, 20); check(tag + 'dc_wake: Bulwark Catch catches scuttlebit contact and the Counter-Slam deals 16', hitsOf(L).some(h => h.dmg === 16 && h.mv === 'counter') && L[69].hp === 6 && !L.some(r => r.hurt > 0), { hits: hitsOf(L), hp: L[69].hp }); await ev((d) => d.god(true)); }
      if (id === 'orrubel' || id === 'tessik') {
        await evs(CLEAR + 'd.killEnemies();' + SCUT(18) + AT(500, 450) + ' d.showHitboxes(true);'); await step(3);
        await page.evaluate(() => { const d = window.UB.debug, g = window.UB.game; d.pressed('light', 1); for (let i = 0; i < 20; i++) { d.step(1); const pl = g.player; if (pl.moveName === 'light1' && pl.moveT === pl.move.s + 2) break; } });
        await shot('qa-combat-' + id + '-l1-vs-scuttlebit.png', { x: 500, y: 420, width: 420, height: 240 });
        await evs('d.showHitboxes(false);'); await step(30);
      }
      await ev((d) => d.god(false));
      // the real patrolling scuttlebit: walk at it and mash light → it dies, enemiesPurged +1, a drop or bit coin appears
      await ev((d, g) => { d.warp('dc_wake', null); if (g.save.loreSeen.indexOf('driftcache') < 0) g.save.loreSeen.push('driftcache'); }); await step(5);
      const purged0 = await ev((d, g) => g.save.enemiesPurged);
      L = await log(300, 'if (!g.enemies.length) return; const e = g.enemies[0], p = g.player; const dx = e.x - p.x; if (Math.abs(dx) > 60) d.pressed(dx > 0 ? "right" : "left", 1); else { if (!p.move && Math.sign(dx) !== p.facing) d.pressed(dx > 0 ? "right" : "left", 1); d.pressed("light", 1); }');
      const purged1 = await ev((d, g) => g.save.enemiesPurged), killed = L.findIndex(r => r.e.length === 0);
      check(tag + 'dc_wake: the patrolling scuttlebit dies to the light chain within 300 f (enemiesPurged +1, coins spawn)', killed > 0 && purged1 === purged0 + 1 && (await ev((d, g) => g.pickups.length)) >= 1, { killed, purged: [purged0, purged1], hp: uniq(L.map(r => r.hp)) });
    }

    // ======================= D. the real Tallock in dc_sentinel =======================
    for (const id of IDS) {
      const D = DESIGN[id], M = D.moves, tag = '[' + id + '] ';
      await start(id, 500, 450, 'dc_sentinel');
      await ev((d) => d.god(true));
      // the boss AI is held still (its takeHit / enrage path stays real); contact off so the sweep is about hitboxes
      await evs('d.spawnBoss("tallock", { x: 25, y: 14 }); g.boss.update = function () {}; g.boss.contact = 0;'); await step(2);
      for (const name of ['light1', 'heavy', 'down']) {
        await evs(CLEAR + (name === 'down' ? 'd.teleport(765, 250);' : 'd.teleport(690, 450); g.player.facing = 1;')); await step(3);
        const hp0 = (await state()).boss.hp;
        const L = await log(60, name === 'down' ? 'if (i === 0) { d.pressed("down", 40); d.pressed("light", 1); }' : `if (i === 0) d.pressed("${btn(name)}", 1);`);
        const hp1 = (await state()).boss.hp;
        if (id === 'orrubel' && name === 'heavy') check(tag + 'Tallock: Ring Toss out + back = 11', hp0 - hp1 === 11, { dmg: hp0 - hp1 });
        else check(tag + 'Tallock: ' + name + ' deals ' + M[name].dmg + (name === 'down' ? ' and pogoes (vy −580, Echo Jump + dash refreshed)' : ''), hp0 - hp1 === M[name].dmg && (name !== 'down' || L.some(r => r.vy <= -575 && r.vy >= -585 && r.aj === 1 && r.ad === 1)), { dmg: hp0 - hp1, pogo: L.some(r => r.vy <= -575) });
        await step(40);
      }
      if (id === 'korvask') {
        await ev((d) => d.god(false));
        // a boss melee hit (src = the boss, flags 0) during the stance: caught, +20 energy, +15 meter, Counter-Slam 16 on the adjacent boss
        await evs(CLEAR + 'g.boss.x = 700; d.teleport(640, 450); g.player.facing = 1; d.setEnergy(60); d.setHp(6); d.setMeter(10);'); await step(3);
        let L = await log(60, 'if (i === 0) d.pressed("special", 1); if (i === 6) { const E = window.UB.Entity; const h = E.makeHit("boss"); h.src = g.boss; h.dmg = 1; h.flags = 0; h.x = g.player.x; h.y = g.player.y - 60; h.w = 60; h.h = 60; h.facing = -1; g.registerHit(h); }');
        const bossHps = uniq(L.map(r => r.boss.hp)), cf = L.findIndex(r => r.mv === 'counter');
        check(tag + 'Tallock: a boss melee hit is caught (no hurt), +20 energy, +15 meter, Counter-Slam deals 16 to the boss', L[59].hp === 6 && !L.some(r => r.hurt > 0) && cf >= 0 && bossHps.length === 2 && bossHps[0] - bossHps[1] === 16 && Math.abs(L[cf].en - L[cf - 1].en - 20.05) < 0.1 && L[59].me - L[5].me === 15, { hp: L[59].hp, bossHps, cf, en: cf >= 0 ? [L[cf - 1].en, L[cf].en] : null, me: [L[5].me, L[59].me] });
        await evs('d.showHitboxes(true);'); await shot('qa-combat-korvask-counter-tallock.png', { x: 0, y: 0, width: 1280, height: 720 }); await evs('d.showHitboxes(false);');
        await evs(CLEAR + 'd.teleport(640, 450); g.player.facing = 1; d.setEnergy(60); d.setHp(6);'); await step(40);
        L = await log(60, 'if (i === 0) d.pressed("special", 1); if (i === 2) ' + PROJ('g.player.x + 70', 'g.player.y - 20', 2, -6));
        check(tag + 'Tallock: an enemy projectile during the stance is destroyed and countered (boss −16)', L[59].hp === 6 && L.some(r => r.mv === 'counter') && L.filter(r => r.pr > 0).length < 12 && uniq(L.map(r => r.boss.hp)).length === 2, { hp: L[59].hp, projFrames: L.filter(r => r.pr > 0).length, bossHps: uniq(L.map(r => r.boss.hp)) });
        await evs(CLEAR + 'd.teleport(640, 450); g.player.facing = 1; d.setEnergy(60); d.setHp(6);'); await step(40);
        L = await log(60, 'if (i === 0) d.pressed("special", 1); if (i === 6) { const E = window.UB.Entity; const h = E.makeHit("boss"); h.src = g.boss; h.dmg = 2; h.flags = 1; h.x = g.player.x; h.y = g.player.y - 60; h.w = 60; h.h = 60; h.facing = -1; g.registerHit(h); }');
        check(tag + 'Tallock: an unblockable boss attack (flags 1) is not caught: 2 hearts lost, no counter', L[59].hp === 4 && !L.some(r => r.mv === 'counter') && L.some(r => r.hurt > 0), { hp: L[59].hp });
        // Clamp Press on a boss: not moved, 32 on the slam
        await ev((d) => d.god(true));
        await overclockOn(600, 450);
        await evs(CLEAR + 'g.boss.x = 720; d.teleport(600, 450); g.player.facing = 1; d.setEnergy(100);'); await step(3);
        L = await log(80, 'if (i === 0) d.pressed("special", 1);');
        const bh = uniq(L.map(r => r.boss.hp)), bx = uniq(L.map(r => r.boss.x));
        check(tag + 'Tallock: Clamp Press grabs the boss, the boss is not moved and takes 32 on the slam', L.some(r => r.ph === 'press') && L.some(r => r.ph === 'slam') && bh.length === 2 && bh[0] - bh[1] === 32 && bx.length === 1, { bh, bx, phases: uniq(L.map(r => r.ph)) });
        await overclockOff();
      }
      await ev((d) => d.god(false));
    }

    // ======================= E. Orrubel: the ring must never lock the heavy =======================
    {
      await start('orrubel', 500, 450, 'dc_wake');
      await ev((d) => d.god(true));
      // thrown from the doorway of dc_wake's right exit the ring leaves the room, is culled by the engine, and the heavy must come back
      let L = await run('d.killEnemies(); d.setEnergy(100);' + AT(900, 450), 'if (i === 0) d.pressed("heavy", 1); if (i === 80) d.pressed("heavy", 1); if (i === 160) d.pressed("heavy", 1);', 240, 10);
      const heavies = L.filter(r => r.mv === 'heavy' && r.mt === 1).map(r => r.f), ringFrames = L.filter(r => r.pr > 0).length;
      check('[orrubel] dc_wake: a ring thrown through the exit opening is culled off-room; the heavy is available again afterwards (no permanent lock)', heavies.length === 3 && !L[239].ro, { heavies, ringFrames, ringOutAt239: L[239].ro, maxX: Math.max(...L.filter(r => r.pr > 0).map(r => r.prs[0].x)) });
      check('[orrubel] dc_wake: the culled ring is gone within 60 f (it never came back)', ringFrames > 0 && ringFrames < 60 && L[79].pr === 0, { ringFrames });
      await ev((d) => d.god(false));
    }

    // ======================= F. acid puddle, death/respawn, meter across rooms, vendor effects =======================
    {
      // acid puddle (a real acid-valve glob): 1 heart, kb (0, −300)·weight, 60 i-frames, no respawn teleport (§3.3)
      await start('tessik', 495, 450, 'dc_wake');
      await ev((d) => d.god(true));
      const puddle = await page.evaluate(() => {
        const d = window.UB.debug, g = window.UB.game;
        d.killEnemies(); d.spawnEnemy('spitvalve', 22, 14, { variant: 'acidvalve' });
        for (let i = 0; i < 400; i++) { d.step(1); const p = g.projectiles.find(p => p.kind === 'puddle' && !p.dead); if (p) return { x: p.x, y: p.y, w: p.w, frame: i }; }
        return null;
      });
      check('[tessik] dc_wake: the acid valve leaves an acid puddle on the floor', !!puddle && puddle.y === 450, puddle);
      if (puddle) {
        await evs('d.killEnemies(); d.god(false); d.setHp(5); d.teleport(' + puddle.x + ', 450);'); await step(0);
        const L = await log(20, '');
        const ph = L.find(r => r.hurt > 0);
        check('[tessik] acid puddle: 1 heart, 60 i-frames, no hazard respawn (stays in place)', !!ph && ph.hp === 4 && ph.ifr === 60 && !L.some(r => r.mode === 'hazard') && L[19].hp === 4, ph || L.slice(0, 4));
        check('[tessik] acid puddle knockback is (0, −300)·weight (§3.3: straight up, no horizontal push)', !!ph && Math.abs(ph.vx) < 1 && Math.abs(ph.vy + 300) < 1, ph && { vx: ph.vx, vy: ph.vy });
        await step(80);
      }
      // meter persists across rooms; death → game over → respawn at the node with full hp, energy 50, meter 0
      await start('tessik', 420, 450, 'debug_room');
      await evs('d.setMeter(60); d.setEnergy(80);'); await ev((d) => d.warp('debug_room2', { x: 300, y: 450 })); await step(5);
      let s = await state();
      check('meter persists across a room change (60 → 60)', s.meter === 60 && s.roomId === 'debug_room2', { me: s.meter, room: s.roomId });
      await ev((d) => d.warp('debug_room', { x: 420, y: 450 })); await step(3);
      await evs('d.setMeter(60); d.setEnergy(80); d.setHp(1); d.teleport(330, 450);'); await step(1);
      for (let i = 0; i < 40; i++) { s = await state(); if (s.screen === 'gameover') break; await step(5); }
      check('a spike at 1 heart is a death: game over screen after the 60 f animation', s.screen === 'gameover' && s.dead, { screen: s.screen, dead: s.dead });
      await ev((d, g) => g.respawnAtNode());
      for (let i = 0; i < 60; i++) { s = await state(); if (s.screen === 'play' && s.hp > 0 && !s.busy && s.mode === 'normal') break; await step(5); }
      check('respawn at the last node: full hp, energy 50, meter 0, deaths +1, back in dc_wake', s.screen === 'play' && s.hp === 5 && Math.abs(s.energy - 50) < 2 && s.meter === 0 && s.deaths === 1 && s.roomId === 'dc_wake', { hp: s.hp, en: s.energy, me: s.meter, deaths: s.deaths, room: s.roomId });
      // vendor effects on combat: Hot Clock ×1.5 (rounded up) on hit meter, Spare Cell energyMax 125
      await start('tessik', 420, 450, 'debug_room');
      await ev((d) => d.god(true));
      await evs('d.setBits(500); d.buy("hot_clock"); d.buy("spare_cell");');
      const L = await run(TARGET + ' d.setMeter(10); d.setEnergy(50);' + AT(420, 450), 'if (i === 0) d.pressed("light", 1);', 30, 10);
      const hh = hitsOf(L)[0];
      check('Hot Clock: L1 hit meter = ceil(2 × 1.5) = 3; Spare Cell: energyMax 125', !!hh && L[hh.f].me - L[hh.f - 1].me === 3 && (await state()).energyMax === 125, { gain: hh && L[hh.f].me - L[hh.f - 1].me, energyMax: (await state()).energyMax });
      await ev((d) => d.god(false));
    }


    // ======================= G. QA round 3: every enemy type's takeHit per fighter, live-AI bosses, movers, the pull, i-frame windows =======================
    /** Hold enemy #idx still with its real takeHit (shields / multipliers / kbResist): no AI, hp 999, gravity for walkers. */
    const HOLD = (idx) => `(function(){ const e = g.enemies[${idx}]; e.hp = 999; e.maxHp = 999; e.update = function (game) { if (this.hitstun > 0) this.hitstun--; if (this.flash > 0) this.flash--; if (this.blockFlash > 0) this.blockFlash--; if (this.data && !this.data.flyer && !this.data.hanger) { this.gravity(0.5, 12); this.moveAndCollide(game.level); } }; })();`;
    const SPAWN = (type, tx, ty, opts) => `d.spawnEnemy("${type}", ${tx}, ${ty}, ${JSON.stringify(opts || {})}); ` + HOLD('g.enemies.length - 1');
    const PIN = 'const e = g.enemies[0]; if (e) { e.x = g.player.x + 30 * g.player.facing; e.y = g.player.cy() + e.h / 2; e.vx = 0; e.vy = 0; }';
    const firstHit = (L) => hitsOf(L)[0];
    for (const id of IDS) {
      const D = DESIGN[id], M = D.moves, tag = '[' + id + '] ';
      await start(id, 500, 450, 'dc_wake');
      await ev((d) => d.god(true));
      let L, h;
      // ---------- G1. every enemy type (real takeHit) in the real dc_wake ----------
      // hopnode 24×24 (kbResist 1): L1 sheet dmg + full knockback + hitstun 10+hitstop; heavy launches it
      L = await run('d.killEnemies(); ' + SPAWN('hopnode', 18, 14) + AT(500, 450), 'if (i === 0) d.pressed("light", 1);', 40, 20);
      h = firstHit(L);
      check(tag + 'dc_wake hopnode: L1 deals ' + M.light1.dmg + ', kb ' + JSON.stringify(M.light1.kb) + ', hitstun ' + (10 + M.light1.hitstop), !!h && h.dmg === M.light1.dmg && Math.abs(h.evx - M.light1.kb[0]) < 2 && Math.abs(h.evy - M.light1.kb[1]) < 2 && L[h.f].e[0].hs === 10 + M.light1.hitstop, h ? { h, hs: L[h.f].e[0].hs } : { e: L[2].e, boxes: L.filter(r => r.hb.length).slice(0, 2).map(r => r.hb) });
      if (id !== 'orrubel') {
        L = await run('d.killEnemies(); ' + SPAWN('hopnode', 18, 14) + AT(500, 450), 'if (i === 0) d.pressed("heavy", 1);', 60, 30);
        h = firstHit(L);
        const later = h ? L.slice(h.f + 1).filter(r => r.hs === 0 && r.e.length).slice(0, 8) : [];
        check(tag + 'dc_wake hopnode: heavy deals ' + M.heavy.dmg + ' and launches it (rises after the hit)', !!h && h.dmg === M.heavy.dmg && later.length >= 4 && Math.min(...later.map(r => r.e[0].y)) < L[h.f].e[0].y - 4, h ? { h, ys: later.map(r => r.e[0].y) } : 'nohit');
      } else {
        L = await run('d.killEnemies(); ' + SPAWN('hopnode', 18, 14) + AT(500, 450), 'if (i === 0) d.pressed("heavy", 1);', 70, 30);
        const hh = hitsOf(L);
        check(tag + 'dc_wake hopnode: Ring Toss out 7 + back 4', hh.length === 2 && hh[0].dmg === 7 && hh[1].dmg === 4, hh);
      }
      // rambyte 40×28 (kbResist 0.5 while pacing): L1 sheet dmg, knockback halved, hitstun applies; Korvask's pull is −100
      L = await run('d.killEnemies(); ' + SPAWN('rambyte', 18, 14, { patrol: [18, 18] }) + AT(500, 450), 'if (i === 0) d.pressed("light", 1);', 40, 20);
      h = firstHit(L);
      check(tag + 'dc_wake rambyte (kbResist 0.5): L1 deals ' + M.light1.dmg + ', knockback halved (' + M.light1.kb[0] / 2 + ', ' + M.light1.kb[1] / 2 + '), hitstun ' + (10 + M.light1.hitstop), !!h && h.dmg === M.light1.dmg && Math.abs(h.evx - M.light1.kb[0] / 2) < 2 && Math.abs(h.evy - M.light1.kb[1] / 2) < 2 && L[h.f].e[0].hs === 10 + M.light1.hitstop, h ? { h, hs: L[h.f].e[0].hs, st: L[h.f].e[0].st } : { e: L[2].e });
      if (id === 'korvask') {
        L = await run('d.killEnemies(); ' + SPAWN('rambyte', 18, 14, { patrol: [18, 18] }) + AT(500, 450), `if (i === 0) { ${chainTo(3)} d.pressed("light", 1); }`, 40, 20);
        h = firstHit(L);
        check(tag + 'dc_wake rambyte: Chain Haul pulls at −200 × 0.5 = −100 px/s', !!h && h.dmg === 6 && Math.abs(h.evx + 100) < 2, h);
      }
      // spitvalve 30×30 (kbResist 0): heavy deals the sheet dmg, world hitstop + flash, the turret never moves
      L = await run('d.killEnemies(); ' + SPAWN('spitvalve', 18, 14, { facing: -1 }) + AT(500, 450), 'if (i === 0) d.pressed("heavy", 1);', 60, 30);
      h = firstHit(L);
      if (id === 'orrubel') check(tag + 'dc_wake spitvalve (kbResist 0): Ring Toss out deals 7, the turret is not moved', !!h && h.dmg === 7 && h.evx === 0 && h.evy === 0 && L[h.f].e[0].x === 555, h);
      else check(tag + 'dc_wake spitvalve (kbResist 0): heavy deals ' + M.heavy.dmg + ' with ' + M.heavy.hitstop + ' f world hitstop, the turret is not moved (no hitstun)', !!h && h.dmg === M.heavy.dmg && h.hs === M.heavy.hitstop && h.evx === 0 && h.evy === 0 && L[h.f].e[0].hs === 0 && L.slice(h.f, h.f + 10).every(r => r.e[0].x === 555), h ? { h, xs: uniq(L.slice(h.f, h.f + 10).map(r => r.e[0].x)) } : 'nohit');
      // voltwheel 28×28 (kbResist 0): L1 deals the sheet dmg, no movement
      L = await run('d.killEnemies(); ' + SPAWN('voltwheel', 18, 14) + AT(500, 450), 'if (i === 0) d.pressed("light", 1);', 40, 20);
      h = firstHit(L);
      check(tag + 'dc_wake voltwheel (kbResist 0): L1 deals ' + M.light1.dmg + ', not moved', !!h && h.dmg === M.light1.dmg && h.evx === 0 && h.evy === 0, h || { e: L[2].e });
      // broodcell 36×36 (kbResist 0): L3 deals the sheet dmg; a mote (3 hp) dies to the light chain
      L = await run('d.killEnemies(); ' + SPAWN('broodcell', 18, 14) + AT(500, 450), `if (i === 0) { ${chainTo(3)} d.pressed("light", 1); }`, 50, 20);
      h = firstHit(L);
      check(tag + 'dc_wake broodcell (kbResist 0): L3 deals ' + M.light3.dmg + ', not moved', !!h && h.dmg === M.light3.dmg && h.evx === 0 && L[h.f].e[0].x === 555, h || { e: L[2].e });
      L = await run('d.killEnemies(); d.spawnEnemy("mote", 18, 13, {}); (function(){ const e = g.enemies[0]; e.update = function () { if (this.hitstun > 0) this.hitstun--; if (this.flash > 0) this.flash--; }; })();' + AT(500, 450), 'const e = g.enemies[0]; if (e) { e.x = g.player.x + 30 * g.player.facing; e.y = g.player.cy() + 8; e.vx = 0; e.vy = 0; } d.pressed("light", 1);', 60, 20);
      const moteDead = L.findIndex(r => r.e.length === 0);
      check(tag + 'dc_wake mote (3 hp, 10×10): the light chain kills it (≤ 2 hits)', moteDead > 0 && moteDead < 45, { moteDead, hps: uniq(L.map(r => r.e[0] ? r.e[0].hp : 'dead')) });
      // glarewisp 20×20 flyer: the air attack connects for the sheet dmg (its takeHit doubles only when 'tired')
      L = await run('d.killEnemies(); ' + SPAWN('glarewisp', 18, 12) + AT(500, 450), PIN + ' if (i === 0) d.pressed("jump", 30); if (i === 2) d.pressed("light", 1);', 40, 20);
      h = firstHit(L);
      check(tag + 'dc_wake glarewisp: the air attack deals ' + M.air.dmg + ', kb ' + JSON.stringify(M.air.kb), !!h && h.dmg === M.air.dmg && Math.abs(h.evx - M.air.kb[0]) < 2 && Math.abs(h.evy - M.air.kb[1]) < 2, h || { e: L[5].e, boxes: L.filter(r => r.hb.length).slice(0, 2).map(r => r.hb) });
      // droplatch 26×22 hanging from the ceiling at row 1 (x 18): the air attack from an Echo Jump reaches it and knocks it down
      L = await run('d.killEnemies(); d.spawnEnemy("droplatch", 18, 1, {}); g.enemies[0].hp = 999; g.enemies[0].maxHp = 999; g.enemies[0].update = function () { if (this.hitstun > 0) this.hitstun--; if (this.flash > 0) this.flash--; };' + AT(500, 450), 'const e = g.enemies[0]; if (e) { e.x = g.player.x + 30 * g.player.facing; e.y = 330; e.vx = 0; e.vy = 0; } if (i === 0) d.pressed("jump", 30); if (i === 2) d.pressed("light", 1);', 40, 30);
      h = firstHit(L);
      check(tag + 'dc_wake droplatch (hanging, held 120 px up): a jumping air attack reaches it for ' + M.air.dmg + ' (latchTakeHit)', !!h && h.dmg === M.air.dmg && h.mv === 'air', h || { minY: Math.min(...L.map(r => r.y)), e: L[2].e, boxes: L.filter(r => r.hb.length).slice(0, 2).map(r => r.hb) });
      // platewalker 30×36 facing the fighter: lights are blocked (25 % meter, pushed back), the heavy breaks the guard, from behind lights land, from above the down-strike lands
      const PW = (facing) => 'd.killEnemies(); ' + SPAWN('platewalker', 18, 14, { patrol: [18, 18], facing }) + ' g.enemies[0].facing = ' + facing + '; g.enemies[0].dir = ' + facing + ';';
      L = await run(PW(-1) + ' d.setMeter(10);' + AT(505, 450), 'if (i === 0) d.pressed("light", 1);', 40, 20);
      check(tag + 'dc_wake platewalker (front): L1 is blocked — no damage, meter floor(2 × 0.25) = 0', hitsOf(L).length === 0 && Math.max(...L.map(r => r.me)) === 10 && L[0].e[0].hp === 999, { hits: hitsOf(L), me: Math.max(...L.map(r => r.me)) });
      const bf = L.findIndex((r, i) => i > 0 && Math.abs(r.vx) > 100);
      check(tag + 'dc_wake platewalker (front): the blocked L1 pushes the fighter BACK (away from the shield: vx < 0, x decreases)', bf > 0 && L[bf].vx < -100 && Math.min(...L.slice(bf).map(r => r.x)) < 505 - 1, { pushFrame: bf, vx: bf > 0 ? L[bf].vx : null, minX: Math.min(...L.slice(Math.max(bf, 0)).map(r => r.x)), maxX: Math.max(...L.map(r => r.x)) });
      L = await run(PW(-1) + ' d.setMeter(10);' + AT(505, 450), `if (i === 0) { ${chainTo(3)} d.pressed("light", 1); }`, 50, 20);
      check(tag + 'dc_wake platewalker (front): L3 is blocked — meter floor(4 × 0.25) = 1', hitsOf(L).length === 0 && Math.max(...L.map(r => r.me)) === 11, { hits: hitsOf(L), me: Math.max(...L.map(r => r.me)) });
      L = await run(PW(-1) + ' d.setMeter(10);' + AT(505, 450), 'if (i === 0) d.pressed("heavy", 1);', 70, 30);
      h = firstHit(L);
      if (id === 'orrubel') check(tag + 'dc_wake platewalker (front): the outbound ring is blocked, the return leg lands from behind for 4', hitsOf(L).length === 1 && h.dmg === 4, hitsOf(L));
      else check(tag + 'dc_wake platewalker (front): the heavy breaks the guard for ' + M.heavy.dmg + ' (stagger)', !!h && h.dmg === M.heavy.dmg && L[h.f].e[0].st === 'stagger', h ? { h, st: L[h.f].e[0].st } : 'nohit');
      L = await run(PW(1) + ' d.setMeter(10);' + AT(505, 450), 'if (i === 0) d.pressed("light", 1);', 40, 20);
      h = firstHit(L);
      check(tag + 'dc_wake platewalker (from behind): L1 lands for ' + M.light1.dmg + ' (kbResist 0 while it walks: not moved)', !!h && h.dmg === M.light1.dmg && h.evx === 0, h || 'nohit');
      L = await run(PW(-1) + ' d.setMeter(10); d.teleport(555, 372);', 'if (i === 0) { d.pressed("down", 40); d.pressed("light", 1); }', 40, 20);
      h = firstHit(L);
      check(tag + 'dc_wake platewalker (from above): the down-strike lands for ' + M.down.dmg + ' and pogoes', !!h && h.dmg === M.down.dmg && L.some(r => r.vy <= -575 && r.vy >= -585), h || 'nohit');
      // screenshot: the heavy guard-break on the platewalker (hitboxes shown)
      if (id === 'brackmaw' || id === 'korvask') {
        await evs(CLEAR + PW(-1) + AT(505, 450) + ' d.showHitboxes(true);'); await step(3);
        await page.evaluate(() => { const d = window.UB.debug, g = window.UB.game; d.pressed('heavy', 1); for (let i = 0; i < 60; i++) { d.step(1); const pl = g.player; if (pl.moveName === 'heavy' && pl.moveT === pl.move.s + 1) break; } });
        await shot('qa-combat-r3-' + id + '-platewalker.png', { x: 420, y: 380, width: 560, height: 300 });
        await evs('d.showHitboxes(false);'); await step(60);
      }
      // real scuttlebit: hitstun = 10 + hitstop and the AI is frozen for exactly that long (it does not move until it ends)
      L = await run('d.killEnemies();' + SCUT(18) + AT(500, 450), 'if (i === 0) d.pressed("light", 1);', 40, 20);
      h = firstHit(L);
      { const stun = h ? L.slice(h.f).map(r => r.e[0] ? r.e[0].hs : -1) : [], firstZero = stun.indexOf(0);
        check(tag + 'dc_wake scuttlebit: hitstun 10 + ' + M.light1.hitstop + ' = ' + (10 + M.light1.hitstop) + ' f, counted down after the ' + M.light1.hitstop + ' f hitstop', !!h && stun[0] === 10 + M.light1.hitstop && firstZero === 10 + 2 * M.light1.hitstop, { stun: stun.slice(0, 20), firstZero }); }
      // two targets in one swing: both take the L1
      L = await run('d.killEnemies();' + SCUT(18) + SCUT(18) + ' g.enemies[1].x = 540;' + AT(500, 450), 'if (i === 0) d.pressed("light", 1);', 30, 20);
      check(tag + 'dc_wake: one L1 hits two overlapping scuttlebits (one hit each)', L.some(r => r.e.length === 2 && r.e[0].hp === 999 - M.light1.dmg && r.e[1].hp === 999 - M.light1.dmg), uniq(L.map(r => r.e.map(e => e.hp).join('/'))));

      // ---------- G2. the pull must not hand the enemy a free contact hit (DESIGN §4.2.5 "keeps targets in range") ----------
      if (id === 'korvask') {
        await ev((d) => d.god(false));
        const pulls = [];
        for (const dist of [40, 50]) {
          L = await run('d.killEnemies();' + SCUT(18) + ' g.enemies[0].x = 500 + ' + dist + '; d.setHp(6);' + AT(500, 450), `if (i === 0) { ${chainTo(3)} d.pressed("light", 1); }`, 70, 30);
          h = firstHit(L);
          pulls.push({ dist, hit: h && h.dmg, hurtAt: L.findIndex(r => r.hurt > 0), hp: L[69].hp, closest: h ? Math.min(...L.slice(h.f, h.f + 40).map(r => r.e[0] ? Math.round(r.e[0].x - r.x) : 99)) : null });
          await evs('d.killEnemies();'); await step(60);
        }
        check(tag + 'dc_wake: Chain Haul on a scuttlebit 40/50 px ahead (god off) must not drag it into Korvask\'s body for a contact hurt during the move', pulls.every(p => p.hit === 6 && p.hurtAt < 0 && p.hp === 6), pulls);
        await evs(CLEAR + 'd.killEnemies();' + SCUT(18) + ' g.enemies[0].x = 545; d.setHp(6);' + AT(500, 450) + ' d.showHitboxes(true);'); await step(3);
        await page.evaluate(() => { const d = window.UB.debug, g = window.UB.game; g.player.chain = 2; g.player.chainTimer = 20; d.pressed('light', 1); for (let i = 0; i < 24; i++) d.step(1); });
        await shot('qa-combat-r3-korvask-pull.png', { x: 420, y: 380, width: 480, height: 280 });
        await evs('d.showHitboxes(false); d.killEnemies();'); await step(60);
        await ev((d) => d.god(true));
      }

      // ---------- G3. hurt knockback points away from the source on either side ----------
      await ev((d) => d.god(false));
      L = await run('d.killEnemies(); d.setHp(' + D.hp + ');' + AT(560, 450), 'if (i === 0) { ' + WALKER_AT(16) + ' g.enemies[0].x = g.player.x - 20; }', 10, 60);
      h = L.find(r => r.hurt > 0);
      check(tag + 'contact from the LEFT knocks the fighter to the right: vx = +240·weight', !!h && Math.abs(h.vx - 240 * D.weight) < 1 && Math.abs(h.vy + 300 * D.weight) < 1, h && { vx: h.vx, vy: h.vy });
      await evs('d.killEnemies();'); await step(60);
      await ev((d) => d.god(true));

      // ---------- G4. input / special edge cases ----------
      L = await run('d.killEnemies(); d.setEnergy(' + D.cost + ');' + AT(500, 450), 'if (i === 0) d.pressed("special", 1);', 20, 60);
      check(tag + 'a special with energy exactly = cost (' + D.cost + ') fires', L.some(r => r.mv === 'special') && L[0].en < 1, { mv: uniq(L.map(r => r.mv)), en: L[0].en });
      await overclockOn(500, 450);
      L = await run('d.killEnemies(); d.setEnergy(39);' + AT(500, 450), 'if (i === 0) d.pressed("special", 1);', 20, 20);
      check(tag + 'the ultimate at 39 energy is denied (no move, 10 f lockout, nothing spent)', !L.some(r => r.mv) && L[0].lo === 10 && L[0].en >= 38.9, { mv: uniq(L.map(r => r.mv)), lo: L[0].lo, en: L[0].en });
      // an ultimate that outlives the Overclock (2 f left on the press) completes without errors and keeps its sheet damage
      L = await run(WALKER + ' d.setEnergy(100); g.player.overclock = 5;' + AT(500, 450, -1), 'if (i === 0) d.pressed("special", 1);', 140, 20);
      check(tag + 'an ultimate started with 2 f of Overclock left runs to its end (no stall, the form reverts, damage still lands)', L.some(r => r.mv === 'ultimate' && r.oc) && L.some(r => r.mv === 'ultimate' && !r.oc) && !L[139].mv && !L[139].oc && hitsOf(L).length >= 1 && t.errors.length === 0, { ult: L.filter(r => r.mv === 'ultimate').length, ocDuring: uniq(L.filter(r => r.mv === 'ultimate').map(r => r.oc)), hits: hitsOf(L).slice(0, 3), ocAt139: L[139].oc, mv139: L[139].mv });
      await overclockOff();
      // Overclock buffered through the end of an attack: pressed 4 f before L1 ends, it fires on the first free frame (6 f buffer, "first legal frame")
      { const l1t = M.light1.s + M.light1.a + M.light1.r;
        L = await run('d.killEnemies(); d.setMeter(100);' + AT(500, 450), 'if (i === 0) d.pressed("light", 1); if (i === ' + (l1t - 4) + ') d.pressed("overclock", 1);', l1t + 6, 40);
        const ocAt = L.findIndex(r => r.st === 'overclock');
        check(tag + 'Overclock pressed 4 f before L1 ends is buffered and starts on the first free frame f' + (l1t + 1), ocAt === l1t, { ocAt: ocAt < 0 ? 'never' : ocAt + 1, firstFree: l1t + 1 });
        await evs('g.player.overclock = 1; g.player.ocTransform = 0;'); await step(40); }
      // air attack: momentum preserved and gravity keeps integrating during the move
      L = await run('d.killEnemies();' + AT(400, 450), 'if (i < 40) d.pressed("right", 1); if (i === 20) d.pressed("jump", 30); if (i === 24) d.pressed("light", 1);', 40, 30);
      { const air = L.filter(r => r.mv === 'air');
        check(tag + 'air attack keeps the horizontal momentum (vx never halved) and gravity continues (vy rises each frame)', air.length >= 6 && air.every(r => r.vx > D.run * 0.9) && air.every((r, i) => i === 0 || r.vy > air[i - 1].vy), air.slice(0, 4).map(r => [r.vx, r.vy])); }
      // down-strike: the dive is at least 500 px/s during the active frames
      L = await run('d.killEnemies();' + AT(500, 300), 'if (i === 0) { d.pressed("down", 40); d.pressed("light", 1); }', 12, 40);
      check(tag + 'down-strike dives at ≥ 500 px/s on its first active frame', L.some(r => r.mv === 'down' && r.mt === M.down.s + 1 && r.vy >= 500), L.filter(r => r.mv === 'down').slice(0, 7).map(r => [r.mt, r.vy]));
      // a new down-strike may start on the frame after a pogo (§3.6)
      L = await run('d.killEnemies();' + SCUT(18) + ' d.teleport(555, 372);', 'if (i === 0) { d.pressed("down", 60); d.pressed("light", 1); } if (g.player.vy <= -575 && g.player.vy >= -585 && !g.__p) { g.__p = 1; d.pressed("light", 1); }', 40, 30);
      { const pg = L.findIndex(r => r.vy <= -575 && r.vy >= -585), nxt = pg > 0 ? L.slice(pg + 1).find(r => r.vy !== L[pg].vy) : null;   // the pogo hitstop freezes the world for 3 f first
        check(tag + 'a new down-strike starts on the first player frame after the pogo (§3.6)', !!nxt && nxt.mv === 'down' && nxt.mt === 1 && nxt.f <= pg + 1 + M.down.hitstop + 1, { pg, next: nxt && [nxt.f, nxt.mv, nxt.mt] }); }
      // dash: the facing is locked for the dash frames even with the opposite direction held
      await evs('d.grant("burstLine", true);');
      L = await run('d.killEnemies();' + AT(300, 450), 'if (i === 0) d.pressed("dash", 1); if (i >= 1) d.pressed("left", 1);', D.dash[1], 20);
      check(tag + 'dash: facing locked and the full ' + D.dash[0] + ' px travelled with the opposite direction held', L.filter(r => r.dash).every(r => r.fac === 1) && Math.abs(Math.max(...L.map(r => r.x)) - 300 - D.dash[0]) < 1, { fac: uniq(L.filter(r => r.dash).map(r => r.fac)), maxX: Math.max(...L.map(r => r.x)) });
      await evs('d.grant("burstLine", false);');
      // energy never exceeds energyMax
      L = await run('d.killEnemies(); d.setEnergy(99.9);' + AT(500, 450), '', 30, 5);
      check(tag + 'energy regen stops at energyMax (100)', L[29].en === 100, L[29].en);
      // wall jump refreshes the Echo Jump: a second press after a wall jump is a −djMult·jumpVel jump
      await evs('d.grant("gripProtocol", true); d.grant("echoJump", true);');
      await ev((d) => d.warp('debug_room', { x: 70, y: 450 })); await step(3);
      L = await run('d.teleport(70, 450); g.player.facing = -1;', 'if (i === 0) d.pressed("jump", 10); if (i >= 2 && i < 40) d.pressed("left", 1); if (i === 40) d.pressed("jump", 1); if (i === 48) d.pressed("jump", 1);', 60, 20);
      check(tag + 'wall jump then Echo Jump: the second press 8 f later jumps at −' + D.djMult + '·jumpVel (the wall jump did not consume it)', L[40].vx === D.run + 40 && L[48].aj === 0 && Math.abs(L[48].vy - D.gravity / 60 + D.djMult * D.jumpVel) < 1, { wj: [L[40].vx, L[40].vy, L[40].aj], ej: [L[48].vy, L[48].aj] });
      await evs('d.grant("gripProtocol", false); d.grant("echoJump", false);');
      await ev((d) => d.god(false));
    }

    // ======================= G5. Vellix's i-frame windows are exactly the sheet's =======================
    {
      await start('vellix', 420, 450, 'debug_room');
      await ev((d) => d.god(false));
      // a 1-dmg enemy hit registered for the tick in which the Blink Strike reaches frame f: immune on f5–12, hurt on f4 and f13 (§4.2.3 "i-frames on f5–12 only")
      const ENEMY_HIT = (mv) => `if (g.player.moveName === "${mv}" && g.player.moveT === g.__mt - 1 && !g.__h) { g.__h = 1; const E = window.UB.Entity; const h = E.makeHit("enemy"); h.dmg = 1; h.flags = 0; h.x = g.player.x - 60; h.y = g.player.y - 80; h.w = 120; h.h = 90; h.facing = -1; g.registerHit(h); }`;
      const win = [];
      for (const mt of [4, 5, 12, 13]) {
        await evs('g.__mt = ' + mt + '; g.__h = 0;');
        const L = await run('d.killEnemies(); d.setEnergy(100); d.setHp(4);' + AT(420, 450), 'if (i === 0) d.pressed("special", 1);' + ENEMY_HIT('special'), 30, 40);
        win.push({ mt, hurt: L.some(r => r.hurt > 0) });
      }
      check('[vellix] Blink Strike i-frames are f5–12 only: a hit on f4 hurts, f5 and f12 are immune, f13 hurts again', JSON.stringify(win.map(w => w.hurt)) === JSON.stringify([true, false, false, true]), win);
      await overclockOn(420, 450);
      const win2 = [];
      for (const mt of [38, 39]) {
        await evs('g.__mt = ' + mt + '; g.__h = 0;');
        const L = await run('d.killEnemies(); d.setEnergy(100); d.setHp(4);' + AT(420, 450), 'if (i === 0) d.pressed("special", 1);' + ENEMY_HIT('ultimate'), 60, 40);
        win2.push({ mt, hurt: L.some(r => r.hurt > 0) });
        await evs('g.player.overclock = 720;');
      }
      check('[vellix] Afterimage Storm i-frames are f1–38 only: f38 immune, f39 hurts', JSON.stringify(win2.map(w => w.hurt)) === JSON.stringify([false, true]), win2);
      await overclockOff();
    }

    // ======================= G6. specials on a moving belt (lw_belts M1 over the static pool) =======================
    for (const id of ['vellix', 'tessik', 'brackmaw', 'orrubel', 'korvask']) {
      await start(id, 500, 450, 'lw_belts');
      await ev((d) => d.god(false));
      const belt = await page.evaluate(() => { const p = window.UB.game.level.platforms[0]; return { x: p.x, y: p.y, w: p.w, h: p.h }; });
      await evs(CLEAR + 'd.setEnergy(100); d.setHp(5); d.teleport(' + (belt.x + belt.w / 2) + ', ' + (belt.y - 2) + '); g.player.facing = 1;'); await step(20);
      const before = await page.evaluate(() => { const p = window.UB.game.level.platforms[0], pl = window.UB.game.player; return { beltX: p.x, beltDx: p.dx, x: pl.x, y: pl.y, onBelt: !!pl.ground }; });
      const L = await log(120, 'if (i === 0) { g.player.facing = 1; d.pressed("special", 1); }');
      const beltRight = () => page.evaluate(() => { const p = window.UB.game.level.platforms[0]; return p.x + p.w; });
      if (id === 'vellix') {
        const sl = L.filter(r => r.ph === 'slide');
        const maxX = Math.max(...sl.map(r => r.x)), right = await beltRight();
        check('[vellix] lw_belts: Blink Strike on the belt stops at the belt\'s edge (a mover is footing, §4.2.3) — never hangs in the air nor drops into the pool', before.onBelt && sl.length === 8 && sl.every(r => r.gnd) && !L.some(r => r.mode === 'hazard') && L[119].hp === 5, { before, slide: sl.map(r => [r.x, Math.round(r.y), r.gnd]), hazard: L.some(r => r.mode === 'hazard'), hp: L[119].hp, beltRightNow: right });
        await evs('d.showHitboxes(true);'); await shot('qa-combat-r3-vellix-belt.png', { x: 0, y: 0, width: 1280, height: 720 }); await evs('d.showHitboxes(false);');
      } else if (id === 'tessik') {
        const alive = L.filter(r => r.pr > 0).length;
        check('[tessik] lw_belts: a Pulse Line fired from the belt rides the belt surface (a mover is a floor, §3.0) instead of dying on its spawn frame', before.onBelt && L.some(r => r.mv === 'special') && alive >= 10, { before, alive, energyAfter: L[30].en });
      } else if (id === 'brackmaw') {
        check('[brackmaw] lw_belts: Vault Stomp on the belt bursts normally and Brackmaw stays on the belt', before.onBelt && L.some(r => r.ph === 'burst') && !L.some(r => r.mode === 'hazard') && L[119].hp === 5, { phases: uniq(L.map(r => r.ph)), hp: L[119].hp });
      } else if (id === 'orrubel') {
        check('[orrubel] lw_belts: a sentry cast from the belt is placed and stays alive', before.onBelt && L.filter(r => r.pr > 0).length >= 100, { alive: L.filter(r => r.pr > 0).length });
      } else {
        check('[korvask] lw_belts: Bulwark Catch on the belt runs its stance and whiff recovery, Korvask rides the belt', before.onBelt && L.some(r => r.ph === 'stance') && L.some(r => r.ph === 'whiff') && !L.some(r => r.mode === 'hazard'), { phases: uniq(L.map(r => r.ph)) });
      }
    }

    // ======================= G7. every fighter can damage every boss with its live AI (god on; the bot runs, jumps and attacks) =======================
    const ARENAS = [['tallock', 'dc_sentinel'], ['weftyr', 'lw_weftyr'], ['corrosant', 'bv_corrosant'], ['kernauth', 'rw_throne']];
    for (const [boss, room] of ARENAS) {
      for (const id of IDS) {
        const tag = '[' + id + '] ';
        await start(id, 100, 450, room);
        await evs('d.god(true); d.grant("echoJump", true); d.grant("burstLine", true); d.grant("gripProtocol", true);');
        const r = await page.evaluate(({ boss, room, frames }) => {
          const d = window.UB.debug, g = window.UB.game, W = window.UB.World;
          const sp = W.spawnPx(W.rooms[room], null); d.teleport(sp.x, sp.y);
          d.spawnBoss(boss, {});
          for (let i = 0; i < 10; i++) d.step(1);
          const b = g.boss, hp0 = b.hp;
          let hits = 0, lastHp = hp0, dmg = 0, firstHit = -1, died = -1;
          const kinds = {};
          for (let i = 0; i < frames; i++) {
            const bb = g.boss, p = g.player; if (!bb || bb.dead || g.bossFight.state === 'dying') { died = i; break; }
            const dx = bb.x - p.x, dy = bb.cy() - p.cy();
            if (Math.abs(dx) > 56) d.pressed(dx > 0 ? 'right' : 'left', 1);
            else {
              if (Math.sign(dx) !== p.facing && !p.move) d.pressed(dx > 0 ? 'right' : 'left', 1);
              if (dy < -30 && p.onGround && !p.move) d.pressed('jump', 14);
              else if (dy < -60 && !p.onGround && p.vy > 0 && p.airJumps > 0) d.pressed('jump', 10);
              if (i % 2 === 0) { if (!p.onGround && dy > 24) d.pressed('down', 1); d.pressed('light', 1); }
            }
            d.step(1);
            if (g.boss && g.boss.hp < lastHp) { hits++; dmg += lastHp - g.boss.hp; if (firstHit < 0) firstHit = i; kinds[p.moveName || 'proj'] = (kinds[p.moveName || 'proj'] || 0) + 1; }
            if (g.boss) lastHp = g.boss.hp;
          }
          return { hp0, hpEnd: g.boss ? g.boss.hp : 0, hits, dmg, firstHit, died, kinds, fight: g.bossFight.state, errors: 0 };
        }, { boss, room, frames: boss === 'tallock' ? 1800 : 1500 });
        if (boss === 'tallock') check(tag + 'live Tallock in dc_sentinel: the bot kills it (120 dmg) within 1800 f', r.died > 0 && r.dmg >= 120, r);
        else check(tag + 'live ' + boss + ' in ' + room + ': the fighter connects (≥ 1 hit) within 1500 f', r.hits >= 1, r);
      }
    }

    // ======================= G8. ultimates vs the held Tallock: the sheet numbers on a boss (kbResist 0) =======================
    for (const id of ['tessik', 'brackmaw', 'vellix', 'orrubel']) {
      const tag = '[' + id + '] ';
      await start(id, 500, 450, 'dc_sentinel');
      await ev((d) => d.god(true));
      await evs('d.spawnBoss("tallock", { x: 25, y: 14 }); g.boss.update = function () {}; g.boss.contact = 0;'); await step(2);
      await overclockOn(640, 450);
      await evs(CLEAR + 'g.boss.x = 720; d.teleport(640, 450); g.player.facing = 1; d.setEnergy(100);'); await step(3);
      const hp0 = (await state()).boss.hp;
      const L = await log(200, 'if (i === 0) d.pressed("special", 1);');
      const hp1 = (await state()).boss.hp, bossHps = uniq(L.map(r => r.boss.hp));
      if (id === 'tessik') check(tag + 'Sightline on Tallock: 4 ticks × 5 = 20', hp0 - hp1 === 20 && bossHps.length === 5, { dmg: hp0 - hp1, bossHps });
      if (id === 'brackmaw') check(tag + 'Quake Vault on Tallock: 26', hp0 - hp1 === 26, { dmg: hp0 - hp1 });
      if (id === 'vellix') check(tag + 'Afterimage Storm on Tallock: 4 passes × 6 = 24, the boss is never moved', hp0 - hp1 === 24 && uniq(L.map(r => r.boss.x)).length === 1, { dmg: hp0 - hp1, xs: uniq(L.map(r => r.boss.x)) });
      if (id === 'orrubel') check(tag + 'Sentry Triad on Tallock: the sentries lock the boss and the bolts deal 2 each (≥ 6 bolts in 200 f)', hp0 - hp1 >= 12 && (hp0 - hp1) % 2 === 0, { dmg: hp0 - hp1 });
      await overclockOff();
      await ev((d) => d.god(false));
    }

    // ======================= G9. pool hazard (static pool of debug_room2) + the Overclock meter is untouched by a hazard =======================
    {
      await start('orrubel', 300, 450, 'debug_room2');
      await ev((d) => d.god(false));
      await evs(CLEAR + 'd.setHp(5); d.setMeter(40); d.setEnergy(70); d.teleport(495, 450);'); await step(0);
      const L = await log(70, '');
      const hz = L.filter(r => r.mode === 'hazard'), after = L.find(r => r.f > hz[hz.length - 1].f);
      check('[orrubel] static pool: 1 heart, 30 f freeze (+6 hitstop +10 fade) with the body frozen, respawn at the room entry with 45 i-frames, energy and meter unchanged', hz.length >= 45 && hz.length <= 46 && L[0].hp === 4 && uniq(hz.map(r => r.x + ',' + r.y)).length === 1 && !!after && after.ifr >= 44 && after.x === 300 && after.me === 40 && after.en >= 70 && after.en <= 73, { hazardFrames: hz.length, hp: L[0].hp, after });
    }

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
