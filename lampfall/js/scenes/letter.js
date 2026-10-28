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
 * Params: `{n?, from?: 'mailbox'|'counter'|'journal'|'wall'|'script', onClose?, journal?}`; `n`
 * defaults to this morning's letter, else the first unread. Pops with `{read: n}`.
 *
 * **Journal** (`{journal: true}`, Pause → Journal; GDD-09 §3.23, LG-RN104): tabs Letters / Stamps /
 * Season Book / Seed Card / Log at 16,8. Letters lists every letter received, grouped by channel;
 * confirm re-reads one (a letter scene on top). Stamps is the 6×4 grid with the focused stamp's
 * words; the Season Book is Dimity's tally of the season, whose last page is the Seed Card
 * (`seedCard.drawRunCard`); Log is the 100-line text log. Empty pages say what to do next (LG-PF5).
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
import { textCps, reducedMotion, skipAnims, framesMs, textLog } from './scriptHost.js';
import { drawRunCard } from './seedCard.js';
import { STAMPS } from '../data/town.js';
import { TUNING } from '../data/tuning.js';
import * as stampSys from '../systems/stamps.js';
import * as flagSys from '../systems/flags.js';
import { isPorchLit } from '../systems/townCommon.js';
import * as loansSys from '../systems/loans.js';
import { litPorchCount } from './flowKit.js';

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

// ---------------------------------------------------------------------------------------------
// Journal (pure helpers)
// ---------------------------------------------------------------------------------------------

/** Journal tabs in order (GDD-09 §3.23); labels are `journal.<id>`. */
export const JOURNAL_TABS = Object.freeze(['letters', 'stamps', 'seasonBook', 'seedCard', 'log']);
/** Letter channels in Journal order. */
export const JOURNAL_CHANNELS = Object.freeze(['keeper', 'family', 'town', 'event']);

/**
 * The Letters tab: a heading per channel that has letters, then its letters in serial order.
 * @param {any} world
 * @param {any} data
 * @returns {Array<{kind: 'head', channel: string, text: string} | {kind: 'letter', n: number, label: string, subject: string, unread: boolean}>}
 */
export function journalLetterRows(world, data) {
  const got = Array.isArray(world?.letters?.got) ? world.letters.got : [];
  const byChannel = new Map(JOURNAL_CHANNELS.map((c) => [c, []]));
  for (const n of [...got].sort((a, b) => a - b)) {
    const row = letters.letterByN(data, n);
    if (!row) continue;
    const ch = letters.channelOf(row);
    const list = byChannel.get(JOURNAL_CHANNELS.includes(ch) ? ch : 'event');
    list.push({ kind: 'letter', n, label: letters.labelOf(data, row), subject: row.subject ?? row.from ?? '', unread: !letters.isRead(world, n) });
  }
  const out = [];
  for (const [ch, list] of byChannel) {
    if (!list.length) continue;
    out.push({ kind: 'head', channel: ch, text: t(`journal.channel.${ch}`) });
    out.push(...list);
  }
  return out;
}

/**
 * The Stamps tab: all 24 stamps with whether each is stamped (its `cond` holds now).
 * @param {any} world
 * @param {any} data
 * @returns {Array<{id: string, name: string, text: string, earned: boolean}>}
 */
export function stampStates(world, data) {
  const got = new Set(stampSys.earnedStamps(world, STAMPS, { data }));
  return STAMPS.map((s) => {
    const earned = got.has(s.id);
    const name = t(`stamp.${s.id}.name`) !== `stamp.${s.id}.name` ? t(`stamp.${s.id}.name`) : s.name;
    const text = t(`stamp.${s.id}.text`) !== `stamp.${s.id}.text` ? t(`stamp.${s.id}.text`) : s.text;
    return { id: s.id, name, text, earned };
  });
}

/** Flag prefix marking a stamp the Journal has already announced (`stamp.got.<id>`). */
export const STAMP_GOT_PREFIX = 'stamp.got.';

/**
 * Stamps earned now (systems/stamps.earnedStamps over data/town STAMPS) that have not been announced
 * yet, in table order. Pure.
 * @param {any} world
 * @param {any} data
 * @returns {string[]}
 */
export function newStamps(world, data) {
  return stampSys.earnedStamps(world, STAMPS, { data }).filter((id) => !world?.flags?.[`${STAMP_GOT_PREFIX}${id}`]);
}

/**
 * Announces every newly earned stamp once: marks it (`stamp.got.<id>`, systems/flags) and toasts
 * `stamp.earned` with its name. Returns the ids announced.
 * @param {any} G
 * @returns {string[]}
 */
