// Unit tests for js/systems/weather.js. Run: node --test test/systems.weather.test.mjs
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as weather from '../js/systems/weather.js';
import * as clockSys from '../js/systems/clockSys.js';
import { makeRng } from '../js/core/rng.js';
import { createClock, MINUTES_PER_DAY } from '../js/core/time.js';
import { createBus } from '../js/core/events.js';
import { createNewWorld, validateWorld } from '../js/state/schema.js';
import { createStore } from '../js/state/store.js';
import { createRngs } from '../js/state/rngs.js';
import { createRegistry } from '../js/data/registry.js';
import { DATA } from '../js/data/index.js';

const HM = (h, m = 0) => h * 60 + m;
const SEED = 'FLUX-WTHR-0001';
/** A world whose clock sits at game day `day`, minute `m`. */
function worldAt(day, m, seedCode = SEED) {
  const w = createNewWorld({ seedCode });
  w.clock.total = (day - 1) * MINUTES_PER_DAY + m;
  return w;
}
const master = (w) => makeRng(w.run.seed);
function recorder() {
  const bus = createBus();
  const seen = [];
  bus.on('weather:change', (p) => seen.push(p));
  return { bus, seen };
}

describe('tuning and kinds', () => {
  test('DEFAULTS: GDD kinds, the 35% overlay cap, honest odds below certainty', () => {
    const d = weather.DEFAULTS;
    assert.deepEqual(Object.keys(d.WEATHER_WEIGHTS), ['clear', 'overcast', 'rain', 'fog', 'storm', 'snow']);
    assert.equal(d.WEATHER_WEIGHTS.snow, 0, 'no snow without seasons');
    assert.equal(d.WEATHER_USE_SEASONS, false, 'GDD-00 has one season');
    assert.equal(d.WEATHER_OVERLAY_CAP, 0.35);
    assert.ok(d.WEATHER_ODDS_WEIGHTS.every(([o]) => o >= 1 && o <= 9));
    assert.deepEqual([...weather.TUNING_KEYS].sort(), Object.keys(d).sort());
    assert.ok(Object.isFrozen(d.WEATHER_EFFECTS.rain[0]));
    assert.deepEqual(weather.DEFAULT_KINDS.map((k) => k.id), ['clear', 'overcast', 'rain', 'fog', 'storm', 'snow']);
    // GDD-00 §9: fog pulls silver schools in, rain brings bugs, storms put Errant lightning on the sea
    assert.ok(d.WEATHER_EFFECTS.fog.some((e) => e.target === 'fish' && e.tag === 'silver' && e.mult > 1));
    assert.ok(d.WEATHER_EFFECTS.rain.some((e) => e.target === 'bug' && e.mult > 1));
    assert.ok(d.WEATHER_EFFECTS.storm.some((e) => e.target === 'errant' && e.mult > 1));
    assert.ok(weather.DEFAULT_KINDS.find((k) => k.id === 'storm').branches.includes('errant-lightning'));
  });

  test('tuningOf accepts the usual data shapes and rejects malformed values', () => {
    assert.equal(weather.tuningOf(null), weather.DEFAULTS);
    assert.deepEqual(weather.tuningOf(createRegistry(DATA)), weather.DEFAULTS);
    const t = weather.tuningOf({ tuning: { WEATHER_OVERLAY_CAP: 0.2 } });
    assert.equal(t.WEATHER_OVERLAY_CAP, 0.2);
    assert.equal(weather.tuningOf(t), t);
    const bad = [
      { WEATHER_WEIGHTS: { clear: 0 } }, { WEATHER_WEIGHTS: { Clear: 1 } }, { WEATHER_USE_SEASONS: 1 },
      { WEATHER_DAYS_PER_SEASON: 0 }, { WEATHER_SEASON_WEIGHTS: { monsoon: {} } }, { WEATHER_ODDS_WEIGHTS: [[11, 1]] },
      { WEATHER_ODDS_WEIGHTS: [[5, 0]] }, { WEATHER_ONSET_LEAD: [10, 5] }, { WEATHER_INTENSITY: { rain: [0, 2] } },
      { WEATHER_EFFECTS: { rain: [{ target: 'weather', tag: 'x', mult: 1 }] } }, { WEATHER_OVERLAY_CAP: 2 },
      { WEATHER_FIXED: { 0: 'clear' } }, { WEATHER_FIXED: { 1: 'Clear' } },
    ];
    for (const b of bad) assert.throws(() => weather.tuningOf(b), new RegExp(Object.keys(b)[0]));
  });

  test('kinds merges data rows over the defaults and validates them', () => {
    assert.equal(weather.kinds(null).get('rain').phrase, 'showers');
    const data = { weather: [{ id: 'rain', phrase: 'a soaking' }, { id: 'haar', name: 'Haar', lead: 'fog', particles: 'mist' }] };
    const k = weather.kinds(data);
    assert.equal(k.get('rain').phrase, 'a soaking');
    assert.equal(k.get('rain').lead, 'overcast', 'unspecified fields keep the default');
    assert.equal(k.get('haar').prep, 'by');
    assert.equal(weather.kinds(data), k, 'cached');
    assert.equal(weather.kinds(createRegistry(DATA)).size, weather.DEFAULT_KINDS.length);
    assert.throws(() => weather.kinds({ weather: [{ id: 'Bad' }] }), TypeError);
    assert.throws(() => weather.kinds({ weather: [{ id: 'x', lead: 'nope' }] }), /unknown lead/);
    assert.throws(() => weather.kinds({ weather: [{ id: 'x', prep: 'until' }] }), /prep/);
    assert.throws(() => weather.kinds({ weather: [{ id: 'x', seasons: ['monsoon'] }] }), /seasons/);
    assert.throws(() => weather.kinds({ weather: [{ id: 'x', stems: 'rain' }] }), /arrays/);
  });
});

