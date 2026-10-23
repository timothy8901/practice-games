// Unit tests for js/world/lighting.js. Run: node --test test/world.lighting.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  gradeFor, gradeSlot, gradeHex, dayPartAt, lampsLit, shadowFor, lightSources,
  GRADE_STEP_MINUTES, GRADES_PER_DAY, INDOOR_GRADE, NIGHT_INK, LAMP_ON, BIO_ON, WEATHERS, DAY_PARTS,
} from '../js/world/lighting.js';
import { loadMap } from '../js/world/tilemap.js';
import { createNewWorld } from '../js/state/schema.js';
import { tideState } from '../js/state/selectors.js';
import { MINUTES_PER_DAY } from '../js/core/time.js';
import { TILES, DEFAULT_LEGEND } from './fixtures/world/tiles.fixture.js';
import harborDef from './fixtures/world/harbor.fixture.js';
import cottageDef from './fixtures/world/cottage.fixture.js';

const harbor = loadMap(harborDef, TILES, { legend: DEFAULT_LEGEND });
const cottage = loadMap(cottageDef, TILES, { legend: DEFAULT_LEGEND });
const world = (over = {}) => {
  const w = createNewWorld({ seedCode: 'LIGHT-TEST', lease: { mapId: 'harbor' } });
  Object.assign(w.flags, over.flags || {});
  if (over.minute !== undefined) w.clock.total = over.minute;
  if (over.weather) w.weather.today = over.weather;
  return w;
};
const minuteWithTide = (w, state) => {
  for (let m = 0; m < 2000; m += 5) if (tideState(w, m) === state) return m;
  throw new Error('no such tide');
};

