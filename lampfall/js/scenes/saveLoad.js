/**
 * Save and load. [SCN-MENU] — GDD-00 §15 (Saves), ARCHITECTURE §2.5 / §10.
 *
 * Tabs: **Save** (the three manual slots), **Load** (a crash-resume row when the last session did
 * not close cleanly, the manual slots, then the three rotating autosaves), **Transfer** (export a
 * slot to a copyable string, import a pasted one). Each slot card shows the place, the day and time,
 * the play time, how long ago it was written and the party as head icons.
 *
 * Saving over a slot asks first (No focused). Every save is the persist layer's verified write
 * (temp -> read back -> checksum -> swap); the result is shown as a **Saved** stamp or the red
 * **Not saved** banner with the reason and a *Try again* button, which stays until a save works.
 * Loading asks first (No focused) from the pause menu; from the title it returns the world through
 * `pop({world, slot})` (ARCHITECTURE §2.5), from the pause menu it swaps the world in and fades to the
 * field.
 *
 * Export / import use **one** temporary `<textarea>` (the only DOM UI besides touch), created when
 * the panel opens, hidden while a confirm is over it and removed when the panel or the scene closes.
 * In the textarea Enter copies / reads and Esc backs out; Tab hands focus back to the game.
 *
 * **No Rewind**: one autosave slot and no manual saves; the Save tab is replaced by the rule.
 *
 * Params: `{mode?: 'save'|'load'|'transfer', from?: 'menu'|'title', noRewind?: boolean}`.
 * @module scenes/saveLoad
 */
import { drawText, measureText } from '../core/font.js';
import { COLORS, PALETTE } from '../ui/theme.js';
import { createFocus } from '../ui/focus.js';
import { createTabs, TAB_H } from '../ui/tabs.js';
import { drawSealButton } from '../ui/widgets.js';
import { drawIcon, drawSeal } from '../ui/icons.js';
import { openConfirm } from '../ui/confirm.js';
import { confirmSpec, t } from '../data/strings.js';
import { wantsNoRewind } from '../state/persist.js';
import { slotRows, slotSummary, saveErrorText, isNoRewind, slotLabel, placeName, ageText } from './menuModel.js';
import {
  prefsOf, skinOf, drawSkinPanel, drawCard, drawBackdrop, drawHints, drawCreatureIcon, drawCursorAt, drawBody,
  fitText, sfx, toast,
} from './menuKit.js';

const PANEL = Object.freeze({ x: 12, y: 28, w: 456, h: 222 });
const CARD_H = 26, CARD_GAP = 2;
const TEXT_RECT = Object.freeze({ x: 28, y: 76, w: 424, h: 108 });

/**
 * @param {any} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string}}
 */
