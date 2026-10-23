// Test doubles for the AUDIO lane: a fake core/audio engine (records every call, validates tracks with
// the real normalizeTrack), deterministic fake timers, a fake clock and a minimal world.
import { normalizeTrack } from '../../js/core/audio.js';

/**
 * A fake engine with the core/audio API surface the director and the sfx router use.
 * `ready` starts as given; `unlock()` flips it. `nowPlaying()` reports `{id, bpm, step}` where
 * `step` is whatever the test sets with `setStep(n)`.
 * @param {{ready?: boolean, throwOn?: string[]}} [opts]
 */
export function createFakeAudio({ ready = true, throwOn = [] } = {}) {
  const calls = [];
  const tracks = new Map();
  const stems = new Map();
  let current = null;
  let step = 0;
  let pending = null;
  let vol = { master: 1, music: 0.8, sfx: 1 };
  let muted = false;
  let intensity = 1;
  const maybeThrow = (name) => { if (throwOn.includes(name)) throw new Error(`fake ${name} failure`); };
  const api = {
    ready,
    calls,
    stems,
    unlock() { api.ready = true; if (pending) { current = pending; pending = null; } return Promise.resolve(true); },
    setVolume(v) { maybeThrow('setVolume'); calls.push(['setVolume', { ...v }]); vol = { ...vol, ...v }; return { ...vol }; },
    getVolume: () => ({ ...vol }),
    mute(on = true) { maybeThrow('mute'); calls.push(['mute', Boolean(on)]); muted = Boolean(on); return muted; },
    isMuted: () => muted,
    sfx(name, o) { maybeThrow('sfx'); calls.push(['sfx', name, o]); return api.ready ? { name, time: 0, duration: 0.1 } : null; },
    defineTrack(id, def) { maybeThrow('defineTrack'); const tr = normalizeTrack(id, def); tracks.set(id, tr); calls.push(['defineTrack', id]); return tr; },
    hasTrack: (id) => tracks.has(id),
    trackIds: () => [...tracks.keys()],
    playMusic(id, o = {}) {
      maybeThrow('playMusic');
      calls.push(['playMusic', id, { ...o }]);
      if (!tracks.has(id)) return false;
      if (!api.ready) { pending = { id, opts: o }; return true; }
      current = { id, opts: o };
      step = 0;
      return true;
    },
    stopMusic(o = {}) { calls.push(['stopMusic', { ...o }]); pending = null; const had = Boolean(current); current = null; return had; },
    setStem(name, on) { maybeThrow('setStem'); calls.push(['setStem', name, Boolean(on)]); stems.set(name, Boolean(on)); return [...stems].filter(([, v]) => v).map(([k]) => k); },
    getStems: () => [...stems].filter(([, v]) => v).map(([k]) => k),
    setMusicParam(p) { calls.push(['setMusicParam', { ...p }]); if (typeof p.intensity === 'number') intensity = Math.max(0, Math.min(1, p.intensity)); return { intensity }; },
    nowPlaying() {
      if (!current) return pending ? { id: pending.id, pending: true } : null;
      const tr = tracks.get(current.id);
      return { id: current.id, bpm: tr.bpm, bar: Math.floor(step / tr.stepsPerBar), beat: 0, step, loop: 0, oneShot: !tr.loop, remaining: null, stems: api.getStems(), intensity };
    },
    setStep(n) { step = n; },
    current: () => (current ? current.id : null),
    pendingId: () => (pending ? pending.id : null),
    /** calls of one kind, e.g. plays() -> [['playMusic', id, opts], ...] */
    of: (kind) => calls.filter((c) => c[0] === kind),
    plays: () => calls.filter((c) => c[0] === 'playMusic').map((c) => c[1]),
    clear() { calls.length = 0; },
  };
  return api;
}

/** Deterministic timers: `advance(ms)` runs due callbacks in time order. */
export function createFakeTimers() {
  let now = 0;
  let seq = 0;
  const q = new Map();
  return {
    setTimeout(fn, ms) { const id = ++seq; q.set(id, { at: now + Math.max(0, Number(ms) || 0), fn, id }); return id; },
    clearTimeout(id) { q.delete(id); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        let next = null;
        for (const e of q.values()) if (e.at <= end && (!next || e.at < next.at || (e.at === next.at && e.id < next.id))) next = e;
        if (!next) break;
        q.delete(next.id);
        now = next.at;
        next.fn();
      }
      now = end;
    },
    now: () => now,
    size: () => q.size,
  };
}

/** A fake live clock exposing the getters the director reads. */
export function createFakeClock({ hour = 12, tide = 0.5, season = 'spring' } = {}) {
  return { hour, tide, season };
}

/** The smallest world the director reads: settings, weather, player map, clock total. */
export function makeWorld({ volumes = { master: 0.8, music: 0.7, sfx: 0.9 }, muted = false, weather = 'clear', mapId = 'test-map', total = 12 * 60 } = {}) {
  return {
    settings: { volumes: { ...volumes }, muted },
    weather: { current: weather, today: weather },
    player: { mapId },
    clock: { total, seed: null },
    run: {},
  };
}

/** A registry-shaped map lookup over fixture map defs. */
export function makeData(maps) {
  return { has: (table, id) => table === 'maps' && Object.hasOwn(maps, id), get: (table, id) => maps[id] };
}
