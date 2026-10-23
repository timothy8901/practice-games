/**
 * Title scene. [SCN-FLOW] — GDD-09 §3.1, GDD-00 §12 (0:00) and §13.
 *
 * The live harbor at the real hour (render/sky `drawShoreView`): the sky, the sea, the point with
 * the lighthouse dark, or relit with its beam when the newest save has `lit.calls`; the scaffold at
 * that save's stage, its lit porches along the shore and a comet smudge that is faint on a fresh
 * season and brighter by act. Over it the logo, three wax seals (Continue / New Game / Settings;
 * Resume autosave first after a crash), a summary card for the newest save beside Continue, the
 * seed code bottom right and the version above it. The `title` music cue comes from the director's
 * scene table.
 *
 * Continue loads the newest save and fades to the overworld; New Game irises to the Seed Card;
 * Settings pushes the settings panel. `cancel` does nothing (nothing is behind the title). Touch:
 * tap a seal to focus it, tap again to open; a mouse click opens at once.
 * @module scenes/title
 */
import { drawText, measureText } from '../core/font.js';
import { VERSION } from '../config.js';
import { t } from '../data/strings.js';
import { COLORS, PALETTE, TIMING } from '../ui/theme.js';
import { drawPanel } from '../ui/panel.js';
import { drawShoreView } from '../render/sky.js';
import { tide as tideAt } from '../state/selectors.js';
import { continueGame } from './boot.js';
import {
  drawWaxButton, drawCursor, tapRects, hoverRects, realMinute, reducedMotionOf, flowFade, litPorchCount, hintFor,
} from './flowKit.js';
import { drawCreatureIcon } from './menuKit.js';

/** Seal geometry (GDD-09 §3.1: three seals 96×16 at 16,186, 8 px apart). */
export const SEAL_RECTS = Object.freeze([0, 1, 2].map((i) => Object.freeze({ x: 16, y: 186 + i * 24, w: 96, h: 16 })));

/**
 * Human label for a save entry.
 * @param {object|null} entry  core/save SlotEntry
 * @param {() => number} [now]
 * @returns {string}
 */
export function describeSave(entry, now = Date.now) {
  if (!entry || entry.state !== 'ok') return '';
  const s = entry.summary ?? {};
  return [s.place, s.time, agoText(entry, now)].filter(Boolean).join(', ');
}

/**
 * "just now" / "5 min ago" / "3 h ago" for a save entry, or ''.
 * @param {object|null} entry
 * @param {() => number} [now]
 * @returns {string}
 */
export function agoText(entry, now = Date.now) {
  if (!entry || !entry.time) return '';
  const mins = Math.max(0, Math.round((now() - entry.time) / 60000));
  if (mins < 1) return t('title.save.justNow');
  if (mins < 60) return t('title.save.minutesAgo', { n: mins });
  return t('title.save.hoursAgo', { n: Math.round(mins / 60) });
}

/**
 * What the title shows of a save world (pure): lighthouse, porches, scaffold, comet.
 * @param {any|null} world   the newest save's world, or null
 * @param {any} data
 * @returns {{lit: boolean, porches: number, stage: number, comet: number, day: number}}
 */
export function harborOf(world, data) {
  if (!world) return { lit: false, porches: 7, stage: 0, comet: 0.06, day: 1 };
  const day = Math.max(1, Math.floor((world.clock?.total ?? 0) / 1440) + 1);
  return {
    lit: world.flags?.['lit.calls'] === true,
    porches: litPorchCount(world, data),
    stage: Math.max(0, Math.min(7, world.loans?.scaffold ?? 0)),
    comet: Math.max(0.06, Math.min(1, day / 14)),
    day,
  };
}

/**
 * @param {object} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string}}
 */
