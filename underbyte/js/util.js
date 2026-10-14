/*
 * UNDERBYTE — js/util.js
 * Owner: ENGINE ARCHITECT (do not edit from other modules).
 * Contract: CONTRACT.md §4.1 (UB.Util), §4.0 (UB.Palette, UB.Fonts).
 *
 * First script in the load order: creates the single global namespace `UB`.
 * Pure helpers only — no DOM, no state beyond constants. Everything here is
 * allocation-free unless the name says otherwise (wrapText returns an array).
 */
'use strict';
window.UB = window.UB || {};
(function (UB) {
  const Util = {};

  Util.TAU = Math.PI * 2;
  Util.DEG = Math.PI / 180;

  /** Clamp v into [lo, hi]. */
  Util.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  /** Linear interpolation a→b by t (t unclamped). */
  Util.lerp = function (a, b, t) { return a + (b - a) * t; };
  /** Move v toward target by at most step. */
  Util.approach = function (v, target, step) {
    if (v < target) return Math.min(v + step, target);
    if (v > target) return Math.max(v - step, target);
    return v;
  };
  Util.sign = function (v) { return v > 0 ? 1 : (v < 0 ? -1 : 0); };
  Util.abs = Math.abs;

  // --- easing (t in [0,1]) ----------------------------------------------
  Util.easeOutCubic = function (t) { const u = 1 - t; return 1 - u * u * u; };
  Util.easeInQuad = function (t) { return t * t; };
  Util.easeOutQuad = function (t) { return 1 - (1 - t) * (1 - t); };
  Util.easeInOutQuad = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  Util.easeOutBack = function (t) { const c = 1.70158; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };

  // --- seeded RNG (mulberry32) --------------------------------------------
  /**
   * Returns a function producing floats in [0,1). Deterministic for a seed.
   * Logic code must use this (never Math.random) so tests are repeatable.
   */
  Util.rng = function (seed) {
    let a = (seed | 0) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  /** Integer hash of up to four ints → uint32 (for stable per-vertex jitter). */
  Util.hash = function (a, b, c, d) {
    let h = (a | 0) * 374761393 + (b | 0) * 668265263 + (c | 0) * 2246822519 + (d | 0) * 3266489917;
    h = (h ^ (h >>> 13)) * 1274126177;
    return (h ^ (h >>> 16)) >>> 0;
  };
  /** Stable jitter in [-amp, amp] for (seed, index). */
  Util.jitter = function (seed, i, amp) {
    return ((Util.hash(seed, i, 7, 11) % 2001) / 1000 - 1) * amp;
  };
  /** Pick a random element with an rng function. */
  Util.pick = function (rng, arr) { return arr[Math.floor(rng() * arr.length) % arr.length]; };
  /** Random float in [lo, hi) with an rng function. */
  Util.rand = function (rng, lo, hi) { return lo + rng() * (hi - lo); };

  // --- geometry -------------------------------------------------------------
  /** AABB overlap test; boxes given as top-left x,y + w,h. */
  Util.aabb = function (ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  };
  Util.dist = function (ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return Math.sqrt(dx * dx + dy * dy); };

  // --- text -------------------------------------------------------------
  Util.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  /** Frames (60 Hz) → 'HH:MM:SS'. */
  Util.fmtTime = function (frames) {
    const s = Math.floor(frames / 60);
    return Util.pad2(Math.floor(s / 3600)) + ':' + Util.pad2(Math.floor(s / 60) % 60) + ':' + Util.pad2(s % 60);
  };
  /** Word-wrap text to maxWidth using the ctx's current font. Allocates. */
  Util.wrapText = function (ctx, text, maxWidth) {
    const words = String(text).split(' ');
    const lines = [];
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = words[i]; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };

  UB.Util = Util;

  // --- shared palette + fonts (DESIGN.md §11.1.2, §11.0) ----------------------
  // Zone palettes live in UB.World.zones[id].palette (world.js owns them).
  UB.Palette = {
    INK: '#141018', PAPER: '#F2EBDD', PAPER_DIM: '#A89F90',
    HEART: '#E8484F', HEART_EMPTY: '#4A2A2E', CORE_HEART: '#F2B13C',
    ENERGY: '#3FD3FF', ENERGY_DIM: '#174A5A', METER: '#B86BFF', METER_READY: '#FFFFFF',
    METER_DIM: '#2A1A3A', BITS: '#8FE388', DANGER: '#FF3B3B',
    PANEL: 'rgba(20,16,24,0.82)', PANEL_EDGE: '#F2EBDD', SELECT: '#FFD166',
    LOGO_A: '#3FD3FF', LOGO_B: '#B86BFF', LETTERBOX: '#0A080C', SPIKE: '#C9C2B4',
  };
  UB.Fonts = {
    UI: '"Trebuchet MS", "Segoe UI", Arial, Helvetica, sans-serif',
    MONO: '"Consolas", "Menlo", "DejaVu Sans Mono", "Courier New", monospace',
  };
  /** Build a font string: UB.font(18, 'MONO', true) → 'bold 18px <mono stack>'. */
  UB.font = function (px, family, bold) {
    return (bold ? 'bold ' : '') + px + 'px ' + (family === 'MONO' ? UB.Fonts.MONO : UB.Fonts.UI);
  };
})(window.UB);
