# Playtest report: access (Ana)

## Who I am
I'm Ana. I play with a gamepad on the couch, and before I play anything I check whether it will be comfortable. I look for flashes, screen shake, text size, colour-only signals, and whether I'm forced back to the keyboard.
I played all three clips with the virtual gamepad only (`--pad`), including every menu. I never touched the keyboard.

## What I played

| Clip | File | Live length | What happened |
|---|---|---|---|
| 1 | `recordings/access-01-pad-menus-driftcache-960.mp4` | 2:01 (121.5 s) | 960×540, new game. I opened Settings from the title and tried every row with the d-pad and stick: the three volume sliders, Screen Shake, Show Hitboxes, and Reset Save (greyed out). I picked Tessik on the select screen and dismissed the Driftcache lore card with A. I fought a scuttlebit, dropped down The Long Drop, crossed the spike-pit room, got hit by spikes and sent back to the room entrance, and was killed by a hopnode. That gave me SIGNAL LOST. I continued with A and rested at the Wake Cell node with Up. Then I paused (Start), opened the map from the pause menu, opened Settings from pause, toggled Show Hitboxes on and off, and opened the map directly with Back. I tried to find a pad button for "recentre". I went back through the spike room and beat the hopnode with a heavy. I rested at Rackside Shrine, opened Scrivvet's shop (Up), tried a purchase I couldn't afford, and closed it with B. |
| 2 | `recordings/access-02-small-window-tallock-844x390.mp4` | 1:27 (87.3 s) | 844×390 window, continuing from clip 1. I turned Screen Shake OFF and reproduced the hidden-title-cursor bug. Then I continued and walked into Tallock. I died on the first attempt (Tallock at 89/120) and went through game over. On the map I found that A recentres it. On the second attempt I **beat Tallock with one heart left**. I collected the bits and Echo Jump, triggered Overclock with LT, tried the double jump under the "ECHO JUMP ACQUIRED" banner, rested, and Echo-Jumped onto the shrine platform. |
| 3 | `recordings/access-03-rootwell-1280x720-kernauth.mp4` | 0:33 (32.6 s) | 1280×720 window. I checked Settings (my Screen Shake OFF had carried over). Then I used a **debug warp** to Rootwell, rested, and fought Kernauth (phase 1) for real. I got it to 196/200, and it got me down to 2 hearts. Then I paused and checked the map. I also tried to reach the victory screen through debug (see below), but it never appeared. |

Totals: 4:01 of live play (241.4 s) over roughly 240 turns. I died twice (a hopnode in Driftcache and Tallock once), and Tallock was beaten for real. Console errors: none.

**Debug calls (all in clip 3, all logged in `sessions/access-03/session.json`):**
1. `UB.debug.grant("burstLine"); UB.debug.grant("gripProtocol"); UB.debug.warp("rw_rest","L")` (0:02). This skipped hours of play so I could check the last zone, the final boss and the end-of-game flow at 1280×720.
2. `UB.debug.defeatBoss()` (0:26). I wanted to see the victory screen with a pad after my real attempt stalled at 196/200. With no argument it did nothing to the boss, and it pushed `null` into `bossesDefeated`.
3. `UB.debug.defeatBoss("kernauth")` (0:26). Same reason, this time with the id.
4. `UB.debug.killEnemies()` (0:27). After call 3 the two Orbital Flare orbs stayed alive and kept hitting me (down to 1 heart). This call cleared them.

After calls 3 and 4 the throne room just went quiet and no victory screen appeared, so **I could not verify the victory screen with the pad**. That is a debug-path artefact, not something a real player would hit.

## Bugs

1. **Major (accessibility): full-screen flashes can't be turned off, and the Screen Shake toggle doesn't reduce them.**
   - Steps: Settings → SCREEN SHAKE = OFF. In Driftcache, take a hit from a hopnode or a bat, fall onto spikes, then beat Tallock.
   - Expected: with shake off, or through a separate "reduce flashing" option, hits are signalled without tinting the whole screen.
   - Actual: every hit tints the entire screen red-pink, and a spike hit washes it white. Tallock's death washes the whole screen white-pink for about a second. Screen Shake OFF stops the shake, but none of the flashes. Settings has no flash option.
   - Video: `access-01-pad-menus-driftcache-960.mp4` 0:37 (hit tint) and 0:54 (spike white wash). `access-02-small-window-tallock-844x390.mp4` 0:43 (tint with shake OFF) and 0:59 (boss-death wash).

