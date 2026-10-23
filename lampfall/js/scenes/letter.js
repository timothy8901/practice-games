/**
 * The letter reader. [SCN-UI] — GDD-00 §11, §13 "Letter reader"; GDD-09 §3.23.
 *
 * A letter on ledger paper (336×246 at 72,12) with its wax seal (24×24 top-right, colour AND glyph
 * from `data/letters` SEALS, so colour is never the only tell). Sequence for an unread letter:
 *  1. **sealed**: the folded letter with the seal; `confirm` breaks it — the seal cracks in 5 f, the
 *     halves fall, the letter sting plays through the audio director (`music:cue {sting: 'letter'}`);
 *  2. **unfold** (6 f) into the reading page;
 *  3. **reading**: the body types at the text speed (instant per the setting; confirm completes,
 *     holding confirm types 4× faster), up / down scroll, `▼` while more lies below;
 *  4. closing marks it read (`letters.markRead`: flags, stats, `letter:read` -> autosave) and shows
 *     the reveal toasts; a **family** letter then shows the *Carry to door* slip (collected from
 *     Hesper's counter into the satchel through `letters.carry`).
 * A **town** letter opened from Barnaby's string wall (`from: 'wall'`) first shows the cork board:
 * every pinned find on a card, red strings to their letters, the new string drawing in.
 * A letter already read opens straight to the page (Journal re-reads).
 *
 * Params: `{n?, from?: 'mailbox'|'counter'|'journal'|'wall'|'script', onClose?}`; `n` defaults to
 * this morning's letter, else the first unread. Pops with `{read: n}`.
 * @module scenes/letter
 */
import { drawText, drawTextTyped, wrapText, measureText } from '../core/font.js';
import { ease } from '../core/tween.js';
import { drawPanel } from '../ui/panel.js';
import { drawSealButton } from '../ui/widgets.js';
import { drawIcon } from '../ui/icons.js';
import { COLORS, DEVICE_LABELS, PALETTE, TIMING, TYPE } from '../ui/theme.js';
import { t } from '../data/strings.js';
import { SEALS } from '../data/letters/index.js';
import * as letters from '../systems/letters.js';
import { itemOf } from '../systems/econ.js';
import { textCps, reducedMotion, skipAnims, framesMs } from './scriptHost.js';

/** Page geometry (GDD-09 §3.23). */
export const PAGE = Object.freeze({ x: 72, y: 12, w: 336, h: 246 });
export const BODY = Object.freeze({ x: 90, y: 62, w: 300, h: 178 });
export const LINE_H = 10;

/** 7×7 emblems pressed into each seal glyph (data/letters SEALS `glyph`). */
export const SEAL_GLYPHS = Object.freeze({
  petrel: ['.......', '#.....#', '.#...#.', '..#.#..', '...#...', '..###..', '.......'],
  blot: ['..##...', '.####..', '######.', '.#####.', '..####.', '...##..', '.......'],
  'anchor-ring': ['..###..', '...#...', '.#####.', '...#...', '#..#..#', '.#.#.#.', '..###..'],
  string: ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
  pin: ['...##..', '..####.', '...##..', '...#...', '...#...', '...#...', '...#...'],
  heron: ['..##...', '...#...', '...#...', '..###..', '.####..', '...#...', '..#.#..'],
  wave: ['.......', '.##..##', '#..##..', '.......', '.##..##', '#..##..', '.......'],
});

/**
 * The seal row for a letter (by `seal` id), with a fallback.
 * @param {string|undefined} id
 * @returns {{id: string, name: string, colour: string, glyph: string}}
 */
export function sealOf(id) {
  return SEALS.find((s) => s.id === id) ?? { id: 'wax-red', name: 'Red wax', colour: COLORS.wax.fill, glyph: 'blot' };
}

/**
 * Body text as display lines: `|` paragraph breaks become a blank line. Pure.
 * @param {string} body
 * @param {number} [width]
 * @returns {string[]}
 */
export function bodyLines(body, width = BODY.w) {
  const text = String(body ?? '').split('|').map((p) => p.trim()).join('\n\n');
  return wrapText(text, width);
}

/**
 * A porch / door id as words ('porch-dorrow' -> 'Dorrow porch').
 * @param {string|null|undefined} id
 * @returns {string}
 */
