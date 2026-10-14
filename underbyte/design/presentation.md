# UNDERBYTE — Presentation, Feel, Audio, UI & Controls

Status: canonical for everything visual, audible and input-related. Implementers copy every
number here verbatim into `UB.Render`, `UB.Draw`, `UB.Camera`, `UB.FX`, `UB.HUD`,
`UB.Screens`, `UB.Input`, `UB.Audio`, `UB.Save` and `UB.Text`. Where this doc and
`design/combat.md` both state a number (hitstop, shake, particle counts, Overclock timing,
squash/stretch), they agree; if they ever disagree, `combat.md` wins for gameplay timing and
this doc wins for how it looks and sounds. All content is original.

Cross-references: fighter ids and palettes come from `combat.md` §2 (`tessik`, `brackmaw`,
`vellix`, `orrubel`, `korvask`). Zone and boss ids below are proposed; the world doc owns the
final names and may rename the display strings in `UB.Text` without touching any layout.

---

## 0. Conventions

* Logical canvas **960×540**, origin top-left, `+y` down. Tile = **30 px** → 32×18 tiles fill
  one screen. All HUD coordinates below are in logical pixels.
* 60 Hz logic; render every `requestAnimationFrame` with `alpha = accumulator / (1/60)` for
  interpolation of player/enemy/camera positions only (particles and UI are rendered at their
  last logic state).
* Every colour is a string constant in `UB.Palette`; never inline hex in draw code.
* Fonts (system only, declared once in `UB.Fonts`):
  * `UB.Fonts.UI = '"Trebuchet MS", "Segoe UI", Arial, Helvetica, sans-serif'` — bold sans.
  * `UB.Fonts.MONO = '"Consolas", "Menlo", "DejaVu Sans Mono", "Courier New", monospace'`.
  * Sizes are given as `bold 28px UI`, `18px MONO` etc. Always set `ctx.textBaseline` explicitly
    (`'alphabetic'` for body text, `'middle'` for centred labels).
* Outline rule: every drawn body (tile edges, characters, enemies, pickups, HUD panels) gets a
  stroke in `UB.Palette.INK = '#141018'` at `lineWidth 3`, `lineJoin 'round'`, `lineCap 'round'`.
  Thin detail lines use `lineWidth 2`, hairlines `1`.
* The canvas element has `image-rendering: auto` (we draw vector shapes, not pixels). The
  canvas is scaled with CSS to fit the window keeping 16:9, letterboxed in `#0A080C`, and
  `ctx.setTransform(scale,0,0,scale,0,0)` is NOT used — the canvas stays 960×540 logical and
  CSS does the scaling. `devicePixelRatio` > 1: set `canvas.width = 960*dpr`,
  `canvas.height = 540*dpr`, `ctx.scale(dpr,dpr)` once, keep CSS size at the fitted size.
  Offscreen caches use the same dpr.

---

## 1. Art direction

### 1.1 Look

"Ink and lantern": thick dark outlines, flat fills with one shade step, soft coloured glow
for anything powered, and a limited palette per zone. No gradients inside bodies except glow
halos. Shapes are slightly irregular (hand-drawn): every static outline is drawn with a
per-vertex jitter of ±1 px seeded by the vertex index (stable across frames). Nothing is ever
anti-aliased off; we rely on the browser's path rasteriser.

### 1.2 Global palette (`UB.Palette`)

| Key | Hex | Use |
|---|---|---|
| `INK` | `#141018` | all outlines, text shadows |
| `PAPER` | `#F2EBDD` | menu text, HUD foreground |
| `PAPER_DIM` | `#A89F90` | secondary text |
| `HEART` | `#E8484F` | hearts fill |
| `HEART_EMPTY` | `#4A2A2E` | empty heart fill |
| `CORE_HEART` | `#F2B13C` | core (bonus) hearts fill |
| `ENERGY` | `#3FD3FF` | energy bar fill |
| `ENERGY_DIM` | `#174A5A` | energy bar trough |
| `METER` | `#B86BFF` | Overclock meter fill |
| `METER_READY` | `#FFFFFF` | ready pulse |
| `BITS` | `#8FE388` | bits icon/counter |
| `DANGER` | `#FF3B3B` | low-HP vignette, hurt tint |
| `PANEL` | `rgba(20,16,24,0.82)` | menu panel fill |
| `PANEL_EDGE` | `#F2EBDD` | menu panel stroke (lineWidth 3) |
| `SELECT` | `#FFD166` | menu highlight |
| `LOGO_A` | `#3FD3FF` | logo top gradient stop |
| `LOGO_B` | `#B86BFF` | logo bottom gradient stop |

### 1.3 Zone palettes

Each zone has exactly: `bg0` (far sky/void), `bg1` (far layer), `bg2` (mid layer), `tileFill`,
`tileShade` (hatching), `tileEdge` (rim light on top edges), `fog`, `glow` (powered details),
`hazard` (acid/static), `accent` (props). Ids `zone1..zone5`; display names in §8.

| Zone | Theme | bg0 | bg1 | bg2 | tileFill | tileShade | tileEdge | fog | glow | hazard | accent |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `zone1` Cache Shallows | cable-root caverns, dim blue-grey | `#0E1220` | `#161C30` | `#1F2742` | `#2C3350` | `#1C2238` | `#4A5A8A` | `rgba(60,80,140,0.18)` | `#6FD7FF` | `#2EE6A8` | `#8A6A3A` |
| `zone2` Spore Stacks | fungal shelves, drifting spores, teal-green | `#0A1614` | `#10231F` | `#17332C` | `#24473C` | `#162E26` | `#4F8F6A` | `rgba(60,140,100,0.16)` | `#9CFF8A` | `#C8FF3F` | `#D1A05A` |
| `zone3` Quartz Registry | crystal vaults, violet/pink | `#120A1C` | `#1D1030` | `#2B1846` | `#3A2460` | `#241540` | `#8A5CC8` | `rgba(140,90,200,0.16)` | `#FF7AD9` | `#FF4FA3` | `#E0C8FF` |
| `zone4` Coolant Pipeworks | rust pipes, steam, amber | `#160F0A` | `#241610` | `#352016` | `#4A2E1E` | `#2E1C12` | `#A6683A` | `rgba(200,120,60,0.14)` | `#FFB347` | `#FF6A2A` | `#7FA8B8` |
| `zone5` Root Deep | black static, red veins | `#07050A` | `#120810` | `#1C0C16` | `#2A1020` | `#180810` | `#7A2038` | `rgba(200,40,60,0.14)` | `#FF3B5C` | `#FF2A2A` | `#9AA0B0` |

Boss rooms use their zone palette with `fog` alpha doubled and `bg0` darkened 20 %.

### 1.4 Tiles

Tile types from the world doc map to drawing classes: `solid`, `platform` (one-way),
`spike`, `acid`, `static`, `crumble`, `mover` (drawn by the entity layer), `node`, `door`.

**Solid tiles** are drawn as merged regions, not individual squares:

1. **Fill pass.** For every solid tile draw `fillRect(x,y,30,30)` in `tileFill`. (Static layer.)
2. **Hatch pass.** For every solid tile, seeded RNG `rng = UB.Rand.seeded(roomId*7919 + tx*131 + ty)`:
   draw `2 + floor(rng()*3)` short strokes (`lineWidth 1`, `tileShade`, alpha 0.55), each
   from a random point inside the tile, length `6..12`, angle `-35° ± 10°`. Because the seed
   is `(room, tx, ty)` the hatching never flickers.
3. **Edge detection.** For each solid tile check its 4 neighbours. An edge is *exposed* if the
   neighbour is not `solid` (platforms, air, hazards all count as exposed). Build polylines:
   * Top exposed edges: stroke `tileEdge`, `lineWidth 2`, drawn 1 px below the outline (rim light).
   * All exposed edges: stroke `INK`, `lineWidth 3`, with the ±1 px vertex jitter seeded by
     `(roomId, tx, ty, side)`. Merge collinear consecutive edges into one `lineTo` run so a
     20-tile floor is one path, not 20.
   * Exposed outer corners get a small `arc` cap (radius 2) so the ink looks hand-joined.
4. **Pebble pass.** 1 in 6 exposed top edges (seeded) gets a 3–5 px ink pebble sitting on it.

**Platforms** (one-way): a rounded rect 30×8 at the tile top, fill `tileFill`, ink outline
3, a `tileEdge` rim 2 px, and 2 hatch strokes. Adjacent platform tiles merge into one bar.

**Spikes:** triangles base 15 wide, height 22, two per tile, fill `#C9C2B4`, ink outline 2,
tip highlight dot `PAPER`. Orientation from the world doc (up/down/left/right).

**Acid pool:** filled rect from tile top+8 to tile bottom in `hazard` at alpha 0.75; surface
is a sine wave (`amp 2`, `wavelength 24`, phase `t*2`) stroked `lineWidth 2` in a lighter
hazard (`hazard` + 25 % lightness via `UB.Color.lighten`); 1 bubble per 2 tiles rising every
40 f (dynamic layer). **Static pool:** same body in `glow` at alpha 0.5; instead of a wave,
3 jittering 2 px zigzag lines per tile re-randomised every 4 f (dynamic layer).

**Crumble tile:** solid tile with 3 ink crack lines (seeded) and a `tileEdge` dashed rim
(`setLineDash([4,3])`); when triggered it shakes ±2 px for 20 f, then the dynamic layer draws
4 falling fragments (quads 10×10) for 30 f and the static layer is marked dirty and redrawn
without it (see 1.8).

**Door/exit** tiles: no drawing — the room edge is open; the transition handles it.
**Restore node:** a 40 px tall obelisk on the tile: trapezoid base 24→16 wide, fill `accent`,
ink outline, a glow diamond 10×14 at its top that pulses alpha 0.6↔1.0 on a 1.5 s sine and
has `shadowBlur 18` in `glow`. Dormant (not yet used): glow alpha fixed 0.3, no blur.

### 1.5 Background layers (per zone, procedural, cached)

Three layers, each an offscreen canvas 1280×720 (room-independent, zone-dependent), tiled
horizontally with `drawImage` at parallax offsets. Scroll factors: `bg0` 0 (static), `bg1`
0.25, `bg2` 0.5 (relative to camera). Vertical parallax uses half the horizontal factor.

Build (`UB.Backgrounds.build(zoneId)`, seeded RNG `zoneIndex*1000 + layer`):

