# GDD-05 — TOWN LIFE

Pellwick's half of the game: the verbs you do between isle legs, the clock they run on, and the
rule that ties every one of them to the creature in front of you. GDD-00 (§5–§9, §16) is binding;
this chapter fills in content and starting values inside its ranges and renames nothing.

**Data.** `js/data/collections.js` (18 fish, 10 bugs, 18 finds, 9 fruit as §14.12 rows) and
`js/data/town.js` (trees, furniture 24, clothes 12, roofs 8, commission scenes, Commons effects,
4 festivals, the Porch Duel slate, `creatureBonuses`, weather, Day Page, boards, 24 stamps).
**Test.** `test/data.town.test.mjs`: validator and manifest clean for `collections`; every cond in
both files well-formed against the manifest; and each table run through the system that reads it
(fishing, gather, fieldLog, weather, schedule, loans).

---

## 1. The three loops

### 1.1 The minute (1–3 s verbs)

| Verb | Tool | What happens | Numbers |
|---|---|---|---|
| **Shake** | none (tool stowed and handed back) | one fruit a press, three to a tree; or the day's purse; or a gull-dropped shell; or the bee hum | purse 200–600 in 50s; shell 15% on quay/point trees |
| **Net** (bees) | net offered on the hum | 1 s hum and gold specks, then the nest drops; caught = honeycomb | honeycomb 350; miss = three cartoon bees for one game hour, nothing lost |
| **Cast** | rod | shadow → cast → 1–3 feints → bite window → land | Standard 7–31 frames by species; Gentle 36–54; Patient holds to reel |
| **Net** (bugs) | net | walk up (2 tiles is safe for most), swing on the tell | spook = gait radius × row `spook`; `wary` misses |
| **Dig** | shovel | the Glint, a skyglass relic (night low), a sparkle, a crack: in that order | ~4 cracks/day, 3 sparkles/low, 1–3 skyglass/night low, 1 Glint/day |
| **Rake** | shovel | cockles on the flats at a low | 4 rakes/low, 1–3 cockles each |
| **Read** | Reading Glass | names a find on the spot; Reads a Prismoth at your lamp (*Ward ?*) | free |

Nothing in the minute asks for timing except the Standard bite, and Gentle and Patient remove even
that (Patient keeps its own record board). Back never drops anything.

### 1.2 The day (24 game hours, 24 real minutes)

The town day is built so that **someone is always buying and something is always worth doing**:

| Hours | Town verbs that are best now | Buyer |
|---|---|---|
| 06–09 | Mailbox, gate boards (Ledger, Tide Table, Commons slip with weather odds and the Duel slate), the Crate's overnight sale; the orchard with a Gust lead; one bee hum | Juniper from 08 |
| 09–12 | Pell's: sell, Wanted Today, wicks; Barnaby names the finds in one batch; red admirals bask on windfalls; stickleback and trout on the river | Juniper, Barnaby (09–19) |
| at any low | the Glint, sparkles, dab and sand eel in the flats channels, sandhoppers on the wrack line; the Old Quay on a spring low (lumpsucker) | — |
| 15–18 | golden hour on the point; sell; pay at the yard | Juniper |
| 17:30–22 | sea bass off the point, hawk-moths at string lights, dor beetles in the lanes, sea trout at dusk | Juniper to 22 |
| 18–02 | Hesper's family letter; porch talk 19–01; **Porch Duels** (3 a day); Porchlight Hours 20–02; Lantern Market on Saturdays | Ludo from 22 |
| night | **night sea fishing** (John Dory 2,400, lantern wolffish 4,200), silver eels, moths at every lit porch, glow-worms in the reeds | Ludo to 08 |
| night low | glowing flats: skyglass relics, glimmer sprat, starflies | Ludo, the Raft (to 02) |
| any time | Rest: Day Page and *Tomorrow:* | the Crate (overnight, 90%) |

**Daily town income at mid-game** (no isle leg, 24-minute day): fruit ~35 presses × 120–150 ≈ 4,800;
6 purses ≈ 2,400; the Glint 500 + 60 × day (≈ 1,100 on day 10); 2–3 honeycomb ≈ 900; a quay
session and a night low ≈ 6,000–10,000 with one or two headliners; 3 Porch Duels at curve 26 =
2,340; finds and bugs ≈ 1,500. That is ≈ 19,000–23,000 from town alone, inside GDD-00's
days 7–12 band (25,000–35,000) once an isle leg is added, and never more than a session's worth of
any one verb (reach health floors at 40%; purses and the Glint are once a day; fruit regrows in two
days).

