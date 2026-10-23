// A recording stand-in for Canvas 2D so js/render/* runs under Node. Every context records the calls
// tests assert on (drawImage, putImageData, fills, composite modes); createImageData returns real
// pixel buffers so baked pixels can be inspected.
import { setRenderCanvasFactory } from '../../js/render/surface.js';
import { setAtlasCanvasFactory } from '../../js/art/atlas.js';
import { setCanvasFactory } from '../../js/core/pixelart.js';

export function createFakeContext(canvas) {
  const calls = [];
  const ctx = {
    canvas,
    calls,
    fillStyle: '#000000',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
    drawImage(img, ...a) { calls.push(['drawImage', img, ...a]); },
    putImageData(img, x, y) { const copy = { width: img.width, height: img.height, data: img.data.slice() }; calls.push(['putImageData', copy, x, y]); canvas.last = copy; },
    createImageData(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    getImageData(x, y, w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; },
    fillRect(...a) { calls.push(['fillRect', this.fillStyle, this.globalAlpha, ...a]); },
    clearRect(...a) { calls.push(['clearRect', ...a]); },
    createPattern() { return { pattern: true }; },
    save() { calls.push(['save']); },
    restore() { calls.push(['restore']); },
    beginPath() {}, rect() {}, clip() {}, fill() { calls.push(['fill', this.fillStyle, this.globalCompositeOperation]); },
    moveTo() {}, lineTo() {}, closePath() {}, ellipse() {},
    translate(...a) { calls.push(['translate', ...a]); },
    setTransform() {},
  };
  return ctx;
}

export function createFakeCanvas(w, h) {
  const canvas = { width: w, height: h, fake: true, last: null };
  const ctx = createFakeContext(canvas);
  canvas.getContext = () => ctx;
  return canvas;
}

/** Points every canvas factory (render, atlas, pixelart) at fake canvases; returns a counter. */
export function installFakeCanvas() {
  const stats = { created: 0 };
  const f = (w, h) => { stats.created++; return createFakeCanvas(w, h); };
  setRenderCanvasFactory(f);
  setAtlasCanvasFactory(f);
  setCanvasFactory(f);
  return stats;
}
