# UNDERBYTE — Module Contract (`CONTRACT.md`)

This is the binding interface between the engine core and the five module implementers.
`DESIGN.md` says *what* the game is (every number lives there); this file says *how the
code fits together*. If the two disagree about an API, this file wins; if they disagree
about a gameplay number, `DESIGN.md` wins. The skeleton in `js/` already implements
everything described here and `test/smoke.cjs` proves it (`node underbyte/test/smoke.cjs`).

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
  hit descriptors, scratch boxes, shape structs; no array literals, closures or string
  concatenation inside per-entity loops.
* Edit only the file(s) you own. Never edit another owner's file; if you need an engine
  change, ask the engine architect (describe the hook you need).

## 1. Files, owners, load order

`index.html` loads, in this exact order (each later file may use everything before it):

| # | File | Owner | Namespace |
|---|---|---|---|
| 1 | `js/util.js` | ENGINE | `UB.Util`, `UB.Palette`, `UB.Fonts`, `UB.font()` |
| 2 | `js/input.js` | ENGINE | `UB.Input` |
| 3 | `js/world.js` | **WORLD** | `UB.World` |
| 4 | `js/entities.js` | ENGINE | `UB.Entity` |
| 5 | `js/fx.js` | **UI/FX** (working minimal version provided) | `UB.FX` |
| 6 | `js/audio.js` | **AUDIO** (silent stub provided) | `UB.Audio` |
| 7 | `js/render.js` | ENGINE | `UB.Render` (backgrounds, tile cache, fog, movers, nodes, pickups) |
| 8 | `js/characters.js` | **CHARACTERS** (one placeholder fighter provided) | `UB.Characters` |
| 9 | `js/enemies.js` | **ENEMIES** (one placeholder walker provided) | `UB.Enemies` |
| 10 | `js/bosses.js` | **ENEMIES** (one placeholder boss provided) | `UB.Bosses` |
| 11 | `js/ui.js` | **UI/FX** (minimal functional version provided) | `UB.UI` |
| 12 | `js/engine.js` | ENGINE | `UB.Engine` (`Game`, `makeDebug`, `T` timings) |
| 13 | `js/main.js` | ENGINE | `UB.Main`, creates `UB.game`, `UB.debug` |

Implementers may add private helpers inside their own file only. If a module needs a new
shared file, the engine architect adds it to this table and to `index.html`.

## 2. Frame order

### 2.0 Loop (`main.js`)
`requestAnimationFrame` → accumulate elapsed ms (clamped to 100) → run `game.tick()` for
each whole 1/60 s (max 5 per frame; surplus dropped) → `game.render(alpha)` with
`alpha = accumulator / step` for position interpolation. `UB.debug.pauseLogic(true)` stops
ticking so tests call `UB.debug.step(n)` instead.

### 2.1 Logic tick (`game.tick()`), in order
1. `UB.Input.freezeBuffers = (world hitstop active)`; `UB.Input.update()` — latches this frame's
   `down/pressed/released/buffer`; `UB.Audio.update()`; `game.frame++`; `UB.UI.tick(game)` (toast/banner timers); fades.
2. **Menus.** If `game.screen !== 'play'` or `game.overlay` is set: `UB.UI.update(game)` (menu input, unless `game.busy`), `UB.FX.update()`, return. The world is frozen.
3. **Play.** `pause` pressed → `openOverlay('pause')`; `map` pressed → `openOverlay('map')` (return). `save.playTimeFrames++`.
4. Room transition in progress → `updateTransition()`, FX, return (world frozen).
5. World hitstop active → decrement, `UB.FX.update()`, return (particles/shake/UI still animate; nothing else moves; input buffers do not tick).
6. Store previous positions (`px, py`) of player, enemies, boss, projectiles, pickups; step moving platforms (`dx, dy` for this frame).
7. Mode handlers: hazard freeze / node use / boss intro / ability pickup sequence timers.
8. `player.update(game)` — skipped only during the hazard freeze (`mode === 'hazard'`).
9. `enemy.update(game, player)` for every live enemy; `boss.update(game, player)` while `bossFight.state === 'fight'` (during `none`/`intro` the engine only applies gravity/collision to it; during `dying` it ticks `boss.t`); `projectile.update(game)`.
10. `resolveHits()` — every hit registered this frame (see §7). Then enemy/boss **contact** vs player, then **hazards** vs player. Dead enemies/projectiles are removed.
11. Pickups (`updatePickups`): physics, magnet, collection. Crumble tiles. Node/vendor interaction. Exit check (→ transition). Boss trigger.
12. Death bookkeeping (→ game over after the 60 f death animation).
13. `UB.FX.update()`; `updateCamera()`.

