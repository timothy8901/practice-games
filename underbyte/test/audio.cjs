/*
 * UNDERBYTE — test/audio.cjs
 * Audio module test (Playwright, headless Chromium, file:// index.html).
 * Run:  node underbyte/test/audio.cjs      (exit code 0 = all PASS)
 *
 * 1. Headless safety: every UB.Audio method is called BEFORE any gesture (no AudioContext) and
 *    must not throw or log errors.
 * 2. A key press (gesture) + UB.Audio.init() builds the graph; every DESIGN §13.8 sfx name
 *    (UB.IDS.sfx + UB.Audio.sfxNames()) and every UB.IDS.songs track id is exercised; the state
 *    hook must report the requested track; loops/ambient/volumes/duck/mute are exercised too.
 * 3. In-game wiring: a new game plays the zone song + ambient layer; a boss intro switches to
 *    'boss'; every fighter's affinity-flavoured recipes play.
 * 4. OfflineAudioContext renders (UB.Audio.debugRender) prove that sfx and songs are audible
 *    (peak > 0.01) and never clip (peak <= 1.0).
 * Finally asserts no console errors / page errors.
 */
const { launch } = require('./harness.cjs');

const results = [];
function check(name, ok, info) {
  results.push({ name, ok: !!ok, info });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined && !ok ? '  -> ' + JSON.stringify(info) : ''));
}

