# GDD-08 — LETTERS AND THREADS

Content chapter for the letter serial (58 rows) and the ten threads. GDD-00 wins every disagreement; ids are the manifest's (`js/data/ids.manifest.js`), formats are ARCHITECTURE §14.7–§14.8 plus the fields `js/systems/letters.js` and `js/systems/threads.js` read.

**Files.** `js/data/letters/{index,keeper,family,town,event}.js` · `js/data/threads/index.js` + one file per thread · `test/data.letters.test.mjs`.
**Wiring (orchestrator).** `DATA.letters = LETTERS` (from `letters/index.js`); `DATA.threads = THREADS`; merge `THREAD_SCRIPTS` (from `threads/index.js`) into `DATA.scripts`. `SEALS`, `LETTERS_BY_CHANNEL` and `THREAD_BY_NPC` are exported for the letter reader, the Journal and GDD-06's `threadId`s.

---

## 1. The serial at a glance

| Channel | Ids | `n` | Arrives | Gate |
|---|---|---|---|---|
| Keeper | K1–K20 | 1–20 | 06:00 mailbox, K1 day 2 … K20 day 21, one per date, no accrual | home porch lit (loan 1) |
| Family | F1–F18 | 21–38 | 18:00 at Hesper's counter from day 2; carried to `door` | heirloom returns at a lit porch (F4 waits for dark house 1) |
| Town | T1–T18 | 39–56 | the moment its `find` is pinned on the string wall; any still locked arrive by morning post from day 22 | none |
| Event | E1, E2 | 57–58 | `deliverEvent('lantern')` at the Relighting; `deliverEvent('saw-the-light')` post-credits | none |

`n` is global, so conds read `{letter: {read: n}}`: K9 = 9, F8 = 28, F14 = 34. Every row has 40–160 words except E2, whose six words are canon. Each row's `reveal` holds `setFlag` ops (mirrored into `flags`, so `markRead` sets them even if the host skips the ops) and, for K7, one toast. Seals: `petrel` (Isolde), `wax-red`, `harbor-office`, `day-book` (Mabry), `ward-log` (Merrow), `harbormaster` (Ansel), `outer-isles` (E2). Each seal has its own glyph and name as well as a colour, so colour is never the only tell.

**Why the Keeper letters exist at all.** Keepers on this coast write their log as letters to the next keeper (K5's habit, T2's "To the Keeper … she asked me to hold, not post"). Mabry Coil held them in the blue pigeonhole, sealed them into the last sack (T8, F17), and kept taking the ones Isolde sent from the Outer Isles (F11, T17, K20). That is how a 29-year-old letter and a 30-year-old one can arrive in the same sack, in order.

---

## 2. The reveal map (Isolde's mystery)

The one mystery: *why the light went out, and why creatures Shift.* Answer: the same night. It resolves by K12 (day 13), before the target Relighting (day 11–16). K13–K20 come after the Relighting and cover what she learned later. The reversal is that the Siltback *did* know her: K8 says it "did not know me", K9 has the grey-winged creature on the rail with the mark "in exactly the place hers was", and K13 has it fly forty miles to find her. That is Pillar 5 told as a story.

