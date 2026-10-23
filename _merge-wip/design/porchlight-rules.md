# PORCHLIGHT — Gameplay Rules Spec (from pitch overview + "How it plays")

Reference doc extracted from the Porchlight pitch, lines 1–320 (sections 01 "The pitch", "The player fantasy", "How it plays", "Why it stands out", "Pillars", "What we kept from the other two concepts", "A note on rights"). Engineers and designers building from this doc are not expected to read the original. Names, numbers and rules are kept exact. Where the pitch marks a value "Proposed" or "[NEED SOURCE]", that tag is carried through. Values the pitch does not give are marked **(unspecified)**. Items the task asked for that live outside lines 1–320 are listed in §34 so they can be pulled from the companion extraction.

Observation tags **O1–O15** refer to the author's first-hand friction log from a no-time-travel Animal Crossing: Wild World (WW) run; they are kept because the pitch uses them as cross-references.

---

## 1. Identity sheet

| Field | Value |
|---|---|
| Title | PORCHLIGHT (working title) |
| Tagline | "A light goes on. Someone lives here now." |
| Genre | Real-time harbor-town life sim |
| Art | High-bit "field-guide" pixel art; flat camera, no rolling-log curvature |
| Platforms | PC and Steam Deck first; Switch 2 port built M28–M30, released M31–M33 (outside this budget); console cert costs [NEED SOURCE] |
| Price | $24.99 premium |
| Engine | Godot 4 |
| Team | 14 at peak, 12.5 average (production judge's trim note says "about 12") |
| Schedule | 27 months to 1.0 (about March 2029); free Summer content drop at M30 |
| Budget | $6.78M all-in including 15% contingency; gated phases starting with a $1.29M vertical slice |
| Gate | Nothing enters full production until a 45-minute vertical slice passes a measured playtest gate |
| IP | Original IP spiritual successor to the Wild World loop. No Nintendo names, terms, numbers or species-for-role pairings. Wild World is named only in internal design docs. Store copy says at most "inspired by the handheld life-sim classics." |
| Online at 1.0 | Asynchronous only (see §24) |
| Player character | An animal (species paper doll), not a human among animals |
| Excluded by design | No crafting tree, no combat, no stamina bar, no new genre layer, no new resource families, no skill trees, no failure state, no deadline |

### 1.1 Where the budget goes (the four spends)

1. Fix every friction point logged as O1–O15; these fixes are the minimum, not the selling point.
2. Add exactly one optional deeper layer to each system WW already has.
3. Add two axes WW never had: a real-time **tide** as a second clock, and a **night that is half the game** (Porchlight Hours).
4. Add a light, skippable story delivered through the morning mail.

---

## 2. Setting and premise

- **Place:** the Lamplit Coast. A harbor town reached on foot across a **tidal causeway**. On this coast a lit porch means "someone lives here and they're home."
- **State at arrival:** only four porches are burning: three neighbors and Pell's Sundries (the shop).
- **Arrival:** at dusk, on foot ("which nobody does anymore"); the sea creeps back over the causeway stones behind you.
- **Greeter:** Wren Hearthwright, a young beaver from **Hearthwright & Daughter Building Co-operative**, waits at the end of the causeway with a lantern and a **lease card**. The lease card is the character creator; every field on it is visible.
- **Your house:** the old **Keeper's Cottage**, the only house left on the point, at the foot of a **lighthouse that has been dark for thirty years**. Your porchlight comes on with the first loan.
- **Your debt:** a **12,000-button hearth loan with no interest**. Wren: "Pay it when you can. We build while you sleep."
- **The morning after:** Hesper Coil, a garden snail who has just reopened the post office on the night shift, delivers the first of a thirty-year backlog of undelivered letters. It is addressed *To the Keeper* and reads: **"The light is fine. It's the river that's wrong. —I."**
- **The arc:** seven loans grow the cottage overnight; lighthouse scaffolding climbs one section per loan; the seventh loan builds the **Lamp Room** and **relights the coast**.
- **Background fact the player can learn:** the creek has been empty for thirty years.

---

## 3. Cast referenced in this section

| Name | Species / role | What they do in the rules |
|---|---|---|
| Wren Hearthwright | Young beaver; Hearthwright & Daughter Building Co-operative | Greets you with lantern + lease card; gives cottage key and loan; abacus count at payment; builds overnight; waves from the ladder at dawn; her small talk on the lease card sets only your houseplant and the first morning's weather; building her first solo house |
| Ambrose Hearthwright | Beaver, Wren's father; half-blind; retired master builder | Gnaws notches into the tally stick, splits it with one THWAP of his tail; buys timber and carves furniture from it over two nights with a provenance tag; walks the finished Lamp Room with one hand on the wall |
| Hesper Coil | Garden snail; post office, night shift | Delivers exactly one thirty-year-old letter each morning; counter open 6 pm–2 am; town throws her a "Late Delivery" party |
| Juniper | Magpie; runs Pell's Sundries | Buys 8 am–10 pm; sells from a cart outside at full price if a shop expansion spills into the day; dives behind her counter when you have a bee halo; back room holds the town's pawned heirlooms |
| Ludo | Fruit bat; lamplighter | Buys anything at full price 10 pm–8 am; hosts the Saturday Lantern Market (rare night seedlings, lamps, moth-silk clothes) |
| Dimity | Rosy maple moth living in your porch lamp | Writes the Day Page in under a second at Rest; writes the "While you were away" page; binds the Season Book at each solstice/equinox |
| Barnaby | Hermit crab in a too-small diving helmet | Identifies fossils and relics in one batch; posts the weekly Archive Bounty (3 wanted specimens); moves into a ship's bell (life thread) |
| Augusta | (species unspecified) | Posts the daily forecast with honest odds on the Commons board; keeps the Commons projects board; reads the count of lit porches aloud at the Lantern Float |
| Tuck | (species unspecified) | Gives you a nickname; wants a sea bass for his race diet; runs the mud race on Mudlark Day |
| Tamsin | Badger; mudlark | Races you to the good low-tide spots; her family has an oyster boat |
| Ansel | Heron; harbormaster | Never catches anything and finally confesses (life thread) |
| Clem | (species unspecified) | Puts you in her murder mystery |
| Odile | (species unspecified); painter | Paints your porch for her "Twelve Lights" |
| Wick | Puffling (child) | Calls you "Keeper" from day one |
| Bramble | (species unspecified) | Charges double at the Sunday Porch Sale |
| Isolde | Storm petrel; the old lighthouse keeper | Author of the letters signed "—I." / "I. Petrel" |
| The Thatch | Weaver-finch crew working for Wren's co-op | Tie off your new roof at dawn in the colour you chose |

Launch cast size: **24 neighbors** (production judge's cut).

---

## 4. The player fantasy (five layers)

Used as the acceptance criteria for "does it feel right":

1. **Owning something real.** The house grew because you fished the evening tide; you chose this tier to be the loft, not the cellar; the tally wall reads as a diary (one split stick per payment); the chair by your fire has a tag in Ambrose's hand naming the tree it was carved from.
2. **Belonging.** Nicknames you can accept, decline or improve; neighbors fold you into their projects (Clem's mystery, Odile's painting); Wick calls you "Keeper"; Ambrose approves of the Lamp Room.
3. **Knowing the place.** Reading the water (terns diving over the quay; a forked-tail shadow means John Dory); checking the tide table on your door before planning the day; knowing the creek has been empty for thirty years before anyone tells you why.
4. **Anticipation.** You never put the game down without knowing what tomorrow holds, because you set it up yourself; an old letter is always waiting in the morning.
5. **Wild World the way you remember it.** The remembered version (sunset fishing, roof colour, first letter, stars) becomes the real one; the 30-second save, six shop trips per harvest and the boarded-up store do not come back. Purists get the **Classic preset** (§25).

---

## 5. MINUTE actions

Each action takes **1–3 s**, has its own sound, and shows a small **torn-paper notice**.

### 5.1 Shake

| Rule | Value |
|---|---|
| Trigger | Walk up to a tree and press the context button |
| Held tool | Put away automatically and re-equipped automatically afterward (O5) |
| Possible drops | Fruit; a button purse (goes **straight to the wallet**, never a pocket slot, O4); a shell dropped by gulls; a bee nest |
| Bee-tree warning | **One-second hum** plus gold specks drifting down, before the nest drops (O6) |
| Net offer | If the net is on the tool ring, the game offers it |
| Catch the nest | Yields **honeycomb, 350◉ (Proposed)** |
| Miss the nest | **Three cartoon bees orbit your head for one in-game hour**; neighbors lean away and comment; Juniper dives behind her counter. This "bee halo" replaces WW's swollen face |
| Tree count | About 100 trees in town (author shook all 103 of theirs in WW in one sitting); you name trees yourself; some trees reliably hide button purses, which the player learns |

### 5.2 Pick up and stack

| Rule | Value |
|---|---|
| Stacking | Fruit and shells stack to **10 per slot** |
| Basket tool | Carries **3 additional stacks** |
| Satchel full | Overflow drops into a **basket at your feet**; there is never a frozen Swap/Drop prompt (O4) |
| Harvest benchmark | A 30-tree harvest takes **one** shop trip, or **none** via the Consignment Crate (WW: six trips, O6) |

### 5.3 Fish (summary; full spec in §15)

- Shadows are simulated in **every** body of water, not just near the camera; count scales with the body's size: **4–8 per river reach, the pond, the quay and each sea zone**.
- Schools are visible from bridges.
- **6 shadow sizes** plus silhouettes: **dorsal fin, forked tail, eel ribbon, flat ray, silver school**. Shadows shimmer at dawn and dusk.
- After catching a species **3 times**, its **tell** (a glint or a way of moving) is shown for you everywhere.
- Bobber **feints 1–3 times**, then bites with a splash, a rumble and a "plip".
- Default bite window: **7–31 frames (about 0.12–0.52 s at 60 fps)**. Common fish at the generous end; night headliners at the tight end.
- **Gentle** timing: **0.6–0.9 s**, an accessibility option with its own record board.
- **Let it go** releases any fish (impossible in WW, O4) and nudges that reach's health up.
- Each reach has a **busy/quiet value** that dips when fished hard, recovers within **a day or two**, and has a **floor**: nothing is ever fished out and nobody lectures the player.

### 5.4 Dig

| Rule | Value |
|---|---|
| Fossil cracks | About **4 per day** appear on land |
| Low-tide glints | At low tide the flats show glints: town relics, cockles, villagers' buried time capsules |
| The daily Glint | **Exactly one per day**: a purse buried in the mud. This is the one-a-day windfall ritual (replaces WW's money rock, O10) |
| Identification | The **Loupe** in the starter kit names a find on the spot |

### 5.5 Talk

| Rule | Value |
|---|---|
| First tap | One line |
| Linger | A "Linger" prompt offers a second topic |
| Errand wording | The errand list tells you to linger in so many words (O2) |
| Line memory | Neighbors remember which lines they have said to you and will not repeat one for **about five days** (O12) |

### 5.6 Tool ring

| Rule | Value |
|---|---|
| Open | Hold the shoulder button: **8 brass sockets** |
| Quick swap | Tap the shoulder button: swaps between your **last two** tools |
| Cancel | Back cancels and **never drops anything** (O5) |
| Removed | Equipping by dragging a tool onto your portrait; Back dropping the held item |

---

## 6. DAY structure

A session is **30–90 real minutes, open-ended**. The clock is the real system clock (southern-hemisphere season toggle available, §11).

### 6.1 Daily schedule (anchors)

| Time | What happens |
|---|---|
| Before 6 am | If a build finished overnight, you can watch **the Thatch** (Wren's weaver-finch crew) tie off your new roof in the colour you chose; Wren waves from the ladder (O15, the overnight reveal made watchable) |
| 6 am | **Mailbox fills**: neighbors' letters, sister-town parcels, the co-op's build note ("The loft is up. Come see."), and **exactly one** old letter from Hesper's sack |
| 6 am (boards refresh) | **Ledger Board** by your gate: amount owed and Wren's pace estimate ("At this week's pace, about 6 days."). **Tide Table chalkboard** next to it: today's two low tides. **Commons board**: Augusta's forecast with odds ("7 in 10, showers by the afternoon tide"), fossil cracks spotted so far, birthdays, visitors, this week's life-thread beats |
| 8 am–10 pm | **Pell's Sundries** open (Juniper buys and sells). Juniper closes at 10 pm |
| 8 am–10 pm | Juniper is the buyer |
| Low tide (twice daily, drifting) | Flats, causeway, stepping stones across the river mouth, relic glints, race with Tamsin to the good spots |
| High tide | Shoals crowd the quay |
| 6 pm–2 am | Hesper's post-office counter open; **outgoing mail slot never closes** |
| 8 pm–2 am | **Porchlight Hours** |
| 8–11 pm | Neighbors sit out on their porches for **porch talk** (deeper conversation layer; carries life-thread beats) |
| 10 pm–8 am | **Ludo** buys anything at **full price** |
| Overnight | One house build, one Commons build, shop expansions, Ambrose's carving, Consignment Crate sale, sister-town parcel delivery |

**The one rule players must remember:** *someone is always buying* (Juniper 8 am–10 pm, Ludo 10 pm–8 am) (O14).

### 6.2 Pell's Sundries (the shop)

- Hours **8 am–10 pm**.
- **Every basic tool is always on the shelf**, and all of them are already in your starter kit, so nobody waits days for a shovel (O10).
- **Furniture and clothes rotate daily** (the daily stock lottery is kept, O10).
- **"Wanted Today" board**: 3 items that sell at **+50%**.
- **Consignment Crate** at your gate: sells anything overnight at **90%**.
- **Barnaby** identifies fossils and relics **in one batch**.
- **Ambrose** buys timber and carves furniture from it over **two nights**; the piece carries a tag naming the tree it came from.
- **Commons request board** lists favours openly ("Tuck wants a sea bass for his race diet"), replacing WW's random pop-up favours (O12).
- Shop expansions happen overnight; if one runs into the next day, Juniper sells from a cart outside at full price. A WW-style dead day (O8) cannot happen.

### 6.3 Porchlight Hours (8 pm–2 am)

- Neighbors on porches 8–11 pm; porch talk carries life-thread beats.
- Juniper closes at 10 pm; Ludo buys at full price 10 pm–8 am.
- Hesper's counter 6 pm–2 am.
- **Night sea fishing is the best income** (as in WW, O9): moonlit **John Dory 2,400◉**, lantern **wolffish 4,200◉** (both Proposed).
- On a **night low tide** the mud glows **cyan** (bioluminescent) and gives up **glowing relics**.
- Ambient content: fireflies, moths, meteor showers from the cliff, **string lights you hang yourself**.
- Saturday night: the Lantern Market (§10).

### 6.4 Ending a session

- **Rest** in bed, or **sit on your porch**.
- Dimity lands and writes the **Day Page in under a second**. Contents: buttons earned, loan paid, catches, who you talked to, then **"Tomorrow:"** with the threads you left open.
- **Autosave at every door.**
- You can **quit from pause at any moment**; **loading never writes a save**; nobody scolds you (O3).

### 6.5 Design rule for every day (Pillar 1)

Every day must leave **at least one thread open overnight that the player chose**. Examples: a room going up, a graft taking, a fossil on the cleaning bench, a parcel on its way to the sister town, a reply letter, a neighbor's next life-thread beat, tomorrow's old letter. Anti-rule: waiting is never the only thing to do.

---

## 7. Tide model (the second clock)

| Rule | Value |
|---|---|
| Lows per day | Two low tides per day |
| Spacing | About **12 h 25 min** between lows |
| Drift | Each low is about **50 minutes later** than the day before |
| Display | Tide Table chalkboard by your gate lists today's two lows; a tide table is also on your door |
| Low tide opens | The flats (relic glints, cockles, the daily Glint), the causeway, stepping stones across the river mouth (WW forced every crossing through a bridge, O13) |
| High tide brings | Shoals crowd the quay |
| Night low tide | Mud glows cyan; glowing relics |
| Music | A tide layer in the adaptive stems (§11) |

**Guarantees (hard rules):**

1. Any **12.5-hour waking window contains a low tide**.
2. The tide gives **shortcuts and bonuses but never locks anything**.
3. **Nothing is available on only one tide or only one day.**

Derived implementation note (not stated in the pitch, follows from its numbers): with lows every 745 min (12 h 25 min), `lowTide[n] = lowTide[0] + n × 745 min`; two lows per 24 h 50 min gives the stated ~50 min/day drift. High tide can be placed at the midpoint between successive lows.

---

## 8. WEEK schedule

| Day | Event |
|---|---|
| Monday | Life-thread beats advance for the neighbors you are involved with |
| Wednesday | **Sister-town parcel day**: you post a crate of your native fruit; the sister town's fruit arrives **the next morning** with a letter. One of the foreign-fruit sources (O11). At 1.0: two offline NPC sister towns plus friends' towns by friend code |
| Saturday (after dark) | **Lantern Market** on the green, hosted by Ludo: rare night seedlings, lamps, moth-silk clothes |
| Saturday | **Porch Supper**: a potluck on a different neighbor's porch each week (replaces WW's Saturday concert) |
| Sunday morning | **Porch Sale**: neighbors put old furniture out on blankets, priced by personality (Bramble charges double) |
| Weekly | **Barnaby's Archive Bounty**: 3 wanted specimens at a bonus, steering you toward what you have missed |
| Nightly | One house build and one Commons build per night, always overnight; Pell's Sundries expansions also overnight; Juniper's cart covers any spillover day |

---

## 9. SEASON structure

- Real calendar, with a **southern-hemisphere toggle**.
- **Music:** 24 hourly themes built as adaptive stems with layers for **season, weather, tide and night** (not 288 separately authored variants). Music still changes on the hour (O15).
- **Festivals (original):**

| Season | Festival | Content |
|---|---|---|
| Spring | **Mudlark Day** | A low-tide dig plus Tuck's mud race |
| Summer | **Firefly Regatta** | Lantern boats down the river |
| Autumn | **Lantern Float** | Paper lanterns from the point while Augusta reads the count of lit porches aloud |
| Winter (solstice) | **The Long Night** | You visit every lit porch; each gives a small gift |

- **Season Book:** at each solstice and equinox Dimity binds that season's Day Pages into an illustrated volume exportable as an **image or PDF**. Saves that never skipped time carry a cosmetic **"Unhurried" wax seal** on their Season Books.
- Seasonal content: autumn colours and starry night skies kept from WW (O15). More roster items arrive in free seasonal drops.

---

## 10. Long arc: THE HEARTH LADDER (Proposed; to be tuned in playtest)

### 10.1 Currency

- **Buttons (◉)**. No wallet cap (WW's 99,999 cap removed). Purses go straight to the wallet and never occupy a pocket slot.

### 10.2 The seven loans (all interest-free, from the co-op)

| # | Amount | What it builds | Notes |
|---|---|---|---|
| 1 | **12,000◉** | The bedsit | Your porchlight comes on with this payment. First Week Errands each knock buttons off this loan |
| 2 | **90,000◉** | The cottage | |
| 3 | **180,000◉** | Room commission 1 | Player chooses from the commission list |
| 4 | **300,000◉** | Room commission 2 | |
| 5 | **450,000◉** | Room commission 3 | |
| 6 | **600,000◉** | Room commission 4 | |
| 7 | **750,000◉** | **The Lamp Room** | Final payment **relights the lighthouse and the coast** ("the Relighting") |
| | **Total 2,382,000◉** | | A third less than WW's 3,559,800 (O7) |

Source phrasing, verbatim: "12,000 (the bedsit) → 90,000 (the cottage) → 180,000 → 300,000 → 450,000 → 600,000 (four room commissions) → 750,000 (the Lamp Room)". The four commissions are loans 3–6, consistent with "from loan 3 on, you choose what Wren builds ... You pick four."

### 10.3 Pacing targets

| Target | Value |
|---|---|
| Grinder | About **3 weeks** |
| 45 minutes a day | **8–12 weeks** |
| Hard floor | **7 nights** (each build takes one night) |
| Rationale for lower total | Removing friction should raise income per hour by an estimated **1.5–2×** [NEED SOURCE: playtest] |
| Reference | Author's first WW day earned about 25k |

### 10.4 Room commissions

- From **loan 3 on**, the player chooses what Wren builds.
- Options (6): **Porch & Loft**, **Cellar**, **Side Room**, **Greenhouse** (indoor fruit and the grafting bench), **Workshop** (fossil cleaning bench), **Gallery** (paintings and the tally wall).
- You pick **four**; the remaining **two can be built for buttons after the Relighting**.
- **Roof colour** is chosen at every tier (O15).
- Each tier moves the lighthouse scaffolding **one section higher**.

### 10.5 The payment ceremony

1. Wren counts on an abacus.
2. Ambrose gnaws the notches into a tally stick with his teeth.
3. Ambrose splits the stick with one **THWAP** of his tail.
4. Your half goes on your wall (the tally wall; one stick per payment, a diary of the year).

Tally sticks double as progress bars in the UI; wax seals are used as buttons in the UI.

### 10.6 Resident shares

- When you see a neighbor's **lead life thread** through, that neighbor brings Wren a tally stick worth **5% of your current loan**. Friendship is a second way to pay down the debt (O7).

### 10.7 The Commons

- Augusta's board lists **about 10 community projects**: two footbridges, stepping stones, lamps on the green, the Old Pier, and reopening the dark houses.
- Funded by a **Commons Jar** that you and the neighbors drop buttons into.
- The player chooses the **order**; **every project can eventually be built**; the town **never branches** into different versions.
- **One Commons build per night.**
- Each reopened house **lights a porch**, and a **new neighbor walks across the causeway the next evening at dusk**.

### 10.8 Debt tone rules

No interest, no deadlines, no penalties; tone testing with players who carry real debt; an optional content note. The debt is never optional and there is no corporate villain.

---

## 11. Economy table (every price and rate in this section)

| Item / rule | Value | Status |
|---|---|---|
| Native fruit | **120◉** | Fixed, no dynamic pricing |
| Foreign fruit | **480◉** | Fixed; 4× gap by design (WW was 100/500) |
| Ripe fruit | **+25%** (native 150◉, foreign 600◉, derived) | |
| Honeycomb (caught bee nest) | **350◉** | Proposed |
| John Dory (moonlit, night sea) | **2,400◉** | Proposed |
| Lantern wolffish (night sea) | **4,200◉** | Proposed |
| Consignment Crate | **90%** of value, paid overnight | |
| "Wanted Today" board | 3 items at **+50%** | Daily |
| Juniper (Pell's Sundries) | Buys at full price, **8 am–10 pm** | |
| Ludo (lamplighter) | Buys anything at **full price**, **10 pm–8 am** | |
| Juniper's cart (expansion spillover day) | Full price | |
| Porch Sale (Sunday) | Priced by personality; **Bramble charges double** | |
| Archive Bounty (weekly) | 3 specimens "at a bonus" | Amount unspecified |
| Resident share | **5% of current loan** per completed lead life thread | |
| First Week Errands | Each "knocks buttons off loan 1" | Amount unspecified |
| Ambrose timber purchase | Buys timber; carved piece returns in 2 nights | Price unspecified |
| Lantern Market goods | Rare night seedlings, lamps, moth-silk clothes | Prices unspecified |
| Commons Jar | Player + neighbors contribute buttons | Project costs unspecified |
| Post-Relighting extra rooms | The 2 unchosen commissions, "for buttons" | Price unspecified |
| Loan total | **2,382,000◉** | Proposed |
| Wallet cap | **None** | |

---

## 12. Inventory, tools, saving

### 12.1 Inventory (O4)

| Rule | Default | Classic preset |
|---|---|---|
| Pocket slots | **20**, expandable to **40** | **15** |
| Stacking | Fruit and shells stack to **10** | **Unstacked** |
| Basket tool | +3 stacks | (not stated) |
| Overflow | Basket at your feet, short notice | (not stated) |
| Purses | Straight to wallet, no cap | (not stated) |
| Fish release | Any fish can be released ("Let it go") | (not stated) |
| Consignment Crate | Available | **Not available** |

### 12.2 Tools

- Starter kit includes **every basic tool** (shovel, net, rod and the **Loupe** are named or implied; the Basket is a tool). Basic tools are always in stock at Pell's.
- Tool ring: 8 sockets, tap-to-swap last two, Back never drops (§5.6).
- Shake auto-stows and re-equips the held tool.
- Workshop commission adds a **fossil cleaning bench**; Greenhouse commission adds a **grafting bench**.

### 12.3 Saving (O3)

- Autosave at every door.
- Rest save (bed or porch) in under one second, with the Day Page recap.
- Quit from pause at any moment.
- Loading never writes a save.
- No scolding character; no 30-second "Save and end"; no extra save on load. These are never restored, even in Classic.

---

## 13. Fishing (consolidated spec)

| Element | Rule |
|---|---|
| Where shadows exist | Every body of water, whole map, regardless of camera |
| Shadow count | **4–8** per river reach, the pond, the quay, and each sea zone (scales with size) |
| Visibility | Schools visible from bridges; shadows shimmer at dawn and dusk |
| Shadow sizes | **6** |
| Silhouettes | **dorsal fin, forked tail, eel ribbon, flat ray, silver school** |
| Tells | After **3 catches** of a species, its tell (a glint or a way of moving) renders for that player everywhere; tells must **not rely on colour alone** |
| Bite sequence | Bobber feints **1–3** times, then bite: splash + rumble + "plip" |
| Default bite window | **7–31 frames** (~**0.12–0.52 s** at 60 fps); common species generous end, night headliners tight end |
| Gentle option | **0.6–0.9 s** window; separate record board |
| Classic preset | Tight bite timing on **every** species |
| Release | "Let it go" on any catch; nudges the reach's health up |
| Reach health | One **busy/quiet** value per reach; dips when fished hard; recovers in **a day or two**; has a **floor**; never fished out; no lecture |
| Best income | Night sea fishing (John Dory 2,400◉, lantern wolffish 4,200◉, Proposed) |
| High tide | Shoals crowd the quay |
| Roster | **40 fish** at launch |
| Learned reading | Terns diving over the quay; forked-tail shadow = John Dory |
| Favour example | Tuck wants a sea bass |

---

## 14. Bugs

- Roster: **40 bugs** at launch.
- **Bee nests**: a shake risk the net saves you from (kept from WW, O6), now with the one-second hum + gold-speck warning and the bee-halo gag (three bees for one in-game hour) instead of a swollen face. Catching the nest gives honeycomb (350◉, Proposed).
- Night ambience: **fireflies** and **moths** (Dimity is a rosy maple moth; moth-silk clothes at the Lantern Market; Firefly Regatta in summer).
- Net is a starter-kit tool and sits on the tool ring.
- Other bug mechanics (spawn tables, times, prices): **(unspecified in this section)**.

---

## 15. Foraging, fossils, relics, shore finds

| Category | Rule |
|---|---|
| Fossil cracks | About **4 per day** on land; cracks spotted so far are listed on the Commons board |
| Low-tide glints | Town relics, cockles, villagers' buried time capsules |
| Daily Glint | Exactly one buried purse per day in the mud (windfall ritual) |
| Night low-tide | Glowing relics in cyan bioluminescent mud |
| Identification | Loupe names a find on the spot; Barnaby identifies fossils and relics in one batch (no one-per-day limit) |
| Relic histories | Each relic has a history (deeper layer, O10) |
| Cleaning bench | In the Workshop commission; a fossil on the bench is a valid overnight "open thread" |
| Shells | Dropped by gulls from shaken trees; stack to 10 |
| Rosters | **30 fossils, 20 town relics, 20 shore finds** |
| Archive Bounty | Barnaby's weekly 3 wanted specimens at a bonus |
| Rule | Tools for digging are in the starter kit; no stock lottery for basic tools (O10) |

---

## 16. Orchard

| Rule | Value |
|---|---|
| Town trees | About **100**, named by the player |
| Native fruit | 120◉ |
| Foreign fruit | 480◉ (fixed 4× gap, no dynamic pricing) |
| Ripeness | Ripe fruit sells for **+25%** (deeper layer, O6) |
| Grafting | Grafting bench in the Greenhouse commission; a graft taking is an overnight thread (deeper layer, O11) |
| Indoor fruit | Greenhouse commission |
| Foreign-fruit sources (all visible in play, O11) | Sister-town parcels (Wednesday, arrives Thursday morning with a letter); friendship gifts; Lantern Market seedlings; plus grafting to propagate. The Wednesday bullet calls parcels "one of three foreign-fruit sources"; the O11 list names parcels, friendship gifts, Lantern Market seedlings and grafting |
| Letters | Letter **tone is visible**; good letters get good replies (replaces WW's opaque scoring where bad letters were the best way to get foreign fruit) |
| Timber | Trees can be sold to Ambrose as timber; the furniture he carves names where the tree stood |
| Harvest | 30-tree harvest in one trip (stacking + Basket) or none (Consignment Crate) |

---

## 17. Neighbors

### 17.1 Core rules (O12, Pillar 5)

| System | Rule |
|---|---|
| Count | 24 at launch; more arrive as dark houses are reopened via the Commons |
| Daily schedule | Every neighbor has one |
| Opinions | Each has opinions about the others |
| Memory | Each remembers what you gave them and said to them |
| Line memory | No line repeats for about **five days** |
| Talk | First tap = one line; "Linger" = second topic |
| Porch talk | 8–11 pm on their porches; deeper layer; carries life-thread beats |
| Life threads | One per neighbor, lasting **several weeks**; advances **only if you are involved**; beats land on **Mondays** and are previewed on the Commons board ("this week's life-thread beats"); completing a **lead** thread yields a resident share (5% of current loan) |
| Wants | Pinned to their **doors** and to the **Commons request board** (replace random pop-up favours) |
| Nicknames | A neighbor gives you one; you can **accept, decline, or suggest another**; nicknames and catchphrases are kept from WW |
| Letters | Neighbors write letters (stationery, handwriting); birthday invitations arrive by mail |
| Moving in | A reopened house lights a porch; the new neighbor walks across the causeway at dusk the next evening |
| Moving out | **(unspecified in this section)** |
| Absence | Neighbors say they missed you; no weeds, no guilt |
| Bee halo reaction | Neighbors lean away and comment |

### 17.2 Example life threads named in this section

- Hesper: the town throws her a "Late Delivery" party.
- Barnaby: moves out of a too-small diving helmet into a ship's bell.
- Ansel: the harbormaster who never catches anything finally confesses.
- Tamsin: her family's oyster boat.
- Juniper: her back room of pawned heirlooms.
- Clem: a murder mystery she writes you into.
- Odile: the "Twelve Lights" paintings (your porch is one).
- Tuck: his race (mud race / race diet).
- Wick: calls you "Keeper" before you have earned it.

### 17.3 First Week Errands (O2)

- A clipboard replaces WW's eight sequential fetch quests.
- **Any order; visible counters.**
- Requirements are stated in full, e.g. "chat until they ask your birthday, usually twice."
- Each errand knocks buttons off loan 1.
- Tutorial chores still teach every system.

---

## 18. Weather and forecast

- Augusta posts a daily forecast on the Commons board with **honest odds** (example: "7 in 10, showers by the afternoon tide"); forecasts **sometimes turn out wrong**.
- Wren's lease-card small talk sets **only** your houseplant and the **first morning's weather**, and she tells you so.
- Weather is a layer in the adaptive music stems.
- Meteor showers are visible from the cliff at night.
- Rain/wind effects on fishing or bugs: **(unspecified in this section)**.

---

## 19. Customization

### 19.1 The lease card (character creator, O1)

- Presented by Wren at the end of the causeway at dusk; replaces WW's taxi quiz.
- **Every field visible and editable.**
- Fields: **species, fur, markings, outfit**, kept **separate from pronouns**.
- **Name entry is controller-first**, with a **confirm step** and **protection against stray backspaces**.
- Only side effects of Wren's small talk: your houseplant and the first morning's weather.
- Species are chosen to stay clear of AC's best-known villager species; a full species and name check against AC's villager list is part of the IP plan. **The species list itself is not in lines 1–320** (see §34).

### 19.2 House and town customization

- Roof colour at every loan tier (chosen before the build; visible at the dawn tie-off).
- Room commissions (4 of 6) from loan 3.
- Furniture: about **300** items at launch; daily rotating stock; Porch Sale finds; Ambrose's provenance furniture; Lantern Market lamps.
- Clothes: daily rotating stock; moth-silk clothes at the Lantern Market.
- String lights you hang yourself.
- Trees are named by the player.
- Tally wall (Gallery commission) and paintings.

---

## 20. Archive counts (launch rosters, Proposed, trimmed at the production judge's request)

| Collection | Count |
|---|---|
| Fish | 40 |
| Bugs | 40 |
| Fossils | 30 |
| Town relics | 20 |
| Shore finds | 20 |
| Furniture | about 300 |
| Neighbors | 24 |
| Old letters (Hesper's backlog) | about 120 |
| Trees in town | about 100 |
| Commons projects | about 10 |
| Hourly music themes | 24 (adaptive stems) |
| Room commission options | 6 (pick 4) |
| Tool ring sockets | 8 |

More rosters arrive in free seasonal drops (first free drop: Summer, M30). Barnaby runs the Archive (museum equivalent) and the weekly Archive Bounty.

---

## 21. Accessibility, readability and art rules

- **Gentle** bite timing (0.6–0.9 s) with its own record board.
- Tells **do not rely on colour alone**.
- **No pure black or white** in the palette; time of day expressed through **palette LUTs**.
- **UI on a separate hi-res layer** from the pixel art.
- Normal maps only on characters and light-casting props.
- Controller-first name entry with confirm and backspace protection.
- Each system keeps a surface a **9-year-old can use**, plus one optional deeper layer (Pillar 8).
- Optional **content note** on the debt theme; tone-tested with players who carry real debt.
- Camera is flat; true horizon at the shore; the "Skyband" horizon band with live sky; the dark lighthouse is always visible as a landmark; an illustrated map with pins.
- Classic preset for purists (§25).

---

## 22. Clock policy and absence

| Situation | Behaviour |
|---|---|
| Real-time clock | Sacred: no time skip, no paid speed-ups, no in-game "sleep until tomorrow" |
| Away for a week | Town catches up in a **simplified simulation**; Dimity's **"While you were away"** page explains what happened; no weeds-and-guilt penalty; neighbors say they missed you |
| System clock changed | **Neither punished nor supported**; the town simply fast-forwards |
| Cap 1 | **One old letter per in-game morning** (holds even after clock skips) |
| Cap 2 | **One house build per night** (plus one Commons build per night) |
| Reward for never skipping | Cosmetic **"Unhurried" wax seal** on the Season Books |
| Hard floor | 7 nights to clear the ladder regardless of money, because each build takes one night |

---

## 23. Online at 1.0

- **Asynchronous only.**
- Exchange **parcels and postcards** with friends' towns by **friend code**.
- **Two offline NPC sister towns** guarantee foreign-fruit trade never depends on a server.
- Live visiting and couch co-op are post-launch "Expand" ideas, not promises; marketing will say so.

---

## 24. Classic preset

| Setting | Classic value |
|---|---|
| Pockets | 15, unstacked |
| Consignment Crate | None |
| Bite timing | Tight window on every species |
| Never restored | 30-second save; scolding character |

---

## 25. Story: the morning serial

- Hesper Coil delivers **exactly one** undelivered thirty-year-old letter each morning at 6 am; capped at one per in-game morning even after clock skips.
- **About 120 letters** tell the town's history and a gentle mystery about **why the lighthouse went dark**.
- Reading them is **optional**; they **never gate tools, shops or house upgrades**.
- First letter, *To the Keeper*: "The light is fine. It's the river that's wrong. —I."
- The letters are from **Isolde**, the storm-petrel keeper.
- The lighthouse stays dark on every horizon until the seventh loan relights it (this replaces an earlier concept's seven-prism hunt).
- **Post-credits letter**, postmarked last week: **"I saw the light. —I. Petrel."** It keeps the game going past its ending.
- Other arcs delivered through play: Hesper's "Late Delivery" party; Barnaby's move into a ship's bell; Ansel's confession; Tamsin's oyster boat; Juniper's pawned heirlooms.

---

## 26. Progression and late game

1. **Day 1 → loan 1 (12,000◉):** bedsit, porchlight comes on. First Week Errands knock buttons off this loan.
2. **Loan 2 (90,000◉):** the cottage.
3. **Loans 3–6 (180k / 300k / 450k / 600k):** four room commissions of the player's choice; roof colour each tier; scaffolding climbs each tier.
4. **Loan 7 (750,000◉):** the Lamp Room; the Relighting. Ambrose walks the Lamp Room by hand.
5. **After the Relighting:** the two unchosen commissions can be bought for buttons; the Commons projects continue (about 10, in player-chosen order, one per night, all eventually buildable); reopened houses bring new neighbors; the post-credits letter arrives; festivals and Season Books continue on the real calendar; free seasonal drops add roster items.
6. **Parallel tracks throughout:** life threads (several weeks each, Monday beats) feeding resident shares; Archive completion (Bounty steering); orchard (foreign fruit, grafting, ripeness); tide-locked-nothing exploration (causeway, flats, stepping stones).

Pacing: ~3 weeks (grinder) / 8–12 weeks (45 min a day) / 7-night hard floor.

---

## 27. Day 1 script (as given in this section)

The full scripted Day 1 and Day 40 walkthroughs are **not within lines 1–320** (see §34). The beats this section fixes:

1. Dusk. You arrive on foot and cross the tidal causeway while the sea creeps back over the stones behind you.
2. Across the harbor four porches are lit: three neighbors and Pell's Sundries.
3. Wren Hearthwright waits at the causeway's end with a lantern and the lease card. You fill in the lease card (species, fur, markings, outfit, pronouns, name). Her small talk sets your houseplant and tomorrow's weather.
4. Wren gives you the key to the Keeper's Cottage and the 12,000-button hearth loan: "Pay it when you can. We build while you sleep."
5. (Overnight: co-op builds while you sleep; Porchlight Hours are available if you stay up.)
6. Next morning, 6 am: Hesper Coil slides a yellowed envelope out of her shell: *To the Keeper* — "The light is fine. It's the river that's wrong. —I." The Ledger Board, Tide Table and Commons board are at your gate; the First Week Errands clipboard begins.
7. Wick calls you "Keeper" from the day you arrive.

---

## 28. Pillars 1–8

### Pillar 1 — Tomorrow Is the Reward
- The real-time clock is sacred: no time skip, no paid speed-ups, no in-game "sleep until tomorrow" (O14, O15).
- Rule: every day leaves at least one player-chosen thread open overnight (room going up, graft taking, fossil on the bench, parcel in transit, reply letter, neighbor's next beat, tomorrow's old letter).
- Anti-rule: waiting is never the only thing to do (WW's gap between upgrades was mostly waiting; little to do after 11 pm).
- Dimity's Day Page ends every session with "Tomorrow:" and the open threads.

### Pillar 2 — Hands That Do What You Mean
- If one action needs a menu twice, that is a bug.
- Shake auto-stows/re-equips the tool (O5); 8-socket ring with tap-to-swap (O5); Back never drops (O5).
- Fruit and shells stack to 10; purses go to an uncapped wallet; full satchel spills into a basket at your feet with a short notice, never a Swap/Drop freeze (O4); any fish can be released (O4).
- Autosave at every door; Rest save under one second; quit any moment; loading never writes a save (O3).
- All of this is the minimum, not the selling point.

### Pillar 3 — Every Payment Lights Something
- Seven loans, overnight builds, roof colour at every tier, a counting ceremony when you pay (O7, O15).
- You owe a builders' co-op (Wren is building her first solo house), not a landlord or shopkeeper.
- Payments are physical: abacus count, gnawed notches, THWAP, your half on the wall.
- Porchlight on with loan 1; Lamp Room last. From loan 3 you choose each tier's addition.
- Resident shares: friendship pays down the debt alongside money (O7).
- Ledger Board shows a pace-based completion estimate.

### Pillar 4 — Two Clocks: Sun and Tide
- WW's day/night, real seasons, hourly music kept (O14, O15).
- Real-time tide: two lows a day, ~12 h 25 min apart, each ~50 min later than the day before.
- Low tide opens flats (relic glints, cockles, the daily Glint), causeway, stepping stones across the river mouth (O13). High tide brings shoals to the quay.
- Guarantees: a low tide in any 12.5-hour waking window; tide gives shortcuts and bonuses but never locks anything; nothing is available on only one tide or one day.

### Pillar 5 — Neighbors With Lives
- Every neighbor: daily schedule, opinions about the others, memory of what you gave and said.
- Line memory: no repeat for about five days. "Linger" opens a second topic; porch talk at night.
- Life thread of several weeks per neighbor, advancing only if you are involved.
- Wants pinned to doors and the Commons request board (replace random favours).
- Nicknames: accept, decline, or suggest another.

### Pillar 6 — The Night Is Half the Game (Porchlight Hours)
- After dark the town changes instead of closing (O14).
- One rule: someone is always buying (Juniper 8 am–10 pm; Ludo 10 pm–8 am).
- Porches 8–11 pm with porch talk carrying life-thread beats.
- Night sea fishing is the best income (O9). Night low tide: glowing mud.
- Fireflies, moths, meteor showers, string lights; Saturday night Lantern Market.

### Pillar 7 — Nothing Hidden, Nothing Punished
- Readable: visible/editable lease card (O1); errand list states every requirement, any order, counters (O2); ledger shows completion estimate (O7); every foreign-fruit source visible in play (O11); basic tools always in stock (O10); real horizon and a real map (O13).
- Not punitive: catch-up note instead of weeds and guilt; clock changes just fast-forward, no exploit and no scolding; scolding save character gone (O3); no failure state, no deadline.

### Pillar 8 — Deeper, Not Wider
- Town stays WW-sized: ~100 trees and a few dozen points of interest; you learn which trees hide purses.
- Growth is depth, not area. Each WW system keeps a 9-year-old-usable surface and gains one optional deeper layer: fishing (silhouettes, tells, reach health, O9); orchard (grafting, ripeness, O6/O11); fossils (relic histories, cleaning bench, O10); letters (visible tone, O11); house (commissions, O7); night (Porchlight Hours, O14).
- No new resource families, crafting recipes or skill trees.

---

## 29. KEEP / CHANGE / REMOVE versus Wild World

### 29.1 KEEP (the soul)

| Kept | Notes | Obs. |
|---|---|---|
| Real-time clock, real seasons, shop hours, overnight builds, no time skip | | O7, O14 |
| Seven-loan house ladder, roof colour at every tier, counting ceremony on payment | Ceremony = abacus count, gnawed notches, THWAP, tally half on the wall | O7, O15 |
| Morning mail, handwritten letters on stationery, birthday invitations by mail | | O12, O15 |
| Hourly music, autumn colours, starry night skies | Music now adaptive stems | O15 |
| Nicknames and catchphrases | | O12 |
| Fixed, predictable orchard economy with a big native/foreign gap | New numbers 120 / 480 | O6 |
| Night sea fishing as best income; tight bite reflex by default | | O9 |
| Bee nests as a risk the net saves you from | Now with warning and bee-halo gag | O6 |
| One daily windfall ritual (now the low-tide Glint) and daily fossil cracks | | O10 |
| A town of about 100 trees you name yourself | | O6 |
| Tutorial chores that teach every system | | O2 |
| Random daily stock of furniture and clothes | | O10 |

### 29.2 CHANGE (same idea, without the friction)

| Obs. | System | Change |
|---|---|---|
| O1 | Opening | Taxi quiz → dusk arrival over the causeway + lease card; species/fur/markings/outfit separate from pronouns; controller-first name entry with confirm and backspace protection; Wren's small talk sets only houseplant and first morning's weather, and says so |
| O2 | Errands | Eight sequential fetch quests → First Week Errands clipboard: any order, visible counters, "chat until they ask your birthday, usually twice" written down; each errand knocks buttons off loan 1 |
| O3 | Saving | Autosave at every door; Rest save under a second with Day Page; quit any moment; loading never writes a save |
| O4 | Pockets | 20 slots expandable to 40; fruit and shells stack to 10; purses straight to an uncapped wallet; overflow basket at your feet; fish can be released |
| O5 | Tools | 8-socket ring with tap-to-swap; tools auto-stowed on shake; Back never drops |
| O6 | Selling | Consignment Crate (90% overnight); Basket tool; "Wanted Today" at +50%; a night buyer; 30-tree harvest in one trip |
| O7 | Debt | Interest-free loan from a builders' co-op; room commissions; Ledger Board with pace estimate; resident shares; a real reward for the final payoff |
| O8 | Remodels | Overnight; Juniper's cart covers any spillover day |
| O9 | Fishing | Shadows across the whole map, 4–8 per body; schools visible from bridges; silhouettes; learned tells; feint bites; reach health; Gentle option |
| O10 | Fossils | Tools in the starter kit; identification in one batch; relic histories; cleaning bench |
| O11 | Foreign fruit | Sister-town parcels, friendship gifts, Lantern Market seedlings, grafting; letter tone visible; good letters get good replies |
| O12 | Villagers | Schedules, line memory, porch talk, life threads, wants pinned to doors, nicknames you can decline or rewrite |
| O13 | World | No curvature; the Skyband; true horizon at the shore; causeway and stepping stones at low tide; footbridges as Commons projects; illustrated map with pins |
| O14 | Evenings | Porchlight Hours |
| O15 | Small delights | Overnight build watchable at dawn; expanded payment ceremony |

### 29.3 REMOVE (no nostalgia exceptions)

| Removed | Obs. |
|---|---|
| The scolding character and the guilt that came with it | O3 |
| "Save and end" as the only save; 30-second saves; the extra save on load | O3 |
| The 99,999 wallet cap; money bags taking pocket slots | O4 |
| Items that don't stack; the Swap/Drop freeze; fish that can't be released | O4 |
| Equipping by dragging a tool onto your portrait; Back dropping what you hold | O5 |
| Face and gender decided by a hidden quiz | O1 |
| The unstated "chat twice" requirement | O2 |
| The day the store is closed | O8 |
| Random daily stock deciding whether basic tools are available | O10 |
| Opaque letter scoring that made deliberately bad letters the best way to get foreign fruit | O11 |
| Fish shadows that only spawn near the camera | O9 |
| The rolling-log curvature | O13 |
| Penalties for being away | — |

---

## 30. What was kept from the other two concepts

### 30.1 From Tally & Tide

| Kept | Spec |
|---|---|
| The morning serial | Hesper Coil, night-shift garden snail, reopens the post office; exactly one undelivered thirty-year-old letter per morning; capped at one per in-game morning even after clock skips; about 120 letters; optional; never gate tools, shops or upgrades |
| Tally-stick receipts | Each payment notched and split; you keep one half; halves hang on your wall as a diary of the year; tally sticks are the progress bars; wax seals are the buttons; merged with Wren's abacus count and Ambrose's gnaw + THWAP |
| The dark lighthouse | Dark on every horizon; relights as the payoff for the final loan (replaces Concept 0's seven-prism hunt); your house is the Keeper's Cottage at its foot; scaffolding climbs one section per house tier |
| Real-time tide | Two lows a day ~12 h 25 min apart, drifting ~50 min later each day; low opens flats, causeway, stepping stones; high brings shoals to the quay; a low guaranteed in every 12.5-hour window; nothing exclusive to one tide |
| Glowing mud | Night low tide: bioluminescent mud gives up glowing relics |
| Resident shares | Completing a lead life thread makes that neighbor pay 5% of your current loan |
| Post-credits letter | Postmarked last week: "I saw the light. —I. Petrel." |
| Cast and arcs | Hesper (Late Delivery party); Barnaby the hermit crab in a too-small diving helmet who moves into a ship's bell; Ansel the heron harbormaster who never catches anything and confesses; Tamsin the badger mudlark and her family's oyster boat; Juniper the magpie with the pawned-heirloom back room; the kid who calls you "Keeper" (now Wick, a puffling; the draft had an axolotl); Isolde the storm-petrel keeper |
| Care with debt | No interest, no deadlines, no penalties; tone testing with players who carry real debt; optional content note |

### 30.2 From TIDEMARK

| Kept | Spec |
|---|---|
| Animal player | Species paper doll; editable creator; pronouns separate (biggest trade-dress win) |
| World shape | Rolling-log curvature removed; horizon band with live sky; dark lighthouse always visible as a landmark |
| Fishing (light version) | Shoals across the whole map; schools visible from bridges; species tells after 3 catches; releasing a fish helps that reach; one busy/quiet value per reach with a floor instead of a full population sim |
| Provenance furniture | Ambrose carves by feel from timber you sell him; tag names where the tree stood |
| Dawn build | The Thatch (weaver-finch crew) now works for Wren's co-op; ties off your roof in the chosen colour |
| Clock-change policy | Clock change fast-forwards the town; absence brings a "While you were away" recap; never-skipped saves get a cosmetic "Unhurried" wax seal |
| Season Book | Each solstice/equinox binds the season's Day Pages into an illustrated shareable volume |
| Adaptive music | Season, weather, tide and night layers over 24 hourly themes (not 288 variants) |
| Wants and forecasts | Wants pinned to neighbors' doors; Augusta's forecasts with honest odds that sometimes turn out wrong |
| Offline sister towns | Two NPC sister towns so trade and parcels never depend on a server; online at 1.0 asynchronous only |
| Production discipline | Measurable vertical-slice gate; written cut order; readability art rules (time of day via palette LUTs, no pure black or white, UI on a separate hi-res layer, tells not reliant on colour alone); candour about one player's evidence |

### 30.3 From the judges

- Night economy simplified to one rule: someone is always buying (Juniper 8 am–10 pm, Ludo 10 pm–8 am).
- AC numbers and gags replaced: fruit 120/480 (not 100/500); night headliners John Dory and lantern wolffish (not snapper and knifejaw); bee halo (not swollen face); low-tide Glint (not the money rock); Saturday musician and his song items cut; Porch Supper replaces the concert; train/taxi arrival gone.
- Production judge: launch content cut to 24 neighbors, about 300 furniture items, 40 fish, 40 bugs, 30 fossils; normal maps only on characters and light-casting props; team of about 12.
- Player-feel judge: the seven-prism hunt replaced by the relighting payoff.

---

## 31. Market comparison (one line each, as the pitch frames positioning)

| Comparable | Difference |
|---|---|
| Cozy Grove | Closest: real-time, story day by day; but it rations story and ties progress to it. Porchlight's days are open-ended, story is optional mail, the house ladder holds the game together |
| Stardew Valley | Farming, energy bar, combat, compressed calendar; its Community Center is the closest relative of the Commons. Porchlight: real clock, no stamina, no combat, home-centred |
| Wylde Flowers | Story-led, compressed calendar |
| Animal Crossing: New Horizons | Category leader; 3D, terraforming, crafting; already fixed several WW frictions (fruit stacking, autosave, tool ring) [NEED SOURCE: verify feature list]; hence friction fixes are the minimum |
| Fae Farm, Hokko Life, Dinkum | 3D, crafting-built; Porchlight has no crafting tree |
| One sentence | A hand-sized harbor town on the real clock where every payment lights something, the tide is a second clock, the night is half the game, and the morning mail brings a thirty-year-old mystery |

---

## 32. Naming and rights constraints that affect implementation

- Use only original names, species, currency (**buttons**), terms, numbers and UI motifs. No AC villager species for cast roles; a species-for-role check is required.
- Trademark searches pending on **"Porchlight"**, **"Lamplit Coast"** and **"buttons"** as a currency name [NEED SOURCE]; counsel review of character style, UI and marketing copy [NEED SOURCE: counsel].
- Look is deliberately moved: animal player, flat camera, field-guide pixel proportions, ledger-and-tally UI.
- Under a hypothetical licensed remaster, only the O1–O15 friction fixes would carry over; Porchlight's story, cast, tide and numbers would stay with Porchlight. Even then: no corporate villain, no town branching, debt never optional.

---

## 33. Open values flagged in the source

| Item | Tag |
|---|---|
| Honeycomb 350◉; John Dory 2,400◉; wolffish 4,200◉; loan amounts; rosters | Proposed |
| Income-per-hour uplift 1.5–2× | [NEED SOURCE: playtest] |
| Platform and certification costs | [NEED SOURCE] |
| ACNH feature list | [NEED SOURCE: verify feature list] |
| Trademark searches; counsel review; species-for-role check | [NEED SOURCE] |
| 27-month schedule | Uncosted estimate, not a quote |
| Hearth Ladder overall | To be tuned in playtest |

---

## 34. Requested topics NOT present in lines 1–320 (pull from the companion extraction of the Gameplay/Appendix sections)

- The full **Day 1** and **Day 40** minute-by-minute scripts (only the Day 1 beats in §27 are in this range).
- The **lease card species list**.
- Per-species **bug** rules (spawn times, prices) beyond bee nests, fireflies, moths and the 40-bug roster count.
- Detailed **weather** effects on spawns.
- Neighbor **move-out** rules and exact **routine** tables.
- Exact Commons project costs, Archive Bounty bonus percentages, errand reward amounts, Lantern Market prices, Ambrose's timber prices.
- Fish-by-fish size/silhouette/tell tables and the 6 size classes' names.
- Pocket expansion method (20 → 40).
- Expanded accessibility options beyond Gentle timing, colour-independent tells, controller-first text entry and the Classic preset.
