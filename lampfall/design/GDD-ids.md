# GDD-ids — THE id manifest (LAMPFALL)

Every content id in the game, per table, with its display name and the one-line facts other chapters need to reference it. **Ids are frozen**: chapters author rows with exactly these ids (kebab-case, `/^[a-z0-9][a-z0-9-]*$/`, unique within a table) and may refine facts only inside GDD-00's ranges. The same ids are exported as frozen arrays by `js/data/ids.manifest.js`; `node tools/validate-data.mjs` warns when an authored table is missing manifest ids or has extra ones. To add, rename or cut an id, change this file and the manifest together (and say so in the chapter).

Names in **GDD-00 win**; where GDD-00 gives only a count, names here are invented for this manifest (original names; flagged *inv.*). Prototype ids (`proto/battle/*`, `proto/creatures/sprites.js`) are reused wherever GDD-00 keeps the thing.

**Conventions.** Cross-table references use these ids (`familyId`, `ability`, `learnset` move ids, `npcId`, `mapId`, `species` in trainer parties, `relicId` on letters). Trainer scripts are named `<trainerId>-before`, `<trainerId>-win`, `<trainerId>-loss`; thread beat scripts `<threadId>-<n>`; NPC topic scripts `<npcId>-<topic>`; a family letter's door is a `porch-*` id. Display names live in `name` fields, never in ids.

## 0. Counts

| Table | Count | Export |
|---|---|---|
| Types | 13 | TYPE_IDS |
| Families | 16 (14 Shift + 2 singleton rows) | FAMILY_IDS |
| Species / forms | 42 | SPECIES_IDS |
| Moves | 65 (64 techniques + Scrap) | MOVE_IDS / TECHNIQUE_IDS |
| Abilities | 25 | ABILITY_IDS |
| Items | 26 | ITEM_IDS |
| Discs | 12 | DISC_IDS |
| Key items | 12 | KEY_ITEM_IDS |
| Keepsakes | 9 | KEEPSAKE_IDS |
| Goods | 6 | GOODS_IDS |
| Regions | 9 | REGION_IDS |
| Maps | 24 | MAP_IDS |
| Waystones | 7 | WAYSTONE_IDS |
| Spires / badges | 6 | SPIRE_IDS |
| NPCs | 43 | NPC_IDS |
| Trainers | 65 | TRAINER_IDS |
| Letters | 58 (56 + 2 event) | LETTER_IDS |
| Threads | 10 | THREAD_IDS |
| Fish / bugs / finds / fruit | 18 / 10 / 18 / 9 | FISH_IDS, BUG_IDS, FIND_IDS, FRUIT_IDS |
| Commissions / Commons projects / loans | 6 / 6 / 7 | COMMISSION_IDS, COMMONS_PROJECT_IDS, LOAN_IDS |
| Shops | 8 | SHOP_IDS |
| Festivals | 4 | FESTIVAL_IDS |
| Furniture / clothes / roofs | 24 / 12 / 8 | FURNITURE_IDS, CLOTHES_IDS, ROOF_COLOUR_IDS |
| Journal stamps | 24 | STAMP_IDS |
| Porches | 20 | PORCH_IDS |
| Dials / challenges / weather | 3 / 4 / 5 | DIAL_IDS, CHALLENGE_IDS, WEATHER_IDS |
| Encounter tables | 17 | ENCOUNTER_IDS |
| Story scripts | 72 | SCRIPT_IDS |
| Story flags | 50 | FLAG_IDS |

## 1. Rulings this manifest makes (where sources disagree)

1. **Techniques: 64 + Scrap = 65 move ids, 11 new.** GDD-00 §16's formula (12 types × 4 + 15 signatures + Plumbline, Scrap separate) gives 64; the prototype's 54 *includes* Scrap, so 53 carry over and **11** are new (not 10). Each ordinary type now has 4 non-signature techniques except Glass (3), whose fourth slot is the prototype's Star move `starfall` (kept: Star-touched forms and the Vagary learn it).
2. **Abilities: 25, one new.** The prototype has 25 abilities *including* both `prism-ward` and `glasshide`; the merge leaves 24, so `dusksight` (Duskowl line) is added to reach GDD-00's 25.
3. **Families: 16 rows.** The 14 Shift families plus singleton rows `stillox` and `vagary`, because the validator requires every form's `familyId` to resolve. Prototype family ids that differ (`lumenveil`, `mudfist`, `rushling`, `squallcoil` as their own families) are replaced by GDD-00's families (`prismoth`, `scrapling`, `sedgehare`, `errant`).
4. **Wards on four forms only.** The prototype gave Puddlepip `glasshide`; it becomes `shoresense`. Stages follow GDD-00 (Chillnub and Sootling are stage 1, Vesperay stage 2); Errants, Stillox and the Vagary keep the prototype's stage 4.
5. **Star-touched forms are not species rows** (GDD-00 §8: palette variants, not counted). The prototype row `star-touched-sloshkin` is retired; a Star-touched creature is a flag plus palette on its form, and `family.star` names the form that can appear Star-touched.
6. **Sprites.** `proto/creatures/sprites.js` draws **22** forms (the 15 + Siltback, Bogmonarch, Lumenveil, Mudfist, Rushling, Puddlepip, Chillnub) plus Star-touched Sloshkin, so **20** forms need sprite briefs (GDD-00 §17 says 16; the four prototype stat rows Bilgebob, Sootling, Knuckleback, Cragmitt have no art either).
7. **Scheduled residents = 16** (14 neighbors + Corin + Linnet). Dimity is a fixture who lives in your lamp, so she has an NPC id but no walking schedule.
8. **Flags `lit.*` keep GDD-00's spelling** (`lit.shiftTide`...). `js/state/schema.js FLAG_NAMESPACES` currently lacks `lit.`, so `systems/flags.setFlag('lit.shiftTide')` would throw until the STATE owner adds the namespace.
9. **Linnet's starter is a Sootling** that Shifts Up 100% to Caldermaw at the dock (GDD-00 names only the result; the arc returns her to Sootling).
10. **Starsalt and anchor stones** are wallet-counted (`starsalt`, `anchors`) but get item rows (`starsalt`, `anchor-stone`) so shop stock resolves; GDD-02 may instead teach shops a wallet stock kind and drop the rows.

## 2. Types (13)

| id | Name |
|---|---|
| `plain` | Plain |
| `grit` | Grit |
| `brine` | Brine |
| `kiln` | Kiln |
| `moss` | Moss |
| `bolt` | Bolt |
| `rime` | Rime |
| `gust` | Gust |
| `stone` | Stone |
| `rust` | Rust |
| `glass` | Glass |
| `hollow` | Hollow |
| `star` | Star |

Hollow is immune to Plain and Grit (the chart as written in wildshift-creatures §5).

## 3. Families (16)

| id | Name | Kind | Forms (stage) | Note |
|---|---|---|---|---|
| `sloshkin` | Sloshkin line | shift | puddlepip (0), sloshkin (1), siltback (2), skeinwing (2), bogmonarch (3) | Source pool weights (wildshift-creatures §6.2); Up Siltback/Skeinwing/Bogmonarch/Lumenveil, Side Mudfist/Rushling, Down Puddlepip/Chillnub; Star-touched replaces Side 2% |
| `scrapling` | Scrapling line | shift | scrapling (1), mudfist (1), knuckleback (2), cragmitt (3) | Narrow forward line Scrapling > Knuckleback > Cragmitt |
| `sedgehare` | Sedgehare line | shift | reedkit (1), rushling (1), sedgehare (2) | Moss line; Bryony's bean-row Sedgehare |
| `prismoth` | Prismoth line (the Ward family) | shift | mothling (1), prismoth (2), cairnward (2), lumenveil (3) | Three of the four Ward forms; none encounterable before Cairnhold |
| `vesperay` | Vesperay line | shift | rayling (1), vesperay (2) | Idris's line; Vesperay anchored since it hatched |
| `bilgebob` | Bilgebob line | shift | bilgebob (1), brinelance (2) | Brinelance from Bilgebob's Up card |
| `creelwight` | Creelwight line | shift | rustcreel (1), creelwight (2), hulkwight (3) | Hollow/Rust wall line; Tamsin's "Kettle" |
| `wirewhisk` | Wirewhisk line | shift | wirewhisk (1), coilcrest (2) | Bolt scouts |
| `rimeplate` | Rimeplate line | shift | chillnub (1), rimeplate (2), floeback (3) | Chillnub is a Ward (Stillcoat) |
| `caldermaw` | Caldermaw line | shift | sootling (1), emberjaw (2), caldermaw (3) | Linnet's line (The Ember Grub) |
| `rillfin` | Rillfin line | shift | rillfin (1), gillwick (2), strandrunner (3) | Wick's line (The Water Pack) |
| `tossup` | Tossup | shift | tossup (1) | One form; its pools draw stage-1 forms of other families |
| `errant` | Errant | shift | squallcoil (4), hailcoil (4) | Squallcoil <-> Hailcoil; Down card never a hatchling on Drift/Flux |
| `duskowl` | Duskowl line | shift | skirl (1), duskwisp (1), duskowl (2) | Night owls; Corin's Tossup exhibitions face them |
| `stillox` | Stillox (unshifting) | single | stillox (4) | Singleton family row so familyId resolves; never Shifts; Mooring emblem |
| `vagary` | Vagary (unshifting) | single | vagary (4) | Singleton family row so familyId resolves; never Shifts; never on a Forecast card |

## 4. Species / forms (42)

Grouped by family. *Sprite* = drawn in `proto/creatures/sprites.js` (key by form id when moved to `art/creatures`). Abilities for forms without a source ability are assigned here.

### Sloshkin line (`sloshkin`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `puddlepip` | Puddlepip | 0 | Brine | `shoresense` | yes | Sloshkin's hatchling; F5 creature; Lowmoor wild |
| `sloshkin` | Sloshkin | 1 | Brine | `shoresense` | yes | starter (suggested name PUDDLE); signature Undertow |
| `siltback` | Siltback | 2 | Brine/Stone | `tidecall` | yes | forward Up card; Isolde's creature in the letters |
| `skeinwing` | Skeinwing | 2 | Brine/Gust | `featherbed` | yes | Shift-only form; signature Skein Sweep |
| `bogmonarch` | Bogmonarch | 3 | Brine/Stone | `tidecall` | yes | stage-3 skip-ahead Up card |

### Scrapling line (`scrapling`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `scrapling` | Scrapling | 1 | Grit | `big-sibling` | yes | starter; Wren's "Peg", Tully's partner; signature Shadowbox |
| `mudfist` | Mudfist | 1 | Grit | `slatehide` | yes | Side card from Sloshkin; Lowmoor wild |
| `knuckleback` | Knuckleback | 2 | Grit | `big-sibling` | — | Scrapling forward line |
| `cragmitt` | Cragmitt | 3 | Grit/Stone | `slatehide` | — | Scrapling line top |

### Sedgehare line (`sedgehare`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `reedkit` | Reedkit | 1 | Moss | `sure-footing` | — | starter |
| `rushling` | Rushling | 1 | Moss/Brine | `scavenger` | yes | Side card from Sloshkin; hooked on any reach; Drownwood wild |
| `sedgehare` | Sedgehare | 2 | Moss | `keen-glint` | yes | crit threat; Bryony's bean-row creature; signature Reap |

### Prismoth line (the Ward family) (`prismoth`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `mothling` | Mothling | 1 | Glass | `still-mind` | — | F9 creature; Cairnhold wild |
| `prismoth` | Prismoth | 2 | Glass/Gust | `glasshide` | yes | Ward (Glasshide); Ward Spire ace Lv16; Odile's; visits lit porches; signature Dust Veil |
| `cairnward` | Cairnward | 2 | Stone/Glass | `stillcoat` | — | Ward (Stillcoat); Merrow's Engine ace; Cairnhold rare |
| `lumenveil` | Lumenveil | 3 | Glass | `mirrorveil` | yes | Ward (Mirrorveil); Mirror Spire ace Lv43; Sloshkin Up card |

### Vesperay line (`vesperay`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `rayling` | Rayling | 1 | Brine | `tidecall` | — | Emberstep wild |
| `vesperay` | Vesperay | 2 | Brine/Glass | `afterimage` | yes | Champion Idris's ace Lv50, anchored; signature Vesper Mend |

### Bilgebob line (`bilgebob`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `bilgebob` | Bilgebob | 1 | Brine | `sodden` | — | F1 creature; Turn Spire ace Lv9; Augusta's; hooked on any reach; must not read as Wailmer/Cetoddle |
| `brinelance` | Brinelance | 2 | Brine/Rime | `last-ebb` | yes | accidental Shift hero; signature Gnash |

### Creelwight line (`creelwight`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `rustcreel` | Rustcreel | 1 | Rust | `scavenger` | — | Drownwood wild |
| `creelwight` | Creelwight | 2 | Hollow/Rust | `empty-weave` | yes | Hollow wall; Tamsin's "Kettle" holds the nameboard; signature Snuff |
| `hulkwight` | Hulkwight | 3 | Hollow/Rust | `empty-weave` | — | Hollow Spire ace Lv29 (cut-order 12) |

### Wirewhisk line (`wirewhisk`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `wirewhisk` | Wirewhisk | 1 | Bolt | `tailhum` | yes | scout; Pip's Lv4; Juniper's; F13 creature; signature Arc Ping |
| `coilcrest` | Coilcrest | 2 | Bolt/Gust | `still-mind` | — | Relay Spire ace Lv36; Thistlewind wild (cut-order 12) |

