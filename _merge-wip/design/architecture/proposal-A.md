# Architecture Proposal A — "Fewest moving parts"

Bias: simplicity and robustness. Plain objects, explicit data flow, one state tree, one game context, modules that own their files. Every cross-module boundary below is a JSDoc signature; everything above a boundary is the owner's business.

Grounding: this builds on the nine core modules that already exist in `_merge-wip/js/core/` (rng, events, font, pixelart, canvas, input, audio, save, scene) exactly as their headers document them, and on the contract for the three still in flight (`time.js`, `tween.js`, `fx.js`). Where the shipped file differs from the contract I say so. `proto/battle/{types,moves}.js` and `proto/creatures/sprites.js` are adopted nearly verbatim (section 8 lists the three changes).

Content-agnostic: no file below assumes a species, map, NPC, letter or number. Content is data; data is validated by a script; systems operate on ids.

---

## 0. Three rules that make twenty engineers safe

1. **One state tree, mutated only by its owner module.** `G.world` is a plain serializable object. Only `js/systems/<x>.js` writes `world.<x>`; everyone else reads. Scenes never write `world` directly. Violations are caught by `tools/lint-owners.mjs` (a grep: `world\.\w+\s*=` and `world\.\w+\.push(` outside the owning module fails CI).
2. **One game context `G`, created once in `main.js`, passed by closure.** No globals, no service locator, no DI container. `createOverworldScene(G)` is the whole pattern.
3. **Pure core, impure shell.** Anything in `js/data`, `js/state`, `js/battle`, `js/world/*` (except render), `js/systems`, `js/script` imports no DOM and runs under `node --test`. Only `js/scenes`, `js/ui`, `js/render`, `js/audio/index.js`, `main.js` touch the canvas or window.

---

## 1. Folder layout and file manifest

Target folder: `/home/user/practice-games/<title>/` (title decided by the panel; working name `game/`). Convention follows theater-of-the-undead: `index.html`, `css/`, `js/`, `README.md`, `serve.py` optional.

Owner tags are roles, so a person can be assigned to each tag. Nobody edits a file outside their tag without a message to its owner. Files marked **(stub day 1)** must exist as a minimal working stub before anyone else starts (section 13).

### Root
| File | Scope | Owner |
|---|---|---|
| `index.html` | canvas parent, touch overlay parent, one `<script type=module src=js/main.js>`; no inline logic | shell |
| `css/style.css` | body black, `#stage` fullscreen, touch overlay styles, `prefers-reduced-motion` hook | shell |
| `README.md` | how to run, controls, debug flags, test commands | shell |
| `js/main.js` | boot, loop, context creation, URL flags, pause-on-blur **(stub day 1)** | shell |
| `js/config.js` | constants: NATIVE_W/H, TILE, TICK_MS, caps, version string **(stub day 1)** | shell |

### `js/core/` (existing; frozen API, bug fixes only)
`rng.js events.js font.js pixelart.js canvas.js input.js audio.js save.js scene.js time.js tween.js fx.js` — owner: core. `audio.js` currently exports the pure helpers and the SFX bank but not the `audio` singleton of the contract; the `js/audio/index.js` adapter below is the only file that cares.

### `js/state/` — the store (owner: state)
| File | Scope |
|---|---|
| `schema.js` | every JSDoc typedef for `World` and its parts; `SCHEMA_VERSION`; `createEmptyWorld(seedInfo)`; `validateWorld(world) -> string[]` **(stub day 1)** |
| `store.js` | `createStore(world)`: holds `world`, `bus`, dirty flag, `snapshot()`, `replace(world)`; nothing else **(stub day 1)** |
| `migrate.js` | `MIGRATIONS = {1: fn, 2: fn}`; `migrateWorld(data) -> World` |
| `persist.js` | wraps `core/save`: slots, autosave triggers, summary, export/import, crash recovery **(stub day 1)** |
| `rngs.js` | the fork registry (section 9): `createRngs(seed, saved) -> Rngs`, `serializeRngs(rngs)` |

### `js/data/` — pure content modules (owner: content leads; chapter writers add files, never edit systems)
| File | Scope |
|---|---|
| `index.js` | aggregates every table into one frozen `DATA` object; this is what systems import **(stub day 1)** |
| `ids.js` | tiny helpers: `assertId`, `byId(list)`; the naming regex `^[a-z0-9-]+$` |
| `types.js` | from `proto/battle/types.js` (type chart, words) |
| `moves.js` | from `proto/battle/moves.js` |
| `abilities.js` | `{id, name, text, hooks: {...}}`, Wards flagged |
| `species.js` | forms: `{id, familyId, name, types, baseStats, abilityPool, learnset, tier, catchRate, expCurve, artId}` |
| `families.js` | Shift families: `{id, forms[], shiftTable: {fromForm: {up:[], side:[], down:[]}}, windows:[curvePoints]}` |
| `items.js` | `{id, name, pocket, price, sell, stack, use: {kind,...}, oneOfAKind}` |
| `trainers.js` | `{id, name, portraitId, party:[{species, level, moves?}], scriptBefore?, scriptAfter?, reward}` |
| `encounters.js` | per-map spawn tables keyed by `mapId:zone:phase:tide` → `[{w, species, lv:[min,max]}]` |
| `maps/index.js` + `maps/<mapId>.js` | one map per file (section 4) |
| `tilesets.js` | tile ids → `{artId, solid, water, tideGated, surf, sound, animFrames}` |
| `npcs.js` | `{id, name, species, portraitId, home, schedule: [...], lines: {...}, threadId?}` |
| `schedules.js` | shared schedule templates (shopkeeper, fisher, night owl) |
| `threads.js` | life threads: `{id, npcId, beats: [{id, when: Cond, script: ScriptId, reward?}]}` |
| `letters.js` | ordered old letters `{id, day?, from, to, body, relicId?, unlocks?}` |
| `scripts/index.js` + `scripts/<chapter>.js` | declarative scripts (section 6), one file per chapter/NPC |
| `shops.js` | `{id, npcId, hours:[open,close], stock: [{item, qty?, rotating?}], buys: [pockets]}` |
| `loans.js` | the ladder `[{tier, amount, build, commissions?}]`, resident-share rule constants |
| `fish.js bugs.js relics.js` | collections `{id, name, where, phase, tide, size, tell, price}` |
| `dials.js` | Drift/Flux/Freefall/Custom toggle values; challenge mode definitions |
| `curve.js` | EXP curve, catch-up table, curve level per region |
| `strings.js` | UI strings (menus, verbs, toasts) so writers can edit tone in one place |
| `credits.js` | credits roll lines |

### `js/world/` — overworld simulation, pure (owner: world)
| File | Scope |
|---|---|
| `tilemap.js` | decode map data, `tileAt(layer,x,y)`, `isSolid(x,y,tideState)`, `triggerAt(x,y)` |
| `camera.js` | `createCamera(mapW,mapH)`: follow, clamp, shake offset from fx |
| `entities.js` | entity records (plain objects), spatial grid, `moveEntity`, facing, collision with tiles+entities |
| `player.js` | player movement, running, facing tile, tool state |
| `npcAI.js` | schedule → target → path (BFS on tile grid, cached per (map,from,to)); idle wander |
| `roaming.js` | visible wild creatures and items on the map (spawn/despawn from spawn tables) |
| `interact.js` | facing tile + context verb resolution → `Interaction` (section 4.5) |
| `encounter.js` | step-based seeded encounter rolls (section 4.6) |
| `transit.js` | warps, doors, causeways, interiors; `resolveWarp(world, warp) -> {mapId,x,y,facing}` |
| `weather.js` | per-day seeded weather plan; current weather at minute |
| `lighting.js` | pure: `ambientFor(minute, weather) -> {tint, alpha}`, light sources list |

### `js/render/` — browser drawing of the world (owner: render)
| File | Scope |
|---|---|
| `tileRenderer.js` | chunk caches (section 12), tide variants, animated tiles |
| `entityRenderer.js` | y-sorted sprites, shadows, emotes, water occlusion |
| `lightPass.js` | multiply tint + additive lights + weather particles overlay |
| `mapRenderer.js` | composes the three above for one frame |
| `minimap.js` | map screen raster from tilemap |

