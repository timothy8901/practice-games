/*
 * UNDERBYTE — js/fx.js
 * Owner: UI/FX implementer.
 * Contract: CONTRACT.md §4.5 (UB.FX). Design: DESIGN.md §11.3.3 (hitstop presentation),
 *           §11.3.4 (screen shake), §11.3.5 (damage flash, low-HP vignette), §11.3.6 (particles),
 *           §11.3.2 (room transition: the seam shadow drawn over the engine's slide composite).
 *
 * What lives here
 *   • A fixed pool of 512 particles in typed arrays (no allocation after boot). Kinds: spark,
 *     ring, chip, dust, glitter, dot, aura, telegraph. `dust`/`aura` are recycled first when the
 *     pool is full. Chips bounce once on solid tiles (they read the live level read-only).
 *   • Burst presets (DESIGN §11.3.6 counts/lifetimes/motion): spark chip dust glitter ring pogo
 *     heal aura telegraph boss.
 *   • Floating text ('+1', '+25' …), 16 slots.
 *   • Screen shake (decaying random offset, larger mag·remaining wins, never stacks), the world
 *     hitstop request counter (the engine decrements it), up to four overlapping full-screen
 *     flashes (scaled by FX.flashScale; drawn as a thin edge pulse while game.settings.reducedFlashing
 *     is true — playtest B42), the 1-frame 2 % impact zoom for hitstop > 5 f, the low-HP vignette layer (cached
 *     radial canvas; the UI drives its pulse) and the transition seam shadow.
 *
 * The engine calls UB.FX.update() every logic frame (also during hitstop), UB.FX.draw(ctx) in
 * world space after the entities (ctx already translated by the camera) and UB.FX.drawScreen(ctx)
 * in screen space before the HUD. FX randomness is cosmetic and uses its own seeded rng so
 * replays look identical. Nothing here reads wall-clock time.
 */
