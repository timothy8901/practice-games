# Playtest report: newcomer (Rin)

## Who I am
I'm Rin, 24. I mostly play cozy games and puzzle games, and I've never finished an action platformer.
I played keyboard only, learned the controls only from what the game showed me, and used no debug calls at all.

## What I played

| Clip | File | Live length | What happened |
|---|---|---|---|
| 1 | `recordings/newcomer-01-first-steps-and-tallock.mp4` | 2:08 (127.6 s) | Title screen, then Settings, then character select, where I picked Tessik because it says "the right first choice". I rested at the first statue and had my first fight with a beetle. Then I fell down the tall room (Driftcache) and hit spikes, which sent me back to the top. I crossed the spike-pit room, found a second shrine with a save statue and a shop, and opened the map. I walked straight into the first boss, Tallock. I found Overclock when the game prompted it, got the boss to about 57% health, and died. Then I respawned and saved again. |
| 2 | `recordings/newcomer-02-tallock-attempts.mp4` | 2:21 (141.3 s) | I used Continue from my save. Then I made four more tries at Tallock (attempts 2–5). In between I checked the map, fell into a spike pit again, and rested. My best try got Tallock down to 45/120. I did not beat it. |

In total I played 4:29 live, with 206 turns, 5 deaths (all to Tallock) and 3 spike hits. I got as far as the first boss, Tallock. I never beat it. **Debug calls: none.** **Console errors: none.**

## Bugs

1. **Major: the game never teaches Dash, and also never shows Drop-through or the Ultimate.**
   - Steps: start a new game as Tessik. Play through Driftcache up to Tallock and fight it several times.
   - Expected: at some point before or during the first boss, the hint bar shows a DASH key, the same way it showed MOVE, JUMP, LIGHT, HEAVY and SPECIAL. The select screen lists an ULTIMATE (Sightline), so I expected the game to tell me how to use it too.
   - Actual: in 4.5 minutes and five boss attempts, the hint bar never showed a dash key. My save file still has `hints.dash: false` at the end. The Ultimate key and Down+Jump drop-through were never shown anywhere. The pause menu and Settings have no controls page either. I didn't even know dash existed. Without it I kept getting pinned against the left wall by a boss too tall to jump over.
   - Video: `newcomer-02-tallock-attempts.mp4` 0:22 and 1:38. The bottom of the screen is empty of hints from about 0:55 of clip 1 onward.

2. **Minor: the title menu cursor jumps after closing Settings.**
   - Steps: on the title screen press Down to SETTINGS, press Enter, then press Esc. Press Up once.
   - Expected: the cursor is still on SETTINGS, and Up moves it one row.
   - Actual: with a save present, the cursor comes back on CONTINUE, so one Up landed on NEW GAME. That's dangerous next to a save. On a fresh game, the first Up press after closing Settings did nothing at all.
   - Video: `newcomer-01-first-steps-and-tallock.mp4` 0:04–0:05; `newcomer-02-tallock-attempts.mp4` 0:02–0:04.

3. **Minor: the RESTORED banner hangs around and follows me into the next room.**
   - Steps: rest at the Rackside Shrine statue, then walk left straight into the spike-pit room.
   - Expected: the "Saved · hearts full · energy full" box fades before I'm back among enemies, or it gets smaller.
   - Actual: the big box still sat in the middle of the screen after the room change. It covered the area where the lantern enemy and the turret were.
   - Video: `newcomer-02-tallock-attempts.mp4` 1:04, and also `newcomer-01-first-steps-and-tallock.mp4` 0:18, where it covers my first fight.

4. **Minor: Special (C) sometimes gives no feedback.**
   - Steps: (a) stand on the low left platform in Tallock's arena and press C toward the boss. (b) On the ground, press C shortly after a previous C.
   - Expected: either the attack hits, or I get a visible signal that it can't fire right now.
   - Actual: in (a), 27 energy was spent but the boss took no damage. This happened twice. In (b), nothing came out and no energy was spent, and there was no "can't" signal I could see. I couldn't work out what Pulse Line actually does.
   - Video: `newcomer-02-tallock-attempts.mp4` 0:40 (from the platform) and 1:26 (nothing came out).

5. **Minor: the WEIGHT bar on the select screen reads backwards.**
   - Steps: on the Choose Your Spirit screen, compare Brackmaw ("armoured", "Walking Vault") with Vellix ("the most fragile").
   - Expected: Brackmaw has the most WEIGHT.
   - Actual: Vellix shows a full WEIGHT bar and Brackmaw shows about half. If the bar means how far you get knocked around, the label says the opposite.
   - Video: `newcomer-01-first-steps-and-tallock.mp4` 0:06–0:08.

## Confusing or frustrating moments

