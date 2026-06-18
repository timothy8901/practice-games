// ============ zombie + hellhound state machines + pooled manager ============
import * as THREE from 'three';
import { G, rand, pick } from './core.js';
import { MAX_ZOMBIES, MAX_DOGS, zombieHealth, zombieSpeed, PTS, DROP_CHANCE } from './config.js';
import { buildZombie, poseZombie, buildDog, poseDog } from './characters.js';

const _t = new THREE.Vector3();
const _d = new THREE.Vector2();

function makeAgent(model, isDog) {
  return {
    isDog, model, active: false, dying: false,
    pos: new THREE.Vector3(), vel: new THREE.Vector2(),
    hp: 0, maxHp: 0, speed: 0, radius: isDog ? 0.45 : 0.5, yaw: 0,
    state: 'idle', window: null, in: new THREE.Vector2(), at: new THREE.Vector2(),
    attackCd: 0, flash: 0, climbT: 0, dieT: 0, breakCd: 0,
    steer: new THREE.Vector2(), sep: new THREE.Vector2(),
    center() { return _t.set(this.pos.x, 1.0, this.pos.z); },
    knockback(dir, amt) { this.pos.x += dir.x * amt; this.pos.z += dir.z * amt; this.state = 'active'; },
    damage(dmg, opts = {}) {
      if (this.dying || !this.active) return;
      this.hp -= dmg; this.flash = 0.12;
      if (G.audio) G.audio.hit();
      if (this.hp <= 0) G.zombies.kill(this, opts);
      else if (opts.source === G.player && G.player) G.player.addPoints(PTS.hit);
    },
  };
}

export class ZombieManager {
  constructor(scene) {
    this.scene = scene;
    this.alive = [];
    this.zPool = [];
    this.dPool = [];
    for (let i = 0; i < MAX_ZOMBIES; i++) {
      const m = buildZombie(); m.group.visible = false; scene.add(m.group);
      this.zPool.push(makeAgent(m, false));
    }
    for (let i = 0; i < MAX_DOGS; i++) {
      const m = buildDog(); m.group.visible = false; scene.add(m.group);
      this.dPool.push(makeAgent(m, true));
    }
    this.onKill = null;       // set by rounds
    this.groanT = 0;
  }

  free(isDog) { const pool = isDog ? this.dPool : this.zPool; return pool.find((z) => !z.active); }

  spawn(win, round, isDog = false) {
    const z = this.free(isDog);
    if (!z) return null;
    z.active = true; z.dying = false;
    z.maxHp = z.hp = isDog ? Math.round(zombieHealth(round) * 0.6) : zombieHealth(round);
    z.speed = isDog ? zombieSpeed(round) + 1.8 : zombieSpeed(round) * rand(0.85, 1.05);
    z.flash = 0; z.dieT = 0; z.attackCd = 0; z.climbT = 0; z.breakCd = rand(0.2, 0.9);
    z.model.group.scale.setScalar(isDog ? 1 : rand(0.92, 1.08));
    z.model.group.visible = true;
    for (const mt of z.model.flash) mt.emissive && mt.emissive.set(0x000000);
    if (isDog) {
      // dogs spawn at a random active window's outside point and rush
      z.window = win;
      z.pos.set(win.out[0], 0, win.out[1]);
      z.state = 'active';
    } else {
      z.window = win;
      z.pos.set(win.out[0], 0, win.out[1]);
      z.at.set(win.at[0], win.at[1]);
      z.in.set(win.in[0], win.in[1]);
      z.state = 'approach';
    }
    z.model.group.position.copy(z.pos);
    z.model.group.rotation.z = 0;
    // spawn telegraph: a low dust/ground puff so the player can read the arrival point
    if (G.fx) G.fx.burst(_t.set(z.pos.x, 0.2, z.pos.z), isDog ? 0x3a2a22 : 0x2a3a2a, { count: 6, speed: 2.5, life: 0.4, size: 0.3, up: 0.6, gravity: -2, drag: 2 });
    this.alive.push(z);
    return z;
  }