export function doorName(id) {
  if (!id) return 'the right door'; // str
  const words = String(id).replace(/^porch-/, '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return `${words.join(' ')} porch`; // str
}

/**
 * Lerp two hex colours (#RRGGBB) by k.
 * @param {string} a @param {string} b @param {number} k
 */
function mix(a, b, k) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return `#${((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1)}`;
}

/**
 * Draws a wax seal (24×24 at scale 2 of a 12-px disc) with its glyph. `crack` 0..1 splits it.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y
 * @param {{colour: string, glyph: string}} seal
 * @param {number} [crack=0]
 */
export function drawWaxSeal(ctx, x, y, seal, crack = 0) {
  const dark = mix(seal.colour, '#141B33', 0.45);
  const light = mix(seal.colour, '#F6F1E3', 0.35);
  const glyph = SEAL_GLYPHS[seal.glyph] ?? SEAL_GLYPHS.blot;
  const split = Math.round(crack * 6);
  for (let half = 0; half < 2; half++) {
    const dx = half === 0 ? -split : split;
    const dy = Math.round(crack * crack * 10);
    for (let py = 0; py < 12; py++) {
      for (let px = 0; px < 12; px++) {
        if (half === 0 ? px >= 6 : px < 6) continue;
        const ddx = px - 5.5, ddy = py - 5.5;
        const r = Math.sqrt(ddx * ddx + ddy * ddy);
        if (r > 6) continue;
        let col = r > 5 ? dark : seal.colour;
        if (r <= 5 && ddx + ddy < -5) col = light;
        const gx = px - 2, gy = py - 2;
        if (gx >= 0 && gx < 7 && gy >= 0 && gy < 7 && glyph[gy][gx] === '#') col = dark;
        // the crack line zig-zags down the middle
        if (crack > 0 && (px === 5 || px === 6) && (py + (px === 5 ? 0 : 1)) % 3 === 0) col = dark;
        ctx.fillStyle = col;
        ctx.fillRect(x + px * 2 + dx, y + py * 2 + (crack > 0 ? dy : 0), 2, 2);
      }
    }
  }
}

/**
 * @param {any} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string, isBusy: () => boolean}}
 */
