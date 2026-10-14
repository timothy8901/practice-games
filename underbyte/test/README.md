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

Run the suites sequentially (as `run-all.cjs` does): `ui.cjs` and `playthrough.cjs` contain
frame-time checks (< 8 ms with 500 particles, < 10 ms average in the busiest rooms) that
measure real render cost and fail when several Chromium instances compete for the CPU.

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

Screenshots land in `test/shots/` (`pt-*.png` from the playthrough, `ui-*.png`, `room-*.png`,
`enemy-*.png`, `boss-*.png`, `characters-*.png`, `1-select.png` … from the others).

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
