# UNDERBYTE playtest report (merged)

Seven playtesters, each playing like a different kind of player, recorded 22 clips. Every bug they reported was merged with its duplicates and re-checked against the current code (js at commit `b0e3806`, which includes the round-3 fixes) using short headless Playwright scripts and the `UB.debug` API.

## Overview

| | |
|---|---|
| Testers | 7: Rin (newcomer), Dex (button-masher, keyboard + pad), Vee (speedrunner), Mo (explorer), Jules (fighting-game player), Kai (boss challenger), Ana (pad + accessibility) |
| Recorded live play | **34 min 04 s** in 22 clips (the thinking time between turns is cut, so the clips play at game speed, without sound) |
| Furthest point reached | All four bosses were fought. Tallock was beaten by honest play (Brackmaw, Korvask, Ana's Tessik, Dex on the pad). Weftyr, Corrosant and Kernauth were only fought from debug-assisted loadouts. |
| Console errors | None in any clip and none in the triage runs |
| Soft-locks | None found |
| Average ratings (1–10) | Fun **6.4** · Controls **6.0** · Clarity **5.1** · Fairness **4.9** |

| Tester | Fun | Controls | Clarity | Fairness |
|---|---|---|---|---|
| Rin, newcomer | 6 | 6 | 6 | 4 |
| Dex, masher | 7 | 5 | 6 | 5 |
| Vee, speedrunner | 7 | 7 | 5 | 5 |
| Mo, explorer | 7 | 6 | 6 | 6 |
| Jules, fighter | 7 | 6 | 5 | 6 |
| Kai, challenger | 5 | 6 | 4 | 3 |
| Ana, accessibility | 6 | 6 | 4 | 5 |

**Bug triage at a glance:** 45 merged bugs.

| Status | Count |
|---|---|
| Confirmed | 28 (11 major, 17 minor) |
| Already fixed | 2 |
| Not reproduced | 5 |
| By design | 10 |

**Biggest themes:**

1. **Bosses are not fair yet.** These are mostly readability and body-contact problems, not difficult patterns:
   - Tallock's slam marker, wall pinning, pogo-lock and shelf cheese.
   - Weftyr's Snare catches a fighter who jumps it.
   - Corrosant stays off-camera.
   - Rootwell's hazards are red on red.
2. **The game teaches too little.** There is no controls page, Down+Jump is never shown (and the critical path needs it), refused inputs are silent, and prompts name keyboard keys while you play on a pad.
3. **Overlays and banners leak through each other** and sit over the play area.
4. **Comfort options are thin.** Full-screen flashes can't be turned off, and the hero blinks fully invisible after a hit.

## Recordings

All clips are in `recordings/`.

| File | Tester | Length | What it shows |
|---|---|---|---|
| `newcomer-01-first-steps-and-tallock.mp4` | Rin | 2:08 | Title, Settings and select (Tessik), first rooms, a spike reset to the top of The Long Drop, Rackside Shrine, finding Overclock, and a death to Tallock at 68/120 |
| `newcomer-02-tallock-attempts.mp4` | Rin | 2:21 | Continue, then four more Tallock attempts (best 45/120). Shows the title-cursor jump and the RESTORED banner following into the next room. |
| `masher-01-title-mash-and-spike-deaths.mp4` | Dex | 1:47 | Menu mashing, pauses mid-jump/transition/death, repeated spike deaths, 2 game overs, quit to title |
| `masher-02-gamepad-boss-mash.mp4` | Dex | 1:38 | Pad only: overwrite dialog, dash attempts, pause and map during Tallock's intro, a loss and a win, Overclock draining during the pickup. The game was silent on the pad (since fixed). |
| `masher-03-dash-lore-quit-tests.mp4` | Dex | 0:40 | Dash key tests, the pause ability line over the LOOMWORKS toast, the lore card closed by Pause, two heroes in the room slide |
| `speedrunner-01-vellix-driftcache-tallock-attempts.mp4` | Vee | 2:07 | Blind Vellix run, a crumble-into-spikes death, the shop under the RESTORED banner, a Blink Strike that ends inside Tallock |
| `speedrunner-02-gate-breaks-burstline-skip.mp4` | Vee | 1:07 | Debug-assisted gate tests: the Echo Jump gate holds, both Burst Line gaps are crossed with Jump + Echo Jump, and the bv_sluice arrival box |
| `speedrunner-03-driftcache-timed-route.mp4` | Vee | 1:11 | Timed Driftcache route (about 62.9 s in-game to Tallock's door), a damage boost and a missed pogo |
| `explorer-01-driftcache-first-sweep.mp4` | Mo | 3:03 | Full Driftcache sweep, spotting the Long Drop core alcove, the vendor, two Tallock losses at 15–16 HP |
| `explorer-02-tallock-echo-jump-backtrack.mp4` | Mo | 1:38 | Beats Tallock from the left shelf without taking a hit, then the Echo Jump backtrack to the Crossrack ledge and The Loft |
| `explorer-03-zone-tour-and-cores.mp4` | Mo | 1:20 | Debug-assisted tour of all five zones, the Grip Protocol climb to the Long Drop core, all three cores |
| `fighter-01-tessik-driftcache-and-tallock.mp4` | Jules | 1:38 | Tessik lab where light-chain hits 2–3 whiff on crawlers, Driftcache, a loss to Tallock at 65/120 |
| `fighter-02-brackmaw-vellix-tallock-ultimates.mp4` | Jules | 2:15 | Brackmaw pogo-locks Tallock, the ultimates, the Vellix lab, Blink Strike contact damage, the WEIGHT bar |
| `fighter-03-orrubel-korvask-tallock-ultimates.mp4` | Jules | 2:14 | Orrubel cornered, Korvask wins with Bulwark Catch, Clamp Press and Sentry Triad, Tessik's pose over the header |
| `fighter-04-tessik-cancels-sightline-tallock.mp4` | Jules | 0:32 | Tessik cancels, Sightline, a down-strike that stops the jump |
| `challenger-01-tallock-three-losses.mp4` | Kai | 1:41 | Three Tallock losses (best 59/120): the Stack Slam marker and being pinned at the walls |
| `challenger-02-weftyr-attempts.mp4` | Kai | 1:13 | Weftyr: the Snare catches him on landing, contact after the Spin, needles left behind by a debug defeat |
| `challenger-03-corrosant-ceiling.mp4` | Kai | 0:32 | Corrosant off-camera or under the HUD, 0 damage dealt |
| `challenger-04-kernauth-attempts.mp4` | Kai | 0:58 | Kernauth phase 1 (flares, motes, root spikes, cable). A debug defeat shows no ending. |
| `access-01-pad-menus-driftcache-960.mp4` | Ana | 2:01 | Pad-only menus and Driftcache at 960×540, keyboard prompts on the pad, translucent panels |
| `access-02-small-window-tallock-844x390.mp4` | Ana | 1:27 | 844×390 window. With Screen Shake off the flashes stay. Beats Tallock at 1 heart. |
| `access-03-rootwell-1280x720-kernauth.mp4` | Ana | 0:33 | 1280×720, debug warp to Rootwell, Kernauth's red-on-red hazards |

## Confirmed bugs

Video references are `clip m:ss`; the clip names drop the `.mp4`. Precise repro steps and the check output for each bug are in the structured return.

### Major

| ID | Bug | What the check showed | Video |
|---|---|---|---|
| B15 | Burst Line gaps crossed with Jump + Echo Jump; bv_catwalk is reachable from lw_rest before Weftyr | Vellix crosses bv_sluice in 13/72 timings and bv_catwalk in 16/72; Tessik crosses bv_catwalk in 4/72 | speedrunner-02 0:41, 0:46, 0:51 |
| B16 | Vellix's Blink Strike ends inside Tallock, then contact damage | The slide ends at the boss centre; hurt on frame 12 | speedrunner-01 1:16 · fighter-02 2:06 |
| B19 | The bv_sluice arrival grate is a closed box, and Down+Jump is never taught | Holding Right stops at x 141; only Down+Jump continues | speedrunner-02 0:36 |
| B27 | Pogo-lock on Tallock | 120→0 in 10.6 s, 0 hits taken | fighter-02 0:44 |
| B29 | The light chain knocks crawlers out of range | Tessik and Brackmaw L3 whiff at 65 and 77 px | fighter-01 0:47 · fighter-02 0:16 |
| B33 | The Stack Slam marker follows the player, then vanishes during the arc | The marker moved from x 544 to 447; the slam lands at 447 | challenger-01 0:34, 1:18 |
| B34 | Tallock pins you at the wall after a slam lands on you | 18 hurts in 30 s, a contact hit every 66 f, body gap −55 px | challenger-01 0:38, 1:36 · newcomer-02 0:15 |
| B36 | Jumping the Snare still gets you caught on the way down | Caught on f52 while still falling; the thread lives 240 f | challenger-02 0:47, 1:01 |
| B38 | Corrosant is off-camera from the floor | Boss screen y −48 | challenger-03 0:16 |
| B41 | Rootwell hazards are red on red | Screenshots of the root spikes and the cable | access-03 0:21 · challenger-04 0:23 |
| B42 | Flashes can't be disabled; Screen Shake OFF doesn't help | No flash setting; red wash on a hurt with shake off | access-02 0:43, 0:59 |

### Minor

| ID | Bug | Video |
|---|---|---|
| B03 | The title cursor doesn't return to SETTINGS, and the title menu follows Settings input | newcomer-02 0:04 · fighter-03 2:10 · access-02 0:05 |
| B04 | Centre banners follow you into the next room | newcomer-02 1:04 · access-02 1:09 |
| B05 | Translucent overlays let text bleed through | masher-02 0:39 · speedrunner-01 1:04 · explorer-03 0:56 · access-01 1:08 |
| B06 | The pause ability line is drawn over the zone toast | masher-03 0:16 |
| B10 | Overclock drains during the pickup lock (120 f lost) | masher-02 1:25 |
| B11 | The empty boss bar lingers under "TALLOCK PURGED" | masher-02 1:22 |
| B12 | Keyboard prompts on the pad, and a ▲ glyph that reads as Triangle | masher-02 0:09 · access-01 1:20 |
| B17 | The dc_fall crumble blocks drop you blind onto off-screen spikes | speedrunner-01 0:27 |
| B18 | The WEIGHT bar is inverted | newcomer-01 0:07 · fighter-02 1:25 |
| B22 | The debug `defeatBoss` is unfaithful (debug only) | speedrunner-02 0:19 · challenger-04 0:58 |
| B23 | The map "you" dot covers the vendor hex | explorer-01 1:57 |
| B24 | Core map dots sit in the room corner and aren't in the legend | explorer-03 0:56 |
| B25 | The vendor's discount line is false | explorer-03 0:34 |
| B26 | Tallock can be cheesed from the shelf (10.4 s, 1 hit) | explorer-02 0:22 |
| B31 | Refused inputs are silent | newcomer-02 0:40 · fighter-02 2:01 · access-03 0:14 |
| B32 | Tessik's pose covers the select header | fighter-03 0:18 |
| B43 | The hero blinks fully invisible during i-frames | access-01 0:33 |

## Already fixed, not reproduced, by design

**Already fixed:**

- **B01** pad-only audio.
- **B13** RESET SAVE without a save.

**Not reproduced:**

- **B20** ns_base mid-air respawn.
- **B21** pogo on hopnodes and spikes. It works with at least a 4 f lead.
- **B28** Loomworks lore-card contrast (12.6:1).
- **B35** Stomp Quake wave height.
- **B39** Kernauth's motes: an air attack kills them.

**By design:**

- **B02** Dash is Burst Line, earned from Weftyr.
- **B07** Any key closes the lore card.
- **B08** Deaths are saved at the next node.
- **B09** Two heroes in the room slide (§11.3.2).
- **B14** Continue loads 50 energy.
- **B30** A down-strike while rising stops the jump (§3.6).
- **B37** Weftyr's body contact during recover.
- **B40** Kernauth's body and cable.
- **B44** Fixed 960×540 letterbox.
- **B45** Red unaffordable prices (§12.17).

## Feature backlog (ranked)

★ marks a recommendation to build now.

1. ★ **F01 Controls & Moves page** in Pause and Settings, device-aware (Rin, Jules, Ana, Dex). High value, S, low risk.
2. ★ **F02 Comfort pack:** Reduced Flashing plus a Steady Silhouette (Ana, Rin, Kai). High, S, low.
3. ★ **F03 Device-aware prompts everywhere** (Dex, Ana). High, S, low.
4. ★ **F04 Signal Ledges:** mid-room hazard-respawn anchors in tall rooms (Rin, Dex, Vee). High, M, low.
5. ★ **F05 Hazard Outline mode** (Ana, Dex, Jules, Kai). High, M, low.
6. ★ **F06 Retry flow:** skippable boss intros, safe lore cards, a Lore archive (Dex, Vee). Medium, S, low.
7. ★ **F07 Restore Echo boss tips** (Rin). Medium, S, low.
8. **F08** Remappable controls (Ana, Rin). High, M, medium risk. Next up.
9. **F09** Gentle Signal assist mode (Rin, Ana). High, M, medium.
10. **F10** Boss rehearsal & trials (Kai, Vee, Jules). High, L, medium.

Then:

- **F11** Combo counter.
- **F12** Training room.
- **F13** Map pins and sweep marks.
- **F14** Out-of-reach echoes.
- **F15** Node relay.
- **F16** Edge beacon (fix path for B38).
- **F17** Dismissable banners (fix path for B04).
- **F18** Run timer.
- **F19** Pogo cues.
- **F20** Fault Trace.
- **F21** UI scale.
- **F22** Weak-spot chip.
- **F23** Catch windows.
- **F24** Anti-pogo shrug (fix path for B27).
- **F25** Chain knockback tuning (fix path for B29).
- **F26** Phase Step.
- **F27** Depth discount (fix path for B25).
- **F28** Input display.

## Notable quotes

> "For the first four rooms I felt welcome. Then Tallock showed up two rooms later and asked for a skill set the game never taught me." (Rin)

> "I tried really hard to break UNDERBYTE and mostly couldn't." (Dex)

> "What holds the game back for me is friction, not difficulty." (Vee)

> "The moment where I wall-jumped up to the alcove I'd seen in the first half-minute felt like a real explorer's payoff." (Mo)

> "Read the tell, press Special, Tallock flashes white, 16 damage and a chunk of meter. … That's a real fighting-game moment." (Jules)

> "The boss designs are good, but the fights aren't fair yet." / "Corrosant was invisible for half my fight." (Kai)

> "As a pad player I'm relieved: I played the whole thing, menus included, without touching the keyboard." (Ana)
