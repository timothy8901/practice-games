// Unit tests for js/systems/schedule.js (SYS-TOWN). Run: node --test test/systems.schedule.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../js/systems/schedule.js';
import { isPorchLit, porchFlag, inWindow, windowStartDay, dowOf, gameDay, CALENDAR_DEFAULTS, rows, row } from '../js/systems/townCommon.js';
import { arrivalPoint, createNpcDriver } from '../js/world/npc.js';
import { createRegistry } from '../js/data/registry.js';
import { makeWorld, makeData, at, MIN } from './fixtures/town.fixture.mjs';

const LOWS = [5 * MIN + 5, 17 * MIN + 30];
const lowsOn = () => LOWS;
const data = makeData();
const where = (npc, world, extra = {}) => S.whereIs(npc, world, data, { lowsOn, ...extra });

describe('calendar and windows (townCommon)', () => {
  it('maps core days to GDD days and weekdays: day 1 is a Sunday, Saturdays are 7, 14, 21', () => {
    const t = CALENDAR_DEFAULTS;
    assert.equal(gameDay(0, t), 1);
    assert.equal(dowOf(0, t), 6, 'GDD day 1 = Sunday');
    assert.equal(dowOf(1, t), 0, 'GDD day 2 = Monday');
    for (const gd of [7, 14, 21]) assert.equal(dowOf(gd - 1, t), 5, `GDD day ${gd} is a Saturday`);
    assert.equal(dowOf(-1, t), 5, 'negative days wrap');
  });

  it('windows are half-open and wrap midnight', () => {
    assert.equal(inWindow(19 * MIN, [19 * MIN, MIN]), true);
    assert.equal(inWindow(0, [19 * MIN, MIN]), true);
    assert.equal(inWindow(MIN, [19 * MIN, MIN]), false);
    assert.equal(inWindow(18 * MIN + 59, [19 * MIN, MIN]), false);
    assert.equal(inWindow(600, [600, 600]), false, 'empty window');
    assert.equal(inWindow(30, [1300, 1500]), true, 'to > 1440 wraps');
    assert.equal(inWindow(100, [1300, 1500]), false);
    assert.equal(inWindow(100, 'nope'), false);
    assert.equal(windowStartDay(5, 30, [19 * MIN, MIN]), 4, '00:30 belongs to the evening before');
    assert.equal(windowStartDay(5, 20 * MIN, [19 * MIN, MIN]), 5);
    assert.equal(windowStartDay(5, 12 * MIN, [19 * MIN, MIN]), null);
  });

  it('porches: flag wins, home follows the loan tier, others litAtStart', () => {
    const w = makeWorld();
    assert.equal(isPorchLit(w, data, 'wren'), true);
    assert.equal(isPorchLit(w, data, 'odile'), false);
    assert.equal(isPorchLit(w, data, 'home'), false, 'loan 1 unpaid');
    w.loans.tier = 2;
    assert.equal(isPorchLit(w, data, 'home'), true);
    w.flags[porchFlag('wren')] = false;
    assert.equal(isPorchLit(w, data, 'wren'), false, 'a porch can go dark');
    assert.equal(isPorchLit(w, data, 'odile', { isPorchLit: (id) => id === 'odile' }), true, 'injected answer wins');
    assert.equal(isPorchLit(w, data, ''), false);
    assert.equal(isPorchLit(w, data, 'nobody'), false);
  });

  it('reads tables from plain objects and registries alike', () => {
    const reg = createRegistry({ npcs: data.npcs, shops: data.shops });
    assert.equal(rows(reg, 'npcs').length, data.npcs.length);
    assert.deepEqual(rows(reg, 'missing'), []);
    assert.equal(row(reg, 'shops', 'pells').id, 'pells');
    assert.equal(row(reg, 'shops', 'nope'), null);
    assert.equal(rows({ scripts: { a: [1] } }, 'scripts').length, 1);
    assert.deepEqual(rows(null, 'npcs'), []);
  });
});

