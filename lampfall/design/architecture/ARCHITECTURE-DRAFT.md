# ARCHITECTURE (authoritative draft) — the merged WILDSHIFT × PORCHLIGHT browser game

> **As built (2026-10-28).** The game shipped from this draft. §16 records where the code now differs (save format v7, autosave rules, stamps, condition semantics, signatures). Where §1–§15 and §16 disagree, §16 and the module JSDoc win.

Principal engineer's synthesis of proposal A ("fewest moving parts") and proposal B ("data-driven
extensibility"). Every "either/or" is resolved here. Where this document and a proposal disagree, this
document wins. Where this document and the shipped code in `_merge-wip/js/core/` disagree, the code's
JSDoc wins and this document must be corrected (file an issue against the `[CORE]` lane).

Grounding (verified against the files on disk, 2026-10-23):

- `js/core/` ships `rng, events, font, pixelart, canvas, input, audio, save, scene, tween`. **`fx.js` and
  `time.js` are not on disk yet**; they are designed against `docs-core-contract.md` plus the three
  additions named in §13.6.
- `core/audio.js` **already exports `createAudio()` and the `audio` singleton with the full contract API**
  (`unlock, ready, setVolume, getVolume, mute, isMuted, sfx, defineTrack, hasTrack, playMusic, stopMusic,
  setStem, getStems, setMusicParam, nowPlaying, analyser, renderSfx, renderTrack`). Both proposals' "audio
  adapter" item is void; `js/audio/director.js` calls the engine directly.
- `core/input.js` exposes `heldFor(action)` (so the tool-ring hold needs no timer) and has no `inject()`
  seam; keyboard tokens are `KeyboardEvent.code`, so the debug hook synthesizes real `KeyboardEvent`s on
  `window`. No core change.
- `core/scene.js` has `find`, `has`, `updateBelow`, `onChange`, `isTransitioning`; `core/save.js` has
  `migrations`, `summarize`, `now`, `createMemoryStorage`, `exportString/importString`; `Rng.fork(label)` is
  derived from seed + label (stable), `state()/restore()` are 4 uint32s.
- `proto/battle/engine.js` is a working singles engine class (`createBattle(opts)`, `availableActions(side)`,
  `submit(actions)`, `result()`, `read(side)`, `setCaptureStance(on)`, `state()`), with
  `proto/battle/{types,moves,abilities,species,creature}.js` as its data. `proto/creatures/sprites.js`
  holds 22 forms keyed by display name. `proto/tiles/{tiles,render}.js` light the world by **palette-LUT
  grading per hour** (crisp, on-palette), not by a multiply overlay. `proto/music/tracks.js` holds 8
  day-part themes + 12 scene tracks with `CUES` and a `toEngine()` adapter.

Content-agnostic: no file below names a species, map, NPC, letter or tuned number. Content is data,
validated by `tools/validate-data.mjs`; systems operate on ids. Places that must wait on the design panel are
tagged **[GDD]** and collected in §15.

Five rules, enforced by tooling, not by memory:

1. **One world object.** All mutable game state lives in one JSON-serializable `world` (§3). Systems mutate
   it only through exported functions in their own module, shaped `fn(world, ...args) -> Result`, with
   `rng`, `data` and `clock` passed explicitly. Scenes call `G.store.tx(label, w => system.fn(w, ...))`.
   `tools/lint-owners.mjs` fails CI on `world.<key>` writes outside the owning module.
2. **Pure core, impure shell.** `js/data js/state js/battle js/world js/systems js/script` import no DOM
   and run under `node --test`. Only `js/scenes js/ui js/render js/audio js/debug main.js` touch canvas,
   window or WebAudio. `tools/smoke-import.mjs` imports every module under Node to prove it.
3. **Content is data; behaviour is a registry lookup.** Species, moves, items, maps, NPCs, schedules, shops,
   letters, trainers, encounter tables, scripts, collections, loans, dials, tracks: frozen tables with
   kebab-case string ids. Behaviour that varies per row (ability hooks, item use, tile verbs, move effects)
   is named by a string key resolved in a handler registry inside the owning system.
4. **Conditions and scripts are interpreted.** One condition DSL (§6.4) and one op-array script format (§6.1)
   express every gate, dialogue, cutscene, thread beat and letter reveal. Both run in Node with a fake host.
5. **Randomness is forked by label; never `Math.random`.** Every random decision draws from a named fork of
   the run seed (§9). Same seed + same choices = same Forecasts, encounters, weather, shop stock.

---

## 1. Folder layout and file manifest

Deliverable folder: `/home/user/practice-games/<title>/` **[GDD: folder name = the panel's title,
kebab-case]**; until then the skeleton grows in `_merge-wip/` and is moved with `git mv` (all imports are
relative, nothing breaks). Convention per theater-of-the-undead: `index.html`, `css/`, `js/`, `README.md`,
`serve.py`.

Every file carries an owner lane in brackets. A lane owns the contents of its files; cross-lane needs go
through the JSDoc interfaces in this document, never by editing another lane's file. `*/index.js` files are
append-only (one line per entry, alphabetical) and are the only shared touch points. Files marked **(day 1)**
exist as working stubs before anyone else starts (§13).

