# Playtest report: Vee (speedrunner)

## Who I am

I'm Vee. I speedrun and hunt glitches. I care about movement tech, frame windows and sequence breaks, and I always want to know where the walls really are.
I played as Vellix (fastest run speed, 4 hearts) the whole time, because a speedrunner picks the fastest runner on the roster.

## What I played

Total: 3 clips, 210 turns, **4:25 of recorded live play**. No console errors in any clip.

| Clip | Live length | What happened |
|---|---|---|
| `speedrunner-01-vellix-driftcache-tallock-attempts.mp4` | 2:07 | New game as Vellix, played blind through Driftcache: dc_wake, dc_fall, dc_cross, dc_shrine. I tested pogo, coyote time and the crumble blocks, and died to the dc_fall crumble-into-spikes drop. I opened Scrivvet's shop, then had three tries at Tallock. My best try left him at 26/120 in phase 2. One death came from Blink Strike putting me inside his body. |
| `speedrunner-02-gate-breaks-burstline-skip.mp4` | 1:07 | Ability-gate practice using warps and grants (all logged below). The **Echo Jump gate held**. **Both Burst Line crawlspace gaps (bv_sluice, bv_catwalk) fell to Jump + Echo Jump with no dash.** The Grip Protocol gate at ns_base was inconclusive: the static pool and glarewisps killed me before I could test the shaft. |
| `speedrunner-03-driftcache-timed-route.mp4` | 1:11 | A clean New Game, timed from first input to the door of Tallock's arena. I had one death (a hopnode hit me at 1 HP, which sent me back to dc_wake), one spike reset, and a damage-boost through a hopnode. I reached dc_sentinel at about **62.9 s IGT**. |

### Driftcache timing (Vellix, real inputs, no debug)

| Segment | IGT | Notes |
|---|---|---|
| Start to dc_cross door (attempt 1) | **~11.6 s** (695 f) | Includes the Driftcache lore card. |
| Start to dc_sentinel door (whole clip 3) | **~62.9 s** (3 772 f) | Includes 1 death with a return to dc_wake, 1 spike reset in dc_fall and the lore card. |
| dc_wake respawn to dc_sentinel door, no deaths | **~40.7 s** | About 5 s went to the dc_fall spike reset and about 4 s to fumbling on the beetle ledge. |
| Estimated clean route | **~30–32 s** | Route: drop straight from the dc_fall top ledge onto the thin platform at (453,720), skipping the pillar ledge. Then Right 380 ms, Left 250 ms, Right 450 ms to land right of the floor spikes. Kill the first dc_cross beetle, full-jump the pit from x≈390, hop the block, jump beetle and pit 2 in one input, then damage-boost through the hopnode to the shrine. |

Tallock is not in my timing: I never beat him. My best attempt left him at 26/120.

### Debug calls (all in clip 02; each is in session.json)

| Video | Call | Why |
|---|---|---|
| 0:19 | `Object.keys(UB.debug)` | Listed the API so I could practise gates in isolation. |
| 0:19 | `warp("dc_sentinel","L")` | Go straight to the Echo Jump gate. |
| 0:19 | `defeatBoss()` | Clear Tallock so I could reach the gate. Without an argument this did nothing except push `null` into bossesDefeated (see bugs). |
| 0:21 | `defeatBoss("tallock")` | Same purpose, done correctly this time. It also granted Echo Jump. |
| 0:22 | `grant("echoJump", false)` | Remove Echo Jump to test the gate without it. |
| 0:30 | `grant("echoJump", true)` | Give back the ability a player would have at the Burst Line gates. |
| 0:30 | `warp("bv_sluice","L")` | Practise Burst Line gate 1. |
| 0:46 | `warp("bv_catwalk","L")` | Practise Burst Line gate 2. |
| 0:49 | `setHp(4)` | Refill hearts between practice reps. |
| 0:51 | `grant("burstLine", true)` | Abilities a player would have by Nullspire. |
| 0:51 | `warp("ns_base","L")` | Practise the Grip Protocol gate. |
| 1:00 | `setHp(4)` | Refill hearts between practice reps. |

