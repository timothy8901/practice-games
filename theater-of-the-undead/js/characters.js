// ============ procedural low-poly humanoids (player, zombie) + dog ============
import * as THREE from 'three';
import { zombieSkin } from './textures.js';

const GEO = {};
function box(key, w, h, d) { return (GEO[key] ||= new THREE.BoxGeometry(w, h, d)); }
function mat(color, flat = false) { return new THREE.MeshLambertMaterial({ color, flatShading: flat }); }

// ---- player / survivor ----
export function buildSurvivor(def) {
  const g = new THREE.Group();
  const sk = mat(def.skin), cl = mat(def.cloth), ac = mat(def.accent), bt = mat(0x1a1614);

  const torso = new THREE.Mesh(box('torso', 0.6, 0.64, 0.34), cl); torso.position.y = 1.2; g.add(torso);
  const vest = new THREE.Mesh(box('vest', 0.5, 0.44, 0.38), ac); vest.position.y = 1.16; g.add(vest);
  const head = new THREE.Mesh(box('head', 0.34, 0.34, 0.32), sk); head.position.y = 1.64; g.add(head);
  const hat = new THREE.Mesh(box('hat', 0.4, 0.16, 0.42), ac); hat.position.y = 1.85; g.add(hat);

  const mkLeg = (x) => {
    const leg = new THREE.Group(); leg.position.set(x, 0.9, 0);
    const m = new THREE.Mesh(box('leg', 0.22, 0.9, 0.26), cl); m.position.y = -0.45; leg.add(m);
    const f = new THREE.Mesh(box('foot', 0.24, 0.16, 0.36), bt); f.position.set(0, -0.92, 0.05); leg.add(f);
    g.add(leg); return leg;
  };
  const legL = mkLeg(-0.15), legR = mkLeg(0.15);

  const mkArm = (x) => {
    const arm = new THREE.Group(); arm.position.set(x, 1.46, 0);
    const m = new THREE.Mesh(box('arm', 0.17, 0.66, 0.18), cl); m.position.y = -0.33; arm.add(m);
    const hand = new THREE.Mesh(box('hand', 0.18, 0.18, 0.2), sk); hand.position.y = -0.66; arm.add(hand);
    g.add(arm); return arm;
  };
  const armL = mkArm(-0.34), armR = mkArm(0.34);

  // gun in the right hand
  const gun = new THREE.Group(); gun.position.set(0, -0.62, 0.12);
  const body = new THREE.Mesh(box('gunbody', 0.12, 0.16, 0.5), mat(0x222426)); body.position.z = 0.12; gun.add(body);
  const barrel = new THREE.Mesh(box('gunbarrel', 0.07, 0.07, 0.4), mat(0x15171b)); barrel.position.z = 0.42; gun.add(barrel);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 0.62); gun.add(muzzle);
  armR.add(gun);

  return { group: g, parts: { legL, legR, armL, armR, torso, head, gun, muzzle }, phase: 0 };
}

export function poseSurvivor(s, dt, moving, aiming, recoil = 0, meleeSwing = 0) {
  s.phase += dt * (moving ? 9 : 2);
  const sw = Math.sin(s.phase) * 0.7 * (moving ? 1 : 0.12);
  const p = s.parts;
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  p.armL.rotation.x = -sw * 0.7;
  // right arm points the gun forward when aiming; recoil snaps it up, melee jabs it out
  let target = aiming ? -1.45 : -sw * 0.7;
  if (meleeSwing > 0) target = -1.45 - meleeSwing * 0.9;       // forward jab
  else target += recoil * 0.45;                                // muzzle climb
  p.armR.rotation.x += (target - p.armR.rotation.x) * Math.min(1, dt * 24);
  // gun nudges back along its barrel on recoil for a touch of kick
  if (p.gun) p.gun.position.z = 0.12 - recoil * 0.12;
}

