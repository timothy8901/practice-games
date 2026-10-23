// Arena weather and held items in js/battle (engine.js, weather.js, heldItems.js, ai.js, read.js),
// on the real content tables: determinism, each WEATHER_KINDS kind, the Weather Spire's posted
// cycle, entry / move / setup weather, every held-item key the item rows use (and the generic
// ones: threshold heals, cures, type boosts, accuracy and stat multipliers), consumption reported
// in the result, the trainer AI's weather awareness, the Read card / dossier posting, the
// validator rules and the event contract over simulated Spire and Summit fights.
// Run: node --test test/battle.weather-items.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createBattle, BattleError, DEFAULTS, readCard, dossier } from '../js/battle/engine.js';
import { checkEvent } from '../js/battle/events.js';
import { chooseAction, chooseReplacement } from '../js/battle/ai.js';
import { createBattleData } from '../js/battle/data.js';
import { HELD_KEYS, getHeldRuntime, heldProblems } from '../js/battle/heldItems.js';
import { cycleKindAt, describeCycle, indexWeatherKinds, weatherKindProblems, weatherSchedule } from '../js/battle/weather.js';
import { moveProblems, weatherOf, isSelfTargeting } from '../js/battle/effects.js';
import { validateData } from '../tools/validate-data.mjs';
import { BATTLE_DATA, mon, trainerParty, playBattle, buildParty, itemRows, PARTIES } from '../tools/balance-sim.mjs';
import { makeRng } from '../js/core/rng.js';
import { DATA } from '../js/data/index.js';
import { TYPES } from '../js/data/types.js';
import { ABILITIES } from '../js/data/abilities.js';
import { SPECIES, FAMILIES } from '../js/data/species/index.js';
import { MOVES } from '../js/data/moves/index.js';
import { ITEMS } from '../js/data/items.js';
import { TRAINERS, TRAINER_BY_ID } from '../js/data/trainers.js';
import { SPIRES, SPIRE_BY_ID, WEATHER_KINDS, SUMMIT } from '../js/data/spires.js';

// --- fixtures ---------------------------------------------------------------------------------------

/** An rng stub: `next()` is always `v` (chance(p) is v < p), `int()` the low bound. */
function constRng(v = 0.5) {
  return { next: () => v, int: (a) => a, chance: (p) => v < p, pick: (a) => a[0], weighted: (e) => e.find((x) => x.w > 0)?.v };
}

/** Moves the AI and move-weather tests need (special, 100% accurate, no effects). */
const TEST_MOVES = Object.freeze([
  { id: 'test-plain', name: 'Test Plain', type: 'Plain', category: 'special', power: 90, accuracy: 100, pp: 10, priority: 0, effect: {} },
  { id: 'test-kiln', name: 'Test Kiln', type: 'Kiln', category: 'special', power: 85, accuracy: 100, pp: 10, priority: 0, effect: {} },
  { id: 'test-kiln-big', name: 'Test Kiln Big', type: 'Kiln', category: 'special', power: 95, accuracy: 100, pp: 10, priority: 0, effect: {} },
  { id: 'test-gust', name: 'Test Gust', type: 'Gust', category: 'special', power: 80, accuracy: 100, pp: 10, priority: 0, effect: {} },
  { id: 'test-squall-call', name: 'Squall Call', type: 'Gust', category: 'status', power: 0, accuracy: null, pp: 5, priority: 0, effect: { weather: { kind: 'squall', turns: 2 } } },
  { id: 'test-steam-call', name: 'Steam Call', type: 'Kiln', category: 'status', power: 0, accuracy: null, pp: 5, priority: 0, effect: { weather: 'steam' } },
  { id: 'test-ash-bite', name: 'Ash Bite', type: 'Stone', category: 'physical', power: 40, accuracy: 100, pp: 10, priority: 0, effect: { weather: { kind: 'ash', turns: 3 } } },
]);
/** Item rows for the generic held keys no shipped item uses yet. */
const TEST_ITEMS = Object.freeze([
  { id: 'test-berry', name: 'Test Berry', pocket: 'held', held: { healAt: { below: 0.5, fraction: 0.25 }, consumable: true } },
  { id: 'test-poultice', name: 'Test Poultice', pocket: 'held', held: { cures: ['burn'], consumable: true } },
  { id: 'test-kiln-charm', name: 'Kiln Charm', pocket: 'held', held: { typeBoost: { types: ['Kiln'], mult: 1.2 } } },
  { id: 'test-lens', name: 'Test Lens', pocket: 'held', held: { accuracyMult: 1.1 } },
  { id: 'test-anklet', name: 'Test Anklet', pocket: 'held', held: { statMult: { spe: 1.5 } } },
]);
const XDATA = Object.freeze({ ...BATTLE_DATA, moves: [...MOVES, ...TEST_MOVES], items: [...ITEMS, ...TEST_ITEMS] });

/** A creature from the real tables with explicit move slots (custom test moves allowed). */
function mk(speciesId, level, moves, extra = {}) {
  const c = mon(speciesId, level, null);
  c.moves = moves.map((id) => ({ id, pp: 20, maxPp: 20 }));
  c.heartmark = null;
  return Object.assign(c, extra);
}