export function createTitleScene(G) {
  let latest = null;
  let crashed = false;
  let saveWorld = null;
  let harbor = harborOf(null, null);
  let error = '';
  let ms = 0;
  let index = 0;
  let items = [];
  let leaving = false;
  const hover = { x: NaN, y: NaN };

  function canContinue() { return Boolean(latest && latest.state === 'ok'); }

  function buildItems() {
    const out = [];
    if (crashed && canContinue()) out.push({ id: 'resume', label: t('title.resume') });
    else out.push({ id: 'continue', label: t('title.continue'), disabled: !canContinue() });
    out.push({ id: 'new', label: t('title.newGame') });
    out.push({ id: 'settings', label: t('title.settings') });
    items = out;
  }

  function readSave() {
    latest = null; saveWorld = null;
    try { latest = typeof G.persist?.latest === 'function' ? G.persist.latest() : null; } catch { latest = null; }
    if (canContinue()) {
      try {
        const res = G.persist.load(latest.slot);
        if (res && res.ok) saveWorld = res.world;
      } catch { saveWorld = null; }
    }
    harbor = harborOf(saveWorld, G.data);
  }

  function sfx(kind) { try { G.bus?.emit?.(`ui:${kind}`, {}); } catch { /* never break the title */ } }

  function move(dir) {
    const n = items.length;
    let i = index;
    for (let k = 0; k < n; k++) {
      i = (i + dir + n) % n;
      if (!items[i].disabled) break;
    }
    if (i !== index) { index = i; error = ''; sfx('cursor'); }
  }

  function activate(i) {
    const it = items[i];
    if (!it || leaving) return;
    if (it.disabled) { error = t('title.noSave'); sfx('blocked'); return; }
    error = '';
    if (it.id === 'resume' || it.id === 'continue') {
      sfx('confirm');
      const res = continueGame(G, latest.slot);
      if (!res.ok) { error = t('title.loadFailed', { code: res.error?.code ?? res.error?.message ?? '?' }); sfx('error'); return; }
      leaving = true;
      return;
    }
    if (it.id === 'new') {
      sfx('confirm');
      leaving = true;
      G.scenes.transition('iris', flowFade(G), () => G.replaceWith('seedCard', { seedCode: G.world.run.seedCode }), { color: COLORS.night.ink });
      return;
    }
    if (it.id === 'settings') { sfx('confirm'); G.push('settings', { from: 'title' }); }
  }

  function enterState(params) {
    crashed = Boolean(params.crashed);
    readSave();
    buildItems();
    index = items.findIndex((it) => (it.id === 'resume' || it.id === 'continue') && !it.disabled);
    if (index < 0) index = items.findIndex((it) => it.id === 'new');
    error = '';
    leaving = false;
  }

  function seedShown() {
    const it = items[index];
    if (it && (it.id === 'continue' || it.id === 'resume') && latest?.summary?.seedCode) return latest.summary.seedCode;
    return G.world?.run?.seedCode ?? '';
  }

  function placeName(id) {
    try { return G.data?.tryGet?.('maps', id)?.name ?? id; } catch { return id; }
  }

  function drawLogo(ctx) {
    const a = Math.min(1, ms / 900);
    const title = t('game.title').toUpperCase();
    const y = 40 + Math.round((1 - a) * 6);
    // a soft ink plate under the logo so it reads over a bright noon sky as well as the night
    ctx.globalAlpha = 0.28 * a;
    ctx.fillStyle = PALETTE.nightInk;
    const w = measureText(title, { scale: 4 }).w + 36;
    ctx.fillRect(240 - w / 2, y - 6, w, 54);
    ctx.fillRect(240 - w / 2 + 2, y - 8, w - 4, 58);
    ctx.globalAlpha = 1;
    drawText(ctx, title, 240, y, { color: PALETTE.paperLightest, align: 'center', scale: 4, shadow: { color: PALETTE.nightInk, dx: 1, dy: 1 }, alpha: a });
    drawText(ctx, t('game.subtitle'), 240, y + 36, { color: PALETTE.porchAmber, align: 'center', font: 'small', shadow: { color: PALETTE.nightInk, dx: 1, dy: 1 }, alpha: a });
  }

  function drawSummary(ctx) {
    const it = items[index];
    const r = { x: 124, y: 180, w: 220, h: 50 };
    if (!canContinue()) {
      drawText(ctx, t('title.noSave'), r.x + 4, SEAL_RECTS[0].y + 4, { color: PALETTE.paperLightest, shadow: { color: PALETTE.nightInk, dx: 1, dy: 1 } });
      return;
    }
    if (!it || (it.id !== 'continue' && it.id !== 'resume')) return;
    const s = latest.summary ?? {};
    drawPanel(ctx, r, 'card');
    const ink = COLORS.paper.ink, soft = COLORS.paper.inkSoft;
    let x = r.x + 8;
    const lead = saveWorld?.party?.[0];
    if (lead) {
      try { drawCreatureIcon(ctx, G, lead, r.x + r.w - 26, r.y + 8); } catch { /* art may be missing */ }
    }
    drawText(ctx, s.name || '—', x, r.y + 6, { color: ink });
    drawText(ctx, t('title.save.summary', { place: placeName(s.place), day: s.day ?? 1, time: s.time ?? '' }), x, r.y + 18, { color: soft, maxWidth: r.w - 40 });
    const seals = `${t('seedCard.badges', { n: s.badges ?? 0 })}   Loan ${Math.min(7, s.tier ?? 1)} of 7`; // str
    drawText(ctx, seals, x, r.y + 29, { color: soft, font: 'small' });
    drawText(ctx, agoText(latest), x, r.y + 39, { color: COLORS.wax.fill, font: 'small' });
    if (lead?.nickname) drawText(ctx, lead.nickname, r.x + r.w - 18, r.y + 27, { color: soft, font: 'small', align: 'center' });
    if (crashed && saveWorld?.battleBookmark) drawText(ctx, t('title.rollback', { n: 1 }), 16, 244, { color: PALETTE.porchAmber, font: 'small' });
  }

  return {
    name: 'title',
    opaque: true,
    enter(params = {}) {
      ms = 0;
      enterState(params);
    },
    resume() {
      readSave();
      const keep = items[index]?.id;
      buildItems();
      const i = items.findIndex((it) => it.id === keep);
      index = i >= 0 ? i : index;
    },
    update(dt) { ms += dt; },
    handleInput(input) {
      if (leaving) return;
      const rects = SEAL_RECTS.slice(0, items.length);
      const h = hoverRects(input, rects, hover);
      if (h >= 0 && h !== index && !items[h].disabled) { index = h; sfx('cursor'); }
      const tap = tapRects(input, rects, index);
      if (tap) {
        if (tap.index !== index) { if (!items[tap.index].disabled) { index = tap.index; sfx('cursor'); } }
        if (tap.activate) activate(tap.index);
        return;
      }
      const rep = (a) => input.repeat(a, { delay: TIMING.repeatDelayMs, rate: TIMING.repeatRateMs });
      if (rep('up')) move(-1);
      else if (rep('down')) move(1);
      if (input.pressed('confirm') || input.pressed('start')) activate(index);
    },
    draw(ctx) {
      const minute = realMinute();
      const world = saveWorld ?? G.world;
      let tide = 0.5;
      try { tide = tideAt(world, Math.floor((world.clock?.total ?? 0) / 1440) * 1440 + Math.floor(minute)); } catch { tide = 0.5; }
      drawShoreView(ctx, { x: 0, y: 0, w: 480, h: 270 }, {
        minute,
        weather: 'clear',
        ms,
        day: harbor.day,
        tide,
        comet: harbor.comet,
        lighthouse: { stage: harbor.stage, lit: harbor.lit },
        porches: harbor.porches,
        reducedMotion: reducedMotionOf(G),
      });
      drawLogo(ctx);
      // seals slide in from the left, staggered 6 f
      items.forEach((it, i) => {
        const r = SEAL_RECTS[i];
        const k = Math.max(0, Math.min(1, (ms - 500 - i * 100) / 160));
        const x = r.x - Math.round((1 - k) * 24);
        if (k <= 0) return;
        ctx.globalAlpha = k;
        drawWaxButton(ctx, it.label, { ...r, x }, { focused: i === index, disabled: it.disabled, ms, dark: true, emblem: it.id === 'new' ? 'star' : it.id === 'settings' ? 'dot' : 'arrow' });
        ctx.globalAlpha = 1;
      });
      if (ms > 700) {
        const r = SEAL_RECTS[index];
        if (r) drawCursor(ctx, r.x - 1, r.y + 4, ms, PALETTE.porchAmber);
        drawSummary(ctx);
      }
      if (error) drawText(ctx, error, 16, 256, { color: PALETTE.waxLight, maxWidth: 300, shadow: { color: PALETTE.nightInk, dx: 1, dy: 1 } });
      else {
        const hint = hintFor(G.input, { keyboard: t('title.hint.keyboard'), gamepad: t('title.hint.gamepad'), touch: t('title.hint.touch') });
        drawText(ctx, hint, 16, 258, { color: PALETTE.paperLightest, font: 'small', shadow: { color: PALETTE.nightInk, dx: 1, dy: 1 }, alpha: 0.85 });
      }
      drawText(ctx, t('game.version', { version: VERSION }), 472, 250, { color: PALETTE.paperLightest, align: 'right', font: 'small', shadow: { color: PALETTE.nightInk, dx: 1, dy: 1 }, alpha: 0.8 });
      drawText(ctx, t('title.seedCode', { code: seedShown() }), 472, 258, { color: PALETTE.paperLightest, align: 'right', font: 'small', shadow: { color: PALETTE.nightInk, dx: 1, dy: 1 } });
    },
    debugText: () => [t('game.title'), ...items.map((it, i) => `${i === index ? '>' : ' '} ${it.label}${it.disabled ? ' (no save)' : ''}`), describeSave(latest), `seed ${seedShown()}`, error].filter(Boolean).join('\n'),
  };
}