export function createSaveLoadScene(G) {
  let ms = 0;
  let busy = false;
  let from = 'menu';
  let noRewind = false;
  let crashed = false;
  /** @type {Array<{kind: 'resume'|'slot', entry: any, latest: boolean}>} */
  let rows = [];
  /** @type {Map<string, any>} slot -> summary */
  let summaries = new Map();
  /** @type {{ok: boolean, title: string, detail: string, t: number, slot?: string|number}|null} */
  let banner = null;
  /** @type {'list'|'export-pick'|'export'|'import'} */
  let panel = 'list';
  /** @type {HTMLTextAreaElement|null} */
  let textarea = null;
  let exportSlot = null;
  let note = '';
  let lastRect = '';

  const focus = createFocus({ cols: 1, wrap: true, items: [] });
  const btnFocus = createFocus({ cols: 3, wrap: true, items: [] });
  /** @type {Array<{id: string, label: string}>} */
  let buttons = [];

  const tabs = createTabs({
    tabs: [{ id: 'save', label: t('menu.save') }, { id: 'load', label: 'Load' }, { id: 'transfer', label: 'Transfer' }], // str
    rect: { x: 20, y: PANEL.y - TAB_H + 1, w: 440 },
    onChange: () => { closeText(); panel = 'list'; rebuild(true); sfx(G, 'cursor'); },
  });

  const persist = () => G.persist ?? null;

  // ---------------------------------------------------------------------------- slot data --
  function rebuild(resetCursor) {
    const p = persist();
    noRewind = noRewind || isNoRewind(G.world);
    const entries = p ? p.list({ all: true }) : [];
    summaries = new Map();
    for (const e of entries) {
      let world = null;
      if (e.state === 'ok' && p) { try { const r = p.load(e.slot); if (r.ok) world = r.world; } catch { world = null; } }
      summaries.set(e.slot, slotSummary(e, world, G.data, Date.now()));
    }
    if (tabs.active === 'transfer') rows = [];
    else rows = slotRows(entries, { tab: /** @type {any} */ (tabs.active), noRewind, crashed });
    const items = tabs.active === 'transfer'
      ? [{ id: 'export', rect: rowRect(0), enabled: entries.some((e) => e.state === 'ok'), reason: 'Nothing saved yet to export.' }, { id: 'import', rect: rowRect(1), enabled: !forwardOnly(), reason: FORWARD_ONLY }] // str
      : rows.map((r, i) => ({ id: `${r.kind}:${r.entry.slot}`, rect: rowRect(i), enabled: rowEnabled(r), reason: rowReason(r) }));
    focus.setItems(items, { keepId: !resetCursor });
    if (resetCursor) focus.set(0, { force: true });
  }

  function rowRect(i) {
    return { x: PANEL.x + 10, y: PANEL.y + 23 + i * (CARD_H + CARD_GAP), w: PANEL.w - 20, h: CARD_H };
  }

  /** No Rewind in a running season: loading (or importing) would be the rewind the challenge forbids. */
  const forwardOnly = () => noRewind && from === 'menu';
  const FORWARD_ONLY = 'No Rewind: the season only goes forward. Continue it from the title.'; // str

  function rowEnabled(r) {
    if (tabs.active === 'save') return true;
    if (forwardOnly()) return false;
    return r.entry.state === 'ok';
  }
  function rowReason(r) {
    if (forwardOnly() && tabs.active !== 'save') return FORWARD_ONLY;
    if (r.entry.state === 'corrupt') return t('save.corrupt');
    if (r.entry.state === 'empty') return 'Nothing saved here yet.'; // str
    return '';
  }

  // ------------------------------------------------------------------------------ actions --
  async function activateRow(i) {
    if (busy) return;
    if (tabs.active === 'transfer') {
      if (i === 0) openExportPick(); else openImport();
      return;
    }
    const r = rows[i];
    if (!r) return;
    if (tabs.active === 'save') await saveTo(r.entry);
    else await loadFrom(r.entry, r.kind === 'resume');
  }

  async function saveTo(entry) {
    const p = persist();
    if (!p) return;
    if (entry.state === 'ok') {
      busy = true;
      const pick = await openConfirm(G, confirmSpec('overwrite', { slot: slotLabel(entry) }));
      busy = false;
      if (pick !== 1) { sfx(G, 'cancel'); return; }
    }
    doSave(entry.index);
  }

  function doSave(index) {
    const p = persist();
    const res = p.saveManual(G, index);
    if (res.ok) {
      banner = { ok: true, title: t('save.verified'), detail: `${slotLabel({ kind: 'manual', index })}  •  ${placeName(res.place, G.data)}, Day ${res.day + 1}, ${res.time}`, t: 0 }; // str
      sfx(G, 'confirm');
      rebuild(false);
    } else {
      banner = { ok: false, title: t('save.notSaved'), detail: saveErrorText(res.error), t: 0, slot: index };
      buttons = [{ id: 'retry', label: 'Try again' }, { id: 'dismiss', label: 'Leave it' }]; // str
      layoutButtons(PANEL.y + 4 + 26);
      btnFocus.set(0, { force: true });
      sfx(G, 'error');
    }
  }

  async function loadFrom(entry, resume) {
    const p = persist();
    if (!p || entry.state !== 'ok') { sfx(G, 'blocked'); return; }
    if (from === 'menu' || !resume) {
      busy = true;
      const pick = await openConfirm(G, { body: `Load ${slotLabel(entry)}? Anything since your last save is lost.`, options: [t('confirm.no'), 'Load'], defaultIndex: 0 }); // str
      busy = false;
      if (pick !== 1) { sfx(G, 'cancel'); return; }
    }
    const res = p.load(entry.slot);
    if (!res.ok) {
      banner = { ok: false, title: 'Could not load', detail: saveErrorText(res.error), t: 0 }; // str
      buttons = [{ id: 'dismiss', label: t('common.ok') }];
      layoutButtons(PANEL.y + 4 + 26);
      btnFocus.set(0, { force: true });
      sfx(G, 'error');
      return;
    }
    enterWorld(res.world, entry.slot);
  }

  function enterWorld(world, slot) {
    sfx(G, 'confirm');
    closeText();
    if (from === 'title') {
      G.scenes.pop({ world, slot });
      return;
    }
    try { G.persist?.setNoRewind?.(wantsNoRewind(world)); } catch { /* old persist */ }
    const go = () => {
      G.store.replace(world);
      if (typeof G.scenes.clear === 'function') G.scenes.clear();
      G.push('overworld', { loaded: slot });
    };
    if (G.flags?.noanim || !G.scenes.transition) go();
    else G.scenes.transition('fade', 400, go, { color: COLORS.night.ink });
  }

  // ------------------------------------------------------------------------------ transfer --
  function openExportPick() {
    panel = 'export-pick';
    const ok = [...summaries.values()].filter((s) => s.state === 'ok');
    buttons = ok.map((s) => ({ id: `slot:${s.slot}`, label: s.label }));
    buttons.push({ id: 'back', label: t('common.back') });
    layoutButtonsGrid();
    btnFocus.set(0, { force: true });
    sfx(G, 'confirm');
  }

  function openExport(slot) {
    const str = persist()?.exportString(slot) ?? null;
    if (!str) { banner = { ok: false, title: 'Could not export', detail: saveErrorText({ code: 'corrupt' }), t: 0 }; sfx(G, 'error'); return; } // str
    exportSlot = slot;
    panel = 'export';
    note = `${slotLabel(summaries.get(slot) ?? { slot })}: ${str.length.toLocaleString('en-US')} characters. Keep it somewhere safe.`; // str
    openText(str, true);
    buttons = [{ id: 'copy', label: 'Copy' }, { id: 'back', label: t('common.back') }]; // str
    layoutButtons(TEXT_RECT.y + TEXT_RECT.h + 8);
    btnFocus.set(0, { force: true });
    sfx(G, 'confirm');
  }

  function openImport() {
    panel = 'import';
    note = 'Paste a save string, then Read it.'; // str
    openText('', false);
    buttons = [{ id: 'read', label: 'Read it' }, { id: 'back', label: t('common.back') }]; // str
    layoutButtons(TEXT_RECT.y + TEXT_RECT.h + 8);
    btnFocus.set(0, { force: true });
    sfx(G, 'confirm');
  }

  async function copyExport() {
    if (!textarea) return;
    textarea.focus();
    textarea.select();
    let ok = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) { await navigator.clipboard.writeText(textarea.value); ok = true; }
    } catch { ok = false; }
    if (!ok) { try { ok = document.execCommand?.('copy') === true; } catch { ok = false; } }
    note = ok ? 'Copied. Paste it anywhere to keep it.' : 'Selected. Press Ctrl+C (or Cmd+C) to copy it.'; // str
    sfx(G, ok ? 'confirm' : 'cursor');
  }

  async function readImport() {
    const text = (textarea?.value ?? '').trim();
    if (!text) { note = 'The box is empty. Paste a save string first.'; sfx(G, 'blocked'); return; } // str
    const res = persist()?.importString(text);
    if (!res || !res.ok) {
      note = t('save.importFail', { code: res?.error?.code ?? 'format' });
      sfx(G, 'error');
      return;
    }
    const w = res.world;
    note = `${t('save.importOk')} ${w.player?.name || 'A keeper'}, Day ${Math.floor((w.clock?.total ?? 0) / 1440) + 1}, ${placeName(w.player?.mapId, G.data)}.`; // str
    if (textarea) textarea.style.visibility = 'hidden';
    busy = true;
    const pick = await openConfirm(G, { body: `Play the imported season now? ${from === 'menu' ? 'Anything since your last save is lost.' : ''}`.trim(), options: [t('confirm.no'), 'Play it'], defaultIndex: 0 }); // str
    busy = false;
    if (textarea) textarea.style.visibility = 'visible';
    if (pick !== 1) { sfx(G, 'cancel'); return; }
    enterWorld(w, 'import');
  }

  function activateButton(id) {
    if (!id) return;
    if (id === 'retry') { if (banner?.slot) doSave(banner.slot); return; }
    if (id === 'dismiss') { banner = null; buttons = []; sfx(G, 'cancel'); return; }
    if (id === 'back') { closeText(); panel = 'list'; buttons = []; sfx(G, 'cancel'); return; }
    if (id === 'copy') { copyExport(); return; }
    if (id === 'read') { readImport(); return; }
    if (id.startsWith('slot:')) { openExport(id.slice(5)); }
  }

  function layoutButtons(y) {
    let x = PANEL.x + PANEL.w - 16;
    const rects = [];
    for (let i = buttons.length - 1; i >= 0; i--) {
      const w = measureText(buttons[i].label).w + 22;
      x -= w;
      rects[i] = { x, y, w, h: 13 };
      x -= 14;
    }
    btnFocus.setItems(buttons.map((b, i) => ({ id: b.id, rect: rects[i], enabled: true })), { keepId: false });
  }

  function layoutButtonsGrid() {
    const rects = buttons.map((b, i) => ({ x: PANEL.x + 24 + (i % 3) * 140, y: PANEL.y + 60 + Math.floor(i / 3) * 20, w: 120, h: 13 }));
    btnFocus.setItems(buttons.map((b, i) => ({ id: b.id, rect: rects[i], enabled: true })), { keepId: false });
  }

  // ------------------------------------------------------------------------------ textarea --
  function openText(value, readOnly) {
    closeText();
    if (typeof document === 'undefined' || !document.createElement) return;
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.readOnly = !!readOnly;
    ta.spellcheck = false;
    ta.setAttribute('aria-label', readOnly ? 'Save string to copy' : 'Paste a save string'); // str
    ta.setAttribute('autocomplete', 'off');
    if (!readOnly) ta.placeholder = 'Paste a save string here'; // str
    Object.assign(ta.style, {
      position: 'fixed', zIndex: '900', boxSizing: 'border-box', resize: 'none', margin: '0', padding: '6px',
      font: '12px/1.3 ui-monospace, Menlo, Consolas, monospace', color: COLORS.paper.ink, background: COLORS.paper.light,
      border: `2px solid ${COLORS.paper.edge}`, borderRadius: '2px', outline: 'none', wordBreak: 'break-all',
    });
    ta.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Escape') { ev.preventDefault(); activateButton('back'); }
      else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); activateButton(readOnly ? 'copy' : 'read'); }
    });
    // Key-ups are left to bubble on purpose: core/input must see the release of the key that opened
    // this panel (Enter goes down on the canvas, comes up in here), or that action stays held and the
    // next press never registers.
    document.body.appendChild(ta);
    textarea = ta;
    lastRect = '';
    placeText();
    try { ta.focus(); if (readOnly) ta.select(); } catch { /* focus can fail in a hidden tab */ }
  }

  function placeText() {
    if (!textarea) return;
    const canvas = G.display?.canvas;
    if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return;
    const b = canvas.getBoundingClientRect();
    const sx = b.width / 480, sy = b.height / 270;
    const key = `${b.left},${b.top},${b.width},${b.height}`;
    if (key === lastRect) return;
    lastRect = key;
    Object.assign(textarea.style, {
      left: `${Math.round(b.left + TEXT_RECT.x * sx)}px`, top: `${Math.round(b.top + TEXT_RECT.y * sy)}px`,
      width: `${Math.round(TEXT_RECT.w * sx)}px`, height: `${Math.round(TEXT_RECT.h * sy)}px`,
    });
  }

  function closeText() {
    if (textarea) {
      try { textarea.remove(); } catch { /* already gone */ }
      textarea = null;
    }
  }

  // ------------------------------------------------------------------------------- wiring --
  focus.on('change', () => sfx(G, 'cursor'));
  focus.on('blocked', () => sfx(G, 'blocked'));
  focus.on('activate', (ev) => { activateRow(ev.index); });
  focus.on('cancel', () => leave());
  btnFocus.on('change', () => sfx(G, 'cursor'));
  btnFocus.on('activate', (ev) => activateButton(buttons[ev.index]?.id));
  btnFocus.on('cancel', () => {
    if (banner && !banner.ok) { activateButton('dismiss'); return; }
    activateButton('back');
  });

  function leave() {
    sfx(G, 'cancel');
    closeText();
    if (G.scenes.top() === scene) G.scenes.pop(from === 'title' ? null : undefined);
  }

  // ------------------------------------------------------------------------------ drawing --
  function drawSlot(ctx, skin, r, i) {
    const rect = rowRect(i);
    const s = summaries.get(r.entry.slot) ?? slotSummary(r.entry);
    const focused = focus.index === i && panel === 'list' && !(banner && !banner.ok);
    drawCard(ctx, rect, skin, { focused, dim: (s.state !== 'ok' && tabs.active === 'load') || focus.items[i]?.enabled === false });
    if (r.kind === 'resume') {
      drawIcon(ctx, 'warn', rect.x + 8, rect.y + 9, { ink: skin.text, accent: COLORS.brass.fill });
      const n = s.savedAt ? Math.max(0, Math.round((Date.now() - s.savedAt) / 60000)) : 0;
      drawText(ctx, fitText(t('save.resume', { place: s.place, n }), rect.w - 30), rect.x + 22, rect.y + 4, { color: skin.text });
      drawText(ctx, 'The last session ended without closing. This is where it left off.', rect.x + 22, rect.y + 16, { font: 'small', color: skin.soft }); // str
      if (focused) drawCursorAt(ctx, rect.x - 7, rect.y + 9, ms, skin);
      return;
    }
    drawText(ctx, s.label, rect.x + 8, rect.y + 4, { color: r.entry.kind === 'auto' ? skin.soft : skin.accent });
    if (r.latest) drawText(ctx, 'latest', rect.x + 8, rect.y + 16, { font: 'small', color: skin.good }); // str
    if (s.state === 'empty') {
      drawText(ctx, t('save.slot.empty'), rect.x + 90, rect.y + 9, { color: skin.faint });
    } else if (s.state === 'corrupt') {
      drawIcon(ctx, 'cross', rect.x + 90, rect.y + 10, { ink: skin.bad });
      drawText(ctx, t('save.corrupt'), rect.x + 102, rect.y + 10, { color: skin.bad, maxWidth: rect.w - 110 });
    } else {
      // party icons
      s.party.slice(0, 6).forEach((c, k) => drawCreatureIcon(ctx, G, c, rect.x + 70 + k * 17, rect.y + 5));
      const tx = rect.x + 178;
      const room = rect.x + rect.w - 8 - Math.max(measureText(s.playTime).w, measureText(s.age, { font: 'small' }).w) - 8 - tx;
      drawText(ctx, fitText(s.place, room), tx, rect.y + 4, { color: skin.text });
      drawText(ctx, fitText(`Day ${s.day}, ${s.time}${s.name ? `  •  ${s.name}` : ''}`, room), tx, rect.y + 15, { color: skin.soft }); // str
      drawText(ctx, s.playTime, rect.x + rect.w - 8, rect.y + 4, { color: skin.text, align: 'right' });
      drawText(ctx, s.age, rect.x + rect.w - 8, rect.y + 16, { font: 'small', color: skin.soft, align: 'right' });
    }
    if (focused) drawCursorAt(ctx, rect.x - 7, rect.y + 9, ms, skin);
  }

  function drawTransfer(ctx, skin, prefs) {
    if (panel === 'list') {
      const labels = [[t('save.export'), 'Turn a saved slot into a string you can keep or move.'], [t('save.import'), 'Paste a string to play that season here.']]; // str
      labels.forEach(([a, b], i) => {
        const r = rowRect(i);
        const it = focus.items[i];
        const focused = focus.index === i;
        drawCard(ctx, r, skin, { focused, dim: it && it.enabled === false });
        drawText(ctx, a, r.x + 10, r.y + 4, { color: it && it.enabled === false ? skin.faint : skin.text });
        drawText(ctx, b, r.x + 10, r.y + 15, { font: 'small', color: skin.soft });
        if (focused) drawCursorAt(ctx, r.x - 7, r.y + 9, ms, skin);
      });
      drawBody(ctx, 'Strings carry a checksum: a damaged one is refused, never half-loaded.', PANEL.x + 12, PANEL.y + 100, PANEL.w - 24, { color: skin.soft, large: prefs.large, maxLines: 4 }); // str
      return;
    }
    if (panel === 'export-pick') {
      drawText(ctx, 'Export which save?', PANEL.x + 14, PANEL.y + 34, { color: skin.text }); // str
      drawButtons(ctx, skin);
      return;
    }
    drawText(ctx, panel === 'export' ? t('save.export') : t('save.import'), PANEL.x + 14, PANEL.y + 26, { color: skin.text });
    // the textarea floats over this frame; draw its frame so a screenshot still reads
    ctx.fillStyle = COLORS.paper.edge;
    ctx.fillRect(TEXT_RECT.x - 1, TEXT_RECT.y - 1, TEXT_RECT.w + 2, TEXT_RECT.h + 2);
    ctx.fillStyle = COLORS.paper.light;
    ctx.fillRect(TEXT_RECT.x, TEXT_RECT.y, TEXT_RECT.w, TEXT_RECT.h);
    drawText(ctx, note, PANEL.x + 14, PANEL.y + 36, { color: skin.soft, maxWidth: PANEL.w - 28 });
    drawText(ctx, panel === 'export' ? 'Enter: copy   Esc: back   Tab: buttons' : 'Enter: read it   Esc: back   Tab: buttons', TEXT_RECT.x, TEXT_RECT.y + TEXT_RECT.h + 11, { font: 'small', color: skin.faint }); // str
    drawButtons(ctx, skin);
  }

  function drawButtons(ctx, skin) {
    buttons.forEach((b, i) => {
      const r = btnFocus.items[i]?.rect;
      if (!r) return;
      const role = b.id === 'retry' || b.id === 'copy' || b.id === 'read' ? 'neutral' : b.id === 'back' || b.id === 'dismiss' ? 'safe' : 'neutral';
      drawSealButton(ctx, b.label, r.x, r.y, { focused: btnFocus.index === i, role, w: r.w });
    });
    const cur = btnFocus.current()?.rect;
    const onWax = !!(banner && !banner.ok);
    if (cur) drawCursorAt(ctx, cur.x - 7, cur.y + 3, ms, onWax || skin.dark ? skinOf({ contrast: true }) : skin);
  }

  function drawBanner(ctx, skin) {
    if (!banner) return;
    const reduced = prefsOf(G).reduced;
    const k = reduced ? 1 : Math.min(1, banner.t / 83);
    const x = PANEL.x + 10 + Math.round((1 - k) * 14), y = PANEL.y + (banner.ok ? 2 : 4), w = PANEL.w - 20, h = banner.ok ? 18 : 44;
    if (banner.ok) {
      // the stamp covers only the subtitle strip: the first card (at PANEL.y + 23) stays readable
      drawSkinPanel(ctx, { x, y, w, h }, skin, 'notice', { torn: 'none' });
      drawSeal(ctx, x + 6, y + 3, { fill: PALETTE.g, light: PALETTE.l, ink: PALETTE.t, emblem: 'check' });
      const tw = drawText(ctx, banner.title, x + 22, y + 5, { color: skin.text }).w;
      drawText(ctx, fitText(banner.detail, w - tw - 40), x + w - 8, y + 5, { color: skin.soft, align: 'right' });
    } else {
      ctx.fillStyle = COLORS.shadow;
      ctx.fillRect(x + 1, y + 2, w, h);
      ctx.fillStyle = COLORS.wax.fill;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = COLORS.wax.dark;
      ctx.fillRect(x, y + h - 2, w, 2);
      drawIcon(ctx, 'cross', x + 8, y + 6, { ink: COLORS.wax.text });
      drawText(ctx, banner.title, x + 20, y + 6, { color: COLORS.wax.text });
      drawText(ctx, banner.detail, x + 20, y + 17, { color: COLORS.wax.text, maxWidth: w - 190 });
      drawButtons(ctx, skin);
    }
  }

  // -------------------------------------------------------------------------------- scene --
  const scene = {
    name: 'saveLoad',
    opaque: true,
    enter(params = {}) {
      G.input?.flush?.();
      ms = 0; banner = null; panel = 'list'; buttons = [];
      from = params?.from === 'title' ? 'title' : 'menu';
      noRewind = params?.noRewind === true || isNoRewind(G.world);
      try { crashed = from === 'title' && persist()?.crashed?.() === true; } catch { crashed = false; }
      const ids = ['save', 'load', 'transfer'].filter((id) => !(id === 'save' && (noRewind || from === 'title')));
      tabs.setItems(ids.map((id) => ({ id, label: id === 'save' ? t('menu.save') : id === 'load' ? 'Load' : 'Transfer' }))); // str
      const want = params?.mode === 'transfer' ? 'transfer' : params?.mode === 'load' ? 'load' : 'save';
      tabs.setActive(ids.includes(want) ? want : ids[0]);
      rebuild(true);
    },
    exit() { closeText(); },
    pause() { if (textarea) textarea.style.visibility = 'hidden'; },
    resume() { G.input?.flush?.(); if (textarea) textarea.style.visibility = 'visible'; },
    update(dt) {
      ms += dt;
      if (banner) {
        banner.t += dt;
        if (banner.ok && banner.t > 2600) banner = null;
        else if (!banner.ok && banner.slot) {
          // persist retries a failed write once after 2 s: a quiet success clears the red banner
          const st = persist()?.status?.();
          if (st && !st.failed && st.lastOk && st.lastOk.slot === `manual:${banner.slot}`) {
            banner = { ok: true, title: t('save.verified'), detail: slotLabel({ kind: 'manual', index: banner.slot }), t: 0 };
            buttons = [];
            rebuild(false);
          }
        }
      }
      focus.update(dt); btnFocus.update(dt);
    },
    handleInput(input) {
      if (busy) return;
      if (banner && !banner.ok && buttons.length) { btnFocus.handle(input); return; }
      if (panel !== 'list') { btnFocus.handle(input); return; }
      const before = tabs.active;
      tabs.handle(input);
      if (tabs.active === before) {
        if (input.repeat('left')) tabs.prev();
        else if (input.repeat('right')) tabs.next();
      }
      if (tabs.active !== before) return;
      focus.handle(input);
    },
    draw(ctx) {
      const prefs = prefsOf(G);
      const skin = skinOf(prefs);
      drawBackdrop(ctx, prefs);
      drawSkinPanel(ctx, PANEL, skin, 'paper');
      tabs.draw(ctx);
      const head = tabs.active === 'save' ? 'Save your season' : tabs.active === 'load' ? 'Pick up a season' : 'Move a season'; // str
      drawText(ctx, head, 468, 9, { color: COLORS.paper.light, align: 'right' });
      if (tabs.active === 'transfer') drawTransfer(ctx, skin, prefs);
      else {
        if (noRewind) drawText(ctx, forwardOnly() ? `${t('save.noRewind')} Loading waits for the title.` : t('save.noRewind'), PANEL.x + 14, PANEL.y + 12, { color: skin.soft }); // str
        else drawText(ctx, tabs.active === 'save' ? 'Three slots of your own. The game keeps three autosaves as well.' : 'Your slots, then the autosaves (doors, Waystones, catches, Forecasts).', PANEL.x + 14, PANEL.y + 12, { color: skin.soft, maxWidth: PANEL.w - 28 }); // str
        rows.forEach((r, i) => drawSlot(ctx, skin, r, i));
        if (!rows.length) drawBody(ctx, noRewind ? 'Under No Rewind the season saves itself at doors and Waystones; there is nothing to pick here.' : 'Nothing saved yet.', PANEL.x + 14, PANEL.y + 34, PANEL.w - 28, { color: skin.faint, large: prefs.large }); // str
      }
      // the focus model's tooltip: a press on a disabled row (empty, damaged, No Rewind) says why
      if (panel === 'list' && !(banner && !banner.ok)) focus.drawCursor(ctx, { style: skin.style, cursor: false, ring: false });
      drawBanner(ctx, skin);
      if (panel === 'export' || panel === 'import') placeText();
      const hints = panel !== 'list' || (banner && !banner.ok) ? [['confirm', 'Choose'], ['cancel', 'Back']] : [['l', ''], ['r', 'Tab'], ['confirm', tabs.active === 'save' ? 'Save' : tabs.active === 'load' ? (forwardOnly() ? 'Why not' : 'Load') : 'Choose'], ['cancel', 'Back']]; // str
      drawHints(ctx, G.input, hints);
    },
    debugText() {
      const lines = [`Save/Load [${tabs.active}] from=${from}${noRewind ? ' noRewind' : ''}`];
      for (const [i, r] of rows.entries()) {
        const s = summaries.get(r.entry.slot);
        lines.push(`${i === focus.index ? '>' : ' '} ${r.kind === 'resume' ? 'resume ' : ''}${s?.label ?? r.entry.slot}: ${s?.state === 'ok' ? `${s.place} Day ${s.day} ${s.time} party=${s.party.length}` : s?.state}`);
      }
      if (banner) lines.push(`banner: ${banner.ok ? 'Saved' : 'Not saved'} ${banner.detail}`);
      if (panel !== 'list') lines.push(`panel: ${panel}${textarea ? ' textarea' : ''}`);
      return lines.join('\n');
    },
    get panel() { return panel; },
    get banner() { return banner; },
    get hasTextarea() { return !!textarea; },
  };
  return scene;
}

/** Re-exported so tests can label slots exactly as the screen does. */
export { slotLabel, ageText };
