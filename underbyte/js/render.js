/*
 * UNDERBYTE — js/render.js
 * Owner: ENGINE ARCHITECT (do not edit from other modules).
 * Contract: CONTRACT.md §4.7 (UB.Render). Design: DESIGN.md §11.1.4–11.1.8, §11.3.7, §9.5 (vendor).
 *
 * Static world drawing: per-zone parallax background caches, the per-room
 * static tile cache (built once on room entry, patched when crumble tiles
 * vanish/return or boss seals drop), dynamic tile overlays (pool surfaces,
 * shaking crumble tiles), fog + vignette (gradients pre-rendered once per
 * zone — nothing here allocates per frame), and the shared drawing of movers,
 * restore nodes, the vendor figure and pickups. All art is procedural canvas paths; colours come
 * from UB.Palette and the zone palette. Presentation polish (hand-drawn
 * jitter, merged edge polylines, zone props) can be layered on later without
 * changing any call signature.
 */
'use strict';
(function (UB) {
  const TILE = 30;
  const BG_W = 1280, BG_H = 720;
  const P = UB.Palette;
  const bgCache = Object.create(null);  // zoneId → {bg0,bg1,bg2,scale}
  let vignette = null;
  // Backing scale (the canvas devicePixelRatio / crisp-letterbox scale, 1–2). Every full-screen cache
  // (parallax layers, fog hole, vignette) is built at this scale and blitted 1:1, so a DPR-2 frame costs
  // the pixel count, not a bilinear upscale of 1× caches (which was ~10× in software raster).
  let scale = 1;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }

  const Render = { rrect: rrect, makeCanvas: makeCanvas, scale: 1 };
  /** main.js/engine: the backing scale changed → every scale-bound cache is rebuilt on first use. */
  Render.setScale = function (s) {
    s = s > 0 ? s : 1;
    if (s === scale) return;
    scale = s; Render.scale = s;
    for (const k in bgCache) delete bgCache[k];
    vignette = null;   // the fog hole compares its own scale
  };

  // --- backgrounds (DESIGN §11.1.5, simplified) --------------------------------------
  Render.buildBackground = function (zone) {
    const have = bgCache[zone.id];
    if (have && have.scale === scale) return have;
    // The WORLD module paints the per-zone parallax of DESIGN §11.1.5 (UB.World.background);
    // the generic painter below is only the fallback when it is absent.
    if (UB.World && typeof UB.World.background === 'function') { bgCache[zone.id] = UB.World.background(zone, scale); return bgCache[zone.id]; }
    const pal = zone.palette;
    const rng = UB.Util.rng(zone.index * 1000 + 7);
    const s = scale;
    const bg0 = makeCanvas(Math.round(BG_W * s), Math.round(BG_H * s)), bg1 = makeCanvas(Math.round(BG_W * s), Math.round(BG_H * s)), bg2 = makeCanvas(Math.round(BG_W * s), Math.round(BG_H * s));
    // bg0: void gradient + dust dots
    let c = bg0.getContext('2d'); c.setTransform(s, 0, 0, s, 0, 0);
    const g = c.createLinearGradient(0, 0, 0, BG_H);
    g.addColorStop(0, pal.bg0); g.addColorStop(0.6, pal.bg0); g.addColorStop(1, pal.bg1);
    c.fillStyle = g; c.fillRect(0, 0, BG_W, BG_H);
    c.fillStyle = P.PAPER;
    for (let i = 0; i < 40; i++) {
      c.globalAlpha = 0.06 + rng() * 0.06;
      c.beginPath(); c.arc(rng() * BG_W, rng() * BG_H, 1 + rng(), 0, Math.PI * 2); c.fill();
    }
    // bg1: far silhouettes — hanging cables and leaning slabs
    c = bg1.getContext('2d'); c.setTransform(s, 0, 0, s, 0, 0);
    c.strokeStyle = pal.bg1; c.fillStyle = pal.bg1; c.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const x0 = rng() * BG_W, x1 = x0 + 120 + rng() * 300, sag = 80 + rng() * 120;
      c.lineWidth = 4 + rng() * 4;
      c.beginPath(); c.moveTo(x0, 0); c.bezierCurveTo(x0 + 40, sag, x1 - 40, sag, x1, 0); c.stroke();
    }
    for (let i = 0; i < 7; i++) {
      const w = 40 + rng() * 50, h = 120 + rng() * 140, x = rng() * BG_W, lean = (rng() - 0.5) * 0.28;
      c.save(); c.translate(x, BG_H); c.rotate(lean);
      rrect(c, -w / 2, -h, w, h, 6); c.fill();
      c.restore();
    }
    // bg2: mid layer — smaller, denser slabs and a few glow lamps
    c = bg2.getContext('2d'); c.setTransform(s, 0, 0, s, 0, 0);
    c.fillStyle = pal.bg2;
    for (let i = 0; i < 11; i++) {
      const w = 20 + rng() * 30, h = 60 + rng() * 90, x = rng() * BG_W, lean = (rng() - 0.5) * 0.3;
      c.save(); c.translate(x, BG_H); c.rotate(lean);
      rrect(c, -w / 2, -h, w, h, 4); c.fill();
      c.strokeStyle = pal.tileEdge; c.lineWidth = 2; c.globalAlpha = 0.5;
      c.beginPath(); c.moveTo(-w / 2, -h); c.lineTo(w / 2, -h); c.stroke();
      c.restore();
      c.globalAlpha = 1;
    }
    c.fillStyle = pal.glow;
    for (let i = 0; i < 8; i++) {
      c.globalAlpha = 0.35; c.beginPath(); c.arc(rng() * BG_W, BG_H - 60 - rng() * 300, 3, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    bgCache[zone.id] = { bg0: bg0, bg1: bg1, bg2: bg2, scale: s };
    return bgCache[zone.id];
  };

  // Layers are BG_W×BG_H logical px at the backing scale: the 9-argument drawImage maps the whole
  // bitmap onto BG_W×BG_H logical px, which under the dpr transform is a 1:1 copy.
  function drawWrapped(ctx, img, ox, oy) {
    ox = ((ox % BG_W) + BG_W) % BG_W; oy = ((oy % BG_H) + BG_H) % BG_H;
    const iw = img.width, ih = img.height;
    for (let dx = ox - BG_W; dx < 960; dx += BG_W) {
      for (let dy = oy - BG_H; dy < 540; dy += BG_H) ctx.drawImage(img, 0, 0, iw, ih, dx, dy, BG_W, BG_H);
    }
  }
  /** Draw the three parallax layers for the camera position (logical px). */
  Render.drawBackground = function (ctx, zone, camX, camY) {
    const b = Render.buildBackground(zone);
    ctx.drawImage(b.bg0, 0, 0, b.bg0.width, b.bg0.height, 0, 0, BG_W, BG_H);
    drawWrapped(ctx, b.bg1, -camX * 0.25, -camY * 0.125 - 180);
    drawWrapped(ctx, b.bg2, -camX * 0.5, -camY * 0.25 - 180);
  };

  // --- ambient dynamic layer (DESIGN §11.1.6): per zone, ≤ 60 primitives, stateless (seeded by index + frame)
  // Drawn between bg2 and the tiles in screen space; particles follow the camera at 0.8× so they read as
  // part of the room rather than the backdrop. Nothing is allocated per frame.
  const AMB_N = { driftcache: 24, loomworks: 20, brinevault: 20, nullspire: 40, rootwell: 24 };
  const FW = 1024, FH = 604;   // particle field (screen + 64 px margin) so wrapped motes never pop at the edges
  function fieldX(i, frame, v, camX, k) { const b = UB.Util.hash(i, 11, k, 1) % FW; return ((b + v * frame - camX * 0.8) % FW + FW) % FW - 32; }
  function fieldY(i, frame, v, camY, k) { const b = UB.Util.hash(i, 23, k, 2) % FH; return ((b + v * frame - camY * 0.8) % FH + FH) % FH - 32; }
  Render.drawAmbient = function (ctx, zone, level, frame, camX, camY) {
    const n = AMB_N[zone.id]; if (!n) return;
    const pal = zone.palette, id = zone.id, hash = UB.Util.hash;
    ctx.save();
    if (id === 'driftcache') {            // drifting dust motes r 1.5 PAPER α 0.25; vx −6..6, vy −10 px/s, wrap
      ctx.fillStyle = P.PAPER; ctx.globalAlpha = 0.25;
      for (let i = 0; i < n; i++) {
        const vx = ((hash(i, 3, 0, 9) % 13) - 6) / 60, x = fieldX(i, frame, vx, camX, 1), y = fieldY(i, frame, -10 / 60, camY, 1);
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    } else if (id === 'loomworks') {      // sparks r 1–2 glow α 0.4 rising 40 px/s from the floor channels, sway ±6, life 50 f
      ctx.fillStyle = pal.glow;
      for (let i = 0; i < n; i++) {
        const age = (frame + i * 17) % 50, r = 1 + (hash(i, 5, 0, 9) % 2);
        const x = fieldX(i, 0, 0, camX, 2) + Math.sin((age + i * 5) / 8) * 6, y0 = fieldY(i, 0, 0, camY, 2);
        ctx.globalAlpha = 0.4 * (age < 10 ? age / 10 : (age > 40 ? (50 - age) / 10 : 1));
        ctx.beginPath(); ctx.arc(x, y0 - age * (40 / 60), r, 0, Math.PI * 2); ctx.fill();
      }
    } else if (id === 'brinevault') {     // 12 drips (2×6 hazard beads, 240 px/s, splash into 3 dots) + 8 slow bubbles r 2–3
      ctx.fillStyle = pal.hazard;
      for (let i = 0; i < 12; i++) {
        const len = 160 + (hash(i, 7, 0, 9) % 300), cycle = len / 4 + 24, age = (frame * 1 + i * 37) % cycle;
        const x = fieldX(i, 0, 0, camX, 3), y0 = fieldY(i, 0, 0, camY, 3) - 300;
        if (age * 4 < len) { ctx.globalAlpha = 0.8; ctx.fillRect(x - 1, y0 + age * 4, 2, 6); }
        else {
          const k = (age - len / 4) / 24; ctx.globalAlpha = 0.6 * (1 - k);
          for (let d = -1; d <= 1; d++) { ctx.beginPath(); ctx.arc(x + d * (4 + k * 8), y0 + len - k * 10 + 6, 1.5, 0, Math.PI * 2); ctx.fill(); }
        }
      }
      ctx.fillStyle = pal.glow; ctx.globalAlpha = 0.3;
      for (let i = 0; i < 8; i++) {
        const x = fieldX(i + 50, 0, 0, camX, 4) + Math.sin((frame + i * 9) / 20) * 3, y = fieldY(i + 50, frame, -18 / 60, camY, 4), r = 2 + (hash(i, 9, 0, 9) % 2);
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
    } else if (id === 'nullspire') {      // static flecks 2×2 glow α 0.5, teleporting every 3 f
      ctx.fillStyle = pal.glow; ctx.globalAlpha = 0.5;
      const step = Math.floor(frame / 3);
      for (let i = 0; i < n; i++) ctx.fillRect(hash(step, i, 1, 7) % 960, hash(step, i, 2, 7) % 540, 2, 2);
    } else if (id === 'rootwell') {       // ember motes r 2 glow α 0.35, vy −14, sin drift ±8, wrap
      ctx.fillStyle = pal.glow; ctx.globalAlpha = 0.35;
      for (let i = 0; i < n; i++) {
        const x = fieldX(i, 0, 0, camX, 5) + Math.sin((frame + i * 13) / 30) * 8, y = fieldY(i, frame, -14 / 60, camY, 5);
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  };

  // --- static tile cache (DESIGN §11.1.4, §11.1.8) ------------------------------------
  function drawTile(c, level, tx, ty, rng, s) {
    const pal = level.zone.palette;
    const ch = UB.Entity.tileAt(level, tx, ty);
    const x = tx * TILE, y = ty * TILE;
    if (ch === '#' || ch === 'c') {
      c.fillStyle = pal.tileFill; c.fillRect(x, y, TILE, TILE);
      // hatch
      c.strokeStyle = pal.tileShade; c.lineWidth = 1; c.globalAlpha = 0.55;
      const n = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const hx = x + 3 + rng() * 22, hy = y + 3 + rng() * 22, len = 6 + rng() * 6, ang = (-35 + (rng() - 0.5) * 20) * UB.Util.DEG;
        c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + Math.cos(ang) * len, hy + Math.sin(ang) * len); c.stroke();
      }
      c.globalAlpha = 1;
      // exposed edges
      const up = !UB.Entity.solidAt(level, tx, ty - 1), dn = !UB.Entity.solidAt(level, tx, ty + 1);
      const lf = !UB.Entity.solidAt(level, tx - 1, ty), rt = !UB.Entity.solidAt(level, tx + 1, ty);
      c.lineCap = 'round'; c.lineJoin = 'round';
      if (up) { c.strokeStyle = pal.tileEdge; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y + 2.5); c.lineTo(x + TILE, y + 2.5); c.stroke(); }
      c.strokeStyle = P.INK; c.lineWidth = 3;
      c.beginPath();
      if (up) { c.moveTo(x, y); c.lineTo(x + TILE, y); }
      if (dn) { c.moveTo(x, y + TILE); c.lineTo(x + TILE, y + TILE); }
      if (lf) { c.moveTo(x, y); c.lineTo(x, y + TILE); }
      if (rt) { c.moveTo(x + TILE, y); c.lineTo(x + TILE, y + TILE); }
      c.stroke();
      if (level.sealedMask[ty * level.room.w + tx]) { // boss shutter slats
        c.strokeStyle = P.INK; c.lineWidth = 2;
        for (let i = 1; i <= 3; i++) { c.beginPath(); c.moveTo(x + 3, y + i * 7.5); c.lineTo(x + TILE - 3, y + i * 7.5); c.stroke(); }
      }
      if (ch === 'c') { // cracks + dashed rim
        c.strokeStyle = P.INK; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(x + 6, y + 4); c.lineTo(x + 14, y + 14); c.lineTo(x + 10, y + 26);
        c.moveTo(x + 22, y + 6); c.lineTo(x + 17, y + 16); c.lineTo(x + 25, y + 24); c.stroke();
        c.save(); c.setLineDash([4, 3]); c.strokeStyle = pal.tileEdge; c.lineWidth = 2; c.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6); c.restore();
      }
    } else if (ch === '-') {
      // Adjacent '-' tiles merge into one bar: only the leftmost tile of a run draws it
      // (partial redraws clip to their rect, so the bar stays consistent).
      if (UB.Entity.tileAt(level, tx - 1, ty) === '-') return;
      let n = 1; while (UB.Entity.tileAt(level, tx + n, ty) === '-') n++;
      c.fillStyle = pal.tileFill; c.strokeStyle = P.INK; c.lineWidth = 3; c.lineJoin = 'round';
      rrect(c, x, y, n * TILE, 8, 4); c.fill(); c.stroke();
      c.strokeStyle = pal.tileEdge; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 3, y + 2.5); c.lineTo(x + n * TILE - 3, y + 2.5); c.stroke();
      c.strokeStyle = pal.tileShade; c.lineWidth = 1; c.globalAlpha = 0.6;
      for (let i = 0; i < n * 2; i++) { c.beginPath(); c.moveTo(x + 8 + i * 15, y + 6); c.lineTo(x + 12 + i * 15, y + 2); c.stroke(); }
      c.globalAlpha = 1;
    } else if (ch === '^' || ch === 'v') {
      c.fillStyle = P.SPIKE; c.strokeStyle = P.INK; c.lineWidth = 2; c.lineJoin = 'round';
      for (let i = 0; i < 2; i++) {
        const bx = x + i * 15;
        c.beginPath();
        if (ch === '^') { c.moveTo(bx, y + TILE); c.lineTo(bx + 7.5, y + TILE - 22); c.lineTo(bx + 15, y + TILE); }
        else { c.moveTo(bx, y); c.lineTo(bx + 7.5, y + 22); c.lineTo(bx + 15, y); }
        c.closePath(); c.fill(); c.stroke();
        c.fillStyle = P.PAPER; c.beginPath(); c.arc(bx + 7.5, ch === '^' ? y + TILE - 19 : y + 19, 1.2, 0, Math.PI * 2); c.fill();
        c.fillStyle = P.SPIKE;
      }
    } else if (ch === '~') {
      c.globalAlpha = 0.75; c.fillStyle = level.zone.poolKind === 'static' ? pal.glow : pal.hazard;
      c.fillRect(x, y + 8, TILE, TILE - 8); c.globalAlpha = 1;
    } else if (ch === 'B' && !(UB.World && typeof UB.World.drawProps === 'function')) {
      // fallback stub for a zone prop when the WORLD painter (UB.World.drawProps, DESIGN §5.4) is absent
      c.fillStyle = pal.accent; c.strokeStyle = P.INK; c.lineWidth = 2;
      rrect(c, x + 8, y + 10, 14, 20, 3); c.fill(); c.stroke();
      c.fillStyle = pal.glow; c.beginPath(); c.arc(x + 15, y + 15, 2, 0, Math.PI * 2); c.fill();
    }
  }

  /** Build (or rebuild) the room's static tile cache. */
  Render.buildTileCache = function (level, dpr) {
    const room = level.room;
    const w = room.w * TILE, h = room.h * TILE;
    let s = dpr || 1;
    if (w * h * s * s > 16000000) s = 1; // memory cap for very large rooms
    level.cacheScale = s;
    if (!level.tileCache || level.tileCache.width !== w * s || level.tileCache.height !== h * s) {
      level.tileCache = makeCanvas(w * s, h * s);
    }
    const c = level.tileCache.getContext('2d');
    c.setTransform(s, 0, 0, s, 0, 0);
    c.clearRect(0, 0, w, h);
    Render.redrawTiles(level, 0, 0, room.w - 1, room.h - 1);
    return level.tileCache;
  };
  /** Re-draw a tile rectangle of the cache (inclusive tile bounds). */
  Render.redrawTiles = function (level, tx0, ty0, tx1, ty1) {
    if (!level || !level.tileCache) return;   // nothing to redraw before buildTileCache (the full build follows)
    const room = level.room, s = level.cacheScale;
    const c = level.tileCache.getContext('2d');
    c.setTransform(s, 0, 0, s, 0, 0);
    tx0 = Math.max(0, tx0); ty0 = Math.max(0, ty0); tx1 = Math.min(room.w - 1, tx1); ty1 = Math.min(room.h - 1, ty1);
    c.clearRect(tx0 * TILE, ty0 * TILE, (tx1 - tx0 + 1) * TILE, (ty1 - ty0 + 1) * TILE);
    c.save();
    c.beginPath(); c.rect(tx0 * TILE, ty0 * TILE, (tx1 - tx0 + 1) * TILE, (ty1 - ty0 + 1) * TILE); c.clip();
    const seedBase = (level.room.gx * 7919 + level.room.gy * 131 + level.room.id.length * 17) | 0;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      drawTile(c, level, tx, ty, UB.Util.rng(seedBase + tx * 131 + ty * 7), s);
    }
    c.restore();
    // zone props (`B` tiles, DESIGN §5.4) are painted by the WORLD module into the same cache
    if (UB.World && typeof UB.World.drawProps === 'function') UB.World.drawProps(level, tx0, ty0, tx1, ty1);
  };
  Render.buildBackground.worldAware = true;   // world.js's hook installer sees these and leaves them alone
  Render.redrawTiles.worldAware = true;
  /** Blit the visible part of the tile cache for camera (camX, camY). */
  Render.drawTileCache = function (ctx, level, camX, camY) {
    const s = level.cacheScale;
    ctx.drawImage(level.tileCache, camX * s, camY * s, 960 * s, 540 * s, 0, 0, 960, 540);
  };
  /** Dynamic overlays in world space: pool surfaces, shaking crumble tiles. */
  Render.drawDynamicTiles = function (ctx, level, frame, camX, camY) {
    const room = level.room, pal = level.zone.palette;
    const tx0 = Math.max(0, Math.floor(camX / TILE)), tx1 = Math.min(room.w - 1, Math.floor((camX + 960) / TILE));
    const ty0 = Math.max(0, Math.floor(camY / TILE)), ty1 = Math.min(room.h - 1, Math.floor((camY + 540) / TILE));
    ctx.strokeStyle = pal.glow; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const ch = room.tiles[ty][tx];
      if (ch === '~') {
        const x = tx * TILE, y = ty * TILE + 8;
        ctx.beginPath();
        for (let i = 0; i <= 5; i++) ctx.lineTo(x + i * 6, y + Math.sin((x + i * 6) / 24 * Math.PI * 2 + frame * 0.1) * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    const cr = level.crumble;
    for (let i = 0; i < cr.length; i++) {
      const t = cr[i];
      if (t.state !== 1) continue; // shaking
      const jx = UB.Util.jitter(frame, t.tx, 2), jy = UB.Util.jitter(frame, t.ty + 99, 2);
      const s = level.cacheScale;
      ctx.drawImage(level.tileCache, t.tx * TILE * s, t.ty * TILE * s, TILE * s, TILE * s, t.tx * TILE + jx, t.ty * TILE + jy, TILE, TILE);
    }
  };

  // --- movers, nodes, pickups ---------------------------------------------------------
  Render.drawPlatform = function (ctx, p, zone, alpha) {
    const x = UB.Util.lerp(p.px, p.x, alpha), y = UB.Util.lerp(p.py, p.y, alpha);
    ctx.fillStyle = zone.palette.tileFill; ctx.strokeStyle = P.INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    rrect(ctx, x, y, p.w, 8, 4); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = zone.palette.tileEdge; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 3, y + 2.5); ctx.lineTo(x + p.w - 3, y + 2.5); ctx.stroke();
    ctx.fillStyle = zone.palette.accent; // belt rollers
    ctx.beginPath(); ctx.arc(x + 6, y + 4, 5, 0, Math.PI * 2); ctx.arc(x + p.w - 6, y + 4, 5, 0, Math.PI * 2); ctx.fill();
  };
  Render.drawNode = function (ctx, x, y, zone, used, t, pulse) {
    const pal = zone.palette;
    ctx.fillStyle = pal.accent; ctx.strokeStyle = P.INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y); ctx.lineTo(x + 8, y - 40); ctx.lineTo(x - 8, y - 40); ctx.closePath();
    ctx.fill(); ctx.stroke();
    const a = used ? 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t / 90 * Math.PI * 2)) : 0.3;
    ctx.save(); ctx.globalAlpha = Math.min(1, a + pulse); ctx.fillStyle = pal.glow;
    if (used || pulse > 0) { ctx.shadowColor = pal.glow; ctx.shadowBlur = 18; }
    ctx.beginPath(); ctx.moveTo(x, y - 54); ctx.lineTo(x + 5, y - 47); ctx.lineTo(x, y - 40); ctx.lineTo(x - 5, y - 47); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  function hexagon(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath();
  }
  Render.drawPickup = function (ctx, p, t, alpha) {
    const x = UB.Util.lerp(p.px, p.x, alpha), y = UB.Util.lerp(p.py, p.y, alpha) - p.h / 2;
    ctx.save();
    if (p.life > 0 && p.life < 120 && ((p.life >> 2) & 1)) { ctx.restore(); return; } // expiring blink
    ctx.lineJoin = 'round'; ctx.strokeStyle = P.INK; ctx.lineWidth = 2;
    if (p.type === 'bit') {
      const r = p.size === 'large' ? 8 : (p.size === 'medium' ? 6 : 4);
      ctx.translate(x, y); ctx.scale(Math.max(0.15, Math.abs(Math.cos(t / 20))), 1);
      if (p.size === 'large') { ctx.shadowColor = P.BITS; ctx.shadowBlur = 10; }
      ctx.fillStyle = P.BITS; hexagon(ctx, 0, 0, r); ctx.fill(); ctx.stroke();
      if (p.size !== 'small') { ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.stroke(); }
    } else if (p.type === 'heart') {
      const bob = Math.sin(t / 25) * 2;
      ctx.fillStyle = P.HEART; rrect(ctx, x - 5, y - 7 + bob, 10, 14, 3); ctx.fill(); ctx.stroke();
    } else if (p.type === 'spark') {
      const bob = Math.sin(t / 20) * 3;
      ctx.fillStyle = P.ENERGY; ctx.shadowColor = P.ENERGY; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(x, y - 7 + bob); ctx.lineTo(x + 2, y - 2 + bob); ctx.lineTo(x + 7, y + bob); ctx.lineTo(x + 2, y + 2 + bob);
      ctx.lineTo(x, y + 7 + bob); ctx.lineTo(x - 2, y + 2 + bob); ctx.lineTo(x - 7, y + bob); ctx.lineTo(x - 2, y - 2 + bob); ctx.closePath(); ctx.fill();
    } else if (p.type === 'shard') {
      ctx.translate(x, y); ctx.scale(Math.max(0.15, Math.abs(Math.cos(t / 16))), 1);
      ctx.fillStyle = P.METER; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(4, 0); ctx.lineTo(0, 8); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.METER_READY; ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'core' || p.type === 'ability') {
      const s = p.type === 'ability' ? 1.5 : 1;
      const bob = p.type === 'ability' ? Math.sin(t / 60 * Math.PI * 2) * 4 : 0;
      ctx.fillStyle = p.type === 'ability' ? (p.glow || P.CORE_HEART) : P.CORE_HEART;
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(x, y - 8 * s + bob); ctx.lineTo(x + 6 * s, y + bob); ctx.lineTo(x, y + 8 * s + bob); ctx.lineTo(x - 6 * s, y + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = P.INK;
      ctx.beginPath(); ctx.moveTo(x, y - 3 * s + bob); ctx.lineTo(x + 2 * s, y + bob); ctx.lineTo(x, y + 3 * s + bob); ctx.lineTo(x - 2 * s, y + bob); ctx.closePath(); ctx.fill();
      ctx.fillStyle = P.PAPER;
      for (let i = 0; i < 3; i++) { const a = t / 120 * Math.PI * 2 + i * Math.PI * 2 / 3; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 14 * s, y + bob + Math.sin(a) * 14 * s, 2, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
  };

  // --- vendor figure (DESIGN §9.5: Scrivvet) ---------------------------------------------------
  /**
   * Scrivvet at feet (x, y): a hunched cable-scrap cloak, a lantern-eye on a stalk that tracks
   * `lookX` (the player's x), six small sorting hands on a 3-frame loop. Nothing humanoid.
   */
  Render.drawVendor = function (ctx, x, y, zone, t, lookX) {
    const cloak = '#2a3a5c', hands = '#6c86b8', eye = '#ffcf5a';
    const dir = lookX < x ? -1 : 1;
    ctx.save(); ctx.translate(x, y);
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = P.INK;
    // cloak: a hunched mound of cable scraps
    ctx.fillStyle = cloak;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(-22, -26, -8, -38); ctx.quadraticCurveTo(4, -46, 14, -34);
    ctx.quadraticCurveTo(22, -22, 18, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = hands; ctx.lineWidth = 2; ctx.globalAlpha = 0.7;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-14 + i * 8, -6 - (i & 1) * 6); ctx.lineTo(-10 + i * 8, -22 - (i & 1) * 4); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // six hands sorting (3-frame loop)
    const ph = ((t / 3) | 0) % 3;
    ctx.fillStyle = hands; ctx.strokeStyle = P.INK; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const hx = -15 + i * 6, hy = -12 + ((i + ph) % 3) * 3;
      ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    // lantern-eye on a stalk, tracking the player
    ctx.strokeStyle = hands; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(2, -36); ctx.quadraticCurveTo(2 + dir * 6, -48, 2 + dir * 10, -54); ctx.stroke();
    ctx.fillStyle = eye; ctx.strokeStyle = P.INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(2 + dir * 10, -56, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.INK; ctx.beginPath(); ctx.arc(2 + dir * 12, -56, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  // --- fog & vignette (DESIGN §11.1.7) -----------------------------------------------------
  // The fog "hole" (radial gradient: clear at r 120 → zone fog at r 520) is pre-rendered once per
  // zone/scale into ONE 1040 px square canvas at the backing scale (a 1:1 blit of its visible part
  // per frame; 4.3 MB at scale 1, 17 MB at scale 2 — rebuilt on a zone change, never per frame);
  // the area outside the square is plain fog colour.
  const HOLE = 1040, HOLE_HALF = HOLE / 2;
  let fogHoleC = null, fogHoleZone = null, fogHoleScale = 0;
  function fogHole(zone) {
    if (fogHoleC && fogHoleZone === zone.id && fogHoleScale === scale) return fogHoleC;
    const s = scale, size = Math.round(HOLE * s);
    if (!fogHoleC || fogHoleC.width !== size) fogHoleC = makeCanvas(size, size);
    const g2 = fogHoleC.getContext('2d'); g2.setTransform(s, 0, 0, s, 0, 0); g2.clearRect(0, 0, HOLE, HOLE);
    const g = g2.createRadialGradient(HOLE_HALF, HOLE_HALF, 120, HOLE_HALF, HOLE_HALF, 520);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, zone.palette.fog);
    g2.fillStyle = g; g2.fillRect(0, 0, HOLE, HOLE);
    fogHoleZone = zone.id; fogHoleScale = s;
    return fogHoleC;
  }
  Render.drawFog = function (ctx, zone, px, py, isBoss) {
    ctx.fillStyle = zone.palette.fog; ctx.fillRect(0, 0, 960, 540);
    if (isBoss) return;
    const hole = fogHole(zone), s = scale;
    const hx = px - HOLE_HALF, hy = py - HOLE_HALF;
    ctx.globalAlpha = 0.5;
    // only the visible part of the square is blitted (1:1 at the backing scale)
    const x0 = Math.max(0, hx), y0 = Math.max(0, hy), x1 = Math.min(960, hx + HOLE), y1 = Math.min(540, hy + HOLE);
    if (x1 > x0 && y1 > y0) ctx.drawImage(hole, (x0 - hx) * s, (y0 - hy) * s, (x1 - x0) * s, (y1 - y0) * s, x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = zone.palette.fog;
    // the four bands around the square (only the parts inside the screen)
    if (hy > 0) ctx.fillRect(0, 0, 960, hy);
    if (hy + HOLE < 540) ctx.fillRect(0, hy + HOLE, 960, 540 - hy - HOLE);
    if (hx > 0) ctx.fillRect(0, Math.max(0, hy), hx, Math.min(540, hy + HOLE) - Math.max(0, hy));
    if (hx + HOLE < 960) ctx.fillRect(hx + HOLE, Math.max(0, hy), 960 - hx - HOLE, Math.min(540, hy + HOLE) - Math.max(0, hy));
    ctx.globalAlpha = 1;
  };
  Render.drawVignette = function (ctx) {
    if (!vignette) {
      const s = scale;
      vignette = makeCanvas(Math.round(960 * s), Math.round(540 * s));
      const c = vignette.getContext('2d'); c.setTransform(s, 0, 0, s, 0, 0);
      const g = c.createRadialGradient(480, 270, 300, 480, 270, 640);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
      c.fillStyle = g; c.fillRect(0, 0, 960, 540);
    }
    ctx.drawImage(vignette, 0, 0, vignette.width, vignette.height, 0, 0, 960, 540);
  };

  UB.Render = Render;
})(window.UB);