* **bg0 (far):** fill `bg0`; vertical gradient to `bg1` at the bottom 40 %; 40 "dust"
  dots (r 1–2, `PAPER` alpha 0.06–0.12) seeded.
* **bg1 (far silhouettes):** fill nothing (transparent); silhouettes in `bg1`:
  * zone1: 12 hanging cable curves (`bezierCurveTo`, `lineWidth 4–8`) from the top edge
    sagging 80–200 px, with 3–5 drip beads; 6 root-column rects 40–90 wide rising from the
    bottom with notched tops.
  * zone2: 14 fungal shelves (half-ellipses 60–160 wide) stacked up the sides; 5 tall
    stalks with 3-lobed caps.
  * zone3: 18 crystal spires (tall thin triangles 20–50 wide, 120–300 tall) from floor and
    ceiling (stalactites/stalagmites), a few tilted ±12°.
  * zone4: 10 horizontal pipes (rounded rects 24–40 tall) with elbow joints every 200–400 px
    and 6 vertical drops; 8 valve wheels (circles r 14 with 6 spokes).
  * zone5: 16 vein polylines (jagged, 6–10 segments) radiating from a centre point below the
    floor; 4 giant ribs (arcs r 300–500, `lineWidth 10`).
* **bg2 (mid):** silhouettes in `bg2` with `tileEdge` highlights, denser and smaller than bg1
  (same recipes at 0.5 scale, 1.5× count), plus zone props: zone1 lanterns (glow dots r 4
  with `shadowBlur 12`), zone2 spore clusters (5 dots), zone3 embedded crystal clusters (3
  triangles with a `glow` rim), zone4 steam vents (drawn as 3 translucent circles, static
  layer only; the live steam is particles), zone5 pulsing nodes (r 6, animated in the
  dynamic pass via a global sine, see 1.7).

Caches: `UB.Backgrounds.cache[zoneId] = {bg0,bg1,bg2}` built lazily on first entry to the
zone and kept for the session (5 zones × 3 × 1280×720 ≈ 55 MB at dpr 1 — acceptable; at dpr
≥ 2 build backgrounds at dpr 1 anyway and let `drawImage` upscale, it is a blurry backdrop by
design).

### 1.6 Ambient dynamic layer (per zone, cheap, not cached)

Drawn every frame between bg2 and the tile layer, budget ≤ 60 primitives:

| Zone | Ambient | Count | Motion |
|---|---|---|---|
| zone1 | drifting dust motes r 1.5 `PAPER` α 0.25 | 24 | vx −6..6, vy −10, wrap |
| zone2 | spores r 2–3 `glow` α 0.35 | 30 | sin drift ±12 px, vy −14, wrap |
| zone3 | glints: 4-point stars 6 px `accent` | 12 | fade in/out 90 f cycle at fixed points |
| zone4 | steam puffs r 8→24 `PAPER` α 0.18→0 | 10 | from vents, vy −30, life 70 f |
| zone5 | static flecks 2×2 `glow` α 0.5 | 40 | teleport every 3 f (seeded by frame) |

### 1.7 Fog, vignette, glow

* **Fog**: after the entity layer, `fillRect` the whole screen with `zone.fog`. Then a
  radial gradient centred on the player (r 120 → 520) from transparent to `fog` at 0.5×
  alpha — a soft lantern falloff. Boss rooms: no lantern falloff.
* **Vignette**: a cached 960×540 canvas with a radial gradient from transparent (r 300) to
  `rgba(0,0,0,0.55)` (r 640). Drawn last in-game (before HUD). Built once.
* **Glow budget**: `shadowBlur` is expensive. Rules: at most **12** `shadowBlur` draws per
  frame; restore nodes, pickups and powered eyes use `shadowBlur 10–18`; the player's glow
  element uses 14; enemies never use `shadowBlur` (use a translucent halo circle instead).
  `UB.Draw.glow(fn, color, blur)` wraps `save/shadowColor/shadowBlur/fn/restore` and counts
  calls; past 12 it draws without blur.

### 1.8 Performance plan (60 fps)

* **Static tile layer**: on room enter, allocate (or reuse) an offscreen canvas the size of
  the room in pixels (rooms are ≤ 4×3 screens = 3840×1620 max). Draw §1.4 passes once.
  Each frame: `drawImage(static, camX, camY, 960, 540, 0, 0, 960, 540)` — one call. Mark
  dirty when a crumble tile disappears; redraw only the 3×3 tile neighbourhood with
  `clearRect` + re-run the passes for those tiles.
* **Backgrounds**: per zone cache (§1.5). Draw = 3 `drawImage` calls (6 with wrap).
* **Entities**: drawn directly; cull anything whose AABB is > 80 px outside the camera.
* **Particles**: fixed pool of 512 structs in typed arrays (`Float32Array` x,y,vx,vy,life,
  maxLife,size; `Uint8Array` kind/color index). No allocation after boot.
* **Text**: HUD labels that change rarely (zone name, fighter name) are pre-rendered to tiny
  offscreen canvases; numbers are drawn live with `fillText` (monospace, so no reflow jitter).
* **Save/restore**: never more than 3 deep. Avoid `ctx.filter`, `globalCompositeOperation`
  other than `source-over` and `lighter` (used only for sparks and the Overclock aura).
* Allocation rule: no `new`, array literals, closures or string concatenation inside
  `update()`/`draw()` hot loops. Pre-size scratch arrays; use `UB.Pool`.

---

## 2. Character & enemy drawing method

### 2.1 Principle

Every fighter and enemy is a **rig**: a list of segments drawn from primitives (ellipses,
rounded rects, wedges, bezier limbs) in body-local space (body centre = (0,0), `+x` = facing,
`+y` = down, per `combat.md` §0). Drawing is two passes over the same shape list:

1. **Ink pass**: every shape stroked in `INK`, `lineWidth 3` (limbs `lineWidth 5` so the 2 px
   limb line gets a 1.5 px ink border on each side).
2. **Fill pass**: every shape filled in its colour; limbs re-stroked at their own width/colour.

Drawing ink first and fills second gives the "coloured over the ink" look and avoids
seams. Glow parts (eyes, cores) are drawn in a third pass with `lighter` compositing and
no ink.

### 2.2 Shared API (`UB.Draw`) — used by `UB.Characters`, `UB.Enemies`, `UB.Bosses`, `UB.HUD`

```
UB.Draw.begin(ctx, x, y, facing, scaleX, scaleY, rotDeg)   // save + translate(x,y) +
        // rotate(rot) + scale(facing*scaleX, scaleY). facing is +1/-1 (flip via scale(-1,1)).
UB.Draw.end(ctx)                                             // restore
UB.Draw.rig(ctx, shapes)        // runs ink pass then fill pass over an array of shape structs
UB.Draw.glowPass(ctx, shapes)   // 'lighter' pass for shapes flagged glow:true

// Shape structs (plain objects, pre-allocated per rig and mutated per frame — no allocs):
{k:'ellipse', x,y, rx,ry, rot, fill}
{k:'rrect',   x,y, w,h, r, fill}            // centred at x,y
{k:'poly',    pts:[x0,y0,x1,y1,...], fill}  // closed; vertex jitter optional (jit:1)
{k:'wedge',   x,y, len, wid, ang, fill}     // triangle pointing along ang (deg)
{k:'limb',    x0,y0, cx,cy, x1,y1, w, col}  // quadratic bezier limb, stroke w in col
{k:'line',    x0,y0, x1,y1, w, col}
{k:'arc',     x,y, r, a0,a1, w, col}        // stroke only
{k:'dot',     x,y, r, fill, glow:true}      // glow:true -> drawn in glowPass with halo r*2.5

// Helpers
UB.Draw.blob(ctx, x,y, rx,ry, fill)                  // ink+fill ellipse in one call (pickups, enemies)
UB.Draw.limb(ctx, x0,y0, x1,y1, bend, w, col)        // 2-joint limb; bend = perpendicular control offset
UB.Draw.outlinePoly(ctx, pts, fill, jitterSeed)      // poly with seeded ±1 px jitter
UB.Draw.smear(ctx, x,y, r, a0,a1, col, alpha)        // motion smear: 3 concentric arcs alpha*1, .6, .3
UB.Draw.shadowBlobUnder(ctx, x, feetY, w)            // ground shadow: ellipse w×6 INK alpha 0.35
UB.Draw.glow(ctx, fn, color, blur)                   // budgeted shadowBlur wrapper (§1.7)
UB.Draw.text(ctx, str, x, y, font, color, align, baseline, inkWidth)  // strokeText INK then fillText
```

### 2.3 Procedural animation (shared `UB.Anim` helpers, all deterministic from frame counters)

| State | Formula (t = frames in state, `cyc` per fighter from combat.md) |
|---|---|
| Idle | bob `y += sin(t/40*2π)` (1 px); breathing `scaleY = 1 + 0.015*sin(t/40*2π)` |
| Run | `phase = (t % cyc)/cyc*2π`; front leg `dx = 8*sin(phase)`, back leg `-8*sin(phase)`; knee bend `6*max(0,cos(phase))`; body bob `y -= 2*abs(sin(phase))`; arm swing opposite to legs ±6 px; lean 10° forward (per sheet) |
| Jump | squash/stretch `(0.85, 1.15)` for 6 f from takeoff (combat.md §3), then stretch decays to 1 over 10 f; pose per sheet |
| Fall | `scaleY = 1 + min(0.12, vy/9000)` stretch with speed |
| Land | `(1.2, 0.8)` for 6 f, easing back with `1 - (t/6)^2`; dust puff (§3.6) |
| Attack | per-move: the weapon segment sweeps from `a0` to `a1` over the **active** frames; `UB.Draw.smear` behind it at alpha 0.5 for active + 2 f; on startup frames the segment is "wound" 20° the other way |
| Hurt | `(1.15, 0.85)` 4 f; whole rig tinted: draw the rig a second time with every fill replaced by `#FFFFFF` (frames 1–2) then `DANGER` (frames 3–6) at α 0.6. Shake: rig offset `±2 px` random (seeded by frame) for 6 f |
| Enemy hit flash | same white re-draw for 4 f (combat.md §4.3) |
| i-frames | skip drawing on frames where `(iFrames/4) % 2 == 1` (4 on / 4 off) |
| Death | 60 f: `scaleY → 0.3`, `rot → 25°`, every fill lerped to its grey (`UB.Color.desat`) over 40 f, alpha 1→0 over the last 20 f; 12 chips at f1 |
| Overclock transform | f1–8 white flash (full-screen `fillRect` α 0.6→0), ring r0→120 ink 4; f9–20 `scale 1.0→1.25` and palette crossfade via `UB.Color.mix(base, ocBase, k)`; aura (§3.6) starts f20 |
| Overclock revert | 10 f: scale 1.25→1.0, palette mix back, aura stops |

