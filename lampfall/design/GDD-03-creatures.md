# GDD-03 — CREATURES

**Owner:** GDD-03 (creatures). **Binding sources:** `GDD-00-decisions.md` §8, §14, §16; `GDD-ids.md` §2–§4, §6. **Formats:** `ARCHITECTURE-DRAFT.md` §14.1–§14.2 (with the per-dial amendment) and §8. **Flavour and rules:** `wildshift-creatures.md`, `proto/battle/species.js`, `proto/battle/abilities.js`, `proto/creatures/sprites.js`.

This chapter is the shipped creature content of LAMPFALL: 42 forms, 16 family rows with their Shift tables, the 13 types with the chart, and the 25 abilities. Everything here is in data. The prose explains why the numbers are what they are, and gives the art lane a brief for every form that has no sprite yet.

## 1. Files

| File | Exports | DATA table |
|---|---|---|
| `js/data/types.js` | `TYPES` (13 rows `{id, name, abbr, paletteKey, glyph, text}`), `TYPE_NAMES`, `ORDINARY_TYPES`, `TYPE_CHART`, `TYPE_PALETTE_KEY`, `STATUS_IMMUNITY`, `STATUS_CURES`, `TYPE_TABLE` | `types` |
| `js/data/abilities.js` | `ABILITIES` (25 rows), `WARD_ABILITY_IDS`, `STILLCOAT_MIN_POWER` | `abilities` |
| `js/data/species/index.js` | `SPECIES` (42 rows, Field Log order), `FAMILIES` (16 rows), `SPECIES_BY_ID`, `FAMILIES_BY_ID`, `FAMILY_MODULES`, `learnableAt`, `canLearn`, `canBeTaught` | `species`, `families` |
| `js/data/species/<family>.js` × 16 | `{forms, family}` per ARCHITECTURE §8.4 | — |
| `js/data/species/_helpers.js` | the `sp()` / `e()` / `family()` / `anchors()` row builders named in §14.1 | — |
| `test/data.creatures.test.mjs` | self-validation (15 tests, green) | — |

**Wiring for the orchestrator** (`js/data/index.js`, not edited here):

```js
import { TYPES } from './types.js';
import { ABILITIES } from './abilities.js';
import { SPECIES, FAMILIES } from './species/index.js';
// battle view: createBattleData({ ...registry, types: TYPE_TABLE }) — TYPE_TABLE from './types.js'
```

Species `types` hold type **names** (`'Brine'`), as the validator and the battle view expect; type rows have kebab ids.

## 2. Types and the chart

The 12 ordinary types plus Star, exactly as wildshift-creatures §4–§5 writes them: 56 Strong/Weak/Blocked pairings, one immunity (Hollow is immune to Plain and Grit, the one homage), Star neutral both ways. Badge colour keys come from the 21-key master palette:

| Type | Abbr | Badge key | World logic (row `text`) |
|---|---|---|---|
| Plain | Pla | `v` | Everyday bodies and blows; passes straight through Hollow. |
| Grit | Gri | `u` | Fists, grapples, grinding sand. |
| Brine | Bri | `b` | Salt sea; quenches kilns, kills roots. |
| Kiln | Kil | `o` | Flame, forges and kilns; burns off shadow. |
| Moss | Mos | `g` | Roots, lichen, reeds; cracks stone. |
| Bolt | Bol | `y` | Lightning and current; glass insulates. |
| Rime | Rim | `s` | Ice and hard cold; grounds wings. |
| Gust | Gus | `w` | Wind and flight; scatters echoes. |
| Stone | Sto | `e` | Rock, cliffs, sea stacks; shatters glass. |
| Rust | Rus | `r` | Corrosion and old iron; cold iron wards off spirits. |
| Glass | Gla | `i` | Skyglass, mirrors, light; shows what is hollow. |
| Hollow | Hol | `p` | Spirits, echoes, empty places. |
| Star | Sta | `d` + `y` comet glyph | Comet creatures only; outside the chart. Comet magenta `m` never goes on a badge. |

`STATUS_IMMUNITY` (burn/Kiln, chill/Rime, poison/Rust, numb/Bolt) and `STATUS_CURES` (a Kiln hit thaws a chill) are the type rules the battle prototype used to hard-code; `TYPE_TABLE` hands them to `battle/data` in one object.

## 3. Abilities (25)

Every row is pure data. `hook` names a behaviour in `js/battle/abilityHooks.js` `HOOKS`; `hookParams` tune it; `tell` is the on-screen sign (shape and word, never colour alone).

| Ability | Hook (params) | Ward | Forms |
|---|---|---|---|
| Shoresense | `auto-read` | — | Puddlepip, Sloshkin |
| Featherbed | `soften-first-contact` (×0.5) | — | Skeinwing, Skirl |
| Big Sibling | `exp-share-lowest` (0.3) | — | Scrapling, Knuckleback |
| Afterimage | `decoys` | — | Vesperay |
| Unfixed | `type-cycle` | — | Vagary |
| Last Ebb | `low-hp-type-boost` (<25%, ×1.3, Brine+Hollow) | — | Brinelance |
| Empty Weave | `soften-first-non-strong` (×0.5) | — | Creelwight, Hulkwight |
| Keen Glint | `crit-boost` (+2, glint) | — | Sedgehare |
| Tailhum | `reveal-moves-on-entry` (1) | — | Wirewhisk |
| Plateshed | `neutralize-first-strong` | — | Rimeplate, Floeback |
| Skyroam | none (map rule) | — | Squallcoil, Hailcoil |
| Blank Slate | none (Heartmark chosen at first Shift) | — | Tossup |
| Unshifting | none (`neverShifts`) | — | Stillox |
| Furnace Jaw | `first-type-sure-hit` (Kiln) | — | Emberjaw, Caldermaw |
| **Glasshide** | none (engine Ward check) | `strong-only` | Prismoth |
| **Mirrorveil** | none | `no-status` | Lumenveil |
| **Stillcoat** | none | `min-power` 50 | Cairnward, Chillnub |
| Sodden | `block-self-ko` | — | Bilgebob |
| Tidecall | `type-power-boost` (Brine ×1.2) | — | Siltback, Bogmonarch, Rayling, Gillwick |
| Ember Core | `type-power-boost` (Kiln ×1.2) | — | Sootling |
| Slatehide | `category-damage-reduction` (physical ×0.75) | — | Mudfist, Cragmitt |
| Scavenger | `heal-on-ko` (1/8) | — | Rushling, Rustcreel, Rillfin |
| Still Mind | `status-immunity` (numb, chill) | — | Mothling, Coilcrest |
| Sure Footing | `block-foreign-stat-drops` | — | Reedkit, Strandrunner |
| Dusksight | none by day; `nightHook`: `type-power-boost` (Hollow+Gust ×1.2) | — | Duskwisp, Duskowl |

**Wards: three abilities on exactly four forms** (Prismoth, Cairnward, Chillnub, Lumenveil), none of them in an encounter table before Cairnhold. Prismoth's "Prism Ward" is retired; the one name is Glasshide.

**Dusksight** is the only ability that cares what time it is. The hook vocabulary has no clock, and an ability that applied by day would contradict its own text, so the row carries `hook: null` and a `nightHook`. When a battle starts under night rules (18:00–06:00), the battle flow builds the runtime from `{...row, hook: row.nightHook.hook, hookParams: row.nightHook.hookParams}`. The test proves that path works with today's `getAbilityRuntime`.

## 4. Roster (42 forms)

Stats are `[HP, Atk, Def, SpA, SpD, Spe]`. Catch rate is on the 3–255 scale (`odds ≈ catchRate/255 × HP factor × wick`). EXP yield feeds `KO EXP = yield × level ÷ 5`. Growth is kept for the curve field the validator requires; GDD-00 §8's single `8 × L²` curve is owned by `systems/exp`.

