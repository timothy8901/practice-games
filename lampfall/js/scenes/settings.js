/**
 * Settings. [SCN-MENU] — GDD-00 §15, GDD-09 §3.25 / §6.
 *
 * Every GDD-00 §15 setting, grouped (Time, Text, Play, Sight, Sound, Controls), each row with its
 * value right-aligned between `◀ ▶`. Left/right step a value, `confirm` flips a toggle or steps a
 * choice; the focused row's note sits in a slip at the bottom (text speed types a sample line at the
 * chosen speed; a volume change plays a blip at the new level). Changes apply live:
 *  - world-backed rows go through `systems/settings.update` inside a tx; its side effects are
 *    performed here (`clockSys.applySettingsEffects` for day length / Real Clock, `input.loadBindings`
 *    for the remap); audio follows `settings:changed` through audio/director; the device mirror is
 *    written with `systems/settings.writeMirror`;
 *  - rows the schema does not carry yet (battle speed, fishing, large text, high contrast, Clear
 *    Visuals, Path view, ambience, touch layout, wake point, auto-advance) go to the extension mirror
 *    (`menuKit.writeExt`) and are announced as `settings:changed {changed, ext}`; the same patch is
 *    offered to `systems/settings.update`, so the day STATE adds a field it lands in the save.
 *
 * **Remap** (a page): every action with its keyboard and controller key. `confirm` listens for the
 * next key or button (Esc or a tap cancels, as does six seconds of nothing); a key that already does
 * another action asks `settings.remap.conflict` (No focused) and swaps the two on yes. Reset to
 * defaults asks first. Bindings persist in `world.settings.bindings` and the device mirror.
 *
 * Params: `{page?: 'remap'}`.
 * @module scenes/settings
 */
import { drawText, drawTextTyped, measureText } from '../core/font.js';
import { tokenLabel, DEFAULT_BINDINGS } from '../core/input.js';
import { COLORS, PALETTE } from '../ui/theme.js';
import { createFocus } from '../ui/focus.js';
import { drawBar } from '../ui/widgets.js';
import { openConfirm } from '../ui/confirm.js';
import { t } from '../data/strings.js';
import * as settingsSys from '../systems/settings.js';
import * as clockSys from '../systems/clockSys.js';
import {
  settingRows, SETTING_SECTIONS, rowValue, valueLabel, stepValue, worldPatch, REMAP_ACTIONS, primaryToken,
  remapConflicts, remapped, deviceOf,
} from './menuModel.js';
import {
  prefsOf, skinOf, drawSkinPanel, drawBackdrop, drawHeading, drawHints, drawCursorAt, drawBody, readExt, writeExt,
  fitText, sfx, toast,
} from './menuKit.js';

const LIST = Object.freeze({ x: 8, y: 20, w: 464, h: 198 });
const ROW_H = 12;
const VISIBLE = 15;
const LISTEN_MS = 6000;
const SAMPLE = 'The tide is going out, and the lamp on the porch is lit.'; // str

/**
 * @param {any} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string}}
 */
