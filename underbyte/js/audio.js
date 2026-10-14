/*
 * UNDERBYTE — js/audio.js
 * Owner: AUDIO implementer (this is a SILENT STUB by the engine architect).
 * Contract: CONTRACT.md §4.6 (UB.Audio). Design: DESIGN.md §13.
 *
 * Every public method exists and is safe to call at any time, with or without
 * an AudioContext (Playwright runs with no user gesture, so `ctx` stays null).
 * The AUDIO implementer fills in the Web Audio graph, synthesized SFX recipes
 * (§13.8), the song scheduler (§13.4–13.7) and ambient layers (§13.10) WITHOUT
 * changing any signature here. Nothing in this file may throw.
 */
'use strict';
(function (UB) {
  const Audio = {
    ctx: null,            // AudioContext once init() ran after a user gesture
    ready: false,
    song: null,           // current track id ('title', 'driftcache', 'boss', ...)
    ambientZone: null,
    volumes: { master: 8, music: 7, sfx: 8 },
    muted: false,
    _lastPlay: Object.create(null), // name → frame (rate limiting lives here)
    frame: 0,
  };

  /** Create the context on the first user gesture (called by the engine via UB.Input.onGesture). */
  Audio.init = function () {
    if (Audio.ready) { Audio.resume(); return; }
    // STUB: the AUDIO implementer creates the AudioContext + graph here.
    Audio.ready = true;
  };
  /** Resume a suspended context (idempotent). */
  Audio.resume = function () { /* stub */ };
  /** Fire a one-shot SFX by recipe name (DESIGN §13.8); x = world x for panning. */
  Audio.sfx = function (name, x) {
    Audio._lastPlay[name] = Audio.frame; // keeps the rate-limit bookkeeping shape
  };
  Audio.play = Audio.sfx; // alias used by DESIGN.md
  /** Start (or crossfade to) a song; null stops. */
  Audio.music = function (trackId) { Audio.song = trackId || null; };
  Audio.stopMusic = function () { Audio.song = null; };
  /** Zone ambient SFX layer (DESIGN §13.10). */
  Audio.ambient = function (zoneId) { Audio.ambientZone = zoneId || null; };
  Audio.stopAmbient = function () { Audio.ambientZone = null; };
  /** Volumes are 0–10 integers (DESIGN §14.2). Any subset may be passed. */
  Audio.setVolumes = function (v) {
    if (!v) return;
    if (v.master !== undefined) Audio.volumes.master = v.master;
    if (v.music !== undefined) Audio.volumes.music = v.music;
    if (v.sfx !== undefined) Audio.volumes.sfx = v.sfx;
  };
  /** Music duck multiplier (1 play, 0.4 paused/menus, 0 game-over fade) over `seconds`. */
  Audio.duck = function (mult, seconds) { Audio._duck = mult; };
  Audio.mute = function () { Audio.muted = true; };
  Audio.unmute = function () { Audio.muted = false; };
  /** Called once per logic frame by the engine (frame-based timers; no wall clock). */
  Audio.update = function () { Audio.frame++; };
  /** Test hook (DESIGN §13.9). */
  Audio.state = function () {
    return { ctxState: Audio.ctx ? Audio.ctx.state : 'none', voices: 0, song: Audio.song, step: 0, bpm: 0, ambient: Audio.ambientZone };
  };

  UB.Audio = Audio;
})(window.UB);
