# GDD-02 — ECONOMY (LAMPFALL)

Chapter 2 of the full GDD. It turns GDD-00 §5–§9 and §15 into data and keeps every number inside the ranges GDD-00 allows. **GDD-00 wins** wherever this chapter could be read two ways. Ids are the frozen ids of `design/GDD-ids.md` and `js/data/ids.manifest.js`.

| File | Exports | What it holds |
|---|---|---|
| `js/data/tuning.js` | `TUNING` (+ named exports) | every designer-tuned number by name: every key of every system's `DEFAULTS`, plus the reference numbers (payouts, sinks, pacing targets) |
| `js/data/loans.js` | `LOANS`, `COMMISSIONS`, `COMMONS`, `LADDER_TOTAL` | the seven loans, the six room commissions, the six Commons projects |
| `js/data/dials.js` | `DIALS`, `CHALLENGES`, `TOGGLE_ORDER`, `DEFAULT_DIAL` | Drift / Flux / Freefall rule tables, the four challenge seals, the seed toggle bits |
| `js/data/shops.js` | `SHOPS` | all eight shops and counters: keepers, hours, staples, rotating pools, Wanted Today, decor, auction, refining, services |
| `js/data/items.js` | `ITEMS` | 65 rows: 26 items, 12 discs, 12 key items, 9 keepsakes, 6 goods and wallet rows |
| `test/data.economy-tables.test.mjs` | — | validator + manifest + cross-chapter references + every system accepts `TUNING` + GDD-00 numbers + the average-day sim (§4.1) |
| `tools/economy-sim.mjs` | `simulate`, `runAll`, `grindMinutes`, `PROFILES`, `SOURCES`, `SINKS` | the headless real-table sim (§4.4): `node tools/economy-sim.mjs [casual\|typical\|ideal\|grinder\|--json]` |
| `test/data.economy.test.mjs` | — | the economy and continuity verifier: validator + manifest over the economy and town tables, every GDD-00 §7/§9 number, every system tuning key, the Archive rows, and the §4.4 acceptance for three profiles |

---

## 1. The money model

**One wallet, one steering currency, no pressure.**

| Wallet key | What | Earned by | Spent on | Cap |
|---|---|---|---|---|
| `main` | **Buttons (◉)**, brass | everything the town and the isles pay | loans, shop goods, the Commons Jar, leftover rooms | none |
| `starsalt` | **Starsalt** | 800◉ at the Raft / Ludo / Varga's market stall (3 a day, shared); 3 per Spire win; 1–2 per skyglass node (refills per badge); 2 per Errant; every skyglass relic refines 1:1 at the Raft | Rerolls (1 / 2 / 4 / 8 … within one window) and Recall (6) — nothing else | buying capped 3 a day; never sold back |
| `anchors` | **Anchor stones** | Drift: 3 free, refilled to 3 per badge; Flux: Corin's 2, then 500◉ each; Freefall: 1 per badge, never sold | Anchor (one stone refuses one window) | none |
| `purse` | **The Keeper's Purse** | half of any blackout drop | returned in equal thirds with the next three Glints | — |

Why this shape:

- **Buttons are the only money.** Every income source ends as buttons, and every loan is buttons only, so a fisher, a forager and a battler all climb the same stick. The Summit Purse is cut (forced savings read as a deadline).
- **Starsalt is the only thing that steers a Forecast,** so the player's decision about odds never competes with the house. It has two clocks: the night low (relics, refined 1:1) and the daily 3-a-day purchase. Because the Raft and Ludo between them sell every hour from 12:00 to 08:00, Reroll is never tide-locked.
- **Anchor stones are priced in buttons** (500◉ on Flux) but come mostly from the quarry leg and the badge refill, so refusing a Shift is affordable but never free on the intended dial.
- **The blackout costs daylight, not progress.** 10% of buttons on hand, capped at 1,500, nothing under 500 — and half of that comes back through the Glint. Loans, items, Starsalt, stones and badges are untouched.

### 1.1 Fixed prices

There is no dynamic pricing and no diminishing return: an item costs its row `price × priceMult` (every shop runs at 1.0) and goods sell at full value to the two buyers. The placeholder tuning's `shopDiminishingAfter/Mult` were removed for this reason. The only modifiers are fixed and announced: **Wanted Today** (+50% on three items, one stack each a day) and the **Consignment Crate** (90%, overnight, anything).

---

## 2. Income

All amounts from GDD-00 §7; where the source is a system, the tuning key is named.

