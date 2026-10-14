/*
 * UNDERBYTE — js/bosses.js
 * Owner: ENEMIES implementer.
 * Contract: CONTRACT.md §6.2 (boss object + hooks, multi-phase rule), §7 (hits, projectiles).
 * Design: DESIGN.md §8 (every boss, attack, tell, timing), §9.3 (drops), §11.2.4 (rigs, telegraphs).
 *
 * UB.Bosses.create(bossId, room, game, spec) → boss (UB.Entity, units 'pxf', kbResist 0).
 * The boss starts at spec.spawn (feet tile; the centre tile for the fliers/crawler) and drops
 * its module at spec.pickup — arena geometry (fight bounds, floor and ceiling) is derived from
 * `spec.bounds` and the room tiles, never hard-coded.
 *
 *   tallock   — ground stack: Slab Swing · Stomp Quake · Disc Toss · Stack Slam; enrage ≤ 36.
 *   weftyr    — flying spindle: Thread Dash · Snare Line · Needle Rain · Spool Spin; enrage ≤ 54.
 *   corrosant — surface crawler (head + 7 segments as hit proxies, see enemies.js bossSegment):
 *               Wall Lunge · Acid Spit · Ceiling Drip · Coil Sweep; enrage ≤ 72 = Flood.
 *   kernauth  — final, 2 phases: seated (Cable Sweep · Root Spikes · Orbital Flare · Summon) →
 *               unbound (Dive Bomb · Static Beam · Fragment Burst · Blink Slam); Panic Loop ≤ 60.
 *   proto_warden — the engine's debug placeholder (kept; the smoke test expects it).
 *
 * The engine owns the fight sequence (trigger → seal → intro card → fight → death → rewards),
 * the HP bar and contact damage; a boss owns its attacks, tells (DESIGN §11.2.4 telegraph
 * pulse on the attacking part), movement and drawing. Phase changes and enrage roars happen
 * inside takeHit (CONTRACT §6.2): while roaring/transitioning hits return blocked.
 * Frame counters only; randomness through game.rng(); no per-frame allocations.
 */
