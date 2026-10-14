# UNDERBYTE — World, Progression, Enemies & Bosses

This is the authoritative world specification. Implementers copy every number, map row, coordinate and timing verbatim. Where this document and another design doc disagree on world content, this document wins; where it names fighter numbers it states the **minimum traversal budget** every fighter must meet (section 1.3).

Contents: 1 Conventions · 2 Zones · 3 Room graph (overview, gates, every room with full tilemap) · 4 Enemy roster · 5 Bosses · 6 Pickups & drop rules · 7 Vendor · 8 Victory.

---

## 1. Conventions

### 1.1 Grid and tiles
* Tile = **30 px**. Screen = **32×18 tiles (960×540)**. Rooms are 32–128 wide and 18–72 tall; the camera scrolls inside larger rooms and clamps to room bounds. Tile (x,y): x grows right, y grows **down**, (0,0) is the top-left tile.
* Rooms are authored as ASCII tilemaps, one string per row, exactly `w` characters each. Legend and exact semantics:

| Char | Name | Collision / behaviour |
|---|---|---|
| `#` | solid | Solid on all four sides. Wall-clingable (section 1.3) once Grip Protocol is owned. |
| `-` | one-way platform | Solid only for a body whose feet were at or above the tile's top edge on the previous frame and whose vy ≥ 0. Pressing **Down + Jump** while standing on it drops through (ignore `-` collision for 10 frames). Enemies treat it as solid from above. |
| `c` | crumbling platform | Behaves like `#` until a player stands on it; then **shakes 20 frames** (±2 px jitter), then **vanishes** (no collision, falling-fragment particles) for **180 frames**, then returns with a 6-frame fade-in. Each `c` tile has its own timer, but all `c` tiles touched on the same frame start together. |
| `^` | floor spike | Hazard. Hit box = tile inset 4 px on each side, top 6 px lower than the tile top (the drawn spike tips). Pogo-able: a down-strike that touches a spike box bounces the player and deals no damage. Otherwise contact = **−1 HP** and **hazard respawn** (1.5). |
| `v` | ceiling spike | Same as `^` but hangs from the tile top; hit box inset 4 px each side, 6 px shorter at the bottom. Not pogo-able. |
| `~` | hazard pool | Hazard. Full-tile hit box (acid in Brinevault, static elsewhere). Contact = −1 HP + hazard respawn. Enemies, projectiles and moving platforms ignore pools. Drawn as a surface line with slow sine ripple and bubbles/sparks. |
| `.` | empty | Air. |
| `B` | decor hint | Non-solid, no collision. Renderer draws the zone prop (1.6) anchored to this tile. Never used as footing in this document. |

* The outermost ring of every room is `#` except where an exit opening punches through it.
* Room bounds are solid for anything that is not an exit: the player can never leave a room except through an exit rectangle.

