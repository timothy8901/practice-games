// Story runtime fixes (wave 2, story lane):
//  MID-07   cond `day` is the GDD day; every beat lands on its GDD-00 §11 day and waits for its act
//  LG-RN70  Real Clock keeps the run day (cond, Glint, clockSys) instead of the epoch day
//  LG-CH61  the market lights come down after market night
//  LG-RN34  {hasItem} on a currency item reads the wallet
//  MID-12   dark houses 2-8 reopen one a night after the credits; the Shift Tide line selector
//  MID-16   narration in NPC talk (scripts and pools) shows no speaker
//  first badge opens Act II; the Late Delivery party waits for its evening; Tully's nickname scene only
//  by the Commons board; oyster-boat beat 2 never the day of beat 1 and Tamsin at the boat while it is next;
//  the Summit Bell can be declined; the skyglass pickup emits gather:skyglass; the Lantern Stack is graded
// Run: node --test test/story.runtime.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DATA_CONTENT } from '../js/data/content.js';
import { createRegistry } from '../js/data/registry.js';
import { createNewWorld } from '../js/state/schema.js';
import { encodeSeedCode, makeRng } from '../js/core/rng.js';
import { createClock, MINUTES_PER_DAY } from '../js/core/time.js';
import * as sel from '../js/state/selectors.js';
import * as clockSys from '../js/systems/clockSys.js';
import * as wallet from '../js/systems/wallet.js';
import * as G from '../js/systems/gather.js';
import { evalCond } from '../js/script/cond.js';
import { createRunner } from '../js/script/runner.js';
import { resolveScript } from '../js/script/registry.js';
import { scriptFor } from '../js/systems/flow/eventScripts.js';
import { STORY_TRIGGERS } from '../js/data/scripts/index.js';
import { whereIs } from '../js/systems/schedule.js';
import { loadMap } from '../js/world/tilemap.js';
import { gradeFor } from '../js/world/lighting.js';
import { TUNING } from '../js/data/tuning.js';
import { MAPS_BY_ID } from '../js/data/maps/index.js';
import { TOWN, LOW, recordingBus, master, makeWorld } from './fixtures/gatherLane.fixture.mjs';
import { DATA as GATHER_DATA } from './fixtures/gatherLane.fixture.mjs';

const data = createRegistry(DATA_CONTENT);
const fresh = (dial = 'FLUX') => createNewWorld({ seedCode: encodeSeedCode({ seed: 88, dial, toggles: [] }) });
/** Puts a world at GDD day `gd`, hh:mm. */
const at = (w, gd, hh, mm = 0) => { w.clock.total = (gd - 1) * MINUTES_PER_DAY + hh * 60 + mm; return w; };
const fire = (w, evt, payload = {}) => scriptFor(w, data, evt, payload);

/** Runs a script with the real flag system and picks for choices; returns the requests. */
function drive(id, world, picks = [], extra = {}) {
  const answers = picks.slice();
  const requests = [];
  const runner = createRunner(data.get('scripts', id), { world, data, scriptId: id, mapId: world.player.mapId, systems: {
    give() { return { ok: true }; }, take() { return { ok: true }; }, earn() {}, spend() {}, remember() {}, setBeat() {}, ...extra,
  } });
  let r = runner.step();
  while (!r.done) {
    requests.push(r);
    if (requests.length > 400) throw new Error(`unbounded ${id}`);
    r = runner.step(r.op === 'choice' ? (answers.shift() ?? 0) : undefined);
  }
  return requests;
}