/** A trainer battle on the extended real data. */
function fight(p0, p1, opts = {}) {
  return createBattle({
    sides: [{ party: Array.isArray(p0) ? p0 : [p0], bag: opts.bag }, { party: Array.isArray(p1) ? p1 : [p1], trainer: opts.trainer || { name: 'Ines' } }],
    kind: opts.kind || 'trainer', data: opts.data || XDATA, rng: opts.rng || constRng(0.5), dial: 'flux',
    weather: opts.weather, weatherCycle: opts.weatherCycle, weatherKinds: opts.weatherKinds, tuning: opts.tuning, source: opts.source,
    curveLevel: opts.curveLevel,
  });
}
const ofType = (evs, type) => evs.filter((e) => e.type === type);
const settle = { type: 'move', move: 0 };
const WEATHER_RULE = SPIRE_BY_ID.weather.theme.rule;

// --- the weather module -----------------------------------------------------------------------------

describe('weather.js: kinds, cycles and the posted strip', () => {
  it('the four shipped kinds are valid against the real type chart', () => {
    const chart = createBattleData(BATTLE_DATA).chart;
    for (const w of WEATHER_KINDS) assert.deepEqual(weatherKindProblems(w, chart), [], w.id);
    assert.deepEqual([...indexWeatherKinds(WEATHER_KINDS).keys()], ['steam', 'ash', 'squall', 'clear']);
    assert.ok(weatherKindProblems({ id: 'x', name: 'X', text: 't', power: { Lava: 2 } }, chart).some((p) => /unknown type Lava/.test(p)));
    assert.ok(weatherKindProblems({ id: 'x', name: 'X', text: 't', wind: 1 }).some((p) => /unknown field "wind"/.test(p)));
    assert.throws(() => indexWeatherKinds([{ id: 'x', name: 'X' }]), TypeError);
  });

  it('the Weather Spire cycle: 3 turns each, steam -> ash -> squall -> clear -> steam', () => {
    const want = ['steam', 'steam', 'steam', 'ash', 'ash', 'ash', 'squall', 'squall', 'squall', 'clear', 'clear', 'clear', 'steam'];
    assert.deepEqual(want.map((_, i) => cycleKindAt(WEATHER_RULE, i + 1)), want);
    assert.equal(describeCycle(WEATHER_RULE, indexWeatherKinds(WEATHER_KINDS)), 'Turns 1-3 Steam, 4-6 Ash, 7-9 Squall, 10-12 Clear, then repeat.');
    const strip = weatherSchedule({ cycle: WEATHER_RULE, timed: { kind: 'squall', lastTurn: 2 } }, 1, 5, indexWeatherKinds(WEATHER_KINDS));
    assert.deepEqual(strip.map((p) => p.kind), ['squall', 'squall', 'steam', 'ash', 'ash']);
  });

  it('the move effect vocabulary: weather is an EFFECT_KEYS key, a field move is self-targeting', () => {
    assert.deepEqual(weatherOf({ weather: 'ash' }), { kind: 'ash', turns: null });
    assert.deepEqual(weatherOf({ weather: { kind: 'squall', turns: 2 } }), { kind: 'squall', turns: 2 });
    assert.equal(weatherOf({}), null);
    assert.ok(isSelfTargeting(TEST_MOVES.find((m) => m.id === 'test-squall-call')));
    assert.deepEqual(moveProblems(TEST_MOVES.find((m) => m.id === 'test-squall-call')), []);
    assert.ok(moveProblems({ ...TEST_MOVES[0], effect: { weather: { kind: 'ash', turns: 0 } } }).some((p) => /weather/.test(p)));
  });
});

// --- determinism ------------------------------------------------------------------------------------

describe('determinism', () => {
  const run = (seed) => {
    const sp = SPIRE_BY_ID.weather;
    const party = buildParty('weather', 'reedkit');
    const r = playBattle(party, trainerParty(TRAINER_BY_ID[sp.trainer]), { rng: makeRng(seed), trainer: TRAINER_BY_ID[sp.trainer], source: 'spire', items: itemRows('weather', party), weatherCycle: sp.theme.rule });
    return JSON.stringify(r.events, (k, v) => (k === "uid" ? undefined : v));
  };

  it('same seed, same setup: the same events, weather and held items included', () => {
    const a = run('det:1');
    assert.equal(a, run('det:1'));
    assert.match(a, /"weather-start"/);
    assert.notEqual(a, run('det:2'));
  });

  it('weather and held items draw nothing from the rng (a stub rng gives the same log twice)', () => {
    const go = () => {
      const bt = fight(mk('lumenveil', 30, ['settle'], { heldItem: 'ballast-stone' }), mk('coilcrest', 30, ['settle'], { onEntry: { weather: 'squall', turns: 2 } }), { weatherKinds: WEATHER_KINDS });
      for (let i = 0; i < 4; i++) bt.step([settle, settle]);
      return JSON.stringify(bt.log, (k, v) => (k === "uid" ? undefined : v));
    };
    assert.equal(go(), go());
  });
});

// --- each weather kind ------------------------------------------------------------------------------