### 1.2 Exits and arrivals
* An **exit** is a rectangle of opening tiles on one room edge: for `left`/`right` exits it is tile column 0 / w−1 over a row range; for `top`/`bottom` it is row 0 / h−1 over a column range. Every exit has an `id` unique within the room, a `target` room id, a `targetExit` id, and `ability` (`none`, `double_jump`, `dash`, `wall_jump`) = the ability a player is expected to own to realistically reach that exit from the room's other exits (informational: the engine does not block traversal, geometry does).
* **Trigger:** left/right: the player's hit-box center x leaves the room (x < 0 or x > w·30) while the player's hit-box vertically overlaps the opening rows. Top: hit-box top < −8 px while horizontally overlapping the opening columns. Bottom: hit-box top > h·30 while horizontally overlapping the opening columns.
* **Arrival:** each exit lists an **arrival spawn tile** (x,y) used when the player enters the room *through that exit*: player hit-box bottom-center is placed at pixel (x·30+15, (y+1)·30), i.e. the player stands on tile (x, y+1). Horizontal velocity is preserved on left/right arrivals. Arriving through a **top** exit (coming from the room above) sets vy = +2 px/frame (falling). Arriving through a **bottom** exit (coming from the room below) is an **auto-launch**: vy = −(the fighter's full jump impulse) and horizontal input is honoured immediately, so the player pops out of the chute and can steer onto the floor beside it.
* **Launch pads:** every top exit has footing at row ≤ 4 inside the opening columns, so a single full jump (apex 3.4 tiles) carries the hit-box top past −8 px.
* Room transition: 12-frame fade to the zone's far-background colour, then 12-frame fade in; logic is paused during the fade. Enemies in the room being left are discarded; the new room spawns its full roster (1.5).

### 1.3 Traversal budget (minimums every fighter must satisfy)
The fighter designer may give fighters different weights and speeds, but every fighter must clear the tests below; the world is built on exactly these thresholds. Reference tuning that satisfies them: run 4.0 px/frame, jump impulse −9.6 px/frame, gravity 0.45 px/frame², terminal fall 12 px/frame, variable jump (releasing Jump while rising sets vy to max(vy, −3.0)), player hit-box 22×40 px (any fighter's hit-box must be ≤ 26×44 so it fits a 2-tile corridor).

| Capability | Pinned guarantee (tiles) | Must fail |
|---|---|---|
| Single jump height | clears a ledge **3** tiles above the feet | a **4**-tile ledge |
| Single running jump gap | clears **5** empty tiles | **6** empty tiles |
| Echo Jump (double jump; second impulse −9.0 at any point while airborne, once per airborne period, reset on landing or wall cling) | clears a **6**-tile ledge; clears a **9**-tile gap | a **7**-tile ledge; a **10**-tile gap |
| Burst Line (dash; 150 px = **5** tiles in 12 frames at constant 12.5 px/frame, gravity off, one air-dash per airborne period, resets on landing or wall cling, 20-frame cooldown on the ground) | crosses a **6**-tile floor gap inside a **2-tile-tall corridor** (low hop ≈ 2.7 tiles + 5 tiles) | the same gap **without** dash: a hop/double-jump under a 2-tile ceiling covers at most **4** tiles |
| Grip Protocol (wall cling/jump; pushing into a `#` side face while airborne clings: slide at 0.5 px/frame, Jump leaves the wall with vx = ±6 px/frame away for 8 frames and vy = −9.0; the player may turn back and re-cling the **same** wall, so any sheer `#` wall of any height is climbable) | climbs a smooth shaft of **any** height | — |

Gate geometry used in the world, derived from the table: a **DJ gate** is a 5- or 6-tile sheer ledge with no footing within 3 tiles of it; a **dash gate** is a 2-tile-tall corridor whose floor is missing for exactly 6 tiles; a **wall-jump gate** is a sheer shaft ≥ 10 tiles tall with no `-`/`c` footing inside it. Because Grip Protocol climbs anything, no vertical gate placed **after** boss 3 is treated as a gate.

### 1.4 Moving platforms
Listed per room as `id · width×1 · from (x,y) → to (x,y) · speed px/frame · end-wait frames`. (x,y) is the platform's top-left **tile** at each end; the platform is `width` tiles wide and 1 tile tall, solid from above only (like `-`), and carries the player (player x/y += platform delta while standing on it). It ping-pongs: moves at constant speed from one end to the other, waits `end-wait` frames, returns. All movers in a room start at their `from` end on room entry with a phase offset equal to their id's index × 45 frames.

### 1.5 Hazard respawn, death, restore nodes
* Spike/pool contact: −1 HP, 45 i-frames, 10-frame hitstop, white flash; after 20 frames the player is placed on the **arrival spawn tile of the exit they most recently entered this room through** (or, in the room where the run started or the last restore node was used, on that tile). If HP reaches 0 this is a death instead.
* Death: 60-frame death animation → Game Over screen → respawn at the last used restore node with full HP; bits are kept (no corpse-run); all non-boss enemies respawn; room-entry history is cleared.
* **Restore node** (one or two per zone; listed per room): standing on its tile and pressing Up/Interact: full heal, save, respawn all non-boss enemies in every room, 30-frame pulse animation. Also sets the death respawn point.
* Enemy respawn: all non-boss enemies respawn when a room is entered. Bosses never respawn once defeated. Hidden cores, bits placed in the map and the vendor's stock are **one-time** (saved).

### 1.6 Zone prop (`B`) catalogue
Driftcache: toppled server rack (tall rounded rect with 4 horizontal slot lines) / cable stump. Loomworks: thread spool (two discs joined by a cylinder with diagonal thread lines) / dangling chain. Brinevault: pipe elbow with a drip. Nullspire: antenna spire (thin tall triangle with a glowing tip). Rootwell: cable-root (thick wavy vertical stroke with knots). A `B` column (several vertically adjacent `B`) is one tall prop; a lone `B` is one small prop.

---

## 2. Zones

Palettes are given as **bg far · bg near · tile fill · tile outline · accent/glow**. Each zone also names its ambient audio description for the audio implementer. The lore blurb is shown once, on first entry, as a title card (zone name large, blurb small, 240 frames or any key).

### Zone 1 — DRIFTCACHE
* **Theme:** the kingdom's topmost layer: dead cache memory, drifts of blue dust, toppled racks and sagging shelves. Quiet and dim; the tutorial zone.
* **Palette:** `#0b1220` · `#15213a` · `#2a3a5c` · `#6c86b8` · `#8fd3ff`.
* **Ambient:** slow detuned sine pad in C minor, 0.2 Hz volume swell, with a soft "dust tick" (filtered noise burst, 50 ms) every 3–6 s and a distant hum at 55 Hz.
* **Hazards:** floor spikes, ceiling spikes, crumbling platforms. Driftcache has no hazard pools.
* **Lore (first entry):** *Driftcache. Everything the kingdom ever remembered and chose not to keep came here to settle. The racks have fallen into one another like old friends. Something still walks the aisles, counting what was lost.*

### Zone 2 — LOOMWORKS
* **Theme:** the kingdom's cable looms: rust-orange machinery, chain hoists, belts, spools taller than the player, static crackling in the floor channels. The moving-platform zone.
* **Palette:** `#1a0f08` · `#2e1a0e` · `#5a3519` · `#b8733a` · `#ffb24a`.
* **Ambient:** a mechanical ostinato: square-wave bass at 65 Hz pulsing every 0.5 s, chain-rattle noise bursts synced to moving platforms, a rising saw sweep every 8 s.
* **Hazards:** static pools, ceiling spikes, floor spikes, moving platforms, crumbling platforms.
* **Lore:** *Loomworks. Here the kingdom wove its own nerves, cable by cable, and never stopped. The looms still run with nothing left to carry. Stand on a belt and it will take you somewhere; whether you wanted to go is not the belt's concern.*

### Zone 3 — BRINEVAULT
* **Theme:** the flooded cooling vaults: pale green coolant gone to acid, dripping pipes, rock pillars in a lake, crystal growths. The hazard-pool zone.
* **Palette:** `#06140f` · `#0d2a20` · `#1d4d3a` · `#4fae84` · `#a8ffcf`.
* **Ambient:** water drips (short sine pings with random pitch 800–1600 Hz, every 0.4–2 s), a low bubbling (band-passed noise 100–300 Hz), a sustained minor-seventh pad.
* **Hazards:** acid pools, ceiling spikes, crumbling platforms, one-way grates over acid.
* **Lore:** *Brinevault. The kingdom ran hot and bled coolant into these vaults to keep its heart from cooking. The coolant stayed; the heart did not. What sleeps in the brine now has learned to climb.*

### Zone 4 — NULLSPIRE
* **Theme:** an inverted spire of black glass hanging in a violet void, every edge crawling with white static. Vertical shafts, sheer walls, long drops. The wall-jump zone.
* **Palette:** `#0a0612` · `#170d26` · `#2b1848` · `#7a4fb8` · `#e8e0ff`.
* **Ambient:** a thin high drone (two sines at 880 and 884 Hz beating), occasional static crackle bursts (white noise 30 ms, random every 1–4 s), a very slow descending bass note every 12 s.
* **Hazards:** static pools, floor spikes, ceiling spikes, crumbling platforms, one moving lift.
* **Lore:** *Nullspire. Addresses that point at nothing all point here. The spire grew downward out of the void, one unanswered call at a time. Climb it and you will be the first thing to arrive.*

### Zone 5 — ROOTWELL
* **Theme:** the deepest layer: crimson dark, gold filament, cable-roots thick as pillars converging on a well of light where the Root Process sits. Short, dense, final.
* **Palette:** `#140406` · `#2a080c` · `#4d1018` · `#b32a2a` · `#ffcf5a`.
* **Ambient:** a heartbeat (two low sine thumps at 50 Hz, 0.15 s apart, every 1.2 s), a choir-like stack of detuned triangles on an F# drone, rising in volume as the player nears `rw_throne`.
* **Hazards:** none environmental except in boss attacks; the gauntlet is enemies.
* **Lore:** *Rootwell. Every process in the kingdom was a child of the one that sits here, and it has never once let go of a child. It will not let go of you either. Make it.*

---

## 3. Room graph

23 rooms. Abilities: **DJ** = Echo Jump (double jump, boss 1), **DASH** = Burst Line (boss 2), **WJ** = Grip Protocol (wall cling/jump, boss 3). Exits are written `room.exitId`; every pair below is reciprocal and was machine-checked for edge matching (left↔right, top↔bottom), target existence, opening tiles being air, and footing under every arrival spawn, enemy, node, vendor and core.

### 3.1 Overview map (schematic; rooms as boxes, `*` = boss arena, `(core)` = hidden core)

```
 ZONE 1 DRIFTCACHE                       ZONE 2 LOOMWORKS
 ===================                     ===================
 [dc_wake]--R/L--[dc_fall (core3: WJ shaft)]
   start,node        |R (bottom)
                     v L
 [lw_shaft]--R2/L2(DJ shelf)--[dc_cross]--R/L--[dc_shrine]--R/L--[dc_sentinel * B1: Echo Jump]
     ^ (climb)                   |T/B (DJ slab)   node,vendor              |R2/L (5-tile ledge: DJ)
     |                        [dc_loft (core1)]                            v
     |                                                                 [lw_hoist] (hoists over static)
     |                                                                     |B/T
     +--------R/L--------[lw_belts (core2: DASH crawlspace)]--R/L--[lw_rest]--R/L--[lw_weftyr * B2: Burst Line]
                                                                    node |B/T                 |B/T
 ZONE 3 BRINEVAULT                                                       v                    v
 ===================                                              [bv_catwalk]           [bv_sluice]
                                                                 (DASH crawlspace)      (DASH crawlspace)
                                                                         |B/T (DASH)          |R/L (DASH)
                                                                         v                    v
                                                                  [bv_cistern] <--------------+
                                                                         |R/L
                                                                         v
                                                                  [bv_rest]--R/L--[bv_corrosant * B3: Grip Protocol]
                                                                   node                      |B/T
 ZONE 4 NULLSPIRE                                                                            v
 ===================                                                                   [ns_base (WJ 10-tile shaft)]
                                                                                             |R/L (WJ)
                                           [ns_rest]--B/T(WJ)--[ns_climb 48x72]<-------------+
                                            node |R/L               |R/L2 (WJ, mid-height)
                                                 v                  v
                                           [ns_plunge]<-------------+     (ns_rest.R -> ns_plunge.L at its top;
                                                 |B/T                      ns_climb.R -> ns_plunge.L2 mid-way)
 ZONE 5 ROOTWELL                                 v
 ===================                       [rw_gate]--R/L--[rw_rest]--R/L--[rw_throne * FINAL: Kernauth]
                                                            node,vendor
```

### 3.2 Exit pairs (25)

| # | A | B | Ability to use A→B / B→A | Kind |
|---|---|---|---|---|
| 1 | `dc_wake.R` | `dc_fall.L` | none / none | critical |
| 2 | `dc_fall.R` | `dc_cross.L` | none / none | critical |
| 3 | `dc_cross.L2` | `lw_shaft.R2` | DJ (6-tile shelf) / DJ (one 4-tile hop in lw_shaft) | shortcut loop A |
| 4 | `dc_cross.R` | `dc_shrine.L` | none / none | critical |
| 5 | `dc_cross.T` | `dc_loft.B` | DJ (6-tile slab) / none | core 1 |
| 6 | `dc_shrine.R` | `dc_sentinel.L` | none / none | critical |
| 7 | `dc_sentinel.R2` | `lw_hoist.L` | DJ (5-tile block) / none | critical (zone 2 gate) |
| 8 | `lw_hoist.B` | `lw_belts.T` | none / DJ (row-4 grate; DJ owned anyway) | critical |
| 9 | `lw_belts.L` | `lw_shaft.R` | none / none | loop A |
| 10 | `lw_belts.R` | `lw_rest.L` | none / none | critical |
| 11 | `lw_rest.R` | `lw_weftyr.L` | none / none | critical |
| 12 | `lw_rest.B` | `bv_catwalk.T` | none (drop) / none (jump from row-4 ledge) | loop B |
| 13 | `lw_weftyr.B` | `bv_sluice.T` | DJ (hop the 1-wide wall) / DJ (row-4 grate) | critical |
| 14 | `bv_sluice.R` | `bv_cistern.L` | DASH (crawlspace gap) / DASH (same gap, reverse) | critical (zone 3 gate) |
| 15 | `bv_cistern.T` | `bv_catwalk.B` | none / DASH (to reach lw_rest side) | loop B |
| 16 | `bv_cistern.R` | `bv_rest.L` | none / none | critical |
| 17 | `bv_rest.R` | `bv_corrosant.L` | none / none | critical |
| 18 | `bv_corrosant.B` | `ns_base.T` | none (hatch unseals after B3) / none (row-4 ledge) | critical |
| 19 | `ns_base.R` | `ns_climb.L` | WJ (10-tile shaft) / none | critical (zone 4 gate) |
| 20 | `ns_climb.R` | `ns_plunge.L2` | WJ / WJ | loop C |
| 21 | `ns_climb.T` | `ns_rest.B` | WJ / none | critical |
| 22 | `ns_rest.R` | `ns_plunge.L` | none / none | critical |
| 23 | `ns_plunge.B` | `rw_gate.T` | none / none (row-3 grate) | critical |
| 24 | `rw_gate.R` | `rw_rest.L` | none / none | critical |
| 25 | `rw_rest.R` | `rw_throne.L` | none / — (final) | critical |

### 3.3 Critical path and gate verification (intended traversal)

New game: `dc_wake` start tile (3,12), restore node at (5,12).

1. **dc_wake → dc_fall → dc_cross → dc_shrine → dc_sentinel (no abilities).** dc_wake is flat. dc_fall is a descent: every drop is a fall, every needed hop ≤ 3 tiles up / ≤ 5 across (entry ledge row 5 → grate row 8 at x13 is a fall; grate → ledge B (row 14) is a fall; ledge B → ledge C (row 20) fall; → grate row 24 fall; → ledge D (row 27) fall; → crumble row 31 (x8–10) fall; → crumble row 34 fall; → ledge E (row 36) fall; → grate row 40, ledge rows 43 (x22–30), grate row 46, floor row 50: all falls). Spikes on the floor at x12–16 are a 5-wide pit: single jump clears. `dc_fall.R` is at floor level. dc_cross: pit 1 (x14–18) is 5 wide (jump, or the grate at row 12); the mound (rows 13–14) is 2 up; pit 2 (x40–43) is 4 wide; `dc_cross.R` at floor level. dc_shrine flat. dc_sentinel flat; boss 1.
2. **Gate: DJ.** After Tallock the player owns Echo Jump. `dc_sentinel.R2` sits on a block whose top is row 10, **5 tiles** above floor row 15 (single jump 3 fails; DJ 6 reaches). No `-`/`c` within 3 tiles. Before the boss the arena is sealed anyway.
3. **lw_hoist → lw_belts → lw_rest → lw_weftyr (DJ).** lw_hoist: ledge row 7 → hoist H1 (x11–13, rides rows 9–20): step down onto it; at its bottom (row 20) → H2 (x19–21, rides rows 16–28) across a 5-tile gap when H2 is at rows 18–22 (any single jump); ride H2 to row 28 → pillar rim (row 30, x13/17) is 2 tiles down-left → into the chute x14–16 → `lw_hoist.B`. lw_belts: arrive on the row-4 grate, drop to floor; pool 1 (x20–31) via M1 (row 12: 3 up from the floor at x19, ride to x28–30, hop to floor x32); pool 2 (x44–55) via M2 the same way; mound 2 up; floor to `lw_belts.R`. lw_rest flat. lw_weftyr: boss 2.
4. **Gate: DASH.** After Weftyr the player owns Burst Line. `lw_weftyr.B`: hop the 1-wide wall at x40 (rows 10–14, 5 tall: DJ) and drop into the hatch x42–44. bv_sluice: land on the shelf (row 8); the crawlspace (rows 6–7, ceiling block rows 1–5 so it cannot be walked over) has its floor missing for **6 tiles (x15–20)** over acid at row 15. Low hop + 5-tile dash = 7.7 tiles of travel ≥ 7 needed; without dash ≤ 4. Falling = acid = −1 HP and respawn on the shelf: never a soft-lock. After the gap, drop at x≥31 to the floor and walk to `bv_sluice.R`.
5. **bv_cistern → bv_rest → bv_corrosant (DJ+DASH).** Entry ledge (row 16) → grate row 24 (x10–16) → left bank floor (row 33, x1–13) → pillars at x18–19 (row 30), x24–25 (29), x30–31 (31), x36–37 (28) → right bank (row 33, x41+): every gap is 3–4 empty tiles, every rise ≤ 3. `bv_cistern.R` at floor level (rows 30–32). bv_rest flat. bv_corrosant: boss 3.
6. **Gate: WJ.** After Corrosant the player owns Grip Protocol. `bv_corrosant.B` unseals. ns_base: land on the row-4 ledge, drop down the left well (rows 6–32) to the floor (row 33), walk right along the 3-tile tunnel (rows 30–32) under the block, hop the static pool (x14–17, 4 wide), stand under the shaft x24–27 (**rows 20–29 = 10 tiles**, sheer, no footing) → wall-jump up to the block top (row 20) → `ns_base.R` (rows 17–19). The upper gallery is walled off (x9–11 rows 1–19) from the arrival ledge, so the shaft is the only way.
7. **ns_climb → ns_rest → ns_plunge → rw_gate (WJ).** Right face: floor → shaft 1 (x28–31, rows 52–69, 18 tiles) → slab row 51 → shaft 2 (x36–39, rows 39–50) → right ledge row 37 (and `ns_climb.R`) → grates rows 33/29/25(c)/21 → ledge row 17 → shaft 3 (x42–45, rows 7–16) → crown → grate row 3 → `ns_climb.T`. Left face alternative: grate row 66 → crumble row 62 → grate row 58 → lift L1 (x9–11, rows 56→40) → ledge row 38 → crumbles rows 34/30 → ledge row 27 → wall-jump the slot x1–6 (rows 18–26) → ledge row 16 → grates rows 12/9/6/5 → grate row 3. ns_rest flat; `ns_rest.R` → ns_plunge is pure descent (the only rises are ≤ 3). `ns_plunge.B` hatch x14–16.
8. **rw_gate → rw_rest → rw_throne.** Flat gauntlet, flat rest, final arena.

### 3.4 Loops and shortcuts
* **Loop A (zones 1–2):** dc_cross → dc_shrine → dc_sentinel → lw_hoist → lw_belts → lw_shaft → dc_cross.L2. lw_shaft is climbed with DJ (floor → grate row 28 is a 6-tile DJ, or ride S1 from row 30 to row 10; grate row 9 → ledge row 5 is a 4-tile DJ). Returning the other way (dc_cross → lw_shaft) needs the 6-tile shelf (DJ). This is how the player returns to Driftcache for core 1 and core 3 without re-crossing boss 1's arena… and the arena itself is also open after the boss.
* **Loop B (zones 2–3):** lw_rest.B → bv_catwalk → bv_cistern → bv_sluice → lw_weftyr → lw_rest. bv_catwalk from above: the arrival ledge (row 4) feeds a crawlspace (rows 3–4) whose floor is missing over acid for 6 tiles (x15–20): DASH. Without dash the player falls in the acid and respawns on the ledge, which is a launch pad straight back up to lw_rest — no soft-lock, no sequence break. From below: chute auto-launch → grates rows 29/25/21/17 → grates rows 13/9 inside the right shaft (x27–30) → crawlspace right end (row 5) → dash the gap leftward → ledge → `bv_catwalk.T`.
* **Loop C (zone 4):** ns_climb → ns_rest → ns_plunge → `ns_plunge.L2` → ns_climb (mid-height right ledge). Lets the player reach the restore node and come back without re-climbing from the floor.
* lw_weftyr ↔ bv_sluice is two-way (bv_sluice shelf has a row-4 grate; lw_weftyr's hatch pocket is left via the 5-tall wall with DJ), so Loomworks' node (lw_rest) and core 2 are reachable from Brinevault without crossing the catwalk.

### 3.5 Hidden cores (+1 max HP each) and backtracking
| Core | Room / tile | Needs | Earliest | Route from where the ability is granted |
|---|---|---|---|---|
| 1 | `dc_loft` (27,12) | DJ | after boss 1 | dc_sentinel → dc_shrine → dc_cross: DJ onto the hanging slab (row 9, x54–60), grate row 6, grate row 2, up through `dc_cross.T`; in dc_loft cross the spikes (7 tiles: DJ gap 9, or the two crumble planks) to the pedestal. |
| 2 | `lw_belts` (93,6) | DASH | after boss 2 | lw_weftyr → lw_rest → lw_belts: grates row 10 (x73–76) and row 7 (x74–77) into the crawlspace (rows 5–6, ceiling row 4); dash the 6-tile floor gap (x84–89); the ledge x90–94 is 8 tiles above the floor with solid mass under it, so it cannot be reached from below. |
| 3 | `dc_fall` (24,4) | WJ | after boss 3 | bv_corrosant → bv_rest → bv_cistern → bv_catwalk (dash) → lw_rest → lw_belts → lw_shaft → dc_cross → dc_fall: from ledge B (row 14, x19–30) climb the sheer shaft x27–29 (rows 5–13, 9 tiles + the pocket) by wall jumping; the pocket (rows 2–4, x23–29) holds the core. |

All three require returning to an earlier zone with a later ability (core 1 the least, core 3 across three zones).

### 3.6 Restore nodes, vendor, boss arenas
* **Restore nodes (6):** dc_wake (5,12) · dc_shrine (9,14) · lw_rest (15,14) · bv_rest (15,13) · ns_rest (15,14) · rw_rest (9,14). Zones have 2/1/1/1/1 (Driftcache has two because it holds the start).
* **Vendor Scrivvet:** dc_shrine (21,14) and rw_rest (21,14) — the same character, same stock (section 7).
* **Boss arenas:** dc_sentinel (Tallock), lw_weftyr (Weftyr), bv_corrosant (Corrosant), rw_throne (Kernauth). On entering the fight bounds the listed exits are sealed (their opening tiles become `#`, drawn as a shutter dropping over 12 frames) until the boss dies; the boss intro (title card 150 frames, input ignored) plays once per fight; the seal lifts and never returns after the boss is defeated (saved).

### 3.7 Rooms
Order: zone by zone along the critical path. Each room lists exits, enemies, hazards, movers, nodes, cores, bits, then the full tilemap (`w` characters per row, exactly). "spawn (x,y)" is the arrival spawn tile per 1.2.

### `dc_wake` — Wake Cell

* **Zone:** Driftcache (Zone 1)  **Size:** 32×18 tiles (960×540 px)
* **On entering:** A low, dusty chamber. You lie on a raised dais of dead cache slabs; a restore node hums beside you. One patroller scrapes along the floor to the right; a single one-way shelf hangs over it with three bits.
* **New-game start tile:** (3,12) — player feet rest on the top of tile (3,13).
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `R` · right edge · rows 12–14 (x=31) · → `dc_fall.L` · **none** · spawn (29,14)
* **Enemies** (type · tile x,y · patrol x-range):
  * scuttlebit · (20,14) · patrol x 16–26 — tutorial patroller
* **Hazards:** none (see map).
* **Restore node:** tile (5,12) (stands on (5,13)).
* **Bits placed:** (19,10) small (1), (20,10) small (1), (21,10) small (1)
* **Tilemap** (32 cols × 18 rows; row 0 is the top):

```
################################
#.........###.......##.....#####
#.........###.......##.....#####
#...................##.....#####
#..........................#####
#..........................#####
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#.................-----........#
#.............B.................
########......B........B.....B..
##########....B........B.....B..
################################
################################
################################
```

### `dc_fall` — The Long Drop

* **Zone:** Driftcache (Zone 1)  **Size:** 32×54 tiles (960×1620 px)
* **On entering:** A tall shaft of stacked, sagging cache racks. Ledges alternate left and right down into dark. High on the right a sealed pocket glows faintly behind a smooth 9-tile shaft (core #3, wall-jump only).
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `L` · left edge · rows 2–4 (x=0) · → `dc_wake.R` · **none** · spawn (2,4)
  * `R` · right edge · rows 47–49 (x=31) · → `dc_cross.L` · **none** · spawn (29,49)
* **Enemies** (type · tile x,y · patrol x-range):
  * scuttlebit · (5,19) · patrol x 2–9
  * driftmoth · (16,18) · stationary / own logic
  * driftmoth · (14,30) · stationary / own logic
  * hopnode · (22,49) · patrol x 19–28
  * scuttlebit · (26,42) · patrol x 23–29
* **Hazards:** 12 floor-spike tiles, 5 ceiling-spike tiles, 6 crumble tiles (see map).
* **Hidden core:** tile (24,4).
* **Bits placed:** (14,7) small (1), (15,7) small (1), (13,23) medium (5), (2,35) small (1), (3,35) small (1), (28,3) large (20)
* **Tilemap** (32 cols × 54 rows; row 0 is the top):

```
################################
#.....................##########
......................#.......##
......................#.......##
......................#.......##
###########...........#####...##
###########...........#####...##
###########...........#####...##
#............----.....#####...##
#.....................#####...##
#.....................#####...##
#.....................#####...##
#.....................#####...##
#..................^^^#####...##
#..................#############
#..................#############
#..............................#
#..............................#
#....B.........................#
#....B.........................#
###########....................#
###########....................#
#..............................#
#..............................#
#...........----...............#
#............................B.#
#.......................^^^^.B.#
#.................##############
#.................##############
#..............................#
#..............................#
#.......ccc....................#
#..............................#
#..............................#
#.......B.....ccc..............#
#.......B......................#
#############..................#
#############..................#
#.vvvvv........................#
#..............................#
#...............----...........#
#..........................B...#
#..........................B...#
#.....................##########
#.....................##########
#..............................#
#.........----.................#
#...............................
#...............................
#...........^^^^^...............
################################
################################
################################
################################
```

### `dc_cross` — Crossrack Hall

* **Zone:** Driftcache (Zone 1)  **Size:** 64×18 tiles (1920×540 px)
* **On entering:** A wide hall of toppled server racks. Two spike pits break the floor; a mound of slabs rises mid-room. Up-left, a shelf 6 tiles high leads to an opening you cannot reach yet. Far right, a hanging slab with a turret guards two one-way shelves climbing to a hole in the ceiling.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `L` · left edge · rows 12–14 (x=0) · → `dc_fall.R` · **none** · spawn (2,14)
  * `L2` · left edge · rows 6–8 (x=0) · → `lw_shaft.R2` · **Echo Jump (double jump)** · spawn (2,8) — shelf is 6 tiles above the floor: single jump (3) fails, double jump (6) reaches
  * `R` · right edge · rows 12–14 (x=63) · → `dc_shrine.L` · **none** · spawn (61,14)
  * `T` · top edge · cols 56–58 (y=0) · → `dc_loft.B` · **Echo Jump (double jump)** · spawn (57,1) — hanging slab surface is 6 tiles above the floor; then two one-way shelves at rows 6 and 2
* **Enemies** (type · tile x,y · patrol x-range):
  * scuttlebit · (8,14) · patrol x 2–12
  * scuttlebit · (29,12) · patrol x 26–34
  * hopnode · (47,14) · patrol x 44–52
  * spitvalve · (57,8) · stationary / own logic — faces left, fires down-left arc
  * driftmoth · (37,6) · stationary / own logic
* **Hazards:** 9 floor-spike tiles (see map).
* **Bits placed:** (23,10) small (1), (24,10) small (1), (31,7) medium (5), (32,7) small (1), (4,8) medium (5), (57,5) small (1)
* **Tilemap** (64 cols × 18 rows; row 0 is the top):

```
########################################################...#####
#...................###.....................#######............#
#...................###.....................#######....-----...#
#..............................................................#
#..............................................................#
#..............................................................#
.......................................................-----...#
...............................................................#
..............................----.............................#
#########.............................................#######..#
#########.............................................#######..#
#.....................----.....................................#
..........B....---..................B...........B.............B.
..........B...............#########.B...........B.............B.
..........B...............#########.B...........B.............B.
##############.....#####################....####################
##############^^^^^#####################^^^^####################
################################################################
```

### `dc_loft` — The Loft

* **Zone:** Driftcache (Zone 1)  **Size:** 32×18 tiles (960×540 px)
* **On entering:** A cramped attic of racks, warm and silent. A pedestal on the right holds a pulsing core; between you and it a bed of spikes under two crumbling planks and a dropper clinging to the ceiling.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `B` · bottom edge · cols 14–16 (y=17) · → `dc_cross.T` · **none** · spawn (15,17) — drop into the chute; arrival from dc_cross is an auto-launch jump out of the chute
* **Enemies** (type · tile x,y · patrol x-range):
  * droplatch · (21,4) · stationary / own logic — drops when player is within 2 tiles horizontally
  * spitvalve · (29,8) · stationary / own logic — faces left
* **Hazards:** 7 floor-spike tiles, 4 crumble tiles (see map).
* **Hidden core:** tile (27,12).
* **Bits placed:** (19,10) small (1), (23,10) small (1), (2,14) medium (5)
* **Tilemap** (32 cols × 18 rows; row 0 is the top):

```
################################
################################
################################
################################
#....................B.........#
#....................B.........#
#..............................#
#..............................#
#..............................#
#...........................####
#...........................####
#..................cc..cc...####
#...B....B.....................#
#...B....B................###..#
#...B....B........^^^^^^^.###..#
##############...###############
##############...###############
##############...###############
```

### `dc_shrine` — Rackside Shrine

* **Zone:** Driftcache (Zone 1)  **Size:** 32×18 tiles (960×540 px)
* **On entering:** A hushed alcove lit by a restore node. Scrivvet the broker crouches by a toppled rack with wares spread on a cloth of cable. No enemies ever spawn here.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `L` · left edge · rows 12–14 (x=0) · → `dc_cross.R` · **none** · spawn (2,14)
  * `R` · right edge · rows 12–14 (x=31) · → `dc_sentinel.L` · **none** · spawn (29,14)
* **Enemies:** none (safe room).
* **Hazards:** none (see map).
* **Restore node:** tile (9,14) (stands on (9,15)).
* **Vendor (Scrivvet):** tile (21,14).
* **Bits placed:** (14,9) small (1), (16,9) small (1)
* **Tilemap** (32 cols × 18 rows; row 0 is the top):

```
################################
################################
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............B...............#
#..............B...............#
#...........-------............#
#....B...................B.....#
.....B...................B......
.....B...................B......
.....B...................B......
################################
################################
################################
```

### `dc_sentinel` — Sentinel Stack

* **Zone:** Driftcache (Zone 1)  **Size:** 48×18 tiles (1440×540 px)  **BOSS ARENA**
* **On entering:** A long gallery floored with fused slabs; two one-way shelves hang at mid-height. At the far right a 5-tile block rises to a dark doorway. The moment you cross the threshold the entrance seals and the stack of discs in the center stands up.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `L` · left edge · rows 12–14 (x=0) · → `dc_shrine.R` · **none** · spawn (3,14)
  * `R2` · right edge · rows 7–9 (x=47) · → `lw_hoist.L` · **Echo Jump (double jump)** · spawn (44,9) — block surface is 5 tiles above the floor
* **Enemies:** none (safe room).
* **Hazards:** none (see map).
* **Boss:** Tallock · fight bounds x 1–39 · sealed exits during fight: L · ability pickup appears at (20,14)
* **Tilemap** (48 cols × 18 rows; row 0 is the top):

```
################################################
################################################
################################################
#...................B..........................#
#...................B..........................#
#..............................................#
#..............................................#
#...............................................
#...............................................
#...............................................
#.......................................########
#.......----................----........########
........................................########
......B...........................B.....########
......B...........................B.....########
################################################
################################################
################################################
```

### `lw_hoist` — Hoist Gallery

* **Zone:** Loomworks (Zone 2)  **Size:** 32×36 tiles (960×1080 px)
* **On entering:** Rust-orange machinery towers above a floor of crackling static. Two chain hoists ride slowly up and down; moths drift between them. A single pillar with a chute in its crown is the only dry footing at the bottom.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `L` · left edge · rows 4–6 (x=0) · → `dc_sentinel.R2` · **none** · spawn (2,6)
  * `B` · bottom edge · cols 14–16 (y=35) · → `lw_belts.T` · **none** · spawn (15,35) — chute in the pillar crown
* **Enemies** (type · tile x,y · patrol x-range):
  * driftmoth · (16,13) · stationary / own logic
  * driftmoth · (9,27) · stationary / own logic
  * droplatch · (27,4) · stationary / own logic — hangs from the right ceiling block
* **Hazards:** 7 ceiling-spike tiles, 18 hazard-pool tiles (static) (see map).
* **Moving platforms** (id · width tiles · from (x,y) → to (x,y) · speed px/frame · end-wait frames; positions are the platform's top-left tile; it ping-pongs):
  * `H1` · 3×1 · (11,9) → (11,20) · 1.0 · 40
  * `H2` · 3×1 · (19,16) → (19,28) · 1.0 · 40
* **Bits placed:** (2,17) medium (5), (3,17) small (1), (26,13) small (1), (27,13) small (1), (25,21) medium (5)
* **Tilemap** (32 cols × 36 rows; row 0 is the top):

```
################################
#.......................########
#.......................########
#.......................########
............B..................#
............B..................#
............B..................#
##########.....................#
##########.....................#
#.vvvvvvv......................#
#...................B..........#
#...................B..........#
#..............................#
#..............................#
#.......................-----..#
#..............................#
#..............................#
#..............................#
#######........................#
#######........................#
#..............................#
#..............................#
#.....................##########
#.....................##########
#..............................#
#...B..........................#
#...B..........................#
#...B..........................#
#...........................B..#
#...........................B..#
#............#...#.............#
#............#...#.............#
#............#...#.............#
####~~~~~~~~~#...#~~~~~~~~~#####
##############...###############
##############...###############
```

### `lw_belts` — Belt Floor

* **Zone:** Loomworks (Zone 2)  **Size:** 96×18 tiles (2880×540 px)
* **On entering:** The widest hall in the kingdom: a factory floor three screens long. Two static pools are crossed on sliding belt-platforms. Plated walkers hold the middle mound, a ram-beast paces the far end, and high on the right a 2-tile crawlspace with a gap in its floor hides a glowing pedestal (core #2).
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `T` · top edge · cols 10–12 (y=0) · → `lw_hoist.B` · **none** · spawn (11,1) — falls onto the one-way shelf at row 4
  * `L` · left edge · rows 12–14 (x=0) · → `lw_shaft.R` · **none** · spawn (2,14)
  * `R` · right edge · rows 12–14 (x=95) · → `lw_rest.L` · **none** · spawn (93,14)
* **Enemies** (type · tile x,y · patrol x-range):
  * platewalker · (38,14) · patrol x 33–42
  * platewalker · (65,12) · patrol x 60–70
  * rambyte · (82,14) · patrol x 72–93
  * droplatch · (17,3) · stationary / own logic
  * droplatch · (57,3) · stationary / own logic
  * spitvalve · (49,8) · stationary / own logic — faces left, sits on the one-way shelf over pool 2
* **Hazards:** 24 hazard-pool tiles (static) (see map).
* **Moving platforms** (id · width tiles · from (x,y) → to (x,y) · speed px/frame · end-wait frames; positions are the platform's top-left tile; it ping-pongs):
  * `M1` · 3×1 · (21,12) → (28,12) · 1.5 · 20
  * `M2` · 3×1 · (45,12) → (52,12) · 2.0 · 20
* **Hidden core:** tile (93,6).
* **Bits placed:** (10,4) small (1), (12,4) small (1), (49,8) medium (5), (75,6) medium (5), (88,3) small (1)
* **Tilemap** (96 cols × 18 rows; row 0 is the top):

```
##########...###################################################################################
#...............###.................#####...............###....................................#
#...............###.................#####...............###....................................#
#..............................................................................................#
#.......-------.............................................................####################
#..............................................................................................#
#..............................................................................................#
#.........................................................................----######......######
#.........................................................................................######
#...............................................---.......................................######
#........................................................................----.............######
#.........................................................................................######
......B...........................B.......................B...........................B.........
......B...........................B.......................B.###########.B.............B.........
......B...........................B.......................B.###########.B.............B.........
####################~~~~~~~~~~~~############~~~~~~~~~~~~########################################
################################################################################################
################################################################################################
```

### `lw_shaft` — Spindle Shaft

* **Zone:** Loomworks (Zone 2)  **Size:** 32×36 tiles (960×1080 px)
* **On entering:** A vertical service shaft of hanging spools and one-way grates climbing out of sight. A slow hoist runs the left wall. At the very top a ledge leads left into the dark, back toward the Driftcache.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `R` · right edge · rows 31–33 (x=31) · → `lw_belts.L` · **none** · spawn (28,33)
  * `R2` · right edge · rows 2–4 (x=31) · → `dc_cross.L2` · **Echo Jump (double jump)** · spawn (28,4) — climb needs one 4-tile jump (row 9 shelf to row 5 ledge); reachable with double jump, which the player always has when in Loomworks
* **Enemies** (type · tile x,y · patrol x-range):
  * hopnode · (6,33) · patrol x 2–10
  * droplatch · (16,1) · stationary / own logic
  * driftmoth · (18,18) · stationary / own logic
  * hopnode · (24,4) · patrol x 21–25
* **Hazards:** 7 floor-spike tiles (see map).
* **Moving platforms** (id · width tiles · from (x,y) → to (x,y) · speed px/frame · end-wait frames; positions are the platform's top-left tile; it ping-pongs):
  * `S1` · 3×1 · (8,30) → (8,10) · 1.2 · 30
* **Bits placed:** (23,27) small (1), (14,23) small (1), (6,15) medium (5), (16,11) small (1), (28,4) large (20)
* **Tilemap** (32 cols × 36 rows; row 0 is the top):

```
################################
#.....................##########
#...............................
#...............................
#...............................
#...................############
#...................############
#..............................#
#........................B.....#
#.............-----......B.....#
#........................B.....#
#..............................#
#.............------...........#
#..............................#
#..............................#
#..............................#
#...------.....................#
#..............................#
#..............................#
#..............................#
#.....................-------..#
#..............................#
#..B...........................#
#..B...........................#
#...........------.............#
#..............................#
#..............................#
#..............................#
#...................-------....#
#..............................#
#...............B..............#
#...............B...............
#...............B...............
#...........^^^^^^^.............
################################
################################
```

### `lw_rest` — Spool Rest

* **Zone:** Loomworks (Zone 2)  **Size:** 32×18 tiles (960×540 px)
* **On entering:** A quiet mezzanine of stacked spools around a restore node. A grated hatch in the floor at the left (one-way grate: press down to drop through) leads down into green-lit dark.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `L` · left edge · rows 12–14 (x=0) · → `lw_belts.R` · **none** · spawn (2,14)
  * `R` · right edge · rows 12–14 (x=31) · → `lw_weftyr.L` · **none** · spawn (29,14)
  * `B` · bottom edge · cols 4–6 (y=17) · → `bv_catwalk.T` · **none** · spawn (5,17) — drop through the one-way grate at row 14; arrival from below is an auto-launch
* **Enemies:** none (safe room).
* **Hazards:** none (see map).
* **Restore node:** tile (15,14) (stands on (15,15)).
* **Tilemap** (32 cols × 18 rows; row 0 is the top):

```
################################
################################
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..........................B...#
#..........................B...#
#.........B....................#
..........B...........B.........
..........B...........B.........
....---...B...........B.........
####...#########################
####...#########################
####...#########################
```

### `lw_weftyr` — The Great Loom

* **Zone:** Loomworks (Zone 2)  **Size:** 48×18 tiles (1440×540 px)  **BOSS ARENA**
* **On entering:** A cathedral of threads strung wall to wall. Three one-way shelves hang at the same height. A 1-tile wall at the right screens a hatch in the floor. The loom shuttle overhead begins to spin as the entrance seals.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `L` · left edge · rows 12–14 (x=0) · → `lw_rest.R` · **none** · spawn (3,14)
  * `B` · bottom edge · cols 42–44 (y=17) · → `bv_sluice.T` · **none** · spawn (43,17) — hop the 1-wide wall at x=40 (5 tall: double jump) then drop into the hatch
* **Enemies:** none (safe room).
* **Hazards:** none (see map).
* **Boss:** Weftyr · fight bounds x 1–39 · sealed exits during fight: L, B · ability pickup appears at (20,14)
* **Tilemap** (48 cols × 18 rows; row 0 is the top):

```
################################################
################################################
################################################
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#.....----.........----.........----....#......#
#.......................................#......#
............B...........B...........B...#......#
............B...........B...........B...#......#
............B...........B...........B...#......#
##########################################...###
##########################################...###
##########################################...###
```

### `bv_sluice` — Sluice Run

* **Zone:** Brinevault (Zone 3)  **Size:** 64×18 tiles (1920×540 px)
* **On entering:** Pale green coolant drips from every pipe. You land on a high shelf that feeds a 2-tile crawlspace; its floor is missing for 6 tiles above an acid channel. Beyond, the run drops to a flooded floor patrolled by hoppers under a spiked slab, and a spitter on a raised pipe.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `T` · top edge · cols 2–4 (y=0) · → `lw_weftyr.B` · **none** · spawn (3,1) — lands on the shelf at row 8
  * `R` · right edge · rows 12–14 (x=63) · → `bv_cistern.L` · **Burst Line (dash)** · spawn (61,14) — gate is the 6-tile gap under the 2-tile ceiling at x15-20; falling in = acid, respawn on the shelf
* **Enemies** (type · tile x,y · patrol x-range):
  * brinejelly · (40,13) · stationary / own logic
  * brinejelly · (56,9) · stationary / own logic
  * hopnode · (38,14) · patrol x 31–46
  * spitvalve · (50,10) · stationary / own logic — faces left
* **Hazards:** 9 ceiling-spike tiles, 13 hazard-pool tiles (acid) (see map).
* **Bits placed:** (10,7) small (1), (12,7) small (1), (23,7) medium (5), (53,5) medium (5), (54,5) small (1)
* **Tilemap** (64 cols × 18 rows; row 0 is the top):

```
##...###########################################################
##...###########################################################
##...###########################################################
#........######################................................#
#.----...######################................................#
#........######################................................#
#.................................................-------......#
#..............................................................#
###############......##########...###########..................#
###############......##########...###########..................#
#########..........................vvvvvvvvv...................#
#########.......................................#####..........#
#########...................B.................B.............B...
#########...................B.................B.............B...
#########...................B.................B.............B...
############~~~~~~~~~~~~~#######################################
################################################################
################################################################
```

### `bv_cistern` — The Cistern

* **Zone:** Brinevault (Zone 3)  **Size:** 64×36 tiles (1920×1080 px)
* **On entering:** A cavern two screens tall, its floor an acid lake broken by five rock pillars. An upper gallery of one-way grates and a plated walker on a slab leads to a grate in the ceiling; the right bank holds a brood-cell and a rolling wheel. A high right ledge hides a cache.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `L` · left edge · rows 13–15 (x=0) · → `bv_sluice.R` · **none** · spawn (2,15)
  * `T` · top edge · cols 50–52 (y=0) · → `bv_catwalk.B` · **none** · spawn (51,1) — launch from the one-way grate at row 3
  * `R` · right edge · rows 30–32 (x=63) · → `bv_rest.L` · **none** · spawn (61,32)
* **Enemies** (type · tile x,y · patrol x-range):
  * brinejelly · (20,24) · stationary / own logic
  * brinejelly · (28,22) · stationary / own logic
  * brinejelly · (34,26) · stationary / own logic
  * platewalker · (39,11) · patrol x 34–44
  * scuttlebit · (50,32) · patrol x 42–60 — brinecrab variant
  * voltwheel · (56,32) · patrol x 42–61
  * broodcell · (47,32) · stationary / own logic — anchored to the right bank floor
  * droplatch · (22,4) · stationary / own logic
* **Hazards:** 27 hazard-pool tiles (acid), 4 crumble tiles (see map).
* **Bits placed:** (19,12) small (1), (27,9) small (1), (21,25) medium (5), (27,23) medium (5), (58,9) large (20), (60,9) medium (5), (5,32) small (1)
* **Tilemap** (64 cols × 36 rows; row 0 is the top):

```
##################################################...###########
##################################################...###########
##################################################...###########
#...................#####.......................-------........#
#..............................................................#
#..............................................................#
#..............................................................#
#...............B..............................................#
#...............B.............................---..............#
#...............B..............................................#
#.........................----.........B................########
#......................................B................########
#.................................###########..................#
..................----............###########..................#
...............................................................#
...............................................................#
###############................................................#
###############................................................#
#..............................................................#
#..............................................................#
#..............................................................#
#..............................................................#
#..............................................................#
#..............................................................#
#.........-------..........cc..................................#
#..............................................................#
#....................cc........................................#
#..............................................................#
#...................................##.........................#
#.......................##..........##.........................#
#.....B...........##....##..........##......B.............B.....
#.....B...........##....##....##....##......B.............B.....
#.....B...........##....##....##....##......B.............B.....
##############~~~~~~~~~~~~~~~~~~~~~~~~~~~#######################
################################################################
################################################################
```

### `bv_catwalk` — Drip Catwalk

* **Zone:** Brinevault (Zone 3)  **Size:** 32×36 tiles (960×1080 px)
* **On entering:** From a hatch above you land on a short ledge feeding a 2-tile crawlspace whose floor breaks over an acid trough. Past it a shaft drops into a lower hall where spikes line the ceiling, jellies drift, and a grate in the floor leads down to the Cistern.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `T` · top edge · cols 4–6 (y=0) · → `lw_rest.B` · **none** · spawn (5,1) — lands on the ledge at row 4; the ledge is a launch pad back up
  * `B` · bottom edge · cols 26–28 (y=35) · → `bv_cistern.T` · **Burst Line (dash)** · spawn (27,35) — from lw_rest the only way past the crawlspace gap is a dash; from bv_cistern, climbing to lw_rest also crosses the gap (dash)
* **Enemies** (type · tile x,y · patrol x-range):
  * brinejelly · (10,20) · stationary / own logic
  * brinejelly · (20,27) · stationary / own logic
  * droplatch · (18,13) · stationary / own logic
  * hopnode · (25,32) · patrol x 23–30
* **Hazards:** 11 ceiling-spike tiles, 21 hazard-pool tiles (acid) (see map).
* **Bits placed:** (11,4) small (1), (13,4) small (1), (28,8) medium (5), (20,16) small (1), (26,20) small (1), (3,32) large (20)
* **Tilemap** (32 cols × 36 rows; row 0 is the top):

```
####...#########################
#..............................#
#........#######################
#..............................#
#########......................#
###############......######....#
###############......######....#
###############~~~~~~######....#
###########################....#
###########################---.#
###########################....#
###########################....#
###########################....#
#.vvvvvvvvvvv..............---.#
#..............................#
#..............................#
#..............................#
#.................-----........#
#..............................#
#..............................#
#...B..........................#
#...B...................-----..#
#...B..........................#
#..............................#
#..............................#
#.................-----........#
#..............................#
#..............................#
#...........B..................#
#...........B...........-----..#
#...........B..........B.......#
#......................B.......#
#......................B.......#
########~~~~~~~~~~~~~~~###...###
##########################...###
##########################...###
```

### `bv_rest` — Still Basin

* **Zone:** Brinevault (Zone 3)  **Size:** 32×18 tiles (960×540 px)
* **On entering:** A dry basin above the acid line. A restore node glows green on a plinth. Pipes groan to the right where something heavy drags itself along the walls.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `L` · left edge · rows 12–14 (x=0) · → `bv_cistern.R` · **none** · spawn (2,14)
  * `R` · right edge · rows 12–14 (x=31) · → `bv_corrosant.L` · **none** · spawn (29,14)
* **Enemies:** none (safe room).
* **Hazards:** none (see map).
* **Restore node:** tile (15,13) (stands on (15,14)).
* **Tilemap** (32 cols × 18 rows; row 0 is the top):

```
################################
################################
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............B...............#
#..............B...............#
#....B..................B......#
.....B..................B.......
.....B..................B.......
.....B......#######.....B.......
################################
################################
################################
```

### `bv_corrosant` — Brine Keep

* **Zone:** Brinevault (Zone 3)  **Size:** 48×24 tiles (1440×720 px)  **BOSS ARENA**
* **On entering:** A tall vault whose walls weep acid. Three one-way grates hang mid-height; a hatch in the floor at the far right is sealed by a crust of brine. The Keeper uncoils from the ceiling as the door shuts.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `L` · left edge · rows 18–20 (x=0) · → `bv_rest.R` · **none** · spawn (3,20)
  * `B` · bottom edge · cols 42–44 (y=23) · → `ns_base.T` · **none** · spawn (43,23) — hatch unseals when the boss dies
* **Enemies:** none (safe room).
* **Hazards:** none (see map).
* **Boss:** Corrosant · fight bounds x 1–41 · sealed exits during fight: L, B · ability pickup appears at (22,20)
* **Tilemap** (48 cols × 24 rows; row 0 is the top):

```
################################################
################################################
################################################
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#.............------........------.............#
#..............................................#
#..............................................#
#..............................................#
#..............................................#
#.......------......--------......------.......#
#..............................................#
......B................B.................B.....#
......B................B.................B.....#
......B................B.................B.....#
##########################################...###
##########################################...###
##########################################...###
```

### `ns_base` — Spire Foot

* **Zone:** Nullspire (Zone 4)  **Size:** 32×36 tiles (960×1080 px)
* **On entering:** Violet dark, white static crawling on every edge. You land on a ledge at the top of a sheer left-hand well; one-way grates zigzag back up it. At the bottom a 3-tile tunnel runs under a huge black block; in its ceiling a smooth 10-tile shaft rises to a sealed upper gallery (wall-jump gate).
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `T` · top edge · cols 2–4 (y=0) · → `bv_corrosant.B` · **none** · spawn (3,1) — lands on the row-4 ledge, which is also the launch pad back up
  * `R` · right edge · rows 17–19 (x=31) · → `ns_climb.L` · **Grip Protocol (wall cling/jump)** · spawn (29,19) — the only way onto the block top (row 20) is the 10-tile shaft at x24-27 (rows 20-29); double jump reaches 6
* **Enemies** (type · tile x,y · patrol x-range):
  * glarewisp · (5,14) · stationary / own logic
  * glarewisp · (5,24) · stationary / own logic
  * droplatch · (20,30) · stationary / own logic
  * scuttlebit · (18,19) · patrol x 13–23 — static-shot variant on the block top
* **Hazards:** 4 hazard-pool tiles (static) (see map).
* **Bits placed:** (4,12) small (1), (4,20) small (1), (22,31) medium (5), (14,18) medium (5), (29,18) small (1)
* **Tilemap** (32 cols × 36 rows; row 0 is the top):

```
##...###########################
#........#######################
#........###...................#
#........###...................#
############...................#
############...................#
#........###...................#
#........###...................#
#........###................B..#
#.-----..###................B..#
#........###....B...........B..#
#........###....B..............#
#........###....B..............#
#..-----.###....B..............#
#........###...................#
#........###...................#
#........###...................#
#.-----..###....................
#........###....................
#........###....................
#........###############....####
#..-----.###############....####
#........###############....####
#........###############....####
#........###############....####
#.-----..###############....####
#........###############....####
#........###############....####
#........###############....####
#..-----.###############....####
#..............................#
#....B.........................#
#....B........~~~~.............#
################################
################################
################################
```

### `ns_climb` — The Null Spire

* **Zone:** Nullspire (Zone 4)  **Size:** 48×72 tiles (1440×2160 px)
* **On entering:** The empty interior of an inverted spire, four screens tall. A black spine splits it: the left face is crumbling grates and a slow lift; the right face is three sheer shafts stacked over a pit of static. Wisps hunt in the dark. Both faces meet at a crown of one-way grates under a hole in the sky.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `L` · left edge · rows 67–69 (x=0) · → `ns_base.R` · **none** · spawn (2,69)
  * `R` · right edge · rows 34–36 (x=47) · → `ns_plunge.L2` · **Grip Protocol (wall cling/jump)** · spawn (45,36) — reached from the top of shaft 2 (right ledge row 37)
  * `T` · top edge · cols 40–42 (y=0) · → `ns_rest.B` · **Grip Protocol (wall cling/jump)** · spawn (41,1) — launch from the one-way grate at row 3 (reached via shaft 3 or the left-face crown)
* **Enemies** (type · tile x,y · patrol x-range):
  * voltwheel · (12,69) · patrol x 1–25
  * glarewisp · (14,45) · stationary / own logic
  * glarewisp · (36,30) · stationary / own logic
  * glarewisp · (30,8) · stationary / own logic
  * droplatch · (38,53) · stationary / own logic
  * spitvalve · (4,26) · stationary / own logic — faces right
  * droplatch · (44,19) · stationary / own logic
* **Hazards:** 2 floor-spike tiles, 12 hazard-pool tiles (static), 14 crumble tiles (see map).
* **Moving platforms** (id · width tiles · from (x,y) → to (x,y) · speed px/frame · end-wait frames; positions are the platform's top-left tile; it ping-pongs):
  * `L1` · 3×1 · (9,56) → (9,40) · 1.5 · 30
* **Bits placed:** (40,66) large (20), (41,66) medium (5), (5,65) small (1), (13,61) medium (5), (4,37) small (1), (3,15) medium (5), (40,50) small (1), (37,24) medium (5), (44,20) small (1), (23,5) large (20)
* **Tilemap** (48 cols × 72 rows; row 0 is the top):

```
########################################...#####
#..............................................#
#..............................................#
#.....................................-------..#
#..............................................#
#.............................------...........#
#...................--------...................#
#.......................................##.....#
#.......................................##.....#
#.............-----.....................##.....#
#.....................####....B.........##.....#
#.....................####....B.........##.....#
#......#-----.........####....B.........##.....#
#......##.............####..............##.....#
#......##.............####..............##.....#
#......##.............####..............##.....#
#########.............####............^^##.....#
#########.............####............##########
#......##.............####............##########
#......##.............####.....................#
#......##.............####.....................#
#......##.............####................-----#
#......##.............####.....................#
#......##.............####.....................#
#......##.............####.....................#
#......##.............####..........ccc........#
#......##.............####.....................#
#########.............####.....................#
#########.............####.....................#
#.....................####................-----#
#................ccc..####.....................#
#.....................####.....................#
#.....................####.....................#
#.....................####..........-----......#
#...........ccc.......####......................
#.....................####......................
#.....................####......................
#.....................####....######....########
#########.............####....######....########
#########.............####........##....##.....#
#.....................####........##....##.....#
#.....................####........##....##.....#
#.....................####........##....##.....#
#.....................####........##....##.....#
#.....................####........##....##..B..#
#...B.................####........##....##..B..#
#...B.................####........##....##.....#
#.....................####........##....##.....#
#.....................####........##....##.....#
#.....................####........##....##.....#
#.............B.......####........##....##.....#
#.............B.......####......############cc##
#.............B.......######....############..##
#.....................######....##.............#
#.....................######....##.............#
#.....................######....##.............#
#.....................######....##.............#
#.....................######....##.............#
#..----...............######....##.............#
#.....................######....##.............#
#.....................######....##.............#
#.........................##....##.............#
#...........ccc...........##..B.##.............#
#.........................##..B.##.............#
#.........................##....##.............#
#.........................##....##.............#
#...-----.................##....##.............#
..........................##....##......##.....#
..........................##....##......##.....#
..........................##....##......##.....#
##################################~~~~~~~~~~~~##
################################################
```

### `ns_rest` — Crown Rest

* **Zone:** Nullspire (Zone 4)  **Size:** 32×18 tiles (960×540 px)
* **On entering:** The open crown of the spire under a sky of static. A restore node sits among broken antenna-spires. The grate you climbed through is at the left; the far wall opens on a long plunge.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `B` · bottom edge · cols 4–6 (y=17) · → `ns_climb.T` · **none** · spawn (5,17) — one-way grate cap at row 14; arrival is an auto-launch
  * `R` · right edge · rows 12–14 (x=31) · → `ns_plunge.L` · **none** · spawn (29,14)
* **Enemies:** none (safe room).
* **Hazards:** none (see map).
* **Restore node:** tile (15,14) (stands on (15,15)).
* **Tilemap** (32 cols × 18 rows; row 0 is the top):

```
################################
################################
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#.........................B....#
#.........................B....#
#.........B...............B....#
#.........B....................#
#.........B.........B...........
#.........B.........B...........
#...---...B.........B...........
####...#########################
####...#########################
####...#########################
```

### `ns_plunge` — The Plunge

* **Zone:** Nullspire (Zone 4)  **Size:** 32×54 tiles (960×1620 px)
* **On entering:** A sheer drop down the outside of the spire. Ledges hold shallow static pools; droppers cling under every overhang; wisps rise to meet you. A side door mid-way leads back into the spire. The floor at the bottom funnels into a hatch lit red from below.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `L` · left edge · rows 2–4 (x=0) · → `ns_rest.R` · **none** · spawn (2,4)
  * `L2` · left edge · rows 20–22 (x=0) · → `ns_climb.R` · **none** · spawn (2,22) — ledge at row 23
  * `B` · bottom edge · cols 14–16 (y=53) · → `rw_gate.T` · **none** · spawn (15,53) — hatch in the floor
* **Enemies** (type · tile x,y · patrol x-range):
  * droplatch · (24,17) · stationary / own logic
  * droplatch · (22,32) · stationary / own logic
  * glarewisp · (8,14) · stationary / own logic
  * glarewisp · (16,36) · stationary / own logic
  * broodcell · (10,49) · stationary / own logic — anchored left of the chute
  * hopnode · (28,29) · patrol x 19–30
* **Hazards:** 20 ceiling-spike tiles, 23 hazard-pool tiles (static), 6 crumble tiles (see map).
* **Bits placed:** (15,8) small (1), (16,8) small (1), (14,26) medium (5), (6,34) small (1), (18,44) medium (5), (3,49) large (20)
* **Tilemap** (32 cols × 54 rows; row 0 is the top):

```
################################
#...........####################
............####################
...............................#
...............................#
###########....................#
###########....................#
#..............................#
#..............................#
#.............----.............#
#.........................B....#
#.........................B....#
#...................ccc........#
#..............................#
#.....................~~~~~....#
#.................##############
#.................##############
#...................vvvvvvvvv..#
#..............................#
#..............................#
.....B.........................#
.....B.........................#
...............................#
#########......................#
#########......................#
#..............................#
#..........................B...#
#...........----...........B...#
#..............................#
#...................~~~~~......#
#.................##############
#.................##############
#..................vvvvvvvvvvv.#
#..............................#
#..............................#
#...-----......................#
#..............................#
#..............................#
#..B........ccc................#
#..B...........................#
#...~~~~.......................#
###########....................#
###########....................#
#..............................#
#..............................#
#...............-----..........#
#...........................B..#
#...........................B..#
#..............................#
#...................~~~~~~~~~..#
##############...###############
##############...###############
##############...###############
##############...###############
```

### `rw_gate` — Root Gate

* **Zone:** Rootwell (Zone 5)  **Size:** 48×18 tiles (1440×540 px)
* **On entering:** Crimson dark and gold filament. Great cable-roots thick as pillars hang from the ceiling. Every corrupted form of the kingdom stands guard here: plated walkers, a ram-beast, spitters on a pedestal and a hanging grate, a brood-cell by the wall.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `T` · top edge · cols 14–16 (y=0) · → `ns_plunge.B` · **none** · spawn (15,1) — lands on the one-way grate at row 3
  * `R` · right edge · rows 12–14 (x=47) · → `rw_rest.L` · **none** · spawn (45,14)
* **Enemies** (type · tile x,y · patrol x-range):
  * platewalker · (10,14) · patrol x 4–18
  * platewalker · (32,14) · patrol x 28–38
  * rambyte · (40,14) · patrol x 28–45
  * spitvalve · (23,10) · stationary / own logic — faces left
  * spitvalve · (33,7) · stationary / own logic — faces right
  * broodcell · (3,14) · stationary / own logic — anchored by the left wall
  * droplatch · (40,2) · stationary / own logic
* **Hazards:** none (see map).
* **Bits placed:** (14,2) small (1), (16,2) small (1), (23,10) medium (5), (33,7) medium (5), (44,14) large (20)
* **Tilemap** (48 cols × 18 rows; row 0 is the top):

```
##############...###############################
##############...###############################
#.....B.....................B.............B....#
#.....B.....-------.........B.............B....#
#.....B.....................B.............B....#
#.....B.....................B.............B....#
#.....B...................................B....#
#.........................................B....#
#.............................-------..........#
#..............................................#
#..............................................#
#...................#######....................#
#...................#######.....................
#...............................................
#...............................................
################################################
################################################
################################################
```

### `rw_rest` — Last Light

* **Zone:** Rootwell (Zone 5)  **Size:** 32×18 tiles (960×540 px)
* **On entering:** A pocket of calm in the root-mass. The restore node here burns gold. Scrivvet has followed you all the way down and will not say how. Beyond the far door the floor thrums.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `L` · left edge · rows 12–14 (x=0) · → `rw_gate.R` · **none** · spawn (2,14)
  * `R` · right edge · rows 12–14 (x=31) · → `rw_throne.L` · **none** · spawn (29,14)
* **Enemies:** none (safe room).
* **Hazards:** none (see map).
* **Restore node:** tile (9,14) (stands on (9,15)).
* **Vendor (Scrivvet):** tile (21,14).
* **Tilemap** (32 cols × 18 rows; row 0 is the top):

```
################################
################################
################################
#..............................#
#..............................#
#..............................#
#..............................#
#..............................#
#..............B...............#
#..............B...............#
#...........-------............#
#....B...................B.....#
.....B...................B......
.....B...................B......
.....B...................B......
################################
################################
################################
```

### `rw_throne` — The Rootwell

* **Zone:** Rootwell (Zone 5)  **Size:** 64×24 tiles (1920×720 px)  **BOSS ARENA**
* **On entering:** A vast chamber around a sunken well of light. Cable-roots converge on a throne at the back wall where a crowned, seated mass waits. Two low grates flank the floor and one high grate hangs over the well. The door seals behind you.
* **Exits** (id · edge · tile range · → target.exit · ability · arrival spawn tile):
  * `L` · left edge · rows 18–20 (x=0) · → `rw_rest.R` · **none** · spawn (3,20)
* **Enemies:** none (safe room).
* **Hazards:** none (see map).
* **Boss:** Kernauth · fight bounds x 1–62 · sealed exits during fight: L · final boss, no pickup
* **Tilemap** (64 cols × 24 rows; row 0 is the top):

```
################################################################
################################################################
################################################################
#..............................................................#
#..............................................................#
#..............................................................#
#..............................................................#
#..............................................................#
#.............................BBBB.............................#
#.............................BBBB.............................#
#...........................--------...........................#
#..............................................................#
#..............................................................#
#..............................................................#
#..............................................................#
#.........------................................------.........#
#..............................................................#
#.............................BBBB.............................#
..............................B..B.............................#
........B.....................B..B.....................B.......#
........B.....................B..B.....................B.......#
################################################################
################################################################
################################################################
```

## 4. Enemy roster

### 4.0 Shared rules
* Sizes are hit-box width×height in px; the sprite may overdraw by up to 4 px. Enemies stand with their hit-box bottom on the tile listed in the room's placement (tile (x,y) is the tile their feet occupy; they stand on (x,y+1)). Flyers are centred on the listed tile.
* **Contact damage** is in hearts and applies when the enemy's hit-box overlaps the player's and the player has no i-frames; the player gets 60 i-frames and a 5 px/frame knockback away from the enemy for 10 frames.
* **Hurt:** on taking damage an enemy flashes white for 6 frames, enters HURT for 10 frames (no movement, no attack), and is knocked back 3 px/frame for those 10 frames (except Voltwheel, Broodcell, Spitvalve, Platewalker-while-guarding). Enemies never damage each other.
* **Death:** 14-frame burst of 8 particles in the enemy's accent colour, drops bits per the roster (6.2), 8-frame hitstop on the killing blow.
* Enemies ignore `~` pools and `^`/`v` spikes. Walkers turn around at patrol bounds, walls, and ledge edges (no floor tile under their leading edge). Patrol bounds are inclusive tile x values.
* The player's **down-strike** bouncing off an enemy deals the down-strike damage and counts as a hit "from above" for Platewalker.
* **Zone variants** change only what the variant line says; everything else is inherited.
* All numbers in frames at 60 Hz. Damage reference: a light hit deals 3, so an enemy with HP 6 dies to 2 lights, HP 9 to 3, HP 12 to 4, HP 15 to 5 (or 2 heavies), HP 18 to 6, HP 21 to 7.

### 4.1 SCUTTLEBIT — patroller
* **Zones:** Driftcache (base), Brinevault (Brinecrab), Nullspire (Static-shot), Rootwell (Rootbound).
* **Size** 26×18 · **HP** 6 · **Contact** 1 · **Bits** 2 (two small) · **Speed** 1.0 px/frame.
* **State machine:** `PATROL` (walk facing direction; on reaching a patrol bound, wall, or ledge edge → `TURN`) · `TURN` (6 frames, stopped, sprite flips on frame 3 → `PATROL`) · `HURT` (10) → `PATROL`.
* **Attack tells:** none; it is pure contact.
* **Visual:** a flat oval shell (ellipse 26×14) on six stubby legs (3 short lines each side, alternating 2-frame walk), two antenna dots that bob. Colours shell `#8fb6e8`, underside `#2a3a5c`, eye dots `#ffffff`. ~12 canvas ops.
* **Variants:** *Brinecrab* (Brinevault): HP 9, speed 1.4, shell `#4fae84`, underside `#0d2a20`. *Static-shot* (Nullspire): HP 9, speed 1.1, shell `#7a4fb8`; every 90 frames drops a 1-tile static spark at its feet that lasts 45 frames and deals 1 contact. *Rootbound* (Rootwell): HP 12, speed 1.2, bits 3, shell `#b32a2a`, outline glow `#ffcf5a`.

### 4.2 HOPNODE — hopper
* **Zones:** Driftcache, Loomworks, Brinevault, Nullspire.
* **Size** 24×24 · **HP** 9 · **Contact** 1 · **Bits** 3 (three small) · **Speed** hop vx 2.5 px/frame, vy −7.5 (gravity 0.45).
* **State machine:** `IDLE` (30 frames; faces the player if within 8 tiles) · `CROUCH` (12 frames: squash to 24×16, tell) · `HOP` (airborne ≈ 34 frames; direction = toward player if within 8 tiles else alternate; clamps to patrol bounds by reversing direction at a bound) · `LAND` (8 frames, stretch 20×28 on frame 1) → `IDLE`. `HURT` (10) → `IDLE`. Hopping into a wall stops horizontal motion.
* **Attack tells:** the 12-frame squash.
* **Visual:** a rounded cube (rounded rect 22×22, r 6) on two coiled spring legs (zig-zag lines, compress during CROUCH), a single large lens (circle r 6) with a highlight. Colours body `#b8733a`, lens `#ffb24a`, outline `#2e1a0e`. ~14 ops.
* **Variants:** Brinevault *Dripnode*: lens `#a8ffcf`, body `#1d4d3a`, HP 12. Nullspire *Nullnode*: hop vy −9.0 (higher), body `#2b1848`.

### 4.3 DRIFTMOTH — sine flyer
* **Zones:** Driftcache, Loomworks (base); Brinevault variant **Brinejelly**.
* **Size** 22×16 · **HP** 6 · **Contact** 1 · **Bits** 2 · **Speed** 1.2 px/frame horizontal.
* **Behaviour:** `FLY`: moves horizontally at 1.2 px/frame, y = spawnY + 45·sin(t·2π/90) px (amplitude 1.5 tiles, period 90 frames); reverses when 6 tiles from spawn x or on touching a wall. Never tracks the player. `HURT` (10, pushed back) → `FLY`.
* **Attack tells:** none.
* **Visual:** diamond body (4-point polygon 10×16), two triangular wings whose y-scale = sin(t·2π/12) (flap), two antenna lines. Colours body `#2a3a5c`, wings `#8fd3ff`, outline `#6c86b8`. ~10 ops.
* **Variant — Brinejelly (Brinevault):** size 20×24, HP 9, bits 3; moves **vertically** at 0.8 px/frame with x = spawnX + 30·sin(t·2π/120), reversing 4 tiles from spawn y or at tiles. Visual: a dome (half-circle r 10) with three dangling strands (wavy lines 12 px) and a glow; colours dome `#a8ffcf`, strands `#4fae84`, glow `#0d2a20`.

### 4.4 GLAREWISP — chase flyer
* **Zones:** Nullspire (base), Rootwell variant.
* **Size** 20×20 · **HP** 9 · **Contact** 1 · **Bits** 3 · **Speed** max 3.0 px/frame, accel 0.12 px/frame².
* **State machine:** `DRIFT` (hover at spawn, bob ±6 px over 80 frames; player within 9 tiles → `LOCK`) · `LOCK` (20 frames: brightens to white, emits an expanding ring, tell) · `CHASE` (150 frames: steer toward player centre: v += 0.12·normalize(toPlayer), |v| ≤ 3.0; passes through nothing: collides with `#` like a bouncing ball, reflecting velocity ×0.5) · `TIRED` (60 frames: moves toward spawn at 1.0 px/frame, dimmed, takes ×2 damage) → `DRIFT`. `HURT` (10) → continues previous state.
* **Attack tells:** the LOCK flash and ring; a faint whine (sine 1200→1800 Hz over 20 frames).
* **Visual:** a bright eye-orb (circle r 8 with pupil r 3 that looks at the player) with a tail of 3 fading circles at its last positions (r 5, 4, 3). Colours core `#e8e0ff`, halo `#7a4fb8`, pupil `#0a0612`. ~9 ops.
* **Variant — Rootwisp (Rootwell):** HP 12, max speed 3.4, core `#ffcf5a`, halo `#b32a2a`.

### 4.5 SPITVALVE — turret / spitter
* **Zones:** Driftcache, Loomworks (base); Brinevault *Acid valve*; Rootwell *Twin valve*.
* **Size** 30×30 · **HP** 12 · **Contact** 1 · **Bits** 5 (one medium) · **Speed** 0 (stationary; facing fixed by placement).
* **Projectile (glob):** 10×10, launched from the nozzle at vx = ±3.2 px/frame (facing), vy = −3.0, gravity 0.15 px/frame²; damage 1; lifetime 150 frames; destroyed on touching `#`/`-`/`c`. The player can destroy a glob with any attack (it pops, no bits, fills 2 overclock points).
* **State machine:** `SCAN` (player within 11 tiles horizontally in the facing half-plane and within ±5 tiles vertically → `CHARGE`) · `CHARGE` (30 frames: nozzle swells 1.0→1.4 scale, ticking sound every 6 frames, tell) · `FIRE` (1 frame: spawn glob; recoil 4 px for 6 frames) · `COOL` (75 frames) → `SCAN`. `HURT` (10) interrupts CHARGE (restarts it afterwards).
* **Attack tells:** the 30-frame nozzle swell + ticking.
* **Visual:** a squat valve body (rounded rect 30×22 at the base), a pipe nozzle (rect 14×8 pointing in facing), a pressure dial (circle r 5 with a needle that sweeps during CHARGE), two bolt dots. Colours body `#5a3519`, nozzle `#b8733a`, dial `#ffb24a`. ~13 ops.
* **Variants:** *Acid valve* (Brinevault): glob leaves a 1-tile-wide, 6-px-tall acid puddle where it lands for 90 frames (hazard, damage 1, no respawn-teleport); body `#1d4d3a`, nozzle `#4fae84`. *Twin valve* (Rootwell): fires two globs, the second 20 frames after the first with vx ±2.4; COOL 60; body `#4d1018`, nozzle `#b32a2a`, dial `#ffcf5a`.

### 4.6 RAMBYTE — charger
* **Zones:** Loomworks (base), Rootwell *Rootram*.
* **Size** 40×28 · **HP** 18 · **Contact** 1 while pacing/stunned, **2** while charging · **Bits** 6 (one medium + one small) · **Speed** pace 0.8 px/frame, charge 6.0 px/frame.
* **State machine:** `PACE` (walk within patrol; player within 10 tiles horizontally and ±2 tiles vertically and in front → `SPOT`) · `SPOT` (24 frames: scrapes a foot — 3 dust puffs, head lowers; tell) · `CHARGE` (6.0 px/frame in facing direction; ends on hitting a wall or patrol bound → `STUN`; ends when the player is ≥ 3 tiles behind it → `BRAKE`) · `STUN` (45 frames: stars above head, takes ×1.5 damage, no contact damage increase) → `PACE` · `BRAKE` (20 frames, skids 8 px) → `PACE`. `HURT` during CHARGE does not stop the charge (it is armoured: knockback 0) but still deals damage.
* **Attack tells:** the 24-frame foot scrape + dust.
* **Visual:** low wedge body (polygon: a long trapezoid 40×20 with the front taller), a plated ridge (3 short arcs along the back), a blunt ram head (rect 10×14 at the front), four leg stubs (walk cycle 4 frames). Colours body `#5a3519`, plates `#b8733a`, ram head `#ffb24a`. ~15 ops.
* **Variant — Rootram (Rootwell):** HP 24, charge 7.0, SPOT 18 frames; colours body `#4d1018`, plates `#b32a2a`, head `#ffcf5a`.

### 4.7 PLATEWALKER — shielded
* **Zones:** Loomworks, Brinevault (base); Rootwell *Rootplate*.
* **Size** 30×36 (body) + shield 8×36 in front · **HP** 15 · **Contact** 1 · **Bits** 6 (one medium + one small) · **Speed** 0.7 px/frame.
* **Shield rule:** an attack whose hit-box centre is on the shield side of the Platewalker's centre x (and the shield is up) is **blocked**: 0 damage, "clank" SFX, a spark, the player is pushed back 3 px/frame for 8 frames, and the hit grants only 25% of its normal overclock gain. A **heavy** attack from the front **guard-breaks**: `STAGGER` (30 frames, shield swings down, knockback 4 px/frame for 6 frames) → `OPEN` (60 frames, shield down, takes normal damage from any side) → `WALK`. Hits from behind or from above (down-strike) always deal full damage.
* **State machine:** `WALK` (patrol at 0.7; turns toward a player who has been behind it within 4 tiles for 30 consecutive frames; player within 3 tiles in front → `BASH`) · `BASH` (tell 18 frames: shield raised 6 px; then lunge 2 tiles at 4 px/frame over 14 frames, shield deals 1 contact; recovery 24 frames) → `WALK` · `STAGGER`/`OPEN` as above. `HURT` (10) only when not guarding.
* **Attack tells:** the 18-frame shield raise.
* **Visual:** a tall rectangular plate (rect 8×36 with 3 rivet dots) held in front by two short arms, a stubby cylindrical body (rounded rect 24×22) with a single visor slit, two legs. Colours plate `#b8733a`, body `#5a3519`, visor `#ffb24a`. ~14 ops.
* **Variant — Rootplate (Rootwell):** HP 21, OPEN 45 frames; plate `#b32a2a`, body `#4d1018`, visor `#ffcf5a`.

### 4.8 BROODCELL — swarm spawner
* **Zones:** Brinevault (base), Nullspire, Rootwell.
* **Size** 36×36 · **HP** 21 · **Contact** 1 · **Bits** 8 (one medium + three small) · **Speed** 0 (anchored to the floor).
* **Motes:** 10×10, HP 3, contact 1, bits 1, lifetime 420 frames, speed 2.2 px/frame toward the player with a wobble (perpendicular sine amplitude 8 px, period 30 frames); fly through nothing (reflect off `#` ×0.5); max **6** alive per Broodcell; when the Broodcell dies all its living motes pop (no bits).
* **State machine:** `DORMANT` (player within 10 tiles → `PULSE`) · `PULSE` (40 frames: swells 1.0→1.25, pores brighten; tell) · `SPAWN` (30 frames: emits one mote on frames 0, 15, 30 from a random pore, each launched upward at 3 px/frame for 10 frames before homing) · `REST` (180 frames) → `PULSE` (skips SPAWN if 6 motes alive). Never moves; `HURT` has no knockback.
* **Attack tells:** the 40-frame swell.
* **Visual:** a lumpy sac (circle r 16 with 3 overlapping circles r 8 for lumps), three glowing pores (circles r 3), four root tendrils into the floor (short curved lines). Colours sac `#1d4d3a`, lumps `#0d2a20`, pores `#a8ffcf`. Nullspire: sac `#2b1848`, pores `#e8e0ff`. Rootwell: sac `#4d1018`, pores `#ffcf5a`, HP 27. Motes: a filled circle r 5 in the pore colour with a 2-circle trail. ~15 ops.

### 4.9 DROPLATCH — ceiling dropper
* **Zones:** Driftcache, Loomworks, Brinevault, Nullspire, Rootwell (universal; colours follow the zone's tile outline/accent).
* **Size** 26×22 · **HP** 9 · **Contact** 1, **2** during `DROP` · **Bits** 3 · **Speed** drop gravity 0.6 px/frame², scuttle 1.6 px/frame, climb 2.0 px/frame.
* **State machine:** `CLING` (hangs under a `#` tile, eyes closed; player's x within 2 tiles and below it → `ALERT`) · `ALERT` (18 frames: eyes open, body twitches ±2 px; tell) · `DROP` (falls with gravity 0.6 until it lands on footing; contact 2) · `SPLAT` (12 frames: squash 30×14, 4 dust particles) · `SCUTTLE` (120 frames: walks toward the player at 1.6, turning at ledges; contact 1) · `CLIMB` (rises straight up at 2.0 px/frame until its top touches a `#` tile, then → `CLING` there; if it rises 20 tiles without a ceiling it clings to the first `#` tile it touches from the side) · `HURT` (10) → previous state (a hit during CLING knocks it into `DROP` immediately).
* **Attack tells:** the 18-frame twitch with open eyes.
* **Visual:** a hanging teardrop (circle r 11 with a pointed top, drawn upside-down), a latch hook on top (small arc), two eyes (closed = lines, open = circles), three claws at the bottom (short lines). Colours body = zone tile outline, eyes = zone accent, claws = zone tile fill. ~13 ops.

### 4.10 VOLTWHEEL — bouncer
* **Zones:** Brinevault, Nullspire (base), Rootwell.
* **Size** 28×28 · **HP** 12 · **Contact** 1 · **Bits** 5 (one medium) · **Speed** 2.4 px/frame rolling.
* **State machine:** `ROLL` (moves horizontally at 2.4; reverses on walls or patrol bounds; rolls off ledges and keeps rolling after landing; every 150 frames, if the player is above it within 4 tiles horizontally → `HOP`) · `HOP` (vy −6.0, keeps vx; lands → `ROLL`). Immune to knockback; `HURT` (6 frames flash only). Leaves a spark particle every 4 frames.
* **Attack tells:** a 10-frame bright flash before `HOP`.
* **Visual:** a spoked wheel (circle r 13, 6 spokes rotating with distance travelled: angle = x / 13), a bright rim (stroke 3 px), an arc of static jumping between two spokes. Colours rim `#e8e0ff`, spokes `#7a4fb8`, static `#ffffff`. Brinevault: rim `#a8ffcf`, spokes `#4fae84`. Rootwell: rim `#ffcf5a`, spokes `#b32a2a`, speed 2.8. ~11 ops.

---

## 5. Bosses

### 5.0 Shared boss rules
* A boss fight starts when the player's hit-box centre enters the arena's fight bounds (x range in tiles, listed per arena room). Sequence: exits seal (12 frames) → intro title card (150 frames: boss name line 1, epithet line 2, boss plays its idle/roar, player input ignored, boss music starts) → fight.
* Boss HP bar: bottom of the screen, 600 px wide, drains with a 20-frame lag ghost. Bosses have **no i-frames**: every hit counts, but attacks listed as "armoured" ignore knockback and are not interrupted.
* Damage reference: light hit 3, heavy 6, special 8–10, Overclock multiplies by 1.5. The fight-length estimates assume a balanced fighter landing ~1.6 light hits per second during punish windows and taking 0–3 hits total.
* Boss contact damage (touching the body) is 1 heart unless an attack says otherwise. Boss projectiles and hazards obey the same 60 i-frames as enemies.
* **Enrage** triggers once, when HP first drops to or below the listed threshold: 45-frame roar (boss invulnerable, screen shake 6 px), palette shifts toward the zone accent, then the listed changes apply for the rest of the fight.
* **Defeat:** boss HP ≤ 0 → 10-frame hitstop, the death animation listed, bits burst (6.3), then the ability module floats to the pickup tile and bobs (±4 px, 60-frame period) until touched. Touching it: 120-frame **pickup sequence** — screen darkens to 40%, the module orbits the player twice, a card shows the ability name and its one-line control hint, SFX chord; the ability is granted, the seal lifts, the save is written. Boss music fades to the zone ambient over 120 frames.
* Death animations and pickup cards are fully skippable after 30 frames with any key.

### 5.1 TALLOCK — Warden of the Stack (boss 1, `dc_sentinel`)
* **Arena:** `dc_sentinel`, fight bounds x 1–39, floor row 15, two grates at row 11 (x8–11, x28–31). Sealed exit: `L`. Pickup tile (20,14).
* **HP 120** · **Size** 90×120 (hit-box) · **Phases:** 1 (+ enrage) · **Ground boss**, walks at 1.5 px/frame, cannot jump except in Stack Slam. Starts at x=25 tiles (centre), facing the player.
* **Intro title card:** `TALLOCK` / `WARDEN OF THE STACK`.
* **Pattern:** after each attack's recovery, `WALK` toward the player for 45 frames, then choose: player within 3 tiles → Slab Swing (60%) or Stomp Quake (40%); 3–6 tiles → Stomp Quake (50%) or Stack Slam (50%); > 6 tiles → Disc Toss (70%) or Stack Slam (30%). Never the same attack three times in a row.

| Attack | Tell (frames) | Active | Damage | Recovery | Movement / how to punish |
|---|---|---|---|---|---|
| **Slab Swing** | 30: raises the near slab-arm, arm rim glows accent | 12: arc hit-box 70×60 in front, sweeping top→bottom | 1 | 40 | Stationary. Punish: step behind it during the swing (it does not turn for 40 frames) and hit the back; or down-strike its top disc from a grate. |
| **Stomp Quake** | 36: rises 20 px onto its base disc's edge, dust ring | lands: two shockwaves (30×20 each) run left and right along the floor at 5 px/frame, lifetime 80 | 1 each | 50 | Stationary. Jump the wave (it is 20 px tall) or stand on a row-11 grate. Punish: 50 frames of recovery at melee range. |
| **Disc Toss** | 24: the top disc spins up (visible rotation, rising whir) | fires one disc 30×10 at 4.5 px/frame horizontal, vy −4, gravity 0.2; bounces once on the floor (vy ×−0.6), dies on the second contact or after 150 frames | 1 | 30 | Stationary. The disc can be destroyed by any attack. Punish: close in while the disc is in the air. |
| **Stack Slam** | 40: crouches (height ×0.8), base disc glows | jumps to the player's x recorded at tell end: 50-frame arc (vy −11, gravity 0.44, vx set to arrive); landing shock 40×30 on each side for 10 frames | 2 (shock), 1 (body while airborne) | 60 | Big movement. Dodge: move 3+ tiles from the recorded x during the arc. Punish: the longest window — 60 frames while the stack wobbles; heavy attacks here. |

* **Enrage at HP ≤ 36:** walk 2.2 px/frame, all tells −6 frames, Disc Toss fires two discs (second 15 frames later, vx ×0.8), Stomp Quake waves 6.5 px/frame, WALK gap 30 frames.
* **Reward:** death animation 90 frames — discs drop one by one from the top with a thud and a 4-px shake each, the base disc cracks open revealing the module. Module → pickup tile (20,14). Card: `ECHO JUMP` / `Press Jump again while airborne`. `L` unseals (and `R2` was never sealed: it is simply unreachable without the ability).
* **Visual:** a tower of six flat discs of decreasing width (ellipses 90, 84, 78, 72, 66, 60 wide × 18 tall, stacked with 2-px gaps so the stack visibly wobbles), two slab-arms (rects 16×50, hanging from the third disc, swinging with walk cycle), a single horizontal visor slit (rect 30×6) on the top disc that glows. Colours: discs `#2a3a5c`, disc rims `#6c86b8`, visor/glow `#8fd3ff`, arm slabs `#15213a`. Silhouette: tall tapering stack with two hanging bars; nothing round-bodied or humanoid. ~20 ops.
* **Fair fight length:** ~65 s (120 HP; ~55% of the fight is punish windows).

### 5.2 WEFTYR — The Shuttle That Would Not Stop (boss 2, `lw_weftyr`)
* **Arena:** `lw_weftyr`, fight bounds x 1–39, floor row 15, three grates at row 10 (x6–9, 19–22, 32–35). Sealed exits: `L`, `B` (the chute mouth tiles (42..44,17) become `#`). Pickup tile (20,14).
* **HP 180** · **Size** 110×50 (long horizontal spindle; hit-box 110×40) · **Phases:** 1 (+ enrage) · **Flying boss**, cruises at 3 px/frame between attack positions, ignores tiles except room bounds.
* **Intro:** `WEFTYR` / `THE SHUTTLE THAT WOULD NOT STOP`.
* **Pattern:** fixed cycle with random start: Thread Dash → Snare Line → Needle Rain → Thread Dash → Spool Spin → repeat; between attacks it `CRUISE`s 40 frames to the next start position. While a Snare Line exists it may only Thread Dash.

| Attack | Tell | Active | Damage | Recovery | Movement / punish |
|---|---|---|---|---|---|
| **Thread Dash** | 30: parks at the left or right arena edge at the player's current y (clamped rows 4–13), a taut thread line is drawn across the arena at that y, flickering | crosses the arena at 12 px/frame (≈100 frames), hit-box 110×40 | 1 | 36: hovers at the far edge, drooping to y = row 12 | Dodge: change height (jump or drop) once the thread stops flickering (frame 30). Punish: it droops within melee reach at the far edge for 36 frames. |
| **Snare Line** | 24: hovers at the arena centre, both blade-arms spread | lays a horizontal thread at y = row 12 top (8 px tall) across x 1–39 that persists 240 frames; contact = 1 | 1 | 20 | The line blocks ground movement across the arena: jump it or use the grates. Punish: it hovers low at centre for the 20-frame recovery and the following Thread Dash tell. |
| **Needle Rain** | 40: rises to row 3 at centre, shudders; six needle silhouettes blink at random x (≥ 2 tiles apart) above the arena | six needles (8×24) fall at 7 px/frame from row 0 at the marked x; each sticks in the floor as a 1-tile hazard for 90 frames | 1 (falling or stuck) | 50: descends to row 11 at centre | Dodge: stand between marks. Punish: 50 frames at row 11 — reachable from the centre grate or with an air attack. |
| **Spool Spin** | 30: a shadow ellipse appears on the floor at the player's x; the shuttle rotates to vertical | drops to the floor at that x and spins for 60 frames: hit-box 130×60, drifting toward the player at 2 px/frame | 1 | 60: lies on the floor, dizzy stars | Dodge: get 3+ tiles from the shadow or onto a grate. Punish: 60 frames on the floor = the best window; heavies and specials here. |

* **Enrage at HP ≤ 54:** Thread Dash becomes a **double pass** (after 20 frames at the far edge it dashes back at the player's new y, re-telling for only 15 frames), Needle Rain throws nine needles, cruise 4.5 px/frame, tells −5 frames.
* **Reward:** death animation 90 frames — the shuttle spins out of control, its thread unspools around the arena (drawn as loosening coils), then it drops and snaps in half. Card: `BURST LINE` / `Press Dash to lunge 5 tiles — once in the air`. `L` and `B` unseal.
* **Visual:** a long pointed spindle (polygon 110×30: pointed both ends, thicker at the centre), a bobbin at the centre (three concentric ellipses with diagonal thread hatching), two curved blade-arms (arcs, stroke 4) that fold during Thread Dash and spread during Snare Line, a single red lens near the front, a trailing thread (line to its last 4 positions). Colours: body `#5a3519`, blades `#b8733a`, thread/bobbin `#ffb24a`, lens `#ff5a3a`. Silhouette: a horizontal needle with two wings. ~22 ops.
* **Fair fight length:** ~95 s.

### 5.3 CORROSANT — Keeper of the Brine (boss 3, `bv_corrosant`)
* **Arena:** `bv_corrosant`, fight bounds x 1–41, floor row 21 (24 tall arena), grates at row 16 (x8–13, 20–27, 34–39) and row 11 (x14–19, 28–33). Sealed exits: `L`, `B` (hatch tiles (42..44,21..23) become `#` as a brine crust). Pickup tile (22,20).
* **HP 240** (shared by all segments) · **Size** head 50×40 + 7 body segments 30×30 following at 24-px spacing (total ≈ 260 px) · **Phases:** 1 (+ enrage with Flood) · **Surface crawler**: moves along the floor, walls and ceiling at 3.5 px/frame, head leading, body following the head's path. Hits on the head deal ×1.5; hits on segments ×1.
* **Intro:** `CORROSANT` / `KEEPER OF THE BRINE`.
* **Pattern:** chosen by where it is: on a wall → Wall Lunge (70%) or crawl to ceiling (30%); on the ceiling → Acid Spit (50%) or Ceiling Drip (50%); on the floor → Coil Sweep (100%), then crawl to a wall. Between attacks it `CRAWL`s 60–90 frames to the next surface position (telegraphed by direction).

| Attack | Tell | Active | Damage | Recovery | Movement / punish |
|---|---|---|---|---|---|
| **Wall Lunge** | 30: head rears back 20 px from the wall, jaw opens, three acid drops fall | lunges horizontally across the arena at 10 px/frame to a length of up to 14 tiles, head hit-box 50×40, body segments trail (1 contact) | 2 (head), 1 (body) | 40: retracts to the wall at 5 px/frame, body stretched across the arena | Dodge: jump over the lunge (the head is at the height it reared from; it picks the player's y ±1 tile at tell start). Punish: during the 40-frame retract the stretched body is hittable all along the floor/air; hit the head for ×1.5. |
| **Acid Spit** | 24: throat segment glows accent | spits three globs (10×10) at vx −3/0/+3 px/frame, vy +2, gravity 0.2; each leaves a 2-tile-wide acid puddle (6 px tall) for 180 frames (hazard 1, no teleport) | 1 | 30: hangs still on the ceiling | Dodge: stand between the three impact spots (they land ~4 tiles apart). Punish: with the player on a row-11 grate the head on the ceiling (rows 1–2) is within an air attack. |
| **Ceiling Drip** | 36: crawls to the player's x on the ceiling, body shudders; ten drip silhouettes blink below it across a 6-tile span | ten drips (6×12) fall at 6 px/frame, one every 6 frames, at random x in the span | 1 | 40: head droops 2 tiles down from the ceiling | Dodge: leave the 6-tile span. Punish: the drooping head reaches row 4 — hit it from a row-11 grate with jump attacks (×1.5). |
| **Coil Sweep** | 40: drops to the floor at the arena's left or right end and coils (segments bunch up) | sweeps the floor to the other end at 5 px/frame, body hit-box 1 tile tall along its whole length | 1 | 50: lies stretched along the floor | Dodge: be on any row-16 grate. Punish: 50 frames with the whole body on the floor — down-strikes from the grate chain into ground combos. |

* **Enrage at HP ≤ 72 — Flood:** roar 90 frames; then every 420 frames the arena's floor row (row 20, the tile row above the solid floor) becomes acid for 120 frames (drawn rising over 20 frames; hazard, −1 HP, respawn on the nearest row-16 grate instead of the exit). Tells −8 frames, crawl 4.5 px/frame, Acid Spit puddles last 240 frames.
* **Reward:** death animation 120 frames — segments burst into bubbles from tail to head, the head sinks into a spreading puddle that dries into the module. Card: `GRIP PROTOCOL` / `Hold toward a wall in the air to cling — Jump to kick off`. `L` unseals; the brine crust over the hatch cracks (tiles (42..44,21..23) return to `.`).
* **Visual:** a flat triangular head (polygon 50×40, point forward) with a wide underslung jaw (second polygon that hinges open), four small eye dots in a row, seven body segments (rounded squares 30×30, each with a dorsal fin triangle), drip particles from every third segment. Colours: head `#1d4d3a`, segments `#0d2a20`, fins/eyes `#a8ffcf`, acid/jaw interior `#4fae84`. Silhouette: a long segmented line ending in a wedge, hugging the room edges. ~24 ops.
* **Fair fight length:** ~120 s.

### 5.4 KERNAUTH — The Root Process (final boss, `rw_throne`, 2 phases)
* **Arena:** `rw_throne`, fight bounds x 1–62, floor row 21, grates row 15 (x10–15, x48–53) and row 10 (x28–35). Sealed exit: `L`. No pickup: victory sequence (section 8).
* **Intro (phase 1):** `KERNAUTH` / `THE ROOT PROCESS`. **Phase 2 card (60 frames, during the transition):** `KERNAUTH` / `UNBOUND`.

#### Phase 1 — Kernauth, Seated
* **HP 200** · **Size** 150×180 seated mass, centre x = tile 32 (960 px), bottom on the floor; stationary. Weak point: the **chest core**, a 60×60 hit-box centred at (960, rows 14–15); hits elsewhere on the mass deal ×0.5.
* **Pattern:** every 50 frames of `IDLE` (cables sway, core pulses) pick: Cable Sweep (35%), Root Spikes (30%), Orbital Flare (20%), Summon (15%, only if < 4 motes alive). Never the same twice in a row.

| Attack | Tell | Active | Damage | Recovery | Dodge / punish |
|---|---|---|---|---|---|
| **Cable Sweep** | 30: one cable-arm (left or right, the side the player is on 75% of the time) twitches and glows along its length | the cable extends along the floor to the wall at 8 px/frame (hit-box 1 tile tall × its length), holds 10 frames, retracts over 20 | 1 | 30 | Jump over the cable tip as it passes, or stand on a grate. Punish: during the 30-frame recovery the core is exposed and the near cable is idle. |
| **Root Spikes** | 40: five floor spots glow (one at the player's x, four random, all ≥ 3 tiles apart) | spikes erupt 1 tile tall at the spots for 30 frames | 1 | 30 | Move off the marks (≥ 1 tile). Punish: the core during recovery. |
| **Orbital Flare** | 30: three orbs form in the crown | three 16-px orbs launch at 2.5 px/frame toward the player, homing with ≤ 1° turn/frame for 180 frames; HP 3 each (any hit pops them) | 1 | 30 | Pop them or out-run them (their turn rate loses a jumping player). |
| **Summon** | 30: the core darkens | two Motes (as 4.8) spawn from the crown; max four alive | 1 (mote) | 20 | Kill motes on the row-10 grate with air attacks. |

* At HP 0: **transition, 180 frames** — the mass splits down the middle, the crowned core rises to row 6, the throne collapses into the well (the `B` props at rows 17–20 burst into particles, the floor stays), screen shakes 8 px, phase 2 card. Player is invulnerable for the transition.

#### Phase 2 — Kernauth, Unbound
* **HP 240** · **Size** 70×70 flying core with a crown of five spikes and a 100-px cable tail (tail contact 1) · flies at 4 px/frame, ignores tiles except room bounds.
* **Pattern:** fixed loop with random start: Dive Bomb → Static Beam → Fragment Burst → Blink Slam → Static Beam → repeat; 40-frame `HOVER` between attacks (it hovers at row 5–7, moving toward the player's x at 2 px/frame).

| Attack | Tell | Active | Damage | Recovery | Dodge / punish |
|---|---|---|---|---|---|
| **Dive Bomb** | 30: rises 1 tile, a dotted aim line to the player's current position (locked at tell end) | dives at 13 px/frame to that point; on reaching the floor or the point: impact shock 90×30 for 10 frames | 2 (shock), 1 (body) | 50: sits on the floor, crown dimmed | Move 3+ tiles from the lock point. Punish: 50 frames on the floor — the main damage window. |
| **Static Beam** | 40: moves to the left or right wall at the player's y (locked at tell start, clamped rows 4–19), a thin guide line spans the arena | a beam 20 px tall across the full arena for 40 frames | 1 per contact (60 i-frames) | 40: drifts to row 8 | Change height (jump over / drop under). Punish: air attacks from the row-10 grate while it drifts at row 8. |
| **Fragment Burst** | 24: crown spikes fold inward | eight fragments (10 px) in a ring at 3.5 px/frame, lifetime 120 | 1 | 30 | Stand so a gap in the ring passes you (gaps are 45°); or shield with a heavy (destroys fragments). Punish: it hovers still for 30 frames at rows 5–7 — reachable from the centre grate. |
| **Blink Slam** | 12 fade-out + 20: reappears 5 tiles above the player, crown spins | slams down at 14 px/frame; landing shock 120×30 for 10 frames | 2 (shock) | 45 | Dash sideways during the 20-frame reappearance. Punish: 45 frames on the floor. |

* **Enrage at HP ≤ 60 — Panic Loop:** the HOVER gap is removed (attacks chain directly), Static Beam fires **twice** (the second at the player's new y, 30 frames apart, 15-frame tell), tells −8 frames, flight 5.5 px/frame, the tail grows to 160 px.
* **Defeat:** section 8 (victory sequence). No ability module.
* **Visual, phase 1:** a seated mass (rounded trapezoid 150×180 with a slight lean), a crown of seven spikes (triangles) on top, two cable-arms (thick wavy strokes, 12 px, with three knot circles each) resting on the floor to either side, the chest core (circle r 30 with a five-point star inside, pulsing scale 0.9–1.1 at 1 Hz), a lattice of thin lines across the mass. Colours: mass `#4d1018`, cables `#2a080c`, core `#ffcf5a`, crown `#b32a2a`. Silhouette: a crowned seated mountain with two arms on the floor.
* **Visual, phase 2:** the core (circle r 35 with the star, plus an inner white-hot circle r 14 `#fff4d6`), the five crown spikes orbiting it at radius 46 (rotation 2°/frame), a cable tail of six fading circles following its path. Same colours. Silhouette: a spiked sun with a tail.
* **Fair fight length:** phase 1 ~85 s + transition 3 s + phase 2 ~95 s ≈ **3 min**.

---

## 6. Pickups and drop rules

### 6.1 Pickup types
| Pickup | Effect | Draw | Size | Physics / lifetime |
|---|---|---|---|---|
| **Bit, small** | +1 bit | filled hexagon, zone accent colour, 1-px outline | 8 px | scatters with vx ±(1.5–3.0), vy −4, gravity 0.3, bounces ×0.5 on tiles; after 20 frames it is magnetised toward the player within 60 px at 4 px/frame; dropped bits expire after 600 frames (blink the last 120); bits **placed in a map** never expire and are one-time (saved per tile). |
| **Bit, medium** | +5 bits | hexagon with an inner ring | 12 px | same |
| **Bit, large** | +20 bits | hexagon with inner ring and a glow | 16 px | same |
| **Heart** | heals 1 HP (no effect at max HP, still consumed) | rounded "cell" shape (rect 10×14 with a notch) in `#ff5a7a` | 14 px | same scatter, no magnet, lifetime 600 |
| **Energy orb** | +25 energy (special-attack meter, max 100 / 125 with Spare Cell) | circle with a smaller orbiting dot, `#8fd3ff` | 10 px | same scatter, magnet 60 px, lifetime 600 |
| **Overclock shard** | +10% Overclock meter | thin diamond, `#ffcf5a`, spins | 8×16 px | same scatter, magnet 60 px, lifetime 600 |

### 6.2 Enemy drops
* On death every enemy drops its listed **bits** split into coins: 1 → 1 small; 2 → 2 small; 3 → 3 small; 5 → 1 medium; 6 → 1 medium + 1 small; 8 → 1 medium + 3 small; 12 → 2 medium + 2 small. (Rule: as many mediums as fit while leaving the remainder as smalls.)
* **Heart:** chance = 0 at full HP; otherwise 12% + 8% per missing heart, capped at 40%. Rolled once per kill (motes never drop hearts).
* **Energy orb:** 25% per kill when the player's energy < 50%, else 5%. Motes never drop orbs.
* **Overclock shard:** 8% per kill; **guaranteed** one shard from Rambyte, Platewalker, Broodcell and Voltwheel, in addition to the roll.
* Destroyed projectiles drop nothing (globs grant 2 Overclock points when popped). Motes drop 1 small bit.
* Hazard kills (an enemy pushed into nothing — they ignore hazards) cannot happen; enemies only die to the player.

### 6.3 Boss drops
Tallock 60 bits (3 large) · Weftyr 100 bits (5 large) · Corrosant 140 bits (7 large) · Kernauth none (victory). Boss bits never expire until collected or the room is left.

### 6.4 Economy
* Bits placed in maps total (computed from the room data): **331**. Clearing every enemy in every room once yields **239** (motes excluded); bosses add 300. A thorough first playthrough collects roughly 700–900 bits; a critical-path rush about 350.
* Bits persist through death (no corpse mechanic). The HUD shows the count top-left with a 12-frame bump on pickup.

---

## 7. Vendor — Scrivvet

* **Who:** a jittery data-broker: a hunched figure the size of the player, wrapped in a cloak of cable scraps, with a lantern-eye on a stalk and six small hands that never stop sorting. Colours: cloak `#2a3a5c`, hands/stalk `#6c86b8`, lantern-eye `#ffcf5a`. Idle: hands shuffle (3-frame loop), eye tracks the player.
* **Where:** `dc_shrine` tile (21,14) and `rw_rest` tile (21,14). Same stock and purchase state in both (one-time purchases, saved).
* **Interaction:** stand within 1 tile and press Up/Interact: a shop panel lists the three items with price, a one-line effect, and `SOLD` once bought. Up/Down selects, Jump/Confirm buys, Back closes. Buying: bits bump down, chime, item line greys out.
* **Lines (original; shown above the panel, random per opening):** "Everything down here was somebody's, once. Now it's mine. Now it's yours." · "You pay in bits because that's all that's left to pay in." · "The deeper you go, the cheaper I get. Don't ask why I'm down here." Can't afford: "Come back heavier." Sold out: "Nothing left you'd want. Nothing left I'd sell."

| Item | Price | Effect |
|---|---|---|
| **Spare Cell** | 90 bits | Max energy 100 → 125; energy orbs fill +25 as before (so specials can be used one more time per refill). |
| **Hot Clock** | 160 bits | Overclock meter gains ×1.5 from landed hits and shards. |
| **Deep Ping** | 120 bits | The map screen reveals every room of every zone the player has set foot in, marks all restore nodes, and marks each **uncollected** hidden core with a `?` on its room. |

---

## 8. Victory

### 8.1 Sequence (after Kernauth phase 2 reaches 0 HP)
1. 10-frame hitstop, then **240-frame finale**: the core cracks along the star (lines spread 1 px/frame), the crown spikes fall and shatter on the floor one by one (every 20 frames, 4-px shake each), the well at the arena's centre brightens from `#ffcf5a` to white over 120 frames, the cable-roots on the walls go dark from the bottom up, music resolves to a single held F# major chord.
2. White-out (60 frames) → **epilogue** card: text appears line by line (one line per 90 frames; any key advances), zone 5 far-background colour behind, 1-px gold frame.
3. **Stats screen** (any key from the epilogue): title `RUN COMPLETE`, then rows: `Time` (h:mm:ss of play time, pauses excluded) · `Deaths` · `Bits collected` (lifetime, not current) · `Fighter` (name + small portrait) · `Cores found x/3` · `Rooms discovered x/23` · `Enemies purged` · `Bosses` (4/4). Below: `Press any key`. Returns to the Title screen.
4. The save is marked **complete**: `Continue` places the player in `rw_rest` with Kernauth defeated and the `rw_throne` seal open; the throne room is empty and quiet (no music, well glowing white); all other content remains explorable (cores, vendor).

### 8.2 Epilogue text (original)
> The Root Process let go.
>
> For the first time since the kingdom was buried, nothing below is holding on to anything above. The racks in Driftcache settle a final inch. The looms run down and stop. The brine goes still. The spire, with no address left to answer, forgets to hang there, and simply ends.
>
> You are a program with nothing left to run. You stay anyway, in the quiet, where the light from the well reaches the ceiling for the first time.
>
> It is enough.

---