  kill(z, opts = {}) {
    if (z.dying) return;
    z.dying = true; z.dieT = 0.6; z.state = 'dead';
    z.dieDir = Math.random() < 0.5 ? -1 : 1;
    z.dieSpin = (Math.random() - 0.5) * 1.2;
    const pts = z.isDog ? PTS.dogKill : (opts.melee ? PTS.meleeKill : opts.headshot ? PTS.headshotKill : PTS.kill);
    if (G.player) G.player.addPoints(pts, opts.headshot);
    G.fx.gib(z.center());
    // floating points popup at the kill so the reward reads clearly
    if (G.hud && G.player) G.hud.popPoints(z.center(), pts * (G.doublePoints ? 2 : 1), opts.headshot);
    if (G.audio) G.audio.zdeath();
    if (!z.isDog && Math.random() < DROP_CHANCE && G.powerups) G.powerups.dropRandom(z.center());
    if (z.isDog && Math.random() < 0.4 && G.powerups) G.powerups.drop(z.center(), 'maxammo');
    if (this.onKill) this.onKill(z);
  }

  killAll(give = true) {
    for (const z of this.alive.slice()) if (!z.dying) {
      if (give && G.player) G.player.addPoints(PTS.kill);
      z.dying = true; z.dieT = 0.3; z.dieDir = Math.random() < 0.5 ? -1 : 1; z.dieSpin = (Math.random() - 0.5) * 1.2;
      G.fx.gib(z.center());
      if (this.onKill) this.onKill(z);
    }
  }

  count() { return this.alive.filter((z) => !z.dying).length; }

  update(dt) {
    const player = G.player;
    if (!player) return;
    // ambient groans
    this.groanT -= dt;
    if (this.groanT <= 0 && this.alive.length && G.audio) { G.audio.groan(); this.groanT = rand(1.5, 4); }

    // rebuild spatial hash
    G.nav.clearHash();
    for (const z of this.alive) if (z.active && !z.dying) G.nav.insert(z);

    const lure = G.lure && G.lure.t > 0 ? G.lure : null;

    for (let k = this.alive.length - 1; k >= 0; k--) {
      const z = this.alive[k];
      // flash decay
      if (z.flash > 0) { z.flash -= dt; const on = z.flash > 0; for (const mt of z.model.flash) mt.emissive && mt.emissive.set(on ? 0x661111 : 0x000000); }

      if (z.dying) {
        z.dieT -= dt;
        const s = Math.max(0.001, z.dieT / 0.6);
        const f = 1 - s; // 0 -> 1 over the death
        // ragdoll-lite: topple over + a little spin + slight backward slide as it sinks
        z.model.group.rotation.z = (z.dieDir || 1) * f * (Math.PI * 0.55);
        z.model.group.rotation.y = z.yaw + (z.dieSpin || 0) * f;
        z.model.group.scale.setScalar(0.6 + s * 0.4);
        z.model.group.position.y = -(1 - s) * 0.7;
        if (z.dieT <= 0) {
          z.active = false; z.model.group.visible = false;
          z.model.group.position.y = 0; z.model.group.scale.setScalar(1);
          z.model.group.rotation.z = 0;
          this.alive.splice(k, 1);
        }
        continue;
      }

      const tx = lure ? lure.pos.x : player.pos.x;
      const tz = lure ? lure.pos.z : player.pos.z;

      if (z.isDog) {
        this._chase(z, dt, tx, tz, player, lure);
        poseDog(z.model, dt, z.speed);
      } else {
        switch (z.state) {
          case 'approach': this._approach(z, dt); break;
          case 'breaking': this._breaking(z, dt); break;
          case 'climbing': this._climbing(z, dt); break;
          default: this._chase(z, dt, tx, tz, player, lure);
        }
        poseZombie(z.model, dt, z.speed);
      }
      z.model.group.position.set(z.pos.x, z.model.group.position.y || 0, z.pos.z);
      z.model.group.rotation.y = z.yaw;
    }
  }

