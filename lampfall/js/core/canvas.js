/**
 * @file Display / presentation layer for the game (core contract: `canvas.js`).
 *
 * The game renders into a fixed-size offscreen buffer (native 480x270 logical pixels) and
 * `present()` blits that buffer onto a visible canvas that fills its parent element:
 *
 * - `'integer'` mode: whole-number upscale **in device pixels** (so it stays crisp at any
 *   devicePixelRatio), centred with letterbox bars. If the parent is smaller than the native
 *   size the display falls back to fractional "fit" scaling so the whole frame stays visible.
 * - `'fit'` mode: fractional uniform scale that fills the parent as much as possible while
 *   keeping the aspect ratio (bars only on one axis).
 *
 * BROWSER-ONLY at use time: `createDisplay()` needs a DOM. Importing this module under Node is
 * safe because nothing touches `window`/`document` until `createDisplay()` is called, and the
 * layout math (`computeLayout`, `pointToGame`, `gameToPoint`, `normalizeDpr`) is pure.
 *
 * Coordinate vocabulary used throughout:
 * - *game px*: the 480x270 logical buffer.
 * - *CSS px*: what the DOM / pointer events use (`clientX`, `element.style.left`, ...).
 * - *device px*: the visible canvas's backing store (`canvas.width`), CSS px × devicePixelRatio.
 *
 * The parent must be a CSS-sized box with no padding (e.g. `position: fixed; inset: 0`); its
 * `clientWidth/clientHeight` is what the canvas fills. A `<body>`/`<html>` parent is measured
 * through `window.innerWidth/innerHeight` instead, so give such pages `overflow: hidden`.
 */

/** Native buffer width in game pixels. */
export const DEFAULT_WIDTH = 480;
/** Native buffer height in game pixels. */
export const DEFAULT_HEIGHT = 270;
/** Supported scaling modes. */
export const MODES = Object.freeze(['integer', 'fit']);

/** @typedef {'integer'|'fit'} DisplayMode */

/**
 * The result of laying the native buffer out inside the visible canvas. Immutable; a new one is
 * produced whenever the parent size, devicePixelRatio or mode changes.
 *
 * @typedef {object} Layout
 * @property {number} width          Native buffer width (game px).
 * @property {number} height         Native buffer height (game px).
 * @property {DisplayMode} mode      Mode that was requested.
 * @property {boolean} integer       True when the achieved device-pixel scale is a whole number
 *                                   >= 1: always in `'integer'` mode when the box is at least
 *                                   native size, and in `'fit'` mode only when the box happens
 *                                   to be an exact multiple of the native size.
 * @property {number} dpr            Effective device pixels per CSS px used for the backing store.
 * @property {number} cssWidth       Visible canvas width in CSS px.
 * @property {number} cssHeight      Visible canvas height in CSS px.
 * @property {number} backingWidth   Visible canvas backing-store width (device px).
 * @property {number} backingHeight  Visible canvas backing-store height (device px).
 * @property {number} pixelScale     Device px per game px (a whole number when `integer`).
 * @property {number} destWidth      Blitted frame width in device px.
 * @property {number} destHeight     Blitted frame height in device px.
 * @property {number} deviceOffsetX  Left edge of the frame inside the canvas (device px).
 * @property {number} deviceOffsetY  Top edge of the frame inside the canvas (device px).
 * @property {number} scale          CSS px per game px.
 * @property {number} offsetX        Left edge of the frame inside the canvas (CSS px).
 * @property {number} offsetY        Top edge of the frame inside the canvas (CSS px).
 * @property {number} viewWidth      Blitted frame width in CSS px.
 * @property {number} viewHeight     Blitted frame height in CSS px.
 */

/**
 * A point in game coordinates. `inside` is false for points in the letterbox bars or outside the
 * canvas. Coordinates are not clamped or rounded; callers floor them for pixel picking.
 * @typedef {{x: number, y: number, inside: boolean}} GamePoint
 */

/**
 * @callback ResizeListener
 * @param {Layout} layout   The new layout.
 * @param {Display} display The display that resized.
 * @returns {void}
 */

