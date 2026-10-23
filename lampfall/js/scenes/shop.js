/**
 * Shop counter and the Consignment Crate. [SCN-UI] — GDD-00 §7, §9, §13 "Shop"; GDD-09 §3.15.
 *
 * Header: the keeper's 48×48 bust at 16,8, the shop's name and greeting (the keeper's replies take
 * its place for a moment), and the *Wanted today* slip pinned top-right (three items at +50%).
 * Tabs Buy / Sell (L / R, or a tap). Rows 16 px: pocket icon, name, `×held`, a `+50%` chip on Wanted
 * rows, the price; sold-out and capped rows say why. The foot card shows the item's text, or for a
 * disc the move (type chip, category, power, accuracy, PP) and the learner strip (party heads, lit =
 * can learn, ✦ = knows it), and on the right the wallet and *After: n*.
 *
 * Buying and selling go through `systems/shops` inside `store.tx` (stock from `stockFor` via
 * `listing`, prices fixed, the Starsalt cap, one-of-a-kind asks first, Freefall's dear-disc confirm
 * with No first). Stackables open a quantity picker (left / right ±1, up / down ±10) with the total
 * and the after-wallet. Outside its hours a shop shows the *Closed* slip and only lets you leave.
 *
 * `params.mode === 'crate'` (or `shop: 'crate'`) is the Consignment Crate at your gate: deposit
 * anything with a value for 90% paid at dawn, and take things back out before then.
 *
 * Params: `{shop, mode?: 'buy'|'sell'|'crate', from?, onClose?}`. Pops with `{shop, bought, sold}`.
 * @module scenes/shop
 */
import { drawText, measureText } from '../core/font.js';
import { drawSprite, isSprite } from '../core/pixelart.js';
import { formatMinute } from '../core/time.js';
import { createList } from '../ui/list.js';
import { createTabs } from '../ui/tabs.js';
import { createConfirmScene } from '../ui/confirm.js';
import { drawPanel } from '../ui/panel.js';
import { drawIcon, getPortraitPlaceholder } from '../ui/icons.js';
import { drawTypeChip, drawCurrency, drawBadge, formatNumber, drawKeyGlyph } from '../ui/widgets.js';
import { COLORS, PALETTE, TIMING, TYPE, DEVICE_LABELS } from '../ui/theme.js';
import { portraitSprite, PORTRAIT_IDS } from '../art/portraits.js';
import { getCreatureIcon } from '../art/creatures/index.js';
import { t } from '../data/strings.js';
import * as shops from '../systems/shops.js';
import * as bag from '../systems/bag.js';
import { itemOf } from '../systems/econ.js';
import { POCKET_IDS } from '../state/schema.js';
import { reducedMotion, skipAnims, framesMs } from './scriptHost.js';

/** Layout (GDD-09 §3.15, adapted to the header band). */
export const LIST_RECT = Object.freeze({ x: 16, y: 78, w: 448, h: 118 });
export const ROW_H = 16;
export const FOOT = Object.freeze({ x: 16, y: 200, w: 448, h: 62 });
export const CRATE_ID = 'crate';

/** Pocket -> icon. */
const POCKET_ICON = Object.freeze({ wicks: 'lantern', medicine: null, discs: 'read', finds: 'dig', held: 'key', keepsakes: 'star', tools: 'key' });
/** Item kind -> icon (gathered goods read by what they are). */
const KIND_ICON = Object.freeze({ fish: 'fish', bug: 'shake', fruit: 'shake', relic: 'dig', fossil: 'dig', shore: 'wave', disc: 'read', wick: 'lantern' });

/**
 * Whether a creature can be taught a move by disc: its form's learnset or `flags.teachable`.
 * @param {any} data
 * @param {any} c   creature
 * @param {string} moveId
 * @returns {'knows'|'can'|'cannot'}
 */
export function learnerState(data, c, moveId) {
  if ((c.moves ?? []).some((m) => m.id === moveId)) return 'knows';
  const sp = data && typeof data.has === 'function' && data.has('species', c.speciesId) ? data.get('species', c.speciesId) : null;
  if (!sp) return 'cannot';
  const ls = Array.isArray(sp.learnset) ? sp.learnset : [];
  const teach = Array.isArray(sp.flags?.teachable) ? sp.flags.teachable : [];
  return ls.some((r) => (Array.isArray(r) ? r[1] : r?.move) === moveId) || teach.includes(moveId) ? 'can' : 'cannot';
}

/**
 * The satchel's stacks (every pocket but tools), merged by item id, in pocket order. Pure.
 * @param {any} world
 * @returns {Array<{id: string, n: number, pocket: string}>}
 */