### 2.2 Render (`game.render(alpha)`), in order
World canvas (960×540 logical, dpr-scaled): parallax background → static tile cache → dynamic
tiles (pool surfaces, shaking crumble) → moving platforms → restore nodes → pickups → enemies →
boss → **player** → projectiles → `UB.FX.draw(ctx)` (world particles) → [hitbox debug] → fog +
vignette → pickup-sequence darkening. Then on the main canvas: letterbox fill → world (or the
transition composite: old-room snapshot sliding out, new room sliding in) → `UB.FX.drawScreen`
(flashes) → `UB.UI.drawHUD(ctx, game)` → `UB.UI.drawScreen(ctx, game)` (title/select/gameover/
victory and the pause/map/settings overlays) → fade rectangle → touch overlay.

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
'HH:MM:SS'` · `wrapText(ctx, text, maxWidth) → lines[]` (allocates) · `TAU`, `DEG`.

### 4.2 `UB.Input` (input.js) — DESIGN §2
* `ACTIONS = ['left','right','up','down','jump','light','heavy','special','dash','overclock','pause','map','confirm','back']`.
* `state[action] = {down, pressed, released, buffer}`; `pressed/released` are true for exactly one
  logic frame; `buffer` counts down from 6 for `jump, light, heavy, special, dash, overclock`
  and does not tick while `freezeBuffers` (hitstop). Gameplay code uses `state[a].buffer > 0`
  for buffered actions and must call `consume(action)` when it acts on one.
* `update()` — engine only, once per tick. `consume(action)`, `buffered(action)`,
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
UB.World.zones[id] = { id, index (1–5), name ('DRIFTCACHE'), blurb (toast line 2), lore (card text),
                       song (UB.Audio track id), poolKind ('acid'|'static'), debug?,
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
  gx, gy, gw, gh,                        // map grid position/size in screens (DESIGN §6 "map grid")
  start: {x, y} | undefined,             // only the new-game room
  exits:     [{ id, side:'left'|'right'|'top'|'bottom', x, y, w, h,   // opening rect in tiles (must be '.' tiles)
                to: {room, exit}, spawn: {x, y} /*arrival tile: feet on (x,y+1)*/, ability: null|'echoJump'|'burstLine'|'gripProtocol' }],
  spawns:    [{ type, x, y, patrol:[x0,x1]?, variant?, ...typeFields }],  // enemies; feet on (x,y+1); flyers centred on (x,y)
  platforms: [{ id, w /*tiles*/, from:{x,y}, to:{x,y} /*top-left tile*/, speed /*px/frame*/, wait /*frames*/ }],
  nodes:     [{ id, x, y }],              // restore node occupies tile (x,y), stands on (x,y+1)
  cores:     [{ id, x, y }],              // hidden core at tile (x,y)
  bits:      [{ x, y, size:'small'|'medium'|'large' }],   // placed bits (one-time; saved as 'roomId:x,y')
  vendor:    null | { x, y },
  boss:      null | { id, bounds:[tx0, tx1], pickup:{x, y}, seal:[exitId…], final?:bool },
  debug?:    true                         // excluded from counts/map; the three debug_* rooms must stay (tests use them)
}
```
Exit trigger (engine): left/right — body centre x leaves the room while the body vertically
overlaps the opening rows; top — body top < −8 px while horizontally overlapping the opening
columns; bottom — body top > h·30. Arrival: feet on `spawn`; left/right keep `vx`; arriving
through a **top** exit sets `vy = +120 px/s`; through a **bottom** exit is the chute launch
(`vy = −1.2·jumpVel`, 20 i-frames, Echo Jump/air dash refreshed). Exits of a sealed boss room are
solid until the seal lifts. Beyond-the-map tiles are solid except in the extension of an exit opening.

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

