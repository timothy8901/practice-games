# GDD-01 — THE WORLD (maps, tiles, encounters)

Chapter 1 of the full GDD (GDD-00 §17). It turns GDD-00 §2–§5 and §16 into data: the tile kinds every map paints with, the conventions every map file follows, the 24 maps (Pellwick authored, the rest stubbed for their authors), the curve regions and the encounter tables. GDD-00 wins over this file; ids come from `GDD-ids.md` / `js/data/ids.manifest.js` and are never invented here.

| File | What | Status |
|---|---|---|
| `js/data/tilesets.js` | `TILESETS` (TileDef rows), `TILES` by id, `DEFAULT_LEGEND`, `ART_REQUESTS` | authored (167 tile kinds, 89 legend chars) |
| `js/data/maps/index.js` | `MAPS` in MAP_IDS order, `MAPS_BY_ID` | authored |
| `js/data/maps/pellwick.js` | the hub, 64×48 | **authored** (§5) |
| `js/data/maps/<other 23>.js` | minimal valid maps with `stub: true` | stubs for the isle / interior / summit authors (§3) |
| `js/data/regions.js` | `REGIONS` (9 curve regions) | authored (§4) |
| `js/data/encounters/index.js` | `ENCOUNTERS` merged from region files | authored |
| `js/data/encounters/pellwick.js` | reed edges, reach hooks, the lit point | authored (§6) |
| `js/data/encounters/isles.js` | every isle table id with a starter row set | skeleton for the isle author (§6.3) |
| `test/data.world.test.mjs` | validator + manifest + loadMap + Pellwick content checks | green |

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
| `lowmoor` | exterior | lowmoor | 48×32 | stub | **(46,22)** from the Pellwick stones (short way); **(46,4)** from the marsh boardwalk (long way); edge warps back at (47,22) and (47,4) |
| `cairnhold` · `emberstep` · `drownwood` · `thistlewind` · `rimeholt` | exterior | own | 48×32 | stub | each isle author fixes its own ring arrivals and lists them here |
| `the-bar` | exterior | the-bar | 64×24 | stub | **(1,12)** from Pellwick's Bar road; edge back at (0,12) |
| `spire-turn` … `spire-mirror` | interior | the isle's | 20×14 | stub | door (10,13), arrival (10,12) |
| `int-cottage` | interior | pellwick | 16×12 | stub | door (8,11), arrival (8,10) → back to (9,23) |
| `int-pells` | interior | pellwick | 14×10 | stub | door (7,9), arrival (7,8) → back to (24,20) |
| `int-post-office` | interior | pellwick | 12×10 | stub | door (6,9), arrival (6,8) → back to (48,20) |
| `int-archive` | interior | pellwick | 16×12 | stub | door (8,11), arrival (8,10) → back to (32,20) |
| `int-yard-shed` | interior | pellwick | 14×10 | stub | door (7,9), arrival (7,8) → back to (56,26) |
| `int-lighthouse` | interior | pellwick | 12×18 | stub | door (6,17), arrival (6,16) → back to (4,19) |
| `hollis-gate` · `keepers-hall` · `idris-hall` | interior | shardcrown | 20×14 | stub | door (10,13), arrival (10,12) |
| `lantern-stack` | interior | the-bar | 20×16 | stub | door (10,15), arrival (10,14) |

**3.1 Stubs.** Each stub is a legal map (`stub: true`): a shallows-ringed lawn or a walled room with its door, a sign, its `entry`, and the warps that make Pellwick's edges and doors round-trip. Replacing a stub: keep the id, size and the arrival points in the table (or change Pellwick's warps in the same change), drop `stub: true`, keep `test/data.world.test.mjs` green.