describe('gradeFor', () => {
  it('gives 48 quantized, frozen, cached grades per day for every hour and half hour', () => {
    assert.equal(GRADE_STEP_MINUTES, 30);
    assert.equal(GRADES_PER_DAY, 48);
    const ids = new Set();
    for (let m = 0; m < MINUTES_PER_DAY; m++) {
      const g = gradeFor(m);
      assert.ok(Object.isFrozen(g) && Object.isFrozen(g.mult) && Object.isFrozen(g.floor));
      assert.equal(g.slot, Math.floor(m / 30));
      assert.equal(g.id, `${g.slot}|clear`);
      assert.equal(g.minute, g.slot * 30);
      assert.equal(g.weather, 'clear');
      assert.equal(g.indoor, false);
      assert.equal(g, gradeFor(m), 'cached: same object');
      for (const k of ['sat', 'lamp', 'night']) assert.ok(Number.isFinite(g[k]), k);
      assert.ok(g.lamp >= 0 && g.lamp <= 1 && g.night >= 0 && g.night <= 1);
      assert.equal(g.mult.length, 3);
      assert.equal(g.floor.length, 3);
      ids.add(g.id);
    }
    assert.equal(ids.size, 48);
    assert.equal(gradeFor(0), gradeFor(MINUTES_PER_DAY), 'wraps');
    assert.equal(gradeFor(-30), gradeFor(MINUTES_PER_DAY - 30), 'negative minutes wrap');
    assert.equal(gradeFor(12 * 60 + 7.5), gradeFor(12 * 60), 'fractional minutes quantize');
    assert.equal(gradeSlot(1439.9), 47);
    assert.throws(() => gradeFor(NaN), TypeError);
    assert.throws(() => gradeFor(undefined), TypeError);
  });

  it('follows the day-part table: full daylight at noon, ink-blue night, warm dawn and sunset', () => {
    const noon = gradeFor(12 * 60);
    assert.deepEqual([...noon.mult], [1, 1, 1]);
    assert.deepEqual([...noon.floor], [0, 0, 0]);
    assert.equal(noon.sat, 1);
    assert.equal(noon.lamp, 0);
    assert.equal(noon.night, 0);
    const midnight = gradeFor(0);
    assert.ok(midnight.mult[2] > midnight.mult[0], 'night is blue');
    assert.equal(midnight.night, 1);
    assert.equal(midnight.lamp, 1);
    assert.ok(midnight.sat < 1);
    const dawn = gradeFor(6 * 60 + 30);
    assert.ok(dawn.mult[0] > dawn.mult[2], 'dawn is warm');
    assert.ok(dawn.night > 0 && dawn.night < 1);
    const sunset = gradeFor(18 * 60);
    assert.ok(sunset.mult[0] > sunset.mult[2], 'sunset is amber');
    assert.ok(sunset.mult[0] > gradeFor(19 * 60 + 30).mult[0], 'blue hour cools after sunset');
    // monotone darkening through the evening
    let prev = gradeFor(16 * 60).night;
    for (let m = 16 * 60 + 30; m <= 23 * 60; m += 30) {
      const n = gradeFor(m).night;
      assert.ok(n >= prev, `night weight never drops through the evening (${m})`);
      prev = n;
    }
    assert.equal(dayPartAt(0), 'deep-night');
    assert.equal(dayPartAt(5 * 60 + 30), 'night');
    assert.equal(dayPartAt(7 * 60), 'dawn');
    assert.equal(dayPartAt(8 * 60), 'morning');
    assert.equal(dayPartAt(12 * 60), 'day');
    assert.equal(dayPartAt(17 * 60 + 30), 'golden');
    assert.equal(dayPartAt(18 * 60 + 30), 'sunset');
    assert.equal(dayPartAt(19 * 60 + 30), 'blue-hour');
    assert.equal(dayPartAt(21 * 60), 'night');
    assert.equal(dayPartAt(23 * 60), 'night', 'the ramp toward deep night starts at 22:30 on night values');
    assert.equal(dayPartAt(3 * 60), 'deep-night');
    assert.equal(dayPartAt(-60), 'night', 'wraps');
    assert.ok(Object.isFrozen(DAY_PARTS));
  });

  it('lamps light after dusk and go out after dawn', () => {
    const litHours = [];
    for (let h = 0; h < 24; h++) if (lampsLit(gradeFor(h * 60))) litHours.push(h);
    assert.deepEqual(litHours, [0, 1, 2, 3, 4, 5, 6, 18, 19, 20, 21, 22, 23]);
    assert.equal(lampsLit(gradeFor(17 * 60 + 30)), false, 'dusk begins, lamps not yet');
    assert.equal(lampsLit(gradeFor(18 * 60)), true);
    assert.equal(lampsLit(gradeFor(6 * 60 + 30)), true, 'still lit at first light');
    assert.equal(lampsLit(gradeFor(7 * 60)), false);
    assert.equal(LAMP_ON, 0.5);
    assert.equal(BIO_ON, 0.5);
  });

  it('weather adjusts the grade and unknown weather grades as clear', () => {
    const clear = gradeFor(12 * 60, 'clear');
    const rain = gradeFor(12 * 60, 'rain');
    const fog = gradeFor(12 * 60, 'fog');
    const storm = gradeFor(12 * 60, 'storm');
    assert.notEqual(rain, clear);
    assert.equal(rain.id, '24|rain');
    assert.ok(rain.mult[0] < clear.mult[0] && rain.sat < clear.sat && rain.lamp > clear.lamp);
    assert.ok(storm.mult[0] < rain.mult[0], 'storm is darker than rain');
    assert.ok(fog.floor[0] > clear.floor[0], 'fog lifts the floor');
    assert.equal(lampsLit(storm), true, 'a storm lights the lamps at noon');
    assert.equal(lampsLit(rain), false, 'rain alone does not');
    assert.equal(gradeFor(12 * 60, 'plague-of-frogs'), clear);
    assert.equal(gradeFor(12 * 60, undefined), clear);
    assert.equal(gradeFor(12 * 60, 'rain'), rain, 'cached per weather');
    for (const w of WEATHERS) assert.equal(gradeFor(0, w).weather, w);
  });

  it('indoor is one fixed lamp grade regardless of time and weather', () => {
    assert.equal(gradeFor(0, 'clear', true), INDOOR_GRADE);
    assert.equal(gradeFor(12 * 60, 'storm', true), INDOOR_GRADE);
    assert.equal(INDOOR_GRADE.id, 'indoor');
    assert.equal(INDOOR_GRADE.indoor, true);
    assert.equal(INDOOR_GRADE.lamp, 1);
    assert.equal(INDOOR_GRADE.night, 0);
    assert.ok(Object.isFrozen(INDOOR_GRADE));
  });
});

describe('gradeHex', () => {
  it('leaves colours alone at noon and never crushes below night ink', () => {
    const noon = gradeFor(12 * 60);
    assert.equal(gradeHex('#F6F1E3', noon), '#F6F1E3');
    assert.equal(gradeHex('#3f7a5a', noon), '#3F7A5A', 'upper-case output');
    const night = gradeFor(0);
    const cream = gradeHex('#F6F1E3', night);
    assert.notEqual(cream, '#F6F1E3');
    const [r, g, b] = [cream.slice(1, 3), cream.slice(3, 5), cream.slice(5, 7)].map((h) => parseInt(h, 16));
    assert.ok(b > r, 'graded cream leans blue at night');
    const ink = [0x14, 0x1b, 0x33];
    for (const hex of ['#000000', '#101010', '#2E5A48', '#F6F1E3', '#FFE29A']) {
      const out = gradeHex(hex, night);
      const c = [out.slice(1, 3), out.slice(3, 5), out.slice(5, 7)].map((h) => parseInt(h, 16));
      assert.ok(c[0] >= ink[0] && c[1] >= ink[1] && c[2] >= ink[2], `${hex} -> ${out} not below ink`);
    }
    // black lands on the ambient floor at midnight: within a step of ink, blue channel clamped to ink
    const black = gradeHex('#000000', night);
    assert.equal(black.slice(5, 7), NIGHT_INK.slice(5, 7));
    for (const k of [1, 3, 5]) assert.ok(Math.abs(parseInt(black.slice(k, k + 2), 16) - parseInt(NIGHT_INK.slice(k, k + 2), 16)) <= 4, black);
    assert.equal(gradeHex('#000000', night, '#FFFFFF'), '#FFFFFF', 'custom ink is the floor');
    assert.equal(gradeHex('#000000', gradeFor(12 * 60), '#000000'), '#000000');
    assert.throws(() => gradeHex('red', noon), TypeError);
    assert.throws(() => gradeHex('#FFF', noon), TypeError);
    assert.equal(gradeHex('#808080', INDOOR_GRADE).length, 7);
  });
});

