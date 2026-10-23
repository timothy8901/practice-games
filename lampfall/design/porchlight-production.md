# Porchlight — Production Reference

Extracted from the Porchlight pitch (source lines 1144–1682, plus the concept-panel table that runs a few lines past the boundary). Covers: the Keep / Change / Remove / Add matrix, the vertical slice, content scope and milestone counts, risks, comparable games, the cut-first list, IP constraints, and the appendix playtest observations O1–O15. Budget and team are reduced to one line each.

Conventions used in this doc:

- `◉` = **buttons**, Porchlight's currency (counsel still to clear "buttons" as a currency name).
- **(Proposed)** = the pitch marks the detail as proposed / to be tuned in playtest.
- **Expand, not a promise** = post-1.0 idea, unbudgeted, must not be marketed.
- **[NEED SOURCE]** = the pitch itself flags the fact as unverified. Kept where it affects a rule or number.
- **O1–O15** = the playtest observations reproduced in full in §11.
- **WW** = Animal Crossing: Wild World (Nintendo DS, 2005), the evidence base.

---

## 1. One-line budget and team

Total program **$6,779,825** over 30 months (15% contingency included), core team of **14 at peak (12.5 average)**, engine **Godot 4 on a pinned version**, 1.0 on Steam (Windows/macOS/Linux/Deck) + GOG at **Month 27 (about March 2029, Proposed)**, Switch 2 port built M28–M30 via a port partner and released M31–M33 outside this budget.

---

## 2. Audience, platforms, price (in range; kept short)

| Item | Value |
| --- | --- |
| Primary audience | Adults ~25–40 who grew up on WW and DS-era handheld life sims; PC / Steam Deck; 30–90-minute evening sessions |
| Secondary audience | Cozy-genre players from Stardew Valley, Cozy Grove, Fields of Mistria; no combat, no stamina, gentle optional story |
| Served on purpose | Late-night and shift-work players (Porchlight Hours, "someone is always buying", low tide guaranteed in every 12.5-hour window); families (surface layer a 9-year-old can use; Gentle fishing) |
| Rating target | ESRB E / PEGI 3 [NEED SOURCE] |
| Platforms at 1.0 | Windows via Steam; Steam Deck (Deck Verified target; renders 426×266 ×3 = 1278×798 at locked 60 fps — slice-gate requirement); macOS native Apple Silicon via Steam; Linux native via Steam; GOG DRM-free, fully offline |
| Later | Nintendo Switch 2 (port partner + Godot console middleware; built M28–M30; cert ~M30; release M31–M33, outside budget). PS5 / Xbox Series: Expand. Mobile / subscription: Expand, only on a platform-funded deal |
| Price | $24.99 USD PC at 1.0, 10% launch-week discount, Steam regional tables. Switch 2 $29.99 when it ships [NEED SOURCE] |
| Monetization rules (Pillar 1) | No microtransactions, no paid time skips or speed-ups, no ads, no loot. Every seasonal drop free |
| Day-one extras | Soundtrack $9.99; Supporter Edition $34.99 (game + OST + digital Season Book art book). Paid "Outer Isles" expansion = Expand |
| Unit maths | ~$11 lifetime net per unit [NEED SOURCE]; full budget recoups at ~600k units; funding phase-gated, co-funding sought, cut list written now |

---

## 3. Keep / Change / Remove / Add — summary table

55 rows. Verdict counts: **Keep 10 · Change 32 · Remove 7 · Add 6.**

| # | Verdict | Feature (WW) | Category | Porchlight in one line |
| --- | --- | --- | --- | --- |
| K1 | keep | Hourly background music | Audio | 24 hourly themes as adaptive stems (season / weather / tide / night layers) |
| K2 | keep | Real-time clock & time travel | Gameplay | Real clock is sacred; no skips; clock changes fast-forward with no punishment; caps: 1 old letter/morning, 1 build/night; "Unhurried" seal |
| K3 | keep | Seasons & weather | Gameplay | Real seasons + southern-hemisphere toggle; season LUTs; harbor barometer forecast with honest odds chalked by Ansel |
| K4 | keep | Tree shaking, money bags & bee nests | Gameplay | ~100 trees; context-button shake with auto-stow; bee trees warn (hum + gold specks); honeycomb 350◉; bee-halo gag on miss |
| K5 | keep | Fruit economy (native vs foreign) | Gameplay | Fixed: native 120◉, foreign 480◉, ripe +25%; fruit stacks to 10; Wanted Today board (3 items, +50%); no dynamic pricing |
| K6 | keep | Overnight build, roof colour & payment counting | Gameplay | Abacus click per 1,000◉, tally stick gnawed + THWAP split, half on your tally wall; watchable dawn build by the Thatch |
| K7 | keep | Museum | Gameplay | The Archive (Barnaby Thole, hermit crab): fish / bugs / fossils / relics / shore finds 40/40/30/20/20; string wall; weekly Archive Bounty |
| K8 | keep | Bulletin board | Online/Social | The Mooring Post: barometer, fossil cracks, birthdays, visitor, thread beats, request slate, Commons Jar list, player notes |
| K9 | keep | Nicknames & catchphrases | Story/Characters | Tuck gives nickname (declinable); Wick invents his own later; Ferdinand mimics the week's most-talked-to neighbor |
| K10 | keep | Letters, morning mail & birthdays | Story/Characters | 6 am mailbox kept; visible letter tone; exactly one old letter per morning from Hesper Coil |
| C1 | change | Town tune | Audio | "Your Signal": 6-note phrase on 6 pentatonic chimes, set on lease card, tied to your house; no 16-note tune |
| C2 | change | Animalese voices | Audio | Trade ticks per speaker / family; options: speed, mute, instant text |
| C3 | change | Part-time job (tutorial) | Gameplay | First Week Errands clipboard: 9 errands, any order, each pays down loan 1 (up to 6,000◉ of 12,000◉); ~45 min |
| C4 | change | Foreign fruit acquisition | Gameplay | 3 visible sources: Wednesday sister-town parcel, life-thread gifts, Lantern Market night seedlings |
| C5 | change | Selling & shop logistics | Gameplay | "Someone is always buying": Juniper 8 am–10 pm, Ludo 10 pm–8 am, Consignment Crate overnight at 90%; Basket tool |
| C6 | change | Shop stock, upgrade tiers & remodel closure | Gameplay | Pell's Sundries (Juniper Pell, magpie); tools always stocked; expansions overnight; cart if it overruns; back-room heirlooms |
| C7 | change | House loan ladder & lender | Gameplay | Hearthwright & Daughter Building Co-op; 7 loans = 2,382,000◉; commission 4 of 6 rooms from loan 3; resident shares 5%; Ledger Board estimate |
| C8 | change | Fishing | Gameplay | Shadows everywhere (4–8 per reach); 6 sizes + silhouettes; learned tells after 3 catches; feints; 0.12–0.52 s bite; Gentle 0.6–0.9 s; release |
| C9 | change | Bug catching & biting bugs | Gameplay | 40 bugs; moths/fireflies gather at lit porches; biting bugs only startle (4f hop back) |
| C10 | change | Digging: fossils & money rock | Gameplay | ~4 cracks/day; tide-flat glints; exactly one daily Glint (buried purse); Loupe; batch ID; Workshop cleaning bench |
| C11 | change | Gyroids | Gameplay | Ambrose's music boxes (Proposed): carved from your timber, play one stem of the hourly theme |
| C12 | change | Balloon presents & slingshot | Gameplay | Drift lanterns (Proposed) from sister towns, snag in trees/eaves; shake or net; no slingshot |
| C13 | change | Snowmen | Gameplay | Two snowballs; ruler shows ratio; perfect = Season Book stamp (Odile sketch); nothing by mail |
| C14 | change | Rivers, bridges & routing | Gameplay | Low tide opens stepping stones + causeway; 2 footbridges are Commons projects |
| C15 | change | Evenings & night | Gameplay | Porchlight Hours 8 pm–2 am; porch talk 8–11; Ludo buys 10 pm–8 am; Hesper 6 pm–2 am; Saturday Lantern Market |
| C16 | change | Wi-Fi & local visiting | Online/Social | Async only at 1.0: friend-code parcels/postcards + 2 offline NPC sister towns; no images travel |
| C17 | change | Multiple residents on one save | Online/Social | Up to 4 local profiles (Proposed); profile 1 = Keeper with the only ladder; 2–4 in fixed reopened houses |
| C18 | change | Villager roster, personalities & dialogue | Story/Characters | 24 neighbors, 8 families, one rig each; daily schedules; line memory ~5 days; Linger; 13 lead life threads |
| C19 | change | Villager favours & requests | Story/Characters | Wants pinned on doors + request slate on Mooring Post; none expire within the week (Proposed) |
| C20 | change | Villagers moving in & out | Story/Characters | Arrivals via reopened dark houses; announced weeks ahead; nobody leaves mid-thread; leavers keep writing |
| C21 | change | Special visitors | Story/Characters | Tova Limosa (godwit chartmaker) and Ferro Calloway (kinkajou glass pedlar) + sister-town walkers; all announced; no castaway, fortunes or fashion checks |
| C22 | change | Tortimer & seasonal holidays | Story/Characters | Augusta Skerry (grey seal, Harbor Warden) emcees 4 original festivals; weekly rituals; birthdays stay |
| C23 | change | Opening interview & character creation | UX/Systems | Arrive on foot at dusk over the causeway; lease card is the creator (6 species, 10 palettes, markings, 3 eye shapes, blush, outfit, pronouns) with preview |
| C24 | change | Saving ("Save and end") | UX/Systems | Autosave at every door; Rest save < 1 s; quit anytime; loading never writes a save |
| C25 | change | Pockets, wallet & full-inventory prompt | UX/Systems | 4×5 satchel (20 → 40 slots); stacks of 10; uncapped wallet; overflow basket; "Let it go"; Classic preset 15 unstacked |
| C26 | change | Tool equipping | UX/Systems | Hold shoulder = ring of 8 sockets; tap = swap last two; context actions auto-stow; Back never drops |
| C27 | change | Happy Room Academy scoring | UX/Systems | Co-op Home Notes (Proposed): printed rules, visible breakdown, provenance bonus; no hidden direction rules |
| C28 | change | Art style & rendering | Visuals | "Field-guide pixel": 480×270 native, integer scaling, 16×16 tiles, 64-colour palette, 12 fps characters over 60 fps world, LUT time of day |
| C29 | change | Top-screen sky & constellations | Visuals | Skyband ~40 px strip with parallax; optional Two-Screen layout; constellation drawing = Expand |
| C30 | change | Town map | Visuals | Living illustrated map: neighbor icons, pins, tide, busy/quiet reaches, cracks, lit-porch count |
| C31 | change | Player avatar | Visuals | THE NEWCOMER: animal paper doll, 24×32, 6 species on one rig, 8-direction, full animation list |
| C32 | change | Clothing & pattern design | Visuals | Layered clothing (6 layers); Pattern Sampler 32×32 on master palette (Proposed), local saves only |
| R1 | remove | K.K. Slider Saturday concerts | Audio | Saturday = Porch Supper + Lantern Market; Ferdinand sings at a Porch Supper; music ownership via music boxes |
| R2 | remove | Stalk market (turnips) | Gameplay | No speculation; price habit moves to Wanted Today, Consignment Crate, night buyer |
| R3 | remove | The Roost café & barista job | Gameplay | No café at 1.0; social job to porch talk and Porch Supper; "Slipway Tearoom" = Expand |
| R4 | remove | Mr. Resetti | Story/Characters | No scold; Dimity owns the save role gently |
| R5 | remove | Crazy Redd & forged art | Story/Characters | No forgeries; night-vendor thrill = Lantern Market; art via Odile's Twelve Lights and Juniper's heirlooms |
| R6 | remove | Weeds, absence penalties & town rating | UX/Systems | No absence penalty; catch-up sim + "While you were away" page; weeds cosmetic only; no score that can go down |
| R7 | remove | "Rolling log" camera curvature | Visuals | Flat camera; true horizon at shore/cliff with the dark lighthouse; wet sand two ramps darker |
| A1 | add | Tide as a second clock | Gameplay | Two lows/day ~12 h 25 min apart, drifting ~50 min/day; opens flats, causeway, stepping stones; guarantees |
| A2 | add | Community events | Gameplay | Mudlark Day, Firefly Regatta, Sunday Porch Sale, Archive record boards (separate Gentle board) |
| A3 | add | Reward for clearing the debt | Story/Characters | The Relighting: Ambrose's touch-walk, Isolde's lantern, beam sweeps every roof, ferry horn plays your Signal |
| A4 | add | Narrative / story | Story/Characters | Optional mystery via ~120 morning letters; the Ebb winter; Ansel, Wick, Isolde; no villain, no gates; ~2–3 h of scenes |
| A5 | add | Session recap & keepsakes | UX/Systems | Dimity's Day Page on every Rest; Season Book bound each solstice/equinox, exportable |
| A6 | add | Visible long-term landmark | Visuals | Dark lighthouse; scaffolding +1 section per tier; porchlights #F9C46B; post-Relighting beam #FFB547 every 8 s |

---

## 4. Keep / Change / Remove / Add — full entries

Each entry: **WW** (what the original did, as logged) → **Porchlight** (the rule set to build) → **Rationale** (as stated by the pitch).

### 4.1 KEEP

