# GDD-01 — THE WORLD (maps, tiles, encounters)

Chapter 1 of the full GDD (GDD-00 §17). It turns GDD-00 §2–§5 and §16 into data: the tile kinds every map paints with, the conventions every map file follows, the 24 maps (Pellwick authored, the rest stubbed for their authors), the curve regions and the encounter tables. GDD-00 wins over this file; ids come from `GDD-ids.md` / `js/data/ids.manifest.js` and are never invented here.

| File | What | Status |
|---|---|---|
| `js/data/tilesets.js` | `TILESETS` (TileDef rows), `TILES` by id, `DEFAULT_LEGEND`, `ART_REQUESTS` | authored (167 tile kinds, 89 legend chars) |
| `js/data/maps/index.js` | `MAPS` in MAP_IDS order, `MAPS_BY_ID` | authored |
| `js/data/maps/pellwick.js` | the hub, 64×48 | **authored** (§5) |
| `js/data/maps/lowmoor.js` … `rimeholt.js` | the six isles, 48×32 each | **authored** (§15.1–§15.6) |
| `js/data/maps/the-bar.js` | the Bar, 64×24 | **authored** (§15.7) |
| `js/data/maps/int-*.js`, `spire-*.js`, `hollis-gate.js`, `keepers-hall.js`, `idris-hall.js`, `lantern-stack.js` | the 6 town interiors (the cottage by tier), the 6 Spires, the 4 Summit/stack rooms | **authored** (Part B, §11–§14) |
| `js/data/regions.js` | `REGIONS` (9 curve regions) | authored (§4) |
| `js/data/encounters/index.js` | `ENCOUNTERS` merged from region files | authored |
| `js/data/encounters/pellwick.js` | reed edges, reach hooks, the lit point | authored (§6) |
| `js/data/encounters/isles.js` | the 12 isle tables, the Bar's pools, the Lantern Stack perch | **authored** (§6.3) |
| `test/data.world.test.mjs` | validator + manifest + loadMap + Pellwick, isle, Bar and isle-encounter checks | green |
| `tools/map-reachability.mjs` | the world prover: BFS over `world/tilemap` + `clockSys.tideWindow` from the cottage door, warps followed (§17) | **50/50 claims** |
| `test/data.world.reach.test.mjs` | the proof, plus the cast / §12 / trainer-post / porch / tree / encounter-band audit (§17) | green |
| `tools/map-preview.mjs` | every map to `test/out/maps/<id>.png` through the real renderer (colour-per-tile fallback) | tool |

`js/data/index.js` is the orchestrator's: it swaps `./placeholder/world.js` for these modules (`TILESETS` from `tilesets.js`, `MAPS` from `maps/index.js`, `ENCOUNTERS` from `encounters/index.js`, `REGIONS` from `regions.js`).

---

## 1. Map conventions (every map file follows these)

**1.1 Shape.** One map per file, `export default` a MapDef (ARCHITECTURE §4.1/§14.4, typedef at the top of `js/data/index.js`). `kind` is `'exterior'` or `'interior'` (Spires and Summit rooms are `'interior'`; the validator knows only those two). 16 px tiles; the view is 30×17 tiles, so a map smaller than that is letterboxed.

**1.2 Layers.** `ground` is required everywhere (no `.` in it). `detail` holds the things that stand *on* a ground tile — trees `8`/`9`, rocks `o`, fences `|` and gates `/`, hedges, bushes, crates, barrels, bollards, lamp posts `L`, bean rows, gorse, glasswort, seaweed — with `.` for none. A non-solid detail tile (seaweed, glasswort, a gate) leaves `tide` and `water` undefined so the ground beneath decides passability (seaweed on the flats still floods). `overlay` is for crowns and eaves the renderer cannot derive; leave it `null` unless needed. No `collision` layer unless an interior needs invisible walls: passability comes from the tiles.

**1.3 Legends.** Every map inherits `DEFAULT_LEGEND` (§2.2). A map's `legend` may add or override chars; say so in the file header. Pellwick overrides five chars it never paints otherwise (`?` the Keeper's roof, `x` the Old Quay, `d` Barnaby's porthole, `n` net racks, `j` creels).

**1.4 Buildings.** South-facing, painted in tiles: a roof block (any roof char; the renderer autotiles ridge, eaves and ends from the block's shape), two wall rows (windows on the upper, door + windows on the lower), a door tile, and a porch row of `_` in front of the door when the house has a porch. The lamp cell is the wall tile beside the door. Roof colours carry `roof:` ROOF_COLOUR_IDS; the Keeper's Cottage uses `roof-keeper` (`roofFrom: 'player'`, slate-blue default).

**1.5 Named spots: `markers`.** Every map has a `markers` object `{name: {x, y, facing?, ...}}` naming every NPC post, home door, porch step, shop counter, schedule spot and story staging point, so the cast (GDD-06) and story (GDD-07) chapters place people by name and never by raw coordinates. Names are kebab-case: `<npc>-<place>` for posts (`wren-yard`), `porch-<house>-step` / `door-<house>` for every porch, and the beat's noun for staging (`starter-sloshkin`, `reeds-stance`, `bell-dig`). A marker stands on walkable ground reachable from the entry at high tide, except when flagged: `tide: 'low'` (reachable at low water), `spring: true` (only at a spring low), `onSolid: true` (Dimity in the lamp, the Thatch on the roof, the piling), `water: true` (Maud's punt). Two markers may share a cell.

**1.6 Story zones: `regions`.** Story step triggers are the story chapter's (they reference SCRIPT_IDS that land with GDD-07), so this chapter stages them with named `regions` rects (`arrival-causeway`, `starter-stones`, `the-reeds`, `first-orchard`, `point-flats`, `old-quay` …). GDD-07 adds `{kind: 'step', id, x, y, w, h, script, once, cond}` triggers over them. Map-owned triggers here are `use` triggers with verbs only (mailbox, gate boards, crate, porch bench, Commons board and Jar, yard counter, ferry, tide board, shops, `knock` on every neighbour door).

**1.7 Doors and warps.** Interior doors: the door tile on the exterior warps (`kind: 'door'`) to the interior's arrival cell; every interior's door sits centred in its bottom wall at `(floor(w/2), h-1)` and its arrival cell is `(floor(w/2), h-2)`; the interior's door warps back to the exterior porch step (the cell below the exterior door). Edges (`kind: 'edge'`) cross between exterior maps. **Short ways are tile-gated, never warp-gated**: the stones, causeways and the Bar road are `tide:'low'` tiles, so the warp at their far end is reachable only when they are dry (the validator warns "not reachable at high tide" for these, by design). A warp carries `via` (`short-way` / `long-way` / `the-bar`) and, for gated ones, `tideWindow` (and `lowerLow` / `openFlag` for the Bar) as documentation for the map screen.

**1.8 Waystones** are entities `{kind: 'prop', id: <WAYSTONE id>, art: 'waystone', waystone: true, x, y}` plus a `use` trigger on the same cell with `verb: 'waystone'`; their tide chalkboard is a `tide-chalkboard` prop beside them. Skyglass nodes are `{kind: 'prop', id: 'node-<isle>', art: 'skyglass', node: true}` + `use` verb `chip`.

**1.9 Trees** are entities `{kind: 'tree', id: 'tree-<slug>', name, x, y, art, zone}` (the base tile; the 32×32 crown overhangs right and up). Fruit trees carry `fruitFrom: 'native'` (the seed picks the town's one native fruit, GDD-00 §9; see §8.2); purse trees `purse: true` (art `tree-purse`); bee trees `hive: 'honeycomb'` (art `tree-bee`). Every tree has a reachable neighbour; trees stand at least two tiles apart (Chebyshev) so an orchard grid always leaves lanes.

**1.10 Porches** are entities `{kind: 'prop', id: <PORCH id>, porch: true, art: 'porch-lamp', x, y (the lamp cell), step, door, house, litAtStart, litBy}`; the lighting pass lights a porch from its world state. Seven are `litAtStart` (GDD-00 §4); the others name what lights them (`loan-1`, `f1`, `f9`, `family-letter`, `commons-project`, `relighting` with `reopensNight` 1–7).

**1.11 Gathering and fishing data on the map** (read by `systems/gather` and `systems/fishing`): `town: true` (no wild except spawns marked `reeds: true`), `reaches: [{id, kind, area, creatureTable?, nightKind?, cond?, shadows?}]`, `flats: {spots, glint, skyglass, cockles: {item}}`, `dig: {spots}` (the day's cracks are drawn from these), `bugSpots: [{x, y, habitat, porch?}]` (habitats `orchard`, `reeds`, `meadow`, `shore`, `porch`).

**1.12 Spawns.** `{area, table, rate, cond?, reeds?}`. Keyword areas match tiles by `spawn`: only tall grass, reeds, heather and thistles are `spawn:'grass'`; lawns are `spawn:'lawn'` so a `'grass'` keyword never turns a lawn into an encounter field. On a town map only `reeds: true` spawns roll.

**1.13 Commons projects and market nights** are visible at their addresses as conditional props/entities gated on system flags `sys.commons.<COMMONS_PROJECT id>` and `sys.lantern-market` (§8.2).

**1.14 Variants (a map that changes with the save).** A map may carry `variants: [{id, tier, cond, artTier?, ...fields}]`. Each variant names the fields it replaces wholesale (`ground`, `detail`, `collision`, `props`, `entities`, `triggers`, `warps`, `regions`, `markers`, `furnitureSlots`); `id`, `w`, `h`, `kind`, `region`, `legend`, `entry` and the door stay the map's. The scene shows **the last variant whose `cond` holds**, else the top-level layout, so a runtime that ignores `variants` still shows a correct first state. `artTier` picks the `artByTier` art of tiles that have it (the cottage floor and walls). Only the Keeper's Cottage uses this today (§11.1); request to WORLD-MAP / OVERWORLD in §14.2.

**1.15 Furniture and conditional pieces.** Built-in solid furniture (beds, tables, counters, shelves, hearths, the lens, braziers, standing stones) is painted in the `detail` layer with the TileDef that carries its `verb`. Interactive or conditional pieces are `{kind: 'prop'}` entities (solid by default, `art`, `verb`, `cond`, `text`), with a `use` trigger on the same cell for the verb. Pure decoration that must not block (a rug, a plant on a sill, canvases on a wall, a light pool) goes in `props` (`{art, x, y, cond?}`). Art wider than a tile anchors at its bottom-left cell; its other cells are held by `collision` `#` (fixed pieces: the lens, the Summit Bell, the perch) or by an art-less `{kind: 'prop', blocker: true}` entity sharing the piece's `cond` (dossier boards, the Sinking Engine). Never put the same piece in two lists (it would draw twice).

**1.16 Doors onto other maps: `toMarker`.** An interior's exit warp carries `toMarker`, the name of the marker in the target map it lands on; the coordinates in `to` must equal that marker (the world test checks it whenever the target map has the marker). The contract with the exterior maps: each isle has `door-spire-<id>` (the door tile, warping to the Spire's arrival `(10,12)`) and `spire-step` (the cell below it); the Bar has `hollis-gate-door` / `hollis-gate-step` and `lantern-stack-door` / `lantern-stack-step`; Pellwick's porch steps are the `porch-<house>-step` / §3 cells. Interior-to-interior warps (the summit chain, the keeper's stair) land beside the other side's warp cell, both ways.

