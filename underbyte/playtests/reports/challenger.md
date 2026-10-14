# Challenger: Kai

## Who I am
I'm Kai. I play for the boss fights and I want every hit I take to be my own fault. I fought all four bosses with godmode off, and my rule was to keep going until I won or had lost three times.

## What I played
Four clips with 239 turns between them and 4:24 of live play in total. I went over the 200-turn budget, so I stopped Corrosant and Kernauth before reaching three losses. I set each fight up with debug calls (listed at the end) so I'd start with the abilities and the number of hearts a player would plausibly have by that point. The fights themselves were played straight.

| Clip | Live length | What happened |
|---|---|---|
| `challenger-01-tallock-three-losses.mp4` | 1:41 | New game as Tessik. I walked the first room, warped to the shrine, rested at the save node, then fought **Tallock** three times with 5 hearts and no abilities. I lost all three. My best attempt took him to **59/120** after about 29 s. The other two ended at 76/120 (13 s) and 80/120 (14 s). I never reached his enrage threshold (36 HP or less). |
| `challenger-02-weftyr-attempts.mp4` | 1:13 | Echo Jump and 6 hearts. **Weftyr** killed me once (13 s, she was at 177/180). On the second attempt I was down to 1 heart after about 20 s and had done **0 damage**. Over both attempts I did 3 damage in total. I then used debug to defeat her so I could see what happens after the fight. Her needle rain was still in the air, stayed on the floor and killed me (see bug 6). |
| `challenger-03-corrosant-ceiling.mp4` | 0:32 | Echo Jump, Burst Line and 7 hearts. I fought **Corrosant** for about 20 s and did **0/240** damage while losing 3 hearts. I stopped while still alive at 4/7. I spent most of the clip trying to find the boss on screen. |
| `challenger-04-kernauth-attempts.mp4` | 0:58 | All three abilities and 8 hearts. On attempt 1 against **Kernauth** I died after 18 s with him at 198/200. Attempt 2 was the best play I managed in this whole session: core hits only, 9 damage in about 8 s. I still dropped to 5/8 and stopped with him at 191/200. I then used debug to defeat him so I could see the ending, but no ending played. |

## Bugs

1. **Major: Stack Slam doesn't land on the spot it marks.**
   Steps: in clip 01, stand mid-arena while Tallock winds up Stack Slam. A floor marker appears under you, so dash out of it, then run back underneath him while he's in the air.
   Expected: the slam lands on the marker, so leaving the marker keeps you safe.
   Actual: I got hit away from the marker both times. At 0:34 I took a hit on the low platform after dashing about 70 px clear. At 1:18 I ran right, then back left under him, and he came down on me anyway. That second hit was my death #2.
   Video: `challenger-01-tallock-three-losses.mp4` 0:34 and 1:18.

2. **Major: Tallock pins you against the arena walls and you can't get past him.**
   Steps: in clip 01, fight near either wall. After every recover he walks toward you, and touching his body costs a heart. Dash has no i-frames, and without Echo Jump you can't clear his height from the floor.
   Expected: a first boss leaves you a way out of the corner if you read him correctly.
   Actual: I took two chip hits in a row just from trying to punish him. At 0:38 I dashed through him to get out and took a hit. At 1:36 I was back on the wall and lost two hearts in about a second, which led to death #3.
   Video: `challenger-01-tallock-three-losses.mp4` 0:38 and 1:36.

3. **Minor: Stomp Quake's ground spike seems to hit higher than it looks.**
   Steps: in clip 01, jump the traveling spike from Stomp Quake when it's about 45 px away.
   Expected: if the spike looks knee-high, a normal jump clears it.
   Actual: it hit me in mid-jump twice in a row at 1:10, and again at about 1:32.
   Video: `challenger-01-tallock-three-losses.mp4` 1:10.

4. **Major: Weftyr's Snare can't be read from its tell.**
   Steps: in clip 02, wait for the snare tell (her fins open).
   Expected: I see the thread lie on the floor, then I jump it.
   Actual: on the first snare (0:47) I was wrapped and hurt about 0.2 s after the tell, and I never saw a thread. On the second (1:01) I did see the full-width thread at knee height and cleared it with Echo Jump. It was still there when I came down, and it caught me on landing. So reacting to the tell with a jump puts you straight into the thread.
   Video: `challenger-02-weftyr-attempts.mp4` 0:47 and 1:01.

