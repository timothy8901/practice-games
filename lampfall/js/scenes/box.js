/**
 * Storage (the box). [SCN-MENU] — GDD-00 §13 (20 -> 40 with the Cellar commission).
 *
 * Left: the party's six slots. Right: the storage grid, 8 × 5 cells; cells past the capacity (20
 * until the Cellar is built) show a lock with the reason. Below: the focused creature's card.
 *
 * `confirm` on a creature opens Move / Summary (party only) / Release. **Move** lifts it into the
 * hand; `confirm` on another slot drops it there (an empty slot moves it, an occupied one swaps the
 * two, party <-> storage both ways); `cancel` puts it back where it was. **Release** is behind a
 * confirm with **Keep it** focused and is never offered for the last party member. Moving the last
 * conscious party creature into storage is refused with the reason (systems/party rules).
 *
 * Every change goes through `systems/party` (`swap`, `toBox`, `fromBox`, `release`) inside a tx;
 * cancel never changes anything.
 * @module scenes/box
 */
import { drawText } from '../core/font.js';
import { COLORS, PALETTE } from '../ui/theme.js';
import { createFocus } from '../ui/focus.js';
import { drawBar, drawTypeChip } from '../ui/widgets.js';
import { drawIcon } from '../ui/icons.js';
import { openConfirm } from '../ui/confirm.js';
import { confirmSpec, t } from '../data/strings.js';
import * as partySys from '../systems/party.js';
import { TUNING } from '../data/tuning.js';
import { boxCapacity, typesOf, chipId, lookOf, BOX_CELLAR } from './menuModel.js';
import {
  prefsOf, skinOf, drawSkinPanel, drawCard, drawBackdrop, drawHeading, drawHints, drawCreature, drawCreatureIcon,
  drawCursorAt, sfx, toast, sysCtx,
} from './menuKit.js';

const PARTY_X = 8, PARTY_Y = 22, PARTY_W = 136, PARTY_H = 30;
const GRID_X = 156, GRID_Y = 22, COLS = 8, ROWS = 5, CELL_W = 38, CELL_H = 36;
const PARTY_MAX = 6;

/**
 * @param {any} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string}}
 */