/**
 * @typedef {object} DisplayOptions
 * @property {number} [width=480]            Native buffer width in game px (positive safe integer).
 * @property {number} [height=270]           Native buffer height in game px (positive safe integer).
 * @property {HTMLElement} parent            Sized element the visible canvas is appended to and
 *                                           measured against (its `clientWidth/Height`; the
 *                                           window's inner size when it is `<body>`/`<html>`).
 * @property {DisplayMode} [mode='integer']  Initial scaling mode.
 * @property {string} [background='#000']    Letterbox bar colour (any CSS colour string).
 * @property {boolean} [alpha=false]         Whether the offscreen buffer keeps an alpha channel.
 *                                           Opaque buffers composite faster; `clear(null)` then
 *                                           yields opaque black instead of transparency.
 * @property {number|'auto'} [dpr='auto']    Force a device pixel ratio instead of tracking
 *                                           `window.devicePixelRatio` (e.g. `1` on weak GPUs).
 * @property {number} [maxBackingPixels=Infinity] Cap on the visible canvas's backing-store area
 *                                           (device px²); the effective dpr is lowered to respect
 *                                           it. Useful for browsers with small canvas limits.
 * @property {ResizeListener} [onResize]     Called once with the initial layout and again whenever
 *                                           it changes (also reachable through `display.onResize`).
 * @property {{document?: Document, window?: Window}} [env] Dependency injection for the DOM
 *                                           globals; defaults to `globalThis.document/window`.
 *                                           Mainly for tests and unusual embedding hosts.
 */

/**
 * @typedef {object} Display
 * @property {HTMLCanvasElement} canvas        Visible canvas (appended to `parent`).
 * @property {HTMLCanvasElement} buffer        Offscreen native-resolution buffer.
 * @property {CanvasRenderingContext2D} ctx    Context of `buffer`; the game draws here.
 * @property {number} width                    Native width (game px).
 * @property {number} height                   Native height (game px).
 * @property {DisplayMode} mode                Current scaling mode (live).
 * @property {number} scale                    CSS px per game px (live).
 * @property {number} offsetX                  Frame's left edge inside the canvas, CSS px (live).
 * @property {number} offsetY                  Frame's top edge inside the canvas, CSS px (live).
 * @property {number} pixelScale               Device px per game px (live).
 * @property {number} dpr                      Effective device pixel ratio (live).
 * @property {Layout} layout                   Full current layout (live, frozen).
 * @property {string} background               Current letterbox colour (live).
 * @property {boolean} destroyed               True once `destroy()` has run.
 * @property {() => void} present              Blit the buffer to the visible canvas.
 * @property {() => Layout} resize             Re-measure the parent now; returns the layout.
 * @property {(mode: DisplayMode) => Layout} setMode Switch scaling mode; returns the layout.
 * @property {(color: string) => void} setBackground Change the letterbox colour.
 * @property {(clientX: number, clientY: number) => GamePoint} toGame Client → game coordinates.
 * @property {(x: number, y: number) => {clientX: number, clientY: number}} toClient Inverse of
 *                                             `toGame`, for positioning DOM overlays.
 * @property {(fn: ResizeListener) => () => void} onResize Subscribe; returns an unsubscribe.
 * @property {(color?: string|null) => void} clear Fill the buffer with `color` (defaults to the
 *                                             letterbox colour; `null` → `clearRect`; any other
 *                                             non-string is a TypeError).
 * @property {() => void} destroy              Detach listeners/observers and remove the canvas.
 */

/**
 * Whether `mode` is a supported scaling mode.
 * @param {unknown} mode
 * @returns {mode is DisplayMode}
 */
export function isDisplayMode(mode) {
  return MODES.includes(/** @type {DisplayMode} */ (mode));
}

/**
 * Coerce a devicePixelRatio-like value to a usable ratio: finite and > 0, otherwise `1`.
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeDpr(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * @param {DisplayMode} mode
 * @throws {TypeError} when `mode` is not a supported mode.
 */
function assertMode(mode) {
  if (!isDisplayMode(mode)) {
    throw new TypeError(`Unknown display mode "${String(mode)}" (expected ${MODES.join(' | ')})`);
  }
}