Facing flip: `UB.Draw.begin(..., facing, ...)` applies `scale(facing,1)`; text and HUD never
live inside that transform. Projectiles (Pulse Line, Ring, bolts) are drawn in world space
with their own facing.

### 2.4 Enemy rig rules (for the enemy doc)

* Each enemy type is one rig of 6–14 shapes, drawn with the same two passes, at most one
  glow dot (eye) — enemies never use `shadowBlur`.
* Zone variant = recolour only: `fill` keys reference `zoneTint.base/shade/accent` which the
  zone palette fills (`tileFill`-adjacent hues so they feel native). Eyes always use the
  zone `glow`.
* Enemy animation uses the same `UB.Anim` table: patrollers run (cyc 10), hoppers squash
  before jumping (6 f at (1.2,0.8)) and stretch in the air, flyers bob (3 px, 50 f cycle) with
  wing flap (2 wedges rotating ±30° at 8 f cycle), turrets rotate a barrel wedge toward the
  player, chargers lean 25° and leave dust, shielded enemies carry a front `rrect` that flashes
  `PAPER` when it blocks, swarmers are `blob` r 6 with 2 antenna lines, ceiling droppers hang by
  a `line` thread and drop with stretch.
* Bosses: rigs of 20–40 shapes; always have a glow "weak core" dot that brightens on hit; boss
  hit flash is the same 4 f white re-draw; a boss **telegraph** is a 2-colour outline pulse
  (`accent` stroke 4 px at α 0.8↔0.2, 8 f period) on the attacking limb for its startup.

---

## 3. Feel

### 3.1 Camera (`UB.Camera`)

```
target.x = player.x + facing * lookahead     // lookahead ramps 0 → 90 px over 20 f while running
                                             //   (|vx| > 60), back to 0 over 30 f when stopped
target.y = player.y                           // with a vertical deadzone: camera y only moves when
                                             //   player.y leaves [cam.y - 70, cam.y + 110]
cam.x += (target.x - cam.x) * 0.12           // per logic frame (≈ 0.22 s to 90 %)
cam.y += (dy) * 0.18                         // dy = distance outside the deadzone; falling fast
                                             //   (vy > 700) uses 0.30 so the ground is visible
clamp: cam.x ∈ [0, roomW - 960], cam.y ∈ [0, roomH - 540]   (rooms smaller than a screen centre)
```

* Wall cling: lookahead flips to the wall-away direction within 10 f.
* Camera is interpolated at render time with `alpha`; shake is added after interpolation
  and is NOT part of `cam` (so clamping never eats the shake). Final draw offset is rounded
  to integers to keep tile edges crisp.
* Boss rooms: lookahead 0; camera centres the midpoint between the player and the boss,
  clamped to the room.

### 3.2 Room transitions

1. Player crosses an exit edge → `state = TRANSITION`, **freeze 6 f** (last frame held).
2. **Slide 18 f (0.3 s)**: the old room's last frame (captured with one `drawImage` of the
   main canvas into `UB.Render.snap`) slides out in the exit direction while the new room,
   fully set up and drawn, slides in from the opposite side; easing `1-(1-t)^3`.
   Player is placed at the new room's entry (1 tile inside the edge) with velocity
   preserved on the axis of travel, and is invulnerable + uncontrolled for the slide.
3. **Settle 4 f**: no input; then play. Total 28 f.
4. The zone-name toast fires only when the zone id changes (§4.5).
5. Falling into a bottom exit keeps `vy`; the top of the new room shows the player at `y =
   30`. Restore node warp (map/respawn) uses a 20 f fade-to-black + 20 f fade-in instead.

### 3.3 Hitstop

Rules are combat.md §0 and §4.3; presentation adds: during world hitstop the renderer still
runs — particles advance, shake decays, the HUD animates, and **the victim is drawn with its
hit flash and offset `±1 px` jitter** (seeded by frame) so the freeze reads as impact, not a
stall. Hitstop > 5 f also adds a 1-frame 2 % zoom (`scale 1.02` about the impact point) on
its first frame. Local hitstop freezes only the victim's animation counters.

### 3.4 Screen shake (`UB.FX.shake(mag, frames)`)

Decaying random offset: each frame `ox = rand(-1,1)*mag*(remaining/frames)`,
`oy = rand(-1,1)*mag*0.6*(remaining/frames)`; overlapping shakes keep the larger
`mag*remaining` (no stacking). Settings `screenShake=false` → multiply mag by 0.

| Event | mag px / frames |
|---|---|
| light hit | 0 |
| L3 / heavy hit | 3 / 6 |
| special hit | 4 / 8 |
| ultimate hit | 8 / 14 (Tessik beam 6/10, Brackmaw quake 10/16 per combat.md) |
| player hurt | 5 / 10 |
| enemy killed | 2 / 4 |
| Overclock activate | 6 / 12 |
| land from vy ≥ 900 | 2 / 4 |
| down-strike pogo | 2 / 3 |
| boss slam / roar | 7 / 12 |
| boss hit (by player) | 1 / 3 |
| boss phase change | 9 / 20 |
| boss death | 12 / 40 (then a 60 f slow fade to 0) |
| spike/acid hit | 4 / 8 |
| room transition | 0 |

### 3.5 Damage flash & low-HP

* Player hurt: entity white/red re-draw per §2.3; plus a full-screen `DANGER` `fillRect` at
  α 0.25 on the hit frame fading to 0 over 6 f.
* **Heartbeat vignette** at HP ≤ 1 (or ≤ 2 when maxHearts ≥ 7): a second vignette layer in
  `DANGER`, radial from r 260 to r 640, alpha `0.10 + 0.14 * pulse` where
  `pulse = max(0, sin(t/36*2π))^3` (a "lub" every 0.6 s); a low thump SFX (§6.9 `heartbeat`)
  each pulse peak, at most once per 36 f.
* Boss hit: boss rig white 4 f; boss HP bar chunk flashes `PAPER` for 8 f (§4.6).

### 3.6 Particles (`UB.FX`, pool 512; per-kind `size, life, gravity, drag, colour`)

| Kind | Spawn | Count | Life f | Motion | Draw |
|---|---|---|---|---|---|
| `spark` | light/heavy/special/ultimate hits | 4 / 8 / 10 / 16 (combat.md) | 14–22 | speed 180–420 px/s in a 100° cone away from the attacker, gravity 600, drag 0.9 | 2 px-wide line from pos to pos−v·0.02, colour = attacker's affinity glow, `lighter` |
| `ring` | L3/heavy (1), ultimate (2), Overclock (1 r120) | 1–2 | 12 | radius 0→R (R 30 for hits) ease-out | ink circle `lineWidth 3`, α 1→0 |
| `chip` | enemy killed 12, player hurt 6, death 12, Brackmaw heavy 5 | as listed | 30–45 | speed 120–300, gravity 900, bounce once on tiles (vy *= −0.4) | 4×4 rrect, entity shade colour, α fades last 10 f |
| `dust` | land (6), run step (1 per stride plant, 2 for Brackmaw/Korvask), dash start (5), wall slide (1 per 4 f) | as listed | 18–28 | vx ±40, vy −30, gravity 0, grows r 2→6 | circle `PAPER` α 0.35→0 |
| `glitter` | bit pickup (6), spark pickup (10), core pickup (24) | as listed | 25–40 | radial burst 60–160 px/s, gravity −80 (floats up), drag 0.92 | 4-point star 3–5 px in `BITS` / `ENERGY` / `CORE_HEART` |
| `bitDrop` | enemy death | 1–3 (world doc) | until picked | gravity 900, bounce 2×, magnet to player within 90 px at 400 px/s | the bit pickup (§4.4 icon, r 6) |
| `bossBurst` | boss death | 60 chips + 6 rings (r 0→200 every 10 f) + 40 sparks | 60–90 | chips as `chip` with speed 300–600 | plus 90 f white-out α 0→0.9→0 |
| `aura` | Overclock active | 1 per 3 f (continuous) | 30 | rises from a random point on the body box bottom edge, vy −60, sways ±3 px | 3 px dot in `ocPalette.glow`, `lighter`, α 0.8→0; plus a body halo ellipse (box w×h × 1.6) in `ocPalette.glow` α 0.12 pulsing 0.08↔0.16 at 20 f |
| `steam/spore/dust ambient` | §1.6 | — | — | — | — |
| `pogo` | down-strike hit | 5 sparks downward + 1 ring r 20 | 12 | | |
| `heal` | restore node use | 16 glitter + 4 rising rings | 40 | | `CORE_HEART`→`PAPER` |
| `telegraph` | boss startup | 6 dots pulled inward to the limb | 10 | | `accent` |

Particles never collide with entities. Max concurrent is the pool; when full, the oldest
`dust`/`aura` is recycled first.

### 3.7 Pickup presentation

* **Bit**: hexagon r 6, fill `BITS`, ink 2, spins (scaleX = cos(t/20)) ; `+1` floats up
  12 px over 20 f in `bold 12px MONO BITS` on pickup.
* **Spark (energy)**: 4-point star 10 px `ENERGY`, `shadowBlur 10`, bobs 3 px.
* **Core**: 16 px diamond `CORE_HEART` with an inner ink diamond, `shadowBlur 16`, orbited by
  3 dots (r 2, 1 rev / 2 s); on pickup the ability-style banner (§4.8) reads `CORE FOUND`.

---

## 4. HUD & screens (960×540)

All HUD elements are drawn after the vignette, in screen space, no camera transform, no
shake. Panels use `PANEL` fill + `PANEL_EDGE` stroke `lineWidth 3`, corner radius 10, with a
hand-drawn ±1 px vertex jitter (seeded by panel id, static).

### 4.1 Hearts — top-left

* Origin (24, 22). Each heart cell 30×26, pitch 32 px, in a row (max 9: 6 base + 3 cores).
* **Base heart** shape (hand-drawn): two `arc`s r 7 at (−7,−3) and (7,−3) plus a `poly` to the
  tip (0, 12); fill `HEART` (full) / `HEART_EMPTY` (empty), ink 3.
