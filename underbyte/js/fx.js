/*
 * UNDERBYTE — js/fx.js
 * Owner: UI/FX implementer (this is a WORKING MINIMAL version by the engine architect).
 * Contract: CONTRACT.md §4.5 (UB.FX). Design: DESIGN.md §11.3.3–11.3.6.
 *
 * Particles (fixed pool of 512 in typed arrays — no allocation after boot),
 * screen shake, world hitstop counter, and full-screen flashes.
 *
 * The engine calls UB.FX.update() every logic frame (even during hitstop),
 * UB.FX.draw(ctx, camX, camY) in world space after the entities, and
 * UB.FX.drawScreen(ctx) in screen space before the HUD. The UI/FX implementer
 * may replace the drawing and add kinds but must keep every exported name.
 */
'use strict';
(function (UB) {
  const POOL = 512;
  const MAX_COLORS = 64;
  const K = { spark: 1, ring: 2, chip: 3, dust: 4, glitter: 5, dot: 6, aura: 7 };

  const px = new Float32Array(POOL), py = new Float32Array(POOL);
  const pvx = new Float32Array(POOL), pvy = new Float32Array(POOL);
  const life = new Float32Array(POOL), maxLife = new Float32Array(POOL);
  const size = new Float32Array(POOL), size2 = new Float32Array(POOL);
  const grav = new Float32Array(POOL), drag = new Float32Array(POOL);
  const kind = new Uint8Array(POOL), col = new Uint8Array(POOL);
  const colors = []; const colorIndex = Object.create(null);
  let count = 0; // particles are kept packed in [0, count)

  // Floating text (bit pickups etc.): tiny separate list of 16.
  const TEXT_N = 16;
  const texts = [];
  for (let i = 0; i < TEXT_N; i++) texts.push({ live: false, str: '', x: 0, y: 0, t: 0, dur: 20, color: '#fff' });

  const rnd = UB.Util.rng(0xF00D); // FX randomness is cosmetic; seeded so replays look the same

  function colorId(c) {
    let id = colorIndex[c];
    if (id === undefined) {
      if (colors.length >= MAX_COLORS) return 0;
      id = colors.length; colors.push(c); colorIndex[c] = id;
    }
    return id;
  }

  const FX = {
    hitstopFrames: 0,
    shakeEnabled: true,
    shakeX: 0, shakeY: 0,
    _shakeMag: 0, _shakeFrames: 0, _shakeLeft: 0,
    _flashColor: '#fff', _flashAlpha: 0, _flashFrames: 0, _flashLeft: 0,
    KIND: K,
  };

  FX.init = function () { count = 0; FX.hitstopFrames = 0; colorId(UB.Palette.PAPER); };
  FX.clear = function () { count = 0; FX._shakeLeft = 0; FX._flashLeft = 0; for (let i = 0; i < TEXT_N; i++) texts[i].live = false; };

  /** Request world hitstop (frames); overlapping requests take the max. */
  FX.hitstop = function (frames) { if (frames > FX.hitstopFrames) FX.hitstopFrames = frames; };
  /** Screen shake: mag px for frames; overlapping shakes keep the larger mag*remaining. */
  FX.shake = function (mag, frames) {
    if (!FX.shakeEnabled) return;
    if (mag * frames <= FX._shakeMag * FX._shakeLeft) return;
    FX._shakeMag = mag; FX._shakeFrames = frames; FX._shakeLeft = frames;
  };
  /** Full-screen tint: color at alpha fading to 0 over frames. */
  FX.flash = function (color, alpha, frames) {
    FX._flashColor = color; FX._flashAlpha = alpha; FX._flashFrames = frames; FX._flashLeft = frames;
  };
  FX.setShakeEnabled = function (on) { FX.shakeEnabled = !!on; if (!on) FX._shakeLeft = 0; };

  /** Spawn one particle. opts: {vx,vy,life,size,color,grav,drag,size2}. Returns index or -1. */
  FX.spawn = function (k, x, y, o) {
    let i;
    if (count < POOL) i = count++;
    else { // recycle the oldest dust/aura, else the oldest anything
      i = -1;
      for (let j = 0; j < count; j++) if (kind[j] === K.dust || kind[j] === K.aura) { i = j; break; }
      if (i < 0) i = 0;
    }
    px[i] = x; py[i] = y;
    pvx[i] = o && o.vx !== undefined ? o.vx : 0; pvy[i] = o && o.vy !== undefined ? o.vy : 0;
    life[i] = maxLife[i] = o && o.life !== undefined ? o.life : 20;
    size[i] = o && o.size !== undefined ? o.size : 3; size2[i] = o && o.size2 !== undefined ? o.size2 : size[i];
    grav[i] = o && o.grav !== undefined ? o.grav : 0; drag[i] = o && o.drag !== undefined ? o.drag : 1;
    kind[i] = K[k] || K.dot; col[i] = colorId((o && o.color) || UB.Palette.PAPER);
    return i;
  };

  /**
   * Burst helper (DESIGN §11.3.6 presets). kind: 'spark'|'chip'|'dust'|'glitter'|'ring'|'pogo'|'heal'.
   * opts: {count, color, dir (+1/-1 away direction), speed, spread}.
   */
  FX.burst = function (k, x, y, n, o) {
    const color = (o && o.color) || UB.Palette.PAPER;
    const dir = (o && o.dir) || 0;
    if (k === 'ring') { FX.spawn('ring', x, y, { life: (o && o.life) || 12, size: 0, size2: (o && o.radius) || 30, color: UB.Palette.INK }); return; }
    for (let i = 0; i < n; i++) {
      const r = rnd();
      if (k === 'spark') { // 100° cone away from the attacker, gravity 600 px/s², drag 0.9
        const ang = (dir === 0 ? rnd() * Math.PI * 2 : Math.atan2(0, dir) + (r - 0.5) * 1.75);
        const sp = (180 + rnd() * 240) / 60;
        FX.spawn('spark', x, y, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.5, life: 14 + rnd() * 8, size: 2, color: color, grav: 600 / 3600, drag: 0.9 });
      } else if (k === 'chip') {
        const ang = -Math.PI * (0.15 + rnd() * 0.7);
        const sp = (120 + rnd() * 180) / 60;
        FX.spawn('chip', x, y, { vx: Math.cos(ang) * sp + dir * 1, vy: Math.sin(ang) * sp, life: 30 + rnd() * 15, size: 4, color: color, grav: 900 / 3600, drag: 0.99 });
      } else if (k === 'dust') {
        FX.spawn('dust', x + (rnd() - 0.5) * 10, y, { vx: (rnd() - 0.5) * 80 / 60, vy: -30 / 60 * rnd(), life: 18 + rnd() * 10, size: 2, size2: 6, color: UB.Palette.PAPER });
      } else if (k === 'glitter') {
        const ang = rnd() * Math.PI * 2; const sp = (60 + rnd() * 100) / 60;
        FX.spawn('glitter', x, y, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 25 + rnd() * 15, size: 3 + rnd() * 2, color: color, grav: -80 / 3600, drag: 0.92 });
      } else if (k === 'pogo') {
        const ang = Math.PI / 2 + (rnd() - 0.5) * 1.2; const sp = (120 + rnd() * 120) / 60;
        FX.spawn('spark', x, y, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 12, size: 2, color: color, grav: 0, drag: 0.9 });
      } else if (k === 'heal') {
        FX.spawn('glitter', x + (rnd() - 0.5) * 30, y - rnd() * 20, { vx: 0, vy: -(40 + rnd() * 40) / 60, life: 40, size: 3, color: color, drag: 0.98 });
      } else if (k === 'aura') {
        FX.spawn('aura', x + (rnd() - 0.5) * 20, y, { vx: 0, vy: -60 / 60, life: 30, size: 3, color: color });
      } else {
        FX.spawn('dot', x, y, { vx: (rnd() - 0.5) * 2, vy: (rnd() - 0.5) * 2, life: 20, size: 3, color: color });
      }
    }
  };
  /** Floating text (e.g. '+1' on a bit pickup) rising 12 px over 20 f. */
  FX.text = function (str, x, y, color, dur) {
    for (let i = 0; i < TEXT_N; i++) {
      const t = texts[i];
      if (!t.live) { t.live = true; t.str = str; t.x = x; t.y = y; t.t = 0; t.dur = dur || 20; t.color = color || UB.Palette.PAPER; return; }
    }
  };

  /** Advance particles, shake and flashes by one logic frame. */
  FX.update = function () {
    for (let i = 0; i < count; i++) {
      pvy[i] += grav[i];
      pvx[i] *= drag[i]; pvy[i] *= drag[i];
      px[i] += pvx[i]; py[i] += pvy[i];
      life[i] -= 1;
      if (life[i] <= 0) { // swap-remove
        count--;
        if (i !== count) {
          px[i] = px[count]; py[i] = py[count]; pvx[i] = pvx[count]; pvy[i] = pvy[count];
          life[i] = life[count]; maxLife[i] = maxLife[count]; size[i] = size[count]; size2[i] = size2[count];
          grav[i] = grav[count]; drag[i] = drag[count]; kind[i] = kind[count]; col[i] = col[count];
        }
        i--;
      }
    }
    for (let i = 0; i < TEXT_N; i++) { const t = texts[i]; if (t.live && ++t.t >= t.dur) t.live = false; }
    if (FX._shakeLeft > 0) {
      const k = FX._shakeLeft / FX._shakeFrames;
      FX.shakeX = (rnd() * 2 - 1) * FX._shakeMag * k;
      FX.shakeY = (rnd() * 2 - 1) * FX._shakeMag * 0.6 * k;
      FX._shakeLeft--;
    } else { FX.shakeX = 0; FX.shakeY = 0; }
    if (FX._flashLeft > 0) FX._flashLeft--;
  };

  /** Draw world-space particles; ctx is already translated by the camera. */
  FX.draw = function (ctx) {
    if (count === 0 && !texts.some(function (t) { return t.live; })) return;
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const k = kind[i]; const a = life[i] / maxLife[i]; const c = colors[col[i]];
      if (k === K.spark) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a;
        ctx.strokeStyle = c; ctx.lineWidth = size[i];
        ctx.beginPath(); ctx.moveTo(px[i], py[i]); ctx.lineTo(px[i] - pvx[i] * 1.2, py[i] - pvy[i] * 1.2); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      } else if (k === K.ring) {
        const r = size2[i] * UB.Util.easeOutCubic(1 - a);
        ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px[i], py[i], Math.max(0.1, r), 0, Math.PI * 2); ctx.stroke();
      } else if (k === K.chip) {
        ctx.globalAlpha = life[i] < 10 ? life[i] / 10 : 1; ctx.fillStyle = c;
        ctx.fillRect(px[i] - 2, py[i] - 2, size[i], size[i]);
      } else if (k === K.dust) {
        const r = UB.Util.lerp(size2[i], size[i], a);
        ctx.globalAlpha = 0.35 * a; ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(px[i], py[i], r, 0, Math.PI * 2); ctx.fill();
      } else if (k === K.glitter) {
        const s = size[i]; ctx.globalAlpha = a; ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(px[i], py[i] - s); ctx.lineTo(px[i] + s * 0.3, py[i] - s * 0.3); ctx.lineTo(px[i] + s, py[i]);
        ctx.lineTo(px[i] + s * 0.3, py[i] + s * 0.3); ctx.lineTo(px[i], py[i] + s); ctx.lineTo(px[i] - s * 0.3, py[i] + s * 0.3);
        ctx.lineTo(px[i] - s, py[i]); ctx.lineTo(px[i] - s * 0.3, py[i] - s * 0.3); ctx.closePath(); ctx.fill();
      } else if (k === K.aura) {
        ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8 * a; ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(px[i], py[i], size[i], 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.globalAlpha = a; ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(px[i], py[i], size[i], 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.font = UB.font(12, 'MONO', true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < TEXT_N; i++) {
      const t = texts[i];
      if (!t.live) continue;
      const k = t.t / t.dur;
      ctx.globalAlpha = 1 - k * k;
      ctx.strokeStyle = UB.Palette.INK; ctx.lineWidth = 3; ctx.strokeText(t.str, t.x, t.y - 12 * k);
      ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, t.y - 12 * k);
    }
    ctx.restore();
  };

  /** Draw screen-space effects (flash tint). */
  FX.drawScreen = function (ctx) {
    if (FX._flashLeft > 0) {
      ctx.save();
      ctx.globalAlpha = FX._flashAlpha * (FX._flashLeft / FX._flashFrames);
      ctx.fillStyle = FX._flashColor; ctx.fillRect(0, 0, 960, 540);
      ctx.restore();
    }
  };
  /** Live particle count (debug/tests). */
  FX.count = function () { return count; };

  UB.FX = FX;
})(window.UB);
