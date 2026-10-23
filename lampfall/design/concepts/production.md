# SALTLIGHT — a Keeper's season on the Brindle Isles

*Concept document, production-and-feasibility lens. Sized for a team of coding agents shipping vanilla JS + Canvas 2D + WebAudio with no assets and no build step. Every number here is a tunable constant that lives in a pure data module; every system named here has a test named in section 14.*

---

## 1. Title, tagline, pitch

**SALTLIGHT** (sub-title: *A Keeper's Season on the Brindle Isles*)

**Tagline:** *Relight the lamp. Read the dice. Someone lives here now.*

**Pitch.** You walk across a tidal causeway at dusk into Pellwick, a harbor town whose lighthouse has been dark since the night a comet broke over the islands thirty years ago. A beaver with a lantern hands you a lease card and an interest-free loan; a Sloshkin pops out of the sunset mud and picks you; an old Shiftreader hands you a brass Reading Glass and says "yours will glow soon." From then on the game runs on one accelerated day of twenty-four real minutes with two real low tides. By day you shake trees, dig the flats, fish the quay, pay Wren at the co-op yard (abacus, gnawed tally stick, THWAP) and watch the lighthouse scaffolding climb. By night the porches come on, Ludo buys anything, the mud glows cyan, and the wild creatures on the far isles Shift more freely. Your creatures Shift too, never in battle, always with the three-card Forecast (Up / Side / Down, odds first), and whatever body they land in, the magenta Heartmark on the same spot says it is still yours. Six Spires certify you as a reader; seven loans build the Lamp Room; the seventh payment relights the coast, steadies the dice, calls the fleet home, and lights the drowned causeway to the Summit where Idris Fenwake and the comet's passenger wait.

**Alternative titles:** *Wick & Vagary* · *Low Tide, Long Light* · *The Keeper of Pellwick Point*

---

## 2. The unifying fiction

**One night, one cause.** Thirty years ago the Vagary, a comet on a long orbit, broke apart over the Brindle Isles. Its head struck the sea and dug the Starfall Lagoon; its fragments fell as skyglass; its passenger, the creature islanders also call Vagary, has roamed the sky since. Porchlight's "Ebb winter" and Wildshift's "Night of Wrong Shapes" are **the same night, the Starfall**. The lagoon's blast shoved the sandbar up across Pellwick's harbor mouth; the oil boat could not cross it; Keeper Isolde Petrel filled the lamp from her last reserve and went upriver to open the weir sluice that Ansel Stalk's grandfather had built (the river had stopped scouring the bar for years; the comet finished the job in one night). She could not shift the seized wheel alone. The lamp ran dry as the comet fell; the fleet grounded on the bar in the dark; and every draft creature in the harbor Shifted at once under the skyglass rain. Everyone waded home. Every boat was lost. Ansel, the young harbormaster, wrote the report that blamed the keeper. Isolde left; her letters explaining the bar went into Hesper's sack the week the post office closed.

Out of that night came both factions. **The Mooring** (Provost Agathe Merrow, who lost her harbor) wants change stopped: anchor stones, licenses, the Anchor Pulse, a plan to sink the Heartshard when the comet returns. **The Scatter** (Teo Varga, ex-Mooring, on the Carnival Raft) wants more of it: Starsalt, Shift fairs, a plan to crack the Heartshard and seed every island. Both have a point. The player works for both and the game never scores a Forecast choice as good or evil.

**What Shifting is.** Every creature born since the Starfall carries a faint four-point Heartmark that lights magenta when it bonds. When growth meets skyglass pressure (about three level windows per creature) the mark glows and the creature will Shift Up, Side or Down into a body from its family pool. A Shiftreader sees the glow as odds. Accept lets it land; Anchor (a Mooring stone) refuses it; Reroll (Scatter Starsalt) shakes it. A Shift never touches level, EXP, held item, nickname, Bond, trained stats or the Heartmark technique.

**What the Relighting does mechanically.** Paying loan 7 at the co-op yard triggers dusk on the point: Juniper hands over Isolde's keeper's lantern, you and Wick carry the flame up the stair, the lens catches. Four things flip in the save, each a one-line state change:

1. **The Lit Causeway.** The beam sweeping every 8 seconds shows the drowned stones from the point to Shardcrown; the tile mask for that causeway becomes permanently walkable at any tide. The Summit opens (it also wants six badges; the gate guide says so).
2. **Steadied dice.** The Forecast header reads *Lit coast: steadied*. Five points move from Down to Side on every dial (Drift 50/40/10 → 50/45/5; Flux 40/35/25 → 40/40/20), applied after Bond. Not a victory for the Mooring: the dice still roll.
3. **The fleet comes home.** The ferry horn answers with Your Signal; three dark houses reopen over the next three mornings and new neighbors cross at dusk; Tamsin's boat floats.
4. **The comet answers.** The Vagary descends to the sea stack off the point and can be fought (post-game boss) once the Summit is cleared.

**Pacing without one gate.** Loans gate rooms and the Relighting, and only money pays loans. Badges gate reader tools (Reroll, skiff, Ethers, Prism, Training Yard, Plumbline) and the Summit; they never gate a loan but each one *pays* one (a Spire share, section 7). Letters gate nothing; they reveal heirlooms and relics. Shifts gate nothing; levels drive them. Isles are gated by geography and posted curve levels only.

---

## 3. The player

**Lease card** (the character creator, every field visible, editable later at the cottage mirror): species (6 on one 16×24 rig: water vole, river otter, red panda, opossum, ferret, mongoose), fur palette (6 per species), markings (mask, socks, stripe, freckles, blaze), eye shape (3), pronouns (separate), name, town name (letters use it), **Your Signal** (6 notes on 6 pentatonic chimes: door chime, Dimity hums it, the ferry horn answers with it). Wren's small talk sets only your windowsill plant and tomorrow's weather, and says so. Default outfit: lighthouse-stripe jumper; co-op apron during errands.

**The Lantern and the first creature.** Minute 4 of the game. The point's flats are at a seeded sunset low tide. A Sloshkin pops up to the eyes in the warm mud and follows you; islanders say they pick their trainer. **Corin Vale**, master Shiftreader, eyes failing, has come over on Maud's ferry for the Starfall anniversary and is standing at the dark lighthouse door. He hands you two things: the **Reading Glass** (a brass lens; mechanically it is the Read command and the Forecast screen) and a **Lantern**: "Raise it. Don't throw it. Nobody throws anything here." The first capture is scripted at 100% so the player learns the raise, the draw-in and the three-segment glow meter without a roll. You name the Sloshkin; its Heartmark lights on the name. You are now both the town's new Keeper (Wick says so the moment he sees you) and Corin's apprentice reader.

**Who teaches what.** Corin teaches **Read** on the arrival night (he reads Linnet's starter aloud at the quay) and **Capture Stance** the next morning on Brack Flats at the first wild Tossup ("Hold your light low; your partner will pull its hits"). Maud Tallis teaches **Reroll** at her practice table before the Turn Spire. Linnet teaches **Decline** by refusing to fight you on day 2 ("Not until you're worth it"). Tuck runs the **Porch Duel** slate. Barnaby keeps the **Field Log** and the **Shiftlog wall**. Nobody explains the loan twice: Wren says "pay it when you can" once.

---

## 4. The world

Pellwick is the hub (Porchlight's harbor, sized at ~100 trees, with Wildshift's home village folded in). Six isles ring it; the Starfall Lagoon and Shardcrown sit off the point.

```
                         N
      [RIMEHOLT]  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~  [THISTLEWIND]
       Mirror Spire (Seraphine)           Relay Spire (Hallorans)
       mirror-ice caves, curve 30         windmill moor, curve 26
       sea stack (Vagary, post-game)      the Surge happens here
            |  skiff only                      |  causeway (low tide)
            |                                  |  cliff path (any tide)
      [CAIRNHOLD] ------ stepping stones ---- [DROWNWOOD]
       Ward Spire (Osric), curve 12            Hollow Spire (Wendel Teague), curve 20
       quarry, Mooring clinic (Merrow)         drowning stilt town, Scatter rescue
       Tobin & Rillfin, memorial               Creelwight in the flooded street
            \  stones (low) / quarry road (any)    /  causeway (low) / mangrove boardwalk (any)
             \                                   /
  mainland ====[         P E L L W I C K  (hub)         ]====  Carnival Raft docks at the quay (day 3+)
  causeway      quay . green . river+weir . co-op yard . Pell's . post office . Archive
  (arrival)     POINT: Keeper's Cottage + dark lighthouse + Turn Spire (Maud's ferry dock)
                         |  point flats (low tide) / footbridge (any tide)
                   [BRACK FLATS]   first route, Tossup & Sloshkin mud, curve 6, Waystone
                         |  causeway (low) / Maud's ferry (any)
                   [EMBERSTEP]     Weather Spire (Ines), curve 16, first Errant (Squallcoil), spa terraces
                         
   STARFALL LAGOON (centre) — [SHARDCROWN] Summit atoll: Hollis at the gate, 2 Keepers, Idris Fenwake.
   Reached only by the LIT CAUSEWAY from the point, which appears after the Relighting.
```

**How tide gates travel.** Every isle has two approaches so nobody is ever trapped: a **low-tide short way** (causeway, stepping stones, exposed flats with relic glints) and an **any-tide long way** (cliff path, boardwalk, footbridge, or Maud's ferry from the quay with a destination card and the isle's posted curve level; cursor on No when the trip heads back). Rimeholt is ferry-only in both directions (it is fiction's "outer isle") and its dock opens once you hold four badges, the one travel gate in the game. The order Brack → Cairnhold → Emberstep → Drownwood → Thistlewind → Rimeholt is advisory, enforced by posted curve levels and door guides, never by walls. Skiff fast travel between lit Waystones from badge 2.

| Area | Holds | Maps |
| --- | --- | --- |
| **Pellwick (hub)** | ~100 named trees, quay (high-tide shoals), river with 2 reaches + weir, green (Mooring Post, Lantern Market Sat night), co-op yard (loan ceremony), Pell's Sundries (Juniper; all shop stock), post office (Hesper, 6pm–2am), Archive (Barnaby; Field Log, Shiftlog wall, Memory relearn, Corin's Recall), 4 starter porches + 3 dark houses, the point (cottage, lighthouse, Turn Spire at the ferry dock), point flats (daily Glint, glowing mud) | 1 exterior 64×48, 6 interiors |
| **Brack Flats** | Tutorial route: Tossup, Sloshkin, Scrapling, Wirewhisk; 4 trainers; Waystone; Capture Stance scene | 48×32 |
| **Cairnhold** | Quarry, standing stones, Knapp's End; Prismoth (first Ward, no Wards before here); Crackdust at the clinic shop; Merrow and the memorial; Tobin; Ward Spire | 48×32 + Spire 20×14 |
| **Emberstep** | Volcano terraces, steam weather; Caldermaw dens (Sootling wild), Sedgehare; Errant Squallcoil roams; Weather Spire | 48×32 + Spire |
| **Drownwood** | Mangroves, stilt town going under; Creelwight, Bilgebob, Rushling; Scatter rescue and the Anchor Pulse misfire; Hollow Spire | 48×32 + Spire |
| **Thistlewind** | Moor, windmills; Rimeplate/Chillnub, Stillox (Mooring emblem); the Surge night; Relay Spire | 48×32 + Spire |
| **Rimeholt** | Mirror-ice caves (darkness with 3-tile light radius and wall rims); Vesperay seen with Idris; Linnet returns; Mirror Spire; sea stack | 48×32 + Spire + stack 24×16 |
| **Shardcrown** | Hollis's gate (Summit Purse, Ration Ledger, dossier), two Keeper halls, Idris's hall, the Summit Bell | 3 rooms 24×16 |

Total: 8 exteriors, 6 Spire interiors, 6 town interiors, 4 Summit/stack rooms = **24 maps**, all authored as string grids in `js/data/maps/*.js`.

---

## 5. The clocks and the session

| Constant | Default | Notes |
| --- | --- | --- |
| In-game day | **24 real minutes** (1 real min = 1 in-game hour) | Settings: 12 / 24 / 48 min, and **Real Clock** (uses the device time; Rest only saves) |
| Clock pauses | battle, Forecast, menus, dialogue, ceremonies | Not in Real Clock mode (accepted) |
| Low tides | 2 per day, 12h25m apart (12.4 real min), each ~50 in-game min later than yesterday | Day 1 seeded so a low falls at 7:10 pm (arrival) and ~7:35 am (first morning flats) |
| Night | 8 pm–6 am = 10 of 24 hours; dusk/dawn LUTs add 3 more | "Half the game" in content, not in minutes: night buyers, night fish, glowing mud, porch talk, Surge encounters |
| Palette LUT states | dawn 5–7, morning 7–11, noon 11–15, golden 15–18, blue 18–20, night 20–1, moonlit 1–5 | 7 states; ordered-dither crossfade over 60 real seconds |
| Buyers | Juniper 7 am–9 pm; Ludo 9 pm–7 am; Consignment Crate overnight at 90% | **Someone is always buying** is a unit test |
| Porch talk | 7 pm–1 am (6 real minutes) | Wider than Porchlight's 8–11 so a 24-minute day keeps it |
| Mail | 6 am: one Isolde letter from Hesper; 6 pm: one family letter to carry | Both capped per in-game date |
| Rest | bed or porch: writes the Day Page, saves (<1 s), advances to 6 am | **Porch sit** instead runs the clock at ×6 until you stand (watch the tide come in) |

**An ideal day (24 real minutes, day 6):** 6:00 wake, mail, boards at the gate (Ledger: *13,400 to go, about 2 days*; Tide: lows 9:50 am / 10:15 pm; Mooring Post: Augusta's odds "6 in 10 rain by the evening tide", this week's beats, Errant sighting on Emberstep, Porch Duel slate) · 6–8 shake the near orchard (16 trees, one bee tree heard in time), dig two cracks · 8–9 Pell's: sell, buy two Lanterns and a Salve, check Wanted Today · 9:50 low tide: point flats for the Glint and a relic, stepping stones to Brack Flats, footbridge back · 10–12 skiff to Cairnhold, two route trainers, catch a Prismoth with Stance on, Read it · 12–14 **Ward Spire** (clock paused: ~5 real minutes), badge 2 → Wren gets a 1,800◉ Spire share · 14–16 back home; Forecast for your Scrapling opens at the Waystone (Up 50 Knuckleback / Side 40 Mudfist / Down 10 Puddlepip), Accept · 16–18 golden hour: Odile poses you on the point; fishing the quay shoals · 18–19 co-op yard: pay 12,000◉, THWAP, roof colour, loan 4 opened, pick the Workshop · 19–20 porch talk with Tuck (beat 2) and Bramble · 20–22 Lantern Market? (Saturday only) or night fishing; 22:15 low tide: glowing mud, one skyglass shard (Starsalt), John Dory on the tell · 23 Ludo buys the catch · 23:30 Rest; Day Page "Tomorrow: the Workshop goes up; Hesper's letter 6; low tide 10:40 am; Linnet wants a rematch at the quay."

---

## 6. Core loops

| Loop | Length | Cozy half | Creature half | Shared output |
| --- | --- | --- | --- | --- |
| **Minute** | 1–3 s verbs | shake, pick, dig, cast, talk, Linger | walk tall grass, Read, fight, capture, decline | buttons, Field Log, open threads |
| **Day** (24 min) | one in-game date | mail, boards, tide windows, buyers, porch talk, Rest | one route or one Spire, Forecasts resolve at Waystones or home | a loan payment or a badge, the Day Page |
| **Week** (~3 h) | seven dates | a life thread's beat (Mondays), Lantern Market (Sat), Porch Sale (Sun), Archive Bounty | an isle cleared, one or two Shifts per creature, a Spire share paid | the house grows a tier, scaffolding climbs |
| **Arc** (5–7 h) | ~14 dates | 7 loans, 8 threads, 20 Keeper letters | 6 badges, ~12–18 Forecasts, the Surge | the Relighting → credits → Summit, Vagary, Seed Card |

**How cozy and combat coexist.** (1) The clock pauses in battle and menus, so a Spire never eats a tide. (2) Trainers carry 1–3 creatures, wild battles last 2–4 turns, text is instant by default and animation speed defaults to 2× (1× selectable), so a route costs 6–8 real minutes. (3) Both loops print to the same three boards at your gate every morning, so the player plans one day, not two games. (4) Neighbors are never fought; the only town fights are **Porch Duels** from the Mooring Post slate: friendly, no payout loss, scaled to your median level, repeatable (this is the Rematch board). (5) Spire leaders live on the isles; Linnet and Tobin fight you where the story says.

**The failure state.** A blackout outside the Summit carries you home: fade to your porch, party healed, Dimity: "You came home carried. I kept your place." You drop 10% of your wallet, capped at 500◉; the loan is never touched. Summit losses cost nothing and the Summit Bell (Drift/Flux) restarts at the Keeper who beat you, declinable. No scolding anywhere, no deadline on anything.

---

## 7. Economy and progression

**One currency: buttons (◉).** Porchlight's ladder is divided by ten so a 4–8 hour run clears it; prices stay Porchlight-scale so fruit and fish feel like Porchlight. "Glint" is kept as the name of the daily buried purse. **Starsalt** is the one steering sub-currency (Rerolls, Recall), bought and found, never earned by fighting townsfolk.

| Income | Amount | Limit |
| --- | --- | --- |
| Native fruit / foreign fruit / ripe | 120 / 480 / +25% | ~100 trees, regrow every 2 days |
| Fish (18 species) | 80–4,200; John Dory 2,400 night, lantern wolffish 4,200 night | 4–8 shadows per reach; reach busy/quiet with a floor |
| Bugs (10) | 60–900 | more at lit porches and string lights |
| Fossils (6) / relics (6) / shore finds (6) | 300–1,500 / linked to letters / 100–400 | ~4 cracks a day; glints at low tide |
| The Glint | 300–1,500 purse | exactly one a day |
| Honeycomb | 350 | per bee tree caught |
| Wanted Today | 3 items at +50% | one stack each |
| Route trainer payout | 40 × highest level (Lv5 → 200, Lv30 → 1,200) | once; Porch Duels pay 25% repeatable |
| Spire prize | 3,000 | once per Spire |
| **Spire share** | 10% of the current loan, sent to Wren as a tally stick | once per badge |
| **Resident share** | 5% of the current loan | once per finished lead thread (8 threads) |
| Errant beaten / caught | 2 Starsalt + 1,000 | returns after next badge or 2 h |
| Skyglass shard (night low tide glowing relic) | 1 Starsalt | 1–2 per night low; refills per badge |

| Sink | Price |
| --- | --- |
| Lantern (grades) | 60 / 150 / 300; the one **Sure-catch Lantern** is a Keepsake (Corin, badge 3) with a confirm, cursor on No |
| Salve / Tonic / Full Salve / Revive | 80 / 240 / 600 / 700 |
| Ether / Full Ether (from badge 3) | 250 / 700 |
| Crackdust | 150 (below one route payout at that isle; stocked before every mandatory Ward) |
| **Starsalt** | 600 at Pell's, max 3 per day; Varga's raft sells 3 more on raft days |
| **Anchor stone** | Drift: free, 3 issued, refilled to 3 at each badge. Flux: 400 at Pell's. Freefall: 1 per badge |
| Still Knot (held) | 1,500 (Mooring clinic) |
| Technique discs (12, reusable) | 1,200–3,000 |
| Recall (Corin at the Archive, badge 4) | 6 Starsalt |
| Reroll | 1, 2, 4, 8 Starsalt within one Shift |
| Commons Jar projects (6) | 2,000–8,000 each, neighbors chip in 30% |
| Furniture / clothes | 200–2,000 |

**The seven loans (Hearthwright & Daughter, interest-free, no deadline):**

| # | Amount | Builds | Reader-side effect |
| --- | --- | --- | --- |
| 1 | **1,200◉** | bedsit; porchlight on; Dimity moves in | errands knock off 600 |
| 2 | **9,000◉** | the cottage | tally wall; badge seals hang there |
| 3 | **18,000◉** | commission 1 (pick 4 of 6: Porch & Loft, Workshop [cleaning bench], Greenhouse [grafting], Study [Field Log desk, Shiftlog strip at home, dial change], Training Yard [3 boxed creatures earn 25% EXP], Gallery [paintings, tally wall]) | Wren's first own design |
| 4 | **30,000◉** | commission 2 | — |
| 5 | **45,000◉** | commission 3 | Summit Purse starts: 1,500 per badge from badge 4, kept by Hollis |
| 6 | **60,000◉** | commission 4 | Lamp Room offered |
| 7 | **75,000◉** | **the Lamp Room** | **the Relighting** |
| | **238,200◉ total** | 7-night floor; target 12–15 in-game days | |

Abacus: one bead click per 100◉ (loan 1 clicks twelve times); clicks accelerate after ten and roll up in thousands; holding confirm skips to the THWAP. Tally notch = 1,000◉.

**Badges and what they gate:**

| Badge | Spire (leader) | Teaches | Unlocks |
| --- | --- | --- | --- |
| 1 | Turn (Maud, Pellwick) | Forecast, Reroll | Reroll + 3 Starsalt; chip-damage disc guaranteed by now |
| 2 | Ward (Osric, Cairnhold) | Wards, Crackdust | skiff fast travel between lit Waystones |
| 3 | Weather (Ines, Emberstep) | battle weather on a posted 3-turn forecast | Scouting Prism (Corin) + sure-catch Lantern; Ethers at Pell's |
| 4 | Hollow (Wendel Teague, Drownwood) | immunities, "No effect" | Recall at the Archive; one coverage disc face-up; Rimeholt dock; Purse deposits begin |
| 5 | Relay (Ada & Ivo Halloran, Thistlewind) | no-repeat rounds, bench growth | Training Yard commission becomes buildable as a Commons project too |
| 6 | Mirror (Seraphine, Rimeholt) | evasion cap, Mends, true odds | Plumbline disc; Summit gate (with the Relighting) |

The Summit Purse (1,500 at badges 4, 5, 6 = 4,500◉) opens at Hollis's gate. EXP contributes nothing to the loan; money and badges both do, by the shares above. A Node economy simulation (section 14) plays an "average day" model and must land the Relighting between day 11 and day 16 at default settings.

---

## 8. Crossovers

**Porchlight systems that become creature-aware** (each is one hook in a data table, not a new system):

| System | Creature hook |
| --- | --- |
| Fishing | A **Brine** lead widens the bite window by 50% and shows a species' tell after 1 catch instead of 3. Fog pulls silver schools in; a **Rime** lead calms the quay (one extra shadow). |
| Shaking | A **Gust** lead shakes two drops per tree 25% of the time. A **Grit** lead (Scrapling) punches the bee nest: honeycomb guaranteed, no halo. |
| Digging | A **Stone** lead marks today's fossil cracks on the map. A **Hollow** lead shows glowing relics dimly at any tide (the night low still gives the shard). |
| Glowing flats | Glowing relics are **skyglass shards**: Starsalt source, pulse once a second in m, never a four-point shape. |
| Bugs | A **Bolt** lead draws moths; moth count at your porch feeds Dimity's thread. |
| Porch talk | Lines tagged by the lead creature's type and by Shift events ("Your Sloshkin came back with wings. I'd have cried."). |
| Life threads | Tamsin's lost nameboard is inside a **Creelwight** on Drownwood (Read it to see the board); Tobin's thread is Rillfin; Linnet's rival arc runs as a thread with Monday beats. |
| Heirlooms | Juniper's back room returns a **Still Knot** (the Dorrows'), a **Lantern** grade 2 and Isolde's lantern. |
| Wanted Today | can list creature drops (Rimeplate's shed plate, Prismoth dust). |
| Commons projects (6) | footbridge, river stepping stones, Waystone lamps on Brack Flats (lit Waystone = skiff node), **Training Yard on the green**, Old Pier (Errant sightings board), reopen the three dark houses. |
| Odile's Twelve Lights | one canvas is your starter's Shiftlog, painted at the Relighting. |
| Ambrose | carves a **perch** for your lead creature from your timber, provenance tag names the tree. |

**Wildshift systems that become town-aware:**

| Wildshift | In Pellwick |
| --- | --- |
| Shelter heal | Rest at the cottage, or any lit Waystone (free heal, autosave glyph) |
| Shelter shop | Pell's Sundries carries Lanterns, Salves, Crackdust, Ethers (badge 3), Starsalt, anchor stones (Flux); never randomized |
| Rematch board | the **Porch Duel slate** on the Mooring Post (6 neighbors, scaled to the curve, pulled on demand) |
| Training Yard | a room commission or a Commons project |
| Memory relearn / Recall | Barnaby's Archive (Corin runs Recall for Starsalt) |
| Field Log | an Archive wing (Seen / Read / Held) beside the fish and fossils |
| Dossiers | pinned to the Mooring Post the morning you reach an isle; also at each Spire door |
| Waystone | a lamp you light; Commons funds the lamps |
| Badge screen | wax seals on your tally wall; the Ledger shows the Purse |
| Chaos dial change | the Ledger's last page, at home |
| Seed Card | the last page of Dimity's Season Book, exportable as text |
| Deferred Shifts | resolve at the next Waystone **or at home at the next low tide** (the Tide Table lists "Shifts pending: 2") |
| Blackout | you wake on your porch |

---

## 9. Cast

| Name | Species | Town-loop role | Creature-loop role | Origin | Verdict |
| --- | --- | --- | --- | --- | --- |
| The Newcomer (Sorrel default) | 6 species | Keeper, tenant, debtor | Shiftreader | both | **merge** |
| Wren Hearthwright | beaver | co-op; loans; ceremony; thread "the Lamp Room" | receives Spire shares | Porchlight | keep |
| Ambrose Hearthwright | old beaver | notches, THWAP, carving | carves the perch | Porchlight | keep |
| Juniper Pell | magpie | shop 7–9; heirlooms; thread | sells all battle staples | Porchlight | keep |
| Hesper Coil | snail | 6 am letters, 6 pm family letters, counter 6pm–2am | — | Porchlight | keep |
| Barnaby Thole | hermit crab | Archive, string wall, Bounty | Field Log, Shiftlog wall, Memory | Porchlight | keep |
| Ludo | fruit bat | night buyer, Lantern Market | sells night seedlings and moth-silk | Porchlight | keep |
| Augusta Skerry | grey seal | Warden: odds, boards, porch count | posts Errant sightings and dossiers | Porchlight | keep |
| Dimity | moth | Day Page, save, "While you were away" | Seed Card page | Porchlight | keep |
| Wick Dorrow | puffling | calls you Keeper; carries the flame | wants to see a Shift | Porchlight | keep |
| Tuck | wombat | nickname; Mudlark Mile thread | runs the Porch Duel slate | Porchlight | keep (rename pending) |
| Odile | spoonbill | Twelve Lights thread | paints your Shiftlog | Porchlight | keep |
| Clementine "Clem" | bilby | murder-mystery thread (template beats) | — | Porchlight | keep, template thread |
| Bramble | rock hyrax | The Fence thread (hand-written) | — | Porchlight | keep |
| Tamsin Brack | badger | Oyster Boat thread | Creelwight holds the nameboard | Porchlight | keep |
| Ansel Stalk | heron | confession and the weir | — | Porchlight | keep |
| Isolde Petrel | storm petrel | letter author; post-credits reply | — | Porchlight | keep (silhouette) |
| Corin Vale | owl-keeper (badger, with an owl partner Duskowl) | lodges over the Archive | mentor: Read, Stance, Prism, Recall; 2 exhibitions | Wildshift | keep |
| Linnet Rask | otter | Maud's apprentice; neighbor; thread | rival: 4 battles, Caldermaw→Sootling, Gnash disc | Wildshift | keep |
| Maud Tallis | gull | ferry pilot | Turn Spire | Wildshift | keep |
| Tobin Marsh | vole | Cairnhold boy | friend; Rillfin; Causeway battle | Wildshift | keep |
| Idris Fenwake | cormorant | watches the point | Champion; Vesperay; anchor release | Wildshift | keep |
| Provost Agathe Merrow | ibis | runs the Cairnhold clinic | Mooring head; one boss fight; Anchor Pulse | Wildshift | keep |
| Teo Varga | raccoon | Carnival Raft days | Scatter head; forced Shifts on his side only | Wildshift | keep |
| Osric Penhallow / Ines Calloway / Wendel Teague / Ada & Ivo Halloran / Seraphine Locke | mason / spa owner / boatwright / twins / cave guide | fixed posts on their isles | Spire leaders 2–6 | Wildshift | keep (Teague renamed from Ambrose) |
| Hollis Brandt | ex-Mooring | Summit gate shop | Purse ledger, Ration Ledger | Wildshift | keep, no Spire |
| Bastien Kell, Cass Rune | — | — | Summit Keepers 1–2 | Wildshift | keep |
| Dov Lattimer | auctioneer | — | **cut**: disc shop folds into Pell's and Varga's raft | Wildshift | cut |
| Odile Strand, Mirren Hale | — | — | Keepers 3–4 | Wildshift | cut (name clash; doubles cut) |
| Ferdinand, Tova, Ferro | — | — | — | Porchlight | cut |

Neighbors with schedules, memory and porch talk: **14** (Wren, Ambrose, Juniper, Hesper, Barnaby, Ludo, Augusta, Wick, Tuck, Odile, Clem, Bramble, Tamsin, Ansel) plus Corin and Linnet as resident schedule-bearers = 16 scheduled people. Hand-written life threads: **8** (Tuck, Odile, Bramble, Tamsin, Ansel, Hesper, Linnet, Tobin), 4–5 beats each; Wren's and Juniper's arcs ride the loan events; Clem is a 3-beat template.

---

## 10. Content scope (the honest count)

| Thing | Count | Form |
| --- | --- | --- |
| Maps | 24 (8 exterior, 6 Spire, 6 interior, 4 Summit/stack) | string grids, 16×16 tiles |
| Tile types | 96 (incl. 12 animated: water, foam, grass, mud glow, lamp, skyglass) | procedural painters in `tiles.js` |
| Creature forms | **42 in 14 families** | 32×32 palette-indexed string art, 2 frames (idle, hit) front, 1 back; icons are a 16×16 head crop at the head anchor |
| Techniques | **64** = 12 types × 4 (40 / 65 / 90-with-drawback / utility) + 16 signatures (Undertow, Skein Sweep, Shadowbox, Dust Veil, Vesper Mend, Tailfall, Gnash, Snuff, Reap, Arc Ping, Plate Toss, Bandlight, Sure Pinch, Bedrock Charge, Kiln Maw, Plumbline) + Scrap (no slot) | 12 effect tags only |
| Abilities | **20** incl. 3 Wards (Glasshide, Mirrorveil, Stillcoat; Prism Ward is Prismoth's name for Glasshide) | data + 8 hook points |
| Items | 26 + 12 discs | Keepsakes pocket for one-of-a-kind |
| Trainers | 30 route (5 per isle) + 6 leaders + 2 Keepers + Champion + Linnet ×4 + Tobin ×2 + Merrow + Varga + Corin ×2 + 6 Porch Duel neighbors = **55 rosters** | fixed per seed |
| Spires | 6 + Summit (2 Keepers + Champion) + Vagary (4 phases) | |
| Neighbors | 14 scheduled + 2 (Corin, Linnet); 8 isle NPCs at fixed posts | |
| Letters | **56**: 20 Keeper letters (6 am), 18 family letters (6 pm, carried), 18 town-history letters (unlocked by relics/fossils at the string wall) | 60–120 words each |
| Fish / bugs / finds | 18 / 10 / 18 (6 fossils, 6 relics, 6 shore finds) | field-guide plates are the same string-art format at 24×24 |
| Furniture / clothes | 24 / 12 | modest; the house grows by rooms, not catalog |
| Errands | 6 | |
| Life threads | 8 hand-written + 1 template | |
| Commons projects | 6 | |
| Music | **6 day-part themes** with 4 stems each (base, night, low-tide, rain) + 5 battle (wild, trainer, Spire, Errant, Champion/Vagary) + 4 special (title, Forecast, Relighting, credits) = **15 sequences** | tracker patterns in `data/music/` |
| SFX | **48** synthesized verbs (shake, drop, purse, net, cast, feint, bite, reel, dig, crack, glint, talk tick ×8, THWAP, bead, notch, door, ring open, stack tick rising, bee hum, Lantern raise/hum/warm chord/breath-out, send-out unfold, Ward ping, blocked tink, EMPTY thud, hit ×4 by effectiveness, crit, faint, Shift sting 3 parts, Heartmark glint, save chime, save buzz, Errant streak, beam sweep, ferry horn/Signal) | `audio/sfx.js` |
| Player species | 6 on one rig (head/ears/tail layers) | |
| Weather | clear, overcast, rain, fog, storm | overlay cap 35%, Clear Visuals toggle |
| Chaos dials | Drift, Flux full; Freefall and Custom as exposed toggles (stretch) | |
| Challenge modes | No Rewind, One Heart (+ Blind Read if cheap) | |

**The 14 families (42 forms):** Sloshkin (Puddlepip, Sloshkin, Siltback, Skeinwing, Bogmonarch, Star-touched Sloshkin), Scrapling (Scrapling, Knuckleback, Cragmitt), Tossup (Tossup; its pool draws stage-1 forms of other families), Prismoth (Mothling, Prismoth, Lumenveil), Vesperay (Rayling, Vesperay), Bilgebob (Bilgebob, Brinelance), Creelwight (Creelwight, Hulkwight), Sedgehare (Reedkit, Sedgehare), Wirewhisk (Wirewhisk, Coilcrest), Rimeplate (Chillnub, Rimeplate), Squallcoil (Errant, 1 form), Stillox (1 form, never Shifts), Caldermaw (Sootling, Emberjaw, Caldermaw), Rillfin (Rillfin, Gillwick, Strandrunner), plus Mudfist, Rushling, Duskowl (Corin's), Cairnward (Merrow's Ward ace, Stone/Glass), Vagary (96×96 drawn as 3×3 tiles of 32). Star-touched forms are palette swaps with the Star badge, so they cost no new art.

---

## 11. Scripts

### The first 30 minutes

| Min | Beat | Teaches |
| --- | --- | --- |
| 0:00 | Title (lighthouse dark, beam absent, comet faint). New Game → dial (Drift / Flux, seed code shown, Custom folded away) | seed |
| 0:40 | Causeway at forced dusk, rising tide; seven porches lit across the water. Wren: "You walked. Nobody walks." Lease card: species, fur, markings, pronouns, name, town, Signal; preview; confirm | creator |
| 3:00 | Key. "Twelve hundred buttons, no interest. Pay it when you can. We build while you sleep." Clock hands over: day 1, 6:45 pm, low tide 7:10 | clock, loan |
| 3:30 | Walk to the point. Wick, cap over eyes: "Keeper!" The cottage: bedsit, bed, Ledger on the wall | Rest exists |
| 4:00 | Flats glisten at the low. A Sloshkin pops up and follows. Corin at the lighthouse door: Reading Glass, Lantern. Scripted 100% capture: raise, draw-in, meter. Name it; Heartmark lights on the name. Journal stamp *Someone Picked You* | **first creature**, Lantern, Heartmark |
| 6:30 | Corin walks you to the quay. Linnet Rask on the dock with Maud: "Lowmoor's first certified reader. Me." Her starter glows: **Forecast on someone else's creature**, Corin reads the odds aloud, it lands Up on a Lv5 Caldermaw. "Hold out three turns." Battle: Fight / Read / Bag / Run greyed. You Read it (free). The scene continues win or lose. Stamp *Identity Crisis*. Maud: "Come back stronger. Rematch at my dock." | **first battle**, Read, hold-out scene, Forecast seen |
| 10:00 | Errands clipboard opens (6, any order, 100◉ each): apron; carry the mail sack (Hesper's lamp lights); pin your notice; show Barnaby a find; catch a fish; chat with Tuck, Odile, Bramble (Tuck: "Ringtail" → accept / decline / suggest) | town verbs |
| 10–17 | Shake 8 trees (960◉ if sold), one bee tree hums; dig one crack; fish the quay (tell teaching: first John Dory shadow seen, not caught); Hesper's counter, Barnaby's batch ID. Juniper buys | economy |
| 17:00 | Footbridge to **Brack Flats** (curve 6). Tall grass rustles; a Tossup. Corin: Capture Stance toggle. Read it, Stance on, Undertow ×2, raise the Lantern: odds 62% shown, meter fills to the roll. **First catch** (or second try, +3%). Trainer Pip (fisher kid) Lv4 Wirewhisk: payout 160 | **first catch**, Stance, odds |
| 23:00 | Back at the co-op yard: 1,200◉ reached (600 errands + sales). Abacus clicks twelve times, Ambrose gnaws, THWAP, your half on the wall. Loan 2 opens: 9,000. Roof colour: slate blue. **Porchlight comes on**; Dimity moves in; across the harbor Odile's easel turns toward you | **first loan payment** |
| 25:30 | Sloshkin hits Lv7 on the walk home (its first window is Lv7 in this game): **"Shift pending" pip**. Prompt: Open Forecast now / Later. Now: Up 50 Siltback / Side 40 Rushling / Down 10 Puddlepip, KEEPS row, Accept / Reroll (greyed: "Maud teaches this") / Anchor (3 stones). Player chooses; the scramble resolves outward from the Heartmark | **Forecast** |
| 27:30 | Rest. Day Page: "Tomorrow: the cottage goes up overnight; Hesper's first delivery; low tide 7:35 am; Maud's rematch." Save < 1 s, verified chime | Rest, save |
| 28:00 | 6 am day 2. The Thatch tie off the roof (watchable); scaffolding climbs one section. Hesper at the mailbox: "One for you. It's… thirty years late." **Letter 1**: *The light is fine. It's the river that's wrong. —I.* Boards at the gate: Ledger, Tide, Mooring Post | **first old letter**, boards |
| 30:00 | Free play. Door guide at the Turn Spire says Lv8 recommended | |

### A mid-game day (day 8, a Monday)

7:00 wake; letter 7 (Isolde's sketch of the weir); family letter from last evening still in the satchel for the Dorrow burrow. Ledger: *loan 5, 31,200 to go, about 3 days*. Tide: 11:20 am / 11:45 pm. Mooring Post: "8 in 10 clear", Errant Squallcoil seen on Emberstep's east slope, thread beats this week: Tuck 4, Tamsin 3, Linnet 3; dossier for the Hollow Spire pinned (Wendel Teague: 3 Hollow creatures, tactic *immune to Plain and Grit*). 7:15 shake 30 trees with your Skeinwing leading (Gust: 7 double drops); Crate takes the overflow. 8:00 Pell's: 3,900◉ in, buy Crackdust and a Tonic; Wanted Today has cockles. 8:30 Coverage view flags *Gap: Hollow* because your party runs Plain/Grit; it points at the Kiln disc you own; teach Kiln Maw to Scrapling via Memory at the Archive. 9:00 skiff to Drownwood; three route trainers (6 min), Read a Creelwight: the nameboard glints inside; Tamsin's beat 3 fires tonight. 11:20 low tide on Drownwood's flooded street: Scatter volunteers, the stranded herd, Varga's forced Shifts posted; Anchor Pulse misfire scene. 12:30 **Hollow Spire** (paused clock, 6 real min): badge 4, prize 3,000, Spire share 4,500 to Wren, coverage disc face-up, Rimeholt dock opens, Purse takes 1,500. 13:30 Waystone: two deferred Forecasts, *1 of 2*: Scrapling Up to Knuckleback (Accept), Tossup Side to Rushling (Reroll for 1 Starsalt, then Accept). 15:00 home; golden hour; Odile poses you on the steps for canvas 10. 17:00 co-op yard: pay 24,000; abacus rolls in thousands; THWAP; Wren: "That one's mine. It's not from the book." 18:00 Hesper's counter: deliver the Dorrow letter; Juniper returns the Dorrows' Still Knot. 19:00 porch talk: Tuck beat 4 (he was the slowest kid; Mudlark Mile at the next low). 21:00 Lantern Market? No, Monday: night fishing on the quay; a Bolt lead draws moths to the string lights; two bugs. 23:45 glowing mud: skyglass shard (Starsalt), a glowing relic (links letter 31, pinned at the Archive tomorrow), John Dory on the forked-tail tell. 0:30 Ludo buys 7,800◉. Rest. *Tomorrow: Tamsin on the glowing flats; the Greenhouse goes up; letter 8; low tide 12:10 pm; Mudlark Mile.*

---

## 12. Screens and controls

**Screens (26):** Title · New Game (dial, seed, challenge toggles) · Lease Card · Overworld (Skyband 40px: sun arc, moon, tide needle, clouds, meteors) · Dialogue (ledger slip, wax-seal name tab, Linger seal) · Tool Ring (8 brass sockets) · Satchel (4×5, Keepsakes pocket) · Ledger (loans, Purse, pace estimate, commissions, dial page) · Tide Table & Mooring Post boards · Map (illustrated, pins, tide, reaches, lit porches, Errant) · Party (Shift pips, curve gap, Coverage view with *Gap* labels) · Creature Summary (Shiftlog strip, Bond pips, Memory) · Field Log (Seen / Read / Held) · Archive (fish, bugs, finds; string wall) · Shop (rows show move stats and learner icons) · Battle (foe top-right, player bottom-left, 48px command panel, Read panel, Ward badge, Mends pips, EVA marker, Stance / May KO tags) · Capture (odds number + bar, 3-segment meter) · Shift Forecast (3 cards, KEEPS row, costs beside holdings) · Payment Ceremony · Dawn Build vignette · Day Page · Pause (fixed slots, Save last) · Settings (day length, Real Clock, text speed, battle speed, Gentle timing, Large Text, Clear Visuals, Reduced Motion, High Contrast, volumes, mute, remap) · Relighting cinematic · Credits · Seed Card / Season Book.

**Controls (one table drives all three):**

| Action | Keyboard | Gamepad | Touch |
| --- | --- | --- | --- |
| Move / run | arrows or WASD / Shift | left stick, d-pad / B hold | virtual stick (left half), run toggle |
| Confirm / interact / context verb | Z or Enter / C | A / X | A button; tap on the object |
| Back (never drops) | X or Esc | B | B button |
| Tool ring / quick swap | Tab hold / Tab tap | LB hold / tap | long-press ring button / tap |
| Pause menu | P or Esc | Start | ≡ button |
| Map / Ledger / Party / Field Log | M / L / I / F | Select cycles | pause menu tabs |
| Battle speed toggle | 1–4 | RB | speed chip |
| Mute | 0 | — | settings |

Touch controls appear automatically on pointer-coarse devices; every menu works with d-pad plus two buttons; input buffer flushes on every scene change and menu open.

---

## 13. Art and audio direction (one page)

**Canvas.** 480×270 native, 16×16 tiles (30×17 visible), integer scaling only (`floor(min(w/480, h/270))`, min ×1), nearest-neighbour, one canvas plus a 480×270 UI pass; Large Text draws dialogue glyphs at 2×. Camera snaps to whole pixels.

**Palette.** One master of **32 keys**: Sweetie-16 as the Wildshift letter set (k n v w g t e o r y i s d p l b) plus Porchlight's night ink `#141B33`, cream `#F6F1E3`, deep blue `#2B3A67`, porchlight amber `#F9C46B`, lighthouse amber `#FFB547`, bioluminescent cyan `#3FF2E0`, glasswort crimson `#A3283A`, brass `#D9A441`, ledger paper `#F4F1E6`, wax red `#A8323A`, tally wood ×2, skin ×3, and **m comet magenta** (`#E04DAA`, reserved: Heartmarks, skyglass, Shift effects, Forecast panel, Vagary). No pure black or white. Amber is reserved after dark so the harbor reads as the progress bar. Night remaps g→t→n; nothing is multiplied or overlaid.

**How art gets made.** Every sprite is a string array with a per-sprite legend mapping characters to palette keys (`'.'` transparent). Creatures: 32×32, two front frames and one back frame, four anchor coordinates (head, chest, back, tail) for the Heartmark, a `mustNotReadAs` note, and a silhouette rule. People: 16×24 string art, 4 directions × 2 walk frames, player species as head/ears/tail layer swaps on one body. Tiles are **procedural painters** (grass tufts with ground between them and a 3-frame rustle; blocking trees with trunk, k base line and bottom-right shadow; water with 3-frame foam; wet sand two ramps darker with a hard tide line; mud that cycles cyan at a night low). At boot, strings become one atlas canvas; the atlas is re-coloured through the 7 hour-LUTs into 7 tile atlases (creatures, Heartmarks, skyglass, lamps, HUD and cursor bypass the LUT). The Heartmark is a 3px plus on icons and a 5px plus with corner glints on battle sprites, highlight w on cool bodies and y on warm. Lights are pre-rendered dithered discs (cap 16 on screen). Weather overlays cap at 35% opacity and a Clear Visuals toggle removes them. A Node test rejects any sprite that is not exactly 32×32 (or 16×24), uses more than 8 keys plus m and highlight, or places an anchor outside its own pixels.

**Game feel.** 60 fps world, 12 fps character animation, one anticipation frame per verb, squash ≤10%, hit-stop by effectiveness (0/2/4/6/8 frames), 2px camera nudge toward the attacker, screen shake only on THWAP and crits, Shift pixel-scramble 90 frames resolving outward from the Heartmark (reduced motion: 20-frame dither crossfade), Lantern capture with no throw, no wobble, no click. Every colour signal pairs with a word, glyph or bar.

**How music gets made.** A tiny tracker in `audio/tracker.js`: 16-step patterns, 6 voices (2 pulse, triangle bass, noise percussion, a "glass" FM sine for harmonica and skyglass, one plucked-string voice for the harbor band), tempo per theme, patterns chained into songs; stems are voice groups on gain nodes. Six day-part themes (dawn, morning, afternoon, dusk, night, deep night) each carry a base and three stems: **night** (low brass register, pulses drop an octave), **low tide** (glass harmonica over mud ticks, wader calls, dripping pilings), **rain** (brushed noise). The hour turns over a two-bar bridge. The 4-note **Heartmark motif** opens the title, the home theme and every Shift sting; the falling **Vagary phrase** marks Errants, skyglass and faction scenes; **Your Signal** is the door chime, Dimity's hum and the ferry horn. Each form gets a cry from three parameters (base pitch, slide, waveform); bonded creatures' cries end on the same 2-note tail. Sliders for music and SFX, a mute key, captions for the bite, the bee hum, mail and the hour.

---

## 14. Risks, mitigations, cut order, architecture, tests, build order

### Risks of the merge

| Risk | Mitigation |
| --- | --- |
| **Two loops compete for a 24-minute day** | The clock pauses in battle and menus; routes cost 6–8 real minutes; one gate with three boards plans the day; Spire shares make badges pay the loan so neither loop feels like a detour; the bot's full run logs minutes-per-system and we tune until no 24-minute day is more than 60% one loop |
| **Clock pacing** (tides missed, night skipped) | Two lows a day and a low in any 12.5-hour window are unit tests; nothing is tide-exclusive; porch sit runs ×6; Rest skips to 6 am by choice; Real Clock mode is a setting, not the default |
| **Battle length vs cozy pace** | 1–3 creature trainers, instant text, 2× default, 4-turn wild target, Scrap and Mends end stalls; a headless battle simulator reports median turns per trainer class and fails CI above 8 turns |
| **Content volume** (42 forms, 56 letters, 24 maps, 15 songs) | Everything is data in one format each; a sprite linter; Star-touched forms are palette swaps; letters are short and written early; maps are string grids with a connectivity test; the cut order below is ordered by art cost |
| **Save schema drift across two systems** | One versioned schema with a checksum, migrations table, a round-trip test for every system's state, three rotating autosaves + three manual, verified write (temp → read back → checksum → swap), red *Not saved* banner |
| **Doubles, seasons, 8 Spires, 4 Keepers, 7-phase Vagary** | Cut before day one: singles only, one autumn season, 6 Spires, 2 Keepers, 4-phase Vagary |
| **Phone performance** | Cached tile layers per LUT, 16 lights, ≤64 entities, fish as counts per reach, particles ≤200, ≤600 draw calls, audio ≤12 voices; a perf test fails under 55 fps on a throttled headless run |
| **Soft-locks** | 0-PP unselectable, Scrap, Run greyed with reason, confirms on one-of-a-kind items, menu state graph test, checkpoint fuzzing |

### Cut order (first to last; protected items never cut)

Protected: 24-minute day with two tides; 7 loans and the ceremony; the Forecast with odds; Read and the Ward tell; Lantern with odds and Stance; one letter per morning; the Relighting; verified saves; the debug hook and the bot; 60 fps.

1. Freefall and Custom dials (keep as hidden toggles). 2. Challenge modes beyond No Rewind and One Heart. 3. Summit Keepers 2 → 1. 4. Vagary post-game fight (keep the sea-stack sighting). 5. Spires 6 → 4 (Relay and Weather become route trainers; Hallorans and Ines stay as isle NPCs). 6. Isles 6 → 4 (Thistlewind and Rimeholt fold into Drownwood and Cairnhold; Mirror Spire moves to Cairnhold's ice cave). 7. Player species 6 → 3. 8. Bugs 10 → 6, shore finds 6 → 0. 9. Forms 42 → 36 (drop Hulkwight, Coilcrest, Strandrunner, Emberjaw, Reedkit, Rayling). 10. Life threads 8 → 6 (Linnet and Tobin ride story beats only). 11. Letters 56 → 50 (town-history stream). 12. Battle themes 5 → 3. 13. Furniture to 12. 14. Commons projects 6 → 4.

### Module and data architecture

```
saltlight/
  index.html  css/style.css  README.md
  js/data/      types.js forms.js families.js techniques.js abilities.js items.js discs.js
                trainers.js neighbors.js threads.js letters.js fish.js bugs.js finds.js
                loans.js economy.js schedule.js commons.js dialogue/*.js maps/*.js music/*.js palette.js sprites/*.js
  js/rules/     rng.js clock.js tide.js weather.js battle.js damage.js shift.js capture.js
                exp.js economy.js ledger.js letters.js threads.js fishing.js forage.js
                save.js (schema, checksum, migrate) seedvalidate.js
  js/engine/    loop.js input.js (kb/pad/touch) render.js atlas.js lut.js audio/{tracker,sfx,mixer}.js
                scene.js text.js ui/*.js
  js/scenes/    title.js lease.js overworld.js battle.js forecast.js capture.js ceremony.js
                ledger.js archive.js shop.js daypage.js relighting.js credits.js
  js/debug.js   (?debug=1 hook)
  test/         *.test.mjs (node:test)   e2e/ fullrun.spec.mjs (Playwright)
```

Rules and data import nothing from the DOM; `engine` is the only layer that touches `document` and `AudioContext`. **Seeded RNG streams**: a 10-character seed code encodes dial + toggles + 32-bit seed; `rng.stream(key)` derives independent xorshift streams by hashing the key, e.g. `shift:<creatureUid>:<n>` (Reroll pulls the next draw), `encounter:<mapId>`, `tide`, `weather:<day>`, `shop:<day>`, `glint:<day>`, `capture:<battleId>:<attempt>`, `trainerTeams` (fixed at new game). **Save schema v1**: `{version, seed, clock:{day,minute,paused}, player, party[], box[], bag, keepsakes, buttons, starsalt, stones, ledger:{loanIndex,paid,purse,commissions,roof[]}, badges[], flags{}, fieldLog{}, archive{}, letters:{keeperNext,familyNext,townUnlocked[]}, threads{}, neighbors:{memory,lines}, world:{tiles overrides, commons, lamps, reaches}, settings, checksum}`; FNV-1a over the canonical JSON; three rotating autosaves at doors, Waystones, before Spire doors, after catches and Shifts; manual slots in the pause menu, Save always last.

### Automated test plan

**Node unit tests (run in CI, no DOM):** type chart has exactly 56 non-neutral pairings and Hollow is the only immunity; damage formula monotonic and clamped; evasion cap +2 and accuracy ×0.83/×0.67; Mends budget 3 then recovery fails; 0-PP moves never selectable and Scrap fires when all empty (singles, trainer, wild, after a refused Run); Forecast cards always three, odds sum to 100, Bond caps per dial, stat floor per dial, star-touched 2% outside flattening, same seed + same choices = same cards, Reroll advances the stream; capture odds shown equal odds rolled, +3% per fail capped +15, Stance floor 1 HP; tide: period, drift, "every 12.5-hour window contains a low", first-day lows at 7:10 pm; schedule: a buyer exists at every minute; LUT state for every hour; loan arithmetic (238,200), abacus click counts, Spire and resident shares; letters: fixed order, one per date, no accrual on skipped dates, clock change adds at most one; save round-trip for every subsystem, checksum detects a flipped byte, migration from v1; map validation: every walkable region connected at some tide, every Spire and Waystone reachable by the any-tide route, grass tiles never share a painter with trees; seed validator: Crackdust stocked before every mandatory Ward, chip-damage disc by badge 1, every disc has ≥25% learners and one on its route, no Ward before Cairnhold; sprite linter; dialogue linter (every line tag resolves, no five-day repeats in a simulated week); **economy sim**: an average-day model lands the Relighting on day 11–16 and never requires a grind over 30 minutes.

**Headless battle simulator:** 2,000 seeded fights nightly; median turns per trainer class; no fight exceeds 40 turns; every Spire leader beatable by the posted curve-level party in ≥70% of sims.

**Playwright bot (`?debug=1`):** `window.saltlight` exposes `setTimeScale(n)`, `setClock(day,hour)`, `setTide(phase)`, `warp(mapId,x,y)`, `grant(itemId,n)`, `giveButtons(n)`, `setParty([...])`, `press(button)`, `autoBattle('bestEffect')`, `skipText()`, `state()`, `frameHash()`. `e2e/fullrun.spec.mjs` plays: title → new game → lease card → arrival → first creature → Linnet hold-out → errands → first catch → loan 1 → Forecast → letter 1 → each isle's Spire in order (auto-battle, buying Crackdust when the validator says) → each loan (earns buttons by scripted fishing at ×8 time, then grants only if a day's income falls under the model's floor, logging the gap) → Surge → loan 7 → Relighting → credits → Summit → Vagary → Seed Card; asserts zero console errors, every save verifies, no frame hash repeats for >3 s outside a Rest, and total real time ≤ 25 minutes at ×8. A second spec opens and closes every menu from every scene and compares frame hashes (black map fails). A third fuzzes 10,000 random inputs from five checkpoints (post-arrival, badge 2, loan 4, pre-Summit, post-credits) and fails on any exception or frozen frame.

### Performance budget (per 16.6 ms frame on a 2019 laptop)

Simulation 3 ms (town schedule ticks once per in-game hour, off-screen fish as counts) · tile blit 2 ms (cached per map per LUT, incremental re-render during crossfade) · entities ≤64, 3 ms · lights ≤16 pre-rendered, 2 ms · particles ≤200, 1 ms · UI 2 ms · headroom 3.6 ms. Memory: one atlas ≤ 2048×1024 plus 7 LUT tile atlases; no per-frame allocation in the hot loop; audio ≤12 voices, music scheduled 200 ms ahead.

### Build order (what is playable after each step)

1. **Skeleton** (loop, input, atlas from strings, one map, player walks; debug hook; tests boot) · 2. **Clock, tide, LUT, weather, Skyband**; boards at the gate · 3. **Town verbs**: shake, dig, fish, talk, satchel, ring, Pell's, Crate, Rest, Day Page, verified save · 4. **Loans and ceremony**, dawn build, scaffolding, roof colour; economy sim passes · 5. **Creatures**: data, battle engine, Read, Ward, Scrap, Mends, capture, Stance, EXP, Field Log; battle simulator passes · 6. **Shift system**: windows, Forecast, Reroll/Anchor, Heartmark, Shiftlog, Memory, presets, Waystones · 7. **Hub story**: lease card, arrival, Corin, Linnet, errands, letters stream, Hesper, Barnaby wall; bot reaches loan 2 · 8. **Isles 1–3** with Spires 1–3 and trainers; skiff · 9. **Isles 4–6**, Spires 4–6, factions, Surge, Linnet's arc, Tobin · 10. **Relighting, credits, Lit Causeway, Summit, Vagary, Seed Card**; bot completes the arc · 11. **Threads, porch talk, Porch Duels, Commons, Odile, Tamsin, Ansel** · 12. **Music and SFX** full set, stems, cries · 13. **Polish**: particles, hit-stop, scramble, accessibility, touch layout, settings · 14. **Content fill** to the counts in section 10, dialogue linter green · 15. Fuzz, menu graph, perf gate, README.

---

## 15. Top decisions

1. **One 24-minute day with the clock paused in battle and menus** — the two loops share a day without either eating the other's tide.
2. **Buttons are the only money; Starsalt is the only steering currency** — one wallet, one clear job for the second resource, no dual-currency hacks.
3. **Porchlight's ladder divided by ten (238,200◉), prices kept** — a 4–8 hour arc with the 7-night floor intact and fruit that still feels like fruit.
4. **Badges never gate loans but each pays one (10% Spire share)** — the reader loop funds the keeper loop without forcing either.
5. **The Relighting is the ending and does four cheap, visible things** — causeway, steadied dice, fleet home, comet answers; each is one flag.
6. **Summit and Vagary are the post-credits crown** — the hard constraint names the Relighting as the ending; this keeps the Champion without a second gate on the house.
7. **Starfall = Ebb winter = Night of Wrong Shapes** — one night explains the dark lamp, the sandbar and the Shifting, so the letters tell one story.
8. **Six Spires, two Keepers, no doubles, one season** — the single biggest engine and content savings; everything cut is named in the cut order, not forgotten.
9. **Isles have a low-tide short way and an any-tide long way** — honours "the tide never traps" and "nothing tide-exclusive" with no special cases.
10. **First window at Lv7 and a scripted 100% first capture** — the first 30 minutes deliver a real Forecast and a real Lantern without luck deciding the opening.
11. **42 forms at 32×32 string art, icons cropped at the head anchor, Star-touched as palette swaps** — the roster fits what agents can hand-encode and lint.
12. **Letters in three streams (20 Keeper, 18 family, 18 relic-linked) totalling 56** — fits 14 days at one per morning without starving the serial or gating anything.
13. **Shelter functions distributed to Pell's, the Archive, the cottage and the Mooring Post** — Wildshift's building becomes town rather than a second hub.
14. **Porch Duels are the Rematch board** — neighbors are never fought for real, yet repeatable income and EXP exist on demand.
15. **Blackout returns you to your porch at 10% capped 500◉, never the loan** — a failure state that is a Porchlight sentence, not a Wildshift punishment.
16. **Every rule in `js/rules`, every number in `js/data`, no DOM at import** — the unit tests, the economy sim and the battle sim all run in Node.
17. **One debug hook and one Playwright full run as the definition of done** — "fully playable start to finish" is a passing test, not a claim.
18. **Procedural tiles, string sprites, 7 hour-LUTs applied at atlas build, lights as pre-rendered dither discs** — triple-A readability on a phone at 60 fps with no assets.
19. **Six day-part themes with night/low-tide/rain stems from a tiny tracker** — hourly music that changes with the clock and the tide for the cost of 15 sequences.
20. **Written cut order ordered by art cost, with a protected list** — if time runs short the game gets smaller, never broken.