export function satchelStacks(world) {
  /** @type {Map<string, {id: string, n: number, pocket: string}>} */
  const out = new Map();
  for (const p of POCKET_IDS) {
    if (p === 'tools') continue;
    for (const s of world?.bag?.pockets?.[p] ?? []) {
      const cur = out.get(s.id);
      if (cur) cur.n += s.n; else out.set(s.id, { id: s.id, n: s.n, pocket: p });
    }
  }
  return [...out.values()];
}

/**
 * @param {any} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string, isBusy: () => boolean}}
 */
export function createShopScene(G) {
  /** @type {any} */ let params = {};
  /** @type {any} */ let shop = null;
  let crate = false;
  let open = true;
  /** @type {any} */ let tabs = null;
  /** @type {any} */ let list = null;
  /** @type {string[]} */ let wanted = [];
  let message = '', messageMs = 0, messageKind = 'info';
  let shownWallet = 0;
  /** @type {null | {item: any, mode: string, n: number, max: number, unit: number}} */ let qty = null;
  let pendingConfirm = null; // {kind, item, n}
  let state = 'browse'; // browse | qty | confirm | closing | done
  let stateT = 0;
  let qtyLock = 0; // ms the quantity receipt ignores confirm (a mashed confirm never buys twice)
  let bought = 0, sold = 0;
  let bob = 0;

  const ctx = () => ({ data: G.data, bus: G.bus });
  const emit = (evt, p) => { try { G.bus?.emit(evt, p ?? {}); } catch { /* never break the counter */ } };

  function say(text, kind = 'info') { message = text; messageMs = 2600; messageKind = kind; }

  function keeperName() {
    const k = shop?.keeper;
    if (k && G.data?.has?.('npcs', k)) return G.data.get('npcs', k).name;
    return k ? k.charAt(0).toUpperCase() + k.slice(1) : '';
  }

  // ------------------------------------------------------------------ rows
  function buyRows() {
    const rows = shops.listing(G.world, shop.id, {
      ...ctx(),
      learnersOf: (moveId) => G.world.party.filter((c) => learnerState(G.data, c, moveId) === 'can').map((c) => c.uid),
    });
    return rows.map((r) => {
      const it = itemOf(G.data, r.item);
      const isStarsalt = bag.walletCurrencyOf(it) === 'starsalt';
      const out = r.left === 0;
      return {
        id: r.item, label: r.name, enabled: true,
        data: { ...r, row: it, mode: 'buy', soldOut: out, reason: out ? (isStarsalt ? t('shop.dailyCap') : t('shop.soldOut')) : null, wanted: false },
      };
    });
  }

  function sellRows() {
    const stacks = satchelStacks(G.world);
    const out = [];
    for (const s of stacks) {
      const it = itemOf(G.data, s.id);
      if (!it || !shops.buysItem(shop, it)) continue;
      const unit = shops.sellValue(it, ctx());
      if (unit <= 0) continue;
      const wantedLeft = shops.wantedLeft(G.world, shop, s.id, ctx());
      out.push({
        id: s.id, label: it.name ?? s.id, enabled: true,
        data: { item: s.id, row: it, mode: 'sell', have: s.n, price: unit, wanted: wantedLeft > 0, wantedPrice: Math.round(unit * 1.5), pocket: s.pocket },
      });
    }
    out.sort((a, b) => Number(b.data.wanted) - Number(a.data.wanted));
    return out;
  }

  function crateRows() {
    const out = [];
    for (const s of satchelStacks(G.world)) {
      const it = itemOf(G.data, s.id);
      if (!it) continue;
      const each = shops.crateValue(it, 1, ctx());
      if (each <= 0) continue;
      out.push({ id: s.id, label: it.name ?? s.id, enabled: true, data: { item: s.id, row: it, mode: 'deposit', have: s.n, price: each, pocket: s.pocket } });
    }
    return out;
  }

  function crateContents() {
    return (G.world.shops.crate ?? []).map((s) => {
      const it = itemOf(G.data, s.id);
      return { id: s.id, label: it?.name ?? s.id, enabled: true, data: { item: s.id, row: it, mode: 'withdraw', have: s.n, price: shops.crateValue(it, 1, ctx()) } };
    });
  }

  function refresh() {
    const tab = tabs.active;
    const rows = crate ? (tab === 'in' ? crateContents() : crateRows()) : tab === 'sell' ? sellRows() : buyRows();
    for (const r of rows) if (r.data.mode === 'buy') r.data.wanted = false;
    list.setItems(rows);
    wanted = !crate && shop ? shops.wantedToday(G.world, shop, undefined, ctx()) : [];
  }

  // ------------------------------------------------------------------ actions
  function activate(item) {
    if (!item) return;
    const d = item.data;
    if (!crate && !open) { say(closedText(), 'warn'); emit('ui:blocked'); return; }
    if (d.mode === 'buy') {
      if (d.soldOut) { say(d.reason, 'warn'); emit('ui:blocked'); return; }
      if (G.world.wallet.main < d.price) { say(t('shop.cantAfford'), 'warn'); emit('ui:blocked'); return; }
      const stack = d.row?.stack ?? 1;
      const byMoney = Math.floor(G.world.wallet.main / Math.max(1, d.price));
      const max = Math.max(1, Math.min(d.left === null ? 99 : d.left, byMoney, stack > 1 ? 99 : 1));
      openQty(d, 'buy', max, d.price); // the panel is the receipt: total and After before paying
      return;
    }
    if (d.mode === 'sell') {
      openQty(d, 'sell', d.have, d.price);
      return;
    }
    if (d.mode === 'deposit') {
      openQty(d, 'deposit', d.have, d.price);
      return;
    }
    if (d.mode === 'withdraw') {
      if (d.have > 1) { openQty(d, 'withdraw', d.have, d.price); return; }
      doWithdraw(d.item, 1);
    }
  }

  function openQty(d, mode, max, unit) {
    qty = { item: d, mode, n: 1, max, unit };
    state = 'qty';
    stateT = 0;
    qtyLock = TIMING.choiceLockMs;
    emit('ui:confirm');
  }

  function commitQty() {
    const q = /** @type {any} */ (qty);
    qty = null;
    state = 'browse';
    if (q.mode === 'buy') doBuy(q.item.item, q.n, false);
    else if (q.mode === 'sell') doSell(q.item.item, q.n, false);
    else if (q.mode === 'deposit') doDeposit(q.item.item, q.n, false);
    else doWithdraw(q.item.item, q.n);
  }

  function ask(kind, body, options, defaultIndex, payload) {
    pendingConfirm = { kind, ...payload };
    state = 'confirm';
    G.scenes.push(createConfirmScene({
      body, options, defaultIndex, input: G.input, stack: G.scenes, danger: kind === 'sellKeepsake',
      width: G.display?.width || 480, height: G.display?.height || 270, onDone: () => {},
    }));
  }

  function doBuy(itemId, n, confirm) {
    const res = G.store.tx('shop:buy', (w) => shops.buy(w, shop.id, itemId, n, { ...ctx(), confirm }));
    const name = itemOf(G.data, itemId)?.name ?? itemId;
    if (res.ok) {
      bought += n;
      emit('sfx', { name: 'coin' });
      say(res.overflow > 0 ? `${t('shop.thanks')} Some went in the basket at your feet.` : t('shop.thanks')); // str
      refresh();
      return;
    }
    if (res.needsConfirm) {
      ask('buyDear', t('confirm.buyDear', { item: name, total: formatNumber(res.unitPrice * n) }), [t('confirm.no'), t('confirm.option.buy')], 0, { item: itemId, n });
      return;
    }
    emit('ui:blocked');
    const reasons = {
      closed: closedText(), 'sold-out': t('shop.soldOut'), 'daily-cap': t('shop.dailyCap'), insufficient: t('shop.cantAfford'),
      'already-held': 'You already have one.', 'not-stocked': 'Not on the shelf today.', 'not-sold': 'Not sold on this dial.', // str
    };
    say(reasons[res.reason] ?? String(res.reason), 'warn');
  }

  function doSell(itemId, n, confirm) {
    const res = G.store.tx('shop:sell', (w) => shops.sell(w, shop.id, itemId, n, { ...ctx(), confirm }));
    const name = itemOf(G.data, itemId)?.name ?? itemId;
    if (res.ok) {
      sold += n;
      emit('sfx', { name: 'coin' });
      say(res.wantedUnits > 0 ? `Wanted today! ${formatNumber(res.earned)}◉.` : `${formatNumber(res.earned)}◉. ${t('shop.thanks')}`); // str
      refresh();
      return;
    }
    if (res.needsConfirm) {
      ask('sellKeepsake', t('confirm.sellKeepsake', { item: name }), [t('confirm.option.keep'), t('confirm.option.sell')], 0, { item: itemId, n });
      return;
    }
    emit('ui:blocked');
    say(res.reason === 'closed' ? closedText() : res.reason === 'not-buying' ? 'Not something I buy.' : String(res.reason), 'warn'); // str
  }

  function doDeposit(itemId, n, confirm) {
    const res = G.store.tx('crate:deposit', (w) => shops.crateDeposit(w, itemId, n, { ...ctx(), confirm }));
    const name = itemOf(G.data, itemId)?.name ?? itemId;
    if (res.ok) {
      emit('sfx', { name: 'fruitDrop' });
      say(t('shop.crateAdded', { item: n > 1 ? `${n} × ${name}` : name }));
      refresh();
      return;
    }
    if (res.needsConfirm) {
      ask('crateKeepsake', t('confirm.sellKeepsake', { item: name }), [t('confirm.option.keep'), t('confirm.option.sell')], 0, { item: itemId, n });
      return;
    }
    emit('ui:blocked');
    say(String(res.reason), 'warn');
  }

  function doWithdraw(itemId, n) {
    const res = G.store.tx('crate:withdraw', (w) => shops.crateWithdraw(w, itemId, n, ctx()));
    if (res.ok) { emit('ui:cancel'); say('Back in your satchel.'); refresh(); return; } // str
    emit('ui:blocked');
  }

  function closedText() {
    const h = shop?.hours ?? [0, 0];
    return t('shop.closed', { open: formatMinute(h[0]), close: formatMinute(h[1]) });
  }

  function leave() {
    state = 'closing';
    stateT = 0;
    emit('ui:cancel');
  }

  function popNow() {
    state = 'done';
    const result = { shop: shop?.id ?? null, bought, sold };
    // pop first: a callback that opens the next screen must not bury this one under it
    if (G.scenes.top() === scene) G.scenes.pop(result);
    if (typeof params.onClose === 'function') { try { params.onClose(result); } catch (e) { console.warn(e); } }
  }

  // ------------------------------------------------------------------ the scene
  const scene = {
    name: 'shop',
    opaque: true,
    enter(p) {
      params = p ?? {};
      crate = params.mode === 'crate' || params.shop === CRATE_ID;
      shop = crate ? { id: CRATE_ID, name: 'Consignment Crate', keeper: null, hours: [0, 0] } : shops.shopRow(params.shop, ctx()); // str
      if (!shop) {
        console.warn(`shop: unknown shop '${params.shop}'`);
        shop = { id: String(params.shop ?? 'shop'), name: 'Shop', keeper: null, hours: [0, 0], stock: [], buys: [] }; // str
      }
      open = crate || shops.isOpen(G.world, shop, ctx());
      bought = 0; sold = 0; qty = null; pendingConfirm = null; message = ''; messageMs = 0;
      state = 'browse'; stateT = 0;
      shownWallet = G.world.wallet.main;
      const tabDefs = crate
        ? [{ id: 'deposit', label: 'Deposit' }, { id: 'in', label: 'In the crate' }] // str
        : [{ id: 'buy', label: t('shop.buy') }, { id: 'sell', label: t('shop.sell') }];
      tabs = createTabs({ tabs: tabDefs, rect: { x: 16, y: 62, w: 448 }, input: G.input, dpad: true, active: params.mode === 'sell' ? 'sell' : undefined, onChange: () => { refresh(); list.select(0); emit('ui:cursor'); } });
      list = createList({
        rect: { x: LIST_RECT.x + 4, y: LIST_RECT.y + 3, w: LIST_RECT.w - 10, h: 7 * ROW_H },
        rowH: ROW_H, items: [], input: G.input, pager: false, markers: false,
        render: renderRow,
        onSelect: (item) => activate(item),
        onCancel: () => leave(),
        onChange: () => emit('ui:cursor'),
      });
      refresh();
      if (!crate && !open) say(closedText(), 'warn');
    },
    exit() {},
    resume(result) {
      if (state !== 'confirm' || !pendingConfirm) return;
      const pc = pendingConfirm;
      pendingConfirm = null;
      state = 'browse';
      if (result !== 1) { say('Kept it.'); return; } // str
      if (pc.kind === 'buyDear') doBuy(pc.item, pc.n, true);
      else if (pc.kind === 'sellKeepsake') doSell(pc.item, pc.n, true);
      else if (pc.kind === 'crateKeepsake') doDeposit(pc.item, pc.n, true);
    },
    update(dt) {
      stateT += dt;
      bob = (bob + dt) % TIMING.cursorBobMs;
      if (messageMs > 0) { messageMs -= dt; if (messageMs <= 0) message = ''; }
      if (qtyLock > 0) qtyLock = Math.max(0, qtyLock - dt);
      list?.update(dt);
      const target = G.world.wallet.main;
      if (shownWallet !== target) {
        const stepV = Math.max(1, Math.ceil(Math.abs(target - shownWallet) / 6));
        shownWallet = skipAnims(G) ? target : shownWallet < target ? Math.min(target, shownWallet + stepV) : Math.max(target, shownWallet - stepV);
      }
      if (state === 'closing' && stateT >= framesMs(G, 4)) popNow();
    },
    handleInput(input) {
      if (state === 'closing' || state === 'done' || state === 'confirm') return;
      if (state === 'qty' && qty) {
        const q = qty;
        const rep = (d) => input.repeat(d, { delay: TIMING.repeatDelayMs, rate: TIMING.repeatRateMs });
        const before = q.n;
        if (rep('right')) q.n = q.n >= q.max ? 1 : q.n + 1;
        if (rep('left')) q.n = q.n <= 1 ? q.max : q.n - 1;
        if (rep('up')) q.n = Math.min(q.max, q.n + 10);
        if (rep('down')) q.n = Math.max(1, q.n - 10);
        if (q.n !== before) emit('ui:cursor');
        const p = input.pointer;
        if (p && p.inside && p.justDown) {
          const B = qtyRects();
          if (hit(p, B.minus)) { q.n = Math.max(1, q.n - 1); emit('ui:cursor'); }
          else if (hit(p, B.plus)) { q.n = Math.min(q.max, q.n + 1); emit('ui:cursor'); }
          else if (hit(p, B.ok)) { if (qtyLock <= 0) commitQty(); }
          else if (!hit(p, B.panel)) { qty = null; state = 'browse'; emit('ui:cancel'); }
          return;
        }
        if (input.pressed('confirm')) { if (qtyLock <= 0) commitQty(); }
        else if (input.pressed('cancel')) { qty = null; state = 'browse'; emit('ui:cancel'); }
        return;
      }
      // one press does one thing: a tab switch (L / R, or the d-pad left / right) never also pages the list
      const before = tabs.active;
      tabs.handle(input);
      if (tabs.active !== before) return;
      const p = input.pointer;
      if (p && p.inside && p.justDown && hit(p, backRect())) { leave(); return; }
      list.handle(input);
    },
    draw(c) {
      c.fillStyle = PALETTE.nightInk;
      c.fillRect(0, 0, 480, 270);
      drawHeader(c);
      drawPanel(c, LIST_RECT, 'ledger', { rulePitch: ROW_H, ruleStart: 3 + ROW_H, margin: 0 });
      tabs.draw(c);
      list.draw(c);
      if (!crate && !open) drawClosed(c);
      drawFoot(c);
      if (state === 'qty' && qty) drawQty(c);
      if (state === 'closing') {
        c.save();
        c.globalAlpha = Math.min(1, stateT / Math.max(1, framesMs(G, 4)));
        c.fillStyle = PALETTE.nightInk;
        c.fillRect(0, 0, 480, 270);
        c.restore();
      }
    },
    debugText() {
      const sel = list?.selected();
      const all = (list?.items ?? []).map((r, i) => `${list.index === i ? '>' : ' '} ${r.label} ${r.data.price ?? ''}`);
      const from = Math.max(0, Math.min(all.length - 12, (list?.index ?? 0) - 5));
      const rows = all.slice(from, from + 12); // a window around the cursor
      return [`${shop?.name ?? 'shop'} [${tabs?.active}]${open ? '' : ' CLOSED'}`, ...rows, sel ? `After: ${previewOf(sel.data, qty?.n ?? 1).after}` : '', message].filter(Boolean).join('\n');
    },
    isBusy: () => state === 'closing' || shownWallet !== G.world.wallet.main || (state === 'qty' && qtyLock > 0),
    get state() { return state; },
  };

  function hit(p, r) { return p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h; }
  /** The Back hint by the tabs, which is also a tap target (≥ 16 px tall). */
  function backRect() { const x = 382 - (wanted.length && !crate ? 70 : 0); return { x: x - 4, y: 58, w: 52, h: 18 }; }

  function previewOf(d, n) {
    const w = G.world.wallet.main;
    if (d.mode === 'buy') return { total: d.price * n, after: w - d.price * n };
    if (d.mode === 'sell') {
      const q = shops.sellQuote(G.world, shop, d.item, n, ctx());
      return { total: q.total, after: w + q.total };
    }
    if (d.mode === 'deposit') return { total: shops.crateValue(d.row, n, ctx()), after: w };
    return { total: 0, after: w };
  }

  // ------------------------------------------------------------------ drawing
  function renderRow(c, item, x, y, w, focused) {
    const d = item.data;
    const dim = (!crate && !open) || d.soldOut || (d.mode === 'buy' && !d.canAfford);
    const ink = dim ? COLORS.paper.inkFaint : COLORS.paper.ink;
    const pocket = d.pocket ?? bag.pocketOf(d.row, ctx());
    const icon = KIND_ICON[d.row?.kind] ?? (pocket in POCKET_ICON ? POCKET_ICON[pocket] : 'coin');
    if (icon) drawIcon(c, icon, x + 3, y + 4, { ink: dim ? COLORS.paper.inkFaint : COLORS.paper.ink });
    else drawMedicine(c, x + 3, y + 4, dim);
    let lx = x + 15;
    drawText(c, item.label, lx, y + 5, { color: ink, maxWidth: 200 });
    lx += Math.min(200, measureText(item.label).w) + 6;
    const isWanted = d.mode === 'sell' ? d.wanted : wanted.includes(d.item);
    if (isWanted && d.mode === 'sell') { drawBadge(c, '+50%', lx, y + 3, { style: 'unique', small: true }); lx += 30; }
    const have = d.mode === 'buy' ? d.have : d.have;
    if (have > 0) drawText(c, `×${have}`, lx, y + 6, { font: 'small', color: COLORS.paper.inkSoft });
    const right = x + w - 4;
    if (d.soldOut) {
      drawText(c, d.reason === t('shop.dailyCap') ? 'Cap reached' : t('shop.soldOut'), right, y + 6, { align: 'right', font: 'small', color: COLORS.role.disabled }); // str
    } else {
      const price = d.mode === 'sell' && d.wanted ? d.wantedPrice : d.price;
      const label = d.mode === 'deposit' || d.mode === 'withdraw' ? `${formatNumber(price)}◉ ea at dawn` : `${formatNumber(price)}◉`; // str
      drawText(c, label, right, y + 5, { align: 'right', color: d.mode === 'buy' && !d.canAfford ? PALETTE.r : ink });
      if (d.mode === 'buy' && d.left !== null && d.left !== undefined && d.left < 20) drawText(c, `${d.left} left`, right - measureText(label).w - 8, y + 6, { align: 'right', font: 'small', color: COLORS.paper.inkFaint }); // str
    }
  }

  function drawHeader(c) {
    // bust
    c.fillStyle = COLORS.paper.shade;
    c.fillRect(16, 8, 48, 48);
    const keeper = shop?.keeper;
    const spr = keeper && PORTRAIT_IDS.includes(keeper) ? portraitSprite(keeper) : null;
    if (spr && isSprite(spr)) drawSprite(c, spr, 16, 8);
    else if (crate) { drawIcon(c, 'tally', 28, 20, { scale: 3 }); }
    else drawSprite(c, getPortraitPlaceholder(), 24, 16);
    c.fillStyle = COLORS.paper.edge;
    c.fillRect(16, 56, 48, 1);
    // name + greeting / reply
    drawText(c, shop?.name ?? '', 72, 10, { color: COLORS.paper.light, scale: 1 });
    const sub = crate ? '90% of value, paid at dawn' : keeperName(); // str
    drawText(c, sub, 72 + measureText(shop?.name ?? '').w + 8, 11, { font: 'small', color: COLORS.dark.textSoft });
    const line = message || (crate ? 'Anything you leave sells overnight at 90%. Paid at dawn.' : shop?.greeting ?? ''); // str
    const color = message && messageKind === 'warn' ? COLORS.brass.light : COLORS.paper.fill;
    drawText(c, message ? `“${line}”` : line, 72, 24, { color, maxWidth: wanted.length ? 236 : 380 });
    // wanted slip
    if (wanted.length && !crate) {
      const R = { x: 318, y: 3, w: 150, h: 54 };
      drawPanel(c, R, 'notice', { torn: 'bottom', pin: true });
      drawText(c, 'Wanted today', R.x + 8, R.y + 7, { color: COLORS.wax.fill }); // str
      drawText(c, t('shop.wantedBonus'), R.x + R.w - 8, R.y + 8, { align: 'right', font: 'small', color: COLORS.paper.inkSoft });
      wanted.forEach((id, i) => {
        const name = itemOf(G.data, id)?.name ?? id;
        const have = bag.count(G.world, id, undefined, ctx());
        drawText(c, `• ${name}`, R.x + 8, R.y + 18 + i * 10, { color: COLORS.paper.ink, maxWidth: R.w - 34 });
        if (have > 0) drawText(c, `×${have}`, R.x + R.w - 8, R.y + 19 + i * 10, { align: 'right', font: 'small', color: COLORS.paper.inkSoft });
      });
    } else if (!crate && shop?.hours) {
      drawText(c, `${formatMinute(shop.hours[0])}–${formatMinute(shop.hours[1])}`, 464, 10, { align: 'right', font: 'small', color: COLORS.dark.textSoft });
    }
    // leave hint
    const dev = G.input?.lastDevice === 'gamepad' ? 'gamepad' : G.input?.lastDevice === 'touch' ? 'touch' : 'keyboard';
    drawKeyGlyph(c, dev, DEVICE_LABELS[dev].cancel, 382 - (wanted.length && !crate ? 70 : 0), 62 + 2);
    drawText(c, t('common.back'), 394 - (wanted.length && !crate ? 70 : 0), 66, { font: 'small', color: COLORS.dark.textSoft });
  }

  function drawClosed(c) {
    const R = { x: 160, y: 118, w: 160, h: 40 };
    drawPanel(c, R, 'notice', { torn: 'both', pin: true });
    drawText(c, 'CLOSED', R.x + R.w / 2, R.y + 9, { align: 'center', color: COLORS.wax.fill }); // str
    drawText(c, closedText().replace(/^Closed\. /, ''), R.x + R.w / 2, R.y + 22, { align: 'center', font: 'small', color: COLORS.paper.ink });
  }

  function drawFoot(c) {
    drawPanel(c, FOOT, 'paper', { grain: false });
    const sel = list?.selected();
    const d = sel?.data;
    const L = FOOT.x + 8, T0 = FOOT.y + 6;
    // wallet and After
    const w = G.world.wallet.main;
    drawCurrency(c, shownWallet, FOOT.x + FOOT.w - 8, T0, { align: 'right' });
    if (d) {
      const pv = previewOf(d, qty?.n ?? 1);
      if (d.mode === 'deposit' || d.mode === 'withdraw') {
        drawText(c, `In the crate: ${formatNumber(shops.crateEstimate(G.world, ctx()))}◉ at dawn`, FOOT.x + FOOT.w - 8, T0 + 12, { align: 'right', font: 'small', color: COLORS.paper.inkSoft }); // str
      } else {
        const neg = pv.after < 0;
        drawText(c, t('shop.after', { n: `${formatNumber(pv.after)}◉` }), FOOT.x + FOOT.w - 8, T0 + 12, { align: 'right', color: neg ? PALETTE.r : COLORS.paper.inkSoft });
        if (neg) drawText(c, '× short', FOOT.x + FOOT.w - 8, T0 + 23, { align: 'right', font: 'small', color: PALETTE.r }); // str
      }
    } else if (crate) {
      drawText(c, `At dawn: ${formatNumber(shops.crateEstimate(G.world, ctx()))}◉`, FOOT.x + FOOT.w - 8, T0 + 12, { align: 'right', font: 'small', color: COLORS.paper.inkSoft }); // str
    }
    if (!d) {
      drawText(c, crate && tabs.active === 'in' ? 'The crate is empty.' : tabs.active === 'sell' ? 'Nothing here this counter buys.' : 'Nothing on the shelf.', L, T0 + 4, { color: COLORS.paper.inkFaint }); // str
      return;
    }
    const it = d.row ?? {};
    const moveId = typeof it.move === 'string' ? it.move : d.move ?? null;
    const mv = moveId && G.data?.has?.('moves', moveId) ? G.data.get('moves', moveId) : null;
    if (mv) {
      let x = L;
      drawTypeChip(c, String(mv.type ?? 'plain').toLowerCase(), x, T0 - 1);
      x += 40;
      const cat = mv.category === 'physical' ? 'Physical' : mv.category === 'special' ? 'Special' : 'Status'; // str
      const stats = `${cat}  Pow ${mv.power || '—'}  Acc ${mv.accuracy ?? '—'}  PP ${mv.pp ?? '—'}`; // str
      drawText(c, stats, x, T0, { color: COLORS.paper.ink });
      drawText(c, mv.text ?? it.text ?? '', L, T0 + 11, { font: 'small', color: COLORS.paper.inkSoft, maxWidth: 300 });
      // learner strip
      drawText(c, t('shop.learners'), L, T0 + 40, { font: 'small', color: COLORS.paper.inkSoft });
      const party = G.world.party ?? [];
      if (!party.length) return;
      let any = false;
      party.forEach((cr, i) => {
        const st = learnerState(G.data, cr, mv.id);
        if (st !== 'cannot') any = true;
        drawHead(c, L + 36 + i * 21, T0 + 34, cr, st);
      });
      if (!any) drawText(c, t('shop.noLearners'), L + 36 + party.length * 21 + 4, T0 + 40, { font: 'small', color: COLORS.role.disabled });
      return;
    }
    const kind = typeof it.kind === 'string' ? it.kind.charAt(0).toUpperCase() + it.kind.slice(1) : '';
    const worth = shops.sellValue(it, ctx());
    const fallback = `${kind}${worth > 0 ? `${kind ? ', ' : ''}worth ${formatNumber(worth)}◉ at a counter` : ''}`; // str
    drawText(c, it.text ?? fallback, L, T0, { color: COLORS.paper.ink, maxWidth: 300 });
    if (d.mode === 'sell' && d.wanted) drawText(c, `Wanted today: ${formatNumber(d.wantedPrice)}◉ each for one stack.`, L, T0 + 40, { font: 'small', color: COLORS.wax.fill }); // str
    else if (d.mode === 'deposit') drawText(c, `The crate pays ${formatNumber(d.price)}◉ each at 06:00.`, L, T0 + 40, { font: 'small', color: COLORS.paper.inkSoft }); // str
  }

  function drawMedicine(c, x, y, dim) {
    c.fillStyle = dim ? COLORS.paper.inkFaint : COLORS.wax.fill;
    c.fillRect(x + 3, y + 1, 2, 6);
    c.fillRect(x + 1, y + 3, 6, 2);
  }

  function drawHead(c, x, y, cr, st) {
    // the party head (16×16 crop): lit and framed in wax = can learn, a grey silhouette with a
    // dashed foot = cannot, ✦ = already knows it. Shape tells it, not colour alone.
    const lit = st !== 'cannot';
    c.fillStyle = lit ? COLORS.paper.light : COLORS.paper.shade;
    c.fillRect(x, y, 18, 18);
    c.fillStyle = lit ? COLORS.wax.fill : COLORS.paper.deep;
    c.fillRect(x, y, 18, 1); c.fillRect(x, y + 17, 18, 1); c.fillRect(x, y, 1, 18); c.fillRect(x + 17, y, 1, 18);
    let icon = null;
    try { icon = getCreatureIcon(cr.speciesId, { silhouette: lit ? null : PALETTE.e }); } catch { icon = null; }
    if (icon && isSprite(icon)) drawSprite(c, icon, x + 1, y + 1);
    else drawText(c, String(cr.nickname ?? '?').charAt(0).toUpperCase(), x + 9, y + 6, { align: 'center', color: lit ? COLORS.paper.ink : COLORS.paper.inkSoft });
    if (st === 'knows') drawText(c, '✦', x + 13, y - 3, { color: COLORS.brass.dark });
    if (st === 'cannot') { c.fillStyle = COLORS.paper.inkFaint; for (let i = 0; i < 14; i += 3) c.fillRect(x + 2 + i, y + 15, 2, 1); }
  }

  function qtyRects() {
    const panel = { x: 150, y: 96, w: 180, h: 76 };
    return {
      panel,
      minus: { x: panel.x + 22, y: panel.y + 22, w: 16, h: 16 },
      plus: { x: panel.x + panel.w - 38, y: panel.y + 22, w: 16, h: 16 },
      ok: { x: panel.x + panel.w / 2 - 30, y: panel.y + panel.h - 20, w: 60, h: 14 },
    };
  }

  function drawQty(c) {
    const q = /** @type {any} */ (qty);
    c.fillStyle = COLORS.dim;
    c.fillRect(0, 0, 480, 270);
    const B = qtyRects();
    const k = reducedMotion(G) ? 1 : Math.min(1, stateT / 100);
    const R = { ...B.panel, y: B.panel.y + Math.round((1 - k) * 12) };
    drawPanel(c, R, 'notice', { torn: 'top', pin: true });
    const name = q.item.row?.name ?? q.item.item;
    drawText(c, name, R.x + R.w / 2, R.y + 8, { align: 'center', color: COLORS.paper.ink, maxWidth: R.w - 16 });
    const lift = bob < TIMING.cursorBobMs / 2 ? 0 : 1;
    if (q.max > 1) {
      drawText(c, '◀', B.minus.x + 4 - lift, R.y + 27, { color: COLORS.wax.fill });
      drawText(c, '▶', B.plus.x + 6 + lift, R.y + 27, { color: COLORS.wax.fill });
    }
    drawText(c, t('shop.qty', { n: q.n }), R.x + R.w / 2, R.y + 27, { align: 'center', color: COLORS.paper.ink });
    const pv = previewOf(q.item, q.n);
    const totalTxt = q.mode === 'withdraw' ? `of ${q.max}` : t('shop.total', { total: formatNumber(pv.total) }); // str
    drawText(c, totalTxt, R.x + R.w / 2, R.y + 39, { align: 'center', font: 'small', color: COLORS.paper.inkSoft });
    if (q.mode === 'buy' || q.mode === 'sell') drawText(c, t('shop.after', { n: `${formatNumber(pv.after)}◉` }), R.x + R.w / 2, R.y + 47, { align: 'center', font: 'small', color: pv.after < 0 ? PALETTE.r : COLORS.paper.inkSoft });
    const label = q.mode === 'buy' ? t('shop.buy') : q.mode === 'sell' ? t('shop.sell') : q.mode === 'deposit' ? 'Crate it' : 'Take back'; // str
    const ok = { ...B.ok, y: R.y + R.h - 20 };
    const locked = qtyLock > 0;
    c.fillStyle = locked ? COLORS.wax.dark : COLORS.wax.fill;
    c.fillRect(ok.x, ok.y, ok.w, ok.h);
    drawText(c, label, ok.x + ok.w / 2, ok.y + 4, { align: 'center', color: COLORS.wax.text });
    drawText(c, TYPE.cursor, ok.x - 8 + (locked ? 0 : lift), ok.y + 4, { color: locked ? COLORS.paper.inkFaint : COLORS.wax.fill });
  }

  return scene;
}