/**
 * @param {number} width
 * @param {number} height
 * @throws {RangeError} when either dimension is not a positive safe integer (numeric strings,
 *                      floats, bigints and values beyond `Number.MAX_SAFE_INTEGER` are rejected).
 */
function assertSize(width, height) {
  if (!Number.isSafeInteger(width) || width <= 0 || !Number.isSafeInteger(height) || height <= 0) {
    throw new RangeError(`Native size must be positive integers, got ${String(width)}x${String(height)}`);
  }
}

/**
 * @param {unknown} color
 * @param {string} where  Name of the API for the error message.
 * @throws {TypeError} when `color` is not a non-empty string.
 */
function assertColor(color, where) {
  if (typeof color !== 'string' || color.length === 0) {
    throw new TypeError(`${where} expects a CSS colour string`);
  }
}

/**
 * Finite-number coercion with a fallback for NaN/undefined/Infinity.
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 */
function toFinite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Pure layout math: place a `width`x`height` frame inside a `cssWidth`x`cssHeight` CSS box at
 * `dpr` device pixels per CSS px. Deterministic; never touches the DOM.
 *
 * Non-finite or non-positive CSS sizes are treated as 1 px (a hidden parent must not throw),
 * and an invalid `dpr` is treated as 1. The axis that limits the uniform scale is filled
 * exactly (no float-error sliver of background on a "full" axis); the other axis is derived
 * from it and centred on whole device pixels.
 *
 * @param {object} [spec]
 * @param {number} [spec.width=480]
 * @param {number} [spec.height=270]
 * @param {number} [spec.cssWidth]   Visible box width in CSS px.
 * @param {number} [spec.cssHeight]  Visible box height in CSS px.
 * @param {number} [spec.dpr=1]      Device pixels per CSS px.
 * @param {DisplayMode} [spec.mode='integer']
 * @param {number} [spec.maxBackingPixels=Infinity] Cap on backing-store area (device px²);
 *                                   non-finite or non-positive values mean "no cap".
 * @returns {Layout}
 * @throws {RangeError} for a native size that is not a positive safe integer.
 * @throws {TypeError} for an unknown mode (or a `null` spec).
 */
export function computeLayout({
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  cssWidth,
  cssHeight,
  dpr = 1,
  mode = 'integer',
  maxBackingPixels = Infinity,
} = {}) {
  assertSize(width, height);
  assertMode(mode);

  const cw = Math.max(1, toFinite(cssWidth, 0));
  const ch = Math.max(1, toFinite(cssHeight, 0));

  let ratio = normalizeDpr(dpr);
  const cap = toFinite(maxBackingPixels, Infinity);
  if (Number.isFinite(cap) && cap > 0) {
    const limit = Math.sqrt(cap / (cw * ch));
    if (limit < ratio) ratio = limit;
  }

  const backingWidth = Math.max(1, Math.round(cw * ratio));
  const backingHeight = Math.max(1, Math.round(ch * ratio));

  const scaleX = backingWidth / width;
  const scaleY = backingHeight / height;
  const widthLimited = scaleX <= scaleY;
  const fitScale = widthLimited ? scaleX : scaleY;
  const wholeScale = Math.floor(fitScale);
  const useWhole = mode === 'integer' && wholeScale >= 1;
  const pixelScale = useWhole ? wholeScale : fitScale;

  let destWidth;
  let destHeight;
  if (useWhole) {
    destWidth = width * wholeScale;
    destHeight = height * wholeScale;
  } else if (widthLimited) {
    // `min` guards against height * (backingWidth / width) overshooting by 1ulp.
    destWidth = backingWidth;
    destHeight = Math.min(backingHeight, height * fitScale);
  } else {
    destHeight = backingHeight;
    destWidth = Math.min(backingWidth, width * fitScale);
  }
  const deviceOffsetX = Math.floor((backingWidth - destWidth) / 2);
  const deviceOffsetY = Math.floor((backingHeight - destHeight) / 2);

  return Object.freeze({
    width,
    height,
    mode,
    integer: Number.isInteger(pixelScale) && pixelScale >= 1,
    dpr: ratio,
    cssWidth: cw,
    cssHeight: ch,
    backingWidth,
    backingHeight,
    pixelScale,
    destWidth,
    destHeight,
    deviceOffsetX,
    deviceOffsetY,
    scale: pixelScale / ratio,
    offsetX: deviceOffsetX / ratio,
    offsetY: deviceOffsetY / ratio,
    viewWidth: destWidth / ratio,
    viewHeight: destHeight / ratio,
  });
}

