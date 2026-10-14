/*
 * UNDERBYTE — js/characters.js
 * Owner: CHARACTERS implementer (this is a STUB with ONE placeholder fighter by the engine architect).
 * Contract: CONTRACT.md §5 (player object + hooks). Design: DESIGN.md §3 (shared rules), §4 (fighters).
 *
 * This stub is a working reference implementation of the shared kit on the
 * engine's API: run, variable jump, coyote + buffer, Echo Jump, Burst Line,
 * Grip Protocol (cling + wall jump), light chain, heavy, air attack,
 * down-strike with pogo, energy/meter/Overclock, hurt/i-frames, death.
 * The CHARACTERS implementer replaces it with the five fighters of DESIGN §4
 * (UB.Characters.DATA per §4.4) and may restructure freely — but the fields
 * and hooks listed in CONTRACT.md §5 must keep their names and meanings.
 *
 * The placeholder uses Tessik's pinned movement numbers (DESIGN §4.1) so the
 * level-design guarantees of §3.10 (3-tile jump, 6-tile Echo Jump, 180 px
 * dash) hold in the skeleton and the smoke test can measure them.
 */
'use strict';
(function (UB) {
  const E = UB.Entity, In = UB.Input, FX = UB.FX, Au = UB.Audio, P = UB.Palette, U = UB.Util;
  const DT = 1 / 60;

  // DESIGN §3.12 — the subset the player needs.
  const R = {
    buffer: 6, coyote: 6, jumpCut: 0.45, wallJumpVx: 40, wallJumpVy: 0.95, wallCoyote: 5, wallLock: 8,
    dashCooldown: 18, stepUp: 6, dropThroughFrames: 10, pogoVy: -580, pogoDive: 500,
    hurtFrames: 16, iFrames: 60, hurtKb: [240, -300], hurtHitstop: 6, hurtShake: [5, 10],
    energyMax: 100, energyStart: 50, energyRegen: 3, meterMax: 100, ocFrames: 720, ocTransform: 20, ocRevert: 10,
    ocDamage: 1.5, ocSpeed: 1.15, ocReach: 1.2, ocReachCx: 1.1, ocKbTaken: 0.5, ocHitstopBonus: 1,
    chainTimeout: 20, airLandLag: 4, landSquashVy: 600, deathFrames: 60,
  };

  // Placeholder fighter. Move boxes are [cx, cy, w, h] body-local (DESIGN §3.0).
  const DATA = {
    tessik: {
      id: 'tessik', name: 'Tessik', title: 'The Courier Lantern', affinity: 'signal',
      hp: 5, run: 235, accel: 2300, friction: 2600, airControl: 0.80,
      jumpVel: 640, gravity: 1800, maxFall: 900, weight: 1.00, wallSlide: 90, djMult: 0.85,
      dash: { dist: 180, frames: 12 }, box: { w: 22, h: 48 }, runCycle: 8, downLandLag: 6,
      palette: { base: '#2F7A86', shade: '#163E47', accent: '#F0B64A', glow: '#DFFBFF' },
      ocPalette: { base: '#19B5C8', shade: '#0B4A55', accent: '#FFE08A', glow: '#FFFFFF' },
      bio: 'A courier program that never stopped delivering. Balanced in every stat; carries a lantern that is also a fist.',
      moves: {
        light1: { s: 4, a: 3, r: 8, box: [30, -2, 44, 30], dmg: 3, kb: [180, -60], hitstop: 3, lunge: 40, hitCancel: 8, whiffCancel: 12, jumpCancel: 8, energy: 4, meter: 2, name: 'Lantern Jab' },
        light2: { s: 4, a: 3, r: 9, box: [32, -4, 46, 32], dmg: 3, kb: [200, -80], hitstop: 3, lunge: 40, hitCancel: 9, whiffCancel: 13, jumpCancel: 9, energy: 4, meter: 2, name: 'Return Swing' },
        light3: { s: 6, a: 4, r: 12, box: [36, -6, 52, 36], dmg: 5, kb: [260, -160], hitstop: 5, lunge: 60, hitCancel: 14, jumpCancel: 14, energy: 6, meter: 4, shake: [3, 6], name: 'Signal Crack' },
        heavy: { s: 10, a: 5, r: 16, box: [34, -4, 56, 40], dmg: 9, kb: [340, -220], hitstop: 6, lunge: 30, energy: 10, meter: 6, shake: [3, 6], name: 'Lantern Slam' },
        air: { s: 4, a: 5, r: 8, box: [26, -4, 44, 34], dmg: 3, kb: [160, -100], hitstop: 3, energy: 4, meter: 2, name: 'Air Swing' },
        down: { s: 4, a: 60, r: 6, box: [0, 24, 30, 24], dmg: 4, kb: [0, 0], hitstop: 4, energy: 5, meter: 3, name: 'Drop Beacon' },
        special: { cost: 30, name: 'Pulse Line' },
        ultimate: { cost: 40, name: 'Sightline' },
      },
    },
  };

  function Player(data, game) {
    E.call(this, { x: 0, y: 0, w: data.box.w, h: data.box.h, units: 'pxs', hp: data.hp, stepUp: R.stepUp });
    this.id = data.id; this.data = data; this.name = data.name;
    this.baseHp = data.hp; this.maxHp = data.hp; this.hp = data.hp;
    this.abilities = game.save.abilities;         // shared object; grants propagate
    this.energy = R.energyStart; this.energyMax = R.energyMax;
    this.meter = 0; this.meterMax = R.meterMax;
    this.overclock = 0; this.ocTransform = 0; this.ocRevert = 0; this.ocActive = false;
    this.state = 'idle';
    this.locked = false;                          // engine: no input (intro, pickup sequence, settle)
    this.deathTimer = 0;
    this.hurtTimer = 0; this.coyote = 0; this.airJumps = 0; this.airDash = 0;
    this.jumpCutAvail = false; this.wallLock = 0; this.wallCoyote = 0; this.wallDir = 0; this.clinging = false;
    this.dashT = 0; this.dashCd = 0; this.dashing = false;
    this.move = null; this.moveName = ''; this.moveT = 0; this.chain = 0; this.chainTimer = 0; this.connected = false;
    this.landLag = 0; this.lockout = 0;
    this.pogoActive = false;
    this.squashX = 1; this.squashY = 1; this.squashT = 0;
    this.hit = E.makeHit('player'); this.hit.src = this;
    this.hit.onHit = Player.prototype._onHit.bind(this);
    this.stepT = 0;
    this.lastVy = 0;
  }
  Player.prototype = Object.create(E.prototype);
  Player.prototype.constructor = Player;

  // --- helpers ---------------------------------------------------------------------
  Player.prototype.runSpeed = function () { return this.data.run * (this.ocActive ? R.ocSpeed : 1); };
  Player.prototype.attacking = function () { return this.move !== null; };
  Player.prototype.canAct = function () { return !this.locked && this.hurtTimer <= 0 && !this.dead && this.ocTransform <= 0; };
  Player.prototype.squash = function (sx, sy, frames) { this.squashX = sx; this.squashY = sy; this.squashT = frames; };

  Player.prototype.startMove = function (name) {
    const m = this.data.moves[name];
    this.move = m; this.moveName = name; this.moveT = 0; this.connected = false;
    this.hit.hitList.length = 0;
    this.hit.tag = name; this.hit.kind = name === 'heavy' ? 'heavy' : (name === 'air' ? 'air' : (name === 'down' ? 'down' : 'light'));
    this.clinging = false;
    if (name === 'down') this.state = 'down';
    else if (!this.onGround) this.state = 'air';
    else { this.state = 'attack'; this.vx *= 0.5; }
  };
  Player.prototype.endMove = function () {
    this.move = null; this.moveName = ''; this.moveT = 0; this.pogoActive = false;
    if (this.state === 'attack' || this.state === 'air' || this.state === 'down') this.state = this.onGround ? 'idle' : 'fall';
  };
  Player.prototype.cancelMove = function () { this.endMove(); this.chain = 0; this.chainTimer = 0; };

  /** Engine callback: our hit connected with `victim` (enemy, boss, projectile or 'spike'). */
  Player.prototype._onHit = function (victim, result, game) {
    this.connected = true;
    if (this.moveName === 'down') {
      this.vy = R.pogoVy;
      this.airJumps = 1; this.airDash = 1;
      this.endMove();
      FX.burst('pogo', this.x, this.y, 5, { color: this.data.palette.glow });
      FX.burst('ring', this.x, this.y, 1, { radius: 20 });
      FX.shake(2, 3);
      Au.sfx('pogo', this.x);
    }
  };

  // --- hurt / death / respawn (DESIGN §3.2, §3.3) ---------------------------------------------
  /**
   * Take damage. opts: {hazard:true} = spike/pool (ignores i-frames, no knockback;
   * the engine runs the freeze/respawn), {ignoreIframes:true}. Returns true if hp dropped.
   */
  Player.prototype.hurt = function (dmg, fromX, opts) {
    if (this.dead) return false;
    const hazard = !!(opts && opts.hazard);
    if (!hazard && this.iframes > 0 && !(opts && opts.ignoreIframes)) return false;
    if (this.ocTransform > 0) return false;
    this.hp -= dmg;
    this.flash = 6;
    if (!hazard) {
      this.iframes = R.iFrames; this.hurtTimer = R.hurtFrames; this.state = 'hurt';
      this.cancelMove(); this.dashing = false; this.dashT = 0; this.clinging = false;
      const away = fromX === undefined || fromX === null ? -this.facing : (U.sign(this.x - fromX) || -this.facing);
      const k = this.data.weight * (this.ocActive ? R.ocKbTaken : 1);
      this.vx = R.hurtKb[0] * away * k; this.vy = R.hurtKb[1] * k;
      this.squash(1.15, 0.85, 4);
      FX.hitstop(R.hurtHitstop); FX.shake(R.hurtShake[0], R.hurtShake[1]);
      FX.burst('chip', this.x, this.cy(), 6, { color: P.DANGER, dir: away });
      FX.flash(P.DANGER, 0.25, 6);
      Au.sfx('hurt', this.x);
    }
    if (this.hp <= 0) { this.hp = 0; this.die(); }
    return true;
  };
  Player.prototype.die = function () {
    if (this.dead) return;
    this.dead = true; this.deathTimer = 0; this.state = 'dead';
    this.cancelMove(); this.dashing = false; this.clinging = false; this.overclock = 0; this.ocActive = false;
    this.vx = 0; this.vy = -150;
    FX.burst('chip', this.x, this.cy(), 12, { color: this.data.palette.base });
    Au.sfx('death', this.x);
  };
  /** Place the body (bottom-centre) and reset volatile state. opts: {hp, energy, meter, iframes, vx, vy}. */
  Player.prototype.respawn = function (x, y, opts) {
    opts = opts || {};
    this.x = x; this.y = y; this.px = x; this.py = y;
    this.vx = opts.vx || 0; this.vy = opts.vy || 0;
    this.dead = false; this.deathTimer = 0; this.state = 'idle';
    if (opts.hp !== undefined) this.hp = opts.hp;
    if (opts.energy !== undefined) this.energy = opts.energy;
    if (opts.meter !== undefined) this.meter = opts.meter;
    this.iframes = opts.iframes || 0; this.hurtTimer = 0; this.flash = 0;
    this.cancelMove(); this.dashing = false; this.dashT = 0; this.dashCd = 0; this.clinging = false;
    this.overclock = 0; this.ocTransform = 0; this.ocRevert = 0; this.ocActive = false;
    this.landLag = 0; this.lockout = 0; this.wallLock = 0; this.coyote = 0;
    this.airJumps = opts.airJumps !== undefined ? opts.airJumps : 1; this.airDash = this.airJumps;
    this.onGround = false; this.ground = null; this.dropThrough = 0;
    this.squashX = this.squashY = 1; this.squashT = 0;
  };
  /**
   * Move the body (bottom-centre) without resetting hp/energy/meter/Overclock —
   * room arrivals, hazard respawn, debug teleport. opts: {vx, vy, iframes, airJumps}.
   * Cancels any move/dash/cling and clears the hurt state.
   */
  Player.prototype.place = function (x, y, opts) {
    opts = opts || {};
    this.x = x; this.y = y; this.px = x; this.py = y;
    this.vx = opts.vx || 0; this.vy = opts.vy || 0;
    this.cancelMove(); this.dashing = false; this.dashT = 0; this.clinging = false; this.wallLock = 0;
    this.hurtTimer = 0; this.landLag = 0; this.pogoActive = false;
    this.onGround = false; this.wasOnGround = false; this.ground = null; this.dropThrough = 0; this.coyote = 0;
    if (opts.iframes) this.iframes = Math.max(this.iframes, opts.iframes);
    if (opts.airJumps !== undefined) { this.airJumps = opts.airJumps; this.airDash = opts.airJumps; }
    if (!this.dead) this.state = 'fall';
  };
  Player.prototype.heal = function (n) { this.hp = Math.min(this.maxHp, this.hp + n); };

  // --- update (one logic frame) --------------------------------------------------------------
  Player.prototype.update = function (game) {
    const d = this.data;
    this.t++;
    if (this.iframes > 0) this.iframes--;
    if (this.flash > 0) this.flash--;
    if (this.dashCd > 0) this.dashCd--;
    if (this.lockout > 0) this.lockout--;
    if (this.wallLock > 0) this.wallLock--;
    if (this.wallCoyote > 0) this.wallCoyote--;
    if (this.squashT > 0 && --this.squashT === 0) { this.squashX = this.squashY = 1; }
    if (this.chainTimer > 0 && --this.chainTimer === 0) this.chain = 0;

    // Overclock timers (DESIGN §3.9)
    if (this.ocTransform > 0) { this.ocTransform--; if (this.ocTransform === 0) { this.ocActive = true; this.overclock = R.ocFrames; } }
    else if (this.ocActive) {
      this.overclock--; this.meter = this.meterMax * this.overclock / R.ocFrames;
      if ((this.t % 3) === 0) FX.burst('aura', this.x, this.y, 1, { color: d.ocPalette.glow });
      if (this.overclock <= 0) { this.ocActive = false; this.ocRevert = R.ocRevert; this.meter = 0; Au.sfx('overclockEnd'); }
    } else if (this.ocRevert > 0) this.ocRevert--;
    // Energy regen (3/s, 6/s in Overclock)
    this.energy = Math.min(this.energyMax, this.energy + R.energyRegen * DT * (this.ocActive ? 2 : 1));

    if (this.dead) {
      this.deathTimer++;
      this.gravity(d.gravity, d.maxFall); this.vx = U.approach(this.vx, 0, d.friction * DT);
      this.moveAndCollide(game.level);
      return;
    }
    if (this.hurtTimer > 0) {
      this.hurtTimer--;
      this.gravity(d.gravity, d.maxFall);
      if (this.onGround) this.vx = U.approach(this.vx, 0, d.friction * DT);
      this.moveAndCollide(game.level);
      if (this.hurtTimer === 0) this.state = this.onGround ? 'idle' : 'fall';
      return;
    }

    const inp = In.state;
    const act = this.canAct();
    const dir = act ? ((inp.right.down ? 1 : 0) - (inp.left.down ? 1 : 0)) : 0;
    const wasGround = this.onGround;
    if (this.onGround) { this.coyote = R.coyote; this.airJumps = 1; this.airDash = 1; }
    else if (this.coyote > 0) this.coyote--;

    // ---- Overclock activation ----
    if (act && inp.overclock.buffer > 0 && this.meter >= this.meterMax && !this.ocActive && !this.attacking() && !this.dashing &&
        (this.state === 'idle' || this.state === 'run' || this.state === 'jump' || this.state === 'fall' || this.state === 'cling')) {
      In.consume('overclock');
      this.ocTransform = R.ocTransform; this.clinging = false; this.vx = 0;
      FX.hitstop(8); FX.flash('#FFFFFF', 0.6, 8); FX.shake(6, 12);
      FX.burst('spark', this.x, this.cy(), 24, { color: d.ocPalette.glow });
      FX.burst('ring', this.x, this.cy(), 1, { radius: 120 });
      Au.sfx('overclockOn', this.x);
    }

    // ---- Dash (Burst Line) ----
    if (this.dashing) {
      this.dashT--;
      const dist = d.dash.dist * (this.ocActive ? R.ocSpeed : 1);
      this.vx = (dist / d.dash.frames) * 60 * this.facing; this.vy = 0;
      if (this.dashT <= 0 || this.hitWall === this.facing) {
        this.dashing = false; this.dashCd = R.dashCooldown;
        this.vx = dir === this.facing && dir !== 0 ? this.runSpeed() * this.facing : 0;
        this.state = this.onGround ? 'idle' : 'fall';
      }
      this.moveAndCollide(game.level);
      if (this.dashing) { if ((this.t & 3) === 0) FX.burst('dust', this.x, this.y, 1); return; }
    } else if (act && this.abilities.burstLine && inp.dash.buffer > 0 && this.dashCd <= 0 && !this.attacking() &&
               (this.onGround || this.airDash > 0)) {
      In.consume('dash');
      if (!this.onGround) this.airDash--;
      if (dir !== 0) this.facing = dir;
      this.dashing = true; this.dashT = d.dash.frames; this.state = 'dash'; this.clinging = false; this.vy = 0;
      FX.burst('dust', this.x, this.y, 5); Au.sfx('dash', this.x);
      this.vx = (d.dash.dist / d.dash.frames) * 60 * this.facing;
      this.moveAndCollide(game.level);
      return;
    }

    // ---- Attacks ----
    const m = this.move;
    if (m) {
      this.moveT++;
      const grounded = this.state === 'attack';
      if (grounded && this.moveT === 1 && m.lunge) this.vx += m.lunge * this.facing;
      const active = this.moveT > m.s && this.moveT <= m.s + m.a;
      const inHitCancel = this.connected && m.hitCancel && this.moveT >= m.hitCancel;
      const inWhiffCancel = !this.connected && m.whiffCancel && this.moveT >= m.whiffCancel;
      // chain / cancels (lights only)
      if (act && grounded && this.hit.kind === 'light' && (inHitCancel || inWhiffCancel)) {
        if (inp.light.buffer > 0 && this.chain < 3) { In.consume('light'); this.chain++; this.startMove('light' + (this.chain === 3 ? 3 : this.chain)); if (this.chain === 3) this.chain = 0; return; }
        if (inHitCancel && inp.jump.buffer > 0 && this.onGround) { this.cancelMove(); /* falls through to jump below */ }
        else if (inHitCancel && this.abilities.burstLine && inp.dash.buffer > 0 && this.dashCd <= 0) { this.cancelMove(); }
      }
      if (this.move) {
        if (this.moveName === 'down') {
          this.pogoActive = active;
          if (active) { if (this.vy < R.pogoDive) this.vy = R.pogoDive; if (this.vy > d.maxFall) this.vy = d.maxFall; }
          if (this.onGround && this.moveT > m.s) { this.endMove(); this.landLag = d.downLandLag; this.state = 'idle'; }
        } else if (this.moveName === 'air') {
          if (this.onGround) { if (this.moveT <= m.s) this.endMove(); else { this.endMove(); this.landLag = R.airLandLag; } }
        }
        if (this.move && this.moveT > m.s + m.a + m.r) {
          this.endMove(); this.chainTimer = R.chainTimeout;
        }
        if (this.move && active) {
          const reach = this.ocActive ? R.ocReach : 1, cxm = this.ocActive ? R.ocReachCx : 1;
          E.hitBoxWorld(this, m.box[0] * cxm, m.box[1], m.box[2] * reach, m.box[3] * reach, this.hit);
          this.hit.dmg = this.ocActive ? Math.floor(m.dmg * R.ocDamage) : m.dmg;
          this.hit.kbx = m.kb[0]; this.hit.kby = m.kb[1]; this.hit.facing = this.facing;
          this.hit.hitstop = m.hitstop + (this.ocActive ? R.ocHitstopBonus : 0);
          this.hit.energy = m.energy; this.hit.meter = m.meter;
          this.hit.shake = m.shake ? m.shake[0] : 0; this.hit.shakeFrames = m.shake ? m.shake[1] : 0;
          this.hit.multi = false;
          game.registerHit(this.hit);
          if (this.moveName === 'down') { // pogo off floor spikes (DESIGN §3.6)
            if (E.hazardInBox(game.level, this.hit.x, this.hit.y, this.hit.w, this.hit.h, false) === 'spike' && E.lastHazard.ch === '^') {
              this._onHit('spike', null, game);
            }
          }
        }
      }
    } else if (act && this.landLag <= 0 && this.lockout <= 0) {
      if (inp.light.buffer > 0) {
        In.consume('light');
        if (this.onGround) { this.chain = this.chainTimer > 0 ? this.chain : 0; this.chain++; this.startMove('light' + Math.min(3, this.chain)); if (this.chain >= 3) this.chain = 0; }
        else if (inp.down.down) this.startMove('down');
        else this.startMove('air');
        if (this.onGround && dir !== 0 && this.moveT === 0) this.facing = dir;
      } else if (inp.heavy.buffer > 0) {
        In.consume('heavy');
        if (this.onGround) { this.startMove('heavy'); if (dir !== 0) this.facing = dir; this.chain = 0; }
        else this.startMove('down');
      } else if (inp.special.buffer > 0) {
        In.consume('special');
        const cost = this.ocActive ? this.data.moves.ultimate.cost : this.data.moves.special.cost;
        if (this.energy < cost) { this.lockout = 10; Au.sfx('deny'); game.denyFlash = 6; }
        else { this.energy -= cost; /* placeholder special: a short burst of sparks */ FX.burst('spark', this.x + this.facing * 30, this.cy(), 10, { color: d.palette.accent, dir: this.facing }); Au.sfx('special', this.x); }
      }
    }
    if (this.landLag > 0) this.landLag--;

    // ---- Horizontal movement ----
    const grounded = this.state === 'attack';
    const run = this.runSpeed();
    const accel = this.onGround ? d.accel : d.accel * d.airControl;
    const fric = this.onGround ? d.friction : d.friction * 0.15;
    if (dir !== 0 && !grounded && this.wallLock <= 0 && this.landLag <= 0) {
      this.vx = U.approach(this.vx, dir * run, accel * DT);
      if (!this.attacking()) this.facing = dir;
    } else if (this.wallLock <= 0 || this.onGround) {
      this.vx = U.approach(this.vx, 0, fric * DT);
    }

    // ---- Wall cling (Grip Protocol) ----
    this.clinging = false;
    if (act && this.abilities.gripProtocol && !this.onGround && this.vy > 0 && !this.attacking() && dir !== 0 && this.hitWall === dir) {
      const bx = this.x + dir * (this.w / 2 + 1), r0 = Math.floor((this.y - this.h) / 30), r1 = Math.floor((this.y - 1) / 30), tx = Math.floor(bx / 30);
      let wall = false;
      for (let r = r0; r <= r1; r++) if (E.tileAt(game.level, tx, r) === '#') { wall = true; break; }
      if (wall) {
        this.clinging = true; this.wallDir = dir; this.wallCoyote = R.wallCoyote; this.state = 'cling';
        if (this.vy > d.wallSlide) this.vy = d.wallSlide;
        this.airJumps = 1; this.airDash = 1;
        if ((this.t & 3) === 0) FX.burst('dust', this.x + dir * this.w / 2, this.y - 10, 1);
      }
    }

    // ---- Jump ----
    if (act && inp.jump.buffer > 0 && !this.attacking()) {
      if (this.onGround && inp.down.down && (this.ground || this.groundTy >= 0 && isOneWayUnder(this, game.level))) {
        In.consume('jump'); this.dropThrough = R.dropThroughFrames; this.onGround = false; this.coyote = 0;
      } else if (this.onGround || this.coyote > 0) {
        In.consume('jump');
        this.vy = -d.jumpVel; this.jumpCutAvail = true; this.coyote = 0; this.onGround = false; this.state = 'jump';
        this.squash(0.85, 1.15, 6); FX.burst('dust', this.x, this.y, 3); Au.sfx('jump', this.x);
      } else if ((this.clinging || this.wallCoyote > 0) && this.wallDir !== 0) {
        In.consume('jump');
        const away = -this.wallDir;
        this.vx = (d.run + R.wallJumpVx) * away; this.vy = -R.wallJumpVy * d.jumpVel;
        this.facing = away; this.wallLock = R.wallLock; this.wallCoyote = 0; this.clinging = false;
        this.airJumps = 1; this.airDash = 1; this.jumpCutAvail = true; this.state = 'jump';
        Au.sfx('jump', this.x);
      } else if (this.abilities.echoJump && this.airJumps > 0) {
        In.consume('jump');
        this.airJumps--; this.vy = -d.djMult * d.jumpVel; this.jumpCutAvail = true; this.state = 'jump';
        this.squash(0.85, 1.15, 6); FX.burst('ring', this.x, this.y, 1, { radius: 24 }); Au.sfx('doubleJump', this.x);
      }
    }
    if (inp.jump.released && this.vy < 0 && this.jumpCutAvail) { this.vy *= R.jumpCut; this.jumpCutAvail = false; }
    if (this.hitCeiling) this.jumpCutAvail = false;

    // ---- Gravity & move ----
    // Half-step (leapfrog) gravity: vy += g/2·dt, move, vy += g/2·dt. This makes the
    // discrete apex equal the analytic v²/2g that DESIGN §4.1 pins (113.8 px for
    // this fighter) instead of ~5 px lower, so the 3-tile/6-tile guarantees hold.
    this.vy = Math.min(d.maxFall, this.vy + d.gravity * DT * 0.5);
    if (this.clinging && this.vy > d.wallSlide) this.vy = d.wallSlide;
    this.lastVy = this.vy;
    this.moveAndCollide(game.level);
    if (!this.onGround) this.vy = Math.min(d.maxFall, this.vy + d.gravity * DT * 0.5);

    // ---- Landing ----
    if (this.onGround && !wasGround) {
      if (this.lastVy >= R.landSquashVy) { this.squash(1.2, 0.8, 6); FX.burst('dust', this.x, this.y, 6); }
      if (this.lastVy >= 900) FX.shake(2, 4);
      Au.sfx('land', this.x);
      if (!this.attacking()) this.chain = this.chainTimer > 0 ? this.chain : 0;
    }
    // ---- State label ----
    if (!this.attacking() && !this.dashing && !this.clinging && this.ocTransform <= 0) {
      if (this.onGround) this.state = Math.abs(this.vx) > 10 ? 'run' : 'idle';
      else this.state = this.vy < 0 ? 'jump' : 'fall';
    }
    if (this.ocTransform > 0) this.state = 'overclock';
    if (this.state === 'run' && this.onGround) { if (++this.stepT >= d.runCycle) { this.stepT = 0; FX.burst('dust', this.x, this.y, 1); Au.sfx('step', this.x); } }
  };
  function isOneWayUnder(pl, level) {
    for (let tx = pl.groundTx0; tx <= pl.groundTx1; tx++) if (E.tileAt(level, tx, pl.groundTy) === '-') return true;
    return false;
  }

  // --- draw --------------------------------------------------------------------------------
  Player.prototype.draw = function (ctx, game, alpha) {
    if (this.iframes > 0 && ((this.iframes >> 2) & 1) === 1 && !this.dead) return;
    const d = this.data;
    const x = U.lerp(this.px, this.x, alpha), y = U.lerp(this.py, this.y, alpha);
    const pal = this.ocActive ? d.ocPalette : d.palette;
    let sx = this.squashX, sy = this.squashY, rot = 0, a = 1;
    if (!this.onGround && !this.dead) sy *= 1 + Math.min(0.12, Math.max(0, this.vy) / 9000);
    if (this.ocActive || this.ocTransform > 0) { const k = this.ocTransform > 0 ? 1 - this.ocTransform / R.ocTransform : 1; sx *= 1 + 0.25 * k; sy *= 1 + 0.25 * k; }
    if (this.dead) { const k = Math.min(1, this.deathTimer / 40); sy *= 1 - 0.7 * k; rot = 25 * k * UB.Util.DEG; a = this.deathTimer > 40 ? 1 - (this.deathTimer - 40) / 20 : 1; }
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.translate(x, y); ctx.rotate(rot * this.facing); ctx.scale(this.facing * sx, sy);
    const w = this.w, h = this.h;
    if (this.ocActive) { ctx.globalAlpha *= 0.14; ctx.fillStyle = pal.glow; ctx.beginPath(); ctx.ellipse(0, -h / 2, w * 0.9, h * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = Math.max(0, a); }
    // body: a rounded capsule with a lantern core
    const lean = this.state === 'run' ? -0.17 : 0;
    ctx.rotate(lean);
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = P.INK;
    ctx.fillStyle = this.flash > 0 ? (this.flash > 4 ? '#FFFFFF' : P.DANGER) : pal.base;
    UB.Render.rrect(ctx, -w / 2, -h, w, h, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = pal.shade; UB.Render.rrect(ctx, -w / 2 + 3, -h * 0.45, w - 6, h * 0.42, 5); ctx.fill();
    // legs (procedural run cycle)
    const ph = (this.t % d.runCycle) / d.runCycle * Math.PI * 2;
    const legSwing = this.state === 'run' ? 8 * Math.sin(ph) : 0;
    ctx.lineWidth = 4; ctx.strokeStyle = pal.shade;
    ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(-5 + legSwing, 0); ctx.moveTo(5, -6); ctx.lineTo(5 - legSwing, 0); ctx.stroke();
    // lantern core (glow element) + eye
    ctx.fillStyle = pal.accent; ctx.beginPath(); ctx.arc(2, -h * 0.68, 5, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = pal.glow; ctx.globalAlpha *= 0.9;
    ctx.beginPath(); ctx.arc(2, -h * 0.68, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = P.INK; ctx.beginPath(); ctx.arc(w / 2 - 6, -h * 0.82, 2, 0, Math.PI * 2); ctx.fill();
    // attack swing arc on active frames
    const m = this.move;
    if (m && this.moveT > m.s && this.moveT <= m.s + m.a) {
      ctx.rotate(-lean);
      const k = (this.moveT - m.s) / m.a;
      ctx.strokeStyle = pal.accent; ctx.lineWidth = 4; ctx.globalAlpha *= 0.85;
      ctx.beginPath();
      if (this.moveName === 'down') ctx.arc(0, 4, 16, Math.PI * 0.15, Math.PI * 0.85);
      else ctx.arc(m.box[0] * 0.5, -h / 2 + m.box[1], m.box[2] * 0.55, -1.2 + k * 1.6, -0.6 + k * 1.6);
      ctx.stroke();
    }
    ctx.restore();
  };
  /** Idle rig for the character-select card / preview. */
  function drawPreview(ctx, id, x, y, scale, t) {
    const d = DATA[id] || DATA.tessik;
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale * (1 + 0.015 * Math.sin(t / 40 * Math.PI * 2)));
    const w = d.box.w, h = d.box.h;
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = P.INK; ctx.fillStyle = d.palette.base;
    UB.Render.rrect(ctx, -w / 2, -h, w, h, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = d.palette.shade; UB.Render.rrect(ctx, -w / 2 + 3, -h * 0.45, w - 6, h * 0.42, 5); ctx.fill();
    ctx.fillStyle = d.palette.accent; ctx.beginPath(); ctx.arc(2, -h * 0.68, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.INK; ctx.beginPath(); ctx.arc(w / 2 - 6, -h * 0.82, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  const list = [];
  for (const id in DATA) list.push(DATA[id]);

  UB.Characters = {
    DATA: DATA,
    list: list,
    RULES: R,
    /** Create the player entity for a fighter id (falls back to the first fighter). */
    create: function (id, game) { return new Player(DATA[id] || list[0], game); },
    drawPreview: drawPreview,
    Player: Player,
  };
})(window.UB);