describe('planDay', () => {
  test('deterministic per seed and day, whatever the rng source', () => {
    const w = worldAt(3, HM(8));
    const store = createStore(w);
    const rngs = createRngs(store);
    const a = weather.planDay(5, null, master(w));
    const b = weather.planDay(5, null, rngs);
    const c = weather.planDay(5, null, (label) => makeRng(w.run.seed).fork(label));
    assert.deepEqual(a, b);
    assert.deepEqual(a, c);
    assert.deepEqual(weather.planDay(5, null, master(w)), a, 'repeatable');
    const other = createNewWorld({ seedCode: 'DRIFT-OTHR-0002' });
    const days = Array.from({ length: 20 }, (_, i) => i + 2);
    const mine = days.map((d) => JSON.stringify(weather.planDay(d, null, master(w))));
    const theirs = days.map((d) => JSON.stringify(weather.planDay(d, null, master(other))));
    assert.notDeepEqual(mine, theirs, 'two seeds diverge');
    assert.throws(() => weather.planDay(0, null, master(w)), TypeError);
    assert.throws(() => weather.planDay(2, null, {}), /rng must be/);
  });

  test('plans are well-formed: kinds, odds, tide-named forecasts, onset before the named tide', () => {
    const w = worldAt(1, 0);
    for (let d = 2; d <= 200; d++) {
      const p = weather.planDay(d, null, master(w));
      assert.ok(['clear', 'overcast', 'rain', 'fog', 'storm'].includes(p.kind), p.kind);
      assert.ok(p.forecast.odds >= 5 && p.forecast.odds <= 9);
      const tide = clockSys.tidesForDay(d).find((x) => Math.round(x.minute) === p.forecast.minute || Math.min(1439, Math.round(x.minute)) === p.forecast.minute);
      assert.ok(tide, `day ${d}: the forecast names one of the day's tides`);
      assert.equal(p.forecast.tide, tide.kind);
      assert.equal(p.forecast.part, clockSys.dayPartAt(p.forecast.minute).tideWord);
      assert.ok(p.intensity >= 0 && p.intensity <= 1);
      const [lo, hi] = weather.DEFAULTS.WEATHER_INTENSITY[p.kind];
      assert.ok(p.intensity >= lo - 1e-9 && p.intensity <= hi + 1e-9);
      if (p.lead === p.kind) assert.equal(p.onset, 0);
      else {
        assert.ok(p.onset <= p.forecast.minute && p.onset >= p.forecast.minute - 120, `day ${d}: onset ${p.onset} vs tide ${p.forecast.minute}`);
        assert.equal(p.lead, weather.kinds().get(p.kind).lead);
      }
      assert.equal(p.cameTrue, p.kind === p.forecast.kind);
      assert.ok(Number.isInteger(p.onset) && p.onset >= 0 && p.onset < 1440);
    }
  });

  test('the odds are honest: a posted "o in 10" comes true about o times in 10', () => {
    const w = worldAt(1, 0, 'FLUX-CALI-BRAT');
    const tally = new Map();
    const N = 6000;
    for (let d = 2; d < 2 + N; d++) {
      const p = weather.planDay(d, null, master(w));
      const row = tally.get(p.forecast.odds) ?? { n: 0, right: 0 };
      row.n++;
      if (p.cameTrue) row.right++;
      tally.set(p.forecast.odds, row);
    }
    for (const [odds, { n, right }] of tally) {
      const rate = right / n;
      const sd = Math.sqrt((odds / 10) * (1 - odds / 10) / n);
      assert.ok(Math.abs(rate - odds / 10) < 4 * sd + 0.005, `${odds} in 10: right ${right}/${n} = ${rate.toFixed(3)}`);
      assert.ok(right < n, `${odds} in 10 is sometimes wrong`);
    }
    assert.equal(tally.size, 5, 'every posted odds value occurs');
  });

  test('climate roughly follows WEATHER_WEIGHTS; zero-weight kinds never happen', () => {
    const w = worldAt(1, 0);
    const counts = {};
    for (let d = 2; d < 3002; d++) {
      const k = weather.planDay(d, null, master(w)).kind;
      counts[k] = (counts[k] ?? 0) + 1;
    }
    assert.equal(counts.snow, undefined);
    assert.ok(counts.clear > counts.storm, JSON.stringify(counts));
    assert.ok(counts.storm > 50, JSON.stringify(counts));
  });

  test('day 1 is fixed clear (the arrival) and posted with certainty', () => {
    const w = worldAt(1, 0);
    const p = weather.planDay(1, null, master(w));
    assert.equal(p.kind, 'clear');
    assert.equal(p.fixed, true);
    assert.equal(p.forecast.kind, 'clear');
    assert.equal(p.forecast.odds, 10);
    assert.equal(p.onset, 0);
    assert.equal(weather.planDay(1, { WEATHER_FIXED: {} }, master(w)).fixed, false);
    assert.throws(() => weather.planDay(3, { WEATHER_FIXED: { 3: 'hail' } }, master(w)), /unknown kind/);
  });

  test('a pin forces the kind at 10 in 10 without moving the stream', () => {
    const w = worldAt(1, 0);
    const free = weather.planDay(9, null, master(w));
    const pinned = weather.planDay(9, null, master(w), { pin: 'fog' });
    assert.equal(pinned.kind, 'fog');
    assert.equal(pinned.forecast.odds, 10);
    assert.equal(pinned.forecast.minute, free.forecast.minute, 'same named tide');
  });

  test('a single possible kind posts 10 in 10', () => {
    const w = worldAt(1, 0);
    const p = weather.planDay(4, { WEATHER_WEIGHTS: { rain: 1 } }, master(w));
    assert.equal(p.kind, 'rain');
    assert.equal(p.forecast.odds, 10);
    assert.equal(p.cameTrue, true);
  });

  test('seasons on: snow only in winter; seasons off: never', () => {
    const w = worldAt(1, 0);
    const data = { WEATHER_USE_SEASONS: true, WEATHER_DAYS_PER_SEASON: 7 };
    let winterSnow = 0;
    for (let d = 1; d <= 280; d++) {
      const p = weather.planDay(d, { ...data, WEATHER_FIXED: {} }, master(w));
      const season = Math.floor(((d - 1) % 28) / 7); // 0 spring .. 3 winter
      if (p.kind === 'snow') {
        assert.equal(season, 3, `snow on day ${d} outside winter`);
        winterSnow++;
      }
    }
    assert.ok(winterSnow > 5, `winter snow days: ${winterSnow}`);
    assert.throws(() => weather.planDay(2, { WEATHER_WEIGHTS: { snow: 5 } }, master(w)), /no kind can occur/);
  });
});