```
index.html                         [BOOT] (day 1) #stage canvas host, #touch overlay mount, <noscript>, one module script
css/style.css                      [BOOT] (day 1) black letterbox, crisp canvas, touch button chrome, prefers-reduced-motion hook
README.md                          [BOOT] run, controls, debug flags, tests, authoring guide (§14 copied in)
serve.py                           [BOOT] zero-dep static server (python) for local play
js/main.js                         [BOOT] (day 1) boot, URL flags, fixed-step loop, G context, pause-on-blur, debug install
js/config.js                       [BOOT] (day 1) NATIVE_W/H, TILE, TICK_MS, VERSION, FEATURES flags; no game numbers

js/core/                           [CORE] frozen API; bug fixes only
  rng.js events.js font.js pixelart.js canvas.js input.js audio.js save.js scene.js tween.js   (exist)
  fx.js                            [CORE] createFX per contract + setBudget(f) (§13.6)
  time.js                          [CORE] createClock per contract + setMinutesPerDay(n), freezeTide(x|null) (§13.6)

js/state/schema.js                 [STATE] (day 1) JSDoc typedefs for World and every sub-record; SCHEMA_VERSION; createNewWorld; validateWorld
js/state/store.js                  [STATE] (day 1) createStore(world): tx, bus, dirty, derived side-table, snapshot, replace
js/state/migrate.js                [STATE] MIGRATIONS {fromVersion: fn}; migrateWorld(data)
js/state/rngs.js                   [STATE] named fork registry: stream(world,label), dayFork, commit(world) (§9)
js/state/persist.js                [STATE] (day 1) wraps core/save: autosave triggers table, crash marker, export/import, summarize
js/state/selectors.js              [STATE] pure read helpers: curveLevel, partyAlive, loanTier, hasBadge, hour, tideState

js/data/index.js                   [DATA-IDX] (day 1) DATA = {types, moves, abilities, species, families, items, ...}; the only file importing every table
js/data/registry.js                [DATA-IDX] createRegistry(DATA): get(table,id) with readable errors, has, list, byId indexes
js/data/ids.js                     [DATA-IDX] ID_RE = /^[a-z0-9][a-z0-9-]*$/, index(list), assertId
js/data/tuning.js                  [DATA-IDX] every designer-tuned number, by name (caps, shares, costs, rates)  [GDD values]
js/data/strings.js                 [DATA-IDX] UI strings and templates: t('loan.paid', {n})
js/data/types.js                   [DATA-BATTLE] from proto/battle/types.js (PALETTE removed; see §8.4)
js/data/moves/index.js             [DATA-BATTLE] MOVES, MOVE_LIST, getMove, SCRAP, isDamaging, isSureHit, isChipMove, movesOfType
js/data/moves/<type>.js            [DATA-BATTLE] one file per type (plain.js, grit.js, ... star.js, typeless.js), each exports Move[]
js/data/abilities.js               [DATA-BATTLE] ABILITIES {id, name, text, ward?, hook, expShare?, glint?}; hook = key into battle/abilityHooks.js
js/data/species/index.js           [DATA-SPECIES] SPECIES by id, SPECIES_LIST, FAMILIES by id, getSpecies, expForLevel, levelFromExp
js/data/species/<family>.js        [DATA-SPECIES] one file per Shift family: its forms + the family's Shift table
js/data/items.js                   [DATA-ECON] ITEMS {id, name, pocket, price, sell, stack, use, oneOfAKind, text}
js/data/loans.js                   [DATA-ECON] LOANS tiers [{tier, amount, build, roofChoices, scaffoldStage, commissionSlot}]  [GDD values]
js/data/shops.js                   [DATA-ECON] SHOPS {id, keeper, hours, stock, buys, priceMult}
js/data/dials.js                   [DATA-ECON] DIALS {drift, flux, freefall} rule tables; CHALLENGES; TOGGLE_ORDER (append-only)
js/data/trainers.js                [DATA-CAST] TRAINERS {id, name, title, class, portrait, party, items, ai, payout, scripts}
js/data/npcs/index.js              [DATA-CAST] NPCS by id
js/data/npcs/<npc>.js              [DATA-CAST] one file per neighbor / named character (def + schedule + topics + lines)
js/data/schedules.js               [DATA-CAST] shared schedule templates (shopkeeper, fisher, nightOwl) + named paths
js/data/threads/index.js           [DATA-THREADS] THREADS by id
js/data/threads/<thread>.js        [DATA-THREADS] one life thread per file
js/data/letters/index.js           [DATA-LETTERS] LETTERS ordered array (n contiguous from 1)
js/data/letters/<chapter>.js       [DATA-LETTERS] chapters of letters
js/data/scripts/index.js           [DATA-SCRIPTS] SCRIPTS by id; EVENT_SCRIPTS (bus event -> script id)
js/data/scripts/<chapter>.js       [DATA-SCRIPTS] one file per chapter / NPC; exports {scriptId: Op[]}
js/data/maps/index.js              [DATA-MAPS] MAPS by id  [GDD: exact map list]
js/data/maps/<map>.js              [DATA-MAPS] one map per file (ASCII layers)
js/data/tilesets.js                [DATA-MAPS] TILES {id -> {art, solid, water, tide, verb, sfx, anim, glow}}; DEFAULT_LEGEND
js/data/encounters.js              [DATA-MAPS] ENCOUNTERS {tableId: Row[]}
js/data/collections.js             [DATA-GATHER] FISH, BUGS, RELICS, FRUIT tables
js/data/credits.js                 [DATA-IDX] credits roll lines

js/script/ops.js                   [SCRIPT] OPS schema table (name -> field schema, pure|host); parseShorthand
js/script/cond.js                  [SCRIPT] evalCond(world, cond, ctx), COND_KEYS
js/script/runner.js                [SCRIPT] createRunner(ops, ctx) coroutine; interpolate(text, ctx)
js/script/registry.js              [SCRIPT] resolveScript(world, data, target) -> {scriptId, source}; topic priority rules

js/systems/clockSys.js             [SYS-TIME] tick(world, clock, ms) -> ClockEvents; serializeInto/restoreFrom world.clock; phase/tide/day events
js/systems/weather.js              [SYS-TIME] rollDay(world, data, rng), current(world) -> WeatherState
js/systems/creature.js             [RULES-CREATURE] from proto/battle/creature.js: makeCreature, computeStats, gainExp, learnMove, shiftTo, healFull...
js/systems/party.js                [RULES-CREATURE] addCreature, nextUid, swap, toBox/fromBox, heal, nickname, pinHeartmark, applyOutcome
js/systems/exp.js                  [RULES-CREATURE] award split (bench/yard/catch-up/damping), level thresholds, window detection
js/systems/forecast.js             [RULES-SHIFT] rollForecast, flip, applyShift, anchor, rerollCost, odds per dial
js/systems/capture.js              [RULES-CAPTURE] captureOdds(dial), band, attemptCapture(rng) (thin over battle/engine helpers)
js/systems/bag.js                  [RULES-ECON] give/take/count/has, pockets, stack limits, overflow basket, one-of-a-kind flag
js/systems/wallet.js               [RULES-ECON] earn/spend/canAfford, starsalt, anchors, purse deposits
js/systems/loans.js                [RULES-ECON] pay, tierUp, chooseCommission, overnight build queue, scaffold stage, resident shares
js/systems/shops.js                [RULES-ECON] stockFor(shop, day, rng), buy, sell, wantedToday, isOpen, diminishing returns
js/systems/flags.js                [STATE] setFlag/getFlag/inc/get counters
js/systems/letters.js              [SYS-TOWN] deliverMorning, markRead, nextLetter, reveal hooks
js/systems/schedule.js             [SYS-TOWN] whereIs(npc, world, data) -> Placement; entryAt(npc, minute, world)
js/systems/memory.js               [SYS-TOWN] neighbor memory: remember, lastTalked, saidLine (no-repeat window), nickname, favours
js/systems/threads.js              [SYS-TOWN] eligibleBeats, advance, beatTopics (topics injected into NPCs), reward/share
js/systems/dayPage.js              [SYS-TOWN] overnight(world, data, rng): builds, regrowth, reach recovery, letter queue, Day Page summary
js/systems/fishing.js              [SYS-GATHER] pure state machine: cast -> shadow -> feints -> bite window -> land/release; reach health; tells
js/systems/gather.js               [SYS-GATHER] shakeTree, dig, net, dailyCracks, glint position, regrow timers
js/systems/fieldLog.js             [SYS-GATHER] markSeen/Read/Held, collections registry (fish/bugs/relics), completion %
js/systems/encounter.js            [SYS-WORLD] rollStep(world, map, rng, ctx) -> EncounterResult|null; roamer spawns
js/systems/stats.js                [STATE] inc/set counters; playMs
js/systems/settings.js             [STATE] defaults, apply(world.settings) -> side effects list; localStorage mirror key
js/systems/flow/battleFlow.js      [FLOW] startBattle(G, setup) / applyBattleResult(G, result) glue (§5.5)
js/systems/flow/dayFlow.js         [FLOW] rest/sleep -> dayPage -> morning glue; pending Forecasts at Waystone/door
js/systems/flow/interactFlow.js    [FLOW] doInteraction(G, action): the only place overworld verbs push scenes
js/systems/flow/eventScripts.js    [FLOW] bus event -> world.pendingScript via data/scripts EVENT_SCRIPTS

js/battle/engine.js                [BATTLE-RULES] from proto/battle/engine.js (changes in §5.1); Battle class, createBattle
js/battle/effects.js               [BATTLE-RULES] EFFECT_KEYS (the vocabulary engine.js implements) + extracted pure effect helpers
js/battle/abilityHooks.js          [BATTLE-RULES] HOOKS {key: AbilityHooks}; getAbilityRuntime(id) merges data + hooks
js/battle/ai.js                    [BATTLE-RULES] foeAi(battle, side) profiles: 'wild' | 'trainer' | 'spire' | 'summit'
js/battle/read.js                  [BATTLE-RULES] readCard / dossier per dial (moved out of engine for the UI)
js/battle/events.js                [BATTLE-RULES] EVENT_TYPES list + typedefs (the contract scenes/battle.js animates)

js/world/tilemap.js                [WORLD-MAP] loadMap(def, data) -> RuntimeMap; passable; tileAt; triggersAt; warpAt; regions; autotile
js/world/tide.js                   [WORLD-MAP] tideVariant(tide) ; nearestDry(map, x, y); flooded(map, x, y, tide)
js/world/camera.js                 [WORLD-MAP] createCamera; follow, bounds, shake offset, visibleTiles
js/world/pathing.js                [WORLD-ENT] BFS on passable grid with tide; LRU path cache
js/world/entities.js               [WORLD-ENT] EntityManager: list, grid, add/remove, at, near, tryMove, tickMovement, ySorted
js/world/player.js                 [WORLD-ENT] grid movement, run, facing tile, step events, tool state
js/world/npc.js                    [WORLD-ENT] NPC entity driver: schedule target -> path -> pose; arrival rule; wander
js/world/roamer.js                 [WORLD-ENT] visible wild creatures: spawn/despawn from tables, flee/approach
js/world/interact.js               [WORLD-ENT] resolveFacing(player, map, ents, world, data) -> ContextAction|null; INTERACTION_PRIORITY
js/world/warps.js                  [WORLD-MAP] resolveWarp(world, warp, data) -> ok|{reason}; arrival facing
js/world/lighting.js               [WORLD-FX] pure: gradeFor(minute, weather, indoor) -> Grade; lightSources(map, world) -> Light[]

js/render/tileRenderer.js          [RENDER] chunk cache keyed (layer, tideVariant, gradeId); animated-tile pass
js/render/entityRenderer.js        [RENDER] y-sorted sprites with per-grade recolor cache, shadows, emotes, water occlusion
js/render/lightPass.js             [RENDER] additive light pools (lamps, Lantern, lighthouse beam, fireflies) + weather particles
js/render/mapRenderer.js           [RENDER] drawFrame(G, view): composes the passes in order (§4.7)
js/render/minimap.js               [RENDER] map-screen raster from RuntimeMap
js/render/sky.js                   [RENDER] sky band / Skyband for title, Day Page and map screen (from proto drawSkyband)

js/scenes/boot.js                  [SCN-FLOW] (day 1) crash-recovery check, lazy warm-up, -> title | overworld (skipTitle)
js/scenes/title.js                 [SCN-FLOW] (day 1) title, Continue / New / Seed entry / Dial pick
js/scenes/leaseCard.js             [SCN-FLOW] character creation; builds world via createNewWorld
js/scenes/overworld.js             [SCN-WORLD] (day 1 stub) the field: map, entities, HUD, tool ring, encounters, map changes
js/scenes/dialogue.js              [SCN-UI] modal textbox + choices + portraits; script host for say/choice/letter/openShop/nickname
js/scenes/cutscene.js              [SCN-UI] non-opaque script host over overworld (move/face/camera/emote/wait/warp/battle/forecast)
js/scenes/battle.js                [SCN-BATTLE] drives battle/engine: animation queue, menus, capture flow, Read card
js/scenes/battleAnims.js           [SCN-BATTLE] BATTLE_ANIMS {eventType: AnimFactory}
js/scenes/forecast.js              [SCN-BATTLE] three cards, Accept/Reroll/Anchor, flip theatre
js/scenes/menu.js                  [SCN-MENU] pause root: Party, Bag, Field Log, Map, Ledger, Settings, Save (last)
js/scenes/party.js                 [SCN-MENU] party + summary page + Shiftlog + Coverage view
js/scenes/box.js                   [SCN-MENU] box grid, move/swap, release confirm
js/scenes/bag.js                   [SCN-MENU] pockets, use/give/toss, Keepsakes confirm
js/scenes/fieldLog.js              [SCN-MENU] bestiary + fish/bugs/relics tabs
js/scenes/ledger.js                [SCN-MENU] loans, tally wall, commissions, Commons jar
js/scenes/mapScreen.js             [SCN-MENU] isle map, tide table, Waystone fast travel
js/scenes/shop.js                  [SCN-UI] buy/sell lists, Wanted Today
js/scenes/letter.js                [SCN-UI] letter reader (torn paper, seal break)
js/scenes/dayPage.js               [SCN-UI] Day Page / overnight transition
js/scenes/fishing.js               [SCN-GATHER] fishing view over systems/fishing (clock keeps running)
js/scenes/settings.js              [SCN-MENU] volumes, day length, text speed, rebind, scale, accessibility, autoAnchor presets
js/scenes/saveLoad.js              [SCN-MENU] slots, export/import string, crash resume
js/scenes/seedCard.js              [SCN-FLOW] seed card (end of run, also from settings)
js/scenes/ending.js                [SCN-FLOW] the Relighting sequence  [GDD: exact beats]
js/scenes/credits.js               [SCN-FLOW] credits roll
js/scenes/debugOverlay.js          [BOOT] perf counters, validateWorld failures, markers

js/ui/theme.js                     [UI-KIT] paper/ink/ledger/wax/focus tokens, type chips (icon + word), spacing
js/ui/focus.js                     [UI-KIT] createFocus: one model for d-pad, pointer and touch
js/ui/panel.js                     [UI-KIT] drawPanel styles: paper | ledger | notice | card | dark
js/ui/list.js  js/ui/grid.js  js/ui/tabs.js   [UI-KIT]
js/ui/confirm.js                   [UI-KIT] openConfirm(G, opts) -> Promise<number>, default cursor on the safe option
js/ui/toast.js                     [UI-KIT] toast queue drawn by main.js above the stack
js/ui/textbox.js                   [UI-KIT] typewriter box: speed, skip, page breaks, beats
js/ui/widgets.js                   [UI-KIT] drawBar (hp/exp/glow/bond), pips, badges, drawTypeChip
js/ui/icons.js                     [UI-KIT] 8x8 string-art icons for verbs, tells, types, devices
js/ui/hud.js                       [UI-HUD] clock + tide gauge, wallet, tool, context verb (device glyph), pending-Shift pip
js/ui/toolRing.js                  [UI-HUD] 8 sockets; hold `tool` >= 220 ms (input.heldFor) opens; tap swaps last two

js/art/palette.js                  [ART-SHARED] MASTER (Sweetie-16 + extras), pal(), TYPE_PALETTE_KEY -> hex, COLORS for tiles, UI tokens
js/art/spriteUtil.js               [ART-SHARED] squash(rows, line), hover(rows) sized by rows.length; frame helpers
js/art/atlas.js                    [ART-SHARED] getSprite(artId, variant) lazy decode + cache; getTile(id, frame, gradeId); buildGameAtlases
js/art/creatures/index.js          [ART-CREATURES] CREATURE_SPRITES by form id (append-only)
js/art/creatures/<family>.js       [ART-CREATURES] {formId: SpriteDef} per family (format §8.4)
js/art/heartmark.js                [ART-CREATURES] drawHeartmark(ctx, sprite, mark, {lit, back})
js/art/tiles/index.js              [ART-TILES] TILE_ART by tile id (from proto/tiles/tiles.js, split)
js/art/tiles/<group>.js            [ART-TILES] ground.js water.js stone.js wood.js flora.js buildings.js lighthouse.js
js/art/props.js                    [ART-TILES] boats, lamps, signs, scaffolding stages, roof colours
js/art/chars/index.js              [ART-CHARS] CHAR_SPRITES: player species variants, NPC bodies, 4-dir walk frames
js/art/chars/<set>.js              [ART-CHARS]
js/art/portraits.js                [ART-CHARS] 32x32 portraits by portrait id
js/art/ui.js                       [ART-SHARED] paper edges, ledger lines, wax seal, tally sticks, cursor

js/audio/director.js               [AUDIO] createMusicDirector(G): bus -> playMusic/setStem; the only decider of what plays
js/audio/tracks/index.js           [AUDIO] TRACKS, CUES, toEngine, applyStems, stemLayers (from proto/music/tracks.js)
js/audio/tracks/<track>.js         [AUDIO] one track per file
js/audio/sfxMap.js                 [AUDIO] bus event / verb -> {sfx, pitch rule}; systems emit events, never call audio

js/debug/flags.js                  [BOOT] parseFlags(search) -> BootFlags
js/debug/hook.js                   [BOOT] (day 1) installDebugHook(G) -> window.__game (§11)

test/<module>.test.mjs             [each owner] one per pure file; test/core/* exist
test/fixtures/worlds/*.json        [TOOLS] checkpoint worlds: arrival, first-catch, badge1, loan7, endgame
test/pages/*.html                  [each owner] manual browser pages per visual module
tools/validate-data.mjs            [TOOLS] cross-reference validator (§8.2); also run as test/data.test.mjs
tools/lint-owners.mjs              [TOOLS] world-write ownership, Math.random ban, DOM-in-pure-dir ban
tools/smoke-import.mjs             [TOOLS] imports every js/ module under Node
tools/new-content.mjs              [TOOLS] scaffolds map / npc / family / thread / track from templates + appends index line
tools/playtest.mjs                 [TOOLS] Playwright full-arc bot (§11)
tools/screenshot.mjs               [TOOLS] menu state-graph screenshots; fails on all-black frames
tools/fuzz-menus.mjs               [TOOLS] random input fuzz from fixtures
tools/check.sh                     [TOOLS] validate + lint + smoke + unit + (optional) playtest
```

Lanes (24): BOOT, CORE, STATE, DATA-IDX, DATA-BATTLE, DATA-SPECIES, DATA-ECON, DATA-CAST, DATA-THREADS,
DATA-LETTERS, DATA-SCRIPTS, DATA-MAPS, DATA-GATHER, SCRIPT, SYS-TIME, RULES-CREATURE, RULES-SHIFT,
RULES-CAPTURE, RULES-ECON, SYS-TOWN, SYS-GATHER, SYS-WORLD, FLOW, BATTLE-RULES, WORLD-MAP, WORLD-ENT,
WORLD-FX, RENDER, SCN-FLOW, SCN-WORLD, SCN-BATTLE, SCN-UI, SCN-MENU, SCN-GATHER, UI-KIT, UI-HUD, ART-SHARED,
ART-CREATURES, ART-TILES, ART-CHARS, AUDIO, TOOLS. Small lanes pair up on one engineer.

---

## 2. Boot and main loop

### 2.1 index.html / css

```html
<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>GAME</title><link rel="stylesheet" href="css/style.css"></head>
<body><div id="stage"></div><div id="touch"></div><noscript>This game needs JavaScript.</noscript>
<script type="module" src="js/main.js"></script></body></html>
```

No DOM UI except the touch overlay (owned by `core/input`) and one `<textarea>` the saveLoad scene creates
for save-code import and removes on exit. Everything else draws into the 480x270 buffer so it scales,
screenshots and tests identically.

### 2.2 The game context `G`

```js
/**
 * The one context object, created once in main.js and handed to every scene factory. Never imported.
 * @typedef {Object} G
 * @property {import('./state/store.js').Store} store
 * @property {World} world                     getter: store.world (re-pointed on load; read each frame, never cache)
 * @property {import('./core/events.js').Bus} bus       alias of store.bus
 * @property {import('./core/canvas.js').Display} display
 * @property {import('./core/input.js').Input} input
 * @property {import('./core/scene.js').SceneStack} scenes
 * @property {import('./core/audio.js').AudioEngine} audio
 * @property {import('./audio/director.js').MusicDirector} music
 * @property {import('./data/registry.js').Registry} data
 * @property {import('./state/rngs.js').Rngs} rngs
 * @property {import('./core/time.js').Clock} clock       bound to world.clock via systems/clockSys
 * @property {import('./core/tween.js').Tweens} tweens    screen-level (toasts, HUD); scenes create their own
 * @property {import('./core/fx.js').FX} fx               screen-level flash/shake; scenes create their own particle FX
 * @property {import('./state/persist.js').Persist} persist
 * @property {import('./ui/toast.js').Toasts} toasts
 * @property {import('./debug/flags.js').BootFlags} flags
 * @property {Record<string, (G: G) => Scene>} sceneFactories   name -> factory; scenes push by name through G.push
 * @property {(name: string, params?: any) => void} push        sugar: scenes.push(sceneFactories[name](G), params)
 * @property {(name: string, params?: any) => void} replaceWith
 * @property {number} speed                    debug multiplier (1)
 * @property {boolean} lowPower                30-fps fallback engaged
 * @property {import('./core/rng.js').Rng} entropy   unseeded cosmetic rng (title particles only)
 */
```

### 2.3 main.js, in order

1. `flags = parseFlags(location.search)` — `debug, seed, skipTitle, speed, touch, slot, scale, mute, noanim,
   strict, scene, trainer`.
2. `display = createDisplay({width:480, height:270, parent:#stage, mode: settings.scale})`;
   `input = createInput({canvas: display.canvas, display, touchParent:#touch, touch: flags.touch ?? 'auto'})`.
3. `persist = createPersist({storage: localStorage, prefix:'<title>.', version: SCHEMA_VERSION, migrations: MIGRATIONS})`
   (title string from `config.js`, **[GDD]**).
4. `data = createRegistry(DATA)`; in debug mode `data.verify()` runs the validator's id checks and throws readable errors.
5. `store = createStore(createNewWorld({seedCode: flags.seed ?? randomSeedCode(DIALS.default)}))`;
   `rngs = createRngs(store)`; `clock = createClock(clockSys.optionsFrom(store.world))`.
6. `scenes = createSceneStack({input, width:480, height:270, onChange: music.onSceneChange})`.
7. Assemble `G`; `music = createMusicDirector(G)`; `installDebugHook(G)` when `flags.debug`.
8. `scenes.push(sceneFactories.boot(G))`; `requestAnimationFrame(frame)`.

### 2.4 The loop (fixed timestep, no interpolation)