export function createSettingsScene(G) {
  /** @type {'main'|'remap'} */
  let page = 'main';
  let ms = 0;
  let busy = false;
  let top = 0;
  let sampleMs = 0;
  /** @type {{action: string, left: number}|null} */
  let listening = null;
  let lastNote = '';

  const rows = settingRows();
  /** Display lines: section headers and rows. */
  const lines = [];
  for (const sec of SETTING_SECTIONS) {
    lines.push({ kind: 'section', id: sec, label: t(`settings.section.${sec}`) });
    for (const r of rows.filter((x) => x.section === sec)) lines.push({ kind: 'row', row: r });
  }
  const rowLines = lines.filter((l) => l.kind === 'row');

  const mainFocus = createFocus({ cols: 1, wrap: true, items: [] });
  const remapFocus = createFocus({ cols: 1, wrap: true, items: [] });

  const settings = () => G.world?.settings ?? settingsSys.DEFAULTS;

  // ------------------------------------------------------------------------------ layout --
  function lineY(i) { return LIST.y + 8 + (i - top) * ROW_H; }

  function layoutMain() {
    const fi = rowLines.map((l) => {
      const i = lines.indexOf(l);
      const vis = i >= top && i < top + VISIBLE;
      return { id: l.row.id, rect: vis ? { x: LIST.x + 10, y: lineY(i), w: LIST.w - 20, h: ROW_H } : null, enabled: true };
    });
    mainFocus.setItems(fi);
  }

  function keepInView() {
    const l = rowLines[mainFocus.index];
    let i = lines.indexOf(l);
    // keep the section header of the first row visible too
    if (i - 1 >= 0 && lines[i - 1].kind === 'section' && i - 1 < top) i -= 1;
    if (i < top) top = i;
    else if (lines.indexOf(l) >= top + VISIBLE) top = lines.indexOf(l) - VISIBLE + 1;
    top = Math.max(0, Math.min(lines.length - VISIBLE, top));
    layoutMain();
  }

  function remapItems() {
    return [...REMAP_ACTIONS.map((a) => ({ id: a, label: t(`action.${a}`) })), { id: '__reset', label: t('settings.remap.reset') }];
  }
  let remapTop = 0;
  function layoutRemap() {
    const items = remapItems();
    remapFocus.setItems(items.map((it, i) => ({
      id: it.id,
      rect: i >= remapTop && i < remapTop + VISIBLE ? { x: LIST.x + 10, y: LIST.y + 20 + (i - remapTop) * ROW_H, w: LIST.w - 20, h: ROW_H } : null,
      enabled: true,
    })));
  }
  function remapKeepInView() {
    const i = remapFocus.index;
    const vis = VISIBLE - 1;
    if (i < remapTop) remapTop = i;
    else if (i >= remapTop + vis) remapTop = i - vis + 1;
    remapTop = Math.max(0, Math.min(remapItems().length - vis, remapTop));
    layoutRemap();
  }

  // ------------------------------------------------------------------------------- apply --
  function bindingsNow() {
    try { return G.input?.bindings ? G.input.bindings() : JSON.parse(JSON.stringify(DEFAULT_BINDINGS)); } catch { return {}; }
  }

  function persistMirror() {
    try { if (typeof localStorage !== 'undefined') settingsSys.writeMirror(localStorage, G.world.settings); } catch { /* storage blocked */ }
  }

  /** Performs systems/settings side effects the shell owns. */
  function perform(effects) {
    const clockFx = effects.filter((e) => e.kind.startsWith('clock.'));
    if (clockFx.length && G.clock) G.store.tx('settings:clock', (w) => clockSys.applySettingsEffects(w, G.clock, clockFx));
    for (const e of effects) {
      if (e.kind === 'display.scale' && typeof G.display?.setMode === 'function') {
        try { G.display.setMode(e.scale); } catch { /* an old display keeps its mode */ }
      }
      if (e.kind === 'input.bindings' && G.input?.loadBindings) {
        if (e.bindings) G.input.loadBindings({ version: 1, bindings: e.bindings });
        else G.input.resetBindings?.();
      }
    }
  }

  function setValue(row, value) {
    if (row.target === 'world') {
      const patch = worldPatch(row, value, settings());
      if (!patch) return;
      const res = G.store.tx('settings:update', (w) => settingsSys.update(w, patch, { bus: G.bus }));
      perform(res.effects ?? []);
      persistMirror();
    } else {
      const key = row.id === 'ambience' ? 'ambience' : row.id;
      const v = row.id === 'ambience' ? value / 100 : value;
      writeExt({ [key]: v });
      // forward-compatible: lands in world.settings the day the schema carries the key
      G.store.tx('settings:update-ext', (w) => settingsSys.update(w, { [key]: v }, { bus: G.bus }));
      persistMirror();
      try { G.bus?.emit?.('settings:changed', { changed: [key], ext: readExt(G), settings: G.world?.settings }); } catch { /* listeners never break settings */ }
    }
    if (row.kind === 'volume') sfx(G, 'cursor');
    else sfx(G, 'confirm');
    if (row.id === 'textSpeed') sampleMs = 0;
  }

  function step(row, dir) {
    if (row.kind === 'action') return;
    const cur = rowValue(row, settings(), readExt(G));
    const next = stepValue(row, cur, dir);
    if (next === cur) { sfx(G, 'blocked'); return; }
    setValue(row, next);
  }

  function activateMain(i) {
    const row = rowLines[i]?.row;
    if (!row) return;
    if (row.kind === 'action') { openRemap(); return; }
    if (row.kind === 'volume') { step(row, 1); return; }
    const cur = rowValue(row, settings(), readExt(G));
    if (row.kind === 'toggle') { setValue(row, !cur); return; }
    const opts = row.options ?? [];
    const k = opts.findIndex((o) => o.value === cur);
    setValue(row, opts[(k + 1) % opts.length].value);
  }

  // ------------------------------------------------------------------------------- remap --
  function openRemap() {
    page = 'remap';
    remapTop = 0;
    layoutRemap();
    remapFocus.set(0, { force: true });
    sfx(G, 'confirm');
  }

  async function activateRemap(i) {
    const it = remapItems()[i];
    if (!it || busy) return;
    if (it.id === '__reset') {
      busy = true;
      const pick = await openConfirm(G, { body: 'Put every key and button back the way it started?', options: [t('confirm.no'), t('settings.remap.reset')], defaultIndex: 0 }); // str
      busy = false;
      if (pick !== 1) { sfx(G, 'cancel'); return; }
      G.input?.resetBindings?.();
      const res = G.store.tx('settings:bindings', (w) => settingsSys.update(w, { bindings: null }, { bus: G.bus }));
      persistMirror();
      sfx(G, 'confirm');
      toast(G, 'Controls are back to the defaults.'); // str
      void res;
      return;
    }
    listening = { action: it.id, left: LISTEN_MS };
    G.input?.flush?.();
    sfx(G, 'confirm');
  }

  async function capture(token) {
    const action = listening?.action;
    listening = null;
    if (!action) return;
    const dev = deviceOf(token);
    if (!dev || dev === 'touch') { sfx(G, 'blocked'); return; }
    const b = bindingsNow();
    if (primaryToken(b, action, dev) === token) { sfx(G, 'confirm'); return; }
    const conflicts = remapConflicts(b, action, token);
    let swap = false;
    if (conflicts.length) {
      busy = true;
      const pick = await openConfirm(G, {
        body: t('settings.remap.conflict', { key: tokenLabel(token), action: conflicts.map((c) => t(`action.${c}`)).join(', ') }),
        options: [t('confirm.no'), 'Swap them'], defaultIndex: 0, // str
      });
      busy = false;
      if (pick !== 1) { sfx(G, 'cancel'); return; }
      swap = true;
    }
    const next = remapped(b, action, token, { swap });
    G.input?.loadBindings?.({ version: 1, bindings: next });
    G.store.tx('settings:bindings', (w) => settingsSys.update(w, { bindings: next }, { bus: G.bus }));
    persistMirror();
    sfx(G, 'confirm');
  }

  // -------------------------------------------------------------------------------- wiring --
  mainFocus.on('change', () => { keepInView(); sfx(G, 'cursor'); sampleMs = 0; });
  mainFocus.on('activate', (ev) => activateMain(ev.index));
  mainFocus.on('cancel', () => leave());
  remapFocus.on('change', () => { remapKeepInView(); sfx(G, 'cursor'); });
  remapFocus.on('activate', (ev) => { activateRemap(ev.index); });
  remapFocus.on('cancel', () => { page = 'main'; sfx(G, 'cancel'); });

  function leave() {
    sfx(G, 'cancel');
    if (G.scenes.top() === scene) G.scenes.pop();
  }

  // ------------------------------------------------------------------------------- drawing --
  function drawMain(ctx, skin, prefs) {
    drawHeading(ctx, t('settings.heading'));
    const inner = drawSkinPanel(ctx, LIST, skin, 'paper');
    void inner;
    const s = settings();
    const ext = readExt(G);
    for (let i = top; i < Math.min(lines.length, top + VISIBLE); i++) {
      const l = lines[i];
      const y = lineY(i);
      if (l.kind === 'section') {
        drawText(ctx, l.label, LIST.x + 12, y + 3, { color: skin.accent });
        ctx.fillStyle = skin.rule;
        const lw = measureText(l.label).w;
        ctx.fillRect(LIST.x + 16 + lw, y + 7, LIST.w - 32 - lw, 1);
        continue;
      }
      const row = l.row;
      const fi = rowLines.indexOf(l);
      const focused = mainFocus.index === fi;
      if (focused) { ctx.fillStyle = skin.band; ctx.fillRect(LIST.x + 8, y, LIST.w - 16, ROW_H); }
      drawText(ctx, row.label, LIST.x + 26, y + 3, { color: skin.text });
      const v = rowValue(row, s, ext);
      const vx = LIST.x + LIST.w - 18;
      if (row.kind === 'action') {
        drawText(ctx, '▶', vx, y + 3, { color: skin.soft, align: 'right' });
      } else if (row.kind === 'volume') {
        drawText(ctx, `${v}%`, vx, y + 3, { color: skin.text, align: 'right' });
        drawBar(ctx, { x: vx - 104, y: y + 4, w: 70, h: 5, value: v, max: 100, kind: 'glow', dark: skin.dark });
        if (focused) { drawText(ctx, '◀', vx - 118, y + 3, { color: skin.soft }); drawText(ctx, '▶', vx - 30, y + 3, { color: skin.soft }); }
      } else {
        const label = valueLabel(row, v);
        const opts = row.options ?? [];
        const k = opts.findIndex((o) => o.value === v);
        const atStart = row.kind === 'choice' && k <= 0, atEnd = row.kind === 'choice' && k >= opts.length - 1;
        drawText(ctx, label, vx - 10, y + 3, { color: skin.text, align: 'right' });
        if (focused) {
          const lw = measureText(label).w;
          drawText(ctx, '◀', vx - 22 - lw, y + 3, { color: atStart ? skin.faint : skin.soft });
          drawText(ctx, '▶', vx - 4, y + 3, { color: atEnd ? skin.faint : skin.soft });
        }
      }
      if (focused) drawCursorAt(ctx, LIST.x + 14, y + 3, ms, skin);
    }
    // scroll marks
    if (top > 0) drawText(ctx, '▲', LIST.x + LIST.w - 10, LIST.y + 3, { font: 'small', color: skin.soft });
    if (top + VISIBLE < lines.length) drawText(ctx, '▼', LIST.x + LIST.w - 10, LIST.y + LIST.h - 9, { font: 'small', color: skin.soft });
    // note slip
    const slip = { x: 16, y: 222, w: 448, h: 30 };
    drawSkinPanel(ctx, slip, skin, 'notice', { torn: 'top' });
    const row = rowLines[mainFocus.index]?.row;
    if (row?.id === 'textSpeed') {
      const cps = settingsSys.textCharsPerSecond(s);
      const shown = cps === Infinity ? Infinity : Math.floor((sampleMs / 1000) * cps);
      drawTextTyped(ctx, SAMPLE, slip.x + 10, slip.y + 11, shown, { color: skin.text, maxWidth: slip.w - 20 });
    } else {
      let note = row?.note ?? '';
      if (row?.id === 'dayLength' && s.realClock) note = t('settings.realClockNote');
      lastNote = note;
      drawBody(ctx, note, slip.x + 10, slip.y + 10, slip.w - 20, { color: skin.soft, maxLines: 2, large: prefs.large });
    }
    drawHints(ctx, G.input, [['confirm', 'Change'], ['cancel', 'Back']]); // str
  }

  function drawRemap(ctx, skin) {
    drawHeading(ctx, t('settings.remap'));
    drawSkinPanel(ctx, LIST, skin, 'paper');
    const b = bindingsNow();
    drawText(ctx, t('device.keyboard'), LIST.x + 250, LIST.y + 8, { color: skin.accent });
    drawText(ctx, t('device.gamepad'), LIST.x + 360, LIST.y + 8, { color: skin.accent });
    const items = remapItems();
    for (let i = remapTop; i < Math.min(items.length, remapTop + VISIBLE - 1); i++) {
      const it = items[i];
      const y = LIST.y + 20 + (i - remapTop) * ROW_H;
      const focused = remapFocus.index === i;
      if (focused) { ctx.fillStyle = skin.band; ctx.fillRect(LIST.x + 8, y, LIST.w - 16, ROW_H); }
      drawText(ctx, it.label, LIST.x + 26, y + 3, { color: it.id === '__reset' ? skin.accent : skin.text });
      if (it.id !== '__reset') {
        const kb = primaryToken(b, it.id, 'keyboard');
        const gp = primaryToken(b, it.id, 'gamepad');
        const wait = listening && listening.action === it.id;
        const blink = Math.floor(ms / 300) % 2 === 0;
        drawText(ctx, wait ? (blink ? '...' : '') : (kb ? tokenLabel(kb) : '–'), LIST.x + 250, y + 3, { color: skin.text });
        drawText(ctx, wait ? (blink ? '...' : '') : (gp ? tokenLabel(gp) : '–'), LIST.x + 360, y + 3, { color: skin.text });
        const extra = (b[it.id] ?? []).filter((tok) => deviceOf(tok) === 'keyboard').slice(1).map(tokenLabel).join(' ');
        if (extra && !wait) drawText(ctx, fitText(extra, 64, { font: 'small' }), LIST.x + 290, y + 4, { font: 'small', color: skin.faint });
      }
      if (focused) drawCursorAt(ctx, LIST.x + 14, y + 3, ms, skin);
    }
    const slip = { x: 16, y: 222, w: 448, h: 30 };
    drawSkinPanel(ctx, slip, skin, 'notice', { torn: 'top' });
    const it = items[remapFocus.index];
    const msg = listening
      ? `${t('settings.remap.press', { action: t(`action.${listening.action}`) })}  Esc: never mind.` // str
      : it?.id === '__reset' ? 'Every action back to its first keys and buttons.' : 'Confirm, then press the new key or button. A key in use asks before it swaps.'; // str
    drawText(ctx, msg, slip.x + 10, slip.y + 10, { color: listening ? skin.text : skin.soft, maxWidth: slip.w - 20 });
    if (!listening) drawHints(ctx, G.input, [['confirm', 'Rebind'], ['cancel', 'Back']]); // str
  }

  // --------------------------------------------------------------------------------- scene --
  const scene = {
    name: 'settings',
    opaque: true,
    enter(params = {}) {
      G.input?.flush?.();
      ms = 0; top = 0; page = 'main'; listening = null;
      layoutMain();
      mainFocus.set(0, { force: true });
      if (params?.page === 'remap') openRemap();
    },
    exit() { listening = null; },
    pause() {},
    resume() { G.input?.flush?.(); },
    update(dt) {
      ms += dt;
      sampleMs += dt;
      if (listening) { listening.left -= dt; if (listening.left <= 0) { listening = null; sfx(G, 'cancel'); } }
      mainFocus.update(dt); remapFocus.update(dt);
    },
    handleInput(input) {
      if (busy) return;
      if (page === 'remap') {
        if (listening) {
          const p = input.pointer;
          if (p && p.justDown) { listening = null; sfx(G, 'cancel'); return; }
          if (input.pressed('anyKey')) {
            const tok = input.lastPressedToken?.();
            if (!tok) return;
            if (tok === 'Escape') { listening = null; sfx(G, 'cancel'); return; }
            capture(tok);
          }
          return;
        }
        remapFocus.handle(input);
        return;
      }
      const row = rowLines[mainFocus.index]?.row;
      if (row && row.kind !== 'action') {
        if (input.repeat('left')) { step(row, -1); return; }
        if (input.repeat('right')) { step(row, 1); return; }
      }
      mainFocus.handle(input);
    },
    draw(ctx) {
      const prefs = prefsOf(G);
      const skin = skinOf(prefs);
      drawBackdrop(ctx, prefs);
      if (page === 'remap') drawRemap(ctx, skin);
      else drawMain(ctx, skin, prefs);
    },
    debugText() {
      if (page === 'remap') {
        const b = bindingsNow();
        return ['Remap', ...REMAP_ACTIONS.map((a, i) => `${i === remapFocus.index ? '>' : ' '} ${a}: ${(b[a] ?? []).join(' ')}`), listening ? `listening: ${listening.action}` : ''].join('\n');
      }
      const s = settings();
      const ext = readExt(G);
      return [t('settings.heading'), ...rowLines.map((l, i) => `${i === mainFocus.index ? '>' : ' '} ${l.row.label}: ${valueLabel(l.row, rowValue(l.row, s, ext))}`), lastNote].join('\n');
    },
    get page() { return page; },
    get listening() { return listening; },
  };
  return scene;
}
