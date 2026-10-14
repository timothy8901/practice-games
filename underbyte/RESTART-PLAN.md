# UNDERBYTE — restart plan (paused 2026-10-14)

Everything was paused at the user's request. This file is the handoff for whichever agent
resumes. Read it top to bottom before touching anything.

## 0. Ground rules (from the user and from earlier sessions)

1. **Branch:** develop and push only on `claude/relaxed-feynman-7krhm9`. Do not open a pull
   request, do not merge to `main`, and do not edit the repo-root `index.html` or `README.md`.
   The user said the game is **not to be put on the GitHub Pages site yet**.
2. **Originality is non-negotiable** (see `BRIEF.md` rule 1).
   * The user asked twice to use assets from commercial games: first to decompile and merge
     two games, then to use ripped GBA sprites from a sprite-rip site. Both were declined
     because the material is copyrighted.
   * Never download, trace or imitate those sprites, characters or names. Never draw
     lookalikes of existing franchise creatures.
   * All art is original and drawn by our own code. The pixel restyle in step 6 uses **our
     own characters** in a generic handheld-era pixel style.
3. **Commits:** end every commit message with these two lines:
   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_012gwBcQCNMGd8S73SJcuHZi
   ```
   Use whatever model attribution line the session's system reminder gives at the time.
   A stop hook demands that everything is committed and pushed before a turn ends.
4. **Multi-agent orchestration:** the Workflow tool needs the user's explicit opt-in in the
   current conversation. The Agent tool is fine for individual subagents. The machine has
   4 CPUs, so run at most two browser-heavy agents at once.

## 1. What exists

| Area | State |
|---|---|
| Game | `underbyte/index.html` + `js/*.js` (~14k lines). It is fully playable: 5 fighters, 23 rooms in 5 zones, 10 enemy types, 4 bosses, synthesized audio, save/continue, map, vendor, all screens, keyboard + gamepad. |
| Specs | `BRIEF.md` (rules) · `DESIGN.md` (canonical numbers) · `DESIGN-SUMMARY.md` (1-page digest) · `CONTRACT.md` (module interfaces, changelog at top) · `ART-STYLE.md` (pixel restyle guide, not started) |
| Tests | `test/run-all.cjs` runs every suite (smoke, verify-core, world, characters, enemies, audio, ui, playthrough, critic-complete, qa-*, pt-fixes-gameplay, pt-fixes-presentation). See `test/README.md`. |
| Playtests | `playtests/`: 22 recordings (34 min of live play) in `recordings/`; 7 persona reports in `reports/`; the merged `REPORT.md`; `triage.json` (every bug with repro + the F01–F28 feature backlog); `fix-results.json` (what the fix lanes changed); `tools/` (play server, client, and the persona workflow script that produced them) |

## 2. Where it stopped

The run that was fixing the playtest bugs and adding features was stopped during its
**Features** stage.

| Stage | Status |
|---|---|
| Gameplay fix lane (B10 B15 B16 B17 B19 B26 B27 B29 B31 B32 B33 B34 B36 B38 B41 B43) | **Done.** `test/pt-fixes-gameplay.cjs` 32/32 |
| Presentation fix lane (B03 B04 B05 B06 B11 B12 B18 B19 B23 B24 B25 B32 B42) | **Done.** `test/pt-fixes-presentation.cjs` 53/53 |
| Integrator (engine requests, B22 faithful debug defeat, B38 boss framing, B04/B10/B25/B31/B34/B42 engine side, suites added to run-all) | **Done** |
| Features F01–F07 | **Interrupted.** All seven have partial code in the tree (see below); none is verified and `test/features.cjs` does not exist |
| Verify (run-all twice, alone) | Not run since the interruption |
| Returning testers' after-clips | Not run |
| Docs (`underbyte/README.md`, REPORT.md "After the fixes") | Not written |
| Pixel restyle | Not started; only `ART-STYLE.md` exists |

**Checks run at the pause:** all `js/*.js` pass `node --check`; `smoke.cjs` 90/90 with zero
console errors; `pt-fixes-gameplay.cjs` 32/32; `pt-fixes-presentation.cjs` 53/53. The full
`run-all.cjs` was **not** re-run after the interruption.

**Partial feature code found by grep:**

| Feature | Files that mention it |
|---|---|
| F01 controls page | characters, engine, input, ui |
| F02 reduced flashing / steady silhouette | characters, enemies, engine, fx, ui |
| F03 device-aware prompts (the one in progress) | main, ui |
| F04 signal ledges | world, render, engine, util (+ incidental hits) |
| F05 hazard outline | render, engine, bosses, ui |
| F06 lore archive / skippable intros | ui |
| F07 restore-echo tips | engine, ui, util |

Some of these may be complete and some half-wired. Earlier fixes also touch REDUCED
FLASHING (B42), so not every hit belongs to the feature agent.

## 3. Next steps, in order

1. **Audit the tree.**
   * Run `node underbyte/test/run-all.cjs` with nothing else running (about 8 min).
   * Read `git diff 0ddf008 -- underbyte/js` (0ddf008 is the last snapshot before the
     integrator and features ran) to see the integrator's work and the partial feature edits.
   * Fix anything broken before adding more.
2. **Finish F01–F07.** The specs are the `features` entries F01–F07 in `playtests/triage.json`
   and `REPORT.md`. The implementer's brief was:
   * **F01 Controls & Moves page** in Pause and Settings: every input for the current device,
     including dash, ultimate, drop-through and interact. Not-yet-unlocked abilities are shown
     as LOCKED with a vague in-world hint, so players know dash exists but isn't broken. Also
     show the fighter's move names.
   * **F02 Comfort pack:** REDUCED FLASHING scales or disables full-screen flashes and drives
     the fx flash hook. STEADY SILHOUETTE keeps the hero's outline visible during i-frames.
   * **F03 Device-aware prompts everywhere:** prompts follow the last-used device and switch
     instantly. Use neutral glyphs.
   * **F04 Signal Ledges:** 1–3 glowing respawn pads on real footing in `dc_fall`, `lw_hoist`,
     `ns_climb` and `ns_plunge`. Touching one sets that room's hazard-respawn point. It must
     pass the `world.cjs` validator.
   * **F05 Hazard Outline mode:** a high-contrast outline or pattern on hazard tiles and on
     hazardous attack hitboxes, readable without colour.
   * **F06 Retry flow:** boss intro cards are skippable after the first viewing. Lore cards
     close on confirm only, with a short ignore window, and never eat Pause or attack presses.
     Add a LORE ARCHIVE page in Pause.
   * **F07 Restore Echo tips:** after 2 deaths to the same boss, the next rest shows one short,
     original tip from 2–3 rotating tips per boss. It never blocks play.
   * Write `test/features.cjs` covering keyboard and emulated gamepad, with screenshots, and
     add it to `run-all.cjs` and `test/README.md`. Persist settings in `underbyte.settings` with
     safe defaults. Update `DESIGN-SUMMARY.md` and `CONTRACT.md`.
3. **Verify:** `run-all.cjs` green twice in a row with no play servers running. Frame-time
   checks fail under CPU load, so rerun a perf-only failure alone before believing it.
4. **Returning testers (after-clips).** Run three replays with the play server (the "How a
   tester plays" section of `playtests/README.md`):
   * **newcomer:** keyboard only, no debug, new game to Tallock.
   * **challenger:** godmode off; Tallock and Corrosant, Weftyr if time allows.
   * **access:** `--pad` only. Try every comfort setting and Rootwell contrast.

   Session dirs are `playtests/sessions/<id>-after-NN`, videos are
   `recordings/<id>-after-NN-<slug>.mp4`, and reports go in `reports/<id>-after.md`.
   Subagents may be refused when writing Markdown report files, so have them return the
   Markdown text and save it yourself.
5. **Docs:**
   * Write `underbyte/README.md`, which has never been written. Follow the style of
     `theater-of-the-undead/README.md`: what it is, how to run, the full keyboard + gamepad
     controls, fighters, zones and abilities, Overclock, settings and comfort options, the
     tests, the playtests folder, and links to the spec docs. Mention no other franchise.
   * Append "After the fixes" to `playtests/REPORT.md`: per-bug outcome (from
     `fix-results.json`), features delivered, final run-all lines, and before → after ratings.
6. **Pixel-art restyle**, following `ART-STYLE.md` exactly. Gameplay, physics and rooms stay
   unchanged. Do it in this order:
   1. **Pipeline and UI** (one agent; owns the render path in `engine.js`, plus `main.js`,
      `render.js`, `ui.js`, `fx.js` and a new `js/pixelfont.js`):
      * a 480×270 native canvas with nearest-neighbour upscale;
      * camera, sprite and particle positions snapped to whole pixels;
      * an original bitmap font, 9-slice pixel windows, HUD at half the DESIGN §12
        coordinates, and a pixel title logo;
      * zone tilesets (15 px) and dithered parallax backgrounds;
      * dithered fog and vignette, and pixel particles.
   2. **Then in parallel, on disjoint files:**
      * **Fighters** (`characters.js`): render each rig pose at native scale, quantise the
        animation to frames per the ART-STYLE §4 table, snap pixels to the fighter's palette
        (alpha threshold), add a 1 px outline in the darkest shade, and cache per
        fighter/palette/pose/frame (Overclock palettes pre-mixed). The select-screen preview
        uses the same frames.
      * **Enemies + bosses** (`enemies.js`, `bosses.js`): the same pipeline. Attack tells and
        hazards must stay readable; keep the B33 slam marker and B41 contrast fixes.
   3. **Review:**
      * Update tests that assert on pixel colours or vector-era coordinates. Change the
        expectation, not the behaviour, and record why.
      * Screenshot every screen, room, fighter, enemy and boss, and check each one by eye
        against ART-STYLE.md.
      * Record a 2–3 minute showcase clip with the play server
        (`recordings/restyle-01-<slug>.mp4`).
      * Run `run-all.cjs` green.
7. **Report to the user** in plain words, with links to the new recordings. Ask the open
   questions below.

## 4. Open questions for the user (asked, not yet answered)

* Add **remappable controls** and an optional **easier assist mode** next? (F08, F09 in the
  backlog)
* Add a **training room** or **boss rematches**? (F10, F12)
* When should the game go on the GitHub Pages site (homepage card + root README)?

## 5. Tooling notes and pitfalls

* **Play server:** `node underbyte/playtests/tools/play.cjs start <dir> [--pad]
  [--save <dir>/save.json] [--size WxH]`, then one JSON command per call. On quit it writes an
  mp4 to `playtests/recordings/` with the paused gaps cut out. The full guide is in
  `playtests/README.md`. It needs `ffmpeg` (present at `/usr/bin/ffmpeg`).
* **Tests:** `test/harness.cjs` launches headless Chromium from `file://`. In-page debug API:
  `UB.debug.pauseLogic(true)` + `step(n)` for exact frames, `pressed(action, n)`,
  `warp(room, exit)`, `grant(ability)`, `spawnEnemy`, `spawnBoss`, `defeatBoss`, `state()`
  (see `CONTRACT.md` §9).
* **Do not** use `pkill -f` with a pattern that also appears in your own shell command; it
  kills the shell. Select PIDs with `ps | grep -v grep` instead.
* Background subagents sometimes stop while "waiting on background work" that already
  finished. If one goes quiet for a long time with no test processes running, message it and
  ask it to report.
* `.gitignore` at the repo root ignores `*.webm`. Recordings are mp4 (about 6 KB/s, 13 MB so
  far). `playtests/.gitignore` drops transient session files.