describe('each weather kind', () => {
  const pair = (weather) => fight(mk('mothling', 30, ['kiln-maw', 'frost-nip', 'gale-cut', 'sure-pinch']), mk('wirewhisk', 30, ['settle']), { weather });

  it('steam: Kiln x1.2, Rime x0.8, every hit chance x0.9 (sure hits stay sure)', () => {
    const clear = pair(undefined);
    const steam = pair('steam');
    const ratio = (slot) => steam.estimateDamage(0, slot).max / clear.estimateDamage(0, slot).max;
    assert.ok(Math.abs(ratio(0) - 1.2) < 0.06, `Kiln ${ratio(0)}`);
    assert.ok(Math.abs(ratio(1) - 0.8) < 0.06, `Rime ${ratio(1)}`);
    assert.equal(ratio(2), 1, 'Gust untouched');
    const menu = steam.legal(0).moves;
    assert.equal(menu[0].hitChance, 0.9);
    assert.equal(menu[3].hitChance, 1, 'Sure Pinch never misses');
    assert.deepEqual(menu.map((m) => m.weatherWord), ['Boosted', 'Dampened', null, null]);
    assert.equal(steam.state().weather.kind, 'steam');
    assert.equal(steam.state().weather.turnsLeft, null, 'a setup kind stands until replaced');
    assert.equal(clear.state().weather.kind, null);
  });

  it('ash: Stone and Grit x1.2, Gust x0.8; 1/16 chip to all but Kiln and Stone, through a Ward', () => {
    const bt = fight(mk('prismoth', 30, ['settle']), [mk('sootling', 30, ['settle']), mk('stillox', 30, ['settle'])], { weather: 'ash' });
    assert.equal(bt.weatherPowerMult('Stone'), 1.2);
    assert.equal(bt.weatherPowerMult('Grit'), 1.2);
    assert.equal(bt.weatherPowerMult('Gust'), 0.8);
    assert.equal(bt.weatherPowerMult(null), 1, 'typeless is untouched');
    const evs = bt.step([settle, settle]);
    const chip = ofType(evs, 'damage').filter((e) => e.source === 'weather');
    assert.equal(chip.length, 1, 'only the Glass/Gust Ward holder is chipped; the Kiln foe is immune');
    assert.equal(chip[0].side, 0);
    assert.equal(chip[0].amount, Math.floor(bt.active(0).stats.hp / 16));
    assert.ok(ofType(evs, 'weather-tick').length === 1);
    const stone = fight(mk('stillox', 30, ['settle']), mk('caldermaw', 30, ['settle']), { weather: 'ash' });
    assert.equal(ofType(stone.step([settle, settle]), 'damage').length, 0, 'Stone and Kiln/Stone take no ash chip');
  });

  it('squall: Gust and Bolt x1.2, Kiln x0.8; Gust creatures +1 evasion as it blows in, never past +2', () => {
    const bt = fight(mk('coilcrest', 30, ['settle']), mk('skirl', 30, ['settle']), { weather: 'squall' });
    assert.equal(bt.weatherPowerMult('Gust'), 1.2);
    assert.equal(bt.weatherPowerMult('Bolt'), 1.2);
    assert.equal(bt.weatherPowerMult('Kiln'), 0.8);
    const intro = bt.intro;
    const start = ofType(intro, 'weather-start')[0];
    assert.equal(start.kind, 'squall');
    assert.equal(start.source, 'setup');
    assert.deepEqual(ofType(intro, 'stat').map((e) => [e.side, e.stat, e.stages]), [[0, 'eva', 1], [1, 'eva', 1]]);
    assert.equal(bt.state().sides[1].stages.eva, 1);
    // a new squall after a lull: the grant stops at the +2 cap
    bt.sides[0].vol.stages.eva = 2;
    bt.setWeather('clear');
    const again = bt.setWeather('squall', { turns: 2 });
    assert.equal(bt.state().sides[0].stages.eva, 2);
    assert.ok(ofType(again, 'stat').some((e) => e.side === 0 && e.result === 'capped'));
    assert.equal(bt.state().sides[1].stages.eva, 2);
  });

  it('clear: no effects, but it is still shown and ticks', () => {
    const bt = fight(mk('mothling', 30, ['kiln-maw']), mk('wirewhisk', 30, ['settle']), { weather: 'clear' });
    for (const t of ['Kiln', 'Gust', 'Stone', 'Bolt', 'Rime']) assert.equal(bt.weatherPowerMult(t), 1);
    assert.equal(bt.legal(0).moves[0].hitChance, 1);
    const evs = bt.step([settle, settle]);
    assert.equal(ofType(evs, 'damage').filter((e) => e.source === 'weather').length, 0);
    assert.equal(ofType(evs, 'weather-tick')[0].name, 'Clear');
    assert.equal(bt.state().weather.text, 'Clear: no weather effects.');
  });

  it('status interactions from data: a weather can keep a condition off and clear one at the end of a turn', () => {
    const kinds = [...WEATHER_KINDS, { id: 'fog', name: 'Fog', text: 'Fog: nothing chills; burns wash out.', status: { blocks: ['chill'], cures: ['burn'] } }];
    const me = mk('sootling', 30, ['rime-lock']);
    const foe = mk('wirewhisk', 30, ['settle']);
    me.status = { kind: 'burn', turns: 0 };
    const bt = fight(me, foe, { weather: 'fog', weatherKinds: kinds });
    const evs = bt.step([{ type: 'move', move: 0 }, settle]);
    const blocked = ofType(evs, 'status').find((e) => e.kind === 'chill');
    assert.equal(blocked.action, 'immune');
    assert.match(blocked.text, /fog/);
    assert.equal(foe.status, null);
    assert.ok(ofType(evs, 'status').some((e) => e.kind === 'burn' && e.action === 'cure'));
    assert.equal(me.status, null);
  });
});

