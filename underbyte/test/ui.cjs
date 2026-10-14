/*
 * UNDERBYTE — test/ui.cjs
 * UI/FX module test (Playwright, headless Chromium, file:// index.html).
 * Run:  node underbyte/test/ui.cjs      (exit code 0 = all PASS)
 *
 * Boots the game, drives every screen and overlay with real keyboard events (and a fake
 * gamepad), screenshots each one to test/shots/ui-<screen>.png, checks the title → select → play
 * flow, pause/map open+close, a settings change that survives a reload, game over via
 * UB.debug.setHp(0), victory via UB.debug.skipTo('victory'), the vendor panel, the lore card,
 * HUD messages (toast / banner / boss card / boss bar), the FX API (burst, shake, flash, hitstop
 * zoom, text) and a particle budget check (500 live particles, average tick+render < 8 ms over
 * 120 frames). Finally: no console errors / page errors.
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./harness.cjs');

const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok, info });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info) : ''));
}
const SHOTS = path.resolve(__dirname, 'shots');

(async () => {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  const t = await launch();
  const page = t.page;
  const D = (fn, ...args) => page.evaluate(({ src, args }) => {
    const f = new Function('d', 'args', 'return (' + src + ')(d, ...args)');
    return f(window.UB.debug, args);
  }, { src: fn.toString(), args });
  const G = (fn, ...args) => page.evaluate(({ src, args }) => {
    const f = new Function('g', 'args', 'return (' + src + ')(g, ...args)');
    return f(window.UB.game, args);
  }, { src: fn.toString(), args });
  const state = () => page.evaluate(() => window.UB.debug.state());
  const step = (n) => page.evaluate((n) => window.UB.debug.step(n), n);
  async function stepUntil(pred, max, chunk = 5) {
    let s = await state();
    for (let i = 0; i < max && !pred(s); i += chunk) { await step(chunk); s = await state(); }
    return s;
  }
  async function keyTap(key) { await page.keyboard.down(key); await step(1); await page.keyboard.up(key); await step(1); }
  async function shot(name) { await page.waitForTimeout(80); await page.screenshot({ path: path.join(SHOTS, 'ui-' + name + '.png') }); }
  const ui = (fn) => page.evaluate('(' + fn.toString() + ')(window.UB.UI, window.UB.game)');

  try {
    // ---------- boot → title ----------
    await page.evaluate(() => { localStorage.removeItem('underbyte.save'); localStorage.removeItem('underbyte.settings'); });
    await page.reload(); await page.waitForTimeout(250);
    await D(d => d.pauseLogic(true));
    let s = await state();
    check('boots to the title screen', s.screen === 'title', s);
    await step(45);
    await shot('title');
    const api = await page.evaluate(() => ['init', 'enter', 'update', 'tick', 'drawHUD', 'drawScreen', 'toast', 'banner', 'bossCard', 'clearMessages', 'text', 'panel'].filter(k => typeof window.UB.UI[k] !== 'function'));
    check('UB.UI keeps the contract surface', api.length === 0, api);
    const fxApi = await page.evaluate(() => ['init', 'clear', 'update', 'draw', 'drawScreen', 'spawn', 'burst', 'text', 'shake', 'hitstop', 'flash', 'setShakeEnabled', 'count'].filter(k => typeof window.UB.FX[k] !== 'function'));
    check('UB.FX keeps the contract surface', fxApi.length === 0, fxApi);

    // ---------- title → select → play, keyboard only ----------
    check('title: CONTINUE is disabled without a save (cursor on NEW GAME)', (await ui(u => u.sel)) === 0);
    await keyTap('ArrowDown'); // skips the disabled CONTINUE → SETTINGS
    check('title: Down skips the disabled CONTINUE row', (await ui(u => u.sel)) === 2, await ui(u => u.sel));
    await keyTap('ArrowUp');
    await keyTap('Enter');
    s = await state();
    check('title: Enter on NEW GAME opens the character select', s.screen === 'select', s.screen);
    await step(30);
    await shot('select');
    await keyTap('ArrowRight'); await keyTap('ArrowRight');
    check('select: Right twice hovers the third card', (await ui(u => u.sel)) === 2, await ui(u => u.sel));
    const previewAnim = await ui(u => u.selSlide > 0 || u.selPrev === 1);
    check('select: switching fighters starts the slide animation', previewAnim);
    await step(12);
    const bars = await ui(u => Array.from(u.statNow));
    check('select: stat bars eased toward the hovered fighter', bars.every(v => v > 0.1 && v <= 1.05), bars);
    await keyTap('ArrowLeft');
    await keyTap('Enter');
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 150);
    check('select: Enter boots the hovered fighter into play', s.screen === 'play' && s.fighter === 'brackmaw', { screen: s.screen, fighter: s.fighter });

    // ---------- HUD ----------
    await D(d => d.warp('debug_room', null)); await step(5);
    await D(d => d.setHp(1)); await D(d => d.setEnergy(60)); await D(d => d.setMeter(100)); await D(d => d.setBits(137));
    const bs = await D(d => d.spawnBoss('proto_warden'));
    check('debug boss spawned for the HP bar', bs && bs.fight === 'fight', bs);
    await G(g => { g.boss.hp = Math.floor(g.boss.maxHp * 0.6); return true; });
    await page.evaluate(() => { window.UB.UI.toast('DRIFTCACHE', 'Where the kingdom kept what it meant to forget.', 150); });
    await step(40);
    await shot('hud');
    const hud = await ui((u, g) => ({ bits: u.bitsStr, pulse: u.lowPulse, ghost: u.bossGhost, hp: g.boss.hp, name: u.bossName }));
    check('HUD caches the bits string and tracks the boss bar ghost', hud.bits === '137' && hud.ghost >= hud.hp && hud.name.length > 0, hud);
    await D(d => d.setHp(6)); await step(3);
    const heartAnim = await ui(u => Array.from(u.heartT).some(v => v > 0));
    check('gaining hearts starts the heart cell animation', heartAnim);
    await page.evaluate(() => { window.UB.UI.banner('ECHO JUMP ACQUIRED', 'x', 'y', 180); window.UB.UI.bossCard('TALLOCK', 'WARDEN OF THE STACK', 150); });
    const bannerOwn = await ui(u => u.banner2 + '|' + u.banner3);
    check('banner lines come from the UI text table (DESIGN §15.5)', bannerOwn === 'Press JUMP again in the air|A second thought, taken mid-fall.', bannerOwn);
    await step(30);
    await shot('messages');
    await G(g => { g.boss = null; g.bossFight.state = 'done'; return true; });
    await D(d => d.warp('debug_room', null)); await step(5);

    // ---------- pause ----------
    await keyTap('Escape'); s = await state();
    check('Escape opens the pause overlay', s.screen === 'pause' && s.baseScreen === 'play', s.screen);
    await step(20);
    await shot('pause');
    await keyTap('ArrowDown'); await keyTap('ArrowDown'); await keyTap('ArrowDown');
    await keyTap('Enter');
    check('pause: QUIT TO TITLE asks for confirmation (NO default)', (await ui(u => u.confirmQuit && u.ynSel === 0)));
    await keyTap('Enter'); s = await state();
    check('pause: confirming NO stays in the game', s.screen === 'pause' && !(await ui(u => u.confirmQuit)), s.screen);
    await keyTap('Escape'); s = await state();
    check('Escape again resumes play', s.screen === 'play', s.screen);

    // ---------- map ----------
    await keyTap('KeyM'); s = await state();
    check('M opens the map overlay', s.screen === 'map', s.screen);
    await page.keyboard.down('ArrowRight'); await step(10); await page.keyboard.up('ArrowRight'); await step(1);
    check('map: holding Right pans the map', (await ui(u => u.mapPan.x)) !== 0, await ui(u => u.mapPan));
    await keyTap('KeyR');
    check('map: R recentres', (await ui(u => u.mapPan.x)) === 0, await ui(u => u.mapPan));
    await step(10);
    await shot('map');
    await keyTap('KeyM'); s = await state();
    check('M closes the map', s.screen === 'play', s.screen);
    // a real-world map with discovered rooms + Deep Ping
    await D(d => d.warp('dc_shrine', null)); await step(5);
    await D(d => d.setBits(500)); await D(d => d.buy('deep_ping'));
    await D(d => d.warp('dc_cross', null)); await step(5);
    await keyTap('KeyM'); await step(10);
    await shot('map-world');
    s = await state();
    check('map shows the real world after warping (overlay open, deep ping owned)', s.screen === 'map' && s.vendor.includes('deep_ping'), s);
    await keyTap('Escape'); s = await state();
    check('Escape closes the map too', s.screen === 'play', s.screen);
    // first entry into Driftcache: the engine opens the lore card 90 f after the zone toast; the UI draws + closes it
    s = await stepUntil(x => x.screen === 'lore', 150);
    check('the zone lore card opens on the first entry to a zone', s.screen === 'lore', s.screen);
    await step(30);
    await shot('lore');
    await keyTap('Space'); s = await state();
    check('lore: any key closes the card', s.screen === 'play', s.screen);

    // ---------- settings (from pause) + persistence ----------
    await keyTap('Escape'); await keyTap('ArrowDown'); await keyTap('ArrowDown'); await keyTap('Enter');
    s = await state();
    check('pause → SETTINGS opens the settings overlay', s.screen === 'settings', s.screen);
    const fromTitle = await ui(u => u.fromTitle);
    check("settings from pause hides RESET SAVE", fromTitle === false, fromTitle);
    await step(10);
    await shot('settings');
    await keyTap('ArrowLeft');
    let master = await G(g => g.settings.master);
    check('settings: Left lowers MASTER VOLUME 8 → 7', master === 7, master);
    await keyTap('ArrowDown'); await keyTap('ArrowDown'); await keyTap('ArrowDown'); // SCREEN SHAKE
    await keyTap('Enter');
    const shake = await G(g => g.settings.screenShake);
    check('settings: Enter toggles SCREEN SHAKE off', shake === false, shake);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('underbyte.settings') || 'null'));
    check('settings are written to underbyte.settings immediately', stored && stored.master === 7 && stored.screenShake === false, stored);
    await keyTap('Escape'); s = await state();
    check('settings: Esc returns to the pause menu', s.screen === 'pause', s.screen);
    const pauseSel = await ui(u => u.sel);
    check('pause cursor is restored to SETTINGS after closing it', pauseSel === 2, pauseSel);
    await keyTap('Escape');

    // ---------- shop + lore overlays ----------
    await D(d => d.setBits(200));
    await D(d => d.skipTo('shop')); await step(10);
    s = await state();
    check('skipTo(shop) opens the vendor panel', s.screen === 'shop', s.screen);
    const shopSel = await ui(u => u.sel);
    check('shop cursor starts on the first unsold row (SPARE CELL)', shopSel === 0, shopSel);
    await shot('shop');
    await keyTap('ArrowDown'); await keyTap('Enter'); // HOT CLOCK 160 → affordable
    s = await state();
    check('shop: Enter buys HOT CLOCK', s.vendor.includes('hot_clock') && s.bits === 40, { vendor: s.vendor, bits: s.bits });
    await keyTap('ArrowUp'); await keyTap('Enter'); // SPARE CELL 90 → poor
    const poor = await ui(u => u.shopMsgT > 0 && u.shopMsg);
    check('shop: an unaffordable item shows the can\'t-afford line', poor === 'Come back heavier.', poor);
    await keyTap('Escape'); s = await state();
    check('shop: Esc closes the panel', s.screen === 'play', s.screen);
    await D(d => d.skipTo('lore')); await step(5);
    s = await state();
    check('skipTo(lore) opens the lore card', s.screen === 'lore', s.screen);
    await step(241); s = await state();
    check('lore: the card closes itself after 240 f', s.screen === 'play', s.screen);

    // ---------- fake gamepad drives the menus ----------
    await page.evaluate(() => {
      const pad = { connected: true, index: 0, id: 'fake', axes: [0, 0], buttons: [] };
      for (let i = 0; i < 17; i++) pad.buttons.push({ pressed: false, value: 0 });
      window.__pad = pad;
      navigator.getGamepads = function () { return [pad]; };
    });
    await page.evaluate(() => { window.__pad.buttons[9].pressed = true; window.UB.debug.step(1); window.__pad.buttons[9].pressed = false; window.UB.debug.step(1); });
    s = await state();
    check('gamepad: Start opens the pause menu', s.screen === 'pause', s.screen);
    await page.evaluate(() => { window.__pad.buttons[13].pressed = true; window.UB.debug.step(1); window.__pad.buttons[13].pressed = false; window.UB.debug.step(1); });
    check('gamepad: d-pad Down moves the cursor', (await ui(u => u.sel)) === 1, await ui(u => u.sel));
    await page.evaluate(() => { window.__pad.buttons[0].pressed = true; window.UB.debug.step(1); window.__pad.buttons[0].pressed = false; window.UB.debug.step(1); });
    s = await state();
    check('gamepad: A confirms (MAP opens from the pause menu)', s.screen === 'map', s.screen);
    await page.evaluate(() => { window.__pad.buttons[1].pressed = true; window.UB.debug.step(1); window.__pad.buttons[1].pressed = false; window.UB.debug.step(1); });
    s = await state();
    check('gamepad: B backs out of the map to the pause menu', s.screen === 'pause', s.screen);
    await page.evaluate(() => { window.__pad.buttons[9].pressed = true; window.UB.debug.step(1); window.__pad.buttons[9].pressed = false; window.UB.debug.step(1); });
    s = await state();
    check('gamepad: Start resumes', s.screen === 'play', s.screen);
    await page.evaluate(() => { navigator.getGamepads = function () { return []; }; });
    await keyTap('ArrowLeft'); // back to the keyboard device for glyphs

    // ---------- FX: bursts, shake, flash, hitstop zoom, text ----------
    await page.evaluate(() => window.UB.FX.setShakeEnabled(true));   // the settings test switched shake off
    s = await state();
    check('back in play with no overlay before the FX checks', s.screen === 'play', s.screen);
    const n0 = await D(d => d.fx('spark', 300, 400, { n: 20 }));
    const n1 = await D(d => d.fx('chip', 300, 400, { n: 12, color: '#ff0' }));
    const n2 = await D(d => d.fx('ring', 300, 400, { radius: 40 }));
    const n3 = await D(d => d.fx('heal', 300, 400, { n: 16 }));
    const n4 = await D(d => d.fx('telegraph', 300, 400, { n: 6 }));
    check('FX bursts add live particles for every preset', n0 >= 20 && n1 >= 32 && n2 >= 33 && n3 >= 49 && n4 >= 55, [n0, n1, n2, n3, n4]);
    await D(d => d.fx('shake', 0, 0, { mag: 6, frames: 12 })); await step(1);
    let sh = await page.evaluate(() => Math.abs(window.UB.FX.shakeX) + Math.abs(window.UB.FX.shakeY));
    check('screen shake produces an offset while active', sh > 0, sh);
    await step(14);
    sh = await page.evaluate(() => Math.abs(window.UB.FX.shakeX) + Math.abs(window.UB.FX.shakeY));
    check('screen shake decays to zero', sh === 0, sh);
    await D(d => d.fx('hitstop', 300, 400, { frames: 8 }));
    await D(d => d.fx('spark', 300, 400, { n: 4 }));
    const zoom = await page.evaluate(() => { const z = window.UB.FX._zoom > 0; window.UB.game.render(1); return z; });
    check('hitstop > 5 f arms the impact zoom and renders without error', zoom);
    await D(d => d.fx('flash', 0, 0, { color: '#ffffff', alpha: 0.5, frames: 6 }));
    await D(d => d.fx('text', 300, 380, { str: '+20', frames: 20 }));
    await step(2);
    await shot('fx');
    await page.evaluate(() => { window.UB.FX.setShakeEnabled(false); window.UB.FX.shake(10, 10); });
    sh = await page.evaluate(() => window.UB.FX._shakeLeft);
    check('setShakeEnabled(false) ignores shake requests', sh === 0, sh);
    await page.evaluate(() => window.UB.FX.setShakeEnabled(true));

    // ---------- particle budget: 500 live particles, tick + render < 8 ms average over 120 frames ----------
    await stepUntil(() => true, 1);
    const perf = await page.evaluate(() => {
      const FX = window.UB.FX, g = window.UB.game;
      FX.clear();
      for (let i = 0; i < 25; i++) FX.burst('spark', 300 + i * 10, 300, 8, { color: '#8fd3ff' });
      for (let i = 0; i < 25; i++) FX.burst('chip', 300 + i * 10, 300, 8, { color: '#ffd166' });
      for (let i = 0; i < 10; i++) FX.burst('glitter', 400, 350, 10, { color: '#8fe388' });
      const live = FX.count();
      const t0 = performance.now();
      for (let i = 0; i < 120; i++) {
        if (i % 20 === 0) { for (let j = 0; j < 10; j++) FX.burst('spark', 320 + j * 8, 320, 10, { color: '#8fd3ff' }); }   // keep the pool busy
        g.tick(); g.render(1);
      }
      const ms = (performance.now() - t0) / 120;
      return { live, ms, after: FX.count() };
    });
    check('500 particles spawned into the pool (' + perf.live + ')', perf.live >= 500, perf);
    check('average tick + render stays under 8 ms with the pool busy (' + perf.ms.toFixed(2) + ' ms)', perf.ms < 8, perf);

    // ---------- game over via setHp(0) ----------
    await D(d => d.warp('debug_room', null)); await step(3);
    await D(d => d.setHp(0));
    s = await stepUntil(x => x.screen === 'gameover' && !x.busy, 240);
    check('setHp(0) leads to the game over screen', s.screen === 'gameover', s.screen);
    await step(40);
    await shot('gameover');
    await keyTap('Enter');
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 150);
    check('game over: Enter respawns into play', s.screen === 'play' && s.hp === s.maxHp, { screen: s.screen, hp: s.hp });

    // ---------- victory via the contract hook ----------
    await D(d => d.skipTo('victory'));
    s = await stepUntil(x => x.screen === 'victory' && !x.busy, 200);
    check('skipTo(victory) shows the victory screen', s.screen === 'victory', s.screen);
    const rows = await ui(u => u.vicRows.length);
    check('victory: eight stat rows are prepared once on enter', rows === 8, rows);
    await step(150);
    await shot('victory');
    await keyTap('ArrowDown');
    const epi = await ui(u => u.epiOff);
    check('victory: a key advances the epilogue a line', epi === 20, epi);
    await keyTap('Enter'); s = await state();
    check('victory: Enter returns to the title', s.screen === 'title', s.screen);

    // ---------- title with a save: CONTINUE default, overwrite confirm ----------
    check('title: cursor defaults to CONTINUE when a save exists', s.hasSave && (await ui(u => u.sel)) === 1, { hasSave: s.hasSave, sel: await ui(u => u.sel) });
    await step(5);
    await shot('title-save');
    await keyTap('ArrowUp'); await keyTap('Enter');
    check('title: NEW GAME over a save asks to overwrite', (await ui(u => u.confirmNew)));
    await keyTap('Enter'); s = await state();
    check('title: NO keeps the title', s.screen === 'title' && !(await ui(u => u.confirmNew)), s.screen);
    await keyTap('Enter'); await keyTap('ArrowLeft'); await keyTap('Enter'); s = await state();
    check('title: YES opens the character select', s.screen === 'select', s.screen);
    await keyTap('Escape'); s = await state();
    check('select: Esc returns to the title', s.screen === 'title', s.screen);
    // settings from the title shows RESET SAVE; Esc closes
    await keyTap('ArrowDown'); await keyTap('Enter'); s = await state();
    check('title: SETTINGS opens the settings overlay', s.screen === 'settings', s.screen);
    check('settings from the title shows RESET SAVE', (await ui(u => u.fromTitle)) === true);
    await step(5);
    await shot('settings-title');
    await keyTap('Escape'); s = await state();
    check('settings: Esc returns to the title', s.screen === 'title', s.screen);

    // ---------- persistence after reload ----------
    await page.reload(); await page.waitForTimeout(250);
    await D(d => d.pauseLogic(true));
    const after = await G(g => ({ master: g.settings.master, shake: g.settings.screenShake }));
    check('changed settings persist across a reload', after.master === 7 && after.shake === false, after);
    await G(g => { g.setSetting('master', 8); g.setSetting('screenShake', true); return true; });

    // ---------- render sanity + no console errors ----------
    await D(d => d.pauseLogic(false)); await page.waitForTimeout(300);
    const px = await page.evaluate(() => { const c = document.getElementById('game'); const d = c.getContext('2d').getImageData(c.width / 2, c.height / 2, 1, 1).data; return [d[0], d[1], d[2]]; });
    check('canvas renders something at the centre', px[0] + px[1] + px[2] > 0, px);
    check('no console errors or page errors', t.errors.length === 0, t.errors);
  } catch (e) {
    check('test threw: ' + (e && e.message ? e.message : String(e)), false, e && e.stack);
  }

  const fails = results.filter(r => !r.ok);
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' checks passed' + (fails.length ? ' — FAILED: ' + fails.map(f => f.name).join(' | ') : ''));
  if (t.errors.length) console.log('page errors:\n' + t.errors.join('\n'));
  await t.close();
  process.exit(fails.length ? 1 : 0);
})();
