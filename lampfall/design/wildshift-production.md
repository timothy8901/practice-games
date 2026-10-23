# WILDSHIFT — Production Reference

Extracted from the Wildshift pitch: the Keep/Change/Remove/Add matrix, Production plan, Glossary, Platforms/price/scope, Timeline, Vertical slice, Slice metrics, Testing plan, Comparables, IP guardrails, Risks, Community plan, the Emerald Chaos V2 "V3 ideas" appendix, and "What is proven and what is proposed".

Reading conventions carried over from the pitch:

- Everything about WILDSHIFT is a **proposal**. Run facts (Emerald Chaos V2) are checked against the run log.
- **estimate** = a starting value nobody has validated. **[NEED SOURCE]** = a number nobody has measured yet. **Proposed** = a status flag on an unconfirmed feature.
- The run: Claude played Emerald Chaos V2 in mGBA from a blank save to beating Champion Wallace, via screenshots and scripted inputs, with no savestate reloads to undo outcomes. 49.9 h raw capture, 45.09 h edited video (45 parts of about an hour), 8 League runs (7 losses, then the win), 5 hard freezes, about 15 Chaos evolutions, about 10 Wonder Guard walls.
- **MUDDY** always means the run's Mudkip (Mudkip, Swampert, Machop, Wynaut, Ludicolo, Altaria, Gardevoir: seven forms). **PUDDLE** is the public mockup nickname of the WILDSHIFT starter.
- In the visuals rows, stray single letters (`k`, `y`, `o`, `w`, `i`) are colour tokens that did not survive the source conversion (e.g. "a `k` lower edge", "in `o` at zero"). Confirm the intended colours against the art-direction section before building.

---

## 1. Keep / Change / Remove / Add matrix

113 rows. Each compares one thing in Emerald Chaos V2 (as played) with what WILDSHIFT does, and names the run moment behind the call. The gameplay section of the pitch owns the rules; visuals, story and production rows restate them with their own detail.

### 1.1 Counts

| Area | keep | change | remove | add | Total |
| --- | --- | --- | --- | --- | --- |
| gameplay | 7 | 19 | 4 | 14 | 44 |
| visuals | 3 | 15 | 2 | 10 | 30 |
| story | 5 | 7 | 3 | 4 | 19 |
| production | 3 | 8 | 4 | 5 | 20 |
| **Total** | **18** | **49** | **13** | **33** | **113** |

### 1.2 Gameplay (44 rows)

| Verdict | Item | WILDSHIFT rule | Run evidence |
| --- | --- | --- | --- |
| keep | Random form changes | Shifts: Up, Side or Down; about 3 windows per creature on the island level curve | MUDDY held seven forms; a Lv40 Wailmer chaos-evolved into Seadra and carried run 8 |
| add | Shift volume limits | About 3 windows per creature; deferred Shifts resolve together at the next Waystone; auto-Anchor and auto-accept Up presets; at most ~1 Forecast per 30 minutes | ~15 Chaos evolutions in 45 h; an earlier draft's windows implied 24-42 Forecasts a run |
| change | Stopping an evolution | Anchor spends one anchor stone, with no time limit; Still Knot stops Shifts for as long as it is held | B came too late for Flygon, Heracross's line and Rayquaza |
| change | Seeing the outcome | Forecast with exactly three cards (Up, Side, Down): odds, types, stat change, ability, moves kept | Rayquaza (Lv34) turned into Trapinch with no warning |
| add | Shift-proof investment | Level, EXP, held item, nickname, Bond, trained stat points and Heartmark technique never change; per-stat floor of 10% (Drift) or 20% (Flux) | Lv19 Ludicolo became Lv16 Rhydon; MUDDY went Lv30 Altaria to Lv27 Gardevoir |
| add | Heartmark, Shiftlog and Recall | Four-point sparkle Heartmark in the same relative spot on every form; Shiftlog strip; Recall at any Shelter (Proposed) | MUDDY's seven forms were tracked by hand |
| change | Move carryover | Learnable moves stay; others go to Memory and can be relearned at Shelters; the Heartmark technique always stays | MUDDY's Wynaut kept Fly and Zap Cannon |
| add | Bond | Bond pips from story beats and Heartmark technique use; Down-to-Up shift capped at +15 on Flux and +10 on Freefall | MUDDY stayed in the party through six Chaos evolutions |
| keep | Randomized abilities | Abilities random but fixed per species per seed; Ward family kept | Wailmer's Damp blocked a Regice's Explosion twice |
| change | Ability visibility | Read from the start: party-pip strip by default, full card on a button, skipped when the roster is already Read; in-battle Read; dossiers; Decline for optional trainers | A Route 120 Metagross trainer wiped the team twice |
| add | Field Log states | Field Log with Seen / Read / Held; Held completion is the long-tail goal; tilts and Reroll to chase a form, Still Knot and Recall to keep one | Forms tracked by hand in the run log |
| add | Ward tell and readout | Hex-lattice shimmer every ~4 s and a 'Ward ?' badge (badge only after the first block on Freefall); readout lists party techniques that can land | Rustboro: 'only Fire/Ground hit'; about ten Wonder Guard walls |
| add | Ward placement guarantee | At most one per trainer and none on the first two routes (Proposed); Crackdust stocked before any mandatory Ward trainer, priced under one route payout; chip-damage disc by badge 1 | Route 117 twins' Groudon beat the team twice; Sand Tomb's trap damage worked on the Route 120 Metagross |
| change | 0-PP move selection | A 0-PP move cannot be selected; Scrap when every move is empty | 3 of 5 hard freezes came right after a 0-PP selection |
| add | Engine testing | Menu state graph covers every transition; coverage-guided fuzzing from saved states at each story checkpoint; coverage reported per build | 5 hard freezes, each recovered by resetting to the last in-game save |
| remove | Buffered input across scenes | Input flushed at every turn start, menu open and scene change | Mashed A after arriving in Dewford re-talked Mr. Briney and sailed back to Petalburg |
| change | Evasion plus recovery aces | Evasion cap +2 (Afterimages max 2); 3 Mends per creature per battle; Plumbline disc from the 7th Spire | Latias ended League runs 4, 5 and 6; Juan's Banette took three tries |
| remove | A plain stat-clear as the counter | No plain clear counts as an answer; Plumbline always hits, clears stages and blocks re-boosting for 2 turns | Champion attempt 2: 'Haze resets get re-boosted' |
| change | Doubles targeting | Target resets each turn to the foe your move hits hardest, ties left; action menu starts on Fight; ally hits need a confirm | MUDDY's action cursor sat on BAG; a B press cancelled the second creature's move choice |
| add | Bench EXP and catch-up | 60% to non-battlers from the start; Training Yard from the 6th Spire; catch-up up to x3; damping only past curve+10 and only on Rematch-board EXP | 'everything except Machoke is ~30 levels under the curve' |
| change | Grinding as the only fix | Rematch board scaled to the curve; under 1 hour to close a 25-level gap (estimate) | Seadra Lv49 to 60 (~20 rounds), then Lv60 to 74 (~30 rounds): about 5 h of edited video |
| keep | Random TM contents | Technique disc contents random per seed, fixed at new game, discs reusable | TM40 rolled Leaf Blade and fixed Machoke's Ghost problem |
| change | TM compatibility | Compatibility randomized with the move; at least 25% of species can learn each disc (estimate) | TM30 rolled Lick and nobody on the team could learn it |
| change | Shop listings | Shops show move stats and party and storage compatibility | Shop TM38 bought for 5,500 was Constrict |
| change | Money before the final gauntlet | Summit Purse: 1,500 glint deposited at every badge from badge 5; blackout costs 10% capped at 3,000; Summit losses cost nothing | 6 Revives bought before League run 3 took money to about zero |
| change | Revival supply in the gauntlet | Heal pips on dossiers, the Ward tell and readout, and Purse money set aside for revival items | Run 6: Glacia's Beautifly drained every Revive, so the Champion fight started with no Revives or Full Restores |
| change | PP restore supply | Ethers at every Shelter from badge 3; 5 PP top-up per move between Summit fights | League runs 2 and 3: Body Slam and Low Kick, then Leaf Blade, hit 0 PP at Drake |
| keep | Wild legendaries on routes | Errants roam at ~1 in 300 encounters (estimate) plus story sightings; KO'd Errants return after the next badge or 2 hours | Jirachi Lv25, Rayquaza Lv15/26/27, Deoxys Lv36, Groudon Lv40 |
| add | Capture Stance | Toggle taught by Corin; no move slot; party damage cannot drop a wild creature below 1 HP | Claude KO'd a Lv15 Rayquaza and a Lv25 Jirachi while trying to catch them |
| change | Capture presentation and odds | Lantern: raise it, light draws the creature in, a 3-segment glow meter fills; no throw, wobble or click; odds shown before spending a Lantern; +3% per failed attempt, cap +15% (estimates) | 4 Ultra Balls failed before a Great Ball caught Rayquaza; Deoxys took about six Ultra Balls |
| change | One-of-a-kind capture item | Keepsakes pocket; cursor never starts there; confirm screen that names the target | Master Ball spent on a wild Lv26 Kyogre by a scripted down press |
| keep | Full gauntlet tension | Back-to-back structure; full restart on Freefall only; Dossier, heal cap of 2 per Keeper, PP top-up | 8 League runs, 7 losses: Drake ended runs 1, 2, 3 and 7; Wallace ended runs 4, 5 and 6 |
| add | Summit Bell | Drift and Flux: after a loss, the next attempt starts at the Keeper who beat you, or the Champion's door; you can always decline it | Each Drake loss replayed three won fights; each Wallace loss replayed four |
| change | Save menu and save writes | Save fixed as the last menu item; checksum-verified writes; 3 rotating autosaves; crash resume summary | Early saves silently failed; the one crash-backup load also rewound a loss to Brawly |
| remove | Rematch phone calls | Pull-based Rematch board at Shelters; calls only as an opt-in setting | PokeNav rematch calls were constant through the late-game surf routes |
| keep | Opening upset | Linnet's Caldermaw is a scripted Lv5 story Shift on every dial; a 'hold out 3 turns' scene that continues on any result; the rematch follows the dial | 'Identity Crisis' fired in Oldale; Claude lost to the Lv5 Groudon, ground MUDDY to Lv11-12 and won the rematch |
| keep | Achievement banners | Non-blocking toasts with WILDSHIFT's own joke titles, plus a menu state graph test per build | Opening the ACHIEVE menu left the map black until the party screen opened |
| change | Item randomization | Field pickups random on Flux and Freefall and named before pickup; Shelter staples never randomize | A Potion became Soda Pop |
| change | Puzzle state and layouts | State persists; reset lever; boulder undo; gate preview; seed never alters hinted layouts | Mossdeep switch puzzle reset on exit; third Sootopolis ice layout differed in the hack |
| remove | Ambiguous tiles and heavy overlays | Distinct grass; 35% overlay cap (estimate); Clear visuals toggle; collision map | Trees near Mauville; Lavaridge fog; rain after Kyogre; Victory Road needed collision data |
| change | Travel NPCs | Destination confirm with No as default; input flush on scene change | Mr. Briney sailed back by accident after a re-talk |
| add | Chaos dial and seeds | Drift / Flux / Freefall / Custom at new game; placements fixed at new game; a mid-run dial change marks the Seed Card 'not race-eligible' | The same randomness produced the Seadra story and about ten Wonder Guard walls |
| add | Social play scope | Single-player at launch; no trading or PvP; seed races and the Seed Card; weekly community seed post-launch; async seed duels are an Expand idea only | Per-seed Shift tables and Ward placement make cross-seed balance impossible |
| add | Challenge modes | No Rewind, One Life, No Carry, Restless, Ride the Dice, Blind Read, One Heart, Empty Wallet, Accidental Hero | The run's self-imposed no-savestate rule was the first challenge mode |

