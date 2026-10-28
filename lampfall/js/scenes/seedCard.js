/**
 * Seed Card. [SCN-FLOW] — GDD-09 §3.2, §7, §8, §9; GDD-00 §15.
 *
 * Two faces of one card on the keeper's desk:
 *
 * **New season** (`mode: 'new'`, from the title). The Chaos dial ("How do you like your odds?")
 * as three pips Drift / Flux (default) / Freefall with their tags and a one-line description, the
 * focused dial's rules strip, the seed code with New seed and Type a seed (manual entry through
 * the shared controller-first entry grid; Crockford, validated by `core/rng.decodeSeedCode`), the
 * challenge seals from `data/dials.CHALLENGES` (No Rewind, One Heart, and Ride the Dice / Blind
 * Read because dials.js ships them) and Begin. Turning the dial or pressing a seal re-encodes the
 * code (the characters tumble). Begin fades to the Lease Card with `{seedCode, dial, challenges}`;
 * `cancel` irises back to the title (nothing kept).
 *
 * **End of run** (`mode: 'end'`, the credits and the Season Book): dial pips and race
 * eligibility, the seed, the seals pressed or open plus the Summit seal slot (stamped after Idris,
 * `sp.idris-beaten`), the tallies (days, catches, Forecasts, rerolls, anchors, seals) and one
 * Shiftlog strip per party member (each form's 16×16 icon with the mark in the same spot). Copy as
 * text puts {@link seedCardText} on the clipboard. `cancel` pops (or calls `params.onDone`).
 *
 * {@link drawRunCard} draws the end-of-run card anywhere (the credits hold it for 300 f).
 * @module scenes/seedCard
 */
import { drawText, measureText } from '../core/font.js';
import { encodeSeedCode, decodeSeedCode, randomSeedCode, getSeedToggles, SEED_CODE } from '../core/rng.js';
import { t } from '../data/strings.js';
import { DIALS, CHALLENGES, DEFAULT_DIAL } from '../data/dials.js';
import { COLORS, PALETTE, TIMING } from '../ui/theme.js';
import { drawPanel } from '../ui/panel.js';
import { drawDottedRect } from '../ui/focus.js';
import { createNameEntry } from './nameEntry.js';
import { drawCreatureIcon } from './menuKit.js';
import { drawWaxButton, drawCursor, drawDesk, inRect, flowFade, hintFor, tidySeed } from './flowKit.js';

/** Card rect (GDD-09 §3.2). */
export const CARD = Object.freeze({ x: 72, y: 31, w: 336, h: 208 });

/** One line per dial for the pips (GDD-00 §8 in a breath). */
export const DIAL_LINES = Object.freeze({
  drift: 'Kinder odds and three free anchor stones. The cards lean your way.', // str
  flux: 'The odds as the sea sets them, the way Isolde read them.', // str
  freefall: 'Flat pools, silhouettes, no stat floor. Read costs the turn.', // str
});

/**
 * Re-encodes a code for a dial and a set of challenge toggles, keeping its seed (pure).
 * @param {string} code
 * @param {string} dial  dial id
 * @param {string[]} toggles
 * @returns {string}
 */
export function recode(code, dial, toggles) {
  const parts = decodeSeedCode(code);
  const known = getSeedToggles();
  return encodeSeedCode({ dial: dial.toUpperCase(), seed: parts ? parts.seed : 0, toggles: toggles.filter((x) => known.includes(x)) });
}

/**
 * Reads a typed seed (pure): `{ok, code, dial, toggles}` for a well-formed code whose dial word is
 * one of the dials, else `{ok: false}`.
 * @param {string} text
 * @returns {{ok: true, code: string, dial: string, toggles: string[]} | {ok: false}}
 */
export function readTypedSeed(text) {
  const parts = decodeSeedCode(tidySeed(text));
  if (!parts) return { ok: false };
  const dial = parts.dial.toLowerCase();
  if (!DIALS.some((d) => d.id === dial)) return { ok: false };
  return { ok: true, code: encodeSeedCode({ dial: parts.dial, seed: parts.seed, toggles: parts.toggles }), dial, toggles: parts.toggles.slice() };
}

/**
 * The rules strip for a dial (pure): four short lines.
 * @param {any} dial  a DIALS row
 * @returns {string[]}
 */
