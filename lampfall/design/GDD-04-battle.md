# GDD-04 — BATTLE

Owner chapter for techniques, trainer rosters, the six Spires, the Long Road, the Summit and the Reading. GDD-00 wins wherever this file disagrees with it; ids are GDD-ids' and nothing here renames one.

> **As built (2026-10-28).** This chapter now describes the shipped rules: the EXP curve steepens from Lv9 (§1.3), posted boss Shifts, the Relay rounds, the Ward sentinels, the Summit Bell and the +5 PP top-up run in the game itself (§1.4, §4, §5), the Reading builds its phases from `THE_READING` (§6), and §7.1 holds the latest simulation numbers. Open items are listed in §9.

**Files** (all pure data, frozen exports):

| File | Exports | Wire into |
|---|---|---|
| `js/data/moves/index.js` (+ `_helpers.js`, one file per type: `plain` `grit` `brine` `kiln` `moss` `bolt` `rime` `gust` `stone` `rust` `glass` `hollow` `star` `typeless`) | `MOVES` (65 rows), `MOVE_BY_ID`, `SCRAP` | `DATA.moves` |
| `js/data/trainers.js` | `TRAINERS` (65), `TRAINER_BY_ID`, `TRAINER_SCRIPTS` (178 before/win/loss scripts), `ROUTE_TRAINERS`, `PAYOUT_RULES`, `HEAL_CAP`, `WARD_FORMS` | `DATA.trainers`; merge `TRAINER_SCRIPTS` into `DATA.scripts` |
| `js/data/spires.js` | `SPIRES` (6), `SPIRE_BY_ID`, `LONG_ROAD`, `SUMMIT`, `SUMMIT_BELL`, `THE_READING`, `WEATHER_KINDS`, `BOSS_SHIFT_ODDS` | a new `DATA.spires` table (ids = `UNMAPPED.spires`); the rest are imported by the battle flow |
| `test/data.battle.test.mjs` | self-validation | — |

---

## 1. Rules sheet

Singles only. Every number below is GDD-00 §8 unless marked; the engine (`js/battle/*`) holds each in a `DEFAULTS` table and the flow passes overrides as `tuning` (see §9 for the deltas the flow must pass).

### 1.1 Damage

```
base   = floor( floor(2·L/5 + 2) · Power · A / max(1, D) / 50 ) + 2
damage = max(1, floor( base · type · roll · STAB · crit · burn · ability ))
```

- `L` attacker level; `A`/`D` the attacking/defending stat after stages (Attack/Defence for physical, Sp. Attack/Sp. Defence for special).
- **Stages:** +1 ×1.5, +2 ×2 … (`(2+s)/2`); −1 ×0.67, −2 ×0.5 (`2/(2−s)`); every stat caps at ±6 except **evasion, which caps at +2** (accuracy ×0.83 at +1, ×0.67 at +2).
- **type:** chart product over the defender's types, 0 / 0.5 / 1 / 2 each (dual types multiply; ×4 still reads *Strong*). **Hollow is the only immunity: Plain and Grit do nothing to it.** Star is neutral both ways.
- **roll** uniform 0.85–1.0. **STAB** ×1.5. **crit** ×1.5 at stage rates 1/16, 1/8, 1/4, 1/3, 1/2 (Reap +1; Keen Glint +2; Whetstone +1). **burn** ×0.5 on physical hits.
- **Words, never colours:** Strong / Neutral / Weak / Blocked (and *Blocked by Ward*, *No effect*) on every move button before you pick.
- **Status** (one major at a time): burn (1/16 chip, physical ×0.5), poison (1/8 chip), chill (skip 50%, 1–2 turns), numb (Speed ×0.5, skip 25%); **trap** is volatile (1/8 chip, no switching, 4 turns). Chip is indirect: **every Ward lets chip through** (Mirrorveil only lets through poison or burn that rides on a damaging hit, since the status move itself fails).
- **Mends:** 3 per creature per battle; each recovery move or heal item spends one; at 0, healing fails with a word. Drains (Echo Drain, Mire Bloom) are not Mends.
- **PP:** 0-PP moves cannot be selected. When every move is empty the creature uses **Scrap** (50, typeless, never misses, 1/8 max HP recoil even when a Ward blocks it, never pierces a Ward).
- **Plumbline:** status, sure hit, clears all of the target's stages and blocks boosting for 2 turns; **ignores every Ward, Mirrorveil included** (GDD-00 ruling).
- **Wards** (four forms only: Prismoth *Glasshide* = only Strong hits land; Cairnward and Chillnub *Stillcoat* = hits under 50 power do nothing; Lumenveil *Mirrorveil* = status moves fail). Lattice shimmer every 4 s and a *Ward ?* badge; the readout after a block names every party move that lands and every chip move; **Crackdust** suppresses a Ward for 3 full turns after the throw and is refused (and kept) against a creature with no active Ward.
- **Capture Stance** (wild only, no slot): nothing from your side, chip included, can drop the target below 1 HP.

### 1.2 Capture

```
odds = clamp( catchRate/255 · (3·maxHP − 2·HP)/(3·maxHP) · wick · status  +  min(0.15, 0.03·fails),  0.01, 0.95 )
```

- wick: Tallow ×1, Brass ×1.5, Skyglass ×2; status: chill/numb/trap ×1.5, burn/poison ×1.25.
- **Odds shown = odds rolled** (stream `capture:<battleId>:<attempt>`); +3% per failed attempt on the same creature, capped +15%; displayed odds clamp 1–95% except the scripted starter draw and Isolde's Lantern (100%). Freefall shows bands *Slim / Fair / Good / Sure*.
- Errants open near 22% with a Tallow wick at full HP (GDD-00 §8). With the formula above that means a catch rate near 168 (full HP gives the 1/3 HP factor); the prototype's 3 would show 1%. GDD-03 owns the row; flagged in §9.

### 1.3 EXP and money

```
EXP to reach level L (cumulative) = 8 · L²                 for L ≤ 8
                                  = (3 · L³ − 512) / 2     for L ≥ 9   (joins at 512)
KO EXP   = floor(expYield · foeLevel / 5)          ×1.5 in trainer battles
capture  = the KO EXP;   dock hold-out = flat 100 (paid however the hold-out ends)
```

Why the curve steps (fix wave 1, MID-06): under 8·L² a level costs 16·L while a KO pays yield × L / 5, so every KO was worth the same share of a level at any level (about 2.8 levels per trainer KO of a yield-150 form) and parties reached Lv89 by the Mirror Spire. From Lv9 a level costs about 4.5·L², so parties settle near the posted curve (§7.1). Night one is unchanged: Lv5 = 200, Lv7 = 392, Lv8 = 512. The curve lives in `js/data/tuning.js` `GROWTH_CURVES`; save v6 rebased old saves onto it.

- **Who earns a KO** (final fix pass): the engine records who was standing at each foe's KO and pays them at the end, so a creature that scores a KO and faints later still earns it, and a loss or a draw still pays the KOs scored before it. Fainted creatures stay at 0 HP while gaining EXP. Relay sitters are passed as bench and get the bench share.