2. **Major (accessibility): Rootwell hazards are red on a red room and rely on colour alone.**
   - Steps: warp to or reach `rw_throne` and let Kernauth use Root Spikes, then Cable Sweep.
   - Expected: things that hurt stand out from the scenery by shape, outline or contrast, not only by hue.
   - Actual: the Root Spikes are red spikes coming out of a red floor in front of red roots. The only warning is a small dull-yellow oval. The Cable Sweep cable is a dark line on a dark-red floor, and I couldn't find its dangerous tip at all. My red hearts also sit on the red background. I got hit by a spike I couldn't pick out from the decoration.
   - Video: `access-03-rootwell-1280x720-kernauth.mp4` 0:16 (cable), 0:20 (spike tell) and 0:21 (spike hit).

3. **Minor: the hero disappears completely while invulnerable after a hit.**
   - Steps: take any hit, for example from the driftmoth while dropping down The Long Drop.
   - Expected: the hero stays visible (dimmed or outlined) so I can track where I am.
   - Actual: the sprite blinks fully out for long stretches. Mid-fall or mid-boss-fight, with the screen tinted at the same time, I lost track of myself several times.
   - Video: `access-01-pad-menus-driftcache-960.mp4` 0:33 and 1:31. `access-02-small-window-tallock-844x390.mp4` 0:19. `access-03-rootwell-1280x720-kernauth.mp4` 0:21.

4. **Minor: on a gamepad, most prompts still name keyboard keys.**
   - Steps: start with a pad only and read the hint lines on the title, select screen, map, shop, game over and lore card.
   - Expected: pad buttons (A/B/Start/Back), since the game clearly detects the pad.
   - Actual: the title says "PRESS ANY KEY · press Enter". The select screen says "← → select · Enter confirm · Esc back". The map says "R recentre · Esc / M close". The shop says "↑↓ select · Enter buy · Esc close". Game over says "Press JUMP or CONFIRM". The lore card has no dismiss prompt at all. Meanwhile "ECHO JUMP ACQUIRED – Press A" and "OVERCLOCK — READY [LT]" do show pad buttons, so the support is half there. Because the map said "R", I spent a while trying Y, X, LS and RS before finding that A recentres.
   - Video: `access-01-pad-menus-driftcache-960.mp4` 0:07 (select), 0:11 (lore), 1:09 and 1:20 (map), 2:00 (shop). `access-02-small-window-tallock-844x390.mp4` 0:27 (game over), 0:30 (A recentres), 1:06 (Press A, done right).

5. **Minor: the title menu keeps reacting to input while Settings is open, and the cursor doesn't return to SETTINGS.**
   - Steps: on the title screen, d-pad Down to SETTINGS, press A, press Down once, and look through the translucent panel. Then press B.
   - Expected: the hidden title menu ignores input. After B, the cursor is back on SETTINGS.
   - Actual: the title cursor behind the panel moves with my Settings presses (NEW GAME → CONTINUE), and after B the cursor jumps to the default item (NEW GAME with no save, CONTINUE with a save) instead of SETTINGS.
   - Video: `access-01-pad-menus-driftcache-960.mp4` 0:03–0:06. `access-02-small-window-tallock-844x390.mp4` 0:05. `access-03-rootwell-1280x720-kernauth.mp4` 0:01.

6. **Minor: big centre-screen banners cover the hero and the platforms while play keeps running.**
   - Steps: pick up Echo Jump after Tallock and try the double jump straight away. Or rest at a node and immediately jump for the shrine platform.
   - Expected: the banner sits at the top or bottom edge, or can be dismissed with B.
   - Actual: the "ECHO JUMP ACQUIRED" box sits over my hero for about 3 s while I'm trying the jump it teaches. The "RESTORED" box hides the platform I'm aiming for.
   - Video: `access-02-small-window-tallock-844x390.mp4` 1:09 and 1:18.

7. **Minor: the pause, map and settings panels are see-through, so text from behind bleeds into them.**
   - Steps: rest at a node, then press Start straight away (or open the map).
   - Expected: an opaque or strongly dimmed panel so menu text stands alone.
   - Actual: the "RESTORED · Saved · hearts full · energy full" box and the HUD show through behind RESUME and MAP and under the map rooms. With low vision this is hard to read.
   - Video: `access-01-pad-menus-driftcache-960.mp4` 1:08 and 1:09.