describe('rollDay / update', () => {
  test('rollDay writes today and tomorrow’s posted outlook, valid against the schema', () => {
    const w = worldAt(4, HM(6));
    const { today, tomorrow } = weather.rollDay(w, null, master(w));
    assert.equal(w.weather.day, 4);
    assert.equal(w.weather.today, today.kind);
    assert.equal(w.weather.lead, today.lead);
    assert.equal(w.weather.onset, today.onset);
    assert.equal(w.weather.intensity, today.intensity);
    assert.deepEqual(w.weather.forecast, today.forecast);
    assert.deepEqual(w.weather.outlook, tomorrow.forecast);
    assert.equal(w.weather.tomorrow, tomorrow.forecast.kind, 'tomorrow is what the board says, not the truth');
    assert.equal(w.weather.current, HM(6) >= today.onset ? today.kind : today.lead);
    assert.deepEqual(validateWorld(w), []);
    // tomorrow, rolled for real, matches yesterday's outlook
    const w2 = worldAt(5, HM(6));
    weather.rollDay(w2, null, master(w2));
    assert.deepEqual(w2.weather.forecast, w.weather.outlook);
    assert.equal(w2.weather.today, tomorrow.kind);
  });

  test('rollDay for a day other than today starts at the lead', () => {
    const w = worldAt(4, HM(23));
    weather.rollDay(w, null, master(w), { day: 6 });
    assert.equal(w.weather.day, 6);
    assert.equal(w.weather.current, w.weather.lead);
  });

  test('update rolls a new day once, then switches lead -> kind at the onset with weather:change', () => {
    // find a day whose kind has a lead
    const w = worldAt(1, 0);
    let day = 2;
    while (weather.planDay(day, null, master(w)).lead === weather.planDay(day, null, master(w)).kind) day++;
    const plan = weather.planDay(day, null, master(w));
    w.clock.total = (day - 1) * MINUTES_PER_DAY;
    const { bus, seen } = recorder();
    const r1 = weather.update(w, null, master(w), { bus });
    assert.equal(r1.rolled, true);
    assert.equal(w.weather.current, plan.lead);
    const r2 = weather.update(w, null, master(w), { bus });
    assert.deepEqual(r2, { rolled: false, changed: false, current: plan.lead });
    w.clock.total = (day - 1) * MINUTES_PER_DAY + plan.onset - 1;
    assert.equal(weather.update(w, null, master(w), { bus }).changed, false);
    seen.length = 0;
    w.clock.total += 1;
    const r3 = weather.update(w, null, master(w), { bus });
    assert.deepEqual(r3, { rolled: false, changed: true, current: plan.kind });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].kind, plan.kind);
    assert.equal(seen[0].previous, plan.lead);
    assert.equal(seen[0].day, day);
    assert.deepEqual(validateWorld(w), []);
  });

  test('update after a migrated v1 save (day 0) rolls today', () => {
    const w = worldAt(9, HM(12));
    assert.equal(w.weather.day, 0);
    const r = weather.update(w, null, master(w));
    assert.equal(r.rolled, true);
    assert.equal(w.weather.day, 9);
  });

  test('works through a strict store and the rngs registry; same seed = same weather', () => {
    const run = () => {
      const w = worldAt(2, HM(5));
      const store = createStore(w, { strict: true });
      const rngs = createRngs(store);
      const out = [];
      for (let d = 2; d <= 12; d++) {
        store.tx('weather', (ww) => { ww.clock.total = (d - 1) * MINUTES_PER_DAY + HM(14); });
        store.tx('weather', (ww) => weather.update(ww, null, rngs));
        out.push(JSON.stringify(store.world.weather));
      }
      return out;
    };
    assert.deepEqual(run(), run());
  });

  test('the clock and the weather together: a Sleep rolls the next day on update', () => {
    const w = createNewWorld({ seedCode: SEED });
    const clock = createClock(clockSys.optionsFrom(w));
    clockSys.restoreFrom(w, clock);
    clock.restore({ ...clock.serialize(), total: 2 * MINUTES_PER_DAY + HM(22) });
    clockSys.serializeInto(w, clock);
    weather.update(w, null, master(w));
    assert.equal(w.weather.day, 3);
    const outlook = w.weather.outlook;
    clockSys.rest(w, clock, 'sleep');
    const r = weather.update(w, null, master(w));
    assert.equal(r.rolled, true);
    assert.equal(w.weather.day, 4);
    assert.deepEqual(w.weather.forecast, outlook, 'this morning’s board is last night’s outlook');
  });
});

