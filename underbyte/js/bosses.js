/*
 * UNDERBYTE — js/bosses.js
 * Owner: ENEMIES implementer (this is a STUB with ONE placeholder boss by the engine architect).
 * Contract: CONTRACT.md §6.2 (boss object + hooks). Design: DESIGN.md §8.
 *
 * UB.Bosses.create(bossId, room, game) → boss entity (UB.Entity, units 'pxf',
 * kbResist 0). The engine owns the fight sequence (trigger → seal → 150 f
 * intro card → fight → death → rewards → ability pickup → unseal) and the HP
 * bar; the boss owns its attacks and drawing. Hooks: onIntro(game) at the
 * intro start, onFightStart(game) when control returns, update(game, player)
 * only while the fight is running, onDefeated(game) once after the death
 * animation (spawn rewards: bits, sparks and the ability module via
 * game.spawnPickup). A boss with `final: true` ends the game with
 * game.victory() instead of dropping a module.
 */
'use strict';
(function (UB) {
  const E = UB.Entity, P = UB.Palette, U = UB.Util, FX = UB.FX;
  const TILE = 30;

  const DATA = {
    proto_warden: { name: 'PROTO WARDEN', subtitle: 'PLACEHOLDER OF THE ARENA', hp: 40, w: 60, h: 80,
      ability: 'echoJump', bits: 60, sparks: 3, deathFrames: 60, final: false,
      body: '#2a3a5c', rim: '#6c86b8', glow: '#8fd3ff' },
  };

  function createWarden(id, d, room, game) {
    const b = new E({ x: room.w * TILE / 2 + 120, y: 15 * TILE, w: d.w, h: d.h, hp: d.hp, units: 'pxf', kbResist: 0 });
    // Find the floor under the start x so the boss stands on it whatever the arena.
    b.id = id; b.name = d.name; b.subtitle = d.subtitle; b.data = d;
    b.phase = 1; b.state = 'idle'; b.attack = ''; b.contact = 1; b.active = false; b.final = d.final;
    b.deathFrames = d.deathFrames; b.accent = d.rim; b.facing = -1;
    b.timer = 0; b.cool = 90;
    b.hit = E.makeHit('boss'); b.hit.src = b; b.hit.kind = 'heavy'; b.hit.tag = 'slam';
    b.onIntro = function (game) { this.state = 'roar'; };
    b.onFightStart = function (game) { this.state = 'walk'; this.active = true; };
    b.update = function (game, player) {
      this.t++;
      if (this.flash > 0) this.flash--;
      this.facing = player.x < this.x ? -1 : 1;
      if (this.state === 'walk') {
        this.vx = this.facing * 1.0;
        if (--this.cool <= 0 && Math.abs(player.x - this.x) < 140) { this.state = 'tell'; this.timer = 30; this.vx = 0; this.attack = 'slam'; }
      } else if (this.state === 'tell') {
        this.vx = 0;
        if (--this.timer <= 0) { this.state = 'slam'; this.timer = 10; this.hit.hitList.length = 0; FX.shake(7, 12); UB.Audio.sfx('heavyHit', this.x); }
      } else if (this.state === 'slam') {
        this.vx = 0;
        E.hitBoxWorld(this, 55, 10, 70, 60, this.hit);
        this.hit.dmg = 1; this.hit.kbx = 240; this.hit.kby = -300; this.hit.facing = this.facing; this.hit.hitstop = 6;
        game.registerHit(this.hit);
        if (--this.timer <= 0) { this.state = 'recover'; this.timer = 40; }
      } else if (this.state === 'recover') {
        this.vx = 0;
        if (--this.timer <= 0) { this.state = 'walk'; this.cool = 90; this.attack = ''; }
      } else this.vx = 0;
      this.gravity(0.5, 12);
      this.moveAndCollide(game.level);
    };
    b.onDefeated = function (game) {
      const p = room.boss.pickup;
      for (let i = 0; i < 3; i++) game.spawnPickup('bit', this.x + (i - 1) * 20, this.y - 40, { size: 'large', vx: (i - 1) * 2, vy: -5, permanent: true });
      for (let i = 0; i < d.sparks; i++) game.spawnPickup('spark', this.x + (i - 1) * 24, this.y - 50, { vx: (i - 1) * 1.5, vy: -6, permanent: true });
      if (!this.final) game.spawnPickup('ability', p.x * TILE + TILE / 2, (p.y + 1) * TILE, { ability: d.ability, bossId: id, glow: d.glow });
    };
    b.draw = function (ctx, game, alpha) {
      const x = U.lerp(this.px, this.x, alpha), y = U.lerp(this.py, this.y, alpha);
      let sy = 1, a = 1;
      if (this.dead) { const k = Math.min(1, this.t / Math.max(1, this.deathFrames)); sy = 1 - 0.6 * k; a = 1 - k * 0.8; }
      ctx.save(); ctx.translate(x, y); ctx.scale(this.facing, sy); ctx.globalAlpha = a;
      ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = P.INK;
      // a tapering stack of six flat discs with two hanging slab arms (nothing humanoid)
      const widths = [60, 56, 52, 48, 44, 40];
      const wob = this.state === 'tell' ? Math.sin(this.t * 0.8) * 3 : 0;
      for (let i = 0; i < 6; i++) {
        const w = widths[i], cy = -8 - i * 14;
        ctx.fillStyle = this.flash > 0 ? '#FFFFFF' : d.body;
        ctx.beginPath(); ctx.ellipse(wob * (i / 5), cy, w / 2, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = d.rim; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(wob * (i / 5), cy - 2, w / 2 - 4, 3, 0, Math.PI, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = P.INK; ctx.lineWidth = 3;
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

  UB.Bosses = {
    DATA: DATA,
    /** Create a boss entity for the room; null for unknown ids. */
    create: function (bossId, room, game) {
      const d = DATA[bossId];
      if (!d) return null;
      return createWarden(bossId, d, room, game);
    },
    /** Reward summary used by the engine's debug defeatBoss(): {ability, bits, sparks, final}. */
    rewardFor: function (bossId) {
      const d = DATA[bossId];
      return d ? { ability: d.ability, bits: d.bits, sparks: d.sparks, final: !!d.final } : { ability: null, bits: 0, sparks: 0, final: false };
    },
  };
})(window.UB);
