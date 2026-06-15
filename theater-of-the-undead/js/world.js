// ============ builds the Kino map: floors, walls (with gaps), lights, props ============
import * as THREE from 'three';
import { MAP, WALL_H } from './mapdata.js';
import * as TX from './textures.js';
import { PERKS } from './config.js';

const FLOOR_TEX = { wood: TX.wood, cobble: TX.cobble, plank: TX.plank, carpet: TX.carpet };
const lam = (color, map) => new THREE.MeshLambertMaterial({ color: color ?? 0xffffff, map: map || null, flatShading: true });
const basic = (color) => new THREE.MeshBasicMaterial({ color, fog: false });

function tiled(texFn, w, d, color) {
  const t = texFn().clone(); t.needsUpdate = true;
  t.repeat.set(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(d / 2)));
  return lam(color, t);
}

// span subtraction: [start,end] minus list of [a,b] gaps -> remaining sub-spans
function segments(start, end, gaps) {
  let spans = [[start, end]];
  for (const [ga, gb] of gaps) {
    const next = [];
    for (const [a, b] of spans) {
      if (gb <= a || ga >= b) { next.push([a, b]); continue; }
      if (ga > a) next.push([a, ga]);
      if (gb < b) next.push([gb, b]);
    }
    spans = next;
  }
  return spans.filter(([a, b]) => b - a > 0.05);
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.doorDebris = {};
    this.perkMeshes = {};
    this.trapMeshes = {};
    this.papMesh = null;
    this.build();
  }

  dispose() { this.scene.remove(this.group); }

  build() {
    // lights — flat, even, no shadows (in group so dispose() removes them)
    this.group.add(new THREE.HemisphereLight(0xb0b0c4, 0x2a2a32, 1.45));
    const sun = new THREE.DirectionalLight(0xfff2e0, 0.7);
    sun.position.set(8, 22, 6); this.group.add(sun);
    this.group.add(new THREE.AmbientLight(0x404048, 0.6));

    // outside ground (so approaching zombies have a floor; fog hides the edge)
    const b = MAP.bounds;
    const gt = TX.cobble().clone(); gt.needsUpdate = true;
    gt.repeat.set((b.maxX - b.minX) / 2, (b.maxZ - b.minZ) / 2);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(b.maxX - b.minX + 8, b.maxZ - b.minZ + 8), lam(0x15171b, gt));
    ground.rotation.x = -Math.PI / 2; ground.position.set((b.minX + b.maxX) / 2, -0.04, (b.minZ + b.maxZ) / 2);
    this.group.add(ground);

    const wallMat = lam(0x6f6b60, (() => { const t = TX.brick().clone(); t.needsUpdate = true; t.repeat.set(2, 1); return t; })());
    const wallTopMat = lam(0x2a2420);

    for (const id in MAP.rooms) {
      const room = MAP.rooms[id];
      const [x0, z0, x1, z1] = room.rect;
      const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;

      // floor
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), tiled(FLOOR_TEX[room.floor] || TX.cobble, w, d));
      floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz);
      this.group.add(floor);

      // walls: each edge minus its door + window gaps
      this._edge(wallMat, wallTopMat, room, 'south', x0, x1, z0, true);
      this._edge(wallMat, wallTopMat, room, 'north', x0, x1, z1, true);
      this._edge(wallMat, wallTopMat, room, 'west', z0, z1, x0, false);
      this._edge(wallMat, wallTopMat, room, 'east', z0, z1, x1, false);
    }

    // door debris (fills the connector gap until purchased)
    for (const door of MAP.doors) {
      const [x0, z0, x1, z1] = door.rect;
      const g = new THREE.Group();
      const horiz = (x1 - x0) > (z1 - z0);
      const len = horiz ? (x1 - x0) : (z1 - z0);
      for (let i = 0; i < 5; i++) {
        const plank = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len * 0.9 : 0.5, 0.18, horiz ? 0.5 : len * 0.9),
          lam(0x5c4d38, (() => { const t = TX.plank().clone(); t.needsUpdate = true; return t; })()));
        plank.position.set((x0 + x1) / 2, 0.5 + i * 0.55, (z0 + z1) / 2);
        plank.rotation.z = horiz ? (Math.random() - 0.5) * 0.5 : 0;
        plank.rotation.x = horiz ? 0 : (Math.random() - 0.5) * 0.5;
        plank.rotation.y = (Math.random() - 0.5) * 0.3;
        g.add(plank);
      }
      this.group.add(g);
      this.doorDebris[door.id] = g;
    }

    this._props();
  }

  _edge(wallMat, topMat, room, side, a0, a1, fixed, horiz) {
    const gaps = [];
    // door connector gaps on this edge
    for (const door of MAP.doors) {
      const [dx0, dz0, dx1, dz1] = door.rect;
      if (horiz) { // south/north edge at z = fixed
        if (Math.abs(dz0 - fixed) < 0.01 || Math.abs(dz1 - fixed) < 0.01) {
          const ga = Math.max(a0, dx0), gb = Math.min(a1, dx1);
          if (gb > ga) gaps.push([ga, gb]);
        }
      } else { // west/east edge at x = fixed
        if (Math.abs(dx0 - fixed) < 0.01 || Math.abs(dx1 - fixed) < 0.01) {
          const ga = Math.max(a0, dz0), gb = Math.min(a1, dz1);
          if (gb > ga) gaps.push([ga, gb]);
        }
      }
    }
    // window gaps on this edge
    for (const win of MAP.windows) {
      if (win.room !== this._roomId(room)) continue;
      const [wx, wz] = win.at;
      const on = horiz ? Math.abs(wz - fixed) < 0.01 : Math.abs(wx - fixed) < 0.01;
      if (!on) continue;
      const c = horiz ? wx : wz;
      gaps.push([c - 0.9, c + 0.9]);
      this._window(win, horiz);
    }
    for (const [s, e] of segments(a0, a1, gaps)) {
      const len = e - s, mid = (s + e) / 2;
      const geo = new THREE.BoxGeometry(horiz ? len : 0.4, WALL_H, horiz ? 0.4 : len);
      const wall = new THREE.Mesh(geo, wallMat);
      wall.position.set(horiz ? mid : fixed, WALL_H / 2, horiz ? fixed : mid);
      this.group.add(wall);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(horiz ? len : 0.5, 0.18, horiz ? 0.5 : len), topMat);
      cap.position.set(horiz ? mid : fixed, WALL_H + 0.08, horiz ? fixed : mid);
      this.group.add(cap);
    }
  }

  _roomId(room) { for (const id in MAP.rooms) if (MAP.rooms[id] === room) return id; return null; }

  _window(win, horiz) {
    // board slots stored on the window data for the barrier system to toggle
    win._boardMeshes = [];
    const [wx, wz] = win.at;
    for (let i = 0; i < win.boards; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 1.7 : 0.3, 0.2, horiz ? 0.3 : 1.7),
        lam(0x6e5c42, (() => { const t = TX.plank().clone(); t.needsUpdate = true; return t; })()));
      const y = 0.7 + i * 0.5;
      plank.position.set(wx, y, wz);
      plank.rotation.y = (Math.random() - 0.5) * 0.2;
      (horiz ? (plank.rotation.z = (Math.random() - 0.5) * 0.25) : (plank.rotation.x = (Math.random() - 0.5) * 0.25));
      this.group.add(plank);
      win._boardMeshes.push(plank);
    }
  }

  _props() {
    // perk machines
    for (const p of MAP.perks) {
      const def = PERKS[p.perk];
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.0, 0.7), lam(def.color)); body.position.y = 1.0; g.add(body);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.3, 0.78), lam(0x15171b)); trim.position.y = 1.95; g.add(trim);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.05), basic(def.color));
      sign.position.set(0, 1.55, 0.38); sign.material.color.multiplyScalar(0.4); g.add(sign);
      g.position.set(p.at[0], 0, p.at[1]);
      this.group.add(g);
      this.perkMeshes[p.perk] = { group: g, sign };
    }
    // pack-a-punch
    {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 1.0), lam(0x2c3848)); body.position.y = 0.75; g.add(body);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 0.8), lam(0x3a4a5e)); top.position.y = 1.65; g.add(top);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.05), basic(0x6cff5a));
      glow.position.set(0, 1.0, 0.52); glow.material.color.multiplyScalar(0.3); g.add(glow);
      g.position.set(MAP.pap.at[0], 0, MAP.pap.at[1]);
      this.group.add(g); this.papMesh = { group: g, glow };
    }
    // power lever
    {
      const g = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.0, 0.3), lam(0x30343a)); base.position.y = 0.5; g.add(base);
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.7, 0.1), lam(0x883a3a)); lever.position.set(0, 1.1, 0.1); lever.rotation.x = 0.6; g.add(lever);
      g.position.set(MAP.power.at[0], 0, MAP.power.at[1]);
      this.group.add(g); this.powerLever = lever;
    }
    // teleporter pad + mainframe
    {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.12, 12), basic(0x3a4a5e));
      pad.position.set(MAP.teleporter.pad[0], 0.06, MAP.teleporter.pad[1]); pad.material.color.multiplyScalar(0.5);
      this.group.add(pad); this.telePad = pad;
      const mf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 0.6), lam(0x30343a));
      mf.position.set(MAP.teleporter.mainframe[0], 0.7, MAP.teleporter.mainframe[1]);
      this.group.add(mf); this.teleMain = mf;
    }
    // wall-buy boards
    for (const wb of MAP.wallbuys) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.08), lam(0x2a2420));
      const a = Math.atan2(wb.face[0], wb.face[1]);
      board.position.set(wb.at[0] + wb.face[0] * 0.1, 1.3, wb.at[1] + wb.face[1] * 0.1);
      board.rotation.y = a;
      this.group.add(board);
    }
    // trap switches
    for (const tr of MAP.traps) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.3), lam(0xc89a2f));
      sw.position.set(tr.at[0], 0.5, tr.at[1]); this.group.add(sw);
      this.trapMeshes[tr.id] = sw;
    }
  }

  openDoor(id) {
    const g = this.doorDebris[id];
    if (g) { this.group.remove(g); delete this.doorDebris[id]; }
  }

  // ---- barrier boards ----
  removeBoard(win) {
    if (win.boards <= 0) return false;
    win.boards--;
    const m = win._boardMeshes && win._boardMeshes[win.boards];
    if (m) m.visible = false;
    return true;
  }
  addBoard(win) {
    const max = win._boardMeshes ? win._boardMeshes.length : 6;
    if (win.boards >= max) return false;
    const m = win._boardMeshes[win.boards];
    if (m) m.visible = true;
    win.boards++;
    return true;
  }
  repairAllBoards() {
    for (const win of MAP.windows) {
      if (!win._boardMeshes) continue;
      for (const m of win._boardMeshes) m.visible = true;
      win.boards = win._boardMeshes.length;
    }
  }

  setPowerOn() {
    for (const k in this.perkMeshes) {
      const def = PERKS[k];
      if (def.needsPower) this.perkMeshes[k].sign.material.color.set(def.color);
    }
    if (this.powerLever) this.powerLever.rotation.x = -0.6;
  }

  setPapLinked() {
    if (this.papMesh) this.papMesh.glow.material.color.set(0x6cff5a);
    if (this.telePad) this.telePad.material.color.set(0x6cff5a);
  }
}