describe('tuning', () => {
  it('defaults equal the GDD values and every key is listed', () => {
    const t = S.tuningOf(null);
    assert.deepEqual(t.porchWindow, [19 * MIN, MIN], 'GDD-00 §5 porch talk 19:00–01:00');
    assert.equal(t.calendarDayOffset, 1);
    assert.equal(t.calendarFirstDow, 6);
    assert.deepEqual(S.TUNING_KEYS, Object.keys(S.DEFAULTS));
    assert.ok(t.festivals.some((f) => f.id === 'lantern-market' && f.from === 20 * MIN && f.to === 2 * MIN && f.dow[0] === 5));
  });

  it('data.tuning overrides, opts.tuning wins, bad values throw, unknown keys are ignored', () => {
    const d = { ...data, tuning: { porchWindow: [20 * MIN, 23 * MIN], unrelated: 5 } };
    assert.deepEqual(S.tuningOf(d).porchWindow, [20 * MIN, 23 * MIN]);
    assert.deepEqual(S.tuningOf(d, { tuning: { porchWindow: [0, 60] } }).porchWindow, [0, 60]);
    assert.equal(S.tuningOf(d), S.tuningOf(d), 'cached per source');
    assert.throws(() => S.tuningOf({ tuning: { porchWindow: [1, 2, 3] } }), /porchWindow/);
    assert.throws(() => S.tuningOf({ tuning: { calendarFirstDow: 9 } }), /calendarFirstDow/);
    assert.throws(() => S.tuningOf(null, { tuning: 5 }), /tuning must be an object/);
  });
});

describe('resolveAt', () => {
  const w = makeWorld();
  it('minutes, phases and offsets', () => {
    assert.deepEqual(S.resolveAt(360, w, 0), [360]);
    assert.deepEqual(S.resolveAt(1500, w, 0), [60], 'minutes wrap into the day');
    assert.deepEqual(S.resolveAt(NaN, w, 0), []);
    assert.deepEqual(S.resolveAt({ phase: 'dusk' }, w, 0), [17 * MIN + 30]);
    assert.deepEqual(S.resolveAt({ phase: 'night' }, w, 0), [22 * MIN], 'night means the evening start, not midnight');
    assert.deepEqual(S.resolveAt({ phase: 'dusk', offset: 15 }, w, 0), [17 * MIN + 45]);
    assert.deepEqual(S.resolveAt({ phase: 'nope' }, w, 0), []);
    assert.deepEqual(S.resolveAt(null, w, 0), []);
    assert.deepEqual(S.resolveAt('noon', w, 0), []);
  });

  it('tide anchors give every low / high water of the day', () => {
    assert.deepEqual(S.resolveAt({ tide: 'low' }, w, 3, { lowsOn }), LOWS);
    assert.deepEqual(S.resolveAt({ tide: 'low', offset: -30 }, w, 3, { lowsOn }), [4 * MIN + 35, 17 * MIN]);
    assert.deepEqual(S.resolveAt({ tide: 'low', offset: -400 }, w, 3, { lowsOn }), [17 * MIN + 30 - 400], 'shifted out of the day is dropped');
    assert.deepEqual(S.resolveAt({ tide: 'high' }, w, 3, { lowsOn }), [LOWS[0] + 373, LOWS[1] + 373]);
    const late = () => [600, 1345];
    assert.deepEqual(S.resolveAt({ tide: 'high' }, w, 3, { lowsOn: late }), [1345 + 373 - 1440, 600 + 373],
      'the evening low of the day before gives a morning high; one past midnight is dropped');
  });

  it('the core tide model drifts later each day and agrees with the period', () => {
    const w2 = makeWorld();
    for (let d = 0; d < 10; d++) {
      const lows = S.lowsOn(w2, d);
      assert.ok(lows.length >= 1 && lows.length <= 2, `day ${d}: ${lows}`);
      for (let i = 1; i < lows.length; i++) assert.ok(Math.abs(lows[i] - lows[i - 1] - 745) <= 1);
    }
    const all = [];
    for (let d = 0; d < 6; d++) for (const m of S.lowsOn(w2, d)) all.push(d * 1440 + m);
    for (let i = 1; i < all.length; i++) assert.ok(Math.abs(all[i] - all[i - 1] - 745) <= 1, 'lows 12h25 apart across days');
  });
});

