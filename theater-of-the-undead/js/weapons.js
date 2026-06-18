// ============ weapons: hitscan / projectile / cone / melee + projectile pool ============
import * as THREE from 'three';
import { G } from './core.js';
import { WEAPONS, papStats } from './config.js';

export function makeWeapon(id, papped = false) {
  const base = WEAPONS[id];
  const def = papped ? papStats(base) : base;
  return {
    id, papped, def,
    name: (papped && base.pap && base.pap.name) ? base.pap.name : base.name,
    mag: def.mag || 0,
    reserve: def.reserve != null ? def.reserve : (def.count != null ? def.count : 0),
    lastFire: -99, burstLeft: 0,
  };
}

export function fireKind(def) {
  if (def.type === 'projectile') return 'ray';
  if (def.type === 'launcher') return 'launcher';
  if (def.type === 'cone') return 'thunder';
  if (def.pellets) return 'shotgun';
  if (def.type === 'hitscan' && def.rof >= 9) return 'smg';
  if (def.type === 'hitscan' && def.rof >= 4 && def.mag > 8) return 'rifle';
  return 'pistol';
}

const PROJ_MAX = 40;

export class Weapons {
  constructor(scene) {
    this.scene = scene;
    this.proj = [];
    const geo = new THREE.IcosahedronGeometry(0.18, 0);
    for (let i = 0; i < PROJ_MAX; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x6cff5a, fog: false }));
      m.visible = false; scene.add(m);
      this.proj.push({ mesh: m, active: false, dir: new THREE.Vector3(), pos: new THREE.Vector3(), speed: 0, life: 0, dmg: 0, splash: 0, color: 0x6cff5a });
    }
  }

  spawnProjectile(pos, dir, { speed = 36, dmg = 1000, splash = 2.4, color = 0x6cff5a, life = 2.2 }) {
    const p = this.proj.find((q) => !q.active) || this.proj[0];
    p.active = true; p.pos.copy(pos); p.dir.copy(dir).normalize(); p.speed = speed;
    p.life = life; p.dmg = dmg; p.splash = splash; p.color = color;
    p.mesh.material.color.set(color); p.mesh.visible = true; p.mesh.position.copy(pos);
  }

  // hitscan along dir from origin; returns true if at least one zombie hit
  hitscan(origin, dir, range, dmg, { penetrate = 1, headMul = 2 } = {}) {
    const hits = [];
    const ox = origin.x, oz = origin.z, dx = dir.x, dz = dir.z;
    const list = G.zombies ? G.zombies.alive : [];
    for (const z of list) {
      if (!z.active || z.dying) continue;
      const rx = z.pos.x - ox, rz = z.pos.z - oz;
      const t = rx * dx + rz * dz;             // projection along ray
      if (t < 0 || t > range) continue;
      const px = ox + dx * t, pz = oz + dz * t;
      const perp = Math.hypot(z.pos.x - px, z.pos.z - pz);
      if (perp < z.radius) hits.push({ z, t, head: perp < 0.22 });
    }
    hits.sort((a, b) => a.t - b.t);
    let n = 0;
    for (const h of hits) {
      if (n >= penetrate) break;
      const headshot = h.head;
      h.z.damage(headshot ? dmg * headMul : dmg, { headshot, source: G.player });
      if (headshot) {
        // crunchier headshot: extra blood toward the head + a sharp spark
        const c = h.z.center(); c.y = 1.6;
        G.fx.blood(c, 8);
        G.fx.spark(c, 0xff5a4a, 4);
      } else {
        G.fx.blood(h.z.center());
      }
      n++;
    }
    return n > 0;
  }

  cone(origin, dir, range, angle, dmg, knock) {
    const list = G.zombies ? G.zombies.alive : [];
    for (const z of list) {
      if (!z.active || z.dying) continue;
      const rx = z.pos.x - origin.x, rz = z.pos.z - origin.z;
      const d = Math.hypot(rx, rz);
      if (d > range || d < 0.01) continue;
      const dot = (rx * dir.x + rz * dir.z) / d;
      if (dot < Math.cos(angle)) continue;
      z.knockback(dir, knock);
      z.damage(dmg, { source: G.player });
      G.fx.blood(z.center(), 6);
    }
  }

  splashDamage(pos, radius, dmg) {
    const list = G.zombies ? G.zombies.alive : [];
    for (const z of list) {
      if (!z.active || z.dying) continue;
      const d = Math.hypot(z.pos.x - pos.x, z.pos.z - pos.z);
      if (d <= radius) z.damage(dmg * (1 - d / radius * 0.5), { source: G.player });
    }
    G.fx.burst(pos, 0xffd23f, { count: 16, speed: 9, life: 0.4, size: 0.4, up: 3 });
    G.fx.ring(pos, 0xffd23f, { r0: 0.4, r1: radius * 1.2, dur: 0.4 });
    G.fx.shake(0.4);
    if (G.audio) G.audio.explosion(radius / 3);
  }

  update(dt) {
    for (const p of this.proj) {
      if (!p.active) continue;
      p.life -= dt;
      p.pos.addScaledVector(p.dir, p.speed * dt);
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.x += dt * 8; p.mesh.rotation.y += dt * 6;
      let hit = false;
      const list = G.zombies ? G.zombies.alive : [];
      for (const z of list) {
        if (!z.active || z.dying) continue;
        if (Math.hypot(z.pos.x - p.pos.x, z.pos.z - p.pos.z) < z.radius + 0.2 && Math.abs(p.pos.y - z.pos.y - 1) < 1.4) { hit = true; break; }
      }
      if (!G.nav.inOpen(p.pos.x, p.pos.z)) hit = true;
      if (hit || p.life <= 0) {
        p.active = false; p.mesh.visible = false;
        if (p.splash > 0) this.splashDamage(p.pos, p.splash, p.dmg);
        else { this.splashDamage(p.pos, 1.2, p.dmg); }
      }
    }
  }

  clear() { for (const p of this.proj) { p.active = false; p.mesh.visible = false; } }
}