### `js/battle/` — pure battle engine (owner: battle-engine; two people max)
| File | Scope |
|---|---|
| `engine.js` | `createBattle(setup, rng) -> Battle`; the turn loop; emits `BattleEvent[]` **(stub day 1: returns a fake KO in 1 turn)** |
| `damage.js` | formula, crits, STAB, Wards, Plumbline, evasion caps |
| `effects.js` | move effect handlers keyed by `effect` keys in `moves.js` |
| `status.js` | burn/poison/chill/numb/trap tick rules |
| `ai.js` | foe move choice (pure, takes rng) |
| `capture.js` | odds formula, attempt roll, Capture Stance clamp |
| `exp.js` | EXP split, catch-up, level thresholds, learn-on-level, Shift window detection |
| `shift.js` | Forecast draw: `drawForecast(creature, family, dial, stream) -> Forecast`; `applyShift(creature, form)` |
| `legal.js` | what the menu may offer (0-PP greyed, Scrap fallback, Run greyed vs trainers) |

### `js/systems/` — store mutators, pure (owner per file)
| File | Owner | Writes |
|---|---|---|
| `clockSys.js` | time | `world.clock` (wraps core/time: serialize/restore, phase change events) |
| `party.js` | creatures | `world.party, world.box` (add, swap, heal, nickname, Heartmark pin, Memory moves) |
| `creature.js` | creatures | `makeCreature(species, lv, rng, opts) -> Creature`; stats derivation (pure, no world) |
| `bag.js` | items | `world.bag, world.wallet` (give/take/stack/pockets, one-of-a-kind confirm flag) |
| `loans.js` | economy | `world.loans` (pay, tier up, commission choice, overnight build queue) |
| `shops.js` | economy | buy/sell/daily rotation, buyer hours, diminishing returns |
| `flags.js` | script | `world.flags, world.counters` (set/get/inc; condition evaluation `evalCond`) |
| `quests.js` | narrative | `world.threads` (beat progression on day start, favours) |
| `letters.js` | narrative | `world.letters` (deliver next at 6:00, mark read, relic links) |
| `neighbors.js` | narrative | `world.neighbors` (memory, gifts, nickname, last-line-day for no-repeat) |
| `fieldLog.js` | collections | `world.fieldLog` (Seen/Read/Held) |
| `collections.js` | collections | `world.collections` (fish/bugs/relics caught; tells learned at 3) |
| `fishing.js` | verbs | pure state machine: cast → feints → bite window → result; reach health |
| `digging.js` | verbs | daily cracks + flats relics; glint; Loupe naming |
| `trees.js` | verbs | shake outcomes, bee warning, regrow timers |
| `dayPage.js` | narrative | end-of-day summary + "Tomorrow:" list; overnight builds applied; `world.stats` |
| `stats.js` | state | `world.stats` counters (steps, battles, catches, play ms) |
| `settings.js` | state | `world.settings` + `localStorage` mirror for pre-load reads |
| `encounterFlow.js` | integration | glue: wild roll → battle setup → results back into party/fieldLog/stats |

### `js/script/` — dialogue/cutscene/quest interpreter, pure (owner: script)
| File | Scope |
|---|---|
| `ops.js` | `OPS` list with arity/schema per op; used by validator |
| `runner.js` | `createRunner(script, env) -> Runner` (section 6) |
| `cond.js` | condition DSL: `{flag}`, `{not}`, `{all}`, `{any}`, `{has: item}`, `{hour:[a,b]}`, `{tide}`, `{beat}`, `{badge}` |
| `registry.js` | which script runs for an interaction: `resolveScript(world, target) -> ScriptId` |

### `js/scenes/` — browser, one scene per file (owner: ui-flow; names in brackets are secondary owners)
`boot.js title.js leaseCard.js overworld.js dialogue.js [script] cutscene.js [script] battle.js [battle-ui] forecast.js [battle-ui] capture.js [battle-ui] pause.js menu.js party.js [creatures-ui] summary.js [creatures-ui] box.js [creatures-ui] bag.js shop.js fieldLog.js collections.js mapScreen.js ledger.js [economy-ui] letter.js dayPage.js fishing.js [verbs-ui] settings.js saveLoad.js seedCard.js ending.js credits.js debugOverlay.js`

### `js/ui/` — widget toolkit (owner: ui-kit)
`theme.js panel.js list.js grid.js tabs.js confirm.js toast.js hud.js toolRing.js focus.js textbox.js portrait.js gauge.js icons.js`

### `js/art/` — procedural and encoded art (owner: art; one file per artist)
| File | Scope |
|---|---|
| `palette.js` | MASTER palette (from `proto/creatures/sprites.js`), `pal()`, type colours; the only palette source |
| `atlas.js` | `getSprite(artId, variant) -> Sprite` lazily decoded + cached; `getTile(id, frame)` |
| `creatures/<family>.js` | 32x32 string art per form (format from proto) |
| `tiles.js` | 16x16 tile art + procedural generators (grass, sand, mud, water frames) |
| `chars.js` | player + NPC 16x24 walk cycles, species bodies with palette swaps |
| `portraits.js` | 32x32 dialogue portraits |
| `props.js` | trees, rocks, signs, boats, lighthouse tiers, scaffolding stages |
| `ui.js` | paper edges, ledger lines, wax seal, tally sticks, cursor, icons |
| `heartmark.js` | draws the plus at the per-individual offset with w/y centre and k outline on light bodies |

### `js/audio/` (owner: audio)
| File | Scope |
|---|---|
| `index.js` | adapter: exposes exactly the contract `audio` object (`unlock, sfx, defineTrack, playMusic, stopMusic, setStem, setMusicParam, setVolume, getVolume, mute, isMuted, nowPlaying`) over `core/audio.js`, plus a no-op **stub when WebAudio is missing** |
| `tracks/<daypart>.js` | track definitions, ≥6 dayparts plus battle, forecast, title |
| `director.js` | listens to bus (`clock:phase`, `tide:change`, `weather:change`, `battle:start/end`, `scene:*`) and calls `playMusic/setStem`; the only thing that decides what plays |
| `sfxMap.js` | verb → sfx name table so systems emit events, never call audio |

### `js/debug/` (owner: shell)
`hook.js` (window.__game), `flags.js` (URL parsing), `markers.js` (screenshot markers).

### `test/` (owner: each module owner writes their own)
`core/*.test.mjs` (existing), `state/schema.test.mjs persist.test.mjs rngs.test.mjs`, `data/validate.test.mjs`, `battle/*.test.mjs`, `systems/*.test.mjs`, `script/runner.test.mjs`, `world/*.test.mjs`, `fixtures/worlds/*.json` (checkpoint saves for fuzzing), `pages/*.html` (manual browser pages per visual module).

### `tools/` (owner: shell + qa)
`validate-data.mjs lint-owners.mjs check.sh playtest.mjs serve.py screenshot.mjs fuzz-menus.mjs gen-checkpoints.mjs`

Count: ~120 source files, ~40 data files, each with one owner. Parallel surface: twenty people each own 4–8 files and one boundary.

---

## 2. Boot and main loop

### index.html
```html
<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>GAME</title><link rel="stylesheet" href="css/style.css"></head>
<body><div id="stage"></div><div id="touch"></div><script type="module" src="js/main.js"></script></body></html>
```
No HUD in DOM: everything except the touch overlay is drawn to the 480x270 buffer so it scales, screenshots and tests identically.

