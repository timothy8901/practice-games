#!/usr/bin/env node
// Cast audit (GDD-00 §10, GDD-05 §1-3): every resident is somewhere valid at every hour of the week.
//
// Walks the real content (js/data/content.js) through systems/schedule.whereIs for two weeks of
// half-hours (so every weekday, both tides at every hour and a spread of weather) under several story
// scenarios (a fresh run, the opening done, the Oyster Boat waiting on Drownwood, everything set), and
// checks that each placement:
//   - names a real map and lies in bounds,
//   - stands on a cell a walker can stand on AT THAT MOMENT (the resolved tide tiles and the solid
//     entities of tools/map-reachability), unless it is an authored prop/boat marker (onSolid / water),
//   - is not null for a resident who is not marked absent.
// It also checks every static spot the cast declares (homeSpot, porch seat, festival spots, schedule
// entries) for a real marker, and that every resident has the line depth the GDD asks for.
//
//   node test/fixtures/castAudit.mjs         human report, exit 1 on any problem
//   import { auditCast } from './fixtures/castAudit.mjs'   (test/data.cast.test.mjs)
import { DATA_CONTENT } from '../../js/data/content.js';
import { createRegistry } from '../../js/data/registry.js';
import { whereIs, expandSchedule, routeFor } from '../../js/systems/schedule.js';
import { createNewWorld } from '../../js/state/schema.js';
import { snapshot, walkable, openWays, highWater, lowsOf, allFlags } from '../../tools/map-reachability.mjs';
import { tideVariant } from '../../js/world/tide.js';
import { tideOffsetFor, DEFAULTS as CLOCK } from '../../js/systems/clockSys.js';
import { FLAG_IDS } from '../../js/data/ids.manifest.js';
import { MAPS_BY_ID } from '../../js/data/maps/index.js';
import { tideAt, MINUTES_PER_DAY } from '../../js/core/time.js';

/** Story scenarios: flags (and thread states) the schedules branch on. */
export const SCENARIOS = Object.freeze({
  fresh: { flags: {}, threads: {} },
  opening: {
    flags: Object.fromEntries(['sp.arrived', 'sp.lease-signed', 'sp.starter-chosen', 'sp.reading-glass', 'sp.dock-battle', 'sp.errands-started',
      'sp.mail-sack', 'sp.capture-stance', 'sp.field-log', 'sp.first-payment', 'sp.raft-docked', 'sp.tamsin-arrived'].map((f) => [f, true])),
    threads: {},
  },
  'oyster-boat-2': {
    flags: Object.fromEntries(['sp.arrived', 'sp.starter-chosen', 'sp.dock-battle', 'sp.errands-started', 'sp.first-payment', 'sp.tamsin-arrived',
      'sp.raft-docked', 'sp.first-market', 'sp.linnet-fell'].map((f) => [f, true])),
    threads: { 'oyster-boat': { beat: 2, done: false, startedDay: 3, lastAdvancedDay: 5 } },
  },
  late: {
    flags: { ...Object.fromEntries(FLAG_IDS.filter((f) => f.startsWith('sp.')).map((f) => [f, true])),
      'sys.commons.training-yard-green': true, 'sys.build.training-yard': true },
    threads: {},
  },
});

const TIDE_OFFSET = tideOffsetFor(CLOCK.TIDE_DAY1_LOW);
const WEATHER = ['clear', 'rain', 'storm', 'fog'];
/** Groups whose members must always be somewhere (unless their `absent` cond holds). */
const PRESENT_GROUPS = new Set(['resident', 'leader', 'summit', 'faction', 'isle', 'fixture']);
/** Minimum line counts (GDD-06 bar): everyone present 10, the two main residents 30. */
export const LINE_BAR = Object.freeze({ resident: 10, main: 30 });
export const MAIN_RESIDENTS = Object.freeze(['corin', 'linnet']);

function propCell(mapId, x, y) {
  const m = MAPS_BY_ID[mapId];
  for (const mk of Object.values(m?.markers ?? {})) if (mk.x === x && mk.y === y && (mk.onSolid || mk.water)) return true;
  return false;
}

/** Every line row of an NPC (all pools). */
export function linesOf(npc) {
  return Object.values(npc.lines ?? {}).flatMap((pool) => (Array.isArray(pool) ? pool : []));
}

/**
 * @param {{days?: number, step?: number, scenarios?: string[], npcIds?: string[]}} [opts]
 * @returns {{problems: string[], checked: number}}
 */