describe('pinDay (Wren sets tomorrow’s weather)', () => {
  test('pins tomorrow, updates the outlook now, and tomorrow turns out that way', () => {
    const w = worldAt(1, HM(18));
    weather.rollDay(w, null, master(w));
    const res = weather.pinDay(w, null, 'rain');
    assert.deepEqual(res, { day: 2, kind: 'rain' });
    assert.equal(w.weather.tomorrow, 'rain');
    assert.equal(w.weather.outlook.kind, 'rain');
    assert.equal(w.weather.outlook.odds, 10);
    assert.deepEqual(w.weather.pinned, { day: 2, kind: 'rain' });
    assert.deepEqual(validateWorld(w), []);
    w.clock.total = MINUTES_PER_DAY + HM(6);
    weather.update(w, null, master(w));
    assert.equal(w.weather.today, 'rain');
    assert.equal(w.weather.forecast.odds, 10);
    assert.deepEqual(w.weather.pinned, { day: 2, kind: 'rain' }, 'kept through its day');
    w.clock.total = 2 * MINUTES_PER_DAY + HM(6);
    weather.update(w, null, master(w));
    assert.equal(w.weather.pinned, null, 'cleared once the day has passed');
  });

  test('a pin further ahead is honoured when its day becomes tomorrow', () => {
    const w = worldAt(3, HM(9));
    weather.rollDay(w, null, master(w));
    weather.pinDay(w, null, 'fog', { day: 5 });
    assert.notEqual(w.weather.outlook.odds === 10 && w.weather.outlook.kind === 'fog', true);
    w.clock.total = 3 * MINUTES_PER_DAY + HM(9);
    weather.update(w, null, master(w));
    assert.equal(w.weather.outlook.kind, 'fog');
    assert.equal(w.weather.outlook.odds, 10);
  });

  test('rejects unknown kinds and days that are not in the future', () => {
    const w = worldAt(3, HM(9));
    weather.rollDay(w, null, master(w));
    assert.throws(() => weather.pinDay(w, null, 'hail'), RangeError);
    assert.throws(() => weather.pinDay(w, null, 'rain', { day: 3 }), RangeError);
    assert.throws(() => weather.pinDay(w, null, 'rain', { day: 2.5 }), RangeError);
  });
});

