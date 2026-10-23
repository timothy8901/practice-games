/**
 * Rest -> Day Page -> morning glue (GDD-00 §5 Rest and anchors, §9 Day Page; ARCHITECTURE §1).
 * [FLOW, built by SCN-UI]
 *
 * **The night, in order** ({@link NIGHT_ORDER}; {@link restNight} is the pure core, unit-tested):
 *  1. `clockSys.rest` — Lie down / Nap till dusk / Sleep till dawn (from 21:00): the clock rolls to
 *     the wake minute through the 05:40 builds anchor and the 06:00 morning anchor;
 *  2. heal (`party.heal`) when the rest heals;
 *  3. Sleep only, once the clock reached the morning: `dayPage.overnight` closes the day's page and
 *     runs its steps: the **builds** at 05:40 (`loans.landDue`, which also checks the Relighting),
 *     the Consignment Crate sale, then the town steps: heirlooms and the **morning letter**
 *     (`letters.deliverMorning`);
 *  4. the **weather roll** for the new day (`weather.rollDay`);
 *  5. the **autosave** (the G wrapper; the Day Page shows its result as the save check line).
 * Every domain event of the night is held in a queue and released at the 06:00 morning, when the
 * Day Page (and a dawn-build vignette when a build landed) has closed, so the music, the letter sting
 * and the autosave triggers fire when the player sees the morning rather than behind the page.
 *
 * **Awake** ({@link install}): at the 05:40 anchor builds land (`loans.landDue`); at the 06:00 anchor
 * the overnight runs without a Rest (no page); deferred Forecasts are offered at home on waking and
 * at Waystones ({@link resolvePendingForecasts}); at dusk (18:00) the Relighting trigger
 * (`loans.relightingDue`) queues the `relighting` script. Domain events that the Day Page tallies are
 * forwarded to `dayPage.noteEvent`.
 *
 * Writes the world only through the owning systems (clockSys, party, dayPage, loans, shops, weather,
 * eventScripts). No DOM: the G wrappers push scenes through `G.push`.
 * @module systems/flow/dayFlow
 */
import * as clockSys from '../clockSys.js';
import * as dayPage from '../dayPage.js';
import * as loans from '../loans.js';
import * as shops from '../shops.js';
import * as weather from '../weather.js';
import * as party from '../party.js';
import * as eventScripts from './eventScripts.js';
import { MINUTES_PER_DAY } from '../../core/time.js';
import { t } from '../../data/strings.js';

/** @typedef {import('../../state/schema.js').World} World */

/** The steps of a Sleep, in order (what {@link restNight} reports in `order`). */
export const NIGHT_ORDER = Object.freeze(['rest', 'heal', 'overnight', 'builds', 'crate', 'letters', 'weather', 'autosave']);

/** Script queued when the Relighting's dusk arrives (when the content has it). */
export const RELIGHTING_SCRIPT = 'relighting';

/**
 * A bus stand-in that records events for later release (in order).
 * @returns {{emit: (evt: string, payload?: any) => void, events: Array<{evt: string, payload: any}>, flush: (bus: any) => number}}
 */
export function createQueueBus() {
  /** @type {Array<{evt: string, payload: any}>} */
  const events = [];
  return {
    events,
    emit(evt, payload) { events.push({ evt, payload }); },
    flush(bus) {
      const list = events.splice(0, events.length);
      for (const e of list) { try { bus?.emit?.(e.evt, e.payload); } catch (err) { console.warn(`dayFlow: listener for ${e.evt} threw`, err); } }
      return list.length;
    },
  };
}

/**
 * The world's core day and minute from `world.clock`.
 * @param {World} world
 * @returns {{day: number, minute: number}}
 */
function nowOf(world) {
  const total = Math.max(0, Math.floor(world?.clock?.total ?? 0));
  return { day: Math.floor(total / MINUTES_PER_DAY), minute: total % MINUTES_PER_DAY };
}

/**
 * @typedef {Object} NightReport
 * @property {boolean} ok
 * @property {string} kind
 * @property {string|null} reason             why the rest was refused ('too-early' ...)
 * @property {string[]} order                 steps run, in order
 * @property {any} rest                       clockSys.rest result
 * @property {any} overnight                  dayPage.overnight result (Sleep), or null
 * @property {any} summary                    the Day Page: the closed day (Sleep) or today so far
 * @property {Array<any>} landed              builds that landed tonight
 * @property {any} weather                    weather.rollDay result, or null
 * @property {number[]} mail                  letters delivered this morning
 * @property {Array<{evt: string, payload: any}>} events   the night's domain events, held for the morning
 * @property {any} save                       autosave result (G wrapper), or null
 */