export function auditCast(opts = {}) {
  const data = createRegistry(DATA_CONTENT);
  const days = opts.days ?? 14;
  const step = opts.step ?? 30;
  const npcs = DATA_CONTENT.npcs.filter((n) => !opts.npcIds || opts.npcIds.includes(n.id));
  const problems = new Set();
  let checked = 0;

  // ---- static spots ------------------------------------------------------------------------------
  const highSnap = snapshot(highWater(3), {});
  const lowSnap = snapshot(lowsOf(3).lower, allFlags());
  for (const npc of npcs) {
    const spots = [['homeSpot', npc.homeSpot], ['porch', npc.porch], ...Object.entries(npc.festivals ?? {}).map(([k, v]) => [`festival ${k}`, v]),
      ...expandSchedule(npc, data).map((e, i) => [`schedule[${i}]`, e])];
    for (const [where, s] of spots) {
      if (!s || typeof s !== 'object' || typeof s.mapId !== 'string') continue;
      const m = MAPS_BY_ID[s.mapId];
      if (!m) { problems.add(`${npc.id}: ${where} map '${s.mapId}' does not exist`); continue; }
      if (s.marker && !m.markers?.[s.marker]) problems.add(`${npc.id}: ${where} marker '${s.marker}' is not on '${s.mapId}'`);
      if (!(s.x >= 0 && s.y >= 0 && s.x < m.w && s.y < m.h)) { problems.add(`${npc.id}: ${where} (${s.x},${s.y}) out of bounds on '${s.mapId}'`); continue; }
      if (!propCell(s.mapId, s.x, s.y) && !(s.marker && m.markers?.[s.marker]?.spring) && !walkable(highSnap, s.mapId, s.x, s.y) && !walkable(lowSnap, s.mapId, s.x, s.y)) {
        problems.add(`${npc.id}: ${where} ${s.mapId} (${s.x},${s.y}) is standable at no tide`);
      }
    }
    if (npc.group !== 'absent') {
      const bar = MAIN_RESIDENTS.includes(npc.id) ? LINE_BAR.main : LINE_BAR.resident;
      const n = linesOf(npc).length;
      if (n < bar) problems.add(`${npc.id}: ${n} lines, the bar is ${bar}`);
    }
  }

  // ---- every half-hour of two weeks, per scenario ------------------------------------------------
  const snaps = new Map();
  const bad = new Map();
  const snapFor = (total, flags, key) => {
    const k = `${key}|${tideVariant(tideAt(total, TIDE_OFFSET))}|${JSON.stringify(openWays(total, flags))}`;
    let s = snaps.get(k);
    if (!s) { s = snapshot(total, flags); snaps.set(k, s); }
    return s;
  };
  for (const name of opts.scenarios ?? Object.keys(SCENARIOS)) {
    const sc = SCENARIOS[name];
    const base = createNewWorld({ seedCode: 'FLUX-4KNZ-CH4G' });
    for (let day = 0; day < days; day++) {
      const weather = WEATHER[day % WEATHER.length];
      for (let minute = 0; minute < MINUTES_PER_DAY; minute += step) {
        const total = day * MINUTES_PER_DAY + minute;
        const world = { ...base, clock: { ...base.clock, total }, flags: { ...sc.flags }, threads: { ...sc.threads },
          weather: { ...base.weather, today: weather, current: weather }, loans: { ...base.loans, tier: name === 'late' ? 7 : name === 'fresh' ? 1 : 2 } };
        let snap = null;
        for (const npc of npcs) {
          let p;
          try { p = whereIs(npc.id, world, data, {}); } catch (e) { problems.add(`${npc.id}: whereIs threw (${name}): ${e.message}`); continue; }
          checked++;
          if (!p) {
            const absent = npc.absent === true || (npc.absent && typeof npc.absent === 'object');
            if (PRESENT_GROUPS.has(npc.group) && !absent) problems.add(`${npc.id}: nowhere at day ${day + 1} ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')} (${name})`);
            continue;
          }
          if (!MAPS_BY_ID[p.mapId]) { problems.add(`${npc.id}: placed on unknown map '${p.mapId}' (${name})`); continue; }
          if (propCell(p.mapId, p.x, p.y)) continue;
          snap ??= snapFor(total, sc.flags, name);
          for (const pt of routeFor(p, data) ?? []) {
            if (!propCell(p.mapId, pt.x, pt.y) && !walkable(snap, p.mapId, pt.x, pt.y)) {
              const key = `${npc.id}: route '${p.pathId}' point (${pt.x},${pt.y}) is not standable at ${snap.variant} tide (${name})`;
              if (!bad.has(key)) bad.set(key, { n: 0, first: `day ${day + 1} ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}` });
              bad.get(key).n++;
            }
          }
          if (!walkable(snap, p.mapId, p.x, p.y)) {
            const key = `${npc.id}: ${p.source}${p.entryIndex >= 0 ? `[${p.entryIndex}]` : ''} ${p.mapId} (${p.x},${p.y}) is not standable at ${snap.variant} tide (${name})`;
            if (!bad.has(key)) bad.set(key, { n: 0, first: `day ${day + 1} ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}` });
            bad.get(key).n++;
          }
        }
      }
    }
  }
  for (const [k, v] of bad) problems.add(`${k}: ${v.n}x, first ${v.first}`);
  return { problems: [...problems], checked };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const quick = process.argv.includes('--quick');
  const { problems, checked } = auditCast(quick ? { days: 7, step: 60 } : {});
  console.log(`cast-audit: ${checked} placements checked, ${problems.length} problems`);
  for (const p of problems) console.log('  ' + p);
  process.exit(problems.length ? 1 : 0);
}