### main.js, in order
```js
/** @typedef {Object} G  The game context, created once.
 * @property {import('./state/store.js').Store} store
 * @property {World} world   alias of store.world (re-pointed on load; scenes must read G.world each frame, never cache it)
 * @property {Bus} bus
 * @property {Display} display  @property {Input} input  @property {Audio} audio
 * @property {SceneStack} scenes  @property {Rngs} rngs  @property {DATA} data
 * @property {Tweens} tweens  @property {FX} fx  @property {Clock} clock
 * @property {Persist} persist  @property {DebugFlags} flags  @property {Record<string, Function>} sceneFactories */
```
1. `flags = parseFlags(location.search)` (`debug, seed, skipTitle, speed, touch, slot, mode`).
2. `display = createDisplay({parent:#stage, mode: settings.scale})`; `input = createInput({canvas: display.canvas, display, touchParent:#touch})`.
3. `store = createStore(createEmptyWorld({seed: flags.seed ?? randomSeedCode('flux')}))`; `rngs = createRngs(store.world.seed)`; `clock = createClock(...)` restored from world.
4. `scenes = createSceneStack({input, width:480, height:270})`; `G` assembled; `installDebugHook(G)` if `flags.debug`.
5. `scenes.push(sceneFactories.boot(G))` → boot checks `persist.latest()` for crash recovery, builds sprite caches lazily, then `replace(title)` or, with `skipTitle`, `replace(leaseCard)` or straight to overworld with a default lease card.
6. Start loop.

### The loop
Fixed timestep, no interpolation. Pixel art at integer positions gains nothing from interpolation, and determinism gains a lot from fixed ticks.
```js
const TICK = 1000/60;           // config.TICK_MS
let acc = 0, last = performance.now(), slow = 0;
function frame(now) {
  let dt = Math.min(now - last, 250); last = now;        // clamp after tab sleep
  acc += dt * speedMult;                                 // debug speed(x) scales here
  const maxSteps = 4 * Math.max(1, speedMult);
  let steps = 0;
  while (acc >= TICK && steps < maxSteps) { step(TICK); acc -= TICK; steps++; }
  if (steps === maxSteps) acc = 0;                       // drop time rather than spiral
  draw(); display.present();
  requestAnimationFrame(frame);
}
function step(ms) {
  input.update(); tweens.update(ms); fx.update(ms);
  scenes.top()?.handleInput?.(input);                    // stack ignores input during transitions already
  scenes.update(ms);                                     // the active scene calls clockSys.tick(G, ms) itself (overworld only)
}
```
The clock advances only when the overworld (or fishing) scene is top; menus, battle and dialogue freeze time by construction. 30-fps fallback: if 90 consecutive frames exceed 24 ms, `TICK` doubles to 1000/30 and `fx.setBudget(0.5)`; it never switches back during a session (flapping is worse than 30 fps).

### Pause on blur, resize
`window.addEventListener('blur', () => pauseAll())` pushes the pause scene if not already present (`scenes.find('pause')`) and `audio.mute(true)` temporarily; `focus` restores audio but leaves the pause scene up (the player resumes deliberately). `visibilitychange` hidden → same. `display` handles resize itself; `scenes` get `bus.emit('display:resize', layout)` only for touch-hint placement.

### Title → lease card → overworld
```
boot ──replace──▶ title ──push──▶ saveLoad (modal, non-opaque) ──pop({slot})──▶ title loads → replace(overworld)
                   │──replace(transition 'iris')──▶ leaseCard ──replace──▶ cutscene(arrival script) ──replace──▶ overworld
```
Only `replace` crosses opaque boundaries; only `push/pop` is used for modals. Every modal returns its result through `pop(result)`, and the caller reads it in `resume(result)`. No scene reaches into another scene's fields.

---

## 3. The state store

### Store
```js
/** @returns {Store} */
export function createStore(world) // -> {world, bus, dirty: boolean, touch(reason), snapshot(): World (structuredClone), replace(world)}
```
`touch(reason)` sets `dirty` and emits `bus.emit('world:touched', reason)`; `persist` uses it for the route autosave timer. `replace` is used by load and by debug; it emits `'world:replaced'` so scenes drop caches.

### Rule
Systems mutate `world` only through exported functions in their own module, each shaped `fn(G, ...args) -> result` (or `fn(world, ...)` when they need nothing else; prefer that for testability). Systems emit domain events on `G.bus` after mutating: `party:changed`, `bag:changed`, `wallet:changed`, `loan:paid`, `loan:tier`, `flag:set`, `letter:delivered`, `thread:beat`, `fieldLog:seen|read|held`, `clock:phase`, `tide:change`, `day:start`, `day:end`, `map:enter`, `battle:start|end`, `shift:window|resolved`, `save:ok|fail`, `toast`. UI listens; systems never listen to UI.

### schema.js (excerpt; the file holds the full set)
```js
export const SCHEMA_VERSION = 1;
/** @typedef {Object} World
 * @property {number} v                      SCHEMA_VERSION at write time
 * @property {SeedInfo} seed                 {code, dial, seedNum, toggles[], changedMidRun}
 * @property {Settings} settings
 * @property {ClockState} clock              core/time serialize() output + {dayLengthMin, realClock}
 * @property {PlayerState} player            {name, species, pronouns, look:{fur,marks,outfit}, mapId, x, y, facing, running, tool, toolRing: string[8], lastTools:[a,b], title: 'Keeper'|...}
 * @property {Creature[]} party              max 6
 * @property {Creature[]} box
 * @property {Bag} bag                       {pockets: Record<PocketId, ItemStack[]>, keepsakes: ItemStack[], capacity}
 * @property {Wallet} wallet                 {main: number, starsalt: number, anchors: number}
 * @property {LoanState} loans               {tier, paid, due, commissions: string[], roofColours: string[], buildQueue: Build[], paidTotal, residentShares: string[]}
 * @property {Record<string, boolean|number|string>} flags
 * @property {Record<string, number>} counters
 * @property {Record<ThreadId, ThreadState>} threads     {beat, done, startedDay, lastAdvancedDay}
 * @property {LettersState} letters          {delivered: LetterId[], read: LetterId[], nextIndex}
 * @property {Record<NpcId, NpcMemory>} neighbors        {gifts: {itemId:count}, saidLines: Record<lineId, day>, nickname, affinity, sideTaken, lastTalkDay, lastPorchTalkDay}
 * @property {Record<MapId, MapState>} maps  {picked: Record<trigKey, day>, shaken: Record<treeKey, minute>, cracks: Record<key, bool>, opened: string[], encounterRng: number[4]}
 * @property {FieldLog} fieldLog             Record<FormId, {seen:bool, read:bool, held:bool, types?, ability?}>
 * @property {Collections} collections       {fish: Record<id,{n, best, tell}>, bugs: ..., relics: ..., donated: id[]}
 * @property {Badges} badges                 string[] spire ids; summitCleared
 * @property {DialState} dial                {current, startedOn, toggles, challenges: string[]}
 * @property {Stats} stats                   {playMs, steps, battles, catches, forecasts, wardWalls, summitAttempts, fishCaught, treesShaken, longestServing}
 * @property {RngState} rng                  {streams: Record<label, number[4]>}  (only stateful streams)
 * @property {string[]} log                  last 50 Day Page lines for the Archive
 */
/** @typedef {Object} Creature
 * @property {string} uid      `${catchIndex}` stable id; also the Shift stream label
 * @property {string} formId   current species form
 * @property {string} familyId
 * @property {string} nick
 * @property {number} level  @property {number} exp
 * @property {number} hp     @property {Status|null} status
 * @property {{id:string, pp:number, ppMax:number}[]} moves   up to 4
 * @property {string[]} memory       moves parked by Shifts
 * @property {string|null} heartmarkMove
 * @property {{x:number,y:number}} heartmark   per-individual pixel offset
 * @property {string} ability  @property {string|null} item
 * @property {number} bond     @property {number[]} trained   6 stat points
 * @property {string[]} shiftlog      forms held, in order
 * @property {number} shiftCount      draws consumed from the Shift stream (rerolls included)
 * @property {number[]} windowsUsed   curve points already resolved
 * @property {boolean} pendingWindow  @property {'auto-anchor'|'auto-up'|null} preset
 * @property {boolean} stillKnot
 * @property {number} mendsLeft  @property {number} caughtDay  @property {string} caughtMap
 */
```
`createEmptyWorld(seedInfo)` fills every key with its empty value so no system ever checks for `undefined`. `validateWorld(world)` returns a list of problems (unknown ids, negative counts, party > 6); `persist.save` refuses to write a world that fails it, and the debug overlay shows failures in red.