| Day | Letter | What the player learns | GDD-00 beat | Flag(s) set |
|---|---|---|---|---|
| 2 | **K1** *(canon)* | The oil boat touched the bar. The light is fine; the river is wrong. | 1 | `np.ansel.heard-k1` |
| 3 | **K2** *(canon, Stalk)* | The Stalk mill weir holds back the river that scoured the bar. "Young Stalk writes a good report and reads a poor drawing." | 2 | `np.ansel.weir-named` |
| 4 | **K3** *(canon)* | The sea hums; a wanderer on a thirty-year road; a second log, two clocks. | 3 | `np.corin.wanderer-letter` |
| 5 | **K4** *(canon)* | A four-point glow on the Siltback's brow (the first Heartmark); she can see the lean. | 4 | `np.corin.lean-letter` |
| 6 | **K5** | Merrow's ward: eleven young creatures marked, their elders unmarked; marks glow brighter at the lamp (the seed of "light calls the change"). | 4 | `np.merrow.broth-letter` |
| 7 | **K6** *(canon, Stalk)* | Oil for nine nights; the lamp or the wheel. | 5 | `np.augusta.nine-nights` |
| 8 | **K7** | The oil boat failed; the fleet's bell "goes with the quay if the bar takes it"; dig at a big low. | 5 | `th.the-bell.located` + toast |
| 9 | **K8** *(canon)* | The storm night: the comet broke at the wheel, skyglass fell into the river, the Siltback Shifted, the wheel needed two, the lamp ran dry. | 6 | `np.merrow.storm-letter` |
| 10 | **K9** | The morning after (22 December, the same dawn K8 was written before): the draft creatures changed in harness and the fleet is on the bar; every soul waded home; Stalk writes down the hour and, under it, her name ("that is what a report is"); the winged creature on the rail with the same mark. | 7 | `th.empty-creek.morning-after` |
| 11 | **K10** *(canon)* | "They were right to name me": the owners couldn't read the marks. A read Shift is a Shift survived. She leaves for the Isles. | 8 | `np.merrow.read-shift-letter` |
| 12 | **K11** | The new lagoon and Shardcrown; a young salvage diver (Bastien) keeps a brazier lit "whoever's tower, whoever lights it". | 9 | `np.bastien.brazier-letter` |
| 13 | **K12** | Merrow's rule answered: light doesn't call the change, it shows it. The lantern is on Pell's counter "for whoever comes". | 9 | `th.heirlooms-going-home.lantern-named` |
| Relighting | **E1** *(canon)* | The Lantern letter: read the wanderer, don't fight it; "I taught a boy on the Isles." | 10 | `np.corin.lantern-letter` |
| 14 | **K13** | The Skeinwing found her; the first deliberate Forecast; the first time she wasn't afraid of one. | 10 | `np.corin.skeinwing-letter` |
| 15 | **K14** | The report reaches her: "He wrote what he could see." Tell Ansel it's a good report. | 10 | `np.ansel.forgiven` |
| 16 | **K15** | Teaching an owl with failing eyes (Corin): "Look before you swing, then say what you see." | 10 | `np.corin.apprentice-letter` |
| 17 | **K16** | The Passenger: alone for thirty years, it drinks light to find somewhere lit to land. | 10 | `np.varga.passenger-letter` |
| 18 | **K17** | The Heartshard pulls the marks like a tide: chalk the windows a tide ahead (the `lit.shiftTide` rule, foretold). | 10 | `np.merrow.tide-letter` |
| 19 | **K18** | The Mooring and the Scatter are both half right: an anchor to own, salt to spend; read first. | 10 | `np.merrow.half-right`, `np.varga.half-right` |
| 20 | **K19** | The return, counted. "Light it from a lantern, not a match." | 10 | `np.wick.slow-flame` |
| 21 | **K20** | The last one: pay attention, pay what you owe, read before you choose. Keep the wick trimmed. | 10 | `np.hesper.last-keeper-letter` |
| post-credits | **E2** *(canon)* | "I saw the light. —I. Petrel." (a postcard; `envelope` describes it) | 10 | `np.hesper.saw-the-light` |

**Story hooks other chapters use.** Merrow halts the Engine on K10, or on K8 if K10 hasn't come (GDD-07 reads `{letter: {read: 10}}` / `8`). K7 unlocks the bell dig. K9 opens Ansel's confession. K12 and F14 set up the lantern. K17 foretells the Shift Tide line.

**Supporting voices.** The family letters fill in the night from below: Maren's Bilgebob (F1), the alder floor and young Wren's square lighthouse (F2), Agnes Pell's slate (F3, F14), the Bracks' creel creature *Kettle* and Isolde's knot (F4, the origin of the Still Knot), Augusta's three-in-ten gale odds against Isolde's eight (F6, F15), Tully's dad (F7), the weir records the Archive never sent (F8), Odile's grandmother (F9), the Rasks' rope that held (F10), Mabry's "order is a kindness" (F11, F17), Josiah Stalk, who built the weir, cancelling the sluice-gate oak (F12), the almanac with the Ebb year and the year thirty on both circled (F13), the whale that isn't (F16) and the stove (F18). The town letters are the record: the bar soundings, the deferred inspection, the nine-nights notice, the roll of the fleet (eleven lost, *Tidy Sum* found in the north creek), Merrow's hour-by-hour log of the Night of Wrong Shapes and the founding of the Mooring, and Ansel's report in three parts plus the unsent addendum ("True.").

---

## 3. Family letters: doors, heirlooms, creatures