* **Core hearts** (the +1s from hidden cores) are drawn as **diamonds** 24×26 (`poly`
  (0,−13),(12,0),(0,13),(−12,0)) filled `CORE_HEART`. HP is one integer: the row shows
  base-shaped cells for indices `< baseHearts` and diamond cells for `≥ baseHearts`; cells with
  index `< hp` are full. Cores are therefore the last cells in the row and empty first.
* Losing a heart: that cell scales 1.4→1 over 8 f and emits 3 `chip`s; gaining one (restore
  node/core) scales 0→1.2→1 over 12 f with 6 `glitter`.
* When hp ≤ 1 the full cells pulse scale `1 + 0.08*pulse` in sync with §3.5.

### 4.2 Energy bar — under hearts

* Rect (24, 56) size 180×12, radius 6; trough `ENERGY_DIM`, fill `ENERGY` width
  `180*energy/100`, ink outline 3. A 1 px `PAPER` tick every 25 energy.
* Fill eases toward the true value at 0.25/frame; on spend, a `PAPER` "ghost" segment of the
  spent width fades over 15 f. Insufficient-energy press: bar flashes `DANGER` 2 f and shakes
  ±2 px for 6 f (with the `deny` SFX).
* Label `ENERGY` in `bold 10px UI PAPER_DIM` at (24, 80).

### 4.3 Overclock meter — under energy

* Rect (24, 88) size 180×8, radius 4; trough `#2A1A3A`, fill `METER` width `180*meter/100`.
* Label `OVERCLOCK` `bold 10px UI PAPER_DIM` at (24, 108); when ready the label text becomes
  `OVERCLOCK — READY  [V]` (or the gamepad glyph `LT`) in `SELECT` and pulses alpha
  0.6↔1.0 at 30 f; the bar gets a travelling highlight (a 24 px wide `METER_READY` α 0.5
  band sweeping left→right every 45 f) and a `shadowBlur 12` glow in `METER` (counts
  toward the budget).
* During Overclock the bar drains (it is the timer, combat.md §5) in `ocPalette.glow` of the
  fighter and the label reads `OVERCLOCKED`; last 3 s (180 f): bar blinks 6 f on / 6 f off.

### 4.4 Bits counter — top-right

* Icon: hexagon r 8 `BITS` ink 2 at (896, 32). Count right-aligned at x 884, y 32,
  `bold 20px MONO PAPER`, ink stroke 3 (text ink via `UB.Draw.text`).
* On pickup the number pops scale 1.3→1 over 10 f.

### 4.5 Zone-name toast

* On zone change, after the transition settles: centred text at (480, 150):
  `bold 34px UI PAPER` zone name (letter-spacing: draw each char with +2 px advance), with
  the zone blurb (§8.4) below at (480, 184) in `16px MONO PAPER_DIM`.
* Timeline 150 f: fade in 20 f (α 0→1, y 160→150), hold 100 f, fade out 30 f. A 2 px
  `tileEdge` rule 260 px wide draws out from the centre under the name during the fade-in.

### 4.6 Boss HP bar — bottom centre

* Visible while a boss is active (from its intro to its death). Panel rect (180, 486) size
  600×30 radius 8; trough `#2A1A24`; fill `DANGER`→`#FF8A5C` horizontal gradient, width
  `596*hp/maxHp` inset 2 px; ink outline 3. 10 `PAPER` α 0.3 segment ticks.
* Name above at (480, 476) `bold 18px UI PAPER` centred, with the boss subtitle (§8.6) in
  `12px MONO PAPER_DIM` right after a `·`.
* Damage: a `PAPER` "lost chunk" lingers 20 f then shrinks. Phase 2: trough colour becomes
  `#3A1020` and the fill gradient flips to `#FF3B5C`→`#B86BFF`; bar shakes ±3 px 20 f.
* Intro: bar draws out from the centre over 30 f while the boss title card shows (§4.13).

### 4.7 Ability banner / pickup banner

* Panel (240, 200) size 480×120, slides in from y 170 over 12 f, holds 150 f, fades 20 f.
  Game is NOT paused; input is live.
* Line 1 (480, 236): `bold 26px UI SELECT` e.g. `DOUBLE JUMP ACQUIRED`.
* Line 2 (480, 268): `16px MONO PAPER` the control hint, e.g. `Press JUMP again in the air`.
* Line 3 (480, 296): `13px MONO PAPER_DIM` the flavour line (§8.5).
* 10 `glitter` burst from the panel corners on open; `ability` SFX.

### 4.8 Prompts & misc HUD

* Interaction prompt (restore node, vendor): `bold 14px UI PAPER` `▲ REST` / `▲ TRADE`
  floating 24 px above the object, bobbing 2 px; the key glyph shows the bound key
  (`UP` or the gamepad glyph).
* Control hints during the first 3 rooms of a new game: a bottom-left line at (24, 520)
  `13px MONO PAPER_DIM` cycling `MOVE  ←→   JUMP  Space   LIGHT  Z   HEAVY  X   SPECIAL  C`,
  dismissed forever once each action has been used once (stored in save `hints`).
* Debug (`showHitboxes`): body boxes `#3FD3FF` α 0.6 stroke 1, attack boxes `#FF3B3B` fill
  α 0.25, enemy boxes `#FFD166`, exits `#8FE388`; plus `fps` and `roomId` at (8, 536)
  `11px MONO`.

### 4.9 Title screen

* Background: zone1 bg0/bg1/bg2 caches scrolling slowly (bg1 at 8 px/s, bg2 at 16 px/s,
  wrapping) with zone1 ambient motes; vignette on top; a slow 1.5 s sine "breathing" of
  the fog alpha 0.12↔0.20.
* **Logo** centred at (480, 170): the word `UNDERBYTE` in `bold 92px UI`, letter-spacing
  +6 px, drawn as: (1) ink `strokeText` `lineWidth 10`; (2) fill with a vertical linear
  gradient `LOGO_A` (top) → `LOGO_B` (bottom); (3) a `PAPER` `strokeText` `lineWidth 2` at
  α 0.6 offset (−2,−2) as a chalk highlight; (4) every 240 f a horizontal "scan" band
  (`PAPER` α 0.35, 14 px tall) sweeps top→bottom over 20 f clipped to the text (draw text
  into a 700×120 offscreen once, use it as a mask via `destination-in` on that offscreen —
  this is the one allowed exception to the compositing rule, and it is off-screen).
  Logo idles with a 2 px bob (3 s) and a 0.5° rock.
* Tagline at (480, 232) `18px MONO PAPER_DIM`: §8.1.
* Menu (vertical list, centred, start y 320, pitch 44): `NEW GAME`, `CONTINUE`, `SETTINGS`
  in `bold 24px UI`. Unselected `PAPER` α 0.8; selected `SELECT` with a `▶` marker 26 px to
  the left that nudges ±3 px at 20 f, and the item scales 1.06. `CONTINUE` is drawn
  `PAPER_DIM` α 0.4 and skipped when there is no save; when a save exists it shows a
  sub-line `12px MONO PAPER_DIM`: `TESSIK · CACHE SHALLOWS · 4 hearts · 01:23:45`.
* Footer (480, 516) `11px MONO PAPER_DIM`: `an original game · keyboard or gamepad · press
  Enter`. Bottom-right `v1.0` at (944, 528).
* Before the first user gesture a line at (480, 470) `bold 14px UI SELECT` blinks (30 f):
  `PRESS ANY KEY` — the gesture also unlocks audio (§6.1).

### 4.10 Character select

* Header (480, 48) `bold 30px UI PAPER`: `CHOOSE YOUR SPIRIT`. Sub (480, 74) `13px MONO
  PAPER_DIM`: `← → select · Enter confirm · Esc back`.
* **5 cards** in a row: card size 150×110, y 380..490, x positions 60, 240, 420, 600, 780
  (gap 30). Each card: panel; fighter name `bold 16px UI` at top (centre, y+22); title
  `11px MONO PAPER_DIM` (y+40); a 56 px tall mini idle rig (scale 0.9) centred at (x+75,
  y+78). Hovered card: `SELECT` edge, lifts 8 px, scale 1.05; others α 0.75.
* **Big preview** centred at (300, 230): the hovered fighter's rig at scale 3.0 running its
  idle animation; every 180 f it plays a random pose from `run → light1 → light2 → light3 →
  jump → heavy` (each pose held for its combat.md total frames at scale 3), then idle. A
  ground shadow ellipse 120×14 at (300, 330). Behind it a `glow` affinity halo r 110 α 0.10.
  Switching fighters: old rig slides out 40 px and fades 8 f, new one slides in.
* **Stat panel** at (560, 130) size 360×150: 4 bars, label `bold 13px UI PAPER` left at
  x 580, bar from x 680 to 900 (220 wide, 10 tall, radius 5), trough `#2A2230`, fill
  `SELECT`, ink 2; rows y 160, 190, 220, 250 for `HEARTS`, `SPEED`, `JUMP`, `WEIGHT`.
  Values normalised to the roster: hearts `hp/6`, speed `run/300`, jump
  `jumpHeight/124.5`, weight `weight/1.3` (combat.md §2). Bars animate to target at
  0.2/frame.
* **Moveset panel** at (560, 292) size 360×72: 3 lines `12px MONO PAPER`, from combat.md
  move names: `LIGHT  L1 / L2 / L3 names`, `HEAVY  name   SPECIAL  name`, `ULTIMATE  name`.
* **Bio** at (60, 345) width 420, `12px MONO PAPER_DIM`, word-wrapped 3 lines max (§8.3).
* Confirm: `confirm` SFX, card flashes `PAPER` 4 f, 20 f fade to black, then the game
  starts (new game) with the zone toast.

### 4.11 Pause menu

* Dim the frozen game frame with `rgba(10,8,12,0.6)`. Panel (330, 150) size 300×240.
  Title `PAUSED` `bold 24px UI PAPER` at (480, 186). Items start y 226 pitch 40 `bold 18px
  UI`: `RESUME`, `MAP`, `SETTINGS`, `QUIT TO TITLE`. Selection style as the title menu.
* `QUIT TO TITLE` asks `Unsaved progress since the last node is lost. Quit?` with
  `YES / NO` (NO default) in a 300×110 panel.
