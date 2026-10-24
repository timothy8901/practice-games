/**
 * The Satchel. [SCN-MENU] — GDD-00 §13, GDD-09 §3.7.
 *
 * Six pocket tabs (Wicks, Medicine, Discs, Finds, Held, Keepsakes; `l`/`r`, left/right or a tap),
 * a list of stacks (icon, name, `×n`), a detail panel (icon, name, the item's line, who holds one,
 * and for a disc the move it teaches with type, power and accuracy plus a **learner strip** of party
 * heads: lit = can learn, a tick = knows it, dim = can't) and the slot count (20 -> 30 -> 40).
 *
 * `confirm` on a stack opens its actions: Use (field medicine, on a chosen creature), Give to hold,
 * Teach (a disc; a full move set picks a technique to forget, never the Heartmark one), Toss (a
 * count, then a confirm with No first). Keepsakes never toss, and anything one-of-a-kind asks first
 * with **Keep it** focused. The cursor goes back to the top of every pocket (pockets never remember
 * a cursor) and `cancel` only ever backs out; nothing is dropped by backing out.
 *
 * Params: `{pocket?: string}` opens on a pocket.
 * @module scenes/bag
 */
import { drawText, measureText } from '../core/font.js';
import { COLORS, PALETTE } from '../ui/theme.js';
import { createList } from '../ui/list.js';
import { createTabs, TAB_H } from '../ui/tabs.js';
import { createFocus } from '../ui/focus.js';
import { drawTypeChip, drawCurrency, drawBar } from '../ui/widgets.js';
import { openConfirm } from '../ui/confirm.js';
import { t } from '../data/strings.js';
import * as bagSys from '../systems/bag.js';
import { itemOf } from '../systems/econ.js';
import * as partySys from '../systems/party.js';
import * as creatureSys from '../systems/creature.js';
import { TUNING } from '../data/tuning.js';
import {
  lookOf, discMove, learnerStrip, holders, itemActions, chipId, effectFits, applyFieldEffect, theName,
} from './menuModel.js';
import {
  prefsOf, skinOf, drawSkinPanel, drawCard, drawBackdrop, drawHints, drawCreatureIcon, drawGlyph, itemGlyph,
  drawCursorAt, drawBody, drawHeartmark, fitText, sfx, toast, sysCtx,
} from './menuKit.js';

/** Satchel tabs in display order (systems/bag.SATCHEL_TABS). */
export const POCKETS = Object.freeze(bagSys.SATCHEL_TABS.slice());

const PANEL = Object.freeze({ x: 16, y: 24, w: 448, h: 230 });
const LIST = Object.freeze({ x: 24, y: 32, w: 240, h: 212 });
const DETAIL = Object.freeze({ x: 272, y: 32, w: 184, h: 176 });

/** @param {string} s @returns {string} the text with its first letter upper-cased */
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** What each pocket is for, shown while it is empty. */
const POCKET_NOTES = Object.freeze({
  wicks: 'Wicks burn one per raise of the Lantern. Pell\'s sells them by the bundle.', // str
  medicine: 'Salves, tonics and cures. In battle each heal spends one of three Mends.', // str
  discs: 'Technique discs teach a move and are never used up.', // str
  finds: 'Fruit, honey, timber, shells and sparkles: Ludo buys most of it.', // str
  held: 'Things a creature can hold: knots, charms and tilts.', // str
  keepsakes: 'One-of-a-kind things. They always ask before they leave your hands.', // str
});

/**
 * @param {any} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string}}
 */