| F | Door | Heirloom | Lights porch | Creature |
|---|---|---|---|---|
| F1 | `porch-dorrow` | `dorrow-kettle` | yes | Bilgebob Lv6 |
| F2 | `porch-coop-yard` | — | | |
| F3 | `porch-pells` | — | | |
| F4 | `porch-dark-1` | `brack-still-knot` (waits until dark house 1 lights) | | |
| F5 | `porch-bryony` | `bryony-seed-tin` | yes | Puddlepip Lv7 |
| F6 | `porch-wardens-house` | `grade-two-lantern` | | |
| F7 | `porch-tully` · F8 `porch-archive` | — | | |
| F9 | `porch-odile` | `odile-easel` | yes | Mothling Lv18 |
| F10 | `porch-linnet` · F11 `porch-post-office` · F12 `porch-coop-yard` | — | | |
| F13 | `porch-thessaly` | `thessaly-almanac` | yes | Wirewhisk Lv19 |
| F14 | `porch-pells` · F15 `porch-wardens-house` · F16 `porch-dorrow` · F17 `porch-post-office` · F18 `porch-keepers-cottage` | — | | |

Creature levels sit one or two under the form's next window (8 / 20), so each gift brings a Forecast soon. The test runs all 18 letters through `deliverEvening → carry → deliverToDoor` and checks five heirlooms come home at once, all four creatures arrive, and the knot is released when dark house 1 lights.

---

## 4. Threads

Every beat is a §14.7 row: `cond`, a `where` hint (GDD-01 may snap it to the nearest walkable tile), a `when` line, the `topic` line injected into the NPC's topics (and onto the Commons board), and `choices`, the `th.<thread>.<key>` flags its choice point sets. **Every option of every choice is remembered twice**, as a `th.` flag (later beats branch on it with `if {flag, is}`) and as an npc memory key `<thread>.<key>` through the `remember` op. Each beat script ends with `{op:'beat', thread, to: n}`. Spring-low beats use `advance: {dayOfWeek: [5]}` with `cond: {lowTide: true}`, because every Saturday (days 7, 14, 21…) is a spring tide.

### Lead threads (finishing one pays the resident share)

| Thread | Beats (cond → what happens · remembered choice) | Reward |
|---|---|---|
| **The Mudlark Mile** (Tully) | 1 dawn laps; the cracked stopwatch · *honest / kind* time → 2 mullet slip on the Commons board · *fish for luck / luck isn't a diet* → 3 low tide after Tamsin arrives: loses the practice race · *she cut the corner / she was faster* → 4 porch: "I was the slowest kid" (branches on beat 1 and on F7) · *I'll pace you / slowest is fine* → 5 spring low: the Mile, Bryony at the finish if the fence is done · *call his time / forget the watch* | share + `tully-sweatband` |
| **Twelve Lights** (Odile) | 1 golden hour: stand very still · *which is the twelfth / why not your own* → 2 after loan 1: your porch canvas ("Honey, with a cold edge") · *warm / dark* → 3 after the first Forecast: the Shiftlog strip · *every form / just the mark* → 4 porch, once F9 lights hers: the eleventh, from the green; she gives up on the tower · *it'll be lit / paint it dark* → 5 morning after the Relighting: the twelfth canvas, the beam · *Archive / her step* | share |
| **The Oyster Boat** (Tamsin) | 1 low tide: race to the sparkles · *race / let her* → 2 the *Tidy Sum* in the dry north creek, no name · *find it / why the name* → 3 on Drownwood: Read Kettle, and the nameboard is inside it · *read his lean / just the board* (gives `oyster-boat-nameboard`) → 4 Wendel's rollers bring her to the quay mud · *hand it over / hold it while she nails* (takes the board) → 5 `lit.fleetHome` or `sp.weir-turned`: she floats (`call tamsin-sails`) · *crew / wave* | share; sets `sp.tamsin-sailed` |
| **The Fence** (Bryony) | 1 water the beans; the Sedgehare is "a neighbor" · *300 / free* → 2 Tully's laps flatten the beans: FENCE · *reroute round the pump / Bryony's side / Tully's side* (both npcs remember) → 3 Ambrose (beat `npcId`), 3 timber · *talk over / step over* → 4 the fence goes up; the Sedgehare chooses you · *kneel / let it decide* | share + Sedgehare Lv14 |
| **Heirlooms Going Home** (Juniper) | 1 after F1: the back room · *why free / how many* → 2 after F3: Gran's slate · *see it / you don't owe me* → 3 after F4 + Tamsin: the Bracks' knot · *take it / haggle* → 4 after F6: the reveal, the shop kept open on credit nobody repaid · *a debt / a town* → 5 after F14: the blue bundle, "not yet" · *hold it / I'll wait* → 6 morning after the Relighting: the empty shelf | share (to the Commons Jar after payoff); the Lantern itself is handed over in `the-relighting` |
| **The Bell** (Barnaby) | 1 after K2: the string wall · *beside / by the weir* → 2 after K7: "bells don't float" · *shovel / do you want to move* → 3 spring low: `call bell-dig`, the bell, "Exhibit 1: My Old House" · *his house / a rope for the town* (gives then takes `fleet-bell`; sets `sp.bell-dug`) → 4 after F8 + K10: the last string, "Oh. Oh, that poor keeper." · *she'd be glad / silence* | share |