### 1.3 Visuals (30 rows)

| Verdict | Item | WILDSHIFT rule | Run evidence |
| --- | --- | --- | --- |
| keep | 16px tile grid and GBA-era pixel look | 16px tiles on a 320x180 native canvas, integer-scaled, master palette built on Sweetie 16 | Logged navigation problems trace to specific tiles and weather, none to tile size |
| change | Aspect ratio and view size | 16:9 showing 20x11 tiles; 320x200 on 16:10 handhelds; never stretched; Large Text and Japanese draw on a 640x360 overlay | Emerald: 3:2 showing 15x10 tiles; Victory Road needed collision data |
| change | Grass vs blocking foliage | Encounter grass shows ground between tufts and rustles on step; blocking foliage always has a trunk or base, a `k` lower edge and a shadow | The Mauville bushy tiles read as grass and were trees |
| change | Weather, fog and darkness | Weather draws above props on its own layer; 3:1 ground contrast floor (estimate) checked by automated capture; caves keep a light radius of 3+ tiles (estimate) and wall rims | Lavaridge Gym fog, post-Kyogre rain, Brawly's dark gym |
| add | Path view overlay | One-button overlay of walkable tiles, ledges, warps and encounter tiles | Victory Road routing relied on collision data pulled from the pokeemerald source |
| change | Puzzle state display | Gates show pivots and arm arrows; switches show state by shape; ice shows slide trails; solved puzzles stay solved and light a marker | Fortree, Mossdeep, Sootopolis puzzle 3, Seafloor boulders |
| remove | Timed cancel during form change | No timing window anywhere; the Forecast panel waits for the player and ignores buttons held from before it opened | B window missed at least 3 times across ~15 Chaos evolutions |
| add | Shift Forecast panel | Exactly three cards (Up, Side, Down) with odds as number and bar, types and stat arrows; silhouettes for unseen forms on Freefall only; a KEEPS row; Accept, Reroll (Starsalt, 1/2/4) and Anchor (one anchor stone) with costs and holdings shown | Rayquaza Lv34 down into Trapinch; Wailmer Lv40 into Seadra; neither visible in advance |
| change | Form-change animation and continuity | Shift pixel-scramble that resolves outward from a four-point-sparkle Heartmark in the same spot on every form; Heartmark glint on reveal; Shiftlog per creature | MUDDY's seven forms linked only by nickname |
| add | Ward shimmer, badge and after-block readout | Hex shimmer and glass ping on send-in, replaying about every 4 s; a 'Ward ?' badge (on Freefall, only after the first blocked hit); then a list of which party techniques can land | Wonder Guard on about ten foes |
| add | Scouting readout | Read from the start: party-pip strip before trainer battles, full card on a button, Unknown / Read / Confirmed on every field, an effectiveness word on each move; the Scouting Prism adds moves, held items and Mends pips | Juan's Banette took 3 tries; Drake ended runs 1, 2, 3 and 7 |
| add | Mends pips and evasion marker | 3 Mends pips per creature on the info box (a foe's pips need the Scouting Prism); an EVA +1/+2 marker; a Plumbline lock count | Wallace's Latias stacked Double Team with Recover or Protect |
| change | PP display and empty moves | Numeric PP; warning colour at 25% or less (estimate); EMPTY label; cursor skips the slot; Scrap when all four are empty; RUN visibly locked in trainer battles | 5 hard freezes, three after selecting a move at 0 PP |
| change | Pause menu layout and save feedback | Fixed menu slots with new entries appended; verified-save toast; a 'Not saved' banner that stays until dismissed; Waystone glyph during autosave | Early saves failed silently |
| change | Achievement banners | 3 s (estimate) top toasts that never take input; no menu ever blanks the map | Map stayed black until the party screen was opened |
| add | One-of-a-kind item guard | Unique items sit in a `y` frame; using one asks for confirmation with the cursor on No; pockets open at the top | Scripted down press spent the Master Ball |
| change | Technique disc shop listing | Each row shows technique, type, power and party learner icons before purchase | TM38 (5,500) was Constrict; TM30 was Lick with no learners |
| change | Funds readout | Shops show glint left after each purchase; the badge screen shows the Summit Purse deposit | 6 Revives after Drake took money to about 0 |
| add | Supplies readout between Summit fights | Between Summit fights the party screen shows total PP per creature and lists revival and full-heal items left, in `o` at zero | Run 6 Champion fight started with no Revives or Full Restores |
| change | Item effects on pickup | Pickup boxes and bag entries show the icon plus a one-line effect | A Potion became Soda Pop |
| keep | Legendaries on ordinary routes | Keep the surprise as Errants; stage it with a `w` streak intro and a pale `i` dust ring on the platform | Kyogre, Rayquaza and Deoxys joined the party |
| change | Capture and send-out presentation | Lantern capture: raise the Lantern, light draws the creature in, a 3-segment glow meter fills in one sweep; no throw, wobble or click; send-out is a light-to-form unfold | IP guardrail: throw/wobble/click is Pokemon's signature; flow goes to patent clearance before animation |
| add | Catch support HUD | A Stance tag while Capture Stance is on; a 'May KO' tag on moves when it is off; capture odds as number and bar before a Lantern is spent | Jirachi and Rayquaza KO'd by accident |
| add | Battle speed control | 1x, 2x or 4x animation speed, toggled with one button mid-battle | Seadra's grind: about 5 h of edited video (parts 40 to 44) |
| change | Doubles targeting | Cursor starts on the foe your chosen move hits hardest, ties going left; an arrow over the target, a lit name box and the target named in text; the command menu opens on Fight every turn | Workaround in the log: press left and up before every FIGHT |
| remove | Rematch call interruptions | No rematch calls; rematches sit on each Shelter's Rematch board | Constant calls on the surf from Route 127 to Route 131 |
| change | Travel NPC prompts | A destination card with a map thumbnail; the cursor starts on No when the trip heads back | Mr. Briney's re-talk |
| keep | Numeric HP on the player's side | Keep it, and add a percentage for foes once Read | Seadra beat Wallace's Latias with Bite x3 at 11 HP |
| change | Villain faction visuals | The Mooring and the Scatter differ in silhouette, shape language and palette and read apart in grayscale; the story section owns the plots | Magma Hideout, Slateport harbor, Aqua Hideout back to back |
| add | Level-gap indicator | Foe level turns `o` with an up-arrow when it is 10+ levels above the active creature (estimate) | Final MUDDY was Lv27 against Wallace's Lv55 to 58 team |

### 1.4 Story (19 rows)

| Verdict | Item | WILDSHIFT rule | Run evidence |
| --- | --- | --- | --- |
| change | Villain factions | The Mooring (a public institution that wants to stop change) and the Scatter (a loose movement that wants to spread it); different structures, methods and points; the player works with each, and each gets a partial win | Magma and Aqua read as the same plot twice |
| remove | Twin villain hideouts | No hideouts; the Mooring works from a public office in Saltreach; the Scatter lives on the Carnival Raft, which docks where you already are | Two hideouts at opposite ends of a backtracking loop |
| remove | Backtracking story order | One clockwise pass around a ring of islands; each island's plot resolves on that island; returns are optional, by skiff, from badge 2 | Mt Pyre, Magma Hideout, Slateport harbor, Aqua Hideout |
| change | Weather crisis | The crisis is the Vagary's return and the Surge, a rise in wild Shifts; weather is a readable skill taught at the Weather Spire with a posted forecast | Fog, rain and dark caves made maps hard to read |
| change | Sky Pillar and the sky legend | Sorrel settles the crisis by reading Vagary, a seven-phase boss that posts its next form each phase; the fight happens on a sea stack under the comet's low pass; nothing descends into the lagoon | Wild Rayquaza at Lv15/27/26; the caught one became Trapinch at Lv34 |
| keep | Wandering mentor | Corin Vale keeps the role and adds teaching: the Forecast in Act I, Capture Stance and the Lantern in Act II; Corin's failing eyes push Sorrel to take the lead in Act III | Claude KO'd a Jirachi and a Rayquaza while trying to catch them |
| keep | Wally's arc | Tobin's companion Rillfin Shifts into a form that cannot leave water; he carries it, learns its Forecast, and meets Sorrel on the Causeway with Rillfin in a form that walks and swims | MUDDY ended as a Gardevoir, the final form of Wally's own line |
| keep | Rival opens with an absurd creature | Linnet's starter Shifts into a Lv5 Caldermaw on the dock, a scripted story Shift on every dial; the fight is a 'hold out 3 turns' scene that continues on any result; the rematch is marked at Brackenford, and it and later teams follow the dial | May's Lv5 Groudon |
| add | Rival's own arc | Caldermaw Shifts down into Sootling; Linnet refuses both factions' fixes, trains a bench herself, and returns as a balanced rival | May had no arc |
| change | Gyms | Eight Spires, each run by a Spire leader; each teaches one kind of chaos (Shifts, Wards, discs, weather, immunities, the one-carry team, evasion, attrition) and ends with a battle that uses it | Gyms became luck checks under Chaos |
| change | Champion | Idris Fenwake's Vesperay is an evasion-and-recovery tank with visible Afterimages (two at most) and a budget of 3 Mends; the 7th Spire gives Plumbline, Linnet gives Gnash, the Scouting Prism shows remaining Mends; Idris has a personal arc that ends with releasing his anchor | Latias ended runs 4, 5 and 6; run 8 won with Bite x3 at 11 HP |
| change | Elite Four | The Summit Keepers: four Keepers back to back, each a remix of two Spires; teams stay fixed between attempts; the Scouting Prism shows their held items and heal pips | Drake ended 4 of 8 runs |
| add | League checkpoint | The Summit Bell: Idris's gate remembers a challenger once; on Drift and Flux the next attempt starts at the Keeper who beat you; Freefall keeps the full restart; Summit losses cost no glint | 7 full restarts in 8 League runs |
| keep | Legendaries on normal routes | Errants: roaming great creatures on normal routes; capture odds show before you spend a Lantern; Capture Stance holds a wild creature at 1 HP or more; one-of-a-kind items need a confirm; a KO'd Errant returns after the next badge or 2 hours of play | Master Ball on a wild Lv26 Kyogre through bag cursor memory |
| add | Heartmark and Shiftlog | A lit Heartmark keeps the nickname, Bond and Heartmark technique; a Shift never touches level or EXP; the Shiftlog and Seed Card show every form | MUDDY: Mudkip, Swampert, Machop, Wynaut, Ludicolo, Altaria, Gardevoir |
| change | Story ferry | Maud Tallis runs the ring ferry, leads the 1st Spire, has her own arc, and always confirms the destination | Mr. Briney sailed back by accident |
| remove | Rematch phone calls | Spire leaders and trainers post rematch offers on the Rematch board at every Shelter | Constant PokeNav calls on the sea routes |
| keep | Achievement banners | Journal stamps fire on story moments: 'Identity Crisis' when Caldermaw lands; 'First Steps' on the rematch win; stamps live in the journal and never redraw the map | ACHIEVE menu left the map black |
| add | Post-game | The Vagary's long pass: stronger Errants, Vagary capture, faction epilogues, seed codes and the Seed Card, Field Log completion and a player-built ninth Spire; No Rewind is a challenge mode chosen at new game | The run ended at the Hall of Fame and was itself a no-reload challenge |

### 1.5 Production (20 rows)

| Verdict | Item | WILDSHIFT rule | Run evidence |
| --- | --- | --- | --- |
| remove | Pokemon assets | All-original creatures, world, music and story; no Pokemon names, images or run footage in marketing; public mockups call the starter PUDDLE | Every highlight of the run sits on Nintendo's game |
| keep | Random form changes, up and down | Shifts stay the core loop, about 3 windows per creature; a Shift never touches level, EXP, held item, nickname, Bond, trained stat points or the Heartmark technique | Seadra at Lv40 beat Latias on 11 HP; Ludicolo Lv19 to Rhydon Lv16 |
| change | Stopping a form change | The Forecast: three cards (Up / Side / Down) with odds, then Accept, Reroll for Starsalt (1 / 2 / 4) or Anchor with an anchor stone; no timing | B presses came too late several times |
| change | Hidden abilities | Read, from the start, shows types and abilities before you commit; Wards shimmer with a 'Ward ?' badge (on Freefall, only after the first blocked hit); after a blocked hit the readout lists which party techniques can land | About ten Wonder Guard walls |
| remove | Freeze on an empty move | A technique at 0 PP cannot be selected; Scrap fires when every technique is empty; menu-graph tests and checkpoint fuzzing report coverage on every build | Five hard freezes, three on a 0-PP selection |
| change | Saving | Verified autosave with checksums, three rotating backups, an on-screen saved check, and Save fixed at the bottom of the menu | PokeNav shifted the SAVE slot; saves silently failed |
| change | Technique items | Discs stay random; the shop names the technique; every disc has learners in the roster | TM30 Lick; TM38 Constrict for 5,500 |
| change | Party growth | Bench EXP from the start (60% to creatures that sit out), plus a per-island level target the simulator checks | Machoke Lv73 and Seadra Lv75-76 carried; MUDDY Lv27, 46 levels behind |
| change | Run length | A 20-25 hour main path on Drift or Flux (estimate); no required grind over 30 minutes (estimate) | 45.09 h edited (49.9 raw); ~5 h was one Seadra grinding |
| keep | Wild legendaries as normal encounters | Errants roam the islands; capture odds show before each attempt; Corin teaches Capture Stance (a toggle, no move slot); a KO'd Errant returns after the next badge or 2 hours of play, whichever comes first | Jirachi Lv25 and Rayquaza Lv15 KO'd by accident |
| add | Confirm before one-of-a-kind items | A confirm prompt on any one-of-a-kind item; rare items never sit under a remembered cursor | Master Ball thrown at a wild Lv26 Kyogre |
| change | Economy for long gauntlets | A blackout costs 10% of glint, capped at 3,000; Summit losses cost nothing; the Summit Purse takes a fixed 1,500 glint at every badge from badge 5; Ethers stocked at every Shelter from badge 3 | Six Revives left about 0 money; run 6 had no Revives for the Champion |
| change | League checkpoint | On Drift and Flux, the Summit Bell lets the next attempt start at the Keeper who beat you; full restart on Freefall only | 8 League runs, 7 losses |
| add | Seeds and Chaos dial | Shareable seed codes and a Chaos dial with three named levels (Drift, Flux, Freefall) plus Custom; the slice ships Drift and Flux | The run's best stories came from rolls that could not be handed to another player |
| add | Forecast volume | About 3 Shift windows per creature; deferred Shifts resolved at Waystones; per-creature presets; at most about 1 Forecast per 30 minutes | A six-creature party with 4 to 7 windows each would mean 24 to 42+ Forecasts a run |
| add | Streaming and run logs | In-game Shiftlog, run timer, the Seed Card and a streamer mode | 45 video parts plus a hand-written run log |
| keep | Joke achievement banners | Joke achievements stay, and the achievement menu returns to the map cleanly | 'Identity Crisis' fired in Oldale |
| remove | Constant rematch calls | A Rematch board at each Shelter; no calls that interrupt play | Constant while surfing Routes 127 to 131 |
| remove | Trading and PvP | Single-player at launch; no trading or PvP; social play is seed races and the Seed Card; async seed duels are an Expand idea, not a promise | Per-seed tables make cross-seed balance impossible |
| add | Human authorship | A named human creative director and producer hold creative authority; the team authors or substantially revises every shipped asset, text and name, with authorship records; Steam AI-content disclosure is planned | US Copyright Office guidance (2023) and Thaler v. Perlmutter (D.C. Cir. 2025) |

---

## 2. Glossary (verbatim)

Every section of this pitch uses these names and only these. The gameplay section owns the rules. This list only says what each name means.

**World and story**

- **WILDSHIFT:** working title. Trademark search pending.
- **Brindle Isles:** seven islands plus **Starfall Lagoon** and **the Causeway**. **Saltreach** is the port town. There is no separate hub town.
- **the Vagary:** the comet. Its legendary creature is also called **Vagary**. Its shards are **skyglass**. The **Heartshard** rides the returning Vagary and is reached from a sea stack in the finale.
- **Errants:** roaming legendaries. **Star-touched:** rare comet-touched forms, fixed at about 2% on every dial.
- **the Mooring:** the faction that wants to stop all change, led by Provost Agathe Merrow. **the Scatter:** the faction that amplifies change, led by Teo Varga.
- **People:** **Sorrel** (protagonist default name), **Corin Vale** (mentor), **Linnet Rask** (rival), **Idris Fenwake** (Champion).

**Progress**

- **Spire**, **Spire leader**, **badge:** the gym, its leader and its reward. There are eight Spires. The 8th is on the Causeway.
- **the Summit** at **Shardcrown:** the league. **The Summit Keepers** are its four, then the Champion. **Summit Bell:** the checkpoint on Drift and Flux. **Summit Purse:** a fixed 1,500-glint deposit at every badge from badge 5, shown on the badge screen.
- **Shelter:** heal point with the **Rematch board**. **Waystone:** autosave and fast-travel point.
- **glint:** money.

**Shifts**

- **Shift:** a permanent change of form, driven by growth and forecast before it happens.
- **Forecast:** three cards, Up / Side / Down, with odds. The player picks **Accept**, **Reroll** or **Anchor**.
- **Chaos dial:** three named levels, **Drift**, **Flux** and **Freefall**, plus **Custom**.
- **Starsalt:** pays for a Reroll (1, then 2, then 4 within one Shift). The Scatter refines it from skyglass dust. **anchor stone:** spent to Anchor. **Still Knot:** a held item that blocks Shifts for good.
- **Heartmark:** a small four-point sparkle. It lights only once a creature is bonded, so wild creatures show none, and it keeps its spot through every form. **Heartmark technique:** the technique it carries. **Bond:** moves Forecast odds from Down to Up, with a cap.
- **Shiftlog:** a creature's form history. **Seed Card:** the end-of-run summary.

**Battle and catching**

- **Ward:** a family of defensive abilities that block whole categories of hits. It is our version of the run's Wonder Guard walls, with a visible tell. **Crackdust:** the Ward suppression item.
- **Read:** scouting, available from the start. **Scouting Prism:** an upgrade that adds moves, held items and heal pips. **Field Log:** the bestiary, with states Seen / Read / Held.
- **Lantern:** the capture device. **Capture Stance:** a safe-capture toggle taught by Corin. It uses no move slot.
- **Scrap:** the fallback action when every technique is empty. **Mends:** 3 recovery pips per creature per battle. **Plumbline:** the evasion-counter disc from the 7th Spire.
- **Types:** Plain, Grit, Brine, Kiln, Moss, Bolt, Rime, Gust, Stone, Rust, Glass, Hollow, plus **Star** outside the chart.
- **Challenge modes:** the gameplay section owns the list. It includes **No Rewind** and **One Life**.

**Creatures named in this pitch**

- **Sloshkin:** the teal, newt-like starter family. Its Heartmark technique is **Undertow**. **Skeinwing** is a Sloshkin after a Shift. Public mockups nickname the starter **PUDDLE**. **MUDDY** only ever means the run's Mudkip.
- **Caldermaw:** Linnet's opening creature. It later Shifts to **Sootling**. **Vesperay:** the Champion's ace. **Prismoth:** the Ward creature. **Scrapling:** a small brawler. **Vagary:** the comet creature.

---

## 3. Production plan, platforms and scope

**One-line summary.** WILDSHIFT (working title) is an original 2D creature-collecting RPG; PC (Steam) first, then Nintendo Switch (the Switch build also runs on Switch 2); a core team of about nine (estimate) builds it in about 26 months to PC launch (estimate); the single ask is to fund pre-production and a vertical slice (Gate 1), then judge full production on the slice metrics at Gate 2 (month 9).

### 3.1 Platforms, engine, price

| Topic | Rule |
| --- | --- |
| Platforms | PC on Steam first; Steam Deck is the handheld target from day one. Switch version within six months of PC launch (estimate) via a porting partner; runs on Switch 2; QA on both. Controller and keyboard both first-class. |
| Performance | Steady 60 fps on Steam Deck is a hard requirement. |
| Engine | Godot 4, pending a pre-production check (open source, no royalties). Console builds go through a third-party porting partner; written port quote before the slice ends. |
| Nintendo and ratings | Developer program application in pre-production (lead time [NEED SOURCE]). Port milestone includes lotcheck plus one resubmission (estimate). Ratings in alpha/beta: IARC, plus ESRB and PEGI where needed. |
| Price | $19.99 at launch (estimate); $19.99 vs $24.99 tested with slice players. Demo is free. |
| Social | Single-player at launch; no trading, no PvP. Each seed has its own Shift tables and Ward placement, so cross-seed balance is impossible. Social play = seed races and the Seed Card. Async seed duels are an Expand idea, not a promise. |

### 3.2 Scope (estimates, locked at the end of pre-production)

| Item | Value |
| --- | --- |
| Roster | About 100 creature forms in about 30 Shift families. A Shift turns a creature into another form from the same roster: Shifts cost code and balance time, add no new sprite sets. |
| Art per form | 8 battle frames (64x64, front and back: 2-frame idle, attack pose, hit pose), a 32x32 mini portrait, a 2-frame 24x24 party icon, 8 overworld follower frames = about 19 frames per form. About 1 in 6 forms is a large 80x80 form. Errants use up to 96x96. Each form sprite stores the body points the engine needs to place the Heartmark in the same relative spot. The visuals section's sprite-scale table is the single source. |
| World | The Brindle Isles: seven islands, each with a town, two or three routes, one dungeon and one Spire. The first island adds the home village. Starfall Lagoon holds the Causeway (8th Spire), Shardcrown (the Summit) and the sea stack for the finale. Saltreach is the port. No separate hub town. |
| Map count | 8 towns, 14 to 21 routes, 7 dungeons, 3 to 5 lagoon maps = about 32 to 41 maps, plus building interiors (estimate). |
| Length | Main path 20 to 25 hours on Drift or Flux; 35+ hours for completionists and Freefall. No required grind longer than 30 minutes on Drift or Flux (estimate). |
| Shift volume | About 3 Shift windows per creature over a run, tied to the island level curve. Deferred Shifts resolve together at the next Waystone. Target: at most about 1 Forecast per 30 minutes of play. |
| Chaos dial | Drift, Flux, Freefall plus Custom, all selectable at new game, with shareable seed codes. Freefall approximates Chaos V2; its odds stay [NEED SOURCE] until measured from the run's logged evolutions. |
| Japanese text | The 320x180 art layer uses a 5x7 Latin font (cannot draw kanji). Japanese always renders on the 640x360 overlay (same layer as Large Text mode) with a pixel font about 12px tall. Pre-production checks every text box against that size. Japanese ships in the second localization wave. |

**Why that length.** The run's edited video is 45.09 h (49.9 h raw before cutting freezes, resets and idle waits); about five hours (parts 40-44) is one Seadra grinding Victory Road in two blocks (Lv49 to 60, about 20 rounds; Lv60 to 74, about 30 rounds) with the bench about 30 levels under the curve. WILDSHIFT wants that tension in about half the time.

### 3.3 Timeline (months from funding; all estimates)

| Phase | Months | Contents / exit |
| --- | --- | --- |
| Pre-production | 1-4 | Shift odds and Chaos dial design doc; type chart with side-by-side diff against Pokemon's for counsel; roster list with 100 names checked against existing creature games; art bible on the 21-color master palette (credit and licence confirmed); engine decision and porting quote; Nintendo developer-program application; name clearance for WILDSHIFT and Vagary by month 2; patent clearance review of the Lantern capture flow and the visible-odds UI before any capture animation; Japanese text-box check at about 12px on the 640x360 overlay; authorship-record process; headless battle simulator (thousands of seeded fights overnight) and first menu-graph test. **Exit check:** a gray-box loop where a creature levels up in a fight, Shifts through the Forecast after the battle ends, and a Ward reads correctly to five outside testers. |
| Vertical slice | 5-9 | Contents in section 4. Exit: the slice metrics (section 5). **Gate 2** = decision to fund full production. |
| Production | 10-21 | Islands 2 to 7, the Causeway, Shardcrown and the finale; roster to about 100 forms; full story; music; Freefall and Custom; seed codes; achievements; accessibility options. Content complete at month 21. |
| Alpha and beta | 22-25 | Closed beta with about 500 community seed testers; Steam Next Fest demo built from the slice; balance passes from simulator data and opt-in telemetry; age ratings. **Release bar:** zero known soft-locks and zero known save-loss bugs. |
| Launch | 26 | PC on Steam, Steam Deck Verified as the target. |
| Switch port | 26-32 | Own milestone; within six months of PC launch; lotcheck with one resubmission; tested on Switch and Switch 2. |
| Post-launch | 27-32 | Seed of the Week, two free content updates, published data schemas so players can share rule sets. |

If the slice misses its metrics: up to two extra months on the slice. Production does not start on a failed gate.

### 3.4 Art throughput (summary)

Assumption: a creature artist-animator finishes about 20 frames a week (about one standard 19-frame form per artist-week); an 80x80 form counts 1.5, a 96x96 Errant counts 2. Creature line: ~79 standard forms (~79 artist-weeks), ~16 large forms (~24), ~5 Errants and Vagary (~10) = about 113 artist-weeks; the slice builds 12 forms (~14 artist-weeks), leaving ~100 against ~92 available from two artists in months 10-21: a gap of about 8 artist-weeks. Fixes in order: (1) creature artists start production forms in slice months 8-9 once slice art locks; (2) if the slice measures under 20 frames/week, the contract character pixel artist takes the follower frames; (3) roster drops toward 90 forms using the cut list ordered at month 4. Contract lines: ~40 trainer battle sprites (64x64, ~3/week), ~110 dialogue portrait frames (48x48; 4 expressions, 6 for the main cast; ~10/week), ~30 overworld people / ~500 frames (16x24; 4 directions, walk cycles, run cycle for the lead; ~40 frames/week), 8 to 10 key stills (320x180, ~1 per 1.5 weeks). Tiles, biome palettes and UI: unmeasured [NEED SOURCE: slice measure].

### 3.5 Team, budget, legal (one line each)

- **Team:** about 9 core (creative director, producer, systems designer, gameplay programmer, tools and platform programmer, 2 creature artist-animators, environment and UI artist, part-time narrative designer) plus contractors (character pixel artist ~9 months, pixel illustrator ~4 months, composer/sound ~35 tracks, external QA, porting partner, localization in EN then FR/IT/DE/ES/JA, IP counsel, community manager); a named human creative director and producer own the game and Claude's documents are briefs.
- **Budget:** full plan about $1.6M to $3.6M (216 person-months at $5k-$10k loaded, 15% contingency); Gate 1 (months 1-9) about $340k to $700k is the only money asked now; lean plan (7 core, ~70 forms, ~28 months) about $1.5M to $3.3M; break-even at ~$12.50 net per $19.99 unit is ~128k-288k units (full) or ~27k-56k (Gate 1 only), PC only, before any publisher share.
- **Legal:** no Pokemon licence is available or sought; the fan hack cannot be sold or shipped; a patent clearance review (Lantern capture flow, visible-odds UI) runs in pre-production given the 2024 Nintendo/TPC v. Pocketpair suit; AI-drafted material is treated as unregistrable without human authorship, so team authorship records and Steam AI disclosure are planned; trademark searches (USPTO, EUIPO, UKIPO, JPO, Steam, eShop, domains, handles) for WILDSHIFT, Vagary, Heartmark and creature names clear or get replaced by month 2.

### 3.6 Legal-driven design guardrails (binding on design)

- Own type set: twelve types plus Star outside the chart; at least half of all strong/weak pairings differ from Pokemon's. One deliberate homage: **Hollow is immune to Plain and Grit** (the wall that stopped the run's Machoke).
- Own capture method: the Lantern is raised, light draws the creature in, a 3-segment glow meter fills; no throw arc, no wobble, no click. Send-out is a light-to-form unfold.
- No device the trainer wears to trigger Shifts. No crystal overlays on creatures. The finale does not descend into a central crater to a giant crystal (the Heartshard rides the returning Vagary and is reached from a sea stack). No island-trial structure: gyms are Spires. No "... Four" name for the Summit Keepers.
- No map layouts, music, characters or plot beats copied from Emerald.
- Shifts differ from anything in Pokemon by being permanent, growth-driven and forecast: three outcomes with odds, chosen before anything changes.
- Marketing: no run footage, no Pokemon name or image in trailers, store pages or ads; public mockups use PUDDLE; MUDDY stays internal; dev-blog posts about the run go through counsel.
- Avoid names tied to other games or franchises: Elite Four, IronMON, Starfield terms. "Shift" already names a mechanic in Monster Sanctuary, so the trademark search covers it.

