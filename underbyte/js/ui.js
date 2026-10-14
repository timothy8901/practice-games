/*
 * UNDERBYTE — js/ui.js
 * Owner: UI/FX implementer.
 * Contract: CONTRACT.md §8.1 (UB.UI). Design: DESIGN.md §2.5 (menu input), §12 (HUD & screens —
 *           every coordinate below is from there), §14 (save data as displayed), §15 (all text).
 *
 * The engine drives the screen state machine (game.screen / game.overlay); this module renders
 * the HUD, the full screens (title, character select, game over, victory) and the overlays
 * (pause, map, settings, shop, lore) and handles MENU input only, talking back to the engine
 * through the public game methods of CONTRACT §8:
 *   toSelect() toTitle() newGame(id) continueGame() hasSave() saveSummary() openOverlay(name)
 *   closeOverlay() respawnAtNode() setSetting(k, v) resetSave() buy(itemId) hasDeepPing() victoryStats()
 *
 * Allocation rules (BRIEF rule 8): drawHUD/drawScreen allocate nothing per frame. Fonts are
 * pre-built strings, text widths and letter-spacing advances are cached per (font, string),
 * gradients / the logo / the map hatch / the low-HP vignette are offscreen canvases built once,
 * wrapped paragraphs (bios, lore, vendor lines) are wrapped once and cached, dynamic strings
 * (bits counter, boss name line, hint strip, save summary, victory rows) are rebuilt only when
 * their inputs change, inside tick()/enter() — never inside a draw.
 * Everything is keyboard AND gamepad navigable (UB.Input maps both to the same actions).
 */
