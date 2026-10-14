/*
 * UNDERBYTE — js/enemies.js
 * Owner: ENEMIES implementer.
 * Contract: CONTRACT.md §6.1 (enemy object + hooks), §7 (hits, projectiles).
 * Design: DESIGN.md §7 (every type, variant, timing), §9.2 (drops), §11.2 (rig drawing).
 *
 * UB.Enemies.create(type, spawn, room, game) → enemy (UB.Entity, units 'pxf') or
 * null for an unknown type. Every DESIGN §7 type is here with its zone variants:
 *   scuttlebit (brinecrab / staticshot / rootbound) · hopnode (dripnode / nullnode) ·
 *   driftmoth · brinejelly · glarewisp (rootwisp) · spitvalve (acidvalve / twinvalve) ·
 *   rambyte (rootram) · platewalker (rootplate) · broodcell (+ mote) · droplatch ·
 *   voltwheel · walker (debug placeholder) · bossSegment (Corrosant's body, see bosses.js).
 *
 * Behaviour is a per-type state machine driven by frame counters (never wall-clock),
 * randomness goes through game.rng(). Enemies move with UB.Entity.moveAndCollide so
 * they never pass through tiles; walkers turn at patrol bounds, walls and ledges.
 * Damage comes through takeHit (shields, damage multipliers) or the engine's applyHit.
 *
 * Drawing (DESIGN §11.2): every enemy owns a pre-allocated list of shape structs (its
 * "rig") that draw() mutates and renders with the two-pass ink/fill method, a glow pass
 * for eyes/cores, and the telegraph pulse on shapes flagged `tell` while an attack is
 * winding up. No per-frame allocations in update()/draw().
 *
 * Shared helpers exported for bosses.js: UB.Enemies.shape / drawRig / beginDraw /
 * makeShot / SHOTS (projectile kinds; bosses register their own kinds).
 */