describe('MID-07: story days are GDD days', () => {
  it('cond day reads the GDD day (day 1 = arrival)', () => {
    const w = at(fresh(), 1, 18);
    assert.equal(sel.gameDay(w), 1);
    assert.equal(evalCond(w, { day: { gte: 1, lte: 1 } }), true);
    assert.equal(evalCond(w, { day: { gte: 2 } }), false);
    assert.equal(evalCond(w, { day: { dow: [6] } }), true, 'day 1 is a Sunday');
  });

  it('the Raft docks on day 3, Act II opens on day 4, not a day late', () => {
    const w = at(fresh(), 2, 12);
    assert.notEqual(fire(w, 'clock:hour', { hour: 12 }), 'raft-docks');
    at(w, 3, 12);
    assert.equal(fire(w, 'clock:hour', { hour: 12 }), 'raft-docks');
    w.flags['sp.raft-docked'] = true;
    at(w, 3, 23);
    assert.notEqual(fire(w, 'clock:hour', { hour: 23 }), 'act-2-open');
    at(w, 4, 0);
    assert.equal(fire(w, 'day:start', { day: 3, gameDay: 4 }), 'act-2-open');
  });

  it('the first Lantern Market is day 7 at 20:00 (Saturday) and runs to 02:00 Sunday', () => {
    const w = fresh();
    Object.assign(w.flags, { 'sp.raft-docked': true, 'sp.act-2': true });
    at(w, 7, 19);
    assert.notEqual(fire(w, 'clock:hour', { hour: 19 }), 'first-lantern-market');
    at(w, 7, 20);
    assert.equal(fire(w, 'clock:hour', { hour: 20 }), 'first-lantern-market');
    at(w, 8, 1);
    assert.equal(fire(w, 'map:enter', { mapId: 'pellwick' }), 'first-lantern-market', 'still market night after midnight');
    at(w, 8, 3);
    assert.notEqual(fire(w, 'clock:hour', { hour: 3 }), 'first-lantern-market');
    at(w, 14, 20);
    w.flags['sp.act-2'] = false;
    assert.notEqual(fire(w, 'clock:hour', { hour: 20 }), 'first-lantern-market', 'waits for Act II');
  });

  it('the Surge falls back to day 10 but only inside Act III; mid-game beats stop after the Relighting', () => {
    const w = fresh();
    Object.assign(w.flags, { 'sp.raft-docked': true, 'sp.act-2': true, 'sp.first-market': true });
    at(w, 10, 6);
    assert.notEqual(fire(w, 'day:start', { gameDay: 10 }), 'the-surge', 'Act III has not opened');
    w.flags['sp.act-3'] = true;
    at(w, 9, 6);
    assert.notEqual(fire(w, 'day:start', { gameDay: 9 }), 'the-surge');
    at(w, 10, 6);
    assert.equal(fire(w, 'day:start', { gameDay: 10 }), 'the-surge');
    w.flags['sp.relighting'] = true;
    assert.equal(fire(w, 'day:start', { gameDay: 10 }), null);
    // after the credits nothing of Acts II-III queues on a market night or a night low
    at(w, 14, 21);
    w.badges = ['turn', 'ward', 'weather', 'hollow', 'relay'];
    for (const s of ['first-lantern-market', 'linnet-fall', 'two-plans-one-night', 'comet-brightens', 'the-surge']) {
      assert.notEqual(fire(w, 'clock:hour', { hour: 21 }), s);
    }
    // verify: the Thistlewind street trigger (badge 4 at night) is the Surge's other door; it stays shut too
    const row = STORY_TRIGGERS.thistlewind.find((r) => r.script === 'the-surge');
    const t = fresh();
    t.badges = ['turn', 'ward', 'weather', 'hollow'];
    at(t, 9, 22);
    assert.equal(evalCond(t, row.cond, { data }), true, 'badge 4 at night opens it before the Relighting');
    t.flags['sp.relighting'] = true;
    assert.equal(evalCond(t, row.cond, { data }), false, 'never after the Relighting');
  });

  it('the first badge opens Act II from its own beat (one script per badge:won event)', () => {
    const w = at(fresh(), 2, 14);
    assert.equal(fire(w, 'badge:won', { spireId: 'turn' }), 'story-spire-turn-badge');
    drive('story-spire-turn-badge', w);
    assert.equal(w.flags['sp.act-2'], true);
    // a later badge never replays it
    const w2 = at(fresh(), 5, 14);
    w2.flags['sp.act-2'] = true;
    const reqs = drive('story-spire-ward-badge', w2);
    assert.ok(!reqs.some((r) => r.op === 'toast' && /II/.test(r.text)));
  });
});

