/*
 * UNDERBYTE — test/pt-fixes-gameplay.cjs
 * The playtest GAMEPLAY fix lane (playtests/REPORT.md): one check (or a small group) per bug, each written from
 * the bug's repro so it FAILS on the pre-fix code and PASSES now. Headless Chromium, file:// index.html, logic
 * stepped through window.UB.debug (CONTRACT §9).
 *
 *   B15  the Burst Line crawlspace gaps (bv_sluice, bv_catwalk) can no longer be crossed with Jump + Echo Jump
 *        (a sweep of jump/Echo-Jump timings per fighter); a dash still crosses both
 *   B17  dc_fall: falling off the row-34 crumble blocks lands on the row-40 grate (on camera), never the spike bed
 *   B19  bv_sluice T arrival: holding RIGHT walks off the arrival grate into the crawlspace (no hidden Down+Jump)
 *   B29  the grounded light chain lands L1, L2 AND L3 on a stationary kbResist-1 crawler for every fighter;
 *        L3 still launches
 *   B10  Overclock does not drain during the ability pickup lock
 *   B16  Vellix's Blink Strike never ends inside Tallock (stops at its body or passes it), no contact hit
 *   B31  refused special / Overclock / dash presses play the deny sfx and show a cue on the fighter; a Pulse Line
 *        with no floor ahead is refused without spending energy
 *   B32  the select-screen showcase jump stays inside the portrait halo (never over the header)
 *   B43  the hero is never fully invisible during i-frames (a dimmed silhouette on the blink frames)
 *   B26  Tallock answers a fighter camping the row-12 shelf (shelf-reaching attacks, hits land)
 *   B27  Tallock shrugs off a pogo-lock: after 3 consecutive head pogos a ≥ 20 f telegraphed Stack Shrug
 *   B33  the Stack Slam marker is frozen at the landing x and shown through the whole arc
 *   B34  a Stack Slam landing on a cornered fighter pushes the fighter out: no repeated contact
 *   B36  a fighter who jumps Weftyr's Snare Line comes down on it unhurt (the thread snaps underfoot)
 *   B38  Corrosant on the ceiling is never invisible from the floor (focus point + an edge beacon in view)
 *   B41  Rootwell: Root Spikes and the Cable Sweep read by luminance + outline against the red arena
 * Finally: no console/page errors.
 *
 * Run: node underbyte/test/pt-fixes-gameplay.cjs   (exit 0 = every check PASS)
 */
'use strict';
const { launch } = require('./harness.cjs');

const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (!ok && info !== undefined ? '  -> ' + JSON.stringify(info).slice(0, 1500) : ''));
}
function info(msg) { console.log('     ' + msg); }

