# UNDERBYTE — automated tests

All tests are Playwright scripts that open `underbyte/index.html` from `file://` in
headless Chromium and drive the game through `window.UB.debug` (see `CONTRACT.md` §9).
`playwright` is installed globally and resolves via `require('playwright')`.

## Run

```
node underbyte/test/smoke.cjs
```

Exit code 0 = every check passed. The script prints one `PASS`/`FAIL` line per check,
a summary line, and any console errors / page errors it captured (the last check asserts
that list is empty).

## How the tests drive the game

* `UB.debug.pauseLogic(true)` stops the render loop from ticking logic; the test then calls
  `UB.debug.step(n)` to advance exactly `n` logic frames (60 Hz, deterministic — logic never
  reads wall-clock time).
* `UB.debug.pressed(action, frames)` holds an input action for `frames` logic frames without a
  keyboard; `page.keyboard` events also work (they are latched on the next `step`).
* `UB.debug.state()` returns a snapshot (screen, room, position, hp, energy, meter, abilities,
  bits, boss, mode flags…). `warp`, `teleport`, `grant`, `setHp`, `god`, `killEnemies`,
  `defeatBoss` etc. set up situations directly.
* `test/harness.cjs` is the shared launcher: `const { launch } = require('./harness.cjs')`
  returns `{ browser, page, errors, logs, tap, hold, shot, close }`.

## Adding a test

Copy `smoke.cjs`, keep the `check()` / `PASS`-`FAIL` reporting and the final
`no console errors` assertion, and exit with code 1 on any failure.
