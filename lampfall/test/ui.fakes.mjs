// Shared fakes for the UI-KIT tests: a scriptable Input (pressed/repeat/held/released/pointer)
// and a recording 2D context. Not a test file itself (no `.test.` in the name).

/**
 * @param {{device?: 'keyboard'|'gamepad'|'touch'}} [o]
 */
export function fakeInput(o = {}) {
  let pressed = new Set();
  let released = new Set();
  const held = new Map(); // action -> ms held
  let pointer = { x: 0, y: 0, down: false, justDown: false, justUp: false, inside: false, type: '', button: 0 };
  const input = {
    lastDevice: o.device || 'keyboard',
    frame: 0,
    pressed: (a) => pressed.has(a),
    released: (a) => released.has(a),
    held: (a) => held.has(a),
    heldFor: (a) => held.get(a) || 0,
    repeat: (a) => pressed.has(a),
    axis() {
      const x = (held.has('right') || pressed.has('right') ? 1 : 0) - (held.has('left') || pressed.has('left') ? 1 : 0);
      const y = (held.has('down') || pressed.has('down') ? 1 : 0) - (held.has('up') || pressed.has('up') ? 1 : 0);
      return { x, y };
    },
    flush() { pressed = new Set(); released = new Set(); input.flushed = (input.flushed || 0) + 1; },
    get pointer() { return pointer; },
    /** Press actions for exactly one frame. */
    press(...actions) { pressed = new Set(actions); released = new Set(); return input; },
    release(...actions) { released = new Set(actions); pressed = new Set(); for (const a of actions) held.delete(a); return input; },
    hold(action, ms) { held.set(action, ms); return input; },
    unhold(action) { held.delete(action); return input; },
    /** Clear one-frame edges (end of frame). */
    clear() { pressed = new Set(); released = new Set(); pointer = { ...pointer, justDown: false, justUp: false }; input.frame++; return input; },
    move(x, y, type = 'mouse') { pointer = { ...pointer, x, y, inside: true, type, justDown: false }; return input; },
    tap(x, y, type = 'touch') {
      pointer = { ...pointer, x, y, inside: true, type, justDown: true, down: true };
      if (type === 'touch') input.lastDevice = 'touch';
      return input;
    },
  };
  return input;
}

/** A 2D-context stand-in that records fills and text calls (no canvas factory in Node). */
export function fakeCtx(w = 480, h = 270) {
  const calls = [];
  const ctx = {
    canvas: { width: w, height: h },
    calls,
    fillStyle: '#000', globalAlpha: 1, globalCompositeOperation: 'source-over', imageSmoothingEnabled: false,
    fillRect: (...a) => calls.push(['fillRect', ctx.fillStyle, ...a]),
    clearRect: (...a) => calls.push(['clearRect', ...a]),
    drawImage: (...a) => calls.push(['drawImage', ...a]),
    save() {}, restore() {}, translate() {}, beginPath() {}, rect() {}, clip() {}, arc() {}, fill() {},
    createPattern: () => ({}),
    getContext() { return ctx; },
  };
  return ctx;
}

/**
 * Give Node a do-nothing canvas so drawing code paths (font atlases, pixelart sprites, panel
 * caches) can run headless: `globalThis.OffscreenCanvas` (core/font, ui/panel) and the pixelart
 * canvas factory. Contexts accept every call and record nothing; pass a `fakeCtx()` as the
 * target when a test wants to count calls. Idempotent.
 * @param {{setCanvasFactory?: (f: Function|null) => void}} [pixelart]
 */
export function installFakeCanvas(pixelart) {
  const makeCtx = (canvas) => new Proxy({ canvas, globalAlpha: 1, fillStyle: '#000', globalCompositeOperation: 'source-over', imageSmoothingEnabled: false }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createImageData') return (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (k === 'getImageData') return (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (k === 'createPattern') return () => ({ setTransform() {} });
      if (k === 'measureText') return () => ({ width: 0 });
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  class FakeCanvas {
    constructor(w = 1, h = 1) { this.width = w; this.height = h; this._ctx = null; }
    getContext() { return this._ctx || (this._ctx = makeCtx(this)); }
  }
  if (typeof globalThis.OffscreenCanvas !== 'function') globalThis.OffscreenCanvas = FakeCanvas;
  if (pixelart && typeof pixelart.setCanvasFactory === 'function') pixelart.setCanvasFactory((w, h) => new FakeCanvas(w, h));
  return FakeCanvas;
}
