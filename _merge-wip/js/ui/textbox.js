/**
 * Typewriter text box. [UI-KIT] — ARCHITECTURE-DRAFT §7.
 *
 * `createTextbox({rect, speed, font})` -> {setText, update, draw, done, skip, advance, handle}.
 *  - Speed presets `slow | normal | fast | instant` (`TEXT_SPEEDS`, chars/s); `setSpeed()` at any
 *    time; the `instant` setting shows each page at once.
 *  - Pages are cut by *measured* wrap (`core/font.wrapText`) against the text area, so a page never
 *    overflows; `\f` forces a break. `paginate()` is pure and unit-tested.
 *  - Beat pauses: a short hold after `,` `;` and a longer one after `.` `!` `?` `…` (scaled with
 *    speed; none when instant).
 *  - Confirm while typing skips to the end of the page; confirm on a finished page advances; on the
 *    last page it reports `finished` (`onDone`). Cancel does the same unless choices are up.
 *  - Ledger-paper slip with the speaker name on a wax tab (in the speaker's key colour), a 32x32
 *    portrait slot on the left (placeholder bust when no sprite is given) and a bobbing `▼` when
 *    more text waits.
 *  - Choices (`setText(text, {choices})`) appear inside the box once the last page is shown, as a
 *    focus list on the right; `onChoice(index)` resolves them. Cancel picks `cancelIndex` if given.
 * @module ui/textbox
 */
import { drawText, drawTextTyped, wrapText, measureText } from '../core/font.js';
import { drawSprite, isSprite } from '../core/pixelart.js';
import { createFocus } from './focus.js';
import { COLORS, ROLE_GLYPH, SPACE, TEXT_SPEEDS, TIMING, TYPE } from './theme.js';
import { drawPanel } from './panel.js';
import { getPortraitPlaceholder } from './icons.js';

/** Characters that trigger beat pauses. */
export const BEAT_SHORT = ',;:';
export const BEAT_LONG = '.!?…';

/**
 * Split text into pages of at most `maxLines` wrapped lines. `\f` forces a page break; blank
 * paragraphs never start a page. Pure.
 * @param {string} text
 * @param {{maxWidth: number, maxLines: number, font?: string}} o
 * @returns {string[]} Pages (never empty).
 */
export function paginate(text, o) {
  const maxLines = Math.max(1, o.maxLines | 0);
  const chunks = String(text ?? '').split('\f');
  /** @type {string[]} */
  const pages = [];
  for (const chunk of chunks) {
    const lines = wrapText(chunk, o.maxWidth, { font: o.font || 'main' });
    // trim blank leading lines of a chunk
    while (lines.length > 1 && lines[0].trim() === '') lines.shift();
    for (let i = 0; i < lines.length; i += maxLines) {
      const page = lines.slice(i, i + maxLines);
      while (page.length > 1 && page[page.length - 1].trim() === '') page.pop();
      pages.push(page.join('\n'));
    }
  }
  return pages.length ? pages : [''];
}

/**
 * Beat pause for the character just revealed (ms), 0 for most characters. The next character is
 * passed so an ellipsis or `?!` pauses once, at its end.
 * @param {string} ch @param {string} [next] @param {number} [cps]
 * @returns {number}
 */
export function beatFor(ch, next, cps = TEXT_SPEEDS.normal) {
  if (!Number.isFinite(cps)) return 0;
  if (next && (BEAT_LONG.includes(next) || BEAT_SHORT.includes(next))) return 0;
  const scale = Math.min(1.5, Math.max(0.5, TEXT_SPEEDS.normal / cps));
  if (BEAT_LONG.includes(ch)) return TIMING.beatStopMs * scale;
  if (BEAT_SHORT.includes(ch)) return TIMING.beatCommaMs * scale;
  return 0;
}

/**
 * Characters drawTextTyped counts (newlines excluded) as an array.
 * @param {string} page
 * @returns {string[]}
 */
function visibleChars(page) {
  return Array.from(page.replace(/\n/g, ''));
}

