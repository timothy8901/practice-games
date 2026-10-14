# UNDERBYTE — automated tests

All tests are Playwright scripts that open `underbyte/index.html` from `file://` in
headless Chromium and drive the game through `window.UB.debug` (see `CONTRACT.md` §9).
`playwright` is installed globally and resolves via `require('playwright')`. Every script
prints one `PASS`/`FAIL` line per check, a summary line, any console/page errors it captured
(each suite's last check asserts that list is empty) and exits 0 only when everything passed.

## Run everything

```
node underbyte/test/run-all.cjs             # every suite, sequentially, with a final table
node underbyte/test/run-all.cjs smoke ui    # a subset (names without .cjs)
```

Run the suites sequentially (as `run-all.cjs` does): `ui.cjs`, `playthrough.cjs` and `qa-perf.cjs` contain
frame-time checks (< 8 ms with 500 particles, < 10 ms average in the busiest rooms, median < 8 ms per
room/arena) that measure real render cost and fail when several Chromium instances compete for the CPU.
The whole run takes a while (the QA lenses alone are ~10 minutes); a subset by name is often enough.

## The suites

| File | What it proves | Checks |
|---|---|---|
| `smoke.cjs` | Engine skeleton: boot, title → select → play by keyboard, run/jump/variable jump, tile collision, one-way platforms, placed bits, spikes + hazard respawn, enemy hits/kill/drops, room transitions, pause/map, death → game over → respawn, restore node + save, debug boss flow (intro, kill, ability pickup, seal), CONTINUE after reload, frozen-frame snapshots, hints, vendor, shop/lore overlays, debug spawns, projectile cap, corrupt-save sanitising, debug API surface | 90 |
| `verify-core.cjs` | Independent verification of the core: boot/globals, letterbox maths, keyboard-only flow (incl. the zone lore card), physics against the debug-room geometry (walls, dashes, ceilings, one-way, 600 frames of seeded random inputs), spikes, hitstop, death/respawn, save/reload/CONTINUE, the debug API, settings persistence, corrupt saves/settings | 75 + warn probes |
| `world.cjs` | World data (also runs in Node without a browser: `--static`): tilemaps byte-identical to `DESIGN.md` §6, 50 reciprocal exits, placements on air with footing, BFS progression tiers = DESIGN §10.5, backgrounds/props, the sweep of all 50 exits (bottom exits entered the real way), movers, crumble, pools, vendors, nodes, cores + bits, map overlay, 6 room screenshots | 123 |
| `characters.cjs` | All five fighters: pinned jump apexes, variable jump, light chain, heavy, special (energy cost + deny), air attack, down-strike + pogo, Burst Line, Echo Jump, Overclock + ultimate, per-fighter specials, composite screenshots | 113 |
| `enemies.cjs` | Every enemy type + variant (behaviour, never inside tiles, projectiles, motes, shields, drops) and the four bosses (attacks, enrage roars, Kernauth phase change inside `takeHit`, Panic Loop, defeat rewards, victory) with screenshots | 220 |
| `audio.cjs` | Web Audio engine: no-gesture safety, every SFX recipe and song, loops, ambient layers, volumes/mute/duck, offline renders of recipes and songs (peak levels), soak | 58 |
| `ui.cjs` | Every screen and overlay by keyboard and a fake gamepad: title (CONTINUE/overwrite), select, HUD, pause, map, settings (persist), shop, lore, game over, victory, FX presets, 500-particle timing, screenshots | 70 |
| `playthrough.cjs` | **The end-to-end proof**: NEW GAME → Tessik → rest at the first node → die to the tutorial scuttlebit → game over → respawn (full hp, enemies back) → the DESIGN §10.3 critical path room by room with **real inputs** (a traversal bot holding the direction key and jumping from what the tilemap shows; `UB.debug.warp` only across the long descents/climbs) → vendor purchase → Tallock → ECHO JUMP (double jump verified) → core 1 (+1 heart) → save, reload, CONTINUE → map → Weftyr → BURST LINE (dash verified) → Corrosant → GRIP PROTOCOL (wall jump verified, the unlocked hatch) → Rootwell gauntlet → Kernauth both phases → victory screen with stats; ≥ 6 rooms crossed with real inputs, ≥ 4 natural exit transitions, frame time < 10 ms average (`UB.debug.bench`), no console errors | 63 |
| `critic-complete.cjs` | Completeness critic: globals leak, the CONTINUE sub-line, the select-screen pose cycle, every fighter's Overclock form + ultimate cost, feel triggers on a hit, Deep Ping map, victory stats, continue-after-victory, settings keys (screenshots `critic-*.png`) | 21 |
| `qa-progression.cjs` | QA lens PROGRESSION & SOFTLOCKS: the whole game with real inputs tier by tier (every gate proven blocked without its ability and passed with it), every node/CONTINUE, the three cores, the softlock hunt (chute-arrival hazard respawns, the lw_hoist pools, the bv_catwalk pocket, lw_shaft, ns_climb, dc_fall spikes, the two-way bv_sluice, the chute launch vs. a key release, the lw_rest/ns_rest hatches), every exit arrival, crumble tiles; round 2: the DESIGN §10.3 ns_climb routes (shaft-1 doorway, the wall-jump slot, the spine single-face climb per fighter), the dc_loft chute relaunch, bv_cistern.T at tier 2 | 100 |
| `qa-combat.cjs` | QA lens COMBAT PER FIGHTER: DATA = the §4.2 sheets, whiff frame data, every move damages a target for its sheet value, cancel windows and buffers (a denied special never cancels a light, no air attack while clinging), the specials and ultimates of all five (Pulse Line, Vault Stomp, Blink Strike, Sentry Pin/Triad, Ring Toss incl. the off-room cull, Bulwark Catch, Clamp Press), Overclock, hurt/hazard numbers (puddle knockback straight up), Burst Line, Echo Jump, coyote + wall-coyote, pogo onto enemies from five heights, L1 vs. an 18 px scuttlebit in dc_wake | 753 |
| `qa-enemies.cjs` | QA lens ENEMIES & BOSSES in the real rooms: every room's roster = DESIGN §6, 1200 f soaks (never embedded/outside/NaN, crumble tiles never close onto an enemy), every state machine's timings (droplatches land on the first footing, grates included), projectiles hurt the player (god off), drops; the four bosses in their arenas (geometry, every attack and tell ≥ 20 f, enrage changes, Flood as a hazard, Kernauth's phase change, core band and Panic Loop, Corrosant's head ×1.5 over segment 0, the Snare Line on the floor, death, rewards, re-entry), the Tallock fairness bots and the cornered Slab Swing | 386 |
| `qa-ui.cjs` | QA lens UI, SAVE, CONTROLS, TEXT: the static text audit against DESIGN §15, title/select/HUD/pause/map/settings/shop/lore/game over/victory by keyboard and a fake gamepad (incl. the pause → confirm-key → resume buffer rule, settings sanitising, the gamepad toasts, toasts on the title screen, the boss card surviving a pause, the map footer fit), save slot corruption | 272 |
| `qa-perf.cjs` | QA lens PERFORMANCE & VISUAL QUALITY: frame cost in the busiest rooms and arenas (median < 8 ms, p99 < 25 ms), heap growth and per-frame allocation, projectile/particle/hit caps under spam, feel triggers, every room through every exit renders in its zone palette (the HUD dims when the arrival stands behind it), every overlay draws, the map footer fit, letterbox geometry, DPR 2 (backing, tile cache, frame cost ≤ 4.5× DPR 1). Launches its own Chromium with `--expose-gc`; measure it alone | 85 |
| `qa-ip-code.cjs` | QA lens ORIGINALITY & CODE QUALITY: no franchise term anywhere, 'use strict' + one IIFE per file, no network/asset files, index.html shape, README ↔ run-all, the only global is UB, file:// resource audit, letterbox at four sizes, fighter/enemy/boss render sheets, death/boss-death flows (music, projectiles, bookkeeping), a state-leak matrix across screens, collision edges, a locked exit, the Overclock shove (0 damage on bosses), a pause opened during the hazard fade, a 3-minute scripted session (no NaN, no warnings), an http.server run; `--run-all` also runs run-all.cjs and checks the README counts | 63 |

Screenshots land in `test/shots/` (`pt-*.png` from the playthrough, `ui-*.png`, `room-*.png`,
`enemy-*.png`, `boss-*.png`, `characters-*.png`, `1-select.png`, `critic-*.png`, `qa-*.png` … from the others).

The `qa-*.cjs` suites are the QA round-1 lens probes (one per tester lens). They run last in
`run-all.cjs`; `qa-perf.cjs` and the frame-time checks of `ui.cjs` / `playthrough.cjs` are the
environment-sensitive ones — re-measure alone before treating a timing failure as real.

## How the tests drive the game

* `UB.debug.pauseLogic(true)` stops the render loop from ticking logic; the test then calls
  `UB.debug.step(n)` to advance exactly `n` logic frames (60 Hz, deterministic — logic never
  reads wall-clock time).
* `UB.debug.pressed(action, frames)` holds an input action for `frames` logic frames without a
  keyboard; `page.keyboard` events also work (they are latched on the next `step`). The
  playthrough's traversal bot presses the real `left`/`right`/`jump`/`down` actions every frame.
* `UB.debug.state()` returns a snapshot (screen, room, position, hp, energy, meter, abilities,
  bits, boss, mode flags…). `warp(room, exitId | {x,y} | null)` (an exit id arrives the way play
  would: chute launch for a bottom exit), `teleport`, `grant`, `setHp`, `god`, `killEnemies`,
  `defeatBoss` etc. set up situations directly. `spawnEnemy(type, tx, ty, opts)`,
  `spawnBoss(bossId, {fight})` and `fx(type, x, y, opts)` place enemies, bosses and effects in
  the current room so a module can be tested without world data; `buy(itemId)` exercises the
  vendor; `skipTo('shop'|'lore')` opens those overlays. `state().screen` is the overlay name
  while one is open (`baseScreen` is the screen underneath). `bench(n)` times `n` ticks +
  renders (ms averages/maxima) — presentation only, the logic never sees the clock.
* NEW GAME starts in `dc_wake` (the real world). The engine-geometry tests warp to the three
  `debug_*` rooms (`debug_room`, `debug_room2`, `debug_boss`), which stay byte-identical and are
  unreachable in normal play.
* `UB.World.validate()` (also `UB.debug.worldErrors()`) runs at boot; every problem is a
  `console.warn('[UB world] …')` line. The harness does not treat warnings as errors, but
  the world test asserts the array is empty.
* `test/harness.cjs` is the shared launcher: `const { launch } = require('./harness.cjs')`
  returns `{ browser, page, errors, logs, tap, hold, shot, close }`.

## Adding a test

Copy `smoke.cjs`, keep the `check()` / `PASS`-`FAIL` reporting and the final
`no console errors` assertion, exit with code 1 on any failure, and add the file name to the
`SUITES` list in `run-all.cjs`.
