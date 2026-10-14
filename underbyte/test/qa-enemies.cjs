/*
 * UNDERBYTE — test/qa-enemies.cjs   (QA round 3, lens: ENEMIES & BOSSES — supersedes the round-2 file, whose checks it keeps)
 * Run:  node underbyte/test/qa-enemies.cjs      (exit code 0 = every check passed)
 *
 * Everything here runs in the REAL rooms (UB.debug.warp), never the debug arenas:
 *   A. roster: every room's enemies = DESIGN §6 (type, variant, tile); TYPES / DATA complete
 *   B. soak: 1200 frames per room — no enemy inside a solid tile, outside the room, or NaN
 *   C. state machines (DESIGN §7 timings ±10 %): scuttlebit, hopnode (+nullnode/dripnode), driftmoth,
 *      brinejelly, glarewisp (tired ×2), spitvalve (+acid puddle, twin valve), rambyte (+rootram), platewalker
 *      (+rootplate: shield front/back/heavy/down-strike, bash), broodcell (motes ≤ 6, pop on death), droplatch,
 *      voltwheel, static-shot sparks; tells screenshotted mid-tell; projectiles hurt the player (god off)
 *   D. damage + death + drops per type (bits value = DESIGN §7, guaranteed shards, enemiesPurged)
 *   E. the four boss fights entered through the real door: trigger, card, seals, boss music, 150 f intro,
 *      every attack within 1500 f (screenshot mid-tell, tell ≥ 20 f), arena geometry, attack reach, enrage roar +
 *      invulnerability, death → rewards at spec.pickup → pickup sequence → ability / seals / bossesDefeated / zone music,
 *      skippable death animation + pickup sequence, re-entry without a re-fight; Kernauth: phase 2 inside takeHit,
 *      phase-2 attacks, Panic Loop, victory
 *   F. fairness: Tessik vs Tallock, god OFF, 60 s of real inputs by a simple scripted player — hearts lost reported
 *   H. (round 2) enemies, deeper: an ACTIVE soak, body contact, spitvalve scan/glob/pop/interrupt, rambyte, platewalker
 *      turn-behind/block/bash, glarewisp, droplatch alert + first-footing landings, voltwheel, motes, hopnode, variant kills
 *   I. (round 2) bosses, deeper (god OFF): every attack's damage, §8.5 flags, Tallock's classes/recoveries, Weftyr's cycle +
 *      Snare Line, Corrosant head ×1.5, Kernauth core ×1 / mass ×0.5, every enraged tell = max(20, tell − cut), dead shots pop
 *   J. (round 2) the player dies during the boss death animation → the module waits in the arena
 *   K. (round 2) fairness bots (naive / crossing), the cornered Slab Swing
 *   --- round 3 additions (L) ---
 *   L1  kill sweep: every placement in every room dies to lights without ever embedding / leaving the room under knockback
 *   L2  §9.2 drop RATES over 560 kills (hearts by missing hearts, sparks by energy, shards)
 *   L3  every spitvalve placement fires into open air (globs live ≥ 60 f)
 *   L4  a platewalker lured into bashing at the end of its stretch must stay on its floor (lw_belts pools / block, bv_cistern ledge)
 *   L5  enemy tells mid-tell screenshots (qa3-tell-*.png)
 *   L6  Tallock's Stack Slam vs the row-12 shelves: a ground boss must not land on / fight from a one-way shelf
 *   L7  Corrosant's Flood: the §8.0 fairness floor (≥ 20 f of warning), −1 as a hazard, death at 1 heart (no softlock)
 *   L8  Corrosant's Wall Lunge must be able to reach a floor-standing player (DESIGN §8.3 "picks the player's y ±1 tile")
 *   L9  Kernauth's Dive Bomb at a player on the row-10 grate: no teleport to the floor; a standing fighter takes the shock
 *   L10 Kernauth's Cable Sweep is avoidable by jumping over the tip (with Echo Jump) at several floor distances
 *   L11 the other named floor dodges work: Thread Dash jump, Stomp Quake wave hop, Static Beam with Echo Jump
 *   L12 dying mid-fight → node respawn → re-entry restarts the fight clean
 *   L13 fairness: the round-3 scripted Tessik vs Tallock (god off, 60 s) — hearts lost reported, every tell ≥ 20 f
 * Screenshots: test/shots/qa-enemy-*.png, qa-boss-*.png, qa2-*.png, qa3-*.png
 */
const path = require('path');
const fs = require('fs');
const { launch } = require('./harness.cjs');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info) : ''));
}
function near(name, got, want, tol, info) {
  check(name + ' (' + (typeof got === 'number' ? Math.round(got * 100) / 100 : got) + ' ≈ ' + want + ' ±' + tol + ')', typeof got === 'number' && Math.abs(got - want) <= tol, info);
}
function info(line) { console.log('INFO ' + line); }
/** longest run length of `state` in a run-length list */
function runLen(runs, state) { let best = 0; for (const r of runs) if (r[0] === state && r[1] > best) best = r[1]; return best; }
function hasRun(runs, state) { return runs.some(r => r[0] === state); }
const dmgOf = (hits) => hits.reduce((s, h) => s + h.dmg, 0);

// DESIGN §6 enemy placements per room: [type, tile x, tile y, variant|null]
const DESIGN_ROSTER = {
  dc_wake: [['scuttlebit', 20, 14]],
  dc_fall: [['scuttlebit', 5, 19], ['driftmoth', 16, 18], ['driftmoth', 14, 30], ['hopnode', 22, 49], ['scuttlebit', 26, 42]],
  dc_cross: [['scuttlebit', 8, 14], ['scuttlebit', 29, 12], ['hopnode', 47, 14], ['spitvalve', 57, 8], ['driftmoth', 37, 6]],
  dc_loft: [['droplatch', 21, 4], ['spitvalve', 29, 8]],
  dc_shrine: [], dc_sentinel: [],
  lw_hoist: [['driftmoth', 16, 13], ['driftmoth', 9, 27], ['droplatch', 27, 4]],
  lw_belts: [['platewalker', 38, 14], ['platewalker', 65, 12], ['rambyte', 82, 14], ['droplatch', 17, 3], ['droplatch', 57, 3], ['spitvalve', 49, 8]],
  lw_shaft: [['hopnode', 6, 33], ['droplatch', 16, 1], ['driftmoth', 18, 18], ['hopnode', 24, 4]],
  lw_rest: [], lw_weftyr: [],
  bv_sluice: [['brinejelly', 40, 13], ['brinejelly', 56, 9], ['hopnode', 38, 14, 'dripnode'], ['spitvalve', 50, 10, 'acidvalve']],
  bv_cistern: [['brinejelly', 20, 24], ['brinejelly', 28, 22], ['brinejelly', 34, 26], ['platewalker', 39, 11], ['scuttlebit', 50, 32, 'brinecrab'], ['voltwheel', 56, 32], ['broodcell', 47, 32], ['droplatch', 22, 4]],
  bv_catwalk: [['brinejelly', 10, 20], ['brinejelly', 20, 27], ['droplatch', 18, 13], ['hopnode', 25, 32, 'dripnode']],
  bv_rest: [], bv_corrosant: [],
  ns_base: [['glarewisp', 5, 14], ['glarewisp', 5, 24], ['droplatch', 20, 30], ['scuttlebit', 18, 19, 'staticshot']],
  ns_climb: [['voltwheel', 12, 69], ['glarewisp', 14, 45], ['glarewisp', 36, 30], ['glarewisp', 30, 8], ['droplatch', 38, 53], ['spitvalve', 4, 26], ['droplatch', 44, 19]],
  ns_rest: [],
  ns_plunge: [['droplatch', 19, 17], ['droplatch', 18, 32], ['glarewisp', 8, 14], ['glarewisp', 16, 36], ['broodcell', 10, 49], ['hopnode', 28, 29, 'nullnode']],
  rw_gate: [['platewalker', 10, 14, 'rootplate'], ['platewalker', 32, 14, 'rootplate'], ['rambyte', 40, 14, 'rootram'], ['spitvalve', 23, 10, 'twinvalve'], ['spitvalve', 33, 7, 'twinvalve'], ['broodcell', 3, 14], ['droplatch', 40, 2], ['scuttlebit', 23, 14, 'rootbound'], ['glarewisp', 38, 9, 'rootwisp']],
  rw_rest: [], rw_throne: [],
};
// DESIGN §8 arenas
const ARENAS = [
  { room: 'dc_sentinel', id: 'tallock', name: 'TALLOCK', sub: 'WARDEN OF THE STACK', seal: ['L'], hp: 120, enrage: 36, cut: 6, ability: 'echoJump', bits: 3, from: 'dc_shrine', song: 'driftcache',
    attacks: ['slabSwing', 'stompQuake', 'discToss', 'stackSlam'], tells: { slabSwing: 30, stompQuake: 36, discToss: 24, stackSlam: 40 },
    spots: ['near', 'far', 'mid', 'mid', 'far', 'near', 'mid', 'far'] },   // < 3 / > 6 / 3–6 tiles: every distance class (DESIGN §8.1 weights)
  { room: 'lw_weftyr', id: 'weftyr', name: 'WEFTYR', sub: 'THE SHUTTLE THAT WOULD NOT STOP', seal: ['L', 'B'], hp: 180, enrage: 54, cut: 5, ability: 'burstLine', bits: 5, from: 'lw_rest', song: 'loomworks',
    attacks: ['dash', 'snare', 'rain', 'spin'], tells: { dash: 30, snare: 24, rain: 40, spin: 30 },
    spots: [[6, 14], [20, 14], [33, 14], [12, 14], [7, 9], [20, 9], [33, 9], [26, 14]] },
  { room: 'bv_corrosant', id: 'corrosant', name: 'CORROSANT', sub: 'KEEPER OF THE BRINE', seal: ['L', 'B'], hp: 240, enrage: 72, cut: 8, ability: 'gripProtocol', bits: 7, from: 'bv_rest', song: 'brinevault',
    attacks: ['lunge', 'spit', 'drip', 'sweep'], tells: { lunge: 30, spit: 24, drip: 36, sweep: 40 },
    spots: [[6, 20], [20, 20], [36, 20], [10, 15], [23, 15], [16, 10], [30, 10], [12, 20]] },
  { room: 'rw_throne', id: 'kernauth', name: 'KERNAUTH', sub: 'THE ROOT PROCESS', seal: ['L'], hp: 200, hp2: 240, enrage: 60, cut: 8, ability: null, bits: 0, from: 'rw_rest', song: 'rootwell', final: true,
    attacks: ['cableSweep', 'rootSpikes', 'orbitalFlare', 'summon'], tells: { cableSweep: 30, rootSpikes: 40, orbitalFlare: 30, summon: 30 },
    attacks2: ['dive', 'beam', 'frag', 'blink'], tells2: { dive: 30, beam: 40, frag: 24, blink: 12 },
    spots: ['near', [20, 20], 'far', [56, 20], 'near', [50, 14], [31, 9], [26, 20]], window: 2400 },
];