* Music ducks to 40 % volume over 10 f while paused (§6.4).

### 4.12 Map screen (`M`, `Tab`, or pause → MAP)

* Full-screen panel inset 20 px: (20, 20) size 920×500. Header `MAP` `bold 22px UI` at
  (60, 56); zone name of the current room right-aligned at (900, 56) `14px MONO PAPER_DIM`.
* Each room is drawn as a rounded rect at **room grid coordinates × 48 px per screen**
  (rooms are W×H screens → `48W × 48H`, minus 4 px gap), using the room's `gx, gy` from
  the world doc, with the whole graph auto-centred on the current room and clamped to the
  panel; arrows/stick pan (240 px/s), `R` recentres.
* Visited room: fill the zone's `tileFill`, ink 2, with exit stubs (6×6 ink notches) on the
  edges that have exits. Discovered-but-unvisited neighbour (seen through an exit): fill
  `#1A1620` dashed outline (`[4,4]`). Unknown: not drawn, and the panel background has a
  faint `INK` hatch so the fog reads as "paper".
* Icons inside rooms: restore node = `CORE_HEART` diamond 8 px; boss room = `DANGER` skull
  glyph drawn as a circle r 5 with two 2×2 ink eye dots (defeated → `PAPER_DIM`); vendor =
  `BITS` hexagon; core found = small `CORE_HEART` dot. Player = `ENERGY` dot r 5 with a
  pulsing ring r 5→12 every 40 f.
* Legend at the bottom (60, 500) `11px MONO PAPER_DIM`: `◆ node  ● boss  ⬢ vendor  · you`.
  Footer right: `Esc / M close`.

### 4.13 Boss title card

* On boss intro (60 f, player locked but world runs): a horizontal `INK` band α 0.8 from
  y 190 to 270 full width slides in from the left over 12 f; name at (480, 222) `bold
  36px UI DANGER` letter-spaced +4, subtitle at (480, 254) `14px MONO PAPER`; `bossRoar` SFX
  on f8; shake 7/12. Card exits upward over 10 f at f60 as the HP bar finishes drawing.

### 4.14 Settings

* Panel (230, 90) size 500×360. Title `SETTINGS`. Rows pitch 44 starting y 150, label left at
  x 260 `bold 16px UI PAPER`, control right-aligned to x 700:
  1. `MASTER VOLUME` slider 0–10 (bar 160×10, knob r 8 `SELECT`), default 8
  2. `MUSIC VOLUME` slider, default 7
  3. `SFX VOLUME` slider, default 8
  4. `SCREEN SHAKE` toggle `ON/OFF` (pill 56×22), default ON
  5. `SHOW HITBOXES` toggle, default OFF
  6. `RESET SAVE` (only from the title) → confirm dialog
  7. `BACK`
* Left/Right adjust sliders by 1 and play `menuMove` at the new volume so the user hears it;
  toggles flip on Enter/Left/Right. Changes save to `underbyte.settings` immediately.

### 4.15 Game over

* On death animation end: fade to `#07050A` over 40 f (music fades with it); text `SIGNAL
  LOST` `bold 44px UI DANGER` at (480, 240) fades in 20 f with a 3 px ink stroke; sub (480,
  290) `14px MONO PAPER_DIM`: `Rebooting at the last restore node…`; prompt (480, 400)
  `bold 16px UI SELECT` blinking: `Press JUMP or CONFIRM to continue`. Confirm → 20 f fade,
  respawn, `restore` SFX. The deaths stat increments on death, not on confirm.

### 4.16 Victory

* After the final boss death burst and 120 f of hold, fade to black 60 f; a 1280×720
  zone1 bg2 slowly drifting behind; `ROOT PROCESS PURGED` `bold 40px UI LOGO_A` at (480,
  110) with the logo treatment; stats panel (280, 160) size 400×200, rows `16px MONO`:
  `FIGHTER`, `TIME` (`HH:MM:SS`), `DEATHS`, `BITS COLLECTED`, `CORES FOUND x/3`, `BOSSES
  4/4`; each row types in 12 f after the previous. Epilogue text (§8.7) scrolls up from
  y 400 at 18 px/s, `14px MONO PAPER` centred, after the stats; then `Press CONFIRM for
  the title` at (480, 510). The save keeps the cleared state (`victory:true`); Continue
  reloads at the final restore node for free play.

---

## 5. Controls (`UB.Input`)

### 5.1 Actions

`left, right, up, down, jump, light, heavy, special, dash, overclock, confirm, back,
pause, map`. Every frame `UB.Input.state[action]` is `{down, pressed, released, buffer}`.
`pressed` is true for exactly one logic frame. Menus read `pressed` with key-repeat
(initial 18 f, then every 8 f while held) for `up/down/left/right`.

### 5.2 Keyboard default map (both columns always active)

| Action | Keys |
|---|---|
| left | `ArrowLeft`, `KeyA` |
| right | `ArrowRight`, `KeyD` |
| up | `ArrowUp`, `KeyW` |
| down | `ArrowDown`, `KeyS` |
| jump | `Space`, `KeyW`, `ArrowUp` |
| light | `KeyZ`, `KeyJ` |
| heavy | `KeyX`, `KeyK` |
| special | `KeyC`, `KeyL` |
| dash | `ShiftLeft`, `ShiftRight`, `Semicolon` |
| overclock | `KeyV`, `KeyI` |
| confirm | `Enter`, `Space`, `KeyZ`, `KeyJ` |
| back | `Escape`, `KeyX`, `KeyK`, `Backspace` |
| pause | `Escape`, `KeyP` |
| map | `KeyM`, `Tab` |

Rules: listen on `window` with `e.code`; `preventDefault()` for every mapped code so the
page never scrolls (`Space`, arrows, `Tab`). Down-strike = `down` held + `light`, or `heavy`
while airborne (combat.md §4.7). Interact at a node/vendor = `up` pressed while overlapping.
`KeyW`/`ArrowUp` double as jump: pressing `up` at a node triggers the interaction **and
not** a jump (interaction has priority and consumes the press). A `blur` event releases
every key.

### 5.3 Gamepad (standard mapping, polled every logic frame via `navigator.getGamepads()`)

| Action | Button / axis |
|---|---|
| left/right/up/down | d-pad 14/15/12/13 **or** left stick axes 0/1 with deadzone 0.35 (hysteresis: release at 0.25) |
| jump | A (0) |
| light | X (2) |
| heavy | Y (3) |
| special | B (1) |
| dash | RB (5); LB (4) also dash |
| overclock | LT (6, value > 0.5); RT (7) also overclock |
| confirm | A (0); back = B (1) |
| pause | Start (9) |
| map | Back/Select (8) |

The first pad that reports any button press becomes the active pad; the HUD switches its
glyphs to gamepad names (`A`, `X`, `LT` …) until a keyboard key is pressed. Both devices
work simultaneously. Rumble is not used.

### 5.4 Touch (optional, auto-shown only when a `touchstart` happens)

Semi-transparent (`PAPER` α 0.18, ink α 0.4) circles 56 px radius:
left cluster d-pad ◀ at (70, 450), ▶ at (190, 450), ▼ at (130, 500 — half size, down only);
right cluster `JUMP` (890, 470), `LIGHT` (800, 430), `HEAVY` (870, 380), `SPECIAL` (780,
350), `DASH` (930, 400, r 36), `OC` (700, 480, r 36); top-right `≡` pause (930, 40, r 22)
and `MAP` (880, 40, r 22). Multi-touch: each touch id maps to the nearest button within 70
px on start; a drag within the d-pad switches direction. Buttons draw their label in
`bold 14px UI`. Logic is identical to key presses.

### 5.5 Input buffer & menus

* Every action in `{jump, light, heavy, special, dash, overclock}` sets `buffer = 6` on
  press; the gameplay code consumes the first legal frame and clears it; buffer timers do
  not tick during hitstop (combat.md §3). `pressed` for the remaining actions is 1 frame.
* Jump release (`released`) is forwarded to the jump cut even if the press was buffered.
* Menus: `up/down` move (wrap), `left/right` adjust, `confirm` activates, `back` closes
  one level. `menuMove`/`menuConfirm`/`menuBack` SFX on each. Mouse/touch on menus: hover
  highlights, click activates (nice-to-have; keyboard/gamepad are required).
* The game pauses automatically on `visibilitychange` → hidden, and on gamepad disconnect
  if the pad was active.

---

## 6. Audio (`UB.Audio`, Web Audio, fully synthesized)

### 6.1 Context lifecycle

* No `AudioContext` is created until the first user gesture (`keydown`, `pointerdown`,
  `touchstart` on `window`). On that gesture: `ctx = new (AudioContext||webkitAudioContext)()`,
  build the graph (§6.2), `ctx.resume()`, start the title music. Every later gesture calls
  `if (ctx.state !== 'running') ctx.resume()` (cheap, idempotent).
* `visibilitychange` → hidden: music bus gain → 0 over 0.1 s; visible: back to its setting
  over 0.3 s and `ctx.resume()`. The game never throws if `ctx` is null: every public method
  (`play`, `music`, `setVolume`) early-returns when `!ctx`.
* The music scheduler (§6.5) keys off `ctx.currentTime`, so a suspended context simply pauses
  the song; on resume the scheduler resyncs `nextNoteTime = ctx.currentTime + 0.05` (no
  catch-up burst).

### 6.2 Graph

```
voices ─► sfxBus (Gain) ─► compressor (DynamicsCompressor: thr −18, ratio 4, att 0.003, rel 0.25) ─┐
music instruments ─► musicBus (Gain) ─────────────────────────────────────────────────────────────┼─► master (Gain) ─► destination
send taps ─► reverb (feedback delay: Delay 0.23 s → Gain 0.38 → BiquadFilter lowpass 2200 Hz → back into Delay; wet Gain 0.35) ─► master
```

Gains: `master = (settings.master/10)^2`, `musicBus = (settings.music/10)^2 * duck`,
`sfxBus = (settings.sfx/10)^2`. `duck` = 1.0 in play, 0.4 while paused/menus over the
game, 0.0 during the 40 f game-over fade. Music sends 0.25 of its output to the reverb,
hits/sfx send 0.12, menu sounds 0. Noise source: one 2-second `AudioBuffer` of white noise
(`Math.random()*2-1`) built once; each noise voice is a looping `BufferSource`.