- **Spikes in the tall falling room send me back to the very top** (`newcomer-01…` 0:45). One spike tap undid the whole descent. The design notes say this is intended ("respawn at the last entry spawn"). For me, in a tall room, it felt like a big punishment for a small mistake.
- **I dropped blindly onto spikes.** When I walked off a ledge, the camera didn't show what was below me until I was already falling (`newcomer-01…` 0:45).
- **Tallock corners me.** The slam homes in on me even when I'm on a platform (`newcomer-02…` 0:15). It's too tall to jump over, and every hit knocks me further toward the left wall. I only found out at 1:53 of clip 2 that I can run under it while it's in the air.
- **The ground quake is almost impossible to dodge up close.** I saw the glow ring and jumped, and still got hit (`newcomer-02…` 0:56). Standing on a platform helped once (`newcomer-01…` 1:52), but then the slam came for me there.
- **The arm swing came too fast while I was mid-combo.** I jumped the moment the arm went up and still got hit (`newcomer-02…` 1:29). Running away worked better (1:31).
- **Touching the boss while I punish hurts me.** My last death came from bumping into it right after a good dodge (`newcomer-02…` 2:17).
- **My light attack has very short reach.** Beetles and lanterns drift away while I swing at air. My first kill took five tries (`newcomer-01…` 0:25). After getting knocked back I kept whiffing at the boss (`newcomer-02…` 1:55).
- **I lost track of my character.** After a hit, Tessik flickers invisible. More than once I couldn't find myself on the screen.
- **Overclock meter resets to 0 when I die.** I had built it to 87, and after respawning it was empty. So I mostly got to use Overclock once.
- **Energy is only half after dying or loading Continue.** The death screen says "Rebooting at the last restore node", so I expected to be topped up. I had to rest again to refill.
- **Nothing in the shop is affordable on the first visit** (28 bits; the cheapest item costs 90). That's fine, but I learned that a MAP exists only from the shop's "Deep Ping" description and the map's footer ("M"). The game never told me about M directly.
- **The boss came really early.** It's only the 5th room, right after the shop. I was glad the save statue sits next door.
- **I never figured out the shiny gold diamond on the high ledge** in the falling room (`newcomer-01…` 0:37). I couldn't reach it, and nothing hinted whether I could later.

## What I loved

- The title screen is calm and clear. Continue is preselected, with a summary line (fighter, zone, hearts, time). The select screen recommends Tessik for first-timers, which made me trust it.
- **The control hints at the bottom of the screen** show each control and fade once I've used it (`newcomer-01…` 0:10). This is exactly how I like to learn.
- The first save statue is right where you start. The "▲ REST" prompt and the big "RESTORED" panel make saving obvious (0:17).
- The low-health red vignette is a great warning (1:17).
- **The map** is beautiful and readable. Unexplored rooms show as dashed boxes, it has a legend, and it names the room under the cursor (1:36).
- **"OVERCLOCK — READY [V]"** appears under the meter right when it fills (1:54). This is the one late control the game did teach me, and it felt great: the boss bar dropped fast.
- Dying is gentle. I kept my bits, respawned next door, and the boss intro card plays again so I get a breath.
- Tallock's attacks have readable tells: the glowing top disc, the crouch before the slam and the glowing ring before the quake. By attempt 5 I had a real "back off, then hit three times" rhythm and got it under 40% (`newcomer-02…` 2:04).

## Feature requests

1. **Controls page in Pause and Settings** (effort S)
   Add a page that lists every input: move, jump, light, heavy, special, dash, overclock, the ultimate, interact, drop-through and map. It should also show each key's alternate. Optional key rebinding could come later.
   *Why I want it:* when I get stuck I look things up in the menu. Here there was nowhere to look, so I never learned dash.

2. **Dash lesson before the first boss** (effort S)
   In the Rackside Shrine, or the room before it, add a short low gap that is only crossable with a dash, plus a "DASH SHIFT" hint like the other controls. A faint lantern trail could show the motion once.
   *Why I want it:* dash is my escape from being cornered, and the game should make sure I have it before the boss teaches me the hard way.

3. **"Restore Echo" boss tips after repeated deaths** (effort S–M)
   After two deaths to the same boss, resting at the nearest save statue shows one short in-world tip, worded as a recovered memory fragment. For example: "The Warden's quake rides the floor. Leave the floor." Or: "It cannot turn mid-leap. Pass beneath."
   *Why I want it:* I worked out "run under the slam" only on my fifth try. A gentle nudge would keep players like me from quitting.

4. **Gentle Signal assist mode** (effort M)
   Add an optional toggle in Settings with three changes: +1 heart, boss telegraphs 25% longer, and hazards respawn you at the last solid ledge instead of the room entrance. Show it as a small badge on the save, with no achievements lost.
   *Why I want it:* I want to see the world and the story. The core mechanics are fine, but the timing windows are tuned for people who already play these games.

5. **Signal Ledge markers in tall rooms** (effort S)
   Add small glowing pads on safe ledges in tall rooms. Touching one sets your hazard-respawn point to that ledge.
   *Why I want it:* falling back to the top of the falling room after one spike touch was my single biggest "ugh" moment outside the boss.

## Ratings (1–10)

- **Fun:** 6. The world is lovely, and the moment I passed under the boss felt amazing. But five deaths in a row wore me down.
- **Controls:** 6. Movement and jumps feel clean. The light attack is short, and the controls I wasn't taught (dash, ultimate) hurt.
- **Clarity:** 6. The hints, map, save and Overclock prompt are great. Dash is missing, the special gives no feedback, and the WEIGHT bar reads backwards.
- **Difficulty fairness:** 4. Tallock arrives early. The quake and arm swing are very hard to read at close range, contact damage punishes my punish window, and the tall-room spike respawn is harsh.

## Verdict

UNDERBYTE is pretty, calm, and kinder to beginners than most games like it. It has a save statue on the first screen, control hints that fade as I learn, a gorgeous map and forgiving deaths. For the first four rooms I felt welcome. Then Tallock showed up two rooms later and asked for a skill set the game never taught me. I didn't know dash existed, I couldn't read the quake up close, and every mistake pushed me into a corner. I got it to 45/120 on my fifth try and had to stop. I'd keep playing if the game taught dash before the boss and offered a gentle assist option. Without those, a player like me probably puts it down at the first boss.
