// ============ Mystery Box: roll, grant, occasional move ============
import * as THREE from 'three';
import { G, pick } from './core.js';
import { MAP } from './mapdata.js';
import { WEAPONS, BOX_POOL } from './config.js';
import * as TX from './textures.js';

function weighted(pool) {
  let total = 0; for (const e of pool) total += e.weight;
  let r = Math.random() * total;
  for (const e of pool) { r -= e.weight; if (r <= 0) return e.id; }
  return pool[0].id;
}

export class MysteryBox {
  constructor(scene) {
    this.scene = scene;
    this.spawnId = MAP.boxStart;
    this.cost = MAP.boxCost;
    this.state = 'idle';     // idle | rolling | await | moving
    this.rollT = 0; this.awaitT = 0; this.cycle = 0; this.finalId = null; this.uses = 0;

    this.group = new THREE.Group();
    const tex = TX.wood().clone(); tex.needsUpdate = true;
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.9), new THREE.MeshLambertMaterial({ color: 0x6e5c42, map: tex }));
    crate.position.y = 0.4; this.group.add(crate);
    this.lid = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.12, 0.94), new THREE.MeshLambertMaterial({ color: 0x5c4d38 }));
    this.lid.geometry.translate(0, 0, 0.47); this.lid.position.set(0, 0.8, -0.47); this.group.add(this.lid);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.6), new THREE.MeshBasicMaterial({ color: 0x3a4a5e, fog: false }));
    glow.position.set(0, 0.06, 0); this.group.add(glow);

    this.icon = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.15), new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }));
    this.icon.visible = false; this.group.add(this.icon);

    scene.add(this.group);
    this.pos = new THREE.Vector3();
    this._place(this.spawnId);
  }

  _place(id) {
    const s = MAP.boxSpawns.find((b) => b.id === id) || MAP.boxSpawns[0];
    this.spawnId = id;
    this.pos.set(s.at[0], 0, s.at[1]);
    this.group.position.copy(this.pos);
  }

  prompt(player) {
    if (this.state === 'rolling' || this.state === 'moving') return null;
    if (this.state === 'await') return `[F] TAKE ${WEAPONS[this.finalId].name}`;
    return `[F] MYSTERY BOX — ${this.cost}`;
  }

  interact(player) {
    if (this.state === 'await') {
      player.giveWeapon(this.finalId, false);
      if (G.audio) G.audio.purchase();
      G.hud && G.hud.flash(WEAPONS[this.finalId].name + ' ACQUIRED');
      this._afterTake();
      return;
    }
    if (this.state !== 'idle') return;
    if (!player.spend(this.cost)) return;
    this.state = 'rolling'; this.rollT = 2.2; this.cycle = 0;
    this.finalId = weighted(BOX_POOL);
    this.icon.visible = true;
    if (G.audio) G.audio.ui();
  }

  _afterTake() {
    this.icon.visible = false; this.uses++;
    // teddy-bear move chance
    if (this.uses >= 3 && Math.random() < 0.35) {
      this.state = 'moving'; this.moveT = 1.5;
      G.hud && G.hud.flash('THE BOX IS MOVING...');
    } else this.state = 'idle';
  }

  update(dt) {
    this.lid.rotation.x += ((this.state === 'await' || this.state === 'rolling') ? -1.2 : 0 - this.lid.rotation.x) * Math.min(1, dt * 6);
    if (this.state === 'rolling') {
      this.rollT -= dt; this.cycle += dt;
      this.icon.position.set(0, 1.3 + Math.sin(this.cycle * 10) * 0.1, 0);
      this.icon.rotation.y += dt * 12;
      const flicker = pick(BOX_POOL).id;
      this.icon.material.color.set(WEAPONS[flicker].color || 0xffffff);
      if (this.rollT <= 0) { this.state = 'await'; this.awaitT = 10; this.icon.material.color.set(WEAPONS[this.finalId].color || 0xffd23f); }
    } else if (this.state === 'await') {
      this.awaitT -= dt;
      this.icon.position.set(0, 1.3, 0); this.icon.rotation.y += dt * 3;
      if (this.awaitT <= 0) { this._afterTake(); }
    } else if (this.state === 'moving') {
      this.moveT -= dt;
      this.group.position.y = Math.sin(this.moveT * 3) * 0.2;
      if (this.moveT <= 0) {
        const others = MAP.boxSpawns.filter((b) => b.id !== this.spawnId);
        this._place(pick(others).id);
        this.group.position.y = 0; this.uses = 0; this.state = 'idle';
      }
    }
  }

  reset() { this.state = 'idle'; this.uses = 0; this.icon.visible = false; this._place(MAP.boxStart); }
}
