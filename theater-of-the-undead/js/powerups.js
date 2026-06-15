// ============ power-up drops + timed effects ============
import * as THREE from 'three';
import { G, pick } from './core.js';
import { POWERUPS } from './config.js';

const DROP_TABLE = ['maxammo', 'maxammo', 'maxammo', 'instakill', 'instakill', 'double', 'double', 'nuke', 'carpenter', 'carpenter'];

export class PowerUps {
  constructor(scene) {
    this.scene = scene;
    this.drops = [];
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
      m.visible = false; scene.add(m);
      this.drops.push({ mesh: m, active: false, kind: null, t: 0, pos: new THREE.Vector3() });
    }
    this.instakillT = 0; this.doubleT = 0;
  }

  drop(pos, kind) {
    const d = this.drops.find((q) => !q.active) || this.drops[0];
    d.active = true; d.kind = kind; d.t = 25; d.pos.set(pos.x, 0.6, pos.z);
    d.mesh.material.color.set(POWERUPS[kind].color);
    d.mesh.position.copy(d.pos); d.mesh.visible = true;
    G.fx.ring(d.pos, POWERUPS[kind].color, { r0: 0.3, r1: 2, dur: 0.5 });
  }
  dropRandom(pos) { this.drop(pos, pick(DROP_TABLE)); }

  apply(kind) {
    const p = G.player;
    if (G.audio) G.audio.powerup(kind);
    G.fx.ring(p.center ? p.center() : p.pos, POWERUPS[kind].color, { r0: 0.5, r1: 8, dur: 0.6 });
    G.hud && G.hud.flash(POWERUPS[kind].label + '!');
    switch (kind) {
      case 'maxammo': p.maxAmmo(); break;
      case 'instakill': this.instakillT = 30; G.instakill = true; break;
      case 'double': this.doubleT = 30; G.doublePoints = true; break;
      case 'nuke': G.zombies.killAll(true); p.addPoints(400); G.fx.shake(0.6); break;
      case 'carpenter': G.world.repairAllBoards(); p.addPoints(200); break;
    }
  }

  update(dt, player) {
    if (this.instakillT > 0) { this.instakillT -= dt; if (this.instakillT <= 0) G.instakill = false; }
    if (this.doubleT > 0) { this.doubleT -= dt; if (this.doubleT <= 0) G.doublePoints = false; }
    for (const d of this.drops) {
      if (!d.active) continue;
      d.t -= dt;
      d.mesh.rotation.y += dt * 2;
      d.mesh.position.y = 0.6 + Math.sin(G.time * 3 + d.pos.x) * 0.12;
      // blink when about to vanish
      if (d.t < 5) d.mesh.visible = (Math.floor(d.t * 6) % 2 === 0);
      if (d.t <= 0) { d.active = false; d.mesh.visible = false; continue; }
      if (Math.hypot(player.pos.x - d.pos.x, player.pos.z - d.pos.z) < 1.6) {
        d.active = false; d.mesh.visible = false; this.apply(d.kind);
      }
    }
  }

  clear() { for (const d of this.drops) { d.active = false; d.mesh.visible = false; } this.instakillT = this.doubleT = 0; G.instakill = false; G.doublePoints = false; }
}
