# Architecture Proposal B — Data-Driven Extensibility

Architect B. Bias: everything content-shaped is data; systems are composable; adding a creature, map, neighbor, letter or cutscene never touches engine code; strong determinism; every rule testable under Node.

This proposal builds on the modules that actually exist in `_merge-wip/js/core/` (rng, events, font, pixelart, canvas, input, audio, save, scene) and on the contract for the three that do not exist yet (tween, fx, time). It adopts the interfaces of `proto/battle/{types,moves}.js` and `proto/creatures/sprites.js` and says where they must change (§14). It is content-agnostic: the design panel can change numbers, cast, map count, letter count and dial rules without an engine change, because all of those are data tables validated by `tools/validate-data.mjs`.

Four rules govern everything below:

1. **One world object.** All mutable game state lives in a single JSON-serializable `world` (§3). Systems mutate it only through exported functions in their own module, each taking `world` as the first argument. No system holds private mutable state that matters to a save.
2. **Content is data, behaviour is a registry lookup.** Species, moves, abilities, items, maps, NPCs, schedules, shops, letters, trainers, encounter tables, scripts, fish, bugs, relics, loans, tracks: each is a pure ES module exporting frozen objects with string ids, collected by a per-table index file. Behaviour that varies per item (an ability's hook, an item's use effect, a tile's interaction) is named by a string key that resolves in a small handler registry, so new behaviour = add a handler, new content = add a row.
3. **Conditions and scripts are interpreted, not coded.** A tiny condition DSL (§6.4) and a declarative op-array script format (§6) express every gate, dialogue, cutscene, life-thread beat and letter trigger. Both run in Node with a fake host.
4. **Randomness is forked by label and saved by state.** Every random decision draws from a named fork of the run seed (§9). Same seed + same choices = same Forecasts, encounters, weather and shop stock.

---

## 1. Folder layout and file manifest

Deliverable folder: `practice-games/<title>/` with `index.html`, `css/`, `js/`, `test/`, `tools/`, `README.md`. Each file carries an **owner lane** in brackets; ~22 lanes, so ~20 engineers can work without touching each other's files. A lane owns its files' contents; cross-lane needs go through the JSDoc interfaces in this document, never by editing another lane's file. Index files (`*/index.js`) are append-only, one line per entry, and are the only shared touch points.

```
index.html                       [BOOT] single canvas host + touch overlay mount + noscript
css/style.css                    [BOOT] black letterbox, crisp canvas, touch button chrome, fullscreen
README.md                        [BOOT] how to run, controls, credits, seed codes
js/main.js                       [BOOT] boot, URL flags, fixed-step loop, scene stack wiring, debug hook install

js/core/                         [CORE] existing engine, unchanged API (rng events font pixelart canvas input audio save scene)
js/core/tween.js                 [CORE] ease + createTweens (contract)
js/core/fx.js                    [CORE] createFX: pooled particles, shake, flash (contract)
js/core/time.js                  [CORE] createClock: accelerated day, tide model, real-clock mode (contract)

js/state/schema.js               [STATE] JSDoc typedefs for World and every sub-record; SCHEMA_VERSION; createNewWorld(seedCode, options)
js/state/store.js                [STATE] createStore(world): events, dirty flags, transactions, derived-cache side table
js/state/migrate.js              [STATE] migrations {fromVersion: fn}; migrate(data) -> World
js/state/selectors.js            [STATE] pure read helpers (partyAlive, curveLevel, loanTier, hour, tideState)

js/data/index.js                 [DATA-IDX] aggregates every table into DATA = {species, families, moves, ...}; the only file that imports every table
js/data/registry.js              [DATA-IDX] createRegistry(DATA): get(table,id) throws readable errors; has(); list(); plus handler registries
js/data/types.js                 [DATA-BATTLE] from proto/battle/types.js: TYPES, TYPE_CHART, effectiveness, wordFor (PALETTE removed, see §14)
js/data/moves/index.js           [DATA-BATTLE] from proto/battle/moves.js, split per type file; MOVES, getMove, isDamaging...
js/data/moves/*.js               [DATA-BATTLE] one file per type (plain.js, grit.js, ...), each exports an array of Move
js/data/abilities.js             [DATA-BATTLE] ABILITIES {id, name, text, ward: bool, hooks: {onHit, onSwitchIn, ...} as handler-key strings}
js/data/species/index.js         [DATA-SPECIES] SPECIES by id; FAMILIES by id (Shift pools: up/side/down/star lists with weights)
js/data/species/*.js             [DATA-SPECIES] one file per family (sloshkin.js, prismoth.js ...): forms, base stats, learnsets, windows
js/data/items.js                 [DATA-ECON] ITEMS {id, name, pocket, price, sell, stack, use: handlerKey, oneOfAKind}
js/data/loans.js                 [DATA-ECON] LOANS tiers {tier, amount, build, roofChoices, scaffoldStage, commissionSlot}
js/data/shops.js                 [DATA-ECON] SHOPS {id, keeper, hours, stock: [{item, cond?, rotate?}], buys: predicate key, priceMult}
js/data/economy.js               [DATA-ECON] prices, Wanted Today pools, buyer hours, payout curves, blackout cost
js/data/dials.js                 [DATA-ECON] DIALS {drift, flux, freefall} tables + CHALLENGES + seed toggle registry order
js/data/trainers.js              [DATA-CAST] TRAINERS {id, name, class, portrait, party: [{species, level, moves?, ability?}], ai, payout, scripts}
js/data/npcs/index.js            [DATA-CAST] NPCS by id {id, name, species(anthro), portrait, sprite, home, schedule, topics, memory, threadId}
js/data/npcs/*.js                [DATA-CAST] one file per neighbor or named character
js/data/schedules.js             [DATA-CAST] SCHEDULES {id: [{from, to, days?, at: {map, x, y} | path: id, pose, cond?}]}
js/data/threads/index.js         [DATA-THREADS] THREADS by id; one file per life thread {id, owner, beats: [{id, cond, script, reward?}]}
js/data/threads/*.js             [DATA-THREADS]
js/data/letters/index.js         [DATA-LETTERS] LETTERS ordered array; LETTER_ORDER
js/data/letters/*.js             [DATA-LETTERS] chapters of letters {n, from, to, date, body, seal, unlock?, reveal?}
js/data/scripts/index.js         [DATA-SCRIPTS] SCRIPTS by id (cutscenes, porch talk, shop talk, Spire intros)
js/data/scripts/*.js             [DATA-SCRIPTS] chapter files; each exports {id: Op[]}
js/data/maps/index.js            [DATA-MAPS] MAPS by id (one line per map)
js/data/maps/*.js                [DATA-MAPS] one map per file (town-quay.js, isle-brindle.js, interior-cottage.js ...)
js/data/tilesets.js              [DATA-MAPS] TILES {id -> {art, solid, water, tide: 'always'|'low'|'high', verb?, sfx, anim}}
js/data/encounters.js            [DATA-MAPS] ENCOUNTERS {tableId: [{species, levels:[a,b], w, cond?}]} referenced from maps
js/data/collections.js           [DATA-GATHER] FISH, BUGS, RELICS, FRUIT tables {id, name, price, where, when, tell, shadow, size}
js/data/dialogueText.js          [DATA-CAST] shared short strings (verbs, UI labels) so copy edits are one file

js/systems/conditions.js         [SCRIPT] evalCond(world, cond, ctx): the condition DSL
js/systems/script.js             [SCRIPT] createRunner(ops, ctx) coroutine interpreter; OP_NAMES; pure-op handlers
js/systems/flags.js              [STATE] setFlag/getFlag/incCounter + quest-step helpers
js/systems/party.js              [RULES-CREATURE] addCreature, heal, swap, box moves, Heartmark pin, Memory moves, levelUp, grantExp
js/systems/creature.js           [RULES-CREATURE] makeCreature(species, level, rng), stats, catch-uid, Shiftlog, bond pips
js/systems/forecast.js           [RULES-SHIFT] rollForecast, applyShift, anchor, reroll cost, odds math per dial, windows
js/systems/exp.js                [RULES-CREATURE] exp curves, bench/yard split, catch-up, damping
js/systems/capture.js            [RULES-CAPTURE] captureOdds(dial), attemptCapture(rng), Capture Stance clamp
js/systems/bag.js                [RULES-ECON] give/take/count, pockets, Keepsakes cursor rule, stack limits, overflow basket
js/systems/wallet.js             [RULES-ECON] earn/spend, Starsalt, Summit Purse deposits
js/systems/loans.js              [RULES-ECON] pay(amount), tier completion, overnight build queue, scaffold stage, commissions
js/systems/shops.js              [RULES-ECON] stock for (shop, day, rng), buy/sell, Wanted Today, hours
js/systems/letters.js            [SYS-TOWN] nextLetter(world), deliverMorning, read/unread, reveal flags
js/systems/schedule.js           [SYS-TOWN] whereIs(npcId, world) -> {map,x,y,pose,pathId}; interpolated along path
js/systems/memory.js             [SYS-TOWN] neighbor memory: remember(npc, key, value), nickname, lastTalked, favours
js/systems/threads.js            [SYS-TOWN] life threads: eligible beats, advance, resident share payment
js/systems/dayPage.js            [SYS-TOWN] overnight step: builds, letters, Day Page summary, regrowth, reach recovery
js/systems/fishing.js            [SYS-GATHER] pure fishing state machine (cast, feints, bite window, land/release), reach health, tells
js/systems/gather.js             [SYS-GATHER] shakeTree, dig, bugNet, Glint, cracks per day, regrowth timers
js/systems/fieldLog.js           [SYS-GATHER] Seen/Read/Held + collections registry + completion %
js/systems/encounter.js          [WORLD-ENT] step-based wild encounter roll, Errant odds, table filtering by time/tide/cond
js/systems/weather.js            [WORLD-FX] daily weather roll, transitions, effects on tables
js/systems/autosave.js           [STATE] subscribes to store events and fires save per trigger table; crash marker
js/systems/stats.js              [STATE] statistics counters (forecasts, catches, steps, play time, Ward walls)

js/battle/engine.js              [BATTLE-RULES] createBattle(setup) -> {state, legalActions, submit(actions) -> BattleEvent[]}; pure
js/battle/damage.js              [BATTLE-RULES] damage formula, crit, stages, evasion cap, Mends cap
js/battle/effects.js             [BATTLE-RULES] move effect handler registry keyed by moves.js effect keys
js/battle/abilityHooks.js        [BATTLE-RULES] ability hook registry (Wards, Shoresense, ...)
js/battle/ai.js                  [BATTLE-RULES] trainer/wild AI: pickAction(state, side, rng, profile)
js/battle/events.js              [BATTLE-RULES] BattleEvent typedefs + EVENT_NAMES
js/battle/read.js                [BATTLE-RULES] Read card contents per dial; Ward tell data

js/world/map.js                  [WORLD-MAP] loadMap(def) -> RuntimeMap {w,h,layers,collision(x,y,tide),triggersAt,warpAt}
js/world/chunks.js               [WORLD-MAP] chunk cache: 8x8 tile offscreen canvases per layer, invalidate(tile), tide variants
js/world/camera.js               [WORLD-MAP] createCamera: follow, bounds, shake offset, toScreen/toWorld
js/world/tide.js                 [WORLD-MAP] tide mask -> passability + shoreline animation frames + glow strength
js/world/lighting.js             [WORLD-FX] day/night tint pass, light sources (porches, lantern, lighthouse), fireflies
js/world/weatherFx.js            [WORLD-FX] rain/snow/mist/meteor render pass driven by world.weather
js/world/entities.js             [WORLD-ENT] entity list, y-sort, pooled creation, update loop
js/world/player.js               [WORLD-ENT] grid movement, run, facing, step events, tool use
js/world/npc.js                  [WORLD-ENT] NPC entity: schedule-driven pathing, pose, bubble, interact
js/world/roamer.js               [WORLD-ENT] visible roaming creatures (overworld encounters)
js/world/pathing.js              [WORLD-ENT] BFS/A* on collision grid with tide state, path cache
js/world/interact.js             [WORLD-ENT] facing-tile resolution -> context verb -> action dispatch
js/world/warps.js                [WORLD-MAP] door/causeway/stepping-stone transitions, tide gates, arrival facing

js/scenes/boot.js                [SCN-FLOW] asset warm-up (atlases, font), first-frame stub
js/scenes/title.js               [SCN-FLOW] title, continue/new/seed entry, dial pick
js/scenes/leaseCard.js           [SCN-FLOW] character creation (species, name, pronoun, colour)
js/scenes/overworld.js           [SCN-WORLD] the field scene: map, entities, HUD, tool ring, encounters
js/scenes/battle.js              [SCN-BATTLE] drives battle/engine; animation queue; menus; capture flow
js/scenes/forecast.js            [SCN-BATTLE] Shift Forecast: three cards, Accept/Reroll/Anchor, flip
js/scenes/dialogue.js            [SCN-UI] modal text box + choices + portraits; hosts script runner requests
js/scenes/cutscene.js            [SCN-UI] non-opaque script host over overworld (camera, move, emote ops)
js/scenes/menu.js                [SCN-MENU] pause menu root (Party, Bag, Log, Map, Ledger, Settings, Save last)
js/scenes/party.js               [SCN-MENU] party/box, summary page, Shiftlog, Coverage view
js/scenes/bag.js                 [SCN-MENU] pockets, use/give/toss, Keepsakes confirm
js/scenes/fieldLog.js            [SCN-MENU] bestiary + collections tabs
js/scenes/ledger.js              [SCN-MENU] loans, tally wall, commissions, Commons jar
js/scenes/mapScreen.js           [SCN-MENU] isle map, tide table, fast travel
js/scenes/shop.js                [SCN-UI] buy/sell lists
js/scenes/letter.js              [SCN-UI] letter reader (torn paper), seal break
js/scenes/dayPage.js             [SCN-UI] Dimity's Day Page / overnight transition
js/scenes/fishing.js             [SCN-GATHER] fishing minigame view over systems/fishing
js/scenes/settings.js            [SCN-MENU] volume, day length, text speed, rebind, scale mode, accessibility
js/scenes/saveLoad.js            [SCN-MENU] slots, export/import string, crash resume
js/scenes/credits.js             [SCN-FLOW] ending, Relighting, credits, Seed Card

js/ui/theme.js                   [UI-KIT] palette tokens, paper/ledger chrome colours, spacing
js/ui/panel.js                   [UI-KIT] drawPanel(ctx, rect, style): torn paper, ledger, wax seal, tally
js/ui/focus.js                   [UI-KIT] createFocus(): focus model over d-pad, pointer, touch; hit rects
js/ui/list.js                    [UI-KIT] createList: scrolling, cursor, repeat, pointer hover/tap
js/ui/grid.js                    [UI-KIT] createGrid: 2D cursor (bag, box, tool ring)
js/ui/tabs.js                    [UI-KIT] tabs with l/r
js/ui/confirm.js                 [UI-KIT] confirm dialog, default-safe cursor, names the thing being spent
js/ui/toast.js                   [UI-KIT] toast queue
js/ui/textbox.js                 [UI-KIT] typewriter text box with speed, skip, page breaks
js/ui/hud.js                     [UI-HUD] clock, tide, wallet, tool, context verb, pending pips
js/ui/toolRing.js                [UI-HUD] 8-socket ring: hold opens, tap swaps last two
js/ui/widgets.js                 [UI-KIT] bars (HP, EXP, glow meter), pips, badges, type chips with icon+word
js/ui/icons.js                   [UI-KIT] 8x8 icon sprites (string art) for verbs, tells, types

js/art/palette.js                [ART-SHARED] MASTER palette (from proto sprites.js), type -> key, UI tokens
js/art/creatures/index.js        [ART-CREATURES] CREATURE_SPRITES by species id (from proto/creatures/sprites.js)
js/art/creatures/*.js            [ART-CREATURES] one family per file
js/art/heartmark.js              [ART-CREATURES] drawHeartmark(ctx, sprite, placement, bonded)
js/art/tiles/index.js            [ART-TILES] TILE_ART by tile id: rows, autotile variants, anim frames
js/art/tiles/*.js                [ART-TILES]
js/art/chars/index.js            [ART-CHARS] CHAR_SPRITES: player species variants, NPCs, 4-dir walk frames
js/art/chars/*.js                [ART-CHARS]
js/art/props.js                  [ART-TILES] trees, boats, lamps, scaffolding stages, roof colours
js/art/portraits.js              [ART-CHARS] 32x32 portraits per NPC
js/art/atlas.js                  [ART-SHARED] buildGameAtlases(): packs decoded sprites via core/pixelart.buildAtlas

js/audio/director.js             [AUDIO] createMusicDirector(audio, store): hour -> track, stems by night/tide/weather/battle
js/audio/tracks/index.js         [AUDIO] TRACKS by id (defineTrack payloads)
js/audio/tracks/*.js             [AUDIO] one track per file (dawn.js, morning.js, ... battle.js, spire.js, forecast.js)
js/audio/sfxMap.js               [AUDIO] verb/event -> sfx name + pitch rules

test/*.test.mjs                  [TOOLS] one per js/systems, js/battle, js/state, js/world pure file; data validation test
test/fixtures/                   [TOOLS] canned worlds at checkpoints (arrival, first-catch, badge1, loan7)
tools/validate-data.mjs          [TOOLS] cross-reference validator (§8)
tools/playtest.mjs               [TOOLS] Playwright full-arc bot (§11)
tools/screenshot.mjs             [TOOLS] menu state graph screenshots
tools/serve.mjs                  [TOOLS] zero-dep static server for tests
tools/check.sh                   [TOOLS] validate + unit tests + playtest
tools/new-content.mjs            [TOOLS] scaffolds a map / npc / species file from a template
```

Lane count: BOOT, CORE, STATE, DATA-IDX, DATA-BATTLE, DATA-SPECIES, DATA-ECON, DATA-CAST, DATA-THREADS, DATA-LETTERS, DATA-SCRIPTS, DATA-MAPS, DATA-GATHER, SCRIPT, RULES-CREATURE, RULES-SHIFT, RULES-CAPTURE, RULES-ECON, SYS-TOWN, SYS-GATHER, WORLD-MAP, WORLD-ENT, WORLD-FX, BATTLE-RULES, SCN-FLOW, SCN-WORLD, SCN-BATTLE, SCN-UI, SCN-MENU, SCN-GATHER, UI-KIT, UI-HUD, ART-SHARED, ART-CREATURES, ART-TILES, ART-CHARS, AUDIO, TOOLS. Several lanes are small enough for one engineer to own two.

---

## 2. Boot and main loop

`index.html` contains one `<div id="stage">`, a `<div id="touch">` mount, and `<script type="module" src="js/main.js">`. No DOM UI except the touch overlay (owned by core/input) and a `<noscript>`. `css/style.css` sets `html,body{margin:0;background:#000;height:100%;overflow:hidden}`, `#stage{position:fixed;inset:0}`, and the touch button classes.

`main.js` does, in order:

```js
/** @typedef {{debug:boolean, seed:string|null, skipTitle:boolean, speed:number, touch:string|null, slot:string|null, scale:'integer'|'fit'}} BootFlags */
/** @param {string} search @returns {BootFlags} */ export function parseFlags(search)
```

1. `parseFlags(location.search)`; 2. `createDisplay({width:480,height:270,parent:stage,mode})`; 3. `createInput({canvas: display.canvas, display, touch})`; 4. `createSaveSystem({prefix:'<title>.', version: SCHEMA_VERSION, migrations: MIGRATIONS, summarize})`; 5. build `DATA` via `js/data/index.js` and `registry = createRegistry(DATA)` (validates ids in debug mode, throws readable errors); 6. `createSceneStack({input, width:480, height:270})`; 7. construct the `Game` context object (§2.2) and the music director; 8. `installDebugHook(game)` when `flags.debug`; 9. `stack.push(bootScene)`; 10. `requestAnimationFrame(frame)`.

### 2.1 Loop

Fixed timestep for simulation, free-running render, no interpolation (pixel art at 16px tiles moves in whole pixels; interpolation would smear):

```js
const STEP = 1000 / 60;            // ms
let acc = 0, last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(now - last, 250); last = now;     // clamp after tab sleep
  acc += dt * game.speed;                               // debug speed multiplies simulation only
  input.update();
  let steps = 0;
  while (acc >= STEP && steps < 8) { stack.handleInput(input); stack.update(STEP); acc -= STEP; steps++; }
  if (steps === 8) acc = 0;                             // 30fps fallback: drop time rather than spiral
  stack.draw(display.ctx);
  display.present();
}
```

`document.addEventListener('visibilitychange')` pauses: `game.paused = true`, `clock.pause()`, `audio` music gain ducks to 0 over 200ms, and the accumulator is reset on resume so no catch-up burst happens. The world clock is driven from `stack.update` by the overworld scene only (`clock.update(dt)`), so time does not pass in battle, Forecast, menus or dialogue. Resize is handled by `core/canvas` (its `onResize` just re-lays out the touch overlay). The 30fps fallback is automatic: if the frame budget is missed for 60 consecutive frames, `game.lowPower = true` turns off the lighting pass's per-pixel work and halves particle budgets (§12).

### 2.2 The Game context (the only "global", passed explicitly)

```js
/**
 * @typedef {Object} Game
 * @property {import('../core/canvas.js').Display} display
 * @property {Input} input
 * @property {SceneStack} stack
 * @property {Store} store            // §3
 * @property {Registry} data          // §8
 * @property {SaveSystem} saves
 * @property {Clock} clock            // core/time, bound to store.world.clock
 * @property {AudioEngine} audio
 * @property {MusicDirector} music
 * @property {Tweens} tweens          // scene-local tweens are created per scene; this one is for toasts
 * @property {FX} fx                  // screen-level fx (flash, shake)
 * @property {number} speed           // debug multiplier
 * @property {BootFlags} flags
 * @property {Rng} entropy            // non-deterministic rng for cosmetic only (title particles)
 */
```

Scenes are factories `createXScene(game) -> Scene` and receive params through `stack.push(scene, params)`. Nothing imports `game` from a module; it is handed to the factory.

### 2.3 Title → lease card → overworld

```
boot ──replace──▶ title ──push──▶ saveLoad (continue)  ──pop(result:{world})──▶ title ──replace──▶ overworld
                   │
                   └──replace──▶ leaseCard ──(builds world via createNewWorld)──replace──▶ overworld(params:{arrival:true})
overworld ──push──▶ cutscene('arrival') ──pop──▶ overworld
overworld ──push──▶ battle ──push──▶ forecast ──pop──▶ battle ──pop({result})──▶ overworld
overworld ──push──▶ menu ──push──▶ party/bag/... ──pop──▶ menu ──pop──▶ overworld
```

Transitions use `stack.transition('fade'|'iris'|'wipe', ms, fn)`; the midpoint callback performs the push/replace. Arrival on a new world is itself data: `world.pendingScript = 'arrival'` is consumed by the overworld scene on first `enter`, so the opening cutscene is authored like any other script. `?skipTitle=1&seed=...` makes `boot` call `createNewWorld` with a default lease card and `replace(overworld)` directly.

---

## 3. The game state store

### 3.1 Shape (`js/state/schema.js`)

One file, JSDoc only, no logic except `createNewWorld` and `SCHEMA_VERSION`. Abbreviated here; the real file documents every field.

```js
export const SCHEMA_VERSION = 1;

/**
 * @typedef {Object} World
 * @property {number} v                    SCHEMA_VERSION this object conforms to
 * @property {RunConfig} run               seed, dial, toggles, challenge modes; immutable after new game except dial
 * @property {PlayerState} player          map, x, y, facing, species, name, pronoun, colours, tool, lastTools
 * @property {Creature[]} party            max 6
 * @property {Creature[]} box
 * @property {string[]} yard               creature uids in the Training Yard
 * @property {Bag} bag                     {pockets: {items:[{id,n}], tools, discs, keepsakes, catch}, capacity}
 * @property {Wallet} wallet               {buttons, starsalt, purse}
 * @property {LoanState} loans             {tier, paid, builds:[{tier,roof,commission,built}], scaffold, commons: {jar, built:[]}}
 * @property {Object<string, boolean|number|string>} flags   story + system flags, namespaced ids ('sp.badge1', 'th.tuck.3')
 * @property {Object<string, number>} counters              step counts, uses, rematches
 * @property {ThreadState} threads         {[threadId]: {beat: number, done: boolean, started: number}}
 * @property {LetterState} letters         {delivered: number, read: number[], today: string|null}
 * @property {Object<string, NpcMemory>} npcs   {[npcId]: {met, talks, lastDay, nickname, favours:[], mood, remembered:{}}}
 * @property {MapState} maps               {[mapId]: {items: {[key]: 'taken'|dayTaken}, trees: {[key]: regrowDay}, cracks, reach: {[id]: health}, visited}}
 * @property {ClockState} clock            core/time serialize(): {day, minute, speed, realClock, minutesPerDay}
 * @property {WeatherState} weather        {today: 'clear'|'rain'|'mist'|'storm'|'snow'|'meteor', tomorrow, intensity}
 * @property {FieldLog} fieldLog           {forms: {[formId]: 0|1|2|3}, fish: {}, bugs: {}, relics: {}, tells: {[fishId]: count}}
 * @property {Settings} settings           volumes, textSpeed, dayLength, scaleMode, bindings, accessibility toggles, autoAnchor presets
 * @property {RngState} rng                {[label]: number[] | number}  saved fork states or draw counts (§9)
 * @property {Statistics} stats            playMs, steps, forecasts, catches, wardWalls, summitAttempts, blackouts
 * @property {string[]} pendingShifts      creature uids with an open Shift window (deferred to next Waystone)
 * @property {string|null} pendingScript   script id to run on next overworld enter
 * @property {BattleBookmark|null} battleBookmark  pre-battle autosave info for crash recovery (not the battle itself)
 */

/**
 * @typedef {Object} Creature
 * @property {string} uid         'c' + catch sequence; stable, used as rng fork label
 * @property {string} species     current form id
 * @property {string} family
 * @property {string} nick
 * @property {number} level @property {number} exp
 * @property {number} hp
 * @property {{atk:number,def:number,spa:number,spd:number,spe:number,hp:number}} trained
 * @property {MoveSlot[]} moves      [{id, pp, ppMax}] max 4
 * @property {string[]} memory       move ids parked by Shifts
 * @property {string|null} heartmark pinned technique id
 * @property {{x:number,y:number}} mark   per-individual Heartmark placement
 * @property {number} bond           0..5
 * @property {string|null} held
 * @property {string} ability
 * @property {string[]} shiftlog     form ids in order
 * @property {number} shiftCount     draws taken from this creature's Shift stream
 * @property {number[]} windowsUsed  indices of windows consumed
 * @property {{kind:string, turns:number}|null} status
 * @property {boolean} wild          false once caught (Heartmark lights)
 * @property {number} caughtDay @property {string} caughtMap
 */
```

Every other record (`RunConfig`, `Bag`, `LoanState`, `NpcMemory`, `MapState`, `Settings`, ...) gets the same treatment. Rule for the schema: **ids only, never object references** (a creature stores `species: 'sloshkin'`, never the species object), **no `undefined`** (use `null`), **no Maps/Sets/Dates** (plain objects, arrays, numbers, strings, booleans). `tools/validate-data.mjs` has a `--world file.json` mode that checks a save against the schema and the registry.

### 3.2 Store (`js/state/store.js`)

```js
/**
 * @param {World} world
 * @param {{bus?: Bus}} [opts]
 * @returns {Store}
 */
export function createStore(world, opts)
/**
 * @typedef {Object} Store
 * @property {World} world                 the live object; read freely, mutate only via system functions
 * @property {Bus} bus                     core/events bus; systems emit 'party:changed', 'wallet:changed', 'flag:set', 'map:enter', 'day:start', 'letter:delivered', 'loan:paid', 'shift:resolved', 'capture:ok', 'battle:end', 'save:requested'...
 * @property {(label: string, fn: (world: World) => any) => any} tx   runs fn, marks dirty, emits 'tx' {label}; nested txs collapse
 * @property {() => boolean} dirty @property {() => void} clean
 * @property {Map<string, any>} derived    NOT serialized: path caches, sprite handles, schedule lookups; cleared on load
 * @property {(world: World) => void} replace   swap in a loaded world; clears derived; emits 'world:replaced'
 * @property {() => World} snapshot        structuredClone for saving
 */
```

The mutation rule, enforced by review and by a debug-mode `Proxy` (installed only with `?debug=1&strict=1`) that throws if `world` is written outside a `tx`: a system file exports functions like `pay(world, amount) -> PayResult`, and scenes call `store.tx('loan.pay', w => loans.pay(w, 28000))`. Systems are pure with respect to `world` plus an explicit `rng` and `now`/`clock` argument; they never import the store, so Node tests call them directly on fixture worlds.

### 3.3 Versioning and migration

`world.v` is stamped by `createNewWorld`. `createSaveSystem({version: SCHEMA_VERSION, migrations: MIGRATIONS})` applies `js/state/migrate.js` steps keyed by source version on `load()`/`importString()`. Each step is a pure function `(data) => data` with a Node test that loads `test/fixtures/v<n>.json` and asserts the result validates. Rule: never rename a field in place; add the new one, fill it in the migration, delete the old one in the migration.

---

## 4. Overworld architecture

### 4.1 Map data module

A map is one data file. Layers are strings (one char per tile, decoded by a legend) so maps are hand-editable in a text editor and diffs are readable; 100x80 tiles is 8 KB per layer.

```js
/**
 * @typedef {Object} MapDef
 * @property {string} id @property {string} name @property {'exterior'|'interior'} kind
 * @property {number} w @property {number} h
 * @property {string} tileset                    tilesets.js id
 * @property {Object<string, string>} legend     char -> tile id ('.' = empty)
 * @property {string[]} ground                   h rows of w chars
 * @property {string[]} [detail]                 drawn over ground, under entities
 * @property {string[]} [overlay]                drawn over entities (tree tops, eaves)
 * @property {string[]} [collision]              '#' solid, '.' free, 'w' water (swim never), 'L' passable only at low tide, 'H' passable only at high tide (boats), 'g' tall grass
 * @property {string[]} [tide]                   'f' flat (floods at high tide), 's' stepping stone, 'c' causeway, 'm' mud (glows at night low); drives render + collision
 * @property {TriggerDef[]} triggers             {x,y,w?,h?, kind:'step'|'use'|'enter', cond?, script|warp|verb}
 * @property {WarpDef[]} warps                   {x,y, to:{map,x,y,facing}, kind:'door'|'edge'|'causeway'|'stones', tide?:'low', sfx?}
 * @property {SpawnDef[]} spawns                 {area:{x,y,w,h}|'grass'|'water'|'mud', table: encounterTableId, rate, time?:['night'], tide?:'low'}
 * @property {EntityDef[]} entities              {kind:'npc'|'item'|'tree'|'rock'|'crack'|'sign'|'prop'|'roamer', id, x, y, ...kind props, cond?}
 * @property {string} [music]                    overrides the hourly track (interiors, Spires)
 * @property {{ambient?: string, indoor?: boolean}} [light]
 * @property {string[]} [regions]                named rects for scripts ('quay', 'green') -> used by camera/move ops
 */
```

Legend chars map to `tilesets.js` entries that own art id, solidity, verb and sfx. Autotiling (shore edges, grass edges, path corners) is computed at load by `world/map.js` from neighbours, so authors paint only base tiles.

### 4.2 Runtime map and chunks

```js
/** @param {MapDef} def @param {Registry} data @returns {RuntimeMap} */
export function loadMap(def, data)
/**
 * @typedef {Object} RuntimeMap
 * @property {string} id @property {number} w @property {number} h
 * @property {(x:number, y:number, tide: TideState, mover: 'walk'|'npc'|'roamer') => boolean} passable
 * @property {(x:number, y:number) => TileInfo|null} tileAt          merged ground+detail info incl. verb
 * @property {(x:number, y:number) => TriggerDef[]} triggersAt
 * @property {(x:number, y:number) => WarpDef|null} warpAt
 * @property {(x:number, y:number) => SpawnDef|null} spawnAt
 * @property {Uint8Array} tideMask  per-tile code
 * @property {Object<string, {x:number,y:number,w:number,h:number}>} regions
 */

/** @param {RuntimeMap} map @param {TileArtResolver} art @returns {ChunkCache} */
export function createChunkCache(map, art)
/**
 * @typedef {Object} ChunkCache
 * @property {(ctx: CanvasRenderingContext2D, layer: 'ground'|'detail'|'overlay', cam: Camera, variant: ChunkVariant) => void} draw
 * @property {(x:number, y:number) => void} invalidate   a tile changed (dug hole, shaken tree frame, built porch)
 * @property {(variant: ChunkVariant) => void} prewarm   build chunks for the visible area + 1 ring
 * @property {() => {chunks:number, bytes:number}} stats
 */
/** @typedef {{tide: 'low'|'high', animFrame: 0|1|2|3}} ChunkVariant */
```

Chunks are 8x8 tiles (128x128 px). A 480x270 view touches at most 4x4 = 16 chunks per layer; the cache keeps 48 per layer per variant (LRU). Tide has two variants of the ground layer (flats dry / flats flooded), so the causeway appearing is a chunk swap plus a 1-second shoreline dissolve drawn by `world/tide.js`. Animated water uses 4 frames at 2 fps, only for chunks that contain water tiles (flag set at build time).

### 4.3 Camera

```js
/** @returns {Camera} */ export function createCamera({w: 480, h: 270})
/** @typedef {{x:number, y:number, follow(target, {lerp}), bounds(map), update(dt), toScreen(wx, wy), toWorld(sx, sy), visibleTiles(), shake(amount, ms)}} Camera */
```

The camera rounds to whole pixels before drawing, and the overworld scene translates `ctx` once per frame.

### 4.4 Entities

```js
/**
 * @typedef {Object} Entity
 * @property {string} id @property {'player'|'npc'|'roamer'|'item'|'tree'|'rock'|'crack'|'sign'|'prop'|'boat'} kind
 * @property {number} x @property {number} y        tile coords
 * @property {number} px @property {number} py      pixel offset while moving
 * @property {'up'|'down'|'left'|'right'} facing
 * @property {boolean} solid @property {number} z     y-sort key override
 * @property {(dt:number, w: WorldCtx) => void} update
 * @property {(ctx: CanvasRenderingContext2D, cam: Camera, art: ArtCtx) => void} draw
 * @property {Interaction|null} interaction          {verb: 'Talk'|'Shake'|'Dig'|'Fish'|'Read'|'Open'|'Pay'|'Rest'|..., script?, handler?}
 * @property {EntityDef} def
 */
/** @returns {EntityManager} */ export function createEntities(map, store, data)
/** @typedef {{list: Entity[], add(e), remove(id), at(x,y), update(dt, ctx), drawSorted(ctx, cam, art), find(id), rebuildFromDefs(tide, clock)}} EntityManager */
```

Entity defs in a map carry `cond` (condition DSL); `rebuildFromDefs` runs on map enter, day start and flag changes (debounced), so a neighbor appears or a dark house opens without code. NPC entities do not store position in `world`; `systems/schedule.js` is the source of truth:

```js
/** @param {NpcDef} npc @param {World} world @param {Registry} data @returns {{map:string, x:number, y:number, pose:string, pathId:string|null, t:number}} */
export function whereIs(npc, world, data)
```

`whereIs` resolves the schedule entry for the current day-of-week, minute and conditions, and interpolates along a named path when an entry says `path:`. On the current map the NPC entity walks the real tiles toward that target via `world/pathing.js` (A* on the collision grid with the current tide; path cached in `store.derived` keyed by (npc, target, tide)); when the player is on another map the NPC is simply "there" when the player arrives. A per-NPC `maxCatchUpTiles` keeps catch-up walks short.

Roaming creatures (`roamer`) are visible wild encounters drawn from the map's spawn tables by `systems/encounter.js`; walking into one starts the battle with that species pre-rolled, so the roll is still seeded.

### 4.5 Interaction system

```js
/** @param {Entity} player @param {RuntimeMap} map @param {EntityManager} ents @param {World} world @returns {ContextAction|null} */
export function resolveFacing(player, map, ents, world)
/** @typedef {{verb: string, icon: string, target: Entity|TileInfo|TriggerDef, run: (game: Game) => void}} ContextAction */
```

Priority: entity in facing tile → `use` trigger on facing tile → tile verb (water: Fish; mud at low tide: Dig; tree: Shake) → nothing. The HUD shows the verb and icon; `confirm` runs it. Tool use is the same path with the held tool as a filter: a net turns "Look" at a bug into "Catch". Verb handlers live in a registry `INTERACTIONS[verb] = (game, target) => void` in `world/interact.js`; map authors use verb names, never functions.

### 4.6 Encounters

```js
/** @param {World} world @param {RuntimeMap} map @param {Rng} rng @param {{x,y,tide,phase,weather}} ctx @returns {EncounterResult|null} */
export function rollStep(world, map, rng, ctx)
/** @typedef {{species:string, level:number, errant:boolean, tableId:string}} EncounterResult */
```

The rng is the fork `enc:<mapId>` (§9); per-step rate comes from the spawn def; table rows are filtered by `cond` (time/tide/weather/flags) before weighting, so night-only and low-tide-only creatures are table rows, not code. Errants are a table row with a `w` of 1/300 and `errant: true`.

### 4.7 Render passes

Per frame, in order: (1) clear; (2) ground chunks; (3) detail chunks; (4) tide pass (water animation over flats, shoreline dissolve, glowing mud at night low); (5) entities y-sorted; (6) overlay chunks; (7) weather pass (rain streaks, mist bands, snow, meteors; pooled particles); (8) lighting pass; (9) `fx` (shake offset already applied, flash); (10) HUD; (11) modal scenes above (dialogue, menus) drawn by the stack.

Lighting pass (`world/lighting.js`): a 480x270 offscreen "light buffer" filled with the phase tint from a 24-stop colour ramp (data in `js/art/palette.js`), light sources (porch lamps, the player's Lantern, the lighthouse beam by scaffold stage, fireflies) painted with `'lighter'` radial gradients, then composited over the scene with `globalCompositeOperation = 'multiply'`. Daytime skips the pass entirely. In `lowPower` mode the buffer is 240x135 and upscaled.

### 4.8 Map transitions

`world/warps.js` resolves a warp when the player enters a warp tile (edge, door) or presses confirm at a door. Causeways and stepping stones are not warps: they are tiles whose collision code is `L`, so they are walkable when `tideState` is `low` or `rising`-under-0.35 and water otherwise. A player standing on an `L` tile when the tide rises is pushed to the nearest dry tile with a splash and the toast "The tide came in." (never trapped: `world/tide.js.nearestDry(map, x, y)` is guaranteed to exist because the validator checks every `L` region touches dry land on both ends). Interiors are ordinary maps with `kind:'interior'`, `light.indoor = true` (no day tint, lamp sources only) and their own `music`. Transition: `stack.transition('fade', 300, () => overworld.changeMap(to))`; the overworld scene is not replaced, it swaps its runtime map, entity manager and chunk cache, and emits `map:enter` (an autosave trigger).

---

## 5. Battle integration

### 5.1 Pure engine

```js
/**
 * @typedef {Object} BattleSetup
 * @property {'wild'|'trainer'|'spire'|'summit'|'duel'} kind
 * @property {Creature[]} player         live references are NOT passed; deep copies of party records
 * @property {Creature[]} foe
 * @property {string|null} trainerId
 * @property {DialRules} rules           from data/dials.js resolved for world.run
 * @property {{captureStance:boolean, canRun:boolean, holdOut?:number}} opts
 * @property {string} seedLabel          rng fork label, e.g. 'battle:17'
 */
/** @param {BattleSetup} setup @param {Registry} data @param {Rng} rng @returns {Battle} */
export function createBattle(setup, data, rng)
/**
 * @typedef {Object} Battle
 * @property {BattleState} state           plain object; the scene reads it to draw HP, stages, PP, Ward badges
 * @property {() => Action[]} legalActions  0-PP moves excluded; Scrap when all 0; Run greyed in trainer fights; Read once per foe
 * @property {(action: Action) => BattleEvent[]} submit   advances one full turn (AI picks foe action internally) and returns ordered events
 * @property {() => BattleOutcome|null} outcome   {winner, captured?, exp:[{uid, amount}], payout, fled}
 */
/** @typedef {{t:'turnStart'|'useMove'|'damage'|'effective'|'blocked'|'wardTell'|'miss'|'stat'|'status'|'heal'|'faint'|'switch'|'read'|'capture'|'captureFail'|'glow'|'exp'|'levelUp'|'learnMove'|'message'|'end', [k:string]: any}} BattleEvent */
```

`submit` is the only way the state advances; it never touches `world`. The engine uses `data/moves.js` effect keys verbatim (`stat`, `status`, `recovery`, `guard`, `evasion`, `plumbline`, `scrap`, `multiHit`, `drain`, `selfKo`, `charge`, `spread`, `revealMoves`, `queuedType`) via `battle/effects.js` registry `EFFECTS[key](ctx)`; abilities via `battle/abilityHooks.js` `HOOKS[hookName]`. Unknown keys fail validation, never at runtime.

### 5.2 Scene and animation queue

`scenes/battle.js` owns an animation queue:

```js
/** @typedef {{run: (api: AnimApi) => Generator<number|Promise<void>, void, void>, skippable: boolean}} Anim */
/** @returns {{push(anim), update(dt), idle(): boolean, skip()}} */ export function createAnimQueue()
```

Each `BattleEvent` maps to an `Anim` factory in `BATTLE_ANIMS[event.t]` (sprite lunge, HP bar tween via `core/tween`, text via `ui/textbox`, `audio.sfx` via `audio/sfxMap`, Ward shimmer, shake). The scene state machine: `menu` → `submit(action)` → `playing` (drains events; confirm skips the current anim) → `menu` or `done`. The battle is atomic from the store's point of view: on `enter` the scene calls `store.tx('battle.start')` to set `world.battleBookmark` (kind, trainerId, map, position) and autosave fires before Spire/rival/Summit battles; on `done` the scene applies the outcome in one tx:

```js
/** @param {World} world @param {BattleOutcome} out @param {Battle} battle @param {Registry} data @returns {PostBattle} */
export function applyOutcome(world, out, battle, data)   // js/systems/party.js
/** @typedef {{levelUps: Array<{uid, from, to, newMoves: string[]}>, windowsOpened: string[], captured: Creature|null, blackout: boolean, payout: number}} PostBattle */
```

`applyOutcome` copies HP/PP/status back by uid, grants EXP through `systems/exp.js` (bench 60%, yard 25%, catch-up, damping flags), raises levels, pushes newly opened Shift windows onto `world.pendingShifts`, adds a captured creature via `party.addCreature` (party or box), and charges the blackout cost. The scene then shows the "Open Forecast now / Later" prompt if `windowsOpened.length`, pushing `forecast` for each accepted one, and pops with `{result: PostBattle}` so the overworld can run blackout-to-porch or trainer post-battle scripts (`trainers.js` `scripts.afterWin` / `afterLoss` ids).

### 5.3 Capture flow

Capture is an action like any other: `{kind:'capture', item:'lantern-2'}`. `systems/capture.js`:

```js
/** @param {Creature} foe @param {string} lanternId @param {World} world @param {Registry} data @returns {{p:number, band:'Low'|'Fair'|'Good', shown: string}} */
export function captureOdds(foe, lanternId, world, data)
/** @param {number} p @param {Rng} rng @returns {{ok:boolean, segments:0|1|2|3}} */
export function attemptCapture(p, rng)
```

The bag scene inside battle shows `shown` (exact % on Drift/Flux, band on Freefall) per Lantern before spending it. The engine emits `glow` events (segments 1..3, each one a meter tick, no input timing) then `capture` or `captureFail` (adding +3% to a per-foe counter in battle state). The sure-catch Lantern sits in `pockets.keepsakes` with `oneOfAKind: true`; `ui/confirm` is invoked with the target's name and `defaultIndex: 1` (No).

### 5.4 Forecast scene and Shift flow

`systems/forecast.js` is pure:

```js
/** @param {Creature} c @param {World} world @param {Registry} data @param {Rng} stream @returns {Forecast} */
export function rollForecast(c, world, data, stream)
/** @typedef {{cards: [Card, Card, Card], odds: [number, number, number], starTouched: string|null, bondShift: number, dial: string, rerollCost: number}} Forecast */
/** @typedef {{dir:'up'|'side'|'down', form: string, types: string[], totalDelta: number, ability: string, isWard: boolean, keeps: number, seen: boolean, read: boolean}} Card */
/** @param {Forecast} f @param {Rng} stream @returns {0|1|2} */ export function flip(f, stream)
/** @param {World} world @param {string} uid @param {string} formId @param {Registry} data @returns {ShiftResult} */ export function applyShift(world, uid, formId, data)
/** @param {World} world @param {string} uid @returns {boolean} */ export function anchor(world, uid)
```

`stream` is `rng.fork('shift:' + uid)` fast-forwarded by `c.shiftCount` draws (§9). Reroll pulls the next draw and increments `shiftCount`; the cost table is dial data. `scenes/forecast.js` draws the three cards (silhouette via `pixelart.silhouette` when `!seen` on Freefall), handles Accept/Reroll/Anchor with the confirm for one-of-a-kind stones, plays the 1.5 s flip with no input read, then calls `applyShift` in one tx (which updates species, moves→memory, Shiftlog, Field Log Held, and emits `shift:resolved`, an autosave trigger). The scene is pushed from battle (immediately) or from the overworld at a Waystone/door (deferred list) and from boss scripts via the `forecast` op (§6) for scripted foe Shifts.

---

## 6. Dialogue, cutscene and quest scripting

### 6.1 Format

A script is an array of ops. Each op is a plain object with `op` and arguments; nested blocks are arrays. Labels are strings.

```js
/** @typedef {
 *  {op:'say', who?: string, text: string, emote?: string, portrait?: string} |
 *  {op:'choice', prompt?: string, options: Array<{text: string, cond?: Cond, goto?: string, then?: Op[]}>, defaultIndex?: number} |
 *  {op:'if', cond: Cond, then: Op[], else?: Op[]} |
 *  {op:'branch', on: string, cases: Object<string, Op[]>} |      // on a flag/counter value
 *  {op:'label', id: string} | {op:'goto', id: string} |
 *  {op:'setFlag', id: string, value?: any} | {op:'inc', id: string, by?: number} |
 *  {op:'give', item: string, n?: number} | {op:'take', item: string, n?: number} |
 *  {op:'earn', amount: number} | {op:'spend', amount: number} |
 *  {op:'addCreature', species: string, level: number, nick?: string} |
 *  {op:'move', who: string, path: Array<'u'|'d'|'l'|'r'> | {to: [number, number]}, run?: boolean, wait?: boolean} |
 *  {op:'face', who: string, dir: 'up'|'down'|'left'|'right'|'player'} |
 *  {op:'emote', who: string, kind: '!'|'?'|'♥'|'…'|'zzz'} |
 *  {op:'wait', ms: number} |
 *  {op:'camera', to: string|[number, number]|'player', ms?: number} |
 *  {op:'playSfx', name: string} | {op:'music', track: string|null, fade?: number} | {op:'stem', name: string, on: boolean} |
 *  {op:'openShop', shop: string} | {op:'startBattle', trainer?: string, wild?: {species, level}, kind?: string, holdOut?: number} |
 *  {op:'forecast', who: 'player:uid'|'foe', scripted?: {form: string}} |
 *  {op:'letter', n?: number} | {op:'toast', text: string} | {op:'warp', map: string, x: number, y: number, facing?: string} |
 *  {op:'tide', set?: number} | {op:'sleep'} | {op:'thread', id: string, beat?: number} |
 *  {op:'remember', npc: string, key: string, value: any} |
 *  {op:'call', script: string} | {op:'end'}
 * } Op */
```

Text supports `{player}`, `{nick:uid}`, `{npcNick}`, `{wallet}` interpolation, `|` for page breaks and `~` for a 300 ms beat. Every op name is in `OP_NAMES`; the validator rejects anything else and type-checks each op's fields.

### 6.2 Interpreter

Coroutine style, pure, resumable:

```js
/**
 * @param {Op[]} ops
 * @param {ScriptCtx} ctx     {world, data, rng, vars: {}, npc?: string}
 * @returns {Runner}
 */
export function createRunner(ops, ctx)
/**
 * @typedef {Object} Runner
 * @property {(answer?: any) => Request|{done: true}} step     runs pure ops until a host op; returns the host request
 * @property {() => RunnerState} save        {pc: number[], vars, callStack}  (so a save mid-dialogue is possible but we only save between scripts)
 * @property {(s: RunnerState) => void} restore
 */
/** @typedef {{op: string, [k: string]: any, id: number}} Request */
```

Pure ops (`if`, `branch`, `setFlag`, `inc`, `give`, `take`, `earn`, `spend`, `addCreature`, `remember`, `thread`, `label`, `goto`, `call`, `end`) execute inside `step` by calling the matching system function on `ctx.world` (`bag.give`, `wallet.earn`, `flags.set`, ...). Host ops (`say`, `choice`, `move`, `face`, `emote`, `wait`, `camera`, `playSfx`, `music`, `stem`, `openShop`, `startBattle`, `forecast`, `letter`, `toast`, `warp`, `tide`, `sleep`) are yielded as a `Request`; the host performs it and calls `step(answer)` with the result (`choice` → index, `startBattle` → `PostBattle`, `forecast` → form id, everything else → `undefined`). In Node a fake host answers requests from a list, and a test asserts the world after the script. The condition evaluator and interpolation are pure.

Hosts: `scenes/dialogue.js` (modal, opaque:false; handles `say`/`choice`/`letter`/`openShop` by pushing the relevant scene and resuming on pop) and `scenes/cutscene.js` (opaque:false, `updateBelow:true` so the world animates; handles `move`/`face`/`camera`/`emote`/`wait`/`warp`/`startBattle`/`forecast`). Both share `js/systems/scriptHost.js`-style glue inside the scene (a `HOST_OPS` table from op → function returning a promise-like completion), text speed from `settings`, skip by `cancel` (finishes the current typewriter; a second press advances), and a hold-to-fast-forward for re-watched scripts (flag `seen.<scriptId>`).

### 6.3 Where scripts come from

- NPC `topics`: `[{cond, script, once?, priority}]`; `whereIs` + `interact` choose the highest-priority eligible topic; `Linger` opens the next.
- Life threads: `threads/*.js` `beats: [{id, cond, script, where?: {npc, map}, reward?: {share: true}}]`; `systems/threads.js.eligibleBeats(world, data)` is queried on map enter, day start, flag change; a beat may attach a one-off topic to an NPC or spawn an entity (`where`) through the entity cond mechanism.
- Letters: `letters/*.js` rows have optional `unlock: Cond` (default: previous letter read) and `reveal: Op[]` run when read (set flags, add map entities, open a thread).
- Map triggers: `{kind:'step'|'use'|'enter', cond, script}`.
- Trainers: `scripts: {before, afterWin, afterLoss}`.
- System events: `data/scripts/index.js` also exports `EVENT_SCRIPTS = {'loan:paid:3': 'wren-tier3', 'badge:1': 'reroll-lesson', 'day:start': 'morning-mail'}`; `systems/autosave.js`-style subscriber `systems/eventScripts.js` maps store events to `pendingScript`.

### 6.4 Condition DSL

```js
/** @typedef {boolean |
 *  {flag: string, is?: any} | {not: Cond} | {all: Cond[]} | {any: Cond[]} |
 *  {counter: string, gte?: number, lte?: number} | {hasItem: string, n?: number} | {wallet: {gte: number}} |
 *  {hour: [number, number]} | {phase: string[]} | {tide: 'low'|'rising'|'high'|'falling'} | {day: {gte?: number, dow?: number[]}} |
 *  {weather: string[]} | {loan: {tier?: number, paid?: boolean}} | {badge: number} | {letter: {read: number}} |
 *  {thread: {id: string, beat?: number, done?: boolean}} | {npc: {id: string, met?: boolean, talks?: {gte: number}}} |
 *  {party: {has?: string, level?: {gte: number}, size?: {gte: number}}} | {fieldLog: {form: string, state: 'seen'|'read'|'held'}} |
 *  {map: string} | {inRegion: string} | {dial: string[]} | {challenge: string} | {seen: string}
 * } Cond */
/** @param {World} world @param {Cond} cond @param {CondCtx} ctx  @returns {boolean} */ export function evalCond(world, cond, ctx)
```

No randomness in conditions (deterministic replays); a "sometimes" needs a script op that draws from a named fork and sets a flag.

---

## 7. UI toolkit

All UI is drawn into the 480x270 buffer with `core/font` and `core/pixelart`; no DOM except the touch overlay. Theme tokens in `ui/theme.js`: paper `#efe4c8`, ink `#2a2420`, ledger rule `#b59b74`, wax `#9c2f2f`, focus `#ffcd75` + a 1-px dotted ring and a `▶` cursor glyph (shape, never colour alone).

### 7.1 Focus model

```js
/** @returns {Focus} */ export function createFocus(input, {wrap = false, cols = 1} = {})
/**
 * @typedef {Object} Focus
 * @property {(items: FocusItem[]) => void} setItems   {id, rect:{x,y,w,h}, enabled, onActivate, group?}
 * @property {(dt: number) => FocusEvent|null} update  reads d-pad with input.repeat, pointer hover (keyboard/gamepad hide hover), pointer/touch tap = focus + activate on release inside rect
 * @property {number} index @property {(i: number) => void} set
 * @property {() => FocusItem|null} current
 * @property {(ctx: CanvasRenderingContext2D) => void} drawCursor
 */
```

Pointer and touch share one path through `input.pointer` (game coords). Tapping an unfocused item focuses it; tapping the focused item activates; a swipe inside a list scrolls. `cancel` always exists: every scene maps `cancel` to pop, so menus cannot trap. Opening any scene calls `input.flush()` (the stack already does).

### 7.2 Components

```js
export function drawPanel(ctx, {x,y,w,h}, style: 'paper'|'ledger'|'notice'|'card'|'dark', opts?: {title, seal, torn: 'top'|'bottom'|'none'})
export function createList({x,y,w,rowH,visible, render:(ctx,item,x,y,w,focused)=>void, items, focus})  -> {update, draw, selected, setItems, scrollTo}
export function createGrid({x,y,cols,rows,cellW,cellH,items,render,focus})                              -> {update, draw, selected, setItems}
export function createTabs({tabs:[{id,label,icon}], x,y,w, input})                                     -> {update, draw, active}
export function openConfirm(game, {title, body, options:['Yes','No'], defaultIndex: 1, danger?: boolean}) -> Promise<number>   // pushes a modal scene
export function createToasts()  -> {show(text, {icon, ms}), update(dt), draw(ctx)}
export function createTextbox({x,y,w,h, speed, font}) -> {setText(text, {who, portrait}), update(dt), draw(ctx), done, skip(), advance(): boolean}
export function drawBar(ctx, {x,y,w,h, value, max, kind:'hp'|'exp'|'glow'|'bond', showNumber})
export function drawTypeChip(ctx, type, x, y)   // icon + abbreviated word
```

`ui/hud.js` draws the clock (sun/moon glyph + hour), tide gauge (shape-coded arrow + "low in 12m"), wallet, held tool, context verb and the Shift-pending pip. `ui/toolRing.js`: holding `tool` ≥ 220 ms opens the ring (uses `input.held` plus a scene timer; no core change needed), releasing on a socket equips; a tap swaps `player.tool` with `player.lastTool`; `cancel` closes without dropping anything.

---

## 8. Data conventions and validation

### 8.1 Conventions

- Ids: lowercase kebab-case, globally unique within a table, prefixed by table where ambiguity is possible (`map:` is not used in ids; tables are separate). Flags are namespaced: `sp.` story, `th.<thread>.`, `np.<npc>.`, `sys.`.
- Every table file exports a frozen array or object; its `index.js` merges and freezes. No function values in content files except art helpers; behaviour is referenced by handler key strings (`use: 'heal:20'`, hooks `onHit: 'ward.glasshide'`).
- Numbers that designers tune live in `data/economy.js`, `data/dials.js`, `data/loans.js`, never inline in systems. Systems import constants from data, not the reverse.
- A content file never imports a system or scene; data imports only other data and `js/art` helpers.
- Text copy belongs in the content file that owns it; shared UI strings in `dialogueText.js`.
- `tools/new-content.mjs map isle-brindle` scaffolds a file with every required field and appends the index line.

### 8.2 `tools/validate-data.mjs`

Runs under Node (`node tools/validate-data.mjs [--world save.json]`), exit code 1 on any error, prints `file:id: message`. Checks:

- Species: every form in exactly one family; family pools (up/side/down/star) reference forms in the same family; each form's learnset references moves; abilities exist; windows ascending; sprites exist in `art/creatures` for every form (front; back optional with warning); Heartmark placement inside the opaque bounds (`pixelart.opaqueBounds`); palette keys subset of MASTER; exactly one star form per family.
- Moves: type in TYPES or null; effect keys in `battle/effects.js` `EFFECT_KEYS`; status kinds known; PP rules (evasion moves ≤ 5).
- Items: pocket known; `use` handler key exists; prices ≥ 0; `oneOfAKind` items only in keepsakes.
- Maps: layer dimensions match w×h; legend chars resolve to tiles; warps target existing maps with in-bounds, passable destinations; every `L` tide region connects dry land to dry land; spawn tables exist; entity ids unique; npc ids exist; trigger scripts exist; regions in bounds; no unreachable warp target (BFS from each warp arrival over `passable` at low tide, warning at high tide).
- NPCs: schedule entries cover 0..1440 with no gaps or overlaps per day; every `at` is a passable tile on an existing map; path ids exist; topic scripts exist; `home` map exists; portrait exists.
- Threads: beat ids unique; scripts exist; `where.npc` exists; conds well-formed.
- Letters: `n` contiguous from 1; unlock conds valid; reveal ops valid.
- Scripts: op names in `OP_NAMES`; required fields per op; `goto` labels exist within the script; `call` targets exist; `who` is an npc id, `player`, or an entity id on the map the script is bound to (warning if unbound); item/species/shop/trainer/track refs exist; choice has ≥ 1 option; `startBattle` trainer exists.
- Trainers: party species/levels/moves legal (move in learnset or disc list); payout ≥ 0; AI profile exists.
- Shops: hours valid; stock items exist; keeper npc exists.
- Encounter tables: species exist; weights > 0; level ranges sane; at least one row with no cond per table (so tables are never empty).
- Tracks: `audio.normalizeTrack` accepts each; every hour 0..23 maps to a track in `director.js` HOUR_TABLE; required stems present.
- Conds everywhere: well-formed per §6.4 schema; referenced flags appear in at least one `setFlag`/system emitter (warning otherwise, catches typos).
- World (`--world`): schema fields present, every id resolves, party size ≤ 6, moves ≤ 4, `v` ≤ SCHEMA_VERSION.

`test/data.test.mjs` runs the validator as a unit test so `node --test` fails on bad content.

### 8.3 Authoring guide (one page in README, summarized)

A chapter writer adds a neighbor by creating `js/data/npcs/odile.js` (def + schedule + topics), `js/data/threads/odile-sunset.js` (beats with conds and script ids), `js/data/scripts/odile.js` (the ops), a portrait in `js/art/portraits.js`, placing `{kind:'npc', id:'odile', ...}` in a map's `entities` (or relying on the schedule to place her), and appending three index lines. Run `node tools/validate-data.mjs`. No engine file changes.

---

## 9. Seeds and determinism

The run seed comes from `core/rng.decodeSeedCode` (`world.run.seed`, 27 bits; `world.run.dial`; `world.run.toggles`). `setSeedToggles(DIALS.TOGGLE_ORDER)` is called at boot from `data/dials.js` (append-only order). The master is `makeRng(world.run.seed)`; nobody draws from it. Named forks (`fork(label)` is derived from seed + label, not from state, so forks are stable and re-creatable):

| Label | Used by | Persistence |
| --- | --- | --- |
| `worldgen` | new-game placement: Ward placements, disc contents, randomized route pools/abilities per dial, field item swaps, Errant home routes | consumed once at `createNewWorld`; results stored in `world.run.gen` (so saves never re-roll) |
| `enc:<mapId>` | step encounters and roamers per map | state array saved in `world.rng` |
| `shift:<uid>` | that creature's Forecast cards and flips | `creature.shiftCount` draw counter; stream re-forked and fast-forwarded on use |
| `battle:<n>` | one per battle (`n` = `stats.battles`), accuracy/crit/AI/capture | not saved (battles are atomic; a crash replays the whole battle) |
| `loot` | tree drops, dig finds, Glint position, cracks | state saved |
| `fish:<reachId>` | shadows, species, feints, bite window | state saved per reach |
| `weather` | daily roll | state saved; drawn once per day at `day:start` |
| `shop:<shopId>` | daily rotation and Wanted Today | re-forked as `shop:<id>:<day>` so no state needed |
| `npc:<id>` | idle wander, porch chatter picks | not saved (cosmetic) |
| `letters` | reserved (letters are fixed order; no draw) | - |
| `cosmetic` | particles, title screen | `game.entropy`, unseeded |

`systems/rngStore.js` (inside `state/store.js` for simplicity): `stream(world, label) -> Rng` returns a cached Rng restored from `world.rng[label]` or freshly forked, and `commit(world)` writes `state()` back before every save (`store.snapshot` calls it). The debug hook exposes `__game.rng(label).state()` so a Playwright run can assert two seeds diverge and one seed repeats. Determinism contract tested in Node: `createNewWorld(code)` twice → deep-equal; same fixture + same action list through `createBattle` → identical event arrays; `rollForecast` for a fixture creature across 10 rerolls → identical card sequences.

The dial can change at a Shelter (`world.run.dialChanged = true` → Seed Card "not race-eligible"); placements from `worldgen` are already materialized, so only odds/scouting/anchor rules change, as the rules require.

---

## 10. Save/load

Autosave triggers (`systems/autosave.js` subscribes to the bus; the table is data in the same file so the design panel can edit it):

```js
export const AUTOSAVE_TRIGGERS = ['map:enter', 'door', 'waystone', 'battle:before:spire', 'battle:before:rival', 'battle:before:summit', 'capture:ok', 'shift:resolved', 'loan:paid', 'letter:read', 'day:start', 'timer:600000'];
```

Slots: `createSaveSystem({autosaveSlots: 3, manualSlots: 3})`; No Rewind reads `world.run.challenges` and constructs with `{autosaveSlots:1, manualSlots:0}` (and the pause menu hides Load). Save is always the last menu item; one Up from the top reaches it. Each save shows "<map name>, Day N, HH:MM" from `summarize(world)`; the header summary is used in slot lists without parsing payloads.

What is saved: `store.snapshot()` = `world` after `rng.commit`. What is not: `store.derived` (paths, schedule caches), chunk caches, sprite/atlas caches, font atlases, audio state, entity objects, the live battle, tween/fx state, scene stack. All of it is rebuilt from `world` on `store.replace`.

Verified writes come from `core/save`; a failure result shows a red "Save failed: <code>" toast with `Retry` and keeps the previous record. Export/import: Settings → "Copy save code" uses `saves.exportString(slot)` into a read-only text panel plus `navigator.clipboard` when available; import pastes into a DOM `<textarea>` shown only for that screen (the one DOM exception besides touch), then `importString` → `migrate` → `validate --world` → `store.replace`. Loading never writes a save.

Crash recovery: boot writes `<prefix>session = {at, map, seq}` and clears it on `pagehide`/clean quit. If present at boot, the title shows "Resume from autosave: <place>, <n> minutes ago" and, from `world.battleBookmark` and `stats`, "rolls back: 1 trainer battle". `core/save`'s `.tmp` promotion already handles a crash mid-write.

---

## 11. Debug and test hooks

`js/debug.js` (lane BOOT) installs `window.__game` only when `flags.debug`:

```js
/**
 * @typedef {Object} DebugHook
 * @property {() => World} state                 live world (not a copy)
 * @property {(mapId: string, x: number, y: number) => void} warp
 * @property {(itemId: string, n?: number) => void} give
 * @property {(hour: number, minute?: number) => void} setTime
 * @property {(x: number) => void} setTide        0..1, holds until setTime/unfreeze
 * @property {(speciesId: string, level: number) => Creature} addCreature
 * @property {(trainerId: string) => Promise<PostBattle>} battle
 * @property {(uid?: string) => Promise<string>} forceForecast
 * @property {(id: string, value?: any) => void} flag  @property {() => Object} flags
 * @property {(mult: number) => void} speed
 * @property {(amount: number) => void} earn
 * @property {(n: number) => void} deliverLetter  @property {() => void} sleep
 * @property {(scriptId: string) => Promise<void>} runScript
 * @property {(label: string) => Rng} rng
 * @property {() => string} scene                 top scene name
 * @property {(name: string) => void} marker      pushes {name, frame, time} to __game.markers and draws a 1-frame label for screenshots
 * @property {() => Promise<void>} idle           resolves when no transition/anim/typewriter is running
 * @property {(action: string, ms?: number) => Promise<void>} press   synthesizes an input action through core/input's test seam
 * @property {() => {fps:number, chunks:number, entities:number, particles:number}} perf
 * @property {() => string} save  @property {(str: string) => void} load
 */
```

Every mutating hook goes through `store.tx` so autosave and events behave as in play. URL flags: `?debug=1`, `seed=FLUX-K7Q2-MD7F`, `skipTitle=1`, `speed=8`, `touch=1`, `scale=fit`, `slot=auto:1`, `strict=1` (Proxy write guard), `mute=1`.

`tools/playtest.mjs` (Playwright, chromium; serve via `tools/serve.mjs`): steps = boot with `?debug=1&seed=TEST-0000-0000&skipTitle=1&speed=8&mute=1`; assert no console errors (listener fails the run on any `error`); arrival cutscene completes (`idle()`, `scene()==='overworld'`); walk to Wren via `press` sequence or `warp`; starter obtained (`state().party.length===1`); first wild battle via grass steps until `scene()==='battle'`, play with `press('confirm')` until done; first catch via `give('lantern-1',5)` + battle + capture action; first loan payment via `earn(12000)` + `runScript('pay-at-yard')` → `loans.tier===2`; `sleep()` → `letters.delivered===1`; `forceForecast()` → `shiftlog.length===2`; dial/odds visible check via screenshot marker; then the long arc: for each Spire in `data.spires`, `warp`, `battle(leaderId)` with `addCreature` over-levelled, assert badge flag; pay all tiers with `earn`; deliver letters to the end; `runScript('relighting')`; assert `scene()==='credits'` and Seed Card text; reload page with `slot=auto:1` and assert the world round-trips (`save()`/`load()` equality). Screenshots at each `marker` into `test/out/`. Node unit tests: one `test/<module>.test.mjs` per pure file; fixtures in `test/fixtures`. `tools/screenshot.mjs` walks the menu state graph (each menu scene from a fixture) and fails on an all-black frame.

`tools/check.sh`: `node tools/validate-data.mjs && node --test test/ && node tools/playtest.mjs --quick` (full arc with `--full`).

---

## 12. Performance budget

Target 60 fps on a 2018 laptop, frame budget 16 ms: world update ≤ 2 ms, draw ≤ 8 ms, headroom for GC. Strategy:

- Tiles: chunk caches (§4.2) make the ground/detail/overlay layers ≤ 48 `drawImage` calls per frame regardless of map size. Animated water chunks redraw only their 4-frame variants; everything else is drawn once per tide variant and reused.
- Sprites: `art/atlas.js` packs all decoded creature, character, tile and icon sprites into ≤ 4 atlases of 1024x1024 at boot (`pixelart.buildAtlas`), so every sprite draw is one `drawImage` from a warm canvas. Palette swaps and silhouettes are cached by key by `core/pixelart`.
- Text: `core/font` per-colour glyph atlases; HUD strings are redrawn each frame (cheap), long panels are pre-rendered to an offscreen canvas and invalidated on change.
- Particles: `core/fx` presets are pooled (`maxParticles` 600 total; `lowPower` 250); emitters are data presets; no per-frame allocation (pre-allocated typed arrays for x, y, vx, vy, life).
- Entities: cap 64 active per map (NPCs on-map ≤ 16, roamers ≤ 8, props unlimited but static props render into the detail chunk layer at load instead of as entities). Off-screen entities skip `draw` and run a cheap `update` (schedule check every 500 ms).
- Lighting: one 480x270 multiply pass at night only; ≤ 24 light sources; in `lowPower` a 240x135 buffer. Weather ≤ 200 particles.
- Audio: music scheduler lookahead 120 ms; sfx rate-limited by `createRateLimiter`.
- Allocation hygiene: `tx` results reuse objects; no closures created per frame in hot loops; `visibleTiles()` returns a reused rect.
- 30 fps fallback: automatic as in §2.1; `settings.fps30` forces it for battery.
- Budget check in CI: `playtest --quick` asserts `perf().fps ≥ 55` averaged over the town walk at speed 1 in headless Chromium (soft fail with a warning on CI machines).

---

## 13. Build order and integration plan

Phase 0 (day 1, BOOT + STATE + DATA-IDX): `index.html`, `main.js` loop, `schema.js` with `createNewWorld`, `store.js`, `data/index.js` with empty tables, `registry.js`, stub scenes (title that says the title and a "press confirm" that replaces into a flat test map, overworld scene that draws a coloured grid and a player square), `debug.js`. **Checkpoint 0: boots with no console errors, `tools/check.sh` green on an empty data set, `?skipTitle=1` lands on a walkable map.** Stub strategy: every lane's `index.js` ships day one exporting empty frozen tables, and every scene exists as a stub that draws its name and pops on `cancel`, so the menu graph is complete before any content.

Phase 1 (week 1): CORE finishes `tween/fx/time`; WORLD-MAP delivers `map/chunks/camera/warps` with one real town map from DATA-MAPS; WORLD-ENT delivers player, NPC with a fixed schedule, interaction verbs; SCRIPT delivers `conditions`, `script` + dialogue scene with two scripts; RULES-CREATURE delivers creature/party/exp; BATTLE-RULES ports proto moves/types and builds `engine.js` with Node tests; UI-KIT delivers focus/list/panel/textbox/confirm; ART lanes deliver palette, 6 creatures, 1 tileset, player + 2 NPC sheets; AUDIO delivers director + 2 tracks. **Checkpoint 1: walk the town, talk to Wren, time passes, tide opens the causeway, autosave on door, a scripted battle against one trainer using the real engine with placeholder animation.**

Phase 2 (week 2): SCN-BATTLE with animation queue and capture; RULES-SHIFT + forecast scene; RULES-ECON (bag, wallet, loans, shops) + ledger/shop scenes; SYS-TOWN (letters, schedule, memory, threads, dayPage) + letter/dayPage scenes; SYS-GATHER (fishing/gather/fieldLog) + fishing scene; WORLD-FX (lighting, weather, tide fx); the validator reaches full coverage. **Checkpoint 2: the 20-30 minute first session is playable end to end from `playtest --quick`: arrival, first creature, first battle, first catch, first loan payment, first letter, a Forecast.**

Phase 3 (weeks 3-4): content fill by DATA lanes in parallel (isles, Spires, trainers, 36-48 forms, 50-60 letters, 10-14 neighbors, 6+ threads), menus (party, bag, log, map, settings, saveLoad), credits/Seed Card, challenge modes. **Checkpoint 3: `playtest --full` clears the arc; save round-trip; two seeds diverge, one seed repeats.**

Phase 4: polish lanes (juice, hourly music, accessibility, performance), fuzzing from fixtures, zero-warning validator.

Dependencies in one line: `core → state → data-idx → {systems, battle} → world → ui → scenes → main`; content lanes depend only on `data-idx` conventions and the validator; art lanes depend only on `core/pixelart` and `art/palette`.

---

## 14. Required changes to existing core and proto code

- `core/audio.js`: the file currently exports the synth bank, helpers and `normalizeTrack` but no engine object. It must export `createAudio() -> AudioEngine` (or the `audio` singleton the contract names) with `unlock, ready, setVolume, getVolume, mute, isMuted, sfx, defineTrack, playMusic, stopMusic, setStem, setMusicParam, nowPlaying`. `js/audio/director.js` is the only game module that calls it, so the shape can settle without touching content.
- `core/tween.js`, `core/fx.js`, `core/time.js`: not on disk; needed by Phase 1. `time.js` must expose `serialize()/restore()` exactly as the contract says because `world.clock` stores it, plus `setMinutesPerDay(n)` for the settings screen and `freezeTide(x|null)` for the debug hook (debug-only, not serialized).
- `core/input.js`: no change. Hold-vs-tap for the tool ring is done in `ui/toolRing.js` with `held()` and a timer. A `test seam` for synthesizing actions exists through injected `target`/`doc` EventTargets; the debug hook dispatches real `KeyboardEvent`s on `window` instead, so no change there either.
- `core/scene.js`: no change; `updateBelow` and `find` are used as is.
- `proto/battle/types.js` → `js/data/types.js`: delete the `PALETTE` placeholder; `typeColour` imports `MASTER` from `js/art/palette.js` via `TYPE_PALETTE_KEY` (the keys already match the sprite MASTER keys; only hex values differed). Everything else moves unchanged.
- `proto/battle/moves.js` → `js/data/moves/`: split by type into per-type files that export arrays; `index.js` concatenates and freezes `MOVES`. The effect-key vocabulary becomes `EFFECT_KEYS` in `battle/effects.js` and the validator checks every move against it. `signature` stays (used by the validator to confirm a signature move is in that species' learnset).
- `proto/creatures/sprites.js` → `js/art/creatures/`: keep the `{rows, palette, heartmark, heartmarkBack?, back?, idle2?, feature}` format; key sprites by species id (`sloshkin`) not display name; drop the per-sprite `type` field (species data owns it; the validator cross-checks instead); `squash`/`hover` must use `rows.length`/`rows[0].length` instead of hard-coded 32 so 24x24 forms work; `MASTER` moves to `js/art/palette.js` and the sprite files import `pal` from there.
- `proto/battle/test/` is empty; the engine tests land in `test/battle.*.test.mjs` with fixture creatures from `test/fixtures`.

Everything else in `_merge-wip/js/core` is adopted as is, and the architecture adds no second copy of any core capability.