```js
const TICK = config.TICK_MS;                       // 1000/60
let acc = 0, last = performance.now(), slowFrames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(now - last, 250); last = now;  // clamp after tab sleep
  acc += dt * G.speed;                               // debug speed scales simulation only
  const maxSteps = 4 * Math.max(1, G.speed);
  let steps = 0;
  while (acc >= TICK && steps < maxSteps) { step(TICK); acc -= TICK; steps++; }
  if (steps === maxSteps) acc = 0;                   // drop time rather than spiral
  draw(); G.display.present();
  watchBudget(now);                                  // 90 slow frames (> 24 ms) -> G.lowPower = true, fx.setBudget(0.5); never flips back
}
function step(ms) {
  G.input.update(); G.tweens.update(ms); G.fx.update(ms); G.toasts.update(ms);
  G.scenes.handleInput(G.input);                     // the stack ignores input during transitions
  G.scenes.update(ms);                               // only overworld/fishing scenes call clockSys.tick
  G.persist.tick(G, ms);                             // route autosave timer
}
function draw() { G.scenes.draw(G.display.ctx); G.toasts.draw(G.display.ctx); G.debugOverlay?.draw(G.display.ctx); }
```

The world clock advances only inside `overworld.update` and `fishing.update` (`clockSys.tick`), so time is
frozen in battle, Forecast, menus and dialogue by construction. `visibilitychange` hidden / `blur`: push the
`menu` scene if not already on the stack, `audio.mute(true)` temporarily; `focus` restores audio and leaves the
menu up (the player resumes deliberately); the accumulator resets on resume. Resize is `core/canvas`'s job;
`display.onResize` only re-lays out the touch overlay and emits `display:resize`.

### 2.5 Title → lease card → overworld

```
boot ──replace──▶ title ──push──▶ saveLoad (modal) ──pop({world})──▶ title ──replace(fade)──▶ overworld
                   └──replace(iris)──▶ leaseCard ──createNewWorld──replace──▶ overworld (world.pendingScript = 'arrival')
overworld ──push──▶ cutscene('arrival') ──pop──▶ overworld
overworld ──push──▶ battle ──push──▶ forecast ──pop──▶ battle ──pop({result})──▶ overworld
overworld ──push──▶ menu ──push──▶ party | bag | fieldLog | mapScreen | ledger | settings | saveLoad ──pop──▶ menu ──pop──▶ overworld
```

Only `replace` crosses opaque boundaries; modals use `push/pop` and return results through `pop(result)`
read in the caller's `resume(result)`. The arrival cutscene is data (`world.pendingScript`), authored like any
other script, so the opening is the panel's to write **[GDD: arrival script content]**. `?skipTitle=1`
makes `boot` build a default lease card and `replace(overworld)` directly.

---

## 3. The game state store

### 3.1 Shape (`js/state/schema.js`)

Rules: ids only, never object references; `null` never `undefined`; no Map/Set/Date/functions; every key
present from `createNewWorld` so no system checks for missing keys. Abbreviated; the file documents all.

```js
export const SCHEMA_VERSION = 1;

/**
 * @typedef {Object} World
 * @property {number} v                         SCHEMA_VERSION this object conforms to
 * @property {RunConfig} run                    {seedCode, seed, dial, toggles: string[], challenges: string[], dialChangedMidRun, gen: WorldGen}
 * @property {Settings} settings                {volumes:{master,music,sfx}, muted, textSpeed, minutesPerDay, realClock, scale, bindings, reducedMotion, fps30, autoAnchor: Record<uid,'auto-anchor'|'auto-up'|null>, skipAnims}
 * @property {ClockState} clock                 core/time serialize() output
 * @property {WeatherState} weather             {today, tomorrow, intensity}
 * @property {PlayerState} player               {name, species, pronouns, look: {fur, marks, outfit}, mapId, x, y, facing, tool, lastTool, toolRing: string[], title}
 * @property {Creature[]} party                 max 6
 * @property {Creature[]} box
 * @property {string[]} yard                    creature uids in the Training Yard (may stay empty if the GDD drops the Yard)
 * @property {Bag} bag                          {pockets: Record<PocketId, ItemStack[]>, capacity: Record<PocketId, number>}
 * @property {Wallet} wallet                    {main, starsalt, anchors, purse}   [GDD: display names of currencies live in strings.js, not here]
 * @property {LoanState} loans                  {tier, paid, builds: Build[], scaffold, commissions: string[], commons: {jar, built: string[]}, residentShares: string[]}
 * @property {Record<string, boolean|number|string>} flags      namespaced: 'sp.' story, 'th.<thread>.', 'np.<npc>.', 'sys.', 'seen.<scriptId>'
 * @property {Record<string, number>} counters
 * @property {Record<ThreadId, ThreadState>} threads            {beat, done, startedDay, lastAdvancedDay}
 * @property {LettersState} letters             {delivered: number, read: number[], today: number|null}
 * @property {Record<NpcId, NpcMemory>} npcs    {met, talks, lastTalkDay, lastPorchDay, nickname, affinity, favours: string[], saidLines: Record<lineId, day>, remembered: Record<string, any>}
 * @property {Record<MapId, MapState>} maps     {visited, picked: Record<key, day>, trees: Record<key, regrowDay>, cracks: Record<key, boolean>, reach: Record<id, number>, opened: string[]}
 * @property {FieldLog} fieldLog                {forms: Record<FormId, {seen, read, held, ability: string|null}>, tells: Record<FishId, number>}
 * @property {Collections} collections          {fish: Record<id, {n, best}>, bugs: Record<id, {n}>, relics: Record<id, {n, cleaned}>, donated: string[]}
 * @property {string[]} badges                  spire ids in order won
 * @property {string[]} pendingShifts           creature uids with an open window (deferred)
 * @property {string|null} pendingScript        script id to run on next overworld enter
 * @property {{scriptId: string, state: RunnerState}|null} cutscene   mid-script save (only via the `save` op)
 * @property {BattleBookmark|null} battleBookmark   {kind, trainerId, mapId, x, y, battles} set before story battles (crash summary only)
 * @property {Record<string, number[]>} rng     saved states of STATEFUL forks only (§9)
 * @property {Stats} stats                      {playMs, steps, battles, catches, forecasts, rerolls, anchors, wardWalls, blackouts, summitAttempts, fishCaught, treesShaken, lettersRead}
 * @property {string[]} log                     last 60 Day Page lines (Archive)
 */

/**
 * Creature record. Adopted from proto/battle/creature.js with the fields the merged game needs added.
 * @typedef {Object} Creature
 * @property {string} uid               'c' + catch sequence (party.nextUid); stable; the Shift stream label
 * @property {string} speciesId         current form id
 * @property {string} familyId
 * @property {string} nickname
 * @property {string[]} types           current types (follows the form; Unfixed loops override)
 * @property {string} ability           ability id (follows the form)
 * @property {number} level  @property {number} exp
 * @property {StatBlock} base           effective base stats (floor-adjusted after Shifts)
 * @property {StatBlock} trained        0..252 each
 * @property {StatBlock} stats          derived; recomputed by systems/creature.recomputeStats
 * @property {number} hp
 * @property {{id: string, pp: number, maxPp: number}[]} moves    max 4
 * @property {string[]} memory          move ids parked by Shifts
 * @property {{kind: 'burn'|'poison'|'chill'|'numb', turns: number}|null} status
 * @property {number} mends             battle budget, reset at battle start
 * @property {number} bond              0..5
 * @property {string|null} heartmark    pinned Heartmark technique id
 * @property {boolean} heartmarkStab
 * @property {{x: number, y: number}} mark   per-individual Heartmark pixel placement (front)
 * @property {string[]} shiftlog        every form held, in order
 * @property {number} shiftCount        draws consumed from the Shift stream (rerolls included)
 * @property {number[]} windowsUsed     curve points already resolved
 * @property {boolean} stillKnot
 * @property {string|null} heldItem
 * @property {boolean} wild             true until bonded (Heartmark unlit)
 * @property {string[]|null} typeQueue  Unfixed loop  @property {number} typeIndex
 * @property {number} caughtDay  @property {string} caughtMap
 */
/** @typedef {{hp:number, atk:number, def:number, spa:number, spd:number, spe:number}} StatBlock */

/** @param {{seedCode: string, lease?: Partial<PlayerState>, settings?: Partial<Settings>}} opts @returns {World} */
export function createNewWorld(opts)
/** @param {World} world @param {Registry} [data] @returns {string[]} problems; empty = valid */
export function validateWorld(world, data)
```

`createNewWorld` consumes the `worldgen` fork once and stores results in `run.gen` (Ward placements,
per-seed ability picks, disc contents, field-item shuffles per dial) so saves never re-roll them.

### 3.2 Store (`js/state/store.js`)

```js
/** @param {World} world @param {{bus?: Bus}} [opts] @returns {Store} */
export function createStore(world, opts)
/**
 * @typedef {Object} Store
 * @property {World} world              the live object; read freely, mutate only inside tx via a system function
 * @property {Bus} bus                  core/events bus (domain events, §3.4)
 * @property {<T>(label: string, fn: (world: World) => T) => T} tx   runs fn, marks dirty, emits 'tx' {label}; nested txs collapse into the outer
 * @property {() => boolean} dirty  @property {() => void} clean
 * @property {Map<string, any>} derived NOT serialized: path caches, schedule lookups, chunk handles; cleared on replace and map:enter
 * @property {(world: World) => void} replace   swap in a loaded world; clears derived; emits 'world:replaced'
 * @property {() => World} snapshot     rngs.commit + structuredClone, for saving
 */
```

With `?debug=1&strict=1` the store wraps `world` in a deep `Proxy` that throws on any write outside a `tx`;
this is the runtime half of rule 1 (the static half is `tools/lint-owners.mjs`).

### 3.3 Versioning and migration

*As built: the save format is at version 7, with steps 0→1 through 6→7; see §16.2.*

`world.v` is stamped by `createNewWorld`. `MIGRATIONS = {1: (d) => d}` keyed by the version being upgraded
**from**; `migrateWorld(data)` runs them in order then merges `createNewWorld` defaults under the result
(`fillDefaults`) so new keys appear. `core/save.createSaveSystem({version, migrations})` applies the same
steps on `load()` and `importString()`. Never rename a field in place: add the new one, fill it in the
migration, delete the old one in the migration. Each step has a fixture test (`test/fixtures/v<n>.json`).

### 3.4 Domain events (emitted by systems after mutating; UI and audio listen; systems never listen to UI)

`world:replaced, tx, party:changed, creature:levelUp, creature:learned, bag:changed, wallet:changed,
loan:paid, loan:tier, loan:built, flag:set, counter:inc, letter:delivered, letter:read, thread:beat,
npc:talked, fieldLog:seen|read|held, collection:added, clock:minute, clock:hour, clock:phase, tide:change,
day:start, day:end, weather:change, map:enter, map:exit, player:step, encounter:start, battle:start,
battle:end, capture:ok, capture:fail, shift:window, shift:resolved, badge:won, summit:cleared, save:ok,
save:fail, toast, display:resize, scene:change`.

Payloads are small plain objects documented beside each system's emit. `audio/sfxMap.js` and
`audio/director.js` are pure listeners; `systems/flow/eventScripts.js` maps events to `pendingScript`.

---

## 4. Overworld architecture

### 4.1 Map data module (`js/data/maps/<map>.js`)

Maps are hand-edited ASCII. Collision and tide passability derive from the **tile definitions**, so an
author paints ground and gets walls, water and tide gates for free; an optional `collision` layer overrides
per tile (interiors, invisible walls).

```js
/**
 * @typedef {Object} MapDef
 * @property {string} id  @property {string} name
 * @property {'exterior'|'interior'} kind
 * @property {string} region                  curve level + music region id  [GDD: region list]
 * @property {number} w  @property {number} h  (tiles)
 * @property {Record<string, string>} [legend] char -> tile id; merged over tilesets.DEFAULT_LEGEND
 * @property {string[]} ground                h rows of w chars
 * @property {string[]} [detail]              over ground, under entities ('.' = none)
 * @property {string[]} [overlay]             over entities (tree crowns, eaves)
 * @property {string[]} [collision]           '#' solid  '.' open  '-' inherit from tile  'L' open only at low tide  'H' open only at high tide (boat)
 * @property {PropDef[]} [props]              static art anchored at a tile, baked into chunk layers at load: {art, x, y, cond?}
 * @property {EntityDef[]} entities           {kind:'npc'|'tree'|'rock'|'crack'|'sign'|'item'|'prop'|'roamer'|'boat', id, x, y, cond?, ...kind props}
 * @property {TriggerDef[]} triggers          {x, y, w?, h?, kind:'step'|'use'|'enter', id, cond?, script?, verb?, once?}
 * @property {WarpDef[]} warps                {x, y, w?, h?, to:{mapId, x, y, facing?}, kind:'door'|'edge'|'stairs', cond?, sfx?}
 * @property {SpawnDef[]} spawns              {area:{x,y,w,h}|'grass'|'water'|'mud', table: encounterTableId, rate, cond?}
 * @property {Record<string, {x:number,y:number,w:number,h:number}>} [regions]   named rects for scripts and camera
 * @property {string} [music]                 overrides the hourly track (interiors, Spires)
 * @property {{indoor?: boolean, ambient?: string}} [light]
 * @property {{x:number, y:number, facing?: string}} entry   default arrival
 */
```

Causeways and stepping stones are not warps: they are tiles whose tileset entry says `tide: 'low'`, so
they are walkable when `isLowTide` and water otherwise. The validator proves every `tide:'low'` region
connects dry land to dry land and that `tide.nearestDry` exists for every such tile.

### 4.2 Runtime map (`js/world/tilemap.js`, pure)

```js
/** @param {MapDef} def @param {Registry} data @returns {RuntimeMap} */
export function loadMap(def, data)
/**
 * @typedef {Object} RuntimeMap
 * @property {string} id  @property {number} w  @property {number} h  @property {MapDef} def
 * @property {Uint16Array[]} layers            [ground, detail, overlay] tile indexes (0 = none)
 * @property {Uint8Array} tideMask             per tile: 0 none, 1 low-only, 2 high-only, 3 floods-visually-at-high, 4 glows-at-night-low
 * @property {(x:number, y:number, tideState: TideState, mover: 'walk'|'npc'|'roamer'|'boat') => boolean} passable
 * @property {(x:number, y:number) => TileInfo|null} tileAt       merged info incl. verb, sfx, water
 * @property {(x:number, y:number) => TriggerDef[]} triggersAt
 * @property {(x:number, y:number) => WarpDef|null} warpAt
 * @property {(x:number, y:number) => SpawnDef|null} spawnAt
 * @property {Array<{x:number, y:number, frames:number, fps:number}>} animated   tiles not baked into chunks (cap 400; validator warns)
 * @property {Record<string, Rect>} regions
 */
/** Autotiling (shore foam, cliff rims, path corners) is computed here from neighbours; authors paint base tiles only. */
```

