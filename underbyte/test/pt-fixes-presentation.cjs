/*
 * UNDERBYTE — test/pt-fixes-presentation.cjs
 * Playtest fixes, PRESENTATION lane (playtests/REPORT.md): B03 B04 B05 B06 B11 B12 B18 B19 B23 B24 B25 B32 B42.
 * Run:  node underbyte/test/pt-fixes-presentation.cjs      (exit code 0 = all PASS)
 *
 * Every check follows the bug's repro from the triage data and fails on the pre-fix build:
 *   B03 title cursor returns to SETTINGS after closing it; the hidden title menu does not follow Settings input
 *   B04 banners never cover play once control returns (top strip) and are cleared on a room change
 *   B05 opaque panels; banners / boss card / zone toast are not drawn under an overlay
 *   B06 the pause ability lines never share the screen with the zone toast
 *   B11 the boss bar is gone once the boss dies (no empty bar under "{NAME} PURGED")
 *   B12 footers / prompts follow the last-used device; no '▲' glyph on the REST / TRADE prompt
 *   B18 the WEIGHT bar shows real weight (heavy fighters have the long bar)
 *   B19 a one-time "Down + Jump drops through" hint on a grate the player must (or is trying to) drop through
 *   B23 the map's "you" dot never covers the vendor hexagon
 *   B24 found cores sit at their real position on the map; the legend has a core entry
 *   B25 Scrivvet is cheaper at the deeper vendor (rw_rest), as his line says
 *   B32 the select-screen showcase pose never draws over the header
 *   B42 a settings value (reducedFlashing) and an intensity hook (FX.setFlashScale) drive the full-screen flashes
 * Texts are checked by recording every fillText of one render (string, position, font, fill colour), pixels by
 * differential renders (the same frame drawn with and without the layer under test).
 * One check depends on an engine change outside the presentation files: "buying SPARE CELL at rw_rest charges the shown
 * 70 bits" needs game.buy() (js/engine.js) to charge UB.Util.vendorPrice(item, roomId) instead of item.price.
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./harness.cjs');

const SHOTS = path.join(__dirname, 'shots');
const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok, info });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info).slice(0, 900) : ''));
}

function PT_INSTALL() {
  const UB = window.UB, d = UB.debug, In = UB.Input;
  const Q = {};
  Q.render = function () { UB.game.render(1); };
  Q.grab = function (x, y, w, h) {
    const c = document.getElementById('game'), dpr = UB.game.dpr || 1;
    return c.getContext('2d').getImageData(Math.round(x * dpr), Math.round(y * dpr), Math.max(1, Math.round(w * dpr)), Math.max(1, Math.round(h * dpr))).data;
  };
  Q.px = function (x, y) { const dd = Q.grab(x, y, 1, 1); return [dd[0], dd[1], dd[2]]; };
  /** Count pixels in a logical rect for which pred(r,g,b) holds (renders first). */
  Q.scan = function (x, y, w, h, pred) { Q.render(); const dd = Q.grab(x, y, w, h); let n = 0; for (let i = 0; i < dd.length; i += 4) if (pred(dd[i], dd[i + 1], dd[i + 2])) n++; return n; };
  /** Pixels of a rect that differ (sum of |Δrgb| > tol) between two grabs. */
  Q.diff = function (a, b, tol) { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > (tol || 24)) n++; return n; };
  /** Render once and record every fillText: [str, x, y, font, fillStyle]. */
  Q.texts = function () {
    const proto = CanvasRenderingContext2D.prototype, orig = proto.fillText, out = [];
    proto.fillText = function (s, x, y) { out.push([String(s), Math.round(x), Math.round(y), this.font, String(this.fillStyle)]); return orig.apply(this, arguments); };
    try { Q.render(); } finally { proto.fillText = orig; }
    return out;
  };
  Q.has = function (list, str) { return list.some(t => t[0] === str); };
  Q.key = function (code, down) { window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: code, key: code, bubbles: true, cancelable: true })); };
  Q.tap = function (code, n) { Q.key(code, true); d.step(n || 1); Q.key(code, false); d.step(1); };
  Q.pad = null;
  Q.padOn = function () {
    const pad = { connected: true, index: 0, id: 'PT standard pad', mapping: 'standard', axes: [0, 0, 0, 0], buttons: [] };
    for (let i = 0; i < 17; i++) pad.buttons.push({ pressed: false, touched: false, value: 0 });
    Q.pad = pad; navigator.getGamepads = function () { return [pad]; }; return true;
  };
  Q.padOff = function () { Q.pad = null; navigator.getGamepads = function () { return []; }; };
  Q.padTap = function (b, n) { const btn = Q.pad.buttons[b]; btn.pressed = true; btn.value = 1; d.step(n || 1); btn.pressed = false; btn.value = 0; d.step(1); };
  Q.tilePx = function (tx, ty) { return { x: tx * 30 + 15, y: (ty + 1) * 30 }; };
  Q.restAt = function (tx, ty) { const p = Q.tilePx(tx, ty); d.teleport(p.x, p.y); d.step(4); d.pressed('up', 2); d.step(2); for (let i = 0; i < 150 && UB.game.mode !== 'normal'; i++) d.step(1); return d.state(); };
  Q.mapRect = function (id) {
    const g = UB.game, r = UB.World.rooms[id], cur = g.level.room, S = 40, UI = UB.UI;
    const ox = 480 - (cur.gx + cur.gw / 2) * S + UI.mapPan.x, oy = 270 - (cur.gy + cur.gh / 2) * S + UI.mapPan.y;
    return { x: ox + r.gx * S + 2, y: oy + r.gy * S + 2, w: r.gw * S - 4, h: r.gh * S - 4 };
  };
  /** PANEL_EDGE (PAPER) stroke present on all four edges of a rect (±2 px band), as qa-ui checks the pinned panels. */
  Q.edges = function (x, y, w, h) {
    const paper = (r, gg, b) => r > 215 && gg > 205 && b > 180;
    const band = (bx, by, bw, bh) => { const dd = Q.grab(bx, by, bw, bh); for (let i = 0; i < dd.length; i += 4) if (paper(dd[i], dd[i + 1], dd[i + 2])) return true; return false; };
    Q.render();
    const o = { top: band(x + w / 2, y - 2, 1, 5), bottom: band(x + w / 2, y + h - 2, 1, 5), left: band(x - 2, y + h / 2, 5, 1), right: band(x + w - 2, y + h / 2, 5, 1) };
    o.all = o.top && o.bottom && o.left && o.right; o.any = o.top || o.bottom || o.left || o.right;
    return o;
  };
  window.__PT = Q;
  return true;
}