// --- sources of weather -----------------------------------------------------------------------------

describe('weather sources: setup, posted cycle, entry, moves', () => {
  it('the Weather Spire cycle runs, posts the next three turns and wraps', () => {
    const bt = fight(mk('caldermaw', 40, ['settle']), mk('stillox', 40, ['settle']), { weatherCycle: WEATHER_RULE });
    const st0 = bt.state().weather;
    assert.equal(st0.kind, 'steam');
    assert.equal(st0.turnsLeft, 3);
    assert.deepEqual(st0.posted.map((p) => [p.turn, p.kind]), [[1, 'steam'], [2, 'steam'], [3, 'steam']]);
    assert.equal(ofType(bt.intro, 'weather-start')[0].source, 'cycle');
    const starts = [];
    const lefts = [];
    for (let i = 0; i < 13; i++) {
      const evs = bt.step([settle, settle]);
      starts.push(...ofType(evs, 'weather-start').map((e) => `${bt.turn}:${e.kind}`));
      lefts.push(bt.state().weather.turnsLeft);
    }
    assert.deepEqual(starts, ['3:ash', '6:squall', '9:clear', '12:steam']);
    assert.deepEqual(lefts, [2, 1, 3, 2, 1, 3, 2, 1, 3, 2, 1, 3, 2]);
    assert.deepEqual(ofType(bt.log, 'weather-end').map((e) => e.kind), ['steam', 'ash', 'squall', 'clear']);
    // after turn 1 the strip crosses the boundary: turns 2-4 are steam, steam, ash
    const b2 = fight(mk('caldermaw', 40, ['settle']), mk('stillox', 40, ['settle']), { weatherCycle: WEATHER_RULE });
    b2.step([settle, settle]);
    assert.deepEqual(b2.state().weather.posted.map((p) => p.kind), ['steam', 'steam', 'ash']);
    assert.equal(ofType(b2.log, 'weather-tick')[0].posted.length, 3);
  });

  it('entry weather (Cass Rune\'s Coilcrest): a 3-turn squall as it enters, again when it comes back', () => {
    const cass = trainerParty(TRAINER_BY_ID['cass-keeper']);
    assert.deepEqual(cass[0].onEntry, { weather: 'squall', turns: 3 });
    const bt = fight(mk('cairnward', 80, ['settle', 'tap']), cass, { trainer: { name: 'Cass Rune' } });
    const start = ofType(bt.intro, 'weather-start')[0];
    assert.deepEqual([start.kind, start.source, start.turnsLeft], ['squall', 'entry', 3]);
    assert.match(start.text, /Coilcrest brings squall in/);
    assert.ok(ofType(bt.intro, 'stat').some((e) => e.side === 1 && e.stat === 'eva' && e.stages === 1), 'Coilcrest is Gust: +1 evasion');
    for (let i = 0; i < 3; i++) bt.step([settle, settle]);
    assert.equal(bt.state().weather.kind, null);
    assert.equal(ofType(bt.log, 'weather-end').length, 1);
    bt.step([settle, { type: 'switch', to: 1 }]);
    bt.step([settle, { type: 'switch', to: 0 }]);
    assert.equal(bt.state().weather.kind, 'squall', 'it brings the squall back each time it enters');
  });

  it('a timed weather over the posted cycle hands back to the cycle when it runs out', () => {
    const bt = fight(mk('caldermaw', 40, ['settle']), mk('coilcrest', 40, ['settle'], { onEntry: { weather: 'squall', turns: 3 } }), { weatherCycle: WEATHER_RULE });
    assert.deepEqual(ofType(bt.intro, 'weather-start').map((e) => e.kind), ['steam', 'squall']);
    assert.deepEqual(ofType(bt.intro, 'weather-end').map((e) => e.kind), ['steam']);
    assert.deepEqual(bt.state().weather.posted.map((p) => p.kind), ['squall', 'squall', 'squall']);
    for (let i = 0; i < 3; i++) bt.step([settle, settle]);
    assert.equal(bt.state().weather.kind, 'ash', 'turn 4 of the cycle is ash');
    assert.equal(bt.state().weather.source, 'cycle');
  });

  it('setup weather: a kind stands; {kind, turns} runs out; bad setups fail at createBattle', () => {
    const stand = fight(mk('caldermaw', 40, ['settle']), mk('stillox', 40, ['settle']), { weather: 'steam' });
    for (let i = 0; i < 6; i++) stand.step([settle, settle]);
    assert.equal(stand.state().weather.kind, 'steam');
    const timed = fight(mk('caldermaw', 40, ['settle']), mk('stillox', 40, ['settle']), { weather: { kind: 'ash', turns: 2 } });
    timed.step([settle, settle]);
    assert.equal(timed.state().weather.turnsLeft, 1);
    const evs = timed.step([settle, settle]);
    assert.equal(ofType(evs, 'weather-end')[0].kind, 'ash');
    assert.equal(timed.state().weather.kind, null);
    const c = () => [mk('caldermaw', 40, ['settle']), mk('stillox', 40, ['settle'])];
    assert.throws(() => fight(...c(), { weather: 'blizzard' }), RangeError);
    assert.throws(() => fight(...c(), { weather: 'steam', weatherCycle: WEATHER_RULE }), RangeError);
    assert.throws(() => fight(...c(), { weatherCycle: { cycle: ['steam', 'hail'], turnsEach: 3 } }), RangeError);
    assert.throws(() => fight(mk('caldermaw', 40, ['settle']), mk('stillox', 40, ['settle'], { onEntry: { weather: 'hail', turns: 3 } })), RangeError);
    assert.throws(() => fight(...c(), { weather: 'steam', data: { ...BATTLE_DATA, weatherKinds: undefined } }), /none injected/);
  });

  it('a move with a weather effect sets it (field move: no Ward or guard stops it); default turns from tuning', () => {
    const bt = fight(mk('skirl', 30, ['test-squall-call', 'settle']), mk('lumenveil', 30, ['settle']));
    const evs = bt.step([{ type: 'move', move: 0 }, settle]);
    const start = ofType(evs, 'weather-start')[0];
    assert.deepEqual([start.kind, start.source, start.turnsLeft], ['squall', 'move', 2]);
    assert.equal(bt.state().weather.turnsLeft, 1, 'set during turn 1, its end-of-turn tick counts');
    bt.step([{ type: 'move', move: 1 }, settle]);
    assert.equal(bt.state().weather.kind, null);
    const dflt = fight(mk('sootling', 30, ['test-steam-call']), mk('stillox', 30, ['settle']), { tuning: { weatherMoveTurns: 4 } });
    dflt.step([{ type: 'move', move: 0 }, settle]);
    assert.equal(dflt.state().weather.turnsLeft, 3);
    assert.equal(DEFAULTS.weatherMoveTurns, 5);
    const hit = fight(mk('stillox', 30, ['test-ash-bite']), mk('wirewhisk', 30, ['settle']));
    hit.step([{ type: 'move', move: 0 }, settle]);
    assert.equal(hit.state().weather.kind, 'ash', 'a damaging move sets its weather after it lands');
  });

  it('setWeather (the flow\'s hook): sets, replaces and clears between turns', () => {
    const bt = fight(mk('caldermaw', 40, ['settle']), mk('stillox', 40, ['settle']));
    assert.equal(bt.state().weather.kind, null);
    assert.deepEqual(ofType(bt.setWeather('steam', { turns: 2 }), 'weather-start').map((e) => e.kind), ['steam']);
    const evs = bt.setWeather(null);
    assert.equal(ofType(evs, 'weather-end')[0].kind, 'steam');
    assert.equal(bt.state().weather.kind, null);
    assert.throws(() => bt.setWeather('hail'), RangeError);
  });
});