| # | Form | Family | Stage | Types | Ability | Heartmark | HP/Atk/Def/SpA/SpD/Spe (total) | Catch | EXP | Growth | Art |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Puddlepip** `puddlepip` | sloshkin | 0 | Brine | shoresense | undertow | 50/50/48/45/50/37 (280) | 120 | 45 | medium-slow | drawn |
| 2 | **Sloshkin** `sloshkin` | sloshkin | 1 | Brine | shoresense | undertow | 60/62/55/50/55/38 (320) | 45 | 64 | medium-slow | drawn |
| 3 | **Siltback** `siltback` | sloshkin | 2 | Brine/Stone | tidecall | undertow | 86/92/86/63/69/34 (430) | 45 | 145 | medium-slow | drawn |
| 4 | **Skeinwing** `skeinwing` | sloshkin | 2 | Brine/Gust | featherbed | undertow | 55/60/50/85/65/105 (420) | 45 | 150 | medium-slow | drawn |
| 5 | **Bogmonarch** `bogmonarch` | sloshkin | 3 | Brine/Stone | tidecall | undertow | 100/105/95/75/80/45 (500) | 45 | 240 | medium-slow | drawn |
| 6 | **Scrapling** `scrapling` | scrapling | 1 | Grit | big-sibling | shadowbox | 65/80/60/30/45/35 (315) | 180 | 60 | medium-fast | drawn |
| 7 | **Mudfist** `mudfist` | scrapling | 1 | Grit | slatehide | knuckle | 65/75/60/35/50/40 (325) | 150 | 62 | medium-fast | drawn |
| 8 | **Knuckleback** `knuckleback` | scrapling | 2 | Grit | big-sibling | shadowbox | 80/110/75/40/60/55 (420) | 90 | 145 | medium-fast | brief |
| 9 | **Cragmitt** `cragmitt` | scrapling | 3 | Grit/Stone | slatehide | shadowbox | 95/125/110/45/70/60 (505) | 45 | 235 | medium-fast | brief |
| 10 | **Reedkit** `reedkit` | sedgehare | 1 | Moss | sure-footing | reed-whip | 52/62/48/50/50/56 (318) | 45 | 64 | medium-slow | brief |
| 11 | **Rushling** `rushling` | sedgehare | 1 | Moss/Brine | scavenger | reed-whip | 60/50/55/70/60/35 (330) | 150 | 63 | medium-fast | drawn |
| 12 | **Sedgehare** `sedgehare` | sedgehare | 2 | Moss | keen-glint | reap | 70/95/60/55/60/100 (440) | 75 | 145 | medium-fast | drawn |
| 13 | **Mothling** `mothling` | prismoth | 1 | Glass | still-mind | dust-veil | 45/35/45/65/60/70 (320) | 150 | 58 | medium-fast | brief |
| 14 | **Prismoth** `prismoth` | prismoth | 2 | Glass/Gust | glasshide | dust-veil | 60/40/55/90/80/95 (420) | 90 | 140 | medium-fast | drawn |
| 15 | **Cairnward** `cairnward` | prismoth | 2 | Stone/Glass | stillcoat | shard-fling | 80/65/110/70/95/30 (450) | 25 | 160 | slow | brief |
| 16 | **Lumenveil** `lumenveil` | prismoth | 3 | Glass | mirrorveil | shardlight | 75/55/70/120/95/80 (495) | 45 | 235 | medium-slow | drawn |
| 17 | **Rayling** `rayling` | vesperay | 1 | Brine | tidecall | salt-spray | 55/40/50/65/65/60 (335) | 120 | 66 | medium-fast | brief |
| 18 | **Vesperay** `vesperay` | vesperay | 2 | Brine/Glass | afterimage | vesper-mend | 95/60/85/100/100/80 (520) | 20 | 220 | slow | drawn |
| 19 | **Bilgebob** `bilgebob` | bilgebob | 1 | Brine | sodden | gnash | 110/55/45/50/45/25 (330) | 120 | 70 | slow | brief |
| 20 | **Brinelance** `brinelance` | bilgebob | 2 | Brine/Rime | last-ebb | gnash | 75/105/65/60/65/85 (455) | 30 | 170 | slow | drawn |
| 21 | **Rustcreel** `rustcreel` | creelwight | 1 | Rust | scavenger | rust-bite | 55/62/80/40/55/30 (322) | 140 | 62 | medium-fast | brief |
| 22 | **Creelwight** `creelwight` | creelwight | 2 | Hollow/Rust | empty-weave | snuff | 70/65/110/70/95/30 (440) | 60 | 150 | medium-slow | drawn |
| 23 | **Hulkwight** `hulkwight` | creelwight | 3 | Hollow/Rust | empty-weave | snuff | 90/80/130/80/105/30 (515) | 30 | 235 | medium-slow | brief |
| 24 | **Wirewhisk** `wirewhisk` | wirewhisk | 1 | Bolt | tailhum | arc-ping | 45/40/45/70/55/95 (350) | 190 | 55 | medium-fast | drawn |
| 25 | **Coilcrest** `coilcrest` | wirewhisk | 2 | Bolt/Gust | still-mind | arc-ping | 65/55/60/100/65/105 (450) | 45 | 165 | medium-fast | brief |
| 26 | **Chillnub** `chillnub` | rimeplate | 1 | Rime | stillcoat | frost-nip | 61/50/67/44/50/28 (300) | 160 | 52 | medium-slow | drawn |
| 27 | **Rimeplate** `rimeplate` | rimeplate | 2 | Rime/Stone | plateshed | plate-toss | 80/85/115/50/75/30 (435) | 90 | 150 | medium-slow | drawn |
| 28 | **Floeback** `floeback` | rimeplate | 3 | Rime/Stone | plateshed | plate-toss | 105/100/135/60/90/25 (515) | 30 | 235 | medium-slow | brief |
| 29 | **Sootling** `sootling` | caldermaw | 1 | Kiln | ember-core | ember-lick | 50/56/44/67/44/39 (300) | 160 | 54 | slow | brief |
| 30 | **Emberjaw** `emberjaw` | caldermaw | 2 | Kiln | furnace-jaw | kiln-maw | 75/95/65/90/60/60 (445) | 45 | 150 | slow | brief |
| 31 | **Caldermaw** `caldermaw` | caldermaw | 3 | Kiln/Stone | furnace-jaw | kiln-maw | 90/110/100/95/70/55 (520) | 30 | 210 | slow | drawn |
| 32 | **Rillfin** `rillfin` | rillfin | 1 | Brine | scavenger | breaker | 48/55/45/55/45/75 (323) | 170 | 58 | medium-fast | brief |
| 33 | **Gillwick** `gillwick` | rillfin | 2 | Brine/Moss | tidecall | breaker | 75/70/70/85/75/65 (440) | 75 | 150 | medium-fast | brief |
| 34 | **Strandrunner** `strandrunner` | rillfin | 3 | Brine/Gust | sure-footing | breaker | 85/100/80/85/70/90 (510) | 30 | 230 | medium-fast | brief |
| 35 | **Tossup** `tossup` | tossup | 1 | Plain | blank-slate | — | 50/45/50/45/50/60 (300) | 255 | 50 | fast | drawn |
| 36 | **Squallcoil** `squallcoil` | errant | 4 | Bolt/Brine | skyroam | bandlight | 90/85/75/125/90/115 (580) | 56 | 280 | slow | drawn |
| 37 | **Hailcoil** `hailcoil` | errant | 4 | Rime/Gust | skyroam | gale-cut | 90/115/80/110/80/105 (580) | 56 | 280 | slow | brief |
| 38 | **Skirl** `skirl` | duskowl | 1 | Gust | featherbed | downdraft | 45/58/40/45/42/85 (315) | 170 | 56 | fast | brief |
| 39 | **Duskwisp** `duskwisp` | duskowl | 1 | Hollow | dusksight | murk | 48/40/45/73/62/62 (330) | 140 | 62 | medium-fast | brief |
| 40 | **Duskowl** `duskowl` | duskowl | 2 | Hollow/Gust | dusksight | echo-drain | 75/78/65/90/72/70 (450) | 60 | 160 | medium-fast | brief |
| 41 | **Stillox** `stillox` | stillox | 4 | Stone | unshifting | — | 110/115/130/50/85/30 (520) | 25 | 230 | slow | drawn |
| 42 | **Vagary** `vagary` | vagary | 4 | Star | unfixed | — | 100/90/90/120/100/100 (600) | 18 | 300 | slow | drawn |

## 5. Family trees

The arrows are each family's **forward line** (the heaviest Up weight on Drift). The Shift tables in §6 show every card.

```
 1 SLOSHKIN       Puddlepip(0) ──> Sloshkin(1) ──> Siltback(2) ──> Bogmonarch(3)
                                        └──(Up 20/25/25)──> Skeinwing(2, Shift-only) ──> Bogmonarch / Lumenveil
                  Side Mudfist · Rushling     Down Puddlepip · Chillnub     Star-touched Sloshkin (palette)
 2 SCRAPLING      Scrapling(1) ──> Knuckleback(2) ──> Cragmitt(3)      Mudfist(1) beside Scrapling
 3 SEDGEHARE      Reedkit(1) ──> Sedgehare(2)      Rushling(1) beside Reedkit (half Brine)
 4 PRISMOTH       Mothling(1) ──> Prismoth(2, Glasshide) ──> Lumenveil(3, Mirrorveil)
                                └─> Cairnward(2, Stillcoat) ──> Lumenveil
 5 VESPERAY       Rayling(1) ──> Vesperay(2)
 6 BILGEBOB       Bilgebob(1) ··(6 of 100 on Flux)··> Brinelance(2)     (Bilgebob's Up card is mostly Siltback)
 7 CREELWIGHT     Rustcreel(1) ──> Creelwight(2) ──> Hulkwight(3)
 8 WIREWHISK      Wirewhisk(1) ──> Coilcrest(2)
 9 RIMEPLATE      Chillnub(1, Stillcoat) ──> Rimeplate(2) ──> Floeback(3)   (Rimeplate's Down card: Chillnub 80/65/50)
10 CALDERMAW      Sootling(1) ──> Emberjaw(2) ──> Caldermaw(3)           (Linnet's dock: Sootling ⇒ Caldermaw, scripted)
11 RILLFIN        Rillfin(1) ──> Gillwick(2) ──> Strandrunner(3)         (Wick's water pack)
12 TOSSUP         Tossup(1) ──> any of 12 stage-2 forms, one per type; Side any of 12 stage-1 forms
13 ERRANT         Squallcoil(4) <──Side──> Hailcoil(4)
14 DUSKOWL        Skirl(1) ──> Duskowl(2) <── Duskwisp(1)
—  UNSHIFTING     Stillox(4) · Vagary(4, 96×96)
```

## 6. Design notes

### 6.1 Stats: the stage ladder

Totals sit on the prototype's ladder: hatchling 270–290, stage 1 300–355, stage 2 420–470, stage 3 495–525, titan 520, Errant 580, legendary 600 (the test enforces it). Wherever `proto/battle/species.js` already had a form, its numbers stand (GDD-00 §8: "prototype base stats, catch rates … are accepted starting values"). The changes are few, and each one has a reason:

