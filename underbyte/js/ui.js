/*
 * UNDERBYTE — js/ui.js
 * Owner: UI/FX implementer (this is a MINIMAL but functional version by the engine architect).
 * Contract: CONTRACT.md §4.9 (UB.UI). Design: DESIGN.md §12 (coordinates are followed where cheap).
 *
 * The engine drives the screen state machine (game.screen / game.overlay); the
 * UI renders screens + HUD and handles MENU input only. It talks back to the
 * engine through the public game methods listed in CONTRACT.md §8:
 *   toSelect() toTitle() newGame(id) continueGame() hasSave() saveSummary()
 *   openOverlay(name) closeOverlay() respawnAtNode() setSetting(k, v) resetSave()
 * Every exported function here must keep its name and signature; everything
 * about how it looks may change.
 */
'use strict';
(function (UB) {
  const P = UB.Palette, In = UB.Input, U = UB.Util, Au = UB.Audio;
  const W = 960, H = 540;

  const UI = {
    sel: 0,            // current menu index (per screen)
    confirmQuit: false,
    fromTitle: false,  // settings opened from the title (shows RESET SAVE)
    confirmReset: false,
    mapPan: { x: 0, y: 0 },
    toastT: 0, toastDur: 0, toast1: '', toast2: '',
    bannerT: 0, bannerDur: 0, banner1: '', banner2: '', banner3: '',
    cardT: 0, cardDur: 0, cardName: '', cardSub: '',
    bossBarGhost: 0,
    bitsPop: 0, lastBits: 0,
    energyShown: 0,
    t: 0,
  };

  // --- drawing helpers ---------------------------------------------------------------
  UI.text = function (ctx, str, x, y, font, color, align, baseline, ink) {
    ctx.font = font; ctx.textAlign = align || 'left'; ctx.textBaseline = baseline || 'alphabetic';
    if (ink) { ctx.lineJoin = 'round'; ctx.strokeStyle = P.INK; ctx.lineWidth = ink; ctx.strokeText(str, x, y); }
    ctx.fillStyle = color; ctx.fillText(str, x, y);
  };
  UI.panel = function (ctx, x, y, w, h) {
    ctx.fillStyle = P.PANEL; ctx.strokeStyle = P.PANEL_EDGE; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    UB.Render.rrect(ctx, x, y, w, h, 10); ctx.fill(); ctx.stroke();
  };
  function menuList(ctx, items, x, y, pitch, font, sel, disabled) {
    for (let i = 0; i < items.length; i++) {
      const on = i === sel;
      const dis = disabled && disabled[i];
      ctx.save();
      if (on) { ctx.translate(x, y + i * pitch); ctx.scale(1.06, 1.06); ctx.translate(-x, -(y + i * pitch)); }
      ctx.globalAlpha = dis ? 0.4 : (on ? 1 : 0.8);
      UI.text(ctx, items[i], x, y + i * pitch, font, on ? P.SELECT : (dis ? P.PAPER_DIM : P.PAPER), 'center', 'middle', 3);
      if (on) { const nudge = Math.sin(UI.t / 20 * Math.PI * 2) * 3; UI.text(ctx, '▶', x - ctx.measureText(items[i]).width / 2 - 26 + nudge, y + i * pitch, font, P.SELECT, 'center', 'middle', 3); }
      ctx.restore();
    }
  }
  function nav(items, disabled) {
    let moved = false;
    if (In.repeat('down')) { do { UI.sel = (UI.sel + 1) % items; } while (disabled && disabled[UI.sel]); moved = true; }
    if (In.repeat('up')) { do { UI.sel = (UI.sel + items - 1) % items; } while (disabled && disabled[UI.sel]); moved = true; }
    if (moved) Au.sfx('menuMove');
    return moved;
  }

  // --- public messaging ------------------------------------------------------------------
  UI.init = function (game) { UI.sel = 0; UI.lastBits = 0; };
  /** Engine calls this whenever game.screen / game.overlay changes. */
  UI.enter = function (name, game) {
    UI.sel = 0; UI.confirmQuit = false; UI.confirmReset = false;
    if (name === 'title' && game && game.hasSave()) UI.sel = 1;
    if (name === 'select' && game) { const ids = UB.Characters.list; for (let i = 0; i < ids.length; i++) if (ids[i].id === game.lastFighter) UI.sel = i; }
    if (name === 'settings') UI.fromTitle = !!(game && game.screen === 'title');
    if (name === 'map') { UI.mapPan.x = 0; UI.mapPan.y = 0; }
  };
  UI.toast = function (l1, l2, frames) { UI.toast1 = l1 || ''; UI.toast2 = l2 || ''; UI.toastDur = frames || 150; UI.toastT = UI.toastDur; };
  UI.banner = function (l1, l2, l3, frames) { UI.banner1 = l1 || ''; UI.banner2 = l2 || ''; UI.banner3 = l3 || ''; UI.bannerDur = frames || 182; UI.bannerT = UI.bannerDur; };
  UI.bossCard = function (name, sub, frames) { UI.cardName = name; UI.cardSub = sub || ''; UI.cardDur = frames || 150; UI.cardT = UI.cardDur; };
  UI.clearMessages = function () { UI.toastT = 0; UI.bannerT = 0; UI.cardT = 0; };

  /** Timers; called every logic frame regardless of screen. */
  UI.tick = function (game) {
    UI.t++;
    if (UI.toastT > 0) UI.toastT--;
    if (UI.bannerT > 0) UI.bannerT--;
    if (UI.cardT > 0) UI.cardT--;
    if (UI.bitsPop > 0) UI.bitsPop--;
    if (game.save && game.save.bits !== UI.lastBits) { UI.bitsPop = 10; UI.lastBits = game.save.bits; }
    if (game.denyFlash > 0) game.denyFlash--;
    if (game.player) UI.energyShown += (game.player.energy - UI.energyShown) * 0.25;
    if (game.boss) UI.bossBarGhost += (game.boss.hp - UI.bossBarGhost) * 0.08;
  };

  // --- menu input ----------------------------------------------------------------------------
  UI.update = function (game) {
    const s = game.overlay || game.screen;
    const st = In.state;
    if (s === 'title') {
      const items = 3, disabled = [false, !game.hasSave(), false];
      nav(items, disabled);
      if (st.confirm.pressed) {
        Au.sfx('menuConfirm');
        if (UI.sel === 0) game.toSelect();
        else if (UI.sel === 1) game.continueGame();
        else game.openOverlay('settings');
      }
    } else if (s === 'select') {
      const n = UB.Characters.list.length;
      if (In.repeat('right')) { UI.sel = (UI.sel + 1) % n; Au.sfx('menuMove'); }
      if (In.repeat('left')) { UI.sel = (UI.sel + n - 1) % n; Au.sfx('menuMove'); }
      if (st.confirm.pressed) { Au.sfx('menuConfirm'); game.newGame(UB.Characters.list[UI.sel].id); }
      else if (st.back.pressed) { Au.sfx('menuBack'); game.toTitle(); }
    } else if (s === 'pause') {
      if (UI.confirmQuit) {
        if (In.repeat('left') || In.repeat('right')) { UI.sel = UI.sel === 4 ? 5 : 4; Au.sfx('menuMove'); }
        if (st.confirm.pressed) { if (UI.sel === 4) game.toTitle(); else { UI.confirmQuit = false; UI.sel = 3; } }
        else if (st.back.pressed) { UI.confirmQuit = false; UI.sel = 3; }
        return;
      }
      nav(4);
      if (st.pause.pressed || st.back.pressed) { Au.sfx('menuBack'); game.closeOverlay(); return; }
      if (st.map.pressed) { game.openOverlay('map'); return; }
      if (st.confirm.pressed) {
        Au.sfx('menuConfirm');
        if (UI.sel === 0) game.closeOverlay();
        else if (UI.sel === 1) game.openOverlay('map');
        else if (UI.sel === 2) game.openOverlay('settings');
        else { UI.confirmQuit = true; UI.sel = 5; }
      }
    } else if (s === 'map') {
      if (st.map.pressed || st.back.pressed || st.pause.pressed) { Au.sfx('menuBack'); game.closeOverlay(); return; }
      if (st.left.down) UI.mapPan.x += 4; if (st.right.down) UI.mapPan.x -= 4;
      if (st.up.down) UI.mapPan.y += 4; if (st.down.down) UI.mapPan.y -= 4;
    } else if (s === 'settings') {
      const rows = UI.fromTitle ? 7 : 6; // last row = BACK
      if (UI.confirmReset) {
        if (In.repeat('left') || In.repeat('right')) { UI.resetSel = UI.resetSel ? 0 : 1; }
        if (st.confirm.pressed) { if (UI.resetSel === 1) { game.resetSave(); } UI.confirmReset = false; }
        else if (st.back.pressed) UI.confirmReset = false;
        return;
      }
      nav(rows);
      if (st.back.pressed || st.pause.pressed) { Au.sfx('menuBack'); game.closeOverlay(); return; }
      const sg = game.settings;
      const adj = (In.repeat('right') ? 1 : 0) - (In.repeat('left') ? 1 : 0);
      const key = ['master', 'music', 'sfx'][UI.sel];
      if (UI.sel <= 2 && adj !== 0) { game.setSetting(key, U.clamp(sg[key] + adj, 0, 10)); Au.sfx('menuMove'); }
      else if (UI.sel === 3 && (adj !== 0 || st.confirm.pressed)) game.setSetting('screenShake', !sg.screenShake);
      else if (UI.sel === 4 && (adj !== 0 || st.confirm.pressed)) game.setSetting('showHitboxes', !sg.showHitboxes);
      else if (UI.fromTitle && UI.sel === 5 && st.confirm.pressed) { UI.confirmReset = true; UI.resetSel = 0; }
      else if (UI.sel === rows - 1 && st.confirm.pressed) { Au.sfx('menuBack'); game.closeOverlay(); }
    } else if (s === 'gameover') {
      if (game.fadeT > 0) return;
      if (st.confirm.pressed || st.jump.pressed) { Au.sfx('restore'); game.respawnAtNode(); }
    } else if (s === 'victory') {
      if (st.confirm.pressed) game.toTitle();
    }
  };

  // --- HUD -----------------------------------------------------------------------------------
  function heart(ctx, x, y, full, core, scale) {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = P.INK;
    ctx.fillStyle = full ? (core ? P.CORE_HEART : P.HEART) : P.HEART_EMPTY;
    ctx.beginPath();
    if (core) { ctx.moveTo(0, -13); ctx.lineTo(12, 0); ctx.lineTo(0, 13); ctx.lineTo(-12, 0); ctx.closePath(); }
    else { ctx.moveTo(-14, -3); ctx.arc(-7, -3, 7, Math.PI, 0); ctx.arc(7, -3, 7, Math.PI, 0); ctx.lineTo(14, -3); ctx.lineTo(0, 12); ctx.closePath(); }
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  UI.drawHUD = function (ctx, game) {
    const pl = game.player; if (!pl) return;
    const save = game.save;
    // hearts (24,22) pitch 32
    const lowPulse = pl.hp <= 1 ? Math.pow(Math.max(0, Math.sin(UI.t / 36 * Math.PI * 2)), 3) : 0;
    for (let i = 0; i < pl.maxHp; i++) heart(ctx, 24 + 15 + i * 32, 22 + 13, i < pl.hp, i >= pl.baseHp, i < pl.hp ? 1 + 0.08 * lowPulse : 1);
    // energy bar (24,56) 180×12
    const eShake = game.denyFlash > 0 ? U.jitter(UI.t, 1, 2) : 0;
    ctx.fillStyle = P.ENERGY_DIM; UB.Render.rrect(ctx, 24 + eShake, 56, 180, 12, 6); ctx.fill();
    ctx.fillStyle = game.denyFlash > 4 ? P.DANGER : P.ENERGY;
    const ew = Math.max(0, Math.min(180, 180 * UI.energyShown / pl.energyMax));
    if (ew > 1) { UB.Render.rrect(ctx, 24 + eShake, 56, ew, 12, 6); ctx.fill(); }
    ctx.strokeStyle = P.INK; ctx.lineWidth = 3; UB.Render.rrect(ctx, 24 + eShake, 56, 180, 12, 6); ctx.stroke();
    ctx.fillStyle = P.PAPER; for (let i = 1; i < 4; i++) ctx.fillRect(24 + i * 45, 57, 1, 10);
    UI.text(ctx, 'ENERGY', 24, 80, UB.font(10, 'UI', true), P.PAPER_DIM);
    // meter (24,88) 180×8
    const ready = pl.meter >= pl.meterMax && !pl.ocActive;
    ctx.fillStyle = P.METER_DIM; UB.Render.rrect(ctx, 24, 88, 180, 8, 4); ctx.fill();
    const mw = Math.max(0, Math.min(180, 180 * pl.meter / pl.meterMax));
    const blink = pl.ocActive && pl.overclock < 180 && ((Math.floor(pl.overclock / 6)) & 1);
    if (mw > 1 && !blink) { ctx.fillStyle = pl.ocActive ? pl.data.ocPalette.glow : P.METER; UB.Render.rrect(ctx, 24, 88, mw, 8, 4); ctx.fill(); }
    if (ready) { ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = P.METER_READY; const bx = 24 + ((UI.t % 45) / 45) * 156; UB.Render.rrect(ctx, bx, 88, 24, 8, 4); ctx.fill(); ctx.restore(); }
    ctx.strokeStyle = P.INK; ctx.lineWidth = 2; UB.Render.rrect(ctx, 24, 88, 180, 8, 4); ctx.stroke();
    const label = pl.ocActive ? 'OVERCLOCKED' : (ready ? 'OVERCLOCK — READY  [' + In.glyph('overclock') + ']' : 'OVERCLOCK');
    ctx.save(); if (ready) ctx.globalAlpha = 0.8 + 0.2 * Math.sin(UI.t / 30 * Math.PI * 2);
    UI.text(ctx, label, 24, 108, UB.font(10, 'UI', true), ready ? P.SELECT : P.PAPER_DIM); ctx.restore();
    // bits (896,32)
    ctx.save(); ctx.translate(896, 32); const pop = UI.bitsPop > 0 ? 1 + 0.3 * (UI.bitsPop / 10) : 1; ctx.scale(pop, pop);
    ctx.fillStyle = P.BITS; ctx.strokeStyle = P.INK; ctx.lineWidth = 2;
    ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); } ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    UI.text(ctx, String(save.bits), 884, 32, UB.font(20, 'MONO', true), P.PAPER, 'right', 'middle', 3);
    // interaction prompt
    if (game.prompt) {
      const bob = Math.sin(UI.t / 15) * 2;
      UI.text(ctx, '▲ ' + game.prompt.text, game.prompt.x, game.prompt.y - 24 + bob, UB.font(14, 'UI', true), P.PAPER, 'center', 'middle', 3);
    }
    // boss bar (180,486) 600×30
    const b = game.boss;
    if (b && game.bossFight.state !== 'none' && game.bossFight.state !== 'done') {
      let k = 1;
      if (game.bossFight.state === 'intro') k = U.clamp((150 - game.bossFight.timer - 120) / 30, 0, 1);
      if (k > 0) {
        const bw = 600 * k, bx = 480 - bw / 2;
        ctx.fillStyle = b.phase >= 2 ? '#3A1020' : '#2A1A24'; UB.Render.rrect(ctx, bx, 486, bw, 30, 8); ctx.fill();
        const ghostW = Math.max(0, 596 * UI.bossBarGhost / b.maxHp) * k, fillW = Math.max(0, 596 * b.hp / b.maxHp) * k;
        if (ghostW > fillW) { ctx.fillStyle = P.PAPER; UB.Render.rrect(ctx, bx + 2, 488, ghostW, 26, 6); ctx.fill(); }
        if (fillW > 1) { const g = ctx.createLinearGradient(bx, 0, bx + 596, 0); g.addColorStop(0, b.phase >= 2 ? '#FF3B5C' : P.DANGER); g.addColorStop(1, b.phase >= 2 ? P.METER : '#FF8A5C'); ctx.fillStyle = g; UB.Render.rrect(ctx, bx + 2, 488, fillW, 26, 6); ctx.fill(); }
        ctx.strokeStyle = P.INK; ctx.lineWidth = 3; UB.Render.rrect(ctx, bx, 486, bw, 30, 8); ctx.stroke();
        ctx.save(); ctx.globalAlpha = 0.3; ctx.fillStyle = P.PAPER; for (let i = 1; i < 10; i++) ctx.fillRect(bx + i * bw / 10, 488, 1, 26); ctx.restore();
        UI.text(ctx, b.name + (b.subtitle ? '  ·  ' + b.subtitle : ''), 480, 476, UB.font(18, 'UI', true), P.PAPER, 'center', 'alphabetic', 3);
      }
    }
    // zone toast (480,150)
    if (UI.toastT > 0) {
      const e = UI.toastDur - UI.toastT;
      let a = 1, dy = 0;
      if (e < 20) { a = e / 20; dy = 10 * (1 - a); } else if (UI.toastT < 30) a = UI.toastT / 30;
      ctx.save(); ctx.globalAlpha = a;
      UI.text(ctx, UI.toast1, 480, 150 + dy, UB.font(34, 'UI', true), P.PAPER, 'center', 'middle', 4);
      if (UI.toast2) UI.text(ctx, UI.toast2, 480, 184 + dy, UB.font(16, 'MONO'), P.PAPER_DIM, 'center', 'middle', 3);
      ctx.strokeStyle = game.zone ? game.zone.palette.tileEdge : P.PAPER; ctx.lineWidth = 2;
      const rw = 260 * Math.min(1, e / 20); ctx.beginPath(); ctx.moveTo(480 - rw / 2, 168 + dy); ctx.lineTo(480 + rw / 2, 168 + dy); ctx.stroke();
      ctx.restore();
    }
    // banner (240,200) 480×120
    if (UI.bannerT > 0) {
      const e = UI.bannerDur - UI.bannerT;
      let a = 1, y = 200;
      if (e < 12) { a = e / 12; y = 170 + 30 * a; } else if (UI.bannerT < 20) a = UI.bannerT / 20;
      ctx.save(); ctx.globalAlpha = a;
      UI.panel(ctx, 240, y, 480, 120);
      UI.text(ctx, UI.banner1, 480, y + 36, UB.font(26, 'UI', true), P.SELECT, 'center', 'middle', 3);
      UI.text(ctx, UI.banner2, 480, y + 68, UB.font(16, 'MONO'), P.PAPER, 'center', 'middle');
      UI.text(ctx, UI.banner3, 480, y + 96, UB.font(13, 'MONO'), P.PAPER_DIM, 'center', 'middle');
      ctx.restore();
    }
    // boss title card
    if (UI.cardT > 0) {
      const e = UI.cardDur - UI.cardT;
      let x = 0, a = 1;
      if (e < 12) x = -960 * (1 - e / 12); else if (UI.cardT < 10) a = UI.cardT / 10;
      ctx.save(); ctx.globalAlpha = 0.8 * a; ctx.fillStyle = P.INK; ctx.fillRect(x, 190 - (1 - a) * 80, 960, 80); ctx.globalAlpha = a;
      UI.text(ctx, UI.cardName, 480 + x, 222 - (1 - a) * 80, UB.font(36, 'UI', true), P.DANGER, 'center', 'middle');
      UI.text(ctx, UI.cardSub, 480 + x, 254 - (1 - a) * 80, UB.font(14, 'MONO'), P.PAPER, 'center', 'middle');
      ctx.restore();
    }
    // low-HP heartbeat vignette
    if (pl.hp <= 1 && !pl.dead) {
      const g = ctx.createRadialGradient(480, 270, 260, 480, 270, 640);
      g.addColorStop(0, 'rgba(255,59,59,0)'); g.addColorStop(1, 'rgba(255,59,59,1)');
      ctx.save(); ctx.globalAlpha = 0.10 + 0.14 * lowPulse; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    if (game.settings.showHitboxes) {
      UI.text(ctx, 'fps ' + game.fps + '  ' + game.level.room.id + '  ' + pl.state + '  f' + game.frame, 8, 536, UB.font(11, 'MONO'), P.PAPER_DIM);
    }
  };

  // --- screens ------------------------------------------------------------------------------------
  function drawTitle(ctx, game) {
    const zone = UB.World.zones[UB.World.start && UB.World.rooms[UB.World.start.room] ? UB.World.rooms[UB.World.start.room].zone : 'debug'] || UB.World.zones.debug;
    UB.Render.drawBackground(ctx, zone, UI.t * 0.5, 0);
    UB.Render.drawVignette(ctx);
    ctx.save();
    const bob = Math.sin(UI.t / 180 * Math.PI * 2) * 2;
    ctx.translate(480, 170 + bob); ctx.rotate(Math.sin(UI.t / 180 * Math.PI * 2) * 0.5 * U.DEG);
    ctx.font = UB.font(92, 'UI', true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 10; ctx.strokeStyle = P.INK; ctx.strokeText('UNDERBYTE', 0, 0);
    const g = ctx.createLinearGradient(0, -46, 0, 46); g.addColorStop(0, P.LOGO_A); g.addColorStop(1, P.LOGO_B);
    ctx.fillStyle = g; ctx.fillText('UNDERBYTE', 0, 0);
    ctx.globalAlpha = 0.6; ctx.lineWidth = 2; ctx.strokeStyle = P.PAPER; ctx.strokeText('UNDERBYTE', -2, -2);
    ctx.restore();
    UI.text(ctx, 'a buried kingdom · a sentient program · one corrupted root', 480, 232, UB.font(18, 'MONO'), P.PAPER_DIM, 'center', 'middle');
    menuList(ctx, ['NEW GAME', 'CONTINUE', 'SETTINGS'], 480, 320, 44, UB.font(24, 'UI', true), UI.sel, [false, !game.hasSave(), false]);
    const sum = game.saveSummary();
    if (sum) UI.text(ctx, sum, 480, 386, UB.font(12, 'MONO'), P.PAPER_DIM, 'center', 'middle');
    if (!In.gestured && ((UI.t / 30) | 0) % 2 === 0) UI.text(ctx, 'PRESS ANY KEY', 480, 470, UB.font(14, 'UI', true), P.SELECT, 'center', 'middle', 3);
    UI.text(ctx, 'an original game · keyboard or gamepad · press Enter', 480, 516, UB.font(11, 'MONO'), P.PAPER_DIM, 'center', 'middle');
    UI.text(ctx, 'v0.1', 944, 528, UB.font(11, 'MONO'), P.PAPER_DIM, 'right', 'middle');
  }
  function drawSelect(ctx, game) {
    const list = UB.Characters.list;
    ctx.fillStyle = '#0b1220'; ctx.fillRect(0, 0, W, H);
    UB.Render.drawVignette(ctx);
    UI.text(ctx, 'CHOOSE YOUR SPIRIT', 480, 48, UB.font(30, 'UI', true), P.PAPER, 'center', 'middle', 3);
    UI.text(ctx, '← → select · Enter confirm · Esc back', 480, 74, UB.font(13, 'MONO'), P.PAPER_DIM, 'center', 'middle');
    const d = list[UI.sel];
    // big preview
    ctx.save(); ctx.globalAlpha = 0.1; ctx.fillStyle = d.palette.glow; ctx.beginPath(); ctx.arc(300, 230, 110, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = P.INK; ctx.beginPath(); ctx.ellipse(300, 330, 60, 7, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    UB.Characters.drawPreview(ctx, d.id, 300, 330, 3, UI.t);
    // stats
    UI.panel(ctx, 560, 130, 360, 150);
    const stats = [['HEARTS', d.hp / 6], ['SPEED', d.run / 300], ['JUMP', (d.jumpVel * d.jumpVel / (2 * d.gravity)) / 113.8], ['WEIGHT', d.weight / 1.3]];
    for (let i = 0; i < 4; i++) {
      UI.text(ctx, stats[i][0], 580, 160 + i * 30, UB.font(13, 'UI', true), P.PAPER, 'left', 'middle');
      ctx.fillStyle = '#2A2230'; UB.Render.rrect(ctx, 680, 155 + i * 30, 220, 10, 5); ctx.fill();
      ctx.fillStyle = P.SELECT; UB.Render.rrect(ctx, 680, 155 + i * 30, 220 * U.clamp(stats[i][1], 0.05, 1), 10, 5); ctx.fill();
      ctx.strokeStyle = P.INK; ctx.lineWidth = 2; UB.Render.rrect(ctx, 680, 155 + i * 30, 220, 10, 5); ctx.stroke();
    }
    UI.panel(ctx, 560, 292, 360, 72);
    const m = d.moves;
    UI.text(ctx, 'LIGHT  ' + m.light1.name + ' / ' + m.light2.name + ' / ' + m.light3.name, 576, 312, UB.font(12, 'MONO'), P.PAPER, 'left', 'middle');
    UI.text(ctx, 'HEAVY  ' + m.heavy.name + '   SPECIAL  ' + m.special.name, 576, 332, UB.font(12, 'MONO'), P.PAPER, 'left', 'middle');
    UI.text(ctx, 'ULTIMATE  ' + m.ultimate.name, 576, 352, UB.font(12, 'MONO'), P.PAPER, 'left', 'middle');
    ctx.font = UB.font(12, 'MONO');
    const lines = U.wrapText(ctx, d.bio || '', 420);
    for (let i = 0; i < Math.min(3, lines.length); i++) UI.text(ctx, lines[i], 60, 352 + i * 16, UB.font(12, 'MONO'), P.PAPER_DIM, 'left', 'middle');
    // cards
    const xs = [60, 240, 420, 600, 780];
    for (let i = 0; i < list.length && i < 5; i++) {
      const on = i === UI.sel; const x = xs[i], y = on ? 372 : 380;
      ctx.save(); ctx.globalAlpha = on ? 1 : 0.75;
      UI.panel(ctx, x, y, 150, 110);
      if (on) { ctx.strokeStyle = P.SELECT; ctx.lineWidth = 3; UB.Render.rrect(ctx, x, y, 150, 110, 10); ctx.stroke(); }
      UI.text(ctx, list[i].name.toUpperCase(), x + 75, y + 22, UB.font(16, 'UI', true), P.PAPER, 'center', 'middle');
      UI.text(ctx, list[i].title, x + 75, y + 40, UB.font(11, 'MONO'), P.PAPER_DIM, 'center', 'middle');
      UB.Characters.drawPreview(ctx, list[i].id, x + 75, y + 102, 0.9, UI.t);
      ctx.restore();
    }
  }
  function dim(ctx) { ctx.fillStyle = 'rgba(10,8,12,0.6)'; ctx.fillRect(0, 0, W, H); }
  function drawPause(ctx, game) {
    dim(ctx);
    UI.panel(ctx, 330, 150, 300, 240);
    UI.text(ctx, 'PAUSED', 480, 186, UB.font(24, 'UI', true), P.PAPER, 'center', 'middle', 3);
    menuList(ctx, ['RESUME', 'MAP', 'SETTINGS', 'QUIT TO TITLE'], 480, 226, 40, UB.font(18, 'UI', true), UI.confirmQuit ? -1 : UI.sel);
    if (UI.confirmQuit) {
      UI.panel(ctx, 330, 400, 300, 110);
      UI.text(ctx, 'Unsaved progress since the', 480, 426, UB.font(12, 'MONO'), P.PAPER, 'center', 'middle');
      UI.text(ctx, 'last node is lost. Quit?', 480, 444, UB.font(12, 'MONO'), P.PAPER, 'center', 'middle');
      UI.text(ctx, 'YES', 440, 482, UB.font(18, 'UI', true), UI.sel === 4 ? P.SELECT : P.PAPER, 'center', 'middle', 3);
      UI.text(ctx, 'NO', 520, 482, UB.font(18, 'UI', true), UI.sel === 5 ? P.SELECT : P.PAPER, 'center', 'middle', 3);
    }
  }
  function drawMap(ctx, game) {
    dim(ctx);
    UI.panel(ctx, 20, 20, 920, 500);
    UI.text(ctx, 'MAP', 60, 56, UB.font(22, 'UI', true), P.PAPER, 'left', 'middle', 3);
    UI.text(ctx, game.zone ? game.zone.name : '', 900, 56, UB.font(14, 'MONO'), P.PAPER_DIM, 'right', 'middle');
    const cur = game.level.room;
    const S = 40;
    const ox = 480 - (cur.gx + cur.gw / 2) * S + UI.mapPan.x, oy = 270 - (cur.gy + cur.gh / 2) * S + UI.mapPan.y;
    ctx.save(); ctx.beginPath(); ctx.rect(24, 70, 912, 420); ctx.clip();
    const rooms = UB.World.rooms, save = game.save;
    for (const id in rooms) {
      const r = rooms[id];
      const disc = save.discovered.indexOf(id) >= 0, vis = save.visited.indexOf(id) >= 0;
      if (!disc) continue;
      const x = ox + r.gx * S + 2, y = oy + r.gy * S + 2, w = r.gw * S - 4, h = r.gh * S - 4;
      ctx.lineWidth = 2; ctx.strokeStyle = P.INK;
      if (vis) { ctx.fillStyle = UB.World.zones[r.zone].palette.tileFill; UB.Render.rrect(ctx, x, y, w, h, 4); ctx.fill(); ctx.stroke(); }
      else { ctx.save(); ctx.setLineDash([4, 4]); ctx.fillStyle = '#1A1620'; ctx.strokeStyle = P.PAPER_DIM; UB.Render.rrect(ctx, x, y, w, h, 4); ctx.fill(); ctx.stroke(); ctx.restore(); continue; }
      ctx.fillStyle = P.INK;
      for (let i = 0; i < r.exits.length; i++) {
        const e = r.exits[i];
        const ex = e.side === 'left' ? x - 1 : (e.side === 'right' ? x + w - 5 : x + (e.x + e.w / 2) / r.w * w - 3);
        const ey = e.side === 'top' ? y - 1 : (e.side === 'bottom' ? y + h - 5 : y + (e.y + e.h / 2) / r.h * h - 3);
        ctx.fillRect(ex, ey, 6, 6);
      }
      if (r.nodes.length) { ctx.fillStyle = P.CORE_HEART; ctx.beginPath(); ctx.moveTo(x + 10, y + 6); ctx.lineTo(x + 14, y + 10); ctx.lineTo(x + 10, y + 14); ctx.lineTo(x + 6, y + 10); ctx.closePath(); ctx.fill(); }
      if (r.boss) { ctx.fillStyle = save.bossesDefeated.indexOf(r.boss.id) >= 0 ? P.PAPER_DIM : P.DANGER; ctx.beginPath(); ctx.arc(x + w - 10, y + 10, 5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = P.INK; ctx.fillRect(x + w - 13, y + 8, 2, 2); ctx.fillRect(x + w - 9, y + 8, 2, 2); }
      if (r.vendor) { ctx.fillStyle = P.BITS; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.lineTo(x + w / 2 + Math.cos(a) * 5, y + h - 10 + Math.sin(a) * 5); } ctx.closePath(); ctx.fill(); }
      if (r === cur && game.player) {
        const pxr = x + game.player.x / (r.w * 30) * w, pyr = y + game.player.y / (r.h * 30) * h;
        ctx.fillStyle = P.ENERGY; ctx.beginPath(); ctx.arc(pxr, pyr, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = P.ENERGY; ctx.lineWidth = 2; ctx.globalAlpha = 1 - (UI.t % 40) / 40; ctx.beginPath(); ctx.arc(pxr, pyr, 5 + (UI.t % 40) / 40 * 7, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    UI.text(ctx, '◆ node  ● boss  ⬢ vendor  · you', 60, 500, UB.font(11, 'MONO'), P.PAPER_DIM, 'left', 'middle');
    UI.text(ctx, 'Esc / M close', 900, 500, UB.font(11, 'MONO'), P.PAPER_DIM, 'right', 'middle');
  }
  function drawSettings(ctx, game) {
    dim(ctx);
    UI.panel(ctx, 230, 90, 500, 360);
    UI.text(ctx, 'SETTINGS', 480, 118, UB.font(24, 'UI', true), P.PAPER, 'center', 'middle', 3);
    const sg = game.settings;
    const rows = [['MASTER VOLUME', 'master'], ['MUSIC VOLUME', 'music'], ['SFX VOLUME', 'sfx'], ['SCREEN SHAKE', 'screenShake'], ['SHOW HITBOXES', 'showHitboxes']];
    if (UI.fromTitle) rows.push(['RESET SAVE', null]);
    rows.push(['BACK', null]);
    for (let i = 0; i < rows.length; i++) {
      const y = 150 + i * 44, on = i === UI.sel;
      UI.text(ctx, rows[i][0], 260, y, UB.font(16, 'UI', true), on ? P.SELECT : P.PAPER, 'left', 'middle', 3);
      const k = rows[i][1];
      if (k === 'master' || k === 'music' || k === 'sfx') {
        ctx.fillStyle = '#2A2230'; UB.Render.rrect(ctx, 540, y - 5, 160, 10, 5); ctx.fill();
        ctx.fillStyle = P.SELECT; ctx.beginPath(); ctx.arc(540 + sg[k] / 10 * 160, y, 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
      } else if (k) {
        const v = sg[k];
        ctx.fillStyle = v ? P.SELECT : '#2A2230'; UB.Render.rrect(ctx, 644, y - 11, 56, 22, 11); ctx.fill();
        ctx.strokeStyle = P.INK; ctx.lineWidth = 2; ctx.stroke();
        UI.text(ctx, v ? 'ON' : 'OFF', 672, y, UB.font(12, 'UI', true), P.INK, 'center', 'middle');
      }
    }
    if (UI.confirmReset) {
      UI.panel(ctx, 330, 400, 300, 90);
      UI.text(ctx, 'Erase the save?', 480, 424, UB.font(14, 'MONO'), P.PAPER, 'center', 'middle');
      UI.text(ctx, 'NO', 440, 462, UB.font(18, 'UI', true), UI.resetSel === 0 ? P.SELECT : P.PAPER, 'center', 'middle', 3);
      UI.text(ctx, 'YES', 520, 462, UB.font(18, 'UI', true), UI.resetSel === 1 ? P.SELECT : P.PAPER, 'center', 'middle', 3);
    }
  }
  function drawGameOver(ctx, game) {
    ctx.fillStyle = '#07050A'; ctx.fillRect(0, 0, W, H);
    const e = game.screenT;
    ctx.save(); ctx.globalAlpha = U.clamp(e / 20, 0, 1);
    UI.text(ctx, 'SIGNAL LOST', 480, 240, UB.font(44, 'UI', true), P.DANGER, 'center', 'middle', 3);
    UI.text(ctx, 'Rebooting at the last restore node…', 480, 290, UB.font(14, 'MONO'), P.PAPER_DIM, 'center', 'middle');
    if (((e / 30) | 0) % 2 === 0) UI.text(ctx, 'Press JUMP or CONFIRM to continue', 480, 400, UB.font(16, 'UI', true), P.SELECT, 'center', 'middle', 3);
    ctx.restore();
  }
  function drawVictory(ctx, game) {
    ctx.fillStyle = '#07050A'; ctx.fillRect(0, 0, W, H);
    const st = game.victoryStats();
    UI.text(ctx, 'ROOT PROCESS PURGED', 480, 110, UB.font(40, 'UI', true), P.LOGO_A, 'center', 'middle', 6);
    UI.panel(ctx, 280, 150, 400, 250);
    const rows = [['FIGHTER', st.fighter], ['TIME', st.time], ['DEATHS', st.deaths], ['BITS COLLECTED', st.bits],
      ['CORES FOUND', st.cores], ['ROOMS DISCOVERED', st.rooms], ['ENEMIES PURGED', st.enemies], ['BOSSES', st.bosses]];
    const shown = Math.min(rows.length, Math.floor(game.screenT / 12));
    for (let i = 0; i < shown; i++) {
      UI.text(ctx, rows[i][0], 300, 180 + i * 26, UB.font(16, 'MONO'), P.PAPER_DIM, 'left', 'middle');
      UI.text(ctx, String(rows[i][1]), 660, 180 + i * 26, UB.font(16, 'MONO'), P.PAPER, 'right', 'middle');
    }
    if (shown >= rows.length) UI.text(ctx, 'Press CONFIRM for the title', 480, 510, UB.font(14, 'UI', true), P.SELECT, 'center', 'middle', 3);
  }
  /** Full screens and overlays. */
  UI.drawScreen = function (ctx, game) {
    if (game.screen === 'title') drawTitle(ctx, game);
    else if (game.screen === 'select') drawSelect(ctx, game);
    else if (game.screen === 'gameover') drawGameOver(ctx, game);
    else if (game.screen === 'victory') drawVictory(ctx, game);
    if (game.overlay === 'pause') drawPause(ctx, game);
    else if (game.overlay === 'map') drawMap(ctx, game);
    else if (game.overlay === 'settings') drawSettings(ctx, game);
  };

  UB.UI = UI;
})(window.UB);
