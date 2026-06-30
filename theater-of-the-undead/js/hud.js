// ============ HUD: points, ammo, round, perks, prompts, announcements ============
import * as THREE from 'three';
import { G } from './core.js';
import { PERKS } from './config.js';

const $ = (id) => document.getElementById(id);
const _proj = new THREE.Vector3();

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), points: $('points'), round: $('round'), roundPips: $('round-pips'),
      ammoMag: $('ammo-mag'), ammoRes: $('ammo-res'), weapon: $('weapon-name'),
      ammoWrap: document.querySelector('#ammobox .ammo'),
      perks: $('perks'), grenades: $('grenades'), tacticals: $('tacticals'),
      prompt: $('prompt'), toast: $('toast'), announce: $('announce'),
      vignette: $('vignette'), reticle: $('reticle'), downbar: $('downbar'), downfill: $('down-fill'),
      reloadRing: $('reload-ring'), reloadProg: document.querySelector('#reload-ring .rr-prog'),
    };
    this._toastT = 0; this._annT = 0; this._lastPerks = '';

    // floating points-popup layer (world->screen) + pool of reusable elements
    this.popLayer = document.createElement('div');
    this.popLayer.id = 'pop-layer';
    this.el.hud.appendChild(this.popLayer);
    this.pops = [];
    this._lastPoints = null; this._pointsPulse = 0;
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  // spawn a floating "+N" popup at a world position
  popPoints(worldPos, amount, headshot) {
    if (!G.camera) return;
    _proj.set(worldPos.x, (worldPos.y || 1) + 0.6, worldPos.z).project(G.camera);
    if (_proj.z > 1) return; // behind camera
    const x = (_proj.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-_proj.y * 0.5 + 0.5) * window.innerHeight;
    let el = this.pops.find((p) => p._free);
    if (!el) {
      if (this.pops.length >= 24) { // pool cap: recycle the oldest rather than grow forever
        el = this.pops.shift(); this.pops.push(el);
      } else {
        el = document.createElement('div'); el.className = 'pop'; this.popLayer.appendChild(el); this.pops.push(el);
      }
    }
    el._free = false; el._t = 0.9; el._x = x; el._y = y;
    el.textContent = '+' + amount;
    el.classList.toggle('crit', !!headshot);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.opacity = '1'; el.style.display = 'block';
  }

  flash(text) { const t = this.el.toast; t.textContent = text; t.classList.add('on'); this._toastT = 2.2; }

  announceRound(n, isDog) {
    const a = this.el.announce;
    a.innerHTML = isDog ? `<span class="dog">HELLHOUNDS</span>` : `ROUND ${n}`;
    // retrigger the entrance animation even if already shown
    a.classList.remove('on'); void a.offsetWidth; a.classList.add('on');
    this._annT = 2.4;
    // a beat of screen shake to punch the round change
    if (G.fx) G.fx.shake(isDog ? 0.4 : 0.22);
  }

  update(dt) {
    const p = G.player, r = G.rounds;
    if (!p) return;
    // points readout, with a brief pulse when it changes
    if (this._lastPoints !== p.points) {
      if (this._lastPoints !== null) this._pointsPulse = 1;
      this._lastPoints = p.points;
      this.el.points.textContent = p.points.toLocaleString();
    }
    if (this._pointsPulse > 0) {
      this._pointsPulse = Math.max(0, this._pointsPulse - dt * 4);
      const s = 1 + this._pointsPulse * 0.18;
      this.el.points.style.transform = `scale(${s})`;
      this.el.points.style.color = this._pointsPulse > 0.5 ? '#ffe9a8' : '';
    }
    this.el.round.textContent = r ? r.round : 0;

    // floating points popups: drift up + fade
    for (const el of this.pops) {
      if (el._free) continue;
      el._t -= dt;
      if (el._t <= 0) { el._free = true; el.style.display = 'none'; continue; }
      el._y -= dt * 42;
      el.style.top = el._y + 'px';
      el.style.opacity = Math.min(1, el._t * 1.6);
    }

    const w = p.weapon();
    this.el.weapon.textContent = w.name + (w.papped ? ' ✦' : '');
    if (w.def.mag) {
      this.el.ammoMag.textContent = w.mag; this.el.ammoRes.textContent = w.reserve;
      // flag low ammo (<=25% of the mag, or empty) so the player notices
      if (this.el.ammoWrap) this.el.ammoWrap.classList.toggle('low', w.mag <= Math.max(1, w.def.mag * 0.25));
    } else {
      this.el.ammoMag.textContent = '∞'; this.el.ammoRes.textContent = '';
      if (this.el.ammoWrap) this.el.ammoWrap.classList.remove('low');
    }
    this.el.grenades.textContent = '✸ ' + p.grenades;
    this.el.tacticals.textContent = p.tacticals > 0 ? ('🐵 ' + p.tacticals) : '';

    // perks
    const key = [...p.perks].join(',');
    if (key !== this._lastPerks) {
      this._lastPerks = key;
      this.el.perks.innerHTML = '';
      for (const id of p.perks) {
        const d = document.createElement('div');
        d.className = 'perk'; d.style.background = '#' + PERKS[id].color.toString(16).padStart(6, '0');
        d.textContent = PERKS[id].name[0];
        d.title = PERKS[id].name;
        this.el.perks.appendChild(d);
      }
    }

    // prompt
    this.el.prompt.textContent = p.interactTarget || '';
    this.el.prompt.classList.toggle('on', !!p.interactTarget);

    // damage vignette + down state
    const hpFrac = p.hp / p.maxHp;
    this.el.vignette.style.opacity = p.down ? 0.85 : (1 - hpFrac) * 0.8 + p.hurtFlash * 0.4;
    if (p.down) {
      this.el.downbar.classList.add('on');
      this.el.downfill.style.width = (p.bleed / 4.5 * 100) + '%';
    } else this.el.downbar.classList.remove('on');

    // reload indicator — radial ring above the player, fills as reload completes
    if (p.reloadT > 0 && p.reloadDur > 0 && !p.down && G.camera) {
      const prog = Math.min(1, 1 - p.reloadT / p.reloadDur);
      _proj.set(p.pos.x, p.pos.y + 2.4, p.pos.z).project(G.camera);
      const sx = (_proj.x * 0.5 + 0.5) * window.innerWidth;
      const sy = (-_proj.y * 0.5 + 0.5) * window.innerHeight;
      if (_proj.z < 1 && Number.isFinite(sx) && Number.isFinite(sy)) {
        this.el.reloadRing.style.left = sx + 'px';
        this.el.reloadRing.style.top = sy + 'px';
        this.el.reloadProg.style.setProperty('--p', prog.toFixed(3));
        this.el.reloadRing.classList.add('on');
      } else this.el.reloadRing.classList.remove('on');
    } else this.el.reloadRing.classList.remove('on');

    // reticle
    if (G.input.usingGamepad) this.el.reticle.style.display = 'none';
    else {
      this.el.reticle.style.display = 'block';
      this.el.reticle.style.left = G.input.mouseX + 'px';
      this.el.reticle.style.top = G.input.mouseY + 'px';
    }

    if (this._toastT > 0) { this._toastT -= dt; if (this._toastT <= 0) this.el.toast.classList.remove('on'); }
    if (this._annT > 0) { this._annT -= dt; if (this._annT <= 0) this.el.announce.classList.remove('on'); }
  }
}
