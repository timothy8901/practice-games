/**
 * Overworld camera (ARCHITECTURE §4.3, §12). Pure: no DOM, no canvas.
 *
 * The camera is a rectangle `viewW x viewH` game pixels over the map's pixel space. It follows a
 * target (any object with `px, py`, such as an Entity, or `x, y` in tiles), eases toward it with
 * a frame-rate-independent lerp inside the fixed-step loop, clamps to the map (or a named region)
 * and snaps to whole pixels so tiles and sprites stay crisp. Shake is a deterministic function of
 * elapsed time, never `Math.random` (rule 5), so a replay renders identically.
 *
 * Hot-path contract (§12 "no per-frame allocation"): {@link Camera.visibleTiles},
 * {@link Camera.worldToScreen}, {@link Camera.screenToWorld}, {@link Camera.shakeOffset} and
 * {@link Camera.center} return **reused** objects; copy them if you keep them.
 *
 * Lane: WORLD-MAP.
 * @module world/camera
 */

/** @typedef {import('./tilemap.js').RuntimeMap} RuntimeMap */
/** @typedef {import('./tilemap.js').Rect} Rect */

/** Fixed simulation step the lerp is normalised to (config.TICK_MS; config is BOOT-owned so the value is repeated here). */
export const CAMERA_TICK_MS = 1000 / 60;

/** Default follow lerp per tick: 0.18 reaches 90 % of the way in ~12 ticks (200 ms). */
export const DEFAULT_LERP = 0.18;

/** Shake oscillation (radians per ms) on each axis; incommensurate so the path never repeats visibly. */
const SHAKE_WX = 0.071;
const SHAKE_WY = 0.053;

/**
 * @typedef {Object} CameraOptions
 * @property {number} [viewW=480]   view width in game pixels (config.NATIVE_W)
 * @property {number} [viewH=270]   view height in game pixels (config.NATIVE_H)
 * @property {number} [tile=16]     tile edge in pixels (config.TILE)
 */

/**
 * @typedef {Object} Camera
 * @property {number} x   snapped left edge in world pixels, shake included: what the renderer subtracts
 * @property {number} y   snapped top edge in world pixels, shake included
 * @property {number} rawX  eased, unsnapped left edge (no shake)
 * @property {number} rawY
 * @property {number} viewW
 * @property {number} viewH
 * @property {number} tile
 * @property {Rect|null} limits   current pixel clamp `{x, y, w, h}` or `null` when unbounded
 * @property {{px: number, py: number}|{x: number, y: number}|null} target
 * @property {(target: {px?: number, py?: number, x?: number, y?: number}|null, opts?: {lerp?: number, snap?: boolean}) => void} follow
 *   Start following `target` (tile `x, y` when it has no `px, py`); `snap` jumps there at once; `null` stops following.
 * @property {(wx: number, wy: number, opts?: {lerp?: number, snap?: boolean}) => void} lookAt   centre on a world pixel (cutscene pans)
 * @property {(map: RuntimeMap|{w: number, h: number}, region?: Rect|string|null) => void} bounds
 *   Clamp to the map, or to one of its named regions (`Rect` in tiles, or a region name). A map
 *   smaller than the view is centred (negative offset) so it letterboxes symmetrically.
 * @property {(limits: Rect|null) => void} setLimits   raw pixel clamp
 * @property {(dt: number) => void} update   ease toward the target, decay shake, clamp, snap
 * @property {(amount: number, ms: number) => void} shake   start (or strengthen) a shake of `amount` px for `ms`
 * @property {(on: boolean) => void} setShakeEnabled   `settings.reducedMotion` turns shake off
 * @property {() => {x: number, y: number}} shakeOffset   current offset (reused)
 * @property {() => Rect} visibleTiles   tile rect covering the view (+ nothing), clamped to the bounds map (reused)
 * @property {(wx: number, wy: number, out?: {x: number, y: number}) => {x: number, y: number}} worldToScreen
 * @property {(wx: number, wy: number) => {x: number, y: number}} toScreen   alias of `worldToScreen` (§4.3)
 * @property {(sx: number, sy: number, out?: {x: number, y: number}) => {x: number, y: number}} screenToWorld
 * @property {(sx: number, sy: number, out?: {x: number, y: number}) => {x: number, y: number}} screenToTile   tile under a screen pixel (floors)
 * @property {() => {x: number, y: number}} center   world pixel at the view centre (reused)
 * @property {(wx: number, wy: number, marginPx?: number) => boolean} isVisible
 * @property {() => void} snap   finish the ease instantly (map change, teleport)
 */