describe('shadowFor', () => {
  it('is short at noon, long at golden hour, gone at night, fixed indoors', () => {
    const noon = shadowFor(12 * 60 + 30, gradeFor(12 * 60 + 30));
    const golden = shadowFor(17 * 60 + 30, gradeFor(17 * 60 + 30));
    const night = shadowFor(0, gradeFor(0));
    assert.deepEqual(noon, { dx: 1, dy: 1, alpha: 0.32 });
    assert.ok(golden.dx > noon.dx && golden.dy >= noon.dy);
    assert.ok(golden.alpha < noon.alpha, 'lamplight softens the shadow');
    assert.equal(night.alpha, 0);
    assert.deepEqual(shadowFor(500, INDOOR_GRADE), { dx: 1, dy: 1, alpha: 0.2 });
  });
});

describe('lightSources', () => {
  const ids = (lights) => lights.map((l) => l.id).sort();

  it('lamps and runes: nothing but the rune at noon, lamps after dusk', () => {
    const w = world();
    assert.deepEqual(ids(lightSources(harbor, w, 12)), ['rune@9,3']);
    // high tide keeps the bioluminescent flats dark so only lamps and the rune remain
    const evening = lightSources(harbor, w, { minute: 20 * 60, tide: 'high' });
    assert.deepEqual(ids(evening), ['lamp@5,3', 'lamp@7,3', 'rune@9,3']);
    const lamp = evening.find((l) => l.id === 'lamp@5,3');
    assert.deepEqual(lamp, { id: 'lamp@5,3', kind: 'lamp', x: 5, y: 3, px: 5 * 16 + 8, py: 3 * 16 + 8 - 8, radius: 40, color: '#F9C46B', intensity: 1 });
    const rune = evening.find((l) => l.kind === 'rune');
    assert.equal(rune.intensity, 1);
    assert.equal(rune.color, '#73EFF7');
    assert.equal(rune.radius, 20);
    // the prop lamp sits at the prop's tile
    const prop = evening.find((l) => l.id === 'lamp@7,3');
    assert.equal(prop.px, 7 * 16 + 8);
  });

  it('lamps fade in with the grade and are lit through the night', () => {
    const w = world();
    assert.equal(lightSources(harbor, w, 17.5).some((l) => l.kind === 'lamp'), false, 'dusk begins');
    const early = lightSources(harbor, w, 18).find((l) => l.kind === 'lamp');
    assert.ok(early && early.intensity >= 0.5 && early.intensity < 1, `sunset lamp ${early && early.intensity}`);
    const late = lightSources(harbor, w, 22).find((l) => l.kind === 'lamp');
    assert.equal(late.intensity, 1);
    for (let h = 0; h < 24; h++) {
      const lit = lightSources(harbor, w, h).some((l) => l.kind === 'lamp');
      assert.equal(lit, lampsLit(gradeFor(h * 60)), `hour ${h}`);
    }
  });

  it('porches light only while the house is occupied (world flag), never without a flag', () => {
    const dark = lightSources(harbor, world(), 21);
    assert.equal(dark.some((l) => l.kind === 'porch'), false);
    const home = lightSources(harbor, world({ flags: { 'np.wren.home': true } }), 21);
    assert.deepEqual(home.filter((l) => l.kind === 'porch').map((l) => l.id), ['porch@5,8'], 'the inn porch prop is absent: its cond fails');
    assert.equal(lightSources(harbor, world({ flags: { 'np.wren.home': true } }), 12).some((l) => l.kind === 'porch'), false, 'not by day');
    assert.equal(lightSources(harbor, world({ flags: { 'np.wren.home': 0 } }), 21).some((l) => l.kind === 'porch'), false, 'falsy flag');
    // the inn porch prop carries a cond, evaluated by the condition DSL by default
    const innOpen = lightSources(harbor, world({ flags: { 'np.wren.home': true, 'sp.inn-open': true } }), 21);
    assert.deepEqual(innOpen.filter((l) => l.kind === 'porch').map((l) => l.id), ['porch@5,8', 'porch@11,7']);
    // the porch-light tile itself names the occupancy flag, so the prop also needs the house lit
    assert.equal(lightSources(harbor, world({ flags: { 'sp.inn-open': true } }), 21).some((l) => l.kind === 'porch'), false);
    // a caller may supply its own evaluator (called with the map id and the prop tile)
    const seen = [];
    const evalCond = (w, cond, ctx) => { seen.push(ctx); return true; };
    const forced = lightSources(harbor, world({ flags: { 'np.wren.home': true } }), { minute: 21 * 60, evalCond });
    assert.equal(forced.filter((l) => l.kind === 'porch').length, 2);
    assert.deepEqual(seen, [{ mapId: 'harbor', x: 11, y: 7 }]);
  });

  it('bioluminescent mud glows only at night on a low tide', () => {
    const w = world();
    const low = minuteWithTide(w, 'low');
    const high = minuteWithTide(w, 'high');
    const bio = (opts) => lightSources(harbor, w, opts).filter((l) => l.kind === 'bio');
    assert.equal(bio({ minute: 23 * 60, tide: 'low' }).length, 8);
    assert.equal(bio({ minute: 23 * 60, tide: 0.05 }).length, 8);
    assert.equal(bio({ minute: 23 * 60, tide: 'high' }).length, 0);
    assert.equal(bio({ minute: 23 * 60, tide: 'rising' }).length, 0);
    assert.equal(bio({ minute: 12 * 60, tide: 'low' }).length, 0, 'not by day');
    assert.equal(bio({ minute: 18 * 60, tide: 'low' }).length, 0, 'sunset is not night enough');
    const one = bio({ minute: 23 * 60, tide: 'low' })[0];
    assert.equal(one.color, '#3FF2E0');
    assert.equal(one.radius, 24);
    assert.equal(one.intensity, 1);
    // tide defaults to the world clock
    w.clock.total = low;
    assert.equal(bio({ minute: 23 * 60 }).length, 8);
    w.clock.total = high;
    assert.equal(bio({ minute: 23 * 60 }).length, 0);
  });

  it('reads minute and weather from the world by default, and a storm lights lamps at noon', () => {
    const noon = world({ minute: 12 * 60 });
    assert.equal(lightSources(harbor, noon).some((l) => l.kind === 'lamp'), false);
    const night = world({ minute: MINUTES_PER_DAY * 3 + 22 * 60 });
    assert.equal(lightSources(harbor, night).some((l) => l.kind === 'lamp'), true);
    const storm = world({ minute: 12 * 60, weather: 'storm' });
    assert.equal(lightSources(harbor, storm).some((l) => l.kind === 'lamp'), true);
    assert.equal(lightSources(harbor, storm, { weather: 'clear' }).some((l) => l.kind === 'lamp'), false, 'override');
  });

  it('indoors every night light is on at full strength, at any hour', () => {
    for (const h of [3, 12, 20]) {
      const lights = lightSources(cottage, world(), h);
      assert.deepEqual(ids(lights), ['lamp@1,1']);
      assert.equal(lights[0].intensity, 1);
    }
    assert.equal(lightSources(cottage, world(), { minute: 12 * 60, indoor: false }).length, 0, 'indoor can be overridden');
  });

  it('fills a caller-supplied array and honours a custom tile size', () => {
    const out = [{ stale: true }];
    const r = lightSources(harbor, world(), { minute: 20 * 60, out, tile: 8 });
    assert.equal(r, out);
    assert.equal(out.some((l) => l.stale), false);
    assert.equal(out.find((l) => l.id === 'lamp@5,3').px, 5 * 8 + 4);
  });

  it('reuses its own light records across calls (no per-frame allocation)', () => {
    const w = world();
    const out = [];
    lightSources(harbor, w, { minute: 23 * 60, tide: 'low', out });
    const first = out.slice();
    assert.equal(first.length, 11, '2 lamps + rune + 8 bio cells');
    lightSources(harbor, w, { minute: 23 * 60 + 5, tide: 'low', out });
    assert.equal(out.length, first.length);
    out.forEach((l, i) => assert.equal(l, first[i], `record ${i} reused`));
    // shrinking truncates; growing again reuses the survivors
    lightSources(harbor, w, { minute: 23 * 60, tide: 'high', out });
    assert.equal(out.length, 3);
    assert.equal(out[0], first[0]);
    // results are the same values as a fresh call
    assert.deepEqual(lightSources(harbor, w, { minute: 23 * 60, tide: 'low', out }).map((l) => ({ ...l })), lightSources(harbor, w, { minute: 23 * 60, tide: 'low' }).map((l) => ({ ...l })));
  });
});