### 4.3 Camera and entities

```js
/** @returns {Camera} */ export function createCamera({w:480, h:270})
/** @typedef {{x:number, y:number, follow(target:{px:number,py:number}, opts?:{lerp?:number}): void, bounds(map: RuntimeMap): void,
 *   update(dt:number): void, toScreen(wx:number, wy:number): {x:number,y:number}, visibleTiles(): Rect, shake(amount:number, ms:number): void}} Camera */

/**
 * @typedef {Object} Entity
 * @property {string} id  @property {'player'|'npc'|'roamer'|'item'|'tree'|'rock'|'crack'|'sign'|'prop'|'boat'} kind
 * @property {number} x  @property {number} y         tile coords (target tile while moving)
 * @property {number} fromX  @property {number} fromY  @property {number} t   0..1 step progress
 * @property {number} px  @property {number} py        derived pixel position (whole pixels)
 * @property {'up'|'down'|'left'|'right'} facing
 * @property {boolean} moving  @property {number} speedMs   160 walk / 100 run per tile
 * @property {boolean} solid  @property {number} z         y-sort override
 * @property {string} artId  @property {number} frame  @property {string|null} emote
 * @property {EntityDef|null} def  @property {string|null} npcId  @property {string|null} speciesId  @property {string|null} itemId
 * @property {number[]|null} path
 */
/** @param {RuntimeMap} map @returns {EntityManager} */ export function createEntities(map)
/** @typedef {{list: Entity[], add(e: Entity): Entity, remove(id: string): void, find(id: string): Entity|null,
 *   at(x:number, y:number): Entity|null, near(x:number, y:number, r:number): Entity[],
 *   tryMove(ent: Entity, dir: Dir, ctx: {map: RuntimeMap, tideState: TideState, run: boolean}): boolean,
 *   tickMovement(ent: Entity, ms: number): 'arrived'|'moving'|'idle',
 *   ySorted(): Entity[], rebuildFromDefs(world: World, data: Registry, tideState: TideState): void}} EntityManager */
```

Movement is tile-to-tile; collision is checked once at step start, so determinism holds. Entity defs
carry `cond`; `rebuildFromDefs` runs on map enter, `day:start` and `flag:set` (debounced one frame), so a
neighbor appearing or a dark house opening is data.

### 4.4 NPC schedules (`js/systems/schedule.js`, pure)

```js
/**
 * @typedef {Object} ScheduleEntry
 * @property {number|{tide:'low'|'high'}|{phase: string}} at   minute of day, or an anchor resolved against world.clock
 * @property {string} mapId  @property {number} x  @property {number} y  @property {string} [facing]
 * @property {'stand'|'wander'|'sit'|'sleep'|'fish'|'shop'|'sweep'|'path'} [pose='stand']
 * @property {string} [path]            named path id (schedules.js) to walk in a loop while here
 * @property {number[]} [days]          day-of-week filter (0 = Mon)
 * @property {Cond} [cond]
 * @property {number} [wanderR]
 */
/** Last entry whose resolved `at` <= minute, whose days/cond hold; the final entry wraps past midnight. */
export function entryAt(npc: NpcDef, world: World, data: Registry, minute: number) -> ScheduleEntry
/** @returns {{mapId, x, y, facing, pose, pathId, since: minute}} */
export function whereIs(npc: NpcDef, world: World, data: Registry) -> Placement
```

`world/npc.js` drives the entity: on map entry each NPC whose placement is on this map is spawned **at**
the target, or at the map's nearest door/edge if `since` is within the last 3 in-game minutes (so arrivals
are visible); on the map it walks toward a new target via `world/pathing.js` (BFS, 4-dir, respects
`passable(tideState)`, cached in `store.derived` by `(mapId, from, to, tideState)`, catch-up capped at
`tuning.npcCatchUpTiles`). Off-map NPCs are not simulated.

### 4.5 Interaction system

```js
/** @param {Entity} player @param {RuntimeMap} map @param {EntityManager} ents @param {World} world @param {Registry} data
 *  @returns {ContextAction|null} */
export function resolveFacing(player, map, ents, world, data)
/** @typedef {{verb: string, label: string, icon: string, target: Entity|TileInfo|TriggerDef, kind: string,
 *   disabled: string|null, payload: Record<string, any>}} ContextAction */
export const INTERACTION_PRIORITY = ['entity', 'useTrigger', 'tileVerb'];
```

Priority: entity in facing tile (npc → `talk`, roamer → `read`, item → `pickUp`, tree → `shake`, crack →
`dig`, sign → `read`) → `use` trigger in facing tile (door, bed, porch, mailbox, waystone, spire, shop,
commons) → tile verb (water with rod → `fish`, mud at low tide with shovel → `dig`, otherwise `look`).
The held tool filters verbs (a net turns `look` at a bug into `catch`). `disabled` carries the reason
("Needs a rod") so the HUD shows a greyed verb, never nothing. All verbs route through
`systems/flow/interactFlow.doInteraction(G, action)`, the only place the overworld pushes dialogue, shop,
fishing, letter or battle scenes; `VERB_HANDLERS[verb] = (G, action) => void` is its registry, so map
authors use verb names only.

### 4.6 Encounters (seeded)

```js
/** @param {World} world @param {RuntimeMap} map @param {Rng} rng @param {{x:number, y:number, tideState: TideState, phase: string, weather: string}} ctx
 *  @returns {EncounterResult|null} */
export function rollStep(world, map, rng, ctx)
/** @typedef {{speciesId: string, level: number, errant: boolean, tableId: string}} EncounterResult */
```

`rng` is the stateful fork `enc:<mapId>`; per-step rate from the spawn def; table rows are filtered by their
`cond` (phase/tide/weather/flags) before weighting, so night-only and low-tide-only creatures are rows,
not code. Errants are rows with `errant: true` and a tiny weight. Roamers (`world/roamer.js`) are visible
encounters pre-rolled from the same stream; touching one starts that battle.

### 4.7 Day/night, tide and weather as render passes (decision: palette-LUT grading, not a multiply overlay)

Simulation sees only `world.clock`, `world.weather` and `tideMask`. Rendering follows the tile prototype:
`world/lighting.gradeFor(minute, weather, indoor) -> Grade` returns one of 48 quantized grades per day
(every 30 in-game minutes) with `{id, mult:[r,g,b], floor, sat, lamp, night}`. Tiles, props and sprites are
re-decoded through the grade (`gradeHex`), colours named with a leading `!` (lamps, bioluminescence,
skyglass, lit windows) bypass it, and nothing crushes below night ink. Pixels stay crisp and on-palette.

Per frame (`render/mapRenderer.drawFrame(G, view)`): (1) clear; (2) ground chunks `(tideVariant, gradeId)`;
(3) detail chunks; (4) animated tiles (water frames, glow mud) drawn from `map.animated`; (5) entities
y-sorted via `art/atlas.getSprite(artId, {gradeId})`; (6) overlay chunks; (7) light pass: `'lighter'`
radial pools for porches, lamps, the Lantern, the lighthouse beam by scaffold stage, fireflies (cached
gradient canvases by radius/colour, ≤ 24); (8) weather particles from `core/fx` presets (rain, mist motes,
snow, meteors); (9) screen fx (shake offset already applied, flash); (10) HUD; (11) modal scenes above,
drawn by the stack. Interiors (`light.indoor`) use a fixed lamp grade. `settings.reducedMotion` disables
particles and shake, never the grade.

### 4.8 Map transitions

```js
/** @param {World} world @param {WarpDef} warp @param {Registry} data
 *  @returns {{ok: true, to: {mapId:string, x:number, y:number, facing:string}} | {ok: false, reason: 'tide'|'locked'|'cond', message: string}} */
export function resolveWarp(world, warp, data)
```

Doors fire on confirm or step (`kind`), edges on step. Map changes happen **inside** the overworld scene:
`scenes.transition('fade', 300, () => overworld.changeMap(to))` swaps the runtime map, entity manager and
chunk cache, then emits `map:enter` (an autosave trigger). A player standing on a `tide:'low'` tile when
the tide rises is moved to `tide.nearestDry(map, x, y)` with a splash and a toast; never trapped.

---

## 5. Battle integration

### 5.1 The pure engine: adopt `proto/battle/engine.js` with five named changes

The prototype engine is adopted as `js/battle/engine.js`. Its public API is the contract:

```js
/**
 * @typedef {Object} SideInput
 * @property {Creature[]} party                      deep copies (systems/creature.serialize/deserialize); the engine owns them
 * @property {{id: string, name: string, title?: string, items?: Array<{id: string, heal?: number}>, payout?: number, tacticTag?: string}} [trainer]
 * @property {{crackdust?: number, lanterns?: Record<string, number>}} [bag]
 * @property {number} [glint]                        wallet.main at battle start (blackout cost base)
 */
/**
 * @param {Object} opts
 * @param {[SideInput, SideInput]} opts.sides          side 0 is always the player
 * @param {'wild'|'trainer'} opts.kind                 Spire / Summit / rival / duel are 'trainer' with `source` and `summit` set
 * @param {'drift'|'flux'|'freefall'} opts.dial
 * @param {Rng} opts.rng                               rngs.battle(world) (§9)
 * @param {boolean} [opts.captureStance]
 * @param {number|null} [opts.curveLevel]
 * @param {boolean} [opts.summit]                      losses cost nothing
 * @param {'route'|'story'|'spire'|'rematch'|'duel'} [opts.source]
 * @param {(battle: Battle, side: number) => Action} [opts.foeAi]   from battle/ai.js
 * @param {Creature[]} [opts.yard]
 * @param {{seen: Set<string>, read: Set<string>}} [opts.fieldLog]  built by battleFlow from world.fieldLog
 * @param {boolean} [opts.prism]
 * @param {DialRules} opts.rules                      NEW: resolved from data/dials.js (readCostsTurn, captureDisplay, wardBadge, runAllowed, holdOutTurns)
 * @returns {Battle}
 */
export function createBattle(opts)
/**
 * @typedef {Object} Battle
 * @property {() => BattleState} state                 plain snapshot for drawing: HP, stages, PP, Ward badges, stance, turn
 * @property {(side: number) => LegalMenu} availableActions   {side, phase, locked, moves:[{i, id, pp, usable, reason}], scrap, switches, run, read, lantern, captureStance, items}
 * @property {(actions: [Action, Action?]) => BattleEvent[]} submit   one full turn; side 1 filled by foeAi when omitted
 * @property {(side: number) => BattleEvent[]} read    free Read on drift/flux; on freefall submit {type:'read'} instead
 * @property {(on: boolean) => BattleEvent[]} setCaptureStance
 * @property {() => BattleResult} result               {ended, outcome, winner, turns, exp:[{uid, amount, levelsGained}], payout, blackoutCost, summitNoLoss, caught: Creature|null}
 */
/** @typedef {{type:'move', move:number} | {type:'switch', to:number} | {type:'item', id:string, target?:number} |
 *   {type:'lantern', grade:string} | {type:'run'} | {type:'read'} | {type:'scrap'}} Action */
```

Changes to the prototype (all small; owner BATTLE-RULES):

1. **Data imports repoint** to `js/data/*` (`types`, `moves/index`, `abilities` + `battle/abilityHooks`,
   `species/index`) and `js/systems/creature.js`. The engine keeps static imports; it is not parameterized by
   a registry (simplest, and data modules are pure).
2. **Abilities split**: `data/abilities.js` becomes pure rows `{id, name, text, ward?, hook, expShare?,
   glint?}`; the hook *functions* move to `battle/abilityHooks.js` as `HOOKS[hook]`;
   `getAbilityRuntime(id)` merges them for the engine. The validator fails on a `hook` key with no entry.
3. **uid is a string** (`'c17'`) allocated by `systems/party.nextUid(world)`; `makeCreature(opts)` accepts
   `uid` and never generates one.
4. **`rules: DialRules`** replaces the hard-coded dial switch for Read cost, capture display and Run rules.
5. **Tunables move** (`LANTERN`, `BLACKOUT_*`, `BENCH_SHARE`, `CATCH_UP_*`, `CAPTURE_*`) to
   `data/tuning.js` and are imported back; the formulas stay where they are.

`battle/effects.js` exports `EFFECT_KEYS` (`stat, status, recovery, guard, evasion, sureHit, plumbline,
scrap, clearRaised, flinch, popsDecoy, highCrit, revealMoves, charge, spread, queuedType, multiHit, drain,
selfKo, contact, chance`) as the vocabulary the engine implements; the validator rejects any other key in a
move. Doubles (`rules §11`) are **not** in the engine; if the GDD requires them, it is a scheduled engine
extension, not a scene change **[GDD: doubles yes/no]**.

Tests: replay action lists against a seeded rng and assert on event sequences; fuzz asserts
`availableActions` never returns an empty menu (Scrap fallback) and `submit` never throws for a legal action.

### 5.2 Battle scene and animation queue

```js
export function createBattleScene(G) -> Scene      // enter({setup: BattleSetup}); pops with {result: PostBattle}
/** @typedef {{run: (api: AnimApi) => Generator<number, void, void>, skippable: boolean}} Anim   yields ms to wait */
/** @returns {{push(anim: Anim): void, update(dt: number): void, idle(): boolean, skip(): void}} */ export function createAnimQueue()
export const BATTLE_ANIMS /* : Record<BattleEventType, (ev: BattleEvent, view: BattleView) => Anim> */
```

State machine: `menu` → `submit(action)` → `playing` (drains events; confirm skips the current anim) →
`menu` | `replace` | `done`. Menus are built from `availableActions(0)` so unusable options draw greyed with
their reason; `cancel` on the root does nothing when Run is not allowed. `settings.skipAnims` (and
`?noanim=1`) collapses every anim to one frame; the Playwright bot uses it. The scene reads
`battle.state()` to draw and never reaches into engine internals.

### 5.3 Capture flow

Capture is `{type:'lantern', grade}`. Before confirming, the Lantern submenu shows odds from
`systems/capture.captureOdds(foe, grade, world, data) -> {p, band, shown}` (`shown` is a percent on
Drift/Flux, a band on Freefall per `rules.captureDisplay`). The engine emits `capture-shake` ×3 (meter
ticks, no input timing) then `capture` or `capture-fail`. The sure-catch Lantern lives in
`pockets.keepsakes` with `oneOfAKind: true`; `ui/confirm` names the target with the cursor on No.
On success `result().caught` is a full Creature whose uid was passed in `setup.nextUid`.