### Cast arcs (no share)

| Arc | Beats |
|---|---|
| **The Ember Grub** (Linnet) | 1 porch after the dock: a volcano in the garden · *bench it / magnificent* → 2 porch after the Brackenford rematch · *train the others / it'll carry you* → 3 Maud (beat `npcId`) after the fall: the first crossing · *where / the grub* → 4 porch after her return: she lets the Sootling's window land on her own step, "Read it for me. I'm not asking Merrow." · *exact odds / still yours* → 5 after `linnet-gate-after` (`seen`): learning Maud's wheel · *you'll be good / take me round* |
| **The Water Pack** (Wick) | 1 dusk after loan 1: "Keeper. This is Rillfin." (the bucket) · *Read him / you carry him?* → 2 badge 2: Rillfin Shifts Up to Gillwick and knows him · *plain odds / read it together* → 3 badge 3: the pack; the middle of the Long Road · *learn to Read / learn when not to fight* → 4 morning after the Relighting: "I carried it" · *you'll keep it / your turn next time* |
| **The Empty Creek** (Ansel) | 1 after K1: nothing in it · *why fish / stand with him* → 2 after K2: "young Stalk" · *the good report / silence* → 3 after K8: he saw the lamp go out · *ask / sit* → 4 after K9: lead-in, `call ansel-confession`, sets `sp.ansel-confessed`, then the addendum · *post it / tell them yourself* (branches on K14) → 5 confessed + `sp.relighting`: the wheel needs two · *shoulder in / let him try alone*, then `call ansel-weir-wheel`, sets `sp.weir-turned` |

### Template (no share; cut-order 5)

**The Second Chapter** (Thessaly) is the pattern later neighbor threads copy (`template: {beats: ['ask','turn','give']}`). 1 *ask*: one true thing you saw today · *the flats / a Shift* → 2 *turn*: F13 lights her porch; the almanac with this year circled; title chapter two · *The Return / Paying Attention* → 3 *give* (Act III): she reads page one, built from both earlier choices · *keep going / leave it blank*; gives a `fruit-seedling`.

---

## 5. Hand-offs to other chapters

- **GDD-07 (story).** Thread beats `call` these manifest scripts for their set-pieces: `bell-dig`, `ansel-confession`, `ansel-weir-wheel`, `tamsin-sails`. Those scripts should **not** advance thread beats themselves, and should not also be fired by their own triggers (the beat is the trigger). The beat scripts set `sp.bell-dug`, `sp.ansel-confessed`, `sp.weir-turned` and `sp.tamsin-sailed`; setting them again in the set-piece does no harm. `the-relighting` gives `isoldes-lantern` and calls `letters.deliverEvent(world, data, 'lantern')`. The post-credits/coda delivers `'saw-the-light'`. `merrow-engine-after` reads `{letter: {read: 10}}`, falling back to `8`. Flags read here that GDD-07 sets: `sp.dock-battle`, `sp.linnet-rematch`, `sp.linnet-fell`, `sp.linnet-returned`, `sp.tamsin-arrived`, `sp.field-log`, `sp.first-forecast`, `sp.act-3`, `sp.relighting`, `lit.fleetHome`, plus `seen.linnet-gate-after`. All of them are in FLAG_IDS (the test asserts it).
- **GDD-06 (cast).** `NpcDef.threadId` = `THREAD_BY_NPC` (tully, odile, tamsin, bryony, juniper, barnaby, linnet, wick, ansel, thessaly). Schedules: Tamsin at Mossgate's drowning street (`drownwood` ≈ 24,16) on low-tide days while `th.oyster-boat` beat is 2. Maud at her berth (`pellwick` ≈ 50,38) mornings. Ansel at the north creek 17–23. Thessaly's bench 10–16. Porch beats need each npc at their porch during porch talk. Topic lines may read the `th.*` flags and npc memory keys listed above.
- **GDD-05 (town).** The finds' town letters are the T rows here (one per `FIND_IDS` entry, `find` = `relicId`). The Archive string wall's last string is The Bell beat 4.
- **GDD-02 (economy).** Resident shares come from the `reward.share` on the last beat of each lead thread. Juniper's and Odile's lead threads finish after the Relighting by design, so their share goes to the Commons Jar (4,000) if the loan is clear.

