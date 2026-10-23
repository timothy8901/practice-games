# GDD-00 — DECISIONS (authoritative)

This file is the single source of truth. Where a chapter, prototype or concept disagrees with it, this file wins until it is edited. Every number here is a starting value that lives in a data module (`js/data/tuning.js`, `loans.js`, `dials.js`, `shops.js`, `items.js`); chapters may refine a value only inside the ranges stated here and must not rename anything. "Judges" means the three panel reports; a ruling marked *(split)* records the one-line reason a disagreement was settled.

---

## 0. Title, tagline, pitch

**LAMPFALL** — *A Keeper's Season on the Brindle Isles*
Folder `lampfall/`, save prefix `lampfall.`, `config.TITLE = 'Lampfall'`.
*(split: two judges chose Lanternfall; the third found it already names released games. A known collision is a strong reason. "Lampfall" had no exact match and still means both the lamp going out and the sky coming down.)*

**Tagline:** *Read the odds. Pay what's owed. Keep the light.*

**Pitch.** You walk into Pellwick at dusk, the last person to cross the tidal causeway on foot, as the sea closes over the stones behind you. A beaver with a lantern hands you a lease card, an interest-free loan and the key to the Keeper's Cottage under a lighthouse that has been dark for thirty years. On the last dry stones three small creatures sit in the lantern light; one of them picks you, and when you name it a magenta Heartmark lights on its brow. From then on you live one life on one clock: by day you shake trees, fish the quay, dig the flats and walk the tide-gated causeways to six isles whose Spires test how well you read creatures that Shift into new bodies on odds you can see first; by night the porches come on, someone is always buying, the mud glows cyan, and neighbors talk on their steps. Every morning a snail delivers one thirty-year-old letter from the last keeper, and the letters explain why the light went out and why the creatures began to change: it was the same night. Seven loans grow the cottage and climb the lighthouse scaffold; the seventh payment relights the lamp, the comet comes down to the light, and you read it.

---

## 1. Pillars

| # | Pillar | Promise |
|---|---|---|
| 1 | **Read before you roll** | Every Shift and every capture shows its odds before you commit, nothing ever asks for timing, and Read is always one button away. |
| 2 | **The night is half the game** | From 18:00 to 06:00 the harbor has its own buyers, fish, creatures, talk and glowing flats, and the lights you earned are the only warm colours in it. |
| 3 | **Owe without fear** | The loans have no interest and no deadline, a blackout carries you home, nobody scolds, and one-of-a-kind things always ask first. |
| 4 | **One town, one clock** | Every creature system has a town address and every town verb has a creature hook, so there is no seam to find. |
| 5 | **Same mark, every shape** | Whatever body a creature Shifts into, its nickname, level, Bond, Heartmark technique and the mark on the same spot say it is still yours. |
| 6 | **Tomorrow, always** | Every day leaves a thread you chose open overnight, and every session ends on Dimity's list that begins *Tomorrow:*. |
| 7 | **Progress you can see from the porch** | Lit porches, the climbing scaffold, split tally sticks, wax seals and finally the beam show how far you have come without a menu. |

---

## 2. The fiction

**Thirty years ago, one night.** The **Ebb winter**, the **Starfall** and the **Night of Wrong Shapes** are the same night. The harbor bar had been rising for years because the mill weir built by **Ansel Stalk's grandfather** held back the river that used to scour it; the oil boat could no longer cross. Keeper **Isolde Petrel** traced it in her tide log, and kept a second log once the sea began to hum and "a wanderer on a thirty-year road" appeared. On the storm night she filled the lamp from her last can and took her Siltback upriver to open the seized sluice. The comet **the Vagary** broke over the Brindle Isles while she was at the wheel: its head dug the **Starfall Lagoon** and threw up the atoll **Shardcrown**; its shards fell as **skyglass** into the river, the flats and the lagoon. Her Siltback Shifted under her hands; the wheel needed two; the lamp ran dry at midnight; every draft creature in the harbor Shifted mid-tow; the fleet grounded on the unlit bar. Everyone waded home; every boat in Pellwick's fleet was lost. Young harbormaster Ansel Stalk wrote the report that named the keeper. Isolde left for the Outer Isles; her letters went into the post sack the week the office closed.

**The Vagary** is the comet on a thirty-year orbit and the creature it carries, **the Passenger**; the game treats them as one visitor. Its core is the **Heartshard**. Field Log: *Vagary (the Passenger)*, Star, ability Unfixed, never Shifts, never on a Forecast card. **Skyglass** is comet shards that hum; every creature born since grows under the hum and carries a faint four-point **Heartmark** that lights comet magenta when it bonds. Skyglass relics surface on the flats at a night low; the Scatter refines the dust into **Starsalt**.

**Why the light stayed dark.** No oil could cross the bar and no boats were left; the keeper was blamed and gone; and **Provost Agathe Merrow**, the harbor nurse who lost her patients' bonds that night, founded **the Mooring** on one rule, *light calls the change* (skyglass creatures drink light: Prismoths gather at lamps). The town accepted the dark because nobody was paying attention. Paying attention, and paying what's owed, is the player's verb.

**What Shifting is.** Growth meeting skyglass pressure. About three times in a life (its **windows**) the mark glows and the creature will Shift **Up** (higher stage), **Side** (same stage) or **Down** (lower stage) into a body from its family pool. A **Shiftreader** sees the lean; the Reading Glass shows it as the three-card **Shift Forecast** with odds. **Accept** lets it land; **Anchor** (a Mooring stone) refuses this window; **Reroll** (Scatter Starsalt) redraws the cards. A Shift never touches level, EXP, held item, nickname, Bond, trained stats, the Heartmark technique or the mark's position.

**The factions.** The **Mooring** (Merrow) would stop change: anchor stones from Cairnhold granite, licences, Still Knots, the Anchor Pulse, and the Sinking Engine to sink the Heartshard when the comet comes down. The **Scatter** (Teo Varga, ex-Mooring) wants more of it, because only Shifted swimmers survived the drowning tides: Starsalt, Shift fairs, the Carnival Raft, and charges to crack the Heartshard and seed every isle. The player works for both; no meter scores a choice.

**What the Relighting does (six save flags, each one rule).**
1. `lit.shiftTide` — **Shift Tide line**: every pending window is chalked on the Tide Table and the Day Page a tide ahead, with its three cards already drawn.
2. `lit.steadied` — **Steadied dice**: after Bond, 5 points move Down → Side on every dial (Drift 50/45/5, Flux 40/40/20, Freefall 30/35/35). The Forecast header reads *Lit coast: steadied*.
3. `lit.keepersAnchor` — **Keeper's Anchor**: once per night (18:00–06:00) one Forecast opened at home may be Anchored free.
4. `lit.fleetHome` — **The fleet comes home**: the ferry horn answers with Your Signal; the seven remaining dark houses reopen one per night; Tamsin's boat can float; Maud's ring line runs to the Outer Isles post-game.
5. `lit.bar` — **The lit Bar**: the drowned tide-road from the point to Shardcrown becomes walkable at any tide.
6. `lit.calls` — **Light calls the change**: that night the Passenger descends to the Lantern Stack for the Reading; afterwards it perches there, catchable; Errants come to the lit point at night (1 in 120 night encounters on the point).

**How letters, loans, badges and Shifts pace each other.** Loans gate only the house, the scaffold, the Lamp Room and the Relighting. Badges gate reader tools and the Summit, never passage or loans, but each badge *pays* toward the loan (the Spire share). Letters gate only their own threads and heirlooms. Shifts gate nothing; levels drive them. Tide gives shortcuts and bonuses only. The two tracks meet at the end without walling each other: the Relighting needs only a zero balance; the Summit needs six badges; the ending dialogue branches on whether Idris has been beaten.

---

## 3. The player and the opening