### 5.4 Forecast scene and Shift flow

```js
/** @param {Creature} c @param {World} world @param {Registry} data @param {Rng} stream @returns {Forecast} */
export function rollForecast(c, world, data, stream)
/** @typedef {{cards: [Card, Card, Card], picked: 0|1|2, starTouched: string|null, bondTilt: number, dial: string, rerollCost: number, canAnchor: boolean}} Forecast */
/** @typedef {{dir:'up'|'side'|'down', formId: string, types: string[], totalDelta: number, ability: string, isWard: boolean, keeps: number, seen: boolean, read: boolean, pct: number}} Card */
/** @param {World} world @param {string} uid @param {string} formId @param {Registry} data @returns {{toMemory: string[], learned: string[]}} */
export function applyShift(world, uid, formId, data)
/** @param {World} world @param {string} uid @returns {boolean} */ export function anchor(world, uid)
/** @param {World} world @param {string} uid @param {Registry} data @returns {Rng} */ export function shiftStream(world, uid, data)   // rngs.creature(uid) fast-forwarded by c.shiftCount
```

`picked` is decided when the cards are drawn (the 1.5 s flip is theatre; no input is read). Reroll draws
again from the same stream and increments `shiftCount`; the cost table is dial data. Accept →
`store.tx('shift.accept', w => forecast.applyShift(w, uid, formId, data))` → `fieldLog:held`,
`shift:resolved` (autosave). Anchor spends `wallet.anchors` behind a one-of-a-kind confirm. The scene is
pushed from battle (immediately, when `settings.autoAnchor[uid]` is null), from `dayFlow` at a Waystone,
door or Rest for `world.pendingShifts`, and from scripts via the `forecast` op.

### 5.5 Flow glue (`js/systems/flow/battleFlow.js`)

```js
/** @typedef {{kind:'wild'|'trainer', trainerId?: string, wild?: {speciesId: string, level: number, errant?: boolean}, source: string, summit?: boolean, holdOut?: number, onLose?: 'porch'|'script', loseScript?: string}} BattleSetup */
export function startBattle(G, setup: BattleSetup): void                 // builds SideInput from world, sets battleBookmark (story kinds autosave), pushes 'battle'
/** @param {World} world @param {BattleResult} result @param {Registry} data @returns {PostBattle} */
export function applyBattleResult(world, result, data)
/** @typedef {{levelUps: Array<{uid: string, from: number, to: number, newMoves: string[]}>, windowsOpened: string[], caught: Creature|null, blackout: boolean, payout: number, badge: string|null}} PostBattle */
```

`applyBattleResult` copies HP/PP/status back by uid, awards EXP through `systems/exp.js`, pushes opened
windows to `pendingShifts`, adds a catch via `party.addCreature`, charges the blackout cost, marks Field Log
Seen/Read/Held and stats. The overworld's `resume({result})` then runs, in order: learn-move prompts, the
"Open Forecast now / Later" confirm per window, the nickname prompt for a catch, the trainer's
`scripts.afterWin|afterLoss`, blackout-to-porch, then `persist.autosave('battle')`.

---

## 6. Dialogue, cutscene and quest scripting

### 6.1 Format

A script is an array of ops. Each op is `{op, ...fields}`; the shorthand string `"Wren: Morning, Keeper."`
is `{op:'say', who:'wren', text:'Morning, Keeper.'}` (speaker resolved by npc id, or a display name when it
is not an id). Text supports `{player}`, `{nick:uid}`, `{npcNick}`, `{wallet}`, `|` page break, `~` 300 ms beat.

```js
export const OPS = {
  // pure (run inside the runner; never yield)
  label:{id:'string'}, goto:{id:'string'}, call:{script:'string'}, end:{},
  if:{cond:'Cond', then:'Op[]', else:'Op[]?'}, branch:{on:'string', cases:'Record<string, Op[]>'},
  setFlag:{id:'string', value:'any?'}, inc:{id:'string', by:'number?'},
  give:{item:'string', n:'number?'}, take:{item:'string', n:'number?', ask:'boolean?'},     // ask yields a confirm
  earn:{amount:'number'}, spend:{amount:'number'}, addCreature:{species:'string', level:'number', nick:'string?'},
  remember:{npc:'string', key:'string', value:'any'}, thread:{id:'string', beat:'number?'}, beat:{thread:'string', to:'number'},
  // host (yielded as a Request; the scene performs them)
  say:{who:'string?', text:'string', emote:'string?', portrait:'string?'},
  choice:{prompt:'string?', options:[{text:'string', cond:'Cond?', goto:'string?', then:'Op[]?'}], defaultIndex:'number?'},
  nickname:{who:'string', offer:'string?'},
  move:{who:'string', path:'string', run:'boolean?', wait:'boolean?'},    // path "UUURRD" (A's compact form)
  face:{who:'string', dir:'up|down|left|right|player'}, emote:{who:'string', kind:'!|?|♥|…|zzz'},
  teleport:{who:'string', mapId:'string?', x:'number', y:'number'}, spawn:{who:'string', artId:'string', x:'number', y:'number'}, despawn:{who:'string'},
  wait:{ms:'number'}, camera:{to:'string|[number,number]|player', ms:'number?', shake:'number?'},
  playSfx:{name:'string'}, music:{track:'string|null', fade:'number?'}, stem:{name:'string', on:'boolean'},
  openShop:{shop:'string'}, startBattle:{trainer:'string?', wild:'{speciesId, level}?', source:'string?', holdOut:'number?', onLose:'string?'},
  forecast:{who:'player:<uid>|foe', scripted:'{formId}?'}, letter:{n:'number?'}, toast:{text:'string'},
  warp:{mapId:'string', x:'number', y:'number', facing:'string?'}, setTime:{minute:'number'}, tide:{set:'number'},
  sleep:{}, save:{reason:'string?'},
};
```

### 6.2 Interpreter (`js/script/runner.js`, pure, resumable)

```js
/** @typedef {{world: World, data: Registry, rng: Rng, vars: Record<string, any>, npc: string|null, mapId: string}} ScriptCtx */
/** @param {Op[]} ops @param {ScriptCtx} ctx @param {RunnerState} [state] @returns {Runner} */
export function createRunner(ops, ctx, state)
/**
 * @typedef {Object} Runner
 * @property {(answer?: any) => Request|{done: true}} step   runs pure ops until a host op; returns it as a Request
 * @property {() => RunnerState} save                         {pc: number[], vars, callStack}
 * @property {() => boolean} isDone
 */
/** @typedef {{id: number, op: string, [k: string]: any}} Request */
/** @param {string} text @param {ScriptCtx} ctx @returns {string} */ export function interpolate(text, ctx)
```

Pure ops call the real system functions on `ctx.world` (`bag.give`, `wallet.earn`, `flags.set`,
`threads.setBeat`, `memory.remember`), so one code path applies every rule. The host performs a Request
and calls `step(answer)`: `choice` → index, `take ask` → boolean, `nickname` → string, `startBattle` →
`PostBattle`, `forecast` → formId, others → `undefined`. In Node a fake host answers from a list.

Hosts: `scenes/dialogue.js` (modal, `opaque:false`) handles `say/choice/nickname/letter/openShop`;
`scenes/cutscene.js` (`opaque:false, updateBelow:true` so NPCs keep walking) handles the world ops and
pushes `dialogue` for text. Both share `HOST_OPS` from `scenes/scriptHost.js` (op → function returning a
completion). Text speed from `settings.textSpeed`; `cancel` finishes the typewriter, a second press advances;
hold `cancel` fast-forwards a script whose `seen.<scriptId>` flag is set.

### 6.3 Where scripts come from (`js/script/registry.js`)

```js
/** @param {World} world @param {Registry} data @param {{kind:'npc'|'sign'|'trigger'|'porch'|'bed'|'mailbox'|'waystone'|'spire'|'commons', id: string, linger?: boolean}} target
 *  @returns {{scriptId: string, source: 'thread'|'favour'|'topic'|'schedule'|'porch'|'generic'|'default', lineId?: string}} */
export function resolveScript(world, data, target)
```

NPC priority, fixed: (1) the current beat of their life thread whose `cond` holds (via
`threads.beatTopics`); (2) a pending favour topic; (3) the highest-priority eligible entry in the NPC's
`topics` (`once`/`repeatDays` honoured through `npcs[id].saidLines`); (4) the schedule pose line
(`lines.fishing`, `lines.night`, ...); (5) porch talk when standing at their porch trigger in the porch
window; (6) the memory-filtered generic pool (`lines.generic`, excluding ids said within
`tuning.noRepeatDays`). `linger: true` resolves again skipping the line just said. Writers never touch the
registry. Letters are not scripts: `systems/letters.deliverMorning` queues `LETTERS[delivered]` on
`day:start`; a letter's optional `reveal: Op[]` runs when read. Map triggers, trainers
(`scripts.before|afterWin|afterLoss`) and `EVENT_SCRIPTS` (`'loan:tier:3' -> 'wren-tier3'`) complete the set.

### 6.4 Condition DSL (`js/script/cond.js`)

```js
/** @typedef {boolean |
 *  {flag: string, is?: any} | {not: Cond} | {all: Cond[]} | {any: Cond[]} |
 *  {counter: string, gte?: number, lte?: number} | {hasItem: string, n?: number} | {wallet: {gte: number}} |
 *  {hour: [number, number]} | {phase: string[]} | {tide: TideState[]} | {lowTide: boolean} | {day: {gte?: number, dow?: number[]}} |
 *  {weather: string[]} | {loan: {tier?: number, paid?: boolean}} | {badge: string|number} | {letter: {read: number}} |
 *  {thread: {id: string, beat?: number, done?: boolean}} | {npc: {id: string, met?: boolean, talks?: {gte: number}, nickname?: boolean}} |
 *  {party: {has?: string, family?: string, level?: {gte: number}, size?: {gte: number}}} | {fieldLog: {form: string, state: 'seen'|'read'|'held'}} |
 *  {map: string} | {inRegion: string} | {dial: string[]} | {challenge: string} | {seen: string} | {tool: string}
 * } Cond */
/** @param {World} world @param {Cond} cond @param {{data: Registry, npc?: string, mapId?: string, x?: number, y?: number}} ctx @returns {boolean} */
export function evalCond(world, cond, ctx)
```

No randomness in conditions. A "sometimes" is a script op that draws from a named fork and sets a flag.

*As built: `day` reads the run's own day number and `hasItem` on a currency reads the wallet; see §16.5 for these and the other semantics that the fix waves pinned down.*

---

## 7. UI toolkit

All UI draws into the buffer with `core/font`, `core/pixelart` and `art/ui.js`. Theme tokens
(`ui/theme.js`): paper, ink, ledger rule, wax, focus + a 1-px dotted ring and a `▶` cursor glyph. Every tell
is shape + word + icon; nothing means anything by colour alone.

```js
// ui/focus.js — one focus model for d-pad, pointer, touch
/** @param {Input} input @param {{wrap?: boolean, cols?: number}} [opts] @returns {Focus} */ export function createFocus(input, opts)
/** @typedef {{setItems(items: FocusItem[]): void, update(dt: number): FocusEvent|null, index: number, set(i: number): void,
 *   current(): FocusItem|null, drawCursor(ctx: CanvasRenderingContext2D): void}} Focus */
/** @typedef {{id: string, rect: Rect, enabled: boolean, reason?: string, onActivate?: () => void, group?: string}} FocusItem */
/** @typedef {{type: 'activate'|'cancel'|'move', item: FocusItem|null}} FocusEvent */
// d-pad via input.repeat; pointer hover (hidden on keyboard/gamepad); a tap on an unfocused item focuses it, a tap on the focused item activates (two-step on touch)

// ui/panel.js
export function drawPanel(ctx, rect: Rect, style: 'paper'|'ledger'|'notice'|'card'|'dark', opts?: {title?: string, seal?: boolean, torn?: 'top'|'bottom'|'none'}): void
// ui/list.js  ui/grid.js  ui/tabs.js
export function createList({rect, rowH, items, render: (ctx, item, x, y, w, focused) => void, focus, onSelect, onCancel}) -> Widget
export function createGrid({rect, cols, rows, cellW, cellH, items, render, focus, onSelect, onCancel}) -> Widget
export function createTabs({tabs: [{id, label, icon}], rect, input, onChange}) -> Widget & {active: string}
/** @typedef {{update(dt: number): void, draw(ctx: CanvasRenderingContext2D): void, handle(input: Input): void, selected(): any, setItems(items: any[]): void}} Widget */
// ui/confirm.js — pushes a non-opaque scene; resolves on pop. defaultIndex is the SAFE option (No) for one-of-a-kind items, deletes, overwrites
export function openConfirm(G, {title?: string, body: string, options?: string[], defaultIndex?: number, danger?: boolean}): Promise<number>
// ui/toast.js — drawn by main.js above the stack; listens to bus 'toast'
export function createToasts(G) -> {show(text: string, opts?: {icon?: string, ms?: number}): void, update(dt: number): void, draw(ctx): void}
// ui/textbox.js
export function createTextbox({rect, speed, font}) -> {setText(text: string, opts?: {who?: string, portrait?: string}): void, update(dt: number): void, draw(ctx): void, done: boolean, skip(): void, advance(): boolean}
// ui/widgets.js
export function drawBar(ctx, {x, y, w, h, value, max, kind: 'hp'|'exp'|'glow'|'bond', showNumber?: boolean}): void
export function drawTypeChip(ctx, type: string, x: number, y: number): void     // icon + abbreviated word
// ui/hud.js
export function drawHud(ctx, G, {verb: ContextAction|null, showClock: boolean}): void   // clock (sun/moon glyph + hour), tide gauge (arrow shape + "low in 12m"), wallet, tool, verb with device glyph, pending-Shift pip
// ui/toolRing.js
export function createToolRing(G) -> Widget   // input.heldFor('tool') >= tuning.toolRingHoldMs opens; release on a socket equips; tap swaps player.tool/lastTool; cancel closes without change
```

Menu law: `cancel` always goes back one level and never changes state; Save is the last item of the pause
menu and `up` from the top wraps to it; opening any scene flushes input (the stack does this).
`tools/fuzz-menus.mjs` presses random actions for N frames from each fixture and asserts stack depth < 7,
a non-black frame every 30 frames, no exceptions.

---

## 8. Data conventions and validation

### 8.1 Conventions

- Ids: `^[a-z0-9][a-z0-9-]*$`, unique within a table. Flags are namespaced (`sp.`, `th.<thread>.`, `np.<npc>.`,
  `sys.`, `seen.`). Display names live in `name` fields.