describe('LG-RN70: Real Clock keeps the run day', () => {
  it('turning Real Clock on during day 1: still day 1, the Glint pays the day-1 value and day-gated story waits', () => {
    const world = at(fresh(), 1, 17, 40);
    const ms = new Date(2026, 9, 28, 19, 30).getTime();
    const clock = createClock({ ...clockSys.optionsFrom(world), now: () => ms });
    clockSys.restoreFrom(world, clock);
    clockSys.applySettingsEffects(world, clock, [{ kind: 'clock.realClock', realClock: true }]);
    clockSys.tick(world, clock, 16, {});
    assert.equal(world.clock.realClock, true);
    assert.equal(clockSys.gameDay(world), 1);
    assert.equal(sel.gameDay(world), 1);
    assert.equal(Math.floor(clockSys.minuteOfDay(world)), 19 * 60 + 30, 'the device hour');
    const paid = wallet.collectGlint(world, { tuning: TUNING });
    assert.equal(paid.value, wallet.glintValue(1, TUNING));
    assert.ok(paid.value < 1000, `the Glint pays ${paid.value}, not a million`);
    world.flags['sp.raft-docked'] = false;
    assert.notEqual(fire(world, 'clock:hour', { hour: 19 }), 'raft-docks');
  });
});

describe('LG-CH61: market lights', () => {
  it('go up on later market nights and come down after 02:00', () => {
    const w = fresh();
    Object.assign(w.flags, { 'sp.act-2': true, 'sp.first-market': true, 'sp.raft-docked': true, 'sys.lantern-market': true });
    at(w, 8, 2);
    assert.equal(fire(w, 'clock:hour', { hour: 2 }), 'market-lights-off');
    drive('market-lights-off', w);
    assert.equal(evalCond(w, { flag: 'sys.lantern-market' }), false);
    at(w, 10, 21);
    assert.equal(fire(w, 'clock:hour', { hour: 21 }), null, 'not on a weekday');
    at(w, 14, 20);
    assert.equal(fire(w, 'clock:hour', { hour: 20 }), 'market-lights-on');
    drive('market-lights-on', w);
    assert.equal(evalCond(w, { flag: 'sys.lantern-market' }), true);
  });
});

describe('the Late Delivery party waits for its evening', () => {
  it('the 06:00 letters event queues nothing; the green fills at 18:00-02:00', () => {
    const w = at(fresh(), 23, 6);
    Object.assign(w.flags, { 'sp.raft-docked': true, 'sp.act-2': true, 'sp.act-3': true, 'sp.relighting': true });
    w.flags['sp.late-delivery'] = 23;
    assert.equal(fire(w, 'letters:late-delivery', { gameDay: 23 }), null);
    assert.notEqual(fire(w, 'clock:hour', { hour: 6 }), 'late-delivery-party');
    at(w, 23, 18);
    assert.equal(fire(w, 'clock:hour', { hour: 18 }), 'late-delivery-party');
    drive('late-delivery-party', w);
    assert.equal(w.flags['sp.late-delivery'], 23, 'the day the 56th letter came is kept');
  });
});

describe('LG-RN34: hasItem on a currency', () => {
  it('reads the wallet for Starsalt and Anchor Stones', () => {
    const w = fresh();
    assert.equal(evalCond(w, { hasItem: 'starsalt' }, { data }), false);
    w.wallet.starsalt = 3;
    w.wallet.anchors = 1;
    assert.equal(evalCond(w, { hasItem: 'starsalt', n: 3 }, { data }), true);
    assert.equal(evalCond(w, { hasItem: 'starsalt', n: 4 }, { data }), false);
    assert.equal(evalCond(w, { hasItem: 'anchor-stone' }), true, 'without a registry too');
  });
});

