// ============ overhead RuneScape-style orbit camera + twin-stick aim ============
import * as THREE from 'three';
import { clamp, damp } from './core.js';

export class CamRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI;
    this.pitch = 0.95;     // ~54deg down
    this.dist = 13;
    this.target = new THREE.Vector3();
    this.aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0); // y = 1.0
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this._eye = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this.aimPoint = new THREE.Vector3(0, 1, 1);
    this.aimDir = new THREE.Vector2(0, 1);
  }

  snapTo(player) {
    this._look.copy(player.pos); this._look.y += 1.0;
    this.target.copy(this._look);
  }

  update(dt, intent, player) {
    this.yaw += intent.cameraRotate * 1.8 * dt;
    this.dist = clamp(this.dist - intent.zoom * 9 * dt, 7, 17);
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this._eye.set(Math.sin(this.yaw) * cp * this.dist, sp * this.dist, Math.cos(this.yaw) * cp * this.dist);
    this._look.copy(player.pos); this._look.y += 1.0;
    this.target.lerp(this._look, damp(dt, 12));
    this.camera.position.copy(this.target).add(this._eye);
    this.camera.lookAt(this.target);
  }

  // resolve world-space aim direction (XZ) from mouse or right stick
  resolveAim(input, player) {
    const intent = input.intent;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    if (input.usingGamepad && intent.aimVec.lengthSq() > 0.04) {
      const x = intent.aimVec.x;       // stick right
      const z = -intent.aimVec.y;      // stick up -> forward
      const wx = -z * s + x * c;       // match camera-relative basis (forward=(-sin,-cos), right=(cos,-sin))
      const wz = -z * c - x * s;
      this.aimDir.set(wx, wz).normalize();
      this.aimPoint.set(player.pos.x + wx * 8, 1, player.pos.z + wz * 8);
    } else {
      this.ndc.x = (input.mouseX / window.innerWidth) * 2 - 1;
      this.ndc.y = -(input.mouseY / window.innerHeight) * 2 + 1;
      this.ray.setFromCamera(this.ndc, this.camera);
      const hit = this.ray.ray.intersectPlane(this.aimPlane, this.aimPoint);
      if (hit) {
        let dx = this.aimPoint.x - player.pos.x, dz = this.aimPoint.z - player.pos.z;
        const len = Math.hypot(dx, dz);
        if (len > 0.001) {
          // clamp aim distance so it never flips behind camera
          const cl = clamp(len, 0.5, 50);
          dx = dx / len * cl; dz = dz / len * cl;
          this.aimPoint.set(player.pos.x + dx, 1, player.pos.z + dz);
          this.aimDir.set(dx, dz).normalize();
        }
      }
    }
    return this.aimDir;
  }
}