---

## 4. Vertical slice: exactly what it contains

The first 60 to 90 minutes of the game (estimate), built to final quality. Status: Proposed.

| Element | Slice content |
| --- | --- |
| Story | The Vagary prologue (about 5 minutes), the home village, two routes, one cave, and the first island's town and its Spire. |
| Creatures | 12 forms (estimate), including the 3 starters with Sloshkin among them. Each has the full art set and its Heartmark placement points. |
| First Forecast | On the road before the 1st Spire, with Accept and Anchor. Three cards, Up / Side / Down, with odds. Anchor spends an anchor stone. Stones are issued free on Drift and refilled at each badge; on Flux they are bought at Shelters. No button timing. |
| Reroll | The 1st Spire teaches it and gives the first Starsalt. A Reroll costs 1, then 2, then 4 Starsalt within one Shift. |
| Shift windows | Two route creatures can also reach a Shift window. Deferred Shifts resolve at the next Waystone. Per-creature presets (auto-Anchor, auto-accept Up) are in. The player's creatures never Shift mid-battle. |
| Rival | Linnet Rask's Caldermaw, a scripted Lv5 story Shift on every dial. First fight is a "hold out 3 turns" scene that continues on any result. The rematch follows the dial. |
| Ward | One mandatory trainer with a Ward creature. Hex-lattice shimmer replays about every 4 seconds, with a "Ward ?" badge. After a blocked hit, the readout lists which party techniques can land. Crackdust is in stock at the Shelter before that trainer, priced under one route trainer's payout. One chip-damage disc (poison or trap) is guaranteed by badge 1. |
| Read | Available from the start. Before trainer battles a compact party-pip strip shows by default; the full Read card opens on a button; the card is skipped when every creature on the roster is already Read in the Field Log. In-battle Read is in. |
| Technique discs | 8, with randomized contents. The shop names the technique on every disc, and each disc has at least 3 learners among the slice creatures. |
| Capture | The Lantern, with capture odds shown before each attempt. |
| Safety | A technique at 0 PP cannot be selected; Scrap fires when every technique is empty. Verified autosave with three rotating backups and an on-screen saved check. A confirm prompt before spending any one-of-a-kind item. |
| Bench EXP | On from the start. Creatures that sit out a battle get 60%. |
| Chaos dial | Drift and Flux, plus a seed code on the title screen. |
| Shiftlog | Every form a creature has held, with level and place. |
| Telemetry | Forecasts per hour, Accept rate, Reroll rate and the "glad I rolled?" prompt. |
| Build | Windows and Steam Deck, English only, 4 music tracks. |

