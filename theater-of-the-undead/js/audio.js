// ============ WebAudio synth: zombies SFX + ambience, no asset files ============

class AudioFX {
  constructor() {
    this.ctx = null; this.master = null; this.sfxGain = null; this.musicGain = null;
    this.muted = false; this._musicTimer = null; this._step = 0; this._nextT = 0; this._kind = null;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return true; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.5;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 8; comp.attack.value = 0.002; comp.release.value = 0.18;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.3; this.musicGain.connect(this.master);
      const len = this.ctx.sampleRate * 1.2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    } catch (e) { console.warn('audio unavailable', e); return false; }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  _osc(type, f0, f1, dur, vol, { dest = null, slideExp = false, delay = 0 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(Math.max(20, f0), t);
    if (f1 != null) { if (slideExp) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); else o.frequency.linearRampToValueAtTime(Math.max(20, f1), t + dur); }
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  _noise(dur, vol, { f0 = 8000, f1 = 200, q = 0.8, type = 'lowpass', delay = 0, dest = null } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = 0.6 + Math.random() * 0.8;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfxGain); src.start(t); src.stop(t + dur + 0.02);
  }

  // ---- weapons ----
  shot(kind) {
    switch (kind) {
      case 'pistol': this._osc('square', 760, 180, 0.1, 0.18, { slideExp: true }); this._noise(0.06, 0.16, { f0: 5000, f1: 600 }); break;
      case 'rifle': this._osc('sawtooth', 540, 90, 0.12, 0.22, { slideExp: true }); this._noise(0.09, 0.2, { f0: 6000, f1: 400 }); break;
      case 'smg': this._osc('square', 620, 160, 0.06, 0.13, { slideExp: true }); this._noise(0.04, 0.12, { f0: 5500, f1: 800 }); break;
      case 'shotgun': this._noise(0.22, 0.4, { f0: 3500, f1: 120 }); this._osc('sine', 160, 40, 0.2, 0.3, { slideExp: true }); break;
      case 'ray': this._osc('sawtooth', 1400, 300, 0.18, 0.18, { slideExp: true }); this._osc('square', 700, 1500, 0.16, 0.08); break;
      case 'launcher': this._noise(0.3, 0.3, { f0: 1500, f1: 200 }); this._osc('sine', 200, 50, 0.3, 0.3, { slideExp: true }); break;
      case 'thunder': this._noise(0.5, 0.5, { f0: 400, f1: 4000, type: 'bandpass', q: 1.2 }); this._osc('sawtooth', 60, 600, 0.5, 0.2); break;
      default: this._osc('square', 700, 200, 0.1, 0.16, { slideExp: true });
    }
  }
  reload() { this._noise(0.05, 0.12, { f0: 2000, f1: 800 }); this._osc('square', 300, 300, 0.04, 0.1, { delay: 0.18 }); this._noise(0.05, 0.1, { f0: 1500, f1: 600, delay: 0.32 }); }
  empty() { this._osc('square', 200, 160, 0.04, 0.08); }
  knife() { this._noise(0.12, 0.2, { f0: 4000, f1: 700, type: 'bandpass' }); }
  hit() { this._noise(0.05, 0.16, { f0: 3000, f1: 800 }); }
  explosion(big = 1) { this._noise(0.5 * big, 0.5, { f0: 3000, f1: 60 }); this._osc('sine', 130, 32, 0.5 * big, 0.5, { slideExp: true }); }

  // ---- zombies ----
  groan() { this._osc('sawtooth', 90 + Math.random() * 40, 70, 0.5, 0.12, { slideExp: true }); this._noise(0.4, 0.06, { f0: 700, f1: 200, type: 'bandpass', q: 2 }); }
  zdeath() { this._osc('sawtooth', 160, 50, 0.3, 0.16, { slideExp: true }); this._noise(0.2, 0.18, { f0: 2000, f1: 200 }); }
  dogHowl() { this._osc('sawtooth', 300, 600, 0.5, 0.16, { slideExp: true }); this._osc('sawtooth', 600, 240, 0.4, 0.12, { delay: 0.4, slideExp: true }); }
  boardBreak() { this._noise(0.16, 0.26, { f0: 1800, f1: 300 }); this._osc('square', 200, 90, 0.12, 0.12, { slideExp: true }); }
  boardRepair() { this._noise(0.08, 0.16, { f0: 1200, f1: 500 }); this._osc('square', 300, 500, 0.06, 0.08); }

