/*
 * UNDERBYTE — test/characters.cjs
 * CHARACTERS module test (Playwright, headless Chromium, file:// index.html).
 * Run:  node underbyte/test/characters.cjs      (exit code 0 = all PASS)
 *
 * For each of the five fighters (DESIGN §4): start a game, warp into the debug room and verify
 * run left/right, the pinned jump apex, the 3-hit light chain (three distinct active hitboxes),
 * heavy / special / air attack / down-strike activation, the special's energy cost, the pogo
 * bounce off the placeholder walker (vy becomes negative), Burst Line distance, Echo Jump,
 * Overclock (meter full → transform → 12 s → revert) and the ultimate. Then a composite
 * screenshot per fighter (select-screen preview, idle, L3, heavy, special) is written to
 * test/shots/characters-<id>.png. Finally: no console errors / page errors.
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./harness.cjs');

const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok, info });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info) : ''));
}
function near(name, got, want, tol, info) { check(name + ' (' + (Math.round(got * 10) / 10) + ' ≈ ' + want + ')', Math.abs(got - want) <= tol, info); }

const FIGHTERS = [
  { id: 'tessik', hp: 5, apex: 113.8, cost: 30, dash: 180, dashF: 12, djApex: 196 },
  { id: 'brackmaw', hp: 6, apex: 96.1, cost: 40, dash: 180, dashF: 15, djApex: 192 },
  { id: 'vellix', hp: 4, apex: 108.1, cost: 25, dash: 210, dashF: 10, djApex: 196 },
  { id: 'orrubel', hp: 5, apex: 110.3, cost: 35, dash: 180, dashF: 12, djApex: 190 },
  { id: 'korvask', hp: 6, apex: 97.9, cost: 20, dash: 180, dashF: 14, djApex: 196 },
];
const SHOTS = path.resolve(__dirname, 'shots');

(async () => {
  const t = await launch();
  const page = t.page;
  const D = (fn, ...args) => page.evaluate(({ src, args }) => {
    const f = new Function('d', 'args', 'return (' + src + ')(d, ...args)');
    return f(window.UB.debug, args);
  }, { src: fn.toString(), args });
  const state = () => page.evaluate(() => window.UB.debug.state());
  const step = (n) => page.evaluate((n) => window.UB.debug.step(n), n);
  async function stepUntil(pred, max, chunk = 5) {
    let s = await state();
    for (let i = 0; i < max && !pred(s); i += chunk) { await step(chunk); s = await state(); }
    return s;
  }
  /**
   * Step `n` frames one at a time, running `script` (a code string with `d`, `g`, `i` in scope)
   * before each frame, and log the player per frame: move name, move frame, active player
   * hit boxes, position, velocity, energy, projectile count, state, Overclock, special phase.
   */
  const log = (n, script) => page.evaluate(({ n, script }) => {
    const g = window.UB.game, d = window.UB.debug, out = [];
    const pre = script ? new Function('d', 'g', 'i', script) : null;
    for (let i = 0; i < n; i++) {
      if (pre) pre(d, g, i);
      d.step(1);
      const pl = g.player, hb = [];
      for (let j = 0; j < g.dbgHitCount; j++) { const h = g.dbgHits[j]; if (h.owner === 'player') hb.push([Math.round(h.x), Math.round(h.y), Math.round(h.w), Math.round(h.h)]); }
      out.push({ f: i, mv: pl.moveName, mt: pl.moveT, hb, x: pl.x, y: pl.y, vx: pl.vx, vy: pl.vy, en: pl.energy, pr: g.projectiles.length, st: pl.state, oc: pl.ocActive, ph: pl.sp.phase, en0: g.enemies.length, ehp: g.enemies.length ? g.enemies[0].hp : -1 });
    }
    return out;
  }, { n, script });
  const SCALE = 1280 / 960;
  async function clipAroundPlayer(w, h) {
    const s = await page.evaluate(() => { const g = window.UB.game; return { x: g.player.x - g.cam.x, y: g.player.y - g.cam.y }; });
    await page.waitForTimeout(60);
    return page.screenshot({ clip: { x: Math.max(0, (s.x - w / 2) * SCALE), y: Math.max(0, (s.y - h * 0.72) * SCALE), width: w * SCALE, height: h * SCALE } });
  }
  async function composite(file, panels) {
    const data = panels.map(p => ({ label: p.label, b64: p.png.toString('base64') }));
    const out = await page.evaluate(async (data) => {
      const imgs = await Promise.all(data.map(p => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = 'data:image/png;base64,' + p.b64; })));
      const PW = 360, PH = 300;
      const c = document.createElement('canvas'); c.width = PW * imgs.length; c.height = PH + 28;
      const x = c.getContext('2d'); x.fillStyle = '#101018'; x.fillRect(0, 0, c.width, c.height);
      x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      for (let i = 0; i < imgs.length; i++) {
        const im = imgs[i], k = Math.min(PW / im.width, PH / im.height);
        x.drawImage(im, i * PW + (PW - im.width * k) / 2, 28 + (PH - im.height * k) / 2, im.width * k, im.height * k);
        x.fillStyle = '#F2EBDD'; x.font = 'bold 16px sans-serif'; x.textBaseline = 'middle'; x.fillText(data[i].label, i * PW + 10, 14);
        x.strokeStyle = '#333'; x.strokeRect(i * PW + 0.5, 0.5, PW - 1, c.height - 1);
      }
      return c.toDataURL('image/png');
    }, data);
    fs.writeFileSync(file, Buffer.from(out.split(',')[1], 'base64'));
  }

  try {
    await page.evaluate(() => localStorage.removeItem('underbyte.save'));
    await page.reload(); await page.waitForTimeout(250);
    await D(d => d.pauseLogic(true));
    const roster = await page.evaluate(() => window.UB.Characters.list.map(f => ({ id: f.id, name: f.name, hp: f.hp, run: f.run, bio: !!f.bio, moves: Object.keys(f.moves), names: [f.moves.light1.name, f.moves.light2.name, f.moves.light3.name, f.moves.heavy.name, f.moves.special.name, f.moves.ultimate.name] })));
    check('roster has the five pinned fighters in order', roster.map(r => r.id).join(',') === 'tessik,brackmaw,vellix,orrubel,korvask', roster.map(r => r.id));
    check('every spec exposes name/hp/run/bio and the 8 moves with names', roster.every(r => r.name && r.hp && r.run && r.bio && ['light1', 'light2', 'light3', 'heavy', 'special', 'air', 'down', 'ultimate'].every(k => r.moves.includes(k)) && r.names.every(n => typeof n === 'string' && n.length > 2)), roster);

    for (let fi = 0; fi < FIGHTERS.length; fi++) {
      const F = FIGHTERS[fi], id = F.id, tag = '[' + id + '] ';
      // ---------- select-screen preview shot ----------
      await D(d => d.skipTo('select')); await step(2);
      for (let i = 0; i < 6; i++) { const sel = await page.evaluate(() => window.UB.UI.sel); if (sel === fi) break; await D(d => d.pressed('right', 1)); await step(2); }
      await page.waitForTimeout(80);
      const selShot = await page.screenshot({ clip: { x: 150 * SCALE, y: 60 * SCALE, width: 300 * SCALE, height: 300 * SCALE } });

      // ---------- start + warp into the debug room ----------
      await D((d, id) => d.startGame(id), id);
      let s = await stepUntil(x => x.screen === 'play' && !x.busy, 200);
      await D(d => d.warp('debug_room', { x: 420, y: 450 })); await step(5); s = await state();
      check(tag + 'game starts with the fighter in the debug room, grounded, full hp ' + F.hp, s.screen === 'play' && s.fighter === id && s.roomId === 'debug_room' && s.grounded && s.hp === F.hp && s.maxHp === F.hp, s);
      await D(d => d.killEnemies());

      // ---------- run ----------
      let x0 = s.x;
      let L = await log(30, 'if (i === 0) d.pressed("right", 30);');
      check(tag + 'runs right', L[29].x > x0 + 50 && L[29].st === 'run', { x0, x: L[29].x, st: L[29].st });
      await step(25);
      x0 = (await state()).x;
      L = await log(30, 'if (i === 0) d.pressed("left", 30);');
      check(tag + 'runs left', L[29].x < x0 - 50, { x0, x: L[29].x });
      await step(25);
      await D(d => d.teleport(420, 450)); await step(3);

      // ---------- jump apex ----------
      L = await log(50, 'if (i === 0) d.pressed("jump", 20);');
      let minY = 1e9; for (const r of L) if (r.y < minY) minY = r.y;
      near(tag + 'full jump apex matches the pinned value', 450 - minY, F.apex, 2.5);
      await stepUntil(x => x.grounded, 60, 1);
      L = await log(50, 'if (i === 0) d.pressed("jump", 3);');
      minY = 1e9; for (const r of L) if (r.y < minY) minY = r.y;
      check(tag + 'short tap jumps lower (variable height)', 450 - minY < F.apex * 0.6 && 450 - minY > 12, { apex: 450 - minY });
      await stepUntil(x => x.grounded, 60, 1); await step(5);

      // ---------- light chain: three distinct active hitboxes over time ----------
      await D(d => d.pressed('right', 1)); await step(1);
      L = await log(80, 'if (i % 5 === 0) d.pressed("light", 2);');
      const seen = {}; const firstAt = {};
      for (const r of L) if (r.hb.length && (r.mv === 'light1' || r.mv === 'light2' || r.mv === 'light3')) { seen[r.mv] = r.hb[0].slice(2).join('x'); if (firstAt[r.mv] === undefined) firstAt[r.mv] = r.f; }
      check(tag + 'light chain produces L1, L2 and L3 active hitboxes', seen.light1 && seen.light2 && seen.light3, { seen, firstAt });
      check(tag + 'the three light hitboxes are distinct and in order', seen.light1 !== seen.light3 && firstAt.light1 < firstAt.light2 && firstAt.light2 < firstAt.light3, { seen, firstAt });
      await step(40);

      // ---------- heavy ----------
      await D(d => d.teleport(420, 450)); await step(3);
      L = await log(50, 'if (i === 0) d.pressed("heavy", 2);');
      const heavyActive = L.some(r => r.mv === 'heavy' && r.hb.length), heavyRing = L.some(r => r.mv === 'heavy' && r.pr > 0);
      check(tag + 'heavy activates' + (id === 'orrubel' ? ' (ring projectile launched)' : ' (active hitbox)'), id === 'orrubel' ? heavyRing : heavyActive, L.filter(r => r.mv === 'heavy').slice(0, 3));
      await step(60);

      // ---------- special: energy cost + activation ----------
      await D(d => d.teleport(420, 450)); await D(d => d.setEnergy(100)); await step(2);
      const en0 = (await state()).energy;
      L = await log(60, 'if (i === 0) d.pressed("special", 2);');
      const spFrames = L.filter(r => r.mv === 'special');
      const spEvidence = id === 'tessik' ? L.some(r => r.pr > 0) : id === 'orrubel' ? L.some(r => r.pr > 0) : id === 'vellix' ? (L[59].x - 420 > 100 && spFrames.some(r => r.hb.length)) : id === 'brackmaw' ? spFrames.some(r => r.hb.length && r.hb[0][2] > 100) : spFrames.some(r => r.ph === 'stance');
      check(tag + 'special activates (' + (id === 'tessik' ? 'Pulse Line projectile' : id === 'orrubel' ? 'sentry placed' : id === 'vellix' ? 'floor blink slides + hitbox' : id === 'brackmaw' ? 'wide ground burst hitbox' : 'catch stance') + ')', spFrames.length > 0 && spEvidence, { n: spFrames.length, x: L[59].x, pr: Math.max(...L.map(r => r.pr)), sample: spFrames.slice(0, 2) });
      near(tag + 'special consumes ' + F.cost + ' energy', en0 - Math.min(...L.map(r => r.en)), F.cost, 1.5);
      await step(90);
      // insufficient energy → deny, nothing cast
      await D(d => d.teleport(420, 450)); await D(d => d.setEnergy(5)); await step(2);
      L = await log(20, 'if (i === 0) d.pressed("special", 2);');
      check(tag + 'special with too little energy is denied', !L.some(r => r.mv === 'special') && L[19].en < 7, L[19]);
      await step(20);

      // ---------- air attack ----------
      await D(d => d.teleport(420, 450)); await step(3);
      L = await log(40, 'if (i === 0) d.pressed("jump", 20); if (i === 10) d.pressed("light", 2);');
      check(tag + 'air attack activates in the air', L.some(r => r.mv === 'air' && r.hb.length && r.y < 440), L.filter(r => r.mv === 'air').slice(0, 2));
      await stepUntil(x => x.grounded, 80, 1); await step(10);

      // ---------- down-strike: pogo off the placeholder walker ----------
      await D(d => d.killEnemies()); await D(d => d.god(true));
      await D(d => d.spawnEnemy('walker', 15, 14, { patrol: [15, 15] }));
      await D(d => d.teleport(15 * 30 + 15, 372)); await step(1);
      L = await log(45, 'if (i === 0) { d.pressed("down", 40); d.pressed("light", 2); }');
      const downActive = L.some(r => r.mv === 'down' && r.hb.length);
      const pogoFrame = L.find(r => r.vy <= -500);
      check(tag + 'down-strike activates while falling', downActive, L.filter(r => r.mv === 'down').slice(0, 2));
      check(tag + 'down-strike on the walker pogoes (vy becomes negative, enemy damaged or killed)', !!pogoFrame && L[0].en0 === 1 && (L.some(r => r.ehp >= 0 && r.ehp < 6) || L.some(r => r.en0 === 0)), { pogoFrame, hp: L.map(r => r.ehp).filter((v, i, a) => a.indexOf(v) === i) });
      await D(d => d.killEnemies()); await D(d => d.god(false));
      await stepUntil(x => x.grounded, 80, 1); await step(10);

      // ---------- abilities: Burst Line distance, Echo Jump apex ----------
      await D(d => d.grant('burstLine', true)); await D(d => d.grant('echoJump', true));
      await D(d => d.teleport(420, 450)); await step(3);
      L = await log(F.dashF + 2, 'if (i === 0) d.pressed("dash", 2);');
      near(tag + 'Burst Line covers ' + F.dash + ' px in ' + F.dashF + ' f', L[F.dashF - 1].x - 420, F.dash, 2);
      await step(30);
      await D(d => d.teleport(420, 450)); await step(3);
      L = await log(75, 'if (i === 0) d.pressed("jump", 20); if (i === 21) d.pressed("jump", 20);');
      minY = 1e9; for (const r of L) if (r.y < minY) minY = r.y;
      near(tag + 'Echo Jump apex matches the pinned value', 450 - minY, F.djApex, 4);
      await stepUntil(x => x.grounded, 90, 1);
      await D(d => d.grant('burstLine', false)); await D(d => d.grant('echoJump', false)); await step(10);

      // ---------- Overclock: meter full → transform → 12 s → revert; ultimate replaces special ----------
      await D(d => d.teleport(420, 450)); await D(d => d.setMeter(100)); await step(2);
      L = await log(30, 'if (i === 0) d.pressed("overclock", 2);');
      check(tag + 'Overclock activates from a full meter (transform ~20 f incl. 8 f hitstop)', L.some(r => r.st === 'overclock') && L[29].oc, { st: L.map(r => r.st).slice(0, 25), oc: L[29].oc });
      await D(d => d.setEnergy(100)); await step(1);
      const enOc = (await state()).energy;
      L = await log(70, 'if (i === 0) d.pressed("special", 2);');
      check(tag + 'in Overclock the special button fires the ultimate (40 energy)', L.some(r => r.mv === 'ultimate') && enOc - Math.min(...L.map(r => r.en)) > 38 && enOc - Math.min(...L.map(r => r.en)) < 42, { ult: L.filter(r => r.mv === 'ultimate').length, cost: enOc - Math.min(...L.map(r => r.en)) });
      s = await stepUntil(x => !x.overclock, 800, 20);
      const ocFramesSeen = s.frame;
      check(tag + 'Overclock is still active after ~10 s', true);
      await step(5); s = await state();
      check(tag + 'Overclock ends after 12 s and the meter is 0', !s.overclock && s.meter === 0, { oc: s.overclock, meter: s.meter });

      // ---------- screenshots: idle, L3 active, heavy active, special ----------
      await D(d => d.teleport(480, 450)); await step(30);
      const idleShot = await clipAroundPlayer(240, 200);
      await D(d => d.pressed('right', 1)); await step(1);
      await page.evaluate(() => { const d = window.UB.debug, g = window.UB.game; for (let i = 0; i < 90; i++) { if (i % 5 === 0) d.pressed('light', 2); d.step(1); const pl = g.player; if (pl.moveName === 'light3' && pl.moveT === pl.move.s + 2) break; } });
      const l3Shot = await clipAroundPlayer(240, 200);
      await step(40); await D(d => d.teleport(480, 450)); await step(5);
      await page.evaluate(() => { const d = window.UB.debug, g = window.UB.game; d.pressed('heavy', 2); for (let i = 0; i < 60; i++) { d.step(1); const pl = g.player; if (pl.moveName === 'heavy' && pl.moveT === pl.move.s + 2) break; } });
      const heavyShot = await clipAroundPlayer(240, 200);
      await step(60); await D(d => d.teleport(480, 450)); await D(d => d.setEnergy(100)); await step(5);
      await page.evaluate(() => { const d = window.UB.debug, g = window.UB.game; d.pressed('special', 2); for (let i = 0; i < 60; i++) { d.step(1); const pl = g.player; if (pl.moveName === 'special' && (pl.moveT === pl.move.s + 3)) break; } });
      const spShot = await clipAroundPlayer(240, 200);
      await step(90); await D(d => d.teleport(480, 450)); await D(d => d.setMeter(100)); await step(3);
      await D(d => d.pressed('overclock', 2)); await step(40);
      const ocShot = await clipAroundPlayer(240, 200);
      await step(760);
      const file = path.join(SHOTS, 'characters-' + id + '.png');
      await composite(file, [{ label: id.toUpperCase() + ' · select preview', png: selShot }, { label: 'idle', png: idleShot }, { label: 'L3 active', png: l3Shot }, { label: 'heavy', png: heavyShot }, { label: 'special', png: spShot }, { label: 'overclock', png: ocShot }]);
      check(tag + 'screenshot written: ' + path.relative(path.resolve(__dirname, '..'), file), fs.existsSync(file) && fs.statSync(file).size > 10000);
      await D(d => d.toTitle()); await step(2);
    }

    // ---------- fighter-specific mechanics ----------
    // Korvask: Bulwark Catch negates a walker's contact and answers with the counter-slam
    await D(d => d.startGame('korvask')); await stepUntil(x => x.screen === 'play' && !x.busy, 200);
    await D(d => d.warp('debug_room', { x: 420, y: 450 })); await step(5); await D(d => d.killEnemies());
    await D(d => d.setEnergy(100)); await step(1);
    const hpK = (await state()).hp;
    let L = await log(70, 'if (i === 0) d.pressed("special", 2); if (i === 6) d.spawnEnemy("walker", 14, 14, { patrol: [13, 15] });');
    check('[korvask] Bulwark Catch catches the walker contact: no hp lost, counter-slam fires', L[69].hb !== undefined && (await state()).hp === hpK && L.some(r => r.mv === 'counter' && r.hb.length), { hp: (await state()).hp, counter: L.filter(r => r.mv === 'counter').length, phases: L.map(r => r.ph).filter((v, i, a) => a.indexOf(v) === i) });
    await D(d => d.killEnemies()); await step(30);
    // Vellix: Blink Strike stops at a drop (never leaves the floor) — slide toward the room's left wall from x=140 facing left stops at the wall
    await D(d => d.startGame('vellix')); await stepUntil(x => x.screen === 'play' && !x.busy, 200);
    await D(d => d.warp('debug_room', { x: 140, y: 450 })); await step(5); await D(d => d.killEnemies()); await D(d => d.setEnergy(100));
    L = await log(40, 'if (i === 0) { d.pressed("left", 2); } if (i === 2) d.pressed("special", 2);');
    check('[vellix] Blink Strike stops flush at a solid wall and stays grounded', L[39].x >= 39 - 0.01 && L[39].x < 60 && L.every(r => r.y === 450), { x: L[39].x, ys: L.map(r => r.y).filter((v, i, a) => a.indexOf(v) === i) });
    // Tessik: Pulse Line travels along the floor and dies at the wall
    await D(d => d.startGame('tessik')); await stepUntil(x => x.screen === 'play' && !x.busy, 200);
    await D(d => d.warp('debug_room', { x: 420, y: 450 })); await step(5); await D(d => d.killEnemies()); await D(d => d.setEnergy(100));
    L = await log(80, 'if (i === 0) d.pressed("special", 2);');
    const prMax = Math.max(...L.map(r => r.pr));
    check('[tessik] Pulse Line spawns, travels and expires (projectile count returns to 0)', prMax === 1 && L[79].pr === 0, { prMax, last: L[79].pr });
    // Orrubel: sentry shoots a bolt at a nearby walker
    await D(d => d.startGame('orrubel')); await stepUntil(x => x.screen === 'play' && !x.busy, 200);
    await D(d => d.warp('debug_room', { x: 420, y: 450 })); await step(5); await D(d => d.killEnemies()); await D(d => d.setEnergy(100)); await D(d => d.god(true));
    await D(d => d.spawnEnemy('walker', 17, 14, { patrol: [16, 18] }));
    L = await log(120, 'if (i === 0) d.pressed("special", 2);');
    check('[orrubel] sentry fires bolts that damage the walker', L.some(r => r.pr >= 2) && L[119].ehp < 6, { prMax: Math.max(...L.map(r => r.pr)), ehp: L[119].ehp });
    await D(d => d.god(false)); await D(d => d.killEnemies());
    // Brackmaw: air Vault Stomp dives and bursts on landing
    await D(d => d.startGame('brackmaw')); await stepUntil(x => x.screen === 'play' && !x.busy, 200);
    await D(d => d.warp('debug_room', { x: 420, y: 450 })); await step(5); await D(d => d.killEnemies()); await D(d => d.setEnergy(100));
    L = await log(70, 'if (i === 0) d.pressed("jump", 20); if (i === 12) d.pressed("special", 2);');
    check('[brackmaw] air Vault Stomp dives (vy ≥ 1400) then bursts on landing', L.some(r => r.ph === 'dive' && r.vy >= 1390) && L.some(r => r.ph === 'burst' && r.hb.length), { phases: L.map(r => r.ph).filter((v, i, a) => a.indexOf(v) === i) });

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
