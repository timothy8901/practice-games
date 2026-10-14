# Playtest report: explorer (Mo)

## Who I am

I'm Mo. I play for the map: every dashed room has to turn solid, every glint behind a wall gets a mental pin, and a game wins me over when an ability I just earned opens a spot I noticed hours earlier.
I'm fine with combat, but I'm not a fighter. I want to lose to bosses fairly, and I don't want to lose ten minutes of walking because I died hunting a secret.

## What I played

All three clips use Tessik. Total live play is 6:00 (183 s + 98 s + 80 s) over 271 turns. That's more turns than the budget, because most of the extra turns went into retrying the Echo Jump onto the Crossrack ledge.

| Clip | File | Live length | What happened |
|---|---|---|---|
| 1 | `explorer-01-driftcache-first-sweep.mp4` | 3:03 | New game. I rested at the Wake Cell node, opened the map right away and fully looted Wake Cell, The Long Drop and Crossrack Hall. At 0:30 I spotted a glowing core in a high alcove of The Long Drop. I died once at 1 HP to a Scuttlebit in Crossrack at 0:57. I found the Rackside Shrine node and the vendor (Scrivvet) at 1:51, but with 29 bits I couldn't buy anything. I lost to Tallock twice, with him at 15/120 (2:22) and 16/120 (2:58). Both times the phase-2 Slab Swing killed me. |
| 2 | `explorer-02-tallock-echo-jump-backtrack.mp4` | 1:38 | I continued from the save and beat Tallock without taking a hit by standing on the left floating platform (0:22). I got Echo Jump, then went back to Crossrack. It took about 5 tries to Echo Jump onto the turret ledge (0:57). The upper exit leads into The Loft, which is a spike strip, two crumble pairs, a Droplatch and a Spitvalve. I died one tile from the core (1:18). After respawning at the shrine I needed 8+ more tries to get back onto the Crossrack ledge, and gave up (1:37). |
| 3 | `explorer-03-zone-tour-and-cores.mp4` | 1:20 | This clip uses debug warps and grants (all listed below). I took the Loft core after a teleport, then visited Loomworks, Brinevault, Nullspire and Rootwell (rest rooms and lore cards) and checked the Rootwell vendor. With Grip Protocol I honestly wall-jumped up The Long Drop shaft into the alcove from clip 1 and took that core (0:53). I checked that the Loft chute can't strand you (1:01). I couldn't find the honest route to the Belt Floor core, so I teleported to confirm it (1:16). I ended with all three cores and 8 max hearts. |

### Debug calls (all in `explorer-03/session.json`)

| Video | Call | Why |
|---|---|---|
| 0:01 | `warp("dc_loft","R")` | Skip the Crossrack ledge I'd failed 8+ times in clip 2. The "R" entry actually dropped me into the bottom chute and I fell back into Crossrack. This is a tool quirk, not gameplay. |
| 0:02 | `warp("dc_loft","B")` | Same goal, through the chute. |
| 0:06 | `teleport(800,390)` | After a 4th spike hit, put myself next to the Loft core to confirm the pickup works. |
| 0:09 | `grant("burstLine")` | A player would have it after Weftyr. |
| 0:09 | `warp("lw_belts","L")` | Sample Loomworks. |
| 0:17 | `warp("bv_rest","L")` | Sample Brinevault. |
| 0:25 | `grant("gripProtocol")` | A player would have it after Corrosant. |
| 0:25 | `warp("ns_rest","L")` | Sample Nullspire. |
| 0:28 | `warp("rw_rest","L")` | Sample Rootwell and its vendor. |
| 0:35 | `warp("dc_fall","L")` | Backtrack to The Long Drop with all abilities. After this, the climb to the core was honest. |
| 0:58 | `warp("dc_loft","B")` | Get back into the Loft for the getting-stuck test. |
| 1:01 | `warp("lw_belts","R")` | Look for the Belt Floor core. |
| 1:16 | `teleport(2770,210)` | Confirm the Belt Floor core after about 5 failed honest attempts. |

## Bugs

1. **Minor: on the map, the "you" marker covers the vendor icon in the room you're in.**
   - Steps: Stand anywhere in Rackside Shrine and press M.
   - Expected: The shrine shows the node diamond and the vendor hex, since the legend lists "vendor".
   - Actual: Only the node diamond is visible. The player dot sits exactly where the vendor hex is drawn. Seen from another room (clip 2, 0:32), the hex shows up. In clip 1 I first thought I'd found a vendor the map didn't know about.
   - Video: `explorer-01-driftcache-first-sweep.mp4` 1:57 (compare `explorer-02-tallock-echo-jump-backtrack.mp4` 0:32).