5. **Major: Weftyr still hurts you after her Spin, when it looks safe to punish.**
   Steps: in clip 02, dodge the floor ring, let her drill into the floor, then walk in to attack while she's recovering.
   Expected: the drilled-in shuttle is a safe moment to hit her.
   Actual: I took two separate hits about 70 frames apart, which is longer than the i-frame window. Later, while I ran across the arena, a Spin came down on me (death #1, 0:33). The only safe places to punish her are the far walls, and there are very few of them.
   Video: `challenger-02-weftyr-attempts.mp4` 0:21 and 0:33.

6. **Minor: Weftyr's needles stay lethal after she's gone.**
   Steps: in clip 02, defeat Weftyr while her needle rain is falling. I used `UB.debug.defeatBoss("weftyr")`, then walked into one of the needles stuck in the floor.
   Expected: the needles disappear when the boss dies.
   Actual: the needles kept falling and stayed in the floor, and one killed me while the boss was already marked defeated.
   This may only happen through the debug path, so it needs checking on a real kill.
   Video: `challenger-02-weftyr-attempts.mp4` 1:09.

7. **Major: Corrosant is off-screen or behind the HUD most of the time.**
   Steps: in clip 03, enter `bv_corrosant` and stay on the floor.
   Expected: I can see the boss I'm fighting.
   Actual: from the floor I could only see the boss bar and some small green drips. I had to climb to the top platform before the camera showed the boss, and then its head was drawn underneath the hearts and energy HUD. All I could reach was the head during its lunge, and the body hit me as it pulled back.
   Video: `challenger-03-corrosant-ceiling.mp4` 0:16 and 0:30.

8. **Major: Kernauth's summoned wisps don't seem to take hits.**
   Steps: in clip 04, let Kernauth Summon and jump-attack the two eye-wisps as they chase you.
   Expected: they die, or at least react to being hit.
   Actual: I swung at them three times, they gave no hit reaction, and `enemies` stayed at 2. Every time one touched me I lost a heart. Between the flare orbs, the summons, the root spikes and the cable, I lost 7 hearts in 17 s.
   Video: `challenger-04-kernauth-attempts.mp4` 0:30 and 0:31.

9. **Minor: You can stand inside Kernauth, and his Cable Sweep starts right on top of you.**
   Steps: in clip 04, jump-attack the core several times in a row.
   Expected: his body pushes you back out, and the cable shows its whip-tip before it can hit you.
   Actual: I drifted forward until I was standing inside his seated body at x=961 (0:51). Shortly after, the cable's tip appeared at his base where I was standing and hit me before I saw it (0:53).
   Video: `challenger-04-kernauth-attempts.mp4` 0:51 and 0:53.

10. **Minor: a hit I couldn't trace.**
    At 0:23 in clip 04 I got hit while jumping at the core during Root Spikes recover. I saw no spike or projectile. A brief flash naming the attack would fix this.
    Video: `challenger-04-kernauth-attempts.mp4` 0:23.

11. **Minor (tooling): `defeatBoss("kernauth")` skips the ending.**
    The boss disappears, an empty throne arch is left, and nothing plays even after 5 s or pressing Up at the throne. That meant I couldn't judge the victory sequence or the ending.
    Video: `challenger-04-kernauth-attempts.mp4` 0:58.

## Confusing or frustrating moments
- **Telegraphs (checklist):** most tells are big and readable, like Tallock's slab windup, Kernauth's floor dots before Root Spikes, and Weftyr's dash line. The problem is the next step: the attack doesn't match its tell. Stack Slam lands somewhere other than its marker, and the Snare thread is still there when you land after jumping it.
- **Hits you can't avoid (checklist):** the hits I'd call unavoidable came from bodies, not attacks. That covers Tallock walking you into a wall, the Weftyr shuttle while it recovers, Corrosant's body as it pulls back, and Kernauth's wisps. Dash has no i-frames, so you can't escape through any of them.
- **Phases and enrage (checklist):** I never reached an enrage or Kernauth's phase 2 honestly. My best was Tallock at 59/120, and his enrage starts at 36. So I can't say whether the phases feel different. Getting there has to be possible for a solid player, and here it wasn't.
- **Difficulty curve (checklist):** right now it's flat and hard. Tallock is already a wall for a first boss with no double jump. On Weftyr and Corrosant I did almost no damage at all. On Kernauth I could hit the core, but 3 damage a hit against 200 + 240 HP is more than 140 clean hits for the whole fight.
- **Fight length (checklist):** my Tallock attempts lasted 13–29 s, and at my best damage rate a full kill would take about 50–60 s, which is fine. Weftyr and Corrosant ended in about 20 s, but only because I was losing. Kernauth's phase 1 alone works out to 2–3 minutes at my best pace.
- **Readability:** during i-frames the fighter blinks completely out of view on some frames, and in a crowded Kernauth screen I briefly lost track of my own position.
- **Retrying:** a death sends you to the save node with a fresh 5 hearts, and the walk back to Tallock takes about 15 s of travel through the shrine. For a boss you'll retry 10 times, that's a lot of dead time.

## What I loved
- Tallock's Slab Swing is a well-made first-boss attack. The windup is big, there's a clear moment to jump it, and the whiff leaves a fair punish window. When I spaced it properly I could take him from 120 to 59 in under 30 s, and that felt earned.
- Each boss arrival has a strong title card ("WEFTYR · THE SHUTTLE THAT WOULD NOT STOP", "CORROSANT · KEEPER OF THE BRINE"), and the boss bar with its segment ticks makes it easy to see how much damage you've done.
- Kernauth's core being worth more than the rest of his mass (×1 vs ×0.5) is a good skill reward. Once I found the jump-attack spacing, I could tell when I was landing real hits.
- Each arena has its own look (blue stacks, rust looms, green brine, red roots), so the fights don't blur together.

## Feature requests
1. **Rehearsal Node** (M)
   After you meet a boss for the first time, the nearest save node offers a "rehearse" option. It replays the fight from full HP and loses no progress. Your fastest rehearsal is shown next to the node.
   Why I want it: I would spend an hour learning Tallock's patterns if the runback didn't eat about 15 s of every retry.

2. **Fault Trace on death** (M)
   On the game-over screen, show a 2-second ghost replay of the hit that killed you, with the attack's name and its hitbox outlined.
   Why I want it: it tells me whether I misread the attack or the hitbox was off, which matters for bugs 1, 3, 4 and 10.

3. **Phase Step module from Scrivvet** (S)
   A vendor upgrade that gives the dash about 6 i-frames. Alternatively, a dodge timed just before contact gives Overclock meter.
   Why I want it: it gives skilled players a way out of corners and body contact without making the bosses easier for everyone else.

4. **Edge Beacon + HUD fade** (S)
   When the boss, or the part of it you can damage, is off-camera, show an arrow at the screen edge. When the boss is underneath the HUD, fade the HUD.
   Why I want it: Corrosant was invisible for half my fight.

5. **Fault Log boss trials** (M)
   After you finish the game, unlock a menu that replays every boss and records your time, hits taken and whether you won without being hit, with a badge for a no-hit win.
   Why I want it: this is why I'd replay the game, and it would show the developers which attacks people get hit by most.

## Ratings
- Fun: 5/10
- Controls: 6/10
- Clarity: 4/10
- Difficulty fairness: 3/10

## Verdict
The boss designs are good, and each one sets out a clear set of attacks. Tallock was the only fight where I improved from one attempt to the next and wanted another try. The other three beat me through body contact and tells I couldn't act on, not through attack patterns I hadn't learned yet. Across 4:24 of honest fighting I got Tallock to about half health, did 3 damage to Weftyr, 0 to Corrosant and 11 to Kernauth. In that time I never saw an enrage, never saw a phase 2, and never saw the ending play. To make these fights fair for a player like me:
- Make Stack Slam land where it marks, and make Snare land when it shows.
- Give the player a way past a boss's body in a corner.
- Keep Corrosant on screen.
- Make Kernauth's wisps die when hit.
- Look again at how much damage it takes to kill Kernauth.

After those fixes I'd come back to try for no-hit runs.

### Debug calls I used, and why
- **Clip 01**
  - `Object.keys(UB.debug)`, `UB.debug.rooms()` ×2: to list the debug API and the room ids so I could find the arenas.
  - `warp("dc_shrine","L")`: skipped the walk to the first boss.
  - `warp("dc_shrine","R")` ×2: skipped the runback after deaths 1 and 2.
- **Clip 02**
  - `defeatBoss("tallock")` + `grant("echoJump",true)` + `setMaxHp(6)`: the loadout a player would have after boss 1 plus one core.
  - `warp("lw_rest","L")`: put me at the node before Weftyr.
  - `UB.debug.boss()` (keys only): to check what the boss state shows.
  - `defeatBoss("weftyr")`: to see what happens after the fight. Bug 6 showed up there.
- **Clip 03**
  - `setMaxHp(7)` + `warp("bv_rest","L")`: the loadout for boss 3 and the node before Corrosant.
- **Clip 04**
  - `defeatBoss("corrosant")` + `grant("gripProtocol",true)` + `setMaxHp(8)` + `warp("rw_rest","L")`: the final-boss loadout.
  - `defeatBoss("kernauth")`: to try to see the ending. Nothing played (bug 11).
- God mode stayed off the whole time.
