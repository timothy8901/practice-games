// Unit tests for js/systems/settings.js. Run: node --test test/state.settings.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as settings from '../js/systems/settings.js';
import { createNewWorld, validateWorld, settingsDefaults } from '../js/state/schema.js';
import { createBus } from '../js/core/events.js';

const world = () => createNewWorld({ seedCode: 'SETTINGS-TEST' });

describe('normalize', () => {
  it('fills defaults, clamps numbers, drops unknown keys and wrong types', () => {
    assert.deepEqual(settings.normalize(null), settingsDefaults());
    assert.deepEqual(settings.normalize({}), settingsDefaults());
    const n = settings.normalize({
      volumes: { master: 2, music: -1, sfx: 'loud' }, muted: 'yes', textSpeed: 'warp', minutesPerDay: 1, realClock: true,
      scale: 'fit', bindings: { confirm: ['KeyZ'] }, reducedMotion: true, fps30: 1, skipAnims: true,
      autoAnchor: { c1: 'auto-up', c2: 'bogus', c3: null }, extra: 1,
    });
    assert.deepEqual(n.volumes, { master: 1, music: 0, sfx: 0.9 });
    assert.equal(n.muted, false);
    assert.equal(n.textSpeed, 'normal');
    assert.equal(n.minutesPerDay, settings.MINUTES_PER_DAY_RANGE.min);
    assert.equal(settings.normalize({ minutesPerDay: 10_000 }).minutesPerDay, settings.MINUTES_PER_DAY_RANGE.max);
    assert.equal(n.realClock, true);
    assert.equal(n.scale, 'fit');
    assert.deepEqual(n.bindings, { confirm: ['KeyZ'] });
    assert.equal(n.reducedMotion, true);
    assert.equal(n.fps30, false);
    assert.equal(n.skipAnims, true);
    assert.deepEqual(n.autoAnchor, { c1: 'auto-up', c3: null });
    assert.equal('extra' in n, false);
    assert.deepEqual(Object.keys(n).sort(), Object.keys(settingsDefaults()).sort());
  });

  it('does not share nested objects with its input or base', () => {
    const base = settingsDefaults();
    const n = settings.normalize({ volumes: { master: 0.5 } }, base);
    n.volumes.master = 0.1;
    assert.equal(base.volumes.master, 0.8);
    assert.ok(Object.isFrozen(settings.DEFAULTS));
  });
});

describe('apply', () => {
  it('lists every subsystem without prev and only diffs with prev', () => {
    const full = settings.apply(settingsDefaults());
    assert.deepEqual(full.map((e) => e.kind), [
      'audio.volume', 'audio.mute', 'clock.minutesPerDay', 'clock.realClock', 'display.scale', 'input.bindings',
      'motion.reduced', 'loop.fps30', 'text.speed', 'anims.skip', 'anchor.auto',
    ]);
    const prev = settingsDefaults();
    const next = { ...settingsDefaults(), muted: true, textSpeed: 'instant', volumes: { ...prev.volumes, sfx: 0.2 } };
    const diff = settings.apply(next, prev);
    assert.deepEqual(diff, [
      { kind: 'audio.volume', volumes: { master: 0.8, music: 0.7, sfx: 0.2 } },
      { kind: 'audio.mute', muted: true },
      { kind: 'text.speed', textSpeed: 'instant', charsPerSecond: Infinity },
    ]);
    assert.deepEqual(settings.apply(prev, prev), []);
  });

  it('textCharsPerSecond maps speeds', () => {
    assert.equal(settings.textCharsPerSecond({ textSpeed: 'slow' }), settings.TEXT_SPEED_CPS.slow);
    assert.equal(settings.textCharsPerSecond({ textSpeed: 'nope' }), settings.TEXT_SPEED_CPS.normal);
    assert.equal(settings.textCharsPerSecond(null), settings.TEXT_SPEED_CPS.normal);
  });
});

