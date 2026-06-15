// ============ unified keyboard + mouse + gamepad -> one per-frame intent ============
import * as THREE from 'three';

const DEAD = 0.22;
const dz = (v) => (Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD));

class Input {
  constructor() {
    this.keys = new Set();         // held codes (kbd + mouse buttons)
    this.pressed = new Set();      // edge: pressed since last endFrame()
    this.mouseX = window.innerWidth / 2;
    this.mouseY = window.innerHeight / 2;
    this.mmbDown = false;
    this.mmbDX = 0;
    this.wheel = 0;
    this.usingGamepad = false;
    this.padIndex = null;
    this.prevPad = [];
    this.anyCallback = null;
    this.intent = {
      moveVec: new THREE.Vector2(),  // raw, caller rotates by camera yaw
      aimVec: new THREE.Vector2(),   // gamepad right stick (screen space)
      fire: false, fireHeld: false,
      interact: false, interactHeld: false,
      reload: false, grenade: false, tactical: false,
      switchWeapon: 0, melee: false,
      cameraRotate: 0, zoom: 0,
      pause: false, start: false,
    };
  }

  init(target) {
    addEventListener('keydown', (e) => {
      if (!e.repeat) { this.keys.add(e.code); this.pressed.add(e.code); }
      this.usingGamepad = false;
      this._fireAny();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mmbDown = false; });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (this.mmbDown) this.mmbDX += e.movementX || 0;
      this.mouseX = e.clientX; this.mouseY = e.clientY; this.usingGamepad = false;
    });
    addEventListener('mousedown', (e) => {
      if (e.button === 1) { this.mmbDown = true; }
      this.keys.add('Mouse' + e.button); this.pressed.add('Mouse' + e.button);
      this.usingGamepad = false; this._fireAny();
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 1) this.mmbDown = false;
      this.keys.delete('Mouse' + e.button);
    });
    addEventListener('click', () => this._fireAny());
    addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    addEventListener('gamepadconnected', (e) => { this.padIndex = e.gamepad.index; this._fireAny(); });
    addEventListener('gamepaddisconnected', () => { this.padIndex = null; });
  }

  _fireAny() { if (this.anyCallback) { const cb = this.anyCallback; this.anyCallback = null; cb(); } }
  onAny(cb) { this.anyCallback = cb; }
  held(...c) { return c.some((x) => this.keys.has(x)); }
  hit(...c) { return c.some((x) => this.pressed.has(x)); }

  // called once per frame BEFORE state.update
  poll() {
    const I = this.intent;
    I.fire = I.interact = I.reload = I.grenade = I.tactical = I.melee = I.pause = I.start = false;
    I.switchWeapon = 0; I.cameraRotate = 0; I.zoom = 0;

    // ---- keyboard + mouse ----
    let kx = 0, kz = 0;
    if (this.held('KeyW')) kz += 1;
    if (this.held('KeyS')) kz -= 1;
    if (this.held('KeyA')) kx -= 1;
    if (this.held('KeyD')) kx += 1;
    if (this.held('ArrowLeft')) I.cameraRotate += 1;
    if (this.held('ArrowRight')) I.cameraRotate -= 1;
    if (this.mmbDown && this.mmbDX) { I.cameraRotate += this.mmbDX * 0.18; this.mmbDX = 0; }
    I.fireHeld = this.held('Mouse0');
    if (this.hit('Mouse0')) I.fire = true;
    I.interactHeld = this.held('KeyF', 'KeyE');
    if (this.hit('KeyF', 'KeyE')) I.interact = true;
    if (this.hit('KeyR')) I.reload = true;
    if (this.hit('KeyG', 'Mouse2')) I.grenade = true;
    if (this.hit('KeyT')) I.tactical = true;
    if (this.hit('KeyV', 'KeyC')) I.melee = true;
    if (this.hit('KeyQ', 'Tab')) I.switchWeapon = 1;
    if (this.hit('KeyP', 'Escape')) I.pause = true;
    if (this.hit('Enter', 'Space')) I.start = true;
    if (this.wheel) { I.zoom = -this.wheel; this.wheel = 0; }

    // ---- gamepad ----
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = this.padIndex != null ? pads[this.padIndex] : null;
    if (!gp) for (const p of pads) if (p) { gp = p; this.padIndex = p.index; break; }
    let gx = 0, gz = 0;
    if (gp) {
      const ax = dz(gp.axes[0] || 0), ay = dz(gp.axes[1] || 0);
      const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
      gx = ax; gz = -ay;
      I.aimVec.set(rx, ry);
      if (Math.abs(ax) + Math.abs(ay) + Math.abs(rx) + Math.abs(ry) > 0.05) this.usingGamepad = true;
      const b = gp.buttons, p = this.prevPad;
      const down = (i) => b[i] && b[i].pressed;
      const edge = (i) => b[i] && b[i].pressed && !p[i];
      if (down(7) || down(5)) { I.fireHeld = true; this.usingGamepad = true; }
      if (edge(7) || edge(5)) I.fire = true;
      if (edge(0)) { I.interact = true; I.start = true; }
      if (down(0)) I.interactHeld = true;
      if (edge(2)) I.reload = true;
      if (edge(1)) I.melee = true;
      if (edge(6) || edge(4)) I.grenade = true;
      if (edge(3)) I.tactical = true;
      if (edge(10)) I.switchWeapon = 1;
      if (edge(9)) I.pause = true;
      if (edge(9)) I.start = true;
      if (down(14)) I.cameraRotate += 1;
      if (down(15)) I.cameraRotate -= 1;
      if (down(12)) I.zoom += 1;
      if (down(13)) I.zoom -= 1;
      if (edge(0) || edge(9)) this._fireAny();
      this.prevPad = b.map((x) => !!x.pressed);
    }

    // ---- merge: gamepad sticks take precedence when present ----
    let mx = gx || kx, mz = gz || kz;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    I.moveVec.set(mx, mz);
  }

  endFrame() { this.pressed.clear(); }
}

export const input = new Input();