#### K1 · Hourly background music (Audio)
- **WW:** 24 hourly themes; music changes on the hour (O15). [NEED SOURCE: whether WW has weather variants]
- **Porchlight:** The 24 hourly themes stay, built as **adaptive stems with layers for season, weather, tide and night** rather than 288 separately composed variants. The same stems feed Ambrose's music boxes (C11).
- **Rationale:** Hearing the hour change is part of how real time feels real (O15). Stems give more variety for less composer time.

#### K2 · Real-time clock & time travel (Gameplay)
- **WW:** Runs on the DS system clock: day/night, shop hours, real seasons, dated events. Changing the clock = "time travel"; punished indirectly (turnips spoil, weeds sprout, villagers may move out) [NEED SOURCE: full list]. Each upgrade builds overnight, so the 7-loan ladder cannot take fewer than 7 real nights (O7).
- **Porchlight:**
  - Same real clock, "sacred": **no in-game time skip, no "sleep until tomorrow", no paid speed-ups.**
  - **Design rule:** every session leaves at least one thread open overnight that the player chose — a room going up, a graft taking, a fossil on the cleaning bench, a parcel in transit, a reply letter, or tomorrow's old letter.
  - Changing the system clock fast-forwards the town through a **simplified catch-up sim**: no punishment, no lecture, no exploit.
  - Two caps protect pacing: **one old letter per in-game morning** and **one house build per night.**
  - Saves that never skipped get a cosmetic **"Unhurried" wax seal** on their Season Books.
- **Rationale:** Anticipation ("tomorrow the house is bigger, shop hours matter, night fish come out", O14, O15) is the magic. Neutral clock changes remove hidden punishments without making skipping the "correct" way to play.
- **Open question for playtest:** an opt-in faster calendar for bingers/streamers, clearly labelled non-canonical?

#### K3 · Seasons & weather (Gameplay)
- **WW:** Seasons follow the real calendar, northern hemisphere only. Trees turn in autumn, snow in winter, starry night skies (O15). Weather is a random daily roll (sun, rain, snow); no forecast found [NEED SOURCE].
- **Porchlight:**
  - Real seasons stay, plus a **southern-hemisphere toggle.**
  - Each season is its own palette LUT subset: **spring thaw, summer, autumn (with a glasswort-crimson `#A3283A` salt-marsh blaze added to the maples), winter frost.**
  - Weather stays random, but the **old harbor barometer** nailed to the Mooring Post gives a **forecast with honest odds.** Ansel, the retired harbormaster, taps it at dawn and chalks the odds underneath ("7 in 10, showers by the afternoon tide"); when the forecast misses he chalks that too.
  - Weather overlays: **1-px wind-angled rain; two drifting layers of ordered-dither fog; snow.** Weather is one of the music stem layers.
- **Rationale:** Autumn colours and night skies are logged delights (O15). Odds let players plan (rain fishing, digging after a storm). The forecast belongs to an instrument and the man who reads it, not a town official (keeps clear of the town-secretary role in later AC games [NEED SOURCE: counsel]). A harbormaster owning up to wrong calls in public sets up his confession (A4). Hemisphere toggle is cheap and fixes a real exclusion.

#### K4 · Tree shaking, money bags & bee nests (Gameplay)
- **WW:** About 100 hardwood trees (103 shaken in one sitting). Shaking needs empty hands → constant unequipping (O5). A few trees drop 100-Bell bags daily. Rare bee nest with no warning; sting → swollen face until medicine (O6).
- **Porchlight:**
  - Same ritual in a town of the same size, **about 100 trees.**
  - The **context button shakes**; any held tool is put away and re-equipped automatically.
  - A shake can drop: **fruit, a button purse (straight to the wallet), a shell left by gulls, or a bee nest.**
  - **Bee trees warn first:** a 1-second hum and gold specks drifting down over the 4-frame wind sway.
  - If the net is on the tool ring the game offers it; catching the swarm gives **honeycomb (350◉, Proposed).**
  - A miss triggers the **bee halo**: three cartoon bees orbit your head on an 8f loop, flinch every 2 s, for **one in-game hour.** Neighbors lean away and comment; Juniper dives behind her counter (5f).
- **Rationale:** Knowing which trees hide purses is place-knowledge; the risk stops a 100-tree sweep going mindless. Unfair parts were the no-warning sting and the menu swap (O5, O6). The swollen face is AC trade dress, so the gag changes and the risk stays.

#### K5 · Fruit economy — native vs foreign prices (Gameplay)
- **WW:** Native fruit 100 Bells, foreign 500, fixed (O6). ~30 fruit trees ≈ 9,000 Bells but 6 round trips because fruit doesn't stack.
- **Porchlight:**
  - Fixed, predictable prices: **native 120◉, foreign 480◉ (4× gap).**
  - **Ripe fruit sells for 25% more**; ripeness shows on the tree as a one-step colour shift (Proposed).
  - **Fruit stacks to 10 per slot.**
  - **Pell's "Wanted Today" board:** 3 items a day at **+50%.**
  - **No dynamic pricing.**
  - The Greenhouse commission's **grafting bench** lets one tree carry two fruits (Proposed detail).
- **Rationale:** An orchard only works as a plan if prices hold still; the native/foreign gap makes a foreign orchard the first real investment decision. The 6-trip harvest (O6) was friction. Numbers changed for IP distance.

#### K6 · Overnight build, roof colour & payment counting (Gameplay)
- **WW:** House grows overnight after the next loan; you choose a roof colour; the town hall clerk counts money aloud (O15).
- **Porchlight (kept, made physical):**
  - **The payment:** Wren flicks her abacus — one 3f bead flick and click per **1,000◉.** Ambrose gnaws the notches into a **tally stick** (6f, 2-px wood chips flying) and splits it with one **THWAP** of his tail (5f + 2f screen shake + dust puff). Your half slides onto your **tally wall**, a diary of the year.
  - **The build:** before 6 am you can watch **the Thatch** tie off your roof in the chosen colour (**40-frame dawn vignette**) while Wren waves from the ladder (4f); the lighthouse scaffolding climbs one section.
  - **The Thatch:** five weaver finches, 8×8 each, yellow `#F2CE2E`, masks `#1F1D22`, rust caps `#B5452E`; **Corrie**, the foreman, carries a 1-px pencil.
  - **Wren:** 24×30; hazel fur `#8A5A3B`, cream muzzle, 2-px orange incisors `#F2A541`, crosshatched flat tail, spectacles pushed up on her head, pencil behind one ear, canvas overalls `#4F6D7A`.
  - **Ambrose:** on Wren's 24×30 rig, ~28 px wide with his cane; grizzled `#7A6656`, white brows over 4×4 bottle-bottom lenses, leather apron, cane made from a gnawed branch.
- **Rationale:** Trailer moments (O15); the overnight reveal is the best "tomorrow is the reward" beat in the genre; timing doesn't change.

#### K7 · Museum → The Archive (Gameplay)
- **WW:** Blathers (owl) runs the museum: donate fish, bugs, fossils, paintings; identifies fossils. Celeste's observatory upstairs; Brewster's café The Roost in the basement.
- **Porchlight:**
  - **The Archive**, run by **Barnaby Thole**, a hermit crab (24×30) living in a brass diving helmet (`#B8862F` / `#E3B867`) one size too small. Coral claws (`#E06A4F`) poke out of the neck ring; his porthole (`#9FD3C0`) fogs and clears over 5f when excited.
  - Animations: sideways scuttle 4f, bubble burst 3f, pin to the string wall 6f. In summer he moves into a ship's bell from the Old Quay; its clapper dings as he walks.
  - **Wings:** fish, bugs, fossils, town relics, shore finds — **40 / 40 / 30 / 20 / 20 at launch.**
  - **String wall** pins relics to the old letters they explain; doubles as the **mystery tracker.**
  - **Weekly Archive Bounty:** 3 wanted specimens at a bonus.
  - Odile's autumn gallery hangs here.
- **Rationale:** Filling a museum is WW's best long-term collection goal. The string wall gives the collection a story job; the Bounty steers players without a wiki.

#### K8 · Bulletin board → The Mooring Post (Online/Social)
- **WW:** Town bulletin board with villager posts, event notices, player posts; posting is a part-time job task (O2).
- **Porchlight:** **The Mooring Post** (renamed from the Commons board): an old mooring bollard on the green with a plank nailed across it; the whole town pins notes, nobody is in charge. It holds:
  - the old harbor barometer with Ansel's chalked odds
  - the fossil cracks spotted so far
  - birthdays
  - today's visitor
  - this week's life-thread beats
  - the request slate
  - the Commons Jar project list, with the co-op's build note pinned on each funded project
  - players' own notes
  - Pinning your **arrival notice** there is a week-one errand (C3).
- **Rationale:** Cheapest way to make a place feel lived in; serves "nothing hidden" without a menu; a bollard with no official stamping notices doesn't feel like a town hall.

#### K9 · Nicknames & catchphrases (Story/Characters)
- **WW:** Villagers give you a nickname ("C-cat") and ask for a new catchphrase (O12).
- **Porchlight (kept, with consent):**
  - **Tuck the wombat** (26×22, square silhouette, brown-grey `#7D6A58`, sweatband `#E07A3F`) gives you a nickname with a 3f point and takes it well if you decline or suggest a better one.
  - **Wick** invents his own nickname for you later.
  - **Ferdinand the lyrebird** (24×34) picks up the catchphrase of whoever he's talked to most this week (tracked by the game) and fans his lyre tail feathers (`#C9A54A` banded `#3E2618`, 5f) when he mimics someone. His thread is about finding his own voice.
- **Rationale:** Being named by a neighbor is how the town claims you (O12); declining means a hated nickname doesn't stick for months.

#### K10 · Letters, morning mail & birthdays (Story/Characters)
- **WW:** Stationery from the shop, optional attached gift, post at town hall, replies next day. Birthday invitations and thank-you gifts by mail; mom writes [NEED SOURCE: frequency]. Reply quality depends on hidden letter scoring (O11). Morning mail is a top ritual (O15).
- **Porchlight:**
  - Kept: **6 am mailbox**, stationery, attachments, birthday invitations, thank-yous. **Letter tone shows as you write.**
  - **Exactly one old letter arrives each morning** from **Hesper Coil**, a garden snail and the night-shift postmistress.
  - Hesper sprite: 22×26 front-on, 32×20 side-on; pale olive body `#A9B8A0`; shell is a canvas mail satchel `#C9B48A` with a brass buckle and envelope corners poking out; 2-px lantern glow on one eyestalk at night; 1-px shimmer trail fading over 3 s. "Letter from shell" animation (6f) reveals a yellowed `#E8D3A0` envelope with an `#A8323A` wax seal.
  - Letters from someone back home (the lease card would ask who writes to you) = **Expand, not a promise.**
- **Rationale:** Mail is the ritual players remember most (O15); visible tone fixes the hidden scoring (O11).

### 4.2 CHANGE

#### C1 · Town tune → Your Signal (Audio, Proposed)
- **WW:** 16-note town tune composed at the town hall, played as the town chime in several places [NEED SOURCE: where].
- **Porchlight:** On the lease card you set a **six-note phrase on six pentatonic chimes** (nothing you write sounds wrong). It belongs to **your house**, not the town: your door chime; Dimity hums it on the Day Page; Wick whistles it once you're friends; at the Relighting the **ferry horn answers with it.** There is no 16-note town tune.
- **Rationale:** Ownership in sound, tiny to build; WW's 16-note town-hall tune is an exact AC format.

#### C2 · Animalese → Trade ticks (Audio)
- **WW:** Villagers speak "Animalese", babble synthesized from the letters of the text at each character's pitch.
- **Porchlight:** Nobody speaks gibberish. Text scrolls over a **short tick from the speaker's trade or nature**; personality shifts tempo and register within a family. **Options: speed, mute, instant full text.** This is the game's single voice table.

| Story cast (12) | Tick |
| --- | --- |
| Wren | woodblock |
| Ambrose | low bowed string |
| The Thatch (one crew; Corrie speaks for it) | twine snap |
| Juniper | glass bead |
| Hesper | paper rustle |
| Barnaby | brass ding |
| Dimity | nib scratch |
| Ludo | match strike |
| Augusta | bosun's-whistle pip |
| Ansel | barometer tap |
| Wick | tin-whistle chirp |
| Isolde | no spoken lines at 1.0; her letters open on one soft lens chime |

| Neighbor family (8) | Tick |
| --- | --- |
| wombat | hollow-log knock |
| bilby | sand shush |
| rock hyrax | pebble click |
| badger | trowel scrape |
| spoonbill | ladle clink |
| lyrebird | reed-flute trill, borrowing the tick of whoever it last spoke to (Proposed) |
| stoat | snare tick |
| tapir | blown-bottle hum |

- Visitors use the tick of the neighbor rig they're built on.
- **Rationale:** A tick identifies the speaker before you read; one short sample per speaker or family; accessibility options cost almost nothing.

#### C3 · Part-time job → First Week Errands clipboard (Gameplay)
- **WW:** 8 fetch quests in strict order; the "chat twice" requirement is never stated (O2).
- **Porchlight:**
  - Errands can be done in **any order.** Each shows a counter and how many ◉ it knocks off loan 1, **up to 6,000◉ of the 12,000◉ bedsit loan.**
  - The 9 errands:
    1. wear the co-op apron
    2. plant 3 saplings and 4 seed bags
    3. get to know each neighbor ("chat until they ask your birthday, usually twice" — written down)
    4. carry the mail sack from the causeway so Hesper can reopen (her lamp comes on)
    5. deliver a parcel
    6. write and post a letter
    7. pin your arrival notice on the Mooring Post
    8. catch one fish
    9. dig up one find and show Barnaby (his lamp comes on)
  - Takes **about 45 minutes**; ends with the **first payment ceremony** and **your porchlight coming on.**
