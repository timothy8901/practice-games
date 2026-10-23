# PORCHLIGHT — Gameplay Rules Spec

Reference extraction of the **Gameplay** chapter of the Porchlight pitch (source lines 543–740). This document is intended to be built from directly; readers are not expected to consult the original pitch. Names, numbers and rules are preserved exactly. Every number in the source is flagged **Proposed** (to be tuned in playtest). Items the source marks `[NEED SOURCE]` or "Open decision" are collected in §22.

Notation used throughout:

- `◉` = buttons, the in-game currency.
- "WW" = Wild World, the reference game the pitch benchmarks against. "O-numbers" (O1–O15) reference the pitch's fifteen playtest observations of WW; they are preserved here as traceability tags only.
- **Derived** = a value computed by this doc from source numbers, not stated in the source. Treat as a consistency check, not canon.

---

## 1. Design Frame and Global Constraints

| Rule | Statement |
| --- | --- |
| Skeleton | Keep WW's skeleton, rebuild its joints. |
| Two-layer rule | Every system has (a) a surface a nine-year-old can use on day one and (b) exactly one optional deeper layer. |
| No crafting | No crafting resources, no recipes, no skill trees. |
| One new sellable | **Timber** is the only new sellable. It comes **only** from storm branches and old stumps. Nobody fells a tree. |
| Tree count | The town has roughly **100 trees** (purse trees included); they stay where players learned them. |
| Tuning status | Every number is Proposed and gets tuned in playtest. |
| Menu rule | "If one action needs a menu twice, that's a bug." |
| Clock | Real clock. No time travel. Real-calendar seasons (with southern-hemisphere toggle). |
| Pricing | Fixed prices, no dynamic pricing, no wallet cap. |
| Tide guarantee | Tide gives shortcuts and bonuses but never locks anything. |
| Overnight rule | Every house, shop and Commons build happens overnight; no dead days. |
| Open-thread rule | Every session leaves at least one thread open overnight that the player chose. |
| Story gating | Exactly one story-gated scene: the Relighting (after loan 7). |

---

## 2. The Minute (Core Verbs)

### 2.1 Shake

- Trigger: press the **context button** at a tree.
- A held tool is **stowed automatically** and **handed back automatically** afterward (no menu).
- Possible drops from a shake:
  - Fruit
  - A **button purse** → goes **straight to the wallet** (never takes an inventory slot)
  - A **gull-dropped shell**
  - A **bee nest**

#### Bee trees

| Step | Rule |
| --- | --- |
| Warning | A bee tree warns with a **one-second hum** and **gold specks drifting down** before the nest drops. |
| Offer | If the **net** is on the tool ring, the game **offers it**. |
| Success | A caught nest gives **honeycomb**, worth **350◉**. |
| Failure | Miss, and **three cartoon bees orbit your head for one hour** (real time). |

### 2.2 Pick up

- Fruit and shells **stack to 10**.
- A full satchel **spills into a basket at your feet** (nothing is lost).

### 2.3 Talk

- First tap gives one line.
- A **Linger** prompt opens a second topic.

### 2.4 Swap (tools)

| Input | Result |
| --- | --- |
| Hold shoulder button | Opens an **8-socket tool ring** |
| Tap shoulder button | Swaps your **last two tools** |
| Back | Cancels; **never drops anything** |

WW contrast (O5, O6): WW required unequip via portrait menu, re-dragging tools, B-in-menu dropped items, bee nests stung without warning. All of those are explicitly fixed by the above.

---

## 3. The Day and the Tide

### 3.1 Fixed daily anchors

| Time | What happens |
| --- | --- |
| Before 6:00 am | Early risers can watch **the Thatch** tie off a new roof in the colour they chose (roof built overnight becomes visible). |
| 6:00 am | **Mailbox** fills: neighbors' letters, sister-town parcels, the co-op's build note, and **exactly one** old letter from Hesper's sack. By the gate: the **Ledger Board** (what you owe + Wren's pace estimate) and the **Tide Table**. |
| 8:00 am – 10:00 pm | **Pell's Sundries** open: basic tools always on the shelf; furniture and clothes rotating daily; a **Wanted Today** board. |
| 8:00 pm – 2:00 am | **Porchlight Hours**. Within these: porch talk 8–11 pm; Ludo buying 10 pm–8 am; Hesper's counter open from 6 pm; night sea fishing; glowing mud on a night low tide. |
| Ending | Rest in bed **or** sit on the porch. Dimity writes the **Day Page** in under a second, ending with "Tomorrow:" and the threads you left open. |

Buyer coverage (24h): Juniper 8 am–10 pm; Ludo 10 pm–8 am. Both at full price. (See §6.3.)

### 3.2 Real-time tide