export function createBoxScene(G) {
  let ms = 0;
  let busy = false;
  /** @type {{from: 'party'|'box', uid: string}|null} */
  let hand = null;
  /** @type {'grid'|'actions'} */
  let mode = 'grid';
  let cap = 20;
  /** @type {Array<{id: string, label: string, enabled: boolean, reason?: string}>} */
  let actions = [];

  const world = () => G.world;
  const tuning = () => ({ ...TUNING, BOX_CAPACITY: cap });

  // One focus over party slots (column 0 of a virtual grid) and storage cells. Items are laid out
  // as rows of 9: [party slot r, cell r*8 .. r*8+7]; party slots 5 and 6 sit on rows 5..
  // Simpler and clearer: two focus models and explicit left/right hand-off.
  const partyFocus = createFocus({ cols: 1, wrap: true, items: [] });
  const gridFocus = createFocus({ cols: COLS, wrap: true, items: [] });
  const actFocus = createFocus({ cols: 1, wrap: true, items: [] });
  /** @type {'party'|'grid'} */
  let area = 'grid';

  function partyRect(i) { return { x: PARTY_X, y: PARTY_Y + 12 + i * (PARTY_H + 4), w: PARTY_W, h: PARTY_H }; }
  function cellRect(i) { return { x: GRID_X + (i % COLS) * CELL_W, y: GRID_Y + 12 + Math.floor(i / COLS) * CELL_H, w: CELL_W - 2, h: CELL_H - 2 }; }

  function layout() {
    cap = boxCapacity(world(), TUNING);
    partyFocus.setItems(Array.from({ length: PARTY_MAX }, (_, i) => ({ id: `p${i}`, rect: partyRect(i), enabled: true })));
    const n = Math.max(COLS * ROWS, cap);
    gridFocus.setItems(Array.from({ length: Math.min(n, COLS * ROWS) }, (_, i) => ({
      id: `b${i}`, rect: cellRect(i), enabled: i < cap,
      reason: cap < BOX_CELLAR ? 'The Cellar commission makes room for 20 more.' : 'Storage is full.', // str
    })));
  }

  /** The creature under the cursor, or null. */
  function focused() {
    const w = world();
    if (area === 'party') return w?.party?.[partyFocus.index] ?? null;
    return w?.box?.[gridFocus.index] ?? null;
  }

  // -------------------------------------------------------------------------------- actions --
  function openActions() {
    const c = focused();
    if (!c) { sfx(G, 'blocked'); return; }
    const inParty = area === 'party';
    const last = inParty && (world().party.length <= 1);
    actions = [
      { id: 'move', label: 'Move', enabled: true }, // str
      { id: 'summary', label: t('party.summary'), enabled: inParty, reason: 'Summaries live on the Party page.' }, // str
      { id: 'release', label: 'Release', enabled: !last, reason: 'Your last companion stays with you.' }, // str
    ];
    const r = (inParty ? partyRect(partyFocus.index) : cellRect(gridFocus.index));
    // beside a party card (never over its name or level), tucked into a storage cell's corner
    const x = inParty ? r.x + r.w + 2 : Math.min(480 - 110, r.x + r.w - 10);
    const y = Math.min(270 - 12 - actions.length * 13, r.y + 6);
    actFocus.setItems(actions.map((a, k) => ({ id: a.id, rect: { x: x + 6, y: y + 6 + k * 13, w: 92, h: 13 }, enabled: a.enabled, reason: a.reason })), { keepId: false });
    actFocus.set(0, { force: true });
    mode = 'actions';
    sfx(G, 'confirm');
  }

  async function doAction(id) {
    const c = focused();
    if (!c) { mode = 'grid'; return; }
    if (id === 'move') { hand = { from: area === 'party' ? 'party' : 'box', uid: c.uid }; mode = 'grid'; sfx(G, 'confirm'); return; }
    if (id === 'summary') { mode = 'grid'; G.push('party', { summary: c.uid }); return; }
    if (id === 'release') {
      busy = true;
      const spec = confirmSpec('release', { nick: c.nickname });
      const pick = await openConfirm(G, spec);
      busy = false;
      mode = 'grid';
      if (pick !== 1) { sfx(G, 'cancel'); return; }
      const r = G.store.tx('box:release', (w) => partySys.release(w, c.uid, G.data, { bus: G.bus, tuning: tuning() }));
      if (r?.ok) { sfx(G, 'confirm'); toast(G, `${c.nickname} went back to the wild.`); layout(); } // str
      else { sfx(G, 'error'); toast(G, r?.reason === 'last' ? 'Your last companion stays with you.' : 'It stayed.'); } // str
    }
  }

  // ------------------------------------------------------------------------------ the hand --
  /** Moves party creature at `from` to index `to` with adjacent swaps (systems/party.swap). */
  function moveWithinParty(w, from, to) {
    let i = from;
    while (i < to) { partySys.swap(w, i, i + 1, { bus: G.bus }); i++; }
    while (i > to) { partySys.swap(w, i, i - 1, { bus: G.bus }); i--; }
  }

  function drop() {
    if (!hand) return;
    const w = world();
    const opts = { bus: G.bus, tuning: tuning() };
    const src = partySys.findCreature(w, hand.uid);
    if (!src) { hand = null; return; }
    let result = { ok: true, reason: '' };
    if (area === 'party') {
      const j = partyFocus.index;
      const target = w.party[j] ?? null;
      if (src.where === 'party') {
        if (target && target.uid === hand.uid) { hand = null; sfx(G, 'cancel'); return; }
        G.store.tx('box:party-move', (ww) => moveWithinParty(ww, src.index, Math.min(j, ww.party.length - 1)));
      } else if (!target) {
        result = G.store.tx('box:from-box', (ww) => partySys.fromBox(ww, hand.uid, G.data, opts));
      } else {
        result = G.store.tx('box:swap-in', (ww) => swapPartyBox(ww, target.uid, hand.uid, j, opts));
      }
    } else {
      const k = gridFocus.index;
      const target = w.box[k] ?? null;
      if (src.where === 'box') {
        // Storage reorder (LG-RN108): drop on a filled cell swaps, on an empty one moves it there
        if (target && target.uid === src.c.uid) { hand = null; sfx(G, 'cancel'); return; }
        const uid = hand.uid;
        result = target
          ? G.store.tx('box:swap', (ww) => partySys.boxSwap(ww, uid, target.uid, { bus: G.bus }))
          : G.store.tx('box:move', (ww) => partySys.boxMove(ww, uid, k, { bus: G.bus }));
      } else if (!target) result = G.store.tx('box:to-box', (ww) => partySys.toBox(ww, hand.uid, G.data, opts));
      else result = G.store.tx('box:swap-out', (ww) => swapPartyBox(ww, hand.uid, target.uid, src.index, opts));
    }
    if (result && result.ok === false) {
      sfx(G, 'blocked');
      const why = { last: 'Your last companion stays with you.', 'last-alive': 'Keep one awake creature in the party.', 'box-full': 'Storage is full.', 'party-full': 'The party is full.' }[result.reason] ?? 'It stayed put.'; // str
      toast(G, why);
      return;
    }
    hand = null;
    sfx(G, 'confirm');
    layout();
  }

  /**
   * Swaps party creature `pu` (at party index `at`) with stored creature `bu`, keeping the party
   * order: the stored one takes the party slot.
   */
  function swapPartyBox(w, pu, bu, at, opts) {
    const full = w.party.length >= PARTY_MAX;
    if (full) {
      const a = partySys.toBox(w, pu, G.data, opts);
      if (!a.ok) return a;
      const b = partySys.fromBox(w, bu, G.data, opts);
      if (!b.ok) { partySys.fromBox(w, pu, G.data, opts); return b; }
    } else {
      const b = partySys.fromBox(w, bu, G.data, opts);
      if (!b.ok) return b;
      const a = partySys.toBox(w, pu, G.data, opts);
      if (!a.ok) { partySys.toBox(w, bu, G.data, opts); return a; }
    }
    const i = w.party.findIndex((c) => c.uid === bu);
    if (i >= 0) moveWithinParty(w, i, Math.min(at, w.party.length - 1));
    return { ok: true };
  }

  // ------------------------------------------------------------------------- focus wiring --
  partyFocus.on('change', () => sfx(G, 'cursor'));
  gridFocus.on('change', () => sfx(G, 'cursor'));
  gridFocus.on('blocked', () => sfx(G, 'blocked'));
  actFocus.on('change', () => sfx(G, 'cursor'));
  actFocus.on('blocked', () => sfx(G, 'blocked'));
  actFocus.on('cancel', () => { mode = 'grid'; sfx(G, 'cancel'); });
  actFocus.on('activate', (ev) => { doAction(actions[ev.index]?.id); });
  const onActivate = () => { if (hand) drop(); else openActions(); };
  const onCancel = () => {
    if (hand) { hand = null; sfx(G, 'cancel'); return; }
    sfx(G, 'cancel');
    if (G.scenes.top() === scene) G.scenes.pop();
  };
  partyFocus.on('activate', onActivate); partyFocus.on('cancel', onCancel);
  gridFocus.on('activate', onActivate); gridFocus.on('cancel', onCancel);

  // -------------------------------------------------------------------------------- drawing --
  function drawSlot(ctx, skin, c, r, focusedHere, ghost) {
    if (!c) {
      ctx.fillStyle = skin.rule;
      for (let x = 0; x < r.w; x += 3) { ctx.fillRect(r.x + x, r.y, 1, 1); ctx.fillRect(r.x + x, r.y + r.h - 1, 1, 1); }
      for (let y = 0; y < r.h; y += 3) { ctx.fillRect(r.x, r.y + y, 1, 1); ctx.fillRect(r.x + r.w - 1, r.y + y, 1, 1); }
      if (focusedHere) { ctx.fillStyle = skin.band; ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2); }
      return;
    }
    drawCard(ctx, r, skin, { focused: focusedHere, dim: ghost });
  }

  function draw(ctx) {
    const prefs = prefsOf(G);
    const skin = skinOf(prefs);
    const w = world();
    drawBackdrop(ctx, prefs);
    drawHeading(ctx, 'Storage', `${w?.box?.length ?? 0} of ${cap}`); // str
    // party column
    drawSkinPanel(ctx, { x: PARTY_X - 4, y: PARTY_Y - 2, w: PARTY_W + 8, h: 12 + PARTY_MAX * (PARTY_H + 4) + 4 }, skin, 'paper');
    drawText(ctx, t('party.heading'), PARTY_X + 2, PARTY_Y + 2, { color: skin.soft });
    for (let i = 0; i < PARTY_MAX; i++) {
      const c = w?.party?.[i] ?? null;
      const r = partyRect(i);
      const here = area === 'party' && partyFocus.index === i;
      const ghost = !!(hand && c && hand.uid === c.uid);
      drawSlot(ctx, skin, c, r, here, ghost);
      if (c) {
        drawCreatureIcon(ctx, G, c, r.x + 5, r.y + 7, { grey: (c.hp | 0) <= 0, dim: ghost });
        drawText(ctx, c.nickname, r.x + 25, r.y + 5, { color: ghost ? skin.faint : skin.text, maxWidth: 70 });
        drawText(ctx, t('common.level', { level: c.level }), r.x + r.w - 5, r.y + 5, { color: skin.soft, align: 'right' });
        drawBar(ctx, { x: r.x + 25, y: r.y + 18, w: 60, h: 5, value: c.hp, max: c.stats?.hp ?? 1, kind: 'hp', dark: skin.dark });
      } else {
        drawText(ctx, t('save.slot.empty'), r.x + 8, r.y + 11, { color: skin.faint });
      }
      if (here) drawCursorAt(ctx, r.x + 1, r.y + 11, ms, skin);
    }
    // grid
    drawSkinPanel(ctx, { x: GRID_X - 6, y: GRID_Y - 2, w: COLS * CELL_W + 10, h: 12 + ROWS * CELL_H + 6 }, skin, 'paper');
    drawText(ctx, 'Storage', GRID_X, GRID_Y + 2, { color: skin.soft }); // str
    if (cap < BOX_CELLAR) drawText(ctx, `${cap} cells. The Cellar adds ${BOX_CELLAR - cap}.`, GRID_X + COLS * CELL_W - 4, GRID_Y + 2, { color: skin.faint, align: 'right' }); // str
    gridFocus.items.forEach((it, i) => {
      const r = cellRect(i);
      const c = w?.box?.[i] ?? null;
      const here = area === 'grid' && gridFocus.index === i;
      if (i >= cap) {
        ctx.fillStyle = skin.dark ? '#1C2442' : COLORS.paper.shade;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        drawIcon(ctx, 'lock', r.x + Math.floor(r.w / 2) - 4, r.y + Math.floor(r.h / 2) - 4, { ink: skin.faint });
        if (here) drawCursorAt(ctx, r.x + 1, r.y + 2, ms, skin);
        return;
      }
      const ghost = !!(hand && c && hand.uid === c.uid);
      drawSlot(ctx, skin, c, r, here, ghost);
      if (c) {
        drawCreatureIcon(ctx, G, c, r.x + 10, r.y + 6, { grey: (c.hp | 0) <= 0, dim: ghost });
        drawText(ctx, String(c.level), r.x + r.w - 3, r.y + r.h - 8, { font: 'small', color: skin.soft, align: 'right' });
      }
      if (here) drawCursorAt(ctx, r.x + 1, r.y + 2, ms, skin);
    });
    gridFocus.drawCursor(ctx, { style: skin.style, cursor: false, ring: area === 'grid' });
    // the hand: the lifted creature rides above the cursor
    if (hand) {
      const c = partySys.findCreature(w, hand.uid)?.c;
      const r = area === 'party' ? partyRect(partyFocus.index) : cellRect(gridFocus.index);
      const bobY = prefs.reduced ? 0 : (Math.floor(ms / 260) % 2);
      if (c) {
        ctx.fillStyle = COLORS.shadow;
        ctx.fillRect(r.x + r.w - 16, r.y + 2, 14, 3);
        drawCreatureIcon(ctx, G, c, r.x + r.w - 18, r.y - 14 - bobY);
      }
    }
    // detail card
    drawDetail(ctx, skin);
    if (mode === 'actions') drawActions(ctx, skin);
    const hints = hand ? [['confirm', 'Put here'], ['cancel', 'Put back']] : [['confirm', 'Choose'], ['cancel', 'Back']]; // str
    drawHints(ctx, G.input, hints);
  }

  function drawDetail(ctx, skin) {
    const box = { x: GRID_X - 6, y: 214, w: COLS * CELL_W + 10, h: 40 };
    drawSkinPanel(ctx, box, skin, 'card');
    const c = hand ? partySys.findCreature(world(), hand.uid)?.c : focused();
    if (!c) {
      const locked = area === 'grid' && gridFocus.index >= cap;
      drawText(ctx, locked ? 'Locked. The Cellar commission opens these cells.' : hand ? '' : 'An empty slot.', box.x + 10, box.y + 15, { color: skin.faint }); // str
      return;
    }
    drawCreature(ctx, G, c, box.x + 6, box.y + 4, { scale: 1, grey: (c.hp | 0) <= 0 });
    const sp = lookOf(G.data).speciesOrNull(c.speciesId);
    drawText(ctx, `${c.nickname}`, box.x + 44, box.y + 7, { color: skin.text });
    drawText(ctx, `${sp?.name ?? c.speciesId}  ${t('common.level', { level: c.level })}`, box.x + 44, box.y + 20, { color: skin.soft });
    let tx = box.x + 160;
    for (const ty of typesOf(c)) tx += drawTypeChip(ctx, chipId(ty), tx, box.y + 5, { dark: skin.dark }) + 2;
    drawBar(ctx, { x: box.x + 160, y: box.y + 22, w: 64, h: 5, value: c.hp, max: c.stats?.hp ?? 1, kind: 'hp', dark: skin.dark });
    drawText(ctx, `${c.hp}/${c.stats?.hp ?? 0}`, box.x + 228, box.y + 22, { font: 'small', color: skin.text });
    if (c.heldItem) drawText(ctx, `${t('summary.held')}: ${lookOf(G.data).itemOrNull(c.heldItem)?.name ?? c.heldItem}`, box.x + box.w - 8, box.y + 7, { color: skin.soft, align: 'right', maxWidth: 70 });
    if (hand) drawText(ctx, 'In hand', box.x + box.w - 8, box.y + 22, { color: skin.accent, align: 'right' }); // str
  }

  function drawActions(ctx, skin) {
    const items = actFocus.items;
    if (!items.length) return;
    const r0 = items[0].rect;
    const box = { x: r0.x - 6, y: r0.y - 6, w: r0.w + 12, h: items.length * 13 + 12 };
    drawSkinPanel(ctx, box, skin, 'notice', { torn: 'none' });
    actions.forEach((a, k) => {
      const r = items[k].rect;
      const here = actFocus.index === k;
      if (here) { ctx.fillStyle = skin.band; ctx.fillRect(r.x, r.y, r.w, r.h - 1); }
      drawText(ctx, a.enabled ? a.label : `– ${a.label}`, r.x + 9, r.y + 3, { color: a.enabled ? (a.id === 'release' ? skin.bad : skin.text) : skin.faint });
      if (here) drawCursorAt(ctx, r.x, r.y + 3, ms, skin);
    });
    actFocus.drawCursor(ctx, { style: skin.style, cursor: false, ring: false });
  }

  // ---------------------------------------------------------------------------------- scene --
  const scene = {
    name: 'box',
    opaque: true,
    enter() {
      G.input?.flush?.();
      ms = 0; hand = null; mode = 'grid'; area = 'grid';
      layout();
      gridFocus.set(0, { force: true });
      partyFocus.set(0, { force: true });
    },
    exit() {},
    pause() {},
    resume() { G.input?.flush?.(); layout(); },
    update(dt) {
      ms += dt;
      partyFocus.update(dt); gridFocus.update(dt); actFocus.update(dt);
    },
    handleInput(input) {
      if (busy) return;
      const p = input.pointer;
      if (mode === 'actions') {
        const r0 = actFocus.items[0]?.rect;
        if (p && p.justDown && p.inside && r0) {
          const bx = r0.x - 6, by = r0.y - 6, bw = r0.w + 12, bh = actFocus.items.length * 13 + 12;
          if (p.x < bx || p.x >= bx + bw || p.y < by || p.y >= by + bh) { mode = 'grid'; sfx(G, 'cancel'); return; }
        }
        actFocus.handle(input);
        return;
      }
      if (p && p.justDown && p.inside) area = p.x < GRID_X - 6 ? 'party' : 'grid';
      if (area === 'party') {
        if (input.repeat('right')) { area = 'grid'; gridFocus.set(Math.min(cap - 1, Math.min(partyFocus.index, ROWS - 1) * COLS), { force: true }); sfx(G, 'cursor'); return; }
        partyFocus.handle(input);
      } else {
        if (input.repeat('left') && gridFocus.index % COLS === 0) {
          area = 'party';
          partyFocus.set(Math.min(PARTY_MAX - 1, Math.floor(gridFocus.index / COLS)), { force: true });
          sfx(G, 'cursor');
          return;
        }
        gridFocus.handle(input);
      }
    },
    draw,
    debugText() {
      const w = world();
      return [`Storage ${w?.box?.length ?? 0}/${cap}`, `area: ${area} ${area === 'party' ? partyFocus.index : gridFocus.index}`, hand ? `hand: ${hand.uid}` : 'hand: empty',
        `party: ${(w?.party ?? []).map((c) => c.nickname).join(', ')}`, `box: ${(w?.box ?? []).map((c) => c.nickname).join(', ')}`].join('\n');
    },
    get hand() { return hand; },
    get capacity() { return cap; },
  };
  return scene;
}