### 6.3 Voice & ADSR (`UB.Audio.voice(spec)`)

Polyphony cap **24 voices** (16 sfx + 8 music); a new voice past the cap steals the oldest
sfx voice (stop at `t+0.01` with a 10 ms ramp to avoid clicks). Each voice:
`osc(type, freq[, detune]) [+ osc2] → BiquadFilter(lowpass, cutoff, Q) → Gain(ADSR) → bus`.
Nodes are created per voice (Web Audio nodes are one-shot) but the voice *records* are a
fixed array of 24 structs reused in place.

```
spec = { type:'sine'|'square'|'sawtooth'|'triangle'|'noise', f:220, f2:null, detune:0,
         slide:{to:110, t:0.12} | null,   // exponentialRamp of frequency
         cut:1800, q:1, cutEnv:{to:400, t:0.2} | null,
         a:0.005, d:0.08, s:0.0, r:0.12, dur:0.1,   // seconds; dur = time at sustain before release
         vol:0.5, bus:'sfx', send:0.12, pan:0 }
```

ADSR: `g.setValueAtTime(0,t); g.linearRampToValueAtTime(vol, t+a); g.linearRampToValueAtTime(vol*s, t+a+d);
g.setValueAtTime(vol*s, t+a+d+dur); g.linearRampToValueAtTime(0, t+a+d+dur+r); osc.stop(t+a+d+dur+r+0.02)`.
Pan uses a `StereoPanner` only for positional sfx (hits/enemies): `pan = clamp((x-camCenter)/480,-1,1)*0.6`.
A tiny random detune (±6 cents) and ±4 % duration on every sfx stops repeats sounding
machine-gunned.

### 6.4 Music engine

* Songs are data: `{ bpm, steps:16 (16ths per bar), bars:8, chords:[...8], tracks:{bass,pad,lead,arp,drums} }`.
  Notes are MIDI numbers; `0` = rest; `freq = 440*2^((n-69)/12)`.
* Chord entry: `{root:62, kind:'m'|'M'|'m7'|'sus2'|'dim'|'M7'}` → voicing intervals
  `m:[0,3,7,10 opt] M:[0,4,7] m7:[0,3,7,10] sus2:[0,2,7] dim:[0,3,6] M7:[0,4,7,11]`.
* **Pad** plays the chord voicing for the whole bar (one voice per chord note, `a 0.35 s`,
  released 0.1 s before the next bar). **Bass/lead/arp** are 16-step-per-bar arrays, 8 bars
  long (128 entries); an entry is a MIDI note, `0` rest, or `-1` tie (hold previous).
  Bass arrays are written **relative to the bar's chord root** (semitone offsets), lead and
  arp absolute. Drums: per-bar 16-step strings, `k` kick, `s` snare, `h` hat, `o` open hat,
  `.` rest, one string per bar (8 strings).
* Transition between songs: 0.8 s crossfade of two scheduler instances (old one keeps
  stepping during fade so the loop stays seamless), then the old one is dropped.

### 6.5 Lookahead scheduler (seamless loop)

```
tick every 25 ms (setInterval; survives rAF throttling):
  while (nextNoteTime < ctx.currentTime + 0.12):
    scheduleStep(step, nextNoteTime)        // creates the voices for every track at this 16th
    nextNoteTime += 60 / bpm / 4
    step = (step + 1) % (16 * bars)          // wrap = seamless loop, no gap, no restart
```

Pads are scheduled on step `% 16 == 0` for the full bar. Because every event is scheduled on
the audio clock, the loop has no seam. On pause, `duck` lowers the bus; the scheduler keeps
running (so the resume is in time). Boss music starts on the boss intro frame; on boss death
crossfade to the zone song over 2 s.

### 6.6 Instrument recipes

| Instrument | Recipe |
|---|---|
| `pad` | 2 × sawtooth detuned ±7 cents + 1 triangle an octave down; lowpass 520 Hz Q 0.7 with `cutEnv` to 900 over 1.2 s; a 0.4 s attack, r 0.6, vol 0.11 per note, send 0.3 |
| `padDark` (zone5/boss) | 2 × square ±12 cents, lowpass 380 Hz, slow LFO (`osc 0.15 Hz → gain 120 → filter.frequency`), vol 0.09 |
| `bass` | triangle + square one octave down at 0.4 gain, lowpass 300 Hz, a 0.01 d 0.1 s 0.6 r 0.08, vol 0.22 |
| `bassSaw` (boss/zone4) | sawtooth, lowpass 700 Hz with `cutEnv` 1800→700 over 0.08 s, a 0.005 d 0.12 s 0.4 r 0.05, vol 0.2 |
| `lead` | sine + triangle (0.5), vibrato LFO 5.5 Hz depth 6 cents from 0.25 s, lowpass 2400, a 0.02 d 0.15 s 0.5 r 0.25, vol 0.14 |
| `bell` (zone3) | sine f + sine 2.76f at 0.3 gain decaying twice as fast, a 0.003 d 0.5 s 0 r 0.6, vol 0.13, send 0.4 |
| `pluck` (zone1/2 arp) | square, lowpass with `cutEnv` 3000→600 over 0.12 s, a 0.003 d 0.18 s 0 r 0.1, vol 0.1 |
| `pulse` (zone5 arp) | square, lowpass 900, a 0.002 d 0.06 s 0 r 0.04, vol 0.08 |
| `kick` | sine `slide` 150→42 Hz over 0.11 s, a 0.002 d 0.2 s 0 r 0.05, vol 0.5 |
| `snare` | noise bandpass 1800 Hz Q 0.8, d 0.14 + triangle 180 Hz d 0.06, vol 0.3 |
| `hat` | noise highpass 7000 Hz, d 0.035 (`o` open: d 0.18), vol 0.14 |
| `drone` (zone5) | sine f + sine f*1.005 + sawtooth f/2 through lowpass 200, a 2.0, held, vol 0.1 |

### 6.7 Songs

Common note names for readability: `C4 = 60`. Chord rows list 8 bars.

**TITLE — "Boot Sequence"** · 80 BPM · D major (lydian colour) · pad + lead + soft bass, no drums.
Chords: `DM | AM | Bm | GM | DM | AM | Em | GM`.
Bass (per bar, relative): `[0,-1,-1,-1, -1,-1,-1,-1, 7,-1,-1,-1, -1,-1,-1,-1]` every bar.
Lead (absolute, bars 1–8 as 16ths, `-1` ties): bar1 `[74,-1,-1,-1, 78,-1,-1,-1, 81,-1,-1,-1,-1,-1, 80,-1]`,
bar2 `[78,-1,-1,-1,-1,-1,-1,-1, 76,-1,-1,-1, 74,-1,-1,-1]`, bar3 `[71,-1,-1,-1, 74,-1,-1,-1, 78,-1,-1,-1,-1,-1,-1,-1]`,
bar4 `[79,-1,-1,-1, 78,-1, 76,-1, 74,-1,-1,-1,-1,-1,-1,-1]`, bars5–6 = bars1–2, bar7 `[76,-1,-1,-1, 79,-1,-1,-1, 83,-1,-1,-1, 81,-1, 79,-1]`,
bar8 `[78,-1,-1,-1,-1,-1,-1,-1, 0,0,0,0, 74,-1,-1,-1]`.

**ZONE1 Cache Shallows — "Idle Loop"** · 72 BPM · D dorian · pad, bass, pluck arp, hats only.
Chords: `Dm7 | Dm7 | GM | Dm7 | FM7 | CM | Dm7 | Am`.
Bass: `[0,-1,-1,-1, 0,0,0,0, 0,0,7,-1, 0,0,0,0]` bars 1–7; bar 8 `[0,-1,-1,-1, 0,0,0,0, 12,-1,10,-1, 7,-1,-1,-1]`.
Arp (pluck, absolute, 2-bar pattern repeated 4×, transposed by the chord root − 62):
`[62,0,65,0, 69,0,72,0, 69,0,65,0, 62,0,69,0 | 65,0,69,0, 72,0,76,0, 72,0,69,0, 65,0,60,0]`.
Drums: `"..h...h...h...h."` all bars. Ambient layer: a `drone` on D2 (38) at vol 0.05.

**ZONE2 Spore Stacks — "Mycelial"** · 84 BPM · E aeolian · pad, bass, lead, pluck, kick+hat.
Chords: `Em | CM | GM | DM | Em | Am | CM | Bm`.
Bass: `[0,-1,0,0, 7,-1,0,0, 0,-1,0,0, 10,-1,7,-1]` (bars 1–7), bar8 `[0,-1,0,0, 7,-1,0,0, 12,-1,10,-1, 7,-1,5,-1]`.
Lead (4-bar phrase ×2): bar1 `[0,0,0,0, 71,-1,74,-1, 76,-1,-1,-1, 74,-1,71,-1]`, bar2 `[72,-1,-1,-1,-1,-1,-1,-1, 0,0,0,0, 67,-1,69,-1]`,
bar3 `[71,-1,-1,-1, 74,-1,-1,-1, 79,-1,-1,-1,-1,-1, 78,-1]`, bar4 `[74,-1,-1,-1,-1,-1,-1,-1, 0,0,0,0,0,0,0,0]`.
Pluck: `[52,0,0,0, 0,0,55,0, 0,0,59,0, 0,0,0,0]` relative to chord root as bass (root 52).
Drums: `"k...h...k...h..."` bars 1–7, bar 8 `"k...h...k.k.h.o."`.

**ZONE3 Quartz Registry — "Facets"** · 96 BPM · F# minor (with major IV) · bells arp, pad, bass, hats.
Chords: `F#m | DM | AM | EM | F#m | BM | DM | C#m`.
Bass: `[0,-1,-1,-1, -1,-1,0,-1, 7,-1,-1,-1, 5,-1,3,-1]`.
Bell arp (absolute, 1-bar pattern transposed by chord root − 66):
`[78,0,81,0, 85,0,81,0, 78,0,85,0, 90,0,85,0]` → in bar 8 reverse the array.
Lead (bells, half notes): bar1 `[81,-1,-1,-1,-1,-1,-1,-1, 85,-1,-1,-1,-1,-1,-1,-1]`, bar2 `[86,-1,-1,-1,-1,-1,-1,-1, 85,-1,-1,-1, 81,-1,-1,-1]`,
bar3 `[80,-1,-1,-1,-1,-1,-1,-1, 83,-1,-1,-1,-1,-1,-1,-1]`, bar4 `[85,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1]`, bars5–8 = 1–4 one octave down.
Drums: `"..h.h...h.h...h."` with `o` on bar 4 and 8 step 15.