- **Rationale:** Teaching every system stays; strict order and hidden requirement go (O2). Errands paying down debt = progress, not chore; lamps coming on teach the core image (a lit porch means someone is home).

#### C4 · Foreign fruit acquisition (Gameplay)
- **WW:** Random by mail / villager replies / friends' towns; low-quality-letter exploit (O11); Nintendo Wi-Fi Connection shut down in 2014.
- **Porchlight:** Three sources, all visible:
  1. **Wednesday is sister-town parcel day.** Post a crate of native fruit; the sister town's fruit arrives next morning with a letter. At 1.0: **two offline NPC sister towns** plus friends' towns by friend code.
  2. **Friendship gifts** tied to life-thread beats.
  3. **Rare night seedlings** at Ludo's Saturday Lantern Market.
  - Letter tone (**warm, chatty, curt**) is shown as you write, so good letters get good replies by design. The Greenhouse grafting bench spreads whatever fruit you get.
- **Rationale:** No wiki needed; offline sister towns mean trading never depends on a server.

#### C5 · Selling & shop logistics (Gameplay)
- **WW:** Shop is the only buyer and only during hours (closed 11 pm); 15 slots, no stacking, 6 round trips (O6); nothing to do after close (O14).
- **Porchlight — rule: "someone is always buying."**
  - **Juniper Pell** buys at Pell's Sundries **8 am–10 pm**, full price.
  - **Ludo**, the fruit-bat lamplighter, buys **10 pm–8 am**, full price.
  - **Consignment Crate** by your gate sells anything overnight at **90%.**
  - **Basket tool** carries 3 extra stacks.
  - Barnaby identifies fossils and relics in **one batch.**
  - Ambrose buys timber and carves it into furniture over **two nights**, tagged with where the tree stood.
  - A 30-tree harvest = one trip, or none via the crate. **Classic preset removes the crate.**
- **Risk logged:** removing friction can shrink a day to 12 minutes; the playtest gate treats a **median session under 25 minutes as a red flag.**

#### C6 · Shop stock, upgrade tiers & remodel closure → Pell's Sundries (Gameplay)
- **WW:** Random daily stock including basic tools (no shovel on day 1, O10); 4 tiers by spending [NEED SOURCE: thresholds]; closed all day after an upgrade (O8).
- **Porchlight:**
  - **Pell's Sundries**, run by **Juniper Pell**, a magpie, in the old net loft. Sprite 22×32: black `#1F1D2A`, tail sheen palette-cycles `#2A6F8F` → `#3FAE8C`, shop apron `#C97B2C` with too many 2-px pockets. Animations: hop 4f, head-tilt at something shiny 3f, heirloom unwrap 8f.
  - **Every basic tool is in your starter kit and always on the shelf.** Furniture and clothes rotate daily.
  - The Thatch build expansions **overnight**; if one runs into the next day, Juniper trades from a **cart outside at full price.**
  - Each expansion reveals more of her **back room**, where she has kept the town's **pawned heirlooms for 30 years**; she gives them back as porches light.
- **Rationale:** The remodel was the deadest day (O8); O10 locked income behind a roll. Shop growth becomes story instead of closure.

#### C7 · House loan ladder & lender (Gameplay)
- **WW:** Tom Nook (also the shopkeeper); 7 interest-free loans, no deadline: **19,800 → 120,000 → 298,000 → 598,000 → 728,000 → 848,000 → 948,000 = 3,559,800 Bells.** Paid at town hall. First full day ≈ 25k (O7). No time estimate; tier contents fixed [NEED SOURCE].
- **Porchlight:**
  - You owe **Hearthwright & Daughter Building Co-operative.** Interest-free, no deadline, no penalty.
  - Seven loans (Proposed, to be tuned):

| Loan | Amount (◉) | Tier |
| --- | --- | --- |
| 1 | 12,000 | bedsit |
| 2 | 90,000 | cottage |
| 3 | 180,000 | commission |
| 4 | 300,000 | commission |
| 5 | 450,000 | commission |
| 6 | 600,000 | commission |
| 7 | 750,000 | the Lamp Room |
| **Total** | **2,382,000** | |

  - **From loan 3 on, you commission what Wren builds, choosing 4 of 6:** Porch & Loft, Cellar, Side Room, Greenhouse, Workshop, Gallery. The other two can be bought after the Relighting.
  - **Resident shares:** when you see a lead life thread through, that neighbor brings Wren a tally stick worth **5% of your current loan.**
  - **Ledger Board** by your gate shows what you owe and Wren's estimate ("At this week's pace, about 6 days").
  - **Targets:** about 3 weeks for a grinder; **8–12 weeks at 45 minutes a day**; hard floor of **7 nights.**
- **Rationale:** The ladder works (O7); a face you root for replaces faceless debt. Total is a third lower because removing friction should raise income per hour ~1.5–2× [NEED SOURCE: playtest] — rests on one data point (~25k on first WW day). Beavers appear in AC as event hosts (Chip, C.J.), not lenders; still on the species-for-role check [NEED SOURCE].

#### C8 · Fishing (Gameplay)
- **WW:** Only 3 river + 3 sea shadows at a time, respawn ~2 min, only near the camera. Bite window 7–31 frames. Species unknown until caught beyond shadow size. No release from pocket (O4). Night sea best income: red snapper 3,000, barred knifejaw 5,000 (O9).
- **Porchlight:**
  - Shadows **simulated in every body of water: 4–8 per river reach, the pond, the quay and each sea zone.** Only **on-screen** fish spawn as entities. Schools visible from bridges.
  - **6 shadow sizes** plus silhouettes: dorsal fin, forked tail, eel ribbon, flat ray, a silver school of 6–12 that flashes together. Shadows shimmer at dawn and dusk.
  - **Learned tells:** after catching a species **3 times**, its tell shows everywhere — a 1-px glint every 2 s, a bar pattern under moonlight, or a ribbon wiggle.
  - The bobber **feints 1–3 times**, then bites with a splash, a rumble and a "plip".
  - **Default timing keeps the 7–31 frame band (~0.12–0.52 s at 60 fps):** common fish at the generous end, night headliners at the tight end.
  - **"Gentle" timing (0.6–0.9 s)** is an accessibility option with its **own record board.**
  - **"Let it go"** releases any fish and nudges that reach's **busy/quiet value** up; the value has a **floor**, so nothing is ever fished out.
  - **Night headliners (Proposed):** moonlit **John Dory 2,400◉**, **lantern wolffish 4,200◉.**
- **Rationale:** The reflex is great; the searching is dead time (O9). Tells turn luck into knowledge; the floor means no overfishing lecture. Night sea fishing stays the money-maker.

#### C9 · Bug catching & biting bugs (Gameplay)
- **WW:** Net; bugs by season and hour [NEED SOURCE: roster]; some summer-night bugs (tarantula, scorpion) bite → faint, wake outside house [NEED SOURCE].
- **Porchlight:**
  - **40 bugs at launch**, set by season, hour and weather.
  - **Moths and fireflies gather at lit porches and at string lights you hang** — the more porches you've helped light, the richer the night's catch.
  - Rare bugs on the **glowing mud at a night low tide.**
  - **Biting bugs** (e.g., a marsh wolf-spider, Proposed) **only startle you**: 4f hop back, the bug scuttles away, you lose nothing.
  - Catching a species 3 times reveals its tell (a wing shimmer, a ripple in the ground).
- **Rationale:** Punishment contradicts "nothing hidden, nothing punished"; moths-to-porchlights puts the core fantasy into a minute-to-minute system.

#### C10 · Digging: fossils & the money rock (Gameplay)
- **WW:** ~4 star-shaped cracks per day [NEED SOURCE]; shovel needed (not stocked day 1, O10); identify → donate or sell; a random daily money rock; players dig holes behind themselves to stop knock-back.
- **Porchlight:**
  - **About 4 fossil cracks on land each day.**
  - At **low tide** the flats show **glints**: town relics, cockles, villagers' buried time capsules.
  - The flats hold **exactly one daily Glint** — a button purse buried in the mud — the **one-a-day windfall.**
  - The **Loupe** (starter kit) names a find on the spot; Barnaby identifies everything in one batch.
  - The **Workshop commission** adds a **cleaning bench** that reveals a relic's history overnight. Relic histories link to specific old letters and are pinned to the Archive string wall.
- **Rationale:** Keeps the daily habit and windfall; moves it onto the tide flats (second clock) and drops the AC term "money rock".

#### C11 · Gyroids → Ambrose's music boxes (Gameplay, Proposed)
- **WW:** Clay figurines dug up (more after rain [NEED SOURCE]); bob and make sounds indoors; sellable.
- **Porchlight:**
  - Bring Ambrose timber and ask for a **music box** instead of a chair. **Two nights later** he hands you a small carved box, tagged with where the tree stood, that plays **one instrument stem of the current hourly theme**; you choose the instrument at commission. Several boxes in one room play the hour together.
  - **Made, not found:** nothing dug up or washed ashore; not clay; no collectible family sets; **no idle animation** (lid stays open while it plays).
  - **Content scope line:** one box design per stem instrument, counted inside the ~300-item furniture budget [NEED SOURCE: stem count].
  - **Cut order slot 1b** (right after item 1): boxes go; stems play only in the world score. Cut item 12 would also take them.
  - **Do-not-use list addition:** "gyroid-like figures".

#### C12 · Balloon presents & slingshot → Drift lanterns (Gameplay, Proposed)
- **WW:** Balloon presents drift across town; shoot down with slingshot for furniture/clothing [NEED SOURCE: schedule].
- **Porchlight:**
  - Small paper **sky-lanterns drift over from the sister towns**, each carrying a parcel, sinking until they **snag in a tree or on a roof edge.** Shake the tree, or **net the lantern off the eaves.** **No slingshot in the game.** Each parcel carries a note from that sister town.
  - **Content scope line:** one spawn rule and one lantern sprite; contents from the existing sister-town parcel tables; **about one a day** [NEED SOURCE: tuning].
  - **Cut order slot 1c:** lanterns go; their parcels arrive in Wednesday's sister-town post.
  - **Do-not-use list additions:** balloon presents, slingshot.
- **Rationale:** Rewards looking up; uses the shake and net you already have; removes the wrong-tool miss (O5).

#### C13 · Snowmen (Gameplay)
- **WW:** Roll two snowballs, stack; snowman judges its proportions; perfect → snowman furniture by mail [NEED SOURCE].
- **Porchlight:**
  - Winter toy: roll two snowballs and stack them. A **small ruler on the notice slip shows the ratio.** The snowman **never talks or grades itself.**
  - A perfect one earns a **stamp on that winter's Season Book page**, drawn as Odile's quick pencil sketch (one stamp design). **Nothing arrives by mail.**
  - Sandcastles on the summer flats = Expand, not a promise.
  - **Do-not-use list addition:** "snowman furniture by mail".

#### C14 · Rivers, bridges & routing (Gameplay)
- **WW:** Rivers crossable only at generated bridges; long routes (O13); no adding bridges [NEED SOURCE].
- **Porchlight:** **Low tide opens stepping stones across the river mouth, and the causeway.** **Two footbridges are Commons projects** that you fund and choose the order of. River reaches are fishing grounds and a routing puzzle at high tide.

#### C15 · Evenings & night → Porchlight Hours (Gameplay)
- **WW:** Shop closes 11 pm; nowhere to sell; waiting is the main mechanic (O14); night sea fishing best income (O9).
- **Porchlight — Porchlight Hours, 8 pm to 2 am:**
  - Neighbors sit out on porches **8–11 pm**; **porch talk** is where life-thread beats land.
  - Juniper closes at **10 pm.** Ludo then buys anything at full price **until 8 am** and lights the lamps on his route.
  - **Hesper's post counter is open 6 pm–2 am.**
  - Night sea fishing stays the best income. Fireflies, moths, **meteor showers seen from the cliff**, string lights you hang yourself.
  - **Saturday night is the Lantern Market.**
  - **Ludo sprite:** 24×32 standing, 20×34 hanging. Russet mantle `#9A5B32`, cocoa body `#5A3A2A`, wing membrane `#3B2A33` glowing `#7A4A5A` where lamplight shines through; 2-px amber eye reflections; a lamplighter's pole. Animations: hanging sway idle 4f, light lamp 8f with trailing glow motes, wing-wrap shiver 4f.
- **Rationale:** Many adults can only play at night; night should be half the game.

#### C16 · Wi-Fi & local visiting (Online/Social)
- **WW:** Nintendo Wi-Fi Connection (friend codes) + local wireless; up to 4 players via the gate; typed chat; trading. Service shut 2014.
- **Porchlight:**
  - **Asynchronous only at 1.0.** Exchange parcels and postcards with friends' towns by friend code; two offline NPC sister towns mean trading never needs a server.
  - **Moderation:** friend codes only, **preset postcard phrases**, **filtered free text**; **no player-made images travel at 1.0.**
  - Live visiting and couch co-op = Expand, not promises; marketing will say so [NEED SOURCE: backend cost].