export function announceStamps(G, opts = {}) {
  const fresh = newStamps(G.world, G.data);
  if (!fresh.length) return fresh;
  G.store.tx('journal:stamps', (w) => { for (const id of fresh) flagSys.setFlag(w, `${STAMP_GOT_PREFIX}${id}`, true, { bus: G.bus }); });
  const nameOf = (id) => {
    const row = STAMPS.find((s) => s.id === id);
    const key = `stamp.${id}.name`;
    return t(key) !== key ? t(key) : row?.name ?? id;
  };
  // FE-18: several at once are one slip, not a column of toasts over the Journal's rows
  const text = fresh.length === 1 ? t('stamp.earned', { name: nameOf(fresh[0]) })
    : t('stamp.earnedMany', { n: fresh.length, names: fresh.map(nameOf).join(', ') });
  // the Journal stamps them quietly and tags them NEW on its Stamps page (FE-18: a slip there sat
  // over the grid's rows)
  if (!opts.quiet) { try { G.bus?.emit('toast', { text, icon: 'star' }); } catch { /* toasts never break the journal */ } }
  return fresh;
}

/**
 * Dimity's Season Book: the season so far, one line each. Pure.
 * @param {any} world
 * @param {any} data
 * @returns {string[]}
 */
export function seasonBookLines(world, data) {
  const lines = [];
  const day = Math.floor((world?.clock?.total ?? 0) / 1440) + 1;
  lines.push(t('journal.seasonBook.line.day', { n: day }));
  try {
    const ctx = { data };
    if (loansSys.isPaidOff(world, ctx)) lines.push(t('journal.seasonBook.line.paidOff'));
    else lines.push(t('journal.seasonBook.line.loan', { n: world?.loans?.tier ?? 1, owed: loansSys.balance(world, ctx).toLocaleString('en-US') }));
  } catch { /* no loans table */ }
  lines.push(t('journal.seasonBook.line.seals', { n: world?.badges?.length ?? 0 }));
  lines.push(t('journal.seasonBook.line.letters', { n: (world?.letters?.read ?? []).length }));
  lines.push(t('journal.seasonBook.line.party', { n: world?.party?.length ?? 0, box: world?.box?.length ?? 0 }));
  try { lines.push(t('journal.seasonBook.line.porches', { n: litPorchCount(world, data) })); } catch { /* no porches */ }
  return lines;
}

/**
 * What an empty letter page / Letters tab says to do next (LG-PF5): light the porch first.
 * @param {any} world
 * @param {any} data
 * @returns {string}
 */