8. **Minor: the REST and TRADE prompts use a ▲ glyph to mean "press Up".**
   - Steps: stand at a restore node or next to Scrivvet.
   - Expected: "↑ / D-pad Up REST" or a d-pad icon.
   - Actual: "▲ REST". On a PlayStation-style pad that reads as the Triangle button, which does something else.
   - Video: `access-01-pad-menus-driftcache-960.mp4` 1:07 and 1:55.

9. **Minor: Special pressed in the air gives no feedback.**
   - Steps: in the Kernauth fight, jump and press B at the top of the jump.
   - Expected: either the special fires, or a visible or audible "can't" cue appears.
   - Actual: nothing happens. Energy stays at 100 and there's no deny cue. Pressing B on the ground right after fired normally.
   - Video: `access-03-rootwell-1280x720-kernauth.mp4` 0:14–0:16.

10. **Minor: in a small window all secondary text drops to about 6–8 px, and there is no UI scale.**
    - Steps: run at 844×390.
    - Expected: HUD labels and hints stay readable, or there's a text/UI size option.
    - Actual: the 16:9 game is shrunk into a letterbox (black bars left and right). The ENERGY and OVERCLOCK labels, the CONTINUE save summary, "OVERCLOCK — READY [LT]", the map legend and the room names are tiny. The map's boss and vendor dots shrink to look like the same dot apart from colour.
    - Video: `access-02-small-window-tallock-844x390.mp4` 0:00, 0:06, 0:30 and 1:01.

11. **Minor: unaffordable shop items are marked only by red price text.**
    - Steps: open the shop with 24 bits.
    - Expected: an icon or "need 66 more" next to an item I can't afford.
    - Actual: the prices just turn red, against my bits counter in green. I only learned I couldn't buy when A gave me "Come back heavier."
    - Video: `access-01-pad-menus-driftcache-960.mp4` 2:00.

## Confusing or frustrating moments
- **Tallock's Slab Swing timing** hit me three times. Once I tried to dash out during its tell but my light combo was still finishing. Twice I jumped and came down into it. I couldn't read from the animation when the swing actually starts (`access-02` 0:19, 0:46, 0:51). The Stomp Quake tell, by contrast, was easy to read (0:49).
- **Tallock's Disc Toss**: the disc is a small blue-grey sliver in a dark blue room. A returning disc I barely saw is what killed me (`access-02` 0:23–0:25).
- **The Stack Slam marker** is a pale-blue ellipse on a blue floor and easy to miss at the small window size (`access-02` 0:14).
- **Driftcache enemies blend into the scenery.** The scuttlebit is the same pale blue as the server racks, and the driftmoth is blue on blue. The orange hopnode was the only enemy I could spot instantly (`access-01` 0:13, 1:31).
- **The spike hit sent me back to the room entrance** (`access-01` 0:55). The design summary says this is intended ("last entry spawn"), but in a wide room it feels harsh on top of losing a heart.
- **Kernauth's weak spot.** My jump attacks next to the glowing core did 1–3 damage, and nothing told me I was hitting the "half damage" body instead of the core (`access-03` 0:26).
- **Show Hitboxes is in the player Settings menu.** It also adds an fps/room/frame readout. It's a developer tool sitting next to the real comfort options (`access-01` 1:12).
- The pause screen lists my abilities (nice), but not **which button** triggers Burst Line or Grip Protocol (`access-03` 0:24).

## What I loved
- **Every menu worked with the pad.** That covered the title, character select, Settings (d-pad rows; holding the stick auto-repeats the sliders), pause (Start), the map (Back opens it, B closes it, A recentres), the shop (Up to open, A to buy, B to close), game over (A), lore cards (A) and resting (Up). I never needed the keyboard.
- **The Screen Shake toggle exists, works, and was remembered** across all three clips. With it off, Tallock's slams were calm to watch.
- **Beating Tallock at one heart** on my second try felt fantastic (`access-02` 0:59). The fight is fair once you learn the Stomp Quake tell.
- The **ability popup says "Press A"** and the meter says **"[LT]"**, which is exactly the pad-aware text I want everywhere.
- The **map legend uses shapes**: diamond node, hexagon vendor, and a skull on a purged boss. At 1280×720 that's colour-blind friendly and easy to read (`access-03` 0:32).
- **At 1280×720 everything is crisp and well sized.** The lore text is lovely ("It has never once let go of a child.").
- RESET SAVE is greyed out when there's no save, so I can't wipe anything by accident.

