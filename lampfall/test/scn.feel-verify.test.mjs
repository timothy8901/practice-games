// Game-feel lane, adversarial verification (wave 2): regressions for what the verifier found on top
// of test/scn.feel.test.mjs.
//  - forecast.js read the "flip seen" FLAG through flags.get (a counter), so the card flip could never
//    be skipped (the same flag/counter mix-up as lit.steadied);
//  - the indoor music filter keyed on map kind alone, so the Lantern Stack (an 'interior' map open to
//    the sky, light.indoor false) got the walled-in mix;
//  - objectiveFor re-ranked the pre-starter "the causeway" line into an errand when a meet beat was ready.
// Run: node --test test/scn.feel-verify.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { flipSeen } from '../js/scenes/forecast.js';
import { DEFAULTS as DIR_DEFAULTS, createMusicDirector } from '../js/audio/director.js';
import { objectiveFor } from '../js/ui/objectiveChip.js';
import { currentObjective } from '../js/scenes/menuModel.js';
import { createNewWorld } from '../js/state/schema.js';
import * as flags from '../js/systems/flags.js';
import { DATA_CONTENT } from '../js/data/content.js';
import { createBus } from '../js/core/events.js';
import { createFakeAudio, createFakeTimers, createFakeClock, makeWorld, makeData } from './fixtures/audio.fixture.mjs';

describe('forecast: the card flip is skippable once seen', () => {
  it('flipSeen reads the flag forecast.js writes with setFlag (not the counter of the same id)', () => {
    const w = createNewWorld({ seedCode: 'FLUX-TEST-0000', challenges: [] });
    assert.equal(flipSeen(w), false);
    flags.setFlag(w, 'sys.forecastFlipSeen', true);
    assert.equal(flipSeen(w), true, 'seen once -> skippable');
    assert.equal(flags.get(w, 'sys.forecastFlipSeen'), 0, 'the counter read used before is always 0');
  });
});

describe('indoor music honours the map light.indoor', () => {
  function rig(maps) {
    const bus = createBus();
    const audio = createFakeAudio({ ready: true });
    const timers = createFakeTimers();
    const clock = createFakeClock({ hour: 12, tide: 0.3, season: 'spring' });
    const G = { bus, audio, clock, world: makeWorld(), data: makeData(maps) };
    const music = createMusicDirector(G, { timers, sfx: false });
    const last = () => audio.of('setMusicParam').at(-1)[1].intensity;
    return { bus, music, last };
  }

  it('an interior map open to the sky (light.indoor false) keeps the full world mix', () => {
    const { bus, music, last } = rig({
      'lantern-stack': { id: 'lantern-stack', region: 'the-bar', kind: 'interior', music: null, light: { indoor: false, ambient: 'sea' } },
      'int-pells': { id: 'int-pells', region: 'pellwick', kind: 'interior', music: null, light: { indoor: true } },
      'int-bare': { id: 'int-bare', region: 'pellwick', kind: 'interior', music: null },
    });
    bus.emit('map:enter', { mapId: 'lantern-stack', kind: 'warp' });
    assert.equal(last(), 1, 'open to the sky: not filtered');
    bus.emit('map:enter', { mapId: 'int-pells', kind: 'warp' });
    assert.equal(last(), DIR_DEFAULTS.INDOOR_INTENSITY, 'a real room is filtered');
    bus.emit('map:enter', { mapId: 'lantern-stack', kind: 'warp' });
    assert.equal(last(), 1);
    bus.emit('map:enter', { mapId: 'int-bare', kind: 'warp' });
    assert.equal(last(), DIR_DEFAULTS.INDOOR_INTENSITY, 'no light block: the map kind decides');
    music.destroy();
  });

  it('the shipped Lantern Stack says it is open to the sky; every other music-less interior is a room', () => {
    const maps = Object.values(DATA_CONTENT.maps);
    const stack = maps.find((m) => m.id === 'lantern-stack');
    assert.equal(stack.light?.indoor, false);
    for (const m of maps.filter((x) => x.kind === 'interior' && !x.music && x.id !== 'lantern-stack')) {
      assert.notEqual(m.light?.indoor, false, `${m.id} would lose the indoor mix`);
    }
  });
});

describe('objectiveFor keeps the pre-starter line', () => {
  // a fixture where a meet beat and an errand beat are both ready before the starter is chosen
  const data = {
    maps: [{
      id: 'pellwick', name: 'Pellwick', triggers: [
        { id: 'story-meet-odile', kind: 'use', script: 'meet-odile', x: 1, y: 1, cond: true },
        { id: 'story-mail-sack-pickup', kind: 'use', script: 'mail-sack-pickup', x: 2, y: 2, cond: true },
      ],
    }],
  };

  it('no starter yet: the causeway line, never an errand re-ranked over it', () => {
    const w = createNewWorld({ seedCode: 'FLUX-TEST-0000', challenges: [] });
    w.flags['sp.arrived'] = true;
    w.player.mapId = 'pellwick';
    const cur = currentObjective(w, data);
    assert.deepEqual(objectiveFor(w, data), cur);
  });

  it('with a starter, the errand still ranks above the meet', () => {
    const w = createNewWorld({ seedCode: 'FLUX-TEST-0000', challenges: [] });
    Object.assign(w.flags, { 'sp.arrived': true, 'sp.starter-chosen': true });
    w.player.mapId = 'pellwick';
    const o = objectiveFor(w, data);
    assert.equal(o.x, 2);
    assert.equal(o.y, 2);
  });
});