'use strict';
(function (UB) {
  const P = UB.Palette, In = UB.Input, U = UB.Util, Au = UB.Audio, FX = UB.FX, Rn = UB.Render;
  const W = 960, H = 540, TAU = Math.PI * 2;
  const VENDOR = UB.IDS.vendorItems;

  // --- fonts (built once; UB.font concatenates) ------------------------------------------------
  const F = {
    ui10b: UB.font(10, 'UI', true), ui12b: UB.font(12, 'UI', true), ui13b: UB.font(13, 'UI', true), ui14b: UB.font(14, 'UI', true),
    ui16b: UB.font(16, 'UI', true), ui18b: UB.font(18, 'UI', true), ui22b: UB.font(22, 'UI', true), ui24b: UB.font(24, 'UI', true),
    ui26b: UB.font(26, 'UI', true), ui30b: UB.font(30, 'UI', true), ui34b: UB.font(34, 'UI', true), ui36b: UB.font(36, 'UI', true),
    ui40b: UB.font(40, 'UI', true), ui44b: UB.font(44, 'UI', true), ui92b: UB.font(92, 'UI', true),
    mono11: UB.font(11, 'MONO'), mono12: UB.font(12, 'MONO'), mono12b: UB.font(12, 'MONO', true), mono13: UB.font(13, 'MONO'),
    mono14: UB.font(14, 'MONO'), mono15: UB.font(15, 'MONO'), mono16: UB.font(16, 'MONO'), mono16b: UB.font(16, 'MONO', true), mono18: UB.font(18, 'MONO'),
    mono20b: UB.font(20, 'MONO', true),
  };

  // --- all text (DESIGN §15) --------------------------------------------------------------------
  const TXT = {
    logo: 'UNDERBYTE',
    tagline: 'A kingdom buried in its own memory. Purge it from the inside.',
    titleMenu: ['NEW GAME', 'CONTINUE', 'SETTINGS'],
    pressAny: 'PRESS ANY KEY',
    footer: 'an original game · keyboard or gamepad · press Enter',
    version: 'v1.0',
    noSave: 'No signal found. Start a new run.',
    overwrite: 'Overwrite the saved run?',
    selectHeader: 'CHOOSE YOUR SPIRIT',
    selectSub: '← → select · Enter confirm · Esc back',
    statLabels: ['HEARTS', 'SPEED', 'JUMP', 'WEIGHT'],
    paused: 'PAUSED', pauseMenu: ['RESUME', 'MAP', 'SETTINGS', 'QUIT TO TITLE'],
    quit1: 'Unsaved progress since the', quit2: 'last node is lost. Quit?',
    yes: 'YES', no: 'NO',
    settings: 'SETTINGS',
    settingRows: ['MASTER VOLUME', 'MUSIC VOLUME', 'SFX VOLUME', 'SCREEN SHAKE', 'SHOW HITBOXES', 'RESET SAVE', 'BACK'],
    on: 'ON', off: 'OFF',
    reset1: 'Erase the saved run?', reset2: 'This cannot be undone.',
    map: 'MAP', mapLegend: '◆ node  ● boss  ⬢ vendor  · you', mapClose: 'Esc / M close', mapRecentre: 'R recentre',
    gameOver: 'SIGNAL LOST', gameOverSub: 'Rebooting at the last restore node…', gameOverPrompt: 'Press JUMP or CONFIRM to continue',
    victory: 'ROOT PROCESS PURGED', victoryPrompt: 'Press CONFIRM for the title',
    victoryRows: ['FIGHTER', 'TIME', 'DEATHS', 'BITS COLLECTED', 'CORES FOUND', 'ROOMS DISCOVERED', 'ENEMIES PURGED', 'BOSSES'],
    epilogue: ['The Root Process let go.', '',
      'For the first time since the kingdom was buried, nothing below',
      'is holding on to anything above. The racks in Driftcache settle',
      'a final inch. The looms run down and stop. The brine goes still.',
      'The spire, with no address left to answer, forgets to hang there,',
      'and simply ends.', '',
      'You are a program with nothing left to run. You stay anyway,',
      'in the quiet, where the light from the well reaches the ceiling',
      'for the first time.', '',
      'It is enough.', '',
      'Thank you for playing.'],
    shopFooter: '↑↓ select · Enter buy · Esc close', sold: 'SOLD',
    vendorLines: ["Everything down here was somebody's, once. Now it's mine. Now it's yours.",
      "You pay in bits because that's all that's left to pay in.",
      "The deeper you go, the cheaper I get. Don't ask why I'm down here."],
    vendorPoor: 'Come back heavier.',
    vendorSoldOut: "Nothing left you'd want. Nothing left I'd sell.",
    vendorFirstRw: "Don't ask how I got down here. I don't know either.",
    pressAnyKey: 'Press any key',
    ocLabel: 'OVERCLOCK', ocReady: 'OVERCLOCK — READY  [', ocOn: 'OVERCLOCKED', energy: 'ENERGY',
    prompt: { REST: '▲ REST', TRADE: '▲ TRADE' },
    moveLabels: ['LIGHT  ', 'HEAVY  ', '   SPECIAL  ', 'ULTIMATE  '],
  };
  /** Banner line 2/3 by line 1 (DESIGN §15.5); the engine passes its own lines, the UI owns the text. */
  const BANNER_TEXT = {
    'ECHO JUMP ACQUIRED': ['Press JUMP again in the air', 'Press A again in the air', 'A second thought, taken mid-fall.'],
    'BURST LINE ACQUIRED': ['Press DASH (Shift / RB) to lunge 6 tiles — on the ground or once in the air', 'Press RB to lunge 6 tiles — on the ground or once in the air', 'Skip the frames you do not need.'],
    'GRIP PROTOCOL ACQUIRED': ['Hold toward a wall in the air to cling · JUMP to kick off', 'Hold toward a wall in the air to cling · A to kick off', 'The walls were never the problem.'],
    'CORE FOUND': ['Max hearts +1', 'Max hearts +1', 'A piece of the kingdom that never rotted.'],
    'RESTORED': ['Saved · hearts full · energy full', 'Saved · hearts full · energy full', ''],
  };
  const HINT_ORDER = [['move', 'MOVE', 'left'], ['jump', 'JUMP', 'jump'], ['light', 'LIGHT', 'light'], ['heavy', 'HEAVY', 'heavy'], ['special', 'SPECIAL', 'special'], ['dash', 'DASH', 'dash'], ['overclock', 'OVERCLOCK', 'overclock']];
  const CARD_X = [60, 240, 420, 600, 780];
  const SETTING_KEYS = ['master', 'music', 'sfx', 'screenShake', 'showHitboxes', null, null];
  const MAP_S = 40;                    // map px per screen (DESIGN §12.12)
  const DIM = 'rgba(10,8,12,0.6)';
  const GAMEOVER_BG = '#07050A', TROUGH = '#2A2230', UNVISITED = '#1A1620', BOSS_TROUGH = '#2A1A24', BOSS_TROUGH2 = '#3A1020';

  // --- caches ------------------------------------------------------------------------------------------
  const widthCache = Object.create(null);    // font → str → width
  const spacedCache = Object.create(null);   // font → str → Float32Array advances (last = total)
  const wrapCache = Object.create(null);     // font → str → lines[]
  const upperCache = Object.create(null);    // str → STR
  const measure = Rn.makeCanvas(8, 8).getContext('2d');   // measuring context for text wrapped outside a draw
  let gradBoss1 = null, gradBoss2 = null, hatchPattern = null;
  let logoCanvas = null, logoScan = null, logoDpr = 0, victoryTitle = null;

  function textW(ctx, str, font) {
    let m = widthCache[font]; if (!m) m = widthCache[font] = Object.create(null);
    let w = m[str];
    if (w === undefined) { ctx.font = font; w = m[str] = ctx.measureText(str).width; }
    return w;
  }
  function wrapped(str, font, maxW) {
    let m = wrapCache[font]; if (!m) m = wrapCache[font] = Object.create(null);
    let lines = m[str];
    if (!lines) { measure.font = font; lines = m[str] = U.wrapText(measure, str, maxW); }
    return lines;
  }
  function upper(str) { let u = upperCache[str]; if (!u) u = upperCache[str] = String(str).toUpperCase(); return u; }
  function hexagon(ctx, x, y, r) { ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; if (i) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + r, y); } ctx.closePath(); }
  function diamond(ctx, x, y, r) { ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }

  const UI = {
    t: 0,
    sel: 0, ynSel: 0,                        // menu index / yes-no cursor (0 = NO)
    confirmQuit: false, confirmReset: false, confirmNew: false,
    fromTitle: false, pauseSel: -1,
    mapPan: { x: 0, y: 0 }, mapMin: { x: 0, y: 0 }, mapMax: { x: 0, y: 0 }, recentreReq: false,
    mapRoomLine: '', mapBestiary: '', mapBestiary2: '', mapCur: null,   // the map cursor room (null = the current room) + its footer lines (a long bestiary wraps to a 2nd row)
    mapFootFree: -1,            // free footer width between the legend and the hints (measured once)
    hudAlpha: 1,                // the hearts/energy/meter block fades while the fighter stands behind it (§12.1)
    toastT: 0, toastDur: 0, toast1: '', toast2: '', toastBottom: false,
    bannerT: 0, bannerDur: 0, banner1: '', banner2: '', banner2b: '', banner3: '', banner2Font: F.mono16,
    cardT: 0, cardDur: 0, cardName: '', cardSub: '',
    // HUD animation state
    plRef: null, lastHp: 0, lastEnergy: 0, energyShown: 0, ghostFrom: 0, ghostTo: 0, ghostT: 0,
    heartT: new Uint8Array(9), heartKind: new Uint8Array(9),
    bitsPop: 0, lastBits: -1, bitsStr: '0',
    bossRef: null, bossLine: '', bossName: '', bossSub: '', bossGhost: 0, bossLastHp: 0, bossHold: 0, bossShake: 0, bossPhase: 1,
    hintStr: '', hintKey: -1, dbgStr: '',
    lowPulse: 0,
    // select screen
    selPrev: -1, selSlide: 0, statNow: new Float32Array(4), cardFlash: 0, moveLines: Object.create(null),
    // shop / lore / victory
    shopLine: '', shopMsgT: 0, shopMsg: '', rwGreeted: false, loreT: 0,
    vicRows: [], epiOff: 0, epiScroll: 0, vicRowsAt: 0,
    saveSumRef: null, saveSum: '',
  };

  // =============================================================================================
  // drawing helpers (public: text, panel)
  // =============================================================================================
  UI.text = function (ctx, str, x, y, font, color, align, baseline, ink) {
    ctx.font = font; ctx.textAlign = align || 'left'; ctx.textBaseline = baseline || 'alphabetic';
    if (ink) { ctx.lineJoin = 'round'; ctx.strokeStyle = P.INK; ctx.lineWidth = ink; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  };
  /** PANEL fill + PANEL_EDGE stroke 3, radius 10, hand-drawn ±1 px vertex jitter seeded by the panel rect. */
  UI.panel = function (ctx, x, y, w, h) {
    const s = U.hash(x | 0, w | 0, h | 0, 3), r = 10;
    ctx.beginPath();
    ctx.moveTo(x + r + U.jitter(s, 0, 1), y + U.jitter(s, 1, 1));
    ctx.lineTo(x + w - r + U.jitter(s, 2, 1), y + U.jitter(s, 3, 1)); ctx.quadraticCurveTo(x + w, y, x + w + U.jitter(s, 4, 1), y + r + U.jitter(s, 5, 1));
    ctx.lineTo(x + w + U.jitter(s, 6, 1), y + h - r + U.jitter(s, 7, 1)); ctx.quadraticCurveTo(x + w, y + h, x + w - r + U.jitter(s, 8, 1), y + h + U.jitter(s, 9, 1));
    ctx.lineTo(x + r + U.jitter(s, 10, 1), y + h + U.jitter(s, 11, 1)); ctx.quadraticCurveTo(x, y + h, x + U.jitter(s, 12, 1), y + h - r + U.jitter(s, 13, 1));
    ctx.lineTo(x + U.jitter(s, 14, 1), y + r + U.jitter(s, 15, 1)); ctx.quadraticCurveTo(x, y, x + r + U.jitter(s, 0, 1), y + U.jitter(s, 1, 1));
    ctx.closePath();
    ctx.fillStyle = P.PANEL; ctx.fill();
    ctx.strokeStyle = P.PANEL_EDGE; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
  };
  /** Letter-spaced centred text (per-char advances cached per font+string). */
  function spaced(ctx, str, x, y, font, color, spacing, ink) {
    let m = spacedCache[font]; if (!m) m = spacedCache[font] = Object.create(null);
    let adv = m[str];
    const n = str.length;
    if (!adv) {
      ctx.font = font; adv = m[str] = new Float32Array(n + 1); let tot = 0;
      for (let i = 0; i < n; i++) { const w = ctx.measureText(str.charAt(i)).width; adv[i] = w; tot += w; }
      adv[n] = tot + spacing * (n - 1);
    }
    ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    let cx = x - adv[n] / 2;
    if (ink) {
      ctx.lineJoin = 'round'; ctx.strokeStyle = P.INK; ctx.lineWidth = ink;
      for (let i = 0; i < n; i++) { ctx.strokeText(str.charAt(i), cx, y); cx += adv[i] + spacing; }
      cx = x - adv[n] / 2;
    }
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) { ctx.fillText(str.charAt(i), cx, y); cx += adv[i] + spacing; }
  }
  /** Vertical menu list (DESIGN §12.9 style): selected = SELECT, scaled 1.06, ▶ marker nudging ±3 px. */
  function menuList(ctx, items, x, y, pitch, font, sel, disabled) {
    for (let i = 0; i < items.length; i++) {
      const on = i === sel, dis = disabled && disabled[i], iy = y + i * pitch;
      ctx.save();
      if (on) { ctx.translate(x, iy); ctx.scale(1.06, 1.06); ctx.translate(-x, -iy); }
      ctx.globalAlpha = dis ? 0.4 : (on ? 1 : 0.8);
      UI.text(ctx, items[i], x, iy, font, on ? P.SELECT : (dis ? P.PAPER_DIM : P.PAPER), 'center', 'middle', 3);
      if (on) UI.text(ctx, '▶', x - textW(ctx, items[i], font) / 2 - 26 + Math.sin(UI.t / 20 * TAU) * 3, iy, font, P.SELECT, 'center', 'middle', 3);
      ctx.restore();
    }
  }
  /** Small YES / NO dialog (quit, reset, overwrite). ynSel 0 = NO (default), 1 = YES. */
  function drawYesNo(ctx, l1, l2, ynSel) {
    UI.panel(ctx, 330, 400, 300, 110);
    UI.text(ctx, l1, 480, 426, F.mono12, P.PAPER, 'center', 'middle');
    if (l2) UI.text(ctx, l2, 480, 444, F.mono12, P.PAPER, 'center', 'middle');
    const nudge = Math.sin(UI.t / 20 * TAU) * 3;
    UI.text(ctx, TXT.yes, 430, 482, F.ui18b, ynSel === 1 ? P.SELECT : P.PAPER, 'center', 'middle', 3);
    UI.text(ctx, TXT.no, 530, 482, F.ui18b, ynSel === 0 ? P.SELECT : P.PAPER, 'center', 'middle', 3);
    UI.text(ctx, '▶', (ynSel === 1 ? 430 - 34 : 530 - 30) + nudge, 482, F.ui14b, P.SELECT, 'center', 'middle', 3);
  }
  /** Yes/No input: returns 'yes' | 'no' | null. */
  function navYesNo() {
    const st = In.state;
    if (In.repeat('left') || In.repeat('right')) { UI.ynSel = UI.ynSel ? 0 : 1; Au.sfx('menuMove'); }
    if (st.confirm.pressed) { Au.sfx(UI.ynSel ? 'menuConfirm' : 'menuBack'); return UI.ynSel ? 'yes' : 'no'; }
    if (st.back.pressed) { Au.sfx('menuBack'); return 'no'; }
    return null;
  }
  /** Up/Down with wrap over `n` items, skipping disabled ones. */
  function nav(n, disabled) {
    let moved = false;
    if (In.repeat('down')) { do { UI.sel = (UI.sel + 1) % n; } while (disabled && disabled[UI.sel]); moved = true; }
    if (In.repeat('up')) { do { UI.sel = (UI.sel + n - 1) % n; } while (disabled && disabled[UI.sel]); moved = true; }
    if (moved) Au.sfx('menuMove');
    return moved;
  }
  function bgZone() { return UB.World.zones.driftcache || UB.World.zones.debug; }
  /** Scrolling driftcache parallax (bg1 8 px/s, bg2 16 px/s), ambient motes, breathing fog, vignette (§12.9). */
  function drawMenuBackground(ctx, zone, dimAlpha) {
    Rn.drawBackground(ctx, zone, UI.t * (32 / 60), 0);
    ctx.save();
    ctx.fillStyle = P.PAPER;
    for (let i = 0; i < 18; i++) {
      const sp = 0.25 + (i % 4) * 0.08;
      const x = (i * 173 + UI.t * (0.15 + (i % 3) * 0.1)) % W, y = H - ((i * 131 + UI.t * sp) % (H + 60));
      ctx.globalAlpha = 0.07 + (i % 3) * 0.04;
      ctx.beginPath(); ctx.arc(x, y, 1.5 + (i % 2), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 0.67 + 0.33 * Math.sin(UI.t / 90 * TAU);
    ctx.fillStyle = zone.palette.fog; ctx.fillRect(0, 0, W, H);
    ctx.restore();
    Rn.drawVignette(ctx);
    if (dimAlpha) { ctx.save(); ctx.globalAlpha = dimAlpha; ctx.fillStyle = P.INK; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }
  /**
   * Logo treatment (§12.9) pre-rendered once into an offscreen canvas at the device pixel ratio:
   * ink strokeText lineWidth `ink`, LOGO_A→LOGO_B vertical gradient fill, PAPER chalk highlight.
   */
  function buildLogo(text, px, w, h, spacing, ink, dpr) {
    const c = Rn.makeCanvas(Math.ceil(w * dpr), Math.ceil(h * dpr)), g = c.getContext('2d');
    g.scale(dpr, dpr);
    g.font = UB.font(px, 'UI', true); g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineCap = 'round';
    let tot = 0;
    for (let i = 0; i < text.length; i++) tot += g.measureText(text.charAt(i)).width;
    tot += spacing * (text.length - 1);
    const grad = g.createLinearGradient(0, h / 2 - px / 2, 0, h / 2 + px / 2);
    grad.addColorStop(0, P.LOGO_A); grad.addColorStop(1, P.LOGO_B);
    let x = w / 2 - tot / 2;
    g.strokeStyle = P.INK; g.lineWidth = ink;
    for (let i = 0; i < text.length; i++) { g.strokeText(text.charAt(i), x, h / 2); x += g.measureText(text.charAt(i)).width + spacing; }
    x = w / 2 - tot / 2; g.fillStyle = grad;
    for (let i = 0; i < text.length; i++) { g.fillText(text.charAt(i), x, h / 2); x += g.measureText(text.charAt(i)).width + spacing; }
    x = w / 2 - tot / 2; g.globalAlpha = 0.6; g.strokeStyle = P.PAPER; g.lineWidth = 2;
    for (let i = 0; i < text.length; i++) { g.strokeText(text.charAt(i), x - 2, h / 2 - 2); x += g.measureText(text.charAt(i)).width + spacing; }
    return c;
  }
  function ensureLogo(game) {
    const dpr = game.dpr || 1;
    if (logoCanvas && logoDpr === dpr) return;
    logoDpr = dpr;
    logoCanvas = buildLogo(TXT.logo, 92, 700, 120, 6, 10, dpr);
    logoScan = Rn.makeCanvas(logoCanvas.width, logoCanvas.height);
    victoryTitle = buildLogo(TXT.victory, 40, 700, 70, 3, 6, dpr);
  }

  // =============================================================================================
  // public messaging + lifecycle
  // =============================================================================================
  UI.init = function (game) { UI.sel = 0; UI.lastBits = -1; UI.game = game; };
  /** Engine calls this whenever game.screen / game.overlay changes (reset selection + per-screen state). */
  UI.enter = function (name, game) {
    UI.sel = 0; UI.ynSel = 0; UI.confirmQuit = false; UI.confirmReset = false; UI.confirmNew = false;
    if (name === 'title') { if (game && game.hasSave()) UI.sel = 1; UI.saveSumRef = null; }
    else if (name === 'select' && game) {
      const ids = UB.Characters.list;
      for (let i = 0; i < ids.length; i++) if (ids[i].id === game.lastFighter) UI.sel = i;
      UI.selPrev = -1; UI.selSlide = 0; UI.cardFlash = 0;
      for (let i = 0; i < 4; i++) UI.statNow[i] = 0;
    } else if (name === 'play') { UI.hintKey = -1; syncHud(game); }
    else if (name === 'settings') UI.fromTitle = !!(game && game.screen === 'title');
    else if (name === 'pause') { if (UI.pauseSel >= 0) { UI.sel = UI.pauseSel; UI.pauseSel = -1; } }
    else if (name === 'map') { UI.mapPan.x = 0; UI.mapPan.y = 0; UI.recentreReq = false; if (game) mapSetup(game); }
    else if (name === 'shop' && game) {
      const sv = game.save.vendor;
      UI.shopMsgT = 0;
      if (sv.length >= VENDOR.length) UI.shopLine = TXT.vendorSoldOut;
      else if (game.level && game.level.room.zone === 'rootwell' && !UI.rwGreeted) { UI.shopLine = TXT.vendorFirstRw; UI.rwGreeted = true; }
      else UI.shopLine = TXT.vendorLines[Math.floor(game.rng() * TXT.vendorLines.length)];
      for (let i = 0; i < VENDOR.length; i++) if (sv.indexOf(VENDOR[i].id) < 0) { UI.sel = i; break; }   // first unsold row
    } else if (name === 'lore') UI.loreT = 0;
    else if (name === 'victory' && game && game.save) {
      const st = game.victoryStats();
      UI.vicRows.length = 0;
      UI.vicRows.push(st.fighter, st.time, String(st.deaths), String(st.bits), st.cores, st.rooms, String(st.enemies), st.bosses);
      UI.epiOff = 0; UI.epiScroll = 0;
    }
  };
  UI.toast = function (l1, l2, frames) {
    UI.toast1 = l1 || ''; UI.toast2 = l2 || ''; UI.toastDur = frames || 150; UI.toastT = UI.toastDur;
    UI.toastBottom = !UI.toast2;   // one-line system/boss toasts sit at the bottom (§15.8); zone toasts are the big centred kind
  };
  UI.banner = function (l1, l2, l3, frames) {
    UI.banner1 = l1 || ''; UI.banner2 = l2 || ''; UI.banner3 = l3 || '';
    const own = BANNER_TEXT[UI.banner1];
    if (own) { UI.banner2 = In.device === 'gamepad' ? own[1] : own[0]; if (!l3 || own[2]) UI.banner3 = own[2]; }
    measure.font = F.mono16;
    UI.banner2Font = measure.measureText(UI.banner2).width > 440 ? F.mono12 : F.mono16;
    UI.banner2b = '';
    if (UI.banner2Font === F.mono12) {   // still too wide for the 480 px panel: break it in two at the dash or the middle space
      measure.font = F.mono12;
      if (measure.measureText(UI.banner2).width > 440) {
        const s = UI.banner2;
        let cut = s.indexOf(' — ');
        if (cut < 0) { let best = -1; for (let i = 0; i < s.length; i++) if (s[i] === ' ' && (best < 0 || Math.abs(i - s.length / 2) < Math.abs(best - s.length / 2))) best = i; cut = best; }
        if (cut > 0) { UI.banner2b = s.slice(cut).replace(/^( — | )/, '').trim(); UI.banner2 = s.slice(0, cut).trim(); }
      }
    }
    UI.bannerDur = frames || 182; UI.bannerT = UI.bannerDur;
    const g = UI.game;
    if (g && g.level && g.cam) {   // 10 glitter from the panel corners (world space = screen + camera)
      const cx = g.cam.x, cy = g.cam.y;
      FX.burst('glitter', 240 + cx, 200 + cy, 3, { color: P.SELECT }); FX.burst('glitter', 720 + cx, 200 + cy, 3, { color: P.SELECT });
      FX.burst('glitter', 240 + cx, 320 + cy, 2, { color: P.SELECT }); FX.burst('glitter', 720 + cx, 320 + cy, 2, { color: P.SELECT });
    }
  };
  UI.bossCard = function (name, sub, frames) { UI.cardName = name || ''; UI.cardSub = sub || ''; UI.cardDur = frames || 150; UI.cardT = UI.cardDur; };
  UI.clearMessages = function () { UI.toastT = 0; UI.bannerT = 0; UI.cardT = 0; };

  /** Resync the HUD animation state to the live player (new game, continue, respawn). */
  function syncHud(game) {
    const pl = game ? game.player : null;
    UI.plRef = pl;
    if (!pl) return;
    UI.lastHp = pl.hp; UI.lastEnergy = pl.energy; UI.energyShown = pl.energy; UI.ghostT = 0;
    for (let i = 0; i < 9; i++) UI.heartT[i] = 0;
    UI.bossRef = null; UI.bossShake = 0;
  }
  /** Timers + HUD/select animation state; called every logic frame regardless of screen. */
  UI.tick = function (game) {
    UI.t++;
    // message timers freeze with the world while an overlay (pause/map/settings/shop/lore) is up in play: a boss card,
    // zone toast or banner resumes where it was, and the "Gamepad disconnected — paused" toast stays up while paused
    const frozen = game.screen === 'play' && !!game.overlay;
    if (!frozen) {
      if (UI.toastT > 0) UI.toastT--;
      if (UI.bannerT > 0) UI.bannerT--;
      if (UI.cardT > 0) UI.cardT--;
    }
    if (UI.bitsPop > 0) UI.bitsPop--;
    if (UI.cardFlash > 0) UI.cardFlash--;
    if (UI.selSlide > 0) UI.selSlide--;
    if (UI.ghostT > 0) UI.ghostT--;
    if (UI.bossShake > 0) UI.bossShake--;
    if (game.denyFlash > 0) game.denyFlash--;
    if (game.save && game.save.bits !== UI.lastBits) { if (UI.lastBits >= 0 && game.save.bits > UI.lastBits) UI.bitsPop = 10; UI.lastBits = game.save.bits; UI.bitsStr = String(game.save.bits); }
    const pl = game.player;
    if (pl !== UI.plRef) syncHud(game);
    if (pl) {
      const cam = game.cam;
      // hearts: lose = scale 1.4→1 over 8 f + 3 chips; gain = 0→1.2→1 over 12 f + 6 glitter (§12.1)
      if (pl.hp < UI.lastHp) {
        for (let i = Math.max(0, pl.hp); i < UI.lastHp && i < 9; i++) { UI.heartT[i] = 8; UI.heartKind[i] = 1; FX.burst('chip', 39 + i * 32 + cam.x, 36 + cam.y, 3, { color: P.HEART }); }
      } else if (pl.hp > UI.lastHp) {
        for (let i = Math.max(0, UI.lastHp); i < pl.hp && i < 9; i++) { UI.heartT[i] = 12; UI.heartKind[i] = 2; FX.burst('glitter', 39 + i * 32 + cam.x, 36 + cam.y, 6, { color: i >= pl.baseHp ? P.CORE_HEART : P.HEART }); }
      }
      UI.lastHp = pl.hp;
      for (let i = 0; i < 9; i++) if (UI.heartT[i] > 0) UI.heartT[i]--;
      // energy: eases at 0.25/frame; a spend leaves a PAPER ghost fading over 15 f (§12.2)
      if (UI.lastEnergy - pl.energy >= 5) { UI.ghostFrom = UI.ghostT > 0 ? Math.max(UI.ghostFrom, UI.lastEnergy) : UI.lastEnergy; UI.ghostTo = pl.energy; UI.ghostT = 15; }
      UI.lastEnergy = pl.energy;
      UI.energyShown += (pl.energy - UI.energyShown) * 0.25;
      // low-HP pulse + heartbeat (§11.3.5): a "lub" every 36 f, sfx at the peak, only in play
      const low = pl.hp <= (pl.maxHp >= 7 ? 2 : 1) && !pl.dead && pl.hp > 0;
      UI.lowPulse = low ? Math.pow(Math.max(0, Math.sin(UI.t / 36 * TAU)), 3) : 0;
      if (low && game.screen === 'play' && !game.overlay && UI.t % 36 === 9) Au.sfx('heartbeat', pl.x);
      // boss bar bookkeeping (§12.6): lost chunk lingers 20 f then shrinks; phase change shakes the bar
      const b = game.boss;
      if (b !== UI.bossRef) {
        UI.bossRef = b;
        if (b) { UI.bossName = b.name || ''; UI.bossSub = b.subtitle || ''; UI.bossGhost = b.hp; UI.bossLastHp = b.hp; UI.bossPhase = b.phase || 1; UI.bossHold = 0; }
      }
      if (b) {
        if (b.hp < UI.bossLastHp) UI.bossHold = 20;
        if (b.hp > UI.bossLastHp) UI.bossGhost = b.hp;              // refill (phase change)
        UI.bossLastHp = b.hp;
        if ((b.phase || 1) !== UI.bossPhase) { UI.bossPhase = b.phase || 1; UI.bossShake = 20; }
        if (UI.bossHold > 0) UI.bossHold--; else UI.bossGhost += (b.hp - UI.bossGhost) * 0.15;
      }
      // debug line (only built while hitboxes are shown; every 15 f)
      if (game.settings && game.settings.showHitboxes && game.level && (UI.t % 15) === 0) UI.dbgStr = 'fps ' + game.fps + '  ' + game.level.room.id + '  ' + pl.state + '  f' + game.frame;
    }
    // character select: stat bars ease 0.2/frame toward the hovered fighter (§12.10)
    if (game.screen === 'select') {
      const d = UB.Characters.list[UI.sel];
      if (d) {
        const tgt0 = d.hp / 6, tgt1 = d.run / 300, tgt2 = (d.jumpVel * d.jumpVel / (2 * d.gravity)) / 113.8, tgt3 = d.weight / 1.3;
        UI.statNow[0] += (tgt0 - UI.statNow[0]) * 0.2; UI.statNow[1] += (tgt1 - UI.statNow[1]) * 0.2;
        UI.statNow[2] += (tgt2 - UI.statNow[2]) * 0.2; UI.statNow[3] += (tgt3 - UI.statNow[3]) * 0.2;
      }
    }
    // victory epilogue scroll: 18 px/s once the stats have typed in (§12.16)
    if (game.screen === 'victory' && game.screenT > UI.vicRowsAt) UI.epiScroll += 18 / 60;
    // title: cache the CONTINUE sub-line (allocates only when the saved slot object changes)
    if (game.screen === 'title' && game.savedData !== UI.saveSumRef) { UI.saveSumRef = game.savedData; UI.saveSum = game.saveSummary() || ''; }
  };

  // =============================================================================================
  // menu input (DESIGN §2.5): up/down wrap, left/right adjust, confirm activates, back closes
  // =============================================================================================
  UI.update = function (game) {
    const s = game.overlay || game.screen;
    const st = In.state;
    if (s === 'title') {
      if (UI.confirmNew) { const r = navYesNo(); if (r === 'yes') game.toSelect(); else if (r === 'no') UI.confirmNew = false; return; }
      const disabled = TITLE_DISABLED; disabled[1] = !game.hasSave();
      nav(3, disabled);
      if (st.confirm.pressed) {
        Au.sfx('menuConfirm');
        if (UI.sel === 0) { if (game.hasSave()) { UI.confirmNew = true; UI.ynSel = 0; } else game.toSelect(); }
        else if (UI.sel === 1) game.continueGame();
        else game.openOverlay('settings');
      }
    } else if (s === 'select') {
      const n = UB.Characters.list.length;
      let moved = 0;
      if (In.repeat('right')) moved = 1; else if (In.repeat('left')) moved = -1;
      if (moved) { UI.selPrev = UI.sel; UI.selSlide = 8; UI.sel = (UI.sel + n + moved) % n; Au.sfx('menuMove'); }
      if (st.confirm.pressed) { Au.sfx('menuConfirm'); UI.cardFlash = 4; game.newGame(UB.Characters.list[UI.sel].id); }
      else if (st.back.pressed) { Au.sfx('menuBack'); game.toTitle(); }
    } else if (s === 'pause') {
      if (UI.confirmQuit) { const r = navYesNo(); if (r === 'yes') game.toTitle(); else if (r === 'no') { UI.confirmQuit = false; UI.sel = 3; } return; }
      nav(4);
      if (st.pause.pressed || st.back.pressed) { Au.sfx('menuBack'); game.closeOverlay(); return; }
      if (st.map.pressed) { UI.pauseSel = 1; game.openOverlay('map'); return; }
      if (st.confirm.pressed) {
        Au.sfx('menuConfirm');
        if (UI.sel === 0) game.closeOverlay();
        else if (UI.sel === 1) { UI.pauseSel = 1; game.openOverlay('map'); }
        else if (UI.sel === 2) { UI.pauseSel = 2; game.openOverlay('settings'); }
        else { UI.confirmQuit = true; UI.ynSel = 0; }
      }
    } else if (s === 'map') {
      if (st.map.pressed || st.back.pressed || st.pause.pressed) { Au.sfx('menuBack'); game.closeOverlay(); return; }
      // arrows / d-pad move the room cursor (key-repeat); the view pans to keep it centred (DESIGN §12.12, §15.11)
      let dx = 0, dy = 0;
      if (In.repeat('left')) dx = -1; else if (In.repeat('right')) dx = 1; else if (In.repeat('up')) dy = -1; else if (In.repeat('down')) dy = 1;
      if (dx || dy) mapMoveCursor(game, dx, dy);
      else {   // a held direction also pans the view freely (240 px/s) between cursor hops
        if (st.left.down) UI.mapPan.x += 4; if (st.right.down) UI.mapPan.x -= 4;
        if (st.up.down) UI.mapPan.y += 4; if (st.down.down) UI.mapPan.y -= 4;
      }
      if (st.confirm.pressed || UI.recentreReq) { UI.recentreReq = false; mapCursorTo(game, null); }
      UI.mapPan.x = U.clamp(UI.mapPan.x, UI.mapMin.x, UI.mapMax.x); UI.mapPan.y = U.clamp(UI.mapPan.y, UI.mapMin.y, UI.mapMax.y);
    } else if (s === 'settings') {
      const rows = UI.fromTitle ? 7 : 6;   // RESET SAVE only from the title; the last row is BACK
      if (UI.confirmReset) { const r = navYesNo(); if (r === 'yes') { game.resetSave(); UI.confirmReset = false; } else if (r === 'no') UI.confirmReset = false; return; }
      nav(rows);
      if (st.back.pressed || st.pause.pressed) { Au.sfx('menuBack'); game.closeOverlay(); return; }
      const sg = game.settings;
      const adj = (In.repeat('right') ? 1 : 0) - (In.repeat('left') ? 1 : 0);
      const key = SETTING_KEYS[UI.sel];
      if (UI.sel <= 2) { if (adj !== 0) { game.setSetting(key, U.clamp(sg[key] + adj, 0, 10)); Au.sfx('menuMove'); } }
      else if (UI.sel <= 4) { if (adj !== 0 || st.confirm.pressed) { game.setSetting(key, !sg[key]); Au.sfx('menuMove'); } }
      else if (UI.fromTitle && UI.sel === 5) { if (st.confirm.pressed) { Au.sfx('menuConfirm'); UI.confirmReset = true; UI.ynSel = 0; } }
      else if (st.confirm.pressed) { Au.sfx('menuBack'); game.closeOverlay(); }
    } else if (s === 'shop') {
      if (UI.shopMsgT > 0) UI.shopMsgT--;
      if (st.back.pressed || st.pause.pressed) { Au.sfx('menuBack'); game.closeOverlay(); return; }
      nav(VENDOR.length);
      if (st.confirm.pressed) {
        const r = game.buy(VENDOR[UI.sel].id);
        if (r === 'bought') { Au.sfx('vendorBuy'); UI.shopMsgT = 0; if (game.save.vendor.length >= VENDOR.length) UI.shopLine = TXT.vendorSoldOut; }
        else { Au.sfx('deny'); game.denyFlash = 6; if (r === 'poor') { UI.shopMsg = TXT.vendorPoor; UI.shopMsgT = 90; } }   // a SOLD row just refuses
      }
    } else if (s === 'lore') {
      UI.loreT++;
      if (UI.loreT >= 240 || (UI.loreT > 10 && In.anyPressed)) game.closeOverlay();
    } else if (s === 'gameover') {
      if (game.fadeT > 0 || game.screenT < 20) return;
      if (st.confirm.pressed || st.jump.pressed) { Au.sfx('restore'); game.respawnAtNode(); }
    } else if (s === 'victory') {
      if (game.screenT < UI.vicRowsAt) return;
      if (st.confirm.pressed) { Au.sfx('menuConfirm'); game.toTitle(); }
      else if (In.anyPressed) UI.epiOff += 20;   // any other key advances the epilogue a line
    }
  };
  const TITLE_DISABLED = [false, false, false];

  // =============================================================================================
  // HUD (DESIGN §12.1–12.8, §12.13)
  // =============================================================================================
  function heart(ctx, x, y, full, core, scale) {
    ctx.save(); ctx.translate(x, y); if (scale !== 1) ctx.scale(scale, scale);
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = P.INK;
    ctx.fillStyle = full ? (core ? P.CORE_HEART : P.HEART) : P.HEART_EMPTY;
    ctx.beginPath();
    if (core) { ctx.moveTo(0, -13); ctx.lineTo(12, 0); ctx.lineTo(0, 13); ctx.lineTo(-12, 0); ctx.closePath(); }
    else { ctx.moveTo(-14, -3); ctx.arc(-7, -3, 7, Math.PI, 0); ctx.arc(7, -3, 7, Math.PI, 0); ctx.lineTo(14, -3); ctx.lineTo(0, 12); ctx.closePath(); }
    ctx.fill(); ctx.stroke();
    if (full && !core) { ctx.globalAlpha = 0.45; ctx.fillStyle = P.PAPER; ctx.beginPath(); ctx.arc(-6, -6, 2.2, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function drawHearts(ctx, pl) {
    const lowPulse = UI.lowPulse;
    const n = Math.min(9, pl.maxHp);
    for (let i = 0; i < n; i++) {
      const full = i < pl.hp;
      let sc = full ? 1 + 0.08 * lowPulse : 1;
      const at = UI.heartT[i];
      if (at > 0) {
        if (UI.heartKind[i] === 1) sc = 1 + 0.4 * (at / 8);
        else { const k = 1 - at / 12; sc = k < 0.6 ? 1.2 * k / 0.6 : 1.2 - 0.2 * (k - 0.6) / 0.4; }
      }
      heart(ctx, 39 + i * 32, 35, full, i >= pl.baseHp, sc);
    }
  }
  function drawEnergy(ctx, game, pl) {
    const shake = game.denyFlash > 0 ? U.jitter(UI.t, 1, 2) : 0;
    const x = 24 + shake, y = 56, w = 180, h = 12, emax = pl.energyMax || 100;
    ctx.fillStyle = P.ENERGY_DIM; Rn.rrect(ctx, x, y, w, h, 6); ctx.fill();
    if (UI.ghostT > 0) {   // spent segment ghost (§12.2)
      const g0 = w * U.clamp(UI.ghostTo / emax, 0, 1), g1 = w * U.clamp(UI.ghostFrom / emax, 0, 1);
      if (g1 > g0) { ctx.save(); ctx.globalAlpha = UI.ghostT / 15; ctx.fillStyle = P.PAPER; Rn.rrect(ctx, x + Math.max(0, g0 - 3), y, g1 - Math.max(0, g0 - 3), h, 6); ctx.fill(); ctx.restore(); }
    }
    const ew = U.clamp(w * UI.energyShown / emax, 0, w);
    if (ew > 1) { ctx.fillStyle = game.denyFlash > 4 ? P.DANGER : P.ENERGY; Rn.rrect(ctx, x, y, ew, h, 6); ctx.fill(); }
    ctx.fillStyle = P.PAPER; const tick = w * 25 / emax;
    for (let tx = tick; tx < w - 1; tx += tick) ctx.fillRect(x + tx, y + 1, 1, h - 2);
    ctx.strokeStyle = P.INK; ctx.lineWidth = 3; Rn.rrect(ctx, x, y, w, h, 6); ctx.stroke();
    UI.text(ctx, TXT.energy, 24, 80, F.ui10b, P.PAPER_DIM);
  }
  function drawMeter(ctx, pl) {
    const x = 24, y = 88, w = 180, h = 8;
    const ready = pl.meter >= pl.meterMax && !pl.ocActive && !(pl.ocTransform > 0);
    const oc = pl.ocActive;
    ctx.fillStyle = P.METER_DIM; Rn.rrect(ctx, x, y, w, h, 4); ctx.fill();
    const frac = oc ? U.clamp(pl.overclock / 720, 0, 1) : U.clamp(pl.meter / pl.meterMax, 0, 1);
    const mw = w * frac;
    const blink = oc && pl.overclock < 180 && ((Math.floor(pl.overclock / 6)) & 1) === 1;
    if (mw > 1 && !blink) {
      ctx.save();
      if (ready) { ctx.shadowBlur = 12; ctx.shadowColor = P.METER; }
      ctx.fillStyle = oc ? pl.data.ocPalette.glow : P.METER; Rn.rrect(ctx, x, y, mw, h, 4); ctx.fill();
      ctx.restore();
    }
    if (ready) {   // travelling highlight band every 45 f
      ctx.save(); ctx.beginPath(); Rn.rrect(ctx, x, y, w, h, 4); ctx.clip();
      ctx.globalAlpha = 0.5; ctx.fillStyle = P.METER_READY; ctx.fillRect(x - 24 + ((UI.t % 45) / 45) * (w + 24), y, 24, h);
      ctx.restore();
    }
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; Rn.rrect(ctx, x, y, w, h, 4); ctx.stroke();
    if (oc) UI.text(ctx, TXT.ocOn, 24, 108, F.ui10b, pl.data.ocPalette.glow);
    else if (ready) {
      ctx.save(); ctx.globalAlpha = 0.8 + 0.2 * Math.sin(UI.t / 30 * TAU);
      ctx.font = F.ui10b; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = P.SELECT;
      ctx.fillText(TXT.ocReady, 24, 108);
      const gx = 24 + textW(ctx, TXT.ocReady, F.ui10b);
      ctx.fillText(In.glyph('overclock'), gx, 108);
      ctx.fillText(']', gx + textW(ctx, In.glyph('overclock'), F.ui10b), 108);
      ctx.restore();
    } else UI.text(ctx, TXT.ocLabel, 24, 108, F.ui10b, P.PAPER_DIM);
  }
  function drawBits(ctx) {
    const pop = UI.bitsPop > 0 ? 1 + 0.3 * (UI.bitsPop / 10) : 1;
    ctx.save(); ctx.translate(896, 32); ctx.scale(pop, pop);
    ctx.fillStyle = P.BITS; ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    hexagon(ctx, 0, 0, 8); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(884, 32); ctx.scale(pop, pop);
    UI.text(ctx, UI.bitsStr, 0, 0, F.mono20b, P.PAPER, 'right', 'middle', 3);
    ctx.restore();
  }
  function drawBossBar(ctx, game) {
    const b = game.boss, bf = game.bossFight;
    if (!b || bf.state === 'none' || bf.state === 'done') return;
    let k = 1;
    if (bf.state === 'intro') k = U.clamp((30 - bf.timer) / 30, 0, 1);   // draws out from the centre over f120–150
    if (k <= 0) return;
    const sx = UI.bossShake > 0 ? U.jitter(UI.t, 3, 3) : 0;
    const bw = 600 * k, bx = 480 - bw / 2 + sx, by = 486;
    const phase2 = (b.phase || 1) >= 2;
    ctx.fillStyle = phase2 ? BOSS_TROUGH2 : BOSS_TROUGH; Rn.rrect(ctx, bx, by, bw, 30, 8); ctx.fill();
    const maxHp = b.maxHp || 1;
    const fillW = U.clamp(596 * b.hp / maxHp, 0, 596) * k, ghostW = U.clamp(596 * UI.bossGhost / maxHp, 0, 596) * k;
    if (ghostW > fillW + 0.5) { ctx.fillStyle = P.PAPER; Rn.rrect(ctx, bx + 2, by + 2, ghostW, 26, 6); ctx.fill(); }
    if (fillW > 1) {
      if (!gradBoss1) {   // built once in bar-local space (0..596); the bar is translated into place
        gradBoss1 = ctx.createLinearGradient(0, 0, 596, 0); gradBoss1.addColorStop(0, P.DANGER); gradBoss1.addColorStop(1, '#FF8A5C');
        gradBoss2 = ctx.createLinearGradient(0, 0, 596, 0); gradBoss2.addColorStop(0, '#FF3B5C'); gradBoss2.addColorStop(1, P.METER);
      }
      ctx.save(); ctx.translate(bx, 0); ctx.fillStyle = phase2 ? gradBoss2 : gradBoss1; Rn.rrect(ctx, 2, by + 2, fillW, 26, 6); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = P.PAPER; for (let i = 1; i < 10; i++) ctx.fillRect(bx + i * bw / 10, by + 2, 1, 26); ctx.restore();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 3; Rn.rrect(ctx, bx, by, bw, 30, 8); ctx.stroke();
    // name · subtitle (§12.6)
    ctx.save(); ctx.globalAlpha = k;
    if (UI.bossSub) {
      const nw = textW(ctx, UI.bossName, F.ui18b), sw = textW(ctx, UI.bossSub, F.mono12), dw = textW(ctx, ' · ', F.mono12);
      const x0 = 480 - (nw + dw + sw) / 2;
      UI.text(ctx, UI.bossName, x0, 476, F.ui18b, P.PAPER, 'left', 'alphabetic', 3);
      UI.text(ctx, ' · ', x0 + nw, 476, F.mono12, P.PAPER_DIM, 'left', 'alphabetic', 3);
      UI.text(ctx, UI.bossSub, x0 + nw + dw, 476, F.mono12, P.PAPER_DIM, 'left', 'alphabetic', 3);
    } else UI.text(ctx, UI.bossName, 480, 476, F.ui18b, P.PAPER, 'center', 'alphabetic', 3);
    ctx.restore();
  }
  function drawToast(ctx, game) {
    if (UI.toastT <= 0) return;
    const e = UI.toastDur - UI.toastT;
    let a = 1, dy = 0;
    if (e < 20) { a = e / 20; dy = 10 * (1 - a); } else if (UI.toastT < 30) a = UI.toastT / 30;
    ctx.save(); ctx.globalAlpha = a;
    if (UI.toastBottom) {   // one-line toast ({NAME} PURGED, storage warnings): bottom centre
      UI.text(ctx, UI.toast1, 480, 440 + dy, F.ui18b, P.PAPER, 'center', 'middle', 3);
    } else {
      spaced(ctx, UI.toast1, 480, 150 + dy, F.ui34b, P.PAPER, 2, 4);
      if (UI.toast2) UI.text(ctx, UI.toast2, 480, 184 + dy, F.mono16, P.PAPER_DIM, 'center', 'middle', 3);
      ctx.strokeStyle = game.zone ? game.zone.palette.tileEdge : P.PAPER; ctx.lineWidth = 2;
      const rw = 260 * U.easeOutCubic(Math.min(1, e / 20));
      ctx.beginPath(); ctx.moveTo(480 - rw / 2, 168 + dy); ctx.lineTo(480 + rw / 2, 168 + dy); ctx.stroke();
    }
    ctx.restore();
  }
  function drawBanner(ctx) {
    if (UI.bannerT <= 0) return;
    const e = UI.bannerDur - UI.bannerT;
    let a = 1, y = 200;
    if (e < 12) { const k = U.easeOutCubic(e / 12); a = k; y = 170 + 30 * k; } else if (UI.bannerT < 20) a = UI.bannerT / 20;
    ctx.save(); ctx.globalAlpha = a;
    UI.panel(ctx, 240, y, 480, 120);
    UI.text(ctx, UI.banner1, 480, y + 36, F.ui26b, P.SELECT, 'center', 'middle', 3);
    if (UI.banner2b) {
      UI.text(ctx, UI.banner2, 480, y + 60, UI.banner2Font, P.PAPER, 'center', 'middle');
      UI.text(ctx, UI.banner2b, 480, y + 75, UI.banner2Font, P.PAPER, 'center', 'middle');
      UI.text(ctx, UI.banner3, 480, y + 100, F.mono13, P.PAPER_DIM, 'center', 'middle');
    } else {
      UI.text(ctx, UI.banner2, 480, y + 68, UI.banner2Font, P.PAPER, 'center', 'middle');
      UI.text(ctx, UI.banner3, 480, y + 96, F.mono13, P.PAPER_DIM, 'center', 'middle');
    }
    ctx.restore();
  }
  /** Boss title card (§12.13): INK band y 190–270 slides in from the left over 12 f, exits upward over 10 f. */
  function drawBossCard(ctx) {
    if (UI.cardT <= 0) return;
    const e = UI.cardDur - UI.cardT;
    let x = 0, a = 1, dy = 0;
    if (e < 12) x = -W * (1 - U.easeOutCubic(e / 12)); else if (UI.cardT < 10) { a = UI.cardT / 10; dy = -80 * (1 - a); }
    ctx.save();
    ctx.globalAlpha = 0.8 * a; ctx.fillStyle = P.INK; ctx.fillRect(x, 190 + dy, W, 80);
    ctx.globalAlpha = a;
    spaced(ctx, UI.cardName, 480 + x, 222 + dy, F.ui36b, P.DANGER, 4, 0);
    UI.text(ctx, UI.cardSub, 480 + x, 254 + dy, F.mono14, P.PAPER, 'center', 'middle');
    ctx.restore();
  }
  function drawHints(ctx, game, pl) {
    const save = game.save;
    if (save.visited.length > 3) return;
    const hs = save.hints;
    let key = In.device === 'gamepad' ? 1 : (In.device === 'touch' ? 2 : 0);   // numeric cache key: device + pending bitmask + optional items
    for (let i = 0; i < HINT_ORDER.length; i++) key = key * 2 + (hs[HINT_ORDER[i][0]] ? 1 : 0);
    key = key * 2 + (pl.abilities.burstLine ? 1 : 0); key = key * 2 + (pl.meter >= pl.meterMax ? 1 : 0);
    if (key !== UI.hintKey) {
      UI.hintKey = key; let str = '';
      for (let i = 0; i < HINT_ORDER.length; i++) {
        const hk = HINT_ORDER[i][0];
        if (hs[hk]) continue;
        if (hk === 'dash' && !pl.abilities.burstLine) continue;
        if (hk === 'overclock' && pl.meter < pl.meterMax) continue;
        const glyph = hk === 'move' ? (In.device === 'gamepad' ? 'stick' : In.glyph('left') + In.glyph('right')) : In.glyph(HINT_ORDER[i][2]);
        str += (str ? '  ' : '') + HINT_ORDER[i][1] + ' ' + glyph;
      }
      UI.hintStr = str;
    }
    if (UI.hintStr) UI.text(ctx, UI.hintStr, 24, 520, F.mono13, P.PAPER_DIM, 'left', 'middle', 3);
  }
  /** A toast drawn by drawScreen (above everything) rather than the HUD: any toast outside play, bottom toasts over an overlay. */
  function toastOnTop(game) { return game.screen !== 'play' || (!!game.overlay && UI.toastBottom); }
  UI.drawHUD = function (ctx, game) {
    const pl = game.player; if (!pl) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // the hearts/energy/meter block (24..210 × 22..115) dims while the fighter's body is behind it (top-left arrivals)
    const cam = game.cam, bx = pl.x - pl.w / 2 - cam.x, by = pl.y - pl.h - cam.y;
    const behind = bx < 210 && bx + pl.w > 24 && by < 115 && by + pl.h > 22;
    UI.hudAlpha = U.approach(UI.hudAlpha, behind ? 0.35 : 1, 0.08);
    if (UI.hudAlpha < 1) ctx.globalAlpha = UI.hudAlpha;
    drawHearts(ctx, pl);
    drawEnergy(ctx, game, pl);
    drawMeter(ctx, pl);
    ctx.globalAlpha = 1;
    drawBits(ctx);
    if (game.prompt) {   // ▲ REST / ▲ TRADE floating above the object, bobbing 2 px, with the bound key (§12.8)
      const bob = Math.sin(UI.t / 15) * 2, py = game.prompt.y - 24 + bob;
      UI.text(ctx, TXT.prompt[game.prompt.text] || game.prompt.text, game.prompt.x, py, F.ui14b, P.PAPER, 'center', 'middle', 3);
      UI.text(ctx, In.glyph('up'), game.prompt.x, py + 15, F.mono11, P.PAPER_DIM, 'center', 'middle', 2);
    }
    drawBossBar(ctx, game);
    if (!toastOnTop(game)) drawToast(ctx, game);
    drawBanner(ctx);
    drawBossCard(ctx);
    if (pl.hp <= (pl.maxHp >= 7 ? 2 : 1) && pl.hp > 0 && !pl.dead) FX.drawLowHp(ctx, UI.lowPulse);
    const bossBar = game.boss && game.bossFight.state !== 'none' && game.bossFight.state !== 'done';
    if (!bossBar) drawHints(ctx, game, pl);   // the strip shares the bottom edge with the boss bar
    if (game.settings.showHitboxes && UI.dbgStr) UI.text(ctx, UI.dbgStr, 8, 536, F.mono11, P.PAPER_DIM);
    ctx.restore();
  };

  // =============================================================================================
  // full screens: title, select, game over, victory (DESIGN §12.9, §12.10, §12.15, §12.16)
  // =============================================================================================
  function drawTitle(ctx, game) {
    ensureLogo(game);
    drawMenuBackground(ctx, bgZone(), 0);
    // logo: 2 px bob over 3 s, 0.5° rock, scan band every 240 f over 20 f (clipped to the glyphs via the mask)
    ctx.save();
    ctx.translate(480, 170 + Math.sin(UI.t / 180 * TAU) * 2); ctx.rotate(Math.sin(UI.t / 180 * TAU + 1) * 0.5 * U.DEG);
    ctx.drawImage(logoCanvas, -350, -60, 700, 120);
    const scan = UI.t % 240;
    if (scan < 20) {
      const g = logoScan.getContext('2d'), dpr = logoDpr;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, logoScan.width, logoScan.height);
      g.globalAlpha = 0.35; g.fillStyle = P.PAPER; g.fillRect(0, (120 * scan / 20 - 7) * dpr, logoScan.width, 14 * dpr); g.globalAlpha = 1;
      g.globalCompositeOperation = 'destination-in'; g.drawImage(logoCanvas, 0, 0); g.globalCompositeOperation = 'source-over';
      ctx.drawImage(logoScan, -350, -60, 700, 120);
    }
    ctx.restore();
    UI.text(ctx, TXT.tagline, 480, 232, F.mono18, P.PAPER_DIM, 'center', 'middle', 3);
    const disabled = TITLE_DISABLED; disabled[1] = !game.hasSave();
    menuList(ctx, TXT.titleMenu, 480, 320, 44, F.ui24b, UI.confirmNew ? -1 : UI.sel, disabled);
    if (game.hasSave()) UI.text(ctx, UI.saveSum, 480, 386, F.mono12, P.PAPER_DIM, 'center', 'middle', 2);
    else { ctx.save(); ctx.globalAlpha = 0.6; UI.text(ctx, TXT.noSave, 480, 386, F.mono12, P.PAPER_DIM, 'center', 'middle', 2); ctx.restore(); }
    if (!In.gestured && ((UI.t / 30) | 0) % 2 === 0) UI.text(ctx, TXT.pressAny, 480, 470, F.ui14b, P.SELECT, 'center', 'middle', 3);
    UI.text(ctx, TXT.footer, 480, 516, F.mono11, P.PAPER_DIM, 'center', 'middle', 2);
    UI.text(ctx, TXT.version, 944, 528, F.mono11, P.PAPER_DIM, 'right', 'middle', 2);
    if (UI.confirmNew) drawYesNo(ctx, TXT.overwrite, '', UI.ynSel);
  }
  function statBar(ctx, i, label, v) {
    const y = 160 + i * 30;
    UI.text(ctx, label, 580, y, F.ui13b, P.PAPER, 'left', 'middle');
    ctx.fillStyle = TROUGH; Rn.rrect(ctx, 680, y - 5, 220, 10, 5); ctx.fill();
    const w = 220 * U.clamp(v, 0.04, 1);
    ctx.fillStyle = P.SELECT; Rn.rrect(ctx, 680, y - 5, w, 10, 5); ctx.fill();
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; Rn.rrect(ctx, 680, y - 5, 220, 10, 5); ctx.stroke();
  }
  function moveLinesFor(d) {
    let ml = UI.moveLines[d.id];
    if (!ml) {
      const m = d.moves;
      ml = UI.moveLines[d.id] = [
        TXT.moveLabels[0] + m.light1.name + ' / ' + m.light2.name + ' / ' + m.light3.name,
        TXT.moveLabels[1] + m.heavy.name + TXT.moveLabels[2] + m.special.name,
        TXT.moveLabels[3] + m.ultimate.name];
    }
    return ml;
  }
  function drawPreviewRig(ctx, d, x, alpha, t) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.fillStyle = d.palette.glow; ctx.globalAlpha = 0.10 * alpha; ctx.beginPath(); ctx.arc(x, 202, 110, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.35 * alpha; ctx.fillStyle = P.INK; ctx.beginPath(); ctx.ellipse(x, 300, 60, 7, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = alpha;
    UB.Characters.drawPreview(ctx, d.id, x, 300, 3, t, true);   // showcase: a pose every 180 f (DESIGN §12.10)
    ctx.restore();
  }
  function drawSelect(ctx, game) {
    const list = UB.Characters.list;
    drawMenuBackground(ctx, bgZone(), 0.25);
    UI.text(ctx, TXT.selectHeader, 480, 48, F.ui30b, P.PAPER, 'center', 'middle', 3);
    UI.text(ctx, TXT.selectSub, 480, 74, F.mono13, P.PAPER_DIM, 'center', 'middle', 2);
    const d = list[UI.sel]; if (!d) return;
    // big preview (§12.10): the old rig slides out 40 px and fades over 8 f while the new slides in
    if (UI.selSlide > 0 && UI.selPrev >= 0 && list[UI.selPrev]) {
      const k = UI.selSlide / 8;
      drawPreviewRig(ctx, list[UI.selPrev], 300 - 40 * (1 - k), k, UI.t);
      drawPreviewRig(ctx, d, 300 + 40 * k, 1 - k, UI.t);
    } else drawPreviewRig(ctx, d, 300, 1, UI.t);
    // stat panel (560,130) 360×150
    UI.panel(ctx, 560, 130, 360, 150);
    for (let i = 0; i < 4; i++) statBar(ctx, i, TXT.statLabels[i], UI.statNow[i]);
    // moveset panel (560,292) 360×72
    UI.panel(ctx, 560, 292, 360, 72);
    const ml = moveLinesFor(d);
    for (let i = 0; i < 3; i++) UI.text(ctx, ml[i], 576, 312 + i * 20, F.mono12, P.PAPER, 'left', 'middle');
    // bio — the §15.3 paragraphs run 4 lines at 11px over 490 px: y 322..361, under the preview halo (bottom 312)
    // and above the lifted card (top 373)
    const bio = wrapped(d.bio || '', F.mono11, 490);
    for (let i = 0; i < bio.length && i < 4; i++) UI.text(ctx, bio[i], 60, 322 + i * 13, F.mono11, P.PAPER_DIM, 'left', 'middle');
    // five cards, y 380..490
    for (let i = 0; i < list.length && i < 5; i++) {
      const f = list[i], on = i === UI.sel, x = CARD_X[i], y = 380;
      ctx.save();
      if (on) { ctx.translate(x + 75, y + 55 - 4); ctx.scale(1.05, 1.05); ctx.translate(-(x + 75), -(y + 55)); }
      else ctx.globalAlpha = 0.75;
      UI.panel(ctx, x, y, 150, 110);
      if (on) { ctx.strokeStyle = P.SELECT; ctx.lineWidth = 3; Rn.rrect(ctx, x, y, 150, 110, 10); ctx.stroke(); }
      if (on && UI.cardFlash > 0) { ctx.globalAlpha = UI.cardFlash / 4; ctx.fillStyle = P.PAPER; Rn.rrect(ctx, x, y, 150, 110, 10); ctx.fill(); ctx.globalAlpha = 1; }
      UI.text(ctx, upper(f.name), x + 75, y + 22, F.ui16b, on ? P.SELECT : P.PAPER, 'center', 'middle', 3);
      UI.text(ctx, f.title || '', x + 75, y + 40, F.mono11, P.PAPER_DIM, 'center', 'middle');
      UB.Characters.drawPreview(ctx, f.id, x + 75, y + 78 + f.box.h * 0.45, 0.9, UI.t + i * 17);
      ctx.restore();
    }
  }
  function drawGameOver(ctx, game) {
    ctx.fillStyle = GAMEOVER_BG; ctx.fillRect(0, 0, W, H);
    const e = game.screenT;
    ctx.save(); ctx.globalAlpha = U.clamp(e / 20, 0, 1);
    UI.text(ctx, TXT.gameOver, 480, 240, F.ui44b, P.DANGER, 'center', 'middle', 3);
    UI.text(ctx, TXT.gameOverSub, 480, 290, F.mono14, P.PAPER_DIM, 'center', 'middle');
    if (e > 20 && ((e / 30) | 0) % 2 === 0) UI.text(ctx, TXT.gameOverPrompt, 480, 400, F.ui16b, P.SELECT, 'center', 'middle', 3);
    ctx.restore();
  }
  function drawVictory(ctx, game) {
    ensureLogo(game);
    const zone = UB.World.zones.rootwell || bgZone();
    Rn.drawBackground(ctx, zone, UI.t * 0.3, 20);
    ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = GAMEOVER_BG; ctx.fillRect(0, 0, W, H); ctx.restore();
    Rn.drawVignette(ctx);
    ctx.drawImage(victoryTitle, 130, 75, 700, 70);
    UI.panel(ctx, 280, 150, 400, 250);
    const rows = UI.vicRows;
    for (let i = 0; i < rows.length; i++) {   // each row types in over 12 f after the previous (clip reveal)
      const k = U.clamp((game.screenT - i * 12) / 12, 0, 1);
      if (k <= 0) break;
      const y = 180 + i * 26;
      ctx.save(); ctx.beginPath(); ctx.rect(290, y - 12, 380 * k, 24); ctx.clip();
      UI.text(ctx, TXT.victoryRows[i], 300, y, F.mono16, P.PAPER_DIM, 'left', 'middle');
      UI.text(ctx, rows[i], 660, y, F.mono16, P.PAPER, 'right', 'middle');
      ctx.restore();
    }
    if (game.screenT >= UI.vicRowsAt) {   // epilogue scroll (§15.7): 14px MONO centred, from y 410 at 18 px/s
      const lines = TXT.epilogue, lh = 20;
      let off = UI.epiScroll + UI.epiOff;
      const maxOff = lines.length * lh - 60;
      if (off > maxOff) off = maxOff;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 406, W, 96); ctx.clip();
      for (let i = 0; i < lines.length; i++) {
        const y = 420 + i * lh - off;
        if (y < 396 || y > 512) continue;
        ctx.globalAlpha = y < 416 ? U.clamp((y - 400) / 16, 0, 1) : (y > 490 ? U.clamp((502 - y) / 12, 0, 1) : 1);
        UI.text(ctx, lines[i], 480, y, F.mono14, P.PAPER, 'center', 'middle', 2);
      }
      ctx.restore();
      if (((game.screenT / 30) | 0) % 2 === 0) UI.text(ctx, TXT.victoryPrompt, 480, 522, F.ui14b, P.SELECT, 'center', 'middle', 3);
    }
  }
  UI.vicRowsAt = 8 * 12 + 12;

  // =============================================================================================
  // overlays: pause, map, settings, shop, lore (DESIGN §12.11, §12.12, §12.14, §12.17, §12.18)
  // =============================================================================================
  function dim(ctx) { ctx.fillStyle = DIM; ctx.fillRect(0, 0, W, H); }
  function drawPause(ctx) {
    dim(ctx);
    UI.panel(ctx, 330, 150, 300, 240);
    UI.text(ctx, TXT.paused, 480, 186, F.ui24b, P.PAPER, 'center', 'middle', 3);
    menuList(ctx, TXT.pauseMenu, 480, 226, 40, F.ui18b, UI.confirmQuit ? -1 : UI.sel);
    if (UI.confirmQuit) drawYesNo(ctx, TXT.quit1, TXT.quit2, UI.ynSel);
  }
  /** Map setup on open: pan limits so the whole discovered graph can be reached, the footer room line. */
  function mapSetup(game) {
    const rooms = UB.World.rooms, save = game.save, cur = game.level ? game.level.room : null;
    if (!MAP_ROOMS) { MAP_ROOMS = []; for (const id in rooms) MAP_ROOMS.push(rooms[id]); }
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9, any = false;
    for (let i = 0; i < MAP_ROOMS.length; i++) {
      const r = MAP_ROOMS[i], id = r.id;
      if (save.discovered.indexOf(id) < 0 || (r.debug && !(cur && cur.debug))) continue;
      any = true;
      if (r.gx < minx) minx = r.gx; if (r.gy < miny) miny = r.gy;
      if (r.gx + r.gw > maxx) maxx = r.gx + r.gw; if (r.gy + r.gh > maxy) maxy = r.gy + r.gh;
    }
    if (!any || !cur) { UI.mapMin.x = UI.mapMin.y = UI.mapMax.x = UI.mapMax.y = 0; }
    else {
      const cx = (cur.gx + cur.gw / 2) * MAP_S, cy = (cur.gy + cur.gh / 2) * MAP_S;
      // pan range: the graph may be dragged until only 60 px of it remain inside the panel (24..936 × 70..490)
      UI.mapMin.x = Math.min(0, 84 - 480 - (maxx * MAP_S - cx)); UI.mapMax.x = Math.max(0, 876 - 480 - (minx * MAP_S - cx));
      UI.mapMin.y = Math.min(0, 130 - 270 - (maxy * MAP_S - cy)); UI.mapMax.y = Math.max(0, 430 - 270 - (miny * MAP_S - cy));
    }
    mapCursorTo(game, null);
  }
  const VARIANT_NAMES = { brinecrab: 'Brinecrab', staticshot: 'Static-shot', rootbound: 'Rootbound', dripnode: 'Dripnode', nullnode: 'Nullnode', rootwisp: 'Rootwisp', acidvalve: 'Acid Valve', twinvalve: 'Twin Valve', rootram: 'Rootram', rootplate: 'Rootplate' };
  const bestiaryTmp = [];
  /** Point the map cursor at `room` (null = the current room): the view centres on it; footer lines rebuilt (DESIGN §12.12, §15.11). */
  function mapCursorTo(game, room) {
    const cur = game.level ? game.level.room : null, save = game.save;
    const r = room || cur;
    UI.mapCur = room;
    if (!r || !cur) { UI.mapRoomLine = ''; UI.mapBestiary = ''; UI.mapBestiary2 = ''; UI.mapPan.x = 0; UI.mapPan.y = 0; return; }
    UI.mapPan.x = room ? ((cur.gx + cur.gw / 2) - (r.gx + r.gw / 2)) * MAP_S : 0;
    UI.mapPan.y = room ? ((cur.gy + cur.gh / 2) - (r.gy + r.gh / 2)) * MAP_S : 0;
    UI.mapPan.x = U.clamp(UI.mapPan.x, UI.mapMin.x, UI.mapMax.x); UI.mapPan.y = U.clamp(UI.mapPan.y, UI.mapMin.y, UI.mapMax.y);
    const visited = save.visited.indexOf(r.id) >= 0;
    UI.mapRoomLine = visited ? r.name : '?';
    let line = '';
    if (r.boss && UB.Bosses.DATA[r.boss.id] && (visited || game.hasDeepPing())) {
      const bd = UB.Bosses.DATA[r.boss.id];
      line = bd.name + (bd.subtitle ? ' · ' + bd.subtitle : '') + (save.bossesDefeated.indexOf(r.boss.id) >= 0 ? ' · purged' : '');
    } else if (visited && r.spawns.length) {
      bestiaryTmp.length = 0;
      for (let i = 0; i < r.spawns.length; i++) {
        const sp = r.spawns[i], t = UB.Enemies.TYPES[sp.type];
        const nm = sp.variant && VARIANT_NAMES[sp.variant] ? VARIANT_NAMES[sp.variant] : (t ? t.name : sp.type);
        if (bestiaryTmp.indexOf(nm) < 0) bestiaryTmp.push(nm);
      }
      line = bestiaryTmp.join(' · ');
    } else if (visited) line = 'no enemies';
    // fit the line between the legend and the "R recentre · Esc / M close" hints: a long roster wraps at a ' · ' to a 2nd row
    measure.font = F.mono11;
    if (UI.mapFootFree < 0) {
      const legendR = 60 + measure.measureText(TXT.mapLegend).width;
      const rightL = 900 - measure.measureText(TXT.mapClose).width - 18 - measure.measureText(TXT.mapRecentre).width;
      UI.mapFootFree = rightL - legendR - 24;
    }
    UI.mapBestiary2 = '';
    if (measure.measureText(line).width > UI.mapFootFree) {
      let best = -1, bestD = 1e9, i = line.indexOf(' · ');
      while (i >= 0) { const dd = Math.abs(i - line.length / 2); if (dd < bestD) { bestD = dd; best = i; } i = line.indexOf(' · ', i + 3); }
      if (best > 0) { UI.mapBestiary2 = line.slice(best + 3); line = line.slice(0, best); }
    }
    UI.mapBestiary = line;
  }
  /** Move the cursor to the nearest discovered room in the direction (dx, dy). */
  function mapMoveCursor(game, dx, dy) {
    const cur = game.level ? game.level.room : null, save = game.save;
    const from = UI.mapCur || cur; if (!from) return;
    const fx = from.gx + from.gw / 2, fy = from.gy + from.gh / 2;
    let best = null, bestD = 1e9;
    for (let i = 0; i < MAP_ROOMS.length; i++) {
      const r = MAP_ROOMS[i];
      if (r === from || save.discovered.indexOf(r.id) < 0 || (r.debug && !cur.debug)) continue;
      const cx = r.gx + r.gw / 2 - fx, cy = r.gy + r.gh / 2 - fy;
      const along = dx ? cx * dx : cy * dy, across = dx ? Math.abs(cy) : Math.abs(cx);
      if (along <= 0.05 || across > along * 1.5 + 0.6) continue;
      const d = along + across * 2;
      if (d < bestD) { bestD = d; best = r; }
    }
    if (best) { mapCursorTo(game, best === cur ? null : best); Au.sfx('menuMove'); }
  }
  function stubX(e, r, x, w) { return e.side === 'left' ? x : (e.side === 'right' ? x + w : x + (e.x + e.w / 2) / r.w * w); }
  function stubY(e, r, y, h) { return e.side === 'top' ? y : (e.side === 'bottom' ? y + h : y + (e.y + e.h / 2) / r.h * h); }
  function drawMap(ctx, game) {
    dim(ctx);
    UI.panel(ctx, 20, 20, 920, 500);
    if (!hatchPattern) {   // faint INK hatch so the unknown area reads as paper (§12.12)
      const hc = Rn.makeCanvas(12, 12), g = hc.getContext('2d');
      g.strokeStyle = P.INK; g.lineWidth = 1; g.globalAlpha = 0.5;
      g.beginPath(); g.moveTo(-2, 8); g.lineTo(8, -2); g.moveTo(4, 14); g.lineTo(14, 4); g.stroke();
      hatchPattern = ctx.createPattern(hc, 'repeat');
    }
    ctx.save(); ctx.beginPath(); ctx.rect(24, 70, 912, 420); ctx.clip();
    ctx.globalAlpha = 0.5; ctx.fillStyle = hatchPattern; ctx.fillRect(24, 70, 912, 420); ctx.globalAlpha = 1;
    const cur = game.level ? game.level.room : null;
    if (cur) {
      const S = MAP_S;
      const ox = 480 - (cur.gx + cur.gw / 2) * S + UI.mapPan.x, oy = 270 - (cur.gy + cur.gh / 2) * S + UI.mapPan.y;
      const rooms = UB.World.rooms, save = game.save, ping = game.hasDeepPing();
      const showDebug = !!cur.debug;
      // pass 1: dotted links between visited rooms and discovered rooms whose stubs are not touching
      ctx.save(); ctx.setLineDash(DASH33); ctx.strokeStyle = P.PAPER_DIM; ctx.lineWidth = 1.5;
      for (let ri = 0; ri < MAP_ROOMS.length; ri++) {
        const r = MAP_ROOMS[ri], id = r.id;
        if (save.visited.indexOf(id) < 0 || (r.debug && !showDebug)) continue;
        const x = ox + r.gx * S + 2, y = oy + r.gy * S + 2, w = r.gw * S - 4, h = r.gh * S - 4;
        for (let i = 0; i < r.exits.length; i++) {
          const e = r.exits[i], t = rooms[e.to.room];
          if (!t || save.discovered.indexOf(t.id) < 0) continue;
          const te = UB.World.exit(t, e.to.exit); if (!te) continue;
          const tx = ox + t.gx * S + 2, ty = oy + t.gy * S + 2, tw = t.gw * S - 4, th = t.gh * S - 4;
          const ax = stubX(e, r, x, w), ay = stubY(e, r, y, h), bx = stubX(te, t, tx, tw), by = stubY(te, t, ty, th);
          if (Math.abs(ax - bx) + Math.abs(ay - by) <= 10) continue;
          ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        }
      }
      ctx.restore();
      // pass 2: rooms + icons
      for (let ri = 0; ri < MAP_ROOMS.length; ri++) {
        const r = MAP_ROOMS[ri], id = r.id;
        if (r.debug && !showDebug) continue;
        const disc = save.discovered.indexOf(id) >= 0, vis = save.visited.indexOf(id) >= 0;
        if (!disc) continue;
        const x = ox + r.gx * S + 2, y = oy + r.gy * S + 2, w = r.gw * S - 4, h = r.gh * S - 4;
        if (x > 940 || y > 494 || x + w < 20 || y + h < 66) continue;
        ctx.lineWidth = 2;
        if (vis) {
          ctx.fillStyle = UB.World.zones[r.zone].palette.tileFill; ctx.strokeStyle = P.INK;
          Rn.rrect(ctx, x, y, w, h, 4); ctx.fill(); ctx.stroke();
          ctx.fillStyle = P.INK;
          for (let i = 0; i < r.exits.length; i++) { const e = r.exits[i]; ctx.fillRect(stubX(e, r, x, w) - 3, stubY(e, r, y, h) - 3, 6, 6); }
        } else {
          ctx.save(); ctx.setLineDash(DASH44); ctx.fillStyle = UNVISITED; ctx.strokeStyle = P.PAPER_DIM;
          Rn.rrect(ctx, x, y, w, h, 4); ctx.fill(); ctx.stroke(); ctx.restore();
        }
        if (vis || ping) {
          if (r.nodes.length) { ctx.fillStyle = P.CORE_HEART; ctx.strokeStyle = P.INK; ctx.lineWidth = 1.5; diamond(ctx, x + 11, y + 11, 5); ctx.fill(); ctx.stroke(); }
          if (r.vendor) { ctx.fillStyle = P.BITS; ctx.strokeStyle = P.INK; ctx.lineWidth = 1.5; hexagon(ctx, x + w / 2, y + h - 10, 5); ctx.fill(); ctx.stroke(); }
          for (let i = 0; i < r.cores.length; i++) {
            const found = save.cores.indexOf(r.cores[i].id) >= 0;
            if (found) { ctx.fillStyle = P.CORE_HEART; ctx.beginPath(); ctx.arc(x + w - 10 - i * 8, y + h - 10, 2.5, 0, TAU); ctx.fill(); }
            else if (ping) UI.text(ctx, '?', x + w - 10 - i * 8, y + h - 10, F.mono12b, P.CORE_HEART, 'center', 'middle');
          }
        }
        if (r.boss && (vis || ping)) {
          ctx.fillStyle = save.bossesDefeated.indexOf(r.boss.id) >= 0 ? P.PAPER_DIM : P.DANGER; ctx.strokeStyle = P.INK; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x + w - 11, y + 11, 5, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.fillStyle = P.INK; ctx.fillRect(x + w - 14, y + 9, 2, 2); ctx.fillRect(x + w - 10, y + 9, 2, 2);
        }
        if (UI.mapCur === r) { ctx.save(); ctx.strokeStyle = P.SELECT; ctx.lineWidth = 2; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(UI.t / 10); Rn.rrect(ctx, x - 3, y - 3, w + 6, h + 6, 6); ctx.stroke(); ctx.restore(); }
        if (r === cur && game.player) {   // you: ENERGY dot r 5 + pulsing ring 5→12 every 40 f
          const pxr = x + U.clamp(game.player.x / (r.w * 30), 0, 1) * w, pyr = y + U.clamp(game.player.y / (r.h * 30), 0, 1) * h;
          const k = (UI.t % 40) / 40;
          ctx.fillStyle = P.ENERGY; ctx.strokeStyle = P.INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(pxr, pyr, 5, 0, TAU); ctx.fill(); ctx.stroke();
          ctx.save(); ctx.strokeStyle = P.ENERGY; ctx.lineWidth = 2; ctx.globalAlpha = 1 - k; ctx.beginPath(); ctx.arc(pxr, pyr, 5 + k * 7, 0, TAU); ctx.stroke(); ctx.restore();
        }
      }
    }
    ctx.restore();
    UI.text(ctx, TXT.map, 60, 56, F.ui22b, P.PAPER, 'left', 'middle', 3);
    UI.text(ctx, game.zone ? game.zone.name : '', 900, 56, F.mono14, P.PAPER_DIM, 'right', 'middle');
    UI.text(ctx, TXT.mapLegend, 60, 500, F.mono11, P.PAPER_DIM, 'left', 'middle');
    const two = !!UI.mapBestiary2;
    UI.text(ctx, UI.mapRoomLine, 480, UI.mapBestiary ? (two ? 486 : 493) : 500, F.mono11, P.PAPER, 'center', 'middle');
    if (UI.mapBestiary) UI.text(ctx, UI.mapBestiary, 480, two ? 498 : 507, F.mono11, P.PAPER_DIM, 'center', 'middle');
    if (two) UI.text(ctx, UI.mapBestiary2, 480, 510, F.mono11, P.PAPER_DIM, 'center', 'middle');
    UI.text(ctx, TXT.mapClose, 900, 500, F.mono11, P.PAPER_DIM, 'right', 'middle');
    UI.text(ctx, TXT.mapRecentre, 900 - textW(ctx, TXT.mapClose, F.mono11) - 18, 500, F.mono11, P.PAPER_DIM, 'right', 'middle');
  }
  const DASH33 = [3, 3], DASH44 = [4, 4];
  let MAP_ROOMS = null;   // every RoomSpec, listed once on the first map open (no for-in inside a draw)
  function drawSettings(ctx, game) {
    dim(ctx);
    UI.panel(ctx, 230, 90, 500, 360);
    UI.text(ctx, TXT.settings, 480, 118, F.ui24b, P.PAPER, 'center', 'middle', 3);
    const sg = game.settings, n = UI.fromTitle ? 7 : 6;
    for (let i = 0; i < n; i++) {
      const row = (i === 5 && !UI.fromTitle) ? 6 : i;      // without RESET SAVE the sixth row is BACK
      const y = 150 + i * 44, on = i === UI.sel && !UI.confirmReset;
      UI.text(ctx, TXT.settingRows[row], 260, y, F.ui16b, on ? P.SELECT : P.PAPER, 'left', 'middle', 3);
      if (on) UI.text(ctx, '▶', 244 + Math.sin(UI.t / 20 * TAU) * 3, y, F.ui14b, P.SELECT, 'center', 'middle', 3);
      const k = SETTING_KEYS[row];
      if (row <= 2) {   // slider 0–10: bar 160×10 (x 540..700), knob r 8 SELECT
        ctx.fillStyle = TROUGH; Rn.rrect(ctx, 540, y - 5, 160, 10, 5); ctx.fill();
        ctx.fillStyle = on ? P.SELECT : P.PAPER_DIM; Rn.rrect(ctx, 540, y - 5, 160 * sg[k] / 10, 10, 5); ctx.fill();
        ctx.strokeStyle = P.INK; ctx.lineWidth = 2; Rn.rrect(ctx, 540, y - 5, 160, 10, 5); ctx.stroke();
        ctx.fillStyle = P.SELECT; ctx.beginPath(); ctx.arc(540 + sg[k] / 10 * 160, y, 8, 0, TAU); ctx.fill(); ctx.stroke();
        UI.text(ctx, SLIDER_NUM[sg[k]], 716, y, F.mono12, P.PAPER_DIM, 'left', 'middle');
      } else if (k) {   // toggle pill 56×22 right-aligned to x 700
        const v = !!sg[k];
        ctx.fillStyle = v ? P.SELECT : TROUGH; Rn.rrect(ctx, 644, y - 11, 56, 22, 11); ctx.fill();
        ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = v ? P.INK : P.PAPER; ctx.beginPath(); ctx.arc(v ? 689 : 655, y, 7, 0, TAU); ctx.fill();
        UI.text(ctx, v ? TXT.on : TXT.off, v ? 664 : 680, y, F.ui12b, v ? P.INK : P.PAPER_DIM, 'center', 'middle');
      }
    }
    if (UI.confirmReset) drawYesNo(ctx, TXT.reset1, TXT.reset2, UI.ynSel);
  }
  const SLIDER_NUM = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  /** Vendor panel (DESIGN §12.17). */
  function drawShop(ctx, game) {
    dim(ctx);
    UI.panel(ctx, 230, 120, 500, 300);
    const save = game.save;
    const line = UI.shopMsgT > 0 ? UI.shopMsg : UI.shopLine;
    const lines = wrapped(line, F.mono13, 460);
    for (let i = 0; i < lines.length && i < 2; i++) UI.text(ctx, lines[i], 480, 150 + i * 17 - (lines.length > 1 ? 8 : 0), F.mono13, UI.shopMsgT > 0 ? P.DANGER : P.PAPER_DIM, 'center', 'middle');
    ctx.fillStyle = P.BITS; ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    hexagon(ctx, 714, 182, 7); ctx.fill(); ctx.stroke();
    UI.text(ctx, UI.bitsStr, 700, 182, F.mono16b, P.BITS, 'right', 'middle', 2);
    for (let i = 0; i < VENDOR.length; i++) {
      const it = VENDOR[i], y = 220 + i * 56, on = i === UI.sel, sold = save.vendor.indexOf(it.id) >= 0;
      ctx.save(); ctx.globalAlpha = sold ? 0.45 : 1;
      UI.text(ctx, it.name, 260, y, F.ui18b, on ? P.SELECT : P.PAPER, 'left', 'middle', 3);
      if (on) UI.text(ctx, '▶', 244 + Math.sin(UI.t / 20 * TAU) * 3, y, F.ui14b, P.SELECT, 'center', 'middle', 3);
      UI.text(ctx, sold ? TXT.sold : PRICE_STR[i], 700, y, F.mono16b, sold ? P.PAPER_DIM : (save.bits < it.price ? P.DANGER : P.BITS), 'right', 'middle', 2);
      UI.text(ctx, it.effect, 260, y + 22, F.mono12, P.PAPER_DIM, 'left', 'middle');
      ctx.restore();
    }
    UI.text(ctx, TXT.shopFooter, 480, 400, F.mono11, P.PAPER_DIM, 'center', 'middle');
  }
  const PRICE_STR = [];
  for (let i = 0; i < VENDOR.length; i++) PRICE_STR.push(String(VENDOR[i].price));
  /** Zone lore card (DESIGN §12.18); game.loreCard is the zone. */
  function drawLore(ctx, game) {
    const z = game.loreCard; if (!z) return;
    let k = UI.loreT < 20 ? UI.loreT / 20 : 1;
    if (UI.loreT > 220) k = (240 - UI.loreT) / 20;
    ctx.save(); ctx.globalAlpha = 0.85 * k; ctx.fillStyle = P.INK; ctx.fillRect(0, 0, W, H); ctx.restore();
    ctx.save(); ctx.globalAlpha = k;
    spaced(ctx, z.name, 480, 170, F.ui40b, z.palette.glow, 6, 3);
    ctx.strokeStyle = z.palette.tileEdge; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(320, 198); ctx.lineTo(640, 198); ctx.stroke();
    const lines = wrapped(z.lore || '', F.mono15, 640);
    for (let i = 0; i < lines.length; i++) UI.text(ctx, lines[i], 480, 230 + i * 22, F.mono15, P.PAPER, 'center', 'middle');
    if (UI.loreT > 60 && ((UI.loreT / 30) | 0) % 2 === 0) UI.text(ctx, TXT.pressAnyKey, 480, 470, F.mono12, P.PAPER_DIM, 'center', 'middle');
    ctx.restore();
  }
  /** Full screens and overlays. */
  UI.drawScreen = function (ctx, game) {
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (game.screen === 'title') drawTitle(ctx, game);
    else if (game.screen === 'select') drawSelect(ctx, game);
    else if (game.screen === 'gameover') drawGameOver(ctx, game);
    else if (game.screen === 'victory') drawVictory(ctx, game);
    if (game.overlay === 'pause') drawPause(ctx);
    else if (game.overlay === 'map') drawMap(ctx, game);
    else if (game.overlay === 'settings') drawSettings(ctx, game);
    else if (game.overlay === 'shop') drawShop(ctx, game);
    else if (game.overlay === 'lore') drawLore(ctx, game);
    // toasts set outside play (SAVE ERASED on the title, the gamepad toasts, a storage warning) and bottom toasts
    // while an overlay is open draw here, above the screen/overlay — the HUD (play only) draws the rest
    if (UI.toastT > 0 && toastOnTop(game)) drawToast(ctx, game);
    ctx.restore();
  };

  // 'R' recentres the map (DESIGN §12.12); R is not an UB.Input action, so the UI listens for it itself.
  if (typeof window !== 'undefined') window.addEventListener('keydown', function (e) { if (e.code === 'KeyR') UI.recentreReq = true; });

  UB.UI = UI;
})(window.UB);