**Level runtime** (`game.level`, built by the engine on room load — read-only for modules):
```
{ room, w, h, zone, gone: Uint8Array(w*h) /*1 = crumble tile vanished*/, sealedMask: Uint8Array(w*h),
  openings:[{id, side, x, y, w, h, sealed}], platforms:[{id, x, y /*top-left px*/, w, h:8, px, py, dx, dy, …}],
  crumble:[{tx, ty, state:1 shaking|2 gone|3 returning, timer}], tileCache, cacheScale }
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
UB.Audio.music(trackId)    // 'title'|'driftcache'|'loomworks'|'brinevault'|'nullspire'|'rootwell'|'boss'|'victory'|null; crossfades
UB.Audio.stopMusic()
UB.Audio.ambient(zoneId)   stopAmbient()
UB.Audio.setVolumes({master, music, sfx})   // 0–10 integers (DESIGN §14.2)
UB.Audio.duck(mult, seconds)                 // music bus multiplier: 1 play, 0.4 pause/menus, 0 game-over fade
UB.Audio.mute() unmute()  update() /*once per logic frame*/  state() → {ctxState, voices, song, step, bpm}
```
Every method must be safe with no AudioContext (headless tests never gesture). Nothing may throw.
The engine already calls: `jump doubleJump land step dash lightHit heavyHit enemyHit enemyDeath
whiff pogo hurt death spike pickupBit energy heal core restore save overclockOn overclockEnd
deny menuMove menuConfirm menuBack ability bossRoar bossHit bossDeath roomTransition crumble special`.

### 4.7 `UB.Render` (render.js) — ENGINE
`rrect(ctx,x,y,w,h,r)` `makeCanvas(w,h)` · `buildBackground(zone)` / `drawBackground(ctx, zone,
camX, camY)` · `buildTileCache(level, dpr)` / `redrawTiles(level, tx0,ty0,tx1,ty1)` /
`drawTileCache(ctx, level, camX, camY)` / `drawDynamicTiles(ctx, level, frame, camX, camY)` ·
`drawPlatform(ctx, p, zone, alpha)` `drawNode(ctx, x, y, zone, used, t, pulse)`
`drawPickup(ctx, p, t, alpha)` · `drawFog(ctx, zone, px, py, isBoss)` `drawVignette(ctx)`.
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
| `energy, energyMax, meter, meterMax` | engine adds via `game.addEnergy/addMeter`; vendor raises `energyMax` |
| `overclock` (frames left), `ocActive`, `ocTransform` (frames) | Overclock state; `addMeter` is ignored while active/transforming |
| `state` | string for debug/HUD: `idle run jump fall attack air down dash cling hurt dead overclock` |
| `locked` | engine sets true = ignore all input (boss intro, pickup sequence, transition settle); physics still runs |
| `dead, deathTimer` | set by `die()`; `deathTimer` counts up in `update`; engine shows game over at 60 |
| `iframes, hurtTimer, flash` | i-frames (60 after a hit; engine sets 45 after a hazard respawn, 20 chute) |
| `pogoActive` | true on active down-strike frames (engine then ignores floor-spike contact) |
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
* `respawn(x, y, {hp, energy, meter, iframes, vx, vy})` — full reset at a node/new game.
* `place(x, y, {vx, vy, iframes, airJumps})` — move without resetting hp/energy/meter/Overclock
  (room arrival, hazard respawn, debug teleport); cancels moves/dash/cling.
* `heal(n)`, `cancelMove()`, `attacking() → bool`.

Shared-kit behaviour the player owns (DESIGN §3): run/accel/friction, variable jump (cut ×0.45),
coyote 6, buffers via `UB.Input`, Echo Jump (`abilities.echoJump`, `djMult`), Burst Line
(`abilities.burstLine`, dist/frames, `vy = 0`, 18 f cooldown, stops at walls), Grip Protocol
(`abilities.gripProtocol`: cling on `#` only, wall jump), Down+Jump drop-through
(`this.dropThrough = 10`), light chain/heavy/air/down-strike with the per-move data, pogo
(`vy = −580`, refreshed air jump/dash; on enemies via `hit.onHit`, on `^` via
`UB.Entity.hazardInBox` on the down-strike box), energy regen, Overclock activation/duration/
revert, hurt/death. The engine owns: damage application to enemies, pickups, hazards'
freeze/respawn, death→game over, saves, camera, transitions, boss sequencing.
Player attacks on `kbResist 0` victims still flash/hitstop. Overclock damage = `floor(d·1.5)`
and hitstop +1 are applied by the player when filling the descriptor.

## 6. `UB.Enemies` / `UB.Bosses` (enemies.js, bosses.js) — ENEMIES owner. DESIGN §7, §8

