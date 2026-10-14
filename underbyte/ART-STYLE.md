# UNDERBYTE — pixel art style guide (v3 look)

The game's look moves from smooth vector drawing to **handheld-era pixel art**: a small
native resolution scaled up with hard square pixels, limited palettes, one-pixel outlines and
frame-by-frame animation. Gameplay, physics, rooms and numbers do not change.

Every character, enemy, boss, tile, icon and letter stays **original to UNDERBYTE**. The five
fighters keep their own designs (Tessik the lantern-headed courier, Brackmaw the walking vault,
Vellix the arrowhead streak, Orrubel the ringed bell, Korvask the chained barrel); the pixel
versions must read as those designs and must not drift toward any creature from another game.
No sprites, tiles, fonts or palettes are taken from any other game.

## 1. Resolution and pixel grid

| Thing | Value |
|---|---|
| Logic space (unchanged) | 960×540 units, tile 30 units, 60 Hz |
| Native pixel canvas | **480×270** (1 pixel = 2 logic units), tile = **15 px** |
| Output | nearest-neighbour upscale to the display canvas (`imageSmoothingEnabled = false`), integer scale where the window allows, letterboxed |
| Snapping | every sprite, tile, particle, camera position and text origin is drawn at whole native pixels (`Math.round(x / 2)`); the camera is snapped too, so nothing shimmers |
| Sub-pixel motion | none on screen: movement is shown in whole pixels; screen shake moves in whole pixels |

The entire frame, HUD and menus included, is composed at 480×270 and upscaled once.

## 2. Palettes and shading

* **No anti-aliasing, no gradients, no alpha blending in sprites.** Translucency effects
  (fog, vignette, dimmed menus, low-HP pulse) use an ordered 4×4 Bayer dither of solid colours.
* **Outline:** 1 px on the outside of every sprite, in the darkest shade of that sprite's own
  palette (never pure #000). Interior lines (limb overlaps, mouth, seams) also 1 px.
* **Ramps:** each material has a 3–4 step ramp, shadows hue-shifted toward cool, highlights
  toward warm. Light comes from the top-left. One bright 1–2 px specular highlight per form.
* **Budgets:** fighter ≤ 12 colours + outline; enemy ≤ 8; boss ≤ 16; each zone tileset ≤ 16;
  each zone background ≤ 8 (darker and lower-contrast than the play layer).
* **Overclock:** a second palette per fighter (pre-mixed, not tinted at runtime) plus a 1 px
  glowing outer rim that flickers every 4 frames.
* **Hurt flash:** a solid white silhouette frame for 2 frames (palette swap), not an overlay.
  With Reduced Flashing on, a 1 px white rim instead.

## 3. Sprite sizes (native pixels)

| Sprite | Size |
|---|---|
| Fighters | body box ÷ 2 → about 11–17 px wide, 20–28 px tall, drawn in a 48×48 frame for swings |
| Small enemies | 8–16 px |
| Large enemies | 16–24 px |
| Bosses | 40–96 px tall |
| Pickups | bits 4–7 px, heart 7×6, spark/shard 5–7 px |
| HUD heart | 9×8 icon (core heart: a 9×9 diamond icon) |

## 4. Animation

Frame-by-frame, not continuous tweening. Procedural poses are **quantised to frames** and
cached:

| Animation | Frames | Rate |
|---|---|---|
| Idle | 4 | 6 fps (held frames) |
| Run | 6–8 | 10–12 fps, tied to distance travelled |
| Jump rise / apex / fall | 1 / 1 / 2 | by velocity |
| Land squash | 2 | 4 frames each |
| Light 1/2/3, heavy, air, down-strike, special | 2–4 drawings each, keyed to the move's startup / active / recovery frames | by frame data |
| Hurt | 2 | by hurt timer |
| Wall cling / slide | 2 | |
| Death | 4–6 | |

Motion smears on swings are 1–2 drawn pixel arcs on the active frames, in the fighter's accent
colour. Hitstop holds the current drawing.

## 5. World

* **Tiles:** 15×15 px, one tileset per zone. Solid tiles get a 1 px top highlight row and an
  outline only on exposed edges; inner tiles use a seeded 2–3 variant texture (cracks, rivets,
  cable runs, crystals, roots) so large walls don't repeat visibly. One-way grates, spikes,
  pools (2–3 frame shimmer), crumble tiles (crack overlay + shake) and mover platforms all
  get their own pixel tiles.
* **Hazards** must read without colour: spikes are bright-tipped triangles, pools have a moving
  2 px surface line, crumble has visible cracks. Hazard Outline mode adds a dithered checker
  border.
* **Backgrounds:** 2–3 parallax layers per zone, built once per zone at native resolution from
  solid shapes and dithered bands. Far layers are low-contrast so the play layer pops.
* **Lighting:** glows are drawn as stepped rings of solid colour (2–3 rings), not blurs.

## 6. Effects

Particles are 1×1, 2×2 or 3×3 squares, or tiny 3–5 frame pixel sprites (hit spark star, dust
puff, bit sparkle, Overclock embers). Hitstop and shake keep their timings. Full-screen flashes
become 1–2 frames of a dithered white layer, and are scaled down or removed by Reduced Flashing.

## 7. Text and UI

* A **built-in bitmap font**, original to this game, defined in code: 5×7 glyphs in a 6×9 cell
  (uppercase, lowercase, digits, punctuation, arrows, the ▲ ◆ ● ✕ glyphs the UI uses). There is
  also a 2× variant for titles and a 1 px drop shadow option. No web fonts and no system fonts.
* Windows are 9-slice pixel frames with a 1 px light inner bevel and a 1 px dark outer line.
  Menus are opaque.
* HUD positions are the DESIGN §12 coordinates halved. Bars are segmented pixel bars, and the
  boss bar has a 1 px damage trail.
* The title logo is the word UNDERBYTE in a custom chunky pixel lettering (2–3× the base glyph
  grid) with a stepped colour band and a 1 px outline.

## 8. Performance

Per frame the renderer only blits cached canvases with `drawImage`. Caches are per zone
(tiles, backgrounds), per fighter and palette (pose frames), and per enemy and boss type.
They are built lazily and kept in a small LRU. There is no `getImageData` in the frame loop,
and the target is ≤ 6 ms per frame on a mid laptop.