**3.2 What every isle map must hold** (GDD-00 §4): a low-tide **short way** in (tide tiles of the right window) and an any-tide **long way**; the dock **Waystone** (§1.8) with its tide chalkboard; a **skyglass node**; **two reaches** (`reaches[]` with the isle's `<isle>-water` table as `creatureTable`); a **dig site** (`dig.spots`); 5 route trainers (markers `trainer-<trainerId>`); a **ferry stop** (`use` verb `ferry` + marker `ferry-stop`); the **Spire door** (door warp to `spire-<id>`, door (10,13)); spawns using `<isle>-land` (grass keyword: tall grass/heather/thistles) and `<isle>-water`; the isle's holds from GDD-00 §4 as markers (`maud-practice-table`, `linnet-rematch-stones`, `cairnhold-memorial`, `drowning-street`, `idris-gallery` …). The test's reachability check (every Waystone and Spire door reachable from the entry at any tide via the long way) should be extended to each isle as it lands.

---

## 4. Regions (`js/data/regions.js`)

| id | Name | Curve level | Day wild band | Music |
|---|---|---|---|---|
| `pellwick` | Pellwick | 4 | 2–5 (the reed edges) | hourly |
| `lowmoor` | Lowmoor | 7 | 3–8 | hourly |
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

**6.3 Isles** (`encounters/isles.js`) — every isle id in ENCOUNTER_IDS with a starter set from GDD-00 §4's holds at the isle's band (Lowmoor's starters at 15% each; Prismoth, Chillnub and Cairnward first on Cairnhold; Squallcoil and Hailcoil as `roam: 'route'` rows on Emberstep and Rimeholt). The isle author replaces the rows (mods, rarities, Errant routes) and keeps the ids.

---

## 7. Tide on the map

Tide tiles carry their window (`tideWindow`), so the map screen and the wade rule (`world/tide.nearestDry`) read one source: causeways 150 min, stepping stones (sea and river) 120, mud flats / glow mud / the Bar 90 (the Bar only at the lower low until `lit.bar`), the mainland causeway 60, the Old Quay 90 at a spring low only. Wet sand floods visually but stays walkable. Every Pellwick warp is reachable from the entry at low water; every warp but the stones and the Bar is reachable at high water too, and Lowmoor is always reachable by the long way — the "no tide walls passage" rule (GDD-00 §4), asserted by `test/data.world.test.mjs`.

---

## 8. Requests

**8.1 Manifest requests.** None: every id used here is in `ids.manifest.js`. (Entity ids for trees, signs and furniture are map-local, not a manifest table.)

**8.2 Engine / system requests** (owners in brackets):
1. [WORLD-MAP] Honour `tideWindow`, `lowerLow`, `openFlag` and `spring` on tide tiles (today every `tide:'low'` tile opens at the same `tide < 0.2`). Until then the windows are documentation.
2. [WORLD-MAP / validator] Treat `tide:'glow'` as low-only in `validate-data` passability (the loader already does).
3. [SYS-GATHER] Resolve `fruitFrom: 'native'` on tree entities to the seed's native fruit (GDD-00 §9 "one native fruit per seed"); trees carry no `fruit` id so the validator stays independent of the collections table.
4. [RENDER] Draw porch lamps from porch entities (`porch: true`, lamp cell, lit state), roofs from `autotile:'roof'` blocks, `roof-keeper` in the player's colour, `litArt` after dusk, `artByTier` in the cottage.
5. [SYS-TOWN] Set `sys.commons.<projectId>` when a Commons project is funded and `sys.lantern-market` during market hours (conditional props and stalls read them; `sys.` flags are system-owned).
6. [SYS-WORLD] Town reeds: the night +2 bonus can lift a day row above GDD-00's "Lv2–5"; the tables compensate on the night-lean rows. Decide whether town maps are exempt.
7. [STORY / CAST] Place people by `markers` names and add step triggers over the named `regions` (§1.5–1.6).

---

## 9. Art requests

Tile art the tables name that `js/art/tiles` / `js/art/props` do not draw yet: `counter`, `shelf`, `table`, `bed`, `stairs-up`, `stairs-down` (interiors); `string-wall` (Barnaby's string wall); `timber-stack` (Wren's alder planks); `carnival-raft` (the Raft at the Old Pier, prop); an `abacus-counter` prop for Wren's table (the yard counter borrows `crates` today). Nice to have: a `quay-granite` ground distinct from `cobbles-b`, a `bar-road` sand-bar variant of the causeway, and a `burrow-door` for the Dorrows (uses `door-arch`).

---

## 10. Validation

`node --test test/data.world.test.mjs` (14 tests): `validateData` reports zero errors in maps/tilesets/encounters/regions with these tables swapped into `DATA` (species and story script ids stubbed only where their lanes have not landed); `checkManifest` finds maps, encounters and regions complete; every map loads through `world/tilemap.loadMap`; Pellwick holds the 20 porches (7 lit), 95 fruit / 6 purse / 4 bee trees each reachable, every warp reachable at low water with the short ways tide-gated and the long way open, interior doors round-trip, every marker on reachable ground, every resident and §12 beat named, two river and two quay reaches over water, flats and dig spots reachable, reeds the only spawn cover, and the animated-tile budget. Expected validator *warnings*: the stones and Bar warps are unreachable at high tide (by design); isle tables have no spawning map until the isles land; `lit.calls` and `sp.raft-docked` are read before the story chapter sets them.
