// ============ tiny nearest-filter procedural textures (OSRS look) ============
import * as THREE from 'three';

// fixed muted RuneScape-ish palette; every fill is quantized to one of these
export const PAL = [
  '#1a1614', '#2a2420', '#3a3128', '#4a3f30', '#5c4d38', '#6e5c42',
  '#857049', '#9a8456', '#3d3a32', '#55524a', '#6f6b60', '#8a8578',
  '#2a3a2a', '#3c5036', '#4f6a44', '#6b3030', '#883a3a', '#a14545',
  '#2c3848', '#3a4a5e', '#506a52', '#7a6b4a', '#9b8a5a', '#b8a878',
  '#15171b', '#202428', '#30343a', '#0a0a12', '#c0b090', '#d8c8a0',
];

const _pc = PAL.map((h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
});
export function quantize(r, g, b) {
  let bi = 0, bd = 1e9;
  for (let i = 0; i < _pc.length; i++) {
    const dr = r - _pc[i][0], dg = g - _pc[i][1], db = b - _pc[i][2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bd) { bd = d; bi = i; }
  }
  return PAL[bi];
}

function make(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapNearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 1;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const jitter = (hex, amt) => {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const j = (Math.random() * 2 - 1) * amt;
  r = Math.max(0, Math.min(255, r + j));
  g = Math.max(0, Math.min(255, g + j));
  b = Math.max(0, Math.min(255, b + j));
  return quantize(r, g, b);
};

const cache = {};
function cached(key, fn) { return (cache[key] ||= fn()); }

export function cobble() {
  return cached('cobble', () => make(64, (g, s) => {
    g.fillStyle = '#202428'; g.fillRect(0, 0, s, s);
    const n = 4, cell = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const ox = (y % 2) * cell * 0.5;
      g.fillStyle = jitter('#55524a', 22);
      g.fillRect(x * cell + ox + 1, y * cell + 1, cell - 3, cell - 3);
      g.fillStyle = jitter('#6f6b60', 18);
      g.fillRect(x * cell + ox + 2, y * cell + 2, cell - 6, 2);
    }
  }));
}

export function wood() {
  return cached('wood', () => make(64, (g, s) => {
    for (let x = 0; x < s; x += 8) {
      g.fillStyle = jitter('#5c4d38', 18);
      g.fillRect(x, 0, 8, s);
      g.fillStyle = jitter('#3a3128', 10);
      g.fillRect(x, 0, 1, s);
      if (Math.random() < 0.4) { g.fillStyle = '#2a2420'; g.fillRect(x + 3, Math.random() * s | 0, 2, 3); }
    }
  }));
}

export function plank() {
  return cached('plank', () => make(32, (g, s) => {
    g.fillStyle = '#4a3f30'; g.fillRect(0, 0, s, s);
    for (let y = 2; y < s; y += 6) { g.fillStyle = jitter('#6e5c42', 14); g.fillRect(0, y, s, 4); }
    g.fillStyle = '#2a2420'; g.fillRect(0, 0, s, 1);
  }));
}

export function carpet() {
  return cached('carpet', () => make(32, (g, s) => {
    g.fillStyle = '#6b3030'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) for (let x = 0; x < s; x += 4) {
      if ((x + y) % 8 === 0) { g.fillStyle = jitter('#883a3a', 14); g.fillRect(x, y, 4, 4); }
    }
    g.fillStyle = '#a14545';
    for (let i = 0; i < s; i += 8) { g.fillRect(i, 0, 2, s); }
  }));
}

export function brick() {
  return cached('brick', () => make(64, (g, s) => {
    g.fillStyle = '#3a3128'; g.fillRect(0, 0, s, s);
    const bh = 8, bw = 16;
    for (let y = 0, r = 0; y < s; y += bh, r++) {
      const ox = (r % 2) * (bw / 2);
      for (let x = -bw; x < s; x += bw) {
        g.fillStyle = jitter('#5c4d38', 16);
        g.fillRect(x + ox + 1, y + 1, bw - 2, bh - 2);
        g.fillStyle = jitter('#6e5c42', 10);
        g.fillRect(x + ox + 1, y + 1, bw - 2, 1);
      }
    }
  }));
}

export function plaster() {
  return cached('plaster', () => make(32, (g, s) => {
    g.fillStyle = '#55524a'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = jitter('#6f6b60', 12);
      g.fillRect(Math.random() * s | 0, Math.random() * s | 0, 1, 1);
    }
  }));
}

export function zombieSkin() {
  return cached('zskin', () => make(32, (g, s) => {
    g.fillStyle = '#4f6a44'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 50; i++) {
      g.fillStyle = jitter(Math.random() < 0.7 ? '#3c5036' : '#883a3a', 14);
      g.fillRect(Math.random() * s | 0, Math.random() * s | 0, 2, 2);
    }
  }));
}
