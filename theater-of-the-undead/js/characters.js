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

export function poseSurvivor(s, dt, moving, aiming) {
  s.phase += dt * (moving ? 9 : 2);
  const sw = Math.sin(s.phase) * 0.7 * (moving ? 1 : 0.12);
  const p = s.parts;
  p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
  p.armL.rotation.x = -sw * 0.7;
  // right arm points the gun forward when aiming
  const target = aiming ? -1.45 : -sw * 0.7;
  p.armR.rotation.x += (target - p.armR.rotation.x) * Math.min(1, dt * 18);
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

  return { group: g, parts: { lFL, lFR, lBL, lBR }, flash, phase: Math.random() * 6 };
}

export function poseDog(d, dt, speed) {
  d.phase += dt * (8 + speed * 1.5);
  const sw = Math.sin(d.phase) * 0.7;
  const p = d.parts;
  p.lFL.rotation.x = sw; p.lBR.rotation.x = sw;
  p.lFR.rotation.x = -sw; p.lBL.rotation.x = -sw;
}