### 6.1 Enemies
```
UB.Enemies.TYPES = { type → data }
UB.Enemies.create(type, spawn, room, game) → enemy | null   // null = unknown type (engine warns once, skips)
```
Enemy = `UB.Entity` (`units:'pxf'`) with: `type, name, hp, maxHp, contact` (hearts of contact
damage; `noContact: true` disables), `bits` (drop count, DESIGN §9.2), `dropShard` (guaranteed shard),
`kbResist`, `accent` (chip colour), `state` (string), `flash`, `hitstun` (engine sets `10+hitstop`
via `applyHit` when `kbResist > 0`; the enemy must not move/act while `hitstun > 0` and should
decrement it), `dead`. Hooks: `update(game, player)` (not during hitstop/menus/transition),
`draw(ctx, game, alpha)`, optional `takeHit(hit, game) → {dmg, killed, blocked}` (shields; must
set `this.dead` when hp ≤ 0), optional `onDeath(game)` (spawn motes etc.). Enemy attacks:
`game.registerHit(hit)` with `hit.owner = 'enemy'`; shots: `game.spawnProjectile(obj)` where
`obj` is an entity with `update(game)`, `draw(ctx, game, alpha)`, `dead`, optional
`destructible: true` (+ `onPopped(game)`), and registers its own hits. Enemies ignore hazards and
each other; walkers turn at patrol bounds, walls (`hitWall`) and ledges. Enemies respawn on
every room entry (the engine re-creates them from `room.spawns`).

### 6.2 Bosses
```
UB.Bosses.DATA = { bossId → {name, subtitle, hp, ability, bits, sparks, deathFrames, final, …} }
UB.Bosses.create(bossId, room, game) → boss | null
UB.Bosses.rewardFor(bossId) → {ability, bits, sparks, final}
```
Boss = `UB.Entity` (`units:'pxf'`, `kbResist: 0`) with `id, name, subtitle, hp, maxHp, phase,
state, attack` (HUD/debug), `contact`, `active` (engine sets true when the fight starts),
`final` (true → `game.victory()` after death instead of a module), `deathFrames`, `accent`.
Hooks: `onIntro(game)` (seal dropped, 150 f card starts), `onFightStart(game)`,
`update(game, player)` (fight only), `draw(ctx, game, alpha)` (every frame, also idle/dying — use
`this.t` which the engine resets to 0 at death), optional `takeHit`, and **`onDefeated(game)`**:
called once after the death animation; must spawn rewards with `game.spawnPickup('bit', …,
{size:'large', permanent:true})`, `spawnPickup('spark', …, {permanent:true})` and, unless `final`,
`spawnPickup('ability', px, py, {ability, bossId, glow})` at `room.boss.pickup`. The engine does:
trigger when the player's tile x enters `room.boss.bounds`, seal `room.boss.seal`, 150 f title
card + `UB.Audio.music('boss')`, HP bar, boss contact damage, death FX (hitstop 10, shake 12/40,
burst), the 120 f pickup sequence, `grantAbility`, unseal, `bossesDefeated`, save, zone music.
Enrage/phase changes are the boss's own (`this.phase = 2` flips the HP bar colours).

## 7. Hits (`UB.Entity.makeHit`, `game.registerHit`)

```
hit = { owner:'player'|'enemy'|'boss', x, y, w, h /*world top-left box*/, dmg, kbx, kby /*px/s*/, facing,
        hitstop, hitList:[], multi:false, src, tag, kind:'light'|'heavy'|'special'|'ultimate'|'air'|'down'|'projectile'|'contact',
        energy, meter /*player gains on connect*/, flags /*1 unblockable, 2 projectile*/, shake, shakeFrames, onHit(victim, result, game) }
```
Rules: register on every active frame; the engine resolves after all updates. A victim already
in `hitList` is skipped unless `multi` (multi-tick moves). Player hits test enemies, the boss and
destructible projectiles; enemy/boss hits test the player (`player.hurt`, i-frames respected,
`game.god` ignored). On connect the engine applies damage (`takeHit` or `applyHit`), world hitstop
(`max`), sparks/ring/shake per `kind`, SFX, `addEnergy(hit.energy)`, `addMeter(hit.meter)`, then
`hit.onHit`. Kills: hitstop +2, 12 chips in `enemy.accent`, shake 2/4, drops (§9.2 via
`game.rng`), `save.enemiesPurged++`. Contact damage is separate (body overlap, `enemy.contact`).
`MAX 64` hits per frame.

## 8. `UB.Engine` / the `game` object (engine.js) — what modules may call

