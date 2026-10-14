# UNDERBYTE playtest: fighter (Jules)

## Who I am
I'm Jules. I mostly play fighting games, so I judge a game by how its attacks feel: startup, recovery, what cancels into what, whether a hit lands with weight and whether I can read the other side's moves.
I played every fighter on purpose, labbed their buttons on trash mobs, and took each one into the Tallock fight.

## What I played
Total live play: 6:39 across 4 clips (97.9 s + 135.5 s + 134.3 s + 31.8 s). Keyboard, default 960x540 window. No console errors in any clip. There's no sound in the recordings (headless browser), so I can't comment on hit sounds or audio feedback at all.

| Clip | File | Live length | What happened |
|---|---|---|---|
| 1 | `recordings/fighter-01-tessik-driftcache-and-tallock.mp4` | 1:38 | Tessik from a new game. I labbed the light chain, Prism Hammer, Pulse Line, air slash and down-strike on the first crawler, then played through Driftcache's first three rooms. Took hits from the diving bats and the orange hopper, fell in a spike pit, then died to a hopper after a blind jump. After rebooting I warped to the shrine, rested, and lost to Tallock at 65/120. |
| 2 | `recordings/fighter-02-brackmaw-vellix-tallock-ultimates.mp4` | 2:15 | Brackmaw new game. I labbed his kit, warped to the shrine and **beat Tallock** (pogo-heavy fight), picked up Echo Jump and went into Loomworks. Turned on the hitbox view, popped Overclock and found the ultimate input by trying things. Then Vellix new game: I labbed her kit, warped to the Loomworks belts (busy room) and tested Blink Strike, Tailwhip Vault, Overclock and Afterimage Storm. Died in a pool, warped to the shrine and lost to Tallock at 107/120. |
| 3 | `recordings/fighter-03-orrubel-korvask-tallock-ultimates.mp4` | 2:14 | Orrubel new game. I labbed whip, Ring Toss and Sentry Pin, then lost to Tallock at 92/120. Korvask new game: labbed his kit and **beat Tallock** with Bulwark Catch counters, finishing on a counter. Echo-jumped into Loomworks and used Overclock + Clamp Press on a moth. Back to Orrubel in the dc_fall shaft for Overclock + Sentry Triad and her air whip. |
| 4 | `recordings/fighter-04-tessik-cancels-sightline-tallock.mp4` | 0:32 | Tessik again, from my clip-1 save. A Tallock rematch where I tested cancels (light into special, light into dash), the Overclock state and Sightline. Lost at 21/120. |

Boss record vs Tallock: Brackmaw W, Korvask W, Tessik L L, Vellix L, Orrubel L.

### Debug calls (all are in the session logs)
- `fighter-01` t56–58, t69: `Object.keys(UB.debug)` and `UB.debug.rooms()` listings, to find the room ids I needed for warps. Read-only.
- `fighter-01` t70, `fighter-02` t17 and t98, `fighter-03` t13 and t30: `UB.debug.warp("dc_shrine","L")`. These skipped the walk from the start room to the boss shrine for each new fighter. I'd already played that route once with Tessik.
- `fighter-02` t1: `UB.debug.startGame.length…`. Harmless arity check, no effect on the game.
- `fighter-02` t77–78: `grant("echoJump")` + `warp("lw_belts","L")`. I wanted Vellix in a busy room with shielded enemies. A player reaching Loomworks would already have Echo Jump.
- `fighter-02` t91, `fighter-03` t64, `fighter-04` t14: `setMeter(100)`. These let me test the Vellix, Orrubel and Tessik ultimates without grinding meter. Brackmaw and Korvask built their meter honestly.
- `fighter-03` t63: `warp("dc_fall","L")`. A room with several enemies for the Sentry Triad test.

## Bugs

