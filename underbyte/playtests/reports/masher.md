# UNDERBYTE playtest: masher (Dex)

## Who I am
I'm Dex. I'm 11 and I don't read stuff, I just press buttons. If a game has a pause button I'll press it while I'm jumping, dying or loading, just to see if the game breaks.

## What I played
Total live play: about 4:04 across 3 clips. No console errors in any clip.

| Clip | File | Live length | What happened |
|---|---|---|---|
| 1 (keyboard) | `recordings/masher-01-title-mash-and-spike-deaths.mp4` | 1:47 | I mashed the title and settings, mashed straight past character select, and paused mid-jump, mid-transition and mid-death. I fell in spikes over and over in Crossrack Hall and the dc_fall shaft and died twice. I mashed the SIGNAL LOST screen, rested at the node, quit to title, held every key at once, and toggled settings from the pause menu. |
| 2 (virtual gamepad) | `recordings/masher-02-gamepad-boss-mash.mp4` | 1:38 | Continued my save on the pad. I tested the overwrite-save dialog, RB/LB dash, the map and drop-through, and paused during a spike freeze. Then I used my one warp, to the shrine right before Tallock. I mashed the shop, paused and opened the map during the boss intro card, and lost fight 1. I quit to title while dead, beat Tallock in fight 2 by mashing, popped Overclock, mashed the Echo Jump banner, rested, and quit again while Overclocked. |
| 3 (keyboard) | `recordings/masher-03-dash-lore-quit-tests.mp4` | 0:40 | I tested Shift and ; for dash (standing, running, in the air). I echo-jumped into Loomworks, paused on the zone toast, and pressed pause on the lore card. I fell in an orange pool, pushed the map cursor to the edges, and quit to title during the hazard freeze. I spammed Overclock with an empty meter and spammed attacks through a room slide. |

## Bugs

**1. MAJOR: With only a gamepad, the game never makes a sound**
- Steps: start the game with the gamepad only (no keyboard, no mouse). Press A and Start on the title and play normally, including a boss fight. Then quit to title.
- Expected: the first gamepad press starts the audio, same as a key press does.
- Actual: a "PRESS ANY KEY" line sits under the title menu. Pressing A doesn't clear it, and the audio never starts (I checked with `UB.debug.audio()`: `ctxState: "none"` after a whole run plus a boss fight). In the keyboard clip it said `running` and `driftcache` right away. On a pad you also can't tell "PRESS ANY KEY" is about sound.
- Video: `masher-02-gamepad-boss-mash.mp4` 0:00–0:01 (the prompt shows through the overwrite dialog) and 0:54–0:55 (title after quitting, mark plus debug check). Compare with `masher-03-dash-lore-quit-tests.mp4` 0:00.