| Member | Use |
|---|---|
| `game.screen` `'title'|'select'|'play'|'gameover'|'victory'`; `game.overlay` `null|'pause'|'map'|'settings'`; `game.mode` `'normal'|'transition'|'hazard'|'nodeUse'|'bossIntro'|'pickupSeq'|'dying'`; `game.busy` | state (read) |
| `game.frame`, `game.screenT`, `game.fps` | counters |
| `game.save` (DESIGN §14 object), `game.settings` (§14.2), `game.hasSave()`, `game.saveSummary()`, `game.writeSave()`, `game.resetSave()`, `game.setSetting(key, value)` | save/settings |
| `game.level`, `game.zone`, `game.player`, `game.enemies[]`, `game.boss`, `game.projectiles[]`, `game.pickups[]`, `game.cam {x,y,px,py}`, `game.hazardRespawn`, `game.bossFight {state,timer}`, `game.nearNode`, `game.prompt {text,x,y}`, `game.denyFlash` | world (read) |
| `game.registerHit(hit)` · `game.spawnProjectile(obj)` · `game.spawnPickup(type, x, y, opts)` (`bit heart spark shard core ability`; opts `{size, placed, key, id, ability, bossId, glow, permanent, vx, vy}`) · `game.addBits(n)` `addEnergy(n)` `addMeter(n, fromHit)` · `game.grantAbility(id, on)` · `game.rng()` | gameplay |
| `game.toSelect()` `toTitle()` `newGame(fighterId)` `continueGame()` `openOverlay(name)` `closeOverlay()` `respawnAtNode()` `victory()` `victoryStats()` | flow (UI) |
| `game.loadRoom(roomId, arrival)` `startTransition(exit)` `defeat flow…` | engine-internal; use `UB.debug` in tests |
| `UB.Engine.T` | pinned timings (transition 6/18/4, hazard 30+10/45, boss intro 150, pickup 120, crumble 20/180/6, …) |

The engine saves at: node use, boss ability pickup (f120), core pickup, victory (and vendor purchase once implemented).

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
QUIT `toTitle()`), `map`, `settings` (`setSetting`), `gameover` (→ `respawnAtNode()`), `victory` (→
`toTitle()`). The engine opens pause/map from play on `pause`/`map` presses; the UI closes them.
HUD data: `player.hp/maxHp/baseHp/energy/energyMax/meter/meterMax/ocActive/overclock`,
`save.bits`, `game.boss` + `game.bossFight.state`, `game.prompt`, `game.denyFlash`.

## 9. `window.UB.debug` (engine.js → main.js) — DESIGN §16.9

```
state() → {screen (overlay or screen), baseScreen, overlay, mode, busy, roomId, zoneId, fighter, x, y, vx, vy, hp, maxHp,
           energy, meter, abilities, cores, bits, bossesDefeated, overclock, grounded, playerState, dead, locked, iframes,
           frame, deaths, playTimeFrames, enemies, pickups, boss, bossFight, hazardFreeze, transition, fade, hitstop,
           god, logicPaused, nearNode, hasSave, savedRoom}
warp(roomId, exitId | {x,y} | null)   teleport(x, y)   grant(abilityId, on=true)
setHp(n) setMaxHp(n) setEnergy(n) setMeter(n) addBits(n) setBits(n)
defeatBoss(bossId)   killEnemies()   god(on) / godmode(on)
step(n) / frame()   pauseLogic(on)   pressed(action, frames)
newGame(fighterId) / startGame(fighterId)   continueGame()   toTitle()   skipTo('title'|'select'|'play'|'pause'|'map'|'settings'|'gameover'|'victory')
save() load() reset()   audio() mute()   rooms() enemies() pickups() boss()   showHitboxes(on)   worldErrors()
```
Tests: `pauseLogic(true)` then `step(n)`; `pressed(action, n)` holds a virtual key. Nothing here runs unless called.

## 10. Save (`localStorage['underbyte.save']`) and settings — DESIGN §14 verbatim
The engine owns both. Modules read `game.save.*` (vendor reads/writes `save.vendor`,
`save.bits`; map reads `discovered/visited`; HUD reads `hints`). Write only through
`game.writeSave()` at the §16.6 triggers.

## 11. Checklist for every implementer
1. Keep every exported name/signature in your section; add, never remove.
2. Run `node underbyte/test/smoke.cjs` before handing off — it must stay green and print no console errors.
3. Use `UB.Palette`/zone palettes, `UB.font`, ink outlines (DESIGN §11.0); keep drawing inside
   `ctx.save()/restore()` pairs; never leave `globalAlpha`/`globalCompositeOperation` changed.
4. Frame counters, not timers. `game.rng()` for gameplay randomness.
5. Originality: invented names only, no franchise lookalikes (BRIEF rule 1).