  _moveTo(z, x, z2, dt, useNav) {
    _d.set(x - z.pos.x, z2 - z.pos.z);
    const dist = _d.length();
    if (dist > 0.001) { _d.normalize(); z.yaw = Math.atan2(_d.x, _d.y); }
    const step = z.speed * dt;
    const nx = z.pos.x + _d.x * step, nz = z.pos.z + _d.y * step;
    if (useNav) { const r = G.nav.resolve(z.pos.x, z.pos.z, nx, nz, z.radius); z.pos.x = r.x; z.pos.z = r.z; }
    else { z.pos.x = nx; z.pos.z = nz; }
    return dist;
  }

  _approach(z, dt) {
    const d = this._moveTo(z, z.at.x, z.at.y, dt, false);
    if (d < 0.5) { z.state = (z.window.boards > 2) ? 'breaking' : 'climbing'; z.climbT = 0; }
  }

  _breaking(z, dt) {
    _d.set(z.at.x - z.pos.x, z.at.y - z.pos.z);
    if (_d.lengthSq() > 0) z.yaw = Math.atan2(_d.x, _d.y);
    z.breakCd -= dt;
    if (z.breakCd <= 0) {
      z.breakCd = 0.85;
      if (G.world.removeBoard(z.window)) { if (G.audio) G.audio.boardBreak(); G.fx.splinter(_t.set(z.at.x, 1.0, z.at.y)); }
      if (z.window.boards <= 2) { z.state = 'climbing'; z.climbT = 0; }
    }
  }

  _climbing(z, dt) {
    z.climbT += dt / 0.8;
    const t = Math.min(1, z.climbT);
    z.pos.x = z.at.x + (z.in.x - z.at.x) * t;
    z.pos.z = z.at.y + (z.in.y - z.at.y) * t;
    _d.set(z.in.x - z.at.x, z.in.y - z.at.y); if (_d.lengthSq() > 0) z.yaw = Math.atan2(_d.x, _d.y);
    if (t >= 1) z.state = 'active';
  }

  _chase(z, dt, tx, tz, player, lure) {
    // flow-field steer (or straight to lure)
    if (lure) { z.steer.set(tx - z.pos.x, tz - z.pos.z); if (z.steer.lengthSq() > 0) z.steer.normalize(); }
    else G.nav.steer(z.pos.x, z.pos.z, z.steer, tx, tz);
    // separation from neighbours
    z.sep.set(0, 0);
    G.nav.forNear(z.pos.x, z.pos.z, (o) => {
      if (o === z || !o.active || o.dying) return;
      const dx = z.pos.x - o.pos.x, dz = z.pos.z - o.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 1.0 && d2 > 0.0001) { const d = Math.sqrt(d2); z.sep.x += dx / d * (1 - d / 1.0); z.sep.y += dz / d * (1 - d / 1.0); }
    });
    const dirx = z.steer.x + z.sep.x * 0.7;
    const dirz = z.steer.y + z.sep.y * 0.7;
    const len = Math.hypot(dirx, dirz) || 1;
    z.yaw = Math.atan2(z.steer.x, z.steer.y);
    const step = z.speed * dt;
    const nx = z.pos.x + dirx / len * step, nz = z.pos.z + dirz / len * step;
    const r = G.nav.resolve(z.pos.x, z.pos.z, nx, nz, z.radius);
    z.pos.x = r.x; z.pos.z = r.z;

    // attack player
    z.attackCd -= dt;
    const pd = Math.hypot(player.pos.x - z.pos.x, player.pos.z - z.pos.z);
    if (!lure && pd < z.radius + 0.9 && z.attackCd <= 0) {
      z.attackCd = z.isDog ? 0.8 : 1.0;
      player.hurt(z.isDog ? 30 : 25);
    }
  }

  clear() {
    for (const z of this.alive.slice()) { z.active = false; z.dying = false; z.model.group.visible = false; z.model.group.scale.setScalar(1); z.model.group.position.y = 0; }
    this.alive.length = 0;
  }
}
