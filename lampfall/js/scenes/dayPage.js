/**
 * Dimity's Day Page and the dawn. [SCN-UI] — GDD-00 §5 Rest, §9 Day Page, §13; GDD-09 §3.21, §3.22.
 *
 * A journal page (352×238 at 64,16, ledger paper) inks in top to bottom over 60 f: the day's heading,
 * buttons earned, the loan, catches, Forecasts, who you talked to, Shifts and notable notes, then
 * ***Tomorrow:*** (at most six items, from `systems/dayPage` via the summary) and the save check: a
 * *Saved, verified* stamp, or the red *Not saved* banner that stays until a save succeeds. Words come
 * from `data/town` DAY_PAGE / TOMORROW (Dimity's voice) and `data/strings`.
 *
 * Modes (`params.mode`):
 *  - `sleep`: the page, then the **dawn build** vignette when a build landed (40 f tie-off: a 160×90
 *    inset at 160,60 framed in cream; the roof fills in its colour in two dither steps, the scaffold
 *    rises a section; skippable after 20 f), then the 06:00 morning card; then `onClose`.
 *  - `sit` (porch bench) / `quit`: the page of today so far; closing calls `onClose`.
 *  - `build`: the dawn vignette alone (a build landing at 05:40 while you are up).
 *  - `tonight`: before Sleep — *Still tonight:* (what the night holds) with *Not yet* / *Sleep*
 *    (Not yet first); `onClose({sleep: boolean})`.
 * Input: confirm completes the ink, then closes; cancel the same (never changes state).
 * Pops with the same object `onClose` receives.
 * @module scenes/dayPage
 */
import { drawText, measureText } from '../core/font.js';
import { formatMinute } from '../core/time.js';
import { ease } from '../core/tween.js';
import { drawPanel } from '../ui/panel.js';
import { drawSealButton } from '../ui/widgets.js';
import { COLORS, PALETTE, TIMING, TYPE } from '../ui/theme.js';
import { t, fill } from '../data/strings.js';
import { DAY_PAGE, TOMORROW, ROOF_COLOURS } from '../data/town.js';
import * as loans from '../systems/loans.js';
import * as dayPageSys from '../systems/dayPage.js';
import { lowsOn } from '../systems/schedule.js';
import { reducedMotion, skipAnims, framesMs } from './scriptHost.js';

/** Page geometry (GDD-09 §3.22). */
export const PAGE = Object.freeze({ x: 64, y: 16, w: 352, h: 238 });
export const STAMP = Object.freeze({ x: 304, y: 228, w: 96, h: 20 });
export const INSET = Object.freeze({ x: 160, y: 60, w: 160, h: 90 });
/** Ink time (60 f) and the vignette (40 f). */
export const INK_FRAMES = 60;
export const BUILD_FRAMES = 40;
export const TOMORROW_MAX = 6;
const WEEKDAYS = Object.freeze(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);

/**
 * Words for an id ('harbor-red' -> 'harbor red').
 * @param {string} id
 * @returns {string}
 */
export function words(id) {
  return String(id ?? '').replace(/-/g, ' ');
}

/**
 * The name of an npc, species or item id from the registry, else words.
 * @param {any} data
 * @param {string} table
 * @param {string} id
 * @returns {string}
 */
function nameOf(data, table, id) {
  try {
    if (data && typeof data.has === 'function' && data.has(table, id)) return data.get(table, id).name ?? words(id);
  } catch { /* fall through */ }
  return words(id).replace(/^./, (c) => c.toUpperCase());
}

/**
 * One *Tomorrow:* line for an item (`systems/dayPage` TomorrowItem) in Dimity's words. Pure.
 * @param {{kind: string, id?: any, params?: Record<string, any>}} it
 * @param {{data?: any, world?: any}} [ctx]
 * @returns {string}
 */