'use strict';
(function (UB) {
  const POOL = 512;
  const MAX_COLORS = 64;
  const TEXT_N = 16;
  const FLASH_N = 4;
  const W = 960, H = 540;
  const TAU = Math.PI * 2;
  const K = { spark: 1, ring: 2, chip: 3, dust: 4, glitter: 5, dot: 6, aura: 7, telegraph: 8 };
  const F_BOUNCED = 1;   // chip already bounced once

  // --- particle pool (packed in [0, count)) ------------------------------------------------------
  const px = new Float32Array(POOL), py = new Float32Array(POOL);
  const pvx = new Float32Array(POOL), pvy = new Float32Array(POOL);
  const life = new Float32Array(POOL), maxLife = new Float32Array(POOL);
  const size = new Float32Array(POOL), size2 = new Float32Array(POOL);
  const grav = new Float32Array(POOL), drag = new Float32Array(POOL);
  const kind = new Uint8Array(POOL), col = new Uint8Array(POOL), flags = new Uint8Array(POOL);
  const colors = []; const colorIndex = Object.create(null);
  let count = 0;

  // --- floating text -----------------------------------------------------------------------------
  const texts = [];
  for (let i = 0; i < TEXT_N; i++) texts.push({ live: false, str: '', x: 0, y: 0, t: 0, dur: 20, color: '#fff' });
  let textLive = 0;

  // --- flashes (DESIGN §11.3.5): a few may overlap (white hazard flash + red hurt flash) ------------
  const flashes = [];
  for (let i = 0; i < FLASH_N; i++) flashes.push({ color: '#fff', alpha: 0, frames: 1, left: 0 });

  const rnd = UB.Util.rng(0xF00D);
  const TEXT_FONT = UB.font(12, 'MONO', true);   // built once (UB.font concatenates)
  let lowHpCanvas = null;                // DANGER radial vignette (r 260 → 640), built once
  let seamGrad = null;                   // [left, right, up, down] shadow gradients for the slide seam
  const Util = UB.Util;

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
    _shakeMag: 0, _shakeFrames: 1, _shakeLeft: 0,
    _zoom: 0, _zoomSet: false, _zoomX: 480, _zoomY: 270,   // impact zoom (§11.3.3): 2 logic frames of flag = 1 rendered frame
    /** Full-screen flash intensity 0..1 (playtest B42): multiplies every flash's alpha (FX.setFlashScale). */
    flashScale: 1,
    KIND: K,
  };
  /** Thickness (px) of the edge pulse that replaces a full-screen wash while flashes are reduced. */
  const EDGE_PULSE = 10, EDGE_PULSE_MAX = 0.45;

  FX.init = function () {
    count = 0; FX.hitstopFrames = 0; FX._zoom = 0;
    colorId(UB.Palette.PAPER); colorId(UB.Palette.INK);
  };
  /** Drop every particle, text, shake and flash (room load, title). */
  FX.clear = function () {
    count = 0; FX._shakeLeft = 0; FX.shakeX = 0; FX.shakeY = 0; FX._zoom = 0;
    for (let i = 0; i < TEXT_N; i++) texts[i].live = false;
    textLive = 0;
    for (let i = 0; i < FLASH_N; i++) flashes[i].left = 0;
  };

  /** Request world hitstop (frames); overlapping requests take the max, never stack. */
  FX.hitstop = function (frames) {
    if (frames > FX.hitstopFrames) FX.hitstopFrames = frames;
    if (frames > 5) { FX._zoom = 2; FX._zoomSet = false; }
  };
  /** Screen shake: mag px for frames; overlapping shakes keep the larger mag·remaining (no stacking). */
  FX.shake = function (mag, frames) {
    if (!FX.shakeEnabled || !(mag > 0) || !(frames > 0)) return;
    if (mag * frames <= FX._shakeMag * FX._shakeLeft) return;
    FX._shakeMag = mag; FX._shakeFrames = frames; FX._shakeLeft = frames;
  };
  /** Full-screen tint: color at alpha fading to 0 over frames (up to four overlap). */
  FX.flash = function (color, alpha, frames) {
    let slot = flashes[0];
    for (let i = 0; i < FLASH_N; i++) { if (flashes[i].left <= 0) { slot = flashes[i]; break; } if (flashes[i].left < slot.left) slot = flashes[i]; }
    slot.color = color || '#FFFFFF'; slot.alpha = alpha === undefined ? 0.5 : alpha; slot.frames = Math.max(1, frames | 0); slot.left = slot.frames;
  };
  FX.setShakeEnabled = function (on) { FX.shakeEnabled = !!on; if (!on) { FX._shakeLeft = 0; FX.shakeX = 0; FX.shakeY = 0; } };
  /** Intensity hook for the full-screen flashes (hurt, hazard, boss death, Overclock …): 0 = none, 1 = as designed. */
  FX.setFlashScale = function (k) { FX.flashScale = k > 0 ? (k < 1 ? k : 1) : 0; };
  /**
   * Reduced flashing (playtest B42 / the comfort "REDUCED FLASHING" setting): true while `game.settings.reducedFlashing`
   * is true. Read live from the settings object, so the setting row only has to store the boolean (setSetting).
   */
  FX.reducedFlashing = function () { const g = UB.game, s = g && g.settings; return !!(s && s.reducedFlashing === true); };

  /**
   * Spawn one particle. kind: 'spark'|'ring'|'chip'|'dust'|'glitter'|'dot'|'aura'|'telegraph'.
   * opts: {vx, vy (px/frame), life, size, size2, color, grav (px/frame²), drag}. Returns the index.
   */
  FX.spawn = function (k, x, y, o) {
    let i;
    if (count < POOL) i = count++;
    else { // pool full: recycle the oldest dust/aura, else the oldest anything
      i = -1;
      for (let j = 0; j < count; j++) if (kind[j] === K.dust || kind[j] === K.aura) { i = j; break; }
      if (i < 0) i = 0;
    }
    px[i] = x; py[i] = y;
    pvx[i] = o && o.vx !== undefined ? o.vx : 0; pvy[i] = o && o.vy !== undefined ? o.vy : 0;
    life[i] = maxLife[i] = o && o.life !== undefined ? o.life : 20;
    size[i] = o && o.size !== undefined ? o.size : 3; size2[i] = o && o.size2 !== undefined ? o.size2 : size[i];
    grav[i] = o && o.grav !== undefined ? o.grav : 0; drag[i] = o && o.drag !== undefined ? o.drag : 1;
    kind[i] = K[k] || K.dot; col[i] = colorId((o && o.color) || UB.Palette.PAPER); flags[i] = 0;
    return i;
  };

  /**
   * Burst presets (DESIGN §11.3.6). kind: 'spark' 'chip' 'dust' 'glitter' 'ring' 'pogo' 'heal'
   * 'aura' 'telegraph' 'boss'. n = count (rings ignore it). opts: {color, dir (+1/-1 = direction
   * the attack travels; sparks fly that way), radius (rings), life}.
   */
  FX.burst = function (k, x, y, n, o) {
    const P = UB.Palette;
    const color = (o && o.color) || P.PAPER;
    const dir = (o && o.dir) || 0;
    if (FX._zoom > 0 && !FX._zoomSet) {   // first burst after a long hitstop = the impact point
      const g = UB.game;
      FX._zoomX = g && g.cam ? x - g.cam.x : 480; FX._zoomY = g && g.cam ? y - g.cam.y : 270; FX._zoomSet = true;
    }
    if (k === 'ring') {
      FX.spawn('ring', x, y, { life: (o && o.life) || 12, size: 0, size2: (o && o.radius) || 30, color: (o && o.color) || P.INK });
      return;
    }
    if (k === 'boss') { // boss death: 60 chips + 6 rings + 40 sparks (§11.3.6 bossBurst)
      FX.burst('chip', x, y, 60, o);
      for (let i = 0; i < 6; i++) FX.spawn('ring', x, y, { life: 12 + i * 10, size: 0, size2: 60 + i * 28, color: P.INK });
      FX.burst('spark', x, y, 40, o);
      return;
    }
    for (let i = 0; i < n; i++) {
      const r = rnd();
      if (k === 'spark') { // 100° cone away from the attacker, 180–420 px/s, gravity 600, drag 0.9, life 14–22
        const ang = dir === 0 ? r * TAU : (dir > 0 ? 0 : Math.PI) + (r - 0.5) * 1.75;
        const sp = (180 + rnd() * 240) / 60;
        FX.spawn('spark', x, y, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.2, life: 14 + rnd() * 8, size: 2, color: color, grav: 600 / 3600, drag: 0.9 });
      } else if (k === 'chip') { // 120–300 px/s upward fan, gravity 900, bounce once, life 30–45
        const ang = -Math.PI * (0.15 + r * 0.7);
        const sp = (120 + rnd() * 180) / 60;
        FX.spawn('chip', x, y, { vx: Math.cos(ang) * sp + dir * 1.2, vy: Math.sin(ang) * sp, life: 30 + rnd() * 15, size: 4, color: color, grav: 900 / 3600, drag: 0.99 });
      } else if (k === 'dust') { // vx ±40, vy −30, no gravity, r 2→6, life 18–28
        FX.spawn('dust', x + (r - 0.5) * 12, y, { vx: (rnd() - 0.5) * 80 / 60, vy: -30 / 60 * rnd(), life: 18 + rnd() * 10, size: 2, size2: 6, color: P.PAPER });
      } else if (k === 'glitter') { // radial 60–160 px/s, floats up (gravity −80), drag 0.92, life 25–40
        const ang = r * TAU; const sp = (60 + rnd() * 100) / 60;
        FX.spawn('glitter', x, y, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 25 + rnd() * 15, size: 3 + rnd() * 2, color: color, grav: -80 / 3600, drag: 0.92 });
      } else if (k === 'pogo') { // sparks fanned downward, life 12
        const ang = Math.PI / 2 + (r - 0.5) * 1.2; const sp = (120 + rnd() * 120) / 60;
        FX.spawn('spark', x, y, { vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 12, size: 2, color: color, grav: 0, drag: 0.9 });
      } else if (k === 'heal') { // rising glitter (CORE_HEART → PAPER) with a rising ring every 4th, life 40
        if ((i & 3) === 3) FX.spawn('ring', x, y - 4, { vy: -0.6, life: 26, size: 0, size2: 16, color: P.PAPER });
        else FX.spawn('glitter', x + (r - 0.5) * 30, y - rnd() * 20, { vx: 0, vy: -(40 + rnd() * 40) / 60, life: 40, size: 3, color: (i & 1) ? P.PAPER : color, drag: 0.98 });
      } else if (k === 'aura') { // Overclock wisps: rise from the body's bottom edge, sway ±3 px, life 30
        FX.spawn('aura', x + (r - 0.5) * 24, y, { vx: 0, vy: -60 / 60, life: 30, size: 3, color: color });
      } else if (k === 'telegraph') { // dots pulled inward over 10 f (boss startups)
        const ang = r * TAU, rad = 24 + rnd() * 10;
        FX.spawn('telegraph', x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, { vx: -Math.cos(ang) * rad / 10, vy: -Math.sin(ang) * rad / 10, life: 10, size: 2.5, color: color });
      } else {
        FX.spawn('dot', x, y, { vx: (r - 0.5) * 2, vy: (rnd() - 0.5) * 2, life: 20, size: 3, color: color });
      }
    }
  };
  /** Floating text (e.g. '+1' on a bit pickup) rising 12 px over `dur` frames (default 20). */
  FX.text = function (str, x, y, color, dur) {
    let slot = null;
    for (let i = 0; i < TEXT_N; i++) { const t = texts[i]; if (!t.live) { slot = t; break; } }
    if (!slot) { slot = texts[0]; for (let i = 1; i < TEXT_N; i++) if (texts[i].t > slot.t) slot = texts[i]; textLive--; }
    slot.live = true; slot.str = str; slot.x = x; slot.y = y; slot.t = 0; slot.dur = dur || 20; slot.color = color || UB.Palette.PAPER;
    textLive++;
  };

  /** Advance particles, texts, shake, flashes and the zoom flag by one logic frame. */
  FX.update = function () {
    const g = UB.game, lv = g ? g.level : null;
    for (let i = 0; i < count; i++) {
      pvy[i] += grav[i];
      pvx[i] *= drag[i]; pvy[i] *= drag[i];
      px[i] += pvx[i]; py[i] += pvy[i];
      if (kind[i] === K.chip && lv && pvy[i] > 0 && !(flags[i] & F_BOUNCED)) {   // bounce once on a solid tile
        const tx = (px[i] / 30) | 0, ty = (py[i] / 30) | 0;
        if (UB.Entity.solidAt(lv, tx, ty)) { py[i] = ty * 30 - 0.5; pvy[i] *= -0.4; pvx[i] *= 0.6; flags[i] |= F_BOUNCED; }
      }
      life[i] -= 1;
      if (life[i] <= 0) { // swap-remove
        count--;
        if (i !== count) {
          px[i] = px[count]; py[i] = py[count]; pvx[i] = pvx[count]; pvy[i] = pvy[count];
          life[i] = life[count]; maxLife[i] = maxLife[count]; size[i] = size[count]; size2[i] = size2[count];
          grav[i] = grav[count]; drag[i] = drag[count]; kind[i] = kind[count]; col[i] = col[count]; flags[i] = flags[count];
        }
        i--;
      }
    }
    for (let i = 0; i < TEXT_N; i++) { const t = texts[i]; if (t.live && ++t.t >= t.dur) { t.live = false; textLive--; } }
    if (FX._shakeLeft > 0) {
      const k = FX._shakeLeft / FX._shakeFrames;
      FX.shakeX = (rnd() * 2 - 1) * FX._shakeMag * k;
      FX.shakeY = (rnd() * 2 - 1) * FX._shakeMag * 0.6 * k;
      FX._shakeLeft--;
    } else { FX.shakeX = 0; FX.shakeY = 0; }
    for (let i = 0; i < FLASH_N; i++) if (flashes[i].left > 0) flashes[i].left--;
    if (FX._zoom > 0) FX._zoom--;
  };

  /** Draw world-space particles + floating text; ctx is already translated by the camera. */
  FX.draw = function (ctx) {
    if (count === 0 && textLive === 0) return;
    const ease = Util.easeOutCubic;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    let lighter = false;
    for (let i = 0; i < count; i++) {
      const k = kind[i]; const a = life[i] / maxLife[i]; const c = colors[col[i]];
      const x = px[i], y = py[i];
      if (k === K.spark) {
        if (!lighter) { ctx.globalCompositeOperation = 'lighter'; lighter = true; }
        ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = size[i];
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - pvx[i] * 1.2, y - pvy[i] * 1.2); ctx.stroke();
        continue;
      }
      if (k === K.aura) {
        if (!lighter) { ctx.globalCompositeOperation = 'lighter'; lighter = true; }
        ctx.globalAlpha = 0.8 * a; ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x + Math.sin(life[i] * 0.35) * 3, y, size[i], 0, TAU); ctx.fill();
        continue;
      }
      if (lighter) { ctx.globalCompositeOperation = 'source-over'; lighter = false; }
      if (k === K.ring) {
        const r = size2[i] * ease(1 - a);
        ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, r < 0.1 ? 0.1 : r, 0, TAU); ctx.stroke();
      } else if (k === K.chip) {
        ctx.globalAlpha = life[i] < 10 ? life[i] / 10 : 1; ctx.fillStyle = c;
        const s = size[i];
        ctx.save(); ctx.translate(x, y); ctx.rotate(life[i] * 0.25 + i); UB.Render.rrect(ctx, -s / 2, -s / 2, s, s, 1); ctx.fill(); ctx.restore();
      } else if (k === K.dust) {
        const r = Util.lerp(size2[i], size[i], a);
        ctx.globalAlpha = 0.35 * a; ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      } else if (k === K.glitter) {
        const s = size[i], s3 = s * 0.3; ctx.globalAlpha = a; ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s3, y - s3); ctx.lineTo(x + s, y);
        ctx.lineTo(x + s3, y + s3); ctx.lineTo(x, y + s); ctx.lineTo(x - s3, y + s3);
        ctx.lineTo(x - s, y); ctx.lineTo(x - s3, y - s3); ctx.closePath(); ctx.fill();
      } else { // dot, telegraph
        ctx.globalAlpha = k === K.telegraph ? 0.4 + 0.6 * (1 - a) : a; ctx.fillStyle = c;
        ctx.beginPath(); ctx.arc(x, y, size[i], 0, TAU); ctx.fill();
      }
    }
    if (lighter) ctx.globalCompositeOperation = 'source-over';
    if (textLive > 0) {
      ctx.globalAlpha = 1;
      ctx.font = TEXT_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.strokeStyle = UB.Palette.INK; ctx.lineWidth = 3;
      for (let i = 0; i < TEXT_N; i++) {
        const t = texts[i];
        if (!t.live) continue;
        const k = t.t / t.dur, ty = t.y - 12 * k;
        ctx.globalAlpha = 1 - k * k;
        ctx.strokeText(t.str, t.x, ty);
        ctx.fillStyle = t.color; ctx.fillText(t.str, t.x, ty);
      }
    }
    ctx.restore();
  };

  /** Screen-space effects: the impact zoom, the transition seam shadow and full-screen flashes. */
  FX.drawScreen = function (ctx) {
    const g = UB.game;
    if (FX._zoom > 0 && g) {   // 2 % zoom about the impact point on the first frozen frame (§11.3.3)
      const dpr = g.dpr || 1, zx = FX._zoomX, zy = FX._zoomY;
      ctx.save();
      ctx.translate(zx, zy); ctx.scale(1.02, 1.02); ctx.translate(-zx, -zy);
      ctx.drawImage(ctx.canvas, 0, 0, W * dpr, H * dpr, 0, 0, W, H);
      ctx.restore();
    }
    if (g && g.mode === 'transition' && g.transition.phase === 'slide') drawSeam(ctx, g);
    const level = FX.flashScale;
    if (level <= 0) return;
    const reduced = FX.reducedFlashing();
    for (let i = 0; i < FLASH_N; i++) {
      const f = flashes[i];
      if (f.left <= 0) continue;
      const a = f.alpha * (f.left / f.frames) * level;
      if (a <= 0.002) continue;
      ctx.save();
      ctx.fillStyle = f.color;
      if (reduced) {   // a thin pulse along the screen edges instead of a full-screen wash (no large-area flash)
        ctx.globalAlpha = a < EDGE_PULSE_MAX ? a : EDGE_PULSE_MAX;
        ctx.fillRect(0, 0, W, EDGE_PULSE); ctx.fillRect(0, H - EDGE_PULSE, W, EDGE_PULSE);
        ctx.fillRect(0, EDGE_PULSE, EDGE_PULSE, H - 2 * EDGE_PULSE); ctx.fillRect(W - EDGE_PULSE, EDGE_PULSE, EDGE_PULSE, H - 2 * EDGE_PULSE);
      } else {
        ctx.globalAlpha = a; ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    }
  };
  /** Ink shadow on both sides of the seam between the old and the new room during the slide (§11.3.2). */
  function drawSeam(ctx, g) {
    const tr = g.transition, T = UB.Engine ? UB.Engine.T : null;
    const slide = T ? T.slide : 18;
    const k = Util.easeOutCubic(1 - tr.timer / slide);
    if (!seamGrad) {
      seamGrad = [];
      const L = ctx.createLinearGradient(0, 0, 24, 0); L.addColorStop(0, 'rgba(20,16,24,0)'); L.addColorStop(1, 'rgba(20,16,24,0.7)');
      const R = ctx.createLinearGradient(0, 0, 24, 0); R.addColorStop(0, 'rgba(20,16,24,0.7)'); R.addColorStop(1, 'rgba(20,16,24,0)');
      const U = ctx.createLinearGradient(0, 0, 0, 24); U.addColorStop(0, 'rgba(20,16,24,0)'); U.addColorStop(1, 'rgba(20,16,24,0.7)');
      const D = ctx.createLinearGradient(0, 0, 0, 24); D.addColorStop(0, 'rgba(20,16,24,0.7)'); D.addColorStop(1, 'rgba(20,16,24,0)');
      seamGrad.push(L, R, U, D);
    }
    ctx.save();
    if (tr.dx !== 0) {
      const sx = Math.round(tr.dx > 0 ? W * (1 - k) : W * k);
      ctx.translate(sx - 24, 0); ctx.fillStyle = seamGrad[0]; ctx.fillRect(0, 0, 24, H);
      ctx.translate(24, 0); ctx.fillStyle = seamGrad[1]; ctx.fillRect(0, 0, 24, H);
      ctx.fillStyle = UB.Palette.INK; ctx.fillRect(-1.5, 0, 3, H);
    } else if (tr.dy !== 0) {
      const sy = Math.round(tr.dy > 0 ? H * (1 - k) : H * k);
      ctx.translate(0, sy - 24); ctx.fillStyle = seamGrad[2]; ctx.fillRect(0, 0, W, 24);
      ctx.translate(0, 24); ctx.fillStyle = seamGrad[3]; ctx.fillRect(0, 0, W, 24);
      ctx.fillStyle = UB.Palette.INK; ctx.fillRect(0, -1.5, W, 3);
    }
    ctx.restore();
  }
  /**
   * Low-HP heartbeat vignette (DESIGN §11.3.5): DANGER radial from r 260 to r 640 at alpha
   * 0.10 + 0.14·pulse. The UI computes `pulse` (and plays the heartbeat); the canvas is built once.
   */
  FX.drawLowHp = function (ctx, pulse) {
    if (!lowHpCanvas) {
      lowHpCanvas = UB.Render.makeCanvas(W, H);
      const c = lowHpCanvas.getContext('2d');
      const grd = c.createRadialGradient(480, 270, 260, 480, 270, 640);
      grd.addColorStop(0, 'rgba(255,59,59,0)'); grd.addColorStop(1, 'rgba(255,59,59,1)');
      c.fillStyle = grd; c.fillRect(0, 0, W, H);
    }
    ctx.save(); ctx.globalAlpha = 0.10 + 0.14 * pulse; ctx.drawImage(lowHpCanvas, 0, 0); ctx.restore();
  };
  /** Live particle count (debug/tests). */
  FX.count = function () { return count; };

  UB.FX = FX;
})(window.UB);