/**
 * The pure night. Call inside `store.tx`. Domain events go to `ctx.bus` (pass a
 * {@link createQueueBus} to hold them for the morning).
 * @param {World} world
 * @param {any} clock    core/time clock bound to `world.clock`
 * @param {'lie'|'nap'|'sleep'} kind
 * @param {{data: any, bus?: any, rng?: any, save?: (world: World) => any, tomorrow?: any[], isPorchLit?: Function}} ctx
 * @returns {NightReport}
 */
export function restNight(world, clock, kind, ctx) {
  const data = ctx.data;
  const bus = ctx.bus ?? null;
  /** @type {NightReport} */
  const report = { ok: false, kind, reason: null, order: [], rest: null, overnight: null, summary: null, landed: [], weather: null, mail: [], events: [], save: null };
  const r = clockSys.rest(world, clock, kind, { bus, data });
  report.rest = r;
  if (!r.ok) { report.reason = r.reason; return report; }
  report.ok = true;
  report.order.push('rest');
  if (r.heal > 0) {
    party.heal(world, { bus });
    report.order.push('heal');
  }
  if (kind === 'sleep' && r.skipped) {
    const order = report.order;
    order.push('overnight');
    const night = dayPage.overnight(world, data, ctx.rng ?? null, {
      bus,
      tomorrow: ctx.tomorrow,
      isPorchLit: /** @type {any} */ (ctx.isPorchLit),
      hooks: {
        builds: (w, d, s) => { order.push('builds'); return loans.landDue(w, { data: d, bus: s.bus, now: s.now }); },
        crate: (w, d, s) => { order.push('crate'); return shops.settleCrate(w, { data: d, bus: s.bus, now: s.now }); },
      },
    });
    report.overnight = night;
    report.summary = night.summary;
    report.landed = night.steps?.builds?.landed ?? [];
    report.mail = mailNumbers(night.mail);
    if (night.ran) order.push('letters');
    const day = clockSys.gameDay(world);
    report.weather = weather.rollDay(world, data, ctx.rng ?? null, { day, bus });
    order.push('weather');
  } else {
    // Real Clock sleep, nap, lie down: the page (if shown) is today so far
    report.summary = dayPage.summarize(world, data, { tomorrow: ctx.tomorrow });
  }
  if (typeof ctx.save === 'function') {
    report.save = ctx.save(world);
    report.order.push('autosave');
  }
  return report;
}

/**
 * Normalizes `letters.deliverMorning`'s result into the letter numbers delivered.
 * @param {any} mail
 * @returns {number[]}
 */