describe('MID-12: after the Relighting', () => {
  it('dark houses 2-8 reopen one a night at 20:00 in pellwick.js reopensNight order, then stop', () => {
    const w = at(fresh(), 15, 20);
    Object.assign(w.flags, { 'sp.relighting': true, 'lit.fleetHome': true, 'sp.credits-seen': true, 'sp.act-2': true, 'sp.first-market': true });
    const order = MAPS_BY_ID.pellwick.entities.filter((e) => e.litBy === 'relighting').sort((a, b) => a.reopensNight - b.reopensNight).map((e) => e.id);
    assert.equal(order.length, 7);
    const lit = [];
    for (let night = 0; night < 9; night++) {
      const id = fire(w, 'clock:hour', { hour: 20 });
      if (night >= 7) { assert.notEqual(id, 'dark-house-reopens'); continue; }
      assert.equal(id, 'dark-house-reopens', `night ${night + 1}`);
      const before = Object.keys(w.flags).filter((k) => k.startsWith('sys.porch.porch-dark-') && w.flags[k]);
      drive('dark-house-reopens', w);
      lit.push(Object.keys(w.flags).find((k) => k.startsWith('sys.porch.porch-dark-') && w.flags[k] && !before.includes(k)).slice('sys.porch.'.length));
    }
    assert.deepEqual(lit, order);
  });

  it('the Shift Tide line lists every pending window once the Relighting chalks it', () => {
    const w = fresh();
    w.party = [{ uid: 'u1', nickname: 'Puddle', speciesId: 'sloshkin', level: 20 }];
    w.pendingShifts = ['u1'];
    assert.deepEqual(sel.shiftTideLines(w), []);
    w.flags['lit.shiftTide'] = true;
    assert.deepEqual(sel.shiftTideLines(w), [{ uid: 'u1', nick: 'Puddle', speciesId: 'sloshkin', level: 20 }]);
  });
});

describe('MID-16: narration in NPC talk', () => {
  it('a `* ...` thread line and a `* ...` pool line carry no speaker', () => {
    const w = fresh();
    const runner = createRunner(['* Bryony is in her bean rows.', 'Bryony: Hm.'], { world: w, data, npc: 'bryony' });
    const first = runner.step();
    assert.equal(first.who, null);
    assert.equal(first.name, null);
    assert.equal(runner.step().who, 'bryony');
    // a pool line written `* ...` (registry line source) stays narration under the runner too
    const pool = createRunner([{ op: 'say', who: null, text: 'Dimity is folded up against the lamp glass.' }], { world: w, data, npc: 'dimity' }).step();
    assert.equal(pool.who, null);
  });
});

describe('cast gates', () => {
  it("Tully's nickname scene plays only by the Commons board", () => {
    const w = at(fresh(), 1, 19);
    w.flags['sp.errands-started'] = true;
    w.npcs.tully = { ...(w.npcs.tully ?? {}), met: true, talks: 1, nickname: null, saidLines: {}, favours: [], remembered: {} };
    Object.assign(w.player, { mapId: 'pellwick', x: 20, y: 40 });
    assert.notEqual(resolveScript(w, data, { kind: 'npc', id: 'tully', mapId: 'pellwick' }).scriptId, 'tully-nickname');
    Object.assign(w.player, { x: 37, y: 25 });
    assert.equal(resolveScript(w, data, { kind: 'npc', id: 'tully', mapId: 'pellwick' }).scriptId, 'tully-nickname');
  });

  it('oyster-boat beat 2 never follows beat 1 the same day, and Tamsin keeps to the boat while it is next', () => {
    const w = at(fresh(), 5, 10);
    w.flags['sp.tamsin-arrived'] = true;
    w.npcs.tamsin = { ...(w.npcs.tamsin ?? {}), met: true, talks: 3, saidLines: {}, favours: [], remembered: {} };
    w.threads['oyster-boat'] = { beat: 1, done: false, startedDay: 4, lastAdvancedDay: 4 };
    Object.assign(w.player, { mapId: 'pellwick', x: 44, y: 6 });
    assert.notEqual(resolveScript(w, data, { kind: 'npc', id: 'tamsin', mapId: 'pellwick' }).scriptId, 'th-oyster-boat-2', 'same day as beat 1');
    at(w, 6, 10);
    assert.equal(resolveScript(w, data, { kind: 'npc', id: 'tamsin', mapId: 'pellwick' }).scriptId, 'th-oyster-boat-2');
    const boat = MAPS_BY_ID.pellwick.markers['tamsin-boat'];
    const atBoat = () => { const p = whereIs('tamsin', w, data, { tuning: TUNING }); return Boolean(p) && p.mapId === 'pellwick' && p.x === boat.x && p.y === boat.y; };
    for (const hh of [8, 9, 13, 17]) {
      at(w, 6, hh, 30);
      assert.ok(atBoat(), `${hh}:30`);
    }
    at(w, 6, 13, 30);
    w.threads['oyster-boat'].beat = 2;
    assert.equal(atBoat(), false, 'her normal day once beat 2 is done');
  });
});