### Migrations
`migrate.js` exports `MIGRATIONS = { 1: (d) => d }` keyed by the version being upgraded **from**; `migrateWorld(data)` runs them in order up to `SCHEMA_VERSION`, then `createEmptyWorld` is merged under it (`fillDefaults`) so new keys appear. `core/save` is created with `{version: SCHEMA_VERSION, migrations: MIGRATIONS}` so the same code path serves slots and import strings.

### Derived caches (never in world)
Sprite canvases, chunk caches, path caches, the species index, the lighting LUT, text layouts. They live in module-level `Map`s and are dropped on `world:replaced` or `map:enter`.

---

## 4. Overworld architecture

### 4.1 Map data module
```js
/** @typedef {Object} MapDef
 * @property {string} id  @property {string} name  @property {number} w  @property {number} h  (tiles)
 * @property {string} tileset             id in tilesets.js
 * @property {'exterior'|'interior'} kind @property {string} region   for curve level and music
 * @property {string} ground   RLE string "a12b3..." of tile ids per row, decoded by tilemap.js  (or number[] for small maps)
 * @property {string} detail   same, may be '' ; drawn over ground, under entities
 * @property {string} over     drawn over entities (tree crowns, roofs)
 * @property {string} collision  chars: '.' walk  '#' solid  '~' water  't' tide-gated (walkable at low)  'd' deep (surf/creature only)  'b' bridge
 * @property {string} tide     per-tile tide variant: '.' none  'w' wet-at-high  'g' glow-at-night-low
 * @property {Trigger[]} triggers
 * @property {Spawn[]} spawns     NPC and prop placements
 * @property {EncounterZone[]} zones  rectangles with an encounters.js table id
 * @property {string} music  @property {{x:number,y:number}} defaultEntry
 */
/** @typedef {{x:number,y:number,w?:number,h?:number,kind:'warp'|'door'|'sign'|'script'|'tree'|'dig'|'fish'|'shop'|'bed'|'porch'|'mailbox'|'waystone'|'spire'|'item'|'causeway', id:string, to?:{mapId:string,x:number,y:number,facing?:string}, script?:string, cond?:Cond, item?:string, tideLow?:boolean, once?:boolean}} Trigger */
```
Writers produce maps by hand in ASCII rows, which `tools/map-from-ascii.mjs` (optional) converts to the RLE strings; nothing at runtime depends on the tool. Chunking is done at load, not in data.

### 4.2 tilemap.js (pure)
```js
export function loadMap(def, tilesets) -> TileMap  // decoded Uint16Array layers, chunk index, trigger grid
export function tileAt(map, layer, x, y) -> number
export function passable(map, x, y, {tideState, canSurf}) -> boolean   // 't' is passable when tideState==='low' (or 'falling' below threshold 0.2 per core/time isLowTide)
export function triggersAt(map, x, y) -> Trigger[]
export function zoneAt(map, x, y) -> EncounterZone|null
```

### 4.3 Entities and camera
Entities are plain objects in `world`-independent scene memory; only the player and persistent map state live in `world`.
```js
/** @typedef {{id:string, kind:'player'|'npc'|'creature'|'item'|'prop', x:number, y:number, facing:'up'|'down'|'left'|'right', moving:boolean, fromX:number, fromY:number, t:number, speed:number, artId:string, frame:number, solid:boolean, npcId?:string, speciesId?:string, itemId?:string, emote?:string, path?:number[], onInteract?:string}} Entity */
export function createEntityWorld(map) -> EW   // {list, grid, add, remove, at(x,y), near(x,y,r)}
export function tryMove(ew, map, ent, dir, ctx) -> boolean  // tile-to-tile; sets from/to and t=0; collisions against grid and passable()
export function tickMovement(ew, ent, ms)      // lerps t; snaps at 1
export function createCamera({w,h,mapW,mapH}) -> {x,y, follow(ent,ms), shake(dx,dy), set(x,y)}
```
Movement is tile-to-tile with a lerp (16 px over 160 ms walking, 100 ms running). Collision checks happen at the start of a step, not every frame, so determinism holds.

### 4.4 NPC schedules
```js
/** @typedef {{at: number (minute of day) | {tide:'low'|'high'} | {phase:string}, mapId:string, x:number, y:number, facing?:string, until?:number, activity?:'stand'|'wander'|'fish'|'sit'|'sleep'|'shop', days?:number[], cond?:Cond}} ScheduleEntry */
export function scheduleTarget(npc, world, minute) -> ScheduleEntry      // last entry whose `at` <= minute and cond holds, with tide/phase entries resolved via world.clock
export function planPath(map, from, to) -> number[]|null                   // BFS, 4-dir, respects passable(tideState); cached per (mapId, from, to, tideState)
export function tickNpc(ent, npc, map, world, ms)                          // follow path; if target map differs, despawn (NPC is "elsewhere")
```
NPCs off-map are not simulated; on map entry each NPC with a target on this map is placed **at** the target (or at the door if their entry `at` was within the last 3 in-game minutes, so you can see them arrive). Simple and robust; no cross-map pathing.

### 4.5 Interaction system
```js
/** @typedef {{verb:string, label:string, target:Entity|Trigger|null, kind:string, script?:string, cost?:number, disabled?:string}} Interaction */
export function resolveInteraction(G, map, ew, player) -> Interaction|null
```
Priority: entity in facing tile (NPC → `talk` / creature → `read` / item → `pick up`) → trigger in facing tile (`tree` → shake, `dig` with shovel, `fish` facing water with rod, `sign` read, `door` enter, `shop`, `bed`, `porch`, `mailbox`) → trigger under player (`warp` fires on step, not on confirm). The current tool only changes the verb when the tile offers several (water: `fish` with rod, `look` otherwise). The HUD shows the verb label; confirm executes. All verbs route through one function in the overworld scene, `doInteraction(G, it)`, which is the only place that pushes dialogue/shop/fishing/battle scenes from the overworld.

### 4.6 Encounters (seeded)
```js
export function stepEncounter(world, map, zone, rngs) -> EncounterResult|null
// EncounterResult = {speciesId, level, errant:boolean, zoneId}
```
Per step in a zone: roll `rngs.map(mapId).chance(zone.rate * modifiers)`; on hit, pick from the table selected by `(phase: day|night, tide: low|high|any)` with weights; Errant check `1/300` from the same stream; level in range. The map stream's state is saved in `world.maps[id].encounterRng`, so a reload reproduces the next encounter (no save-scumming encounters, by design).

### 4.7 Day/night, weather, tide as render passes
Simulation sees only `world.clock` (minute, tideState) and `weather.current(world)`. Rendering is three ordered passes in `mapRenderer.drawFrame(G, view)`:
1. **Tiles** (chunk cache for the tide variant in effect: `dry|wet|glow`; see 12).
2. **Entities** y-sorted, then the `over` layer.
3. **Light pass**: `ctx.globalCompositeOperation='multiply'` fill with `ambientFor(minute, weather).tint`; then `'lighter'` radial blobs for lights (porches, lamps, lantern, fireflies) from `lighting.sources(map, world)` (porches lit only when their flag is set); then weather particles from `core/fx` presets (`rain`, `fog` as drifting motes, `snow`); then the HUD. Reduced-motion setting disables weather particles and shake, not the tint.

### 4.8 Transitions between maps, causeways, interiors
```js
export function resolveWarp(world, trigger, data) -> {ok:true, to:{mapId,x,y,facing}} | {ok:false, reason:'tide'|'locked'|'cond', message:string}
```
Doors: `kind:'door'`, autosave on entry (`persist.autosave(G,'door')`). Causeways: the tiles themselves are `'t'` in the collision layer, so no special-casing; a `causeway` trigger at each end only exists to show the tide hint ("Covered. Low tide in 1h 12m") when the player bumps a wet tile. Interiors are maps with `kind:'interior'` (no clock pass for sky, light pass uses lamp ambient). Map changes are a `scenes.transition('fade', 300, () => overworld.loadMap(to))` inside the overworld scene (no scene replace), keeping the entity world and chunk caches scoped per map.

---

## 5. Battle integration