### Rimeplate line (`rimeplate`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `chillnub` | Chillnub | 1 | Rime | `stillcoat` | yes | Ward (Stillcoat); Sloshkin Down card; Cairnhold wild |
| `rimeplate` | Rimeplate | 2 | Rime/Stone | `plateshed` | yes | Down-Shift example; signature Plate Toss |
| `floeback` | Floeback | 3 | Rime/Stone | `plateshed` | — | Rimeholt wild (cut-order 12) |

### Caldermaw line (`caldermaw`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `sootling` | Sootling | 1 | Kiln | `ember-core` | — | the ember grub; Linnet's starter and her Act III-IV lead |
| `emberjaw` | Emberjaw | 2 | Kiln | `furnace-jaw` | — | Weather Spire ace Lv22 (cut-order 12) |
| `caldermaw` | Caldermaw | 3 | Kiln/Stone | `furnace-jaw` | yes | Linnet's Lv5 dock Shift (Up 100%); signature Kiln Maw |

### Rillfin line (`rillfin`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `rillfin` | Rillfin | 1 | Brine | `scavenger` | — | Wick's partner |
| `gillwick` | Gillwick | 2 | Brine/Moss | `tidecall` | — | gill-breather; Wick's water pack; Thistlewind wild |
| `strandrunner` | Strandrunner | 3 | Brine/Gust | `sure-footing` | — | walks and swims; Wick's Long Road ace (cut-order 12) |

### Tossup (`tossup`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `tossup` | Tossup | 1 | Plain | `blank-slate` | yes | first catch (reeds, 62%); Corin's exhibition partner; signature Sure Pinch |

### Errant (`errant`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `squallcoil` | Squallcoil | 4 | Bolt/Brine | `skyroam` | yes | Errant (Emberstep onward); signature Bandlight |
| `hailcoil` | Hailcoil | 4 | Rime/Gust | `skyroam` | — | Errant (Rimeholt) |

### Duskowl line (`duskowl`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `skirl` | Skirl | 1 | Gust | `featherbed` | — | Thistlewind wild (cut-order 12) |
| `duskwisp` | Duskwisp | 1 | Hollow | `dusksight` | — | Drownwood wild |
| `duskowl` | Duskowl | 2 | Hollow/Gust | `dusksight` | — | night owl; Thistlewind wild |

### Stillox (unshifting) (`stillox`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `stillox` | Stillox | 4 | Stone | `unshifting` | yes | unshifting titan; Thistlewind rare; signature Bedrock Charge |

### Vagary (unshifting) (`vagary`)

| id | Name | Stage | Types | Ability | Sprite | Role / facts |
|---|---|---|---|---|---|---|
| `vagary` | Vagary (the Passenger) | 4 | Star | `unfixed` | yes | 96x96; the Reading; perched catchable post-game; signature Tailfall |

## 5. Moves (65: 64 techniques + Scrap)