describe('the Summit Bell can be declined', () => {
  it("'Start again from the first Keeper' stands the beaten Keepers up again; keeping the place leaves them", () => {
    const keep = fresh();
    keep.run.dial = 'flux';
    Object.assign(keep.flags, { 'sys.trainer.bastien-keeper': true, 'sys.trainer.cass-keeper': true });
    drive('summit-bell', keep, [0]);
    assert.equal(keep.flags['sys.trainer.cass-keeper'], true);
    const w = fresh();
    w.run.dial = 'flux';
    Object.assign(w.flags, { 'sys.trainer.bastien-keeper': true, 'sys.trainer.cass-keeper': true });
    const reqs = drive('summit-bell', w, [1]);
    assert.ok(reqs.some((r) => r.op === 'choice' && r.options.some((o) => /first Keeper/.test(o.text))));
    assert.ok(!w.flags['sys.trainer.bastien-keeper'] && !w.flags['sys.trainer.cass-keeper']);
    const ff = fresh('FREEFALL');
    ff.run.dial = 'freefall';
    assert.ok(!drive('summit-bell', ff).some((r) => r.op === 'choice'), 'Freefall restarts anyway: no choice');
  });

  it('verify: the Bell rung by hand after the Summit is cleared (or before any Keeper falls) offers no restart', () => {
    // idris-hall's Bell prop runs this script by hand: a restart after the clear would stand Idris up
    // again and re-pay every Summit purse and replay his win
    const cleared = fresh();
    cleared.run.dial = 'drift';
    Object.assign(cleared.flags, { 'sys.trainer.bastien-keeper': true, 'sys.trainer.cass-keeper': true, 'sys.trainer.idris-champion': true });
    assert.ok(!drive('summit-bell', cleared).some((r) => r.op === 'choice'), 'no decline once the Champion is beaten');
    assert.equal(cleared.flags['sys.trainer.idris-champion'], true);
    assert.equal(cleared.flags['sys.trainer.bastien-keeper'], true);
    const none = fresh();
    none.run.dial = 'flux';
    assert.ok(!drive('summit-bell', none).some((r) => r.op === 'choice'), 'nothing to restart before the first Keeper falls');
    const mid = fresh();
    mid.run.dial = 'drift';
    mid.flags['sys.trainer.bastien-keeper'] = true;
    drive('summit-bell', mid, [1]);
    assert.ok(!mid.flags['sys.trainer.bastien-keeper'], 'a climb under way can still be declined');
  });
});

describe('gather:skyglass', () => {
  it('the skyglass pickup emits gather:skyglass {n: 1} (the Glowing Flats stamp counter)', () => {
    const w = makeWorld({ total: 2 * LOW });
    const base = { data: GATHER_DATA, lead: null, tideOffset: 0 };
    const li = G.lowInfo(w, base);
    assert.equal(li.nightLow, true);
    const g = G.glintFor(w, TOWN, master(w), base);
    const k = G.skyglassFor(w, TOWN, master(w), li.lowIndex, base).find((r) => !(r.x === g.x && r.y === g.y));
    const { bus, events } = recordingBus();
    const r = G.dig(w, TOWN, k.x, k.y, master(w), { ...base, bus });
    assert.equal(r.kind, 'skyglass');
    const ev = events.find(([e]) => e === 'gather:skyglass');
    assert.ok(ev);
    assert.equal(ev[1].n, 1);
  });
});

describe('MID-17: the Lantern Stack is graded like the sky', () => {
  it('is not an indoor map, so 23:00 is night up there', () => {
    const def = MAPS_BY_ID['lantern-stack'];
    assert.equal(def.light?.indoor, false);
    assert.notEqual(def.kind, 'interior');
    const night = gradeFor(23 * 60, 'clear', false);
    const noon = gradeFor(12 * 60, 'clear', false);
    assert.notDeepEqual(night, noon);
    assert.equal(gradeFor(23 * 60, 'clear', true).indoor, true);
    assert.notEqual(night.indoor, true);
  });
});

// keep makeRng imported for fixtures that need a stream
void makeRng;
void loadMap;