| Source | Amount | Limit | Where it lives |
|---|---|---|---|
| Native fruit / ripe | 120 / 150 | ~100 trees, 3 a tree, regrow 2 days, ripe after 3 | GDD-05 collections; `fruitPerTree`, `regrowDaysDefault`, `fruitRipeDays`, `fruitRipeMult` |
| Foreign fruit / ripe | 480 / 600 | grafts, seedlings (2,000◉ at Ludo / the market), gifts | GDD-05; `fruit-seedling` row |
| Purses in trees | 200–600 in 50s | 6 purse trees, one each a day | `purseRange`, `purseStep` |
| **The Glint** | 500 + 60 × day | exactly one a day, any low | `glintBase`, `glintPerDay` (night one's is 620) |
| Honeycomb | 350 | ~4 bee trees, after the 1-second hum | `honeycomb` row; `hiveHumMs` |
| Fish (18) | 80–4,200 | 4–8 shadows per reach; reach health floor 40%, recovers in a day | GDD-05; `fishShadowsPerReach`, `fishReachFloor`, `fishReachRecoverMinutes` |
| Bugs (10) | 60–900 | more at lit porches and string lights | GDD-05; `bugLightMult` |
| Fossils / relics / shore finds | 300–1,500 / 300–1,500 / 100–400 | ~4 cracks a day, 3 sparkles per low; cleaned +40% | GDD-05; `cracksPerDay`, `sparklesPerLow`, `findCleanMult` |
| Skyglass relic | 1 Starsalt at the Raft, or 900◉ to Barnaby | max 3 per night low | `relicStarsaltRate`, `relicBarnabyPrice`, `skyglassPerNightLow` |
| Route trainer | 50 × highest level | once each | `payoutPerLevel` (engine) |
| Spire win | 200 × ace + 3 Starsalt (1,800 / 3,200 / 4,400 / 5,800 / 7,200 / 8,600) | once | `spireWinPerAce`, `spireAceLevels`, `spireWinStarsalt` |
| **Spire share** | 10% of the open loan, notched on Wren's ledger | once per badge | `spireShareFraction` |
| Porch Duel | 30 × curve level | 3 a day | `porchDuelPerCurve`, `porchDuelsPerDay` |
| Errant beaten or caught | 1,500 + 2 Starsalt | each returns the next day | `errantButtons`, `errantStarsalt` |
| Wanted Today | +50% on 3 items | one stack each a day | `wantedTodayMult`, `wantedTodayCount`, `wantedStacksPerDay` |
| Consignment Crate | 90% of value | overnight, anything | `crateRate` |
| **Resident share** | 5% of the open loan (one notch) | per finished lead thread; after payoff 4,000 to the Commons Jar | `residentShareFraction`, `residentShareAfterPayoff` |
| First Night Errands | 6 × 500 off loan 1 | loan 1 only | `errandCredit`, `errandCount`, `errandTier` |
| Gallery frames | 1,000 per 6 Held forms framed | Gallery commission | `galleryFrameButtons`, `galleryFrameForms` |
| Champion | 10,000 | once | `championPrize` |

**Who buys.** Pell's (08:00–22:00) and Ludo (22:00–08:00) both `buysAll` at full price, so *someone is always buying* at every minute (unit test). Barnaby buys finds once they are pinned (duplicates), and pays 900 for skyglass. The Crate takes anything at 90% and settles at 06:00.

### 2.1 The daily wallet model (before sinks)

GDD-00's targets, which the economy sim reads from `tuning.dailyIncomeTargets`:

| Days | Gross a day | Typical mix (24-minute day) |
|---|---|---|
| 1 | 3,000 + 3,000 errands | 18 fruit (2,160), a purse (300), a nest (350), a perch, Pip (200); Ludo buys the lot |
| 2–3 | 8,000 | orchard sweep (~3,000), the Glint (~640), two purses, quay fish, Lowmoor trainers (~350 each), badge 1 (1,800) |
| 4–6 | 15,000 | orchard + a graft, the Glint, Cairnhold trainers (~550–700 each), a Porch Duel (~300), night fish, Wanted Today |
| 7–9 | 25,000 | foreign fruit begins, Emberstep trainers (~900), Errant (1,500), Porch Duels (~600), John Dory at the night low (2,400) |
| 10–12 | 35,000 | three trainers (~1,350 each), foreign orchard, Porch Duels (~800), two John Dory and a wolffish (~9,000) |
| 13–15 | 45,000 | Rimeholt trainers (~2,000), foreign orchard at full yield, three Porch Duels (~1,100), night headliners |

Cumulative gross by day 14 = **337,000** (GDD-00: ≈ 335,000).

---

## 3. Sinks

| Sink | Price | Rule |
|---|---|---|
| Tallow / Brass / Skyglass Wick | 100 / 300 / 600 | ×1 / ×1.5 / ×2 capture odds; Skyglass from badge 2 |
| Salve / Tonic / Full Salve | 80 / 240 / 600 | 25 HP / 70 HP / full (each heal spends a Mend in battle) |
| Revive | 600 | 50% HP |
| Ether / Full Ether | 250 / 700 | 10 PP each move / full; Pell's from badge 3 |
| Poultice / Warm Shawl | 150 / 150 | burn + poison / chill + numb |
| Crackdust | 300 | suppresses a Ward 3 turns; Pell's always, Cairnhold clinic; below one Cairnhold route payout (≥ 450) |
| Still Knot | 2,000 | the Anchorage and the clinic |
| Held items (6) | 1,200–2,000 | one a day at Pell's from badge 2 |
| Anchor stone | 500 | Drift and Flux only (Pell's, the Anchorage, the clinic) |
| Starsalt | 800 | 3 a day, shared (the Raft, Ludo, Varga's market stall) |
| Technique discs (10 sold) | 1,500–3,500 | Pell's two a day; one coverage disc face-up from badge 4; Dov's auction (never above shelf price) |
| Ferry | 200 | free from badge 2 |
| Commons projects (6) | 3,000–12,000 | the jar; neighbours add 10–30% |
| Furniture / clothes / string lights | 200–6,000 | Pell's and the Lantern Market rotate them (GDD-05 prices) |
| Leftover rooms | 20,000 each | after the Relighting |
| Fruit seedling | 2,000 | pays back in about three days of a foreign tree |

The sim books **a quarter of gross** to sinks from day 2 (`sinkShare` 0.25): early on this is mostly wicks and Salves; mid-game discs, an Ether habit, Starsalt and the Commons; late game furniture.

---

## 4. The loan ladder and pacing

| Tier (id / manifest) | Amount | Notch | Build | Target day | Sim clears | Lands 05:40 |
|---|---|---|---|---|---|---|
| `tier-1` / `loan-1` | 6,000 | 300 | the Bedsit: porch lamp at payment, roof overnight | 1 | 1 | day 2 |
| `tier-2` / `loan-2` | 15,000 | 750 | the Cottage (two rooms, mirror, satchel +10) | 3 | 4 | day 5 |
| `tier-3` / `loan-3` | 25,000 | 1,250 | Commission One (Wren's first own design) | 5 | 6 | day 7 |
| `tier-4` / `loan-4` | 36,000 | 1,800 | Commission Two | 7 | 8 | day 9 |
| `tier-5` / `loan-5` | 50,000 | 2,500 | Commission Three | 9 | 10 | day 11 |
| `tier-6` / `loan-6` | 66,000 | 3,300 | Commission Four; Wren offers the Lamp Room | 11 | 12 | day 13 |
| `tier-7` / `loan-7` | 80,000 | 4,000 | the Lamp Room | 13 | 14 | day 15 |
| | **278,000** | | | | | **Relighting: day 15** |

Every stick has twenty notches; one notch is 5%, so a finished life thread is literally one notch. Wren flicks one bead per 1,000 (faster after ten); Ambrose gnaws one notch per 5%; the stick splits when the loan clears and the roof colour is picked (slate blue is the cursor default). One build lands a night, so the ladder can never finish in fewer than seven nights.

### 4.1 The economy sim (the "average day" model)

`test/data.economy-tables.test.mjs` runs it on every test run: gross from §2.1, a quarter to sinks from day 2, errands on night one, a Spire share on badge days 3 / 5 / 7 / 10 / 11 / 13, a resident share as the six lead threads finish on days 8–13, everything else paid at the yard each evening, one build per night.

| Day | Gross | Sinks | Shares | Paid | Loan open (paid / amount) | Lands 05:40 |
|---|---|---|---|---|---|---|
| 1 | 3,000 | 0 | 3,000 (errands) | 3,000 | 2: 0 / 15,000 | — |
| 2 | 8,000 | 2,000 | — | 6,000 | 2: 6,000 / 15,000 | the Bedsit |
| 3 | 8,000 | 2,000 | 1,500 | 6,000 | 2: 13,500 / 15,000 | — |
| 4 | 15,000 | 3,750 | — | 11,250 | 3: 9,750 / 25,000 | — |
| 5 | 15,000 | 3,750 | 2,500 | 11,250 | 3: 23,500 / 25,000 | the Cottage |
| 6 | 15,000 | 3,750 | — | 11,250 | 4: 9,750 / 36,000 | — |
| 7 | 25,000 | 6,250 | 3,600 | 18,750 | 4: 32,100 / 36,000 | Commission One |
| 8 | 25,000 | 6,250 | 1,800 | 18,750 | 5: 16,650 / 50,000 | — |
| 9 | 25,000 | 6,250 | 2,500 | 18,750 | 5: 37,900 / 50,000 | Commission Two |
| 10 | 35,000 | 8,750 | 7,500 | 26,250 | 6: 21,650 / 66,000 | — |
| 11 | 35,000 | 8,750 | 9,900 | 26,250 | 6: 57,800 / 66,000 | Commission Three |
| 12 | 35,000 | 8,750 | 3,300 | 26,250 | 7: 21,350 / 80,000 | — |
| 13 | 45,000 | 11,250 | 12,000 | 33,750 | 7: 67,100 / 80,000 | Commission Four |
| 14 | 45,000 | 11,250 | — | 12,900 | paid off | — |
| 15 | | | | | | **the Lamp Room → the Relighting at dusk** |

Results at defaults: **Relighting on day 15** (acceptance 11–16); Spire shares **27,200** (GDD-00: ~27,000); resident shares 17,400; every loan clears within a day of its target. **Grind check:** the shortfall on each target day, divided by that day's net income per real minute, is at most ~15.5 real minutes (loan 5 on day 9: 12,100 short at ~780◉ a minute) against the 30-minute cap.

The model is deliberately the *average* player: GDD-00 §12's Day 10 is a *good* day (loan 5 already paid by day 10's dawn), one day ahead of the sim. Both land inside 11–16.

### 4.4 The real-table sim (`tools/economy-sim.mjs`, verified by `test/data.economy.test.mjs`)

§4.1 checks the *model*; this sim checks the *content*. It plays the season day by day against the shipped rows and the real money systems, and a profile decides only what a player chooses to do:

- **Income from data:** 100 town trees (town `TREES`) on a per-tree regrow / ripen clock, plus foreign trees from seedlings and the Greenhouse; purses and bee trees; the Glint through `wallet.collectGlint`; fish drawn from `collections.FISH` with `gather.rowActive` / `modsFor` on the Pellwick map's reaches at the real tide (`clockSys.tidesForDay`). The player casts at the biggest shadow class in view, lands it by bite window × skill, and reach health dips 10% a fish, floors at 40% and recovers over a day, as in `systems/fishing`. Bugs and finds come from `BUGS` / `FINDS`, and the first of each find is pinned and never sold. Skyglass comes at the real night lows (`gather.lowTouchesNight`). Route trainers and Spires pay their `data/trainers` payouts; Porch Duels pay `porchDuelPerCurve` × `PORCH_DUELS.curveByBadges`; Errants, Wanted Today and the Crate use their tuning values.
- **Credits through `systems/loans`:** `pay`, `errand`, `spireShare` and `residentShare`. Commissions are picked as tiers clear, one build lands each night at 05:40 through `landDue`, and the Relighting fires at the dusk the Lamp Room lands. Commons projects go through `depositJar` / `fundProject`.
- **Sinks at shipped prices:** wicks by badge, medicine per battle (half a Salve → Tonic → Full Salve), discs, held items, Starsalt, stones, seedlings, Commons shares, Pell's furniture and clothes, the ferry, blackouts (`wallet.blackout`; half comes back through the Glints).
- **Time:** every verb costs real seconds of running clock (a tree 9 s, a cast 11 s, a crack 9 s…) and every scene costs paused minutes (a route trainer 1.3, a Spire 5, a duel 1.2…). The verbs must fit the waking clock; the test fails on any overflow.

| Profile | Plays | Loans cleared on day | Relighting | Real min / day | Sinks | Top sources |
|---|---|---|---|---|---|---|
| **Casual** | sleeps at 22:00, 21 min of talk a day, decorates, crates 30% | 1 / 3 / 6 / 9 / 12 / 15 / 19 | **day 20** | 45.6 | 17.6% | fruit 28%, fish 12%, Spire shares 9%, finds 9%, Spires 9% |
| **Typical** | the average day: ~10–13 trees, a leg most days, 1–3 duels, 4–9 night casts, most night lows; sleeps at 01:00 | **1 / 3 / 5 / 7 / 9 / 11 / 13** | **day 14** | 37.4 | 19.1% | fruit 23%, fish 20%, Spires 8%, finds 8%, Spire shares 7% |
| Ideal (reference) | GDD-00 §5's "what a good day does", every day | 1 / 3 / 4 / 6 / 8 / 10 / 12 | day 13 | 37.7 | 19.0% | fruit 21%, fish 20%, finds 11% |
| **Grinder** | never sleeps; every capped verb at its cap; fishes every second left | 1 / 2 / 2 / 3 / 4 / 5 / 7 | **day 8** (the floor) | 40.3 | 4.7% | fruit 34%, fish 26%, finds 11% |

The typical player clears every loan on its target day; the day before each target it is still 3,000–31,000 short, so the result is not balanced on a knife edge. Its night one pays loan 1 in ~15 real minutes. Its Spire shares come to 28,800 (GDD-00: ~27,000) and its resident shares to 19,600. Because every loan lands on its target day, it never needs grind. Daily gross runs above the §2.1 model early and meets it late: days 2–3 ≈ 14,000, 4–6 ≈ 20,000, 7–9 ≈ 27,000, 10–12 ≈ 44,000. The early surplus is the flat town income (fruit, purses, the Glint) against a model that starts at 8,000. The *ideal* day runs a day ahead, as §4.1 says of GDD-00's Day 10. The grinder earns ~451,000 by day 7 and is held by the one-build-a-night floor alone. **No source is above 35%** of any profile's income, and every profile lives on at least six sources above 3%.

**What the verifier changed to get here** (all inside GDD-00's ranges):

1. **Night headliners** (`collections.js`): John Dory weight 2 → **0.4**, lantern wolffish 1 → **0.15**, sea bass 3 → **2**. Prices are untouched (2,400 / 4,200 / 900). At the old weights a forked shadow was in view on ~70% of fresh night casts, and the typical player relit on day 10 with fish at a third of all income; the grinder's fish share was 44%. Now a forked tail shows in about one view in four, and a ten-cast session lands one or two headliners, as GDD-05 §1.2 estimates.
2. **Greenhouse indoor trees** (`loans.js`): 4 → **2**. Four foreign trees on top of the seedlings put fruit alone at ~15,000 on harvest days by day 10.
3. **Weather effects** (`tuning.js`): synced with `town.WEATHER_TUNING` (GDD-05). No pacing effect.

No GDD-00 number had to move.

### 4.2 Shares pull the two tracks together

A Spire share is 10% of the **open** loan, so a badge earned late is worth more: badge 4 on day 10 notches 6,600 onto loan 6 (the Day 10 script's number). A battler who holds six badges early still owes a lot (the shares only cover ~10% of each tier); a grinder who relights with two badges has paid in fish. Neither is walled: loans gate only the house, badges only the reader tools and the Summit.

### 4.3 If the cozy path stalls

GDD-00's order of levers, encoded as reference keys: raise `porchDuelPerCurve` first (30 → up to 45), then `purseRange`; never fruit prices, never friction. A stall shows in the sim as a loan clearing more than a day after its target.

---

## 5. Commissions and the Commons

**Room commissions** (`COMMISSIONS`, pick 4 of 6 at loans 3–6; the two left over are 20,000 each after the Relighting):

| Room | Town effect | Creature effect | Machine keys |
|---|---|---|---|
| Training Yard | chalked yard; Tully trains there | 3 stored creatures earn 25% of party EXP | `yardSlots 3`, `yardShare 0.25` |
| Workshop | fossil cleaning bench (+40% overnight) | polish a skyglass relic into a type tilt | `cleanMult 1.4`, `tiltsFrom`, `tiltIds` |
| Greenhouse | grafting bench, indoor fruit (two indoor foreign trees) | +1 Bond once with the favourite fruit; Moss lead ripens a graft a day sooner | `indoorTrees 2`, `bondNight 1`, `mossGraftNightsSooner 1` |
| Cellar | cold storage, Keepsakes safe, satchel +10 | storage 20 → 40 | `satchel 10`, `boxCapacity 40` |
| Porch & Loft | second porch seat; Porch Duels at home | telescope shows Errants on the map | `porchSeats 2`, `telescopeErrants` |
| Gallery | tally wall, Odile's canvases, Field Log plates | Shiftlog strip +1 Bond once; 1,000 per 6 Held forms framed | `frameButtons 1000`, `framePerForms 6` |

No commission gates a fairness tool: Memory relearn and Recall live at the Archive desk.

**Commons projects** (`COMMONS`; the player pays `cost − round(cost × neighborShare)`):

| Project | Cost | Neighbours | You pay | Effect |
|---|---|---|---|---|
| Dark House 1 | 3,000 | 30% | 2,100 | Tamsin moves in; her porch lights |
| Quay Lamps | 4,000 | 20% | 3,200 | +1 night shoal on the quay |
| Mudlark Mile Flags | 5,000 | 30% | 3,500 | Tully's race course |
| North Creek Footbridge | 6,000 | 20% | 4,800 | a short way to the weir and Ansel's launch |
| Training Yard on the Green | 10,000 | 10% | 9,000 | badge 5; the Yard for players who skipped the room |
| Lantern Market Third Stall | 12,000 | 20% | 9,600 | a second decor table on market nights |

Shares are larger where the neighbour cares most (Tamsin's family, Tully's race) and smallest on the Yard, which is a creature tool.

---

## 6. Shops

| Shop | Keeper | Hours | Staples | Rotating | Buys |
|---|---|---|---|---|---|
| **Pell's Sundries** | Juniper | 08:00–22:00 | 3 wicks (Skyglass from badge 2), 4 medicines + Revive, Ethers (badge 3), 2 cures, Crackdust, anchor stones (Drift/Flux), the chip disc (badge 1) | 2 discs a day; 1 coverage disc from badge 4; 1 held item from badge 2; 3 furniture + 2 clothes | anything, full price; Wanted Today |
| **Ludo's Eave** | Ludo | 22:00–08:00 | Starsalt (3/day shared), a seedling, moth-silk | 2 night odds and ends (wicks, Salve, Revive, cures) | anything, full price |
| **The Carnival Raft** | Varga | 12:00–02:00 from day 3 | Starsalt (3/day shared) | — | refines skyglass relics 1:1; Shift fair on market nights |
| **The Anchorage** | Merrow | 07:00–19:00 | anchor stones (Drift/Flux), Still Knot | — | — |
| **Cairnhold Clinic** | Wynn Cobble | 07:00–19:00 | anchor stones, Still Knot, Crackdust, Salve, Poultice | — | — |
| **Lantern Market** | Dov | Saturdays 20:00–02:00 from day 7 | Varga's Starsalt, Ludo's seedlings, string lights | 1 disc; 4 furniture + 2 clothes; **day 7: Dov's sealed-crate auction** | — |
| **Archive Desk** | Barnaby | 09:00–19:00 | — | weekly Bounty: 3 specimens at +50% | duplicate finds; skyglass 900; Memory relearn free; Recall (Corin, 6 Starsalt, badge 4) |
| **Consignment Crate** | Wren | always | — | — | anything at 90%, paid at 06:00 |

**Dov's sealed-crate auction** (first Lantern Market, day 7): three crates — the Tarred Crate always holds *Stand Firm*, the Salt-Stained Crate one of the three coverage discs, the Rope-Bound Crate one of four rotation discs; which crate is which is seeded (`shop:7`). Opening bid 800, steps of 100; rivals fold between 60% and 90% of the disc's shelf price, and **you never pay more than Pell's would charge**. The auction is a bargain and a show, never a loss.

**Juniper's back room** holds the heirlooms (the Dorrows' kettle, the Bracks' Still Knot, the grade-two lantern, Bryony's seed tin, the easel, Thessaly's almanac) and Isolde's Lantern; they go home free when a letter lights a porch, and are never on a shelf.

**The seed validator's rules hold by construction:** Crackdust is a staple at Pell's from day 1 and at the clinic before any mandatory Ward; the chip-damage disc (*Spore Drift*, poison chip through Wards) is a Pell's staple from badge 1 and in the rotation before it.

---

## 7. Items

65 rows. Highlights (full list in `js/data/items.js`):

| Group | Rows | Notes |
|---|---|---|
| Wicks | Tallow 100, Brass 300, Skyglass 600 | `use` = `capture:1/2/3` (`tuning.lanternGrades` ×1 / ×1.5 / ×2); stack 50 |
| Medicine | Salve 80 (25 HP), Tonic 240 (70 HP), Full Salve 600, Revive 600 (50%), Ether 250 (10 PP each move), Full Ether 700 | `heal` / `revive` / `pp` |
| Cures | Poultice 150 (burn, poison), Warm Shawl 150 (chill, numb) | `cure` |
| Battle | Crackdust 300 (Ward suppressed 3 turns; refused and kept with no Ward) | `ward-suppress` |
| Held | Still Knot 2,000; Whetstone 1,200; Cork Float 1,500; Oilskin 1,200; Ballast Stone 1,200; Lucky Button 2,000; Tally Charm 1,500 | `hold`; effects in `held` |
| Type tilts (6) | 1,800 notional, sell 900, never on a shelf | Workshop-polished skyglass; `held.forecastTypeMult` 2 |
| Isolde's Lantern | keepsake, one of a kind | `sure-catch`; asks first, cursor on No |
| Discs (12) | 1,500–3,500; Gnash and Plumbline never sold | `disc`, reusable |
| Key items (12) | tools pocket, never sold | `key`; String Lights 1,500 at the market |
| Keepsakes (9) | heirlooms and thread rewards | one of a kind; the Bracks' Still Knot works as a Still Knot |
| Goods | Starsalt (wallet), Anchor Stone (wallet), Honeycomb 350, Timber 120, Moth-silk 450, Fruit Seedling 2,000 | goods kinds sell at full value (`fullPriceKinds`) |

Spares sell back at 50% (`spareSellRate`); goods kinds sell at full price.

---

## 8. The Chaos dial and challenges

| | Drift | **Flux** | Freefall |
|---|---|---|---|
| Up / Side / Down | 50 / 40 / 10 | 40 / 35 / 25 | 30 / 30 / 40 |
| After the Relighting | 50 / 45 / 5 | 40 / 40 / 20 | 30 / 35 / 35 |
| Bond cap (+5 per pip, Down → Up) | 5 | 15 | 10 |
| Stat floor | 10% | 20% | none |
| Pool weights | source | source | flat |
| Unseen forms | shown | shown | silhouettes |
| Anchor stones | 3 free, refill per badge | 2 from Corin, then 500◉ | 1 per badge, not sold |
| Read | free | free | costs the turn |
| Capture display | exact % | exact % | bands: Slim / Fair / Good / Sure |
| Summit Bell holds your place | yes | yes | no |
| Disc confirm | — | — | above 2,500 |

`rules` per dial (validator / engine row): `readCostsTurn` (Freefall only), `captureDisplay` ('percent' / 'band'), `wardBadge` true on every dial (the Ward tell is a fairness pillar), `runAllowed` true, `holdOutTurns` 0 (scripted battles set their own), `rerollCostMult` 1, `anchorsAllowed` true.

**Challenges**: No Rewind (one autosave slot, no manual saves) and One Heart (only the starter battles) ship; Ride the Dice (Anchor disabled) and Blind Read (types only, no Scouting Prism) are `optional: true`. **TOGGLE_ORDER** = `no-rewind, one-heart, ride-the-dice, blind-read` — append-only; the seed code has room for four more.

---

## 9. `tuning.js` conventions

- **One flat table.** Each system's `tuningOf` picks its own keys and ignores the rest, so keys are named exactly as the systems name them. The test imports every system, resolves `TUNING` through it and checks that every `DEFAULTS` key is present and accepted; when a lane adds a key the test fails until the key is added here.
- **Collisions resolved.** `blackoutCap` is 1,500 for both the wallet and the engine (the engine's 3,000 was a prototype value). Engine duplicates of creature-lane keys (`benchShare` / `BENCH_SHARE`, `expYieldDivisor` / `EXP_DIVISOR`, `captureBands` / `CAPTURE_BANDS`…) hold the same values. `world/npc` and `world/roamer` both use `pauseMin/pauseMax` with different meanings, so their feel tables are nested (`npcFeel`, `roamerFeel`) and passed as their per-call `opts.tuning`.
- **Values changed from the systems' prototype defaults to GDD-00:** `EXP_DIVISOR` / `expYieldDivisor` 7 → 5; every growth curve → 8 × L²; `WINDOW_LEVELS` 9 → 8; `payoutPerLevel` 40 → 50; `CAPTURE_ODDS_MAX` / `captureOddsMax` 0.99 → 0.95; capture bands → Slim / Fair / Good / Sure; engine wick prices → 100 / 300 / 600 with the wick names; `BOX_CAPACITY` 120 → 20; `noRepeatDays` 3 → 5; `porchWindow` → 19:00–01:00; `homePorchId` → `porch-keepers-cottage` (plus the seven `porchesLitAtStart`); `wardCount` 0 → 3; `DAMP_SOURCES` adds `duel`; `ANCHOR_CHALLENGE_COST` emptied (no shipped challenge raises it); festivals → the Lantern Market only (the others are story / tide triggered).
- **Reference keys** (payouts, sinks, pacing targets) are read by no system yet; they are here so scripts, the sim and other chapters take numbers from one place.

---

## 10. Integration notes (for the orchestrator)

1. **Wiring.** `index.js`: `ITEMS` ← `items.js`; `LOANS` ← `loans.js` (also add `commissions: COMMISSIONS` and `commons: COMMONS`, the table names `systems/loans` reads); `SHOPS` ← `shops.js`; `DIALS`, `CHALLENGES`, `TOGGLE_ORDER` ← `dials.js`.
2. **Tuning reaches systems through `ctx.tuning` / `{tuning}`,** not as a registry table: `createRegistry` rejects the SCREAMING / camelCase keys as ids (347 `bad id` problems if `tuning` is put in `DATA`).
3. **`test/data.tables.test.mjs` line 94** asserts every `TUNING` value is a number or object; `TUNING` now carries every system key, including strings and booleans (`TIDE_BAR_LIT_FLAG`, `USE_FAMILY_WINDOWS`…). The assertion needs `string` and `boolean` allowed.
4. **`wardCount` is 3** (Glasshide, Mirrorveil, Stillcoat). Until GDD-03's abilities replace the placeholder, `validateData` on the shipped DATA reports `abilities:*: 0 Ward abilities`; `test/data.test.mjs` and `test/data.manifest.test.mjs` pass the shipped `TUNING` to ward-less fixtures and need `wardCount` overridden for them.
5. **The porch window wraps midnight** (19:00–01:00). `js/script/registry.js` now compares it with wrap-around, so `test/script.registry.test.mjs` passes with this table; any other reader of `porchWindow` must wrap too.
6. **Storage 20 → 40.** `systems/party` reads one constant `BOX_CAPACITY` (now 20); the Cellar's `effects.boxCapacity: 40` needs a per-world capacity in `systems/party`.
7. **Collections are not items.** `systems/shops` (`sell`, `wantedToday`, `crateDeposit`) looks only in `items`, so fish, bugs, finds and fruit cannot be sold, wanted or crated until shops falls back to `collections` (or the orchestrator merges the lookups). Pell's `wantedPool` already lists them.
8. **The cond DSL's `day.dow` counts from core day 0** (dow 6 = GDD Saturday), unlike the calendar (0 = Monday). The Lantern Market's `cond` uses dow 6 / 0 accordingly; if `cond.js` moves to the calendar weekday, change it to 5 / 6.
9. The validator's `buys` kinds are the four collection kinds; honey, timber and silk sell through the two `buysAll` buyers and the Crate.
10. **Maps (GDD-01): Pellwick has no `flats` reach.** Its reaches are two `river` reaches, two `quay` reaches and the north creek. Dab, sand eel and glimmer sprat (`where: ['flats', …]`) therefore cannot be caught in town, though GDD-05 places them in "the point flats channel". The sim fishes the reaches as drawn, so it already allows for this. Adding a point-channel reach of kind `flats` would bring them back.
11. **`test/data.tables.test.mjs` is stale against the shipped tables.** It requires every `TUNING` value to be a number or object (systems need string and boolean keys) and expects `wallet.main` to read "coin" (the currency is buttons). Neither can be fixed in data; the test needs updating.
12. **`tools/economy-sim.mjs` reads every system's numbers at run time,** so a lane that changes a payout, a weight or a tuning key moves the §4.4 table. `test/data.economy.test.mjs` re-checks the acceptance on every run.

## 11. Manifest requests

1. **Loan ids.** The manifest says `loan-1…loan-7`; the validator, the cond DSL (`{loan: {tier}}`) and `systems/loans` require `tier-1…tier-7`. The rows use `tier-N` and carry `manifestId: 'loan-N'`. Request: change `LOAN_IDS` to `tier-1…tier-7` (GDD-ids §15 too), or teach the validator and `cond.js` the `loan-N` form.
2. **Build ids.** `bedsit`, `cottage`, `lamp-room` (and the six commission ids) are build ids used by `systems/loans` and the `sys.build.<id>` flags; no manifest table lists them. Request: a `BUILD_IDS` list.
3. **DATA table names.** `UNMAPPED.commissions` and `UNMAPPED.commonsProjects` can map to the `commissions` and `commons` tables this chapter provides (`systems/loans` reads `commons`, not `commonsProjects`).
4. **`restless`.** GDD-00 §8 mentions a Restless challenge (windows 6/12/18/26/34/42) that is not in `CHALLENGE_IDS` and not in §15's ship list; it is left out (and `ANCHOR_CHALLENGE_COST` no longer names it). Add it to the manifest only if it is meant to ship.
5. **`porch-supper`.** `systems/schedule`'s default festivals include a Porch Supper that is not a GDD-00 festival; it is not in `tuning.festivals`.