(async () => {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  const t = await launch();
  const page = t.page;
  /** (UB, d, g, q, ...args) evaluator. */
  const ev = (fn, ...args) => page.evaluate(({ src, args }) => { const f = new Function('UB', 'd', 'g', 'q', 'args', 'return (' + src + ')(UB, d, g, q, ...args)'); return f(window.UB, window.UB.debug, window.UB.game, window.__PT, args); }, { src: fn.toString(), args });
  const state = () => page.evaluate(() => window.UB.debug.state());
  const step = (n) => page.evaluate((n) => window.UB.debug.step(n), n);
  async function stepUntil(pred, max, chunk = 5) { let s = await state(); for (let i = 0; i < max && !pred(s); i += chunk) { await step(chunk); s = await state(); } return s; }
  async function shot(name) { await page.evaluate(() => window.UB.game.render(1)); await page.waitForTimeout(50); await page.screenshot({ path: path.join(SHOTS, 'pt-pres-' + name + '.png') }); }
  async function reload(clear) {
    if (clear) await page.evaluate(() => { localStorage.removeItem('underbyte.save'); localStorage.removeItem('underbyte.settings'); });
    await page.reload(); await page.waitForTimeout(250);
    await page.evaluate(PT_INSTALL);
    await ev((UB, d) => d.pauseLogic(true));
  }
  /** New game (fighter) in play with every zone's lore card marked seen (no card opens mid-check). */
  async function startGame(fighter) {
    await ev((UB, d, g, q, f) => d.newGame(f), fighter);
    await stepUntil(x => x.screen === 'play' && !x.busy, 300);
    await ev((UB, d, g) => { UB.IDS.zones.forEach(z => { if (g.save.loreSeen.indexOf(z) < 0) g.save.loreSeen.push(z); }); g.loreTimer = 0; g.loreZone = null; UB.UI.clearMessages(); });
    return state();
  }
  async function section(name, fn) {
    try { await fn(); } catch (e) { check(name + ': section threw ' + (e && e.message ? e.message : String(e)), false, e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e); }
  }

  try {
    await reload(true);

    // =============================================================================================
    // B03 — title cursor after SETTINGS; the hidden title menu must not follow Settings input
    // =============================================================================================
    await section('B03', async () => {
      // repro: Title → Down to SETTINGS → Confirm → Down → Esc → Up (no save, then with a save)
      const noSave = await ev((UB, d, g, q) => {
        const UI = UB.UI, o = {};
        q.tap('ArrowDown'); o.onSettings = UI.sel;            // CONTINUE is skipped without a save
        q.tap('Enter'); o.overlay = g.overlay;
        q.tap('ArrowDown');
        const tx = q.texts();                                // the title menu is drawn under the settings overlay
        o.titleSelected = tx.filter(t => (t[0] === 'NEW GAME' || t[0] === 'CONTINUE' || t[0] === 'SETTINGS') && t[4].toUpperCase() === UB.Palette.SELECT.toUpperCase()).map(t => t[0]);
        q.tap('Escape'); o.closed = g.overlay; o.back = UI.sel;
        q.tap('ArrowUp'); o.up = UI.sel;
        return o;
      });
      check('B03 no save: closing SETTINGS returns the title cursor to SETTINGS (row 2)', noSave.onSettings === 2 && noSave.overlay === 'settings' && noSave.closed === null && noSave.back === 2, noSave);
      check('B03 no save: Up from SETTINGS goes to NEW GAME (CONTINUE skipped)', noSave.up === 0, noSave);
      check('B03 the title menu drawn under SETTINGS keeps SETTINGS highlighted while the Settings cursor moves', noSave.titleSelected.length === 1 && noSave.titleSelected[0] === 'SETTINGS', noSave.titleSelected);
      // with a save: the cursor starts on CONTINUE
      await startGame('tessik');
      await ev((UB, d, g) => { g.writeSave(); g.toTitle(); d.step(2); });
      const withSave = await ev((UB, d, g, q) => {
        const UI = UB.UI, o = { start: UI.sel };
        q.tap('ArrowDown'); o.onSettings = UI.sel;
        q.tap('Enter'); q.tap('ArrowDown'); q.tap('ArrowDown');
        q.tap('Escape'); o.back = UI.sel;
        q.tap('ArrowUp'); o.up = UI.sel;
        return o;
      });
      check('B03 with a save: closing SETTINGS returns to SETTINGS and Up goes to CONTINUE', withSave.start === 1 && withSave.onSettings === 2 && withSave.back === 2 && withSave.up === 1, withSave);
    });

    // =============================================================================================
    // B18 — the WEIGHT bar shows real weight (Brackmaw longest, Vellix shortest)
    // =============================================================================================
    await section('B18', async () => {
      const bars = await ev((UB, d, g) => {
        g.toSelect(); d.step(2);
        const UI = UB.UI, out = {};
        UB.Characters.list.forEach((f, i) => { UI.sel = i; d.step(60); out[f.id] = { w: +UI.statNow[3].toFixed(3), kb: f.weight }; });
        UI.sel = 0; d.step(2);
        return out;
      });
      const order = Object.keys(bars).sort((a, b) => bars[b].w - bars[a].w);
      const heavyFirst = Object.keys(bars).sort((a, b) => bars[a].kb - bars[b].kb);   // lowest knockback multiplier = heaviest
      check('B18 WEIGHT bars rank the fighters by real weight (lowest knockback taken = longest bar)', order.join(',') === heavyFirst.join(','), { order, bars });
      check('B18 Brackmaw (kb ×0.60) has the full WEIGHT bar, Vellix (kb ×1.30) about 0.46', Math.abs(bars.brackmaw.w - 1) < 0.03 && Math.abs(bars.vellix.w - 0.6 / 1.3) < 0.03, bars);
    });

    // =============================================================================================
    // B32 — the showcase jump pose never draws over the select header
    // =============================================================================================
    await section('B32', async () => {
      const r = await ev((UB, d, g, q) => {
        const UI = UB.UI; UI.sel = 0; UI.selSlide = 0; d.step(2);
        const C = UB.Characters, orig = C.drawPreview, out = {};
        // POSES run, light1, light2, light3, jump, heavy in 228 f slots; the jump starts at 4·228 + 180, apex 23 f in
        const apex = 4 * 228 + 180 + 23;
        UI.t = apex; q.render(); const a = q.grab(0, 0, 560, 88);
        C.drawPreview = function (ctx, id, x, y, s, t, show) { if (!show) return orig.apply(this, arguments); };
        try { q.render(); } finally { C.drawPreview = orig; }
        const b = q.grab(0, 0, 560, 88);
        out.headerDiff = q.diff(a, b, 30);
        // the rig itself is still drawn in its portrait (a frame where the pose stands on the floor)
        UI.t = 4 * 228 + 180 + 2; q.render(); const c = q.grab(150, 120, 300, 190);
        C.drawPreview = function (ctx, id, x, y, s, t, show) { if (!show) return orig.apply(this, arguments); };
        try { q.render(); } finally { C.drawPreview = orig; }
        out.portraitDiff = q.diff(c, q.grab(150, 120, 300, 190), 30);
        return out;
      });
      check('B32 Tessik\'s showcase jump draws nothing over "CHOOSE YOUR SPIRIT" / the sub line (y < 88)', r.headerDiff === 0, r);
      check('B32 the showcase rig is still drawn in its portrait', r.portraitDiff > 500, r);
      await shot('b32-select-apex');
    });

    // =============================================================================================
    // B12 — device-aware footers; no '▲' on the REST / TRADE prompt
    // =============================================================================================
    await section('B12', async () => {
      await reload(true);
      const kbTitle = await ev((UB, d, g, q) => q.texts().map(t => t[0]));
      check('B12 keyboard title footer keeps the DESIGN §15.1 text', kbTitle.indexOf('an original game · keyboard or gamepad · press Enter') >= 0, kbTitle);
      // a pad press makes the gamepad the last-used device (d-pad Down only moves the title cursor)
      const padTitle = await ev((UB, d, g, q) => { q.padOn(); q.padTap(13); const o = { dev: UB.Input.device, tx: q.texts().map(t => t[0]) }; return o; });
      check('B12 pad: the title footer names the pad button (press A)', padTitle.dev === 'gamepad' && padTitle.tx.indexOf('an original game · keyboard or gamepad · press A') >= 0 && padTitle.tx.indexOf('an original game · keyboard or gamepad · press Enter') < 0, padTitle);
      const padSelect = await ev((UB, d, g, q) => { g.toSelect(); d.step(2); UB.Input.device = 'gamepad'; return q.texts().map(t => t[0]); });
      check('B12 pad: the select sub line is "← → select · A confirm · B back"', padSelect.indexOf('← → select · A confirm · B back') >= 0 && padSelect.indexOf('← → select · Enter confirm · Esc back') < 0, padSelect.filter(s => /select/.test(s)));
      const kbSelect = await ev((UB, d, g, q) => { UB.Input.device = 'keyboard'; return q.texts().map(t => t[0]); });
      check('B12 keyboard: the select sub line keeps the §15.2 text', kbSelect.indexOf('← → select · Enter confirm · Esc back') >= 0, kbSelect.filter(s => /select/.test(s)));
      await ev((UB, d, g, q) => { q.padOff(); });
      await startGame('tessik');
      const padMap = await ev((UB, d, g, q) => { UB.Input.device = 'gamepad'; g.openOverlay('map'); d.step(1); const a = q.texts().map(t => t[0]); g.closeOverlay(); d.step(1); return a; });
      check('B12 pad: the map footer reads "B / BACK close" and "A recentre"', padMap.indexOf('B / BACK close') >= 0 && padMap.indexOf('A recentre') >= 0 && padMap.indexOf('Esc / M close') < 0 && padMap.indexOf('R recentre') < 0, padMap.slice(-8));
      const kbMap = await ev((UB, d, g, q) => { UB.Input.device = 'keyboard'; g.openOverlay('map'); d.step(1); const a = q.texts().map(t => t[0]); g.closeOverlay(); d.step(1); return a; });
      check('B12 keyboard: the map footer keeps "Esc / M close" and "R recentre"', kbMap.indexOf('Esc / M close') >= 0 && kbMap.indexOf('R recentre') >= 0, kbMap.slice(-8));
      const padShop = await ev((UB, d, g, q) => { d.warp('dc_shrine', null); d.step(2); UB.Input.device = 'gamepad'; g.openOverlay('shop'); d.step(1); const a = q.texts().map(t => t[0]); g.closeOverlay(); d.step(1); return a; });
      check('B12 pad: the shop footer is "↑↓ select · A buy · B close"', padShop.indexOf('↑↓ select · A buy · B close') >= 0 && padShop.indexOf('↑↓ select · Enter buy · Esc close') < 0, padShop.slice(-4));
      // stand at the node: REST prompt without the '▲' glyph, with the bound key under it
      const prompt = await ev((UB, d, g, q) => {
        const p = q.tilePx(10, 14); d.teleport(p.x, p.y); d.step(3);
        const o = { prompt: g.prompt && g.prompt.text };
        UB.Input.device = 'gamepad'; o.pad = q.texts().map(t => t[0]);
        UB.Input.device = 'keyboard'; o.kb = q.texts().map(t => t[0]);
        return o;
      });
      const noTri = (a) => a.every(s => s.indexOf('▲') < 0);
      check('B12 the node prompt shows REST with the up key (↑) and no "▲" glyph, on pad and keyboard', prompt.prompt === 'REST' && prompt.pad.indexOf('REST') >= 0 && prompt.kb.indexOf('REST') >= 0 && prompt.pad.indexOf('↑') >= 0 && noTri(prompt.pad) && noTri(prompt.kb), prompt);
      const go = await ev((UB, d, g, q) => { d.skipTo('gameover'); for (let i = 0; i < 400 && g.screen !== 'gameover'; i++) d.step(1); while (g.screenT < 62) d.step(1); UB.Input.device = 'gamepad'; const a = q.texts().map(t => t[0]); UB.Input.device = 'keyboard'; const b = q.texts().map(t => t[0]); return { a, b, screen: g.screen }; });
      check('B12 pad: game over prompt is "Press A to continue" (keyboard keeps the §12.15 line)', go.screen === 'gameover' && go.a.indexOf('Press A to continue') >= 0 && go.b.indexOf('Press JUMP or CONFIRM to continue') >= 0, go);
    });

    // =============================================================================================
    // B04 — banners: top strip once control returns, cleared on a room change
    // =============================================================================================
    await section('B04', async () => {
      await reload(true);
      await startGame('tessik');
      const rest = await ev((UB, d, g, q) => {
        d.warp('dc_shrine', null); d.step(3); UB.UI.clearMessages();
        const s = q.restAt(9, 14);
        d.step(14);
        const tx = q.texts().filter(t => t[0] === 'RESTORED');
        return { mode: s.mode, bannerT: UB.UI.bannerT, l1: UB.UI.banner1, ys: tx.map(t => t[2]), centre: q.edges(240, 200, 480, 120) };
      });
      check('B04 RESTORED shows once control returns, but not as the centre panel over play (240,200 480×120)', rest.mode === 'normal' && rest.l1 === 'RESTORED' && rest.bannerT > 0 && !rest.centre.any, rest);
      check('B04 RESTORED is drawn in the top strip (line 1 above y 80)', rest.ys.length === 1 && rest.ys[0] < 80, rest);
      await shot('b04-restored-strip');
      // repro: walk straight out left into dc_cross
      const walk = await ev((UB, d, g, q) => {
        const p = q.tilePx(1, 14); d.teleport(p.x, p.y); d.step(2);
        let k = 0; while (k++ < 120 && !(g.level.room.id === 'dc_cross' && g.mode === 'normal')) { d.pressed('left', 2); d.step(1); }
        const tx = q.texts();
        return { room: g.level.room.id, mode: g.mode, frames: k, bannerT: UB.UI.bannerT, drawn: q.has(tx, 'RESTORED') };
      });
      check('B04 after the room change into dc_cross the RESTORED banner is gone', walk.room === 'dc_cross' && walk.mode === 'normal' && walk.bannerT === 0 && !walk.drawn, walk);
      // ability banner: the centre panel during the locked pickup sequence, the strip once control returns
      const seq = await ev((UB, d, g, q) => {
        UB.UI.clearMessages();
        const pl = g.player, o = {};
        g.startPickupSeq({ ability: 'echoJump', bossId: null, x: pl.x, y: pl.y, cy: function () { return pl.y - 20; } });
        d.step(14); o.mode1 = g.mode; o.centre1 = q.edges(240, 200, 480, 120);
        for (let i = 0; i < 200 && g.mode !== 'normal'; i++) d.step(1);
        d.step(16); o.mode2 = g.mode; o.centre2 = q.edges(240, 200, 480, 120);
        const tx = q.texts().filter(t => t[0] === 'ECHO JUMP ACQUIRED'); o.ys = tx.map(t => t[2]); o.bannerT = UB.UI.bannerT;
        const room0 = g.level.room.id; d.warp('dc_wake', null); d.step(2); o.afterWarp = UB.UI.bannerT; o.room0 = room0;
        return o;
      });
      check('B04 the ability banner is the centre panel while the pickup sequence locks the player', seq.mode1 === 'pickupSeq' && seq.centre1.all, seq);
      check('B04 once control returns the ability banner leaves the centre and holds in the top strip', seq.mode2 === 'normal' && !seq.centre2.any && seq.bannerT > 0 && seq.ys.length === 1 && seq.ys[0] < 80, seq);
      check('B04 ECHO JUMP ACQUIRED does not carry into the next room (dc_cross → dc_wake)', seq.afterWarp === 0, seq);
    });

    // =============================================================================================
    // B05 — opaque panels, nothing bleeds through pause / map / shop / dialogs
    // =============================================================================================
    await section('B05', async () => {
      const r = await ev((UB, d, g, q) => {
        const o = {};
        d.warp('dc_shrine', null); d.step(3); UB.UI.clearMessages();
        q.restAt(9, 14);
        const lines = ['RESTORED', 'Saved · hearts full · energy full'];
        const drawn = (tx) => lines.filter(l => q.has(tx, l));
        q.tap('Escape'); o.pause = g.overlay; o.underPause = drawn(q.texts()); q.tap('Escape');
        q.tap('KeyM'); o.map = g.overlay; o.underMap = drawn(q.texts()); q.tap('KeyM');
        g.openOverlay('shop'); d.step(1); o.shop = g.overlay; o.underShop = drawn(q.texts()); g.closeOverlay(); d.step(1);
        // the HUD under the map panel: the frame with and without the HUD must be identical inside the panel
        g.openOverlay('map'); d.step(1);
        const orig = UB.UI.drawHUD;
        q.render(); const a = q.grab(30, 30, 900, 480);
        UB.UI.drawHUD = function () {}; try { q.render(); } finally { UB.UI.drawHUD = orig; }
        o.hudUnderMap = q.diff(a, q.grab(30, 30, 900, 480), 6);
        g.closeOverlay(); d.step(1);
        o.panelOpaque = /^#|rgb\(/.test(UB.Palette.PANEL) || /,\s*1\)$/.test(UB.Palette.PANEL);
        return o;
      });
      check('B05 the RESTORED banner is not drawn under the pause menu', r.pause === 'pause' && r.underPause.length === 0, r);
      check('B05 the RESTORED banner is not drawn under the map', r.map === 'map' && r.underMap.length === 0, r);
      check('B05 the RESTORED banner is not drawn under the shop', r.shop === 'shop' && r.underShop.length === 0, r);
      check('B05 panels are opaque: the HUD never shows through the map panel', r.panelOpaque && r.hudUnderMap === 0, r);
      // the boss intro card under a pause, and the quit dialog over the boss bar
      const boss = await ev((UB, d, g, q) => {
        const o = {};
        g.save.bossesDefeated.length = 0; d.god(true);
        d.warp('dc_sentinel', null); d.step(3);
        const b = g.level.boss, p = q.tilePx(b.bounds[0] + 1, 14); d.teleport(p.x, p.y); d.step(3);
        for (let i = 0; i < 60 && g.bossFight.state !== 'intro'; i++) d.step(1);
        d.step(30); o.fight = g.bossFight.state; o.cardT = UB.UI.cardT;
        q.tap('Escape'); o.overlay = g.overlay;
        o.cardUnderPause = q.has(q.texts(), UB.UI.cardSub);
        q.tap('Escape');
        for (let i = 0; i < 300 && g.bossFight.state !== 'fight'; i++) d.step(1);
        d.step(10);
        q.tap('Escape'); UB.UI.sel = 3; q.tap('Enter'); o.dialog = UB.UI.confirmQuit;
        const orig = UB.UI.drawHUD;
        q.render(); const a = q.grab(336, 406, 288, 98);
        UB.UI.drawHUD = function () {}; try { q.render(); } finally { UB.UI.drawHUD = orig; }
        o.hudUnderDialog = q.diff(a, q.grab(336, 406, 288, 98), 6);
        q.tap('Escape'); q.tap('Escape');
        d.god(false);
        return o;
      });
      check('B05 the boss title card is not drawn under the pause menu (its timer still holds)', boss.fight === 'intro' && boss.overlay === 'pause' && boss.cardT > 0 && !boss.cardUnderPause, boss);
      check('B05 the QUIT dialog panel is opaque over the boss bar (HUD diff 0 inside it)', boss.dialog === true && boss.hudUnderDialog === 0, boss);
    });

    // =============================================================================================
    // B06 — the pause ability lines are never printed across the zone toast
    // =============================================================================================
    await section('B06', async () => {
      const r = await ev((UB, d, g, q) => {
        const o = {};
        d.grant('echoJump', true); d.warp('dc_wake', null); d.step(2); UB.UI.clearMessages();
        d.warp('lw_hoist', null); d.step(20);
        o.toast = UB.UI.toastT > 0 ? UB.UI.toast1 : '';
        q.tap('Escape'); o.overlay = g.overlay;
        const tx = q.texts();
        o.ability = q.has(tx, 'ECHO JUMP — a second jump in the air');
        o.blurb = q.has(tx, UB.UI.toast2);
        o.nameChars = tx.filter(t => t[2] >= 130 && t[2] <= 170 && /bold 34px/.test(t[3])).length;   // the zone name is letter-spaced, one fillText per char
        q.tap('Escape'); o.toastAfter = UB.UI.toastT;
        return o;
      });
      check('B06 pause over the LOOMWORKS toast: the ability line is drawn and the toast is not', r.toast === 'LOOMWORKS' && r.overlay === 'pause' && r.ability && !r.blurb && r.nameChars === 0, r);
      check('B06 the toast resumes after the pause (timer frozen, not cleared)', r.toastAfter > 0, r);
      await ev((UB, d) => d.grant('echoJump', false));
    });

    // =============================================================================================
    // B11 — no empty boss bar under "{NAME} PURGED"
    // =============================================================================================
    await section('B11', async () => {
      const r = await ev((UB, d, g, q) => {
        const o = {};
        g.save.bossesDefeated.length = 0; d.god(true);
        d.warp('dc_sentinel', null); d.step(3);
        d.spawnBoss('tallock', {}); d.step(5);
        const barLine = (tx) => tx.some(t => t[2] === 476);   // the boss name line above the bar (§12.6)
        o.fight = g.bossFight.state; o.barFight = barLine(q.texts());
        g.boss.hp = 0; g.startBossDeath(); o.dying = g.bossFight.state;
        d.step(70); o.barDying = barLine(q.texts());
        for (let i = 0; i < 200 && g.bossFight.state === 'dying'; i++) d.step(1);
        d.step(5); o.reward = g.bossFight.state; o.toast = UB.UI.toastT > 0 ? UB.UI.toast1 : '';
        o.barReward = barLine(q.texts());
        // the bar trough: frame with and without the boss must match on the bar band
        q.render(); const a = q.grab(176, 482, 608, 38); const b0 = g.boss; g.boss = null; q.render(); g.boss = b0;
        o.barPx = q.diff(a, q.grab(176, 482, 608, 38), 24);
        d.step(330); o.later = barLine(q.texts());
        d.god(false);
        return o;
      });
      check('B11 the boss bar shows during the fight', r.fight === 'fight' && r.barFight, r);
      check('B11 70 f into the death animation the bar is gone', r.dying === 'dying' && !r.barDying, r);
      check('B11 under "TALLOCK PURGED" (reward state) no boss bar is drawn — not even the empty trough', r.reward === 'reward' && r.toast === 'TALLOCK PURGED' && !r.barReward && r.barPx === 0, r);
      check('B11 still no bar 400 f after the death with the crystal untouched', !r.later, r);
    });

    // =============================================================================================
    // B23 / B24 — map icons: the vendor hexagon is never covered; cores at their real spot, in the legend
    // =============================================================================================
    await section('B23-B24', async () => {
      await reload(true);
      await startGame('tessik');
      const B = (r, gg, b) => Math.abs(r - 143) < 30 && Math.abs(gg - 227) < 30 && Math.abs(b - 136) < 30;
      const hex = await ev((UB, d, g, q, Bsrc) => {
        const isB = new Function('return ' + Bsrc)();
        const o = {};
        d.warp('dc_shrine', null); d.step(3);
        const r = UB.World.rooms.dc_shrine;
        const at = (px, label) => { d.teleport(px, 15 * 30); d.step(3); g.openOverlay('map'); d.step(1); const m = q.mapRect('dc_shrine'); o[label] = q.scan(m.x, m.y, m.w, m.h, isB); g.closeOverlay(); d.step(1); };
        at(r.w * 30 / 2, 'middle'); at(r.vendor.x * 30 + 15, 'vendor'); at(r.nodes[0].x * 30 + 15, 'node'); at(60, 'left');
        return o;
      }, B.toString());
      check('B23 the vendor hexagon stays visible with the player in the middle of dc_shrine, at Scrivvet and at the node', hex.middle >= 15 && hex.vendor >= 15 && hex.node >= 15 && Math.abs(hex.middle - hex.left) <= 6, hex);
      const cores = await ev((UB, d, g, q) => {
        const o = {};
        ['core_dc_fall', 'core_dc_loft'].forEach(id => { if (g.save.cores.indexOf(id) < 0) g.save.cores.push(id); });
        d.warp('dc_loft', null); d.step(3);   // visited, so its icons are drawn
        d.warp('dc_fall', null); d.step(3);
        const p = q.tilePx(4, 51); d.teleport(p.x, p.y); d.step(2);   // keep the "you" dot away from the core
        g.openOverlay('map'); d.step(1);
        const CH = (r, gg, b) => r > 215 && gg > 150 && gg < 205 && b < 100;
        const room = UB.World.rooms.dc_fall, c = room.cores[0], m = q.mapRect('dc_fall');
        const cx = m.x + (c.x + 0.5) / room.w * m.w, cy = m.y + (c.y + 0.5) / room.h * m.h;
        o.real = q.scan(cx - 4, cy - 4, 8, 8, CH);
        o.corner = q.scan(m.x + m.w - 15, m.y + m.h - 15, 10, 10, CH);
        const loft = UB.World.rooms.dc_loft, lc = loft.cores[0], lm = q.mapRect('dc_loft');
        o.loft = q.scan(lm.x + (lc.x + 0.5) / loft.w * lm.w - 4, lm.y + (lc.y + 0.5) / loft.h * lm.h - 4, 8, 8, CH);
        const tx = q.texts().map(t => t[0]);
        o.legend = ['node', 'boss', 'vendor', 'core', 'you'].filter(w => tx.indexOf(w) >= 0);
        o.oldLegend = tx.filter(s => /node .*boss .*vendor/.test(s));
        // a CORE_HEART dot swatch beside the "core" word
        const lt = q.texts().filter(t => t[0] === 'core')[0];
        o.swatch = lt ? q.scan(lt[1] - 16, lt[2] - 6, 14, 12, CH) : -1;
        g.closeOverlay(); d.step(1);
        return o;
      });
      check('B24 a found core is drawn at its real position in the room (dc_fall core at the top right), not in the corner', cores.real >= 6 && cores.corner === 0, cores);
      check('B24 the dc_loft core dot sits at its tile too', cores.loft >= 6, cores);
      check('B24 the map legend lists node / boss / vendor / core / you, with a core swatch', cores.legend.length === 5 && cores.oldLegend.length === 0 && cores.swatch >= 4, cores);
      await shot('b24-map-cores');
    });

    // =============================================================================================
    // B25 — Scrivvet's "the deeper you go, the cheaper I get" is true at rw_rest
    // =============================================================================================
    await section('B25', async () => {
      const r = await ev((UB, d, g, q) => {
        const o = {}, V = UB.IDS.vendorItems;
        const prices = () => q.texts().filter(t => t[1] === 700 && t[2] >= 210 && /bold 16px/.test(t[3])).map(t => t[0]);   // the price column (the bits count sits at y 182)
        d.warp('dc_shrine', null); d.step(2); d.setBits(500); g.openOverlay('shop'); d.step(1); o.shrine = prices(); g.closeOverlay(); d.step(1);
        d.warp('rw_rest', null); d.step(2); d.setBits(500); g.openOverlay('shop'); d.step(1); o.rw = prices();
        o.util = UB.Util && UB.Util.vendorPrice ? V.map(it => UB.Util.vendorPrice(it, 'rw_rest')) : null;
        o.base = V.map(it => it.price);
        o.utilShrine = UB.Util && UB.Util.vendorPrice ? V.map(it => UB.Util.vendorPrice(it, 'dc_shrine')) : null;
        UB.UI.sel = 0; d.pressed('confirm', 1); d.step(1);
        o.bits = g.save.bits; o.vendor = g.save.vendor.slice();
        g.closeOverlay(); d.step(1);
        return o;
      });
      await ev((UB, d, g) => { d.setBits(500); g.save.vendor.length = 0; g.applyVendorEffects(); g.openOverlay('shop'); d.step(1); });
      await shot('b25-shop-rw-rest');
      await ev((UB, d, g) => { g.closeOverlay(); d.step(1); });
      check('B25 dc_shrine keeps the §9.5 prices 90 / 160 / 120 (pinned base prices unchanged)', r.shrine.join('/') === '90/160/120' && r.base.join('/') === '90/160/120', r);
      check('B25 rw_rest (the deeper vendor) sells for less: 70 / 120 / 90 (UB.Util.vendorPrice + the panel)', !!r.util && r.util.join('/') === '70/120/90' && r.utilShrine.join('/') === '90/160/120' && r.rw.join('/') === '70/120/90', r);
      check('B25 buying SPARE CELL at rw_rest charges the shown 70 bits (engine buy() uses UB.Util.vendorPrice — engine request)', r.vendor.indexOf('spare_cell') >= 0 && r.bits === 430, r);
    });

    // =============================================================================================
    // B42 — a settings value and an intensity hook drive the full-screen flashes
    // =============================================================================================
    await section('B42', async () => {
      const r = await ev((UB, d, g, q) => {
        const o = {}, FX = UB.FX;
        d.warp('debug_room', null); d.step(3); d.god(false);
        g.setSetting('screenShake', false);
        const p = q.tilePx(3, 14); d.teleport(p.x, p.y); d.step(30);
        const probe = () => ({ c: q.grab(700, 140, 1, 1), e: q.grab(2, 300, 1, 1) });
        const delta = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
        // hurt with the shake OFF; measure the frame with the flash vs the same frame with FX cleared
        const hurtDelta = () => {
          g.player.iframes = 0; d.setHp(5); g.player.hurt(1, g.player.x + 30); d.step(1);
          q.render(); const a = probe(); FX.clear(); q.render(); const b = probe();
          d.step(70);
          return { centre: delta(a.c, b.c), edge: delta(a.e, b.e) };
        };
        o.normal = hurtDelta();
        g.settings.reducedFlashing = true;
        o.reduced = hurtDelta();
        delete g.settings.reducedFlashing;
        o.hook = typeof FX.setFlashScale === 'function';
        if (o.hook) { FX.setFlashScale(0); o.scaled0 = hurtDelta(); FX.setFlashScale(1); o.scale = FX.flashScale; }
        g.setSetting('screenShake', true);
        return o;
      });
      check('B42 baseline: a hurt with Screen Shake OFF tints the whole screen (DESIGN §3.2 red flash)', r.normal.centre > 20, r);
      check('B42 reducedFlashing (settings value) replaces the full-screen wash with a thin edge pulse', r.reduced.centre <= 3 && r.reduced.edge > 20, r);
      check('B42 FX.setFlashScale(0) removes the hurt flash entirely (intensity hook), and 1 restores it', r.hook && r.scaled0.centre <= 3 && r.scaled0.edge <= 3 && r.scale === 1, r);
    });

    // =============================================================================================
    // B19 — the one-time "Down + Jump drops through" hint
    // =============================================================================================
    await section('B19', async () => {
      await reload(true);
      await startGame('tessik');
      const HINT = 'Down + Jump drops through';
      // the repro: arrive in bv_sluice from the top; the grate box only continues with Down + Jump
      const sl = await ev((UB, d, g, q, HINT) => {
        const o = {};
        d.warp('bv_sluice', 'T');
        for (let i = 0; i < 120 && !(g.player.onGround && g.mode === 'normal'); i++) d.step(1);
        d.step(2);
        o.ground = g.player.onGround; o.y = g.player.y;
        // trying to go down: Down held on the grate
        d.pressed('down', 40); d.step(40);
        let tx = q.texts(); o.shown = q.has(tx, HINT); o.keys = tx.filter(t => /\+/.test(t[0]) && t[0] !== HINT).map(t => t[0]);
        UB.Input.device = 'gamepad'; o.padKeys = q.texts().filter(t => /\+/.test(t[0]) && t[0] !== HINT).map(t => t[0]); UB.Input.device = 'keyboard';
        // Down + Jump: drop through; the hint goes away
        d.pressed('down', 12); d.step(1); d.pressed('jump', 2); d.step(20);
        o.dropped = g.player.y > o.y + 20; o.after = q.has(q.texts(), HINT);
        // once per run: a second arrival does not show it again
        d.warp('bv_sluice', 'T'); for (let i = 0; i < 120 && !(g.player.onGround && g.mode === 'normal'); i++) d.step(1);
        d.pressed('down', 60); d.step(60); o.again = q.has(q.texts(), HINT);
        return o;
      }, HINT);
      check('B19 standing on the bv_sluice arrival grate with Down held shows "Down + Jump drops through" with the keys (↓ + SPACE)', sl.ground && sl.shown && sl.keys.indexOf('↓ + SPACE') >= 0, sl);
      check('B19 on the pad the keys read "↓ + A"', sl.padKeys.indexOf('↓ + A') >= 0, sl);
      check('B19 Down + Jump drops through the grate and the hint goes away', sl.dropped && !sl.after, sl);
      check('B19 the hint is one-time: a second arrival never shows it again', !sl.again, sl);
      // a closed box (must drop): the hint shows without any input; an open grate without Down shows nothing
      await reload(true);
      await startGame('tessik');
      const box = await ev((UB, d, g, q, HINT) => {
        const o = {}, room = UB.World.rooms.debug_room, keep = room.tiles.slice();
        try {
          // plain debug_room grate (row 8, x10–13): open on both sides — standing still shows nothing
          let p = q.tilePx(11, 7); d.warp('debug_room', { x: p.x, y: p.y }); d.step(120);
          o.openGround = g.player.onGround; o.openShown = q.has(q.texts(), HINT);
          // wall the grate in at rows 6–7 (x9 and x14): standing on it is a closed box
          const put = (row, x) => { const s = room.tiles[row]; room.tiles[row] = s.slice(0, x) + '#' + s.slice(x + 1); };
          put(6, 9); put(7, 9); put(6, 14); put(7, 14);
          d.warp('debug_room2', null); d.step(2);
          p = q.tilePx(11, 7); d.warp('debug_room', { x: p.x, y: p.y }); d.step(60);
          o.boxGround = g.player.onGround; o.boxShown = q.has(q.texts(), HINT);
          g.openOverlay('pause'); d.step(1); o.underPause = q.has(q.texts(), HINT); g.closeOverlay(); d.step(1);
        } finally { room.tiles.length = 0; keep.forEach(s => room.tiles.push(s)); }
        return o;
      }, HINT);
      await reload(true);
      await startGame('tessik');
      await ev((UB, d, g) => { d.warp('bv_sluice', 'T'); for (let i = 0; i < 120 && !(g.player.onGround && g.mode === 'normal'); i++) d.step(1); d.pressed('down', 40); d.step(40); });
      await shot('b19-drop-hint-sluice');
      check('B19 an open grate (walk-off ends) with no input shows no hint', box.openGround && !box.openShown, box);
      check('B19 a grate the player must drop through (walled in) shows the hint without any input', box.boxGround && box.boxShown, box);
      check('B19 the hint is not drawn under the pause menu', !box.underPause, box);
    });

    check('no console errors or page errors', t.errors.length === 0, t.errors);
  } catch (e) {
    check('test run threw: ' + (e && e.message), false, e && e.stack);
  }
  const failed = results.filter(r => !r.ok).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed' + (failed ? ', ' + failed + ' FAILED' : ''));
  await t.close();
  process.exit(failed ? 1 : 0);
})();