export function dialRuleLines(dial) {
  const s = dial.shift;
  const anchors = { drift: t('dial.rule.anchorsDrift'), flux: t('dial.rule.anchorsFlux'), freefall: t('dial.rule.anchorsFreefall') }[dial.id] ?? '';
  return [
    t('dial.odds', { up: s.odds.up, side: s.odds.side, down: s.odds.down }),
    t('dial.rule.read', { value: s.readFree ? t('dial.rule.readFree') : t('dial.rule.readCosts') }),
    t('dial.rule.capture', { value: dial.rules.captureDisplay === 'band' ? t('dial.rule.captureBands') : t('dial.rule.captureExact') }),
    t('dial.rule.anchors', { value: anchors }),
    t('dial.rule.floor', { value: s.statFloor === null ? 'none' : `${Math.round(s.statFloor * 100)}%` }), // str (none)
    t('dial.rule.unseen', { value: s.unseenForms === 'silhouette' ? t('dial.rule.unseenSilhouette') : t('dial.rule.unseenShown') }),
  ];
}

/**
 * The run's tallies for the end-of-run card (pure).
 * @param {any} world
 * @returns {{days: number, catches: number, forecasts: number, rerolls: number, anchors: number, badges: number}}
 */
export function runTallies(world) {
  const st = world?.stats ?? {};
  return {
    days: Math.max(1, Math.floor((world?.clock?.total ?? 0) / 1440) + 1),
    catches: st.catches ?? 0,
    forecasts: st.forecasts ?? 0,
    rerolls: st.rerolls ?? 0,
    anchors: st.anchors ?? 0,
    badges: world?.badges?.length ?? 0,
  };
}

/**
 * The ring the Passenger settled into at the Reading (np.keeper.reading-ring, set by the Forecast
 * scene's Reading offer, LF-02), or null before the Reading. Pure.
 * @param {any} world
 * @returns {string|null}
 */
export function readingRing(world) {
  const v = world?.flags?.['np.keeper.reading-ring'];
  return typeof v === 'string' && v ? v : null;
}

/**
 * The Seed Card as text (GDD-09 §8), for the clipboard.
 * @param {any} world
 * @param {any} [data] registry (form names)
 * @returns {string}
 */
export function seedCardText(world, data) {
  const run = world?.run ?? {};
  const dial = DIALS.find((d) => d.id === run.dial) ?? DIALS.find((d) => d.id === DEFAULT_DIAL);
  const eligible = run.dialChangedMidRun ? t('seedCard.notRaceEligible', { day: '?' }).replace(/:.*/, '') : t('seedCard.raceEligible').toLowerCase();
  const seals = (run.challenges ?? []).map((id) => CHALLENGES.find((c) => c.id === id)?.name ?? id);
  const tl = runTallies(world);
  const formName = (id) => { try { return data?.tryGet?.('species', id)?.name ?? id; } catch { return id; } };
  const lines = [
    t('seedCard.text.header'),
    t('seedCard.text.line', { label: t('seedCard.seed'), value: run.seedCode ?? '' }),
    t('seedCard.text.line', { label: t('seedCard.dial'), value: `${dial?.name ?? run.dial} (${eligible})` }),
    t('seedCard.text.line', { label: t('seedCard.seals'), value: seals.length ? seals.join(', ') : t('common.none') }),
    [t('seedCard.days', { n: tl.days }), t('seedCard.catches', { n: tl.catches }), t('seedCard.forecasts', { n: tl.forecasts }),
      t('seedCard.rerolls', { n: tl.rerolls }), t('seedCard.anchors', { n: tl.anchors }), t('seedCard.badges', { n: tl.badges })].join('   '),
  ];
  for (const c of world?.party ?? []) {
    const forms = (c.shiftlog?.length ? c.shiftlog : [c.speciesId]).map(formName).join(' > ');
    lines.push(t('seedCard.text.shiftlog', { nick: c.nickname || formName(c.speciesId), forms }));
  }
  lines.push(`${t('seedCard.summitSeal')}: ${world?.flags?.['sp.idris-beaten'] ? 'stamped' : 'open'}`); // str
  const ring = readingRing(world);
  if (ring) lines.push(t('seedCard.text.line', { label: t('seedCard.reading'), value: ring }));
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------------------------

/**
 * A 32×32 challenge seal: pressed (wax red with a raised emboss) or open (a dotted ring). Each
 * emboss is a distinct shape so a seal never reads by colour alone.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y
 * @param {string} id  challenge id (or 'summit')
 * @param {boolean} pressed
 * @param {{focused?: boolean, ms?: number, pop?: number}} [o]
 */
export function drawChallengeSeal(ctx, x, y, id, pressed, o = {}) {
  const pop = o.pop ?? 0;
  const s = pop > 0 ? 1 : 0;
  x = Math.round(x); y = Math.round(y) + s;
  if (pressed) {
    ctx.fillStyle = COLORS.shadow;
    disc(ctx, x + 1, y + 2, 15);
    ctx.fillStyle = id === 'summit' ? COLORS.brass.dark : PALETTE.waxDark;
    disc(ctx, x, y, 15);
    ctx.fillStyle = id === 'summit' ? COLORS.brass.fill : PALETTE.waxRed;
    disc(ctx, x + 1, y + 1, 13);
    // drips of wax at the rim
    ctx.fillStyle = id === 'summit' ? COLORS.brass.fill : PALETTE.waxRed;
    ctx.fillRect(x + 3, y + 22, 3, 3); ctx.fillRect(x + 25, y + 6, 3, 2); ctx.fillRect(x + 27, y + 20, 2, 3);
    ctx.fillStyle = id === 'summit' ? COLORS.brass.light : PALETTE.waxLight;
    ctx.fillRect(x + 9, y + 4, 14, 1);
    emboss(ctx, x, y, id, id === 'summit' ? COLORS.brass.dark : PALETTE.waxDark, id === 'summit' ? COLORS.brass.light : '#D9727A');
  } else {
    ctx.fillStyle = COLORS.paper.inkFaint;
    for (let a = 0; a < 40; a++) {
      const ang = (a / 40) * Math.PI * 2;
      if (a % 2) continue;
      ctx.fillRect(Math.round(x + 15.5 + Math.cos(ang) * 14), Math.round(y + 15.5 + Math.sin(ang) * 14), 1, 1);
    }
    emboss(ctx, x, y, id, COLORS.paper.shade, COLORS.paper.deep);
  }
  if (o.focused) drawDottedRect(ctx, x - 3, y - 3, 38, 38, COLORS.focus.ringOnPaper);
}

function disc(ctx, x, y, r) {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.round(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(x + 16 - w, y + 16 + dy, w * 2, 1);
  }
}

function emboss(ctx, x, y, id, dark, light) {
  const P = (px, py, w = 1, h = 1, c = dark) => { ctx.fillStyle = c; ctx.fillRect(x + px, y + py, w, h); };
  if (id === 'no-rewind') { // a stopped hourglass
    P(10, 8, 12, 2); P(10, 22, 12, 2);
    for (let i = 0; i < 6; i++) { P(11 + i, 10 + i, 1, 1); P(20 - i, 10 + i, 1, 1); P(11 + i, 21 - i, 1, 1); P(20 - i, 21 - i, 1, 1); }
    P(14, 18, 4, 3, light); P(15, 15, 2, 2, light); P(9, 15, 14, 1);
  } else if (id === 'one-heart') { // a single four-point mark
    P(15, 7, 2, 18); P(7, 15, 18, 2); P(13, 13, 6, 6); P(14, 14, 4, 4, light);
  } else if (id === 'ride-the-dice') { // two dice
    P(7, 9, 10, 10); P(8, 10, 8, 8, light); P(10, 12, 2, 2); P(13, 15, 2, 2);
    P(15, 14, 10, 10); P(16, 15, 8, 8, light); P(17, 16, 2, 2); P(21, 16, 2, 2); P(19, 19, 2, 2); P(17, 21, 2, 2); P(21, 21, 2, 2);
  } else if (id === 'blind-read') { // a lens with a bar
    for (let a = 0; a < 32; a++) { const ang = (a / 32) * Math.PI * 2; P(Math.round(14 + Math.cos(ang) * 6), Math.round(14 + Math.sin(ang) * 6), 1, 1); }
    P(18, 19, 2, 2); P(20, 21, 2, 2); P(22, 23, 3, 3); P(7, 13, 15, 2, light); P(7, 13, 15, 1);
  } else if (id === 'summit') { // a bell
    P(12, 8, 8, 2); P(11, 10, 10, 8); P(9, 18, 14, 3); P(15, 21, 2, 3); P(13, 11, 2, 6, light);
  }
}

/**
 * The three dial pips 96×24 (GDD-09 §7): ● chosen, ○ otherwise; Freefall carries a ★, Drift a halo.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x @param {number} y
 * @param {string} chosen  dial id
 * @param {{focusId?: string|null, small?: boolean}} [o]
 * @returns {Array<{id: string, rect: {x: number, y: number, w: number, h: number}}>}
 */
export function drawDialPips(ctx, x, y, chosen, o = {}) {
  const w = o.small ? 48 : 96, h = o.small ? 14 : 24, gap = o.small ? 4 : 12;
  const out = [];
  DIALS.forEach((d, i) => {
    const r = { x: x + i * (w + gap), y, w, h };
    const on = d.id === chosen;
    ctx.fillStyle = on ? COLORS.paper.light : COLORS.paper.shade;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = on ? COLORS.paper.ink : COLORS.paper.rule;
    ctx.fillRect(r.x, r.y, r.w, 1); ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1); ctx.fillRect(r.x, r.y, 1, r.h); ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
    const pip = on ? '●' : '○';
    const ink = on ? COLORS.paper.ink : COLORS.paper.inkSoft;
    if (o.small) {
      drawText(ctx, `${pip} ${d.name}`, r.x + 3, r.y + 4, { color: ink, font: 'small' });
    } else {
      drawText(ctx, pip, r.x + 5, r.y + 4, { color: on ? PALETTE.waxRed : COLORS.paper.inkSoft });
      if (d.id === 'drift') drawText(ctx, '○', r.x + 5, r.y + 4, { color: COLORS.paper.inkFaint, alpha: on ? 0 : 0.4 });
      drawText(ctx, d.name, r.x + 15, r.y + 4, { color: ink });
      if (d.id === 'freefall') drawText(ctx, '★', r.x + r.w - 11, r.y + 4, { color: on ? PALETTE.waxRed : COLORS.paper.inkSoft });
      const tag = t(`dial.${d.id}.tag`);
      drawText(ctx, tag, r.x + 15, r.y + 15, { color: COLORS.paper.inkSoft, font: 'small' });
    }
    if (o.focusId === d.id) drawDottedRect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, COLORS.focus.ringOnPaper);
    out.push({ id: d.id, rect: r });
  });
  return out;
}