**ZONE4 Coolant Pipeworks — "Pressure Line"** · 104 BPM · G minor · bassSaw, padDark, lead, kick/snare/hat.
Chords: `Gm | Gm | E♭M (63 root 'M') | FM | Gm | B♭M | E♭M | DM`.
Bass (saw, driving): `[0,0,0,-1, 0,0,12,-1, 0,0,0,-1, 10,-1,7,-1]`.
Lead: bar1 `[67,-1,-1,-1, 70,-1,-1,-1, 74,-1,-1,-1, 72,-1,70,-1]`, bar2 `[67,-1,-1,-1,-1,-1,-1,-1, 0,0,0,0, 65,-1,67,-1]`,
bar3 `[70,-1,-1,-1, 72,-1,-1,-1, 75,-1,-1,-1,-1,-1, 74,-1]`, bar4 `[72,-1,-1,-1,-1,-1,-1,-1, 0,0,0,0,0,0,0,0]`, bars 5–8 = 1–4 a fifth up (+7).
Drums: `"k..hs..hk.khs..h"` bars 1–7, bar 8 `"k..hs..hk.k.s.ss"`. Extra: a metallic `noise`
bandpass 3200 Hz Q 6 hit (vol 0.12) on step 4 of every other bar ("pipe clank").

**ZONE5 Root Deep — "Null Pointer"** · 60 BPM · C phrygian · drone, padDark, pulse arp, sparse kick.
Chords: `Cm | D♭M (61 'M') | Cm | B♭m | Cm | D♭M | A♭M (56 'M') | Gdim (55 'dim')`.
Bass: `[0,-1,-1,-1,-1,-1,-1,-1, 0,-1,-1,-1, 1,-1,0,-1]`.
Pulse arp (absolute, transposed by root − 48, 1 bar): `[48,0,0,49, 0,0,55,0, 0,48,0,0, 51,0,0,0]`.
Drone: C2 (36) held, vol 0.1, with a 0.1 Hz LFO on the lowpass (160↔420 Hz).
Drums: `"k..............."` bars 1–3, 5–7; bars 4 and 8 `"k.......k.....k."`. Every 8 bars a
reversed-envelope noise swell (a 1.5 s, lowpass 600) into bar 1.

**BOSS — "Fault Handler"** · 150 BPM · A harmonic minor · bassSaw 8ths, padDark, lead stabs, full drums.
Chords: `Am | Am | FM | E M | Am | Dm | FM | EM`.
Bass: `[0,-1,0,-1, 0,-1,0,-1, 0,-1,0,-1, 0,-1,12,-1]` bars 1–7, bar 8 `[0,-1,0,-1, 0,-1,0,-1, 12,-1,11,-1, 8,-1,7,-1]`.
Lead stabs (absolute): bar1 `[69,-1,0,0, 0,0,69,-1, 0,0,72,-1, 0,0,71,-1]`, bar2 `[69,-1,0,0, 0,0,0,0, 76,-1,0,0, 75,-1,0,0]`,
bar3 `[77,-1,0,0, 0,0,77,-1, 0,0,76,-1, 0,0,72,-1]`, bar4 `[71,-1,0,0, 0,0,68,-1, 0,0,0,0, 69,-1,0,0]`, bars 5–8 = 1–4 with
bar 8 `[80,-1,-1,-1, 79,-1,-1,-1, 76,-1,-1,-1, 75,-1,71,-1]`.
Drums: `"k.h.s.h.k.h.s.h."` bars 1–7, bar 8 `"k.h.s.h.k.k.s.ss"`.
Phase 2: bpm 158, add a `pulse` arp doubling the bass an octave up, hats become `o` on the
off-beats, lead +12. Final boss uses the same song with the `drone` from zone5 underneath.

### 6.8 SFX recipes (`UB.Audio.play(name, x?)`)

Times in seconds; `type` = oscillator; "affinity type" = sine (Signal), square (Ore),
sawtooth (Flux), triangle (Cipher), square ±15 cents pair (Pressure) — from combat.md §2.