- Battlers 100%, the rest of the party 60%; Training Yard 25% to 3 stored creatures; Big Sibling +30% to the lowest party member; **catch-up** +50% per 5 levels under the posted curve, cap ×3; Porch Duel EXP ×0.5 past curve + 10 (engine source `rematch`), never damped elsewhere.
- **Payouts:** route trainers, rivals and the Long Road **50 × highest level** (Pip 200; Hettie 1,350); Spire leaders **200 × ace + 3 Starsalt** (2,000 / 3,200 / 4,400 / 5,800 / 7,200 / 8,600) plus the **Spire share** (10% of the open loan, notched on Wren's ledger); Keepers 200 × ace (9,200 / 9,600); Champion 10,000 + the Summit seal; Porch Duels 30 × curve (flow sets it); story set pieces, friends and Corin's exhibitions pay nothing and cost nothing. Lucky Button +50% applies on top.
- **Blackout** (route, Spire and Long Road losses only): 10% of buttons on hand, capped 1,500, nothing under 500; half goes to the Keeper's Purse. Story battles, the Summit, Porch Duels and exhibitions never cost anything.
- Check: Linnet's dock (100) + the Tossup catch (40) + Pip's Tossup (30) and Wirewhisk (66) carry a Lv5 starter (200) to 436, past Lv7 (392) and under Lv8 (512), on night one. Pip fields **Tossup Lv2 (Tap) then Wirewhisk Lv4** (fix wave 2), so the first trainer takes 3–4 turns and a Read pays; the Lv8 window still opens on day 2.
- **Story battles leave the party healed** afterwards (the dock hold-out, Linnet's fights, the Engine, the Reading), so a hold-out loss never sends the player into the reeds or to Pip on low HP.
- **Catches:** every caught creature joins with at least one damaging move (`creature.ensureDamagingMove`); the reeds Tossup fights with Settle only but joins with its learnset moves.

### 1.4 Posted boss Shifts

The player's creatures never Shift in battle. A trainer's creature with a `bossShift` posts its Forecast strip at the end of its `postAt`-th turn on the field and Shifts at the end of its `shiftAt`-th (Linnet's dock Sootling: 0/0, it Shifts as it enters). Cards are either one sure card (strip reads 100% on every dial) or three cards at the dial's base odds (Drift 50/40/10, Flux 40/35/25, Freefall 30/30/40; steadied after the Relighting to 50/45/5, 40/40/20, 30/35/35), rolled on `bossShift:<trainerId>:<slot>`. The new form keeps level, HP fraction, moves, nickname and held item; its stats, types and ability change. Read refreshes for free.

**As built (fix wave 1, MID-04).** The engine (`js/battle/engine.js`, events `shift-posted` and `boss-shift`) posts and lands these Shifts; 8 trainers in the data have a posted Shift (Maud, Linnet's dock Caldermaw, Wick's Skipper, Marl, Varga and Corin's three exhibitions). The battle screen draws the strip under the foe's box only while that creature stands on the field, brings it back if the creature returns, and removes it when the Shift lands or the creature faints first; the sprite changes only when the Shift animation plays. A Shifted creature's Ward badge is re-checked. After the Relighting the dial odds are the steadied ones.

---

## 2. Techniques (65)

The 54 prototype rows keep their ids, numbers, effects and text, with two text edits: **Skein Sweep** no longer mentions doubles (it keeps the `spread` rule: it pops every decoy even on a miss) and **Plumbline** states the Mirrorveil ruling. Each ordinary type has four non-signature techniques except Glass (three, with Starfall as its fourth); 15 signatures, Plumbline, and Scrap (no slot).

| Type | Techniques (power/acc/PP; `sig` = signature) |
|---|---|
| Plain | Tap 40/100/35 · Sure Pinch 40/—/20 sig Tossup · Shell Rattle 55/100/25 · Settle (Def+SpD +1) · Shellguard (guard, priority 4) |
| Grit | Knuckle 60/100/25 · Grind Down 85/90/15 · Pummel 20×2–5 · Sand Smother (Atk −1) |
| Brine | Undertow 65/100/15 sig Sloshkin (Spe −1) · Salt Spray 50/100/25 · Riptide 90/85/10 · Tidal Mend (50%, a Mend) · **Breaker 75/95/15** (contact) |
| Kiln | Ember Lick 45 (10% burn) · Kiln Maw 75 sig Caldermaw · Scorch (burn, 85) · Slag Burst 80 (20% burn) · **Flashover 100/90/5** (user SpA −1; the 2,500 "Kiln disc") |
| Moss | Reed Whip 50 · Reap 70 sig Sedgehare (high crit) · Root Knot (trap) · Spore Drift (poison; the badge-1 chip disc) · **Mire Bloom 80/100/10** (drain 1/4, not a Mend) |
| Bolt | Arc Ping 30 sig Wirewhisk (priority 1, reveals moves) · Jolt 65 (10% numb) · Bandlight 90 sig Squallcoil (charge) · Static Net (numb) · **Fizz 40/100/30** (10% numb) · **Live Wire 95/100/10** (user Def −1) |
| Rime | Frost Nip 50 (10% chill) · Plate Toss 60 sig Rimeplate · Hoarfrost 80/95 (20% chill) · Rime Lock (chill, 75) · **Floe Ram 70/100/15** (10% chill) |
| Gust | Skein Sweep 60 sig Skeinwing · Gale Cut 70 · Updraft (Spe +2) · Mirror Step (evasion +1, 5 PP) · **Downdraft 40/100/30** (priority 1) |
| Stone | Shard Fling 55/95 · Bedrock Charge 100 sig Stillox (charge) · Sandtrap (trap) · Stand Firm (Def +2) · **Cairn Crash 95/85/10** |
| Rust | Rust Bite 60 (30% poison) · Corrode (poison) · Iron Pin 80 · Hullburst 150 (self-KO; fails near Sodden) |
| Glass | Dust Veil 30 sig Prismoth (30% poison) · Shardlight 75 · Dazzle (Atk, SpA −1) · Lens Focus (SpA +2) · Vesper Mend sig Vesperay (delayed 50%, a Hollow hit cancels it) |
| Hollow | Shadowbox 50 sig Scrapling · Gnash 60 sig Brinelance (30% flinch, pops a decoy) · Snuff 50 sig Creelwight (clears raised stages) · Echo Drain 70 (drain 1/2) · **Murk 40/100/30** (20% SpD −1) · **Drowned Bell 90/90/10** (10% flinch) · **Hush** (SpA −2) |
| Star | Tailfall 90 sig Vagary (Unfixed queued type) · Starfall 70 (neutral to all) |
| Typeless | Plumbline (status, sure hit) · Scrap (no slot) |

**Why the 11 new rows.** Each closes a gap the roster showed: Breaker gives Brine a physical body-slam for the Siltback and Rillfin lines; Flashover is the expensive Kiln answer Day 10's *Gap: Hollow* names; Mire Bloom is a drain that keeps working after the Mends run out; Fizz and Live Wire bracket Bolt (cheap early poke, reckless late hit); Floe Ram gives the plated Rime forms a contact move; Downdraft is a Gust priority finisher for evasive builds; Cairn Crash is the inaccurate Stone hammer that can crack a Glasshide Prismoth; Murk, Drowned Bell and Hush are the night line's toolkit (Duskwisp, Duskowl, Hulkwight) and the drowned-fleet sound of Bastien's team.

---

## 3. Trainers (65)

**Row contract** (§14.10 plus): `npc`, `sprite` (route trainers use the generic `trainerVest` / `trainerCoat` bodies), `kind` (animal, for the art lane), `map` + `post` (a marker id GDD-01 places) + `postName`, `region`, `band`, `declinable`, `story`, `blackout`, `holdOut`, `expSource`, `payoutRule`, `lines {intro, win, lose}`, `scripts {before, afterWin, afterLoss}`; party entries `{species, level, moves, held?, nick?, bossShift?, onEntry?}`; Porch Duels add `scale`, `levelOffset`, `available` (a cond) and `requires.visited`.

**Placement rules** (asserted by the test):
- **Wards:** none on any trainer before Cairnhold (Porch Duel Odile's Prismoth is offered only after you have visited Cairnhold), **at most one per trainer counting boss-Shift cards**. The first mandatory Ward is Mooring Clerk Prudence's Chillnub on the clinic gate, where Crackdust (300) is sold; 300 is below every Cairnhold route payout (600+).
- **Route levels:** mandatory route trainers sit inside their isle's day wild band, optional (declinable) ones inside its night band (+2). Optional trainers: Colm, Tibby, Ellery, Bette, Roswitha, Marl, Sorcha, Maisie, Gideon, Sunniva, Aldous.
- **Heal items:** route trainers at most 1; everyone else at most 2 (the Keeper cap), shown as pips with the Scouting Prism. Engine heal fractions: Salve 0.3, Tonic 0.6, Full Salve 1.0.
- **AI profiles:** `trainer` (route, rivals early, friends, exhibitions, Porch Duels), `spire` (leaders, the Long Road, Linnet from Rimeholt, Merrow), `summit` (Keepers, Champion), `wild` (the Ward Spire's sentinels and the Reading).
- **Scripts:** *(as built: trainers no longer generate `<id>-win` / `<id>-loss` scripts, because the battle scene already shows `lines.win` / `lines.lose`; only `<id>-before` remains, and Porch Duels use `duelWin` / `duelLose` lines)* this chapter owns `<id>-before / -win / -loss` for every trainer except where GDD-07's story script ids (manifest) take over: `pip-before`, `linnet-dock-before/after`, `linnet-brackenford-before/after`, `linnet-gate-before/after`, `wick-long-road-before`, `merrow-engine-before/after`; Keepers and the Champion lose into `summit-bell`; beating Idris plays `idris-anchor-release`.
- **Story battles** (Linnet ×4, Wick ×2, Merrow, Varga) continue on any result and cost nothing; Corin's exhibitions and Porch Duels risk nothing either.

`*` = posted boss Shift. Porch Duel levels are offsets from the party median (one creature with 0–1 badges, two with 2–3, three from 4).

| id | Trainer | Post | Party | AI | Payout | Tactic (notes) |
|---|---|---|---|---|---|---|
| `lowmoor-osier` | Reed Cutter Osier | lowmoor-reed-beds | Tossup 5, Reedkit 6 | trainer | 300 | Plain lead, Moss ace |
| `lowmoor-dunlin` | Mudlarker Dunlin | lowmoor-mud-bank | Puddlepip 6, Mudfist 7 | trainer | 350 | Brine lead, Grit ace |
| `lowmoor-colm` | Ferry Hand Colm | lowmoor-pavilion-steps | Bilgebob 6, Puddlepip 7 | trainer | 350 | two Brine, slow and sturdy (declinable) |
| `lowmoor-perrin` | Marsh Walker Perrin | lowmoor-boardwalk-bend | Reedkit 7, Sloshkin 8 | trainer | 400 | Moss lead, Undertow slows you |
| `lowmoor-tibby` | Pavilion Regular Tibby | lowmoor-pavilion-bench | Tossup 7, Scrapling 8, Wirewhisk 8 | trainer | 400 | three-deep; Wirewhisk pings your moves first (declinable) |
| `cairnhold-ruddock` | Quarryman Ruddock | cairnhold-quarry-road | Mudfist 11, Knuckleback 12 | trainer | 600 | two Grit punchers; lowers your Attack |
| `cairnhold-prudence` | Mooring Clerk Prudence | cairnhold-clinic-gate | Mothling 11, Chillnub 12 | trainer | 600 | Ward: Stillcoat (hits under 50 power do nothing) (Salve) |
| `cairnhold-jory` | Stonecutter Jory | cairnhold-standing-stones | Scrapling 11, Rushling 12, Siltback 13 | trainer | 650 | Siltback ace: Brine/Stone, Settles in |
| `cairnhold-ellery` | Lamp Pilgrim Ellery | cairnhold-memorial-path | Puddlepip 12, Mothling 13 | trainer | 650 | Glass ace; Dazzle softens both your stats (declinable) |
| `cairnhold-bette` | Quarry Forewoman Bette | cairnhold-quarry-floor | Knuckleback 13, Rimeplate 14, Prismoth 15 | trainer | 750 | Ward: Glasshide (only Strong hits land: Kiln, Rime) (declinable; Salve) |
| `emberstep-asha` | Spa Bather Asha | emberstep-lower-terrace | Puddlepip 17, Rayling 18 | trainer | 900 | two Brine; Breaker hits hard |
| `emberstep-kip` | Ash Shoveller Kip | emberstep-ash-cut | Mudfist 16, Scrapling 17, Sootling 18 | trainer | 900 | Grit pair, then Sootling Scorches |
| `emberstep-roswitha` | Cliff Climber Roswitha | emberstep-chimney-ledge | Skirl 18, Sedgehare 19 | trainer | 950 | fast; Sedgehare's ears glint before a crit (declinable) |
| `emberstep-tobiah` | Steam Fitter Tobiah | emberstep-pipe-yard | Wirewhisk 18, Rimeplate 19, Emberjaw 20 | trainer | 1,000 | numb you, wall you, burn you |
| `emberstep-marl` | Scatter Volunteer Marl | emberstep-raft-flyer | Rushling 19, Mudfist 20*, Skeinwing 21 | trainer | 1,050 | forces a posted Shift on his own Mudfist (declinable) |
| `drownwood-wenna` | Stilt Fisher Wenna | drownwood-stilt-ladder | Bilgebob 24, Rillfin 24, Rushling 25 | trainer | 1,250 | all Brine-side; Rushling poisons |
| `drownwood-gil` | Mangrove Poler Gil | drownwood-mangrove-boardwalk | Reedkit 24, Sedgehare 25, Rustcreel 26 | trainer | 1,300 | trap and poison chip; Rustcreel finishes |
| `drownwood-hettie` | Scatter Rescuer Hettie | drownwood-rescue-raft | Gillwick 25, Rushling 26, Brinelance 27 | trainer | 1,350 | Brinelance ace: Gnash flinches |
| `drownwood-abner` | Mooring Warden Abner | drownwood-anchor-post | Stillox 25, Rimeplate 26, Creelwight 27 | trainer | 1,350 | walls; Creelwight is Hollow (immune to Plain, Grit) |
| `drownwood-sorcha` | Lamp Diver Sorcha | drownwood-drowned-lamp | Rayling 26, Mothling 27, Duskwisp 28 | trainer | 1,400 | Hollow ace; Hush cuts your Sp. Attack (declinable) |
| `thistlewind-ned` | Millhand Ned | thistlewind-mill-race | Wirewhisk 30, Mudfist 30, Skirl 31 | trainer | 1,550 | Static Net, then Gust |
| `thistlewind-lark` | Kite Flyer Lark | thistlewind-kite-hill | Skirl 30, Coilcrest 31, Gillwick 32 | trainer | 1,600 | Gust pair; Gillwick Mends |
| `thistlewind-cuthbert` | Moor Shepherd Cuthbert | thistlewind-sheepfold | Tossup 31, Knuckleback 32, Cragmitt 33 | trainer | 1,650 | Grit line top to bottom; bring Hollow or Moss |
| `thistlewind-maisie` | Sail Mender Maisie | thistlewind-sail-loft | Rillfin 31, Sedgehare 32, Wirewhisk 33, Duskowl 34 | trainer | 1,700 | four-deep; Duskowl stronger at night (declinable) |
| `thistlewind-gideon` | Surge Witness Gideon | thistlewind-surge-street | Rushling 32, Chillnub 33, Siltback 34, Bogmonarch 35 | trainer | 1,750 | Ward: Stillcoat on Chillnub; Sandtrap chip (declinable; Tonic) |
| `rimeholt-hild` | Ice Cutter Hild | rimeholt-ice-quarry | Chillnub 37, Mudfist 37, Rimeplate 38 | trainer | 1,900 | Ward: Stillcoat; Rime Lock stalls (Tonic) |
| `rimeholt-oskar` | Cave Lamp-bearer Oskar | rimeholt-cave-mouth | Mothling 37, Wirewhisk 38, Floeback 39 | trainer | 1,950 | Floeback ace, heavy and slow |
| `rimeholt-greer` | Glacier Guide Greer | rimeholt-ice-path | Skirl 38, Rimeplate 39, Gillwick 39, Strandrunner 40 | trainer | 2,000 | four-deep; Strandrunner moves first with Downdraft |
| `rimeholt-sunniva` | Mirror Polisher Sunniva | rimeholt-polished-wall | Mothling 38, Rushling 39, Skeinwing 40, Lumenveil 41 | trainer | 2,050 | Ward: Mirrorveil (status fails); evasion preview (declinable; Tonic) |
| `rimeholt-aldous` | Frost Hermit Aldous | rimeholt-hermit-hut | Sootling 39, Stillox 40, Floeback 41, Caldermaw 42 | trainer | 2,100 | fire on the ice; Caldermaw ace (declinable; Tonic) |
| `pip` | Dock Hand Pip | pellwick-quay-bollards | Tossup 2, Wirewhisk 4 | trainer | 200 | a little Tossup to open, then the Wirewhisk ace; Arc Ping goes first |
| `maud-spire` | Spire Leader Maud Tallis | spire-turn-dais | Puddlepip 8*, Bilgebob 10* | spire | 2,000 | posted scripted Shifts, one sure, one rolled (Salve) |
| `osric-spire` | Spire Leader Osric Penhallow | spire-ward-dais | Siltback 14, Rimeplate 15, Prismoth 16 | spire | 3,200 | stone pair, then a Glasshide Prismoth (Kiln, Rime, chip) (Salve+Salve) |
| `ines-spire` | Spire Leader Ines Calloway | spire-weather-dais | Rayling 20, Coilcrest 21, Emberjaw 22 | spire | 4,400 | posted 3-turn weather: steam, ash, squall, clear (Tonic) |
| `wendel-spire` | Spire Leader Wendel Teague | spire-hollow-dais | Duskwisp 27, Creelwight 28, Hulkwight 29 (oilskin) | spire | 5,800 | all Hollow: immune to Plain and Grit; Oilskin halves chip (Tonic+Tonic) |
| `hallorans-spire` | Spire Leaders Ada & Ivo Halloran | spire-relay-dais | Skirl 33, Gillwick 35, Rimeplate 34, Stillox 35, Duskowl 35, Coilcrest 36 (whetstone) | spire | 7,200 | three rounds, no repeats: one carry will not do (Tonic+Tonic) |
| `seraphine-spire` | Spire Leader Seraphine Locke | spire-mirror-dais | Gillwick 40, Rimeplate 42, Floeback 41, Strandrunner 40, Skeinwing 42, Lumenveil 43 (ballast-stone) | spire | 8,600 | evasion to +2, three Mends each, Mirrorveil ace (Full Salve+Full Salve) |
| `bar-corwen` | Wreck Diver Corwen | bar-wreck-ribs | Bilgebob 40, Rustcreel 40, Creelwight 41, Hulkwight 41 | spire | 2,050 | Long Road 1: hulls and Hollow (Tonic) |
| `bar-tilda` | Tide-pool Warden Tilda | bar-tide-pools | Rayling 40, Rushling 40, Gillwick 41, Strandrunner 41 | spire | 2,050 | Long Road 2: Brine everywhere; bring Bolt or Moss (Tonic) |
| `bar-ezra` | Ex-Mooring Quartermaster Ezra | bar-ration-cairn | Stillox 41, Rimeplate 41, Siltback 42, Cairnward 42 | spire | 2,100 | Long Road 3: Ward (Stillcoat) and Sandtrap attrition; count your PP (Tonic) |
| `bar-ottilie` | Brazier Pilgrim Ottilie | bar-pilgrim-step | Sootling 41, Mothling 41, Emberjaw 42, Duskwisp 42, Lumenveil 43 | spire | 2,150 | Long Road 4: Kiln and Glass; Mirrorveil ace (Tonic) |
| `bar-hamish` | Bar Pilot Hamish | bar-channel-marker | Rillfin 42, Skirl 42, Coilcrest 42, Bilgebob 42, Brinelance 43 | spire | 2,150 | Long Road 5: fast; Brinelance hits harder when low (Tonic) |
| `bar-delphine` | Readers' Fund Scholar Delphine | bar-last-dry-stone | Wirewhisk 42, Gillwick 42, Sedgehare 43, Duskowl 43, Cragmitt 44 (whetstone) | spire | 2,200 | Long Road 6: Arc Ping reads you back; Cragmitt ace (Tonic) |
| `bastien-keeper` | Summit Keeper Bastien Kell | keepers-hall-brazier-left | Creelwight 43, Gillwick 44, Bilgebob 44, Duskwisp 45, Hulkwight 46 (oilskin) | summit | 9,200 | Hollow/Brine walls backed by two Full Salves (pips shown) (Full Salve+Full Salve) |
| `cass-keeper` | Summit Keeper Cass Rune | keepers-hall-brazier-right | Coilcrest 45, Gillwick 46, Floeback 46, Sedgehare 47, Skeinwing 48 (whetstone) | summit | 9,600 | squall feeds Gust evasion (still capped at +2) (Full Salve+Tonic) |
| `idris-champion` | Champion Idris Fenwake | idris-hall-bell | Prismoth 46, Duskowl 47, Strandrunner 48, Brinelance 48, Bogmonarch 49, Vesperay 50 (still-knot) | summit | 10,000 | anchored six: a Ward, a Hollow, a weather setter, a fast hitter; Vesperay evasion + Vesper Mend (Full Salve+Full Salve) |
| `linnet-dock` | Rival Linnet Rask | pellwick-keepers-dock | Sootling 5* | trainer | 0 | stand as long as you can; the strip says Up 100% (story; Shifts as it enters) |
| `linnet-brackenford` | Rival Linnet Rask | lowmoor-rematch-stones | Tossup 6, Mudfist 7, Caldermaw 11 | trainer | 550 | one carry: everything runs through Caldermaw (story) |
| `linnet-rimeholt` | Rival Linnet Rask | rimeholt-frostwick-jetty | Rushling 36, Duskwisp 37, Wirewhisk 37, Rimeplate 38, Sedgehare 38, Sootling 39 | spire | 1,950 | a balanced six she trained herself; no carry to target (story; Tonic) |
| `linnet-gate` | Rival Linnet Rask | bar-shardcrown-gate | Rushling 42, Duskwisp 43, Coilcrest 43, Rimeplate 44, Sedgehare 45, Emberjaw 46 | spire | 2,300 | balanced six; Cinder has Shifted twice since Rimeholt, same mark (story; Tonic) |
| `wick-cairnhold` | Friend Wick Dorrow | cairnhold-knapps-end-dock | Rillfin 12 | trainer | 0 | one fragile Rillfin and support moves (story) |
| `wick-long-road` | Friend Wick Dorrow | bar-halfway-post | Bilgebob 41, Rushling 42, Gillwick 43* | trainer | 0 | the water pack; Skipper's posted Shift lands Up (story) |
| `merrow-engine` | Provost Agathe Merrow | lantern-stack-engine | Stillox 35, Rimeplate 36, Siltback 37, Cairnward 38 | spire | 0 | anchored team; an Anchor Pulse levels every stat stage every 3 turns (story; Tonic) |
| `varga-drownwood` | Scatter Organizer Teo Varga | drownwood-scatter-raft | Mudfist 25*, Rustcreel 26*, Sedgehare 27*, Bogmonarch 28 | trainer | 0 | forces posted Shifts on his own side; some land Down (story; Tonic) |
| `corin-exhibition-1` | Mentor Corin Vale | lowmoor-brackenford-stones | Skirl 6, Tossup 8* | trainer | 0 | exhibition: read all three cards aloud |
| `corin-exhibition-2` | Mentor Corin Vale | emberstep-sulphur-cross-bench | Duskwisp 17, Skirl 18, Tossup 20* | trainer | 0 | exhibition: night owls, then a rolled Tossup Shift |
| `corin-exhibition-3` | Mentor Corin Vale | thistlewind-windle-mill-steps | Duskwisp 30, Skirl 31, Duskowl 32, Tossup 34* | trainer | 0 | exhibition: the last one; the Tossup Shift can skip a stage |
| `porch-wren` | Porch Duel Wren Hearthwright | porch-coop-yard | Mudfist -1, Siltback +0, Scrapling +1 | trainer | 30 x curve | Peg leads with her fists |
| `porch-tully` | Porch Duel Tully | porch-tully | Tossup -1, Mudfist +0, Scrapling +1 | trainer | 30 x curve | Scamp is fast. Scamp says. |
| `porch-juniper` | Porch Duel Juniper Pell | porch-pells | Rushling -1, Mothling +0, Wirewhisk +1 | trainer | 30 x curve | Tinsel pings your moves first |
| `porch-odile` | Porch Duel Odile | porch-odile | Mothling -1, Sedgehare +0, Prismoth +1 | trainer | 30 x curve | Ward: Glasshide Prismoth (offered only after you reach Cairnhold) |
| `porch-tamsin` | Porch Duel Tamsin Brack | porch-dark-1 | Rustcreel -1, Rushling +0, Creelwight +1 | trainer | 30 x curve | Kettle is Hollow: Plain and Grit go straight through |
| `porch-wick` | Porch Duel Wick Dorrow | porch-dorrow | Bilgebob -1, Rushling +0, Gillwick +1 | trainer | 30 x curve | Skipper (a Rillfin until the water-pack Shift) |
| `porch-augusta` | Porch Duel Augusta Skerry | porch-wardens-house | Rayling -1, Rimeplate +0, Bilgebob +1 | trainer | 30 x curve | Bosun soaks hits; nothing self-destructs near Sodden |
| `porch-linnet` | Porch Duel Linnet Rask | porch-linnet | Rushling -1, Duskwisp +0, Sootling +1 | trainer | 30 x curve | Cinder (a Caldermaw until the fall); not while her porch is dark |

---

## 4. The six Spires

Each Spire certifies one reading skill and ends in a battle that uses it. The dossier is nailed to the Spire door and pinned on the Commons board; it lists the full roster, abilities, heal pips and a tactic tag. The leader's ace sits at **posted curve + 3**; the posted curve is what the map and the party screen show for that isle.

| # | Spire | Leader | Theme rule (data) | Inside | Ace | Prize | Badge unlocks (GDD-00 §7) |
|---|---|---|---|---|---|---|---|
| 1 | **Turn** (Lowmoor, Brackenford) | Maud Tallis | `scripted-shifts`: every creature Shifts once; strip posted a turn ahead | door → Maud's practice table (Reroll lesson, optional, any time before) → Maud | Bilgebob 10 | 2,000 + 3 Starsalt | Reroll; Spore Drift disc guaranteed at Pell's |
| 2 | **Ward** (Cairnhold, Knapp's End) | Osric Penhallow | `wards`: badge, readout, Crackdust 300 for 3 turns | door → East Sentinel (Chillnub 13) → West Sentinel (Cairnward 14) → Osric | Prismoth 16 | 3,200 + 3 | Lantern-paths, free ferry, Skyglass Wicks |
| 3 | **Weather** (Emberstep, Sulphur Cross) | Ines Calloway | `weather`: steam → ash → squall → clear, 3 turns each, next 3 turns posted | door → Ines | Emberjaw 22 | 4,400 + 3 | Scouting Prism (Corin), Ethers |
| 4 | **Hollow** (Drownwood, Mossgate) | Wendel Teague | `immunities`: all Hollow; menu marks *No effect* | door → Wendel | Hulkwight 29 | 5,800 + 3 | Recall (6 Starsalt), one coverage disc face-up |
| 5 | **Relay** (Thistlewind, Windle) | Ada & Ivo Halloran | `relay`: three singles rounds, two of yours each, no repeats (reuse allowed once you run dry), no heal between | door → round 1 (Ivo) → round 2 (Ada) → round 3 (both) | Coilcrest 36 | 7,200 + 3 | Weatherglass; Training Yard Commons project |
| 6 | **Mirror** (Rimeholt, Frostwick) | Seraphine Locke | `mirror`: evasion cap +2, two decoys max, 3 Mends, true odds on the menu | door → Idris in the gallery → Seraphine | Lumenveil 43 | 8,600 + 3 | Plumbline disc; the Summit gate |

Every win also notches the **Spire share** (10% of the open loan) on Wren's ledger.

**As built.**
- **Badge gifts** (Scouting Prism at badge 3, Weatherglass at 5, Plumbline disc at 6) are given once, the first time the badge is won, and never duplicated. The seal slip says "A gift waits: the X" and the leader's badge script hands it over. (Open: the item is already in the satchel by then, so the handover shows no "Received" line.)
- **The dais tile** challenges the map's Spire leader; at the Relay, Ivo offers the same challenge from talk until the Spire is won.
- **Ward sentinels** stand on their markers with their own art (`sentinel-stone`, a glowing rune) and a "Granite Sentinel" label. Each is a wild-style battle: no capture, nothing lost, posted moves. A win sets `sys.trainer.<id>`, posts the lesson and the sentinel steps aside; a loss heals the party in place with no blackout and no cost. Intro: "The {sentinel} wakes: a {name} stirs in the stone."
- **Relay rounds** (fix wave 1, MID-05) play in one battle scene. A pick screen opens before every round (round 1 included; skipped under One Heart) with an "Open the satchel" option; creatures that already fought are greyed out until you run out of fresh ones. There is no healing between rounds, the twins' two Tonics carry across all three, and the payout, badge and parting words come only after round 3. Rounds 1–2 say nothing about money.

**Turn.** Maud teaches the strip by contrast: her Puddlepip posts a single card, *Up: Sloshkin 100%*, so the first lesson is that a posted 100% means it lands; then her Bilgebob posts three cards at your dial's odds (Up Brinelance, Side Rushling, Down Puddlepip). A Lv10 Brinelance with Gnash is a real threat at badge 1, so the right play is a move that is good against all three: the strip turns into a plan, not a hope. The practice table is where Reroll is taught; the badge is what lets you use it on your own Forecasts.

**Ward.** The sentinels are wild-style exhibitions (no capture, nothing lost) that teach Stillcoat twice before the real lesson: Osric fields exactly one Ward, the Glasshide Prismoth, whose only Strong types are Kiln and Rime. The answers on offer by then: the Spore Drift disc (guaranteed since badge 1), any Kiln or Rime move, Crackdust, or Cairn Crash from a lucky Pell's rotation. GDD-00's one-Ward-per-trainer rule is what forced the sentinels: the theme is Wards, the rule caps them per trainer, so the Spire becomes a walk past several.

**Weather.** The cycle is fixed and printed, so the fight is about timing: Emberjaw wants steam (turns 1–3, 13–15), Coilcrest wants squall (7–9); ash chips everything that is not Kiln or Stone, which is the first time the player meets weather chip getting through a Ward. The HUD shows the next three turns at all times. The engine runs it (§7.2): the flow passes the Spire's `theme.rule` as `weatherCycle`, the Read card posts the opening three turns and the door dossier the whole twelve-turn round, and Ines's AI leans into whatever the sky favours that turn.

**Hollow.** No gimmick beyond the chart: Plain and Grit do nothing, and the game has been saying *Gap: Hollow* on the Coverage view since Drownwood if the party is short. Hulkwight's Oilskin halves chip, so the poison plan that beat Osric is weaker here; the readable answers are Kiln, Gust and Glass, which Pell's stocks as discs (Flashover, Gale Cut, Shardlight).

**Relay.** Linnet's one-carry problem as a building. Three rounds of two against two, nobody of yours fights twice; if the party has fewer than six, the rule relaxes to "anyone may come back" once you run out of fresh creatures, so it never walls a small party, but a full bench breezes it. Bench EXP has been 60% since the first route, so the sitters are closer to ready than the player expects.

**Mirror.** Built by Idris's former student to teach his style: evasion stacks (capped at +2), Mends (three each, pips shown), true odds printed on the menu. Lumenveil's Mirrorveil turns away status moves, which is exactly why the Spire pays out **Plumbline**: GDD-00 rules that Plumbline ignores every Ward including Mirrorveil, so the disc this Spire awards answers this Spire's ace and, later, Idris's Vesperay.

---

## 5. The Long Road, the Summit and the Bell

**The Long Road** (the Bar, Lv40–44, curve 41). Dry ±1.5 h of the day's lower low until the Relighting, any tide after it (`lit.bar`). Hollis hands over the Ration Ledger the first time you set foot on it; there is no Waystone until Hollis's Gate, so the HUD shows total team PP and supplies. Order: Corwen (wreck diver, Hollow hulls) → Tilda (tide pools, all Brine) → Ezra (ex-Mooring quartermaster: a Stillcoat Cairnward and Sandtrap attrition) → **Wick, halfway, with the flame** (his Gillwick "Skipper" posts *Up: Strandrunner 100%* and walks out of the water) → Ottilie (brazier pilgrim, Kiln and Glass, Mirrorveil ace) → Hamish (bar pilot, fast) → Delphine (Readers' Fund scholar: Arc Ping reads you back; Cragmitt with a Whetstone) → **Linnet at the Shardcrown gate** (after badge 6; the Gnash disc, win or lose). Six badges open Hollis's Gate (`summit-gate`).

**The Summit.** Keeper **Bastien Kell** (Hollow/Brine walls, two Full Salves shown as pips; Hulkwight 46 with an Oilskin) → Keeper **Cass Rune** (Coilcrest posts a squall as it enters; squall gives Gust creatures +1 evasion, still capped at +2; Skeinwing 48 with a Whetstone) → **Champion Idris Fenwake** (an anchored six: a Ward = Glasshide Prismoth, a Hollow = Duskowl, a weather setter = Strandrunner's squall, a fast hitter = Brinelance, Bogmonarch, and **Vesperay 50 holding a Still Knot: the anchor ring on its tail**, which the anchor-release scene takes off). No Waystone between fights: HP and faints carry over, each move regains 5 PP, all items allowed; losses cost nothing. Dossiers for all three are posted at Hollis's Gate; teams never change between attempts.

**The Summit Bell** (Drift and Flux): after a loss the next attempt starts at whoever beat you, with your party as it stood when that fight began; it refills nothing; you may always decline it and restart at Bastien. Freefall restarts the climb every time.

**As built (fix wave 1, MID-10, and the final fix pass).**
- A Summit loss is never a blackout: no trip home, no Dimity, no cost.
- On Drift and Flux the party is restored as that fight began and you stand at the `bell-restart` marker of whoever beat you; the Bell script offers "Keep my place." or "Start again from the first Keeper." (the second runs the `restartSummit` op), but only while a climb is under way.
- On Freefall the party is healed, the beaten Keepers stand again, you go back to the Keepers' Hall door with a toast, and the Bell script is skipped. Bastien, Cass and Idris have their own Freefall loss lines.
- After a win over a Keeper (not the Champion) every move regains `tuning.summitPpTopUp` (5) PP through `party.applyOutcome`; HP and faints stay. A slip says so: "No Waystone up here / Every move regains 5 PP. / HP and fainted stay as they are."
- **The climb goes in order.** `battleFlow.summitBlocker` reads `SUMMIT.order`: challenging a Keeper or Idris out of turn toasts "The climb goes in order: Bastien Kell first." and starts no battle.

---

## 6. The Reading

Relighting night on the Lantern Stack. **Seven phases of two turns**, one 96×96 Vagary whose palette and Unfixed type queue (Star + three types) change per phase. At the end of each phase's first turn the next phase's Forecast posts (three aspect cards at the dial's odds, already steadied by the Relighting); it lands at the end of the second. **It cannot be lost:** your creatures never fall below 1 HP, its bar never empties, Run and the Lantern are off, items and Read work, nothing costs buttons. Its level is the party's highest + 2 (30–60).

Phases 1–6 replay the six Spires' lessons in badge order, each voiced by someone on the shore; the seventh is yours:

| # | Phase | Rule this phase | Shore voice | The cards it posts for the next phase |
|---|---|---|---|---|
| 1 | The Turn | (the strip itself) | Corin | Lattice / Cairn / Hoar |
| 2 | The Ward | hits under 50 power do nothing; the readout names what lands | Merrow | Steam-crown / Ash-veil / Squall-tail (each brings its weather) |
| 3 | The Weather | the landed aspect's weather, for this phase | Wick | Drowned Bell / Wreck-light / Empty Weave (all carry Hollow) |
| 4 | The Hollow | Plain and Grit go straight through | Idris | Windle / Mill-race / Sheepfold |
| 5 | The Relay | the creature that ended phase 4 may not lead | Linnet | Lumen / Vesper / Rime-mirror |
| 6 | The Mirror | evasion +2 with two decoys, true odds; Plumbline cuts through | Varga | Lamplit / Harbor / Dark Water |
| 7 | The Reading | **its Forecast is offered to you** | Corin: "I cannot read one that size. You can." | Ring of the Light / Ring of the Tide / Ring of the Dark Water |

On the seventh, **Anchor** (Merrow's way) and **Reroll** (Varga's way; redraws three rings from a pool of six) are free and each keeps the night going one more phase; **Accept** is the only ending (`sp.reading-done`, stamp *The Reading*). Whichever ring lands is the palette the post-game Passenger perches in.

**As built (fix wave 2, MID-18, and the final fix pass).**
- The ending script starts the Reading as `{op: 'startBattle', source: 'reading', holdOut: 14, wild: {speciesId: 'vagary', reading: THE_READING}}`. `battleFlow` builds the seven phases from `js/data/spires.js` `THE_READING` and scales the Vagary to the party's highest level + 2 (min 30, max 60).
- Each phase posts three cards at the dial's steadied odds, rolled on `reading:<phase>:<draw>`. A landed aspect's weather holds for its phase.
- **Ward phase:** a min-power-50 lattice ("Blocked by Ward"); Crackdust can drop it, and while it is down the Vagary's own ability shows. **Relay phase:** the creature that ended the last phase is benched for that phase (left out of the switch list). **Mirror phase:** +2 evasion with decoys, reset when phase 7 opens.
- The opening line is "The Vagary settles on the Lantern Stack…". The 96-cell Vagary is drawn at 1× with its foot on the platform and tinted by its current type.
- Each Anchor or Reroll adds a 2-turn night with new cards (`sys.reading-draws`, up to `READING_EXTRA_DRAWS` = 6 different draws).
- **Open:** the seventh offer is still a dialogue choice. The Forecast scene has a Reading mode (`who: 'reading'`: Ring cards with odds, Accept / Anchor / Reroll marked free, the landed ring named, `np.keeper.reading-ring` / `reading-choice` / `reading-rerolls`), but the ending script does not call it yet, so no cards are drawn and the landed ring is not named.

---

## 7. Difficulty curve

The curve rises in even steps of 6–7 levels per isle, and every boss sits exactly 3 over the posted curve; the Summit adds 2 per fight.

| Stop | Posted curve | Route trainers (mandatory / optional) | Boss | Boss − curve |
|---|---|---|---|---|
| Night one (Pellwick) | 4 | Pip 4; Linnet's dock hold-out 5 | — | — |
| Lowmoor | 7 | 5–8 / 6–8 | Maud: Bilgebob 10 | +3 |
| Cairnhold | 13 | 11–13 / 12–15 | Osric: Prismoth 16 | +3 |
| Emberstep | 19 | 16–20 / 18–21 | Ines: Emberjaw 22 | +3 |
| Drownwood | 26 | 24–27 / 26–28 | Wendel: Hulkwight 29 | +3 |
| Thistlewind | 33 | 30–33 / 31–35 | Hallorans: Coilcrest 36 | +3 |
| Rimeholt | 40 | 37–40 / 38–42 | Seraphine: Lumenveil 43 (a full six) | +3 |
| The Bar (Long Road) | 41 | 40–44 (six, in rising order) | Linnet at the gate: 46 | +5 |
| Shardcrown | 47 | — | Bastien 46 · Cass 48 · Idris 50 | −1 / +1 / +3 |

Side fights sit on the same rails: Linnet's rematch (one-carry Caldermaw 11, the hardest badge-1 fight on purpose, but story and costless), Wick at Cairnhold (12, a gift), Varga (25–28, rolled Shifts), Merrow's Engine (35–38, Anchor Pulse levels every stage every 3 turns), Linnet at Rimeholt (36–39, a balanced six), Corin's exhibitions at 8 / 20 / 34. Teams grow from 2 creatures (Lowmoor) to 3 (Cairnhold–Drownwood), 3–4 (Thistlewind, Rimeholt), 4–5 (the Bar), 5–6 (the Summit); the last two leaders field six. Heal pips appear on route trainers only from Cairnhold onward (Mooring Clerk Prudence's Salve is the first), and never more than one. Payouts climb from 300 to 2,200 a route trainer, so the Spire share and the leader prize, not grinding, carry the battler toward the loans (GDD-00 §7).


### 7.1 Balance (verified by simulation)

`tools/balance-sim.mjs` plays the real tables through the real engine (`js/battle/engine.js`); `test/data.balance.test.mjs` runs it on every check and holds the targets. Each fight is played 200 times for each of three starter lines (600 battles), with a competent player brain on side 0 (finishes when it can, heals when a heal buys a turn, switches out of walls and lost matchups, throws Crackdust at a Ward nothing lands on, Plumblines boosts, chips what it cannot hurt, else the best expected hit; it knows the dossier) and the trainer's own AI profile on side 1. Posted boss Shifts run in the engine itself at the Flux odds (fix wave 1; before that the harness applied them); the Relay is three rounds of two fresh creatures with the split planned against the posted rounds and the twins' heals carried across rounds; the Summit is one run of three fights with no Waystone, +5 PP between fights and the bag used between fights. Arena weather and held items run in the engine itself (§7.2): the Weather Spire's posted cycle, Cass's and Idris's entry squalls, and every trainer's held item (Oilskin, Whetstone, Ballast Stone, Still Knot) are live in every simulated battle.

**The on-curve party** (starter at curve +1, everyone else at the curve; the starter line is Sloshkin, Scrapling or Reedkit, steered Up at the windows; movesets are the best four from each learnset plus the discs owned by then):

| Fight | Curve | Party after the starter | Discs | Bag |
|---|---|---|---|---|
| Turn | 7 | Tossup, Wirewhisk, Mudfist | — | 2 Salves |
| Ward | 13 | Tossup, Wirewhisk, Mudfist, Chillnub | Spore Drift | 2 Salves, 2 Crackdust |
| Weather | 19 | Wirewhisk, Mudfist, Chillnub, Sootling, Sedgehare | Spore Drift | Tonic, Salve |
| Hollow | 26 | Coilcrest, Rimeplate, Sootling, Rushling, Bilgebob | + Flashover | 2 Tonics |
| Relay | 33 | Coilcrest, Rimeplate, Emberjaw, Rushling, Duskowl | + Gale Cut | 2 Tonics |
| Mirror | 40 | Coilcrest, Floeback, Emberjaw, Gillwick, Duskowl | + Hoarfrost | 2 Tonics |
| Summit | 47 | Coilcrest, Floeback, Caldermaw, Strandrunner, Duskowl | + Drowned Bell, Plumbline | 4 Tonics; between fights 3 Revives, 2 Full Salves |

**Results** (win rate; Sloshkin / Scrapling / Reedkit line; average turns):

| Fight | Target | Win | By line | Turns |
|---|---|---|---|---|
| Turn (Maud) | 55–85% | **78%** | 93 / 100 / 42 | 7.8 |
| Ward (Osric) | 55–85% | **62%** | 100 / 32 / 54 | 14.1 |
| Weather (Ines) | 55–85% | **69%** | 71 / 77 / 59 | 10.9 |
| Hollow (Wendel) | 55–85% | **70%** | 24 / 88 / 100 | 12.0 |
| Relay (Hallorans) | 55–85% | **75%** | 96 / 33 / 96 | 12.2 |
| Mirror (Seraphine) | 55–85% | **60%** | 40 / 68 / 74 | 25.2 |
| Summit run | 35–65% | **51%** | 47 / 61 / 46 | 15.7 |
| 30 route trainers | 85%+ | min **88%**, mean 99% | — | ≤ 12.4 |

Re-run on 2026-10-28 (`node tools/balance-sim.mjs`) with the engine's own boss Shifts and Relay rules; every fight is inside its band.

**Level progression** (`node tools/balance-sim.mjs --only progression`, gated by `test/data.progression.test.mjs`): the party's median level at each Spire door against the posted curve, for three kinds of player.

| Door | Curve | Minimal | Typical | Thorough |
|---|---|---|---|---|
| Turn | 7 | 11 (+4) | 12 (+5) | 14 (+7) |
| Ward | 13 | 14 (+1) | 17 (+4) | 19 (+6) |
| Weather | 19 | 19 (+0) | 22 (+3) | 25 (+6) |
| Hollow | 26 | 26 (+0) | 28 (+2) | 31 (+5) |
| Relay | 33 | 31 (−2) | 34 (+1) | 38 (+5) |
| Mirror | 40 | 38 (−2) | 41 (+1) | 46 (+6) |
| Summit | 47 | 46 (−1) | 49 (+2) | 53 (+6) |
| Forecasts per run | | 15 | 16 | 17 |

The starter's windows open at Lv8 on Lowmoor (day 2), Lv20 around Emberstep and Lv34 around Thistlewind for the typical player (Drownwood and Rimeholt for the minimal one). Lowmoor runs high because its night trainers and Linnet's Caldermaw 11 sit above its posted curve of 7. `tools/economy-sim.mjs` puts the Relighting on day 14 for a typical player (casual 20, ideal 13, grinder 8).

No fight averages more than 26 turns. Every starter line wins every Spire at least one time in five; the low cells are type matchups the dossier names and the party can answer: Reedkit's Moss is weak into Maud's Brine (Wirewhisk is the answer), Scrapling's Grit takes Strong Shardlight from Osric's Prismoth (Chillnub's Frost Nip or Crackdust), Bogmonarch's Stone takes Strong Hollow hits (Coilcrest's Gust, the Flashover disc), and the Hallorans' Gust and Moss lean against a Grit carry (Duskowl and Coilcrest from Thistlewind). The Ward readout names an answer to every Ward a trainer fields, for every on-curve party.

**What the sim changed** (data only; every change is inside the GDD-00 ranges):

| Where | Was | Now | Why |
|---|---|---|---|
| Tibby (optional, Lowmoor) | Wirewhisk 9 with Jolt | Wirewhisk 8 with Fizz | At 9 it swept a Lv7 party (18% win); now 93%. GDD-ids lists Lv7–9; the range is 7–8. |
| Hallorans (Relay) | Skirl 33, Gillwick 34, Rimeplate (Stand Firm), Sedgehare 35 | Skirl 33 (Murk), Gillwick 35, Rimeplate (Shard Fling), **Stillox 35** | Six Gust or Moss bodies walled any Grit carry (1%); Stillox, Thistlewind's rare, gives round 2 a Stone face instead. |
| Seraphine (Mirror) | four: Rushling 40 … Lumenveil 43; Full Salve + Tonic | **six** at 42 (Gillwick, Rimeplate, Floeback, Strandrunner, Skeinwing) + Lumenveil 43; two Full Salves | Four creatures at 40–43 lost to every on-curve party 9 times in 10 (89–93%); the sixth Spire now fields a full six. GDD-ids lists 4: Lv40–43. |
| Seraphine (Mirror), with held items live | the five at 42 | **Gillwick 40, Rimeplate 42, Floeback 41, Strandrunner 40, Skeinwing 42** (Lumenveil 43 unchanged) | Once the engine ran held items, Lumenveil's Ballast Stone (+1 Def, +1 SpD on entry) took the Mirror from 73% to 52%, under the band. Two of the five supports drop two levels and one drops one; Skeinwing stays at 42 because it learns Hoarfrost there. 60% on the shipped seed and 59–62% on two others; every level is still inside GDD-ids' Lv40–43. Weather (69%) and the Summit (50%) stayed in band with weather and held items live, so their teams and weathers are unchanged. |
| Wirewhisk (GDD-03) | 350 total, Jolt at 6 | 335 (SpA 62, Spe 88), Jolt at 9 | The stage-1 outlier (+2.2 deviations); the reason Tibby swept. |
| Chillnub (GDD-03) | 300 | 318 (HP 63, SpA 50, SpD 60) | The Ward Spire's Rime answer must survive one Shardlight from the Lv16 ace. |
| Sootling (GDD-03) | 300 | 316 (HP 54, SpD 50, Spe 45) | Under the stage-1 band's spread (−1.6 deviations); Linnet's lead. |
| Bogmonarch (GDD-03) | Riptide at 28 | Riptide at 24 | Same as Siltback, so an Up Shift at the Lv20 window loses no step. |
| Vagary (GDD-03) | phase moves learned at 50–70 | all eight by 30 | The Reading's level floor is 30; every phase move is now legal. |

Stat totals by stage after tuning: stage 1 300–335 (mean 322), stage 2 420–470 plus Vesperay 520 (two-form line, Idris's ace), stage 3 495–520. No form is strictly dominated by a same-typed form of its stage. Outliers past 1.5 deviations are all documented: Vesperay (high, by design), Tossup (low, Plain blank slate), Lumenveil (low; a Ward pays for itself), Rayling and Wirewhisk (top of the stage-1 band), Stillox (the titan under the two Errants and the Vagary).

**The Reading cannot be lost**: `THE_READING.rules` sets `canLose: false`, both HP floors at 1, no blackout, no buttons, no Run, no Lantern, and `endsOn: 'accept'`; Anchor and Reroll are free and each adds a phase. The test asserts all of it.

### 7.2 Arena weather and held items (engine rules)

`js/battle/weather.js` and `js/battle/heldItems.js`, driven from the engine; both are pure data readers (no kind, type or item is named in code) and neither draws from the rng, so a seed replays exactly.

**Weather state** `{kind, turnsLeft, posted}` (`battle.state().weather`, also `name`, `text`, `source`): `turnsLeft` counts the coming turn (null = it stands until replaced), `posted` is the strip for the next `weatherPostedTurns` (3) turns, or the cycle's own `postedTurnsAhead`. Three layers, top wins: a **timed** weather (a creature's `onEntry {weather, turns}`, a move's `weather` effect, `setup.weather {kind, turns}`), the **posted cycle** (`setup.weatherCycle` = the Weather Spire's `theme.rule`), or a **standing** kind (`setup.weather: 'steam'`). When a timed weather runs out the cycle (or the standing kind) comes back. A timed weather set mid-turn counts that turn's end as its first tick; one set as a creature enters between turns starts with the next turn. A move's weather without `turns` lasts `weatherMoveTurns` (5).

**Per kind, from `WEATHER_KINDS`:** `power` multiplies damage by the move's type (in `estimateDamage` too, so the menu, the AI and the finisher all see it; the menu adds `weatherMult` and a *Boosted* / *Dampened* word; a `power` of 0 smothers the type: the hit deals 0, never the 1-HP floor, exactly like an immunity); `accuracy` multiplies every hit chance except sure hits; `chip` is end-of-turn damage (`damage.source: 'weather'`) to creatures with none of `chipImmune`, indirect, so it passes every Ward (the Ward readout names it under *Indirect damage that works* as `weather chip (Ash)`, or `(Ash, posted)` when it is on the strip, whenever it would reach the Ward creature) and, on a wild creature under Capture Stance, stops at 1 HP like every other non-self source; `evasion` grants stages to the active creatures of those types as the weather starts (through `_changeStage`, so the +2 cap and a Plumbline lock hold); an optional `status {blocks, cures}` keeps conditions off (they fail as 'immune') and clears them at the end of a turn (no shipped kind uses it yet).

**Always visible:** `weather-start` (kind, name, turnsLeft, posted, source = setup / cycle / entry / move, the rule line, text), `weather-tick` each end of turn before the chip (turns still to come and the next strip), `weather-end`. The Read card carries `weather.posted` (the opening turns, every dial) and the dossier the whole cycle as one line ("Turns 1-3 Steam, 4-6 Ash, 7-9 Squall, 10-12 Clear, then repeat."), every kind's rule line and the roster's weather setters; `battle.setWeather(kind, {turns})` is the flow's hook between turns (the Reading's phase weather).

**Held items** (`heldItem` on a battle creature; the item row's `held` keys; with no items table injected every held item is inert): `critStages` (Whetstone), `endureFromFull` + `perBattle` (Cork Float: once a battle, a knock-out hit from full leaves 1 HP), `chipMult` (Oilskin: burn, poison and trap chip halved; weather chip is not), `startStages` (Ballast Stone: each time it enters), `payoutMult` (Lucky Button, when its holder battled), `benchShare` (Tally Charm). Generic keys for future rows: `healAt {below, fraction}` (spends a Mend like any heal, and waits while none is left), `cures [kind]`, `typeBoost {types, mult}`, `accuracyMult`, `statMult`, and `consumable` (used up the first time it fires). `blocksShift` (Still Knot) and the tilts' `forecastTypeMult` only matter outside battle; Crackdust and medicine have no `held` object and stay bag items. Hook points: onSwitchIn, onDamageTaken (before: endure; after: threshold heal), onTurnEnd (cure, heal), onHitCheck, onStatCalc, plus attack, crit and chip readings. A firing emits `held-item` (effect start-stages / endure / heal / cure, `consumed`); a used-up item is cleared on the creature and listed in `result().consumedItems` `[{side, uid, item}]`.

**AI:** every damage score carries the weather's multiplier for the move's type, so the trainer AI picks the move the sky boosts and avoids the one it weakens; replacements are scored the same way. A smothered hit (`weatherMult` 0) is never the finisher, and both last-resort fallbacks (trainer and wild brains) pass over it while any other move is selectable.

**Validator:** `tools/validate-data.mjs` checks `held` keys against `HELD_KEYS`, a trainer's `held` item exists (and is not a bag item), `onEntry.weather`, a move's `weather` effect and the Weather Spire's cycle against `WEATHER_KINDS`; `EFFECT_KEYS` gains `weather`.

---

## 8. Data formats used here (for the flow and the engine)

- `bossShift: {postAt, shiftAt, odds: 'dial' | 100, cards: [{dir, form}]}` on a party entry; odds table in `spires.BOSS_SHIFT_ODDS`.
- `onEntry: {weather, turns}` on a party entry; weathers in `spires.WEATHER_KINDS` (`power` by type, `accuracy`, `chip {fraction, chipImmune}`, `evasion {types, stages}`, optional `status {blocks, cures}`). The engine reads them as `createBattle({weatherKinds})` or `data.weatherKinds`, a party creature's `onEntry`, and a Spire `theme.rule` as `weatherCycle` (§7.2).
- `held: itemId` on a party entry becomes the battle creature's `heldItem`; the item row's `held` keys drive it (§7.2).
- `rules.anchorPulse: {everyTurns, effect: 'clear-stages', sides: 'both', text}` on Merrow's trainer row.
- Spire `theme.rule` per kind (`scripted-shifts`, `wards`, `weather`, `immunities`, `relay`, `mirror`), Spire `order` steps (`door`, `lesson`, `sentinel`, `scene`, `battle {trainer, round?}`).
- Porch Duels: `scale {by: 'party-median', sizeByBadges[7], min, max}`, party `levelOffset`, `before {species, until: cond}` (the form a neighbor's creature has until a story beat), `available` (cond), `requires.visited` (map id; reads `world.maps[id].visited`).
- `THE_READING.rules {canLose: false, playerHpFloor: 1, foeHpFloor: 1, …}`, `phases[n].rule`, `phases[n].next {odds: 'dial', cards: [{dir, aspect {name, palette, typeQueue, weather?}}]}`, `phases[6].offer` and `rerollPool`.

---

## 9. Integration notes (for the orchestrator and other lanes)

1. **Wiring:** `DATA.moves = MOVES` (moves/index.js), `DATA.trainers = TRAINERS`, `DATA.scripts = {...story scripts, ...TRAINER_SCRIPTS}`; add a `spires` table (`SPIRES`) and move `spires` from `UNMAPPED` to `MANIFEST` when it lands.
2. **Engine follow-ups (not this chapter's files):**
   - Plumbline through Wards: done in the engine (`DEFAULTS.plumblineIgnoresWards: true`).
   - Posted boss Shifts, the Relay round structure and the Reading's HP floors and phase loop are implemented (fix waves 1–2; see §1.4, §4, §6). **Still not implemented:** Merrow's Anchor Pulse (`rules.anchorPulse` on her trainer row is data only), and the Reading's seventh offer through the Forecast scene (§6).
   - Arena weather and held items: done in the engine (§7.2), and the flow now passes them (held items, `onEntry`, `weatherKinds`, the Weather Spire's `weatherCycle`). Consumed held items are not dropped by `party.applyOutcome`, which no shipped item needs. Original note: `systems/flow/battleFlow.buildBattle` should copy a trainer entry's `held` to the creature's `heldItem` and its `onEntry` onto the creature, pass `weatherKinds: WEATHER_KINDS` (or put them in the data) and, for the Weather Spire, `weatherCycle: SPIRE_BY_ID.weather.theme.rule`; `readCard` / `dossier` take the same `weatherCycle`. `party.applyOutcome` should drop the held item of every side-0 entry in `result().consumedItems` (no shipped item is consumable yet). The battle scene draws the weather from the `weather-start` / `weather-tick` / `weather-end` events (`scenes/battleAnims.js`, `drawWeather` in `scenes/battle.js`).
   - (Done: `js/data/tuning.js` passes all of these, with the stepped curve of §1.3.) Engine `DEFAULTS` that differ from GDD-00 and need `tuning` overrides: `payoutPerLevel` 40 → 50; `expYieldDivisor` 7 → 5; growth curves → the single 8·L² curve; `captureOddsMax` 0.99 → 0.95; `blackoutCap` 3,000 → 1,500 with a 500 floor; `captureBands` Low/Fair/Good → Slim/Fair/Good/Sure; Lantern grades → wick grades (Tallow ×1 100, Brass ×1.5 300, Skyglass ×2 600). `js/systems/exp.js` uses `EXP_DIVISOR: 7` too.
   - (Resolved: GDD-03's abilities landed and `validate-data` passes with `wardCount: 3`.)
3. **GDD-03 (creatures):** Errant catch rate: GDD-03 reads GDD-00's "~22% with a Tallow wick" at the Capture Stance floor (catch 56) rather than at full HP (catch 168); the verifier kept that reading, since Capture Stance is how every capture is taught. Tossup's yield is 50 for the night-one check (40 EXP from a Lv4 catch). The moves this chapter's trainers use on forms without a prototype learnset (each must be learnable at or below the level shown, or the validator warns):

| Form | Moves used (latest level they must be known by) |
|---|---|
| Reedkit | tap (6), reed-whip (6), spore-drift (24), root-knot (24) |
| Mothling | tap (11), dust-veil (11), dazzle (11), shardlight (13) |
| Rayling | salt-spray (18), breaker (18), tap (18), riptide (20), mirror-step (40) |
| Skirl | tap (6), downdraft (6), gale-cut (18), updraft (18) |
| Emberjaw | ember-lick (20), slag-burst (20), scorch (20), kiln-maw (22), flashover (42) |
| Rillfin | salt-spray (12), settle (12), tap (12), shellguard (12), breaker (24) |
| Rustcreel | rust-bite (26), corrode (26), iron-pin (26), tap (26) |
| Gillwick | salt-spray (25), reed-whip (25), mire-bloom (25), tidal-mend (32), riptide (32) |
| Duskwisp | murk (17), hush (17), echo-drain (27), drowned-bell (37) |
| Coilcrest | jolt (21), gale-cut (21), downdraft (21), updraft (21), live-wire (31) |
| Duskowl | murk (32), gale-cut (32), drowned-bell (32), hush (32) |
| Floeback | floe-ram (39), hoarfrost (39), stand-firm (39), cairn-crash (39), rime-lock (41) |
| Strandrunner | breaker (40), gale-cut (40), downdraft (40), riptide (40) |
| Hulkwight | snuff (29), iron-pin (29), drowned-bell (29), stand-firm (29) |
| Cairnward | shardlight (38), stand-firm (38), cairn-crash (38), dazzle (38) |

   Ward sentinels: Chillnub 13 (tap, frost-nip, settle), Cairnward 14 (shard-fling, settle, dazzle). The Reading's Vagary uses tailfall, starfall, riptide, kiln-maw, shardlight, hoarfrost, bandlight, echo-drain; its learnset now holds all eight by Lv30, the Reading's level floor, so no phase needs a learn-level exception.
4. **GDD-01 (world):** every trainer's `post` is a marker id to place on its `map`; route trainers' optional/mandatory status is in `declinable`. Spire interiors need the `order` steps' positions (door, sentinels, gallery, dais).
5. **GDD-02 (economy):** Crackdust 300 is below every Cairnhold route payout (600–750); heal-item fractions used by trainers: Salve 0.3, Tonic 0.6, Full Salve 1.0; held items used: Oilskin, Whetstone, Ballast Stone, Still Knot.
6. **GDD-07 (story):** owns the story script ids the rows point at; `TRAINER_SCRIPTS` never reuses a manifest script id (asserted). The Linnet arc forms used: Sootling "Cinder" Lv5 → Caldermaw at the dock; Caldermaw 11 at Brackenford; Sootling 39 at Rimeholt; **Emberjaw 46 at the gate** (Sootling's line's own middle form after two off-screen Shifts, same mark).

## 10. Manifest requests

None. Every id used is in `js/data/ids.manifest.js`. One table note: `spires` is listed under `UNMAPPED`; move it into `MANIFEST` when `DATA.spires` is wired.