/**
 * Map a point given in CSS px relative to the visible canvas's top-left corner to game px.
 * @param {number} px
 * @param {number} py
 * @param {Layout} layout
 * @returns {GamePoint}
 */
export function pointToGame(px, py, layout) {
  const x = (px - layout.offsetX) / layout.scale;
  const y = (py - layout.offsetY) / layout.scale;
  const inside = x >= 0 && y >= 0 && x < layout.width && y < layout.height;
  return { x, y, inside };
}

/**
 * Inverse of {@link pointToGame}: game px → CSS px relative to the visible canvas's top-left.
 * @param {number} x
 * @param {number} y
 * @param {Layout} layout
 * @returns {{x: number, y: number}}
 */
export function gameToPoint(x, y, layout) {
  return { x: layout.offsetX + x * layout.scale, y: layout.offsetY + y * layout.scale };
}

/** Layout fields that, when all equal, mean nothing visible or measurable changed. */
const LAYOUT_IDENTITY_KEYS = /** @type {const} */ ([
  'mode',
  'dpr',
  'cssWidth',
  'cssHeight',
  'backingWidth',
  'backingHeight',
  'pixelScale',
  'deviceOffsetX',
  'deviceOffsetY',
]);

/**
 * @param {Layout} a
 * @param {Layout} b
 * @returns {boolean}
 */
function sameLayout(a, b) {
  return LAYOUT_IDENTITY_KEYS.every((key) => a[key] === b[key]);
}

/**
 * Subscribe to a MediaQueryList across old (`addListener`) and new (`addEventListener`) APIs.
 * Tolerates hosts whose `matchMedia` hands back nothing usable (no DPR tracking then).
 * @param {MediaQueryList|null|undefined} query
 * @param {() => void} fn
 * @param {boolean} on
 */
function toggleMediaListener(query, fn, on) {
  if (!query || typeof query !== 'object') return;
  if (typeof query.addEventListener === 'function') {
    if (on) query.addEventListener('change', fn);
    else query.removeEventListener('change', fn);
  } else if (typeof query.addListener === 'function') {
    if (on) query.addListener(fn);
    else query.removeListener(fn);
  }
}

/**
 * Create the game display: an offscreen native-resolution buffer plus a visible canvas that fills
 * `parent`, re-laid-out automatically when the parent, window or devicePixelRatio changes.
 *
 * Draw into `display.ctx` each frame, then call `display.present()`.
 *
 * If anything fails while wiring the display up (including the initial `onResize` call throwing)
 * the canvas and every listener are released again before the error propagates.
 *
 * @param {DisplayOptions} options
 * @returns {Display}
 * @throws {Error} when no DOM is available (Node without an injected `env`) or 2D canvas
 *                 contexts cannot be created.
 * @throws {TypeError} when `options` is not an object, `parent` is not an element, `mode` is
 *                 unknown, or `background`, `dpr` or `onResize` have the wrong type.
 * @throws {RangeError} when `width`/`height` are not positive safe integers.
 */