### 5.1 The pure engine
```js
/** @typedef {Object} BattleSetup
 * @property {'wild'|'trainer'|'duel'|'spire'|'summit'|'script'} kind
 * @property {Creature[]} player   live references? NO: deep copies (engine owns its copies; results are applied back)
 * @property {Creature[]} foe  @property {string|null} trainerId
 * @property {DialRules} rules    from dials.js: canRun, readCost, wardBadge, captureDisplay, holdOutTurns?
 * @property {string[]} abilitiesByForm   per-seed fixed abilities (from worldgen)
 * @property {boolean} doubles */
/** @typedef {{type:string, ...}} BattleEvent   e.g. {type:'move', who, slot, moveId}, {type:'damage', who, amount, hp, word:'Strong'|...}, {type:'status', who, kind}, {type:'stat', who, stat, stages}, {type:'faint', who}, {type:'ward', who, abilityId, readout}, {type:'switch', side, slot}, {type:'capture', stage:1|2|3, success?:boolean, odds}, {type:'text', key, args}, {type:'end', result:'win'|'lose'|'caught'|'ran'|'held'} */
/** @typedef {{kind:'move', slot:number, target?:number} | {kind:'switch', slot:number} | {kind:'item', itemId:string, target?:number} | {kind:'capture', lanternId:string} | {kind:'run'} | {kind:'read'} | {kind:'stance', on:boolean}} BattleAction */
export function createBattle(setup, rng) -> Battle
// Battle = { state: BattleState (plain, serializable), legal(): LegalMenu, step(action: BattleAction): BattleEvent[], done(): boolean, result(): BattleResult, captureOdds(lanternId): {pct, band} }
/** @typedef {{result, exp: Record<uid, number>, caught: Creature|null, partyAfter: Creature[], fieldLog: {seen: string[], read: string[]}, wardWalls:number, glint:number, turns:number}} BattleResult */
```
`step` resolves one full turn (player action + AI action + end-of-turn) and returns the ordered events. Nothing animates inside the engine; the engine never sleeps. Unit tests replay action lists against a seeded rng and assert on event sequences; fuzz tests assert `legal()` never returns an empty menu (Scrap fallback) and `step` never throws for any legal action.

### 5.2 Battle scene and animation queue
```js
export function createBattleScene(G) -> Scene   // enter({setup, onEnd(result)})
```
Internal queue: `BattleEvent[]` → `Anim[]` via `animFor(event)` (a table in `scenes/battleAnims.js`, owner battle-ui). Each `Anim` is `{ms, start(view), update(view, t), end(view)}` using `G.tweens` and `G.fx`; text events use `ui/textbox` and wait for confirm (or auto-advance at text speed `fast`). When the queue drains and `!battle.done()`, the command menu opens built from `battle.legal()` so unselectable options are drawn greyed with the reason. `cancel` on the top-level menu does nothing in trainer battles (Run greyed), as required. A `skip` setting collapses anims to 1 frame each: the Playwright bot uses it.

When `battle.done()`: the scene calls `onEnd(battle.result())` **after** popping itself, so the overworld's `resume(result)` is the single integration point:
```js
// systems/encounterFlow.js
export function applyBattleResult(G, result) -> {levelUps: LevelUp[], windows: Creature[], learned: ..., caught: Creature|null}
```
It calls `party.syncFromBattle`, `exp.award` (bench EXP, catch-up, damping only if `kind==='rematch'`), `fieldLog.markSeen/Read/Held`, `stats.inc`, `bag/wallet` for rewards, and marks `pendingWindow` on creatures that crossed a curve point. Then the overworld pushes, in order: level-up/learn-move dialogues, the "Open Forecast now / Later" confirm per creature with a window, the nickname prompt for a catch, and finally `persist.autosave(G, 'catch'|'battle')`.

### 5.3 Shift Forecast scene
```js
export function createForecastScene(G) -> Scene   // enter({creatureUid}) ; pop({outcome:'accepted'|'anchored', formId?})
// uses battle/shift.js:
export function drawForecast(creature, family, dialRules, stream: Rng, {bond, tilts}) -> {cards:[{dir:'up'|'side'|'down', formId, pct, types, totalDelta, ability, keeps, ward:boolean}], picked: 'up'|'side'|'down'}
export function applyShift(creature, formId, data) -> {creature, toMemory: string[]}   // keeps level/exp/item/nick/bond/trained/heartmark; appends shiftlog
```
`picked` is decided when the cards are drawn (the flip animation is theatre; no input timing). Reroll increments `creature.shiftCount` and draws again from the same stream — `stream = rngs.creature(uid)` positioned by skipping `shiftCount` draws, so the stream is reproducible from `(seed, uid, shiftCount)` with no saved rng state. Accept → `party.applyShift(G, uid, formId)` → `fieldLog.markHeld`, `persist.autosave(G,'shift')`. Anchor → `wallet.anchors--`, window consumed. Deferred windows are collected by the Waystone/Rest interaction, which pushes Forecast scenes back to back.

### 5.4 Capture flow
Capture is a `BattleAction {kind:'capture'}`; the engine emits `capture` events for the three glow segments and the result, with odds computed by `battle/capture.js` and shown in the Lantern submenu **before** the action is confirmed (`battle.captureOdds(lanternId)` returns `{pct, band}`; the UI shows pct or band per dial rules). The sure-catch Lantern lives in the `keepsakes` pocket; `ui/confirm` with `defaultIndex: NO` names the target. On success the engine's result carries `caught` (a full Creature with `uid` assigned by `party.nextUid(world)` — the catch index is the Shift stream key, so it is allocated by the store, not the engine; `encounterFlow` passes `nextUid` into the setup).

---

## 6. Dialogue, cutscene and quest scripting

### 6.1 Format
A script is an array of ops. Each op is a plain object `{op, ...args}` or the shorthand string `"Name: line"` for `say`.
```js
export const OPS = {
  say:        {speaker:'string?', text:'string', portrait:'string?', emote:'string?'},
  choice:     {prompt:'string?', options:[{text:'string', goto:'label', cond:'Cond?'}], default:'number?'},  // cursor starts on `default` (0) — writers put the safe option first
  label:      {name:'string'},
  goto:       {label:'string'},
  branch:     {cond:'Cond', then:'label', else:'label?'},
  if:         {cond:'Cond', ops:'Op[]', else:'Op[]?'},    // sugar; validator flattens
  setFlag:    {flag:'string', value:'any?'},  incCounter:{counter:'string', by:'number?'},
  give:       {item:'string', n:'number?'},  take:{item:'string', n:'number?', ask:'boolean?'},
  giveMoney:  {n:'number'},  takeMoney:{n:'number'},  giveCreature:{species:'string', level:'number', nick:'string?'},
  move:       {who:'string', path:'string', wait:'boolean?'},   // path like "UUURRD"
  face:       {who:'string', dir:'string'},  teleport:{who:'string', mapId:'string?', x:'number', y:'number'},
  wait:       {ms:'number'},  camera:{x:'number?', y:'number?', who:'string?', ms:'number?', shake:'number?'},
  emote:      {who:'string', emote:'string'},  playSfx:{name:'string'},  music:{track:'string?', stem:'string?', on:'boolean?', fade:'number?'},
  openShop:   {shop:'string'},  startBattle:{trainer:'string', onLose:'label?', holdOut:'number?'},  forecast:{who:'string'},
  letter:     {id:'string?'},  toast:{text:'string'},  nickname:{who:'string', offer:'string'},
  spawn:      {who:'string', artId:'string', x:'number', y:'number'},  despawn:{who:'string'},
  setTime:    {minute:'number'}, warp:{mapId:'string', x:'number', y:'number'},   // story use only
  beat:       {thread:'string', to:'number'},  save:{reason:'string?'},  end:{}
};
```