2. **Minor: the map shows orange dots the legend doesn't explain, and the one in The Long Drop is in the wrong place.**
   - Steps: Collect the Loft core and The Long Drop core (the alcove at the top right of the shaft), then open the map in Driftcache.
   - Expected: Any marker for a collected core is in the legend and sits where the core was.
   - Actual: Small orange dots appear in The Loft and The Long Drop, and the legend doesn't mention them. The Loft dot matches the core's position. The Long Drop dot is drawn at the bottom right of the room, but the core alcove is at the top right; the "you" dot, standing in that alcove, is correctly drawn at the top. Deep Ping's description says it reveals cores, so cores do seem to be a map category. It's missing from the legend, though.
   - Video: `explorer-03-zone-tour-and-cores.mp4` 0:56.

3. **Minor: the CORE FOUND banner shows through the map.**
   - Steps: Pick up a core and press M while the banner is still up.
   - Expected: The map panel covers the banner, or the banner hides while the map is open.
   - Actual: "CORE FOUND / Max hearts +1 / A piece of the kingdom..." stays readable in the middle of the map, behind the room grid. It makes the map around The Long Drop hard to read.
   - Video: `explorer-03-zone-tour-and-cores.mp4` 0:56.

4. **Minor (writing or economy): Scrivvet says deeper means cheaper, but prices are the same in Rootwell.**
   - Steps: Talk to Scrivvet in Rackside Shrine ("The deeper you go, the cheaper I get."), then talk to Scrivvet in the Rootwell rest room.
   - Expected: Lower prices in Rootwell, or a line that doesn't promise a discount.
   - Actual: Both shops charge Spare Cell 90, Hot Clock 160 and Deep Ping 120.
   - Video: `explorer-01-driftcache-first-sweep.mp4` 1:51 and `explorer-03-zone-tour-and-cores.mp4` 0:34.

5. **Minor (balance): Tallock can be beaten from the left floating platform without taking damage.**
   - Steps: When the fight starts, dash under the first Stack Slam, jump onto the left floating platform and face right. Spam light attacks, and jump in place when Slab Swing is telegraphed.
   - Expected: Some attack threatens the platform, because it's the only safe spot in the arena.
   - Actual: Stomp Quake never reaches the platform, and Tallock stands next to it within light-attack range. I went from 120 to 0 at full health in about 12 seconds of live play, phase 2 included. My two honest floor fights in clip 1 ended in deaths at 15 and 16 HP, so the platform makes a very big difference.
   - Video: `explorer-02-tallock-echo-jump-backtrack.mp4` 0:10 to 0:22.

6. **Minor (readability): the Loomworks lore card is hard to read.**
   - Steps: Enter Loomworks for the first time.
   - Expected: The lore text reads as easily as on the other cards.
   - Actual: Tan text over a busy rust background of spools and pipes. I had to squint. The Brinevault, Nullspire and Rootwell cards were fine.
   - Video: `explorer-03-zone-tour-and-cores.mp4` 0:11.

I saw no console errors in any of the three clips.

## Confusing or frustrating moments

- **The Crossrack turret ledge after Echo Jump** (clip 2, 0:43 to 1:37). The ledge is the only way into The Loft. Echo Jump clears it by a hair. The gap to its right is two tiles wide, and jumping near its corner bonks Tessik's head. From the left, the Spitvalve's shots knock you out of the air. It took me about 5 tries the first time. Then I died in The Loft, respawned at the shrine and needed 8+ tries to get back up, at which point I quit. A one-tile-lower ledge, or a handhold block, would fix this.
- **The Loft is a lot for a core room.** One screen has a spike strip, two crumble pairs, a Droplatch on the ceiling and a Spitvalve on the far ledge. I took 3 spike hits, a Droplatch hit and then died one tile from the core. The nearest node is two rooms back, and the route between them is the ledge above. Death keeps your bits (thank you), but it costs a lot of walking.
- **Ability gates aren't signposted.** In clip 1 I saw the Crossrack thin platforms and turret ledge about 180 px up (2:27) and had no idea what would get me there. A hint in the map's room line ("something above is out of reach") would help.
- **The Belt Floor core.** The glow is visible from the floor, which I liked. I still couldn't work out the route after about 5 tries: Echo Jump plus Grip on the ledge face, then an air Burst Line from the slab. I'm guessing the 2-tall slot under the ceiling is the Burst Line crawlspace, but nothing tells you so.
- **Loomworks backgrounds.** Pipes and spools in the background are the same rust colour as real platforms, so I couldn't tell what was solid (clip 3, 0:15).
- **Phase-2 Slab Swing.** It killed me twice from what looked like a safe distance (clip 1, 2:22 and 2:58). The tell is fine, but its reach is longer than the slab looks.
- **Bits pace against prices.** Fully looting the first four rooms gave me 29 bits. Deep Ping, the item an explorer wants most, costs 120, and I only got there after the 60-bit boss reward plus the Loft. That's fair, but it means Deep Ping comes too late to help with Driftcache, the zone where I'd have used it.