- Every table file exports frozen arrays/objects; `index.js` merges, freezes and builds `BY_ID` indexes.
  No function values in content files except `art/*` helpers; behaviour is a handler key string.
- Content never imports a system or scene; data imports only other data and `art/palette.js`.
- Tuned numbers live in `data/tuning.js`, `data/dials.js`, `data/loans.js`; systems import constants
  from data, never the reverse. UI copy goes through `strings.js`.
- `tools/new-content.mjs <kind> <id>` scaffolds a file with every required field and appends the index line.

### 8.2 `tools/validate-data.mjs` (Node; exit 1 on error; `file:id: message`; also `test/data.test.mjs`)

- **Species/families**: every form in exactly one family; family Shift pools (`up/side/down/star`) reference
  forms of that family; learnset/heartmark moves exist; abilities exist; `windows` ascend; a sprite exists in
  `art/creatures` for every form (front required, back warns); Heartmark `mark` inside
  `pixelart.opaqueBounds`; palette keys ⊂ MASTER; at most one star form per family.
- **Moves**: type in TYPES or null; effect keys ⊂ `EFFECT_KEYS`; status kinds known; evasion moves pp ≤ 5;
  `signature` species' learnset contains the move.
- **Abilities**: `hook` key exists in `HOOKS` (or null); Ward count equals `tuning.wardCount`.
- **Items**: pocket known; `use` handler key exists in `systems/bag.USE_HANDLERS`; prices ≥ 0; `oneOfAKind` only in keepsakes.
- **Maps**: layer rows are `w` chars × `h` rows; legend chars resolve; warps target existing maps at
  in-bounds tiles passable at some tide; every `tide:'low'` region touches dry land on both ends; spawn
  tables exist; entity ids unique; npc ids exist; trigger scripts exist; regions in bounds; BFS from each
  arrival reaches every warp at low tide (error) and high tide (warning); animated tiles ≤ 400.
- **NPCs**: schedule entries sorted, each `at` on an existing passable tile; `path` ids exist; topic scripts
  exist; `home` map exists; portrait exists; `threadId` matches `threads[].npcId`.
- **Threads**: beat ids unique; scripts exist; conds well-formed; `advance` rule valid.
- **Letters**: `n` contiguous from 1; unlock conds valid; reveal ops valid; `relicId` exists.
- **Scripts**: op names in `OPS`; required fields per op; `goto/choice.goto` labels exist in that script;
  `call` targets exist; item/species/shop/trainer/track refs exist; `choice` has ≥ 1 option; `end` reachable (warn).
- **Trainers**: party species/levels/moves legal; payout ≥ 0; `ai` profile exists; scripts exist.
- **Shops**: hours in 0..1440; stock items exist; keeper exists. **Encounters**: species exist; weights > 0;
  level ranges sane; ≥ 1 unconditional row per table.
- **Tracks**: `audio.normalizeTrack` accepts each; every hour 0..23 maps to a track in `CUES`; required stems present.
- **Conds everywhere**: well-formed; a referenced flag appears in at least one `setFlag`/system emitter (warning).
- **World** (`--world save.json`): schema keys present, every id resolves, party ≤ 6, moves ≤ 4, `v` ≤ SCHEMA_VERSION.

### 8.3 `tools/lint-owners.mjs`

Greps: `world\.(\w+)\s*(=|\.push\(|\.splice\(|delete )` outside the module that owns `<key>` (ownership
table at the top of the tool, one line per world key); `Math.random` outside `js/debug` and `G.entropy`;
`document|window|navigator|localStorage` inside `js/{data,state,battle,world,systems,script}`.

### 8.4 Adopting the prototypes (named changes; everything else moves as-is)

- `proto/battle/types.js` → `data/types.js`: delete `PALETTE`; `typeColour(type)` resolves
  `TYPE_PALETTE_KEY` through `art/palette.MASTER`.
- `proto/battle/moves.js` → `data/moves/<type>.js` + `index.js` (same `m()` helper and fields).
- `proto/battle/abilities.js` → split as §5.1 change 2.
- `proto/battle/species.js` → `data/species/<family>.js`: each file exports `{forms: Species[], family:
  Family}`; `SLOSHKIN_SHIFT_TABLE`-style tables become `family.shiftTable` (§14.2). `expForLevel`,
  `levelFromExp`, `learnableAt`, `canLearn` move to `species/index.js`.
- `proto/battle/creature.js` → `systems/creature.js`: `makeCreature` takes `uid`; `familyId`, `mark`,
  `windowsUsed`, `stillKnot`, `caughtDay`, `caughtMap` added; `serialize/deserialize` kept.
- `proto/battle/engine.js` → `battle/engine.js` per §5.1.
- `proto/creatures/sprites.js` → `art/creatures/<family>.js`: keep `{rows, palette, heartmark, heartmarkBack?,
  back?, idle2?, feature}`; key by **form id** (`sloshkin`), not display name; drop the per-sprite `type`
  field (species data owns it); `squash/hover` use `rows.length`/`rows[0].length` (24×24 forms work);
  `MASTER`/`pal` move to `art/palette.js`.
- `proto/tiles/tiles.js` → `art/tiles/<group>.js` + `art/props.js`; `COLORS` and `ROOF_COLOURS` move to
  `art/palette.js` (the `!` LUT-exempt convention is kept). The `def()` validation becomes a validator rule.
- `proto/tiles/render.js` → split: `gradeFor/gradeHex` into `world/lighting.js` (pure), `createTileset`
  into `art/atlas.js`, `drawMap` into `render/tileRenderer.js` + `render/mapRenderer.js` with chunk caches
  (§12), `drawSkyband` into `render/sky.js`. The hard-coded `resolveGround` legend becomes
  `data/tilesets.DEFAULT_LEGEND`; per-tile tide/night behaviour moves into tile definitions.
- `proto/music/tracks.js` → `audio/tracks/index.js` (+ one file per track); `CUES`, `toEngine`,
  `applyStems`, `stemLayers`, `signalSting` kept verbatim. `validate.mjs` folds into `validate-data.mjs`.

---

## 9. Seeds and determinism

`world.run.seedCode` comes from `core/rng.encodeSeedCode`; `setSeedToggles(DIALS.TOGGLE_ORDER)` is called
at boot (append-only order). The master is `makeRng(world.run.seed)`; nobody draws from it.

```js
/** @param {Store} store @returns {Rngs} */ export function createRngs(store)
/**
 * @typedef {Object} Rngs
 * @property {(label: string) => Rng} stream        STATEFUL: cached Rng restored from world.rng[label] or freshly forked; state written back by commit()
 * @property {(label: string) => Rng} fresh         STATELESS: a new fork each call (callers position it themselves)
 * @property {(kind: string, day: number) => Rng} day   fresh(`${kind}:${day}`) — a reload mid-day reproduces the day's plan
 * @property {(uid: string) => Rng} creature        fresh(`shift:${uid}`); forecast.shiftStream skips c.shiftCount draws
 * @property {(world: World) => Rng} battle         fresh(`battle:${world.stats.battles}`)
 * @property {(world: World) => void} commit        writes every stateful stream's state() into world.rng (store.snapshot calls it)
 */
```

| Label | Used by | Persistence |
| --- | --- | --- |
| `worldgen` | `createNewWorld`: Ward placements, per-seed abilities, disc contents, item shuffles | consumed once; results in `run.gen` |
| `enc:<mapId>` | step encounters, roamers | stateful (`world.rng`) |
| `shift:<uid>` | Forecast cards, picked card, star-touched | stateless; positioned by `creature.shiftCount` |
| `battle:<n>` | accuracy, crit, AI, capture within one battle | stateless per battle; not saved (battles are atomic) |
| `loot` | tree drops, dig finds, Glint, cracks | stateful |
| `fish:<reachId>` | shadows, species, feints, bite window | stateful |
| `weather:<day>`, `shop:<id>:<day>`, `mail:<day>` | daily plans | stateless by day |
| `npc:<id>` | idle wander, chatter picks | not saved (cosmetic) |
| cosmetic | title particles, UI jitter | `G.entropy`, unseeded |

Changing the dial mid-run sets `run.dialChangedMidRun = true` (Seed Card: not race-eligible); `run.gen` is
never recomputed; only odds, scouting and anchor rules read from `data/dials.js` change. Determinism tests
in Node: `createNewWorld(code)` twice → deep-equal; same fixture + same action list → identical battle
events; `rollForecast` across 10 rerolls → identical card sequences; two seeds diverge.

---

## 10. Save/load

```js
/** @param {{storage?: StorageLike, prefix: string, version: number, migrations: Record<number, Function>}} opts @returns {Persist} */
export function createPersist(opts)
/**
 * @typedef {Object} Persist
 * @property {(G: G, reason: string) => SaveResult} autosave      rotates through auto slots (1 slot under No Rewind)
 * @property {(G: G, slot: number) => SaveResult} saveManual
 * @property {(slot: string) => {ok: boolean, world?: World, error?: SaveError}} load   migrates + validateWorld; never writes
 * @property {() => SlotEntry[]} list  @property {(slot: string) => void} remove  @property {() => SlotEntry|null} latest
 * @property {(slot: string) => string} exportString  @property {(str: string) => {ok: boolean, world?: World, error?: SaveError}} importString
 * @property {(G: G, ms: number) => void} tick         route timer: autosave every tuning.routeAutosaveMs when dirty, top scene is overworld, no cutscene running
 * @property {() => boolean} crashed                    last session did not exit cleanly
 */
/** @typedef {{ok: boolean, error?: SaveError, slot: string, place: string, time: string}} SaveResult */
export const AUTOSAVE_TRIGGERS = ['map:enter', 'waystone:use', 'battle:start:story', 'capture:ok', 'shift:resolved', 'loan:paid', 'letter:read', 'day:start'];
```

Built on `core/save.createSaveSystem({storage, prefix, autosaveSlots: NoRewind ? 1 : 3, manualSlots:
NoRewind ? 0 : 3, version: SCHEMA_VERSION, migrations: MIGRATIONS, summarize})` with
`summarize(w) -> {name, place, day, time, tier, badges, playMs, lead: party[0]?.nickname}`. Before every
write: `clockSys.serializeInto(world)`, `rngs.commit(world)`, `validateWorld` (refuse on error, red toast).
Saves never happen inside a transition or while a battle scene is on the stack; mid-cutscene saves store
`world.cutscene = {scriptId, state}` only at a `save` op. Triggers are bus events, not calls in scenes.
Loading never writes. On `ok:false` the HUD shows "Save failed: <code>", `persist` retries once after 2 s,
then keeps the banner until the next success. Export/import strings come from `core/save` (base64 + crc).

*As built: autosaves also wait while a cutscene runs, skip a map loaded by Continue or a new game, and overwrite instead of rotating when they are close together; see §16.3.*

Not saved: NPC entity positions (recomputed from schedules), chunk/sprite/path caches, the animation queue,
toasts, live battle state, tween/fx state, the scene stack.

Crash recovery: boot writes `<prefix>cleanExit = 0`; `pagehide` and explicit quit write `1`. If it reads
`0` at boot, the title offers "Resume from autosave: <place>, <n> minutes ago" and, from `battleBookmark`
and the previous autosave's `stats`, "rolls back: 1 trainer battle". `core/save`'s `.tmp` promotion covers
a crash mid-write.

---

## 11. Debug and test hooks

```js
/** @param {G} G @returns {DebugHook} window.__game; installed only with ?debug=1 (or on localhost) */
export function installDebugHook(G)
/**
 * @typedef {Object} DebugHook
 * @property {G} G  @property {World} world                      live (not a copy)
 * @property {() => World} state                                 structuredClone
 * @property {(mapId: string, x: number, y: number) => void} warp
 * @property {(itemId: string, n?: number) => void} give  @property {(amount: number) => void} earn
 * @property {(hour: number, minute?: number) => void} setTime  @property {(x: number|null) => void} setTide   core/time.freezeTide
 * @property {(speciesId: string, level: number, opts?: object) => Creature} addCreature  @property {() => void} heal
 * @property {(trainerId: string) => Promise<PostBattle>} battle  @property {(speciesId: string, level: number) => Promise<PostBattle>} wild
 * @property {(uid?: string) => Promise<string>} forceForecast
 * @property {(id: string, value?: any) => void} flag  @property {() => Object} flags
 * @property {(n: number) => void} deliverLetter  @property {() => void} sleep  @property {(scriptId: string) => Promise<void>} runScript
 * @property {(mult: number) => void} speed  @property {(on: boolean) => void} skipAnims
 * @property {(action: string, frames?: number) => Promise<void>} press   dispatches KeyboardEvent(code) for the action's primary keyboard token
 * @property {(action: string) => Promise<void>} tap
 * @property {() => Promise<void>} idle                           resolves when no transition, anim or typewriter is running
 * @property {() => string} scene  @property {() => string[]} stack  @property {() => string} text   visible dialogue/menu text for assertions
 * @property {(label: string) => Rng} rng  @property {() => string[]} validate
 * @property {(name: string) => void} marker                       1-frame label in the corner + console `MARK name`
 * @property {Array<{message: string, stack: string}>} errors      window.onerror + unhandledrejection
 * @property {() => {fps: number, update: number, draw: number, drawImages: number, chunks: number, entities: number, particles: number}} perf
 * @property {(reason?: string) => SaveResult} save  @property {(slot: string) => boolean} load  @property {(n: number) => void} step  @property {() => void} pause  @property {() => void} resume
 */
```

Every mutating hook goes through `store.tx`, so events and autosave behave as in play. URL flags:
`debug=1 seed=CODE skipTitle=1 speed=8 touch=1|0 scale=fit slot=auto:1 mute=1 noanim=1 strict=1
scene=battle&trainer=<id>` (jump into a scene for visual work).

`tools/playtest.mjs` (Playwright, dev dependency; `check.sh` skips with a warning when absent) boots with
`?debug=1&seed=TEST-0000-0000&skipTitle=1&speed=8&mute=1&noanim=1`, fails on any console error, and
runs steps that each call `marker()` and screenshot to `test/out/`: (1) arrival completes;
(2) first creature (`party.length === 1`); (3) first wild battle to `battle:end`; (4) first catch
(`fieldLog.forms[x].held`); (5) earn + pay → `loans.tier === 2`, porch flag; (6) `setTime(6)` →
`letters.delivered === 1`, read it; (7) Forecast accepted → `shiftlog.length === 2`; (8) tide gate: bump at
high, cross at low; (9) a day at speed 32: rest → Day Page → NPC at schedule spot; (10) save/export/import
round trip and reload with `slot=auto:1`; (11) `--full`: every Spire in `data.spires` with a cheat party,
pay every tier, deliver every letter, `runScript('relighting')`, `scene() === 'credits'`, Seed Card text,
post-game flag; (12) two seeds diverge, one seed repeats.