**Not in the slice:** islands 2 to 7, the lagoon, story past the first island, Freefall and Custom, Errants and Capture Stance, localization and console builds.

---

## 5. Vertical slice success metrics

All targets are estimates. Status: Proposed, not tested. Tested with 30 to 50 outside players plus opt-in telemetry.

| Metric | Target | Run reference |
| --- | --- | --- |
| Stability | Zero hard locks and zero lost saves across at least 200 tester-hours. Menu-graph test covers every menu transition in the slice; fuzzing coverage reported for each slice checkpoint. **One freeze fails the gate.** | The run had five hard freezes. |
| The Forecast is understood | After their first Shift, at least 80% of testers can explain what Anchor does and what the odds meant, without a tutorial screen. | |
| Players want the dice (Accept rate on Drift) | Accept on at least 50% of Forecasts, measured on Drift (anchor stones free and refilled at each badge, so Anchoring costs the least). Bond pips come from story beats and Heartmark technique use, so nothing pays a player to Accept. | |
| "Glad I rolled?" | One-tap prompt after each resolved Shift: at least 60% yes. | |
| Voluntary Rerolls | At least 25% of testers who hold Starsalt Reroll at least once. | |
| Forecast load | At most about 1 Forecast per 30 minutes of play for the median tester. | |
| Wards are readable | At least 90% of testers who meet the Ward creature find a working answer within two attempts. | The run lost twice to the Route 117 twins' Wonder Guard Groudon. |
| The bench stays useful | In the 1st Spire fight, the median tester uses at least 3 creatures, and the party's level spread stays under 6. | The run ended with a 46-level gap (Machoke Lv73, MUDDY Lv27). |
| The opening holds | At least 85% of testers who start the slice reach the 1st Spire. The Caldermaw "hold out 3 turns" scene continues on any result. | |
| No accidental spends | Zero one-of-a-kind items used without the confirm prompt. | |
| Replay intent | At least 70% of testers say they would start another seed. | |
| Performance | A steady 60 fps on Steam Deck. | |
| Length | Median session lands between 60 and 90 minutes. | |