export function tomorrowLine(it, ctx = {}) {
  const p = it.params ?? {};
  const data = ctx.data;
  const fmt = (m) => (Number.isFinite(m) ? formatMinute(((Math.floor(m) % 1440) + 1440) % 1440) : '');
  let line;
  switch (it.kind) {
    case 'build': line = fill(TOMORROW.build, { build: `the ${words(it.id)}` }); break; // str
    case 'forecast': {
      const lows = ctx.world ? nextLowWord(ctx.world) : '';
      line = fill(TOMORROW.forecast, { nick: p.nickname ?? 'a creature', time: lows || 'next' }); // str
      break;
    }
    case 'letter': line = fill(TOMORROW.letter, { label: it.id ?? 'a letter' }); break; // str
    case 'beat': line = fill(TOMORROW.beat, { who: nameOf(data, 'npcs', p.npcId ?? ''), title: p.title ?? '' }); break;
    case 'low': line = fill(TOMORROW.low, { times: (p.minutes ?? []).map(fmt).join(' and ') }); break; // str
    case 'carry': line = fill(p.atCounter ? TOMORROW.carryCounter : TOMORROW.carry, { label: it.id ?? '' }); break;
    case 'heirloom': line = fill(TOMORROW.heirloom, { label: it.id ?? '' }); break;
    case 'errant': line = fill(TOMORROW.errant, { errant: p.name ?? words(it.id), isle: p.isle ?? p.place ?? '' }); break;
    case 'spire': line = fill(TOMORROW.spire, { spire: p.name ?? words(it.id), curve: p.curve ?? '' }); break;
    default: line = TOMORROW[it.kind] ? fill(TOMORROW[it.kind], { ...p, id: it.id }) : words(it.kind);
  }
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/**
 * The next low's time from now (core day lows from systems/schedule), for the Forecast line.
 * @param {any} world
 * @returns {string}
 */
function nextLowWord(world) {
  try {
    const total = Math.floor(world.clock?.total ?? 0);
    const day = Math.floor(total / 1440);
    for (const d of [day, day + 1]) {
      for (const m of lowsOn(world, d)) if (d * 1440 + m > total) return formatMinute(((Math.floor(m) % 1440) + 1440) % 1440);
    }
  } catch { /* no tide */ }
  return '';
}

/**
 * The page's body lines for a summary (`systems/dayPage` DaySummary). Pure.
 * @param {any} s
 * @param {{data?: any, world?: any}} [ctx]
 * @returns {{heading: string, lines: Array<{text: string, kind: string}>, tomorrow: string[], signOff: string}}
 */
export function pageLines(s, ctx = {}) {
  const data = ctx.data;
  const world = ctx.world;
  const S = DAY_PAGE.sections;
  const heading = fill(DAY_PAGE.header, { day: s?.gameDay ?? 1, weekday: WEEKDAYS[((s?.dow ?? 0) % 7 + 7) % 7] });
  /** @type {Array<{text: string, kind: string}>} */
  const lines = [];
  const notes = Array.isArray(s?.notes) ? s.notes : [];
  // buttons
  lines.push({ kind: 'buttons', text: s?.buttons > 0 ? `Buttons: ${s.buttons.toLocaleString('en-US')}◉ in.` : S.buttonsQuiet }); // str
  // loan
  try {
    if (world && loans.isPaidOff(world, { data })) lines.push({ kind: 'loan', text: S.loanDone });
    else if (world) {
      const left = loans.balance(world, { data });
      const tier = world.loans?.tier ?? 1;
      const cleared = notes.filter((n) => n.startsWith('cleared:')).map((n) => n.slice(8));
      for (const c of cleared) lines.push({ kind: 'loan', text: fill(S.loanCleared, { tier: c }) });
      if (s?.loanPaid > 0 && !cleared.length) lines.push({ kind: 'loan', text: fill(S.loan, { paid: s.loanPaid.toLocaleString('en-US'), left: left.toLocaleString('en-US'), tier }) });
      else if (!cleared.length) lines.push({ kind: 'loan', text: `${left.toLocaleString('en-US')}◉ to go on loan ${tier}.` }); // str
    }
  } catch { /* no loan data */ }
  // catches
  const caught = notes.filter((n) => n.startsWith('caught:')).map((n) => nameOf(data, 'species', n.slice(7)));
  const fish = s?.fish ?? 0;
  if (caught.length || fish) {
    const list = [...caught];
    if (fish) list.push(`${fish} fish`); // str
    lines.push({ kind: 'catches', text: fill(S.catches, { list: list.join(', ') }) });
  } else lines.push({ kind: 'catches', text: S.catchesNone });
  // Forecasts and Shifts
  if (s?.forecasts > 0) lines.push({ kind: 'shifts', text: `Forecasts read: ${s.forecasts}.` }); // str
  for (const n of notes.filter((x) => x.startsWith('shift:'))) {
    const uid = n.slice(6);
    const c = [...(world?.party ?? []), ...(world?.box ?? [])].find((x) => x.uid === uid);
    if (c) lines.push({ kind: 'shifts', text: fill(S.shifts, { nick: c.nickname, form: nameOf(data, 'species', c.speciesId) }) });
  }
  // letters, badges, heirlooms
  for (const n of notes) {
    if (n.startsWith('read:')) lines.push({ kind: 'note', text: fill(S.letter, { label: n.slice(5) }) });
    else if (n.startsWith('badge:')) lines.push({ kind: 'note', text: fill(S.badge, { spire: words(n.slice(6)) }) });
    else if (n.startsWith('built:')) lines.push({ kind: 'note', text: `The ${words(n.slice(6))} is finished.` }); // str
  }
  // people
  const people = (s?.talkedTo ?? []).map((id) => nameOf(data, 'npcs', id));
  lines.push({ kind: 'people', text: people.length ? fill(S.people, { list: people.join(', ') }) : S.peopleNone });
  if (lines.length <= 4 && !(s?.buttons > 0) && !caught.length && !people.length) {
    const q = DAY_PAGE.quietDay;
    lines.push({ kind: 'quiet', text: q[(s?.day ?? 0) % q.length] });
  }
  const tomorrow = (s?.tomorrow ?? []).slice(0, TOMORROW_MAX).map((it) => tomorrowLine(it, ctx));
  const so = DAY_PAGE.signOff;
  return { heading, lines, tomorrow, signOff: so[(s?.day ?? 0) % so.length] };
}

/**
 * The night desk behind the page: night ink with the porch lamp's warm pool in dithered rings (no
 * alpha, so it stays on the palette). Painted once into an offscreen canvas.
 * @param {CanvasRenderingContext2D} ctx
 */
function paintBackdrop(ctx) {
  ctx.fillStyle = PALETTE.nightInk;
  ctx.fillRect(0, 0, 480, 270);
  const cx = 240, cy = 135;
  for (let r = 3; r >= 1; r--) {
    ctx.fillStyle = r === 3 ? PALETTE.deepBlue : r === 2 ? '#3A3F5E' : '#5A4B4A';
    const rad = 60 + r * 50;
    for (let y = -rad; y <= rad; y += 2) {
      const w = Math.floor(Math.sqrt(rad * rad - y * y));
      for (let x = -w + ((y / 2) & 1); x <= w; x += 2) ctx.fillRect(cx + x, cy + y, 1, 1);
    }
  }
}

/** @type {any} */
let BACKDROP = null;

/** The cached backdrop canvas (null where no canvas can be made, e.g. under Node). */
function backdrop() {
  if (BACKDROP !== null) return BACKDROP || null;
  try {
    const c = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(480, 270)
      : typeof document !== 'undefined' ? Object.assign(document.createElement('canvas'), { width: 480, height: 270 }) : null;
    const g = c && c.getContext('2d');
    if (!g) { BACKDROP = false; return null; }
    paintBackdrop(g);
    BACKDROP = c;
  } catch {
    BACKDROP = false;
  }
  return BACKDROP || null;
}

/**
 * @param {any} G
 * @returns {import('../core/scene.js').Scene & {debugText: () => string, isBusy: () => boolean}}
 */
export function createDayPageScene(G) {
  /** @type {any} */ let params = {};
  let state = 'ink'; // tonight | ink | read | build | morning | closing | done
  let stateT = 0;
  /** @type {ReturnType<typeof pageLines>|null} */ let page = null;
  let saveOk = true;
  /** @type {any[]} */ let landed = [];
  let pick = 0; // tonight: 0 Not yet, 1 Sleep
  let lock = 0;
  /** @type {any[]} */ let tonight = [];
  let bob = 0;
  /** @type {any} */ let result = {};

  const emit = (evt, p) => { try { G.bus?.emit(evt, p ?? {}); } catch { /* never break the page */ } };
  const inkMs = () => framesMs(G, INK_FRAMES);

  function go(s) { state = s; stateT = 0; }

  function afterPage() {
    if (params.mode === 'sleep' || params.mode === 'build') {
      if (landed.length) { go('build'); emit('sfx', { name: 'dawn' }); return; }
      if (params.mode === 'sleep' && !params.realClock) { go('morning'); return; }
    }
    close({ done: true });
  }

  function close(r) {
    result = r;
    go('closing');
  }

  function popNow() {
    state = 'done';
    // pop first: a callback that opens the next screen must not bury this one under it
    if (G.scenes.top() === scene) G.scenes.pop(result);
    if (typeof params.onClose === 'function') { try { params.onClose(result); } catch (e) { console.warn(e); } }
  }

  const scene = {
    name: 'dayPage',
    opaque: true,
    enter(p) {
      params = p ?? {};
      result = {};
      landed = Array.isArray(params.landed) ? params.landed : [];
      saveOk = params.save ? params.save.ok !== false : true;
      const summary = params.summary ?? (params.mode !== 'build' ? dayPageSys.summarize(G.world, G.data, {}) : null);
      page = summary ? pageLines(summary, { data: G.data, world: G.world }) : null;
      pick = 0;
      lock = skipAnims(G) ? 0 : TIMING.inputLockMs;
      if (params.mode === 'tonight') {
        tonight = Array.isArray(params.tonight) ? params.tonight : dayPageSys.tonightList(G.world, G.data, {});
        go('tonight');
        return;
      }
      if (params.mode === 'build') { go('build'); emit('sfx', { name: 'dawn' }); return; }
      go(skipAnims(G) ? 'read' : 'ink');
      emit('sfx', { name: 'stamp', semitones: -5 });
    },
    exit() {},
    update(dt) {
      stateT += dt;
      bob = (bob + dt) % TIMING.cursorBobMs;
      if (lock > 0) lock = Math.max(0, lock - dt);
      if (state === 'ink' && stateT >= inkMs()) {
        go('read');
        emit('sfx', { name: saveOk ? 'stamp' : 'error' });
      }
      if (state === 'build' && stateT >= framesMs(G, BUILD_FRAMES) + framesMs(G, 50)) afterBuild();
      if (state === 'morning' && stateT >= (skipAnims(G) ? 0 : 900)) close({ done: true, morning: true });
      if (state === 'closing' && stateT >= framesMs(G, 8)) popNow();
    },
    handleInput(input) {
      const tap = !!(input.pointer && input.pointer.inside && input.pointer.justDown);
      if (state === 'tonight') {
        if (lock > 0) return;
        if (input.repeat('left') || input.repeat('right')) { pick = 1 - pick; emit('ui:cursor'); }
        if (tap) {
          const rs = seals();
          rs.forEach((r, i) => { const p = input.pointer; if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) { if (pick === i || p.type !== 'touch') { pick = i; choose(); } else pick = i; } });
          return;
        }
        if (input.pressed('confirm')) choose();
        else if (input.pressed('cancel')) { pick = 0; choose(); }
        return;
      }
      if (state === 'ink') {
        if (input.pressed('confirm') || input.pressed('cancel') || tap) { go('read'); emit('sfx', { name: saveOk ? 'stamp' : 'error' }); }
        return;
      }
      if (state === 'read') {
        if (input.pressed('confirm') || input.pressed('cancel') || tap) { emit('ui:confirm'); afterPage(); }
        return;
      }
      if (state === 'build') {
        if (stateT < framesMs(G, 20)) return;
        if (input.pressed('confirm') || input.pressed('cancel') || tap) afterBuild();
      }
    },
    draw(ctx) {
      drawBackdrop(ctx);
      if (state === 'tonight') { drawTonight(ctx); return; }
      if (state === 'build' || (state === 'closing' && params.mode === 'build')) { drawBuild(ctx); drawClosing(ctx); return; }
      if (state === 'morning' || (state === 'closing' && result.morning)) { drawMorning(ctx); drawClosing(ctx); return; }
      if (page) drawPage(ctx);
      drawClosing(ctx);
    },
    debugText() {
      if (state === 'tonight') return [t('rest.nightHolds'), ...tonight.map((x) => tonightLine(x)), `${pick === 1 ? '>' : ' '} Sleep  ${pick === 0 ? '>' : ' '} Not yet`].join('\n');
      if (!page) return `dayPage ${state}`;
      return [page.heading, ...page.lines.map((l) => l.text), t('day.tomorrow'), ...page.tomorrow.map((x) => `• ${x}`), saveOk ? t('day.saved') : t('day.notSaved'), `(${state})`].join('\n');
    },
    isBusy: () => state === 'ink' || state === 'closing' || state === 'morning',
    get state() { return state; },
  };

  function choose() {
    emit(pick === 1 ? 'ui:confirm' : 'ui:cancel');
    close({ sleep: pick === 1 });
  }

  function afterBuild() {
    if (state !== 'build') return;
    emit('sfx', { name: 'bell' });
    if (params.mode === 'sleep' && !params.realClock) { go('morning'); return; }
    close({ done: true });
  }

  // ------------------------------------------------------------------ drawing
  function drawBackdrop(ctx) {
    const cached = backdrop();
    if (cached) { ctx.drawImage(cached, 0, 0); return; }
    paintBackdrop(ctx);
  }

  function drawClosing(ctx) {
    if (state !== 'closing') return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, stateT / Math.max(1, framesMs(G, 8)));
    ctx.fillStyle = PALETTE.nightInk;
    ctx.fillRect(0, 0, 480, 270);
    ctx.restore();
  }

  function drawPage(ctx) {
    const P = PAGE;
    drawPanel(ctx, P, 'ledger', { rulePitch: 10, ruleStart: 33, margin: 18 });
    const inkY = state === 'ink' ? P.y + Math.round((P.h + 10) * (reducedMotion(G) ? Math.min(1, stateT / inkMs()) : ease.outQuad(Math.min(1, stateT / inkMs())))) : 9999;
    ctx.save();
    ctx.beginPath();
    ctx.rect(P.x, P.y, P.w, Math.max(0, inkY - P.y));
    ctx.clip();
    const pg = /** @type {any} */ (page);
    const L = P.x + 26;
    drawText(ctx, pg.heading, L, P.y + 10, { color: COLORS.paper.ink, scale: 1 });
    drawText(ctx, params.mode === 'sit' ? 'So far today' : params.mode === 'quit' ? 'Until next time' : '', P.x + P.w - 12, P.y + 11, { align: 'right', font: 'small', color: COLORS.paper.inkFaint }); // str
    let y = P.y + 24;
    for (const l of pg.lines) {
      const h = drawText(ctx, l.text, L, y, { color: COLORS.paper.ink, maxWidth: P.w - 40 }).h;
      y += Math.max(10, Math.ceil((h + 1) / 10) * 10);
      if (y > P.y + 130) break;
    }
    y += 4;
    drawText(ctx, t('day.tomorrow'), L, y, { color: COLORS.wax.fill });
    y += 10;
    if (!pg.tomorrow.length) { drawText(ctx, DAY_PAGE.tomorrowEmpty.replace(/^Tomorrow: /, ''), L + 8, y, { color: COLORS.paper.ink }); y += 10; }
    for (const line of pg.tomorrow) {
      drawText(ctx, '•', L + 2, y, { color: COLORS.wax.fill });
      const h = drawText(ctx, line, L + 10, y, { color: COLORS.paper.ink, maxWidth: P.w - 46 }).h;
      y += Math.max(10, Math.ceil((h + 1) / 10) * 10);
      if (y > P.y + P.h - 34) break;
    }
    drawText(ctx, pg.signOff, L, P.y + P.h - 16, { font: 'small', color: COLORS.paper.inkSoft });
    ctx.restore();
    // the save check: a stamp, or the red banner
    if (state !== 'ink') {
      if (saveOk) {
        const S = STAMP;
        const ink = '#2E6B4F';
        ctx.fillStyle = ink;
        ctx.fillRect(S.x, S.y, S.w, 1); ctx.fillRect(S.x, S.y + S.h - 1, S.w, 1); ctx.fillRect(S.x, S.y, 1, S.h); ctx.fillRect(S.x + S.w - 1, S.y, 1, S.h);
        ctx.fillRect(S.x + 2, S.y + 2, S.w - 4, 1); ctx.fillRect(S.x + 2, S.y + S.h - 3, S.w - 4, 1);
        drawText(ctx, `+ ${t('day.saved')}`, S.x + S.w / 2, S.y + 7, { align: 'center', color: ink });
      } else {
        const B = { x: P.x + 8, y: P.y + P.h - 26, w: P.w - 16, h: 18 };
        ctx.fillStyle = COLORS.wax.fill;
        ctx.fillRect(B.x, B.y, B.w, B.h);
        ctx.fillStyle = COLORS.wax.dark;
        ctx.fillRect(B.x, B.y + B.h - 1, B.w, 1);
        drawText(ctx, `× ${DAY_PAGE.notSaved}`, B.x + 6, B.y + 6, { color: COLORS.wax.text, maxWidth: B.w - 12 });
      }
      if (state === 'read') {
        const lift = bob < TIMING.cursorBobMs / 2 ? 0 : 1;
        drawText(ctx, TYPE.cursor, P.x + P.w - 14 + lift, P.y + P.h - 14, { color: COLORS.wax.fill });
      }
    }
  }

  function seals() {
    return [{ x: 176, y: 196, w: 56, h: 16 }, { x: 248, y: 196, w: 56, h: 16 }];
  }

  function drawTonight(ctx) {
    const R = { x: 120, y: 44, w: 240, h: 182 };
    drawPanel(ctx, R, 'ledger', { rulePitch: 10, ruleStart: 33, margin: 14 });
    drawText(ctx, t('rest.heading'), R.x + 22, R.y + 10, { color: COLORS.paper.ink });
    drawText(ctx, t('rest.nightHolds'), R.x + 22, R.y + 24, { color: COLORS.wax.fill });
    let y = R.y + 34;
    const list = tonight.length ? tonight.map((x) => tonightLine(x)) : ['Nothing that won\'t keep.']; // str
    for (const l of list.slice(0, 9)) { drawText(ctx, `• ${l}`, R.x + 24, y, { color: COLORS.paper.ink, maxWidth: R.w - 40 }); y += 10; }
    const rs = seals();
    const labels = ['Not yet', t('confirm.option.sleep')]; // str
    rs.forEach((r, i) => drawSealButton(ctx, labels[i], r.x, r.y, { focused: pick === i && lock <= 0, role: i === 0 ? 'safe' : 'neutral', w: r.w }));
    const r = rs[pick];
    const lift = bob < TIMING.cursorBobMs / 2 ? 0 : 1;
    drawText(ctx, TYPE.cursor, r.x - 7 + (lock > 0 ? 0 : lift), r.y + 4, { color: lock > 0 ? COLORS.paper.inkFaint : COLORS.wax.fill });
  }

  function tonightLine(it) {
    const p = it.params ?? {};
    switch (it.kind) {
      case 'low': return `A low at ${formatMinute(((p.minute ?? 0) % 1440 + 1440) % 1440)}: the flats glow.`; // str
      case 'porch': return 'Porch talk until one.'; // str
      case 'beat': return `${nameOf(G.data, 'npcs', p.npcId ?? '')} is on the porch.`; // str
      case 'carry': return t('letter.familyReady');
      default: return p.text ?? words(it.kind);
    }
  }

  function drawBuild(ctx) {
    const I = INSET;
    const kAll = Math.min(1, stateT / Math.max(1, framesMs(G, BUILD_FRAMES)));
    // cream frame
    ctx.fillStyle = COLORS.paper.light;
    ctx.fillRect(I.x - 4, I.y - 4, I.w + 8, I.h + 8);
    ctx.fillStyle = COLORS.paper.edge;
    ctx.fillRect(I.x - 4, I.y + I.h + 3, I.w + 8, 1);
    // pre-dawn sky with an amber band
    ctx.fillStyle = PALETTE.deepBlue;
    ctx.fillRect(I.x, I.y, I.w, I.h);
    ctx.fillStyle = '#5B5A7A';
    ctx.fillRect(I.x, I.y + 40, I.w, 14);
    ctx.fillStyle = '#C98A6B';
    ctx.fillRect(I.x, I.y + 54, I.w, 6);
    ctx.fillStyle = PALETTE.porchAmber;
    for (let x = 0; x < I.w; x += 2) ctx.fillRect(I.x + x, I.y + 53, 1, 1);
    // ground
    ctx.fillStyle = '#2E3A2E';
    ctx.fillRect(I.x, I.y + 70, I.w, 20);
    // the lighthouse and its scaffold (one section rises)
    const tier = Math.max(1, Math.min(7, G.world?.loans?.tier ?? 1));
    const lx = I.x + 118;
    ctx.fillStyle = '#C9C2B0';
    ctx.fillRect(lx, I.y + 18, 12, 52);
    ctx.fillStyle = PALETTE.waxRed;
    for (let y = 24; y < 70; y += 12) ctx.fillRect(lx, I.y + y, 12, 4);
    const secK = ease.outQuad(Math.min(1, Math.max(0, (kAll - 0.55) / 0.3)));
    ctx.fillStyle = '#8C6A3E';
    for (let s = 0; s < tier; s++) {
      const rise = s === tier - 1 ? Math.round((1 - secK) * 8) : 0;
      const sy = I.y + 64 - s * 7 + rise;
      ctx.fillRect(lx - 3, sy, 1, 7); ctx.fillRect(lx + 14, sy, 1, 7); ctx.fillRect(lx - 3, sy, 18, 1);
    }
    // the cottage with its roof filling in
    const b = landed[0] ?? { id: 'roof', choice: 'slate-blue' };
    const roof = ROOF_COLOURS.find((r) => r.id === b.choice) ?? ROOF_COLOURS.find((r) => r.isDefault) ?? ROOF_COLOURS[0];
    const hx = I.x + 30, hy = I.y + 50;
    ctx.fillStyle = '#E8DCC0';
    ctx.fillRect(hx, hy, 48, 22);
    ctx.fillStyle = PALETTE.porchAmber;
    ctx.fillRect(hx + 8, hy + 8, 6, 6);
    ctx.fillRect(hx + 34, hy + 8, 6, 6);
    ctx.fillStyle = '#5A4632';
    ctx.fillRect(hx + 20, hy + 10, 8, 12);
    const step1 = Math.min(1, kAll / 0.3) >= 1;
    const step2 = kAll >= 0.5;
    const hexes = roof?.hexes ?? ['#6E8CA8', '#55708C', '#3E5670', '#2B3A67'];
    for (let r = 0; r < 14; r++) {
      const w = 56 - r * 4;
      const x0 = hx - 4 + r * 2;
      for (let x = 0; x < w; x++) {
        const on = step2 || (step1 && (x + r) % 2 === 0);
        ctx.fillStyle = on ? hexes[Math.min(3, Math.floor(r / 4))] : '#7A6A55';
        if (!step1 && (x + r) % 3 !== 0) continue; // bare battens before the first dither step
        ctx.fillRect(x0 + x, hy - 1 - r, 1, 1);
      }
    }
    // the Thatch: two little finches tying off (12 fps poses), flying off at the end
    const pose = Math.floor(stateT / (1000 / 12)) % 3;
    const fly = kAll >= 0.85 ? Math.round((kAll - 0.85) * 120) : 0;
    for (const [fx, fy] of [[hx + 10, hy - 12], [hx + 34, hy - 9]]) {
      const x = fx + fly, y = fy - fly;
      ctx.fillStyle = '#8C6A3E';
      ctx.fillRect(x, y, 4, 3);
      ctx.fillStyle = PALETTE.porchAmber;
      ctx.fillRect(x + 4, y + 1, 1, 1);
      ctx.fillStyle = '#5A4632';
      if (pose === 0) ctx.fillRect(x - 1, y - 1, 2, 1); else if (pose === 1) ctx.fillRect(x - 1, y + 1, 2, 1); else ctx.fillRect(x + 1, y - 2, 2, 1);
    }
    // captions
    const name = words(b.id ?? 'roof');
    drawText(ctx, t('build.tieOff', { build: name }), 240, I.y + I.h + 14, { align: 'center', color: COLORS.paper.light });
    drawText(ctx, (G.world?.loans?.tier ?? 0) >= 7 ? t('build.lampRoom') : t('build.scaffold', { n: tier }), 240, I.y + I.h + 26, { align: 'center', font: 'small', color: COLORS.dark.textSoft });
    drawText(ctx, '05:40', I.x + 4, I.y + 4, { font: 'small', color: COLORS.paper.light });
    if (stateT >= framesMs(G, 20)) drawText(ctx, TYPE.cursor, I.x + I.w - 8 + (bob < TIMING.cursorBobMs / 2 ? 0 : 1), I.y + I.h + 14, { color: COLORS.brass.light });
  }

  function drawMorning(ctx) {
    const k = Math.min(1, stateT / 600);
    ctx.fillStyle = '#E9C9A0';
    ctx.fillRect(0, 0, 480, 270);
    ctx.fillStyle = '#F3DDB8';
    ctx.fillRect(0, 150, 480, 120);
    ctx.fillStyle = PALETTE.porchAmber;
    const sunY = 170 - Math.round(ease.outQuad(k) * 26);
    for (let y = -14; y <= 14; y++) { const w = Math.floor(Math.sqrt(196 - y * y)); ctx.fillRect(240 - w, sunY + y, w * 2, 1); }
    ctx.fillStyle = '#D9B48A';
    ctx.fillRect(0, 168, 480, 102);
    const day = Math.floor((G.world?.clock?.total ?? 0) / 1440) + 1;
    drawText(ctx, '06:00', 240, 92, { align: 'center', scale: 2, color: COLORS.paper.ink });
    drawText(ctx, `Day ${day}. Morning.`, 240, 116, { align: 'center', color: COLORS.paper.inkSoft }); // str
  }

  return scene;
}

/** Text width helper for tests. */
export const pageTextWidth = (s) => measureText(s).w;