// ---- zombie (own materials so we can flash on hit) ----
const _zskin = () => mat(0x4f6a44);
export function buildZombie() {
  const g = new THREE.Group();
  const skinTex = zombieSkin();
  const skinMat = new THREE.MeshLambertMaterial({ color: 0x9fb38a, map: skinTex });
  const clothMat = new THREE.MeshLambertMaterial({ color: 0x3a3a44 });
  const flash = [skinMat, clothMat];

  const torso = new THREE.Mesh(box('torso', 0.58, 0.62, 0.32), clothMat); torso.position.y = 1.18; g.add(torso);
  const head = new THREE.Mesh(box('zhead', 0.32, 0.34, 0.32), skinMat); head.position.set(0, 1.6, 0.02); head.rotation.z = 0.12; g.add(head);
  // faintly glowing dead eyes for atmosphere (own material, kept dim).
  // children of head -> positions are local to the head's center.
  const zeyeMat = new THREE.MeshBasicMaterial({ color: 0x7a3022, fog: false });
  const eL = new THREE.Mesh(box('zeye', 0.06, 0.05, 0.03), zeyeMat); eL.position.set(-0.08, 0.02, 0.17); head.add(eL);
  const eR = new THREE.Mesh(box('zeye', 0.06, 0.05, 0.03), zeyeMat); eR.position.set(0.08, 0.02, 0.17); head.add(eR);

  const mkLeg = (x) => {
    const leg = new THREE.Group(); leg.position.set(x, 0.9, 0);
    const m = new THREE.Mesh(box('zleg', 0.2, 0.9, 0.24), clothMat); m.position.y = -0.45; leg.add(m);
    g.add(leg); return leg;
  };
  const legL = mkLeg(-0.14), legR = mkLeg(0.14);

  const mkArm = (x) => {
    const arm = new THREE.Group(); arm.position.set(x, 1.44, 0);
    const m = new THREE.Mesh(box('zarm', 0.15, 0.66, 0.16), skinMat); m.position.y = -0.33; arm.add(m);
    arm.rotation.x = -1.4; // reaching forward
    g.add(arm); return arm;
  };
  const armL = mkArm(-0.32), armR = mkArm(0.32);

  return { group: g, parts: { legL, legR, armL, armR, torso, head }, flash, phase: Math.random() * 6 };
}

export function poseZombie(z, dt, speed) {
  z.phase += dt * (5 + speed);
  const sw = Math.sin(z.phase) * 0.55;
  const p = z.parts;
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  p.armL.rotation.x = -1.4 + Math.sin(z.phase * 0.9) * 0.18;
  p.armR.rotation.x = -1.4 + Math.cos(z.phase * 0.9) * 0.18;
  z.group.rotation.z = Math.sin(z.phase * 0.5) * 0.06; // shamble lean
}

// ---- hellhound (quadruped) ----
export function buildDog() {
  const g = new THREE.Group();
  const fur = new THREE.MeshLambertMaterial({ color: 0x2a2622 });
  const eye = new THREE.MeshBasicMaterial({ color: 0xff5a2a, fog: false });
  const flash = [fur];
  const eyeMat = eye;

  const body = new THREE.Mesh(box('dbody', 0.4, 0.4, 0.9), fur); body.position.y = 0.5; g.add(body);
  const head = new THREE.Mesh(box('dhead', 0.34, 0.34, 0.34), fur); head.position.set(0, 0.6, 0.6); g.add(head);
  const snout = new THREE.Mesh(box('dsnout', 0.18, 0.16, 0.2), fur); snout.position.set(0, 0.54, 0.82); g.add(snout);
  const eL = new THREE.Mesh(box('deye', 0.06, 0.06, 0.04), eye); eL.position.set(-0.09, 0.66, 0.78); g.add(eL);
  const eR = eL.clone(); eR.position.x = 0.09; g.add(eR);
  const tail = new THREE.Mesh(box('dtail', 0.1, 0.1, 0.4), fur); tail.position.set(0, 0.6, -0.55); tail.rotation.x = 0.6; g.add(tail);

  const mkLeg = (x, z) => {
    const leg = new THREE.Group(); leg.position.set(x, 0.4, z);
    const m = new THREE.Mesh(box('dleg', 0.12, 0.4, 0.12), fur); m.position.y = -0.2; leg.add(m);
    g.add(leg); return leg;
  };
  const lFL = mkLeg(-0.15, 0.32), lFR = mkLeg(0.15, 0.32), lBL = mkLeg(-0.15, -0.32), lBR = mkLeg(0.15, -0.32);

  return { group: g, parts: { lFL, lFR, lBL, lBR }, flash, eyeMat, phase: Math.random() * 6 };
}