// --- held items -------------------------------------------------------------------------------------

describe('held items: the shipped rows', () => {
  it('every held object in data/items.js is valid; Still Knot and the tilts are inert in battle; bag items have none', () => {
    const chart = createBattleData(BATTLE_DATA).chart;
    for (const it of ITEMS) assert.deepEqual(heldProblems(it, chart), [], it.id);
    const view = createBattleData(BATTLE_DATA);
    assert.equal(view.held('still-knot').inert, true);
    assert.equal(view.held('tilt-kiln').inert, true);
    assert.equal(view.held('crackdust'), null, 'Crackdust stays a bag item');
    assert.equal(view.held('salve'), null);
    assert.equal(view.held(null), null);
    assert.throws(() => view.held('no-such-item'), RangeError);
    assert.equal(createBattleData({ ...BATTLE_DATA, items: undefined }).held('whetstone'), null, 'no items table: held items are inert');
  });

  it('Whetstone: +1 crit stage on the holder\'s hits', () => {
    const crits = (held) => {
      const bt = fight(mk('sootling', 30, ['kiln-maw'], { heldItem: held }), mk('wirewhisk', 30, ['settle']), { rng: constRng(0.1) });
      return ofType(bt.step([{ type: 'move', move: 0 }, settle]), 'crit').length;
    };
    assert.equal(crits(null), 0, 'a 0.1 roll misses the 1/16 base rate');
    assert.equal(crits('whetstone'), 1, 'and lands inside 1/8');
  });

  it('Oilskin: burn, poison and trap chip it for half', () => {
    const chip = (held) => {
      const me = mk('hulkwight', 40, ['settle'], { heldItem: held });
      me.status = { kind: 'burn', turns: 0 };
      const bt = fight(me, mk('stillox', 40, ['settle']));
      return ofType(bt.step([settle, settle]), 'damage').find((e) => e.side === 0 && e.source === 'status').amount;
    };
    const full = chip(null);
    assert.equal(chip('oilskin'), Math.max(1, Math.floor(full / 2)));
  });

  it('Ballast Stone: +1 Def, +1 SpD, -1 Spe each time it enters', () => {
    const bt = fight([mk('lumenveil', 43, ['settle'], { heldItem: 'ballast-stone' }), mk('gillwick', 43, ['settle'])], mk('stillox', 40, ['settle']));
    assert.deepEqual(ofType(bt.intro, 'held-item').map((e) => [e.item, e.effect, e.consumed]), [['ballast-stone', 'start-stages', false]]);
    const st = () => bt.state().sides[0].stages;
    assert.deepEqual([st().def, st().spd, st().spe], [1, 1, -1]);
    bt.step([{ type: 'switch', to: 1 }, settle]);
    bt.step([{ type: 'switch', to: 0 }, settle]);
    assert.deepEqual([st().def, st().spd, st().spe], [1, 1, -1]);
  });

  it('Cork Float: once a battle, a knock-out hit from full HP leaves it at 1 HP', () => {
    const me = mk('puddlepip', 5, ['settle'], { heldItem: 'cork-float' });
    const bt = fight(me, mk('caldermaw', 60, ['kiln-maw']));
    const evs = bt.step([settle, settle]);
    assert.equal(me.hp, 1);
    assert.deepEqual(ofType(evs, 'held-item').map((e) => e.effect), ['endure']);
    me.hp = me.stats.hp;
    bt.step([settle, settle]);
    assert.equal(me.hp, 0, 'its one use is spent');
  });

  it('Lucky Button: +50% payout when its holder battled; Tally Charm: full EXP from the bench', () => {
    const win = (held) => {
      const bt = fight([mk('caldermaw', 60, ['kiln-maw'], { heldItem: held }), mk('puddlepip', 10, ['settle'], { heldItem: 'tally-charm' }), mk('rillfin', 10, ['settle'])], mk('mothling', 10, ['settle']), { trainer: { name: 'T', payout: 1000 } });
      bt.step([{ type: 'move', move: 0 }, settle]);
      return bt;
    };
    assert.equal(win(null).result().payout, 1000);
    const bt = win('lucky-button');
    assert.equal(bt.result().payout, 1500);
    const exp = Object.fromEntries(bt.result().exp.map((e) => [e.name, e.amount]));
    assert.equal(exp.Puddlepip, exp.Caldermaw, 'Tally Charm: the bench gets the battler\'s share');
    assert.ok(exp.Rillfin < exp.Puddlepip, 'the plain bench gets 60%');
  });

  it('Still Knot and a tilt change nothing in battle; held Crackdust does nothing', () => {
    const est = (held) => fight(mk('sootling', 30, ['kiln-maw'], { heldItem: held }), mk('wirewhisk', 30, ['settle'])).estimateDamage(0, 0).max;
    assert.equal(est('still-knot'), est(null));
    assert.equal(est('tilt-kiln'), est(null));
    assert.equal(est('crackdust'), est(null));
    const bt = fight(mk('vesperay', 50, ['settle'], { heldItem: 'still-knot' }), mk('stillox', 50, ['settle']));
    bt.step([settle, settle]);
    assert.equal(ofType(bt.log, 'held-item').length, 0);
  });

  it('an item id unknown to the injected table fails at createBattle', () => {
    assert.throws(() => fight(mk('sootling', 30, ['kiln-maw'], { heldItem: 'whetsone' }), mk('wirewhisk', 30, ['settle'])), /did you mean "whetstone"/);
  });
});