'use strict';
(function (UB) {
  const E = UB.Entity, P = UB.Palette, U = UB.Util, FX = UB.FX, Au = UB.Audio, En = UB.Enemies;
  const shape = En.shape, drawRig = En.drawRig, makeShot = En.makeShot, SHOTS = En.SHOTS;
  const TILE = 30, TAU = Math.PI * 2, PI = Math.PI, DEG = Math.PI / 180;
  const INK = P.INK, WHITE = '#FFFFFF';
  const res = { dmg: 0, killed: false, blocked: false };
  const DASH = [6, 6], NODASH = [];
  const RING80 = { radius: 80, life: 20 }, RING40 = { radius: 40, life: 14 };
  const CHIP_O = { color: WHITE, dir: 0 };
  const PK_BIT = { size: 'large', vx: 0, vy: 0, permanent: true };
  const PK_SPARK = { vx: 0, vy: 0, permanent: true };
  const PK_ABIL = { ability: null, bossId: null, glow: null };
  const DUST_N = null;
  function noop() {}

  const DATA = {
    proto_warden: { name: 'PROTO WARDEN', subtitle: 'PLACEHOLDER OF THE ARENA', hp: 40, w: 60, h: 80,
      ability: 'echoJump', bits: 60, sparks: 3, deathFrames: 60, final: false, enrage: 0,
      body: '#2a3a5c', rim: '#6c86b8', glow: '#8fd3ff', accent: '#6c86b8' },
    tallock: { name: 'TALLOCK', subtitle: 'WARDEN OF THE STACK', hp: 120, w: 90, h: 120, ability: 'echoJump', bits: 60, sparks: 3,
      deathFrames: 90, final: false, enrage: 36, accent: '#8fd3ff', glow: '#8fd3ff',
      cols: { disc: '#2a3a5c', rim: '#6c86b8', glow: '#8fd3ff', arm: '#15213a' } },
    weftyr: { name: 'WEFTYR', subtitle: 'THE SHUTTLE THAT WOULD NOT STOP', hp: 180, w: 110, h: 40, ability: 'burstLine', bits: 100, sparks: 3,
      deathFrames: 90, final: false, enrage: 54, accent: '#ffb24a', glow: '#ffb24a',
      cols: { body: '#5a3519', blades: '#b8733a', thread: '#ffb24a', lens: '#ff5a3a' } },
    corrosant: { name: 'CORROSANT', subtitle: 'KEEPER OF THE BRINE', hp: 240, w: 50, h: 40, ability: 'gripProtocol', bits: 140, sparks: 3,
      deathFrames: 120, final: false, enrage: 72, accent: '#a8ffcf', glow: '#a8ffcf',
      cols: { head: '#1d4d3a', seg: '#0d2a20', fins: '#a8ffcf', acid: '#4fae84' } },
    kernauth: { name: 'KERNAUTH', subtitle: 'THE ROOT PROCESS', hp: 200, hp2: 240, w: 150, h: 180, ability: null, bits: 0, sparks: 3,
      deathFrames: 120, final: true, enrage: 60, accent: '#ffcf5a', glow: '#ffcf5a',
      cols: { mass: '#4d1018', cables: '#2a080c', core: '#ffcf5a', crown: '#b32a2a', hot: '#fff4d6' } },
  };

  // ==========================================================================================
  // Shared boss plumbing
  // ==========================================================================================
  function blocked() { res.dmg = 0; res.killed = false; res.blocked = true; return res; }
  function mkHit(kind, tag, dmg, flags, multi) {
    const h = E.makeHit('boss'); h.kind = kind; h.tag = tag; h.dmg = dmg; h.flags = flags; h.multi = !!multi;
    h.hitstop = 6; h.kbx = 240; h.kby = -300; return h;
  }
  function regBox(game, h, x, y, w, hh, facing) { h.x = x; h.y = y; h.w = w; h.h = hh; h.facing = facing; game.registerHit(h); }
  function tileSolid(room, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) return true;
    const ch = room.tiles[ty][tx]; return ch === '#' || ch === 'c';
  }
  /**
   * Arena geometry from the boss spec + room tiles: px bounds (the fight bounds intersected with the
   * air interior around the spawn tile, so wall columns inside a loose bounds record are excluded),
   * floor (feet line) and ceiling (top of the air) in the spawn column.
   */
  function arenaOf(spec, room) {
    const bd = spec.bounds || [0, room.w - 1];
    const sx = spec.spawn.x, sy = spec.spawn.y;
    let fr = sy; while (fr < room.h - 1 && !tileSolid(room, sx, fr + 1)) fr++;
    let cr = sy; while (cr > 0 && !tileSolid(room, sx, cr - 1)) cr--;
    // side walls: scan the six air rows just above the floor of the spawn column and keep the innermost
    // wall (exit openings sit at floor level, walls do not). The rows are air at the spawn column by
    // construction, so a flier spawned under the ceiling or a crawler on it reads the same arena as a walker.
    let lc = 0, rc = room.w - 1;
    for (let ry = Math.max(cr, fr - 5); ry <= fr; ry++) {
      let l = sx; while (l > 0 && !tileSolid(room, l - 1, ry)) l--;
      let r = sx; while (r < room.w - 1 && !tileSolid(room, r + 1, ry)) r++;
      if (l > lc) lc = l; if (r < rc) rc = r;
    }
    const x0 = Math.max(bd[0], lc) * TILE, x1 = (Math.min(bd[1], rc) + 1) * TILE;
    return { x0: x0, x1: x1, cx: (x0 + x1) / 2, floorY: (fr + 1) * TILE, ceilY: cr * TILE, room: room };
  }
  function rowC(n) { return n * TILE + TILE / 2; }
  /** A telegraph length after the enrage cut: never shorter than 20 f (DESIGN §8.0 fairness floor). */
  function tellOf(b, n) { return Math.max(20, n - b.tellCut); }
  function bossBase(id, d, spec, w, h) {
    const sp = spec.spawn;
    const b = new E({ x: sp.x * TILE + TILE / 2, y: (sp.y + 1) * TILE, w: w, h: h, hp: d.hp, units: 'pxf', kbResist: 0 });
    b.id = id; b.name = d.name; b.subtitle = d.subtitle; b.data = d; b.spec = spec;
    b.phase = 1; b.state = 'idle'; b.attack = ''; b.contact = 1; b.active = false; b.final = !!d.final;
    b.deathFrames = d.deathFrames; b.accent = d.accent; b.facing = -1;
    b.timer = 0; b.roar = 0; b.roarFrames = 45; b.enraged = false; b.enrageHp = d.enrage || 0; b.coreBright = 0; b.tellCut = 0;
    b.takeHit = bossTakeHit; b.hurtBy = bossHurtBy; b.onDefeated = bossDefeated; b.dmgMult = null; b.nextPhase = null; b.onEnrage = null;
    return b;
  }
  /** Damage entry point (also used by Corrosant's segments with mult 1). Handles enrage + phase change. */
  function bossHurtBy(hit, game, mult) {
    const b = this;
    if (b.roar > 0 || b.state === 'transition' || b.state === 'blinkOut') return blocked();
    if (hit.dmg <= 0) { b.flash = 4; res.dmg = 0; res.killed = false; res.blocked = false; return res; }   // a 0-damage hit (the Overclock shove, DESIGN §3.9) never rounds up
    let dmg = hit.dmg;
    if (mult > 1) { dmg = Math.floor(dmg * mult); if (dmg < hit.dmg + 1) dmg = hit.dmg + 1; }
    else if (mult < 1) { dmg = Math.floor(dmg * mult); if (dmg < 1) dmg = 1; }
    b.hp -= dmg; b.flash = 4; b.coreBright = 10;
    res.dmg = dmg; res.killed = false; res.blocked = false;
    if (b.hp <= 0) {
      if (b.nextPhase && b.nextPhase(game)) return res;
      b.hp = 0; b.dead = true; res.killed = true; return res;
    }
    if (!b.enraged && b.enrageHp > 0 && b.hp <= b.enrageHp) startEnrage(b, game);
    return res;
  }
  function bossTakeHit(hit, game) { return this.hurtBy(hit, game, this.dmgMult ? this.dmgMult(hit) : 1); }
  /** DESIGN §8.0 enrage: one-off roar (invulnerable), bossPhase sfx, shake 9/20, HP bar phase-2 colours. */
  function startEnrage(b, game) {
    b.enraged = true; if (b.phase < 2) b.phase = 2;
    b.roar = b.roarFrames; b.state = 'roar'; b.attack = 'roar'; b.vx = 0; b.vy = 0;
    Au.sfx('bossPhase', b.x); FX.shake(9, 20); FX.burst('ring', b.x, b.cy(), 1, RING80);
    if (b.onEnrage) b.onEnrage(game);
  }
  /** DESIGN §9.3 rewards: large coins (20 bits each), 3 sparks, the ability module at spec.pickup. */
  function bossDefeated(game) {
    const d = this.data, spec = this.spec, n = Math.round((d.bits || 0) / 20);
    for (let i = 0; i < n; i++) {
      PK_BIT.vx = (i - (n - 1) / 2) * 1.2; PK_BIT.vy = -5 - (i & 1);
      game.spawnPickup('bit', this.x + (i - (n - 1) / 2) * 14, this.cy(), PK_BIT);
    }
    for (let i = 0; i < (d.sparks || 0); i++) {
      PK_SPARK.vx = (i - 1) * 1.6; PK_SPARK.vy = -6;
      game.spawnPickup('spark', this.x + (i - 1) * 24, this.cy() - 10, PK_SPARK);
    }
    if (!this.final && d.ability && spec.pickup) {
      PK_ABIL.ability = d.ability; PK_ABIL.bossId = this.id; PK_ABIL.glow = d.glow;
      game.spawnPickup('ability', spec.pickup.x * TILE + TILE / 2, (spec.pickup.y + 1) * TILE, PK_ABIL);
    }
  }
  /** Flying bosses: no gravity, own bounds clamp (the engine applies gravity to idle bosses otherwise). */
  function flyMove(level) {
    const A = this.A;
    this.x += this.vx; this.y += this.vy;
    const hw = this.w / 2;
    if (this.x < A.x0 + hw) this.x = A.x0 + hw; else if (this.x > A.x1 - hw) this.x = A.x1 - hw;
    if (this.y < A.ceilY + this.h) this.y = A.ceilY + this.h; else if (this.y > A.floorY) this.y = A.floorY;
  }
  /** Move the body centre toward (tx, ty) at `speed`; true when it arrived. */
  function seek(b, tx, ty, speed) {
    const cx = b.x, cy = b.y - b.h / 2;
    const dx = tx - cx, dy = ty - cy, d = Math.sqrt(dx * dx + dy * dy);
    if (d <= speed) { b.vx = dx; b.vy = dy; return true; }
    b.vx = dx / d * speed; b.vy = dy / d * speed; return false;
  }
  function deathFade(b) { const k = Math.min(1, b.t / Math.max(1, b.deathFrames)); return k; }
  function setDash(ctx, on) { ctx.setLineDash(on ? DASH : NODASH); }

  // ==========================================================================================
  // Boss projectile kinds (registered into UB.Enemies.SHOTS)
  // ==========================================================================================
  SHOTS.wave = { w: 30, h: 20, grav: 0, life: 80, tiles: 'none', destructible: false, multi: false, dmg: 1, flags: 1,
    step: function (s, game) {
      s.x += s.vx;
      const dir = s.vx < 0 ? -1 : 1, lv = game.level;
      if (E.solidAt(lv, Math.floor((s.x + dir * 16) / TILE), Math.floor((s.y - 8) / TILE))) s.dead = true;
      if ((s.t & 3) === 0) FX.burst('dust', s.x, s.y, 1, DUST_N);
    },
    draw: function (ctx, s, x, y) {
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillStyle = s.col;
      ctx.beginPath(); ctx.moveTo(x - 16, y); ctx.quadraticCurveTo(x - 6, y - 26, x + 4, y - 14); ctx.quadraticCurveTo(x + 10, y - 8, x + 16, y); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = WHITE; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(x - 4, y - 12, 2, 0, TAU); ctx.fill();
    } };
  SHOTS.disc = { w: 30, h: 10, grav: 0.2, maxFall: 10, life: 150, tiles: 'solid', destructible: true, multi: false, dmg: 1, flags: 2, onHit: popSelf,
    step: function (s, game) {
      s.gravity(0.2, 10); s.moveAndCollide(game.level); s.ang += 0.4;
      if (s.hitWall || s.hitCeiling || (s.onGround && s.bounces >= 1) || s.bounces >= 2) s.dead = true;
    },
    draw: function (ctx, s, x, y) {
      ctx.translate(x, y - 5); ctx.rotate(Math.sin(s.ang) * 0.3);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillStyle = s.col;
      ctx.beginPath(); ctx.ellipse(0, 0, 15, 5, 0, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = s.col2; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -1, 11, 2.5, 0, PI, TAU); ctx.stroke();
    } };
  SHOTS.needle = { w: 8, h: 24, grav: 0, life: 400, tiles: 'solid', ignoreOneWay: true, destructible: true, multi: false, dmg: 1, flags: 2, onHit: popSelf,
    step: function (s, game) {
      if (s.stuck) return;
      s.vy = 7; s.moveAndCollide(game.level);
      if (s.onGround) { s.stuck = true; s.life = 90; s.destructible = false; s.hit.multi = true; s.hit.flags = 1; s.hit.kind = 'contact'; s.hit.onHit = null; s.hit.noKbx = true; s.w = 20; s.vy = 0; }
    },
    draw: function (ctx, s, x, y) {
      const k = s.stuck && s.life < 20 ? s.life / 20 : 1;
      ctx.globalAlpha = k; ctx.translate(x, y); if (s.stuck) ctx.rotate(0.12);
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillStyle = s.col;
      ctx.beginPath(); ctx.moveTo(-4, -24); ctx.lineTo(4, -24); ctx.lineTo(1, 0); ctx.lineTo(-1, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = WHITE; ctx.globalAlpha = 0.6 * k; ctx.fillRect(-1, -22, 1.5, 10);
    } };
  // a trip-thread: the first fighter it catches takes 1 and the thread snaps (popSelf) — a floor you can jump back onto, not a 240 f damage field
  SHOTS.snare = { w: 300, h: 8, grav: 0, life: 240, tiles: 'none', destructible: false, multi: true, dmg: 1, flags: 1, onHit: popSelf,
    draw: function (ctx, s, x, y) {
      const k = s.life < 30 ? s.life / 30 : 1, fl = (s.t & 4) ? 1 : 0.7;
      ctx.globalAlpha = k;
      ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - s.w / 2, y - 4); ctx.lineTo(x + s.w / 2, y - 4); ctx.stroke();
      ctx.strokeStyle = s.col; ctx.lineWidth = 3; ctx.globalAlpha = k * fl; ctx.beginPath(); ctx.moveTo(x - s.w / 2, y - 4); ctx.lineTo(x + s.w / 2, y - 4); ctx.stroke();
      ctx.strokeStyle = WHITE; ctx.lineWidth = 1; ctx.globalAlpha = k * 0.5; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const px = x - s.w / 2 + (i + 0.5) * s.w / 8; ctx.moveTo(px - 3, y - 7); ctx.lineTo(px + 3, y - 1); }
      ctx.stroke();
    } };
  SHOTS.drip = { w: 6, h: 12, grav: 0, life: 200, tiles: 'pop', ignoreOneWay: true, destructible: true, multi: false, dmg: 1, flags: 2, onHit: popSelf,
    draw: function (ctx, s, x, y) {
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.fillStyle = s.col;
      ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.quadraticCurveTo(x + 4, y - 4, x, y); ctx.quadraticCurveTo(x - 4, y - 4, x, y - 12); ctx.fill(); ctx.stroke();
    } };
  SHOTS.orb = { w: 16, h: 16, grav: 0, life: 180, tiles: 'none', destructible: true, multi: false, dmg: 1, flags: 2, onHit: popSelf,
    step: function (s, game) {
      const pl = game.player;
      if (pl) {
        const want = Math.atan2(pl.cy() - s.cy(), pl.x - s.x);
        let d = want - s.ang; while (d > PI) d -= TAU; while (d < -PI) d += TAU;
        s.ang += U.clamp(d, -DEG, DEG);
      }
      s.vx = Math.cos(s.ang) * 2.5; s.vy = Math.sin(s.ang) * 2.5;
      s.x += s.vx; s.y += s.vy;
    },
    draw: function (ctx, s, x, y) {
      const cy = y - 8;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.3; ctx.fillStyle = s.col; ctx.beginPath(); ctx.arc(x, cy, 16, 0, TAU); ctx.fill(); ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillStyle = s.col; ctx.beginPath(); ctx.arc(x, cy, 7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = WHITE; ctx.beginPath(); ctx.arc(x, cy, 2.5 + Math.sin(s.t / 4), 0, TAU); ctx.fill();
    } };
  SHOTS.frag = { w: 10, h: 10, grav: 0, life: 120, tiles: 'none', destructible: true, multi: false, dmg: 1, flags: 2, onHit: popSelf,
    step: function (s, game) { s.x += s.vx; s.y += s.vy; s.ang += 0.2; },
    draw: function (ctx, s, x, y) {
      ctx.translate(x, y - 5); ctx.rotate(s.ang);
      ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.fillStyle = s.col;
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 6); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    } };
  function popSelf(victim, r, game) { if (this.src) this.src.dead = true; }

  // ==========================================================================================
  // PROTO WARDEN — the engine architect's placeholder (debug arena), unchanged behaviour
  // ==========================================================================================
  function createWarden(id, d, room, game, spec) {
    const b = bossBase(id, d, spec, d.w, d.h);
    b.cool = 90;
    b.hit = mkHit('heavy', 'slam', 1, 0); b.hit.src = b;
    b.onIntro = function () { this.state = 'roar'; };
    b.onFightStart = function () { this.state = 'walk'; this.active = true; };
    b.update = function (game, player) {
      this.t++;
      if (this.flash > 0) this.flash--;
      this.facing = player.x < this.x ? -1 : 1;
      if (this.state === 'walk') {
        this.vx = this.facing * 1.0;
        if (--this.cool <= 0 && Math.abs(player.x - this.x) < 140) { this.state = 'tell'; this.timer = 30; this.vx = 0; this.attack = 'slam'; }
      } else if (this.state === 'tell') {
        this.vx = 0;
        if (--this.timer <= 0) { this.state = 'slam'; this.timer = 10; this.hit.hitList.length = 0; FX.shake(7, 12); Au.sfx('heavyHit', this.x); }
      } else if (this.state === 'slam') {
        this.vx = 0;
        E.hitBoxWorld(this, 55, 10, 70, 60, this.hit); this.hit.facing = this.facing; game.registerHit(this.hit);
        if (--this.timer <= 0) { this.state = 'recover'; this.timer = 40; }
      } else if (this.state === 'recover') {
        this.vx = 0;
        if (--this.timer <= 0) { this.state = 'walk'; this.cool = 90; this.attack = ''; }
      } else this.vx = 0;
      this.gravity(0.5, 12); this.moveAndCollide(game.level);
    };
    b.draw = function (ctx, game, alpha) {
      const x = U.lerp(this.px, this.x, alpha), y = U.lerp(this.py, this.y, alpha);
      let sy = 1, a = 1;
      if (this.dead) { const k = deathFade(this); sy = 1 - 0.6 * k; a = 1 - k * 0.8; }
      ctx.save(); ctx.translate(x, y); ctx.scale(this.facing, sy); ctx.globalAlpha = a;
      ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = INK;
      const widths = [60, 56, 52, 48, 44, 40];
      const wob = this.state === 'tell' ? Math.sin(this.t * 0.8) * 3 : 0;
      for (let i = 0; i < 6; i++) {
        const w = widths[i], cy = -8 - i * 14;
        ctx.fillStyle = this.flash > 0 ? WHITE : d.body;
        ctx.beginPath(); ctx.ellipse(wob * (i / 5), cy, w / 2, 7, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = d.rim; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(wob * (i / 5), cy - 2, w / 2 - 4, 3, 0, PI, TAU); ctx.stroke();
        ctx.strokeStyle = INK; ctx.lineWidth = 3;
      }
      const armSwing = this.state === 'slam' ? 0.9 : (this.state === 'tell' ? -0.6 : Math.sin(this.t / 20) * 0.15);
      ctx.save(); ctx.translate(18, -48); ctx.rotate(armSwing); ctx.fillStyle = '#15213a'; ctx.fillRect(-6, 0, 12, 40); ctx.strokeRect(-6, 0, 12, 40); ctx.restore();
      ctx.save(); ctx.translate(-18, -48); ctx.rotate(-armSwing * 0.5); ctx.fillStyle = '#15213a'; ctx.fillRect(-6, 0, 12, 40); ctx.strokeRect(-6, 0, 12, 40); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = d.glow; ctx.globalAlpha = a * (this.flash > 0 ? 1 : 0.8);
      ctx.fillRect(-12, -84, 24, 4); ctx.restore();
      ctx.restore();
    };
    return b;
  }

  // ==========================================================================================
  // 8.1 TALLOCK — Warden of the Stack (ground boss, 90×120)
  // ==========================================================================================
  const TAL_NAME = ['', 'slabSwing', 'stompQuake', 'discToss', 'stackSlam'];
  const TAL_TELL = [0, 30, 36, 24, 40];
  const TAL_W = [90, 84, 78, 72, 66, 60];
  function createTallock(id, d, room, game, spec) {
    const b = bossBase(id, d, spec, 90, 120);
    const K = d.cols;
    b.A = arenaOf(spec, room);
    b.walkSpeed = 1.5; b.gap = 45; b.waveSpeed = 5; b.last1 = 0; b.last2 = 0; b.atk = 0; b.slamX = 0; b.thud = 0;
    b.hitA = mkHit('heavy', 'swing', 1, 0); b.hitA.src = b;
    b.hitL = mkHit('heavy', 'shock', 2, 1); b.hitL.src = b;
    b.hitR = mkHit('heavy', 'shock', 2, 1); b.hitR.src = b;
    const r = b.rig = [];
    b.armB = shape('rrect', K.arm); b.armB.w = 16; b.armB.h = 50; b.armB.r = 3; r.push(b.armB);
    b.discs = []; b.rims = [];
    for (let i = 0; i < 6; i++) {
      const ds = shape('ellipse', K.disc); ds.rx = TAL_W[i] / 2; ds.ry = 9; b.discs.push(ds); r.push(ds);
      const rm = shape('earc', K.rim); rm.rx = TAL_W[i] / 2 - 5; rm.ry = 4; rm.a0 = PI; rm.a1 = TAU; rm.lw = 2; b.rims.push(rm); r.push(rm);
    }
    b.armF = shape('rrect', K.arm); b.armF.w = 16; b.armF.h = 50; b.armF.r = 3; r.push(b.armF);
    b.visor = shape('rrect', K.glow); b.visor.w = 30; b.visor.h = 6; b.visor.r = 2; b.visor.glow = true; r.push(b.visor);
    b.onIntro = function () { this.state = 'roarIntro'; this.attack = ''; };
    b.onFightStart = function () { this.state = 'walk'; this.timer = this.gap; this.attack = ''; this.active = true; };
    b.onEnrage = function () { this.walkSpeed = 2.2; this.gap = 30; this.tellCut = 6; this.waveSpeed = 6.5; };
    b.update = tallockUpdate; b.draw = tallockDraw;
    return b;
  }
  function tallockRecover(b, n) { b.state = 'recover'; b.timer = n; b.vx = 0; }
  function tallockPick(b, game, adx) {
    const r = game.rng();
    let a;
    if (adx < 90) a = r < 0.6 ? 1 : 2;
    else if (adx < 180) a = r < 0.5 ? 2 : 4;
    else a = r < 0.7 ? 3 : 4;
    if (a === b.last1 && a === b.last2) a = adx < 90 ? (a === 1 ? 2 : 1) : (adx < 180 ? (a === 2 ? 4 : 2) : (a === 3 ? 4 : 3));
    b.last2 = b.last1; b.last1 = a; b.atk = a; b.attack = TAL_NAME[a];
    b.state = 'tell'; b.timer = tellOf(b, TAL_TELL[a]); b.vx = 0;
  }
  function tallockActive(b, game, player) {
    const K = b.data.cols;
    switch (b.atk) {
      case 1: b.state = 'swing'; b.timer = 12; b.hitA.hitList.length = 0; Au.sfx('whiff', b.x); break;
      case 2: {
        const wl = makeShot(game, 'wave', b.x - 45, b.y, -b.waveSpeed, 0, K.rim), wr = makeShot(game, 'wave', b.x + 45, b.y, b.waveSpeed, 0, K.rim);
        if (wl) wl.src = b; if (wr) wr.src = b;
        FX.shake(6, 10); FX.burst('dust', b.x - 40, b.y, 6, DUST_N); FX.burst('dust', b.x + 40, b.y, 6, DUST_N); Au.sfx('heavyHit', b.x);
        tallockRecover(b, 50); break;
      }
      case 3: tallockDisc(b, game, 1); if (b.enraged) { b.state = 'tossWait'; b.timer = 15; } else tallockRecover(b, 30); break;
      case 4: b.slamX = player.x; b.vy = -11; b.vx = (b.slamX - b.x) / 50; b.state = 'slam'; b.timer = 0; b.contact = 1; break;
    }
  }
  function tallockDisc(b, game, mul) {
    const K = b.data.cols;
    const s = makeShot(game, 'disc', b.x, b.y - 112, b.facing * 4.5 * mul, -4, K.disc);
    if (s) { s.src = b; s.col2 = K.rim; s.bounce = 0.6; }
    Au.sfx('turretShot', b.x);
  }
  function tallockUpdate(game, player) {
    const b = this; b.t++;
    if (b.flash > 0) b.flash--; if (b.coreBright > 0) b.coreBright--;
    if (b.roar > 0) { b.vx = 0; if (--b.roar === 0) { b.state = 'walk'; b.timer = b.gap; b.attack = ''; } b.gravity(0.5, 12); b.moveAndCollide(game.level); return; }
    const dx = player.x - b.x, adx = Math.abs(dx);
    switch (b.state) {
      case 'walk':
        b.facing = dx < 0 ? -1 : 1; b.vx = b.facing * b.walkSpeed;
        if (--b.timer <= 0) tallockPick(b, game, adx);
        break;
      case 'tell':
        b.vx = 0;
        if (--b.timer <= 0) tallockActive(b, game, player);
        break;
      case 'swing': {
        b.vx = 0;
        // DESIGN §8.1: a 70×40 arc sweeping top→bottom over the 12 active frames — its top edge from 90 px to 40 px above
        // the floor — so a jump started mid-tell sails over it while a standing fighter is caught on its way down
        const k = 12 - b.timer;
        E.hitBoxWorld(b, 60, -10 + 50 * k / 11, 70, 40, b.hitA); b.hitA.facing = b.facing; game.registerHit(b.hitA);
        if (--b.timer <= 0) tallockRecover(b, 40);
        break;
      }
      case 'tossWait':
        b.vx = 0;
        if (--b.timer <= 0) { tallockDisc(b, game, 0.8); tallockRecover(b, 30); }
        break;
      case 'slam':
        b.timer++;
        break;
      case 'shock':
        b.vx = 0;
        regBox(game, b.hitL, b.x - 45 - 40, b.y - 30, 40, 30, -1);
        regBox(game, b.hitR, b.x + 45, b.y - 30, 40, 30, 1);
        if (--b.timer <= 0) tallockRecover(b, 60);
        break;
      case 'recover':
        b.vx = 0;
        if (--b.timer <= 0) { b.state = 'walk'; b.timer = b.gap; b.attack = ''; }
        break;
      default: b.vx = 0;
    }
    b.gravity(b.state === 'slam' ? 0.44 : 0.5, 12); b.moveAndCollide(game.level);
    if (b.state === 'slam' && b.timer > 4 && b.onGround) {
      b.state = 'shock'; b.timer = 10; b.vx = 0; b.hitL.hitList.length = 0; b.hitR.hitList.length = 0;
      FX.shake(8, 14); FX.burst('dust', b.x - 45, b.y, 6, DUST_N); FX.burst('dust', b.x + 45, b.y, 6, DUST_N); Au.sfx('heavyHit', b.x);
    }
  }
  function tallockDraw(ctx, game, alpha) {
    const b = this, t = b.t, st = b.state, K = b.data.cols;
    const x = U.lerp(b.px, b.x, alpha), y = U.lerp(b.py, b.y, alpha);
    const dying = b.dead;
    let sy = 1, rise = 0, wob = 0, a = 1;
    if (st === 'tell') {
      if (b.atk === 2) rise = 20 * (1 - b.timer / 36);
      else if (b.atk === 4) sy = 0.8 + 0.2 * (b.timer / 40);
      else if (b.atk === 1) wob = Math.sin(t * 0.8) * 2;
    } else if (st === 'recover' || st === 'walk') wob = Math.sin(t / 6) * (st === 'recover' && b.atk === 4 ? 4 : 1.5);
    else if (st === 'slam') sy = 1.1;
    if (b.roar > 0) wob = Math.sin(t * 1.2) * 4;
    if (dying) a = 1 - Math.max(0, (t - 70) / 20);
    // discs + rims
    for (let i = 0; i < 6; i++) {
      const ds = b.discs[i], rm = b.rims[i];
      let cx = wob * i / 5, cy = 51 - i * 20;
      if (dying) {
        const t0 = (5 - i) * 12, dt = Math.max(0, t - t0);
        let dy = 0.3 * dt * dt; const maxDy = 51 - cy;
        if (dy >= maxDy) { dy = maxDy; if (dt > 0 && !(b.thud & (1 << i))) { b.thud |= (1 << i); FX.shake(4, 6); } }
        cy += dy; cx += (i - 2.5) * 11 * Math.min(1, dy / Math.max(1, maxDy));
      }
      ds.x = cx; ds.y = cy; rm.x = cx; rm.y = cy - 3;
      ds.tell = (st === 'tell' && ((b.atk === 2 && i === 0) || (b.atk === 4 && i === 0) || (b.atk === 3 && i === 5)));
    }
    // arms hang from the third disc (pivot at its edge), swing with the walk / raise for the swing
    const walkSw = st === 'walk' ? Math.sin(t / 8) * 0.35 : 0;
    // rot 0 = hanging; +2.6 = raised up and forward (the Slab Swing wind-up), sweeping down in front
    let rotF = walkSw, rotB = -walkSw * 0.6;
    if (st === 'tell' && b.atk === 1) rotF = 2.6 + 0.2 * Math.sin(t * 0.8);
    else if (st === 'swing') rotF = 2.6 - 2.4 * (12 - b.timer) / 12;
    else if (st === 'recover' && b.atk === 1) rotF = 0.2 * (b.timer / 40);
    const px = b.discs[2].x + 36, py = b.discs[2].y;
    b.armF.rot = rotF; b.armF.x = px + Math.sin(rotF) * 25; b.armF.y = py + Math.cos(rotF) * 25;
    b.armB.rot = rotB; b.armB.x = b.discs[2].x - 36 + Math.sin(rotB) * 25; b.armB.y = py + Math.cos(rotB) * 25;
    b.armF.tell = st === 'tell' && b.atk === 1; b.armB.tell = false;
    // visor on the top disc
    const spin = st === 'tell' && b.atk === 3 ? Math.abs(Math.cos(t * 0.5 * (1 + (24 - b.timer) / 12))) : 1;
    b.visor.x = b.discs[5].x; b.visor.y = b.discs[5].y - 2; b.visor.w = 30 * (0.2 + 0.8 * spin);
    b.visor.tell = st === 'tell' && b.atk === 3;
    if (dying) { b.visor.on = t < 60; }
    ctx.save(); ctx.translate(x, y - rise); ctx.scale(b.facing, sy); ctx.translate(0, -60); ctx.globalAlpha = a;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    drawRig(ctx, b.rig, b.flash > 0, st === 'tell', b.accent, t);
    if (b.coreBright > 0 && !dying) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = b.coreBright / 10 * 0.5; ctx.fillStyle = K.glow; ctx.fillRect(b.visor.x - 20, b.visor.y - 6, 40, 12); ctx.restore(); }
    ctx.restore();
    // stack slam target marker (world space) during the tell
    if (st === 'tell' && b.atk === 4 && game.player) {
      ctx.save(); ctx.globalAlpha = 0.35 + 0.25 * Math.cos(t * TAU / 8); ctx.fillStyle = b.accent;
      ctx.beginPath(); ctx.ellipse(game.player.x, b.A.floorY - 2, 50, 6, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
  }

  // ==========================================================================================
  // 8.2 WEFTYR — The Shuttle That Would Not Stop (flying spindle, hit-box 110×40)
  // ==========================================================================================
  const WEF_CYCLE = ['dash', 'snare', 'rain', 'dash', 'spin'];
  function createWeftyr(id, d, room, game, spec) {
    const b = bossBase(id, d, spec, 110, 40);
    const K = d.cols;
    b.y = spec.spawn.y * TILE + TILE / 2 + 20; b.py = b.y;
    b.A = arenaOf(spec, room);
    b.gravity = noop; b.moveAndCollide = flyMove; b.collideTiles = false; b.ignoreOneWay = true;
    b.cruise = 3; b.needles = 6; b.cyc = Math.floor(game.rng() * 5) % 5; b.atk = '';
    b.tx = b.x; b.ty = b.y - 20; b.rot = 0; b.spread = 0.3; b.lineY = 0; b.snare = null; b.dashDir = 1; b.passes = 0;
    b.marks = new Float32Array(9); b.nMarks = 0; b.shadowX = 0; b.trail = new Float32Array(8); b.trailT = 0;
    for (let i = 0; i < 4; i++) { b.trail[i * 2] = b.x - 60; b.trail[i * 2 + 1] = b.y - 20; }
    b.hitSpin = mkHit('heavy', 'spin', 1, 0); b.hitSpin.src = b;
    const r = b.rig = [];
    b.blade0 = shape('arc', K.blades); b.blade0.lw = 4; b.blade0.x = -10; b.blade0.y = -6; b.blade0.r = 26; r.push(b.blade0);
    b.blade1 = shape('arc', K.blades); b.blade1.lw = 4; b.blade1.x = -10; b.blade1.y = 6; b.blade1.r = 26; r.push(b.blade1);
    const body = shape('poly', K.body); body.pts = [-55, 0, -32, -11, 0, -15, 32, -11, 55, 0, 32, 11, 0, 15, -32, 11]; r.push(body); b.body = body;
    const bb0 = shape('ellipse', K.thread); bb0.rx = 18; bb0.ry = 15; r.push(bb0);
    const bb1 = shape('ellipse', K.body); bb1.rx = 13; bb1.ry = 11; bb1.ink = false; r.push(bb1);
    for (let i = 0; i < 3; i++) { const hl = shape('line', K.thread); hl.lw = 1; hl.ink = false; hl.x0 = -9 + i * 6; hl.y0 = -9; hl.x1 = -3 + i * 6; hl.y1 = 9; r.push(hl); }
    const bb2 = shape('ellipse', K.thread); bb2.rx = 7; bb2.ry = 6; bb2.ink = false; r.push(bb2);
    b.lens = shape('dot', K.lens); b.lens.x = 42; b.lens.y = -2; b.lens.r = 4; b.lens.glow = true; r.push(b.lens);
    b.onIntro = function () { this.state = 'roarIntro'; this.attack = ''; };
    b.onFightStart = function () { this.active = true; weftyrCruise(this, game); };
    b.onEnrage = function () { this.cruise = 4.5; this.tellCut = 5; this.needles = 9; };
    b.update = weftyrUpdate; b.draw = weftyrDraw;
    return b;
  }
  function weftyrClampRow(b, cy, r0, r1) {
    const A = b.A;
    return U.clamp(cy, Math.max(rowC(r0), A.ceilY + 40), Math.min(rowC(r1), A.floorY - 20));
  }
  /** Pick the next attack of the fixed cycle (Thread Dash only while a snare exists) and cruise to its start. */
  function weftyrCruise(b, game) {
    const A = b.A, pl = game.player;
    let atk = WEF_CYCLE[b.cyc];
    if (b.snare && !b.snare.dead && atk !== 'dash') atk = 'dash'; else b.cyc = (b.cyc + 1) % 5;
    b.atk = atk; b.state = 'cruise'; b.timer = 40; b.attack = ''; b.rot = 0; b.passes = 0;
    if (atk === 'dash') { b.dashDir = b.x < A.cx ? 1 : -1; b.tx = b.dashDir > 0 ? A.x0 + 60 : A.x1 - 60; b.ty = weftyrClampRow(b, pl ? pl.cy() : rowC(8), 4, 13); }
    else if (atk === 'snare') { b.tx = A.cx; b.ty = rowC(11); }
    else if (atk === 'rain') { b.tx = A.cx; b.ty = rowC(3) > A.ceilY + 40 ? rowC(3) : A.ceilY + 40; }
    else { b.tx = pl ? pl.x : A.cx; b.ty = rowC(8); }
  }
  function weftyrTell(b, game) {
    const pl = game.player, A = b.A;
    b.state = 'tell'; b.attack = b.atk;
    if (b.atk === 'dash') { b.lineY = weftyrClampRow(b, pl ? pl.cy() : b.y - 20, 4, 13); b.timer = tellOf(b, 30); }
    else if (b.atk === 'snare') { b.timer = tellOf(b, 24); }
    else if (b.atk === 'rain') {
      b.timer = tellOf(b, 40); b.nMarks = 0;
      const c0 = Math.floor(A.x0 / TILE) + 1, c1 = Math.floor(A.x1 / TILE) - 2;
      for (let tries = 0; tries < 60 && b.nMarks < b.needles; tries++) {
        const c = c0 + Math.floor(game.rng() * (c1 - c0 + 1));
        let ok = true;
        for (let i = 0; i < b.nMarks; i++) if (Math.abs(b.marks[i] - (c * TILE + 15)) < 2 * TILE) { ok = false; break; }
        if (ok) b.marks[b.nMarks++] = c * TILE + 15;
      }
    } else { b.timer = tellOf(b, 30); b.shadowX = pl ? pl.x : b.x; b.tx = b.shadowX; b.ty = rowC(8); }
  }
  function weftyrUpdate(game, player) {
    const b = this, A = b.A, K = b.data.cols; b.t++;
    if (b.flash > 0) b.flash--; if (b.coreBright > 0) b.coreBright--;
    if ((b.t & 7) === 0) { const tr = b.trail; for (let i = 3; i > 0; i--) { tr[i * 2] = tr[i * 2 - 2]; tr[i * 2 + 1] = tr[i * 2 - 1]; } tr[0] = b.x - b.facing * 50; tr[1] = b.y - 20; }
    if (b.roar > 0) { b.vx = 0; b.vy = 0; if (--b.roar === 0) weftyrCruise(b, game); return; }
    const cy = b.y - 20;
    switch (b.state) {
      case 'cruise':
        seek(b, b.tx, b.ty, b.cruise); b.moveAndCollide(game.level);
        if (b.vx !== 0) b.facing = b.vx < 0 ? -1 : 1;
        if (--b.timer <= 0) weftyrTell(b, game);
        break;
      case 'tell':
        if (b.atk === 'dash') { seek(b, b.tx, b.lineY, 6); b.moveAndCollide(game.level); b.facing = b.dashDir; }
        else if (b.atk === 'spin') { seek(b, b.tx, b.ty, 6); b.moveAndCollide(game.level); b.rot = U.approach(b.rot, PI / 2, 0.08); }
        else { seek(b, b.tx, b.ty, 4); b.moveAndCollide(game.level); b.vx = 0; b.vy = 0; }
        b.spread = b.atk === 'snare' ? U.approach(b.spread, 1, 0.05) : U.approach(b.spread, 0.3, 0.05);
        if (--b.timer <= 0) weftyrActive(b, game);
        break;
      case 'dash': {
        b.vx = b.dashDir * 12; b.vy = 0; b.facing = b.dashDir; b.moveAndCollide(game.level);
        const atEdge = b.dashDir > 0 ? b.x >= A.x1 - 60 : b.x <= A.x0 + 60;
        if (atEdge) {
          if (b.enraged && b.passes === 0) { b.state = 'dashRest'; b.timer = 20; }
          else { b.state = 'recover'; b.timer = 36; b.ty = rowC(12); b.tx = b.x; }
        }
        break;
      }
      case 'dashRest':
        b.vx = 0; b.vy = 0;
        if (--b.timer <= 0) { b.passes = 1; b.dashDir = -b.dashDir; b.lineY = weftyrClampRow(b, player.cy(), 4, 13); b.state = 'retell'; b.timer = 15; b.attack = 'dash'; }
        break;
      case 'retell':
        seek(b, b.x, b.lineY, 6); b.moveAndCollide(game.level); b.facing = b.dashDir;
        if (--b.timer <= 0) { b.y = b.lineY + 20; b.py = b.y; b.vy = 0; b.state = 'dash'; }
        break;
      case 'spinDrop':
        b.vx = 0; b.vy = 12; b.moveAndCollide(game.level); b.rot = PI / 2;
        if (b.y >= A.floorY - 0.5) { b.state = 'spin'; b.timer = 60; b.hitSpin.hitList.length = 0; FX.shake(6, 10); FX.burst('dust', b.x, b.y, 8, DUST_N); Au.sfx('heavyHit', b.x); }
        break;
      case 'spin':
        b.vx = U.clamp(player.x - b.x, -2, 2); b.vy = 0; b.moveAndCollide(game.level); b.y = A.floorY; b.rot += 0.35;
        regBox(game, b.hitSpin, b.x - 65, b.y - 60, 130, 60, b.facing);
        if (--b.timer <= 0) { b.state = 'recover'; b.timer = 60; b.tx = b.x; b.ty = b.y - 20; }
        break;
      case 'recover':
        if (b.atk === 'spin') { b.vx = 0; b.vy = 0; b.rot = PI / 2 + Math.sin(b.t / 5) * 0.1; }
        else { seek(b, b.tx, b.ty, 2.5); b.moveAndCollide(game.level); }
        if (--b.timer <= 0) weftyrCruise(b, game);
        break;
      default: b.vx = 0; b.vy = 0;
    }
  }
  function weftyrActive(b, game) {
    const A = b.A, K = b.data.cols;
    if (b.atk === 'dash') {
      // the dash runs exactly along the telegraphed thread: coming from far away the 30 f tell cannot always reach
      // the line (the seek is diagonal), so the shuttle snaps taut onto it as the pass begins
      b.y = b.lineY + 20; b.py = b.y; b.vy = 0;
      b.state = 'dash'; Au.sfx('whiff', b.x);
    } else if (b.atk === 'snare') {
      // a trip-line at knee height (box 8 px tall, bottom 14 px above the floor): every standing fighter overlaps it,
      // any jump clears it (DESIGN §8.2 "blocks ground movement across the arena: jump it or use the grates")
      const s = makeShot(game, 'snare', A.cx, A.floorY - 14, 0, 0, K.thread, A.x1 - A.x0, 8, 240);
      if (s) { s.src = b; b.snare = s; }
      b.state = 'recover'; b.timer = 20; b.tx = b.x; b.ty = b.y - 20;
    } else if (b.atk === 'rain') {
      for (let i = 0; i < b.nMarks; i++) { const s = makeShot(game, 'needle', b.marks[i], A.ceilY + 4, 0, 7, K.thread); if (s) s.src = b; }
      Au.sfx('turretShot', b.x);
      b.state = 'recover'; b.timer = 50; b.tx = A.cx; b.ty = rowC(11);
    } else { b.state = 'spinDrop'; }
  }
  function weftyrDraw(ctx, game, alpha) {
    const b = this, t = b.t, st = b.state, K = b.data.cols, A = b.A;
    const x = U.lerp(b.px, b.x, alpha), y = U.lerp(b.py, b.y, alpha), cy = y - 20;
    const dying = b.dead;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // telegraphs in world space
    if (st === 'tell' || st === 'retell') {
      ctx.globalAlpha = 0.45 + 0.35 * Math.cos(t * TAU / 8);
      if (b.attack === 'dash') {
        ctx.strokeStyle = K.thread; ctx.lineWidth = 2; setDash(ctx, (t & 4) === 0); ctx.beginPath(); ctx.moveTo(A.x0, b.lineY); ctx.lineTo(A.x1, b.lineY); ctx.stroke(); setDash(ctx, false);
      } else if (b.attack === 'rain') {
        ctx.fillStyle = K.thread;
        for (let i = 0; i < b.nMarks; i++) { if (((t >> 2) + i) & 1) continue; const mx = b.marks[i]; ctx.beginPath(); ctx.moveTo(mx - 4, A.ceilY + 4); ctx.lineTo(mx + 4, A.ceilY + 4); ctx.lineTo(mx, A.ceilY + 28); ctx.closePath(); ctx.fill(); }
      } else if (b.attack === 'spin') {   // landing shadow: ink core with an accent rim so it reads on the dark floor
        ctx.fillStyle = K.thread; ctx.beginPath(); ctx.ellipse(b.shadowX, A.floorY - 3, 64, 9, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(b.shadowX, A.floorY - 3, 56, 6, 0, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // thread trail
    ctx.strokeStyle = K.thread; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(x - b.facing * 50, cy);
    for (let i = 0; i < 4; i++) ctx.lineTo(b.trail[i * 2], b.trail[i * 2 + 1]);
    ctx.stroke(); ctx.globalAlpha = 1;
    // body
    let rot = b.rot, a = 1, sc = 1;
    if (dying) { rot = b.rot + t * 0.25; a = 1 - Math.max(0, (t - 60) / 30); sc = 1 - 0.3 * Math.max(0, (t - 60) / 30); }
    else if (st === 'tell' && b.attack === 'rain') rot = Math.sin(t * 1.3) * 0.06;
    b.blade0.a0 = PI * 1.15; b.blade0.a1 = PI * 1.15 + b.spread * PI * 0.5;
    b.blade1.a0 = PI * 0.85 - b.spread * PI * 0.5; b.blade1.a1 = PI * 0.85;
    b.blade0.tell = b.blade1.tell = st === 'tell' && b.attack === 'snare';
    b.body.tell = (st === 'tell' || st === 'retell') && (b.attack === 'dash' || b.attack === 'spin');
    ctx.translate(x, cy); ctx.scale(b.facing, 1); ctx.rotate(rot); ctx.scale(sc, sc); ctx.globalAlpha = a;
    drawRig(ctx, b.rig, b.flash > 0, st === 'tell' || st === 'retell', b.accent, t);
    if (b.coreBright > 0 && !dying) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = b.coreBright / 10 * 0.6; ctx.fillStyle = K.lens; ctx.beginPath(); ctx.arc(42, -2, 9, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.restore();
    // dizzy stars after the spin
    if (st === 'recover' && b.atk === 'spin') {
      ctx.save(); ctx.fillStyle = K.thread;
      for (let i = 0; i < 3; i++) { const ang = t / 10 + i * 2.1; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * 30, cy - 36 + Math.sin(ang) * 6, 3, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
  }

  // ==========================================================================================
  // 8.3 CORROSANT — Keeper of the Brine (surface crawler: head 50×40 + 7 segments)
  // ==========================================================================================
  const INS = 22, PATH_N = 1024, SEGS = 7;
  const perOut = { x: 0, y: 0, surf: 0, nx: 0, ny: 0 };
  const pathOut = { x: 0, y: 0 };
  function createCorrosant(id, d, room, game, spec) {
    const b = bossBase(id, d, spec, 50, 40);
    const K = d.cols;
    b.A = arenaOf(spec, room);
    b.gravity = noop; b.moveAndCollide = noop; b.collideTiles = false; b.ignoreOneWay = true;
    b.W = Math.max(60, b.A.x1 - b.A.x0 - 2 * INS); b.H = Math.max(60, b.A.floorY - b.A.ceilY - 2 * INS); b.per = 2 * (b.W + b.H);
    b.speed = 3.5; b.crawlSpeed = 3.5; b.puddleLife = 180; b.roarFrames = 90;
    b.path = new Float32Array(PATH_N * 3); b.pathI = 0; b.pathLen = 0; b.headD = 0; b.lastX = 0; b.lastY = 0;
    b.segX = new Float32Array(SEGS); b.segY = new Float32Array(SEGS); b.segA = new Float32Array(SEGS); b.segs = [];
    b.segOpts = [];
    for (let i = 0; i < SEGS; i++) { b.segs.push(null); b.segOpts.push({ parent: b, index: i, color: K.fins }); }
    b.spacing = 24; b.dir = 1; b.targetS = 0; b.free = false; b.hx = 0; b.hy = 0; b.ang = 0; b.plan = '';
    b.lungeY = 0; b.lungeDir = 1; b.lungeMax = 0; b.lunged = 0; b.lungeX0 = 0; b.droop = 0; b.jaw = 0; b.rear = 0;
    b.dripX = 0; b.marks = new Float32Array(10); b.dripI = 0; b.floodT = 0; b.floodOn = 0; b.sweepDir = 1; b.nAtk = 0; b.lastPlan = ''; b.ceilN = 0;
    b.hitBody = mkHit('heavy', 'sweep', 1, 1); b.hitBody.src = b;
    b.hitFlood = mkHit('contact', 'flood', 1, 1, true); b.hitFlood.src = b;   // the flood box (read by tests/debug); the damage goes through game.triggerHazard
    // the lowest row of one-way grates above the floor: the Flood's respawn ledges (row 16 in bv_corrosant)
    b.grates = []; b.grateRow = -1;
    for (let ry = Math.floor(b.A.floorY / TILE) - 1; ry > 0 && b.grateRow < 0; ry--) {
      for (let tx = 0; tx < room.w; tx++) {
        if (room.tiles[ry][tx] !== '-' || (tx > 0 && room.tiles[ry][tx - 1] === '-')) continue;
        let n = 1; while (tx + n < room.w && room.tiles[ry][tx + n] === '-') n++;
        b.grates.push(tx * TILE + 12, (tx + n) * TILE - 12); b.grateRow = ry;
      }
    }
    // start: nearest perimeter point to the spawn tile
    const scx = spec.spawn.x * TILE + 15, scy = spec.spawn.y * TILE + 15;
    b.s = nearestS(b, scx, scy);
    perPos(b, b.s, perOut); b.hx = perOut.x; b.hy = perOut.y; b.lastX = b.hx; b.lastY = b.hy;
    for (let k = 220; k >= 0; k -= 2) { perPos(b, b.s - k, perOut); pushPath(b, perOut.x, perOut.y); }
    corroPlaceHead(b);
    // head rig (local: +x forward)
    const r = b.rigHead = [];
    b.jawS = shape('poly', K.acid); b.jawS.x = -22; b.jawS.y = 6; b.jawS.pts = [0, -2, 40, 0, 0, 14]; r.push(b.jawS);
    const head = shape('poly', K.head); head.pts = [25, 0, -25, -20, -25, 20]; r.push(head); b.headS = head;
    b.throat = shape('dot', K.acid); b.throat.x = -12; b.throat.y = 2; b.throat.r = 6; b.throat.glow = true; r.push(b.throat);
    b.eyes = [];
    for (let i = 0; i < 4; i++) { const ey = shape('dot', K.fins); ey.x = -10 + i * 6; ey.y = -9; ey.r = 2; ey.ink = false; ey.glow = i === 1; b.eyes.push(ey); r.push(ey); }
    // body rig (world space)
    const rb = b.rigBody = [];
    b.segS = []; b.finS = [];
    for (let i = SEGS - 1; i >= 0; i--) {
      const sg = shape('rrect', K.seg); sg.w = 30; sg.h = 30; sg.r = 8; b.segS[i] = sg; rb.push(sg);
      const fn = shape('wedge', K.fins); fn.len = 12; fn.wid = 14; b.finS[i] = fn; rb.push(fn);
    }
    b.onIntro = function () { this.state = 'roarIntro'; this.attack = ''; };
    b.onFightStart = function (game) { this.active = true; corroEnsureSegs(this, game); corroChoose(this, game); };
    b.onEnrage = function () { this.speed = 4.5; this.tellCut = 8; this.puddleLife = 240; this.floodT = 0; };
    b.update = corroUpdate; b.draw = corroDraw; b.dmgMult = function () { return 1.5; };
    return b;
  }
  function perPos(b, s, out) {
    s = s % b.per; if (s < 0) s += b.per;
    const x0 = b.A.x0 + INS, y0 = b.A.ceilY + INS, W = b.W, H = b.H;
    if (s < W) { out.x = x0 + s; out.y = y0; out.surf = 0; out.nx = 0; out.ny = 1; }
    else if (s < W + H) { out.x = x0 + W; out.y = y0 + (s - W); out.surf = 1; out.nx = -1; out.ny = 0; }
    else if (s < 2 * W + H) { out.x = x0 + W - (s - W - H); out.y = y0 + H; out.surf = 2; out.nx = 0; out.ny = -1; }
    else { out.x = x0; out.y = y0 + H - (s - 2 * W - H); out.surf = 3; out.nx = 1; out.ny = 0; }
    return out;
  }
  function nearestS(b, x, y) {
    const x0 = b.A.x0 + INS, y0 = b.A.ceilY + INS, W = b.W, H = b.H;
    const u = U.clamp(x - x0, 0, W), v = U.clamp(y - y0, 0, H);
    const dTop = v, dRight = W - u, dBot = H - v, dLeft = u;
    const m = Math.min(dTop, dRight, dBot, dLeft);
    if (m === dTop) return u;
    if (m === dRight) return W + v;
    if (m === dBot) return 2 * W + H - u;
    return 2 * W + 2 * H - v;
  }
  function surfOf(b, s) { s = s % b.per; if (s < 0) s += b.per; return s < b.W ? 0 : (s < b.W + b.H ? 1 : (s < 2 * b.W + b.H ? 2 : 3)); }
  function pushPath(b, x, y) {
    const dx = x - b.lastX, dy = y - b.lastY;
    b.headD += Math.sqrt(dx * dx + dy * dy); b.lastX = x; b.lastY = y;
    const i = b.pathI * 3; b.path[i] = x; b.path[i + 1] = y; b.path[i + 2] = b.headD;
    b.pathI = (b.pathI + 1) % PATH_N; if (b.pathLen < PATH_N) b.pathLen++;
  }
  /** Position `back` px behind the head along its recorded path (linear between samples). */
  function pathAt(b, back, out) {
    const target = b.headD - back, p = b.path;
    let i = (b.pathI - 1 + PATH_N) % PATH_N, n = 0;
    let nx = p[i * 3], ny = p[i * 3 + 1], nd = p[i * 3 + 2];
    while (n < b.pathLen - 1) {
      const j = (i - 1 + PATH_N) % PATH_N;
      const jd = p[j * 3 + 2];
      if (jd <= target) {
        const span = nd - jd, k = span > 0.0001 ? (target - jd) / span : 0;
        out.x = p[j * 3] + (nx - p[j * 3]) * k; out.y = p[j * 3 + 1] + (ny - p[j * 3 + 1]) * k;
        return out;
      }
      i = j; nx = p[i * 3]; ny = p[i * 3 + 1]; nd = jd; n++;
    }
    out.x = nx; out.y = ny; return out;
  }
  function corroPlaceHead(b) {
    b.x = b.hx; b.y = b.hy + 20;
    for (let i = 0; i < SEGS; i++) {
      pathAt(b, b.spacing * (i + 1), pathOut); b.segX[i] = pathOut.x; b.segY[i] = pathOut.y;
      pathAt(b, b.spacing * (i + 1) - 6, pathOut);
      b.segA[i] = Math.atan2(pathOut.y - b.segY[i], pathOut.x - b.segX[i]);
      const sg = b.segs[i]; if (sg && !sg.dead) { sg.x = b.segX[i]; sg.y = b.segY[i] + 15; }
    }
    pathAt(b, 8, pathOut); b.ang = Math.atan2(b.hy - pathOut.y, b.hx - pathOut.x);
  }
  function corroEnsureSegs(b, game) {
    const tx = Math.floor(b.hx / TILE), ty = Math.floor(b.hy / TILE);
    for (let i = 0; i < SEGS; i++) {
      const sg = b.segs[i];
      if (sg && !sg.dead) continue;
      const e = game.spawnEnemy('bossSegment', tx, ty, b.segOpts[i]);
      if (e) { e.x = b.segX[i]; e.y = b.segY[i] + 15; e.px = e.x; e.py = e.y; }
      b.segs[i] = e;
    }
  }
  /** Decide the next attack from the current surface and crawl to its start (DESIGN §8.3 pattern). */
  function corroChoose(b, game) {
    const surf = surfOf(b, b.s), r = game.rng(), pl = game.player, A = b.A;
    b.state = 'crawl'; b.attack = ''; b.contact = 1; b.spacing = 24; b.nAtk++;
    // DESIGN §8.3 weights per surface, plus "never the same attack twice in a row" so every attack shows
    if (surf === 1 || surf === 3) {
      let plan = r < 0.5 ? 'lunge' : (r < 0.75 ? 'ceil' : 'sweep');
      if (plan === b.lastPlan) plan = plan === 'lunge' ? 'ceil' : 'lunge';
      b.plan = plan;
      if (plan === 'lunge') b.targetS = b.s;
      else if (plan === 'ceil') b.targetS = surf === 1 ? b.W - 90 : 90;
      else b.targetS = surf === 1 ? b.W + b.H + 30 : 2 * b.W + b.H - 30;
    } else if (surf === 0) {
      let plan = r < 0.5 ? 'spit' : 'drip';
      if (plan === b.lastPlan) plan = plan === 'spit' ? 'drip' : 'spit';
      if (b.lastPlan === 'spit' || b.lastPlan === 'drip') { if (b.ceilN++ >= 1) plan = 'wall'; } else b.ceilN = 0;
      b.plan = plan;
      if (plan === 'spit') b.targetS = U.clamp((pl ? pl.x : A.cx) - (A.x0 + INS), 40, b.W - 40);
      else if (plan === 'drip') b.targetS = U.clamp((pl ? pl.x : A.cx) - (A.x0 + INS), 90, b.W - 90);
      else { const u = b.s; b.targetS = u > b.W / 2 ? b.W + b.H * 0.5 : 2 * b.W + b.H + b.H * 0.5; }
    } else {
      const u = b.s - (b.W + b.H);
      if (r < 0.5 || b.nAtk < 2 || b.lastPlan === 'sweep') { b.plan = 'wall'; b.targetS = u < b.W / 2 ? b.W + b.H * 0.5 : 2 * b.W + b.H + b.H * 0.5; }
      else { b.plan = 'sweep'; b.targetS = u < b.W / 2 ? b.W + b.H + 30 : 2 * b.W + b.H - 30; }
    }
    if (b.plan === 'lunge' || b.plan === 'spit' || b.plan === 'drip' || b.plan === 'sweep') b.lastPlan = b.plan;
    let dd = (b.targetS - b.s) % b.per; if (dd < 0) dd += b.per;
    b.dir = dd <= b.per / 2 ? 1 : -1;
    const dist = dd <= b.per / 2 ? dd : b.per - dd;
    b.crawlSpeed = Math.max(b.speed, dist / 90);
    if (b.plan === 'ceil' || b.plan === 'wall') b.plan = 'again';   // on arrival choose again from the new surface
  }
  function corroTell(b, game) {
    const pl = game.player, A = b.A;
    b.state = 'tell'; b.attack = b.plan;
    if (b.plan === 'lunge') {
      b.timer = tellOf(b, 30);
      const py = pl ? pl.cy() + (game.rng() - 0.5) * 60 : b.hy;
      b.lungeY = U.clamp(py, A.ceilY + INS, A.floorY - INS);
      b.lungeDir = surfOf(b, b.s) === 3 ? 1 : -1;
    } else if (b.plan === 'spit') b.timer = tellOf(b, 24);
    else if (b.plan === 'drip') {
      b.timer = tellOf(b, 36); b.dripX = b.hx;
      for (let i = 0; i < 10; i++) b.marks[i] = b.dripX - 90 + game.rng() * 180;
    } else if (b.plan === 'sweep') { b.timer = tellOf(b, 40); b.sweepDir = (b.s - (b.W + b.H)) < b.W / 2 ? -1 : 1; }   // u small = right end → sweep left
  }
  function corroUpdate(game, player) {
    const b = this, A = b.A, K = b.data.cols; b.t++;
    if (b.flash > 0) b.flash--; if (b.coreBright > 0) b.coreBright--;
    if ((b.t & 31) === 0) corroEnsureSegs(b, game);
    if (b.roar > 0) { b.jaw = 0.6; if (--b.roar === 0) corroChoose(b, game); corroPlaceHead(b); return; }
    // Flood (enraged): every 420 f the floor row is acid for 120 f
    if (b.enraged) {
      if (b.floodOn > 0) {
        b.floodOn--;
        const k = Math.min(1, (120 - b.floodOn) / 20), fh = b.hitFlood;
        fh.x = A.x0; fh.y = A.floorY - 30 * k; fh.w = A.x1 - A.x0; fh.h = 30 * k;
        if (k > 0 && player && E.overlapBox(player, fh.x, fh.y, fh.w, fh.h)) corroFloodHit(b, game, player);
      } else if (++b.floodT >= 420) { b.floodT = 0; b.floodOn = 120; FX.shake(5, 20); Au.sfx('bossPhase', b.x); }
    }
    b.jaw = U.approach(b.jaw, 0, 0.05); b.rear = U.approach(b.rear, 0, 2);
    switch (b.state) {
      case 'crawl': {
        let dd = (b.targetS - b.s) % b.per; if (dd < 0) dd += b.per;
        const dist = dd <= b.per / 2 ? dd : b.per - dd;
        if (dist <= b.crawlSpeed) { b.s = b.targetS; if (b.plan === 'again') corroChoose(b, game); else corroTell(b, game); }
        else b.s += b.dir * b.crawlSpeed;
        perPos(b, b.s, perOut); b.hx = perOut.x; b.hy = perOut.y + b.droop;
        break;
      }
      case 'tell':
        if (b.plan === 'lunge') {
          // slide along the wall to the lunge height, rear back
          const wallS = surfOf(b, b.s) === 1 ? b.W + (b.lungeY - A.ceilY - INS) : 2 * b.W + 2 * b.H - (b.lungeY - A.ceilY - INS);
          b.s = U.approach(b.s, wallS, 6); perPos(b, b.s, perOut); b.hx = perOut.x; b.hy = perOut.y;
          b.rear = 20 * (1 - b.timer / 30); b.jaw = 0.6;
          if ((b.timer % 10) === 0) { const s = makeShot(game, 'drip', b.hx + perOut.nx * 10, b.hy + 20, 0, 5, K.acid); if (s) { s.src = b; s.life = 40; s.noHit = true; } }
        } else if (b.plan === 'drip') {
          b.s = U.approach(b.s, b.targetS, b.speed); perPos(b, b.s, perOut); b.hx = perOut.x + Math.sin(b.t * 1.5) * 2; b.hy = perOut.y;
        }
        if (--b.timer <= 0) corroActive(b, game);
        break;
      case 'lunge':
        b.hx += b.lungeDir * 10; b.lunged += 10; b.contact = 2; b.jaw = 0.5;
        if (b.lunged >= b.lungeMax) { b.state = 'retract'; b.timer = 40; b.contact = 1; }
        break;
      case 'retract':
        b.hx -= b.lungeDir * (b.lungeMax / 40);
        if (--b.timer <= 0) { b.hx = b.lungeX0; perPos(b, b.s, perOut); b.hy = perOut.y; corroChoose(b, game); }
        break;
      case 'dripping':
        b.timer++;
        if (b.timer % 6 === 0 && b.dripI < 10) { const s = makeShot(game, 'drip', b.marks[b.dripI++], b.hy + 20, 0, 6, K.acid); if (s) s.src = b; }
        if (b.timer >= 60) { b.state = 'recover'; b.timer = 40; }
        break;
      case 'sweep': {
        b.s += b.sweepDir * -5;   // floor runs right→left as s increases; sweepDir +1 = toward the right end
        perPos(b, b.s, perOut); b.hx = perOut.x; b.hy = perOut.y; b.spacing = 24;
        let lo = b.hx, hi = b.hx;
        for (let i = 0; i < SEGS; i++) { if (b.segX[i] < lo) lo = b.segX[i]; if (b.segX[i] > hi) hi = b.segX[i]; }
        regBox(game, b.hitBody, lo - 15, A.floorY - 30, hi - lo + 30, 30, b.sweepDir);
        const endS = b.sweepDir > 0 ? b.W + b.H + 30 : 2 * b.W + b.H - 30;
        if ((b.sweepDir > 0 && b.s <= endS) || (b.sweepDir < 0 && b.s >= endS)) { b.s = endS; b.state = 'recover'; b.timer = 50; }
        break;
      }
      case 'recover':
        if (b.plan === 'drip') b.droop = U.approach(b.droop, b.timer > 10 ? 60 : 0, 6);
        perPos(b, b.s, perOut); b.hx = perOut.x; b.hy = perOut.y + b.droop;
        if (--b.timer <= 0) { b.droop = 0; corroChoose(b, game); }
        break;
      default:
        perPos(b, b.s, perOut); b.hx = perOut.x; b.hy = perOut.y;
    }
    pushPath(b, b.hx, b.hy);
    corroPlaceHead(b);
    if ((b.t % 20) === 0) { FX.burst('dust', b.segX[2], b.segY[2] + 14, 1, DUST_N); }
  }
  /** Flood contact: the engine's hazard path with the nearest grate of the lowest grate row as the respawn. */
  function corroFloodHit(b, game, player) {
    let gx = player.x, gy = b.A.floorY, best = 1e9;
    for (let i = 0; i < b.grates.length; i += 2) {
      const x0 = b.grates[i], x1 = b.grates[i + 1], cx = U.clamp(player.x, x0, x1), d = Math.abs(cx - player.x);
      if (d < best) { best = d; gx = cx; gy = b.grateRow * TILE; }
    }
    game.triggerHazard('acid', gx, gy);
  }
  function corroActive(b, game) {
    const A = b.A, K = b.data.cols;
    if (b.plan === 'lunge') {
      b.lungeX0 = b.hx; b.lunged = 0; b.rear = 0;
      const room = b.lungeDir > 0 ? (A.x1 - INS) - b.hx : b.hx - (A.x0 + INS);
      b.lungeMax = Math.min(14 * TILE, Math.max(60, room - 10));
      b.state = 'lunge'; Au.sfx('whiff', b.x);
    } else if (b.plan === 'spit') {
      for (let i = -1; i <= 1; i++) {
        const s = makeShot(game, 'glob', b.hx, b.hy + 20, i * 3, 2, K.acid);
        if (s) { s.src = b; s.acid = true; s.puddleW = 60; s.puddleLife = b.puddleLife; s.grav = 0.2; }
      }
      Au.sfx('turretShot', b.x);
      b.state = 'recover'; b.timer = 30;
    } else if (b.plan === 'drip') { b.state = 'dripping'; b.timer = 0; b.dripI = 0; }
    else { b.state = 'sweep'; b.hitBody.hitList.length = 0; b.spacing = 24; Au.sfx('whiff', b.x); }
  }
  function corroDraw(ctx, game, alpha) {
    const b = this, t = b.t, st = b.state, K = b.data.cols, A = b.A;
    const dying = b.dead;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // flood / telegraphs in world space
    if (b.enraged && b.floodOn > 0) {
      const k = Math.min(1, (120 - b.floodOn) / 20) * (b.floodOn < 15 ? b.floodOn / 15 : 1);
      ctx.fillStyle = K.acid; ctx.globalAlpha = 0.75;
      ctx.beginPath(); ctx.moveTo(A.x0, A.floorY);
      for (let px = A.x0; px <= A.x1; px += 20) ctx.lineTo(px, A.floorY - 30 * k + Math.sin(px / 25 + t / 6) * 3);
      ctx.lineTo(A.x1, A.floorY); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (st === 'tell' && b.plan === 'drip') {
      ctx.fillStyle = K.acid; ctx.globalAlpha = 0.5 + 0.3 * Math.cos(t * TAU / 8);
      for (let i = 0; i < 10; i++) { if (((t >> 2) + i) & 1) continue; ctx.beginPath(); ctx.ellipse(b.marks[i], A.ceilY + 40, 3, 6, 0, 0, TAU); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    if (st === 'tell' && b.plan === 'sweep') {
      ctx.strokeStyle = K.fins; ctx.lineWidth = 2; ctx.globalAlpha = 0.4 + 0.3 * Math.cos(t * TAU / 8); setDash(ctx, true);
      ctx.beginPath(); ctx.moveTo(A.x0, A.floorY - 15); ctx.lineTo(A.x1, A.floorY - 15); ctx.stroke(); setDash(ctx, false); ctx.globalAlpha = 1;
    }
    // body segments (tail first)
    const acx = A.cx, acy = (A.ceilY + A.floorY) / 2;
    for (let i = SEGS - 1; i >= 0; i--) {
      const sg = b.segS[i], fn = b.finS[i];
      let sx = b.segX[i], sy = b.segY[i], on = true, sc = 1;
      if (dying) { const t0 = (SEGS - 1 - i) * 12; if (t > t0) { sc = Math.max(0, 1 - (t - t0) / 18); if (sc <= 0.05) on = false; } }
      sg.on = on; fn.on = on;
      sg.x = sx; sg.y = sy; sg.w = 30 * sc; sg.h = 30 * sc; sg.rot = b.segA[i];
      const nx = -Math.sin(b.segA[i]), ny = Math.cos(b.segA[i]);
      const side = (nx * (acx - sx) + ny * (acy - sy)) >= 0 ? 1 : -1;
      fn.x = sx + nx * side * 13 * sc; fn.y = sy + ny * side * 13 * sc; fn.ang = Math.atan2(ny * side, nx * side); fn.len = 12 * sc; fn.wid = 14 * sc;
    }
    let segFlash = b.flash > 0;
    for (let i = 0; i < SEGS; i++) { const seg = b.segs[i]; if (seg && seg.flash > 0) segFlash = true; }
    drawRig(ctx, b.rigBody, segFlash, false, b.accent, t);
    // head
    const hx = U.lerp(b.px, b.x, alpha), hy = U.lerp(b.py, b.y, alpha) - 20;
    perPos(b, b.s, perOut);
    // mirror the head so the jaw (local +y) opens into the arena, whatever surface it crawls on
    const lyWorld = -Math.sin(b.ang), lyWorldY = Math.cos(b.ang);
    const flip = (lyWorld * perOut.nx + lyWorldY * perOut.ny) < 0 ? -1 : 1;
    b.jawS.rot = b.jaw;
    b.throat.tell = st === 'tell' && b.plan === 'spit';
    b.headS.tell = st === 'tell' && (b.plan === 'lunge' || b.plan === 'sweep');
    b.jawS.tell = st === 'tell' && b.plan === 'lunge';
    let ha = 1, hsc = 1;
    if (dying) { const k = Math.max(0, (t - 84) / 36); ha = 1 - k; hsc = 1 - 0.5 * k; }
    ctx.save();
    ctx.translate(hx - Math.cos(b.ang) * b.rear, hy - Math.sin(b.ang) * b.rear); ctx.rotate(b.ang); ctx.scale(hsc, hsc * flip); ctx.globalAlpha = ha;
    drawRig(ctx, b.rigHead, b.flash > 0, st === 'tell', b.accent, t);
    if (b.coreBright > 0 && !dying) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = b.coreBright / 10 * 0.5; ctx.fillStyle = K.fins; ctx.beginPath(); ctx.arc(-5, -8, 14, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.restore();
    if (dying && t > 84) { ctx.fillStyle = K.acid; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.ellipse(hx, hy + 20, 30 + (t - 84) * 2, 6, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ==========================================================================================
  // 8.4 KERNAUTH — The Root Process (final boss, 2 phases)
  // ==========================================================================================
  const KER_NAME = ['', 'cableSweep', 'rootSpikes', 'orbitalFlare', 'summon'];
  const KER_CYCLE = ['dive', 'beam', 'frag', 'blink', 'beam'];
  function createKernauth(id, d, room, game, spec) {
    const b = bossBase(id, d, spec, 150, 180);
    const K = d.cols;
    b.A = arenaOf(spec, room);
    b.enrageHp = 0;   // phase 1 has no enrage; Panic Loop is phase 2's (≤ 60)
    b.last1 = 0; b.atk = 0; b.motes = 0; b.moteOpts = { parent: b, color: K.core };
    b.cableSide = 1; b.cableTip = 0; b.spots = new Float32Array(5); b.coreDark = 0;
    b.hitCable = mkHit('heavy', 'cable', 1, 0); b.hitCable.src = b;
    b.hitSpikes = [];
    for (let i = 0; i < 5; i++) { const h = mkHit('heavy', 'spike', 1, 1); h.src = b; b.hitSpikes.push(h); }
    // phase 2 fields
    b.cyc = 0; b.atk2 = ''; b.speed = 4; b.hoverGap = 40; b.tailLen = 100; b.lockX = 0; b.lockY = 0; b.beamY = 0; b.beamN = 0; b.crownRot = 0;
    b.tail = new Float32Array(64); b.tailI = 0; b.transT = 0; b.coreY = 0; b.hitShock = mkHit('heavy', 'shock', 2, 1); b.hitShock.src = b;
    b.hitBeam = mkHit('contact', 'beam', 1, 1, true); b.hitBeam.src = b;
    b.hitTail = []; for (let i = 0; i < 6; i++) { const h = mkHit('contact', 'tail', 1, 0, true); h.src = b; b.hitTail.push(h); }
    b.tailX = new Float32Array(6); b.tailY = new Float32Array(6);
    // phase-1 rig (local: body centre; feet +90)
    const r = b.rig1 = [];
    b.cableL = shape('limb', K.cables); b.cableL.lw = 12; r.push(b.cableL);
    b.cableR = shape('limb', K.cables); b.cableR.lw = 12; r.push(b.cableR);
    b.knots = [];
    for (let i = 0; i < 6; i++) { const kn = shape('dot', K.cables); kn.r = 6; b.knots.push(kn); r.push(kn); }
    b.mass = shape('poly', K.mass); b.mass.pts = [-72, 90, -78, 30, -62, -60, -40, -88, 45, -90, 62, -62, 78, 30, 72, 90]; r.push(b.mass);
    b.lattice = [];
    for (let i = 0; i < 5; i++) { const ln = shape('line', K.crown); ln.lw = 1; ln.ink = false; ln.alpha = 0.5; ln.x0 = -60 + i * 6; ln.y0 = -50 + i * 28; ln.x1 = 60 - i * 4; ln.y1 = -40 + i * 28; b.lattice.push(ln); r.push(ln); }
    b.crown = [];
    for (let i = 0; i < 7; i++) { const w = shape('wedge', K.crown); w.x = -45 + i * 15; w.y = -88; w.ang = -PI / 2; w.len = i === 3 ? 28 : 20; w.wid = 11; b.crown.push(w); r.push(w); }
    b.core = shape('dot', K.core); b.core.x = 0; b.core.y = -30; b.core.r = 30; b.core.glow = true; r.push(b.core);
    b.star = shape('poly', K.mass); b.star.pts = new Array(20); b.star.ink = false; b.star.x = 0; b.star.y = -30; r.push(b.star);
    b.hot = shape('dot', K.hot); b.hot.x = 0; b.hot.y = -30; b.hot.r = 6; b.hot.ink = false; r.push(b.hot);
    // phase-2 rig (local: core centre)
    const r2 = b.rig2 = [];
    b.tailS = [];
    for (let i = 5; i >= 0; i--) { const td = shape('dot', K.cables); td.r = 10 - i; td.alpha = 0.9 - i * 0.12; b.tailS[i] = td; r2.push(td); }
    b.core2 = shape('dot', K.core); b.core2.r = 35; b.core2.glow = true; r2.push(b.core2);
    b.star2 = shape('poly', K.mass); b.star2.pts = new Array(20); b.star2.ink = false; r2.push(b.star2);
    b.hot2 = shape('dot', K.hot); b.hot2.r = 14; b.hot2.ink = false; r2.push(b.hot2);
    b.spikes2 = [];
    for (let i = 0; i < 5; i++) { const w = shape('wedge', K.crown); w.len = 18; w.wid = 12; b.spikes2.push(w); r2.push(w); }
    starPts(b.star.pts, 16, 7); starPts(b.star2.pts, 18, 8);
    b.onIntro = function () { this.state = 'roarIntro'; this.attack = ''; };
    b.onFightStart = function () { this.active = true; this.state = 'idle'; this.timer = 50; this.attack = ''; };
    b.nextPhase = kerNextPhase;
    b.onEnrage = function () { this.hoverGap = 0; this.tellCut = 8; this.speed = 5.5; this.tailLen = 160; };
    b.dmgMult = function (hit) {
      if (this.phase >= 2) return 1;
      // DESIGN §8.4: the chest core sits 120 px above the feet (rows 16–17); a hit box reaching that 60 px band of the
      // mass is a core hit (×1) — so every fighter's air box lands it from a plain jump's apex without touching the body.
      // Anything else on the mass (grounded lights at the base, the pogo on the crown) is ×0.5.
      const cy = this.y - 120;
      return U.aabb(hit.x, hit.y, hit.w, hit.h, this.x - this.w / 2, cy - 30, this.w, 60) ? 1 : 0.5;
    };
    b.update = kerUpdate; b.draw = kerDraw;
    return b;
  }
  function starPts(pts, ro, ri) {
    for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rr = (i & 1) ? ri : ro; pts[i * 2] = Math.cos(a) * rr; pts[i * 2 + 1] = Math.sin(a) * rr; }
  }
  /** Phase 1 spent (CONTRACT §6.2 multi-phase rule): refill, 180 f transition, UNBOUND card. */
  function kerNextPhase(game) {
    const b = this;
    if (b.phase >= 2) return false;
    b.phase = 2; b.maxHp = b.data.hp2; b.hp = b.maxHp; b.dead = false;
    b.state = 'transition'; b.timer = 180; b.transT = 0; b.attack = ''; b.contact = 0; b.vx = 0; b.vy = 0;
    b.coreY = b.y - 120; b.enrageHp = b.data.enrage;
    if (game.player) game.player.iframes = 180;
    if (game.hideProp) game.hideProp('throne');   // the throne collapses into the well: its props burst and are not redrawn
    if (UB.UI && UB.UI.bossCard) UB.UI.bossCard('KERNAUTH', 'UNBOUND', 60);
    Au.sfx('bossPhase', b.x); FX.shake(8, 40); FX.flash(WHITE, 0.4, 20);
    CHIP_O.color = b.data.cols.crown; FX.burst('chip', b.x, b.y - 40, 30, CHIP_O);
    return true;
  }
  function kerPick1(b, game, player) {
    const r = game.rng();
    let a = r < 0.35 ? 1 : (r < 0.65 ? 2 : (r < 0.85 ? 3 : 4));
    if (a === 4 && b.motes >= 4) a = 3;
    if (a === b.last1) a = a === 4 ? 1 : a + 1;
    if (a === 4 && b.motes >= 4) a = 1;
    b.last1 = a; b.atk = a; b.attack = KER_NAME[a]; b.state = 'tell';
    if (a === 1) { b.timer = 30; const ps = player.x < b.x ? -1 : 1; b.cableSide = game.rng() < 0.75 ? ps : -ps; b.cableTip = b.x + b.cableSide * 75; }
    else if (a === 2) {
      b.timer = 40;
      const A = b.A, c0 = Math.floor(A.x0 / TILE) + 1, c1 = Math.floor(A.x1 / TILE) - 2;
      b.spots[0] = U.clamp(Math.floor(player.x / TILE), c0, c1) * TILE + 15;
      let n = 1;
      for (let tries = 0; tries < 60 && n < 5; tries++) {
        const c = c0 + Math.floor(game.rng() * (c1 - c0 + 1)), px = c * TILE + 15;
        let ok = Math.abs(px - b.x) > 90;
        for (let i = 0; i < n && ok; i++) if (Math.abs(b.spots[i] - px) < 3 * TILE) ok = false;
        if (ok) b.spots[n++] = px;
      }
      while (n < 5) { b.spots[n] = b.spots[n - 1] + 3 * TILE; n++; }
    } else if (a === 3) b.timer = 30;
    else { b.timer = 30; b.coreDark = 30; }
  }
  function kerActive1(b, game, player) {
    const A = b.A, K = b.data.cols;
    switch (b.atk) {
      case 1: b.state = 'cableOut'; b.hitCable.hitList.length = 0; Au.sfx('whiff', b.x); break;
      case 2:
        b.state = 'spikes'; b.timer = 30; FX.shake(5, 10); Au.sfx('heavyHit', b.x);
        for (let i = 0; i < 5; i++) { b.hitSpikes[i].hitList.length = 0; FX.burst('dust', b.spots[i], A.floorY, 3, DUST_N); }
        break;
      case 3:
        for (let i = 0; i < 3; i++) {
          const s = makeShot(game, 'orb', b.x + (i - 1) * 26, b.y - 180, 0, 0, K.core);
          if (s) { s.src = b; s.ang = Math.atan2(player.cy() - s.cy(), player.x - s.x) + (i - 1) * 0.5; }
        }
        Au.sfx('bolt', b.x);
        b.state = 'recover'; b.timer = 30; break;
      case 4: {
        const tx = Math.floor(b.x / TILE), ty = Math.floor((b.y - 1) / TILE);
        for (let i = 0; i < 2 && b.motes < 4; i++) {
          const m = game.spawnEnemy('mote', tx, ty, b.moteOpts);
          if (m) { m.x = b.x + (i ? 20 : -20); m.y = b.y - 190; m.px = m.x; m.py = m.y; m.vy = -3; m.launch = 10; b.motes++; }
        }
        b.state = 'recover'; b.timer = 20; break;
      }
    }
  }
  function kerHover(b, game) {
    b.state = b.hoverGap > 0 ? 'hover' : 'tell2';
    b.timer = b.hoverGap; b.attack = ''; b.contact = 1;
    b.atk2 = KER_CYCLE[b.cyc]; b.cyc = (b.cyc + 1) % 5;
    if (b.state === 'tell2') kerTell2(b, game);
  }
  function kerTell2(b, game) {
    const pl = game.player, A = b.A;
    b.state = 'tell2'; b.attack = b.atk2; b.beamN = 0;
    if (b.atk2 === 'dive') b.timer = tellOf(b, 30);
    else if (b.atk2 === 'beam') { b.timer = tellOf(b, 40); b.beamY = U.clamp(pl ? pl.cy() : rowC(10), Math.max(rowC(4), A.ceilY + 40), Math.min(rowC(19), A.floorY - 20)); b.lockX = pl && pl.x < A.cx ? A.x0 + 45 : A.x1 - 45; }
    else if (b.atk2 === 'frag') b.timer = tellOf(b, 24);
    else { b.state = 'blinkOut'; b.timer = 12; b.contact = 0; }
  }
  function kerActive2(b, game, player) {
    const A = b.A, K = b.data.cols;
    if (b.atk2 === 'dive') { b.lockX = player.x; b.lockY = Math.min(player.cy(), A.floorY - 35); b.state = 'dive'; b.contact = 1; Au.sfx('whiff', b.x); }
    else if (b.atk2 === 'beam') { b.state = 'beam'; b.timer = 40; b.hitBeam.hitList.length = 0; Au.sfx('bolt', b.x); FX.shake(3, 8); }
    else if (b.atk2 === 'frag') {
      const off = game.rng() * TAU;
      for (let i = 0; i < 8; i++) { const a = off + i * PI / 4; const s = makeShot(game, 'frag', b.x, b.y - 35 + 5, Math.cos(a) * 3.5, Math.sin(a) * 3.5, K.crown); if (s) s.src = b; }
      Au.sfx('bolt', b.x);
      b.state = 'recover2'; b.timer = 30;
    }
  }
  function kerUpdate(game, player) {
    const b = this, A = b.A, K = b.data.cols; b.t++;
    if (b.flash > 0) b.flash--; if (b.coreBright > 0) b.coreBright--; if (b.coreDark > 0) b.coreDark--;
    if (b.state === 'transition') {   // phase is already 2 here (set inside takeHit): 180 f split → the core rises to row 6
      b.vx = 0; b.transT++; b.coreY = U.lerp(b.y - 120, rowC(6), U.easeInOutQuad(Math.min(1, b.transT / 150)));
      if ((b.transT % 12) === 0) { CHIP_O.color = K.mass; FX.burst('chip', b.x + (game.rng() - 0.5) * 140, b.y - game.rng() * 160, 6, CHIP_O); FX.shake(3, 6); }
      if (--b.timer <= 0) {
        b.w = 70; b.h = 70; b.y = b.coreY + 35; b.px = b.x; b.py = b.y;
        b.collideTiles = false; b.ignoreOneWay = true; b.gravity = noop; b.moveAndCollide = flyMove;
        for (let i = 0; i < 32; i++) { b.tail[i * 2] = b.x; b.tail[i * 2 + 1] = b.coreY; }
        b.cyc = Math.floor(game.rng() * 5) % 5;
        kerHover(b, game);
      }
      return;
    }
    if (b.phase === 1) {
      b.vx = 0; b.facing = player.x < b.x ? -1 : 1;
      switch (b.state) {
        case 'idle': if (--b.timer <= 0) kerPick1(b, game, player); break;
        case 'tell': if (--b.timer <= 0) kerActive1(b, game, player); break;
        case 'cableOut': {
          b.cableTip += b.cableSide * 8;
          const wall = b.cableSide > 0 ? A.x1 - 10 : A.x0 + 10;
          if ((b.cableSide > 0 && b.cableTip >= wall) || (b.cableSide < 0 && b.cableTip <= wall)) { b.cableTip = wall; b.state = 'cableHold'; b.timer = 10; }
          kerCableHit(b, game);
          break;
        }
        case 'cableHold': kerCableHit(b, game); if (--b.timer <= 0) { b.state = 'cableIn'; b.timer = 20; } break;
        case 'cableIn': {
          const home = b.x + b.cableSide * 75;
          b.cableTip += (home - b.cableTip) / Math.max(1, b.timer);
          if (--b.timer <= 0) { b.cableTip = home; b.state = 'recover'; b.timer = 30; }
          break;
        }
        case 'spikes':
          for (let i = 0; i < 5; i++) regBox(game, b.hitSpikes[i], b.spots[i] - 15, A.floorY - 30, 30, 30, 1);
          if (--b.timer <= 0) { b.state = 'recover'; b.timer = 30; }
          break;
        case 'recover': if (--b.timer <= 0) { b.state = 'idle'; b.timer = 50; b.attack = ''; } break;
        default: break;
      }
      b.gravity(0.5, 12); b.moveAndCollide(game.level);
      return;
    }
    // ---------------- phase 2: Unbound ----------------
    if ((b.t & 1) === 0) { const tl = b.tail; b.tailI = (b.tailI + 1) & 31; tl[b.tailI * 2] = b.x; tl[b.tailI * 2 + 1] = b.y - 35; }
    b.crownRot += 2 * DEG * (b.state === 'blinkIn' ? 6 : 1);
    if (b.roar > 0) { b.vx = 0; b.vy = 0; if (--b.roar === 0) kerHover(b, game); kerTailHits(b, game); return; }
    const cy = b.y - 35;
    switch (b.state) {
      case 'hover':
        seek(b, player.x, rowC(6), b.speed); b.vx = U.clamp(b.vx, -2, 2); b.moveAndCollide(game.level);
        if (--b.timer <= 0) kerTell2(b, game);
        break;
      case 'tell2':
        if (b.atk2 === 'dive') { b.vx = 0; b.vy = -1; b.moveAndCollide(game.level); }
        else if (b.atk2 === 'beam') { seek(b, b.lockX, b.beamY, b.speed); b.moveAndCollide(game.level); }
        else { b.vx = 0; b.vy = 0; }
        if (--b.timer <= 0) kerActive2(b, game, player);
        break;
      case 'dive': {
        const arrived = seek(b, b.lockX, b.lockY, 13); b.moveAndCollide(game.level);
        if (arrived || b.y >= A.floorY - 0.5) {
          b.state = 'shock'; b.timer = 10; b.hitShock.hitList.length = 0; b.vx = 0; b.vy = 0;
          b.y = A.floorY; FX.shake(8, 14); FX.burst('dust', b.x, b.y, 10, DUST_N); Au.sfx('heavyHit', b.x);
          b.lockX = 120;   // shock width (DESIGN §8.4: 120×30, a player width wider than the 70 px body on each side)
          // the shock is registered on the landing frame itself: hits resolve before body contact, so the player at the
          // impact takes the 2-damage shock, never the 1-damage body touch
          regBox(game, b.hitShock, b.x - b.lockX / 2, A.floorY - 30, b.lockX, 30, b.facing);
        }
        break;
      }
      case 'shock':
        b.vx = 0; b.vy = 0;
        regBox(game, b.hitShock, b.x - b.lockX / 2, A.floorY - 30, b.lockX, 30, b.facing);
        if (--b.timer <= 0) { b.state = 'recover2'; b.timer = b.atk2 === 'blink' ? 45 : 50; }
        break;
      case 'beam':
        b.vx = 0; b.vy = 0;
        regBox(game, b.hitBeam, A.x0, b.beamY - 10, A.x1 - A.x0, 20, b.facing);
        if (--b.timer <= 0) {
          if (b.enraged && b.beamN === 0) { b.beamN = 1; b.state = 'retell2'; b.timer = 15; b.beamY = U.clamp(player.cy(), Math.max(rowC(4), A.ceilY + 40), Math.min(rowC(19), A.floorY - 20)); }
          else { b.state = 'recover2'; b.timer = 40; }
        }
        break;
      case 'retell2':
        seek(b, b.x, b.beamY, b.speed); b.moveAndCollide(game.level);
        if (--b.timer <= 0) { b.state = 'beamWait'; b.timer = 15; }
        break;
      case 'beamWait':
        b.vx = 0; b.vy = 0;
        if (--b.timer <= 0) { b.state = 'beam'; b.timer = 40; b.hitBeam.hitList.length = 0; Au.sfx('bolt', b.x); }
        break;
      case 'blinkOut':
        b.vx = 0; b.vy = 0;
        if (--b.timer <= 0) {
          b.x = U.clamp(player.x, A.x0 + 35, A.x1 - 35); b.y = Math.max(A.ceilY + 70, player.y - 150 - 35 + 35); b.px = b.x; b.py = b.y;
          b.state = 'blinkIn'; b.timer = tellOf(b, 20); b.contact = 1;
          for (let i = 0; i < 32; i++) { b.tail[i * 2] = b.x; b.tail[i * 2 + 1] = b.y - 35; }
          FX.burst('ring', b.x, b.y - 35, 1, RING40);
        }
        break;
      case 'blinkIn':
        b.vx = 0; b.vy = 0;
        if (--b.timer <= 0) { b.state = 'slam'; Au.sfx('whiff', b.x); }
        break;
      case 'slam':
        b.vx = 0; b.vy = 14; b.moveAndCollide(game.level);
        if (b.y >= A.floorY - 0.5) {
          b.state = 'shock'; b.timer = 10; b.hitShock.hitList.length = 0; b.lockX = 120; FX.shake(9, 16); FX.burst('dust', b.x, b.y, 12, DUST_N); Au.sfx('heavyHit', b.x);
          regBox(game, b.hitShock, b.x - b.lockX / 2, A.floorY - 30, b.lockX, 30, b.facing);   // the landing frame counts (as the Dive Bomb)
        }
        break;
      case 'recover2':
        if (b.atk2 === 'beam') { seek(b, b.x, rowC(8), 2); b.moveAndCollide(game.level); }
        else b.vx = b.vy = 0;
        if (--b.timer <= 0) kerHover(b, game);
        break;
      default: b.vx = 0; b.vy = 0;
    }
    kerTailHits(b, game);
  }
  function kerCableHit(b, game) {
    const A = b.A, x0 = Math.min(b.x + b.cableSide * 75, b.cableTip), x1 = Math.max(b.x + b.cableSide * 75, b.cableTip);
    regBox(game, b.hitCable, x0, A.floorY - 30, Math.max(10, x1 - x0), 30, b.cableSide);
  }
  /** Tail: six circles along the recent path (contact 1, paced by the player's i-frames). */
  function kerTailHits(b, game) {
    const n = 6, per = b.tailLen / 50;   // samples are 2 frames (~8 px) apart: 100 px → 2 samples per circle, 160 → 3
    for (let i = 0; i < n; i++) {
      const back = Math.round((i + 1) * per);
      const idx = (b.tailI - back + 64) & 31;
      b.tailX[i] = b.tail[idx * 2]; b.tailY[i] = b.tail[idx * 2 + 1];
      if (b.state !== 'blinkOut' && b.state !== 'transition') regBox(game, b.hitTail[i], b.tailX[i] - 8, b.tailY[i] - 8, 16, 16, b.facing);
    }
  }
  function kerDraw(ctx, game, alpha) {
    const b = this, t = b.t, st = b.state, K = b.data.cols, A = b.A;
    const x = U.lerp(b.px, b.x, alpha), y = U.lerp(b.py, b.y, alpha);
    const dying = b.dead;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (b.phase === 1) {
      // telegraphs in world space
      if (st === 'tell' && b.atk === 2) {
        ctx.fillStyle = K.core; ctx.globalAlpha = 0.4 + 0.3 * Math.cos(t * TAU / 8);
        for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(b.spots[i], A.floorY - 2, 14, 4, 0, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      } else if (st === 'spikes') {
        ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.fillStyle = K.crown;
        const k = b.timer > 24 ? (30 - b.timer) / 6 : (b.timer < 6 ? b.timer / 6 : 1);
        for (let i = 0; i < 5; i++) {
          const sx = b.spots[i];
          ctx.beginPath(); ctx.moveTo(sx - 14, A.floorY); ctx.lineTo(sx - 6, A.floorY - 30 * k); ctx.lineTo(sx, A.floorY - 12 * k); ctx.lineTo(sx + 6, A.floorY - 30 * k); ctx.lineTo(sx + 14, A.floorY); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      }
      const pulse = 1 + 0.1 * Math.sin(t * TAU / 60);
      b.core.r = 30 * pulse; b.hot.r = 6 + 2 * Math.sin(t * TAU / 60) + (b.coreBright > 0 ? 4 : 0);
      b.core.alpha = b.coreDark > 0 ? 0.5 : 1; b.hot.on = b.coreDark === 0;
      b.core.tell = st === 'tell' && b.atk === 4;
      // cables: resting on the floor, the active one extends to the tip
      const cx0 = 70, tipL = b.cableSide < 0 ? (b.cableTip - b.x) : -150, tipR = b.cableSide > 0 ? (b.cableTip - b.x) : 150;
      const sway = Math.sin(t / 30) * 6;
      b.cableL.x0 = -cx0; b.cableL.y0 = 40; b.cableL.x1 = tipL; b.cableL.y1 = 90; b.cableL.cx = (tipL - cx0) / 2 - 20; b.cableL.cy = 70 + sway;
      b.cableR.x0 = cx0; b.cableR.y0 = 40; b.cableR.x1 = tipR; b.cableR.y1 = 90; b.cableR.cx = (tipR + cx0) / 2 + 20; b.cableR.cy = 70 - sway;
      for (let i = 0; i < 3; i++) {
        const k = 0.3 + i * 0.3, l = b.cableL, rr = b.cableR;
        b.knots[i].x = (1 - k) * (1 - k) * l.x0 + 2 * (1 - k) * k * l.cx + k * k * l.x1; b.knots[i].y = (1 - k) * (1 - k) * l.y0 + 2 * (1 - k) * k * l.cy + k * k * l.y1;
        b.knots[i + 3].x = (1 - k) * (1 - k) * rr.x0 + 2 * (1 - k) * k * rr.cx + k * k * rr.x1; b.knots[i + 3].y = (1 - k) * (1 - k) * rr.y0 + 2 * (1 - k) * k * rr.cy + k * k * rr.y1;
      }
      const cableTell = st === 'tell' && b.atk === 1;
      b.cableL.tell = cableTell && b.cableSide < 0; b.cableR.tell = cableTell && b.cableSide > 0;
      const tw = cableTell ? Math.sin(t * 1.5) * 3 : 0;
      if (b.cableSide < 0) b.cableL.cy += tw; else b.cableR.cy += tw;
      for (let i = 0; i < 7; i++) { b.crown[i].tell = st === 'tell' && b.atk === 3; b.crown[i].len = (i === 3 ? 28 : 20) + (st === 'tell' && b.atk === 3 ? Math.sin(t / 3 + i) * 3 : 0); }
      let a = 1, sc = 1;
      if (st === 'transition') { const k = b.transT / 180; a = 1 - k * 0.9; sc = 1 - 0.25 * k; b.core.on = false; b.star.on = false; b.hot.on = false; }
      else { b.core.on = true; b.star.on = true; }
      ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); ctx.translate(0, -90); ctx.globalAlpha = a;
      if (st === 'transition') { ctx.translate(Math.sin(t) * 2, 0); }
      drawRig(ctx, b.rig1, b.flash > 0, st === 'tell', b.accent, t);
      ctx.restore();
      if (st === 'tell' && b.atk === 3) {
        ctx.fillStyle = K.core; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t / 2);
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + (i - 1) * 26, y - 185, 4 + 4 * (30 - b.timer) / 30, 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      if (st === 'transition') {
        // the crowned core rises free of the mass
        const cyw = b.coreY;
        ctx.save(); ctx.translate(x, cyw); drawCore2(ctx, b, t, 1, 0); ctx.restore();
      }
      ctx.restore();
      return;
    }
    // ---------------- phase 2 ----------------
    const cy = y - 35;
    if (st === 'tell2' && b.attack === 'dive' && game.player) {
      ctx.strokeStyle = K.core; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + 0.3 * Math.cos(t * TAU / 8); setDash(ctx, true);
      ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(game.player.x, game.player.cy()); ctx.stroke(); setDash(ctx, false); ctx.globalAlpha = 1;
    } else if ((st === 'tell2' || st === 'retell2' || st === 'beamWait') && (b.attack === 'beam')) {
      ctx.strokeStyle = K.core; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5 + 0.3 * Math.cos(t * TAU / 8);
      ctx.beginPath(); ctx.moveTo(A.x0, b.beamY); ctx.lineTo(A.x1, b.beamY); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (st === 'beam') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = K.core; ctx.globalAlpha = 0.5; ctx.fillRect(A.x0, b.beamY - 10, A.x1 - A.x0, 20);
      ctx.fillStyle = K.hot; ctx.globalAlpha = 0.8; ctx.fillRect(A.x0, b.beamY - 3 + Math.sin(t) * 2, A.x1 - A.x0, 6);
      ctx.restore();
    } else if (st === 'shock') {
      ctx.fillStyle = K.crown; ctx.globalAlpha = 0.7 * (b.timer / 10); ctx.fillRect(x - b.lockX / 2, A.floorY - 30, b.lockX, 30); ctx.globalAlpha = 1;
    }
    let a = 1, sc = 1;
    if (st === 'blinkOut') a = b.timer / 12;
    if (dying) { const k = Math.max(0, (t - 90) / 30); a = 1 - k; sc = 1 + k * 0.8; }
    // tail circles (world offsets)
    for (let i = 0; i < 6; i++) { const td = b.tailS[i]; td.x = b.tailX[i] - x; td.y = b.tailY[i] - cy; td.on = st !== 'blinkOut' && !dying; }
    ctx.save(); ctx.translate(x, cy); ctx.globalAlpha = a;
    drawCore2(ctx, b, t, sc, dying ? 1 : 0);
    ctx.restore();
    ctx.restore();
  }
  function drawCore2(ctx, b, t, sc, dyingK) {
    const st = b.state;
    const fold = st === 'tell2' && b.attack === 'frag' ? 1 - 0.6 * (1 - b.timer / 24) : 1;
    const rad = 46 * fold;
    for (let i = 0; i < 5; i++) { const w = b.spikes2[i]; const a = b.crownRot + i * TAU / 5; w.x = Math.cos(a) * rad; w.y = Math.sin(a) * rad; w.ang = a; w.tell = st === 'tell2' && b.attack === 'frag'; }
    b.core2.r = 35 * (1 + 0.06 * Math.sin(t * TAU / 60)) * sc; b.hot2.r = (14 + (b.coreBright > 0 ? 5 : 0)) * sc;
    b.core2.tell = st === 'tell2' && (b.attack === 'dive' || b.attack === 'beam');
    b.hot2.on = st !== 'recover2' || b.atk2 !== 'dive' || (t & 4) !== 0;
    drawRig(ctx, b.rig2, b.flash > 0, st === 'tell2' || st === 'blinkIn' || st === 'retell2', b.accent, t);
  }

  // ==========================================================================================
  // Factory
  // ==========================================================================================
  const CREATORS = { proto_warden: createWarden, tallock: createTallock, weftyr: createWeftyr, corrosant: createCorrosant, kernauth: createKernauth };

  UB.Bosses = {
    DATA: DATA,
    /** Create a boss entity for the room; null for unknown ids. `spec` defaults to room.boss. */
    create: function (bossId, room, game, spec) {
      const d = DATA[bossId], make = CREATORS[bossId];
      if (!d || !make) return null;
      const sp = spec || room.boss;
      if (!sp || !sp.spawn) return null;
      return make(bossId, d, room, game, sp);
    },
    /** Reward summary used by the engine's debug defeatBoss(): {ability, bits, sparks, final}. */
    rewardFor: function (bossId) {
      const d = DATA[bossId];
      return d ? { ability: d.ability, bits: d.bits, sparks: d.sparks, final: !!d.final } : { ability: null, bits: 0, sparks: 0, final: false };
    },
  };
})(window.UB);
