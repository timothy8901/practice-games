/*
 * UNDERBYTE — test/qa-ui.cjs
 * QA round 3 · lens: UI, SAVE, CONTROLS, TEXT (Playwright, headless Chromium, file:// index.html).
 * Run:  node underbyte/test/qa-ui.cjs      (exit code 0 = every check PASS; rerunnable by the fixer)
 *
 * Sections (DESIGN §2 controls, §12 HUD & screens, §14 save, §15 text; CONTRACT §8.1, §9, §10). Round-2 additions
 * are marked "r2", round-3 additions "r3"; checks that fail on the current build describe the defect in their name
 * ("DEFECT: …"). Round 3 adds: the select-screen move names + the §15.10 ability descriptions to the text audit, a
 * gamepad-only title (PRESS ANY KEY), RESET SAVE without a save, the pinned panel rects by pixel, the hint strip vs the
 * boss bar, the §12.12 dotted links / exit stubs / core dots / header, a full-world map screenshot, the settings slider
 * value "10" inside the panel, two pads + stick menus + pad flows through lore / settings / game over / victory,
 * CONTINUE after a victory (§12.16 rw_rest), the overwrite prompt's slot semantics, and a localStorage that throws.
 *   A  static text audit: every visible string in ui.js / engine.js / world.js / bosses.js / characters.js / enemies.js
 *      exists in DESIGN.md (§15, §5.3, §4.4, §6, §12); bestiary names ⊆ §15.11; no franchise term anywhere in js/ or index.html
 *   B  title by keyboard: boot, PRESS ANY KEY before the first gesture (keyboard + pointer gestures), CONTINUE disabled +
 *      skipped without a save, SETTINGS → BACK keeps a valid cursor, Space as confirm, r2: the SAVE ERASED / gamepad toasts
 *      must render on the title, tagline font per §12.9
 *   C  character select: 5 cards, wrap both ways, stats ease, names/titles per §15, bios fit 4 lines, confirm boots
 *   D  the DESIGN §2.2 key table, buffers, menu key-repeat, blur releases keys, r2: auto-repeat keydown ignored, Tab/Space
 *      preventDefault, Up at a node rests instead of jumping
 *   E  HUD: hearts (pixels), 9-cell row with core diamonds, energy bar + ticks + spend ghost + deny flash, meter + READY,
 *      r2: Overclock drain / OVERCLOCKED label / last-3 s blink, bits counter + pop, toasts, banners (§15.5, gamepad variant,
 *      wrap), boss card + bar (draw-out over f120–150, lost chunk, phase 2), low-HP pulse, hint strip (+ DASH / OVERCLOCK items)
 *   F  pause: Esc/P/Start, world + play time frozen, rows, QUIT confirm (NO default), visibilitychange, duck, the confirm-key
 *      buffer rule (Z / Space / A / Up / X), r2: pause → MAP → Esc returns to the pause row, pause during the hazard freeze and
 *      the boss intro resumes cleanly, the boss title card survives a pause
 *   G  map: open/close keys, discovered = visited + exit targets, fog, visited fill, dashed neighbour, node / boss skull / player
 *      dot, pan + recentre, r2: room cursor (nearest room, '?' for unvisited, Confirm recentres), bestiary footer (enemy names,
 *      'no enemies', NAME · EPITHET · purged), footer text must not collide with the legend / close hints, Deep Ping
 *   H  settings: sliders/toggles, written immediately, persist across reload, RESET SAVE only from the title, missing keys →
 *      defaults, corrupt values sanitised (r2: array file, touchControls)
 *   I  shop: TRADE prompt → Up opens, greeting ∈ §15.9, rw_rest first greeting, prices 90/160/120 (r2: DANGER when poor), buy
 *      with exact deductions, save written, PURCHASED banner on close, poor → 'Come back heavier.' + deny, sold, sold-out line
 *   J  lore card: first zone entry only, text = §5.3, closes on any key / after 240 f, r2: Esc closes it without opening the
 *      pause menu, 'Press any key' appears after 60 f
 *   K  gamepad (fake standard pad): every button/axis → action, menus by pad, glyphs switch, disconnect → pause + toasts,
 *      r2: d-pad key-repeat, pad + keyboard at once, A respawns from game over, B/A on the victory screen
 *   L  game over → respawn: deaths++, SIGNAL LOST pixels, JUMP or CONFIRM respawns, r2: the first 20 f ignore input, a death
 *      before any node use respawns at the start node without writing a save
 *   M  victory after a debug-assisted finish: r2: the real Kernauth death → finale → victory screen; all 8 stat rows vs the
 *      save, confirm ignored until the rows typed in, epilogue advance, CONFIRM → title with CONTINUE default + summary
 *   N  save: node save, reload → CONTINUE restores, corrupt / partially corrupt slots, storage blocked → toast, overwrite
 *      prompt, RESET SAVE, r2: a boss death writes the save (CONTINUE → no boss, seals open), quitting during a boss fight
 *      keeps it alive, unsaved bits are lost on QUIT TO TITLE
 *   O  letterboxing at 800×600 and 1920×1080 (+ dpr 2), fixed-position text widths with the real fonts
 *   P  no console / page errors
 */
const fs = require('fs');
const path = require('path');
const { launch } = require('./harness.cjs');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.resolve(__dirname, 'shots');
const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok, info });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info).slice(0, 600) : ''));
}

// ---------------------------------------------------------------------------------------------------
// In-page helper library (installed with page.evaluate after every load).
// ---------------------------------------------------------------------------------------------------
function QA_INSTALL() {
  const UB = window.UB, d = UB.debug, In = UB.Input;
  const Q = {};
  Q.render = function () { UB.game.render(1); };
  Q.px = function (x, y) {
    const c = document.getElementById('game'), dpr = UB.game.dpr || 1;
    const dd = c.getContext('2d').getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data;
    return [dd[0], dd[1], dd[2]];
  };
  Q.rpx = function (x, y) { Q.render(); return Q.px(x, y); };
  /** Count pixels in a logical rect for which pred(r,g,b) holds (renders first). */
  Q.scan = function (x, y, w, h, pred) {
    Q.render();
    const c = document.getElementById('game'), dpr = UB.game.dpr || 1;
    const dd = c.getContext('2d').getImageData(Math.round(x * dpr), Math.round(y * dpr), Math.round(w * dpr), Math.round(h * dpr)).data;
    let n = 0; for (let i = 0; i < dd.length; i += 4) if (pred(dd[i], dd[i + 1], dd[i + 2])) n++;
    return n;
  };
  /** Raw bytes of a logical rect (no render). */
  Q.band = function (x, y, w, h) {
    const c = document.getElementById('game'), dpr = UB.game.dpr || 1;
    return Array.from(c.getContext('2d').getImageData(Math.round(x * dpr), Math.round(y * dpr), Math.round(w * dpr), Math.round(h * dpr)).data);
  };
  Q.hex = function (h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  Q.near = function (p, hex, tol) { const c = Q.hex(hex); tol = tol || 12; return Math.abs(p[0] - c[0]) <= tol && Math.abs(p[1] - c[1]) <= tol && Math.abs(p[2] - c[2]) <= tol; };
  Q.key = function (code, down, repeat) { window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: code, key: code, bubbles: true, cancelable: true, repeat: !!repeat })); };
  Q.tap = function (code, n) { Q.key(code, true); d.step(n || 1); Q.key(code, false); d.step(1); };
  Q.snapInput = function () { const o = {}; for (const a in In.state) { const s = In.state[a]; if (s.down || s.pressed) o[a] = (s.pressed ? 'P' : '') + (s.down ? 'D' : ''); } return o; };
  /** keydown `code`, one tick, read which actions see it, keyup, one tick. */
  Q.probeKey = function (code) { Q.key(code, true); d.step(1); const o = Q.snapInput(); Q.key(code, false); d.step(1); return o; };
  Q.pad = null;
  Q.padOn = function () {
    const pad = { connected: true, index: 0, id: 'QA standard pad', mapping: 'standard', axes: [0, 0, 0, 0], buttons: [] };
    for (let i = 0; i < 17; i++) pad.buttons.push({ pressed: false, touched: false, value: 0 });
    Q.pad = pad; navigator.getGamepads = function () { return [pad]; }; return true;
  };
  Q.padOff = function () { Q.pad = null; Q.pads = []; navigator.getGamepads = function () { return []; }; };
  Q.padTap = function (b, n) { const btn = Q.pad.buttons[b]; btn.pressed = true; btn.value = 1; d.step(n || 1); const o = Q.snapInput(); btn.pressed = false; btn.value = 0; d.step(1); return o; };
  Q.padHold = function (b, on) { const btn = Q.pad.buttons[b]; btn.pressed = !!on; btn.value = on ? 1 : 0; };
  /** r3: n standard pads at once (Q.pads[k]); padTapK presses button b of pad k for n frames. */
  Q.pads = [];
  Q.padOnN = function (n) {
    Q.pads = [];
    for (let k = 0; k < n; k++) { const pad = { connected: true, index: k, id: 'QA pad ' + k, mapping: 'standard', axes: [0, 0, 0, 0], buttons: [] }; for (let i = 0; i < 17; i++) pad.buttons.push({ pressed: false, touched: false, value: 0 }); Q.pads.push(pad); }
    Q.pad = Q.pads[0]; navigator.getGamepads = function () { return Q.pads.slice(); }; return true;
  };
  Q.padTapK = function (b, n, k) { const btn = Q.pads[k].buttons[b]; btn.pressed = true; btn.value = 1; d.step(n || 1); const o = Q.snapInput(); btn.pressed = false; btn.value = 0; d.step(1); return o; };
  Q._mc = null;
  Q.measure = function (str, font) { if (!Q._mc) Q._mc = document.createElement('canvas').getContext('2d'); Q._mc.font = font; return Q._mc.measureText(str).width; };
  Q.wrap = function (str, font, w) { if (!Q._mc) Q._mc = document.createElement('canvas').getContext('2d'); Q._mc.font = font; return UB.Util.wrapText(Q._mc, str, w); };
  /** Map-screen rect of a room (screen px), as drawMap lays it out around the current room. */
  Q.mapRect = function (id) {
    const g = UB.game, r = UB.World.rooms[id], cur = g.level.room, S = 40, UI = UB.UI;
    const ox = 480 - (cur.gx + cur.gw / 2) * S + UI.mapPan.x, oy = 270 - (cur.gy + cur.gh / 2) * S + UI.mapPan.y;
    return { x: ox + r.gx * S + 2, y: oy + r.gy * S + 2, w: r.gw * S - 4, h: r.gh * S - 4 };
  };
  Q.tilePx = function (tx, ty) { return { x: tx * 30 + 15, y: (ty + 1) * 30 }; };
  /** Rest at the node tile (tx, ty) (feet on ty+1): teleport, Up, wait for the save. */
  Q.restAt = function (tx, ty) { const p = Q.tilePx(tx, ty); d.teleport(p.x, p.y); d.step(4); d.pressed('up', 2); d.step(2); for (let i = 0; i < 150 && UB.game.mode !== 'normal'; i++) d.step(1); return d.state(); };
  window.__QA = Q;
  return true;
}