export function poseDog(d, dt, speed) {
  d.phase += dt * (8 + speed * 1.5);
  const sw = Math.sin(d.phase) * 0.7;
  const p = d.parts;
  p.lFL.rotation.x = sw; p.lBR.rotation.x = sw;
  p.lFR.rotation.x = -sw; p.lBL.rotation.x = -sw;
  // menacing eye flicker — telegraphs the fast threat
  if (d.eyeMat) { const f = 0.6 + Math.abs(Math.sin(d.phase * 1.7)) * 0.5; d.eyeMat.color.setRGB(f, f * 0.28, f * 0.12); }
}

// ---- Pokémon survivor: a pixel-sprite billboard that carries the gun ----
// The plane always faces the camera (yaw only, so the feet stay on the floor). It swaps
// between the front and back sprite by which way the Pokémon is aiming relative to the
// camera and mirrors left/right, so one pair of PokeAPI sprites reads as four directions.
// Sprites stream in asynchronously; a type-coloured token stands in until they arrive.
const TEXCACHE = new Map();   // url -> { tex, aspect, failed, waiters }

function pixelTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  // crisp when magnified; mipmapped when minified so a far-away sprite averages down to a clean
  // silhouette instead of a noisy smudge (the low-res render target re-pixelates it anyway)
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// crop the transparent border so every sprite stands on its feet at a consistent size
function trimmed(img) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, W, H).data;   // throws on a tainted (non-CORS) image -> caller falls back
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) {
    if (d[(y * W + i) * 4 + 3] > 16) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return { canvas: c, aspect: W / H };
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const t = document.createElement('canvas'); t.width = w; t.height = h;
  t.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
  return { canvas: t, aspect: w / h };
}

export function loadSpriteTex(url, cb) {
  let e = TEXCACHE.get(url);
  if (e) { if (e.tex) cb(e); else if (!e.failed) e.waiters.push(cb); return; }
  e = { tex: null, aspect: 1, failed: false, waiters: [cb] };
  TEXCACHE.set(url, e);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try { const t = trimmed(img); e.tex = pixelTex(t.canvas); e.aspect = t.aspect; } catch (err) { e.failed = true; }
    const w = e.waiters; e.waiters = [];
    if (e.tex) for (const f of w) f(e);
  };
  img.onerror = () => { e.failed = true; e.waiters = []; };
  img.src = url;
}

function tokenCanvas(def) {
  const size = 48, c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  x.fillStyle = '#' + (def.color || 0x888888).toString(16).padStart(6, '0');
  x.beginPath(); x.arc(size / 2, size * 0.54, size * 0.36, 0, Math.PI * 2); x.fill();
  x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke();
  x.fillStyle = '#fff'; x.font = 'bold 20px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText((def.name || '?')[0], size / 2, size * 0.56);
  return c;
}

function applyFace(s) {
  const e = s.faces[s.cur] || s.faces.front || s.faces.back;
  if (e) { s.parts.body.material.map = e.tex; s.aspect = e.aspect; }
  s.parts.body.material.needsUpdate = true;
  s.parts.body.scale.set(s.H * s.aspect * s.mirror, s.H, 1);
  if (s.parts.shadow) s.parts.shadow.scale.set(Math.max(0.3, s.H * s.aspect * 0.42), Math.max(0.2, s.H * s.aspect * 0.26), 1);
}

// standing sprites tip their top this far AWAY from the overhead camera (negative X), which turns
// the plane's face up toward it — like a card on a stand — so it isn't foreshortened flat
export const POKE_LEAN = -0.45;