export function createLetterScene(G) {
  /** @type {any} */ let params = {};
  /** @type {any} */ let row = null;
  let n = null;
  let label = '';
  let state = 'sealed'; // wall | sealed | breaking | unfold | reading | carry | closing | done
  let stateT = 0;
  /** @type {string[]} */ let lines = [];
  let total = 0, shown = 0, acc = 0;
  let scroll = 0;
  let wasRead = false;
  let family = false;
  let carried = false;
  /** @type {string[]} */ let revealToasts = [];
  let bob = 0;

  const emit = (evt, p) => { try { G.bus?.emit(evt, p); } catch { /* never break reading */ } };
  const visibleRows = () => Math.floor(BODY.h / LINE_H);

  function pickLetter(p) {
    const L = G.world.letters;
    if (Number.isInteger(p.n)) return p.n;
    if (Number.isInteger(L.today) && L.got.includes(L.today)) return L.today;
    const u = letters.unread(G.world);
    if (u.length) return u[0];
    return L.got.length ? L.got[L.got.length - 1] : null;
  }

  function charsUpTo(lineIndex) {
    let c = 0;
    for (let i = 0; i < lineIndex && i < lines.length; i++) c += Array.from(lines[i]).length;
    return c;
  }

  function typedLine() {
    let c = shown;
    for (let i = 0; i < lines.length; i++) {
      const len = Array.from(lines[i]).length;
      if (c <= len) return i;
      c -= len;
    }
    return lines.length - 1;
  }

  function go(next) { state = next; stateT = 0; }

  function breakSeal() {
    go('breaking');
    emit('sfx', { name: 'letter' });
    emit('music:cue', { sting: 'letter' });
  }

  function finishReading() {
    if (n === null) { close(); return; }
    if (!wasRead) {
      const res = G.store.tx('letter:read', (w) => letters.markRead(w, G.data, /** @type {number} */ (n), { bus: G.bus }));
      if (res && res.ok) {
        for (const op of res.reveal ?? []) if (op && op.op === 'toast' && typeof op.text === 'string') revealToasts.push(op.text);
        for (const text of revealToasts) emit('toast', { text });
        emit('toast', { text: t('letter.read', { n: label }), icon: 'read' });
      }
      wasRead = true;
    }
    const L = G.world.letters;
    if (family && (L.counter === n || L.carrying.includes(/** @type {number} */ (n))) && !L.doors.includes(/** @type {number} */ (n))) {
      if (L.counter === n) {
        const r = G.store.tx('letter:carry', (w) => letters.carry(w, G.data, { bus: G.bus }));
        carried = !!(r && r.ok);
      } else carried = true;
      go('carry');
      return;
    }
    close();
  }

  function close() {
    go('closing');
  }

  function popNow() {
    state = 'done';
    const result = { read: n };
    // pop first: a callback that opens the next screen must not bury this one under it
    if (G.scenes.top() === scene) G.scenes.pop(result);
    if (typeof params.onClose === 'function') { try { params.onClose(result); } catch (e) { console.warn(e); } }
  }

  const scene = {
    name: 'letter',
    opaque: true,
    enter(p) {
      params = p ?? {};
      n = pickLetter(params);
      row = n !== null ? letters.letterByN(G.data, n) : null;
      label = row ? letters.labelOf(G.data, row) : '';
      family = row ? letters.channelOf(row) === 'family' : false;
      wasRead = n !== null && letters.isRead(G.world, n);
      lines = row ? bodyLines(row.body) : ['The mailbox is empty this morning.']; // str
      total = lines.reduce((s, l) => s + Array.from(l).length, 0);
      shown = 0; acc = 0; scroll = 0; carried = false; revealToasts = [];
      const fromWall = params.from === 'wall' && row && letters.channelOf(row) === 'town';
      if (!row) { shown = total; go('reading'); return; }
      if (wasRead) { shown = total; go('reading'); return; }
      go(fromWall ? 'wall' : 'sealed');
    },
    exit() {},
    update(dt) {
      stateT += dt;
      bob = (bob + dt) % TIMING.cursorBobMs;
      if (state === 'breaking' && stateT >= framesMs(G, 5) + framesMs(G, 14)) go('unfold');
      if (state === 'unfold' && stateT >= framesMs(G, 6)) {
        go('reading');
        if (!Number.isFinite(textCps(G))) shown = total;
      }
      if (state === 'reading' && shown < total) {
        const cps = textCps(G) * 2; // letters are long: the typewriter runs at twice the dialogue rate
        const fast = !!(G.input && G.input.held && G.input.held('confirm') && G.input.heldFor('confirm') >= 250);
        if (!Number.isFinite(cps)) shown = total;
        else {
          acc += (dt * cps * (fast ? 4 : 1)) / 1000;
          const add = Math.floor(acc);
          acc -= add;
          shown = Math.min(total, shown + add);
          const line = typedLine();
          if (line - scroll >= visibleRows()) scroll = line - visibleRows() + 1;
        }
      }
      if (state === 'closing' && stateT >= framesMs(G, 4)) popNow();
    },
    handleInput(input) {
      const tap = !!(input.pointer && input.pointer.inside && input.pointer.justDown);
      if (state === 'wall') {
        if (stateT < framesMs(G, 20)) return;
        if (input.pressed('confirm') || tap) go('sealed');
        else if (input.pressed('cancel')) close();
        return;
      }
      if (state === 'sealed') {
        if (input.pressed('confirm') || tap) breakSeal();
        else if (input.pressed('cancel')) close(); // keep it sealed for later
        return;
      }
      if (state === 'reading') {
        const maxScroll = Math.max(0, lines.length - visibleRows());
        if (input.repeat('up')) scroll = Math.max(0, scroll - 1);
        if (input.repeat('down')) scroll = Math.min(maxScroll, scroll + 1);
        if (input.pressed('confirm') || input.pressed('cancel') || tap) {
          if (shown < total) { shown = total; return; }
          if (input.pressed('confirm') && scroll < maxScroll) { scroll = Math.min(maxScroll, scroll + visibleRows() - 1); return; }
          finishReading();
        }
        return;
      }
      if (state === 'carry') {
        if (stateT < framesMs(G, 10)) return;
        if (input.pressed('confirm') || input.pressed('cancel') || tap) close();
      }
    },
    draw(ctx) {
      ctx.fillStyle = PALETTE.nightInk;
      ctx.fillRect(0, 0, 480, 270);
      // the desk
      ctx.fillStyle = PALETTE.deepBlue;
      for (let y = 0; y < 270; y += 4) ctx.fillRect(0, y, 480, 1);
      const seal = sealOf(row?.seal);
      if (state === 'wall') { drawWall(ctx, seal); return; }
      if (state === 'sealed' || state === 'breaking') { drawFolded(ctx, seal); return; }
      const k = state === 'unfold' ? Math.min(1, stateT / Math.max(1, framesMs(G, 6))) : 1;
      drawPage(ctx, seal, reducedMotion(G) ? 1 : ease.outQuad(k));
      if (state === 'carry') drawCarry(ctx);
      if (state === 'closing') {
        ctx.save();
        ctx.globalAlpha = Math.min(1, stateT / Math.max(1, framesMs(G, 4)));
        ctx.fillStyle = PALETTE.nightInk;
        ctx.fillRect(0, 0, 480, 270);
        ctx.restore();
      }
    },
    debugText() {
      if (!row) return 'letter: none';
      const head = `${label} from ${row.from}`;
      if (state === 'sealed' || state === 'wall') return `${head} (${state})`;
      return `${head}\n${lines.slice(scroll, scroll + visibleRows()).join('\n')}${state === 'carry' ? `\n${t('letter.carry')}` : ''}`;
    },
    isBusy: () => (state === 'reading' && shown < total) || state === 'breaking' || state === 'unfold' || state === 'closing',
    get state() { return state; },
  };

  // ------------------------------------------------------------------ drawing
  function drawFolded(ctx, seal) {
    const R = { x: 140, y: 70, w: 200, h: 120 };
    ctx.fillStyle = COLORS.shadow;
    ctx.fillRect(R.x + 3, R.y + 3, R.w, R.h);
    ctx.fillStyle = COLORS.paper.fill;
    ctx.fillRect(R.x, R.y, R.w, R.h);
    // the fold: a flap triangle
    ctx.fillStyle = COLORS.paper.shade;
    for (let i = 0; i < R.w / 2; i++) {
      const h = Math.round((i / (R.w / 2)) * 56);
      ctx.fillRect(R.x + i, R.y, 1, h);
      ctx.fillRect(R.x + R.w - 1 - i, R.y, 1, h);
    }
    ctx.fillStyle = COLORS.paper.edge;
    for (let i = 0; i < R.w / 2; i++) {
      const h = Math.round((i / (R.w / 2)) * 56);
      ctx.fillRect(R.x + i, R.y + h, 1, 1);
      ctx.fillRect(R.x + R.w - 1 - i, R.y + h, 1, 1);
    }
    ctx.fillRect(R.x, R.y, R.w, 1); ctx.fillRect(R.x, R.y + R.h - 1, R.w, 1); ctx.fillRect(R.x, R.y, 1, R.h); ctx.fillRect(R.x + R.w - 1, R.y, 1, R.h);
    if (row) {
      drawText(ctx, row.to ?? '', R.x + R.w / 2, R.y + R.h - 34, { align: 'center', color: COLORS.paper.ink, maxWidth: R.w - 16 });
      drawText(ctx, `${label}  ${seal.name}`, R.x + R.w / 2, R.y + R.h - 20, { align: 'center', font: 'small', color: COLORS.paper.inkSoft });
    }
    const crack = state === 'breaking' ? Math.min(1, stateT / Math.max(1, framesMs(G, 5) + framesMs(G, 14))) : 0;
    drawWaxSeal(ctx, R.x + R.w / 2 - 12, R.y + 44, seal, crack);
    if (state === 'sealed') {
      const lift = bob < TIMING.cursorBobMs / 2 ? 0 : 1;
      drawSealButton(ctx, 'Break the seal', 240 - 44, 206, { focused: true, w: 88 }); // str
      drawText(ctx, TYPE.cursor, 240 - 52 + lift, 209, { color: COLORS.paper.light });
      const dev = G.input?.lastDevice === 'gamepad' ? 'gamepad' : G.input?.lastDevice === 'touch' ? 'touch' : 'keyboard';
      drawText(ctx, `${DEVICE_LABELS[dev].cancel}: keep it for later`, 240, 228, { align: 'center', font: 'small', color: COLORS.dark.textSoft }); // str
    }
  }

  function drawPage(ctx, seal, k) {
    const h = Math.round(PAGE.h * (0.35 + 0.65 * k));
    const y = PAGE.y + Math.round((PAGE.h - h) / 2);
    drawPanel(ctx, { x: PAGE.x, y, w: PAGE.w, h }, 'ledger', { rulePitch: LINE_H, ruleStart: BODY.y - PAGE.y + 9, margin: 12 });
    if (k < 1) return;
    if (!row) {
      drawText(ctx, lines[0], PAGE.x + PAGE.w / 2, PAGE.y + 110, { align: 'center', color: COLORS.paper.inkSoft });
      return;
    }
    // header
    drawText(ctx, t('letter.from', { from: row.byline ?? row.from ?? '' }), PAGE.x + 18, PAGE.y + 12, { color: COLORS.paper.ink });
    drawText(ctx, t('letter.dated', { date: row.date ?? '' }), PAGE.x + 18, PAGE.y + 24, { color: COLORS.paper.inkSoft, font: 'small' });
    drawText(ctx, t('letter.to', { to: row.to ?? '' }), PAGE.x + 18, PAGE.y + 34, { color: COLORS.paper.inkSoft, font: 'small', maxWidth: 250 });
    drawText(ctx, label, PAGE.x + PAGE.w - 44, PAGE.y + 38, { align: 'right', color: COLORS.wax.fill });
    // the broken seal: two halves, still on the page
    drawWaxSeal(ctx, PAGE.x + PAGE.w - 36, PAGE.y + 8, seal, wasRead && state !== 'reading' ? 0.35 : 0.35);
    ctx.fillStyle = COLORS.paper.rule;
    ctx.fillRect(PAGE.x + 14, BODY.y - 6, PAGE.w - 28, 1);
    // body
    const rows = visibleRows();
    let before = charsUpTo(scroll);
    for (let i = 0; i < rows && scroll + i < lines.length; i++) {
      const line = lines[scroll + i];
      const len = Array.from(line).length;
      const vis = Math.max(0, Math.min(len, shown - before));
      if (vis > 0) drawTextTyped(ctx, line, BODY.x, BODY.y + i * LINE_H, vis, { color: COLORS.paper.ink });
      before += len;
    }
    // more / scroll marks
    const maxScroll = Math.max(0, lines.length - rows);
    const lift = bob < TIMING.cursorBobMs / 2 ? 0 : 1;
    if (scroll > 0) drawText(ctx, '▲', PAGE.x + PAGE.w - 14, BODY.y - 2, { color: COLORS.paper.inkFaint });
    if (scroll < maxScroll && shown >= total) drawText(ctx, TYPE.more, PAGE.x + PAGE.w - 14, PAGE.y + PAGE.h - 12 + lift, { color: COLORS.wax.fill });
    else if (shown >= total && state === 'reading') drawText(ctx, TYPE.cursor, PAGE.x + PAGE.w - 14, PAGE.y + PAGE.h - 12, { color: COLORS.wax.fill });
    if (lines.length > rows) {
      const trackH = BODY.h;
      const barH = Math.max(8, Math.round(trackH * (rows / lines.length)));
      const barY = BODY.y + Math.round((trackH - barH) * (maxScroll ? scroll / maxScroll : 0));
      ctx.fillStyle = COLORS.paper.shade;
      ctx.fillRect(PAGE.x + PAGE.w - 8, BODY.y, 2, trackH);
      ctx.fillStyle = COLORS.paper.edge;
      ctx.fillRect(PAGE.x + PAGE.w - 8, barY, 2, barH);
    }
  }

  function drawCarry(ctx) {
    const k = Math.min(1, stateT / Math.max(1, framesMs(G, 5)));
    const w = 260, h = 44;
    const x = 110 + Math.round((1 - (reducedMotion(G) ? 1 : k)) * 30), y = 196;
    drawPanel(ctx, { x, y, w, h }, 'notice', { torn: 'both', pin: true });
    drawText(ctx, 'Carry to door', x + 12, y + 9, { color: COLORS.wax.fill }); // str
    drawText(ctx, `${t('letter.carry')} ${doorName(row?.door)}.`.replace('door. ', 'door: '), x + 12, y + 21, { color: COLORS.paper.ink, maxWidth: w - 24 });
    drawText(ctx, carried ? 'In your satchel.' : '', x + 12, y + 31, { font: 'small', color: COLORS.paper.inkSoft }); // str
    if (row?.heirloom) drawText(ctx, `Heirloom: ${itemOf(G.data, row.heirloom)?.name ?? row.heirloom}`, x + w - 12, y + 31, { align: 'right', font: 'small', color: COLORS.paper.inkSoft }); // str
  }

  function drawWall(ctx, seal) {
    const B = { x: 16, y: 26, w: 448, h: 222 };
    // cork
    ctx.fillStyle = '#B9895A';
    ctx.fillRect(B.x, B.y, B.w, B.h);
    ctx.fillStyle = '#A57749';
    for (let i = 0; i < 900; i++) {
      const px = (i * 97) % B.w, py = (i * 61 + Math.floor(i / 7) * 13) % B.h;
      ctx.fillRect(B.x + px, B.y + py, 1, 1);
    }
    ctx.fillStyle = '#6B4A2E';
    ctx.fillRect(B.x - 4, B.y - 4, B.w + 8, 4); ctx.fillRect(B.x - 4, B.y + B.h, B.w + 8, 4);
    ctx.fillRect(B.x - 4, B.y, 4, B.h); ctx.fillRect(B.x + B.w, B.y, 4, B.h);
    drawText(ctx, t('archive.stringWall'), B.x + 8, B.y - 14, { color: COLORS.paper.light });
    const pinned = (G.world.letters.pinned ?? []).slice(-12);
    const findId = row?.find ?? row?.relicId ?? null;
    const list = findId && !pinned.includes(findId) ? [...pinned, findId] : pinned;
    const cols = 4;
    const cards = list.map((id, i) => ({ id, x: B.x + 16 + (i % cols) * 72, y: B.y + 16 + Math.floor(i / cols) * 64 }));
    const letterCard = { x: B.x + B.w - 132, y: B.y + 40, w: 112, h: 92 };
    // strings first (under the cards)
    const kString = Math.min(1, stateT / Math.max(1, framesMs(G, 20)));
    for (const c of cards) {
      const newOne = c.id === findId;
      const k = newOne ? kString : 1;
      const tl = letters.townLetterFor(G.data, c.id);
      if (!tl && !newOne) continue;
      const ax = c.x + 28, ay = c.y + 6;
      const bx = newOne ? letterCard.x + 56 : letterCard.x + 10 + (cards.indexOf(c) % 5) * 22, by = newOne ? letterCard.y + 4 : letterCard.y + letterCard.h + 8;
      drawString(ctx, ax, ay, ax + (bx - ax) * k, ay + (by - ay) * k, newOne ? PALETTE.r : '#8E2A31');
    }
    for (const c of cards) {
      const row2 = itemOf(G.data, c.id);
      const newOne = c.id === findId;
      ctx.fillStyle = COLORS.shadow;
      ctx.fillRect(c.x + 1, c.y + 1, 56, 48);
      ctx.fillStyle = newOne ? COLORS.paper.light : COLORS.paper.fill;
      ctx.fillRect(c.x, c.y, 56, 48);
      drawIcon(ctx, 'pin', c.x + 24, c.y + 2);
      drawIcon(ctx, row2?.kind === 'relic' ? 'star' : 'dig', c.x + 24, c.y + 14);
      drawText(ctx, row2?.name ?? c.id, c.x + 28, c.y + 28, { align: 'center', font: 'small', color: COLORS.paper.ink, maxWidth: 52 });
    }
    // the letter it unlocked
    ctx.fillStyle = COLORS.shadow;
    ctx.fillRect(letterCard.x + 2, letterCard.y + 2, letterCard.w, letterCard.h);
    ctx.fillStyle = COLORS.paper.fill;
    ctx.fillRect(letterCard.x, letterCard.y, letterCard.w, letterCard.h);
    drawIcon(ctx, 'pin', letterCard.x + 52, letterCard.y + 1);
    drawWaxSeal(ctx, letterCard.x + letterCard.w / 2 - 12, letterCard.y + 18, seal, 0);
    drawText(ctx, label, letterCard.x + letterCard.w / 2, letterCard.y + 48, { align: 'center', color: COLORS.wax.fill });
    drawText(ctx, row?.subject ?? '', letterCard.x + letterCard.w / 2, letterCard.y + 60, { align: 'center', font: 'small', color: COLORS.paper.inkSoft, maxWidth: letterCard.w - 10 });
    if (stateT >= framesMs(G, 20)) drawSealButton(ctx, 'Read the letter', letterCard.x + 6, letterCard.y + letterCard.h + 30, { focused: true, w: 100 }); // str
  }

  function drawString(ctx, x0, y0, x1, y1, color) {
    const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
    ctx.fillStyle = color;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const sag = Math.sin(k * Math.PI) * Math.min(10, steps / 12);
      ctx.fillRect(Math.round(x0 + (x1 - x0) * k), Math.round(y0 + (y1 - y0) * k + sag), 1, 1);
    }
  }

  return scene;
}

/** The measured width of a seal label (tests). */
export const sealLabelWidth = (s) => measureText(s).w;
