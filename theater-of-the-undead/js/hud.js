// ============ HUD: points, ammo, round, perks, prompts, announcements ============
import { G } from './core.js';
import { PERKS } from './config.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      hud: $('hud'), points: $('points'), round: $('round'), roundPips: $('round-pips'),
      ammoMag: $('ammo-mag'), ammoRes: $('ammo-res'), weapon: $('weapon-name'),
      perks: $('perks'), grenades: $('grenades'), tacticals: $('tacticals'),
      prompt: $('prompt'), toast: $('toast'), announce: $('announce'),
      vignette: $('vignette'), reticle: $('reticle'), downbar: $('downbar'), downfill: $('down-fill'),
    };
    this._toastT = 0; this._annT = 0; this._lastPerks = '';
  }

  show() { this.el.hud.classList.remove('hidden'); }
  hide() { this.el.hud.classList.add('hidden'); }

  flash(text) { const t = this.el.toast; t.textContent = text; t.classList.add('on'); this._toastT = 2.2; }

  announceRound(n, isDog) {
    const a = this.el.announce;
    a.innerHTML = isDog ? `<span class="dog">HELLHOUNDS</span>` : `ROUND ${n}`;
    a.classList.add('on'); this._annT = 2.4;
  }

  update(dt) {
    const p = G.player, r = G.rounds;
    if (!p) return;
    this.el.points.textContent = p.points.toLocaleString();
    this.el.round.textContent = r ? r.round : 0;

    const w = p.weapon();
    this.el.weapon.textContent = w.name + (w.papped ? ' ✦' : '');
    if (w.def.mag) { this.el.ammoMag.textContent = w.mag; this.el.ammoRes.textContent = w.reserve; }
    else { this.el.ammoMag.textContent = '∞'; this.el.ammoRes.textContent = ''; }
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