**2. MAJOR: Dash does nothing (Shift, ;, RB, LB)**
- Steps: in any room, hold right and tap Shift, or tap Shift standing still, or jump and tap Shift in the air. Try `;` too. On the pad, tap RB or LB while running.
- Expected: a quick dash (it's in the controls list).
- Actual: nothing happens. Speed stays at normal running speed, there's no dash pose or streak, and the state never says dash. The first-room tips never mention dash either, so maybe it's locked, but nothing tells me that.
- Video: `masher-03-dash-lore-quit-tests.mp4` 0:01–0:07 (mark at 0:06), `masher-02-gamepad-boss-mash.mp4` 0:02–0:04, `masher-01-title-mash-and-spike-deaths.mp4` 0:49.

**3. MINOR: Menus and banners are see-through, so text from behind mixes with the menu**
- Steps: rest at a node, then pause right away while the RESTORED banner is up. Or pause or open the map during the boss intro card. Or open the quit dialog during a boss fight. Or open the shop.
- Expected: the menu covers what's behind it.
- Actual: "RESTORED / Saved · hearts full" shows through the pause box on the MAP row. "TALLOCK / WARDEN OF THE STACK" shows through the pause box and the map. The boss name and boss HP bar show through the quit dialog. "PRESS ANY KEY" and "SETTINGS" show through the overwrite-save dialog. "▲ TRADE" shows through the shop.
- Video: `masher-01…` 1:10; `masher-02…` 0:00, 0:34, 0:39, 0:54.

**4. MINOR: The pause menu's ability line prints on top of the zone title**
- Steps: get Echo Jump, walk into Loomworks, and press pause while the big LOOMWORKS title is still on screen.
- Expected: the two texts don't overlap.
- Actual: "ECHO JUMP — a second jump in the air" is printed right across "LOOMWORKS".
- Video: `masher-03-dash-lore-quit-tests.mp4` 0:16.

**5. MINOR: Any button closes the lore card, even Pause, and it never comes back**
- Steps: enter a new zone and press Pause (or attack) while the lore card is showing.
- Expected: Pause pauses, or the card waits a moment before it can be closed.
- Actual: the card closes after about a third of a second, I never get to read it, and it only shows once per zone.
- Video: `masher-03-dash-lore-quit-tests.mp4` 0:17–0:18; `masher-01-title-mash-and-spike-deaths.mp4` 0:09–0:10 (closed by an attack).

**6. MINOR: You can pause while you're dying, and quitting from there erases the death**
- Steps: die (to spikes or the boss) and press Pause during the death animation, before SIGNAL LOST. Pick QUIT TO TITLE → YES, then Continue.
- Expected: no pause while dead, or the death still counts.
- Actual: the pause menu opens over my dead body. Quitting skips the game-over screen, and the save's death count went from 3 back to 2. Right after the quit, the debug state on the title still said `bossFight: "fight"` (it reset once I continued).
- Video: `masher-01…` 1:02 (paused while dead); `masher-02…` 0:53–0:55 (quit while dead in the boss arena).

**7. MINOR: Two of me during the room-slide transition**
- Steps: run through any door.
- Expected: one hero.
- Actual: for a moment there's one me by the old door and another me in the new room.
- Video: `masher-03-dash-lore-quit-tests.mp4` 0:38; `masher-02-gamepad-boss-mash.mp4` 0:36.

**8. MINOR: Overclock keeps draining during the ability pickup scene**
- Steps: pop Overclock right after killing Tallock, then touch the ability crystal.
- Expected: the Overclock timer freezes while I'm locked in the pickup animation, the way banners do.
- Actual: the meter keeps dropping (92 → 84) while I can't move, so Overclock is wasted.
- Video: `masher-02-gamepad-boss-mash.mp4` 1:24–1:27.

**9. MINOR: An empty boss bar stays on screen after the boss is dead**
- Steps: beat Tallock.
- Expected: the bar goes away, or the "PURGED" message replaces it.
- Actual: "TALLOCK PURGED" sits right on top of the leftover empty bar and its name for a few seconds.
- Video: `masher-02-gamepad-boss-mash.mp4` 1:21–1:26.

**10. MINOR: Keyboard-only hints when playing on a gamepad**
- Steps: on the pad, open the map or the shop.
- Expected: pad buttons in the footer (Echo Jump's banner already says "Press A", so it's possible).
- Actual: the map says "R recentre · Esc / M close" and the shop says "Enter buy · Esc close".
- Video: `masher-02-gamepad-boss-mash.mp4` 0:09, 0:34.

**11. MINOR: RESET SAVE looks pressable with no save, and nothing happens when you press it**
- Steps: fresh boot, title → SETTINGS → RESET SAVE → Enter, Enter.
- Expected: greyed out, or a message.
- Actual: it's white like every other option, and pressing it does nothing visible.
- Video: `masher-01-title-mash-and-spike-deaths.mp4` 0:02–0:03.

**12. MINOR: "Energy full" when you rest, but half energy when you continue**
- Steps: rest at a node (the banner says "Saved · hearts full · energy full"), quit to title, then Continue.
- Expected: full energy, like the banner said.
- Actual: energy comes back at about half.
- Video: `masher-01-title-mash-and-spike-deaths.mp4` 1:10–1:11.

Things I tried hard to break that held up: pause and map spam mid-jump, mid-death, during the spike freeze, the boss intro, the enrage roar, the boss death and the ability banner; pause + map pressed together; Start + Back together; holding every key at once; holding left + right (keyboard, and stick vs d-pad); mashing the SIGNAL LOST screen; quitting to title during a hazard freeze, while Overclocked and while dead. No soft-locks, no menu that wouldn't close, no stuck keys after unpausing, no getting stuck in walls, no frozen screen, and no console errors. The music was correctly back to Driftcache after quitting from Loomworks.

## Confusing or frustrating moments
- **Spikes send me way back.** In the dc_fall shaft I dropped straight onto the bottom spikes three times, and every time I went back to the TOP of the shaft. In Crossrack Hall the right spike pit sent me back to the start of the room twice. I lost all my hearts to spikes, not enemies. (`masher-01` 0:49, 0:57, 1:25; `masher-02` 0:28.)
- **The Loomworks orange pool** is almost the same orange as the background, and the background rods with circles look exactly like the rods you can stand on (`masher-03` 0:20–0:21).
- **I skipped character select by mashing** and never found out who I picked (it was Tessik). Nothing showed me afterwards (`masher-01` 0:06).
- **B is both Back and Special on the pad.** I closed the shop with B, my next B threw a special at the shopkeeper (`masher-02` 0:34–0:35).
- **No feedback when something doesn't fire.** Specials with not enough energy, extra specials pressed during a special, and Overclock with an empty meter all just do nothing silently (`masher-02` 0:26; `masher-03` 0:35). I didn't know Overclock needed a full bar until it finally worked.
- **The boss intro card plays every retry**, and A or Start can't skip it (`masher-02` 1:00).
- **Pause and map presses during door slides are just eaten**. They don't break anything, but I pressed and nothing happened.

## What I loved
- I could not break the menus. Pause → map → pause → play in any order, from anywhere, always worked.
- The safety prompts are smart: "Overwrite the saved run?" and the quit warning both start on NO, and the title starts on CONTINUE, so mash-Enter takes me back into my game instead of wiping it.
- Tallock is fun to mash on. Clear tells, he flashes white when hit, the boss bar shows a damage trail, and jumping over the Slab Swing then wailing on him felt great. The enrage roar made me nervous in a good way. I won with 1 heart left.
- The Echo Jump banner knew I was on a gamepad ("Press A again in the air").
- Overclock glow looks cool, and the map's room names with enemy lists ("The Long Drop — Scuttlebit · Driftmoth · Hopnode") and "purged" on the boss room are neat.
- The HUD fades when I stand behind it, so I can still see myself.

## Feature requests
1. **Combo Counter with style grades** (M). A hit counter pops up next to the hero and climbs with every hit that connects. It ranks up (for example Ping → Burst → Overflow), and mixing light, heavy and special gives bonus Overclock meter. For a masher like me it turns button smashing into a score to chase, and it teaches that mixing moves fills Overclock faster.
2. **Overclock Ready cue and "denied" feedback** (S). When the meter fills, the bar pulses and shows the Overclock key or button. Pressing Overclock, a special or dash when you can't makes the bar shake with a small "NOT YET" flash. I spammed these buttons for minutes without knowing why nothing happened.
3. **Ledge anchors for hazard respawns** (M). Tall rooms like the dc_fall shaft get a few mid-room glowing anchor plates. Touching one makes it your hazard respawn point instead of the room entrance. Falling into spikes would still cost a heart but not the whole climb, so I'd keep exploring instead of rage-quitting.
4. **Lore Archive plus a safe lore card** (S). The lore card ignores input for its first half second, and every card you've seen goes into a "Lore" page in the pause menu. I close everything by accident, and I'd actually read them later.
5. **Skippable boss intro on retries** (S). After you've seen a boss card once, pressing jump or confirm skips it on the next attempt. When I die to a boss I want back in right now.
6. **Glyph auto-switch for the pad** (S). All footers and prompts switch to pad buttons when the last input came from the gamepad. "PRESS ANY KEY" becomes a clear "Press any key or click to turn on sound" note. Right now pad players get keyboard hints and no sound.

## Ratings
- Fun: 7/10
- Controls: 5/10 (dash never worked for me, and B is both Back and Special)
- Clarity: 6/10
- Difficulty fairness: 5/10 (the bosses are fair; the hazard respawns are not)

## Verdict
I tried really hard to break UNDERBYTE and mostly couldn't. Every menu closed, nothing got stuck, there were no errors, and quitting to title always reset everything. That's honestly impressive, because I pressed pause during death, during boss intros, during the ability banner and on the game-over screen. The two things that actually hurt were that my dash button never did anything, and that with only a gamepad the whole game was silent. The rest is polish: see-through menus with text bleeding through, a lore card I closed by accident and can't get back, two of me during door slides, and spike pits that send me all the way back to the top. Tallock was the best part, and I'd keep playing if the dash worked, the spikes sent me back less far, and I got a combo counter to show off with.

## Debug calls I used
- `masher-02` 0:28: `UB.debug.warp("dc_shrine","L")`. My one allowed warp, to the shrine room right before Tallock's arena. I rested at its node and walked into the boss myself.
- `masher-02` 0:54: `UB.debug.audio()`. Confirmed the pad-only silence after I saw "PRESS ANY KEY" (`ctxState: "none"`).
- `masher-03` 0:00: `UB.debug.audio()`. Comparison with the keyboard (`ctxState: "running"`), to confirm bug 1.
- `masher-03` 0:06: `UB.debug.pressed()`. Tried to confirm the dash repro; it returned nothing useful.
- `masher-03` 0:34: `UB.debug.audio()`. The recordings have no sound, so this was my only way to check that music resets after quitting to title from Loomworks. It does (Driftcache).
