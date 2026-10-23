# Checkpoint 0 — Day 1 integration (ARCHITECTURE-DRAFT §13.1)

Status: **reached.** The game boots to the title with zero console errors. `tools/check.sh` is green
(validate-data 0 errors, lint-owners 0 problems, smoke-import 93/93 modules, 2144 unit tests in 71 files,
0 failures). `?skipTitle=1` lands on a walkable map, and `window.__game` exists. `js/_shims/` is deleted, and
every import points at a real module.

## 1. What exists

| Area | Files | State |
| --- | --- | --- |
| Shell [BOOT] | `index.html`, `css/style.css`, `js/main.js`, `js/config.js`, `serve.py`, `README.md` | §2.1–2.4 as drafted: fixed-step loop, low-power watch, pause-on-blur, crash marker, debug install |
| Debug [BOOT] | `js/debug/flags.js`, `js/debug/hook.js`, `js/scenes/debugOverlay.js` | `parseFlags`; the `__game` hook (§11); the perf overlay |
| Scenes [SCN-*] | `js/scenes/index.js`, plus every scene in the manifest | `boot`, `title`, `menu` and the `overworld` stub work. The other 20 scenes are stubs that draw their name and pop on `cancel` (`stub.js`). `day1kit.js` is the paper panel and focus list the scenes use until they adopt `ui/*` |
| Core [CORE] | `js/core/*` (12 modules, incl. `fx.js`, `time.js`) | Frozen and tested. Still missing: `time.freezeTide`, `time.setMinutesPerDay` (§13.6) |
| State [STATE] | `js/state/{schema,store,migrate,rngs,persist,selectors}.js`, `js/systems/{flags,stats,settings}.js` | Complete per §3, §9, §10, with fixtures `test/fixtures/v0.json`, `v1.json` |
| Data [DATA-IDX] | `js/data/{index,registry,ids,tuning,strings,credits}.js`, `js/data/placeholder/*` | `DATA` is deep-frozen. Placeholder tables exercise every validator rule (2 maps, 1 family of 3 forms, 6 moves, 1 NPC, 1 letter, 1 trainer, 1 shop, 3 dials) |
| Script [SCRIPT] | `js/script/{ops,cond,runner,registry}.js` | §6 interpreter, condition DSL, `resolveScript` priority |
| Time [SYS-TIME] | `js/systems/clockSys.js` (**day-1 version, written at integration**) | `optionsFrom`, `tick` (emits `clock:minute/hour/phase`, `tide:change`, `day:end/start`), `serializeInto`, `restoreFrom`, `setTime`, `applySettingsEffects`. 9 tests |
| Audio [AUDIO] | `js/audio/director.js` (**day-1 version, written at integration**) | `createMusicDirector(G)` records scene changes and bus events but plays nothing yet. 2 tests |
| Tools [TOOLS] | `tools/{check.sh,validate-data.mjs,lint-owners.mjs,smoke-import.mjs,pw-harness.mjs}` | Green |
| Landed early (Tier 1, in progress elsewhere) | `js/ui/*`, `js/world/*` with tests | Imported by nothing in the boot path yet. Covered by check.sh |