Node unit tests: one `test/<module>.test.mjs` per pure file (schema, store, migrate, persist, rngs,
tilemap, tide, pathing, schedule, encounter, interact, battle.*, forecast, capture, exp, party, bag,
wallet, loans, shops, letters, memory, threads, dayPage, fishing, gather, fieldLog, runner, cond,
registry, clockSys, weather). `tools/check.sh`:

```sh
set -e
node tools/validate-data.mjs
node tools/lint-owners.mjs
node tools/smoke-import.mjs
node --test test/
[ -n "$PLAYWRIGHT" ] && node tools/playtest.mjs --quick || echo "skip playtest (set PLAYWRIGHT=1)"
```

---

## 12. Performance budget

Frame budget 16.6 ms; target ≤ 3 ms update + ≤ 7 ms draw on a 2018 laptop in Chrome; Safari is the floor.

- **Tiles**: 8×8-tile chunks (128×128 px) as `OffscreenCanvas` (fallback `createElement('canvas')`), baked
  once per `(chunk, layer, tideVariant, gradeId)`. The view touches ≤ 5×4 chunks → ≤ 60 `drawImage` for
  three layers. A grade change (every 30 in-game minutes = 30 real seconds at default speed) re-bakes only
  visible chunks + one ring (≤ 90 small bakes spread over frames by a work queue); older grades are
  evicted (LRU, 3 grades × 2 tide variants resident). Tide flips are a variant swap plus a 1 s shoreline
  dissolve drawn by `world/tide`. Animated tiles are a separate small pass (≤ 400 per map).
- **Sprites**: `core/pixelart.decodeSprite` caches by content; `art/atlas.js` keeps per-grade recolors of
  character and creature sprites (key `artId|variant|gradeId`; grades quantized so the cache is bounded)
  and packs characters, tiles and icons into ≤ 4 atlases via `buildAtlas` so hot draws are one `drawImage`.
- **Entities**: cap 64 simulated per map (NPCs ≤ 16, roamers ≤ 8, items ≤ 24); only entities within view
  + 2 tiles draw; off-screen NPCs check their schedule every 500 ms. Static props bake into chunks.
- **Light pass**: ≤ 24 radial pools from cached gradient canvases; weather ≤ 200 particles from `core/fx`
  pools (600 total, 250 in `lowPower`); no per-frame allocation (preallocated particle records).
- **Text**: `core/font` per-colour atlases; long panels pre-render to an offscreen canvas and invalidate on change.
- **Audio**: scheduler lookahead 120 ms; sfx rate-limited by `createRateLimiter`.
- **GC**: no closures in hot loops; `visibleTiles()` returns a reused rect; `structuredClone` only at save.
- **Fallback**: 90 consecutive frames > 24 ms → `G.lowPower = true` (`fx.setBudget(0.5)`, light pools
  halved, TICK stays 60 but update may run twice per draw); never flips back in-session. `settings.fps30` forces it.
- **Measurement**: `?debug=1` overlay shows update/draw/present ms and `drawImage` counts (wrapped ctx in
  debug only). `playtest --quick` asserts `perf().fps ≥ 55` over a town walk (soft fail on CI).

---

## 13. Build order and integration plan

### 13.1 Day 1 (BOOT + STATE + DATA-IDX, half a day)

`index.html, css/style.css, main.js, config.js, state/schema.js (createNewWorld + validateWorld),
state/store.js, state/persist.js (thin), data/index.js (empty tables), data/registry.js, debug/flags.js,
debug/hook.js, scenes/boot.js, scenes/title.js (text + New Game), scenes/overworld.js (flat test map,
walkable square), tools/check.sh, tools/smoke-import.mjs, tools/lint-owners.mjs (ownership table)`. Every
other scene exists as a stub that draws its name and pops on `cancel`, so the menu graph is complete
before any content. **Checkpoint 0**: boots with zero console errors; `check.sh` green on empty data;
`?skipTitle=1` lands on a walkable map; `__game` exists.

### 13.2 Dependency tiers (a tier starts when the previous tier's *interfaces* exist, not implementations)

1. **Tier 0 (exists)**: core (+ `fx.js`, `time.js` landing in week 1).
2. **Tier 1 (week 1, parallel)**: `state/*`; `data/*` seeded with 2 maps, 1 family of 3 forms, 8 moves, 2
   NPCs, 3 letters, 1 trainer, 1 shop (enough to exercise every validator rule); `art/palette + atlas +
   tiles + chars`; `audio/director + 2 tracks`; `ui/*`; `world/tilemap + tide + entities + camera +
   player + pathing`; `battle/engine` ported with Node tests; `script/ops + cond + runner`.
3. **Tier 2 (week 2)**: `render/*`; `world/npc, roamer, interact, warps, lighting`; every `systems/*`
   against the schema; `battle/ai, read, effects, abilityHooks`; scenes `dialogue, cutscene, menu, party,
   bag, shop, battle, forecast, saveLoad, settings`; validator at full coverage.
4. **Tier 3 (week 3)**: `systems/flow/*`, loans/ledger/dayPage, letters, threads, fishing/gather scenes,
   map screen, Field Log, ending/credits/seedCard; content ramps on the validator.
5. **Tier 4**: polish, hourly tracks, fuzzing, performance pass, accessibility pass.

### 13.3 Integration checkpoints (each gated by `check.sh` green plus the named playtest steps)

- **C1 (end week 1)**: walk two maps through a door; talk to an NPC via a script; the clock runs; tide
  flips a causeway tile; autosave on door; reload restores position; a scripted trainer battle runs on the
  real engine with placeholder animation. Steps 1, 8, 10.
- **C2 (mid week 2)**: wild battle from grass with the result applied to the party; a catch appears; Field
  Log marks Seen/Held; Forecast resolves from a window. Steps 3, 4, 7.
- **C3 (end week 2)**: the 20-30 minute first session end to end from `playtest --quick`: arrival, first
  creature, first battle, first catch, first loan payment with the build visible next day, first letter at
  06:00, a Forecast, Day Page. Steps 1-9.
- **C4 (week 3)**: `playtest --full` clears the arc with a cheat party: every Spire, Summit, Relighting,
  credits, post-game flag; save round trip; seeds diverge/repeat. Steps 11-12.
- **C5**: menu fuzz 10 minutes without exception or black frame on every fixture; 60 fps on the largest
  map in Chrome/Firefox/Safari; touch run on a phone.

### 13.4 Ownership boundaries that prevent merge conflicts

A system touches only its own `world.<key>`; schema changes go through STATE, who adds the key with its
default and a migration the same day. Scenes call systems; systems never import scenes. UI never imports
systems (it reads `G.world` and emits intents through the scene). Data authors add files and one index
line. Art authors add sprite defs under their own files and one line in `art/*/index.js`. `main.js` and
`config.js` are BOOT-only; unfinished scenes hide behind `config.FEATURES` so partial builds never show
dead doors.

### 13.5 Dependency line

`core → state → data-idx → {systems, battle, script} → world → render → ui → scenes → main`. Content
lanes depend only on `data-idx` conventions and the validator; art lanes only on `core/pixelart` and
`art/palette`.

### 13.6 Required changes to core (small, named; owner CORE)

- `core/fx.js` (new, per contract) plus `setBudget(f: number)` scaling every emitter.
- `core/time.js` (new, per contract) plus `setMinutesPerDay(n)` (settings screen) and
  `freezeTide(x: number|null)` (debug only, never serialized). `serialize()/restore()` exactly as the
  contract says because `world.clock` stores the output.
- `core/audio.js`: no change. `setStem` fan-out for `perc.kick/snare/hat` is handled by
  `audio/tracks.applyStems` (already written in the music proto).
- `core/input.js`, `core/scene.js`, `core/save.js`, `core/rng.js`, `core/pixelart.js`, `core/font.js`,
  `core/canvas.js`, `core/events.js`, `core/tween.js`: no change.

---

## 14. How chapter writers must format content

Rules for every example: kebab-case ids, frozen exports, one entry per file where the manifest says so, one
index line to register it, then `node tools/validate-data.mjs`. Never edit `js/systems`. Names and
numbers below are placeholders, not decisions.

### 14.1 Species (one form) — `js/data/species/<family>.js`

```js
import { sp } from './_helpers.js';   // sp(id, name, types, familyId, stage, [hp,atk,def,spa,spd,spe], ability, learnset, heartmark, catchRate, expYield, growth, flags)
export const forms = [
  sp('sloshkin', 'Sloshkin', ['Brine'], 'sloshkin', 1, [60, 62, 55, 50, 55, 38], 'shoresense',
    [[1, 'tap'], [1, 'salt-spray'], [5, 'undertow'], [9, 'settle'], [17, 'shellguard']],
    'undertow', 45, 64, 'medium-slow', { roleTag: 'starter_base' }),
];
```

Fields: `id, name, types[1..2], familyId, stage 0..4, base, ability, learnset [[level, moveId]], heartmark
(moveId | null), catchRate 3..255, expYield, growth 'fast'|'medium-fast'|'medium-slow'|'slow', flags`.

### 14.2 Family (Shift table) — same file

```js
export const family = {
  id: 'sloshkin', name: 'Sloshkin line', windows: [9, 20, 34],        // curve levels where a window opens
  shiftTable: {                                                       // per current form: pools by direction, weights relative
    sloshkin:  { up: [{ form: 'skeinwing', w: 3 }, { form: 'brinelance', w: 1 }], side: [{ form: 'puddlepip', w: 1 }], down: [] },
    skeinwing: { up: [], side: [{ form: 'vesperay', w: 1 }], down: [{ form: 'sloshkin', w: 1 }] },
  },
  star: 'vesperay',                                                   // optional star-touched form
};
```

**Amendment (GDD-00 §8):** pool entries may name forms of other families (the target must be a real species), and `w` may be a single number > 0 or per-dial weights `{ drift, flux, freefall }` (each ≥ 0, at least one > 0; 0 = never on that dial). `tools/validate-data.mjs` enforces both.

### 14.3 Move — `js/data/moves/<type>.js`

```js
import { m } from './_helpers.js';   // m(id, name, type|null, category, power, accuracy|null, pp|null, priority, effect, text, signature?)
export default [
  m('undertow', 'Undertow', 'Brine', 'physical', 65, 100, 15, 0,
    { stat: [{ target: 'foe', stat: 'spe', stages: -1 }], contact: true }, "Lowers the target's Speed one stage.", 'sloshkin'),
];
```

Effect keys must be in `EFFECT_KEYS` (§5.1). `accuracy: null` = never misses; `pp: null` only for Scrap.

### 14.4 Map — `js/data/maps/<map>.js`

```js
export default {
  id: 'town-quay', name: 'The Quay', kind: 'exterior', region: 'town', w: 24, h: 12,
  legend: { '=': 'quay-cobble' },                      // extends DEFAULT_LEGEND (D deep, S shallows, A sand, W wet-sand, E causeway, G grass, T tall-grass, P path, O cobbles, K pier ...)
  ground: [
    'DDDDDDDDDDDDSSSSSSAAAAAA',
    'DDDDDDDDDSSSSSSAAAAAGGGG',
    // ... 12 rows of 24 chars
  ],
  overlay: null,                                       // optional layers may be omitted
  props: [{ art: 'lighthouse', x: 20, y: 0 }],
  entities: [
    { kind: 'npc', id: 'wren', x: 10, y: 6 },          // placement comes from her schedule; this is the fallback
    { kind: 'tree', id: 'pear-1', x: 15, y: 4, fruit: 'pear' },
    { kind: 'sign', id: 'quay-sign', x: 12, y: 7, text: 'Quay. Mind the tide.' },
  ],
  triggers: [{ x: 11, y: 8, kind: 'use', id: 'mailbox', verb: 'mailbox' }],
  warps: [{ x: 9, y: 5, to: { mapId: 'int-cottage', x: 4, y: 7, facing: 'up' }, kind: 'door', sfx: 'doorOpen' }],
  spawns: [{ area: 'grass', table: 'town-grass', rate: 0.08 }],
  regions: { porch: { x: 8, y: 5, w: 4, h: 2 } },
  entry: { x: 10, y: 9, facing: 'up' },
};
```

### 14.5 NPC with schedule, topics and lines — `js/data/npcs/<npc>.js`

```js
export default {
  id: 'wren', name: 'Wren Hearthwright', species: 'beaver', portrait: 'wren', sprite: 'beaver-f', home: 'int-yard',
  threadId: 'wren-tally',
  schedule: [
    { at: 6 * 60,  mapId: 'int-yard',  x: 5, y: 4, pose: 'stand' },
    { at: 9 * 60,  mapId: 'town-quay', x: 10, y: 6, pose: 'sweep', path: 'quay-sweep' },
    { at: { tide: 'low' }, mapId: 'town-flats', x: 3, y: 9, pose: 'wander', wanderR: 3, cond: { weather: ['clear', 'mist'] } },
    { at: 20 * 60, mapId: 'town-quay', x: 9, y: 7, pose: 'sit', days: [0, 1, 2, 3, 4] },
    { at: 23 * 60, mapId: 'int-yard',  x: 2, y: 2, pose: 'sleep' },
  ],
  topics: [
    { id: 'first-loan', cond: { not: { flag: 'sp.loan-explained' } }, script: 'wren-loan-intro', priority: 10, once: true },
    { id: 'pay-reminder', cond: { loan: { paid: false } }, script: 'wren-pay', priority: 2, repeatDays: 1 },
  ],
  lines: {
    generic: [{ id: 'g1', text: 'Tally sticks never lie, Keeper.' }, { id: 'g2', text: 'Dad says the light used to hum. I was three.' }],
    sweep: ['Cobbles grow sand overnight. Nobody knows how.'],
    night: ['Someone is always buying, even now.'],
    porch: ['{player}. Sit a minute?'],
  },
};
```

### 14.6 Script — `js/data/scripts/<chapter>.js`

