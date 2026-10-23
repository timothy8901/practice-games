# WILDSHIFT: Story & Cast Reference

Reference doc extracted from the WILDSHIFT pitch, section "Story: The Brindle Isles" and "The rest of the cast". Engineers and designers should build from this document without consulting the original pitch. Names, numbers and rules are kept exact. Where the pitch marks a value as an estimate or `[NEED SOURCE]`, that is preserved here.

---

## Table of contents

1. Premise in one paragraph
2. Glossary of in-fiction terms and their system equivalents
3. The world: the Brindle Isles
4. The Vagary, skyglass, Heartmarks and how Shifts work
5. The factions: the Mooring and the Scatter
6. The Shiftreader role
7. Theme: identity persists through change
8. Cast overview table
9. Protagonist: Sorrel
10. Rival: Linnet Rask
11. Champion: Idris Fenwake and Vesperay
12. Mentor: Corin Vale
13. Faction heads: Provost Agathe Merrow, Teo Varga
14. Friend: Tobin Marsh and Rillfin
15. Spire leaders (all eight)
16. Summit Keepers (all four)
17. The eight Spires (full table and per-Spire detail)
18. Act structure: four acts, sixteen beats
19. The Vagary boss fight
20. The Summit, the Summit Bell and the Champion fight
21. Post-game
22. How story and systems reinforce each other
23. Dialogue and voice notes per character
24. Emerald Chaos V2 "run roots" appendix
25. Open items, estimates and unsourced values

---

## 1. Premise in one paragraph

WILDSHIFT is set in the **Brindle Isles**, a ring of **seven inhabited islands** around the **Starfall Lagoon**, where part of a comet called the **Vagary** fell a generation ago (about 30 years, estimate). The player is a **Shiftreader**: someone who reads a creature's next form before it lands and helps steer it. Two factions, the **Mooring** (stop all change) and the **Scatter** (amplify change), fight over whether change should stop or spread, and the comet is coming back. The player, **Sorrel** (default name), certifies through **eight Spires**, confronts the comet's passenger **Vagary** on a sea stack off Rimeholt in Act III, and challenges the **Summit** at **Shardcrown** and its **Champion, Idris Fenwake**, in Act IV. The thesis the plot argues: **keep the dice, show the odds.** One rule covers the whole script: **the story never asks the player to read something the UI has not shown.**

---

## 2. Glossary: fiction term to system equivalent

| Fiction term | What it is in the world | System equivalent |
|---|---|---|
| Shift | A permanent change of a creature's body (Up, Down or Sideways) driven by growth meeting skyglass pressure | Evolution replacement; resolves on the Forecast screen or at the next Waystone |
| Heartmark | A small four-point sparkle on every creature born since the Starfall; lights in comet magenta when a person bonds with it | Carries nickname, Bond, level, EXP, held item, trained stat points and one Heartmark technique through every form |
| Heartmark technique | The one move held by the Heartmark through all forms | Permanent signature move (e.g. Sloshkin's **Undertow**) |
| Reading Glass | Brass lens from Corin Vale that turns Heartmark glow into odds | The **Forecast screen** and the **Read** command |
| Scouting Prism | Clip-on for the Reading Glass, won at the 3rd Spire | Adds **moves, held items and heal pips** to Read |
| Weatherglass | Reward of the 4th Spire | Adds each island's current weather and next change to the sea chart |
| Forecast | What a Shiftreader sees when a Heartmark glows | Three cards, **Up / Side / Down**, with odds |
| Accept | Let the Shift land | Forecast choice 1 |
| Anchor stone | Cut and licensed by the Mooring; holds a Shift back; each one is used up | Forecast choice **Anchor** |
| Starsalt | Skyglass dust refined by the Scatter; shakes a pending Shift toward a different result | Forecast choice **Reroll** |
| Skyglass | Comet fragments that hum at a pitch only creatures hear | Source of Shift pressure; "seams" crack and cause Shift waves |
| Heartshard | The largest shard, still carried by the Vagary's head | Act III objective; settling it creates the tide table |
| Shiftlog | Strip of every form a creature has taken | Per-creature history; printed on the Seed Card |
| Field Log | Sorrel's record of creatures | Seen / Read / Held completion log |
| Waystone | Dock markers around the ring | Fast-travel nodes (skiff returns from badge 2); where a deferred Shift lands |
| Shelter | Rest/shop/storage stop in each town | Shop stock (Crackdust, Ethers), Training Yard, Rematch board, Chaos dial change |
| Spire | One of eight certifying tests | Gym replacement; each ends in a battle and pays a badge |
| Summit | Arena at Shardcrown | Elite Four + Champion replacement (four Keepers then Idris) |
| Summit Bell | Bell over Idris's gate | Checkpoint on Drift and Flux; silent on Freefall |
| Summit Purse | Fixed deposit taken at every badge from badge 5 | 1,500 glint (estimate) per badge, opens at the Summit gate |
| Ration Ledger | Reward of the 8th Spire | Pre-Summit checklist |
| Errant | A roaming great creature on a normal route | Wild legendary replacement |
| Lantern | Capture tool; raised, its light draws the creature in, filling a three-segment glow meter; nothing is thrown | Capture item; one sure-catch Lantern exists |
| Capture Stance | Toggle taught by Corin in Act II | Keeps your damage from dropping a wild creature below 1 HP; uses no move slot |
| Ward | An ability carried by stone sentinels and others that blocks most hits | Hex-lattice shimmer (replays about every 4 s) + 'Ward ?' badge |
| Crackdust | Item sold at Knapp's End Shelter before the Ward Spire | Counter to Wards; priced below one route trainer's payout |
| Hollow | A creature type immune to Plain and Grit | Type with immunities; move menu marks 'No effect' |
| Afterimage | Evasion-raising move that adds a visible copy | Evasion capped at +2; each copy drawn on screen |
| Mend | Heal from a budget of 3 per creature, shown as pips | Limited heals on stall creatures |
| Plumbline | Disc awarded at the 7th Spire | Always hits, clears the target's stat stages, blocks re-boosting for 2 turns |
| Gnash | Disc handed over by Linnet at Shardcrown's gate | A bite that strips one Afterimage per hit |
| Scrap | Fallback move | Used when every move is at 0 PP (no soft-lock) |
| Glint | Currency | Money |
| Chaos dial | Chosen at new game | Drift, Flux, Freefall or Custom; changeable at any Shelter (mid-run change marks Seed Card 'not race-eligible') |
| Seed / Seed Card | Every save has a shareable seed code; the Seed Card prints at the end | Race-eligibility and Shiftlog summary |
| Anchor Pulse | Mooring device that blocks Shifts on a team / freezes Shifts mid-way | Used by Merrow in her battle; misfires in Act II beat 8 |
| Sinking Engine | Merrow's tethered engine on the Rimeholt sea stack | Act III set piece |
| Carnival Raft | The Scatter's barge of Shift fairs, seed lockers and repair stalls | Scatter mobile HQ; later a Starsalt clinic |
| Night of Wrong Shapes | The night every draft creature in Saltreach Shifted and the fishing fleet went down | Backstory event; Merrow's motivation; memorial on Cairnhold |
| Star-touched forms | Rare forms | About 2% on every dial |
| No Rewind | Challenge mode | No savestate reload; owned by the gameplay section |

---

## 3. The world: the Brindle Isles

### 3.1 Layout principle

- Seven inhabited islands in a ring around the **Starfall Lagoon**.
- The lagoon is where part of the Vagary fell a generation ago (about 30 years, estimate).
- The ring is a layout decision as much as a story one: **the critical path goes once around the ring, clockwise, then crosses the Causeway to the Summit on the central atoll.**
- **The critical path never sends the player back to an earlier island.** The plot happens on the island you are standing on. Optional content waits on earlier islands, so going back is always a choice.
- Each island has **one dominant weather**, and the sea chart shows it before you sail. Weather never hides walkable tiles.
- Trees and grass use different silhouettes.
- Story dungeons keep puzzle progress when you leave.

### 3.2 Island table (clockwise critical path order)

| # | Island | Terrain / character | Settlements | Spire | Notes |
|---|---|---|---|---|---|
| 1 | **Lowmoor** | Tide flats and marsh | Home village **Pellwick**; ferry town **Brackenford** | 1st: Turn Spire (Brackenford) | Sorrel's and Linnet's home; dock battle; rematch spot marked at Brackenford |
| 2 | **Cairnhold** | Quarries and standing stones | Mining town **Knapp's End** | 2nd: Ward Spire (Knapp's End) | Quarry bloom; Mooring clinic; memorial to the Night of Wrong Shapes; Tobin's home |
| 3 | **Saltreach** | The port town that fills its island | **Saltreach** (town = island) | 3rd: Disc Spire | Home of the **Anchorage**, the Mooring's headquarters; the market; Shift fair; Linnet's fall |
| 4 | **Emberstep** | A steaming volcano with spa terraces | Town of **Sulphur Cross** | 4th: Weather Spire (Sulphur Cross) | First Errant appears on its slopes |
| 5 | **Drownwood** | A forest the sea is taking back | Stilt town **Mossgate** | 5th: Hollow Spire (Mossgate) | The drowning street; Scatter rescue; Anchor Pulse misfire |
| 6 | **Thistlewind** | High moor and windmills | Cliff town **Windle** | 6th: Relay Spire (Windle) | The Surge: a whole street Shifts in one night |
| 7 | **Rimeholt** | Glacier and mirror-ice caves | Port of **Frostwick** | 7th: Mirror Spire (Frostwick) | A **sea stack** off its north shore stands under the comet's path; Act III climax on top of it |
| 8 | **Starfall Lagoon and the Causeway** | Lagoon; the **Causeway** crosses it to **Shardcrown** on the central atoll | **Shardcrown** (home of the Summit) | 8th: Long Road Spire (runs along the Causeway) | Trainer gauntlet between two Shelters; tide pools beside the road |