export function emptyLettersText(world, data) {
  let lit = true;
  try { lit = isPorchLit(world, data, TUNING.homePorchId ?? 'porch-keepers-cottage', { tuning: TUNING }); } catch { lit = true; }
  return t(lit ? 'journal.empty.letters.lit' : 'journal.empty.letters.dark');
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

  /** @type {ReturnType<typeof createJournalView>|null} */ let journal = null;

  const scene = {
    name: 'letter',
    opaque: true,
    enter(p) {
      params = p ?? {};
      if (params.journal) { journal = createJournalView(G, () => scene); journal.enter(params); return; }
      journal = null;
      n = pickLetter(params);
      row = n !== null ? letters.letterByN(G.data, n) : null;
      label = row ? letters.labelOf(G.data, row) : '';
      family = row ? letters.channelOf(row) === 'family' : false;
      wasRead = n !== null && letters.isRead(G.world, n);
      lines = row ? bodyLines(row.body) : [emptyLettersText(G.world, G.data)];
      total = lines.reduce((s, l) => s + Array.from(l).length, 0);
      shown = 0; acc = 0; scroll = 0; carried = false; revealToasts = [];
      const fromWall = params.from === 'wall' && row && letters.channelOf(row) === 'town';
      if (!row) { shown = total; go('reading'); return; }
      if (wasRead) { shown = total; go('reading'); return; }
      go(fromWall ? 'wall' : 'sealed');
    },
    exit() {},
    resume() { if (journal) journal.refresh(); },
    update(dt) {
      if (journal) { journal.update(dt); return; }
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
      if (journal) { journal.handleInput(input); return; }
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
      if (journal) { journal.draw(ctx); return; }
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
      if (journal) return journal.debugText();
      if (!row) return `letter: none\n${lines[0] ?? ''}`;
      const head = `${label} from ${row.from}`;
      if (state === 'sealed' || state === 'wall') return `${head} (${state})`;
      return `${head}\n${lines.slice(scroll, scroll + visibleRows()).join('\n')}${state === 'carry' ? `\n${t('letter.carry')}` : ''}`;
    },
    isBusy: () => !journal && ((state === 'reading' && shown < total) || state === 'breaking' || state === 'unfold' || state === 'closing'),
    get state() { return journal ? 'journal' : state; },
    /** The Journal view when opened with `{journal: true}` (tests). */
    get journal() { return journal; },
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

// ---------------------------------------------------------------------------------------------
// Journal view
// ---------------------------------------------------------------------------------------------

const JOURNAL_PANEL = Object.freeze({ x: 16, y: 26, w: 448, h: 226 });
const STAMP_GRID = Object.freeze({ x: 28, y: 34, cols: 6, rows: 4, w: 64, h: 40, gapX: 8, gapY: 4 });
const JOURNAL_ROW_H = 12;
const JOURNAL_ROWS = 17;

/**
 * The Journal's tabbed view (GDD-09 §3.23). Lives inside the letter scene so Pause → Journal keeps
 * one scene name; re-reading a letter pushes a plain letter scene on top.
 * @param {any} G
 * @param {() => any} self  the owning scene (to tell whether it is on top)
 */
function createJournalView(G, self) {
  let tab = 0;
  let cursor = 0;      // letters: index into rows; stamps: cell
  let top = 0;         // letters/log scroll
  let ms = 0;
  /** @type {ReturnType<typeof journalLetterRows>} */ let rows = [];
  /** @type {ReturnType<typeof stampStates>} */ let stamps = [];
  /** stamps first stamped while this Journal is open: tagged NEW */
  const freshStamps = new Set();
  const tabId = () => JOURNAL_TABS[tab];
  const letterIdx = () => rows.map((r, i) => (r.kind === 'letter' ? i : -1)).filter((i) => i >= 0);
  const logLines = () => {
    const out = [];
    for (const l of textLog(G).lines()) for (const w of wrapText(l.who ? `${l.who}: ${l.text}` : l.text, JOURNAL_PANEL.w - 32)) out.push(w);
    return out;
  };

  function refresh() {
    try { if (G.store) for (const id of announceStamps(G, { quiet: true })) freshStamps.add(id); } catch (e) { console.warn('journal: stamps', e); }
    rows = journalLetterRows(G.world, G.data);
    stamps = stampStates(G.world, G.data);
    const li = letterIdx();
    if (tabId() === 'letters' && li.length && !li.includes(cursor)) cursor = li[0];
  }
  function setTab(i) {
    tab = (i + JOURNAL_TABS.length) % JOURNAL_TABS.length;
    cursor = 0; top = 0;
    refresh();
    if (tabId() === 'log') top = Math.max(0, logLines().length - JOURNAL_ROWS);
    try { G.bus?.emit('ui:cursor', {}); } catch { /* audio never breaks the journal */ }
  }
  function close() { const me = self(); if (G.scenes.top() === me) G.scenes.pop({ journal: true }); }
  function open() {
    const r = rows[cursor];
    if (!r || r.kind !== 'letter') return;
    try { G.bus?.emit('ui:confirm', {}); } catch { /* no audio */ }
    if (typeof G.push === 'function') G.push('letter', { n: r.n, from: 'journal' });
  }
  function moveLetters(d) {
    const li = letterIdx();
    if (!li.length) return;
    const at = Math.max(0, li.indexOf(cursor));
    cursor = li[(at + d + li.length) % li.length];
    if (cursor < top + 1) top = Math.max(0, cursor - 1);
    if (cursor >= top + JOURNAL_ROWS) top = cursor - JOURNAL_ROWS + 1;
  }

  return {
    refresh,
    enter(p) {
      const want = JOURNAL_TABS.indexOf(p && typeof p.tab === 'string' ? p.tab : 'letters');
      tab = want >= 0 ? want : 0; cursor = 0; top = 0; ms = 0;
      refresh();
      if (tabId() === 'log') top = Math.max(0, logLines().length - JOURNAL_ROWS);
    },
    update(dt) { ms += dt; },
    handleInput(input) {
      if (input.pressed('cancel') || (input.pressed('menu') && !input.pressed('confirm')) || input.pressed('log')) { close(); return; }
      const p = input.pointer;
      if (p && p.justDown && p.y >= 8 && p.y < 22 && p.x >= 16 && p.x < 16 + JOURNAL_TABS.length * 90) { setTab(Math.floor((p.x - 16) / 90)); return; }
      if (input.pressed('l')) { setTab(tab - 1); return; }
      if (input.pressed('r')) { setTab(tab + 1); return; }
      const id = tabId();
      if (id === 'stamps') {
        const n = STAMP_GRID.cols * STAMP_GRID.rows;
        // Left / Right walk the grid; past the row's edge they turn the tab, as the hint says
        // (Left/Right or [ ]: Tab), so the Stamps page is never a dead end for the arrows
        const col = cursor % STAMP_GRID.cols;
        if (input.pressed('left') && col === 0) { setTab(tab - 1); return; }
        if (input.pressed('right') && col === STAMP_GRID.cols - 1) { setTab(tab + 1); return; }
        if (input.repeat('left') && col > 0) cursor -= 1;
        if (input.repeat('right') && col < STAMP_GRID.cols - 1) cursor += 1;
        if (input.repeat('up')) cursor = (cursor + n - STAMP_GRID.cols) % n;
        if (input.repeat('down')) cursor = (cursor + STAMP_GRID.cols) % n;
        return;
      }
      if (input.repeat('left')) { setTab(tab - 1); return; }
      if (input.repeat('right')) { setTab(tab + 1); return; }
      if (id === 'letters') {
        if (input.repeat('up')) moveLetters(-1);
        if (input.repeat('down')) moveLetters(1);
        if (input.pressed('confirm')) open();
        return;
      }
      if (id === 'log') {
        const max = Math.max(0, logLines().length - JOURNAL_ROWS);
        if (input.repeat('up')) top = Math.max(0, top - 1);
        if (input.repeat('down')) top = Math.min(max, top + 1);
      }
    },
    draw(ctx) {
      ctx.fillStyle = PALETTE.nightInk;
      ctx.fillRect(0, 0, 480, 270);
      // tabs at 16,8
      JOURNAL_TABS.forEach((id, i) => {
        const x = 16 + i * 90;
        ctx.fillStyle = i === tab ? COLORS.wax.fill : PALETTE.deepBlue;
        ctx.fillRect(x, 8, 86, 14);
        drawText(ctx, t(`journal.${id}`), x + 43, 11, { align: 'center', color: COLORS.paper.light, font: 'small' });
      });
      const P = JOURNAL_PANEL;
      const id = tabId();
      if (id === 'seedCard') {
        drawRunCard(ctx, G, 72, 32);
      } else {
        drawPanel(ctx, P, id === 'stamps' ? 'paper' : 'ledger');
        if (id === 'letters') drawLetters(ctx);
        else if (id === 'stamps') drawStamps(ctx);
        else if (id === 'seasonBook') drawSeasonBook(ctx);
        else drawLog(ctx);
      }
      drawText(ctx, t('journal.hints'), 240, 258, { align: 'center', color: COLORS.dark.textSoft, font: 'small' });
    },
    debugText() {
      const id = tabId();
      const head = `${t('journal.heading')}: ${t(`journal.${id}`)}`;
      if (id === 'letters') return rows.length ? `${head}\n${rows.map((r, i) => (r.kind === 'head' ? r.text : `${i === cursor ? '>' : ' '} ${r.label} ${r.subject}${r.unread ? ` (${t('journal.unread')})` : ''}`)).join('\n')}` : `${head}\n${emptyLettersText(G.world, G.data)}`;
      if (id === 'stamps') { const st = stamps[cursor]; return `${head}\n${t('journal.stampCount', { n: stamps.filter((x) => x.earned).length })}\n${st ? `${st.name}: ${st.earned ? st.text : t('journal.stampLocked')}` : ''}`; }
      if (id === 'seasonBook') return `${head}\n${seasonBookLines(G.world, G.data).join('\n')}\n${t('journal.seasonBook.lastPage')}`;
      if (id === 'seedCard') return `${head}\n${G.world?.run?.seedCode ?? ''}`;
      const lines = logLines();
      return `${head}\n${lines.length ? lines.slice(top, top + JOURNAL_ROWS).join('\n') : t('journal.empty.log')}`;
    },
    get tab() { return tabId(); },
    get cursor() { return cursor; },
  };

  function drawLetters(ctx) {
    const P = JOURNAL_PANEL;
    if (!rows.length) {
      drawText(ctx, emptyLettersText(G.world, G.data), P.x + P.w / 2, P.y + 96, { align: 'center', color: COLORS.paper.inkSoft, maxWidth: P.w - 60 });
      return;
    }
    for (let i = 0; i < JOURNAL_ROWS && top + i < rows.length; i++) {
      const r = rows[top + i];
      const y = P.y + 10 + i * JOURNAL_ROW_H;
      if (r.kind === 'head') { drawText(ctx, r.text, P.x + 14, y, { color: COLORS.wax.fill }); continue; }
      const focused = top + i === cursor;
      if (focused) { ctx.fillStyle = COLORS.paper.shade; ctx.fillRect(P.x + 20, y - 2, P.w - 40, JOURNAL_ROW_H); drawText(ctx, TYPE.cursor, P.x + 22, y, { color: COLORS.wax.fill }); }
      drawText(ctx, r.label, P.x + 32, y, { color: COLORS.paper.ink });
      drawText(ctx, r.subject, P.x + 70, y, { color: COLORS.paper.inkSoft, maxWidth: P.w - 150 });
      if (r.unread) drawText(ctx, t('journal.unread'), P.x + P.w - 24, y, { align: 'right', color: COLORS.wax.fill, font: 'small' });
    }
  }

  function drawStamps(ctx) {
    const P = JOURNAL_PANEL, S = STAMP_GRID;
    stamps.forEach((st, i) => {
      const x = S.x + (i % S.cols) * (S.w + S.gapX), y = S.y + Math.floor(i / S.cols) * (S.h + S.gapY);
      ctx.fillStyle = st.earned ? COLORS.paper.light : COLORS.paper.shade;
      ctx.fillRect(x, y, S.w, S.h);
      // perforated edge
      ctx.fillStyle = st.earned ? COLORS.wax.fill : COLORS.paper.deep;
      for (let k = 2; k < S.w; k += 4) { ctx.fillRect(x + k, y, 2, 1); ctx.fillRect(x + k, y + S.h - 1, 2, 1); }
      for (let k = 2; k < S.h; k += 4) { ctx.fillRect(x, y + k, 1, 2); ctx.fillRect(x + S.w - 1, y + k, 1, 2); }
      drawText(ctx, st.earned ? st.name : '?', x + S.w / 2, y + S.h / 2 - 4, { align: 'center', color: st.earned ? COLORS.paper.ink : COLORS.paper.inkFaint, font: 'small', maxWidth: S.w - 6 });
      if (st.earned && freshStamps.has(st.id)) {
        ctx.fillStyle = COLORS.wax.fill; ctx.fillRect(x + S.w - 20, y + 2, 18, 8);
        drawText(ctx, t('journal.stampNew'), x + S.w - 11, y + 3, { align: 'center', color: COLORS.paper.light, font: 'small' });
      }
      if (i === cursor) { ctx.fillStyle = COLORS.paper.ink; ctx.fillRect(x - 2, y - 2, S.w + 4, 1); ctx.fillRect(x - 2, y + S.h + 1, S.w + 4, 1); ctx.fillRect(x - 2, y - 2, 1, S.h + 4); ctx.fillRect(x + S.w + 1, y - 2, 1, S.h + 4); }
    });
    const st = stamps[cursor];
    const ty = S.y + S.rows * (S.h + S.gapY) + 2;
    drawText(ctx, t('journal.stampCount', { n: stamps.filter((x) => x.earned).length }), P.x + P.w - 14, ty, { align: 'right', color: COLORS.paper.inkSoft, font: 'small' });
    if (st) drawText(ctx, `${st.earned ? st.name : '?'}: ${st.earned ? st.text : t('journal.stampLocked')}`, P.x + 12, ty, { color: COLORS.paper.ink, font: 'small', maxWidth: P.w - 110 });
  }

  function drawSeasonBook(ctx) {
    const P = JOURNAL_PANEL;
    drawText(ctx, t('journal.seasonBook.heading'), P.x + 18, P.y + 12, { color: COLORS.wax.fill });
    seasonBookLines(G.world, G.data).forEach((line, i) => drawText(ctx, line, P.x + 24, P.y + 34 + i * 16, { color: COLORS.paper.ink, maxWidth: P.w - 48 }));
    drawText(ctx, t('journal.seasonBook.lastPage'), P.x + P.w - 18, P.y + P.h - 18, { align: 'right', color: COLORS.paper.inkSoft, font: 'small' });
  }

  function drawLog(ctx) {
    const P = JOURNAL_PANEL;
    const lines = logLines();
    if (!lines.length) { drawText(ctx, t('journal.empty.log'), P.x + P.w / 2, P.y + 96, { align: 'center', color: COLORS.paper.inkSoft, maxWidth: P.w - 60 }); return; }
    lines.slice(top, top + JOURNAL_ROWS).forEach((line, i) => drawText(ctx, line, P.x + 16, P.y + 10 + i * JOURNAL_ROW_H, { color: COLORS.paper.ink }));
  }
}

/** The measured width of a seal label (tests). */
export const sealLabelWidth = (s) => measureText(s).w;