export function mailNumbers(mail) {
  if (!mail) return [];
  if (Array.isArray(mail)) return mail.filter((n) => Number.isInteger(n));
  for (const k of ['delivered', 'letters', 'got']) {
    const v = mail[k];
    if (Array.isArray(v)) return v.map((x) => (typeof x === 'number' ? x : x?.n)).filter((n) => Number.isInteger(n));
  }
  const out = [];
  if (Number.isInteger(mail.keeper)) out.push(mail.keeper);
  if (Array.isArray(mail.town)) for (const n of mail.town) if (Number.isInteger(n)) out.push(n);
  if (!out.length && Number.isInteger(mail.n)) out.push(mail.n);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Game-context wrappers
// ---------------------------------------------------------------------------------------------

/**
 * An rng source for the overnight and the weather (the run's `Rngs`, else a stateless fork).
 * @param {any} G
 */
function rngOf(G) {
  return G?.rngs ?? null;
}

/**
 * Autosaves through persist and returns the result the Day Page stamps (`{ok, error?}`).
 * @param {any} G
 * @param {string} reason
 * @returns {{ok: boolean, error?: any}}
 */
export function saveNow(G, reason) {
  try {
    if (G?.persist && typeof G.persist.autosave === 'function') return G.persist.autosave(G, reason);
  } catch (e) {
    return { ok: false, error: { code: 'exception', message: String(e && /** @type {any} */ (e).message) } };
  }
  return { ok: false, error: { code: 'no-store', message: 'no persist' } };
}

/**
 * Runs a rest now (tx + autosave), holding the night's events. No scenes. Used by {@link rest} and
 * by tests / the debug hook.
 * @param {any} G
 * @param {'lie'|'nap'|'sleep'} kind
 * @returns {NightReport & {queue: ReturnType<typeof createQueueBus>}}
 */
export function restNow(G, kind) {
  const queue = createQueueBus();
  const report = G.store.tx(`rest:${kind}`, (w) => restNight(w, G.clock, kind, { data: G.data, bus: queue, rng: rngOf(G) }));
  if (report.ok) {
    report.save = saveNow(G, kind === 'sleep' ? 'sleep' : 'rest');
    report.order.push('autosave');
  }
  report.events = queue.events;
  return Object.assign(report, { queue });
}

/**
 * Releases the night's held events and greets the morning (letter toast).
 * @param {any} G
 * @param {NightReport & {queue?: any}} report
 */
export function wake(G, report) {
  if (report.queue) report.queue.flush(G.bus);
  const mail = mailNumbers(report.overnight?.mail);
  if (mail.length) G.bus?.emit?.('toast', { text: t('letter.arrived'), icon: 'read' });
}

/**
 * The bed (GDD-00 §5): Lie down / Nap till dusk / Sleep till dawn. Sleep shows the Day Page (and the
 * dawn build when a build landed), then the 06:00 morning; the other rests heal, save and toast.
 * Resolves with the report once the player is back in the world (deferred Forecasts offered after).
 * @param {any} G
 * @param {'lie'|'nap'|'sleep'} [kind='sleep']
 * @returns {Promise<NightReport>}
 */
export function rest(G, kind = 'sleep') {
  const report = restNow(G, kind);
  if (!report.ok) {
    const key = report.reason === 'too-early' ? (kind === 'nap' ? 'rest.napTooEarly' : 'rest.tooEarly') : null;
    G.bus?.emit?.('toast', { text: key ? t(key) : String(report.reason) });
    return Promise.resolve(report);
  }
  if (kind !== 'sleep') {
    wake(G, report);
    G.bus?.emit?.('toast', { text: t('rest.healed') });
    return Promise.resolve(report);
  }
  return new Promise((resolve) => {
    G.push('dayPage', {
      mode: 'sleep',
      summary: report.summary,
      save: report.save,
      landed: report.landed,
      realClock: report.rest && !report.rest.skipped,
      onClose: () => {
        wake(G, report);
        // the night's events are out now: deferred Forecasts first, then any script they queued
        // (the overworld resumed under the page before the events were released)
        resolvePendingForecasts(G, 'home').then(() => {
          if (G.scenes?.top?.()?.name === 'overworld') eventScripts.runPending(G);
          resolve(report);
        });
      },
    });
  });
}

/**
 * Before Sleep (GDD-00 §5): the page lists what the night still holds (`dayPage.tonightList`) with
 * *Not yet* (first) / *Sleep*; Sleep goes on to {@link rest}. Resolves with the report, or null when
 * the player kept the night.
 * @param {any} G
 * @returns {Promise<NightReport|null>}
 */
export function askSleep(G) {
  const opt = clockSys.restOptions(G.world, G.data).options.find((o) => o.kind === 'sleep');
  if (opt && !opt.available) return rest(G, 'sleep');
  const tonight = dayPage.tonightList(G.world, G.data, {});
  return new Promise((resolve) => {
    G.push('dayPage', {
      mode: 'tonight', tonight,
      onClose: (r) => { if (r && r.sleep) rest(G, 'sleep').then(resolve); else resolve(null); },
    });
  });
}

/**
 * The porch bench (GDD-00 §5): the Day Page (read-only), a verified save, then the clock runs ×6
 * until {@link stand}.
 * @param {any} G
 * @returns {Promise<{ok: boolean}>}
 */
export function sit(G) {
  const save = saveNow(G, 'porch');
  const summary = dayPage.summarize(G.world, G.data, {});
  return new Promise((resolve) => {
    G.push('dayPage', {
      mode: 'sit', summary, save, landed: [],
      onClose: () => {
        G.store.tx('rest:sit', (w) => clockSys.sit(w, G.clock, { bus: G.bus, data: G.data }));
        G.bus?.emit?.('toast', { text: t('rest.sitting') });
        resolve({ ok: true });
      },
    });
  });
}

/**
 * Stands up from the porch bench (clock speed back to ×1).
 * @param {any} G
 */
export function stand(G) {
  G.store.tx('rest:stand', (w) => clockSys.stand(w, G.clock));
}

/**
 * Quitting to the title: the Day Page (today so far) with a verified save. Resolves when it closes.
 * @param {any} G
 * @returns {Promise<{save: any}>}
 */
export function quitPage(G) {
  const save = saveNow(G, 'quit');
  const summary = dayPage.summarize(G.world, G.data, {});
  return new Promise((resolve) => {
    G.push('dayPage', { mode: 'quit', summary, save, landed: [], onClose: () => resolve({ save }) });
  });
}

/**
 * Offers each deferred Forecast (`world.pendingShifts`) in turn, at home or at a Waystone (GDD-00 §9
 * "Deferred Shifts — the next Waystone, or home"). Resolves when the last one closes.
 * @param {any} G
 * @param {'home'|'waystone'} where
 * @returns {Promise<number>} how many were opened
 */
export function resolvePendingForecasts(G, where) {
  const queue = (G.world?.pendingShifts ?? []).slice();
  if (!queue.length || !G.sceneFactories?.forecast) return Promise.resolve(0);
  let opened = 0;
  return new Promise((resolve) => {
    const nextOne = () => {
      const uid = queue.shift();
      if (!uid) { resolve(opened); return; }
      if (!(G.world.pendingShifts ?? []).includes(uid)) { nextOne(); return; }
      opened++;
      G.push('forecast', { uid, where, deferred: true, onClose: nextOne });
    };
    nextOne();
  });
}

/**
 * A Waystone: deferred Forecasts, then the autosave (`waystone:use` is an autosave trigger).
 * @param {any} G
 * @param {string} [waystoneId]
 * @returns {Promise<number>}
 */
export function atWaystone(G, waystoneId = '') {
  return resolvePendingForecasts(G, 'waystone').then((n) => { G.bus?.emit?.('waystone:use', { id: waystoneId }); return n; });
}

/**
 * The dusk check: when the Relighting's dusk has come, queue its script (and say so on the bus).
 * Call inside a tx or not (it opens one).
 * @param {any} G
 * @returns {boolean} whether it fired
 */
export function checkRelighting(G) {
  if (!loans.relightingDue(G.world, { data: G.data })) return false;
  const has = hasScript(G.data, RELIGHTING_SCRIPT);
  if (has) G.store.tx('relighting:queue', (w) => eventScripts.queue(w, RELIGHTING_SCRIPT));
  G.bus?.emit?.('relighting:due', { script: has ? RELIGHTING_SCRIPT : null });
  return true;
}

/**
 * Whether the data (Registry or tables object) has a script.
 * @param {any} data
 * @param {string} id
 * @returns {boolean}
 */
function hasScript(data, id) {
  if (!data) return false;
  if (typeof data.has === 'function') return data.has('scripts', id);
  return Boolean(data.scripts && Object.prototype.hasOwnProperty.call(data.scripts, id));
}

/** Events the Day Page tally hears (dayPage.noteEvent). */
export const TALLY_EVENTS = Object.freeze(['wallet:changed', 'loan:paid', ...Object.keys(dayPage.NOTE_EVENTS)]);

/**
 * Wires the awake half of the day on the bus: the tally, the 05:40 builds, the 06:00 overnight
 * without a rest, the weather after it, and the dusk Relighting check. Returns the unsubscribe.
 * @param {any} G
 * @returns {() => void}
 */
export function install(G) {
  const offs = [];
  const on = (evt, fn) => offs.push(G.bus.on(evt, (p) => { try { fn(p); } catch (e) { console.warn(`dayFlow: ${evt}`, e); } }));
  for (const evt of TALLY_EVENTS) on(evt, (p) => G.store.tx('dayPage:note', (w) => dayPage.noteEvent(w, evt, p)));
  on('clock:anchor', (p) => {
    if (p?.id === 'builds') {
      const res = G.store.tx('builds:land', (w) => loans.landDue(w, { data: G.data, bus: G.bus }));
      if (res?.landed?.length && G.scenes?.top?.()?.name === 'overworld' && G.sceneFactories?.dayPage) {
        G.push('dayPage', { mode: 'build', landed: res.landed, onClose: () => {} });
      }
    } else if (p?.id === 'morning') {
      G.store.tx('morning', (w) => {
        const night = dayPage.overnight(w, G.data, rngOf(G), {
          bus: G.bus,
          hooks: {
            builds: (ww, d, s) => loans.landDue(ww, { data: d, bus: s.bus, now: s.now }),
            crate: (ww, d, s) => shops.settleCrate(ww, { data: d, bus: s.bus, now: s.now }),
          },
        });
        weather.update(w, G.data, rngOf(G), { bus: G.bus });
        return night;
      });
    }
  });
  on('clock:dayPart', (p) => { if (p?.dayPart === 'dusk') checkRelighting(G); });
  on('clock:hour', (p) => { if (p?.hour === 18) checkRelighting(G); });
  return () => { for (const off of offs) { try { off(); } catch { /* gone */ } } };
}

/**
 * Registers the debug hook's `sleep` (draft §11) when a hook is installed.
 * @param {any} G
 */
export function bindDebug(G) {
  const hook = G?.debugHook;
  if (hook && typeof hook.bind === 'function') hook.bind('sleep', () => rest(G, 'sleep'));
}

/**
 * The minute of day and core day now (for scenes).
 * @param {World} world
 */
export function clockNow(world) {
  return nowOf(world);
}