### 6.2 The interpreter (pure, resumable)
```js
/** @typedef {{world: World, data: DATA, rng: Rng}} ScriptEnv */
export function createRunner(script: Op[], env: ScriptEnv, {pc=0, vars={}}={}) -> Runner
// Runner = {
//   next(result?: any): {done:false, op: Op} | {done:true},   // runs pure ops internally (setFlag/branch/if/label/goto/incCounter via systems/flags) and YIELDS only ops the host must perform (say, choice, move, wait, camera, give(ask), startBattle, forecast, openShop, letter, nickname, music, playSfx, emote, spawn, warp, setTime, save, end)
//   state(): {pc, vars},                                        // serializable; a save mid-cutscene stores this
//   isDone(): boolean }
```
`next(result)` is a coroutine step: the host performs the yielded op (plays the text, moves the NPC, runs the battle), then calls `next(result)` with what the op produced (`choice` → index, `startBattle` → result, `take ask` → boolean, `nickname` → string). Pure ops never yield, so a Node test can run a whole script that has no host ops and assert the world. The host for the overworld is `scenes/cutscene.js` (opaque:false over the overworld; `updateBelow:true` so NPCs keep walking); `scenes/dialogue.js` is the textbox + choice widget it pushes for `say/choice`. Text speed (`settings.textSpeed`: slow/normal/fast/instant), skip (hold cancel after the first viewing of a script id, tracked in `world.flags['seen:'+scriptId]`), portraits (`portrait` arg or `npcs[speaker].portraitId`), and name colours are all dialogue-scene concerns.

Give/take inside scripts call the real systems (`bag.give`) so one code path applies rules (stack limits, overflow basket, one-of-a-kind confirm).

### 6.3 Registration: who runs which script
```js
// script/registry.js
export function resolveScript(world, data, target: {kind:'npc'|'sign'|'trigger'|'porch'|'bed'|..., id}) -> {scriptId, source:'thread'|'favour'|'schedule'|'memory'|'default'}
```
Priority for an NPC: (1) the current beat of their thread if its `when` condition holds and `thread.lastAdvancedDay !== today` rules allow; (2) a pending favour; (3) an `npcs.js` schedule-specific line (`lines.fishing`, `lines.night`); (4) porch talk if 20:00–23:00 and standing at their porch trigger; (5) the memory-filtered generic pool (`lines.generic[]`, excluding ids said in the last 5 days per `neighbors.saidLines`); first tap gives one line, `Linger` pushes a second resolve with `{linger:true}`. Writers never touch the registry: they add beats with `when` conditions in `threads.js`, lines in `npcs.js`, and scripts in `data/scripts/`. Letters are not scripts: `systems/letters.js` delivers `letters[nextIndex]` on `day:start`; a letter may name `unlocks: {flag}` and `relicId`, which `cond.js` can test.

Life-thread beats advance in `quests.advanceOnDayStart(G)` (Mondays or whatever `threads.js` says per beat; the rule is data: `beat.advance: {dayOfWeek:0}`), guarded by "only if involved" = the previous beat's script was run.

---

## 7. UI toolkit

All widgets are plain objects created by factories and drawn with `core/font` and `art/ui.js`. No widget owns game state; it receives values each frame.
```js
// ui/focus.js — one focus model for d-pad, pointer, touch
export function createFocus(items: FocusItem[], {wrap=true, cols=1, defaultIndex=0}) -> Focus
// FocusItem = {rect:{x,y,w,h}, disabled?:boolean, reason?:string, onSelect?():void}
// Focus = {index, move(dx,dy), handle(input): 'select'|'cancel'|null  (uses input.repeat for d-pad, input.pointer for hover/tap: a tap on an item that is not focused focuses it; a tap on the focused item selects — two-step on touch avoids mis-taps), set(i), item()}
// ui/panel.js
export function drawPanel(ctx, rect, {style:'paper'|'ledger'|'notice'|'plain'|'dark', title?, torn?:boolean, seal?:boolean})
// ui/list.js
export function createList({rect, rows: ()=>Row[], rowH=12, render(ctx,row,x,y,w,focused), onSelect(row), onCancel()}) -> Widget   // Widget = {update(ms), draw(ctx), handle(input), focus}
// ui/grid.js   same with cols; used by box, bag pockets, collections
// ui/tabs.js   createTabs({labels, onChange}) handles l/r shoulder actions + pointer
// ui/confirm.js
export function openConfirm(G, {text, yes='Yes', no='No', defaultNo=true, danger=false}) -> Promise<boolean>   // pushes a non-opaque scene; resolves on pop. Default cursor on No whenever defaultNo (always for one-of-a-kind items, deletes, overwrites)
// ui/toast.js
export function createToasts() -> {push({text, icon?, ms=2200}), update, draw}   // main.js draws it after the stack so it survives scene changes; listens to bus 'toast'
// ui/hud.js
export function drawHud(ctx, G, {verb: Interaction|null, showClock:boolean})   // clock + tide dial top-left (shape: a moon/sun icon and a tide gauge with a word), wallet top-right, verb prompt bottom centre with the device-appropriate glyph (input.lastDevice)
// ui/toolRing.js
export function createToolRing(G) -> Widget   // hold `tool` opens 8 sockets around the player; release selects; tap swaps lastTools; cancel never drops
// ui/textbox.js
export function createTextbox({rect, speed}) -> {setText(text, {speaker, portrait}), update(ms), draw(ctx), done, skipToEnd(), handle(input): 'advance'|null}   // uses drawTextTyped + sfx 'textTick' via bus
```
Theme (`ui/theme.js`) holds the colours for paper, ink, focus outline, disabled ink, danger, and the four type-word icons. Every tell is shape+word+icon; `theme` has no "red means bad" semantics without a glyph. Menus follow one law: `cancel` always goes back one level and never changes state; the main menu's last item is Save and `up` from the top wraps to it.

Menu state graph test: `tools/fuzz-menus.mjs` loads checkpoint fixtures in a headless page and presses random actions for N frames, asserting the stack depth stays below 6, every scene draws something non-black (sampled pixels), and no exception is thrown.

---

## 8. Data conventions

- Every data file exports frozen arrays/objects and an index: `export const SPECIES = freeze([...]); export const SPECIES_BY_ID = index(SPECIES)`. Ids are kebab-case ASCII; display names live in `name`.
- No data file imports a system. Data may import other data (`families.js` imports species ids only to validate at build time — but prefer plain string ids and let the validator check).
- Numbers that designers tune live in one `tuning.js` (`data/`), referenced by name; no magic numbers in systems.
- Text goes through `strings.js` templates: `t('loan.paid', {n})`.
- Adopt the protos with three changes: (1) `proto/battle/types.js`: delete the placeholder `PALETTE`; `TYPE_PALETTE_KEY` stays and `art/palette.js` resolves it. (2) `proto/creatures/sprites.js`: move `MASTER`, `pal`, `squash`, `hover` to `art/palette.js`/`art/spriteUtil.js`; split `S` into `art/creatures/<family>.js` each exporting `{formId: SpriteDef}`; keep the format `{rows, palette, heartmark, heartmarkBack, back, idle2, type, feature}` exactly. (3) `moves.js` gains nothing; `effect` keys become the contract `battle/effects.js` must implement, and the validator fails on an effect key with no handler.

### tools/validate-data.mjs
Runs under Node, imports `js/data/index.js` and `js/script/ops.js`, exits non-zero with a list:
- every `species.familyId` exists; every form in `families[].forms` exists; `shiftTable` keys and targets are forms of that family; every form appears in at most one family; `windows` ascend.
- every learnset/trainer/Heartmark move id exists; every ability id exists; Wards count == 3 (or whatever `tuning.wardCount` says).
- every `trainers[].party[].species` exists and level in 1..100; `scriptBefore/After` exist.
- every map: layer strings decode to `w*h`; every `warp/door.to.mapId` exists and its tile is passable at some tide; every `script` trigger names a script; every `shop` names a shop; every zone names an encounter table; every `spawns[].npcId` exists; two-way doors are symmetric (warn).
- every NPC schedule entry's `mapId` exists and `(x,y)` is passable; `threadId` exists and `threads[].npcId` matches.
- every script op is in `OPS`, args match the arity schema, every `goto/branch/choice.goto` label exists in that script, `startBattle.trainer` exists, `give.item` exists, `forecast.who` is `'player'` or a creature tag, `end` reachable (warn).
- letters: ids unique, order has no gaps, `relicId` exists.
- shops: item ids exist; hours in 0..1440.
- encounters: weights positive; species exist; levels sane; night/day/tide keys from the allowed set.
- `ids.js` regex on every id; duplicates fail.
- Effect keys used by moves have handlers (imports `battle/effects.js` HANDLERS keys).