describe('held items: generic keys (threshold heals, cures, boosts) and consumption', () => {
  it('a consumable threshold heal fires once under half HP, spends a Mend, is used up and reported', () => {
    const me = mk('stillox', 40, ['settle'], { heldItem: 'test-berry' });
    const bt = fight(me, mk('caldermaw', 40, ['tap']));
    me.hp = Math.ceil(me.stats.hp / 2) + 1;
    const evs = bt.step([settle, settle]);
    const fired = ofType(evs, 'held-item');
    assert.equal(fired.length, 1);
    assert.deepEqual([fired[0].effect, fired[0].consumed], ['heal', true]);
    assert.match(fired[0].text, /used up/);
    assert.equal(ofType(evs, 'mend-spent').length, 1);
    assert.equal(me.mends, DEFAULTS.mendsPerBattle - 1);
    assert.equal(me.heldItem, null, 'marked on the creature');
    assert.deepEqual(bt.result().consumedItems, [{ side: 0, uid: me.uid, item: 'test-berry' }]);
    assert.deepEqual(bt.state().consumedItems, bt.result().consumedItems);
    const again = bt.step([settle, settle]);
    assert.equal(ofType(again, 'held-item').length, 0, 'gone after one use');
  });

  it('a threshold heal waits while the holder has no Mends (and is not used up)', () => {
    const me = mk('stillox', 40, ['settle'], { heldItem: 'test-berry' });
    const bt = fight(me, mk('caldermaw', 40, ['tap']));
    me.hp = Math.ceil(me.stats.hp / 2) + 1;
    me.mends = 0;
    bt.step([settle, settle]);
    assert.ok(me.hp < me.stats.hp / 2);
    assert.equal(me.heldItem, 'test-berry');
    assert.deepEqual(bt.result().consumedItems, []);
  });

  it('a consumable cure clears its condition at the end of the turn', () => {
    const me = mk('stillox', 40, ['settle'], { heldItem: 'test-poultice' });
    me.status = { kind: 'burn', turns: 0 };
    const bt = fight(me, mk('mothling', 40, ['settle']));
    const evs = bt.step([settle, settle]);
    assert.equal(me.status, null);
    assert.deepEqual(ofType(evs, 'held-item').map((e) => [e.effect, e.consumed]), [['cure', true]]);
    assert.deepEqual(bt.result().consumedItems.map((x) => x.item), ['test-poultice']);
  });

  it('typeBoost (onAttackMult), accuracyMult (onHitCheck), statMult (onStatCalc)', () => {
    const base = fight(mk('sootling', 30, ['kiln-maw', 'flashover']), mk('wirewhisk', 30, ['settle']));
    const charm = fight(mk('sootling', 30, ['kiln-maw', 'flashover'], { heldItem: 'test-kiln-charm' }), mk('wirewhisk', 30, ['settle']));
    assert.ok(Math.abs(charm.estimateDamage(0, 0).max / base.estimateDamage(0, 0).max - 1.2) < 0.06);
    const lens = fight(mk('sootling', 30, ['kiln-maw', 'flashover', 'sure-pinch'], { heldItem: 'test-lens' }), mk('wirewhisk', 30, ['settle']));
    assert.equal(lens.legal(0).moves[1].hitChance, Math.min(1, 0.9 * 1.1));
    assert.equal(lens.legal(0).moves[0].hitChance, 1, 'capped at 1');
    const ank = fight(mk('sootling', 30, ['settle'], { heldItem: 'test-anklet' }), mk('wirewhisk', 30, ['settle']));
    const plain = fight(mk('sootling', 30, ['settle']), mk('wirewhisk', 30, ['settle']));
    assert.equal(ank.effStat(0, 'spe'), Math.floor(plain.active(0).stats.spe * 1.5));
  });

  it('getHeldRuntime / heldProblems: unknown keys and bad values are refused', () => {
    assert.equal(getHeldRuntime({ id: 'salve', name: 'Salve' }), null);
    assert.ok(heldProblems({ id: 'x', held: { glow: 1 } }).some((p) => /unknown held key "glow"/.test(p)));
    assert.ok(heldProblems({ id: 'x', held: { healAt: { below: 2, fraction: 0.2 } } }).length > 0);
    assert.throws(() => getHeldRuntime({ id: 'x', held: { critStages: -1 } }), TypeError);
    assert.ok(HELD_KEYS.includes('blocksShift') && HELD_KEYS.includes('forecastTypeMult'));
  });
});