| Form | Prototype | Here | Why |
|---|---|---|---|
| Siltback | 375 total | **430** (same shape ×1.15) | The forward Up card from Sloshkin sat *below* Skeinwing (420) and below every other stage 2; landing "Up" on a weaker body breaks pillar 1's promise that Up means up. |
| Chillnub | stage 0, 270 | **stage 1, 300** (same shape) | GDD-ids ruling 4 makes it stage 1; 270 sat under the stage-1 floor. Still the line's smallest form; Stillcoat carries it. |
| Sootling | stage 0, 270 | **stage 1, 300** (same shape) | Same ruling; it is Linnet's lead in Acts III–IV and must not fold to a stray hit. |
| Vesperay | stage 3, 520 | **stage 2, 520 kept** | GDD-00 makes it stage 2. Its line has only two forms, so its top carries a stage-3 total. Idris's ace has to be the hardest single creature short of an Errant. |
| Prismoth | `prism-ward` | **`glasshide`** | GDD-00 §8 merge. `hpMultiplier: 0.25` is kept: one Strong hit ends it. |
| Puddlepip | `glasshide` | **`shoresense`** | GDD-ids ruling 4: Wards on four forms only. |
| Tossup | EXP 40 | **EXP 50** | GDD-00 §8's night-one check counts the Lv4 Tossup catch as 40 EXP; 50 × 4 ÷ 5 = 40. |
| Squallcoil | catch 3 | **catch 56** (Hailcoil too) | GDD-00 §8: "Start odds ~22% with a Tallow wick". 56/255 = 22% at the Capture Stance floor. |
| Vagary | catch 3 | **catch 18** | GDD-00 §12 day 40: "14% with a Skyglass wick"; 18/255 × 2 = 14% at the floor. |

Every new form is built on the same ladder. Its shape follows the role in GDD-ids (Hulkwight and Floeback are walls, Coilcrest and Skirl are fast, Emberjaw and Strandrunner hit physically, Duskwisp and Mothling hit specially).

### 6.2 Learnsets

- Every learnset gives the form a same-type hit by its catch level, and a second type by the window it is likely to Shift at (Lv20).
- Learn levels line up with the authored trainer parties (GDD-04): every party move is learnable by its level.
- The prototype learnsets are kept. Five small changes: Scrapling's Shadowbox at 5 (the starter's level); Bilgebob's Lv38 Hullburst (useless under its own Sodden) becomes Breaker; Squallcoil learns its signature Bandlight at **12**, so an Emberstep Squallcoil (Lv15–20) actually shows the band tell; Stillox learns Bedrock Charge at **28**, so the rare Thistlewind Stillox (Lv29–34) has it; Siltback, Bogmonarch and Puddlepip now carry the Undertow that their Heartmark already named.
- All 11 new techniques have homes: Breaker (Sloshkin line, Rillfin line, Rayling, Bilgebob), Flashover (Sootling line), Mire Bloom (Reedkit, Rushling, Gillwick), Fizz (Wirewhisk, Coilcrest), Live Wire (Coilcrest, Squallcoil), Floe Ram (Rimeplate line, Brinelance, Hailcoil, Strandrunner), Downdraft (Skeinwing, Mothling, Rillfin, Skirl, Duskowl, Coilcrest, Strandrunner, Hailcoil), Cairn Crash (Cragmitt, Cairnward, Floeback, Emberjaw, Stillox, Hailcoil), Murk (Rustcreel, Creelwight line, Skirl, the Dusk owls), Drowned Bell (Creelwight line, Duskwisp, Duskowl), Hush (Hulkwight, the Dusk owls).
- **All 15 signatures** sit in their species' learnsets (the test checks `SIGNATURES` from the manifest).
- **Discs** (`flags.teachable`): GDD-00 §8's seed validator wants every disc to have ≥ 25% learners. Each of the 12 disc moves is learnable (by level or by disc) by at least 11 of the 42 forms. Tossup learns every disc (it is the lottery slot). `species/index.canBeTaught(row, moveId)` is the union rule.

### 6.3 Heartmark techniques

Each form names the technique a creature *caught in that form* carries for life. The technique is always in the learnset; on every early-route form it is learned by the lowest wild level (Scrapling's Shadowbox moves from 6 to 5 so the Lv5 starter has it; Puddlepip's Undertow sits at 3), and `systems/creature.makeCreature` slots it either way. Where the source names none, it is a hit of the line's own type. Exceptions: **Tossup** (`null`, Blank Slate picks one at its first Shift), and **Stillox** and **the Vagary** (`null`, "n/a, never Shifts" in the source). Vesperay's is Vesper Mend: an anchored Champion's partner that later Shifts keeps the brightening tell on its mark, and the 3-Mend budget stops it looping.

### 6.4 Shift tables

Every shifting form has its own row `{up, side, down}` in **its own family's** table. Pools may name other families' forms (GDD-00 §8; the validator allows it). Weights are per-dial `{drift, flux, freefall}`:

