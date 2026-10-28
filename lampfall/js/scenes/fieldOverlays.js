/**
 * Built-in field overlays the overworld lends to `systems/flow/interactFlow` when no other lane has
 * registered a scene for them. [SCN-WORLD]
 *
 *  - {@link createBoardScene}: a plank of chalk slips (the gate boards: Ledger pace line, Tide
 *    Table, Commons slip; the Commons board with Augusta's honest odds; a quay Tide Table). Slips
 *    tear in 5 f each, staggered 3 f (GDD-09 §3.9).
 *  - {@link createFerryScene}: Maud's destination card. Every stop with its posted curve; choosing
 *    one asks through the ferry confirm whose cursor starts on Stay (GDD-00 §4).
 *  - {@link createCeremonyScene}: the payment ceremony (GDD-09 §3.20 / §5): the yard at dusk, the
 *    abacus beads (8 f a bead for ten, then 4 f, then 2 f; hold confirm to skip to the strike),
 *    Ambrose's notch (lift 4 f, gnaw 6 f with 2 px chips, strike 5 f, 2 f shake, dust 12 f), the
 *    THWAP (the loudest sound in the game), the stick splitting when a loan clears and the eight
 *    roof swatches with the cursor on Slate Blue.
 * Every overlay is modal (`opaque: false` except the ceremony), never touches the clock, flushes
 * nothing it did not open, and closes on `cancel` without changing state.
 * @module scenes/fieldOverlays
 */
import { drawText, wrapText } from '../core/font.js';
import { drawPanel, drawDim, drawNotchedFrame } from '../ui/panel.js';
import { COLORS, PALETTE } from '../ui/theme.js';
import { getTile, resolveArtId } from '../art/atlas.js';
import { portraitSprite } from '../art/portraits.js';
import { drawSprite } from '../core/pixelart.js';
import { t } from '../data/strings.js';

/** Loans roof colour id -> roof art colour (art/palette ROOF_COLOURS). */
export const ROOF_ART = Object.freeze({
  'slate-blue': 'slate', 'harbor-red': 'red', moss: 'moss', 'sea-blue': 'blue', straw: 'straw', tar: 'dark', heather: 'teal', ochre: 'ochre',
  slate: 'slate', red: 'red', blue: 'blue', dark: 'dark', teal: 'teal',
});
/** Display names for roof swatches. */
export const ROOF_NAMES = Object.freeze({
  'slate-blue': 'Slate Blue', 'harbor-red': 'Harbor Red', moss: 'Moss', 'sea-blue': 'Sea Blue', straw: 'Straw', tar: 'Tar', heather: 'Heather', ochre: 'Ochre', // str
});

const reduced = (G) => Boolean(G.world && G.world.settings && G.world.settings.reducedMotion);
const tapped = (input) => Boolean(input && input.pointer && input.pointer.justDown);

// ---------------------------------------------------------------------------------------------
// Board
// ---------------------------------------------------------------------------------------------

/**
 * @param {any} G
 * @param {{title: string, lines?: string[], sections?: {title: string, lines: string[]}[]}} content
 */