### Gate results

| Gate | Result | How I tested it |
|---|---|---|
| dc_sentinel R2 5-tile block (Echo Jump) | **Holds** | Plain jump, coyote jump off the arena floor, air heavy (Tailwhip Vault), and jump spam into the corner. The apex falls well short. No clip. Clip 2, 0:23–0:30. |
| bv_sluice 6-tile crawlspace gap (Burst Line) | **Broken** | Jump + Echo Jump in the 2-tile-tall crawlspace. Repro 2/2. Clip 2, 0:39–0:46. |
| bv_catwalk pool gap (Burst Line) | **Broken** | Same tech, first try. Clip 2, 0:49–0:51. |
| ns_base 10-tile shaft (Grip Protocol) | Not tested | The corridor hazards killed me first. Clip 2, 0:52–1:07. |

### Movement tech I confirmed

These all feel good and should stay:

* **Coyote jump** off a pit lip after I had already started to fall. In clip 3 at 0:22 it saved the dc_cross pit.
* **Jump-cancel out of a light attack.** I pressed Light, then Jump 60 ms later, and left the ground at once (clip 1, 1:59).
* **Damage boost.** The 60 f of i-frames after a hit let me sprint through a hopnode at 1 heart and through the door (clip 3, ~1:03–1:05).

## Bugs

### 1. MAJOR: Burst Line gates can be crossed without Burst Line (Jump + Echo Jump ceiling bonk)

* **Video:** `speedrunner-02-gate-breaks-burstline-skip.mp4` at **0:41**, repeated at **0:46**; bv_catwalk at **0:51**.
* **Steps:**
  1. Vellix with Echo Jump and without Burst Line.
  2. In bv_sluice, Down+Jump through the top-left grate onto the crawlspace floor.
  3. Hold Right for about 1.1 s.
  4. At the lip of the pool gap, press Jump, then press Jump again about 110–120 ms later (the Echo Jump). Both jumps hit the 2-tile ceiling, but horizontal speed carries.
  5. Keep holding Right. You land on the middle block (x≈750, y=240).
  6. In bv_catwalk, from the L spawn, hold Right about 0.99 s, then Jump and Echo Jump 110 ms apart. You land at x≈776 past the pool.
* **Expected:** these gaps need Burst Line, as the design says.
* **Actual:** crossed with no dash, 3 of 3 attempts in total.
* **Fix or keep:** if loop B (via bv_catwalk) lets a player reach Brinevault before Weftyr, this is a Weftyr skip and should be fixed: make the gap 7 tiles, or have a ceiling bonk refuse the Echo Jump. If it only saves backtracking, I'd ask you to keep it as Vellix tech. I only tested Vellix (300 run speed), so slower fighters may not make it.

### 2. MAJOR: Blink Strike ends inside Tallock's body and you take contact damage

* **Video:** `speedrunner-01-vellix-driftcache-tallock-attempts.mp4` at **1:16**.
* **Steps:**
  1. Vellix in the Tallock fight, standing about 100 px to his right, after a Slab Swing.
  2. Tap Left to face him, then press Special (C).
  3. Blink Strike hits (Tallock 112 → 105) but leaves Vellix overlapping his stack.
  4. Contact damage lands at once. At 1 heart that was a death.
* **Expected:** the blink stops at the boss's near edge or passes through to the far side, and arriving gives no contact hit.
* **Actual:** I ended inside the body and was hurt the moment the blink finished.
* **Fix or keep:** fix. It makes Vellix's signature move self-damaging against the first boss.

### 3. MINOR: crumble blocks in dc_fall drop you blind onto a floor-spike bed

* **Videos:** `speedrunner-01…` at **0:27** (died), and the same spike bed in `speedrunner-03…` at **0:46**.
* **Steps:** in dc_fall, take the right-hand descent to the cracked blocks at about (446,1020) and stand still.
* **Expected:** you can see the landing before you commit. If not, a spike reset should put you back near the blocks.
* **Actual:** the blocks give way and drop you about 450 px onto spikes you couldn't see. The spike reset then puts you back at the top-left room entrance.