// --- the AI -----------------------------------------------------------------------------------------

describe('AI awareness of the weather', () => {
  // Mothling (Glass) has none of the three move types, Wirewhisk (Bolt) is neutral to all three.
  const pick = (moves, weather) => {
    const bt = fight(mk('wirewhisk', 50, ['settle']), mk('mothling', 20, moves), { weather });
    const a = chooseAction(bt, 1, { profile: 'spire' });
    return bt.active(1).moves[a.move].id;
  };

  it('prefers a move the weather boosts', () => {
    const moves = ['test-plain', 'test-kiln', 'test-gust'];
    assert.equal(pick(moves, undefined), 'test-plain', 'clear: Plain 90 is the best hit');
    assert.equal(pick(moves, 'squall'), 'test-gust', 'squall: Gust 80 x1.2 = 96');
    assert.equal(pick(moves, 'steam'), 'test-kiln', 'steam: Kiln 85 x1.2 = 102');
  });

  it('avoids a move the weather weakens', () => {
    const moves = ['test-kiln-big', 'test-plain'];
    assert.equal(pick(moves, undefined), 'test-kiln-big', 'clear: Kiln 95 beats Plain 90');
    assert.equal(pick(moves, 'squall'), 'test-plain', 'squall: Kiln 95 x0.8 = 76');
    assert.equal(pick(moves, 'ash'), 'test-kiln-big', 'ash does not touch Kiln');
  });

  it('replacements are scored under the weather too', () => {
    const bt = fight(mk('wirewhisk', 50, ['settle']), [mk('mothling', 20, ['test-plain']), mk('mothling', 20, ['test-plain']), mk('mothling', 20, ['test-gust'])], { weather: 'squall' });
    bt.active(1).hp = 0;
    assert.equal(chooseReplacement(bt, 1).to, 2, 'Gust 80 x1.2 outscores Plain 90 in a squall');
  });
});

// --- Read card and dossier --------------------------------------------------------------------------

describe('the Read card and the dossier post the weather', () => {
  it('the Weather Spire: the card shows the opening three turns on every dial; the dossier the whole cycle', () => {
    const tr = TRAINER_BY_ID['ines-spire'];
    const party = trainerParty(tr);
    for (const dial of ['drift', 'flux', 'freefall']) {
      const card = readCard({ party, name: tr.name, items: tr.items }, dial, BATTLE_DATA, { read: new Set() }, { weatherCycle: WEATHER_RULE });
      assert.deepEqual(card.weather.posted.map((p) => [p.turn, p.name]), [[1, 'Steam'], [2, 'Steam'], [3, 'Steam']], dial);
    }
    const d = dossier({ name: tr.name, party, items: tr.items, tacticTag: tr.tacticTag }, BATTLE_DATA, { weatherCycle: WEATHER_RULE });
    assert.equal(d.weather.cycle, 'Turns 1-3 Steam, 4-6 Ash, 7-9 Squall, 10-12 Clear, then repeat.');
    assert.equal(d.weather.posted.length, 12);
    assert.deepEqual(d.weather.kinds.map((k) => k.id), ['steam', 'ash', 'squall', 'clear']);
    assert.ok(d.weather.kinds.every((k) => k.text.length > 0));
  });

  it('weather setters and held items appear in the dossier; no weather means null', () => {
    const tr = TRAINER_BY_ID['cass-keeper'];
    const d = dossier({ name: tr.name, party: trainerParty(tr), items: tr.items }, BATTLE_DATA);
    assert.equal(d.weather.cycle, null);
    assert.deepEqual(d.weather.setters.map((x) => [x.name, x.weather, x.turns]), [['Coilcrest', 'squall', 3]]);
    assert.equal(d.roster.find((r) => r.speciesId === 'skeinwing').held, 'whetstone');
    const plain = dossier({ name: 'Maud', party: trainerParty(TRAINER_BY_ID['maud-spire']) }, BATTLE_DATA);
    assert.equal(plain.weather, null);
  });
});