export function createBoardScene(G, content) {
  let ms = 0;
  let closing = -1;
  const sections = content.sections || [{ title: content.title, lines: content.lines || [] }];
  const PLANK = { x: 8, y: 44, w: 464, h: 218 };
  return {
    name: 'board',
    opaque: false,
    enter() { ms = 0; closing = -1; },
    update(dt) {
      ms += dt;
      if (closing >= 0) { closing += dt; if (closing >= 67) G.scenes.pop({ closed: true }); }
    },
    handleInput(input) {
      if (closing >= 0 || ms < 120) return;
      if (input.pressed('confirm') || input.pressed('cancel') || input.pressed('menu') || tapped(input)) closing = 0;
    },
    draw(ctx) {
      drawDim(ctx, 480, 270);
      const k = closing >= 0 ? 1 - Math.min(1, closing / 67) : Math.min(1, ms / 100);
      const dy = reduced(G) ? 0 : Math.round((1 - k) * 12);
      ctx.save();
      ctx.globalAlpha = reduced(G) ? k : 1;
      // the plank
      ctx.fillStyle = '#5A3A22';
      ctx.fillRect(PLANK.x, PLANK.y + dy, PLANK.w, PLANK.h);
      ctx.fillStyle = '#7A5230';
      for (let y = PLANK.y + 6; y < PLANK.y + PLANK.h; y += 22) ctx.fillRect(PLANK.x, y + dy, PLANK.w, 1);
      drawNotchedFrame(ctx, PLANK.x, PLANK.y + dy, PLANK.w, PLANK.h, COLORS.paper.ink);
      drawText(ctx, content.title, PLANK.x + 12, PLANK.y + 6 + dy, { color: PALETTE.porchAmber });
      const n = sections.length;
      const gap = 8;
      const colW = Math.floor((PLANK.w - 24 - gap * (n - 1)) / n);
      sections.forEach((s, i) => {
        const appear = Math.min(1, Math.max(0, (ms - 80 - i * 50) / 83));
        if (appear <= 0) return;
        const x = PLANK.x + 12 + i * (colW + gap);
        const tear = reduced(G) ? 0 : Math.round((1 - appear) * 24);
        const rect = { x: x + tear, y: PLANK.y + 20 + dy, w: colW, h: PLANK.h - 32 };
        const inner = drawPanel(ctx, rect, 'notice');
        let y = inner.y + 2;
        drawText(ctx, s.title, inner.x + 2, y, { color: COLORS.paper.margin });
        y += 13;
        for (const line of s.lines) {
          for (const row of wrapText(line, inner.w - 6)) {
            if (y > rect.y + rect.h - 14) break;
            drawText(ctx, row, inner.x + 2, y, { color: COLORS.paper.ink });
            y += 10;
          }
          y += 3;
        }
      });
      drawText(ctx, 'confirm / cancel: close', PLANK.x + PLANK.w - 8, PLANK.y + PLANK.h - 10 + dy, { align: 'right', font: 'small', color: PALETTE.porchAmber }); // str
      ctx.restore();
    },
    debugText: () => [content.title, ...sections.flatMap((s) => [s.title, ...s.lines])].join('\n'),
    isBusy: () => ms < 300 || closing >= 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Ferry
// ---------------------------------------------------------------------------------------------

/**
 * @param {any} G
 * @param {{stops: Array<{mapId: string, name: string, curve: number|null}>, fare: number, onPick: (stop: any|null) => void}} p
 */
export function createFerryScene(G, p) {
  let ms = 0;
  let index = 0;
  let picked = false;
  const rowH = 15;
  const W = 220;
  const H = 40 + p.stops.length * rowH + 22;
  const box = { x: Math.round((480 - W) / 2), y: Math.max(44, Math.round((270 - H) / 2)), w: W, h: H };
  function close(stop) {
    if (picked) return;
    picked = true;
    G.scenes.pop({ stop });
    p.onPick(stop);
  }
  return {
    name: 'ferryCard',
    opaque: false,
    enter() { ms = 0; index = 0; picked = false; },
    update(dt) { ms += dt; },
    handleInput(input) {
      if (ms < 150 || picked) return;
      if (input.pressed('up')) index = (index + p.stops.length - 1) % p.stops.length;
      if (input.pressed('down')) index = (index + 1) % p.stops.length;
      const ptr = input.pointer;
      if (ptr && ptr.justDown) {
        const i = Math.floor((ptr.y - (box.y + 34)) / rowH);
        if (ptr.x >= box.x && ptr.x < box.x + box.w && i >= 0 && i < p.stops.length) { index = i; close(p.stops[i]); return; }
      }
      if (input.pressed('confirm')) close(p.stops[index]);
      else if (input.pressed('cancel') || input.pressed('menu')) close(null);
    },
    draw(ctx) {
      drawDim(ctx, 480, 270);
      const k = Math.min(1, ms / 100);
      const dy = reduced(G) ? 0 : Math.round((1 - k) * 12);
      const inner = drawPanel(ctx, { ...box, y: box.y + dy }, 'card');
      drawText(ctx, 'Maud\'s ferry', inner.x + 2, inner.y + 2, { color: COLORS.paper.margin }); // str
      drawText(ctx, p.fare > 0 ? t('ferry.fare', { cost: p.fare }) : t('ferry.free'), inner.x + inner.w - 2, inner.y + 2, { align: 'right', color: COLORS.paper.inkSoft, font: 'small' });
      p.stops.forEach((s, i) => {
        const y = box.y + 34 + i * rowH + dy;
        const focused = i === index;
        if (focused) { ctx.fillStyle = COLORS.focus.bandOnPaper; ctx.fillRect(inner.x, y - 2, inner.w, rowH - 1); drawText(ctx, '▶', inner.x + 2, y + 1, { color: COLORS.focus.cursorOnPaper }); }
        drawText(ctx, s.name, inner.x + 12, y + 1, { color: COLORS.paper.ink });
        if (s.curve != null) drawText(ctx, `curve Lv${s.curve}`, inner.x + inner.w - 4, y + 2, { align: 'right', font: 'small', color: COLORS.paper.inkSoft }); // str
      });
      drawText(ctx, 'confirm: choose  cancel: stay ashore', box.x + box.w / 2, box.y + box.h - 14 + dy, { align: 'center', font: 'small', color: COLORS.paper.inkSoft }); // str
    },
    debugText: () => `Maud's ferry\n${p.stops.map((s, i) => `${i === index ? '>' : ' '} ${s.name}`).join('\n')}`,
    isBusy: () => ms < 150,
  };
}

// ---------------------------------------------------------------------------------------------
// Payment ceremony
// ---------------------------------------------------------------------------------------------

/** Frame lengths (ms at 60 fps) of the ceremony beats (GDD-09 §5). */
export const CEREMONY_MS = Object.freeze({
  fadeIn: 400, beadSlow: 133, beadMid: 67, beadFast: 33, lift: 67, gnaw: 100, strike: 83, shake: 33, dust: 200, notch: 100, split: 200, swing: 500,
});

/**
 * Bead timeline: per-bead delays (8 f for the first ten, then 4 f, then 2 f).
 * @param {number} beads
 * @returns {number} total ms the beads take
 */
export function beadTime(beads) {
  let ms = 0;
  for (let i = 0; i < beads; i++) ms += i < 10 ? CEREMONY_MS.beadSlow : i < 20 ? CEREMONY_MS.beadMid : CEREMONY_MS.beadFast;
  return ms;
}

/**
 * @param {any} G
 * The room phase (MID-11): when Wren is waiting on a room pick (`p.rooms`, from
 * `loans.commissionPrompt`), the chalk plan opens after the strike. `roomFirst` puts it before the
 * roof (the cleared loan's build needs a room before it can take a roof colour); otherwise it
 * follows the roof and picks the room for the loan just offered. Back means "later": the plan
 * stays on Wren's board, and the Ledger can still pick it.
 * @param {{ceremony: any, cleared: any, paid: number, tier: number, roofChoices?: string[], onRoof?: (c: string) => void, onDone?: () => void,
 *   rooms?: Array<{id: string, name: string, blurb?: string}>, roomTier?: number, roomFirst?: boolean, onRoom?: (id: string) => any,
 *   roomPrompt?: () => ({tier: number, rooms: Array<{id: string, name: string, blurb?: string}>}|null)}} p
 */
export function createCeremonyScene(G, p) {
  const c = p.ceremony || { beads: 0, notchesBefore: 0, notchesAfter: 0, notchesPerStick: 20, split: false, notchesCut: 0 };
  const beads = Math.min(c.beads || 0, 60);
  const tBeads = beadTime(beads);
  const N = c.notchesPerStick || 20;
  // timeline
  const T0 = CEREMONY_MS.fadeIn;
  const tStrikeStart = T0 + tBeads + CEREMONY_MS.lift + CEREMONY_MS.gnaw;
  const tThwap = tStrikeStart + CEREMONY_MS.strike;
  const tNotch = tThwap + CEREMONY_MS.shake;
  const tSettled = tNotch + CEREMONY_MS.dust + CEREMONY_MS.notch + (c.split ? CEREMONY_MS.split + CEREMONY_MS.swing : 0);
  const roofs = (p.cleared && Array.isArray(p.roofChoices) ? p.roofChoices : []).slice(0, 8);
  let ms = 0;
  let thwapped = false;
  let rooms = (Array.isArray(p.rooms) ? p.rooms : []).slice(0, 6);
  let roomTier = p.roomTier;
  /** the phases after the count, in order (count -> [room] -> [roof] -> [room] -> done -> out) */
  const queue = p.roomFirst && rooms.length
    ? ['room', ...(roofs.length ? ['roof'] : []), 'room']
    : [...(roofs.length ? ['roof'] : []), ...(rooms.length ? ['room'] : [])];
  let phase = 'count';
  let roofIndex = Math.max(0, roofs.indexOf('slate-blue'));
  let roomIndex = 0;
  let pickedRoom = null;
  let roomsShown = 0;
  const advance = () => {
    for (;;) {
      phase = queue.shift() ?? 'done';
      if (phase !== 'room') return;
      // a later plan re-reads what Wren is still waiting on (a pick may have opened the next loan's)
      if (roomsShown > 0) {
        const next = typeof p.roomPrompt === 'function' ? p.roomPrompt() : null;
        if (!next || !next.rooms || !next.rooms.length) continue;
        rooms = next.rooms.slice(0, 6); roomTier = next.tier;
      }
      if (!rooms.length) continue;
      roomsShown += 1; roomIndex = 0;
      return;
    }
  };
  let outMs = -1;
  let skipHold = 0;
  const chips = [];

  function thwap() {
    if (thwapped) return;
    thwapped = true;
    if (G.audio && typeof G.audio.sfx === 'function') G.audio.sfx('thwap', { volume: 1 });
    G.bus.emit('ceremony:thwap', { tier: p.tier, notches: c.notchesCut });
    if (G.fx && typeof G.fx.shake === 'function' && !reduced(G)) G.fx.shake(2, 33);
    for (let i = 0; i < 8; i++) chips.push({ x: 0, y: 0, vx: (i - 3.5) * 0.35, vy: -1.2 - (i % 3) * 0.4, life: 1 });
  }
  function finish() {
    if (outMs >= 0) return;
    outMs = 0;
  }
  return {
    name: 'ceremony',
    opaque: true,
    enter() { ms = 0; },
    update(dt) {
      ms += dt;
      if (!thwapped && ms >= tThwap) thwap();
      for (const ch of chips) { ch.x += ch.vx * dt / 16; ch.y += ch.vy * dt / 16; ch.vy += 0.12 * dt / 16; ch.life -= dt / 400; }
      // beads: a click per bead while counting
      if (phase === 'count' && ms >= T0 && ms < T0 + tBeads && G.audio && typeof G.audio.sfx === 'function') {
        const before = beadIndexAt(ms - dt), now = beadIndexAt(ms);
        if (now > before) G.audio.sfx('blip', { pitch: 1 + Math.min(12, now) * 0.06, volume: 0.4 });
      }
      if (phase === 'count' && ms >= tSettled) advance();
      if (outMs >= 0) {
        outMs += dt;
        if (outMs >= 400) {
          G.scenes.pop({ paid: p.paid });
          if (typeof p.onDone === 'function') p.onDone();
        }
      }
    },
    handleInput(input) {
      if (outMs >= 0) return;
      if (phase === 'count') {
        // hold confirm to skip to the strike
        if (input.held('confirm')) skipHold += 16.7; else skipHold = 0;
        if (skipHold > 250 && ms < tStrikeStart) ms = tStrikeStart;
        if (ms > tSettled - 1 && (input.pressed('confirm') || tapped(input))) advance();
        return;
      }
      if (phase === 'room') {
        const n = rooms.length;
        if (input.pressed('left') || input.pressed('up')) roomIndex = (roomIndex + n - 1) % n;
        if (input.pressed('right') || input.pressed('down')) roomIndex = (roomIndex + 1) % n;
        const pt = input.pointer;
        if (pt && pt.justDown) {
          const hit = rooms.findIndex((_, i) => { const r = roomRect(i); return pt.x >= r.x && pt.x < r.x + r.w && pt.y >= r.y && pt.y < r.y + r.h; });
          if (hit >= 0 && hit !== roomIndex && pt.type === 'touch') { roomIndex = hit; return; }
          if (hit >= 0) roomIndex = hit; else return;
        }
        if (input.pressed('confirm') || (pt && pt.justDown)) {
          const res = typeof p.onRoom === 'function' ? p.onRoom(rooms[roomIndex].id) : { ok: true };
          if (res && res.ok === false) { phase = 'done'; return; }
          pickedRoom = rooms[roomIndex];
          if (G.audio && typeof G.audio.sfx === 'function') G.audio.sfx('ui:confirm');
          advance();
          return;
        }
        if (input.pressed('cancel')) {
          // later: a room-first plan without a room has no build for a roof yet
          if (p.roomFirst) queue.length = 0;
          advance();
        }
        return;
      }
      if (phase === 'roof') {
        if (input.pressed('left')) roofIndex = (roofIndex + roofs.length - 1) % roofs.length;
        if (input.pressed('right')) roofIndex = (roofIndex + 1) % roofs.length;
        if (input.pressed('confirm') || tapped(input)) {
          if (typeof p.onRoof === 'function') p.onRoof(roofs[roofIndex]);
          advance();
        }
        return;
      }
      if (input.pressed('confirm') || input.pressed('cancel') || tapped(input)) finish();
    },
    draw(ctx) {
      // the yard at dusk
      ctx.fillStyle = '#2B3A67'; ctx.fillRect(0, 0, 480, 270);
      ctx.fillStyle = '#4A3B5E'; ctx.fillRect(0, 60, 480, 40);
      ctx.fillStyle = '#C46A4A'; ctx.fillRect(0, 96, 480, 8);
      ctx.fillStyle = '#3B2A1E'; ctx.fillRect(0, 104, 480, 166);
      ctx.fillStyle = '#4C3826'; for (let y = 110; y < 270; y += 12) ctx.fillRect(0, y, 480, 1);
      const shake = thwapped && ms - tThwap < CEREMONY_MS.shake * 2 && !reduced(G) ? 2 : 0;
      ctx.save();
      ctx.translate(shake ? ((ms >> 4) & 1 ? shake : -shake) : 0, 0);
      // abacus 120,36,240,40
      const ab = { x: 120, y: 36, w: 240, h: 44 };
      ctx.fillStyle = '#6B4423'; ctx.fillRect(ab.x, ab.y, ab.w, ab.h);
      ctx.fillStyle = '#8A5A30'; ctx.fillRect(ab.x + 3, ab.y + 3, ab.w - 6, ab.h - 6);
      const flicked = phase === 'count' ? beadIndexAt(ms) : beads;
      for (let wire = 0; wire < 3; wire++) {
        const wy = ab.y + 10 + wire * 12;
        ctx.fillStyle = '#D9A441'; ctx.fillRect(ab.x + 6, wy, ab.w - 12, 1);
        for (let b = 0; b < 10; b++) {
          const idx = wire * 10 + b;
          const moved = idx < Math.min(flicked, 30) || (beads > 30 && flicked >= beads && wire === 2);
          const bx = moved ? ab.x + 10 + b * 7 : ab.x + ab.w - 80 + b * 7;
          ctx.fillStyle = moved ? '#F9C46B' : '#A8323A';
          ctx.fillRect(bx, wy - 3, 6, 7);
          ctx.fillStyle = '#141B33'; ctx.fillRect(bx, wy + 3, 6, 1);
        }
      }
      drawText(ctx, t('ceremony.beads', { n: Math.min(flicked, beads) }), ab.x + ab.w / 2, ab.y + ab.h + 4, { align: 'center', color: PALETTE.porchAmber });
      // Ambrose on the sawhorse, 40,120 48x48
      const am = portraitSprite('ambrose');
      const lift = phase === 'count' && ms > T0 + tBeads && ms < tStrikeStart ? -3 : 0;
      const gnaw = ms > T0 + tBeads + CEREMONY_MS.lift && ms < tStrikeStart ? ((ms >> 5) & 1) : 0;
      ctx.fillStyle = '#5A3A22'; ctx.fillRect(34, 166, 60, 6); ctx.fillRect(40, 172, 4, 20); ctx.fillRect(84, 172, 4, 20);
      if (am) drawSprite(ctx, am, 40, 118 + lift + gnaw);
      // the stick 140,150,200,14 with twenty notches
      const st = { x: 140, y: 150, w: 200, h: 14 };
      const splitK = c.split && ms > tNotch + CEREMONY_MS.dust ? Math.min(1, (ms - tNotch - CEREMONY_MS.dust) / CEREMONY_MS.split) : 0;
      const notches = ms >= tNotch ? (c.notchesAfter ?? 0) : (c.notchesBefore ?? 0);
      drawStick(ctx, st, notches, N, splitK);
      // chips and dust
      if (thwapped) {
        for (const ch of chips) if (ch.life > 0) { ctx.fillStyle = '#E8C9A0'; ctx.fillRect(Math.round(st.x + st.w * (notches / N) + ch.x * 6), Math.round(st.y + ch.y * 6), 2, 2); }
        const dk = (ms - tThwap) / CEREMONY_MS.dust;
        if (dk >= 0 && dk < 1 && !reduced(G)) { ctx.fillStyle = 'rgba(232,201,160,0.5)'; ctx.fillRect(st.x + st.w * (notches / N) - 8 - dk * 6, st.y - 6 - dk * 4, 16 + dk * 12, 6); }
        if (ms - tThwap < 600) drawText(ctx, t('ceremony.thwap'), st.x + st.w / 2, st.y - 26, { align: 'center', color: '#FFB547', scale: 2 });
      }
      ctx.restore();
      // Wren's bust at 392,150
      const wr = portraitSprite('wren');
      if (wr) drawSprite(ctx, wr, 392, 150);
      // captions
      if (phase === 'count' && ms < tStrikeStart) drawText(ctx, t('ceremony.holdSkip'), 240, 252, { align: 'center', font: 'small', color: COLORS.paper.light });
      if (c.split && ms > tNotch + CEREMONY_MS.dust) drawText(ctx, t('ceremony.split'), 240, 180, { align: 'center', color: COLORS.paper.light });
      if (phase === 'roof') {
        drawText(ctx, t('ceremony.pickRoof'), 240, 200, { align: 'center', color: PALETTE.porchAmber });
        const x0 = 128;
        roofs.forEach((r, i) => {
          const x = x0 + i * 28, y = 214;
          const art = resolveArtId(`roof-${ROOF_ART[r] || 'slate'}-body`);
          if (art) ctx.drawImage(getTile(art, 0, null).canvas, x + 4, y + 4, 16, 16);
          drawNotchedFrame(ctx, x, y, 24, 24, i === roofIndex ? COLORS.paper.light : COLORS.paper.ink);
          if (i === roofIndex) drawText(ctx, '▲', x + 12, y + 26, { align: 'center', color: COLORS.paper.light });
        });
        drawText(ctx, ROOF_NAMES[roofs[roofIndex]] || roofs[roofIndex], 240, 256, { align: 'center', color: COLORS.paper.light });
      } else if (phase === 'room') {
        drawText(ctx, t('ceremony.pickRoom', { n: roomTier ?? '' }), 240, 192, { align: 'center', color: PALETTE.porchAmber });
        rooms.forEach((r, i) => {
          const R = roomRect(i);
          ctx.fillStyle = i === roomIndex ? '#3E5A4A' : '#2A3B33'; ctx.fillRect(R.x, R.y, R.w, R.h);
          drawNotchedFrame(ctx, R.x, R.y, R.w, R.h, i === roomIndex ? COLORS.paper.light : COLORS.paper.ink);
          drawText(ctx, r.name, R.x + R.w / 2, R.y + 3, { align: 'center', color: i === roomIndex ? COLORS.paper.light : COLORS.paper.shade, font: 'small' });
        });
        const blurb = rooms[roomIndex] && rooms[roomIndex].blurb ? wrapText(rooms[roomIndex].blurb, 400)[0] ?? '' : '';
        if (blurb) drawText(ctx, blurb, 240, 240, { align: 'center', font: 'small', color: COLORS.paper.light });
        drawText(ctx, t('ceremony.roomLater'), 240, 254, { align: 'center', font: 'small', color: PALETTE.porchAmber });
      } else if (phase === 'done') {
        if (pickedRoom) drawText(ctx, t('ceremony.roomChosen', { room: pickedRoom.name }), 240, 200, { align: 'center', color: PALETTE.porchAmber });
        drawText(ctx, p.cleared ? t('ceremony.buildTonight') : `Paid ${Number(p.paid || 0).toLocaleString('en-US')}◉. ${c.notchesCut || 0} notch${c.notchesCut === 1 ? '' : 'es'} cut.`, 240, 214, { align: 'center', color: COLORS.paper.light }); // str
        drawText(ctx, 'confirm: back to the yard', 240, 252, { align: 'center', font: 'small', color: PALETTE.porchAmber }); // str
      }
      // fades
      const fin = Math.min(1, ms / T0);
      const fout = outMs >= 0 ? Math.min(1, outMs / 400) : 0;
      const cover = Math.max(1 - fin, fout);
      if (cover > 0) { ctx.save(); ctx.globalAlpha = cover; ctx.fillStyle = '#141B33'; ctx.fillRect(0, 0, 480, 270); ctx.restore(); }
    },
    debugText: () => `ceremony ${phase} beads ${beads} thwap ${thwapped}${phase === 'room' ? ` room ${rooms[roomIndex]?.id}` : ''}`,
    get phase() { return phase; },
    isBusy: () => phase === 'count' || outMs >= 0,
  };

  /** Chalk-plan cells: three across, two rows, under the stick. */
  function roomRect(i) { return { x: 72 + (i % 3) * 114, y: 204 + Math.floor(i / 3) * 16, w: 108, h: 13 }; }

  function beadIndexAt(m) {
    if (m < T0) return 0;
    let acc = T0;
    for (let i = 0; i < beads; i++) {
      acc += i < 10 ? CEREMONY_MS.beadSlow : i < 20 ? CEREMONY_MS.beadMid : CEREMONY_MS.beadFast;
      if (m < acc) return i;
    }
    return beads;
  }
}

/** The tally stick with `cut` of `n` notches; `split` 0..1 opens it in two halves. */
function drawStick(ctx, r, cut, n, split) {
  const gap = Math.round(split * 10);
  const halves = split > 0 ? [[r.y - gap, 0, Math.floor(r.h / 2)], [r.y + Math.floor(r.h / 2) + gap, Math.floor(r.h / 2), r.h - Math.floor(r.h / 2)]] : [[r.y, 0, r.h]];
  for (const [y, , h] of halves) {
    ctx.fillStyle = '#C9A77C'; ctx.fillRect(r.x, y, r.w, h);
    ctx.fillStyle = '#8A6A44'; ctx.fillRect(r.x, y + h - 1, r.w, 1);
  }
  for (let i = 0; i < n; i++) {
    const x = r.x + 4 + Math.round(i * (r.w - 8) / (n - 1));
    ctx.fillStyle = i < cut ? '#141B33' : '#A88A60';
    ctx.fillRect(x, r.y + (split > 0 ? -gap : 0), 1, i < cut ? r.h : 3);
  }
  drawNotchedFrame(ctx, r.x, r.y, r.w, r.h, '#5A3A22');
}