## What I loved

- **The Long Drop backtrack** (clip 3, 0:53). I saw the glowing alcove in the first 30 seconds of the game, couldn't reach it, marked it, and came back with Grip Protocol to wall-jump up the same shaft. That's exactly the moment I play these games for.
- **The map.** It opens instantly. Discovered but unvisited rooms are dashed outlines, rooms you've visited fill in, and a room cursor shows the room name plus a bestiary line ("Droplatch · Spitvalve"). The legend lists the abilities you own. The boss room gets a skull and "purged" after the kill.
- **Save node spacing in Driftcache.** Wake Cell and then Rackside Shrine directly before the boss arena felt right. Losing to Tallock cost me about 20 seconds of walking.
- **Zone identity.** Each zone has its own palette and silhouette language: blue server-rack ruins, rust looms and spools, green coolant vaults with reeds, violet void spires, and crimson root tendrils. Each lore card has a strong one-paragraph hook. "Climb it and you will be the first thing to arrive." is great.
- **Core feedback.** Core hearts are drawn as gold diamonds next to the red hearts, so I can count my secrets on the HUD. The "CORE FOUND / A piece of the kingdom that never rotted." banner is a nice touch.
- **Crumbles can't strand you in The Loft.** Dropping into the chute puts you back on the Crossrack top platform (clip 3, 1:01). I looked for soft-locks in Long Drop, The Loft and Crossrack and found none.

## Feature requests

1. **Map pins** (effort: S to M)
   - Pitch: On the map, the room cursor can drop one of four simple glyphs on a room: "can't reach yet", "item seen", "danger" and "come back". Pins are saved with the game and show in the room's info line.
   - Why I want it: I spent clip 1 keeping a list in my head of the alcove, the ledge and the glint. Letting players write those notes into the game is the cheapest way to make backtracking feel planned instead of remembered.

2. **Room sweep marks** (effort: S)
   - Pitch: Each visited room on the map gets a small tick once every placed bit and core in it is collected. The map header shows a zone percentage, like "Driftcache 82%".
   - Why I want it: Completionists need to know when to stop looking. Right now I can't tell whether Crossrack has one more bit hidden somewhere.

3. **Out-of-reach echoes** (effort: M)
   - Pitch: When the player stands under a ledge, gap or shaft that needs an ability they don't have, the map room line says "a signal above, too faint to follow". After the right ability is earned, the line changes to "the signal answers now".
   - Why I want it: It signposts ability gates without spelling out the solution. It also turns ability pickups into a moment where you remember what just opened up across the map.

4. **Node relay between rest nodes** (effort: M)
   - Pitch: Resting at a node gives the option to relay to any other node you've already rested at, with a short "packet in transit" transition. Maybe it's disabled during boss fights or unlocked after Tallock.
   - Why I want it: Backtracking is the best part of this game, and the walk to reach it is the worst. Sampling the late zones in clip 3 showed me how far apart everything is.

5. **Scrivvet's depth discount** (effort: S)
   - Pitch: Make his line true. Rootwell prices drop by about 25%, and any item bought in Driftcache refunds the difference as a "loyalty" bit drop when you meet him again deep down.
   - Why I want it: It fixes the inconsistency in bug 4. It also rewards players who save their bits and push deeper, and gives the second vendor a reason to exist.

## Ratings

| | Score |
|---|---|
| Fun | 7 / 10 |
| Controls | 6 / 10. Echo Jump onto narrow ledges and the wall-jump rhythm took real work. |
| Clarity | 6 / 10. The map is strong, but the legend gaps, the banner showing through and the Loomworks readability pull it down. |
| Difficulty fairness | 6 / 10. Tallock on the floor is fair, Tallock on the platform is trivial, and The Loft is harsh for a core room. |

## Verdict

UNDERBYTE gets the foundations of an exploration game right. The map tells you honestly what you've seen, the five zones each have a clear identity, and the moment where I wall-jumped up to the alcove I'd seen in the first half-minute felt like a real explorer's payoff. The parts that let it down are around the edges, not the core. Map icons are hidden or unexplained. One ability ledge is so tight that redoing it after a death made me quit a clip. One core room stacks every hazard type next to a far-away node, and one shopkeeper makes a promise the game doesn't keep. Add pins and sweep marks to the map, loosen the Crossrack ledge, and give ability gates a whisper of a hint, and I'd happily 100% this.