### 4. MINOR: the RESTORED banner shows through Scrivvet's shop panel

* **Video:** `speedrunner-01…` at **1:04**.
* **Steps:** rest at the dc_shrine node, walk to Scrivvet, then press Up to trade straight away.
* **Expected:** the shop panel covers the toast.
* **Actual:** the "RESTORED · Saved · hearts full · energy full" banner and its box outline draw through the shop list. It looks like a second selection box around SPARE CELL and HOT CLOCK.

### 5. MINOR: the WEIGHT stat bar reads backwards

* **Video:** `speedrunner-01…` at **0:02**.
* **Steps:** on the select screen, compare Brackmaw with Vellix.
* **Expected:** Brackmaw (armoured, "The Walking Vault") has the most weight.
* **Actual:** Brackmaw's WEIGHT bar is about 45 % and fragile Vellix's is 100 %. If the bar means "how far you get knocked back", the label should say so.

### 6. MINOR: the bv_sluice arrival grate is a box with no hint of how out

* **Video:** `speedrunner-02…` at **0:36–0:39**. It happened after the warp, and again after a natural lw_weftyr → bv_sluice transition at 0:37.
* **Steps:** arrive in bv_sluice from the top-left, then try to walk off the grate at (141,120).
* **Expected:** you can walk off, or a prompt tells you to use Down+Jump.
* **Actual:** Left and Right do nothing (it's a closed shaft), and Jump loops you back up into lw_weftyr. Only Down+Jump continues, and nothing on screen says so.

### 7. MINOR (plausible, seen after a warp): ns_base hazard respawn drops you mid-air over the open shaft

* **Video:** `speedrunner-02…` at **0:57**.
* **Steps:** enter ns_base from the L side, go down the left shaft, then touch the static pool in the bottom corridor.
* **Expected:** respawn standing on the entry ledge.
* **Actual:** across three resets I respawned once at (261,190) and once at (214,136), both mid-air above the open shaft, and once correctly on the ledge at (138,120). The mid-air respawns fell straight into the glarewisps. This needs checking with a natural entry, because my entry was a warp.

### 8. MINOR: Down+Light onto a hopnode gives contact damage, not a pogo

* **Videos:** `speedrunner-03…` at **0:13**; `speedrunner-02…` at **0:19** (five failed tries on hopnode and spikes).
* **Steps:** fall onto a hopnode from directly above while holding Down and pressing Light just before contact.
* **Expected:** a pogo bounce (the design lists `vy=−580`).
* **Actual:** I took contact damage. The down-air box is small and comes out late. Down+Light over spikes gave no bounce either, only a hazard reset (clip 1, 0:16).

### 9. MINOR (debug API only): `UB.debug.defeatBoss()` with no argument corrupts state

* **Video:** `speedrunner-02…` at **0:19**.
* **Steps:** in the Tallock arena during the intro, call `UB.debug.defeatBoss()` with no argument.
* **Expected:** it defeats the current room's boss, or refuses.
* **Actual:** Tallock stays alive and `bossesDefeated` becomes `[null]`.

## Confusing or frustrating moments

* **The lore card interrupts the run.** The Driftcache card opens about 1.5 s into the first sprint, in mid-air (clip 1 at 0:05, clip 3 at 0:03). It freezes play and eats the jump you are holding.
* **Tallock's intro can't be skipped.** It lasts about 2.5 s, you can't move or attack during it, and it replays in full on every retry (clip 1 at 1:25, clip 3 at 1:11).
* **Spike resets in tall rooms send you to the room entrance.** In dc_fall that means re-doing the whole descent (clip 1 at 0:17). The design says this is intended, but it is the biggest time loss in a Driftcache run.
* **Contact damage everywhere at 4 hearts.** Beetles and hopnodes hurt on touch, and a hopnode's hop timing decides whether your landing after the dc_cross pit is safe. My run in clip 3 died to exactly that at 0:23.
* **Tallock's phase-2 rhythm.** The stomp quake arrived about 10 frames after I read the tell. Recover windows were short enough that I took a Slab Swing while trying to punish (clip 1 at 1:44).
* **Dash before Burst Line.** Pressing Shift does nothing until you have Burst Line, with no sound or HUD feedback (clip 2 at 0:06). I didn't know whether dash was locked or my input had dropped.

## What I loved

* **Vellix's movement.** 300 px/s on the ground with a crisp jump cut. Coyote time and the input buffer are generous enough that pit jumps feel fair once you learn the run-up.
* **Jump-cancel out of attacks.** You can poke and leave, which is exactly how a runner wants to fight trash.
* **Damage boosting.** The i-frames after a hit are long enough to plan around (clip 3, ~1:04). That's real risk-for-time tech.
* **Readable boss tells.** Tallock telegraphs Disc Toss, Stack Slam, Slab Swing and Stomp Quake clearly, and the stack lighting up on the Stomp Quake tell is lovely.
* **Zones that look different.** Driftcache blue, Loomworks rust, Brinevault green and Nullspire violet are instantly readable at speed.
* **Solid geometry.** No out-of-bounds clips at the room edges, the arena corner or the crumble blocks I tried.

## Feature requests

### 1. Run timer and auto-splits (effort: M)
* **Pitch:** an optional on-screen in-game timer that auto-splits on every room transition and boss kill. At the end it shows a split table: best per room, and green or red against your best. The timer pauses on menus exactly as IGT already does.
* **Why I want it:** right now I time runs from debug state. A built-in timer turns every player into a potential runner and gives the game a long tail.

### 2. Skippable lore cards and boss intros after the first view (effort: S)
* **Pitch:** a setting with three choices for lore cards: Always, First time, Never. Once you've seen a boss's intro card, Confirm skips it.
* **Why I want it:** it removes about 2.5 s of dead time per boss retry, and it stops the mid-jump freeze on the first sprint of a run.

### 3. Pogo cues and spike pogo (effort: M)
* **Pitch:** let Down+Light in the air bounce off spike tiles as well as enemies, with a bright flash and a distinct sound when it connects. Make the down-air box a little taller and active a few frames earlier.
* **Why I want it:** pogo chains are the core of movement tech in a game like this, and right now nobody will find them.

### 4. Hazard respawn on last safe footing in tall rooms (effort: M)
* **Pitch:** in rooms taller than two screens, hazard resets put you on the last solid tile you stood on for a full second, not at the room entrance. It's still a heart lost, but not 15 s of replaying.
* **Why I want it:** it keeps the penalty without making dc_fall's spike bed a run-killer every time.

### 5. Rehearsal rooms at save nodes (effort: M)
* **Pitch:** while resting at a node, pick any visited room to replay with a timer and full hearts, with no effect on the save. Leaving puts you back at the node.
* **Why I want it:** learning a route or a boss currently means dying and walking back. Rehearsal makes practice honest without a debug console.

### 6. Input display overlay (effort: S)
* **Pitch:** a settings toggle that draws the held directions and buttons in a corner, with jump, dash and attack lit on the frame they are pressed.
* **Why I want it:** runners and glitch hunters record everything. An input display lets viewers and moderators verify tech like the Burst Line skip.

## Ratings

| | Score (1–10) |
|---|---|
| Fun | 7 |
| Controls | 7 |
| Clarity | 5 |
| Difficulty fairness | 5 |

## Verdict

UNDERBYTE has the bones of a great routing game. Vellix's ground speed, jump cut, coyote time and attack cancels feel tight. I found real tech (damage boosts, coyote saves) in the first ten minutes, and the room geometry is solid: no out-of-bounds anywhere I pushed. The Echo Jump gate held. Both Burst Line gates fell to a two-jump ceiling bonk, which the designers need to rule on before anyone routes it. What holds the game back for me is friction, not difficulty. Pogo almost never connects, contact damage at 4 hearts makes hop timing decide a run, spike resets send you to the top of tall rooms, and unskippable cards cost seconds every attempt. Fix Blink Strike landing inside bosses, give us a timer and skips, and I'd be routing this for a long time.