### Authoring guideline (one page in README, repeated here)
"To add a neighbor: one entry in `npcs.js` (schedule, lines), one `spawns` entry in their home map, optional thread in `threads.js` with scripts in `data/scripts/<name>.js`. Run `node tools/validate-data.mjs`. Never edit `js/systems`." Same recipes for a map, a species family, a letter, a shop, a trainer.

---

## 9. Seeds and determinism

The seed code (`core/rng.encodeSeedCode`) carries dial, seed number and toggles. `rngs.js`:
```js
export function createRngs(seedNum: number, saved?: RngState) -> Rngs
// Rngs = {
//   worldgen(): Rng,                       // fork('worldgen'); used ONCE at new game to fix: species placement per zone (Flux+), per-species abilities, disc contents, Ward placement, trainer teams, field item shuffles. Results are written into world.gen (a small table) so nothing re-derives them.
//   map(mapId): Rng,                       // fork(`map:${id}`); STATEFUL: encounters, item respawn jitter, roaming spawns. State saved in world.maps[id].encounterRng.
//   creature(uid): Rng,                    // fork(`creature:${uid}`); STATELESS: Forecast draws positioned by creature.shiftCount (skip n draws). Star-touched roll uses the same stream.
//   day(kind, day): Rng,                   // fork(`${kind}:${day}`) for 'weather' | 'loot' | 'cracks' | 'glint' | 'shop:<id>' | 'fish:<map>' | 'mail'; STATELESS: derived from the day number, so a reload mid-day reproduces the day's plan.
//   battle(seq): Rng,                      // fork(`battle:${world.stats.battles}`); STATELESS per battle; accuracy/crit/AI inside one battle are reproducible from the battle index. The battle scene gets this rng; a reload before the battle gives the same first-turn rolls, a different action order gives different results (engine consumes draws in action order).
//   capture: part of battle rng.
//   ui(): Rng }                            // fork('ui') for cosmetic jitter; never saved.
export function serializeRngs(rngs, world) -> RngState   // only stateful map streams
```
Rule: a system never calls `Math.random`. ESLint-free enforcement: `tools/lint-owners.mjs` greps `Math.random` outside `js/debug` and fails. Seeded Shifts match the spec: same seed + same catch order + same reroll count = same cards. Changing the dial mid-run sets `world.seed.changedMidRun = true` (Seed Card flag) and changes only odds/scouting/anchor rules read from `dials.js` at runtime; `world.gen` is never recomputed.

---

## 10. Save/load

```js
export function createPersist(G, {storage=localStorage}) -> Persist
// Persist = {
//   autosave(G, reason: 'door'|'town'|'waystone'|'spire'|'rival'|'summit'|'catch'|'shift'|'rest'|'timer'|'debug'): SaveResult,
//   saveManual(G, slot:1|2|3): SaveResult,  load(slot): {ok, world?, error?},  list(),  remove(slot),
//   latest(): SlotSummary|null,  exportString(slot): string,  importString(str): {ok, world?, error},
//   tick(G, ms)   // route timer: autosave every tuning.routeAutosaveMs when store.dirty and the top scene is overworld and no cutscene is running
// }
// SaveResult = {ok:boolean, error?:SaveError, slot, place:string, time:string}
```
Built on `core/save.createSaveSystem({storage, prefix:'<title>.', autosaveSlots: challenge NoRewind ? 1 : 3, manualSlots: NoRewind ? 0 : 3, version: SCHEMA_VERSION, migrations: MIGRATIONS, summarize: (w) => ({name, place, day, time, tier, badges, playMs, nick: party[0]?.nick})})`. Before every write: `clockSys.serializeInto(world)`, `serializeRngs`, `validateWorld` (refuse on error, toast red). Saves never happen from inside a transition or while a battle scene is on the stack (the battle result is applied first, then the save), so a save is always at a resumable point: overworld or Forecast-pending. Mid-cutscene saves store the runner state in `world.cutscene = {scriptId, pc, vars}` only for the `save` op (writers place it after battles).

The core verified write protocol (`tmp` → read back → swap) already satisfies "never fails silently". On `ok:false`, the HUD shows the red "Save failed" banner, `persist` retries once after 2 s, then leaves the banner until the next success. Autosave triggers are events on the bus, not calls sprinkled in scenes: `map:enter{kind:'door'|'town'}`, `waystone:use`, `spire:door`, `battle:start{kind:'rival'|'summit'}`, `catch`, `shift:resolved`, `day:end`. Loading never writes. Export/import: `core/save.exportString` (base64 + crc) shown in a copyable textbox in the saveLoad scene; import validates and migrates.

Not saved: entity positions of NPCs (recomputed from schedule), chunk caches, decoded sprites, path caches, the animation queue, toast queue, battle state (saves are blocked during battle), tween state.

Crash recovery: boot compares `persist.latest()` against `localStorage['<title>.cleanExit']` (set `0` on boot, `1` on `pagehide`/explicit quit). If the last run did not exit cleanly, the title offers "Resume from autosave: [place], [n] minutes ago" with the summary's counters diffed against the second-latest autosave to list what rolls back ("1 trainer battle").

---

## 11. Debug and test hooks

```js
// debug/hook.js (installed only with ?debug=1 or on localhost)
window.__game = {
  G, get world() { return G.world }, state: () => structuredClone(G.world),
  warp(mapId, x, y), give(itemId, n=1), money(n), setTime(h, m=0), setTide(x /*0..1 forces clock tide offset*/),
  addCreature(speciesId, lv, opts), heal(), battle(trainerId), wild(speciesId, lv), forceForecast(uid?),
  flag(name, value?), flags(), speed(x /*0.25..32*/), skipAnims(bool), scene: () => G.scenes.top()?.name,
  stack: () => G.scenes.stack.map(s => s.name), press(action, frames=1), release(action), tap(action),
  text: () => current visible text (dialogue/menu labels) for assertions,
  save(reason), load(slot), mark(label) /* screenshot marker: draws label into the frame corner for 1 frame and logs `MARK label` */,
  errors: [] /* window.onerror + unhandledrejection collected */, version, seed: () => G.world.seed.code,
  step(n) /* advance n ticks while paused */, pause(), resume(), validate: () => validateWorld(G.world)
};
```
`press/tap` inject tokens into `core/input` through a test-only `input.inject(token, down)` helper (add to input.js: 10 lines; keyboard listeners already resolve tokens, so injection enters the same buffer).

URL flags (`debug/flags.js`): `debug=1`, `seed=CODE`, `skipTitle=1` (default lease card), `speed=8`, `touch=1`, `slot=auto1` (load), `mode=fit`, `mute=1`, `noanim=1`, `scene=battle&trainer=id` (jump straight into a scene for visual work).

### tools/playtest.mjs (Playwright, dev dependency only; `check.sh` skips with a warning when not installed)
Steps, each a function `(page, g)` that uses `__game` and asserts on `state()`:
1. boot with `?debug=1&seed=FLUX-TEST-0001&skipTitle=1&speed=8&noanim=1`; assert no errors, scene `overworld`.
2. arrival script completes (tap confirm until `scene==='overworld'` and `flags['arrived']`).
3. first creature: run the starter script via `__game.flag('story.starter')` or play through; assert `party.length===1`.
4. first battle: `wild()`, choose moves until `battle:end`; assert `stats.battles===1`.
5. first catch: `wild(); tap through capture`; assert `box+party` grew, `fieldLog[...].held`.
6. money + loan 1: `give` sellables, walk to buyer (`warp`), sell, `warp` yard, pay; assert `loans.tier===2`, porch flag set.
7. first letter: `setTime(6)`; assert `letters.delivered.length===1`; open mailbox; read.
8. Forecast: `addCreature(x, curveLevel-1)`, `wild()`, win; assert window prompt; accept; assert `shiftlog.length===2`.
9. tide gate: `setTide(1)` bump causeway → message; `setTide(0)` cross; assert `player.mapId` changed.
10. a day cycle at speed 32: rest → Day Page → day increments → NPC appears at schedule spot at 7:00.
11. save/export/import round-trip; reload page with `slot=auto1`; state equal on the fields that matter.
12. arc skeleton: for each spire id in data: `warp` to the door, `battle(leaderId)`, win with a cheat party; assert badge. Pay the ladder with `money`; assert ending scene reached and credits roll; post-game flag.
Every step calls `mark(name)` and takes a screenshot to `tools/out/<n>-<name>.png`. Failures dump `state()` to JSON.