### 3.3 Travel

- **One ferry line**, run by **Maud Tallis**, links the ring. Her ferry always confirms the destination.
- From **badge 2** (the Ward badge), the player's **skiff can return to any visited Waystone dock**.
- The **Weatherglass** (badge 4) adds each island's current weather and its next change to the sea chart.

### 3.4 Waystones and Shelters

- **Waystones**: docks around the ring. A Shift the player puts off lands at the next Waystone. Skiff fast-travel targets visited Waystones.
- **Shelters**: present in each town and at both ends of the Causeway. Functions referenced in the story:
  - Shop stock: **Crackdust** at Knapp's End Shelter before the Ward Spire (priced below one route trainer's payout); **Ethers** in Shelter stock since badge 3.
  - **Training Yard** at every Shelter after the Relay badge: stored creatures earn a share of party EXP.
  - **Rematch board**: Spire leaders post rematch offers here in the post-game. No calls interrupt travel.
  - The **Chaos dial can change at any Shelter** (mid-run change marks the Seed Card 'not race-eligible').

---

## 4. The Vagary, skyglass, Heartmarks and how Shifts work

### 4.1 The Vagary (the comet)

- A comet on a long orbit.
- On its last pass it broke apart over the islands.
- One large piece struck the sea and made the **Starfall Lagoon**.
- Smaller fragments became **skyglass**: shards that hum at a pitch only creatures hear.
- The comet's head kept going and still carries the largest shard, the **Heartshard**.
- In **Act III the Vagary comes back**. Its tail brushes a sea stack off Rimeholt; for one night the Heartshard can be reached from the top of the stack.
- The comet also carries a passenger: the creature islanders also call **Vagary** (see section 19).
- After Act III the Vagary climbs away with the Heartshard and **stays in the night sky** through the post-game.

### 4.2 Heartmarks

- Every creature born in the isles **since the Starfall** has a faint Heartmark: a small **four-point sparkle**.
- It stays dark until a person bonds with the creature, then it lights in **comet magenta** (palette key `m`).
- **Wild creatures show none** (the mark is dark until bonded).
- Each mark sits in its own spot on its own creature and **keeps that spot through every form**.
- Creatures born **before** the Starfall had no mark. In the first wild year many of those older creatures Shifted and no longer knew their people. Their young were born marked.
- A lit Heartmark holds: **the name a person gave, the bond, and one Heartmark technique**, through any form.
- **A Shift never erases a Heartmark.**
- Every Shift animation ends with the Heartmark flashing `m`, with a `w` highlight on cool bodies or `y` on warm ones.

### 4.3 How a Shift works (fiction)

- A Shift happens when a creature's **growth meets skyglass pressure**, about **three times per creature over a run** (estimate, tied to the island level curve).
- The **Heartmark glows first**.
- A Shift can go **Up** (an older, larger form), **Down** (a younger, smaller form) or **Sideways** (a new body at the same stage).
- The result comes from the creature's **family pool**: forms that share its habitat, temperament or type. The pool makes outcomes likely, never certain.
- A Shift you put off **lands at the next Waystone**.
- Three ways Shifts differ from anything in Pokemon:
  1. They are **permanent**, with no battle-only transformations.
  2. They are **driven by growth**, so no device the trainer wears and no crystal on the creature triggers them.
  3. **Every one is forecast before it lands.**
- Sorrel's creatures **never Shift in battle**. Their Shifts resolve on the Forecast screen or at the next Waystone. (Scripted NPC and boss creatures do Shift in battle, always with the Forecast posted a turn ahead.)

### 4.4 What islanders know (common knowledge in dialogue)

- A glowing Heartmark means a Shift is close. Most people cannot read the glow. **Shiftreaders can.**
- **Anchor stones**, cut and licensed by the Mooring, hold a Shift back. **Each one is used up.**
- The Scatter refines skyglass dust into **Starsalt**. Starsalt **shakes a pending Shift toward a different result**.
- A Shift never erases a Heartmark.

### 4.5 System mapping (the Shift Forecast pillar)

| Fiction | Game |
|---|---|
| Reading the glow | The **Forecast screen**: three cards, Up, Side and Down, with their odds |
| Anchor stone | **Anchor** |
| Starsalt | **Reroll** |
| Accepting | **Accept** |

- In game terms a Shift **never touches**: level, EXP, held item, nickname, Bond, trained stat points or the Heartmark technique.
- The choice is a **menu, and nothing in it is timed**.

### 4.6 Shift tides after Act III

- Once Vagary settles into its ring form and the Heartshard steadies, **Shifts across the isles follow a tide table tied to the comet's orbit** that anyone with a Reading Glass can check.
- The Mooring's clinics run on this tide table in the post-game.

---

## 5. The factions: the Mooring and the Scatter

Design intent stated in the pitch: the two factions have **different structures, different methods, and points a player can agree with**. Sorrel works with both (a Mooring clinic in Act I; a Scatter Shift fair and a Scatter rescue in Act II). The climax gives each faction part of what it wanted and neither all of it. The game **never scores the player's Shift choices as good or evil**; NPCs react in dialogue only.

| | **The Mooring** | **The Scatter** |
|---|---|---|
| Goal | **Stop all change** | **Amplify change** |
| Character | Old, public and respectable | Young, poor and loosely run |
| Institutions | Runs the **creature clinics**, the **ferry safety board** and the **anchor licensing office** | No hideout. Travels on the **Carnival Raft**: a barge of Shift fairs, seed lockers and repair stalls |
| Headquarters | The **Anchorage** on Saltreach | The Carnival Raft (mobile) |
| Leader / voice | **Provost Agathe Merrow** | **Teo Varga** (loudest voice; used to work in a Mooring lab) |
| Origin wound | Merrow lost her harbor on the **Night of Wrong Shapes**: every draft creature in Saltreach Shifted in one night, and the fishing fleet went down with them. Heartmarks kept those bonds; bonds did not keep the boats afloat. | The sea is rising, **Drownwood is going under**, and old forms cannot adapt in time. Shifts are how the islands' creatures survive. |
| Argument | Shifts kill people, and a government's first job is to prevent that. | Shifts are survival. |
| Plan | **The Sinking.** When the Vagary passes low, a tether from her **Sinking Engine** will drag the Heartshard off the comet and sink it in the deep trench past the outer reef, where its pressure cannot reach the surface. | **The Seeding.** Crack the Heartshard during the pass and let its dust ride the wind, so every creature Shifts at least once. |
| Flaw | The price she accepts: the Sinking ends Shifts, **and it ends Heartmarks with them**. Every bond in the isles would fade. Her anchor licenses also **cost more than a fisher earns**, so the rich keep their companions as they are and the poor cannot. | **Scale.** The Seeding would repeat the Night of Wrong Shapes on every island at once. |
| Tools | Anchor stones, anchor licenses, **Anchor Pulse** | Starsalt, Shift fairs, seed lockers, charges |
| Player's Forecast choice that "votes" for them | **Anchor** | **Reroll** |
| Why they need Shiftreaders | To **certify anchors** | To **call odds at Shift fairs** |
| Act III outcome | Merrow halts the Engine when she learns Sorrel is on the shard. Gets **forecasts for her clinics** (the tide table). | Varga helps Linnet and Tobin pull the Raft's charges. Gets **legal seed lockers**. |
| Post-game | Clinics run on the tide table; Merrow asks Sorrel to train clinic readers; keeps the mourning band. Short quest line. | The Raft becomes a **low-cost Starsalt clinic** for fishers who cannot pay for anchor stones (quietly funded by Hollis Brandt). Short quest line. |
| Replaces (Emerald) | Maxie and Team Magma | Archie and Team Aqua |

---

## 6. The Shiftreader role

- Sorrel can see a Heartmark's glow clearly and can tell which way it leans. Few people can.
- **Corin Vale**, a master Shiftreader whose eyes are failing, comes to Pellwick to test new readers and gives Sorrel a **Reading Glass**, a brass lens that turns the glow into odds.
- **Read works from the start.** Before a trainer battle it shows the foe's party as a compact strip, and the full card opens on a button.
- The **Scouting Prism**, won at the 3rd Spire, clips onto the lens and adds moves, held items and heal pips.

### A Shiftreader's job

1. Read a Shift before it lands and tell the owner what is coming.
2. Advise on the three choices: **accept it, shake it with Starsalt, or hold it with an anchor stone**.
3. Scout strange creatures: their **Ward**, their **types**, their **immunities**.
4. Keep the **Field Log** and each creature's **Shiftlog** (the strip of every form it has taken).

### Why the role exists

- Gives Sorrel a reason to visit every island, and gives both factions a reason to want them.
- Each Shift choice Sorrel makes is a small vote in the faction argument. NPCs react in dialogue; no good/evil score.
- The **eight Spires certify a Shiftreader**. Each Spire leader tests one kind of chaos. **Eight badges open the Summit gate at Shardcrown.**
- Design rule that follows from the role: **there is always something to read before the dice land.**

---

## 7. Theme: identity persists through change

**One line: you stay yourself through every change. The Heartmark makes that visible.**

How the theme shows up:

| Vehicle | Detail |
|---|---|
| **The starter's Heartmark** | Keeps its spot through every form. On the drawn **Sloshkin** (nicknamed **PUDDLE** in public mockups) it sits on the **forehead**. After a Shift into **Skeinwing** it is still on the head. It keeps the nickname, the Bond and the Heartmark technique, **Undertow**. Every Shift animation ends with the Heartmark flashing `m` (highlight `w` on cool bodies, `y` on warm ones), so the player sees the same creature arrive in a new body. |
| **The Shiftlog** | A strip of every form a creature has taken. The **Seed Card** at the end of a run shows each Heartmark creature's Shiftlog. |
| **The cast** | Each member faces the theme. Linnet's titan shrinks. Tobin's friend becomes a gill-breather. The Champion has kept his partner anchored since the day it hatched. The Mooring wants change to end. The Scatter wants it everywhere. |
| **The accidental hero** | A creature you wrote off after a bad Shift can come back. WILDSHIFT gives every slot that chance. |

Emotional design rule: **a Shift that keeps the nickname, the Bond, the level and the Heartmark technique reads as growth.**

Template from the run: MUDDY, the run's starter, took seven forms (Mudkip; Swampert at Lv16, skipping Marshtomp; Machop at Lv20; Wynaut in the Fortree gym; Ludicolo at Lv27; Altaria on Mt Pyre at Lv30; Gardevoir in the Magma Hideout). Moves and EXP carried over. Chaos evolutions re-read EXP on the new species' curve, so a Shift could cost levels. **WILDSHIFT removes the level loss: a Shift never touches level or EXP.** The Vagary boss's **seven phases echo MUDDY's seven forms**.

---

## 8. Cast overview table

| Name | Role | Home / location | Ace or team identity | Fought when | Emerald counterpart |
|---|---|---|---|---|---|
| **Sorrel** (default name) | Protagonist, apprentice Shiftreader | Pellwick, Lowmoor | Starter **Sloshkin** (PUDDLE in mockups), Heartmark technique **Undertow**; can Shift into **Skeinwing** | n/a | Emerald player character + Claude's position in the run |
| **Linnet Rask** | Rival; Sorrel's next-door neighbor | Pellwick, Lowmoor | Starter that Shifts into **Caldermaw** (Lv5 volcanic titan), later **Sootling** (palm-sized ember grub) | Dock (Act I), Brackenford rematch, Shardcrown gate (Act IV) | May (and her Lv5 Groudon) |
| **Idris Fenwake** | Champion of the Summit at Shardcrown | Shardcrown; watches the 7th Spire from the gallery | **Vesperay** (navy-blue manta ray, anchored since hatching) | Act IV beat 16; post-game rematches around the ring | Wallace (Latias) |
| **Corin Vale** | Mentor; master Shiftreader with failing eyes | Arrives at Pellwick on Maud's ferry | **Owl partner** that runs one scripted Shift per match | One optional exhibition per act | Steven + Professor Birch's starter handoff |
| **Provost Agathe Merrow** | Head of the Mooring | The Anchorage, Saltreach | Anchored team; ace is a **Ward creature** with the shimmer tell; uses **Anchor Pulse** | Once, at the Sinking Engine (Act III beat 11) | Maxie and Team Magma; Maxie's Wonder Guard Masquerain |
| **Teo Varga** | Organizer of the Scatter, voice of the Carnival Raft; ex-Mooring lab worker | The Carnival Raft | High-variance; spends Starsalt to force Shifts on his own creatures | Act II (fair) | Archie and Team Aqua |
| **Tobin Marsh** | Friend | Knapp's End, Cairnhold | **Rillfin** (Shifts into a gill-breather, later a form that walks and swims) | Acts I-II (fragile); Act IV on the Causeway (hardest battle on the road) | Wally |
| **Maud Tallis** | Ferry pilot of the ring line; 1st Spire leader (Turn) | Brackenford, Lowmoor | Two creatures, each with one scripted Shift | Turn Spire | Mr. Briney + Roxanne |
| **Osric Penhallow** | Stonemason; 2nd Spire leader (Ward) | Knapp's End, Cairnhold | Stone sentinels, each with one Ward | Ward Spire | Rustboro gym trainer's Wonder Guard Metagross |
| **Dov Lattimer** | Market auctioneer; 3rd Spire leader (Disc) | Saltreach | Sealed-crate draft | Disc Spire | The run's random shop TMs |
| **Ines Calloway** | Spa owner; 4th Spire leader (Weather) | Sulphur Cross, Emberstep | Arena weather on a posted forecast | Weather Spire | Lavaridge fog / Kyogre rain |
| **Ambrose Teague** | Boatwright; 5th Spire leader (Hollow) | Mossgate, Drownwood | Only Hollow creatures | Hollow Spire | Brawly's Dusclops, Juan's Banette, Drake's Dusclops walls |
| **Ada and Ivo Halloran** | Windmill twins; 6th Spire leaders (Relay) | Windle, Thistlewind | Relay rounds; final round is a double battle vs both | Relay Spire | Tate & Liza |
| **Seraphine Locke** | Ice-cave guide; 7th Spire leader (Mirror); Idris's former student | Frostwick, Rimeholt | Evasion stall: Afterimages + 3 Mends | Mirror Spire | Juan (Lv46 Banette) |
| **Hollis Brandt** | Retired Mooring quartermaster; 8th Spire leader (Long Road); keeps the Summit Purse ledger | Starfall Causeway | One high-defense creature and a full item bag | Long Road Spire | Victory Road and the League economy |
| **Odile Strand** | Summit Keeper 1 (Ward + Disc) | Shardcrown | Ward creatures with odd coverage | Summit | Glacia (Wonder Guard Beautifly) |
| **Bastien Kell** | Summit Keeper 2 (Hollow + Long Road); former salvage diver | Shardcrown | Hollow creatures backed by healing items | Summit | Drake (Lv53 Dusclops; Shiftry) |
| **Mirren Hale** | Summit Keeper 3 (Turn + Relay) | Shardcrown | Doubles team whose creatures run scripted Shifts with posted Forecasts | Summit | (no single named counterpart) |
| **Cass Rune** | Summit Keeper 4 (Weather + Mirror) | Shardcrown | Weather that feeds evasion, capped at +2 | Summit | (no single named counterpart) |
| **Vagary** | The creature carried by the comet | Rimeholt sea stack | Seven-phase boss; Shifts between phases | Act III beat 12; catchable in post-game | Wild Rayquaza / Kyogre / Jirachi / Deoxys / Groudon encounters |
| **Vesperay** | Idris's ace | Shardcrown | Evasion-and-recovery tank | With Idris | Wallace's Lv56 Latias |
| **Rillfin** | Tobin's companion | Knapp's End | Scripted Shift in Act IV battle | With Tobin | Wally's line (Ralts/Gardevoir) |

---

## 9. Protagonist: Sorrel

| Field | Detail |
|---|---|
| Name | **Sorrel** (default; player can rename) |
| Role | Apprentice Shiftreader |
| Home | **Pellwick** on **Lowmoor** |
| Family | Their parent repairs ferry engines in **Brackenford** |
| Age | A teenager ("a kid who can see the glow") |
| Personality | Quiet, observant, a little stubborn. Looks before acting and says what they see. **Dry humor that shows up mostly in journal entries.** |
| Dialogue design | Dialogue choices stay **short** so the player can project onto Sorrel |
| Gift | Can see a Heartmark's glow clearly and tell which way it leans. Few people can. |
| Starter | **Sloshkin** (nicknamed **PUDDLE** in public mockups). Heartmark on the forehead. Heartmark technique: **Undertow** (stays through every form). Example later form: **Skeinwing** (Heartmark still on the head). |
| Overworld art note | Overworld walk cycle, 4 frames at 6 fps (caption in source) |

### Arc

1. Starts as a kid who can see the glow and does not know what to do with it.
2. Certifies through **eight Spires**.
3. Learns that **steering a Shift means helping it land well**.
4. **Settles the Heartshard by accepting Vagary's final Forecast** on the Rimeholt sea stack.
5. Ends as the Shiftreader **both factions trust**.
6. In the post-game, **designs the ninth Spire** at Corin's request.

### Battle identity (player-driven)

- The story assumes a reader's habits: **Read first** (the Scouting Prism from the 3rd Spire adds moves, held items and heal pips), **check the Forecast**, then **commit**.
- Sorrel's creatures **never Shift in battle**. Their Shifts resolve on the Forecast screen or at the next Waystone.
- Replaces the Emerald player character and Claude's own position in the run: a player who acted on what each screenshot showed.

### Journal stamps referenced in the story