describe('entryAt', () => {
  it('picks the latest entry at or before now, wrapping past midnight', () => {
    const w = makeWorld({ day: 1, minute: 10 * MIN });
    const hit = S.entryAt('wren', w, data, undefined, { lowsOn });
    assert.equal(hit.entry.mapId, 'quay');
    assert.equal(hit.since, 9 * MIN);
    assert.equal(hit.startDay, 1);
    const early = S.entryAt('wren', at(w, 2, 3 * MIN), data, undefined, { lowsOn });
    assert.equal(early.entry.pose, 'sleep', 'the 23:00 entry of the day before still runs at 03:00');
    assert.equal(early.startDay, 1);
  });

  it('a tide entry runs for its `for` window, then the earlier entry resumes', () => {
    const w = makeWorld({ day: 1, minute: 17 * MIN + 40 });
    assert.equal(S.entryAt('wren', w, data, undefined, { lowsOn }).entry.mapId, 'flats');
    at(w, 1, 19 * MIN + 10);
    const after = S.entryAt('wren', w, data, undefined, { lowsOn });
    assert.equal(after.entry.mapId, 'quay', '90 minutes after 17:30 the sweep resumes');
    assert.equal(after.since, 9 * MIN);
    at(w, 1, 5 * MIN + 30);
    assert.equal(S.entryAt('wren', w, data, undefined, { lowsOn }).entry.mapId, 'flats', 'the morning low too');
  });

  it('filters by weather (in effect now), GDD weekday and cond', () => {
    const w = makeWorld({ day: 1, minute: 17 * MIN + 40 });
    w.weather.current = 'rain';
    assert.equal(S.entryAt('wren', w, data, undefined, { lowsOn }).entry.mapId, 'quay', 'no flats walk in the rain');
    w.weather.current = 'clear';
    at(w, 1, 20 * MIN + 30);
    assert.equal(S.entryAt('wren', w, data, undefined, { lowsOn }).entry.pose, 'sit', 'Monday evening on the quay');
    at(w, 6, 20 * MIN + 30);
    assert.equal(S.entryAt('wren', w, data, undefined, { lowsOn }).entry.mapId, 'quay', 'Saturday: the weekday sit is skipped');
    assert.equal(S.entryAt('wren', w, data, undefined, { lowsOn }).entry.pose, 'path');
    at(w, 2, 12 * MIN + 30);
    assert.equal(S.entryAt('tully', w, data, undefined, { lowsOn }).entry.mapId, 'tully-house', 'race entry needs its flag');
    w.flags['sp.race-day'] = true;
    assert.equal(S.entryAt('tully', w, data, undefined, { lowsOn }).entry.mapId, 'green');
  });

  it('honours GDD day ranges and ties go to the later entry', () => {
    const npc = {
      id: 'tester', schedule: [
        { at: 600, mapId: 'a', x: 0, y: 0 },
        { at: 600, mapId: 'b', x: 0, y: 0 },
        { at: 700, mapId: 'c', x: 0, y: 0, fromDay: 3 },
        { at: 800, mapId: 'd', x: 0, y: 0, toDay: 1 },
      ],
    };
    const w = makeWorld({ day: 0, minute: 650 });
    assert.equal(S.entryAt(npc, w, data).entry.mapId, 'b');
    assert.equal(S.entryAt(npc, at(w, 0, 720), data).entry.mapId, 'b', 'GDD day 1 is before fromDay 3');
    assert.equal(S.entryAt(npc, at(w, 2, 720), data).entry.mapId, 'c', 'GDD day 3');
    assert.equal(S.entryAt(npc, at(w, 0, 820), data).entry.mapId, 'd');
    assert.equal(S.entryAt(npc, at(w, 1, 820), data).entry.mapId, 'b', 'GDD day 2 is past toDay 1');
  });

  it('finds a weekly-only entry still running days later, and nothing for an empty schedule', () => {
    const w = makeWorld({ day: 4, minute: 9 * MIN });
    const hit = S.entryAt('drifter', w, data);
    assert.equal(hit.entry.mapId, 'quay');
    assert.equal(hit.startDay, 3, 'Wednesday entry (dow 2) = core day 3');
    assert.equal(S.entryAt('ghost', w, data), null);
    assert.equal(S.entryAt('nobody', w, data), null);
    assert.equal(S.entryAt('drifter', w, data, undefined, { tuning: { scheduleLookbackDays: 1 } })?.startDay, 3);
    assert.equal(S.entryAt('drifter', at(w, 6, 9 * MIN), data), null, 'default lookback is two days');
    assert.equal(S.entryAt('drifter', at(w, 9, 9 * MIN), data, undefined, { tuning: { scheduleLookbackDays: 7 } })?.startDay, 3);
  });

  it('expands schedule templates with the given spot', () => {
    const npc = { id: 'owl', templates: [{ id: 'night-owl', mapId: 'eave', x: 3, y: 1 }, { id: 'missing' }], schedule: [{ at: 12 * MIN, mapId: 'loft', x: 0, y: 0 }] };
    const list = S.expandSchedule(npc, data);
    assert.equal(list.length, 3);
    const w = makeWorld({ day: 1, minute: 22 * MIN });
    const hit = S.entryAt(npc, w, data);
    assert.deepEqual([hit.entry.mapId, hit.entry.x, hit.entry.pose], ['eave', 3, 'stand']);
    assert.equal(S.entryAt(npc, at(w, 2, 5 * MIN), data).entry.x, 9, 'template entry keeps its own x');
  });
});

