# UNDERBYTE — Module Contract (`CONTRACT.md`)

This is the binding interface between the engine core and the five module implementers.
`DESIGN.md` says *what* the game is (every number lives there); this file says *how the
code fits together*. If the two disagree about an API, this file wins; if they disagree
about a gameplay number, `DESIGN.md` wins. The skeleton in `js/` already implements
everything described here and `test/smoke.cjs` proves it (`node underbyte/test/smoke.cjs`).

## Changes since v1 (read this first — v2, after the independent verification round)

Every item names the section it changes. Nothing was removed; signatures were only added to.

1. **§1.1 (new) `UB.IDS` in `util.js`** — every id two modules share is pinned in one table:
   zone ids, song ids, fighter ids, ability ids, **boss ids** (`tallock weftyr corrosant kernauth`),
   the **arena → boss table** (`dc_sentinel→tallock`, `lw_weftyr→weftyr`, `bv_corrosant→corrosant`,
   `rw_throne→kernauth`), pickup type ids, **enemy type ids** + `spawn.variant` ids, vendor items
   (`spare_cell 90`, `hot_clock 160`, `deep_ping 120`) and the **sfx name → owner** table.
2. **§4.3 RoomSpec.boss** gains `spawn: {x, y}` (the boss's start tile, required) and
   `locked: [exitId…]` (exits solid until the boss is beaten, e.g. the brine crust over
   `bv_corrosant.B`). `normalize()` fills `seal/locked/final/spawn` defaults. The debug arena got
   `spawn: {x: 24, y: 14}` (tilemaps of the three debug rooms are byte-identical to v1).
3. **§4.3 `UB.World.validate()` is deep** (exit edge placement, reciprocity, equal openings,
   footing, no real→debug links, spawn types/variants/footing, platforms, nodes, cores, bits,
   vendor, boss record incl. the pinned id per arena, start, unique ids, map-grid overlaps) and
   **runs at boot** (`main.js` console.warns each line; tests assert `[]`).
4. **§4.4 step-up** documented as inert on tile-aligned geometry (only helps on movers).
5. **§4.6 Audio**: `UB.Audio.sfx` is a silent no-op for unknown names; new `UB.Audio.loop(name, on)`
   + `stopLoops()`; the full DESIGN §13.8 name list with its triggering module.
6. **§4.7 Render**: `drawVendor(ctx, x, y, zone, t, lookX)`; fog gradient cached per zone (no
   per-frame gradients anywhere: boss bar, low-HP vignette, logo and wrapped text are cached in `ui.js`).
7. **§5 Characters**: `energyMax` is set by the engine from the vendor state (125 with Spare Cell)
   on load/purchase — the player must not reset it in `respawn()/place()`; `wallSlide` goes through
   `UB.Audio.loop`; control hints (`save.hints`) are recorded by the engine, not the player.
8. **§6.1 Enemies**: pinned type/variant ids; `walker` must stay in `UB.Enemies.TYPES` (debug rooms);
   `game.spawnEnemy(type, tx, ty, opts)` for motes; projectile contract (see 11).
9. **§6.2 Bosses**: `UB.Bosses.create(bossId, room, game, spec)` — read `spec.spawn`/`spec.pickup`;
   `proto_warden` must stay in `DATA`; **multi-phase rule**: the boss handles a phase change
   *inside* `takeHit` (refill `hp/maxHp`, set `phase`, `game.player.iframes`, may call
   `UB.UI.bossCard` / `UB.Audio.sfx('bossPhase')`); the engine only ends the fight when `takeHit`
   returns with `hp <= 0`. `locked` exits are sealed on room entry while the boss lives.
10. **§7 Hits**: enemy/boss hits honour `multi`; `multi` hits never grow `hitList`; enemy/boss hits
    reach the player only in `mode === 'normal'`.
11. **§7 Projectiles**: must be `UB.Entity` instances with `owner: 'player'|'enemy'`; player attacks
    never pop player-owned projectiles; cap 64 (oldest evicted); culled 64 px outside the room;
    drawn only near the camera.
12. **§8 Vendor is wired (engine)**: `▲ TRADE` prompt at `room.vendor`, Up → `openOverlay('shop')`,
    `game.buy(itemId) → 'bought'|'poor'|'sold'|'unknown'` (deducts bits, saves, applies the effect,
    queues the `{ITEM} PURCHASED` banner for when the panel closes), `game.hasDeepPing()`,
    `game.applyDeepPing()` (map reveal, also on every room entry), Spare Cell applied in
    `createPlayer`. **UI owns the shop panel** drawing + navigation (§8.1).
13. **§8 Zone lore card**: engine triggers overlay `'lore'` once per zone (`save.loreSeen`,
    `T.loreDelay` 90 f after the zone toast), sets `game.loreCard = zone`; **UI draws it** and closes
    it after 240 f or any key (§8.1). **Control hints**: engine sets `save.hints.*` on first use;
    UI shows the strip until set.
14. **§8 Frozen frames**: on every early return of a play tick (overlay, transition, hitstop, and the
    tick a hit requests hitstop) the engine snapshots `px/py = x/y` for player, enemies, boss,
    projectiles, pickups, movers and `cam.px = cam.x`, so a frozen world never drifts with `alpha`.
15. **§9 debug**: `spawnEnemy(type, tx, ty, opts)`, `spawnBoss(bossId, {x, y, fight})`,
    `fx(type, x, y, opts)`, `buy(itemId)`, `skipTo('shop'|'lore')`; `state()` adds `nearVendor,
    prompt, projectiles, vendor, energyMax, loreSeen, hints`.
16. **§10 Save**: `readSave` validates every field's type and contents (arrays/objects/finite
    numbers; `cores ⊆` world core ids, `bossesDefeated ⊆` boss ids, `bitsCollected ⊆` placed-bit
    keys, `vendor ⊆` item ids, `discovered/visited ⊆` rooms, `nodesUsed ⊆` nodes, `loreSeen ⊆` zones,
    `fighter ∈` roster, room/node pair valid); any exception = no save. CONTINUE never throws.
17. Headers of `fx.js`, `render.js`, `ui.js`, `engine.js` cite the right sections; `UB.FX.draw(ctx)`.

## Changes since v2 (v3 — integration round; everything additive)

1. **§4.3 `UB.World.start` is `dc_wake` (3,12) / `node_dc_wake`** (the real world). The three `debug_*`
   rooms stay byte-identical and unreachable in play; engine-geometry tests `UB.debug.warp('debug_room', null)`
   after starting a game. `validate()` also rejects `walker` / `bossSegment` / `mote` spawns in real rooms.
   Corrosant's start tile is `(24, 3)` (rows 0–2 of `bv_corrosant` are solid), not the earlier suggestion `(24, 1)`.
