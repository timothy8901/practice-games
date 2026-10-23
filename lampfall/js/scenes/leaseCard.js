/**
 * Lease Card. [SCN-FLOW] — GDD-00 §3 and §13, GDD-09 §3.3 and §3.27.
 *
 * A ledger card held out on a string. Left, the fields on ledger rules: Species (water vole, pine
 * marten, red panda (default), opossum, ferret, mongoose: head / ears / tail swaps on one 16×24
 * rig), Fur (8 palettes per species), Markings (mask, socks, stripe, freckles, blaze), Eyes (3
 * shapes), Blush, Outfit (the lighthouse-stripe jumper; the co-op apron goes on during errands),
 * Pronouns (a separate field), Name (default Sorrel) and Town (default Pellwick) with the shared
 * controller-first entry grid and a confirm, the blackout Wake point, then Wren's two bits of small
 * talk, which set only the windowsill plant and tomorrow's weather, and she says so. Right, the
 * rig at ×3 walking on a turntable (`l` / `r` turn it), and Wren's bust with her line. Along the
 * bottom, Your Signal: six notes on six pentatonic chimes (D E F# A B D) played through
 * `core/audio`, with Play it back and Start over. Sign the card flips it and builds the world
 * (`boot.newGame` -> `state/schema.createNewWorld`), replacing into the overworld with the arrival
 * pending.
 *
 * Stray-key safety: `cancel` (X / Esc / Backspace / B) steps back one field and never discards the
 * card; on the first field it asks before leaving (Stay first). In the entry grid Backspace only
 * deletes letters, and backing out of an entry restores the name it opened with.
 *
 * `params.mirror` (the cottage mirror from loan 2): Town is locked and Sign writes the look back to
 * the current world instead of starting a run.
 * @module scenes/leaseCard
 */
import { drawText, measureText } from '../core/font.js';
import { t } from '../data/strings.js';
import { COLORS, PALETTE, TIMING } from '../ui/theme.js';
import { drawPanel } from '../ui/panel.js';
import { openConfirm } from '../ui/confirm.js';
import { PLAYER_SPECIES, FUR_PALETTES, EYE_SHAPES, DEFAULT_CARD } from '../art/chars/player.js';
import { playerSprite, registerPlayerArt, walkStep } from '../art/chars/index.js';
import { portraitSprite } from '../art/portraits.js';
import { drawSprite } from '../core/pixelart.js';
import { setFlag } from '../systems/flags.js';
import { createNameEntry } from './nameEntry.js';
import { newGame } from './boot.js';
import { drawDialPips, drawChallengeSeal } from './seedCard.js';
import { CHALLENGES } from '../data/dials.js';
import {
  drawWaxButton, drawCursor, inRect, flowFade, hintFor, playChime, playSignal, CHIME_NOTES, DEFAULT_SIGNAL,
  LEASE_FLAGS, marksToMask, cardFromWorld, townNameOf, signalOfWorld,
} from './flowKit.js';

/** Markings choices, one step each (singles, then the common pairs). */
export const MARKING_SETS = Object.freeze([
  [], ['mask'], ['socks'], ['stripe'], ['freckles'], ['blaze'],
  ['mask', 'socks'], ['stripe', 'socks'], ['freckles', 'socks'], ['blaze', 'socks'], ['mask', 'freckles'], ['stripe', 'freckles'],
].map((s) => Object.freeze(s)));

/** Wren's small talk: favourite hour -> windowsill plant. */
export const HOURS = Object.freeze([
  Object.freeze({ id: 'dawn', label: 'Dawn', plant: 'marigold', plantName: 'a marigold' }), // str
  Object.freeze({ id: 'dusk', label: 'Dusk', plant: 'evening-primrose', plantName: 'an evening primrose' }), // str
  Object.freeze({ id: 'night', label: 'Middle of the night', plant: 'moonflower', plantName: 'a moonflower' }), // str
]);

/** Wren's small talk: rain or sun -> tomorrow's weather. */
export const SKIES = Object.freeze([
  Object.freeze({ id: 'sun', label: 'Sun on the step', weather: 'clear', said: 'sun' }), // str
  Object.freeze({ id: 'rain', label: 'Rain on the roof', weather: 'rain', said: 'rain' }), // str
  Object.freeze({ id: 'fog', label: 'Sea fog', weather: 'fog', said: 'fog' }), // str
]);