// --- validator --------------------------------------------------------------------------------------

describe('tools/validate-data: weather and held-item rules', () => {
  const opts = { heldKeys: HELD_KEYS, weatherKinds: WEATHER_KINDS, spires: SPIRES, effectKeys: undefined };
  const base = { ...DATA, types: TYPES, abilities: ABILITIES, species: SPECIES, families: FAMILIES, moves: MOVES, trainers: TRAINERS, items: ITEMS };
  const rel = (errors) => errors.filter((e) => /held|weather|onEntry/.test(e));

  it('the shipped items, trainers, moves and Spires pass', () => {
    const { errors } = validateData(base, opts);
    assert.deepEqual(rel(errors), []);
  });

  it('a bad held key, a bag item held, a bad entry weather, a bad move weather and a bad Spire cycle are errors', () => {
    const bad = {
      ...base,
      items: [...ITEMS, { id: 'glow-charm', name: 'Glow Charm', pocket: 'held', kind: 'held', price: 1, sell: 0, stack: 1, use: 'hold', held: { glow: 2 }, oneOfAKind: false }],
      trainers: [...TRAINERS.filter((t) => t.id !== 'cass-keeper'), { ...TRAINER_BY_ID['cass-keeper'], party: [{ ...TRAINER_BY_ID['cass-keeper'].party[0], onEntry: { weather: 'hail', turns: 3 }, held: 'crackdust' }] }],
      moves: [...MOVES, { ...TEST_MOVES[4], effect: { weather: 'hail' } }],
    };
    const spires = SPIRES.map((s) => (s.id === 'weather' ? { ...s, theme: { ...s.theme, rule: { ...s.theme.rule, cycle: ['steam', 'monsoon'] } } } : s));
    const { errors } = validateData(bad, { ...opts, spires });
    const r = rel(errors).join('\n');
    assert.match(r, /items:glow-charm: held key 'glow'/);
    assert.match(r, /cass-keeper: party 'coilcrest' holds 'crackdust'/);
    assert.match(r, /onEntry weather 'hail' is not in WEATHER_KINDS/);
    assert.match(r, /moves:test-squall-call: effect.weather 'hail'/);
    assert.match(r, /spires:weather: weather cycle kind 'monsoon'/);
  });
});

// --- the event contract over real fights --------------------------------------------------------------

describe('event contract and the balance harness', () => {
  it('Weather Spire, Mirror Spire and Summit fights: every event matches events.js; weather and held items fire', () => {
    const violations = [];
    const seen = new Set();
    const play = (key, trainerId, cycle, st, i) => {
      const party = buildParty(key, st);
      const tr = TRAINER_BY_ID[trainerId];
      const r = playBattle(party, trainerParty(tr), { rng: makeRng(`contract:${trainerId}:${st}:${i}`), trainer: tr, source: 'spire', summit: key === 'summit', items: itemRows(key, party), crackdust: PARTIES[key].crackdust, weatherCycle: cycle });
      for (const ev of r.events) {
        seen.add(ev.type === 'held-item' ? `held:${ev.item}` : ev.type);
        for (const p of checkEvent(ev)) violations.push(`${trainerId}: ${p}`);
      }
    };
    for (const st of ['sloshkin', 'scrapling', 'reedkit']) {
      for (let i = 0; i < 4; i++) {
        play('weather', 'ines-spire', WEATHER_RULE, st, i);
        play('mirror', 'seraphine-spire', null, st, i);
        for (const step of SUMMIT.order) play('summit', step.trainer, null, st, i);
      }
    }
    assert.deepEqual(violations.slice(0, 10), []);
    for (const t of ['weather-start', 'weather-tick', 'weather-end', 'held:ballast-stone']) assert.ok(seen.has(t), `${t} never seen`);
    assert.ok(seen.has('damage'));
  });

  it('the harness passes real weather and held items: trainer entries carry held and onEntry', () => {
    const idris = trainerParty(TRAINER_BY_ID['idris-champion']);
    assert.equal(idris.find((c) => c.speciesId === 'vesperay').heldItem, 'still-knot');
    assert.deepEqual(idris.find((c) => c.speciesId === 'strandrunner').onEntry, { weather: 'squall', turns: 3 });
    assert.equal(trainerParty(TRAINER_BY_ID['wendel-spire']).find((c) => c.speciesId === 'hulkwight').heldItem, 'oilskin');
    assert.ok(BATTLE_DATA.items === ITEMS && BATTLE_DATA.weatherKinds === WEATHER_KINDS);
  });

  it('BattleError still guards the turn API while weather and held items are active', () => {
    const bt = fight(mk('sootling', 30, ['kiln-maw'], { heldItem: 'whetstone' }), mk('wirewhisk', 30, ['settle']), { weather: 'steam' });
    assert.throws(() => bt.step([{ type: 'move', move: 3 }, settle]), (e) => e instanceof BattleError && e.code === 'BAD_MOVE');
  });
});