2. **§4.7 Render is world-aware**: `UB.Render.buildBackground(zone)` returns `UB.World.background(zone)` and
   `redrawTiles` paints `UB.World.drawProps(level, …)` into the cache after the tiles (both functions carry
   `worldAware = true`, so world.js's hook installer steps aside); `redrawTiles` is a no-op before the cache
   exists. `loadRoom` builds the tile cache **before** sealing `boss.locked` exits.
3. **§5 `player.hurt(dmg, fromX, opts)`**: for registered enemy/boss hits the engine passes `opts = {hit}` (the
   descriptor, so a counter such as Korvask's Bulwark Catch reads `flags`/`src` exactly); contact damage still
   passes `null`; hazards `{hazard:true}`.
4. **§6.2 `boss.flying`**: a boss that sets it is not pulled down by the engine's idle gravity/collision during
   `bossFight` `none`/`intro` (fliers/crawlers also override `gravity`/`moveAndCollide` on the instance).
5. **§7 drops**: `rollDrops` never rolls hearts/orbs/shards for `type === 'mote'` or `e.noDrops` (DESIGN §9.2).
6. **§8 `game.dropProjectiles()`**: `loadRoom`/`toTitle` flag every dropped projectile `dead = true` before
   clearing the list (pooled player projectiles see it). `loadRoom` clears a pending lore card of the previous
   zone when the zone changes. `ABILITY_TEXT`/core/restore banner lines are the DESIGN §15.5 strings.
7. **§9 debug**: `warp(room, exitId)` derives the arrival `side` from the exit (a bottom exit gets the chute
   launch, a top exit the +120 px/s arrival, as in play) and cancels a running transition;
   `bench(n) → {frames, avgTick, avgRender, avgTotal, maxTick, maxTotal}` times n ticks + renders with
   `performance.now` (test-only; logic never reads the clock).
8. **Tests**: `test/playthrough.cjs` is the end-to-end proof (title → victory); `test/run-all.cjs` runs every
   suite sequentially (the timing checks need an idle machine).

## Changes since v3 (v4 — QA round 1; everything additive)

1. **§4.2 `UB.Input.clearBuffers()`** — drops every pending gameplay buffer + press edge; the engine calls it when an
   overlay opens or closes so a menu confirm (Z/J, Space, pad A, Up/W) never fires jump/light when play resumes.
2. **§4.3 `UB.World.background(zone, scale)`** paints the three layers at the canvas backing scale (only the two most
   recent zone/scale sets stay cached); **`UB.World.hideProp(level, tag)`** marks a tagged composite prop
   (`rw_throne` `'throne'` / `'canopy'`) hidden for the visit (`level.hiddenProps`) and returns its tile rect.
3. **§4.7 Render**: `UB.Render.setScale(s)` (the engine's `setDpr` calls it; every full-screen cache — parallax layers,
   fog hole, vignette — is rebuilt at that scale and blitted 1:1, so a DPR-2 frame costs the pixel count);
   `UB.Render.drawAmbient(ctx, zone, level, frame, camX, camY)` is the DESIGN §11.1.6 ambient layer, drawn between the
   background and the tiles. `setDpr` accepts fractional backing scales (main.js: `dpr × CSS upscale`, quantised to
   1 / 1.5 / 2, so a 1920×1080 window on a dpr-1 display renders at 1920×1080).
4. **§5 player**: `contactImmune` (set per frame by a special whose body is meant to collide with its victim —
   Brackmaw's dive + burst, Korvask's press + slam; cleared by `endMove/place/respawn`); `place()`/`respawn()` clear
   `jumpCutAvail` (a chute launch is not a jump); `pogo(game, victim)` lifts the body onto the victim's top; coyote /
   wall-coyote counters tick after the jump check (6 f / 5 f after the let-go frame); a special's press frame is its f1
   (the program's `tick` runs on the press frame).
5. **§7 contact**: the engine applies enemy/boss body contact only when `!pl.pogoActive && !pl.contactImmune`.
   `game.spawnProjectile` never lists the same object twice (a pooled projectile re-spawned before the end-of-tick
   sweep). Hitstop > 5 f on a landed hit or a hurt sets a 1-frame 2 % impact zoom (`game.impactZoom(x, y)`).
6. **§8 engine API**: `game.triggerHazard(kind, rx, ry)` (a module-owned hazard: the §3.3 freeze/respawn with
   (rx, ry) as the respawn — Corrosant's Flood), `game.hideProp(tag, quiet)` (hides the prop, repaints the cache, chips unless `quiet`; `loadRoom` hides the throne quietly in the cleared final arena),
   `game.roomSong()` / `game.playRoomMusic()` (the zone song, or none in a cleared final arena), `game.crushed(pl)`
   (a mover pressed the body into solid tiles → hazard `'crush'`). `game.hazardRespawn` is `{x, y, vy, iframes,
   pending}`: the arrival placement including a chute launch; after a chute arrival the first solid footing inside
   the room replaces it. `game.zoom {x, y, t}`.
7. **§8 boss flow**: `startBossDeath` pops every enemy-owned projectile, records the boss in `bossesDefeated` and
   writes the save; `loadRoom` re-spawns the ability module at `boss.pickup` when a recorded boss's ability is still
   missing (died during the reward, quit). `respawnAtNode` restarts the room music and the duck.
8. **§8 overlays**: `closeOverlay()` re-enters the base screen (`UI.enter(screen)`) when the last overlay closes
   (the title cursor is valid again after SETTINGS). `loadSettings` validates every key (type + range) like the save.
9. **§6.2 bosses**: `arenaOf` scans the six air rows above the spawn column's floor (fliers/crawlers get the full
   arena); enrage tell cuts floor at 20 f (`tellOf(b, n)`); Corrosant's Flood goes through `game.triggerHazard`
   (respawn on the nearest grate of the lowest grate row); Kernauth's phase change calls `game.hideProp('throne')`.
10. **§6.1 enemies**: a hopper only hops where its landing column has footing (an exit opening in the floor is a
    ledge); the engine drops an enemy that falls more than 128 px below the room (no drops, no purge count).
11. **§8.1 UI**: banner line 2 wraps to a second line when it is wider than 440 px at 12 px MONO; the map has a room
    cursor (arrows/d-pad, key-repeat; the view follows; Confirm/`R` recentre) with the §15.11 bestiary line in the
    footer; a SOLD shop row only denies; the select screen runs the §12.10 pose showcase
    (`UB.Characters.drawPreview(ctx, id, x, y, scale, t, showcase)`).
12. **World data**: `dc_sentinel` grates at row 12; `lw_rest`/`ns_rest` hatch grates in the floor line (row 15);
    `rw_gate` arrival grate at row 4; `lw_hoist` bottom-left bank is pool; `bv_catwalk` trough grate (row 31, x16–18);
    Rootwell variants placed in `rw_gate` (rootbound scuttlebit, rootwisp). DESIGN §6 blocks updated in step.

## Changes since v4 (v5 — QA round 2; everything additive)

1. **§7 hit descriptor `noKbx`** (default false): the victim's knockback is `(0, kby)` — set by the acid puddle shot
   (enemies.js) and Weftyr's stuck needle (bosses.js); `player.hurt` reads it from `opts.hit` (DESIGN §3.3).
2. **§5 player**: `canStartSpecial()` (energy for the special/ultimate cost + the program's `refuses(pl)` hook — Tessik's
   second Pulse Line); a light's hit-cancel into Special only fires when it would start, otherwise the press is the
   deny (sfx, bar flash, 10 f lockout) and the light runs on (DESIGN §3.7). A light/heavy pressed while clinging starts
   nothing and stays buffered (DESIGN §3.5). Orrubel's `sp.ringOut` follows `ring.dead` every frame, so an engine cull /
   eviction of the ring never locks the heavy.
3. **§6.1 droplatch**: `ignoreOneWay` only during CLIMB — the DROP lands on the first `#`/`-`/`c` below; the side-walk
   treats the room's edges as walls. **Corrosant segment proxies** forward the head multiplier when the hit box also
   reaches the head's box (DESIGN §8.3). **`bossHurtBy`** returns dmg 0 for a 0-damage hit (the Overclock shove).
4. **§6.2 bosses**: Kernauth's phase-1 ×1 zone is the 150×60 core band (DESIGN §8.4); Dive Bomb's shock is 120×30 and
   both shocks are registered on the landing frame; Weftyr's Snare Line lies at knee height (`A.floorY − 14`) and snaps on
   its first catch (`onHit: popSelf`), its Thread Dash snaps onto the telegraphed `lineY` as the pass begins; Tallock's
   Slab Swing is 70×40 sweeping its top edge from 90 to 40 px above the floor.
5. **§8 engine**: `game.tileOccupied(tx, ty)` — a vanished crumble tile returns only when no enemy/boss overlaps it
   (retried every 6 f); `render` paints a fade in flight UNDER an open overlay (pause/map during the hazard fade stays
   readable) and over everything otherwise.
6. **§8.1 UI**: `UI.tick` freezes the toast/banner/card timers while `game.screen === 'play' && game.overlay`;
   `drawScreen` draws the toast on every non-play screen and bottom toasts above an overlay (`drawHUD` draws the rest);
   `UI.hudAlpha` dims the hearts/energy/meter block to 0.35 while the fighter's body is behind it (DESIGN §12.1); the map
   footer's bestiary line wraps at a ` · ` into `UI.mapBestiary2` when wider than the free span; the title tagline is
   18 px MONO.
7. **World data (DESIGN §10.6 F8–F10)**: `ns_climb` shaft-1 doorway (x26–27, rows 67–69), slot doorway (x7–8, rows 24–26)
   + exit hole (x4–6, rows 16–17), shaft-3 floor hole (x42–43, rows 17–18); `dc_loft.B` chute at cols 5–7 (spawn (6,17));
   `bv_cistern` row-8 grate x46–51.

## 0. Ground rules (from `BRIEF.md`, non-negotiable)

* 100 % original content. No franchise names, designs, terms or lookalikes anywhere (code,
  comments, UI, docs). All proper nouns are invented words.
* Vanilla JS + Canvas 2D + Web Audio. No frameworks, CDNs, npm runtime deps, `fetch`/XHR,
  image/audio/font files. Must run from `file://` by double-clicking `index.html`.
* `'use strict'` in every file. The only global is `UB`. Every file is an IIFE
  `(function (UB) { ... })(window.UB);` that attaches one namespace (`UB.World`, `UB.FX` …).
* Fixed 60 Hz logic, accumulator driven by `main.js`. **Logic never reads wall-clock time**
  (`Date.now`, `performance.now`) — count frames. `Math.random` is not used by logic; use
  `UB.Util.rng(seed)` (the engine exposes `game.rng`). Presentation (particles) may use its own seeded rng.
* No per-frame allocations in `update()`/`draw()` hot paths where avoidable: pre-allocate
  hit descriptors, scratch boxes, shape structs, gradients and wrapped text; no array literals,
  closures or string concatenation inside per-entity loops.
* Edit only the file(s) you own. Never edit another owner's file; if you need an engine
  change, ask the engine architect (describe the hook you need).

## 1. Files, owners, load order

`index.html` loads, in this exact order (each later file may use everything before it):

| # | File | Owner | Namespace |
|---|---|---|---|
| 1 | `js/util.js` | ENGINE | `UB.Util`, `UB.Palette`, `UB.Fonts`, `UB.font()`, **`UB.IDS`** |
| 2 | `js/input.js` | ENGINE | `UB.Input` |
| 3 | `js/world.js` | **WORLD** | `UB.World` |
| 4 | `js/entities.js` | ENGINE | `UB.Entity` |
| 5 | `js/fx.js` | **UI/FX** (working minimal version provided) | `UB.FX` |
| 6 | `js/audio.js` | **AUDIO** (silent stub provided) | `UB.Audio` |
| 7 | `js/render.js` | ENGINE | `UB.Render` (backgrounds, tile cache, fog, movers, nodes, vendor figure, pickups) |
| 8 | `js/characters.js` | **CHARACTERS** (one placeholder fighter provided) | `UB.Characters` |
| 9 | `js/enemies.js` | **ENEMIES** (one placeholder walker provided) | `UB.Enemies` |
| 10 | `js/bosses.js` | **ENEMIES** (one placeholder boss provided) | `UB.Bosses` |
| 11 | `js/ui.js` | **UI/FX** (minimal functional version provided, incl. shop + lore overlays) | `UB.UI` |
| 12 | `js/engine.js` | ENGINE | `UB.Engine` (`Game`, `makeDebug`, `T` timings) |
| 13 | `js/main.js` | ENGINE | `UB.Main`, creates `UB.game`, `UB.debug`, runs `UB.World.validate()` |

Implementers may add private helpers inside their own file only. If a module needs a new
shared file, the engine architect adds it to this table and to `index.html`.

### 1.1 Pinned identifiers — `UB.IDS` (util.js)
Every string that two modules must agree on. Add, never rename.
```
UB.IDS.zones      = ['driftcache','loomworks','brinevault','nullspire','rootwell']
UB.IDS.songs      = ['title','driftcache','loomworks','brinevault','nullspire','rootwell','boss','victory']
UB.IDS.fighters   = ['tessik','brackmaw','vellix','orrubel','korvask']
UB.IDS.abilities  = ['echoJump','burstLine','gripProtocol']
UB.IDS.bosses     = ['tallock','weftyr','corrosant','kernauth']         // = UB.Bosses.DATA keys = room.boss.id = save.bossesDefeated
UB.IDS.bossRooms  = { dc_sentinel:'tallock', lw_weftyr:'weftyr', bv_corrosant:'corrosant', rw_throne:'kernauth' }
UB.IDS.bossAbility= { tallock:'echoJump', weftyr:'burstLine', corrosant:'gripProtocol', kernauth:null }
UB.IDS.pickups    = ['bit','heart','spark','shard','core','ability']
UB.IDS.enemies    = ['scuttlebit','hopnode','driftmoth','brinejelly','glarewisp','spitvalve','rambyte',
                     'platewalker','broodcell','mote','droplatch','voltwheel','walker']
UB.IDS.groundEnemies = ['scuttlebit','hopnode','rambyte','platewalker','broodcell','voltwheel','walker']  // validate() demands footing
UB.IDS.enemyVariants = ['brinecrab','staticshot','rootbound','dripnode','nullnode','rootwisp','acidvalve','twinvalve','rootram','rootplate']
UB.IDS.vendorItems= [{id:'spare_cell', name:'SPARE CELL', price:90,  effect:'Max energy 100 → 125'},
                     {id:'hot_clock',  name:'HOT CLOCK',  price:160, effect:'Overclock gains ×1.5 from hits and shards'},
                     {id:'deep_ping',  name:'DEEP PING',  price:120, effect:'Map shows every room, node and core of zones you have entered'}]
UB.IDS.sfx        = { name → 'characters'|'engine'|'enemies'|'ui' }   // see §4.6
```
`brinejelly` is placed by its own type name in DESIGN §6 (it is a driftmoth variant; `create('brinejelly')`
must work). Other variants are `{type:'hopnode', variant:'dripnode'}` etc. `mote` is only runtime-spawned by a
broodcell (never placed). `walker` and `proto_warden` are the debug placeholders and must keep existing.

## 2. Frame order

### 2.0 Loop (`main.js`)
`requestAnimationFrame` → accumulate elapsed ms (clamped to 100) → run `game.tick()` for
each whole 1/60 s (max 5 per frame; surplus dropped) → `game.render(alpha)` with
`alpha = accumulator / step` for position interpolation. `UB.debug.pauseLogic(true)` stops
ticking so tests call `UB.debug.step(n)` instead. At boot `main.js` runs `UB.World.validate()`
and `console.warn`s each error line.

### 2.1 Logic tick (`game.tick()`), in order
1. `UB.Input.freezeBuffers = (world hitstop active)`; `UB.Input.update()` — latches this frame's
   `down/pressed/released/buffer`; `UB.Audio.update()`; `game.frame++`; `UB.UI.tick(game)` (toast/banner timers); fades.
2. **Menus.** If `game.screen !== 'play'` or `game.overlay` is set: `UB.UI.update(game)` (menu input, unless `game.busy`), `UB.FX.update()`, snapshot (§8 *frozen frames*), return. The world is frozen.
3. **Play.** `pause` pressed → `openOverlay('pause')`; `map` pressed → `openOverlay('map')`; a pending zone lore card (`T.loreDelay` after the zone toast, mode normal) → `openOverlay('lore')` (each returns after the snapshot). `save.playTimeFrames++`.
4. Room transition in progress → `updateTransition()`, FX, snapshot, return (world frozen).
5. World hitstop active → decrement, `UB.FX.update()`, snapshot, return (particles/shake/UI still animate; nothing else moves; input buffers do not tick).
6. Store previous positions (`px, py`) of player, enemies, boss, projectiles, pickups; step moving platforms (`dx, dy` for this frame).
7. Mode handlers: hazard freeze / node use / boss intro / ability pickup sequence timers.
8. Node/vendor interaction (`▲ REST` / `▲ TRADE`, Up press) — runs **before** the player so Up at a node rests instead of jumping; the vendor opens the `shop` overlay (return after the snapshot). Control hints (`save.hints`) are recorded here.
9. `player.update(game)` — skipped only during the hazard freeze (`mode === 'hazard'`).
10. `enemy.update(game, player)` for every live enemy; `boss.update(game, player)` while `bossFight.state === 'fight'` (during `none`/`intro` the engine only applies gravity/collision to it; during `dying` it ticks `boss.t`); `projectile.update(game)` then off-room cull (64 px margin).
11. `resolveHits()` — every hit registered this frame (see §7). Then enemy/boss **contact** vs player, then **hazards** vs player. Dead enemies/projectiles are removed.
12. Pickups (`updatePickups`): physics, magnet, collection. Crumble tiles. Exit check (→ transition). Boss trigger.
13. Death bookkeeping (→ game over after the 60 f death animation).
14. `UB.FX.update()`; `updateCamera()`; if a hit requested hitstop this frame → snapshot (the freeze starts at the impact position).

### 2.2 Render (`game.render(alpha)`), in order
World canvas (960×540 logical, dpr-scaled): parallax background → static tile cache → dynamic
tiles (pool surfaces, shaking crumble) → moving platforms → restore nodes → vendor figure → pickups →
enemies → boss → **player** → projectiles (near the camera only) → `UB.FX.draw(ctx)` (world particles) →
[hitbox debug] → fog + vignette → pickup-sequence darkening. Then on the main canvas: letterbox fill →
world (or the transition composite: old-room snapshot sliding out, new room sliding in) → `UB.FX.drawScreen`
(flashes) → `UB.UI.drawHUD(ctx, game)` → `UB.UI.drawScreen(ctx, game)` (title/select/gameover/
victory and the pause/map/settings/shop/lore overlays) → fade rectangle → touch overlay.

Everything in the world layer is drawn with `ctx` translated by `(-camX, -camY)` (integers,
camera interpolated by `alpha`, shake added). HUD/screens are in screen space.

## 3. Coordinates, units, tiles

* Logical canvas **960×540**, origin top-left, **+y down**. Tile = **30 px**; a tile `(tx, ty)`
  covers `[tx·30, tx·30+30) × [ty·30, ty·30+30)`; row 0 is the top row of `room.tiles`.
* **Entity position `(x, y)` is the BOTTOM-CENTRE of its body box** (`w × h`). The box is
  `[x − w/2, x + w/2] × [y − h, y]`; `ent.box(out)` fills a top-left `{x,y,w,h}`; `ent.cx()`,
  `ent.cy()` give the box centre; `ent.top()/left()/right()`. "Feet on tile (tx, ty)" (the
  wording DESIGN.md uses for spawns) means `x = tx·30 + 15, y = (ty+1)·30` — `UB.World.tilePx(tx, ty)`.
* **Facing** is `+1` (right) or `−1`. Body-local attack boxes `[cx, cy, w, h]` are offsets from
  the body centre, `cx` along facing, `cy` down (`UB.Entity.hitBoxWorld`).
* **Velocity units** are per entity: `units: 'pxs'` (px/second — fighters) or `'pxf'`
  (px/frame — enemies, bosses, projectiles, pickups, movers). `ent.vmul` (1/60 or 1) converts
  to a per-frame displacement; `ent.gravity(g, maxFall)` takes `g` in the entity's own units.
  Knockback in hit descriptors is always **px/s** (the engine converts for px/frame victims).
  Fighters integrate gravity as a half step before and after the move (leapfrog) so the
  analytic apex `v²/2g` of DESIGN §4.1 holds exactly.
* All durations are logic frames at 60 Hz unless a name says seconds.

### 3.1 Tile legend (DESIGN §5.5) — `UB.World.LEGEND`
`#` solid · `-` one-way (solid from above only; Down+Jump drops through) · `c` crumble (solid
until stood on: 20 f shake, 180 f gone, 6 f return) · `^` floor spike (hazard, pogo-able) ·
`v` ceiling spike (hazard) · `~` pool (hazard) · `.` air · `B` decor prop (air).
Hazard boxes: `^` = tile inset 4 px each side, top 6 px below the tile top, 24 tall; `v` =
same hanging from the tile top; `~` = full tile. Hazards never block movement.

## 4. Module APIs

### 4.0 `UB.Palette`, `UB.Fonts`, `UB.font(px, 'UI'|'MONO', bold)` (util.js)
Global colours of DESIGN §11.1.2 (`INK, PAPER, PAPER_DIM, HEART, HEART_EMPTY, CORE_HEART,
ENERGY, ENERGY_DIM, METER, METER_READY, METER_DIM, BITS, DANGER, PANEL, PANEL_EDGE, SELECT,
LOGO_A, LOGO_B, LETTERBOX, SPIKE`). Zone palettes live in `UB.World.zones[id].palette`.
Never inline hex in draw code outside a rig's own palette data.

### 4.1 `UB.Util` (util.js)
`clamp(v,lo,hi) lerp(a,b,t) approach(v,target,step) sign(v)` · easing `easeOutCubic
easeInQuad easeOutQuad easeInOutQuad easeOutBack` · `rng(seed) → fn()` (mulberry32) ·
`hash(a,b,c,d) → uint32` · `jitter(seed, i, amp)` · `pick(rng, arr)` · `rand(rng, lo, hi)` ·
`aabb(ax,ay,aw,ah,bx,by,bw,bh)` (top-left boxes) · `dist` · `pad2(n)` · `fmtTime(frames) →
'HH:MM:SS'` · `wrapText(ctx, text, maxWidth) → lines[]` (allocates — cache the result, never call per frame) · `TAU`, `DEG`.

### 4.2 `UB.Input` (input.js) — DESIGN §2
* `ACTIONS = ['left','right','up','down','jump','light','heavy','special','dash','overclock','pause','map','confirm','back']`.
* `state[action] = {down, pressed, released, buffer}`; `pressed/released` are true for exactly one
  logic frame; `buffer` counts down from 6 for `jump, light, heavy, special, dash, overclock`
  and does not tick while `freezeBuffers` (hitstop). Gameplay code uses `state[a].buffer > 0`
  for buffered actions and must call `consume(action)` when it acts on one.
* `update()` — engine only, once per tick. `consume(action)`, `buffered(action)`, `clearBuffers()` (every gameplay
  buffer + press edge dropped; the engine calls it when an overlay opens/closes),
  `repeat(action)` (menu key-repeat 18 f then every 8 f), `press(action, frames)` (virtual hold —
  tests), `releaseAll()`, `bind(action, codes[])`, `resetBindings()`, `bindings`, `glyph(action)` (HUD
  key label), `device` (`'keyboard'|'gamepad'|'touch'`), `anyPressed` (any key/button edge this
  frame), `gestured` (first user gesture seen), `onGesture(fn)`, `touchVisible`, `drawTouch(ctx)`,
  `setViewport(left, top, w, h)` (main.js).
* `up` and `jump` share keys: interactions (node/vendor) consume both (`consume('jump')`).

### 4.3 `UB.World` (world.js) — WORLD owner. DESIGN §5, §6
```
UB.World.TILE = 30
UB.World.LEGEND                       // char → name
UB.World.zones[id] = { id, index (1–5), name ('DRIFTCACHE'), blurb (toast line 2), lore (card text, DESIGN §5.3),
                       song (UB.IDS.songs), poolKind ('acid'|'static'), debug?,
                       palette: { bg0,bg1,bg2,tileFill,tileShade,tileEdge,fog,glow,hazard,accent } }
UB.World.rooms[id] = RoomSpec
UB.World.start = { room, x, y, nodeId }   // NEW GAME: feet on tile (x, y+1); nodeId = first respawn point
UB.World.tileAt(room, tx, ty) → char ('#' outside)      // raw data; runtime state → UB.Entity.tileAt(level,…)
UB.World.isSolid/isOneWay/isCrumble/isSpike/isPool/isHazard/isProp(ch)
UB.World.exit(room, id) → exit | null
UB.World.tilePx(tx, ty, out?) → {x, y}                // bottom-centre for "feet on tile (tx,ty)"
UB.World.spawnPx(room, exitId|null, out?) → {x, y}     // exit spawn, else start, else first node, else first exit
UB.World.findNode(nodeId) → {room, node} | null
UB.World.zoneOf(room) → zone
UB.World.normalize()  // fills defaults (call after defining rooms);  UB.World.validate() → error strings[]
```
**RoomSpec** (all lists present, possibly empty — `normalize()` guarantees it):
```
{ id, zone, name, intro,                 // name/intro for the map + room header text
  w, h, tiles: [h strings of exactly w chars],
  gx, gy, gw, gh,                        // map grid position/size in screens (DESIGN §6 "map grid"); real rooms must not overlap
  start: {x, y} | undefined,             // only the new-game room
  exits:     [{ id, side:'left'|'right'|'top'|'bottom', x, y, w, h,   // opening rect in tiles (must be '.' tiles, ON the edge)
                to: {room, exit}, spawn: {x, y} /*arrival tile: feet on (x,y+1)*/, ability: null|'echoJump'|'burstLine'|'gripProtocol' }],
  spawns:    [{ type, x, y, patrol:[x0,x1]?, variant?, facing?, ...typeFields }],  // enemies; feet on (x,y+1); flyers centred on (x,y)
  platforms: [{ id, w /*tiles*/, from:{x,y}, to:{x,y} /*top-left tile*/, speed /*px/frame*/, wait /*frames*/ }],
  nodes:     [{ id, x, y }],              // restore node occupies tile (x,y), stands on (x,y+1); ids unique world-wide
  cores:     [{ id, x, y }],              // hidden core at tile (x,y); ids unique world-wide
  bits:      [{ x, y, size:'small'|'medium'|'large' }],   // placed bits (one-time; saved as 'roomId:x,y')
  vendor:    null | { x, y },             // Scrivvet stands on tile (x,y) (feet on (x,y+1)); dc_shrine + rw_rest (21,14)
  boss:      null | { id, bounds:[tx0, tx1], spawn:{x, y}, pickup:{x, y}, seal:[exitId…], locked:[exitId…], final?:bool },
  debug?:    true                         // excluded from counts/map; the three debug_* rooms must stay (tests use them)
}
```
`boss.id` is the pinned boss id for that arena (`UB.IDS.bossRooms`). `boss.spawn` is the boss's
**start tile** (feet on `(x, y+1)` for ground bosses; the centre tile for flyers/crawlers), inside
the fight bounds and an air tile: Tallock `(25, 14)` and Kernauth `(32, 20)` are pinned by
DESIGN §8.1/§8.4; Weftyr (flier, `(24, 8)`) and Corrosant (ceiling crawler, `(24, 3)` — rows 0–2 of its arena
are solid) are the WORLD implementer's choice. `boss.seal` = exits sealed for the fight; `boss.locked`
= exits sealed from room entry until the boss is beaten (`bv_corrosant.B`'s brine crust, DESIGN §10.2
#18). `pickup` is required unless `final`.

Exit trigger (engine): left/right — body centre x leaves the room while the body vertically
overlaps the opening rows; top — body top < −8 px while horizontally overlapping the opening
columns; bottom — body top > h·30. Arrival: feet on `spawn`; left/right keep `vx`; arriving
through a **top** exit sets `vy = +120 px/s`; through a **bottom** exit is the chute launch
(`vy = −1.2·jumpVel`, 20 i-frames, Echo Jump/air dash refreshed). Exits of a sealed boss room are
solid until the seal lifts. Beyond-the-map tiles are solid except in the extension of an exit opening.

**`UB.World.validate()`** returns an array of error strings (`[]` = OK). `main.js` runs it at boot and
`console.warn`s every line; `test/smoke.cjs` and the world test assert it is empty. It checks: zone
records (pinned ids, song, palette keys); tile rows/widths/chars; every exit (known side, opening on its
edge, 1-wide/1-tall, air tiles, spawn inside/air/footing for side exits, target room+exit exist, **reciprocity**
(`to.exit`'s own `to` points back), opposite sides, equal opening size, real rooms never link to debug rooms,
`ability` ∈ abilities); spawns (type ∈ `UB.IDS.enemies` for real rooms, `variant` ∈ `enemyVariants`, inside,
air, footing for `groundEnemies`, patrol brackets x); platforms (`from`/`to` inside, air); nodes/cores/bits/
vendor/start (inside, air, footing where something stands, unique ids, no duplicate bits); boss (string id,
pinned id and arena match, `final` matches the table, bounds inside, spawn inside/air/within bounds, pickup
inside/air/footing unless final, seal/locked ids exist; an arena without its boss); map-grid rectangle
overlaps between real rooms (touching edges are fine); `start` room/tile/node.

### 4.4 `UB.Entity` (entities.js)
```
new UB.Entity({x, y, w, h, units:'pxs'|'pxf', hp, kbResist, stepUp, bounce, collideTiles})
fields: x y w h px py vx vy facing units vmul onGround wasOnGround hitWall(-1|0|1) hitCeiling
        ground (platform we stand on | null) groundTy groundTx0 groundTx1 (tile row/cols under the feet)
        stepUp bounce bounces collideTiles noclip ignoreOneWay dropThrough(frames)
        hp maxHp dead flash iframes hitstun kbResist t (frames alive)
methods: box(out) cx() cy() left() right() top() gravity(g, maxFall) moveAndCollide(level)
UB.Entity.moveAndCollide(ent, level)   // integrate vx/vy (own units) + platform carry, resolve X then Y (≤10 px substeps),
                                       // step-up ≤ stepUp px (only when wasOnGround), one-way from above, movers from above
UB.Entity.sweep(ent, level, dx, dy)    // same with explicit pixel deltas
UB.Entity.tileAt(level, tx, ty)        // runtime tile char: vanished 'c' → '.', sealed exits → '#', outside → '#'/'.'
UB.Entity.solidAt(level, tx, ty)
UB.Entity.hazardAt(ent, level, skipFloorSpikes) → null|'spike'|'pool'   (details in UB.Entity.lastHazard {tx,ty,ch,kind})
UB.Entity.hazardInBox(level, x, y, w, h, skipFloorSpikes)
UB.Entity.hazardBox(tx, ty, ch, out)
UB.Entity.overlap(a, b)  overlapBox(ent, x, y, w, h)  overlapsSolid(level, x, y, w, h)
UB.Entity.makeHit(owner) → hit descriptor (§7)      UB.Entity.hitBoxWorld(ent, cx, cy, w, h, out)
UB.Entity.applyHit(victim, hit) → {dmg, killed, blocked}   // default damage: hp, flash 4, hitstun 10+hitstop & knockback × kbResist (kbResist 0 = flash only)
```
Landing sets `vy = 0` (or bounces: `vy = −vy·bounce` when `bounce > 0`); a ceiling sets `vy = 0`.
Entities with `ignoreOneWay` (flyers, projectiles) pass through `-` and movers. Hazards and pools never block.
**Step-up** (`stepUp` 6 px for fighters) can never trigger on tile-aligned geometry — a grounded body's
feet sit on a tile top, so any blocking tile in the feet row is ≥ 30 px tall relative to the feet. It only
helps when standing on a moving platform within 6 px of a tile top. Level design must not rely on it.

**Level runtime** (`game.level`, built by the engine on room load — read-only for modules):
```
{ room, w, h, zone, gone: Uint8Array(w*h) /*1 = crumble tile vanished*/, sealedMask: Uint8Array(w*h),
  openings:[{id, side, x, y, w, h, sealed}], platforms:[{id, x, y /*top-left px*/, w, h:8, px, py, dx, dy, …}],
  crumble:[{tx, ty, state:1 shaking|2 gone|3 returning, timer}], tileCache, cacheScale,
  boss /* the active boss spec: room.boss, or the one UB.debug.spawnBoss synthesized */ }
```

### 4.5 `UB.FX` (fx.js) — UI/FX owner. DESIGN §11.3.3–11.3.6
```
UB.FX.init()  clear()  update()  draw(ctx /*world space, already translated*/)  drawScreen(ctx /*screen space*/)
UB.FX.spawn(kind, x, y, {vx, vy, life, size, size2, color, grav, drag}) → index   // kinds: spark ring chip dust glitter dot aura
UB.FX.burst(kind, x, y, n, {color, dir, radius, life})   // presets: spark chip dust glitter ring pogo heal aura
UB.FX.text(str, x, y, color, frames)                     // floating text ('+1')
UB.FX.shake(mag, frames)   UB.FX.shakeX / shakeY         // decaying random offset; overlapping keeps the larger mag·remaining
UB.FX.hitstop(frames)      UB.FX.hitstopFrames           // world hitstop request (max, never stacks); the engine decrements
UB.FX.flash(color, alpha, frames)                        // full-screen tint
UB.FX.setShakeEnabled(bool)  UB.FX.count()
```
Pool of 512 particles in typed arrays; `dust`/`aura` are recycled first when full. The UI/FX
implementer may redesign the drawing and add kinds/presets but must keep every name above.

### 4.6 `UB.Audio` (audio.js) — AUDIO owner. DESIGN §13
```
UB.Audio.init()            // first user gesture (the engine wires UB.Input.onGesture → init); idempotent; resumes
UB.Audio.resume()
UB.Audio.sfx(name, x?)     // = play(name, x); recipe names of DESIGN §13.8; x = world x for panning (optional)
                           // UNKNOWN NAMES ARE A SILENT NO-OP (never throw, never warn)
UB.Audio.loop(name, on)    // looping voice ('wallSlide'): on=true starts it if not running, false stops it; idempotent; unknown = no-op
UB.Audio.stopLoops()       // engine calls it on room load, menus/overlays and title
UB.Audio.music(trackId)    // UB.IDS.songs: 'title'|'driftcache'|'loomworks'|'brinevault'|'nullspire'|'rootwell'|'boss'|'victory'|null; crossfades
UB.Audio.stopMusic()
UB.Audio.ambient(zoneId)   stopAmbient()
UB.Audio.setVolumes({master, music, sfx})   // 0–10 integers (DESIGN §14.2)
UB.Audio.duck(mult, seconds)                 // music bus multiplier: 1 play, 0.4 pause/menus, 0 game-over fade
UB.Audio.mute() unmute()  update() /*once per logic frame*/  state() → {ctxState, voices, song, step, bpm, ambient, loops}
```
Every method must be safe with no AudioContext (headless tests never gesture). Nothing may throw.
**Who triggers which SFX** (`UB.IDS.sfx`; DESIGN §13.8 recipes):

| Owner | Names |
|---|---|
| CHARACTERS (player) | `jump doubleJump land step dash wallSlide (loop) special ultimate pogo hurt death overclockOn overclockEnd overclockWarn deny` |
| ENGINE | `lightHit heavyHit whiff spike enemyHit enemyDeath pickupBit energy heal core restore save ability bossRoar bossHit bossDeath roomTransition crumble platformMove` |
| ENEMIES (enemies + bosses) | `bolt turretShot bossPhase` (+ `heavyHit`/`lightHit` for their own slams if wanted) |
| UI | `menuMove menuConfirm menuBack heartbeat vendorBuy` (+ `restore` on the game-over confirm, `deny` on a failed purchase) |

`wallSlide`: the player calls `UB.Audio.loop('wallSlide', true)` every frame it slides and
`loop('wallSlide', false)` when it stops (calling `false` every non-sliding frame is fine).

### 4.7 `UB.Render` (render.js) — ENGINE
`rrect(ctx,x,y,w,h,r)` `makeCanvas(w,h)` · `setScale(s)` (backing scale; rebuilds the scale-bound caches) ·
`buildBackground(zone)` / `drawBackground(ctx, zone, camX, camY)` · `drawAmbient(ctx, zone, level, frame, camX, camY)`
(DESIGN §11.1.6, ≤ 60 primitives, stateless) · `buildTileCache(level, dpr)` / `redrawTiles(level, tx0,ty0,tx1,ty1)` /
`drawTileCache(ctx, level, camX, camY)` / `drawDynamicTiles(ctx, level, frame, camX, camY)` ·
`drawPlatform(ctx, p, zone, alpha)` `drawNode(ctx, x, y, zone, used, t, pulse)`
`drawVendor(ctx, x, y, zone, t, lookX)` (Scrivvet at feet x,y; eye tracks `lookX`) ·
`drawPickup(ctx, p, t, alpha)` · `drawFog(ctx, zone, px, py, isBoss)` (fog hole pre-rendered per zone) `drawVignette(ctx)`.
Character/enemy/boss/UI code never draws tiles; it may use `rrect`/`makeCanvas`.

## 5. `UB.Characters` (characters.js) — CHARACTERS owner. DESIGN §3, §4

```
UB.Characters.DATA = { id → fighter spec (DESIGN §4.4) }      UB.Characters.list = [specs in roster order]
UB.Characters.create(id, game) → player        // unknown id → first fighter
UB.Characters.drawPreview(ctx, id, x, y, scale, t)   // idle rig for the select screen (x,y = feet)
UB.Characters.RULES                             // DESIGN §3.12 numbers (optional export)
```
**The player object** extends `UB.Entity` (`units:'pxs'`, `stepUp: 6`) and must expose:

| Field | Meaning (engine reads/writes as noted) |
|---|---|
| `id, name, data` | fighter id / display name / spec |
| `hp, maxHp, baseHp` | hearts; engine sets `maxHp = baseHp + cores` on load, `maxHp++`/`hp++` on a core |
| `abilities` | **the same object as `game.save.abilities`** (`{echoJump, burstLine, gripProtocol}`); the engine assigns it; read it live, never copy |
| `energy, energyMax, meter, meterMax` | engine adds via `game.addEnergy/addMeter`; **the engine sets `energyMax` (100, or 125 with Spare Cell) on load and on purchase — never reset it in `respawn()`/`place()`** |
| `overclock` (frames left), `ocActive`, `ocTransform` (frames) | Overclock state; `addMeter` is ignored while active/transforming |
| `state` | string for debug/HUD: `idle run jump fall attack air down dash cling hurt dead overclock` |
| `locked` | engine sets true = ignore all input (boss intro, pickup sequence, transition settle); physics still runs |
| `dead, deathTimer` | set by `die()`; `deathTimer` counts up in `update`; engine shows game over at 60 |
| `iframes, hurtTimer, flash` | i-frames (60 after a hit; engine sets 45 after a hazard respawn, 20 chute; a boss phase change sets 180) |
| `pogoActive` | true on active down-strike frames and the pogo tick (engine then ignores floor-spike contact and enemy/boss body contact) |
| `contactImmune` | set per frame by a special whose body is meant to collide with its victim (Brackmaw's dive + burst, Korvask's press + slam): the engine skips enemy/boss body contact; cleared by `endMove`/`place`/`respawn` |
| `facing, onGround, clinging, wallDir` | camera uses `facing`/`clinging`/`wallDir` |

**Hooks the engine calls:**
* `update(game)` — every logic frame in play except the hazard freeze. Reads `UB.Input.state`
  (unless `locked`), moves with `this.moveAndCollide(game.level)`, registers attacks with
  `game.registerHit(hit)` on every active frame (one pre-allocated descriptor per move; set
  `hit.hitList.length = 0` when the move starts; see §7), applies its own gravity/timers/regen.
* `draw(ctx, game, alpha)` — world space; interpolate with `lerp(px, x, alpha)`; skip on i-frame blink frames.
* `hurt(dmg, fromX, opts) → bool` — called by the engine for enemy attacks, contact, projectiles
  (`opts` null) and hazards (`{hazard:true}`: ignore i-frames, no knockback/hurt state, hp only).
  Returns true if hp dropped. Applies the DESIGN §3.2 hurt state, knockback
  `(240·away, −300)·weight` (×0.5 in Overclock), 60 i-frames, FX (hitstop 6, shake 5/10, red flash),
  `UB.Audio.sfx('hurt')`, and calls `die()` at 0.
* `die()` — death animation start (engine handles game over/deaths stat).
* `respawn(x, y, {hp, energy, meter, iframes, vx, vy})` — full reset at a node/new game (keeps `energyMax`).
* `place(x, y, {vx, vy, iframes, airJumps})` — move without resetting hp/energy/meter/Overclock
  (room arrival, hazard respawn, debug teleport); cancels moves/dash/cling.
* `heal(n)`, `cancelMove()`, `attacking() → bool`.

Shared-kit behaviour the player owns (DESIGN §3): run/accel/friction, variable jump (cut ×0.45),
coyote 6, buffers via `UB.Input`, Echo Jump (`abilities.echoJump`, `djMult`), Burst Line
(`abilities.burstLine`, dist/frames, `vy = 0`, 18 f cooldown, stops at walls), Grip Protocol
(`abilities.gripProtocol`: cling on `#` only, wall jump, `wallSlide` loop), Down+Jump drop-through
(`this.dropThrough = 10`), light chain/heavy/air/down-strike with the per-move data, pogo
(`vy = −580`, refreshed air jump/dash; on enemies via `hit.onHit`, on `^` via
`UB.Entity.hazardInBox` on the down-strike box), specials/ultimates (`special`/`ultimate` sfx;
player-owned projectiles via `game.spawnProjectile`, §7), energy regen, Overclock activation/duration/
revert (`overclockWarn` on the last-3-s blinks), hurt/death. The engine owns: damage application to
enemies, pickups, hazards' freeze/respawn, death→game over, saves, camera, transitions, boss sequencing,
vendor effects, control hints. Player attacks on `kbResist 0` victims still flash/hitstop. Overclock
damage = `floor(d·1.5)` and hitstop +1 are applied by the player when filling the descriptor.

## 6. `UB.Enemies` / `UB.Bosses` (enemies.js, bosses.js) — ENEMIES owner. DESIGN §7, §8

### 6.1 Enemies
```
UB.Enemies.TYPES = { type → data }                            // every UB.IDS.enemies id, incl. 'walker' (debug placeholder: hp 6, contact 1, bits 2, speed 1, honours patrol)
UB.Enemies.create(type, spawn, room, game) → enemy | null   // null = unknown type (engine warns once, skips); spawn.variant selects a DESIGN §7 variant
```
Enemy = `UB.Entity` (`units:'pxf'`) with: `type, name, hp, maxHp, contact` (hearts of contact
damage; `noContact: true` disables), `bits` (drop count, DESIGN §9.2), `dropShard` (guaranteed shard),
`kbResist`, `accent` (chip colour), `state` (string), `flash`, `hitstun` (engine sets `10+hitstop`
via `applyHit` when `kbResist > 0`; the enemy must not move/act while `hitstun > 0` and should
decrement it), `dead`. Hooks: `update(game, player)` (not during hitstop/menus/transition),
`draw(ctx, game, alpha)`, optional `takeHit(hit, game) → {dmg, killed, blocked}` (shields; must
set `this.dead` when hp ≤ 0), optional `onDeath(game)` (pop motes etc.). Enemy attacks:
`game.registerHit(hit)` with `hit.owner = 'enemy'`; shots: `game.spawnProjectile(obj)` (§7 projectile
contract: a `UB.Entity` with `owner:'enemy'`). Motes and other runtime spawns:
`game.spawnEnemy(type, tx, ty, opts) → enemy|null` (pushes into `game.enemies`; the broodcell keeps its
own count of living motes). Enemies ignore hazards and each other; walkers turn at patrol bounds,
walls (`hitWall`) and ledges. Enemies respawn on every room entry (the engine re-creates them from
`room.spawns`). SFX owned here: `bolt` / `turretShot` (shots), `bossPhase` (bosses).

### 6.2 Bosses
```
UB.Bosses.DATA = { bossId → {name, subtitle, hp, ability, bits, sparks, deathFrames, final, …} }   // keys: UB.IDS.bosses + 'proto_warden' (keep it)
UB.Bosses.create(bossId, room, game, spec) → boss | null     // spec = the arena's boss record (room.boss, or synthesized by UB.debug.spawnBoss)
UB.Bosses.rewardFor(bossId) → {ability, bits, sparks, final}
```
The boss **starts at `spec.spawn`** (feet on `(x, y+1)`; flyers may treat it as their centre tile) and
drops its module at `spec.pickup` — never hard-code arena coordinates. `spec === game.level.boss`.
Boss = `UB.Entity` (`units:'pxf'`, `kbResist: 0`) with `id` (= bossId), `name, subtitle, hp, maxHp, phase,
state, attack` (HUD/debug), `contact`, `active` (engine sets true when the fight starts),
`final` (true → `game.victory()` after death instead of a module), `deathFrames`, `accent`.
Hooks: `onIntro(game)` (seal dropped, 150 f card starts), `onFightStart(game)`,
`update(game, player)` (fight only), `draw(ctx, game, alpha)` (every frame, also idle/dying — use
`this.t` which the engine resets to 0 at death), optional `takeHit`, and **`onDefeated(game)`**:
called once after the death animation; must spawn rewards with `game.spawnPickup('bit', …,
{size:'large', permanent:true})`, `spawnPickup('spark', …, {permanent:true})` and, unless `final`,
`spawnPickup('ability', px, py, {ability, bossId, glow})` at `spec.pickup`. The engine does:
seal `spec.locked` on room entry while the boss lives, trigger when the player's tile x enters
`spec.bounds`, seal `spec.seal`, 150 f title card + `UB.Audio.music('boss')`, HP bar, boss contact
damage, death FX (hitstop 10, shake 12/40, burst), the 120 f pickup sequence, `grantAbility`, unseal
(`seal` + `locked`), `bossesDefeated`, save, zone music.

**Enrage / multi-phase rule (Kernauth, DESIGN §8.4).** The engine calls `startBossDeath()` the moment a
hit leaves `boss.hp <= 0` during the fight, and `UB.Entity.applyHit` sets `dead = true` at 0. A boss with
another phase therefore **handles the phase change inside `takeHit(hit, game)` before returning**:
apply the damage itself (or call `applyHit` and then reset `this.dead = false`), and when phase 1 is
spent set `this.phase = 2`, refill `this.hp`/`this.maxHp` to the phase-2 values, start its own transition
timer (its `update` runs the 180 f transition while `bossFight.state` stays `'fight'`), set
`this.contact = 0` for the transition, give the player `game.player.iframes = 180`, and may call
`UB.UI.bossCard('KERNAUTH', 'UNBOUND', 60)`, `UB.Audio.sfx('bossPhase')`, `UB.FX.shake/burst`
directly. Return `{dmg, killed:false, blocked:false}`. The HP bar follows `hp/maxHp` and takes the
phase-2 colours when `phase >= 2`. The engine only ends the fight when `takeHit` returns with
`hp <= 0` and the boss has no further phase. Enrage (one-off roar, invulnerability) is likewise the
boss's own: return `blocked:true` while invulnerable.

## 7. Hits (`UB.Entity.makeHit`, `game.registerHit`)

```
hit = { owner:'player'|'enemy'|'boss', x, y, w, h /*world top-left box*/, dmg, kbx, kby /*px/s*/, facing,
        hitstop, hitList:[], multi:false, noKbx:false /*victim knockback straight up — puddles, stuck needles (DESIGN §3.3)*/,
        src, tag, kind:'light'|'heavy'|'special'|'ultimate'|'air'|'down'|'projectile'|'contact',
        energy, meter /*player gains on connect*/, flags /*1 unblockable, 2 projectile*/, shake, shakeFrames, onHit(victim, result, game) }
```
Body contact (enemy `contact` / boss `contact`) is skipped while `player.pogoActive` or `player.contactImmune`.
Rules: register on every active frame; the engine resolves after all updates. A victim already
in `hitList` is skipped unless `multi` (multi-tick moves such as beams and floor hazards). **`multi`
hits never grow `hitList`** — they may connect every frame, so their victims' own i-frames (player:
60) or the attacker's cadence must pace the damage. Player hits test enemies, the boss and
destructible **enemy-owned** projectiles; enemy/boss hits test the player (`player.hurt`, i-frames
respected, `game.god` ignored) **only while `game.mode === 'normal'`** (never at a node, during a
boss intro, the pickup sequence, a hazard freeze or a transition). On connect the engine applies
damage (`takeHit` or `applyHit`), world hitstop (`max`), sparks/ring/shake per `kind`, SFX,
`addEnergy(hit.energy)`, `addMeter(hit.meter)`, then `hit.onHit`. Kills: hitstop +2, 12 chips in
`enemy.accent`, shake 2/4, drops (§9.2 via `game.rng`), `save.enemiesPurged++`. Contact damage is
separate (body overlap, `enemy.contact`). `MAX 64` hits per frame.

**Projectiles** (`game.spawnProjectile(obj) → obj|null`): `obj` must be a `UB.Entity` instance with
`owner: 'player'|'enemy'` (missing → `'enemy'`), `update(game)`, `draw(ctx, game, alpha)`, `dead`,
optional `destructible: true` (+ `onPopped(game)`), and it registers its own hits (`hit.owner` =
its owner; player-owned ones use `kind:'projectile'`, `flags |= 2`). The engine never pops a
player-owned projectile with the player's attacks. Cap **64** live projectiles (the oldest is
evicted); projectiles further than 64 px outside the room are culled; only those near the camera
are drawn. Popping an enemy projectile gives +2 meter and 4 sparks.

## 8. `UB.Engine` / the `game` object (engine.js) — what modules may call

| Member | Use |
|---|---|
| `game.screen` `'title'|'select'|'play'|'gameover'|'victory'`; `game.overlay` `null|'pause'|'map'|'settings'|'shop'|'lore'`; `game.mode` `'normal'|'transition'|'hazard'|'nodeUse'|'bossIntro'|'pickupSeq'|'dying'`; `game.busy` | state (read) |
| `game.frame`, `game.screenT`, `game.fps` | counters |
| `game.save` (DESIGN §14 object), `game.settings` (§14.2), `game.hasSave()`, `game.saveSummary()`, `game.writeSave()`, `game.resetSave()`, `game.setSetting(key, value)` | save/settings |
| `game.level`, `game.zone`, `game.player`, `game.enemies[]`, `game.boss`, `game.projectiles[]`, `game.pickups[]`, `game.cam {x,y,px,py}`, `game.hazardRespawn`, `game.bossFight {state,timer}`, `game.nearNode`, `game.nearVendor`, `game.prompt` (`null` or `{text:'REST'|'TRADE', x, y}`), `game.denyFlash`, `game.loreCard` (zone shown by the `lore` overlay) | world (read) |
| `game.registerHit(hit)` · `game.spawnProjectile(obj)` · `game.spawnEnemy(type, tx, ty, opts)` · `game.spawnPickup(type, x, y, opts)` (`bit heart spark shard core ability`; opts `{size, placed, key, id, ability, bossId, glow, permanent, vx, vy}`) · `game.addBits(n)` `addEnergy(n)` `addMeter(n, fromHit)` · `game.grantAbility(id, on)` · `game.rng()` · `game.triggerHazard(kind, rx, ry)` (module-owned hazard → the §3.3 freeze + respawn at (rx, ry); false unless alive, mode normal, god off) · `game.hideProp(tag, quiet)` (hide a tagged composite prop for the visit) · `game.impactZoom(x, y)` | gameplay |
| `game.buy(itemId) → 'bought'|'poor'|'sold'|'unknown'` · `game.hasDeepPing()` · `game.applyDeepPing()` · `UB.Engine.Game.VENDOR` (= `UB.IDS.vendorItems`) | vendor (UI) |
| `game.toSelect()` `toTitle()` `newGame(fighterId)` `continueGame()` `openOverlay(name)` `closeOverlay()` `respawnAtNode()` `victory()` `victoryStats()` | flow (UI) |
| `game.loadRoom(roomId, arrival)` `startTransition(exit)` `defeat flow…` `snapInterp()` | engine-internal; use `UB.debug` in tests |
| `UB.Engine.T` | pinned timings (transition 6/18/4, hazard 30+10/45, boss intro 150, pickup 120, crumble 20/180/6, loreDelay 90, shopBanner 150, …) |

The engine saves at: node use, boss ability pickup (f120), core pickup, **vendor purchase**, victory.

**Vendor flow (engine side).** Standing within 1 tile of `room.vendor` shows `▲ TRADE`
(`game.prompt.text === 'TRADE'`, `game.nearVendor`); Up opens `'shop'` (world frozen, music ducked).
The UI panel calls `game.buy(id)`: `'bought'` deducts the price, appends to `save.vendor`, applies the
effect (Spare Cell → `player.energyMax = 125`; Hot Clock → `addMeter(n, fromHit)` ×1.5 rounded up;
Deep Ping → `applyDeepPing()` marks every real room of every zone with a visited room as discovered,
also on each later room entry), writes the save and queues the `{ITEM} PURCHASED` / effect banner,
shown by the engine when the panel closes. Purchases are one-time; `createPlayer` re-applies them on load.

**Zone lore card.** On the first entry to a zone whose `lore` is non-empty and whose id is not in
`save.loreSeen`, the engine waits `T.loreDelay` (90 f, mode normal) after the zone toast, records the
zone in `loreSeen`, clears the toast, sets `game.loreCard = zone` and opens overlay `'lore'`.
The UI draws it and calls `closeOverlay()` after 240 f or any key.

**Control hints.** While in normal play the engine sets `save.hints.move/jump/light/heavy/special`
on the first press of that action, `hints.dash` on the first dash once Burst Line is owned, and
`hints.overclock` on the first Overclock. The UI shows the strip (DESIGN §12.8) during the first 3
rooms for every hint still false.

**Frozen frames.** Whenever a play tick returns early (overlay opened, transition, hitstop) and at the
end of a tick in which a hit requested hitstop, the engine snapshots `px/py = x/y` for the player,
enemies, boss, projectiles, pickups and movers and `cam.px/py = cam.x/y`. Renderers may therefore
always `lerp(px, x, alpha)`; a frozen world draws at its final position whatever `alpha` is.

### 8.1 `UB.UI` (ui.js) — UI/FX owner. DESIGN §12
```
UB.UI.init(game)   UB.UI.enter(name, game)   // engine calls enter() when screen/overlay changes (reset selection)
UB.UI.update(game)                           // MENU input only; called when screen != 'play' or an overlay is open (not while game.busy)
UB.UI.tick(game)                             // timers; every logic frame
UB.UI.drawHUD(ctx, game)   UB.UI.drawScreen(ctx, game)
UB.UI.toast(line1, line2, frames)  UB.UI.banner(l1, l2, l3, frames)  UB.UI.bossCard(name, subtitle, frames)  UB.UI.clearMessages()
UB.UI.text(ctx, str, x, y, font, color, align, baseline, inkWidth)   UB.UI.panel(ctx, x, y, w, h)
```
Screens the UI must handle in `update`/`drawScreen`: `title` (NEW GAME / CONTINUE / SETTINGS →
`game.toSelect() / continueGame() / openOverlay('settings')`), `select` (→ `game.newGame(id)`,
back → `toTitle()`), overlays `pause` (RESUME `closeOverlay()`, MAP `openOverlay('map')`, SETTINGS,
QUIT `toTitle()`), `map` (Deep Ping: `game.hasDeepPing()` → draw every discovered room's node and a `?`
on rooms with an uncollected core), `settings` (`setSetting`), **`shop`** (DESIGN §12.17: Scrivvet's
line from §15.9, bits, the three `UB.IDS.vendorItems` rows with price / `SOLD`, Up/Down select,
Confirm → `game.buy(id)` → `'bought'`: `vendorBuy` sfx; `'poor'`/`'sold'`: `deny` + the can't-afford
line 90 f; Back/Pause → `closeOverlay()`), **`lore`** (DESIGN §12.18: `game.loreCard` zone name, lore
paragraph word-wrapped once and cached, `Press any key` after 60 f; `closeOverlay()` after 240 f or
`UB.Input.anyPressed`), `gameover` (→ `respawnAtNode()`), `victory` (→ `toTitle()`). The engine opens
pause/map/shop/lore from play; the UI closes them.
HUD data: `player.hp/maxHp/baseHp/energy/energyMax/meter/meterMax/ocActive/overclock`,
`save.bits`, `game.boss` + `game.bossFight.state`, `game.prompt` (`▲ REST` / `▲ TRADE`), `game.denyFlash`,
the control-hint strip from `save.hints` (first 3 rooms), the low-HP vignette + `heartbeat` sfx (in `tick`,
one per 36 f pulse at 1 heart). Gradients, the vignette canvas, wrapped bios/lore and the hint string are
cached — `drawHUD`/`drawScreen` allocate nothing per frame.

## 9. `window.UB.debug` (engine.js → main.js) — DESIGN §16.9

```
state() → {screen (overlay or screen), baseScreen, overlay, mode, busy, roomId, zoneId, fighter, x, y, vx, vy, hp, maxHp,
           energy, energyMax, meter, abilities, cores, bits, vendor, bossesDefeated, loreSeen, hints, overclock, grounded, playerState,
           dead, locked, iframes, frame, deaths, playTimeFrames, enemies, pickups, projectiles, boss, bossFight, hazardFreeze,
           transition, fade, hitstop, god, logicPaused, nearNode, nearVendor, prompt, hasSave, savedRoom}
warp(roomId, exitId | {x,y} | null)   /* exitId: arrival side derived from the exit (chute launch / top arrival as in play) */
teleport(x, y)   grant(abilityId, on=true)
setHp(n) setMaxHp(n) setEnergy(n) setMeter(n) addBits(n) setBits(n)
defeatBoss(bossId)   killEnemies()   god(on) / godmode(on)
spawnEnemy(type, tx, ty, opts) → {type,x,y,hp,state}|null     // places an enemy in the current room (feet tile; opts = spawn fields)
spawnBoss(bossId, {x, y, fight}) → boss()|null                // creates the boss here; default: live fight at once; fight:true runs seal→intro→fight;
                                                              // rooms without a boss record get a synthesized spec (bounds = room, no seals)
fx(type, x, y, opts) → particle count                         // burst preset ('spark' 'chip' 'dust' 'glitter' 'ring' 'pogo' 'heal' 'aura', opts {n,color,dir,radius,life})
                                                              // or 'shake' {mag,frames} | 'flash' {color,alpha,frames} | 'hitstop' {frames} | 'text' {str,color,frames}
buy(itemId) → 'bought'|'poor'|'sold'|'unknown'
step(n) / frame()   pauseLogic(on)   pressed(action, frames)   bench(n) → {frames, avgTick, avgRender, avgTotal, maxTick, maxTotal}
newGame(fighterId) / startGame(fighterId)   continueGame()   toTitle()
skipTo('title'|'select'|'play'|'pause'|'map'|'settings'|'shop'|'lore'|'gameover'|'victory')
save() load() reset()   audio() mute()   rooms() enemies() pickups() boss()   showHitboxes(on)   worldErrors()
```
Tests: `pauseLogic(true)` then `step(n)`; `pressed(action, n)` holds a virtual key. Nothing here runs unless called.

## 10. Save (`localStorage['underbyte.save']`) and settings — DESIGN §14 verbatim
The engine owns both. Modules read `game.save.*` (vendor UI reads `save.vendor`, `save.bits`; map reads
`discovered/visited/cores`; HUD reads `hints`). Write only through `game.writeSave()` at the §16.6 triggers.
**Loading** (`readSave`) validates every field: wrong types fall back to the fresh value; `cores` keeps
only world core ids (max 4), `bossesDefeated` only boss ids, `bitsCollected` only placed-bit keys,
`vendor` only item ids, `discovered`/`visited` only room ids, `nodesUsed` only node ids, `loreSeen`
only zone ids, `abilities`/`hints` only booleans, numbers must be finite and ≥ 0; an unknown fighter
→ the first fighter; an unknown room or a node not in that room → the start room/node. Any exception
= no save. `maxHearts = baseHearts + cores.length` and `hearts = maxHearts` are recomputed on load.

## 11. Checklist for every implementer
1. Keep every exported name/signature in your section; add, never remove. Key on `UB.IDS` strings.
2. Run `node underbyte/test/smoke.cjs` before handing off — it must stay green and print no console
   errors; `UB.World.validate()` must return `[]` (boot prints `[UB world] …` warnings otherwise).
3. Use `UB.Palette`/zone palettes, `UB.font`, ink outlines (DESIGN §11.0); keep drawing inside
   `ctx.save()/restore()` pairs; never leave `globalAlpha`/`globalCompositeOperation` changed.
4. Frame counters, not timers. `game.rng()` for gameplay randomness. No per-frame allocations.
5. Originality: invented names only, no franchise lookalikes (BRIEF rule 1).
6. Testing without the other modules: `UB.debug.spawnEnemy` / `spawnBoss` / `fx` / `buy` work in the
   three debug rooms; the world test is `UB.debug.worldErrors()`.