**1. MAJOR: The light chain pushes small enemies out of range, so hits 2 and 3 whiff**
- Steps: Tessik (also seen with Brackmaw and Korvask) walks up to a scuttlebit crawler and taps Light three times at a normal pace (about 130 ms apart).
- Expected: a 3-hit chain that connects all three hits, or knockback that grows on the last hit.
- Actual: hit 1 shoves the crawler about 80 px away and hits 2 and 3 swing at air. The only way to land the chain is to walk forward between presses. On Tallock, which takes no knockback, the full chain lands every time, so the chain is only reliable on bosses.
- Video: `fighter-01…` 0:11–0:15 (first crawler) and 0:47 (mark). `fighter-02…` 0:16 (Brackmaw's crawler gets pushed out too).

**2. MAJOR (balance): Pogo-lock on Tallock. Down-strikes on its head can't be punished**
- Steps: fight Tallock with Brackmaw. Jump on top of it and keep pressing Down+Light.
- Expected: the boss has some anti-air answer or shakes me off.
- Actual: Tallock keeps walking while I bounce on its head. I took it from 52 to 0 with pogo alone (about 7 damage a bounce) and took no hits. The whole fight became "get on top, hold down".
- Video: `fighter-02…` 0:42–0:46 (marks at 0:42 and 0:44).

**3. MAJOR: Vellix's Blink Strike into Tallock ends inside its body, so I take contact damage right after the hit**
- Steps: Vellix in the Tallock fight. Face the boss from about 200 px away and press Special.
- Expected: the blink dashes through or stops in front, without contact damage.
- Actual: the blink hits (7 damage) and Vellix ends up overlapping the boss's body. She takes a contact hit on the next frame. That's a 1-heart trade on a 4-heart character every time I use her main move on this boss.
- Video: `fighter-02…` 2:06 (mark).

**4. MINOR: The WEIGHT bar on the select screen looks inverted**
- Steps: on the select screen, compare the WEIGHT bars of Brackmaw ("The Walking Vault"), Korvask (bruiser), Tessik, Orrubel and Vellix (the small, fragile one).
- Expected: Brackmaw or Korvask heaviest, Vellix lightest.
- Actual: Vellix's bar is full and Brackmaw's is the shortest. Korvask's (about 58 %) is shorter than Tessik's (about 77 %) and Orrubel's (about 85 %). It looks like the bar shows "knockback taken" but is labelled WEIGHT.
- Video: `fighter-02…` 1:24–1:25 (marks), `fighter-03…` 0:18 (Tessik), 0:19 (Orrubel) and 0:53 (Korvask).

**5. MINOR: Pressing Down+Light while still rising in a jump kills the jump and starts the down-strike at once**
- Steps: Korvask or Tessik, stand next to Tallock during its stomp-quake tell. Jump, and about 150 ms later press Down+Light.
- Expected: the down-strike comes out but I keep my upward momentum (or it waits until the apex), so I still clear the spikes.
- Actual: the rise stops, I drop straight down into the quake spikes and take a hit. It happened with two fighters.
- Video: `fighter-03…` 1:13 (Korvask), `fighter-04…` 0:16 (Tessik repro).

**6. MINOR: Specials pressed near the end of a chain or heavy are sometimes swallowed**
- Steps: Vellix, light x3 at about 80 ms spacing, then Special about 80 ms after the third light. Or Tailwhip Vault, then Special about 100 ms after it ends.
- Expected: the special comes out (buffered) or I get the "denied" feedback.
- Actual: nothing comes out, no energy is spent and nothing flashes. With Tessik the same light into special input cancels reliably.
- Video: `fighter-02…` 2:01 and 2:06 (mark).

**7. MINOR: A zone lore card can pop up mid-run at a hazard edge and eat the next input**
- Steps: Vellix enters `lw_belts` running right toward the first pool (warped in). The LOOMWORKS lore card appears.
- Expected: the card waits for a safe moment, or the dismiss press doesn't also count as gameplay input.
- Actual: my jump press dismissed the card. Because input is dropped on overlay close, the jump never happened, I ran on into the pool and lost a heart.
- Video: `fighter-02…` 1:34 (mark).

**8. MINOR: The first Up press after backing out of Settings on the title screen is ignored**
- Steps: title (no save), open SETTINGS, press Back, press Up once, then Confirm.
- Expected: the cursor moves to NEW GAME.
- Actual: the cursor stays on SETTINGS and Confirm opens Settings again. It happened twice. The second time my Left presses in there turned Master Volume down to 4 by accident.
- Video: `fighter-03…` 0:14–0:17 and 2:07–2:10 (mark).

**9. MINOR: Tessik's select-screen showcase pose draws outside the portrait circle and over the header**
- Steps: go to the select screen with Tessik highlighted and wait for the pose showcase.
- Actual: Tessik's arms and crest draw over "CHOOSE YOUR SPIRIT".
- Video: `fighter-03…` 0:18 (mark).

## Confusing or frustrating moments
- **The ultimate input is never shown.** The select screen names each ultimate (Sightline, Sentry Triad, Clamp Press…) and the HUD says "OVERCLOCK — READY [V]", but nothing says the ultimate is Up+Special while Overclocked. I found it by mashing combos with Brackmaw (`fighter-02…` 1:11–1:17). Pressing Overclock again or Heavy+Special does nothing.
- **Pressing Overclock with 75 % meter gives no feedback.** There's no buzz and no "not ready" message (`fighter-03…` 1:21).
- **Light can't be cancelled into dash, and the dash press isn't buffered either**, so it just vanishes (`fighter-04…` 0:12). Light into Special does cancel, so I expected dash to work too. Dash itself works fine for me (Tessik dodged two Stack Slams by dashing under them, 0:09–0:10).
- **Bulwark Catch has no readable window or catch list.** It caught a Tallock disc (the disc just vanished, +15 meter, no throw-back) and it countered Slab Swing beautifully. It did nothing against the stomp-quake spikes, and nothing told me which attacks are catchable (`fighter-03…` 1:10, 1:20).
- **Heavies are hard to commit to.** Tessik's Prism Hammer and Brackmaw's Vault Stomp both have enough recovery that Tallock's next tell lands on me (`fighter-02…` 0:36, `fighter-04…` 0:25).
- **The orange hopnode looks like a lantern pickup.** I walked into it twice in clip 1 (`fighter-01…` 0:35).
- **The Driftcache bats out-range Tessik's air slash.** I couldn't trade with the dive at all (`fighter-01…` 0:28).
- **Spike pits send me all the way back to the room entrance** (`fighter-01…` 0:51). That's harsh in the long `dc_cross`.
- **Vellix's double jump flies too far for small cross-ups.** I tried to hop over a shield walker and sailed into the pool (`fighter-02…` 1:48).
- **Overclocked Pulse Line looks almost the same as Sightline** (both full-screen cyan lines), so I can't tell from the video whether I spent my ultimate (`fighter-04…` 0:19 vs 0:24).
- **Orrubel gets cornered.** Ring Toss never reached Tallock from a safe distance, and once pinned at the left wall I had no escape option (`fighter-03…` 0:42).

## What I loved
- **Korvask's Bulwark Catch against Slab Swing.** Read the tell, press Special, Tallock flashes white, 16 damage and a chunk of meter. Then I punish with a chain into Drum Slam. I beat Tallock with a counter as the final hit (`fighter-03…` 1:15, 1:25). That's a real fighting-game moment.
- **The pogo.** The bounce off Tallock's head is big and snappy and very satisfying. It's just too strong right now (bug 2).
- **Hit feedback I could see.** Bosses flash white on big hits. The boss bar leaves a pale trail showing the chunk you just took off, which is great for judging a combo's damage. Being hit tints the screen red. The Overclock state gives each fighter a glow and a bigger silhouette, so it's obvious when you're powered up. Hitstop looked present in the video (attacks freeze for a beat on contact), but I can't judge it fully without sound.
- **Every fighter's kit reads differently on screen.** Tessik's blade arcs, Brackmaw's red box punches and huge ground ring, Vellix's pink streak and afterimages, Orrubel's whip line and floating ring, Korvask's chain clamps. With hitboxes on in Settings I could see exactly what each move covers. That's a great lab tool, keep it.
- **Tessik light x3 into Pulse Line** is a clean, honest combo (14 damage) and the cancel feels right (`fighter-04…` 0:15).
- **The ultimates have character.** Clamp Press grabbing a moth and crushing it, Sentry Triad's three orbiting turrets, Brackmaw's screen-wide stomp ring.

## Feature requests

**1. Training room ("Diagnostic Bay")**
- Pitch: a room off the title menu with a dummy enemy you can set to stand, walk, hover or block. It would show damage numbers, a combo counter and frame data (startup / active / recovery) for your last move, plus infinite meter and energy toggles.
- Why: I spent half my session warping and debug-filling meter just to test moves. A lab is the first thing a player like me looks for, and it teaches everyone the cancels and the ultimate input.
- Effort: M

**2. Move list in the pause menu**
- Pitch: a "Moves" page for the current fighter listing every attack with its input, including Up+Special for the ultimate, the down-strike and which moves cancel into which. Show a one-line tip on the first Overclock too.
- Why: the ultimate input is currently invisible, and the kit names on the select screen don't tell me how to do anything.
- Effort: S

**3. Combo counter and hit-confirm text**
- Pitch: a small counter near the fighter that ticks up on consecutive hits and shows the total damage when the string ends. It would add "COUNTER" when Bulwark Catch connects and "PUNISH" when you hit a boss during its recover state.
- Why: it rewards learning boss recover windows and makes Korvask's counter feel even better.
- Effort: S

**4. Chain knockback tuning: hitstun first, launch on the last hit**
- Pitch: make the first two hits of every light chain carry little knockback (or pull slightly inward) and put the big knockback on hit 3. Also let a dash buffer out of the last few frames of a light.
- Why: right now the chain only works on bosses (bug 1), and the defensive cancel I reach for (light into dash) isn't there.
- Effort: S

**5. Readable counter windows for Bulwark Catch**
- Pitch: give catchable boss attacks a distinct glint on their tell, and give the Catch a brief chain-flash during its active window. A successful catch on a projectile should throw it back for damage.
- Why: Catch is the best move in the game, but it's guesswork which attacks it works on, and the disc catch feels like a whiff when it actually succeeds.
- Effort: M

**6. Boss anti-pogo pattern**
- Pitch: give Tallock (and later bosses) a "shrug" that triggers after two consecutive pogos: the top disc spins and throws the player off with a clear tell.
- Why: it keeps the pogo as a reward but stops it from replacing the whole fight.
- Effort: S

**7. Per-fighter boss rematch board**
- Pitch: on the map or a rest node, a board showing which fighters have beaten which boss, with best time and hearts lost. You can rematch any beaten boss from a rest node.
- Why: once I have a main I want to master a matchup, and five fighters times four bosses is a lot of replay value.
- Effort: M

## Ratings (1–10)
- Fun: 7
- Controls: 6
- Clarity: 5
- Difficulty fairness: 6

## Verdict
The combat has more personality than I expected from a metroidvania. Five fighters with genuinely different plans, a working special cancel, a parry-style counter on Korvask that feels fantastic, and ultimates that look like ultimates. My tier list after one boss: **Korvask** is the strongest (6 hearts, the Catch counter turns Tallock's best attack into my damage, and Clamp Press is reliable). **Brackmaw** is a close second, mostly because the pogo breaks Tallock. **Tessik** is solid but jack-of-all-trades (and Sightline does only 10 damage for a full meter). **Orrubel** struggles once she's cornered. **Vellix** is clearly the weakest: 4 hearts, a jump too low to get on top of the boss, and a Blink Strike that ends inside the enemy. What holds it back is the stuff a fighting-game player notices in five minutes. The light chain pushes enemies out of itself, there's no dash cancel or forgiving buffer, the ultimate input is hidden, and the boss can be pogo-locked. Fix the chain knockback, add a move list and a training room, and this would be a really fun game to lab.