1. **Sloshkin's row is the source table verbatim** (wildshift-creatures §6.2), the Sloshkin family's `star` is `sloshkin`, and the Star-touched palette is `{b→e, s→v, n→d, w→i}` (the prototype's comet-dusk remap).
2. **Directions follow stage** (the test checks): Up never names a lower stage, Down never a higher one. The forward line holds most of the Drift Up weight (Scrapling's line holds exactly 70 of 100, as the source says). Drift puts 0 on the exotic picks (Lumenveil, Chillnub and their kind), Flux opens them, and Freefall flattens.
3. **Freefall is flattened**: every entry in a card weighs the same (GDD-00 §8, "flattened (equal)"), and `systems/forecast` reads it as written. Freefall therefore needs no special case in the code.
4. **Small forms count as Down for stage 1.** The source calls Chillnub and Sootling hatchlings; GDD-ids made them stage 1 for stats, and GDD-00 fixes Chillnub as Sloshkin's Down card. So the stage-1 lines draw Down from Puddlepip, Chillnub and Sootling. Puddlepip is the only stage-0 form: its Down card is empty (0%), and its Side card holds the small stage-1 forms.
5. **Top-stage Up cards.** A stage-3 form's Up card holds the stronger stage-3 forms of other lines plus the two Errants at a long-shot weight (Drift 5, Flux 10, Freefall flat). Up really is a higher stage there, and a late window still offers something to reach for. Caldermaw is the strongest stage 3, so its Up card is the toughest peers plus the Errants.
6. **Errants**: Side is the other Errant, Up is empty (nothing sits above them), and Down holds stage-2/3 sky and sea forms. The only hatchling row weighs 0 on Drift and Flux ("Down card never a hatchling on Drift/Flux"); `forecast.ERRANT_ZERO_DOWN` zeroes their Down card on those dials anyway.
7. **Tossup**: 12 forms per card, one per type, `w = 1` on every dial ("split evenly"). Down is Puddlepip.
8. **Bilgebob → Brinelance** sits at 3/6/25 in an Up card that sums to 100 on Flux: the accidental hero is one Up card in 17.
9. **Windows** are `[8, 20, 34]` on every Shift family (GDD-00 §8). The two singleton rows have `windows: []`, `shiftTable: {}`, `star: null`, and their forms are flagged `neverShifts`.

**Star-touched** forms are palette variants, not rows. Each Shift family names its `star` form, a `starPalette` (master-key remap onto the Star badge greys `v e d` with an `i` glint, never `m`) and a `starText` line for the Field Log.

### 6.5 Sprite data on the rows

Every row's `flags` carries what `art/creatures` and the Heartmark renderer need:

- `sprite` (`drawn` or `brief`), `size` (32; the Vagary 96), `palette` (≤ 8 master keys, `k` included, no `m` except on the Vagary) and `heartmarkHighlight` (`w` on cool bodies, `y` on warm or white ones).
- `heartmarkAnchors {head, chest, back, tail}` in front-sprite pixels. For the 22 drawn forms every anchor is on a body pixel of `proto/creatures/sprites.js`, and the prototype's mark is one of the four (the test checks both). For the 20 undrawn forms they are planned, and the art lane must keep them on body pixels.
- `feature`, `idle` (`squash` grounded, `hover` fliers), `mustNotReadAs` (described by archetype; no other franchise's names appear in shipped data), `habitat` and `log` (the Field Log plate text).

Engine-read flags: `hpMultiplier`, `neverShifts`, `neverOnForecast`, `errant`, `shiftOnly`, `hatchling`.

## 7. Shift tables (per form, weights drift/flux/freefall)

Weights are relative inside one card. The dial sets the card odds (GDD-00 §8: Drift 50/40/10, Flux 40/35/25, Freefall 30/30/40, then Bond and the Relighting). An empty card shows 0% and its points spread to the other cards. These tables are generated from `js/data/species/*.js`.

#### Sloshkin line (`sloshkin`), star: sloshkin

| From | Up (drift/flux/freefall) | Side | Down |
|---|---|---|---|
| Puddlepip | Sloshkin 85/70/33, Rushling 15/20/33, Siltback 0/10/33 | Chillnub 50/40/33, Tossup 50/40/33, Sootling 0/20/33 | — (empty: 0%) |
| Sloshkin | Siltback 70/45/25, Skeinwing 20/25/25, Bogmonarch 10/15/25, Lumenveil 0/15/25 | Mudfist 50/50/50, Rushling 50/50/50 | Puddlepip 100/70/50, Chillnub 0/30/50 |
| Siltback | Bogmonarch 70/50/25, Lumenveil 10/20/25, Cragmitt 10/15/25, Floeback 10/15/25 | Skeinwing 45/35/33, Rimeplate 30/35/33, Gillwick 25/30/33 | Sloshkin 80/60/33, Mudfist 20/25/33, Puddlepip 0/15/33 |
| Skeinwing | Bogmonarch 60/50/50, Lumenveil 40/50/50 | Siltback 100/100/100 | Sloshkin 60/40/25, Mudfist 15/20/25, Rushling 15/20/25, Puddlepip 10/20/25 |
| Bogmonarch | Caldermaw 35/30/20, Floeback 30/25/20, Hulkwight 25/25/20, Squallcoil 5/10/20, Hailcoil 5/10/20 | Lumenveil 40/35/33, Cragmitt 30/35/33, Strandrunner 30/30/33 | Siltback 60/45/25, Skeinwing 30/30/25, Sloshkin 10/15/25, Rimeplate 0/10/25 |

#### Scrapling line (`scrapling`), star: scrapling

| From | Up (drift/flux/freefall) | Side | Down |
|---|---|---|---|
| Scrapling | Knuckleback 60/45/25, Cragmitt 10/10/25, Sedgehare 15/20/25, Siltback 15/25/25 | Mudfist 60/45/33, Tossup 25/30/33, Rustcreel 15/25/33 | Puddlepip 70/50/33, Sootling 30/30/33, Chillnub 0/20/33 |
| Mudfist | Knuckleback 50/40/25, Siltback 30/30/25, Cragmitt 10/15/25, Rimeplate 10/15/25 | Scrapling 50/40/33, Rushling 30/35/33, Sloshkin 20/25/33 | Puddlepip 70/55/50, Sootling 30/45/50 |
| Knuckleback | Cragmitt 70/50/25, Caldermaw 10/15/25, Bogmonarch 10/15/25, Hulkwight 10/20/25 | Sedgehare 40/35/33, Brinelance 30/30/33, Siltback 30/35/33 | Scrapling 70/50/33, Mudfist 30/35/33, Tossup 0/15/33 |
| Cragmitt | Caldermaw 40/35/20, Floeback 30/25/20, Hulkwight 20/20/20, Squallcoil 5/10/20, Hailcoil 5/10/20 | Bogmonarch 50/40/33, Strandrunner 25/30/33, Lumenveil 25/30/33 | Knuckleback 70/55/33, Siltback 20/25/33, Rimeplate 10/20/33 |

#### Sedgehare line (`sedgehare`), star: sedgehare

| From | Up (drift/flux/freefall) | Side | Down |
|---|---|---|---|
| Reedkit | Sedgehare 70/55/33, Gillwick 15/25/33, Knuckleback 15/20/33 | Rushling 60/45/33, Scrapling 25/30/33, Skirl 15/25/33 | Puddlepip 60/50/50, Sootling 40/50/50 |
| Rushling | Sedgehare 45/35/25, Gillwick 35/30/25, Siltback 20/20/25, Vesperay 0/15/25 | Reedkit 50/40/33, Sloshkin 30/30/33, Rillfin 20/30/33 | Puddlepip 100/70/50, Chillnub 0/30/50 |
| Sedgehare | Cragmitt 45/35/33, Strandrunner 35/35/33, Bogmonarch 20/30/33 | Knuckleback 40/35/33, Gillwick 40/35/33, Duskowl 20/30/33 | Reedkit 70/50/33, Rushling 30/35/33, Scrapling 0/15/33 |

#### Prismoth line (`prismoth`), star: prismoth

| From | Up (drift/flux/freefall) | Side | Down |
|---|---|---|---|
| Mothling | Prismoth 60/45/25, Cairnward 20/20/25, Coilcrest 20/20/25, Lumenveil 0/15/25 | Skirl 40/35/33, Rayling 30/35/33, Wirewhisk 30/30/33 | Puddlepip 60/50/50, Chillnub 40/50/50 |
| Prismoth | Lumenveil 75/55/33, Strandrunner 25/30/33, Hulkwight 0/15/33 | Cairnward 40/35/33, Coilcrest 30/35/33, Vesperay 30/30/33 | Mothling 80/60/33, Skirl 20/25/33, Duskwisp 0/15/33 |
| Cairnward | Lumenveil 60/45/33, Floeback 25/30/33, Cragmitt 15/25/33 | Prismoth 40/35/33, Rimeplate 35/35/33, Siltback 25/30/33 | Mothling 70/55/33, Chillnub 30/30/33, Rustcreel 0/15/33 |
| Lumenveil | Hulkwight 35/30/20, Floeback 30/25/20, Caldermaw 25/25/20, Squallcoil 5/10/20, Hailcoil 5/10/20 | Strandrunner 40/35/33, Bogmonarch 30/35/33, Cragmitt 30/30/33 | Prismoth 45/40/33, Cairnward 35/35/33, Vesperay 20/25/33 |

#### Vesperay line (`vesperay`), star: vesperay

| From | Up (drift/flux/freefall) | Side | Down |
|---|---|---|---|
| Rayling | Vesperay 70/50/25, Prismoth 10/15/25, Siltback 10/15/25, Gillwick 10/20/25 | Mothling 40/35/33, Rillfin 35/35/33, Bilgebob 25/30/33 | Puddlepip 100/75/50, Chillnub 0/25/50 |
| Vesperay | Lumenveil 60/45/33, Strandrunner 25/30/33, Bogmonarch 15/25/33 | Prismoth 35/35/33, Brinelance 35/35/33, Skeinwing 30/30/33 | Rayling 80/60/33, Mothling 20/25/33, Puddlepip 0/15/33 |

#### Bilgebob line (`bilgebob`), star: bilgebob

| From | Up (drift/flux/freefall) | Side | Down |
|---|---|---|---|
| Bilgebob | Siltback 50/44/25, Rimeplate 27/30/25, Gillwick 20/20/25, Brinelance 3/6/25 | Rayling 40/35/33, Rillfin 30/35/33, Rushling 30/30/33 | Puddlepip 100/70/50, Chillnub 0/30/50 |
| Brinelance | Strandrunner 40/35/33, Floeback 35/35/33, Hulkwight 25/30/33 | Rimeplate 35/35/33, Skeinwing 35/30/33, Creelwight 30/35/33 | Bilgebob 80/60/33, Rayling 20/25/33, Chillnub 0/15/33 |

#### Creelwight line (`creelwight`), star: creelwight

| From | Up (drift/flux/freefall) | Side | Down |
|---|---|---|---|
| Rustcreel | Creelwight 70/55/33, Duskowl 20/25/33, Rimeplate 10/20/33 | Duskwisp 50/45/33, Bilgebob 25/30/33, Tossup 25/25/33 | Puddlepip 60/50/50, Sootling 40/50/50 |
| Creelwight | Hulkwight 75/60/33, Caldermaw 15/20/33, Floeback 10/20/33 | Duskowl 50/40/33, Cairnward 25/30/33, Brinelance 25/30/33 | Rustcreel 75/55/33, Duskwisp 25/30/33, Chillnub 0/15/33 |
| Hulkwight | Caldermaw 50/40/25, Floeback 40/40/25, Squallcoil 5/10/25, Hailcoil 5/10/25 | Lumenveil 40/35/33, Cragmitt 30/35/33, Bogmonarch 30/30/33 | Creelwight 80/60/33, Duskowl 20/25/33, Rustcreel 0/15/33 |

#### Wirewhisk line (`wirewhisk`), star: wirewhisk

| From | Up (drift/flux/freefall) | Side | Down |
|---|---|---|---|
| Wirewhisk | Coilcrest 70/50/25, Skeinwing 10/20/25, Prismoth 10/15/25, Duskowl 10/15/25 | Skirl 45/40/33, Rillfin 30/30/33, Mothling 25/30/33 | Puddlepip 70/55/50, Sootling 30/45/50 |
| Coilcrest | Strandrunner 50/40/33, Lumenveil 30/30/33, Bogmonarch 20/30/33 | Skeinwing 40/35/33, Duskowl 30/35/33, Prismoth 30/30/33 | Wirewhisk 80/60/33, Skirl 20/25/33, Mothling 0/15/33 |

#### Rimeplate line (`rimeplate`), star: rimeplate

| From | Up (drift/flux/freefall) | Side | Down |
|---|---|---|---|
| Chillnub | Rimeplate 70/55/25, Cairnward 10/15/25, Siltback 10/15/25, Brinelance 10/15/25 | Sootling 40/35/33, Mothling 30/35/33, Tossup 30/30/33 | Puddlepip 100/100/100 |
| Rimeplate | Floeback 70/50/25, Bogmonarch 10/20/25, Cragmitt 10/15/25, Lumenveil 10/15/25 | Siltback 40/35/33, Cairnward 30/35/33, Brinelance 30/30/33 | Chillnub 80/65/50, Bilgebob 20/35/50 |
| Floeback | Caldermaw 50/40/25, Hulkwight 40/40/25, Squallcoil 5/10/25, Hailcoil 5/10/25 | Bogmonarch 40/35/33, Cragmitt 35/35/33, Lumenveil 25/30/33 | Rimeplate 80/60/33, Siltback 20/25/33, Chillnub 0/15/33 |

#### Caldermaw line (`caldermaw`), star: caldermaw

| From | Up (drift/flux/freefall) | Side | Down |
|---|---|---|---|
| Sootling | Emberjaw 65/50/25, Caldermaw 10/10/25, Knuckleback 15/20/25, Duskowl 10/20/25 | Chillnub 40/35/33, Scrapling 30/35/33, Rustcreel 30/30/33 | Puddlepip 100/100/100 |
| Emberjaw | Caldermaw 70/55/33, Cragmitt 20/25/33, Hulkwight 10/20/33 | Knuckleback 40/35/33, Sedgehare 30/30/33, Creelwight 30/35/33 | Sootling 80/60/33, Scrapling 20/25/33, Chillnub 0/15/33 |
| Caldermaw | Hulkwight 40/35/25, Floeback 40/35/25, Squallcoil 10/15/25, Hailcoil 10/15/25 | Cragmitt 40/35/33, Bogmonarch 35/35/33, Strandrunner 25/30/33 | Emberjaw 60/45/33, Sootling 30/35/33, Knuckleback 10/20/33 |

#### Rillfin line (`rillfin`), star: rillfin

| From | Up (drift/flux/freefall) | Side | Down |
|---|---|---|---|
| Rillfin | Gillwick 70/55/25, Siltback 20/20/25, Skeinwing 10/15/25, Vesperay 0/10/25 | Rayling 40/35/33, Rushling 30/35/33, Skirl 30/30/33 | Puddlepip 100/80/50, Chillnub 0/20/50 |
| Gillwick | Strandrunner 70/55/33, Bogmonarch 20/25/33, Lumenveil 10/20/33 | Sedgehare 35/35/33, Siltback 35/35/33, Vesperay 30/30/33 | Rillfin 80/60/33, Rushling 20/25/33, Puddlepip 0/15/33 |
| Strandrunner | Hulkwight 30/25/20, Floeback 30/25/20, Caldermaw 30/30/20, Squallcoil 5/10/20, Hailcoil 5/10/20 | Bogmonarch 40/35/33, Cragmitt 30/35/33, Lumenveil 30/30/33 | Gillwick 75/55/33, Skeinwing 25/30/33, Rillfin 0/15/33 |

#### Tossup (`tossup`), star: tossup

| From | Up (drift/flux/freefall) | Side | Down |
|---|---|---|---|
| Tossup | Knuckleback 1/1/1, Sedgehare 1/1/1, Prismoth 1/1/1, Cairnward 1/1/1, Vesperay 1/1/1, Brinelance 1/1/1, Creelwight 1/1/1, Coilcrest 1/1/1, Rimeplate 1/1/1, Emberjaw 1/1/1, Gillwick 1/1/1, Duskowl 1/1/1 | Sloshkin 1/1/1, Scrapling 1/1/1, Reedkit 1/1/1, Mothling 1/1/1, Wirewhisk 1/1/1, Chillnub 1/1/1, Sootling 1/1/1, Rustcreel 1/1/1, Skirl 1/1/1, Duskwisp 1/1/1, Mudfist 1/1/1, Rillfin 1/1/1 | Puddlepip 1/1/1 |

#### Errants (`errant`), star: squallcoil

| From | Up (drift/flux/freefall) | Side | Down |
|---|---|---|---|
| Squallcoil | — (empty: 0%) | Hailcoil 100/100/100 | Strandrunner 40/40/25, Coilcrest 30/30/25, Vesperay 30/30/25, Puddlepip 0/0/25 |
| Hailcoil | — (empty: 0%) | Squallcoil 100/100/100 | Floeback 35/35/25, Strandrunner 35/35/25, Skeinwing 30/30/25, Chillnub 0/0/25 |

#### Duskowl line (`duskowl`), star: duskowl

| From | Up (drift/flux/freefall) | Side | Down |
|---|---|---|---|
| Skirl | Duskowl 60/45/25, Skeinwing 15/20/25, Coilcrest 15/20/25, Prismoth 10/15/25 | Duskwisp 50/45/33, Wirewhisk 25/30/33, Mothling 25/25/33 | Puddlepip 70/55/50, Sootling 30/45/50 |
| Duskwisp | Duskowl 65/50/33, Creelwight 25/30/33, Prismoth 10/20/33 | Skirl 45/40/33, Rustcreel 30/30/33, Mothling 25/30/33 | Puddlepip 60/50/50, Chillnub 40/50/50 |
| Duskowl | Hulkwight 45/35/33, Strandrunner 30/35/33, Lumenveil 25/30/33 | Creelwight 40/35/33, Coilcrest 30/35/33, Skeinwing 30/30/33 | Skirl 50/40/33, Duskwisp 50/40/33, Rustcreel 0/20/33 |

### 7.1 Learnsets and disc compatibility

| Form | Learnset (level move) | Disc-teachable |
|---|---|---|
| Puddlepip | 1 tap, 1 salt-spray, 3 undertow, 6 settle, 12 shell-rattle, 18 shellguard, 24 tidal-mend, 30 riptide | sandtrap, stand-firm, plumbline |
| Sloshkin | 1 tap, 1 salt-spray, 5 undertow, 9 settle, 13 shell-rattle, 17 shellguard, 22 riptide, 25 breaker, 28 tidal-mend, 34 grind-down | sandtrap, stand-firm, hoarfrost, drowned-bell, cairn-crash, plumbline |
| Siltback | 1 tap, 1 salt-spray, 1 undertow, 5 shard-fling, 12 settle, 18 stand-firm, 24 riptide, 30 sandtrap, 36 bedrock-charge, 42 tidal-mend | cairn-crash, hoarfrost, drowned-bell, plumbline |
| Skeinwing | 1 tap, 1 salt-spray, 5 undertow, 8 downdraft, 12 gale-cut, 18 skein-sweep, 24 updraft, 30 mirror-step, 36 riptide, 42 hoarfrost | shardlight, drowned-bell, plumbline |
| Bogmonarch | 1 tap, 1 salt-spray, 1 undertow, 5 shard-fling, 12 settle, 20 stand-firm, 28 riptide, 32 breaker, 36 sandtrap, 44 bedrock-charge, 52 tidal-mend, 60 grind-down | cairn-crash, hoarfrost, drowned-bell, gnash, plumbline, spore-drift |
| Scrapling | 1 tap, 1 knuckle, 5 shadowbox, 10 sand-smother, 15 pummel, 20 stand-firm, 26 grind-down, 32 shellguard, 38 rust-bite | sandtrap, cairn-crash, gnash, live-wire, plumbline |
| Mudfist | 1 tap, 1 knuckle, 8 sand-smother, 14 pummel, 20 stand-firm, 26 grind-down, 32 shellguard, 38 iron-pin | sandtrap, cairn-crash, gnash, plumbline, spore-drift, live-wire |
| Knuckleback | 1 tap, 1 knuckle, 6 shadowbox, 10 sand-smother, 15 pummel, 20 stand-firm, 26 grind-down, 32 shellguard, 38 rust-bite, 45 iron-pin | sandtrap, cairn-crash, gnash, live-wire, gale-cut, plumbline |
| Cragmitt | 1 tap, 1 knuckle, 6 shadowbox, 10 shard-fling, 15 pummel, 20 stand-firm, 26 grind-down, 32 sandtrap, 36 cairn-crash, 40 bedrock-charge, 48 iron-pin | gnash, live-wire, plumbline |
| Reedkit | 1 tap, 1 reed-whip, 4 sand-smother, 8 root-knot, 12 updraft, 16 spore-drift, 21 reap, 27 mire-bloom, 33 grind-down | gale-cut, sandtrap, stand-firm, cairn-crash, plumbline |
| Rushling | 1 tap, 1 reed-whip, 7 salt-spray, 13 spore-drift, 19 root-knot, 22 mire-bloom, 25 riptide, 31 tidal-mend, 37 reap | sandtrap, stand-firm, hoarfrost, plumbline |
| Sedgehare | 1 tap, 1 reed-whip, 9 updraft, 15 reap, 21 root-knot, 27 spore-drift, 33 gale-cut, 39 grind-down | sandtrap, cairn-crash, gnash, stand-firm, plumbline |
| Mothling | 1 tap, 1 dust-veil, 6 dazzle, 11 downdraft, 12 shardlight, 22 updraft, 28 lens-focus, 34 mirror-step | spore-drift, gale-cut, plumbline, flashover |
| Prismoth | 1 tap, 1 dust-veil, 8 shardlight, 14 updraft, 20 skein-sweep, 26 lens-focus, 32 mirror-step, 38 spore-drift | gale-cut, plumbline, flashover |
| Cairnward | 1 tap, 1 shard-fling, 1 dust-veil, 8 settle, 14 dazzle, 20 shardlight, 26 stand-firm, 32 sandtrap, 38 cairn-crash, 44 lens-focus, 50 bedrock-charge | hoarfrost, plumbline, spore-drift, flashover |
| Lumenveil | 1 tap, 1 dust-veil, 10 shardlight, 18 lens-focus, 26 dazzle, 34 mirror-step, 42 echo-drain, 50 tidal-mend | drowned-bell, hoarfrost, spore-drift, plumbline, flashover |
| Rayling | 1 tap, 1 salt-spray, 6 dust-veil, 11 settle, 16 breaker, 20 riptide, 22 shardlight, 34 tidal-mend, 38 mirror-step | hoarfrost, drowned-bell, plumbline |
| Vesperay | 1 salt-spray, 1 dust-veil, 10 shellguard, 18 shardlight, 26 vesper-mend, 34 mirror-step, 42 riptide, 50 lens-focus, 58 echo-drain | hoarfrost, drowned-bell, plumbline |
| Bilgebob | 1 tap, 1 salt-spray, 8 gnash, 14 settle, 20 shellguard, 26 riptide, 30 breaker, 36 tidal-mend | hoarfrost, drowned-bell, stand-firm, sandtrap, plumbline |
| Brinelance | 1 tap, 1 gnash, 8 salt-spray, 16 frost-nip, 20 floe-ram, 24 riptide, 28 breaker, 32 hoarfrost, 40 iron-pin, 48 pummel | drowned-bell, gale-cut, plumbline |
| Rustcreel | 1 tap, 1 rust-bite, 5 corrode, 10 settle, 15 murk, 21 iron-pin, 27 stand-firm, 33 shellguard, 40 hullburst | sandtrap, drowned-bell, gnash, plumbline, live-wire |
| Creelwight | 1 tap, 1 snuff, 8 rust-bite, 12 murk, 15 corrode, 22 echo-drain, 29 iron-pin, 36 stand-firm, 40 drowned-bell, 43 shellguard, 50 hullburst | gnash, sandtrap, plumbline, live-wire |
| Hulkwight | 1 tap, 1 snuff, 1 rust-bite, 8 corrode, 15 murk, 22 echo-drain, 24 stand-firm, 28 drowned-bell, 29 iron-pin, 34 hush, 50 shellguard, 56 hullburst | gnash, sandtrap, cairn-crash, plumbline, live-wire |
| Wirewhisk | 1 tap, 1 arc-ping, 3 fizz, 6 jolt, 12 static-net, 18 updraft, 24 shell-rattle, 30 mirror-step, 36 gale-cut | live-wire, shardlight, plumbline, flashover |
| Coilcrest | 1 arc-ping, 1 fizz, 1 downdraft, 8 jolt, 14 static-net, 18 updraft, 20 gale-cut, 30 live-wire, 40 bandlight, 44 mirror-step | shardlight, plumbline, flashover |
| Chillnub | 1 tap, 1 frost-nip, 8 settle, 14 shard-fling, 17 floe-ram, 20 plate-toss, 26 rime-lock, 32 hoarfrost | sandtrap, stand-firm, plumbline |
| Rimeplate | 1 tap, 1 frost-nip, 8 shard-fling, 14 plate-toss, 17 floe-ram, 20 stand-firm, 26 hoarfrost, 32 rime-lock, 38 sandtrap, 44 bedrock-charge | cairn-crash, plumbline |
| Floeback | 1 tap, 1 frost-nip, 1 plate-toss, 8 shard-fling, 17 floe-ram, 20 stand-firm, 26 hoarfrost, 32 rime-lock, 38 cairn-crash, 44 sandtrap, 50 bedrock-charge | gnash, plumbline |
| Sootling | 1 tap, 1 ember-lick, 8 scorch, 14 settle, 20 slag-burst, 26 kiln-maw, 32 flashover | sandtrap, stand-firm, gnash, plumbline |
| Emberjaw | 1 tap, 1 ember-lick, 1 kiln-maw, 8 scorch, 14 knuckle, 20 slag-burst, 26 stand-firm, 32 flashover, 38 grind-down, 44 cairn-crash | gnash, sandtrap, plumbline |
| Caldermaw | 1 ember-lick, 1 shard-fling, 5 kiln-maw, 12 scorch, 20 slag-burst, 28 stand-firm, 36 grind-down, 40 flashover, 44 bedrock-charge, 52 hullburst | cairn-crash, sandtrap, gnash, plumbline |
| Rillfin | 1 tap, 1 salt-spray, 4 downdraft, 7 breaker, 10 shellguard, 12 settle, 18 reed-whip, 24 riptide, 30 tidal-mend | hoarfrost, gale-cut, stand-firm, plumbline |
| Gillwick | 1 tap, 1 salt-spray, 1 breaker, 8 reed-whip, 14 root-knot, 20 mire-bloom, 26 riptide, 30 tidal-mend, 32 spore-drift, 44 reap | hoarfrost, stand-firm, gale-cut, plumbline |
| Strandrunner | 1 tap, 1 breaker, 1 downdraft, 8 salt-spray, 14 gale-cut, 20 updraft, 26 floe-ram, 32 riptide, 38 skein-sweep, 44 pummel, 50 tidal-mend | live-wire, gnash, hoarfrost, plumbline |
| Tossup | 1 tap, 1 sure-pinch, 7 settle, 13 shell-rattle, 19 shellguard, 25 knuckle, 31 rust-bite, 37 shardlight | spore-drift, sandtrap, flashover, cairn-crash, hoarfrost, drowned-bell, shardlight, live-wire, gale-cut, stand-firm, gnash, plumbline |
| Squallcoil | 1 jolt, 1 salt-spray, 12 bandlight, 18 static-net, 25 riptide, 35 updraft, 45 live-wire, 55 hullburst, 65 gale-cut | hoarfrost, drowned-bell, plumbline |
| Hailcoil | 1 frost-nip, 1 gale-cut, 12 floe-ram, 18 rime-lock, 25 hoarfrost, 35 updraft, 45 skein-sweep, 55 cairn-crash, 65 downdraft | drowned-bell, gnash, plumbline |
| Skirl | 1 tap, 1 downdraft, 5 updraft, 10 gale-cut, 16 mirror-step, 22 murk, 28 skein-sweep, 34 pummel | plumbline, drowned-bell, gnash |
| Duskwisp | 1 tap, 1 murk, 6 hush, 11 dust-veil, 16 echo-drain, 22 mirror-step, 28 drowned-bell, 34 snuff | spore-drift, shardlight, gnash, plumbline, flashover |
| Duskowl | 1 tap, 1 murk, 1 downdraft, 8 hush, 14 gale-cut, 20 echo-drain, 26 updraft, 32 drowned-bell, 38 skein-sweep, 44 snuff | gnash, shardlight, plumbline, flashover |
| Stillox | 1 tap, 1 shard-fling, 10 stand-firm, 20 grind-down, 28 bedrock-charge, 34 sandtrap, 42 cairn-crash, 50 iron-pin, 60 hullburst | gnash, plumbline |
| Vagary | 1 starfall, 1 tailfall, 20 shardlight, 30 hoarfrost, 40 riptide, 50 kiln-maw, 60 bandlight, 70 echo-drain | — |

## 8. Sprite briefs (20 undrawn forms)

All briefs follow the creature rules in `proto/creatures/sprites.js` and GDD-00 §14. Each sprite is a **32×32 cell, left-front 3/4 view, ≤ 8 master keys plus `m` and a highlight**, with two front frames and one back. It must pass the silhouette test (filled solid `k`, it still reads as itself), and comet magenta `m` appears only in the runtime Heartmark. The Heartmark anchors are front-sprite pixels: the art must keep each anchor on a body pixel, and the 3 px plus must fit (the validator rejects a mark outside opaque bounds). The back view mirrors the front, with the face filled back in with hide, and moves chest anchors to the nape, as the prototype does.

### Knuckleback (`knuckleback`): Grit, stage 2

- **Silhouette:** An upright brawler a head taller than Scrapling: broad shoulders, short legs, fists raised in the same guard, spine ridge of knuckle-plates breaking the back outline in four bumps.
- **Spot-able feature:** a ridge of knuckle-shaped bone plates down the spine; the red badge patch grown to a sash.
- **Palette keys** `kahuwvre`: `a` fur, `h` shade, `u` wraps and plate shadow, `w` wrap highlight, `v` sailcloth, `r` badge-sash, `e` plate edges, `k` outline. Heartmark centre `y`.
- **Size in the 32×32 cell:** 26×27, standing; feet on row 29.
- **Heartmark anchors:** head (12,8) · chest (13,18) · back (20,14) · tail (23,26).
- **Continuity:** Scrapling's torn ear and red badge (now a sash) carry over so a Shifted Scrapling reads as itself.
- **Must not read as:** a muscled four-armed wrestler; a pangolin.
- **Idle motion:** squash-breathe at row 26; the raised fists bob 1 px on the second frame.

### Cragmitt (`cragmitt`): Grit/Stone, stage 3

- **Silhouette:** A squat Scrapling-line brawler whose two quarry-stone mitts are bigger than its head; the mitts make a wide base, the head sits low between the shoulders, the outline is all corners.
- **Spot-able feature:** two quarry-stone mitts bigger than its head, bound on with frayed net cord.
- **Palette keys** `kahuevdr`: `a` fur, `h` shade, `u` net-cord bindings, `e` stone, `v` stone light, `d` stone dark, `r` badge, `k` outline. Heartmark centre `y`.
- **Size in the 32×32 cell:** 30×27, crouched; mitts reach rows 18–28.
- **Heartmark anchors:** head (11,8) · chest (12,17) · back (21,10) · tail (25,24).
- **Continuity:** The red badge and the torn ear; the net-cord bindings echo the sailcloth wraps.
- **Must not read as:** a rock golem with boulder fists; a gorilla.
- **Idle motion:** squash-breathe at row 27; one mitt lifts 1 px and drops on the second frame.

### Reedkit (`reedkit`): Moss, stage 1

- **Silhouette:** A small fox-kit body, low to the ground, nose left; the tail is a bundle of reed heads held up and back like a brush, as tall as the body. One ear folded.
- **Spot-able feature:** a bushy tail of bundled reed heads held up like a brush; one ear always folded.
- **Palette keys** `klgtauwy`: `l` reed light, `g` body, `t` shade, `a` belly and muzzle, `u` reed-head tips, `w` eye glint, `y` reed-head highlight, `k` outline. Heartmark centre `w`.
- **Size in the 32×32 cell:** 25×20, low and long; tail up to row 7.
- **Heartmark anchors:** head (9,12) · chest (10,20) · back (17,15) · tail (24,14).
- **Continuity:** Reed-whip green and the folded ear are its tells; Sedgehare inherits the folded-ear notch on one blade.
- **Must not read as:** a leaf-tailed fox starter; a green rabbit mascot.
- **Idle motion:** squash-breathe at row 27; the reed tail sways 1 px right on the second frame.

### Mothling (`mothling`): Glass, stage 1

- **Silhouette:** A round fuzzy moth body with a thick collar of dust and two short folded wings angled up and back like a closed book; two feathered antennae.
- **Spot-able feature:** a fuzzy collar of skyglass dust and two folded wings with one clear window each.
- **Palette keys** `kdivwyn`: `d` fuzz dark, `n` fuzz shade, `v` collar, `w` collar light, `i` wing windows, `y` belly, `k` outline (Glass cool body: `w` Heartmark centre). Heartmark centre `w`.
- **Size in the 32×32 cell:** 22×20, floating; centred at x 15.
- **Heartmark anchors:** head (12,11) · chest (13,16) · back (18,13) · tail (15,22).
- **Continuity:** The single clear window in each wing becomes Prismoth's three bands.
- **Must not read as:** a fuzzy bug-eyed moth larva mascot; a butterfly.
- **Idle motion:** hover-bob; wings open 1 px on the second frame.

### Cairnward (`cairnward`): Stone/Glass, stage 2

- **Silhouette:** Three rounded stones stacked into a cairn, narrowing upward, on four thin moth legs; the top stone holds one round skyglass lamp-eye. A sprig of lichen on the middle stone.
- **Spot-able feature:** a three-stone cairn on moth legs with a skyglass lamp-eye set in the top stone.
- **Palette keys** `kevdiwtn`: `e` stone, `v` stone light, `d` stone dark, `i` lamp-eye, `w` eye glint, `t` lichen, `n` leg shade, `k` outline. Heartmark centre `w`.
- **Size in the 32×32 cell:** 24×30, tall; three stones stacked.
- **Heartmark anchors:** head (14,6) · chest (13,17) · back (19,12) · tail (19,25).
- **Continuity:** Ward shimmer plays over the stones like Prismoth's; the lamp-eye reads as the Glass half.
- **Must not read as:** a stacked-boulder rock golem; a stone lantern spirit.
- **Idle motion:** squash-breathe at row 28; the lamp-eye brightens one ramp step (i→w centre) on the second frame.

### Rayling (`rayling`): Brine, stage 1

- **Silhouette:** A small diamond-shaped ray seen from the front-left, wings tipped up, a long thin tail trailing right; one round glass freckle on the back.
- **Spot-able feature:** a small dusk ray with one round glass freckle on its back where the eye panel will be.
- **Palette keys** `knbsiwp`: `b` body, `s` light edge, `n` belly shade, `i` glass freckle, `w` eye glint, `p` tail tip, `k` outline. Heartmark centre `w`.
- **Size in the 32×32 cell:** 28×16, gliding; wingtips at rows 13–20.
- **Heartmark anchors:** head (8,15) · chest (11,19) · back (15,13) · tail (26,20).
- **Continuity:** The glass freckle sits exactly where Vesperay's eye panel will be.
- **Must not read as:** a manta-ray mascot; a flying stingray kite.
- **Idle motion:** hover-bob; wingtips curl 1 px on the second frame.

### Bilgebob (`bilgebob`): Brine, stage 1

- **Silhouette:** A barrel-round whale floating low, the lower third under a flat painted waterline, a small blunt head on the left with a lazy half-closed eye, a tiny tail fluke raised at the right. No spout.
- **Spot-able feature:** a barrel-round harbour whale with a painted-looking waterline and a cork-float freckle on each cheek.
- **Palette keys** `knbsvwy`: `b` body, `s` light, `n` belly, `v` waterline paint, `w` eye glint, `y` cork-float freckles, `k` outline. Heartmark centre `w`.
- **Size in the 32×32 cell:** 28×22, floating; waterline at row 22.
- **Heartmark anchors:** head (9,13) · chest (11,20) · back (17,10) · tail (26,15).
- **Continuity:** The cork-float freckles stay on every Bilgebob and on its Star-touched palette.
- **Must not read as:** a round blue cartoon whale with a water spout; a beach-ball whale; a small round baby whale with a spout.
- **Idle motion:** hover-bob in place on the waterline (1 px), never leaves it.

### Rustcreel (`rustcreel`): Rust, stage 1

- **Silhouette:** A crab wearing a rusted lobster-pot as its shell: a box of iron bars over the back, one claw much bigger than the other held in front, a frayed buoy line trailing to the right.
- **Spot-able feature:** a crab wearing a rusted lobster-pot as a shell, one claw much bigger, a frayed buoy line trailing behind.
- **Palette keys** `kroedvy`: `r` rust, `o` rust light, `e` iron, `d` iron dark, `v` rope, `y` eye glint, `k` outline (warm body: `y` Heartmark centre). Heartmark centre `y`.
- **Size in the 32×32 cell:** 24×20, low; claws at rows 15–24.
- **Heartmark anchors:** head (11,15) · chest (12,21) · back (17,13) · tail (23,20).
- **Continuity:** The pot's bars become Creelwight's creel; keep the bar rhythm three wide.
- **Must not read as:** a hermit crab in a shell; a crab with a giant claw.
- **Idle motion:** squash-breathe at row 26; the big claw opens 1 px on the second frame.

### Hulkwight (`hulkwight`): Hollow/Rust, stage 3

- **Silhouette:** The bow section of a small fishing boat stood on end and leaning left, ribs showing through broken planks, two lights low in the hold, a nameboard on the bow nobody can read. Fills the cell.
- **Spot-able feature:** the bow section of a lost fleet boat, ribs showing, two lights low in the hold; a nameboard nobody can read.
- **Palette keys** `kdproeiv`: `d` hull dark, `p` hollow shade, `r` rust, `o` rust light, `e` planks, `i` hold lights, `v` rope, `k` outline. Heartmark centre `w`.
- **Size in the 32×32 cell:** 32×28, the bow of a boat; floats.
- **Heartmark anchors:** head (10,9) · chest (11,19) · back (20,8) · tail (28,18).
- **Continuity:** The rope ring of Empty Weave circles the hull as on Creelwight.
- **Must not read as:** a ghost pirate ship; a shipwreck boss monster.
- **Idle motion:** hover-bob; the two hold lights dim and return on the second frame.

### Coilcrest (`coilcrest`): Bolt/Gust, stage 2

- **Silhouette:** A ferret-like body on spread wire-ribbed gliding flaps, head left with a crest of three copper coils rising like a comb; a long coiled tail.
- **Spot-able feature:** a crest of three copper coils that spark in turn, and wide wire-ribbed gliding flaps.
- **Palette keys** `kyahorws`: `y` body, `a` belly, `h` shade, `o` copper coils, `r` coil shade, `w` spark, `s` flap membrane, `k` outline (warm body: `y` centre). Heartmark centre `y`.
- **Size in the 32×32 cell:** 28×30, gliding; crest to row 2.
- **Heartmark anchors:** head (9,8) · chest (10,17) · back (18,13) · tail (26,10).
- **Continuity:** Wirewhisk's spring-coil tail is kept whole; the crest is new.
- **Must not read as:** a thunderbird; a flying squirrel.
- **Idle motion:** hover-bob; one crest coil sparks (`w` pixel) per frame, left to right.

### Floeback (`floeback`): Rime/Stone, stage 3

- **Silhouette:** A long low body under one flat ice floe that overhangs on every side, a small stone head poking out left, stumpy legs; a little fir-tree of frost growing on the floe's top right.
- **Spot-able feature:** a low, wide body under a single ice floe with a small fir-tree of frost growing on top.
- **Palette keys** `kwisbned`: `w` floe light, `i` floe, `s` floe shade, `b` body, `n` body shade, `e` stone, `d` stone dark, `k` outline. Heartmark centre `w`.
- **Size in the 32×32 cell:** 32×24, very low and wide.
- **Heartmark anchors:** head (5,17) · chest (7,22) · back (17,10) · tail (29,19).
- **Continuity:** One plate edge of Rimeplate shows at the floe rim; Plateshed knocks a chunk off it.
- **Must not read as:** an island-backed sea turtle; an ice-shelled tortoise.
- **Idle motion:** squash-breathe at row 27; the frost tree drops one sparkle pixel on the second frame.

### Sootling (`sootling`): Kiln, stage 1

- **Silhouette:** A palm-sized grub, four segments, head left and slightly raised, soot-dark husk with glowing seams between the segments. Small in the cell on purpose: it should look like it fits in a pocket.
- **Spot-able feature:** a palm-sized ember grub in a soot-dark husk with glowing seams, like a coal that learned to crawl.
- **Palette keys** `koyrdhu`: `d` husk, `k` outline, `o` seam glow, `y` hot seam, `r` seam shade, `h` underside, `u` husk shade (warm: `y` centre). Heartmark centre `y`.
- **Size in the 32×32 cell:** 20×12, tiny; sits on row 26.
- **Heartmark anchors:** head (9,22) · chest (11,25) · back (15,20) · tail (22,24).
- **Continuity:** The seam glow becomes Emberjaw's grate and Caldermaw's lava cracks.
- **Must not read as:** a fire caterpillar; a lava slug.
- **Idle motion:** squash-breathe at row 26; the seams brighten one step on the second frame.

### Emberjaw (`emberjaw`): Kiln, stage 2

- **Silhouette:** A long low lizard, head left; the lower jaw is a hinged kiln door with a grate, glowing from behind. Heavy forelegs, a thick tail.
- **Spot-able feature:** a long low lizard whose lower jaw is a hinged kiln door with a glow behind the grate.
- **Palette keys** `koryedvw`: `e` hide, `d` hide shade, `v` hide light, `o` glow, `y` hot glow, `r` glow shade, `w` eye glint, `k` outline. Heartmark centre `y`.
- **Size in the 32×32 cell:** 28×22, long and low.
- **Heartmark anchors:** head (8,13) · chest (10,20) · back (18,12) · tail (27,19).
- **Continuity:** The grate glow reads as Sootling's seams grown up.
- **Must not read as:** a fire-tailed lizard starter; a salamander with a flame tail.
- **Idle motion:** squash-breathe at row 27; the jaw-door opens 1 px and the glow shows on the second frame.

### Rillfin (`rillfin`): Brine, stage 1

- **Silhouette:** A small upright fish standing on two front fins like elbows, tail curled under, a tall dorsal fin raised like a little sail.
- **Spot-able feature:** a little hopping fish with two front fins like elbows and a tall dorsal fin it raises when pleased.
- **Palette keys** `kbsnwoy`: `b` body, `s` belly, `n` back, `w` eye, `o` fin rays, `y` fin tips, `k` outline. Heartmark centre `w`.
- **Size in the 32×32 cell:** 22×20, hopping; on row 27.
- **Heartmark anchors:** head (10,14) · chest (11,20) · back (16,13) · tail (23,17).
- **Continuity:** The dorsal fin is the line's tell: Gillwick and Strandrunner keep it.
- **Must not read as:** a flopping orange carp; a walking goldfish.
- **Idle motion:** squash-breathe at row 27; the dorsal fin rises 1 px on the second frame (it is pleased).

### Gillwick (`gillwick`): Brine/Moss, stage 2

- **Silhouette:** A sturdier Rillfin on four short legs, head left, with feathery green weed-gills floating up around the head like a flame on a wick; a small gill-pouch at the throat.
- **Spot-able feature:** feathery green weed-gills that float around its head like a wick's flame; it carries water on land in a gill-pouch.
- **Palette keys** `kbsngltw`: `b` body, `s` belly, `n` back, `g` weed-gills, `l` gill light, `t` gill shade, `w` eye glint, `k` outline. Heartmark centre `w`.
- **Size in the 32×32 cell:** 26×24, standing.
- **Heartmark anchors:** head (9,10) · chest (10,18) · back (17,13) · tail (26,19).
- **Continuity:** Rillfin's raised dorsal fin; Wick's pack straps are a trainer prop, not part of the sprite.
- **Must not read as:** a pink frilled axolotl; a seaweed-haired mermaid creature.
- **Idle motion:** squash-breathe at row 27; the weed-gills drift 1 px up on the second frame.

### Strandrunner (`strandrunner`): Brine/Gust, stage 3

- **Silhouette:** A runner on long stilt legs with webbed toes, body tilted forward, head left on a short neck, fins swept back like a running sail.
- **Spot-able feature:** long stilt legs with webbed toes, fins swept back like a running sail; leaves a double line of prints at the waterline.
- **Palette keys** `kbsnwvoa`: `b` body, `s` light, `n` shade, `w` belly, `v` legs, `o` fin rays, `a` toe webs, `k` outline. Heartmark centre `w`.
- **Size in the 32×32 cell:** 28×30, tall on stilt legs.
- **Heartmark anchors:** head (8,6) · chest (10,15) · back (17,12) · tail (25,13).
- **Continuity:** The swept fins are Rillfin's dorsal fin grown into sails.
- **Must not read as:** a long-legged wading heron; a running ostrich.
- **Idle motion:** squash-breathe at row 29; one foot lifts 1 px on the second frame.

### Hailcoil (`hailcoil`): Rime/Gust, stage 4

- **Silhouette:** A frost krait in three loose coils (head top-left, neck, two lower loops), frilled fin-wings off the neck; pale bands with hailstones visible inside them.
- **Spot-able feature:** a frost krait in three loose coils with frilled fin-wings; hailstones rattle inside its pale bands.
- **Palette keys** `knsiwvbe`: `s` body, `n` shade, `i` bands, `w` hail pixels, `v` belly, `b` deep shade, `e` frill ribs, `k` outline. Heartmark centre `w`.
- **Size in the 32×32 cell:** 32×30, three coils; mirrors Squallcoil's layout.
- **Heartmark anchors:** head (6,5) · chest (10,14) · back (20,19) · tail (27,25).
- **Continuity:** Same coil grammar as Squallcoil, so the pair reads as one kind; never the same colours.
- **Must not read as:** an ice dragon; a winged sea serpent.
- **Idle motion:** hover-bob; one band's hail pixels shift 1 px per frame, top to bottom.

### Skirl (`skirl`): Gust, stage 1

- **Silhouette:** A small swift: sickle wings swept back, a short body, one long tail streamer trailing right and down.
- **Spot-able feature:** a small swift with one long tail streamer that whistles when it dives.
- **Palette keys** `kwvsbny`: `w` belly, `v` wing light, `s` wing, `b` back, `n` shade, `y` eye and beak, `k` outline (white body: `y` centre). Heartmark centre `y`.
- **Size in the 32×32 cell:** 24×20, flying.
- **Heartmark anchors:** head (9,11) · chest (10,17) · back (16,12) · tail (22,18).
- **Continuity:** The streamer becomes Duskowl's long tail feathers.
- **Must not read as:** a round blue songbird; a cartoon swallow.
- **Idle motion:** hover-bob; the tail streamer flicks 1 px on the second frame.

### Duskwisp (`duskwisp`): Hollow, stage 1

- **Silhouette:** An owlet made of smoke: a round head with two big amber eyes and no hard edge below, the body trailing off into a thin wisp like a snuffed wick.
- **Spot-able feature:** an owlet of smoke with two round amber eyes and no edges, trailing off below like a snuffed wick.
- **Palette keys** `kpndyiw`: `p` body, `n` shade, `d` wisp tail, `y` eyes, `i` eye shine, `w` glint, `k` outline (sparing: the lower wisp has no outline). Heartmark centre `w`.
- **Size in the 32×32 cell:** 20×22, floating.
- **Heartmark anchors:** head (14,11) · chest (14,18) · back (18,14) · tail (15,25).
- **Continuity:** The amber eyes are kept on Duskowl.
- **Must not read as:** a ghost blob with a tongue; a will-o'-wisp flame.
- **Idle motion:** hover-bob; the wisp tail sways 1 px on the second frame.

### Duskowl (`duskowl`): Hollow/Gust, stage 2

- **Silhouette:** A tall night owl, ear tufts up, wings folded; the facial disc is an empty ring of dusk (open in the middle), with an amber glint in each eye.
- **Spot-able feature:** a tall night owl whose facial disc is an empty ring of dusk, with a lantern-amber glint in each eye.
- **Palette keys** `kpndveyw`: `p` plumage, `n` shade, `d` wing dark, `v` facial ring, `e` breast bars, `y` eyes, `w` glint, `k` outline. Heartmark centre `w`.
- **Size in the 32×32 cell:** 26×30, perched upright.
- **Heartmark anchors:** head (13,7) · chest (13,17) · back (19,12) · tail (20,27).
- **Continuity:** Duskwisp's amber eyes; Skirl's streamer as two long tail feathers.
- **Must not read as:** a tawny owl with a book; a top-hatted owl.
- **Idle motion:** hover-bob from the perch (1 px); the head turns 1 px left on the second frame.

## 9. Integration notes for other lanes

These are things this chapter's data depends on but cannot change itself. None of them blocks the tables, which validate green today.

1. **`tuning.wardCount` must become 3** (`js/data/tuning.js`, GDD-02). It is 0 today, so once `index.js` imports these abilities the validator will report `3 Ward abilities, tuning.wardCount is 0`. The test passes `wardCount: 3`.
2. **Star-touched on the current form** (`systems/forecast`, RULES-SHIFT). Star-touched forms are palette variants of a species id (GDD-ids ruling 5), and `family.star` names that id. `forecast.js` refuses a star card when `star === c.speciesId`, so a Sloshkin can never see Star-touched Sloshkin, which is the source's headline example. The forecast should allow the star card for the current form and mark it `isStarTouched`. The data needs no change.
3. **Disc teaching** (`systems/creature.canLearn`, `systems/shops` learner strips). Discs teach the moves in `flags.teachable` as well as the learnset. `species/index.canBeTaught(row, moveId)` is the rule. Until the systems read it, only learnset learners count, and GDD-00 §8's "≥ 25% learners per disc" fails for 11 of the 12 discs (only Stand Firm has 11 learnset learners).
4. **Dusksight at night** (battle flow). Build the ability runtime from `row.nightHook` when the battle starts under night rules (§3).
5. **Heartmark anchors** (`systems/creature.drawMark`, `art/heartmark`). Each creature should roll one of `flags.heartmarkAnchors` from stream `heartmark:<uid>` (GDD-00 §14) and keep the *key* (`head`/`chest`/`back`/`tail`) through every Shift, so the mark lands on the same body part in each form. Today `drawMark` draws an offset around a single point.
6. **The 22 drawn sprites move to `art/creatures/<family>.js` keyed by form id** (ARCHITECTURE §8.4). Their palettes match `flags.palette` exactly. Siltback's sprite was drawn for the prototype's 375 total; the 430 rework changes no art.
7. **Linnet's dock Shift** (Sootling ⇒ Caldermaw, Up 100%) and her market-fair Down Shift are scripted boss Shifts with posted strips (GDD-07/GDD-04). They are deliberately not in the Caldermaw table.
8. **Encounter levels** (GDD-01). Catch rates and learn levels assume GDD-00 §4's isle levels: Lowmoor 3–8, Cairnhold 9–14, Emberstep 15–20, Drownwood 22–27, Thistlewind 29–34, Rimeholt 36–41. Squallcoil learns Bandlight at 12 and Stillox learns Bedrock Charge at 28, so their tells show where they live.

## 10. Manifest requests

None. Every id this chapter needed was in `ids.manifest.js` (13 types, 16 families, 42 species, 25 abilities, and move ids from `MOVE_IDS`). No id was invented for a table the manifest covers.
