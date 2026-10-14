/*
 * UNDERBYTE — test/enemies.cjs
 * Enemies + bosses module test (Playwright, headless Chromium, file:// index.html).
 * Run:  node underbyte/test/enemies.cjs      (exit code 0 = all PASS)
 *
 * Spawns every DESIGN §7 enemy type (and each zone variant) into the debug room through
 * UB.debug.spawnEnemy, verifies it behaves (state changes / movement over 300 frames, never
 * inside a solid tile, never below the floor), takes damage from a light attack, dies to
 * repeated lights and drops bits. Then every DESIGN §8 boss is created in the debug arena with
 * UB.debug.spawnBoss: it must cycle through ≥ 3 different attacks within 1200 frames, lose hp
 * to a light attack, enrage / change phase at the design thresholds, die at 0 and call
 * onDefeated (rewards spawned; the final boss reaches the victory screen). Screenshots land in
 * test/shots/enemy-<type>.png and boss-<id>.png. Finally asserts no console/page errors.
 */
const path = require('path');
const { launch } = require('./harness.cjs');

const SHOTS = path.join(__dirname, 'shots');
const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok, info });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info) : ''));
}

const ENEMIES = [
  // ground walkers (feet tile 19,14 of debug_room; floor row 15) — player parked 7 tiles left
  { id: 'scuttlebit', type: 'scuttlebit', tx: 19, ty: 14, opts: { patrol: [15, 23] }, px: 12 },
  { id: 'scuttlebit-brinecrab', type: 'scuttlebit', tx: 19, ty: 14, opts: { patrol: [15, 23], variant: 'brinecrab' }, px: 12 },
  { id: 'scuttlebit-staticshot', type: 'scuttlebit', tx: 19, ty: 14, opts: { patrol: [15, 23], variant: 'staticshot' }, px: 12, shots: true },
  { id: 'scuttlebit-rootbound', type: 'scuttlebit', tx: 19, ty: 14, opts: { patrol: [15, 23], variant: 'rootbound' }, px: 12 },
  { id: 'hopnode', type: 'hopnode', tx: 19, ty: 14, opts: { patrol: [13, 25] }, px: 14 },
  { id: 'hopnode-dripnode', type: 'hopnode', tx: 19, ty: 14, opts: { patrol: [13, 25], variant: 'dripnode' }, px: 14 },
  { id: 'hopnode-nullnode', type: 'hopnode', tx: 19, ty: 14, opts: { patrol: [13, 25], variant: 'nullnode' }, px: 14 },
  { id: 'driftmoth', type: 'driftmoth', tx: 19, ty: 6, opts: null, px: 10, flyer: true },
  { id: 'brinejelly', type: 'brinejelly', tx: 19, ty: 7, opts: null, px: 10, flyer: true },
  { id: 'glarewisp', type: 'glarewisp', tx: 19, ty: 7, opts: null, px: 14, flyer: true },
  { id: 'glarewisp-rootwisp', type: 'glarewisp', tx: 19, ty: 7, opts: { variant: 'rootwisp' }, px: 14, flyer: true },
  { id: 'spitvalve', type: 'spitvalve', tx: 19, ty: 14, opts: { facing: -1 }, px: 12, shots: true },
  { id: 'spitvalve-acidvalve', type: 'spitvalve', tx: 19, ty: 14, opts: { facing: -1, variant: 'acidvalve' }, px: 12, shots: true },
  { id: 'spitvalve-twinvalve', type: 'spitvalve', tx: 19, ty: 14, opts: { facing: -1, variant: 'twinvalve' }, px: 12, shots: true },
  { id: 'rambyte', type: 'rambyte', tx: 19, ty: 14, opts: { patrol: [6, 23], facing: -1 }, px: 12 },
  { id: 'rambyte-rootram', type: 'rambyte', tx: 19, ty: 14, opts: { patrol: [6, 23], facing: -1, variant: 'rootram' }, px: 12 },
  { id: 'platewalker', type: 'platewalker', tx: 19, ty: 14, opts: { patrol: [8, 23], facing: -1 }, px: 12, shield: true },
  { id: 'platewalker-rootplate', type: 'platewalker', tx: 19, ty: 14, opts: { patrol: [8, 23], facing: -1, variant: 'rootplate' }, px: 12, shield: true },
  { id: 'broodcell', type: 'broodcell', tx: 19, ty: 14, opts: null, px: 12, spawner: true },
  { id: 'droplatch', type: 'droplatch', tx: 19, ty: 1, opts: null, px: 19, hanger: true },
  { id: 'voltwheel', type: 'voltwheel', tx: 19, ty: 14, opts: { patrol: [6, 23] }, px: 12 },
  { id: 'mote', type: 'mote', tx: 19, ty: 8, opts: null, px: 10, flyer: true, mote: true },
  { id: 'walker', type: 'walker', tx: 19, ty: 14, opts: { patrol: [15, 23] }, px: 12 },
];