(async () => {
  const t = await launch();
  const page = t.page;
  /** run fn(d, g, P, ...args) in the page (d = UB.debug, g = UB.game, P = the helpers installed below) */
  const ev = (fn, ...args) => page.evaluate(({ src, args }) => (new Function('d', 'g', 'P', 'args', 'return (' + src + ')(d, g, P, ...args)'))(window.UB.debug, window.UB.game, window.__pt, args), { src: fn.toString(), args });
  try {
    await page.evaluate(() => localStorage.removeItem('underbyte.save'));
    await page.reload(); await page.waitForTimeout(250);
    await page.evaluate(() => {
      const d = window.UB.debug, g = window.UB.game, E = window.UB.Entity;
      d.pauseLogic(true);
      const P = window.__pt = {};
      P.hurts = [];
      /** a fresh game with `fighter` (god on, zone lore cards already seen) */
      P.fresh = function (fighter) {
        d.toTitle(); d.newGame(fighter || 'tessik');
        for (let i = 0; i < 240; i++) { d.step(1); const s = d.state(); if (s.screen === 'play' && !s.busy) break; }
        d.god(true); g.save.loreSeen = window.UB.IDS.zones.slice(); P.wrapHurt(); P.hurts.length = 0;
      };
      /** log every hp loss of the current player object: {f, dmg, tag} */
      P.wrapHurt = function () {
        const pl = g.player; if (!pl || pl.__ptWrapped) return;
        const orig = pl.hurt;
        pl.hurt = function (dmg, fromX, opts) {
          const took = orig.call(this, dmg, fromX, opts);
          if (took) P.hurts.push({ f: g.frame, dmg: dmg, tag: opts && opts.hit ? (opts.hit.tag || opts.hit.kind) : (opts && opts.hazard ? 'hazard' : 'contact'), x: Math.round(this.x), y: Math.round(this.y) });
          return took;
        };
        pl.__ptWrapped = true;
      };
      P.bigHp = function () { d.setMaxHp(99); d.setHp(99); };
      /** enter an arena from `from` (the fight triggers on the first tick) and run the 150 f intro */
      P.startFight = function (from, room) { d.warp(from, null); d.step(2); d.warp(room, 'L'); P.wrapHurt(); d.step(152); return g.boss; };
      P.waitNormal = function (max) { for (let i = 0; i < (max || 200) && g.mode !== 'normal'; i++) d.step(1); };
      /** step until pred() (max frames, `each(f)` first every frame); frames waited or -1 */
      P.until = function (pred, max, each) { for (let f = 0; f < max; f++) { if (pred()) return f; if (each) each(f); d.step(1); } return pred() ? max : -1; };
      // ---- pixels
      P.lum = function (r, gg, b) { const f = function (c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b); };
      P.contrast = function (a, b) { return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
      P.hexLum = function (h) { return P.lum(parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)); };
      /** render the play frame and return the world layer's RGBA at world px (wx, wy) */
      P.renderAt = function () { g.render(1); };
      P.worldPx = function (wx, wy) {
        const FX = window.UB.FX, dpr = g.dpr;
        const cx = Math.round(g.cam.x + FX.shakeX), cy = Math.round(g.cam.y + FX.shakeY);
        const sx = Math.round((wx - cx) * dpr), sy = Math.round((wy - cy) * dpr);
        if (sx < 0 || sy < 0 || sx >= g.world.width || sy >= g.world.height) return null;
        const p = g.wctx.getImageData(sx, sy, 1, 1).data; return [p[0], p[1], p[2]];
      };
      /** world-layer pixels of a world rect (rendered beforehand): {n, data:[[r,g,b]...]} sampled every `stepPx` */
      P.worldRect = function (wx, wy, w, h, stepPx) {
        const out = []; for (let y = wy; y < wy + h; y += stepPx) for (let x = wx; x < wx + w; x += stepPx) { const p = P.worldPx(x, y); if (p) out.push(p); } return out;
      };
      /** an offscreen 960×540 canvas context */
      P.canvas = function () { const c = document.createElement('canvas'); c.width = 960; c.height = 540; return c; };
      P.opaque = function (c) { const dd = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, top = 1e9, bot = -1; for (let i = 3; i < dd.length; i += 4) if (dd[i] > 24) { n++; const y = Math.floor((i >> 2) / c.width); if (y < top) top = y; if (y > bot) bot = y; } return { n: n, top: top, bot: bot }; };
      /** record UB.Audio.sfx names with the frame they played on */
      P.sfx = [];
      if (!P.sfxWrapped) { const Au = window.UB.Audio, o = Au.sfx; Au.sfx = function (name) { P.sfx.push({ f: g.frame, name: name }); return o.apply(this, arguments); }; P.sfxWrapped = true; }
    });

    // =============================================================================================== B15
    let r = await ev((d, g, P) => {
      const out = {}, T = 30;
      const ROOMS = [['bv_sluice', 240], ['bv_catwalk', 150]];
      for (const id of ['vellix', 'tessik', 'brackmaw', 'orrubel', 'korvask']) {
        P.fresh(id); d.grant('echoJump', true); d.grant('burstLine', false); d.god(false);
        const hw = g.player.w / 2;
        for (const [room, fy] of ROOMS) {
          d.warp(room, { x: 315, y: fy }); d.step(2);
          let tried = 0, crossed = 0, hazards = 0, best = 0; const wins = [];
          const lip = 15 * T;   // the gap is x15–20; the far floor starts at x21 (630)
          for (const jx of [lip - 60, lip - 45, lip - 30, lip - 20, lip - 12, lip - 6, lip, lip + hw - 1]) {
            for (const [h1, del] of [[12, 13], [12, 16], [12, 19], [12, 20], [12, 21], [12, 24], [6, 8], [6, 10], [6, 14]]) {
              P.waitNormal(200); P.bigHp(); d.killEnemies();
              d.teleport(315, fy); d.step(3);
              let jf = -1, res = null;
              for (let f = 0; f < 160 && !res; f++) {
                const p = g.player;
                d.pressed('right', 1);
                if (jf < 0 && p.onGround && p.x >= jx) { jf = f; d.pressed('jump', h1); }
                else if (jf >= 0 && f === jf + del) d.pressed('jump', 12);
                d.step(1);
                if (g.mode === 'hazard') res = 'hazard';
                else if (p.onGround && p.x - hw >= 21 * T - 0.5 && p.y <= fy + 1) res = 'crossed';
                if (p.x > best) best = p.x;
              }
              tried++;
              if (res === 'crossed') { crossed++; if (wins.length < 3) wins.push({ jx, h1, del }); }
              if (res === 'hazard') hazards++;
            }
          }
          // positive control: a ground dash from near the lip still crosses (Burst Line is the key)
          d.grant('burstLine', true);
          let dashWindow = 0;
          for (let dx = lip - 70; dx <= lip + hw; dx += 5) {
            P.waitNormal(200); P.bigHp(); d.killEnemies();
            d.teleport(315, fy); d.step(3);
            let fired = false, ok = false;
            for (let f = 0; f < 160 && !ok && g.mode === 'normal'; f++) {
              const p = g.player;
              d.pressed('right', 1);
              if (!fired && p.onGround && p.x >= dx) { fired = true; d.pressed('dash', 2); }
              d.step(1);
              if (p.onGround && p.x - hw >= 21 * T - 0.5 && p.y <= fy + 1) ok = true;
            }
            if (ok) dashWindow += 5;
          }
          d.grant('burstLine', false);
          out[id + '@' + room] = { tried, crossed, hazards, best: Math.round(best), wins, dashWindow };
        }
      }
      d.god(true);
      return out;
    });
    const b15 = Object.entries(r);
    check('B15 the Burst Line crawlspace gaps (bv_sluice, bv_catwalk) are NOT crossable with Jump + Echo Jump: ' + b15.map(([k, v]) => k + ' ' + v.crossed + '/' + v.tried).join(', '),
      b15.every(([, v]) => v.crossed === 0 && v.tried >= 72), r);
    check('B15 a miss always ends in the acid (hazard respawn, never a trap): every fighter/room sweep recorded acid hits', b15.every(([, v]) => v.hazards > 0), b15.map(([k, v]) => [k, v.hazards]));
    check('B15 the dash gate still opens: a ground Burst Line from near the lip crosses both gaps for every fighter (window ≥ 20 px): ' + b15.map(([k, v]) => k + ' ' + v.dashWindow + 'px').join(', '),
      b15.every(([, v]) => v.dashWindow >= 20), b15.map(([k, v]) => [k, v.dashWindow]));

    // =============================================================================================== B17
    r = await ev((d, g, P) => {
      const out = [];
      for (const id of ['tessik', 'vellix', 'brackmaw']) {
        P.fresh(id); d.god(false);
        for (const x of [445, 452, 460]) {
          d.warp('dc_fall', { x: x, y: 34 * 30 }); d.step(1); P.bigHp(); d.killEnemies();
          let hz = false, land = null, camBottom = 0, crumbled = -1;
          for (let f = 0; f < 360 && !land && !hz; f++) {
            d.step(1);
            const p = g.player;
            if (crumbled < 0 && !p.onGround) { crumbled = f; camBottom = g.cam.y + 540; }
            if (g.mode === 'hazard') hz = true;
            else if (crumbled >= 0 && p.onGround && p.y > 34 * 30 + 1) land = { x: Math.round(p.x), y: p.y };
          }
          out.push({ id, x, hz, land, crumbled, camBottom: Math.round(camBottom) });
          P.waitNormal(200);
        }
      }
      d.god(true);
      return out;
    });
    check('B17 dc_fall: standing on the row-34 crumble blocks until they give way lands on the row-40 grate (y 1200), never the spike bed (' + r.length + ' drops, 3 fighters)',
      r.every(x => !x.hz && x.land && x.land.y === 1200), r);
    check('B17 the landing (y 1200) is on camera the moment the floor gives way', r.every(x => x.crumbled >= 0 && x.camBottom >= 1200 + 30), r.map(x => x.camBottom));

    // =============================================================================================== B19
    r = await ev((d, g, P) => {
      const out = {};
      for (const id of ['tessik', 'brackmaw', 'korvask']) {
        P.fresh(id); d.grant('echoJump', true); d.god(false); P.bigHp();
        d.warp('bv_sluice', 'T'); d.step(2); d.killEnemies();
        const land = P.until(() => g.player.onGround, 90);
        const y0 = g.player.y;
        let maxX = 0, hz = 0, downUsed = false;
        for (let f = 0; f < 150 && g.player.x < 300; f++) { d.pressed('right', 1); d.step(1); if (g.mode === 'hazard') hz++; maxX = Math.max(maxX, g.player.x); }
        P.until(() => g.player.onGround, 60);
        out[id] = { land, y0, maxX: Math.round(maxX), hz, downUsed, y: g.player.y };
      }
      d.god(true);
      return out;
    });
    check('B19 bv_sluice T arrival: the fighter lands on the row-4 grate (y 120) and holding RIGHT alone walks off it into the crawlspace (x ≥ 285, floor y 240), no Down+Jump, no hazard: ' + Object.entries(r).map(([k, v]) => k + ' x ' + v.maxX).join(', '),
      Object.values(r).every(v => v.y0 === 120 && v.maxX >= 285 && v.y === 240 && v.hz === 0), r);

    // =============================================================================================== B29
    r = await ev((d, g, P) => {
      const out = {};
      for (const id of ['tessik', 'brackmaw', 'vellix', 'orrubel', 'korvask']) {
        P.fresh(id);
        d.warp('debug_room', { x: 5 * 30 + 15, y: 450 }); d.step(3); d.killEnemies();
        d.teleport(150, 450); d.step(3);
        d.spawnEnemy('scuttlebit', 6, 14, {});
        const e = g.enemies[g.enemies.length - 1];
        e.hp = 999; e.maxHp = 999; e.speed = 0; e.x = g.player.x + 40; e.px = e.x; e.facing = -1; e.dir = -1;
        g.player.facing = 1; d.step(1);
        const hits = []; let hp = e.hp, l3vx = null;
        for (let f = 0; f < 70; f++) {
          if (f % 4 === 0) d.pressed('light', 1);
          d.step(1);
          if (e.hp < hp) { hits.push({ f, mv: g.player.moveName, dist: Math.round(e.x - g.player.x) }); if (g.player.moveName === 'light3' && l3vx === null) l3vx = e.vx * 60; hp = e.hp; }
        }
        const mv = hits.map(h => h.mv);
        out[id] = { hits, l1: mv.includes('light1'), l2: mv.includes('light2'), l3: mv.includes('light3'), l3vx: l3vx === null ? null : Math.round(l3vx), l3kb: g.player.data.moves.light3.kb[0] };
      }
      return out;
    });
    check('B29 a grounded light chain (Light every 4 f) lands L1, L2 and L3 on a stationary kbResist-1 scuttlebit 40 px ahead, every fighter: ' + Object.entries(r).map(([k, v]) => k + ' ' + (v.l1 ? 1 : 0) + (v.l2 ? 1 : 0) + (v.l3 ? 1 : 0)).join(', '),
      Object.values(r).every(v => v.l1 && v.l2 && v.l3), r);
    check('B29 L3 still launches at its sheet knockback (vx = kb on the hit frame; Korvask\'s pull keeps its sign)', Object.values(r).every(v => v.l3vx !== null && Math.abs(Math.abs(v.l3vx) - Math.abs(v.l3kb)) <= 2), Object.entries(r).map(([k, v]) => [k, v.l3vx, v.l3kb]));

    // =============================================================================================== B10
    r = await ev((d, g, P) => {
      P.fresh('tessik'); const b = P.startFight('dc_shrine', 'dc_sentinel');
      b.hp = 1; let k = 0;
      while (g.bossFight.state === 'fight' && k++ < 30) { g.player.x = b.x - b.w / 2 - 20; g.player.y = b.y; g.player.facing = 1; d.pressed('light', 2); d.step(16); }
      P.until(() => g.bossFight.state === 'reward', 300);
      const ab = g.pickups.find(p => p.type === 'ability');
      d.setMeter(100); d.teleport(ab.x - 200, ab.y); d.step(2);
      d.pressed('overclock', 2); P.until(() => g.player.ocActive, 60);
      const oc0 = g.player.overclock;
      d.teleport(ab.x, ab.y); const st = P.until(() => g.mode === 'pickupSeq', 20);
      const ocStart = g.player.overclock;
      const seq = P.until(() => g.mode !== 'pickupSeq', 200);
      return { oc0, st, ocStart, ocEnd: g.player.overclock, seq, active: g.player.ocActive };
    });
    check('B10 Overclock is frozen during the 120 f ability pickup lock (timer ' + r.ocStart + ' → ' + r.ocEnd + ' over ' + r.seq + ' locked frames)', r.st >= 0 && r.seq >= 100 && r.active && r.ocStart - r.ocEnd <= 1, r);

    // =============================================================================================== B16
    r = await ev((d, g, P) => {
      const out = {};
      for (const dist of [200, 160, 100]) {
        P.fresh('vellix'); const b = P.startFight('dc_shrine', 'dc_sentinel');
        b.state = 'recover'; b.timer = 9999; b.vx = 0; d.step(2);
        d.god(false); P.bigHp(); P.hurts.length = 0;
        const hp0 = b.hp; d.setEnergy(100);
        d.teleport(b.x + dist, b.y); d.step(2); g.player.facing = -1; g.player.iframes = 0;
        d.pressed('special', 1);
        const pl = g.player;
        let overlapEnd = false, endX = null, ovFrames = 0;
        for (let f = 0; f < 60; f++) {
          d.step(1);
          const ov = pl.x - pl.w / 2 < b.x + b.w / 2 && pl.x + pl.w / 2 > b.x - b.w / 2;
          if (f >= 12 && ov) ovFrames++;
          if (endX === null && pl.moveName === 'special' && pl.sp.phase === 'recover') { endX = Math.round(pl.x); overlapEnd = ov; }
        }
        out[dist] = { endX, bossX: Math.round(b.x), overlapEnd, ovFrames, dmg: hp0 - b.hp, hurts: P.hurts.slice() };
        d.god(true);
      }
      return out;
    });
    check('B16 Vellix Blink Strike from 200 / 160 / 100 px: deals its 7, never ends inside Tallock\'s body and takes no contact hit (' + Object.entries(r).map(([k, v]) => k + 'px → x ' + v.endX + ' vs boss ' + v.bossX).join(', ') + ')',
      Object.values(r).every(v => v.dmg === 7 && v.endX !== null && !v.overlapEnd && v.ovFrames === 0 && v.hurts.length === 0), r);

    // =============================================================================================== B31
    r = await ev((d, g, P) => {
      const out = {};
      const denyAfter = function (f0, within) { return P.sfx.some(s => s.name === 'deny' && s.f > f0 && s.f <= f0 + within); };
      // (a) Tessik: Special in mid-air (no landing within the 6 f buffer)
      P.fresh('tessik'); d.warp('debug_room', { x: 165, y: 450 }); d.step(3); d.killEnemies(); d.setEnergy(100);
      d.pressed('jump', 20); d.step(4);
      let f0 = g.frame; P.sfx.length = 0; d.pressed('special', 1);
      let cue = 0; for (let i = 0; i < 10; i++) { d.step(1); cue = Math.max(cue, g.player.denyT || 0); }
      out.air = { deny: denyAfter(f0, 10), cue, energy: Math.round(g.player.energy) };
      P.until(() => g.player.onGround, 90); d.step(20);
      // (b) Tessik: Special again 8 f into a Pulse Line (during its own move)
      d.setEnergy(100); d.pressed('special', 1); d.step(8);
      f0 = g.frame; P.sfx.length = 0; d.pressed('special', 1);
      cue = 0; for (let i = 0; i < 10; i++) { d.step(1); cue = Math.max(cue, g.player.denyT || 0); }
      out.own = { deny: denyAfter(f0, 10), cue };
      d.step(60);
      // (d) Overclock at meter 60
      d.setMeter(60); f0 = g.frame; P.sfx.length = 0; d.pressed('overclock', 1);
      cue = 0; for (let i = 0; i < 10; i++) { d.step(1); cue = Math.max(cue, g.player.denyT || 0); }
      out.oc = { deny: denyAfter(f0, 10), cue, oc: g.player.ocActive || g.player.ocTransform > 0 };
      // (e) Dash without Burst Line
      d.grant('burstLine', false); d.step(20); f0 = g.frame; P.sfx.length = 0; d.pressed('dash', 1);
      cue = 0; for (let i = 0; i < 10; i++) { d.step(1); cue = Math.max(cue, g.player.denyT || 0); }
      out.dash = { deny: denyAfter(f0, 10), cue };
      // (f) Pulse Line with no floor ahead: Tessik's front at the end of dc_wake's row-11 grate, facing the drop
      d.warp('dc_wake', { x: 23 * 30 - 12, y: 11 * 30 }); d.step(3); d.killEnemies();
      g.player.facing = 1; d.step(2); d.setEnergy(100);
      const onGrate = g.player.onGround && g.player.y === 330;
      f0 = g.frame; P.sfx.length = 0; d.pressed('special', 1);
      let pulse = false; cue = 0; for (let i = 0; i < 20; i++) { d.step(1); cue = Math.max(cue, g.player.denyT || 0); if (g.projectiles.some(p => p.hit && p.hit.tag === 'pulse' && !p.dead)) pulse = true; }
      out.ledge = { onGrate, deny: denyAfter(f0, 10), cue, energy: Math.round(g.player.energy), pulse };
      // and a Pulse Line with a runway still fires (no false deny): the middle of the same grate
      d.teleport(20 * 30 + 15, 11 * 30); d.step(3); g.player.facing = 1; d.setEnergy(100);
      f0 = g.frame; P.sfx.length = 0; d.pressed('special', 1);
      pulse = false; for (let i = 0; i < 20; i++) { d.step(1); if (g.projectiles.some(p => p.hit && p.hit.tag === 'pulse' && !p.dead)) pulse = true; }
      out.runway = { deny: denyAfter(f0, 20), pulse, energy: Math.round(g.player.energy) };
      // (c) Vellix: L ×3 five frames apart, then Special during the chain end
      P.fresh('vellix'); d.warp('debug_room', { x: 165, y: 450 }); d.step(3); d.killEnemies(); d.setEnergy(100); d.step(5);
      // chain to L3 (Light every 3 f), then Special on L3's 2nd frame: L3 has no special cancel on a whiff, so the press dies
      for (let i = 0; i < 40 && g.player.moveName !== 'light3'; i++) { if (i % 3 === 0) d.pressed('light', 1); d.step(1); }
      d.step(1);
      const inL3 = g.player.moveName === 'light3';
      f0 = g.frame; P.sfx.length = 0; d.pressed('special', 1);
      cue = 0; for (let i = 0; i < 10; i++) { d.step(1); cue = Math.max(cue, g.player.denyT || 0); }
      out.chain = { inL3, deny: denyAfter(f0, 10), cue, mv: g.player.moveName };
      return out;
    });
    check('B31 Tessik Special in mid-air (never landing in the buffer): deny sfx + cue on the fighter, no energy spent', r.air.deny && r.air.cue > 0 && r.air.energy >= 99, r.air);
    check('B31 Tessik Special during its own Pulse Line: deny sfx + cue', r.own.deny && r.own.cue > 0, r.own);
    check('B31 Vellix Special pressed during the L3 chain end (no cancel on a whiff): deny sfx + cue', r.chain.inL3 && r.chain.deny && r.chain.cue > 0, r.chain);
    check('B31 Overclock pressed at meter 60: deny sfx + cue, no transform', r.oc.deny && r.oc.cue > 0 && !r.oc.oc, r.oc);
    check('B31 Dash pressed without Burst Line: deny sfx + cue', r.dash.deny && r.dash.cue > 0, r.dash);
    check('B31 Pulse Line with no floor ahead (front at the grate end): refused — deny sfx + cue, no wave, no energy spent', r.ledge.onGrate && r.ledge.deny && r.ledge.cue > 0 && !r.ledge.pulse && r.ledge.energy >= 99, r.ledge);
    check('B31 a Pulse Line with a runway still fires silently (no false deny)', r.runway.pulse && !r.runway.deny && r.runway.energy <= 75, r.runway);

    // =============================================================================================== B32
    r = await ev((d, g, P) => {
      const C = window.UB.Characters, out = {};
      for (const id of ['tessik', 'brackmaw', 'vellix', 'orrubel', 'korvask']) {
        const c = P.canvas(), ctx = c.getContext('2d');
        let top = 1e9, idleTop = 0;
        C.drawPreview(ctx, id, 300, 300, 3, 0, true); idleTop = P.opaque(c).top;
        for (let k = 0; k < 48; k += 3) {
          ctx.clearRect(0, 0, 960, 540);
          C.drawPreview(ctx, id, 300, 300, 3, 4 * 228 + 180 + k, true);   // the 'jump' slot of the showcase cycle
          const o = P.opaque(c); if (o.top < top) top = o.top;
        }
        out[id] = { top, idleTop, lift: idleTop - top };
      }
      return out;
    });
    check('B32 the select showcase jump stays inside the portrait halo (top ≥ 92; the header ends at y 80) and still visibly jumps (≥ 12 px): ' + Object.entries(r).map(([k, v]) => k + ' top ' + v.top + ' lift ' + v.lift).join(', '),
      Object.values(r).every(v => v.top >= 92 && v.lift >= 12), r);

    // =============================================================================================== B43
    r = await ev((d, g, P) => {
      P.fresh('tessik'); d.warp('debug_room', { x: 165, y: 450 }); d.step(3); d.killEnemies();
      const pl = g.player, c = P.canvas(), ctx = c.getContext('2d');
      const counts = [];
      for (let n = 0; n <= 60; n++) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, 960, 540);
        ctx.translate(480 - pl.x, 300 - pl.y);
        pl.iframes = n; pl.draw(ctx, g, 1);
        counts.push(P.opaque(c).n);
      }
      pl.iframes = 0;
      const solid = counts[0];
      return { solid, min: Math.min(...counts), blank: counts.filter(x => x === 0).length, dim: counts.filter(x => x < solid * 0.5).length };
    });
    check('B43 the hero is never invisible during the 60 i-frames: every blink frame still draws a silhouette (' + r.blank + ' blank frames; min ' + r.min + ' px vs ' + r.solid + ' solid)', r.blank === 0 && r.min >= r.solid * 0.5, r);

    // =============================================================================================== B26
    r = await ev((d, g, P) => {
      P.fresh('tessik'); const b = P.startFight('dc_shrine', 'dc_sentinel');
      d.god(false); P.bigHp(); P.hurts.length = 0;
      const SX = 10 * 30 + 15, SY = 12 * 30;   // the left row-12 shelf (x8–11): feet y 360
      d.teleport(SX, SY); d.step(2);
      const atks = {}, onShelf = {}; let lastAtk = '', f = 0;
      for (; f < 900 && g.bossFight.state === 'fight'; f++) {
        const pl = g.player;
        if (pl.onGround && pl.hurtTimer <= 0 && Math.abs(pl.y - SY) > 1 && g.mode === 'normal') { d.teleport(SX, SY); }   // climbs back onto the shelf
        pl.facing = b.x < pl.x ? -1 : 1;
        if (Math.abs(b.x - pl.x) < 90 && f % 4 === 0) d.pressed('light', 1);
        if (b.state === 'tell' && b.attack !== lastAtk) { atks[b.attack] = (atks[b.attack] || 0) + 1; if (pl.onGround && Math.abs(pl.y - SY) < 1 && Math.abs(b.x - pl.x) < 200) onShelf[b.attack] = (onShelf[b.attack] || 0) + 1; }
        lastAtk = b.state === 'tell' ? b.attack : '';
        d.step(1);
        if (g.mode === 'hazard') P.waitNormal(100);
        if (pl.hp < 50) P.bigHp();
      }
      d.god(true);
      return { frames: f, bossHp: b.hp, hurts: P.hurts.length, tags: P.hurts.map(h => h.tag), atks, onShelf, fight: g.bossFight.state };
    });
    const shelfPicks = Object.entries(r.onShelf);
    check('B26 Tallock never wastes a floor-only attack (Slab Swing / Stomp Quake) on a fighter standing on a row-12 shelf within 200 px: picks while camped ' + JSON.stringify(r.onShelf),
      shelfPicks.length >= 1 && !r.onShelf.slabSwing && !r.onShelf.stompQuake, r);
    check('B26 a shelf camper spamming Light takes ≥ 3 hits from shelf-reaching attacks and Tallock is not beaten inside 10.4 s (' + r.hurts + ': ' + r.tags.join(' ') + ', ' + r.frames + ' f)', r.hurts >= 3 && (r.frames > 624 || r.fight === 'fight'), r);

    // =============================================================================================== B27
    r = await ev((d, g, P) => {
      P.fresh('brackmaw'); const b = P.startFight('dc_shrine', 'dc_sentinel');
      d.god(false); P.bigHp(); P.hurts.length = 0;
      d.teleport(b.x, b.y - b.h - 40); d.step(1);
      let pogos = 0, fallArmed = true, shrug = null, f = 0, maxConsec = 0;
      const tells = [];
      let curTell = null;
      for (; f < 636 && g.bossFight.state === 'fight'; f++) {
        const pl = g.player;
        const dx = b.x - pl.x;
        if (Math.abs(dx) > 6) d.pressed(dx > 0 ? 'right' : 'left', 1);
        if (pl.onGround) fallArmed = true;
        if (!pl.onGround && pl.vy > 0 && fallArmed && pl.y < b.y - b.h + 4 && pl.moveName !== 'down') { d.pressed('down', 8); d.pressed('light', 1); fallArmed = false; }
        if (pl.vy < -500) fallArmed = true;
        const vy0 = pl.vy;
        d.step(1);
        if (pl.vy <= -570 && vy0 > -100) pogos++;
        if (b.state === 'tell' && b.attack === 'stackShrug') { if (!curTell) { curTell = { f, len: 0, pogosBefore: b.pogoN }; tells.push(curTell); } curTell.len++; }
        else curTell = null;
        if (pl.onGround && pl.y >= b.A.floorY - 0.5 && g.mode === 'normal' && pl.hurtTimer <= 0) d.teleport(b.x, b.y - b.h - 40);   // knocked off: climb back up (the bot keeps trying)
        if (pl.hp < 50) P.bigHp();
      }
      d.god(true);
      return { frames: f, pogos, hurts: P.hurts.length, tags: P.hurts.map(h => h.tag), tells, bossHp: b.hp, fight: g.bossFight.state };
    });
    check('B27 Tallock breaks a pogo-lock: Brackmaw pogo-ing his head for 10.6 s triggers the Stack Shrug (' + r.tells.length + ' times) and takes hits (' + r.hurts + ': ' + r.tags.join(' ') + ')',
      r.tells.length >= 1 && r.hurts >= 1 && r.tags.includes('shrug'), r);
    check('B27 the Shrug is telegraphed ≥ 20 f and fires only after ≥ 3 consecutive head pogos', r.tells.length >= 1 && r.tells.every(t => t.len >= 20 && t.pogosBefore >= 3), r.tells);

    // =============================================================================================== B33
    r = await ev((d, g, P) => {
      P.fresh('tessik'); const b = P.startFight('dc_shrine', 'dc_sentinel');
      const A = b.A;
      d.teleport(b.x - 160, A.floorY); d.step(2);
      b.state = 'tell'; b.atk = 4; b.attack = 'stackSlam'; b.timer = 40; b.vx = 0;
      const c = P.canvas(), ctx = c.getContext('2d');
      const marks = [];
      const origE = ctx.ellipse.bind(ctx);
      ctx.ellipse = function (x, y, rx, ry) { marks.push({ x: Math.round(x), y: Math.round(y), rx, ry }); return origE.apply(null, arguments); };
      const rows = [];
      for (let f = 0; f < 120; f++) {
        if (b.state === 'tell') { g.player.x = b.x - 160 + f * (100 / 40); g.player.px = g.player.x; }
        d.step(1);
        marks.length = 0; b.draw(ctx, g, 1);
        const m = marks.find(e => e.y === Math.round(A.floorY - 2) && e.rx >= 40);
        rows.push({ f, st: b.state, mx: m ? m.x : null, slamX: Math.round(b.slamX), bx: Math.round(b.x), px: Math.round(g.player.x) });
        if (b.state === 'shock') break;
      }
      const slam = rows.filter(r => r.st === 'slam');
      const land = rows.find(r => r.st === 'shock');
      const tellEnd = rows.filter(r => r.st === 'tell').slice(-1)[0];
      return { slamN: slam.length, slamMarked: slam.filter(r => r.mx !== null && Math.abs(r.mx - r.slamX) <= 1).length, landX: land ? land.bx : null, slamX: slam.length ? slam[0].slamX : null, tellEnd, first: rows[0], sample: slam.slice(0, 3) };
    });
    check('B33 Stack Slam: the landing marker stays on screen at the frozen landing x through the whole arc (' + r.slamMarked + '/' + r.slamN + ' arc frames marked at x ' + r.slamX + ') and Tallock lands there (x ' + r.landX + ')',
      r.slamN >= 30 && r.slamMarked === r.slamN && r.landX !== null && Math.abs(r.landX - r.slamX) <= 4, r);

    // =============================================================================================== B34
    r = await ev((d, g, P) => {
      P.fresh('tessik'); const b = P.startFight('dc_shrine', 'dc_sentinel');
      d.god(false); P.bigHp(); P.hurts.length = 0;
      d.teleport(45, b.A.floorY); d.step(1);
      let run = 0, maxRun = 0, minGap = 1e9, slams = 0, prevSt = '';
      for (let f = 0; f < 1800 && g.bossFight.state === 'fight'; f++) {
        d.step(1);
        const pl = g.player;
        if (pl.hp < 50) P.bigHp();
        if (g.mode === 'hazard') P.waitNormal(100);
        // overlap while the stack stands on the floor (its airborne descent onto the fighter IS the slam's body hit)
        const ov = b.state !== 'slam' && Math.abs(pl.x - b.x) < (pl.w + b.w) / 2 && pl.y > b.y - b.h && pl.y - pl.h < b.y;
        run = ov ? run + 1 : 0; if (run > maxRun) maxRun = run;
        const gap = Math.abs(pl.x - b.x) - (pl.w + b.w) / 2; if (b.state !== 'slam' && gap < minGap) minGap = gap;
        if (b.state === 'shock' && prevSt !== 'shock') slams++;
        prevSt = b.state;
      }
      d.god(true);
      const hz = P.hurts.map(h => h.f);
      let minDt = 1e9; for (let i = 1; i < hz.length; i++) minDt = Math.min(minDt, hz[i] - hz[i - 1]);
      return { hurts: P.hurts.length, tags: P.hurts.map(h => h.tag), maxRun, minGap: Math.round(minGap), slams, contact: P.hurts.filter(h => h.tag === 'contact').length };
    });
    check('B34 a fighter idling cornered at the left wall for 30 s is never pinned inside Tallock: with the stack on the floor an overlap lasts ≤ 2 frames (max ' + r.maxRun + '), ' + r.slams + ' slams, ' + r.contact + ' body-contact hits of ' + r.hurts,
      r.maxRun <= 2 && r.contact <= r.slams + 1, r);

    // =============================================================================================== B36
    r = await ev((d, g, P) => {
      const out = {};
      for (const mode of ['jump', 'stand']) {
        P.fresh('tessik'); d.grant('echoJump', true); const b = P.startFight('lw_rest', 'lw_weftyr');
        const A = b.A;
        d.teleport(360, A.floorY); d.step(2);
        d.god(false); P.bigHp(); P.hurts.length = 0; g.player.iframes = 0;
        b.state = 'tell'; b.atk = 'snare'; b.attack = 'snare'; b.timer = 24; b.tx = A.cx; b.ty = 11 * 30 + 15; b.snare = null;
        let laid = -1, landed = -1, gone = -1;
        for (let f = 0; f < 260; f++) {
          if (mode === 'jump' && f === 18) d.pressed('jump', 12);
          d.step(1);
          if (laid < 0 && b.snare) laid = f;
          if (laid >= 0 && landed < 0 && g.player.onGround && f > 20) landed = f;
          if (laid >= 0 && gone < 0 && b.snare && b.snare.dead) gone = f;
          if (b.state === 'tell' && b.atk === 'dash') { b.state = 'cruise'; b.timer = 9999; }   // keep the follow-up Thread Dash away
          if (b.state === 'cruise') { b.timer = 9999; b.tx = A.cx; b.ty = 4 * 30; }
        }
        out[mode] = { laid, landed, gone, hurts: P.hurts.slice() };
        d.god(true);
      }
      return out;
    });
    check('B36 a fighter who jumps the Snare Line as it is laid lands on it unhurt (it snaps underfoot): laid f' + r.jump.laid + ', landed f' + r.jump.landed + ', thread gone f' + r.jump.gone,
      r.jump.laid >= 0 && r.jump.landed > r.jump.laid && r.jump.hurts.length === 0 && r.jump.gone >= 0 && r.jump.gone <= r.jump.landed + 1, r.jump);
    check('B36 a fighter standing in it when it is laid is still caught (1, tag snare) and the thread snaps', r.stand.hurts.length === 1 && r.stand.hurts[0].tag === 'snare' && r.stand.gone >= 0, r.stand);

    // =============================================================================================== B38
    r = await ev((d, g, P) => {
      P.fresh('tessik'); d.grant('echoJump', true); d.grant('burstLine', true); const b = P.startFight('bv_rest', 'bv_corrosant');
      const A = b.A;
      const f = P.until(() => b.hy < A.ceilY + 40 && b.state !== 'roar', 3000, () => { g.player.x = A.cx; g.player.y = A.floorY; g.player.vx = 0; });
      g.player.x = b.hx; g.player.y = A.floorY; d.step(1);
      b.update = function () { this.t++; };   // hold it on the ceiling
      g.player.x = b.hx; g.player.y = A.floorY; d.step(2);
      const camTop = g.cam.y, headY = b.hy;
      const focus = { x: b.focusX, y: b.focusY };
      // the beacon: render with and without it and compare the view's top band over the head's x
      const band = function () { P.renderAt(); return P.worldRect(Math.round(b.hx) - 40, Math.round(g.cam.y) + 4, 80, 140, 4); };
      const withB = band();
      b.noBeacon = true; const without = band(); b.noBeacon = false;
      let diff = 0; for (let i = 0; i < withB.length; i++) diff += Math.abs(withB[i][0] - without[i][0]) + Math.abs(withB[i][1] - without[i][1]) + Math.abs(withB[i][2] - without[i][2]);
      return { f, camTop: Math.round(camTop), headY: Math.round(headY), offscreen: headY + 20 < camTop, focus, diff, n: withB.length };
    });
    check('B38 Corrosant exposes its camera focus (the head) for the boss framing', r.focus && Math.abs(r.focus.y - r.headY) <= 25 && r.focus.x !== undefined, r);
    check('B38 with the head on the ceiling above the floor-standing camera (head y ' + r.headY + ' < view top ' + r.camTop + '), an edge beacon is drawn inside the view at the head\'s x', r.offscreen && r.diff > 2000, r);

    // =============================================================================================== B41
    r = await ev((d, g, P) => {
      const out = {};
      P.fresh('tessik'); const b = P.startFight('rw_rest', 'rw_throne');
      const A = b.A, zp = window.UB.World.zones.rootwell.palette;
      // Root Spikes up, the player clear of every spot
      d.teleport(A.x0 + 60, A.floorY); d.step(2);
      b.state = 'tell'; b.atk = 2; b.attack = 'rootSpikes'; b.timer = 2;
      for (let i = 0; i < 5; i++) b.spots[i] = A.x0 + 240 + i * 120;   // all clear of the seated mass (x ≥ 882)
      d.step(14);
      g.player.x = A.x0 + 60; g.player.y = A.floorY;
      P.renderAt();
      const spike = [], bg = [];
      for (let i = 0; i < 5; i++) {
        const sx = b.spots[i];
        for (let y = A.floorY - 26; y <= A.floorY - 4; y += 2) { const p = P.worldPx(sx - 6, y + 4); if (p) spike.push(P.lum(p[0], p[1], p[2])); }
        for (let y = A.floorY - 60; y <= A.floorY - 40; y += 4) { const p = P.worldPx(sx + 40, y); if (p) bg.push(P.lum(p[0], p[1], p[2])); }
      }
      const med = function (a) { const s = a.slice().sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
      out.spikes = { state: b.state, spikeL: med(spike), bgL: med(bg), floorEdgeL: P.hexLum(zp.tileEdge), floorL: P.hexLum(zp.tileFill) };
      out.spikes.cBg = P.contrast(out.spikes.spikeL, out.spikes.bgL); out.spikes.cEdge = P.contrast(out.spikes.spikeL, out.spikes.floorEdgeL);
      // Cable Sweep: the cable body must read against the floor (pale rim), the whip-tip by luminance
      d.step(40); b.state = 'idle'; b.timer = 9999; d.step(2);
      b.state = 'tell'; b.atk = 1; b.attack = 'cableSweep'; b.timer = 2; b.cableSide = -1; b.cableTip = b.x - 75;   // the left cable: in view of the left-standing camera
      P.until(() => b.state === 'cableHold', 200, () => { g.player.x = A.x0 + 60; g.player.y = A.floorY; });
      P.renderAt();
      // sample the slack cable between the root and the tip: the brightest pixel in a vertical strip through it
      const strips = [];
      for (let x = b.x - 120; x > b.cableTip + 60; x -= 20) { let best = 0; for (let y = A.floorY - 60; y <= A.floorY - 2; y += 1) { const p = P.worldPx(x, y); if (p) best = Math.max(best, P.lum(p[0], p[1], p[2])); } strips.push(best); }
      out.cable = { state: b.state, tip: Math.round(b.cableTip), strips: strips.map(v => +v.toFixed(3)), floorL: P.hexLum(zp.tileFill), bg: out.spikes.bgL };
      out.cable.minStrip = Math.min(...strips);
      return out;
    });
    check('B41 Root Spikes read by luminance against the Rootwell arena (contrast ≥ 3:1 vs the background, ≥ 3:1 vs the red floor edge): ' + r.spikes.cBg.toFixed(2) + ' / ' + r.spikes.cEdge.toFixed(2),
      r.spikes.state === 'spikes' && r.spikes.cBg >= 3 && r.spikes.cEdge >= 3, r.spikes);
    check('B41 the Cable Sweep cable is outlined pale along its whole length (every strip has a pixel ≥ 3:1 against the arena background): min strip L ' + r.cable.minStrip.toFixed(3),
      (r.cable.state === 'cableOut' || r.cable.state === 'cableHold') && r.cable.strips.length >= 3 && P_contrast(r.cable.minStrip, r.cable.bg) >= 3, r.cable);
  } catch (err) {
    check('test script ran without throwing', false, String(err && err.stack || err));
  }
  check('no console errors / page errors', t.errors.length === 0, t.errors.slice(0, 5));
  await t.close();
  const failed = results.filter(x => !x.ok).length;
  // the standard summary line (run-all.cjs and qa-ip-code G2 read "N/M checks passed")
  console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed' + (failed ? ' — ' + failed + ' FAILED' : ''));
  process.exit(failed ? 1 : 0);
})();

function P_contrast(a, b) { return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }
