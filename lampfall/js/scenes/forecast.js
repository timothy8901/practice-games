/**
 * Shift Forecast scene. [SCN-BATTLE] — GDD-00 §8 (Shift windows and odds), §13 (Shift Forecast),
 * §14 (the Shift flip); GDD-09 §3.19, §5; ARCHITECTURE §5.4.
 *
 * Drives `systems/forecast.js`:
 *  - header: the creature's portrait with its mark, nickname, Lv, "Window n of N", the dial, Bond
 *    pips, and "Lit coast: steadied" after the Relighting;
 *  - three cards Up / Side / Down: odds (scale-2 number + bar), the form (a silhouette on Freefall for
 *    unseen forms), types, stat-total delta, ability (a second press on a card shows its effect
 *    line; a hidden ability reads "?"), "Keeps n/4";
 *  - Accept / Reroll (cost : held Starsalt) / Anchor (cost : held stones, or the free Keeper's Anchor
 *    at night at home once `lit.keepersAnchor` is set), every refusal with its reason;
 *  - the flip: cards face-down 12 f, slide 60 f, the picked one turns 18 f, then a 90 f scramble
 *    resolving in rings outward from the mark (a 30 f dither fade under reduced motion); the first
 *    viewing plays in full, later ones may be skipped to the result with confirm;
 *  - a 0.5 s input lock on open that ignores held buttons; no timer anywhere;
 *  - deferral: with `deferrable`, cancel is "Later" (the window waits for the next Waystone or home).
 *
 * Params `{uid, deferrable?, atHome?, force?, onDone?, onClose?}` (onClose: called once after it pops); pops with `{outcome, result}` where outcome is
 * 'accepted' | 'anchored' | 'later' | 'closed'.
 * @module scenes/forecast
 */
import { drawText, measureText } from '../core/font.js';
import { COLORS, PALETTE, TYPE, TIMING, TYPE_CHIPS } from '../ui/theme.js';
import { drawPanel, drawDim } from '../ui/panel.js';
import { drawBar, drawPips, drawBadge, drawTypeChip } from '../ui/widgets.js';
import { createFocus } from '../ui/focus.js';
import { openConfirm } from '../ui/confirm.js';
import { drawIcon, drawSeal } from '../ui/icons.js';
import { t, confirmSpec } from '../data/strings.js';
import { drawCreature, creatureArt, creatureSprite } from '../art/creatures/index.js';
import { markAnchor } from '../art/heartmark.js';
import * as forecastSys from '../systems/forecast.js';
import * as exp from '../systems/exp.js';
import * as wallet from '../systems/wallet.js';
import * as flags from '../systems/flags.js';
import * as clockSys from '../systems/clockSys.js';
import { tuningFor } from '../systems/flow/battleFlow.js';
import { resolveBattleData } from './battleData.js';
import { THE_READING } from '../data/spires.js';
import { frames, FRAME_MS, FLIP_FRAMES, flipPhase, flipTotal, scrambleRings, scrambleShowsNew } from './battleAnims.js';

const W = 480;
const H = 270;
const MAGENTA = '#FF5BD6';
const DEEP = '#2B3A67';
const NIGHT = '#141B33';
const CREAM = '#F6F1E3';
const SOFT_D = '#94B0C2';
const INK_D = '#F4F4F4';
const L = Object.freeze({
  header: { x: 8, y: 8, w: 464, h: 44 },
  card: (i) => ({ x: 16 + i * 152, y: 60, w: 144, h: 148 }),
  keeps: { x: 8, y: 214, w: 464, h: 14 },
  action: (i) => ({ x: 16 + i * 152, y: 238, w: 144, h: 22 }),
  stage: { x: 168, y: 60, w: 144, h: 148 },
});
const DIR_GLYPH = Object.freeze({ up: '▲', side: '▶', down: '▼' });
const FLIP_SEEN_FLAG = 'sys.forecastFlipSeen';
const KEEPERS_ANCHOR_FLAG = 'sys.keepersAnchorNight';

/**
 * Whether the Relighting has steadied the Shift odds. `lit.*` are world FLAGS (flags.get reads
 * counters, which made this always false before).
 * @param {any} w
 * @returns {boolean}
 */
export function litSteadied(w) {
  return flags.hasFlag(w, 'lit.steadied');
}

/**
 * Whether the card flip has been seen once (it is then skippable). Written with flags.setFlag, so it
 * is read as a FLAG; flags.get read the counter of the same id and was always 0, so the flip could
 * never be skipped.
 * @param {any} w
 * @returns {boolean}
 */
export function flipSeen(w) {
  return flags.hasFlag(w, FLIP_SEEN_FLAG);
}

/** @param {string} ty @returns {string} */
const chipId = (ty) => String(ty || '').toLowerCase();

/** Flags the Reading's offer writes for the ending script to branch on (LF-02). */
export const READING_CHOICE_FLAG = 'np.keeper.reading-choice';
export const READING_RING_FLAG = 'np.keeper.reading-ring';
export const READING_REROLLS = 'np.keeper.reading-rerolls';

/**
 * The seventh window's three cards (spires.js THE_READING, phase 7 `next`), with the dial's steadied
 * odds; after `rerolls` Rerolls the cards come round with new faces from `rerollPool` (LF-02).
 * @param {string} dial @param {any} data @param {number} [rerolls]
 * @returns {Array<{dir: 'up'|'side'|'down', name: string, palette: string, types: string[], odds: number}>}
 */
export function readingOfferCards(dial, data, rerolls = 0) {
  const last = THE_READING.phases[THE_READING.phases.length - 1];
  const base = (last.next?.cards ?? []).map((k) => ({ dir: k.dir, aspect: k.aspect }));
  const pool = Array.isArray(last.rerollPool) ? last.rerollPool : [];
  const dirs = ['up', 'side', 'down'];
  const faces = rerolls > 0 && pool.length >= 3
    ? dirs.map((dir, i) => ({ dir, aspect: pool[(rerolls * 3 + i) % pool.length] }))
    : base;
  let row = null;
  try { row = data && data.tryGet ? data.tryGet('dials', dial) : null; } catch { row = null; }
  const odds = row?.shift?.steadied ?? { up: 40, side: 40, down: 20 };
  return faces.map((f) => ({ dir: f.dir, name: f.aspect.name, palette: f.aspect.palette, types: (f.aspect.typeQueue ?? []).filter((ty) => ty !== 'Star').slice(0, 2), odds: odds[f.dir] ?? 0 }));
}