**Gate rule.** If three or more targets miss, fix the slice before production starts. If the Drift Accept rate and the "glad I rolled?" rate both miss, stop and rethink the core, because the whole pitch rests on players wanting the dice.

---

## 6. Testing plan (Proposed; owned by the tools and platform programmer from month one; external QA joins at the slice)

Rationale: random input from boot does not reach late-game states (the run's five hard freezes came from before badge 2 to after hour 28 of in-game time), and a frame count says nothing about which states the tests reached, so every build reports coverage.

- **Menu state graph.** Enumerate every menu state and transition from data and test each transition; open and close every menu from every map and compare the frame before and after. A black map fails the build.
- **Coverage-guided fuzzing from checkpoints.** Saved states at each story checkpoint: each Waystone on the critical path, each Spire door and the Summit gate. The fuzzer starts from those states and steers toward unreached code and states.
- **Coverage per build.** Menu transitions covered, battle states covered and code coverage, per checkpoint.
- **Battle invariants.** A 0-PP technique is never selectable. Scrap fires when every technique is empty. No state exists without a legal action. Buffered input is flushed on every scene change and menu open.
- **Save tests.** Interrupted writes, checksum failures and backup rotation, on PC, Steam Deck, Switch and Switch 2. A save never fails silently; Save stays the bottom menu item.
- **Nightly simulator and seed validator.** Thousands of seeded fights a night. The validator rejects a seed where a required boss has a Ward with no reachable answer, or where a disc has no learner. The simulator flags seeds whose Forecast rate runs over the target.
- **People.** Five outside testers at the pre-production check, 30 to 50 at the slice, about 500 seed testers in beta (estimates). Every bug report carries a seed code.
- **Platform.** Steam Deck Verified checks, and lotcheck preparation with external QA.

---

## 7. Comparable games and what each teaches

No reliable sales figures for any of these; sales listed as unknown.

| Game | Studio, year | What it does | Lesson for WILDSHIFT |
| --- | --- | --- | --- |
| Cassette Beasts | Bytten Studio, 2023 | Any two forms can fuse in battle, built from a part-based art system | Large combinatorial variety is affordable when the pipeline is built for it from day one; Shifts reuse the roster for the same reason |
| Coromon | TRAGsoft, 2022 | Selectable difficulty settings; skills draw from a shared skill-point pool | Players in this genre expect difficulty options; a shared pool also removes the dead-move state that was on screen in at least three of the five hard freezes |
| Temtem | Crema, early access 2020, full release 2022 | Techniques cost stamina with an overexertion penalty; doubles is the standard format; online persistent world | Stamina systems work at scale; a live-service layer is a large ongoing cost, so WILDSHIFT stays single-player with no trading or PvP |
| Monster Sanctuary | moi rai games, full release 2020 | Creature abilities double as traversal in a metroidvania map; creatures have Light and Dark Shift variants | Creature abilities can open the map and give the bench a job outside battle; also a naming flag: "Shift" already means something in this genre and the trademark search must account for it |
| Nexomon: Extinction | VEWO Interactive, 2020 | Stays close to the classic formula; leans on humor and story | A game that looks like the formula gets judged against the formula; the Forecast's visible Shift odds must appear in the first ten minutes and in the first screenshot |

What none of these tell us: whether players want randomness this deep in a main campaign. The run says yes for one player; the slice has to show it for many.

---

## 8. Top risks and mitigations

| # | Risk | Run evidence | Mitigation |
| --- | --- | --- | --- |
| 1 | Chaos feels unfair | About ten Wonder Guard walls; a Route 120 trainer wiped the team twice | Forecast, Read and Ward tells are in the slice and tested first; Crackdust stocked before every mandatory Ward trainer; a chip-damage disc guaranteed by badge 1; track "felt unfair" reports per tester-hour |
| 2 | Too many Forecasts | About 15 Chaos evolutions in 45 h; 4 to 7 windows per creature would mean 24 to 42+ Forecasts a run | About 3 windows per creature; deferred Shifts resolved at Waystones; per-creature presets; slice metric of at most about 1 Forecast per 30 minutes |
| 3 | Balance blows up | Random forms, abilities and discs multiply each other | Headless simulator plays thousands of seeds a night; seed validator rejects any seed where a required boss has a Ward with no reachable answer or a disc has no learner |
| 4 | Evasion and recovery stalls | Wallace's Latias (Double Team, Recover, Protect) ended three League runs; Haze did not fix it | Evasion caps at +2; 3 Mends per creature per battle; Plumbline disc from the 7th Spire always hits, clears stat stages and blocks re-boosting for 2 turns; a plain stat-clear does not count as an answer |
| 5 | Soft-locks and save loss | Five hard freezes and silent save failures | Menu state graph, coverage-guided fuzzing from saved checkpoints, coverage per build; save integrity has an owner from month one: checksums, three rotating backups, verified autosave |
| 6 | Grind walls | Seadra's Victory Road grind: about 50 rounds in two blocks, about five hours of edited video | Bench EXP from the start; over-curve damping only on Rematch-board EXP and only from curve+10; a level target per island that the simulator checks |
| 7 | Art scope | About 113 artist-weeks of creature art against about 92 available in production | Throughput plan and its fixes; roster count locked at month 4 with an ordered cut list; Shifts reuse the roster |
| 8 | IP and patent exposure | | Counsel review in pre-production and again before beta; type-chart diff; capture-flow patent review before animation; no Pokemon references in marketing |
| 9 | Authorship and AI disclosure | A studio head and counsel will ask who owns AI-drafted material | Human creative authority; team-authored or substantially revised assets; authorship records; planned Steam disclosure |
| 10 | Console port slips | | Porting quote and developer-program application in pre-production; PC ships first; the port is its own milestone with lotcheck time budgeted |
| 11 | Crowded genre | Several original creature collectors already exist | Every trailer leads with the Forecast screen and a real Shift; seeds and challenge runs give streamers a reason to come back |
| 12 | Small-team burnout | | Fixed scope per gate; no planned crunch; contingency spent on time before features |

---

## 9. Community and content plan

- **Seeds.** Every run has a short share code (about 10 characters, estimate) that encodes the seed, the Chaos dial and rule toggles. Paste a code and you get the same world; two players who make the same choices see the same Forecasts.
- **Seed Card.** The end-of-run unit people share: seed code, play time, Summit attempts, Ward walls met and each Heartmark creature's Shiftlog. A dial change mid-run marks the card "not race-eligible".
- **Social play.** Seed races and the Seed Card. No trading or PvP. Async seed duels are an Expand idea, not a promise.
- **Seed of the Week (post-launch).** One official seed each week, with opt-in Steam leaderboards for in-game time, faints and Shifts accepted. Community seeds stay out of the first release.
- **Challenge modes.** The gameplay section owns the list: No Rewind, One Life, No Carry, Restless, Blind Read and Accidental Hero. Production proposes three more for the systems designer to accept or cut (Proposed): **Ride the Dice** (Anchor is disabled); **One Heart** (only the starter may battle, and its Heartmark carries it through every form; a tribute to MUDDY's seven forms); **Empty Wallet** (no shops; the seed validator must still find a Ward answer without Crackdust).
- **Field Log completion.** Seen, Read and Held states give completionists a long-tail goal.
- **Streaming tools.** Streamer mode enlarges the Forecast panel so it reads on a 720p stream, adds an on-screen run timer, and hides seed codes until the run ends. The Seed Card exports as an image. Chat-voted rerolls are an Expand idea, not a promise.
- **Why plan for long runs.** The Chaos run became 45 video parts of about an hour each from one playthrough; long randomized and challenge runs already draw an audience [NEED SOURCE: audience data]. HUD, logs and seeds are designed for that audience from day one.
- **Dev log and demo.** Monthly posts from pre-production on; the Forecast math is published for players to break. The slice becomes a public demo after Gate 2, then the Steam Next Fest demo. Public posts use PUDDLE, never MUDDY.
- **Community testers.** A seed-testing group joins at the slice; every bug report carries a seed code.
- **Mods.** Rules and encounter tables live in data files; the schema is published after launch so players can share custom rule sets.

---

## 10. Appendix: notes for the Emerald Chaos V2 authors (V3 ideas from one run)

Observations from one AI-played run; nothing is a confirmed bug ("freeze" = screen stopped, soft reset did nothing, only an emulator reset recovered). Main asks: a 0-PP freeze check, TM data that matches the randomized moves, a lower Wonder Guard rate, and prompts before Chaos evolutions and Master Ball throws. Three items (save menu slot, bag cursor, evolution cancel window) hit the run partly because inputs were scripted and blind.

### 10.1 Concrete mechanics worth keeping (the suggestions)

| Topic | Observation | Suggested mechanic |
| --- | --- | --- |
| 0-PP freezes | 5 hard freezes: 3 right as a 0-PP move was selected (Fly vs wild Relicanth in Granite Cave; Body Slam vs a Beldum trainer on Route 117; Surf vs wild Nosepass on Route 121); 1 choosing Body Slam vs a Cacnea trainer on Route 118 (PP not logged); 1 vs a Golem trainer on Route 118 after repeated RUN refusals then a move. Twice a 0-PP pick did not freeze (a double battle on Routes 127-131; the Elite Four, which showed "There's no PP left"). | Test 0-PP selection in singles and doubles, vs trainers and wild, including right after the "no running" message; check any randomizer hook on the move-select path; confirm Struggle fires when all four moves are empty. |
| ACHIEVE menu | Opening and closing ACHIEVE left the overworld black until a map change; in the Fortree gym the party screen restored it. Guess: returns to the field without reloading map tiles and palettes. | Exit through the same return path the party and bag menus use; test in fog, rain and dark maps. |
| Silent saves | Saves after Dewford and after the Rustboro badge never happened: getting the PokeNav added a start-menu entry and SAVE moved down a slot. | Keep SAVE in a fixed spot (top or bottom) whatever unlocks; show a clear saved-time line after saving. |
| TM compatibility | TM moves randomized, learner lists vanilla. TM30 became Lick (no learners); TM40 became Leaf Blade and answered Ghost types (Brawly's Dusclops, Juan's Banette, Drake's Dusclops). | When a TM's move changes, rebuild its learner list: species that share the move's type can learn it, plus a random share of the rest, with a floor so no TM has zero learners. |
| Shop TM labels | TM38 bought at Lilycove for 5,500 expecting Fire Blast was Constrict. TM39 (Roxanne's reward) rolled Zap Cannon. | Show the randomized move's name in the shop list and description; price TMs by the new move's power. |
| Evolution cancel | ~15 Chaos evolutions; B pressed too late for Flygon into Wailmer, Heracross into Armaldo then Seviper, Lv34 Rayquaza into Trapinch. Chaos evolutions can go down, so stakes exceed vanilla. | Cheapest first: a Yes/No prompt before the animation ("MUDDY is evolving. Allow?"; showing the target species optional); an option toggle Ask / Always / Never; an Everstone for sale at an early mart. Keep the random evolutions themselves. |
| Levels after evolution | Moves and EXP carried, but EXP re-read on the new species' growth curve: Lv19 Ludicolo to Lv16 Rhydon; Lv30 Altaria to Lv27 Gardevoir. | If unintended: when an evolution crosses growth rates, set EXP to the floor of the current level on the new curve so the level holds. |
| Wonder Guard frequency | About ten walls, nearly all trainer creatures: a Rustboro gym trainer's Metagross; Route 117 twins' Groudon (lost twice); Maxie's Masquerain (lost once); a Route 120 Metagross trainer (wiped twice, routed around); Tate & Liza's Salamence; an Abra on Routes 127-131 (only Bite worked); two Beautifly in Juan's gym; Glacia's Beautifly (drained every Revive in run 6); Drake's Torchic, likely. | Lower Wonder Guard's weight for trainer creatures; keep it off trainers before badge 4 or until coverage is plausible; cap at one creature per trainer; optional entry text ("Metagross is shielded by Wonder Guard!"). |
| Evasion and recovery stalls | Juan's Banette Lv46 (Double Team, Rest, Ice Beam) took three tries; Wallace's Latias Lv56 (Double Team, Recover, Protect) ended runs 4, 5, 6 and re-boosted right after Haze; Drake's Lv53 Dusclops with Full Restores ended runs 1-3, his Lv55 Shiftry ended run 7. | When randomizing leader movesets, a creature rolls an evasion move or a recovery move, never both. |
| Money | Six Revives after Drake beat run 2 dropped funds to about 0 before run 3; blackouts cost money and seven League runs ended in a loss. | Raise trainer payouts after badge 6; sell Revives cheaper at the League shop or place a few in Victory Road; smaller blackout penalty on the Chaos setting. |
| PP restores | Ethers and Elixirs scarce; Body Slam and Low Kick empty vs Drake in run 2 (nurse heal may have been declined by a B press); Leaf Blade empty in run 3. | Stock Ethers in a late mart (Lilycove or the League shop); place more Elixirs in late dungeons. |
| Bench experience | A Lv2 Route 101 Machoke carried and finished Lv73; MUDDY finished Lv27, 46 levels behind, vs a Champion team of Lv55-58. | Hand out the EXP Share earlier, or add a party-wide EXP option. |
| Legendary catching | Jirachi and a Lv15 Rayquaza KO'd by accident; a Rayquaza took four failed Ultra Balls before a Great Ball; Deoxys about six Ultra Balls; two Regice encounters ended with no catch. | Raise the catch rate of legendaries met as random wild encounters; guarantee a False Swipe source (e.g. a move tutor). |
| Master Ball | The bag remembers the last cursor slot; a scripted down press from Ultra Ball threw the Master Ball at a wild Lv26 Kyogre. | A Yes/No confirm before throwing a Master Ball (one text box). |

### 10.2 Chaos V3 matrix rows (18)

| Verdict | Item | Suggested V3 change |
| --- | --- | --- |
| keep | Random evolutions up and down | Keep as is, and add a prompt before each one |
| keep | Rival's random starter | Keep; beatable with some grinding |
| keep | Wild legendaries in normal encounters | Keep, with the catch-rate change |
| keep | Achievement banners | Keep the banners and fix the menu exit |
| change | 0-PP move selection | Always show the no-PP message, fire Struggle when all moves are empty, regression-test after a trainer-battle RUN refusal |
| change | ACHIEVE menu exit | Exit through the same field-return path as the party and bag menus |
| change | SAVE position and feedback | Keep SAVE in a fixed slot and show a clear saved-time line |
| change | TM compatibility | Rebuild each TM's learner list from its new move, with a floor of learners |
| change | Shop TM labels and prices | Show the randomized move name in the shop and price TMs by the new move's power |
| change | Evolution cancel | A Yes/No prompt before the animation, or an Ask/Always/Never option, or an early Everstone |
| change | Level after a Chaos evolution | If unintended, set EXP to the current level's floor on the new curve so the level holds |
| change | Wonder Guard frequency | Lower its weight, keep it off trainers before badge 4, one per trainer, optional entry message |
| change | Evasion and recovery on leaders | A leader creature rolls an evasion move or a recovery move, never both |
| change | Money curve | Higher payouts after badge 6, cheaper League Revives, smaller blackout penalty on Chaos |
| change | PP restore supply | Stock Ethers in a late mart and place more Elixirs in late dungeons |
| change | Wild legendary catch rate | Raise their catch rate and guarantee a False Swipe source |
| add | Master Ball confirm | A Yes/No prompt before throwing the Master Ball |
| change | Earlier EXP Share | Earlier EXP Share or a party-wide EXP option |

### 10.3 "Please keep these" (verbatim list)

- **Random evolutions, up and down.** MUDDY went from Mudkip to Swampert at Lv16 (skipping Marshtomp), then Machop at Lv20, Wynaut in the Fortree gym, Ludicolo at Lv27, Altaria at Lv30 on Mt Pyre, and Gardevoir in the Magma Hideout. Seven forms. Wailmer became Seadra at Lv40, and that Seadra carried the winning run. It beat Champion Wallace's Latias with Bite three times and survived on 11 HP.
- **The rival's random starter.** The "Identity Crisis" banner had already fired in Oldale. Then May's Lv5 Groudon beat us. We ground MUDDY to Lv11-12 and won the rematch. It set the tone at the very start of the run.
- **Wild legendaries in normal encounters.** Keep them. Just make the catch fair.
- **Randomized abilities.** Wonder Guard needs tuning. The rest made fights surprising in a good way.
- **Achievement banners.** "Identity Crisis" fit a run built on creatures changing identity. Keep the banners and fix the menu exit.
- **Randomized items.** A Potion turning into a Soda Pop is harmless flavor.
- **The ice puzzle change.** The third Sootopolis ice layout differed from the guide we used. If that is on purpose, it worked. We solved it by search.
- **The difficulty.** Eight League runs, seven losses, and the winning run cleared the Elite Four with no faints. Hard and winnable is right for this hack.

### 10.4 Vanilla behaviour that tripped the run (no change asked of the hack)

Mr. Briney re-talk sailing back; doubles cursor memory (action cursor per creature, target defaults to the right foe); constant PokeNav rematch calls (a lower call rate option would be welcome, optional); map readability (Mauville bushy trees that look like grass, Lavaridge fog, post-Kyogre rain, dark caves, Victory Road collision); puzzles (Fortree rotating gates, Mossdeep switch puzzle resetting on exit, Seafloor boulders); Emerald's own backtracking story order; no shop between Elite Four fights.

---

## 11. What is proven and what is proposed

Run facts on this page are checked against the run log. Everything about WILDSHIFT itself is a proposal. Numbers marked estimate are starting values; [NEED SOURCE] marks numbers nobody has measured yet.

**How the draft was made**

- Five design agents drafted gameplay, story and cast, art direction, creatures, and production from the brief. Three pixel artists drew the sprites, rendered them at 8x and redrew each one at least three times.
- An internal critic found 61 problems: 23 inconsistencies between sections, 12 weak mechanics, 9 grounding errors, 9 IP risks and 8 gaps. Two of the grounding errors were in the brief itself.
- One canon was written: a glossary, a single rule set and the corrected run facts. Each section was then revised to that canon and checked again by a separate agent against the run log.

**What the studio should test first**

- **Do players want the dice?** Measure the Accept rate on Drift, where anchors are free, plus a one-tap "glad I rolled?" prompt.
- **Shift volume.** At most about one Forecast per 30 minutes, or the moment loses weight.
- **Freefall odds.** They should match Chaos V2 and are still [NEED SOURCE]. They can be measured from the logged evolutions.
- **Capture and odds UI.** Patent and trademark clearance before any animation is made, including the names WILDSHIFT and Vagary.
