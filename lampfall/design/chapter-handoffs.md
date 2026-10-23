# Chapter handoffs (notes one content chapter leaves for another)

## From GDD-08 letters and threads -> GDD-07 story
- Four thread beats `call` story scripts for their set-pieces: `bell-dig`, `ansel-confession`, `ansel-weir-wheel`, `tamsin-sails`. Those story scripts must NOT advance thread beats themselves and must NOT also fire from their own triggers. The beat scripts set sp.bell-dug, sp.ansel-confessed, sp.weir-turned, sp.tamsin-sailed.
- `the-relighting` gives `isoldes-lantern` and calls deliverEvent('lantern'); the post-credits scene calls deliverEvent('saw-the-light').
- Canon facts the letters fixed: keepers on this coast write their log as letters to the next keeper; Mabry Coil (absent, letter author) held them in the post office; Augusta was Warden thirty years ago (F6: her board said three in ten for the gale, Isolde said eight); the Siltback did know her (K8 says it didn't; K9 the winged creature on the rail with the mark in the same place; K13 it flies forty miles to find her); the mystery resolves by K12 (day 13).
- Invented display names (no ids): Hal Gannet (bosun), Agnes Pell (Juniper's grandmother), Old Fen, Ned of the Emberstep ropewalk, Josiah Stalk (Ansel's grandfather), Wynne of Windle (Thessaly's great-aunt), Davey Penhallow; the lost fleet: Gannet, Brown Bess, Kittiwake, Three Sisters, Thole's Luck, Plenty, Ivy Rask, Merrow Maid, Long Odds, Good Morning, Grace (ferry); the Bracks' oyster boat: Tidy Sum; the bean: Lowmoor Sweets.

## From GDD-08 -> GDD-06 cast
- Oyster Boat beat 3 needs Tamsin scheduled at the Drownwood drowning street on low-tide days while that thread is at beat 2.
- Maud at her berth is needed for Ember Grub beats 3 and 5.
- Each resident needs npc.porch {id (PORCH_IDS), mapId, x, y, facing, litAtStart?, days?, hours?} (SYS-TOWN), §14.5 schedule/topics/lines, festival spots; THREAD_BY_NPC in js/data/threads/index.js gives each NpcDef its threadId.

## Manifest requests / engine notes
- Keepsake id `odile-porch-canvas` (Odile's painting of your porch, Twelve Lights beat 2) exists only in dialogue; add an item row if it should be held.
- No cond can check for a fish in the satchel (Tully's grey mullet is asked for, never checked); no {town} text token (letters avoid the town name); `take` with ask:true does not ask, so one-of-a-kind hand-overs use an explicit two-option choice.
- Content fix: threads/mudlark-mile beat 2 advance.days should be 2.

## From GDD-01 world -> threads, cast, story, overworld
- Markers: Pellwick has 153 named markers (every resident post, porch step and door, every first-30-minutes staging point); every manifest trainer now has a trainer-<id> post marker. Story and cast place people BY MARKER NAME (see design/GDD-01-world.md).
- 10 thread beats have a `where` cell on a tree, roof, river or the spring-only Old Quay (oyster-boat 2/4, empty-creek 1-5, twelve-lights 5, water-pack 4, the-bell 3). GDD-01 §17.3 lists the markers to snap them to.
- Story step triggers are NOT on the maps yet: GDD-07 lays them over Pellwick's 41 named regions.
- Overworld runtime must open tide tiles by clockSys.gateTide(world, tile.way) (tideWindow 150/120/90/60, lowerLow for the Bar road, openFlag lit.bar, spring for the Old Quay); today tilemap opens every tide:'low' tile at tide < 0.2.
- Town wilds are rows [2,3] at night to stay within Lv2-5 after the +2 night bonus (decide whether town maps should be exempt from the bonus instead).
- SYS-TOWN must set sys.commons.<projectId> when a project is funded and sys.lantern-market on market nights (props are conditional on them); RENDER draws porch lamps from porch entities, autotiles roofs, and draws roof-keeper in the player's roof colour.