| Stamp | When |
|---|---|
| **'Identity Crisis'** | After the dock battle (Linnet's starter Shifts into Caldermaw) |
| **'First Steps'** | After winning the Brackenford rematch |
| Save stamps | The journal stamps each save and shows a check when the save verifies |

---

## 10. Rival: Linnet Rask

| Field | Detail |
|---|---|
| Name | **Linnet Rask** |
| Relationship | Sorrel's **next-door neighbor** in Pellwick; the **first trainer they fight** |
| Ambition | Wants to be **Lowmoor's first certified Shiftreader** and assumes she will be. Wants to be first at everything. |
| Personality | Loud, quick and generous once she respects you. **Hates being pitied more than she hates losing.** |
| Visual beat | Has **cut her ponytail** when she returns in Rimeholt |
| Key creature | Starter Shifts into **Caldermaw** (Lv5 volcanic titan) at the dock; later Shifts **down** into **Sootling** (a palm-sized ember grub); Sootling Shifts **twice more outside battle** before the final match and its Heartmark has not moved |
| Epilogue | Takes over **Maud's ferry wheel** |
| Replaces | May and her Lv5 Groudon in the first rival battle |

### Arc in five beats

| Beat | Where | What happens |
|---|---|---|
| **Opening** | Pellwick dock (Act I beat 2) | As their first battle opens, Linnet's starter glows. Sorrel sees a Forecast for the first time, on someone else's creature, and it lands on **Caldermaw, a Lv5 volcanic titan**. This is a **scripted story Shift on every Chaos dial**. The battle is a **'hold out 3 turns'** scene: Sorrel has to last three turns, and the story continues on any result, win or lose. The journal stamps **'Identity Crisis'**, and Maud tells Sorrel to come back stronger. The rematch spot is marked at **Brackenford**. |
| **Rise** | Act I | Linnet wins on Caldermaw alone. She **never benches it**, and the rest of her team stays weak. This is the one-carry problem in a person: one carry, everyone else about 30 levels under the curve. |
| **Fall** | Saltreach fair (Act II beat 6) | **Caldermaw Shifts down into Sootling** in front of the fair crowd. Linnet freezes. **Merrow offers an anchor stone** for whatever comes next. **Varga offers Starsalt** to push its next Shift back toward Up. **She takes neither** and leaves the ferry line. |
| **Return** | Rimeholt (Act III beat 10) | Comes back with a **bench she trained herself** and Sootling riding her shoulder. She has cut her ponytail. She **asks Sorrel to read Sootling's next Shift and lets it land.** |
| **Final match** | Foot of Shardcrown (Act IV beat 14) | Fields a **balanced six**. Her old Sootling has Shifted twice more, and its Heartmark has not moved. **Win or lose, she hands Sorrel the Gnash disc**: a bite that strips one Afterimage per hit. |

### Battle progression

| Phase | Team | Rules |
|---|---|---|
| Dock (Act I) | Starter -> Caldermaw at Lv5 on a posted Forecast | Scripted 'hold out 3 turns'; happens on every dial; story continues on any result |
| Brackenford rematch onward | Levels and supporting creatures follow the **Chaos dial** | Player must win the rematch to proceed ('First Steps') |
| Act I | Everything runs through Caldermaw; she never switches | One-carry team |
| Act II | **Sootling alone**, then she vanishes from the ferry line | |
| Acts III-IV | A **balanced six led by her old Sootling**, which has Shifted twice more outside battle | **No single carry to target**, which tests the Relay Spire's lesson |

Design purpose: her arc **teaches the bench and the theme without a tutorial box**. The game shows the cost of one carry on the rival before it asks the player to fix it.

---

## 11. Champion: Idris Fenwake and Vesperay

| Field | Detail |
|---|---|
| Name | **Idris Fenwake** |
| Title | Champion of the Summit at Shardcrown |
| History | Was a boy when the Vagary broke. His **first partner, born before the Starfall, had no Heartmark**; it Shifted in the first wild year and never knew him again. When **Vesperay hatched he anchored it the same day** and set his **anchor ring on its tail** (around the base of its tail). Later he and Corin **set the eight Spire tests** so islanders would learn to read Shifts, and **he never applied that lesson to himself**. |
| Personality | Courteous, precise and patient. Speaks slowly and listens longer. Kind to every challenger. **Carries a fear he has never named out loud.** |
| Student | **Seraphine Locke** (7th Spire) is his former student; she built the Mirror Spire to teach challengers how to beat his style |
| Replaces | Wallace |

### Arc

1. Watches the Mirror Spire from the gallery (Act III beat 10) and tells Sorrel why Vesperay wears his anchor ring.
2. Seraphine tells him, in front of Sorrel, to let Vesperay go.
3. After the Champion fight (Act IV beat 16) **he unhooks his anchor clasp. The ring on Vesperay's tail cracks, its Heartmark flares, and it Shifts for the first time. The Heartmark holds.**
4. Post-game: travels the ring and offers rematches with whatever form Vesperay has become (Vesperay now Shifts on its own Forecast; his ace's form can change between rematches).

### Vesperay (the ace)

| Field | Detail |
|---|---|
| Look | A **navy-blue manta ray** with a pale underside, an **ice-blue eye panel**, a **white hooked crest** and a **beaded tail**. Wears Idris's anchor ring around the base of its tail until the ending. |
| Role | The **evasion-and-recovery tank** |
| Kit | **Afterimage** (raises evasion and adds a visible copy; **two at most**, each drawn); a **heal that spends one of its 3 Mends** (shown as pips); a **guard that cannot repeat**; **one strong attack**. The creatures section of the pitch owns the numbers. |
| Built from | Wallace's Lv56 Latias (Double Team + Recover + Protect) |

### Idris's full team

- The rest of his team is **anchored**, and each member tests one Spire lesson:
  - a **Ward** creature,
  - a **Hollow** creature,
  - a **weather setter**,
  - a **fast hitter that punishes a one-carry team**.
- Style: **stall and evasion**.

### Counterplay set up earlier in the story

| Counter | Source | Effect |
|---|---|---|
| **Plumbline** disc | 7th Spire (Seraphine) | Always hits, clears the target's stat stages, blocks re-boosting for 2 turns |
| True-odds readout | 7th Spire | Move menu shows true hit odds |
| **Scouting Prism** | 3rd Spire (Dov Lattimer) | Shows Vesperay's moves, held item and remaining Mends |
| Coverage | 5th Spire (Ambrose Teague) | One of three coverage discs; 'No effect' marks |
| PP budget | 8th Spire (Hollis Brandt) | Arrive with PP left; Ration Ledger |
| **Gnash** disc | Linnet, at the Shardcrown gate | Strips one Afterimage per hit |

---

## 12. Mentor: Corin Vale

| Field | Detail |
|---|---|
| Name | **Corin Vale** |
| Role | Master Shiftreader who recruits Sorrel; eyes are failing; can no longer read large Shifts |
| Personality | Dry, distracted and warm in short bursts. **Answers questions with questions. Leaves before goodbyes.** |
| Partner | An **owl** |
| Replaces | Steven (wandering expert at key story points) combined with Professor Birch's starter handoff |

### Arc: handing the job to Sorrel

| Act | Hand-off |
|---|---|
| I | Steps off Maud's ferry in Pellwick to test new Shiftreaders; gives Sorrel the **Reading Glass**; oversees starter pick and naming |
| II | Teaches **fair capture with the Lantern** and **Capture Stance** when the first Errant appears on Emberstep; explains that one-of-a-kind items need a confirm when handing over the sure-catch Lantern |
| III | **Cannot read a shard that large** and sends Sorrel up the sea stack alone |
| Post-game | Admits they set the Spire tests with Idris and **asks Sorrel to design the ninth Spire** |

### Battles

- **One optional exhibition battle per act.**
- Corin's owl partner runs **one scripted Shift per match with its Forecast posted**, and Corin **reads the odds aloud as a live tutorial**.

---

## 13. Faction heads

### 13.1 Provost Agathe Merrow (Head of the Mooring)

| Field | Detail |
|---|---|
| Name | **Provost Agathe Merrow** |
| Personality | Formal, tired and exact. **Trusts rules because rules saved people. Admits mistakes in writing and rarely out loud.** |
| Wound | Lost her harbor on the **Night of Wrong Shapes** |
| Signature item | Keeps a **mourning band** (still wears it in the post-game) |
| Replaces | Maxie and Team Magma, and Maxie's Wonder Guard Masquerain |

Arc:

1. Starts sure the Sinking is the only safe answer.
2. **Act I** shows her at her best, running the clinic during the quarry bloom on Cairnhold; shows Sorrel the memorial to the Night of Wrong Shapes.
3. **Act II** shows the cost of her anchor licenses (the anchor office turns away a fisher who cannot pay; she offers Linnet an anchor stone at the fair).
4. **Act III**: fights Sorrel at the Sinking Engine; **halts the Engine when she learns Sorrel is on the Heartshard**.
5. **Post-game**: runs her clinics on the tide table, asks Sorrel to train clinic readers, keeps the mourning band.

Battle (fought once, at the Sinking Engine, Act III beat 11):

- Her team is **anchored**.
- Her **Anchor Pulse** blocks Shifts on her own team and shuts down the Scatter's forced Shifts, so the fight is **slow and fully predictable**.
- Her **ace is a Ward creature with the shimmer tell**.

### 13.2 Teo Varga (Organizer of the Scatter)

| Field | Detail |
|---|---|
| Name | **Teo Varga** |
| Role | Organizer of the Scatter and voice of the Carnival Raft; **used to work in a Mooring lab** |
| Personality | Fast-talking, funny and angry underneath. **Fixes things with his hands while he argues. Remembers every fisher's name.** |
| Replaces | Archie and Team Aqua (the second half of the near-identical villain plot) |

Arc:

1. Starts as the Seeding's loudest backer.
2. **Act II**: hires Sorrel to call odds at a Shift fair in Saltreach; Drownwood shows his point (only Shifted swimmers survive the tide) and the cruelty of his own Shift fairs; offers Linnet Starsalt after her fall.
3. **Act III**: his crew's charges nearly crack the Heartshard with Sorrel on it, and **he helps Linnet and Tobin pull them**.
4. **Post-game**: the Raft becomes a **low-cost Starsalt clinic** for fishers who cannot pay for anchor stones.

Battle:

- **High variance.** He spends Starsalt to **force Shifts on his own creatures, never on yours**, and **every forced Shift posts its Forecast first**.
- **Some land Down, and those help you.**

---

## 14. Friend: Tobin Marsh and Rillfin

| Field | Detail |
|---|---|
| Name | **Tobin Marsh** |
| Home | **Knapp's End**, Cairnhold |
| Personality | Shy, careful and brave in short bursts. **Talks to Rillfin more than to people.** |
| Companion | **Rillfin** |
| Replaces | Wally (catches his first creature with the player's help and returns strong at Victory Road) |

Arc:

| Act | Event |
|---|---|
| I (beat 4, quarry bloom) | **Rillfin Shifts into a gill-breather that cannot leave water.** His family wants it anchored. Tobin **carries it in a water pack** instead and learns its Forecast with Sorrel's help. |
| III (beat 11) | Helps pull the Scatter's charges with Linnet (Varga helps them). |
| IV (beat 13) | **Waits halfway along the Causeway** with Rillfin in a **form that walks and swims**, and gives Sorrel **the hardest battle on the Causeway**. |

Battles:

- **Acts I-II**: one fragile creature and support moves.
- **Act IV**: a tight **three-creature team built around Rillfin**, which runs **one scripted Shift in battle with the Forecast posted a turn ahead**. Like every Shift, the new form is permanent.

---

## 15. Spire leaders

### 15.1 Maud Tallis (1st, Turn Spire, Brackenford, Lowmoor)

| Field | Detail |
|---|---|
| Role | Ferry pilot of the ring line; Spire leader of the Turn Spire |
| Personality | Gruff, patient and hard to impress. **Has seen every kind of Shift and still likes creatures.** |
| Arc | Carries Sorrel around the ring; tells them to come back stronger after the dock battle; runs the 1st Spire; **retires after the Summit and hands the ferry wheel to Linnet** in the epilogue |
| Battle | **Two creatures, each running one scripted Shift with its Forecast posted a turn ahead.** Before the battle she walks Sorrel through **Reroll** at her practice table with **no time pressure** and hands over the **first Starsalt**. |
| Replaces | Mr. Briney (her ferry always confirms the destination) and Roxanne |

### 15.2 Osric Penhallow (2nd, Ward Spire, Knapp's End, Cairnhold)

| Field | Detail |
|---|---|
| Role | Stonemason; Spire leader of the Ward Spire |
| Personality | Blunt and literal. **Respects anyone who checks before swinging.** |
| Arc | Distrusts Shiftreaders at first and thinks a strong arm beats a good eye. His own sentinels prove otherwise. After his Spire he **carves a public Ward chart into the quarry wall**. |
| Battle | **Stone sentinels**, each with one **Ward**, the hex-lattice shimmer tell (replays about every 4 seconds) and a **'Ward ?' badge** (on **Freefall** the badge shows only after the first blocked hit). After any blocked hit, the readout lists which of the party's techniques can land. **Crackdust** is in stock at the Knapp's End Shelter, priced below one route trainer's payout. |
| Replaces | The Rustboro gym trainer's Wonder Guard Metagross |

### 15.3 Dov Lattimer (3rd, Disc Spire, Saltreach)

| Field | Detail |
|---|---|
| Role | Market auctioneer; Spire leader of the Disc Spire |
| Personality | Not specified in source beyond role |
| Battle / format | The Spire is a **sealed-crate draft** |
| Rule made visible | **Every disc fits someone**: the seed rolls every disc's technique at new game, and every disc is learnable by at least one creature you own. Shops show a disc's technique and learners before you pay. |
| Reward | Disc badge and the **Scouting Prism** |

### 15.4 Ines Calloway (4th, Weather Spire, Sulphur Cross, Emberstep)

| Field | Detail |
|---|---|
| Role | Spa owner; Spire leader of the Weather Spire |
| Personality | Not specified in source beyond role |
| Battle | The arena changes weather on a **posted three-turn forecast** (estimate): **steam, ash, squall, clear**. The HUD states each weather's effect on accuracy and types. |
| Reward | Weather badge and the **Weatherglass** |

### 15.5 Ambrose Teague (5th, Hollow Spire, Mossgate, Drownwood)

| Field | Detail |
|---|---|
| Role | Boatwright; Spire leader of the Hollow Spire |
| Personality | Not specified in source beyond role |
| Battle | Fields **only Hollow creatures**; Hollow is **immune to Plain and Grit**. The move menu marks immune matchups **'No effect'** before you pick. |
| Reward | Hollow badge and **one of three coverage discs, shown face-up** |

### 15.6 Ada and Ivo Halloran (6th, Relay Spire, Windle, Thistlewind)

| Field | Detail |
|---|---|
| Role | Windmill twins; Spire leaders of the Relay Spire |
| Story | During the Surge (Act III beat 9) Sorrel and the twins clear Windle in back-to-back double battles before the Spire |
| Battle | **Each of your creatures must fight in one round, with no repeats.** The last round is a **double battle against both twins**, so your final two creatures fight it together. In doubles, the default target is the foe your chosen move hits hardest, and ties go left. |
| Teaching | Bench growth. **Bench EXP has been on since the first route: every party member that sits out earns 60%.** The twins show Sorrel why the bench has kept pace and how to use it. |
| Reward | Relay badge and the **Training Yard** at every Shelter (stored creatures earn a share of party EXP) |
| Replaces | Tate & Liza |

### 15.7 Seraphine Locke (7th, Mirror Spire, Frostwick, Rimeholt)

| Field | Detail |
|---|---|
| Role | Ice-cave guide; Spire leader of the Mirror Spire; **Idris's former student** |
| Personality | Cool, precise and a natural teacher. **Enjoys being figured out.** |
| Arc | **Built the Mirror Spire to teach challengers how to beat her old teacher's style.** Hands Sorrel the Plumbline disc and tells Idris, in front of Sorrel, that he should let Vesperay go. |
| Battle | **Evasion stall.** Her creatures stack **Afterimages** (two at most, each drawn on screen) and heal from a budget of **3 Mends** shown as pips. The move menu shows true hit odds. Her **mirror-ice arena reflects attacks only on a posted pattern**. |
| Reward | Mirror badge and the **Plumbline** disc (always hits, clears the target's stat stages, blocks re-boosting for 2 turns) |
| Audience | **Champion Idris watches this Spire from the gallery** |
| Replaces | Juan (Lv46 Banette with Double Team, Rest, Ice Beam) |

### 15.8 Hollis Brandt (8th, Long Road Spire, Starfall Causeway)

| Field | Detail |
|---|---|
| Role | Retired Mooring quartermaster; Spire leader of the Long Road Spire; keeps the **Summit Purse ledger** |
| Pronoun | She |
| Personality | Practical, wry and **allergic to waste** |
| Arc | Ran relief supplies after the Night of Wrong Shapes and **left the Mooring over the license fees**. Teaches Sorrel to budget for the Summit. In the post-game she **quietly funds the Raft's Starsalt clinic**. |
| Battle | Her Spire is the **Causeway gauntlet** (a trainer gauntlet between two Shelters). Her own battle is short: **one high-defense creature and a full item bag**. **You win if you arrive with PP left.** |
| Reward | Long Road badge and the **Ration Ledger** (pre-Summit checklist) |
| Replaces | Victory Road and the League economy |

---

## 16. Summit Keepers

Each Keeper remixes two Spires. Fought back to back after Linnet's gate match. Opponent teams stay fixed between attempts. The Summit gate posts a dossier for every Keeper and the Champion.

| Order | Keeper | Remix | Team | Notes | Emerald homage |
|---|---|---|---|---|---|
| 1 | **Odile Strand** | Ward + Disc | Ward creatures with odd coverage | | Glacia's Wonder Guard Beautifly (drained every Revive in run 6) |
| 2 | **Bastien Kell** | Hollow + Long Road | Hollow creatures (immune to Plain and Grit) backed by healing items; the Scouting Prism shows his heal pips so the player can count his heals | Slow, polite and immovable. **Former salvage diver.** Small arc: after Sorrel beats him, he admits he is there to check that challengers learned the Hollow and Long Road Spires, and **shows Sorrel his own Shiftlog**. | Drake (Lv53 Dusclops kept alive with Full Restores ended runs 1, 2, 3; Shiftry ended run 7) |
| 3 | **Mirren Hale** | Turn + Relay | A **doubles team whose own creatures run scripted Shifts**, each with a posted Forecast | | |
| 4 | **Cass Rune** | Weather + Mirror | **Weather that feeds evasion**, still capped at +2 | | |

---

## 17. The eight Spires

Spires replace gyms. Each Spire leader certifies one Shiftreader skill: reading one kind of chaos. Each Spire ends in a battle that uses the chaos it taught. **The leader's full roster is posted at the door. Every win pays a badge.** Eight badges open the Summit gate.

### 17.1 Summary table

| # | Spire | Island (town) | Leader | Chaos taught | Badge | Other reward / unlock |
|---|---|---|---|---|---|---|
| 1 | **Turn Spire** | Lowmoor (Brackenford) | **Maud Tallis**, ferry pilot | Form Shifts | Turn badge | **Reroll** (and the first Starsalt) |
| 2 | **Ward Spire** | Cairnhold (Knapp's End) | **Osric Penhallow**, stonemason | Hidden abilities (Wards) | Ward badge | **Skiff returns between visited Waystones** |
| 3 | **Disc Spire** | Saltreach | **Dov Lattimer**, market auctioneer | Random technique discs and items | Disc badge | **Scouting Prism** (adds moves, held items, heal pips to Read) |
| 4 | **Weather Spire** | Emberstep (Sulphur Cross) | **Ines Calloway**, spa owner | Weather | Weather badge | **Weatherglass** (island weather + next change on the sea chart) |
| 5 | **Hollow Spire** | Drownwood (Mossgate) | **Ambrose Teague**, boatwright | Immunities | Hollow badge | **One of three coverage discs, shown face-up** |
| 6 | **Relay Spire** | Thistlewind (Windle) | **Ada and Ivo Halloran**, windmill twins | The one-carry team | Relay badge | **Training Yard** at every Shelter |
| 7 | **Mirror Spire** | Rimeholt (Frostwick) | **Seraphine Locke**, ice-cave guide | Evasion and stall | Mirror badge | **Plumbline** disc |
| 8 | **Long Road Spire** | Starfall Causeway | **Hollis Brandt**, retired quartermaster | Attrition | Long Road badge | **Ration Ledger** (pre-Summit checklist) |

### 17.2 Per-Spire detail

**1. The Turn Spire**
- Sorrel already met the Forecast on the road (Act I beat 3) with **Accept** and **Anchor**. Maud adds **Reroll**.
- At her practice table Sorrel rerolls a sample Forecast **with no clock**, and Maud hands over the first Starsalt.
- Battle: Maud's own two creatures each run one scripted Shift, each posting its Forecast a turn ahead.

**2. The Ward Spire**
- Each of Osric's stone sentinels carries a **Ward**, an ability that blocks most hits.
- A Ward shows a **hex-lattice shimmer that replays about every 4 seconds**, plus a **'Ward ?' badge**. On **Freefall** the badge appears only after the first blocked hit.
- After a blocked hit, the readout lists which of the party's techniques can land.
- The Knapp's End Shelter stocks **Crackdust** before the Spire, priced below one route trainer's payout.
- The seed **guarantees one chip-damage disc (poison or trap) by badge 1**.
- Reward unlock: skiff returns between visited Waystones.

**3. The Disc Spire**
- A **sealed-crate draft**.
- The seed rolls every disc's technique at new game, and **every disc is learnable by at least one creature you own**.
- Shops show a disc's technique and learners before you pay.

**4. The Weather Spire**
- Arena weather changes on a **posted three-turn forecast** (estimate): **steam, ash, squall, clear**.
- The HUD states each weather's effect on accuracy and types.

**5. The Hollow Spire**
- Ambrose fields only **Hollow** creatures; Hollow is **immune to Plain and Grit**.
- The move menu marks immune matchups **'No effect'** before you pick.
- Hollow's immunity is the type chart's one deliberate homage to the Machoke/Ghost wall from the run.

**6. The Relay Spire**
- Each of your creatures must fight in one round, with no repeats. Last round is a double battle against both twins.
- Bench EXP has been on since the first route: **every party member that sits out earns 60%**.
- Doubles default target: the foe your chosen move hits hardest; ties go left.
- Reward: Training Yard at every Shelter, where stored creatures earn a share of party EXP.

**7. The Mirror Spire**
- Seraphine's creatures stack Afterimages and heal.
- **Evasion caps at +2**, so a creature never shows more than two Afterimages, and each one is drawn on screen.
- Each creature heals from a budget of **3 Mends** shown as pips.
- The move menu shows **true hit odds**.
- **Plumbline**: always hits, clears the target's stat stages, blocks re-boosting for 2 turns.
- Champion Idris watches from the gallery.

**8. The Long Road Spire**
- The Causeway is a **trainer gauntlet between two Shelters**.
- The HUD tracks **total team PP and a supply budget**; Ethers have been in Shelter stock since badge 3.
- Hollis's own battle is short; the test is what you have left.
- **Tide pools beside the road let a bench catch up fast.**
- **Summit Purse**: since badge 5 the Purse has taken a fixed deposit at every badge (**1,500 glint, estimate**), shown on the badge screen, and it opens at the Summit gate. Hollis keeps the ledger.

### 17.3 Badge-gated unlock timeline

| Badge | Unlock |
|---|---|
| 1 (Turn) | Reroll; seed guarantees one chip-damage disc (poison or trap) by now |
| 2 (Ward) | Skiff returns between visited Waystones |
| 3 (Disc) | Scouting Prism; Ethers in Shelter stock from here |
| 4 (Weather) | Weatherglass on the sea chart |
| 5 (Hollow) | One coverage disc; Summit Purse deposits begin (1,500 glint est. per badge from here) |
| 6 (Relay) | Training Yard at every Shelter |
| 7 (Mirror) | Plumbline disc |
| 8 (Long Road) | Ration Ledger; Summit gate opens; Summit Purse opens |

---

## 18. Act structure: four acts, sixteen beats

The critical path never sends the player back to an earlier island.

### Act I: The Turn (Lowmoor, Cairnhold)

| Beat | Title | Location | Content | Systems taught |
|---|---|---|---|---|
| 1 | **Ferry Day** | Pellwick, Lowmoor | Corin Vale steps off Maud's ferry to test new Shiftreaders. Sorrel picks a starter and names it, and **its Heartmark lights magenta on the name**. | Starter pick, naming, Heartmark |
| 2 | **The dock battle** | Pellwick dock | As the fight opens, Linnet's starter Shifts into a **Lv5 Caldermaw** on a posted Forecast. Sorrel has to **hold out for 3 turns**, and the story continues on any result. The journal stamps **'Identity Crisis'**. | First Forecast seen (on another's creature); battle basics; protected first session |
| 3 | **Sorrel's first Forecast** | Road to Brackenford; Brackenford | Sorrel's starter glows and the **Forecast screen appears with Accept and Anchor**. Sorrel wins the rematch (journal stamps **'First Steps'**) and clears the **Turn Spire**, which adds **Reroll**. | Forecast, Accept, Anchor, Reroll |
| 4 | **The quarry bloom** | Cairnhold | A skyglass seam cracks and creatures around the quarry Shift in a wave. Sorrel reads the Shifts of the clinic's patients for the **Mooring nurses**. **Merrow shows Sorrel the memorial to the Night of Wrong Shapes.** Tobin's companion **Rillfin Shifts into a gill-breather that cannot leave water.** The **Ward Spire**. | Reading for NPCs; Wards; Crackdust |

### Act II: The Odds (Saltreach, Emberstep, Drownwood)

| Beat | Title | Location | Content | Systems taught |
|---|---|---|---|---|
| 5 | **The market** | Saltreach | The **Disc Spire**. The **Carnival Raft** docks, and **Teo Varga hires Sorrel to call odds at a Shift fair**. Sorrel watches the anchor office **turn away a fisher who cannot pay**. | Discs; Scouting Prism; faction economics |
| 6 | **Linnet's fall** | Saltreach fair | **Caldermaw Shifts down into Sootling** in front of the fair crowd. Linnet refuses both factions' offers and leaves. | Down Shifts; the cost of one carry |
| 7 | **An Errant on the road** | Emberstep's slopes | An **Errant**, a roaming great creature, wanders a normal route. **Corin teaches fair capture with the Lantern**: you raise it, its light draws the creature in, and a **three-segment glow meter** fills. Nothing is thrown. **Capture Stance** is a toggle that keeps your damage from dropping a wild creature below 1 HP and uses no move slot. Capture odds show before you spend a Lantern, and any one-of-a-kind item asks for a confirm. The **Weather Spire**. | Capture; Capture Stance; Lantern; weather |
| 8 | **The drowning street** | Mossgate, Drownwood | The sea takes another street of Mossgate. Sorrel helps Scatter volunteers move a stranded herd, and **only the Shifted swimmers survive the tide**. The same week a **Mooring Anchor Pulse misfires and freezes a herd mid-Shift**. Sorrel sees the Scatter's point and the Mooring's cost on one island. The **Hollow Spire**. | Immunities; both factions' costs |

### Act III: The Surge (Thistlewind, Rimeholt, the sea stack)

| Beat | Title | Location | Content | Systems taught |
|---|---|---|---|---|
| 9 | **The Surge** | Windle, Thistlewind | The Vagary is swinging back on its orbit, and the Heartshard it carries wakes. **Wild creatures Shift faster on every island.** In Windle a whole street of creatures Shifts in one night. Sorrel and the **Halloran twins** clear the town in **back-to-back double battles**. Then the **Relay Spire**. | Doubles; bench; Training Yard |
| 10 | **The mirror** | Frostwick, Rimeholt | The **Mirror Spire**. **Idris watches from the gallery** and tells Sorrel why Vesperay wears his anchor ring. **Seraphine, his former student, tells him in front of Sorrel to let Vesperay go.** **Linnet returns** with a full bench and Sootling on her shoulder, and asks Sorrel to read its next Shift. | Evasion/stall; Plumbline; true odds |
| 11 | **Two plans, one night** | Sea stack off Rimeholt | The Vagary makes its low pass, and its tail brushes the sea stack. For one night the Heartshard can be reached from the top of the stack. **Merrow's Sinking Engine** is bolted to the rock with its tether ready. **Varga's crew rigs the Heartshard for the Seeding.** **Sorrel fights Merrow at the Engine.** Corin cannot read a shard that large and sends Sorrel up alone. **Linnet and Tobin pull the Raft's charges, and Varga helps them.** **Merrow halts the Engine when she learns Sorrel is on the shard.** | Merrow boss fight (anchored, Anchor Pulse, Ward ace) |
| 12 | **Vagary** | Top of the sea stack | The comet carries a passenger: the creature islanders also call **Vagary**. Seven-phase fight (see section 19). Ends when Sorrel **accepts** its final Forecast. Vagary settles into its **ring form**, the Heartshard steadies, and Shifts across the isles follow a **tide table** tied to the comet's orbit that anyone with a Reading Glass can check. **Merrow gets forecasts for her clinics. Varga gets legal seed lockers. Neither gets everything.** The Vagary climbs away with the Heartshard and stays in the night sky. | The Forecast as a boss; the thematic choice |

### Act IV: The Summit (Starfall Causeway, Shardcrown)

| Beat | Title | Location | Content | Systems taught |
|---|---|---|---|---|
| 13 | **The Long Road** | Starfall Causeway | The **Long Road Spire**. **Tobin waits halfway** with Rillfin in a form that walks and swims, and gives Sorrel the hardest battle on the Causeway. | Attrition; PP budget; Summit Purse |
| 14 | **The gate** | Foot of Shardcrown | **Linnet's final match.** Win or lose, she hands over the **Gnash disc**. | Balanced-six opponent; Gnash |
| 15 | **The Summit Keepers** | Shardcrown | **Four Keepers, back to back**, each a remix of two Spires. On Drift and Flux, the **Summit Bell** over the gate remembers each challenger once. | Everything, remixed |
| 16 | **The Champion** | Shardcrown | **Idris and Vesperay.** After the fight Idris unhooks his anchor clasp. The ring on Vesperay's tail cracks, its Heartmark flares, and it **Shifts for the first time. The Heartmark holds.** The **Seed Card prints every party member's Shiftlog.** | Final test; theme as cutscene |

---

## 19. The Vagary boss fight (Act III beat 12)

| Rule | Detail |
|---|---|
| Who | **Vagary**, the creature carried by the comet |
| Where | Top of the sea stack off Rimeholt's north shore |
| Structure | **Seven phases.** Vagary **Shifts between phases**, and **each phase posts the Forecast for the next**. These are the boss's own scripted Shifts. |
| Why seven | The seven phases **echo MUDDY's seven forms** |
| Final phase | **Vagary's Forecast is offered to Sorrel**: **Anchor** it (the Mooring's way), **Reroll** it (the Scatter's way) or **Accept** it. **Anchor and Reroll keep the fight going. It ends when Sorrel accepts.** |
| Resolution | Vagary settles into its **ring form**; the Heartshard steadies; Shifts follow a tide table tied to the comet's orbit |
| Post-game | While the comet stays close, Vagary returns to **perch on the Rimeholt sea stack and can be caught**. Capture odds show every turn. The one sure-catch Lantern asks for a confirm before use. |

This fight is **"the theme as a boss"** (the Champion's anchor release is "the theme as a cutscene").

---

## 20. The Summit, the Summit Bell and the Champion fight

### 20.1 The Summit

- **Shardcrown** sits on the central atoll, and the Summit is its arena.
- Its **four Summit Keepers** and the **Champion** test everything the Spires taught, back to back.
- **Opponent teams stay fixed between attempts**, so each loss teaches something usable next time.
- **The Summit gate posts a dossier for every Keeper and the Champion.** Read shows each roster, and the Scouting Prism adds moves, held items and heal pips.
- **Summit losses cost no glint.**
- The **Summit Purse** (deposits from badge 5, 1,500 glint est. each) opens at the Summit gate.

### 20.2 The Summit Bell

| Dial | Behavior |
|---|---|
| **Drift** | The Bell hangs over Idris's gate and remembers a challenger once: after a loss, **the next attempt starts at the Keeper who beat you** |
| **Flux** | Same as Drift |
| **Freefall** | **The Bell stays silent and every attempt starts from the first Keeper** |

### 20.3 Order of battles at the Summit

1. Linnet's gate match (beat 14, before the Summit proper)
2. Odile Strand (Ward + Disc)
3. Bastien Kell (Hollow + Long Road)
4. Mirren Hale (Turn + Relay)
5. Cass Rune (Weather + Mirror)
6. Champion Idris Fenwake (Vesperay + Ward, Hollow, weather setter, fast hitter)

### 20.4 Champion fight resolution

- After the fight, Idris unhooks his anchor clasp.
- The ring on Vesperay's tail cracks, its Heartmark flares, and it Shifts for the first time. **The Heartmark holds.**
- The **Seed Card** prints every party member's Shiftlog.
- Credits roll.

---

## 21. Post-game

Credits roll after the Champion. The world stays open, and the Vagary hangs in the night sky.

| Feature | Detail |
|---|---|
| **The Vagary's long pass** | The comet stays close after the credits. **Errants roam at higher levels and new skyglass seams open on every island.** Errants keep the wandering-legendary surprise and add a **sighting log**. **A KO'd Errant returns after the next badge or 2 hours of play, whichever comes first.** **Star-touched forms stay rare (about 2% on every dial).** |
| **Vagary** | While the comet stays close, Vagary returns to perch on the Rimeholt sea stack and **can be caught**. Capture odds show every turn. The one **sure-catch Lantern asks for a confirm** before use. |
| **Rematches by board** | Spire leaders post rematch offers on the **Rematch board at every Shelter**. **No calls interrupt travel.** **Rematch-board EXP is damped once a creature passes 10 levels over the curve.** |
| **Faction epilogues** | **Merrow's** clinics run on the tide table, and she asks Sorrel to train clinic readers. **Varga's** Raft becomes a low-cost Starsalt clinic for fishers who cannot pay for anchor stones. **Each gets a short quest line.** |
| **Idris and Vesperay** | Vesperay now Shifts on its own Forecast. Idris travels the ring and offers rematches, and his ace's form can change between them. |
| **Seeds and the Seed Card** | Every save has a **shareable seed code**, so friends can race the same isles. The Chaos dial (**Drift, Flux, Freefall or Custom**) is chosen at new game, and **nothing is locked behind a finished run**. The dial can change at any Shelter, but a **mid-run change marks the Seed Card 'not race-eligible'**. |
| **The Field Log** | Filling it (**Seen, Read, Held**) is the long-tail goal. |
| **The ninth Spire** | Corin asks Sorrel to design one. It is a **rotating challenge built from the player's own seed**. |
| **No Rewind** | The run's no-reload rule lives on as the **No Rewind challenge mode** (owned by the gameplay section). |
| Epilogue cast beats | Maud retires and hands the ferry wheel to Linnet. Hollis quietly funds the Raft's Starsalt clinic. Merrow keeps the mourning band. Corin admits setting the Spire tests with Idris. |

---

## 22. How story and systems reinforce each other

Every system has an owner in the world, and every story beat teaches a system.

| System | In-world owner / fiction | Story delivery |
|---|---|---|
| **Shift Forecast** | The Reading Glass. **Accept** is Sorrel's own call. **Anchor** spends a Mooring stone. **Reroll** spends the Scatter's Starsalt. | Each Shift is a small vote between the factions. NPCs remark on how often you anchor or reroll. **No meter scores it.** |
| **Readable chaos** | The Shiftreader's craft. The **Ward shimmer**, the **'No effect' marks** and the **drawn Afterimages** are things a trained reader sees. | The **2nd, 5th and 7th Spires** teach them in that order, and the **Champion fight tests all three**. |
| **No soft-locks** | The Reading Glass **greys out empty techniques** so they cannot be chosen; a creature with every move empty uses **Scrap**. The journal **stamps each save and shows a check when the save verifies**. **One-of-a-kind items need a confirm**, which Corin explains when handing over the sure-catch Lantern. | |
| **Bench growth** | The **Relay Spire** and **Linnet's whole arc**. | The game shows the cost of one carry on the rival before it asks the player to fix it. |
| **Random but usable discs** | The **Saltreach market**. | Lattimer's Spire makes the rule visible: **every disc fits someone**. |
| **Wild legendaries** | **Errants.** | Corin teaches **Capture Stance** in Act II when the first one appears. |
| **The Chaos dial** | **Drift, Flux or Freefall, plus Custom**, all open at new game. Freefall approximates the Chaos V2 run; its exact odds are `[NEED SOURCE]` until someone measures them from the logged evolutions. Every seed has a code and ends in a Seed Card. | |
| **The Summit Bell** | Gives the Summit checkpoint a reason to exist in the world. | |
| **The Heartmark** | Ties all of it to the theme. | **The Vagary fight is the theme as a boss, and the Champion's anchor release is the theme as a cutscene.** |

**Script-wide rule: the story never asks the player to read something the UI has not shown.**

### Per-dial story differences referenced in this section

| Element | Drift | Flux | Freefall | All dials |
|---|---|---|---|---|
| Linnet's dock Shift into Lv5 Caldermaw | scripted | scripted | scripted | Happens on every dial |
| Linnet's rematch levels and supporting creatures | follow dial | follow dial | follow dial | |
| 'Ward ?' badge | shown before first hit | shown before first hit | **only after the first blocked hit** | |
| Summit Bell | remembers once | remembers once | **silent; restart from first Keeper** | |
| Star-touched forms | ~2% | ~2% | ~2% | Same on every dial |
| Custom | Player-configured | | | |

---

## 23. Dialogue and voice notes per character

The source gives personality sketches rather than scripted lines. The quoted phrases below are the only literal in-world strings given in the section; everything else is a voice brief for writers.

### Literal strings in the source

| String | Context |
|---|---|
| **'Identity Crisis'** | Journal stamp after the dock battle |
| **'First Steps'** | Journal stamp after the Brackenford rematch |
| **'hold out 3 turns'** | The dock battle's scripted scene type |
| **'Ward ?'** | The Ward badge label on an unidentified Ward |
| **'No effect'** | Move-menu marker for an immune matchup |
| **'not race-eligible'** | Seed Card marker after a mid-run dial change |
| "come back stronger" | Maud's instruction to Sorrel after the dock battle (paraphrased in source as: Maud tells Sorrel to come back stronger) |
| **Up / Side / Down** | The three Forecast cards |
| **Seen / Read / Held** | Field Log columns |
| **steam, ash, squall, clear** | Weather Spire states |

### Voice briefs

| Character | Voice |
|---|---|
| **Sorrel** | Short choices; says what they see; dry humor in journal entries only |
| **Linnet Rask** | Loud, quick; generous once she respects you; bristles at pity; "first at everything" |
| **Idris Fenwake** | Courteous, precise, patient; speaks slowly, listens longer; kind to every challenger; an unnamed fear underneath |
| **Corin Vale** | Dry, distracted, warm in short bursts; answers questions with questions; leaves before goodbyes; reads odds aloud in exhibition battles |
| **Provost Agathe Merrow** | Formal, tired, exact; trusts rules because rules saved people; admits mistakes in writing, rarely out loud |
| **Teo Varga** | Fast-talking, funny, angry underneath; fixes things with his hands while he argues; remembers every fisher's name |
| **Tobin Marsh** | Shy, careful, brave in short bursts; talks to Rillfin more than to people |
| **Maud Tallis** | Gruff, patient, hard to impress; has seen every kind of Shift and still likes creatures; always confirms the ferry destination |
| **Osric Penhallow** | Blunt and literal; respects anyone who checks before swinging |
| **Seraphine Locke** | Cool, precise, a natural teacher; enjoys being figured out |
| **Hollis Brandt** | Practical, wry, allergic to waste |
| **Bastien Kell** | Slow, polite, immovable; former salvage diver |
| **Dov Lattimer**, **Ines Calloway**, **Ambrose Teague**, **Ada and Ivo Halloran**, **Odile Strand**, **Mirren Hale**, **Cass Rune** | No personality brief in source; defined by role and Spire/Keeper mechanics only |

### Key scripted moments that need lines

1. Corin hands Sorrel the Reading Glass (beat 1).
2. Maud after the dock battle: come back stronger; rematch at Brackenford (beat 2).
3. Maud's practice-table Reroll walkthrough and first Starsalt (beat 3).
4. Merrow at the Night of Wrong Shapes memorial (beat 4).
5. Tobin's family wanting Rillfin anchored; Tobin choosing the water pack (beat 4).
6. Varga hiring Sorrel to call odds; the anchor office turning away a fisher (beat 5).
7. Merrow's anchor offer and Varga's Starsalt offer to Linnet; Linnet refusing both (beat 6).
8. Corin teaching the Lantern, Capture Stance, and the one-of-a-kind confirm (beat 7).
9. Scatter volunteers at the drowning street; the Anchor Pulse misfire (beat 8).
10. Idris in the gallery explaining the anchor ring; Seraphine telling him to let Vesperay go (beat 10).
11. Linnet asking Sorrel to read Sootling's next Shift (beat 10).
12. Merrow at the Sinking Engine; Corin sending Sorrel up alone; Merrow halting the Engine (beat 11).
13. Vagary's final Forecast offer: Anchor / Reroll / Accept (beat 12).
14. Tobin on the Causeway (beat 13).
15. Linnet handing over Gnash win or lose (beat 14).
16. Bastien Kell showing his own Shiftlog (beat 15).
17. Idris unhooking the clasp (beat 16).
18. Post-game: Corin asking for the ninth Spire; Merrow asking Sorrel to train clinic readers; Maud handing Linnet the wheel.

---

## 24. Emerald Chaos V2 "run roots" appendix

The pitch grounds most story and Spire choices in logged moments from a 45-hour Emerald Chaos V2 run played by screenshot. These are kept here because other sections of the pitch reference them and because they define the exact failure each design element answers.

| WILDSHIFT element | Run root |
|---|---|
| Linnet's dock fight / 'Identity Crisis' | The 'Identity Crisis' banner had already fired in Oldale; Claude lost to May's Lv5 Groudon, ground MUDDY to Lv11-12 and won the rematch |
| Linnet's fall (Caldermaw to Sootling) | Rayquaza Chaos-evolving into Trapinch at Lv34 |
| Linnet's one-carry Act I team | "everything except Machoke is ~30 levels under the curve" |
| Gnash disc | Run 8's Lv75 Seadra beat Latias with Bite x3, left at 11 HP |
| Idris / Vesperay | Wallace's Chaos team (Zubat 57, Latias 56, Walrein 56, Staryu 55, Electrode 56, Magnemite 58) ended League runs 4, 5 and 6; Latias used Double Team + Recover + Protect and OHKO'd Seadra, Hariyama, Rayquaza and Deoxys; Haze tried in run 5 and Latias re-boosted |
| Shift Forecast menu (untimed) | About 15 Chaos evolutions in 45 hours, refusable only by pressing B in a short window; Claude missed it at least three times (Flygon, the Heracross line, Rayquaza) |
| No level loss on Shift | Chaos evolutions re-read EXP on the new curve: a Lv19 Ludicolo became a Lv16 Rhydon; MUDDY went from Lv30 Altaria to Lv27 Gardevoir; MUDDY finished at Lv27, 46 levels behind Machoke (Lv73) |
| MUDDY's seven forms (Vagary's seven phases) | Mudkip; Swampert Lv16 (skipping Marshtomp); Machop Lv20; Wynaut (Fortree gym); Ludicolo Lv27; Altaria Lv30 (Mt Pyre); Gardevoir (Magma Hideout); as a Wynaut it kept Fly and Zap Cannon |
| The accidental hero | Wailmer Chaos-evolved into Seadra at Lv40; that Wailmer was a missed cancel from a Flygon caught at Lv7; Seadra solo-ground Victory Road Lv49 to Lv74 in two blocks (about 5 hours of edited video; about 50 grind rounds) |
| Ring layout, no backtracking | Lost time to Mt Pyre, then Magma Hideout, then Slateport harbor, then Aqua Hideout |
| Weather never hides tiles | Lavaridge fog, rain after Kyogre, dark caves needing Flash |
| Tree/grass silhouettes | Bushy trees near Mauville mistaken for grass |
| Dungeons keep puzzle progress | Mossdeep gym puzzle reset on exit |
| Ferry confirms destination | Mr. Briney's re-talk sailed Claude back by accident |
| Ward Spire | About ten Wonder Guard walls: Rustboro gym trainer's Metagross; Route 117 twins' Groudon (two losses); Route 120 Metagross wiped the team twice; Sand Tomb's trap damage was one of the few things that hurt it; the game named Wonder Guard only on the first blocked hit |
| Disc Spire | Shop TM38 bought for 5,500 was Constrict; TM30 was Lick and nobody could learn it; a Potion became Soda Pop; TM40 rolled Leaf Blade and gave Machoke an answer to Ghosts |
| Hollow Spire | Machoke carried with only Normal and Fighting moves; Brawly's Dusclops, Juan's Banette and Drake's Dusclops walled it |
| Relay Spire | Doubles cursor memory caused misinputs; Tate & Liza knocked out Machoke, Wailmer and Crobat |
| Mirror Spire | Juan took three tries because of his Lv46 Banette (Double Team, Rest, Ice Beam) |
| Long Road Spire / Summit Purse | Money spent to about zero on 6 Revives before League run 3; Glacia's Wonder Guard Beautifly drained every Revive in run 6; Machoke ran out of Leaf Blade PP at Drake in run 3; Machoke's Low Kick hit 0 PP on the way to Sky Pillar with no Ethers |
| Summit Bell | 8 League runs, 7 losses, each a full restart; Drake ended runs 1, 2, 3 and 7; Wallace ended 4, 5 and 6; run 8 won with no faints in the Elite Four |
| Merrow's Ward ace | Maxie's Wonder Guard Masquerain beat Claude once |
| Varga's Down Shifts helping you | Wailmer's Damp blocked a Regice's Explosion twice |
| Maud's Spire | Roxanne beaten first try; a Wonder Guard trainer inside her gym cost one loss |
| Tobin / Rillfin | Wally; MUDDY ended the run as a Gardevoir, from Wally's own line |
| Errants | Wandering legendaries on ordinary routes: Jirachi Lv25; Rayquaza at Lv15, 26 and 27; Regice; Kyogre Lv26; Victory Road Deoxys Lv36 and Groudon Lv40 |
| Capture Stance / Lantern confirm | Claude KO'd a wild Jirachi and a Rayquaza by accident; lost the Master Ball to bag cursor memory on a wild Lv26 Kyogre |
| Rematch board (no calls) | PokeNav rematch calls were constant |
| No soft-locks (Scrap, save check) | Five hard freezes, at least three right after a 0-PP move was selected; early saves failed silently after the PokeNav shifted the SAVE slot |
| No Rewind mode | No savestate reloads to undo outcomes; one crash backup load recovered saves that silently failed and also rewound one loss to Brawly (disclosed); every freeze recovered by resetting to the last in-game save |

---

## 25. Open items, estimates and unsourced values

| Item | Status in source |
|---|---|
| Time since the Starfall | "about 30 years, **estimate**" |
| Shifts per creature per run | "about three ... **estimate**, tied to the island level curve" |
| Weather Spire forecast length | "posted three-turn forecast (**estimate**)" |
| Summit Purse deposit | "1,500 glint, **estimate**" |
| Ward shimmer replay interval | "about every 4 seconds" |
| Star-touched form rate | "about 2% on every dial" |
| Freefall dial odds | "**[NEED SOURCE]** until someone measures them from the logged evolutions" |
| Vesperay's numbers | "The creatures section owns the numbers" |
| No Rewind mode rules | "owned by the gameplay section" |
| Personalities for Dov Lattimer, Ines Calloway, Ambrose Teague, the Hallorans, Odile Strand, Mirren Hale, Cass Rune | Not given in this section |
| Sorrel's parent's name | Not given |
| Corin's owl partner's name | Not given |
| Linnet's starter species before Caldermaw | Not given (only the post-Shift forms Caldermaw and Sootling are named) |
| Sorrel's starter choices other than Sloshkin | Not given in this section ("Sorrel picks a starter") |