describe('update', () => {
  it('patches world.settings, mirrors realClock into the clock, returns effects and emits', () => {
    const w = world();
    const bus = createBus();
    const events = [];
    bus.on('settings:changed', (p) => events.push(p));
    const res = settings.update(w, { volumes: { music: 0.3 }, realClock: true, minutesPerDay: 48, junk: 1 }, { bus });
    assert.deepEqual(res.changed.sort(), ['minutesPerDay', 'realClock', 'volumes']);
    assert.deepEqual(w.settings.volumes, { master: 0.8, music: 0.3, sfx: 0.9 });
    assert.equal(w.settings.realClock, true);
    assert.equal(w.clock.realClock, true);
    assert.equal(w.settings.minutesPerDay, 48);
    assert.equal('junk' in w.settings, false);
    assert.deepEqual(res.effects.map((e) => e.kind).sort(), ['audio.volume', 'clock.minutesPerDay', 'clock.realClock']);
    assert.equal(res.settings, w.settings);
    assert.equal(events.length, 1);
    assert.deepEqual(events[0].changed.sort(), ['minutesPerDay', 'realClock', 'volumes']);
    const noop = settings.update(w, { realClock: true }, { bus });
    assert.deepEqual(noop, { changed: [], effects: [], settings: w.settings });
    assert.equal(events.length, 1);
    assert.deepEqual(validateWorld(w), []);
    assert.throws(() => settings.update(w, null), TypeError);
  });

  it('setAutoAnchor sets and clears per uid', () => {
    const w = world();
    settings.setAutoAnchor(w, 'c1', 'auto-anchor');
    settings.setAutoAnchor(w, 'c2', 'auto-up');
    assert.deepEqual(w.settings.autoAnchor, { c1: 'auto-anchor', c2: 'auto-up' });
    const res = settings.setAutoAnchor(w, 'c1', null);
    assert.deepEqual(w.settings.autoAnchor, { c2: 'auto-up' });
    assert.deepEqual(res.effects.map((e) => e.kind), ['anchor.auto']);
    assert.throws(() => settings.setAutoAnchor(w, '', null), TypeError);
    assert.throws(() => settings.setAutoAnchor(w, 'c1', 'maybe'), TypeError);
  });
});

describe('mirror', () => {
  it('round-trips the device subset through a string', () => {
    const s = { ...settingsDefaults(), muted: true, scale: 'fit', autoAnchor: { c1: 'auto-up' } };
    const text = settings.toMirror(s);
    const back = settings.fromMirror(text);
    assert.deepEqual(Object.keys(back).sort(), [...settings.MIRRORED_KEYS].sort());
    assert.equal(back.muted, true);
    assert.equal(back.scale, 'fit');
    assert.equal('autoAnchor' in back, false, 'run-specific keys are not mirrored');
    assert.equal(settings.fromMirror('{bad json'), null);
    assert.equal(settings.fromMirror('[]'), null);
    assert.equal(settings.fromMirror(''), null);
    assert.equal(settings.fromMirror(7), null);
  });

  it('readMirror / writeMirror never throw and use the storage given', () => {
    const map = new Map();
    const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) };
    assert.deepEqual(settings.readMirror(storage), settingsDefaults());
    assert.equal(settings.writeMirror(storage, { ...settingsDefaults(), textSpeed: 'fast' }), true);
    assert.ok(map.has(settings.MIRROR_KEY));
    assert.equal(settings.readMirror(storage).textSpeed, 'fast');
    assert.equal(settings.writeMirror(storage, settingsDefaults(), 'other.key'), true);
    assert.ok(map.has('other.key'));
    assert.equal(settings.writeMirror(null, settingsDefaults()), false);
    assert.equal(settings.writeMirror({ setItem() { throw new Error('quota'); } }, settingsDefaults()), false);
    assert.deepEqual(settings.readMirror({ getItem() { throw new Error('denied'); } }), settingsDefaults());
    assert.deepEqual(settings.readMirror(undefined), settingsDefaults());
  });
});