```js
export default {
  'wren-loan-intro': [
    "Wren: You'll want a roof before the Ebb wind. Interest-free; seven tiers.",
    { op: 'choice', options: [
      { text: 'Show me the ledger.', goto: 'ledger' },
      { text: 'Later.', goto: 'later' },
    ], defaultIndex: 1 },
    { op: 'label', id: 'ledger' },
    { op: 'move', who: 'wren', path: 'LLU', wait: true },
    { op: 'give', item: 'tally-stick', n: 1 },
    { op: 'setFlag', id: 'sp.loan-explained' },
    { op: 'thread', id: 'wren-tally', beat: 1 },
    { op: 'goto', id: 'done' },
    { op: 'label', id: 'later' },
    "Wren: The sticks will wait. The tide won't.",
    { op: 'label', id: 'done' }, { op: 'end' },
  ],
};
```

### 14.7 Life thread — `js/data/threads/<thread>.js`

```js
export default {
  id: 'wren-tally', npcId: 'wren', title: 'Seven Notches',
  beats: [
    { id: 1, cond: { loan: { tier: 2 } }, script: 'wren-tally-1', advance: { dayOfWeek: [0] } },
    { id: 2, cond: { all: [{ thread: { id: 'wren-tally', beat: 1 } }, { letter: { read: 12 } }] }, script: 'wren-tally-2', where: { mapId: 'town-point', x: 6, y: 3 }, reward: { share: true } },
  ],
};
```

### 14.8 Letter — `js/data/letters/<chapter>.js`

```js
export default [
  { n: 1, from: 'Mabry Coil', to: 'The Keeper, Point Cottage', date: 'Ebb 3, thirty years gone', seal: 'wax-blue',
    body: 'The light held through the first gale. I counted eleven boats home. The twelfth was yours.|Write when the causeway dries.',
    relicId: null, unlock: null,                       // default unlock: previous letter read
    reveal: [{ op: 'setFlag', id: 'sp.letter-1-read' }] },
];
```

### 14.9 Shop — `js/data/shops.js`

```js
export const SHOPS = Object.freeze([
  { id: 'chandlery', keeper: 'tam', hours: [7 * 60, 21 * 60],
    stock: [{ item: 'lantern-1' }, { item: 'lantern-2', cond: { badge: 2 } }, { item: 'starsalt', rotate: 'daily', qty: 3 }],
    buys: ['fish', 'fruit', 'relics'], priceMult: 1.0, nightKeeper: 'hesper' },
]);
```

### 14.10 Trainer — `js/data/trainers.js`

```js
export const TRAINERS = Object.freeze([
  { id: 'linnet-1', name: 'Linnet Rask', title: 'Rival', class: 'rival', portrait: 'linnet',
    party: [{ species: 'scrapling', level: 6 }, { species: 'wirewhisk', level: 5, moves: ['arc-ping', 'jolt'] }],
    items: [{ id: 'salve', heal: 20 }], ai: 'trainer', payout: 300, tacticTag: 'rush',
    scripts: { before: 'linnet-1-before', afterWin: 'linnet-1-win', afterLoss: 'linnet-1-loss' } },
]);
```

### 14.11 Encounter table — `js/data/encounters.js`

```js
export const ENCOUNTERS = Object.freeze({
  'town-grass': [
    { species: 'puddlepip', levels: [2, 4], w: 40 },
    { species: 'wirewhisk', levels: [3, 5], w: 25 },
    { species: 'chillnub', levels: [3, 5], w: 20, cond: { phase: ['night', 'evening'] } },
    { species: 'squallcoil', levels: [30, 30], w: 0.1, errant: true, cond: { weather: ['storm'] } },
  ],
});
```

### 14.12 Item and collection rows — `js/data/items.js`, `js/data/collections.js`

```js
{ id: 'lantern-1', name: 'Lantern', pocket: 'catch', price: 250, sell: 125, stack: 20, use: 'capture:1', oneOfAKind: false, text: 'Shows the odds before you commit.' }
{ id: 'pearlfin', name: 'Pearlfin', kind: 'fish', where: ['shallows', 'river'], when: { phase: ['dawn', 'dusk'] }, tide: 'any', shadow: 'small', size: [12, 30], tell: 'two short feints then a long pull', price: 90 }
```

---

## 15. openForGDD — the only places waiting on the design panel

1. **Title / folder name** (`config.TITLE`, save prefix, the deliverable folder).
2. **Exact map list** and region ids (`data/maps/*`, `MapDef.region`); the architecture fixes only the format.
3. **Story scene list and beats**: arrival script, the Relighting (`scenes/ending.js`), credits text, any
   extra story screens (title-card interstitials) — all authored as scripts/data; only `ending.js` needs a
   bespoke scene and its beats are open.
4. **Currency display names and the Starsalt / anchor costs** (`strings.js`, `tuning.js`); wallet keys are fixed (`main, starsalt, anchors, purse`).
5. **Loan ladder values and commissions** (`data/loans.js`), **dial rule tables** (`data/dials.js`), and
   every number in `data/tuning.js` (EXP shares, blackout cost, capture bands, Reroll cost, no-repeat days).
6. **Doubles battles**: the engine is singles; a yes needs a scheduled engine extension.
7. **Training Yard** kept or cut (`world.yard` exists either way).
8. **Which verbs become creature-aware** (fishing with Brine, shaking with Gust): the hook is
   `systems/{fishing,gather}` reading `party` through a `tuning.creatureBonuses` table; the table is open.
9. **Spire count, Summit structure, badge gates** (`data/trainers.js` + `badge` conds).
10. **Letter count and order**, letter → flag reveals, and how letters pace loans/badges (`EVENT_SCRIPTS`, conds).
11. **Challenge mode list** beyond No Rewind and One Heart (`data/dials.CHALLENGES`).
12. **Cast merge**: which NPC ids exist, their schedules, threads and shops; the formats in §14 are fixed.
13. **Weather kinds and seasonal festivals** (`weather.js` kinds list, `schedules.js` festival days).

---

## 16. As built (2026-10-28)

This section records how the shipped code differs from the draft above, after the integration, three fix waves and the final fix pass. The module JSDoc is the reference for exact signatures.

### 16.1 Where the code wins on signatures

These were left as built and the draft text above was not rewritten (reconcile-notes lists each one):

- `world/tilemap.loadMap(def, tiles, {legend})` takes the tileset, not the Registry; `js/world` never imports `js/data`.
- `world/interact` `INTERACTION_PRIORITY` is per entity kind (npc > roamer > item > sign > use-trigger > tree > rock > boat > prop > water > crack/mud > door > tile).
- `world/warps.resolveWarp(world, warp, data, tideState, opts)` adds the reasons `'unknown-map'` and `'blocked'`.
- The path cache is a standalone LRU (`createPathCache`) owned by the overworld scene, not `store.derived`.
- `systems/forecast.rollForecast(world, creature|uid, data, opts)`; rules modules take data injected and tunables as `DEFAULTS` plus a `tuning` argument.
- The cutscene's `startBattle` pushes the `battle` scene with the setup; `G.flow` is not set and is not needed.
- `js/scenes/scriptHost.js` and `js/scenes/nameEntry.js` are shared modules, not registered scenes.

### 16.2 Save format v7

`js/state/schema.js` `SCHEMA_VERSION = 7`. `js/state/migrate.js` `MIGRATIONS` holds one step per version, keyed by the version upgraded from, and `fillDefaults` adds new keys afterwards. Fixtures `test/fixtures/v0.json`–`v2.json` and `v4.json`–`v7.json` (there is no `v3.json`) back the step tests: `test/state.migrate.test.mjs` (0→1, 1→2), `test/systems.econ.test.mjs` (2→3) and `test/state.migrate-v5/-v6/-v7.test.mjs` (4→5, 5→6, 6→7); the 3→4 step is tested in `test/sys-town.adversarial.test.mjs` from a built world.

| Step | What it does |
|---|---|
| 0 → 1 | Stamps the version on pre-versioned data. |
| 1 → 2 | Weather grows to the full WeatherState; the first tick after loading rolls the day. |
| 2 → 3 | Satchel pockets become the GDD-00 pockets (`wicks medicine discs finds held keepsakes tools`); old pockets fold in. |
| 3 → 4 | Letters record which letters arrived (`got`) on three channels; new NPC memory keys; the Day Page tally opens on the save's day. |
| 4 → 5 | Fishing reaches recover from `reachAt` (stamped at load time); the Patient record board, the Kiln clean day and the `encounter` key join. |
| 5 → 6 | **The EXP curve changed** (8·L² everywhere → 8·L² through Lv8, then (3·L³ − 512)/2). Every party and box creature keeps its level and its progress through that level: EXP is rebased from the old band onto the new one. Saves holding the Weather, Relay or Mirror badge receive the gift v5 never gave (Scouting Prism, Weatherglass, Plumbline disc) unless they already hold it. |
| 6 → 7 | **Real Clock across sessions.** `clock.realOffset` (optional leaf, `null` until core/time writes it) holds the run-relative calendar offset, so days that pass between sessions count. A legacy Real Clock save, whose `clock.total` held the epoch day, is rebased onto the run's own day count: D whole days (the earliest day stamp) come off `clock.total`, off every day stamp (`day` / `*Day` keys, `saidLines`, `picked`, `trees`), off total-minute stamps (`reachAt`) and off the day-valued flags (`sys.duel.*`, `sys.relighting-due`, `sp.late-delivery`); `realOffset` becomes D days so the wall clock keeps the same run day. |

Under Real Clock the run calendar decides the weekday and the spring tide, so the first Lantern Market is always day 7. A Real Clock re-anchor never runs the clock backwards; if the device hour is earlier than the game hour, the clock walks forward to the next day and still fires `day:start` and the morning anchor.

### 16.3 Autosave rules (`js/state/persist.js`)

- **Triggers** (`AUTOSAVE_TRIGGERS`): `map:enter`, `waystone:use`, `battle:start` with a story payload (emitted by the battle scene once it is on the stack, so this save is held and lands after the battle and its cutscene), `capture:ok`, `shift:resolved`, `loan:paid`, `letter:read`, `day:start`; plus the route timer (`tuning.routeAutosaveMs`, 90 s while dirty on the overworld). Explicit calls (a script's `save` op, Sleep, the Ledger) write at once.
- **Waiting.** An autosave asked for during a transition or while a battle is on the stack is held, not failed. Trigger and route autosaves are also held while a **cutscene** is on the stack and land when it ends (FE-01: a save taken mid-script let Continue replay a Forecast and Shift the same creature twice). A held `day:start` keeps its place; a later trigger does not replace it.
- **Loads are not walks.** A `map:enter` of kind `enter` or `load` (Continue, new game) does not autosave.
- **Spacing.** An autosave less than `AUTOSAVE_MIN_SPACING_MIN` (120 game minutes) after the newest auto slot of the same seed overwrites that slot instead of rotating. Each rotated slot stores `summary.autoAnchor`, the game minute it was rotated in, and an overwrite keeps it, so a save every 30 game minutes still rotates every 2 hours. `day:start` always rotates.
- **Slots:** 3 auto + 3 manual; No Rewind keeps 1 auto and no manual slots (`persist.setNoRewind` runs as soon as a run starts). Mid-cutscene state is stored only at a `save` op (`world.cutscene`).
- Every write still goes snapshot → `validateWorld` (refuse on any problem) → verified write; loading never writes.

### 16.4 Journal stamps (`js/systems/stamps.js`)

- The table is `STAMPS` in `js/data/town.js` (24 rows). Each row has a `cond`; nine also carry `counter: {id, on, match?}`.
- `stamps.install(G, {rows: STAMPS})` (from `main.js`) subscribes to each counter's bus event; every matching payload adds 1 to a `stamp.*` counter through `systems/flags`, in one `store.tx`. `match` is `{field: value}`: an array matches any entry, `false` also matches an absent field. `derivePayload` fills fields an emitter leaves out (`battle:end {trainerId}` gets `porchDuel` from the trainer's class). Emitters carry `scripted` on `capture:ok` and `porchDuel` on `battle:end`.
- A stamp is earned when its `cond` holds (`earnedStamps`). `scenes/letter.announceStamps` marks each newly earned stamp once (flag `stamp.got.<id>`) and shows **one** toast for all of them (`stamp.earnedMany`). It runs when the player is back in the field after the scene that earned them (not during a cutscene) and when the Day Page closes. The Journal's Stamps tab marks new stamps with a quiet NEW tag instead of toasting.

### 16.5 Story and day condition semantics (`js/script/cond.js`, `js/script/registry.js`)

- **`day`** reads `selectors.gameDay(world)`: the run's own day number, 1-based, where day 1 is the arrival (a Sunday). Never an absolute calendar day, also under Real Clock. `day.dow` is the GDD weekday with 0 = Monday, so day 1 is `dow` 6 and Saturdays (market and spring tide) are days 7, 14, 21.
- **`hour: [a, b]`** is half-open and wraps midnight when `a > b`. **`loan.tier`** takes a number (current tier ≥ n) or `{gte, lte, eq}`. **`hasItem`** on a currency (Starsalt, Anchor Stones) reads the wallet.
- **`npc.met`** is set by talking to an NPC and also when the NPC speaks a line in a story script or cutscene (`memory.meet` from the script session). Story lines do not add to the talk count.
- **Act gating** (`js/data/scripts/triggers.js`): Act II opens at badge 1 or on day 4, whichever comes first. The `act-two-*` rows fire `act-2-open` on `{any: [{badge: 1}, {day: {gte: 4}}]}`, and every Spire badge beat (`story-acts.js` `spireBadge`) also ends with "if not `sp.act-2`, call `act-2-open`", because the Spire's own `badge:won` row wins that event. The comet needs `sp.act-2`; the Surge and Two Plans need `sp.act-3`; the first Lantern Market needs `sp.act-2`; Linnet's fall needs the first market. None of the act, Surge, market, fall or Two Plans beats fires after `sp.relighting`. The `dark-house-night` row comes before every other `clock:hour` row, so no other row can take its night.
- **Thread pacing in talk.** `registry.resolveNpc` offers a thread beat through `threads.beatTopics`: one beat a day, `advance.days` spacing (Mudlark Mile beat 2 waits two days), weekday beats, porch-only beats, and a beat carried by another NPC. NPC topics whose script is a thread-beat script are skipped, so a topic can no longer bypass the pacing. A beat's own `cond` can add place (for example `map` + `inRegion`, as on oyster-boat beat 2).
- **Day-valued flags.** `sys.relighting-due` holds a clock day and `sp.late-delivery` a GDD day; both are rebased by the v7 migration with the other day stamps.
- **New script op** `restartSummit` (clears the Keepers' and the Champion's `sys.trainer.*` flags), used by the Summit Bell's decline choice on Drift and Flux. The cutscene's `forecast` op accepts `who: 'reading'` for the Reading's offer card, though the ending script does not call it yet.