#### C17 · Multiple residents on one save (Online/Social, Proposed)
- **WW:** Up to 4 profiles per cartridge sharing one house and its loans [NEED SOURCE].
- **Porchlight:**
  - **Up to 4 local profiles per save.** Profile 1 is **the Keeper** and holds **the only loan ladder.**
  - Profiles 2–4 each move into a **reopened dark house**; its porch lights and counts toward the porch count Augusta reads at the Lantern Float; **at 1.0 those houses don't grow.**
  - Letters, the Commons Jar and the Relighting are **shared.**
  - A shorter 4-tier ladder and a tally wall per extra resident = Expand.
  - **Content scope line:** 4 local profiles per save; profiles 2–4 in fixed-size reopened houses.
  - **Cut order slot 1e:** one profile per save at 1.0.

#### C18 · Villager roster, personalities & dialogue (Story/Characters)
- **WW:** 6 personality types (normal, peppy, snooty, lazy, jock, cranky) across many species; lines repeat quickly (O12).
- **Porchlight:**
  - **24 launch neighbors across 8 species families:** wombat, bilby, rock hyrax, badger, spoonbill, lyrebird, **stoat (coat turns ermine in winter)**, tapir. Each family shares **one skeleton** with palette and marking swaps.
  - Every neighbor has a **daily schedule, opinions about the others, and a memory** of what you gave them and said to them.
  - **Line memory:** no line repeats for about **five days.**
  - **"Linger"** opens a second topic; **porch talk 8–11 pm** carries the deeper beats.
  - **13 hand-written lead life threads**, each **4–6 beats over 3–6 real weeks**, advancing **only if you're involved**; the rest are built from templates.
  - Examples:
    - **Clementine "Clem"**, bilby — 20×30 counting her tall ears, blue-grey `#8E95A8`, long nose, ink-stained paws — writing a murder mystery you appear in.
    - **Bramble**, rock hyrax — 22×22, round as a loaf, gardening gloves, sun-on-a-rock idle 2f, alarm whistle 4f — fence feud with Tuck that you can broker.
    - **Odile**, roseate spoonbill — 22×38, beret, brush stroke 6f — painting the Twelve Lights.
    - **Tamsin Brack**, badger mudlark — 26×30, headlamp casting a dithered cone — trying to buy back her family's oyster boat.
  - **IP notes:** no species from AC's named villager families; bird adjacency reviewed by counsel. Rock hyrax and bilby **replace** marmots (ground squirrels, AC squirrel family) and quokkas (macropods, AC kangaroo family). Spoonbill and lyrebird (AC general bird group), wombat (shares an order with AC koalas/kangaroos) and tapir (shares an order with AC horses/rhinos) all go to the competitive check. **If cut item 9 is needed:** flagged families go first, and a flagged family's lead (Odile or Ferdinand) moves to a surviving rig rather than losing a hand-written thread; if nothing is flagged, **stoat and tapir go** (neither carries a lead thread). Writing is the biggest content cost.

#### C19 · Villager favours & requests (Story/Characters)
- **WW:** Random favours when talking; nobody tells you who wants what (O12).
- **Porchlight:** Wants are **pinned to neighbors' doors** as little notes and **copied onto the request slate on the Mooring Post** ("Tuck wants a sea bass for his race diet"), showing who asked, what they want and the reward. Favours advance life threads and friendship; **none expire within the week** (Proposed).

#### C20 · Villagers moving in & out (Story/Characters)
- **WW:** Few villagers at start, cap 8 [NEED SOURCE]; moving-out announcements you can talk them out of if caught; game picks plots.
- **Porchlight:**
  - Neighbors arrive when you and the town **reopen dark houses through Commons projects.** The new neighbor **walks across the causeway at dusk the next evening**, and their porch lights.
  - Moves are **announced weeks ahead on the Mooring Post**; you can ask the neighbor to stay. **Nobody leaves partway through their life thread.** Neighbors who leave move to a sister town and keep writing.
  - **Launch pool: 24.**