export function createDisplay(options = {}) {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('createDisplay() expects an options object');
  }
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    parent,
    mode: initialMode = 'integer',
    background: initialBackground = '#000',
    alpha = false,
    dpr: dprOption = 'auto',
    maxBackingPixels = Infinity,
    onResize,
    env,
  } = options;

  const doc = env?.document ?? globalThis.document;
  const win = env?.window ?? globalThis.window;
  if (!doc || typeof doc.createElement !== 'function' || !win || typeof win.addEventListener !== 'function') {
    throw new Error('createDisplay() is browser-only: it needs a DOM (document and window)');
  }
  if (!parent || typeof parent.appendChild !== 'function') {
    throw new TypeError('createDisplay() requires options.parent to be a DOM element');
  }
  assertSize(width, height);
  assertMode(initialMode);
  assertColor(initialBackground, 'createDisplay({ background })');
  if (dprOption !== 'auto' && !(Number.isFinite(dprOption) && dprOption > 0)) {
    throw new TypeError(`createDisplay({ dpr }) expects 'auto' or a positive number, got ${String(dprOption)}`);
  }
  if (onResize != null && typeof onResize !== 'function') {
    throw new TypeError('createDisplay({ onResize }) expects a function');
  }

  const canvas = doc.createElement('canvas');
  Object.assign(canvas.style, {
    display: 'block',
    imageRendering: 'crisp-edges', // older Firefox / Safari spelling; overridden where `pixelated` exists
    touchAction: 'none',
    userSelect: 'none',
    webkitUserSelect: 'none',
  });
  canvas.style.imageRendering = 'pixelated';
  const visibleCtx = canvas.getContext('2d', { alpha: false });

  const buffer = doc.createElement('canvas');
  buffer.width = width;
  buffer.height = height;
  const ctx = buffer.getContext('2d', { alpha: Boolean(alpha) });
  if (!visibleCtx || !ctx) throw new Error('Canvas 2D rendering context unavailable');
  ctx.imageSmoothingEnabled = false;

  /** @type {Set<ResizeListener>} */
  const listeners = new Set();
  if (onResize) listeners.add(onResize);

  /** @type {DisplayMode} */
  let mode = initialMode;
  let background = initialBackground;
  /** @type {Layout} */
  let layout;
  /** @type {MediaQueryList|null} */
  let dprQuery = null;
  let watchedDpr = NaN;
  /** @type {ResizeObserver|null} */
  let observer = null;
  let destroyed = false;

  const handleChange = () => {
    resize();
  };

  /** Current CSS size of the parent box. */
  function measureParent() {
    if (parent === doc.body || parent === doc.documentElement) {
      return { cssWidth: win.innerWidth, cssHeight: win.innerHeight };
    }
    return { cssWidth: parent.clientWidth, cssHeight: parent.clientHeight };
  }

  /** Raw device pixel ratio to lay out against (before any backing-store cap). */
  function readDpr() {
    return normalizeDpr(dprOption === 'auto' ? win.devicePixelRatio : dprOption);
  }

  /**
   * Re-arm a media query that fires when the devicePixelRatio leaves its current value (browser
   * zoom, or the window moving to a monitor with a different scale factor). Window `resize`
   * does not fire for the latter, so this is the only reliable signal.
   * @param {number} ratio
   */
  function watchDpr(ratio) {
    if (ratio === watchedDpr || dprOption !== 'auto' || typeof win.matchMedia !== 'function') return;
    if (dprQuery) toggleMediaListener(dprQuery, handleChange, false);
    watchedDpr = ratio;
    dprQuery = win.matchMedia(`(resolution: ${ratio}dppx)`) ?? null;
    toggleMediaListener(dprQuery, handleChange, true);
  }

  /** Paint the letterbox bars (only the strips outside the frame, to save fill rate). */
  function fillBars() {
    const { backingWidth, backingHeight, destWidth, destHeight, deviceOffsetX, deviceOffsetY } = layout;
    const right = deviceOffsetX + destWidth;
    const bottom = deviceOffsetY + destHeight;
    visibleCtx.fillStyle = background;
    if (deviceOffsetY > 0) visibleCtx.fillRect(0, 0, backingWidth, deviceOffsetY);
    if (bottom < backingHeight) visibleCtx.fillRect(0, bottom, backingWidth, backingHeight - bottom);
    if (deviceOffsetX > 0) visibleCtx.fillRect(0, deviceOffsetY, deviceOffsetX, destHeight);
    if (right < backingWidth) visibleCtx.fillRect(right, deviceOffsetY, backingWidth - right, destHeight);
  }

  function present() {
    const { backingWidth, backingHeight, destWidth, destHeight, deviceOffsetX, deviceOffsetY } = layout;
    if (destWidth < backingWidth || destHeight < backingHeight) fillBars();
    visibleCtx.drawImage(buffer, 0, 0, width, height, deviceOffsetX, deviceOffsetY, destWidth, destHeight);
  }

  /**
   * Tell every subscriber about `next`. Each listener runs even if an earlier one throws (the
   * first error is rethrown afterwards), and if a listener re-lays-out the display (e.g. calls
   * `setMode`) the remaining subscribers have already been told about the newer layout by that
   * nested call, so the stale one is not delivered after it.
   * @param {Layout} next
   */
  function notify(next) {
    let error = null;
    for (const fn of listeners) {
      if (layout !== next) break;
      try {
        fn(next, display);
      } catch (err) {
        error ??= err;
      }
    }
    if (error) throw error;
  }

  function resize() {
    if (destroyed) return layout;
    const { cssWidth, cssHeight } = measureParent();
    const rawDpr = readDpr();
    const next = computeLayout({ width, height, cssWidth, cssHeight, dpr: rawDpr, mode, maxBackingPixels });
    watchDpr(rawDpr);
    if (layout && sameLayout(layout, next)) return layout;
    layout = next;

    // Assigning width/height clears the canvas and resets its context state, so only do it when
    // the backing store really changed, and restore nearest-neighbour sampling afterwards.
    if (canvas.width !== next.backingWidth) canvas.width = next.backingWidth;
    if (canvas.height !== next.backingHeight) canvas.height = next.backingHeight;
    canvas.style.width = `${next.cssWidth}px`;
    canvas.style.height = `${next.cssHeight}px`;
    visibleCtx.imageSmoothingEnabled = false;

    present(); // Re-show the last frame immediately so a resize never flashes a blank canvas.
    notify(next);
    return next;
  }

  /**
   * Factors that convert between the canvas's CSS box and its on-screen rect (they differ only
   * when an ancestor applies a CSS transform). A zero-sized rect (hidden canvas) yields 1.
   * @param {DOMRect} rect
   */
  function rectFactors(rect) {
    return {
      kx: rect.width > 0 && layout.cssWidth > 0 ? layout.cssWidth / rect.width : 1,
      ky: rect.height > 0 && layout.cssHeight > 0 ? layout.cssHeight / rect.height : 1,
    };
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    win.removeEventListener('resize', handleChange);
    if (observer) observer.disconnect();
    if (dprQuery) toggleMediaListener(dprQuery, handleChange, false);
    dprQuery = null;
    listeners.clear();
    if (canvas.parentNode === parent) parent.removeChild(canvas);
  }

  /** @type {Display} */
  const display = {
    canvas,
    buffer,
    ctx,
    width,
    height,
    get mode() {
      return mode;
    },
    get scale() {
      return layout.scale;
    },
    get offsetX() {
      return layout.offsetX;
    },
    get offsetY() {
      return layout.offsetY;
    },
    get pixelScale() {
      return layout.pixelScale;
    },
    get dpr() {
      return layout.dpr;
    },
    get layout() {
      return layout;
    },
    get background() {
      return background;
    },
    get destroyed() {
      return destroyed;
    },
    present,
    resize,

    setMode(nextMode) {
      assertMode(nextMode);
      if (nextMode === mode || destroyed) return layout;
      mode = nextMode;
      return resize();
    },

    setBackground(color) {
      assertColor(color, 'setBackground()');
      background = color;
    },

    toGame(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const { kx, ky } = rectFactors(rect);
      return pointToGame((clientX - rect.left) * kx, (clientY - rect.top) * ky, layout);
    },

    toClient(x, y) {
      const rect = canvas.getBoundingClientRect();
      const { kx, ky } = rectFactors(rect);
      const p = gameToPoint(x, y, layout);
      return { clientX: rect.left + p.x / kx, clientY: rect.top + p.y / ky };
    },

    onResize(fn) {
      if (typeof fn !== 'function') throw new TypeError('onResize() expects a function');
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },

    clear(color = background) {
      if (color === null) {
        ctx.clearRect(0, 0, width, height);
        return;
      }
      // Browsers silently ignore invalid fillStyle assignments, which would fill with whatever
      // colour the game last used; fail loudly instead.
      assertColor(color, 'clear()');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
    },

    destroy,
  };

  try {
    parent.appendChild(canvas);
    win.addEventListener('resize', handleChange);
    if (typeof win.ResizeObserver === 'function') {
      observer = new win.ResizeObserver(handleChange);
      observer.observe(parent);
    }
    resize();
  } catch (err) {
    destroy();
    throw err;
  }

  return display;
}