**Lease card** (every field visible; editable at the cottage mirror from loan 2): **species** on one 16×24 rig with head/ears/tail swaps: water vole, **pine marten**, red panda (default), opossum, ferret, mongoose *(split: pine marten replaces the IP-flagged river otter, two judges of three)*; fur palette (8 per species); markings (mask, socks, stripe, freckles, blaze); eye shape (3); blush; outfit (lighthouse-stripe jumper; co-op apron during errands); **pronouns** (separate field); **name** (default **Sorrel**, controller-first entry with confirm); **town name** (default **Pellwick**; letters and signs use it); **Your Signal** (six notes on six pentatonic chimes, D E F# A B D: door chime, Dimity's hum, Wick's whistle, the ferry horn's answer). The card's back holds the Chaos dial ("How do you like your odds?": Drift *gentler* / **Flux** / Freefall *wild*), the seed code, challenge seals and the blackout wake point (porch or last Waystone). Wren's small talk sets only your windowsill plant and tomorrow's weather, and she says so.

**The Lantern.** Wren hands it over with the key on the causeway: the co-op's **Keeper's Lantern** ("Co-op issue. Finds your door. Finds other things, I'm told; ask the owl."). It is the one reusable capture device; each raise burns one **wick**. Starter kit: Lantern, 5 Tallow Wicks, rod, net, shovel. **Isolde's Lantern** waits in Juniper's back room until the Relighting. *(split: two judges of three keep the heirloom for the finale.)*

**The first creature.** Minute ~4, as the rising tide closes the causeway, three creatures sit on the last dry stones, drawn to the Lantern: a **Sloshkin** (Brine), a **Scrapling** (Grit) and a **Reedkit** (Moss). Kneel beside one and it pops up and follows; kneel by all three if you like; the one you stay beside is the one that picked you. Raise the Lantern: a scripted **100%** draw-in teaches raise, draw-in and the three-segment meter without a roll. Name it (Sloshkin suggests PUDDLE); the Heartmark lights on the name (first magenta pixel of the game, the four-note motif). Starter Lv5. Journal stamp *Someone Picked You*. The other two are wild on Lowmoor (Brackenford flats, 15% each) from day 2.

**The teachers.**

| Lesson | Teacher | When and where |
|---|---|---|
| **Read** | **Corin Vale** (tawny owl, failing eyes, Isolde's old apprentice) | minute 6, your step: the **Reading Glass** (Isolde's old loupe: names finds, Reads creatures, opens Forecasts) and, on Flux, 2 anchor stones. "Look before you swing. Then say what you see." |
| Watching a Forecast | Corin | minute 7, reading Linnet's strip aloud |
| **Capture Stance** | Corin | minute 14, the reeds: "62%, and it only goes up if you miss." |
| Fishing tells | **Ansel Stalk** | night one, from the beached launch: "Forked tail, by the piling. Don't rush it." |
| **Reroll** | **Maud Tallis** | her practice table at Brackenford, before the Turn Spire |
| Decline | Linnet | day 2, refusing you until badge 1 |
| The loan | Wren, once | "Pay it when you can." |
| Porch Duels / Field Log | Tully / Barnaby | first porch talk / first find |

*(split: Capture Stance stays with Corin, the source and two judges; Ansel gets the fishing tells.)*

---

## 4. The world

**Pellwick** (hub, 64×48 tiles), a tidal-island harbor town at the near edge of the isles. North: the river with its bridge and stepping stones, the empty **north creek**, the weir, Ansel's beached launch. Centre: the **green** with the **Commons board**, the Warden's house, the post office (Ludo hangs from its eave), **Barnaby's Archive** (Corin lodges upstairs), **Pell's Sundries**, the **co-op yard**. South and east: the **quay** with the **Anchorage** (Mooring office), Maud's berth, the **Old Pier** (Carnival Raft from day 3), the **Old Quay** (bared at spring lows). West: **the point**: the **Keeper's Cottage**, the dark lighthouse, the **point flats** (the Glint, sparkles, glowing mud) and the start of **the Bar**. ~100 named fruit trees, 6 purse trees, ~4 bee trees, 2 river and 2 quay reaches, and the reed edges (the only wild encounters in town, Lv2–5). The mainland causeway (arrival only, ±1 h of low) leaves from the east.

**Porches (20).** 7 lit at arrival (co-op yard house, Pell's, post office, Archive, Warden's house, Tully's, Linnet's); yours at loan 1; four neighbor porches light when a family letter returns their heirloom (the Dorrows', Odile's, Bryony's, Thessaly's); eight dark houses: house 1 by Commons project (Tamsin), houses 2–8 one per night after the Relighting.

**The isles.** Six, in a ring around the Starfall Lagoon; the critical path goes once around and never backtracks. Each has a **low-tide short way**, an **any-tide long way**, a dock **Waystone** (autosave, deferred Forecasts, tide chalkboard, heals once per tide), a skyglass node (1–2 Starsalt, refills per badge), two reaches, a dig site, 5 route trainers (optional ones declinable), a ferry stop and a Spire. Posted **curve level** = ace − 3; night wild levels +2.

| # | Isle | Short way (tide) | Long way (any tide) | Wild Lv | Spire · leader · theme · ace | Waystone | Holds |
|---|---|---|---|---|---|---|---|
| 1 | **Lowmoor** | stepping stones from the point flats (±2 h) | river footbridge + marsh boardwalk | 3–8 | **Turn** · Maud Tallis (greylag goose) · posted scripted Shifts · Bilgebob Lv10 | Brackenford | tide flats, marsh, the old ferry pavilion, Maud's practice table, Linnet's rematch stones; Sloshkin, Scrapling, Reedkit, Tossup, Puddlepip, Wirewhisk, Mudfist |
| 2 | **Cairnhold** | causeway from Lowmoor (±2.5 h) | quarry road | 9–14 | **Ward** · Osric Penhallow (tortoise) · Wards · Prismoth Lv16 | Knapp's End | quarry, standing stones, the Mooring clinic (stones, Still Knots, Crackdust), the memorial; Prismoth (first Ward; none before here), Chillnub, Mothling, Cairnward (rare) |
| 3 | **Emberstep** | stepping stones from Cairnhold (±2 h) | cliff path | 15–20 | **Weather** · Ines Calloway (crested newt) · posted 3-turn weather · Emberjaw Lv22 | Sulphur Cross | volcano, spa terraces; Sootling, Sedgehare, Rayling; **Squallcoil** (first Errant) roams |
| 4 | **Drownwood** | causeway from Emberstep (±2.5 h) | mangrove boardwalk | 22–27 | **Hollow** · Wendel Teague (grebe boatwright) · immunities · Hulkwight Lv29 | Mossgate | drowned forest, stilt town, the drowning street, Scatter rescue, Anchor Pulse misfire; Creelwight (Tamsin's nameboard), Bilgebob, Rushling, Rustcreel, Duskwisp |
| 5 | **Thistlewind** | causeway from Drownwood (±2.5 h) | moor footbridge | 29–34 | **Relay** · Ada & Ivo Halloran (jackdaw twins) · no-repeat rounds, singles · Coilcrest Lv36 | Windle | moor, windmills, the Surge; Skirl, Duskowl, Coilcrest, Gillwick, Stillox (rare) |
| 6 | **Rimeholt** | stepping stones from Thistlewind (±2 h) | ice path | 36–41 | **Mirror** · Seraphine Locke (arctic fox) · evasion, Mends, true odds · Lumenveil Lv43 | Frostwick | glacier, mirror-ice caves (3-tile light radius), Idris in the gallery, Linnet's return; Rimeplate, Floeback, Lumenveil, Strandrunner; **Hailcoil** (Errant) |
| — | **The Bar** | from the point: to Shardcrown ±1.5 h of the day's lower low (any tide after the Relighting); spur to the Lantern Stack ±1.5 h of every low | — | 40–44 | Long Road: Hollis Brandt's six-trainer gauntlet; Wick halfway | Hollis's Gate | the wreck ribs of the lost fleet, tide pools |
| — | **Shardcrown** | via the Bar | — | 44–48 | **Summit**: Keepers Bastien Kell, Cass Rune; Champion Idris Fenwake Lv50; the Summit Bell | — | the old brazier the Keepers tended through the dark years |
| — | **The Lantern Stack** | Bar spur | — | — | Merrow's Sinking Engine (Act III); the Reading (finale); the Passenger's perch | — | sea stack under the comet's path, visible from the Lamp Room all game |

```
                                  N
     [6] RIMEHOLT ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ [5] THISTLEWIND
      Mirror Spire, Frostwick      ~  stones (+-2h) ~    Relay Spire, Windle
      ice caves, Hailcoil  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~  moor, mills, the Surge
         |                                                   |
    ice path (any)            STARFALL LAGOON          causeway (+-2.5h)
         |              ~ ~ ~ [SHARDCROWN] ~ ~ ~        moor footbridge (any)
         |              ~   Summit, the Bell   ~             |
     ............       ~         ||           ~       [4] DROWNWOOD
     (ring closes)      ~      the BAR         ~        Hollow Spire, Mossgate
                        ~ (lower low / lit) o<-- LANTERN STACK (Engine, the Reading)
                        ~         ||           ~             |
     [1] LOWMOOR <======stones====[ THE POINT ]         causeway (+-2.5h)
      Turn Spire,       (+-2h)    cottage+lighthouse    mangrove boardwalk (any)
      Brackenford               point flats (Glint)          |
         |              +-------------------------------+ [3] EMBERSTEP
   causeway (+-2.5h)    |  P E L L W I C K  (hub)       |  Weather Spire,
   quarry road (any)    |  green + Commons board        |  Sulphur Cross
         |              |  quay . Anchorage . Old Pier  |      ^
     [2] CAIRNHOLD -----|  post office . Archive . yard |  stones (+-2h)
      Ward Spire,       |  river . north creek . weir   |  cliff path (any)
      Knapp's End       +-------------------------------+      |
      clinic, memorial ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~+
         mainland causeway (arrival only) ====> east
   Maud's ferry: quay -> every isle dock, any tide, 05:00-01:00
```

**Tide rules.** Causeways ±2.5 h of low (5 real minutes, twice a day), stepping stones ±2 h, flats and sparkles ±1.5 h, the Bar ±1.5 h of the lower low (until the Relighting), the mainland causeway ±1 h. High tide brings quay shoals and Brine encounters. A **spring tide** every 7 days (days 7, 14, 21…) bares the Old Quay. **Wade rule**: if the sea comes up under you, you wade to the nearer Waystone free ("The sea came up. You waded."). No badge or loan gates passage; a map test proves every Waystone and Spire reachable at any tide. No form is exclusive to a tide or to night: each has a day habitat and an any-tide habitat.

**Fast travel.** **Maud's ferry**: quay to every isle dock, any tide, 05:00–01:00, **200◉** until badge 2, then free; the destination card shows the posted curve; cursor starts on No. (Pellwick's fleet was lost; Maud's shallow ring-line punt came in from the Outer Isles three years ago.) **Lantern-paths** from badge 2: Ludo has lit every Waystone you have visited; walk between any two, or home, instantly at any tide. *(split: two judges keep the ferry; the punt resolves the third's "no boats" objection.)*

---

## 5. Clocks and the session

**Day length.** Default one in-game day = **24 real minutes** (1 real minute = 1 game hour; 1 real second = 1 game minute). Settings: 12 / 24 / 48 minutes, and **Real Clock** (device time; Rest saves but never skips; builds take a real night; the setting says so). The clock **pauses** in battle, Forecast, capture, menus, dialogue, shops, ceremonies and the Day Page. Real time per day is therefore 24 minutes plus paused time.

**Day-parts** (one table, consumed by music; the LUT keyframes in `proto/tiles/render.js` follow the same hours). Night (game rules) is **18:00–06:00**, exactly half.

| Day-part | Hours | Real min (24-min day) | Theme (proto id) | Night rules |
|---|---|---|---|---|
| Deep night | 00–03 | 3 | `h_night_deep` Harbor Asleep | yes |
| Pre-dawn | 03–06 | 3 | `h_predawn` Before the Gulls | yes |
| Morning | 06–09 | 3 | `h_morning` Porchlight Morning | — |
| Late morning | 09–12 | 3 | `h_late_morning` Gull Market | — |
| Midday | 12–15 | 3 | `h_midday` High Sun on the Water | — |
| Afternoon | 15–18 | 3 | `h_afternoon` Long Shadows | — |
| Dusk | 18–21 | 3 | `h_dusk` Lamps Along the Quay | yes |
| Night | 21–24 | 3 | `h_night` Porchlight | yes |

**Anchors.** 05:40 the Thatch tie off any overnight build (watchable) · 06:00 mailbox (one Keeper letter), the Ledger Board, the Tide Table, the Commons slip at your gate, the Crate result · Pell's 08:00–22:00 · Wren's yard 06:00–24:00 · the Archive 09:00–19:00 · Maud's ferry 05:00–01:00 · Hesper's counter 18:00–02:00 (one family letter from 18:00) · porch talk 19:00–01:00 · **Porchlight Hours** 20:00–02:00 · Ludo buys 22:00–08:00 · the Carnival Raft 12:00–02:00 from day 3 · Lantern Market Saturdays 20:00–02:00. **Someone is always buying** (unit test: a buyer exists at every minute).

**Tide model.** Two lows 12 h 25 m apart (12.4 real minutes), each day 50 game minutes later than the day before; any 12.5-hour window holds a low (a calendar day occasionally holds only one). Day 1 is **seeded**: low 16:40, so the mainland causeway closes at 17:40 behind you on a rising tide; then 05:05 and 17:30 on day 2, 05:55 and 18:20 on day 3, and so on (day *n* morning low = 05:05 + 50 min × (*n* − 2)). Day 1 is a Sunday; Saturdays are days 7, 14, 21 (Lantern Market and spring tide fall together).

**Night rules (18:00–06:00).** Night encounter table (Hollow, Glass, Rime lean; +2 levels; Errant lightning on the map); Prismoths and moths at lit porches and string lights; night fish (John Dory 2,400◉, lantern wolffish 4,200◉); at a night low the flats glow cyan and give up skyglass relics (max 3 per night low); Ludo buys; porch talk and Porch Duels; Hesper's counter; Porchlight Hours.

**The ideal day** (mid-game, 24-minute setting; real minutes count running clock only, so a Spire adds ~5 paused minutes on top).

| Real min | Game | What a good day does |
|---|---|---|
| 0–1 | 06:00–07:00 | Mailbox: the Keeper letter. Gate boards: Ledger pace line, Tide Table (*Shifts pending*), Commons slip (odds, dossier, Porch Duel slate). The Crate's overnight sale. |
| 1–3 | 07:00–09:00 | Orchard with the Gust creature leading; one bee hum; two cracks; if the low is now, the Glint and the sparkles. |
| 3–4 | 09:00–10:00 | Pell's: sell, Wanted Today, wicks, Crackdust or an Ether; Barnaby names the finds in one batch. |
| 4–9 | 10:00–15:00 | The leg: the short way at the low or a Lantern-path; three trainers behind the Read strip; a catch; the skyglass node; Waystone autosave and deferred Forecasts; the Spire if ready. |
| 9–12 | 15:00–18:00 | Home; golden hour on the point with Odile; sell; pay at the yard: beads, gnaw, THWAP. |
| 12–13 | 18:00–19:00 | Hesper's counter: the family letter; carry it to a door; an heirloom comes home. |
| 13–19 | 19:00–01:00 | Porchlight Hours: porch talk beats, a Porch Duel, the Lantern Market on Saturdays; night fishing on the quay. |
| at the night low | ±1.5 h | Glowing flats: skyglass relics, night-leaning wilds, John Dory on the forked-tail tell. |
| 19–24 | 01:00–06:00 | Ludo buys from the eave; Rest; the Day Page and *Tomorrow:*. |

**Rest.** The bed offers *Lie down* (heal, 10 game minutes, any time), *Nap till dusk* (from 12:00, wakes at 18:00) and *Sleep till dawn* (**from 21:00**; before that: "Too early. Someone's always buying."). Before confirming Sleep, the Day Page lists what the night still holds (next low, Ludo, a porch beat, Prismoth at your lamp). The porch bench offers *Sit*: Day Page, verified save, and the clock runs ×6 while you sit (stand to stop). Builds land at 05:40 whether you sleep or not. Waystones heal once per tide and autosave; you sleep only at home. Real Clock never skips. *(split: 21:00 keeps at least the first Porchlight hour unskippable.)*

---

## 6. Loops and the failure state

| Loop | Length | What happens | Output |
|---|---|---|---|
| Minute | 1–3 s verbs | shake, cast, dig, net, talk, Linger; on a route Read, fight or decline, raise the Lantern | buttons, Field Log, open threads |
| Day | 24 game hours | letter → boards → tide plan → one leg or a town day → sell → pay → porch talk → night low → Rest | a payment or a badge; the Day Page |
| Week | 7 days ≈ 3 h | Monday thread beats, Saturday Lantern Market + spring low, weekly Archive Bounty | a loan tier, a badge or two, a thread finishing |
| Arc | ~14 days, 4–8 h | 7 loans, 6 badges, 20 Keeper letters, ~18 Forecasts | the Relighting → the Reading → credits → post-game |

**Cozy and combat coexist by address.** Neighbors are never fought; the only town fights are Porch Duels (friendly) and the reed edges. Trainers live on the isles. **Story battles never wall anything**: the dock hold-out, Linnet's fights, the Engine and the Reading continue on any result and never cost money. Spire and route losses use the blackout rule.

**Blackout.** When your last creature faints outside a story battle or the Summit: 40-frame fade to porchlight amber; you wake on your porch (or the last Waystone, per the lease card) one game hour later, party healed. Dimity: "You came home carried. I kept your place." Cost: **10% of buttons on hand, capped at 1,500◉, nothing if you hold under 500◉.** Half the dropped amount goes into **the Keeper's Purse** (wallet key `purse`), and comes back added in equal thirds to the next three Glints. Loans, items, Starsalt, stones and badges are untouched. Summit losses, Porch Duels and exhibitions cost nothing. The daylight is the real cost. No deadline, no scold, no guilt.

---

## 7. Economy

**Currency.** **Buttons (◉)**, brass, uncapped wallet (`main`). **Starsalt** (`starsalt`) is the one steering currency: Rerolls and Recall, nothing else, never sold back. **Anchor stones** (`anchors`) are counted in the wallet and priced in buttons. **The Glint** is the one buried purse on the flats each day. Low-tide sparkle spots on the flats are **sparkles** (finds), never "glints". The **Summit Purse is cut** (forced savings read as a deadline); `purse` holds only the Keeper's Purse refund above.

**Price list.**

| Item | Price | Where / rule |
|---|---|---|
| Tallow / Brass / Skyglass Wick (×1 / ×1.5 / ×2 capture odds) | 100 / 300 / 600 | Pell's; Skyglass from badge 2 |
| Salve / Tonic / Full Salve | 80 / 240 / 600 | Pell's |
| Revive (50% HP) | 600 | Pell's |
| Ether / Full Ether | 250 / 700 | Pell's from badge 3 |
| Poultice (burn, poison) / Warm Shawl (chill, numb) | 150 / 150 | Pell's |
| Crackdust (suppresses a Ward 3 turns) | 300 | Pell's and the Cairnhold clinic before any mandatory Ward; always below one route payout on that isle |
| Still Knot (held; blocks every Shift while held) | 2,000 | the Anchorage |
| Anchor stone | 500 (Flux) | Pell's, the Anchorage, Cairnhold clinic; Drift: 3 free, refilled to 3 per badge; Freefall: 1 per badge, not sold |
| Starsalt | 800, max 3 a day | the Raft (12:00–02:00, from day 3) and Ludo (22:00–08:00); the 3-a-day cap is shared |
| Technique discs (12, reusable) | 1,500–4,000 | Pell's (two a day, never randomized staples), Dov's sealed-crate auction at the first Lantern Market; Freefall asks to confirm above 2,500 |
| Reroll | 1 / 2 / 4 / 8… Starsalt | doubling within one window, no cap |
| Recall (return to any form in the Shiftlog) | 6 Starsalt | Corin at the Archive, from badge 4 |
| Memory relearn | free | Barnaby's Archive |
| Ferry | 200 | free from badge 2 |
| Commons projects (6) | 3,000–12,000 | the Commons Jar; neighbors add 10–30% |
| Furniture (24) / clothes (12) / string lights | 200–6,000 | Pell's rotating stock, the Lantern Market |
| Leftover room commissions | 20,000 each | after the Relighting |
| Isolde's Lantern (one sure catch) | Keepsake | after the Relighting; confirm, cursor on No |
| Spare items sold back | 50% | — |

**Income.**

| Source | Amount | Limit |
|---|---|---|
| Native fruit / ripe | 120 / 150 | ~100 trees, regrow in 2 days, ripe after 3 |
| Foreign fruit / ripe | 480 / 600 | grafts (Greenhouse), Lantern Market seedlings, gifts |
| Purses in trees | 200–600 | ~6 purse trees, one purse each a day |
| The Glint | 500 + 60 × day | exactly one a day, dug at any low |
| Honeycomb | 350 | ~4 bee trees, net the nest after the 1-second hum |
| Fish (18) | 80–4,200 | 4–8 shadows per reach; reach health dips when fished hard, floor 40%, recovers in a day |
| Bugs (10) | 60–900 | more at lit porches and string lights |
| Fossils / relics / shore finds | 300–1,500 / 300–1,500 / 100–400 | ~4 cracks a day; 3 sparkles per low; Barnaby buys duplicates; cleaned +40% |
| Skyglass relic | 1 Starsalt at the Raft, or 900◉ to Barnaby | max 3 per night low |
| Route trainer | 50 × highest level | once each |
| Spire win | 200 × ace (2,000 / 3,200 / 4,400 / 5,800 / 7,200 / 8,600) + 3 Starsalt | once |
| **Spire share** | 10% of the loan currently open, notched onto Wren's ledger | once per badge |
| Porch Duel | 30 × curve level | 3 a day |
| Errant beaten or caught | 2 Starsalt + 1,500 | each returns the next day |
| Wanted Today (Pell's) | +50% on 3 items | one stack each a day |
| Consignment Crate (at your gate) | 90% of value | overnight, anything |
| **Resident share** | 5% of the current loan (one notch) | per finished lead thread; after payoff 4,000 to the Commons Jar |
| First Night Errands | 6 × 500 off loan 1 | loan 1 only |
| Gallery frames | 1,000 per 6 Held forms framed | Gallery commission |

Daily wallet targets before sinks (the economy sim's model): day 1 ≈ 3,000 cash + 3,000 errands; days 2–3 ≈ 8,000; days 4–6 ≈ 15,000; days 7–9 ≈ 25,000; days 10–12 ≈ 35,000; days 13–15 ≈ 45,000. Cumulative by day 14 ≈ 335,000, about a quarter to sinks, plus ~27,000 of Spire shares. **Acceptance:** the headless economy sim lands the Relighting on day 11–16 at defaults and never requires more than 30 real minutes of grind for any tier. If the cozy path stalls at loans 5–6, raise the Porch Duel payout first, purses second; never fruit prices, never friction.

**The loan ladder** (Hearthwright & Daughter; interest-free; no deadline; hard floor 7 nights).

| # | Amount | Notch (5%) | Builds | Target day | Notes |
|---|---|---|---|---|---|
| 1 | **6,000** | 300 | porch lamp lit at payment (Dimity moves in); bedsit roof overnight | 1 | errands cover 3,000 |
| 2 | **15,000** | 750 | the cottage (two rooms, mirror, satchel +10) | 3 | |
| 3 | **25,000** | 1,250 | commission 1 | 5 | Wren's first own design |
| 4 | **36,000** | 1,800 | commission 2 | 7 | |
| 5 | **50,000** | 2,500 | commission 3 | 9 | |
| 6 | **66,000** | 3,300 | commission 4 | 11 | Wren offers the Lamp Room |
| 7 | **80,000** | 4,000 | the Lamp Room | 13 | the Relighting at the next dusk |
| | **278,000** | | | | |

*(split: three ladders differed only at loan 1, 4,000 / 6,000 / 8,000; 6,000 is the median and lets night one pay with 3,000 of errands.)* Pay any amount at the yard; every stick has twenty notches whatever the loan, so a finished thread is literally one notch. Ceremony: Wren flicks one abacus bead per 1,000◉ (speeds up after ten; hold confirm to skip to the THWAP); Ambrose gnaws one notch per 5%; when a loan clears he splits the stick and your half hangs on the tally wall; you pick that build's roof colour (8 colours; slate blue is the cursor default). The scaffold climbs one of seven sections per tier.

**Room commissions** (pick 4 of 6 at loans 3–6; the two left over cost 20,000 each after the Relighting).

| Room | Town effect | Creature effect |
|---|---|---|
| **Training Yard** | chalked yard; Tully trains there | 3 stored creatures earn 25% of party EXP |
| **Workshop** | fossil cleaning bench (+40% value overnight) | polish a skyglass relic overnight into a **type tilt** (held: that type's forms weigh ×2 on every Forecast card) |
| **Greenhouse** | grafting bench (foreign fruit), indoor fruit | a creature left overnight with its favourite fruit gains +1 Bond, once each; a Moss lead ripens a graft a day sooner |
| **Cellar** | cold storage; Keepsakes safe; satchel +10 | creature storage 20 → 40 |
| **Porch & Loft** | second porch seat: two neighbors visit nightly; Porch Duels hosted at home | loft telescope shows Errants on the map |
| **Gallery** | tally wall display, Odile's canvases, Field Log plates | hanging a Shiftlog strip gives +1 Bond once; 1,000◉ per 6 Held forms framed |

Memory relearn and Recall live at the Archive, so no commission gates a fairness tool. Storage base is **20** *(split: one judge's reason holds; a player who skips the Cellar must still hold half the roster)*.

**What gates what.**

| Gate | Unlocks | Never touches |
|---|---|---|
| **Loans** (buttons only) | builds, roof colours, scaffold, commissions, the Lamp Room, the Relighting | isles, badges, letters, shops, tools |
| **Badges** | B1 Reroll + 3 Starsalt (the chip-damage disc is guaranteed in stock by now) · B2 Lantern-paths + free ferry + Skyglass Wicks · B3 Scouting Prism (Corin clips it to the Glass) + Ethers stocked · B4 Recall + one coverage disc face-up at Pell's · B5 Weatherglass (isle weather and Errants on the map) + Training Yard buildable as a Commons project · B6 Plumbline disc + the Summit gate | loans, passage, letters, town verbs |
| **Letters** | their own threads and heirlooms (the bell at K7 + a spring low; Ansel's confession at K9 + thread beat 4) | anything mechanical |
| **Tide** | shortcuts, sparkles, the Glint, glowing flats, the Old Quay, the Bar before the Relighting | nothing exclusive |
| **Level curve** | Shift windows | nothing else |

A grinder can relight with two badges; a battler can hold six badges owing 150,000◉; Spire shares and resident shares pull them together.

**Starsalt and anchor stone sourcing.** Starsalt: 800◉ at the Raft and Ludo (3 a day shared); free 3 per Spire win, 1–2 per skyglass node (refills per badge), 2 per Errant, and every skyglass relic refines 1:1 at the Raft. The Raft and Ludo sell every day so Reroll is never tide-locked. Anchor stones: Cairnhold granite cut by Osric, licensed by the Mooring; Drift 3 free (refilled to 3 per badge), Flux 500◉, Freefall 1 per badge. Steering comes from the two clocks (the night low for Starsalt, the quarry leg for stones), not shops alone.

---

## 8. Creatures and battle

**Roster: 42 forms = 40 in 14 Shift families + 2 unshifting singletons.** All 15 named Wildshift creatures, all 11 referenced forms, 16 invented. Stage 0 = hatchling. Star-touched forms are palette variants (no new art, not counted).

| # | Family | Forms (types, stage) |
|---|---|---|
| 1 | **Sloshkin** (fixed per source) | Puddlepip (Brine, 0) · **Sloshkin** (Brine, 1) · Siltback (Brine/Stone, 2) · **Skeinwing** (Brine/Gust, 2, Shift-only) · Bogmonarch (Brine/Stone, 3) |
| 2 | Scrapling | **Scrapling** (Grit, 1) · Mudfist (Grit, 1) · Knuckleback (Grit, 2) · Cragmitt (Grit/Stone, 3) |
| 3 | Sedgehare | Reedkit (Moss, 1) · Rushling (Moss/Brine, 1) · **Sedgehare** (Moss, 2) |
| 4 | Prismoth (the Ward family) | Mothling (Glass, 1) · **Prismoth** (Glass/Gust, 2, Glasshide) · Cairnward (Stone/Glass, 2, Stillcoat) · Lumenveil (Glass, 3, Mirrorveil) |
| 5 | Vesperay | Rayling (Brine, 1) · **Vesperay** (Brine/Glass, 2) |
| 6 | Bilgebob | Bilgebob (Brine, 1) · **Brinelance** (Brine/Rime, 2) |
| 7 | Creelwight | Rustcreel (Rust, 1) · **Creelwight** (Hollow/Rust, 2) · Hulkwight (Hollow/Rust, 3) |
| 8 | Wirewhisk | **Wirewhisk** (Bolt, 1) · Coilcrest (Bolt/Gust, 2) |
| 9 | Rimeplate | Chillnub (Rime, 1, Stillcoat) · **Rimeplate** (Rime/Stone, 2) · Floeback (Rime/Stone, 3) |
| 10 | Caldermaw | Sootling (Kiln, 1) · Emberjaw (Kiln, 2) · **Caldermaw** (Kiln/Stone, 3) |
| 11 | Rillfin | Rillfin (Brine, 1) · Gillwick (Brine/Moss, 2) · Strandrunner (Brine/Gust, 3) |
| 12 | Tossup | **Tossup** (Plain, 1; its pools draw stage-1 forms of other families) |
| 13 | Errant | **Squallcoil** (Bolt/Brine) · Hailcoil (Rime/Gust); Down card never a hatchling on Drift/Flux |
| 14 | Duskowl | Skirl (Gust, 1) · Duskwisp (Hollow, 1) · Duskowl (Hollow/Gust, 2) |
| — | Unshifting | **Stillox** (Stone; Unshifting) · **Vagary** (Star; Unfixed; 96×96) |

The Sloshkin family's pools use source weights (wildshift-creatures §6.2): Up = Siltback / Skeinwing / Bogmonarch / Lumenveil, Side = Mudfist / Rushling, Down = Puddlepip / Chillnub, Star-touched Sloshkin replaces the Side card 2% of the time. **Wards exist on four forms only** (Prismoth, Cairnward, Chillnub, Lumenveil) and none is encounterable before Cairnhold. One name per ability: **Glasshide** (Prismoth's former "Prism Ward" is retired; the prototype id `prism-ward` becomes `glasshide`).

**Shift windows and odds.**

| | Drift | **Flux** (default) | Freefall |
|---|---|---|---|
| Up / Side / Down (base) | 50 / 40 / 10 | 40 / 35 / 25 | 30 / 30 / 40 |
| After the Relighting | 50 / 45 / 5 | 40 / 40 / 20 | 30 / 35 / 35 |
| Bond: +5 pts Down→Up per pip, cap | +5 | +15 | +10 |
| Stat floor per Shift | 10% | 20% | none |
| Pool weights inside a card | source | source | flattened (equal) |
| Unseen forms on cards | shown | shown | silhouettes |
| Anchor stones | 3 free, refill per badge | 500◉ | 1 per badge |
| Read | free | free | costs the turn |
| Capture display | exact % | exact % | bands |
| Summit Bell holds your place | yes | yes | no |

Windows at **Lv8 / Lv20 / Lv34** (per-family offsets ±2 in data; the pip shows one level before; Restless challenge: 6/12/18/26/34/42). Freefall's 30/30/40 is our constant for the source's [NEED SOURCE]. Star-touched: 2% of Forecasts on every dial show the Star-touched form in the Side slot at the Side odds. Rules: three cards, never a hidden fourth outcome; the current form's row drops out; Shiftlog pull +5 weight per form already in this creature's Shiftlog; same seed + same choices = same cards (stream `shift:<uid>:<n>`; Reroll pulls the next draw). The player's creatures never Shift in battle; scripted boss Shifts get a posted strip. A window that opens mid-route defers to the next Waystone or to home at the next low tide ("Shifts pending: n" on the Tide Table). Per-creature presets: always ask (default), auto-Anchor, auto-accept Up. Forecast screen: 0.5 s input lock, no timer. Target ≈ 18 Forecasts per run, at most one per 20 real minutes on average.

**Bond** (5 pips): sources are story beats, 30 Heartmark-technique uses, life-thread beats with the creature in the party, the Greenhouse night (once), the Gallery strip (once). **Reroll** 1/2/4/8 Starsalt within one window. **Anchor** spends one stone and uses the window up. **Recall** (6 Starsalt, badge 4) returns a creature to any form in its Shiftlog. **Still Knot** (held) spends windows unused while held; the party screen says *Held by Still Knot*.

**Battle rules kept (singles only).** PP; 0-PP moves unselectable; **Scrap** (50 power, typeless, sure hit, 1/8 max HP recoil, no slot) when every move is empty; **Mends**: 3 heals per creature per battle, then healing fails with a word; **evasion cap** +2 (accuracy ×0.83 / ×0.67); **Plumbline** (status, sure hit, clears all stages, blocks boosting 2 turns, ignores Wards and Mirrorveil); **Capture Stance** (wild battles, no slot: nothing from your side, chip included, can drop the target below 1 HP); **Read** (types, ability, Ward state; with the Scouting Prism also moves, held item, Mends left; never blank: `???` / grey / Confirmed). **Wards**: lattice shimmer every 4 s and a *Ward ?* badge tied to that creature's uid; the readout names every party move that lands and every chip move; Crackdust is refused (and kept) against a creature with no active Ward. The seed validator guarantees: no Ward before Cairnhold; Crackdust stocked before every mandatory Ward trainer; the chip-damage disc by badge 1; every disc has ≥ 25% learners and one on its route.

**Rulings for `proto/battle`:** confirmed as built: Scrap's recoil applies when a Ward blocks it; the Stance floor covers every non-self source; a second pending Vesper Mend fails without spending a Mend; Crackdust lasts 3 full turns after the throw turn; Shoresense auto-Reads free on Freefall. Changed: Plumbline ignores Mirrorveil (the Mirror Spire's disc must answer the Mirror Spire); the payout constant becomes **50 × highest level**. No doubles. uids come from `systems/party.nextUid`. Prototype base stats, catch rates, the 0.85–1.0 roll and status fractions are accepted starting values.

**Capture.** Raise the Lantern from the battle panel; the panel shows wick grade, odds as number and bar, the *Stance* tag; one smooth meter sweep; fold into light; warm chord; no throw, no wobble, no click. Odds shown = odds rolled (stream `capture:<battleId>:<attempt>`); +3% per failed attempt on the same creature, capped +15%; displayed odds clamp to 1–95% except scripted captures and Isolde's Lantern (100%). Freefall shows bands (Slim / Fair / Good / Sure).

**EXP.** Cumulative EXP to reach level *L* = 8 × *L*². KO EXP = yield × foe level ÷ 5; trainer battles ×1.5; a capture grants the KO EXP; the dock hold-out grants a flat 100. Bench 60% (battlers 100%); Training Yard 25% to 3 stored creatures; Big Sibling +30% to the lowest party member; catch-up +50% per 5 levels under the posted curve, cap ×3; Porch Duel EXP ×0.5 past curve + 10. Check: Linnet (100) + the Tossup catch (40) + Pip's Wirewhisk (66) takes a Lv5 starter (200) past Lv7 (392) on night one, so the pip shows; two Lowmoor wilds on day 2 reach Lv8 (512).

**Errants.** Squallcoil (Emberstep onward; Skyroam: moves one route per game hour, shown on the map once seen) and Hailcoil (Rimeholt). Start odds ~22% with a Tallow wick. Each pays 2 Starsalt + 1,500◉ beaten or caught and returns the next day. After the Relighting they also visit the lit point.

**The Summit.** Six badges open Hollis's Gate (Hollis Brandt, ex-Mooring quartermaster, keeper of the Readers' fund). Before the Relighting the Bar is dry at the day's lower low; after it, at any tide. The **Long Road**: six trainers on the Bar (Lv40–44), Wick halfway; **Keeper Bastien Kell** (mink, salvage diver of the lost fleet; Hollow/Brine; ace Lv46); **Keeper Cass Rune** (lynx; weather and evasion; ace Lv48); **Champion Idris Fenwake** (great northern diver; Vesperay anchored since it hatched; Lv50). The **Summit Bell** restarts you at whoever beat you (Drift, Flux); losses cost nothing. Beating Idris: the anchor-release scene (silence is an answer), the Summit seal on the Seed Card, 10,000◉.

**Porch Duels** (the Rematch board). Three offers a day on the Commons board's slate from the 8 neighbors who keep a creature (Wren, Tully, Juniper, Odile, Tamsin, Wick, Augusta, Linnet) plus beaten leaders and route trainers; friendly, one to three creatures, scaled to your party's median level, fought on the offering porch during porch talk, 30 × curve, nothing lost. No calls, ever.

---

## 9. Town life

- **Trees.** ~100 named trees (one native fruit per seed: pear, plum, apple, cherry or quince), 6 purse trees, ~4 bee trees; a press shakes one fruit (three a tree); the bee hum warns 1 s before a nest drops; regrow 2 days, ripe after 3; grafting adds foreign fruit.
- **Fishing.** 18 species, 80–4,200◉; shadows small / medium / large / forked-tail; cast, feint, feint, bite; **bite window** 7–31 frames by species, **Gentle** 36–54, **Patient** (hold to reel, no window, own record board). Each species has a **tell** (shape, sound and word) learned after 3 catches. The north creek is empty until the weir turns.
- **Bugs.** 10, netted; more at lit porches and string lights. Prismoths at your lamp can be Read (*Ward ?*) but not fought until you have reached Cairnhold.
- **Digging and finds.** ~4 cracks a day, 3 sparkles per low, **the Glint** once a day. 18 finds (6 fossils, 6 relics incl. 3 skyglass, 6 shore finds); Barnaby identifies them in one batch, buys duplicates, and each find pinned on his string wall unlocks its **town letter**.
- **Shops.** Pell's Sundries (Juniper, 08–22: staples never randomized, two discs a day, Wanted Today, the back room); Ludo (22–08: buys anything at full price, Starsalt, seedlings, moth-silk); the Carnival Raft (Varga, 12–02 from day 3: Starsalt, relic refining, Shift fairs); the Anchorage (Merrow, 07–19: stones, Still Knots); the Cairnhold clinic (stones, Crackdust).
- **Consignment Crate** at your gate: anything, 90%, overnight. **Wanted Today**: three items at +50%, may name a Held form's drop.
- **The Commons board** (Augusta, on the green; a daily slip at your gate): weather odds ("6 in 10, rain by the evening tide"), cracks seen, thread beats, the Porch Duel slate, Spire dossiers (also nailed to Spire doors), Errant sightings from badge 5, the Commons Jar; Ansel chalks the barometer on it at dawn.
- **Commons projects (6):** Dark house 1 (Tamsin arrives) 3,000 · Quay lamps (+1 night shoal) 4,000 · Mudlark Mile flags 5,000 · North creek footbridge 6,000 · Training Yard on the green (badge 5) 10,000 · Lantern Market third stall 12,000.
- **The Day Page** (Dimity, at Rest or porch Sit, inked in one second): buttons, loan, catches, people, Shifts, ***Tomorrow:*** (the build, Shift pips, next lows, the letter, a thread beat, the Errant, the Spire you are ready for), *Saved, verified*. A failed write shows a red *Not saved* banner.
- **Weather.** Clear, overcast, rain, fog, storm; Augusta posts odds; fog pulls silver schools in; rain brings bugs; storms put Errant lightning on the sea.
- **Festivals (4).** **Lantern Market** (Saturdays 20:00–02:00 on the green and the Old Pier: Varga's stall, Ludo's seedlings, string lights; the first market, day 7, holds Dov's sealed-crate disc auction and the Shift fair) · **Mudlark Mile** (Tully's race at a spring low; thread climax) · **the Long Night** (the Relighting) · **the Late Delivery party** (the day the 56th letter arrives).

**Crossovers** (bonuses, never locks; each is one row in `tuning.creatureBonuses` or one hook, never a new system).

*Town verbs made creature-aware (the party lead decides):*

| Lead type | Rule |
|---|---|
| Brine | names every shadow's species; tells learned after 1 catch instead of 3; bite window ×1.5 |
| Gust | one shake drops every fruit on a tree; blows a bee nest clear (honeycomb, no sting) |
| Grit or Stone | marks today's cracks on the map, opens a fifth crack, shows the Glint from 3 tiles |
| Glass or Hollow | shows skyglass relics from 5 tiles, and dimly by day (still dug only at the night low) |
| Bolt | Tailhum hums within 4 tiles of a purse, the Glint or a night headliner fish; draws moths to string lights |
| Moss | a Greenhouse graft takes one night sooner |
| Rime | calms the quay: +1 shadow per reach |
| Kiln | cleans one fossil on the spot each day |

Also: any reach can hook a wild Bilgebob, Creelwight or Rushling; Prismoths visit your lit porch so the Ward tell is met at home; Wanted Today and the Archive Bounty list Held forms and creature drops; four family letters return a creature; every life thread touches a creature; porch lines are tagged by the lead's type and by Shift events ("Your Sloshkin came back with wings. I'd have cried."); Odile paints Shiftlogs; Ambrose carves a perch for your lead; the Day Page lists Shift pips under *Tomorrow:*.

*Creature systems made town-aware:*

| Wildshift system | Town address |
|---|---|
| Shelter heal and storage | Rest at the cottage (heal, storage crate, dial change with Dimity); Waystones heal once per tide |
| Shelter shop | Pell's Sundries, never randomized |
| Rematch board | the Commons board's Porch Duel slate |
| Training Yard | a room commission, or a Commons project from badge 5 |
| Memory relearn, Recall | Barnaby's Archive (Corin runs Recall) |
| Field Log, Shiftlog wall | the Archive, beside the fish and fossils |
| Dossiers | the Commons board and each Spire door |
| Waystones | tide posts whose lamps Ludo lights (Lantern-paths) |
| Skiff | Maud's ferry and the Lantern-paths |
| Discs | Pell's two a day; Dov's auction at the Raft |
| Starsalt / anchor stones | the Raft and Ludo / the Anchorage and Cairnhold clinic; the night low and the quarry |
| Deferred Shifts | the next Waystone, or home at the next low tide |
| Badges | wax seals on your tally wall |
| Seed Card | the last page of Dimity's Season Book |
| Blackout | you wake on your porch |

---

## 10. Cast

Sixteen scheduled residents (14 neighbors + Corin + Linnet) with schedules, memory (5-day no-repeat lines, remembered gifts and choices) and porch talk; isle folk at fixed posts.

| Character | Species | Verdict | Town loop | Creature loop | Home · hours |
|---|---|---|---|---|---|
| **Sorrel** (player) | lease card | merge | Keeper, tenant, debtor | Shiftreader | Keeper's Cottage |
| **Wren Hearthwright** | beaver | keep | loans, abacus, commissions; arc rides the loans | gives the Lantern; Scrapling "Peg" | co-op yard · 06–24 |
| **Ambrose Hearthwright** | old beaver | keep | notches, THWAP, timber; walks the Lamp Room by touch | carves a perch for your lead | yard bench · 07–19 |
| **Hesper Coil** | garden snail | keep | 06:00 Keeper letter; counter 18–02 | — | post office · night shift |
| **Juniper Pell** | magpie | keep | Pell's, heirlooms; thread *Heirlooms Going Home* | all staples; Wirewhisk | Pell's · 08–22 |
| **Ludo** | fruit bat | keep | night buyer, Lantern Market | Starsalt at night; lights Waystones | post-office eave · 22–08 |
| **Barnaby Thole** | hermit crab | merge (Field Log) | Archive, string wall; thread *The Bell* | Field Log, Shiftlog wall, Memory relearn | Archive · 09–19, flats at lows |
| **Dimity** | rosy maple moth | keep | Day Page, save, dial change | Seed Card | your lamp · from loan 1 |
| **Augusta Skerry** | grey seal | keep | Harbor Warden: Commons board, odds, porch count | dossiers, Errants; Bilgebob | Warden's house · green 06–12 |
| **Ansel Stalk** | grey heron | keep | wrote the report; fishes the empty creek; arc *The Empty Creek* | teaches fishing tells | beached launch · creek 17–23 |
| **Wick Dorrow** | puffling | merge (Tobin) | calls you Keeper; carries the flame; arc *The Water Pack* | Rillfin → Gillwick; Long Road fight; next reader | cliff-stair burrow · with you at dusk |
| **Tully** (was Tuck) | wombat | renamed | nicknames; thread *The Mudlark Mile*; Porch Duel slate | Scrapling; trains in your Yard | his porch · laps 06–08 |
| **Odile** | roseate spoonbill | keep | thread *Twelve Lights* | paints Shiftlogs; Prismoth | her porch · easel 14–19 |
| **Bryony** (was Bramble) | rock hyrax | renamed | thread *The Fence* | the Sedgehare in her beans | her porch · garden 07–12 |
| **Thessaly** (was Clementine) | bilby | renamed | template thread | — | her porch · bench 10–16 |
| **Tamsin Brack** | badger | keep | dark house 1 from day 3; thread *The Oyster Boat* | Creelwight "Kettle" | dark house 1 · flats at lows |
| **Isolde Petrel** | storm petrel | keep (absent) | the letters, her lantern | the first Shiftreader | the Outer Isles |
| **The Thatch** | finches | keep | roofs at 05:40 | — | the eaves |
| **Corin Vale** | tawny owl | keep | lodges over the Archive; leaves before goodbyes | Read, Stance, Prism, Recall; exhibitions with his Tossup | Archive loft · desk 10–16 |
| **Linnet Rask** | stoat (ermine Act III) | keep | next-door neighbor; arc *The Ember Grub* | rival; Caldermaw → Sootling; Gnash | her porch |
| **Maud Tallis** | greylag goose | keep | ferry pilot, always confirms | Turn Spire; Reroll | her punt · 05–01 |
| **Osric Penhallow** · **Ines Calloway** · **Wendel Teague** (was Ambrose Teague) · **Ada & Ivo Halloran** · **Seraphine Locke** | tortoise · crested newt · grebe · jackdaws · arctic fox | keep | stonecutter · spa · boatwright (Tamsin's rollers) · windmills · cave guide | Spires 2–6 | their isles |
| **Hollis Brandt** | mountain goat | keep, no Spire | Readers' fund (Spire shares), Ration Ledger | Summit gate, Long Road | Hollis's Gate |
| **Agathe Merrow** | cormorant | keep | the Anchorage, the clinic, the memorial | Engine boss; Cairnward ace | Anchorage · 07–19 |
| **Teo Varga** | raccoon | keep | the Raft, Shift fairs | forces Shifts on his own side only | the Raft · 12–02 |
| **Dov Lattimer** | kinkajou | keep, no Spire | Raft auctioneer | sealed-crate disc auction | market nights |
| **Bastien Kell** · **Cass Rune** | mink · lynx | keep | — | Summit Keepers | Shardcrown |
| **Idris Fenwake** | great northern diver | keep | watches from Shardcrown | Champion; Vesperay; anchor release | Shardcrown |
| **Pip** | water rat | new | dock hand | night-one trainer | the quay |

**Merges and cuts.** Tobin Marsh → Wick Dorrow. Dov's Disc Spire → the Raft auction. The Field Log keeper → Barnaby. Cut: Odile Strand (name clash), Mirren Hale (doubles), Ferdinand, Tova, Ferro. Rejected merges: Idris ↔ Ansel (the weir is Ansel's family's; keeps the Champion's distance), Augusta ↔ Maud (keeps the ferry), Ambrose ↔ Corin (keeps the mentor who leaves). "Warden" means Augusta only. "Pell" stays (naming check recorded; fallback Thrale).

---

## 11. Story

**The letter serial: 56 letters + 2 event letters, three streams, three channels.** *(split: one morning stream cannot land the storm-night letter before Act III; three channels keep every morning a Keeper letter.)*
- **20 Keeper letters (K1–K20)**, Isolde to "the Keeper": one at **06:00** each morning, K1 on day 2 … K20 on day 21; one per date, no accrual.
- **18 family letters (F1–F18)**: one from Hesper's counter at **18:00** from day 2; you carry it to a door; a lit porch returns an heirloom, and F1, F5, F9, F13 also return a common creature (Bilgebob, Puddlepip, Mothling, Wirewhisk).
- **18 town letters (T1–T18)** (harbor notices, Mabry Coil's post-office day book, Merrow's ward log, Ansel's report): each unlocks when its find is pinned on the string wall; any still locked after K20 arrive by morning post from day 22.
- Events: **the Lantern letter** at the Relighting; **"I saw the light. —I. Petrel."** post-credits. The **Late Delivery party** fires the day the 56th letter arrives. The story concept's ten written letters are canon text, renumbered (K1, the Dorrows' F1, K2, K3, K4, K6, K8, K10, the two events).

**Reveal order.**

| Beat | Letter (day) | What it reveals |
|---|---|---|
| 1 | K1 (2) | The light is fine; the river is wrong; the bar is rising. |
| 2 | K2 (3) | The mill weir, two generations old, Stalk family's; young harbormaster Stalk "writes a good report and reads a poor drawing". |
| 3 | K3 (4) | The sea hums; a wanderer on a thirty-year road; two logs, two clocks. |
| 4 | K4–K5 (5–6) | The glow on the Siltback's brow, the first Heartmark; she can see which way it leans; Merrow's ward and her broth. |
| 5 | K6–K7 (7–8) | Oil for nine nights; lamp or wheel; the fleet's bell on the Old Quay "goes with the quay if the bar takes it" (Barnaby's bell). |
| 6 | K8 (9) | The storm night: the comet at the wheel, the Siltback Shifted, the lamp ran dry. |
| 7 | K9 (10) | The morning after: the bar, the lost fleet, the report that named her. |
| 8 | K10 (11) | "A read Shift is a Shift survived." She leaves to learn to read on the Isles. |
| 9 | K11–K12 (12–13) | Shardcrown's brazier and its Keepers; "light calls the change" answered: light lets you read the change; the lantern left on Juniper's counter "for whoever comes". |
| 10 | Lantern letter (Relighting) → K13–K20 (14–21) → "I saw the light." | Teaching Corin; the Passenger; forgiving Ansel's report (K14); the next keeper. |

**Acts and triggers** (every trigger has an alternative so no track walls another).
- **Act I, The Turn (days 1–3).** Arrival, first creature, the dock, loan 1, Lowmoor, the rematch, badge 1, loan 2. Ends at badge 1 or day 4 dawn, whichever first (the Raft docks on day 3 regardless).
- **Act II, The Odds (days 4–8).** Cairnhold (the memorial; the Anchorage turns away a fisher who cannot pay), Emberstep and the first Errant, the first Lantern Market (day 7: Dov's auction, Varga hires you to call odds, **Linnet's fall** on the first market night on or after badge 2). Ends at badge 3 or loan 4, whichever first: the comet brightens.
- **Act III, The Surge (days 8–12).** Drownwood's drowning street; **the Surge** (first night on Thistlewind after badge 4, or day 10 dawn): a street in Windle Shifts in one night; Rimeholt: Idris in the gallery, **Linnet returns**. **Two plans, one night** fires at the next night low after the first of badge 5, loan 6 or loan 7: Merrow's Sinking Engine on the Lantern Stack (story battle; she halts it when you hand her K10, or K8 if K10 has not come: "The stones stay licensed. The clinics will take your forecasts.") while Linnet and Wick pull Varga's charges. The comet hangs low, waiting for a light.
- **Act IV, The Light (days 12–15).** Loan 7 → the Lamp Room overnight → **the Relighting** at the next dusk. The Summit is open from badge 6, before or after.

**The six hand-written life threads** (4–6 beats each, one beat a day at most, Monday beats for threads you are in; finishing one pays the resident share).
- **Tully, *The Mudlark Mile*.** Tully times laps at dawn and swears he was never the slowest kid. He asks for a grey mullet for luck, loses a practice race to Tamsin, and on his porch admits he was. The race runs at a spring low with your fastest creature pacing his Scrapling; win or lose he gives you his sweatband.
- **Odile, *Twelve Lights*.** Odile paints one canvas for each of eleven lit porches she can see from her step, and stalls at the twelfth subject, the lighthouse, because it is dark. Between porches she paints your starter's Shiftlog (one canvas); you sit on her steps the night she gives up; the gallery hangs in the Archive; the twelfth canvas is the beam, painted the morning after the Relighting.
- **Tamsin, *The Oyster Boat*.** Tamsin arrives in dark house 1 and races you to sparkles. Her family's oyster boat lies in the north creek missing its nameboard; Read her Creelwight "Kettle" on Drownwood and the board glints inside it. Wendel's rollers haul the boat over the causeway; she sails first in the coda, on water the weir gave back.
- **Bryony, *The Fence*.** Bryony's beans run up a fence she and Tully argue over; you broker or take a side; Ambrose cuts lower posts. A Sedgehare lives in her beans and she will not let anyone catch it until the fence is low enough to talk over; then it chooses to come to you.
- **Juniper, *Heirlooms Going Home*.** Family letters to lit porches return heirlooms from her back room: the Dorrows' kettle, the Bracks' Still Knot, a grade-two lantern. The reveal: her family kept the shop open through the Ebb winter on credit nobody repaid. The last heirloom is Isolde's Lantern, at the Relighting: "You've carried a lantern everywhere. Don't drop this one."
- **Barnaby, *The Bell*.** K7 says where the fleet's bell went down; at the first spring low after it you dig it out of the Old Quay. Barnaby moves out of the diving helmet into the bell ("Exhibit 1: My Old House"), and ties the last string on his wall between the weir records, Isolde's letters and the lamp: "Oh. Oh, that poor keeper."

**Cast arcs** (scripted beats on the same system): **Linnet, *The Ember Grub*** · **Wick, *The Water Pack*** (Rillfin Shifts to a gill-breather; he builds a pack; carries the flame) · **Ansel, *The Empty Creek*** (the tells; the confession at K9 + beat 4: "I named her. I'd name her again with what I had. I didn't have the drawing."; the weir wheel in the coda). **Thessaly** runs a 3-beat template thread.

**The rival arc** (four battles and a fall). (1) The dock, night one: the posted strip shows Up 100% on every dial; Lv5 **Caldermaw**; hold three turns; *Identity Crisis*. (2) The Brackenford rematch after badge 1 (before it she Declines); *First Steps*. (3) **The fall** at the Lantern Market Shift fair: Caldermaw Shifts Down to **Sootling** before the town; she refuses Merrow's stone and Varga's Starsalt, leaves on Maud's ferry, and her porch goes dark. (4) Rimeholt: she returns in ermine with a balanced six, Sootling on her shoulder; afterwards her porch relights and on her step she asks: "Read it for me. I'm not asking Merrow." (5) The Shardcrown gate after badge 6; the **Gnash** disc win or lose. Coda: Maud's wheel.

**The ending scene.** At 17:30 the day after loan 7, Juniper brings Isolde's Lantern and the Lantern letter up the point. You light it from your own porch lamp; Wick, cap pushed back for once, climbs the stair with you. The lens catches in three dither steps; the beam sweeps every roof every 8 s; every lit porch pulses once; a horn answers with Your Signal. The Skyband fills: the comet low, and something coming down to the lit Lantern Stack. The sea draws back (a forced low); you cross with Corin, Wick, Linnet, Merrow and Varga on the shore (and Idris, ring already off, if you have beaten him). **The Reading**: seven phases of two turns; one 96×96 body whose palette and Unfixed type queue change per phase; each phase posts the next Forecast; your creatures cannot fall below 1 HP and its bar cannot empty; on the seventh its Forecast is offered to *you*: Anchor (Merrow's way) or Reroll (Varga's way), free here, each keeps the night going one more phase; **Accept** ends it. The Heartshard steadies; its hum settles into a tide. Corin: "I can't read one that size. You can." **Dawn: credits** over Odile's canvases, your tally wall, the lit porches and the **Seed Card**.

**Coda and post-game.** Hesper's flustered note; Ansel at the weir wheel if he confessed (the creek refills a few shadows a week); Tamsin sails; the Summit by the lit Bar and rematches with whatever Vesperay has become; the Passenger perched and catchable; Errants to the light; the dark houses reopen one a night; the leftover rooms; K13–K20, the remaining town letters and the Late Delivery party; Merrow's clinics on the Shift Tide Table; Varga's clinic funded by Hollis; Linnet at Maud's wheel; Corin and Wick ask for the **ninth Spire** (a rotating challenge from your seed).

---

## 12. Scripts

**The first 30 minutes** (real minutes; game times approximate because the clock pauses in every scene, battle and menu; the bot asserts each beat within ±3 real minutes on the default seed).

| Real | Game | Beat |
|---|---|---|
| 0:00 | — | Title: the live harbor at the real hour, lighthouse dark, comet a faint smudge; New Game → Seed Card (Flux) → Begin. |
| 0:30 | 17:40 (held) | Walking before the fade ends: foam closes the causeway behind you; seven porches lit across the water. |
| 1:30 | held | Wren: "You walked. Nobody walks." Lease card. |
| 3:30 | 17:45 | Key, Lantern, 5 wicks: "Six thousand buttons, no interest. Pay it when you can. We build while you sleep." The clock starts. |
| 4:00 | 17:50 | Three creatures on the last dry stones; kneel; raise the Lantern (100%); name; the mark lights. *Someone Picked You*. |
| 5:30 | 18:05 | Wick on the cliff stair: "Keeper!" The bedsit. |
| 6:00 | 18:10 | Corin on your step: the Reading Glass, 2 stones; Read your own creature. |
| 7:00 | 18:15 | Linnet vaults the fence; Corin reads her strip aloud; Lv5 Caldermaw; hold three turns; *Identity Crisis* (+100 EXP). Maud from her punt: "Come back stronger. Brackenford stones, low's at five." |
| 10:00 | 18:25 | Wick brings the errands clipboard (six × 500◉ off loan 1, any order). |
| 10:30 | 18:35 | Apron at the yard; pin your notice on the Commons board; Tully's nickname (accept / decline / counter); Odile, Bryony, Thessaly. |
| 12:00 | 19:20 | Six trees, eighteen fruit, a purse (300), the bee hum, a netted nest (350). |
| 13:30 | 20:00 | Carry the mail sack in; Hesper's lamp lights: "Something's been waiting for you. Morning." |
| 14:00 | 20:10 | The reeds: a wild Tossup Lv4; Corin teaches Capture Stance; "62%"; **first catch** by 15:30. |
| 15:30 | 20:30 | Barnaby's porthole fogs over a shell: the Field Log. |
| 16:30 | 20:45 | Ansel from the launch: "Forked tail, by the piling." Feint, feint, plip: a perch. |
| 18:00 | 21:30 | Pip the dock hand (Wirewhisk Lv4): a win, 200◉. |
| 19:00 | 22:10 | Sell to Ludo on the eave: wallet past 3,000. |
| 19:30 | 22:20 | The yard by lamplight: six beads; Ambrose: "Alder. Notch it wide."; **THWAP**; slate-blue roof; loan 2 offered. |
| 20:30 | 22:35 | The porchlight comes on; Dimity lands in it; Wick: "Keeper." A Prismoth at the lamp: Read it, *Ward ?*. |
| 21:00 | 22:45 | Tully's porch, beat 1. |
| 22:00 | 23:30 | Party: PUDDLE Lv7, *Shift pending*. Corin's slip: "Tomorrow. I'll be on the stones at the low." |
| 23:00 | 01:30 | Night fishing (a John Dory shadow), or Sleep till dawn. |
| 24:30 | 03:40 | The flats glow: the Glint (620), a skyglass relic, cockles; Ludo buys. |
| 26:00 | 05:40 | The Thatch tie off your roof. |
| 26:30 | 06:00 | Hesper: "One for you. It's… a little late." **K1**. |
| 27–30 | 06:00–07:05 | Stones to Lowmoor (or the boardwalk); two wilds; Lv8; your first Forecast. |

Delivered: arrival, first creature, first battle, first catch, first loan payment, first old letter, a Forecast seen and your own landing at minute ~30 (the pip and Corin's slip are the promise if the player sleeps instead).

**Day 10** (a Tuesday; loans 1–5 paid, loan 6 open at 66,000; badges 1–3; Workshop and Greenhouse built; lows 11:45 and 00:10).
06:00 The Thatch tie off the Greenhouse roof in ochre (loan 5 paid last night); **K9**, the morning after; Ledger *66,000 to go, about two days*; Hollow Spire dossier (immune to Plain and Grit); Linnet's porch still dark. · 06:15 Orchard with Skeinwing leading; the plum graft took. · 08:00 Coverage view: *Gap: Hollow*; buy and teach the Kiln disc (2,500); two Ethers. · 09:00 Lantern-path to Mossgate; three trainers (≈1,350 each); Read a Creelwight: the nameboard glints inside; node, 2 Starsalt. · 11:45 The drowning street at low tide: Scatter volunteers, the Anchor Pulse misfire. · 12:30 **Hollow Spire**: badge 4, 5,800◉ + 3 Starsalt, a **6,600◉ Spire share** on Wren's ledger, Recall opens. · 13:30 Waystone, *1 of 2*: Scrapling Up to Knuckleback (Accept); Tossup Side to Rushling (Reroll once, Accept). · 15:30 Golden hour: Odile's canvas 9. · 17:00 Pay 22,000. · 18:00 F9 for Odile's porch: Juniper returns her grandmother's easel; Odile's porch lights; a Mothling follows it up the step. · 19:30 Tamsin's porch, beat 3. · 21:00 Porch Duel with Osric (780◉). · 22:40 Glowing flats: two skyglass relics, a relic find (T7), two John Dory and a wolffish. · 01:00 Ludo ≈10,800◉; Rest. *Tomorrow: Thistlewind by the 12:35 low; K10 at six; 37,400 to go on loan 6.*

**Day 40** (post-game; the Relighting was day 14). The beam has swept for twenty-six nights; the old sack emptied at the Late Delivery party, so Hesper brings a postcard from the Outer Isles. The Shift Tide line says Bogmonarch's last window opens at the evening tide and the Keeper's Anchor will hold it free. Idris is on the Porch Duel slate with a Vesperay that is now a Lumenveil. The Passenger sits on the Lantern Stack at 14% with a Skyglass wick; Isolde's Lantern asks *No* first. Tamsin sails in over the shallows the weir gave back; Linnet takes Maud's wheel; the Seed Card, Summit seal stamped, hangs beside nine split sticks.

---

## 13. Screens and controls

**Screens** (480×270 native; text on a 960×540 overlay).

| Screen | Layout |
|---|---|
| Title | live harbor at the real hour (lit or dark by save); Skyband; wax seals Continue / New / Settings; seed code |
| Seed Card | dial pips, seed, challenge seals, *Begin* |
| Lease Card | fields on ledger rules left; 16×24 preview ×3 right; Wren's bust; Signal chimes along the bottom |
| Overworld HUD | Skyband (sun, moon, tide needle, clouds, comet, meteors); wallet slides in on change; context chip; party pip only when a Shift is pending; no minimap |
| Dialogue | ledger slip, bottom 72 px; 48×48 bust; wax-seal name tab; *Linger* seal |
| Tool Ring | 8 brass sockets (Rod, Net, Shovel, Reading Glass, Lantern, grafting knife, string lights, Weatherglass) |
| Satchel | pocket tabs (Wicks, Medicine, Discs, Finds, Held, Keepsakes); 20 → 40 slots |
| Hearth Ledger | the twenty-notch stick and pace line; today by source; Spire shares; seven carved houses Paid / Paying / Pick / Later / Finale; dial page last |
| Tide Table & Commons board | lows, windows, *Shifts pending*; slips for odds, beats, slate, dossiers, Errants |
| Map | illustrated ring; neighbor heads; next two lows; Waystones; Errant lightning; lit-porch count |
| Party | six rows (icon, HP, PP, pip, curve gap); Coverage view with *Gap* in words |
| Creature Summary | sprite, stats, moves; Shiftlog strip with the mark in the same spot; Bond pips; presets |
| Field Log | 42 plates, Seen / Read / Held as glyph + word |
| Archive | fish, bugs, finds, string wall, Memory relearn, Recall |
| Shop | rows with *After: n* and learner strips |
| Battle | foe upper-right, player lower-left; foe box with *Ward ?*, EVA, Mends pips; panel Fight / Read / Lantern / Bag / Run; 2×2 moves with PP and the effectiveness word |
| Read card | over the foe box; never blank |
| Capture | wick grade, odds number + bar, *Stance* tag, three-segment meter |
| Shift Forecast | header (portrait with mark, Lv, *n of N*, dial, Bond); three cards with odds; KEEPS row; Accept / Reroll / Anchor with cost : held |
| Payment Ceremony | the yard at dusk: abacus, Ambrose, the stick, roof swatches |
| Dawn Build | 40-frame tie-off vignette; scaffold rises |
| Day Page | journal page; *Tomorrow:*; save check |
| Letter reader / Journal | letter on ledger paper with its seal; Letters, Stamps, Season Book, Seed Card |
| Pause | tabs Party, Satchel, Ledger, Map, Field Log, Journal, Settings; **Save always last** |
| Settings | see §15 |
| Relighting / Credits | `scenes/ending.js`; credits over the beam, tally wall, canvases, Seed Card |

**Controls** (one table drives all three; aligned with `js/core/input.js`).

| Verb | Keyboard | Gamepad | Touch (automatic on a coarse pointer) |
|---|---|---|---|
| Move | arrows / WASD | left stick / d-pad | floating d-pad (left half) |
| Run | hold Shift | hold RT | double-tap and hold |
| Confirm / context verb | Z, Enter, Space | A | big A (right); tap the context chip |
| Back (never drops an item) | X, Esc, Backspace | B | B (right) |
| Pause menu | P (Esc when nothing to back out of) | Start | ≡ button |
| Tool ring / quick swap | hold C / tap C | hold X / tap X | ring button above B |
| Read / Path view | V | Y | lens button; a panel tab in battle |
| Map & Tide Table | M | Select | swipe down from the Skyband |
| Journal | Tab | LT | pause tab |
| Peek | Q / E | right stick | drag empty screen |
| Battle speed 1× / 2× / 4× | 1 / 2 / 3 | LB | speed chip |
| Mute | 0 | — | settings |

Every menu works with a d-pad and two buttons; targets ≥ 44 px; no hover; input flushes on every scene change; cursors open at the top; pockets never remember a cursor; the Forecast ignores held buttons for 0.5 s.

---

## 14. Art and audio direction

**Art.** Field-guide pixel art at **480×270** native, **16×16** tiles (30×17 visible), integer scaling only, nearest-neighbour, camera snapped to whole pixels; flat 3/4 top-down with the Skyband across the top 40 px; the camera eases down at the shore to a true horizon with the lighthouse on it. The lighthouse is the compass; at night the harbor is the progress bar.

*Prototypes adopted as the baseline:*
- `proto/creatures/`: **32×32** palette-indexed string art, left-front 3/4, two front frames and one back, ×2 in battle, icons a 16×16 head crop; ≤ 8 keys + `m` + highlight. Change: each form declares **four Heartmark anchors** (head, chest, back, tail); each individual rolls one at hatch (stream `heartmark:<uid>`) and keeps it through every form. The mark is a 3 px plus (5 px with corner glints at ×2), centre `w` on cool bodies, `y` on warm. Vagary 96×96.
- `proto/chars/`: **people 16×24** on the paper-doll rig, **48×48 busts**; species are head/ears/tail swaps. *(split: the judges asked for 24×32; the rig, six species and cast already exist at 16×24 and read cleanly on 16 px tiles. The otter head becomes a pine marten.)*
- `proto/tiles/`: procedural palette tiles and hour LUT keyframes (palette re-grading, never a screen overlay); `!` colours (lamps, glowing mud, skyglass) bypass the LUT.
- `proto/battle/`: the pure engine with the §8 rulings.

*Palette rules.* One palette module unions: the 21-key sprite letter set (Sweetie-16 + `m c h u a`), the tile colour table, and the UI tokens night ink `#141B33`, cream `#F6F1E3`, deep blue `#2B3A67`, porchlight amber `#F9C46B`, lighthouse amber `#FFB547`, bioluminescent cyan `#3FF2E0`, brass `#D9A441`, ledger paper `#F4F1E6`, wax red `#A8323A`. **Comet magenta `m` = `#FF5BD6`** (the value already in the prototypes) is reserved for Heartmarks, skyglass, Shift effects, the Forecast panel, the comet and the Vagary. No pure black or white. After dark the two ambers and real flames are the only saturated warms. Heartmarks, skyglass, lamps, HUD and cursor bypass the LUT.

*Readability.* Grass shows ground between tufts and rustles 3 frames; anything that blocks has a base, a dark line and a bottom-right shadow; ledges have a lip and chevrons; wet sand is two ramps darker with a hard tide line; weather overlays cap at 35% with a Clear Visuals toggle; 3:1 contrast floor on walkable tiles; every tell is shape + word + icon, never colour alone. Lights are pre-rendered dither discs, ≤ 16 on screen. A Node linter rejects any sprite off-size, over-keyed, or with an anchor outside its pixels.

*Motion.* 60 fps world, 12 fps characters, one anticipation frame per verb, squash ≤ 10%, no rotation; panels in 6 f, out 4 f; hit-stop 0/2/4/6/8 f by effectiveness, 2 px nudge, shake only on THWAP and crits. **Shift flip**: cards down 12 f, slide 60 f, one turns 18 f, then a 90 f scramble resolving in rings outward from the mark (dither fade on reduced motion). **Lantern unfold**: lift 6 f, square → strip → outline 12 f. **THWAP**: gnaw 6 f, strike 5 f, 2 f shake, dust. UI is a keeper's desk: ledger paper, twenty-notch tally bars, wax-seal buttons, torn-paper slips (5 f), a 5×7 field-guide face with distinct I/l/1 and a dyslexia-friendly set.

**Audio.** All WebAudio, synthesized; adopt `proto/music/tracks.js` and its CUES. One tonal family (D major / B minor / G lydian / A mixolydian / E dorian) so the **two-bar bridge on the hour** sounds like one town changing light. **Eight day-part themes** (§5) with stems `core / melody / bass / perc` (perc off 01:00–05:00), `night` (glass bells, 20:00–05:00), `tide` (high tide), `rain`. Scene tracks: title, forecast, battle_wild, battle_trainer, battle_spire, summit (Champion and the Reading), victory, shift_reveal (+ anchor), letter, relighting, lantern_market (3/4), credits; battle themes carry a `tense` stem at ≤ 25% HP. **Motifs**: the **Heartmark** D F# A B (+4 +3 +2, never changes) in the title, the morning theme and every Shift sting (Anchor plays only the chord); the falling **Vagary** A G F# D at skyglass, Errants, factions and Spires; **Your Signal** as door chime, Dimity's hum, Wick's whistle, the letter sting and the ferry horn. Cries from three parameters; bonded cries share a two-note tail. Speakers tick in their trade (Wren woodblock, Ambrose bowed string, Juniper glass bead, Hesper paper, Barnaby brass, Corin a soft hoot). ~50 sfx; tells: Ward ping, blocked tink, EMPTY thud, save chime, save-failed buzz, Lantern hum and warm chord (never a click), bee hum, bite plip, rising notch tick. **THWAP is the loudest sound in the game.** Music / sfx / ambience sliders, mute key, captions for the bite, the hum, mail and the hour.

---

## 15. Chaos dial, seeds, challenge modes, accessibility, settings

**Chaos dial.** Drift, **Flux** (default) and Freefall ship with the rules in §8. Custom is not built. Changing the dial is possible only at home (the Ledger's last page) and marks the Seed Card *not race-eligible*.

**Seeds.** A 10-character code (Crockford base-32) encodes dial + challenge toggles + a 32-bit seed, shown on the title and the Seed Card. `rng.stream(key)` derives independent xorshift streams: `shift:<uid>:<n>`, `capture:<battleId>:<attempt>`, `encounter:<mapId>`, `tide` (seeded day-1 phase), `weather:<day>`, `shop:<day>`, `glint:<day>`, `heartmark:<uid>`, `trainerTeams` (fixed at new game). Same seed + same choices = same cards (unit test). The **Seed Card** prints at the credits (dial pips, seed, seals, days, catches, Forecasts and every party member's Shiftlog) on the last page of Dimity's Season Book, exportable as text, and re-stamps with the Summit seal after Idris.

**Challenge modes.** Ship: **No Rewind** (one autosave slot, no manual saves) and **One Heart** (only the starter may battle; others may be caught for the Log). If the cut line allows: **Ride the Dice** (Anchor disabled) and **Blind Read** (Read shows types only, no Scouting Prism).

**Accessibility.** No timed input on any Shift or capture; fishing offers Gentle and Patient; full remap; every tell is shape, word or icon; reduced motion swaps the scramble for a dither fade and stills shimmer, shake and particles; flashes ≤ 3 per second, no full-screen white, the beam sweeps and never flashes; large text; high contrast panels; four text speeds and a 100-line log; auto-advance off by default; captions; dyslexia-friendly glyphs; one-handed touch layout.

**Settings** (Save is always the last item of the pause menu): day length (12 / 24 / 48 / Real Clock), text speed, battle speed (1× / 2× default / 4×), fishing (Standard / Gentle / Patient), reduced motion, large text, high contrast, Clear Visuals, Path view hold/toggle, remap, music / sfx / ambience volume, mute, touch layout (two-handed / one-handed), blackout wake point.

**Saves.** One versioned schema with a checksum (FNV-1a over canonical JSON) and migrations; verified write (temp → read back → checksum → swap); three rotating autosaves (doors, Waystones, before Spire doors, after catches and Forecasts, every 5 real minutes) plus three manual slots; a failed write shows the red *Not saved* banner; one-of-a-kind items always ask before they are spent, cursor on No.

---

## 16. Content scope and the cut order

| Content | Count |
|---|---|
| Creature forms | **42** (40 in 14 Shift families + Stillox + Vagary); Star-touched as palette variants |
| Techniques | **64** (12 types × 4 + 15 signatures + Plumbline; Scrap separate, no slot) — the prototype's 54 plus 10 |
| Abilities | **25** (the prototype's 26 with `prism-ward` merged into `glasshide`), incl. the Wards Glasshide, Mirrorveil, Stillcoat |
| Types | 12 (Plain, Grit, Brine, Kiln, Moss, Bolt, Rime, Gust, Stone, Rust, Glass, Hollow) + Star; the chart as written |
| Items | **26** (3 wicks, 6 medicine, 2 cures, Crackdust, Still Knot, 6 type tilts, 6 held items, Isolde's Lantern) + **12 discs** |
| Trainer rosters | **65** (30 route, Pip, 6 leaders, 6 Long Road, 2 Keepers, Champion, Linnet ×4, Wick ×2, Merrow, Varga, Corin ×3, 8 Porch Duel neighbors) |
| Errants | 2 (Squallcoil, Hailcoil) + the Passenger |
| Spires / Summit | 6 + Long Road + 2 Keepers + Champion; the Reading 7 phases |
| Scheduled residents | 16 (14 neighbors + Corin + Linnet); ~8 isle NPCs at posts |
| Life threads | 6 hand-written + 3 cast arcs + 1 template |
| Letters | **56** (20 K, 18 F, 18 T) + 2 event |
| Fish / bugs / finds | **18 / 10 / 18** (6 fossils, 6 relics incl. 3 skyglass, 6 shore finds) |
| Maps | **24**: 8 exteriors (Pellwick 64×48; Lowmoor, Cairnhold, Emberstep, Drownwood, Thistlewind, Rimeholt 48×32; the Bar), 6 Spire interiors (20×14), 6 town interiors (cottage by tier, Pell's, post office, the Archive, the yard shed, the lighthouse stair + Lamp Room), 4 Summit/stack rooms (Hollis's Gate, Keepers' hall, Idris's hall, the Lantern Stack); ~96 tile types |
| Waystones | 7 (one per isle + Hollis's Gate) |
| Loans / commissions / Commons projects | 7 / 6 (pick 4) / 6 |
| Furniture / clothes / roof colours | 24 / 12 / 8 |
| Porches | 20 (7 lit, yours, 4 by letters, 8 dark houses) |
| Festivals | 4 |
| Music | 8 day-part themes × stems + 4 battle + 8 scene/one-shot tracks |
| SFX | ~50 |
| Journal stamps | 24 |

**Protected, never cut:** the causeway arrival and lease card; the first creature and the Lantern with odds; Capture Stance; the Forecast with visible odds; Read and the Ward tell; the 24-minute day with two tides and the any-tide long ways; the seven loans and the THWAP; the porchlight; one letter every morning; Porchlight Hours; the Relighting and the Reading; *Tomorrow:*; verified saves; the debug hook and the Playwright full run; the fairness pillars; 60 fps.

**Cut order (first to last):** 1 the Freefall dial · 2 challenge modes beyond No Rewind and One Heart · 3 the ninth Spire · 4 the post-game Passenger catch (keep the Reading and the perch) · 5 Thessaly's template thread · 6 Summit Keepers 2 → 1 (Cass Rune stays) · 7 the Reading 7 phases → 4 · 8 shore finds 6 → 0 (their town letters arrive by post) and bugs 10 → 6 · 9 Spires 6 → 4 (Weather and Relay become route trainers; Ines and the Hallorans stay as isle NPCs; badge rewards slide down) · 10 isles 6 → 4 (Thistlewind folds into Drownwood with the Surge; Rimeholt's caves fold into Cairnhold with the Mirror Spire) · 11 player species 6 → 3 (red panda, water vole, pine marten) · 12 forms 42 → 36 (Hulkwight, Coilcrest, Strandrunner, Emberjaw, Floeback, Skirl) · 13 battle_trainer track (wild covers it) · 14 furniture 24 → 12, Commons projects 6 → 4 · 15 festivals → Lantern Market and the Long Night only.

---

## 17. Chapter plan for the full GDD

Every chapter writes in the §14 formats of `ARCHITECTURE-DRAFT.md` (kebab-case ids, frozen exports, one index line, `node tools/validate-data.mjs` green) and renames nothing in this file.

| # | File | Owner brief · data format | Must honour |
|---|---|---|---|
| 1 | `GDD-01-world.md` | the 24 maps as §14.4 string grids (legends, props, every tree and porch, triggers, warps with tide masks for short ways, Waystones, nodes, dig sites, reaches); §14.11 encounter tables per map with day / night / tide weights and Errant routes | §4 order, levels, tide windows, wade rule, any-tide reachability; no wild in town but the reeds |
| 2 | `GDD-02-economy.md` | clock and tide constants, the day-1 seed, `data/tuning.js` (every constant with range), `data/loans.js`, `data/dials.js`, §14.9 shops with hours, §14.12 item rows with prices, the economy-sim model and test | §5–§7 every number; ladder 278,000; Relighting day 11–16 |
| 3 | `GDD-03-creatures.md` | 42 forms as §14.1 rows (stats from `proto/battle/species.js`, four anchors, `mustNotReadAs`); 14 families as §14.2 Shift tables with per-dial weights; Star-touched palettes; 25 abilities; sprite briefs for the 16 undrawn forms | §8 roster, Sloshkin pools, Wards on four forms, windows 8/20/34 |
| 4 | `GDD-04-battle.md` | 64 moves as §14.3 rows; the rules sheet (damage, capture, EXP formulas); 65 rosters as §14.10 with payouts and script ids; Spire gimmicks, dossiers and aces; the Long Road, Summit and the Reading's 7 phases as data | §8 rules and rulings; singles; story battles never wall |
| 5 | `GDD-05-town-life.md` | trees, bees, digging, the Glint; 18 fish, 10 bugs, 18 finds as §14.12 collection rows (tells, windows, habitats, each find's town letter); Crate, Wanted Today, Commons board and projects, Porch Duel slate, Day Page, weather, festivals; `tuning.creatureBonuses`; furniture, clothes, roofs | §9 and its Crossovers tables; bonuses never locks |
| 6 | `GDD-06-cast.md` | every resident and isle NPC as a §14.5 module: schedule, home, topics with conds, lines (generic, night, porch, weather, lead-type and Shift tags), memory with 5-day no-repeat, gifts, Porch Duel creature | §10 species, renames, hours; "Warden" is Augusta only |
| 7 | `GDD-07-story.md` | acts and triggers in the cond DSL; every story script in §14.6 format (first 30 minutes, dock, rival, factions, Surge, Engine, Relighting, Reading, credits, coda, post-game); flag list; 24 stamps | §11 triggers with alternatives; ending gate = zero balance; §12 timings |
| 8 | `GDD-08-letters-threads.md` | 56 + 2 letters as §14.8 rows with full text, seal, date, channel and reveals; 6 threads, 3 arcs and the template as §14.7 modules | §11 streams, reveal order, K1 day 2 … K20 day 21, four letter creatures, canon texts |
| 9 | `GDD-09-presentation.md` | screen specs, controls, UI kit, art bible (palette module, sprite and tile rules, linter, juice), audio (track ↔ CUES, stems, motifs, sfx, cries), accessibility, settings, dial, seeds, Seed Card, challenges, `strings.js` glossary | §13–§15, prototypes and palette |