(async () => {
  const t = await launch();
  const page = t.page;
  const ev = (fn, ...args) => page.evaluate(({ src, args }) => {
    const f = new Function('args', 'return (' + src + ')(...args)');
    return f(args);
  }, { src: fn.toString(), args });
  const astate = () => page.evaluate(() => window.UB.Audio.state());
  const step = (n) => page.evaluate((n) => window.UB.debug.step(n), n);
  const errCount = () => t.errors.length;

  try {
    await page.evaluate(() => localStorage.removeItem('underbyte.save'));
    await page.reload(); await page.waitForTimeout(250);
    await ev(() => window.UB.debug.pauseLogic(true));

    // ---------- 1. no-gesture safety (ctx stays null) ----------
    let s = await astate();
    check('before any gesture the context is absent and the title track is requested', s.ctxState === 'none' && s.song === 'title', s);
    const names = await ev(() => Object.keys(window.UB.IDS.sfx));
    const recipeNames = await ev(() => window.UB.Audio.sfxNames());
    const missing = names.filter((n) => recipeNames.indexOf(n) < 0);
    check('every UB.IDS.sfx name has a recipe (' + names.length + ' names)', missing.length === 0, missing);
    const e0 = errCount();
    const noCtxOk = await ev((names) => {
      try {
        const A = window.UB.Audio;
        for (const n of names) { A.sfx(n, 100); A.sfx(n); A.play(n); }
        A.sfx('definitely-not-a-sound'); A.sfx(null); A.sfx(42);
        for (const id of window.UB.IDS.songs) A.music(id);
        A.music('nope'); A.music(null); A.stopMusic();
        for (const z of window.UB.IDS.zones) A.ambient(z);
        A.stopAmbient();
        A.loop('wallSlide', true); A.loop('wallSlide', true); A.loop('nope', true); A.loop('wallSlide', false); A.stopLoops();
        A.setVolumes({ master: 5 }); A.setVolumes({ music: 3, sfx: 9 }); A.setVolumes(null);
        A.duck(0.4, 0.2); A.duck(1, 0.2); A.mute(); A.unmute(); A.resume();
        for (let i = 0; i < 10; i++) A.update();
        A.state(); window.UB.debug.audio(); window.UB.debug.mute(); A.unmute();
        return true;
      } catch (e) { return String(e && e.stack || e); }
    }, names);
    check('every method is safe with no AudioContext (headless, no gesture)', noCtxOk === true && errCount() === e0, noCtxOk);
    await page.evaluate(() => { window.UB.Audio.setVolumes({ master: 8, music: 7, sfx: 8 }); window.UB.Audio.music('title'); });   // restore the engine's request

    // ---------- 2. gesture → init → graph ----------
    await page.keyboard.press('ArrowDown');   // user gesture: the engine's onGesture hook calls init()
    await step(2);
    await ev(() => window.UB.Audio.init());  // idempotent
    await ev(() => window.UB.Audio.init());
    s = await astate();
    const hasCtx = s.ctxState !== 'none';
    check('init() after a key press creates the context (state: ' + s.ctxState + ')', hasCtx, s);
    check('title music starts once the context exists', s.song === 'title' && (!hasCtx || s.playing === 'title'), s);
    check('title song bpm is 80 (DESIGN §13.7)', !hasCtx || s.bpm === 80, s);

    // every sfx name with and without a position, rate limiter respected by stepping between calls
    const e1 = errCount();
    const sfxOk = await ev((names) => {
      try {
        const A = window.UB.Audio, D = window.UB.debug;
        for (const n of names) { A.sfx(n, 300); D.step(3); A.sfx(n); D.step(3); A.sfx(n, -5000); D.step(1); A.sfx(n, 1e9); D.step(6); }
        return true;
      } catch (e) { return String(e && e.stack || e); }
    }, recipeNames);
    check('every sfx recipe plays with the context (' + recipeNames.length + ' recipes)', sfxOk === true && errCount() === e1, sfxOk);
    s = await astate();
    check('voices are counted after sfx bursts', !hasCtx || s.voices >= 0, s);
    // rate limit: the same name twice in one frame registers once
    const rl = await ev(() => {
      const A = window.UB.Audio; const f = A.frame;
      A.sfx('menuMove'); const a = A._lastPlay.menuMove; A.sfx('menuMove'); const b = A._lastPlay.menuMove;
      return { f, a, b };
    });
    check('rate limit bookkeeping keeps the frame of the first play', rl.a === rl.f && rl.b === rl.f, rl);

    // every music track id
    const songs = await ev(() => window.UB.IDS.songs.slice());
    for (const id of songs) {
      const e2 = errCount();
      await ev((id) => window.UB.Audio.music(id), id);
      await step(5);
      s = await astate();
      check('music(' + id + ') reports song=' + id + (hasCtx ? ' and plays it' : ''), s.song === id && (!hasCtx || s.playing === id) && errCount() === e2, s);
    }
    await ev(() => window.UB.Audio.music('driftcache'));
    await ev(() => window.UB.Audio.music('driftcache'));   // same id must not restart
    await step(2); s = await astate();
    check('music(same id) is a no-op (song stays driftcache)', s.song === 'driftcache', s);
    await ev(() => window.UB.Audio.stopMusic()); await step(2); s = await astate();
    check('stopMusic() clears the song', s.song === null, s);

    // loops, ambient, volumes, duck, mute
    await ev(() => window.UB.Audio.loop('wallSlide', true)); s = await astate();
    check("loop('wallSlide', true) is listed in state().loops", s.loops.indexOf('wallSlide') >= 0, s);
    await ev(() => { window.UB.Audio.loop('wallSlide', true); window.UB.Audio.loop('wallSlide', false); window.UB.Audio.loop('wallSlide', false); }); s = await astate();
    check("loop('wallSlide', false) removes it (idempotent)", s.loops.length === 0, s);
    await ev(() => { window.UB.Audio.loop('wallSlide', true); window.UB.Audio.stopLoops(); }); s = await astate();
    check('stopLoops() clears every loop', s.loops.length === 0, s);
    const zones = await ev(() => window.UB.IDS.zones.slice());
    for (const z of zones) {
      const e3 = errCount();
      await ev((z) => window.UB.Audio.ambient(z), z);
      await step(900);   // run the frame-based ambient timers (drips, crackles, heartbeat …)
      s = await astate();
      check('ambient(' + z + ') runs its layer for 900 frames', s.ambient === z && errCount() === e3, s);
    }
    await ev(() => window.UB.Audio.stopAmbient()); s = await astate();
    check('stopAmbient() clears the layer', s.ambient === null, s);
    const vol = await ev(() => { const A = window.UB.Audio; A.setVolumes({ master: 3, music: 11, sfx: -2 }); return A.state().volumes; });
    check('setVolumes clamps to 0–10 integers', vol.master === 3 && vol.music === 10 && vol.sfx === 0, vol);
    await ev(() => window.UB.Audio.setVolumes({ master: 8, music: 7, sfx: 8 }));
    const mu = await ev(() => { const A = window.UB.Audio; A.mute(); const a = A.state().muted; A.unmute(); const b = A.state().muted; const c = A.toggleMute(); A.unmute(); return { a, b, c }; });
    check('mute()/unmute()/toggleMute() toggle the flag', mu.a === true && mu.b === false && mu.c === true, mu);
    const dk = await ev(() => { const A = window.UB.Audio; A.duck(0.4, 0.17); const a = A.state().duck; A.duck(1, 0.17); return { a, b: A.state().duck }; });
    check('duck() stores the music multiplier', dk.a === 0.4 && dk.b === 1, dk);

    // ---------- 3. in-game wiring ----------
    await ev(() => window.UB.debug.newGame('tessik'));
    await step(40);
    s = await astate();
    const gs = await page.evaluate(() => window.UB.debug.state());
    check('a new game plays the zone song + ambient layer of the start room (' + gs.zoneId + ')', gs.screen === 'play' && s.song === gs.zoneId && s.ambient === gs.zoneId, { s, zone: gs.zoneId });
    if (hasCtx) {
      await page.waitForTimeout(1200);   // the lookahead scheduler runs on a 25 ms interval
      s = await astate();
      check('scheduler advances the song step while the context runs (' + s.ctxState + ')', s.step > 0 || s.ctxState !== 'running', s);
    }
    // fighters: every affinity timbre through the player-owned recipes
    const fighters = await ev(() => window.UB.IDS.fighters.slice());
    for (const f of fighters) {
      const e4 = errCount();
      const ok = await ev((f) => {
        const D = window.UB.debug, A = window.UB.Audio;
        D.newGame(f); D.step(30);
        const st = D.state(); if (st.fighter !== f) return 'fighter ' + st.fighter;
        for (const n of ['jump', 'doubleJump', 'land', 'step', 'dash', 'lightHit', 'heavyHit', 'enemyHit', 'special', 'ultimate', 'hurt', 'death']) { A.sfx(n, st.x); D.step(4); }
        return true;
      }, f);
      check('fighter ' + f + ': affinity recipes play', ok === true && errCount() === e4, ok);
    }
    // boss intro → 'boss' track, enrage/phase 2 → the phase-2 variant (158 BPM)
    const bossOk = await ev(() => {
      const D = window.UB.debug, A = window.UB.Audio;
      D.newGame('tessik'); D.step(30);
      D.warp('debug_boss', null); D.step(10);
      D.god(true);
      const b = D.spawnBoss('tallock', { fight: true });
      if (!b) return { err: 'no boss' };
      D.step(200);
      const during = A.state();
      const g = window.UB.game; const boss = g.boss;
      let p2 = null;
      if (boss) { boss.phase = 2; A.update(); p2 = A.state(); boss.phase = 1; A.update(); }
      return { during, p2, after: A.state() };
    });
    check("boss intro switches the music to 'boss'", bossOk.during && bossOk.during.song === 'boss', bossOk);
    check('boss phase 2 selects the 158 BPM variant (and back)', !hasCtx || (bossOk.p2 && bossOk.p2.phase2 === true && bossOk.p2.bpm === 158 && bossOk.after.bpm === 150), bossOk);
    await ev(() => { window.UB.debug.god(false); window.UB.debug.toTitle(); });
    await step(5); s = await astate();
    check("toTitle() returns to the title track and stops ambient", s.song === 'title' && s.ambient === null && s.loops.length === 0, s);

    // ---------- 4. offline renders: audible, not clipping ----------
    const renders = ['lightHit', 'jump', 'bossRoar', 'heavyHit', 'pickupBit', 'menuConfirm', 'driftcache', 'title', 'loomworks', 'brinevault', 'nullspire', 'rootwell', 'boss', 'victory'];
    for (const n of renders) {
      const e5 = errCount();
      const peak = await ev((n) => window.UB.Audio.debugRender(n, 2), n);
      check('offline render of ' + n + ' is audible and does not clip (peak ' + (typeof peak === 'number' ? peak.toFixed(3) : peak) + ')',
        typeof peak === 'number' && peak > 0.01 && peak <= 1.0 && errCount() === e5, peak);
    }
    const nope = await ev(() => window.UB.Audio.debugRender('not-a-thing', 0.5));
    check('offline render of an unknown name is silent and safe', nope === 0, nope);

    // ---------- 5. long soak with everything running ----------
    const e6 = errCount();
    await ev(() => { const D = window.UB.debug; D.newGame('korvask'); D.step(60); window.UB.Audio.music('boss'); window.UB.Audio.ambient('rootwell'); });
    await ev(() => {
      const A = window.UB.Audio, D = window.UB.debug;
      for (let i = 0; i < 600; i++) { if (i % 7 === 0) A.sfx('lightHit', 200); if (i % 11 === 0) A.sfx('step', 200); if (i % 90 === 0) A.sfx('bossRoar', 400); A.loop('wallSlide', i % 40 < 20); D.step(1); }
      A.stopLoops();
    });
    await page.waitForTimeout(600);
    s = await astate();
    check('600-frame soak with hits, loops, boss music and ambient produced no errors', errCount() === e6 && s.voices <= 40, { s, errs: t.errors.slice(e6) });

    check('no console errors or page errors', t.errors.length === 0, t.errors);
  } catch (e) {
    check('test script ran to completion', false, String(e && e.stack || e));
  }

  const fails = results.filter((r) => !r.ok);
  console.log(`\n${results.length - fails.length}/${results.length} checks passed` + (fails.length ? ' — FAILED: ' + fails.map((f) => f.name).join(' | ') : ''));
  if (t.errors.length) console.log('page errors:\n' + t.errors.join('\n'));
  await t.close();
  process.exit(fails.length ? 1 : 0);
})();
