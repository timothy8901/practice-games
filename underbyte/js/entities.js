/*
 * UNDERBYTE — js/entities.js
 * Owner: ENGINE ARCHITECT (do not edit from other modules).
 * Contract: CONTRACT.md §3 (coordinates), §4.4 (UB.Entity), §7 (hits).
 * Design: DESIGN.md §3.0 (collision order, step-up, one-way), §3.3 (hazard boxes), §7.0.
 *
 * UB.Entity is the base "body" every moving thing uses: player, enemies,
 * bosses, pickups, projectiles. Position (x, y) is the BOTTOM-CENTRE of the
 * axis-aligned body box (w × h). +y is down. Velocity units are chosen per
 * entity: 'pxs' (px/second, fighters) or 'pxf' (px/frame, everything else);
 * `vmul` converts velocity to a per-frame displacement.
 *
 * Collision is swept per axis in ≤10 px substeps against the room's runtime
 * tile state (`level`, built by the engine): solids, crumble tiles that are
 * present, sealed exits, one-way platforms, moving platforms. Hazards never
 * block; UB.Entity.hazardAt reports them.
 */
'use strict';
(function (UB) {
  const TILE = 30;
  const MAX_STEP = 10;
  const SPIKE_INSET = 4, SPIKE_TOP = 6, SPIKE_H = 24;

  /**
   * @param {object} o  {x,y,w,h, units:'pxs'|'pxf', hp, kbResist, stepUp, bounce, collideTiles}
   */
  function Entity(o) {
    o = o || {};
    this.x = o.x || 0; this.y = o.y || 0;
    this.w = o.w || 20; this.h = o.h || 30;
    this.px = this.x; this.py = this.y;        // previous-frame position (render interpolation)
    this.vx = 0; this.vy = 0;
    this.units = o.units || 'pxf';
    this.vmul = this.units === 'pxs' ? 1 / 60 : 1;
    this.facing = 1;
    this.onGround = false; this.wasOnGround = false;
    this.hitWall = 0; this.hitCeiling = false;
    this.ground = null;                        // moving platform we stand on, or null
    this.groundTy = -1; this.groundTx0 = 0; this.groundTx1 = 0; // tile row/cols under the feet when tile-grounded
    this.stepUp = o.stepUp || 0;               // ledge forgiveness in px (fighters: 6)
    this.bounce = o.bounce || 0;               // vy *= -bounce on landing (pickups), 0 = stop
    this.bounces = 0;
    this.collideTiles = o.collideTiles !== false;
    this.noclip = false;
    this.ignoreOneWay = false;                 // flyers / projectiles pass through '-'
    this.dropThrough = 0;                      // frames left of ignoring '-' (Down+Jump)
    this.hp = o.hp !== undefined ? o.hp : 1; this.maxHp = this.hp;
    this.dead = false;
    this.flash = 0;                            // white hit flash frames
    this.iframes = 0;
    this.hitstun = 0;
    this.kbResist = o.kbResist !== undefined ? o.kbResist : 1;
    this.t = 0;                                // frames alive (animation clock)
  }
  /** Fill `out` with the top-left box {x,y,w,h}. */
  Entity.prototype.box = function (out) {
    out.x = this.x - this.w / 2; out.y = this.y - this.h; out.w = this.w; out.h = this.h; return out;
  };
  Entity.prototype.cx = function () { return this.x; };
  Entity.prototype.cy = function () { return this.y - this.h / 2; };
  Entity.prototype.left = function () { return this.x - this.w / 2; };
  Entity.prototype.right = function () { return this.x + this.w / 2; };
  Entity.prototype.top = function () { return this.y - this.h; };
  Entity.prototype.moveAndCollide = function (level) { return moveAndCollide(this, level); };
  /** Apply gravity in the entity's own units (g in px/s² for 'pxs', px/frame² for 'pxf'). */
  Entity.prototype.gravity = function (g, maxFall) {
    this.vy += this.units === 'pxs' ? g / 60 : g;
    if (this.vy > maxFall) this.vy = maxFall;
  };

  // --- runtime tile query ----------------------------------------------------------
  /**
   * Tile char at (tx,ty) honoring runtime state: vanished crumble tiles read
   * as '.', sealed boss exits read as '#', and the area beyond the map edge is
   * '#' except in the extension of an open exit opening (so bodies can leave).
   */
  function tileAt(level, tx, ty) {
    const room = level.room;
    if (tx < 0 || ty < 0 || tx >= room.w || ty >= room.h) {
      const op = level.openings;
      for (let i = 0; i < op.length; i++) {
        const o = op[i];
        if (o.sealed) continue;
        if (o.side === 'left' && tx < 0 && ty >= o.y && ty < o.y + o.h) return '.';
        if (o.side === 'right' && tx >= room.w && ty >= o.y && ty < o.y + o.h) return '.';
        if (o.side === 'top' && ty < 0 && tx >= o.x && tx < o.x + o.w) return '.';
        if (o.side === 'bottom' && ty >= room.h && tx >= o.x && tx < o.x + o.w) return '.';
      }
      return '#';
    }
    const idx = ty * room.w + tx;
    if (level.sealedMask[idx]) return '#';
    const ch = room.tiles[ty][tx];
    if (ch === 'c' && level.gone[idx]) return '.';
    return ch;
  }
  function solidAt(level, tx, ty) { const ch = tileAt(level, tx, ty); return ch === '#' || ch === 'c'; }

  // --- collision -------------------------------------------------------------------
  function landed(ent) {
    ent.onGround = true;
    const vyf = ent.vy * ent.vmul;
    if (vyf > 0) {
      if (ent.bounce > 0 && vyf > 0.6) { ent.vy = -ent.vy * ent.bounce; ent.bounces++; ent.onGround = false; }
      else ent.vy = 0;
    }
  }

  function moveX(ent, level, dx) {
    if (dx === 0) return;
    const dir = dx > 0 ? 1 : -1;
    const hw = ent.w / 2;
    let remaining = Math.abs(dx);
    while (remaining > 0) {
      const step = remaining > MAX_STEP ? MAX_STEP : remaining;
      remaining -= step;
      const nx = ent.x + step * dir;
      if (ent.noclip || !ent.collideTiles) { ent.x = nx; continue; }
      const lead = dir > 0 ? nx + hw : nx - hw;
      const col = dir > 0 ? Math.floor((lead - 0.001) / TILE) : Math.floor(lead / TILE);
      const ty0 = Math.floor((ent.y - ent.h) / TILE), ty1 = Math.floor((ent.y - 0.001) / TILE);
      let blocked = false, topRow = 1e9;
      for (let ty = ty0; ty <= ty1; ty++) {
        if (solidAt(level, col, ty)) { blocked = true; if (ty < topRow) topRow = ty; }
      }
      if (!blocked) { ent.x = nx; continue; }
      // Ledge forgiveness (DESIGN §3.0): only the feet row blocks, its top is ≤ stepUp above the feet,
      // and the body column above the step is free → lift onto it.
      // NOTE (CONTRACT §4.4): on tile-aligned geometry this can never fire — a grounded body's feet
      // sit exactly on a tile top, so any blocking tile in the feet row has its top ≥ 30 px above
      // the feet. It only helps when the feet are a few px above a tile edge, i.e. standing on a
      // moving platform that is within `stepUp` px of a tile top. It is kept because it is cheap
      // and harmless; level design must not rely on it.
      if (ent.stepUp > 0 && ent.wasOnGround && topRow === ty1) {
        const tileTop = topRow * TILE;
        if (ent.y - tileTop <= ent.stepUp + 0.001) {
          let free = true;
          const c0 = Math.floor((nx - hw) / TILE), c1 = Math.floor((nx + hw - 0.001) / TILE);
          const r0 = Math.floor((tileTop - ent.h) / TILE), r1 = Math.floor((tileTop - 0.001) / TILE);
          for (let ty = r0; ty <= r1 && free; ty++) for (let tx = c0; tx <= c1; tx++) if (solidAt(level, tx, ty)) { free = false; break; }
          if (free) { ent.y = tileTop; ent.x = nx; ent.onGround = true; continue; }
        }
      }
      ent.x = dir > 0 ? col * TILE - hw : (col + 1) * TILE + hw;
      ent.vx = 0; ent.hitWall = dir;
      return;
    }
  }

  function moveY(ent, level, dy, prevBottom) {
    const hw = ent.w / 2;
    const c0 = Math.floor((ent.x - hw) / TILE), c1 = Math.floor((ent.x + hw - 0.001) / TILE);
    if (ent.noclip || !ent.collideTiles) { ent.y += dy; return; }
    if (dy === 0) {
      // Support check while resting: feet exactly on a tile top count as grounded.
      const row = Math.floor((ent.y + 0.001) / TILE);
      if (ent.y === row * TILE) {
        for (let tx = c0; tx <= c1; tx++) {
          const ch = tileAt(level, tx, row);
          if (ch === '#' || ch === 'c' || (ch === '-' && !ent.ignoreOneWay && ent.dropThrough <= 0)) {
            ent.onGround = true; ent.groundTy = row; ent.groundTx0 = c0; ent.groundTx1 = c1; return;
          }
        }
      }
      return;
    }
    const dir = dy > 0 ? 1 : -1;
    let remaining = Math.abs(dy);
    while (remaining > 0) {
      const step = remaining > MAX_STEP ? MAX_STEP : remaining;
      remaining -= step;
      const ny = ent.y + step * dir;
      if (dir > 0) {
        const row = Math.floor((ny - 0.001) / TILE);
        let land = false;
        for (let tx = c0; tx <= c1; tx++) {
          const ch = tileAt(level, tx, row);
          if (ch === '#' || ch === 'c') { land = true; break; }
          if (ch === '-' && !ent.ignoreOneWay && ent.dropThrough <= 0 && prevBottom <= row * TILE + 0.001) { land = true; break; }
        }
        if (land) {
          ent.y = row * TILE; landed(ent);
          ent.groundTy = row; ent.groundTx0 = c0; ent.groundTx1 = c1;
          return;
        }
        ent.y = ny;
      } else {
        const row = Math.floor((ny - ent.h) / TILE);
        let hit = false;
        for (let tx = c0; tx <= c1; tx++) if (solidAt(level, tx, row)) { hit = true; break; }
        if (hit) { ent.y = (row + 1) * TILE + ent.h; ent.vy = 0; ent.hitCeiling = true; return; }
        ent.y = ny;
      }
    }
  }

  function platformCheck(ent, level, prevBottom) {
    if (ent.noclip || !ent.collideTiles || ent.ignoreOneWay || ent.dropThrough > 0) return;
    const ps = level.platforms;
    const hw = ent.w / 2;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (ent.x + hw <= p.x || ent.x - hw >= p.x + p.w) continue;
      const topPrev = p.y - p.dy;
      if (prevBottom <= topPrev + 0.5 && ent.y >= p.y - 0.001) {
        ent.y = p.y; landed(ent); ent.ground = p; ent.groundTy = -1;
        return;
      }
    }
  }

  /** Move by explicit deltas (px), resolving collisions; sets ground/wall flags. */
  function sweep(ent, level, dx, dy) {
    const prevBottom = ent.y;
    ent.wasOnGround = ent.onGround;
    ent.onGround = false; ent.hitWall = 0; ent.hitCeiling = false; ent.ground = null; ent.groundTy = -1;
    if (ent.dropThrough > 0) ent.dropThrough--;
    moveX(ent, level, dx);
    moveY(ent, level, dy, prevBottom);
    platformCheck(ent, level, prevBottom);
  }

  /** Integrate velocity (own units), add moving-platform carry, resolve. */
  function moveAndCollide(ent, level) {
    let dx = ent.vx * ent.vmul, dy = ent.vy * ent.vmul;
    const g = ent.ground;
    if (g && ent.onGround) { dx += g.dx; dy += g.dy; }
    sweep(ent, level, dx, dy);
  }

  // --- hazards -----------------------------------------------------------------------
  const hazardHit = { tx: 0, ty: 0, ch: '.', kind: null };
  function hazardBox(tx, ty, ch, out) {
    if (ch === '^') { out.x = tx * TILE + SPIKE_INSET; out.y = ty * TILE + SPIKE_TOP; out.w = TILE - 2 * SPIKE_INSET; out.h = SPIKE_H; }
    else if (ch === 'v') { out.x = tx * TILE + SPIKE_INSET; out.y = ty * TILE; out.w = TILE - 2 * SPIKE_INSET; out.h = SPIKE_H; }
    else { out.x = tx * TILE; out.y = ty * TILE; out.w = TILE; out.h = TILE; }
    return out;
  }
  const hb = { x: 0, y: 0, w: 0, h: 0 };
  /**
   * Hazard overlapping a top-left box. Returns null | 'spike' | 'pool'.
   * skipFloor: ignore '^' (active down-strike frames). Details in UB.Entity.lastHazard.
   */
  function hazardInBox(level, x, y, w, h, skipFloor) {
    const c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 0.001) / TILE);
    const r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = r0; ty <= r1; ty++) for (let tx = c0; tx <= c1; tx++) {
      const ch = tileAt(level, tx, ty);
      if (ch !== '^' && ch !== 'v' && ch !== '~') continue;
      if (ch === '^' && skipFloor) continue;
      hazardBox(tx, ty, ch, hb);
      if (UB.Util.aabb(x, y, w, h, hb.x, hb.y, hb.w, hb.h)) {
        hazardHit.tx = tx; hazardHit.ty = ty; hazardHit.ch = ch; hazardHit.kind = ch === '~' ? 'pool' : 'spike';
        return hazardHit.kind;
      }
    }
    return null;
  }
  function hazardAt(ent, level, skipFloor) {
    return hazardInBox(level, ent.x - ent.w / 2, ent.y - ent.h, ent.w, ent.h, skipFloor);
  }

  // --- overlap tests -----------------------------------------------------------------
  function overlap(a, b) {
    return a.x - a.w / 2 < b.x + b.w / 2 && a.x + a.w / 2 > b.x - b.w / 2 && a.y - a.h < b.y && a.y > b.y - b.h;
  }
  function overlapBox(ent, x, y, w, h) {
    return UB.Util.aabb(ent.x - ent.w / 2, ent.y - ent.h, ent.w, ent.h, x, y, w, h);
  }
  function overlapsSolid(level, x, y, w, h) {
    const c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 0.001) / TILE);
    const r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 0.001) / TILE);
    for (let ty = r0; ty <= r1; ty++) for (let tx = c0; tx <= c1; tx++) if (solidAt(level, tx, ty)) return true;
    return false;
  }

  // --- hits (CONTRACT.md §7) ----------------------------------------------------------
  /**
   * A hit descriptor. Attackers keep ONE per move, reset `hitList.length = 0`
   * when the move instance starts, fill x/y/w/h (world, top-left) every active
   * frame and call game.registerHit(hit).
   */
  function makeHit(owner) {
    return {
      owner: owner || 'player',   // 'player' | 'enemy' | 'boss'
      x: 0, y: 0, w: 0, h: 0,     // world-space top-left box (px)
      dmg: 1,
      kbx: 0, kby: 0,             // knockback in px/s (kbx along `facing`; kby +down)
      facing: 1,                  // attacker's facing (+1/-1)
      hitstop: 0,                 // world hitstop frames on connect
      hitList: [],                // victims already hit by this move instance
      multi: false,               // true = may hit the same victim every frame (multi-tick)
      noKbx: false,               // true = the victim's knockback is straight up, (0, kby) — DESIGN §3.3 acid puddles / stuck needles
      src: null,                  // the attacking entity (for pan/particles), may be null
      tag: '',                    // free label ('light1', 'slam', ...) for SFX/FX choice
      kind: 'light',              // 'light'|'heavy'|'special'|'ultimate'|'air'|'down'|'projectile'|'contact'
      energy: 0, meter: 0,        // player gains on connect (engine applies)
      flags: 0,                   // DESIGN §8.5 attack flags: 1 = unblockable, 2 = projectile
      shake: 0, shakeFrames: 0,   // optional screen shake on connect
      onHit: null,                // function(victim, result, game) — called once per connect
    };
  }
  /** World box of a body-local attack box (cx along facing, cy down, from the body centre). */
  function hitBoxWorld(ent, cx, cy, w, h, out) {
    out.x = ent.x + cx * ent.facing - w / 2;
    out.y = (ent.y - ent.h / 2) + cy - h / 2;
    out.w = w; out.h = h;
    return out;
  }
  const hitResult = { dmg: 0, killed: false, blocked: false };
  /**
   * Default damage application for enemies/bosses: hp, flash, hitstun and
   * knockback × kbResist (DESIGN §7.0). Returns a shared scratch result.
   */
  function applyHit(victim, hit) {
    hitResult.dmg = hit.dmg; hitResult.killed = false; hitResult.blocked = false;
    victim.hp -= hit.dmg;
    victim.flash = 4;
    if (victim.kbResist > 0) {
      victim.hitstun = 10 + hit.hitstop;
      const k = victim.kbResist * (victim.units === 'pxs' ? 1 : 1 / 60);
      victim.vx = hit.kbx * hit.facing * k;
      victim.vy = hit.kby * k;
    }
    if (victim.hp <= 0) { victim.hp = 0; victim.dead = true; hitResult.killed = true; }
    return hitResult;
  }

  UB.Entity = Entity;
  UB.Entity.TILE = TILE;
  UB.Entity.tileAt = tileAt;
  UB.Entity.solidAt = solidAt;
  UB.Entity.sweep = sweep;
  UB.Entity.moveAndCollide = moveAndCollide;
  UB.Entity.hazardAt = hazardAt;
  UB.Entity.hazardInBox = hazardInBox;
  UB.Entity.hazardBox = hazardBox;
  UB.Entity.lastHazard = hazardHit;
  UB.Entity.overlap = overlap;
  UB.Entity.overlapBox = overlapBox;
  UB.Entity.overlapsSolid = overlapsSolid;
  UB.Entity.makeHit = makeHit;
  UB.Entity.hitBoxWorld = hitBoxWorld;
  UB.Entity.applyHit = applyHit;
})(window.UB);
