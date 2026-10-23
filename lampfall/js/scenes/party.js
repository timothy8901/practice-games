/**
 * Party, Creature Summary and the Coverage view. [SCN-MENU] — GDD-00 §8/§13, GDD-09 §3.11-§3.12.
 *
 * **Party** (opaque, left): six rows of 38 px — head icon (greyed when resting), nickname, level, an
 * HP bar with numbers, a PP summary bar, types, the window pip (`✦ Shift pending` with the Heartmark,
 * or `Window at Lv8` one level before it), `Held by Still Knot`, and the curve gap in words.
 * `confirm` opens a mini menu: Summary, Swap, the held item (give / take back), Lead.
 *
 * **Coverage** (right): the twelve ordinary types with what the party's damaging moves reach against
 * each (shape + word: `+ Strong`, `• Neutral`, `– Weak`, `× Blocked`) and the gap in words
 * (`Gap: Hollow`). `l`/`r` (or a tap) move the cursor into it; a focused type lists who hits it
 * Strong and with what.
 *
 * **Summary**: the form at ×2 with the Heartmark in its spot, types, level and EXP, stats, moves with
 * PP, ability with its line, held item, Bond pips, the window preset (always ask / auto-Anchor /
 * auto-accept Up; `confirm` cycles), the Heartmark spot in words and the **Shiftlog strip** (every
 * form held, each with the mark in the same relative spot). A creature at its first Shift with no
 * Heartmark technique pins one here. `l`/`r` (and left/right) switch creatures.
 *
 * Params: `{summary?: string|number}` opens the Summary of that uid / index directly.
 * Every mutation goes through `store.tx` and a system (`systems/party`, `systems/bag`,
 * `systems/settings`); cancel only ever backs out.
 * @module scenes/party
 */
import { drawText, measureText } from '../core/font.js';
import { COLORS, PALETTE } from '../ui/theme.js';
import { createFocus } from '../ui/focus.js';
import { createList } from '../ui/list.js';
import { drawBar, drawPips, drawTypeChip, drawBadge } from '../ui/widgets.js';
import { drawIcon } from '../ui/icons.js';
import { openConfirm } from '../ui/confirm.js';
import { t } from '../data/strings.js';
import * as partySys from '../systems/party.js';
import * as bagSys from '../systems/bag.js';
import * as settingsSys from '../systems/settings.js';
import * as exp from '../systems/exp.js';
import * as creatureSys from '../systems/creature.js';
import { curveLevel } from '../state/selectors.js';
import { TUNING } from '../data/tuning.js';
import {
  lookOf, curveGap, curveGapText, ppSummary, typesOf, chipId, coverage, gapText, listWords, heartmarkSpot,
  presetLabel, nextPreset, PRESETS,
} from './menuModel.js';
import {
  prefsOf, skinOf, drawSkinPanel, drawCard, drawBackdrop, drawHeading, drawHints, drawCreature, drawCreatureIcon,
  drawHeartmark, drawGlyph, itemGlyph, drawCursorAt, drawBody, createSlide, sfx, toast, sysCtx, MAGENTA,
} from './menuKit.js';

/** Row geometry (GDD-09 §3.11). */
const ROWS = Object.freeze({ x: 8, y: 16, w: 280, rowH: 38 });
const COV = Object.freeze({ x: 296, y: 16, w: 176, h: 236 });
const STAT_ORDER = Object.freeze(['hp', 'atk', 'def', 'spa', 'spd', 'spe']);
const GRADE_GLYPH = Object.freeze({ strong: '+', neutral: '•', weak: '–', blocked: '×', none: '?' });
const GRADE_WORD = Object.freeze({ strong: 'Strong', neutral: 'Neutral', weak: 'Weak', blocked: 'Blocked', none: '???' });

/**
 * @param {any} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string}}
 */