/**
 * Draws a code with a tumble: characters past `progress` (0..1) show a rolling Crockford digit.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} code
 * @param {number} x @param {number} y
 * @param {number} progress  1 = settled
 * @param {number} ms
 * @param {object} [opts]   drawText options
 */
export function drawTumblingCode(ctx, code, x, y, progress, ms, opts = {}) {
  if (progress >= 1) { drawText(ctx, code, x, y, opts); return; }
  const chars = Array.from(code);
  const settled = Math.floor(chars.length * progress);
  const alpha = SEED_CODE.alphabet;
  const shown = chars.map((ch, i) => (i < settled || ch === '-' ? ch : alpha[(Math.floor(ms / 33) * 7 + i * 13) % alpha.length])).join('');
  drawText(ctx, shown, x, y, opts);
}

/**
 * The end-of-run Seed Card (GDD-09 §8) at a card origin.
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} G
 * @param {number} ox @param {number} oy
 * @param {{ms?: number, stampMs?: number}} [o]  `stampMs` animates the Summit seal pressing in
 */
export function drawRunCard(ctx, G, ox, oy, o = {}) {
  const world = G.world;
  const run = world?.run ?? {};
  drawPanel(ctx, { x: ox, y: oy, w: CARD.w, h: CARD.h }, 'card');
  const ink = COLORS.paper.ink, soft = COLORS.paper.inkSoft;
  drawText(ctx, t('seedCard.heading'), ox + 12, oy + 8, { color: ink });
  drawText(ctx, run.seedCode ?? '', ox + CARD.w - 12, oy + 8, { color: PALETTE.waxRed, align: 'right' });
  ctx.fillStyle = COLORS.paper.rule; ctx.fillRect(ox + 12, oy + 19, CARD.w - 24, 1);
  drawDialPips(ctx, ox + 12, oy + 24, run.dial ?? DEFAULT_DIAL, { small: true });
  const elig = run.dialChangedMidRun ? t('seedCard.notRaceEligible', { day: '?' }) : t('seedCard.raceEligible');
  drawText(ctx, elig, ox + 12, oy + 41, { color: soft, font: 'small', maxWidth: 150 });
  // seals: the run's challenges pressed, the rest open, plus the Summit slot
  const sx = ox + 170;
  CHALLENGES.forEach((c, i) => {
    const on = (run.challenges ?? []).includes(c.id);
    ctx.save(); ctx.translate(sx + i * 31, oy + 24); ctx.scale(0.75, 0.75);
    drawChallengeSeal(ctx, 0, 0, c.id, on);
    ctx.restore();
  });
  const summit = world?.flags?.['sp.idris-beaten'] === true;
  const stampK = o.stampMs === undefined ? 1 : Math.max(0, Math.min(1, o.stampMs / 300));
  ctx.save(); ctx.translate(sx + 4 * 31 + 2, oy + 24); ctx.scale(0.75, 0.75);
  if (summit && stampK > 0) { ctx.globalAlpha = stampK; drawChallengeSeal(ctx, 0, Math.round((1 - stampK) * -12), 'summit', true); ctx.globalAlpha = 1; } else drawChallengeSeal(ctx, 0, 0, 'summit', false);
  ctx.restore();
  // LF-17: the caption sits centred under the Summit slot (the fifth seal), not under the first challenge seal
  // (right-aligned to the card's inner edge, which the fifth seal ends on, so a long line stays on the card)
  drawText(ctx, summit ? t('seedCard.summitStamped') : t('seedCard.summitSeal'), ox + CARD.w - 12, oy + 52, { color: soft, font: 'small', align: 'right', maxWidth: 72 });
  // tallies
  const tl = runTallies(world);
  const rows = [
    [t('seedCard.days', { n: tl.days }), t('seedCard.catches', { n: tl.catches })],
    [t('seedCard.forecasts', { n: tl.forecasts }), t('seedCard.rerolls', { n: tl.rerolls })],
    [t('seedCard.anchors', { n: tl.anchors }), t('seedCard.badges', { n: tl.badges })],
  ];
  rows.forEach((r, i) => {
    drawText(ctx, r[0], ox + 12, oy + 58 + i * 11, { color: ink });
    drawText(ctx, r[1], ox + 90, oy + 58 + i * 11, { color: ink });
  });
  // the ring the Passenger settled into (LF-02), under the seals
  const ring = readingRing(world);
  if (ring) {
    drawText(ctx, t('seedCard.reading'), ox + 170, oy + 69, { color: soft, font: 'small' });
    drawText(ctx, ring, ox + 170, oy + 80, { color: ink, maxWidth: CARD.w - 182 });
  }
  ctx.fillStyle = COLORS.paper.rule; ctx.fillRect(ox + 12, oy + 98, CARD.w - 24, 1);
  // Shiftlogs: one strip per party member, each form's icon with the mark in the same spot
  const party = world?.party ?? [];
  if (!party.length) drawText(ctx, 'No one in the party yet.', ox + 12, oy + 108, { color: soft }); // str
  party.slice(0, 6).forEach((c, i) => {
    const y = oy + 103 + i * 16;
    const forms = c.shiftlog?.length ? c.shiftlog : [c.speciesId];
    const label = t('seedCard.shiftlog', { nick: c.nickname || formNameOf(G, c.speciesId) });
    drawText(ctx, label, ox + 12, y + 5, { color: ink, font: 'small', maxWidth: 112 });
    forms.slice(-10).forEach((f, k) => {
      const ix = ox + 130 + k * 19;
      try { drawCreatureIcon(ctx, G, c, ix, y, { form: f }); } catch { ctx.fillStyle = COLORS.paper.deep; ctx.fillRect(ix, y, 16, 16); }
      if (k > 0) drawText(ctx, '>', ix - 4, y + 5, { color: soft, font: 'small' });
    });
  });
}