export function createBagScene(G) {
  /** @type {'list'|'actions'|'target'|'forget'|'qty'} */
  let mode = 'list';
  let ms = 0;
  let busy = false;
  let qty = 1;
  /** @type {{id: string, row: any, n: number, pocket: string}|null} */
  let picked = null;
  /** @type {'use'|'hold'|'teach'|null} */
  let purpose = null;
  /** @type {any} */
  let targetC = null;
  /** @type {ReturnType<typeof itemActions>} */
  let actions = [];

  const look = () => lookOf(G.data);
  const ctx0 = () => sysCtx(G);

  const tabs = createTabs({
    tabs: POCKETS.map((id) => ({ id, label: t(`pocket.${id}`) })),
    rect: { x: 24, y: PANEL.y - TAB_H + 1, w: 432 },
    onChange: () => { refresh(true); sfx(G, 'cursor'); },
  });

  const list = createList({
    rect: LIST, rowH: 12, items: [],
    render: (ctx, item, x, y, w, focused) => drawRow(ctx, item, x, y, w, focused),
    onSelect: (item) => openActions(item),
    onCancel: () => leave(),
    onChange: () => sfx(G, 'cursor'),
  });

  const actFocus = createFocus({ cols: 1, wrap: true, items: [] });
  actFocus.on('change', () => sfx(G, 'cursor'));
  actFocus.on('blocked', () => sfx(G, 'blocked'));
  actFocus.on('cancel', () => { mode = 'list'; sfx(G, 'cancel'); });
  actFocus.on('activate', (ev) => doAction(actions[ev.index]?.id));

  const tgtFocus = createFocus({ cols: 1, wrap: true, items: [] });
  tgtFocus.on('change', () => sfx(G, 'cursor'));
  tgtFocus.on('blocked', () => sfx(G, 'blocked'));
  tgtFocus.on('cancel', () => { mode = 'actions'; sfx(G, 'cancel'); });
  tgtFocus.on('activate', (ev) => pickTarget(ev.index));

  const fgtFocus = createFocus({ cols: 1, wrap: true, items: [] });
  fgtFocus.on('change', () => sfx(G, 'cursor'));
  fgtFocus.on('blocked', () => sfx(G, 'blocked'));
  fgtFocus.on('cancel', () => { mode = 'target'; sfx(G, 'cancel'); });
  fgtFocus.on('activate', (ev) => forgetAndTeach(ev.index));

  // ----------------------------------------------------------------------------------- data --
  function stacks(pocket) {
    const w = G.world;
    if (!w?.bag?.pockets) return [];
    return bagSys.pocketList(w, pocket).map((s, i) => {
      const row = itemOf(G.data, s.id) ?? { id: s.id, name: s.id, pocket };
      return { id: `${s.id}#${i}`, label: row.name ?? s.id, value: s.n > 1 || row.stack > 1 ? t('bag.count', { n: s.n }) : '', marker: pocket !== 'keepsakes' && row.oneOfAKind ? '★' : undefined, data: { id: s.id, row, n: s.n, pocket } };
    });
  }

  function refresh(resetCursor) {
    const items = stacks(tabs.active);
    list.setItems(items);
    if (resetCursor) list.select(0);
  }

  function current() {
    return list.selected()?.data ?? null;
  }

  // -------------------------------------------------------------------------------- actions --
  function openActions(item) {
    if (!item?.data) return;
    picked = item.data;
    actions = itemActions(picked.row, { pocket: picked.pocket, party: G.world?.party ?? [] });
    actFocus.setItems(actions.map((a, k) => ({ id: a.id, rect: { x: DETAIL.x + 10, y: DETAIL.y + DETAIL.h - 8 - (actions.length - k) * 13, w: DETAIL.w - 20, h: 13 }, enabled: a.enabled, reason: a.reason })), { keepId: false });
    actFocus.set(0);
    mode = 'actions';
    sfx(G, 'confirm');
  }

  function doAction(id) {
    if (!picked || !id) return;
    if (id === 'toss') {
      qty = 1;
      mode = 'qty';
      sfx(G, 'confirm');
      return;
    }
    purpose = /** @type {any} */ (id);
    openTargets();
  }

  function targetState(c) {
    const row = picked?.row;
    if (purpose === 'teach') {
      const mv = discMove(row, G.data);
      const st = learnerStrip([c], mv?.id ?? '', G.data)[0]?.state;
      if (st === 'knows') return { enabled: false, reason: 'Already knows it.', short: 'Knows it' }; // str
      if (st !== 'can') return { enabled: false, reason: t('bag.cantLearn', { nick: c.nickname, move: mv?.name ?? '' }), short: "Can't learn it" }; // str
      return { enabled: true, note: (c.moves?.length ?? 0) >= 4 ? 'forgets one' : 'learns it' }; // str
    }
    if (purpose === 'hold') return { enabled: true, note: c.heldItem ? `swaps ${look().itemOrNull(c.heldItem)?.name ?? c.heldItem}` : 'free hands' }; // str
    if (purpose === 'use') {
      const eff = bagSys.USE_HANDLERS[row?.use]?.effect(row);
      const fit = effectFits(c, eff);
      const why = { resting: 'Resting. Needs a Revive.', full: 'Already full.', awake: 'Not resting.', 'no-status': 'Nothing to cure.' }[fit.reason ?? ''] ?? t('bag.noEffect', { nick: c.nickname }); // str
      return fit.ok ? { enabled: true, note: '' } : { enabled: false, reason: why, short: why };
    }
    return { enabled: true, note: '' };
  }

  function openTargets() {
    const party = G.world?.party ?? [];
    tgtFocus.setItems(party.map((c, i) => {
      const st = targetState(c);
      return { id: c.uid, rect: { x: LIST.x + 4, y: LIST.y + 18 + i * 30, w: LIST.w - 8, h: 28 }, enabled: st.enabled, reason: st.reason };
    }), { keepId: false });
    tgtFocus.set(0);
    mode = 'target';
    sfx(G, 'confirm');
  }

  async function pickTarget(i) {
    const c = G.world?.party?.[i];
    if (!c || !picked || busy) return;
    const row = picked.row;
    const ooak = picked.pocket === 'keepsakes' || row?.oneOfAKind === true;
    if (ooak && (purpose === 'hold' || purpose === 'use')) {
      busy = true;
      const name = row?.name ?? picked.id;
      const spec = purpose === 'hold'
        ? { body: `Give ${theName(name)} to ${c.nickname} to hold? There is only one.`, options: [t('confirm.option.keep'), 'Give it'], defaultIndex: 0 } // str
        : { body: t('confirm.oneOfAKind', { item: theName(name).slice(4) }), options: [t('confirm.option.keep'), t('confirm.option.use')], defaultIndex: 0 };
      const pick = await openConfirm(G, spec);
      busy = false;
      if (pick !== 1) { sfx(G, 'cancel'); return; }
    }
    const ctx = ctx0();
    if (purpose === 'use') {
      let result = null;
      const res = G.store.tx('bag:use', (w) => bagSys.use(w, picked.id, {
        ...ctx, context: 'field', confirm: true,
        apply: (effect) => { result = applyFieldEffect(c, effect); return result; },
      }));
      if (res.ok) {
        G.bus?.emit?.('party:changed', { reason: 'item', uid: c.uid });
        sfx(G, 'confirm');
        toast(G, useLine(c, result));
        finish();
      } else { sfx(G, 'error'); toast(G, t('bag.noEffect', { nick: c.nickname })); }
      return;
    }
    if (purpose === 'hold') {
      const res = G.store.tx('bag:hold', (w) => {
        const took = bagSys.take(w, picked.id, 1, { ...ctx, confirm: true, source: 'hold' });
        if (!took.ok) return { ok: false };
        const prev = c.heldItem;
        partySys.setHeldItem(w, c.uid, picked.id, ctx.data, { bus: G.bus });
        if (prev) bagSys.give(w, prev, 1, { ...ctx, source: 'unhold' });
        return { ok: true, prev };
      });
      if (res.ok) {
        sfx(G, 'confirm');
        const prevName = res.prev ? (look().itemOrNull(res.prev)?.name ?? res.prev) : null;
        const nm = theName(row.name ?? picked.id);
        toast(G, prevName ? `${c.nickname} holds ${nm}. ${cap(theName(prevName))} went back in the satchel.` : `${c.nickname} is holding ${nm}.`); // str
        finish();
      } else sfx(G, 'error');
      return;
    }
    if (purpose === 'teach') {
      targetC = c;
      if ((c.moves?.length ?? 0) < 4) { teach(c, -1); return; }
      const L = look();
      fgtFocus.setItems(c.moves.map((m, k) => ({
        id: m.id, rect: { x: DETAIL.x + 10, y: DETAIL.y + 40 + k * 16, w: DETAIL.w - 20, h: 15 },
        enabled: m.id !== c.heartmark, reason: 'The Heartmark technique stays.', // str
        label: L.moveOrNull(m.id)?.name ?? m.id,
      })), { keepId: false });
      fgtFocus.set(0);
      mode = 'forget';
      sfx(G, 'confirm');
    }
  }

  async function forgetAndTeach(k) {
    const c = targetC;
    if (!c || busy) return;
    const L = look();
    const mv = discMove(picked?.row, G.data);
    const oldName = L.moveOrNull(c.moves[k]?.id)?.name ?? c.moves[k]?.id;
    busy = true;
    const pick = await openConfirm(G, { body: t('confirm.forget', { nick: c.nickname, move: oldName, newMove: mv?.name ?? '' }), options: [t('confirm.no'), t('confirm.option.forget')], defaultIndex: 0 });
    busy = false;
    if (pick !== 1) { sfx(G, 'cancel'); return; }
    teach(c, k);
  }

  function teach(c, replaceIndex) {
    const mv = discMove(picked?.row, G.data);
    if (!mv) return;
    let ok = false;
    G.store.tx('bag:teach', (w) => {
      const f = partySys.findCreature(w, c.uid);
      if (!f) return;
      ok = creatureSys.learnMove(f.c, mv.id, G.data, { tuning: TUNING, replaceIndex: replaceIndex >= 0 ? replaceIndex : undefined });
    });
    if (ok) {
      G.bus?.emit?.('creature:learned', { uid: c.uid, move: mv.id });
      G.bus?.emit?.('party:changed', { reason: 'learned', uid: c.uid });
      sfx(G, 'confirm');
      toast(G, t('bag.taught', { nick: c.nickname, move: mv.name }));
      finish();
    } else { sfx(G, 'error'); toast(G, t('bag.cantLearn', { nick: c.nickname, move: mv.name })); }
  }

  async function toss() {
    if (!picked || busy) return;
    const row = picked.row;
    busy = true;
    const pick = await openConfirm(G, { body: `Toss ${qty} × ${row?.name ?? picked.id}? It won't come back.`, options: [t('confirm.no'), 'Toss'], defaultIndex: 0, danger: true }); // str
    busy = false;
    if (pick !== 1) { sfx(G, 'cancel'); return; }
    const res = G.store.tx('bag:toss', (w) => bagSys.toss(w, picked.id, qty, { ...ctx0(), source: 'toss' }));
    if (res.ok) { sfx(G, 'confirm'); toast(G, `Tossed ${qty} × ${row?.name ?? picked.id}.`); finish(); } // str
    else sfx(G, 'error');
  }

  function useLine(c, r) {
    if (!r) return t('bag.noEffect', { nick: c.nickname });
    if (r.revived) return `${c.nickname} is awake again.`; // str
    if (r.healed) return `${c.nickname} got ${r.healed} HP back.`; // str
    if (r.pp) return `${c.nickname}'s techniques got ${r.pp} PP back.`; // str
    if (r.cured) return `${c.nickname} is ${t(`battle.status.${r.cured}`)} no longer.`; // str
    return t('bag.noEffect', { nick: c.nickname });
  }

  function finish() {
    mode = 'list';
    const keepId = picked?.id;
    picked = null; purpose = null; targetC = null;
    const before = list.index;
    refresh(false);
    const i = list.items.findIndex((it) => it.data?.id === keepId);
    list.select(i >= 0 ? i : Math.min(before, Math.max(0, list.items.length - 1)));
  }

  function leave() {
    sfx(G, 'cancel');
    if (G.scenes.top() === scene) G.scenes.pop();
  }

  // -------------------------------------------------------------------------------- drawing --
  function drawRow(ctx, item, x, y, w, focused, rowH = 12) {
    const skin = skinOf(prefsOf(G));
    // ui/list paints its focus band in its build-time (paper) style; under high contrast that is a
    // cream band under cream text, so the band is repainted in the live skin.
    if (focused && skin.dark) { ctx.fillStyle = skin.band; ctx.fillRect(x - 1, y, w + 2, rowH); }
    const d = item.data;
    const g = itemGlyph({ ...d.row, type: discMove(d.row, G.data)?.type });
    if (item.marker) drawText(ctx, item.marker, x + 2, y + 3, { color: skin.dark ? PALETTE.y : COLORS.brass.dark });
    drawGlyph(ctx, g.glyph, x + 11, y + 2, { ink: skin.text, accent: g.accent, light: skin.card });
    const vw = item.value ? measureText(item.value).w + 8 : 4;
    drawText(ctx, fitText(item.label, w - 26 - vw), x + 23, y + 3, { color: skin.text });
    if (item.value) drawText(ctx, item.value, x + w - 3, y + 3, { color: skin.soft, align: 'right' });
  }

  function drawDetail(ctx, skin, prefs) {
    drawSkinPanel(ctx, DETAIL, skin, 'card');
    const d = current();
    if (!d) {
      drawGlyph(ctx, { wicks: 'wick', medicine: 'bottle', discs: 'disc', finds: 'glint', held: 'knot', keepsakes: 'star' }[tabs.active] ?? 'bag', DETAIL.x + 10, DETAIL.y + 10, { ink: skin.faint, accent: skin.faint, light: skin.card, scale: 3 });
      drawText(ctx, t(`pocket.${tabs.active}`), DETAIL.x + 42, DETAIL.y + 16, { color: skin.soft });
      drawBody(ctx, POCKET_NOTES[tabs.active] ?? '', DETAIL.x + 10, DETAIL.y + 42, DETAIL.w - 20, { color: skin.soft, large: prefs.large, maxLines: 12 });
      return;
    }
    const row = d.row;
    const mv = discMove(row, G.data);
    const g = itemGlyph({ ...row, type: mv?.type });
    ctx.fillStyle = skin.dark ? '#222B4D' : COLORS.paper.shade;
    ctx.fillRect(DETAIL.x + 8, DETAIL.y + 8, 28, 28);
    drawGlyph(ctx, g.glyph, DETAIL.x + 10, DETAIL.y + 10, { ink: skin.text, accent: g.accent, light: skin.card, scale: 3 });
    drawText(ctx, fitText(row.name ?? d.id, DETAIL.w - 50), DETAIL.x + 42, DETAIL.y + 10, { color: skin.text });
    const sub = d.pocket === 'keepsakes' ? 'Keepsake' : `${t(`pocket.${d.pocket}`)}  ${t('bag.count', { n: d.n })}`; // str
    drawText(ctx, sub, DETAIL.x + 42, DETAIL.y + 22, { color: skin.soft });
    let y = DETAIL.y + 42;
    if (mv) {
      let x = DETAIL.x + 10;
      drawText(ctx, mv.name, x, y, { color: skin.text });
      if (mv.type) drawTypeChip(ctx, chipId(mv.type), DETAIL.x + DETAIL.w - 46, y - 2, { dark: skin.dark });
      y += 11;
      const facts = mv.category === 'status' ? 'Status' : `${mv.category === 'physical' ? 'Physical' : 'Special'}  •  Power ${mv.power}`; // str
      drawText(ctx, `${facts}  •  ${mv.accuracy == null ? 'Sure hit' : `Acc ${mv.accuracy}`}`, x, y, { color: skin.soft, maxWidth: DETAIL.w - 20 }); // str
      y += 13;
      // learner strip
      const strip = learnerStrip(G.world?.party ?? [], mv.id, G.data);
      drawText(ctx, 'Can learn', x, y, { font: 'small', color: skin.soft }); // str
      y += 8;
      strip.forEach((s, i) => {
        const c = G.world.party.find((p) => p.uid === s.uid);
        const cx = x + i * 27;
        ctx.fillStyle = s.state === 'can' ? (skin.dark ? PALETTE.deepBlue : COLORS.paper.light) : 'transparent';
        if (s.state === 'can') ctx.fillRect(cx - 1, y - 1, 20, 20);
        drawCreatureIcon(ctx, G, c, cx + 1, y + 1, { dim: s.state === 'cannot' });
        if (s.state === 'knows') drawText(ctx, '+', cx + 14, y + 12, { color: skin.good });
        if (s.state === 'cannot') drawText(ctx, '×', cx + 14, y + 12, { color: skin.faint });
      });
      if (!strip.length) drawText(ctx, 'Nobody to teach yet.', x, y + 4, { color: skin.faint }); // str
      y += 24;
      if (mode === 'list') drawBody(ctx, mv.text || row.text || '', x, y, DETAIL.w - 20, { color: skin.soft, maxLines: 4, large: false });
    } else {
      const room = Math.floor((DETAIL.y + DETAIL.h - y - 4) / 10) - (d.pocket === 'keepsakes' ? 3 : 0);
      const h = drawBody(ctx, row.text ?? '', DETAIL.x + 10, y, DETAIL.w - 20, { color: skin.soft, maxLines: mode === 'list' ? Math.max(3, room) : 4, large: prefs.large });
      y += h + 4;
      const who = holders(G.world)[d.id];
      if (who && who.length) { drawText(ctx, t('bag.heldBy', { nick: who.join(', ') }), DETAIL.x + 10, y, { color: skin.text, maxWidth: DETAIL.w - 20 }); y += 11; }
      if (d.pocket === 'keepsakes' && mode === 'list') drawBody(ctx, t('bag.keepsakeSafe'), DETAIL.x + 10, y + 2, DETAIL.w - 20, { color: skin.faint, maxLines: 3 });
    }
    if (mode === 'actions' || mode === 'qty') drawActions(ctx, skin);
  }

  function drawActions(ctx, skin) {
    const items = actFocus.items;
    const top = items[0]?.rect.y ?? DETAIL.y + 100;
    const box = { x: DETAIL.x + 4, y: top - 5, w: DETAIL.w - 8, h: DETAIL.y + DETAIL.h - top + 1 };
    drawSkinPanel(ctx, box, skin, 'notice', { torn: 'top' });
    actions.forEach((a, k) => {
      const r = items[k].rect;
      const focused = actFocus.index === k;
      if (focused) { ctx.fillStyle = skin.band; ctx.fillRect(r.x, r.y, r.w, r.h - 1); }
      let label = a.enabled ? a.label : `– ${a.label}`;
      if (mode === 'qty' && a.id === 'toss') label = `Toss  ◀ ${qty} ▶`; // str
      drawText(ctx, label, r.x + 9, r.y + 3, { color: a.enabled ? skin.text : skin.faint });
      if (focused) drawCursorAt(ctx, r.x, r.y + 3, ms, skin);
    });
    actFocus.drawCursor(ctx, { style: skin.style, cursor: false, ring: false });
  }

  function drawTargets(ctx, skin) {
    const box = { x: LIST.x - 4, y: LIST.y - 2, w: LIST.w + 4, h: Math.max(60, 26 + (G.world?.party?.length ?? 0) * 30) };
    drawSkinPanel(ctx, box, skin, 'paper');
    const nm = theName(picked?.row?.name ?? '');
    const titles = { use: `Use ${nm} on...`, hold: `Who holds ${nm}?`, teach: `Teach ${discMove(picked?.row, G.data)?.name ?? ''} to...` }; // str
    drawText(ctx, titles[purpose ?? 'use'] ?? '', box.x + 8, box.y + 7, { color: skin.text, maxWidth: box.w - 16 });
    (G.world?.party ?? []).forEach((c, i) => {
      const it = tgtFocus.items[i];
      if (!it) return;
      const r = it.rect;
      const focused = tgtFocus.index === i && mode === 'target';
      drawCard(ctx, r, skin, { focused, dim: it.enabled === false });
      drawCreatureIcon(ctx, G, c, r.x + 5, r.y + 6, { grey: (c.hp | 0) <= 0 });
      drawText(ctx, c.nickname, r.x + 26, r.y + 5, { color: it.enabled === false ? skin.faint : skin.text, maxWidth: 80 });
      drawText(ctx, t('common.level', { level: c.level }), r.x + 26, r.y + 16, { color: skin.soft, font: 'small' });
      drawBar(ctx, { x: r.x + 112, y: r.y + 6, w: 50, h: 5, value: c.hp, max: c.stats?.hp ?? 1, kind: 'hp', dark: skin.dark });
      drawText(ctx, `${c.hp}/${c.stats?.hp ?? 0}`, r.x + 166, r.y + 6, { font: 'small', color: skin.text });
      const st = targetState(c);
      const note = it.enabled === false ? (st.short ?? it.reason ?? '') : (st.note ?? '');
      drawText(ctx, note, r.x + 112, r.y + 16, { font: 'small', color: it.enabled === false ? skin.bad : skin.soft, maxWidth: r.w - 116 });
      if (focused) drawCursorAt(ctx, r.x - 7 < LIST.x - 4 ? r.x + 1 : r.x - 7, r.y + 10, ms, skin);
    });
    tgtFocus.drawCursor(ctx, { style: skin.style, cursor: false, ring: false });
  }

  function drawForget(ctx, skin) {
    const c = targetC;
    if (!c) return;
    const box = { x: DETAIL.x, y: DETAIL.y + 20, w: DETAIL.w, h: 20 + 4 * 16 + 14 };
    drawSkinPanel(ctx, box, skin, 'notice', { torn: 'none' });
    drawText(ctx, `${c.nickname} forgets...`, box.x + 8, box.y + 7, { color: skin.text }); // str
    fgtFocus.items.forEach((it, k) => {
      const r = it.rect;
      const focused = fgtFocus.index === k;
      if (focused) { ctx.fillStyle = skin.band; ctx.fillRect(r.x, r.y, r.w, r.h - 1); }
      drawText(ctx, it.enabled === false ? `– ${it.label}` : it.label, r.x + 9, r.y + 4, { color: it.enabled === false ? skin.faint : skin.text });
      if (it.enabled === false) {
        // the one move that can't go says why, by shape and word (never colour alone)
        const tw = measureText('Heartmark: stays', { font: 'small' }).w; // str
        drawHeartmark(ctx, r.x + r.w - tw - 8, r.y + 7, 1, {});
        drawText(ctx, 'Heartmark: stays', r.x + r.w - 3, r.y + 5, { font: 'small', color: skin.soft, align: 'right' }); // str
      }
      if (focused) drawCursorAt(ctx, r.x, r.y + 4, ms, skin);
    });
    fgtFocus.drawCursor(ctx, { style: skin.style, cursor: false, ring: false });
  }

  // ---------------------------------------------------------------------------------- scene --
  const scene = {
    name: 'bag',
    opaque: true,
    enter(params = {}) {
      G.input?.flush?.();
      ms = 0;
      mode = 'list';
      const want = params?.pocket;
      tabs.setActive(POCKETS.includes(want) ? want : POCKETS[0]);
      refresh(true);
    },
    exit() {},
    pause() {},
    resume() { G.input?.flush?.(); refresh(false); },
    update(dt) {
      ms += dt;
      list.update(dt); actFocus.update(dt); tgtFocus.update(dt); fgtFocus.update(dt);
    },
    handleInput(input) {
      if (busy) return;
      switch (mode) {
        case 'list': {
          const before = tabs.active;
          tabs.handle(input);
          if (tabs.active === before) {
            if (input.repeat('left')) tabs.prev();
            else if (input.repeat('right')) tabs.next();
          }
          if (tabs.active !== before) return;
          list.focus.handle(input);
          return;
        }
        case 'actions': {
          // a tap outside the action slip backs out of it (never acts)
          const p = input.pointer;
          const r0 = actFocus.items[0]?.rect;
          if (p && p.justDown && p.inside && r0 && (p.x < DETAIL.x || p.y < r0.y - 5 || p.y > DETAIL.y + DETAIL.h)) { mode = 'list'; sfx(G, 'cancel'); return; }
          actFocus.handle(input);
          return;
        }
        case 'qty': {
          const max = picked?.n ?? 1;
          if (input.repeat('left') || input.repeat('down')) { qty = Math.max(1, qty - 1); sfx(G, 'cursor'); }
          else if (input.repeat('right') || input.repeat('up')) { qty = Math.min(max, qty + 1); sfx(G, 'cursor'); }
          else if (input.pressed('confirm')) toss();
          else if (input.pressed('cancel')) { mode = 'actions'; sfx(G, 'cancel'); }
          return;
        }
        case 'target': tgtFocus.handle(input); return;
        case 'forget': fgtFocus.handle(input); return;
        default:
      }
    },
    draw(ctx) {
      const prefs = prefsOf(G);
      const skin = skinOf(prefs);
      drawBackdrop(ctx, prefs);
      drawSkinPanel(ctx, PANEL, skin, 'paper');
      tabs.draw(ctx);
      // heading + wallet to the right of the tabs
      const lay = tabs.layout();
      const right = lay.length ? lay[lay.length - 1].x + lay[lay.length - 1].w + 18 : 300;
      drawText(ctx, t('bag.heading'), Math.max(right, 310), 8, { color: COLORS.paper.light });
      drawCurrency(ctx, G.world?.wallet?.main ?? 0, 464, 8, { align: 'right', dark: true, color: COLORS.paper.light });
      ctx.fillStyle = skin.rule;
      ctx.fillRect(LIST.x + LIST.w + 3, PANEL.y + 8, 1, PANEL.h - 16);
      if (mode === 'target') drawTargets(ctx, skin);
      else {
        if (list.items.length) list.draw(ctx);
        else drawBody(ctx, t('bag.empty'), LIST.x + 12, LIST.y + 4, LIST.w - 24, { color: skin.faint, large: prefs.large });
      }
      drawDetail(ctx, skin, prefs);
      if (mode === 'forget') drawForget(ctx, skin);
      // slots
      const sl = G.world?.bag ? bagSys.slots(G.world, sysCtx(G)) : { used: 0, total: 20 };
      const sy = DETAIL.y + DETAIL.h + 10;
      drawText(ctx, t('bag.slots', { used: sl.used, max: sl.total }), DETAIL.x + 2, sy, { color: sl.used >= sl.total ? skin.bad : skin.text });
      drawBar(ctx, { x: DETAIL.x + 2, y: sy + 12, w: DETAIL.w - 4, h: 5, value: sl.used, max: Math.max(1, sl.total), kind: 'glow', dark: skin.dark });
      const hints = mode === 'list'
        ? [['l', ''], ['r', 'Pocket'], ['confirm', 'Choose'], ['cancel', 'Back']] // str
        : mode === 'qty' ? [['confirm', 'Toss'], ['cancel', 'Back']] : [['confirm', 'Choose'], ['cancel', 'Back']]; // str
      drawHints(ctx, G.input, hints);
    },
    debugText() {
      const d = current();
      return [`${t('bag.heading')} [${tabs.active}]`, ...list.items.map((it, i) => `${i === list.index ? '>' : ' '} ${it.label} ${it.value ?? ''}`), d ? `detail: ${d.row?.name}` : t('bag.empty'), `mode: ${mode}`].join('\n');
    },
    get mode() { return mode; },
    get pocket() { return tabs.active; },
  };
  return scene;
}