Prototype moves keep their ids, numbers and text. **New** moves are marked; their numbers are starting values for GDD-04. Acc `—` = never misses; PP `—` = Scrap only. *Sig* = signature (that species' learnset must contain it).

### Plain

| id | Name | Cat. | Pow | Acc | PP | Pri | Sig | New | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `tap` | Tap | physical | 40 | 100 | 35 | 0 |  |  | An everyday blow. |
| `sure-pinch` | Sure Pinch | physical | 40 | — | 20 | 0 | `tossup` |  | Never misses. An early answer to evasion. |
| `shell-rattle` | Shell Rattle | special | 55 | 100 | 25 | 0 |  |  | A rattling shock of sound. |
| `settle` | Settle | status | 0 | — | 20 | 0 |  |  | Raises the user's Defence and Sp. Defence. |
| `shellguard` | Shellguard | status | 0 | — | 10 | 4 |  |  | Guards against every move this turn. Fails if used on consecutive turns. |

### Grit

| id | Name | Cat. | Pow | Acc | PP | Pri | Sig | New | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `knuckle` | Knuckle | physical | 60 | 100 | 25 | 0 |  |  | A wrapped-fist punch. |
| `grind-down` | Grind Down | physical | 85 | 90 | 15 | 0 |  |  | A grinding grapple. |
| `pummel` | Pummel | physical | 20 | 100 | 20 | 0 |  |  | Hits 2 to 5 times. Each hit pops one Afterimage decoy. |
| `sand-smother` | Sand Smother | status | 0 | 100 | 20 | 0 |  |  | Lowers the target's Attack. |

### Brine

| id | Name | Cat. | Pow | Acc | PP | Pri | Sig | New | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `undertow` | Undertow | physical | 65 | 100 | 15 | 0 | `sloshkin` |  | Lowers the target's Speed one stage. |
| `salt-spray` | Salt Spray | special | 50 | 100 | 25 | 0 |  |  | A spray of stinging salt water. |
| `riptide` | Riptide | special | 90 | 85 | 10 | 0 |  |  | A dragging surge of sea. |
| `tidal-mend` | Tidal Mend | status | 0 | — | 10 | 0 |  |  | Heals 50% of max HP. Spends one Mend. |
| `breaker` | Breaker | physical | 75 | 95 | 15 | 0 |  | **new** | Contact. A wave-slam; no secondary effect. |

### Kiln

| id | Name | Cat. | Pow | Acc | PP | Pri | Sig | New | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `ember-lick` | Ember Lick | special | 45 | 100 | 25 | 0 |  |  | May burn the target. |
| `kiln-maw` | Kiln Maw | special | 75 | 100 | 15 | 0 | `caldermaw` |  | A furnace blast from the jaws. |
| `scorch` | Scorch | status | 0 | 85 | 15 | 0 |  |  | Burns the target. |
| `slag-burst` | Slag Burst | physical | 80 | 100 | 10 | 0 |  |  | A slam of molten slag. May burn. |
| `flashover` | Flashover | special | 100 | 90 | 5 | 0 |  | **new** | Lowers the user's Sp. Attack one stage. The "Kiln disc" (2,500). |

### Moss

| id | Name | Cat. | Pow | Acc | PP | Pri | Sig | New | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `reed-whip` | Reed Whip | physical | 50 | 100 | 25 | 0 |  |  | A lash of sharp reeds. |
| `reap` | Reap | physical | 70 | 100 | 15 | 0 | `sedgehare` |  | High crit rate. |
| `root-knot` | Root Knot | status | 0 | 90 | 15 | 0 |  |  | Traps the target for 4 turns; it takes chip damage and cannot switch. |
| `spore-drift` | Spore Drift | status | 0 | 90 | 20 | 0 |  |  | Poisons the target. |
| `mire-bloom` | Mire Bloom | special | 80 | 100 | 10 | 0 |  | **new** | Heals the user by 1/4 of the damage dealt (drain; not a Mend). |

### Bolt

| id | Name | Cat. | Pow | Acc | PP | Pri | Sig | New | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `arc-ping` | Arc Ping | special | 30 | 100 | 20 | 1 | `wirewhisk` |  | Moves first. Reveals the target's full moveset. |
| `jolt` | Jolt | special | 65 | 100 | 20 | 0 |  |  | May numb the target. |
| `bandlight` | Bandlight | special | 90 | 100 | 10 | 0 | `squallcoil` |  | The bands light in sequence one turn, then it strikes the next. |
| `static-net` | Static Net | status | 0 | 90 | 20 | 0 |  |  | Numbs the target. |
| `fizz` | Fizz | special | 40 | 100 | 30 | 0 |  | **new** | 10% chance to numb. |
| `live-wire` | Live Wire | physical | 95 | 100 | 10 | 0 |  | **new** | Contact. Lowers the user's Defence one stage. |

### Rime

| id | Name | Cat. | Pow | Acc | PP | Pri | Sig | New | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `frost-nip` | Frost Nip | special | 50 | 100 | 25 | 0 |  |  | May chill the target. |
| `plate-toss` | Plate Toss | physical | 60 | 100 | 15 | 0 | `rimeplate` |  | Throws one of its own plates; it grows back at the end of the turn. |
| `hoarfrost` | Hoarfrost | special | 80 | 95 | 10 | 0 |  |  | A hard cold. May chill. |
| `rime-lock` | Rime Lock | status | 0 | 75 | 10 | 0 |  |  | Chills the target for a few turns. |
| `floe-ram` | Floe Ram | physical | 70 | 100 | 15 | 0 |  | **new** | Contact. 10% chance to chill. |

### Gust

| id | Name | Cat. | Pow | Acc | PP | Pri | Sig | New | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `skein-sweep` | Skein Sweep | special | 60 | 100 | 15 | 0 | `skeinwing` |  | Hits both foes in doubles. Pops every Afterimage decoy on a miss. |
| `gale-cut` | Gale Cut | physical | 70 | 100 | 15 | 0 |  |  | A cutting wind. |
| `updraft` | Updraft | status | 0 | — | 20 | 0 |  |  | Sharply raises the user's Speed. |
| `mirror-step` | Mirror Step | status | 0 | — | 5 | 0 |  |  | Raises evasion one stage (max +2). |
| `downdraft` | Downdraft | special | 40 | 100 | 30 | 1 |  | **new** | Moves first (priority +1). |

### Stone

| id | Name | Cat. | Pow | Acc | PP | Pri | Sig | New | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `shard-fling` | Shard Fling | physical | 55 | 95 | 25 | 0 |  |  | Flings sharp stone. |
| `bedrock-charge` | Bedrock Charge | physical | 100 | 100 | 5 | 0 | `stillox` |  | Braces for one turn while dust falls, then hits. |
| `sandtrap` | Sandtrap | status | 0 | 85 | 15 | 0 |  |  | Traps the target for 4 turns; chip damage, no switching. |
| `stand-firm` | Stand Firm | status | 0 | — | 15 | 0 |  |  | Sharply raises the user's Defence. |
| `cairn-crash` | Cairn Crash | physical | 95 | 85 | 10 | 0 |  | **new** | Contact. Heavy, inaccurate. |

### Rust

| id | Name | Cat. | Pow | Acc | PP | Pri | Sig | New | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `rust-bite` | Rust Bite | physical | 60 | 100 | 20 | 0 |  |  | A bite of old iron. May poison. |
| `corrode` | Corrode | status | 0 | 90 | 25 | 0 |  |  | Poisons the target. |
| `iron-pin` | Iron Pin | physical | 80 | 100 | 15 | 0 |  |  | Pins with a rusted spike. |
| `hullburst` | Hullburst | physical | 150 | 100 | 5 | 0 |  |  | The user bursts apart and faints. Fails while Sodden is on the field. |

### Glass

| id | Name | Cat. | Pow | Acc | PP | Pri | Sig | New | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `dust-veil` | Dust Veil | special | 30 | 100 | 20 | 0 | `prismoth` |  | Low damage; 30% chance to poison. |
| `shardlight` | Shardlight | special | 75 | 100 | 15 | 0 |  |  | A beam through skyglass. |
| `dazzle` | Dazzle | status | 0 | 100 | 15 | 0 |  |  | Lowers the target's Attack and Sp. Attack. |
| `lens-focus` | Lens Focus | status | 0 | — | 15 | 0 |  |  | Sharply raises the user's Sp. Attack. |
| `vesper-mend` | Vesper Mend | status | 0 | — | 10 | 0 | `vesperay` |  | The eye panel brightens; at the end of next turn heals 50%. A Hollow hit in between cancels it. Spends one Mend. |

### Hollow

| id | Name | Cat. | Pow | Acc | PP | Pri | Sig | New | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `shadowbox` | Shadowbox | physical | 50 | 100 | 10 | 0 | `scrapling` |  | A jab at its own shadow. |
| `gnash` | Gnash | physical | 60 | 100 | 15 | 0 | `brinelance` |  | 30% flinch chance. Each hit pops one Afterimage decoy. |
| `snuff` | Snuff | special | 50 | 100 | 15 | 0 | `creelwight` |  | Removes the target's raised stat stages. |
| `echo-drain` | Echo Drain | special | 70 | 100 | 10 | 0 |  |  | Heals the user by half the damage dealt (not a Mend). |
| `murk` | Murk | special | 40 | 100 | 30 | 0 |  | **new** | 20% chance to lower the target's Sp. Defence one stage. |
| `drowned-bell` | Drowned Bell | special | 90 | 90 | 10 | 0 |  | **new** | 10% flinch. A bell tolls from under the bar. |
| `hush` | Hush | status | 0 | 100 | 15 | 0 |  | **new** | Sharply lowers the target's Sp. Attack (two stages). |

### Star

| id | Name | Cat. | Pow | Acc | PP | Pri | Sig | New | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `tailfall` | Tailfall | special | 90 | 100 | 10 | 0 | `vagary` |  | Takes the type next in the user's Unfixed queue. |
| `starfall` | Starfall | special | 70 | 100 | 15 | 0 |  |  | Comet light. Neutral against everything. |

### Typeless

| id | Name | Cat. | Pow | Acc | PP | Pri | Sig | New | Effect |
|---|---|---|---|---|---|---|---|---|---|
| `plumbline` | Plumbline | status | 0 | — | 10 | 0 |  |  | Always hits. Clears the target's stat stages and blocks re-boosting for 2 turns. |
| `scrap` | Scrap | physical | 50 | — | — | 0 |  |  | Typeless fallback. Never misses, costs the user 1/8 max HP, never pierces Wards. |

## 6. Abilities (25)

| id | Name | Ward | Forms | Text |
|---|---|---|---|---|
| `shoresense` | Shoresense |  | puddlepip, sloshkin | On switch-in it Reads the foe automatically. The foe's ability and any Ward go straight into the Field Log. |
| `featherbed` | Featherbed |  | skeinwing, skirl | Halves damage from the first contact hit each battle. |
| `big-sibling` | Big Sibling |  | scrapling, knuckleback | After each battle it takes part in, the lowest-level party member gets an extra 30% of its EXP. Lost if it faints. |
| `afterimage` | Afterimage |  | vesperay | Each evasion stage shows as a decoy (max 2). A hit that lands on a decoy pops it and deals no damage. |
| `unfixed` | Unfixed |  | vagary | At the end of each turn its type moves to the next in a posted loop of four: Star, then three seeded types. |
| `last-ebb` | Last Ebb |  | brinelance | Below 25% HP its Brine and Hollow moves gain 30% power. |
| `empty-weave` | Empty Weave |  | creelwight, hulkwight | The first hit each battle that is not Strong against it deals half damage. |
| `keen-glint` | Keen Glint |  | sedgehare | Raises its crit chance two stages. Its ears glint on a turn its next hit will crit. |
| `tailhum` | Tailhum |  | wirewhisk | On switch-in, reveals one foe move. |
| `plateshed` | Plateshed |  | rimeplate, floeback | The first Strong hit each battle deals neutral damage, and one plate falls off. |
| `skyroam` | Skyroam |  | squallcoil, hailcoil | Moves one route per in-game hour. Once seen, it shows on the map. (No battle effect.) |
| `blank-slate` | Blank Slate |  | tossup | Its Heartmark can carry any one of its techniques, chosen at its first Shift. (No battle effect.) |
| `unshifting` | Unshifting |  | stillox | Cannot Shift and its type never changes. Any effect that would force a type or form change fails. |
| `furnace-jaw` | Furnace Jaw |  | emberjaw, caldermaw | Its first Kiln move each battle never misses. |
| `glasshide` | Glasshide | strong-only | prismoth | Only Strong hits land. |
| `mirrorveil` | Mirrorveil | no-status | lumenveil | Status moves aimed at it fail. |
| `stillcoat` | Stillcoat | min-power | cairnward, chillnub | Hits under 50 power do nothing. |
| `sodden` | Sodden |  | bilgebob | Stops every creature on the field from using a self-KO move. |
| `tidecall` | Tidecall |  | siltback, bogmonarch, rayling, gillwick | Brine moves gain 20% power. |
| `ember-core` | Ember Core |  | sootling | Kiln moves gain 20% power. |
| `slatehide` | Slatehide |  | mudfist, cragmitt | Takes 25% less damage from physical hits. |
| `scavenger` | Scavenger |  | rushling, rustcreel, rillfin | Heals 1/8 of max HP after knocking out a foe. |
| `still-mind` | Still Mind |  | mothling, coilcrest | Cannot be numbed or chilled. |
| `sure-footing` | Sure Footing |  | reedkit, strandrunner | Foes cannot lower its stats. |
| `dusksight` | Dusksight (**new**, *inv.*) |  | duskwisp, duskowl | From 18:00 to 06:00 (night rules) its Hollow and Gust moves gain 20% power. |

Retired: `prism-ward` (merged into `glasshide`, GDD-00 §8).

## 7. Items (26) and discs (12)

| id | Name | Group | Price | Facts |
|---|---|---|---|---|
| `tallow-wick` | Tallow Wick | wick | 100 | x1 capture odds; starter kit has 5 |
| `brass-wick` | Brass Wick | wick | 300 | x1.5 capture odds |
| `skyglass-wick` | Skyglass Wick | wick | 600 | x2 capture odds; Pell's from badge 2 |
| `salve` | Salve | medicine | 80 | heals HP (spends a Mend in battle) |
| `tonic` | Tonic | medicine | 240 | heals more HP |
| `full-salve` | Full Salve | medicine | 600 | full HP |
| `revive` | Revive | medicine | 600 | revives at 50% HP |
| `ether` | Ether | medicine | 250 | restores PP to one move; Pell's from badge 3 |
| `full-ether` | Full Ether | medicine | 700 | restores PP to every move; Pell's from badge 3 |
| `poultice` | Poultice | cure | 150 | cures burn and poison |
| `warm-shawl` | Warm Shawl | cure | 150 | cures chill and numb |
| `crackdust` | Crackdust | battle | 300 | suppresses a Ward 3 turns; refused (kept) with no active Ward; Pell's + Cairnhold clinic |
| `still-knot` | Still Knot | held | 2000 | held: blocks every Shift while held (party: Held by Still Knot); the Anchorage |
| `tilt-brine` | Brine Tilt *inv.* | type-tilt | — | held: Brine forms weigh x2 on every Forecast card; Workshop polishes a skyglass relic |
| `tilt-stone` | Stone Tilt *inv.* | type-tilt | — | held: Stone forms weigh x2 on Forecast cards |
| `tilt-glass` | Glass Tilt *inv.* | type-tilt | — | held: Glass forms weigh x2 on Forecast cards |
| `tilt-gust` | Gust Tilt *inv.* | type-tilt | — | held: Gust forms weigh x2 on Forecast cards |
| `tilt-hollow` | Hollow Tilt *inv.* | type-tilt | — | held: Hollow forms weigh x2 on Forecast cards |
| `tilt-kiln` | Kiln Tilt *inv.* | type-tilt | — | held: Kiln forms weigh x2 on Forecast cards |
| `whetstone` | Whetstone *inv.* | held | 1200 | held: +1 crit stage |
| `cork-float` | Cork Float *inv.* | held | 1500 | held: once per battle, a hit from full HP leaves it at 1 HP |
| `oilskin` | Oilskin *inv.* | held | 1200 | held: halves burn, poison and trap chip damage |
| `ballast-stone` | Ballast Stone *inv.* | held | 1200 | held: +1 Defence and Sp. Defence at battle start, -1 Speed |
| `lucky-button` | Lucky Button *inv.* | held | 2000 | held: +50% buttons from a trainer battle it took part in |
| `tally-charm` | Tally Charm *inv.* | held | 1500 | held: earns 100% EXP from the bench instead of 60% |
| `isoldes-lantern` | Isolde's Lantern | keepsake | — | one sure catch (100%); one-of-a-kind; after the Relighting; confirm, cursor on No |

### Discs (reusable; disc → move)

| id | Name | Move | Price | Where |
|---|---|---|---|---|
| `disc-spore-drift` | Disc: Spore Drift | `spore-drift` | 1500 | the chip-damage disc (poison), guaranteed in Pell's stock by badge 1 |
| `disc-sandtrap` | Disc: Sandtrap | `sandtrap` | 1500 | chip (trap); Pell's rotation |
| `disc-flashover` | Disc: Flashover | `flashover` | 2500 | the "Kiln disc" (Day 10 script); coverage |
| `disc-cairn-crash` | Disc: Cairn Crash | `cairn-crash` | 2500 | coverage disc (one of three face-up at badge 4) |
| `disc-hoarfrost` | Disc: Hoarfrost | `hoarfrost` | 2500 | coverage disc (one of three face-up at badge 4) |
| `disc-drowned-bell` | Disc: Drowned Bell | `drowned-bell` | 3500 | coverage disc (one of three face-up at badge 4) |
| `disc-shardlight` | Disc: Shardlight | `shardlight` | 2000 | Pell's rotation |
| `disc-live-wire` | Disc: Live Wire | `live-wire` | 3000 | Pell's rotation |
| `disc-gale-cut` | Disc: Gale Cut | `gale-cut` | 2000 | Pell's rotation |
| `disc-stand-firm` | Disc: Stand Firm | `stand-firm` | 2000 | Dov's sealed-crate auction (first Lantern Market) or Pell's |
| `disc-gnash` | Disc: Gnash | `gnash` | — | Linnet's gift at the Shardcrown gate, win or lose; never sold |
| `disc-plumbline` | Disc: Plumbline | `plumbline` | — | badge 6 (Mirror Spire, Seraphine); never sold |

### Key items and tools (not counted in the 26)

| id | Name | Facts |
|---|---|---|
| `keepers-lantern` | Keeper's Lantern | co-op issue; the one reusable capture device; each raise burns a wick |
| `reading-glass` | Reading Glass | Isolde's old loupe: names finds, Reads creatures, opens Forecasts (Corin, minute 6) |
| `scouting-prism` | Scouting Prism | badge 3; Corin clips it to the Glass: Read adds moves, held item, Mends left |
| `weatherglass` | Weatherglass | badge 5; isle weather and Errants on the map; tool-ring socket |
| `rod` | Rod | fishing; starter kit |
| `net` | Net | bugs and bee nests; starter kit |
| `shovel` | Shovel | cracks, sparkles, the Glint; starter kit |
| `grafting-knife` | Grafting Knife | Greenhouse grafting bench |
| `string-lights` | String Lights | draw bugs and moths; tool-ring socket |
| `ration-ledger` | Ration Ledger | Hollis's pre-Summit PP and supply checklist |
| `errands-clipboard` | Errands Clipboard *inv.* | Wick's First Night Errands: six x 500 off loan 1 |
| `mail-sack` | Mail Sack | night one: carry it into the post office; Hesper's lamp lights |

### Keepsakes and heirlooms (Keepsakes pocket; one-of-a-kind)

| id | Name | Facts |
|---|---|---|
| `dorrow-kettle` | The Dorrows' Kettle | F1 heirloom; lights the Dorrow burrow porch |
| `brack-still-knot` | The Bracks' Still Knot | F4 heirloom for Tamsin (works as a Still Knot) |
| `grade-two-lantern` | Grade-Two Lantern | F6 heirloom (Warden's house) |
| `bryony-seed-tin` | Bryony's Seed Tin *inv.* | F5 heirloom; lights Bryony's porch |
| `odile-easel` | Grandmother's Easel | F9 heirloom; lights Odile's porch |
| `thessaly-almanac` | Thessaly's Almanac *inv.* | F13 heirloom; lights Thessaly's porch |
| `tully-sweatband` | Tully's Sweatband | The Mudlark Mile finale, win or lose |
| `oyster-boat-nameboard` | Oyster Boat Nameboard | Read inside Tamsin's Creelwight on Drownwood; The Oyster Boat |
| `fleet-bell` | The Fleet's Bell | dug from the Old Quay at the first spring low after K7; Barnaby moves in |

### Goods and wallet rows

| id | Name | Facts |
|---|---|---|
| `starsalt` | Starsalt | wallet `starsalt`; 800 at the Raft/Ludo, 3 a day shared; never sold back |
| `anchor-stone` | Anchor Stone | wallet `anchors`; 500 on Flux; Cairnhold granite |
| `honeycomb` | Honeycomb | 350; net a bee nest after the 1-second hum |
| `timber` | Timber | storm branches and old stumps; Ambrose buys and carves |
| `moth-silk` | Moth-silk | Ludo buys/sells |
| `fruit-seedling` | Fruit Seedling | Ludo / Lantern Market; plants a foreign fruit tree |

## 8. Regions (9) and maps (24)

| Region id | Name | Posted curve level |
|---|---|---|
| `pellwick` | Pellwick | 4 |
| `lowmoor` | Lowmoor | 6 |
| `cairnhold` | Cairnhold | 13 |
| `emberstep` | Emberstep | 19 |
| `drownwood` | Drownwood | 26 |
| `thistlewind` | Thistlewind | 33 |
| `rimeholt` | Rimeholt | 40 |
| `the-bar` | The Bar | 41 |
| `shardcrown` | Shardcrown | 47 |

| Map id | Name | Kind | Region | Size | Facts |
|---|---|---|---|---|---|
| `pellwick` | Pellwick | exterior | `pellwick` | 64×48 | hub: point, cottage, lighthouse, green, quay, river, north creek, weir, reeds (Lv2-5) |
| `lowmoor` | Lowmoor | exterior | `lowmoor` | 48×32 | isle 1; Brackenford; wild 3-8 |
| `cairnhold` | Cairnhold | exterior | `cairnhold` | 48×32 | isle 2; Knapp's End; clinic, memorial; wild 9-14 |
| `emberstep` | Emberstep | exterior | `emberstep` | 48×32 | isle 3; Sulphur Cross; wild 15-20 |
| `drownwood` | Drownwood | exterior | `drownwood` | 48×32 | isle 4; Mossgate; drowning street; wild 22-27 |
| `thistlewind` | Thistlewind | exterior | `thistlewind` | 48×32 | isle 5; Windle; the Surge; wild 29-34 |
| `rimeholt` | Rimeholt | exterior | `rimeholt` | 48×32 | isle 6; Frostwick; mirror-ice caves; wild 36-41 |
| `the-bar` | The Bar | exterior | `the-bar` | 64×24 | size proposed; point -> Shardcrown, Lantern Stack spur, wreck ribs, tide pools; wild 40-44 |
| `spire-turn` | Turn Spire | spire | `lowmoor` | 20×14 | Maud Tallis |
| `spire-ward` | Ward Spire | spire | `cairnhold` | 20×14 | Osric Penhallow |
| `spire-weather` | Weather Spire | spire | `emberstep` | 20×14 | Ines Calloway |
| `spire-hollow` | Hollow Spire | spire | `drownwood` | 20×14 | Wendel Teague |
| `spire-relay` | Relay Spire | spire | `thistlewind` | 20×14 | Ada & Ivo Halloran |
| `spire-mirror` | Mirror Spire | spire | `rimeholt` | 20×14 | Seraphine Locke; Idris in the gallery |
| `int-cottage` | Keeper's Cottage | interior | `pellwick` | 16×12 | size proposed; by tier: bedsit, cottage, commission rooms |
| `int-pells` | Pell's Sundries | interior | `pellwick` | 14×10 | size proposed; counter, back room (heirlooms) |
| `int-post-office` | Post Office | interior | `pellwick` | 12×10 | size proposed; Hesper's counter, sorting room |
| `int-archive` | Barnaby's Archive | interior | `pellwick` | 16×12 | size proposed; string wall, Field Log, Shiftlog wall; Corin's loft |
| `int-yard-shed` | Co-op Yard Shed | interior | `pellwick` | 14×10 | size proposed; Wren's ledger, tally wall, abacus |
| `int-lighthouse` | Lighthouse Stair and Lamp Room | interior | `pellwick` | 12×18 | size proposed; stair + Lamp Room (scaffold by loan tier) |
| `hollis-gate` | Hollis's Gate | summit | `shardcrown` | 20×14 | size proposed; Summit gate, Waystone, Readers' fund |
| `keepers-hall` | Keepers' Hall | summit | `shardcrown` | 20×14 | size proposed; Bastien Kell, Cass Rune; the old brazier |
| `idris-hall` | Idris's Hall | summit | `shardcrown` | 20×14 | size proposed; Champion; the Summit Bell |
| `lantern-stack` | The Lantern Stack | summit | `the-bar` | 20×16 | size proposed; Sinking Engine, the Reading, the Passenger's perch |

## 9. Waystones (7) and Spires / badges (6)

| id | Name | Map | Note |
|---|---|---|---|
| `brackenford` | Brackenford | `lowmoor` | isle 1 dock |
| `knapps-end` | Knapp's End | `cairnhold` | isle 2 dock |
| `sulphur-cross` | Sulphur Cross | `emberstep` | isle 3 dock |
| `mossgate` | Mossgate | `drownwood` | isle 4 dock |
| `windle` | Windle | `thistlewind` | isle 5 dock |
| `frostwick` | Frostwick | `rimeholt` | isle 6 dock |
| `hollis-gate` | Hollis's Gate | `hollis-gate` | Summit gate (end of the Bar) |

| Spire / badge id | Name | Isle | Leader | Theme | Ace | Badge unlock |
|---|---|---|---|---|---|---|
| `turn` | Turn Spire | `lowmoor` | `maud` | posted scripted Shifts | bilgebob Lv9 | B1: Reroll + 3 Starsalt; chip disc guaranteed in stock |
| `ward` | Ward Spire | `cairnhold` | `osric` | Wards | prismoth Lv16 | B2: Lantern-paths, free ferry, Skyglass Wicks |
| `weather` | Weather Spire | `emberstep` | `ines` | posted 3-turn weather | emberjaw Lv22 | B3: Scouting Prism, Ethers stocked |
| `hollow` | Hollow Spire | `drownwood` | `wendel` | immunities | hulkwight Lv29 | B4: Recall; one coverage disc face-up |
| `relay` | Relay Spire | `thistlewind` | `ada` | no-repeat rounds, singles | coilcrest Lv36 | B5: Weatherglass; Training Yard Commons project |
| `mirror` | Mirror Spire | `rimeholt` | `seraphine` | evasion, Mends, true odds | lumenveil Lv43 | B6: Plumbline disc; the Summit gate |

## 10. NPCs (43)

| id | Name | Species | Group | Role | Home / post · hours |
|---|---|---|---|---|---|
| `wren` | Wren Hearthwright | beaver | resident | loans, abacus, commissions; gives the Lantern; Porch Duels (Scrapling "Peg") | co-op yard 06-24 |
| `ambrose` | Ambrose Hearthwright | old beaver | resident | notches, THWAP, timber; carves a perch for your lead | yard bench 07-19 |
| `hesper` | Hesper Coil | garden snail | resident | 06:00 Keeper letter; counter 18-02 (family letters) | post office, night shift |
| `juniper` | Juniper Pell | magpie | resident | Pell's Sundries; thread Heirlooms Going Home; Porch Duels (Wirewhisk) | Pell's 08-22 |
| `ludo` | Ludo | fruit bat | resident | night buyer, Starsalt, seedlings; lights Waystones (Lantern-paths) | post-office eave 22-08 |
| `barnaby` | Barnaby Thole | hermit crab | resident | Archive, string wall, Field Log, Memory relearn; thread The Bell | Archive 09-19, flats at lows |
| `augusta` | Augusta Skerry | grey seal | resident | Harbor Warden ("Warden" means her only): Commons board, odds, dossiers; Porch Duels (Bilgebob) | Warden's house, green 06-12 |
| `ansel` | Ansel Stalk | grey heron | resident | wrote the report; fishing tells; arc The Empty Creek | beached launch, creek 17-23 |
| `wick` | Wick Dorrow | puffling | resident | calls you Keeper; arc The Water Pack (Rillfin); trainer x2; Porch Duels | cliff-stair burrow, with you at dusk |
| `tully` | Tully | wombat | resident | nicknames; thread The Mudlark Mile; Porch Duel slate (Scrapling) | his porch, laps 06-08 |
| `odile` | Odile | roseate spoonbill | resident | thread Twelve Lights; paints Shiftlogs; Porch Duels (Prismoth, after Cairnhold) | her porch, easel 14-19 |
| `bryony` | Bryony | rock hyrax | resident | thread The Fence; Sedgehare in her beans | her porch, garden 07-12 |
| `thessaly` | Thessaly | bilby | resident | template thread The Second Chapter | her porch, bench 10-16 |
| `tamsin` | Tamsin Brack | badger | resident | dark house 1 from day 3; thread The Oyster Boat; Porch Duels (Creelwight "Kettle") | dark house 1, flats at lows |
| `corin` | Corin Vale | tawny owl | resident | Read, Stance, Prism, Recall; exhibitions x3 with his Tossup | Archive loft, desk 10-16 |
| `linnet` | Linnet Rask | stoat (ermine Act III) | resident | rival next door; arc The Ember Grub; trainer x4; Porch Duels (Sootling) | her porch |
| `dimity` | Dimity | rosy maple moth | fixture | Day Page, save, dial change, Seed Card; lives in your lamp from loan 1 (no walking schedule) | your porch lamp |
| `maud` | Maud Tallis | greylag goose | leader | ferry pilot (punt); Turn Spire; teaches Reroll | her punt 05-01 / Brackenford |
| `osric` | Osric Penhallow | tortoise | leader | stonecutter; Ward Spire; cuts anchor stones | Knapp's End |
| `ines` | Ines Calloway | crested newt | leader | spa owner; Weather Spire | Sulphur Cross |
| `wendel` | Wendel Teague | grebe | leader | boatwright (Tamsin's rollers); Hollow Spire | Mossgate |
| `ada` | Ada Halloran | jackdaw | leader | windmill twin; Relay Spire (fights with Ivo as one roster) | Windle |
| `ivo` | Ivo Halloran | jackdaw | leader | windmill twin; Relay Spire | Windle |
| `seraphine` | Seraphine Locke | arctic fox | leader | cave guide; Mirror Spire; Idris's former student | Frostwick |
| `hollis` | Hollis Brandt | mountain goat | summit | ex-Mooring quartermaster; Readers' fund (Spire shares), Ration Ledger; Summit gate; no Spire, not fought | Hollis's Gate |
| `bastien` | Bastien Kell | mink | summit | Keeper; salvage diver of the lost fleet; Hollow/Brine | Keepers' Hall |
| `cass` | Cass Rune | lynx | summit | Keeper; weather and evasion | Keepers' Hall |
| `idris` | Idris Fenwake | great northern diver | summit | Champion; Vesperay anchored; anchor release | Idris's Hall |
| `merrow` | Agathe Merrow | cormorant | faction | Provost of the Mooring; the Anchorage, clinic, memorial; Engine boss | the Anchorage 07-19 |
| `varga` | Teo Varga | raccoon | faction | the Scatter; Carnival Raft, Shift fairs; forces Shifts on his own side | the Raft 12-02 (day 3+) |
| `dov` | Dov Lattimer | kinkajou | faction | Raft auctioneer; sealed-crate disc auction (first Lantern Market) | market nights |
| `pip` | Pip | water rat | isle | dock hand; night-one trainer (Wirewhisk Lv4) | the quay |
| `the-thatch` | The Thatch | finches | fixture | roofers; tie off builds at 05:40 | the eaves |
| `isolde` | Isolde Petrel | storm petrel | absent | the last keeper; author of the Keeper letters; never on screen | the Outer Isles |
| `mabry` | Mabry Coil | species per GDD-06 | absent | kept the post office when it closed; her day book is the T2/T4/T8/T13/T17 author, F17's author and F11's addressee; never on screen | — |
| `hobb-fallow` | Hobb Fallow *inv.* | brown hare | isle | Brackenford ferry-pavilion keeper; chalks the tide board | Lowmoor |
| `wynn-cobble` | Wynn Cobble *inv.* | dormouse | isle | Mooring clinic orderly: anchor stones, Still Knots, Crackdust | Cairnhold clinic |
| `quill-hartsease` | Quill Hartsease *inv.* | hedgehog | isle | keeps the memorial to the Night of Wrong Shapes | Knapp's End, Cairnhold |
| `mags-penny` | Mags Penny *inv.* | herring gull | isle | the fisher the Anchorage turns away (Act II) | Knapp's End dock, Cairnhold |
| `gorse-abernethy` | Gorse Abernethy *inv.* | marmot | isle | spa-terrace attendant | Sulphur Cross, Emberstep |
| `teal-fenner` | Teal Fenner *inv.* | water shrew | isle | stilt-town poler; Scatter volunteer at the drowning street | Mossgate, Drownwood |
| `rook-hayward` | Rook Hayward *inv.* | rook | isle | Windle miller; witness to the Surge | Windle, Thistlewind |
| `brannoch-vey` | Brannoch Vey *inv.* | ptarmigan | isle | mirror-ice cave lamp-keeper | Frostwick, Rimeholt |

Groups: *resident* = the 16 scheduled residents; *leader* = Spire leaders; *summit*; *faction*; *isle* = isle folk at fixed posts; *fixture*/*absent* = no schedule. The player (Sorrel) is not an NPC row.

## 11. Trainers (65)

Route payout = 50 × highest level; mandatory route trainers stay inside their isle's day wild band, optional ones inside its night band (+2), and none fields a Ward before Cairnhold. *Team* = size: level range. Porch Duel rosters scale to the party median.

| id | Name | Class | Map | Ace | Ace Lv | Team | Note |
|---|---|---|---|---|---|---|---|
| `lowmoor-osier` | Osier *inv.* | Reed Cutter | `lowmoor` | `reedkit` | 6 | 2: Lv5-6 |  |
| `lowmoor-dunlin` | Dunlin *inv.* | Mudlarker | `lowmoor` | `mudfist` | 7 | 2: Lv6-7 |  |
| `lowmoor-colm` | Colm *inv.* | Ferry Hand | `lowmoor` | `puddlepip` | 7 | 2: Lv6-7 | optional (declinable) |
| `lowmoor-perrin` | Perrin *inv.* | Marsh Walker | `lowmoor` | `sloshkin` | 8 | 2: Lv7-8 |  |
| `lowmoor-tibby` | Tibby *inv.* | Pavilion Regular | `lowmoor` | `wirewhisk` | 7 | 3: Lv7 | optional |
| `cairnhold-ruddock` | Ruddock *inv.* | Quarryman | `cairnhold` | `knuckleback` | 12 | 2: Lv11-12 |  |
| `cairnhold-prudence` | Prudence *inv.* | Mooring Clerk | `cairnhold` | `chillnub` | 12 | 2: Lv11-12 | first mandatory Ward (Stillcoat); Crackdust stocked first |
| `cairnhold-jory` | Jory *inv.* | Stonecutter | `cairnhold` | `siltback` | 13 | 3: Lv11-13 |  |
| `cairnhold-ellery` | Ellery *inv.* | Lamp Pilgrim | `cairnhold` | `mothling` | 13 | 2: Lv12-13 | optional |
| `cairnhold-bette` | Bette *inv.* | Quarry Forewoman | `cairnhold` | `prismoth` | 15 | 3: Lv13-15 | optional; Ward (Glasshide) |
| `emberstep-asha` | Asha *inv.* | Spa Bather | `emberstep` | `rayling` | 18 | 2: Lv17-18 |  |
| `emberstep-kip` | Kip *inv.* | Ash Shoveller | `emberstep` | `sootling` | 18 | 3: Lv16-18 |  |
| `emberstep-roswitha` | Roswitha *inv.* | Cliff Climber | `emberstep` | `sedgehare` | 19 | 2: Lv18-19 | optional |
| `emberstep-tobiah` | Tobiah *inv.* | Steam Fitter | `emberstep` | `emberjaw` | 20 | 3: Lv18-20 |  |
| `emberstep-marl` | Marl *inv.* | Scatter Volunteer | `emberstep` | `skeinwing` | 21 | 3: Lv19-21 | optional; forces a posted Shift on his own side |
| `drownwood-wenna` | Wenna *inv.* | Stilt Fisher | `drownwood` | `rushling` | 25 | 3: Lv24-25 |  |
| `drownwood-gil` | Gil *inv.* | Mangrove Poler | `drownwood` | `rustcreel` | 26 | 3: Lv24-26 |  |
| `drownwood-hettie` | Hettie *inv.* | Scatter Rescuer | `drownwood` | `brinelance` | 27 | 3: Lv25-27 | pays 1,350 (Day 10 check) |
| `drownwood-abner` | Abner *inv.* | Mooring Warden | `drownwood` | `creelwight` | 27 | 3: Lv25-27 |  |
| `drownwood-sorcha` | Sorcha *inv.* | Lamp Diver | `drownwood` | `duskwisp` | 28 | 3: Lv26-28 | optional |
| `thistlewind-ned` | Ned *inv.* | Millhand | `thistlewind` | `skirl` | 31 | 3: Lv30-31 |  |
| `thistlewind-lark` | Lark *inv.* | Kite Flyer | `thistlewind` | `gillwick` | 32 | 3: Lv30-32 |  |
| `thistlewind-cuthbert` | Cuthbert *inv.* | Moor Shepherd | `thistlewind` | `cragmitt` | 33 | 3: Lv31-33 |  |
| `thistlewind-maisie` | Maisie *inv.* | Sail Mender | `thistlewind` | `duskowl` | 34 | 4: Lv31-34 | optional |
| `thistlewind-gideon` | Gideon *inv.* | Surge Witness | `thistlewind` | `bogmonarch` | 35 | 4: Lv32-35 | optional |
| `rimeholt-hild` | Hild *inv.* | Ice Cutter | `rimeholt` | `rimeplate` | 38 | 3: Lv37-38 |  |
| `rimeholt-oskar` | Oskar *inv.* | Cave Lamp-bearer | `rimeholt` | `floeback` | 39 | 3: Lv37-39 |  |
| `rimeholt-greer` | Greer *inv.* | Glacier Guide | `rimeholt` | `strandrunner` | 40 | 4: Lv38-40 |  |
| `rimeholt-sunniva` | Sunniva *inv.* | Mirror Polisher | `rimeholt` | `lumenveil` | 41 | 4: Lv38-41 | optional; Ward (Mirrorveil) preview |
| `rimeholt-aldous` | Aldous *inv.* | Frost Hermit | `rimeholt` | `caldermaw` | 42 | 4: Lv39-42 | optional |
| `pip` | Pip | Dock Hand | `pellwick` | `wirewhisk` | 4 | 1: Lv4 | night one, 21:30; pays 200 |
| `maud-spire` | Maud Tallis | Spire Leader | `spire-turn` | `bilgebob` | 9 | 2: Lv8-9 | two posted scripted Shifts; 1,800 + 3 Starsalt |
| `osric-spire` | Osric Penhallow | Spire Leader | `spire-ward` | `prismoth` | 16 | 3: Lv14-16 | Ward sentinels; 3,200 |
| `ines-spire` | Ines Calloway | Spire Leader | `spire-weather` | `emberjaw` | 22 | 3: Lv20-22 | posted 3-turn weather; 4,400 |
| `wendel-spire` | Wendel Teague | Spire Leader | `spire-hollow` | `hulkwight` | 29 | 3: Lv27-29 | Hollow, immune to Plain and Grit; 5,800 |
| `hallorans-spire` | Ada & Ivo Halloran | Spire Leaders | `spire-relay` | `coilcrest` | 36 | 6: Lv33-36 | no-repeat rounds, singles; 7,200 |
| `seraphine-spire` | Seraphine Locke | Spire Leader | `spire-mirror` | `lumenveil` | 43 | 4: Lv40-43 | evasion + Mends; 8,600 |
| `bar-corwen` | Corwen *inv.* | Wreck Diver | `the-bar` | `hulkwight` | 41 | 4: Lv40-41 | Long Road 1 |
| `bar-tilda` | Tilda *inv.* | Tide-pool Warden | `the-bar` | `strandrunner` | 41 | 4: Lv40-41 | Long Road 2 |
| `bar-ezra` | Ezra *inv.* | Ex-Mooring Quartermaster | `the-bar` | `cairnward` | 42 | 4: Lv41-42 | Long Road 3; Ward |
| `bar-ottilie` | Ottilie *inv.* | Brazier Pilgrim | `the-bar` | `lumenveil` | 43 | 5: Lv41-43 | Long Road 4 |
| `bar-hamish` | Hamish *inv.* | Bar Pilot | `the-bar` | `brinelance` | 43 | 5: Lv42-43 | Long Road 5 |
| `bar-delphine` | Delphine *inv.* | Readers' Fund Scholar | `the-bar` | `cragmitt` | 44 | 5: Lv42-44 | Long Road 6 |
| `bastien-keeper` | Bastien Kell | Summit Keeper | `keepers-hall` | `hulkwight` | 46 | 5: Lv43-46 | Hollow/Brine; healing items (Prism shows heals); cut-order 6 removes him |
| `cass-keeper` | Cass Rune | Summit Keeper | `keepers-hall` | `skeinwing` | 48 | 5: Lv45-48 | weather feeding evasion (cap +2) |
| `idris-champion` | Idris Fenwake | Champion | `idris-hall` | `vesperay` | 50 | 6: Lv46-50 | anchored team: a Ward, a Hollow, a weather setter, a fast hitter; 10,000 + Summit seal |
| `linnet-dock` | Linnet Rask | Rival | `pellwick` | `caldermaw` | 5 | 1: Lv5 | story: Sootling Shifts Up 100% to Caldermaw on the posted strip; hold three turns; any result |
| `linnet-brackenford` | Linnet Rask | Rival | `lowmoor` | `caldermaw` | 11 | 3: Lv6-11 | after badge 1 (Declines before); one-carry team; First Steps |
| `linnet-rimeholt` | Linnet Rask | Rival | `rimeholt` | `sootling` | 39 | 6: Lv36-39 | returns in ermine with a balanced six; story, any result |
| `linnet-gate` | Linnet Rask | Rival | `the-bar` | `sootling` | 46 | 6: Lv42-46 | Shardcrown gate after badge 6; ace is her Sootling line (form per GDD-04); Gnash disc win or lose |
| `wick-cairnhold` | Wick Dorrow | Friend | `cairnhold` | `rillfin` | 12 | 1: Lv12 | one fragile creature + support moves; story, any result |
| `wick-long-road` | Wick Dorrow | Friend | `the-bar` | `strandrunner` | 43 | 3: Lv41-43 | halfway on the Long Road; Gillwick runs a posted scripted Shift to Strandrunner |
| `merrow-engine` | Agathe Merrow | Provost | `lantern-stack` | `cairnward` | 38 | 4: Lv35-38 | Sinking Engine; anchored team, Anchor Pulse; story, any result |
| `varga-drownwood` | Teo Varga | Scatter Organizer | `drownwood` | `bogmonarch` | 28 | 4: Lv25-28 | forces posted Shifts on his own side (some land Down); story, any result |
| `corin-exhibition-1` | Corin Vale | Mentor | `lowmoor` | `tossup` | 8 | 2: Lv6-8 | optional exhibition, Act I; Tossup runs one posted Shift; nothing lost |
| `corin-exhibition-2` | Corin Vale | Mentor | `emberstep` | `tossup` | 20 | 3: Lv17-20 | optional exhibition, Act II |
| `corin-exhibition-3` | Corin Vale | Mentor | `thistlewind` | `tossup` | 34 | 4: Lv30-34 | optional exhibition, Act III |
| `porch-wren` | Wren Hearthwright | Porch Duel | `pellwick` | `scrapling` | scaled | party median | "Peg"; scaled to party median; 30 x curve |
| `porch-tully` | Tully | Porch Duel | `pellwick` | `scrapling` | scaled | party median | scaled |
| `porch-juniper` | Juniper Pell | Porch Duel | `pellwick` | `wirewhisk` | scaled | party median | scaled |
| `porch-odile` | Odile | Porch Duel | `pellwick` | `prismoth` | scaled | party median | scaled; offered only after reaching Cairnhold (Ward rule) |
| `porch-tamsin` | Tamsin Brack | Porch Duel | `pellwick` | `creelwight` | scaled | party median | "Kettle"; from day 3 |
| `porch-wick` | Wick Dorrow | Porch Duel | `pellwick` | `gillwick` | scaled | party median | Rillfin until the water-pack Shift |
| `porch-augusta` | Augusta Skerry | Porch Duel | `pellwick` | `bilgebob` | scaled | party median | scaled |
| `porch-linnet` | Linnet Rask | Porch Duel | `pellwick` | `sootling` | scaled | party median | not while her porch is dark (fall -> return) |

## 12. Letters (58)

**Author ids** (the `author` field): Isolde Petrel / I. Petrel → `isolde`; Mabry Coil → `mabry`; Merrow's ward log → `merrow`; Ansel's report → `ansel`; every other author (harbor notices, the harbor office, the anonymous F senders) is display text only, `author: null` plus a `byline` string.

K = Keeper (Isolde to "the Keeper", one each 06:00, K1 day 2 … K20 day 21). F = family (Hesper's counter from 18:00, day 2 onward; carried to a door; a lit porch returns the heirloom; F1/F5/F9/F13 also return a creature). T = town (unlocked when its find is pinned on the string wall). E = event. The `relicId` of each T letter is its find id.

| id | Stream | Author | Channel | When / links | Subject |
|---|---|---|---|---|---|
| `k1` | Keeper | Isolde Petrel | 06:00 mailbox | day 2 | The light is fine; the river is wrong: the oil boat touched the bar (canon text). |
| `k2` | Keeper | Isolde Petrel | 06:00 mailbox | day 3 | The mill weir, two generations old, the Stalk family's; young harbormaster Stalk "writes a good report and reads a poor drawing" (canon). |
| `k3` | Keeper | Isolde Petrel | 06:00 mailbox | day 4 | The sea hums; a wanderer on a thirty-year road; two logs, two clocks (canon). |
| `k4` | Keeper | Isolde Petrel | 06:00 mailbox | day 5 | The glow on the Siltback's brow, the first Heartmark; she can see which way it leans (canon). |
| `k5` | Keeper | Isolde Petrel | 06:00 mailbox | day 6 | Merrow's ward and her broth; the marks spreading through the harbor's creatures. |
| `k6` | Keeper | Isolde Petrel | 06:00 mailbox | day 7 | Oil for nine nights; lamp or wheel (canon). |
| `k7` | Keeper | Isolde Petrel | 06:00 mailbox | day 8 | The fleet's bell on the Old Quay "goes with the quay if the bar takes it" (unlocks the bell dig at a spring low). |
| `k8` | Keeper | Isolde Petrel | 06:00 mailbox | day 9 | The storm night: the comet at the wheel, the Siltback Shifted, the lamp ran dry (canon). |
| `k9` | Keeper | Isolde Petrel | 06:00 mailbox | day 10 | The morning after: the bar, the lost fleet, the report that named her (with thread beat 4: Ansel's confession). |
| `k10` | Keeper | Isolde Petrel | 06:00 mailbox | day 11 | "A read Shift is a Shift survived." She leaves to learn to read on the Isles (canon; Merrow halts the Engine on it). |
| `k11` | Keeper | Isolde Petrel | 06:00 mailbox | day 12 | Shardcrown's brazier and the Keepers who tended it through the dark years. |
| `k12` | Keeper | Isolde Petrel | 06:00 mailbox | day 13 | "Light calls the change" answered: light lets you read the change; the lantern left on Juniper's counter "for whoever comes". |
| `k13` | Keeper | Isolde Petrel | 06:00 mailbox | day 14 | Learning to read on the Outer Isles: the first deliberate Forecast. |
| `k14` | Keeper | Isolde Petrel | 06:00 mailbox | day 15 | Forgiving Ansel's report: "He wrote what he could see." |
| `k15` | Keeper | Isolde Petrel | 06:00 mailbox | day 16 | Teaching a boy with failing eyes (Corin) to read the lean. |
| `k16` | Keeper | Isolde Petrel | 06:00 mailbox | day 17 | The Passenger: what rides the comet, and why it drinks light. |
| `k17` | Keeper | Isolde Petrel | 06:00 mailbox | day 18 | The Heartshard and the hum as a tide, not a storm. |
| `k18` | Keeper | Isolde Petrel | 06:00 mailbox | day 19 | Anchor and Reroll: why the Mooring and the Scatter are both half right. |
| `k19` | Keeper | Isolde Petrel | 06:00 mailbox | day 20 | Thirty years on the road: the comet's return, counted. |
| `k20` | Keeper | Isolde Petrel | 06:00 mailbox | day 21 | To the next keeper: keep the wick trimmed. |
| `f1` | Family | Isolde Petrel | 18:00 Hesper's counter -> carry to door | day 2; door porch-dorrow; heirloom dorrow-kettle; creature bilgebob | To the Dorrows: Maren's Bilgebob towed the oil boat off the bar twice (canon text). |
| `f2` | Family | Isolde Petrel | 18:00 Hesper's counter -> carry to door | day 3; door porch-coop-yard | To Ambrose: thanks for the alder floor in the Lamp Room. |
| `f3` | Family | Bosun of the lost fleet | 18:00 Hesper's counter -> carry to door | day 4; door porch-pells | An IOU for the winter's flour, kept on Pell's slate (Juniper's reveal begins). |
| `f4` | Family | Isolde Petrel | 18:00 Hesper's counter -> carry to door | day 5; door porch-dark-1; heirloom brack-still-knot | To the Bracks: the oyster boat's creel creature and a knot for it (held at the counter until Tamsin moves in). |
| `f5` | Family | A Lowmoor bean-grower | 18:00 Hesper's counter -> carry to door | day 6; door porch-bryony; heirloom bryony-seed-tin; creature puddlepip | Seed for a low fence, sent with a puddle-pup that would not leave. |
| `f6` | Family | Isolde Petrel | 18:00 Hesper's counter -> carry to door | day 7; door porch-wardens-house; heirloom grade-two-lantern | To the old Warden: storm odds, and a lantern on loan. |
| `f7` | Family | A deckhand of the lost fleet | 18:00 Hesper's counter -> carry to door | day 8; door porch-tully | Home to a slow kid who swore he was fast. |
| `f8` | Family | The harbor office | 18:00 Hesper's counter -> carry to door | day 9; door porch-archive | Weir records requested, never sent. |
| `f9` | Family | Odile's grandmother | 18:00 Hesper's counter -> carry to door | day 10; door porch-odile; heirloom odile-easel; creature mothling | The easel and the light she could not paint. |
| `f10` | Family | A towrope maker | 18:00 Hesper's counter -> carry to door | day 11; door porch-linnet | To the Rasks: a rope that held and a creature that did not. |
| `f11` | Family | Isolde Petrel | 18:00 Hesper's counter -> carry to door | day 12; door porch-post-office | To Mabry Coil: keep my letters until someone lights the lamp. |
| `f12` | Family | Ansel's grandfather | 18:00 Hesper's counter -> carry to door | day 13; door porch-coop-yard | An order for weir timber, cancelled (Wren reads it twice). |
| `f13` | Family | A Thistlewind almanac-keeper | 18:00 Hesper's counter -> carry to door | day 14; door porch-thessaly; heirloom thessaly-almanac; creature wirewhisk | An almanac with the comet's year circled, and a whisker-spark that hums. |
| `f14` | Family | Isolde Petrel | 18:00 Hesper's counter -> carry to door | day 15; door porch-pells | To Juniper's grandmother: the lantern will be on your counter. |
| `f15` | Family | A Cairnhold quarry family | 18:00 Hesper's counter -> carry to door | day 16; door porch-wardens-house | Thanks for the warning that came too late. |
| `f16` | Family | Isolde Petrel | 18:00 Hesper's counter -> carry to door | day 17; door porch-dorrow | To the small Dorrow: the light is on because of a whale. |
| `f17` | Family | Mabry Coil | 18:00 Hesper's counter -> carry to door | day 18; door porch-post-office | Day-book page: the sack sealed, the office closed. |
| `f18` | Family | Isolde Petrel | 18:00 Hesper's counter -> carry to door | day 19; door porch-keepers-cottage | To whoever lives in the cottage now: the stove smokes; open the flue first. |
| `t1` | Town | Harbor notice | string wall (find pinned); morning post from day 22 if still locked | find ammonite | Bar soundings, the spring before: the channel shoaling. |
| `t2` | Town | Mabry Coil (day book) | string wall (find pinned); morning post from day 22 if still locked | find belemnite | The oil boat turned back; the keeper's letters went out. |
| `t3` | Town | Harbor notice | string wall (find pinned); morning post from day 22 if still locked | find crinoid-stem | Weir inspection deferred "until the mill is sold". |
| `t4` | Town | Mabry Coil (day book) | string wall (find pinned); morning post from day 22 if still locked | find fossil-fern | The keeper posts a drawing to the harbor office. |
| `t5` | Town | Merrow's ward log | string wall (find pinned); morning post from day 22 if still locked | find urchin-cast | Broth up the lighthouse stair; the keeper does not sleep. |
| `t6` | Town | Merrow's ward log | string wall (find pinned); morning post from day 22 if still locked | find old-shape-skull | Creatures born before the hum carry no mark. |
| `t7` | Town | Harbor notice | string wall (find pinned); morning post from day 22 if still locked | find brass-tide-gauge | Notice to mariners: the light will burn nine more nights. |
| `t8` | Town | Mabry Coil (day book) | string wall (find pinned); morning post from day 22 if still locked | find postmark-die | The last sack; the post office closes. |
| `t9` | Town | Harbor notice | string wall (find pinned); morning post from day 22 if still locked | find fleet-tally-token | Roll of the lost fleet. |
| `t10` | Town | Merrow's ward log | string wall (find pinned); morning post from day 22 if still locked | find skyglass-shard | The Night of Wrong Shapes, hour by hour. |
| `t11` | Town | Ansel's report (I) | string wall (find pinned); morning post from day 22 if still locked | find skyglass-bead | Report on the grounding of the fleet. |
| `t12` | Town | Merrow's ward log | string wall (find pinned); morning post from day 22 if still locked | find skyglass-knot | Founding the Mooring: light calls the change. |
| `t13` | Town | Mabry Coil (day book) | string wall (find pinned); morning post from day 22 if still locked | find cockle | Children wading home across the flats. |
| `t14` | Town | Ansel's report (II) | string wall (find pinned); morning post from day 22 if still locked | find razor-shell | Finding: the light was out at midnight. |
| `t15` | Town | Harbor notice | string wall (find pinned); morning post from day 22 if still locked | find sea-glass | Ferry service suspended indefinitely. |
| `t16` | Town | Ansel's report (III) | string wall (find pinned); morning post from day 22 if still locked | find cuttlebone | Recommendation: the keeper be relieved. |
| `t17` | Town | Mabry Coil (day book) | string wall (find pinned); morning post from day 22 if still locked | find mermaids-purse | Letters to the Outer Isles returned, no forwarding. |
| `t18` | Town | Ansel's report (addendum, unsent) | string wall (find pinned); morning post from day 22 if still locked | find whelk-shell | The weir. He did see the drawing, later. |
| `e1` | Event | Isolde Petrel | event: with Isolde's Lantern at the Relighting (canon text) |  | The Lantern letter |
| `e2` | Event | I. Petrel | event: post-credits, postmarked the Outer Isles (canon text) |  | "I saw the light." |

## 13. Threads, arcs and the template (10)

| id | Title | NPC | Kind | Beats | Facts |
|---|---|---|---|---|---|
| `mudlark-mile` | The Mudlark Mile | `tully` | life | 5 | grey mullet; loses to Tamsin; porch confession; race at a spring low; sweatband |
| `twelve-lights` | Twelve Lights | `odile` | life | 5 | eleven porch canvases + your starter's Shiftlog; twelfth is the beam after the Relighting |
| `oyster-boat` | The Oyster Boat | `tamsin` | life | 5 | nameboard inside "Kettle"; Wendel's rollers; sails in the coda |
| `the-fence` | The Fence | `bryony` | life | 4 | broker or side; Ambrose cuts lower posts; the Sedgehare chooses you |
| `heirlooms-going-home` | Heirlooms Going Home | `juniper` | life | 6 | family letters return heirlooms; the credit reveal; Isolde's Lantern last |
| `the-bell` | The Bell | `barnaby` | life | 4 | K7 + first spring low; "Exhibit 1: My Old House"; the last string |
| `ember-grub` | The Ember Grub | `linnet` | arc | 5 | dock, rematch, the fall, Rimeholt return, the gate |
| `water-pack` | The Water Pack | `wick` | arc | 4 | Rillfin Shifts to a gill-breather; the pack; carries the flame |
| `empty-creek` | The Empty Creek | `ansel` | arc | 5 | the tells; confession at K9 + beat 4; the weir wheel in the coda |
| `second-chapter` | The Second Chapter *inv.* | `thessaly` | template | 3 | the 3-beat template thread (cut-order 5) |

## 14. Collections

### Fish (18)

| id | Name | Where | When | Shadow | Note |
|---|---|---|---|---|---|
| `perch` | Perch | river mouth | any | small | cheapest (80); night one's first catch under Ansel |
| `grey-mullet` | Grey Mullet | quay | day | medium | Tully asks for one for luck |
| `dab` | Dab *inv.* | flats channels | day, low tide | small |  |
| `herring` | Herring *inv.* | quay shoals | any; fog pulls schools in | small | silver school |
| `mackerel` | Mackerel *inv.* | quay shoals | day, high tide | small |  |
| `sand-eel` | Sand Eel *inv.* | flats | low tide | small |  |
| `stickleback` | Stickleback *inv.* | river | day | small |  |
| `brown-trout` | Brown Trout *inv.* | river | day | medium |  |
| `grayling` | Grayling *inv.* | north creek | any | medium | only after the weir turns (coda) |
| `sea-trout` | Sea Trout *inv.* | north creek / river | dusk | medium | creek returns after the weir turns |
| `silver-eel` | Silver Eel *inv.* | river | night | medium |  |
| `pollack` | Pollack *inv.* | quay / isle reaches | any | medium |  |
| `red-gurnard` | Red Gurnard *inv.* | quay | any | medium | tell: it croaks |
| `lumpsucker` | Lumpsucker *inv.* | Old Quay | spring low | medium |  |
| `sea-bass` | Sea Bass | quay / point | dusk | large | ~900 |
| `glimmer-sprat` | Glimmer Sprat *inv.* | point flats / lagoon reaches | night low | small | skyglass-lit shoal |
| `john-dory` | John Dory | quay (night sea) | night | forked-tail | 2,400; night headliner |
| `lantern-wolffish` | Lantern Wolffish | quay (night sea) | night | forked-tail | 4,200; night headliner |

### Bugs (10; cut-order 8 keeps the first six)

| id | Name | Where | When | Note |
|---|---|---|---|---|
| `tiger-moth` | Tiger Moth *inv.* | lit porches | night | moth at lamps |
| `ermine-moth` | Ermine Moth *inv.* | lit porches, string lights | night |  |
| `hawk-moth` | Hawk-moth *inv.* | string lights, orchard | dusk |  |
| `glow-worm` | Glow-worm *inv.* | reed edges, point | night |  |
| `sandhopper` | Sandhopper *inv.* | flats wrack line | low tide |  |
| `starfly` | Starfly *inv.* | near skyglass, glowing flats | night low | hums faintly |
| `red-admiral` | Red Admiral *inv.* | orchard, green | day | cut-order 8 candidate |
| `dor-beetle` | Dor Beetle *inv.* | lanes, green | dusk | cut-order 8 candidate |
| `damselfly` | Damselfly *inv.* | river, north creek | day | cut-order 8 candidate |
| `bush-cricket` | Bush-cricket *inv.* | hedges, beans | rain | cut-order 8 candidate |

### Finds (18)

| id | Name | Kind | Town letter | Note |
|---|---|---|---|---|
| `ammonite` | Ammonite | fossil | `t1` |  |
| `belemnite` | Belemnite *inv.* | fossil | `t2` |  |
| `crinoid-stem` | Crinoid Stem *inv.* | fossil | `t3` |  |
| `fossil-fern` | Fossil Fern *inv.* | fossil | `t4` |  |
| `urchin-cast` | Urchin Cast *inv.* | fossil | `t5` |  |
| `old-shape-skull` | Old-Shape Skull *inv.* | fossil | `t6` | pre-Starfall creature; no Heartmark |
| `brass-tide-gauge` | Brass Tide Gauge *inv.* | relic | `t7` | Day 10 script: a relic find unlocks T7 |
| `postmark-die` | Postmark Die *inv.* | relic | `t8` | the old post office's stamp |
| `fleet-tally-token` | Fleet Tally Token *inv.* | relic | `t9` | a lost-fleet berth token |
| `skyglass-shard` | Skyglass Shard | skyglass | `t10` | night low only; 900 to Barnaby or 1 Starsalt at the Raft |
| `skyglass-bead` | Skyglass Bead *inv.* | skyglass | `t11` | night low only |
| `skyglass-knot` | Skyglass Knot *inv.* | skyglass | `t12` | night low only; twisted glass |
| `cockle` | Cockle | shore | `t13` | sparkles; cut-order 8 removes shore finds |
| `razor-shell` | Razor Shell *inv.* | shore | `t14` |  |
| `sea-glass` | Sea Glass *inv.* | shore | `t15` | not skyglass; Loupe says so |
| `cuttlebone` | Cuttlebone *inv.* | shore | `t16` |  |
| `mermaids-purse` | Mermaid's Purse *inv.* | shore | `t17` | egg case |
| `whelk-shell` | Whelk Shell *inv.* | shore | `t18` |  |

### Fruit (9)

| id | Name | Kind | Price |
|---|---|---|---|
| `pear` | Pear | native | 120 / ripe 150 |
| `plum` | Plum | native | 120 / ripe 150 |
| `apple` | Apple | native | 120 / ripe 150 |
| `cherry` | Cherry | native | 120 / ripe 150 |
| `quince` | Quince | native | 120 / ripe 150 |
| `peach` | Peach | foreign | 480 / ripe 600; graft or seedling |
| `fig` | Fig | foreign | 480 / ripe 600 |
| `apricot` | Apricot | foreign | 480 / ripe 600 |
| `mulberry` | Mulberry | foreign | 480 / ripe 600 |

## 15. Town tables

### Room commissions (6; pick 4 at loans 3–6)

| id | Name | Effect |
|---|---|---|
| `training-yard` | Training Yard | 3 stored creatures earn 25% of party EXP; Tully trains there |
| `workshop` | Workshop | fossil cleaning (+40%); polish a skyglass relic into a type tilt |
| `greenhouse` | Greenhouse | grafting bench; +1 Bond once with favourite fruit |
| `cellar` | Cellar | storage 20 -> 40; satchel +10; Keepsakes safe |
| `porch-loft` | Porch & Loft | second porch seat; Porch Duels hosted at home; telescope shows Errants |
| `gallery` | Gallery | tally wall, Odile's canvases; Shiftlog strip +1 Bond once; 1,000 per 6 Held forms framed |

### Commons projects (6)

| id | Name | Cost | Effect |
|---|---|---|---|
| `dark-house-1` | Dark House 1 | 3000 | Tamsin arrives |
| `quay-lamps` | Quay Lamps | 4000 | +1 night shoal |
| `mudlark-mile-flags` | Mudlark Mile Flags | 5000 | race course flags |
| `north-creek-footbridge` | North Creek Footbridge | 6000 |  |
| `training-yard-green` | Training Yard on the Green | 10000 | from badge 5 |
| `third-stall` | Lantern Market Third Stall | 12000 |  |

### Loans (7)

| id | Amount | Builds |
|---|---|---|
| `tier-1` | 6000 | porch lamp lit at payment (Dimity); bedsit roof |
| `tier-2` | 15000 | the cottage |
| `tier-3` | 25000 | commission 1 |
| `tier-4` | 36000 | commission 2 |
| `tier-5` | 50000 | commission 3 |
| `tier-6` | 66000 | commission 4; Wren offers the Lamp Room |
| `tier-7` | 80000 | the Lamp Room; the Relighting next dusk |

### Shops and counters (8)

| id | Name | Keeper | Hours | Stock |
|---|---|---|---|---|
| `pells-sundries` | Pell's Sundries | `juniper` | 08-22 | staples never randomized, two discs a day, Wanted Today, back room |
| `ludo-eave` | Ludo's Eave | `ludo` | 22-08 | buys anything at full price; Starsalt (3/day shared), seedlings, moth-silk |
| `carnival-raft` | The Carnival Raft | `varga` | 12-02 from day 3 | Starsalt, relic refining, Shift fairs |
| `the-anchorage` | The Anchorage | `merrow` | 07-19 | anchor stones, Still Knots |
| `cairnhold-clinic` | Cairnhold Clinic | `wynn-cobble` | day | anchor stones, Crackdust |
| `lantern-market` | Lantern Market | `dov` | Saturdays 20-02 | Varga's stall, Ludo's seedlings, string lights; day 7 auction |
| `archive-desk` | Archive Desk | `barnaby` | 09-19 | buy-only: duplicate finds, skyglass relic 900 |
| `consignment-crate` | Consignment Crate | `wren` | overnight | buy-only at your gate: 90% of value |

### Festivals (4)

| id | Name | When |
|---|---|---|
| `lantern-market` | Lantern Market | Saturdays 20:00-02:00; day 7: Dov's auction, Shift fair, Linnet's fall (first market on/after badge 2) |
| `mudlark-mile` | Mudlark Mile | Tully's race at a spring low; thread climax |
| `long-night` | The Long Night | the Relighting |
| `late-delivery-party` | The Late Delivery Party | the day the 56th letter arrives |

### Porches (20)

| id | House | Lights |
|---|---|---|
| `porch-coop-yard` | Co-op yard house | lit at arrival |
| `porch-pells` | Pell's Sundries | lit at arrival |
| `porch-post-office` | Post office | lit at arrival |
| `porch-archive` | Barnaby's Archive | lit at arrival |
| `porch-wardens-house` | Warden's house | lit at arrival |
| `porch-tully` | Tully's | lit at arrival |
| `porch-linnet` | Linnet's | lit at arrival (dark from her fall to her return) |
| `porch-keepers-cottage` | Keeper's Cottage | loan 1 |
| `porch-dorrow` | The Dorrows' burrow | F1 heirloom |
| `porch-odile` | Odile's | F9 heirloom |
| `porch-bryony` | Bryony's | F5 heirloom |
| `porch-thessaly` | Thessaly's | F13 heirloom |
| `porch-dark-1` | Dark house 1 | Commons project (Tamsin) |
| `porch-dark-2` | Dark house 2 | one per night after the Relighting |
| `porch-dark-3` | Dark house 3 | one per night after the Relighting |
| `porch-dark-4` | Dark house 4 | one per night after the Relighting |
| `porch-dark-5` | Dark house 5 | one per night after the Relighting |
| `porch-dark-6` | Dark house 6 | one per night after the Relighting |
| `porch-dark-7` | Dark house 7 | one per night after the Relighting |
| `porch-dark-8` | Dark house 8 | one per night after the Relighting |

### Furniture (24), clothes (12), roof colours (8)

| Furniture id | Name | Survives cut 24→12 |
|---|---|---|
| `driftwood-bench` | Driftwood Bench *inv.* | yes |
| `net-hammock` | Net Hammock *inv.* | yes |
| `sea-chest` | Sea Chest *inv.* | yes |
| `chart-table` | Chart Table *inv.* | yes |
| `barometer-clock` | Barometer Clock *inv.* | yes |
| `rag-rug` | Rag Rug *inv.* | yes |
| `creel-stool` | Creel Stool *inv.* | yes |
| `bottle-shelf` | Bottle Shelf *inv.* | yes |
| `brass-bedstead` | Brass Bedstead *inv.* | yes |
| `rocking-chair` | Rocking Chair *inv.* | yes |
| `pot-belly-stove` | Pot-belly Stove *inv.* | yes |
| `fern-planter` | Fern Planter *inv.* | yes |
| `oar-rack` | Oar Rack *inv.* | — |
| `figurehead` | Figurehead *inv.* | — |
| `buoy-lamp` | Buoy Lamp *inv.* | — |
| `wheel-table` | Wheel Table *inv.* | — |
| `cork-board` | Cork Board *inv.* | — |
| `tide-clock` | Tide Clock *inv.* | — |
| `nesting-basket` | Nesting Basket *inv.* | — |
| `field-guide-shelf` | Field-guide Shelf *inv.* | — |
| `map-chest` | Map Chest *inv.* | — |
| `float-chandelier` | Float Chandelier *inv.* | — |
| `patchwork-bed` | Patchwork Bed *inv.* | — |
| `lamp-room-model` | Lamp-room Model *inv.* | — |

| Clothes id | Name |
|---|---|
| `lighthouse-jumper` | Lighthouse-stripe Jumper |
| `coop-apron` | Co-op Apron |
| `oilskin-jacket` | Oilskin Jacket *inv.* |
| `sou-wester` | Sou'wester *inv.* |
| `tide-boots` | Tide Boots *inv.* |
| `cable-cardigan` | Cable Cardigan *inv.* |
| `watch-cap` | Watch Cap *inv.* |
| `wader-overalls` | Wader Overalls *inv.* |
| `ferry-scarf` | Ferry Scarf *inv.* |
| `keepers-coat` | Keeper's Coat *inv.* |
| `market-wrap` | Market Wrap *inv.* |
| `comet-brooch` | Comet Brooch *inv.* |

| Roof id | Name | Prototype key (proto/tiles ROOF_COLOURS) |
|---|---|---|
| `slate-blue` | Slate Blue | `slate` |
| `ochre` | Ochre | new |
| `harbor-red` | Harbor Red *inv.* | `red` |
| `moss` | Moss *inv.* | `moss` |
| `sea-blue` | Sea Blue *inv.* | `blue` |
| `straw` | Straw *inv.* | `straw` |
| `tar` | Tar *inv.* | `dark` |
| `heather` | Heather *inv.* | new |

`slate-blue` is the cursor default; Day 10's ochre roof is `ochre`.

### Dials, challenges, weather

| id | Name |
|---|---|
| `drift` | Drift |
| `flux` | Flux (default) |
| `freefall` | Freefall (cut-order 1) |
| `no-rewind` | No Rewind |
| `one-heart` | One Heart |
| `ride-the-dice` | Ride the Dice (only if the cut line allows) |
| `blind-read` | Blind Read (only if the cut line allows) |
| `clear` | weather: Clear |
| `overcast` | weather: Overcast |
| `rain` | weather: Rain |
| `fog` | weather: Fog |
| `storm` | weather: Storm |

### Encounter tables (17; GDD-01 may add habitats)

| id | Map | Note |
|---|---|---|
| `pellwick-reeds` | `pellwick` | the only town wilds, Lv2-5 |
| `pellwick-reach` | `pellwick` | reach hooks: Bilgebob, Creelwight, Rushling |
| `pellwick-point-night` | `pellwick` | after lit.calls: Errants 1 in 120 night encounters on the point |
| `lowmoor-land` | `lowmoor` | day/night/tide rows by cond |
| `lowmoor-water` | `lowmoor` | reaches and shallows |
| `cairnhold-land` | `cairnhold` | day/night/tide rows by cond |
| `cairnhold-water` | `cairnhold` | reaches and shallows |
| `emberstep-land` | `emberstep` | day/night/tide rows by cond |
| `emberstep-water` | `emberstep` | reaches and shallows |
| `drownwood-land` | `drownwood` | day/night/tide rows by cond |
| `drownwood-water` | `drownwood` | reaches and shallows |
| `thistlewind-land` | `thistlewind` | day/night/tide rows by cond |
| `thistlewind-water` | `thistlewind` | reaches and shallows |
| `rimeholt-land` | `rimeholt` | day/night/tide rows by cond |
| `rimeholt-water` | `rimeholt` | reaches and shallows |
| `the-bar-pools` | `the-bar` | tide pools beside the Long Road |
| `lantern-stack-perch` | `lantern-stack` | post-game: the Passenger (cut-order 4) |

## 16. Journal stamps (24)

| id | Name | Awarded |
|---|---|---|
| `someone-picked-you` | Someone Picked You | the first creature |
| `identity-crisis` | Identity Crisis | after the dock battle |
| `first-steps` | First Steps | win the Brackenford rematch |
| `into-the-light` | Into the Light *inv.* | first catch |
| `thwap` | THWAP *inv.* | first loan payment |
| `a-little-late` | A Little Late *inv.* | K1 read |
| `read-before-you-roll` | Read Before You Roll *inv.* | first Forecast resolved |
| `again-please` | Again, Please *inv.* | first Reroll |
| `not-this-time` | Not This Time *inv.* | first Anchor |
| `ward-question` | Ward ? *inv.* | first Ward Read |
| `glowing-flats` | Glowing Flats *inv.* | first skyglass relic at a night low |
| `on-the-steps` | On the Steps *inv.* | first Porch Duel |
| `home-again` | Home Again *inv.* | first heirloom returned |
| `weather-caught` | Weather Caught *inv.* | first Errant beaten or caught |
| `market-night` | Market Night *inv.* | first Lantern Market |
| `read-it-for-me` | Read It for Me *inv.* | Linnet returns |
| `wrong-shapes` | Wrong Shapes *inv.* | the Surge |
| `two-plans` | Two Plans, One Night *inv.* | the Engine night |
| `the-long-night` | The Long Night *inv.* | the Relighting |
| `the-reading` | The Reading *inv.* | Accept the Passenger's Forecast |
| `ring-off` | Ring Off *inv.* | beat Idris; the anchor release |
| `tied-off` | Tied Off *inv.* | first life thread finished |
| `late-delivery` | Late Delivery *inv.* | the 56th letter |
| `every-plate` | Every Plate *inv.* | all 42 Field Log plates Held |

Badges are wax seals (`SPIRE_IDS`), and save stamps are the Journal's save check; neither is counted here.

## 17. Story flags (50)

Flags are namespaced (`lit.`, `sp.`, `th.<thread>.`, `np.<npc>.`, `sys.`, `seen.`); lanes add their own `th.`/`np.` flags freely. These are the ones several chapters read.

| Flag | Meaning |
|---|---|
| `lit.shiftTide` | Shift Tide line: pending windows chalked a tide ahead with cards drawn |
| `lit.steadied` | Steadied dice: 5 points Down -> Side on every dial |
| `lit.keepersAnchor` | Keeper's Anchor: one free Anchor per night at home |
| `lit.fleetHome` | Fleet comes home: horn answers, dark houses 2-8 reopen nightly, Tamsin's boat floats, Maud's ring line |
| `lit.bar` | The lit Bar: walkable at any tide |
| `lit.calls` | Light calls the change: the Passenger perches; Errants visit the lit point |
| `sp.arrived` | crossed the causeway (arrival-causeway) |
| `sp.lease-signed` | lease card confirmed |
| `sp.starter-chosen` | first creature named |
| `sp.reading-glass` | Corin gave the Reading Glass |
| `sp.dock-battle` | Linnet dock battle done (any result) |
| `sp.errands-started` | Wick's clipboard taken |
| `sp.mail-sack` | mail sack carried in; Hesper's porch lit |
| `sp.capture-stance` | Corin taught Capture Stance |
| `sp.field-log` | Barnaby opened the Field Log |
| `sp.first-payment` | first THWAP |
| `sp.first-forecast` | first Forecast resolved |
| `sp.linnet-declined` | Linnet refused before badge 1 |
| `sp.reroll-taught` | Maud's practice table |
| `sp.linnet-rematch` | Brackenford rematch won |
| `sp.raft-docked` | Carnival Raft at the Old Pier (day 3) |
| `sp.tamsin-arrived` | dark house 1 open |
| `sp.act-2` | Act II open |
| `sp.memorial-seen` | Cairnhold memorial |
| `sp.first-market` | first Lantern Market |
| `sp.varga-hired` | called odds at the Shift fair |
| `sp.linnet-fell` | Caldermaw Shifted Down to Sootling; her porch dark |
| `sp.act-3` | Act III open: the comet brightens |
| `sp.drowning-street` | Drownwood drowning street + Anchor Pulse misfire |
| `sp.surge` | the Surge in Windle |
| `sp.idris-gallery` | Idris in the Mirror Spire gallery |
| `sp.linnet-returned` | Linnet back in ermine; porch relit |
| `sp.two-plans` | Two plans, one night fired |
| `sp.engine-halted` | Merrow halted the Sinking Engine (K10 or K8 handed over) |
| `sp.charges-pulled` | Linnet and Wick pulled Varga's charges |
| `sp.act-4` | Act IV open |
| `sp.lamp-room-offered` | Wren offered the Lamp Room (loan 6) |
| `sp.lamp-room-built` | Lamp Room built (loan 7 paid, overnight) |
| `sp.relighting` | the Relighting done (sets the six lit.* flags) |
| `sp.reading-done` | the Reading accepted |
| `sp.credits-seen` | credits rolled; post-game open |
| `sp.summit-open` | six badges; Hollis opened the gate |
| `sp.idris-beaten` | Champion beaten; anchor release |
| `sp.ansel-confessed` | K9 + thread beat 4 |
| `sp.bell-dug` | the fleet's bell dug out of the Old Quay |
| `sp.weir-turned` | the weir wheel turned (coda); north creek refills |
| `sp.tamsin-sailed` | the oyster boat sails |
| `sp.late-delivery` | the 56th letter arrived |
| `sp.passenger-caught` | the Passenger caught (post-game) |
| `sp.ninth-spire` | Corin and Wick asked for the ninth Spire |

## 18. Story scenes / scripts (72)

The GDD-00 §11–§12 beats, in order. Real time / game time from the first-30-minutes table where given. GDD-07 owns these scripts; other lanes reference them by id.

| Script id | Beat | When |
|---|---|---|
| `arrival-causeway` | walk in before the fade ends; foam closes the causeway; seven porches lit | 0:30 / 17:40 held |
| `wren-lease-card` | "You walked. Nobody walks." Lease card | 1:30 |
| `wren-key-lantern` | key, Lantern, 5 wicks; loan 1 explained; the clock starts | 3:30 / 17:45 |
| `starter-choice` | three creatures on the last dry stones; kneel; 100% draw-in; name; the mark lights; stamp | 4:00 / 17:50 |
| `wick-keeper` | Wick on the cliff stair: "Keeper!"; the bedsit | 5:30 / 18:05 |
| `corin-reading-glass` | the Reading Glass, 2 stones; Read your own creature | 6:00 / 18:10 |
| `linnet-dock-before` | Linnet vaults the fence; Corin reads her strip aloud (trainer linnet-dock) | 7:00 / 18:15 |
| `linnet-dock-after` | Identity Crisis (+100 EXP); Maud from her punt: "Come back stronger." | after the hold-out, any result |
| `wick-errands` | errands clipboard: six x 500 off loan 1 | 10:00 / 18:25 |
| `yard-apron` | apron at the yard; pin your notice on the Commons board | 10:30 / 18:35 |
| `tully-nickname` | Tully's nickname: accept / decline / counter | 10:30 |
| `meet-neighbors` | Odile, Bryony, Thessaly on their steps | 10:30-12:00 |
| `first-orchard` | six trees, eighteen fruit, a purse, the bee hum, a netted nest | 12:00 / 19:20 |
| `hesper-mail-sack` | carry the sack in; Hesper's lamp lights | 13:30 / 20:00 |
| `corin-capture-stance` | the reeds: wild Tossup Lv4; Capture Stance; "62%" | 14:00 / 20:10 |
| `barnaby-field-log` | Barnaby's porthole fogs over a shell: the Field Log | 15:30 / 20:30 |
| `ansel-fishing-tells` | "Forked tail, by the piling." Feint, feint, plip | 16:30 / 20:45 |
| `pip-before` | Pip the dock hand (trainer pip) | 18:00 / 21:30 |
| `ludo-first-sale` | sell to Ludo on the eave | 19:00 / 22:10 |
| `first-payment` | six beads; Ambrose: "Alder. Notch it wide."; THWAP; roof colour; loan 2 offered | 19:30 / 22:20 |
| `porchlight-on` | porchlight on; Dimity lands; Prismoth at the lamp: Read, Ward ? | 20:30 / 22:35 |
| `corin-slip` | party pip; "Tomorrow. I'll be on the stones at the low." | 22:00 / 23:30 |
| `first-glowing-flats` | the Glint, a skyglass relic, cockles; Ludo buys | 24:30 / 03:40 |
| `thatch-first-roof` | the Thatch tie off your roof (dawn build vignette) | 26:00 / 05:40 |
| `hesper-k1` | "One for you. It's... a little late." K1 | 26:30 / 06:00 |
| `corin-first-forecast` | Lowmoor stones: two wilds, Lv8, your first Forecast | 27-30 / 06:00-07:05 |
| `linnet-decline` | Linnet refuses you until badge 1 | day 2 |
| `maud-practice-table` | Reroll lesson at Brackenford | before the Turn Spire |
| `linnet-brackenford-before` | rematch (trainer linnet-brackenford) | after badge 1 |
| `linnet-brackenford-after` | First Steps |  |
| `raft-docks` | the Carnival Raft docks at the Old Pier | day 3 |
| `tamsin-arrives` | Tamsin moves into dark house 1 | Commons project |
| `act-2-open` | Act II title beat | badge 1 or day 4 dawn |
| `cairnhold-memorial` | Merrow shows the memorial to the Night of Wrong Shapes | Act II |
| `anchorage-turns-away` | the Anchorage turns away a fisher who cannot pay (Mags Penny) | Act II |
| `first-errant-sighting` | Squallcoil's lightning on the map | Emberstep |
| `first-lantern-market` | first market: string lights, Varga's stall | day 7 |
| `dov-auction` | Dov's sealed-crate disc auction | first market |
| `varga-hires-you` | call odds at the Shift fair | first market |
| `linnet-fall` | Caldermaw Shifts Down to Sootling; she refuses stone and Starsalt; leaves on Maud's ferry | first market on/after badge 2 |
| `comet-brightens` | Act II closes; Act III opens | badge 3 or loan 4 |
| `drowning-street` | Drownwood at low tide: Scatter volunteers | Act III |
| `anchor-pulse-misfire` | the Mooring's Anchor Pulse misfires | Act III |
| `the-surge` | a street in Windle Shifts in one night | first night on Thistlewind after badge 4, or day 10 dawn |
| `idris-gallery` | Idris in the Mirror Spire gallery explains the ring | Rimeholt |
| `linnet-returns` | ermine, a balanced six, Sootling on her shoulder; "Read it for me." | Rimeholt |
| `two-plans-one-night` | Merrow's Engine vs Varga's charges | next night low after badge 5 / loan 6 / loan 7 |
| `merrow-engine-before` | story battle (trainer merrow-engine) |  |
| `merrow-engine-after` | hand her K10 (or K8): "The stones stay licensed." |  |
| `charges-pulled` | Linnet and Wick pull the charges |  |
| `lamp-room-offered` | Wren offers the Lamp Room | loan 6 |
| `lamp-room-built` | the Thatch finish the Lamp Room | dawn after loan 7 |
| `the-relighting` | 17:30: Juniper brings Isolde's Lantern and the Lantern letter; the stair; the beam; the horn | dusk after loan 7 |
| `the-crossing` | the sea draws back; the shore party | Relighting night |
| `the-reading` | seven phases; Accept ends it | Relighting night |
| `credits-dawn` | credits over canvases, tally wall, porches, Seed Card (scenes/ending.js) | dawn |
| `coda-morning` | Hesper's flustered note; the coda beats | the morning after |
| `ansel-confession` | "I named her. I'd name her again with what I had." | K9 + empty-creek beat 4 |
| `ansel-weir-wheel` | Ansel turns the weir wheel | coda, if he confessed |
| `bell-dig` | dig the fleet's bell out of the Old Quay | K7 + first spring low |
| `tamsin-sails` | the oyster boat sails | coda |
| `summit-gate` | Hollis opens the gate | six badges |
| `linnet-gate-before` | Shardcrown gate (trainer linnet-gate) | after badge 6 |
| `linnet-gate-after` | the Gnash disc, win or lose |  |
| `wick-long-road-before` | halfway on the Long Road (trainer wick-long-road) |  |
| `idris-anchor-release` | the ring cracks; Vesperay Shifts for the first time; silence is an answer | after the Champion |
| `summit-bell` | the Summit Bell restarts you at whoever beat you | Summit loss (Drift/Flux) |
| `blackout-wake` | "You came home carried. I kept your place." | blackout |
| `late-delivery-party` | the party on the green | 56th letter |
| `passenger-perch` | the Passenger perched on the Lantern Stack; Isolde's Lantern asks No first | post-game |
| `dark-house-reopens` | a dark house reopens (one per night) | post-Relighting |
| `ninth-spire-ask` | Corin and Wick ask for the ninth Spire | post-game (cut-order 3) |

## 19. Invented names (188)

Every display name above marked *inv.* (plus invented map, counter and letter-author names). All are original; none is a Pokémon, Animal Crossing, Temtem or Coromon name (continuity pass renamed five route trainers that collided: Cress → Osier, Hal → Colm, Flint → Ruddock, Agnes → Prudence, Nessa → Ottilie). Real-world animal, fish, bug, fossil, fruit and clothing words are used as plain nouns.

Breaker · Flashover · Mire Bloom · Fizz · Live Wire · Floe Ram · Downdraft · Cairn Crash · Murk · Drowned Bell · Hush · Dusksight · Brine Tilt · Stone Tilt · Glass Tilt · Gust Tilt · Hollow Tilt · Kiln Tilt · Whetstone · Cork Float · Oilskin · Ballast Stone · Lucky Button · Tally Charm · Errands Clipboard · Bryony's Seed Tin · Thessaly's Almanac · Dab · Herring · Mackerel · Sand Eel · Stickleback · Brown Trout · Grayling · Sea Trout · Silver Eel · Pollack · Red Gurnard · Lumpsucker · Glimmer Sprat · Tiger Moth · Ermine Moth · Hawk-moth · Glow-worm · Sandhopper · Starfly · Red Admiral · Dor Beetle · Damselfly · Bush-cricket · Belemnite · Crinoid Stem · Fossil Fern · Urchin Cast · Old-Shape Skull · Brass Tide Gauge · Postmark Die · Fleet Tally Token · Skyglass Bead · Skyglass Knot · Razor Shell · Sea Glass · Cuttlebone · Mermaid's Purse · Whelk Shell · Peach · Fig · Apricot · Mulberry · Hobb Fallow · Wynn Cobble · Quill Hartsease · Mags Penny · Gorse Abernethy · Teal Fenner · Rook Hayward · Brannoch Vey · Reed Cutter Osier · Mudlarker Dunlin · Ferry Hand Colm · Marsh Walker Perrin · Pavilion Regular Tibby · Quarryman Ruddock · Mooring Clerk Prudence · Stonecutter Jory · Lamp Pilgrim Ellery · Quarry Forewoman Bette · Spa Bather Asha · Ash Shoveller Kip · Cliff Climber Roswitha · Steam Fitter Tobiah · Scatter Volunteer Marl · Stilt Fisher Wenna · Mangrove Poler Gil · Scatter Rescuer Hettie · Mooring Warden Abner · Lamp Diver Sorcha · Millhand Ned · Kite Flyer Lark · Moor Shepherd Cuthbert · Sail Mender Maisie · Surge Witness Gideon · Ice Cutter Hild · Cave Lamp-bearer Oskar · Glacier Guide Greer · Mirror Polisher Sunniva · Frost Hermit Aldous · Wreck Diver Corwen · Tide-pool Warden Tilda · Ex-Mooring Quartermaster Ezra · Brazier Pilgrim Ottilie · Bar Pilot Hamish · Readers' Fund Scholar Delphine · The Second Chapter · Driftwood Bench · Net Hammock · Sea Chest · Chart Table · Barometer Clock · Rag Rug · Creel Stool · Bottle Shelf · Brass Bedstead · Rocking Chair · Pot-belly Stove · Fern Planter · Oar Rack · Figurehead · Buoy Lamp · Wheel Table · Cork Board · Tide Clock · Nesting Basket · Field-guide Shelf · Map Chest · Float Chandelier · Patchwork Bed · Lamp-room Model · Oilskin Jacket · Sou'wester · Tide Boots · Cable Cardigan · Watch Cap · Wader Overalls · Ferry Scarf · Keeper's Coat · Market Wrap · Comet Brooch · Harbor Red · Moss · Sea Blue · Straw · Tar · Heather · Into the Light · THWAP · A Little Late · Read Before You Roll · Again, Please · Not This Time · Ward ? · Glowing Flats · On the Steps · Home Again · Weather Caught · Market Night · Read It for Me · Wrong Shapes · Two Plans, One Night · The Long Night · The Reading · Ring Off · Tied Off · Late Delivery · Every Plate · Keepers' Hall · Idris's Hall · Co-op Yard Shed · Lantern Market Third Stall · Archive Desk · Bosun of the lost fleet · A Lowmoor bean-grower · A deckhand of the lost fleet · Odile's grandmother · A towrope maker · Ansel's grandfather · A Thistlewind almanac-keeper · A Cairnhold quarry family