const PRONOUNS = Object.freeze(['they', 'she', 'he']);
const WAKES = Object.freeze(['porch', 'waystone']);
const CAMEL = Object.freeze({ 'water-vole': 'waterVole', 'pine-marten': 'pineMarten', 'red-panda': 'redPanda', opossum: 'opossum', ferret: 'ferret', mongoose: 'mongoose' });
const FACINGS = Object.freeze(['down', 'left', 'up', 'right']);

/** Field rows in order. */
export const FIELDS = Object.freeze(['species', 'fur', 'markings', 'eyes', 'blush', 'outfit', 'pronouns', 'name', 'town', 'wake', 'hour', 'sky']);
const ROW_SIGNAL = FIELDS.length;
const ROW_SIGN = FIELDS.length + 1;

/** Geometry. */
const CARD = Object.freeze({ x: 8, y: 8, w: 464, h: 254 });
const ROW_Y = 34;
const ROW_H = 13;
const LABEL_X = 24;
const VALUE_R = 238;
const PREVIEW = Object.freeze({ x: 280, y: 40, w: 96, h: 120 });
const WREN = Object.freeze({ x: 412, y: 150, w: 48, h: 48 });
const SPEECH = Object.freeze({ x: 382, y: 36, w: 86, h: 108 });
const CHIME_X = 104;
const CHIME_Y = 202;
const playRect = Object.freeze({ x: 350, y: 202, w: 108, h: 16 });
const resetRect = Object.freeze({ x: 350, y: 222, w: 108, h: 16 });
const signRect = Object.freeze({ x: 380, y: 242, w: 84, h: 16 });
const chimeRect = (i) => ({ x: CHIME_X + i * 40, y: CHIME_Y, w: 24, h: 36 });
const rowRect = (i) => ({ x: 16, y: ROW_Y + i * ROW_H - 2, w: 228, h: ROW_H });

/**
 * A fresh set of lease answers (GDD-00 §3 defaults).
 * @returns {object}
 */
export function defaultAnswers() {
  return {
    species: DEFAULT_CARD.species, fur: 0, marks: 0, eyes: 'round', blush: false,
    pronouns: 'they', name: t('lease.name.default'), town: t('lease.town.default'), wake: 'porch',
    hour: 1, sky: 0, signal: DEFAULT_SIGNAL.slice(),
  };
}

/**
 * The art card for a set of answers (pure).
 * @param {object} a
 */
export function cardOf(a) {
  return { species: a.species, fur: a.fur, markings: MARKING_SETS[a.marks].slice(), eyes: a.eyes, blush: a.blush, outfit: 'jumper' };
}

/**
 * `boot.newGame` lease answers from the card's answers (pure).
 * @param {object} a
 */
export function leaseOf(a) {
  return {
    name: a.name, species: a.species, pronouns: a.pronouns, fur: a.fur, markings: MARKING_SETS[a.marks].slice(),
    eyes: a.eyes, blush: a.blush, town: a.town, signal: a.signal.slice(), wake: a.wake,
    plant: HOURS[a.hour].plant, weather: SKIES[a.sky].weather,
  };
}

/**
 * The value text of a field (pure).
 * @param {string} f
 * @param {object} a
 */
export function valueText(f, a) {
  switch (f) {
    case 'species': return t(`lease.species.${CAMEL[a.species]}`);
    case 'fur': return `${FUR_PALETTES[a.species][a.fur].name}  ${a.fur + 1}/8`;
    case 'markings': return MARKING_SETS[a.marks].length ? MARKING_SETS[a.marks].map((m) => t(`lease.markings.${m}`)).join(' + ') : t('lease.markings.none');
    case 'eyes': return t(`lease.eyes.${a.eyes}`);
    case 'blush': return a.blush ? t('common.on') : t('common.off');
    case 'outfit': return 'Stripe jumper'; // str (lease.outfit.jumper is too long for the row)
    case 'pronouns': return t(`lease.pronouns.${a.pronouns}`);
    case 'name': return a.name;
    case 'town': return a.town;
    case 'wake': return a.wake === 'waystone' ? t('lease.wake.waystone') : t('lease.wake.porch');
    case 'hour': return HOURS[a.hour].label;
    case 'sky': return SKIES[a.sky].label;
    default: return '';
  }
}

/** Row labels (Wren's two rows read as her questions). */
function labelOf(f) {
  if (f === 'hour') return 'Favourite hour?'; // str
  if (f === 'sky') return 'Tomorrow?'; // str
  return t(`lease.field.${f}`);
}

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string, answers: () => object}}
 */