**1.17 Interior marker flags.** Beyond §1.5: `staff: true` (behind a counter or in a back room the player cannot enter: Juniper's till), `apart: true` (somewhere seen but never walked: Idris's gallery), `room: '<commission>'` (inside a cottage room that exists only once that commission is built), `trainer: '<TRAINER id or spires.js sentinel id>'` (a battle post). Spires and summit rooms always name `from-door`, `door-front`, `leader-dais` (and `<leader>-dais`), `challenger-spot` (where the player stands for the leader's intro), `badge-spot`, `dossier-front`.

---

## 2. Tiles (`js/data/tilesets.js`)

**2.1 Row fields.** The TileDef typedef (`id, char?, art, solid, water, tide, verb, sfx, anim, glow, spawn?`) plus documented extras the validator and loader ignore today: `tideWindow` (minutes either side of low water a tide tile is dry: causeways 150, stepping stones 120, flats and the Bar 90, mainland causeway 60 — GDD-00 §4), `lowerLow` + `openFlag: 'lit.bar'` (the Bar road), `spring` (the Old Quay), `autotile` (roof, fence, cliff, path, shore edges), `roof`/`roofFrom`, `litArt`, `artByTier` (cottage interior), `layer` ('detail' / 'overlay' / 'edge'), `slide`/`mirror` (ice), `porch`. `sfx` is `step` or `stepWater` (the only footstep sounds core/audio has). Glow pools use the palette's lamp amber `#F9C46B`, lighthouse amber `#FFB547`, bioluminescent cyan `#3FF2E0` (mud-glow, `when: 'night-low'`) and comet magenta `#FF5BD6` (skyglass).

**2.2 DEFAULT_LEGEND** (89 chars):

| Char | Tile | Notes |
|---|---|---|
| `G` | `grass` |  |
| `g` | `grass-b` |  |
| `,` | `meadow` |  |
| `T` | `tall-grass` | spawn grass |
| `r` | `reeds` | spawn grass |
| `n` | `heather` | spawn grass |
| `t` | `thistles` | spawn grass, detail |
| `U` | `marsh` | spawn marsh |
| `F` | `moor-turf` |  |
| `A` | `sand` |  |
| `a` | `sand-ripples` |  |
| `W` | `wet-sand` | tide floods, verb dig |
| `q` | `shingle` |  |
| `m` | `mud-bank` | verb dig |
| `M` | `mud-flat` | tide low ±90 min, spawn mud, verb dig |
| `Y` | `mud-glow` | tide glow ±90 min, spawn mud, verb dig |
| `;` | `soil` | verb dig |
| `-` | `snow` |  |
| `>` | `ash` |  |
| `x` | `ice` |  |
| `?` | `mirror-ice` |  |
| `P` | `path` |  |
| `O` | `cobbles` |  |
| `f` | `flagstones` |  |
| `:` | `gravel` |  |
| `Q` | `quay` |  |
| `H` | `steps` |  |
| `p` | `deck-planks` |  |
| `_` | `porch-step` |  |
| `K` | `pier` |  |
| `k` | `boardwalk` |  |
| `B` | `bridge-wood` |  |
| `N` | `bridge-stone` |  |
| `d` | `drowned-street` | tide low ±150 min |
| `D` | `deep-water` | water, verb fish |
| `S` | `shallows` | water, verb fish |
| `R` | `river` | water, verb fish |
| `u` | `lagoon` | water, verb fish |
| `j` | `tannin-water` | water, verb fish |
| `J` | `hot-spring` | water, verb look |
| `~` | `tidepool` | water, verb look |
| `Z` | `weir` | solid, water, verb look |
| `e` | `stepping-stones` | tide low ±120 min |
| `z` | `river-stones` | tide low ±120 min |
| `E` | `causeway` | tide low ±150 min |
| `X` | `mainland-causeway` | tide low ±60 min |
| `b` | `bar-road` | tide low ±90 min |
| `C` | `cliff` | solid |
| `h` | `ledge` | solid |
| `o` | `rock` | solid, verb look, detail |
| `0` | `boulder` | solid, verb look, detail |
| `<` | `volcanic-rock` | solid, detail |
| `8` | `pine` | solid, detail |
| `9` | `alder` | solid, detail |
| `V` | `hedge` | solid, detail |
| `v` | `bush` | solid, detail |
| `y` | `gorse` | solid, detail |
| `=` | `bean-rows` | solid, verb look, detail |
| `*` | `flowers` |  |
| `&` | `flowers-b` |  |
| `i` | `glasswort` | spawn marsh, detail |
| `l` | `seaweed` | spawn shore, detail |
| `#` | `wall-timber` | solid |
| `w` | `wall-brick` | solid |
| `s` | `wall-stone` | solid |
| `$` | `wall-shiplap` | solid |
| `%` | `window` | solid |
| `[` | `window-brick` | solid |
| `]` | `window-stone` | solid |
| `{` | `window-shiplap` | solid |
| `}` | `window-dark` | solid |
| `+` | `door` | verb enter |
| `!` | `door-brick` | verb enter |
| `@` | `door-stone` | verb enter |
| `"` | `door-arch` | verb enter |
| `^` | `roof-slate` | solid |
| `1` | `roof-red` | solid |
| `2` | `roof-moss` | solid |
| `3` | `roof-blue` | solid |
| `4` | `roof-straw` | solid |
| `5` | `roof-dark` | solid |
| `6` | `roof-teal` | solid |
| `7` | `roof-ochre` | solid |
| `\|` | `fence` | solid, detail |
| `/` | `fence-gate` | verb open, detail |
| `L` | `lamp-post` | solid, detail |
| `c` | `crates` | solid, verb look, detail |
| `(` | `barrel` | solid, verb look, detail |
| `)` | `mooring-post` | solid, detail |

**Tiles without a default char** (reach them through a map legend, an entity's `art` or a prop): `ice-cracked`, `cave-floor`, `spa-terrace`, `cobbles-worn`, `old-quay`, `mud-water`, `shoal`, `lily-pads`, `glacier`, `quarry-face`, `basalt`, `cave-wall`, `spa-terrace-lip`, `quay-lip`, `rock-b`, `ember-vent`, `standing-stone`, `sea-stack`, `wreck-ribs`, `wreck-post`, `skyglass-node`, `waystone`, `brazier`, `windmill`, `alder-b`, `blossom`, `pine-snow`, `mangrove`, `drowned-tree`, `tree-fruit`, `tree-purse`, `tree-bee`, `porthole`, `door-porch`, `roof-keeper`, `creel`, `net-rack`, `timber-stack`, `string-lights`, `market-stall`, `bench`, `dig-crack`, `dig-hole`, `lighthouse`, `lighthouse-scaffold`, `lighthouse-wall`, `lamp-room-floor`, `stair-spiral`, `lens`, `floor-boards`, `floor-stone`, `cottage-floor`, `cottage-wall`, `cottage-wall-top`, `int-wall`, `int-wall-top`, `rug`, `hearth`, `counter`, `shelf`, `table`, `bed`, `stairs-up`, `stairs-down`, `string-wall`, `spire-floor-turn`, `spire-wall-turn`, `spire-floor-ward`, `spire-wall-ward`, `spire-floor-weather`, `spire-wall-weather`, `spire-floor-hollow`, `spire-wall-hollow`, `spire-floor-relay`, `spire-wall-relay`, `spire-floor-mirror`, `spire-wall-mirror`, `spire-dais`.

**2.3 Animated-tile budget.** Deep water and shallows are static (the foam/swell edge overlays animate); river, reeds, heather, glow mud, weir, mirror-ice, hot springs, lagoon and tannin water animate. Pellwick has 260 animated cells (cap 400).

---

## 3. The 24 maps

| Map | Kind | Region | Size | Status | Arrival points other maps rely on |
|---|---|---|---|---|---|
| `pellwick` | exterior | pellwick | 64×48 | authored | from Lowmoor stones (1,38), from the boardwalk (13,1), from the Bar (6,1); porch steps for each interior |
| `lowmoor` | exterior | lowmoor | 48×32 | authored (§15.1) | **(46,22)** from the Pellwick stones (short way); **(46,4)** from the marsh boardwalk (long way); edge warps back at (47,22) and (47,4); from Cairnhold (27,30) causeway, (6,30) quarry road; Spire step (6,8) |
| `cairnhold` · `emberstep` · `drownwood` · `thistlewind` · `rimeholt` | exterior | own | 48×32 | authored (§15.2–§15.6) | the ring arrivals in §15.0.2; Spire steps (40,17) · (6,17) · (24,10) · (26,8) · (16,6) |
| `the-bar` | exterior | the-bar | 64×24 | authored (§15.7) | **(1,12)** from Pellwick's Bar road; edge back at (0,12); `hollis-gate-step` (59,11), `lantern-stack-step` (29,2) |
| `spire-turn` … `spire-mirror` | interior | the isle's | 20×14 | authored (§12) | door (10,13), arrival (10,12); the exit lands on the isle's `spire-step` |
| `int-cottage` | interior | pellwick | 16×12 | authored, 4 tiers (§11.1) | door (8,11), arrival (8,10) → back to (9,23); keeper's stair (10,10) ↔ lighthouse (10,13) at tier 3 |
| `int-pells` | interior | pellwick | 14×10 | authored (§11.2) | door (7,9), arrival (7,8) → back to (24,20) |
| `int-post-office` | interior | pellwick | 12×10 | authored (§11.3) | door (6,9), arrival (6,8) → back to (48,20) |
| `int-archive` | interior | pellwick | 16×12 | authored (§11.4) | door (8,11), arrival (8,10) → back to (32,20) |
| `int-yard-shed` | interior | pellwick | 14×10 | authored (§11.5) | door (7,9), arrival (7,8) → back to (56,26) |
| `int-lighthouse` | interior | pellwick | 12×18 | authored (§11.6) | door (6,17), arrival (6,16) → back to (4,19); keeper's stair (10,13) → cottage (9,10) once built |
| `hollis-gate` · `keepers-hall` · `idris-hall` | interior | shardcrown | 20×14 | authored (§13) | door (10,13), arrival (10,12); north doors (10,0) chain gate → hall → Idris (arrival (10,1) coming back down); Hollis's Gate exits on the Bar's `hollis-gate-step` |
| `lantern-stack` | interior | the-bar | 20×16 | authored (§13.4) | door (10,15), arrival (10,14); exits on the Bar's `lantern-stack-step` |

**3.1 Stubs.** Each stub is a legal map (`stub: true`): a shallows-ringed lawn or a walled room with its door, a sign, its `entry`, and the warps that make Pellwick's edges and doors round-trip. Replacing a stub: keep the id, size and the arrival points in the table (or change Pellwick's warps in the same change), drop `stub: true`, keep `test/data.world.test.mjs` green.

**3.2 What every isle map must hold** (GDD-00 §4): a low-tide **short way** in (tide tiles of the right window) and an any-tide **long way**; the dock **Waystone** (§1.8) with its tide chalkboard; a **skyglass node**; **two reaches** (`reaches[]` with the isle's `<isle>-water` table as `creatureTable`); a **dig site** (`dig.spots`); 5 route trainers (markers `trainer-<trainerId>`); a **ferry stop** (`use` verb `ferry` + marker `ferry-stop`); the **Spire door** (door warp to `spire-<id>`, door (10,13)); spawns using `<isle>-land` (grass keyword: tall grass/heather/thistles) and `<isle>-water`; the isle's holds from GDD-00 §4 as markers (`maud-practice-table`, `linnet-rematch-stones`, `cairnhold-memorial`, `drowning-street`, `idris-gallery` …). The test's reachability check (every Waystone and Spire door reachable from the entry at any tide via the long way) covers every isle (§15, §10).

---

## 4. Regions (`js/data/regions.js`)

| id | Name | Curve level | Day wild band | Music |
|---|---|---|---|---|
| `pellwick` | Pellwick | 4 | 2–5 (the reed edges) | hourly |
| `lowmoor` | Lowmoor | 6 | 3–8 | hourly |
| `cairnhold` | Cairnhold | 13 | 9–14 | hourly |
| `emberstep` | Emberstep | 19 | 15–20 | hourly |
| `drownwood` | Drownwood | 26 | 22–27 | hourly |
| `thistlewind` | Thistlewind | 33 | 29–34 | hourly |
| `rimeholt` | Rimeholt | 40 | 36–41 | hourly |
| `the-bar` | The Bar | 41 | 40–44 | hourly |
| `shardcrown` | Shardcrown | 47 | 44–48 | `summit` |

`curveLevel` is the posted curve (ace − 3) from GDD-ids §8; night adds +2 through `tuning.encounterNightLevelBonus`.

---

## 5. Pellwick (`js/data/maps/pellwick.js`)

**5.1 The town at a glance** (ground with detail over it; entities as `T` fruit tree, `$` purse tree, `B` bee tree, `L` porch lamp (lamp posts in the detail layer are `L` too), `p` furniture prop, `b` boat, `s` sign):

```
     0000000000111111111122222222223333333333444444444455555555556666
     0123456789012345678901234567890123456789012345678901234567890123
   0 DDDDDDbbDDDDDkDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDS888888RRR88888888
   1 DDDDDDbbDDDDDkDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDS888888RRRG,GGG,,G
   2 DDDDDDbbSSSSSkSSSSSSRRRSSSSSSSSSSSSSSSSSSSSSSSS888888RRRT,T,T,B8
   3 DDDDDDbbSrrUUkrUrrrrRRRAaAaaaAaAaAammAaAAaAAAaAGGGGGGRRRG,GGGGGG
   4 DDDDDDbbSrSUSkUUrrrrRRRaaaaaaaaGGGGmmpom;mmmbm;mmmmmmRRRTGTGTGT,
   5 DDDDDDbbSrrUrkSSrrrsRRRGTGTGTGTGTGTmTGTGTGGGGGGGGTGmmRRRGGG,G,G8
   6 DDDDDDbbSrrrrkkkkkkkBBBG66666GGGGGsGGGGGGG5555GGGGGm;RRRT,TG$GT,
   7 DDDDDDbbSrrUrirUSrrrRRRG66666GTGTG$GTGTGTG5555GTG$GmmZZZG,GGGGGG
   8 DDDDDDbbSrrUUUrrrSrrRRRG#%%%#GGGGGGGGGGGGG}}}$GGGGGGGRRRTGT,TGTG
   9 DDDDDDbbSrrSUUirUrrrRRRG%#+L%GTGTGTGTGTGTG$+L}9GTGGbGRRRGGGG,,,8
  10 DDDDDDbbSrrSUUUiUrrrRRRAA___AAAasAaaAAAaAA___AARRRRRRRRRTGBGTGTG
  11 DDDDDDbbSrrrSrrrirrrRRRRRRRRRRRRRzRRRNNRRRRRRRRRRRRRRRRR,G,GGGGG
  12 DDDDDDbbSrrrrrrrrrrrRRRRRRRRRRRRRzRRRNNRRRrrrrrrrrrrRRGGT,TGTGT8
  13 DDDSSSbbSrrrrrrrrrrrRRRRrrrrrrrRRzRRRNNRrrrrrrrrrrrrTGTGPPPPGGGG
  14 DDSSqqqqsrrrrrrrrrrrPPPPPPPPPPPPPPPPLOOLPPPPPPPPPPPPPPPPPGGGSSSS
  15 DDSCCqqqqCCCCCCCCCCGGG111111G^^^^^^^GOOTGGGGGG333333GGGGGTGASDDD
  16 DDSCffffoqGGG,GGG5555G111111G^^^^^^^GOOG66666G333333G5555GGASDDD
  17 DDSCssffsT,T,T,TG}}}$G111111G^^^^^^^TOOG66666G333333G5555TGASDDD
  18 DDSC@sfff,GGG,G,G$+L}Gw[[[w[G]s]]]s]GOOG#%%%#Gw[[[w[G}}}#GGASDDD
  19 DDSCfff?????|1111___GG[w!LpwGs]s@LdsGOOG%#+L%G[w!L[wG#+L}TGASDDD
  20 DDSCfff?????|1111GGGGGG___GGGGG___GGGOOGG___GGG___GGG___GGGASDDD
  21 DDSCGTP${{{$|%%%#POOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOLOOOOOOOOASDDD
  22 DDSCGGP{$+L{|#+L%PGGGGGGGGLOsgggggggLggLgggggggggO77777GGGGASDDD
  23 DDSSCTPGp__G|___GPGTGG5555GOgT*TgTgggggggggTgT*TgO777774444ASDDD
  24 DDDSy,P|p/p|||/||P,GGG5555GOg*&gggOOpOOOOpgggg&*gO#%%%#%%%#ASDDD
  25 DDDSSCPpPPPPPPPPPPGTGG}}}#GOg$gTgTOOOOOOOOgTgTgTgO%#+L%#+#%ASDDD
  26 DDDSCTGTGTGB,TGG77777G#+L}GOpgggggOOOOOOOpgggggLgOG___GGGGGASDDD
  27 DDSSyGG,GGGGG,GG77777G___GGOgTgTgBpOOOOOpOgTg$gTgOffffffpGGASDDD
  28 DDSC,TGTG$GTGTGG#%%%#GGGGGGOgggggggggggggggg&*gggOpfpffpfqqqSDDD
  29 DDSCyGGGGGGGGGGG%#+L%GLGGTGOgTgT*TgggggggggT*TgTgOfffffffqqqSDDD
  30 DDSSCTGT,TGTGTGyG___GGGGGGGOggpgggggLggLgggggggggOpffffffqqqXXXX
  31 DDDSCCCCCCHCAAAAAGGGGTGOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOqqqXXXX
  32 DDDSSCCCCCHCAAAAAA5555G44444G|G22222GOOG5555G5555G555555555qSDDD
  33 DDDDSCCCCCHL"AAAKA5555G44444G|=22222=OOG5555G5555G555555555sSDDD
  34 DDDDMMMMqqqAAAWWKW}}}$G#%%%#G|=w[[[w=OOG}}}#G$}}}G}}}#s]]]sASDDD
  35 DDDMMMqqqllsMMMMKW$+L}G%#+L%G|=[w!L[=OOG#+L}G}$+LG#+L}]s@s]ASDDD
  36 DDDMMqqMMMMM~MoMKM___WGG___GG|GG___GGOOG___GGG___G___GGGGGGASDDD
  37 DDDMqqMYYMMMMMMMKOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOOSDDD
  38 qeeqqMMMYYYMMlMMoOOOLOOOOOOOOOLOOOOOOOOOOOOOLOOOOOOOOLOOOOOOSDDD
  39 DDDDMMMlMMYYMMMMKlHsQnQQccjQQ(QQQQQQpQQQQQQjc(QnnQQQQQQQccjQSDDD
  40 DDDDDMYMMMMMMMYYKWHQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQQjQQQQQSDDD
  41 DDDDDDMMM~MoYMMYWWHQQQ)QQQQ)QQQ)QQQQ)QQQQQ)QQQQ)QQQQQ)QQQQ)sSDDD
  42 DDDDDDDDMMMMMYMWWWSSSSSSSSSSSSSSSKKSSSSSSSSSSSSSSSKKSxxxxxxSSDDD
  43 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKDDDDDDDDDDDDDDDKKSxxxxxxSDDDD
  44 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKbDDDDDDDDDDDDDDKKSxxxxxxSDDDD
  45 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKSxxxxxxSDDDD
  46 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDKKbSSxxxxSDDDD
  47 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDSSSSSSSSDDDD
```

**5.2 Places, west to east.**

- **The point** (x 3–18, y 14–33). The dark **lighthouse** stands at the north-west tip on a stone base (door at (4,18), apron of flagstones), visible from the marsh, the flats and the whole north lane; the scaffold prop climbs a section per loan tier. North of it the **Bar head** (shingle, 5–8 × 14–16) and the **Bar road** (`bar-road`, x 6–7) run straight north off the map to `the-bar` — dry only around the day's lower low until `lit.bar`. The **Keeper's Cottage** (x 7–11, roof `roof-keeper`, shiplap walls, porch bench, gate boards, mailbox and Consignment Crate at the gate onto Point Road) with **Linnet's** red-roofed house next door behind the fence she vaults (x 12). A flagstone path runs from the lighthouse down the cottage's west side to **Point Road**. South of the road, **Isolde's old orchard** (15 trees: Low Water, Spring Tide, Neap…). The south cliff drops to the flats; **Wick's cliff stair** (x 10) lands on the beach by the **Dorrows' burrow** door in the cliff foot; **the dock** (the Keeper's jetty, x 16) runs out over the flats, where Linnet waits on night one and Maud's punt calls offshore.
- **The point flats** (x 3–21, y 34–42): mud flats (±1.5 h), glow-mud seams (cyan at a night low), tide pools, rocks, seaweed; the Glint, sparkles, skyglass relics and cockles draw from `flats.spots`. A **shingle spit** from the stair foot, dry at any tide, leads to the **Lowmoor stepping stones** (x 1–2, y 38; ±2 h) and the last dry rock at the edge (0,38), the short-way warp.
- **The marsh delta** (x 9–19, y 3–14): reeds (encounters), tidal channels, glasswort; the **marsh boardwalk** from the **footbridge** over the river's north reach runs west and north off the map: the **Lowmoor long way**, open at any tide.
- **The river**: down from the hill through the woods, over the **weir** (x 53–55, y 7), west below the north bank, north to its mouth beside the marsh (where it once scoured the Bar). Crossings: the old **stone bridge** on Harbour Street (x 37–38) and the tidal **river stepping stones** by the Archive (x 33). Reed margins by Pell's (24–30, 13) and below the bridge (40–51, 12–13, Corin's Capture Stance reeds).
- **The north bank** (y 3–10): beach, **the north creek** (dry since the weir; the Bracks' oyster boat lies in it), the north-bank orchard, **Thessaly's** cottage at the footbridge end, dark house 8 by the creek, and the **weir clearing** with **Ansel's beached launch** and the piling where the forked tail shows.
- **Stalk's Hill orchard** (x 56–62, y 1–13): the old Stalk family orchard on the hill east of the weir (24 trees, a purse tree, two bee trees), reached from the east end of the river walk.
- **The north row** along the river walk and the north lane: dark house 7 at the neck, **Pell's Sundries** (red roof, brick, shop sign), **Barnaby's Archive** (stone, slate roof, the porthole at (34,19)), Harbour Street, the **Warden's house**, the **post office** (blue roof; Ludo hangs from the east eave above (51,20)), dark house 4.
- **The green** (x 27–49, y 21–31): the west lawn is the **Commons orchard** (the first-orchard beat: 12 trees with The Miser purse tree and Honeypot bee tree), the cobbled **Commons square** on Harbour Street holds the **Commons board** and **Commons Jar** (and Lantern Market stalls on market nights), the east lawn is the second orchard and the market lawn; Thessaly's bench at its west edge. Dark house 3 and **Odile's** house on the rise west of the green (her step looks over the flats to the lighthouse).
- **The co-op yard** (x 50–58, y 22–30) at the causeway end: **Wren's house**, the **yard shed** (`int-yard-shed`), the flagstone yard with Wren's abacus table, Ambrose's bench, timber stacks and the tally post — the first thing you reach off the causeway.
- **The quay row** (y 32–36) facing the quay street: dark house 1 (Tamsin's from day 3), **Tully's**, the shared fence with **Bryony's** bean rows, **Bryony's**, then the dark row east of Harbour Street (dark 5, dark 6, dark 2) and the stone **Anchorage** (Merrow's counter at its door).
- **The quay** (y 37–41) and the harbour: the slipway steps at the west end, bollards with no boats at them (the fleet was lost), creels, net racks, the tide board, **Maud's berth** (x 33–34) with her punt, the **Old Pier** (x 50–51; the Carnival Raft moors at its end from day 3) and the **Old Quay** off the east end (bared only at a spring low; the bell dig).
- **The mainland causeway** (x 60–63, y 30–31; ±1 h): arrival only. The last dry stones (57–59, 28–32) are where the three creatures sit at 17:50 on day 1.

**5.3 Porches (PORCH_IDS)** — `x,y` is the lamp cell, `step` is where the household sits for porch talk:

| Porch | House | Lamp | Step | Door | Lit |
|---|---|---|---|---|---|
| `porch-coop-yard` | coop-yard | (53,25) | (52,26) | (52,25) | **lit at arrival** |
| `porch-pells` | pells | (25,19) | (24,20) | (24,19) | **lit at arrival** |
| `porch-post-office` | post-office | (49,19) | (48,20) | (48,19) | **lit at arrival** |
| `porch-archive` | archive | (33,19) | (32,20) | (32,19) | **lit at arrival** |
| `porch-wardens-house` | wardens-house | (43,19) | (42,20) | (42,19) | **lit at arrival** |
| `porch-tully` | tully | (26,35) | (25,36) | (25,35) | **lit at arrival** |
| `porch-linnet` | linnet | (15,22) | (14,23) | (14,22) | **lit at arrival** |
| `porch-keepers-cottage` | keepers-cottage | (10,22) | (9,23) | (9,22) | loan-1 |
| `porch-dorrow` | dorrow | (11,33) | (12,34) | (12,33) | f1 |
| `porch-odile` | odile | (19,29) | (18,30) | (18,29) | f9 |
| `porch-bryony` | bryony | (34,35) | (33,36) | (33,35) | family-letter |
| `porch-thessaly` | thessaly | (27,9) | (26,10) | (26,9) | family-letter |
| `porch-dark-1` | dark-1 | (20,35) | (19,36) | (19,35) | commons-project |
| `porch-dark-2` | dark-2 | (52,35) | (51,36) | (51,35) | relighting (night 1) |
| `porch-dark-3` | dark-3 | (24,26) | (23,27) | (23,26) | relighting (night 2) |
| `porch-dark-4` | dark-4 | (55,19) | (54,20) | (54,19) | relighting (night 3) |
| `porch-dark-5` | dark-5 | (42,35) | (41,36) | (41,35) | relighting (night 4) |
| `porch-dark-6` | dark-6 | (48,35) | (47,36) | (47,35) | relighting (night 5) |
| `porch-dark-7` | dark-7 | (19,18) | (18,19) | (18,18) | relighting (night 6) |
| `porch-dark-8` | dark-8 | (44,9) | (43,10) | (43,9) | relighting (night 7) |

**5.4 Trees** — 95 named fruit trees, 6 purse trees, 4 bee trees, by zone:

| Zone | n | Trees |
|---|---|---|
| hill-orchard | 24 | Old Meg, Grandam, Parson Hobb, Hummer (bees), Crooked Kit, Lantern Tree, Ferryman, Tide Widow, Gull Perch, Long Tom, Tightfist (purse), Whistler, Sweet Fanny, The Bishop, Hollow Jack, Mabry's Tree, Captain Mallow, Queen Bess (bees), Lame Duck, Bell Tree, Saltlick, Knuckles, Weathervane, Tallyman |
| north-bank | 21 | Brindle, Mossback, Bonny Lass, Rook's Rest, Keel, Penny Hoard (purse), Gaffer, Nan Coil, Little Ned, Stooper, Sunday Best, Owl Light, The Leaner, Shipwright, Barrow Queen, Cobbler, Tinker, Haverel, Fogbound, Tidewrack, Starling |
| weir-clearing | 4 | Maypole, Wicket, Spendthrift (purse), Plover |
| green-west | 12 | Dunlin, Curlew, Godwit, The Miser (purse), Turnstone, Merlin, Tern, Puffin's Post, Honeypot (bees), Oystercatcher, Spratling, Grey Lady |
| green-east | 12 | Old Pew, Mizzen, Bowsprit, Bosun, Anchor Watch, Lighterman, Thimble, Old Purse (purse), Darning Needle, Kettle Black, Porch Light, Mooring |
| keepers-orchard | 15 | Low Water, Spring Tide, Neap, The Hive (bees), Slack Water, Flood, Ebb, Button Box (purse), Shingle, Sea Coal, Hearthstone, Ingle, Tinderbox, Firkin, Hogshead |
| point-north | 6 | Cooper, Quillet, Hobnail, Gorsey, Brackenbank, Fernside |
| river-walk | 4 | Heron's Watch, Stilt, Upstart, Seedling Sal |
| east-shore | 3 | Lonely Bob, Old Faithful, Patience |
| neck | 4 | Charity, Mercy, Constance, Dorcas |

**5.5 Warps.**

| Cell | Kind | To | Notes |
|---|---|---|---|
| (9,22) | door | `int-cottage` (8,10) |  |
| (24,19) | door | `int-pells` (7,8) |  |
| (48,19) | door | `int-post-office` (6,8) |  |
| (32,19) | door | `int-archive` (8,10) |  |
| (56,25) | door | `int-yard-shed` (7,8) |  |
| (4,18) | door | `int-lighthouse` (6,16) |  |
| (0,38) | edge | `lowmoor` (46,22) | short-way ±120 min |
| (13,0) | edge | `lowmoor` (46,4) | long-way |
| (6,0) ×2 | edge | `the-bar` (1,12) | the-bar ±90 min |

No warp sits on the mainland causeway (arrival only); the `mainland-turnback` look trigger at the east edge says the causeway is under.

**5.6 Markers** (all 153; `(low)` = reachable at low water, `(solid)` / `(water)` = not a standing spot):

`porch-coop-yard-step` 52,26 · `door-coop-yard` 52,25 · `porch-pells-step` 24,20 · `door-pells` 24,19 · `porch-post-office-step` 48,20 · `door-post-office` 48,19 · `porch-archive-step` 32,20 · `door-archive` 32,19 · `porch-wardens-house-step` 42,20 · `door-wardens-house` 42,19 · `porch-tully-step` 25,36 · `door-tully` 25,35 · `porch-linnet-step` 14,23 · `door-linnet` 14,22 · `porch-keepers-cottage-step` 9,23 · `door-keepers-cottage` 9,22 · `porch-dorrow-step` 12,34 · `door-dorrow` 12,33 · `porch-odile-step` 18,30 · `door-odile` 18,29 · `porch-bryony-step` 33,36 · `door-bryony` 33,35 · `porch-thessaly-step` 26,10 · `door-thessaly` 26,9 · `porch-dark-1-step` 19,36 · `door-dark-1` 19,35 · `porch-dark-2-step` 51,36 · `door-dark-2` 51,35 · `porch-dark-3-step` 23,27 · `door-dark-3` 23,26 · `porch-dark-4-step` 54,20 · `door-dark-4` 54,19 · `porch-dark-5-step` 41,36 · `door-dark-5` 41,35 · `porch-dark-6-step` 47,36 · `door-dark-6` 47,35 · `porch-dark-7-step` 18,19 · `door-dark-7` 18,18 · `porch-dark-8-step` 43,10 · `door-dark-8` 43,9 · `door-yard-shed` 56,25 · `door-anchorage` 56,35 · `door-lighthouse` 4,18 · `wren-yard` 52,27 · `wren-causeway` 57,30 · `ambrose-bench` 56,29 · `ambrose-timber` 51,29 · `hesper-post-step` 48,20 · `hesper-cottage-gate` 9,25 · `juniper-pells-step` 24,20 · `ludo-eave` 51,20 · `barnaby-archive-step` 32,20 · `archive-porthole` 34,20 · `barnaby-flats` 12,37 (low) · `augusta-wardens-step` 42,20 · `augusta-commons-board` 37,25 · `ansel-launch` 50,9 · `ansel-creek` 47,5 · `ansel-weir` 52,7 · `piling` 50,10 (solid) · `wick-burrow` 12,34 · `wick-cliff-stair` 10,30 · `tully-porch` 25,36 · `tully-lap-1` 27,21 · `tully-lap-2` 49,21 · `tully-lap-3` 49,31 · `tully-lap-4` 27,31 · `odile-porch` 18,30 · `odile-easel` 6,23 · `bryony-porch` 33,36 · `bryony-beans` 31,36 · `fence-bryony-tully` 29,37 · `thessaly-porch` 26,10 · `thessaly-bench` 28,27 · `tamsin-porch` 19,36 · `tamsin-flats` 14,38 (low) · `corin-step` 10,23 · `corin-archive-step` 31,20 · `corin-reeds` 42,14 · `corin-stones` 5,37 · `corin-dock` 16,36 · `linnet-porch` 14,23 · `linnet-vault-to` 11,23 · `dimity-lamp` 10,22 (solid) · `thatch-roof` 9,19 (solid) · `maud-berth` 34,43 · `maud-punt` 35,44 (water) · `maud-punt-dock` 18,42 (water) · `pip-quay` 40,40 · `merrow-anchorage` 56,36 · `anchorage-counter` 56,36 · `varga-raft` 51,46 · `dov-stall` 40,26 · `arrival-start` 63,30 (low) · `causeway-foam` 61,30 (low) · `lease-card-player` 58,31 · `starter-sloshkin` 59,29 · `starter-scrapling` 59,31 · `starter-reedkit` 59,30 · `starter-kneel` 58,30 · `cottage-porch` 9,23 · `wick-errands` 10,25 · `yard-apron` 53,29 · `commons-pin` 36,25 · `tully-nickname` 38,25 · `meet-odile` 18,31 · `meet-bryony` 33,37 · `meet-thessaly` 32,23 · `first-orchard` 30,26 · `mail-sack` 35,40 · `post-office-door` 48,20 · `reeds-stance` 43,14 · `reeds-tossup` 43,13 · `ansel-tells-player` 49,9 · `pip-player` 39,40 · `ludo-sale` 51,21 · `yard-payment` 52,29 · `porchlight-player` 9,24 · `prismoth-lamp` 10,23 · `corin-slip` 9,23 · `night-fishing` 30,41 · `glowing-flats` 9,37 (low) · `glint-hint` 11,38 (low) · `mailbox-front` 10,25 · `stones-start` 3,38 · `boardwalk-start` 19,6 · `bar-head` 6,14 · `raft-berth` 51,45 · `market-green` 39,26 · `market-stall-1` 34,28 · `market-stall-2` 40,28 · `market-stall-3` 42,26 · `shift-fair` 40,25 · `linnet-ferry-leaves` 34,42 · `point-skywatch` 5,20 · `lighthouse-door` 4,19 · `relighting-juniper` 9,25 · `relighting-crowd-1` 6,19 · `relighting-crowd-2` 7,18 · `crossing-start` 7,14 · `engine-watch` 6,16 · `point-dawn` 8,27 · `weir-wheel` 52,6 · `bell-dig` 56,44 (low) · `tamsin-boat` 44,5 · `blackout-wake` 9,23 · `party-green` 30,24 · `commons-training-yard` 31,30 · `commons-third-stall` 44,22 · `north-creek-footbridge` 37,5 · `mudlark-start` 13,34 (low) · `mudlark-finish` 17,41 · `weathervane-ansel` 37,26

**5.7 Regions** (named rects for story triggers, camera and gather areas): `lowmoor-long-way` 13,0 10×7 · `marsh-reeds` 9,3 11×11 · `north-creek` 35,3 18×5 · `orchard` 23,5 30×6 · `bar-head` 5,13 4×4 · `point-flats` 3,34 19×9 · `lowmoor-short-way` 0,36 7×4 · `the-dock` 15,36 4×6 · `causeway-end` 56,28 8×5 · `old-quay` 53,42 6×5 · `reach-river-bridge` 29,11 14×2 · `reach-river-mouth` 20,2 3×9 · `reach-quay-west` 19,42 14×3 · `reach-quay-east` 36,42 14×3 · `point-heath` 4,25 12×6 · `arrival-causeway` 56,28 8×5 · `starter-stones` 57,28 3×5 · `the-point` 3,14 16×20 · `keepers-cottage` 6,19 7×6 · `keepers-orchard` 5,25 11×6 · `lighthouse` 4,14 5×7 · `green` 27,21 23×11 · `first-orchard` 28,22 7×9 · `commons-square` 34,24 8×4 · `lantern-market` 34,22 15×9 · `coop-yard` 50,22 9×9 · `quay` 17,37 43×6 · `maud-berth` 32,41 4×4 · `old-pier` 49,41 4×6 · `the-reeds` 40,12 12×2 · `reeds-by-pells` 24,13 7×1 · `hill-orchard` 56,1 8×13 · `weir` 47,3 9×8 · `mudlark-mile` 3,34 19×9 · `glint-area` 3,34 16×8 · `sparkle-area` 3,34 19×9 · `skyglass-area` 4,35 13×7 · `dark-row` 40,32 19×6 · `porchlight-view` 17,30 5×2

**5.8 Use triggers:** `mailbox` 10,24 mailbox · `gate-boards` 8,24 gateBoards · `consignment-crate` 7,25 crate · `porch-bench` 8,23 sit · `commons-board` 36,24 commons · `commons-jar` 41,24 commonsJar · `yard-counter` 52,28 pay · `ferry` 35,44 ferry · `tide-board-quay` 36,39 tideTable · `anchorage-counter` 56,35 shop · `raft` 52,46 shop · `ludo-eave` 51,19 shop · `knock-coop-yard` 52,25 knock · `knock-wardens-house` 42,19 knock · `knock-tully` 25,35 knock · `knock-linnet` 14,22 knock · `knock-dorrow` 12,33 knock · `knock-odile` 18,29 knock · `knock-bryony` 33,35 knock · `knock-thessaly` 26,9 knock · `knock-dark-1` 19,35 knock · `knock-dark-2` 51,35 knock · `knock-dark-3` 23,26 knock · `knock-dark-4` 54,19 knock · `knock-dark-5` 41,35 knock · `knock-dark-6` 47,35 knock · `knock-dark-7` 18,18 knock · `knock-dark-8` 43,9 knock · `weir` 53,7 look · `mainland-turnback` 63,30 look

**5.9 Reaches, flats, dig, bugs.** Two river reaches (`reach-river-bridge`, `reach-river-mouth`) and two quay reaches (`reach-quay-west` by Maud's berth, `reach-quay-east` by the Old Pier), each hooking `pellwick-reach`; quay reaches and the river mouth also count as `sea` after dark. The north creek is a reach with `cond: {flag: 'sp.weir-turned'}` (empty until the weir turns). `flats.spots` covers every open mud / glow-mud / wet-sand cell of the point flats (90 spots). `dig.spots`: 16 candidate crack cells across town (creek bed, orchards, lawns, the beach). `bugSpots`: orchards, reeds, meadow, shore and all 20 porch steps.

**5.10 The first 30 minutes on this map** (GDD-00 §12 → markers/regions): arrival walk `arrival-start` → `causeway-foam` (region `arrival-causeway`); Wren `wren-causeway`, lease card `lease-card-player`; starters `starter-sloshkin` / `starter-scrapling` / `starter-reedkit`, kneel `starter-kneel` (region `starter-stones`); Wick `wick-cliff-stair`; the bedsit door `door-keepers-cottage`; Corin `corin-step`; Linnet `linnet-vault-to` → the dock `corin-dock`, battle in region `the-dock`, Maud `maud-punt-dock`; errands `wick-errands`; apron `yard-apron`; notice `commons-pin`, Tully `tully-nickname`; neighbours `meet-odile`, `meet-bryony`, `meet-thessaly`; orchard `first-orchard` (region `first-orchard`); mail sack `mail-sack` → `post-office-door`; the reeds `reeds-stance` / `reeds-tossup` (region `the-reeds`); Barnaby `archive-porthole`; Ansel `ansel-launch` / `ansel-tells-player` / `piling`; Pip `pip-quay` / `pip-player`; Ludo `ludo-eave` / `ludo-sale`; payment `yard-payment` / `wren-yard` / `ambrose-bench`; porchlight `porchlight-player`, Dimity `dimity-lamp`, Prismoth `prismoth-lamp`; Tully's porch `tully-porch`; Corin's slip `corin-slip`; night fishing `night-fishing`; glowing flats `glowing-flats` / `glint-hint` (region `point-flats`); the Thatch `thatch-roof`; K1 `mailbox-front` / `hesper-cottage-gate`; the stones `stones-start` / `corin-stones`.

---

## 6. Encounters

**6.1 Format** (ARCHITECTURE §14.11 as `systems/encounter` reads it): `{species, levels: [lo, hi], w, mods?, cond?, errant?, roam?}`. `levels` are the **day** band; the system adds +2 at night (18:00–06:00). `mods` multiply `w` by `day`/`night`, the tide state (`low`/`rising`/`high`/`falling`) and the weather. Errant rows (`errant: true`) never join the weighted pick: `roam: 'route'` Errants Skyroam between the tables that list them; `roam: 'lit'` rows share one `errantLitChance` (1 in 120) at night. Every table keeps at least one unconditional row.

**6.2 Pellwick** (`encounters/pellwick.js`).
- `pellwick-reeds` — the reed edges (marsh, river margins, marsh foot), rate 0.10 per step, `reeds: true`. Tossup 30 (night ×0.6; the scripted first catch is a Tossup Lv4), Puddlepip 18 (high ×1.8, rising ×1.3, low ×0.6, rain ×1.25), Wirewhisk 16 (night ×0.4, rain ×1.5, storm ×2), Rushling 12 (night ×0.5, high ×1.5), Rillfin 10 (high ×2, rising ×1.4, low ×0.4), Duskwisp 14 (day ×0.15, night ×1.6, fog ×1.5), Skirl 10 (day ×0.4, night ×1.2), Mothling 6 (day ×0.1, night ×1.5). Day Lv2–5; night-lean rows are written [2,3] so the +2 lands them at Lv4–5. No Ward form. Scrapling, Reedkit and Sloshkin are not here: the two starters you did not pick are wild on Lowmoor from day 2.
- `pellwick-reach` — hooked on any reach through fishing (`reaches[].creatureTable`), never stepped: Bilgebob 50 (high ×1.5), Rushling 30, Creelwight 10 (night ×2) (GDD-00 §9).
- `pellwick-point-night` — the point heath after the Relighting, spawn gated on `lit.calls` and dusk/evening/night: Duskwisp 40, Skirl 30, Mothling 30, Duskowl 19, plus `roam: 'lit'` Squallcoil (30–34) and Hailcoil (38–41): 1 in 120 night encounters on the point is an Errant (GDD-00 §2).

**6.3 Isles** (`encounters/isles.js`). One `<isle>-land` table (cover, Lowmoor's flats, Rimeholt's caves) and one `<isle>-water` table (hooked on the two reaches) per isle; the GDD-00 §4 holds at the region's day band, night-leaning rows (Hollow, Glass, Rime: `night` > 1, `day` < 1) and tide leans (high brings Brine), weather leans (rain/storm Bolt, fog Hollow/Glass). The system adds +2 at night; rows never pre-compensate.

| Table | Rows (species day Lv, weight, leans) |
|---|---|
| `lowmoor-land` | Tossup 3–6 ·18; Puddlepip 3–5 ·12 (high, rain); Wirewhisk 4–7 ·10 (storm); Mudfist 5–8 ·9 (low); Rushling 4–7 ·5 (high); Duskwisp 3–5 ·4 (night); **Sloshkin / Scrapling / Reedkit** 3–6 ·15 each (~15%) from day 2 while not held (`fieldLog … held`) — no Ward |
| `lowmoor-water` | Bilgebob 4–8 ·45; Rillfin 3–7 ·25; Rushling ·20; Puddlepip ·10 |
| `cairnhold-land` | Mothling 9–12 ·18 (night); **Prismoth** 11–14 ·12 (night, fog; the first Ward); **Chillnub** 9–13 ·16; Tossup ·16; Mudfist ·14; Wirewhisk ·8; Rushling ·6; Knuckleback 13–14 ·4; **Cairnward** 13–14 ·3 (rare) |
| `cairnhold-water` | Bilgebob ·40; Rillfin ·25; Rushling ·20; Chillnub ·15 (night) |
| `emberstep-land` | Sootling 15–19 ·30; Sedgehare 16–20 ·24; Tossup ·12; Rushling ·10; Mothling ·8 and Prismoth 17–20 ·4 (night, to the vents' glow); Wirewhisk ·6 (storm); Emberjaw 19–20 ·4; **Squallcoil** 20–22 (Errant route) |
| `emberstep-water` | Rayling 15–20 ·50; Bilgebob ·20; Rillfin ·15; Gillwick 18–20 ·5 |
| `drownwood-land` | Rustcreel 22–26 ·26 (low); Duskwisp 22–27 ·22 (night, fog); Rushling ·20 (high); Bilgebob ·10; Creelwight 25–27 ·8 (night); Siltback 24–27 ·4; **Squallcoil** 26–28 (route) |
| `drownwood-water` | Bilgebob ·35; Rushling ·25; Rustcreel ·20; Creelwight ·12 (night); Brinelance 25–27 ·4 |
| `thistlewind-land` | Skirl 29–33 ·28; Wirewhisk ·14; Tossup ·12; Duskowl 31–34 ·12 (night); Coilcrest 32–34 ·10 (storm); Knuckleback ·10; Duskwisp ·8 (night); Gillwick ·4; **Stillox** 34 ·2 (rare); **Squallcoil** 32–34 (route) |
| `thistlewind-water` | Gillwick 29–34 ·45; Rillfin ·25; Bilgebob ·20; Strandrunner 33–34 ·5 |
| `rimeholt-land` | Rimeplate 36–40 ·30; Chillnub ·18; Floeback 39–41 ·10 (night); Strandrunner ·10 (high); Cragmitt ·8; Prismoth ·8 (night); Lumenveil 40–41 ·5 (night, fog); **Hailcoil** 40–42 and **Squallcoil** 38–40 (routes) |
| `rimeholt-water` | Strandrunner ·30; Brinelance ·25; Gillwick ·20; Floeback ·15; Bilgebob ·10 |
| `the-bar-pools` | Strandrunner 40–44 ·22; Brinelance ·20; Creelwight ·14 (night); Gillwick ·14; Hulkwight 42–44 ·8 (night); Floeback ·8; Vesperay 42–44 ·6 (night); Bogmonarch 43–44 ·3 |
| `lantern-stack-perch` | the Passenger (Vagary) Lv50 ·1, gated by the story (`passenger-perch`) |

**Errant routes** (Skyroam, one table per game hour): Squallcoil on `emberstep-land` → `drownwood-land` → `thistlewind-land` → `rimeholt-land` ("Emberstep onward", GDD-00 §8; first sighting on Emberstep's crater lookout); Hailcoil on `rimeholt-land` only. Both also visit Pellwick's lit point after the Relighting (`roam: 'lit'`, §6.2). **Wards** (Prismoth, Cairnward, Chillnub, Lumenveil) appear first on Cairnhold; Lowmoor has none.

---

## 7. Tide on the map

Tide tiles carry their window (`tideWindow`) and the clockSys way that opens them (`way`: `causeway` | `stones` | `flats` | `bar` | `spur` | `mainland`, the `TIDE_WINDOWS` keys), so the map screen and the wade rule (`world/tide.nearestDry`) read one source: causeways 150 min, stepping stones (sea and river) 120, mud flats / glow mud / the Bar 90 (the Bar only at the lower low until `lit.bar`), the mainland causeway 60, the Old Quay 90 at a spring low only. **The Bar road is two tiles** (§17.2): `bar-road-near` from the point to the spur foot opens at *every* low (`way: 'spur'`), so the Lantern Stack spur (`bar-spur`, every low) can actually be reached as GDD-00 §4 says; `bar-road` beyond the spur foot opens only at the day's lower low (`way: 'bar'`); both open at any tide once `lit.bar` is set (`openFlag`). Every tide-gated warp names its `way` too. Wet sand floods visually but stays walkable. Every Pellwick and isle warp is reachable from the entry at low water; every warp but the short ways and the Bar is reachable at high water too, and every isle is always reachable by its long way (§15) — the "no tide walls passage" rule (GDD-00 §4), asserted by `test/data.world.test.mjs`.

---

## 8. Requests

**8.1 Manifest requests.** None: every id used here is in `ids.manifest.js`. (Entity ids for trees, signs and furniture are map-local, not a manifest table.)

**8.2 Engine / system requests** (owners in brackets):
1. [WORLD-MAP / OVERWORLD] Gate each tide tile by its own window: pass `clockSys.gateTide(world, tile.way)` as the tide for that tile (and treat `openFlag` / `spring` as `tools/map-reachability.mjs` `tileOpen` does). Today every `tide:'low'` tile opens at the same `tide < 0.2` (about ±110 min), which is too narrow for causeways (±150) and stones (±120), too wide for flats and the spur (±90), and ignores the Bar's lower low. The prover already uses the real windows, so the data is proven against the intended rule.
2. [WORLD-MAP / validator] Treat `tide:'glow'` as low-only in `validate-data` passability (the loader already does).
3. [SYS-GATHER] Resolve `fruitFrom: 'native'` on tree entities to the seed's native fruit (GDD-00 §9 "one native fruit per seed"); trees carry no `fruit` id so the validator stays independent of the collections table.
4. [RENDER] Draw porch lamps from porch entities (`porch: true`, lamp cell, lit state), roofs from `autotile:'roof'` blocks, `roof-keeper` in the player's colour, `litArt` after dusk, `artByTier` in the cottage.
5. [SYS-TOWN] Set `sys.commons.<projectId>` when a Commons project is funded and `sys.lantern-market` during market hours (conditional props and stalls read them; `sys.` flags are system-owned).
6. [SYS-WORLD] Town reeds: resolved in data (§17.2): every town row that can roll after dark has a night copy capped at Lv2–3, so the +2 lands on Lv4–5. A `town` exemption in `encounter.levelFor` would let the tables drop the split.
7. [STORY / CAST] Place people by `markers` names and add step triggers over the named `regions` (§1.5–1.6).

---

## 9. Art requests

Tile art the tables name that `js/art/tiles` / `js/art/props` do not draw yet (the interior tiles, `string-wall` and `timber-stack` have landed; `ART_REQUESTS` is empty): `carnival-raft` (the Raft at the Old Pier, prop); an `abacus-counter` prop for Wren's table (the yard counter borrows `crates` today). Nice to have: a `quay-granite` ground distinct from `cobbles-b`, a `bar-spur` sand-bar tile for the Lantern Stack spur (borrows `sand-ripples`), and a `burrow-door` for the Dorrows (uses `door-arch`).

---

## 10. Validation

`node --test test/data.world.test.mjs` (green; the interior lane adds its own tests to the same file): `validateData` reports zero errors in maps/tilesets/encounters/regions with these tables swapped into `DATA` (species and story script ids stubbed only where their lanes have not landed); `checkManifest` finds maps, encounters and regions complete; every map loads through `world/tilemap.loadMap`; Pellwick holds the 20 porches (7 lit), 95 fruit / 6 purse / 4 bee trees each reachable, every warp reachable at low water with the short ways tide-gated and the long way open, interior doors round-trip, every marker on reachable ground, every resident and §12 beat named, two river and two quay reaches over water, flats and dig spots reachable, reeds the only spawn cover, and the animated-tile budget. Each isle (§15): authored 48×32 in its region and within the animated budget; Waystone (+ use trigger, chalkboard), node, ferry stop and Spire door reachable at high tide with `spire-step` below the door; exactly one short and one long way in from the previous map and out to the next, the short way made of its tide tiles (cut them and the warp's rock is off the isle), open at low and under at high, the long way open at high, and both arrivals leading to the other map's Waystone; two reaches over water hooking `<isle>-water`, ≥ 6 reachable dig spots, the 5 route-trainer posts and the isle's holds and regions; every marker on reachable ground at its tide; `<isle>-land` on cover. Plus: every edge warp round-trips (hub, isles, Bar); Rimeholt's caves dark with a 3-tile radius over the gallery, the Spire door and all mirror ice; the drowning street under at high water; the Bar's road the only way to Shardcrown, the spur the only way to the stack, the Long Road posts, ribs and pools; the isle encounter tables at their bands with night/tide leans, Wards from Cairnhold, Lowmoor's starters at ~15%, and the Errant routes. The validator scope is the world lane's exterior maps (other lanes' map errors are printed as diagnostics). Expected validator *warnings*: every short way and the Bar warps are unreachable from the entry at high tide (by design); `lit.calls` and `sp.raft-docked` are read before the story chapter sets them.

---

# Part B — Interiors, Spires and the Summit (interiors lane)

Sixteen enclosed maps: the six town interiors, the six Spires and the four Summit/stack rooms. All are `kind: 'interior'`, 16 px tiles, letterboxed inside the 30×17 view; every door sits centred in the bottom wall with the arrival cell above it (§1.7), every exit lands on the other map's step (§1.16), and every room names its people and beats in `markers` (§1.5, §1.17). Furniture follows §1.15; the cottage grows through `variants` (§1.14).

## 11. Town interiors

### 11.1 The Keeper's Cottage (`int-cottage`, 16×12) — the house that grows

One layout per house tier, picked by the build flags `systems/loans` sets when a build lands at 05:40 (`sys.build.<id>`):

| Tier | Variant | `cond` | `artTier` | What you get |
|---|---|---|---|---|
| 0 | top level (`bedsit`) | — | 0 | One room (6–10 × 7–10): a cot, a cold hearth, the storage crate, a window with the plant Wren's small talk picked. Until loan 1's roof lands (`sys.build.bedsit`) moonlight falls through a hole onto a drip bucket. |
| 1 | `cottage` | `sys.build.cottage` (loan 2) | 1 | Two rooms: the bedroom (1–3 × 6–10) with the bed and the **mirror** (lease card edits) and the hearth room (5–10 × 6–10) with the hearth, the table and the Season Book. |
| 2 | `rooms` | any `sys.build.<commission>` (loans 3–6) | 2 | Six room slots round the hearth room: **greenhouse** (1–4 × 2–4: grafting bench, beds, the potted indoor tree), **gallery** (7–9 × 2–4: tally display, canvases, Field Log plates), **training yard** (11–14 × 2–4, open to the sky: chalk ring, dummy, Tully's spot), **workshop** (12–14 × 6–10: fossil bench, relic polisher), **cellar** (a hatch in the hearth room floor), **porch & loft** (a ladder in the bedroom). A slot not built yet is sealed by Wren's chalk plan across its doorway ("GREENHOUSE? Pick it at the yard."); its fittings are entities keyed on its own build flag. |
| 3 | `lamp-room` | `sys.build.lamp-room` (loan 7) | 3 | The rooms tier plus **Lamp Room access**: the keeper's stair, a trapdoor in the hearth room (10,10) down to the tunnel under the flagstone walk, coming up in the lighthouse foot (10,13). The brass key hangs by it. |

```
 tier 0 (bedsit)        tier 1 (cottage)       tier 3 (rooms + keeper's stair)
 ################       ################       ################
 ################       ################       #W%%W##WWW#WWWW#
 ################       ################       #....##...#....#
 ################       ################       #....##...#....#
 ################       ################       #....##...#....#
 ################       #W%mWhW%WWW#####       #WmWxhWWxWWxWWW#
 ######W%WhW#####       #..........#####       #u..........x..#
 ######b...c#####       #...#......#####       #...#......#...#
 ######.o...#####       #...#.T.r.c#####       #...#.T.r.c#...#
 ######..r..#####       #b..#......#####       #b..#......#...#
 ######.....#####       #..s#......#####       #...#.H...v#...#
 ########+#######       ########+#######       ########+#######
```

`c` storage crate · `m` mirror · `x` Wren's chalk plan sealing a room not built yet (the drawing shows every seal and every hatch at once; in play each slot shows one or the other) · `H` cellar hatch · `u` loft ladder · `v` keeper's stair · `o` drip bucket (until the roof) · `h` hearth · `b` bed · `T` table · `r` rug · `s` shelf.

Markers (rooms tier; the bedsit and cottage tiers carry the same names where the thing exists): `from-door` 8,10 · `door-front` · `bed-side` · `rest-wake` · `mirror-front` · `hearth-front` · `storage-front` · `table-side` · `season-book` (solid) · `dimity-windowsill` (solid) · `loft-ladder-front` · `cellar-hatch-front` · `greenhouse-door` / `graft-bench-front` (greenhouse) · `gallery-door` / `gallery-wall` (gallery) · `training-yard-door` / `tully-training` / `training-dummy-front` (training-yard) · `workshop-door` / `workshop-bench-front` / `polisher-front` (workshop) · `porch-loft-guest` · `coda-morning` · `keepers-stair` / `keepers-stair-arrival` (tier 3); bedsit only: `bedsit-first-look`, `roof-hole`. Use verbs: `bed`, `storage`, `mirror`, `seasonBook`, `graft`, `gallery`, `workshop`, `polish`, `cellar`, `loft`. Each variant lists `furnitureSlots` (free cells for the 24 furniture pieces).

### 11.2 Pell's Sundries (`int-pells`, 14×10) — door (7,9) → Pellwick (24,20)

The shop floor: staples in the wall shelves and two island shelves, barrels and crates, the **disc case** (`discs`, two a day), the **Wanted Today** chalkboard (`wantedToday`), Juniper's **counter** across the east side (`shop`, `pells-sundries`). Behind it, through the curtain (11,4), the **back room**: the heirloom shelves and, on the high shelf (11,1), **Isolde's Lantern** (a prop, gone after `sp.relighting`), and the Ebb winter credit ledger nobody repaid. The back room and the till are staff-only.
Markers: `from-door` 7,8 · `juniper-counter` 10,5 (staff) · `juniper-till` (staff) · `juniper-back-room` (staff) · `juniper-ledger` (staff) · `counter-front` 10,7 · `disc-case-front` 4,7 · `wanted-today-front` 11,8 · `isolde-lantern-shelf` (solid) · `heirloom-shelf` (solid) · `browse-staples` · `browse-island` · `browse-barrels` · `pells-window`.

### 11.3 The post office (`int-post-office`, 12×10) — door (6,9) → Pellwick (48,20)

The public room with the long counter and **Hesper's lamp** (`hesperCounter`, 18:00–02:00; it lights on night one when you carry the mail sack in), the outgoing post box and the queue bench; a hinged **flap** (8,6) lets you round the counter. Behind, through (5,4), the **sorting room**: pigeonholes, the sorting table, **Mabry Coil's day book** on its desk, and the **old post sack**, stitched shut thirty years (gone at `sp.late-delivery`).
Markers: `from-door` 6,8 · `hesper-counter` 4,5 · `post-counter-front` 4,7 · `mail-sack-drop` 5,7 · `hesper-sorting` 6,3 · `sorting-table-front` · `old-post-sack` (solid) / `old-post-sack-front` · `mabry-daybook-front` · `counter-flap` · `queue-1` · `queue-2` · `party-hesper` · `party-1` · `party-2` · `party-3` · `party-sack-opening` (the Late Delivery party).

### 11.4 Barnaby's Archive (`int-archive`, 16×12) — door (8,11) → Pellwick (32,20)

The **string wall** fills the back wall's west half (`stringWall`), the **Field Log plates** the rest (`fieldLog`); Barnaby's **desk** by the door (`shop` `archive-desk`, `relearn`); his **diving helmet** home by the front **porthole** at (10,11), which is the porthole the town sees at (34,19) beside the door (32,19) and which he fogs from inside; after `sp.bell-dug` he lives in the **fleet's bell** and the helmet stands as "Exhibit 1: My Old House". The **Shiftlog wall** (`shiftlog`), fish tanks, bug case and the fossil/relic shelves line the walls; **Corin's reading desk** (8,4) is the Recall desk (`recall`, from badge 4, `{badge: 'hollow'}`); **Corin's loft** is the raised platform (12–14 × 2–4) behind its railing, up the stair (12,5): desk, bed, books, his Tossup's perch. Odile's canvases hang in the south-west corner once *Twelve Lights* is done.
Markers: `from-door` 8,10 · `barnaby-desk` 5,7 · `archive-desk-front` 5,9 · `barnaby-porthole` 10,10 · `barnaby-helmet` (solid) / `barnaby-helmet-front` · `barnaby-string-wall` · `string-wall-front` · `field-log-front` · `shiftlog-front` · `corin-desk` 8,3 · `recall-front` 8,5 · `corin-loft-stair` · `corin-loft` · `corin-loft-desk` · `corin-loft-bed` · `corin-loft-rail` · `fish-tanks-front` · `finds-shelves-front` · `odile-gallery` · `bell-exhibit` (solid) · `barnaby-bell-home` · `helmet-exhibit` · `reader-1` · `reader-2`.

### 11.5 The co-op yard shed (`int-yard-shed`, 14×10) — door (7,9) → Pellwick (56,26)

Wren's desk with the **Hearth Ledger** and the big **abacus** (`ledger`; payments themselves are at the yard counter outside), the **tally wall** with seven pegs (a `split-stick` prop per loan cleared: `{loan: {tier: {gte: n+1}}}`, the seventh on `{loan: {tier: {gte: 7}, paid: true}}`), Ambrose's workbench and alder planks, the **plans table** (`commission`) where the **Lamp Room model** appears when Wren offers it (`sp.lamp-room-offered`), Peg the Scrapling's basket.
Markers: `from-door` 7,8 · `wren-ledger` 6,2 · `wren-abacus` · `ledger-front` · `abacus-front` · `tally-wall-front` · `ambrose-workbench` · `ambrose-planks` · `plans-table-front` · `lamp-room-offer-wren` 11,4 · `lamp-room-offer-player` 11,6 · `lamp-room-model` (solid) · `peg-basket` (solid) / `peg-basket-front` · `shed-window`.

### 11.6 The lighthouse: stair and Lamp Room (`int-lighthouse`, 12×18) — door (6,17) → Pellwick (4,19)

Three levels stacked. **The foot** (rows 12–16): Isolde's desk and tide log, the empty oil cans, her coat on its hook, the stair foot (8,12), the keeper's stair trapdoor (10,13: shut under a flagstone until `sys.build.lamp-room`, then a `stairs` warp to the cottage). **The stair** (rows 6–10): a ring of steps round the solid newel; one rotten tread per loan is replaced (decorative props, `{loan: {tier: {lte: n}}}`), mirroring the scaffold outside, never a wall. **The Lamp Room** (rows 2–4), up through the hatch (3,5): the great **lens** at (5,4) (32×32, `collision` holds its footprint; its beam glow waits on `sp.relighting`), glazing all round, the north panes looking out at the **Lantern Stack** (`lantern-stack-window`), cracked panes and a tarpaulin until loan 7's build, the brass oil reservoir after. The Lamp Room is open to climb all game ("visible from the Lamp Room all game"); loans gate only its restoration.
Markers: `from-door` 6,16 · `isolde-desk-front` · `oil-cans-front` · `stair-foot` 8,12 · `stair-landing` · `stair-top` · `lamp-room-hatch` 3,4 · `lantern-stack-view` 6,2 · `relight-player` 4,4 · `relight-wick` 7,4 · `relight-lens` (solid) · `ambrose-lamp-room` · `credits-lamp-room` · `keepers-stair` / `keepers-stair-arrival` · `ambrose-foot`.

## 12. The six Spires (20×14 each; door (10,13), arrival (10,12))

Every Spire: a themed hall, the **dossier board** just inside the door (a `commons-board` entity with `verb: 'dossier'`, `spire: <id>`, and its blocker; the same dossier the Commons board posts), the leader on a 4×2 `spire-dais` at the head of the hall (`leader-dais`, `<leader>-dais`), the `challenger-spot` below it, posts for every sentinel or round in `spires.js` order, and an exit landing on the isle's `spire-step`. `music: 'battle_spire'`.

| Map | Isle | Theme as a room | Posts | Exit → |
|---|---|---|---|---|
| `spire-turn` (12.1) | Lowmoor | the old ferry pavilion's turning hall: marsh pools with glasswort in the corners, the plank **turntable** round a compass rose, Maud's ship's wheel behind the dais, three **card plinths** (Up / Side / Down) that light with the posted strip | `maud-dais` 10,2 · `challenger-spot` 10,5 · `strip-up/side/down` (solid) · `maud-wheel` (solid) · `turntable-centre` · `spectator-west/east` | `lowmoor` (6,8) |
| `spire-ward` (12.2) | Cairnhold | a cut-granite hall crossed by two **lattices** of standing stones and quarried blocks, each with one gap guarded by a stone **sentinel**; the walk zigzags east gap (14,8) → west gap (5,5) → the apse | `sentinel-east` 14,8 (`ward-sentinel-east`) + challenger 14,10 · `sentinel-west` 5,5 (`ward-sentinel-west`) + challenger 5,7 · `osric-dais` 10,2 · `challenger-spot` 10,4 | `cairnhold` (40,17) |
| `spire-weather` (12.3) | Emberstep | a spa hall in the volcano with the four arena weathers in its corners in cycle order: **steam** (hot springs, SW), **ash** (ash and ember vents, NW), **squall** (wind-combed heather and gorse, NE), **clear** (flowers under the skylight, SE); the posted cycle chalked by the door | `ines-dais` 10,2 · `challenger-spot` 10,5 · `steam/ash/squall/clear-corner` · `weather-board-front` | `emberstep` (6,17) |
| `spire-hollow` (12.4) | Drownwood | Wendel's boat shed round a drowned grove: tannin water, hull ribs, drowned trees, one plank walk winding from the slipway landing to the dry bow deck; an unplanked hull on the stocks ("a hull is mostly what is not there") | `wendel-dais` 10,2 · `challenger-spot` 10,5 · `walk-turn-east/west` · `hull-bow` | `drownwood` (24,10) |
| `spire-relay` (12.5) | Thistlewind | a moor mill barn fenced into three rings, one per round, each opening to the next; heather and gorse in from the walls; the sitters' bench; the roster board's rule | `ivo-post` 10,9 + `relay-round-1-player` · `ada-post` 10,5 + `relay-round-2-player` · `hallorans-dais` / `ada-dais` / `ivo-dais` + `relay-round-3-player` · `sitters-bench-front` | `thistlewind` (26,8) |
| `spire-mirror` (12.6) | Rimeholt | an ice cave polished to mirrors: mirror-ice banks, four glacier pillars (the two by the dais are where the afterimages flicker, never more than two), a short light radius; **Idris's gallery** behind an ice wall and rail in the north-east | `seraphine-dais` 10,2 · `challenger-spot` 10,5 · `decoy-1/2` (solid) · `idris-gallery` 16,2 (apart) · `gallery-look` | `rimeholt` (16,6) |

## 13. The Summit and the Lantern Stack

### 13.1 Hollis's Gate (`hollis-gate`, 20×14, open to the sky) — door (10,13) → the Bar (59,11) `hollis-gate-step`

The walled gate court on Shardcrown's rim: the **Hollis's Gate Waystone** (entity id `hollis-gate`, `waystone: true`, `use` verb `waystone`) with its tide chalkboard beside it; Hollis's desk with the **Readers' fund** box (`readersFund`) and the Ration Ledger; the **Summit dossier** board; supplies; skyglass in the masonry; braziers flanking the **Summit gate** in the north wall (10,0), barred (`gate-bars` entity) until `sp.summit-open`, then a door to the Keepers' Hall. `music: 'summit'`.
Markers: `from-door` · `waystone-front` 5,7 · `chalkboard-front` · `hollis-desk` 15,3 · `desk-front` · `readers-fund-front` · `hollis-gate` 11,2 (Hollis at the gate) · `summit-gate` 10,1 · `summit-gate-player` 10,3 · `dossier-front` · `gate-bench-front` · `supplies` · `wade-arrival` (where the wade rule sets you down when the Bar floods).

### 13.2 The Keepers' Hall (`keepers-hall`, 20×14) — south (10,13) → Hollis's Gate (10,1); north (10,0) → Idris's Hall (10,12)

The **old brazier** the Keepers tended through the dark years on its round hearth in the middle; Bastien's salvage side (west: a lost Pellwick boat's ribs, net racks, creels, the fleet's nameboards), Cass's weather side (east: vanes, chimes, the sky window). Bastien fights at the foot of the hall, Cass by the north door (`spires.js` SUMMIT order); no Waystone between fights.
Markers: `from-door` · `from-idris-hall` 10,1 · `bastien-post` 6,10 (`bastien-keeper`) / `bastien-challenger` 9,10 · `cass-post` 13,3 (`cass-keeper`) / `cass-challenger` 10,3 · `old-brazier` (solid) · `brazier-front` · `north-door` · `bell-restart-bastien` · `bell-restart-cass`.

### 13.3 Idris's Hall (`idris-hall`, 20×14) — door (10,13) → the Keepers' Hall (10,1)

The top of the atoll: great windows over the **Starfall Lagoon**, two reflecting channels down the nave, Idris on the dais with his Vesperay's **anchor stone** on its pedestal (gone after `sp.idris-beaten`), the **Summit Bell** just inside the door (`summitBell`, script `summit-bell`; restarts you at whoever beat you).
Markers: `from-door` · `idris-dais` 10,2 (`idris-champion`) · `challenger-spot` 10,5 · `bell-restart-idris` · `summit-bell-front` · `vesperay-anchor` (solid) · `anchor-release-idris` · `anchor-release-player` · `anchor-release-vesperay` · `summit-seal` · `lagoon-window` · `linnet-coda`.

### 13.4 The Lantern Stack (`lantern-stack`, 20×16, open to the sky) — door (10,15) → the Bar spur (29,2) `lantern-stack-step`

A turf-and-heather top inside a rim of cliff, sea on every side, shingle where the spray lands, the stair cut down the south face, and the basalt **perch** spur (9,3) at the north edge. **Act III** (`sp.two-plans`): Merrow's **Sinking Engine** in the middle (2×2: entity + blockers) and Varga's **three charges** on the rim (gone at `sp.charges-pulled`); both gone after `sp.relighting`. **The finale**: the shore party on the south ledge, the Passenger lands in the middle, seven phases (`THE_READING`). **Post-game**: the Passenger sits on the perch, catchable (`roamer` `the-passenger`, `speciesId: 'vagary'`, table `lantern-stack-perch`; a rate-0 perch spawn names the table), while `sp.reading-done` and not `sp.passenger-caught`.
Markers: `from-door` 10,14 · `stair-head` / `crossing-arrival` / `lamp-view` 10,12 · `engine` (solid) · `merrow-engine` 8,9 · `engine-player` 10,10 · `merrow-halts` · `charge-1/2/3` (solid) · `linnet-charges` · `wick-charges` · `varga-stack` · `reading-player` 10,9 · `reading-passenger` 10,6 · `reading-corin` · `reading-wick` · `reading-linnet` · `reading-merrow` · `reading-varga` · `reading-idris` · `passenger-perch` (solid) · `passenger-perched` (solid) · `perch-front` 10,6.

## 14. Interiors: requests, art, validation

**14.1 Manifest requests.** None: map, Waystone, trainer, script and encounter ids are the manifest's. Map-local ids (entities, triggers, markers, the sentinel ids from `spires.js`) are not manifest tables.

**14.2 Engine / system requests** (owners in brackets):
1. [WORLD-MAP / OVERWORLD] Honour `variants` (§1.14): on entering a map and after a build lands, show the last variant whose `cond` holds; read `artTier` for `artByTier` tiles. Until then the cottage stays a bedsit.
2. [WORLD-ENT / RENDER] Treat art-less `blocker: true` entities as invisible solid cells (they already are: no art draws nothing).
3. [FLOW] Verbs these rooms use that need handlers: `storage`, `mirror`, `seasonBook`, `graft`, `gallery`, `workshop`, `polish`, `cellar`, `loft` (cottage); `discs`, `wantedToday` (Pell's); `hesperCounter` (post office); `stringWall`, `fieldLog`, `relearn`, `recall`, `shiftlog` (Archive); `ledger`, `commission`, `tallyWall` (yard shed); `dossier` (Spires, Hollis's Gate); `readersFund`, `summitBell` (Summit). Triggers with a `text` are plain "look" lines.
4. [BATTLE / STORY] The Keepers' Hall north door and the Spires are not gated by a flag: the battle flow keeps Bastien → Cass → Idris order (`spires.js`); if a "keeper beaten" flag lands, add it as the north door's `cond`.
5. [SYS-LOANS] The tally wall's seventh stick reads `{loan: {tier: {gte: 7}, paid: true}}` because the last tier stays open at full payment.
6. [THREADS] The Archive's canvases read `{thread: {id: 'twelve-lights', done: true}}`; the validator flags it until `DATA.threads` carries the thread rows (`js/data/threads/` has them).

**14.3 Art requests** (prop / entity art these rooms name that `js/art` does not draw yet), by priority:
- *Story-critical:* `isolde-lantern`, `sinking-engine` (32×32), `scatter-charge`, `summit-seal`, `anchor-stone`, `fleet-bell`, `diving-helmet`, `post-sack`, `gate-bars`, `trapdoor`, `mirror`, `card-plinth`, `ferry-wheel`, `split-stick`, `abacus`.
- *Room character:* `chalk-plan`, `chalk-ring` (32×16), `training-dummy`, `workbench`, `field-log-plates`, `tally-display`, `canvas-frame`, `display-case`, `fish-tank`, `bug-case`, `perch`, `heirloom-shelf`, `letter-rack`, `day-book`, `tide-log`, `keepers-coat`, `lamp-room-tarp`, `oil-reservoir`, `rotten-tread`, `lamp-room-key`, `lamp-room-model`, `commission-plans`, `peg-basket`, `season-book`, `windowsill-plant`, `drip-bucket`, `fund-box`, `ration-ledger`, `weathervane`, `fleet-nameboard`, `compass-rose` (32×32), `hex-lattice`, `jackdaw-feathers`.
- *Nice to have:* a `dossier-board` distinct from `commons-board`; a `void` tile for the unbuilt dark of the cottage (it uses `cottage-wall-top`).

**14.4 Validation.** `node --test test/data.world.test.mjs`, section *INTERIORS, SPIRES AND SUMMIT ROOMS*: `validateData` reports zero errors in the 16 maps and in each cottage tier (expanded as extra maps `int-cottage~<tier>`; thread rows stubbed until that lane lands); none is a stub; every door is centred with the arrival above it; every exit round-trips with the map it opens onto and lands on its `toMarker`; under three world states (start, mid game, everything built) every marker, warp, use trigger and furniture verb is reachable from the door (staff / apart / unbuilt-room markers excepted); the cottage tiers grow and seal unbuilt rooms, and the keeper's stair links cottage and lighthouse both ways only once built; the town rooms hold their counters, string wall, porthole, loft, tally pegs and lens; each Spire has its themed tiles, dais, challenger spot, sentinel posts and dossier; Hollis's Gate holds the `hollis-gate` Waystone and the barred gate, the summit chain climbs in `spires.js` order, and the Lantern Stack carries the Engine (Act III only), the shore party for the Reading and the perch. Expected validator output for these maps until other lanes land: the Archive's `twelve-lights` thread cond and the Passenger's `vagary` species (placeholder tables), and "flag read but never set" warnings for story flags.

---

## 15. The isles and the Bar (isle lane)

The six isles and the Bar replace their stubs (GDD-00 §4, §16). Every isle holds the §3.2 list: a low-tide **short way** and an any-tide **long way** in from the previous map (both drawn on the map, both arriving within walking distance of the same Waystone), the dock **Waystone** with its tide chalkboard, a **skyglass node**, **two reaches** hooking `<isle>-water`, a **dig site**, the **5 route trainers** at `trainer-<trainerId>` posts, a **ferry stop** (`ferry-stop` marker + the `ferry` use trigger on Maud's punt), the **Spire door** and the isle's holds as markers. Shared conventions on top of §1:

- **15.0.1 Edges.** Every crossing between maps is an edge warp on the last cell at the map edge; its arrival on the other map is the cell just inside the matching warp back (the round trip is tested). The short way's warp sits on a dry rock (`q`/`>`) at the very edge with its tide tiles just inside (stones `e` ±2 h, causeways `E` ±2.5 h), so it is tide-gated by tiles, never by the warp; the long way's warp sits on an any-tide tile (boardwalk `k`, stone bridge `N`, wooden footbridge `B`, path `P`, ice `x`).
- **15.0.2 The ring** (geography as GDD-00 §4's map: Lowmoor west of the point, Cairnhold south of it, Emberstep far east, Drownwood and Thistlewind north of it, Rimeholt north-west):

| From → to | Short way (tile, window) | Long way (tile) | Cells (warp → arrival) |
|---|---|---|---|
| Pellwick → Lowmoor | stepping stones `e`, ±2 h | marsh boardwalk `k` | short (0,38) → (46,22); long (13,0) → (46,4) |
| Lowmoor → Cairnhold | causeway `E`, ±2.5 h | quarry road over the stone bridge `N` | short (27,31) → (27,1); long (6,31) → (6,1) |
| Cairnhold → Emberstep | stepping stones `e`, ±2 h | cliff path `P` | short (47,20) → (1,20); long (47,8) → (1,8) |
| Emberstep → Drownwood | causeway `E`, ±2.5 h | mangrove boardwalk `k` | short (40,0) → (40,30); long (12,0) → (12,30) |
| Drownwood → Thistlewind | causeway `E`, ±2.5 h | moor footbridge `B` | short (30,0) → (30,30); long (10,0) → (10,30) |
| Thistlewind → Rimeholt | stepping stones `e`, ±2 h | ice path `x` | short (0,22) → (46,22); long (0,8) → (46,8) |
| Pellwick → the Bar | Bar road `b`, ±1.5 h of the lower low (`lit.bar`: any tide) | — | (6,0) → (1,12) |

Each warp back is the mirror (e.g. Cairnhold (27,0) → Lowmoor (27,30)). Rimeholt has no onward walking route: the ring closes by Maud's ferry and the Lantern-paths.
- **15.0.3 Entry** is the dock (the ferry and Lantern-path arrival) beside the Waystone; from it the Waystone, the Spire door, the ferry stop and both long-way warps are reachable at high tide and every warp at low tide (validator + `test/data.world.test.mjs`).
- **15.0.4 The Spire door** is a `door-arch` in the Spire's stone face, warping to `spire-<id>` (10,12); the cell below it carries **`spire-step`** (and `spire-<id>-step`), which is where the Spire interior's door must let you out (the Spire interiors exit with `toMarker: 'spire-step'` onto these cells: Lowmoor (6,8), Cairnhold (40,17), Emberstep (6,17), Drownwood (24,10), Thistlewind (26,8), Rimeholt (16,6)).
- **15.0.5 Posts.** Route trainers stand where the player's path passes their line of sight, two per approach and the rest round the Spire and the isle's landmark; declinable (optional) trainers off the main line. Markers carry `trainer`, `npc`, `optional` and `note` for the cast and story chapters; `tide: 'low'` marks posts only reachable around low water (the drowning street, the Bar).
- **15.0.6 Wild cover.** `<isle>-land` rolls on `spawn: 'grass'` cover (tall grass, reeds, heather, thistles; rate 0.10), plus Lowmoor's flats (`mud`, 0.07) and Rimeholt's caves (a rect, 0.06). `<isle>-water` is hooked through the two reaches (a `rate: 0` spawn names it so the validator sees it used). Reach kinds: one `river` and one `lagoon` (or Lowmoor's `flats`) per isle (`collections.REACH_KINDS`).


### 15.1 Lowmoor (`js/data/maps/lowmoor.js`) — isle 1, Lv3–8, Waystone Brackenford, the Turn Spire

A low, wet isle west of the point. **North-east**: the marsh (marsh turf, reed beds = the wild cover, tidal creeks, glasswort) crossed by the **marsh boardwalk** in from Pellwick (the long way, any tide; arrival (46,4)); the **skyglass node** glints in the reeds beside it (38,5). **East**: the shingle spit with **Linnet's rematch stones** (a ring of four boulders round (36,19)), the **Pellwick stepping stones** (39–44, 22) over the channel to the last dry rock (the short way, ±2 h; arrival (46,22) on the rock), and the **Brackenford flats** (mud, glow seams, pools, seaweed: the two starters you did not pick, the second reach is the stones channel). **Centre**: **Brackenford** on the cove where the Brack meets the sea: Ford Street over the old ford (a stone bridge now), the **old ferry pavilion** (open arch, Hobb's tide slate) with **Maud's practice table** on its deck, the quay with bollards, the **Waystone** at the pier head (22,22) and the **ferry stop** at the pier end (21,27). **North and west**: the meadows (tall grass), the spring pool the Brack rises from (the first reach), the **Turn Spire** on its knoll (door (6,7)). **South**: the **causeway** to Cairnhold (short way, ±2.5 h) and the **quarry road** over the old stone bridge (long way, any tide); the **peat cuttings** (dig site) in the south-west.

Route trainers: Osier (Reed Cutter) in the reed beds under the boardwalk; Perrin (Marsh Walker) where the boardwalk comes down; Dunlin (Mudlarker) on the spit above the flats; Colm (Ferry Hand, declinable) on the pier; Tibby (Pavilion Regular, declinable) on the deck. Story posts: `corin-lowmoor-stones` / `corin-first-forecast` (the stones at the low, minute ~27), `linnet-decline` (day 2), `maud-practice-table` + `practice-table-player` (the Reroll lesson), `linnet-rematch-stones` = `trainer-linnet-brackenford` + `rematch-player`, `hobb-pavilion`, `hobb-tide-board`, `wick-lowmoor`.

Map key: ground with detail over it; `W` Waystone, `¤` skyglass node, `§` sign, `ß` boat, `•` other prop entities. Legend chars as in the file header.

```
     000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
   0 DDSSSSSSSSSSSSDDDDDDDDDDDDSSSSSSSSSSSSSSSSSSSSDD
   1 DSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSAASSSSASSSSSSSSS
   2 SSSSGGGGGG8ASSSSSSSSSSSSSSSSAAAAUUUSSSSSUUUASSSS
   3 SSSG333338GAASSAAAASAASASAA8UUUUUrrUrrrSrUrrUUSS
   4 SSAG33333GGuAAAAGGAAAAAA9UUUUUkkkkkkkkkkkkkkkkkk
   5 SAAG33333GGuuGGGGGTTTTTTTUUiiUkUrrrrrr¤SrUrrrrrU
   6 SSAGs]s]sGGRRRRRgGTTTTTTTUUUUrkrrrrrrrrSrrUUrUUU
   7 SSAGss"ssGGRRRRRGGTTTTTT44444ikrrSSSSSSSSSSSSrUG
   8 SSSGGGfGGGG9GGRRGGGTT9TT44444SkSSSrriUUrrrrrSrAU
   9 SSSSGGfff§GGGGRRGGG9,GGG#%#%#UkirrUrrrrriUrrSSSS
  10 SSSSATTTfPPPPPBBPPPPPPPG##+##Gk,UiUUUUUUUUAASSSS
  11 SSAAATTTPvTTG,RRRRRG9GPG,TPTTTkG9ASASASSSSSSSSSS
  12 SSSATTTTPTTTG9GGGRR9GGPGGTPTTTk§GAASSSSSSSSSSSDD
  13 SSSAATTTPTTGvGg9GRRGGGPPPPPPPPPGG9AASSSSDDDDDDDD
  14 SSASATTTPTTT,GGg,RRG2222211111G8gGGAASSSDDDDDDDD
  15 SSS2222TP4444444GRRG2222211111GGGGGGAASSSSSSSSSS
  16 SSS2222TP4444444GRRG#%#%#${${$GGGoqqqqSSSSSSSSSS
  17 DSSs]ssgP${${${$GRR,##+##$$+$$G,§qqqqqoSSSSSSSSS
  18 DDSss@sA§$${"{$•LRRGL*,PGGGvGLGG,qq0q0qSSSSSSSSS
  19 DDSSSPPP:OOOOOOOONNOOOOOOOOOOOOOOqqqqqqSSSSSSSSS
  20 DSSSAAAA:p•ppp•ppRR•GGGGG8GGGGgGGqq0q0qSSSSSSSSS
  21 SSSS***G:(QQQQQQQNNQQQQQ(QGGGGAAAoqqqqqSSSSSSqqS
  22 SSSA9GG§:TcTG)Q)QNNQQQW•Q)::gGASSqqqqqqeeeeeeqqq
  23 SSAAGG:::TTGGAAAARRSSKSAGGG:§GAASMlMMMMYMMMSSqqS
  24 SSA;;G:GG;;;;ASßSSSSSKSAAGG:GGAMMYMMMMMMMMlMMSSS
  25 SSS;;G:GG;;;;ASSSSSSDKSSAAG:GAAMMMMMMMMMMMMMMMlD
  26 SSS;;G:GG;;;9ASSDDDDDKSSS8A:AMMMMMMlMMMMM~MMMMlM
  27 DSSAAA:9GGGAASSSDDDDDKßSSSA:ASlMYMMYMMMMMMMMYMlD
  28 DSSSSA:AAAA8SSSSDDDDDDDSSSSESSYMMlMMlMMMMMMMMYMD
  29 DSSSSSNSAASSSSSDDDDDDDDDSSSESSSMMMMMMMMMMMMMMDDD
  30 DDDSSSNSSSSSSSDDDDDDDDDDDDDEDDDDDMMMMYMMMM~MDDDD
  31 DDDDDDNSSSSSDDDDDDDDDDDDDDDqDDDDDDDDDDDDDDDDDDDD
```

| Cell | Kind | To | Notes |
|---|---|---|---|
| (47,22) | edge | `pellwick` (1,38) | short-way ±120 min |
| (47,4) | edge | `pellwick` (13,1) | long-way |
| (27,31) | edge | `cairnhold` (27,1) | short-way ±150 min |
| (6,31) | edge | `cairnhold` (6,1) | long-way |
| (6,7) | door | `spire-turn` (10,12) |  |

**Markers** (30): `ferry-stop` 21,27 · `maud-punt` 22,27 (water) · `door-spire-turn` 6,7 · `spire-turn-step` 6,8 · `spire-step` 6,8 · `from-pellwick-stones` 46,22 (low) · `from-pellwick-boardwalk` 46,4 · `from-cairnhold-causeway` 27,30 (low) · `from-cairnhold-road` 6,30 · `brackenford-dock` 21,22 · `trainer-lowmoor-osier` 34,5 · `trainer-lowmoor-perrin` 31,9 · `trainer-lowmoor-dunlin` 33,20 · `trainer-lowmoor-colm` 21,25 · `trainer-lowmoor-tibby` 11,20 · `hobb-pavilion` 12,19 · `hobb-tide-board` 24,22 · `maud-practice-table` 15,20 · `practice-table-player` 13,20 · `maud-brackenford-pier` 21,26 · `linnet-rematch-stones` 36,19 · `trainer-linnet-brackenford` 36,19 · `rematch-player` 34,19 · `linnet-decline` 37,21 · `corin-lowmoor-stones` 38,22 · `corin-first-forecast` 36,22 · `wick-lowmoor` 22,21 · `turn-spire-door` 6,8 · `pavilion-door` 12,18 · `pellwick-view` 44,4

**Regions:** `brackenford` 8,14 27×10 · `ferry-pavilion` 9,15 8×6 · `brackenford-dock` 19,21 7×7 · `the-marsh` 23,1 25×12 · `boardwalk` 29,3 19×10 · `brackenford-flats` 29,23 18×8 · `rematch-stones` 33,16 6×7 · `the-meadow` 3,9 26×6 · `turn-spire` 3,3 7×7 · `peat-cuttings` 2,23 12×5 · `short-way-pellwick` 38,20 10×5 · `long-way-pellwick` 29,3 19×3 · `short-way-cairnhold` 26,26 3×6 · `long-way-cairnhold` 5,22 4×10

**Use triggers:** `waystone-brackenford` 22,22 waystone · `tide-board-lowmoor` 23,22 tideTable · `ferry` 22,27 ferry · `node-lowmoor` 38,5 chip · `maud-practice-table` 14,20 look · `pavilion-tide-slate` 15,18 tideTable

**Reaches:** `reach-brack` (river, 11,6 5×2) · `reach-flats-channel` (flats, 39,17 6×4) · **Dig spots:** 9,24 10,25 11,26 12,24 3,24 4,26 10,26 12,25


### 15.2 Cairnhold (`js/data/maps/cairnhold.js`) — isle 2, Lv9–14, Waystone Knapp's End, the Ward Spire

The granite isle the Mooring cuts its anchor stones from. **North-west**: the **quarry** (quarry faces `X`, the gravel floor, spoil blocks, a flooded pool, the terrace steps); the **skyglass node** is a vein in its north face (14,3); the spoil is the **dig site**; the **quarry road** comes down a cut from Lowmoor (long way, any tide; arrival (6,1)). **North**: the **causeway** landing from Lowmoor (short way, ±2.5 h; arrival (27,1)) and the road south. **Centre-east**: the hill of moor turf with the **standing stones** (eight round a fallen king-stone), the **Ward Spire** beyond (door (40,16)), the **cliff path** along the north-east ridge to Emberstep (long way, any tide) and the shingle beach with the **stepping stones** to Emberstep (short way, ±2 h). **South**: **Knapp's End** on its harbour: the quay, the pier and **ferry stop** (24,28), the **Waystone** (25,24), the **Mooring clinic** (Wynn Cobble's counter at the door: `use` verb `shop`, shop `cairnhold-clinic`), the stonecutter's shed, **Mags Penny**'s boat. **South-west**, on the headland: the **memorial** to the Night of Wrong Shapes (`memorial-stone` prop, Quill Hartsease keeps it; the first reach is the quarry stream, the second Knapp's harbour on the lagoon).

Route trainers: Ruddock (Quarryman) on the quarry floor; **Prudence** (Mooring Clerk, the first mandatory Ward) past the clinic on the way to the Spire, so Crackdust is on sale before her; Jory (Stonecutter) inside the stone ring; Ellery (Lamp Pilgrim, declinable) on the memorial walk; Bette (Quarry Forewoman, declinable) by the terrace steps. Story posts: `cairnhold-memorial`, `merrow-memorial`, `quill-memorial`, `memorial-player` (script `cairnhold-memorial`); `mags-dock` (script `anchorage-turns-away` stages Mags here); `trainer-wick-cairnhold` / `wick-cairnhold` on the causeway road; `osric-quarry`, `osric-shed`, `wynn-clinic`, `clinic-door`.

Map key: ground with detail over it; `W` Waystone, `¤` skyglass node, `§` sign, `ß` boat, `•` other prop entities. Legend chars as in the file header.

```
     000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
   0 DDDSSSNSSSSSSSSSDDDDDDSSSSDqDSSSSDDDDDDDDDDDDDDD
   1 DDSSSSNSqqSSSSSSSDDDDSSSSSSESSSSSSDDDDDDDDDDDDDD
   2 DSSSSq:§XXXXXqSSSSSSSSSSqqqEqqqSSSSDDDDDDDDDDDDD
   3 DSSSqX:XX:XXXX¤SSSSSSSSqqGgPgGqqSSSSSDDDDDDDDDDD
   4 SSSqXX::0::::0:XXXSS8q8qygGP§8GqqSSSSSDDDDDDDDDD
   5 SSSXX::::•:::::::XqqqTTTgGGPGgGCSCSSSSSSSSSSSSSS
   6 SSXXH::::::::::0:XXTTTTT8g8PGT8CCCCCCCCCCCCCCCCC
   7 SSSXH:::::::u::::XXTTTTTTGGPTTTCChCCCCCCCCChCCCC
   8 SSSX:::::::uuu:::XTTTTTTTGGPPPPPPPPPPPPPPPPPPPPP
   9 DSSSX0::::::u:::::::TTTTGGGPFF§CCCCCCChCCCCCCCCC
  10 DSSSSX:0::::R::X:GG:TG2222FPFFFyCCCCSSSSSSSSSSSS
  11 DSSSSXXXXX:XRXXXGGy:GG2222FPFFFFF?FFFFFFqqSSSSSD
  12 DSSSqqGGXXXXRGGgGGG:G8s]ssFPFF?FFFFF?F^^^^^SSSSD
  13 DSSq8GGGGGGGRGGg8GGPGGs@]sFPF?FFFFFFFF^^^^^F8SSD
  14 DSSqqGG8GGGyRG8gTTTPPPPPPPPPPPPPPPPPPF^^^^^FSSSD
  15 DSSSqRRRRRRRRGTTTTTTTG8GGFFPFFFFF•FFF?s]s]sSSSSD
  16 DSSSqRGGyGgGPGTTTTTTTGGG8GFPFF?FFFPF?Fss"ssFSSSD
  17 DDSRRRGGGgGGPGTTTTTTTGGGGGFPFFFFF?PFFFFFfFFFSSSS
  18 DDSSq8GGGgGGPg11111T^^^^^GGP555555PPPFFFPFFFqSSS
  19 DDSSSqGGgGGGPG11111G^^^^^ggP555555GGGPG§q§qqqSSS
  20 DSSSqqGGGGGGPGw[w[wG#%#%#gGPs]s]ssTyTPPqqqqqqeeq
  21 DSSSqGfffGGGPLww§wwL##+##GLPss@•]sTTTTTyqqqqqSSS
  22 DSS8qff•ffGGfOOOOOOOOOOOOOOOGgOGGG8Tqqqqqq8qqSSS
  23 DSSqGffffffffGGgGc(QQQQQQQQQQQcgGqqqqSSqqqqqSSSS
  24 DSSqqffff•qqqqqGGQ)Q)QQQQW•Q)Q)qqqSqSSSSSSSSSSSD
  25 DSSSqqGGGGqSSSqqSSSSSSSSKSSSSSSSqqSSSSSSSSSSSSDD
  26 DSSSSqqqq8qSSSSSSSSSSßSSKSSSSSSSqSSSSSDDDDDDDDDD
  27 DDSSSSqqSSSSSSSSSSSSSSSSKSSSSSSSSSSSDDDDDDDDDDDD
  28 DDDSSSSSSSSSSDDSSSSSSSSSKßSSSSSSSSSDDDDDDDDDDDDD
  29 DDDDSSSSSSDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
  30 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
  31 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
```

| Cell | Kind | To | Notes |
|---|---|---|---|
| (27,0) | edge | `lowmoor` (27,30) | short-way ±150 min |
| (6,0) | edge | `lowmoor` (6,30) | long-way |
| (47,20) | edge | `emberstep` (1,20) | short-way ±120 min |
| (47,8) | edge | `emberstep` (1,8) | long-way |
| (40,16) | door | `spire-ward` (10,12) |  |

**Markers** (28): `ferry-stop` 24,28 · `maud-punt` 25,28 (water) · `door-spire-ward` 40,16 · `spire-ward-step` 40,17 · `spire-step` 40,17 · `from-lowmoor-causeway` 27,1 (low) · `from-lowmoor-road` 6,1 · `from-emberstep-stones` 46,20 (low) · `from-emberstep-cliff` 46,8 · `knapps-end-dock` 24,24 · `trainer-cairnhold-ruddock` 10,10 · `trainer-cairnhold-prudence` 34,18 · `trainer-cairnhold-jory` 33,13 · `trainer-cairnhold-ellery` 11,23 · `trainer-cairnhold-bette` 7,6 · `trainer-wick-cairnhold` 27,16 · `wynn-clinic` 30,22 · `clinic-door` 30,21 · `quill-memorial` 8,23 · `cairnhold-memorial` 7,23 · `merrow-memorial` 6,23 · `memorial-player` 7,24 · `mags-dock` 22,24 · `osric-quarry` 13,9 · `osric-shed` 23,14 · `standing-stones` 33,14 · `wick-cairnhold` 27,16 · `ward-spire-door` 40,17

**Regions:** `knapps-end` 12,18 22×11 · `knapps-end-dock` 20,23 10×6 · `the-quarry` 2,1 17×12 · `standing-stones` 28,10 11×9 · `ward-spire` 37,12 7×7 · `mooring-clinic` 28,18 6×5 · `the-memorial` 3,20 8×6 · `cliff-path` 29,6 19×4 · `stones-beach` 38,17 10×6 · `short-way-lowmoor` 25,0 5×3 · `long-way-lowmoor` 4,0 4×5 · `short-way-emberstep` 43,18 5×5 · `long-way-emberstep` 31,6 17×4 · `dig-site` 4,4 13×7

**Use triggers:** `waystone-knapps-end` 25,24 waystone · `tide-board-cairnhold` 26,24 tideTable · `ferry` 25,28 ferry · `node-cairnhold` 14,3 chip · `clinic-counter` 30,21 shop · `cairnhold-memorial` 7,22 look

**Reaches:** `reach-quarry-stream` (river, 12,11 1×6) · `reach-knapps-harbour` (lagoon, 20,27 8×3) · **Dig spots:** 6,3 9,3 11,4 14,4 7,5 10,5 13,5 16,5 6,6 9,6 12,6 5,7


### 15.3 Emberstep (`js/data/maps/emberstep.js`) — isle 3, Lv15–20, Waystone Sulphur Cross, the Weather Spire

The volcanic isle; black-sand (ash) beaches. **Centre-north**: the **volcano**, an ash cone with tumbled volcanic rock, a basalt rim and a crater of hot pools and ember vents (glow); the **volcano path** climbs from Sulphur Cross to the **lookout notch** in the south rim (30,13): the **skyglass node** (28,13) and the **first Errant sighting** (`errant-sighting`, the `crater-lookout` look trigger). **South-west flank**: the **spa terraces**, three stepped bands of hot pools behind basalt lips joined by a central stair, down to **Sulphur Cross**: the square and its sulphur-yellow **cross**, **Ines's spa house** (ochre roof), the quay, the pier and **ferry stop** (22,29), the **Waystone** (23,25). **West**: the black-sand beach with the **stepping stones** from Cairnhold (short way, ±2 h; arrival (1,20)), the headland with the **Weather Spire** (door (6,16)), and the **cliff path** along the north-west cliffs from Cairnhold (long way, any tide; arrival (1,8)). **North**: the **mangrove boardwalk** to Drownwood (long way, any tide) through the mangrove fringe; north-east, the **causeway** (short way, ±2.5 h). **East**: the **Sulphur Burn** (the river reach; the cove is the lagoon reach) and the **ash fields** (dig site).

Route trainers: Asha (Spa Bather) on the top terrace walk; Kip (Ash Shoveller) in the ash fields; Roswitha (Cliff Climber, declinable) on the cliff path; Tobiah (Steam Fitter) on the volcano path below the lookout; Marl (Scatter Volunteer, declinable) on the black-sand beach. Posts: `gorse-spa` (foot of the terrace stair), `ines-spa`, `spa-house-door`, `errant-sighting` / `errant-sighting-player`, `the-cross-step`.

Map key: ground with detail over it; `W` Waystone, `¤` skyglass node, `§` sign, `ß` boat, `•` other prop entities. Legend chars as in the file header.

```
     000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
   0 DDDDDDDDDDDZkDZDDDDDDDDDDDDDDDDDDDDDSSSS>SSSSDDD
   1 DDDDDDDDDDZDkDDDDDSSSSSSSSSSSSSDDDDSSSSSESSSSSSD
   2 DDDDDSSSSSZSkZZSSSSSSSSSSSSSSSSSSDSSSSSSESSSSSSD
   3 DDSSSSSSSSSZkSSSSSSS>>>8S>SS>SSSSSSSS>>GP8>>>SSD
   4 SSSSSSS>S>ZSkZZ>S>8>S>G>>>>>S>>SSSSS>>g§PGGG>SSD
   5 CCCSCCCCCCCCkSS>8>T>>>>>>>>XXXXXXX>>>>G>PGg8>SSD
   6 CCCCChCCCCCCPC>>GGTTTT>>>>XXXXXXXXX>>PPPPGG>>SSD
   7 CCCCCCCCChCCP§GGGGTTT>>>>XXXJJJJJXXX>P<>Gg>>SSSD
   8 PPPPPPPPPPPPGTT8TGG>>>>>XXXJYJJJJYXXXP>>>GoSSSSD
   9 CCCCGGGGGGGPTTTTTTgGo>>>XXJYJJJYJJXXXP>>>>>SSSSD
  10 CCCCgGGGGGGPTTTTTTG>>>>>XXXJJYJJYJXXXP>>>G>SSSSD
  11 SSS>ggGGGgGPTTTTT8GG>>o>>XXXJJJJJXXX>P>>>G<8>SSS
  12 SSSG66666GGPPTTTGGGG>>>>>>XXXXXXXXX>>P><>>G>>SSS
  13 SSSS66666GGPGxxxxxxxxxxx>>>>¤fffX>>>>PRRRRG>S>SS
  14 DSSS66666GGPg?JJJJ?JJJJ?>><>>>P>>>><<P>>GRG>S>SS
  15 DDSSs]s]s8GPG???????????>>PPPPP>>>>>PPPPPNPPPSSS
  16 DDSSss"ssGGPGxxxxxHxxxxx>>P>>><>>>>>G>GGGRG>>>SS
  17 DSSSGGfGGGGPG?JJJ???JJJ?G777777>>g>>>>GGGRG>S>SS
  18 SSSSGGf§fffPg???????????G777777GG>>>>>>>GRRRRSSS
  19 SSSS>>>GGGfPGxxxxxHxxxxxG§{${$1111>>>>>>>>>>RSSS
  20 >eeePPPPPPfGGGGGGGHG•GggG$$+${1111>>>>>>G>S>RSDD
  21 SSSS>§>>8>ffffffOOOOOOOOOOOOOO#%##G>>oG>>>>SRSDD
  22 SSSSSSSSSS>TGGG§LGGOOOOO•GGGgg#+%#oTTT>>S>SSRRRD
  23 DDDSSSSSSS>>>GGPGGGOO•OOOLGGGGGPGTTTTT>S>SSSSDDD
  24 DDDDDDDDSSSS>PPPGggOOOOOOGGGGGGPgTTT>>>SSSSSDDDD
  25 DDDDDDDDSSSS8S>>(QQQQQQW•QQQQc>P>>>>>SSSSSSDDDDD
  26 DDDDDDDDDDSSSSSSQ)QQQQQQQQQ)Q)SS>S>SSSSSSDDDDDDD
  27 DDDDDDDDDDSSSSSSSSSSSSKSSSSSSSSSSSSSSSSDDDDDDDDD
  28 DDDDDDDDDDDDDDDSSSSSSSKSSSSSSSSSSSSSSDDDDDDDDDDD
  29 DDDDDDDDDDDDDDDSSSSSSSKßSSSSSSSSSDDDDDDDDDDDDDDD
  30 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
  31 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
```

| Cell | Kind | To | Notes |
|---|---|---|---|
| (0,20) | edge | `cairnhold` (46,20) | short-way ±120 min |
| (0,8) | edge | `cairnhold` (46,8) | long-way |
| (40,0) | edge | `drownwood` (40,30) | short-way ±150 min |
| (12,0) | edge | `drownwood` (12,30) | long-way |
| (6,16) | door | `spire-weather` (10,12) |  |

**Markers** (22): `ferry-stop` 22,29 · `maud-punt` 23,29 (water) · `door-spire-weather` 6,16 · `spire-weather-step` 6,17 · `spire-step` 6,17 · `from-cairnhold-stones` 1,20 (low) · `from-cairnhold-cliff` 1,8 · `from-drownwood-causeway` 40,1 (low) · `from-drownwood-boardwalk` 12,1 · `sulphur-cross-dock` 22,25 · `trainer-emberstep-asha` 16,15 · `trainer-emberstep-kip` 35,18 · `trainer-emberstep-roswitha` 7,8 · `trainer-emberstep-tobiah` 30,15 · `trainer-emberstep-marl` 7,20 · `gorse-spa` 19,20 · `ines-spa` 27,21 · `spa-house-door` 27,20 · `errant-sighting` 30,13 · `errant-sighting-player` 30,14 · `weather-spire-door` 6,17 · `the-cross-step` 21,24

**Regions:** `sulphur-cross` 11,17 24×13 · `sulphur-cross-dock` 16,25 14×5 · `spa-terraces` 13,13 11×7 · `the-volcano` 19,2 23×16 · `crater-lookout` 27,12 6×3 · `ash-fields` 32,16 9×6 · `weather-spire` 3,12 7×7 · `cliff-path` 0,6 12×4 · `black-sand` 0,17 9×6 · `short-way-cairnhold` 0,18 4×5 · `long-way-cairnhold` 0,7 12×3 · `short-way-drownwood` 38,0 5×4 · `long-way-drownwood` 9,0 7×8 · `dig-site` 32,16 9×6

**Use triggers:** `waystone-sulphur-cross` 23,25 waystone · `tide-board-emberstep` 24,25 tideTable · `ferry` 23,29 ferry · `node-emberstep` 28,13 chip · `the-cross` 21,23 look · `crater-lookout` 30,13 look

**Reaches:** `reach-sulphur-cove` (lagoon, 16,27 6×3) · `reach-sulphur-burn` (river, 41,16 1×3) · **Dig spots:** 32,16 37,17 34,18 38,18 35,19 39,19 36,20 38,22


### 15.4 Drownwood (`js/data/maps/drownwood.js`) — isle 4, Lv22–27, Waystone Mossgate, the Hollow Spire

The sinking isle: more water than land, shallows to the deep frame. **West**: the **drowned forest**: murky water (`mud-water`, static so the animation budget holds) full of drowned trunks and lilies round reed hummocks (the wild cover), cut by the **tannin channel** (the river reach); the **skyglass node** on a hummock (6,10); boardwalks thread it, and the **mangrove boardwalk** from Emberstep (long way, any tide; arrival (12,30)) comes up from the south through the mangrove fringe. **North-west**: the hummock with the **moor footbridge** to Thistlewind (long way, any tide). **Centre**: the **old town** on its shrinking hummock (its mud banks are the **dig site**): the square, broken walls, the **Hollow Spire** (door (24,9)); its high street runs east down into the water: **the drowning street** (`d`, 31–37 × 12–13), walkable only around low water (±2.5 h), flanked by drowned houses (dark windows, doors under water), the Mooring's **pulse post** at its head. **East**: **Mossgate** on stilts: decks, boardwalks, two houses, the **Waystone** on the central deck (42,17), the jetty and **ferry stop** (45,17), Teal's punt; under the stilts is the lagoon reach; the **north loop** boardwalk links the old town to Mossgate at any tide. **North**: the **causeway** to Thistlewind (short way, ±2.5 h). **South-east**: **Wendel's boatyard** on the shingle (his hull on the slip: Tamsin's rollers) and the **causeway** in from Emberstep (short way, ±2.5 h; arrival (40,30)).

Route trainers: Wenna (Stilt Fisher) on the west deck over the street's end; Gil (Mangrove Poler) on the mangrove boardwalk; Hettie (Scatter Rescuer) at the head of the drowning street; Abner (Mooring Warden) in the old square before the Spire; Sorcha (Lamp Diver, declinable) on the forest boardwalk. Story posts: `drowning-street` / `drowning-street-player` / `teal-drowning-street` / `varga-drowning-street` (all `tide: 'low'`; script `drowning-street`), `anchor-pulse` / `merrow-anchor-pulse` (script `anchor-pulse-misfire`), `trainer-varga-drownwood` (low), `teal-poler`, `wendel-boatyard`, `tamsin-drownwood` (Kettle's nameboard).

Map key: ground with detail over it; `W` Waystone, `¤` skyglass node, `§` sign, `ß` boat, `•` other prop entities. Legend chars as in the file header.

```
     000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
   0 DDDDDDDDDDBDDDDDDDDDDDDDDDDDDSqSDDDDDDDDDDDDDDDD
   1 DDDDDSSSSDBSDDDSSDSDDDSDDSSSDSESDDDSDSDSDDSSDDDD
   2 DSSSSSSSGGPGGSSSSSSSSSSSSSSSSSESSSSSSSSSSSSSSSDD
   3 DDSSSSSG9TPT9GSSSSSSSSSSSSSSSSESSSSSSSSSSSSSSSSD
   4 DSSSSSSGTTPTGGSSSSSSSSSSSSSSSSESSSSSpp(ppppp(SSD
   5 DDSSSSSGGTPTG9SSSSSSSS55555SSSEkkkkkkppppppppSDD
   6 DDSSSSSSGGP§GSSSSSSSSS55555mmkkkSSSSSkSSSSSSSSDD
   7 DSSSSSSSSSkSSSSSSSSSmm55555GGkm§SSSSSkS2222555SD
   8 DDSSSSSSSSkYSSSSSSS9GGs]s]sGTTm555S22kS2222555DD
   9 DDSSU9rrUkkkkkkkkkkmGGss"ssGTT9555S22kS${$$${$DD
  10 DDSUrr¤rUYYZYYYYSSkGsGGGO§GGG}Gs}sSs}kS$+{$$+$SD
  11 DDSSUrrrUYYYYYYZYSmmsGOOOOOOGGGs@sSs@kpppppppSSD
  12 DSSZYUUXZYZYYUrUXSS}GGOOOOOOOOOdddddddppppSSkSDD
  13 DSSYZYjjjjjjUrrrUYYmT9OOOOOOOOOdddddddpppLSSkSSD
  14 DDZYYYjYYYYjYUrUYYkkTTTGGGG§GG•555S222ppppSSkSDD
  15 DjjjjjjYYYYjZYYYYXksmmGGGGG9Gmm555S22ßp(pppppSSD
  16 DDYrrrUYYYYjYYYZkkkYSsmmGG9mmmSs}sSs}sppp§pppSDD
  17 DSSUrUYYZYZjjjjjkjZSSSSSmmmSSSSs@sSs@sSSppW•pKßD
  18 DDSYZYYYYYYYYYYYkYYSSSSSSSSSSSSSSSSSSSSS•pp(pSSD
  19 DSSYZYYYYYXYYYUYkXXSSSSSSSSSSSSSSSSSSSSSppLppSDD
  20 DDSZZYYYYYZYUrr9kYYSSSSSSSSSSSSSSSSSSSSSpppppSDD
  21 DSSYXUZYYYYUUrrrkXYSSSSSSSSSSSSSSSSSSSSSpppppSDD
  22 DDSUrrrYYYYXkkkkkYSSSSSSSSSSSSSSSSSSSSSSpppppSDD
  23 DDSUrrrUYYYYk§ZZYSSSSSSSSSSSSSSSSSSSSSSSSSkSSSSD
  24 DSSUrrrUZYYXkYZYZ?SS?SSSSSSSSSSSSSSSSSSSSSkSSSDD
  25 DDSSS?YYYZYYkXSSSS?SSSSSSSSSSSSSSSSSSqqqq§qcSSSD
  26 DDSSSS?S?YZZkYSSSSS?SSSSSSSSSSSSSSSqq9cGGGGqqSDD
  27 DDSSSSS?SSSSk?SSSSSSSSSSSSSSSSSSSSSqqqGßGGGq9qDD
  28 DDSSSSSS???SkSSS?SS?SSSSSSSSSSSSSSSSSqqqqqqqSSDD
  29 DDSSSSS?SSSSkSSSSSSSS?SSSSSSSSSSSSSSSSSSESSSSSDD
  30 DSDDSDDDDSDDkDDDDDSSDDSDDDSDDSDDSSDDDSSSESSSSDSD
  31 DDDDDDDDDDDDkDDDDDDDDDDDDDDDDDDDDDDDDDSSqSSDDDDD
```

| Cell | Kind | To | Notes |
|---|---|---|---|
| (40,31) | edge | `emberstep` (40,1) | short-way ±150 min |
| (12,31) | edge | `emberstep` (12,1) | long-way |
| (30,0) | edge | `thistlewind` (30,30) | short-way ±150 min |
| (10,0) | edge | `thistlewind` (10,30) | long-way |
| (24,9) | door | `spire-hollow` (10,12) |  |

**Markers** (26): `ferry-stop` 45,17 · `maud-punt` 46,17 (water) · `door-spire-hollow` 24,9 · `spire-hollow-step` 24,10 · `spire-step` 24,10 · `from-emberstep-causeway` 40,30 (low) · `from-emberstep-boardwalk` 12,30 · `from-thistlewind-causeway` 30,1 (low) · `from-thistlewind-footbridge` 10,1 · `mossgate-dock` 42,18 · `trainer-drownwood-wenna` 39,13 · `trainer-drownwood-gil` 12,26 · `trainer-drownwood-hettie` 28,13 · `trainer-drownwood-abner` 24,12 · `trainer-drownwood-sorcha` 14,9 · `trainer-varga-drownwood` 33,12 (low) · `teal-poler` 38,15 · `teal-drowning-street` 34,13 (low) · `drowning-street` 33,13 (low) · `drowning-street-player` 37,13 (low) · `anchor-pulse` 30,13 · `merrow-anchor-pulse` 29,13 · `varga-drowning-street` 32,12 (low) · `wendel-boatyard` 40,26 · `tamsin-drownwood` 41,26 · `hollow-spire-door` 24,10

**Regions:** `mossgate` 36,2 10×23 · `mossgate-dock` 40,15 7×6 · `drowning-street` 28,12 10×2 · `old-town` 18,5 14×13 · `hollow-spire` 22,5 5×6 · `drowned-forest` 1,7 18×21 · `boatyard` 35,24 10×5 · `short-way-emberstep` 38,28 5×4 · `long-way-emberstep` 11,22 6×10 · `short-way-thistlewind` 29,0 3×7 · `long-way-thistlewind` 6,0 8×7 · `dig-site` 18,5 14×13

**Use triggers:** `waystone-mossgate` 42,17 waystone · `tide-board-drownwood` 43,17 tideTable · `ferry` 46,17 ferry · `node-drownwood` 6,10 chip · `anchor-pulse-post` 30,14 look

**Reaches:** `reach-tannin-channel` (river, 6,13 6×1) · `reach-mossgate-lagoon` (lagoon, 32,17 7×4) · **Dig spots:** 27,6 19,13 21,15 30,15 22,16 28,16 26,17


### 15.5 Thistlewind (`js/data/maps/thistlewind.js`) — isle 5, Lv29–34, Waystone Windle, the Relay Spire

The high moor. **North**: the **ridge walk** past the **windmills** (`windmill` props, landmarks from anywhere on the moor) and the **Relay Spire** (door (26,7)); the walkers' cairn and the **skyglass node** (31,9) in the heather. **Centre and west**: open moor (moor turf, heather and thistles = the wild cover, gorse), the **tarn** and the **Tarn Beck** running north to the bay (the river reach), the straight **moor road** to the west coast, the **barrow diggings** (dig site). **West**: the **ice path** over the frozen strait to Rimeholt (long way, any tide; `x` ice) and the **stepping stones** (short way, ±2 h). **South**: the **moor footbridge** in from Drownwood (long way, any tide; arrival (10,30)) and the **causeway** (short way, ±2.5 h; arrival (30,30)). **East**: **Windle**: **Weft Lane** (34–43 × 13–14, the street the **Surge** Shifts in one night), houses on both sides, **Rook Hayward's mill** (44,16), the quay with the **Waystone** (37,22), the pier and **ferry stop** (40,26); the harbour is the lagoon reach.

Route trainers: Ned (Millhand) under Rook's mill; Lark (Kite Flyer) on the ridge walk; Cuthbert (Moor Shepherd) on the footbridge track; Maisie (Sail Mender, declinable) on the quay; Gideon (Surge Witness, declinable) in Weft Lane. Story posts: `surge-street`, `surge-player`, `rook-surge` (script `the-surge`), `rook-mill`, `ada-ridge`, `ivo-ridge`.

Map key: ground with detail over it; `W` Waystone, `¤` skyglass node, `§` sign, `ß` boat, `•` other prop entities. Legend chars as in the file header.

```
     000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
   0 DDDDDDDDDDDDDDDDDDDDSSSSSSDDDDDDDDDDDDDDDDDDDDDD
   1 DDDDDDDDDDDDDDDDDDSSSSSSSSSSSSSSDDDDDDDDDDDDDDDD
   2 DDDDDDDDDDDDSSSSSSSSSSqqSSSSSSSSSSDDDDDDDDDDDDDD
   3 DDDDDSSSSSSSSSSSSSRSqSqq66666qSSSSSSSSDDDDDDDDDD
   4 DSSSSSSSSSSSSSqqSqRqqqqF66666SSqSSSSSSSSSDDDDDDD
   5 SSSSSSSqSSSSqqqqqqRT•T,F66666F•qqqSqSSSSSSDDDDDD
   6 SSSqqqqqqqqqqFFFFFRFPPPFs]s]sFPnnqqqqSqSSSSDDDDD
   7 SSSqFFFFFFnnnnnnnnRFPF,Fss"ssFPnnnnnqqqqSSSDDDDD
   8 xxxPFFFtnnnnnnnnnnRFPFFFFFfFFFPnnnnnnnFqqSSSSDDD
   9 SSSP§FtFFnnnnnnnnnRFPFtFFFfFFFP¤nnnn44447777SDDD
  10 SSSPqqFFFnnnnnnnnnRFPFFFFFf§FFPn•nnF44447777SSDD
  11 SSSSSqFF,Fnnnn•nnyRFPFFFFFPFFFP,FFFFs]ss#%##SSSD
  12 DSSSPPPPPPPPPPPPPPNPPPPPPPPPPPPPPPPFs@]s##+#SSSD
  13 DSSqqPFFttFFPFF,FFRFFFFFFFFF,F,FFGOLOOOOOOLOqSSS
  14 DSSqFPFFFFFFPF,FuuuuuFFFFFFtF,FFF§OOOOOOOOOOqSSS
  15 DSSqqPFtFyFFPFFFuuuuuFFtF,FFFFFFtGO44446666O9qSS
  16 DSSSqPyFFFFFPFFFFuuuFFFFFFF,FFFF,GO44446666O•qSS
  17 DSSqqPFFFFFFPFFFFFFFFFFFFFFFFFFFFGO#%###%##OFqSS
  18 DSSSSPFt0Fn,PFFyFF,FFFFFFFFFF,FtF9O#+%###+#PqqSS
  19 SSSSqP,FFnnnPnFFFFFFFFTTTTTFFtFFFGPGGGGGGGqPSSSS
  20 SSSqqPFFFnnnPnnF,FF,FTTTTTTT,tFyFGPGG9GGG9qPSSSS
  21 SSSq§PFFnnnnPntFFFFttFTTTTTFFFFFFGPGGGGGGGqPSDDD
  22 qeeqPPFFFFFnPFF;;;;;FFFF,F,yFFt,,PPcQW•QQQQ(SDDD
  23 SSSqqqqFFFFFPFF;;;;;FFFFFFFFFFFtFPFQ)QQQQQQ)SDDD
  24 SSSSSSqFFFFtPFF;;;;;FFFFFF,FFFPPPPFSSSSSKSSSSDDD
  25 DSSSSSqyFFFFPFFFtF,FFFyFFFFFFFP§FFqSSSSSKSSSSDDD
  26 DDDDSSqFFFFFPFyq0qqqqqqqqqFtFFPFFFqSSSSSKßSSDDDD
  27 DDDDSSqqFFF§PqqSSSSqqSSqSqqqFFqFFqqSSSSDDDDDDDDD
  28 DDDDSSSqqFPPPqSSSSSSSSSSSSSqqSESqqSSSDDDDDDDDDDD
  29 DDDDSSSSqqPqqSSSSSSSSSSSSSSSSSESSSSSSDDDDDDDDDDD
  30 DDDDDSSSSSBSSSSSDDDDDDDDDSSSSSESSSSSDDDDDDDDDDDD
  31 DDDDDDSSSSBSSSSDDDDDDDDDDDDDSSqSSDDDDDDDDDDDDDDD
```

| Cell | Kind | To | Notes |
|---|---|---|---|
| (30,31) | edge | `drownwood` (30,1) | short-way ±150 min |
| (10,31) | edge | `drownwood` (10,1) | long-way |
| (0,22) | edge | `rimeholt` (46,22) | short-way ±120 min |
| (0,8) | edge | `rimeholt` (46,8) | long-way |
| (26,7) | door | `spire-relay` (10,12) |  |

**Markers** (22): `ferry-stop` 40,26 · `maud-punt` 41,26 (water) · `door-spire-relay` 26,7 · `spire-relay-step` 26,8 · `spire-step` 26,8 · `from-drownwood-causeway` 30,30 (low) · `from-drownwood-footbridge` 10,30 · `from-rimeholt-stones` 1,22 (low) · `from-rimeholt-ice-path` 1,8 · `windle-dock` 40,23 · `trainer-thistlewind-ned` 43,17 · `trainer-thistlewind-lark` 22,6 · `trainer-thistlewind-cuthbert` 12,18 · `trainer-thistlewind-maisie` 41,22 · `trainer-thistlewind-gideon` 38,14 · `rook-mill` 43,16 · `rook-surge` 40,14 · `surge-street` 38,13 · `surge-player` 34,15 · `ada-ridge` 25,9 · `ivo-ridge` 27,9 · `relay-spire-door` 26,8

**Regions:** `windle` 33,9 12×15 · `weft-lane` 34,13 10×2 · `windle-dock` 35,22 9×5 · `the-moor` 3,3 30×22 · `the-ridge` 18,3 15×5 · `relay-spire` 23,3 7×6 · `the-tarn` 15,13 7×4 · `barrow-diggings` 14,21 7×5 · `short-way-drownwood` 29,27 3×5 · `long-way-drownwood` 9,27 4×5 · `short-way-rimeholt` 0,20 4×5 · `long-way-rimeholt` 0,6 5×5 · `dig-site` 14,21 7×5

**Use triggers:** `waystone-windle` 37,22 waystone · `tide-board-thistlewind` 38,22 tideTable · `ferry` 41,26 ferry · `node-thistlewind` 31,9 chip · `windmill-windle` 44,16 look

**Reaches:** `reach-tarn-beck` (river, 18,7 1×5) · `reach-windle-harbour` (lagoon, 35,24 5×3) · **Dig spots:** 15,22 17,22 19,22 16,23 18,23 15,24 17,24 19,24


### 15.6 Rimeholt (`js/data/maps/rimeholt.js`) — isle 6, Lv36–41, Waystone Frostwick, the Mirror Spire

The last isle, under its glacier. **North-west**: the **glacier** (`Y`); cut into it, the **mirror-ice caves**, declared dark with a **3-tile light radius** (`darkZones: [{id: 'mirror-caves', area, lightRadius: 3}]`, GDD-01 §16.2): the tunnel from the **cave mouth** (16,16) up to **the gallery**, a hall of mirror ice and ice pillars round the great mirror where **Idris** waits (`idris-gallery`), and the **Mirror Spire**'s face cut into the ice at its north end (door (16,5)); side passages west (Sunniva's polishing bay, a sea cave) and east (the **skyglass seam**, node (25,12)). The caves also spawn `rimeholt-land` (Lumenveil and Floeback lean there by night). Below the snout: the **moraine** (dig site) and the **meltwater** stream (the river reach); **Brannoch's lamp hut** and lamp rack at the cave mouth; **Aldous's hut** among the snow pines in the west. **East**: the **ice path** in from Thistlewind (long way, any tide; arrival (46,8)) and the **stepping stones** (short way, ±2 h; arrival (46,22)). **South-east**: **Frostwick**: the lane, three houses, the quay, the **Waystone** (34,25), the pier and **ferry stop** (35,29); the harbour is the lagoon reach. **The ring closes by Maud's ferry and the Lantern-paths**: there is no walking route on to Lowmoor (the critical path goes once around and never backtracks, GDD-00 §4).

Route trainers: Hild (Ice Cutter) on the lane to the quay; Oskar (Cave Lamp-bearer) in the tunnel; Greer (Glacier Guide) on the track below the glacier; Sunniva (Mirror Polisher, declinable) in the west passage; Aldous (Frost Hermit, declinable) at his hut. Story posts: `idris-gallery` / `gallery-player` (script `idris-gallery`), `linnet-returns` = `trainer-linnet-rimeholt` + `linnet-returns-player` (script `linnet-returns`, Frostwick lane), `brannoch-cave-lamp`, `seraphine-caves`, `cave-mouth`.

Map key: ground with detail over it; `W` Waystone, `¤` skyglass node, `§` sign, `ß` boat, `•` other prop entities. Legend chars as in the file header.

```
     000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
   0 DDDDDDDDDDDDDDDDDDDSSSSSSSSSSSSDDDDDDDDDDDDDDDDD
   1 DDDDDDDDDDYYYYYYYYYYYYYYYYSSSSSSSSDDDDDDDDDDDDDD
   2 DDDDDDDDYYYYYYYYYYYYYYYYYYYqqSSSSSSSDDDDDDDDDDDD
   3 DDDDDDDYYYYYYYYYYYYYYYYYYYYqqqSqSSSSDDSSSSSDDDDD
   4 DDDDSSSSSSYYYs]s]s]sYYYYYY---qqqSqSSSSSSSSSSSSDD
   5 DDDDSSSSSYXXXs]s"s]sXXXYYY-----qqqSSSSSSqSSSSSSS
   6 DDDSZZXSYX?????????????XYYYY-----qqSqqqqqqqqSSSS
   7 DDDSZZXXX???X???????X???XXYY------qqq------qSSSS
   8 DDSSZZZZZ???????•???????ZZXY--------PPPPPPPPxxxx
   9 DSSSSZZZZ???X???????X???ZZXY--------P-----§-SSSS
  10 DSSSYXXXXX?????????????XXZXY--------P-------SSSS
  11 SSSqYYYYYYXXXXXZZZXXXXXYXZXY-----TT-P-------qqSS
  12 SSSSq-YYYYYYYYXZZZXYYYYYY¤YY--xTTTTTP-V-V-qqqSSS
  13 SSqSqR-Y-YYYYYXZZZ555Y-YYYYY-xVTTTTTPT----VSSSSS
  14 SSSqqR------Y-XZZZs]s----------TTTTTPT---qqSSSSD
  15 SSqSqR:::::::--ZZZs@s-------V--V-TTTPx---qSSSDDD
  16 SSSqqR0::::0::§-P-•P--xx------------P----qqSSDDD
  17 SSSq-R:0:::::::-PPPP--x-V-----^^^^-xP5555-qSSSDD
  18 SSqRRR::::PPPPPPPxx-----TTTTT-^^^^x-P5555-qSSSSD
  19 SSSR444:0:P:----PPPPPPPPPPPPPPs]ssPPP#%##-qqSSSD
  20 SSqR#%#---P--V--------TTTTTTTTs@]s--L##+#-xqSSSS
  21 SRRR#+#---P-----x------TTTTTTTOOOOOOOOOOOO§-SSSS
  22 SSq-PPPPPPP-V--------V--TTTT--§--P----1111PPeeeq
  23 SSqq--TTTTT--------------x---V---P----1111--SSSS
  24 SSSq--TTqqqq-----------V---------P-x--${$$-qSSSS
  25 SSSqqqqqqSSVqqq-----x----x-V-x-cQQW•Q($+{$qqSSSD
  26 DSSSSVSSSSqqSSq-qqqq--x---qqqqqQ)QQQQ)qqqqqSSSSD
  27 DSSSSSSSSSSSSSqqqSSqqqqqqqqSSSSSSSSKSSSSSSSSSSDD
  28 DDDSSSSSSSSSSSSSSSSSSqqSSqqqSSSSSSSKSSSSSSSSSDDD
  29 DDDDDDDDDDDDSSSSSSSSSSSSSSSSSSDSSSSKßSSDDDDDDDDD
  30 DDDDDDDDDDDDDDDDDDDSSSSSSSSSSSDDDDDDDDDDDDDDDDDD
  31 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
```

| Cell | Kind | To | Notes |
|---|---|---|---|
| (47,22) | edge | `thistlewind` (1,22) | short-way ±120 min |
| (47,8) | edge | `thistlewind` (1,8) | long-way |
| (16,5) | door | `spire-mirror` (10,12) |  |

**Markers** (22): `ferry-stop` 35,29 · `maud-punt` 36,29 (water) · `door-spire-mirror` 16,5 · `spire-mirror-step` 16,6 · `spire-step` 16,6 · `from-thistlewind-stones` 46,22 (low) · `from-thistlewind-ice-path` 46,8 · `frostwick-dock` 35,26 · `trainer-rimeholt-hild` 33,23 · `trainer-rimeholt-oskar` 16,12 · `trainer-rimeholt-greer` 24,19 · `trainer-rimeholt-sunniva` 5,9 · `trainer-rimeholt-aldous` 6,22 · `trainer-linnet-rimeholt` 33,21 · `brannoch-cave-lamp` 17,17 · `seraphine-caves` 15,15 · `idris-gallery` 17,8 · `gallery-player` 16,10 · `linnet-returns` 33,21 · `linnet-returns-player` 33,22 · `cave-mouth` 16,16 · `mirror-spire-door` 16,6

**Regions:** `frostwick` 29,17 14×13 · `frostwick-dock` 31,25 8×5 · `the-glacier` 1,0 28×15 · `mirror-caves` 3,4 26×13 · `the-gallery` 9,6 15×5 · `moraine` 4,15 10×5 · `short-way-thistlewind` 43,20 5×5 · `long-way-thistlewind` 36,6 12×5 · `dig-site` 4,15 10×5

**Use triggers:** `waystone-frostwick` 34,25 waystone · `tide-board-rimeholt` 35,25 tideTable · `ferry` 36,29 ferry · `node-rimeholt` 25,12 chip · `cave-lamp-rack` 18,16 look · `gallery-mirror` 16,8 look

**Reaches:** `reach-meltwater` (river, 5,13 1×5) · `reach-frostwick-harbour` (lagoon, 31,27 4×3) · **Dig spots:** 7,15 9,15 11,15 8,16 10,16 12,16 9,17 11,17 13,17 6,18


### 15.7 The Bar (`js/data/maps/the-bar.js`) — 64×24, the Long Road, Lv40–44 in the tide pools

The drowned tide road from the point to Shardcrown. **West**: the **Bar head shoal** (dry sand), where Pellwick's Bar road comes up (arrival (1,12)); the road's last yards at x 0 are road too, so the way back is tide-gated at both ends. The **Bar road** (two wide; `n` = `bar-road-near` from the shoal to the spur foot, every low; `b` = `bar-road` beyond it, the lower low; §17.2) winds east over the shallows past the **wreck ribs** of the lost fleet (`X` ribs, `Y` posts), **tide pools** and six dry **sandbanks** where Hollis's Long Road trainers stand; the far road dry only around the day's **lower low** (±1.5 h) until `lit.bar`. Halfway, at the **spur foot** where **Wick** waits on his sandbank, the **Lantern Stack spur** runs north to the stack's ledge and its door (29,1) → `lantern-stack` (10,14): it is painted `M` = `bar-spur` (±90 min at **every** low, not lower-low only; §17.2). **East**: the shore of **Shardcrown** and **Hollis's Gate** (door (59,10) → `hollis-gate` (10,12); the seventh Waystone, `hollis-gate`, is inside that room, per GDD-ids §9). Spawns: five rect spawns over the road beside the pools roll `the-bar-pools` (rate 0.08).

Long Road (all `tide: 'low'`): `trainer-bar-corwen` (Wreck Diver, by the first hulls) 9,13 · `trainer-bar-tilda` (Tide-pool Warden) 17,7 · `trainer-bar-ezra` (Ex-Mooring Quartermaster) 26,15 · `trainer-wick-long-road` (halfway, the spur foot) 31,11 · `trainer-bar-ottilie` (Brazier Pilgrim) 38,8 · `trainer-bar-hamish` (Bar Pilot) 47,14 · `trainer-bar-delphine` (Readers' Fund Scholar, on Shardcrown's shore) 53,12 · `trainer-linnet-gate` at the gate 59,13. Story posts: `hollis-gate` (script `summit-gate`), `hollis-gate-step` / `lantern-stack-step` (where those rooms' doors let you out: the summit lane's `toMarker`s), `spur-foot`, `engine-stack-foot` (script `merrow-engine-before`), `charges-linnet` / `charges-wick` (script `charges-pulled`), the crossing party on the shoal (`crossing-start`, `crossing-corin`, `-wick`, `-linnet`, `-merrow`, `-varga`, `-idris`; script `the-crossing`), `crossing-stack-foot`.

Map key: ground with detail over it; `W` Waystone, `¤` skyglass node, `§` sign, `ß` boat, `•` other prop entities. Legend chars as in the file header.

```
     0000000000111111111122222222223333333333444444444455555555556666
     0123456789012345678901234567890123456789012345678901234567890123
   0 DDDDDDDDDDDDDDDDDDDDDDDDDDCCCCCCCDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
   1 DDDDDDDDDDDDDDDDDDDDDDDDZDCCC"CCCZDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
   2 DSDSDDDSDSDSDSSSDSDDDSSSDqqqqqqqqqSZDDSDDSSSDDSDDDDDSSDSSDDSSDDS
   3 SSSSSSSSSSSSSSSSSSSSSSSZSqoqqqqq•qSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS
   4 SSSSSSSSSSSSSSSSSSSSSSSSSSSSSMMSSSZSSSSSSSSSSSSSSSSSSSSSSqqqqqqo
   5 SSSSSSSSSSSSSSSSa~aaSSSXXXSSSMMSSSSSSSSSSSSSSSSSSSSSSSSqqqqaaaaa
   6 SSSSSSSSSSSSSSSa~aaaSSSSYSSSSMMSSSSSSa~aaSSSSSXXXSSSSSqq^^^^^^^a
   7 SSSSSSSSSSSSSSSaaaaSSSSSSSSSSMMSSSSSaaaaaaSSSSSYSSSSSqqq^^^^^^^G
   8 SSSSSXXXSSSSbbbbbbbbbbbSSSSSSMMSSSSSSaaaSSSSSSSSSSSSSqoq^^^^^^^G
   9 SSSSSSYSSSSSbbbbbbbbbbbSSSSSSMMSSbbbbbbbbbbbbSSSSSSSSqqas]s]s]sG
  10 aaa§SSSSSSYSbbSSSSSSSbbSSSSSSMM§SbbbbbbbbbbbbSSSSSYSqqqass]"]ssG
  11 baabbbbbbbbbbbSSSSSYSbbSSSSSaaaaabbSSSSSSSSbbSSSSSSSqqqaafffffGG
  12 baabbbbbbbbbbSSSSSSSSbbSSSSSSaaaSbbSSSSSSSSbbbbbbbbbqqqaLfffffLa
  13 baaaaSSSaaaaSSSSSSSSSbbbbbbbbbbbbbbSSSSSSYSbbbbbbbbbqqffff•fffaa
  14 aaaaSSaaaaaaSSSSSSSSSbbbbbbbbbbbbbSSSSSSSSSSSSaaaaSSq§qaaaaaaaaa
  15 SSSSSSSSa~aaSSXXXSSSSSSSaaaaaSSSSSSSXXXSSSSSaaaa~aaSqqqaaaaaaaaa
  16 SSSSSSSSSSSSSSSYSSSSSSSaa~aaaaSSSSSSSYSSSSSSSSa~aSSSSqqqaaaaaaaa
  17 SSSSSSSSSSSSSSSSSSSSSSSSaa~aaSSSSSSSSSSSSSSSSSSSSSSSSSqoXaaaaaoa
  18 SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSqqqqaaaaaa
  19 SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSqqqqaaaaa
  20 SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSqqqqqqqq
  21 SSDDDSDDDSSDSDDSSDDSSSDSSSDSDSDDSDDSSDSSSSDDDDSDSDDDDSSSDSDqqqqS
  22 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
  23 DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD
```

| Cell | Kind | To | Notes |
|---|---|---|---|
| (0,12) | edge | `pellwick` (6,1) | the-bar ±90 min |
| (59,10) | door | `hollis-gate` (10,12) |  |
| (29,1) | door | `lantern-stack` (10,14) |  |

**Markers** (29): `from-pellwick` 1,12 · `bar-head-shoal` 2,11 · `hollis-gate-door` 59,10 (low) · `hollis-gate-step` 59,11 (low) · `hollis-gate` 59,12 (low) · `lantern-stack-door` 29,1 (low) · `lantern-stack-step` 29,2 (low) · `trainer-bar-corwen` 9,13 (low) · `trainer-bar-tilda` 17,7 (low) · `trainer-bar-ezra` 26,15 (low) · `trainer-wick-long-road` 31,11 (low) · `wick-long-road` 31,11 (low) · `trainer-bar-ottilie` 38,8 (low) · `trainer-bar-hamish` 47,14 (low) · `trainer-bar-delphine` 53,12 (low) · `trainer-linnet-gate` 59,13 (low) · `linnet-gate` 59,13 (low) · `spur-foot` 29,10 (low) · `engine-stack-foot` 28,3 (low) · `charges-linnet` 26,2 (low) · `charges-wick` 32,2 (low) · `crossing-start` 2,12 · `crossing-corin` 2,13 · `crossing-wick` 3,13 · `crossing-linnet` 2,11 · `crossing-merrow` 1,10 · `crossing-varga` 1,14 · `crossing-idris` 2,10 · `crossing-stack-foot` 30,3 (low)

**Regions:** `bar-head-shoal` 0,9 5×7 · `the-long-road` 3,5 51×14 · `lantern-stack-spur` 28,2 4×9 · `lantern-stack` 23,0 13×5 · `shardcrown` 51,3 13×18 · `hollis-gate` 56,6 7×8 · `wreck-ribs` 3,4 50×14


## 16. Isle lane requests

**16.1 Manifest requests.** None: every map, Waystone, region, encounter table, trainer, NPC and species id used by the isles and the Bar is in `ids.manifest.js`. (Entity, marker and region names are map-local.)

**16.2 Engine / data requests** (owners in brackets):
1. *(Done by the verifier, §17.2: `bar-spur` and `bar-road-near` exist; the approach to the spur foot opens at every low.)* [TILESETS / WORLD-MAP] **A `bar-spur` tile** (sand-bar art, `tide: 'low'`, `tideWindow: 90`, no `lowerLow`, `openFlag: 'lit.bar'`): the Lantern Stack spur is dry at every low (GDD-00 §4). Until it exists the spur paints `mud-flat`, which carries the same window. Note that the spur's every-low window only helps if the approach is open too: Pellwick's Bar road and this map's road are lower-low only, so either WORLD-MAP opens the road from the point to the spur foot at every low (a `segment`/`openAt` field on those cells), or the story schedules *Two plans, one night* on a lower low (the Relighting crossing is a forced low and needs neither).
2. [RENDER / lighting] **`darkZones`** on a map: `[{id, area: {x, y, w, h}, lightRadius}]`: inside the area the scene is dark but for `lightRadius` tiles round the player's lamp (Rimeholt's mirror-ice caves: 3, GDD-00 §4). The validator and loader ignore the field today.
3. [SPIRE / SUMMIT lanes] Done: the interiors' doors land on the markers (`toMarker: 'spire-step'` at the §15.0.4 cells, `hollis-gate-step` (59,11) and `lantern-stack-step` (29,2) on the Bar), and the round trip is tested. Keep the cells and the marker names together if either side moves.
4. [SYS-ENCOUNTER] The isle tables write night-leaning rows at the day band and let the system add +2 at night (no compensation as in Pellwick's reeds); Errant rows sit 1–2 levels over the band on purpose.
5. [SYS-GATHER] Lowmoor's `flats` (sparkles and cockles at a low; `glint: false`, `skyglass: false`: the Glint and night relics stay Pellwick's).
6. [CAST / STORY] Place isle folk, leaders and rivals by the §15 marker names; Spire leaders stand inside their Spires (the markers outside — `maud-practice-table`, `osric-quarry`, `ines-spa`, `wendel-boatyard`, `ada-ridge`, `ivo-ridge`, `seraphine-caves` — are their off-duty posts).

**16.3 Art requests** (prop / tile art the isle maps name that `js/art` does not draw yet): `memorial-stone` (Cairnhold's memorial, a carved granite plinth with names; the entity uses it, `standing-stone` is the fallback); a **Spire tower** prop per Spire (32×64 over the stone face, tinted per theme) so the Spires read from across the isle; a `bar-spur` sand-bar tile (16.2.1); nice to have: a `slipway` tile for Wendel's boatyard, a `stilt-deck` edge for Mossgate's decks over water, a `windmill-sails` animation for the moor windmills, and an `ice-facade` variant of the stone wall for the Mirror Spire's face cut into the glacier.

---

## 17. World verification (verifier pass)

**17.1 What is proven.** `node tools/map-reachability.mjs` (and `test/data.world.reach.test.mjs`) loads all 24 maps through `world/tilemap.loadMap` with every tide tile resolved by `clockSys.tideWindow` for its `way` at the moment checked (`openFlag`, `spring` honoured), treats solid entities as walls (an entity whose `cond` fails is absent), follows warps whose `cond` passes, and BFSes the world from the cell in front of the Keeper's Cottage door (Pellwick 9,23). At the first high water of days 2, 3, 4, 7 and 9: every isle Waystone, every Spire door and Spire, all six town interiors and all six isles are reached on foot; Shardcrown is **not** reached until `lit.bar`, then it and the seventh Waystone are; the Lantern Stack stays behind its spur window even when lit; `sp.summit-open` opens the Keepers' and Idris's halls. At each lower low Shardcrown and the stack are reached; at each other low the stack is and Shardcrown is not. Every tide-gated warp (13 short ways, the Bar road both ends, the far Bar door, the spur door) is reachable on its own map **exactly** inside its window at every 5-minute sample of days 2–5, and the Bar road at every sample once lit. Every warp (variants included) lands on a cell walkable at some tide (doors and stairs at both), never on another warp, beside a return warp that lands back beside it. The wade rule holds on every map (`world/tide.strandedTiles` empty). The audit adds: every scheduled resident's home door, porch and work post marker (the table in the test is the contract for the cast chapter), every §12 beat's staging markers, a post marker for all 65 TRAINER_IDS under both `trainer-<id>` and the `post` name `data/trainers.js` uses, 20 porches with the GDD's seven lit, 95 fruit / 6 purse / 4 bee trees each shakeable from a cell reached at high water, and encounter rows inside their region bands with town wilds ≤ Lv5 at night.

**17.2 What the verifier fixed.**
- *The spur was unreachable at an ordinary low*: the whole Bar road opened only at the lower low, so the spur's every-low window was dead. Split into `bar-road-near` (point → spur foot, every low) and `bar-road` (spur foot → Shardcrown, lower low); the spur is its own `bar-spur` tile. Pellwick's Bar warp and the Bar's west edge are now `way: 'spur'` short ways; the sign says so.
- *Tide ways were implicit*: `way` added to every tide tile and every gated warp.
- *Trainer posts*: 23 trainers (Spire leaders, Keepers, Idris, Pip, Linnet's dock, Merrow's engine, Corin's three exhibitions, the eight Porch Duels) had no `trainer-<id>` marker, and none of the 65 `data/trainers.js` `post` names existed on any map. Both are now on every map, same cell.
- *Town levels*: the reeds' day rows could roll Lv7 at night and the lit point Lv8; split / lowered so town wilds stay Lv2–5 at every hour (GDD-00 §4).
- *Pellwick composition* (looked at in `test/out/maps/pellwick.png`): the island was a rectangle with ruler-straight east and west coasts and a 43×5 bare cobble slab for a quay. Now: an irregular east shore of sand, shingle spits and surf rocks; sea stacks and a shallow shelf off the west cliffs; reed tufts breaking the marsh edge with the deep band shoaling toward it; a stone breakwater from the dock foot round to a harbor light at (30,46) enclosing sheltered shallows (Maud's dock mooring moved to 19,42 inside it); a slipway down to wet sand between the mooring posts; a timber fish wharf and clustered creels, nets and crates on the quay; ragged pine-wood corners; staggered orchard rows and a second fruit-tree look (`tree-fruit-b`). The Bar's comb-pattern sea edges were replaced by uneven shoals.
- `the-thatch` marker tagged; `ART_REQUESTS` emptied (all art landed).

**17.3 For other lanes.**
- [THREADS] Beat `where` cells that stand on a tree, roof or water; snap them to the markers: `oyster-boat` 2/4 and `empty-creek` 1/2/4 (30,5) is the tree *Brindle* → `tamsin-boat` (44,5) / `ansel-creek` (47,5); `empty-creek` 3 (26,6) is Thessaly's roof → `ansel-launch` (50,9); `empty-creek` 5 (20,3) is the river mouth → `weir-wheel` (52,6); `twelve-lights` 5 and `water-pack` 4 (5,21) is the tree *Fernside* → `point-skywatch` (5,20) / `wick-cliff-stair` (10,30); `the-bell` 3 (54,44) → `bell-dig` (56,44) (spring low).
- [WORLD-MAP / OVERWORLD] §8.2 item 1: per-tile `gateTide(world, tile.way)`.
- [RENDER] `bar-spur` art; Spire-tower props so each Spire reads from across its isle.