export function buildPokemon(def) {
  const g = new THREE.Group();
  const lunge = new THREE.Group(); g.add(lunge);          // slides forward on a knife swing
  const pivot = new THREE.Group(); lunge.add(pivot);      // billboard yaw + run bob
  const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0);   // feet at the origin
  const fallback = pixelTex(tokenCanvas(def));
  const bodyMat = new THREE.MeshLambertMaterial({ map: fallback, alphaTest: 0.5, side: THREE.DoubleSide, emissive: 0x141414 });
  const body = new THREE.Mesh(geo, bodyMat); body.rotation.x = POKE_LEAN; pivot.add(body);
  const H = def.height || 1.6;
  // soft ground shadow anchors the billboard to the floor
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 14), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; shadow.scale.set(H * 0.3, H * 0.2, 1); shadow.renderOrder = 1; lunge.add(shadow);
  const s = { group: g, parts: { body, pivot, lunge, shadow, gun: null, muzzle: null }, phase: 0, kind: 'pokemon', def,
    H, faces: { front: null, back: null }, cur: 'front', _face: 'front', mirror: 1, fallback, aspect: 0.9 };
  body.scale.set(H * s.aspect, H, 1);

  // gun carried at the hip; barrel along +Z so it points down the aim once the group is yawed
  const gun = new THREE.Group(); gun.position.set(Math.min(0.5, H * 0.28), H * 0.42, 0.15);
  const gb = new THREE.Mesh(box('gunbody', 0.12, 0.16, 0.5), mat(0x222426)); gb.position.z = 0.12; gun.add(gb);
  const gbar = new THREE.Mesh(box('gunbarrel', 0.07, 0.07, 0.4), mat(0x15171b)); gbar.position.z = 0.42; gun.add(gbar);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 0.62); gun.add(muzzle);
  lunge.add(gun); s.parts.gun = gun; s.parts.muzzle = muzzle; s.gunBase = gun.position.clone();

  if (def.sprite) loadSpriteTex(def.sprite, (e) => { s.faces.front = e; applyFace(s); });
  if (def.spriteBack) loadSpriteTex(def.spriteBack, (e) => { s.faces.back = e; applyFace(s); });
  return s;
}

// camYaw/yaw: camera azimuth and the Pokémon's aim yaw (world); down: crawling pose
export function posePokemon(s, dt, moving, aiming, recoil = 0, meleeSwing = 0, camYaw = 0, yaw = 0, down = false) {
  s.phase += dt * (moving ? 11 : 2);
  const p = s.parts;
  // cancel the group's yaw, then face the camera's azimuth
  p.pivot.rotation.y = camYaw - yaw;
  // front sprite when facing the camera, back sprite when facing away — with hysteresis so it never flickers
  const rel = yaw - camYaw, c = Math.cos(rel), sn = Math.sin(rel);
  if (s.cur === 'front' && c < -0.15 && s.faces.back) s.cur = 'back';
  else if (s.cur === 'back' && (c > 0.15 || !s.faces.back)) s.cur = 'front';
  const m = s.mirror;
  const want = s.cur === 'front' ? (sn > 0.2 ? -1 : sn < -0.2 ? 1 : m) : (sn < -0.2 ? -1 : sn > 0.2 ? 1 : m);
  if (want !== s.mirror || s._face !== s.cur) { s.mirror = want; s._face = s.cur; applyFace(s); }
  // run bob + a little lean; lunge on a knife swing; the gun kicks back on recoil
  const bob = moving ? Math.abs(Math.sin(s.phase)) * 0.08 : Math.sin(s.phase) * 0.012;
  p.pivot.position.y = down ? 0 : bob;
  p.body.rotation.z = moving && !down ? Math.sin(s.phase) * 0.05 : 0;
  // downed: all the way back so it lies face-up on the floor
  p.body.rotation.x += ((down ? -1.35 : POKE_LEAN) - p.body.rotation.x) * Math.min(1, dt * 10);
  p.lunge.position.z = meleeSwing * 0.35;
  p.gun.position.z = s.gunBase.z - recoil * 0.14;
  p.gun.visible = !down;
  p.body.material.color.setHex(down ? 0x8a5a5a : 0xffffff);
}

// free a survivor model when the player swaps characters (shared box geometry and cached
// sprite textures stay alive; per-model materials and the sprite plane go)
export function disposeModel(m) {
  if (!m) return;
  m.group.traverse((o) => { if (o.isMesh && o.material) o.material.dispose(); });
  if (m.kind === 'pokemon') { m.parts.body.geometry.dispose(); if (m.parts.shadow) m.parts.shadow.geometry.dispose(); if (m.fallback) m.fallback.dispose(); }
}