#### C21 · Special visitors (Story/Characters)
- **WW:** Gulliver (castaway seagull quiz → souvenir by mail), Katrina (fortunes), Saharah (carpets), Wendell (walrus, food for wallpaper), Joan (Sunday turnips), Gracie (giraffe Fashion Checks). You only know a visitor came if you ran into them.
- **Porchlight:**
  - Visitors are the story's **two named visitors** and the **sister-town walkers**; every one **walks over the causeway at low tide**, is **announced on the Mooring Post the morning they arrive**, and **stays two or three days.**
  - **Tova Limosa**, bar-tailed godwit chartmaker: comes every **spring tide** to sell charts and sound the bar.
  - **Ferro Calloway**, kinkajou glass pedlar: sets up beside Ludo at the **month's first Lantern Market** with lamp glass, shades and string lights.
  - On **parcel weeks** a sister-town resident walks over with gossip and fruit.
  - All run on **reused neighbor rigs.**
  - **Nobody washes up, quizzes you or mails a souvenir.** Fortunes are cut (the barometer's odds are the only foretelling). Rug and wallpaper trades move to the Lantern Market and the Porch Sale. Themed fashion checks are cut; Porch Supper dress themes are optional.
  - **Do-not-use list addition:** "castaway seabirds".

#### C22 · Tortimer & seasonal holidays → Augusta Skerry and four festivals (Story/Characters)
- **WW:** Mayor Tortimer hosts events [NEED SOURCE]; real-world holidays bring Jack (Halloween), Franklin (Harvest Festival), Jingle (Toy Day).
- **Porchlight:**
  - **Augusta Skerry**, grey seal, **Harbor Warden**: keeps the green and the slipway and emcees four original festivals — **that is her whole job** (forecast = barometer/Ansel; building = co-op; nobody stamps approvals).
  - Sprite: 30×22 hauled out, 24×28 sitting up on the slipway; mottled grey `#7F868C`, darker blotches `#545B63`, cream throat `#D9D2C3`, long Roman-nosed grey-seal profile, 1-px whiskers `#F6F1E3`, warden's sash `#3B4A6B`, brass bosun's whistle `#D9A441` on a lanyard. Animations: galumph walk 4f with 1-px dust puff, flipper clap 3f, whistle pip 2f, slow roll onto her side to listen 5f.
  - **Festivals:**

| Season | Festival | What happens |
| --- | --- | --- |
| Spring | **Mudlark Day** | Low-tide dig contest + Tuck's mud race, called by Augusta |
| Summer | **Firefly Regatta** | Lantern boats down the river |
| Autumn | **Lantern Float** | Augusta reads the count of lit porches aloud |
| Winter solstice | **Long Night** | Visit every lit porch; each gives a small gift |

  - **Weekly beats:** Saturday **Lantern Market** and **Porch Supper**; Sunday **Porch Sale.** **Birthdays stay.**
  - Grey seal as Harbor Warden → competitive check [NEED SOURCE: counsel]. Her species carries no pun on a job title.

#### C23 · Opening interview & character creation → the lease card (UX/Systems)
- **WW:** Taxi arrival with Kapp'n; touch keyboard; quiz silently sets face and gender; no preview, no undo (O1); face permanent.
- **Porchlight:**
  - You **arrive on foot at dusk over the tidal causeway**, the sea closing behind you. **Wren hands you a lease card, and the card is the character creator.**
  - **Fields:** species (**water vole, river otter, red panda, opossum, ferret, mongoose**), **10 fur palettes per species**, markings, **3 eye shapes**, blush, outfit. **Pronouns are a separate field.**
  - Every field is visible and editable; before you sign, the card **previews the finished Newcomer** and lets you go back to any field. Re-editing later at a mirror = Expand.
  - Name and town entry is **controller-first, with a confirm step and protection against stray backspaces.**
  - Wren's small talk sets **only your starter houseplant and the first morning's weather**, and she tells you so.
- **Rationale:** Keeps the charm, respects the player (O1); arriving on foot drops the vehicle-arrival trade dress.

#### C24 · Saving (UX/Systems)
- **WW:** Only "Save and end" (to title); "Continue" cancels; ~30 s per save; loading writes another save (O3).
- **Porchlight:** **Autosave at every door.** **"Rest"** (bed or porch) saves in **under a second** while Dimity writes the Day Page. **Quit from pause at any moment; loading never writes a save; power loss → resume at the last door.** The Classic preset does not bring the old save back.

#### C25 · Pockets, wallet & full-inventory prompt (UX/Systems)
- **WW:** 15 slots, no stacking; money bags take slots; wallet cap 99,999; "Swap it / Drop it" freeze; no fish release (O4).
- **Porchlight:**
  - **4×5 satchel (20 slots, expandable to 40)**, stack counts in a **3×5 pixel font.**
  - **Fruit and shells stack to 10.** Button purses go **straight to a wallet with no cap.**
  - Full satchel → overflow **spills into a basket at your feet** with a torn-paper notice; **never frozen in a prompt.**
  - **"Let it go"** releases any fish from the satchel (6f arc back into the water + splash).
  - **Classic preset:** 15 unstacked slots.
- **Rationale:** Inventory cost the most real time (O4, O6, O8); the limit forced walking, not decisions.

#### C26 · Tool equipping (UX/Systems)
- **WW:** Drag tool onto portrait; separate menu to remove; B drops items; shaking needs empty hands (O5).
- **Porchlight:** **Hold the shoulder button** to open a **ring of 8 brass tool sockets**, or **tap it to swap between your last two tools.** Context actions (shaking, talking, picking up) put your tool away and bring it back automatically. **Back cancels and never drops anything.**
- **Rationale:** "Needing a menu twice for one action is a bug" (O5). New Horizons already has a tool ring [NEED SOURCE] — this is the minimum, not a hook.

#### C27 · Happy Room Academy → Co-op Home Notes from Wren (UX/Systems, Proposed)
- **WW:** House scored by mail on hidden rules (feng shui colours by direction, sets, themes, counts) [NEED SOURCE: rewards].
- **Porchlight:**
  - Scoring rules are **printed in your ledger**: matched sets, themes, lighting, plants, and a **provenance bonus** for furniture Ambrose carved from your own timber. **Every score shows its breakdown.** No hidden colour-by-direction rules.
  - The **Gallery commission** displays your tally wall and paintings.
  - Housewarmings (neighbors visiting indoors) = Expand (behaviour not budgeted).
  - **Content scope line:** one scoring pass with printed rules and a ledger breakdown.
  - **Cut order slot 1d:** Home Notes go; decorating carries no score.

#### C28 · Art style & rendering → "Field-guide pixel" (Visuals)
- **WW:** Low-poly 3D at 256×192 per screen; big-headed chibi villagers; human player.
- **Porchlight:**
  - **Native canvas 480×270**, scaled by whole numbers (**×4 for 1080p, ×8 for 4K**; **Deck renders 426×266 at ×3**).
  - **Tiles 16×16**, 3/4 top-down view.
  - Characters have the proportions of a **naturalist's field-guide plate**, not round chibi heads.
  - **64-colour master palette** with hue-shifted ramps: shadows lean blue-violet, highlights lean warm cream; **no pure black (night ink `#141B33`) or pure white (`#F6F1E3`).**
  - Outlines are selective, in a dark shade of each sprite's own hue.
  - **Characters animate at 12 fps over a 60 fps world**, one anticipation frame per action; **no rotation, sub-pixel movement or bloom.**
  - **Time of day via palette LUT swaps:** dawn, morning, noon, golden hour, blue hour, night, moonlit.
  - **Hand-painted normal maps only on characters and light-casting props.**
  - (From the team table: UI layer is **960×540.**)
- **Rationale:** Looks the way people remember, is the most defensible step from AC's 3D chibi look, and a team of 14 can ship it. "Every screenshot should read as a field-guide plate that learned to glow at night."

#### C29 · Top-screen sky & Celeste's constellations → the Skyband (Visuals)
- **WW:** Top screen shows the sky (sun, clouds, moon, stars); Celeste lets you draw constellations [NEED SOURCE: how many].
- **Porchlight:** **The Skyband**, a live strip **about 40 px tall** across the top of the screen, with parallax: **sun arc, clouds, moon phase, tide indicator, stars, meteor showers.** An optional **Two-Screen layout** on Deck and PC moves the Skyband and the map into a side panel. Drawing and naming your own constellation = Expand.

#### C30 · Town map (Visuals)
- **WW:** Small stylized overview (O13).
- **Porchlight:** An **illustrated pixel map** showing **neighbors' head icons where they are right now**, your own pins, the **current tide**, which **reaches are busy or quiet**, the **fossil cracks you've spotted**, and the **lit-porch count.**

#### C31 · Player avatar → THE NEWCOMER (Visuals)
- **WW:** Human kid; face fixed by quiz; hair at Shampoodle; summer tan; one-piece outfits.
- **Porchlight:**
  - An **animal paper doll on one shared two-legged skeleton: 24×32 px, about 2.5 heads tall with a 12-px head.**
  - **6 species sets** of head, ears and tail, plus **markings** (mask, socks, stripe, freckle spots, blaze) and **2×3-px eyes with a 1-px highlight.**
  - Default outfit: **lighthouse-stripe jumper (`#3B4A6B` / `#F4E8C1`)**; the **co-op apron (`#4F6D7A`)** is worn during the errands.
  - **8 directions using mirrored diagonals.**
  - **Animations:** walk 8f, run 6f, shake 6f (synced to the tree's sway), cast 8f, reel 4f, net 6f, dig 6f, pick up 3f, release fish 6f, write letter 4f, receive tally half 6f, porch sit 4f, sleep 2f.
  - Optional **summer and winter coat** replaces tanning (Proposed).
  - **Competitive-check flags:** AC has otter special characters (Pascal, Lyle) → river otter needs checking; water vole shares a rodent family (Cricetidae) with AC's hamster villagers.
- **Rationale:** Playing an animal is the single biggest trade-dress move; accepted costs: some WW fans miss a human avatar; six heads on one rig takes animation time.

#### C32 · Clothing & Able Sisters pattern design (Visuals)
- **WW:** Able Sisters sell clothes; 32×32 patterns from fixed 15-colour palettes with limited slots [NEED SOURCE]; one-piece tops only [NEED SOURCE].
- **Porchlight:**
  - **Layered clothing:** top, bottom, shoes, hat, accessory, held item.
  - **Pattern Sampler** at home (Proposed): **32×32 designs from the 64-colour master palette** for clothes, rugs and porch banners.
  - Designs stay in your own save at 1.0: **PNG export to your own device**, but **no design travels by parcel or postcard** (online plan moderates only preset phrases and filtered text, not images). Sharing with friends' towns and putting a design on Tamsin's boat sail = Expand.
  - Pell's stocks fabric; **moth-silk clothes** sell at the Lantern Market.
  - **Content scope line:** one 32×32 editor on the master palette, local saves only, slot count to be set [NEED SOURCE].
  - **Cut order slot 1a:** the Sampler goes and Pell's fixed fabric stock covers it; the PNG export goes with cut item 2.

### 4.3 REMOVE

#### R1 · K.K. Slider Saturday concerts (Audio)
- **WW:** K.K. Slider plays The Roost Saturdays 8 pm–midnight; request or random song; you receive a song item for your stereo.
- **Porchlight:** Removed. Saturday night becomes the **Porch Supper**, a potluck on a different neighbor's porch each week, alongside Ludo's Lantern Market. **Ferdinand's life thread ends with him singing at a Porch Supper.** Owning music moves to Ambrose's music boxes; if those are cut, the hourly score carries it.
- **Rationale:** The Saturday musician and song items are the most recognisable trade dress in the genre (both on the do-not-use list); a fixed weekly concert asks players to show up at a set hour.

#### R2 · Stalk market / turnips (Gameplay)
- **WW:** Joan sells turnips Sunday mornings; price changes twice daily Mon–Sat; spoil next Sunday or on time travel [NEED SOURCE].
- **Porchlight:** **No speculation market.** The "check today's price" habit moves to Pell's **Wanted Today** board (3 items at +50%), the **Consignment Crate** and the **night buyer**, all at predictable prices.
- **Rationale:** A buy-low/sell-high gamble sits badly with a debt theme and a plannable fixed-price economy; it is the strongest time-travel and wiki incentive and a Sunday-morning appointment; dynamic pricing punishes the planned harvest.

#### R3 · The Roost café & barista job (Gameplay)
- **WW:** Brewster's café in the museum basement; coffee for a small fee; barista shift after enough visits; K.K. plays here.
- **Porchlight:** **No café at 1.0.** Its social job goes to porch talk (8–11 pm) and the Saturday Porch Supper. A tearoom with an evening shift serving tide-tea, orders built from what each neighbor has told you = Expand. If it returns it needs its own name (working name: **the Slipway Tearoom**; "net loft" already belongs to Pell's Sundries) and a content-scope line (it would be an **eleventh Commons project**).
- **Rationale:** Not in production scope, budget or cut order; **Pillar 8 rules out unbudgeted additions.**

#### R4 · Mr. Resetti (Story/Characters)
- **WW:** Mole who lectures you after quitting without saving; escalating lectures [NEED SOURCE] (O3).
- **Porchlight:** Removed; **no other scold replaces him.** **Dimity** takes over the save role as a gentle presence: lands on the porch lamp, writes your Day Page, and her footnotes slowly tell the town's history. If the game was closed abruptly she only notes, **"You left in a hurry. I kept your place."** At the end she moves into the Lamp Room and the save screen moves with her.
- **Rationale:** Scolding is the wrong emotion for a cozy game and for players carrying real debt; with autosave there is nothing to scold (O3). Logged as a nostalgia risk; even the Classic preset won't bring a scold back. A licensed remaster could keep him as an optional cameo.

#### R5 · Crazy Redd & forged art (Story/Characters)
- **WW:** Weekly tent [NEED SOURCE] with marked-up furniture and paintings, some forgeries the museum refuses.
- **Porchlight:** **No forgeries.** The shady-night-vendor thrill moves to **Ludo's Saturday Lantern Market** (rare night seedlings, lamps, moth-silk clothes at honest prices). Art enters via **Odile's Twelve Lights paintings** (she gives you the canvas of your own porch at the autumn gallery) and **Juniper's returned heirlooms**; each piece carries provenance text linked to the letters.

#### R6 · Weeds, absence penalties & town rating (UX/Systems)
- **WW:** Absence → weeds, wilted flowers, remarks, move-outs [NEED SOURCE]; town hall environment rating with a perfect-rating reward [NEED SOURCE].
- **Porchlight:** **No penalty for being away.** The town catches up in a simplified simulation; **Dimity's "While you were away" page** explains what happened; neighbors just say they missed you. Weeds appear only as **slow, cosmetic growth in untended corners** and never cause guilt (Proposed). **No score that can go down.** A monthly **Harbor Walk** note praising specific things = Expand.

#### R7 · "Rolling log" camera curvature (Visuals)
- **WW:** Ground curves away, hiding the horizon; beach and waterline ambiguous (O13).
- **Porchlight:** **Flat camera, no world curvature.** At the shore and on the cliff the camera **lowers to show a true horizon line with the dark lighthouse on it.** **Wet sand sits two ramps darker than dry sand** (clear tide line). Foreground grass turns see-through around the player.
- **Rationale:** Readability fix (O13) and an IP move (the curve is an AC visual signature).

### 4.4 ADD

#### A1 · Tide as a second clock (Gameplay)
- **WW:** No tide.
- **Porchlight:**
  - **Real-time tide: two low tides a day, about 12 h 25 min apart; each comes about 50 minutes later than the day before.**
  - **Low tide opens** the flats (relic glints, cockles, the daily Glint), the causeway and the stepping stones. **High tide brings shoals to the quay.**
  - Today's lows are on the **Tide Table chalkboard by your gate** and on the **Skyband indicator.**
  - **Visuals:** a per-tile mask animates with the tide; foam is 3 frames of palette cycling; wet sand two ramps darker than dry; wet mud reflects the sky in 2-px streaks. On a **night low tide the mud cycles bioluminescent cyan (`#3FF2E0`)** and gives up glowing relics.
  - **Guarantees:** every **12.5-hour waking window contains a low tide**; **nothing is exclusive to one tide**; the tide gives shortcuts and bonuses but **never locks anything.**
  - Playtest with night-only players and shift workers.
- **Rationale:** A drifting second clock gives each day a different shape without adding a genre; the guarantees stop it becoming appointment pressure.

#### A2 · Community events: fishing tourney, Bug-Off, flea market (Gameplay)
- **WW:** [NEED SOURCE] — the pitch believes these come from other AC games, not WW; fishing and bug catching are solitary in WW.
- **Porchlight:**
  - **Mudlark Day** (spring): low-tide dig contest plus Tuck's mud race, called by Augusta.
  - **Firefly Regatta** (summer): lantern boats down the river.
  - **Sunday-morning Porch Sale:** neighbors lay old furniture out on blankets, **priced by personality** (Bramble charges double).
  - **Archive record boards** track the biggest catch per species, with a **separate board for Gentle timing.**

#### A3 · Reward for clearing the debt → The Relighting (Story/Characters)
- **WW:** No ceremony known for the final 948,000 payment (GameCube original gave a statue) [NEED SOURCE].
- **Porchlight:**
  - On the morning the **Lamp Room** is finished, **Ambrose, nearly blind, climbs the stair and walks the room by touch** with one hand on the wall (6f touch-walk). He says it's better than his.
  - At dusk **Juniper gives you the last heirloom in her back room: Isolde's keeper's lantern.**
  - You and **Wick** carry its flame up the stair, the lens catches, and a **dithered amber beam sweeps every roof in town for the first time.** A **ferry horn answers from the dark, playing your Signal.**
  - Credits roll over your **tally wall**, Odile's **Twelve Lights** paintings and the porches you lit. **The game carries on afterwards.**
- **Rationale:** The finale is tied to the **house ladder**, not the mystery, so every player who finishes the debt gets the ending whether or not they read a single letter.

#### A4 · Narrative / story (Story/Characters)
- **WW:** Essentially no plot; taxi ride and part-time job are the only scripted sequences.
- **Porchlight:**
  - A **light mystery, optional and skippable**, delivered through the morning mail.
  - **Hesper's sack holds about 120 undelivered letters of 60–120 words each**, arriving **one per in-game morning in a fixed order (about four months).**
    - ~40 from **Keeper Isolde Petrel**
    - ~40 old letters to neighbors' families (set up heirloom returns and thread beats)
    - ~40 town history
  - **The Ebb winter:** a mill weir upstream starved the estuary of water and the sandbar rose. On the night of the storm the keeper went upriver to open the sluice, and the lamp ran dry before she got back. The fleet ran aground in the dark, and the town blamed her.
  - **Ansel Stalk**, grey heron, knows **his grandfather built the weir.** Sprite 24×48 (the tallest on purpose), navy harbormaster's coat `#1F3B73`; animations include a one-legged breathing idle (2f) and a slow strike that always misses (10f).
  - **Wick Dorrow**, a puffling (16×22) whose oversized cap slips over his eyes when he runs, calls you **"Keeper" from day one.**
  - **Isolde** appears only as a `#2A2A33` silhouette with a 1-px amber rim light until after the credits. Then a letter postmarked last week arrives: **"I saw the light. —I. Petrel."**
  - **No villain, no deadline; the story never gates tools, shops or upgrades.** Written scenes total **about 2–3 hours.**

#### A5 · Session recap & keepsakes (UX/Systems)
- **WW:** No recap (O14).
- **Porchlight:**
  - Every time you **Rest**, **Dimity writes a Day Page**: buttons earned, loan paid, catches, who you talked to, then **"Tomorrow:"** with the threads you left open.
  - **Dimity** is a rosy maple moth (16×16 sprite, 32×32 portrait): fuzzy lemon body `#F6E27A`, pink wings `#F2A7B5` with a yellow band, feathery antennae, 4f flutter at 15 fps, an antenna that writes the page in a 1-second ink wipe.
  - At each **solstice and equinox** she binds that season's pages into an illustrated **Season Book** you can **export as an image or PDF.**
- **Rationale:** Makes the anticipation visible (O14, O15); Season Books are shareable; cheap (template over tracked data).

#### A6 · Visible long-term landmark (Visuals)
- **WW:** No landmark tracks progress.
- **Porchlight:**
  - A **dark lighthouse** visible from almost everywhere, with your **Keeper's Cottage at its foot.** Its **scaffolding climbs one section per house tier.**
  - **Porchlights (`#F9C46B`)** spread a pool of amber over the boards as each one comes on.
  - After the Relighting, a **dithered amber cone (`#FFB547`) sweeps every roof every 8 s** for the rest of the game.
  - Key art shows the town before and after.

---

## 5. Cross-cutting rule sheets (consolidated from the matrix)

### 5.1 Daily / hourly schedule

| Time | What |
| --- | --- |
| 6 am | Mailbox: replies, birthday invitations, thank-yous, and exactly one old letter from Hesper |
| Before 6 am | Dawn-build vignette watchable (the Thatch tie off the roof) |
| Dawn | Ansel taps the barometer and chalks the day's odds on the Mooring Post |
| 8 am – 10 pm | Juniper Pell buys and sells at Pell's Sundries (full price) |
| 6 pm – 2 am | Hesper's post counter open |
| 8 pm – 2 am | Porchlight Hours |
| 8 pm – 11 pm | Neighbors sit on porches; porch talk carries life-thread beats |
| 10 pm – 8 am | Ludo buys anything at full price; lights lamps on his route |
| Overnight | Consignment Crate sells anything at 90%; one house build per night; Ambrose's two-night carving |
| Twice daily (drifting) | Low tides ~12 h 25 min apart, each ~50 min later than the day before |

### 5.2 Weekly / seasonal calendar

| When | Event |
| --- | --- |
| Wednesday | Sister-town parcel day (post native fruit crate; foreign fruit arrives next morning) |
| Saturday night | Lantern Market (Ludo; rare night seedlings, lamps, moth-silk clothes) + Porch Supper (potluck, rotating porch) |
| Month's first Lantern Market | Ferro Calloway sets up beside Ludo |
| Sunday morning | Porch Sale (furniture on blankets, priced by personality) |
| Weekly | Archive Bounty (3 wanted specimens at a bonus) |
| Every spring tide | Tova Limosa visits (charts, sounds the bar) |
| Spring | Mudlark Day |
| Summer | Firefly Regatta; Barnaby moves into the ship's bell |
| Autumn | Lantern Float (porch count read aloud); Odile's gallery at the Archive |
| Winter solstice | Long Night |
| Each solstice/equinox | Dimity binds the Season Book |
| Birthdays | Kept (invitations by mail) |
| Also listed in content scope | Meteor showers (from the cliff); the Late Delivery party |

### 5.3 Daily limits that must stay (anti-shrink rules)

- Exactly **one Glint** (buried button purse on the flats) per day.
- About **4 fossil cracks** on land per day.
- **4–8 shadows per river reach**; busy/quiet value per reach with a floor.
- **One old letter per in-game morning.**
- **One house build per night.**
- Pell's **Wanted Today**: 3 items per day at +50%.

### 5.4 Economy numbers

| Item | Value |
| --- | --- |
| Currency | buttons (◉) |
| Native fruit | 120◉ |
| Foreign fruit | 480◉ |
| Ripe bonus | +25% |
| Wanted Today bonus | +50% on 3 listed items/day |
| Consignment Crate | 90% of value, overnight |
| Honeycomb (caught swarm) | 350◉ (Proposed) |
| Moonlit John Dory | 2,400◉ (Proposed) |
| Lantern wolffish | 4,200◉ (Proposed) |
| Resident share | tally stick worth 5% of current loan, per completed lead life thread |
| First Week Errands | up to 6,000◉ off loan 1 (12,000◉) |
| Loan ladder | 12,000 / 90,000 / 180,000 / 300,000 / 450,000 / 600,000 / 750,000 = 2,382,000◉ |
| Pace targets | ~3 weeks (grinder); 8–12 weeks (45 min/day); floor 7 nights |
| Abacus | one click per 1,000◉ paid |
| WW reference ladder (do not reuse) | 19,800 / 120,000 / 298,000 / 598,000 / 728,000 / 848,000 / 948,000 = 3,559,800 |

### 5.5 Clock policy

- Real system clock. No in-game skip, no sleep-until-tomorrow, no paid speed-ups, ever (protected).
- A changed system clock → simplified catch-up sim; no punishment, no lecture, no exploit; caps still apply (1 letter/morning, 1 build/night).
- Never-skipped saves earn the cosmetic **"Unhurried"** wax seal on Season Books.
- Absence → catch-up sim + "While you were away" page; no weeds-as-guilt, no score that goes down.
- QA-only tools: a fast-forward only QA can use; the slice's declared **15× accelerated test clock** (1 real minute = 15 game minutes) never ships.

### 5.6 Tide model

- Two lows per day, ~12 h 25 min apart, drifting ~50 min later daily.
- Low: flats (relics, cockles, Glint, time capsules), causeway, stepping stones at the river mouth; night low → bioluminescent mud `#3FF2E0` + glowing relics + rare bugs.
- High: shoals at the quay; river becomes a routing puzzle.
- Guarantees: a low in every 12.5-hour window; nothing exclusive to one tide; bonuses and shortcuts only, never locks.
- Surfaces: Tide Table chalkboard at the gate; Skyband indicator; living map.

### 5.7 Fishing parameters

| Parameter | Value |
| --- | --- |
| Shadow density | 4–8 per river reach; also pond, quay, each sea zone |
| Entities | only on-screen fish spawn as entities |
| Shadow sizes | 6 + silhouettes (dorsal fin, forked tail, eel ribbon, flat ray, silver school of 6–12) |
| Feints | 1–3 before a bite |
| Default bite window | 7–31 frames (~0.12–0.52 s at 60 fps); common = generous end, headliners = tight end |
| Gentle bite window | 0.6–0.9 s; separate record board |
| Learned tell | after 3 catches of a species: 1-px glint every 2 s, moonlight bar pattern, or ribbon wiggle |
| Release | "Let it go" from water or satchel (6f arc + splash); raises reach busy/quiet value; floored |
| Launch roster | 40 fish |

### 5.8 Inventory and tools

- Satchel 4×5 = 20 slots, expandable to 40; stacks of 10 (fruit, shells); 3×5 px stack font.
- Wallet uncapped; purses auto-deposit.
- Overflow basket at feet (torn-paper notice), never a freezing prompt.
- Basket tool: +3 stacks.
- Starter kit includes every basic tool and the Loupe.
- Tool ring: 8 brass sockets (hold shoulder); tap = swap last two; context actions auto-stow/restore; Back never drops.
- Classic preset: 15 unstacked slots, no Consignment Crate; old save and scold do NOT return; counsel must clear the 15-slot preset separately.

### 5.9 Lease-card character creator

| Field | Options |
| --- | --- |
| Species | water vole, river otter, red panda (drawn default), opossum, ferret, mongoose |
| Fur palette | 10 per species |
| Markings | mask, socks, stripe, freckle spots, blaze |
| Eye shape | 3 |
| Blush | yes/no |
| Outfit | default lighthouse-stripe jumper `#3B4A6B` / `#F4E8C1` |
| Pronouns | separate field |
| Signal | six-note phrase on six pentatonic chimes |
| Name / town name | controller-first, confirm step, stray-backspace protection; player names the town; letters fill the name in |
| Preview | full Newcomer preview; back to any field before signing |

### 5.10 Story cast sprite sheet

| Character | Species / role | Sprite | Key colours | Animations |
| --- | --- | --- | --- | --- |
| Wren Hearthwright | young builder, co-op | 24×30 | fur `#8A5A3B`, incisors `#F2A541`, overalls `#4F6D7A` | abacus bead flick 3f; wave from ladder 4f |
| Ambrose | elder builder, nearly blind | Wren's rig, ~28 px with cane | `#7A6656`; 4×4 lenses | gnaw notches 6f; THWAP 5f (+2f shake); touch-walk 6f |
| The Thatch (Corrie, foreman) | five weaver finches | 8×8 each | `#F2CE2E`, masks `#1F1D22`, caps `#B5452E` | 40-frame dawn build vignette |
| Juniper Pell | magpie, shopkeeper | 22×32 | `#1F1D2A`, sheen `#2A6F8F`→`#3FAE8C`, apron `#C97B2C` | hop 4f; head-tilt 3f; heirloom unwrap 8f; dive behind counter 5f |
| Hesper Coil | garden snail, night postmistress | 22×26 front / 32×20 side | body `#A9B8A0`, satchel `#C9B48A`, envelope `#E8D3A0`, seal `#A8323A` | letter from shell 6f; shimmer trail fades 3 s |
| Barnaby Thole | hermit crab, Archive | 24×30 | helmet `#B8862F`/`#E3B867`, claws `#E06A4F`, porthole `#9FD3C0` | scuttle 4f; bubble burst 3f; pin to wall 6f; porthole fog 5f |
| Dimity | rosy maple moth, Day Page | 16×16 (portrait 32×32) | body `#F6E27A`, wings `#F2A7B5` | flutter 4f @15 fps; 1 s ink wipe |
| Ludo | fruit-bat lamplighter | 24×32 standing / 20×34 hanging | mantle `#9A5B32`, body `#5A3A2A`, wing `#3B2A33` glow `#7A4A5A` | sway idle 4f; light lamp 8f; shiver 4f |
| Augusta Skerry | grey seal, Harbor Warden | 30×22 hauled / 24×28 sitting | `#7F868C`, blotches `#545B63`, throat `#D9D2C3`, whiskers `#F6F1E3`, sash `#3B4A6B`, whistle `#D9A441` | galumph 4f; flipper clap 3f; whistle pip 2f; roll to listen 5f |
| Ansel Stalk | grey heron, retired harbormaster | 24×48 (tallest) | coat `#1F3B73` | one-legged idle 2f; slow strike that misses 10f |
| Wick Dorrow | puffling | 16×22 | — | cap slips over eyes when running |
| Isolde Petrel | the Keeper | silhouette only until post-credits | `#2A2A33`, 1-px amber rim | — |

Named neighbors with specs: Tuck (wombat, 26×22, `#7D6A58`, sweatband `#E07A3F`, 3f point); Clem (bilby, 20×30, `#8E95A8`); Bramble (rock hyrax, 22×22, idle 2f, whistle 4f); Odile (roseate spoonbill, 22×38, brush 6f); Tamsin Brack (badger, 26×30, headlamp cone); Ferdinand (lyrebird, 24×34, tail `#C9A54A`/`#3E2618`, fan 5f). Visitors: Tova Limosa (bar-tailed godwit), Ferro Calloway (kinkajou) — on reused neighbor rigs.

### 5.11 Light and landmark colours

| Element | Hex |
| --- | --- |
| Porchlight pool | `#F9C46B` |
| Lighthouse beam cone (post-Relighting, every 8 s) | `#FFB547` |
| Night-low-tide mud | `#3FF2E0` |
| Night ink (darkest) | `#141B33` |
| Lightest cream | `#F6F1E3` |
| Glasswort crimson (autumn maples) | `#A3283A` |

### 5.12 Commons projects (about 10 at launch)

Two footbridges (player chooses order), stepping stones, lamps on the green, the Old Pier, reopening the dark houses (each brings a neighbor at dusk the next evening). Funded via the Commons Jar; the co-op pins a build note on each funded project at the Mooring Post.

### 5.13 Do-not-use list (IP; Producer owns it)

Nintendo character / place / currency names and terms (Tom Nook, Isabelle, Resetti, K.K. Slider, Bells, Nook's Cranny, etc.); AC's numbers (100/500 fruit, the 3,559,800 ladder, the 99,999 cap; the 15-slot Classic preset needs separate clearance); AC's species-for-role pairings; a human avatar; the rolling-log camera; round chibi heads; leaf motifs; a Saturday musician or song items; a train or taxi arrival; the swollen-face bee gag. **Added by the matrix:** gyroid-like figures; balloon presents and a slingshot; snowman furniture by mail; castaway seabirds. Also gone: the term "money rock", fortunes, forgeries, themed fashion checks, licensed real-world holiday mascots.

---

## 6. Vertical slice

### 6.1 Scope
- A **45-minute unguided session at final quality**, plus a **separate 3-day build on real time**, played remotely to measure whether people come back.
- **Autumn palette** (maple, glasswort crimson).
- **One region:** the point with the Keeper's Cottage and the dark lighthouse, the co-op yard, Pell's Sundries, Hesper's post office, the Archive front desk, the quay, one river reach with stepping stones at the mouth, a strip of tidal flats, the Commons board (Mooring Post), and **about 30 trees.**

### 6.2 Declared test clock
- The 45-minute build runs an **accelerated test clock: 1 real minute = 15 game minutes**, so the session spans **5:30 pm to about 4:45 am** game time. Testers and reviewers are told before they start. It is a QA tool and **never ships** (Pillar 1).
- Real time runs only in the 3-day return build, which also carries the dawn checks.

| Real minute | Game time | Beat |
| --- | --- | --- |
| 0 | 5:30 pm | Dusk causeway arrival |
| ~4 | ~6:30 pm | Blue hour |
| 10 | 8 pm | Porch talk begins |
| 18 | 10 pm | Juniper closes; Ludo starts buying |
| 22 | 11 pm | Porch talk ends |
| 22–32 | ~midnight | Night low tide (seeded) |
| ~26 | ~12:00+ | Moonlit LUT |
| 45 | ~4:45 am | Session end |

### 6.3 Contents
- **Opening:** dusk causeway arrival with the tide closing behind you in 3-frame foam, four porches glowing across the water. Lease-card creator with **2 of 6 species fully animated: red panda (drawn default) and water vole.** Every field visible and editable; pronouns separate; controller-first name entry with confirm step.
- **First Week Errands clipboard:** all 9 errands, any order, visible counters; "chat until they ask your birthday, usually twice" written out; each knocks buttons off loan 1.
- **The payment:** loan 1 (12,000◉) paid at the co-op yard with the full ceremony — abacus click per 1,000◉, Ambrose gnaws the notches, THWAP with 2 frames of screen shake and a dust puff, your half on the wall. **Your porchlight comes on**, visible across the harbor. Dimity moves into the lamp and writes the Day Page (Rest save under 1 s).
- **Overnight (3-day real-time build only):** the Thatch's dawn-build vignette (bedsit → cottage, chosen roof colour, scaffolding one section higher) under the autumn dawn LUT. **Hesper delivers letters 1–3.** The Ledger Board shows a pace estimate.
- **Hands:** shaking with auto-stow; 8-socket tool ring with tap-swap; 20-slot satchel with fruit and shells stacking to 10; overflow basket; purses to an uncapped wallet; Back never drops; autosave at every door; quit at any moment.
- **Fishing:** **10 species** including the night headliner John Dory; 6 shadow sizes plus silhouettes; one learned tell after 3 catches; 1–3 feints; default bite band 0.12–0.52 s with Gentle option; "Let it go" release; busy/quiet value per reach.
- **Digging and tide:** tide seeded so the one low tide falls around midnight game time (minutes 22–32). **2 fossil cracks, the daily Glint, and 3 relics** whose histories link to letters. Barnaby batch-identifies. Night low tide makes the mud glow cyan.
- **Neighbors:** **Tuck, Clem and Bramble**, each with a daily schedule, about 5 days of non-repeating lines, Linger, porch talk 8–11 pm, wants pinned to doors. Tuck's nickname moment (accept / decline / suggest).
- **Night:** Porchlight Hours; Juniper closes at 10 pm, Ludo buys after. Bee tree warning, net catch, bee-halo gag on a miss.
- **Audio and light:** **3 hourly themes** with season, tide and night stems; full foley; porch lamps with normal-mapped light. Autumn LUTs for dusk, blue hour, night and moonlit judged in the 45-minute build; the dawn LUT judged in the 3-day build.
- **Tech:** locked 60 fps on Steam Deck in the heaviest scene (night low tide with porch lights and glowing mud); keyboard+mouse and controller; save/load working; system-clock changes handled (tested in the 3-day build).

### 6.4 The M9 gate (agreed before M5, judged at M9)

Each metric is recorded as **Pass, Fail or Not tested; a blank is never a pass.** Outcome: **Go, Re-scope or Stop.** The M10–M18 tranche is released only on Go. Counsel reviews slice footage before any public reveal.

| Metric | Threshold | Build |
| --- | --- | --- |
| External testers | ≥ 30, including ≥ 5 night or shift workers; evening and daytime groups | both |
| Median session length | ≥ 25 minutes | 45-min |
| "Would play tomorrow" | ≥ 70% | 45-min |
| Actual day-2 return | ≥ 50% | 3-day |
| Single friction issue | cited by ≤ 10% of testers | 45-min |
| Pay loan 1 within the session | ≥ 80% | 45-min |
| Payment or porchlight in top-3 moments | ≥ 40% | 45-min |
| Dawn LUT | Pass / Fail / Not tested | 3-day |
| Dawn-build vignette | Pass / Fail / Not tested | 3-day |
| Letters 1–3 arrive | Pass / Fail / Not tested | 3-day |
| System-clock changes handled | Pass / Fail / Not tested | 3-day |
| Look-and-feel test (50 people) | < 25% call it a copy of Animal Crossing (being compared is expected; "copy" is the fail) | footage |
| Steam Deck | 60 fps locked | 45-min |

Related later gates (for reference): Alpha exit = playable causeway → Relighting with placeholders, no core-loop blockers, economy sim within ±20% of a 4-week internal diary study. Beta exit = median session ≥ 25 min, projected ladder 8–12 weeks at 45 min/day, ≥ 99.5% crash-free sessions, ~75k wishlists after Next Fest (Proposed).

---

## 7. Content scope

### 7.1 Launch vs stretch (source table)

| Content | Launch | Stretch |
| --- | --- | --- |
| Neighbors (residents outside the story cast) | **24**: 8 species families × 3, one skeleton per family with palette and marking swaps. Families as listed in this table: wombat, quokka, marmot, badger, spoonbill, lyrebird, stoat, tapir — **see note below** | 36 via free drops (4 more families) |
| Story cast | **12**: Wren, Ambrose, the Thatch (one crew), Juniper, Hesper, Barnaby, Dimity, Ludo, Augusta, Ansel, Wick, Isolde | Isolde homecoming arc (Expand) |
| Player species on the shared rig | **6**: red panda (drawn default), water vole, ferret, opossum, mongoose, river otter; **10 fur palettes each.** River otter is first out under cut item 8 | 9 |
| Hand-written lead life threads | **13**, 4–6 beats each over 3–6 real weeks; templates cover everyone else | 18 |
| Old letters from Hesper's sack | **About 120** (60–120 words each), one per in-game morning | ~150, plus 30 written for after the credits |
| Fish species | **40** | 55 |
| Bug species | **40** | 55 |
| Fossils | **30** | 40 |
| Town relics and shore finds | **20 relics with histories + 20 shore finds** | 30 + 30 |
| Furniture | **About 300** (outsourced, to the style bible) | ~450 via free seasonal drops |
| Clothing pieces | **About 180**, fit-tested on all 6 species | ~260 |
| Music | **24 hourly themes** as adaptive stems (season, weather, tide, night layers); **~16** location/festival/story tracks; **~40** stingers; **~90 minutes** authored | 8 more tracks + OST with seasonal variants |
| Festivals and events | **4 seasonal festivals** (Mudlark Day, Firefly Regatta, Lantern Float, Long Night); **3 weekly rituals** (Saturday Lantern Market, Porch Supper, Sunday Porch Sale); birthdays; meteor showers; the Late Delivery party | 4 minor holidays, one per season, in free drops |
| Commons projects | **About 10** (two footbridges, stepping stones, lamps on the green, the Old Pier, reopening the dark houses) | 14 |
| House ladder | **7 loans (2,382,000◉)**, **6 commission rooms with 4 chosen**, a roof colour at every tier | 2 more commission types |
| Town | **1 hand-built tidal harbor town of about 100 trees**; the player names it | 3 layout variants (Expand) |
| Sister towns and online | **2 offline NPC sister towns** + async friend-code parcels and postcards | Live visiting and couch co-op (Expand) |
| Localization | English + **7 languages** (FR, DE, ES, PT-BR, JA, ZH-Hans, KO), capped at **~200k words** | IT, PL, ZH-Hant |
| Post-launch seasonal drops | **1 free Summer drop at M30** | 4 free drops in Year One, funded from revenue |

**Note on neighbor families — source inconsistency.** The content-scope table lists *quokka* and *marmot*; the matrix row C18, the voice table (C2) and the named cast (Clem = bilby, Bramble = rock hyrax) all use **bilby** and **rock hyrax**, and C18 states explicitly that rock hyrax and bilby *replace* marmots and quokkas for IP reasons. Build to **wombat, bilby, rock hyrax, badger, spoonbill, lyrebird, stoat, tapir.**

### 7.2 Additional scope lines added by the matrix

| Feature | Scope line | Cut slot |
| --- | --- | --- |
| Pattern Sampler (C32) | one 32×32 editor on the master palette, local saves only, slot count TBD | 1a |
| Ambrose's music boxes (C11) | one box design per stem instrument, inside the ~300 furniture budget | 1b |
| Drift lanterns (C12) | one spawn rule + one lantern sprite; ~one a day; contents from sister-town parcel tables | 1c |
| Co-op Home Notes (C27) | one scoring pass with printed rules and ledger breakdown | 1d |
| Local profiles (C17) | 4 per save; profiles 2–4 in fixed-size reopened houses | 1e |

### 7.3 Other counted items

- Player rig: **6 species × about 20 animations × 4 directions.**
- 8 neighbor-family skeletons; 12 story characters; visitors on reused rigs.
- Archive: **150 field-guide plates** (outsourced art line).
- Season LUT sets: 4 seasons × time-of-day LUTs (dawn, morning, noon, golden hour, blue hour, night, moonlit).
- Audio: foley for 6 species on every surface; tide and weather ambience; voice ticks (no VO); UI and ceremony SFX.
- Word budget: hard cap **~200k words**; string freeze at M21.
- Letters: ~120 × 60–120 words; letters 1–80 written by Alpha.

### 7.4 Content by milestone

| Milestone | Month | Counts |
| --- | --- | --- |
| Slice | M5–M9 | 1 region, ~30 trees, 2 player species, 3 neighbors, 10 fish, 2 cracks + 1 Glint + 3 relics, 3 hourly themes, letters 1–3 |
| Alpha (~60% content) | M10–M18 | 24/40 fish, 24/40 bugs, 18/30 fossils, ~180 furniture, letters 1–80, 8/13 lead threads; all 12 story characters, all 8 family rigs, all 6 player species animated; full town; both clocks; all tools; 7-loan ladder + 6 rooms; ~10 Commons projects; 2 NPC sister towns; festival framework; Day Page; in-game Season Book; map |
| Beta content complete | M22 | 24 neighbors, 40 fish, 40 bugs, 30 fossils, 20 relics, 20 shore finds, ~300 furniture, ~180 clothing, ~120 letters, 13 lead threads, 4 festivals, full score; Next Fest demo = First Week capped at loan 1 |
| 1.0 | M27 | As above; 7 languages |
| Summer drop | M30 | ~30 furniture, 5 fish, 5 bugs, 1 minor holiday; any ready cut-list items (e.g., Classic preset, southern-hemisphere toggle) |

---

## 8. Risks

Ratings as given in the source (the rating label sits immediately above each risk title in the flat export).

| # | Risk | Rating | Mitigation |
| --- | --- | --- | --- |
| 1 | Look and feel / trade dress gets compared with Animal Crossing, or the game is labelled a clone | **High** for comparison; **Low–Medium** for legal action [NEED SOURCE: counsel] | Distance built in: animal player, flat camera, field-guide proportions, ledger/tally-stick UI, no AC species/terms/numbers. River otter kept out of the slice and first out under cut item 8. Do-not-use list; counsel gates at M4, M9, M11, M25; look-and-feel test at the slice gate; store copy never names AC |
| 2 | Economy mis-tuned: the 2,382,000◉ ladder takes far less or far more than 8–12 weeks at 45 min/day; only data point ≈ 25k on first WW day | **High** | Monte Carlo model in preproduction; loan-1 time measured in the slice; 12-week closed beta with opt-in telemetry; part-time economy consultant. Rule: tune prices and loan sizes, **never add friction back** |
| 3 | Pixel art is the critical path: 12 story characters, 24 neighbors on 8 rigs, 6 player species × ~20 animations, ~300 furniture, LUTs for every season | **High** | Shared skeletons and palette swaps; normal maps only on characters and light-casting props; furniture/clothing outsourced from M11; each character's animation list frozen at Alpha; cut items 7–10 ready |
| 4 | Writing and localization volume: ~200k words into 7 languages | **High** | Hard word cap owned by Narrative Lead; template threads; reuse via line memory; letters written early (fixed order); string freeze M21; vendor quotes in preproduction |
| 5 | Discoverability in a crowded cozy market; wishlists under target | **High** | Sell specific moments (dusk causeway, THWAP, porchlight, glowing mud), not "cozy". Steam page at M11 (~16 months of wishlists); showcase ~M18; Next Fest demo M22; checkpoints 30k / 75k / 150k (Proposed). Launch date held if wishlists fall badly short |
| 6 | Godot 4 has no public console export; console port needs middleware and a partner | **Medium** | Port partner contracted by M14; console test build before Alpha; pinned engine; avoid GDExtensions without console builds; confirm FMOD has them; $160k budgeted; port after launch so it can't block 1.0 |
| 7 | With friction gone, sessions shrink below 25 minutes | **Medium** | Median-session metric at M9 and Beta. Daily limits stay: one Glint, ~4 cracks, finite shadows per reach. Porchlight Hours, tide, life threads and the morning letter give reasons to stay |
| 8 | The tide creates appointment pressure and FOMO | **Medium** | Low tide guaranteed every 12.5 h; nothing exclusive to one tide or day; playtests include night-only players and shift workers |
| 9 | Steam Deck performance: tide mask, map-wide shadows, point lights | **Medium** | Deck builds in CI from the slice on; per-scene performance budget; shadows tracked as a count per reach, only on-screen fish as entities; town updates once an hour; 60 fps is a gate requirement |
| 10 | Schedule slips past M27 | **Medium** | 15% contingency (~5 months of peak spend); funding by phase; written cut order; console port and Classic preset move first |
| 11 | Funding gap: recoup needs ~600k units | **Medium** | Tranches at M9 and M18 gates; 30–50% co-funding target before M9 (publisher, platform deal, tax credits); leaner fallback via cut list; shrink to a live crew if sales trail |
| 12 | Key-person dependency: Art Director's style and Narrative Lead's voice | **Medium** | Style bible and voice guide by M4; animators and contract writers trained on both; documented pipelines; overlap on critical content |
| 13 | Scope creep erodes "Deeper, Not Wider" | **Medium** | Producer runs change control; any new feature names the pillar it serves and the cut it displaces; no new resource families, crafting or skill trees |
| 14 | Spoilers spread; content cliff after the credits | **Medium** | Letters optional and separate from the finale; backlog keeps arriving after credits; first free drop at M30 |
| 15 | Async online backend: moderation and running costs | **Low** | Friend codes only, preset postcard phrases, filtered free text, kill switch; offline sister towns keep the core loop server-independent; cut item 5 ready |
| 16 | Debt as a theme distresses players carrying real debt | **Low** | No interest, no deadlines, no penalties, no villain; tone testing with players who carry real debt; optional content note |
| 17 | Evidence is one player's emulator run optimized for paying off the debt | **Medium** | Community research and structured playtests on WW pain points before M9; O1–O15 treated as hypotheses until confirmed |
| 18 | The slice's accelerated test clock flatters or distorts results (pacing, tide timing, how night feels) | **Medium** | 15× clock declared to every tester and reviewer, never ships; return behaviour, dawn and morning-mail checks judged only in the 3-day real-time build; gate metrics name their build |

---

## 9. Comparable games

| Game | Developer / platform / year | What the pitch takes from it |
| --- | --- | --- |
| **Animal Crossing: Wild World** | Nintendo, DS, 2005 | The evidence base (one emulator run, O1–O15). The product is anticipation of tomorrow: bigger house, night fish, morning mail, hourly music. Forgotten friction is not the product: 30-s Save-and-end, 15 unstacked slots, the closed-store day. WW marks paying off 3,559,800 with a small reward (a statue, as recalled [NEED SOURCE]) but no scene → Porchlight makes it the finale (the Relighting). Run has not reached loan 7; confirm and update the matrix then |
| **Animal Crossing: New Horizons** | Nintendo, Switch, 2020 | Already fixed several WW frictions (stacking, autosave, tool ring [NEED SOURCE]) → QoL fixes are table stakes, not a hook. Its time-travel debate is why the clock policy is "fast-forward, no scolding" and time skips are never sold |
| **Cozy Grove** | Spry Fox, 2021 | Closest comp: real-time, story released day by day. Rationing story per day risks "done for the day after 20 minutes" [NEED SOURCE] → days stay open-ended and the story is optional mail. Its platform/subscription deals suggest a co-funding route [NEED SOURCE] |
| **Stardew Valley** | ConcernedApe, 2016 | Community Center is the template for the Commons. Years of free updates built the long tail; console versions via partners [NEED SOURCE] → free seasonal drops; port through specialists |
| **Fields of Mistria** | NPC Studio, Early Access 2024 | Polished pixel art + clear nostalgic hook carried a small team to a big EA launch [NEED SOURCE] → lead marketing with the art. Porchlight still chooses 1.0 over Early Access (the Relighting shouldn't ship half-built; a 12-week closed beta gives the same tuning signal) |
| **Hokko Life** | Wonderscope, EA 2021, 1.0 2022 | Marketed openly as AC-style for PC; the direct comparison set expectations it struggled to meet [NEED SOURCE] → never name AC in store copy; sell own moments |
| **Dinkum** | James Bendon, EA 2022 | A tiny team gave the AC-like loop a regional identity (Australian outback) [NEED SOURCE] → a specific place beats a generic cozy village; the tidal harbor coast is that place |
| **Fae Farm** | Phoenix Labs, 2023 | Big 3D cozy scope at premium console price didn't guarantee a breakout; studio later downsized [NEED SOURCE] → small team, modest price, spend on depth not area |
| **Wylde Flowers** | Studio Drydock, 2022 | Story-led cozy game with a strong narrative voice; Apple Arcade first, then PC and Switch [NEED SOURCE] → writing differentiates but is the expensive part; hence the word cap and writing letters early |

---

## 10. Cut-first list

### 10.1 PROTECTED — never cut
- The real clock with no paid skips
- The seven-loan ladder and the payment ceremony
- The tide clock and its guarantees
- The "someone is always buying" rule of Porchlight Hours
- The morning letters and Hesper
- The save, inventory and tool friction fixes
- The Relighting
- 60 fps on Steam Deck

### 10.2 Cut order (first to last)

| Slot | Cut | Saves / consequence |
| --- | --- | --- |
| 1 | Classic preset moves to a post-launch patch | — |
| 1a | Pattern Sampler goes; Pell's fixed fabric stock covers it (PNG export goes with item 2) | — |
| 1b | Ambrose's music boxes go; stems play only in the world score | — |
| 1c | Drift lanterns go; their parcels arrive in Wednesday's sister-town post | — |
| 1d | Co-op Home Notes go; decorating carries no score | — |
| 1e | One profile per save at 1.0 (instead of 4) | — |
| 2 | Season Book export as PDF/image; keep the in-game view only | — |
| 3 | The optional Two-Screen layout on Deck and PC | — |
| 4 | Southern-hemisphere toggle moves to the Season 1 drop | — |
| 5 | Friend-code async parcels at 1.0; the 2 offline NPC sister towns stay | Backend + moderation work, ~3 engineer-months |
| 6 | Korean, then Brazilian Portuguese, move to post-launch | ~$70k |
| 7 | Furniture 300 → 220; clothing 180 → 130 | ~$40k outsourcing |
| 8 | Player species 6 → 4: keep water vole, red panda, ferret, opossum. River otter goes first (overlaps AC otters), then mongoose | ~3 animator-months |
| 9 | Neighbors 24 → 18 (6 families); lead life threads 13 → 9; templates fill gaps. Families flagged by the competitive check go first (their lead character moves to a surviving rig); if none flagged, stoat and tapir go | — |
| 10 | Fish and bugs 40 → 32 each; fossils 30 → 24; relics 20 → 15 | — |
| 11 | Commons projects ~10 → 7: keep both footbridges, the stepping stones, the lamps on the green and two house reopenings | — |
| 12 | Ambrose's carved furniture keeps only the provenance tag; no bespoke carved set (also removes music boxes) | — |
| 13 | Switch 2 port build moves from M28–M30 to Season 2 | Frees $160k inside this budget |
| 14 | Last resort on time: 1.0 slips up to 3 months into contingency (1.0 at M30) rather than cutting anything protected | — |

(Slots 1a–1e were inserted by the matrix rows with the instruction "cut right after item 1"; the source lists them by letter, so their relative order among themselves follows the letters.)

---

## 11. Appendix — Playtest observations O1–O15 (reproduced)

Logged during a live, no-time-travel Wild World run (NA Rev 1) whose goal is paying off all seven house loans. Sections cite them as O1–O15. The pitch treats them as hypotheses until playtests confirm them.

1. **O1.** The opening (taxi interview) silently decides your face and gender from cryptic multiple-choice answers; name and town entry use a touch keyboard where stray taps are easy.
2. **O2.** The part-time job is 8 sequential fetch quests (wear uniform, plant 3 saplings + 4 seed bags, meet every villager AND chat twice until one asks your birthday, deliver furniture, write and mail a letter, deliver carpet, deliver watering can, post on the bulletin board). It teaches everything but the 'chat twice' requirement is never stated clearly.
3. **O3.** Saving: the ONLY save is 'Save and end' (back to the title screen); 'Continue' in the bed prompt just cancels. Each save is ~30 s, and loading writes another save. Quitting without saving summons a scolding character.
4. **O4.** Inventory: 15 pocket slots, nothing stacks (14 oranges = 14 slots), bags of money take slots until you drag them onto the wallet, the wallet caps at 99,999, a full pocket triggers a 'Swap it / Drop it' prompt that freezes you, and fish cannot be dropped or released from the pocket menu at all.
5. **O5.** Tools: equipping means dragging the tool onto your portrait in the pocket screen; removing it is a separate portrait menu; pressing B while carrying an item in the menu drops it on the ground. Shaking a tree requires empty hands, so you constantly swap tools in a menu.
6. **O6.** Money loop: native fruit sells for 100, foreign fruit 500. A full harvest of ~30 fruit trees is ~9,000 but needs 6 round trips to the shop because of pocket limits. Shaking all ~100 hardwood trees daily yields a few 100-money bags and (rarely) bee nests that sting you if you are not holding a net.
7. **O7.** Debt ladder: 7 loans (19,800 -> 120k -> 298k -> 598k -> 728k -> 848k -> 948k, total 3,559,800). Each upgrade is built overnight, so the minimum is 7 real days; in practice money is the bottleneck (my first-day earnings were ~25k).
8. **O8.** The day after you trigger the store's upgrade, the store is closed all day for remodeling: you cannot sell anything, and since fish can't be dropped, the whole day's play is capped at 15 pocket slots. It felt like a dead day.
9. **O9.** Fishing: only 3 river + 3 sea fish shadows exist at a time, each respawning roughly every 2 minutes, and they only appear near the camera, so much of fishing is walking around looking. The bite window after the bobber dips is short (7-31 game frames); species is unknown until caught beyond shadow size. Night sea fishing was the best income (red snapper 3,000, barred knifejaw 5,000).
10. **O10.** Fossils need a shovel, then museum identification, then selling; the shovel was not in stock on day 1 (the store's daily stock is random), which delayed the money rock and fossils.
11. **O11.** Foreign fruit (the key to a lucrative orchard) arrives randomly via mail or villager letter replies; the community-known trick is to mail villagers deliberately low-quality letters with an item attached.
12. **O12.** Villagers: warm, funny one-liners and nicknames (one named me 'C-cat'), birthday invites by mail, but conversations repeat quickly and favors appear randomly; there is little sense of their lives beyond the current line.
13. **O13.** Camera/world: the 'rolling log' perspective hides the horizon and the beach geometry is ambiguous; rivers can only be crossed at bridges, so routes are long; the town map is a small stylized overview.
14. **O14.** Real-time clock: the anticipation (tomorrow the house will be bigger, shop hours, night fish) is the magic; but evenings after the shop closes (11 pm) offer little, and waiting is the main 'mechanic' between upgrades.
15. **O15.** Small delights: the house physically growing with a chosen roof color, the town hall clerk counting the payment, receiving mail each morning, the hourly music changing, autumn colors and a starry sky at night.

### 11.1 Observation → fix index

| Obs | Porchlight fixes |
| --- | --- |
| O1 | Lease-card creator with preview and undo; controller-first name entry (C23) |
| O2 | Any-order First Week Errands with written requirements; living map shows neighbors (C3, C30) |
| O3 | Autosave at doors; Rest < 1 s; no scold; Dimity (C24, R4) |
| O4 | 20–40-slot satchel, stacks, uncapped wallet, overflow basket, "Let it go" (C25) |
| O5 | Tool ring, tap-swap, auto-stow, Back never drops; lanterns use shake/net (C26, C12) |
| O6 | 120/480 prices, stacking, one-trip harvest, bee warning (K4, K5, C5) |
| O7 | 2,382,000◉ ladder with Ledger Board estimate, resident shares, commissions (C7) |
| O8 | Overnight shop expansions; cart if overrun; never a closed day (C6) |
| O9 | Shadows map-wide, silhouettes, learned tells, feints; map shows busy reaches (C8, C30) |
| O10 | Tools always stocked and in starter kit; Loupe; batch ID; Glint on the flats (C6, C10) |
| O11 | Visible letter tone; three visible foreign-fruit sources (K10, C4) |
| O12 | Line memory, Linger, life threads, request slate, consented nicknames (C18, C19, K9) |
| O13 | Flat camera with horizon; stepping stones and causeway; living map (R7, C14, C30) |
| O14 | Porchlight Hours; someone always buying; Day Page "Tomorrow:" (C15, C5, A5) |
| O15 | Kept and made physical: dawn build, THWAP payment, 6 am mail, hourly stems, autumn LUT, Skyband (K6, K10, K1, K3, C29) |

---

## 12. Appendix — Concept panel (in range; decisions that bind the design)

Three concepts were scored 1–10 by three judges (player experience / production & scope / publisher-market-legal):

| Concept | Player | Producer | Publisher & legal | Total |
| --- | --- | --- | --- | --- |
| PORCHLIGHT | 9 | 8 | 5 | 22 |
| Tally & Tide | 8 | 6.5 | 8 | 22.5 |
| TIDEMARK | 7 | 5 | 7 | 19 |

PORCHLIGHT was chosen as the chassis (two judges' first pick; scored well on both "would I boot this every morning" and "can about 12 people ship it"; low-risk 2D; layered so almost everything beyond the core loop can be cut). Grafted in:

- **From Tally & Tide:** the snail's thirty-year backlog of morning letters, tally-stick receipts, the dark lighthouse that relights with the last loan (replacing PORCHLIGHT's prism hunt), the tide clock, resident shares, the post-credits letter, its best characters.
- **From TIDEMARK:** the animal player, flat camera with a horizon band, shoals across the whole map with learned tells, furniture with provenance, the watchable dawn build, the clock policy and "Unhurried" seal, the Season Book, adaptive music stems, a measured slice gate with a written cut order.
- **Legal fixes applied:** musician concert and song items cut; AC numbers and gags changed; "money rock" gone; train/taxi arrival gone.
- **Production conditions met:** 24 neighbors and ~300 furniture at launch; stems instead of authored variants; normal maps only on characters and light-casting props.

**Contradictions resolved:**
1. Debt → mandatory seven-loan personal ladder owed to a builders' co-op, interest-free; house is the base of the lighthouse; neighbors pay shares; Commons projects run alongside without branching.
2. Calendar → real calendar; story paced by the player through loans and letters, not seasons.
3. Town naming → player names the town; letters fill it in.
4. Fruit economy → fixed prices with new numbers (120/480) plus Wanted Today; dynamic pricing rejected.
5. Avatar → animal.
6. Camera curvature → none.
7. Bite window → WW's tight band by default, scaled by species; Gentle as accessibility option with its own record board.
8. Mystery → optional and decoupled; finale tied to the last loan; letters continue after credits.
9. Night economy → one rule: someone is always buying.
10. Team size → twelve (core; 14 at peak in the production plan).

**Rejected outright:** the Grisholm corporate villain (reads as Stardew's Joja); sixteen branching town states; Chapterbook as default calendar; a fixed town name; dynamic pricing; debt as an optional mode; a full ecology simulation; couch co-op and live online at 1.0; the prism hunt; the toad concert and sheet-music rewards; the pangolin, axolotl, capybara and luna moth (all drafts converged on them; an axolotl is recalled as a WW special character [NEED SOURCE]); the duplicated names Lumen, Pim and Ottoline (one canonical cast, one species per role).

---

## 13. Appendix — IP safety rules (in range; constraints on any build)

1. **Do-not-use list** (see §5.13) — Producer owns it, version-controlled, checked at every content review.
2. **Clean-room briefs:** reference boards use natural-history field guides, real tidal harbors, lighthouse architecture, maritime ephemera; no AC screenshots in any brief; composer/sound briefs rule out sound-alikes.
3. **Contracts:** IP assignment + originality warranty for everyone; vendors deliver source files.
4. **Trademarks:** clearance on PORCHLIGHT and LAMPLIT COAST within 30 days of greenlight (US, EU, UK, JP, CN, KR; classes 9 and 41); filed before the Steam page at M11; "buttons" as a currency name checked by counsel.
5. **Counsel gates:** style bible (M4), slice footage (M9, before any reveal), Steam page and store copy (M11), every trailer and key art, release candidate (M25).
6. **Measured distance:** 50-person look-and-feel test at the slice gate; > 25% "copy" → art direction revisited before production. River otter out of the slice, first out under cut item 8.
7. **Marketing rule:** store/press copy never names Animal Crossing; at most "inspired by the handheld life-sim classics"; Wild World only in internal docs; no AC assets on official channels.
8. **Own IP:** copyright on key art and characters; E&O insurance before launch; PORCHLIGHT as umbrella mark.
9. **Candour:** mechanics (real-time clocks, loans, fishing) are believed less protected than names, characters and specific expression — for counsel to decide.
10. **Licensed-remaster hypothetical (not proposed):** the friction-fix list (autosave at doors, stacking, auto-stow, tool ring, fish release, a shop that never closes, readable errands, map-wide shadows, loan pace estimate) would carry over unchanged; the original-IP story would not; refused even under licence: a corporate villain, branching towns, optional debt, selling time skips.