| Parameter | Value |
| --- | --- |
| Low tides per day | **2** |
| Interval between lows | about **12 h 25 min** |
| Daily drift | each low is about **50 minutes later** than the day before |
| Low tide opens | the **flats**, the **causeway**, and the **natural stepping stones across the river mouth** (present from day 1) |
| High tide brings | **shoals to the quay** |
| Night low tide | mud **glows** (cyan), glowing relics appear (§10) |

#### Three tide guarantees

1. Every **12.5-hour waking window** contains a low tide.
2. The tide gives **shortcuts and bonuses** but **never locks anything**.
3. **Nothing is exclusive** to one tide or one day.

WW contrast (O13, O14): rivers crossable only at bridges; evenings after 11 pm shop close offered little.

---

## 4. The Week and the Season

### 4.1 Weekly calendar

| When | What happens |
| --- | --- |
| Monday | **Life-thread beats advance** for neighbors you're involved with |
| Wednesday | **Sister-town parcel day**: post your fruit, theirs arrives next morning (O11) |
| Saturday night | **Lantern Market** on the green; **Porch Supper** on a different porch each week |
| Sunday morning | **Porch Sale**: neighbors' old furniture on blankets, priced by personality |
| Weekly | **Archive Bounty**: three wanted specimens at a bonus |

### 4.2 Seasonal festivals

| Season | Festival | Content |
| --- | --- | --- |
| Spring | **Mudlark Day** | A low-tide dig and Tuck's mud race |
| Summer | **Firefly Regatta** | Lantern boats down the river |
| Autumn | **Lantern Float** | Augusta reads the count of lit porches aloud |
| Winter | **Long Night** | On the solstice, every lit porch gives a small gift |

- Seasons follow the **real calendar**, with a **southern-hemisphere toggle**.
- **Birthday invitations** come by mail, as in WW (O12).

---

## 5. The Hearth Ladder (Debt / House Progression)

WW baseline (O7): seven loans totalling 3,559,800; one for the starting house, six upgrades, each built overnight; money was the real bottleneck. Porchlight keeps the shape and "gives it faces".

### 5.1 Loan table

| Loan | Amount | Built overnight |
| --- | --- | --- |
| 1 | **12,000◉** | The **bedsit** (you start in it) |
| 2 | **90,000◉** | The **cottage** |
| 3 | **180,000◉** | Room commission #1 |
| 4 | **300,000◉** | Room commission #2 |
| 5 | **450,000◉** | Room commission #3 |
| 6 | **600,000◉** | Room commission #4 |
| 7 | **750,000◉** | The **Lamp Room** |
| **Total** | **2,382,000◉** | Each tier raises the **lighthouse scaffolding one section** |

Derived check: 12,000 + 90,000 + 180,000 + 300,000 + 450,000 + 600,000 + 750,000 = 2,382,000 ✔. Total is roughly a third below WW's 3,559,800.

### 5.2 Lender

| Field | Value |
| --- | --- |
| Who you owe | **Hearthwright & Daughter**, a builders' co-op |
| Interest | None |
| Deadline | None |
| Penalty | None |
| Flavour | Your house is **Wren's first solo build** |

### 5.3 Paying

- Pay **any amount**, at the **co-op yard**.
- Feedback: Wren flicks **one abacus bead per 1,000◉**; Ambrose gnaws the notches and splits the tally stick with a **THWAP** of his tail; your half goes on the **tally wall**.
- **Holding confirm fast-counts** big payments.

### 5.4 Commissions (loans 3–6)

- From loan 3, the player picks **four of six** commissions, one per loan tier 3–6:

| Commission | Gameplay effect stated in source |
| --- | --- |
| **Porch & Loft** | — (not specified in this chapter) |
| **Cellar** | — |
| **Side Room** | — |
| **Greenhouse** | Enables **grafting** a foreign scion onto a native tree overnight (§11) |
| **Workshop** | Enables the **cleaning bench**: fossil left overnight comes out cleaned and worth more (§10) |
| **Gallery** | — |

- The **other two** commissions can be **bought after the Relighting**.
- A **roof colour** is chosen at **every tier** (O15).

### 5.5 Pacing targets

| Target | Value |
| --- | --- |
| Loan 1 paid | within **about one hour of booting**. Errands cover half (up to 6,000◉); about **15 minutes** of shaking and selling covers the rest. |
| Grinder | about **3 weeks** to pay the full ladder |
| 45 min/day player | **8 to 12 weeks** |
| Hard floor | **7 days** (6 overnight builds, since you start in the bedsit) |
| Income assumption | Removing friction should raise income per hour by an estimated **1.5× to 2×** vs WW `[NEED SOURCE: playtest]`. Only data point: about **25k** on the author's first WW day. |

### 5.6 Resident shares (friendship as a second payment path)