export function createLeaseCardScene(G) {
  let a = defaultAnswers();
  let params = {};
  let mirror = false;
  let ms = 0;
  let row = 0;
  let col = 2;         // signal row: 0..5 chimes, 6 play, 7 reset
  let facing = 0;
  let turnMs = 0;
  let nodMs = 0;
  let line = '';
  let lineMs = 0;
  let entry = null;
  let entryField = null;
  let entryWas = '';
  let busy = false;    // a confirm is open
  let leaving = false;
  let flipMs = -1;     // the sign flip
  let back = false;    // the card turned over
  let writeAt = 0;     // next Signal note to write
  const swing = [0, 0, 0, 0, 0, 0];
  const hover = { x: NaN, y: NaN };
  let blinkAt = 3000;
  let blinkMs = 0;

  function sfx(kind) { try { G.bus?.emit?.(`ui:${kind}`, {}); } catch { /* never break the card */ } }

  function say(text) { line = text; lineMs = 0; nodMs = 100; }

  const wrenLines = {
    species: (v) => ({
      'water-vole': 'A vole. You\'ll like the riverbank.', // str
      'pine-marten': 'A marten. Good on ladders. We\'ve a lot of ladders.', // str
      'red-panda': 'Red panda. Warm in a wind. You\'ll want that.', // str
      opossum: 'Opossum. Nothing surprises you, I expect.', // str
      ferret: 'Ferret. Quick. Mind the eel pots.', // str
      mongoose: 'Mongoose. Brave sort. The bees will test that.', // str
    })[v],
    fur: () => 'I\'ll write the colour in pencil. It\'s yours to change.', // str
    markings: () => 'Every one of those I\'d know across the green.', // str
    eyes: () => 'Noted.', // str
    blush: () => 'There. You look like you walked here.', // str
    outfit: () => 'Lighthouse stripes. Co-op apron when you run errands. Both on the house.', // str
    pronouns: () => 'Separate box. Same as everyone.', // str
    name: (v) => `${v}. I'll put it on the door.`, // str
    town: (v) => `${v}. Letters and signs will say it.`, // str
    wake: () => 'If you ever come home carried, that\'s where you\'ll wake.', // str
    hour: () => `That one decides the plant on your windowsill: ${HOURS[a.hour].plantName}. Nothing else.`, // str
    sky: () => `That one decides tomorrow: ${SKIES[a.sky].said}. Nothing else. I'd want to know.`, // str
  };

  function changed(f) {
    const fn = wrenLines[f];
    say(fn ? fn(f === 'species' ? a.species : f === 'name' ? a.name : f === 'town' ? a.town : null) : '');
    sfx('cursor');
  }

  function cycle(f, d) {
    const wrap = (i, n) => (i + d + n) % n;
    switch (f) {
      case 'species': a.species = PLAYER_SPECIES[wrap(PLAYER_SPECIES.indexOf(a.species), PLAYER_SPECIES.length)]; a.fur = Math.min(a.fur, 7); break;
      case 'fur': a.fur = wrap(a.fur, 8); break;
      case 'markings': a.marks = wrap(a.marks, MARKING_SETS.length); break;
      case 'eyes': a.eyes = EYE_SHAPES[wrap(EYE_SHAPES.indexOf(a.eyes), EYE_SHAPES.length)]; break;
      case 'blush': a.blush = !a.blush; break;
      case 'pronouns': a.pronouns = PRONOUNS[wrap(PRONOUNS.indexOf(a.pronouns), PRONOUNS.length)]; break;
      case 'wake': a.wake = WAKES[wrap(WAKES.indexOf(a.wake), WAKES.length)]; break;
      case 'hour': a.hour = wrap(a.hour, HOURS.length); break;
      case 'sky': a.sky = wrap(a.sky, SKIES.length); break;
      case 'outfit': say(wrenLines.outfit()); sfx('blocked'); return;
      case 'name': case 'town': openEntry(f); return;
      default: return;
    }
    changed(f);
  }

  function openEntry(f) {
    if (f === 'town' && mirror) { say(t('lease.mirror')); sfx('blocked'); return; }
    entryField = f;
    entryWas = a[f];
    entry = createNameEntry({
      input: G.input,
      prompt: f === 'name' ? 'Your name, for the card and the door.' : 'The town, for letters and signs.', // str
      initial: a[f],
      suggest: f === 'name' ? t('lease.name.default') : t('lease.town.default'),
      maxLen: f === 'name' ? 10 : 12,
      sfx: (evt) => { try { G.bus?.emit?.(evt, {}); } catch { /* audio is optional */ } },
      onDone: (text) => {
        closeEntry();
        busy = true;
        openConfirm(G, {
          body: f === 'name' ? `Sign the card as ${text}?` : `The town is called ${text}?`, // str
          options: [f === 'name' ? 'That\'s me' : 'That\'s it', 'Change it'], // str
          defaultIndex: 0,
        }).then((i) => {
          busy = false;
          if (i === 0) { a[f] = text; changed(f); } else { openEntry(f); }
        });
      },
      onCancel: () => { a[f] = entryWas; closeEntry(); sfx('cancel'); },
    });
    entry.attach();
  }
  function closeEntry() { if (entry) entry.detach(); entry = null; entryField = null; }

  function pressChime(i) {
    playChime(G, i);
    swing[i] = 600;
    a.signal[writeAt] = i;
    writeAt = (writeAt + 1) % 6;
    if (writeAt === 0) { say('That\'s your Signal. The door will chime it.'); setTimeout(() => playSignal(G, a.signal, { gapMs: 260 }), 450); } // str
  }

  function playBack() {
    const total = playSignal(G, a.signal, { gapMs: 280 });
    a.signal.forEach((n, k) => setTimeout(() => { swing[n] = 600; }, k * 280));
    say('Six notes. Dimity will hum it, I expect.'); // str
    sfx('confirm');
    void total;
  }

  function resetSignal() {
    a.signal = DEFAULT_SIGNAL.slice();
    writeAt = 0;
    say('Back to the chime it came with. Play over it.'); // str
    sfx('cancel');
  }

  function sign() {
    if (leaving) return;
    if (!a.name.trim()) { row = FIELDS.indexOf('name'); say(t('entry.empty')); sfx('blocked'); return; }
    leaving = true;
    flipMs = 0;
    sfx('confirm');
    try { G.audio?.sfx?.('stamp', { volume: 0.8 }); } catch { /* optional */ }
    playSignal(G, a.signal, { gapMs: 200, volume: 0.5 });
  }

  function finishSign() {
    try { registerPlayerArt(cardOf(a)); } catch { /* the default look stays */ }
    if (mirror) {
      G.store.tx('lease:mirror', (w) => {
        w.player.species = a.species;
        w.player.pronouns = a.pronouns;
        w.player.name = a.name;
        w.player.look = { ...w.player.look, fur: a.fur, marks: marksToMask(MARKING_SETS[a.marks]) };
        setFlag(w, LEASE_FLAGS.eyes, a.eyes, { bus: G.bus });
        setFlag(w, LEASE_FLAGS.blush, a.blush, { bus: G.bus });
        setFlag(w, LEASE_FLAGS.signal, a.signal.join(','), { bus: G.bus });
        setFlag(w, LEASE_FLAGS.wake, a.wake, { bus: G.bus });
      });
      if (G.scenes.size > 1) G.scenes.pop({ lease: leaseOf(a) }); else G.replaceWith('overworld', {});
      return;
    }
    newGame(G, { seedCode: params.seedCode ?? G.world.run.seedCode, dial: params.dial, challenges: params.challenges ?? [], lease: leaseOf(a) });
  }

  function cancel() {
    if (back) { back = false; sfx('cancel'); return; }
    if (row > 0) { row -= 1; sfx('cancel'); return; }
    busy = true;
    openConfirm(G, {
      body: mirror ? 'Put the card down? Nothing changes.' : 'Back to the Seed Card? These answers won\'t be kept.', // str
      options: ['Stay', mirror ? 'Put it down' : 'Go back'], // str
      defaultIndex: 0,
    }).then((i) => {
      busy = false;
      if (i !== 1) return;
      leaving = true;
      if (mirror) { if (G.scenes.size > 1) G.scenes.pop(null); return; }
      G.scenes.transition('fade', flowFade(G), () => G.replaceWith('seedCard', { seedCode: params.seedCode, dial: params.dial, challenges: params.challenges }), { color: PALETTE.nightInk });
    });
  }

  function moveRow(d) {
    const next = Math.max(0, Math.min(ROW_SIGN, row + d));
    if (next !== row) { row = next; sfx('cursor'); }
  }

  function turn(d) { facing = (facing + d + 4) % 4; turnMs = 133; sfx('cursor'); }

  function activate() {
    if (row < FIELDS.length) {
      const f = FIELDS[row];
      if (f === 'name' || f === 'town') openEntry(f); else cycle(f, 1);
      return;
    }
    if (row === ROW_SIGNAL) {
      if (col < 6) pressChime(col); else if (col === 6) playBack(); else resetSignal();
      return;
    }
    sign();
  }

  function handleInput(input) {
    const p = input.pointer;
    // hover (mouse only, when it moved)
    if (p && p.inside && p.type !== 'touch' && (hover.x !== p.x || hover.y !== p.y)) {
      hover.x = p.x; hover.y = p.y;
      for (let i = 0; i < FIELDS.length; i++) if (inRect(p, rowRect(i)) && row !== i) { row = i; sfx('cursor'); }
    }
    if (p && p.justDown) {
      const touch = p.type === 'touch';
      for (let i = 0; i < FIELDS.length; i++) {
        const r = rowRect(i);
        if (!inRect(p, r)) continue;
        const f = FIELDS[i];
        const same = row === i;
        row = i;
        if (touch && !same) { sfx('cursor'); return; }
        if (f === 'name' || f === 'town') openEntry(f);
        else cycle(f, p.x < r.x + r.w / 2 && p.x > r.x + 120 ? -1 : 1);
        return;
      }
      for (let i = 0; i < 6; i++) if (inRect(p, chimeRect(i))) { row = ROW_SIGNAL; col = i; pressChime(i); return; }
      if (inRect(p, playRect)) { row = ROW_SIGNAL; col = 6; playBack(); return; }
      if (inRect(p, resetRect)) { row = ROW_SIGNAL; col = 7; resetSignal(); return; }
      if (inRect(p, signRect)) { const same = row === ROW_SIGN; row = ROW_SIGN; if (!touch || same) sign(); else sfx('cursor'); return; }
      if (inRect(p, PREVIEW)) { turn(1); return; }
    }
    if (input.pressed('l')) turn(-1);
    if (input.pressed('r')) turn(1);
    const rep = (k) => input.repeat(k, { delay: TIMING.repeatDelayMs, rate: TIMING.repeatRateMs });
    if (rep('up')) moveRow(-1);
    else if (rep('down')) moveRow(1);
    else if (rep('left') || rep('right')) {
      const d = input.held('left') ? -1 : 1;
      if (row < FIELDS.length) cycle(FIELDS[row], d);
      else if (row === ROW_SIGNAL) { col = Math.max(0, Math.min(7, col + d)); sfx('cursor'); }
      else { back = !back; sfx('cursor'); }
    }
    if (input.pressed('confirm')) { if (back) { back = false; sfx('cancel'); } else activate(); }
    else if (input.pressed('start')) { row = ROW_SIGN; sign(); }
    else if (input.pressed('cancel')) cancel();
  }

  // ---- drawing -----------------------------------------------------------------------------

  function drawRows(ctx) {
    FIELDS.forEach((f, i) => {
      const y = ROW_Y + i * ROW_H;
      const focused = row === i;
      if (focused) { ctx.fillStyle = COLORS.focus.bandOnPaper; ctx.fillRect(18, y - 2, 222, ROW_H - 1); }
      if (f === 'hour') { ctx.fillStyle = COLORS.paper.rule; for (let x = 22; x < 238; x += 3) ctx.fillRect(x, y - 3, 1, 1); }
      const wrenRow = f === 'hour' || f === 'sky';
      drawText(ctx, labelOf(f), LABEL_X, y, { color: wrenRow ? COLORS.paper.inkSoft : COLORS.paper.ink });
      const v = valueText(f, a);
      const locked = f === 'outfit' || (f === 'town' && mirror);
      const vw = measureText(v).w;
      const vx = VALUE_R - (focused && !locked ? 8 : 0);
      drawText(ctx, v, vx, y, { color: locked ? COLORS.paper.inkSoft : PALETTE.deepBlue, align: 'right' });
      if (focused && !locked && f !== 'name' && f !== 'town') {
        drawText(ctx, '◀', vx - vw - 9, y, { color: COLORS.wax.fill });
        drawText(ctx, '▶', VALUE_R - 5, y, { color: COLORS.wax.fill });
      } else if (focused && (f === 'name' || f === 'town') && !locked) {
        drawText(ctx, '…', VALUE_R - 5, y, { color: COLORS.wax.fill });
      }
      if (f === 'fur') {
        const fp = FUR_PALETTES[a.species][a.fur];
        const sx = 96;
        [fp.F, fp.L, fp.M, fp.S].forEach((c, k) => { ctx.fillStyle = c; ctx.fillRect(sx + k * 7, y, 6, 7); });
        ctx.fillStyle = COLORS.paper.edge; ctx.fillRect(sx - 1, y + 7, 28, 1);
      }
      if (focused) drawCursor(ctx, 22, y, ms);
    });
  }

  function drawPreview(ctx) {
    const cx = PREVIEW.x + PREVIEW.w / 2;
    // turntable: an elliptical plinth
    ctx.fillStyle = COLORS.paper.deep;
    ctx.beginPath(); ctx.ellipse(cx, PREVIEW.y + 106, 34, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.paper.shade;
    ctx.beginPath(); ctx.ellipse(cx, PREVIEW.y + 104, 34, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.paper.rule;
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2 + facing * (Math.PI / 2) + (turnMs > 0 ? (1 - turnMs / 133) * 0.3 : 0);
      ctx.fillRect(Math.round(cx + Math.cos(ang) * 30), Math.round(PREVIEW.y + 104 + Math.sin(ang) * 6), 2, 1);
    }
    let spr = null;
    try { spr = playerSprite(cardOf(a), FACINGS[facing], walkStep(ms, 125), { scale: 3 }); } catch { spr = null; }
    if (spr) {
      const bob = 0;
      const x = Math.round(cx - spr.w / 2), y = PREVIEW.y + 108 - spr.h + bob;
      ctx.globalAlpha = 0.25; ctx.fillStyle = PALETTE.nightInk;
      ctx.beginPath(); ctx.ellipse(cx, PREVIEW.y + 105, 14, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      drawSprite(ctx, spr, x, y);
    }
    drawText(ctx, a.name, cx, PREVIEW.y + 116, { color: COLORS.paper.ink, align: 'center' });
    drawText(ctx, `${t(`lease.pronouns.${a.pronouns}`)}, ${a.town}`, cx, PREVIEW.y + 127, { color: COLORS.paper.inkSoft, align: 'center', font: 'small' });
    drawText(ctx, '[ ] turn', cx, PREVIEW.y - 2, { color: COLORS.paper.inkFaint, align: 'center', font: 'small' }); // str
  }

  function drawWren(ctx) {
    const nod = nodMs > 0 ? 1 : 0;
    let bust = null;
    try { bust = portraitSprite('wren', line && lineMs < 1400 ? 'happy' : 'neutral'); } catch { bust = null; }
    ctx.fillStyle = COLORS.paper.edge; ctx.fillRect(WREN.x - 2, WREN.y - 2, WREN.w + 4, WREN.h + 4);
    if (bust) drawSprite(ctx, bust, WREN.x, WREN.y + nod);
    // a blink: two lid lines across the eye band for 120 ms every 3-5 s
    if (blinkMs > 0 && bust) { ctx.fillStyle = '#5A3A26'; ctx.fillRect(WREN.x + 15, WREN.y + 19 + nod, 6, 1); ctx.fillRect(WREN.x + 27, WREN.y + 19 + nod, 6, 1); }
    drawText(ctx, 'Wren', WREN.x + WREN.w / 2, WREN.y + WREN.h + 3, { color: COLORS.paper.inkSoft, align: 'center', font: 'small' }); // str
    // her line in a slip above
    drawPanel(ctx, SPEECH, 'paper');
    const text = line || 'You can change any of it later. I don\'t like hidden boxes.'; // str
    const shown = Math.min(text.length, Math.floor(lineMs / 22));
    drawText(ctx, text.slice(0, line ? shown : text.length), SPEECH.x + 5, SPEECH.y + 5, { color: COLORS.paper.ink, font: 'small', maxWidth: SPEECH.w - 10, lineSpacing: 1 });
    // the tail toward Wren
    ctx.fillStyle = COLORS.paper.light;
    ctx.fillRect(SPEECH.x + 56, SPEECH.y + SPEECH.h, 6, 2); ctx.fillRect(SPEECH.x + 58, SPEECH.y + SPEECH.h + 2, 3, 2);
  }

  function drawSignal(ctx) {
    const focusedRow = row === ROW_SIGNAL;
    drawText(ctx, t('lease.field.signal'), 18, CHIME_Y, { color: COLORS.paper.ink });
    drawText(ctx, 'Six notes on six chimes. Your door chime, Dimity\'s hum, the ferry horn\'s answer.', 18, CHIME_Y + 11, { color: COLORS.paper.inkSoft, font: 'small', maxWidth: 80 }); // str
    // the crossbar the chimes hang from
    ctx.fillStyle = COLORS.tally.dark;
    ctx.fillRect(CHIME_X - 6, CHIME_Y - 2, 6 * 40 - 4, 2);
    for (let i = 0; i < 6; i++) {
      const r = chimeRect(i);
      const k = swing[i] > 0 ? swing[i] / 600 : 0;
      const dx = Math.round(Math.sin(ms / 60) * 2 * k);
      const len = 30 - i * 3;
      const tx = r.x + 9 + dx;
      ctx.fillStyle = COLORS.paper.edge;
      ctx.fillRect(r.x + 12, CHIME_Y, 1, 3);
      ctx.fillStyle = k > 0 ? COLORS.brass.light : COLORS.brass.fill;
      ctx.fillRect(tx, CHIME_Y + 3, 7, len);
      ctx.fillStyle = COLORS.brass.dark;
      ctx.fillRect(tx + 5, CHIME_Y + 3, 2, len);
      ctx.fillStyle = COLORS.brass.light;
      ctx.fillRect(tx + 1, CHIME_Y + 4, 1, len - 2);
      ctx.fillRect(tx, CHIME_Y + 3 + len, 7, 1);
      drawText(ctx, CHIME_NOTES[i].replace(/\d/, ''), r.x + 12, CHIME_Y + 3 + len + 2, { color: COLORS.paper.inkSoft, font: 'small', align: 'center' });
      if (focusedRow && col === i) drawCursor(ctx, r.x + 6, CHIME_Y + 10, ms);
    }
    // the composed Signal: six note heads on a two-line staff
    const sx = CHIME_X, sy = 248;
    ctx.fillStyle = COLORS.paper.rule;
    ctx.fillRect(sx - 4, sy, 236, 1); ctx.fillRect(sx - 4, sy + 6, 236, 1);
    a.signal.forEach((n, k) => {
      const x = sx + k * 40 + 8;
      const y = sy + 8 - n * 2;
      ctx.fillStyle = k === writeAt && focusedRow ? PALETTE.waxRed : COLORS.paper.ink;
      ctx.fillRect(x, y, 5, 3); ctx.fillRect(x + 1, y - 1, 3, 5);
      ctx.fillRect(x + 4, y - 7, 1, 7);
      if (k === writeAt && focusedRow) ctx.fillRect(x - 1, sy + 10, 7, 1);
    });
    drawWaxButton(ctx, t('lease.signal.play'), playRect, { focused: focusedRow && col === 6, emblem: 'arrow' });
    drawWaxButton(ctx, t('lease.signal.reset'), resetRect, { focused: focusedRow && col === 7, emblem: 'dot' });
  }

  function drawBack(ctx) {
    drawPanel(ctx, CARD, 'ledger', { rulePitch: ROW_H, ruleStart: 37 });
    drawText(ctx, t('lease.back'), 24, 16, { color: COLORS.paper.ink });
    drawText(ctx, t('dial.question'), 24, 40, { color: COLORS.paper.inkSoft });
    drawDialPips(ctx, 24, 52, params.dial ?? G.world?.run?.dial ?? 'flux');
    drawText(ctx, `${t('seedCard.seed')}  ${params.seedCode ?? G.world?.run?.seedCode ?? ''}`, 24, 88, { color: PALETTE.waxRed });
    drawText(ctx, t('seedCard.seals'), 24, 106, { color: COLORS.paper.inkSoft });
    CHALLENGES.forEach((c, i) => {
      drawChallengeSeal(ctx, 24 + i * 44, 118, c.id, (params.challenges ?? []).includes(c.id));
      drawText(ctx, c.name, 40 + i * 44, 154, { color: COLORS.paper.inkSoft, font: 'small', align: 'center' });
    });
    drawText(ctx, `${t('lease.field.wake')}: ${valueText('wake', a)}`, 24, 172, { color: COLORS.paper.ink });
    drawText(ctx, 'Read-only after the Seed Card. Any key turns it back.', 24, 236, { color: COLORS.paper.inkFaint, font: 'small' }); // str
  }

  function draw(ctx) {
    ctx.fillStyle = PALETTE.nightInk;
    ctx.fillRect(0, 0, 480, 270);
    // dusk behind the card: the causeway's last light
    const bands = ['#1B2140', '#26294F', '#3B2D5E', '#5A3A63', '#7D4D5C'];
    bands.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, 150 + i * 24, 480, 24); });
    let sy = 0, sx = 1;
    if (flipMs >= 0) {
      const f = Math.min(1, flipMs / 200);
      sx = f < 0.5 ? 1 - f * 2 : (f - 0.5) * 2;
      sy = flipMs > 200 ? Math.min(1, (flipMs - 200) / 100) * 280 : 0;
    }
    const slide = Math.max(0, 1 - ms / 100) * 12;
    ctx.save();
    ctx.translate(240, 135 + sy + slide);
    ctx.scale(Math.max(0.02, sx), 1);
    ctx.translate(-240, -135);
    const showBack = back || (flipMs >= 100);
    if (showBack) drawBack(ctx);
    else {
      drawPanel(ctx, CARD, 'ledger', { rulePitch: ROW_H, ruleStart: ROW_Y - CARD.y + 9 });
      drawText(ctx, t('lease.heading'), 24, 16, { color: COLORS.paper.ink });
      drawText(ctx, t('lease.issuer'), 464, 18, { color: COLORS.paper.inkSoft, align: 'right', font: 'small' });
      drawRows(ctx);
      drawPreview(ctx);
      drawWren(ctx);
      drawSignal(ctx);
      drawWaxButton(ctx, t('lease.sign'), signRect, { focused: row === ROW_SIGN, emblem: 'star' });
      if (row === ROW_SIGN) drawCursor(ctx, signRect.x - 1, signRect.y + 4, ms);
    }
    ctx.restore();
    if (!entry && flipMs < 0) {
      const hint = hintFor(G.input, {
        keyboard: '↑↓ field  ←→ change  Z: choose  X: back  [ ]: turn', // str
        gamepad: 'd-pad: field / change  A: choose  B: back  LB RB: turn', // str
        touch: 'tap a field to change it', // str
      });
      drawText(ctx, hint, 18, 264, { color: PALETTE.paperShade, font: 'small' });
    }
    if (entry) {
      ctx.globalAlpha = 0.55; ctx.fillStyle = PALETTE.nightInk; ctx.fillRect(0, 0, 480, 270); ctx.globalAlpha = 1;
      entry.draw(ctx);
    }
  }

  return {
    name: 'leaseCard',
    opaque: true,
    enter(p = {}) {
      params = p;
      mirror = Boolean(p.mirror);
      a = defaultAnswers();
      if (mirror && G.world) {
        const card = cardFromWorld(G.world);
        const idx = MARKING_SETS.findIndex((s) => s.length === card.markings.length && s.every((m) => card.markings.includes(m)));
        a = { ...a, species: card.species, fur: card.fur, marks: Math.max(0, idx), eyes: card.eyes, blush: card.blush,
          name: G.world.player.name || a.name, pronouns: PRONOUNS.includes(G.world.player.pronouns) ? G.world.player.pronouns : 'they',
          town: townNameOf(G.world), signal: signalOfWorld(G.world) ?? DEFAULT_SIGNAL.slice(), wake: G.world.flags?.[LEASE_FLAGS.wake] === 'waystone' ? 'waystone' : 'porch' };
        say(t('lease.mirror'));
      } else {
        line = 'You walked. Nobody walks. Fill this in while I make small talk.'; // str
        lineMs = 0;
      }
      ms = 0; row = 0; col = 2; facing = 0; leaving = false; flipMs = -1; back = false; writeAt = 0; busy = false; entry = null;
    },
    exit() { closeEntry(); },
    pause() {},
    resume() {},
    update(dt) {
      ms += dt;
      lineMs += dt;
      if (turnMs > 0) turnMs = Math.max(0, turnMs - dt);
      if (nodMs > 0) nodMs = Math.max(0, nodMs - dt);
      for (let i = 0; i < 6; i++) if (swing[i] > 0) swing[i] = Math.max(0, swing[i] - dt);
      blinkAt -= dt;
      if (blinkAt <= 0) { blinkMs = 120; blinkAt = 3000 + ((ms * 7) % 2000); }
      if (blinkMs > 0) blinkMs = Math.max(0, blinkMs - dt);
      if (entry) entry.update(dt);
      if (flipMs >= 0) {
        flipMs += dt;
        if (flipMs >= 320 && leaving) { flipMs = -2; finishSign(); }
      }
    },
    handleInput(input) {
      if (leaving || busy) return;
      if (entry) { entry.handle(input); return; }
      handleInput(input);
    },
    draw,
    answers: () => ({ ...a, signal: a.signal.slice(), lease: leaseOf(a) }),
    debugText: () => [t('lease.heading'), ...FIELDS.map((f, i) => `${i === row ? '>' : ' '} ${labelOf(f)}: ${valueText(f, a)}`),
      `${row === ROW_SIGNAL ? '>' : ' '} Signal: ${a.signal.map((n) => CHIME_NOTES[n]).join(' ')}`, `${row === ROW_SIGN ? '>' : ' '} ${t('lease.sign')}`,
      entry ? entry.debugText() : '', line].filter(Boolean).join('\n'),
  };
}