(async () => {
  const t = await launch();
  const page = t.page;
  /** run fn(d, g, Q, ...args) inside the page (d = UB.debug, g = UB.game, Q = the helper installed below) */
  const ev = (fn, ...args) => page.evaluate(({ src, args }) => (new Function('d', 'g', 'Q', 'args', 'return (' + src + ')(d, g, Q, ...args)'))(window.UB.debug, window.UB.game, window.__qa, args), { src: fn.toString(), args });
  const shot = async (name) => { await page.waitForTimeout(50); await page.screenshot({ path: path.join(SHOTS, name) }); };

  try {
    // ---------------------------------------------------------------- boot + helpers
    await page.evaluate(() => localStorage.removeItem('underbyte.save'));
    await page.reload(); await page.waitForTimeout(250);
    const boot = await page.evaluate(() => {
      const d = window.UB.debug, g = window.UB.game, E = window.UB.Entity;
      d.pauseLogic(true); d.newGame('tessik');
      let s = null;
      for (let i = 0; i < 200; i++) { d.step(1); s = d.state(); if (s.screen === 'play' && !s.busy) break; }
      d.god(true);
      g.save.loreSeen = window.UB.IDS.zones.slice();   // no zone lore cards freezing the world mid-test
      const Q = window.__qa = {};
      Q.pin = null; Q.drops = []; Q.lastTag = null;
      /** hold the player at (x, y) every frame (physics off for the player; enemies/bosses read its position normally) */
      Q.pinAt = function (x, y) { Q.pin = { x: x, y: y }; const pl = g.player; pl.x = x; pl.y = y; pl.px = x; pl.py = y; pl.vx = 0; pl.vy = 0; };
      /** step n frames; the pinned player is re-placed each frame; hp drops are logged (with the hit's tag) and refilled (never dies) */
      Q.step = function (n) {
        for (let i = 0; i < n; i++) {
          if (Q.pin) { const pl = g.player; pl.x = Q.pin.x; pl.y = Q.pin.y; pl.vx = 0; pl.vy = 0; }
          const h0 = g.player.hp; d.step(1);
          if (g.player.hp < h0) { Q.drops.push({ frame: g.frame, hp: g.player.hp, dmg: h0 - g.player.hp, mode: g.mode, tag: Q.lastTag }); g.player.hp = g.player.maxHp; }
        }
      };
      /** tag the hit that hurt the player (hit.tag / 'contact' / 'hazard'); wraps the current player object once */
      Q.wrapHurt = function () {
        const pl = g.player; if (!pl || pl.__qaWrapped) return;
        const orig = pl.hurt;
        pl.hurt = function (dmg, fromX, opts) { const took = orig.call(this, dmg, fromX, opts); if (took) Q.lastTag = opts && opts.hit ? (opts.hit.tag || opts.hit.kind) : (opts && opts.hazard ? 'hazard' : 'contact'); return took; };
        pl.__qaWrapped = true;
      };
      Q.wrapHurt();
      Q.runLen = function (runs, state) { let best = 0; for (const r of runs) if (r[0] === state && r[1] > best) best = r[1]; return best; };
      Q.takeDrops = function () { const r = Q.drops.slice(); Q.drops.length = 0; return r; };
      Q.find = function (type, variant) { return g.enemies.find(e => e.type === type && !e.dead && (variant === undefined || e.variant === variant)) || null; };
      Q.enter = function (room, exitId) { Q.pin = null; d.warp(room, exitId === undefined ? null : exitId); d.step(2); Q.wrapHurt(); };
      Q.stuck = function (e) { const lv = g.level; return E.overlapsSolid(lv, e.x - e.w / 2 + 1, e.y - e.h + 1, e.w - 2, e.h - 2); };
      Q.tileAt = function (tx, ty) { return E.tileAt(g.level, tx, ty); };
      /** run `frames`, recording the tracked enemy's state run lengths, max projectiles, stuck frames, hp drops */
      Q.run = function (frames, e, pinFollow) {
        const runs = []; let cur = null, len = 0, maxProj = 0, stuck = 0, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, maxVx = 0, maxV = 0;
        for (let f = 0; f < frames; f++) {
          if (pinFollow) pinFollow(f, e);
          Q.step(1);
          const st = e && !e.dead ? e.state : 'DEAD';
          if (st !== cur) { if (cur !== null) runs.push([cur, len]); cur = st; len = 1; } else len++;
          if (g.projectiles.length > maxProj) maxProj = g.projectiles.length;
          if (e && !e.dead) { if (Q.stuck(e)) stuck++; minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x); minY = Math.min(minY, e.y); maxY = Math.max(maxY, e.y); if (Math.abs(e.vx) > maxVx) maxVx = Math.abs(e.vx); const v = Math.hypot(e.vx, e.vy); if (v > maxV) maxV = v; }
        }
        runs.push([cur, len]);
        return { runs, maxProj, stuck, minX, maxX, minY, maxY, maxVx, maxV, hits: Q.takeDrops(), e: e ? { x: e.x, y: e.y, hp: e.hp, state: e.state, facing: e.facing, contact: e.contact, kbResist: e.kbResist, dead: e.dead, hitstun: e.hitstun } : null };
      };
      /** step until the enemy's state === want (max frames); returns frames waited or -1 */
      Q.until = function (e, want, max) { for (let f = 0; f < max; f++) { if (e.state === want) return f; Q.step(1); } return e.state === want ? max : -1; };
      /**
       * Attack the enemy: side +1 = player stands on the enemy's LEFT facing right; -1 = on its right facing left.
       * kind light|heavy|down. Steps frame by frame and stops the moment the enemy dies. Returns frames used.
       */
      Q.attack = function (e, side, kind, follow) {
        const reach = e.w / 2 + 26;
        const cy = e.y - e.h / 2;   // enemy box centre → the player's body centre (y − 24) level with it
        if (kind === 'down') Q.pinAt(e.x, e.y - e.h - 30); else { Q.pinAt(e.x - side * reach, cy + 24); g.player.facing = side; }
        d.pressed(side > 0 ? 'right' : 'left', 1); Q.step(1);
        if (kind === 'down') { Q.pin = null; d.pressed('down', 6); d.pressed('light', 2); }
        else d.pressed(kind, 2);
        const n = 2 + (follow || 12);
        for (let f = 0; f < n; f++) { Q.step(1); if (e.dead) return f + 1; }
        return n;
      };
      /** kill the enemy with repeated lights from behind/left; returns the pickups spawned by its death */
      Q.kill = function (e, maxTries) {
        const before = new Set(g.pickups);
        const purged0 = g.save.enemiesPurged;
        const ex = e.x, ey = e.y;
        let tries = 0;
        while (!e.dead && tries < (maxTries || 30)) {
          e.x = ex; e.y = ey; e.px = ex; e.py = ey; e.vx = 0; e.vy = 0; e.hitstun = 0; e.flash = 0;
          if (e.type === 'platewalker') { e.state = 'open'; e.timer = 0; }
          if (e.type === 'droplatch') { e.state = 'splat'; e.timer = 0; }
          if (e.type === 'glarewisp') { e.state = 'drift'; e.timer = 0; }
          if (e.type === 'rambyte') { e.state = 'pace'; e.timer = 0; }
          if (e.type === 'broodcell') { e.state = 'rest'; e.timer = 0; for (const m of g.enemies) if (m.type === 'mote') m.dead = true; }
          Q.attack(e, -1, 'light'); tries++;
        }
        const drops = g.pickups.filter(p => !before.has(p)).map(p => ({ type: p.type, size: p.size }));
        return { dead: e.dead, tries, drops, purgedDelta: g.save.enemiesPurged - purged0 };
      };
      Q.comp = function (drops) { const c = { small: 0, medium: 0, large: 0, heart: 0, spark: 0, shard: 0 }; for (const p of drops) { if (p.type === 'bit') c[p.size]++; else c[p.type] = (c[p.type] || 0) + 1; } return c; };
      // ---- boss helpers
      Q.openings = function () { return g.level.openings.map(o => ({ id: o.id, sealed: !!o.sealed })); };
      Q.card = function () { const UI = window.UB.UI; return { t: UI.cardT, dur: UI.cardDur, name: UI.cardName, sub: UI.cardSub }; };
      Q.boss = function () { const b = g.boss; return b ? { id: b.id, hp: b.hp, maxHp: b.maxHp, phase: b.phase, state: b.state, attack: b.attack, timer: b.timer, x: b.x, y: b.y, w: b.w, h: b.h, active: b.active, enraged: !!b.enraged, roar: b.roar || 0, contact: b.contact, fight: g.bossFight.state, mode: g.mode, locked: g.player.locked, song: window.UB.Audio.state().song, iframes: g.player.iframes, A: b.A ? { x0: b.A.x0, x1: b.A.x1, cx: b.A.cx, floorY: b.A.floorY, ceilY: b.A.ceilY } : null } : { fight: g.bossFight.state, mode: g.mode, song: window.UB.Audio.state().song, boss: null }; };
      Q.isTell = function (b) { return b.state === 'tell' || b.state === 'tell2' || b.state === 'blinkOut' || b.state === 'retell' || b.state === 'retell2'; };
      /** step (moving the pinned player between floor `spots` every 90 f) until a tell of an attack not in `seen` starts */
      Q.untilNewTell = function (seen, max, spots) {
        for (let f = 0; f < max; f++) {
          if (spots && f % 90 === 0) {
            const sp = spots[Math.floor(f / 90) % spots.length], bb = g.boss;
            if (sp === 'near' && bb) Q.pinAt(bb.x + (bb.x < bb.A.x0 + 150 ? 70 : -70), bb.A.floorY);
            else if (sp === 'mid' && bb) Q.pinAt(bb.x + (bb.x < bb.A.cx ? 140 : -140), bb.A.floorY);
            else if (sp === 'far' && bb) Q.pinAt(bb.x < (bb.A.x0 + bb.A.x1) / 2 ? bb.A.x1 - 90 : bb.A.x0 + 90, bb.A.floorY);
            else Q.pinAt(sp[0] * 30 + 15, (sp[1] + 1) * 30);
          }
          if (f % 300 === 299) for (const m of g.enemies) if (m.type === 'mote') m.dead = true;
          Q.step(1);
          const b = g.boss; if (!b) return null;
          if (Q.isTell(b) && b.attack && seen.indexOf(b.attack) < 0) { const o = Q.boss(); o.f = f; return o; }
        }
        return null;
      };
      /** pin beside the boss, level with its box, light-attack until `pred()` (default: hp dropped); returns tries */
      Q.hitBoss = function (tries, pred) {
        const b = g.boss; if (!b) return { failed: true };
        const hp0 = b.hp; pred = pred || function () { return b.hp < hp0; };
        for (let k = 0; k < (tries || 20); k++) {
          const hw = b.w / 2, py = b.y - b.h / 2 + 24;
          Q.pinAt(b.x - hw - 24, Math.min(py, b.y)); g.player.facing = 1;
          d.pressed('right', 1); Q.step(1);
          d.pressed('light', 2);
          for (let f = 0; f < 14; f++) { Q.step(1); if (pred()) return { hp0: hp0, hp: b.hp, tries: k + 1 }; }
        }
        return { hp0: hp0, hp: b.hp, tries: tries, failed: true };
      };
      /** enter an arena from its door (the fight triggers on the first tick) and run the 150 f intro; returns Q.boss() */
      Q.startFight = function (from, room) { Q.pin = null; d.warp(from, null); d.step(2); d.warp(room, 'L'); Q.wrapHurt(); Q.step(152); return Q.boss(); };
      /** step until boss.state === want (max frames), calling follow(f) first each frame; frames or -1 */
      Q.waitState = function (want, max, follow) { const b = g.boss; for (let f = 0; f < max; f++) { if (b.state === want) return f; if (follow) follow(f); Q.step(1); } return g.boss && g.boss.state === want ? max : -1; };
      /** step until the tell of attack `atk` starts (max frames); frames or -1 */
      Q.waitTell = function (atk, max, follow) { const b = g.boss; for (let f = 0; f < max; f++) { if (Q.isTell(b) && b.attack === atk) return f; if (follow) follow(f); Q.step(1); } return -1; };
      /** pin on the floor on the far side of the arena from the boss */
      Q.awayFloor = function () { const b = g.boss; Q.pinAt(b.x < b.A.cx ? b.A.x1 - 120 : b.A.x0 + 120, b.A.floorY); };
      /** one attack (`kind`, default light) from feet (px, py) facing `facing`, after `wait` idle frames; boss hp delta + the first player hit box */
      Q.attackBossAt = function (px, py, facing, kind, wait) {
        const b = g.boss, pl = g.player; Q.pinAt(px, py); pl.facing = facing; Q.step(wait === undefined ? 30 : wait);
        const hp0 = b.hp; let box = null;
        const orig = g.registerHit; g.registerHit = function (h) { if (h.owner === 'player' && !box) box = { x: Math.round(h.x), y: Math.round(h.y), w: h.w, h: h.h, tag: h.tag }; return orig.call(this, h); };
        d.pressed(facing > 0 ? 'right' : 'left', 1); Q.step(1);
        if (kind === 'down') { d.pressed('down', 6); d.pressed('light', 2); } else d.pressed(kind || 'light', 2);
        for (let i = 0; i < 30 && b.hp === hp0; i++) Q.step(1);
        g.registerHit = orig;
        return { dmg: hp0 - b.hp, box };
      };
      /** a fresh game with `fighter` (god on, lore cards off) */
      Q.fresh = function (fighter) {
      /** step n frames with d.step (NO pin re-placement — for real-input probes), recording and refilling hp drops like Q.step */
      Q.dstep = function (n) { for (let i = 0; i < (n || 1); i++) { const h0 = g.player.hp; d.step(1); if (g.player.hp < h0) { Q.drops.push({ frame: g.frame, hp: g.player.hp, dmg: h0 - g.player.hp, mode: g.mode, tag: Q.lastTag }); g.player.hp = g.player.maxHp; } } };
      /** kill with lights from behind WITHOUT repositioning the enemy; every follow-through frame checks embedding / the room bounds / NaN */
      Q.killWatch = function (e, maxTries) {
        const before = new Set(g.pickups), purged0 = g.save.enemiesPurged, lv = g.level, W = lv.w * 30, H = lv.h * 30;
        let tries = 0, stuck = 0, out = 0, nan = 0, first = null;
        const watch = function (f) { if (e.dead) return; if (Number.isNaN(e.x) || Number.isNaN(e.y)) { nan++; return; } if (e.x < -8 || e.x > W + 8 || e.y < -8 || e.y > H + 8) { out++; if (!first) first = { f, x: Math.round(e.x), y: Math.round(e.y), state: e.state, outside: true }; } else if (Q.stuck(e)) { stuck++; if (!first) first = { f, x: Math.round(e.x), y: Math.round(e.y), state: e.state, stuck: true }; } };
        while (!e.dead && tries < (maxTries || 40)) {
          const side = e.facing > 0 ? 1 : -1;   // the player stands behind it, facing it
          const reach = e.w / 2 + 26, cy = e.y - e.h / 2;
          Q.pinAt(e.x - side * reach, cy + 24); g.player.facing = side;
          d.pressed(side > 0 ? 'right' : 'left', 1); Q.step(1);
          d.pressed('light', 2);
          for (let f = 0; f < 38 && !e.dead; f++) { Q.step(1); watch(f); }   // the player stays pinned (an unpinned player under bv_catwalk's dripnode falls down the exit shaft)
          tries++;
        }
        const drops = g.pickups.filter(p => !before.has(p));
        return { dead: e.dead, tries, bits: drops.filter(p => p.type === 'bit').length, drops: drops.map(p => p.type + (p.size ? ':' + p.size : '')), purgedDelta: g.save.enemiesPurged - purged0, stuck, out, nan, first };
      };
        d.toTitle(); d.newGame(fighter || 'tessik'); for (let i = 0; i < 200; i++) { d.step(1); const s = d.state(); if (s.screen === 'play' && !s.busy) break; }
        d.god(true); g.save.loreSeen = window.UB.IDS.zones.slice(); Q.pin = null; Q.wrapHurt(); Q.takeDrops();
      };
      return { screen: s.screen, room: s.roomId, start: window.UB.World.start.room, types: Object.keys(window.UB.Enemies.TYPES), ids: window.UB.IDS.enemies, bosses: Object.keys(window.UB.Bosses.DATA) };
    });
    check('A: new game reaches play in the start room', boot.screen === 'play' && boot.room === boot.start, boot);
    check('A: UB.Enemies.TYPES has every pinned enemy id', boot.ids.every(k => boot.types.includes(k)), boot.ids.filter(k => !boot.types.includes(k)));
    check('A: UB.Bosses.DATA has the four bosses + proto_warden', ['tallock', 'weftyr', 'corrosant', 'kernauth', 'proto_warden'].every(k => boot.bosses.includes(k)), boot.bosses);

    // ---------------------------------------------------------------- A/B: roster + soak per room (player at the entry)
    for (const room of Object.keys(DESIGN_ROSTER)) {
      const want = DESIGN_ROSTER[room];
      const r = await ev((d, g, Q, room) => {
        Q.enter(room, null);
        const pl = g.player; Q.pinAt(pl.x, pl.y);
        const roster = g.enemies.map(e => ({ type: e.type, variant: e.variant || null, sx: e.spawnX, sy: e.spawnY }));
        const lv = g.level, W = lv.w * 30, H = lv.h * 30;
        let out = 0, stuck = 0, nan = 0; const bad = []; const states = {};
        for (let f = 0; f < 1200; f++) {
          Q.step(1);
          if (g.level !== lv) { bad.push({ f, roomChanged: g.level.room.id }); break; }
          for (const e of g.enemies) {
            if (e.dead) continue;
            const k = e.type + (e.variant ? ':' + e.variant : '');
            (states[k] = states[k] || {})[e.state] = 1;
            if (Number.isNaN(e.x) || Number.isNaN(e.y)) nan++;
            if (e.x < -8 || e.x > W + 8 || e.y < -8 || e.y > H + 8) { out++; if (bad.length < 4) bad.push({ f, k, x: Math.round(e.x), y: Math.round(e.y), state: e.state, outside: true }); }
            else if (Q.stuck(e)) { stuck++; if (bad.length < 4) bad.push({ f, k, x: Math.round(e.x), y: Math.round(e.y), state: e.state, stuck: true }); }
          }
        }
        Q.pin = null;
        const st = {}; for (const k in states) st[k] = Object.keys(states[k]);
        return { roster, out, stuck, nan, bad, states: st, alive: g.enemies.filter(e => !e.dead).length };
      }, room);
      const missing = want.filter(w => !r.roster.find(e => e.type === w[0] && (w[3] ? e.variant === w[3] : !e.variant) && Math.abs(e.sx - (w[1] * 30 + 15)) < 1));
      check('A: ' + room + ' roster = DESIGN §6 (' + want.length + ' enemies)', r.roster.length === want.length && missing.length === 0, { got: r.roster, missing });
      check('B: ' + room + ' 1200 f soak (player at the entry) — no enemy embedded in tiles, outside the room, or NaN', r.out === 0 && r.stuck === 0 && r.nan === 0, { out: r.out, stuck: r.stuck, nan: r.nan, bad: r.bad, states: r.states });
    }

    // ---------------------------------------------------------------- H1: ACTIVE soak — the player pinned near every enemy in turn
    for (const room of ['dc_wake', 'dc_fall', 'dc_cross', 'dc_loft', 'lw_hoist', 'lw_belts', 'lw_shaft', 'bv_sluice', 'bv_cistern', 'bv_catwalk', 'ns_base', 'ns_climb', 'ns_plunge', 'rw_gate']) {
      const r = await ev((d, g, Q, room) => {
        Q.enter(room, null);
        const lv = g.level, W = lv.w * 30, H = lv.h * 30, E = window.UB.Entity;
        const base = g.enemies.slice(); const hp0 = base.map(e => e.hp), purged0 = g.save.enemiesPurged;
        let out = 0, stuck = 0, stuckCrumble = 0, nan = 0, hpChanged = 0; const bad = []; const states = {}; const fell = []; let crumbleEmbed = null;
        for (let f = 0; f < 1200; f++) {
          if (f % 150 === 0) {
            const e = base[Math.floor(f / 150) % base.length];
            if (e && !e.dead) {   // ~3 tiles beside it (below a hanger, under a flyer)
              let px = e.x - 90; if (px < 45) px = e.x + 90;
              let py = e.y; if (e.data && e.data.hanger) py = e.y + 150; if (e.data && e.data.flyer) py = e.y + 60;
              Q.pinAt(px, py);
            }
          }
          Q.step(1);
          if (g.level !== lv) { bad.push({ f, roomChanged: g.level.room.id }); break; }
          for (const e of g.enemies) {
            if (e.dead) continue;
            const k = e.type + (e.variant ? ':' + e.variant : '');
            (states[k] = states[k] || {})[e.state] = 1;
            if (Number.isNaN(e.x) || Number.isNaN(e.y)) nan++;
            if (e.x < -8 || e.x > W + 8 || e.y < -8 || e.y > H + 8) { out++; if (bad.length < 6) bad.push({ f, k, x: Math.round(e.x), y: Math.round(e.y), state: e.state, outside: true }); }
            else if (Q.stuck(e)) {
              const tx = Math.floor(e.x / 30), ty = Math.floor((e.y - 1) / 30), raw = lv.room.tiles[ty] ? lv.room.tiles[ty][tx] : '?';
              if (raw === 'c') { stuckCrumble++; if (!crumbleEmbed) crumbleEmbed = { f, k, x: Math.round(e.x), y: Math.round(e.y), state: e.state, tile: [tx, ty], crumble: lv.crumble.map(c => ({ tx: c.tx, ty: c.ty, state: c.state, timer: c.timer })) }; }
              else { stuck++; if (bad.length < 6) bad.push({ f, k, x: Math.round(e.x), y: Math.round(e.y), state: e.state, stuck: true, tile: raw }); }
            }
          }
          for (let i = 0; i < base.length; i++) { const e = base[i]; if (!e.dead && e.hp !== hp0[i]) hpChanged++; if (e.dead && e.type !== 'mote' && fell.indexOf(e.type) < 0) fell.push(e.type + '@' + f); }
        }
        Q.pin = null;
        const st = {}; for (const k in states) st[k] = Object.keys(states[k]);
        return { n: base.length, out, stuck, stuckCrumble, crumbleEmbed, nan, bad, states: st, hpChanged, purgedDelta: g.save.enemiesPurged - purged0, fell };
      }, room);
      check('H1: ' + room + ' active soak (player beside each enemy in turn, 1200 f) — never embedded in solid tiles, outside the room, or NaN', r.out === 0 && r.stuck === 0 && r.nan === 0, { out: r.out, stuck: r.stuck, nan: r.nan, bad: r.bad, states: r.states });
      check('H1: ' + room + ' active soak — no enemy lost hp or died without the player attacking (hazards/pools/movers are ignored, nothing fell out)', r.hpChanged === 0 && r.purgedDelta === 0 && r.fell.length === 0, { hpChanged: r.hpChanged, purged: r.purgedDelta, fell: r.fell });
      if (room === 'ns_plunge') {
        check('H1: ns_plunge active soak — a returning crumble tile never closes onto an enemy (0 frames inside a returned "c" tile)', r.stuckCrumble === 0, { framesInsideCrumble: r.stuckCrumble, first: r.crumbleEmbed });
        if (r.crumbleEmbed) info('crumble embed: ' + JSON.stringify(r.crumbleEmbed));
      } else check('H1: ' + room + ' active soak — no enemy inside a crumble tile', r.stuckCrumble === 0, { framesInsideCrumble: r.stuckCrumble, first: r.crumbleEmbed });
    }

    // ---------------------------------------------------------------- C: per-type state machines in the real rooms
    // scuttlebit (dc_wake 20,14 patrol 16–26): PATROL/TURN 6, stays inside the patrol bounds
    let r = await ev((d, g, Q) => { Q.enter('dc_wake'); Q.pinAt(3 * 30 + 15, 13 * 30); const e = Q.find('scuttlebit'); return Q.run(700, e); });
    check('C: scuttlebit patrols and turns (TURN = 6 f)', hasRun(r.runs, 'patrol') && hasRun(r.runs, 'turn') && runLen(r.runs, 'turn') === 6, r.runs);
    check('C: scuttlebit stays inside patrol x 16–26 (edges) and never embeds', r.minX >= 16 * 30 + 13 - 1 && r.maxX <= 27 * 30 - 13 + 1 && r.stuck === 0, { minX: r.minX, maxX: r.maxX, stuck: r.stuck });
    near('C: scuttlebit speed 1.0 px/f', r.maxVx, 1.0, 0.1);
    // H: body contact with god off: −1 heart, 60 i-frames, hurt once
    r = await ev((d, g, Q) => { Q.enter('dc_wake'); const e = Q.find('scuttlebit'); d.god(false); Q.takeDrops(); Q.pinAt(e.x, e.y); Q.step(3); const r1 = Q.takeDrops(); const if1 = g.player.iframes; d.god(true); return { r1, if1 }; });
    check('H: scuttlebit body contact (god off): −1 heart, tag contact, 60 i-frames', r.r1.length === 1 && r.r1[0].dmg === 1 && r.r1[0].tag === 'contact' && r.if1 >= 57 && r.if1 <= 60, r);
    r = await ev((d, g, Q) => { Q.enter('dc_wake'); const e = Q.find('scuttlebit'); Q.pinAt(e.x + 200, e.y); Q.step(3); Q.attack(e, -1, 'light', 0); return { hitstun: e.hitstun, vx: e.vx, state: e.state, flash: e.flash, kb: e.kbResist }; });
    check('H: a light on a scuttlebit (kbResist 1) gives hitstun (10 + hitstop, counting down) and knockback 2.1 px/f', r.hitstun >= 5 && r.hitstun <= 13 && Math.abs(r.vx) >= 1.5 && r.kb === 1, r);
    // hopnode (dc_fall 22,49): IDLE 30 / CROUCH 12 / HOP ≈ 34 / LAND 8; hops toward a player within 8 tiles
    r = await ev((d, g, Q) => { Q.enter('dc_fall'); const e = Q.find('hopnode'); Q.pinAt(e.x + 150, e.y); const r = Q.run(170, e); r.facing = e.facing; return r; });
    near('C: hopnode IDLE 30 f', runLen(r.runs, 'idle') >= 30 ? 30 : runLen(r.runs, 'idle'), 30, 3, r.runs);
    near('C: hopnode CROUCH (tell) 12 f', runLen(r.runs, 'crouch'), 12, 1, r.runs);
    near('C: hopnode airborne ≈ 34 f', runLen(r.runs, 'hop'), 34, 4, r.runs);
    near('C: hopnode LAND 8 f', runLen(r.runs, 'land'), 8, 1, r.runs);
    check('C: hopnode hops toward the player within 8 tiles (moved ≥ 40 px toward it)', r.maxX >= r.minX + 40 && r.e.x > r.minX + 40, { minX: r.minX, maxX: r.maxX, x: r.e.x });
    await ev((d, g, Q) => { const e = Q.find('hopnode'); Q.pinAt(e.x + 150, e.y); Q.until(e, 'crouch', 80); Q.step(5); });
    await shot('qa-enemy-hopnode-tell.png');
    r = await ev((d, g, Q) => { Q.enter('dc_cross'); const e = Q.find('hopnode'); Q.pinAt(e.x - 400, e.y - 150); const dirs = []; let prev = e.state; for (let f = 0; f < 400; f++) { Q.step(1); if (e.state === 'hop' && prev !== 'hop') dirs.push(e.dir); prev = e.state; } return dirs; });
    check('H: hopnode alternates direction when the player is beyond 8 tiles (' + r.join(',') + ')', r.length >= 3 && r.every((v, i) => i === 0 || v === -r[i - 1]), r);
    // nullnode (ns_plunge 28,29): hop vy −9.0;  dripnode (bv_sluice): hp 12
    r = await ev((d, g, Q) => { Q.enter('ns_plunge'); const e = Q.find('hopnode', 'nullnode'); Q.pinAt(e.x - 100, e.y); let minVy = 0; for (let f = 0; f < 120; f++) { Q.step(1); if (e.vy < minVy) minVy = e.vy; } return { minVy, hp: e.hp }; });
    near('C: nullnode hop vy −9.0 (read after the same-frame 0.45 gravity step)', r.minVy, -9.0 + 0.45, 0.05);
    r = await ev((d, g, Q) => { Q.enter('bv_sluice'); const e = Q.find('hopnode', 'dripnode'); return { hp: e.hp }; });
    check('C: dripnode HP 12', r.hp === 12, r);
    // driftmoth (dc_fall 16,18): sine amplitude 45 over 90 f, reverses within 6 tiles of spawn
    r = await ev((d, g, Q) => { Q.enter('dc_fall'); const e = Q.find('driftmoth'); Q.pinAt(e.x, e.y + 300); const r = Q.run(400, e); r.sx = e.spawnX; r.sy = e.spawnY; return r; });
    near('C: driftmoth sine amplitude 45 px (max−min)/2', (r.maxY - r.minY) / 2, 45, 6, { minY: r.minY, maxY: r.maxY });
    check('C: driftmoth reverses within 6 tiles of its spawn x (no wall) and never embeds', r.maxX - r.sx <= 181 + 2 && r.sx - r.minX <= 181 + 2 && r.stuck === 0, { minX: r.minX, maxX: r.maxX, sx: r.sx, stuck: r.stuck });
    near('C: driftmoth speed 1.2 px/f', r.maxVx, 1.2, 0.05);
    // brinejelly (bv_sluice 40,13): vertical 0.8 px/f, x wobble ±30 over 120 f
    r = await ev((d, g, Q) => { Q.enter('bv_sluice'); const e = Q.find('brinejelly'); Q.pinAt(e.x - 300, e.y); const r = Q.run(400, e); r.sx = e.spawnX; r.sy = e.spawnY; r.hp = e.hp; r.w = e.w; r.h = e.h; return r; });
    check('C: brinejelly HP 9, 20×24, moves vertically ≥ 2 tiles and wobbles x ±30', r.hp === 9 && r.w === 20 && r.h === 24 && (r.maxY - r.minY) >= 60 && (r.maxX - r.minX) >= 40 && (r.maxX - r.minX) <= 66 && r.stuck === 0, r);
    // glarewisp (ns_base 5,14): DRIFT → LOCK 20 → CHASE 150 → TIRED 60 → DRIFT; tired takes ×2
    r = await ev((d, g, Q) => { Q.enter('ns_base'); const e = Q.find('glarewisp'); Q.pinAt(e.x + 200, e.y + 30); const r = Q.run(260, e); return r; });
    check('C: glarewisp locks on within 9 tiles (LOCK 20 f tell)', runLen(r.runs, 'lock') === 20, r.runs);
    near('C: glarewisp CHASE 150 f', runLen(r.runs, 'chase'), 150, 2, r.runs);
    near('C: glarewisp TIRED 60 f', runLen(r.runs, 'tired'), 60, 2, r.runs);
    check('C: glarewisp never embeds while chasing', r.stuck === 0, r.stuck);
    r = await ev((d, g, Q) => { Q.enter('ns_base'); const e = Q.find('glarewisp'); Q.pinAt(e.x + 200, e.y + 30); Q.until(e, 'lock', 60); Q.step(8); return { state: e.state }; });
    await shot('qa-enemy-glarewisp-tell.png');
    r = await ev((d, g, Q) => { const e = Q.find('glarewisp'); Q.until(e, 'tired', 300); const hp0 = e.hp; Q.attack(e, -1, 'light'); return { st: e.state, dmg: hp0 - e.hp }; });
    check('C: glarewisp takes ×2 damage while TIRED (Tessik light 3 → 6)', r.dmg === 6, r);
    r = await ev((d, g, Q) => {
      const res = {};
      Q.enter('ns_base'); let e = Q.find('glarewisp'); Q.pinAt(e.x + 290, e.y + 30); const r0 = Q.run(200, e); res.far = r0.runs.map(x => x[0]); res.bob = (r0.maxY - r0.minY) / 2;
      Q.enter('ns_base'); e = Q.find('glarewisp'); Q.pinAt(e.x + 200, e.y + 30); Q.until(e, 'chase', 60);
      const rc = Q.run(150, e, function () { Q.pinAt(e.spawnX + 200, e.spawnY + 30); }); res.chaseMaxV = rc.maxV;
      Q.until(e, 'tired', 200); const d0 = Math.hypot(e.x - e.spawnX, e.y - e.spawnY); Q.step(40); const d1 = Math.hypot(e.x - e.spawnX, e.y - e.spawnY); res.tired = { d0, d1 };
      Q.enter('rw_gate'); e = Q.find('glarewisp', 'rootwisp'); res.root = { hp: e.hp, maxSpeed: e.maxSpeed, bits: e.bits };
      Q.pinAt(e.x - 200, e.y + 30); Q.until(e, 'chase', 60); const rr = Q.run(150, e, function () { Q.pinAt(e.spawnX - 200, e.spawnY + 30); }); res.root.chaseMaxV = rr.maxV;
      return res;
    });
    check('H: glarewisp stays in DRIFT (bob ±6) with the player just beyond 9 tiles', r.far.length === 1 && r.far[0] === 'drift' && Math.abs(r.bob - 6) <= 1.5, r);
    check('H: glarewisp chase speed caps at 3.0 px/f; TIRED heads back toward its spawn at 1 px/f', Math.abs(r.chaseMaxV - 3.0) < 0.05 && r.tired.d1 < r.tired.d0 && Math.abs((r.tired.d0 - r.tired.d1) - 40) <= 3, r);
    check('H: rootwisp HP 12, max speed 3.4, bits 3', r.root.hp === 12 && r.root.maxSpeed === 3.4 && Math.abs(r.root.chaseMaxV - 3.4) < 0.05 && r.root.bits === 3, r.root);
    // spitvalve (dc_cross 57,8 faces left): SCAN → CHARGE 30 → FIRE → COOL 75; the glob hurts the player
    r = await ev((d, g, Q) => { Q.enter('dc_cross'); const e = Q.find('spitvalve'); Q.pinAt(e.x - 120, e.y); const r = Q.run(260, e); let vx = 0; const p = g.projectiles.find(p => p.kind === 'glob'); if (p) vx = p.vx; r.globVx = vx; r.projOwner = g.projectiles.length ? g.projectiles[0].owner : null; return r; });
    near('C: spitvalve CHARGE (tell) 30 f', runLen(r.runs, 'charge'), 30, 1, r.runs);
    near('C: spitvalve COOL 75 f', runLen(r.runs, 'cool'), 75, 2, r.runs);
    check('C: spitvalve fires an enemy-owned glob', r.maxProj >= 1 && r.projOwner === 'enemy', r);
    r = await ev((d, g, Q) => { const e = Q.find('spitvalve'); Q.pinAt(e.x - 120, e.y); Q.until(e, 'charge', 120); Q.step(15); return e.state; });
    await shot('qa-enemy-spitvalve-tell.png');
    r = await ev((d, g, Q) => {
      const e = Q.find('spitvalve'); d.god(false); Q.pinAt(e.x - 120, e.y); Q.takeDrops();
      for (let f = 0; f < 300; f++) { const p = g.projectiles.find(p => p.kind === 'glob' && !p.dead); if (p) Q.pinAt(p.x, p.y + 10); Q.step(1); }
      d.god(true); return Q.takeDrops();
    });
    check('C: spitvalve globs hurt the player (god off, −1 heart each)', r.length >= 1 && r.every(h => h.hp === 4), r);
    r = await ev((d, g, Q) => {
      const res = {};
      Q.enter('dc_cross'); let e = Q.find('spitvalve'); Q.pinAt(e.x + 90, e.y); res.behind = Q.run(200, e).runs.map(x => x[0]);
      Q.enter('dc_cross'); e = Q.find('spitvalve'); Q.pinAt(e.x - 370, e.y); res.far = Q.run(200, e).runs.map(x => x[0]);
      Q.enter('dc_cross'); e = Q.find('spitvalve'); Q.pinAt(e.x - 120, e.y - 200); res.high = Q.run(200, e).runs.map(x => x[0]);
      Q.enter('dc_cross'); e = Q.find('spitvalve'); Q.pinAt(e.x - 300, e.y); res.inRange = Q.run(200, e).runs.map(x => x[0]);
      Q.enter('dc_cross'); e = Q.find('spitvalve'); Q.pinAt(e.x - 120, e.y);
      let glob = null; for (let f = 0; f < 200 && !glob; f++) { Q.step(1); glob = g.projectiles.find(p => p.kind === 'glob') || null; }
      res.glob = glob ? { vx: glob.vx, vy: glob.vy, w: glob.w, h: glob.h, life: glob.life, grav: glob.def.grav, destructible: glob.destructible, flags: glob.hit.flags, dmg: glob.hit.dmg } : null;
      if (glob) { const m0 = g.player.meter, pk0 = g.pickups.length; let popped = false; for (let f = 0; f < 120 && !popped; f++) { Q.pinAt(glob.x - 30, glob.y + 20); g.player.facing = 1; d.pressed('right', 1); d.pressed('light', 1); Q.step(1); if (glob.dead) popped = true; } res.pop = { popped, meterGain: g.player.meter - m0, pickups: g.pickups.length - pk0 }; }
      Q.enter('dc_cross'); e = Q.find('spitvalve'); Q.pinAt(e.x - 120, e.y); Q.until(e, 'charge', 100); Q.step(20);
      const tBefore = e.timer, hp0 = e.hp; Q.pinAt(e.x - 40, e.y); g.player.facing = 1; d.pressed('right', 1); Q.step(1); d.pressed('light', 2);
      let tAfter = null; for (let f = 0; f < 10; f++) { Q.step(1); if (e.hp < hp0 && tAfter === null) tAfter = e.timer; }
      res.interrupt = { tBefore, tAfter, dmg: hp0 - e.hp, state: e.state, hitstun: e.hitstun };
      return res;
    });
    check('H: spitvalve only scans the facing half-plane within 11 tiles and ±5 tiles vertically (behind / 12 tiles / 6 tiles above → stays SCAN; 10 tiles in front → CHARGE)', r.behind.join() === 'scan' && r.far.join() === 'scan' && r.high.join() === 'scan' && r.inRange[0] === 'charge', r);
    check('H: glob = 10×10, vx ±3.2, vy −3.0, gravity 0.15, life 150, destructible projectile (flags 2), dmg 1', !!r.glob && r.glob.w === 10 && r.glob.h === 10 && Math.abs(r.glob.vx) === 3.2 && Math.abs(r.glob.vy + 2.85) < 0.01 && r.glob.grav === 0.15 && r.glob.life >= 148 && r.glob.destructible && r.glob.flags === 2 && r.glob.dmg === 1, r.glob);
    check('H: a light pops the glob: +2 meter, no bits', !!r.pop && r.pop.popped && r.pop.meterGain === 2 && r.pop.pickups === 0, r.pop);
    check('H: a hit during CHARGE restarts the charge (timer back to 0; kbResist 0 → no hitstun)', r.interrupt.dmg === 3 && r.interrupt.tAfter !== null && r.interrupt.tAfter <= 2 && r.interrupt.state === 'charge' && r.interrupt.hitstun === 0, r.interrupt);
    // acid valve (bv_sluice 50,10): the glob leaves a puddle hazard that hurts
    r = await ev((d, g, Q) => {
      Q.enter('bv_sluice'); const e = Q.find('spitvalve', 'acidvalve'); Q.pinAt(e.x - 240, e.y);
      let pud = null; for (let f = 0; f < 400 && !pud; f++) { Q.step(1); pud = g.projectiles.find(p => p.kind === 'puddle' && !p.dead) || null; }
      if (!pud) return { pud: null };
      const w = { x: pud.x, y: pud.y, w: pud.w, life: pud.life };
      d.god(false); Q.takeDrops(); Q.pinAt(pud.x, pud.y); for (let f = 0; f < 130; f++) Q.step(1); d.god(true);
      return { pud: w, drops: Q.takeDrops(), state: e.state };
    });
    check('C: acid valve globs leave a 1-tile puddle (90 f) that hurts the player', !!r.pud && r.pud.w === 30 && r.pud.life <= 90 && r.drops.length >= 1, r);
    // twin valve (rw_gate 23,10): two globs, COOL 60
    r = await ev((d, g, Q) => { Q.enter('rw_gate'); const e = Q.find('spitvalve', 'twinvalve'); Q.pinAt(e.x - 120, e.y); const r = Q.run(240, e); return r; });
    check('C: twin valve fires two globs and cools 60 f', r.maxProj >= 2 && runLen(r.runs, 'cool') === 60, { maxProj: r.maxProj, runs: r.runs });
    // rambyte (lw_belts 82,14): SPOT 24 → CHARGE (contact 2, armoured) → BRAKE 20 / STUN 45 (×1.5)
    r = await ev((d, g, Q) => { Q.enter('lw_belts'); const e = Q.find('rambyte'); Q.pinAt(e.x - 200, e.y); const r = Q.run(100, e); return r; });
    near('C: rambyte SPOT (tell) 24 f', runLen(r.runs, 'spot'), 24, 1, r.runs);
    check('C: rambyte charges at 6.0 px/f', hasRun(r.runs, 'charge') && Math.abs(r.maxVx - 6) < 0.1, { runs: r.runs, maxVx: r.maxVx });
    r = await ev((d, g, Q) => { Q.enter('lw_belts'); const e = Q.find('rambyte'); Q.pinAt(e.x - 200, e.y); Q.until(e, 'spot', 60); Q.step(10); return e.state; });
    await shot('qa-enemy-rambyte-tell.png');
    r = await ev((d, g, Q) => {
      const e = Q.find('rambyte'); Q.until(e, 'charge', 60);
      const during = { contact: e.contact, kbResist: e.kbResist, state: e.state };
      const hp0 = e.hp; Q.attack(e, 1, 'light', 3); const hit = { dmg: hp0 - e.hp, state: e.state, hitstun: e.hitstun };
      Q.pinAt(e.x - e.facing * 300, e.y); const brake = Q.run(60, e);
      return { during, hit, brakeRuns: brake.runs };
    });
    check('C: rambyte CHARGE: contact 2, kbResist 0, a hit deals damage but does not stop it', r.during.contact === 2 && r.during.kbResist === 0 && r.hit.dmg === 3 && r.hit.state === 'charge' && r.hit.hitstun === 0, r);
    check('C: rambyte BRAKE 20 f when the player is ≥ 3 tiles behind', runLen(r.brakeRuns, 'brake') === 20, r.brakeRuns);
    r = await ev((d, g, Q) => {
      const e = Q.find('rambyte');
      let st = -1; for (let k = 0; k < 6 && st < 0; k++) { const dx = e.facing > 0 ? 300 : -300; Q.pinAt(e.x + dx, e.y); st = Q.until(e, 'stun', 400); }
      if (st < 0) return { stun: false };
      const info = { contact: e.contact, kbResist: e.kbResist };
      e.state = 'stun'; e.timer = 0; const rr = Q.run(60, e); info.stunRun = Q.runLen(rr.runs, 'stun');
      e.state = 'stun'; e.timer = 0; e.hitstun = 0; const hp0 = e.hp; Q.attack(e, -1, 'light', 12); info.dmg = hp0 - e.hp;
      return { stun: true, info };
    });
    check('C: rambyte STUN 45 f after a wall/bound, contact back to 1, takes ×1.5 (3 → 4)', r.stun && r.info.dmg === 4 && r.info.contact === 1 && r.info.stunRun >= 44 && r.info.stunRun <= 45, r);
    r = await ev((d, g, Q) => { const res = {}; Q.enter('lw_belts'); let e = Q.find('rambyte'); Q.pinAt(e.x + 150, e.y); const r0 = Q.run(200, e); res.behind = r0.runs.map(x => x[0]); res.pace = r0.maxVx; Q.enter('lw_belts'); e = Q.find('rambyte'); Q.pinAt(e.x - 150, e.y - 120); res.above = Q.run(200, e).runs.map(x => x[0]); return res; });
    check('H: rambyte paces at 0.8 px/f and never SPOTs a player behind it or 4 tiles above it', Math.abs(r.pace - 0.8) < 0.05 && r.behind.indexOf('spot') < 0 && r.above.indexOf('spot') < 0, r);
    r = await ev((d, g, Q) => { Q.enter('rw_gate'); const e = Q.find('rambyte', 'rootram'); Q.pinAt(e.x - 200, e.y); const r = Q.run(60, e); r.hp = e.hp; return r; });
    check('C: rootram HP 24, SPOT 18 f, charge 7.0 px/f', r.hp === 24 && runLen(r.runs, 'spot') === 18 && Math.abs(r.maxVx - 7) < 0.1, { hp: r.hp, runs: r.runs, maxVx: r.maxVx });
    // platewalker (lw_belts 38,14, faces −1): BASH tell 18 + lunge 14 + recovery 24; shield rules
    r = await ev((d, g, Q) => { Q.enter('lw_belts'); const e = Q.find('platewalker'); Q.pinAt(e.x + e.facing * 70, e.y); const r = Q.run(60, e); r.facing = e.facing; return r; });
    check('C: platewalker BASHes a player within 3 tiles in front (56 f = 18 tell + 14 lunge + 24 recovery)', hasRun(r.runs, 'bash') && runLen(r.runs, 'bash') === 56, r.runs);
    r = await ev((d, g, Q) => { Q.enter('lw_belts'); const e = Q.find('platewalker'); Q.pinAt(e.x + e.facing * 70, e.y); Q.until(e, 'bash', 60); Q.step(9); return e.state; });
    await shot('qa-enemy-platewalker-tell.png');
    r = await ev((d, g, Q) => { const e = Q.find('platewalker'); d.god(false); Q.takeDrops(); Q.pinAt(e.x + e.facing * 70, e.y); for (let f = 0; f < 70; f++) Q.step(1); d.god(true); return Q.takeDrops(); });
    check('C: platewalker bash lunge hurts the player (god off)', r.length >= 1, r);
    r = await ev((d, g, Q) => {
      Q.enter('lw_belts'); const e = Q.find('platewalker'); const front = -e.facing, back = e.facing;   // side +1 = player on the left
      const out = { facing: e.facing };
      const reset = function () { e.state = 'walk'; e.timer = 0; e.hitstun = 0; e.vx = 0; e.facing = e.dir = out.facing; Q.pinAt(e.x - 300, e.y); Q.step(25); };
      let hp = e.hp; Q.attack(e, front, 'light'); out.frontLight = { dmg: hp - e.hp, state: e.state };
      reset(); hp = e.hp; Q.attack(e, front, 'heavy', 24); out.frontHeavy = { dmg: hp - e.hp, state: e.state };
      e.state = 'stagger'; e.timer = 0; e.hitstun = 0; Q.pinAt(e.x - 300, e.y);
      const stag = Q.run(100, e); out.staggerRun = Q.runLen(stag.runs, 'stagger'); out.openRun = Q.runLen(stag.runs, 'open');
      reset(); hp = e.hp; Q.attack(e, back, 'light'); out.backLight = { dmg: hp - e.hp };
      reset(); hp = e.hp; let pogo = 0; const n = Q.attack(e, 1, 'down', 20); pogo = g.player.vy; out.down = { dmg: hp - e.hp, pogoVy: pogo, frames: n, hpLeft: e.hp };
      return out;
    });
    check('C: platewalker blocks a frontal light (0 dmg, keeps guarding)', r.frontLight.dmg === 0 && (r.frontLight.state === 'walk' || r.frontLight.state === 'turn' || r.frontLight.state === 'bash'), r);
    check('C: platewalker frontal heavy guard-breaks (9 dmg) → STAGGER 30 → OPEN 60', r.frontHeavy.dmg === 9 && r.frontHeavy.state === 'stagger' && r.staggerRun >= 29 && r.staggerRun <= 30 && r.openRun === 60, r);
    check('C: platewalker takes full damage from behind (light 3)', r.backLight.dmg === 3, r);
    check('C: platewalker takes full damage from a down-strike (4, or the hp left) and the player pogos', (r.down.dmg === 4 || (r.down.hpLeft === 0 && r.down.dmg > 0)) && r.down.pogoVy < -400, r);
    r = await ev((d, g, Q) => {
      const res = {};
      Q.enter('lw_belts'); let e = Q.find('platewalker'); const f0 = e.facing; Q.pinAt(e.x - f0 * 60, e.y);
      let turned = -1; for (let f = 0; f < 120; f++) { Q.step(1); if (e.facing !== f0) { turned = f; break; } } res.turn = { turned, f0, facing: e.facing };
      Q.enter('lw_belts'); e = Q.find('platewalker'); const pl = g.player; d.setMeter(0); const front = -e.facing;
      Q.pinAt(e.x - front * (e.w / 2 + 26), e.y); pl.facing = front; d.pressed(front > 0 ? 'right' : 'left', 1); Q.step(1); Q.pin = null; d.pressed('light', 2);
      // positive = pushed away from the plate: the player stands on the shield side (e.facing points at it), so "away" is +e.facing
      // (round 2 measured pl.vx · −e.facing, i.e. TOWARD the plate — it encoded the inverted push the round-3 audit fixed)
      let pushVx = 0, blockedF = -1; for (let f = 0; f < 10; f++) { Q.step(1); if (e.blockFlash > 0 && blockedF < 0) { blockedF = f; pushVx = pl.vx * e.facing; } }
      res.block = { blockedF, pushVx, hp: e.hp, kbGuard: e.kbResist };
      e.state = 'open'; e.timer = 0; Q.step(1); res.kbOpen = e.kbResist;
      Q.enter('lw_belts'); e = Q.find('platewalker'); Q.pinAt(e.x + e.facing * 70, e.y); Q.until(e, 'bash', 60); const x0 = e.x; while (e.state === 'bash') Q.step(1); res.bashDist = Math.abs(e.x - x0); res.bashHit = { dmg: e.hit.dmg, kind: e.hit.kind };
      return res;
    });
    check('H: platewalker turns toward a player standing behind it within 4 tiles after 30 consecutive frames', r.turn.turned >= 28 && r.turn.turned <= 31 && r.turn.facing === -r.turn.f0, r.turn);
    check('H: a blocked hit pushes the player back 3 px/f (180 px/s) and leaves the shield up (kbResist 0 while guarding, 0.5 when OPEN)', r.block.blockedF >= 0 && Math.abs(r.block.pushVx - 180) < 1 && r.block.hp === 15 && r.block.kbGuard === 0 && r.kbOpen === 0.5, r);
    check('H: the bash lunge covers 2 tiles (56 px at 4 px/f × 14 f) and its shield hit is 1 heart', r.bashDist >= 52 && r.bashDist <= 58 && r.bashHit.dmg === 1, r);
    r = await ev((d, g, Q) => { Q.enter('rw_gate'); const e = Q.find('platewalker', 'rootplate'); const hp = e.hp; Q.attack(e, -e.facing, 'heavy', 24); const rr = Q.run(100, e); return { hp, openRun: Q.runLen(rr.runs, 'open') }; });
    check('C: rootplate HP 21, OPEN 45 f', r.hp === 21 && r.openRun === 45, r);
    // broodcell (bv_cistern 47,32): PULSE 40 → SPAWN 30 (motes on f0/15/30) → REST 180; ≤ 6 motes; motes hurt; pop on death
    r = await ev((d, g, Q) => { Q.enter('bv_cistern'); const e = Q.find('broodcell'); Q.pinAt(e.x - 150, e.y); const r = Q.run(520, e); r.motes = g.enemies.filter(m => m.type === 'mote' && !m.dead).length; r.hp = e.hp; return r; });
    check('C: broodcell wakes within 10 tiles: PULSE 40 (tell) → SPAWN 30 → REST 180', runLen(r.runs, 'pulse') === 40 && runLen(r.runs, 'spawn') === 30 && runLen(r.runs, 'rest') === 180, r.runs);
    check('C: broodcell keeps ≤ 6 motes alive (got ' + r.motes + ')', r.motes >= 3 && r.motes <= 6, r.motes);
    r = await ev((d, g, Q) => { Q.enter('bv_cistern'); const e = Q.find('broodcell'); Q.pinAt(e.x - 150, e.y); Q.until(e, 'pulse', 20); Q.step(20); return e.state; });
    await shot('qa-enemy-broodcell-tell.png');
    r = await ev((d, g, Q) => {
      const e = Q.find('broodcell'); d.god(false); Q.takeDrops(); Q.pinAt(e.x - 150, e.y);
      for (let f = 0; f < 240; f++) { const m = g.enemies.find(m => m.type === 'mote' && !m.dead); if (m) Q.pinAt(m.x, m.y + 20); Q.step(1); }
      d.god(true); const hits = Q.takeDrops();
      const motes0 = g.enemies.filter(m => m.type === 'mote' && !m.dead).length;
      const k = Q.kill(e); Q.step(2);
      return { hits, motes0, killed: k.dead, motesLeft: g.enemies.filter(m => m.type === 'mote' && !m.dead).length };
    });
    check('C: motes hurt the player on contact', r.hits.length >= 1, r);
    check('C: killing the broodcell pops its living motes', r.killed && r.motes0 >= 1 && r.motesLeft === 0, r);
    r = await ev((d, g, Q) => {
      const res = {}; Q.enter('bv_cistern'); const e = Q.find('broodcell'); Q.pinAt(e.x - 150, e.y);
      for (const o of g.enemies) if (o.type !== 'broodcell' && o.type !== 'mote') o.dead = true;   // only the broodcell and its motes (the patrolling brinecrab would eat the lights)
      e.hp = e.maxHp = 999;   // the lights aimed at motes beside the sac must not kill the broodcell itself (its own drops would pollute the count)
      let m = null; for (let f = 0; f < 200 && !m; f++) { Q.step(1); m = g.enemies.find(x => x.type === 'mote') || null; }
      res.stats = m ? { w: m.w, h: m.h, hp: m.hp, contact: m.contact, bits: m.bits, life: m.life, kb: m.kbResist, launchVy: m.vy } : null;
      let maxV = 0; for (let f = 0; f < 60; f++) { Q.step(1); if (m && !m.dead) maxV = Math.max(maxV, Math.hypot(m.vx, m.vy)); } res.maxV = maxV;
      g.player.hp = 1; const drops = { bit: 0, heart: 0, spark: 0, shard: 0 }; let killed = 0;
      for (let k = 0; k < 12; k++) {
        let mm = g.enemies.find(x => x.type === 'mote' && !x.dead);
        if (!mm) { Q.pinAt(e.x - 150, e.y); for (let f = 0; f < 300 && !mm; f++) { Q.step(1); mm = g.enemies.find(x => x.type === 'mote' && !x.dead) || null; } }
        if (!mm) break;
        const before = new Set(g.pickups);
        for (let tries = 0; tries < 6 && !mm.dead; tries++) { mm.vx = 0; mm.vy = 0; Q.attack(mm, -1, 'light', 4); }
        if (mm.dead) { killed++; for (const p of g.pickups) if (!before.has(p)) drops[p.type] = (drops[p.type] || 0) + 1; }
        g.player.hp = 1;
      }
      res.kills = { killed, drops }; g.player.hp = g.player.maxHp;
      let mm = g.enemies.find(x => x.type === 'mote' && !x.dead);
      if (!mm) { Q.pinAt(e.x - 150, e.y); for (let f = 0; f < 400 && !mm; f++) { Q.step(1); mm = g.enemies.find(x => x.type === 'mote' && !x.dead) || null; } }
      if (mm) { mm.life = 3; const c0 = e.motes; Q.step(5); res.expire = { dead: mm.dead, c0, c1: e.motes }; }
      return res;
    });
    check('H: motes are 10×10, HP 3, contact 1, bits 1, life 420, launched up at 3 px/f, home at ≤ 3 px/f', !!r.stats && r.stats.w === 10 && r.stats.h === 10 && r.stats.hp === 3 && r.stats.contact === 1 && r.stats.bits === 1 && r.stats.life >= 418 && r.stats.launchVy === -3 && r.maxV <= 3.05, r);
    check('H: killed motes drop their bit but never hearts or orbs (player at 1 hp, ' + r.kills.killed + ' kills)', r.kills.killed >= 6 && r.kills.drops.bit >= r.kills.killed && r.kills.drops.heart === 0 && r.kills.drops.spark === 0, r.kills);
    check('H: a mote that times out dies and frees its broodcell slot', !!r.expire && r.expire.dead && r.expire.c1 === r.expire.c0 - 1, r.expire);
    // droplatch (dc_loft 21,4): CLING → ALERT 18 → DROP (contact 2) → SPLAT 12 → SCUTTLE 120 → CLIMB → CLING
    r = await ev((d, g, Q) => { Q.enter('dc_loft'); const e = Q.find('droplatch'); Q.pinAt(e.x, e.y + 160); const r = Q.run(420, e); r.sy = e.spawnY; return r; });
    check('C: droplatch drops on a player below (ALERT 18 f tell → DROP → SPLAT 12 → SCUTTLE 120 → CLIMB → CLING)', runLen(r.runs, 'alert') === 18 && hasRun(r.runs, 'drop') && runLen(r.runs, 'splat') === 12 && runLen(r.runs, 'scuttle') === 120 && hasRun(r.runs, 'climb') && r.runs.some((x, i) => x[0] === 'cling' && i > 3), r.runs);
    check('C: droplatch never embeds while dropping / scuttling / climbing', r.stuck === 0, r.stuck);
    r = await ev((d, g, Q) => { Q.enter('dc_loft'); const e = Q.find('droplatch'); Q.pinAt(e.x, e.y + 160); Q.until(e, 'alert', 30); Q.step(9); return e.state; });
    await shot('qa-enemy-droplatch-tell.png');
    r = await ev((d, g, Q) => { const e = Q.find('droplatch'); Q.until(e, 'drop', 30); const c = e.contact; Q.until(e, 'splat', 120); return { dropContact: c, splatContact: e.contact }; });
    check('C: droplatch contact 2 during DROP, 1 after landing', r.dropContact === 2 && r.splatContact === 1, r);
    r = await ev((d, g, Q) => { Q.enter('dc_loft'); const e = Q.find('droplatch'); const hp0 = e.hp; Q.attack(e, 1, 'light', 2); const st = e.state; Q.step(10); return { dmg: hp0 - e.hp, st, later: e.state, y: e.y, sy: e.spawnY }; });
    check('C: a hit on a clinging droplatch knocks it into DROP at once', r.dmg === 3 && (r.st === 'drop' || r.later === 'drop' || r.later === 'splat') && r.y > r.sy, r);
    r = await ev((d, g, Q) => {
      const res = {};
      Q.enter('dc_loft'); let e = Q.find('droplatch'); Q.pinAt(e.x + 90, e.y + 160); res.farX = Q.run(120, e).runs.map(x => x[0]);
      Q.enter('dc_loft'); e = Q.find('droplatch'); Q.pinAt(e.x, e.y - 40); res.above = Q.run(120, e).runs.map(x => x[0]);
      Q.enter('dc_loft'); e = Q.find('droplatch'); Q.pinAt(e.x, e.y + 160); let cl = -1; for (let f = 0; f < 600; f++) { Q.step(1); if (f > 100 && e.state === 'cling') { cl = f; break; } }
      res.recling = { f: cl, above: Q.tileAt(Math.floor(e.x / 30), Math.floor((e.y - e.h - 1) / 30)), y: e.y, spawnY: e.spawnY };
      return res;
    });
    check('H: droplatch ignores a player 3 tiles to the side or above it (stays CLING)', r.farX.join() === 'cling' && r.above.join() === 'cling', r);
    check('H: after its cycle the droplatch re-clings under a "#" tile (dc_loft: back at its ceiling)', r.recling.f > 0 && r.recling.above === '#' && Math.abs(r.recling.y - r.recling.spawnY) < 2, r.recling);
    // H: the dropper must land on the FIRST footing under it (DESIGN §7.9 "until it lands on footing"; §7.0 footing includes one-way grates) — every placement
    r = await ev((d, g, Q) => {
      const out = []; const E = window.UB.Entity;
      for (const room of ['dc_loft', 'lw_hoist', 'lw_belts', 'lw_shaft', 'bv_cistern', 'bv_catwalk', 'ns_base', 'ns_climb', 'ns_plunge', 'rw_gate']) {
        Q.enter(room, null); const lv = g.level;
        const latches = g.enemies.filter(e => e.type === 'droplatch');
        for (const e of latches) {
          const tx = Math.floor(e.x / 30); let ty = Math.floor(e.y / 30), ch = '.';
          for (let r2 = ty; r2 < lv.h; r2++) { const c = E.tileAt(lv, tx, r2); if (c === '#' || c === '-' || c === 'c') { ch = c; ty = r2; break; } }
          Q.pinAt(e.x, ch === 'c' ? ty * 30 + 60 : ty * 30);   // under it (not on a crumble plank)
          let landedY = null, passes = 0;
          for (let f = 0; f < 400; f++) {
            Q.step(1);
            if (e.state === 'drop') { const tyy = Math.floor((e.y - 1) / 30); if (E.tileAt(lv, tx, tyy) === '-') passes++; }
            if (e.state === 'splat' && landedY === null) { landedY = e.y; break; }
          }
          out.push({ room, spawn: [tx, Math.floor(e.spawnY / 30) - 1], footing: ch, footingRow: ty, landedY, expectY: ty * 30, passes });
          Q.pin = null;
        }
      }
      return out;
    });
    for (const L of r) check('H: droplatch ' + L.room + ' (' + L.spawn + ') lands on the first footing below it (row ' + L.footingRow + ' "' + L.footing + '", y ' + L.expectY + ')', L.landedY === L.expectY && L.passes === 0, L);
    // voltwheel (bv_cistern 56,32): ROLL 2.4 px/f, every 150 f a player above within 4 tiles → 10 f tell → HOP (vy −6)
    r = await ev((d, g, Q) => { Q.enter('bv_cistern'); const e = Q.find('voltwheel'); let minVy = 0; const r = Q.run(400, e, function (f, e) { Q.pinAt(e.x, e.y - 60); if (e.vy < minVy) minVy = e.vy; }); r.minVy = minVy; return r; });
    check('C: voltwheel rolls at 2.4 px/f and hops (10 f tell, vy −6) at a player above it', Math.abs(r.maxVx - 2.4) < 0.05 && runLen(r.runs, 'tell') === 10 && hasRun(r.runs, 'hop') && r.minVy <= -5.5, { maxVx: r.maxVx, runs: r.runs, minVy: r.minVy });
    r = await ev((d, g, Q) => { const e = Q.find('voltwheel'); for (let f = 0; f < 200; f++) { Q.pinAt(e.x, e.y - 60); Q.step(1); if (e.state === 'tell') break; } Q.step(5); return e.state; });
    await shot('qa-enemy-voltwheel-tell.png');
    r = await ev((d, g, Q) => {
      const res = {}; Q.enter('bv_cistern'); let e = Q.find('voltwheel'); Q.pinAt(e.x - 200, e.y); Q.step(5); Q.attack(e, 1, 'light', 0); res.hit = { hitstun: e.hitstun, kb: e.kbResist, state: e.state, vx: e.vx, hp: e.hp };
      Q.enter('bv_cistern'); e = Q.find('voltwheel'); const r0 = Q.run(400, e, function () { Q.pinAt(e.x - 60, e.y); }); res.beside = r0.runs.map(x => x[0]).filter((v, i, a) => a.indexOf(v) === i);
      Q.enter('rw_gate'); d.spawnEnemy('voltwheel', 20, 14, { patrol: [19, 27] }); const ee = g.enemies[g.enemies.length - 1]; res.root = ee && ee.type === 'voltwheel' ? { speed: ee.speed, rim: ee.cRim } : null;
      return res;
    });
    check('H: voltwheel is knockback-immune (kbResist 0, no hitstun, keeps rolling after a hit) and only hops for a player ABOVE it', r.hit.kb === 0 && r.hit.hitstun === 0 && r.hit.state === 'roll' && Math.abs(r.hit.vx) === 2.4 && r.hit.hp === 9 && r.beside.join() === 'roll', r);
    check('H: a Rootwell voltwheel rolls at 2.8 px/f with the #ffcf5a rim', !!r.root && r.root.speed === 2.8 && r.root.rim === '#ffcf5a', r.root);
    // static-shot scuttlebit (ns_base 18,19): a spark every 90 f lasting 45 f that hurts; brinecrab HP 9 speed 1.4
    r = await ev((d, g, Q) => {
      Q.enter('ns_base'); const e = Q.find('scuttlebit', 'staticshot'); Q.pinAt(e.x - 300, e.y);
      const spawnF = []; let life = 0; const seen = new Set();
      for (let f = 0; f < 300; f++) { Q.step(1); for (const p of g.projectiles) { if (p.kind === 'spark' && !seen.has(p)) { seen.add(p); spawnF.push(f); life = p.life; } } }
      d.god(false); Q.takeDrops();
      for (let f = 0; f < 120; f++) { const p = g.projectiles.find(p => p.kind === 'spark' && !p.dead); if (p) Q.pinAt(p.x, p.y); Q.step(1); }
      d.god(true);
      return { spawnF, life, hits: Q.takeDrops(), hp: e.hp, speed: e.speed };
    });
    check('C: static-shot scuttlebit (HP 9, speed 1.1) drops a spark every 90 f lasting 45 f', r.hp === 9 && r.speed === 1.1 && r.spawnF.length >= 3 && r.spawnF[1] - r.spawnF[0] === 90 && r.life >= 44 && r.life <= 45, r);
    check('C: the static spark hurts the player', r.hits.length >= 1, r.hits);
    r = await ev((d, g, Q) => { Q.enter('bv_cistern'); const e = Q.find('scuttlebit', 'brinecrab'); Q.pinAt(e.x - 300, e.y - 300); const r = Q.run(60, e); r.hp = e.hp; return r; });
    check('C: brinecrab HP 9, speed 1.4', r.hp === 9 && Math.abs(r.maxVx - 1.4) < 0.05, { hp: r.hp, maxVx: r.maxVx });

    // ---------------------------------------------------------------- D: damage, death, drops
    const KILLS = [
      ['dc_wake', 'scuttlebit', undefined, 6, 2, false], ['dc_fall', 'hopnode', undefined, 9, 3, false], ['dc_fall', 'driftmoth', undefined, 6, 2, false],
      ['bv_sluice', 'brinejelly', undefined, 9, 3, false], ['ns_base', 'glarewisp', undefined, 9, 3, false], ['dc_cross', 'spitvalve', undefined, 12, 5, false],
      ['lw_belts', 'rambyte', undefined, 18, 6, true], ['lw_belts', 'platewalker', undefined, 15, 6, true], ['bv_cistern', 'broodcell', undefined, 21, 8, true],
      ['dc_loft', 'droplatch', undefined, 9, 3, false], ['bv_cistern', 'voltwheel', undefined, 12, 5, true], ['bv_cistern', 'scuttlebit', 'brinecrab', 9, 2, false],
      ['rw_gate', 'platewalker', 'rootplate', 21, 6, true], ['rw_gate', 'rambyte', 'rootram', 24, 6, true], ['rw_gate', 'spitvalve', 'twinvalve', 12, 5, false],
      ['rw_gate', 'broodcell', undefined, 27, 8, true], ['ns_base', 'scuttlebit', 'staticshot', 9, 2, false], ['ns_plunge', 'hopnode', 'nullnode', 9, 3, false],
      ['rw_gate', 'scuttlebit', 'rootbound', 12, 3, false], ['rw_gate', 'glarewisp', 'rootwisp', 12, 3, false], ['bv_sluice', 'hopnode', 'dripnode', 12, 3, false],
    ];
    for (const K of KILLS) {
      const tag = K[1] + (K[2] ? ':' + K[2] : '');
      r = await ev((d, g, Q, room, type, variant) => {
        Q.enter(room); const e = Q.find(type, variant); if (!e) return null;
        const hp0 = e.hp; const k = Q.kill(e); k.hp0 = hp0; k.comp = Q.comp(k.drops);
        return k;
      }, K[0], K[1], K[2]);
      check('D: ' + tag + ' HP ' + K[3] + ', dies to lights, enemiesPurged++', !!r && r.hp0 === K[3] && r.dead && r.purgedDelta >= 1, r);
      if (!r) continue;
      const bitValue = r.drops.filter(p => p.type === 'bit').reduce((s, p) => s + (p.size === 'large' ? 20 : p.size === 'medium' ? 5 : 1), 0);
      const wantMed = Math.floor(K[4] / 5), wantSmall = K[4] % 5;
      check('D: ' + tag + ' drops ' + K[4] + ' bits as ' + wantMed + ' medium + ' + wantSmall + ' small (§9.2 split)' + (K[5] ? ' + a guaranteed shard' : ''), bitValue === K[4] && r.comp.medium === wantMed && r.comp.small === wantSmall && (!K[5] || r.comp.shard >= 1), r.comp);
    }
    r = await ev((d, g, Q) => { let hearts = 0, n = 0; for (let i = 0; i < 10; i++) { Q.enter('dc_wake'); const e = Q.find('scuttlebit'); g.player.hp = g.player.maxHp; const k = Q.kill(e); if (k.dead) { n++; hearts += k.drops.filter(p => p.type === 'heart').length; } } return { n, hearts }; });
    check('H: no heart drops at full HP (10 kills)', r.n === 10 && r.hearts === 0, r);
    r = await ev((d, g, Q) => { Q.enter('dc_wake'); const n0 = g.enemies.length; d.killEnemies(); Q.enter('dc_fall'); Q.enter('dc_wake'); return { n0, n2: g.enemies.length }; });
    check('D: enemies respawn on room re-entry', r.n0 === 1 && r.n2 === 1, r);
    check('D: no player hp loss with god mode during the enemy tests', (await ev((d, g, Q) => Q.takeDrops())).length === 0);

    // ---------------------------------------------------------------- E: bosses in their arenas (round 1)
    for (const A of ARENAS) {
      const tag = 'E: ' + A.id;
      const entry = await ev((d, g, Q, A) => {
        Q.pin = null; d.warp(A.from, null); d.step(2); d.warp(A.room, 'L'); Q.wrapHurt();
        const b0 = Q.boss(); const o0 = Q.openings(); d.step(1);
        return { b0, o0, b1: Q.boss(), o1: Q.openings(), card: Q.card(), enemies: g.enemies.filter(e => e.type !== 'bossSegment').length };
      }, A);
      check(tag + ': the arena holds the boss at spec.spawn (hp ' + A.hp + ', inactive) with the doors open before the trigger', entry.b0 && entry.b0.id === A.id && entry.b0.hp === A.hp && !entry.b0.active && entry.b0.fight === 'none' && entry.o0.every(o => !o.sealed || (A.id === 'corrosant' && o.id === 'B')), entry);
      check(tag + ': walking into the bounds starts the fight: intro, player locked, boss music', entry.b1.fight === 'intro' && entry.b1.mode === 'bossIntro' && entry.b1.locked && entry.b1.song === 'boss', entry.b1);
      check(tag + ': intro card ' + A.name + ' / ' + A.sub + ' for 150 f', entry.card.name === A.name && entry.card.sub === A.sub && entry.card.dur === 150 && entry.card.t >= 149, entry.card);
      check(tag + ': seal drops over ' + A.seal.join('+'), A.seal.every(id => entry.o1.find(o => o.id === id && o.sealed)), entry.o1);
      await ev((d, g, Q) => Q.step(6));
      await shot('qa-boss-' + A.id + '-intro.png');
      r = await ev((d, g, Q) => { Q.step(142); const a = Q.boss(); Q.step(2); const b = Q.boss(); return { a, b }; });
      check(tag + ': fight begins after the 150 f card (active, player unlocked)', r.a.fight === 'intro' && r.b.fight === 'fight' && r.b.active && !r.b.locked && r.b.mode === 'normal', r);
      check(tag + ': arena geometry spans the fight bounds (x0 ≈ bounds[0]·30, x1 ≈ (bounds[1]+1)·30)', r.b.A && Math.abs(r.b.A.x0 - 30) <= 30 && r.b.A.x1 >= (A.id === 'kernauth' ? 1860 : (A.id === 'corrosant' ? 1230 : 1170)), r.b.A);
      const seen = []; let frames = 0; const tellLen = {};
      const WINDOW = A.window || 1500;
      while (frames < WINDOW && A.attacks.some(a => seen.indexOf(a) < 0)) {
        const tl = await ev((d, g, Q, seen, max, spots) => Q.untilNewTell(seen, max, spots), seen, WINDOW - frames, A.spots);
        if (!tl) break;
        frames += tl.f + 1; seen.push(tl.attack); tellLen[tl.attack] = tl.timer;
        await ev((d, g, Q, n) => Q.step(n), Math.max(1, Math.floor(tl.timer / 2)));
        await shot('qa-boss-' + A.id + '-' + tl.attack + '.png');
      }
      check(tag + ': all four attacks appear within ' + WINDOW + ' f (' + seen.join(', ') + ' in ' + frames + ' f)', A.attacks.every(a => seen.indexOf(a) >= 0), { seen, frames });
      for (const a of seen) check(tag + ': ' + a + ' tell = ' + A.tells[a] + ' f (≥ 20 f)', tellLen[a] === A.tells[a] && tellLen[a] >= 20, tellLen[a]);
      check(tag + ': the player (god on) lost no hp during the fight sampling', (await ev((d, g, Q) => Q.takeDrops())).length === 0);
      if (A.id === 'weftyr') {
        r = await ev((d, g, Q) => {
          const b = g.boss; Q.pinAt(600, 450);
          let dashMin = 1e9, dashMax = -1e9, needles = 0, snareW = 0;
          for (let f = 0; f < 1500; f++) { Q.step(1); if (!g.boss) break;
            if (b.state === 'dash') { dashMin = Math.min(dashMin, b.x); dashMax = Math.max(dashMax, b.x); }
            let n = 0; for (const p of g.projectiles) { if (p.kind === 'needle') n++; if (p.kind === 'snare') snareW = Math.max(snareW, p.w); } needles = Math.max(needles, n);
          }
          return { dashTravel: dashMax - dashMin, needles, snareW };
        });
        check(tag + ': Thread Dash crosses the arena (travel ≥ 900 px)', r.dashTravel >= 900, r);
        check(tag + ': Needle Rain drops six needles', r.needles >= 6, r);
        check(tag + ': Snare Line spans the arena (≥ 1000 px)', r.snareW >= 1000, r);
      } else if (A.id === 'corrosant') {
        r = await ev((d, g, Q) => {
          const b = g.boss; Q.pinAt(300, 630);
          let lungeMax = 0, sweepMin = 1e9, sweepMax = -1e9, minX = 1e9, maxX = -1e9, segs = g.enemies.filter(e => e.type === 'bossSegment').length;
          for (let f = 0; f < 1800; f++) { Q.step(1); if (!g.boss) break;
            if (b.state === 'lunge') lungeMax = Math.max(lungeMax, b.lungeMax);
            if (b.state === 'sweep') { sweepMin = Math.min(sweepMin, b.x); sweepMax = Math.max(sweepMax, b.x); }
            minX = Math.min(minX, b.x); maxX = Math.max(maxX, b.x);
          }
          return { lungeMax, sweepSpan: sweepMax - sweepMin, headRangeX: maxX - minX, segs };
        });
        check(tag + ': seven body segments follow the head', r.segs === 7, r.segs);
        check(tag + ': Wall Lunge reaches up to 14 tiles (≥ 300 px)', r.lungeMax >= 300, r);
        check(tag + ': Coil Sweep crosses the floor (span ≥ 600 px)', r.sweepSpan >= 600, r);
        check(tag + ': the head uses the whole arena width (range ≥ 600 px)', r.headRangeX >= 600, r);
      }
      if (!A.final) {
        r = await ev((d, g, Q, thr) => { g.boss.hp = thr + 1; const h = Q.hitBoss(30); return { h, b: Q.boss() }; }, A.enrage);
        check(tag + ': dropping to ≤ ' + A.enrage + ' hp triggers the enrage roar (invulnerable, phase-2 bar)', !r.h.failed && r.b.enraged && r.b.roar > 0 && r.b.state === 'roar' && r.b.phase === 2, r);
        await shot('qa-boss-' + A.id + '-enrage.png');
        r = await ev((d, g, Q) => { const h = Q.hitBoss(2); return { h, b: Q.boss() }; });
        check(tag + ': hits during the roar are blocked', r.h.failed && r.b.roar >= 0, r);
        r = await ev((d, g, Q) => { Q.step(120); return Q.boss(); });
        check(tag + ': the fight resumes after the roar', r.roar === 0 && r.state !== 'roar' && r.fight === 'fight', r);
        if (A.id === 'tallock') {
          r = await ev((d, g, Q) => { const b = g.boss; let tl = null; for (let f = 0; f < 1200 && !tl; f++) { if (f % 30 === 0) Q.pinAt(b.x < 600 ? 1110 : 90, 450); Q.step(1); if (b.state === 'tell' && b.attack === 'discToss') tl = b.timer; } let discs = 0; for (let f = 0; f < 60; f++) { Q.step(1); discs = Math.max(discs, g.projectiles.filter(p => p.kind === 'disc').length); } return { tell: tl, discs, walk: b.walkSpeed, gap: b.gap, wave: b.waveSpeed }; });
          check(tag + ' enraged: walk 2.2, gap 30, waves 6.5, Disc Toss fires two discs', r.walk === 2.2 && r.gap === 30 && r.wave === 6.5 && r.discs === 2, r);
          check(tag + ' enraged: Disc Toss tell is max(20, 24−6) = 20 f (the §8.0 fairness floor)', r.tell === 20, r.tell);
        }
        if (A.id === 'corrosant') {
          r = await ev((d, g, Q) => {
            const b = g.boss; d.god(false); Q.takeDrops(); Q.pinAt(20 * 30 + 15, 21 * 30);
            let on = 0, first = -1, box = null, last = -1;
            for (let f = 0; f < 700; f++) { Q.step(1); if (b.floodOn > 0) { if (b.floodOn !== last) { on++; last = b.floodOn; } if (first < 0) first = f; if (b.floodOn === 60) box = { x: b.hitFlood.x, w: b.hitFlood.w, y: b.hitFlood.y, h: b.hitFlood.h }; } }
            d.god(true);
            return { on, first, box, hits: Q.takeDrops(), crawl: b.speed, tellCut: b.tellCut, puddleLife: b.puddleLife };
          });
          check(tag + ' enraged (Flood): crawl 4.5, tells −8, puddles 240 f, the floor floods 120 f within 420 f', r.crawl === 4.5 && r.tellCut === 8 && r.puddleLife === 240 && r.on === 120 && r.first >= 0 && r.first <= 430, r);
          check(tag + ' Flood covers the whole arena floor (box ≥ 1100 px wide) and is a hazard for a player standing on it (−1 hp, the §3.3 freeze, respawn on a grate)', !!r.box && r.box.w >= 1100 && r.hits.filter(h => h.mode === 'hazard' && h.tag === 'hazard').length >= 1, r);
        }
        // I: every enraged tell = max(20, tell − cut)
        r = await ev((d, g, Q, A) => {
          const b = g.boss, et = {}; let last = b.state;
          for (let f = 0; f < 4000 && Object.keys(et).length < 4; f++) {
            if (f % 90 === 0) { const sp = A.spots[Math.floor(f / 90) % A.spots.length]; if (sp === 'near') Q.pinAt(b.x + (b.x < b.A.cx ? 70 : -70), b.A.floorY); else if (sp === 'far') Q.awayFloor(); else Q.pinAt(sp[0] * 30 + 15, (sp[1] + 1) * 30); }
            Q.step(1);
            if (b.state === 'tell' && last !== 'tell' && et[b.attack] === undefined) et[b.attack] = b.timer;
            last = b.state;
          }
          return et;
        }, A);
        for (const a of A.attacks) check('I: ' + A.id + ' enraged ' + a + ' tell = max(20, ' + A.tells[a] + ' − ' + A.cut + ') = ' + Math.max(20, A.tells[a] - A.cut) + ' f', r[a] === Math.max(20, A.tells[a] - A.cut), r);
      } else {
        r = await ev((d, g, Q) => { const b = g.boss; b.hp = 1; const h = Q.hitBoss(40, function () { return b.phase === 2; }); const o = Q.boss(); o.card = Q.card(); return { h, o }; });
        check(tag + ': phase 1 at 0 hp → phase 2 inside takeHit (hp 240/240, transition 180 f, contact 0, fight continues, player i-frames 180)', !r.h.failed && r.o.phase === 2 && r.o.hp === 240 && r.o.maxHp === 240 && r.o.state === 'transition' && r.o.timer === 180 && r.o.contact === 0 && r.o.fight === 'fight' && r.o.iframes === 180, r);
        check(tag + ': UNBOUND card (60 f) during the transition', r.o.card.name === 'KERNAUTH' && r.o.card.sub === 'UNBOUND' && r.o.card.dur === 60 && r.o.card.t > 50, r.o.card);
        await ev((d, g, Q) => Q.step(40)); await shot('qa-boss-kernauth-transition.png');
        r = await ev((d, g, Q) => { let n = 40; while (n < 260 && g.boss.state === 'transition') { Q.step(1); n++; } return { n, b: Q.boss() }; });
        check(tag + ': the transition lasts 180 f (+hitstop) and phase 2 flies free', r.n >= 180 && r.n <= 192 && r.b.state !== 'transition' && r.b.phase === 2 && r.b.contact === 1, r);
        const seen2 = []; let fr2 = 0; const tl2 = {};
        while (fr2 < 1500 && A.attacks2.some(a => seen2.indexOf(a) < 0)) {
          const tl = await ev((d, g, Q, seen, max, spots) => Q.untilNewTell(seen, max, spots), seen2, 1500 - fr2, A.spots);
          if (!tl) break;
          fr2 += tl.f + 1; seen2.push(tl.attack); tl2[tl.attack] = tl.timer;
          await ev((d, g, Q, n) => Q.step(n), Math.max(1, Math.floor(tl.timer / 2)));
          await shot('qa-boss-kernauth2-' + tl.attack + '.png');
        }
        check(tag + ' phase 2: all four attacks appear within 1500 f (' + seen2.join(', ') + ')', A.attacks2.every(a => seen2.indexOf(a) >= 0), { seen2, fr2 });
        for (const a of seen2) check(tag + ' phase 2: ' + a + ' tell = ' + A.tells2[a] + ' f' + (a === 'blink' ? ' fade (+20 f reappear)' : ''), tl2[a] === A.tells2[a], tl2[a]);
        r = await ev((d, g, Q) => { g.boss.hp = 61; const h = Q.hitBoss(40); const o = Q.boss(); return { h, o, hoverGap: g.boss.hoverGap, speed: g.boss.speed, tailLen: g.boss.tailLen }; });
        check(tag + ': ≤ 60 hp in phase 2 → Panic Loop roar (no hover gap, flight 5.5, tail 160)', !r.h.failed && r.o.enraged && r.o.roar > 0 && r.hoverGap === 0 && r.speed === 5.5 && r.tailLen === 160, r);
        await shot('qa-boss-kernauth-panic.png');
        r = await ev((d, g, Q) => {
          const b = g.boss, A = b.A, et = {}; let last = b.state;
          for (let f = 0; f < 4000 && Object.keys(et).length < 6; f++) {
            Q.pinAt(A.cx, A.floorY); Q.step(1);
            if (b.state !== last) { if (b.state === 'tell2' && et[b.attack] === undefined) et[b.attack] = b.timer; if (b.state === 'blinkIn' && et.blinkIn === undefined) et.blinkIn = b.timer; if (b.state === 'retell2' && et.retell === undefined) et.retell = b.timer; if (b.state === 'beamWait' && et.beamWait === undefined) et.beamWait = b.timer; }
            last = b.state;
          }
          return et;
        });
        check('I: kernauth Panic Loop tells: dive 22, beam 32, frag max(20,16) = 20, Blink reappear 20; the second beam re-tells 15 f and fires 30 f after the first', r.dive === 22 && r.beam === 32 && r.frag === 20 && r.blinkIn === 20 && r.retell === 15 && r.beamWait === 15, r);
      }
      r = await ev((d, g, Q) => { g.boss.hp = 1; const h = Q.hitBoss(60); return { h, o: Q.boss() }; });
      check(tag + ': the killing hit starts the death sequence (dying, inactive, music stops)', !r.h.failed && r.o.fight === 'dying' && !r.o.active && r.o.song === null, r);
      r = await ev((d, g, Q, A) => {
        Q.pinAt(g.level.room.w * 30 - 90, (g.level.room.h - 3) * 30);
        let s = null, f = 0;
        for (; f < 400; f++) { Q.step(1); s = d.state(); if (s.bossFight === 'reward' || s.bossFight === 'done' || s.screen === 'victory') break; }
        const pk = d.pickups(); const sp = g.level.boss;
        return { f, fight: s.bossFight, screen: s.screen, pk, pickup: sp.pickup, toastT: window.UB.UI.toastT, deathFrames: A.id === 'corrosant' ? 120 : (A.id === 'kernauth' ? 120 : 90) };
      }, A);
      check(tag + ': death animation runs ' + (A.id === 'tallock' || A.id === 'weftyr' ? 90 : 120) + ' f (+10 f hitstop) then PURGED toast + rewards', r.f >= r.deathFrames && r.f <= r.deathFrames + 12 && r.toastT > 0 && (r.fight === 'reward' || r.fight === 'done'), r);
      const large = r.pk.filter(p => p.type === 'bit' && p.size === 'large').length, sparks = r.pk.filter(p => p.type === 'spark').length, mod = r.pk.find(p => p.type === 'ability');
      check(tag + ': rewards = ' + A.bits + ' large bits + 3 sparks' + (A.final ? ' (no module)' : ' + the module at spec.pickup'), large === A.bits && sparks === 3 && (A.final ? !mod : (!!mod && Math.abs(mod.x - (r.pickup.x * 30 + 15)) < 1 && Math.abs(mod.y - (r.pickup.y + 1) * 30) < 1)), r.pk);
      await shot('qa-boss-' + A.id + '-reward.png');
      if (!A.final) {
        r = await ev((d, g, Q) => {
          const p = g.pickups.find(p => p.type === 'ability'); if (!p) return null;
          Q.pinAt(p.x, p.y); Q.step(3); const m0 = { mode: g.mode, locked: g.player.locked, iframes: g.player.iframes }; Q.pin = null;
          let s = d.state(); let f = 0; for (; f < 140 && g.mode === 'pickupSeq'; f++) d.step(1);
          s = d.state();
          return { m0, f, mode: g.mode, abilities: s.abilities, bossesDefeated: s.bossesDefeated, openings: Q.openings(), fight: s.bossFight, boss: !!g.boss, song: window.UB.Audio.state().song, hasSave: s.hasSave };
        });
        check(tag + ': touching the module starts the 120 f pickup sequence (locked, invulnerable)', !!r && r.m0.mode === 'pickupSeq' && r.m0.locked && r.m0.iframes >= 100 && r.f >= 115 && r.f <= 120, r);
        check(tag + ': the sequence grants ' + A.ability + ', records the boss, unseals the doors, restores zone music, saves', !!r && r.abilities[A.ability] && r.bossesDefeated.includes(A.id) && r.openings.every(o => !o.sealed) && r.fight === 'done' && !r.boss && r.song === A.song && r.hasSave, r);
        r = await ev((d, g, Q, A) => { Q.pin = null; d.warp(A.from, null); d.step(2); d.warp(A.room, 'L'); d.step(10); return { boss: !!g.boss, fight: g.bossFight.state, mode: g.mode, openings: Q.openings(), cardT: Q.card().t, song: window.UB.Audio.state().song }; }, A);
        check(tag + ': the arena is re-enterable after the defeat without a re-fight (no boss, no card, doors open)', !r.boss && r.fight === 'none' && r.mode === 'normal' && r.openings.every(o => !o.sealed) && r.cardT === 0 && r.song === A.song, r);
      } else {
        r = await ev((d, g, Q) => { let s = d.state(); for (let i = 0; i < 600 && s.screen !== 'victory'; i++) { d.step(1); s = d.state(); } const sv = JSON.parse(localStorage.getItem('underbyte.save') || 'null'); return { screen: s.screen, bossesDefeated: s.bossesDefeated, saved: sv && sv.victory, savedBosses: sv && sv.bossesDefeated }; });
        check(tag + ': final boss death reaches the victory screen; kernauth recorded; save written with victory', r.screen === 'victory' && r.bossesDefeated.includes('kernauth') && r.saved === true && r.savedBosses && r.savedBosses.includes('kernauth'), r);
        await shot('qa-boss-kernauth-victory.png');
        r = await ev((d, g, Q) => { d.toTitle(); const ok = d.continueGame(); let s = d.state(); for (let i = 0; i < 200 && !(s.screen === 'play' && !s.busy); i++) { d.step(1); s = d.state(); } d.warp('rw_throne', 'L'); d.step(10); return { ok, boss: !!g.boss, fight: g.bossFight.state, openings: Q.openings(), cardT: Q.card().t }; });
        check(tag + ': after CONTINUE the throne room is re-enterable without a re-fight', r.ok && !r.boss && r.fight === 'none' && r.openings.every(o => !o.sealed) && r.cardT === 0, r);
      }
    }
    // death animation + pickup sequence are skippable after 30 f (Tallock, fresh game)
    r = await ev((d, g, Q) => {
      Q.fresh('tessik');
      d.warp('dc_shrine', null); d.step(2); d.warp('dc_sentinel', 'L'); Q.wrapHurt(); Q.step(160);
      const b = g.boss; b.hp = 1; const h = Q.hitBoss(30);
      Q.pinAt(1100, 450); Q.step(45); const t35 = g.bossFight.state;
      d.pressed('light', 1); Q.step(2); const afterKey = g.bossFight.state;
      let p = null; for (let i = 0; i < 300 && !p; i++) { Q.step(1); p = g.pickups.find(p => p.type === 'ability'); }
      Q.pinAt(p.x, p.y); Q.step(3); Q.pin = null; const m0 = g.mode; Q.step(35); d.pressed('jump', 1); Q.step(3);
      return { h, t35, afterKey, m0, modeAfterSkip: g.mode, abilities: d.state().abilities, bossesDefeated: d.state().bossesDefeated };
    });
    check('E: the boss death animation is skippable with any key after 30 f', r.t35 === 'dying' && r.afterKey === 'reward', r);
    check('E: the pickup sequence is skippable after 30 f and still grants / records', r.m0 === 'pickupSeq' && r.modeAfterSkip === 'normal' && r.abilities.echoJump && r.bossesDefeated.includes('tallock'), r);
    r = await ev((d, g, Q) => {
      const out = {};
      for (const id of ['tessik', 'brackmaw', 'vellix', 'orrubel', 'korvask']) {
        Q.fresh(id);
        d.warp('dc_sentinel', 'L'); Q.step(160);
        d.teleport(300, 450); d.step(5); let minY = 1e9; d.pressed('jump', 25);
        for (let f = 0; f < 70; f++) { d.step(1); minY = Math.min(minY, g.player.y); }
        d.step(30); out[id] = { apex: Math.round(450 - minY), landedY: g.player.y };
      }
      return out;
    });
    check('E: tallock arena grates (row 12, 3 tiles above the floor) are reachable with a plain jump by every fighter', Object.values(r).every(v => v.landedY <= 361), r);

    // ---------------------------------------------------------------- I: bosses, deeper (god OFF damage, pattern rules, geometry)
    // ---- Tallock
    r = await ev((d, g, Q) => {
      Q.fresh('tessik'); const res = {};
      Q.startFight('dc_shrine', 'dc_sentinel');
      const b = g.boss, A = b.A, pl = g.player;
      res.flags = { swing: b.hitA.flags, swingDmg: b.hitA.dmg, shock: b.hitL.flags, shockDmg: b.hitL.dmg };
      res.walk = { gap: b.gap, speed: b.walkSpeed, timer0: b.timer };
      const picks = [], recov = {}; let last = ''; const spots = ['near', 'far', 'mid'];
      for (let f = 0; f < 2600 && picks.length < 15; f++) {
        if (f % 120 === 0) { const sp = spots[Math.floor(f / 120) % 3]; if (sp === 'near') Q.pinAt(b.x + (b.x < A.cx ? 60 : -60), A.floorY); else if (sp === 'far') Q.awayFloor(); else Q.pinAt(b.x + (b.x < A.cx ? 140 : -140), A.floorY); }
        Q.step(1);
        if (b.state === 'tell' && last !== 'tell') picks.push({ atk: b.attack, adx: Math.round(Math.abs(pl.x - b.x)), tell: b.timer });
        if (b.state === 'recover' && last !== 'recover') recov[b.attack] = b.timer;
        last = b.state;
      }
      res.picks = picks; res.recov = recov;
      res.thrice = picks.some((p, i) => i >= 2 && p.atk === picks[i - 1].atk && p.atk === picks[i - 2].atk);
      res.classOk = picks.every(p => (p.adx < 90 ? (p.atk === 'slabSwing' || p.atk === 'stompQuake') : p.adx < 180 ? (p.atk === 'stompQuake' || p.atk === 'stackSlam') : (p.atk === 'discToss' || p.atk === 'stackSlam')));
      d.god(false); Q.takeDrops();
      Q.pinAt(b.x, A.floorY); Q.step(2); res.contact = Q.takeDrops();
      let f = Q.waitTell('slabSwing', 2000, function () { Q.pinAt(b.x + b.facing * 60, A.floorY); });
      if (f >= 0) { while (b.state === 'tell') { Q.pinAt(b.x + b.facing * 60, A.floorY); Q.step(1); } pl.iframes = 0; Q.takeDrops(); for (let i = 0; i < 16; i++) { Q.pinAt(b.x + b.facing * 60, A.floorY); Q.step(1); } res.swing = Q.takeDrops(); }
      f = Q.waitTell('stompQuake', 2000, function () { Q.pinAt(b.x + (b.x < A.cx ? 140 : -140), A.floorY); });
      if (f >= 0) { const side = b.x < A.cx ? 1 : -1; while (b.state === 'tell') { Q.pinAt(b.x + side * 150, A.floorY); Q.step(1); } pl.iframes = 0; Q.takeDrops(); let wv = null; for (let i = 0; i < 60; i++) { Q.pinAt(b.x + side * 150, A.floorY); Q.step(1); const w = g.projectiles.find(p => p.kind === 'wave'); if (w && !wv) wv = { vx: w.vx, w: w.w, h: w.h, life: w.life, flags: w.hit.flags, dmg: w.hit.dmg }; } res.wave = { hits: Q.takeDrops(), wave: wv }; }
      f = Q.waitTell('discToss', 2000, function () { Q.awayFloor(); });
      if (f >= 0) { while (b.state === 'tell') { Q.awayFloor(); Q.step(1); } pl.iframes = 0; Q.takeDrops(); let dsc = null; for (let i = 0; i < 120; i++) { const p = g.projectiles.find(p => p.kind === 'disc' && !p.dead); if (p) { if (!dsc) dsc = { vx: p.vx, vy: p.vy, w: p.w, h: p.h, flags: p.hit.flags, destructible: p.destructible, bounce: p.bounce }; Q.pinAt(p.x, p.y + 10); } Q.step(1); } res.disc = { hits: Q.takeDrops(), disc: dsc }; }
      f = Q.waitTell('stackSlam', 2500, function () { Q.pinAt(b.x + (b.x < A.cx ? 140 : -140), A.floorY); });
      if (f >= 0) { const X = pl.x; const side = b.x < X ? 1 : -1; while (b.state === 'tell') { Q.pinAt(X, A.floorY); Q.step(1); } pl.iframes = 0; Q.takeDrops(); let land = null; for (let i = 0; i < 80; i++) { Q.pinAt(X + side * 80, A.floorY); Q.step(1); if (b.state === 'shock' && !land) land = { bx: b.x, slamX: b.slamX, X }; } res.slam = { hits: Q.takeDrops(), land, recover: b.state === 'recover' ? b.timer : b.state }; }
      d.god(true);
      return res;
    });
    check('I: tallock §8.5 flags: Slab Swing 1 dmg blockable, Stack Slam shock 2 dmg unblockable', r.flags.swing === 0 && r.flags.swingDmg === 1 && r.flags.shock === 1 && r.flags.shockDmg === 2, r.flags);
    check('I: tallock WALK gap 45 f at 1.5 px/f', r.walk.gap === 45 && r.walk.speed === 1.5 && r.walk.timer0 >= 42 && r.walk.timer0 <= 45, r.walk);
    check('I: tallock picks by distance class (< 3 tiles: swing/quake; 3–6: quake/slam; > 6: disc/slam) over 15 picks and never the same attack three times in a row', r.picks.length === 15 && r.classOk && !r.thrice, r.picks);
    check('I: tallock recoveries: swing 40 / quake 50 / disc 30 / slam 60', r.recov.slabSwing === 40 && r.recov.stompQuake === 50 && r.recov.discToss === 30 && r.recov.stackSlam === 60, r.recov);
    check('I: tallock (god off) body contact = 1 heart', r.contact.length === 1 && r.contact[0].dmg === 1 && r.contact[0].tag === 'contact', r.contact);
    check('I: tallock (god off) Slab Swing hits a player 2 tiles in front for 1', !!r.swing && dmgOf(r.swing) === 1 && r.swing[0].tag === 'swing', r.swing);
    check('I: tallock (god off) Stomp Quake wave (30×20, 5 px/f, life 80, unblockable) hits a player 5 tiles away for 1', !!r.wave && dmgOf(r.wave.hits) === 1 && r.wave.hits[0].tag === 'wave' && !!r.wave.wave && Math.abs(r.wave.wave.vx) === 5 && r.wave.wave.w === 30 && r.wave.wave.h === 20 && r.wave.wave.flags === 1, r.wave);
    check('I: tallock (god off) Disc (30×10, 4.5 px/f, vy −4, bounce ×0.6, destructible) hits for 1', !!r.disc && r.disc.hits.length >= 1 && r.disc.hits[0].dmg === 1 && r.disc.hits[0].tag === 'disc' && !!r.disc.disc && Math.abs(r.disc.disc.vx) === 4.5 && r.disc.disc.bounce === 0.6 && r.disc.disc.destructible && r.disc.disc.flags === 2, r.disc);
    check('I: tallock (god off) Stack Slam lands within 30 px of the recorded x; its landing shock (40×30 beside the body) hits a player 80 px from the landing on the far side for 2', !!r.slam && !!r.slam.land && Math.abs(r.slam.land.bx - r.slam.land.slamX) <= 30 && dmgOf(r.slam.hits) === 2 && r.slam.hits[0].tag === 'shock', r.slam);
    // ---- Weftyr
    r = await ev((d, g, Q) => {
      Q.fresh('tessik'); const res = {};
      Q.startFight('lw_rest', 'lw_weftyr');
      const b = g.boss, A = b.A, pl = g.player;
      res.flags = { spin: b.hitSpin.flags, spinDmg: b.hitSpin.dmg };
      const seq = []; let last = '', cruiseT = null;
      for (let f = 0; f < 2400 && seq.length < 10; f++) {
        Q.pinAt(A.cx, A.floorY); Q.step(1);
        if (b.state === 'cruise' && last !== 'cruise') cruiseT = b.timer;
        if (Q.isTell(b) && !Q.isTell({ state: last }) && b.state !== 'retell') seq.push(b.attack);
        last = b.state;
      }
      res.seq = seq; res.cruiseT = cruiseT;
      let sn = null; for (let f = 0; f < 1500 && !sn; f++) { Q.pinAt(A.cx, A.floorY); Q.step(1); sn = g.projectiles.find(p => p.kind === 'snare') || null; }
      if (sn) res.snare = { top: sn.y - sn.h, bottom: sn.y, w: sn.w, life: sn.life, floorY: A.floorY, playerTop: pl.y - pl.h, standingOverlaps: (pl.y - pl.h) < sn.y && pl.y > sn.y - sn.h, flags: sn.hit.flags, multi: sn.hit.multi };
      d.god(false); Q.takeDrops();
      if (sn && !sn.dead) { for (let i = 0; i < 5; i++) { Q.pinAt(A.cx, sn.y + 24); Q.step(1); } res.snareHit = Q.takeDrops(); }
      // the Snare Line lies at knee height (DESIGN §8.2) and a Thread Dash often runs while one is up: pop it so the
      // standing player's only hit here is the dash's body contact
      const noSnare = function () { for (const p of g.projectiles) if (p.kind === 'snare' && !p.dead) p.dead = true; };
      let f = Q.waitState('dash', 2000, function () { noSnare(); Q.pinAt(A.cx, A.floorY); });
      if (f >= 0) { noSnare(); pl.iframes = 0; Q.takeDrops(); let maxVx = 0; const yAt = b.y; while (b.state === 'dash') { noSnare(); Q.pinAt(A.cx, A.floorY); maxVx = Math.max(maxVx, Math.abs(b.vx)); Q.step(1); } res.dash = { hits: Q.takeDrops(), speed: maxVx, bodyTop: yAt - b.h, playerTop: A.floorY - pl.h, recover: b.state === 'recover' ? b.timer : b.state }; }
      f = Q.waitTell('rain', 2500, function () { Q.pinAt(A.cx, A.floorY); });
      if (f >= 0) { const mx = b.marks[0]; while (b.state === 'tell') { Q.pinAt(mx, A.floorY); Q.step(1); } pl.iframes = 0; Q.takeDrops(); let nd = null, n = 0, stuck = null; for (let i = 0; i < 120; i++) { Q.pinAt(mx, A.floorY); Q.step(1); const ns = g.projectiles.filter(p => p.kind === 'needle'); n = Math.max(n, ns.length); if (ns[0] && !nd) nd = { vy: ns[0].vy, w: ns[0].w, h: ns[0].h, flags: ns[0].hit.flags, destructible: ns[0].destructible }; const st = ns.find(p => p.stuck); if (st && !stuck) stuck = { life: st.life, flags: st.hit.flags, multi: st.hit.multi }; } res.rain = { hits: Q.takeDrops(), needles: n, needle: nd, stuck }; }
      f = Q.waitState('spin', 2500, function () { Q.pinAt(A.cx, A.floorY); });
      if (f >= 0) { pl.iframes = 0; Q.takeDrops(); const x0 = b.x; while (b.state === 'spin') { Q.pinAt(b.x + 60, A.floorY); Q.step(1); } res.spin = { hits: Q.takeDrops(), moved: Math.abs(b.x - x0), recover: b.state === 'recover' ? b.timer : b.state }; }
      d.god(true);
      b.hp = 55; Q.hitBoss(30); Q.step(60);
      let retell = null, passes = 0, tail = -1; last = '';
      for (let f2 = 0; f2 < 2500 && tail !== 0; f2++) { Q.pinAt(A.cx, A.floorY); Q.step(1); if (b.state === 'retell' && last !== 'retell') { retell = b.timer; passes = 1; tail = 60; } if (b.state === 'dash' && last !== 'dash' && retell !== null) passes++; if (tail > 0) tail--; last = b.state; }
      res.enrage = { retell, passes, cruise: b.cruise, needles: b.needles };
      let sn2 = null; for (let f3 = 0; f3 < 1500 && !sn2; f3++) { Q.pinAt(A.cx, A.floorY); Q.step(1); sn2 = g.projectiles.find(p => p.kind === 'snare' && !p.dead) || null; }
      const projBefore = g.projectiles.filter(p => !p.dead).length;
      b.hp = 1; const h = Q.hitBoss(60); Q.step(3);
      res.deathPop = { projBefore, projAfter: g.projectiles.filter(p => !p.dead).length, fight: g.bossFight.state, killed: !h.failed };
      return res;
    });
    {
      const cyc = ['dash', 'snare', 'rain', 'dash', 'spin']; let i = cyc.indexOf(r.seq[0]), ok = i >= 0, prev = null;
      for (const a of r.seq) { if (a === 'dash' && prev === 'snare') { prev = a; continue; } if (a === 'dash' && prev === 'dash') { prev = a; continue; } if (a !== cyc[i % 5]) { ok = false; break; } i++; prev = a; }
      check('I: weftyr follows the fixed cycle dash → snare → rain → dash → spin (only Thread Dash while a snare exists): ' + r.seq.join(','), ok && r.seq.length >= 8, r.seq);
    }
    check('I: weftyr CRUISEs 40 f between attacks', r.cruiseT !== null && r.cruiseT >= 38 && r.cruiseT <= 40, r.cruiseT);
    check('I: weftyr Snare Line: 8 px tall, 240 f, unblockable multi-hit, spans the arena', !!r.snare && r.snare.bottom - r.snare.top === 8 && r.snare.life >= 170 && r.snare.flags === 1 && r.snare.multi && r.snare.w >= 1000, r.snare);
    check('I: weftyr Snare Line blocks GROUND movement (DESIGN §8.2: "The line blocks ground movement across the arena: jump it or use the grates") — a standing player on the floor overlaps it', !!r.snare && r.snare.standingOverlaps, r.snare);
    info('weftyr snare geometry: thread y ' + (r.snare && r.snare.top) + '–' + (r.snare && r.snare.bottom) + ', floor ' + (r.snare && r.snare.floorY) + ', a standing Tessik spans ' + (r.snare && r.snare.playerTop) + '–' + (r.snare && r.snare.floorY) + ' (the thread is ' + (r.snare && (r.snare.floorY - r.snare.bottom)) + ' px above the floor: it is only hit by a JUMPING player)');
    check('I: weftyr (god off) the Snare Line hurts a player at its height for 1', !!r.snareHit && dmgOf(r.snareHit) === 1 && r.snareHit[0].tag === 'snare', r.snareHit);
    check('I: weftyr (god off) Thread Dash at 12 px/f hits a standing player for 1 (body contact) and recovers 36 f', !!r.dash && dmgOf(r.dash.hits) === 1 && r.dash.speed === 12 && r.dash.bodyTop < r.dash.playerTop && r.dash.recover === 36, r.dash);
    check('I: weftyr (god off) a falling needle (8×24, 7 px/f, destructible) hits for 1; six needles; a stuck needle is a 90 f unblockable hazard', !!r.rain && dmgOf(r.rain.hits) === 1 && r.rain.needles >= 6 && !!r.rain.needle && r.rain.needle.vy === 7 && r.rain.needle.w === 8 && r.rain.needle.h === 24 && r.rain.needle.destructible && (!r.rain.stuck || (r.rain.stuck.life <= 90 && r.rain.stuck.flags === 1 && r.rain.stuck.multi)), r.rain);
    check('I: weftyr (god off) Spool Spin hits a player beside it for 1, drifts 2 px/f × 60 f, recovers 60 f', !!r.spin && dmgOf(r.spin.hits) === 1 && r.spin.hits[0].tag === 'spin' && Math.abs(r.spin.moved - 120) <= 6 && r.spin.recover === 60, r.spin);
    check('I: weftyr enraged: Thread Dash double pass with a 15 f re-tell, cruise 4.5, nine needles', r.enrage.retell === 15 && r.enrage.passes >= 2 && r.enrage.cruise === 4.5 && r.enrage.needles === 9, r.enrage);
    check('I: weftyr: a dead boss\'s shots (snare line) pop at once', r.deathPop.killed && r.deathPop.projBefore >= 1 && r.deathPop.projAfter === 0 && r.deathPop.fight === 'dying', r.deathPop);
    // ---- Corrosant
    r = await ev((d, g, Q) => {
      Q.fresh('tessik'); const res = {};
      Q.startFight('bv_rest', 'bv_corrosant');
      const b = g.boss, A = b.A, pl = g.player;
      res.flags = { sweep: b.hitBody.flags, flood: b.hitFlood.flags };
      // head ×1.5 vs segment ×1: freeze the boss after a Coil Sweep (the body stretched along the floor); down-strikes pinned above
      let f = -1; for (let i = 0; i < 6000; i++) { Q.pinAt(A.cx, 11 * 30); Q.step(1); if (b.state === 'recover' && b.plan === 'sweep') { f = i; break; } }
      if (f >= 0) {
        const origUpd = b.update; b.update = function () { this.t++; if (this.flash > 0) this.flash--; }; Q.step(2);
        const segs = g.enemies.filter(e => e.type === 'bossSegment').map(s => ({ i: s.index, dx: Math.round(s.x - b.x), dy: Math.round(s.y - b.y) }));
        const dir = segs[0].dx < 0 ? 1 : -1;   // the head faces away from its segments
        res.geom = { head: { x: Math.round(b.x), y: Math.round(b.y), w: b.w, h: b.h }, seg0: segs[0], dir };
        // (1) a down-strike box over the head's FRONT half only (segment 0 sits at hx−39..hx−9 behind the head centre)
        res.headOnly = Q.attackBossAt(b.x + dir * 12, b.y - 45, dir, 'down', 10); res.headOnly.down = true;
        // (2) a down-strike box over the head's back half + segment 0
        res.headAndSeg = Q.attackBossAt(b.x - dir * 20, b.y - 45, dir, 'down', 40); res.headAndSeg.down = true;
        // (3) a light from behind over segments 1–2 only
        const s2 = g.enemies.find(e => e.type === 'bossSegment' && e.index === 2);
        if (s2) res.segOnly = Q.attackBossAt(s2.x - dir * 60, A.floorY, dir, 'light', 40);
        b.update = origUpd;
      }
      Q.pinAt(A.cx, 11 * 30); Q.step(12);   // let the hitstop of the last hit lapse
      d.god(false); Q.takeDrops();
      const seg = g.enemies.find(e => e.type === 'bossSegment' && e.index === 3);
      if (seg) { pl.iframes = 0; for (let i = 0; i < 6; i++) { Q.pinAt(seg.x, seg.y); Q.step(1); } res.segContact = Q.takeDrops(); }
      f = Q.waitState('lunge', 3000, function () { Q.pinAt(A.cx, A.floorY); });
      if (f >= 0) { pl.iframes = 0; Q.takeDrops(); const x0 = b.lungeX0, dir = b.lungeDir; for (let i = 0; i < 40 && b.state === 'lunge'; i++) { Q.pinAt(x0 + dir * 150, b.y + 10); Q.step(1); } res.lunge = { hits: Q.takeDrops(), lungeMax: b.lungeMax, contact: 2 }; Q.pinAt(A.cx, A.floorY); }
      f = Q.waitTell('spit', 3000, function () { Q.pinAt(A.cx, A.floorY); });
      if (f >= 0) { while (b.state === 'tell') { Q.pinAt(A.cx, A.floorY); Q.step(1); } pl.iframes = 0; Q.takeDrops(); let gl = null; for (let i = 0; i < 120; i++) { const p = g.projectiles.find(p => p.kind === 'glob' && !p.dead); if (p) { if (!gl) gl = { vx: p.vx, vy: p.vy, grav: p.grav, puddleW: p.puddleW, puddleLife: p.puddleLife, n: g.projectiles.filter(q => q.kind === 'glob').length }; Q.pinAt(p.x, p.y + 10); } else Q.pinAt(A.cx, A.floorY); Q.step(1); } const globHits = Q.takeDrops(); const pud = g.projectiles.find(p => p.kind === 'puddle' && !p.dead); let pudHits = [], pw = null; if (pud) { pw = { w: pud.w, h: pud.h, life: pud.life }; pl.iframes = 0; for (let i = 0; i < 5; i++) { Q.pinAt(pud.x, pud.y); Q.step(1); } pudHits = Q.takeDrops(); } res.spit = { glob: gl, globHits, puddle: pw, pudHits }; }
      f = Q.waitTell('drip', 3000, function () { Q.pinAt(A.cx, A.floorY); });
      if (f >= 0) { const mx = b.marks[0]; while (b.state === 'tell') { Q.pinAt(mx, A.floorY); Q.step(1); } pl.iframes = 0; Q.takeDrops(); let n = 0, dr = null; for (let i = 0; i < 200; i++) { Q.pinAt(mx, A.floorY); Q.step(1); const ds = g.projectiles.filter(p => p.kind === 'drip' && !p.noHit); n = Math.max(n, ds.length); if (ds[0] && !dr) dr = { vy: ds[0].vy, w: ds[0].w, h: ds[0].h }; } res.drip = { hits: Q.takeDrops(), maxDrips: n, drip: dr, dripI: b.dripI }; }
      f = Q.waitState('sweep', 3000, function () { Q.pinAt(A.cx, A.floorY); });
      if (f >= 0) { pl.iframes = 0; Q.takeDrops(); let sp = 0; while (b.state === 'sweep') { Q.pinAt(A.cx, A.floorY); const xb = b.x; Q.step(1); sp = Math.max(sp, Math.abs(b.x - xb)); } res.sweep = { hits: Q.takeDrops(), speed: sp, recover: b.state === 'recover' ? b.timer : b.state }; }
      d.god(true);
      let pd = null; for (let f3 = 0; f3 < 3000 && !pd; f3++) { Q.pinAt(A.cx, A.floorY); Q.step(1); pd = g.projectiles.find(p => p.kind === 'puddle' && !p.dead) || null; }
      const projBefore = g.projectiles.filter(p => !p.dead).length;
      b.hp = 1; const h = Q.hitBoss(80); Q.step(3);
      res.deathPop = { projBefore, projAfter: g.projectiles.filter(p => !p.dead).length, fight: g.bossFight.state, killed: !h.failed };
      Q.step(130); res.segsAfter = g.enemies.filter(e => e.type === 'bossSegment' && !e.dead).length;
      return res;
    });
    check('I: corrosant §8.5 flags: Coil Sweep and Flood unblockable', r.flags.sweep === 1 && r.flags.flood === 1, r.flags);
    check('I: corrosant a hit on the head ALONE deals ×1.5 (Tessik down-strike 4 → 6)', !!r.headOnly && r.headOnly.dmg === 6, { headOnly: r.headOnly, geom: r.geom });
    check('I: corrosant a hit on the head that also touches segment 0 still deals the head ×1.5 (DESIGN §8.3 "hits on the head deal ×1.5"; segment 0 sits inside the head\'s 50 px hit box at 24 px spacing)', !!r.headAndSeg && r.headAndSeg.dmg === 6, { headAndSeg: r.headAndSeg, geom: r.geom });
    check('I: corrosant a hit on a body segment deals ×1 (light 3)', !!r.segOnly && r.segOnly.dmg === 3, r.segOnly);
    check('I: corrosant (god off) a body segment is 1 contact', !!r.segContact && dmgOf(r.segContact) === 1 && r.segContact[0].tag === 'contact', r.segContact);
    check('I: corrosant (god off) the lunging head is 2 contact, lunge ≤ 14 tiles', !!r.lunge && dmgOf(r.lunge.hits) === 2 && r.lunge.lungeMax <= 420, r.lunge);
    check('I: corrosant (god off) Acid Spit: 3 globs (vx −3/0/+3, vy 2, g 0.2) hit for 1 and leave 2-tile puddles (60×6, 180 f) that hit for 1 without a respawn', !!r.spit && !!r.spit.glob && r.spit.glob.n === 3 && r.spit.glob.grav === 0.2 && r.spit.glob.puddleW === 60 && r.spit.glob.puddleLife === 180 && dmgOf(r.spit.globHits) === 1 && !!r.spit.puddle && r.spit.puddle.w === 60 && dmgOf(r.spit.pudHits) === 1 && r.spit.pudHits[0].mode === 'normal', r.spit);
    check('I: corrosant (god off) Ceiling Drip: ten drips (6×12, 6 px/f) hit for 1 each', !!r.drip && r.drip.maxDrips >= 6 && r.drip.dripI === 10 && !!r.drip.drip && r.drip.drip.vy === 6 && r.drip.hits.length >= 1 && r.drip.hits.every(h => h.dmg === 1 && h.tag === 'drip'), r.drip);
    check('I: corrosant (god off) Coil Sweep at 5 px/f hits a player on the floor for 1, recovers 50 f', !!r.sweep && dmgOf(r.sweep.hits) === 1 && r.sweep.speed === 5 && r.sweep.recover === 50, r.sweep);
    check('I: corrosant: a dead boss\'s puddles/globs pop at once and the segments die with it', r.deathPop.killed && r.deathPop.projBefore >= 1 && r.deathPop.projAfter === 0 && r.segsAfter === 0, r);
    // ---- Kernauth
    r = await ev((d, g, Q) => {
      Q.fresh('tessik'); const res = {};
      Q.startFight('rw_rest', 'rw_throne');
      const b = g.boss, A = b.A, pl = g.player;
      res.flags = { cable: b.hitCable.flags, spike: b.hitSpikes[0].flags, shock: b.hitShock.flags, shockDmg: b.hitShock.dmg, beam: b.hitBeam.flags, beamMulti: b.hitBeam.multi, tail: b.hitTail[0].flags };
      res.mass = Q.attackBossAt(b.x - 75 - 24, b.y, 1, 'light');   // L1 on the mass: ×0.5 → 1
      // a side air attack at the core's height (rows 16-17, the 60 px band of the mass) deals ×1 → 3, from just inside the
      // body edge and from outside it (DESIGN §8.4: a plain jump's apex puts every fighter's light box on it)
      res.coreOverlap = Q.attackBossAt(b.x - 75 - 11 + 10, b.y - 120 + 24, 1, 'light');
      res.coreOverlap.bodyOverlap = window.UB.Entity.overlap(pl, b);
      res.coreOutside = Q.attackBossAt(b.x - 75 - 11 - 2, b.y - 120 + 24, 1, 'light');
      res.coreOutside.bodyOverlap = window.UB.Entity.overlap(pl, b);
      d.god(false); Q.takeDrops();
      const left = A.x0 + 200;
      let f = Q.waitTell('cableSweep', 2000, function () { Q.pinAt(left, A.floorY); });
      if (f >= 0) { const side = b.cableSide; while (b.state === 'tell') { Q.pinAt(b.x + side * 220, A.floorY); Q.step(1); } pl.iframes = 0; Q.takeDrops(); let tipMax = 0; for (let i = 0; i < 160 && b.state !== 'recover'; i++) { Q.pinAt(b.x + side * 220, A.floorY); Q.step(1); tipMax = Math.max(tipMax, Math.abs(b.cableTip - b.x)); } res.cable = { hits: Q.takeDrops(), tipMax, reach: Math.min(A.x1 - b.x, b.x - A.x0) }; }
      f = Q.waitTell('rootSpikes', 2500, function () { Q.pinAt(left, A.floorY); });
      if (f >= 0) { const sx = b.spots[0], spots = Array.from(b.spots); while (b.state === 'tell') { Q.pinAt(sx, A.floorY); Q.step(1); } pl.iframes = 0; Q.takeDrops(); for (let i = 0; i < 20; i++) { Q.pinAt(sx, A.floorY); Q.step(1); } let minGap = 1e9; for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) minGap = Math.min(minGap, Math.abs(spots[i] - spots[j])); res.spikes = { hits: Q.takeDrops(), minGap, onPlayer: Math.abs(sx - left) < 30 }; }
      f = Q.waitTell('orbitalFlare', 3000, function () { Q.pinAt(left, A.floorY); });
      if (f >= 0) { while (b.state === 'tell') { Q.pinAt(left, A.floorY); Q.step(1); } pl.iframes = 0; Q.takeDrops(); let n = 0, ob = null; for (let i = 0; i < 120; i++) { const os = g.projectiles.filter(p => p.kind === 'orb' && !p.dead); n = Math.max(n, os.length); if (os[0]) { if (!ob) ob = { w: os[0].w, life: os[0].life, flags: os[0].hit.flags, destructible: os[0].destructible }; Q.pinAt(os[0].x, os[0].y + 10); } else Q.pinAt(left, A.floorY); Q.step(1); } res.orbs = { hits: Q.takeDrops(), n, orb: ob }; }
      let motesMax = 0; for (let f2 = 0; f2 < 3000; f2++) { Q.pinAt(left, A.floorY); Q.step(1); const n = g.enemies.filter(e => e.type === 'mote' && !e.dead).length; motesMax = Math.max(motesMax, n); if (b.state === 'tell' && b.attack === 'summon' && b.motes >= 4) break; }
      res.motesMax = motesMax; for (const m of g.enemies) if (m.type === 'mote') m.dead = true; Q.step(2);
      b.hp = 1; d.god(true); Q.hitBoss(40, function () { return b.phase === 2; }); d.god(false); Q.takeDrops();
      let trans = 0; while (b.state === 'transition') { Q.pinAt(b.x, b.y); Q.step(1); trans++; }
      res.transition = { frames: trans, hits: Q.takeDrops(), throneHidden: !!(g.level.hiddenProps && Object.keys(g.level.hiddenProps).length) };
      const cx = A.cx;
      f = Q.waitState('hover', 600, function () { Q.pinAt(cx, A.floorY); });
      if (f >= 0) { pl.iframes = 0; Q.takeDrops(); for (let i = 0; i < 20 && b.state === 'hover'; i++) { Q.pinAt(b.tailX[2], b.tailY[2] + 24); Q.step(1); } res.tail = Q.takeDrops(); }
      f = Q.waitState('dive', 2500, function () { Q.pinAt(cx, A.floorY); });
      // after the dive: step until the 10 f shock ends (the shock's own 6 f hurt hitstop on the player beside the impact freezes the
      // boss too, so a fixed 12-step wait can still be inside the shock) and read the recovery timer on its first frame
      if (f >= 0) { const lx = b.lockX; pl.iframes = 0; Q.takeDrops(); let sp = 0; while (b.state === 'dive') { const xb = b.x, yb = b.y; Q.pinAt(lx + 42, A.floorY); Q.step(1); sp = Math.max(sp, Math.hypot(b.x - xb, b.y - yb)); } for (let i = 0; i < 40 && b.state !== 'recover2'; i++) { Q.pinAt(lx + 42, A.floorY); Q.step(1); } res.dive = { hits: Q.takeDrops(), speed: Math.round(sp * 10) / 10, shockW: b.lockX, bodyW: b.w, playerW: pl.w, recover: b.state === 'recover2' ? b.timer : b.state }; }
      f = Q.waitState('beam', 2500, function () { Q.pinAt(cx, A.floorY); });
      if (f >= 0) { pl.iframes = 0; Q.takeDrops(); const by = b.beamY; for (let i = 0; i < 100 && b.state === 'beam'; i++) { Q.pinAt(cx, by + 24); Q.step(1); } res.beam = { hits: Q.takeDrops(), h: b.hitBeam.h, w: b.hitBeam.w, recover: b.state === 'recover2' ? b.timer : b.state }; }
      f = Q.waitTell('frag', 2500, function () { Q.pinAt(cx, A.floorY); });
      if (f >= 0) { while (b.state === 'tell2') { Q.pinAt(cx, A.floorY); Q.step(1); } pl.iframes = 0; Q.takeDrops(); let n = 0, fr = null; for (let i = 0; i < 60; i++) { const fs = g.projectiles.filter(p => p.kind === 'frag' && !p.dead && Math.hypot(p.x - b.x, p.y - b.y) > 110); n = Math.max(n, g.projectiles.filter(p => p.kind === 'frag' && !p.dead).length); if (fs[0]) { if (!fr) fr = { v: Math.round(Math.hypot(fs[0].vx, fs[0].vy) * 100) / 100, life: fs[0].def.life, w: fs[0].w, flags: fs[0].hit.flags }; Q.pinAt(fs[0].x, fs[0].y + 10); } else Q.pinAt(cx, A.floorY); Q.step(1); } res.frag = { hits: Q.takeDrops(), n, frag: fr }; }
      f = Q.waitState('blinkOut', 2500, function () { Q.pinAt(cx, A.floorY); });
      if (f >= 0) { while (b.state === 'blinkOut') { Q.pinAt(cx, A.floorY); Q.step(1); } const re = { above: pl.y - b.y, tell: b.timer, state: b.state }; while (b.state === 'blinkIn') { Q.pinAt(cx, A.floorY); Q.step(1); } for (const p of g.projectiles) p.dead = true; pl.iframes = 0; Q.takeDrops(); let sp = 0; while (b.state === 'slam') { const yb = b.y; Q.pinAt(b.x + 48, A.floorY); Q.step(1); sp = Math.max(sp, b.y - yb); } for (let i = 0; i < 40 && b.state !== 'recover2'; i++) { Q.pinAt(b.x + 48, A.floorY); Q.step(1); } res.blink = { hits: Q.takeDrops(), reappear: re, slamSpeed: sp, shockW: b.lockX, recover: b.state === 'recover2' ? b.timer : b.state }; }
      d.god(true);
      return res;
    });
    check('I: kernauth §8.5 flags: Cable blockable, Root Spikes / shocks (2 dmg) / Static Beam unblockable, beam + tail multi-tick', r.flags.cable === 0 && r.flags.spike === 1 && r.flags.shock === 1 && r.flags.shockDmg === 2 && r.flags.beam === 1 && r.flags.beamMulti && r.flags.tail === 0, r.flags);
    check('I: kernauth phase 1: a hit on the mass deals ×0.5 (light 3 → 1); a side air attack at the chest core\'s height deals ×1 (3) with the body inside the mass AND from 2 px outside it (no contact needed)', r.mass.dmg === 1 && r.coreOverlap.dmg === 3 && r.coreOverlap.bodyOverlap && r.coreOutside.dmg === 3 && !r.coreOutside.bodyOverlap, { mass: r.mass, coreOverlap: r.coreOverlap, coreOutside: r.coreOutside });
    check('I: kernauth (god off) Cable Sweep extends to the wall at 8 px/f and hits a floor player for 1', !!r.cable && r.cable.hits.length >= 1 && r.cable.hits[0].dmg === 1 && r.cable.hits[0].tag === 'cable' && r.cable.tipMax >= r.cable.reach - 20, r.cable);
    check('I: kernauth (god off) Root Spikes: one spot on the player, all ≥ 3 tiles apart, hit for 1', !!r.spikes && dmgOf(r.spikes.hits) === 1 && r.spikes.hits[0].tag === 'spike' && r.spikes.onPlayer && r.spikes.minGap >= 90, r.spikes);
    check('I: kernauth (god off) Orbital Flare: 3 homing orbs (16 px, 180 f, destructible) hit for 1', !!r.orbs && r.orbs.n === 3 && dmgOf(r.orbs.hits) >= 1 && r.orbs.hits[0].tag === 'orb' && !!r.orbs.orb && r.orbs.orb.w === 16 && r.orbs.orb.destructible, r.orbs);
    check('I: kernauth Summon spawns motes (two per summon) and keeps at most 4 alive', r.motesMax >= 2 && r.motesMax <= 4, r.motesMax);
    check('I: kernauth the player standing inside the boss through the whole phase transition takes no damage (contact 0, no hits); the throne prop is hidden', !!r.transition && r.transition.frames >= 180 && r.transition.hits.length === 0 && r.transition.throneHidden, r.transition);
    check('I: kernauth (god off) phase 2 tail contact = 1', !!r.tail && dmgOf(r.tail) === 1 && r.tail[0].tag === 'tail', r.tail);
    check('I: kernauth (god off) Dive Bomb dives at 13 px/f; a player beside the impact takes damage; recovery 50 f', !!r.dive && r.dive.speed === 13 && dmgOf(r.dive.hits) >= 1 && r.dive.recover >= 48 && r.dive.recover <= 50, r.dive);
    check('I: kernauth Dive Bomb: the 2-damage impact shock (90 px) is wider than the body (70 px) by at least a player width on each side, so the shock can hit a player the body does not', !!r.dive && (r.dive.shockW - r.dive.bodyW) / 2 >= r.dive.playerW, r.dive);
    if (r.dive) info('kernauth dive: shock 90 px vs body 70 px → a 10 px band per side; the player beside the impact took ' + JSON.stringify(r.dive.hits.map(h => h.tag + ' ' + h.dmg)));
    check('I: kernauth (god off) Static Beam (20 px tall, full width) hits a player at its height for 1, recovery 40 f', !!r.beam && dmgOf(r.beam.hits) === 1 && r.beam.hits[0].tag === 'beam' && r.beam.h === 20 && r.beam.w >= 1800 && r.beam.recover === 40, r.beam);
    check('I: kernauth (god off) Fragment Burst: 8 fragments at 3.5 px/f (life 120, destructible) hit for 1', !!r.frag && r.frag.n === 8 && !!r.frag.frag && r.frag.frag.v === 3.5 && r.frag.frag.life === 120 && r.frag.hits.length >= 1 && r.frag.hits[0].dmg === 1 && r.frag.hits[0].tag === 'frag', r.frag);
    check('I: kernauth (god off) Blink Slam reappears 5 tiles (150 px) above the player with a 20 f tell, slams at 14 px/f, the 120 px shock hits a player beside the body for 2, recovery 45 f', !!r.blink && r.blink.reappear.above === 150 && r.blink.reappear.tell === 20 && r.blink.slamSpeed === 14 && r.blink.shockW === 120 && dmgOf(r.blink.hits) === 2 && r.blink.hits[0].tag === 'shock' && r.blink.recover >= 43 && r.blink.recover <= 45, r.blink);
    // I: can any fighter hit Kernauth's chest core with a side air attack from a plain jump WITHOUT overlapping the mass? (DESIGN §8.4: "a plain jump's apex puts every fighter's light box on it")
    r = await ev((d, g, Q) => {
      const out = {};
      for (const id of ['tessik', 'brackmaw', 'vellix', 'orrubel', 'korvask']) {
        Q.fresh(id); Q.startFight('rw_rest', 'rw_throne');
        const b = g.boss, A = b.A, pl = g.player, E = window.UB.Entity;
        const air = pl.data.moves.air; const edge = b.x - b.w / 2;
        let bestOff = null, bestOverlap = null, half = null;
        for (let off = 30; off >= -14; off -= 4) {
          const px = edge - pl.w / 2 - off;
          Q.pinAt(px, A.floorY); Q.step(20); Q.pin = null; pl.facing = 1; pl.vx = 0;
          const hp0 = b.hp; let ov = false, dmg = 0;
          d.pressed('jump', 12);
          for (let i = 0; i < 60; i++) { pl.x = px; pl.vx = 0; if (i === 18) d.pressed('light', 2); d.step(1); if (b.hp < hp0 && !dmg) { dmg = hp0 - b.hp; ov = E.overlap(pl, b); } }
          if (dmg === air.dmg) { bestOff = off; bestOverlap = ov; break; }
          if (dmg) half = { off, dmg };
          for (let i = 0; i < 30; i++) d.step(1);
        }
        out[id] = { airBox: air.box, airDmg: air.dmg, firstFullOff: bestOff, bodyOverlap: bestOverlap, halfExample: half };
      }
      return out;
    });
    for (const id of Object.keys(r)) info('kernauth core reach ' + id + ': ' + JSON.stringify(r[id]));
    check('I: kernauth at least one fighter reaches the chest core (×1) with a side air attack from a plain jump without the body overlapping the mass (contact damage)', Object.values(r).some(v => v.firstFullOff !== null && v.bodyOverlap === false), r);

    // ---------------------------------------------------------------- J: flows — the player dies during the boss death animation
    r = await ev((d, g, Q) => {
      Q.fresh('tessik'); Q.startFight('dc_shrine', 'dc_sentinel');
      const b = g.boss; b.hp = 1; Q.hitBoss(30); Q.pin = null;
      const st0 = g.bossFight.state; Q.step(20); d.god(false); d.setHp(0);
      let s = d.state(); for (let i = 0; i < 400 && s.screen !== 'gameover'; i++) { d.step(1); s = d.state(); }
      const atGameOver = { screen: s.screen, deaths: s.deaths, bossesDefeated: s.bossesDefeated.slice(), saved: (JSON.parse(localStorage.getItem('underbyte.save') || '{}').bossesDefeated || []) };
      g.respawnAtNode(); for (let i = 0; i < 300; i++) { d.step(1); s = d.state(); if (s.screen === 'play' && !s.busy) break; }
      const afterRespawn = { screen: s.screen, room: s.roomId, hp: s.hp, maxHp: s.maxHp };
      d.god(true); d.warp('dc_sentinel', 'L'); d.step(10); Q.wrapHurt();
      const pk = d.pickups(); s = d.state();
      const m = g.pickups.find(p => p.type === 'ability'); let granted = null;
      if (m) { Q.pinAt(m.x, m.y); Q.step(3); Q.pin = null; for (let i = 0; i < 140 && g.mode === 'pickupSeq'; i++) d.step(1); granted = d.state().abilities; }
      return { st0, atGameOver, afterRespawn, arena: { boss: !!g.boss, fight: s.bossFight, module: pk.find(p => p.type === 'ability') || null, openings: Q.openings(), song: window.UB.Audio.state().song }, granted };
    });
    check('J: dying during Tallock\'s death animation: the defeat is already recorded + saved, game over, respawn at the node with full hp', r.st0 === 'dying' && r.atGameOver.screen === 'gameover' && r.atGameOver.bossesDefeated.includes('tallock') && r.atGameOver.saved.includes('tallock') && r.afterRespawn.screen === 'play' && r.afterRespawn.hp === r.afterRespawn.maxHp, r);
    check('J: the arena then reloads without a boss or re-fight, doors open, zone music, with the module waiting at (20,14); collecting it grants Echo Jump', !r.arena.boss && r.arena.fight === 'none' && r.arena.openings.every(o => !o.sealed) && r.arena.song === 'driftcache' && !!r.arena.module && Math.abs(r.arena.module.x - 615) < 1 && !!r.granted && r.granted.echoJump, r);

    // ---------------------------------------------------------------- K: fairness — Tessik vs Tallock, god OFF, 60 s
    const bot = (mode) => ev((d, g, Q, mode) => {
      const In = window.UB.Input;
      Q.fresh('tessik');
      d.warp('dc_shrine', null); d.step(2); d.warp('dc_sentinel', 'L'); d.step(155);
      d.god(false); g.player.hp = g.player.maxHp;
      // game.rng is one stream per page: give the fight its own fixed seed (the engine's fresh-page seed) so the bot's
      // 60 s sample does not shift with every probe that ran before it
      g.rng = window.UB.Util.rng(0x5EED);
      const pl = g.player, b = g.boss, A = b.A;
      const hurts = []; const origHurt = pl.hurt; let fr = 0;
      pl.hurt = function (dmg, fromX, opts) { const took = origHurt.call(this, dmg, fromX, opts); if (took) hurts.push({ f: fr, dmg, tag: opts && opts.hit ? opts.hit.tag : 'contact', st: b.state, atk: b.attack, bt: b.timer, dx: Math.round(b.x - pl.x), cornered: Math.min(pl.x - A.x0, A.x1 - pl.x) < 120 }); return took; };
      let dealt = 0, lastHp = b.hp, lights = 0, jumps = 0, crosses = 0; const tells = {}; let prev = '', slamSeen = false, takeoffX = 0, crossDir = 0;
      const L = A.x0 + 40, R = A.x1 - 40;
      for (fr = 0; fr < 3600; fr++) {
        if (!g.boss || g.bossFight.state !== 'fight' || pl.dead) break;
        const dx = b.x - pl.x, adx = Math.abs(dx), side = dx > 0 ? 1 : -1;
        const st = b.state, atk = b.attack;
        if (st === 'tell' && prev !== 'tell') { if (!tells[atk]) tells[atk] = { min: 1e9, n: 0 }; tells[atk].n++; tells[atk].min = Math.min(tells[atk].min, b.timer); }
        let move = 0, jump = false, light = false;
        const roomBehind = side > 0 ? pl.x - L : R - pl.x;
        let threat = false;
        for (const p of g.projectiles) { if (p.dead) continue; const pdx = p.x - pl.x; const approaching = (p.vx > 0 && pdx < 0) || (p.vx < 0 && pdx > 0); if (approaching && Math.abs(pdx) < 90) threat = true; }
        if (mode === 'crossing' && st === 'slam') {   // run under the arc toward the take-off point (the only way past a 120 px boss)
          if (!slamSeen) { slamSeen = true; takeoffX = b.x; crossDir = takeoffX > pl.x ? 1 : -1; crosses++; }
          move = crossDir;
        } else {
          slamSeen = false;
          if (mode === 'naive' && st === 'slam') move = pl.x < b.slamX ? -1 : 1;   // keep distance from the landing spot
          else if (st === 'shock') { if (adx < 130 && roomBehind > 20) move = -side; }
          else if (st === 'recover' || st === 'tossWait') { if (b.timer > 16) { if (adx > 88) move = side; else if (adx < 74) move = -side; else light = (fr % 5) === 0; } else move = roomBehind > 40 ? -side : 0; }
          else if (st === 'tell') { if (mode === 'naive' && prev !== 'tell' && pl.onGround) jump = true; if (atk === 'slabSwing') { if (adx < 118 && roomBehind > 20) move = -side; } else if (atk === 'stompQuake') { if (adx < 80 && roomBehind > 20) move = -side; } }
          else if (st === 'swing') { if (adx < 118 && roomBehind > 20) move = -side; }
          else { if (adx < 135 && roomBehind > 30) move = -side; else if (adx > 210) move = side; }
        }
        if (pl.state === 'attack') move = 0;
        if (mode === 'crossing' && threat && pl.onGround) jump = true;
        if (jump) jumps++;
        if (move < 0 && pl.x < L) move = 0; if (move > 0 && pl.x > R) move = 0;
        if (move < 0) In.press('left', 1); else if (move > 0) In.press('right', 1);
        if (jump) In.press('jump', 1);
        if (light) { In.press('light', 1); lights++; }
        prev = st; d.step(1);
        if (b.hp < lastHp) { dealt += lastHp - b.hp; lastHp = b.hp; }
      }
      pl.hurt = origHurt; d.god(true);
      const tl = {}; for (const k in tells) tl[k] = { minTell: tells[k].min, n: tells[k].n };
      return { mode, frames: fr, heartsLeft: pl.hp, maxHp: pl.maxHp, dead: pl.dead, heartsLost: hurts.reduce((s, h) => s + h.dmg, 0), hurts, dealt, bossHp: b.hp, lights, jumps, crosses, tells: tl, enraged: !!b.enraged };
    }, mode);
    const naive = await bot('naive');
    info('fairness NAIVE bot (keep distance, jump at every wind-up, hit the recovery; never crosses under the boss), Tessik vs Tallock, god off: survived ' + Math.round(naive.frames / 60) + ' s, hearts lost ' + naive.heartsLost + '/' + naive.maxHp + (naive.dead ? ' (DIED)' : '') + ', damage dealt ' + naive.dealt + '/120, hits taken ' + JSON.stringify(naive.hurts));
    const fairness = await bot('crossing');
    info('fairness CROSSING bot (as above + runs under Stack Slams, jumps approaching waves/discs), 60 s: hearts lost ' + fairness.heartsLost + '/' + fairness.maxHp + ', damage dealt ' + fairness.dealt + '/120, crosses ' + fairness.crosses + ', hits taken ' + JSON.stringify(fairness.hurts) + ', tells ' + JSON.stringify(fairness.tells));
    check('F: a simple scripted Tessik that crosses under Stack Slams survives 60 s against Tallock with god off (lost ' + fairness.heartsLost + ' hearts)', !fairness.dead && fairness.frames >= 3600 && fairness.heartsLost <= 4, fairness);
    check('F: the scripted player lands damage in the punish windows (≥ 20 in 60 s; got ' + fairness.dealt + ')', fairness.dealt >= 20, fairness.dealt);
    check('F: every Tallock tell the bots saw is ≥ 20 f', Object.keys(fairness.tells).every(k => fairness.tells[k].minTell >= 20) && Object.keys(naive.tells).every(k => naive.tells[k].minTell >= 20), { crossing: fairness.tells, naive: naive.tells });
    // K: the cornered Slab Swing — with the back to the wall, is there any input that avoids damage (jump timing during the 30 f tell)?
    r = await ev((d, g, Q) => {
      Q.fresh('tessik'); Q.startFight('dc_shrine', 'dc_sentinel');
      const b = g.boss, A = b.A, pl = g.player;
      const results = [];
      for (let k = -1; k <= 28; k += 3) {
        b.state = 'walk'; b.timer = 45; b.attack = ''; b.last1 = 0; b.last2 = 0; b.x = A.x0 + 11 + 150; b.px = b.x; b.vx = 0; b.y = A.floorY; b.py = b.y; b.facing = -1;
        d.teleport(A.x0 + 11, A.floorY); d.step(1); pl.iframes = 0; pl.hp = pl.maxHp; d.god(false);
        let got = false, hurt = null, jumped = false, apexY = 1e9, swings = 0;
        for (let i = 0; i < 900 && !got; i++) {
          if (pl.onGround) { pl.x = A.x0 + 11; pl.vx = 0; }
          if (b.state === 'tell' && b.attack === 'slabSwing') { const tf = 30 - b.timer; if (k >= 0 && tf === k && !jumped) { d.pressed('jump', 14); jumped = true; } }
          if (b.state === 'tell' && b.attack !== 'slabSwing') { b.state = 'walk'; b.timer = 1; b.attack = ''; }
          const hp0 = pl.hp; d.step(1);
          if (jumped) apexY = Math.min(apexY, pl.y);
          if (b.state === 'swing' && b.timer === 12) swings++;
          if (b.state === 'recover' && b.attack === 'slabSwing') got = true;
          if (pl.hp < hp0 && !hurt) hurt = { tag: Q.lastTag, st: b.state, dx: Math.round(b.x - pl.x), ply: Math.round(pl.y) };
          pl.hp = pl.maxHp;
        }
        d.god(true);
        results.push({ jumpAt: k, hurt, apex: jumped ? Math.round(A.floorY - apexY) : null, got });
      }
      return results;
    });
    info('cornered Slab Swing (Tessik with the back to the wall, boss walks in and swings; jump k frames into the 30 f tell): ' + JSON.stringify(r.map(x => ({ jumpAt: x.jumpAt, hurt: x.hurt && (x.hurt.tag + '@' + x.hurt.st) }))));
    check('K: a cornered player has some way to avoid the Slab Swing without taking damage (DESIGN §8.1 "step behind it during the swing")', r.some(x => x.got && !x.hurt), r);

    // ================================================================ L: ROUND 3 — enemies in the real rooms, deeper
    // L1: kill sweep — every placement dies to lights; after every hit (hitstun + knockback) it never embeds or leaves the room
    r = await ev((d, g, Q) => {
      const out = [];
      for (const room of ['dc_wake', 'dc_fall', 'dc_cross', 'dc_loft', 'lw_hoist', 'lw_belts', 'lw_shaft', 'bv_sluice', 'bv_cistern', 'bv_catwalk', 'ns_base', 'ns_climb', 'ns_plunge', 'rw_gate']) {
        Q.enter(room, null);
        const list = g.enemies.slice();
        for (const e of list) {
          if (e.type === 'mote' || e.type === 'bossSegment') continue;
          // a fresh room for every enemy (the others are removed so they never eat the lights)
          Q.enter(room, null);
          const ee = g.enemies.find(x => x.type === e.type && Math.abs(x.spawnX - e.spawnX) < 1 && Math.abs(x.spawnY - e.spawnY) < 1); if (!ee) { out.push({ room, type: e.type, missing: true }); continue; }
          for (const o of g.enemies) if (o !== ee) o.dead = true;
          g.player.hp = g.player.maxHp;
          const k = Q.killWatch(ee, 40);
          k.room = room; k.type = ee.type + (ee.variant ? ':' + ee.variant : ''); k.tile = [Math.floor(ee.spawnX / 30), Math.floor((ee.spawnY - 1) / 30)];
          out.push(k);
        }
      }
      return out;
    });
    for (const k of r) {
      const tag = 'L1: ' + k.room + ' ' + k.type + ' (' + (k.tile || '') + ')';
      if (k.missing) { check(tag + ' present', false, k); continue; }
      check(tag + ' dies to lights (' + k.tries + ' tries), enemiesPurged++, drops ≥ 1 bit', k.dead && k.purgedDelta >= 1 && k.bits >= 1, k);
      check(tag + ' never embedded in a solid tile, outside the room, or NaN while taking hits/knockback', k.stuck === 0 && k.out === 0 && k.nan === 0, { stuck: k.stuck, out: k.out, nan: k.nan, first: k.first });
    }
    // L2: §9.2 drop rates over many kills (deterministic rng, large samples): hearts 12 % + 8 %/missing, sparks 25 % below half energy else 5 %, shards 8 %
    r = await ev((d, g, Q) => {
      const run = function (n, hpMissing, energy) {
        let kills = 0, hearts = 0, sparks = 0, shards = 0;
        for (let i = 0; i < n; i++) {
          Q.enter('dc_wake'); const e = Q.find('scuttlebit'); if (!e) continue;
          g.player.hp = g.player.maxHp - hpMissing; d.setEnergy(energy);
          const k = Q.kill(e); if (!k.dead) continue;
          kills++; for (const p of k.drops) { if (p.type === 'heart') hearts++; else if (p.type === 'spark') sparks++; else if (p.type === 'shard') shards++; }
        }
        g.player.hp = g.player.maxHp; d.setEnergy(100);
        return { kills, heart: hearts / kills, spark: sparks / kills, shard: shards / kills };
      };
      return { miss1: run(240, 1, 100), miss3: run(160, 3, 100), lowE: run(160, 0, 10) };
    });
    check('L2: heart drop rate with 1 heart missing ≈ 20 % (' + (r.miss1.heart * 100).toFixed(1) + ' % of ' + r.miss1.kills + ')', r.miss1.kills >= 230 && r.miss1.heart >= 0.12 && r.miss1.heart <= 0.28, r.miss1);
    check('L2: heart drop rate with 3 hearts missing ≈ 36 % (' + (r.miss3.heart * 100).toFixed(1) + ' % of ' + r.miss3.kills + ')', r.miss3.kills >= 150 && r.miss3.heart >= 0.25 && r.miss3.heart <= 0.47, r.miss3);
    check('L2: spark drop rate at full energy ≈ 5 % (' + (r.miss1.spark * 100).toFixed(1) + ' %), below half energy ≈ 25 % (' + (r.lowE.spark * 100).toFixed(1) + ' %)', r.miss1.spark <= 0.10 && r.lowE.spark >= 0.14 && r.lowE.spark <= 0.37, { full: r.miss1.spark, low: r.lowE.spark });
    check('L2: shard drop rate ≈ 8 % (' + ((r.miss1.shard * r.miss1.kills + r.miss3.shard * r.miss3.kills + r.lowE.shard * r.lowE.kills) / (r.miss1.kills + r.miss3.kills + r.lowE.kills) * 100).toFixed(1) + ' % of ' + (r.miss1.kills + r.miss3.kills + r.lowE.kills) + ')', (() => { const p = (r.miss1.shard * r.miss1.kills + r.miss3.shard * r.miss3.kills + r.lowE.shard * r.lowE.kills) / (r.miss1.kills + r.miss3.kills + r.lowE.kills); return p >= 0.04 && p <= 0.13; })(), r);
    // L3: every spitvalve placement fires into open air (its globs live, do not pop on the nozzle)
    r = await ev((d, g, Q) => {
      const out = []; const W = window.UB.World;
      for (const room of ['dc_cross', 'dc_loft', 'lw_belts', 'bv_sluice', 'ns_climb', 'rw_gate']) {
        Q.enter(room);
        for (const e of g.enemies.filter(e => e.type === 'spitvalve')) {
          const tx = Math.floor(e.x / 30), ty = Math.floor((e.y - 1) / 30);
          let air = true; for (let i = 1; i <= 3; i++) if (W.tileAt(g.level.room, tx + e.facing * i, ty) !== '.' || W.tileAt(g.level.room, tx + e.facing * i, ty - 1) !== '.') air = false;
          Q.pinAt(e.x + e.facing * 150, e.y);
          const seen = new Set(); let maxLife = 0;
          for (let f = 0; f < 260; f++) { Q.step(1); for (const p of g.projectiles) if (p.kind === 'glob' && p.src === e) seen.add(p); }
          for (const p of seen) maxLife = Math.max(maxLife, p.t);
          out.push({ room, tile: [tx, ty], facing: e.facing, variant: e.variant, air, globs: seen.size, maxLife });
        }
      }
      return out;
    });
    for (const s of r) check('L3: spitvalve ' + s.room + ' (' + s.tile + ') facing ' + s.facing + (s.variant ? ' ' + s.variant : '') + ' has 3 open tiles in front and its globs fly ≥ 60 f', s.air && s.globs >= 2 && s.maxLife >= 60, s);
    // L4: a platewalker lured into BASHing at the end of its stretch must stay on its floor (DESIGN §7.0: walkers turn at patrol bounds, walls and ledges)
    r = await ev((d, g, Q) => {
      const out = [];
      for (const [room, sx, side] of [['lw_belts', 38, -1], ['lw_belts', 38, 1], ['lw_belts', 65, -1], ['lw_belts', 65, 1], ['bv_cistern', 39, -1], ['bv_cistern', 39, 1], ['rw_gate', 10, -1], ['rw_gate', 32, 1]]) {
        Q.enter(room);
        const e = g.enemies.find(e => e.type === 'platewalker' && Math.floor(e.spawnX / 30) === sx);
        if (!e) { out.push({ room, sx, side, missing: true }); continue; }
        const bx = side < 0 ? e.p0 : e.p1;
        let bashes = 0, prev = '', f;
        // a player hopping 1.5 tiles beyond the patrol bound at the walker's height (what a jumping player at the ledge end looks like)
        for (f = 0; f < 1500; f++) { Q.pinAt(bx + side * 45, e.y - (f % 40 < 20 ? 20 : 0)); Q.step(1); if (e.state === 'bash' && prev !== 'bash') bashes++; prev = e.state; if (e.y > e.spawnY + 2 || e.dead) break; }
        const lured = { f, bashes, x: Math.round(e.x), y: e.y };
        Q.pinAt(e.x - side * 600, e.y); let turns = 0, minX = 1e9, maxX = -1e9; prev = e.state;
        for (let i = 0; i < 900; i++) { Q.step(1); if (e.dead) break; if (e.state === 'turn' && prev !== 'turn') turns++; prev = e.state; minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x); }
        const tx = Math.floor(e.x / 30), ty = Math.floor((e.y - 1) / 30);
        out.push({ room, sx, side, lured, spawnY: e.spawnY, after: { x: Math.round(e.x), y: e.y, turns, range: Math.round(maxX - minX), state: e.state, tile: window.UB.World.tileAt(g.level.room, tx, ty), under: window.UB.World.tileAt(g.level.room, tx, ty + 1), dead: e.dead } });
        Q.pin = null;
      }
      return out;
    });
    for (const s of r) {
      if (s.missing) { check('L4: platewalker ' + s.room + ' (' + s.sx + ') present', false, s); continue; }
      check('L4: platewalker ' + s.room + ' (' + s.sx + ',·) lured to bash past its ' + (s.side < 0 ? 'left' : 'right') + ' bound stays on its floor (y ' + s.spawnY + '; got y ' + s.after.y + ', tile "' + s.after.tile + '", ' + s.after.turns + ' turns in 900 f)', s.after.y === s.spawnY && !s.after.dead, s);
    }
    await ev((d, g, Q) => { Q.enter('lw_belts'); const e = g.enemies.find(e => e.type === 'platewalker' && Math.floor(e.spawnX / 30) === 38); for (let f = 0; f < 1500; f++) { Q.pinAt(e.p0 - 45, e.y - (f % 40 < 20 ? 20 : 0)); Q.step(1); if (e.y > e.spawnY + 2) break; } Q.pin = null; d.teleport(e.x + 150, e.spawnY); d.step(200); });
    await shot('qa3-platewalker-pool.png');
    // L5: enemy tells on screen (mid-tell screenshots, looked at by the tester)
    r = await ev((d, g, Q) => { Q.enter('dc_cross'); const e = Q.find('spitvalve'); Q.pinAt(e.x - 120, e.y); Q.until(e, 'charge', 120); Q.step(18); return { state: e.state, timer: e.timer }; });
    check('L5: spitvalve mid-CHARGE for the screenshot', r.state === 'charge' && r.timer >= 15, r);
    await shot('qa3-tell-spitvalve.png');
    r = await ev((d, g, Q) => { Q.enter('lw_belts'); const e = Q.find('rambyte'); Q.pinAt(e.x - 200, e.y); Q.until(e, 'spot', 80); Q.step(12); return { state: e.state, timer: e.timer }; });
    check('L5: rambyte mid-SPOT for the screenshot', r.state === 'spot' && r.timer >= 10, r);
    await shot('qa3-tell-rambyte.png');
    r = await ev((d, g, Q) => { Q.enter('dc_loft'); const e = Q.find('droplatch'); Q.pinAt(e.x, e.y + 160); Q.until(e, 'alert', 40); Q.step(9); return { state: e.state, timer: e.timer }; });
    check('L5: droplatch mid-ALERT for the screenshot', r.state === 'alert' && r.timer >= 8, r);
    await shot('qa3-tell-droplatch.png');
    r = await ev((d, g, Q) => { Q.enter('ns_base'); const e = Q.find('glarewisp'); Q.pinAt(e.x + 200, e.y + 30); Q.until(e, 'lock', 60); Q.step(10); return { state: e.state, timer: e.timer }; });
    check('L5: glarewisp mid-LOCK for the screenshot', r.state === 'lock' && r.timer >= 8, r);
    await shot('qa3-tell-glarewisp.png');

    // ================================================================ L: ROUND 3 — bosses, deeper
    // L6: Tallock's Stack Slam vs the row-12 grates (one-way shelves): a GROUND boss must never end a slam standing on a shelf
    r = await ev((d, g, Q) => {
      Q.fresh('tessik'); Q.startFight('dc_shrine', 'dc_sentinel');
      const b = g.boss, A = b.A, gx = 9 * 30 + 15, gy = 360;   // the player stands on the left grate (x 8–11, row 12)
      const out = { slams: [], grateFrames: 0, attacksFromShelf: [], waveY: null, swingY: null };
      let f = Q.waitTell('stackSlam', 2500, function () { Q.pinAt(gx, gy); if (b.state === 'tell' && b.attack !== 'stackSlam') { b.state = 'walk'; b.timer = 1; b.attack = ''; } });
      if (f < 0) return out;
      while (b.state === 'tell') { Q.pinAt(gx, gy); Q.step(1); }
      let minY = 1e9;
      for (let i = 0; i < 120; i++) { Q.pinAt(gx, gy); Q.step(1); minY = Math.min(minY, b.y); if (b.state === 'shock') break; }
      out.slams.push({ landY: b.y, groundTy: b.groundTy, onShelf: b.y < A.floorY - 1, apexFeet: Math.round(A.floorY - minY), slamX: b.slamX, bx: Math.round(b.x) });
      // the player drops to the floor right under the shelf; does the boss ever come back down in 1500 f?
      let last = '';
      for (let i = 0; i < 1500; i++) {
        Q.pinAt(gx, A.floorY); Q.step(1);
        if (b.y < A.floorY - 1) out.grateFrames++;
        if (b.state === 'tell' && last !== 'tell' && b.y < A.floorY - 1) out.attacksFromShelf.push(b.attack + '@' + Math.round(A.floorY - b.y));   // only tells started above the floor (on a shelf)
        if (b.state === 'swing' && out.swingY === null) out.swingY = Math.round(A.floorY - b.y);
        const w = g.projectiles.find(p => p.kind === 'wave'); if (w && out.waveY === null) out.waveY = Math.round(A.floorY - w.y);
        last = b.state;
      }
      out.floorY = A.floorY; out.bossY = b.y;
      return out;
    });
    check('L6: tallock Stack Slam toward a player on the row-12 shelf: the boss lands on the FLOOR, never on the one-way shelf (landed y ' + (r.slams[0] && r.slams[0].landY) + ', floor ' + r.floorY + ')', r.slams.length === 1 && !r.slams[0].onShelf, r.slams);
    check('L6: tallock with the player on the floor under the shelf comes back down within 1500 f and fights on the floor (frames on the shelf: ' + r.grateFrames + '/1500, attacks from the shelf (height above the floor): ' + r.attacksFromShelf.join(',') + ')', r.grateFrames < 300 && r.attacksFromShelf.length === 0, r);
    await ev((d, g, Q) => { const b = g.boss, A = b.A, gx = 9 * 30 + 15; for (let i = 0; i < 400; i++) { Q.pinAt(gx, A.floorY); Q.step(1); if (b.state === 'swing' && b.timer === 6) break; } });
    await shot('qa3-tallock-shelf.png');
    // L7: Corrosant's Flood (enrage) — the fairness floor: a floor-standing player must get ≥ 20 f of warning before the acid can hurt
    r = await ev((d, g, Q) => {
      Q.fresh('tessik'); Q.startFight('bv_rest', 'bv_corrosant');
      const b = g.boss, A = b.A, pl = g.player; b.hp = 73; Q.hitBoss(30);
      // god ON until the flood's first frame (the boss's other attacks must not pollute the measurement); the player stands on the floor
      const px = 20 * 30 + 15; Q.pinAt(px, A.floorY);
      let start = -1; for (let f = 0; f < 1200; f++) { Q.step(1); if (b.floodOn > 0) { start = f; break; } }
      let hit = -1, drops = [];
      if (start >= 0) {
        d.god(false); pl.iframes = 0; Q.takeDrops();
        for (let f = 0; f < 200; f++) { Q.step(1); const hz = Q.drops.filter(h => h.mode === 'hazard' || h.tag === 'hazard'); if (hz.length) { hit = f; drops = hz; break; } }
        d.god(true); Q.takeDrops();
      }
      // at 1 heart the flood kills: game over, no softlock
      let death = null;
      // wait for a FRESH flood with the player back in normal play: right after the first half the same flood is still
      // running while the player is mid-respawn onto a grate (where the acid cannot reach), so its tail is no test of death
      Q.pinAt(px, A.floorY); let start2 = -1, fresh = false; for (let f = 0; f < 1200; f++) { Q.step(1); if (b.floodOn === 0 && g.mode === 'normal') fresh = true; if (fresh && b.floodOn > 0 && b.floodOn < 118) { start2 = f; break; } }
      if (start2 >= 0) {
        Q.pin = null; d.teleport(px, A.floorY); pl.hp = 1; pl.iframes = 0; d.god(false);
        let died = false, s = d.state(), f2;
        for (f2 = 0; f2 < 400; f2++) { pl.x = px; d.step(1); s = d.state(); if (pl.dead) died = true; if (s.screen === 'gameover') break; }
        death = { died, screen: s.screen, f: f2 }; d.god(true);
      }
      return { start, hit, warning: hit + 1, drops, death };
    });
    check('L7: corrosant Flood gives a floor-standing player ≥ 20 f of visible warning before it can hurt (DESIGN §8.0 fairness floor; the acid hurt ' + r.warning + ' f after its first frame — the hazard, the shake and the sfx all start together)', r.start >= 0 && r.hit >= 0 && r.warning >= 20, r);
    check('L7: corrosant Flood hit = −1 heart as a hazard (freeze + grate respawn)', r.drops.length >= 1 && r.drops[0].dmg === 1 && r.drops[0].tag === 'hazard' && r.drops[0].mode === 'hazard', r.drops);
    check('L7: the Flood at 1 heart kills the player (game over, no softlock in the arena)', !!r.death && r.death.died && r.death.screen === 'gameover', r.death);
    // L8: Corrosant's Wall Lunge must be able to reach a floor-standing player ("it picks the player's y ±1 tile at tell start")
    r = await ev((d, g, Q) => {
      Q.fresh('tessik'); Q.startFight('bv_rest', 'bv_corrosant');
      const b = g.boss, A = b.A, pl = g.player; const res = [];
      for (let k = 0; k < 10; k++) {
        let f = Q.waitTell('lunge', 5000, function () { Q.pinAt(A.cx, A.floorY); });
        if (f < 0) break;
        const dir = b.lungeDir, px = (dir > 0 ? A.x0 + 22 : A.x1 - 22) + dir * 240;   // 8 tiles from the lunging wall, well inside the 14-tile reach
        const tellY0 = Math.round(b.y);
        while (b.state === 'tell') { Q.pinAt(px, A.floorY); Q.step(1); }
        const headTop = Math.round(b.y - b.h), headBot = Math.round(b.y), standTop = A.floorY - pl.h;
        d.god(false); pl.iframes = 0; Q.takeDrops(); let n = 0;
        while (b.state === 'lunge' && n < 80) { Q.pinAt(px, A.floorY); Q.step(1); n++; }
        d.god(true);
        res.push({ tellY0, lungeY: Math.round(b.lungeY), headTop, headBot, standTop, bandOverlapsStanding: headBot > standTop && headTop < A.floorY, hits: Q.takeDrops().map(h => h.tag + h.dmg) });
        Q.pinAt(A.cx, A.floorY); Q.step(60);
      }
      return res;
    });
    check('L8: corrosant Wall Lunge: over ' + r.length + ' lunges at a floor-standing Tessik 8 tiles from the wall, the head lunges at the player\'s height at least once (bands: ' + r.map(x => x.headTop + '–' + x.headBot).join(' ') + ' vs the body ' + (r[0] && r[0].standTop) + '–630)', r.length >= 5 && r.some(x => x.bandOverlapsStanding), r);
    info('corrosant Wall Lunge detail: ' + JSON.stringify(r));
    await ev((d, g, Q) => { const b = g.boss, A = b.A; let f = Q.waitTell('lunge', 5000, function () { Q.pinAt(A.cx, A.floorY); }); if (f < 0) return; const dir = b.lungeDir, px = (dir > 0 ? A.x0 + 22 : A.x1 - 22) + dir * 240; while (b.state === 'tell') { Q.pinAt(px, A.floorY); Q.step(1); } while (b.state === 'lunge' && Math.abs(b.x - px) > 30) { Q.pinAt(px, A.floorY); Q.step(1); } Q.pin = null; d.teleport(px, A.floorY); });
    await shot('qa3-corrosant-lunge-over-player.png');
    // L9: Kernauth phase 2 — Dive Bomb onto a player on the row-10 grate: the dive ends where it arrives (no 300 px teleport to the floor)
    r = await ev((d, g, Q) => {
      Q.fresh('tessik'); Q.startFight('rw_rest', 'rw_throne');
      const b = g.boss, A = b.A, pl = g.player;
      b.hp = 1; Q.hitBoss(40, function () { return b.phase === 2; });
      while (b.state === 'transition') { Q.pinAt(A.cx, A.floorY); Q.step(1); }
      const out = {};
      const gx = 31 * 30 + 15, gy = 300;   // the top grate (row 10, x 28–35)
      let f = Q.waitTell('dive', 3000, function () { Q.pinAt(gx, gy); });
      if (f >= 0) {
        while (b.state === 'tell2') { Q.pinAt(gx, gy); Q.step(1); }
        let maxStep = 0, prevY = b.y, prevX = b.x, frames = 0, arriveY = null;
        while (b.state === 'dive' && frames < 200) { Q.pinAt(gx, gy); Q.step(1); frames++; maxStep = Math.max(maxStep, Math.hypot(b.x - prevX, b.y - prevY)); prevY = b.y; prevX = b.x; }
        out.diveGrate = { lockY: b.lockY, lastDiveY: Math.round(prevY), yAfterArrival: Math.round(b.y), maxStepPx: Math.round(maxStep), state: b.state, floorY: A.floorY, frames };
      }
      // DESIGN §8.4: a fighter standing at the lock point takes the 2-damage shock, not the 1-heart body touch
      d.god(false);
      f = Q.waitTell('dive', 3000, function () { Q.pinAt(A.cx + 200, A.floorY); });
      if (f >= 0) { while (b.state === 'tell2') { Q.pinAt(A.cx + 200, A.floorY); Q.step(1); } pl.iframes = 0; Q.takeDrops(); let n = 0; while (b.state === 'dive' && n < 200) { Q.pinAt(A.cx + 200, A.floorY); Q.step(1); n++; } for (let i = 0; i < 5; i++) { Q.pinAt(A.cx + 200, A.floorY); Q.step(1); } out.diveStand = Q.takeDrops().map(h => h.tag + h.dmg); }
      d.god(true);
      return out;
    });
    check('L9: kernauth Dive Bomb at a player on the row-10 grate moves ≤ 13 px per frame throughout (no teleport; got a ' + (r.diveGrate && r.diveGrate.maxStepPx) + ' px jump: lock y ' + (r.diveGrate && r.diveGrate.lockY) + ' → floor ' + (r.diveGrate && r.diveGrate.yAfterArrival) + ' on the arrival frame)', !!r.diveGrate && r.diveGrate.maxStepPx <= 14, r.diveGrate);
    check('L9: kernauth Dive Bomb on a fighter standing still at the lock point: the hit is the 2-damage shock, not the 1-heart body touch (DESIGN §8.4; got ' + JSON.stringify(r.diveStand) + ')', !!r.diveStand && r.diveStand.length >= 1 && r.diveStand[0] === 'shock2', r.diveStand);
    await ev((d, g, Q) => { const b = g.boss, A = b.A; const gx = 31 * 30 + 15, gy = 300; let f = Q.waitTell('dive', 3000, function () { Q.pinAt(gx, gy); }); if (f < 0) return; while (b.state === 'tell2') { Q.pinAt(gx, gy); Q.step(1); } let n = 0; while (b.state === 'dive' && n < 200) { Q.pinAt(gx, gy); Q.step(1); n++; } Q.pinAt(gx, gy); Q.step(1); });
    await shot('qa3-kernauth-dive-after-arrival.png');
    // L10: Kernauth phase 1 — Cable Sweep fairness: "Jump over the cable tip as it passes" with Echo Jump, from the floor at several distances
    r = await ev((d, g, Q) => {
      Q.fresh('tessik'); d.grant('echoJump', true); Q.startFight('rw_rest', 'rw_throne');
      const b = g.boss, A = b.A, pl = g.player; const out = [];
      for (const dist of [200, 350, 500, 650, 800]) {
        let best = null;
        for (const lead of [30, 60, 100]) {
          const px = b.x + dist;
          let f = Q.waitTell('cableSweep', 3000, function () { Q.pinAt(px, A.floorY); if (b.state === 'tell' && b.attack !== 'cableSweep') { b.state = 'idle'; b.timer = 1; b.attack = ''; } });
          if (f < 0) { out.push({ dist, lead, noTell: true }); continue; }
          b.cableSide = 1; b.cableTip = b.x + 75;
          while (b.state === 'tell') { Q.pinAt(px, A.floorY); Q.step(1); }
          // the probe measures the cable alone: orbs still homing from an earlier Orbital Flare (and summoned motes) would hit the
          // god-off player on the first frame and mask the jump (round 3 counted those 'orb1' hits against the cable)
          for (const p of g.projectiles) p.dead = true; for (const m of g.enemies) if (m.type === 'mote') m.dead = true;
          Q.pin = null; d.teleport(px, A.floorY); d.step(1); pl.iframes = 0; d.god(false); Q.takeDrops();
          let jumped = false, dj = false, n = 0, jumpF = -1, landedF = -1, maxRise = 0;
          while (b.state !== 'recover' && b.state !== 'idle' && n < 400) {
            if (!jumped && b.cableTip >= px - lead) { d.pressed('jump', 10); jumped = true; jumpF = n; }
            if (jumped && !dj && pl.vy > -40 && !pl.onGround && n > jumpF + 8) { d.pressed('jump', 6); dj = true; }
            pl.x = px; pl.vx = 0; Q.dstep(1); n++; maxRise = Math.max(maxRise, A.floorY - pl.y);
            if (jumped && pl.onGround && n > jumpF + 10 && landedF < 0) landedF = n;
          }
          d.god(true);
          const hits = Q.takeDrops().map(h => h.tag + h.dmg);
          const rec = { dist, lead, hits, air: landedF - jumpF, maxRise: Math.round(maxRise), wallDist: Math.round(A.x1 - px) };
          if (!best || hits.length < best.hits.length) best = rec;
          Q.pinAt(A.cx + 300, A.floorY); Q.step(120);
        }
        if (best) out.push(best);
      }
      return out;
    });
    for (const s of r) check('L10: kernauth Cable Sweep is avoidable by a floor Tessik with Echo Jump ' + s.dist + ' px from the boss (' + s.wallDist + ' px from the wall) jumping over the tip (best of 3 timings: ' + JSON.stringify(s.hits) + ', ' + s.air + ' f airborne, rise ' + s.maxRise + ' px)', !s.noTell && s.hits.length === 0, s);
    // L11: the other floor dodges the design names work with the abilities owned at that point
    r = await ev((d, g, Q) => {
      const out = {};
      // Weftyr Thread Dash at the floor: a full jump started when the shuttle is 200 px away
      Q.fresh('tessik'); d.grant('echoJump', true); Q.startFight('lw_rest', 'lw_weftyr');
      let b = g.boss, A = b.A, pl = g.player;
      let f = Q.waitState('dash', 3000, function () { for (const p of g.projectiles) if (p.kind === 'snare') p.dead = true; Q.pinAt(A.cx, A.floorY); });
      if (f >= 0) { Q.pin = null; d.teleport(A.cx, A.floorY); d.step(1); pl.iframes = 0; d.god(false); Q.takeDrops(); let jumped = false, n = 0; while (b.state === 'dash' && n < 150) { for (const p of g.projectiles) if (p.kind === 'snare') p.dead = true; if (!jumped && Math.abs(b.x - pl.x) <= 200 && (b.x - pl.x) * b.dashDir < 0) { d.pressed('jump', 30); jumped = true; } pl.x = A.cx; pl.vx = 0; Q.dstep(1); n++; } d.god(true); out.dash = { jumped, hits: Q.takeDrops().map(h => h.tag + h.dmg) }; }
      // Tallock Stomp Quake wave: a hop when the wave is 60 px away
      Q.fresh('tessik'); Q.startFight('dc_shrine', 'dc_sentinel');
      b = g.boss; A = b.A; pl = g.player;
      f = Q.waitTell('stompQuake', 3000, function () { Q.pinAt(b.x + (b.x < A.cx ? 150 : -150), A.floorY); });
      if (f >= 0) { const px = b.x + (b.x < A.cx ? 150 : -150); while (b.state === 'tell') { Q.pinAt(px, A.floorY); Q.step(1); } Q.pin = null; d.teleport(px, A.floorY); d.step(1); pl.iframes = 0; d.god(false); Q.takeDrops(); let jumped = false; for (let i = 0; i < 90; i++) { const w = g.projectiles.find(p => p.kind === 'wave' && !p.dead && (p.x - pl.x) * p.vx < 0); if (w && !jumped && Math.abs(w.x - pl.x) <= 60) { d.pressed('jump', 20); jumped = true; } pl.x = px; pl.vx = 0; Q.dstep(1); } d.god(true); out.wave = { jumped, hits: Q.takeDrops().map(h => h.tag + h.dmg) }; }
      // Kernauth Static Beam at the floor: jump + Echo Jump at the apex clears the 40 f beam
      Q.fresh('tessik'); d.grant('echoJump', true); Q.startFight('rw_rest', 'rw_throne');
      b = g.boss; A = b.A; pl = g.player; b.hp = 1; Q.hitBoss(40, function () { return b.phase === 2; });
      while (b.state === 'transition') { Q.pinAt(A.cx, A.floorY); Q.step(1); }
      out.beam = [];
      for (const early of [4, 8, 12, 16]) {
        f = Q.waitTell('beam', 4000, function () { Q.pinAt(A.cx, A.floorY); });
        if (f < 0) break;
        while (b.state === 'tell2' && b.timer > early + 1) { Q.pinAt(A.cx, A.floorY); Q.step(1); }
        Q.pin = null; d.teleport(A.cx, A.floorY); d.step(1); pl.iframes = 0; d.god(false); Q.takeDrops(); let n = 0, dj = false; d.pressed('jump', 12);
        while (b.state !== 'recover2' && n < 200) { if (!dj && n > 8 && pl.vy > -60 && !pl.onGround) { d.pressed('jump', 10); dj = true; } pl.x = A.cx; pl.vx = 0; Q.dstep(1); n++; }
        d.god(true); out.beam.push({ early, dj, hits: Q.takeDrops().map(h => h.tag + h.dmg), beamY: b.beamY });
        Q.pinAt(A.cx, A.floorY); Q.step(60);
      }
      return out;
    });
    check('L11: weftyr Thread Dash at floor height is cleared by a full jump started 200 px ahead of the shuttle', !!r.dash && r.dash.jumped && r.dash.hits.length === 0, r.dash);
    check('L11: tallock Stomp Quake wave is cleared by a hop when it is 60 px away', !!r.wave && r.wave.jumped && r.wave.hits.length === 0, r.wave);
    check('L11: kernauth Static Beam at floor height is cleared from the floor by a jump + Echo Jump started 4–16 f before it fires (' + JSON.stringify(r.beam) + ')', !!r.beam && r.beam.length >= 2 && r.beam.some(x => x.dj && x.hits.length === 0), r.beam);
    // L12: dying mid-fight: respawn at the node, re-enter → the fight restarts clean (full hp, no enrage, intro, no leftover shots)
    r = await ev((d, g, Q) => {
      Q.fresh('tessik'); Q.startFight('dc_shrine', 'dc_sentinel');
      const b = g.boss; b.hp = 37; Q.hitBoss(30); Q.step(100);
      const mid = { hp: b.hp, enraged: b.enraged, phase: b.phase, fight: g.bossFight.state };
      Q.pin = null; d.god(false); d.setHp(0); let s = d.state(); for (let i = 0; i < 400 && s.screen !== 'gameover'; i++) { d.step(1); s = d.state(); }
      g.respawnAtNode(); for (let i = 0; i < 300; i++) { d.step(1); s = d.state(); if (s.screen === 'play' && !s.busy) break; }
      const after = { room: s.roomId, hp: s.hp, maxHp: s.maxHp, bossesDefeated: s.bossesDefeated.slice() };
      d.god(true); d.warp('dc_sentinel', 'L'); d.step(3); Q.wrapHurt();
      const b2 = g.boss;
      return { mid, after, re: { boss: !!b2, fresh: b2 !== b, hp: b2 && b2.hp, maxHp: b2 && b2.maxHp, enraged: b2 && b2.enraged, phase: b2 && b2.phase, fight: g.bossFight.state, walk: b2 && b2.walkSpeed, projectiles: g.projectiles.length, L: g.level.openings.find(o => o.id === 'L').sealed } };
    });
    check('L12: dying to Tallock mid-fight (enraged, 34 hp): game over → node respawn with full hearts, nothing recorded', r.mid.enraged && r.after.room === 'dc_wake' && r.after.hp === r.after.maxHp && r.after.bossesDefeated.length === 0, r);
    check('L12: re-entering the arena restarts the fight clean: a fresh boss at 120/120, not enraged (walk 1.5), intro + seal again, no leftover shots', r.re.boss && r.re.fresh && r.re.hp === 120 && r.re.maxHp === 120 && !r.re.enraged && r.re.phase === 1 && r.re.walk === 1.5 && r.re.fight === 'intro' && r.re.projectiles === 0 && r.re.L === true, r.re);

    // L13: fairness — the round-3 scripted Tessik vs Tallock (god off, 60 s): keep distance, jump when the boss winds up (or a wave/disc approaches), hit the recovery
    r = await ev((d, g, Q) => {
      const In = window.UB.Input;
      Q.fresh('tessik');
      d.warp('dc_shrine', null); d.step(2); d.warp('dc_sentinel', 'L'); d.step(155);
      d.god(false); g.player.hp = g.player.maxHp;
      g.rng = window.UB.Util.rng(0x5EED);   // one fixed seed for the fight (the page's rng stream has been consumed by everything above)
      const pl = g.player, b = g.boss, A = b.A;
      const hurts = []; const origHurt = pl.hurt; let fr = 0;
      pl.hurt = function (dmg, fromX, opts) { const took = origHurt.call(this, dmg, fromX, opts); if (took) hurts.push({ f: fr, dmg, tag: opts && opts.hit ? opts.hit.tag : 'contact', st: b.state, atk: b.attack, bt: b.timer, dx: Math.round(b.x - pl.x) }); return took; };
      let dealt = 0, lastHp = b.hp, lights = 0, jumps = 0; const tells = {}; let prev = '', swingJumped = false;
      const L = A.x0 + 40, R = A.x1 - 40;
      for (fr = 0; fr < 3600; fr++) {
        if (!g.boss || g.bossFight.state !== 'fight' || pl.dead) break;
        const dx = b.x - pl.x, adx = Math.abs(dx), side = dx > 0 ? 1 : -1;
        const st = b.state, atk = b.attack;
        if (st === 'tell' && prev !== 'tell') { if (!tells[atk]) tells[atk] = { min: 1e9, n: 0 }; tells[atk].n++; tells[atk].min = Math.min(tells[atk].min, b.timer); swingJumped = false; }
        let move = 0, jump = 0, light = false;
        const roomBehind = side > 0 ? pl.x - L : R - pl.x;
        let threat = 1e9;
        for (const p of g.projectiles) { if (p.dead) continue; const pdx = p.x - pl.x; const approaching = (p.vx > 0 && pdx < 0) || (p.vx < 0 && pdx > 0); if (approaching) threat = Math.min(threat, Math.abs(pdx)); }
        if (st === 'tell') {
          if (atk === 'slabSwing') { if (adx < 130) { if (roomBehind > 40) move = -side; else if (!swingJumped && 30 - b.timer >= 12 && pl.onGround) { jump = 14; swingJumped = true; } } }
          else if (atk === 'stompQuake') { if (adx < 100 && roomBehind > 30) move = -side; }
          else if (atk === 'stackSlam') { if (roomBehind > 120) move = -side; else move = side; }   // cornered: run under the arc
        } else if (st === 'slam') { const away = pl.x < b.slamX ? -1 : 1; if ((away < 0 && pl.x - L > 100) || (away > 0 && R - pl.x > 100)) move = away; else move = -away; }
        else if (st === 'shock') { if (adx < 140 && roomBehind > 20) move = -side; }
        else if (st === 'swing') { if (adx < 130 && roomBehind > 20) move = -side; }
        else if (st === 'recover' || st === 'tossWait') { if (b.timer > 14) { if (adx > 84) move = side; else if (adx < 70) move = -side; else light = (fr % 6) === 0; } else if (roomBehind > 60) move = -side; }
        else { if (adx < 150 && roomBehind > 30) move = -side; else if (adx > 240) move = side; }
        if (threat < 110 && pl.onGround && !jump) jump = 8;
        if (pl.state === 'attack') move = 0;
        if (move < 0 && pl.x < L) move = 0; if (move > 0 && pl.x > R) move = 0;
        if (move < 0) In.press('left', 1); else if (move > 0) In.press('right', 1);
        if (jump) { In.press('jump', jump); jumps++; }
        if (light) { In.press('light', 1); lights++; }
        prev = st; d.step(1);
        if (b.hp < lastHp) { dealt += lastHp - b.hp; lastHp = b.hp; }
      }
      pl.hurt = origHurt; d.god(true);
      const tl = {}; for (const k in tells) tl[k] = { minTell: tells[k].min, n: tells[k].n };
      return { frames: fr, heartsLeft: pl.hp, maxHp: pl.maxHp, dead: pl.dead, heartsLost: hurts.reduce((s, h) => s + h.dmg, 0), hurts, dealt, bossHp: b.hp, lights, jumps, tells: tl, enraged: !!b.enraged };
    });
    info('fairness ROUND-3 bot (keep 4–6 tiles, jump at the Slab Swing wind-up / approaching waves and discs, run from the Stack Slam mark (under it when cornered), light the recoveries), Tessik vs Tallock, god off, 60 s: hearts lost ' + r.heartsLost + '/' + r.maxHp + (r.dead ? ' (DIED at ' + Math.round(r.frames / 60) + ' s)' : '') + ', damage dealt ' + r.dealt + '/120' + (r.enraged ? ' (enraged)' : '') + ', lights ' + r.lights + ', jumps ' + r.jumps + ', hits taken ' + JSON.stringify(r.hurts) + ', tells ' + JSON.stringify(r.tells));
    // the loop ends early when the fight does: purging Tallock inside the 60 s is surviving it
    check('L13: the round-3 scripted Tessik survives 60 s against Tallock with god off (or purges it sooner), losing ≤ 3 of ' + r.maxHp + ' hearts (lost ' + r.heartsLost + ')', !r.dead && (r.frames >= 3600 || r.bossHp <= 0) && r.heartsLost <= 3, r);
    check('L13: the scripted player lands ≥ 30 damage in the recoveries (got ' + r.dealt + ')', r.dealt >= 30, r.dealt);
    check('L13: every Tallock tell the bot saw is ≥ 20 f', Object.keys(r.tells).length >= 2 && Object.keys(r.tells).every(k => r.tells[k].minTell >= 20), r.tells);

    // ---------------------------------------------------------------- G
    check('G: no console errors or page errors', t.errors.length === 0, t.errors);
  } catch (e) {
    check('test threw: ' + (e && e.message ? e.message : String(e)), false, e && e.stack);
  }

  const fails = results.filter(r => !r.ok);
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' checks passed' + (fails.length ? ' — FAILED: ' + fails.map(f => f.name).join(' | ') : ''));
  if (t.errors.length) console.log('page errors:\n' + t.errors.join('\n'));
  await t.close();
  process.exit(fails.length ? 1 : 0);
})();