/**
 * @param {CameraOptions} [opts]
 * @returns {Camera}
 */
export function createCamera(opts) {
  const o = opts || {};
  const viewW = checkDim('viewW', o.viewW ?? 480);
  const viewH = checkDim('viewH', o.viewH ?? 270);
  const tile = checkDim('tile', o.tile ?? 16);

  let rawX = 0;
  let rawY = 0;
  let tx = 0;
  let ty = 0;
  let snappedX = 0;
  let snappedY = 0;
  /** @type {any} */
  let target = null;
  let lerp = DEFAULT_LERP;
  /** @type {Rect|null} */
  let limits = null;
  let mapW = 0;
  let mapH = 0;

  let shakeOn = true;
  let shakeAmp = 0;
  let shakeTotal = 0;
  let shakeLeft = 0;
  let shakeT = 0;
  let shakeX = 0;
  let shakeY = 0;

  const rect = { x: 0, y: 0, w: 0, h: 0 };
  const pt = { x: 0, y: 0 };
  const shakePt = { x: 0, y: 0 };
  const centerPt = { x: 0, y: 0 };

  /** Reads the target's centre into tx, ty (as a camera origin). */
  function aim() {
    if (!target) return;
    let cx;
    let cy;
    if (Number.isFinite(target.px) && Number.isFinite(target.py)) {
      cx = target.px + tile / 2;
      cy = target.py + tile / 2;
    } else if (Number.isFinite(target.x) && Number.isFinite(target.y)) {
      cx = target.x * tile + tile / 2;
      cy = target.y * tile + tile / 2;
    } else {
      return;
    }
    tx = cx - viewW / 2;
    ty = cy - viewH / 2;
  }

  function clamp() {
    if (!limits) return;
    rawX = clampAxis(rawX, limits.x, limits.w, viewW);
    rawY = clampAxis(rawY, limits.y, limits.h, viewH);
  }

  function snapPixels() {
    snappedX = Math.round(rawX) + shakeX;
    snappedY = Math.round(rawY) + shakeY;
  }

  function jump() {
    aim();
    rawX = tx;
    rawY = ty;
    clamp();
    snapPixels();
  }

  /** @type {Camera} */
  const cam = {
    get x() { return snappedX; },
    get y() { return snappedY; },
    get rawX() { return rawX; },
    get rawY() { return rawY; },
    get viewW() { return viewW; },
    get viewH() { return viewH; },
    get tile() { return tile; },
    get limits() { return limits; },
    get target() { return target; },

    follow(t, fo) {
      target = t || null;
      if (fo && fo.lerp !== undefined) lerp = checkLerp(fo.lerp);
      if (fo && fo.snap) jump();
      else aim();
    },

    lookAt(wx, wy, fo) {
      if (!Number.isFinite(wx) || !Number.isFinite(wy)) throw new TypeError('camera.lookAt: wx, wy must be finite');
      target = null;
      tx = wx - viewW / 2;
      ty = wy - viewH / 2;
      if (fo && fo.lerp !== undefined) lerp = checkLerp(fo.lerp);
      if (fo && fo.snap) {
        rawX = tx;
        rawY = ty;
        clamp();
        snapPixels();
      }
    },

    bounds(map, region) {
      if (!map || !Number.isInteger(map.w) || !Number.isInteger(map.h)) throw new TypeError('camera.bounds: map must have integer w, h');
      mapW = map.w;
      mapH = map.h;
      let r = null;
      if (typeof region === 'string') {
        r = map.regions && map.regions[region];
        if (!r) throw new Error(`camera.bounds: map '${map.id}' has no region '${region}'`);
      } else if (region && typeof region === 'object') {
        r = region;
      }
      limits = r
        ? { x: r.x * tile, y: r.y * tile, w: r.w * tile, h: r.h * tile }
        : { x: 0, y: 0, w: map.w * tile, h: map.h * tile };
      clamp();
      snapPixels();
    },

    setLimits(l) {
      limits = l ? { x: l.x, y: l.y, w: l.w, h: l.h } : null;
      clamp();
      snapPixels();
    },

    update(dt) {
      if (!Number.isFinite(dt) || dt < 0) throw new TypeError('camera.update: dt must be a non-negative number');
      aim();
      const f = lerp >= 1 ? 1 : 1 - Math.pow(1 - lerp, dt / CAMERA_TICK_MS);
      rawX += (tx - rawX) * f;
      rawY += (ty - rawY) * f;
      // settle: below a 1/64 px the ease is done, so the snapped position stops dithering
      if (Math.abs(tx - rawX) < 1 / 64) rawX = tx;
      if (Math.abs(ty - rawY) < 1 / 64) rawY = ty;
      clamp();
      if (shakeLeft > 0) {
        shakeLeft = Math.max(0, shakeLeft - dt);
        shakeT += dt;
        const decay = shakeTotal > 0 ? shakeLeft / shakeTotal : 0;
        const a = shakeOn ? shakeAmp * decay : 0;
        // `+ 0` folds Math.round's -0 into 0 so offsets compare and serialise cleanly
        shakeX = Math.round(a * Math.sin(shakeT * SHAKE_WX)) + 0;
        shakeY = Math.round(a * Math.cos(shakeT * SHAKE_WY)) + 0;
        if (shakeLeft === 0) {
          shakeX = 0;
          shakeY = 0;
          shakeAmp = 0;
        }
      }
      snapPixels();
    },

    shake(amount, ms) {
      if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(ms) || ms <= 0) throw new TypeError('camera.shake: amount >= 0 and ms > 0 required');
      if (amount >= shakeAmp) {
        shakeAmp = amount;
        shakeTotal = ms;
        shakeLeft = ms;
        shakeT = 0;
      } else {
        shakeLeft = Math.max(shakeLeft, ms);
        shakeTotal = Math.max(shakeTotal, shakeLeft);
      }
    },

    setShakeEnabled(on) {
      shakeOn = Boolean(on);
      if (!shakeOn) {
        shakeX = 0;
        shakeY = 0;
        snapPixels();
      }
    },

    shakeOffset() {
      shakePt.x = shakeX;
      shakePt.y = shakeY;
      return shakePt;
    },

    visibleTiles() {
      let x0 = Math.floor(snappedX / tile);
      let y0 = Math.floor(snappedY / tile);
      let x1 = Math.ceil((snappedX + viewW) / tile);
      let y1 = Math.ceil((snappedY + viewH) / tile);
      if (mapW > 0) {
        if (x0 < 0) x0 = 0;
        if (y0 < 0) y0 = 0;
        if (x1 > mapW) x1 = mapW;
        if (y1 > mapH) y1 = mapH;
      }
      rect.x = x0;
      rect.y = y0;
      rect.w = Math.max(0, x1 - x0);
      rect.h = Math.max(0, y1 - y0);
      return rect;
    },

    worldToScreen(wx, wy, out) {
      const p = out || pt;
      p.x = wx - snappedX;
      p.y = wy - snappedY;
      return p;
    },

    toScreen(wx, wy) {
      pt.x = wx - snappedX;
      pt.y = wy - snappedY;
      return pt;
    },

    screenToWorld(sx, sy, out) {
      const p = out || pt;
      p.x = sx + snappedX;
      p.y = sy + snappedY;
      return p;
    },

    screenToTile(sx, sy, out) {
      const p = out || pt;
      p.x = Math.floor((sx + snappedX) / tile);
      p.y = Math.floor((sy + snappedY) / tile);
      return p;
    },

    center() {
      centerPt.x = snappedX + viewW / 2;
      centerPt.y = snappedY + viewH / 2;
      return centerPt;
    },

    isVisible(wx, wy, margin) {
      const m = margin || 0;
      return wx >= snappedX - m && wy >= snappedY - m && wx < snappedX + viewW + m && wy < snappedY + viewH + m;
    },

    snap() {
      jump();
    },
  };
  return cam;
}

/**
 * Clamps a camera origin so the view stays inside `[min, min + size)`; when the span is smaller
 * than the view the view is centred over it (a negative offset the renderer letterboxes).
 * @param {number} v
 * @param {number} min
 * @param {number} size
 * @param {number} view
 * @returns {number}
 */
export function clampAxis(v, min, size, view) {
  if (size <= view) return min - Math.floor((view - size) / 2);
  const max = min + size - view;
  return v < min ? min : v > max ? max : v;
}

/**
 * @param {string} name
 * @param {number} v
 * @returns {number}
 */
function checkDim(name, v) {
  if (!Number.isInteger(v) || v <= 0) throw new TypeError(`createCamera: ${name} must be a positive integer, got ${v}`);
  return v;
}

/**
 * @param {number} v
 * @returns {number}
 */
function checkLerp(v) {
  if (!Number.isFinite(v) || v <= 0 || v > 1) throw new TypeError(`camera: lerp must be in (0, 1], got ${v}`);
  return v;
}