  // ---- economy / meta ----
  purchase() { this._osc('square', 880, 1320, 0.07, 0.16); this._osc('square', 1320, 1760, 0.08, 0.12, { delay: 0.06 }); }
  denied() { this._osc('square', 220, 160, 0.16, 0.16, { slideExp: true }); }
  perk() { const n = [392, 523, 659, 784]; n.forEach((f, i) => this._osc('triangle', f, f, 0.16, 0.14, { delay: i * 0.1 })); }
  teleport() { this._noise(0.6, 0.2, { f0: 400, f1: 6000, type: 'bandpass', q: 1 }); this._osc('sine', 200, 1200, 0.5, 0.12, { slideExp: true }); }
  power() { this._osc('sawtooth', 60, 120, 0.8, 0.2); this._noise(0.8, 0.12, { f0: 200, f1: 2000, type: 'bandpass' }); }
  powerup(kind) {
    if (kind === 'nuke') { this._osc('sine', 400, 40, 0.9, 0.3, { slideExp: true }); this._noise(0.9, 0.3, { f0: 2000, f1: 60 }); }
    else if (kind === 'instakill') { const n = [523, 659, 880]; n.forEach((f, i) => this._osc('square', f, f, 0.12, 0.12, { delay: i * 0.07 })); }
    else { this._osc('square', 660, 990, 0.14, 0.14); this._osc('square', 990, 1320, 0.12, 0.1, { delay: 0.1 }); }
  }
  roundStart() { this._osc('sawtooth', 80, 80, 0.5, 0.2); this._osc('sawtooth', 60, 60, 0.7, 0.18, { delay: 0.3 }); }
  roundEnd() { const n = [330, 262, 196]; n.forEach((f, i) => this._osc('sawtooth', f, f * 0.97, 0.4, 0.14, { delay: i * 0.18 })); }

  // ---- player ----
  hurt() { this._noise(0.1, 0.3, { f0: 3000, f1: 400 }); this._osc('sawtooth', 200, 70, 0.12, 0.2, { slideExp: true }); }
  heartbeat() { this._osc('sine', 60, 40, 0.16, 0.4, { slideExp: true }); }
  down() { const n = [392, 311, 233]; n.forEach((f, i) => this._osc('square', f, f, 0.3, 0.2, { delay: i * 0.18 })); this._noise(0.5, 0.2, { f0: 2000, f1: 80 }); }
  revive() { const n = [262, 392, 523, 659]; n.forEach((f, i) => this._osc('triangle', f, f, 0.2, 0.14, { delay: i * 0.1 })); }
  ui() { this._osc('square', 880, 1100, 0.05, 0.1); }

  // ---- ambient drone ----
  playMusic(kind) {
    if (!this.ctx) return;
    this.stopMusic(); this._kind = kind; this._step = 0; this._nextT = this.ctx.currentTime + 0.06;
    this._musicTimer = setInterval(() => this._schedule(), 50);
  }
  stopMusic() { if (this._musicTimer) { clearInterval(this._musicTimer); this._musicTimer = null; } }
  _schedule() {
    if (!this.ctx) return;
    const spb = 60 / 70 / 2;
    while (this._nextT < this.ctx.currentTime + 0.2) { this._step++; this._playStep(this._step % 32, this._nextT); this._nextT += spb; }
  }
  _playStep(s, t) {
    const delay = Math.max(0, t - this.ctx.currentTime);
    const M = { dest: this.musicGain, delay };
    if (this._kind === 'battle') {
      if (s % 16 === 0) [55, 65.4, 49].forEach((f, i) => this._osc('sawtooth', f, f * 1.003, 2.4, 0.05, M));
      if (s % 8 === 0) this._osc('sine', 41, 38, 0.6, 0.14, M);
      if (s % 8 === 4 && Math.random() < 0.5) this._noise(0.05, 0.04, { f0: 9000, f1: 7000, type: 'highpass', ...M });
    } else {
      if (s % 32 === 0) [110, 138, 165].forEach((f) => this._osc('triangle', f, f * 1.004, 3.0, 0.05, M));
    }
  }
}

export const audio = new AudioFX();
