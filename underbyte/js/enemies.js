/*
 * UNDERBYTE — js/enemies.js
 * Owner: ENEMIES implementer (this is a STUB with ONE placeholder walker by the engine architect).
 * Contract: CONTRACT.md §6 (enemy object + hooks). Design: DESIGN.md §7.
 *
 * UB.Enemies.create(type, spawn, room, game) → enemy entity (UB.Entity, units
 * 'pxf'). The engine calls enemy.update(game, player) each logic frame (not
 * during world hitstop), enemy.draw(ctx, game, alpha) each render, applies
 * damage from player hits with UB.Entity.applyHit (or enemy.takeHit if it
 * exists), and handles death: particles, drops from enemy.bits /
 * enemy.dropShard, stats, removal. Contact damage uses enemy.contact (hearts)
 * unless enemy.noContact is true. Enemy attacks (bites, shots) are registered
 * with game.registerHit(hit) where hit.owner === 'enemy'; projectiles go
 * through game.spawnProjectile(obj).
 *
 * Unknown types return null (the engine skips them with a single console.warn).
 */
'use strict';
(function (UB) {
  const E = UB.Entity, P = UB.Palette, U = UB.Util;
  const TILE = 30;

  // Placeholder roster. The ENEMIES implementer fills the 10 types + variants of DESIGN §7.
  const TYPES = {
    walker: { name: 'Proto Walker', w: 26, h: 18, hp: 6, contact: 1, bits: 2, speed: 1.0, kbResist: 1.0,
      shell: '#8fb6e8', under: '#2a3a5c', accent: '#8fb6e8', gravity: 0.5, maxFall: 12 },
  };

  function createWalker(d, spawn, room, game) {
    const e = new E({ x: spawn.x * TILE + TILE / 2, y: (spawn.y + 1) * TILE, w: d.w, h: d.h, hp: d.hp, units: 'pxf', kbResist: d.kbResist });
    e.type = 'walker'; e.name = d.name; e.data = d;
    e.contact = d.contact; e.bits = d.bits; e.dropShard = false; e.accent = d.accent;
    e.state = 'patrol'; e.dir = -1; e.facing = -1; e.turnT = 0;
    e.patrol = spawn.patrol ? [spawn.patrol[0] * TILE, (spawn.patrol[1] + 1) * TILE] : null;
    e.update = function (game, player) {
      this.t++;
      if (this.flash > 0) this.flash--;
      if (this.hitstun > 0) {
        this.hitstun--; this.state = 'hurt';
        this.gravity(d.gravity, d.maxFall); this.vx = U.approach(this.vx, 0, 0.2);
        this.moveAndCollide(game.level);
        if (this.hitstun === 0) this.state = 'patrol';
        return;
      }
      if (this.state === 'turn') {
        this.vx = 0;
        if (++this.turnT === 3) { this.dir = -this.dir; this.facing = this.dir; }
        if (this.turnT >= 6) { this.turnT = 0; this.state = 'patrol'; }
      } else {
        this.vx = this.dir * d.speed;
        const hw = this.w / 2;
        const leadX = this.x + this.dir * (hw + 1);
        const footTile = E.tileAt(game.level, Math.floor(leadX / TILE), Math.floor(this.y / TILE));
        const ledge = this.onGround && !(footTile === '#' || footTile === 'c' || footTile === '-');
        const bound = this.patrol && (this.dir < 0 ? leadX <= this.patrol[0] : leadX >= this.patrol[1]);
        if (ledge || bound || this.hitWall === this.dir) { this.state = 'turn'; this.turnT = 0; this.vx = 0; }
      }
      this.gravity(d.gravity, d.maxFall);
      this.moveAndCollide(game.level);
      if (this.hitWall === this.dir && this.state === 'patrol') { this.state = 'turn'; this.turnT = 0; }
    };
    e.draw = function (ctx, game, alpha) {
      const x = U.lerp(this.px, this.x, alpha), y = U.lerp(this.py, this.y, alpha);
      ctx.save(); ctx.translate(x, y); ctx.scale(this.facing, 1);
      ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = P.INK;
      // six stubby legs, alternating every 2 frames
      ctx.lineWidth = 2; ctx.strokeStyle = this.flash > 0 ? '#FFFFFF' : d.under;
      const step = ((this.t >> 1) & 1) ? 2 : -2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(i * 7, -5); ctx.lineTo(i * 7 + (i % 2 ? step : -step), 0); ctx.stroke();
      }
      ctx.lineWidth = 3; ctx.strokeStyle = P.INK;
      ctx.fillStyle = this.flash > 0 ? '#FFFFFF' : d.shell;
      ctx.beginPath(); ctx.ellipse(0, -9, 13, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = this.flash > 0 ? '#FFFFFF' : d.under; ctx.beginPath(); ctx.ellipse(0, -5, 10, 3, 0, 0, Math.PI); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      const bob = Math.sin(this.t / 10) * 1.5;
      ctx.beginPath(); ctx.arc(8, -14 + bob, 1.5, 0, Math.PI * 2); ctx.arc(11, -13 - bob, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    return e;
  }

  UB.Enemies = {
    TYPES: TYPES,
    /** Create an enemy at a room spawn {type, x, y, patrol...}; null for unknown types. */
    create: function (type, spawn, room, game) {
      const d = TYPES[type];
      if (!d) return null;
      return createWalker(d, spawn, room, game);
    },
  };
})(window.UB);