function formNameOf(G, id) {
  try { return G.data?.tryGet?.('species', id)?.name ?? id; } catch { return id; }
}

// ---------------------------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------------------------

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string, state: () => object}}
 */
export function createSeedCardScene(G) {
  let mode = 'new';
  let params = {};
  let ms = 0;
  let dial = DEFAULT_DIAL;
  let code = '';
  /** @type {string[]} */
  let seals = [];
  let row = 0;          // 0 dial, 1 seed, 2 seals, 3 begin
  let col = 1;          // column inside the row
  let tumble = 1;       // 0..1 code tumble progress
  let slip = null;      // {text, ms}
  let entry = null;     // the manual seed entry while open
  let leaving = false;
  let pressMs = {};     // seal id -> press animation ms
  let copyNote = '';
  let stampMs = 0;
  const hover = { x: NaN, y: NaN };

  const challengeList = () => CHALLENGES.filter((c) => getSeedToggles().includes(c.id) || !c.optional);
  const dialIds = () => DIALS.map((d) => d.id);

  function sfx(kind) { try { G.bus?.emit?.(`ui:${kind}`, {}); } catch { /* never break the card */ } }

  function setCode(next, animate = true) {
    if (next !== code) { code = next; if (animate) tumble = 0; }
  }

  function turnDial(id) {
    if (id === dial) return;
    dial = id;
    setCode(recode(code, dial, seals));
    sfx('cursor');
    try { G.audio?.sfx?.('shiftFlip', { volume: 0.35 }); } catch { /* audio is optional */ }
  }

  function toggleSeal(id) {
    seals = seals.includes(id) ? seals.filter((s) => s !== id) : [...seals, id];
    const order = challengeList().map((c) => c.id);
    seals.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    pressMs[id] = 67;
    setCode(recode(code, dial, seals));
    try { G.audio?.sfx?.('stamp', { volume: 0.6 }); } catch { /* audio is optional */ }
  }

  function reroll() {
    setCode(randomSeedCode(dial.toUpperCase(), G.entropy, { toggles: seals }));
    sfx('confirm');
  }

  function openEntry() {
    entry = createNameEntry({
      input: G.input,
      prompt: t('seedCard.typeSeed'),
      initial: code,
      suggest: code,
      maxLen: 20,
      sfx: (evt) => { try { G.bus?.emit?.(evt, {}); } catch { /* audio is optional */ } },
      onDone: (text) => {
        const r = readTypedSeed(text);
        closeEntry();
        if (!r.ok) { slip = { text: t('seedCard.seedInvalid'), ms: 0 }; sfx('error'); return; }
        dial = r.dial;
        seals = r.toggles.slice();
        setCode(r.code);
        sfx('confirm');
      },
      onCancel: () => closeEntry(),
    });
    entry.attach();
  }
  function closeEntry() { if (entry) entry.detach(); entry = null; }

  function begin() {
    if (leaving) return;
    leaving = true;
    sfx('confirm');
    const payload = { seedCode: code, dial, challenges: seals.slice() };
    if (typeof params.onBegin === 'function') { params.onBegin(payload); return; }
    G.scenes.transition('fade', flowFade(G), () => G.replaceWith('leaseCard', payload), { color: PALETTE.nightInk });
  }

  function back() {
    if (leaving) return;
    sfx('cancel');
    if (mode === 'end') { finishEnd(); return; }
    leaving = true;
    G.scenes.transition('iris', flowFade(G), () => G.replaceWith('title', {}), { color: PALETTE.nightInk });
  }

  function finishEnd() {
    if (typeof params.onDone === 'function') { params.onDone(); return; }
    if (G.scenes.size > 1) G.scenes.pop({ seedCard: true });
    else G.replaceWith('title', {});
  }

  async function copyText() {
    const text = seedCardText(G.world, G.data);
    let ok = false;
    try {
      const clip = globalThis.navigator?.clipboard;
      if (clip && typeof clip.writeText === 'function') { await clip.writeText(text); ok = true; }
    } catch { ok = false; }
    copyNote = ok ? t('seedCard.copied') : t('seedCard.copyFailed', { code: G.world?.run?.seedCode ?? '' });
    try { G.bus?.emit?.('toast', { text: copyNote }); } catch { /* toast is optional */ }
    try { globalThis.console?.log?.(text); } catch { /* the text also goes to the console for tools */ }
  }

  // ---- layout ------------------------------------------------------------------------------
  const X = CARD.x + 12;
  const PIPS_Y = 68;
  const SEED_Y = 140;
  const SEALS_Y = 166;
  const rerollRect = { x: 252, y: SEED_Y, w: 70, h: 16 };
  const typeRect = { x: 326, y: SEED_Y, w: 70, h: 16 };
  const beginRect = { x: 312, y: 214, w: 84, h: 16 };
  const sealRect = (i) => ({ x: X + i * 40, y: SEALS_Y, w: 32, h: 32 });
  const pipRect = (i) => ({ x: X + i * 108, y: PIPS_Y, w: 96, h: 24 });
  const copyRect = { x: CARD.x + CARD.w - 104, y: CARD.y + CARD.h + 6, w: 104, h: 16 };
  const doneRect = { x: CARD.x, y: CARD.y + CARD.h + 6, w: 72, h: 16 };

  function rowCols(r) {
    if (r === 0) return DIALS.length;
    if (r === 1) return 2;
    if (r === 2) return challengeList().length;
    return 1;
  }

  function moveRow(d) {
    const next = Math.max(0, Math.min(3, row + d));
    if (next === row) return;
    row = next;
    if (row === 0) col = dialIds().indexOf(dial);
    col = Math.max(0, Math.min(rowCols(row) - 1, col));
    sfx('cursor');
  }

  function moveCol(d) {
    if (row === 0) {
      const ids = dialIds();
      const i = Math.max(0, Math.min(ids.length - 1, ids.indexOf(dial) + d));
      col = i;
      turnDial(ids[i]);
      return;
    }
    const n = rowCols(row);
    const next = Math.max(0, Math.min(n - 1, col + d));
    if (next !== col) { col = next; sfx('cursor'); }
  }

  function activateFocused() {
    if (row === 0) { moveRow(1); return; }
    if (row === 1) { if (col === 0) reroll(); else openEntry(); return; }
    if (row === 2) { const c = challengeList()[col]; if (c) toggleSeal(c.id); return; }
    begin();
  }

  /** Pointer targets as [row, col, rect]. */
  function targets() {
    const out = [];
    DIALS.forEach((_, i) => out.push([0, i, pipRect(i)]));
    out.push([1, 0, rerollRect], [1, 1, typeRect]);
    challengeList().forEach((_, i) => out.push([2, i, sealRect(i)]));
    out.push([3, 0, beginRect]);
    return out;
  }

  function handleNew(input) {
    const p = input.pointer;
    const tg = targets();
    if (p && p.inside && p.type !== 'touch' && (hover.x !== p.x || hover.y !== p.y)) {
      hover.x = p.x; hover.y = p.y;
      const hit = tg.find(([, , r]) => inRect(p, r));
      if (hit && (hit[0] !== row || hit[1] !== col) && hit[0] !== 0) { row = hit[0]; col = hit[1]; sfx('cursor'); }
    }
    if (p && p.justDown) {
      const hit = tg.find(([, , r]) => inRect(p, r));
      if (hit) {
        const touch = p.type === 'touch';
        const same = hit[0] === row && hit[1] === col;
        if (hit[0] === 0) { row = 0; col = hit[1]; turnDial(dialIds()[hit[1]]); return; }
        row = hit[0]; col = hit[1];
        if (!touch || same) activateFocused(); else sfx('cursor');
        return;
      }
    }
    const rep = (a) => input.repeat(a, { delay: TIMING.repeatDelayMs, rate: TIMING.repeatRateMs });
    if (rep('up')) moveRow(-1);
    else if (rep('down')) moveRow(1);
    else if (rep('left')) moveCol(-1);
    else if (rep('right')) moveCol(1);
    if (input.pressed('confirm')) activateFocused();
    else if (input.pressed('start')) { row = 3; begin(); }
    else if (input.pressed('cancel')) back();
  }

  function handleEnd(input) {
    const p = input.pointer;
    if (p && p.justDown) {
      if (inRect(p, copyRect)) { col = 1; copyText(); return; }
      if (inRect(p, doneRect)) { col = 0; finishEnd(); return; }
    }
    if (input.pressed('left')) col = 0;
    if (input.pressed('right')) col = 1;
    if (input.pressed('confirm')) { if (col === 1) copyText(); else finishEnd(); }
    else if (input.pressed('cancel')) back();
  }

  function drawNew(ctx) {
    drawDesk(ctx, ms);
    const slide = Math.max(0, 1 - ms / 100);
    ctx.save();
    ctx.translate(0, Math.round(slide * 12));
    drawPanel(ctx, CARD, 'card');
    const ink = COLORS.paper.ink, soft = COLORS.paper.inkSoft;
    drawText(ctx, t('seedCard.heading'), X, 39, { color: ink, scale: 1 });
    drawText(ctx, 'New season', X + 64, 41, { color: soft, font: 'small' }); // str
    drawText(ctx, t('dial.question'), X, 56, { color: ink });
    const focusDial = row === 0 ? dial : null;
    drawDialPips(ctx, X, PIPS_Y, dial, { focusId: focusDial });
    // rules strip: the focused dial, or the focused seal's rule
    ctx.fillStyle = COLORS.paper.shade; ctx.fillRect(X, 98, 312, 37);
    if (row === 2) {
      const c = challengeList()[col];
      if (c) {
        const on = seals.includes(c.id);
        drawText(ctx, `${t(`challenge.${c.id}.name`)}: ${on ? t('challenge.sealOn') : t('challenge.sealOff')}`, X + 4, 101, { color: ink });
        drawText(ctx, t(`challenge.${c.id}.text`), X + 4, 113, { color: soft, font: 'small', maxWidth: 304 });
      }
    } else {
      const d = DIALS.find((x) => x.id === dial);
      drawText(ctx, DIAL_LINES[dial] ?? d.text, X + 4, 101, { color: ink, maxWidth: 304 });
      const lines = dialRuleLines(d);
      lines.forEach((ln, i) => drawText(ctx, ln, X + 4 + (i % 2) * 156, 113 + Math.floor(i / 2) * 7, { color: soft, font: 'small', maxWidth: 150 }));
    }
    // seed row
    drawText(ctx, t('seedCard.seed'), X, SEED_Y + 4, { color: soft });
    drawTumblingCode(ctx, code, X + 30, SEED_Y + 4, tumble, ms, { color: PALETTE.waxRed });
    drawWaxButton(ctx, t('seedCard.reroll'), rerollRect, { focused: row === 1 && col === 0, emblem: 'star' });
    drawWaxButton(ctx, t('seedCard.typeSeed'), typeRect, { focused: row === 1 && col === 1, emblem: 'dot' });
    // challenge seals
    challengeList().forEach((c, i) => {
      const r = sealRect(i);
      drawChallengeSeal(ctx, r.x, r.y, c.id, seals.includes(c.id), { focused: row === 2 && col === i, pop: pressMs[c.id] ?? 0 });
    });
    const fc = row === 2 ? challengeList()[col] : null;
    if (fc) {
      const r = sealRect(col);
      drawText(ctx, t(`challenge.${fc.id}.name`), r.x + 16, r.y + 35, { color: ink, font: 'small', align: 'center' });
    } else {
      drawText(ctx, t('seedCard.seals'), X + 168, SEALS_Y + 4, { color: soft, font: 'small' });
    }
    if (!fc) {
      const list = seals.map((id) => t(`challenge.${id}.name`)).join(', ') || t('challenge.sealOff');
      drawText(ctx, list, X + 168, SEALS_Y + 13, { color: ink, font: 'small', maxWidth: 140 });
    }
    drawWaxButton(ctx, t('seedCard.begin'), beginRect, { focused: row === 3, emblem: 'arrow' });
    // cursor
    if (row === 1) drawCursor(ctx, (col === 0 ? rerollRect : typeRect).x - 1, SEED_Y + 4, ms);
    if (row === 3) drawCursor(ctx, beginRect.x - 1, beginRect.y + 4, ms);
    if (row === 0) { const r = pipRect(dialIds().indexOf(dial)); drawCursor(ctx, r.x - 2, r.y + 4, ms); }
    ctx.restore();
    // hints
    const hint = hintFor(G.input, {
      keyboard: '←→: turn the dial   ↑↓: move   Z: choose   X: back', // str
      gamepad: 'd-pad: move / turn   A: choose   B: back', // str
      touch: 'tap to focus, tap again to choose', // str
    });
    drawText(ctx, hint, X, 246, { color: PALETTE.paperShade, font: 'small' });
    if (slip) drawSlip(ctx, slip.text, slip.ms);
    if (entry) {
      ctx.globalAlpha = 0.55; ctx.fillStyle = PALETTE.nightInk; ctx.fillRect(0, 0, 480, 270); ctx.globalAlpha = 1;
      entry.draw(ctx);
    }
  }

  function drawSlip(ctx, text, sms) {
    const k = Math.min(1, sms / 83);
    const w = Math.min(300, measureText(text, { maxWidth: 280 }).w + 24);
    const x = 480 - Math.round(k * (w + 16));
    drawPanel(ctx, { x, y: 196, w, h: 28 }, 'notice');
    drawText(ctx, text, x + 12, 205, { color: COLORS.paper.ink, maxWidth: w - 24 });
  }

  function drawEnd(ctx) {
    drawDesk(ctx, ms);
    drawRunCard(ctx, G, CARD.x, CARD.y, { ms, stampMs });
    drawWaxButton(ctx, t('common.done'), doneRect, { focused: col === 0, emblem: 'arrow' });
    drawWaxButton(ctx, t('seedCard.export'), copyRect, { focused: col === 1, emblem: 'dot' });
    if (copyNote) drawText(ctx, copyNote, 240, 262, { color: PALETTE.paperShade, font: 'small', align: 'center' });
  }

  return {
    name: 'seedCard',
    opaque: true,
    enter(p = {}) {
      params = p;
      mode = p.mode === 'end' ? 'end' : 'new';
      ms = 0; leaving = false; slip = null; entry = null; copyNote = ''; pressMs = {};
      stampMs = p.stamp ? 0 : 300;
      if (mode === 'new') {
        const parts = decodeSeedCode(p.seedCode ?? G.world?.run?.seedCode ?? '');
        dial = DIALS.some((d) => d.id === p.dial) ? p.dial : DEFAULT_DIAL;
        seals = Array.isArray(p.challenges) ? p.challenges.slice() : [];
        code = parts ? encodeSeedCode({ dial: dial.toUpperCase(), seed: parts.seed, toggles: seals }) : randomSeedCode(dial.toUpperCase(), G.entropy, { toggles: seals });
        tumble = 1;
        row = 0; col = dialIds().indexOf(dial);
      } else {
        col = 0;
      }
    },
    exit() { closeEntry(); },
    update(dt) {
      ms += dt;
      if (tumble < 1) tumble = Math.min(1, tumble + dt / 400);
      if (slip) { slip.ms += dt; if (slip.ms > 2600) slip = null; }
      for (const k of Object.keys(pressMs)) { pressMs[k] -= dt; if (pressMs[k] <= 0) delete pressMs[k]; }
      if (stampMs < 300) stampMs += dt;
      if (entry) entry.update(dt);
    },
    handleInput(input) {
      if (leaving) return;
      if (entry) { entry.handle(input); return; }
      if (mode === 'end') handleEnd(input); else handleNew(input);
    },
    draw(ctx) { if (mode === 'end') drawEnd(ctx); else drawNew(ctx); },
    state: () => ({ mode, dial, code, seals: seals.slice(), row, col }),
    debugText: () => (mode === 'end'
      ? seedCardText(G.world, G.data)
      : [t('seedCard.heading'), `dial ${dial}`, `seed ${code}`, `seals ${seals.join(',') || '-'}`, `focus ${['dial', 'seed', 'seals', 'begin'][row]}:${col}`, entry ? entry.debugText() : '', slip ? slip.text : ''].filter(Boolean).join('\n')),
  };
}