---

## 6. Continuity notes (editor pass)

- **Dates.** The storm is the night of 21–22 December (K6's nine nights from 12 December). K8 is written before dawn on the 22nd; K9 and T13 are that morning (22 December); the fleet roll (T9) is the 23rd; Ansel's report (T11, T14, T16) the 27th. Isolde leaves about 8–9 January (F14, F18, T15) and crosses the lagoon in January (K11).
- **Titles.** Ansel Stalk is Deputy Harbormaster in the spring before (T1) and Harbormaster through the Ebb winter (T7, T11, T15, T16). F8 is signed "For the Harbormaster" by the office clerk. Augusta Skerry was already Harbor Warden then (F6, F15); "Warden" still means Augusta only.
- **The weir.** Josiah Stalk, Ansel's grandfather, built it (F12); K2's "two generations old" counts from Ansel. He wrote "True." on Isolde's drawing (T18) and still cancelled the gate repair (F12).
- **The drawing.** Ansel collected it himself (T4); the Board sent it to the estate (T3, T18), so at the report he "didn't have the drawing" (the confession); he found it twenty years on (T18) and still has it (Empty Creek beat 4).
- **Juniper's back room.** Agnes Pell (Gran) kept the shop open on the slate and bought what people pawned; Juniper kept it and gives it back (Heirlooms beats 1 and 4).
- **The Bell, beat 4.** F8 is the harbor office's *request* for the weir records, never delivered; the records sat in the Archive the whole time. Barnaby's last string runs from them through Isolde's letters to the lamp.
- **Thessaly's almanac.** Wynne circled the Ebb year and, on the long tables, the year thirty on (F13), which is why Thessaly can say "She circled NOW."
- **Linnet, beat 4.** She does not Anchor or Reroll: the Sootling's window is left to land overnight on her step (the scene does not resolve the Shift on screen).

## 7. Manifest requests and engine notes

**Manifest requests** (no ids invented; nothing here blocks the content):
1. Keepsake `odile-porch-canvas` (Odile's painting of your porch, promised in Twelve Lights beat 2). Today the gift exists only in dialogue.
2. Invented display names (GDD-ids §19, display only, no table ids): Hal Gannet (bosun), Agnes Pell (Juniper's grandmother), Maren Dorrow (already canon), Old Fen (Lowmoor bean-grower), Ned of the Emberstep ropewalk, Josiah Stalk (Ansel's grandfather), Wynne of Windle (Thessaly's great-aunt), Davey Penhallow. The lost fleet: *Gannet, Brown Bess, Kittiwake, Three Sisters, Thole's Luck, Plenty, Ivy Rask, Merrow Maid, Long Odds, Good Morning, Grace* (ferry); the Bracks' oyster boat *Tidy Sum*; the bean *Lowmoor Sweets*.

**Engine notes** (for the owners, not blockers):
- No cond can check a collection row (a fish) in the satchel, because `hasItem` resolves against `items`. Tully's mullet is therefore asked for but never checked; beat 5 branches on the promise. A `{hasCatch: id}` cond would let the Commons slip close properly.
- Letters and scripts avoid the lease card's town name, because no `{town}` interpolation token exists yet. A token would let letters say "Pellwick" (or the player's choice).
- `take` with `ask: true` is documented as yielding a confirm, but the runner treats it as a pure op. One-of-a-kind hand-overs here use an explicit two-option choice instead.