## Feature requests
1. **Reduced Flashing option** (effort S). Add a Settings toggle or slider that replaces the full-screen hurt, hazard and boss-death washes with a thin pulsing frame around the screen edge and a shake of the heart that was lost. A player sensitive to flashes can then play the boss fights at all. Screen Shake OFF currently leaves every flash in place.
2. **Hazard Outline mode** (effort M). Give everything that hurts one consistent visual language in every zone, for example a bright hatched rim with a zig-zag edge, plus an outline on boss projectiles and floor tells. Then spikes, cables and discs read as "dangerous" by shape whatever the zone's palette, and Rootwell stops being red-on-red for colour-blind and low-vision players.
3. **Pad-aware prompts with a glyph style choice** (effort S). Every hint line follows the last device used (A/B/Start/Back instead of Enter/Esc/R/M), and Settings lets me pick letter, shape or generic glyphs. Also replace "▲ REST" with a d-pad icon. The game already does this for Echo Jump and Overclock; it just needs to happen everywhere.
4. **Button remapping for pad and keyboard** (effort M). A Controls page where each action (jump, light, heavy, special, dash, overclock, map, interact) can be reassigned, with a "reset to default" item. Players with limited hand mobility need to move dash and jump to buttons they can reach together, and right now nothing can be rebound.
5. **UI scale and "fit to window" option** (effort M). A text/HUD size setting (100/125/150%) and an option to use the full window on wide or narrow shapes instead of a letterboxed 16:9. At 844×390 the labels are about 6 px, and a 125% HUD would make a small laptop window or handheld screen comfortable.
6. **Steady Silhouette while invulnerable** (effort S). During post-hit invulnerability, draw the hero as a solid outlined silhouette that gently pulses instead of blinking out. I always know where I am, and the "you're invulnerable" signal stays readable.
7. **Edge banners you can dismiss** (effort S). Move RESTORED, ability and zone banners to a strip at the top of the screen and let B dismiss them early. Then they never cover the platform or the move they're teaching.
8. **Signal Boost assist** (effort M). Optional assists: extra max hearts, longer boss tells (for example +30%), and a game-speed setting (80/90/100%). Slab Swing's timing beat me three times, and a slightly slower world would let more players finish without changing the default challenge.
9. **Weak-spot feedback** (effort S). When a hit lands on a boss's ×0.5 body, show a small "½" chip and briefly flash the real weak spot's outline. I'd learn where to aim against Kernauth instead of guessing.
10. **Controls and abilities page in Pause** (effort S). A page listing every action, ability and its button on the current device, including Burst Line, Grip Protocol and Down+Jump drop-through. I want to check a control without leaving the game or remembering a tutorial line.

## Ratings (1–10)
- Fun: **6**
- Controls: **6**. Pad support covers everything, but there's no remapping, prompts are mostly keyboard-only, and a light combo locks out the dash I need to escape.
- Clarity: **4**. Low-contrast enemies, tells and projectiles, colour-only hazards in Rootwell, and banners and translucent panels over the action.
- Difficulty fairness: **5**. Tallock is fair once read, but the Slab Swing timing and the near-invisible disc made two of my losses feel unfair.

## Verdict
As a pad player I'm relieved: I played the whole thing, menus included, without touching the keyboard. The game even says "Press A" and "[LT]" in the places it bothered to. Beating Tallock at one heart was a real high. The comfort side is thin, though. The only comfort option is Screen Shake. Every hit still floods the whole screen with colour, and the hero blinks out of existence after each one. In Driftcache enemies and boss projectiles melt into the blue, and in Rootwell the hazards are red on red. Most hint text still talks about Enter, Esc and R. At 1280×720 it looks great; in a small window everything secondary drops to a few pixels with no UI scale. I'd like to recommend UNDERBYTE to friends who need these options, and I could once it adds a reduced-flash toggle, a hazard-outline mode, pad prompts everywhere and remapping. Until then it's a good-looking game that's tiring to watch for long.