/**
 * The card an Accept lands on: weighted by the odds, from one uniform draw.
 * @param {Array<{odds: number}>} cards @param {number} u in [0, 1)
 * @returns {number} index
 */
export function readingPick(cards, u) {
  const total = cards.reduce((a, c) => a + Math.max(0, c.odds), 0) || 1;
  let acc = 0;
  for (let i = 0; i < cards.length; i++) {
    acc += Math.max(0, cards[i].odds) / total;
    if (u < acc) return i;
  }
  return cards.length - 1;
}

/**
 * @param {any} G
 * @returns {import('../core/scene.js').Scene & Record<string, any>}
 */
export function createForecastScene(G) {
  /** @type {any} */ let params = null;
  /** @type {any} */ let data = null;
  /** @type {any} */ let opts = null;
  /** @type {any} */ let fc = null;          // the Forecast on screen
  /** @type {any} */ let creatureRec = null;
  /** 'cards' | 'busy' | 'flip' | 'reshuffle' | 'result' | 'error' | 'done' | 'reading' | 'readingFlip' | 'readingDone' */
  let mode = 'cards';
  let elapsed = 0;
  let lockMs = 0;
  let flipF = 0;
  let reshuffleF = 0;
  let flipSkippable = false;
  /** @type {any} */ let outcome = null;     // {kind, index, card, result, fromForm, toForm}
  let message = '';
  let error = '';
  const detail = [false, false, false];
  let popped = false;
  let noWindow = false;   // a script's Forecast with no open window: pops on the first update
  /** @type {null | {cards: any[], picked: number|null, f: number, rerolls: number}} the Reading's offer (`who: 'reading'`) */
  let reading = null;

  const focus = createFocus({ cols: 3, wrap: true, items: [] });
  focus.on('activate', (ev) => onActivate(ev.item));
  focus.on('cancel', () => onCancel());
  focus.on('change', () => sfx('blip'));
  focus.on('blocked', () => { try { G.audio?.sfx?.('blocked', { pitch: -5 }); } catch { /* audio locked */ } });

  const world = () => G.world;
  const reduced = () => !!world()?.settings?.reducedMotion;
  const instant = () => !!(world()?.settings?.skipAnims || G.flags?.noanim);
  /** UI sounds go through the bus (the sfx router mixes and rate-limits them); the rest straight to the engine. */
  const UI_SFX = { blip: 'ui:cursor', confirm: 'ui:confirm', cancel: 'ui:cancel' };
  const sfx = (name, o) => {
    try {
      if (UI_SFX[name] && !o) G.bus?.emit(UI_SFX[name], {});
      else G.audio?.sfx?.(name, o);
    } catch { /* audio locked */ }
  };

  // ------------------------------------------------------------------------------------------

  /** The night id (a night runs 18:00 to 06:00 and is named by the day it began on). */
  function nightId() {
    const w = world();
    const day = clockSys.gameDay(w);
    const m = clockSys.minuteOfDay(w);
    return m < 6 * 60 ? day - 1 : day;
  }

  function keepersAnchorFree() {
    const w = world();
    if (!params || !params.atHome) return false;
    if (!flags.hasFlag(w, 'lit.keepersAnchor')) return false;
    let night = false;
    try { night = clockSys.isNight(w); } catch { night = false; }
    if (!night) return false;
    return flags.get(w, KEEPERS_ANCHOR_FLAG) !== nightId();
  }

  function dialRules() {
    const dial = world().run.dial;
    let row = null;
    try { row = data.tryGet ? data.tryGet('dials', dial) : null; } catch { row = null; }
    if (!row) return null;
    return { ...(row.rules || {}), poolWeights: row.shift ? row.shift.poolWeights : undefined };
  }

  function buildOpts() {
    const w = world();
    return {
      tuning: tuningFor(data),
      dial: w.run.dial,
      steadied: litSteadied(w),
      freeAnchor: keepersAnchorFree(),
      rules: dialRules(),
      bus: G.bus,
    };
  }

  function findCreature() {
    const w = world();
    return w.party.find((c) => c.uid === params.uid) || w.box.find((c) => c.uid === params.uid) || null;
  }

  function roll() {
    creatureRec = findCreature();
    if (!creatureRec) throw new Error('That creature is not here.'); // str
    opts = buildOpts();
    fc = forecastSys.rollForecast(world(), creatureRec, data, opts);
    G.store.tx('forecast.seen', (w) => forecastSys.markSeen(w, fc, { bus: G.bus, data }));
    detail.fill(false);
    setItems();
  }

  function rerollReason() {
    if (fc.canReroll) return '';
    return fc.rerollReason === 'locked' ? t('forecast.rerollLocked') : t('forecast.noStarsalt');
  }

  function anchorReason() {
    if (fc.canAnchor) return '';
    if (fc.anchorReason === 'disabled') return t('forecast.anchorOff');
    if (fc.anchorReason === 'no-stones') return t('forecast.noStones');
    return 'No window is open right now.'; // str
  }

  function setItems() {
    const items = [0, 1, 2].map((i) => ({ id: `card${i}`, rect: L.card(i), enabled: !fc.cards[i].empty }));
    items.push({ id: 'accept', rect: L.action(0), enabled: true });
    items.push({ id: 'reroll', rect: L.action(1), enabled: !!fc.canReroll, reason: rerollReason() });
    items.push({ id: 'anchor', rect: L.action(2), enabled: !!fc.canAnchor, reason: anchorReason() });
    focus.setItems(items, { keepId: true });
    if (!focus.current() || !focus.current().id) focus.set(3);
  }

  // ------------------------------------------------------------------------------------------

  /** @param {any} p */
  function enter(p) {
    params = p || {};
    elapsed = 0;
    lockMs = TIMING.inputLockMs;
    mode = 'cards';
    outcome = null;
    message = '';
    error = '';
    popped = false;
    noWindow = false;
    reading = null;
    if (params.who === 'reading') { enterReading(); return; }
    try {
      data = resolveBattleData(G);
      // A script's Forecast (cutscene `forecast` op) only rolls into an open window: a replayed
      // script (a save that landed mid-cutscene) must never Shift the creature twice (FE-01).
      if (params.from === 'script' && !params.force && scriptWindowClosed()) { noWindow = true; mode = 'done'; return; }
      roll();
      focus.set(3);
    } catch (err) {
      error = String(err && err.message ? err.message : err);
      if (err && err.code === 'STILL_KNOT') error = t('shift.knot', { nick: findCreature()?.nickname ?? '' });
      mode = 'error';
    }
    try { G.input?.flush?.(); } catch { /* no input */ }
  }

  // ---- the Reading's offer (the ending script's `{op: 'forecast', who: 'reading'}`, LF-02) ----

  function enterReading() {
    try { data = resolveBattleData(G); } catch { data = G.data; }
    const rerolls = Number(flags.get(world(), READING_REROLLS)) || 0;
    reading = { cards: readingOfferCards(world().run.dial, data, rerolls), picked: null, f: 0, rerolls };
    mode = 'reading';
    focus.setItems(['accept', 'anchor', 'reroll'].map((id, i) => ({ id, rect: L.action(i), enabled: true })));
    focus.set(0);
    try { G.input?.flush?.(); } catch { /* no input */ }
  }

  function readingActivate(item) {
    if (mode !== 'reading' || !item || !reading) return;
    if (item.id === 'accept') {
      let u = 0.5;
      try { u = G.rngs.fresh(`reading:offer:${reading.rerolls}`).next(); } catch { u = 0.5; }
      reading.picked = readingPick(reading.cards, u);
      const card = reading.cards[reading.picked];
      G.store.tx('reading.accept', (w) => {
        flags.setFlag(w, READING_CHOICE_FLAG, 'accept', { bus: G.bus });
        flags.setFlag(w, READING_RING_FLAG, card.name, { bus: G.bus });
      });
      sfx('shiftFlip');
      reading.f = 0;
      message = t('battle.msg.readingLands', { name: card.name });
      mode = 'readingFlip';
      return;
    }
    sfx('confirm');
    G.store.tx(`reading.${item.id}`, (w) => {
      flags.setFlag(w, READING_CHOICE_FLAG, item.id, { bus: G.bus });
      if (item.id === 'reroll') flags.inc(w, READING_REROLLS, 1, { bus: G.bus });
    });
    close(item.id === 'anchor' ? 'anchored' : 'rerolled', { choice: item.id });
  }

  /** The Vagary (96 cells) shrunk into the card's 64 px window, tinted by the card's first type. */
  function drawReadingFace(ctx, card, x, y, dim) {
    let sprite = null;
    try { sprite = creatureSprite(THE_READING.species, { scale: 1 }); } catch { sprite = null; }
    if (!sprite || !sprite.canvas) return;
    const chip = card.types[0] ? TYPE_CHIPS[chipId(card.types[0])] : null;
    let tint = null;
    try { tint = chip ? creatureSprite(THE_READING.species, { scale: 1, silhouette: chip.color }) : null; } catch { tint = null; }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = dim ? 0.4 : 1;
    ctx.drawImage(sprite.canvas, 0, 0, sprite.w, sprite.h, x, y, 64, 64);
    if (tint && tint.canvas) { ctx.globalAlpha = (dim ? 0.4 : 1) * 0.4; ctx.drawImage(tint.canvas, 0, 0, tint.w, tint.h, x, y, 64, 64); }
    ctx.restore();
  }

  function drawReading(ctx) {
    const r = L.header;
    ctx.fillStyle = NIGHT;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    frame(ctx, r, '#5D275D');
    drawText(ctx, t('battle.msg.readingOffer'), r.x + r.w / 2, r.y + 8, { color: INK_D, align: 'center' });
    drawText(ctx, t('battle.msg.readingOfferSub'), r.x + r.w / 2, r.y + 22, { color: SOFT_D, font: 'small', align: 'center' });
    const flipping = mode === 'readingFlip' || mode === 'readingDone';
    for (let i = 0; i < 3; i++) {
      const card = reading.cards[i];
      const cr = L.card(i);
      const dim = flipping && i !== reading.picked && reading.f > 30;
      ctx.fillStyle = dim ? '#333C57' : CREAM;
      ctx.fillRect(cr.x, cr.y, cr.w, cr.h);
      frame(ctx, cr, flipping && i === reading.picked ? MAGENTA : COLORS.paper.edge);
      const ink = dim ? SOFT_D : COLORS.paper.ink;
      drawText(ctx, `${DIR_GLYPH[card.dir]} ${t(`forecast.${card.dir}`)}`, cr.x + 6, cr.y + 5, { color: ink });
      drawText(ctx, t('forecast.odds', { n: card.odds }), cr.x + 6, cr.y + 16, { color: ink, scale: 2 });
      drawBar(ctx, { x: cr.x + 6, y: cr.y + 33, w: cr.w - 12, h: 5, value: card.odds, max: 100, kind: 'glow' });
      drawReadingFace(ctx, card, cr.x + cr.w / 2 - 32, cr.y + 40, dim);
      drawText(ctx, card.name, cr.x + 6, cr.y + 107, { color: ink, maxWidth: cr.w - 12 });
      let cx = cr.x + 6;
      for (const ty of card.types) cx += drawTypeChip(ctx, chipId(ty), cx, cr.y + 131) + 2;
    }
    const labels = [t('forecast.accept'), t('forecast.anchor'), t('forecast.reroll')];
    for (let i = 0; i < 3; i++) {
      const ar = L.action(i);
      const focused = mode === 'reading' && focus.index === i;
      ctx.fillStyle = focused ? CREAM : '#E6DCC3';
      ctx.fillRect(ar.x, ar.y - (focused ? 1 : 0), ar.w, ar.h);
      frame(ctx, { x: ar.x, y: ar.y - (focused ? 1 : 0), w: ar.w, h: ar.h }, focused ? MAGENTA : '#5D275D');
      drawSeal(ctx, ar.x + 4, ar.y + 5 - (focused ? 1 : 0), { emblem: i === 0 ? 'check' : 'plus' });
      drawText(ctx, labels[i], ar.x + 20, ar.y + 7 - (focused ? 1 : 0), { color: COLORS.paper.ink });
      if (i > 0) drawText(ctx, t('battle.msg.readingFree'), ar.x + ar.w - 6, ar.y + 8 - (focused ? 1 : 0), { color: COLORS.paper.inkSoft, align: 'right', font: 'small' });
    }
    if (mode === 'readingDone' || (mode === 'readingFlip' && reading.f > 30)) drawMessage(ctx);
  }

  /** The script's creature has no open Shift window (all its window levels are resolved). */
  function scriptWindowClosed() {
    const c = findCreature();
    if (!c) return false;
    try { return exp.openWindows(c, data, { tuning: tuningFor(data) }).length === 0; } catch { return false; }
  }

  function close(kind, result) {
    if (popped) return;
    popped = true;
    mode = 'done';
    const r = { outcome: kind, result: result ?? null };
    if (G.scenes.top && G.scenes.top() === scene) G.scenes.pop(r);
    if (params && typeof params.onDone === 'function') params.onDone(r);
    // dayFlow's deferred-Forecast queue waits on onClose; without it Sleep and Waystones never finish.
    if (params && typeof params.onClose === 'function') params.onClose(r);
  }

  function onCancel() {
    if (mode !== 'cards') return;
    if (params.deferrable) {
      try { G.toasts?.show?.(t('forecast.deferred', { nick: creatureRec.nickname })); } catch { /* no toasts */ }
      close('later');
    }
  }

  function onActivate(item) {
    if (mode === 'reading') { readingActivate(item); return; }
    if (mode !== 'cards' || !item) return;
    if (item.id.startsWith('card')) {
      const i = Number(item.id.slice(4));
      detail[i] = !detail[i];
      sfx('blip');
      return;
    }
    if (item.id === 'accept') doAccept();
    else if (item.id === 'reroll') doReroll();
    else if (item.id === 'anchor') doAnchor();
  }

  function doAccept() {
    sfx('confirm');
    const fromForm = creatureRec.speciesId;
    const movesBefore = (creatureRec.moves || []).map((m) => m.id);
    const header = headerSnapshot();
    let r;
    try {
      r = G.store.tx('shift.accept', (w) => forecastSys.accept(w, creatureRec.uid, fc, data, { ...opts, heartmark: creatureRec.heartmark ?? undefined }));
    } catch (err) {
      message = String(err && err.message ? err.message : err);
      mode = 'result';
      return;
    }
    // a same-type hit the new form brought (creature.shiftTo, FE-06) is named on the result line
    const after = findCreature();
    const learned = after ? after.moves.map((m) => m.id).filter((id) => !movesBefore.includes(id)) : [];
    outcome = { kind: 'accepted', index: r.index, card: r.card, result: r.result, fromForm, toForm: r.result.to, header, learned };
    flipSkippable = flipSeen(world());
    G.store.tx('forecast.flipSeen', (w) => flags.setFlag(w, FLIP_SEEN_FLAG, true, { bus: G.bus }));
    flipF = 0;
    mode = instant() ? 'result' : 'flip';
    sfx('shiftFlip');
    if (mode === 'result') finishFlip();
  }

  function finishFlip() {
    mode = 'result';
    const name = creatureRec.nickname;
    const sp = data.tryGet ? data.tryGet('species', outcome.toForm) : null;
    message = t('shift.accepted', { nick: name, form: sp ? sp.name : outcome.toForm });
    for (const id of outcome.learned || []) {
      const mv = data.tryGet ? data.tryGet('moves', id) : null;
      message += ` ${t('battle.msg.learned', { target: name, move: mv ? mv.name : id })}`;
    }
  }

  function doReroll() {
    const spec = confirmSpec('reroll', { cost: fc.rerollCost });
    mode = 'busy';
    openConfirm(G, { body: spec.body, options: spec.options, defaultIndex: 0 }).then((i) => {
      mode = 'cards';
      if (i !== 1) return;
      const res = G.store.tx('shift.reroll', (w) => forecastSys.reroll(w, creatureRec.uid, fc, data, opts));
      if (!res.ok) { message = res.reason === 'locked' ? t('forecast.rerollLocked') : t('forecast.noStarsalt'); return; }
      fc = res.forecast;
      G.store.tx('forecast.seen', (w) => forecastSys.markSeen(w, fc, { bus: G.bus, data }));
      detail.fill(false);
      setItems();
      message = t('shift.rerolled', { cost: fc.rerollCost });
      reshuffleF = instant() ? 0 : FLIP_FRAMES.down * 2;
      sfx('shiftFlip');
    });
  }

  function doAnchor() {
    const free = !!opts.freeAnchor;
    const spec = confirmSpec('anchor', { nick: creatureRec.nickname });
    mode = 'busy';
    openConfirm(G, { body: free ? `${spec.body} (${t('forecast.anchorFree')})` : spec.body, options: spec.options, defaultIndex: 0 }).then((i) => {
      mode = 'cards';
      if (i !== 1) return;
      const res = G.store.tx('shift.anchor', (w) => {
        const r = forecastSys.anchor(w, creatureRec.uid, data, opts);
        if (r.ok && free) flags.set(w, KEEPERS_ANCHOR_FLAG, nightId(), { bus: G.bus });
        return r;
      });
      if (!res.ok) { message = anchorReason(); return; }
      outcome = { kind: 'anchored', result: res };
      message = t('shift.anchored', { nick: creatureRec.nickname });
      mode = 'result';
      flipF = 0;
    });
  }

  // ------------------------------------------------------------------------------------------

  /** @param {number} dt */
  function update(dt) {
    if (noWindow && !popped) { close('closed'); return; }
    elapsed += dt;
    if (reading && mode === 'readingFlip') {
      reading.f += dt / FRAME_MS;
      if (reading.f >= 60) mode = 'readingDone';
    }
    if (lockMs > 0) lockMs = Math.max(0, lockMs - dt);
    if (reshuffleF > 0) reshuffleF = Math.max(0, reshuffleF - dt / FRAME_MS);
    if (mode === 'flip') {
      flipF += dt / FRAME_MS;
      if (flipF >= flipTotal(reduced()) + FLIP_FRAMES.glint) finishFlip();
    } else if (mode === 'result') {
      flipF += dt / FRAME_MS;
    }
    focus.update(dt);
  }

  /** @param {any} input */
  function handleInput(input) {
    if (lockMs > 0) return; // the 0.5 s lock ignores held and new buttons alike
    const tap = input.pointer && input.pointer.justDown;
    if (mode === 'reading') { focus.handle(input); return; }
    if (mode === 'readingFlip') { if (input.pressed('confirm') || tap) mode = 'readingDone'; return; }
    if (mode === 'readingDone') {
      if (input.pressed('confirm') || input.pressed('cancel') || tap) {
        const card = reading.cards[reading.picked];
        close('accepted', { formId: card.name, ring: card.name, choice: 'accept' });
      }
      return;
    }
    if (mode === 'error') {
      if (input.pressed('confirm') || input.pressed('cancel') || tap) close('closed');
      return;
    }
    if (mode === 'flip') {
      if (flipSkippable && (input.pressed('confirm') || tap)) finishFlip();
      return;
    }
    if (mode === 'result') {
      if (input.pressed('confirm') || input.pressed('cancel') || tap) close(outcome ? outcome.kind : 'closed', outcome ? outcome.result : null);
      return;
    }
    if (mode === 'cards') focus.handle(input);
  }

  // ------------------------------------------------------------------------------------------
  // drawing
  // ------------------------------------------------------------------------------------------

  function frame(ctx, r, color) {
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, 1);
    ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1);
    ctx.fillRect(r.x, r.y, 1, r.h);
    ctx.fillRect(r.x + r.w - 1, r.y, 1, r.h);
  }

  /** @param {CanvasRenderingContext2D} ctx */
  function draw(ctx) {
    // deep-blue field with a magenta edge (the Forecast panel is one of the magenta uses)
    ctx.fillStyle = NIGHT;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = DEEP;
    ctx.fillRect(4, 4, W - 8, H - 8);
    frame(ctx, { x: 4, y: 4, w: W - 8, h: H - 8 }, MAGENTA);
    frame(ctx, { x: 6, y: 6, w: W - 12, h: H - 12 }, '#5D275D');
    if (noWindow) return;
    if (reading) { drawReading(ctx); return; }
    if (mode === 'error' || !fc) { drawError(ctx); return; }
    drawHeader(ctx);
    if (mode === 'flip' || (mode === 'result' && outcome && outcome.kind === 'accepted')) drawFlip(ctx);
    else drawCards(ctx);
    drawKeeps(ctx);
    drawActions(ctx);
    if (message && (mode === 'cards' || mode === 'result')) drawMessage(ctx);
    if (lockMs > 0) {
      ctx.fillStyle = MAGENTA;
      ctx.fillRect(16, 264, Math.round(448 * (lockMs / TIMING.inputLockMs)), 1);
    }
  }

  function drawError(ctx) {
    drawPanel(ctx, { x: 100, y: 90, w: 280, h: 80 }, 'dark', {});
    drawText(ctx, t('forecast.heading'), 116, 102, { color: INK_D });
    drawText(ctx, error, 116, 118, { color: SOFT_D, maxWidth: 248 });
    drawText(ctx, 'Z / X: close', 364, 156, { color: SOFT_D, font: 'small', align: 'right' }); // str
  }

  /** What the header shows; frozen at Accept so the flip never spoils its own reveal. */
  function headerSnapshot() {
    const c = creatureRec;
    const levels = exp.windowLevels(c, data, { tuning: opts.tuning });
    const open = exp.openWindows(c, data, { tuning: opts.tuning });
    const n = open.length ? levels.indexOf(open[0]) + 1 : Math.min(levels.length, (c.windowsUsed || []).length + 1);
    return { speciesId: c.speciesId, types: c.types.slice(), n, total: levels.length };
  }

  function drawHeader(ctx) {
    const r = L.header;
    ctx.fillStyle = NIGHT;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    frame(ctx, r, '#5D275D');
    const c = creatureRec;
    const resolved = mode === 'result' && outcome && outcome.kind === 'accepted';
    const shownHeader = outcome && outcome.header ? (resolved ? { ...outcome.header, speciesId: c.speciesId, types: c.types } : outcome.header) : headerSnapshot();
    const glint = resolved ? Math.max(0, 1 - flipF / FLIP_FRAMES.glint) : 0;
    drawCreature(ctx, shownHeader.speciesId, r.x + 6, r.y + 6, { scale: 1, types: shownHeader.types, mark: c.mark, star: c.starTouched, lit: !c.wild, glint });
    drawText(ctx, c.nickname, r.x + 44, r.y + 7, { color: INK_D });
    drawText(ctx, `Lv${c.level}`, r.x + 46 + measureText(c.nickname).w + 6, r.y + 7, { color: SOFT_D });
    drawText(ctx, t('forecast.window', { n: shownHeader.n, total: shownHeader.total }), r.x + 44, r.y + 19, { color: SOFT_D, font: 'small' });
    const dialRow = data.tryGet ? data.tryGet('dials', fc.dial) : null;
    drawText(ctx, t('forecast.dial', { dial: dialRow ? dialRow.name : fc.dial }), r.x + 44, r.y + 29, { color: MAGENTA, font: 'small' });
    drawText(ctx, t('forecast.heading'), r.x + r.w / 2, r.y + 7, { color: INK_D, align: 'center' });
    if (fc.steadied) drawText(ctx, t('forecast.litCoast'), r.x + r.w / 2, r.y + 19, { color: PALETTE.porchAmber, font: 'small', align: 'center' });
    if (fc.bondTilt > 0) drawText(ctx, `Bond tilts Up +${fc.bondTilt}`, r.x + r.w / 2, r.y + 29, { color: SOFT_D, font: 'small', align: 'center' }); // str
    drawPips(ctx, { x: r.x + r.w - 92, y: r.y + 8, n: c.bond || 0, max: 5, size: 5, gap: 2, label: t('forecast.bond'), dark: true, color: PALETTE.springBlossom });
    if (params.deferrable) drawText(ctx, `X: ${t('forecast.later')}`, r.x + r.w - 8, r.y + 30, { color: SOFT_D, font: 'small', align: 'right' });
  }

  /** Card face. */
  function drawCardFace(ctx, card, r, i, focused) {
    ctx.fillStyle = CREAM;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    frame(ctx, r, focused ? MAGENTA : COLORS.paper.edge);
    if (focused) frame(ctx, { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 }, MAGENTA);
    const ink = COLORS.paper.ink;
    const soft = COLORS.paper.inkSoft;
    drawText(ctx, `${DIR_GLYPH[card.dir]} ${t(`forecast.${card.dir}`)}`, r.x + 6, r.y + 5, { color: ink });
    if (card.isStarTouched) drawBadge(ctx, t('forecast.starTouched'), r.x + r.w - 78, r.y + 3, { style: 'unique', small: true });
    drawText(ctx, t('forecast.odds', { n: card.odds }), r.x + 6, r.y + 16, { color: ink, scale: 2 });
    drawBar(ctx, { x: r.x + 6, y: r.y + 33, w: r.w - 12, h: 5, value: card.odds, max: 100, kind: 'glow' });
    if (card.empty) {
      drawText(ctx, '—', r.x + r.w / 2, r.y + 70, { color: soft, align: 'center' });
      drawText(ctx, 'No form in this pool', r.x + r.w / 2, r.y + 84, { color: soft, align: 'center', font: 'small' }); // str
      return;
    }
    const sp = data.tryGet ? data.tryGet('species', card.formId) : null;
    const name = card.silhouette ? '???' : sp ? sp.name : card.formId;
    if (detail[i]) {
      // the ability's effect line, on a second press
      const ab = card.ability && data.tryGet ? data.tryGet('abilities', card.ability) : null;
      drawText(ctx, card.abilityHidden ? '?' : ab ? ab.name : (card.ability || '—'), r.x + 8, r.y + 44, { color: ink });
      drawText(ctx, card.abilityHidden ? 'Read this form to learn its ability.' : ab ? ab.text : '', r.x + 8, r.y + 56, { color: soft, maxWidth: r.w - 16 }); // str
      if (card.isWard && !card.abilityHidden) drawBadge(ctx, 'Ward', r.x + 8, r.y + 104, { style: 'ward', small: true }); // str
    } else {
      if (card.silhouette) drawCreature(ctx, card.formId, r.x + r.w / 2 - 32, r.y + 41, { scale: 2, silhouette: '#29366F', types: card.types });
      else drawCreature(ctx, card.formId, r.x + r.w / 2 - 32, r.y + 41, { scale: 2, types: card.types, mark: creatureRec.mark, star: card.isStarTouched, lit: true });
      if (card.silhouette) drawText(ctx, t('forecast.unseen'), r.x + r.w / 2, r.y + 72, { color: CREAM, align: 'center', font: 'small' });
    }
    drawText(ctx, name, r.x + 6, r.y + 107, { color: ink });
    let cx = r.x + 6;
    for (const ty of card.types) cx += drawTypeChip(ctx, card.silhouette ? '???' : chipId(ty), cx, r.y + 117) + 2;
    const d = card.statTotalDelta;
    const delta = d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : '• +0';
    drawText(ctx, `Stats ${delta}`, r.x + r.w - 6, r.y + 107, { color: d > 0 ? ink : soft, align: 'right', font: 'small' }); // str
    const ab = card.ability && data.tryGet ? data.tryGet('abilities', card.ability) : null;
    const abName = card.abilityHidden ? '?' : ab ? ab.name : (card.ability || '—');
    drawText(ctx, abName, r.x + r.w - 6, r.y + 119, { color: soft, align: 'right', font: 'small', maxWidth: 62 });
    drawText(ctx, `${t('forecast.keeps')} ${card.keepsMoves}/${card.movesTotal}`, r.x + 6, r.y + 133, { color: soft, font: 'small' });
    if (card.toMemory.length) drawText(ctx, `${card.toMemory.length} to Memory`, r.x + r.w - 6, r.y + 133, { color: soft, align: 'right', font: 'small' }); // str
  }

  /** Card back: deep blue, magenta four-point mark, a lattice. */
  function drawCardBack(ctx, r, highlight) {
    ctx.fillStyle = '#1E2A4D';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    frame(ctx, r, highlight ? MAGENTA : '#5D275D');
    if (r.w < 8) return;
    frame(ctx, { x: r.x + 3, y: r.y + 3, w: r.w - 6, h: r.h - 6 }, '#3B5DC9');
    // a lattice, like the light through skyglass
    ctx.fillStyle = '#29366F';
    for (let y = r.y + 6; y < r.y + r.h - 6; y++) {
      for (let x = r.x + 6; x < r.x + r.w - 6; x++) if ((x + y) % 8 === 0 || (x - y + 800) % 8 === 0) ctx.fillRect(x, y, 1, 1);
    }
    const cx = r.x + Math.floor(r.w / 2);
    const cy = r.y + Math.floor(r.h / 2);
    ctx.fillStyle = '#1E2A4D';
    ctx.fillRect(cx - 9, cy - 9, 19, 19);
    ctx.fillStyle = MAGENTA;
    for (let d = -7; d <= 7; d++) { ctx.fillRect(cx + d, cy, 1, 1); ctx.fillRect(cx, cy + d, 1, 1); }
    for (const [dx, dy] of [[3, 3], [-3, 3], [3, -3], [-3, -3]]) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    ctx.fillStyle = INK_D;
    ctx.fillRect(cx, cy, 1, 1);
  }

  function drawCards(ctx) {
    const shuffling = reshuffleF > 0;
    for (let i = 0; i < 3; i++) {
      const r = L.card(i);
      const focused = mode === 'cards' && focus.current()?.id === `card${i}`;
      if (shuffling) {
        const k = reshuffleF / (FLIP_FRAMES.down * 2);
        const w = Math.max(1, Math.round(r.w * Math.abs(k * 2 - 1)));
        const rr = { x: r.x + Math.round((r.w - w) / 2), y: r.y, w, h: r.h };
        if (k > 0.5) drawCardBack(ctx, rr, false);
        else { ctx.save(); ctx.beginPath(); ctx.rect(rr.x, rr.y, rr.w, rr.h); ctx.clip(); drawCardFace(ctx, fc.cards[i], r, i, false); ctx.restore(); }
      } else {
        drawCardFace(ctx, fc.cards[i], r, i, focused);
      }
    }
    if (mode === 'cards') focus.drawCursor(ctx, { style: 'dark', ring: false });
  }

  /** The flip: cards face-down 12 f, slide 60 f, the picked card turns 18 f, then the scramble 90 f. */
  function drawFlip(ctx) {
    const red = reduced();
    const total = flipTotal(red);
    const f = mode === 'result' ? total + 1 : Math.min(flipF, total);
    const ph = flipPhase(f, red);
    const picked = outcome.index;
    if (!red && (ph.phase === 'down' || ph.phase === 'slide' || ph.phase === 'turn')) {
      for (let i = 0; i < 3; i++) {
        const base = L.card(i);
        let x = base.x;
        if (ph.phase === 'slide') {
          // the cards weave past each other and settle back in place
          const s = Math.sin(ph.t * Math.PI * 2);
          x = base.x + Math.round(s * (i === 1 ? -40 : i === 0 ? 30 : 10) * Math.sin(ph.t * Math.PI));
        }
        const r = { ...base, x };
        if (ph.phase === 'down') {
          const w = Math.max(1, Math.round(r.w * Math.abs(1 - ph.t * 2)));
          const rr = { x: r.x + Math.round((r.w - w) / 2), y: r.y, w, h: r.h };
          if (ph.t < 0.5) { ctx.save(); ctx.beginPath(); ctx.rect(rr.x, rr.y, rr.w, rr.h); ctx.clip(); drawCardFace(ctx, fc.cards[i], r, i, false); ctx.restore(); }
          else drawCardBack(ctx, rr, false);
        } else if (ph.phase === 'turn' && i === picked) {
          const w = Math.max(1, Math.round(r.w * Math.abs(1 - ph.t * 2)));
          const rr = { x: r.x + Math.round((r.w - w) / 2), y: r.y - Math.round(Math.sin(ph.t * Math.PI) * 6), w, h: r.h };
          if (ph.t < 0.5) drawCardBack(ctx, rr, true);
          else { ctx.save(); ctx.beginPath(); ctx.rect(rr.x, rr.y, rr.w, rr.h); ctx.clip(); drawCardFace(ctx, fc.cards[i], { ...r, y: rr.y }, i, true); ctx.restore(); }
        } else {
          drawCardBack(ctx, r, false);
        }
      }
      return;
    }
    // the stage: the old form scrambles into the new one in rings outward from the mark
    drawPanel(ctx, L.stage, 'dark', {});
    frame(ctx, L.stage, MAGENTA);
    const scale = 3;
    const size = 32 * scale;
    const sx = L.stage.x + Math.floor((L.stage.w - size) / 2);
    const sy = L.stage.y + 12;
    const oldSprite = creatureSprite(outcome.fromForm, { scale, types: creatureRec.types });
    const newSprite = creatureSprite(outcome.toForm, { scale, types: creatureRec.types, star: creatureRec.starTouched });
    const art = creatureArt(outcome.toForm, { types: creatureRec.types });
    const mark = markAnchor(art, creatureRec.mark);
    const done = ph.phase === 'done';
    if (done) {
      ctx.drawImage(newSprite.canvas, sx, sy);
    } else if (ph.phase === 'dither') {
      // reduced motion: a dither fade from the old body to the new
      ctx.drawImage(oldSprite.canvas, sx, sy);
      const step = Math.floor(ph.t * 4);
      for (let by = 0; by < 32; by++) {
        for (let bx = 0; bx < 32; bx++) {
          const on = step >= 3 || (step === 2 && (bx + by) % 2 === 0) || (step === 1 && bx % 2 === 0 && by % 2 === 0);
          if (on) ctx.drawImage(newSprite.canvas, bx * scale, by * scale, scale, scale, sx + bx * scale, sy + by * scale, scale, scale);
        }
      }
    } else {
      const rings = scrambleRings(32, 32, mark, { block: 4, rings: 4 });
      for (let by = 0; by < rings.length; by++) {
        for (let bx = 0; bx < rings[by].length; bx++) {
          const useNew = scrambleShowsNew(rings[by][bx], ph.t, { bx, by });
          const src = useNew ? newSprite : oldSprite;
          const px = bx * 4 * scale;
          const py = by * 4 * scale;
          ctx.drawImage(src.canvas, px, py, 4 * scale, 4 * scale, sx + px, sy + py, 4 * scale, 4 * scale);
        }
      }
    }
    // the mark stays on the same spot, every shape
    const glint = done ? Math.max(0, 1 - (f - total) / FLIP_FRAMES.glint) : 0.5;
    drawCreatureMark(ctx, sx, sy, mark, scale, glint);
    const sp = data.tryGet ? data.tryGet('species', outcome.toForm) : null;
    if (done) {
      drawText(ctx, sp ? sp.name : outcome.toForm, L.stage.x + L.stage.w / 2, L.stage.y + L.stage.h - 22, { color: INK_D, align: 'center' });
      drawText(ctx, t('shift.sameMark'), L.stage.x + L.stage.w / 2, L.stage.y + L.stage.h - 11, { color: MAGENTA, align: 'center', font: 'small' });
    }
    // the picked card stays visible beside the stage
    const slot = picked === 1 ? 0 : picked;
    // once it has landed the form is Held: its card shows face up, silhouette or not
    const landed = done ? { ...fc.cards[picked], silhouette: false, abilityHidden: false } : fc.cards[picked];
    drawCardFace(ctx, landed, L.card(slot), picked, true);
  }

  function drawCreatureMark(ctx, sx, sy, at, scale, glint) {
    const cx = sx + at.x * scale + Math.floor(scale / 2);
    const cy = sy + at.y * scale + Math.floor(scale / 2);
    ctx.fillStyle = MAGENTA;
    for (let d = 1; d <= 3; d++) { ctx.fillRect(cx + d, cy, 1, 1); ctx.fillRect(cx - d, cy, 1, 1); ctx.fillRect(cx, cy + d, 1, 1); ctx.fillRect(cx, cy - d, 1, 1); }
    ctx.fillStyle = INK_D;
    ctx.fillRect(cx, cy, 1, 1);
    if (glint > 0 && !reduced()) {
      ctx.fillStyle = MAGENTA;
      for (const [dx, dy] of [[3, 3], [-3, 3], [3, -3], [-3, -3]]) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }

  function drawKeeps(ctx) {
    const r = L.keeps;
    drawText(ctx, t('forecast.keeps'), r.x + 8, r.y + 3, { color: MAGENTA, font: 'small' });
    drawText(ctx, t('forecast.keepsList'), r.x + 40, r.y + 3, { color: SOFT_D, font: 'small', maxWidth: r.w - 48 });
  }

  function drawActions(ctx) {
    const held = { starsalt: wallet.balance(world(), 'starsalt'), anchors: wallet.balance(world(), 'anchors') };
    const labels = [
      [t('forecast.accept'), ''],
      [t('forecast.reroll'), t('forecast.cost', { cost: fc.rerollCost, held: held.starsalt })],
      [t('forecast.anchor'), opts.freeAnchor ? 'free' : t('forecast.cost', { cost: fc.anchorCost, held: held.anchors })], // str
    ];
    const items = focus.items.slice(3);
    for (let i = 0; i < 3; i++) {
      const r = L.action(i);
      const item = items[i];
      const enabled = item ? item.enabled !== false : true;
      const focused = mode === 'cards' && focus.current() === item;
      ctx.fillStyle = 'rgba(20, 27, 51, 0.5)';
      ctx.fillRect(r.x + 1, r.y + 1, r.w, r.h);
      ctx.fillStyle = !enabled ? '#333C57' : focused ? CREAM : '#E6DCC3';
      ctx.fillRect(r.x, r.y - (focused ? 1 : 0), r.w, r.h);
      frame(ctx, { x: r.x, y: r.y - (focused ? 1 : 0), w: r.w, h: r.h }, focused ? MAGENTA : '#5D275D');
      if (enabled) drawSeal(ctx, r.x + 4, r.y + 5 - (focused ? 1 : 0), { emblem: i === 0 ? 'check' : 'plus' });
      else drawIcon(ctx, 'lock', r.x + 5, r.y + 7, { ink: SOFT_D });
      const ink = enabled ? COLORS.paper.ink : SOFT_D;
      drawText(ctx, labels[i][0], r.x + 20, r.y + 7 - (focused ? 1 : 0), { color: ink });
      if (labels[i][1]) drawText(ctx, labels[i][1], r.x + r.w - 6, r.y + 8 - (focused ? 1 : 0), { color: enabled ? COLORS.paper.inkSoft : SOFT_D, align: 'right', font: 'small' });
    }
    if (mode === 'cards' && focus.index >= 3) focus.drawCursor(ctx, { style: 'dark', ring: false });
  }

  function drawMessage(ctx) {
    const w = measureText(message, { maxWidth: 300 }).w + 20;
    const x = Math.round((W - w) / 2);
    const y = 211;
    drawPanel(ctx, { x, y, w, h: 18 + (measureText(message, { maxWidth: 300 }).h > 10 ? 10 : 0) }, 'notice', { torn: 'none' });
    drawText(ctx, message, x + 10, y + 5, { color: COLORS.paper.ink, maxWidth: 300 });
    if ((mode === 'result' || mode === 'readingDone') && Math.floor(elapsed / 500) % 2 === 0) drawText(ctx, TYPE.more, x + w - 10, y + 6, { color: PALETTE.waxRed });
  }

  function debugText() {
    if (mode === 'error') return `forecast error: ${error}`;
    if (reading) return `forecast ${mode} | reading ${reading.cards.map((c) => `${c.dir}:${c.name}@${c.odds}`).join(' ')} | picked ${reading.picked} | focus ${focus.current()?.id}`;
    if (!fc) return 'forecast';
    const cards = fc.cards.map((c) => `${c.dir}:${c.formId}@${c.odds}`).join(' ');
    return `forecast ${mode} | ${creatureRec.nickname} ${creatureRec.speciesId} | ${cards} | reroll ${fc.canReroll ? fc.rerollCost : fc.rerollReason} | anchor ${fc.canAnchor ? fc.anchorCost : fc.anchorReason} | focus ${focus.current()?.id} | ${message}`;
  }

  const scene = {
    name: 'forecast',
    opaque: true,
    enter,
    exit() {},
    pause() {},
    resume() {},
    update,
    handleInput,
    draw,
    isBusy: () => mode === 'flip' || lockMs > 0,
    debugText,
    get mode() { return mode; },
    get forecast() { return fc; },
    get outcome() { return outcome; },
  };
  return scene;
}
