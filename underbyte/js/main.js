/*
 * UNDERBYTE — js/main.js
 * Owner: ENGINE ARCHITECT (do not edit from other modules).
 * Contract: CONTRACT.md §1 (boot), §2.0 (loop).
 *
 * Boot: create the Game, attach input, size the canvas (960×540 letterboxed
 * to the window, crisp at devicePixelRatio ≤ 2), run the fixed-60 Hz
 * accumulator loop, expose window.UB.debug. The accumulator uses rAF
 * timestamps only to decide HOW MANY logic ticks to run; logic itself never
 * sees wall-clock time (BRIEF rule 5). UB.debug.pauseLogic(true) stops the
 * loop from ticking so tests can drive UB.debug.step(n) deterministically.
 */
'use strict';
(function (UB) {
  const STEP = 1000 / 60;
  const MAX_TICKS = 5;

  function boot() {
    const canvas = document.getElementById('game');
    const game = new UB.Engine.Game(canvas);
    UB.game = game;
    UB.debug = UB.Engine.makeDebug(game);
    UB.Input.init(canvas);
    game.init();
    // World data check (CONTRACT §4.3): every problem is a console.warn line — tests treat
    // warnings as non-fatal, but the world test asserts UB.World.validate() returns [].
    const worldErrors = UB.World.validate();
    for (let i = 0; i < worldErrors.length; i++) console.warn('[UB world] ' + worldErrors[i]);

    function resize() {
      const ww = window.innerWidth, wh = window.innerHeight;
      const s = Math.min(ww / 960, wh / 540);
      const cw = Math.max(1, Math.floor(960 * s)), ch = Math.max(1, Math.floor(540 * s));
      canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
      const left = Math.floor((ww - cw) / 2), top = Math.floor((wh - ch) / 2);
      canvas.style.left = left + 'px'; canvas.style.top = top + 'px';
      UB.Input.setViewport(left, top, cw, ch);
      game.setDpr(window.devicePixelRatio || 1);
    }
    window.addEventListener('resize', resize);
    resize();

    let last = 0, acc = 0, fpsFrames = 0, fpsLast = 0;
    function loop(now) {
      if (!last) last = now;
      let dt = now - last; last = now;
      if (dt > 100) dt = 100;
      if (game.logicPaused) acc = 0; else acc += dt;
      let n = 0;
      while (acc >= STEP && n < MAX_TICKS) { game.tick(); acc -= STEP; n++; }
      if (n === MAX_TICKS) acc = 0;
      game.render(game.logicPaused ? 1 : acc / STEP);
      fpsFrames++;
      if (now - fpsLast >= 1000) { game.fps = fpsFrames; fpsFrames = 0; fpsLast = now; }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);

    document.addEventListener('visibilitychange', function () { if (document.hidden) game.autoPause(); });
    window.addEventListener('gamepaddisconnected', function () { if (UB.Input.device === 'gamepad') game.autoPause(); });
  }

  UB.Main = { boot: boot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.UB);
