// ============ player: movement, twin-stick shooting, perks, health, down ============
import * as THREE from 'three';
import { G, clamp } from './core.js';
import { MAP } from './mapdata.js';
import { MAX_HP, JUG_HP, PERKS, WEAPONS } from './config.js';
import { buildSurvivor, poseSurvivor } from './characters.js';
import { makeWeapon, fireKind } from './weapons.js';

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class Player {
  constructor(scene, charDef) {
    this.char = charDef;
    this.model = buildSurvivor(charDef);
    scene.add(this.model.group);
    this.pos = new THREE.Vector3(MAP.spawn[0], 0, MAP.spawn[1]);
    this.yaw = 0;
    this.maxHp = MAX_HP; this.hp = MAX_HP;
    this.points = 500;
    this.perks = new Set();
    this.qrUses = 0;
    this.weapons = [makeWeapon('m1911')];
    this.slot = 0;
    this.grenades = 4; this.tacticals = 0;
    this.speed = 5.2;
    this.fireCd = 0; this.reloadT = 0; this.reloadDur = 0; this.reloadFrom = null;
    this.regenT = 0;
    this.meleeCd = 0;
    this.down = false; this.bleed = 0; this.dead = false;
    this.hurtFlash = 0;
    this.meleeSwing = 0; this.recoil = 0;
    this.interactTarget = null;
    this.model.group.position.copy(this.pos);
  }

  weapon() { return this.weapons[this.slot]; }

  addPoints(n) { this.points += Math.round(n * (G.doublePoints ? 2 : 1)); }
  spend(n) { if (this.points >= n) { this.points -= n; return true; } if (G.audio) G.audio.denied(); return false; }

  hasJug() { return this.perks.has('juggernog'); }

  addPerk(id) {
    this.perks.add(id);
    if (id === 'juggernog') { this.maxHp = JUG_HP; this.hp = JUG_HP; }
    if (id === 'quickrevive') this.qrUses = 3;
    if (G.audio) G.audio.perk();
    G.hud && G.hud.flash(PERKS[id].name + '!');
    // perk pickup flourish in the perk's signature color
    if (G.fx) {
      const col = PERKS[id].color;
      G.fx.ring(this.pos, col, { r0: 0.4, r1: 2.6, dur: 0.5 });
      G.fx.burst(_v.set(this.pos.x, 1.4, this.pos.z), col, { count: 16, speed: 5, life: 0.6, size: 0.26, up: 3, gravity: -4, drag: 1 });
    }
  }

  giveWeapon(id, papped) {
    // tactical equipment (monkey bombs) go to the throwable slot, not a gun slot
    const wd = WEAPONS[id];
    if (wd && wd.type === 'tactical') { this.tacticals = Math.min(8, this.tacticals + (wd.count || 4)); return; }
    // already own it? refill / upgrade
    const owned = this.weapons.find((w) => w.id === id);
    if (owned && (!papped || owned.papped)) {
      const nw = makeWeapon(id, owned.papped);
      Object.assign(owned, { mag: nw.mag, reserve: nw.reserve });
      return;
    }
    const w = makeWeapon(id, papped);
    if (this.weapons.length < 2) { this.weapons.push(w); this.slot = this.weapons.length - 1; }
    else { this.weapons[this.slot] = w; }
  }

  maxAmmo() {
    for (const w of this.weapons) { const fresh = makeWeapon(w.id, w.papped); w.reserve = fresh.reserve; w.mag = w.def.mag || 0; }
    this.grenades = 4;
  }

  hurt(amount) {
    if (this.down || this.dead || G.invuln) return;
    if (G.godmode) return;
    this.hp -= amount; this.regenT = 0; this.hurtFlash = 1;
    if (G.audio) G.audio.hurt();
    // shake scales with how big the hit was relative to max hp
    G.fx.shake(0.16 + Math.min(0.3, amount / this.maxHp * 0.7));
    if (this.hp <= 0) this.goDown();
  }

  goDown() {
    this.hp = 0;
    if (this.qrUses > 0) { this.down = true; this.bleed = 4.5; if (G.audio) G.audio.down(); G.hud && G.hud.flash('DOWNED — REVIVING'); }
    else { this.dead = true; if (G.audio) G.audio.down(); G.over(); }
  }

  revive() { this.down = false; this.hp = this.maxHp; this.qrUses--; if (G.audio) G.audio.revive(); G.hud && G.hud.flash('REVIVED'); }

  startReload() {
    const w = this.weapon();
    if (this.reloadT > 0 || !w.def.mag) return;
    if (w.mag >= w.def.mag || w.reserve <= 0) return;
    this.reloadT = (w.def.reload || 2) * (this.perks.has('speedcola') ? 0.5 : 1);
    this.reloadDur = this.reloadT;
    this.reloadFrom = w;
    if (G.audio) G.audio.reload();
  }

  fire() {
    const w = this.weapon();
    const def = w.def;
    if (this.reloadT > 0) return;
    if (def.mag && w.mag <= 0) { this.startReload(); return; }
    this.model.parts.muzzle.getWorldPosition(_v);
    const aim = G.cam.aimDir;
    _dir.set(aim.x, 0, aim.y);
    const kind = fireKind(def);
    if (G.audio) G.audio.shot(kind);
    // weighty muzzle flash + per-weapon recoil kick. Heavier guns = bigger flash/shake.
    const kick = kind === 'shotgun' ? 1.6 : kind === 'rifle' ? 1.2 : kind === 'launcher' ? 1.8 : kind === 'smg' ? 0.7 : 1;
    G.fx.muzzle(_v, def.fire ? 0xff8a3a : 0xffe08a, { x: _dir.x, z: _dir.z }, kick);
    if (kind !== 'cone') G.fx.shake(0.04 + kick * 0.05);
    const dmg = G.instakill ? 100000 : def.dmg;

    if (def.type === 'projectile' || def.type === 'launcher') {
      _v.y = 1.0;
      G.weapons.spawnProjectile(_v, _dir, { speed: def.projSpeed || 32, dmg, splash: def.splash || 1.5, color: def.color || 0x6cff5a });
    } else if (def.type === 'cone') {
      G.weapons.cone(this.pos, _dir, def.range, def.cone, dmg, def.knock || 18);
      G.fx.bolts(_v, 0x9fdcff, { count: 6, radius: def.range * 0.5, dur: 0.3 });
      G.fx.shake(0.5);
    } else {
      const pellets = def.pellets || 1;
      for (let i = 0; i < pellets; i++) {
        const spread = def.spread || (def.pellets ? 0.18 : 0.02);
        const a = (Math.random() - 0.5) * spread * 2;
        const dx = _dir.x * Math.cos(a) - _dir.z * Math.sin(a);
        const dz = _dir.x * Math.sin(a) + _dir.z * Math.cos(a);
        _v.set(this.pos.x, 1.0, this.pos.z);
        G.weapons.hitscan(_v, { x: dx, z: dz }, def.range || 60, dmg, { penetrate: def.papped ? 3 : 1 });
      }
      if (def.fire) G.fx.spark(this.model.parts.muzzle.getWorldPosition(new THREE.Vector3()), 0xff7a2a, 5);
    }

    if (def.mag) w.mag--;
    // recoil kick scales with weapon weight (shotguns/launchers kick hardest)
    this.recoil = Math.min(1, this.recoil + (kind === 'shotgun' || kind === 'launcher' ? 0.6 : kind === 'rifle' ? 0.35 : 0.22));
    let rof = def.rof || 4;
    if (this.perks.has('doubletap')) rof *= 1.33;
    this.fireCd = 1 / rof;
  }

  melee() {
    if (this.meleeCd > 0) return;
    this.meleeCd = 0.5;
    this.meleeSwing = 1; // drives the arm-swing pose
    if (G.audio) G.audio.knife();
    const aim = G.cam.aimDir;
    _v.set(this.pos.x, 1.0, this.pos.z);
    // slash spark out in front so the swing reads even when it whiffs
    if (G.fx) G.fx.spark(_dir.set(this.pos.x + aim.x * 1.4, 1.1, this.pos.z + aim.y * 1.4), 0xcfd6e0, 4);
    G.weapons.hitscan(_v, { x: aim.x, z: aim.y }, 2.0, G.instakill ? 100000 : 200, { penetrate: 2, headMul: 1 });
  }

  throwGrenade() {
    if (this.grenades <= 0) return;
    this.grenades--;
    const aim = G.cam.aimDir;
    _v.set(this.pos.x + aim.x, 1.2, this.pos.z + aim.y);
    G.weapons.spawnProjectile(_v, _dir.set(aim.x, 0, aim.y), { speed: 16, dmg: 1500, splash: 3.6, color: 0x556b2f, life: 0.9 });
  }

  throwTactical() {
    if (this.tacticals <= 0) return;
    this.tacticals--;
    const aim = G.cam.aimDir;
    G.lure = { pos: new THREE.Vector3(this.pos.x + aim.x * 5, 0.4, this.pos.z + aim.y * 5), t: 6 };
    if (G.audio) G.audio.ui();
  }

  update(dt, input) {
    const I = input.intent;
    this.fireCd -= dt; this.meleeCd -= dt;
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
    if (this.meleeSwing > 0) this.meleeSwing = Math.max(0, this.meleeSwing - dt * 5);
    // brief gun-kick recoil that eases back, set in fire()
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 9);

    // facing follows aim
    const aim = G.cam.resolveAim(input, this);
    this.yaw = Math.atan2(aim.x, aim.y);
    this.model.group.rotation.y = this.yaw;

    // down/bleedout
    if (this.down) {
      this.bleed -= dt;
      if (Math.floor(this.bleed * 2) % 2 === 0 && G.audio) { /* heartbeat handled by hud cadence */ }
      if (this.bleed <= 0) this.revive();
      poseSurvivor(this.model, dt, false, false);
      this.model.group.position.copy(this.pos);
      this.model.group.position.y = -0.5; // crawling
      return;
    }
    this.model.group.position.y = 0;

    // movement (camera-relative): forward(up-screen) F=(-sin,-cos), right R=(cos,-sin)
    const s = Math.sin(G.cam.yaw), c = Math.cos(G.cam.yaw);
    const mx = I.moveVec.x, mz = I.moveVec.y;
    const wx = -mz * s + mx * c;
    const wz = -mz * c - mx * s;
    const moving = (mx * mx + mz * mz) > 0.02;
    if (moving) {
      const step = this.speed * dt;
      const nx = this.pos.x + wx * step, nz = this.pos.z + wz * step;
      const r = G.nav.resolve(this.pos.x, this.pos.z, nx, nz, 0.35);
      this.pos.x = r.x; this.pos.z = r.z;
    }
    this.model.group.position.set(this.pos.x, 0, this.pos.z);
    poseSurvivor(this.model, dt, moving, true, this.recoil, this.meleeSwing);

    // actions
    if (I.switchWeapon && this.weapons.length > 1) { this.slot = (this.slot + 1) % this.weapons.length; this.reloadT = 0; if (G.audio) G.audio.ui(); }
    if (I.reload) this.startReload();
    if (I.melee) this.melee();
    if (I.grenade) this.throwGrenade();
    if (I.tactical) this.throwTactical();

    const w = this.weapon();
    const auto = w.def.auto;
    const wantFire = w.def.melee ? false : (auto ? I.fireHeld : I.fire);
    if (wantFire && this.fireCd <= 0 && this.reloadT <= 0) {
      if (w.def.mag && w.mag <= 0) { if (I.fire && G.audio) G.audio.empty(); this.startReload(); }
      else this.fire();
    }

    // reload tick
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0 && this.reloadFrom) {
        const rw = this.reloadFrom; const need = rw.def.mag - rw.mag;
        const take = Math.min(need, rw.reserve); rw.mag += take; rw.reserve -= take; this.reloadFrom = null;
      }
    }

    // health regen (CoD-style: regen after not taking damage)
    this.regenT += dt;
    const delay = this.hasJug() ? 2.5 : 4.5;
    if (this.regenT > delay && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * dt * 0.5);
  }

  reset() {
    this.pos.set(MAP.spawn[0], 0, MAP.spawn[1]);
    this.hp = this.maxHp = MAX_HP; this.points = 500; this.perks.clear(); this.qrUses = 0;
    this.weapons = [makeWeapon('m1911')]; this.slot = 0;
    this.grenades = 4; this.tacticals = 0; this.down = false; this.dead = false;
    this.hurtFlash = 0; this.meleeSwing = 0; this.recoil = 0;
    this.model.group.position.copy(this.pos); this.model.group.position.y = 0;
    this.model.group.rotation.z = 0;
  }
}