/**
 * @typedef {Object} TextboxOptions
 * @property {{x: number, y: number, w: number, h: number}} rect
 * @property {'slow'|'normal'|'fast'|'instant'|number} [speed='normal']  Preset or chars/s.
 * @property {string} [font='main']
 * @property {boolean} [portraitSlot]  Always reserve the portrait slot (default: only when a portrait is set).
 * @property {() => void} [onDone]
 * @property {(index: number, choice: any) => void} [onChoice]
 * @property {(page: number) => void} [onPage]
 * @property {boolean} [cancelAdvances=true]
 * @property {import('../core/input.js').Input} [input]
 */

/**
 * @param {TextboxOptions} o
 * @returns {Textbox}
 */
export function createTextbox(o) {
  let rect = { ...o.rect };
  const font = o.font || 'main';
  const lineH = font === 'small' ? TYPE.smallLineH : TYPE.lineH;
  let cps = resolveSpeed(o.speed);
  let text = '';
  let who = '';
  let whoColor = null;
  /** @type {any} */
  let portrait = undefined;
  let pages = [''];
  let pageIndex = 0;
  let shown = 0; // whole characters revealed on the current page
  let acc = 0;
  let beat = 0;
  let finished = false;
  let bob = 0;
  /** @type {{label: string, enabled?: boolean, reason?: string, data?: any}[]} */
  let choices = [];
  let cancelIndex = -1;
  let choiceFocus = null;
  let layoutCache = null;

  function resolveSpeed(s) {
    if (typeof s === 'number' && s > 0) return s;
    return TEXT_SPEEDS[s] || TEXT_SPEEDS.normal;
  }

  function hasPortrait() { return o.portraitSlot || portrait !== undefined; }

  /** Text area and choice column for the current content. */
  function layout() {
    if (layoutCache) return layoutCache;
    const inner = { x: rect.x + 6, y: rect.y + 6, w: rect.w - 12, h: rect.h - 12 };
    const px = inner.x;
    const textX = hasPortrait() ? px + 32 + SPACE.md : inner.x;
    let textW = inner.x + inner.w - textX - 8; // room for the more-arrow
    let choiceRect = null;
    if (choices.length) {
      const cw = Math.min(Math.floor(textW * 0.45), choices.reduce((m, c) => Math.max(m, measureText(c.label).w), 0) + 20);
      choiceRect = { x: inner.x + inner.w - cw, y: inner.y, w: cw, h: inner.h };
      textW = choiceRect.x - textX - SPACE.md;
    }
    const maxLines = Math.max(1, Math.floor((inner.h + 1) / lineH));
    layoutCache = { inner, portrait: { x: px, y: inner.y, w: 32, h: 32 }, text: { x: textX, y: inner.y, w: Math.max(16, textW) }, maxLines, choiceRect };
    return layoutCache;
  }

  function repaginate() {
    layoutCache = null;
    const L = layout();
    pages = paginate(text, { maxWidth: L.text.w, maxLines: L.maxLines, font });
  }

  function startPage(i) {
    pageIndex = Math.max(0, Math.min(pages.length - 1, i));
    shown = Number.isFinite(cps) ? 0 : visibleChars(pages[pageIndex]).length;
    acc = 0;
    beat = 0;
    if (o.onPage) o.onPage(pageIndex);
  }

  function pageChars() { return visibleChars(pages[pageIndex]); }

  function pageDone() { return shown >= pageChars().length; }

  function onLastPage() { return pageIndex >= pages.length - 1; }

  function choicesUp() { return choices.length > 0 && onLastPage() && pageDone() && !finished; }

  function buildChoiceFocus() {
    if (!choices.length) { choiceFocus = null; return; }
    const L = layout();
    const rowH = 11;
    const items = choices.map((c, i) => ({
      id: String(i), enabled: c.enabled !== false, reason: c.reason,
      rect: { x: L.choiceRect.x + 8, y: L.choiceRect.y + i * rowH, w: L.choiceRect.w - 8, h: rowH },
    }));
    choiceFocus = createFocus({ items, cols: 1, wrap: true, index: 0, input: o.input });
    choiceFocus.on('activate', (ev) => { finished = true; if (o.onChoice) o.onChoice(ev.index, choices[ev.index]); });
    choiceFocus.on('cancel', () => {
      if (cancelIndex >= 0 && choices[cancelIndex] && choices[cancelIndex].enabled !== false) {
        finished = true;
        if (o.onChoice) o.onChoice(cancelIndex, choices[cancelIndex]);
      }
    });
  }

  /**
   * @param {string} t
   * @param {{who?: string, whoColor?: string, portrait?: any, choices?: {label: string, enabled?: boolean, reason?: string, data?: any}[], cancelIndex?: number, defaultChoice?: number}} [opts]
   */
  function setText(t, opts = {}) {
    text = String(t ?? '');
    who = opts.who || '';
    whoColor = opts.whoColor || null;
    portrait = opts.portrait;
    choices = Array.isArray(opts.choices) ? opts.choices.slice() : [];
    cancelIndex = opts.cancelIndex === undefined ? -1 : opts.cancelIndex;
    finished = false;
    repaginate();
    buildChoiceFocus();
    if (choiceFocus && opts.defaultChoice !== undefined) choiceFocus.set(opts.defaultChoice);
    startPage(0);
  }

  function skip() {
    shown = pageChars().length;
    beat = 0;
    acc = 0;
  }

  /** @returns {boolean} true when another page started; false when the text is finished. */
  function advance() {
    if (!pageDone()) { skip(); return true; }
    if (choicesUp()) return true;
    if (onLastPage()) {
      if (!finished) { finished = true; if (o.onDone) o.onDone(); }
      return false;
    }
    startPage(pageIndex + 1);
    return true;
  }

  function update(dt) {
    bob = (bob + dt) % TIMING.cursorBobMs;
    if (choiceFocus) choiceFocus.update(dt);
    if (pageDone()) return;
    if (!Number.isFinite(cps)) { skip(); return; }
    if (beat > 0) { beat -= dt; if (beat > 0) return; dt = -beat; beat = 0; }
    const chars = pageChars();
    acc += (dt * cps) / 1000;
    while (acc >= 1 && shown < chars.length) {
      acc -= 1;
      shown += 1;
      const b = beatFor(chars[shown - 1], chars[shown], cps);
      if (b > 0 && shown < chars.length) { beat = b; acc = 0; break; }
    }
  }

  /** @param {import('../core/input.js').Input} [input] */
  function handle(input = o.input) {
    if (!input) return null;
    if (choicesUp() && choiceFocus) return choiceFocus.handle(input);
    if (input.pressed('confirm') || (o.cancelAdvances !== false && input.pressed('cancel'))) {
      advance();
      return { type: 'advance' };
    }
    const p = input.pointer;
    if (p && p.inside && p.justDown && p.x >= rect.x && p.x < rect.x + rect.w && p.y >= rect.y && p.y < rect.y + rect.h) {
      advance();
      return { type: 'advance' };
    }
    return null;
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    const L = layout();
    drawPanel(ctx, rect, 'paper', who ? { title: who, titleStyle: 'wax', titleColor: whoColor || undefined } : undefined);
    if (hasPortrait()) {
      const P = L.portrait;
      ctx.fillStyle = COLORS.paper.shade;
      ctx.fillRect(P.x, P.y, P.w, P.h);
      ctx.fillStyle = COLORS.paper.edge;
      ctx.fillRect(P.x, P.y, P.w, 1); ctx.fillRect(P.x, P.y + P.h - 1, P.w, 1); ctx.fillRect(P.x, P.y, 1, P.h); ctx.fillRect(P.x + P.w - 1, P.y, 1, P.h);
      if (isSprite(portrait)) drawSprite(ctx, portrait, P.x, P.y);
      else drawSprite(ctx, getPortraitPlaceholder(), P.x, P.y);
      ctx.fillStyle = COLORS.paper.rule;
      ctx.fillRect(P.x + P.w + SPACE.sm, L.inner.y, 1, L.inner.h);
    }
    drawTextTyped(ctx, pages[pageIndex], L.text.x, L.text.y, shown, { font, color: COLORS.paper.ink, maxWidth: L.text.w });
    // more-arrow / end mark
    const ax = rect.x + rect.w - 11, ay = rect.y + rect.h - 10;
    if (pageDone() && !choicesUp()) {
      const lift = bob < TIMING.cursorBobMs / 2 ? 0 : 1;
      if (!onLastPage()) drawText(ctx, TYPE.more, ax, ay + lift, { color: COLORS.wax.fill });
      else if (!finished) drawText(ctx, TYPE.cursor, ax, ay, { color: COLORS.wax.fill });
    }
    if (pages.length > 1) {
      drawText(ctx, `${pageIndex + 1}/${pages.length}`, ax - 4, ay + 2, { font: 'small', align: 'right', color: COLORS.paper.inkFaint });
    }
    if (choicesUp() && choiceFocus) {
      const C = L.choiceRect;
      ctx.fillStyle = COLORS.paper.rule;
      ctx.fillRect(C.x - SPACE.sm, C.y, 1, C.h);
      choiceFocus.items.forEach((it, i) => {
        const c = choices[i];
        const enabled = c.enabled !== false;
        if (i === choiceFocus.index) { ctx.fillStyle = COLORS.focus.bandOnPaper; ctx.fillRect(it.rect.x - 1, it.rect.y, it.rect.w + 1, it.rect.h); }
        const label = enabled ? c.label : `${ROLE_GLYPH.disabled} ${c.label}`;
        drawText(ctx, label, it.rect.x + 2, it.rect.y + 2, { color: enabled ? COLORS.paper.ink : COLORS.role.disabled, maxWidth: it.rect.w - 3 });
      });
      choiceFocus.drawCursor(ctx, { style: 'paper', ring: false });
    }
  }

  /** @type {Textbox} */
  const box = {
    setText,
    update,
    draw,
    handle,
    skip,
    advance,
    setSpeed(s) { cps = resolveSpeed(s); if (!Number.isFinite(cps)) skip(); },
    setRect(r) { rect = { ...r }; repaginate(); startPage(Math.min(pageIndex, pages.length - 1)); },
    get speed() { return cps; },
    get done() { return pageDone(); },
    get finished() { return finished; },
    get page() { return pageIndex; },
    get pages() { return pages.length; },
    get pageText() { return pages[pageIndex]; },
    get shown() { return shown; },
    get choicesUp() { return choicesUp(); },
    get choiceFocus() { return choiceFocus; },
    get who() { return who; },
    get rect() { return rect; },
  };
  if (o.text) setText(o.text, o);
  return box;
}

/**
 * @typedef {Object} Textbox
 * @property {(text: string, opts?: {who?: string, whoColor?: string, portrait?: any, choices?: {label: string, enabled?: boolean, reason?: string, data?: any}[], cancelIndex?: number, defaultChoice?: number}) => void} setText
 * @property {(dt: number) => void} update
 * @property {(ctx: CanvasRenderingContext2D) => void} draw
 * @property {(input?: import('../core/input.js').Input) => any} handle
 * @property {() => void} skip
 * @property {() => boolean} advance
 * @property {(s: 'slow'|'normal'|'fast'|'instant'|number) => void} setSpeed
 * @property {(r: {x: number, y: number, w: number, h: number}) => void} setRect
 * @property {number} speed
 * @property {boolean} done        Current page fully shown.
 * @property {boolean} finished    All pages shown and advanced past (or a choice made).
 * @property {number} page @property {number} pages @property {string} pageText @property {number} shown
 * @property {boolean} choicesUp
 * @property {import('./focus.js').Focus|null} choiceFocus
 * @property {string} who
 * @property {{x: number, y: number, w: number, h: number}} rect
 */
