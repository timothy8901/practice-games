/**
 * The Keeper's Field Log: 42 creature plates and the fish, bug and find collections.
 * All discovery state comes from systems/fieldLog; browsing never changes a record.
 * @module scenes/fieldLog
 */
import { drawText, wrapText } from '../core/font.js';
import { drawTypeChip, drawBadge } from '../ui/widgets.js';
import { drawIcon } from '../ui/icons.js';
import { createFocus } from '../ui/focus.js';
import { createList } from '../ui/list.js';
import { PALETTE, COLORS } from '../ui/theme.js';
import * as logSys from '../systems/fieldLog.js';
import { drawCreature as drawCreatureArt } from '../art/creatures/index.js';
import {
  prefsOf, skinOf, drawSkinPanel, drawBackdrop, drawHeading, drawHints,
  drawCreatureIcon, fitText, sfx, createSlide,
} from './menuKit.js';

export const LOG_TABS = Object.freeze([
  { id: 'forms', label: 'Creatures', table: 'species' },
  { id: 'fish', label: 'Fish', kind: 'fish', record: 'fish' },
  { id: 'bugs', label: 'Bugs', kind: 'bug', record: 'bugs' },
  { id: 'finds', label: 'Finds', kind: 'relic', record: 'relics' },
]);
const COLS = 7;
const GRID = { x: 30, y: 42, w: 60, h: 33 };
const PANEL = { x: 8, y: 36, w: 464, h: 204 };
const LIST = { x: 16, y: 46, w: 180, h: 184 };
const PREVIEW = { x: 204, y: 44, w: 258, h: 186 };
const TAB_Y = 18;
const pretty = (s) => String(s ?? '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const hit = (p, r) => p && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

/** One discovery model shared by the grid, scrolling collection list and details. Pure. */
export function fieldLogRows(world, data, tabId = 'forms') {
  const tab = LOG_TABS.find((t) => t.id === tabId) ?? LOG_TABS[0];
  const rows = tab.id === 'forms' ? logSys.rowsOf(data, 'species') : logSys.collectionRows(data, tab.kind);
  return rows.filter(logSys.isLogged).map((row, index) => {
    const entry = tab.id === 'forms' ? logSys.formEntry(world, row.id) : world?.collections?.[tab.record]?.[row.id] ?? {};
    const held = tab.id === 'forms' ? !!entry.held : (entry.n ?? 0) > 0;
    const seen = tab.id === 'forms' ? !!entry.seen || held || !!entry.read : held;
    const status = tab.id === 'forms' ? held ? 'Held' : entry.read ? 'Read' : seen ? 'Seen' : 'Unseen' : held ? `Caught ${entry.n}` : 'Not collected';
    return { id: row.id, row, index, entry, seen, held, status, name: seen ? row.name : '???', donated: logSys.isDonated(world, row.id) };
  });
}

/** Collection availability in plain words; times wrap naturally across midnight. Pure. */
export function availability(row) {
  const hours = row.hours?.length === 1 && row.hours[0][0] === 0 && row.hours[0][1] === 24 ? 'Any hour' : row.hours?.length ? row.hours.map(([a, b]) => `${String(a).padStart(2, '0')}:00–${String(b).padStart(2, '0')}:00`).join(', ') : row.night ? '18:00–06:00' : row.day ? '06:00–18:00' : 'Any hour';
  const tide = !row.tide || row.tide === 'any' ? 'Any tide' : `${(Array.isArray(row.tide) ? row.tide : [row.tide]).map(pretty).join(' / ')} tide`;
  return `${hours} / ${tide}`;
}

/** @param {any} G */
export function createFieldLogScene(G) {
  let tabIndex = 0;
  let rows = [];
  let detail = false;
  let scroll = 0;
  let ms = 0;
  const selections = [0, 0, 0, 0];
  const slide = createSlide({ dx: 10 });
  const gridFocus = createFocus({ cols: COLS, wrap: true, items: [] });
  const world = () => G.world;
  const data = () => G.data;
  const skin = () => skinOf(prefsOf(G));
  const tab = () => LOG_TABS[tabIndex];
  const selected = () => rows[tabIndex === 0 ? gridFocus.index : list.index] ?? null;
  const rectOf = (i) => ({ x: GRID.x + (i % COLS) * GRID.w, y: GRID.y + Math.floor(i / COLS) * GRID.h, w: GRID.w - 3, h: GRID.h - 3 });
  const close = () => slide.close(() => G.scenes.pop(), prefsOf(G));
  const open = () => { detail = true; scroll = 0; sfx(G, 'confirm'); };
  const list = createList({
    rect: LIST, rowH: 15, items: [], rules: false, style: skin().style,
    onSelect: open, onCancel: close, onChange: () => { scroll = 0; sfx(G, 'cursor'); },
    render(ctx, item, x, y, w) {
      const sk = skin();
      drawText(ctx, item.data.held ? '•' : '—', x + 2, y + 4, { color: item.data.held ? sk.good : sk.faint, font: 'small' });
      drawText(ctx, fitText(item.data.name, w - 30), x + 12, y + 3, { color: sk.text });
      drawText(ctx, String(item.data.index + 1).padStart(2, '0'), x + w - 4, y + 4, { color: sk.faint, align: 'right', font: 'small' });
    },
  });
  gridFocus.on('activate', open);
  gridFocus.on('cancel', close);
  gridFocus.on('change', () => sfx(G, 'cursor'));

  function refresh() {
    rows = fieldLogRows(world(), data(), tab().id);
    gridFocus.setItems(rows.map((r, i) => ({ id: r.id, rect: rectOf(i) })));
    list.setItems(rows.map((r) => ({ id: r.id, label: r.name, data: r })));
    gridFocus.set(selections[tabIndex] ?? 0);
    list.select(selections[tabIndex] ?? 0);
  }

  function changeTab(dirOrIndex, absolute = false) {
    selections[tabIndex] = tabIndex === 0 ? gridFocus.index : list.index;
    tabIndex = absolute ? dirOrIndex : (tabIndex + dirOrIndex + LOG_TABS.length) % LOG_TABS.length;
    detail = false;
    scroll = 0;
    refresh();
    sfx(G, 'cursor');
  }

  function enter(params = {}) {
    tabIndex = Math.max(0, LOG_TABS.findIndex((t) => t.id === params.tab));
    detail = false;
    scroll = 0;
    ms = 0;
    refresh();
    slide.open(prefsOf(G));
    if (params.formId) {
      const i = rows.findIndex((r) => r.id === params.formId);
      if (i >= 0) { gridFocus.set(i); detail = true; }
    }
  }

  function detailLines(item) {
    if (!item) return [];
    const r = item.row;
    if (tabIndex === 0) {
      const family = logSys.rowOf(data(), 'families', r.familyId);
      const ab = logSys.rowOf(data(), 'abilities', item.entry.ability ?? world()?.run?.gen?.abilities?.[r.id] ?? r.ability);
      const ability = item.entry.read || item.held ? `${ab?.name ?? pretty(r.ability)}. ${ab?.text ?? ''}` : 'Read this form in battle to record its ability.';
      const familyForms = logSys.rowsOf(data(), 'species').filter((s) => s.familyId === r.familyId);
      const names = familyForms.map((s) => logSys.formEntry(world(), s.id).seen ? s.name : '???').join(' / ');
      return [item.seen ? r.flags?.log ?? r.flags?.feature ?? 'A new shape on the Brindle Isles.' : 'A silhouette waits for its first encounter.', '', `Habitat: ${r.flags?.habitat ?? 'Keep exploring the isles.'}`, '', `Ability: ${ability}`, '', `${family?.name ?? 'Family'}: ${names}`, '', r.flags?.neverShifts ? 'This form never Shifts.' : 'A Shift keeps the same individual, nickname and Heartmark.'];
    }
    const record = item.entry;
    const notes = [r.habitat ?? (r.where?.length ? `Found around ${r.where.map(pretty).join(', ')}.` : `Look for ${r.source?.map(pretty).join(', ') ?? 'sparkles and cracks'} around the flats.`), '', availability(r), `Rarity: ${pretty(r.rarity ?? 'common')}`, ''];
    if (tabIndex === 1) {
      notes.push(item.held ? `Caught: ${record.n} / Personal best: ${record.best ?? 0} cm` : 'Catch one to begin your record.');
      if (logSys.tellLearned(world(), r.id)) notes.push('', `Tell — ${r.tell?.word ?? ''}: ${r.tell?.text ?? ''}`);
      else notes.push('', `Fish tell: ${logSys.tellCatchesLeft(world(), r.id, { data: data() })} more catches to learn it. Watch the float.`);
      const patient = world()?.collections?.patientBest?.[r.id];
      if (patient > 0) notes.push(`Patient mode best: ${patient} cm`);
    } else if (tabIndex === 2) notes.push(`Movement: ${r.move ?? 'Watch, walk, then swing the net.'}`, `Habitat: ${Array.isArray(r.habitat) ? r.habitat.map(pretty).join(', ') : r.habitat ?? 'The harbor lanes'}`, item.held ? `Caught: ${record.n}` : 'Walk up slowly; running can startle it.');
    else notes.push(item.held ? `Found: ${record.n} / ${record.cleaned ? 'Cleaned' : logSys.cleanedOnce(world(), r.id) ? 'Cleaned once' : 'Uncleaned'}` : 'Dig cracks or search shore sparkles to collect it.', r.skyglass ? 'Skyglass: the Carnival Raft can refine this into Starsalt.' : '', r.letter ? `String-wall connection: ${String(r.letter).toUpperCase()}` : '');
    notes.push('', item.donated ? 'Donated to Barnaby’s Archive.' : 'Bring a specimen to Barnaby’s Archive to donate it.');
    if (item.held && r.archive) notes.push('', `Barnaby: ${r.archive}`);
    return notes;
  }

  function handleInput(input) {
    if (slide.closing) return;
    const p = input.pointer;
    if (p?.justDown) {
      for (let i = 0; i < LOG_TABS.length; i++) if (hit(p, { x: 16 + i * 112, y: TAB_Y, w: 108, h: 15 })) { changeTab(i, true); return; }
      if (hit(p, { x: 434, y: 241, w: 38, h: 13 })) { if (detail) { detail = false; scroll = 0; } else close(); sfx(G, 'cancel'); return; }
    }
    if (input.pressed('l')) { changeTab(-1); return; }
    if (input.pressed('r')) { changeTab(1); return; }
    if (detail) {
      if (input.pressed('cancel') || input.pressed('confirm')) { detail = false; scroll = 0; sfx(G, 'cancel'); return; }
      if (input.repeat('left') || input.repeat('right')) {
        const dir = input.repeat('left') ? -1 : 1;
        const i = ((tabIndex === 0 ? gridFocus.index : list.index) + dir + rows.length) % Math.max(1, rows.length);
        if (tabIndex === 0) gridFocus.set(i); else list.select(i);
        scroll = 0;
      }
      if (input.repeat('up')) scroll = Math.max(0, scroll - 1);
      if (input.repeat('down')) scroll++;
      if (p?.justDown && hit(p, { x: 445, y: 54, w: 20, h: 180 })) scroll += p.y < 140 ? -5 : 5;
      scroll = Math.max(0, scroll);
      return;
    }
    if (tabIndex === 0) gridFocus.handle(input);
    else {
      if (input.repeat('left')) list.pageBy(-1);
      if (input.repeat('right')) list.pageBy(1);
      if (p?.justDown && hit(p, { x: 12, y: 231, w: 186, h: 8 })) { list.pageBy(p.x < 105 ? -1 : 1); return; }
      list.focus.handle(input);
    }
  }

  function drawTabs(ctx, sk) {
    LOG_TABS.forEach((t, i) => {
      const r = { x: 16 + i * 112, y: TAB_Y, w: 108, h: 15 };
      ctx.fillStyle = i === tabIndex ? sk.card : '#29366F';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      drawText(ctx, t.label, r.x + r.w / 2, r.y + 4, { color: i === tabIndex ? sk.text : COLORS.paper.light, align: 'center' });
      if (i === tabIndex) { ctx.fillStyle = PALETTE.y; ctx.fillRect(r.x, r.y + r.h - 1, r.w, 1); }
    });
  }

  function owned(item) {
    const c = [...(world()?.party ?? []), ...(world()?.box ?? [])].find((c) => c.speciesId === item.id);
    return c ?? { uid: `log:${item.id}`, speciesId: item.id, types: item.row.types, wild: !item.held, mark: { x: 0, y: 0 } };
  }

  function drawForms(ctx, sk) {
    rows.forEach((item, i) => {
      const r = rectOf(i);
      const focused = i === gridFocus.index;
      ctx.fillStyle = focused ? sk.band : sk.card;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = focused ? sk.accent : sk.cardEdge;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      drawCreatureIcon(ctx, G, owned(item), r.x + 3, r.y + 2, { grey: !item.seen });
      drawText(ctx, String(i + 1).padStart(2, '0'), r.x + 24, r.y + 3, { font: 'small', color: sk.faint });
      const glyph = item.held ? '✦' : item.entry.read ? '◉' : item.seen ? '•' : '—';
      drawText(ctx, `${glyph} ${item.status}`, r.x + 22, r.y + 13, { font: 'small', color: item.held ? sk.good : sk.soft });
      drawText(ctx, fitText(item.name, r.w - 6, { font: 'small' }), r.x + 3, r.y + 23, { font: 'small', color: sk.text });
    });
    gridFocus.drawCursor(ctx, { style: sk.style, ring: false });
  }

  function drawSpecimen(ctx, item, x, y, large = false) {
    const color = item.held ? tabIndex === 1 ? '#41A6F6' : tabIndex === 2 ? '#A7F070' : item.row.skyglass ? '#FF5BD6' : '#C9A96B' : '#566C86';
    const scale = large ? 3 : 2;
    if (tabIndex === 0) {
      const c = owned(item);
      drawCreatureArt(ctx, item.id, x, y, { scale, types: item.row.types, mark: c.mark, star: c.starTouched, lit: item.held, silhouette: item.seen ? null : '#566C86', frame: prefsOf(G).reduced ? 0 : Math.floor(ms / 550) % 2 });
      return;
    }
    // A stamp in Barnaby's log: fish, a winged bug or a faceted find. The silhouette remains before discovery.
    const stamp = tabIndex === 1 ? ["....##.......", "..######..#..", ".###########.", "###.#######..", ".###########.", "..######..#..", "....##......."] : tabIndex === 2 ? [".##..#..##.", "####.#.####", "#####.#####", "..#######..", "...#####...", "..#######..", "..#..#..#.."] : ["....##....", "..######..", ".########.", "##########", ".########.", "..######..", "....##...."];
    const cell = large ? 5 : 4;
    const offsetX = large ? 13 : 2;
    stamp.forEach((row, yy) => [...row].forEach((v, xx) => { if (v === '#') { ctx.fillStyle = color; ctx.fillRect(x + offsetX + xx * cell, y + 20 + yy * cell, cell, cell); } }));
    if (item.held) { ctx.fillStyle = COLORS.paper.light; ctx.fillRect(x + offsetX + 3 * cell, y + 23 + 2 * cell, cell, cell); }
  }

  function drawPreview(ctx, item, sk) {
    drawSkinPanel(ctx, PREVIEW, sk, 'card');
    if (!item) return;
    drawText(ctx, item.name, PREVIEW.x + 12, PREVIEW.y + 10, { color: sk.text });
    drawSpecimen(ctx, item, PREVIEW.x + 12, PREVIEW.y + 25);
    drawText(ctx, item.status, PREVIEW.x + 96, PREVIEW.y + 34, { color: sk.good });
    if (item.donated) drawText(ctx, 'Archive: donated', PREVIEW.x + 96, PREVIEW.y + 49, { color: sk.soft, font: 'small' });
    const lines = wrapText(detailLines(item).slice(0, 4).join('\n'), PREVIEW.w - 24);
    lines.slice(0, 6).forEach((line, i) => drawText(ctx, line, PREVIEW.x + 12, PREVIEW.y + 93 + i * 11, { color: sk.soft }));
    drawText(ctx, 'Open the plate for notes', PREVIEW.x + 12, PREVIEW.y + PREVIEW.h - 15, { font: 'small', color: sk.faint });
  }

  function drawDetail(ctx, item, sk) {
    if (!item) return;
    drawSkinPanel(ctx, PANEL, sk, 'ledger');
    drawText(ctx, `${String(item.index + 1).padStart(2, '0')}  ${item.name}`, 24, 47, { color: sk.text });
    drawBadge(ctx, item.status, 24, 64, { small: true, style: item.held ? 'safe' : 'neutral' });
    drawSpecimen(ctx, item, 28, 88, true);
    if (tabIndex === 0 && item.seen) {
      let x = 24;
      for (const type of item.row.types ?? []) x += drawTypeChip(ctx, type.toLowerCase(), x, 204) + 3;
    }
    const body = detailLines(item).join('\n');
    const lines = wrapText(body, 282);
    const visible = 15;
    scroll = Math.max(0, Math.min(scroll, Math.max(0, lines.length - visible)));
    ctx.save();
    ctx.beginPath(); ctx.rect(162, 55, 290, 172); ctx.clip();
    lines.slice(scroll, scroll + visible).forEach((line, i) => drawText(ctx, line, 162, 57 + i * 11, { color: sk.text }));
    ctx.restore();
    if (scroll > 0) drawText(ctx, '▲', 454, 57, { color: sk.accent });
    if (scroll + visible < lines.length) drawText(ctx, '▼', 454, 216, { color: sk.accent });
    drawText(ctx, `${scroll + 1}/${Math.max(1, lines.length - visible + 1)}`, 135, 224, { color: sk.faint, font: 'small', align: 'right' });
  }

  function draw(ctx) {
    const sk = skin();
    drawBackdrop(ctx, prefsOf(G));
    drawHeading(ctx, 'Field Log', 'The Brindle Isles');
    ctx.save();
    ctx.globalAlpha *= slide.alpha();
    ctx.translate(slide.offset(), 0);
    drawTabs(ctx, sk);
    if (detail) drawDetail(ctx, selected(), sk);
    else {
      drawSkinPanel(ctx, PANEL, sk, 'ledger');
      if (tabIndex === 0) drawForms(ctx, sk);
      else { list.draw(ctx); drawPreview(ctx, selected(), sk); }
    }
    const done = rows.filter((r) => r.held).length;
    const seen = rows.filter((r) => r.seen).length;
    const counter = tabIndex === 0 ? `${done}/${rows.length} Held / ${seen} Seen / ${rows.filter((r) => r.entry.read).length} Read` : `${done}/${rows.length} collected / ${rows.filter((r) => r.donated).length} donated`;
    drawText(ctx, counter, 10, 244, { color: COLORS.paper.light, font: 'small' });
    drawText(ctx, 'Back', 466, 244, { color: COLORS.paper.light, font: 'small', align: 'right' });
    if (tabIndex > 0 && !detail) drawText(ctx, '◀ previous page       next page ▶', 22, 233, { color: sk.soft, font: 'small' });
    ctx.restore();
    drawHints(ctx, G.input, detail ? [['up', 'Scroll'], ['left', 'Plate'], ['cancel', 'Back']] : [['l', 'Tab'], ['r', 'Tab'], ['confirm', 'Open'], ['cancel', 'Close']]);
  }

  return {
    name: 'fieldLog', opaque: true, enter, exit() {}, pause() {}, resume() { refresh(); },
    update(dt) { ms += dt; slide.update(dt); gridFocus.update(dt); list.update(dt); },
    handleInput, draw, isBusy: () => slide.closing,
    debugText: () => `fieldLog ${tab().id} ${detail ? 'detail' : 'list'} | ${selected()?.id ?? 'empty'} | ${selected()?.status ?? ''} | ${rows.filter((r) => r.held).length}/${rows.length} | scroll ${scroll}`,
  };
}