const BOSSES = [
  { id: 'tallock', enrage: 36, hp: 120, ability: 'echoJump', bits: 3 },
  { id: 'weftyr', enrage: 54, hp: 180, ability: 'burstLine', bits: 5 },
  { id: 'corrosant', enrage: 72, hp: 240, ability: 'gripProtocol', bits: 7 },
  { id: 'kernauth', enrage: 60, hp: 200, hp2: 240, final: true },
];

(async () => {
  const t = await launch();
  const page = t.page;
  const D = (fn, ...args) => page.evaluate(({ src, args }) => {
    const f = new Function('d', 'args', 'return (' + src + ')(d, ...args)');
    return f(window.UB.debug, args);
  }, { src: fn.toString(), args });
  const G = (fn, ...args) => page.evaluate(({ src, args }) => {
    const f = new Function('g', 'args', 'return (' + src + ')(g, ...args)');
    return f(window.UB.game, args);
  }, { src: fn.toString(), args });
  const state = () => page.evaluate(() => window.UB.debug.state());
  const step = (n) => page.evaluate((n) => window.UB.debug.step(n), n);
  async function stepUntil(pred, max, chunk = 5) {
    let s = await state();
    for (let i = 0; i < max && !pred(s); i += chunk) { await step(chunk); s = await state(); }
    return s;
  }
  async function shot(name) { await page.waitForTimeout(60); await page.screenshot({ path: path.join(SHOTS, name) }); }
  /** Stand `side` of (x, y) at 34 px, face the target, light-attack, follow through `extra` frames. */
  const lightAt = (x, y, side, extra = 10) => page.evaluate(({ x, y, side, extra }) => {
    const d = window.UB.debug;
    d.teleport(x - side * 34, y); d.step(2);
    d.pressed(side > 0 ? 'right' : 'left', 1); d.step(1);
    d.pressed('light', 2); d.step(2 + extra);
    return d.state();
  }, { x, y, side, extra });
  const heavyAt = (x, y, side, extra = 22) => page.evaluate(({ x, y, side, extra }) => {
    const d = window.UB.debug;
    d.teleport(x - side * 34, y); d.step(2);
    d.pressed(side > 0 ? 'right' : 'left', 1); d.step(1);
    d.pressed('heavy', 2); d.step(2 + extra);
    return d.state();
  }, { x, y, side, extra });
  const enemiesOf = (type) => G((g, type) => g.enemies.filter(e => e.type === type && !e.dead).map(e => ({ x: e.x, y: e.y, hp: e.hp, state: e.state, facing: e.facing, w: e.w, h: e.h })), type);
  const clearWorld = () => G(g => { g.enemies.length = 0; g.projectiles.length = 0; g.pickups.length = 0; return true; });

  try {
    // ---------- boot ----------
    await page.evaluate(() => localStorage.removeItem('underbyte.save'));
    await page.reload(); await page.waitForTimeout(250);
    await D(d => d.pauseLogic(true));
    await D(d => d.newGame('tessik'));
    let s = await stepUntil(x => x.screen === 'play' && !x.busy, 200);
    check('new game reaches play in the start room', s.screen === 'play' && s.roomId === (await page.evaluate(() => window.UB.World.start.room)), s);
    const types = await page.evaluate(() => Object.keys(window.UB.Enemies.TYPES));
    const ids = await page.evaluate(() => window.UB.IDS.enemies);
    check('UB.Enemies.TYPES contains every pinned enemy id', ids.every(k => types.includes(k)), ids.filter(k => !types.includes(k)));
    const bossIds = await page.evaluate(() => Object.keys(window.UB.Bosses.DATA));
    check('UB.Bosses.DATA contains the four bosses and proto_warden', ['tallock', 'weftyr', 'corrosant', 'kernauth', 'proto_warden'].every(k => bossIds.includes(k)), bossIds);
    await D(d => d.god(true));

    // ---------- enemies ----------
    for (const T of ENEMIES) {
      const tag = 'enemy ' + T.id;
      await D(d => d.warp('debug_room', null)); await step(2);
      await clearWorld();
      await D((d, px) => d.teleport(px * 30 + 15, 450), T.px); await step(2);
      const spawned = await D((d, type, tx, ty, opts) => d.spawnEnemy(type, tx, ty, opts), T.type, T.tx, T.ty, T.opts);
      check(tag + ': spawnEnemy creates it', !!spawned && spawned.type === T.type && spawned.hp > 0, spawned);
      if (!spawned) continue;
      // behaviour: 300 frames, sample every 10
      const states = new Set(); let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, stuck = 0, below = 0, lost = 0, shotsSeen = 0, motesSeen = 0;
      for (let i = 0; i < 30; i++) {
        await step(10);
        const info = await G((g, type) => {
          const E = window.UB.Entity, lv = g.level, out = { list: [], proj: g.projectiles.length, motes: 0 };
          for (const e of g.enemies) {
            if (e.type === 'mote') out.motes++;
            if (e.type !== type) continue;
            out.list.push({ state: e.state, x: e.x, y: e.y, stuck: E.overlapsSolid(lv, e.x - e.w / 2 + 1, e.y - e.h + 1, e.w - 2, e.h - 2) });
          }
          return out;
        }, T.type);
        shotsSeen = Math.max(shotsSeen, info.proj); motesSeen = Math.max(motesSeen, info.motes);
        if (!info.list.length) { lost++; continue; }
        for (const e of info.list) {
          states.add(e.state); minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x); minY = Math.min(minY, e.y); maxY = Math.max(maxY, e.y);
          if (e.stuck) stuck++; if (e.y > 450.5) below++;
        }
      }
      const moved = (maxX - minX) + (maxY - minY);
      check(tag + ': behaves over 300 frames (states ' + [...states].join('/') + ', moved ' + Math.round(moved) + ' px)', states.size >= 2 || moved > 20, { states: [...states], moved });
      check(tag + ': never inside a solid tile, never below the floor', stuck === 0 && below === 0 && (T.mote || lost === 0), { stuck, below, lost });
      if (T.shots) check(tag + ': fires projectiles', shotsSeen > 0, shotsSeen);
      if (T.spawner) check(tag + ': spawns motes', motesSeen > 0, motesSeen);
      if (T.hanger) check(tag + ': drops from the ceiling onto the player', states.has('drop') || states.has('splat') || states.has('scuttle'), [...states]);
      await shot('enemy-' + T.id + '.png');
      // damage: bring it to the floor beside the player (fliers/hangers are moved down to the attack height)
      let en = await enemiesOf(T.type);
      if (!en.length && T.mote) { check(tag + ': mote expired (lifetime) or was popped — skipping damage checks', true); continue; }
      check(tag + ': alive before the damage test', en.length > 0, en);
      if (!en.length) continue;
      await G((g, type) => {
        const e = g.enemies.find(e => e.type === type && !e.dead);
        e.x = 19 * 30 + 15; e.y = 450; e.px = e.x; e.py = e.y; e.spawnX = e.x; e.spawnY = e.y; e.vx = 0; e.vy = 0;
        if (e.type === 'droplatch') { e.state = 'splat'; e.timer = 0; e.contact = 1; }
        if (e.type === 'platewalker') { e.facing = e.dir = -1; e.state = 'walk'; }
        return true;
      }, T.type);
      await step(1);
      en = await enemiesOf(T.type);
      const hp0 = en[0].hp;
      const bitsBefore = (await state()).bits;   // before the damage test: a 3-hp mote dies to the first light
      if (T.shield) {
        // it faces left: its front is on the left. side +1 = player on the left facing right (front);
        // side -1 = player on the right facing left (behind). Front light blocked, front heavy breaks guard, back light lands.
        await lightAt(en[0].x, 450, +1);
        let e2 = await enemiesOf(T.type);
        check(tag + ': a light from the front is blocked by the shield (hp unchanged)', e2.length && e2[0].hp === hp0, e2);
        await G((g, type) => { const e = g.enemies.find(e => e.type === type); e.x = 19 * 30 + 15; e.facing = e.dir = -1; e.state = 'walk'; e.vx = 0; return true; }, T.type);
        await heavyAt(en[0].x, 450, +1);
        e2 = await enemiesOf(T.type);
        check(tag + ': a heavy from the front guard-breaks (stagger/open) and damages', e2.length && e2[0].hp < hp0 && (e2[0].state === 'stagger' || e2[0].state === 'open'), e2);
        await G((g, type) => { const e = g.enemies.find(e => e.type === type); e.x = 19 * 30 + 15; e.y = 450; e.facing = e.dir = -1; e.state = 'walk'; e.vx = 0; e.hitstun = 0; return true; }, T.type);
        const hpB = (await enemiesOf(T.type))[0].hp;
        await lightAt(19 * 30 + 15, 450, -1);
        e2 = await enemiesOf(T.type);
        check(tag + ': a light from behind deals damage', e2.length && e2[0].hp < hpB, e2);
      } else {
        await lightAt(en[0].x, 450, -1);
        const e2 = await enemiesOf(T.type);
        check(tag + ': a light attack damages it', e2.length === 0 || e2[0].hp < hp0, { hp0, e2 });
      }
      // kill it with repeated lights (teleport beside it each time); drops may be magnetised straight into the
      // player, so bits are counted as pickups still lying around plus the bits counter delta
      let alive = await enemiesOf(T.type), tries = 0;
      while (alive.length && tries < 40) {
        const e = alive[0];
        const side = -1;
        if (T.shield) await G((g, type) => { const q = g.enemies.find(e => e.type === type); if (q) { q.facing = q.dir = -1; if (q.state === 'bash') q.state = 'walk'; } return true; }, T.type);
        if (T.flyer || T.hanger) await G((g, type) => { const q = g.enemies.find(e => e.type === type); if (q) { q.y = 450; q.py = 450; q.spawnY = 450; q.vy = 0; } return true; }, T.type);
        await lightAt(e.x, 450, side, 12);
        alive = await enemiesOf(T.type); tries++;
      }
      const pk = await D(d => d.pickups());
      const bitsAfter = (await state()).bits;
      check(tag + ': dies to repeated light attacks', alive.length === 0, { tries, alive });
      check(tag + ': death drops bits', pk.filter(p => p.type === 'bit').length >= 1 || bitsAfter > bitsBefore, { pk, bitsBefore, bitsAfter });
      if (T.spawner) { await step(3); const left = await G(g => g.enemies.filter(e => e.type === 'mote').length); check(tag + ': its motes pop when it dies', left === 0, left); }
    }

    // ---------- bosses ----------
    for (const B of BOSSES) {
      const tag = 'boss ' + B.id;
      await D(d => d.warp('debug_boss', 'L')); await step(2);
      await clearWorld();
      await D(d => d.teleport(6 * 30 + 15, 450)); await step(2);
      const bs = await D((d, id) => d.spawnBoss(id), B.id);
      s = await state();
      check(tag + ': spawnBoss creates a live fight (hp ' + B.hp + ', phase 1, active)', bs && bs.id === B.id && bs.hp === B.hp && bs.maxHp === B.hp && bs.phase === 1 && bs.fight === 'fight' && s.boss && s.boss.active, { bs, boss: s.boss });
      if (!bs) continue;
      const geom = await G(g => ({ w: g.level.w * 30, h: g.level.h * 30 }));
      // attack cycling over 1200 frames; the player hops between positions so distance-based choices vary
      const seen = new Set(); let outOfRoom = 0, nan = 0;
      const spots = [20, 8, 30, 12, 25, 5, 34, 16];
      for (let i = 0; i < 240; i++) {
        if (i % 30 === 0) { await D((d, x) => d.teleport(x * 30 + 15, 450), spots[(i / 30) % spots.length]); }
        await step(5);
        const b = await G(g => g.boss ? { attack: g.boss.attack, state: g.boss.state, x: g.boss.x, y: g.boss.y, hp: g.boss.hp } : null);
        if (!b) break;
        if (b.attack && b.attack !== 'roar') seen.add(b.attack);
        if (!(b.x >= -10 && b.x <= geom.w + 10 && b.y >= -10 && b.y <= geom.h + 10)) outOfRoom++;
        if (Number.isNaN(b.x) || Number.isNaN(b.y)) nan++;
        if (i === 70) await shot('boss-' + B.id + '.png');
      }
      check(tag + ': uses ≥ 3 different attacks within 1200 frames (' + [...seen].join(', ') + ')', seen.size >= 3, [...seen]);
      check(tag + ': stays inside the room, positions finite', outOfRoom === 0 && nan === 0, { outOfRoom, nan });
      check(tag + ': hp untouched by its own attacks on a god-mode player', (await D(d => d.boss())).hp === B.hp);
      // hp decreases on a light hit: put the boss in a floor-level state next to the player
      const prep = await G((g, id) => {
        const b = g.boss, A = b.A;
        g.projectiles.length = 0;
        if (id === 'tallock') { b.state = 'recover'; b.timer = 60; b.vx = 0; }
        else if (id === 'weftyr') { b.state = 'recover'; b.atk = 'spin'; b.timer = 90; b.x = 20 * 30 + 15; b.y = A.floorY; b.vx = b.vy = 0; }
        else if (id === 'corrosant') { b.state = 'recover'; b.plan = 'spit'; b.timer = 90; b.droop = 0; b.s = 2 * b.W + b.H - 300; }
        else { b.state = 'idle'; b.timer = 90; }
        b.px = b.x; b.py = b.y;
        return { x: b.x, y: b.y, hp: b.hp, w: b.w, h: b.h };
      }, B.id);
      await step(1);
      const hx = B.id === 'corrosant' ? (await G(g => g.boss.x)) : prep.x;
      const side = B.id === 'kernauth' ? -1 : -1;
      const reach = B.id === 'kernauth' ? 75 + 20 : (B.id === 'corrosant' ? 25 + 12 : prep.w / 2 + 12);
      await page.evaluate(({ hx, reach }) => { const d = window.UB.debug; d.teleport(hx - reach - 10, 450); d.step(2); d.pressed('right', 1); d.step(1); d.pressed('light', 2); d.step(12); }, { hx, reach });
      let bb = await D(d => d.boss());
      check(tag + ': a light attack lowers its hp', bb.hp < prep.hp, { before: prep.hp, after: bb.hp, prep });
      // enrage / phase thresholds
      if (!B.final) {
        await G((g, thr) => { g.boss.hp = thr + 1; g.boss.px = g.boss.x; g.boss.py = g.boss.y; return true; }, B.enrage);
        await page.evaluate(({ hx, reach }) => { const d = window.UB.debug; d.teleport(hx - reach - 10, 450); d.step(2); d.pressed('right', 1); d.step(1); d.pressed('light', 2); d.step(12); }, { hx, reach });
        const er = await G(g => ({ hp: g.boss.hp, enraged: g.boss.enraged, phase: g.boss.phase, roar: g.boss.roar, state: g.boss.state }));
        check(tag + ': dropping to ≤ ' + B.enrage + ' hp triggers the enrage roar (phase-2 bar colours)', er.enraged && er.phase === 2 && er.roar > 0 && er.state === 'roar', er);
        const hpR = er.hp;
        await page.evaluate(({ hx, reach }) => { const d = window.UB.debug; d.teleport(hx - reach - 10, 450); d.step(2); d.pressed('right', 1); d.step(1); d.pressed('light', 2); d.step(12); }, { hx, reach });
        check(tag + ': hits during the roar are blocked (invulnerable)', (await D(d => d.boss())).hp === hpR, await D(d => d.boss()));
        await step(120);
        const after = await G(g => ({ state: g.boss.state, roar: g.boss.roar }));
        check(tag + ': fighting resumes after the roar', after.roar === 0 && after.state !== 'roar', after);
      } else {
        // Kernauth: phase 1 → 2 inside takeHit, then Panic Loop at ≤ 60, then victory
        await G(g => { g.boss.hp = 1; return true; });
        await page.evaluate(({ hx, reach }) => { const d = window.UB.debug; d.teleport(hx - reach - 10, 450); d.step(2); d.pressed('right', 1); d.step(1); d.pressed('light', 2); d.step(12); }, { hx, reach });
        const ph = await G(g => ({ phase: g.boss.phase, hp: g.boss.hp, maxHp: g.boss.maxHp, state: g.boss.state, fight: g.bossFight.state, iframes: g.player.iframes, contact: g.boss.contact }));
        check(tag + ': phase 1 at 0 hp becomes phase 2 (hp 240, 180 f transition, player i-frames, fight continues)', ph.phase === 2 && ph.hp === 240 && ph.maxHp === 240 && ph.state === 'transition' && ph.fight === 'fight' && ph.iframes >= 170 && ph.contact === 0, ph);
        await step(200);
        const seen2 = new Set(); let out2 = 0;
        for (let i = 0; i < 240; i++) {
          if (i % 30 === 0) await D((d, x) => d.teleport(x * 30 + 15, 450), spots[(i / 30) % spots.length]);
          await step(5);
          const b = await G(g => g.boss ? { attack: g.boss.attack, x: g.boss.x, y: g.boss.y } : null);
          if (!b) break;
          if (b.attack && b.attack !== 'roar') seen2.add(b.attack);
          if (!(b.x >= -10 && b.x <= geom.w + 10 && b.y >= -10 && b.y <= geom.h + 10)) out2++;
          if (i === 60) await shot('boss-kernauth-2.png');
        }
        check(tag + ': phase 2 uses ≥ 3 different attacks within 1200 frames (' + [...seen2].join(', ') + ')', seen2.size >= 3, [...seen2]);
        check(tag + ': phase 2 stays inside the room', out2 === 0, out2);
        // Panic Loop enrage at ≤ 60: park it on the floor (post-dive recovery) and hit it
        const p2 = await G(g => { const b = g.boss, A = b.A; g.projectiles.length = 0; b.hp = 61; b.state = 'recover2'; b.atk2 = 'dive'; b.timer = 120; b.x = 20 * 30 + 15; b.y = A.floorY; b.vx = b.vy = 0; b.px = b.x; b.py = b.y; return { x: b.x }; });
        await step(1);
        await page.evaluate(({ hx }) => { const d = window.UB.debug; d.teleport(hx - 35 - 22, 450); d.step(2); d.pressed('right', 1); d.step(1); d.pressed('light', 2); d.step(12); }, { hx: p2.x });
        const er = await G(g => ({ hp: g.boss.hp, enraged: g.boss.enraged, roar: g.boss.roar, hoverGap: g.boss.hoverGap }));
        check(tag + ': ≤ 60 hp in phase 2 triggers the Panic Loop roar (no hover gap)', er.enraged && er.roar > 0 && er.hoverGap === 0, er);
        await step(60);
        await G(g => { const b = g.boss, A = b.A; g.projectiles.length = 0; b.hp = 1; b.state = 'recover2'; b.atk2 = 'dive'; b.timer = 120; b.x = 20 * 30 + 15; b.y = A.floorY; b.vx = b.vy = 0; b.px = b.x; b.py = b.y; return true; });
        await step(1);
      }
      // death → onDefeated
      const pre = await G((g, id) => {
        const b = g.boss, A = b.A; g.projectiles.length = 0; g.pickups.length = 0;
        if (b.phase >= 2 && id === 'kernauth') { b.state = 'recover2'; b.atk2 = 'dive'; b.timer = 120; b.x = 20 * 30 + 15; b.y = A.floorY; }
        else if (id === 'tallock') { b.state = 'recover'; b.timer = 90; }
        else if (id === 'weftyr') { b.state = 'recover'; b.atk = 'spin'; b.timer = 120; b.x = 20 * 30 + 15; b.y = A.floorY; }
        else if (id === 'corrosant') { b.state = 'recover'; b.plan = 'spit'; b.timer = 120; b.droop = 0; }
        b.vx = b.vy = 0; b.px = b.x; b.py = b.y; b.hp = 1; b.roar = 0;
        return { x: b.x, w: b.w };
      }, B.id);
      await step(1);
      const kx = B.id === 'corrosant' ? (await G(g => g.boss.x)) : pre.x;
      const kreach = B.id === 'kernauth' ? 35 + 12 : (B.id === 'corrosant' ? 25 + 12 : pre.w / 2 + 12);
      await page.evaluate(({ hx, reach }) => { const d = window.UB.debug; d.teleport(hx - reach - 10, 450); d.step(2); d.pressed('right', 1); d.step(1); d.pressed('light', 2); d.step(12); }, { hx: kx, reach: kreach });
      s = await state();
      check(tag + ': the killing hit starts the death sequence', s.bossFight === 'dying' || s.bossFight === 'reward' || s.screen === 'victory', { fight: s.bossFight, screen: s.screen, boss: s.boss });
      await D(d => d.teleport(36 * 30 + 15, 450));   // park far from the corpse so the rewards are not magnetised away before they are counted
      if (!B.final) {
        s = await stepUntil(x => x.bossFight === 'reward' || x.bossFight === 'done', 400);
        const pk = await D(d => d.pickups());
        const abil = pk.find(p => p.type === 'ability');
        check(tag + ': onDefeated spawned ' + B.bits + ' large bits, 3 sparks and the ' + B.ability + ' module', pk.filter(p => p.type === 'bit' && p.size === 'large').length === B.bits && pk.filter(p => p.type === 'spark').length === 3 && !!abil, pk);
        const abilInfo = await G(g => { const p = g.pickups.find(p => p.type === 'ability'); const sp = g.level.boss; return p ? { ability: p.ability, bossId: p.bossId, x: p.x, y: p.y, px: sp.pickup.x * 30 + 15, py: (sp.pickup.y + 1) * 30 } : null; });
        check(tag + ': the module carries the right ability/bossId and sits on spec.pickup', abilInfo && abilInfo.ability === B.ability && abilInfo.bossId === B.id && Math.abs(abilInfo.x - abilInfo.px) < 1 && Math.abs(abilInfo.y - abilInfo.py) < 1, abilInfo);
      } else {
        s = await stepUntil(x => x.screen === 'victory', 600);
        check(tag + ': final boss death reaches the victory screen with kernauth recorded', s.screen === 'victory' && s.bossesDefeated.includes('kernauth'), s);
        await shot('boss-kernauth-victory.png');
        await D(d => d.toTitle()); await D(d => d.newGame('tessik'));
        await stepUntil(x => x.screen === 'play' && !x.busy, 200);
        await D(d => d.god(true));
      }
    }

    // ---------- render sanity + errors ----------
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
