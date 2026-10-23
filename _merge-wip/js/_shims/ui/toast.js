/** SHIM for js/ui/toast.js [UI-KIT]. Delete at integration. A plain queue drawn above the stack. */
import { drawText, measureText } from '../../core/font.js';

/**
 * @typedef {Object} Toasts
 * @property {(text: string, opts?: {ms?: number, color?: string}) => void} push
 * @property {(ms: number) => void} update
 * @property {(ctx: CanvasRenderingContext2D) => void} draw
 * @property {number} count
 * @property {() => string[]} texts
 */

/**
 * @param {{width?: number, height?: number}} [opts]
 * @returns {Toasts}
 */
export function createToasts({ width = 480, height = 270 } = {}) {
  /** @type {{text: string, left: number, total: number, color: string}[]} */
  const queue = [];
  return {
    get count() { return queue.length; },
    texts: () => queue.map((t) => t.text),
    push(text, opts = {}) {
      queue.push({ text: String(text), left: opts.ms ?? 2200, total: opts.ms ?? 2200, color: opts.color ?? '#f4ecd8' });
      if (queue.length > 3) queue.shift();
    },
    update(ms) {
      for (const t of queue) t.left -= ms;
      while (queue.length && queue[0].left <= 0) queue.shift();
    },
    draw(ctx) {
      if (!queue.length) return;
      const t = queue[0];
      const a = Math.min(1, t.left / 300, (t.total - t.left) / 150 + 0.2);
      const { w } = measureText(t.text);
      const bw = w + 12;
      const x = Math.floor((width - bw) / 2);
      const y = height - 30;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = '#1b1a24';
      ctx.fillRect(x, y, bw, 14);
      ctx.fillStyle = '#6e6a86';
      ctx.fillRect(x, y + 13, bw, 1);
      drawText(ctx, t.text, x + 6, y + 3, { color: t.color });
      ctx.restore();
    },
  };
}