describe('whereIs', () => {
  it('returns a Placement world/npc.js consumes', () => {
    const w = makeWorld({ day: 1, minute: 10 * MIN });
    const p = where('wren', w);
    assert.deepEqual(p, {
      mapId: 'quay', x: 10, y: 6, facing: 'down', pose: 'path', pathId: 'quay-sweep', since: 9 * MIN, wanderR: null,
      activity: 'sweeping', source: 'schedule', entryIndex: 1, festivalId: null,
    });
    assert.deepEqual(S.routeFor(p, data), [{ x: 10, y: 6 }, { x: 11, y: 6 }, { x: 11, y: 7 }]);
    const map = { id: 'quay', w: 20, h: 12, warps: [{ x: 0, y: 6, kind: 'edge' }] };
    const arriving = arrivalPoint(p, map, 9 * MIN + 1);
    assert.equal(arriving.arriving, true, 'within 3 minutes of `since` the NPC walks in from the edge');
    assert.deepEqual([arriving.x, arriving.y], [0, 6]);
    assert.equal(arrivalPoint(p, map, 10 * MIN).arriving, false);
    const driver = createNpcDriver({ id: 'wren', x: 10, y: 6, facing: 'up', moving: false });
    driver.setPlacement(p);
    assert.equal(driver.placement.pathId, 'quay-sweep');
  });

  it('gives the wander radius of a tide entry', () => {
    const w = makeWorld({ day: 1, minute: 17 * MIN + 35 });
    const p = where('wren', w);
    assert.deepEqual([p.mapId, p.pose, p.wanderR, p.since], ['flats', 'wander', 3, 17 * MIN + 30]);
    const b = where('barnaby', w);
    assert.deepEqual([b.mapId, b.since], ['flats', 17 * MIN], 'thirty minutes before the low');
  });

  it('absent NPCs have no placement; unknown ids neither', () => {
    const w = makeWorld({ day: 1, minute: 10 * MIN });
    assert.equal(where('linnet', w).mapId, 'linnet-house');
    w.flags['sp.linnet-gone'] = true;
    assert.equal(where('linnet', w), null);
    assert.equal(where('nobody', w), null);
    assert.equal(where(null, w), null);
  });

  it('porch talk: on the porch days inside the window when lit (window wraps midnight)', () => {
    const w = makeWorld({ day: 0, minute: 19 * MIN + 30 });   // Sunday
    const p = where('wren', w);
    assert.deepEqual([p.mapId, p.x, p.pose, p.source, p.activity, p.since], ['town', 20, 'porch', 'porch', 'porch', 19 * MIN]);
    at(w, 1, 0 * MIN + 30);                                     // Monday 00:30: Sunday's window still open
    assert.equal(where('wren', w).source, 'porch');
    at(w, 1, MIN);
    assert.notEqual(where('wren', w).source, 'porch', '01:00 closes porch talk');
    at(w, 1, 19 * MIN + 30);                                    // Monday: not a porch day
    assert.equal(where('wren', w).source, 'schedule');
    at(w, 0, 19 * MIN + 30);
    w.flags[porchFlag('wren')] = false;
    assert.equal(where('wren', w).source, 'schedule', 'a dark porch is not sat on');
    assert.equal(S.onPorch('wren', w, data, { isPorchLit: () => true }), true);
    assert.equal(S.onPorch('odile', at(w, 0, 20 * MIN), data), false, 'Odile’s porch is dark at the start');
    assert.equal(S.onPorch('odile', w, data, { isPorchLit: () => true }), true);
    assert.equal(S.onPorch('barnaby', w, data), false, 'no porch');
    assert.equal(S.porchTalkOpen(at(w, 0, 23 * MIN), data), true);
    assert.equal(S.porchTalkOpen(at(w, 0, 12 * MIN), data), false);
    assert.equal(S.porchTalkOpen(at(w, 0, 21 * MIN), data, { tuning: { porchWindow: [20 * MIN, 23 * MIN] } }), true);
  });

  it('shop post during shop hours, the schedule outside them', () => {
    const w = makeWorld({ day: 2, minute: 12 * MIN });
    const p = where('juniper', w);
    assert.deepEqual([p.mapId, p.pose, p.source, p.since], ['pells', 'shop', 'shop', 8 * MIN]);
    at(w, 2, 7 * MIN + 30);
    assert.deepEqual([where('juniper', w).mapId, where('juniper', w).source], ['pells-loft', 'schedule']);
    at(w, 2, 22 * MIN + 10);
    assert.equal(where('juniper', w).source, 'porch', 'after closing she sits out');
    assert.equal(S.isShopOpen('ludo', at(w, 2, 23 * MIN), data), true);
    assert.equal(S.isShopOpen('ludo', at(w, 2, 7 * MIN), data), true);
    assert.equal(S.isShopOpen('ludo', at(w, 2, 12 * MIN), data), false);
    assert.equal(S.isShopOpen('always', w, data), true);
    assert.equal(S.isShopOpen('nope', w, data), false);
    assert.equal(S.isShopOpen({ id: 'x', hours: [0, 1440], cond: { flag: 'sp.never' } }, w, data), false);
  });

  it('the Lantern Market: Saturdays 20:00–02:00 from GDD day 7', () => {
    const w = makeWorld({ day: 6, minute: 21 * MIN });             // GDD day 7, Saturday
    const p = where('wren', w);
    assert.deepEqual([p.mapId, p.x, p.facing, p.source, p.festivalId, p.activity, p.since], ['green', 8, 'left', 'festival', 'lantern-market', 'festival:lantern-market', 20 * MIN]);
    assert.equal(S.isFestival('lantern-market', w, data), true);
    at(w, 7, MIN + 30);
    assert.equal(where('wren', w).festivalId, 'lantern-market', 'Sunday 01:30 is still Saturday’s market');
    at(w, 7, 2 * MIN);
    assert.notEqual(where('wren', w).festivalId, 'lantern-market');
    at(w, 13, 20 * MIN);
    assert.equal(S.isFestival('lantern-market', w, data), true, 'GDD day 14');
    assert.equal(where('barnaby', w).source, 'schedule', 'no spot, no festival');
    const early = { ...data, festivals: [{ id: 'lantern-market', dow: [5], fromDay: 14, from: 20 * MIN, to: 2 * MIN }] };
    assert.equal(S.isFestival('lantern-market', at(w, 6, 21 * MIN), early), false, 'content festivals replace the defaults');
    assert.equal(S.isFestival('lantern-market', at(w, 13, 21 * MIN), early), true);
    const dated = { ...data, festivals: [{ id: 'long-night', days: [14], from: 17 * MIN, to: 6 * MIN, cond: { flag: 'sp.relit' } }] };
    assert.equal(S.isFestival('long-night', at(w, 13, 23 * MIN), dated), false);
    w.flags['sp.relit'] = true;
    assert.equal(S.isFestival('long-night', w, dated), true);
    assert.equal(S.isFestival('long-night', at(w, 12, 23 * MIN), dated), false);
  });

  it('the Porch Supper gathers guests at the week’s host porch', () => {
    const w = makeWorld({ day: 6, minute: 18 * MIN + 30 });        // GDD 7, week 0
    const host = S.porchSupperHost(w, data, 6);
    assert.equal(host.npcId, 'juniper', 'lit neighbour porches sorted: juniper, tully, wren');
    assert.equal(S.porchSupperHost(w, data, 13).npcId, 'tully', 'week 1');
    assert.equal(S.porchSupperHost(w, data, 20).npcId, 'wren', 'week 2');
    const j = where('juniper', w);
    assert.deepEqual([j.mapId, j.x, j.y, j.pose, j.festivalId], ['town', 30, 5, 'sit', 'porch-supper']);
    const wr = where('wren', w);
    assert.deepEqual([wr.x, wr.y], [31, 5], 'first guest sits to the right');
    const tu = where('tully', w);
    assert.deepEqual([tu.x, tu.y], [30, 6], 'an explicit offset wins');
    assert.equal(where('barnaby', w).festivalId, null, 'not invited');
    w.flags[porchFlag('odile')] = true;
    assert.equal(S.porchSupperHost(w, data, 6).npcId, 'juniper');
    assert.equal(S.porchSupperHost(w, data, 20).npcId, 'tully', 'odile joins the rotation once lit');
    assert.equal(S.porchSupperHost(w, data, 6, { tuning: { porchSupperHosts: ['wren', 'ghost'] } }).npcId, 'wren');
    const dark = makeWorld({ day: 6, minute: 18 * MIN + 30 });
    for (const id of ['wren', 'juniper', 'tully']) dark.flags[porchFlag(id)] = false;
    assert.equal(S.porchSupperHost(dark, data, 6), null);
    assert.equal(where('wren', dark).festivalId, null, 'no lit porch, no supper');
  });

  it('a running priority entry beats the porch; home is the last resort', () => {
    const w = makeWorld({ day: 0, minute: 23 * MIN });
    const npc = {
      id: 'p', home: 'hut', porch: { mapId: 'town', x: 1, y: 1, litAtStart: true },
      schedule: [{ at: 22 * MIN + 30, mapId: 'pier', x: 4, y: 4, priority: 'high' }],
    };
    assert.equal(S.whereIs(npc, w, data).source, 'priority');
    const homeOnly = { id: 'h', home: 'hut', schedule: [{ at: 600, mapId: 'x', x: 1, y: 1, days: [9] }] };
    const h = S.whereIs(homeOnly, w, data);
    assert.deepEqual([h.mapId, h.x, h.y, h.source], ['hut', 0, 0, 'home']);
    const d = where('drifter', makeWorld({ day: 1, minute: 600 }));
    assert.deepEqual([d.mapId, d.x, d.facing, d.source], ['quay', 4, 'up', 'home'], 'homeSpot');
    assert.equal(where('ghost', w), null, 'no schedule, no home');
  });

  it('npcsOnMap lists the NPCs whose placement is on a map', () => {
    const w = makeWorld({ day: 2, minute: 12 * MIN });
    const ids = S.npcsOnMap(w, data, 'quay', { lowsOn }).map((x) => x.npcId);
    assert.deepEqual(ids, ['wren', 'drifter'], 'drifter’s home spot is on the quay');
    assert.deepEqual(S.npcsOnMap(w, data, 'pells', { lowsOn, npcIds: ['juniper', 'wren'] }).map((x) => x.npcId), ['juniper']);
  });

  it('routeFor rejects missing routes and routes on another map', () => {
    assert.equal(S.routeFor(null, data), null);
    assert.equal(S.routeFor({ mapId: 'quay', pathId: null }, data), null);
    assert.equal(S.routeFor({ mapId: 'quay', pathId: 'missing' }, data), null);
    assert.equal(S.routeFor({ mapId: 'green', pathId: 'quay-sweep' }, data), null);
  });

  it('is deterministic and read-only', () => {
    const w = makeWorld({ day: 6, minute: 18 * MIN + 30 });
    const before = JSON.stringify(w);
    const a = data.npcs.map((n) => where(n.id, w));
    const b = data.npcs.map((n) => where(n.id, w));
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(w), before);
  });

  it('works against a frozen registry', () => {
    const reg = createRegistry(Object.freeze({ npcs: data.npcs, schedules: data.schedules, shops: data.shops }));
    const w = makeWorld({ day: 1, minute: 10 * MIN });
    assert.equal(S.whereIs('wren', w, reg, { lowsOn }).pathId, 'quay-sweep');
    assert.deepEqual(S.routeFor(S.whereIs('wren', w, reg, { lowsOn }), reg).length, 3);
  });
});