'use strict';
(function (UB) {
  const E = UB.Entity, P = UB.Palette, U = UB.Util, FX = UB.FX, Au = UB.Audio, R = UB.Render;
  const TILE = 30, TAU = Math.PI * 2, PI = Math.PI, DEG = Math.PI / 180;
  const INK = P.INK, WHITE = '#FFFFFF';
  const res = { dmg: 0, killed: false, blocked: false };   // shared takeHit scratch (CONTRACT §4.4)

  // Pre-allocated FX option objects (no literals in update paths).
  const RING40 = { radius: 40, life: 20 };
  const SPARK_PT = { vx: 0, vy: 0, life: 8, size: 2, color: WHITE, grav: 0, drag: 0.9 };
  const DUST_N = null;

  // --- colours (DESIGN §7, explicit hex per type/variant) ------------------------------------
  const C = {
    scuttlebit: { shell: '#8fb6e8', under: '#2a3a5c', eye: '#ffffff' },
    brinecrab: { shell: '#4fae84', under: '#0d2a20' },
    staticshot: { shell: '#7a4fb8', spark: '#e8e0ff' },
    rootbound: { shell: '#b32a2a', halo: '#ffcf5a' },
    hopnode: { body: '#b8733a', lens: '#ffb24a', ring: '#2e1a0e' },
    dripnode: { body: '#1d4d3a', lens: '#a8ffcf' },
    nullnode: { body: '#2b1848' },
    driftmoth: { body: '#2a3a5c', wings: '#8fd3ff', line: '#6c86b8' },
    brinejelly: { dome: '#a8ffcf', strands: '#4fae84', under: '#0d2a20' },
    glarewisp: { core: '#e8e0ff', halo: '#7a4fb8', pupil: '#0a0612' },
    rootwisp: { core: '#ffcf5a', halo: '#b32a2a' },
    spitvalve: { body: '#5a3519', nozzle: '#b8733a', dial: '#ffb24a' },
    acidvalve: { body: '#1d4d3a', nozzle: '#4fae84', acid: '#4fae84' },
    twinvalve: { body: '#4d1018', nozzle: '#b32a2a', dial: '#ffcf5a' },
    rambyte: { body: '#5a3519', plates: '#b8733a', head: '#ffb24a' },
    rootram: { body: '#4d1018', plates: '#b32a2a', head: '#ffcf5a' },
    platewalker: { plate: '#b8733a', body: '#5a3519', visor: '#ffb24a' },
    rootplate: { plate: '#b32a2a', body: '#4d1018', visor: '#ffcf5a' },
    broodcell: { sac: '#1d4d3a', lumps: '#0d2a20', pores: '#a8ffcf' },
    broodcell_nullspire: { sac: '#2b1848', pores: '#e8e0ff' },
    broodcell_rootwell: { sac: '#4d1018', pores: '#ffcf5a' },
    voltwheel: { rim: '#e8e0ff', spokes: '#7a4fb8', hub: '#2b1848', stat: '#ffffff' },
    voltwheel_brinevault: { rim: '#a8ffcf', spokes: '#4fae84', hub: '#0d2a20' },
    voltwheel_rootwell: { rim: '#ffcf5a', spokes: '#b32a2a', hub: '#4d1018' },
    walker: { shell: '#8fb6e8', under: '#2a3a5c', eye: '#ffffff' },
  };
  const DEBUG_PAL = { tileFill: '#2a3a5c', tileEdge: '#6c86b8', glow: '#8fd3ff', accent: '#8fb6e8', hazard: '#8fd3ff' };

  // --- type table (DESIGN §7; CONTRACT §6.1 — every UB.IDS.enemies id is a key) -------------
  const TYPES = {
    scuttlebit: { name: 'Scuttlebit', w: 26, h: 18, hp: 6, contact: 1, bits: 2, kbResist: 1, speed: 1.0, ground: true,
      variants: { brinecrab: { hp: 9, speed: 1.4 }, staticshot: { hp: 9, speed: 1.1, spark: true }, rootbound: { hp: 12, speed: 1.2, bits: 3 } } },
    hopnode: { name: 'Hopnode', w: 24, h: 24, hp: 9, contact: 1, bits: 3, kbResist: 1, hopVx: 2.5, hopVy: -7.5, gravity: 0.45, ground: true,
      variants: { dripnode: { hp: 12 }, nullnode: { hopVy: -9.0 } } },
    driftmoth: { name: 'Driftmoth', w: 22, h: 16, hp: 6, contact: 1, bits: 2, kbResist: 1, speed: 1.2, flyer: true },
    brinejelly: { name: 'Brinejelly', w: 20, h: 24, hp: 9, contact: 1, bits: 3, kbResist: 1, speed: 0.8, flyer: true },
    glarewisp: { name: 'Glarewisp', w: 20, h: 20, hp: 9, contact: 1, bits: 3, kbResist: 1, maxSpeed: 3.0, accel: 0.12, flyer: true,
      variants: { rootwisp: { hp: 12, maxSpeed: 3.4 } } },
    spitvalve: { name: 'Spitvalve', w: 30, h: 30, hp: 12, contact: 1, bits: 5, kbResist: 0, cool: 75, ground: true,
      variants: { acidvalve: { acid: true }, twinvalve: { twin: true, cool: 60 } } },
    rambyte: { name: 'Rambyte', w: 40, h: 28, hp: 18, contact: 1, bits: 6, kbResist: 0.5, dropShard: true, pace: 0.8, charge: 6.0, spot: 24, ground: true,
      variants: { rootram: { hp: 24, charge: 7.0, spot: 18 } } },
    platewalker: { name: 'Platewalker', w: 30, h: 36, hp: 15, contact: 1, bits: 6, kbResist: 0.5, dropShard: true, speed: 0.7, open: 60, ground: true,
      variants: { rootplate: { hp: 21, open: 45 } } },
    broodcell: { name: 'Broodcell', w: 36, h: 36, hp: 21, contact: 1, bits: 8, kbResist: 0, dropShard: true, ground: true },
    mote: { name: 'Mote', w: 10, h: 10, hp: 3, contact: 1, bits: 1, kbResist: 1, speed: 2.2, life: 420, flyer: true },
    droplatch: { name: 'Droplatch', w: 26, h: 22, hp: 9, contact: 1, bits: 3, kbResist: 1, dropG: 0.6, scuttle: 1.6, climb: 2.0, hanger: true },
    voltwheel: { name: 'Voltwheel', w: 28, h: 28, hp: 12, contact: 1, bits: 5, kbResist: 0, dropShard: true, speed: 2.4, ground: true },
    walker: { name: 'Proto Walker', w: 26, h: 18, hp: 6, contact: 1, bits: 2, kbResist: 1, speed: 1.0, ground: true },
    /** Corrosant's body segments (bosses.js): invisible hit proxies that forward damage to the boss. */
    bossSegment: { name: 'Segment', w: 30, h: 30, hp: 9999, contact: 1, bits: 0, kbResist: 0, part: true },
  };

  function stat(d, v, k) { return v && v[k] !== undefined ? v[k] : d[k]; }
  function col(v, b, k) { return v && v[k] !== undefined ? v[k] : b[k]; }
  function zonePal(room, game) {
    const z = room && UB.World && UB.World.zones ? UB.World.zones[room.zone] : null;
    return (z && z.palette) || (game && game.zone && game.zone.palette) || DEBUG_PAL;
  }

  // ==========================================================================================
  // Rig drawing (DESIGN §11.2.1 / §11.2.4): pre-allocated shape structs, ink → fill → glow →
  // tell passes. Kinds: ellipse rrect poly wedge dome dot (filled) · limb line arc earc path
  // (stroked). `on` hides a shape, `tell` marks it for the telegraph pulse, `alpha` fades it.
  // ==========================================================================================
  function shape(k, fill) {
    return { k: k, on: true, x: 0, y: 0, rx: 0, ry: 0, w: 0, h: 0, r: 0, rot: 0, len: 0, wid: 0, ang: 0,
      x0: 0, y0: 0, cx: 0, cy: 0, x1: 0, y1: 0, a0: 0, a1: TAU, lw: 2, col: fill || WHITE, fill: fill || WHITE,
      glow: false, tell: false, ink: true, alpha: 1, pts: null };
  }
  const OPEN = { limb: 1, line: 1, arc: 1, earc: 1, path: 1 };
  function pathOf(ctx, s) {
    switch (s.k) {
      case 'ellipse':
        ctx.beginPath(); ctx.ellipse(s.x, s.y, s.rx > 0.1 ? s.rx : 0.1, s.ry > 0.1 ? s.ry : 0.1, s.rot, 0, TAU); break;
      case 'dot':
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r > 0.1 ? s.r : 0.1, 0, TAU); break;
      case 'dome':
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r > 0.1 ? s.r : 0.1, PI, TAU); ctx.closePath(); break;
      case 'rrect': {
        const w = s.w > 0.5 ? s.w : 0.5, h = s.h > 0.5 ? s.h : 0.5;
        const r = Math.min(s.r, w / 2, h / 2);
        if (s.rot) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); R.rrect(ctx, -w / 2, -h / 2, w, h, r); ctx.restore(); }
        else R.rrect(ctx, s.x - w / 2, s.y - h / 2, w, h, r);
        break;
      }
      case 'poly': case 'path': {
        const p = s.pts; const tf = s.rot !== 0 || s.x !== 0 || s.y !== 0;
        ctx.beginPath();
        if (tf) { ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot); }
        ctx.moveTo(p[0], p[1]);
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        if (s.k === 'poly') ctx.closePath();
        if (tf) ctx.restore();
        break;
      }
      case 'wedge': {
        const c = Math.cos(s.ang), sn = Math.sin(s.ang), hw = s.wid / 2;
        ctx.beginPath();
        ctx.moveTo(s.x + c * s.len, s.y + sn * s.len);
        ctx.lineTo(s.x - sn * hw, s.y + c * hw);
        ctx.lineTo(s.x + sn * hw, s.y - c * hw);
        ctx.closePath(); break;
      }
      case 'limb': ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.quadraticCurveTo(s.cx, s.cy, s.x1, s.y1); break;
      case 'line': ctx.beginPath(); ctx.moveTo(s.x0, s.y0); ctx.lineTo(s.x1, s.y1); break;
      case 'arc': ctx.beginPath(); ctx.arc(s.x, s.y, s.r > 0.1 ? s.r : 0.1, s.a0, s.a1); break;
      case 'earc': ctx.beginPath(); ctx.ellipse(s.x, s.y, s.rx > 0.1 ? s.rx : 0.1, s.ry > 0.1 ? s.ry : 0.1, s.rot, s.a0, s.a1); break;
    }
  }
  /**
   * Draw a rig: ink pass (every shape stroked INK 3, open shapes lw+3), fill pass (fills, or the
   * open shapes re-stroked in their own colour; white when `flash`), glow pass ('lighter', halo
   * for dots), telegraph pass (accent 4 px, α 0.8↔0.2 on an 8 f period) on shapes flagged tell.
   */
  function drawRig(ctx, rig, flash, tellOn, accent, t) {
    const n = rig.length;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    for (let i = 0; i < n; i++) {
      const s = rig[i]; if (!s.on || !s.ink) continue;
      if (s.alpha !== 1) ctx.globalAlpha = s.alpha;
      pathOf(ctx, s); ctx.lineWidth = OPEN[s.k] ? s.lw + 3 : 3; ctx.stroke();
      if (s.alpha !== 1) ctx.globalAlpha = 1;
    }
    let anyGlow = false;
    for (let i = 0; i < n; i++) {
      const s = rig[i]; if (!s.on) continue;
      if (s.glow) anyGlow = true;
      if (s.alpha !== 1) ctx.globalAlpha = s.alpha;
      pathOf(ctx, s);
      if (OPEN[s.k]) { ctx.strokeStyle = flash ? WHITE : s.col; ctx.lineWidth = s.lw; ctx.stroke(); }
      else { ctx.fillStyle = flash ? WHITE : s.fill; ctx.fill(); }
      if (s.alpha !== 1) ctx.globalAlpha = 1;
    }
    if (anyGlow) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const s = rig[i]; if (!s.on || !s.glow) continue;
        ctx.fillStyle = s.fill; ctx.globalAlpha = 0.28 * s.alpha;
        // halo: 2.5× for small eyes/cores, capped so a big boss core does not wash out the room
        if (s.k === 'dot') { ctx.beginPath(); ctx.arc(s.x, s.y, s.r > 12 ? s.r + 14 : s.r * 2.5, 0, TAU); ctx.fill(); }
        else { pathOf(ctx, s); ctx.fill(); }
      }
      ctx.restore();
    }
    if (tellOn) {
      ctx.save(); ctx.strokeStyle = accent; ctx.lineWidth = 4; ctx.globalAlpha = 0.5 + 0.3 * Math.cos(t * TAU / 8);
      for (let i = 0; i < n; i++) { const s = rig[i]; if (s.on && s.tell) { pathOf(ctx, s); ctx.stroke(); } }
      ctx.restore();
    }
  }
  /** save + translate to the interpolated feet point, flip by facing, squash, rotate, origin → body centre. */
  function beginDraw(ctx, e, alpha, sx, sy, rot) {
    const x = U.lerp(e.px, e.x, alpha), y = U.lerp(e.py, e.y, alpha);
    ctx.save(); ctx.translate(x, y); ctx.scale(e.facing * sx, sy); if (rot) ctx.rotate(rot); ctx.translate(0, -e.h / 2);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  }

  // ==========================================================================================
  // Shared movement / damage helpers
  // ==========================================================================================
  function footingAt(level, tx, ty) { const ch = E.tileAt(level, tx, ty); return ch === '#' || ch === 'c' || ch === '-'; }
  /** True when a grounded walker has no footing under its leading edge (DESIGN §7.0). */
  function ledge(e, level, dir) {
    if (!e.onGround) return false;
    const lx = e.x + dir * (e.w / 2 + 1);
    if (e.ground) return lx < e.ground.x || lx > e.ground.x + e.ground.w;
    return !footingAt(level, Math.floor(lx / TILE), Math.floor((e.y + 1) / TILE));
  }
  /** Leading edge at/over a patrol bound (inclusive tile range → px). */
  function bound(e, dir) {
    if (!e.hasPatrol) return false;
    const lead = e.x + dir * (e.w / 2);
    return dir < 0 ? lead <= e.p0 : lead >= e.p1;
  }
  function startTurn(e) { e.state = 'turn'; e.timer = 0; e.vx = 0; }
  /** PATROL/TURN (6 f, flip on f3) shared by walkers; sets vx. */
  function walkPatrol(e, game, speed) {
    if (e.state === 'turn') {
      e.vx = 0;
      if (++e.timer === 3) { e.dir = -e.dir; e.facing = e.dir; }
      if (e.timer >= 6) { e.timer = 0; e.state = e.walkState; }
      return;
    }
    e.vx = e.dir * speed;
    if (ledge(e, game.level, e.dir) || bound(e, e.dir)) startTurn(e);
  }
  /**
   * Hitstun handling (DESIGN §7.0): while `hitstun > 0` the enemy neither acts nor steers; its
   * knockback velocity plays out (walkers under gravity, flyers decelerating 0.3 px/f²).
   * Returns true when the caller must skip its AI this frame.
   */
  function hurtTick(e, game, grounded, g, maxFall) {
    if (e.flash > 0) e.flash--;
    if (e.hitstun <= 0) return false;
    e.hitstun--;
    if (grounded) { e.gravity(g, maxFall); e.vx = U.approach(e.vx, 0, 0.15); }
    else { e.vx = U.approach(e.vx, 0, 0.3); e.vy = U.approach(e.vy, 0, 0.3); }
    e.moveAndCollide(game.level);
    return true;
  }
  /** Mirror of UB.Entity.applyHit with an explicit damage value (multipliers, shields). */
  function applyDamage(e, hit, dmg) {
    res.dmg = dmg; res.killed = false; res.blocked = false;
    e.hp -= dmg; e.flash = 4;
    if (e.kbResist > 0) {
      e.hitstun = 10 + hit.hitstop;
      const k = e.kbResist / 60;
      e.vx = hit.kbx * hit.facing * k; e.vy = hit.kby * k;
    }
    if (e.hp <= 0) { e.hp = 0; e.dead = true; res.killed = true; }
    return res;
  }
  function blocked() { res.dmg = 0; res.killed = false; res.blocked = true; return res; }

  /** Common entity setup: box placement per DESIGN §7.0 (feet / centre / hanging top), fields of CONTRACT §6.1. */
  function base(type, d, v, spawn, room, game) {
    const w = d.w, h = d.h;
    const cx = spawn.x * TILE + TILE / 2;
    let y;
    if (d.flyer) y = spawn.y * TILE + TILE / 2 + h / 2;
    else if (d.hanger) y = spawn.y * TILE + h;
    else y = (spawn.y + 1) * TILE;
    const e = new E({ x: cx, y: y, w: w, h: h, hp: stat(d, v, 'hp'), units: 'pxf', kbResist: d.kbResist });
    e.type = type; e.name = d.name; e.variant = spawn.variant || null; e.data = d;
    e.contact = d.contact; e.bits = stat(d, v, 'bits'); e.dropShard = !!d.dropShard; e.accent = WHITE;
    e.state = 'idle'; e.walkState = 'patrol'; e.timer = 0;
    e.dir = spawn.facing === 1 || spawn.facing === -1 ? spawn.facing : -1; e.facing = e.dir;
    e.hasPatrol = !!(spawn.patrol && spawn.patrol.length >= 2);
    e.p0 = e.hasPatrol ? spawn.patrol[0] * TILE : 0; e.p1 = e.hasPatrol ? (spawn.patrol[1] + 1) * TILE : 0;
    e.spawnX = cx; e.spawnY = y;
    e.zone = zonePal(room, game);
    if (d.flyer) e.ignoreOneWay = true;
    return e;
  }

  // ==========================================================================================
  // Projectiles (CONTRACT §7): UB.Entity instances with owner 'enemy', their own hit descriptor.
  // SHOTS[kind] = { w, h, grav, maxFall, life, tiles:'pop'|'solid'|'none' (pop on contact / collide
  //                 only / fly through), destructible, multi, dmg, flags, ignoreOneWay,
  //                 step(s, game)?, onTile(s, game)?, onHit?, draw(ctx, s, x, y) }
  // bosses.js adds its own kinds to this table.
  // ==========================================================================================
  function popOnHit(victim, r, game) { if (this.src) this.src.dead = true; }
  const SHOTS = {
    /** Spitvalve glob: arcs under gravity, pops on any tile, destructible, 1 heart. */
    glob: { w: 10, h: 10, grav: 0.15, maxFall: 9, life: 150, tiles: 'pop', destructible: true, multi: false, dmg: 1, flags: 2, onHit: popOnHit,
      onTile: function (s, game) {
        if (s.acid && s.onGround) { const p = makeShot(game, 'puddle', s.x, s.y, 0, 0, s.col, s.puddleW, 6, s.puddleLife); if (p) p.src = s.src; }
      },
      draw: function (ctx, s, x, y) {
        ctx.translate(x, y - 5); ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillStyle = s.col;
        ctx.beginPath(); ctx.ellipse(0, 0, 5 + Math.abs(s.vx) * 0.3, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = WHITE; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(-2, -2, 1.5, 0, TAU); ctx.fill();
      } },
    /** Acid puddle hazard: stationary, multi-tick (the player's i-frames pace it), unblockable. */
    puddle: { w: 30, h: 6, grav: 0, life: 90, tiles: 'none', destructible: false, multi: true, dmg: 1, flags: 1, noKbx: true,
      draw: function (ctx, s, x, y) {
        const k = s.life < 20 ? s.life / 20 : 1;
        ctx.globalAlpha = 0.9 * k; ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.fillStyle = s.col;
        ctx.beginPath(); ctx.ellipse(x, y - 2, s.w / 2, 3.5, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = WHITE; ctx.globalAlpha = 0.5 * k;
        const b = (s.t >> 3) & 3;
        ctx.beginPath(); ctx.arc(x - s.w / 4 + b * 2, y - 4, 1.5, 0, TAU); ctx.arc(x + s.w / 5 - b, y - 3, 1, 0, TAU); ctx.fill();
      } },
    /** Static-shot spark: a 1-tile crackle at the scuttlebit's feet for 45 f (contact damage). */
    spark: { w: 30, h: 30, grav: 0, life: 45, tiles: 'none', destructible: false, multi: true, dmg: 1, flags: 0,
      draw: function (ctx, s, x, y) {
        const t = s.t;
        ctx.globalAlpha = (t & 2) ? 0.9 : 0.5; ctx.lineWidth = 2; ctx.lineJoin = 'round';
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = i === 1 ? WHITE : s.col;
          ctx.beginPath();
          let px = x - 12 + i * 12 + U.jitter(t, i, 3), py = y - 28;
          ctx.moveTo(px, py);
          for (let j = 1; j < 5; j++) { px += U.jitter(t + j * 7, i, 6); py += 6; ctx.lineTo(px, py); }
          ctx.stroke();
        }
      } },
  };
  /** Spawn a projectile of `kind` at bottom-centre (x,y) with velocity (vx,vy); optional w/h/life overrides. */
  function makeShot(game, kind, x, y, vx, vy, color, w, h, life) {
    const k = SHOTS[kind]; if (!k) return null;
    const s = new E({ x: x, y: y, w: w || k.w, h: h || k.h, units: 'pxf' });
    s.kind = kind; s.def = k; s.owner = 'enemy'; s.vx = vx; s.vy = vy; s.life = life || k.life;
    s.col = color || WHITE; s.col2 = WHITE; s.src = null; s.acid = false; s.puddleW = 30; s.puddleLife = 90;
    s.destructible = !!k.destructible; s.collideTiles = k.tiles !== 'none'; s.ignoreOneWay = !!k.ignoreOneWay;
    s.bounces = 0; s.stuck = false; s.ang = 0; s.n = 0; s.tx = 0; s.ty = 0; s.flash = 0; s.grav = -1; s.noHit = false;
    const h2 = E.makeHit('enemy'); h2.dmg = k.dmg; h2.multi = !!k.multi; h2.flags = k.flags; h2.kind = 'projectile'; h2.noKbx = !!k.noKbx;
    h2.src = s; h2.onHit = k.onHit || null; h2.hitstop = 0; h2.kbx = 240; h2.kby = -300; h2.tag = kind;
    s.hit = h2;
    s.update = shotUpdate; s.draw = shotDraw;
    game.spawnProjectile(s);
    return s;
  }
  function shotUpdate(game) {
    const k = this.def;
    this.t++;
    if (this.flash > 0) this.flash--;
    if (--this.life <= 0) { this.dead = true; return; }
    if (k.step) k.step(this, game);
    else {
      const g = this.grav >= 0 ? this.grav : k.grav;   // per-shot override (Corrosant's globs: 0.2)
      if (g) this.gravity(g, k.maxFall || 12);
      this.moveAndCollide(game.level);
      if (k.tiles === 'pop' && (this.hitWall || this.onGround || this.hitCeiling)) {
        if (k.onTile) k.onTile(this, game);
        this.dead = true; return;
      }
    }
    if (this.dead || this.noHit) return;
    const h = this.hit;
    h.x = this.x - this.w / 2; h.y = this.y - this.h; h.w = this.w; h.h = this.h;
    h.facing = this.vx < 0 ? -1 : 1;
    game.registerHit(h);
  }
  function shotDraw(ctx, game, alpha) {
    const x = U.lerp(this.px, this.x, alpha), y = U.lerp(this.py, this.y, alpha);
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    this.def.draw(ctx, this, x, y, game);
    ctx.restore();
  }

  // ==========================================================================================
  // 7.1 SCUTTLEBIT (and the debug WALKER) — patroller
  // ==========================================================================================
  function createScuttlebit(type, d, v, spawn, room, game) {
    const e = base(type, d, v, spawn, room, game);
    const vc = (spawn.variant && C[spawn.variant]) || null;
    const bc = C.scuttlebit;
    e.cShell = col(vc, bc, 'shell'); e.cUnder = col(vc, bc, 'under'); e.cEye = bc.eye;
    e.accent = e.cShell;
    e.speed = stat(d, v, 'speed'); e.spark = !!(v && v.spark); e.sparkT = 0;
    e.state = 'patrol'; e.walkState = 'patrol';
    const r = e.rig = [];
    if (spawn.variant === 'rootbound') { const g = shape('ellipse', C.rootbound.halo); g.x = 0; g.y = -2; g.rx = 16; g.ry = 10; g.ink = false; g.alpha = 0.35; r.push(g); }
    e.legs = [];
    for (let i = 0; i < 6; i++) { const l = shape('line', e.cUnder); l.lw = 2; e.legs.push(l); r.push(l); }
    e.shell = shape('ellipse', e.cShell); e.shell.x = 0; e.shell.y = -2; e.shell.rx = 13; e.shell.ry = 7; r.push(e.shell);
    const un = shape('ellipse', e.cUnder); un.x = 0; un.y = 3; un.rx = 10; un.ry = 3; un.ink = false; r.push(un);
    e.ant0 = shape('line', e.cUnder); e.ant0.lw = 1.5; r.push(e.ant0);
    e.ant1 = shape('line', e.cUnder); e.ant1.lw = 1.5; r.push(e.ant1);
    e.eye0 = shape('dot', e.cEye); e.eye0.r = 1.6; e.eye0.ink = false; r.push(e.eye0);
    e.eye1 = shape('dot', e.cEye); e.eye1.r = 1.6; e.eye1.ink = false; r.push(e.eye1);
    e.update = scuttleUpdate; e.draw = scuttleDraw;
    return e;
  }
  function scuttleUpdate(game, player) {
    this.t++;
    if (hurtTick(this, game, true, 0.5, 12)) return;
    if (this.spark && ++this.sparkT >= 90) {
      this.sparkT = 0;
      const s = makeShot(game, 'spark', this.x, this.y, 0, 0, C.staticshot.spark);
      if (s) s.src = this;
      Au.sfx('bolt', this.x);
    }
    walkPatrol(this, game, this.speed);
    this.gravity(0.5, 12); this.moveAndCollide(game.level);
    if (this.state === 'patrol' && this.hitWall === this.dir) startTurn(this);
  }
  function scuttleDraw(ctx, game, alpha) {
    const t = this.t, moving = this.state === 'patrol' && this.hitstun === 0;
    const step = moving ? (((t >> 1) & 1) ? 2.5 : -2.5) : 0;
    for (let i = 0; i < 6; i++) {
      const l = this.legs[i]; const x0 = -10 + i * 4;
      l.x0 = x0; l.y0 = 4; l.x1 = x0 + ((i & 1) ? step : -step); l.y1 = 9;
    }
    const bob = Math.sin(t / 10) * 1.5;
    this.ant0.x0 = 8; this.ant0.y0 = -6; this.ant0.x1 = 12; this.ant0.y1 = -12 + bob;
    this.ant1.x0 = 10; this.ant1.y0 = -6; this.ant1.x1 = 15; this.ant1.y1 = -10 - bob;
    this.eye0.x = 12; this.eye0.y = -12 + bob; this.eye1.x = 15; this.eye1.y = -10 - bob;
    const sq = this.hitstun > 0 ? 0.9 : 1;
    beginDraw(ctx, this, alpha, 1 / sq, sq, 0);
    drawRig(ctx, this.rig, this.flash > 0, false, this.accent, t);
    ctx.restore();
  }

  // ==========================================================================================
  // 7.2 HOPNODE — hopper
  // ==========================================================================================
  function createHopnode(type, d, v, spawn, room, game) {
    const e = base(type, d, v, spawn, room, game);
    const vc = (spawn.variant && C[spawn.variant]) || null, bc = C.hopnode;
    e.cBody = col(vc, bc, 'body'); e.cLens = col(vc, bc, 'lens'); e.accent = e.cLens;
    e.hopVx = d.hopVx; e.hopVy = stat(d, v, 'hopVy'); e.g = d.gravity;
    e.state = 'idle';
    const r = e.rig = [];
    e.springs = [];
    for (let s = 0; s < 2; s++) { const sp = shape('path', bc.ring); sp.pts = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; sp.lw = 2; e.springs.push(sp); r.push(sp); }
    const body = shape('rrect', e.cBody); body.x = 0; body.y = -5; body.w = 22; body.h = 22; body.r = 6; r.push(body); e.body = body;
    const ring = shape('dot', bc.ring); ring.x = 3; ring.y = -6; ring.r = 7.5; r.push(ring);
    e.lens = shape('dot', e.cLens); e.lens.x = 3; e.lens.y = -6; e.lens.r = 6; e.lens.glow = true; e.lens.ink = false; r.push(e.lens);
    const hi = shape('dot', WHITE); hi.x = 5; hi.y = -8; hi.r = 2; hi.ink = false; r.push(hi);
    e.update = hopUpdate; e.draw = hopDraw;
    return e;
  }
  /** Footing under a hop's landing spot along `dir` at the hopper's floor row (or a lower floor within 4 rows). */
  function hopFooting(e, level, dir) {
    if (!e.onGround) return true;
    const air = 2 * Math.abs(e.hopVy) / Math.max(0.01, e.g), reach = air * e.hopVx;
    const row = Math.floor((e.y + 1) / TILE);
    if (e.ground) return true;   // riding a mover: the mover decides
    const lx = e.x + dir * (reach + e.w / 2);
    const col = Math.floor(lx / TILE);
    if (footingAt(level, col, row)) return true;
    // a lower floor further along is fine too (it lands somewhere): scan down 4 rows at the landing column
    for (let r = row + 1; r <= row + 4; r++) if (footingAt(level, col, r)) return true;
    return false;
  }
  function hopUpdate(game, player) {
    const e = this; e.t++;
    if (hurtTick(e, game, true, e.g, 12)) { if (e.state === 'hop' || e.state === 'crouch') { e.state = 'idle'; e.timer = 0; } return; }
    const dx = player.x - e.x, near = Math.abs(dx) <= 240;
    switch (e.state) {
      case 'idle':
        e.vx = 0; if (near) e.facing = dx < 0 ? -1 : 1;
        if (++e.timer >= 30) { e.state = 'crouch'; e.timer = 0; }
        break;
      case 'crouch':
        e.vx = 0;
        if (++e.timer >= 12) {
          let dir = near ? (dx < 0 ? -1 : 1) : -e.dir;
          if (e.hasPatrol) { if (dir < 0 && e.x - 36 < e.p0) dir = 1; else if (dir > 0 && e.x + 36 > e.p1) dir = -1; }
          // never hop onto nothing: the landing column (a full hop ≈ 2·|vy|/g frames × vx) needs footing at
          // this floor row or the hopper turns round; an exit opening in the floor counts as a ledge
          if (!hopFooting(e, game.level, dir)) { dir = -dir; if (!hopFooting(e, game.level, dir)) { e.state = 'idle'; e.timer = 0; break; } }
          e.dir = dir; e.facing = dir; e.vx = dir * e.hopVx; e.vy = e.hopVy; e.state = 'hop'; e.timer = 0;
        }
        break;
      case 'hop':
        e.timer++;
        if (e.hitWall) e.vx = 0;
        break;
      case 'land':
        e.vx = 0;
        if (++e.timer >= 8) { e.state = 'idle'; e.timer = 0; }
        break;
    }
    e.gravity(e.g, 12); e.moveAndCollide(game.level);
    if (e.state === 'hop' && e.onGround && e.timer > 2) { e.state = 'land'; e.timer = 0; e.vx = 0; FX.burst('dust', e.x, e.y, 2, DUST_N); }
  }
  function hopDraw(ctx, game, alpha) {
    const e = this, t = e.t;
    let sx = 1, sy = 1, comp = 1;
    if (e.state === 'crouch') { sx = 1.2; sy = 0.8; comp = 0.45; }
    else if (e.state === 'hop') { sx = 0.85; sy = 1.15; comp = 1.3; }
    else if (e.state === 'land') { const k = e.timer / 8; sx = 0.83 + 0.17 * k; sy = 1.17 - 0.17 * k; comp = 0.7 + 0.3 * k; }
    else { sy = 1 + 0.015 * Math.sin(t * TAU / 40); }
    for (let s = 0; s < 2; s++) {
      const sp = e.springs[s], p = sp.pts, bx = s ? 6 : -6;
      for (let i = 0; i < 5; i++) { p[i * 2] = bx + ((i & 1) ? 3 : -3) * (i === 0 || i === 4 ? 0 : 1); p[i * 2 + 1] = 5 + i * 1.75 * comp; }
    }
    beginDraw(ctx, e, alpha, sx, sy, 0);
    drawRig(ctx, e.rig, e.flash > 0, e.state === 'crouch', e.accent, t);
    ctx.restore();
  }

  // ==========================================================================================
  // 7.3 DRIFTMOTH — sine flyer · BRINEJELLY — vertical variant placed by its own name
  // ==========================================================================================
  function createDriftmoth(type, d, v, spawn, room, game) {
    const e = base(type, d, v, spawn, room, game);
    const bc = C.driftmoth;
    e.accent = bc.wings; e.speed = d.speed; e.state = 'fly';
    const r = e.rig = [];
    e.wingL = shape('poly', bc.wings); e.wingL.pts = [-3, 0, -13, -9, -15, 3]; r.push(e.wingL);
    e.wingR = shape('poly', bc.wings); e.wingR.pts = [3, 0, 13, -9, 15, 3]; r.push(e.wingR);
    const body = shape('poly', bc.body); body.pts = [0, -8, 5, 0, 0, 8, -5, 0]; r.push(body);
    const a0 = shape('line', bc.line); a0.lw = 1.5; a0.x0 = 0; a0.y0 = -8; a0.x1 = -4; a0.y1 = -13; r.push(a0);
    const a1 = shape('line', bc.line); a1.lw = 1.5; a1.x0 = 0; a1.y0 = -8; a1.x1 = 4; a1.y1 = -13; r.push(a1);
    const eye = shape('dot', e.zone.glow || bc.wings); eye.x = 1; eye.y = -2; eye.r = 1.5; eye.glow = true; eye.ink = false; r.push(eye);
    e.update = mothUpdate; e.draw = mothDraw;
    return e;
  }
  function mothUpdate(game, player) {
    const e = this; e.t++;
    if (hurtTick(e, game, false)) return;
    e.vx = e.dir * e.speed;
    const ty = e.spawnY + 45 * Math.sin(e.t * TAU / 90);
    e.vy = U.clamp(ty - e.y, -3, 3);
    e.moveAndCollide(game.level);
    if (e.hitWall === e.dir || (e.x - e.spawnX) * e.dir >= 180) { e.dir = -e.dir; e.facing = e.dir; }
  }
  function mothDraw(ctx, game, alpha) {
    const e = this, t = e.t, flap = Math.sin(t * TAU / 12);
    e.wingL.pts[3] = -9 * flap; e.wingL.pts[5] = 3 * flap + 1;
    e.wingR.pts[3] = -9 * flap; e.wingR.pts[5] = 3 * flap + 1;
    beginDraw(ctx, e, alpha, 1, 1, 0);
    drawRig(ctx, e.rig, e.flash > 0, false, e.accent, t);
    ctx.restore();
  }
  function createBrinejelly(type, d, v, spawn, room, game) {
    const e = base(type, d, v, spawn, room, game);
    const bc = C.brinejelly;
    e.accent = bc.dome; e.speed = d.speed; e.state = 'fly'; e.dir = -1; e.facing = 1;
    const r = e.rig = [];
    e.strands = [];
    for (let i = 0; i < 3; i++) { const s = shape('path', bc.strands); s.pts = [0, 0, 0, 0, 0, 0, 0, 0]; s.lw = 2; e.strands.push(s); r.push(s); }
    const dome = shape('dome', bc.dome); dome.x = 0; dome.y = -2; dome.r = 10; r.push(dome);
    const under = shape('ellipse', bc.under); under.x = 0; under.y = -2; under.rx = 10; under.ry = 3; under.ink = false; r.push(under);
    const g = shape('dot', bc.dome); g.x = 0; g.y = -7; g.r = 3; g.glow = true; g.ink = false; r.push(g);
    e.update = jellyUpdate; e.draw = jellyDraw;
    return e;
  }
  function jellyUpdate(game, player) {
    const e = this; e.t++;
    if (hurtTick(e, game, false)) return;
    e.vy = e.dir * e.speed;
    const tx = e.spawnX + 30 * Math.sin(e.t * TAU / 120);
    e.vx = U.clamp(tx - e.x, -3, 3);
    e.moveAndCollide(game.level);
    if ((e.y - e.spawnY) * e.dir >= 120 || (e.dir < 0 && e.hitCeiling) || (e.dir > 0 && e.onGround)) e.dir = -e.dir;
  }
  function jellyDraw(ctx, game, alpha) {
    const e = this, t = e.t;
    for (let i = 0; i < 3; i++) {
      const p = e.strands[i].pts, bx = (i - 1) * 6;
      for (let j = 0; j < 4; j++) { p[j * 2] = bx + Math.sin(t / 8 + i + j) * 2.5 * (j / 3); p[j * 2 + 1] = -2 + j * 4; }
    }
    beginDraw(ctx, e, alpha, 1, 1 + 0.04 * Math.sin(t * TAU / 50), 0);
    drawRig(ctx, e.rig, e.flash > 0, false, e.accent, t);
    ctx.restore();
  }

  // ==========================================================================================
  // 7.4 GLAREWISP — chase flyer (ROOTWISP variant)
  // ==========================================================================================
  function createGlarewisp(type, d, v, spawn, room, game) {
    const e = base(type, d, v, spawn, room, game);
    const vc = (spawn.variant && C[spawn.variant]) || null, bc = C.glarewisp;
    e.cCore = col(vc, bc, 'core'); e.cHalo = col(vc, bc, 'halo'); e.accent = e.cCore;
    e.maxSpeed = stat(d, v, 'maxSpeed'); e.accel = d.accel; e.state = 'drift';
    e.trail = new Float32Array(6); for (let i = 0; i < 3; i++) { e.trail[i * 2] = e.x; e.trail[i * 2 + 1] = e.cy(); }
    const r = e.rig = [];
    e.tails = [];
    for (let i = 0; i < 3; i++) { const td = shape('dot', e.cHalo); td.r = 5 - i; td.alpha = 0.55 - i * 0.15; td.ink = false; e.tails.push(td); r.push(td); }
    const halo = shape('dot', e.cHalo); halo.r = 11; halo.ink = false; halo.alpha = 0.55; r.push(halo); e.halo = halo;
    e.core = shape('dot', e.cCore); e.core.r = 8; e.core.glow = true; r.push(e.core);
    e.pupil = shape('dot', bc.pupil); e.pupil.r = 3; e.pupil.ink = false; r.push(e.pupil);
    e.update = wispUpdate; e.draw = wispDraw; e.takeHit = wispTakeHit;
    return e;
  }
  function wispTakeHit(hit, game) { return applyDamage(this, hit, this.state === 'tired' ? hit.dmg * 2 : hit.dmg); }
  function wispUpdate(game, player) {
    const e = this; e.t++;
    if ((e.t % 3) === 0) { const tr = e.trail; tr[4] = tr[2]; tr[5] = tr[3]; tr[2] = tr[0]; tr[3] = tr[1]; tr[0] = e.x; tr[1] = e.cy(); }
    if (hurtTick(e, game, false)) return;
    const dx = player.x - e.x, dy = player.cy() - e.cy();
    e.facing = dx < 0 ? -1 : 1;
    switch (e.state) {
      case 'drift': {
        e.vx = U.approach(e.vx, 0, 0.1);
        const ty = e.spawnY + 6 * Math.sin(e.t * TAU / 80);
        e.vy = U.clamp(ty - e.y, -1, 1);
        e.moveAndCollide(game.level);
        if (dx * dx + dy * dy <= 270 * 270) { e.state = 'lock'; e.timer = 0; e.vx = 0; e.vy = 0; FX.burst('ring', e.x, e.cy(), 1, RING40); Au.sfx('bolt', e.x); }
        break;
      }
      case 'lock':
        e.vx = 0; e.vy = 0;
        if (++e.timer >= 20) { e.state = 'chase'; e.timer = 0; }
        break;
      case 'chase': {
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        e.vx += e.accel * dx / len; e.vy += e.accel * dy / len;
        const sp = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
        if (sp > e.maxSpeed) { e.vx *= e.maxSpeed / sp; e.vy *= e.maxSpeed / sp; }
        const pvx = e.vx, pvy = e.vy;
        e.moveAndCollide(game.level);
        if (e.hitWall) e.vx = -pvx * 0.5;
        if (e.onGround || e.hitCeiling) e.vy = -pvy * 0.5;
        if (++e.timer >= 150) { e.state = 'tired'; e.timer = 0; }
        break;
      }
      case 'tired': {
        const sx = e.spawnX - e.x, sy = e.spawnY - e.y, len = Math.sqrt(sx * sx + sy * sy);
        if (len > 1) { e.vx = sx / len; e.vy = sy / len; } else { e.vx = 0; e.vy = 0; }
        e.moveAndCollide(game.level);
        if (++e.timer >= 60) { e.state = 'drift'; e.timer = 0; }
        break;
      }
    }
  }
  function wispDraw(ctx, game, alpha) {
    const e = this, t = e.t;
    const x = U.lerp(e.px, e.x, alpha), y = U.lerp(e.py, e.y, alpha) - e.h / 2;
    for (let i = 0; i < 3; i++) { const td = e.tails[i]; td.x = (e.trail[i * 2] - x) * e.facing; td.y = e.trail[i * 2 + 1] - y; }
    const pl = game.player;
    const pdx = pl ? pl.x - e.x : 0, pdy = pl ? pl.cy() - e.cy() : 0, pl2 = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
    e.pupil.x = 3.5 * pdx / pl2 * e.facing; e.pupil.y = 3.5 * pdy / pl2;
    const bright = e.state === 'lock';
    const dim = e.state === 'tired' ? 0.6 : 1;
    e.core.alpha = dim; e.halo.alpha = 0.55 * dim; e.pupil.alpha = dim;
    e.core.r = bright ? 9 + Math.sin(t) : 8;
    beginDraw(ctx, e, alpha, 1, 1, 0);
    drawRig(ctx, e.rig, e.flash > 0 || (bright && (t & 2) === 0), bright, e.accent, t);
    ctx.restore();
  }

  // ==========================================================================================
  // 7.5 SPITVALVE — turret / spitter (ACID VALVE, TWIN VALVE)
  // ==========================================================================================
  function createSpitvalve(type, d, v, spawn, room, game) {
    const e = base(type, d, v, spawn, room, game);
    const vc = (spawn.variant && C[spawn.variant]) || null, bc = C.spitvalve;
    e.cBody = col(vc, bc, 'body'); e.cNozzle = col(vc, bc, 'nozzle'); e.cDial = col(vc, bc, 'dial'); e.accent = e.cNozzle;
    e.acid = !!(v && v.acid); e.twin = !!(v && v.twin); e.cool = stat(d, v, 'cool');
    e.state = 'scan'; e.recoil = 0; e.pending = 0;
    const r = e.rig = [];
    const bs = shape('rrect', e.cBody); bs.x = 0; bs.y = 4; bs.w = 30; bs.h = 22; bs.r = 5; r.push(bs);
    const stem = shape('rrect', e.cNozzle); stem.x = 4; stem.y = -6; stem.w = 10; stem.h = 12; stem.r = 2; r.push(stem);
    e.nozzle = shape('rrect', e.cNozzle); e.nozzle.x = 13; e.nozzle.y = -4; e.nozzle.w = 14; e.nozzle.h = 8; e.nozzle.r = 2; r.push(e.nozzle);
    const b0 = shape('dot', e.cDial); b0.x = -11; b0.y = 10; b0.r = 1.6; r.push(b0);
    const b1 = shape('dot', e.cDial); b1.x = 11; b1.y = 10; b1.r = 1.6; r.push(b1);
    const dial = shape('dot', e.cDial); dial.x = -7; dial.y = -2; dial.r = 5; r.push(dial);
    e.needle = shape('line', INK); e.needle.lw = 1.5; e.needle.ink = false; e.needle.x0 = -7; e.needle.y0 = -2; r.push(e.needle);
    e.update = valveUpdate; e.draw = valveDraw; e.takeHit = valveTakeHit;
    return e;
  }
  function valveTakeHit(hit, game) {
    const r = applyDamage(this, hit, hit.dmg);
    if (this.state === 'charge') this.timer = 0;   // interrupted: the charge restarts
    return r;
  }
  function valveFire(e, game, vx) {
    const ny = e.y - e.h / 2 - 4;
    const s = makeShot(game, 'glob', e.x + e.facing * 22, ny + 5, vx, -3.0, e.acid ? C.acidvalve.acid : e.cNozzle);
    if (s) { s.src = e; s.acid = e.acid; s.puddleW = 30; s.puddleLife = 90; }
    e.recoil = 6; Au.sfx('turretShot', e.x);
  }
  function valveUpdate(game, player) {
    const e = this; e.t++;
    if (e.flash > 0) e.flash--;
    if (e.recoil > 0) e.recoil--;
    e.vx = 0;
    switch (e.state) {
      case 'scan': {
        const dx = (player.x - e.x) * e.facing;
        if (dx > 0 && dx <= 330 && Math.abs(player.cy() - e.cy()) <= 150) { e.state = 'charge'; e.timer = 0; }
        break;
      }
      case 'charge':
        if (++e.timer >= 30) { valveFire(e, game, e.facing * 3.2); e.state = 'cool'; e.timer = e.cool; e.pending = e.twin ? 20 : 0; }
        break;
      case 'cool':
        if (e.pending > 0 && --e.pending === 0) valveFire(e, game, e.facing * 2.4);
        if (--e.timer <= 0) e.state = 'scan';
        break;
    }
    e.gravity(0.5, 12); e.moveAndCollide(game.level);
  }
  function valveDraw(ctx, game, alpha) {
    const e = this, t = e.t;
    const k = e.state === 'charge' ? e.timer / 30 : 0;
    const sc = 1 + 0.4 * k;
    e.nozzle.w = 14 * sc; e.nozzle.h = 8 * sc; e.nozzle.x = 6 + 7 * sc;
    const ang = e.state === 'charge' ? -PI * 0.8 + k * PI * 0.6 : (e.state === 'cool' ? -PI * 0.2 : -PI * 0.8 + 0.1 * Math.sin(t / 20));
    e.needle.x1 = -7 + Math.cos(ang) * 4; e.needle.y1 = -2 + Math.sin(ang) * 4;
    beginDraw(ctx, e, alpha, 1, 1, 0);
    if (e.recoil > 0) ctx.translate(-e.recoil * 0.7, 0);
    e.nozzle.tell = true;
    drawRig(ctx, e.rig, e.flash > 0, e.state === 'charge', e.accent, t);
    ctx.restore();
  }

  // ==========================================================================================
  // 7.6 RAMBYTE — charger (ROOTRAM)
  // ==========================================================================================
  function createRambyte(type, d, v, spawn, room, game) {
    const e = base(type, d, v, spawn, room, game);
    const vc = (spawn.variant && C[spawn.variant]) || null, bc = C.rambyte;
    e.cBody = col(vc, bc, 'body'); e.cPlates = col(vc, bc, 'plates'); e.cHead = col(vc, bc, 'head'); e.accent = e.cPlates;
    e.pace = d.pace; e.charge = stat(d, v, 'charge'); e.spot = stat(d, v, 'spot');
    e.state = 'pace'; e.walkState = 'pace';
    const r = e.rig = [];
    e.legs = [];
    for (let i = 0; i < 4; i++) { const l = shape('line', e.cBody); l.lw = 3; e.legs.push(l); r.push(l); }
    const body = shape('poly', e.cBody); body.pts = [-20, 6, -19, -6, 8, -11, 20, -8, 20, 9, -20, 9]; r.push(body);
    for (let i = 0; i < 3; i++) { const a = shape('arc', e.cPlates); a.x = -11 + i * 9; a.y = -6 - i * 1.5; a.r = 5.5; a.a0 = PI; a.a1 = TAU; a.lw = 3; r.push(a); }
    e.head = shape('rrect', e.cHead); e.head.x = 22; e.head.y = -1; e.head.w = 10; e.head.h = 14; e.head.r = 2; r.push(e.head);
    e.stars = [];
    for (let i = 0; i < 3; i++) { const s = shape('dot', e.cHead); s.r = 2; s.on = false; s.ink = false; e.stars.push(s); r.push(s); }
    e.update = ramUpdate; e.draw = ramDraw; e.takeHit = ramTakeHit;
    return e;
  }
  function ramTakeHit(hit, game) { return applyDamage(this, hit, this.state === 'stun' ? Math.floor(hit.dmg * 1.5) : hit.dmg); }
  function ramStun(e) { e.state = 'stun'; e.timer = 0; e.vx = 0; e.kbResist = 0.5; e.contact = 1; FX.shake(3, 6); }
  function ramUpdate(game, player) {
    const e = this; e.t++;
    if (hurtTick(e, game, true, 0.5, 12)) return;
    const dx = player.x - e.x, sdx = dx < 0 ? -1 : 1;
    switch (e.state) {
      case 'pace': case 'turn':
        e.kbResist = 0.5; e.contact = 1;
        walkPatrol(e, game, e.pace);
        if (e.state === 'pace' && sdx === e.facing && Math.abs(dx) <= 300 && Math.abs(player.y - e.y) <= 60) { e.state = 'spot'; e.timer = 0; e.vx = 0; }
        break;
      case 'spot':
        e.vx = 0;
        if (e.timer % 8 === 0) FX.burst('dust', e.x - e.facing * 16, e.y, 1, DUST_N);
        if (++e.timer >= e.spot) { e.state = 'charge'; e.timer = 0; e.kbResist = 0; e.contact = 2; }
        break;
      case 'charge':
        e.vx = e.facing * e.charge;
        if (ledge(e, game.level, e.facing) || bound(e, e.facing)) { ramStun(e); break; }
        if ((e.t & 3) === 0) FX.burst('dust', e.x - e.facing * 18, e.y, 1, DUST_N);
        if (sdx === -e.facing && Math.abs(dx) >= 90) { e.state = 'brake'; e.timer = 0; e.kbResist = 0.5; e.contact = 1; }
        break;
      case 'brake':
        e.vx = e.facing * 0.8 * (1 - e.timer / 20);
        if (++e.timer >= 20) { e.state = 'pace'; e.dir = e.facing; }
        break;
      case 'stun':
        e.vx = 0;
        if (++e.timer >= 45) { e.state = 'pace'; e.dir = e.facing; }
        break;
    }
    e.gravity(0.5, 12); e.moveAndCollide(game.level);
    if (e.state === 'charge' && e.hitWall === e.facing) ramStun(e);
    else if (e.state === 'pace' && e.hitWall === e.dir) startTurn(e);
  }
  function ramDraw(ctx, game, alpha) {
    const e = this, t = e.t;
    const moving = (e.state === 'pace' || e.state === 'charge' || e.state === 'brake') && e.hitstun === 0;
    const cyc = e.state === 'charge' ? 2 : 4;
    const ph = moving ? ((t % (cyc * 2)) < cyc ? 1 : -1) : 0;
    for (let i = 0; i < 4; i++) { const l = e.legs[i]; const x0 = -14 + i * 9; l.x0 = x0; l.y0 = 8; l.x1 = x0 + ((i & 1) ? ph : -ph) * 3; l.y1 = 14; }
    e.head.y = e.state === 'spot' ? 3 : -1;
    const stun = e.state === 'stun';
    for (let i = 0; i < 3; i++) { const s = e.stars[i]; s.on = stun; s.x = Math.cos(t / 8 + i * 2.1) * 12; s.y = -18 + Math.sin(t / 8 + i * 2.1) * 3; }
    const rot = e.state === 'charge' ? 25 * DEG : (e.state === 'spot' ? 8 * DEG * (e.timer / e.spot) : 0);
    beginDraw(ctx, e, alpha, 1, 1, rot);
    e.head.tell = true;
    drawRig(ctx, e.rig, e.flash > 0, e.state === 'spot', e.accent, t);
    ctx.restore();
  }

  // ==========================================================================================
  // 7.7 PLATEWALKER — shielded (ROOTPLATE)
  // ==========================================================================================
  function createPlatewalker(type, d, v, spawn, room, game) {
    const e = base(type, d, v, spawn, room, game);
    const vc = (spawn.variant && C[spawn.variant]) || null, bc = C.platewalker;
    e.cPlate = col(vc, bc, 'plate'); e.cBody = col(vc, bc, 'body'); e.cVisor = col(vc, bc, 'visor'); e.accent = e.cPlate;
    e.speed = d.speed; e.openFrames = stat(d, v, 'open');
    e.state = 'walk'; e.walkState = 'walk'; e.behindT = 0; e.blockFlash = 0; e.kbResist = 0;
    e.hit = E.makeHit('enemy'); e.hit.dmg = 1; e.hit.kind = 'contact'; e.hit.tag = 'bash'; e.hit.kbx = 240; e.hit.kby = -300; e.hit.src = e;
    const r = e.rig = [];
    e.legs = [];
    for (let i = 0; i < 2; i++) { const l = shape('line', e.cBody); l.lw = 3; e.legs.push(l); r.push(l); }
    const body = shape('rrect', e.cBody); body.x = -2; body.y = 2; body.w = 24; body.h = 22; body.r = 6; r.push(body);
    const visor = shape('rrect', e.cVisor); visor.x = 4; visor.y = -2; visor.w = 10; visor.h = 3; visor.r = 1; visor.glow = true; r.push(visor);
    e.arm0 = shape('line', e.cBody); e.arm0.lw = 3; r.push(e.arm0);
    e.arm1 = shape('line', e.cBody); e.arm1.lw = 3; r.push(e.arm1);
    e.plate = shape('rrect', e.cPlate); e.plate.w = 8; e.plate.h = 36; e.plate.r = 2; r.push(e.plate);
    e.rivets = [];
    for (let i = 0; i < 3; i++) { const rv = shape('dot', e.cBody); rv.r = 1.3; rv.ink = false; e.rivets.push(rv); r.push(rv); }
    e.update = plateUpdate; e.draw = plateDraw; e.takeHit = plateTakeHit;
    return e;
  }
  function plateGuarding(e) { return e.state === 'walk' || e.state === 'turn' || e.state === 'bash'; }
  function plateTakeHit(hit, game) {
    const e = this;
    // "front" = the attacker stands on the shield side (falls back to the hit-box centre for sourceless hits)
    const hcx = hit.src ? hit.src.x : hit.x + hit.w / 2;
    const front = (hcx - e.x) * e.facing > 0;
    if (plateGuarding(e) && front && hit.kind !== 'down') {
      if (hit.kind === 'heavy') {   // guard-break
        e.state = 'stagger'; e.timer = 0; e.kbResist = 0;
        const r = applyDamage(e, hit, hit.dmg);
        e.vx = -e.facing * 4;
        FX.burst('spark', e.x + e.facing * 18, e.cy(), 6, DUST_N);
        return r;
      }
      e.blockFlash = 6;
      // pushed back AWAY from the shield (e.facing points at the attacker) ~3 px/f, friction decays it (DESIGN §7.7)
      if (game.player && hit.src === game.player) game.player.vx = e.facing * 180;
      Au.sfx('whiff', e.x);
      return blocked();
    }
    e.kbResist = plateGuarding(e) ? 0 : 0.5;
    return applyDamage(e, hit, hit.dmg);
  }
  function plateUpdate(game, player) {
    const e = this; e.t++;
    if (e.blockFlash > 0) e.blockFlash--;
    if (hurtTick(e, game, true, 0.5, 12)) return;
    const dx = player.x - e.x, sdx = dx < 0 ? -1 : 1, adx = Math.abs(dx);
    switch (e.state) {
      case 'walk': case 'turn':
        e.kbResist = 0;
        walkPatrol(e, game, e.speed);
        if (e.state === 'walk') {
          if (sdx === -e.facing && adx <= 120) { if (++e.behindT >= 30) { e.dir = -e.dir; e.facing = e.dir; e.behindT = 0; } }
          else e.behindT = 0;
          if (sdx === e.facing && adx <= 90 && Math.abs(player.y - e.y) <= 60) { e.state = 'bash'; e.timer = 0; e.vx = 0; e.hit.hitList.length = 0; }
        }
        break;
      case 'bash':
        e.kbResist = 0; e.timer++;
        if (e.timer <= 18) e.vx = 0;
        else if (e.timer <= 32) {
          // the lunge stops at a ledge edge or the patrol bound like the walk does (DESIGN §7.0): a bash lured at the end
          // of the stretch never carries the walker off its floor
          e.vx = ledge(e, game.level, e.facing) || bound(e, e.facing) ? 0 : e.facing * 4;
          E.hitBoxWorld(e, 19, 0, 8, 36, e.hit); e.hit.facing = e.facing; game.registerHit(e.hit);
        } else { e.vx = 0; if (e.timer >= 56) { e.state = 'walk'; e.dir = e.facing; } }
        break;
      case 'stagger':
        e.kbResist = 0.5; e.timer++;
        e.vx = e.timer <= 6 && !ledge(e, game.level, -e.facing) ? -e.facing * 4 : 0;   // the guard-break shove never tips it off a ledge
        if (e.timer >= 30) { e.state = 'open'; e.timer = 0; }
        break;
      case 'open':
        e.kbResist = 0.5; e.vx = 0;
        if (++e.timer >= e.openFrames) { e.state = 'walk'; e.dir = e.facing; }
        break;
    }
    e.gravity(0.5, 12); e.moveAndCollide(game.level);
    if (e.state === 'walk' && e.hitWall === e.dir) startTurn(e);
    else if (e.state === 'bash' && e.hitWall === e.facing) e.vx = 0;
  }
  function plateDraw(ctx, game, alpha) {
    const e = this, t = e.t;
    const moving = (e.state === 'walk' || (e.state === 'bash' && e.timer > 18 && e.timer <= 32)) && e.hitstun === 0;
    const ph = moving ? Math.sin(t * TAU / 14) * 4 : 0;
    for (let i = 0; i < 2; i++) { const l = e.legs[i]; const x0 = i ? 5 : -8; l.x0 = x0; l.y0 = 10; l.x1 = x0 + (i ? ph : -ph); l.y1 = 18; }
    const down = e.state === 'stagger' || e.state === 'open';
    const raise = e.state === 'bash' && e.timer <= 18 ? -6 : 0;
    if (down) { e.plate.x = 14; e.plate.y = 14; e.plate.rot = 70 * DEG; }
    else { e.plate.x = 19; e.plate.y = raise; e.plate.rot = 0; }
    for (let i = 0; i < 3; i++) {
      const rv = e.rivets[i]; const oy = (i - 1) * 11;
      if (down) { rv.x = e.plate.x + Math.sin(e.plate.rot) * oy * -1; rv.y = e.plate.y + Math.cos(e.plate.rot) * oy; }
      else { rv.x = 19; rv.y = raise + oy; }
    }
    e.arm0.x0 = 10; e.arm0.y0 = -2; e.arm0.x1 = e.plate.x - 3; e.arm0.y1 = e.plate.y - 6;
    e.arm1.x0 = 10; e.arm1.y0 = 6; e.arm1.x1 = e.plate.x - 3; e.arm1.y1 = e.plate.y + 4;
    const pf = e.plate.fill;
    if (e.blockFlash > 0) e.plate.fill = P.PAPER;
    e.plate.tell = true;
    beginDraw(ctx, e, alpha, 1, 1, 0);
    drawRig(ctx, e.rig, e.flash > 0, e.state === 'bash' && e.timer <= 18, e.accent, t);
    ctx.restore();
    e.plate.fill = pf;
  }

  // ==========================================================================================
  // 7.8 BROODCELL — swarm spawner, and its MOTES
  // ==========================================================================================
  function createBroodcell(type, d, v, spawn, room, game) {
    const e = base(type, d, v, spawn, room, game);
    const zc = room && room.zone === 'nullspire' ? C.broodcell_nullspire : (room && room.zone === 'rootwell' ? C.broodcell_rootwell : null);
    const bc = C.broodcell;
    e.cSac = col(zc, bc, 'sac'); e.cLumps = bc.lumps; e.cPores = col(zc, bc, 'pores'); e.accent = e.cPores;
    if (room && room.zone === 'rootwell') { e.hp = e.maxHp = 27; }
    e.state = 'dormant'; e.motes = 0; e.moteOpts = { parent: e, color: e.cPores };
    e.kbResist = 0;
    const r = e.rig = [];
    for (let i = 0; i < 4; i++) {
      const lb = shape('limb', e.cLumps); lb.lw = 3; const sx = (i - 1.5) * 9;
      lb.x0 = sx; lb.y0 = 12; lb.cx = sx * 1.4; lb.cy = 18; lb.x1 = sx * 1.8; lb.y1 = 22; r.push(lb);
    }
    e.sac = shape('ellipse', e.cSac); e.sac.rx = 16; e.sac.ry = 16; e.sac.y = 2; r.push(e.sac);
    e.lumps = [];
    for (let i = 0; i < 3; i++) { const l = shape('ellipse', e.cLumps); l.rx = 8; l.ry = 8; l.ink = false; e.lumps.push(l); r.push(l); }
    e.pores = [];
    for (let i = 0; i < 3; i++) { const p = shape('dot', e.cPores); p.r = 3; p.glow = true; e.pores.push(p); r.push(p); }
    e.update = broodUpdate; e.draw = broodDraw; e.onDeath = broodDeath;
    return e;
  }
  const PORE_X = [-5, 7, -2], PORE_Y = [-3, 2, 8];
  function broodEmit(e, game) {
    if (e.motes >= 6) return;
    const i = Math.floor(game.rng() * 3) % 3;
    const tx = Math.floor(e.x / TILE), ty = Math.floor((e.y - 1) / TILE);
    const m = game.spawnEnemy('mote', tx, ty, e.moteOpts);
    if (!m) return;
    m.x = e.x + PORE_X[i]; m.y = e.cy() + PORE_Y[i] + 5; m.px = m.x; m.py = m.y;
    m.vy = -3; m.vx = 0; m.launch = 10;
    e.motes++;
  }
  function broodUpdate(game, player) {
    const e = this; e.t++;
    if (e.flash > 0) e.flash--;
    e.vx = 0;
    const dx = player.x - e.x, dy = player.cy() - e.cy();
    switch (e.state) {
      case 'dormant':
        if (dx * dx + dy * dy <= 300 * 300) { e.state = 'pulse'; e.timer = 0; }
        break;
      case 'pulse':
        if (++e.timer >= 40) { e.timer = 0; if (e.motes >= 6) e.state = 'rest'; else { e.state = 'spawn'; broodEmit(e, game); } }
        break;
      case 'spawn':
        e.timer++;
        if (e.timer === 15 || e.timer === 30) broodEmit(e, game);
        if (e.timer >= 30) { e.state = 'rest'; e.timer = 0; }
        break;
      case 'rest':
        if (++e.timer >= 180) { e.state = 'pulse'; e.timer = 0; }
        break;
    }
    e.gravity(0.5, 12); e.moveAndCollide(game.level);
  }
  function broodDeath(game) {
    const list = game.enemies;
    for (let i = 0; i < list.length; i++) { const m = list[i]; if (m.type === 'mote' && m.parent === this && !m.dead) { m.dead = true; FX.burst('spark', m.x, m.cy(), 3, DUST_N); } }
    this.motes = 0;
  }
  function broodDraw(ctx, game, alpha) {
    const e = this, t = e.t;
    const k = e.state === 'pulse' ? e.timer / 40 : (e.state === 'spawn' ? 1 - e.timer / 30 : 0);
    const sc = 1 + 0.25 * k;
    e.lumps[0].x = -9; e.lumps[0].y = -6 + Math.sin(t / 30) * 1; e.lumps[1].x = 10; e.lumps[1].y = -4; e.lumps[2].x = 2; e.lumps[2].y = 11;
    for (let i = 0; i < 3; i++) { const p = e.pores[i]; p.x = PORE_X[i]; p.y = PORE_Y[i]; p.r = 3 + 1.5 * k; p.tell = true; }
    const x = U.lerp(e.px, e.x, alpha), y = U.lerp(e.py, e.y, alpha);
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(0, -e.h / 2); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    drawRig(ctx, e.rig, e.flash > 0, e.state === 'pulse', e.accent, t);
    ctx.restore();
  }
  function createMote(type, d, v, spawn, room, game) {
    const e = base(type, d, v, spawn, room, game);
    e.parent = spawn.parent || null;
    e.cCore = spawn.color || C.broodcell.pores; e.accent = e.cCore;
    e.life = d.life; e.launch = 0; e.state = 'fly';
    e.trail = new Float32Array(4); e.trail[0] = e.trail[2] = e.x; e.trail[1] = e.trail[3] = e.cy();
    e.update = moteUpdate; e.draw = moteDraw; e.onDeath = moteDetach;
    return e;
  }
  function moteDetach() { const p = this.parent; if (p && p.motes > 0) p.motes--; this.parent = null; }
  function moteUpdate(game, player) {
    const e = this; e.t++;
    if (--e.life <= 0) { moteDetach.call(e); e.dead = true; return; }
    if ((e.t & 1) === 0) { const tr = e.trail; tr[2] = tr[0]; tr[3] = tr[1]; tr[0] = e.x; tr[1] = e.cy(); }
    if (hurtTick(e, game, false)) return;
    if (e.launch > 0) { e.launch--; e.vx = 0; e.vy = -3; }
    else {
      const dx = player.x - e.x, dy = player.cy() - e.cy(), len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = dx / len, ny = dy / len;
      const wob = 8 * Math.cos(e.t * TAU / 30) * (TAU / 30);
      e.vx = nx * 2.2 - ny * wob; e.vy = ny * 2.2 + nx * wob;
    }
    const pvx = e.vx, pvy = e.vy;
    e.moveAndCollide(game.level);
    if (e.hitWall) e.vx = -pvx * 0.5;
    if (e.onGround || e.hitCeiling) e.vy = -pvy * 0.5;
  }
  function moteDraw(ctx, game, alpha) {
    const e = this;
    const x = U.lerp(e.px, e.x, alpha), y = U.lerp(e.py, e.y, alpha) - 5;
    ctx.save(); ctx.lineJoin = 'round';
    ctx.fillStyle = e.cCore;
    ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(e.trail[2], e.trail[3], 2, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(e.trail[0], e.trail[1], 3, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillStyle = e.flash > 0 ? WHITE : e.cCore;
    ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(x, y, 10, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ==========================================================================================
  // 7.9 DROPLATCH — ceiling dropper (colours follow the zone)
  // ==========================================================================================
  function createDroplatch(type, d, v, spawn, room, game) {
    const e = base(type, d, v, spawn, room, game);
    const z = e.zone;
    e.cBody = z.tileEdge || DEBUG_PAL.tileEdge; e.cEyes = z.accent || DEBUG_PAL.accent; e.cClaws = z.tileFill || DEBUG_PAL.tileFill; e.accent = e.cEyes;
    e.dropG = d.dropG; e.scuttle = d.scuttle; e.climb = d.climb;
    // one-way grates are footing for the drop (DESIGN §7.9 "until it lands on footing", §7.0); only the CLIMB rises through them
    e.state = 'cling'; e.ignoreOneWay = false; e.climbed = 0; e.side = false; e.clingY = e.y; e.prev = 'cling';
    const r = e.rig = [];
    e.thread = shape('line', e.cClaws); e.thread.lw = 1.5; e.thread.on = false; r.push(e.thread);
    const tip = shape('poly', e.cBody); tip.pts = [-9, -3, 0, -13, 9, -3]; r.push(tip);
    const body = shape('ellipse', e.cBody); body.x = 0; body.y = 2; body.rx = 11; body.ry = 9; r.push(body);
    const hook = shape('arc', e.cClaws); hook.x = 0; hook.y = -13; hook.r = 3; hook.a0 = PI; hook.a1 = TAU; hook.lw = 2; r.push(hook);
    e.eyeL0 = shape('line', e.cEyes); e.eyeL0.lw = 2; e.eyeL0.x0 = -7; e.eyeL0.y0 = 1; e.eyeL0.x1 = -3; e.eyeL0.y1 = 1; r.push(e.eyeL0);
    e.eyeL1 = shape('line', e.cEyes); e.eyeL1.lw = 2; e.eyeL1.x0 = 3; e.eyeL1.y0 = 1; e.eyeL1.x1 = 7; e.eyeL1.y1 = 1; r.push(e.eyeL1);
    e.eye0 = shape('dot', e.cEyes); e.eye0.x = -5; e.eye0.y = 1; e.eye0.r = 2.2; e.eye0.glow = true; e.eye0.on = false; r.push(e.eye0);
    e.eye1 = shape('dot', e.cEyes); e.eye1.x = 5; e.eye1.y = 1; e.eye1.r = 2.2; e.eye1.glow = true; e.eye1.on = false; r.push(e.eye1);
    e.claws = [];
    for (let i = 0; i < 3; i++) { const c = shape('line', e.cClaws); c.lw = 2; c.x0 = (i - 1) * 6; c.y0 = 9; c.x1 = (i - 1) * 8; c.y1 = 13; e.claws.push(c); r.push(c); }
    e.update = latchUpdate; e.draw = latchDraw; e.takeHit = latchTakeHit;
    return e;
  }
  function latchDrop(e) { e.state = 'drop'; e.timer = 0; e.contact = 2; e.vx = 0; e.vy = 0; e.clingY = e.y; e.ignoreOneWay = false; }
  function latchTakeHit(hit, game) {
    const r = applyDamage(this, hit, hit.dmg);
    if (this.state === 'cling' || this.state === 'alert') latchDrop(this);
    return r;
  }
  function latchUpdate(game, player) {
    const e = this; e.t++;
    if (e.flash > 0) e.flash--;
    if (e.hitstun > 0) {
      e.hitstun--;
      if (e.state === 'drop' || e.state === 'splat' || e.state === 'scuttle') { e.gravity(e.dropG, 12); e.vx = U.approach(e.vx, 0, 0.15); }
      else { e.vx = U.approach(e.vx, 0, 0.3); e.vy = U.approach(e.vy, 0, 0.3); }
      e.moveAndCollide(game.level);
      return;
    }
    const dx = player.x - e.x;
    switch (e.state) {
      case 'cling':
        e.vx = 0; e.vy = 0;
        if (Math.abs(dx) <= 60 && player.y > e.y) { e.state = 'alert'; e.timer = 0; }
        break;
      case 'alert':
        e.vx = 0; e.vy = 0;
        if (++e.timer >= 18) latchDrop(e);
        break;
      case 'drop':
        e.timer++;
        e.gravity(e.dropG, 12); e.moveAndCollide(game.level);
        if (e.onGround) { e.state = 'splat'; e.timer = 0; e.contact = 1; FX.burst('dust', e.x, e.y, 4, DUST_N); }
        break;
      case 'splat':
        e.vx = 0; e.gravity(e.dropG, 12); e.moveAndCollide(game.level);
        if (++e.timer >= 12) { e.state = 'scuttle'; e.timer = 0; e.dir = dx < 0 ? -1 : 1; e.facing = e.dir; }
        break;
      case 'scuttle':
        if (e.timer % 30 === 0) { e.dir = dx < 0 ? -1 : 1; e.facing = e.dir; }
        e.vx = e.dir * e.scuttle;
        if (ledge(e, game.level, e.dir)) { e.dir = -e.dir; e.facing = e.dir; e.vx = e.dir * e.scuttle; }
        e.gravity(e.dropG, 12); e.moveAndCollide(game.level);
        if (e.hitWall === e.dir) { e.dir = -e.dir; e.facing = e.dir; }
        if (++e.timer >= 120) { e.state = 'climb'; e.timer = 0; e.climbed = 0; e.side = false; e.ignoreOneWay = true; }
        break;
      case 'climb': {
        if (!e.side) { e.vx = 0; e.vy = -e.climb; e.climbed += e.climb; if (e.climbed > 600) e.side = true; }
        else { e.vx = e.facing * e.climb; e.vy = 0; }
        e.moveAndCollide(game.level);
        // the room's edges count as walls/ceiling: the side-walk must never leave through an exit opening
        const lv = game.level, hw = e.w / 2;
        let edge = false;
        if (e.x - hw <= 0) { e.x = hw; edge = true; } else if (e.x + hw >= lv.w * TILE) { e.x = lv.w * TILE - hw; edge = true; }
        if (e.y - e.h <= 0) { e.y = e.h; edge = true; }
        if (e.hitCeiling || (e.side && e.hitWall) || edge) { e.state = 'cling'; e.vx = 0; e.vy = 0; e.contact = 1; e.ignoreOneWay = false; }
        break;
      }
    }
  }
  function latchDraw(ctx, game, alpha) {
    const e = this, t = e.t;
    const open = e.state !== 'cling';
    e.eyeL0.on = !open; e.eyeL1.on = !open; e.eye0.on = open; e.eye1.on = open;
    let sx = 1, sy = 1, ox = 0;
    if (e.state === 'alert') ox = ((t & 2) ? 2 : -2) * (1 - 0.5 * (e.timer / 18));
    else if (e.state === 'drop') { sx = 0.85; sy = 1.2; }
    else if (e.state === 'splat') { const k = e.timer / 12; sx = 1.3 - 0.3 * k; sy = 0.65 + 0.35 * k; }
    else if (e.state === 'climb') { sx = 0.9; sy = 1.1; }
    else sy = 1 + 0.02 * Math.sin(t * TAU / 40);
    const y = U.lerp(e.py, e.y, alpha);
    e.thread.on = e.state === 'drop' && e.timer < 20;
    if (e.thread.on) { e.thread.x0 = 0; e.thread.y0 = -13; e.thread.x1 = 0; e.thread.y1 = -13 - (y - e.clingY) / sy; }
    const x = U.lerp(e.px, e.x, alpha);
    ctx.save(); ctx.translate(x + ox, y); ctx.scale(e.facing * sx, sy); ctx.translate(0, -e.h / 2); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    e.eye0.tell = true; e.eye1.tell = true;
    drawRig(ctx, e.rig, e.flash > 0, e.state === 'alert', e.accent, t);
    ctx.restore();
  }

  // ==========================================================================================
  // 7.10 VOLTWHEEL — bouncer (colours follow the zone)
  // ==========================================================================================
  function createVoltwheel(type, d, v, spawn, room, game) {
    const e = base(type, d, v, spawn, room, game);
    const zc = room && room.zone === 'brinevault' ? C.voltwheel_brinevault : (room && room.zone === 'rootwell' ? C.voltwheel_rootwell : null);
    const bc = C.voltwheel;
    e.cRim = col(zc, bc, 'rim'); e.cSpokes = col(zc, bc, 'spokes'); e.cHub = col(zc, bc, 'hub'); e.cStat = bc.stat; e.accent = e.cRim;
    e.speed = room && room.zone === 'rootwell' ? 2.8 : d.speed;
    e.state = 'roll'; e.hopT = 0; e.angle = 0; e.kbResist = 0; e.dir = spawn.facing === 1 ? 1 : -1; e.facing = 1;
    const r = e.rig = [];
    const hub = shape('dot', e.cHub); hub.r = 13; r.push(hub);
    e.spokes = [];
    for (let i = 0; i < 6; i++) { const s = shape('line', e.cSpokes); s.lw = 2; s.ink = false; e.spokes.push(s); r.push(s); }
    const rim = shape('arc', e.cRim); rim.r = 13; rim.a0 = 0; rim.a1 = TAU; rim.lw = 3; r.push(rim); e.rim = rim;
    e.stat = shape('path', e.cStat); e.stat.pts = [0, 0, 0, 0, 0, 0, 0, 0]; e.stat.lw = 1.5; e.stat.ink = false; r.push(e.stat);
    const axle = shape('dot', e.cRim); axle.r = 2.5; axle.ink = false; r.push(axle);
    e.update = wheelUpdate; e.draw = wheelDraw;
    return e;
  }
  function wheelUpdate(game, player) {
    const e = this; e.t++;
    if (e.flash > 0) e.flash--;
    switch (e.state) {
      case 'roll':
        if (bound(e, e.dir)) e.dir = -e.dir;
        e.vx = e.dir * e.speed;
        if (++e.hopT >= 150) { e.hopT = 0; if (player.y < e.y - 30 && Math.abs(player.x - e.x) <= 120) { e.state = 'tell'; e.timer = 0; } }
        break;
      case 'tell':
        e.vx = e.dir * e.speed;
        if (++e.timer >= 10) { e.state = 'hop'; e.timer = 0; e.vy = -6; }
        break;
      case 'hop':
        e.vx = e.dir * e.speed; e.timer++;
        break;
    }
    e.gravity(0.45, 12); e.moveAndCollide(game.level);
    if (e.hitWall) { e.dir = -e.dir; e.vx = e.dir * e.speed; }
    if (e.state === 'hop' && e.onGround && e.timer > 2) e.state = 'roll';
    e.angle += e.vx / 13;
    if ((e.t & 3) === 0) {
      SPARK_PT.vx = -e.vx * 0.3 + U.jitter(e.t, 1, 0.6); SPARK_PT.vy = -0.5 - U.jitter(e.t, 2, 0.4) ; SPARK_PT.color = e.cRim;
      FX.spawn('spark', e.x - e.dir * 8, e.y - 4, SPARK_PT);
    }
  }
  function wheelDraw(ctx, game, alpha) {
    const e = this, t = e.t;
    for (let i = 0; i < 6; i++) { const s = e.spokes[i]; const a = e.angle + i * PI / 3; s.x0 = 0; s.y0 = 0; s.x1 = Math.cos(a) * 11; s.y1 = Math.sin(a) * 11; }
    const a0 = e.angle + ((t >> 3) % 6) * PI / 3, a1 = a0 + PI / 3, p = e.stat.pts;
    p[0] = Math.cos(a0) * 10; p[1] = Math.sin(a0) * 10; p[6] = Math.cos(a1) * 10; p[7] = Math.sin(a1) * 10;
    p[2] = (p[0] * 2 + p[6]) / 3 + U.jitter(t, 3, 3); p[3] = (p[1] * 2 + p[7]) / 3 + U.jitter(t, 4, 3);
    p[4] = (p[0] + p[6] * 2) / 3 + U.jitter(t, 5, 3); p[5] = (p[1] + p[7] * 2) / 3 + U.jitter(t, 6, 3);
    e.stat.on = (t & 2) === 0;
    const bright = e.state === 'tell' && (t & 2) === 0;
    const sq = e.state === 'hop' ? 1.08 : (e.state === 'tell' ? 0.92 : 1);
    beginDraw(ctx, e, alpha, 1 / sq, sq, 0);
    drawRig(ctx, e.rig, e.flash > 0 || bright, e.state === 'tell', e.accent, t);
    ctx.restore();
  }

  // ==========================================================================================
  // bossSegment — Corrosant's body parts: invisible hit proxies positioned by the boss (bosses.js)
  // ==========================================================================================
  function createSegment(type, d, v, spawn, room, game) {
    const e = base(type, d, v, spawn, room, game);
    e.parent = spawn.parent || null; e.index = spawn.index || 0;
    e.collideTiles = false; e.ignoreOneWay = true; e.noContact = true; e.kbResist = 0; e.accent = spawn.color || WHITE;
    e.state = 'part';
    e.update = function (game) {
      this.t++; if (this.flash > 0) this.flash--;
      const b = this.parent;
      if (!b || b.dead || game.boss !== b) { this.dead = true; return; }
      this.noContact = !(b.active && b.contact > 0);
    };
    e.draw = function () {};
    e.takeHit = function (hit, game) {
      const b = this.parent;
      if (!b || !b.active || b.dead || !b.hurtBy) return blocked();
      if (!hit.multi) { if (hit.hitList.indexOf(b) >= 0) return blocked(); hit.hitList.push(b); }
      // DESIGN §8.3: a hit box that reaches the head is a head hit (×1.5) even when it also covers a trailing segment —
      // the engine resolves enemies (these proxies) before the boss, so the segment must forward the head's multiplier
      const onHead = b.dmgMult && U.aabb(hit.x, hit.y, hit.w, hit.h, b.x - b.w / 2, b.y - b.h, b.w, b.h);
      const r = b.hurtBy(hit, game, onHead ? b.dmgMult(hit) : 1);
      res.dmg = r.dmg; res.blocked = r.blocked; res.killed = false;
      if (!r.blocked) this.flash = 4;
      if (b.hp <= 0 && game.bossFight && game.bossFight.state === 'fight' && typeof game.startBossDeath === 'function') game.startBossDeath();
      return res;
    };
    return e;
  }

  // ==========================================================================================
  // Factory
  // ==========================================================================================
  const CREATORS = {
    scuttlebit: createScuttlebit, walker: createScuttlebit, hopnode: createHopnode, driftmoth: createDriftmoth,
    brinejelly: createBrinejelly, glarewisp: createGlarewisp, spitvalve: createSpitvalve, rambyte: createRambyte,
    platewalker: createPlatewalker, broodcell: createBroodcell, mote: createMote, droplatch: createDroplatch,
    voltwheel: createVoltwheel, bossSegment: createSegment,
  };

  UB.Enemies = {
    TYPES: TYPES,
    COLORS: C,
    /** Create an enemy at a room spawn {type, x, y, patrol, variant, facing, …}; null for unknown types. */
    create: function (type, spawn, room, game) {
      const d = TYPES[type], make = CREATORS[type];
      if (!d || !make) return null;
      const v = spawn && spawn.variant && d.variants ? (d.variants[spawn.variant] || null) : null;
      return make(type, d, v, spawn || { x: 0, y: 0 }, room, game);
    },
    // shared with bosses.js
    shape: shape, drawRig: drawRig, beginDraw: beginDraw, pathOf: pathOf,
    makeShot: makeShot, SHOTS: SHOTS, applyDamage: applyDamage,
  };
})(window.UB);