## 2. How to run

    cd /home/user/practice-games && python3 -m http.server 8777 --bind 127.0.0.1 &
    # play:   http://127.0.0.1:8777/_merge-wip/index.html
    # debug:  http://127.0.0.1:8777/_merge-wip/index.html?debug=1&skipTitle=1&seed=TEST-0000-0000
    #         (+ &strict=1 store write guard, &speed=8, &mute=1, &noanim=1, &scale=fit)
    bash _merge-wip/tools/check.sh                  # the gate: validate + lint + smoke + every test
    node --test _merge-wip/test/*.test.mjs          # all tests in one run (Node 22 rejects a bare dir)
    node _merge-wip/tools/pw-harness.mjs '<url>' <outdir> [script.json]   # headless, reports console errors

Verified headless at this checkpoint (screenshots inspected):
- The title renders (Continue / New Game / Seed / Dial ◀ Drift ▶). New Game leads to the overworld. 0 errors.
- With `?debug=1&skipTitle=1&seed=TEST-0000-0000` the player spawns at (20,12). Holding → moves to x=24, `stats.steps=4`, and the HUD clock and tide read from `G.clock`.
- Escape opens the menu. Each item (Party, Bag, Field Log, Map, Ledger, Settings, Save) pushes its stub, and Escape returns to the menu. A second Escape returns to the overworld.
- The other 13 stubs (`leaseCard` … `credits`) each push and cancel back to `overworld`.
- `__game.save()` writes `ok:true`. After a warp, `__game.load(slot)` restores the position and clock, and `__game.validate()` returns `[]`.
- With `?strict=1&speed=8`: `setTime` fires `clock:hour`, `flag` goes through `systems/flags`, and saving works. 0 errors.

## 3. How each Tier-1 lane plugs in next (§13.2)

The rule for every lane: own your files, take your interface from the draft's JSDoc, add one line to the relevant `index.js`, and keep `check.sh` green.

- **DATA-BATTLE / DATA-SPECIES / DATA-ECON / DATA-CAST / DATA-THREADS / DATA-LETTERS / DATA-SCRIPTS /
  DATA-MAPS / DATA-GATHER.** Write the manifest file, for example `js/data/items.js` or `js/data/maps/<map>.js` with its `index.js`. Then in `js/data/index.js`, swap the matching `./placeholder/*.js` import for it, keep the table name, and run `node tools/validate-data.mjs`. DATA-ECON's `js/data/dials.js` replaces `placeholder/town.js`'s `DIALS/CHALLENGES/TOGGLE_ORDER`. `main.js` reads `TOGGLE_ORDER` from `data/index.js`, and the title reads dials through `G.data.list('dials')`, so neither changes.
- **SYS-TIME.** Takes over `js/systems/clockSys.js` and keeps its exports. It then adds `systems/weather.js`. Once CORE ships `setMinutesPerDay`, `applySettingsEffects` applies day-length changes, which it reports as `pending` today.
- **AUDIO.** Replaces the body of `js/audio/director.js`: bus → `audio.playMusic/setStem` via `audio/tracks`. Keep `createMusicDirector(G)`, `onSceneChange` and `destroy`, which `main.js` calls. Add `audio/tracks/*` and `sfxMap.js`.
- **UI-KIT.** `ui/toast.js` is live: `main.js` shows `toast` bus events, and `save:fail` uses `kind:'danger'`. Scenes switch from `scenes/day1kit.js` to `ui/{panel,list,focus,textbox}`. Delete `day1kit.js` when the last import goes.
- **UI-HUD.** `drawHud(ctx, G, …)` replaces the overworld stub's HUD strip.
- **WORLD-MAP / WORLD-ENT / RENDER / SCN-WORLD.** Replace `js/scenes/overworld.js` wholesale: `world/tilemap` + `world/player` + `render/mapRenderer` + `ui/hud`. Keep the two contracts the stub honours. First, call `clockSys.tick(w, G.clock, dt, {bus: G.bus})` and `stats.addPlayMs` inside `store.tx` in `update`. Second, emit `map:enter`/`map:exit`. Player position writes must move into `world/player.js` / `world/warps.js`, which own `world.player` under lint-owners.
- **ART-*.** Add `js/art/*`. The validator's sprite rules start running as soon as `art/creatures` exists, which also clears the current warning.
- **BATTLE-RULES.** Port `proto/battle/engine.js` → `js/battle/*` per §5.1, with Node tests. It touches no boot file.
- **RULES-ECON.** Add `systems/bag.js` and `systems/wallet.js`, then call `__game.bind('give', …)` and `__game.bind('earn', …)`, or change `debug/hook.js` to import them. Then delete the lint-owners `EXCEPTIONS` entry for `debug/hook.js` → `wallet`, which is the only remaining entry.
- **RULES-CREATURE / RULES-SHIFT / SYS-TOWN / FLOW / SCRIPT host scenes.** Bind their `__game` hooks (`addCreature heal battle wild forceForecast deliverLetter sleep runScript`). Until they do, those hooks throw "not wired yet (owner: …)".

## 4. Interface reconciliations made at this checkpoint

1. **`js/_shims/` deleted.** Imports now point at `data/index.js` (`DATA`, `TOGGLE_ORDER`), `data/registry.js`, `ui/toast.js`, `systems/clockSys.js` and `audio/director.js`. `DIALS.default` became `state/schema.DEFAULT_DIAL` (`// [GDD]`). The title takes dials from `G.data.list('dials')`.
2. **`persist` now takes `G` itself, as §10 specifies.** Before, BOOT had to pass a `persistView` adapter, because `state/persist` called `scenes.isTransitioning()` and `scenes.has(name)`. The core JSDoc wins: `isTransitioning` is a getter, and `has` takes a scene object. Persist now uses `sceneTransitioning(scenes)` and `sceneOnStack(scenes, name)`, which accept the getter or `find(name)` and still work with function-style test doubles. A new persist test runs the real `core/scene` stack. `G.persistView` and `makePersistView` are gone.
3. **`systems/settings.update` no longer writes `world.clock`.** That key belongs to clockSys. The `clock.realClock` effect it already returned is now performed by `clockSys.applySettingsEffects`. The lint-owners exception for it is removed, and the settings test was updated.
4. **Debug hook writes go through the owning systems.** `__game.setTime` → `clockSys.setTime`, and `__game.flag` → `systems/flags.setFlag`, which emits `flag:set` and now requires a namespaced id. `__game.save()` passes `G`.
5. **Toasts:** `main.js` calls the real `show(text, {kind, icon, ms})`, and `save:fail` uses `kind:'danger'` instead of the shim's `color`.

## 5. Open deviations from the draft

- `js/systems/clockSys.js` and `js/audio/director.js` were written by the integrator so the shims could go. They are day-1 versions at the manifest paths, and their lanes own them from here.
- `__game.give` and `__game.earn` are day-1 fallbacks that write `world.bag`/`world.wallet` inside `store.tx`. This is the one listed lint exception, and it waits on RULES-ECON.
- `__game.warp` and the overworld stub write `world.player` directly through a `w` alias. Lint only sees `world.` writes, so it does not catch this. The real overworld (SCN-WORLD / WORLD-ENT) must route these writes through `world/player`/`world/warps`.
- `__game.setTide` throws a readable error, and `applySettingsEffects` reports a day-length change as `pending`. Both wait on CORE `time.freezeTide` / `time.setMinutesPerDay` (§13.6).
- `__game.load(slot)` replaces the world but leaves the scene stack as it is.
- The default lease leaves `player.mapId === ''`, because there is no maps table yet (`[GDD]` arrival map). The overworld stub spawns at (20,12), shows `stub-map`, and emits `map:enter` with `mapId ''`.
- `FEATURES.leaseCard` is false, so New Game uses `boot.DEFAULT_LEASE` (`Keeper`, `// [GDD]`).
- The draft's `check.sh` line `node --test test/` fails on Node 22. `tools/check.sh` runs the test files one at a time, and it also covers `proto/battle/test/*`.
- The state lane differs from the draft in four places, all recorded in that lane's report: `MIGRATIONS` is keyed `{0: migrate0to1}`, `migrateWorld` returns a result object, `createNewWorld` takes an injected `worldgen`, and the `battle:start:story` trigger is implemented as `battle:start` with `{kind:'story'}`.
- `G` carries fields beyond §2.2: `perf`, `loop`, `debugOverlay`, and `debugHook` in debug builds.
- `index.html` adds `<link rel="icon" href="data:,">` so the console shows no favicon 404.
- On localhost the debug hook and overlay install without `?debug=1`, as §11 states.
- `tools/lint-owners.mjs` and `tools/smoke-import.mjs` still classify `_shims/<dir>/x.js` paths, which is harmless. TOOLS may drop that code now that the folder is gone.