(async () => {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });
  const t = await launch();
  const page = t.page;
  const D = (fn, ...args) => page.evaluate(({ src, args }) => { const f = new Function('d', 'args', 'return (' + src + ')(d, ...args)'); return f(window.UB.debug, args); }, { src: fn.toString(), args });
  const G = (fn, ...args) => page.evaluate(({ src, args }) => { const f = new Function('g', 'args', 'return (' + src + ')(g, ...args)'); return f(window.UB.game, args); }, { src: fn.toString(), args });
  const Q = (fn, ...args) => page.evaluate(({ src, args }) => { const f = new Function('q', 'args', 'return (' + src + ')(q, ...args)'); return f(window.__QA, args); }, { src: fn.toString(), args });
  /** (UB, d, g, q, ...args) evaluator for the round-2 probes. */
  const ev = (fn, ...args) => page.evaluate(({ src, args }) => { const f = new Function('UB', 'd', 'g', 'q', 'args', 'return (' + src + ')(UB, d, g, q, ...args)'); return f(window.UB, window.UB.debug, window.UB.game, window.__QA, args); }, { src: fn.toString(), args });
  const ui = (fn) => page.evaluate('(' + fn.toString() + ')(window.UB.UI, window.UB.game)');
  const state = () => page.evaluate(() => window.UB.debug.state());
  const step = (n) => page.evaluate((n) => window.UB.debug.step(n), n);
  async function stepUntil(pred, max, chunk = 5) { let s = await state(); for (let i = 0; i < max && !pred(s); i += chunk) { await step(chunk); s = await state(); } return s; }
  async function keyTap(key) { await page.keyboard.down(key); await step(1); await page.keyboard.up(key); await step(1); }
  async function shot(name) { await page.evaluate(() => window.UB.game.render(1)); await page.waitForTimeout(60); await page.screenshot({ path: path.join(SHOTS, 'qa-ui-' + name + '.png') }); }
  async function reload(clear) {
    if (clear) await page.evaluate(() => { localStorage.removeItem('underbyte.save'); localStorage.removeItem('underbyte.settings'); });
    await page.reload(); await page.waitForTimeout(250);
    await page.evaluate(QA_INSTALL);
    await D(d => d.pauseLogic(true));
  }
  async function startGame(fighter) {
    await D((d, f) => d.newGame(f), fighter);
    return stepUntil(x => x.screen === 'play' && !x.busy, 300);
  }
  /** New game + step through the first-zone lore card so later sections never see it reopen mid-check. */
  async function startGameClean(fighter) {
    let s = await startGame(fighter);
    s = await stepUntil(x => x.screen === 'lore', 400, 1);
    if (s.screen === 'lore') { await step(12); await D(d => d.pressed('confirm', 2)); await step(3); }
    return state();
  }
  /** Close whatever overlay is open (lore needs > 10 f before a key closes it). */
  async function clearOverlay() {
    for (let k = 0; k < 60; k++) {
      const s = await state(); if (!s.overlay) return s;
      if (s.overlay === 'lore') { await step(12); await D(d => d.pressed('confirm', 2)); await step(2); }
      else { await D(d => d.pressed('back', 2)); await step(2); }
    }
    return state();
  }
  async function section(name, fn) {
    try { await fn(); } catch (e) { check(name + ': section threw ' + (e && e.message ? e.message : String(e)), false, e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e); }
  }

  // =================================================================================================
  // A. static text audit (Node side) — every visible string exists in DESIGN.md; no franchise terms
  // =================================================================================================
  const design = fs.readFileSync(path.join(ROOT, 'DESIGN.md'), 'utf8');
  const designNorm = design.replace(/[`*_]/g, '').replace(/\s+/g, ' ');
  const inDesign = (s) => designNorm.indexOf(String(s).replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim()) >= 0;
  const uiSrc = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'), 'utf8');
  let TXT = null, BANNER_TEXT = null;
  const BESTIARY_NAMES = ['Scuttlebit', 'Hopnode', 'Driftmoth', 'Brinejelly', 'Glarewisp', 'Spitvalve', 'Rambyte', 'Platewalker', 'Broodcell', 'Droplatch', 'Voltwheel',
    'Brinecrab', 'Static-shot', 'Rootbound', 'Dripnode', 'Nullnode', 'Rootwisp', 'Acid Valve', 'Twin Valve', 'Rootram', 'Rootplate', 'Tallock', 'Weftyr', 'Corrosant', 'Kernauth'];
  await section('A', async () => {
    const vm = require('vm');
    const mTxt = uiSrc.match(/const TXT = (\{[\s\S]*?\n  \});/);
    const mBan = uiSrc.match(/const BANNER_TEXT = (\{[\s\S]*?\n  \});/);
    check('A: ui.js TXT and BANNER_TEXT tables are extractable', !!(mTxt && mBan));
    TXT = vm.runInNewContext('(' + mTxt[1] + ')');
    BANNER_TEXT = vm.runInNewContext('(' + mBan[1] + ')');
    const strings = [];
    const add = (label, s) => { if (typeof s === 'string' && s.trim()) strings.push([label, s]); };
    for (const k in TXT) {
      const v = TXT[k];
      if (k === 'quit1' || k === 'reset1') continue;
      if (k === 'quit2') { add('TXT.quit', TXT.quit1 + ' ' + TXT.quit2); continue; }
      if (k === 'reset2') { add('TXT.reset', TXT.reset1 + ' ' + TXT.reset2); continue; }
      if (k === 'ocReady') { add('TXT.ocReady', 'OVERCLOCK — READY'); continue; }
      if (Array.isArray(v)) v.forEach((s, i) => add('TXT.' + k + '[' + i + ']', k === 'moveLabels' ? s.trim() : s));
      else if (v && typeof v === 'object') for (const kk in v) add('TXT.' + k + '.' + kk, v[kk]);
      else add('TXT.' + k, v);
    }
    for (const k in BANNER_TEXT) { add('BANNER ' + k, k); add('BANNER ' + k + ' line2', BANNER_TEXT[k][0]); add('BANNER ' + k + ' line3', BANNER_TEXT[k][2]); }
    const padDerived = Object.keys(BANNER_TEXT).every(k => BANNER_TEXT[k][1] === BANNER_TEXT[k][0].replace('DASH (Shift / RB)', 'RB').replace(/JUMP/g, 'A'));
    check('A: gamepad banner lines are the keyboard lines with the glyphs swapped (§15.5)', padDerived, BANNER_TEXT);
    const engSrc = fs.readFileSync(path.join(ROOT, 'js', 'engine.js'), 'utf8');
    const mainSrc = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
    for (const call of (engSrc + mainSrc).match(/UI\.(?:banner|toast)\(([^)]*)\)/g) || []) {
      const lits = call.match(/'([^']+)'/g) || [];
      for (const l of lits) { const s = l.slice(1, -1); if (s.length > 2 && !/^[a-z]+$/.test(s)) add('engine ' + s, s); }
    }
    add('engine PURCHASED', ' PURCHASED');
    add('engine PURGED', ' PURGED');
    const live = await page.evaluate(() => {
      const out = [];
      const Z = UB.World.zones; for (const id in Z) { if (Z[id].debug) continue; out.push(['zone ' + id + ' name', Z[id].name], ['zone ' + id + ' blurb', Z[id].blurb], ['zone ' + id + ' lore', Z[id].lore]); }
      const R = UB.World.rooms; for (const id in R) { if (R[id].debug) continue; out.push(['room ' + id + ' name', R[id].name]); }
      const B = UB.Bosses.DATA; for (const id in B) { if (id === 'proto_warden') continue; out.push(['boss ' + id + ' name', B[id].name], ['boss ' + id + ' subtitle', B[id].subtitle]); }
      UB.IDS.vendorItems.forEach(it => out.push(['vendor ' + it.id + ' name', it.name], ['vendor ' + it.id + ' effect', it.effect], ['vendor ' + it.id + ' price', String(it.price) + ' bits']));
      UB.Characters.list.forEach(f => out.push(['fighter ' + f.id + ' name', f.name], ['fighter ' + f.id + ' title', f.title], ['fighter ' + f.id + ' bio', f.bio]));
      const T = UB.Enemies.TYPES; for (const id in T) { if (id === 'walker' || id === 'bossSegment' || id === 'mote') continue; out.push(['enemy ' + id + ' name', T[id].name]); }
      return out;
    });
    live.forEach(([l, s]) => add(l, s));
    const missing = strings.filter(([l, s]) => !inDesign(s)).map(([l, s]) => l + ' = ' + JSON.stringify(s).slice(0, 80));
    check('A: every visible UI/engine/world/boss/vendor/fighter/enemy string exists in DESIGN.md (' + strings.length + ' strings)', missing.length === 0, missing);
    const files = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => path.join('js', f)).concat(['index.html']);
    const bad = [];
    const re = /\b(digimon|digivolv\w*|hollow\s*knight|hallownest|knight|nail|geo|soul|pok[eé]mon|pikachu|agumon|samus|metroid|castlevania|zelda|mario|kirby|mega\s*man|megaman)\b/i;
    for (const f of files) {
      const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
      lines.forEach((ln, i) => { const m = ln.match(re); if (m) bad.push(f + ':' + (i + 1) + ' "' + m[0] + '"'); });
    }
    check('A: no franchise term in js/*.js or index.html', bad.length === 0, bad);
    const vis = strings.filter(([l, s]) => re.test(s)).map(([l]) => l);
    check('A: no franchise term in any visible string', vis.length === 0, vis);
    check('A: vendor prices pinned 90 / 160 / 120 (DESIGN §9.5)', (await page.evaluate(() => UB.IDS.vendorItems.map(i => i.price).join('/'))) === '90/160/120');
    const enemyNames = await page.evaluate(() => { const T = UB.Enemies.TYPES, o = []; for (const id in T) if (id !== 'walker' && id !== 'bossSegment' && id !== 'mote') o.push(T[id].name); return o; });
    check('A: enemy display names are the §15.11 names', enemyNames.every(n => BESTIARY_NAMES.indexOf(n) >= 0), enemyNames.filter(n => BESTIARY_NAMES.indexOf(n) < 0));
    // r3: the move names the select screen's moveset panel shows (§12.10) are the §4.2 sheet names
    const moveNames = await page.evaluate(() => UB.Characters.list.map(f => ({ id: f.id, names: ['light1', 'light2', 'light3', 'heavy', 'special', 'ultimate'].map(k => f.moves[k] && f.moves[k].name).filter(Boolean) })));
    const missingMoves = []; moveNames.forEach(m => m.names.forEach(n => { if (!inDesign(n)) missingMoves.push(m.id + ': ' + n); }));
    check('A: every move name on the select screen (L1 / L2 / L3 / heavy / special / ultimate × 5 fighters) exists in DESIGN §4.2', moveNames.every(m => m.names.length === 6) && missingMoves.length === 0, { missingMoves, counts: moveNames.map(m => m.names.length) });
    // r3: §15.10 — "Ability names and the three abilities' in-game descriptions (map legend, pause menu)"
    const abilityDesc = ['ECHO JUMP — a second jump in the air', 'BURST LINE — a 6-tile lunge, ground or air', 'GRIP PROTOCOL — cling to walls and kick off them'];
    const allSrc = fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')).join('\n');
    const absentDesc = abilityDesc.filter(s => allSrc.indexOf(s.split(' — ')[1]) < 0);
    check('A: the §15.10 ability descriptions ("a second jump in the air" / "a 6-tile lunge, ground or air" / "cling to walls and kick off them") exist in the game for the map legend / pause menu (DEFECT: no screen lists the owned abilities and the three strings are absent from js/)', absentDesc.length === 0, absentDesc);
  });

  // =================================================================================================
  // B. title screen, keyboard only (+ r2: toasts on the title, tagline font)
  // =================================================================================================
  await section('B', async () => {
    await reload(true);
    let s = await state();
    check('B: boots to the title screen', s.screen === 'title', s.screen);
    check('B: PRESS ANY KEY is pending before the first gesture (UB.Input.gestured false)', (await page.evaluate(() => UB.Input.gestured)) === false);
    await step(2);
    const pressAny = await page.evaluate(() => { const UI = UB.UI; UI.t = 5; UB.game.render(1); const c = document.getElementById('game').getContext('2d'); const dd = c.getImageData(400, 462, 160, 16).data; let hit = 0; for (let i = 0; i < dd.length; i += 4) if (dd[i] > 220 && dd[i + 1] > 180 && dd[i + 2] < 140) hit++; return hit; });
    check('B: PRESS ANY KEY is drawn in SELECT at (480,470) before the first gesture', pressAny > 20, pressAny);
    check('B: no save → CONTINUE disabled, cursor on NEW GAME', !s.hasSave && (await ui(u => u.sel)) === 0, { hasSave: s.hasSave });
    check('B: title: CONTINUE disabled → continueGame() returns false and stays on the title', (await D(d => d.continueGame())) === false && (await state()).screen === 'title');
    await shot('title-nosave');
    // r2: a pointer press is a gesture too (audio unlock) — PRESS ANY KEY stops
    const ptr = await page.evaluate(() => { window.dispatchEvent(new Event('pointerdown')); UB.debug.step(1); const g = UB.Input.gestured; UB.UI.t = 5; UB.game.render(1); const c = document.getElementById('game').getContext('2d'); const dd = c.getImageData(400, 462, 160, 16).data; let hit = 0; for (let i = 0; i < dd.length; i += 4) if (dd[i] > 220 && dd[i + 1] > 180 && dd[i + 2] < 140) hit++; return [g, hit]; });
    check('B: a pointerdown counts as the first gesture and PRESS ANY KEY stops', ptr[0] === true && ptr[1] === 0, ptr);
    await keyTap('ArrowDown');
    check('B: Down skips the disabled CONTINUE row → SETTINGS', (await ui(u => u.sel)) === 2, await ui(u => u.sel));
    await keyTap('ArrowDown');
    check('B: Down wraps to NEW GAME', (await ui(u => u.sel)) === 0, await ui(u => u.sel));
    await keyTap('ArrowUp');
    check('B: Up wraps to SETTINGS (skipping CONTINUE)', (await ui(u => u.sel)) === 2, await ui(u => u.sel));
    await keyTap('Enter'); s = await state();
    check('B: Enter on SETTINGS opens the settings overlay over the title', s.screen === 'settings' && s.baseScreen === 'title', s);
    check('B: settings from the title shows RESET SAVE (7 rows)', (await ui(u => u.fromTitle)) === true);
    await keyTap('ArrowUp');
    check('B: settings: Up from the first row wraps to BACK (row 6)', (await ui(u => u.sel)) === 6, await ui(u => u.sel));
    await keyTap('Enter'); s = await state();
    check('B: settings: Enter on BACK returns to the title', s.screen === 'title', s.screen);
    const selAfter = await ui(u => u.sel);
    check('B: title cursor is a valid title row (0–2) after closing SETTINGS', selAfter >= 0 && selAfter <= 2, { sel: selAfter });
    await keyTap('Escape'); s = await state();
    check('B: Esc on the title stays on the title', s.screen === 'title', s.screen);
    let sel = await ui(u => u.sel); while (sel !== 0) { await keyTap('ArrowDown'); sel = await ui(u => u.sel); }
    await keyTap('Enter'); s = await state();
    check('B: Enter on NEW GAME opens the character select', s.screen === 'select', s.screen);
    await keyTap('Escape'); s = await state();
    check('B: Esc on the select screen returns to the title', s.screen === 'title', s.screen);
    check('B: confirm glyph is ENTER on the keyboard', (await page.evaluate(() => UB.Input.glyph('confirm'))) === 'ENTER');
    // r2: Space is a confirm key too, and booting with it must not carry a jump into play
    await ev((UB, d, g, q) => { while (UB.UI.sel !== 0) q.tap('ArrowDown'); q.tap('Space'); });
    check('B: Space confirms NEW GAME → select', (await state()).screen === 'select');
    await ev((UB, d, g, q) => q.tap('Space'));
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 300);
    const boot = await G(g => ({ screen: g.screen, state: g.player.state, vy: Math.round(g.player.vy), grounded: g.player.onGround }));
    check('B: Space on the select screen boots the game without a jump on arrival', boot.screen === 'play' && boot.state === 'idle' && boot.vy === 0, boot);
    // r2: toasts set while NOT in play must still render (DESIGN §15.8: SAVE ERASED 90 f, Gamepad connected)
    await reload(true);
    await ev((UB, d, g, q) => { localStorage.setItem('underbyte.save', JSON.stringify(g.newSaveData('tessik'))); g.savedData = g.readSave(); UB.UI.enter('title', g); });
    await ev((UB, d, g, q) => { while (UB.UI.sel !== 2) q.tap('ArrowDown'); q.tap('Enter'); while (UB.UI.sel !== 5) q.tap('ArrowDown'); q.tap('Enter'); q.tap('ArrowLeft'); q.tap('Enter'); q.tap('Escape'); });
    const erased = await ev((UB, d, g, q) => { const UI = UB.UI; const t0 = UI.toastT, l = UI.toast1; d.step(25); const paper = q.scan(330, 426, 300, 28, (r, gg, b) => r > 215 && gg > 205 && b > 180); return { toastT: t0, toast1: l, screen: g.screen, overlay: g.overlay, hasSave: g.hasSave(), paperPx: paper }; });
    check('B: RESET SAVE from the title shows the 90 f "SAVE ERASED" toast ON THE TITLE SCREEN (DEFECT: drawToast only runs inside drawHUD, which the engine calls in play only — the toast is set but never drawn)', erased.toast1 === 'SAVE ERASED' && erased.toastT > 0 && erased.screen === 'title' && !erased.overlay && erased.paperPx > 30, erased);
    await shot('title-after-reset');
    const padToast = await ev((UB, d, g, q) => { UB.UI.clearMessages(); window.dispatchEvent(new Event('gamepadconnected')); d.step(25); const paper = q.scan(330, 426, 300, 28, (r, gg, b) => r > 215 && gg > 205 && b > 180); return { toastT: UB.UI.toastT, toast1: UB.UI.toast1, paperPx: paper }; });
    check('B: the "Gamepad connected" toast renders on the title screen (same DEFECT: toasts are invisible outside play)', padToast.toast1 === 'Gamepad connected' && padToast.paperPx > 30, padToast);
    // r2: §12.9 tagline font is 18px MONO
    const tagM = uiSrc.match(/UI\.text\(ctx, TXT\.tagline, 480, 232, F\.(\w+)/);
    const tagFont = tagM ? (uiSrc.match(new RegExp(tagM[1] + ': UB\\.font\\((\\d+), \'(\\w+)\'')) || []) : null;
    check('B: the title tagline is drawn at (480,232) in 18px MONO (DESIGN §12.9) (DEFECT: ui.js uses F.mono16)', !!tagFont && tagFont[1] === '18' && tagFont[2] === 'MONO', { call: tagM && tagM[0], font: tagFont && tagFont[0] });
    // r3: a gamepad-only player never produces a keyboard / pointer gesture — the title must still stop blinking PRESS ANY KEY
    await reload(true);
    const padOnly = await ev((UB, d, g, q) => { q.padOn(); q.padTap(13); q.padTap(12); d.step(5); const o = { device: UB.Input.device, gestured: UB.Input.gestured, screen: g.screen }; UB.UI.t = 5; q.render(); o.pressAnyPx = q.scan(400, 462, 160, 16, (r, gg, b) => r > 220 && gg > 180 && b < 140); q.padOff(); return o; });
    check('B: a gamepad press on the title counts as the first gesture — PRESS ANY KEY stops blinking (DEFECT: only keyboard / pointer / touch call fireGesture, so a pad-only player sees PRESS ANY KEY blink forever)', padOnly.device === 'gamepad' && padOnly.screen === 'title' && padOnly.pressAnyPx === 0, padOnly);
    await shot('title-padonly');
    // r3: RESET SAVE while no save exists must not claim one was erased
    const noSaveReset = await ev((UB, d, g, q) => { UB.UI.clearMessages(); while (UB.UI.sel !== 2) q.tap('ArrowDown'); q.tap('Enter'); while (UB.UI.sel !== 5) q.tap('ArrowDown'); q.tap('Enter'); const dlg = UB.UI.confirmReset; if (dlg) { q.tap('ArrowLeft'); q.tap('Enter'); } const o = { hasSave: g.hasSave(), dlg: dlg, toast: UB.UI.toastT > 0 ? UB.UI.toast1 : '' }; q.tap('Escape'); q.tap('Escape'); return o; });
    check('B: RESET SAVE with no save present does not show the SAVE ERASED toast (DEFECT: the row is live without a slot and toasts SAVE ERASED although nothing was erased)', noSaveReset.hasSave === false && noSaveReset.toast !== 'SAVE ERASED', noSaveReset);
  });

  // =================================================================================================
  // C. character select
  // =================================================================================================
  await section('C', async () => {
    await reload(true);
    await ev((UB, d, g, q) => { q.tap('Enter'); });
    let s = await state();
    check('C: NEW GAME → the select screen', s.screen === 'select', s.screen);
    const roster = await page.evaluate(() => UB.Characters.list.map(f => ({ id: f.id, name: f.name, title: f.title })));
    check('C: roster is the five §15 fighters in order', roster.map(r => r.id).join(',') === 'tessik,brackmaw,vellix,orrubel,korvask', roster);
    check('C: display names are the capitalised ids', roster.every(r => r.name === r.id.charAt(0).toUpperCase() + r.id.slice(1)), roster);
    check('C: titles per §15.3', roster.map(r => r.title).join('|') === 'The Courier Lantern|The Walking Vault|The Prefetch Streak|The Ring Warden|The Clamp Balancer', roster.map(r => r.title));
    await keyTap('ArrowLeft');
    check('C: Left from the first card wraps to the last (Korvask)', (await ui(u => u.sel)) === 4, await ui(u => u.sel));
    await keyTap('ArrowRight');
    check('C: Right wraps back to the first card', (await ui(u => u.sel)) === 0, await ui(u => u.sel));
    await keyTap('ArrowRight'); await keyTap('ArrowRight');
    check('C: Right twice hovers Vellix', (await ui(u => u.sel)) === 2);
    await step(40);
    const stats = await ui(u => Array.from(u.statNow));
    check('C: stat bars eased to Vellix (hearts 4/6, speed 1.0, weight 1.0)', Math.abs(stats[0] - 4 / 6) < 0.03 && Math.abs(stats[1] - 1) < 0.03 && Math.abs(stats[3] - 1) < 0.03, stats);
    const fit = await page.evaluate(() => {
      const q = window.__QA, out = [];
      UB.Characters.list.forEach(f => {
        const lines = q.wrap(f.bio, UB.font(11, 'MONO'), 490);
        const m = f.moves;
        const l1 = 'LIGHT  ' + m.light1.name + ' / ' + m.light2.name + ' / ' + m.light3.name;
        const l2 = 'HEAVY  ' + m.heavy.name + '   SPECIAL  ' + m.special.name;
        const l3 = 'ULTIMATE  ' + m.ultimate.name;
        out.push({ id: f.id, bioLines: lines.length, maxBio: Math.max.apply(null, lines.map(l => q.measure(l, UB.font(11, 'MONO')))), mv: Math.max(q.measure(l1, UB.font(12, 'MONO')), q.measure(l2, UB.font(12, 'MONO')), q.measure(l3, UB.font(12, 'MONO'))), title: q.measure(f.title, UB.font(11, 'MONO')) });
      });
      return out;
    });
    check('C: every bio wraps to ≤ 4 lines of ≤ 490 px (nothing truncated)', fit.every(f => f.bioLines <= 4 && f.maxBio <= 490), fit);
    check('C: every moveset line fits the 360 px panel (≤ 340 px from x 576)', fit.every(f => f.mv <= 340), fit.map(f => [f.id, Math.round(f.mv)]));
    check('C: every card title fits its 150 px card', fit.every(f => f.title <= 146), fit.map(f => [f.id, Math.round(f.title)]));
    await shot('select-vellix');
    await keyTap('ArrowRight'); await keyTap('ArrowRight');
    await step(20);
    await keyTap('Enter');
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 200);
    check('C: Enter boots the hovered fighter (Korvask) into play at dc_wake', s.screen === 'play' && s.fighter === 'korvask' && s.roomId === 'dc_wake', { screen: s.screen, fighter: s.fighter, room: s.roomId });
    check('C: new game starts with 6 hearts / energy 50 (+regen) / meter 0 (Korvask)', s.hp === 6 && s.maxHp === 6 && s.energy >= 50 && s.energy < 56 && s.meter === 0, { hp: s.hp, maxHp: s.maxHp, energy: s.energy, meter: s.meter });
  });

  // =================================================================================================
  // D. keyboard table (DESIGN §2.2)
  // =================================================================================================
  await section('D', async () => {
    await clearOverlay();
    await D(d => d.warp('debug_room', null)); await step(5);
    await D(d => d.god(true));
    const table = {
      ArrowLeft: ['left'], KeyA: ['left'], ArrowRight: ['right'], KeyD: ['right'],
      ArrowUp: ['up', 'jump'], KeyW: ['up', 'jump'], ArrowDown: ['down'], KeyS: ['down'],
      Space: ['jump', 'confirm'], KeyZ: ['light', 'confirm'], KeyJ: ['light', 'confirm'],
      KeyX: ['heavy', 'back'], KeyK: ['heavy', 'back'], KeyC: ['special'], KeyL: ['special'],
      ShiftLeft: ['dash'], ShiftRight: ['dash'], Semicolon: ['dash'], KeyV: ['overclock'], KeyI: ['overclock'],
      Enter: ['confirm'], Escape: ['back', 'pause'], Backspace: ['back'], KeyP: ['pause'], KeyM: ['map'], Tab: ['map'],
    };
    const wrong = [];
    for (const code in table) {
      const seen = await Q((q, c) => q.probeKey(c), code);
      const want = table[code];
      for (const a of want) if (!seen[a] || seen[a].indexOf('D') < 0) wrong.push(code + ' → ' + a + ' not down (' + JSON.stringify(seen) + ')');
      for (const a in seen) if (want.indexOf(a) < 0) wrong.push(code + ' also fires ' + a);
      await clearOverlay();
    }
    check('D: every DESIGN §2.2 key code maps to exactly its actions (' + Object.keys(table).length + ' codes)', wrong.length === 0, wrong);
    const buf = await page.evaluate(() => { const q = window.__QA; q.key('KeyZ', true); UB.debug.step(1); const b0 = UB.Input.state.light.buffer; q.key('KeyZ', false); UB.debug.step(3); return [b0, UB.Input.state.light.buffer]; });
    check('D: buffered actions start at 6 and tick down', buf[0] === 6 && buf[1] === 3, buf);
    const rep = await page.evaluate(() => { const q = window.__QA; q.key('ArrowDown', true); const hits = []; for (let i = 1; i <= 50; i++) { UB.debug.step(1); if (UB.Input.repeat('down')) hits.push(i); } q.key('ArrowDown', false); UB.debug.step(1); return hits; });
    check('D: menu key-repeat fires on the press, again after an initial delay (18–25 f), then every 8 f', rep[0] === 1 && rep[1] >= 19 && rep[1] <= 26 && rep[2] === rep[1] + 8 && rep[3] === rep[1] + 16, rep);
    const blur = await page.evaluate(() => { const q = window.__QA; q.key('ArrowRight', true); UB.debug.step(2); const d0 = UB.Input.state.right.down; window.dispatchEvent(new Event('blur')); UB.debug.step(1); const d1 = UB.Input.state.right.down; q.key('ArrowRight', false); UB.debug.step(1); return [d0, d1]; });
    check('D: a window blur releases every held key', blur[0] === true && blur[1] === false, blur);
    // r2: OS auto-repeat keydown events never re-fire a press edge; mapped keys are preventDefault-ed
    const rpt = await page.evaluate(() => { const q = window.__QA; q.key('KeyZ', true); UB.debug.step(3); q.key('KeyZ', true, true); UB.debug.step(1); const p = UB.Input.state.light.pressed, b = UB.Input.state.light.buffer; q.key('KeyZ', false); UB.debug.step(1); return [p, b]; });
    check('D: an auto-repeat keydown (e.repeat) does not fire a new press edge', rpt[0] === false && rpt[1] === 0, rpt);
    const pd = await page.evaluate(() => { const out = []; for (const code of ['Tab', 'Space', 'ArrowDown', 'KeyQ']) { const e = new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }); window.dispatchEvent(e); out.push(e.defaultPrevented); window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true, cancelable: true })); } UB.debug.step(2); return out; });
    check('D: Tab / Space / arrows are preventDefault-ed (no page scroll or focus loss) and an unmapped key is not', pd.join(',') === 'true,true,true,false', pd);
    await clearOverlay();
    await D(d => d.warp('dc_wake', null)); await step(3);
    const n = await page.evaluate(() => { const p = window.__QA.tilePx(5, 12); UB.debug.teleport(p.x, p.y); UB.debug.step(4); return UB.debug.state().prompt; });
    check('D: standing at the restore node shows the REST prompt', n === 'REST', n);
    const rest = await page.evaluate(() => { const q = window.__QA; q.key('ArrowUp', true); UB.debug.step(1); const s = UB.debug.state(); q.key('ArrowUp', false); UB.debug.step(1); return { mode: s.mode, vy: s.vy }; });
    check('D: Up at the node rests (mode nodeUse) and does not jump (vy 0)', rest.mode === 'nodeUse' && rest.vy === 0, rest);
    let s = await stepUntil(x => x.mode === 'normal', 120);
    check('D: the node writes the save (CONTINUE available)', s.hasSave && s.savedRoom === 'dc_wake', { hasSave: s.hasSave, savedRoom: s.savedRoom });
    check('D: RESTORED banner lines (§15.5)', (await ui(u => u.banner1 + '|' + u.banner2)) === 'RESTORED|Saved · hearts full · energy full', await ui(u => u.banner1 + '|' + u.banner2));
    await D(d => d.god(false));
  });

  // =================================================================================================
  // E. HUD
  // =================================================================================================
  await section('E', async () => {
    await clearOverlay();
    await D(d => d.warp('debug_room', null)); await step(3);
    await page.evaluate(() => window.UB.UI.clearMessages());
    await D(d => d.setHp(4)); await step(10);
    const hearts = await Q(q => { q.render(); const out = []; for (let i = 0; i < 6; i++) out.push(q.px(39 + i * 32, 38)); return out; });
    check('E: hearts 0–3 are filled HEART and 4–5 HEART_EMPTY at hp 4/6', hearts.slice(0, 4).every(p => p[0] > 180 && p[1] < 110) && hearts.slice(4).every(p => p[0] < 110 && p[0] > 40 && p[1] < 70), hearts);
    // r2: losing a heart starts the 8 f 1.4→1 cell animation (kind 1)
    const lose = await ev((UB, d, g, q) => { d.setHp(3); d.step(1); return [UB.UI.heartT[3], UB.UI.heartKind[3]]; });
    check('E: losing a heart starts that cell\'s 8 f scale animation', lose[0] >= 7 && lose[0] <= 8 && lose[1] === 1, lose);
    await D(d => d.setMaxHp(7)); await D(d => d.setHp(7)); await step(14);
    const core = await Q(q => { q.render(); return [q.px(39 + 6 * 32, 35), q.px(39 + 5 * 32, 38)]; });
    check('E: the 7th cell (a core) is a CORE_HEART diamond, the 6th a base HEART', core[0][0] > 200 && core[0][1] > 150 && core[0][2] < 110 && core[1][0] > 180 && core[1][1] < 110, core);
    // r2: the full 9-cell row (6 base + 3 cores) fits left of the bits counter
    const nine = await ev((UB, d, g, q) => { d.setMaxHp(9); d.setHp(9); d.step(14); q.render(); return { c9: q.px(39 + 8 * 32, 35), c7: q.px(39 + 6 * 32, 35), c6: q.px(39 + 5 * 32, 38), bits: q.px(896, 32) }; });
    check('E: a 9-cell row draws cells 7–9 as CORE_HEART diamonds and keeps the bits hexagon at (896,32)', nine.c9[0] > 200 && nine.c9[1] > 150 && nine.c9[2] < 110 && nine.c7[0] > 200 && nine.c7[1] > 150 && nine.c6[0] > 180 && nine.c6[1] < 110 && nine.bits[1] > 180 && nine.bits[0] < 190, nine);
    await shot('hud-9hearts');
    await D(d => d.setMaxHp(6)); await D(d => d.setHp(6)); await step(14);
    await D(d => d.setEnergy(60)); await step(40);
    const en = await Q(q => { q.render(); return [q.px(40, 62), q.px(190, 62), q.px(69, 62)]; });
    check('E: energy bar fill is ENERGY at 60/100 and the trough ENERGY_DIM beyond', en[0][2] > 200 && en[0][0] < 120 && en[1][0] < 60 && en[1][2] < 120, en);
    check('E: energy bar has a PAPER tick every 25 energy', en[2][0] > 200 && en[2][1] > 200, en[2]);
    // r2: a spend leaves a PAPER ghost (15 f); an unaffordable special flashes the bar DANGER + deny
    const ghost = await ev((UB, d, g, q) => { g.player.energy = 100; d.step(1); g.player.energy = 70; d.step(1); return [UB.UI.ghostT, UB.UI.ghostFrom, UB.UI.ghostTo]; });
    check('E: spending energy starts the 15 f ghost segment (100 → 70)', ghost[0] === 15 && ghost[1] === 100 && ghost[2] === 70, ghost);
    const deny = await ev((UB, d, g, q) => { d.step(20); g.player.energy = 0; d.pressed('special', 2); d.step(1); const df = g.denyFlash; const px = q.rpx(30, 62); return { denyFlash: df, px: px, state: g.player.state }; });
    check('E: an insufficient-energy special press sets denyFlash 6 and the bar flashes DANGER', deny.denyFlash === 6 && deny.px[0] > 200 && deny.px[1] < 90, deny);
    await step(30);
    await D(d => d.setMeter(50)); await step(2);
    const mt = await Q(q => { q.render(); return [q.px(40, 92), q.px(190, 92)]; });
    check('E: meter fill is METER (violet) at 50/100 and the trough dark beyond', mt[0][2] > 200 && mt[0][0] > 150 && mt[1][0] < 70 && mt[1][2] < 90, mt);
    await D(d => d.setMeter(100)); await step(2);
    const ready = await page.evaluate(() => { UB.UI.t = 8; UB.game.render(1); const c = document.getElementById('game').getContext('2d'); const dd = c.getImageData(24, 96, 180, 16).data; let sel = 0; for (let i = 0; i < dd.length; i += 4) if (dd[i] > 180 && dd[i + 1] > 140 && dd[i + 2] < 140 && dd[i] > dd[i + 2] + 60) sel++; return sel; });
    check('E: full meter: the label switches to the SELECT "OVERCLOCK — READY [V]" text', ready > 12, ready);
    check('E: READY glyph is the first overclock key (V)', (await page.evaluate(() => UB.Input.glyph('overclock'))) === 'V');
    // r2: Overclock: the bar becomes the 720 f timer in the fighter's glow, label OVERCLOCKED, last 3 s blink 6/6
    const oc = await ev((UB, d, g, q) => {
      g.player.energy = 100; d.pressed('overclock', 2); d.step(40);
      const pl = g.player, glow = pl.data.ocPalette.glow, c = q.hex(glow);
      const out = { active: pl.ocActive, left: pl.overclock, glow: glow };
      out.labelPx = q.scan(24, 100, 110, 12, (r, gg, b) => Math.abs(r - c[0]) < 40 && Math.abs(gg - c[1]) < 40 && Math.abs(b - c[2]) < 40);
      out.fillEarly = q.near(q.rpx(190, 92), glow, 40);
      pl.overclock = 360; out.fillHalfAt190 = q.near(q.rpx(190, 92), glow, 40); out.fillHalfAt60 = q.near(q.rpx(60, 92), glow, 40);
      pl.overclock = 100; out.blinkOn = q.near(q.rpx(30, 92), glow, 40);
      pl.overclock = 106; out.blinkOff = q.near(q.rpx(30, 92), glow, 40);
      pl.overclock = 20; d.step(60);
      out.ended = !g.player.ocActive;
      return out;
    });
    check('E: Overclock: OVERCLOCKED label in the glow, bar full at the start, half at 360/720, ends', oc.active && oc.labelPx > 20 && oc.fillEarly && !oc.fillHalfAt190 && oc.fillHalfAt60 && oc.ended, oc);
    check('E: Overclock last 3 s: the bar blinks 6 f on / 6 f off', oc.blinkOn === true && oc.blinkOff === false, oc);
    await shot('hud-overclock');
    await D(d => d.setBits(137)); await step(2);
    check('E: bits counter string tracks save.bits', (await ui(u => u.bitsStr)) === '137');
    await D(d => d.addBits(5)); await step(1);
    check('E: bits pickup pops the counter (bitsPop 10 → 9)', (await ui(u => u.bitsPop)) >= 8 && (await ui(u => u.bitsStr)) === '142', await ui(u => [u.bitsPop, u.bitsStr]));
    const hexpx = await Q(q => { q.render(); return q.px(896, 32); });
    check('E: BITS hexagon icon at (896,32)', hexpx[1] > 180 && hexpx[0] < 190, hexpx);
    await page.evaluate(() => UB.UI.toast('DRIFTCACHE', 'Where the kingdom kept what it meant to forget.', 150));
    check('E: a two-line zone toast is the centred big kind', (await ui(u => u.toastBottom)) === false);
    await page.evaluate(() => UB.UI.toast('TALLOCK PURGED', '', 120));
    check('E: a one-line toast ({NAME} PURGED) sits at the bottom', (await ui(u => u.toastBottom)) === true);
    const toastPx = await ev((UB, d, g, q) => { d.step(25); return q.scan(380, 428, 200, 24, (r, gg, b) => r > 215 && gg > 205 && b > 180); });
    check('E: the bottom toast is drawn in PAPER at (480,440) in play', toastPx > 30, toastPx);
    await page.evaluate(() => UB.UI.clearMessages());
    const bannerW = await page.evaluate(() => {
      const q = window.__QA, out = [];
      const keys = ['ECHO JUMP ACQUIRED', 'BURST LINE ACQUIRED', 'GRIP PROTOCOL ACQUIRED', 'CORE FOUND', 'RESTORED'];
      for (const dev of ['keyboard', 'gamepad']) {
        UB.Input.device = dev;
        for (const k of keys) { UB.UI.banner(k, '', '', 100); out.push({ dev, k, l2: UB.UI.banner2, l2b: UB.UI.banner2b, l3: UB.UI.banner3, w: Math.round(Math.max(q.measure(UB.UI.banner2, UB.UI.banner2Font), q.measure(UB.UI.banner2b, UB.UI.banner2Font))) }); }
      }
      UB.Input.device = 'keyboard'; UB.UI.clearMessages();
      return out;
    });
    const expect2 = { 'ECHO JUMP ACQUIRED': ['Press JUMP again in the air', 'Press A again in the air'], 'CORE FOUND': ['Max hearts +1', 'Max hearts +1'], 'RESTORED': ['Saved · hearts full · energy full', 'Saved · hearts full · energy full'] };
    check('E: banner line 2 swaps JUMP → A for the gamepad (Echo Jump) and keeps the §15.5 text', bannerW.filter(b => expect2[b.k]).every(b => b.l2 === expect2[b.k][b.dev === 'gamepad' ? 1 : 0]), bannerW.filter(b => expect2[b.k]));
    check('E: every banner line 2 (or its wrapped halves) fits inside the 480 px panel', bannerW.every(b => b.w <= 470), bannerW.filter(b => b.w > 470));
    check('E: the Burst Line keyboard line is wrapped onto two lines rather than shrunk off the panel', bannerW.some(b => b.k === 'BURST LINE ACQUIRED' && b.dev === 'keyboard' && b.l2b.length > 0), bannerW.filter(b => b.k === 'BURST LINE ACQUIRED'));
    await page.evaluate(() => UB.UI.banner('BURST LINE ACQUIRED', '', '', 200)); await step(30);
    await shot('banner-burstline');
    await page.evaluate(() => UB.UI.clearMessages());
    check('E: prompt glyph for Up is ↑ on the keyboard', (await page.evaluate(() => UB.Input.glyph('up'))) === '↑');
    const bs = await D(d => d.spawnBoss('proto_warden'));
    check('E: debug boss spawned live for the HP bar', bs && bs.fight === 'fight', bs);
    const chunk = await ev((UB, d, g, q) => { d.step(2); g.boss.hp = Math.floor(g.boss.maxHp * 0.5); d.step(1); return [UB.UI.bossHold, UB.UI.bossGhost > g.boss.hp]; });
    check('E: boss damage leaves a lost chunk that lingers 20 f (bossHold 20, ghost above hp)', chunk[0] >= 19 && chunk[0] <= 20 && chunk[1] === true, chunk);
    await step(30);
    const bar = await Q(q => { q.render(); return { fill: q.px(200, 500), trough: q.px(760, 500), edge: q.px(480, 486) }; });
    check('E: boss bar (180,486) 600×30: DANGER-ish fill at 50 % and the dark trough on the right', bar.fill[0] > 200 && bar.fill[1] < 150 && bar.trough[0] < 70 && bar.trough[1] < 50, bar);
    check('E: boss name line = NAME · SUBTITLE', (await ui(u => u.bossName + ' · ' + u.bossSub)) === 'PROTO WARDEN · PLACEHOLDER OF THE ARENA');
    await page.evaluate(() => UB.UI.bossCard('TALLOCK', 'WARDEN OF THE STACK', 150)); await step(20);
    const band = await Q(q => { q.render(); return [q.px(60, 200), q.px(900, 262)]; });
    check('E: boss title card: INK band α 0.8 across y 190–270', band.every(p => p[0] < 60 && p[1] < 50 && p[2] < 70), band);
    await shot('hud-boss');
    await G(g => { g.boss.phase = 2; return true; }); await step(2);
    const ph = await ui(u => [u.bossShake, u.bossPhase]);
    check('E: boss phase 2 shakes the bar (bossShake 20 f) and recolours (phase tracked)', ph[0] >= 17 && ph[0] <= 20 && ph[1] === 2, ph);
    await G(g => { g.boss = null; g.bossFight.state = 'done'; return true; });
    await page.evaluate(() => UB.UI.clearMessages());
    await D(d => d.setHp(1)); await step(10);
    const low = await ui(u => u.lowPulse);
    check('E: at 1 heart the low-HP pulse runs (lowPulse ≥ 0, drawLowHp vignette available)', typeof low === 'number' && (await page.evaluate(() => typeof UB.FX.drawLowHp === 'function')));
    await shot('hud-lowhp');
    await D(d => d.setHp(6));
    // r2: the boss bar draws out from the centre over f120–150 of a real intro (dc_sentinel)
    await D(d => d.god(true));
    const intro = await ev((UB, d, g, q) => {
      g.save.bossesDefeated.length = 0; d.warp('dc_sentinel', null); d.step(3);
      const b = g.level.boss; const p = q.tilePx(b.bounds[0] + 1, 14); d.teleport(p.x, p.y); d.step(2);
      const out = { fight: g.bossFight.state, timer: g.bossFight.timer };
      const red = (px) => px[0] > 200 && px[1] < 160 && px[2] < 120;
      out.earlyCentre = red(q.rpx(480, 500)); out.earlyLeft = red(q.px(200, 500));
      while (g.bossFight.timer > 15) d.step(1);
      out.halfCentre = red(q.rpx(480, 500)); out.halfLeft = red(q.px(200, 500));
      while (g.bossFight.state === 'intro') d.step(1);
      d.step(2); out.fullCentre = red(q.rpx(480, 500)); out.fullLeft = red(q.px(200, 500)); out.state = g.bossFight.state;
      return out;
    });
    check('E: the boss HP bar is absent early in the intro, half-width at f135 (centre only) and full once the fight starts', intro.fight === 'intro' && !intro.earlyCentre && !intro.earlyLeft && intro.halfCentre && !intro.halfLeft && intro.fullCentre && intro.fullLeft && intro.state === 'fight', intro);
    await D(d => d.defeatBoss('tallock')); await D(d => d.god(false));
    await startGameClean('tessik');
    let s = await state();
    const hintsFalse = Object.values(s.hints).every(v => v === false);
    await page.evaluate(() => UB.game.render(1));
    const hint0 = await ui(u => u.hintStr);
    check('E: hint strip on a fresh game lists MOVE JUMP LIGHT HEAVY SPECIAL with the bound keys', hintsFalse && /^MOVE ←→\s+JUMP SPACE\s+LIGHT Z\s+HEAVY X\s+SPECIAL C$/i.test(hint0), { hintsFalse, hint0 });
    await page.evaluate(() => { const q = window.__QA; q.key('ArrowRight', true); UB.debug.step(2); q.key('ArrowRight', false); UB.debug.step(1); UB.game.render(1); });
    s = await state();
    check('E: moving records hints.move and the strip drops MOVE', s.hints.move === true && /^JUMP/.test(await ui(u => u.hintStr)), { move: s.hints.move, hint: await ui(u => u.hintStr) });
    // r2: DASH appears once Burst Line is owned; OVERCLOCK once the meter is full
    const hintMore = await ev((UB, d, g, q) => { d.grant('burstLine', true); q.render(); const a = UB.UI.hintStr; d.setMeter(100); q.render(); const b = UB.UI.hintStr; d.setMeter(0); d.grant('burstLine', false); return [a, b]; });
    check('E: the hint strip adds DASH SHIFT once Burst Line is owned and OVERCLOCK V once the meter is full', /DASH SHIFT$/.test(hintMore[0]) && /DASH SHIFT\s+OVERCLOCK V$/.test(hintMore[1]), hintMore);
    await shot('hud-play');
    // r3: the strip shares the bottom edge with the boss bar (§12.8 / §12.6): drawn without a boss, hidden while the bar shows
    await clearOverlay();
    await D(d => d.warp('debug_room', null)); await step(3);
    const hintBoss = await ev((UB, d, g, q) => {
      g.save.visited.length = 1; for (const k in g.save.hints) g.save.hints[k] = false; UB.UI.hintKey = -1; UB.UI.clearMessages();
      const dim = (r, gg, b) => r > 150 && gg > 140 && b > 120;
      q.render(); const a = q.scan(24, 512, 150, 16, dim);
      d.spawnBoss('proto_warden'); d.step(2); q.render(); const b = q.scan(24, 512, 150, 16, dim);
      g.boss = null; g.bossFight.state = 'done'; q.render(); const c = q.scan(24, 512, 150, 16, dim);
      return [a, b, c];
    });
    check('E: the hint strip draws at (24,520) without a boss, hides while the boss bar is up and returns afterwards', hintBoss[0] > 30 && hintBoss[1] === 0 && hintBoss[2] > 30, hintBoss);
    // r3: the pinned panel rects (§12.7, §12.11, §12.12, §12.14, §12.17): the PANEL_EDGE stroke lies on every edge (±2 px band)
    const geo = await ev((UB, d, g, q) => {
      const paper = (r, gg, b) => r > 215 && gg > 205 && b > 180;
      const band = (x, y, w, h) => q.scan(x, y, w, h, paper) > 0;
      const edges = (x, y, w, h) => ({ top: band(x + w / 2, y - 2, 1, 5), bottom: band(x + w / 2, y + h - 2, 1, 5), left: band(x - 2, y + h / 2, 5, 1), right: band(x + w - 2, y + h / 2, 5, 1) });
      const o = {};
      g.openOverlay('pause'); d.step(1); q.render(); o.pause = edges(330, 150, 300, 240); g.closeOverlay(); d.step(1);
      g.openOverlay('settings'); d.step(1); q.render(); o.settings = edges(230, 90, 500, 360); g.closeOverlay(); d.step(1);
      g.openOverlay('shop'); d.step(1); q.render(); o.shop = edges(230, 120, 500, 300); g.closeOverlay(); d.step(1);
      g.openOverlay('map'); d.step(1); q.render(); o.map = edges(20, 20, 920, 500); g.closeOverlay(); d.step(1);
      UB.UI.banner('CORE FOUND', '', '', 100); d.step(14); q.render(); o.banner = edges(240, 200, 480, 120); UB.UI.clearMessages();
      o.bad = ['pause', 'settings', 'shop', 'map', 'banner'].filter(k => !(o[k].top && o[k].bottom && o[k].left && o[k].right));
      return o;
    });
    check('E: panel rects are pinned — pause (330,150) 300×240, settings (230,90) 500×360, shop (230,120) 500×300, map (20,20) 920×500, banner (240,200) 480×120', geo.bad.length === 0, geo);
  });

  // =================================================================================================
  // F. pause
  // =================================================================================================
  await section('F', async () => {
    await clearOverlay();
    let s = await state();
    check('F: in play (dc_wake) before the pause checks', s.screen === 'play' && s.roomId === 'dc_wake', s.screen);
    await step(30);
    const before = await G(g => ({ x: g.player.x, y: g.player.y, e: g.enemies.map(e => [e.x, e.y]), pt: g.save.playTimeFrames, frame: g.frame, uit: UB.UI.t }));
    await keyTap('Escape'); s = await state();
    check('F: Escape opens the pause overlay over play', s.screen === 'pause' && s.baseScreen === 'play', s.screen);
    await step(120);
    const after = await G(g => ({ x: g.player.x, y: g.player.y, e: g.enemies.map(e => [e.x, e.y]), pt: g.save.playTimeFrames, frame: g.frame, uit: UB.UI.t, duck: UB.Audio._duck }));
    check('F: pause freezes the world: player and every enemy keep their positions for 120 f', before.x === after.x && before.y === after.y && JSON.stringify(before.e) === JSON.stringify(after.e), { before, after });
    check('F: pause freezes play time (playTimeFrames unchanged) while game.frame and UI.t advance', after.pt === before.pt && after.frame - before.frame === 122 && after.uit - before.uit === 122, { before, after });
    check('F: music ducks to 0.4 while paused', after.duck === 0.4, after.duck);
    await step(10);
    await shot('pause');
    const rows = await page.evaluate(() => { const q = window.__QA; const o = []; for (let i = 0; i < 4; i++) { o.push(UB.UI.sel); q.tap('ArrowDown'); } return o; });
    check('F: pause menu has 4 rows and Down cycles RESUME → MAP → SETTINGS → QUIT TO TITLE → RESUME', rows.join(',') === '0,1,2,3' && (await ui(u => u.sel)) === 0, rows);
    await keyTap('ArrowUp'); await keyTap('Enter');
    check('F: QUIT TO TITLE asks for confirmation with NO as the default', (await ui(u => u.confirmQuit && u.ynSel === 0)));
    await keyTap('ArrowLeft'); check('F: Left moves the Yes/No cursor to YES', (await ui(u => u.ynSel)) === 1);
    await keyTap('Escape'); s = await state();
    check('F: Esc on the confirm dialog answers NO (still paused, cursor back on QUIT)', s.screen === 'pause' && !(await ui(u => u.confirmQuit)) && (await ui(u => u.sel)) === 3, { screen: s.screen, sel: await ui(u => u.sel) });
    // r2: pause → MAP → Esc returns to the pause menu with the cursor still on MAP
    const viaMap = await ev((UB, d, g, q) => { UB.UI.sel = 1; q.tap('Enter'); const a = g.overlay; q.tap('Escape'); return { map: a, back: g.overlay, sel: UB.UI.sel }; });
    check('F: pause → MAP opens the map and Esc returns to the pause menu on the MAP row', viaMap.map === 'map' && viaMap.back === 'pause' && viaMap.sel === 1, viaMap);
    const viaM = await ev((UB, d, g, q) => { q.tap('KeyM'); const a = g.overlay; q.tap('KeyM'); return [a, g.overlay]; });
    check('F: M on the pause menu opens the map and M closes it back to the pause menu', viaM[0] === 'map' && viaM[1] === 'pause', viaM);
    await keyTap('KeyP'); s = await state();
    check('F: P resumes play', s.screen === 'play', s.screen);
    check('F: resume restores the music duck to 1', (await page.evaluate(() => UB.Audio._duck)) === 1);
    await keyTap('KeyP'); s = await state();
    check('F: P also pauses', s.screen === 'pause', s.screen);
    await keyTap('Escape');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await step(1); s = await state();
    check('F: visibilitychange → hidden pauses the game automatically', s.screen === 'pause', s.screen);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
    await keyTap('Escape');
    const p0 = (await state()).playTimeFrames; await step(100); const p1 = (await state()).playTimeFrames;
    check('F: play time advances 1/frame in play again (100 f → +100)', p1 - p0 === 100, [p0, p1]);
    await D(d => d.warp('debug_room', null)); await step(10);
    const resume = await page.evaluate(() => {
      const q = window.__QA, g = UB.game, out = {};
      const run = function (label, press) { q.tap('Escape'); UB.debug.step(1); press(); UB.debug.step(2); out[label] = { screen: g.overlay || g.screen, state: g.player.state, vy: Math.round(g.player.vy) }; UB.debug.step(90); };
      run('Z on RESUME', function () { q.key('KeyZ', true); UB.debug.step(1); q.key('KeyZ', false); });
      run('Space on RESUME', function () { q.key('Space', true); UB.debug.step(1); q.key('Space', false); });
      run('Up then Esc within 6 f', function () { q.key('ArrowUp', true); UB.debug.step(1); q.key('ArrowUp', false); UB.debug.step(1); q.key('Escape', true); UB.debug.step(1); q.key('Escape', false); });
      run('Enter on RESUME', function () { q.key('Enter', true); UB.debug.step(1); q.key('Enter', false); });
      run('X (back + heavy) closes the pause', function () { q.key('KeyX', true); UB.debug.step(1); q.key('KeyX', false); });
      q.padOn(); run('pad A on RESUME', function () { q.padTap(0); }); run('pad B closes the pause', function () { q.padTap(1); }); q.padOff(); q.key('ArrowLeft', true); q.key('ArrowLeft', false);
      return out;
    });
    const clean = (r) => r.screen === 'play' && r.state === 'idle' && r.vy === 0;
    for (const k in resume) check('F: ' + k + ' resumes without a gameplay action', clean(resume[k]), resume[k]);
    // r2: pausing during the hazard freeze and the boss intro freezes those timers and resumes cleanly
    await D(d => d.god(false)); await D(d => d.warp('dc_fall', null)); await step(3);
    const hz = await ev((UB, d, g, q) => {
      const r = g.level.room; let sx = -1, sy = -1; for (let y = 0; y < r.h && sx < 0; y++) for (let x = 0; x < r.w; x++) if (r.tiles[y][x] === '^') { sx = x; sy = y; break; }
      const p = q.tilePx(sx, sy); const spawn = { x: g.hazardRespawn.x, y: g.hazardRespawn.y }; d.teleport(p.x, p.y - 2); d.step(2);
      const out = { mode0: g.mode, hp0: g.player.hp };
      d.step(8); out.hzT = g.hazard.timer; q.tap('Escape'); out.paused = g.overlay; d.step(150); out.hzT2 = g.hazard.timer; out.mode2 = g.mode; out.pt = g.save.playTimeFrames;
      q.tap('Escape'); d.step(60); out.mode3 = g.mode; out.atSpawn = Math.abs(g.player.x - spawn.x) < 2 && Math.abs(g.player.y - spawn.y) < 2; out.fade = g.fadeLevel; out.hp3 = g.player.hp;
      return out;
    });
    check('F: a pause during the 30 f hazard freeze holds the freeze timer and the respawn completes after resume', hz.mode0 === 'hazard' && hz.paused === 'pause' && hz.hzT === hz.hzT2 && hz.mode2 === 'hazard' && hz.mode3 === 'normal' && hz.atSpawn && hz.fade === 0 && hz.hp3 === hz.hp0, hz);
    await D(d => d.god(true));
    const bi = await ev((UB, d, g, q) => {
      g.save.bossesDefeated.length = 0; d.warp('dc_sentinel', null); d.step(3);
      const b = g.level.boss; const p = q.tilePx(b.bounds[0] + 1, 14); d.teleport(p.x, p.y); d.step(3);
      const out = { fight: g.bossFight.state, mode: g.mode };
      d.step(30); out.timer1 = g.bossFight.timer; out.card1 = UB.UI.cardT;
      q.tap('Escape'); out.overlay = g.overlay; d.step(200); out.timer2 = g.bossFight.timer; out.card2 = UB.UI.cardT;
      q.tap('Escape'); d.step(1); out.overlay2 = g.overlay; d.step(200); out.fight3 = g.bossFight.state; out.locked = g.player.locked; out.mode3 = g.mode;
      return out;
    });
    check('F: a pause during the boss intro freezes the intro timer and the fight starts after resume', bi.fight === 'intro' && bi.overlay === 'pause' && bi.timer1 === bi.timer2 && bi.overlay2 === null && bi.fight3 === 'fight' && !bi.locked && bi.mode3 === 'normal', bi);
    check('F: the boss title card survives a pause during the intro (DEFECT: UI.tick runs the card/toast/banner timers while paused, so a 200 f pause at intro f35 leaves the player locked for the remaining ~115 f with no card)', bi.card1 > 0 && bi.card2 >= bi.card1 - 2, bi);
    await D(d => d.defeatBoss('tallock')); await D(d => d.god(false));
  });

  // =================================================================================================
  // G. map
  // =================================================================================================
  await section('G', async () => {
    await reload(true);
    let s = await startGameClean('tessik');
    const disc = await G(g => ({ d: g.save.discovered.slice(), v: g.save.visited.slice(), ex: g.level.room.exits.map(e => e.to.room) }));
    check('G: discovered = visited + the targets of the current room\'s exits', disc.v.join(',') === 'dc_wake' && disc.ex.every(r => disc.d.indexOf(r) >= 0) && disc.d.length === 1 + new Set(disc.ex).size, disc);
    await page.evaluate(() => { const p = window.__QA.tilePx(16, 12); UB.debug.teleport(p.x, p.y); UB.debug.step(2); });
    await keyTap('KeyM'); s = await state();
    check('G: M opens the map overlay', s.screen === 'map', s.screen);
    const m = await page.evaluate(() => {
      const q = window.__QA, g = UB.game; q.render();
      const cur = q.mapRect('dc_wake'), fall = q.mapRect('dc_fall'), far = q.mapRect('bv_cistern');
      const tf = UB.World.zones.driftcache.palette.tileFill;
      const pl = g.player, r = g.level.room;
      const pxr = cur.x + Math.min(1, Math.max(0, pl.x / (r.w * 30))) * cur.w, pyr = cur.y + Math.min(1, Math.max(0, pl.y / (r.h * 30))) * cur.h;
      return {
        cur, curFill: q.px(cur.x + cur.w * 0.5, cur.y + cur.h * 0.3), tf,
        fallFill: q.px(fall.x + fall.w / 2, fall.y + fall.h / 2), farFill: q.px(far.x + far.w / 2, far.y + far.h / 2), shrineDisc: g.save.discovered.indexOf('dc_shrine') >= 0,
        node: q.px(cur.x + 11, cur.y + 11), you: q.px(pxr, pyr), roomLine: UB.UI.mapRoomLine, bestiary: UB.UI.mapBestiary, cursor: UB.UI.mapCur,
      };
    });
    check('G: the current (visited) room is filled with the zone tileFill', await Q((q, a) => q.near(a.c, a.tf, 10), { c: m.curFill, tf: m.tf }), m);
    check('G: the discovered-but-unvisited neighbour dc_fall is filled UNVISITED #1A1620 (dashed outline)', await Q((q, c) => q.near(c, '#1A1620', 5), m.fallFill), m.fallFill);
    check('G: dc_cross is not an exit target of dc_wake, so it stays undiscovered (fog) until dc_fall is visited', (await G(g => g.save.discovered.indexOf('dc_cross'))) < 0 && (await G(g => UB.World.rooms.dc_wake.exits.every(e => e.to.room !== 'dc_cross'))));
    check('G: fog: an unknown room (bv_cistern) is not drawn at all (no zone fill there)', !(await Q((q, c) => q.near(c, UB.World.zones.brinevault.palette.tileFill, 10) || q.near(c, '#1A1620', 6), m.farFill)), m.farFill);
    check('G: dc_shrine is still unknown from dc_wake (not discovered)', m.shrineDisc === false);
    check('G: the restore node is a CORE_HEART diamond at the room\'s top-left', m.node[0] > 200 && m.node[1] > 150 && m.node[2] < 110, m.node);
    check('G: the player dot is ENERGY at the player\'s position inside the room', m.you[2] > 200 && m.you[0] < 120, m.you);
    check('G: map footer names the current room with its bestiary line (Wake Cell · Scuttlebit), cursor on the current room', m.roomLine === 'Wake Cell' && m.bestiary === 'Scuttlebit' && m.cursor === null, m);
    await shot('map-start');
    // r2: the room cursor hops to the nearest discovered room; unvisited rooms read '?'; Confirm recentres
    const cur = await ev((UB, d, g, q) => { const UI = UB.UI, o = {}; q.tap('ArrowRight'); o.right = [UI.mapCur && UI.mapCur.id, UI.mapRoomLine, UI.mapBestiary, UI.mapPan.x, UI.mapPan.y]; q.tap('ArrowLeft'); o.left = [UI.mapCur && UI.mapCur.id, UI.mapRoomLine, UI.mapPan.x]; q.tap('ArrowRight'); q.tap('Enter'); o.confirm = [UI.mapCur && UI.mapCur.id, UI.mapPan.x, UI.mapPan.y]; return o; });
    check('G: Right moves the cursor to the discovered neighbour dc_fall ("?" while unvisited, no bestiary) and the view pans to it', cur.right[0] === 'dc_fall' && cur.right[1] === '?' && cur.right[2] === '' && (cur.right[3] !== 0 || cur.right[4] !== 0), cur);
    check('G: Left brings the cursor back to the current room (pan 0)', cur.left[0] === null && cur.left[1] === 'Wake Cell' && cur.left[2] === 0, cur);
    check('G: Confirm recentres (cursor on the current room, pan 0)', cur.confirm[0] === null && cur.confirm[1] === 0 && cur.confirm[2] === 0, cur);
    await page.keyboard.down('ArrowRight'); await step(10); await page.keyboard.up('ArrowRight'); await step(1);
    const panned = await ui(u => [u.mapPan.x, u.mapPan.y, u.mapCur && u.mapCur.id]);
    await keyTap('KeyR');
    check('G: R recentres the map after a cursor hop', (panned[0] !== 0 || panned[1] !== 0) && (await ui(u => u.mapPan.x === 0 && u.mapPan.y === 0 && u.mapCur === null)), { panned, now: await ui(u => [u.mapPan.x, u.mapPan.y]) });
    await keyTap('Tab'); s = await state();
    check('G: Tab closes the map', s.screen === 'play', s.screen);
    await keyTap('Tab'); s = await state();
    check('G: Tab opens the map', s.screen === 'map', s.screen);
    await keyTap('Escape'); s = await state();
    check('G: Esc closes the map', s.screen === 'play', s.screen);
    await D(d => d.warp('dc_sentinel', null)); await step(3);
    await keyTap('KeyM');
    const sk1 = await page.evaluate(() => { const q = window.__QA; q.render(); const r = q.mapRect('dc_sentinel'); return { px: q.px(r.x + r.w - 11, r.y + 13), line: UB.UI.mapRoomLine, best: UB.UI.mapBestiary }; });
    check('G: a visited boss room shows the DANGER skull', sk1.px[0] > 200 && sk1.px[1] < 110, sk1);
    check('G: the boss-room footer is NAME · EPITHET (§15.11)', sk1.line === 'Sentinel Stack' && sk1.best === 'TALLOCK · WARDEN OF THE STACK', sk1);
    check('G: map header shows the zone of the current room', (await G(g => g.zone.name)) === 'DRIFTCACHE');
    await shot('map-bossroom');
    await keyTap('KeyM');
    await D(d => d.defeatBoss('tallock')); await step(2);
    await keyTap('KeyM');
    const sk2 = await page.evaluate(() => { const q = window.__QA; q.render(); const r = q.mapRect('dc_sentinel'); return { px: q.px(r.x + r.w - 11, r.y + 13), best: UB.UI.mapBestiary }; });
    check('G: a defeated boss room shows the skull in PAPER_DIM and the footer adds · purged', sk2.px[0] > 140 && sk2.px[0] < 190 && Math.abs(sk2.px[0] - sk2.px[1]) < 30 && sk2.best === 'TALLOCK · WARDEN OF THE STACK · purged', sk2);
    await keyTap('KeyM');
    await D(d => d.warp('dc_shrine', null)); await step(3);
    const safe = await ev((UB, d, g, q) => { q.tap('KeyM'); const a = [UB.UI.mapRoomLine, UB.UI.mapBestiary]; q.tap('KeyM'); return a; });
    check('G: a visited room without spawns reads "no enemies"', safe[0] === 'Rackside Shrine' && safe[1] === 'no enemies', safe);
    // r2: every room's bestiary line uses §15.11 names only, and the footer never collides with the legend / close hints
    const best = await ev((UB, d, g, q) => {
      const out = []; const f = UB.font(11, 'MONO');
      const legendW = q.measure('◆ node  ● boss  ⬢ vendor  · you', f), rightW = q.measure('R recentre', f) + 18 + q.measure('Esc / M close', f);
      const disc0 = g.save.discovered.slice(), vis0 = g.save.visited.slice(), lore0 = g.save.loreSeen.slice();   // the sweep below must not pollute the map state
      window.__mapSnap = { disc0, vis0, lore0 };
      for (const id in UB.World.rooms) {
        const r = UB.World.rooms[id]; if (r.debug) continue;
        g.save.loreSeen.push(r.zone); d.warp(id, null); d.step(2); g.openOverlay('map'); d.step(1);
        const line = UB.UI.mapBestiary; const w = q.measure(line, f);
        // differential render: do the legend band / right band change when the bestiary line is drawn?
        const real = UB.UI.mapBestiary; q.render(); const a1 = q.band(56, 486, 220, 30), b1 = q.band(720, 486, 190, 30);
        UB.UI.mapBestiary = ''; q.render(); const a0 = q.band(56, 486, 220, 30), b0 = q.band(720, 486, 190, 30); UB.UI.mapBestiary = real;
        let diffL = 0, diffR = 0; for (let i = 0; i < a1.length; i += 4) if (Math.abs(a1[i] - a0[i]) + Math.abs(a1[i + 1] - a0[i + 1]) + Math.abs(a1[i + 2] - a0[i + 2]) > 24) diffL++;
        for (let i = 0; i < b1.length; i += 4) if (Math.abs(b1[i] - b0[i]) + Math.abs(b1[i + 1] - b0[i + 1]) + Math.abs(b1[i + 2] - b0[i + 2]) > 24) diffR++;
        out.push({ id, line, w: Math.round(w), diffL, diffR });
        g.closeOverlay(); d.step(1);
      }
      return { rooms: out, legendW: Math.round(legendW), rightW: Math.round(rightW) };
    });
    const names = new Set(); best.rooms.forEach(r => r.line.split(' · ').forEach(n => { if (n && n !== 'no enemies' && n !== 'purged' && !/^[A-Z ]+$/.test(n)) names.add(n); }));
    const unknownNames = Array.from(names).filter(n => BESTIARY_NAMES.indexOf(n) < 0);
    check('G: every bestiary name across the 23 rooms is a §15.11 name', unknownNames.length === 0, unknownNames);
    const collide = best.rooms.filter(r => r.diffL > 0 || r.diffR > 0);
    check('G: the footer bestiary line never overdraws the legend or the "R recentre · Esc / M close" hints (DEFECT: a 7-type line is 523 px wide at 11 px, centred at 480 it runs 218–742 over the legend ending at 268 and the hints starting at 730 — rw_gate, bv_cistern)', collide.length === 0, { collide, legendW: best.legendW, rightW: best.rightW });
    await ev((UB, d, g, q) => { d.warp('rw_gate', null); d.step(2); g.openOverlay('map'); d.step(1); });
    await shot('map-footer-rwgate');
    await ev((UB, d, g, q) => { g.closeOverlay(); d.step(1); const sn = window.__mapSnap; g.save.discovered.length = 0; sn.disc0.forEach(r => g.save.discovered.push(r)); g.save.visited.length = 0; sn.vis0.forEach(r => g.save.visited.push(r)); g.save.loreSeen.length = 0; sn.lore0.forEach(z => g.save.loreSeen.push(z)); d.warp('dc_sentinel', null); d.step(2); UB.UI.clearMessages(); });
    await clearOverlay();
    const beforePing = await G(g => g.save.discovered.filter(id => id.indexOf('dc_') === 0).length);
    await D(d => d.setBits(500)); const bought = await D(d => d.buy('deep_ping')); await step(2);
    const dcAll = await G(g => { let n = 0; for (const id in UB.World.rooms) if (UB.World.rooms[id].zone === 'driftcache') n++; return { all: n, disc: g.save.discovered.filter(id => UB.World.rooms[id].zone === 'driftcache').length }; });
    check('G: Deep Ping reveals every room of every entered zone (all ' + dcAll.all + ' driftcache rooms)', bought === 'bought' && dcAll.disc === dcAll.all && beforePing < dcAll.all, { beforePing, dcAll });
    await keyTap('KeyM');
    const ping = await page.evaluate(() => { const q = window.__QA; q.render(); const loft = q.mapRect('dc_loft'), shrine = q.mapRect('dc_shrine'); return { loft: q.px(loft.x + loft.w / 2, loft.y + loft.h / 2), shrineNode: q.px(shrine.x + 11, shrine.y + 11), shrineVendor: q.px(shrine.x + shrine.w / 2, shrine.y + shrine.h - 10), ping: UB.game.hasDeepPing(), loftQ: q.scan(loft.x + loft.w - 16, loft.y + loft.h - 17, 12, 14, (r, g, b) => r > 200 && g > 150 && b < 110) }; });
    check('G: with Deep Ping unvisited dc_loft is drawn (dashed UNVISITED) with a "?" for its uncollected core; dc_shrine shows its node diamond + vendor hexagon', ping.ping && ping.loft[0] < 40 && ping.loftQ > 4 && ping.shrineNode[0] > 200 && ping.shrineNode[1] > 150 && ping.shrineVendor[1] > 180 && ping.shrineVendor[0] < 190, ping);
    await shot('map-deepping');
    await keyTap('Escape');
    // r3: §12.12 — dotted links between the four non-adjacent exit pairs once both rooms are discovered, 6×6 INK exit stubs on
    // visited rooms, a found core's CORE_HEART dot, the MAP header + zone name; the fully discovered world is screenshotted
    await clearOverlay();
    const full = await ev((UB, d, g, q) => {
      const sv = g.save;
      for (const id in UB.World.rooms) { const r = UB.World.rooms[id]; if (r.debug) continue; if (sv.discovered.indexOf(id) < 0) sv.discovered.push(id); if (sv.visited.indexOf(id) < 0) sv.visited.push(id); }
      if (sv.cores.indexOf('core_dc_loft') < 0) sv.cores.push('core_dc_loft');
      d.warp('dc_cross', null); d.step(2); g.openOverlay('map'); d.step(1); q.render();
      const stubX = (e, r, x, w) => e.side === 'left' ? x : (e.side === 'right' ? x + w : x + (e.x + e.w / 2) / r.w * w);
      const stubY = (e, r, y, h) => e.side === 'top' ? y : (e.side === 'bottom' ? y + h : y + (e.y + e.h / 2) / r.h * h);
      const rects = () => { const o = {}; for (const id in UB.World.rooms) if (!UB.World.rooms[id].debug) o[id] = q.mapRect(id); return o; };
      const inside = (R, x, y) => { for (const id in R) { const r = R[id]; if (x >= r.x - 1 && x <= r.x + r.w + 1 && y >= r.y - 1 && y <= r.y + r.h + 1) return true; } return false; };
      const o = { links: [] };
      for (const [ra, ea, rb, eb] of [['dc_cross', 'L2', 'lw_shaft', 'R2'], ['lw_belts', 'L', 'lw_shaft', 'R'], ['lw_rest', 'B', 'bv_catwalk', 'T'], ['ns_climb', 'R', 'ns_plunge', 'L2']]) {
        const A = UB.World.rooms[ra], B = UB.World.rooms[rb], exA = UB.World.exit(A, ea), exB = UB.World.exit(B, eb);
        if (!exA || !exB || exA.to.room !== rb || exB.to.room !== ra) { o.links.push({ ra, ea, rb, eb, missing: true }); continue; }
        // centre the view on the link's midpoint (pan is free in a render), then sample 5×5 windows along it outside every room rect
        UB.UI.mapPan.x = 0; UB.UI.mapPan.y = 0;
        let R = rects(), RA = R[ra], RB = R[rb];
        let ax = stubX(exA, A, RA.x, RA.w), ay = stubY(exA, A, RA.y, RA.h), bx = stubX(exB, B, RB.x, RB.w), by = stubY(exB, B, RB.y, RB.h);
        UB.UI.mapPan.x = 480 - (ax + bx) / 2; UB.UI.mapPan.y = 280 - (ay + by) / 2; q.render();
        R = rects(); RA = R[ra]; RB = R[rb];
        ax = stubX(exA, A, RA.x, RA.w); ay = stubY(exA, A, RA.y, RA.h); bx = stubX(exB, B, RB.x, RB.w); by = stubY(exB, B, RB.y, RB.h);
        const len = Math.hypot(bx - ax, by - ay);
        let hits = 0, n = 0;
        for (let i = 1; i < 40; i++) { const x = ax + (bx - ax) * i / 40, y = ay + (by - ay) * i / 40; if (x < 28 || x > 932 || y < 74 || y > 486 || inside(R, x, y)) continue; n++; if (q.scan(x - 2, y - 2, 5, 5, (r, gg, b) => r > 70 && gg > 65) > 0) hits++; }
        o.links.push({ ra, ea, rb, eb, len: Math.round(len), n, hits });
      }
      UB.UI.mapPan.x = 0; UB.UI.mapPan.y = 0; q.render();
      const cross = UB.World.rooms.dc_cross, rc = q.mapRect('dc_cross');
      const er = cross.exits.filter(e => e.side === 'right')[0] || cross.exits[0];
      o.stub = q.px(stubX(er, cross, rc.x, rc.w), stubY(er, cross, rc.y, rc.h));
      const loft = q.mapRect('dc_loft'); o.coreDot = q.px(loft.x + loft.w - 10, loft.y + loft.h - 10);
      o.zoneHeader = q.scan(790, 48, 110, 16, (r, gg, b) => r > 150 && gg > 140 && b > 120);
      o.mapTitle = q.scan(58, 46, 94, 20, (r, gg, b) => r > 215 && gg > 205 && b > 180);
      return o;
    });
    const linkOk = full.links.every(l => !l.missing && (l.len <= 10 || (l.n >= 4 && l.hits >= Math.ceil(l.n * 0.5))));
    check('G: the four non-adjacent exit pairs (dc_cross.L2↔lw_shaft.R2, lw_belts.L↔lw_shaft.R, lw_rest.B↔bv_catwalk.T, ns_climb.R↔ns_plunge.L2) draw a dotted link between their stubs once both rooms are discovered', linkOk, full.links);
    check('G: a visited room draws INK exit stubs on its exit edges', full.stub[0] < 40 && full.stub[1] < 40 && full.stub[2] < 50, full.stub);
    check('G: a found core is a small CORE_HEART dot in its room (dc_loft)', full.coreDot[0] > 200 && full.coreDot[1] > 150 && full.coreDot[2] < 110, full.coreDot);
    check('G: the header shows MAP in PAPER at (60,56) and the zone name right-aligned at (900,56)', full.mapTitle > 30 && full.zoneHeader > 30, { title: full.mapTitle, zone: full.zoneHeader });
    await shot('map-fullworld');
    await ev((UB, d, g, q) => { for (let i = 0; i < 6; i++) q.tap('ArrowRight'); });
    await shot('map-fullworld-right');
    await ev((UB, d, g, q) => { g.closeOverlay(); d.step(1); d.warp('dc_sentinel', null); d.step(2); UB.UI.clearMessages(); });
  });

  // =================================================================================================
  // H. settings
  // =================================================================================================
  await section('H', async () => {
    await clearOverlay();
    await keyTap('Escape'); await keyTap('ArrowDown'); await keyTap('ArrowDown'); await keyTap('Enter');
    let s = await state();
    check('H: pause → SETTINGS opens the settings overlay (no RESET SAVE from play)', s.screen === 'settings' && (await ui(u => u.fromTitle)) === false, s.screen);
    const rowsPlay = await page.evaluate(() => { const q = window.__QA; const o = []; for (let i = 0; i < 6; i++) { o.push(UB.UI.sel); q.tap('ArrowDown'); } return o; });
    check('H: from play the settings list has 6 rows (RESET SAVE hidden) and wraps', rowsPlay.join(',') === '0,1,2,3,4,5' && (await ui(u => u.sel)) === 0, rowsPlay);
    await keyTap('ArrowLeft');
    check('H: Left lowers MASTER VOLUME 8 → 7', (await G(g => g.settings.master)) === 7);
    await keyTap('ArrowDown'); await keyTap('ArrowRight');
    check('H: Right raises MUSIC VOLUME 7 → 8', (await G(g => g.settings.music)) === 8);
    await page.evaluate(() => { const q = window.__QA; for (let i = 0; i < 12; i++) q.tap('ArrowRight'); });
    check('H: sliders clamp at 10', (await G(g => g.settings.music)) === 10);
    const knob = await Q(q => q.rpx(700, 194));
    check('H: the slider knob at 10 sits on the bar\'s right end (x 700) in SELECT', knob[0] > 220 && knob[1] > 180 && knob[2] < 140, knob);
    // r3: the slider value text ("10" at full volume) must stay inside the 500 px panel: its right edge is x 730 and the
    // PANEL_EDGE stroke (3 px, PAPER) covers 728.5–731.5, so a glyph reaching past 728 is drawn over the bright edge and unreadable
    const ten = await ev((UB, d, g, q) => {
      const src = (window.__uiSrc || '');
      const f = UB.font(12, 'MONO'), w = q.measure('10', f);
      // differential render: the pixels that belong to the "0" of "10" (music row, y 194) vs a "1" alone; how many of them sit on the edge band?
      const y = 150 + 44; g.setSetting('music', 10); q.render(); const a = q.band(708, y - 7, 26, 14); g.setSetting('music', 1); q.render(); const b = q.band(708, y - 7, 26, 14); g.setSetting('music', 10);
      let zero = 0, onEdge = 0; for (let i = 0; i < a.length; i += 4) { if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 40) { zero++; const x = 708 + ((i / 4) % 26); if (x >= 728) onEdge++; } }
      return { w10: Math.round(w * 10) / 10, zeroPx: zero, zeroPxOnEdge: onEdge, src: src };
    });
    check('H: the slider value "10" is drawn inside the panel (no glyph pixels on or past the right-edge stroke at x ≥ 728) (DEFECT: the value is left-aligned at x 716 in 12 px MONO, so "10" ends at x 730.4 and its "0" is painted over the PAPER edge)', ten.zeroPx > 0 && ten.zeroPxOnEdge === 0, ten);
    await shot('settings-slider-10');
    await keyTap('ArrowDown'); await keyTap('ArrowDown'); await keyTap('Enter');
    check('H: Enter toggles SCREEN SHAKE OFF', (await G(g => g.settings.screenShake)) === false);
    check('H: FX honours the shake setting (requests ignored while OFF)', (await page.evaluate(() => { UB.FX.shake(10, 10); return UB.FX._shakeLeft; })) === 0);
    await keyTap('ArrowDown'); await keyTap('ArrowRight');
    check('H: Right flips SHOW HITBOXES ON', (await G(g => g.settings.showHitboxes)) === true);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('underbyte.settings') || 'null'));
    check('H: every change is written to underbyte.settings immediately (master 7, music 10, shake off, hitboxes on, version 1)', stored && stored.master === 7 && stored.music === 10 && stored.screenShake === false && stored.showHitboxes === true && stored.version === 1, stored);
    await step(5); await shot('settings-play');
    await keyTap('Escape'); s = await state();
    check('H: Esc returns to the pause menu with the cursor on SETTINGS', s.screen === 'pause' && (await ui(u => u.sel)) === 2, { screen: s.screen, sel: await ui(u => u.sel) });
    await keyTap('Escape');
    await step(16);
    check('H: SHOW HITBOXES draws the fps / room debug line', /fps \d+\s+dc_sentinel/.test(await ui(u => u.dbgStr)), await ui(u => u.dbgStr));
    await shot('hitboxes');
    await reload(false);
    const after = await G(g => ({ master: g.settings.master, music: g.settings.music, shake: g.settings.screenShake, hb: g.settings.showHitboxes }));
    check('H: settings persist across a reload', after.master === 7 && after.music === 10 && after.shake === false && after.hb === true, after);
    await page.evaluate(() => localStorage.setItem('underbyte.settings', JSON.stringify({ version: 1, sfx: 3 })));
    await reload(false);
    const defs = await G(g => Object.assign({}, g.settings));
    check('H: missing settings keys take the §14.2 defaults (master 8, music 7, shake on, hitboxes off, touchControls auto) and sfx 3 is kept', defs.master === 8 && defs.music === 7 && defs.sfx === 3 && defs.screenShake === true && defs.showHitboxes === false && defs.touchControls === 'auto', defs);
    await page.evaluate(() => localStorage.setItem('underbyte.settings', JSON.stringify({ version: 1, master: 50, music: '7', sfx: -3, screenShake: 'yes', showHitboxes: 1, touchControls: 'bogus' })));
    await reload(false);
    const cor = await G(g => Object.assign({}, g.settings));
    check('H: corrupt settings values are sanitised to type + 0–10 range (50 / "7" / -3 / "yes" / 1 / "bogus" → defaults)', cor.master === 8 && cor.music === 7 && cor.sfx === 8 && cor.screenShake === true && cor.showHitboxes === false && cor.touchControls === 'auto', cor);
    await keyTap('ArrowDown'); await keyTap('Enter'); await step(3);
    check('H: the settings panel still opens on corrupt values without a page error', (await state()).screen === 'settings' && t.errors.length === 0, t.errors);
    await keyTap('Escape');
    // r2: a non-object settings file (array / string) → defaults, no error
    for (const raw of ['[1,2,3]', '"eight"', '{not json']) {
      await page.evaluate((raw) => localStorage.setItem('underbyte.settings', raw), raw);
      await reload(false);
      const sg = await G(g => Object.assign({}, g.settings));
      check('H: a settings file of ' + raw + ' falls back to the defaults', sg.master === 8 && sg.music === 7 && sg.sfx === 8 && sg.screenShake === true && sg.showHitboxes === false && t.errors.length === 0, sg);
    }
    await page.evaluate(() => { localStorage.removeItem('underbyte.settings'); });
  });

  // =================================================================================================
  // I. shop (vendor panel)
  // =================================================================================================
  await section('I', async () => {
    await reload(true);
    let s = await startGameClean('tessik');
    await D(d => d.warp('dc_shrine', null)); await step(3);
    await page.evaluate(() => { const p = window.__QA.tilePx(21, 14); UB.debug.teleport(p.x, p.y); UB.debug.step(5); });
    s = await state();
    check('I: standing at Scrivvet shows the TRADE prompt', s.prompt === 'TRADE' && s.nearVendor === true, { prompt: s.prompt, near: s.nearVendor });
    await keyTap('ArrowUp'); s = await state();
    check('I: Up at the vendor opens the shop overlay (no jump)', s.screen === 'shop' && s.vy === 0, { screen: s.screen, vy: s.vy });
    const line = await ui(u => u.shopLine);
    check('I: greeting is one of the §15.9 lines', TXT.vendorLines.indexOf(line) >= 0, line);
    check('I: cursor starts on the first unsold row (SPARE CELL)', (await ui(u => u.sel)) === 0);
    const shopFit = await page.evaluate(() => { const q = window.__QA; return { eff: UB.IDS.vendorItems.map(i => Math.round(q.measure(i.effect, UB.font(12, 'MONO')))), greet: Math.max.apply(null, UB.UI.shopLine ? [q.wrap(UB.UI.shopLine, UB.font(13, 'MONO'), 460).length] : [0]) }; });
    check('I: every effect line fits the panel (≤ 460 px from x 260) and the greeting wraps to ≤ 2 lines', shopFit.eff.every(w => w <= 460) && shopFit.greet <= 2, shopFit);
    await D(d => d.setBits(100)); await step(2);
    // r2: unaffordable prices are drawn in DANGER, affordable ones in BITS
    const priceCol = await Q(q => ({ cell: q.scan(640, 212, 64, 18, (r, g, b) => g > 200 && r < 170 && b < 170), clock: q.scan(640, 268, 64, 18, (r, g, b) => r > 220 && g < 90 && b < 90), ping: q.scan(640, 324, 64, 18, (r, g, b) => r > 220 && g < 90 && b < 90) }));
    check('I: with 100 bits SPARE CELL (90) is priced in BITS green and HOT CLOCK / DEEP PING in DANGER red', priceCol.cell > 8 && priceCol.clock > 8 && priceCol.ping > 8, priceCol);
    await shot('shop-open');
    await keyTap('Enter'); s = await state();
    check('I: Enter buys SPARE CELL for 90: bits 100 → 10, vendor records it, energyMax 125', s.bits === 10 && s.vendor.indexOf('spare_cell') >= 0 && s.energyMax === 125, { bits: s.bits, vendor: s.vendor, energyMax: s.energyMax });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('underbyte.save') || 'null'));
    check('I: a purchase writes the save (vendor + bits persisted)', saved && saved.vendor.indexOf('spare_cell') >= 0 && saved.bits === 10, saved && { vendor: saved.vendor, bits: saved.bits });
    await keyTap('ArrowDown'); await keyTap('Enter');
    const poor = await ui(u => ({ msg: u.shopMsg, t: u.shopMsgT, deny: UB.game.denyFlash }));
    s = await state();
    check('I: HOT CLOCK with 10 bits is refused: "Come back heavier." for 90 f + deny flash, bits unchanged', poor.msg === 'Come back heavier.' && poor.t >= 88 && poor.deny > 0 && s.bits === 10 && s.vendor.length === 1, poor);
    await shot('shop-poor');
    await keyTap('ArrowUp'); await keyTap('Enter');
    s = await state();
    check('I: confirming a SOLD row buys nothing', s.bits === 10 && s.vendor.length === 1, { bits: s.bits, vendor: s.vendor });
    const soldMsg = await ui(u => u.shopMsgT > 0 ? u.shopMsg : '');
    check('I: confirming a SOLD row while other items remain does not show the all-sold-out line', soldMsg !== TXT.vendorSoldOut, soldMsg);
    check('I: debug buy mirrors the panel: sold / poor / unknown', (await D(d => [d.buy('spare_cell'), d.buy('deep_ping'), d.buy('nope')].join(','))) === 'sold,poor,unknown');
    await keyTap('Escape'); s = await state();
    const afterClose = await G(g => ({ screen: g.screen, overlay: g.overlay, state: g.player.state, vy: Math.round(g.player.vy) }));
    check('I: Esc closes the shop without a jump from the Up/Down navigation', afterClose.screen === 'play' && !afterClose.overlay && afterClose.state === 'idle' && afterClose.vy === 0, afterClose);
    const ban = await ui(u => [u.banner1, u.banner2, u.bannerT]);
    check('I: the PURCHASED banner shows after the panel closes with the item effect', ban[0] === 'SPARE CELL PURCHASED' && ban[1] === 'Max energy 100 → 125' && ban[2] > 0, ban);
    await D(d => d.setBits(300));
    await keyTap('ArrowUp'); await step(1);
    check('I: the shop reopens on the first unsold row (HOT CLOCK)', (await state()).screen === 'shop' && (await ui(u => u.sel)) === 1, await ui(u => u.sel));
    await keyTap('Enter'); await keyTap('Enter');
    await keyTap('ArrowDown'); await keyTap('Enter');
    s = await state();
    check('I: HOT CLOCK (160) + DEEP PING (120) bought: 300 → 20 bits, all three owned', s.bits === 20 && s.vendor.length === 3, { bits: s.bits, vendor: s.vendor });
    check('I: with everything bought the greeting becomes the sold-out line', (await ui(u => u.shopLine)) === TXT.vendorSoldOut, await ui(u => u.shopLine));
    await shot('shop-soldout');
    await step(8); await keyTap('Escape');
    await G(g => { g.save.vendor.length = 0; g.applyVendorEffects(); return true; });
    await D(d => d.warp('rw_rest', null)); await step(3); await clearOverlay();
    await D(d => d.skipTo('shop')); await step(1);
    check('I: the first shop opening in rw_rest greets with the §15.9 Rootwell line', (await ui(u => u.shopLine)) === TXT.vendorFirstRw, await ui(u => u.shopLine));
    await keyTap('Escape'); await step(8); await D(d => d.skipTo('shop')); await step(1);
    check('I: the second rw_rest opening uses a normal greeting', TXT.vendorLines.indexOf(await ui(u => u.shopLine)) >= 0, await ui(u => u.shopLine));
    await keyTap('Escape'); await step(8);
  });

  // =================================================================================================
  // J. lore card
  // =================================================================================================
  await section('J', async () => {
    await reload(true);
    let s = await startGame('tessik');
    s = await stepUntil(x => x.screen === 'lore', 400, 1);
    check('J: the first entry to Driftcache opens the lore card (overlay lore)', s.screen === 'lore' && s.loreSeen.indexOf('driftcache') >= 0, { screen: s.screen, loreSeen: s.loreSeen });
    const lore = await G(g => ({ zone: g.loreCard && g.loreCard.id, text: g.loreCard && g.loreCard.lore, lines: window.__QA.wrap(g.loreCard.lore, UB.font(15, 'MONO'), 640) }));
    check('J: the card shows the §5.3 Driftcache paragraph, wrapped to ≤ 640 px lines above the prompt', lore.zone === 'driftcache' && inDesign(lore.text) && lore.lines.length <= 10, lore);
    const pt0 = (await state()).playTimeFrames;
    await step(30);
    check('J: play time is frozen while the lore card is open', (await state()).playTimeFrames === pt0);
    await shot('lore');
    // r2: 'Press any key' appears after 60 f (12px MONO PAPER_DIM at (480,470))
    const pak = await ev((UB, d, g, q) => { d.step(40); const t = UB.UI.loreT; const dim = (r, gg, b) => r > 140 && r < 200 && gg > 130 && gg < 185 && b > 110 && b < 170; return { loreT: t, px: q.scan(400, 462, 160, 16, dim) }; });
    check('J: "Press any key" is drawn under the paragraph after 60 f', pak.loreT > 60 && pak.px > 20, pak);
    // r2: Esc (back + pause) closes the card and must not open the pause menu on the next frame
    const esc = await ev((UB, d, g, q) => { q.key('Escape', true); d.step(1); const a = g.overlay; q.key('Escape', false); d.step(3); return [a, g.overlay, g.screen]; });
    check('J: Esc closes the lore card without opening the pause menu', esc[0] === null && esc[1] === null && esc[2] === 'play', esc);
    await D(d => d.warp('dc_fall', null)); await step(3);
    s = await stepUntil(x => x.screen === 'lore', 200);
    check('J: the card never shows twice for the same zone', s.screen !== 'lore', s.screen);
    await D(d => d.warp('lw_hoist', null)); await step(3);
    s = await stepUntil(x => x.screen === 'lore', 300, 1);
    check('J: entering Loomworks opens its own card once', s.screen === 'lore' && s.loreSeen.indexOf('loomworks') >= 0, { screen: s.screen, loreSeen: s.loreSeen });
    await step(241); s = await state();
    check('J: the card closes itself after 240 f', s.screen === 'play', s.screen);
    const loreFit = await page.evaluate(() => { const q = window.__QA, out = []; for (const id in UB.World.zones) { const z = UB.World.zones[id]; if (z.debug) continue; const l = q.wrap(z.lore, UB.font(15, 'MONO'), 640); out.push([id, l.length, Math.round(Math.max.apply(null, l.map(x => q.measure(x, UB.font(15, 'MONO')))))]); } return out; });
    check('J: every zone lore wraps to ≤ 8 lines of ≤ 640 px', loreFit.every(x => x[1] <= 8 && x[2] <= 640), loreFit);
    // r2: a second zone entry shows the 150 f zone toast (no card) at the centre
    const toast = await ev((UB, d, g, q) => { g.save.loreSeen.push('brinevault'); d.warp('bv_sluice', null); d.step(1); const a = [UB.UI.toastT, UB.UI.toast1, UB.UI.toast2, UB.UI.toastBottom]; d.step(100); return { a, later: [UB.UI.toastT, g.overlay] }; });
    check('J: a zone change with the lore already seen shows the 150 f centred zone toast (name + blurb) and no card', toast.a[0] === 149 && toast.a[1] === 'BRINEVAULT' && toast.a[2] === 'The coolant stayed. The heart did not.' && toast.a[3] === false && toast.later[0] === 49 && toast.later[1] === null, toast);
    await ev((UB, d) => { d.warp('bv_sluice', null); d.step(30); });
    await shot('zone-toast');
  });

  // =================================================================================================
  // K. gamepad
  // =================================================================================================
  await section('K', async () => {
    await reload(true);
    await Q(q => q.padOn());
    let r = await Q(q => q.padTap(0));
    let s = await state();
    check('K: A on the title confirms NEW GAME → select', s.screen === 'select' && r.confirm && r.jump, { screen: s.screen, r });
    check('K: the pad becomes the active device (glyph A for jump)', (await page.evaluate(() => [UB.Input.device, UB.Input.glyph('jump'), UB.Input.glyph('light'), UB.Input.glyph('overclock'), UB.Input.glyph('dash')].join(','))) === 'gamepad,A,X,LT,RB');
    await Q(q => q.padTap(15));
    check('K: d-pad Right hovers the next fighter', (await ui(u => u.sel)) === 1);
    await Q(q => q.padTap(1)); s = await state();
    check('K: B on the select screen backs out to the title', s.screen === 'title', s.screen);
    await Q(q => q.padTap(0)); await Q(q => q.padTap(0));
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 300);
    check('K: A twice boots a game from the pad', s.screen === 'play', s.screen);
    s = await stepUntil(x => x.screen === 'lore', 400, 1); if (s.screen === 'lore') { await step(12); await Q(q => q.padTap(0)); await step(3); }
    await D(d => d.warp('debug_room', null)); await step(3); await D(d => d.god(true)); await D(d => d.grant('burstLine', true));
    const map = {};
    for (const [b, name] of [[0, 'A'], [1, 'B'], [2, 'X'], [3, 'Y'], [4, 'LB'], [5, 'RB'], [6, 'LT'], [7, 'RT'], [8, 'Back'], [9, 'Start'], [12, 'dUp'], [13, 'dDown'], [14, 'dLeft'], [15, 'dRight']]) {
      map[name] = Object.keys(await Q((q, b) => q.padTap(b), b)).sort().join('+');
      await clearOverlay();
    }
    const want = { A: 'confirm+jump', B: 'back+special', X: 'light', Y: 'heavy', LB: 'dash', RB: 'dash', LT: 'overclock', RT: 'overclock', Back: 'map', Start: 'pause', dUp: 'up', dDown: 'down', dLeft: 'left', dRight: 'right' };
    const wrong = Object.keys(want).filter(k => map[k] !== want[k]).map(k => k + ': ' + map[k] + ' (want ' + want[k] + ')');
    check('K: every §2.3 button maps to exactly its actions', wrong.length === 0, wrong);
    const jump = await page.evaluate(() => { const q = window.__QA; UB.debug.step(10); q.padHold(0, true); UB.debug.step(2); const vy = UB.game.player.vy; q.padHold(0, false); UB.debug.step(1); return vy; });
    check('K: A jumps (vy < 0)', jump < -300, jump);
    await step(60);
    const light = await page.evaluate(() => { const q = window.__QA; q.padTap(2); return UB.game.player.state; });
    check('K: X starts a light attack', light === 'attack', light);
    await step(40);
    const heavy = await page.evaluate(() => { const q = window.__QA; q.padTap(3); UB.debug.step(3); return UB.game.player.state; });
    check('K: Y starts a heavy attack', heavy === 'attack', heavy);
    await step(60);
    const sp = await page.evaluate(() => { const q = window.__QA; UB.game.player.energy = 100; q.padTap(1); UB.debug.step(2); return UB.game.player.energy; });
    check('K: B spends energy on the special (100 → 70 for Tessik)', sp >= 70 && sp < 71, sp);
    await step(60);
    const dash = await page.evaluate(() => { const q = window.__QA; q.padHold(5, true); UB.debug.step(2); const st = UB.game.player.state; q.padHold(5, false); UB.debug.step(1); return st; });
    check('K: RB dashes with Burst Line', dash === 'dash', dash);
    await step(60);
    const oc = await page.evaluate(() => { const q = window.__QA; UB.game.player.meter = 100; q.pad.buttons[6].value = 0.7; UB.debug.step(2); q.pad.buttons[6].value = 0; UB.debug.step(1); const p = UB.game.player; return !!(p.ocActive || p.ocTransform > 0); });
    check('K: LT as an analog value > 0.5 (not pressed) triggers Overclock', oc === true, oc);
    const axes = await page.evaluate(() => { const q = window.__QA, o = []; q.pad.axes[0] = 0.5; UB.debug.step(1); o.push(UB.Input.state.right.down); q.pad.axes[0] = 0.3; UB.debug.step(1); o.push(UB.Input.state.right.down); q.pad.axes[0] = 0.2; UB.debug.step(1); o.push(UB.Input.state.right.down); q.pad.axes[0] = -0.4; UB.debug.step(1); o.push(UB.Input.state.left.down); q.pad.axes[0] = 0; q.pad.axes[1] = 0.6; UB.debug.step(1); o.push(UB.Input.state.down.down); q.pad.axes[1] = 0; UB.debug.step(1); return o; });
    check('K: left stick: deadzone 0.35 on, hysteresis release at 0.25, both axes', axes.join(',') === 'true,true,false,true,true', axes);
    // r2: both devices at once — a held d-pad direction and a keyboard key both read
    const both = await page.evaluate(() => { const q = window.__QA; q.padHold(15, true); q.key('Space', true); UB.debug.step(1); const st = UB.Input.state; const o = [st.right.down, st.jump.down]; q.key('Space', false); q.padHold(15, false); UB.debug.step(2); return o; });
    check('K: keyboard and gamepad work simultaneously (pad Right + keyboard Space both down)', both[0] === true && both[1] === true, both);
    await step(800);   // let Overclock expire
    await Q(q => q.padTap(9)); s = await state();
    check('K: Start pauses', s.screen === 'pause', s.screen);
    // r2: a held d-pad direction key-repeats through the menu
    const rep = await page.evaluate(() => { const q = window.__QA; q.padHold(13, true); UB.debug.step(1); const a = UB.UI.sel; UB.debug.step(40); const b = UB.UI.sel; q.padHold(13, false); UB.debug.step(1); return [a, b]; });
    check('K: a held d-pad Down key-repeats in the pause menu (1 move on press, 2 more after 18 f + every 8 f)', rep[0] === 1 && rep[1] === 3, rep);
    await Q(q => { while (UB.UI.sel !== 1) q.padTap(13); });
    await Q(q => q.padTap(0)); s = await state();
    check('K: d-pad Down + A opens MAP from the pause menu', s.screen === 'map', s.screen);
    await page.evaluate(() => { const q = window.__QA; q.padHold(15, true); UB.debug.step(8); q.padHold(15, false); UB.debug.step(1); });
    const pan = await ui(u => [u.mapPan.x, u.mapCur && u.mapCur.id]);
    await Q(q => q.padTap(0));
    check('K: d-pad Right moves the map cursor / pans and A recentres it', (pan[0] !== 0 || pan[1] !== null || (await ui(u => u.mapMin.x)) === 0) && (await ui(u => u.mapPan.x === 0 && u.mapCur === null)), { pan, now: await ui(u => u.mapPan.x) });
    await Q(q => q.padTap(1)); s = await state();
    check('K: B backs out of the map to the pause menu', s.screen === 'pause', s.screen);
    await Q(q => q.padTap(9)); s = await state();
    check('K: Start resumes', s.screen === 'play', s.screen);
    await Q(q => q.padTap(8)); s = await state();
    check('K: Back opens the map from play', s.screen === 'map', s.screen);
    await Q(q => q.padTap(8)); s = await state();
    check('K: Back closes the map again', s.screen === 'play', s.screen);
    await page.evaluate(() => UB.game.render(1));
    const hintPad = await page.evaluate(() => { UB.game.save.visited.length = 1; for (const k in UB.game.save.hints) UB.game.save.hints[k] = false; UB.UI.hintKey = -1; UB.game.render(1); return UB.UI.hintStr; });
    check('K: the hint strip switches to pad glyphs (MOVE stick JUMP A LIGHT X HEAVY Y SPECIAL B DASH RB)', /^MOVE stick\s+JUMP A\s+LIGHT X\s+HEAVY Y\s+SPECIAL B\s+DASH RB(\s+OVERCLOCK LT)?$/.test(hintPad), hintPad);
    check('K: the REST/TRADE prompt glyph is ↑ on the pad', (await page.evaluate(() => UB.Input.glyph('up'))) === '↑');
    await shot('hud-gamepad');
    await page.evaluate(() => { UB.UI.clearMessages(); window.dispatchEvent(new Event('gamepaddisconnected')); });
    await step(1); s = await state();
    check('K: gamepad disconnect while the pad is active pauses the game', s.screen === 'pause', s.screen);
    check('K: §15.8 "Gamepad disconnected — paused" toast is shown', (await ui(u => u.toastT > 0 && u.toast1)) === 'Gamepad disconnected — paused', await ui(u => [u.toast1, u.toastT]));
    await page.evaluate(() => { UB.UI.clearMessages(); window.dispatchEvent(new Event('gamepadconnected')); }); await step(1);
    check('K: §15.8 "Gamepad connected" toast is shown on connect', (await ui(u => u.toastT > 0 && u.toast1)) === 'Gamepad connected', await ui(u => [u.toast1, u.toastT]));
    await Q(q => q.padOff());
    await keyTap('Escape');
    check('K: a keyboard key switches the glyphs back', (await page.evaluate(() => UB.Input.device + ',' + UB.Input.glyph('jump'))) === 'keyboard,SPACE');
    await D(d => d.god(false));
    // r3: two pads — the first pad that reports a press becomes the active one (§2.3); the other is ignored until it disconnects
    await reload(true);
    const two = await ev((UB, d, g, q) => {
      q.padOnN(2); const o = { idx0: UB.Input.padIndex };
      q.padTapK(13, 1, 1); o.afterPad2 = UB.Input.padIndex; o.sel2 = UB.UI.sel;          // pad 2 Down: NEW GAME → SETTINGS (CONTINUE skipped)
      q.padTapK(13, 1, 0); o.afterPad1 = UB.Input.padIndex; o.sel1 = UB.UI.sel;          // pad 1 Down: ignored while pad 2 is active
      q.pads[1].connected = false; d.step(2); q.padTapK(13, 1, 0); o.afterDisc = UB.Input.padIndex; o.sel3 = UB.UI.sel;   // pad 2 gone → pad 1 Down wraps to NEW GAME
      q.padOff(); d.step(1); return o;
    });
    check('K: with two pads the first to press (pad 2) becomes active, pad 1 is ignored until pad 2 disconnects, then pad 1 takes over', two.idx0 === -1 && two.afterPad2 === 1 && two.sel2 === 2 && two.afterPad1 === 1 && two.sel1 === 2 && two.afterDisc === 0 && two.sel3 === 0, two);
    // r3: the left stick drives the menus with the same key-repeat as the d-pad (select screen: 1 move on the press, then every 8 f after 18 f)
    const stick = await ev((UB, d, g, q) => {
      q.padOn(); q.padTap(0); const o = { screen: g.screen };
      q.pad.axes[0] = 0.8; d.step(1); o.a = UB.UI.sel; d.step(40); o.b = UB.UI.sel; q.pad.axes[0] = 0; d.step(2);
      q.pad.axes[0] = -0.8; d.step(1); o.c = UB.UI.sel; q.pad.axes[0] = 0; d.step(2);
      q.padTap(1); o.back = g.screen; q.padOff(); d.step(1); return o;
    });
    check('K: stick Right on the select screen hovers the next card and key-repeats while held (1 → 3 after 40 f), stick Left goes back, B returns to the title', stick.screen === 'select' && stick.a === 1 && stick.b === 3 && stick.c === 2 && stick.back === 'title', stick);
    // r3: pad flows — X closes the lore card, d-pad Left/Right adjust a slider from the pause → SETTINGS menu, A respawns from
    //     SIGNAL LOST without a jump, Y advances the epilogue and A returns to the title from the victory screen
    const padFlow = await ev((UB, d, g, q) => {
      const o = {}; q.padOn();
      d.newGame('tessik'); for (let i = 0; i < 300 && !(g.screen === 'play' && !g.busy); i++) d.step(1);
      for (let i = 0; i < 400 && g.overlay !== 'lore'; i++) d.step(1);
      o.lore = g.overlay; d.step(12); q.padTap(2); d.step(2); o.loreAfterX = g.overlay; o.stateAfterLore = g.player.state;
      q.padTap(9); o.paused = g.overlay; q.padTap(13); q.padTap(13); q.padTap(0); o.settings = g.overlay;
      const m0 = g.settings.master; q.padTap(14); o.masterLeft = g.settings.master - m0; q.padTap(15); q.padTap(15); o.masterRight = g.settings.master - m0;
      q.padTap(1); o.backTo = g.overlay; q.padTap(1); o.resumed = g.overlay;
      d.killEnemies(); d.setHp(0); for (let i = 0; i < 300 && !(g.screen === 'gameover' && !g.busy); i++) d.step(1); d.step(30);
      q.padTap(0); for (let i = 0; i < 300 && !(g.screen === 'play' && !g.busy); i++) d.step(1); o.respawned = g.screen; o.state = g.player.state; o.vy = Math.round(g.player.vy);
      d.skipTo('victory'); for (let i = 0; i < 200 && g.screen !== 'victory'; i++) d.step(1); d.step(120);
      const e0 = UB.UI.epiOff; q.padTap(3); o.epi = UB.UI.epiOff - e0; q.padTap(0); o.title = g.screen;
      q.padOff(); d.step(1); return o;
    });
    check('K: pad X closes the lore card into clean play', padFlow.lore === 'lore' && padFlow.loreAfterX === null && padFlow.stateAfterLore === 'idle', padFlow);
    check('K: Start → d-pad Down ×2 → A opens SETTINGS from the pause menu; d-pad Left/Right adjust MASTER VOLUME by 1; B backs out twice to play', padFlow.paused === 'pause' && padFlow.settings === 'settings' && padFlow.masterLeft === -1 && padFlow.masterRight === 1 && padFlow.backTo === 'pause' && padFlow.resumed === null, padFlow);
    check('K: pad A on SIGNAL LOST respawns without a jump on arrival', padFlow.respawned === 'play' && padFlow.state === 'idle' && padFlow.vy === 0, padFlow);
    check('K: on the victory screen pad Y advances the epilogue a line and A returns to the title', padFlow.epi === 20 && padFlow.title === 'title', padFlow);
  });

  // =================================================================================================
  // L. game over → respawn
  // =================================================================================================
  await section('L', async () => {
    await reload(true);
    let s = await startGameClean('tessik');
    // r2: a death before any node use respawns at the start node and never writes a save
    await D(d => d.killEnemies()); await D(d => d.setHp(0));
    s = await stepUntil(x => x.screen === 'gameover' && !x.busy, 300);
    check('L: a death on a fresh run reaches SIGNAL LOST (no save written yet)', s.screen === 'gameover' && !s.hasSave && s.deaths === 1, { screen: s.screen, hasSave: s.hasSave, deaths: s.deaths });
    const early = await ev((UB, d, g, q) => { const t0 = g.screenT; q.tap('Enter'); return [t0, g.screen, g.busy]; });
    check('L: a confirm during the first 20 f of the game-over screen is ignored', early[0] < 20 && early[1] === 'gameover' && early[2] === false, early);
    await step(30); await keyTap('Enter');
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 300);
    check('L: the fresh run respawns at node_dc_wake with full hearts and the slot still empty', s.screen === 'play' && s.roomId === 'dc_wake' && s.nearNode === 'node_dc_wake' && s.hp === s.maxHp && !s.hasSave, { screen: s.screen, room: s.roomId, near: s.nearNode, hp: s.hp, hasSave: s.hasSave });
    s = await Q(q => q.restAt(5, 12));
    check('L: rested at node_dc_wake (save written, hp full)', s.hasSave && s.savedRoom === 'dc_wake' && s.hp === s.maxHp, { hasSave: s.hasSave, room: s.savedRoom });
    await page.evaluate(() => { const p = window.__QA.tilePx(16, 12); UB.debug.teleport(p.x, p.y); UB.debug.step(2); });
    const e0 = (await state()).enemies;
    await D(d => d.killEnemies());
    const d0 = (await state()).deaths;
    await D(d => d.setHp(0));
    s = await stepUntil(x => x.screen === 'gameover' && !x.busy, 300);
    check('L: hp 0 → death animation → SIGNAL LOST screen', s.screen === 'gameover', s.screen);
    check('L: the deaths stat increments on death, not on confirm', s.deaths === d0 + 1, { before: d0, after: s.deaths });
    const ptGo = s.playTimeFrames; await step(60);
    check('L: play time does not advance on the game-over screen', (await state()).playTimeFrames === ptGo);
    const go = await page.evaluate(() => { UB.game.screenT = 65; UB.game.render(1); const q = window.__QA; let danger = 0, sel = 0; const c = document.getElementById('game').getContext('2d'); const a = c.getImageData(300, 220, 360, 40).data; for (let i = 0; i < a.length; i += 4) if (a[i] > 200 && a[i + 1] < 90 && a[i + 2] < 90) danger++; const b = c.getImageData(300, 390, 360, 20).data; for (let i = 0; i < b.length; i += 4) if (b[i] > 220 && b[i + 1] > 180 && b[i + 2] < 140) sel++; return { danger, sel, bg: q.px(10, 10) }; });
    check('L: SIGNAL LOST in DANGER at y 240 on the #07050A background, blinking SELECT prompt at y 400', go.danger > 100 && go.sel > 30 && go.bg[0] < 12 && go.bg[2] < 16, go);
    await shot('gameover');
    await keyTap('Space');
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 200);
    check('L: JUMP respawns at the last restore node with full hearts, energy 50, meter 0', s.screen === 'play' && s.roomId === 'dc_wake' && s.nearNode === 'node_dc_wake' && s.hp === s.maxHp && s.energy >= 50 && s.energy < 56 && s.meter === 0, { screen: s.screen, room: s.roomId, near: s.nearNode, hp: s.hp, energy: s.energy, meter: s.meter });
    const landed = await G(g => ({ state: g.player.state, vy: Math.round(g.player.vy) }));
    check('L: the Space that confirmed the respawn does not jump on arrival', landed.state === 'idle' && landed.vy === 0, landed);
    check('L: enemies respawned on respawn', s.enemies === e0 && e0 > 0, { e0, now: s.enemies });
    check('L: a game over never writes the save (deaths in the slot still 1 from the node save)', (await page.evaluate(() => JSON.parse(localStorage.getItem('underbyte.save')).deaths)) === 1);
  });

  // =================================================================================================
  // M. victory stats after a debug-assisted finish (r2: the real Kernauth death → finale → screen)
  // =================================================================================================
  await section('M', async () => {
    // r3: DESIGN §12.16 — "Continue reloads at rw_rest for free play with rw_throne open": whatever node was used last
    await reload(true);
    await startGameClean('tessik');
    const vicRoom = await ev((UB, d, g, q) => {
      d.warp('ns_rest', null); d.step(3); g.save.loreSeen.push('nullspire'); q.restAt(15, 14);
      const o = { restedAt: JSON.parse(localStorage.getItem('underbyte.save')).roomId };
      for (const b of ['tallock', 'weftyr', 'corrosant']) d.defeatBoss(b);
      g.save.loreSeen.push('rootwell'); d.god(true); d.warp('rw_throne', null); d.step(3);
      const b = g.level.boss; const p = q.tilePx(b.bounds[0] + 2, 20); d.teleport(p.x, p.y); d.step(3);
      for (let i = 0; i < 400 && g.bossFight.state !== 'fight'; i++) d.step(1);
      g.boss.phase = 2; g.boss.hp = 0; g.startBossDeath(); d.step(1);
      for (let i = 0; i < 1500 && g.screen !== 'victory'; i++) d.step(1);
      const sv = JSON.parse(localStorage.getItem('underbyte.save'));
      o.victory = sv.victory; o.savedRoom = sv.roomId; o.savedNode = sv.spawn.nodeId; o.screen = g.screen;
      d.step(200); q.tap('Enter'); d.step(2); o.title = g.screen; q.tap('Enter'); for (let i = 0; i < 300 && !(g.screen === 'play' && !g.busy); i++) d.step(1);
      o.room = g.level.room.id; o.near = g.nearNode ? g.nearNode.id : null; d.god(false);
      return o;
    });
    check('M: CONTINUE after a victory whose last rest was ns_rest reloads at rw_rest / node_rw_rest (DESIGN §12.16) (DEFECT: victory() keeps the roomId / spawn of the last node used, so the cleared run resumes at ns_rest)', vicRoom.restedAt === 'ns_rest' && vicRoom.victory === true && vicRoom.screen === 'victory' && vicRoom.title === 'title' && vicRoom.room === 'rw_rest' && vicRoom.near === 'node_rw_rest', vicRoom);
    await reload(true);
    let s = await startGameClean('vellix');
    await D(d => d.warp('debug_room', null)); await step(3); await D(d => d.god(true));
    const kill = await page.evaluate(() => {
      const g = UB.game, q = window.__QA, p = g.player; const tx = Math.floor(p.x / 30), ty = Math.floor((p.y - 1) / 30);
      const n0 = g.enemies.length;
      UB.debug.spawnEnemy('walker', tx + 1, ty, { patrol: [tx + 1, tx + 1] }); g.enemies[g.enemies.length - 1].hp = 1;
      q.key('ArrowRight', true); UB.debug.step(2); q.key('ArrowRight', false); UB.debug.step(1);
      for (let i = 0; i < 6 && g.enemies.length > n0; i++) { q.key('KeyZ', true); UB.debug.step(2); q.key('KeyZ', false); UB.debug.step(20); }
      return { enemies: g.enemies.length, n0, purged: g.save.enemiesPurged };
    });
    check('M: a real kill counts in enemiesPurged', kill.enemies === kill.n0 && kill.purged === 1, kill);
    await D(d => d.warp('dc_loft', null)); await step(3);
    const coreGot = await page.evaluate(() => { const p = window.__QA.tilePx(27, 12); UB.debug.teleport(p.x, p.y); UB.debug.step(6); const s = UB.debug.state(); return { cores: s.cores, maxHp: s.maxHp, b1: UB.UI.banner1, b2: UB.UI.banner2 }; });
    check('M: picking up core 1 adds a core (+1 max heart) with the CORE FOUND banner', coreGot.cores.indexOf('core_dc_loft') >= 0 && coreGot.maxHp === 5 && coreGot.b1 === 'CORE FOUND' && coreGot.b2 === 'Max hearts +1', coreGot);
    await D(d => d.addBits(77));
    for (const b of ['tallock', 'weftyr', 'corrosant']) await D((d, b) => d.defeatBoss(b), b);
    await D(d => d.god(false));
    await D(d => d.setHp(0)); s = await stepUntil(x => x.screen === 'gameover' && !x.busy, 300);
    await step(30); await keyTap('Enter'); s = await stepUntil(x => x.screen === 'play' && !x.busy, 200);
    await clearOverlay();
    await Q(q => q.restAt(5, 12));
    // the real final-boss flow: fight starts in rw_throne, phase 2 spent → startBossDeath → 120 f dying → reward → victory() → fade
    await D(d => d.god(true));
    const fight = await ev((UB, d, g, q) => { g.save.loreSeen.push('rootwell'); d.warp('rw_throne', null); d.step(3); const b = g.level.boss; const p = q.tilePx(b.bounds[0] + 2, 20); d.teleport(p.x, p.y); d.step(3); const out = { boss: g.boss && g.boss.id, state: g.bossFight.state }; for (let i = 0; i < 400 && g.bossFight.state !== 'fight'; i++) d.step(1); out.fight = g.bossFight.state; return out; });
    check('M: entering the Kernauth arena starts the intro and then the fight', fight.boss === 'kernauth' && fight.state === 'intro' && fight.fight === 'fight', fight);
    const died = await ev((UB, d, g, q) => { g.boss.phase = 2; g.boss.hp = 0; g.startBossDeath(); d.step(1); return { state: g.bossFight.state, saved: JSON.parse(localStorage.getItem('underbyte.save')).bossesDefeated, song: UB.Audio.state().song }; });
    check('M: the final boss\'s death records kernauth in the save at once and stops the music', died.state === 'dying' && died.saved.indexOf('kernauth') >= 0 && died.song === null, died);
    const sv = await G(g => { let total = 0, disc = 0; for (const id in UB.World.rooms) { if (UB.World.rooms[id].debug) continue; total++; if (g.save.discovered.indexOf(id) >= 0) disc++; } return { fighter: g.save.fighter, pt: g.save.playTimeFrames, deaths: g.save.deaths, bits: g.save.bits, bitsLifetime: g.save.bitsLifetime, cores: g.save.cores.length, disc, total, purged: g.save.enemiesPurged, bosses: g.save.bossesDefeated.length }; });
    s = await stepUntil(x => x.screen === 'victory' && !x.busy, 1200, 10);
    check('M: the victory screen follows the finale (dying → reward → fade)', s.screen === 'victory', s.screen);
    const vic = await G(g => ({ song: UB.Audio.state().song, rows: UB.UI.vicRows.slice(), fmt: UB.Util.fmtTime(g.save.playTimeFrames), pt: g.save.playTimeFrames, victory: JSON.parse(localStorage.getItem('underbyte.save')).victory }));
    check('M: the victory song plays and the save carries victory:true', vic.song === 'victory' && vic.victory === true, vic);
    const want = ['VELLIX', vic.fmt, String(sv.deaths), String(sv.bitsLifetime), sv.cores + '/3', sv.disc + '/' + sv.total, String(sv.purged), '4/4'];
    check('M: the 8 stat rows equal the save: FIGHTER / TIME / DEATHS / BITS COLLECTED / CORES / ROOMS / ENEMIES / BOSSES', JSON.stringify(vic.rows) === JSON.stringify(want), { rows: vic.rows, want });
    check('M: the stats are the expected values (1 death, ≥ 77 lifetime bits, 1/3 cores, 1 enemy, 4 bosses, x/23 rooms)', sv.deaths === 1 && sv.bitsLifetime >= 77 && sv.cores === 1 && sv.purged === 1 && sv.bosses === 4 && sv.total === 23, sv);
    const pad = (n) => (n < 10 ? '0' : '') + n;
    check('M: TIME is HH:MM:SS of play frames only and froze during the finale fade', /^\d\d:\d\d:\d\d$/.test(vic.fmt) && vic.fmt === pad(Math.floor(vic.pt / 216000)) + ':' + pad(Math.floor(vic.pt / 3600) % 60) + ':' + pad(Math.floor(vic.pt / 60) % 60) && vic.pt >= sv.pt, vic);
    // r2: confirm is ignored until the rows have typed in (108 f)
    const earlyC = await ev((UB, d, g, q) => { const t0 = g.screenT; q.tap('Enter'); return [t0, g.screen]; });
    check('M: CONFIRM is ignored while the stat rows are still typing in', earlyC[0] < 108 && earlyC[1] === 'victory', earlyC);
    await step(150); await shot('victory');
    await keyTap('ArrowDown');
    check('M: a non-confirm key advances the epilogue a line', (await ui(u => u.epiOff)) === 20, await ui(u => u.epiOff));
    const epi = await page.evaluate(() => { const q = window.__QA; return Math.max.apply(null, ['The spire, with no address left to answer, forgets to hang there,', 'For the first time since the kingdom was buried, nothing below'].map(l => q.measure(l, UB.font(14, 'MONO')))); });
    check('M: the longest epilogue line fits the screen at 14 px MONO', epi <= 900, epi);
    await keyTap('Enter'); s = await state();
    check('M: CONFIRM returns to the title', s.screen === 'title', s.screen);
    const sum = await G(g => ({ sum: g.saveSummary(), slotTime: UB.Util.fmtTime(JSON.parse(localStorage.getItem('underbyte.save')).playTimeFrames) }));
    check('M: title shows the CONTINUE summary "VELLIX · ZONE · 5 hearts · HH:MM:SS" (the slot\'s play time) with the cursor on CONTINUE', /^VELLIX · [A-Z]+ · 5 hearts · \d\d:\d\d:\d\d$/.test(sum.sum) && (await ui(u => u.sel)) === 1 && sum.sum.endsWith(sum.slotTime), { sum, sel: await ui(u => u.sel) });
    await step(5); await shot('title-save');
    await keyTap('Enter'); s = await stepUntil(x => x.screen === 'play' && !x.busy, 300);
    const after = await G(g => ({ room: g.level.room.id, song: UB.Audio.state().song, bosses: g.save.bossesDefeated.length }));
    await D(d => d.warp('rw_throne', null)); await step(3);
    const throne = await G(g => ({ boss: !!g.boss, song: UB.Audio.state().song, fight: g.bossFight.state }));
    check('M: CONTINUE after the victory loads the cleared run; rw_throne is empty and quiet (no boss, no music)', after.bosses === 4 && !throne.boss && throne.song === null && throne.fight === 'none', { after, throne });
  });

  // =================================================================================================
  // N. save: reload/CONTINUE, corruption, storage blocked, overwrite, reset, boss-death save, quit
  // =================================================================================================
  await section('N', async () => {
    await reload(false);
    let s = await state();
    check('N: a saved slot survives a reload (CONTINUE default)', s.hasSave && (await ui(u => u.sel)) === 1, { hasSave: s.hasSave });
    await keyTap('Enter');
    s = await stepUntil(x => x.screen === 'play' && !x.busy, 300);
    check('N: CONTINUE loads the saved fighter at the saved node, full hearts incl. the core, abilities + bosses kept', s.screen === 'play' && s.fighter === 'vellix' && s.roomId === 'dc_wake' && s.maxHp === 5 && s.hp === 5 && s.bossesDefeated.length === 4 && s.abilities.gripProtocol === true, { fighter: s.fighter, room: s.roomId, maxHp: s.maxHp, bosses: s.bossesDefeated.length, ab: s.abilities });
    await clearOverlay();
    const blocked = await page.evaluate(() => {
      const orig = Storage.prototype.setItem;
      Storage.prototype.setItem = function () { throw new Error('QuotaExceeded'); };
      let r; try { r = UB.debug.save(); } finally { Storage.prototype.setItem = orig; }
      return { r, toast: UB.UI.toast1, t: UB.UI.toastT, screen: UB.debug.state().screen };
    });
    check('N: a blocked write returns false, shows "Could not save (storage blocked)" for 90 f and keeps playing', blocked.r === false && blocked.toast === 'Could not save (storage blocked)' && blocked.t === 90 && blocked.screen === 'play', blocked);
    for (const [label, raw] of [['garbage text', '{not json'], ['a JSON array', '[1,2,3]'], ['a number', '42'], ['unknown version', JSON.stringify({ version: 2, fighter: 'tessik' })], ['null', 'null']]) {
      await page.evaluate((raw) => localStorage.setItem('underbyte.save', raw), raw);
      await reload(false);
      s = await state();
      const cont = await D(d => d.continueGame());
      check('N: corrupt slot (' + label + ') → no save, CONTINUE disabled/refused, no errors', !s.hasSave && cont === false && (await ui(u => u.sel)) === 0 && (await state()).screen === 'title' && t.errors.length === 0, { hasSave: s.hasSave, cont, errs: t.errors });
    }
    const bad = { version: 1, fighter: 'nobody', roomId: 'nowhere', spawn: { nodeId: 'node_dc_shrine' }, hearts: 99, maxHearts: 99, baseHearts: 99,
      cores: ['bogus', 'core_dc_loft', 'core_dc_loft'], abilities: { echoJump: 'yes', burstLine: true, gripProtocol: 1 }, bits: -5, bitsLifetime: 'a',
      discovered: ['dc_wake', 42, 'zzz'], visited: ['dc_fall'], bossesDefeated: ['tallock', 'nope'], bitsCollected: ['dc_wake:19,10', 'dc_wake:0,0', 'xx'],
      vendor: ['deep_ping', 'fake', 'deep_ping'], nodesUsed: ['node_dc_wake', 'ghost'], loreSeen: ['driftcache', 'mars'], hints: null,
      enemiesPurged: -1, playTimeFrames: Infinity, deaths: 1.7, victory: 'true', savedAt: 'now' };
    await page.evaluate((b) => localStorage.setItem('underbyte.save', JSON.stringify(b)), bad);
    await reload(false);
    const san = await G(g => g.readSave());
    const sanOk = san && san.fighter === 'tessik' && san.roomId === 'dc_wake' && san.spawn.nodeId === 'node_dc_wake' && JSON.stringify(san.cores) === '["core_dc_loft"]'
      && san.abilities.echoJump === false && san.abilities.burstLine === true && san.abilities.gripProtocol === false && san.bits === 0 && san.bitsLifetime === 0
      && san.discovered.indexOf('dc_wake') >= 0 && san.discovered.indexOf('dc_fall') >= 0 && san.discovered.length === 2 && JSON.stringify(san.visited) === '["dc_fall"]'
      && JSON.stringify(san.bossesDefeated) === '["tallock"]' && JSON.stringify(san.bitsCollected) === '["dc_wake:19,10"]' && JSON.stringify(san.vendor) === '["deep_ping"]'
      && JSON.stringify(san.nodesUsed) === '["node_dc_wake"]' && JSON.stringify(san.loreSeen) === '["driftcache"]' && san.hints.move === false && san.enemiesPurged === 0
      && san.playTimeFrames === 0 && san.deaths === 1 && san.victory === false && san.maxHearts === 6 && san.hearts === 6 && san.baseHearts === 5;
    check('N: a partially corrupt slot is sanitised field by field (fighter/room/node fallback, id filters, booleans, finite ≥ 0 numbers, hearts recomputed)', sanOk, san);
    s = await state();
    check('N: the sanitised slot still counts as a save (CONTINUE enabled)', s.hasSave === true);
    await keyTap('Enter'); s = await stepUntil(x => x.screen === 'play' && !x.busy, 300);
    check('N: CONTINUE on the sanitised slot loads Tessik at dc_wake with 6 hearts, Deep Ping and Tallock kept', s.screen === 'play' && s.fighter === 'tessik' && s.roomId === 'dc_wake' && s.maxHp === 6 && s.vendor.indexOf('deep_ping') >= 0 && s.bossesDefeated.indexOf('tallock') >= 0 && s.energyMax === 100, { fighter: s.fighter, room: s.roomId, maxHp: s.maxHp, vendor: s.vendor, bosses: s.bossesDefeated, energyMax: s.energyMax });
    await clearOverlay();
    await D(d => d.toTitle()); await step(2);
    await keyTap('ArrowUp'); await keyTap('Enter');
    check('N: NEW GAME over a save asks "Overwrite the saved run?" with NO default', (await ui(u => u.confirmNew && u.ynSel === 0)));
    await keyTap('Enter'); s = await state();
    check('N: NO keeps the title and the save', s.screen === 'title' && s.hasSave && !(await ui(u => u.confirmNew)));
    await keyTap('Enter'); await keyTap('ArrowRight'); await keyTap('Enter'); s = await state();
    check('N: YES opens the character select', s.screen === 'select', s.screen);
    await keyTap('Escape');
    await step(2); let sel = await ui(u => u.sel); while (sel !== 2) { await keyTap('ArrowDown'); sel = await ui(u => u.sel); }
    await keyTap('Enter');
    check('N: SETTINGS from the title with a save shows RESET SAVE', (await state()).screen === 'settings' && (await ui(u => u.fromTitle)));
    await keyTap('ArrowLeft');
    for (let i = 0; i < 5; i++) await keyTap('ArrowDown');
    await keyTap('Enter');
    check('N: RESET SAVE asks "Erase the saved run? This cannot be undone." with NO default', (await ui(u => u.confirmReset && u.ynSel === 0)));
    await keyTap('ArrowLeft'); await keyTap('Enter');
    s = await state();
    const resetToast = await ui(u => u.toast1);
    check('N: YES erases the slot (CONTINUE disabled afterwards) and leaves the settings file alone', !s.hasSave && (await page.evaluate(() => localStorage.getItem('underbyte.save') === null && localStorage.getItem('underbyte.settings') !== null)));
    check('N: the reset confirmation toast is the §15.8 string SAVE ERASED', resetToast === 'SAVE ERASED', resetToast);
    await keyTap('Escape');
    check('N: title after the reset has a visible cursor on NEW GAME', (await ui(u => u.sel)) === 0, await ui(u => u.sel));
    // r2: a boss death writes the save at once; after a reload + CONTINUE the arena is clear and its seals open
    await reload(true);
    s = await startGameClean('tessik');
    await Q(q => q.restAt(5, 12));
    await D(d => d.god(true));
    const bd = await ev((UB, d, g, q) => { d.warp('dc_sentinel', null); d.step(3); const b = g.level.boss; const p = q.tilePx(b.bounds[0] + 1, 14); d.teleport(p.x, p.y); d.step(3); for (let i = 0; i < 400 && g.bossFight.state !== 'fight'; i++) d.step(1); const sealed0 = g.level.openings.filter(o => o.sealed).map(o => o.id); g.startBossDeath(); d.step(2); const sv = JSON.parse(localStorage.getItem('underbyte.save')); return { fight: g.bossFight.state, sealed0, saved: sv.bossesDefeated, savedRoom: sv.roomId, ab: sv.abilities.echoJump }; });
    check('N: a boss death writes bossesDefeated to the slot immediately (room stays the node room, ability not yet granted)', bd.fight === 'dying' && bd.sealed0.length > 0 && bd.saved.indexOf('tallock') >= 0 && bd.savedRoom === 'dc_wake' && bd.ab === false, bd);
    await reload(false);
    await keyTap('Enter'); s = await stepUntil(x => x.screen === 'play' && !x.busy, 300);
    const arena = await ev((UB, d, g, q) => { d.warp('dc_sentinel', null); d.step(3); return { boss: !!g.boss, fight: g.bossFight.state, sealed: g.level.openings.filter(o => o.sealed).map(o => o.id), module: g.pickups.filter(p => p.type === 'ability').length, defeated: g.save.bossesDefeated }; });
    check('N: after CONTINUE the arena has no boss, every exit open and the uncollected ECHO JUMP module waiting', !arena.boss && arena.fight === 'none' && arena.sealed.length === 0 && arena.module === 1 && arena.defeated.indexOf('tallock') >= 0, arena);
    await clearOverlay();
    // r2: quitting during a live boss fight does not record it; CONTINUE brings the boss back at full HP
    await ev((UB, d, g, q) => { g.save.bossesDefeated.length = 0; d.warp('dc_wake', null); d.step(3); q.restAt(5, 12); });   // a slot without tallock
    const quit = await ev((UB, d, g, q) => { d.warp('dc_sentinel', null); d.step(3); const b = g.level.boss; const p = q.tilePx(b.bounds[0] + 1, 14); d.teleport(p.x, p.y); d.step(3); for (let i = 0; i < 400 && g.bossFight.state !== 'fight'; i++) d.step(1); g.boss.hp = 10; d.step(2); d.addBits(50); const bits0 = g.save.bits; q.tap('Escape'); UB.UI.sel = 3; q.tap('Enter'); const dlg = UB.UI.confirmQuit; q.tap('ArrowLeft'); q.tap('Enter'); d.step(2); return { fight: 'fight', dlg, screen: g.screen, sel: UB.UI.sel, bits0, savedBits: JSON.parse(localStorage.getItem('underbyte.save')).bits, song: UB.Audio.state().song }; });
    check('N: QUIT TO TITLE → YES during a boss fight returns to the title (cursor on CONTINUE, title music) without saving the unsaved bits', quit.dlg && quit.screen === 'title' && quit.sel === 1 && quit.bits0 === 50 && quit.savedBits === 0 && quit.song === 'title', quit);
    await keyTap('Enter'); s = await stepUntil(x => x.screen === 'play' && !x.busy, 300);
    const back = await ev((UB, d, g, q) => { const bits = g.save.bits; d.warp('dc_sentinel', null); d.step(3); return { bits, boss: g.boss && g.boss.id, hp: g.boss && g.boss.hp, maxHp: g.boss && g.boss.maxHp, defeated: g.save.bossesDefeated }; });
    check('N: CONTINUE after the quit: bits back to the saved 0, Tallock alive at full HP (the fight was never recorded)', back.bits === 0 && back.boss === 'tallock' && back.hp === back.maxHp && back.defeated.length === 0, back);
    await D(d => d.god(false));
    // r3: "Overwrite the saved run?" → YES: the old slot must not outlive the answer (a QUIT before the first node would otherwise
    // CONTINUE the overwritten run)
    await reload(true);
    await startGameClean('tessik'); await Q(q => q.restAt(5, 12)); await D(d => d.toTitle()); await step(2);
    const ow = await ev((UB, d, g, q) => {
      while (UB.UI.sel !== 0) q.tap('ArrowUp');
      q.tap('Enter'); const dlg = UB.UI.confirmNew; q.tap('ArrowLeft'); q.tap('Enter'); const sel = g.screen;
      q.tap('ArrowRight'); q.tap('Enter'); for (let i = 0; i < 300 && !(g.screen === 'play' && !g.busy); i++) d.step(1);
      const slot = JSON.parse(localStorage.getItem('underbyte.save') || 'null');
      const o = { dlg, sel, fighter: g.save.fighter, slotFighter: slot && slot.fighter };
      for (let i = 0; i < 400 && g.overlay !== 'lore'; i++) d.step(1); if (g.overlay === 'lore') { d.step(12); d.pressed('confirm', 2); d.step(3); }
      q.tap('Escape'); UB.UI.sel = 3; q.tap('Enter'); q.tap('ArrowLeft'); q.tap('Enter'); d.step(2);   // QUIT TO TITLE → YES before any node
      o.titleSel = UB.UI.sel; o.summary = g.saveSummary(); o.hasSave = g.hasSave();
      return o;
    });
    check('N: after "Overwrite the saved run?" → YES and the new run (Brackmaw) boots, the slot no longer holds the old Tessik run (DEFECT: the old slot survives until the first node save — QUIT TO TITLE before resting and CONTINUE resumes the overwritten run)', ow.dlg && ow.sel === 'select' && ow.fighter === 'brackmaw' && (ow.slotFighter === null || ow.slotFighter === 'brackmaw') && (!ow.hasSave || /^BRACKMAW/.test(ow.summary)), ow);
    // r3: localStorage that throws on every access (blocked / private storage): the game boots to the title, settings default,
    // a node rest shows the storage toast and play goes on, no page errors
    const p3 = await t.browser.newPage({ viewport: { width: 1280, height: 720 } });
    const p3err = []; p3.on('pageerror', e => p3err.push('pageerror: ' + String(e))); p3.on('console', m => { if (m.type() === 'error') p3err.push(m.text()); });
    await p3.addInitScript(() => { const boom = function () { throw new Error('storage blocked'); }; Storage.prototype.getItem = boom; Storage.prototype.setItem = boom; Storage.prototype.removeItem = boom; });
    await p3.goto(t.url); await p3.waitForTimeout(300);
    const blockedBoot = await p3.evaluate(() => {
      const d = UB.debug, g = UB.game; d.pauseLogic(true); const s = d.state();
      const o = { screen: s.screen, hasSave: s.hasSave, master: g.settings.master, music: g.settings.music };
      g.setSetting('master', 5); o.setOk = g.settings.master === 5;
      d.newGame('tessik'); for (let i = 0; i < 300 && !(g.screen === 'play' && !g.busy); i++) d.step(1);
      for (let i = 0; i < 400 && g.overlay !== 'lore'; i++) d.step(1); if (g.overlay === 'lore') { d.step(12); d.pressed('confirm', 2); d.step(3); }
      d.teleport(5 * 30 + 15, 13 * 30); d.step(4); d.pressed('up', 2); d.step(2); for (let i = 0; i < 150 && g.mode !== 'normal'; i++) d.step(1);
      o.after = d.state().screen; o.toast = UB.UI.toast1; o.hasSave2 = g.hasSave(); o.hp = g.player.hp;
      return o;
    });
    await p3.close();
    check('N: with localStorage throwing on every access the game boots to the title (no save, default settings), a setting still applies in memory, a node rest shows "Could not save (storage blocked)" and play goes on without page errors', blockedBoot.screen === 'title' && !blockedBoot.hasSave && blockedBoot.master === 8 && blockedBoot.music === 7 && blockedBoot.setOk && blockedBoot.after === 'play' && blockedBoot.toast === 'Could not save (storage blocked)' && !blockedBoot.hasSave2 && p3err.length === 0, { blockedBoot, p3err });
  });

  // =================================================================================================
  // O. letterboxing + overflow
  // =================================================================================================
  await section('O', async () => {
    await reload(true);
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check('O: the page background is the LETTERBOX colour (#0A080C)', bodyBg === 'rgb(10, 8, 12)', bodyBg);
    await page.setViewportSize({ width: 800, height: 600 }); await page.waitForTimeout(120);
    const v1 = await page.evaluate(() => { const c = document.getElementById('game'); return { w: c.style.width, h: c.style.height, l: c.style.left, t: c.style.top, bw: c.width, bh: c.height }; });
    check('O: 800×600 → 800×450 canvas letterboxed at (0,75), backing 960×540', v1.w === '800px' && v1.h === '450px' && v1.l === '0px' && v1.t === '75px' && v1.bw === 960 && v1.bh === 540, v1);
    await D(d => d.pauseLogic(false)); await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, 'qa-ui-letterbox-800x600.png') });
    await page.setViewportSize({ width: 1920, height: 1080 }); await page.waitForTimeout(120);
    const v2 = await page.evaluate(() => { const c = document.getElementById('game'); return { w: c.style.width, h: c.style.height, l: c.style.left, t: c.style.top, bw: c.width, bh: c.height }; });
    check('O: 1920×1080 → the canvas fills the window exactly with a 1920×1080 backing (2× scale, crisp, no bars)', v2.w === '1920px' && v2.h === '1080px' && v2.l === '0px' && v2.t === '0px' && v2.bw === 1920 && v2.bh === 1080, v2);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, 'qa-ui-letterbox-1920x1080.png') });
    await page.setViewportSize({ width: 1600, height: 900 }); await page.waitForTimeout(120);
    const v4 = await page.evaluate(() => { const c = document.getElementById('game'); return { w: c.style.width, h: c.style.height, bw: c.width, bh: c.height }; });
    check('O: 1600×900 → a 1440×810 backing (scale quantised to 1.5)', v4.w === '1600px' && v4.h === '900px' && v4.bw === 1440 && v4.bh === 810, v4);
    await page.setViewportSize({ width: 1280, height: 720 }); await page.waitForTimeout(120);
    await D(d => d.pauseLogic(true));
    const p2 = await t.browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
    await p2.goto(t.url); await p2.waitForTimeout(300);
    const v3 = await p2.evaluate(() => { const c = document.getElementById('game'); return { bw: c.width, bh: c.height, dpr: window.devicePixelRatio, w: c.style.width }; });
    await p2.close();
    check('O: at devicePixelRatio 2 the backing store is 1920×1080 (crisp)', v3.dpr === 2 && v3.bw === 1920 && v3.bh === 1080, v3);
    const ov = await page.evaluate(() => {
      const q = window.__QA, f = UB.font, out = [];
      const over = (label, w, max) => { if (w > max) out.push(label + ' ' + Math.round(w) + ' > ' + max); };
      over('title tagline 18px mono', q.measure('A kingdom buried in its own memory. Purge it from the inside.', f(18, 'MONO')), 920);
      over('title footer 11px mono', q.measure('an original game · keyboard or gamepad · press Enter', f(11, 'MONO')), 900);
      over('select sub', q.measure('← → select · Enter confirm · Esc back', f(13, 'MONO')), 900);
      over('gameover prompt 16px bold', q.measure('Press JUMP or CONFIRM to continue', f(16, 'UI', true)), 900);
      const Z = UB.World.zones; for (const id in Z) { if (Z[id].debug) continue; over('toast blurb ' + id, q.measure(Z[id].blurb, f(16, 'MONO')), 900); over('zone name ' + id + ' 34px +2', q.measure(Z[id].name, f(34, 'UI', true)) + 2 * Z[id].name.length, 900); over('lore name ' + id + ' 40px +6', q.measure(Z[id].name, f(40, 'UI', true)) + 6 * Z[id].name.length, 900); }
      const B = UB.Bosses.DATA; for (const id in B) { if (id === 'proto_warden') continue; over('boss bar line ' + id, q.measure(B[id].name, f(18, 'UI', true)) + q.measure(' · ' + B[id].subtitle, f(12, 'MONO')), 600); over('boss card sub ' + id, q.measure(B[id].subtitle, f(14, 'MONO')), 940); over('boss card name ' + id + ' 36px +4', q.measure(B[id].name, f(36, 'UI', true)) + 4 * B[id].name.length, 940); }
      over('hint strip full (keyboard)', q.measure('MOVE ←→  JUMP SPACE  LIGHT Z  HEAVY X  SPECIAL C  DASH SHIFT  OVERCLOCK V', f(13, 'MONO')), 700);
      over('save summary (longest)', q.measure('BRACKMAW · BRINEVAULT · 9 hearts · 99:59:59', f(12, 'MONO')), 900);
      over('victory stat value column', q.measure('ROOMS DISCOVERED', f(16, 'MONO')) + q.measure('23/23', f(16, 'MONO')), 360);
      over('settings row label', q.measure('SHOW HITBOXES', f(16, 'UI', true)), 270);
      over('quit confirm line', q.measure('last node is lost. Quit?', f(12, 'MONO')), 290);
      over('reset confirm line', q.measure('This cannot be undone.', f(12, 'MONO')), 290);
      over('overwrite line', q.measure('Overwrite the saved run?', f(12, 'MONO')), 290);
      over('no-save hint', q.measure('No signal found. Start a new run.', f(12, 'MONO')), 900);
      over('OVERCLOCK ready label (LT)', q.measure('OVERCLOCK — READY  [LT]', f(10, 'UI', true)), 180);
      over('shop footer', q.measure('↑↓ select · Enter buy · Esc close', f(11, 'MONO')), 460);
      over('vendor name (longest)', Math.max.apply(null, UB.IDS.vendorItems.map(i => q.measure(i.name, f(18, 'UI', true)))), 360);
      return out;
    });
    check('O: fixed-position strings fit their panels / the screen with the real fonts', ov.length === 0, ov);
  });

  // =================================================================================================
  // P. no errors
  // =================================================================================================
  check('P: no console errors or page errors', t.errors.length === 0, t.errors);

  const fails = results.filter(r => !r.ok);
  console.log('\n' + (results.length - fails.length) + '/' + results.length + ' checks passed' + (fails.length ? ' — FAILED: ' + fails.map(f => f.name).join(' | ') : ''));
  if (t.errors.length) console.log('page errors:\n' + t.errors.join('\n'));
  await t.close();
  process.exit(fails.length ? 1 : 0);
})();