export function createPartyScene(G) {
  /** @type {'list'|'coverage'|'mini'|'swap'|'held'|'summary'} */
  let mode = 'list';
  let ms = 0;
  let summaryIndex = 0;
  let glintMs = 0;
  let swapFrom = -1;
  /** @type {{i: number, j: number, t: number}|null} */
  let swapAnim = null;
  let busy = false;
  /** Where the held-item picker returns to. @type {'list'|'summary'} */
  let heldFrom = 'list';
  const slide = createSlide({ dx: 12 });

  const rowFocus = createFocus({ cols: 1, wrap: true, items: [] });
  const covFocus = createFocus({ cols: 2, wrap: true, items: [] });
  const miniFocus = createFocus({ cols: 1, wrap: true, items: [] });
  const sumFocus = createFocus({ cols: 1, wrap: true, items: [] });
  /** @type {Array<{id: string, label: string, enabled: boolean, reason?: string}>} */
  let miniItems = [];
  /** @type {ReturnType<typeof coverage>|null} */
  let cov = null;

  const heldList = createList({
    rect: { x: 156, y: 92, w: 168, h: 112 }, rowH: 12, items: [],
    onSelect: (item) => giveHeld(item),
    onCancel: () => { mode = heldFrom; sfx(G, 'cancel'); },
  });

  const party = () => G.world?.party ?? [];
  const data = () => G.data ?? null;
  const look = () => lookOf(data());
  const ctxOpts = () => ({ ...sysCtx(G) });

  // ---------------------------------------------------------------------------------- layout --
  function rowRect(i) {
    return { x: ROWS.x, y: ROWS.y + i * ROWS.rowH, w: ROWS.w, h: ROWS.rowH - 3 };
  }

  let lastSig = '';
  /** Cheap fingerprint of what the rows and Coverage depend on (relayout only when it changes). */
  function signature() {
    return party().map((c) => `${c.uid}:${c.hp}:${c.level}:${c.speciesId}:${c.heldItem}:${(c.moves ?? []).map((m) => m.id).join(',')}`).join('|');
  }

  function relayout() {
    lastSig = signature();
    const p = party();
    rowFocus.setItems(p.map((c, i) => ({ id: c.uid, rect: rowRect(i), enabled: true })));
    cov = coverage(p, data());
    covFocus.setItems(cov.rows.map((r, i) => ({ id: r.type, rect: covCell(i), enabled: true })));
    if (summaryIndex >= p.length) summaryIndex = Math.max(0, p.length - 1);
  }

  function covCell(i) {
    const col = i % 2, row = Math.floor(i / 2);
    return { x: COV.x + 6 + col * 83, y: COV.y + 30 + row * 20, w: 81, h: 18 };
  }

  // ------------------------------------------------------------------------------ mini menu --
  function openMini(i) {
    const c = party()[i];
    if (!c) return;
    const held = c.heldItem ? (look().itemOrNull(c.heldItem)?.name ?? c.heldItem) : null;
    miniItems = [
      { id: 'summary', label: t('party.summary'), enabled: true },
      { id: 'swap', label: t('party.swap'), enabled: party().length > 1, reason: 'Only one in the party.' }, // str
      held
        ? { id: 'take', label: `Take ${held}`, enabled: true } // str
        : { id: 'give', label: 'Give an item', enabled: heldChoices().length > 0, reason: 'Nothing in the satchel to hold.' }, // str
      { id: 'lead', label: t('party.lead'), enabled: i > 0, reason: 'Already leading.' }, // str
    ];
    const r = rowRect(i);
    const my = Math.min(270 - 12 - miniItems.length * 13, r.y + 4);
    miniFocus.setItems(miniItems.map((it, k) => ({ id: it.id, rect: { x: 172, y: my + 6 + k * 13, w: 104, h: 13 }, enabled: it.enabled, reason: it.reason })), { keepId: false });
    miniFocus.set(0, { force: true });
    mode = 'mini';
    sfx(G, 'confirm');
  }

  function doMini(id) {
    const i = rowFocus.index;
    const c = party()[i];
    if (!c) return;
    if (id === 'summary') { openSummary(i); return; }
    if (id === 'swap') { swapFrom = i; mode = 'swap'; sfx(G, 'confirm'); return; }
    if (id === 'lead') { doSwap(i, 0); rowFocus.set(0); mode = 'list'; return; }
    if (id === 'take') { takeHeld(c); mode = 'list'; return; }
    if (id === 'give') {
      heldFrom = 'list';
      heldList.setItems(heldChoices());
      heldList.select(0);
      mode = 'held';
      sfx(G, 'confirm');
    }
  }

  function doSwap(i, j) {
    if (i === j) return;
    const r = G.store.tx('party:swap', (w) => partySys.swap(w, i, j, { bus: G.bus }));
    if (r?.ok) {
      swapAnim = prefsOf(G).reduced ? null : { i, j, t: 0 };
      sfx(G, 'confirm');
      relayout();
    } else sfx(G, 'blocked');
  }

  // ---------------------------------------------------------------------------- held items --
  function heldChoices() {
    const w = G.world;
    if (!w?.bag?.pockets) return [];
    const L = look();
    const out = [];
    for (const pocket of ['held', 'keepsakes']) {
      for (const s of bagSys.pocketList(w, pocket)) {
        const row = L.itemOrNull(s.id);
        if (!row || row.use !== 'hold') continue;
        out.push({ id: s.id, label: row.name ?? s.id, value: t('bag.count', { n: s.n }), marker: pocket === 'keepsakes' ? '★' : undefined, data: { row, pocket } });
      }
    }
    return out;
  }

  async function giveHeld(item) {
    const c = party()[rowFocus.index];
    if (!c || !item || busy) return;
    const row = item.data?.row;
    const keepsake = item.data?.pocket === 'keepsakes' || row?.oneOfAKind === true;
    if (keepsake) {
      busy = true;
      const spec = { body: t('confirm.oneOfAKind', { item: row?.name ?? item.id }), options: [t('confirm.option.keep'), 'Give it'], defaultIndex: 0 }; // str
      const pick = await openConfirm(G, spec);
      busy = false;
      if (pick !== 1) { sfx(G, 'cancel'); return; }
    }
    const ctx = ctxOpts();
    const res = G.store.tx('party:give-held', (w) => {
      const took = bagSys.take(w, item.id, 1, { ...ctx, confirm: true, source: 'hold' });
      if (!took.ok) return { ok: false };
      const prev = c.heldItem;
      partySys.setHeldItem(w, c.uid, item.id, ctx.data, { bus: G.bus });
      if (prev) bagSys.give(w, prev, 1, { ...ctx, source: 'unhold' });
      return { ok: true, prev };
    });
    if (res.ok) {
      sfx(G, 'confirm');
      toast(G, `${c.nickname} is holding the ${row?.name ?? item.id}.`); // str
      mode = heldFrom;
    } else sfx(G, 'error');
  }

  function takeHeld(c) {
    const ctx = ctxOpts();
    const id = c.heldItem;
    if (!id) return;
    const name = look().itemOrNull(id)?.name ?? id;
    G.store.tx('party:take-held', (w) => {
      partySys.setHeldItem(w, c.uid, null, ctx.data, { bus: G.bus });
      bagSys.give(w, id, 1, { ...ctx, source: 'unhold' });
    });
    sfx(G, 'confirm');
    toast(G, `The ${name} is back in the satchel.`); // str
  }

  // -------------------------------------------------------------------------------- summary --
  function openSummary(i) {
    summaryIndex = Math.max(0, Math.min(party().length - 1, i));
    mode = 'summary';
    glintMs = 500;
    layoutSummary(true);
    sfx(G, 'confirm');
  }

  function canPin(c) {
    if (!c || c.heartmark) return false;
    const firstShift = (c.shiftlog?.length ?? 1) > 1 || (G.world?.pendingShifts ?? []).includes(c.uid);
    return firstShift;
  }

  function layoutSummary(reset) {
    const c = party()[summaryIndex];
    if (!c) return;
    const items = (c.moves ?? []).map((m, k) => ({ id: `move:${k}`, rect: { x: 280, y: 16 + k * 16, w: 192, h: 15 }, enabled: true }));
    items.push({ id: 'preset', rect: { x: 280, y: 110, w: 192, h: 13 }, enabled: true });
    items.push({ id: 'held', rect: { x: 96, y: 124, w: 176, h: 13 }, enabled: true });
    sumFocus.setItems(items, { keepId: !reset });
    if (reset) sumFocus.set(0, { force: true });
  }

  function switchCreature(dir) {
    const n = party().length;
    if (n < 2) { sfx(G, 'blocked'); return; }
    summaryIndex = (summaryIndex + dir + n) % n;
    glintMs = 500;
    layoutSummary(false);
    sfx(G, 'cursor');
  }

  async function activateSummary(id) {
    const c = party()[summaryIndex];
    if (!c || busy) return;
    if (id === 'preset') {
      const cur = G.world.settings?.autoAnchor?.[c.uid] ?? null;
      const next = nextPreset(cur, 1);
      G.store.tx('settings:preset', (w) => settingsSys.setAutoAnchor(w, c.uid, next, { bus: G.bus }));
      sfx(G, 'confirm');
      return;
    }
    if (id === 'held') {
      rowFocus.set(summaryIndex);
      if (c.heldItem) { takeHeld(c); return; }
      const choices = heldChoices();
      if (!choices.length) { sfx(G, 'blocked'); toast(G, 'Nothing in the satchel to hold.'); return; } // str
      heldFrom = 'summary';
      heldList.setItems(choices);
      heldList.select(0);
      mode = 'held';
      sfx(G, 'confirm');
      return;
    }
    if (id.startsWith('move:') && canPin(c)) {
      const k = Number(id.slice(5));
      const m = c.moves[k];
      if (!m) return;
      const name = look().moveOrNull(m.id)?.name ?? m.id;
      busy = true;
      const pick = await openConfirm(G, { body: `Pin ${name} as ${c.nickname}'s Heartmark technique? It stays through every Shift.`, options: [t('confirm.no'), 'Pin it'], defaultIndex: 0 }); // str
      busy = false;
      if (pick !== 1) { sfx(G, 'cancel'); return; }
      const r = G.store.tx('party:pin', (w) => partySys.pinHeartmark(w, c.uid, m.id, data(), { bus: G.bus }));
      if (r?.ok) { glintMs = 500; sfx(G, 'confirm'); toast(G, `${name} is ${c.nickname}'s Heartmark technique.`); } // str
      else sfx(G, 'error');
      return;
    }
    sfx(G, 'blocked');
  }

  // ---------------------------------------------------------------------------- focus wiring --
  rowFocus.on('change', () => sfx(G, 'cursor'));
  rowFocus.on('activate', (ev) => {
    if (mode === 'swap') {
      if (ev.index === swapFrom) { mode = 'list'; sfx(G, 'cancel'); return; }
      doSwap(swapFrom, ev.index);
      mode = 'list';
      return;
    }
    openMini(ev.index);
  });
  rowFocus.on('cancel', () => {
    if (mode === 'swap') { mode = 'list'; sfx(G, 'cancel'); return; }
    leave();
  });
  covFocus.on('change', () => sfx(G, 'cursor'));
  covFocus.on('cancel', () => { mode = 'list'; sfx(G, 'cancel'); });
  covFocus.on('activate', () => sfx(G, 'cursor'));
  miniFocus.on('change', () => sfx(G, 'cursor'));
  miniFocus.on('activate', (ev) => doMini(miniItems[ev.index]?.id));
  miniFocus.on('cancel', () => { mode = 'list'; sfx(G, 'cancel'); });
  miniFocus.on('blocked', () => sfx(G, 'blocked'));
  sumFocus.on('change', () => sfx(G, 'cursor'));
  sumFocus.on('activate', (ev) => { activateSummary(sumFocus.items[ev.index]?.id ?? ''); });
  sumFocus.on('cancel', () => {
    mode = 'list';
    rowFocus.set(summaryIndex);
    sfx(G, 'cancel');
  });

  function leave() {
    sfx(G, 'cancel');
    if (G.scenes.top() === scene) G.scenes.pop();
  }

  // --------------------------------------------------------------------------------- drawing --
  function drawRow(ctx, skin, c, i, yOff) {
    const r = rowRect(i);
    const y = r.y + yOff;
    const focused = (mode === 'list' || mode === 'swap' || mode === 'mini' || mode === 'held') && rowFocus.index === i;
    const lifted = mode === 'swap' && swapFrom === i;
    const resting = (c.hp | 0) <= 0;
    drawCard(ctx, { x: r.x, y, w: r.w, h: r.h }, skin, { focused, lifted, dim: resting });
    if (lifted) drawText(ctx, 'Swapping', r.x + r.w - 6, y + 4, { font: 'small', color: skin.accent, align: 'right' }); // str
    // icon plate
    ctx.fillStyle = skin.dark ? '#222B4D' : COLORS.paper.shade;
    ctx.fillRect(r.x + 5, y + 5, 20, 20);
    drawCreatureIcon(ctx, G, c, r.x + 7, y + 7, { grey: resting });
    // name + level
    const nameX = r.x + 30;
    drawText(ctx, c.nickname, nameX, y + 4, { color: resting ? skin.faint : skin.text, maxWidth: 82 });
    drawText(ctx, t('common.level', { level: c.level }), r.x + 148, y + 4, { color: skin.soft, align: 'right' });
    // HP
    const maxHp = c.stats?.hp ?? 0;
    drawText(ctx, 'HP', nameX, y + 16, { font: 'small', color: skin.soft });
    drawBar(ctx, { x: nameX + 10, y: y + 15, w: 56, h: 5, value: c.hp, max: maxHp, kind: 'hp', dark: skin.dark });
    drawText(ctx, `${c.hp}/${maxHp}`, nameX + 70, y + 16, { font: 'small', color: skin.text });
    // PP
    const pp = ppSummary(c);
    drawText(ctx, 'PP', nameX, y + 25, { font: 'small', color: pp.empty ? skin.bad : skin.soft });
    drawBar(ctx, { x: nameX + 10, y: y + 24, w: 56, h: 5, value: pp.pp, max: pp.max, kind: 'exp', dark: skin.dark });
    const ppw = drawText(ctx, `${pp.pp}/${pp.max}`, nameX + 70, y + 25, { font: 'small', color: skin.text }).w;
    if (pp.empty) drawText(ctx, `${pp.empty} ${t('common.empty')}`, nameX + 74 + ppw, y + 25, { font: 'small', color: skin.bad });
    // right column: types (line 1), condition (line 2), window / curve (line 3)
    const rx = r.x + 164;
    let tx = rx;
    for (const ty of typesOf(c)) tx += drawTypeChip(ctx, chipId(ty), tx, y + 3, { dark: skin.dark }) + 2;
    if (c.heldItem) {
      const g = itemGlyph(look().itemOrNull(c.heldItem));
      drawGlyph(ctx, g.glyph, r.x + r.w - 13, y + 5, { ink: skin.text, accent: g.accent, light: skin.card });
    }
    /** @type {Array<(yy: number) => void>} */
    const lines = [];
    if (resting) lines.push((yy) => drawText(ctx, t('party.fainted'), rx, yy, { color: skin.bad }));
    else if (c.status?.kind) lines.push((yy) => drawBadge(ctx, t(`battle.status.${c.status.kind}`), rx, yy - 2, { style: 'status', small: true, icon: c.status.kind }));
    const pending = (G.world?.pendingShifts ?? []).includes(c.uid);
    if (c.stillKnot) lines.push((yy) => drawText(ctx, t('party.heldByKnot'), rx, yy, { color: skin.soft }));
    else if (pending) {
      lines.push((yy) => {
        drawHeartmark(ctx, rx + 2, yy + 3, 1, {});
        drawText(ctx, 'Shift pending', rx + 7, yy, { color: MAGENTA }); // str
      });
    } else {
      let soon = false, next = null;
      try { soon = exp.windowSoon(c, data(), { tuning: TUNING }); next = exp.nextWindowLevel(c, data(), { tuning: TUNING }); } catch { soon = false; }
      if (soon && next) {
        lines.push((yy) => {
          drawText(ctx, '✦', rx, yy, { color: MAGENTA });
          drawText(ctx, t('party.pip', { level: next }), rx + 8, yy, { color: skin.text });
        });
      }
    }
    if (!resting) {
      const gap = curveGap(c.level, curveLevel(G.world, data()));
      lines.push((yy) => drawText(ctx, curveGapText(gap), rx, yy, { color: gap.kind === 'under' ? skin.accent : skin.soft }));
    }
    lines.slice(0, 2).forEach((fn, k) => fn(y + 15 + k * 11));
  }

  function drawCoverage(ctx, skin) {
    const inner = drawSkinPanel(ctx, COV, skin, 'paper', { title: t('party.coverage') });
    drawText(ctx, 'What your techniques hit', inner.x + 2, COV.y + 13, { color: skin.soft }); // str
    const c = cov;
    if (!c) return;
    c.rows.forEach((row, i) => {
      const r = covCell(i);
      const focused = mode === 'coverage' && covFocus.index === i;
      if (focused) { ctx.fillStyle = skin.band; ctx.fillRect(r.x, r.y, r.w, r.h); }
      drawTypeChip(ctx, chipId(row.type), r.x + 2, r.y + 3, { dark: skin.dark });
      const ink = row.grade === 'strong' ? skin.good : row.grade === 'weak' || row.grade === 'blocked' ? skin.bad : skin.soft;
      drawText(ctx, GRADE_GLYPH[row.grade], r.x + 35, r.y + 5, { color: ink });
      drawText(ctx, GRADE_WORD[row.grade], r.x + 42, r.y + 5, { color: ink });
    });
    if (mode === 'coverage') covFocus.drawCursor(ctx, { style: skin.style, cursor: false });
    // footer: gap in words, or the focused type's Strong hitters
    const fy = COV.y + 30 + 6 * 20 + 6;
    ctx.fillStyle = skin.rule;
    ctx.fillRect(COV.x + 6, fy - 3, COV.w - 12, 1);
    if (mode === 'coverage' && c.rows[covFocus.index]) {
      const row = c.rows[covFocus.index];
      const who = row.strong.length
        ? `Strong vs ${row.type}: ${listWords([...new Set(row.strong.map((s) => `${s.nick} (${s.move})`))].slice(0, 4))}` // str
        : `Nothing hits ${row.type} Strong yet.`; // str
      drawText(ctx, who, COV.x + 8, fy + 2, { color: skin.text, maxWidth: COV.w - 16 });
    } else {
      const gtxt = gapText(c);
      const isGap = c.gaps.length > 0;
      if (isGap) drawIcon(ctx, 'warn', COV.x + 8, fy + 1, { ink: skin.text, accent: skin.bad });
      drawText(ctx, gtxt, COV.x + (isGap ? 19 : 8), fy + 2, { color: isGap ? skin.bad : skin.text, maxWidth: COV.w - (isGap ? 27 : 16) });
      if (c.moves) {
        drawText(ctx, `Strong against ${c.strongCount} of ${c.rows.length}`, COV.x + 8, fy + 40, { color: skin.soft }); // str
      }
    }
  }

  function drawMini(ctx, skin) {
    const items = miniFocus.items;
    if (!items.length) return;
    const r0 = items[0].rect;
    const box = { x: r0.x - 6, y: r0.y - 6, w: r0.w + 12, h: items.length * 13 + 12 };
    drawSkinPanel(ctx, box, skin, 'notice', { torn: 'none' });
    miniItems.forEach((it, k) => {
      const r = items[k].rect;
      const focused = miniFocus.index === k;
      if (focused) { ctx.fillStyle = skin.band; ctx.fillRect(r.x, r.y, r.w, r.h - 1); }
      drawText(ctx, it.enabled ? it.label : `– ${it.label}`, r.x + 8, r.y + 3, { color: it.enabled ? skin.text : skin.faint, maxWidth: r.w - 10 });
      if (focused) drawCursorAt(ctx, r.x - 1, r.y + 3, ms, skin);
    });
    miniFocus.drawCursor(ctx, { style: skin.style, cursor: false, ring: false });
  }

  function drawHeldPicker(ctx, skin) {
    const c = party()[heldFrom === 'summary' ? summaryIndex : rowFocus.index];
    const box = { x: 148, y: 72, w: 184, h: 140 };
    drawSkinPanel(ctx, box, skin, 'paper', { title: 'Give to hold' }); // str
    drawText(ctx, c ? `For ${c.nickname}` : '', box.x + 8, box.y + 8, { color: skin.soft, font: 'small' }); // str
    heldList.draw(ctx);
  }

  function drawList(ctx, skin) {
    const p = party();
    drawHeading(ctx, t('party.heading'), `${p.length} of 6`); // str
    if (!p.length) {
      drawCard(ctx, { x: ROWS.x, y: ROWS.y, w: ROWS.w, h: 40 }, skin, {});
      drawText(ctx, 'Nobody has picked you yet.', ROWS.x + 10, ROWS.y + 15, { color: skin.soft }); // str
    }
    const pAnim = swapAnim ? Math.min(1, swapAnim.t / 100) : 1;
    p.forEach((c, i) => {
      let yOff = 0;
      if (swapAnim && pAnim < 1) {
        const ease = 1 - (1 - pAnim) * (1 - pAnim);
        if (i === swapAnim.i) yOff = (swapAnim.j - swapAnim.i) * ROWS.rowH * (1 - ease);
        else if (i === swapAnim.j) yOff = (swapAnim.i - swapAnim.j) * ROWS.rowH * (1 - ease);
      }
      drawRow(ctx, skin, c, i, Math.round(yOff));
    });
    if (mode === 'list' || mode === 'swap') {
      const r = rowFocus.current()?.rect;
      if (r && p.length) drawCursorAt(ctx, r.x - 7 < 0 ? 1 : r.x - 7, r.y + 14, ms, skin);
      rowFocus.drawCursor(ctx, { style: skin.style, cursor: false, ring: false });
    }
    const oneHeart = (G.world?.run?.challenges ?? []).includes('one-heart');
    if (oneHeart && p[0]) drawText(ctx, t('party.oneHeart', { nick: p[0].nickname }), ROWS.x + 2, 250, { font: 'small', color: PALETTE.v });
    drawCoverage(ctx, skin);
    if (mode === 'mini') drawMini(ctx, skin);
    if (mode === 'held') drawHeldPicker(ctx, skin);
    const hints = mode === 'swap'
      ? [['confirm', 'Swap here'], ['cancel', 'Stop']] // str
      : mode === 'coverage' ? [['cancel', 'Back to party']] // str
        : [['confirm', 'Choose'], ['r', 'Coverage'], ['cancel', 'Back']]; // str
    drawHints(ctx, G.input, hints);
  }

  function drawSummary(ctx, skin, prefs) {
    const c = party()[summaryIndex];
    if (!c) { mode = 'list'; return; }
    const L = look();
    const sp = L.speciesOrNull(c.speciesId);
    drawHeading(ctx, t('party.summary'), `${summaryIndex + 1} of ${party().length}`);
    // sprite plinth
    const plate = { x: 12, y: 16, w: 72, h: 68 };
    drawSkinPanel(ctx, plate, skin, 'card');
    const bobY = prefs.reduced ? 0 : (Math.floor(ms / 600) % 2);
    drawCreature(ctx, G, c, 16, 18, { scale: 2, glint: glintMs > 0, bobY, grey: (c.hp | 0) <= 0 });
    // identity column
    const ix = 12;
    drawText(ctx, c.nickname, ix, 90, { color: COLORS.paper.light, maxWidth: 80 });
    drawText(ctx, sp?.name ?? c.speciesId, ix, 101, { font: 'small', color: PALETTE.v, maxWidth: 80 });
    let tx = ix;
    for (const ty of typesOf(c)) tx += drawTypeChip(ctx, chipId(ty), tx, 109, { dark: true }) + 2;
    drawText(ctx, t('common.level', { level: c.level }), ix, 125, { color: COLORS.paper.light });
    let toNext = 0, lo = c.exp, hi = c.exp;
    try {
      toNext = creatureSys.expToNext(c, data(), { tuning: TUNING });
      const band = exp.expBand(creatureSys.growthOf(c, data()), c.level, { tuning: TUNING });
      lo = band[0]; hi = band[1];
    } catch { /* unknown form */ }
    drawBar(ctx, { x: ix + 26, y: 126, w: 54, h: 5, value: c.exp - lo, max: Math.max(1, hi - lo), kind: 'exp', dark: true });
    drawText(ctx, `next ${toNext}`, ix, 135, { font: 'small', color: PALETTE.v }); // str
    // stats
    const st = { x: 96, y: 16, w: 176, h: 66 };
    const sIn = drawSkinPanel(ctx, st, skin, 'ledger', { rulePitch: 10 });
    STAT_ORDER.forEach((k, i) => {
      const y = sIn.y + i * 10 + 1;
      drawText(ctx, t(`summary.stat.${k}`), sIn.x + 2, y, { color: skin.soft, font: 'main' });
      const v = c.stats?.[k] ?? 0;
      const txt = k === 'hp' ? `${c.hp}/${v}` : String(v);
      drawText(ctx, txt, sIn.x + 108, y, { color: skin.text, align: 'right' });
      const bw = Math.max(1, Math.min(52, Math.round(v / 4)));
      ctx.fillStyle = skin.dark ? PALETTE.v : COLORS.tally.dark;
      ctx.fillRect(sIn.x + 112, y + 2, bw, 3);
    });
    // ability + held
    const ab = L.abilityOrNull(c.ability);
    drawText(ctx, `${t('summary.ability')}: ${ab?.name ?? c.ability}`, 96, 88, { color: COLORS.paper.light, maxWidth: 176 });
    drawBody(ctx, ab?.text ?? '', 96, 99, 176, { color: PALETTE.v, maxLines: 2, large: false });
    const heldRow = c.heldItem ? L.itemOrNull(c.heldItem) : null;
    const heldFocused = sumFocus.current()?.id === 'held';
    if (heldFocused) { ctx.fillStyle = PALETTE.deepBlue; ctx.fillRect(95, 123, 178, 14); }
    if (heldRow) {
      const g = itemGlyph(heldRow);
      drawGlyph(ctx, g.glyph, 98, 126, { ink: COLORS.paper.light, accent: g.accent, light: COLORS.night.ink });
    }
    drawText(ctx, `${t('summary.held')}: ${heldRow?.name ?? (c.heldItem || t('common.none'))}`, 109, 127, { color: COLORS.paper.light, maxWidth: 160 });
    if (c.stillKnot) drawText(ctx, t('party.heldByKnot'), 109, 138, { font: 'small', color: PALETTE.v });
    // moves
    const mv = { x: 276, y: 12, w: 200, h: 74 };
    drawSkinPanel(ctx, mv, skin, 'paper');
    (c.moves ?? []).forEach((m, k) => {
      const y = 16 + k * 16;
      const row = L.moveOrNull(m.id);
      const focused = sumFocus.current()?.id === `move:${k}`;
      if (focused) { ctx.fillStyle = skin.band; ctx.fillRect(281, y, 190, 15); }
      const isHm = c.heartmark === m.id;
      if (isHm) drawHeartmark(ctx, 287, y + 6, 1, {});
      drawText(ctx, row?.name ?? m.id, 292, y + 4, { color: skin.text, maxWidth: 78 });
      if (row?.type) drawTypeChip(ctx, chipId(row.type), 372, y + 2, { dark: skin.dark });
      const empty = (m.pp | 0) <= 0;
      drawText(ctx, empty ? t('common.empty') : `PP ${m.pp}/${m.maxPp}`, 468, y + 4, { font: 'small', color: empty ? skin.bad : skin.text, align: 'right' }); // str
    });
    // bond, preset, heartmark spot
    drawText(ctx, t('summary.bond'), 280, 92, { color: COLORS.paper.light });
    drawPips(ctx, { x: 312, y: 93, n: c.bond | 0, max: 5, size: 5, gap: 2, dark: true, color: PALETTE.springBlossom });
    const presetFocused = sumFocus.current()?.id === 'preset';
    if (presetFocused) { ctx.fillStyle = PALETTE.deepBlue; ctx.fillRect(279, 109, 194, 14); }
    const preset = G.world?.settings?.autoAnchor?.[c.uid] ?? null;
    drawText(ctx, `${t('summary.preset')}:`, 284, 112, { color: PALETTE.v });
    drawText(ctx, `◀ ${presetLabel(preset)} ▶`, 470, 112, { color: COLORS.paper.light, align: 'right' });
    drawText(ctx, t('summary.heartmark', { spot: t(`summary.spot.${heartmarkSpot(c)}`) }), 284, 128, { font: 'small', color: PALETTE.v });
    const hmName = c.heartmark ? (L.moveOrNull(c.heartmark)?.name ?? c.heartmark) : null;
    drawText(ctx, `${t('summary.heartmarkMove')}: ${hmName ?? (canPin(c) ? 'pick one now' : 'at the first Shift')}`, 284, 137, { font: 'small', color: hmName ? PALETTE.v : MAGENTA, maxWidth: 190 }); // str
    // detail slip for the focused element
    const slip = { x: 96, y: 146, w: 376, h: 54 };
    drawSkinPanel(ctx, slip, skin, 'notice', { torn: 'top' });
    const cur = sumFocus.current()?.id ?? '';
    let body = '';
    if (cur.startsWith('move:')) {
      const m = c.moves[Number(cur.slice(5))];
      const row = m ? L.moveOrNull(m.id) : null;
      if (row) {
        const facts = row.category === 'status' ? 'Status' : `${row.category === 'physical' ? 'Physical' : 'Special'} · Power ${row.power}`; // str
        const acc = row.accuracy == null ? 'Sure hit' : `Accuracy ${row.accuracy}`; // str
        drawText(ctx, `${row.name}  ·  ${facts}  ·  ${acc}`, slip.x + 8, slip.y + 8, { color: skin.text, maxWidth: slip.w - 16 });
        body = row.text ?? '';
        if (canPin(c)) body = `Z: pin as the Heartmark technique. ${body}`; // str
        else if (c.heartmark === m.id) body = `Heartmark technique: never forgotten, through every Shift. ${body}`; // str
      }
    } else if (cur === 'preset') {
      drawText(ctx, t('summary.preset'), slip.x + 8, slip.y + 8, { color: skin.text });
      body = {
        null: 'When a window opens you choose: Accept, Reroll or Anchor.', // str
        'auto-anchor': 'Spends an anchor stone at each window and keeps this shape.', // str
        'auto-up': 'Takes the Up card at each window without asking.', // str
      }[String(preset)] ?? '';
    } else if (cur === 'held') {
      drawText(ctx, t('summary.held'), slip.x + 8, slip.y + 8, { color: skin.text });
      body = heldRow ? `${heldRow.text ?? ''} Z: take it back.` : 'Z: give an item to hold.'; // str
    }
    drawBody(ctx, body, slip.x + 8, slip.y + 19, slip.w - 16, { color: skin.soft, maxLines: 3, large: prefs.large });
    // Shiftlog strip
    drawShiftlog(ctx, skin, c);
    if (mode === 'summary') {
      const r = sumFocus.current()?.rect;
      if (r) drawCursorAt(ctx, r.x - 7, r.y + Math.floor((r.h - 7) / 2), ms, skinOf({ contrast: true }));
    }
    if (mode === 'held') drawHeldPicker(ctx, skin);
    drawHints(ctx, G.input, [['l', 'Prev'], ['r', 'Next'], ['confirm', 'Change'], ['cancel', 'Back']]); // str
  }

  function drawShiftlog(ctx, skin, c) {
    const box = { x: 8, y: 206, w: 464, h: 48 };
    drawSkinPanel(ctx, box, skin, 'ledger', { title: t('summary.shiftlog'), rulePitch: 48, margin: 0 });
    const log = Array.isArray(c.shiftlog) && c.shiftlog.length ? c.shiftlog : [c.speciesId];
    const L = look();
    const cell = 34, arrow = 12;
    const maxFit = Math.floor((box.w - 20 + arrow) / (cell + arrow));
    const shown = log.slice(-maxFit);
    let x = box.x + 10;
    shown.forEach((form, i) => {
      const current = i === shown.length - 1;
      if (current) { ctx.fillStyle = skin.dark ? PALETTE.deepBlue : COLORS.paper.shade; ctx.fillRect(x - 1, box.y + 7, cell, cell); }
      drawCreature(ctx, G, c, x, box.y + 8, { form, scale: 1 });
      if (i < shown.length - 1) drawText(ctx, '→', x + cell + 1, box.y + 20, { color: skin.soft });
      x += cell + arrow;
    });
    const sp = L.speciesOrNull(log[log.length - 1]);
    const label = log.length > 1 ? `${log.length} forms held. The mark has stayed on the ${t(`summary.spot.${heartmarkSpot(c)}`)}.` : 'No Shifts yet.'; // str
    let windowNote = '';
    try {
      const next = exp.nextWindowLevel(c, data(), { tuning: TUNING });
      if (c.stillKnot) windowNote = t('party.heldByKnot');
      else if ((G.world?.pendingShifts ?? []).includes(c.uid)) windowNote = 'A window is open: home or a Waystone at low tide.'; // str
      else if (next) windowNote = `Next window at Lv${next}.`; // str
      else if (sp?.flags?.neverShifts) windowNote = 'This form never Shifts.'; // str
    } catch { windowNote = ''; }
    const tx = Math.max(x + 4, box.x + 230);
    drawText(ctx, label, tx, box.y + 12, { color: skin.text, maxWidth: box.x + box.w - tx - 8 });
    drawText(ctx, windowNote, tx, box.y + 32, { font: 'small', color: skin.soft, maxWidth: box.x + box.w - tx - 8 });
  }

  // ----------------------------------------------------------------------------------- scene --
  const scene = {
    name: 'party',
    opaque: true,
    enter(params = {}) {
      G.input?.flush?.();
      ms = 0;
      mode = 'list';
      swapAnim = null;
      relayout();
      rowFocus.set(0, { force: true });
      slide.open(prefsOf(G));
      const want = params?.summary;
      if (want !== undefined && want !== null) {
        const i = typeof want === 'number' ? want : party().findIndex((c) => c.uid === want);
        if (i >= 0 && party()[i]) openSummary(i);
      }
    },
    exit() {},
    pause() {},
    resume() { G.input?.flush?.(); relayout(); },
    update(dt) {
      ms += dt;
      slide.update(dt);
      if (glintMs > 0) glintMs -= dt;
      if (swapAnim) { swapAnim.t += dt; if (swapAnim.t >= 100) swapAnim = null; }
      const sig = signature();
      if (sig !== lastSig) { lastSig = sig; relayout(); }
      rowFocus.update(dt); covFocus.update(dt); miniFocus.update(dt); sumFocus.update(dt); heldList.update(dt);
    },
    handleInput(input) {
      if (busy) return;
      switch (mode) {
        case 'list':
        case 'swap': {
          if (mode === 'list' && (input.pressed('r') || input.pressed('l')) && cov) { mode = 'coverage'; covFocus.set(0, { force: true }); sfx(G, 'cursor'); return; }
          const p = input.pointer;
          if (mode === 'list' && p && p.justDown && p.inside && p.x >= COV.x) { mode = 'coverage'; covFocus.handle(input); return; }
          rowFocus.handle(input);
          return;
        }
        case 'coverage': {
          if (input.pressed('l') || input.pressed('r')) { mode = 'list'; sfx(G, 'cursor'); return; }
          const p = input.pointer;
          if (p && p.justDown && p.inside && p.x < COV.x) { mode = 'list'; rowFocus.handle(input); return; }
          covFocus.handle(input);
          return;
        }
        case 'mini': miniFocus.handle(input); return;
        case 'held': heldList.handle(input); return;
        case 'summary': {
          if (input.pressed('l') || input.repeat('left')) { switchCreature(-1); return; }
          if (input.pressed('r') || input.repeat('right')) { switchCreature(1); return; }
          sumFocus.handle(input);
          return;
        }
        default:
      }
    },
    draw(ctx) {
      const prefs = prefsOf(G);
      const skin = skinOf(prefs);
      drawBackdrop(ctx, prefs);
      ctx.save();
      const off = slide.offset();
      if (off) ctx.translate(off, 0);
      if (mode === 'summary' || (mode === 'held' && heldFrom === 'summary')) drawSummary(ctx, skin, prefs);
      else drawList(ctx, skin);
      ctx.restore();
    },
    debugText() {
      const p = party();
      if (mode === 'summary') {
        const c = p[summaryIndex];
        return c ? `Summary ${c.nickname} Lv${c.level} ${c.speciesId} shiftlog=${(c.shiftlog ?? []).join('>')}` : 'Summary';
      }
      const lines = [t('party.heading'), ...p.map((c, i) => `${i === rowFocus.index ? '>' : ' '} ${c.nickname} Lv${c.level} HP ${c.hp}/${c.stats?.hp ?? 0}`)];
      if (cov) lines.push(gapText(cov));
      return lines.join('\n');
    },
    get mode() { return mode; },
    get coverage() { return cov; },
  };
  return scene;
}

// Re-exported for the scene tests.
export { PRESETS };