describe('reads', () => {
  /** A world with a hand-set weather state. */
  function withWeather(kind, extra = {}) {
    const w = worldAt(5, HM(14));
    w.weather = { day: 5, today: kind, lead: kind, current: kind, onset: 0, tomorrow: 'clear', intensity: 0.8, forecast: null, outlook: null, pinned: null, ...extra };
    return w;
  }

  test('current: kind, row, intensity, overlay capped at 35%, night flag, effects, branches', () => {
    const w = withWeather('storm');
    const c = weather.current(w);
    assert.equal(c.kind, 'storm');
    assert.equal(c.row.particles, 'rain');
    assert.equal(c.intensity, 0.8);
    assert.equal(c.overlay, 0.28);
    assert.ok(weather.current(withWeather('storm', { intensity: 1 })).overlay <= 0.35);
    assert.equal(c.night, false);
    assert.ok(c.branches.includes('errant-lightning'));
    c.effects[0].mult = 99;
    assert.notEqual(weather.effects(w)[0].mult, 99, 'callers get copies');
    w.clock.total = 4 * MINUTES_PER_DAY + HM(22);
    assert.equal(weather.current(w).night, true);
  });

  test('current before the onset is the lead at zero intensity', () => {
    const w = withWeather('rain', { lead: 'overcast', current: 'overcast', onset: HM(15) });
    const c = weather.current(w);
    assert.equal(c.kind, 'overcast');
    assert.equal(c.intensity, 0);
    w.clock.total = 4 * MINUTES_PER_DAY + HM(15);
    assert.equal(weather.current(w).kind, 'rain');
    assert.equal(weather.current(w).intensity, 0.8);
  });

  test('current on a fresh world is clear', () => {
    const w = createNewWorld({ seedCode: SEED });
    assert.equal(weather.current(w).kind, 'clear');
    assert.equal(weather.current({ clock: { total: 0 }, weather: null }).kind, 'clear');
  });

  test('multiplierFor: fog pulls silver fish, rain brings every bug, storms raise Errant lightning', () => {
    assert.equal(weather.multiplierFor(withWeather('fog'), null, 'fish', 'silver'), 2);
    assert.equal(weather.multiplierFor(withWeather('fog'), null, 'fish', 'cod'), 1);
    assert.equal(weather.multiplierFor(withWeather('rain'), null, 'bug', 'moth'), 1.5, "'*' rows match every tag");
    assert.equal(weather.multiplierFor(withWeather('rain'), null, 'bug'), 1.5);
    assert.equal(weather.multiplierFor(withWeather('storm'), null, 'errant', 'lightning'), 2);
    assert.equal(weather.multiplierFor(withWeather('storm'), null, 'find', 'shore'), 2);
    assert.equal(weather.multiplierFor(withWeather('clear'), null, 'encounter', 'brine'), 1);
    const data = { WEATHER_EFFECTS: { rain: [{ target: 'bug', tag: '*', mult: 2 }, { target: 'bug', tag: 'moth', mult: 1.5 }] } };
    assert.equal(weather.multiplierFor(withWeather('rain'), data, 'bug', 'moth'), 3, 'rows multiply');
    assert.throws(() => weather.multiplierFor(withWeather('rain'), null, 'tide'), RangeError);
  });

  test('hasBranch reads the kind row tags', () => {
    assert.equal(weather.hasBranch(withWeather('storm'), null, 'weather:storm'), true);
    assert.equal(weather.hasBranch(withWeather('rain'), null, 'weather:wet'), true);
    assert.equal(weather.hasBranch(withWeather('clear'), null, 'weather:wet'), false);
  });

  test('forecastText reads like Augusta', () => {
    assert.equal(weather.forecastText({ kind: 'rain', odds: 7, minute: 930, tide: 'low', part: 'afternoon' }), '7 in 10, showers by the afternoon tide');
    assert.equal(weather.forecastText({ kind: 'clear', odds: 6, minute: 1200, tide: 'high', part: 'evening' }), '6 in 10, clear skies through the evening tide');
    assert.equal(weather.forecastText({ kind: 'haar', odds: 5, minute: 60, tide: 'low', part: 'night' }), '5 in 10, haar by the night tide');
    assert.equal(weather.forecastText(null), '');
    assert.equal(weather.forecastTime({ kind: 'rain', odds: 7, minute: 930, tide: 'low', part: 'afternoon' }), '15:30');
    assert.equal(weather.forecastTime(null), '');
    const w = worldAt(6, HM(7));
    weather.rollDay(w, null, master(w));
    assert.match(weather.forecastText(w.weather.forecast), /^\d+ in 10, .+ (by|through) the (dawn|morning|midday|afternoon|evening|night) tide$/);
  });
});