### Node unit tests per module
`node --test test/` runs every `*.test.mjs`. Minimum per module: schema (empty world validates; a mutated world fails as expected), store, migrate (v0 fixture → current), persist (memory storage; refuse invalid; crash recovery), rngs (fork stability, shiftCount positioning), tilemap (decode, passable at tides), npcAI (path exists, schedule resolution at tide entries), encounter (deterministic sequence), interact (priority table), battle (damage table cases, Scrap fallback, Wards, capture odds bands, exp split), shift (odds sum to 100, Errant Down 0 on Drift/Flux, keeps-N count), script runner (branching, resume from state, every op validated), flags/cond, loans (ladder arithmetic, resident shares), letters (one per day), neighbors (no repeat in 5 days), fishing (state machine), dayPage (tomorrow list).

### tools/check.sh
```sh
set -e
node tools/validate-data.mjs
node tools/lint-owners.mjs
node --test test/
node tools/smoke-import.mjs         # imports every js/ module under Node to prove no DOM at import time (browser-only ones are imported too; they must not touch window at import)
[ -n "$PLAYWRIGHT" ] && node tools/playtest.mjs || echo "skip playtest (set PLAYWRIGHT=1)"
```

---

## 12. Performance budget

Frame budget 16.6 ms; target ≤ 6 ms draw + ≤ 3 ms update on a 2020 laptop in Chrome; Safari is the floor.
- **Tiles**: maps are split into 8x8-tile chunks (128x128 px). Each chunk is an `OffscreenCanvas` (fallback `document.createElement('canvas')`) rendered once per `(chunk, layer, tideVariant)`; the visible view is at most 5x4 chunks → ≤ 20 `drawImage` per layer, ≤ 60 for ground+detail+over. Animated tiles (water, glow mud) are not baked; they are drawn as a fourth small pass from an animation list built at load (count capped at 400 per map; validator warns above). Tide changes flip the variant pointer, nothing re-renders. Chunk cache per map ≤ 3 variants × 3 layers × (map area/64) canvases; a 128x96 map is 192 chunks × 9 = ~1.7k small canvases, acceptable; eviction when leaving the map.
- **Sprites**: `core/pixelart.decodeSprite` caches by content; `art/atlas.js` additionally pre-builds one atlas per sheet (`buildAtlas`) for characters and tiles so the hot path is `drawAtlasFrame`. Creature sprites decode on first use (battle entry, Forecast), silhouettes via `silhouette()` cached too.
- **Entities**: cap 64 simulated entities per map (NPCs ≤ 16, roaming creatures ≤ 12, items ≤ 24, props the rest; props are static and drawn from the `over`/`detail` layers where possible). Only entities within view+2 tiles are drawn; all are simulated (cheap tile steps). Pathfinding BFS is bounded by map size and cached; recompute only on target change or tide flip.
- **Light pass**: one multiply fill + ≤ 24 radial gradients (cached as canvases per radius/colour) + particles. Weather particles come from `core/fx` pools: pool 512 particles, preallocated plain objects, no per-frame allocation; `fx.setBudget(f)` scales emitters.
- **Text**: `core/font` atlases per colour; menus rebuild layouts only on change (widgets keep a `dirty` flag).
- **GC**: no closures created per frame in hot loops; event payloads are small; `structuredClone` only at save time.
- **Measurement**: `?debug=1` overlay shows ms/frame for update, draw, present, and counts of drawImage calls (wrapped ctx in debug builds only). 30-fps fallback as in section 2.

---

## 13. Build order and integration plan

### Day 1 stubs (shell owner, half a day)
`index.html, css, main.js, config.js, state/schema.js (empty world), state/store.js, state/persist.js (thin), data/index.js (empty tables), audio/index.js (no-op adapter), scenes/boot.js, scenes/title.js (text + "New Game"), scenes/overworld.js (draws a checkerboard, moves a rectangle), debug/hook.js, tools/check.sh, tools/smoke-import.mjs`. From this moment `python -m http.server` shows a title and a walkable square, `node --test` passes, and `__game` exists. Every other file is added behind an interface already called by a stub.

### Dependency tiers (each tier can start when the previous tier's *interfaces* exist, not their implementations)
1. **Tier 0 (exists)**: core.
2. **Tier 1 (parallel, week 1)**: `schema/store/persist/rngs`; `data/*` tables seeded with 2 maps, 3 species in 1 family, 6 moves, 2 NPCs, 3 letters, 1 trainer (enough to exercise every validator rule); `art/palette + atlas + tiles + chars`; `audio/index + director + 1 track`; `ui/*`; `world/tilemap + entities + camera + player`; `battle/engine` skeleton with `damage/legal`; `script/runner + ops + cond`.
3. **Tier 2 (week 2)**: `render/*` on top of tilemap; `world/npcAI, interact, encounter, transit, weather, lighting`; `systems/*` each against schema; `battle/effects, status, ai, capture, exp, shift`; scenes `dialogue, cutscene, menu, party, bag, shop, battle, forecast, saveLoad, settings`.
4. **Tier 3 (week 3)**: `encounterFlow`, Forecast flow, loans/ledger/dayPage scenes, letters, threads, fishing/digging/trees scenes, map screen, Field Log, collections, ending/credits, seed card; content ramps (maps, families, NPCs, letters) on the validator.
5. **Tier 4**: polish, audio tracks, fuzzing, performance pass, accessibility pass.

### Integration checkpoints (each gated by `check.sh` green and a Playwright step)
- **C1 (end week 1)**: walk two maps through a door; talk to an NPC via a script; the clock runs; tide flips a causeway tile; autosave on door; reload restores position. Playtest steps 1, 9, 11.
- **C2 (mid week 2)**: wild battle from grass to result applied to party; a catch appears in the party; Field Log marks Seen/Held. Steps 4, 5.
- **C3 (end week 2)**: Forecast resolves from a window; loan payment ladder tier 1→2 with the overnight build visible next day; first letter at 6:00; Day Page. Steps 6, 7, 8, 10.
- **C4 (week 3)**: full arc skeleton with cheat party: every Spire, Summit, Relighting ending, credits, post-game flag. Step 12.
- **C5**: menu fuzz 10 minutes without exception or black frame on every checkpoint fixture; 60 fps on the largest map in Chrome/Firefox/Safari; touch run on a phone.

### Ownership boundaries that prevent merge conflicts
- A system only touches its own `world.<key>`; schema changes go through the state owner, who adds the key with its empty default and a migration the same day.
- Scenes call systems; systems never import scenes. UI never imports systems (only reads `G.world` and emits intents via the scene).
- Data authors add files and register them in `data/index.js` (one line each; the only shared file, kept alphabetical to make conflicts trivial).
- Art authors add sprite defs under their own files and register art ids in `art/atlas.js`'s table (same rule).
- `main.js` and `config.js` are shell-only; feature flags for unfinished scenes live in `config.FEATURES`, and the menu hides entries whose feature is off, so partial builds never show dead doors.

### What must change in the protos and core (small, named)
- `core/input.js`: add `inject(token, down)` for the debug hook (test-only path).
- `core/audio.js`: finish the `audio` singleton per contract or export `createAudio()`; the adapter in `js/audio/index.js` absorbs either.
- `core/time.js`, `tween.js`, `fx.js`: implement per contract; `clockSys` needs `serialize/restore`, `setSpeed`, `skipTo`, and the `onTideChange/onDayStart` callbacks; `fx` needs `setBudget(f)` (one extra method) for the 30-fps fallback.
- `proto/battle/types.js`: drop `PALETTE`; `proto/creatures/sprites.js`: split per family, move palette helpers to `art/`. Interfaces otherwise adopted as-is.

This proposal ships a complete game with one state tree, one context object, one interpreter, one battle engine that never animates, one renderer with three passes, and a validator that makes content authors independent of engineers. Nothing in it needs to change when the panel decides the title, the fiction, the numbers or the cast.