### 1.3 The week (7 days ≈ 3 h)

| Day | Town beat |
|---|---|
| Monday | life-thread beats advance for threads you are in; **Archive Bounty** refreshes (3 wanted specimens at ×1.5: fish, bugs, finds, Held forms or creature drops) |
| daily | Wanted Today (3 items, +50%, one stack each; may name a Held form's drop); Porch Duel slate |
| Saturday (days 7, 14, 21…) | **spring tide**: the Old Quay is bared at the low (lumpsucker, the fleet's bell after K7); **Lantern Market** 20:00–02:00 |
| a spring low after Tully's beat 4 | **Mudlark Mile** |

---

## 2. Fish (18)

Shadows come in four size classes (`small`, `medium`, `large`, `forked`) and six silhouettes
(finned, round, flat, ribbon, school, forked). The **tell** is shape + sound + word, learned after
three catches (one with a Brine lead), and is shown everywhere afterwards. `where` names reach kinds
(`river`, `quay`, `sea` = the quay after dark, `creek`, `flats`, `old-quay`, `lagoon`), so the same
rows serve Pellwick and the isles.

| Fish | Where | When | Tide | Shadow | Bite (frames) | Price | Tell word |
|---|---|---|---|---|---|---|---|
| Perch | river | any | any | small finned | 26–31 | 80 | Barred |
| Stickleback | river, creek | day | any | small finned | 27–31 | 90 | Spiny |
| Sand Eel | flats | any | low | small ribbon | 24–31 | 100 | Ribbon |
| Herring | quay | any (fog ×3) | any | small school | 24–30 | 120 | Silver |
| Dab | flats | day | low | small flat | 22–29 | 160 | Flat |
| Mackerel | quay, lagoon | day | high | small school | 18–25 | 200 | Striped |
| Grey Mullet | quay | day | any | medium round | 20–27 | 240 | Kissing |
| Pollack | quay, lagoon | any (storm ×1.5) | any | medium finned | 17–24 | 300 | Underbite |
| Red Gurnard | quay, flats | any | any | medium finned | 16–23 | 340 | Croaking |
| Brown Trout | river, creek | day | any | medium finned | 15–22 | 380 | Speckled |
| Silver Eel | river, creek | night | any | medium ribbon | 14–20 | 450 | Sinuous |
| Sea Trout | creek, river | dawn, dusk | any | medium finned | 13–18 | 650 | Rolling |
| Glimmer Sprat | flats, lagoon | night | low | small school | 20–26 | 700 | Glimmer |
| Sea Bass | quay, flats | dusk–evening | any | large finned | 12–17 | 900 | Patrolling |
| Lumpsucker | old-quay | any | low (spring) | medium round | 20–28 | 1,100 | Clinging |
| Grayling | creek | any, after the weir turns | any | medium finned | 12–17 | 1,200 | Sailfin |
| **John Dory** | quay / sea | night | any | forked | 9–13 | **2,400** | Thumbprint |
| **Lantern Wolffish** | quay / sea | night (high ×1.5) | any | forked | 7–10 | **4,200** | Lantern |

Rules this table keeps: night sea fishing is the best income (the two headliners are the only
`forked` shadows and the two tightest windows); no species is exclusive to a tide or to night except
where GDD-ids says so, and every one of those has a daily window; the north creek holds nothing
until the weir turns (the reach's own `cond`), then stickleback, brown trout, sea trout, silver eels
and the grayling come back. Weights by rarity: common 6–10, uncommon 3–6, rare 1–3.

## 3. Bugs (10)

| Bug | Habitat | When | Movement signature | Spook (walk/run tiles) | Price |
|---|---|---|---|---|---|
| Sandhopper | flats wrack line | low tide | three hops, then hides under weed | 3 / 5 | 60 |
| Dor Beetle | lanes, green | dusk–evening | trundles in a straight line, drones on take-off | 1 / 2 | 120 |
| Ermine Moth | lit porches, string lights | night | flat on the warm wall; moves only if you run | 2 / 3 | 140 |
| Red Admiral | orchard, green | day (clear ×1.5) | basks open-winged on windfalls | 2 / 4 | 160 |
| Tiger Moth | lit porches, string lights | night | figure-eights round the lamp, lands every third loop | 2 / 3 | 180 |
| Damselfly | river, creek | day | hops one reed downstream | 3 / 5 | 260 |
| Glow-worm | reeds, the point | night | still, glowing; dims when run at | 1 / 2 | 320 |
| Bush-cricket | hedges, Bryony's beans | any (rain ×5, storm ×3) | sings, goes silent close up, moves only between songs | 2 / 4 | 420 |
| Hawk-moth | string lights, orchard | dusk–evening | hovers, darts a tile sideways | 3 / 6 | 600 |
| Starfly | glowing flats | night low | spirals over skyglass, pulsing with the hum | 2 / 4 | 900 |

Walking two tiles is safe for seven of ten; running spooks from three tiles or more for all but the beetle and the glow-worm;
creeping and standing never spook. Moths (`moth: true`) weigh ×2 at lit spots, and ×2 again with a
Bolt lead's string lights. No bug is weather-locked: the bush-cricket is rare in dry weather and
common in rain.

## 4. Finds (18) and the string wall

Each find pinned on Barnaby's string wall unlocks its town letter; any still locked after K20
arrive by morning post from day 22, so no find walls a letter.

| Find | Group | Source | Price | Letter |
|---|---|---|---|---|
| Ammonite | fossil | crack (Pellwick, Lowmoor, Cairnhold) | 400 | T1 |
| Belemnite | fossil | crack (Pellwick, Cairnhold, Emberstep) | 300 | T2 |
| Crinoid Stem | fossil | crack (Cairnhold, Thistlewind, Rimeholt) | 350 | T3 |
| Fossil Fern | fossil | crack (Lowmoor, Drownwood, Thistlewind) | 600 | T4 |
| Urchin Cast | fossil | crack (Pellwick, Emberstep, Rimeholt) | 800 | T5 |
| Old-Shape Skull | fossil | crack (anywhere, rare) | 1,500 | T6 |
| Brass Tide Gauge | relic | sparkle (Pellwick, the Bar) | 1,200 | T7 |
| Postmark Die | relic | crack, sparkle (Pellwick) | 700 | T8 |
| Fleet Tally Token | relic | sparkle (Pellwick, the Bar, Drownwood) | 500 | T9 |
| Skyglass Shard | relic, skyglass | night low | 900 / 1 Starsalt | T10 |
| Skyglass Bead | relic, skyglass | night low | 900 / 1 Starsalt | T11 |
| Skyglass Knot | relic, skyglass | night low | 900 / 1 Starsalt | T12 |
| Cockle | shore | rake, sparkle | 100 | T13 |
| Razor Shell | shore | sparkle | 120 | T14 |
| Sea Glass | shore | sparkle | 260 | T15 |
| Cuttlebone | shore | sparkle | 180 | T16 |
| Mermaid's Purse | shore | sparkle | 220 | T17 |
| Whelk Shell | shore | sparkle, tree (gull drop) | 150 | T18 |

Fossils clean +40% overnight on the Workshop bench, or one a day on the spot with a Kiln lead.
Storms double shore finds. Every Archive card is written in Barnaby's voice: fussy, kind,
provenance first, in parentheses, and each find's card names the letter it is pinned beside.

## 5. Trees and fruit

The seed picks one native fruit (pear, plum, apple, cherry or quince) for the town's ~88 grove
trees; the other four natives grow on three garden trees each in Bryony's, Tully's, Odile's and
Thessaly's yards, so all five natives are always in town. Groves: the Point Orchard 18, the Long
Orchard 26, the Green Rows 12, the River Walk 14, the Quay Gardens 10, the Weir Copse 8, garden
trees 12 (100 trees; 6 purse trees; 4 bee trees). Native fruit 120 / ripe 150; foreign (peach,
fig, apricot, mulberry) 480 / ripe 600, from Greenhouse grafts, market seedlings and gifts. Each of
the 13 creature types has one favourite fruit (Greenhouse: +1 Bond once, overnight).

---

## 6. Crossovers: one town, one clock

**The rule.** The party lead's type changes **one town verb by one rule** (`tuning.creatureBonuses`,
read by `systems/fieldLog.leadBonuses`). A dual type merges both rows (largest number wins,
booleans OR). Bonuses only: everything a lead finds faster, a leadless player can find slower.

| Lead | Verb | Rule |
|---|---|---|
| Brine | fish | names every shadow's species; tells after 1 catch; bite window ×1.5 |
| Gust | shake | one shake drops every fruit; blows a bee nest clear |
| Grit / Stone | dig | marks today's cracks, opens a fifth, shows the Glint from 3 tiles |
| Glass / Hollow | dig | skyglass relics from 5 tiles, dimly by day (still dug only at a night low) |
| Bolt | listen | Tailhum within 4 tiles of a purse, the Glint or a night headliner; moths ×2 at string lights |
| Moss | graft | a Greenhouse graft takes one night sooner |
| Rime | fish | +1 shadow per reach |
| Kiln | clean | one fossil cleaned on the spot each day |
| Plain / Rust / Star | — | no verb; porch lines still notice the lead |

**Why these.** Each rule is the creature's fiction pointed at a chore: a Brine creature reads water,
a Gust creature is wind in the branches, a Grit creature digs, a skyglass-born Glass creature hears
the glass. Each rule changes *how* you do a verb, never *whether*, so the lead question is "what am I
doing this morning?" and the answer is a party-order choice you make at the gate, not a gate. The
three types with no verb (Plain, Rust, Star) are the ones whose forms are either everywhere (Tossup)
or nowhere until late (Rust, the Passenger); giving them a verb would either be universal or
arrive after the town loop matters. They keep porch lines.

**The other direction.** Every creature system has a town address (GDD-00 §9): Prismoths visit your
lit porch so the Ward tell is met at home; any reach can hook a wild Bilgebob, Creelwight or
Rushling; Wanted Today and the Archive Bounty can name a Held form's drop; family letters return
four creatures; the Porch Duel slate is the Rematch board.

---

## 7. Weather

Five kinds, honest odds on the Commons slip ("7 in 10, showers by the evening tide"), Ansel's
barometer chalk at dawn. Effects are multipliers, never locks:

| Kind | Climate weight | Effects |
|---|---|---|
| Clear | 34 | day bugs ×1.25; the Glint and golden hour |
| Overcast | 26 | all fish ×1.1 (they lose their caution) |
| Rain | 20 | bugs ×1.5 (bush-crickets ×5); Brine and Moss encounters ×1.25 |
| Fog | 12 | silver schools ×2 (herring ×3 by row); quay shoals ×1.5; Hollow encounters ×1.25 |
| Storm | 8 | Errant lightning ×2; shore finds ×2; storm fish (pollack, bass) ×1.5; Bolt encounters ×1.25 |

`WEATHER_TUNING` in `town.js` holds the weights and effects for `data/tuning.js`.

## 8. The Commons, festivals and Porch Duels

**Commons projects** (economy owns cost, neighbour share and slip in `loans.js`; this chapter owns
what changes in town): Dark House 1 (from the day the Raft docks) → Tamsin walks in at dusk, porch
1 lights · Quay Lamps → +1 night shadow on quay reaches, six lit moth spots · Mudlark Mile Flags →
the firmest dry line across the point flats at every spring low, and a crowd on race day · North
Creek Footbridge → green to Ansel's launch and the weir at any tide · Training Yard on the Green
(badge 5) → the room's 25% share for three stored creatures · Third Stall → two more furniture and
two more clothes on market nights.

**Festivals** (`schedule` FestivalRows):

| Festival | When | Events | Rewards |
|---|---|---|---|
| Lantern Market | Saturdays 20:00–02:00 from day 7 | Varga's stall, Ludo's seedlings, string lights; day 7: Dov's auction and the Shift fair; Linnet's fall at the first market on/after badge 2 | *Market Night*; market-only furniture and clothes |
| Mudlark Mile | a spring low (days 7, 14, 21…), after Tully's beat 4, until the thread is done | the race across the point flats, your fastest creature pacing Tully's Scrapling | Tully's sweatband win or lose; the resident share |
| The Long Night | the dusk the Lamp Room lands, until the Reading | Isolde's Lantern at 17:30, the Relighting, the crossing, the Reading | *The Long Night*, *The Reading*, Isolde's Lantern, the lit.* rules |
| The Late Delivery Party | the evening the 56th letter arrives | Hesper's counter turns buffet; the string wall on the green | *Late Delivery*; postcards from the Outer Isles |

**Porch Duels.** Three friendly offers a day on the Commons slip, fought during porch talk
(19:00–01:00) on the offering porch (or under the Commons board lamp if it is dark). Payout is
**30 × the posted curve of your next Spire**: 210 / 390 / 570 / 780 / 990 / 1,200 / 1,410 by badges
held (Day 10's Osric duel pays 780). Opponents scale to your party's median, one creature before
badge 2, two to badge 4, then three. The slate draws two neighbours and one visitor when a visitor
is eligible: the eight neighbours (Wren's Peg, Tully, Juniper, Odile from Cairnhold, Tamsin's Kettle
once she arrives, Wick whose Rillfin becomes a Gillwick, Augusta, Linnet except while she is gone),
beaten leaders on the Archive porch, and each isle's five route trainers once you hold that badge;
Idris and the Keepers join post-game. Nothing is lost; no calls, ever. If the cozy path stalls,
this payout is the first lever (GDD-00 §7).

## 9. Home: furniture, clothes, roofs

24 furniture pieces (200–6,000; Pell's rotating stock, the Lantern Market, and Ambrose's timber
pieces carved over two nights and tagged with where the wood was found); the first twelve survive
cut-order 14. 12 clothes across top, bottom, shoes, hat and accessory: the jumper and apron you
start with, Maud's ferry scarf at badge 2, the Keeper's Coat after the Relighting, the rest
400–3,000. Eight roof colours use the palette ramps (`art/palette.COLORS`); slate blue is the cursor
default.

## 10. The Day Page

Dimity inks it in one second at Rest or the porch bench: header, buttons, loan (or THWAP), catches,
people, Shifts, letters, heirlooms, seals and stamps; then ***Tomorrow:*** with one item per kind in
`dayPage.TOMORROW_ORDER` (build, graft, bench, forecast, letter, beat, low, carry, heirloom, errant,
spire, plus the route and pace lines), joined with semicolons ("Tomorrow: Thistlewind by the 12:35
low; K10 at six; 37,400◉ to go on loan 6."); then *Saved, verified* or the red *Not saved*. An empty
list still says "Tomorrow: whatever you like. That is allowed."

## 11. Journal stamps (24)

Story stamps read the manifest's `sp.` flags; "first time" stamps read a `stamp.*` counter that a
listener bumps on a real bus event (`capture:ok`, `stat:inc` rerolls/anchors, `fieldLog:read` with a
Ward ability, `gather:skyglass`, `battle:end` with `porchDuel`, `letter:heirloom`,
`encounter:errant-down`, `fieldLog:held` first). *Tied Off* is any of the six life threads done;
*Every Plate* is 42 Held.

---

## 12. Integration notes and manifest requests

**No new manifest ids are needed.** Requests for other owners:

1. **Wiring** (orchestrator): `DATA.collections ← COLLECTIONS`; `DATA.festivals ← FESTIVALS`;
   `DATA.weather ← WEATHER`; `tuning.WEATHER_EFFECTS ← WEATHER_TUNING.WEATHER_EFFECTS`;
   `tuning.creatureBonuses` already equals `CREATURE_BONUSES`; merge `COMMONS_PROJECTS` /
   `COMMISSIONS` into `loans.js` rows by id (effects and scenes only; no cost or share here).
2. **Maps (GDD-01)**: reaches declare `kind` from `REACH_KINDS`; suggested Pellwick reach ids
   `river-bridge`, `river-mouth`, `quay-east`, `quay-west`, `north-creek` (cond `sp.weir-turned`),
   `point-channel`, `old-quay` (bared only at a spring low). Bug spots carry a `habitat` from
   `BUG_HABITATS`. The placeholder map's `ph-pear` tree errors once the real collections land.
3. **Engine (SYS-GATHER)**: `gather.rollBugs` ignores spot habitat; filtering spots by
   `spot.habitat ∈ row.habitat` would put each bug where its card says.
4. **Art**: `palette.ROOF_COLOURS` has `teal` (Verdigris) where the manifest has `heather`; the
   heather roof uses the moor heather ramp `he0–he3` until a `roof-heather-*` tile set exists.
5. **Cond DSL**: `selectors.dayOfWeek` counts 0 = Sunday (core day % 7) while `townCommon` and
   festival rows count 0 = Monday. This chapter avoids `day.dow` in conds for that reason.
6. **Stamps**: a stamp listener must keep the `stamp.*` counters; `capture:ok` should carry
   `scripted` and `battle:end` should carry `porchDuel` for the two stamps that read them.