| Rule | Value |
| --- | --- |
| Trigger | See a resident's **lead life thread** through to its end |
| Reward | The resident brings Wren a **tally stick worth 5% of your current loan** |
| Frequency | **Once per thread** |
| Eligible threads | **10 of the 13** hand-written lead threads belong to residents |
| Cast threads | The **3 cast threads** (Wren's, Hesper's, Ansel's) end with a **keepsake** instead (Wren never brings a tally stick to herself) |
| After payoff | A resident thread finishing after the Lamp Room is paid gives a **fixed 37,500◉** (= 5% of the last loan). It goes to the **Commons Jar** or toward **one of the two leftover commission rooms** — player's choice at the yard. |
| Economy model | A 45-min/day player finishes about **4 to 6** resident threads before payoff, roughly **100,000◉** total, about **4%** of the ladder. |

### 5.7 No dead days

- Every house, shop and Commons build happens **overnight**.
- If a shop expansion ever spills into the next day, **Juniper sells from a cart outside**.
- WW contrast (O8): store closed all day after upgrade; fish couldn't be dropped; session capped at 15 pocket slots.

### 5.8 The Commons

| Field | Value |
| --- | --- |
| Project count | about **ten** |
| Named projects | two **footbridges**, the **upstream stepping stones**, **lamps on the green**, the **Old Pier**, **reopening dark houses** |
| Funding | **Commons Jar** — you and the neighbors drop buttons into it |
| Free | The **river-mouth stones** are natural and cost nothing |
| Order | Player chooses the order; **the town never branches** |
| Side effect | Each reopened dark house lights a porch; a new neighbor walks across the causeway the next evening at dusk (§12) |

---

## 6. Economy and Pricing

### 6.1 Currency

- **Buttons (◉)**. No wallet cap. Fixed prices. Dynamic pricing rejected.

### 6.2 Income paths

| Path | Surface | Deeper layer | What limits it |
| --- | --- | --- | --- |
| Native fruit | **120◉** | Ripe fruit **+25%** (= 150◉, Derived) | Regrowth; about 100 trees |
| Foreign fruit | **480◉** | Grafting | Foreign trees planted |
| Night sea fish | **John Dory 2,400◉**, **lantern wolffish 4,200◉** | Learned tells, tight timing | Reach health |
| Fossils and relics | About **4 cracks a day**, glints at low tide | Cleaning bench | Daily cracks, tide timing |
| The Glint | **One purse** buried in the mud | Reading the flats | One a day |
| Timber | Ambrose buys it | Furniture carved from your timber | Storm branches and old stumps; no felling |
| Wanted Today | **3 items at +50%** | Planning around them | **One stack per item per day** |
| Resident shares | **5% of current loan**; after payoff, to the Commons Jar or a leftover room | Life threads | One per resident lead thread; about 4 to 6 before payoff |

Derived: ripe foreign fruit = 480 × 1.25 = **600◉** (confirmed by the Day 40 timeline, §20).

### 6.3 Buyers and selling channels

| Channel | Hours | Price |
| --- | --- | --- |
| **Juniper** (Pell's Sundries) | 8 am – 10 pm | Full price |
| **Ludo** | 10 pm – 8 am | Full price |
| **Consignment Crate** at your gate | Overnight, sells anything | **90%** of full price |
| **Basket** tool | — | Carries **three extra stacks** |
| **Ambrose** | — | Buys **timber** |
| **Barnaby** | — | Takes donations and **buys duplicates in one batch** (§10) |

Derived: 40 pears via Crate = 40 × 120 × 0.9 = **4,320◉** (confirmed by Day 40 timeline).

WW contrast (O6): about 30 fruit trees ≈ 9,000, needing six shop trips. Porchlight: one trip, or none.

### 6.4 Diminishing returns (anti-grind)

- Diminishing returns live **in the world, not the price list**:
  - A **reach you fish hard turns quiet** (reach health, §8.5).
  - There is **one Glint** and **about four cracks** per day.
  - **Wanted Today** pays its bonus on **one stack** per item.
- Grinding one path gets slower; **switching paths restores the full rate**.
- **No stamina bar.**

---

## 7. Inventory, Tools and Saving

### 7.1 Satchel

| Rule | Value |
| --- | --- |
| Base slots | **20** |
| Expandable to | **40** |
| Stacking | Fruit and shells stack to **10** |
| Purses | Go **straight to the wallet** (no slot) |
| Overflow | Drops into a **basket at your feet** |
| Fish | **Any fish can be released** |

### 7.2 Tools

- **Every basic tool is in the starter kit** (basic tools are never part of the stock lottery; see §10).
- The **tool ring** replaces dragging tools onto a portrait.
- Named tools in this chapter: net, Loupe, Basket, (shovel implied by WW contrast), fishing rod (implied).

### 7.3 Saving

| Rule | Value |
| --- | --- |
| Autosave | At **every door** |
| Rest save | **Under one second** |
| Quit | From pause, **at any moment** |
| Loading | **Never writes a save** |
| Scolding character | Replaced by **Dimity** (no scolding) |

WW contrast (O3, O4): 30-second "Save and end" to title; loading wrote a save; quitting summoned a scolding character; 15 unstacked pockets; money bags took slots; wallet capped at 99,999; fish couldn't be dropped. All fixed.

---

## 8. Fishing

### 8.1 Shadows everywhere (with one exception)

| Rule | Value |
| --- | --- |
| Simulation scope | Fish simulated in **every body of water**, not just near the camera |
| Density | **4 to 8 shadows** per river reach, the pond, the quay and each sea zone |
| Visibility | Schools visible from bridges |
| Exception | The **north creek** has **no shadows at all**. Field journal and map label it **"quiet since the Ebb winter"**. Ansel fishes it every evening anyway. |
| Restoration | After Ansel **turns the weir wheel** (§18), the north creek's shadows **return a few at a time over the following weeks**. |

### 8.2 Readable shapes

- **Six sizes** plus silhouettes: **dorsal fin, forked tail, eel ribbon, flat ray, silver school**.
- Silhouettes **shimmer at dawn and dusk**.

### 8.3 Learned tells

- After **three catches** of a species, its **tell** shows for you **everywhere**.
- Example tells: a **1-px glint**, a **bar pattern under moonlight**, a **ribbon wiggle**.
- Intent: knowledge becomes skill instead of luck.

### 8.4 The bite

| Parameter | Value |
| --- | --- |
| Feints | Bobber feints **1 to 3 times** |
| Bite | Splash + rumble + "plip" |
| Default timing window | **7 to 31 frames** (about **0.12 to 0.52 s**), the band measured in WW. Generous for common fish, tight for night headliners. |
| Gentle timing (accessibility) | **0.6 to 0.9 s**, with its **own record board** |

### 8.5 Reach health

- Each reach has a **busy/quiet** value.
- It **dips if you fish it hard** and **recovers within a day or two**.
- There is a **floor** so nothing is ever fished out.
- **Releasing a fish nudges it back up.**

### 8.6 Preserved from WW

- Tight reflex timing and **night sea fishing as the best income** are deliberately kept (O9).

---

## 9. Bug Catching

| Rule | Value |
| --- | --- |
| Species count | **40** |
| Signature | Each species has a **movement signature** and a **sound** |
| Learned tells | After **three catches**, its tell shows for you everywhere (same rule as fish) |
| Approach | **Walking is safe to about two tiles**; **running spooks most species**. **No sneak button.** |
| Lights | **Moths gather at porchlights and at string lights you hang** — light placement changes what visits after dark. |
| Status | Source notes this system was logged least in the WW playtest and needs its own test before the roster is committed. |

---

## 10. Foraging, Fossils and Relics

### 10.1 Daily finds

| Find | Rule |
| --- | --- |
| Fossil cracks | About **four** on land each day |
| Low-tide flats | Town **relics**, **cockles**, neighbors' buried **time capsules**, and **one Glint** |
| Night low tide | Mud glows **cyan** and gives up **glowing relics** |

### 10.2 One stop

- The **Loupe** (starter kit) **names a find on the spot**.
- **Barnaby** takes donations and buys duplicates **in one batch**.

### 10.3 Cleaning bench

- Requires the **Workshop** commission.
- A fossil left overnight comes out **cleaned and worth more** — a self-set overnight thread.

### 10.4 Relic histories

- Each relic links to a **specific old letter**.
- Barnaby pins both to the **string wall** that tracks the mystery.

WW contrast (O10): shovel not in stock on day 1 due to random stock, delaying fossils and the daily windfall rock. Basic tools are never in the stock lottery.

---

## 11. Orchard and Planting

| Rule | Value |
| --- | --- |
| Tree count | About **100**; player names the town |
| Native fruit | **120◉** |
| Foreign fruit | **480◉** (fixed **4×** gap) |
| Ripening | Fruit **regrows, then ripens**. Ripe fruit shows a **blush and a fuller shape** (never colour alone) and sells for **25% more**. Leaving fruit on the tree is a choice. |
| Grafting | With the **Greenhouse** commission: graft a **foreign scion onto a native tree overnight** |
| Foreign fruit sources (4, all visible) | 1. Wednesday parcels, 2. gifts from close friends, 3. Lantern Market seedlings, 4. grafting |
| Letters | When writing a letter, a **tone strip** shows how the neighbor will read it; **good letters get good replies** |

WW contrast (O11): foreign fruit arrived at random; the known trick was mailing deliberately bad letters with an item attached. Rewarding rudeness is treated as a bug.

---

## 12. Neighbors and Relationships

### 12.1 Routines (examples)

| Neighbor | Routine |
| --- | --- |
| Bramble | Gardens at **7 am** |
| Tuck | Jogs the **causeway at low tide** |
| Odile | Paints **the point at sunset** |

### 12.2 Memory

- Neighbors have opinions about each other.
- They remember **what you gave them, what you said, and which side you took**.
- **No line repeats for about five days.**
- **Porch talk** carries the deeper beats.

### 12.3 Life threads

| Rule | Value |
| --- | --- |
| Beats per lead thread | **4 to 6** |
| Duration | **3 to 6 real weeks** |
| Advancement | **Only if you're involved**; beats advance on **Mondays** (§4.1) |
| Hand-written leads | **13** (10 resident, 3 cast: Wren, Hesper, Ansel) |
| Others | Built from **templates** |
| Reward | Resident lead thread → tally stick (§5.6); cast thread → keepsake |

### 12.4 Favours with meaning

- Wants are pinned to **doors** and the **Commons request board** (example: "Tuck wants a sea bass for his race diet").
- Each favour **moves a thread or tells you something about the person**.

### 12.5 Nicknames

- Accept one, decline it, or **suggest another**. (Day 1 example: Tuck offers "Paddles"; player suggests "Skip".)

### 12.6 Moving in

- Each **reopened dark house** lights a porch.
- The new neighbor **walks across the causeway the next evening at dusk**.
- Launch pool: **24 neighbors** across **8 species families**.

### 12.7 Moving out (Proposed)

- A neighbor leaves **only after pinning a notice a week ahead**, and **only if you don't ask them to stay**.
- **Nobody mid-thread asks** to leave.
- Their porch **stays lit** for a new arrival: **a porch you've lit never goes dark**.

WW contrast (O12, O2): warm villagers but fast line repetition, random favours, little sense of lives; tutorial never said to chat twice.

---

## 13. Weather and Seasons

| Rule | Value |
| --- | --- |
| Forecast | **Augusta** gives honest odds (e.g. "7 in 10, showers by the afternoon tide") and admits when she's wrong |
| Rain | Brings some **fish and bugs** out |
| Fog | Pulls **silver schools close to the quay** |
| Storms | Drop **branches** (timber for Ambrose) and wash **shore finds** onto the beach |
| Locking | Weather changes play but **never locks anything** |
| Winter | **Stoat neighbors turn ermine** |
| Music | Changes **on the hour** (O15): **24 hourly themes** with **adaptive stems** for season, weather, tide and night |

---

## 14. Customization and Home

### 14.1 The lease card (character creation)

| Field | Options |
| --- | --- |
| Species (6) | **water vole, river otter, red panda, opossum, ferret, mongoose** |
| Fur palettes | **ten** per species |
| Also | markings, eye shapes, blush |
| Pronouns | chosen **separately** |
| Name entry | **controller-first with a confirm step** |
| Visibility | Every field **visible and editable** |
| Wren's small talk | Sets **only** your **houseplant** and the **first morning's weather**, and she tells you so |

### 14.2 Clothing layers

- **top, bottom, shoes, hat, accessory, held item**

### 14.3 The house

- Room commissions (§5.4), a **roof colour per tier**, and a **tally wall** that reads like a diary of your year.

### 14.4 Furniture

| Rule | Value |
| --- | --- |
| Launch count | about **300** items |
| Stock | **Random daily stock kept** (the lottery is fun when it's furniture) |
| Timber furniture | Ambrose carves pieces from **your timber** over **two nights**, each **tagged with where the wood was found** |

WW contrast (O1, O15): taxi interview silently decided face/gender; the physically growing house is kept as the best moment.

---

## 15. The Archive

| Category | Count at launch |
| --- | --- |
| Fish | **40** |
| Bugs | **40** |
| Fossils | **30** |
| Town relics | **20** |
| Shore finds | **20** |
| **Total** | **150** (Derived) |

- Curated by **Barnaby**.
- The **field journal** shows each species you've **seen but not caught** as a **silhouette with the conditions you've observed** (e.g. sea, night, high tide), so the log teaches without a wiki.

---

## 16. Multiplayer

| Rule | Value |
| --- | --- |
| Online at 1.0 | **Asynchronous only** |
| Content | Parcels and postcards with friends' towns by **friend code**; **preset phrases** and **filtered free text** |
| Offline fallback | **Two offline NPC sister towns** — trade never depends on a server |
| Expand ideas (not promises) | Live visiting, couch co-op |
| Team note | A team of 12 shouldn't spend 1.0 on netcode |
| WW claim | None (WW multiplayer not tested) |

---

## 17. Accessibility and Respect for the Real Clock

### 17.1 Access

- **Gentle bite timing** (0.6–0.9 s, own record board).
- **Dyslexia-friendly glyphs**.
- Tells use **shape and motion, never colour alone**.
- **Every audio tell gets a visual twin.**
- Controls **fully remappable** (Proposed).

### 17.2 No skipping

- **No time skip, no paid speed-ups, no "sleep until tomorrow".**

### 17.3 Changing the system clock

- **Neither punished nor supported**: the town fast-forwards.
- Two caps keep the arc intact:
  1. **One old letter per in-game morning.**
  2. **One house build per night.**
- Saves that never skipped earn an **"Unhurried" wax seal** on their **Season Books**.

### 17.4 Absence

- After **a week away**, the town catches up in a **simplified simulation**.
- Dimity's **"While you were away"** page explains it.
- **No weeds, no guilt.**

### 17.5 Open decision

- Whether to offer an **opt-in faster season calendar**, labelled **non-canonical**, for bingers and streamers. Decided before the vertical slice.

### 17.6 Classic preset

- **15 unstacked pockets**, **no Consignment Crate**, **tight timing on every fish** — but **never** the 30-second save or the scolding.

The caps and the open-thread rule are how anticipation survives.

---

## 18. Progression and Late Game

| Beat | Rule |
| --- | --- |
| Story gate | Exactly **one** gated scene: **the Relighting**, after the **seventh loan** |
| After the Relighting | The **amber beam sweeps the town every 8 seconds**; a letter **postmarked last week** arrives from the **Outer Isles** |
| Letter backlog | About **120 letters** at **one per morning**. A player finishing in 8–12 weeks still has **a third to a half** of the backlog ahead. |
| Weir wheel | Once **both** the Relighting **and** Ansel's confession have happened, Ansel **turns the weir wheel**: a strip of the flats becomes **shallows**, shadows start **returning to the north creek**, and **Tamsin sails the first boat in** |
| Expand ideas (not promises) | Isolde's homecoming; the Outer Isles by ferry; a Year Two |

Derived: 8 weeks ≈ 56 letters, 12 weeks ≈ 84 letters, of ~120.

---

## 19. A Day in the Life: Day 1 (verbatim schedule)

*A Thursday in October. The player boots the game at 6:40 pm and has paid off loan 1 an hour later.*

- **6:40 pm.** You arrive on foot at dusk as the sea creeps back over the causeway. Four porches glow across the harbor.
- **6:41.** Wren meets you with the lease card. You pick a river otter with freckles, choose pronouns, type a name and confirm it, then name the town.
- **6:44.** She hands over the bedsit key, a full starter kit and the First Week Errands clipboard. Loan 1 is 12,000◉, and the errands knock up to 6,000◉ off it.
- **6:45 to 7:20.** Errands, in your own order: the apron, saplings and seed bags, chatting with Tuck, Clem and Bramble until each asks your birthday. Tuck calls you "Paddles"; you suggest "Skip" and he takes it well. You carry in the mail sack and Hesper's lamp comes on. You post a letter, deliver a parcel, pin your notice, catch a perch and show Barnaby a find. All done: 6,000◉ off.
- **7:20 to 7:35.** You shake and sell for the other 6,000◉: twenty fruit (2,400◉), two purses, a bee nest you heard in time to net (honeycomb, 350◉) and a few quay fish. With the purses already in your wallet, one trip to Juniper takes you just past 6,000◉.
- **7:40.** At the yard the abacus clicks six times, Ambrose gnaws, THWAP. Wren offers loan 2, the cottage, and you pick a slate-blue roof.
- **7:45.** Your porchlight comes on and Dimity moves into the lamp. Wick, cap over his eyes, calls you "Keeper".
- **7:50.** The Day Page: *Tomorrow: the cottage goes up overnight; Hesper's first delivery; low tide 6:30 am; Bramble's flowers need water.* The save takes under a second.

### 19.1 Day 1 implementation checklist (Derived from the schedule)

| Element | Requirement |
| --- | --- |
| First Week Errands clipboard | A list worth **up to 6,000◉** off loan 1, completable in any order |
| Errand items named | get the apron; saplings and seed bags; chat with Tuck, Clem and Bramble until each asks your birthday; carry in the mail sack (lights Hesper's lamp); post a letter; deliver a parcel; pin your notice; catch a perch; show Barnaby a find |
| Nickname flow | Tuck offers "Paddles" → player can counter with "Skip" |
| Cash target | Other 6,000◉ from: 20 fruit × 120 = 2,400◉; two purses (direct to wallet); honeycomb 350◉; a few quay fish; one Juniper trip |
| Abacus | 6 bead clicks for a 6,000◉ payment (1 bead per 1,000◉) |
| Loan 2 offer | Immediately on paying loan 1; roof colour chosen (slate-blue) |
| Porchlight | Lights when loan 1 is paid; **Dimity** moves into the lamp; **Wick** calls you "Keeper" |
| Day Page | Ends with "Tomorrow:" list; save under one second |

---

## 20. A Day in the Life: Day 40 (verbatim schedule)

*A Monday in late November, the day life threads move. Loan 6 (600,000◉) is open; the Greenhouse, Porch & Loft, Workshop and Gallery are built.*

- **7:10 am.** Letter 39 is Isolde's sketch of the mill weir, which Barnaby will pin beside last week's relic. Bramble's note reads "Fence. Today. Bring Tuck."
- **7:12.** The Ledger Board: *432,000 to go, about 11 days at this pace.* Low tides at 11:48 am and 12:14 am. Wanted Today is cockles, honeycomb and sea bass. The Crate sold 40 pears overnight for 4,320◉.
- **7:15 to 7:45.** You shake the foreign orchard for 36 ripe fruit at 600◉, check the plum graft that took overnight, collect a cleaned fossil from the bench, and pack pears for Wednesday's parcel day. One trip to Juniper, then 28,000◉ paid at the yard.
- **7:50.** At Bramble's fence a four-week feud ends: she and Tuck agree to rebuild it together. Bramble brings Wren a tally stick worth 30,000◉. The board drops to 374,000◉. You close the game.
- **9:00 pm.** On her porch, Odile asks you to stand on the point at sunset tomorrow. Ferdinand greets you with your own catchphrase.
- **11:40 pm.** The mud starts to glow as the tide drops. You dig a glowing relic, then spot a forked-tail shadow on the quay with the tell you learned weeks ago: John Dory. You land two and a lantern wolffish, and release a small fish to keep the reach busy. Meteors cross the sky.
- **12:30 am.** Ludo, hanging from the eave, buys the catch for about 11,000◉. You sit on your porch. *Tomorrow: Odile at sunset; the relic's history; plum harvest; Bramble and Tuck's new fence; letter 40.*

### 20.1 Day 40 consistency checks (Derived)

| Check | Math | Result |
| --- | --- | --- |
| Letter number | One letter per morning from the morning after porch lights (Day 2 = letter 1) → Day 40 = letter 39 | ✔ |
| Ripe foreign fruit price | 480 × 1.25 = 600◉ | ✔ |
| Crate pears | 40 × 120 × 0.9 = 4,320◉ | ✔ |
| Orchard haul | 36 × 600 = 21,600◉ | consistent with a 28,000◉ payment after other sales |
| Tally stick | 5% × 600,000 (loan 6) = 30,000◉ | ✔ |
| Ledger | 432,000 − 28,000 − 30,000 = 374,000◉ | ✔ |
| Pace estimate | 432,000 / 11 days ≈ 39,300◉/day | implied pace |
| Tide spacing | 11:48 am → 12:14 am = 12 h 26 min | ✔ (≈ 12 h 25 min) |
| Night catch | 2 × John Dory (4,800) + lantern wolffish (4,200) = 9,000◉, "about 11,000" with the rest of the catch | consistent |
| Four of six commissions | Greenhouse, Porch & Loft, Workshop, Gallery built; Cellar and Side Room are the two leftovers in this save | ✔ |

---

## 21. Named Entities Referenced in This Chapter

| Name | Role as evidenced in the Gameplay chapter |
| --- | --- |
| **Wren** (Hearthwright) | Co-op builder; hands over lease card, key, starter kit, errands; takes payments with the abacus; offers loans; gives the Ledger Board pace estimate; has a cast life thread |
| **Ambrose** | Co-op; gnaws/splits tally sticks (THWAP); buys timber; carves furniture over two nights |
| **The Thatch** | Co-op; ties off new roofs before 6 am |
| **Hearthwright & Daughter** | The builders' co-op you owe |
| **Dimity** | Lives in your lamp from loan 1 payoff; writes the Day Page and the "While you were away" page; replaces the scolding character |
| **Hesper** | Post office; counter open from 6 pm; her sack holds the old letters (one per morning); lamp lights when you carry in the mail sack; cast thread |
| **Juniper** | Pell's Sundries; buys 8 am–10 pm at full price; sells from a cart if a shop build spills over |
| **Ludo** | Buys 10 pm–8 am at full price; hangs from the eave |
| **Barnaby** | The Archive; names/takes finds, buys duplicates in a batch; string wall for relics and letters |
| **Augusta** | Forecasts with honest odds; reads the lit-porch count at the Lantern Float; Commons board |
| **Ansel** | Fishes the north creek nightly; turns the weir wheel after Relighting + his confession; cast thread |
| **Tuck** | Jogs the causeway at low tide; mud race on Mudlark Day; wants a sea bass for his race diet; nicknames you "Paddles"; feuds with Bramble over a fence |
| **Bramble** | Gardens at 7 am; flowers need water; fence feud with Tuck resolved Day 40 (30,000◉ tally stick) |
| **Odile** | Paints the point at sunset; asks you to stand on the point at sunset |
| **Clem** (Clementine) | Starter neighbor; asks your birthday on Day 1 |
| **Wick** | Cap over his eyes; calls you "Keeper" |
| **Tamsin** | Sails the first boat in after the weir wheel turns |
| **Ferdinand** | Greets you with your own catchphrase (Day 40) |
| **Isolde** | Away; letter 39 is her sketch of the mill weir; homecoming is an Expand idea |
| **Pell's Sundries** | The shop (8 am–10 pm) |
| **The Archive** | Barnaby's collection building |
| **The co-op yard** | Where you pay loans |
| **The Commons / Commons Jar / Commons request board** | Town projects, their funding, and pinned wants |
| **Lantern Market** | Saturday night on the green; sells seedlings |
| **Season Books** | Where the "Unhurried" wax seal is recorded |

---

## 22. Open Items, Proposed Flags and NEED SOURCE Tags

| Item | Status |
| --- | --- |
| All numbers | **Proposed**; tune in playtest |
| Income-per-hour uplift of 1.5×–2× vs WW | `[NEED SOURCE: playtest]`; only data point is ~25k on author's first WW day |
| Bug roster (40 species) | Needs its own test before commitment |
| Moving out rules | **Proposed** |
| Fully remappable controls | **Proposed** |
| Opt-in faster, non-canonical season calendar | **Open decision**, to be made before the vertical slice |
| Live visiting, couch co-op | Expand ideas, not promises |
| Isolde's homecoming, Outer Isles by ferry, Year Two | Expand ideas, not promises |
| Commission effects for Porch & Loft, Cellar, Side Room, Gallery | Not specified in this chapter |

---

## 23. Quick Number Index

| Quantity | Value |
| --- | --- |
| Trees in town | ~100 |
| Honeycomb | 350◉ |
| Bee penalty | 3 cartoon bees for 1 hour |
| Bee warning | 1 s hum + gold specks |
| Fruit/shell stack | 10 |
| Tool ring sockets | 8 |
| Satchel | 20 → 40 slots |
| Basket tool | +3 stacks |
| Mailbox | 6 am; exactly 1 old letter/morning |
| Shop hours | 8 am – 10 pm |
| Porchlight Hours | 8 pm – 2 am |
| Porch talk | 8 – 11 pm |
| Ludo | 10 pm – 8 am |
| Hesper's counter | from 6 pm |
| Low tides | 2/day, ~12 h 25 min apart, ~50 min later daily |
| Waking window guarantee | 12.5 h |
| Loans | 12k / 90k / 180k / 300k / 450k / 600k / 750k = 2,382,000◉ |
| Abacus | 1 bead per 1,000◉ |
| Commissions | pick 4 of 6; other 2 after Relighting |
| Loan 1 target | ~1 hour; errands worth up to 6,000◉ |
| Payoff pacing | grinder ~3 weeks; 45 min/day 8–12 weeks; floor 7 days |
| Resident share | 5% of current loan; post-payoff 37,500◉ fixed |
| Lead threads | 13 (10 resident + 3 cast); 4–6 beats; 3–6 weeks |
| Resident threads before payoff | ~4–6 (~100,000◉, ~4% of ladder) |
| Commons projects | ~10 |
| Native fruit | 120◉; ripe +25% |
| Foreign fruit | 480◉ (4×); ripe 600◉ (derived) |
| John Dory | 2,400◉ |
| Lantern wolffish | 4,200◉ |
| Fossil cracks | ~4/day |
| Glint | 1/day |
| Wanted Today | 3 items, +50%, 1 stack each |
| Consignment Crate | 90%, overnight |
| Shadows per water body | 4–8 |
| Fish sizes | 6 |
| Learned tell | after 3 catches (fish and bugs) |
| Default bite window | 7–31 frames (~0.12–0.52 s) |
| Gentle bite window | 0.6–0.9 s |
| Reach recovery | 1–2 days, with floor |
| Bug species | 40 |
| Bug safe walk distance | ~2 tiles |
| Line repeat gap | ~5 days |
| Neighbor pool | 24 across 8 species families |
| Move-out notice | 1 week |
| Player species | 6; 10 fur palettes each |
| Clothing layers | 6 |
| Furniture | ~300 |
| Timber furniture | 2 nights |
| Music | 24 hourly themes |
| Archive | 40 fish / 40 bugs / 30 fossils / 20 relics / 20 shore finds |
| Sister towns (offline) | 2 |
| Letters | ~120 total, 1/morning |
| Lighthouse beam | every 8 s after Relighting |
| Absence catch-up | after 1 week away |
| Classic preset pockets | 15 unstacked |