| Name | Recipe |
|---|---|
| `jump` | affinity type, f 300 slide→ 620 over 0.09, a 0.003 d 0.06 s 0 r 0.05, vol 0.25 |
| `doubleJump` | as `jump` with f 420→ 900 plus a second voice 1 octave up at 0.12 vol |
| `land` | noise lowpass 500 d 0.07 vol 0.2 + sine 90 Hz d 0.05 vol 0.2; heavy fighters (Brackmaw/Korvask) sine 60 Hz vol 0.3 |
| `step` | noise lowpass 400 d 0.03 vol 0.06 (every stride plant) |
| `dash` | sawtooth f 180 slide→ 60 over 0.12 + noise highpass 3000 d 0.12 with cutEnv 6000→800, vol 0.22 |
| `wallSlide` | looping noise bandpass 1200 Q 2 vol 0.08 while sliding (one voice, stopped on release) |
| `lightHit` | affinity type f 520 slide→ 260 over 0.06, a 0.002 d 0.07 s 0 r 0.03, vol 0.3 + noise d 0.03 vol 0.15; L2 f 560, L3 f 620 with d 0.11 |
| `heavyHit` | affinity type f 220 slide→ 70 over 0.14 vol 0.4 + noise lowpass 900 d 0.12 vol 0.3 + sine 55 d 0.2 vol 0.3 |
| `special` | fighter: Tessik sine 880 slide→ 1760 0.15 + delay send 0.5; Brackmaw square 90→40 0.3 + noise 0.25; Vellix sawtooth 400→2400 0.08; Orrubel triangle 1200 ×3 pings 60 ms apart; Korvask square pair 150 d 0.1 then 300 d 0.1 |
| `ultimate` | `special` recipe doubled with a second voice +7 semitones, plus `overclockPulse` (sine 48 Hz d 0.4 vol 0.4) |
| `whiff` | noise highpass 2000 d 0.05 vol 0.08 (every attack active-start without a hit) |
| `pogo` | triangle 700 slide→ 1200 0.06 vol 0.22 |
| `hurt` | square 300 slide→ 120 over 0.18 vol 0.35 + noise lowpass 1200 d 0.1 vol 0.25; a 0.9 s musicBus dip to 0.6 |
| `death` | sawtooth 440 slide→ 40 over 0.9 vol 0.3, lowpass cutEnv 3000→200 over 0.9 + 3 noise bursts at 0, 0.25, 0.5 |
| `spike` | noise bandpass 2500 Q 3 d 0.08 vol 0.3 + triangle 900→300 0.1 vol 0.2 |
| `enemyHit` | affinity type f 400 slide→ 200 0.05 vol 0.2 (plays with `lightHit`, panned) |
| `enemyDeath` | square 240 slide→ 60 0.25 vol 0.25 + noise d 0.15 vol 0.2 + 4 `pickupBit`-like blips staggered 30 ms |
| `pickupBit` | sine f 1320 then 1760 (two 40 ms notes), a 0.002 d 0.06 vol 0.18, pitch +2 semitones per bit collected within 0.5 s (max +12) |
| `energy` (spark) | triangle arpeggio 660→880→1320, 50 ms each, vol 0.2, send 0.3 |
| `heal` | sine chord 523/659/784 a 0.05 d 0.6 vol 0.15 each, staggered 80 ms, send 0.4 |
| `core` | `heal` plus a sine 1047 slide→ 2093 over 0.8 vol 0.15 and a `kick` |
| `restore` | square 110 a 0.3 d 0.8 vol 0.15 + `heal`; then a soft noise sweep (lowpass 200→3000 over 1 s) vol 0.08 |
| `overclockOn` | sine 55 slide→ 110 over 0.25 vol 0.5 + sawtooth 220 slide→ 1760 over 0.4 lowpass cutEnv 400→6000 vol 0.25 + noise highpass 1000 reversed-envelope (a 0.3 d 0.05) vol 0.2; musicBus dips to 0.3 for 0.4 s |
| `overclockEnd` | sawtooth 880 slide→ 110 over 0.5 vol 0.2 lowpass cutEnv 5000→200 |
| `overclockWarn` | sine 880 d 0.05 vol 0.12, on each blink of the last 3 s |
| `deny` | square 150 d 0.08 ×2 (gap 60 ms) vol 0.15 |
| `menuMove` | triangle 740 d 0.04 vol 0.12 |
| `menuConfirm` | sine 660 then 990 (50 ms each) a 0.002 d 0.12 vol 0.18 |
| `menuBack` | triangle 500 slide→ 330 0.08 vol 0.12 |
| `ability` | sine chord 440/554/659/880 staggered 60 ms a 0.01 d 1.0 vol 0.14 send 0.5 + `kick` |
| `bossRoar` | sawtooth pair ±20 cents f 80 slide→ 160 slide→ 60 over 0.9, lowpass cutEnv 200→1800→300, vol 0.45 + noise lowpass 400 a 0.1 d 0.6 vol 0.3 + sine 40 d 0.8 vol 0.4 |
| `bossHit` | square 180 slide→ 90 0.08 vol 0.3 + noise bandpass 900 d 0.06 vol 0.2 (plays with the player's hit SFX) |
| `bossPhase` | `bossRoar` at pitch ×1.3 + `overclockOn` sweep |
| `bossDeath` | 6 descending `heavyHit`s 120 ms apart (f ×0.8 each) + sawtooth 220 slide→ 20 over 2.5 s lowpass 2000→100 vol 0.3 + noise lowpass 300 a 0.5 d 1.5 vol 0.3; musicBus 0 over 0.5 s |
| `roomTransition` | noise lowpass cutEnv 300→2000→300 over 0.3 vol 0.12 + sine 220 slide→ 330 0.3 vol 0.08 |
| `crumble` | noise lowpass 800 d 0.3 vol 0.2 with 3 `land` clicks |
| `platformMove` | none (silent) |
| `turretShot` / `bolt` | triangle 1000 slide→ 500 0.07 vol 0.15 |
| `heartbeat` | sine 50 d 0.12 vol 0.35 then 45 d 0.1 vol 0.25 (gap 90 ms) |
| `vendorBuy` | `pickupBit` ×3 ascending + `menuConfirm` |
| `save` | `menuConfirm` + triangle 1320 d 0.2 vol 0.1 |

Rate limits: the same sfx name may not start more than once per 2 logic frames (hits:
3 frames, `step`: 6 frames); extra requests are dropped, not queued. Ultimate and boss
sounds ignore the voice cap (they steal).

### 6.9 Mixing & test hooks

Default level targets at settings 8/7/8: music peaks ≈ −14 dBFS, hits ≈ −8 dBFS, boss roar
≈ −4 dBFS; the compressor catches stacking. `UB.debug.audio()` returns
`{ctxState, voices, song, step, bpm}` and `UB.debug.mute()` sets master 0 for headless tests
(Playwright runs with no gesture, so `ctx` stays null — all audio code must be gesture-safe).

---

## 7. Save format (`UB.Save`)

Two `localStorage` keys. Every read is wrapped in `try/catch` (private mode, quota,
`file://` on some browsers): a failure means "no save" and the game still runs; a write
failure shows a 90 f toast `Could not save (storage blocked)` and continues.

### 7.1 `underbyte.save` (one slot)

```json
{
  "version": 1,
  "fighter": "tessik",
  "roomId": "z1_r03",
  "spawn": { "nodeId": "node_z1_a", "exitId": null, "x": null, "y": null },
  "hearts": 5,
  "maxHearts": 5,
  "baseHearts": 5,
  "cores": ["core_z2_hidden"],
  "abilities": { "doubleJump": true, "dash": false, "wallCling": false },
  "bits": 137,
  "discovered": ["z1_r01", "z1_r02", "z1_r03"],
  "visited": ["z1_r01", "z1_r02", "z1_r03"],
  "bossesDefeated": ["boss1"],
  "vendor": ["energy_cell_1"],
  "nodesUsed": ["node_z1_a"],
  "hints": { "move": true, "jump": true, "light": false, "heavy": false, "special": false },
  "playTimeFrames": 83211,
  "deaths": 2,
  "victory": false,
  "savedAt": 1760400000000
}
```

Rules:
* Written **only** at a restore node (full heal; `spawn.nodeId` set, `exitId/x/y` null) and
  at the victory screen. Game Over never writes. Death keeps `abilities`, `cores`,
  `bossesDefeated`, `bits` and `discovered` in memory (they are part of the respawned state
  and are written at the next node); only position, hearts, energy and meter reset. A
  defeated boss stays defeated, so progression is never lost.
* `maxHearts = baseHearts + cores.length` is recomputed on load; `hearts` is set to
  `maxHearts` on load (you always load at a node).
* `discovered` = rooms shown on the map (visited + neighbours seen); `visited` ⊆ discovered.
* `playTimeFrames` counts logic frames in the `PLAY` state only (not menus or pauses).
* Load: unknown `version` → ignore and treat as no save; `fighter` not in the roster →
  `tessik`; `roomId` unknown → first room of zone1 with its node.
* `UB.debug.save()`/`UB.debug.load()` wrap these for tests.

### 7.2 `underbyte.settings`

```json
{
  "version": 1,
  "master": 8,
  "music": 7,
  "sfx": 8,
  "screenShake": true,
  "showHitboxes": false,
  "touchControls": "auto"
}
```

Volumes are integers 0–10 mapped to gain `(v/10)^2` (perceptual). Written on every change.
Missing keys take the defaults above; the file is never deleted by `RESET SAVE` (which
clears only `underbyte.save`).

---

## 8. In-game text (`UB.Text`) — all original

Fighter placeholders map to combat.md ids: `FIGHTER_1 = tessik`, `FIGHTER_2 = brackmaw`,
`FIGHTER_3 = vellix`, `FIGHTER_4 = orrubel`, `FIGHTER_5 = korvask`. The synthesizer may
substitute names; the strings below already use the canonical ones.

### 8.1 Title

* Logo: `UNDERBYTE`
* Tagline: `A kingdom buried in its own memory. Purge it from the inside.`
* Menu: `NEW GAME` · `CONTINUE` · `SETTINGS`
* Prompt: `PRESS ANY KEY`
* Footer: `an original game · keyboard or gamepad · press Enter`
* No-save hint (when CONTINUE is selected and empty): `No signal found. Start a new run.`
* New game over existing save: `Overwrite the saved run?` → `YES` / `NO`

### 8.2 Character select

* Header: `CHOOSE YOUR SPIRIT`
* Sub: `← → select · Enter confirm · Esc back`
* Stat labels: `HEARTS` · `SPEED` · `JUMP` · `WEIGHT`
* Moveset labels: `LIGHT` · `HEAVY` · `SPECIAL` · `ULTIMATE`
* Confirm line: `Boot as {NAME}?` (shown for 1 frame under the card; just the SFX in practice)

### 8.3 Fighter bios (one paragraph each, shown under the cards)

* **Tessik — The Courier Lantern.** Tessik once carried messages between the kingdom's
  layers and still mutters route names under its breath. It believes every corrupted thing
  is only a message that lost its address, and that a sharp enough blade can re-deliver it.
  Balanced in every stat; the right first choice.
* **Brackmaw — The Walking Vault.** A retired archival lock that decided the safest vault
  is the one that walks toward the problem. It speaks in short declaratives and considers
  being knocked over a personal failing. Slow, armoured, and the hardest hitter here.
* **Vellix — The Prefetch Streak.** A cache routine that lives three steps ahead of everyone
  and is bored by the present. Reckless and bright, it treats every fight as a timing puzzle
  it has already solved. Fastest in the roster, and the most fragile.
* **Orrubel — The Ring Warden.** A watchdog process that trusts nothing it has not measured
  twice and prefers to fight from behind a wall of its own instruments. Soft-spoken and
  precise, it apologises to enemies as it pins them. Long reach, a returning ring, and
  sentries.
* **Korvask — The Clamp Balancer.** A load-balancer that misremembers its old job as
  "holding things until they stop struggling." Gruff and loyal, it believes any problem
  can be solved by getting closer to it. A bruiser whose counter turns enemy attacks
  into pain.

### 8.4 Zone names & intro blurbs (toast line 2)

| Id | Name | Blurb |
|---|---|---|
| zone1 | `CACHE SHALLOWS` | `Where the kingdom kept what it meant to forget.` |
| zone2 | `SPORE STACKS` | `Something grew in the archives. It is still growing.` |
| zone3 | `QUARTZ REGISTRY` | `Every value the kingdom ever held, frozen and singing.` |
| zone4 | `COOLANT PIPEWORKS` | `The heat has nowhere to go. Neither do you.` |
| zone5 | `ROOT DEEP` | `The last process. It knows you are here.` |

### 8.5 Ability & pickup banners

| Event | Line 1 | Line 2 (control hint; glyphs swap for gamepad) | Line 3 (flavour) |
|---|---|---|---|
| Double Jump | `DOUBLE JUMP ACQUIRED` | `Press JUMP again in the air` | `A second thought, taken mid-fall.` |
| Dash | `DASH ACQUIRED` | `Press SHIFT (or RB) to dash — on the ground or in the air` | `Skip the frames you do not need.` |
| Wall Cling | `WALL CLING ACQUIRED` | `Hold toward a wall to cling · JUMP to kick off` | `The walls were never the problem.` |
| Core | `CORE FOUND` | `Max hearts +1` | `A piece of the kingdom that never rotted.` |
| Vendor item | `{ITEM} PURCHASED` | `{EFFECT}` | — |
| Restore node | `RESTORED` | `Saved · hearts full · energy full` | — |

Vendor items (if the world doc ships the vendor): `ENERGY CELL` — `Start rooms with +25
energy` (60 bits); `HEAVY PLATING` — `Hurt knockback halved` (90 bits); `BIT MAGNET` —
`Bits fly to you from farther away` (45 bits). Vendor greeting: `Spare bits? I spare parts.`
Can't afford: `Come back with more bits.`

### 8.6 Boss title cards (placeholders; the world/boss doc may rename)

| Id | Name | Subtitle |
|---|---|---|
| boss1 | `BOSS_1 → suggested: GLUTTON INDEX` | `Keeper of the Shallows` |
| boss2 | `BOSS_2 → suggested: THE SPORE CHORUS` | `Many Voices, One Rot` |
| boss3 | `BOSS_3 → suggested: PRISM AUDITOR` | `It Counts You Twice` |
| boss4 (final) | `BOSS_4 → suggested: ROOT PROCESS` | `Phase One: Denial` / phase 2 card: `Phase Two: Panic` |

Boss defeated toast (bottom, 120 f): `{NAME} PURGED`.

### 8.7 Epilogue (victory scroll)

```
The Root Process stops.
For a moment the kingdom is silent all the way down — no hum in the pipes,
no singing in the quartz, no spores turning in the dark.

Then, layer by layer, the old lights come back on. Not bright. Honest.
The messages find their addresses. The vaults remember what they hold.
The shallows give up what they were told to forget.

You are a Spirit. You were written to end, and you have.
But something has to carry the kingdom's memory forward,
and it was never going to be the kingdom.

Thank you for playing.
```

### 8.8 System strings

* Pause: `PAUSED` · `RESUME` · `MAP` · `SETTINGS` · `QUIT TO TITLE`; quit confirm: `Unsaved
  progress since the last node is lost. Quit?` `YES` / `NO`.
* Settings: `SETTINGS` · `MASTER VOLUME` · `MUSIC VOLUME` · `SFX VOLUME` · `SCREEN SHAKE` ·
  `SHOW HITBOXES` · `RESET SAVE` · `BACK` · `ON` / `OFF`; reset confirm: `Erase the saved
  run? This cannot be undone.`
* Map: `MAP` · legend `◆ node  ● boss  ⬢ vendor  · you` · `Esc / M close` · `R recentre`.
* Game over: `SIGNAL LOST` · `Rebooting at the last restore node…` · `Press JUMP or CONFIRM
  to continue`.
* Victory: `ROOT PROCESS PURGED` · stats `FIGHTER` `TIME` `DEATHS` `BITS COLLECTED` `CORES
  FOUND` `BOSSES` · `Press CONFIRM for the title`.
* Prompts: `▲ REST` · `▲ TRADE` · storage toast `Could not save (storage blocked)` ·
  gamepad toast `Gamepad connected` / `Gamepad disconnected — paused`.
* Hint strip: `MOVE ←→  JUMP Space  LIGHT Z  HEAVY X  SPECIAL C  DASH Shift  OVERCLOCK V`.
