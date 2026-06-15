// ============ pooled particles, electric bolts, rings, camera shake ============
import * as THREE from 'three';

const MAX_P = 3000;
const CTMP = new THREE.Color();

function squareTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 4;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 4, 4);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  return t;
}

const BOLT_SLOTS = 10, BOLTS_PER = 6, SEGS = 7;

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.trauma = 0;
    this.time = 0;
    this.pos = new Float32Array(MAX_P * 3);
    this.vel = new Float32Array(MAX_P * 3);
    this.col = new Float32Array(MAX_P * 3);
    this.size = new Float32Array(MAX_P);
    this.alpha = new Float32Array(MAX_P);
    this.life = new Float32Array(MAX_P);
    this.maxLife = new Float32Array(MAX_P);
    this.grav = new Float32Array(MAX_P);
    this.drag = new Float32Array(MAX_P);
    this.head = 0;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: squareTex() } },
      vertexShader: `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        varying vec3 vColor; varying float vAlpha;
        void main(){ vColor=aColor; vAlpha=aAlpha;
          vec4 mv = modelViewMatrix * vec4(position,1.0);
          gl_PointSize = aSize * (300.0 / max(0.1, -mv.z));
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        uniform sampler2D uTex; varying vec3 vColor; varying float vAlpha;
        void main(){ vec4 t=texture2D(uTex, gl_PointCoord);
          if (t.a < 0.5) discard;
          gl_FragColor = vec4(vColor, vAlpha); }`,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 30;
    scene.add(this.points);

    // electric bolts (additive — the one glow we keep)
    this.bolts = [];
    for (let i = 0; i < BOLT_SLOTS; i++) {
      const bg = new THREE.BufferGeometry();
      const arr = new Float32Array(BOLTS_PER * SEGS * 2 * 3);
      bg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const bm = new THREE.LineBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const mesh = new THREE.LineSegments(bg, bm);
      mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 32;
      scene.add(mesh);
      this.bolts.push({ mesh, arr, t: 1, dur: 1, paths: [], c: new THREE.Color() });
    }

    // expanding rings (power-up pickups, nuke)
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.9, 1.0, 32);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false }));
      m.visible = false; m.renderOrder = 31; m.rotation.x = -Math.PI / 2;
      scene.add(m);
      this.rings.push({ mesh: m, t: 1, dur: 1, r0: 1, r1: 2, op: 0.9 });
    }
  }

  spawn(px, py, pz, vx, vy, vz, r, g, b, size, life, grav = 0, drag = 0) {
    const i = this.head; this.head = (this.head + 1) % MAX_P;
    const i3 = i * 3;
    this.pos[i3] = px; this.pos[i3 + 1] = py; this.pos[i3 + 2] = pz;
    this.vel[i3] = vx; this.vel[i3 + 1] = vy; this.vel[i3 + 2] = vz;
    this.col[i3] = r; this.col[i3 + 1] = g; this.col[i3 + 2] = b;
    this.size[i] = size; this.life[i] = life; this.maxLife[i] = life; this.alpha[i] = 1;
    this.grav[i] = grav; this.drag[i] = drag;
  }

  burst(p, color, { count = 12, speed = 5, life = 0.5, size = 0.3, up = 1, gravity = -8, spread = 1, drag = 1.5, jitter = 0 } = {}) {
    const base = CTMP.set(color);
    const br = base.r, bg = base.g, bb = base.b;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const el = (Math.random() - 0.35) * Math.PI * spread;
      const s = speed * (0.35 + Math.random() * 0.85);
      const j = jitter ? (Math.random() - 0.5) * jitter : 0;
      this.spawn(p.x, p.y, p.z,
        Math.cos(a) * Math.cos(el) * s, Math.sin(el) * s + up, Math.sin(a) * Math.cos(el) * s,
        Math.min(1, br + j), Math.min(1, bg + j), Math.min(1, bb + j),
        size * (0.6 + Math.random() * 0.9), life * (0.6 + Math.random() * 0.8), gravity, drag);
    }
  }

  blood(p, n = 10) { this.burst(p, 0x6b1414, { count: n, speed: 5, life: 0.5, size: 0.28, up: 2, gravity: -14, drag: 1, jitter: 0.05 }); }
  gib(p) {
    this.burst(p, 0x6b1414, { count: 22, speed: 7, life: 0.8, size: 0.4, up: 4, gravity: -16, drag: 0.6, jitter: 0.06 });
    this.burst(p, 0x3c5036, { count: 8, speed: 4, life: 0.7, size: 0.34, up: 3, gravity: -14, drag: 1 });
  }
  splinter(p) { this.burst(p, 0x6e5c42, { count: 8, speed: 4, life: 0.5, size: 0.22, up: 2, gravity: -16, drag: 1 }); }
  spark(p, color = 0xffd23f, n = 6) { this.burst(p, color, { count: n, speed: 8, life: 0.25, size: 0.16, up: 1, gravity: -20, drag: 0.6 }); }
  muzzle(p, color = 0xffe08a) { this.burst(p, color, { count: 4, speed: 3, life: 0.1, size: 0.3, up: 0.2, gravity: 0, drag: 6 }); }

  bolts(p, color = 0x9fdcff, { count = 5, radius = 3, dur = 0.26 } = {}) {
    const slot = this.bolts.find((b) => b.t >= b.dur) || this.bolts[0];
    slot.t = 0; slot.dur = dur; slot.c.set(color); slot.paths.length = 0;
    const n = Math.min(BOLTS_PER, count);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = radius * (0.5 + Math.random() * 0.7);
      slot.paths.push({ ax: p.x, ay: p.y + 0.4, az: p.z, bx: p.x + Math.cos(a) * r, by: 0.2 + Math.random() * 1.6, bz: p.z + Math.sin(a) * r });
    }
    slot.mesh.visible = true;
    this._jitter(slot);
  }
  _jitter(slot) {
    const arr = slot.arr; let w = 0;
    for (const path of slot.paths) {
      const dx = path.bx - path.ax, dy = path.by - path.ay, dz = path.bz - path.az;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz), amp = len * 0.18;
      let px = path.ax, py = path.ay, pz = path.az;
      for (let s = 1; s <= SEGS; s++) {
        const k = s / SEGS, env = Math.sin(k * Math.PI) * amp;
        let nx = path.ax + dx * k + (Math.random() - 0.5) * 2 * env;
        let ny = path.ay + dy * k + (Math.random() - 0.5) * 2 * env;
        let nz = path.az + dz * k + (Math.random() - 0.5) * 2 * env;
        if (s === SEGS) { nx = path.bx; ny = path.by; nz = path.bz; }
        arr[w++] = px; arr[w++] = py; arr[w++] = pz;
        arr[w++] = nx; arr[w++] = ny; arr[w++] = nz;
        px = nx; py = ny; pz = nz;
      }
    }
    slot.mesh.geometry.setDrawRange(0, w / 3);
    slot.mesh.geometry.attributes.position.needsUpdate = true;
  }

  ring(p, color, { r0 = 0.4, r1 = 4, dur = 0.5, opacity = 0.9 } = {}) {
    const slot = this.rings.find((r) => r.t >= r.dur) || this.rings[0];
    slot.t = 0; slot.dur = dur; slot.r0 = r0; slot.r1 = r1; slot.op = opacity;
    slot.mesh.visible = true; slot.mesh.position.set(p.x, 0.1, p.z); slot.mesh.material.color.set(color);
  }

  shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }
  applyShake(camera, dt) {
    if (this.trauma <= 0) return;
    const t = this.time * 30, s = this.trauma * this.trauma;
    camera.position.x += (Math.sin(t * 1.3) + Math.sin(t * 2.7) * 0.5) * 0.18 * s;
    camera.position.z += (Math.sin(t * 1.7 + 4) + Math.sin(t * 3.1) * 0.5) * 0.15 * s;
    this.trauma = Math.max(0, this.trauma - dt * 1.7);
  }

  update(dt) {
    this.time += dt;
    for (let i = 0; i < MAX_P; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const i3 = i * 3;
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      const dragF = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= dragF; this.vel[i3 + 1] *= dragF; this.vel[i3 + 2] *= dragF;
      this.vel[i3 + 1] += this.grav[i] * dt;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.05) { this.pos[i3 + 1] = 0.05; this.vel[i3 + 1] *= -0.3; }
      this.alpha[i] = Math.min(1, this.life[i] / (this.maxLife[i] * 0.5));
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;

    for (const b of this.bolts) {
      if (b.t >= b.dur) { b.mesh.visible = false; continue; }
      b.t += dt;
      const k = Math.min(1, b.t / b.dur);
      this._jitter(b);
      b.mesh.material.color.copy(b.c);
      b.mesh.material.opacity = (1 - k) * (0.6 + 0.4 * Math.random());
      b.mesh.visible = true;
    }
    for (const r of this.rings) {
      if (r.t >= r.dur) { r.mesh.visible = false; continue; }
      r.t += dt;
      const k = Math.min(1, r.t / r.dur), e = 1 - Math.pow(1 - k, 3);
      const rad = r.r0 + (r.r1 - r.r0) * e;
      r.mesh.scale.set(rad, rad, rad);
      r.mesh.material.opacity = r.op * (1 - k);
      r.mesh.visible = true;
    }
  }

  clear() {
    this.life.fill(0); this.alpha.fill(0);
    for (const b of this.bolts) { b.t = b.dur; b.mesh.visible = false; }
    for (const r of this.rings) { r.t = r.dur; r.mesh.visible = false; }
    this.trauma = 0;
  }
}
